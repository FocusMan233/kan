import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { db, tx, recompute, AUDIO_DIR, MIN_VOTES, YES_RATIO, ELIGIBLE_SQL, seedPrompts } from './db.js';
import { LANGUAGES, QUARTIERS, ZONES, NPCS, MISSIONS, promptKey } from './content.js';
import { registerMaternite, registerAssistant, startScheduler as startMaterniteScheduler } from './maternite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = 'changeme-admin';
  console.warn('⚠  ADMIN_PASSWORD non défini : mot de passe admin par défaut "changeme-admin". Définis-le avant de mettre en ligne.');
}

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

// ---------- utilitaires ----------
const LANG_CODES = LANGUAGES.map(l => l.code);
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const clean = (s, max = 500) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ɛɔŋɩʋ\s]/g, ' ').replace(/\s+/g, ' ').trim();
const safeEq = (a, b) => { const A = Buffer.from(sha256(String(a))), B = Buffer.from(sha256(String(b))); return crypto.timingSafeEqual(A, B); };
const nowIso = () => new Date().toISOString();

const buckets = new Map();
function rate(name, max, windowMs) {
  return (req, res, next) => {
    const id = `${name}:${req.user?.id || req.ip}`;
    const t = Date.now();
    const b = (buckets.get(id) || []).filter(x => t - x < windowMs);
    if (b.length >= max) return res.status(429).json({ error: 'Trop de requêtes, patiente un instant.' });
    b.push(t); buckets.set(id, b); next();
  };
}
setInterval(() => { const t = Date.now(); for (const [k, v] of buckets) if (!v.some(x => t - x < 120000)) buckets.delete(k); }, 60000).unref();

const wrap = fn => (req, res, next) => { try { const r = fn(req, res, next); if (r?.catch) r.catch(next); } catch (e) { next(e); } };

function publicUser(u) {
  return { id: u.id, name: u.name, langs: JSON.parse(u.langs || '[]'), quartier: u.quartier, avatar: u.avatar ? JSON.parse(u.avatar) : null, points: u.points };
}

// ---------- auth joueur ----------
const auth = wrap((req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non connecté.' });
  const u = db.prepare('SELECT * FROM users WHERE token=?').get(token);
  if (!u) return res.status(401).json({ error: 'Session invalide.' });
  req.user = u;
  db.prepare("UPDATE users SET last_seen=datetime('now') WHERE id=?").run(u.id);
  next();
});

// ---------- contenu ----------
function buildContent() {
  const missions = MISSIONS.map(m => ({
    id: m.id, zone: m.zone, level: m.level, reward: m.reward, title: m.title, summary: m.summary, intro: m.intro,
    sensitive: !!m.sensitive,
    steps: m.steps.map((s, i) => ({ npc: s.npc, say: s.say, key: promptKey(m.id, i) })),
  }));
  const news = db.prepare("SELECT key, text_fr FROM prompts WHERE news=1 AND active=1 ORDER BY id DESC LIMIT 5").all().reverse();
  if (news.length) missions.push({
    id: 'flash', zone: 'meeting', level: 1, reward: 0, title: 'Flash info du Burkina',
    summary: 'Les dernières bonnes nouvelles du pays.', intro: 'Une annonce toute fraîche ! Traduis-la pour Yaaba.', sensitive: false,
    steps: news.map(n => ({ npc: 'animateur', say: n.text_fr, key: n.key })),
  });
  return { languages: LANGUAGES, quartiers: QUARTIERS, zones: ZONES, npcs: NPCS, missions, place_types: ['mosque', 'church', 'school', 'market', 'health', 'pharmacy', 'fuel', 'bank', 'food', 'hotel', 'gov', 'sport', 'shop', 'junction', 'other'] };
}
app.get('/api/content', (req, res) => res.json(buildContent()));

app.get('/api/stats', (req, res) => {
  const r = db.prepare(`SELECT (SELECT COUNT(*) FROM users) players, (SELECT COUNT(*) FROM translations) translations,
    (SELECT COUNT(*) FROM translations WHERE status='validated') validated`).get();
  res.json(r);
});

// ---------- inscription (sans vérification du numéro, comme décidé pour la phase de test) ----------
app.post('/api/register', rate('reg', 20, 600000), wrap((req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 40);
  const phone = String(b.phone || '').replace(/[^\d+]/g, '');
  const digits = phone.replace(/\D/g, '');
  const langs = (Array.isArray(b.langs) ? b.langs : []).filter(l => LANG_CODES.includes(l));
  const quartier = QUARTIERS.some(q => q.id === b.quartier) ? b.quartier : QUARTIERS[0].id;
  if (name.length < 2) return res.status(400).json({ error: 'Écris ton nom.' });
  if (digits.length < 8 || digits.length > 15) return res.status(400).json({ error: 'Numéro invalide.' });
  if (!langs.length) return res.status(400).json({ error: 'Choisis au moins une langue.' });
  if (b.consent !== true) return res.status(400).json({ error: 'Tu dois accepter les conditions pour jouer.' });
  const avatar = JSON.stringify(b.avatar && typeof b.avatar === 'object' ? b.avatar : {});
  let u = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if (u) {
    db.prepare('UPDATE users SET name=?, langs=?, quartier=?, avatar=? WHERE id=?').run(name, JSON.stringify(langs), quartier, avatar, u.id);
  } else {
    const token = crypto.randomBytes(24).toString('hex');
    const ref = Number(b.ref) > 0 && db.prepare('SELECT id FROM users WHERE id=?').get(Number(b.ref)) ? Number(b.ref) : null;
    const r = db.prepare('INSERT INTO users (name, phone, token, langs, quartier, avatar, referred_by, consent_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(name, phone, token, JSON.stringify(langs), quartier, avatar, ref, nowIso());
    if (ref) db.prepare('UPDATE users SET points = points + 20 WHERE id=?').run(ref);
    u = { id: r.lastInsertRowid };
  }
  u = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  res.json({ token: u.token, user: publicUser(u) });
}));

app.get('/api/me', auth, wrap((req, res) => {
  const u = req.user;
  const mine = db.prepare(`SELECT COUNT(*) n, SUM(status='validated') v, SUM(audio_file IS NOT NULL) a FROM translations WHERE user_id=?`).get(u.id);
  const done = db.prepare('SELECT mission_id FROM mission_progress WHERE user_id=?').all(u.id).map(r => r.mission_id);
  const rank = db.prepare('SELECT COUNT(*)+1 r FROM users WHERE points > ?').get(u.points).r;
  res.json({ user: publicUser(u), stats: { translations: mine.n, validated: mine.v || 0, voice: mine.a || 0, rank, listen_total: u.listen_total, listen_correct: u.listen_correct }, missions_done: done });
}));

app.get('/api/leaderboard', wrap((req, res) => {
  const q = QUARTIERS.some(x => x.id === req.query.quartier) ? req.query.quartier : null;
  const rows = db.prepare(`SELECT name, quartier, points FROM users ${q ? 'WHERE quartier=?' : ''} ORDER BY points DESC, id ASC LIMIT 20`).all(...(q ? [q] : []));
  res.json(rows);
}));

// ---------- traduire ----------
app.post('/api/translate', auth, rate('tr', 60, 60000), wrap((req, res) => {
  const b = req.body || {};
  const p = db.prepare('SELECT * FROM prompts WHERE key=? AND active=1').get(String(b.prompt_key || ''));
  if (!p) return res.status(404).json({ error: 'Phrase inconnue.' });
  const langs = JSON.parse(req.user.langs || '[]');
  const lang = String(b.lang || '');
  if (!LANG_CODES.includes(lang) || !langs.includes(lang)) return res.status(400).json({ error: 'Langue non autorisée.' });
  let text = clean(b.text, 500);
  const voiceOnly = b.voice === true && text.length === 0;   // l'écriture n'est pas obligatoire : la voix suffit (le fichier audio suit)
  if (!voiceOnly && text.length < 2) return res.status(400).json({ error: 'Écris ta traduction ou enregistre ta voix.' });
  if (text && norm(text) === norm(p.text_fr)) return res.status(400).json({ error: 'Écris la phrase dans ta langue, pas en français.' });
  const ex = db.prepare('SELECT * FROM translations WHERE prompt_id=? AND user_id=? AND lang=?').get(p.id, req.user.id, lang);
  if (voiceOnly && ex) text = ex.text || '';
  let id, awarded = 0;
  tx(() => {
    if (ex) {
      id = ex.id;
      db.prepare("UPDATE translations SET text=?, status='pending', yes=0, no=0, admin_status=NULL, paid=0, updated_at=datetime('now') WHERE id=?").run(text, id);
      db.prepare('DELETE FROM votes WHERE translation_id=?').run(id);
    } else {
      id = Number(db.prepare('INSERT INTO translations (prompt_id, user_id, lang, text) VALUES (?,?,?,?)').run(p.id, req.user.id, lang, text).lastInsertRowid);
      awarded = 10;
      db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(awarded, req.user.id);
    }
  });
  res.json({ id, points_awarded: awarded });
}));

app.post('/api/translate/:id/audio', auth, rate('au', 40, 60000),
  express.raw({ type: () => true, limit: '3mb' }), wrap((req, res) => {
    const t = db.prepare('SELECT * FROM translations WHERE id=? AND user_id=?').get(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ error: 'Traduction introuvable.' });
    if (!Buffer.isBuffer(req.body) || req.body.length < 1500) return res.status(400).json({ error: 'Enregistrement trop court.' });
    const ct = String(req.headers['content-type'] || '').toLowerCase();
    const ext = ct.includes('mp4') || ct.includes('aac') ? 'm4a' : ct.includes('ogg') ? 'ogg' : ct.includes('wav') ? 'wav' : 'webm';
    const file = `${t.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(AUDIO_DIR, file), req.body);
    if (t.audio_file) fs.rm(path.join(AUDIO_DIR, path.basename(t.audio_file)), () => {});
    let awarded = 0;
    tx(() => {
      db.prepare("UPDATE translations SET audio_file=?, updated_at=datetime('now') WHERE id=?").run(file, t.id);
      if (!t.audio_file) { awarded = 5; db.prepare('UPDATE users SET points = points + 5 WHERE id=?').run(req.user.id); }
    });
    res.json({ ok: true, points_awarded: awarded });
  }));

// Audio lu par les joueurs pendant les tâches « écouter » (uniquement les traductions actives).
app.get('/api/audio/:id', auth, wrap((req, res) => {
  const t = db.prepare("SELECT audio_file FROM translations WHERE id=? AND COALESCE(admin_status,'')!='rejected'").get(Number(req.params.id));
  if (!t?.audio_file) return res.status(404).end();
  res.sendFile(path.join(AUDIO_DIR, path.basename(t.audio_file)));
}));

// ---------- écouter / comprendre (validation par le jeu) ----------
app.get('/api/listen', auth, rate('li', 90, 60000), wrap((req, res) => {
  const langs = JSON.parse(req.user.langs || '[]');
  if (!langs.length) return res.json({ task: null });
  const zone = ZONES[req.query.zone] ? req.query.zone : 'quartier';
  const ph = langs.map(() => '?').join(',');
  const t = db.prepare(`SELECT t.id, t.lang, t.text, t.audio_file, t.prompt_id, p.zone
    FROM translations t JOIN prompts p ON p.id=t.prompt_id
    WHERE COALESCE(t.user_id,0) != ? AND t.lang IN (${ph}) AND t.status != 'rejected' AND COALESCE(t.admin_status,'') != 'rejected' AND p.active=1 AND (t.text != '' OR t.audio_file IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.translation_id=t.id AND v.user_id=?)
    ORDER BY (p.zone=?) DESC, (t.status='pending') DESC, (t.yes+t.no) ASC, RANDOM() LIMIT 1`)
    .get(req.user.id, ...langs, req.user.id, zone);
  if (!t) return res.json({ task: null });
  const truth = db.prepare('SELECT id, text_fr FROM prompts WHERE id=?').get(t.prompt_id);
  let others = db.prepare('SELECT id, text_fr FROM prompts WHERE zone=? AND id!=? AND active=1 ORDER BY RANDOM() LIMIT 3').all(t.zone, t.prompt_id);
  if (others.length < 3) {
    const more = db.prepare('SELECT id, text_fr FROM prompts WHERE id!=? AND active=1 ORDER BY RANDOM() LIMIT 6').all(t.prompt_id);
    for (const m of more) if (others.length < 3 && !others.some(o => o.id === m.id)) others.push(m);
  }
  const options = [truth, ...others].map(o => ({ prompt_id: o.id, text: o.text_fr })).sort(() => Math.random() - 0.5);
  res.json({ task: { translation_id: t.id, lang: t.lang, text: t.text, audio_url: t.audio_file ? `/api/audio/${t.id}` : null, options } });
}));

app.post('/api/listen/answer', auth, rate('la', 120, 60000), wrap((req, res) => {
  const b = req.body || {};
  const t = db.prepare('SELECT * FROM translations WHERE id=?').get(Number(b.translation_id));
  if (!t || t.user_id === req.user.id) return res.status(400).json({ error: 'Tâche invalide.' });
  if (db.prepare('SELECT 1 FROM votes WHERE translation_id=? AND user_id=?').get(t.id, req.user.id)) return res.status(409).json({ error: 'Déjà répondu.' });
  const correct = Number(b.chosen_prompt_id) === t.prompt_id;
  const flagged = b.flagged ? 1 : 0;
  const verdict = correct && !flagged ? 1 : 0;
  const pts = correct ? 5 : (flagged ? 2 : 1);
  tx(() => {
    db.prepare('INSERT INTO votes (translation_id, user_id, verdict, flagged) VALUES (?,?,?,?)').run(t.id, req.user.id, verdict, flagged);
    db.prepare('UPDATE users SET points = points + ?, listen_total = listen_total + 1, listen_correct = listen_correct + ? WHERE id=?').run(pts, correct ? 1 : 0, req.user.id);
    recompute(t.id);
  });
  const truth = db.prepare('SELECT text_fr FROM prompts WHERE id=?').get(t.prompt_id);
  res.json({ correct, correct_text: truth.text_fr, points_awarded: pts });
}));

app.post('/api/mission/complete', auth, wrap((req, res) => {
  const m = MISSIONS.find(x => x.id === req.body?.mission_id);
  let awarded = 0;
  if (m) {
    const r = db.prepare('INSERT INTO mission_progress (user_id, mission_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(req.user.id, m.id);
    if (r.changes) { awarded = m.reward; db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(awarded, req.user.id); }
  }
  const u = db.prepare('SELECT points FROM users WHERE id=?').get(req.user.id);
  res.json({ points_awarded: awarded, points: u.points });
}));


// ---------- co-construction : les joueurs ajoutent et confirment les lieux de leur quartier ----------
const PLACE_TYPES = ['mosque', 'church', 'school', 'market', 'health', 'pharmacy', 'fuel', 'bank', 'food', 'hotel', 'gov', 'sport', 'shop', 'junction', 'other'];
const PLACE_MIN = Number(process.env.PLACE_MIN_VOTES) || 3, PLACE_RATIO = Number(process.env.PLACE_YES_RATIO) || 0.67;
const MAPS_DIR = path.join(__dirname, '..', 'public', 'data', 'quartiers');
function latlon(q, x, z) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(MAPS_DIR, q + '.json'), 'utf8')); const [la, lo] = m.center || []; if (la == null) return null;
    const lat = la - z / 111320; return { lat: +lat.toFixed(6), lon: +(lo + x / (111320 * Math.cos(la * Math.PI / 180))).toFixed(6) };
  } catch { return null; }
}
function recomputePlace(id) {
  const p = db.prepare('SELECT * FROM places WHERE id=?').get(id); if (!p) return;
  if (p.source === 'admin') return;   // décision d'un admin : définitive
  const exist = p.yes + p.moved;
  let st = p.status;
  if (st === 'pending' || st === 'confirmed') {
    if (exist >= PLACE_MIN && exist / (exist + p.no) >= PLACE_RATIO) st = 'confirmed';
    else if (p.no >= PLACE_MIN && p.no > exist) st = 'rejected';
    else st = 'pending';
  }
  if (st !== p.status) db.prepare('UPDATE places SET status=? WHERE id=?').run(st, id);
  if (st === 'confirmed' && !p.paid && p.user_id) { db.prepare('UPDATE places SET paid=1 WHERE id=?').run(id); db.prepare('UPDATE users SET points = points + 15 WHERE id=?').run(p.user_id); }
}
const placeOut = (r, uid) => ({ id: r.id, type: r.type, name: r.name, names: JSON.parse(r.names || '{}'), x: r.x, z: r.z, status: r.status, mine: r.user_id === uid, voted: !!r.voted, yes: r.yes + r.moved, no: r.no });

app.get('/api/places', auth, wrap((req, res) => {
  const q = QUARTIERS.some(x => x.id === req.query.quartier) ? req.query.quartier : QUARTIERS[0].id;
  const rows = db.prepare(`SELECT p.*, (SELECT 1 FROM place_votes v WHERE v.place_id=p.id AND v.user_id=?) AS voted FROM places p WHERE p.quartier=? AND p.status IN ('confirmed','pending') ORDER BY p.id`).all(req.user.id, q);
  res.json({ places: rows.map(r => placeOut(r, req.user.id)), min_votes: PLACE_MIN });
}));

app.post('/api/places', auth, rate('pl', 12, 3600000), wrap((req, res) => {
  const b = req.body || {};
  const quartier = QUARTIERS.some(q => q.id === b.quartier) ? b.quartier : null;
  const type = PLACE_TYPES.includes(b.type) ? b.type : null;
  const name = clean(b.name, 60), x = Number(b.x), z = Number(b.z);
  if (!quartier || !type) return res.status(400).json({ error: 'Quartier ou type invalide.' });
  if (name.length < 2) return res.status(400).json({ error: 'Écris le nom du lieu.' });
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 148 || Math.abs(z) > 148) return res.status(400).json({ error: 'Position hors du quartier.' });
  const day = db.prepare("SELECT COUNT(*) n FROM places WHERE user_id=? AND created_at >= datetime('now','-1 day')").get(req.user.id).n;
  if (day >= 8) return res.status(429).json({ error: 'Tu as déjà proposé beaucoup de lieux aujourd\'hui. Reviens demain !' });
  const near = db.prepare("SELECT * FROM places WHERE quartier=? AND status!='rejected'").all(quartier).find(p => (norm(p.name) === norm(name) && Math.hypot(p.x - x, p.z - z) < 40) || (p.type === type && Math.hypot(p.x - x, p.z - z) < 8));
  if (near) return res.status(409).json({ error: 'Ce lieu existe déjà ici (« ' + near.name + ' »). Tu peux le confirmer en passant près de lui.' });
  const names = {}; for (const l of LANG_CODES) { const t = clean(b.names?.[l], 60); if (t) names[l] = t; }
  const r = db.prepare('INSERT INTO places (quartier, type, name, names, x, z, user_id) VALUES (?,?,?,?,?,?,?)').run(quartier, type, name, JSON.stringify(names), Math.round(x * 10) / 10, Math.round(z * 10) / 10, req.user.id);
  res.json({ id: Number(r.lastInsertRowid) });
}));

app.post('/api/places/:id/vote', auth, rate('pv', 120, 60000), wrap((req, res) => {
  const p = db.prepare("SELECT * FROM places WHERE id=? AND status IN ('pending','confirmed')").get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Lieu introuvable.' });
  const v = ['yes', 'no', 'moved'].includes(req.body?.verdict) ? req.body.verdict : null;
  if (!v) return res.status(400).json({ error: 'Vote invalide.' });
  if (p.user_id === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas voter pour ton propre lieu.' });
  if (db.prepare('SELECT 1 FROM place_votes WHERE place_id=? AND user_id=?').get(p.id, req.user.id)) return res.status(409).json({ error: 'Déjà voté.' });
  tx(() => {
    db.prepare('INSERT INTO place_votes (place_id, user_id, verdict) VALUES (?,?,?)').run(p.id, req.user.id, v);
    db.prepare(`UPDATE places SET ${v === 'yes' ? 'yes=yes+1' : v === 'no' ? 'no=no+1' : 'moved=moved+1'} WHERE id=?`).run(p.id);
    db.prepare('UPDATE users SET points = points + 3 WHERE id=?').run(req.user.id);
    recomputePlace(p.id);
  });
  const q = db.prepare('SELECT status FROM places WHERE id=?').get(p.id);
  res.json({ ok: true, points_awarded: 3, status: q.status });
}));

// ======================= ADMIN =======================
const adminTokens = new Map();
app.post('/api/admin/login', rate('adm', 10, 600000), wrap((req, res) => {
  if (!safeEq(req.body?.password ?? '', ADMIN_PASSWORD)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
  const t = crypto.randomBytes(24).toString('hex');
  adminTokens.set(t, Date.now() + 12 * 3600e3);
  res.json({ token: t });
}));
const admin = wrap((req, res, next) => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : String(req.query.t || '');
  const exp = adminTokens.get(t);
  if (!exp || exp < Date.now()) return res.status(401).json({ error: 'Admin non connecté.' });
  next();
});

app.get('/api/admin/overview', admin, wrap((req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  res.json({
    config: { min_votes: MIN_VOTES, yes_ratio: YES_RATIO },
    totals: one(`SELECT (SELECT COUNT(*) FROM users) players, (SELECT COUNT(*) FROM translations) translations,
      (SELECT COUNT(*) FROM translations WHERE status='validated') validated,
      (SELECT COUNT(*) FROM translations WHERE status='pending') pending,
      (SELECT COUNT(*) FROM translations WHERE status='rejected') rejected,
      (SELECT COUNT(*) FROM translations WHERE audio_file IS NOT NULL) voice,
      (SELECT COUNT(*) FROM votes) votes,
      (SELECT COUNT(*) FROM prompts WHERE active=1) prompts,
      (SELECT COUNT(*) FROM translations t JOIN prompts p ON p.id=t.prompt_id WHERE p.sensitive=1 AND t.status='validated' AND COALESCE(t.admin_status,'')!='approved') to_review`),
    by_lang: all(`SELECT lang, COUNT(*) total, SUM(status='validated') validated, SUM(status='pending') pending, SUM(audio_file IS NOT NULL) voice FROM translations GROUP BY lang`),
    by_zone: all(`SELECT p.zone, COUNT(*) total, SUM(t.status='validated') validated FROM translations t JOIN prompts p ON p.id=t.prompt_id GROUP BY p.zone`),
    per_day: all(`SELECT date(created_at) d, COUNT(*) n FROM translations WHERE created_at >= date('now','-13 days') GROUP BY d ORDER BY d`),
    coverage: all(`SELECT p.id, p.key, p.text_fr, p.zone, (SELECT COUNT(*) FROM translations t WHERE t.prompt_id=p.id) n FROM prompts p WHERE p.active=1 ORDER BY n ASC, p.id LIMIT 8`),
  });
}));

app.get('/api/admin/translations', admin, wrap((req, res) => {
  const w = ['1=1'], a = [];
  const q = req.query;
  if (LANG_CODES.includes(q.lang)) { w.push('t.lang=?'); a.push(q.lang); }
  if (['pending', 'validated', 'rejected'].includes(q.status)) { w.push('t.status=?'); a.push(q.status); }
  if (ZONES[q.zone]) { w.push('p.zone=?'); a.push(q.zone); }
  if (q.voice === '1') w.push('t.audio_file IS NOT NULL');
  if (q.review === '1') w.push("p.sensitive=1 AND t.status='validated' AND COALESCE(t.admin_status,'')!='approved'");
  if (q.q) { w.push('(t.text LIKE ? OR p.text_fr LIKE ? OR u.name LIKE ?)'); const s = `%${clean(q.q, 60)}%`; a.push(s, s, s); }
  const limit = Math.min(Number(q.limit) || 50, 200), offset = Math.max(Number(q.offset) || 0, 0);
  const base = `FROM translations t JOIN prompts p ON p.id=t.prompt_id LEFT JOIN users u ON u.id=t.user_id WHERE ${w.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) n ${base}`).get(...a).n;
  const rows = db.prepare(`SELECT t.id, t.lang, t.text, t.status, t.yes, t.no, t.admin_status, t.admin_note, t.source, t.created_at,
      t.audio_file IS NOT NULL AS has_audio, p.key AS prompt_key, p.text_fr, p.zone, p.sensitive, p.verify, u.name AS user_name, u.quartier
    ${base} ORDER BY t.id DESC LIMIT ? OFFSET ?`).all(...a, limit, offset);
  res.json({ total, rows });
}));

app.patch('/api/admin/translations/:id', admin, wrap((req, res) => {
  const id = Number(req.params.id);
  const t = db.prepare('SELECT * FROM translations WHERE id=?').get(id);
  if (!t) return res.status(404).json({ error: 'Introuvable.' });
  const b = req.body || {};
  if (typeof b.text === 'string') {
    const text = clean(b.text, 500);
    if (text.length < 2) return res.status(400).json({ error: 'Texte trop court.' });
    db.prepare("UPDATE translations SET text=?, updated_at=datetime('now') WHERE id=?").run(text, id);
  }
  if (b.admin_status !== undefined) {
    if (![null, '', 'approved', 'rejected'].includes(b.admin_status)) return res.status(400).json({ error: 'Statut invalide.' });
    db.prepare("UPDATE translations SET admin_status=?, reviewed_at=datetime('now') WHERE id=?").run(b.admin_status || null, id);
  }
  if (typeof b.admin_note === 'string') db.prepare('UPDATE translations SET admin_note=? WHERE id=?').run(clean(b.admin_note, 300), id);
  res.json(recompute(id));
}));

app.delete('/api/admin/translations/:id', admin, wrap((req, res) => {
  const t = db.prepare('SELECT audio_file FROM translations WHERE id=?').get(Number(req.params.id));
  if (t?.audio_file) fs.rm(path.join(AUDIO_DIR, path.basename(t.audio_file)), () => {});
  db.prepare('DELETE FROM translations WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
}));

app.post('/api/admin/translations', admin, wrap((req, res) => {
  const b = req.body || {};
  const p = db.prepare('SELECT * FROM prompts WHERE key=?').get(String(b.prompt_key || ''));
  if (!p || !LANG_CODES.includes(b.lang)) return res.status(400).json({ error: 'Phrase ou langue invalide.' });
  const text = clean(b.text, 500);
  if (text.length < 2) return res.status(400).json({ error: 'Texte trop court.' });
  const r = db.prepare("INSERT INTO translations (prompt_id, user_id, lang, text, source, admin_status, reviewed_at) VALUES (?,NULL,?,?, 'admin','approved', datetime('now'))").run(p.id, b.lang, text);
  recompute(Number(r.lastInsertRowid));
  res.json({ id: Number(r.lastInsertRowid) });
}));

app.get('/api/admin/audio/:id', admin, wrap((req, res) => {
  const t = db.prepare('SELECT audio_file FROM translations WHERE id=?').get(Number(req.params.id));
  if (!t?.audio_file) return res.status(404).end();
  res.sendFile(path.join(AUDIO_DIR, path.basename(t.audio_file)));
}));

app.get('/api/admin/prompts', admin, wrap((req, res) => {
  res.json(db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM translations t WHERE t.prompt_id=p.id) AS n,
    (SELECT COUNT(*) FROM translations t WHERE t.prompt_id=p.id AND t.status='validated') AS validated FROM prompts p ORDER BY p.id`).all());
}));
app.post('/api/admin/prompts', admin, wrap((req, res) => {
  const b = req.body || {};
  const text = clean(b.text_fr, 300);
  if (!ZONES[b.zone] || text.length < 4) return res.status(400).json({ error: 'Zone ou texte invalide.' });
  const key = `x.${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const r = db.prepare('INSERT INTO prompts (key, zone, mission_id, text_fr, sensitive, verify, news, level) VALUES (?,?,?,?,?,?,?,1)')
    .run(key, b.zone, b.news ? 'flash' : 'custom', text, b.sensitive ? 1 : 0, b.verify ? 1 : 0, b.news ? 1 : 0);
  res.json({ id: Number(r.lastInsertRowid), key });
}));
app.patch('/api/admin/prompts/:id', admin, wrap((req, res) => {
  const b = req.body || {};
  const id = Number(req.params.id);
  if (typeof b.active === 'boolean') db.prepare('UPDATE prompts SET active=? WHERE id=?').run(b.active ? 1 : 0, id);
  if (typeof b.sensitive === 'boolean') db.prepare('UPDATE prompts SET sensitive=? WHERE id=?').run(b.sensitive ? 1 : 0, id);
  if (typeof b.verify === 'boolean') db.prepare('UPDATE prompts SET verify=? WHERE id=?').run(b.verify ? 1 : 0, id);
  res.json({ ok: true });
}));

app.get('/api/admin/players', admin, wrap((req, res) => {
  res.json(db.prepare(`SELECT u.id, u.name, u.phone, u.langs, u.quartier, u.points, u.listen_total, u.listen_correct, u.created_at, u.last_seen,
    (SELECT COUNT(*) FROM translations t WHERE t.user_id=u.id) AS translations,
    (SELECT COUNT(*) FROM translations t WHERE t.user_id=u.id AND t.status='validated') AS validated
    FROM users u ORDER BY u.points DESC LIMIT 500`).all());
}));


// lieux (co-construction)
app.get('/api/admin/places', admin, wrap((req, res) => {
  const w = ['1=1'], a = []; if (req.query.status) { w.push('p.status=?'); a.push(String(req.query.status)); } if (req.query.quartier) { w.push('p.quartier=?'); a.push(String(req.query.quartier)); }
  const rows = db.prepare(`SELECT p.*, u.name AS user_name FROM places p LEFT JOIN users u ON u.id=p.user_id WHERE ${w.join(' AND ')} ORDER BY p.id DESC LIMIT 500`).all(...a);
  res.json(rows.map(r => ({ ...r, names: JSON.parse(r.names || '{}'), ...(latlon(r.quartier, r.x, r.z) || {}) })));
}));
app.post('/api/admin/places', admin, wrap((req, res) => {
  const b = req.body || {};
  if (!QUARTIERS.some(q => q.id === b.quartier) || !PLACE_TYPES.includes(b.type) || clean(b.name, 60).length < 2 || !Number.isFinite(Number(b.x)) || !Number.isFinite(Number(b.z))) return res.status(400).json({ error: 'Champs invalides.' });
  const names = {}; for (const l of LANG_CODES) { const t = clean(b.names?.[l], 60); if (t) names[l] = t; }
  const r = db.prepare("INSERT INTO places (quartier, type, name, names, x, z, status, source) VALUES (?,?,?,?,?,?, 'confirmed', 'admin')").run(b.quartier, b.type, clean(b.name, 60), JSON.stringify(names), Number(b.x), Number(b.z));
  res.json({ id: Number(r.lastInsertRowid) });
}));
app.patch('/api/admin/places/:id', admin, wrap((req, res) => {
  const id = Number(req.params.id), b = req.body || {}, p = db.prepare('SELECT * FROM places WHERE id=?').get(id);
  if (!p) return res.status(404).json({ error: 'Introuvable.' });
  if (['pending', 'confirmed', 'rejected'].includes(b.status)) {
    db.prepare('UPDATE places SET status=?, source=? WHERE id=?').run(b.status, b.status === 'pending' ? p.source : 'admin', id);
    if (b.status === 'confirmed' && !p.paid && p.user_id) { db.prepare('UPDATE places SET paid=1 WHERE id=?').run(id); db.prepare('UPDATE users SET points = points + 15 WHERE id=?').run(p.user_id); }
  }
  if (typeof b.name === 'string' && clean(b.name, 60).length >= 2) db.prepare('UPDATE places SET name=? WHERE id=?').run(clean(b.name, 60), id);
  if (PLACE_TYPES.includes(b.type)) db.prepare('UPDATE places SET type=? WHERE id=?').run(b.type, id);
  if (Number.isFinite(Number(b.x)) && Number.isFinite(Number(b.z)) && b.x !== undefined) db.prepare('UPDATE places SET x=?, z=? WHERE id=?').run(Number(b.x), Number(b.z), id);
  res.json({ ok: true });
}));
app.delete('/api/admin/places/:id', admin, wrap((req, res) => { db.prepare('DELETE FROM places WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); }));

// clés d'API
app.get('/api/admin/keys', admin, wrap((req, res) => res.json(db.prepare('SELECT id, prefix, label, active, calls, created_at, last_used FROM api_keys ORDER BY id DESC').all())));
app.post('/api/admin/keys', admin, wrap((req, res) => {
  const label = clean(req.body?.label, 60) || 'sans nom';
  const key = 'kan_' + crypto.randomBytes(20).toString('hex');
  db.prepare('INSERT INTO api_keys (key_hash, prefix, label) VALUES (?,?,?)').run(sha256(key), key.slice(0, 10), label);
  res.json({ key, note: 'Copie cette clé maintenant : elle ne sera plus affichée.' });
}));
app.delete('/api/admin/keys/:id', admin, wrap((req, res) => {
  db.prepare('UPDATE api_keys SET active=0 WHERE id=?').run(Number(req.params.id)); res.json({ ok: true });
}));

// export
function exportRows({ lang, scope }) {
  const w = [scope === 'all' ? '1=1' : ELIGIBLE_SQL], a = [];
  if (LANG_CODES.includes(lang)) { w.push('t.lang=?'); a.push(lang); }
  return db.prepare(`SELECT t.id, p.text_fr AS source_text, t.lang AS target_lang, t.text AS target_text, t.status, t.yes, t.no,
      t.audio_file IS NOT NULL AS has_audio, p.zone, p.sensitive, t.created_at
    FROM translations t JOIN prompts p ON p.id=t.prompt_id WHERE ${w.join(' AND ')} ORDER BY t.id`).all(...a);
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function sendExport(res, rows, format, name) {
  if (format === 'csv') {
    const cols = rows.length ? Object.keys(rows[0]) : ['id'];
    const body = '﻿' + cols.join(',') + '\n' + rows.map(r => cols.map(c => csvCell(r[c])).join(',')).join('\n');
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` });
    return res.send(body);
  }
  if (format === 'json') { res.set('Content-Disposition', `attachment; filename="${name}.json"`); return res.json(rows); }
  res.set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.jsonl"` });
  res.send(rows.map(r => JSON.stringify({ ...r, source_lang: 'fr' })).join('\n'));
}
app.get('/api/admin/export', admin, wrap((req, res) => {
  sendExport(res, exportRows({ lang: req.query.lang, scope: req.query.scope === 'all' ? 'all' : 'eligible' }), req.query.format, `kan-export-${new Date().toISOString().slice(0, 10)}`);
}));

// ======================= API DE LANGUE v1 (clé requise) =======================
const v1 = express.Router();
v1.use((req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'x-api-key'); next(); });
v1.use(wrap((req, res, next) => {
  const key = String(req.headers['x-api-key'] || req.query.api_key || '');
  const k = key && db.prepare('SELECT id FROM api_keys WHERE key_hash=? AND active=1').get(sha256(key));
  if (!k) return res.status(401).json({ error: 'Clé API manquante ou invalide (en-tête X-API-Key).' });
  db.prepare("UPDATE api_keys SET calls=calls+1, last_used=datetime('now') WHERE id=?").run(k.id);
  next();
}));
v1.use(rate('v1', 120, 60000));

v1.get('/languages', wrap((req, res) => {
  const rows = db.prepare(`SELECT t.lang, COUNT(*) total, SUM(CASE WHEN ${ELIGIBLE_SQL} THEN 1 ELSE 0 END) validated,
    SUM(CASE WHEN ${ELIGIBLE_SQL} AND t.audio_file IS NOT NULL THEN 1 ELSE 0 END) validated_with_audio
    FROM translations t JOIN prompts p ON p.id=t.prompt_id GROUP BY t.lang`).all();
  res.json(LANGUAGES.map(l => ({ ...l, source_lang: 'fr', ...(rows.find(r => r.lang === l.code) || { total: 0, validated: 0, validated_with_audio: 0 }) })));
}));

v1.get('/pairs', wrap((req, res) => {
  const w = [ELIGIBLE_SQL], a = [];
  if (LANG_CODES.includes(req.query.target)) { w.push('t.lang=?'); a.push(req.query.target); }
  if (ZONES[req.query.zone]) { w.push('p.zone=?'); a.push(req.query.zone); }
  if (req.query.audio === '1') w.push('t.audio_file IS NOT NULL');
  const cursor = Number(req.query.cursor) || 0;
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const rows = db.prepare(`SELECT t.id, p.text_fr, t.lang, t.text, t.yes, t.no, t.audio_file IS NOT NULL AS has_audio, p.zone, t.created_at
    FROM translations t JOIN prompts p ON p.id=t.prompt_id WHERE ${w.join(' AND ')} AND t.id > ? ORDER BY t.id LIMIT ?`).all(...a, cursor, limit);
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    data: rows.map(r => ({ id: r.id, source_lang: 'fr', source_text: r.text_fr, target_lang: r.lang, target_text: r.text,
      votes: { yes: r.yes, no: r.no }, zone: r.zone, created_at: r.created_at,
      audio_url: r.has_audio ? `${origin}/api/v1/audio/${r.id}` : null })),
    next_cursor: rows.length === limit ? rows[rows.length - 1].id : null,
  });
}));

const bigrams = s => { const t = ` ${s} `; const m = new Map(); for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
function dice(a, b) { let inter = 0, na = 0, nb = 0; for (const v of a.values()) na += v; for (const v of b.values()) nb += v; for (const [g, v] of a) if (b.has(g)) inter += Math.min(v, b.get(g)); return na + nb ? (2 * inter) / (na + nb) : 0; }

// Mémoire de traduction : exact puis approchant. source=fr&target=moore  OU  source=moore&target=fr
v1.get('/translate', wrap((req, res) => {
  const text = clean(req.query.text, 300);
  const source = String(req.query.source || 'fr'), target = String(req.query.target || '');
  if (!text) return res.status(400).json({ error: 'Paramètre text manquant.' });
  const toFr = source !== 'fr';
  const lang = toFr ? source : target;
  if (!LANG_CODES.includes(lang)) return res.status(400).json({ error: `Langue inconnue. Utilise : ${LANG_CODES.join(', ')} (et fr).` });
  const rows = db.prepare(`SELECT t.id, p.text_fr, t.text, t.yes, t.no FROM translations t JOIN prompts p ON p.id=t.prompt_id WHERE ${ELIGIBLE_SQL} AND t.lang=? AND t.text != ''`).all(lang);
  const q = norm(text), qg = bigrams(q);
  const scored = rows.map(r => {
    const ref = norm(toFr ? r.text : r.text_fr);
    return { r, score: ref === q ? 1 : dice(qg, bigrams(ref)) };
  }).filter(x => x.score >= 0.55).sort((x, y) => y.score - x.score || (y.r.yes - x.r.yes)).slice(0, 5);
  res.json({
    query: text, source_lang: toFr ? source : 'fr', target_lang: toFr ? 'fr' : target,
    matches: scored.map(x => ({ translation: toFr ? x.r.text_fr : x.r.text, matched_source: toFr ? x.r.text : x.r.text_fr, score: Math.round(x.score * 100) / 100, exact: x.score === 1, translation_id: x.r.id })),
  });
}));

v1.get('/audio/:id', wrap((req, res) => {
  const t = db.prepare(`SELECT t.audio_file FROM translations t JOIN prompts p ON p.id=t.prompt_id WHERE t.id=? AND ${ELIGIBLE_SQL}`).get(Number(req.params.id));
  if (!t?.audio_file) return res.status(404).json({ error: 'Audio introuvable.' });
  res.sendFile(path.join(AUDIO_DIR, path.basename(t.audio_file)));
}));

v1.get('/export', wrap((req, res) => {
  sendExport(res, exportRows({ lang: req.query.lang, scope: 'eligible' }), req.query.format, 'kan-dataset');
}));
v1.get('/stats', wrap((req, res) => {
  res.json(db.prepare(`SELECT COUNT(*) pairs_total, SUM(CASE WHEN ${ELIGIBLE_SQL} THEN 1 ELSE 0 END) pairs_validated
    FROM translations t JOIN prompts p ON p.id=t.prompt_id`).get());
}));
app.use('/api/v1', v1);

// ---------- assistant maternité (2e interface de Kan) ----------
registerMaternite(app, { admin, wrap, rate });
registerAssistant(app, { wrap, rate });

// ---------- statique ----------
app.use('/vendor', express.static(path.join(__dirname, '..', 'public', 'vendor'), { maxAge: '7d', immutable: true }));
app.get(['/sw.js', '/manifest.webmanifest'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  if (req.path === '/sw.js') res.set('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, '..', 'public', req.path));
});
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: '5m' }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html')));
app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue.' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Erreur serveur.' }); });

// Importe les vraies cartes OpenStreetMap manquantes (une fois, en arrière-plan). Désactiver : AUTO_IMPORT_MAPS=0
function autoImportMaps() {
  if (process.env.AUTO_IMPORT_MAPS === '0') return;
  const dir = path.join(__dirname, '..', 'public', 'data', 'quartiers');
  const missing = QUARTIERS.filter(q => !fs.existsSync(path.join(dir, q.id + '.json'))).map(q => q.id);
  if (!missing.length) return;
  console.log('Cartes réelles manquantes, import OpenStreetMap en cours :', missing.join(', '));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'import-osm.mjs'), ...missing], { stdio: 'inherit' });
  child.on('error', e => console.error('Import des cartes impossible :', e.message));
}

export { app, seedPrompts };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Kan prêt sur http://localhost:${PORT}  (admin : /admin)`));
  autoImportMaps();
  startMaterniteScheduler();
}
