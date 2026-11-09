// Assistant maternité : la deuxième interface de Kan (usage réel, à côté du jeu de collecte).
//
// Un agent de santé à base communautaire (ASBC) inscrit une femme enceinte (et, avec son accord,
// son partenaire). Chaque jour, l'assistant envoie à chacun le bon message au bon moment, dans sa
// langue : la version mooré / dioula vient des traductions validées par les joueurs du jeu
// (mission « Ma grossesse, mon couple »), avec repli en français. Si l'ASBC signale un signe de
// danger, le centre de santé et le partenaire sont alertés.
//
// ⚠ Contenu de santé : tous les messages sont à faire relire par un professionnel de santé.
// ⚠ Données de santé : ne jamais exposer ces tables dans l'API publique /api/v1.
import crypto from 'node:crypto';
import path from 'node:path';
import { db, tx, ELIGIBLE_SQL, AUDIO_DIR } from './db.js';
import { MATERNITE_CORES, maternitePromptKey } from './content.js';

export const DAY_MS = 86400000;
export const MAX_WEEKS = 42;
/** Contacts prénatals recommandés par l'OMS (semaines d'aménorrhée). */
export const CPN_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];
export const MAT_LANGS = ['fr', 'moore', 'dioula'];
export const DANGER_SIGNS = [
  'Saignement',
  'Forte fièvre',
  'Maux de tête sévères',
  'Fortes douleurs au ventre',
  'Bébé qui ne bouge plus',
  'Convulsions',
];

db.exec(`
CREATE TABLE IF NOT EXISTS mat_asbc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  token_hash TEXT UNIQUE,
  csps_name TEXT NOT NULL DEFAULT '',
  csps_phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mat_pregnancies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asbc_id INTEGER NOT NULL REFERENCES mat_asbc(id),
  mother_name TEXT NOT NULL,
  mother_phone TEXT NOT NULL,
  mother_lang TEXT NOT NULL DEFAULT 'fr',
  partner_name TEXT,
  partner_phone TEXT,
  partner_lang TEXT NOT NULL DEFAULT 'fr',
  partner_consent INTEGER NOT NULL DEFAULT 0,
  lmp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_matpreg_asbc ON mat_pregnancies(asbc_id, status);
CREATE TABLE IF NOT EXISTS mat_appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pregnancy_id INTEGER NOT NULL REFERENCES mat_pregnancies(id) ON DELETE CASCADE,
  cpn INTEGER NOT NULL,
  week INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'programme',
  UNIQUE(pregnancy_id, cpn)
);
CREATE TABLE IF NOT EXISTS mat_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pregnancy_id INTEGER NOT NULL REFERENCES mat_pregnancies(id) ON DELETE CASCADE,
  asbc_id INTEGER NOT NULL REFERENCES mat_asbc(id),
  sign TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mat_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pregnancy_id INTEGER NOT NULL REFERENCES mat_pregnancies(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  UNIQUE(pregnancy_id, recipient, template)
);
CREATE TABLE IF NOT EXISTS mat_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

// ---------- utilitaires ----------
const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const DEFAULT_CC = process.env.DEFAULT_COUNTRY_CODE || '226';

/** Numéro au format international sans « + » (ex. 22671331523), ou null si invalide. */
export function normalizePhone(raw) {
  const s = String(raw ?? '').trim();
  let d = s.replace(/\D/g, '');
  if (s.startsWith('+')) { /* déjà international */ }
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.length === 8) d = DEFAULT_CC + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

const isoDay = d => d.toISOString().slice(0, 10);
const parseDay = s => new Date(`${s}T00:00:00Z`);
const validDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(parseDay(s).getTime());
const frDate = iso => iso.split('-').reverse().join('/');

/** Semaines d'aménorrhée révolues à la date `asOf` (date « YYYY-MM-DD » ou Date). */
export function weeksOfAmenorrhea(lmp, asOf = new Date()) {
  const ref = typeof asOf === 'string' ? parseDay(asOf) : parseDay(isoDay(asOf));
  return Math.floor((ref.getTime() - parseDay(lmp).getTime()) / DAY_MS / 7);
}

export function dueDateForWeek(lmp, week) {
  return isoDay(new Date(parseDay(lmp).getTime() + week * 7 * DAY_MS));
}

function hashPin(pin, salt) { return crypto.scryptSync(String(pin), salt, 32).toString('hex'); }

// ---------- messages ----------
/**
 * Calendrier des messages. Un message part quand la grossesse atteint `week` (et jusqu'à une
 * semaine plus tard : une femme inscrite tard ne reçoit pas les rappels déjà passés).
 */
export const SCHEDULE = [
  { template: 'danger', week: 14, cores: { mere: 'danger_mere', partenaire: 'danger_partenaire' } },
  { template: 'move', week: 21, cores: { mere: 'move_mere' } },
  { template: 'term', week: 33, cores: { mere: 'term_mere', partenaire: 'term_partenaire' } },
  ...CPN_WEEKS.map((w, i) => ({
    template: `cpn${i + 1}`, week: w - 1, cpn: i + 1, cpnWeek: w,
    cores: { mere: 'cpn_mere', partenaire: 'cpn_partenaire' },
  })),
];

/** Texte de base dans la langue demandée : traduction validée et approuvée, sinon français. */
export function coreText(coreId, lang) {
  const core = MATERNITE_CORES.find(c => c.id === coreId);
  if (!core) throw new Error(`Message inconnu : ${coreId}`);
  if (lang && lang !== 'fr') {
    const key = maternitePromptKey(coreId);
    const row = db.prepare(`SELECT t.text FROM translations t JOIN prompts p ON p.id=t.prompt_id
      WHERE p.key=? AND t.lang=? AND ${ELIGIBLE_SQL} AND t.text != ''
      ORDER BY (t.yes - t.no) DESC, t.id ASC LIMIT 1`).get(key, lang);
    if (row) return { text: row.text, lang };
  }
  return { text: core.fr, lang: 'fr' };
}

function composeText(pregnancy, recipient, coreId, { suffix = '' } = {}) {
  const lang = recipient === 'mere' ? pregnancy.mother_lang : pregnancy.partner_lang;
  const who = recipient === 'mere' ? pregnancy.mother_name : (pregnancy.partner_name || '');
  const core = coreText(coreId, lang);
  const mother = recipient === 'mere' ? '' : ` (${pregnancy.mother_name})`;
  return { text: `${who}${mother} : ${core.text}${suffix}`.trim(), lang: core.lang };
}

function recipientsOf(pregnancy, wanted) {
  const out = [];
  if (wanted.includes('mere')) out.push({ recipient: 'mere', phone: pregnancy.mother_phone });
  if (wanted.includes('partenaire') && pregnancy.partner_consent && pregnancy.partner_phone) {
    out.push({ recipient: 'partenaire', phone: pregnancy.partner_phone });
  }
  return out;
}

// ---------- envoi ----------
const PROVIDER = () => (process.env.SMS_PROVIDER || 'log').toLowerCase();

async function sendSms(phone, text) {
  const provider = PROVIDER();
  if (provider === 'brevo') {
    const key = process.env.BREVO_API_KEY;
    if (!key) throw new Error('BREVO_API_KEY manquante.');
    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: process.env.SMS_SENDER || 'KAN', recipient: phone, content: text, type: 'transactional' }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status} : ${(await res.text()).slice(0, 200)}`);
    return 'brevo';
  }
  return 'log';
}

/** Enregistre un message (une seule fois par grossesse / destinataire / modèle) puis l'envoie. */
async function queueAndSend({ pregnancyId, recipient, template, phone, lang, text }) {
  const r = db.prepare(`INSERT INTO mat_outbox (pregnancy_id, recipient, template, to_phone, lang, text)
    VALUES (?,?,?,?,?,?) ON CONFLICT(pregnancy_id, recipient, template) DO NOTHING`)
    .run(pregnancyId, recipient, template, phone, lang, text);
  if (!r.changes) return null;
  const id = Number(r.lastInsertRowid);
  try {
    const provider = await sendSms(phone, text);
    db.prepare("UPDATE mat_outbox SET status=?, provider=?, sent_at=datetime('now') WHERE id=?")
      .run(provider === 'log' ? 'simulated' : 'sent', provider, id);
  } catch (e) {
    db.prepare("UPDATE mat_outbox SET status='failed', error=? WHERE id=?").run(String(e.message).slice(0, 300), id);
  }
  return id;
}

// ---------- inscription ----------
export function validateEnrollment(b, now = new Date()) {
  const errors = [];
  const mother_name = clean(b.mother_name, 80);
  const mother_phone = normalizePhone(b.mother_phone);
  const lmp = String(b.lmp || '');
  if (mother_name.length < 2) errors.push('Nom de la femme requis.');
  if (!mother_phone) errors.push('Numéro de la femme invalide.');
  if (!b.mother_consent) errors.push('Le consentement de la femme est obligatoire.');
  if (!validDay(lmp)) errors.push('Date des dernières règles invalide.');
  else {
    const w = weeksOfAmenorrhea(lmp, now);
    if (w < 0) errors.push('La date des dernières règles est dans le futur.');
    else if (w > MAX_WEEKS) errors.push('Grossesse de plus de 42 semaines : vérifier la date.');
  }
  const wantsPartner = !!clean(b.partner_phone, 30);
  const partner_phone = wantsPartner ? normalizePhone(b.partner_phone) : null;
  if (wantsPartner && !partner_phone) errors.push('Numéro du partenaire invalide.');
  if (wantsPartner && !b.partner_consent) errors.push('Cocher l\'accord de la femme pour contacter son partenaire.');
  const mother_lang = MAT_LANGS.includes(b.mother_lang) ? b.mother_lang : 'fr';
  const partner_lang = MAT_LANGS.includes(b.partner_lang) ? b.partner_lang : mother_lang;
  return {
    errors,
    value: {
      mother_name, mother_phone, mother_lang, lmp,
      partner_name: wantsPartner ? clean(b.partner_name, 80) : null,
      partner_phone, partner_lang,
      partner_consent: wantsPartner && b.partner_consent ? 1 : 0,
    },
  };
}

export async function enroll(asbcId, body, now = new Date()) {
  const { errors, value: v } = validateEnrollment(body, now);
  if (errors.length) return { errors };
  const week = weeksOfAmenorrhea(v.lmp, now);
  const id = tx(() => {
    const r = db.prepare(`INSERT INTO mat_pregnancies
      (asbc_id, mother_name, mother_phone, mother_lang, partner_name, partner_phone, partner_lang, partner_consent, lmp)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(asbcId, v.mother_name, v.mother_phone, v.mother_lang, v.partner_name, v.partner_phone, v.partner_lang, v.partner_consent, v.lmp);
    const pid = Number(r.lastInsertRowid);
    const ins = db.prepare('INSERT INTO mat_appointments (pregnancy_id, cpn, week, due_date) VALUES (?,?,?,?)');
    CPN_WEEKS.forEach((w, i) => { if (w >= week) ins.run(pid, i + 1, w, dueDateForWeek(v.lmp, w)); });
    return pid;
  });
  const p = getPregnancy(id);
  for (const r of recipientsOf(p, ['mere', 'partenaire'])) {
    const m = composeText(p, r.recipient, r.recipient === 'mere' ? 'welcome_mere' : 'welcome_partenaire');
    await queueAndSend({ pregnancyId: id, recipient: r.recipient, template: 'welcome', phone: r.phone, lang: m.lang, text: m.text });
  }
  return { id, week };
}

export function getPregnancy(id) { return db.prepare('SELECT * FROM mat_pregnancies WHERE id=?').get(id); }

// ---------- envoi quotidien ----------
/**
 * Envoie les messages dus à la date `asOf`. `dryRun` liste ce qui partirait sans rien enregistrer.
 * `asOf` permet de simuler un « bond dans le temps » pour une démonstration.
 */
export async function runDaily({ asOf = new Date(), dryRun = false } = {}) {
  const day = typeof asOf === 'string' ? asOf : isoDay(asOf);
  const result = { asOf: day, dryRun, sent: 0, skipped: 0, items: [] };
  const pregs = db.prepare("SELECT * FROM mat_pregnancies WHERE status='active'").all();
  for (const p of pregs) {
    const w = weeksOfAmenorrhea(p.lmp, day);
    if (w > MAX_WEEKS) { if (!dryRun) db.prepare("UPDATE mat_pregnancies SET status='closed' WHERE id=?").run(p.id); continue; }
    if (w < 0) continue;
    for (const step of SCHEDULE) {
      if (w < step.week || w > step.week + 1) continue;
      let suffix = '';
      if (step.cpn) {
        const appt = db.prepare('SELECT * FROM mat_appointments WHERE pregnancy_id=? AND cpn=?').get(p.id, step.cpn);
        if (!appt || appt.status !== 'programme') continue;
        suffix = ` [CPN ${step.cpn}, vers le ${frDate(appt.due_date)}]`;
      }
      for (const r of recipientsOf(p, Object.keys(step.cores))) {
        const m = composeText(p, r.recipient, step.cores[r.recipient], { suffix });
        const already = db.prepare('SELECT 1 FROM mat_outbox WHERE pregnancy_id=? AND recipient=? AND template=?')
          .get(p.id, r.recipient, step.template);
        if (already) { result.skipped++; continue; }
        result.items.push({ pregnancy: p.id, recipient: r.recipient, template: step.template, lang: m.lang, text: m.text });
        if (!dryRun) {
          await queueAndSend({ pregnancyId: p.id, recipient: r.recipient, template: step.template, phone: r.phone, lang: m.lang, text: m.text });
          result.sent++;
        }
      }
    }
  }
  if (!dryRun) db.prepare("INSERT INTO mat_meta (key,value) VALUES ('last_run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(day);
  return result;
}

/** Lance l'envoi une fois par jour (après 07:00 UTC). À appeler au démarrage du serveur. */
export function startScheduler() {
  if (process.env.MATERNITE_SCHEDULER === '0') return;
  const tick = () => {
    const now = new Date();
    const last = db.prepare("SELECT value FROM mat_meta WHERE key='last_run'").get()?.value;
    if (now.getUTCHours() >= 7 && last !== isoDay(now)) {
      runDaily({ asOf: now }).then(r => console.log(`Assistant maternité : ${r.sent} message(s) envoyé(s).`))
        .catch(e => console.error('Assistant maternité :', e.message));
    }
  };
  setInterval(tick, 30 * 60 * 1000).unref();
  setTimeout(tick, 15000).unref();
}

// ---------- alerte signe de danger ----------
export async function raiseAlert(asbcId, pregnancyId, sign, now = new Date()) {
  const asbc = db.prepare('SELECT * FROM mat_asbc WHERE id=?').get(asbcId);
  const p = db.prepare('SELECT * FROM mat_pregnancies WHERE id=? AND asbc_id=?').get(pregnancyId, asbcId);
  if (!p) return { error: 'Dossier introuvable.' };
  if (!DANGER_SIGNS.includes(sign)) return { error: 'Signe de danger inconnu.' };
  const alertId = Number(db.prepare('INSERT INTO mat_alerts (pregnancy_id, asbc_id, sign) VALUES (?,?,?)').run(p.id, asbcId, sign).lastInsertRowid);
  const template = `alert${alertId}`;
  const sa = weeksOfAmenorrhea(p.lmp, now);
  const sent = [];
  if (asbc.csps_phone) {
    const text = `ALERTE : l'agent de santé ${asbc.name} réfère ${p.mother_name} (${sign}, ${sa} SA) au ${asbc.csps_name || 'centre de santé'}. Arrivée imminente.`;
    await queueAndSend({ pregnancyId: p.id, recipient: 'csps', template, phone: asbc.csps_phone, lang: 'fr', text });
    sent.push('csps');
  }
  for (const r of recipientsOf(p, ['partenaire'])) {
    const m = composeText(p, 'partenaire', 'alert_partenaire');
    await queueAndSend({ pregnancyId: p.id, recipient: 'partenaire', template, phone: r.phone, lang: m.lang, text: m.text });
    sent.push('partenaire');
  }
  return { alertId, notified: sent };
}

// ---------- routes ----------
export function registerMaternite(app, { admin, wrap, rate }) {
  const auth = wrap((req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    const a = token && db.prepare('SELECT * FROM mat_asbc WHERE token_hash=? AND active=1').get(sha256(token));
    if (!a) return res.status(401).json({ error: 'Non connecté.' });
    req.asbc = a;
    next();
  });

  app.post('/api/maternite/login', rate('matlogin', 10, 600000), wrap((req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const a = phone && db.prepare('SELECT * FROM mat_asbc WHERE phone=? AND active=1').get(phone);
    const ok = a && crypto.timingSafeEqual(Buffer.from(hashPin(req.body?.pin ?? '', a.pin_salt)), Buffer.from(a.pin_hash));
    if (!ok) return res.status(401).json({ error: 'Numéro ou code incorrect.' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('UPDATE mat_asbc SET token_hash=? WHERE id=?').run(sha256(token), a.id);
    res.json({ token, name: a.name, csps_name: a.csps_name });
  }));

  app.get('/api/maternite/signs', auth, (req, res) => res.json({ signs: DANGER_SIGNS, langs: MAT_LANGS }));

  app.get('/api/maternite/pregnancies', auth, wrap((req, res) => {
    const rows = db.prepare("SELECT * FROM mat_pregnancies WHERE asbc_id=? AND status='active' ORDER BY id DESC").all(req.asbc.id);
    res.json(rows.map(p => {
      const next = db.prepare("SELECT cpn, due_date, status FROM mat_appointments WHERE pregnancy_id=? AND status='programme' ORDER BY cpn LIMIT 1").get(p.id);
      return {
        id: p.id, mother_name: p.mother_name, mother_phone: p.mother_phone, mother_lang: p.mother_lang,
        partner_name: p.partner_name, partner_consent: !!p.partner_consent,
        lmp: p.lmp, weeks: weeksOfAmenorrhea(p.lmp), next_cpn: next || null,
      };
    }));
  }));

  app.post('/api/maternite/pregnancies', auth, rate('matenroll', 60, 3600000), wrap(async (req, res) => {
    const r = await enroll(req.asbc.id, req.body || {});
    if (r.errors) return res.status(400).json({ error: r.errors.join(' ') });
    res.json(r);
  }));

  app.get('/api/maternite/pregnancies/:id', auth, wrap((req, res) => {
    const p = db.prepare('SELECT * FROM mat_pregnancies WHERE id=? AND asbc_id=?').get(Number(req.params.id), req.asbc.id);
    if (!p) return res.status(404).json({ error: 'Dossier introuvable.' });
    res.json({
      ...p, partner_consent: !!p.partner_consent, weeks: weeksOfAmenorrhea(p.lmp),
      appointments: db.prepare('SELECT id, cpn, week, due_date, status FROM mat_appointments WHERE pregnancy_id=? ORDER BY cpn').all(p.id),
      messages: db.prepare('SELECT recipient, template, lang, text, status, created_at FROM mat_outbox WHERE pregnancy_id=? ORDER BY id DESC LIMIT 20').all(p.id),
    });
  }));

  app.post('/api/maternite/appointments/:id', auth, wrap((req, res) => {
    const status = req.body?.status;
    if (!['honore', 'rate', 'programme'].includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
    const r = db.prepare(`UPDATE mat_appointments SET status=? WHERE id=? AND pregnancy_id IN
      (SELECT id FROM mat_pregnancies WHERE asbc_id=?)`).run(status, Number(req.params.id), req.asbc.id);
    if (!r.changes) return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    res.json({ ok: true });
  }));

  app.post('/api/maternite/pregnancies/:id/alert', auth, rate('matalert', 30, 3600000), wrap(async (req, res) => {
    const r = await raiseAlert(req.asbc.id, Number(req.params.id), String(req.body?.sign || ''));
    if (r.error) return res.status(400).json({ error: r.error });
    res.json(r);
  }));

  // ----- administration -----
  app.get('/api/admin/maternite/overview', admin, wrap((req, res) => {
    res.json({
      provider: PROVIDER(),
      last_run: db.prepare("SELECT value FROM mat_meta WHERE key='last_run'").get()?.value || null,
      asbc: db.prepare(`SELECT a.id, a.name, a.phone, a.csps_name, a.csps_phone, a.active,
        (SELECT COUNT(*) FROM mat_pregnancies p WHERE p.asbc_id=a.id AND p.status='active') AS pregnancies
        FROM mat_asbc a ORDER BY a.id DESC`).all(),
      pregnancies: db.prepare("SELECT COUNT(*) n FROM mat_pregnancies WHERE status='active'").get().n,
      alerts: db.prepare(`SELECT al.id, al.sign, al.created_at, p.mother_name, a.name AS asbc
        FROM mat_alerts al JOIN mat_pregnancies p ON p.id=al.pregnancy_id JOIN mat_asbc a ON a.id=al.asbc_id
        ORDER BY al.id DESC LIMIT 20`).all(),
      outbox: db.prepare('SELECT id, pregnancy_id, recipient, template, lang, text, status, error, created_at FROM mat_outbox ORDER BY id DESC LIMIT 50').all(),
    });
  }));

  app.post('/api/admin/maternite/asbc', admin, wrap((req, res) => {
    const b = req.body || {};
    const name = clean(b.name, 80);
    const phone = normalizePhone(b.phone);
    const pin = String(b.pin || '');
    const csps_phone = clean(b.csps_phone, 30) ? normalizePhone(b.csps_phone) : null;
    if (name.length < 2 || !phone || !/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'Nom, numéro et code (4 à 8 chiffres) requis.' });
    if (clean(b.csps_phone, 30) && !csps_phone) return res.status(400).json({ error: 'Numéro du centre de santé invalide.' });
    if (db.prepare('SELECT 1 FROM mat_asbc WHERE phone=?').get(phone)) return res.status(409).json({ error: 'Ce numéro existe déjà.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const r = db.prepare('INSERT INTO mat_asbc (name, phone, pin_salt, pin_hash, csps_name, csps_phone) VALUES (?,?,?,?,?,?)')
      .run(name, phone, salt, hashPin(pin, salt), clean(b.csps_name, 80), csps_phone);
    res.json({ id: Number(r.lastInsertRowid) });
  }));

  app.post('/api/admin/maternite/run', admin, wrap(async (req, res) => {
    const asOf = req.body?.asOf;
    if (asOf && !validDay(asOf)) return res.status(400).json({ error: 'Date invalide.' });
    res.json(await runDaily({ asOf: asOf || new Date(), dryRun: !!req.body?.dryRun }));
  }));

}

// =====================================================================================
// Assistant vocal pour les femmes (PWA /assistant/) : pas de compte, pas de données personnelles.
// Réponses = messages de base de la mission « Ma grossesse, mon couple », dans la langue choisie.
// =====================================================================================
export const ASSISTANT_TOPICS = [
  { id: 'danger', icon: '🚨', title: 'Signes de danger', audience: 'femme', core: 'danger_mere',
    words: ['danger', 'saign', 'sang', 'fievre', 'fièvre', 'mal de tete', 'mal de tête', 'tete', 'tête', 'douleur', 'ventre', 'urgence', 'grave', 'mal'] },
  { id: 'cpn', icon: '🏥', title: 'Ma consultation', audience: 'femme', core: 'cpn_mere',
    words: ['consultation', 'rendez', 'cpn', 'centre', 'sante', 'santé', 'carnet', 'docteur', 'sage', 'visite'] },
  { id: 'move', icon: '👶', title: 'Bébé qui bouge', audience: 'femme', core: 'move_mere',
    words: ['bouge', 'bouger', 'mouvement', 'remue', 'bebe', 'bébé', 'ventre'] },
  { id: 'term', icon: '🤰', title: 'L\'accouchement', audience: 'femme', core: 'term_mere',
    words: ['accouch', 'naissance', 'terme', 'sac', 'naitre', 'naître', 'maternite', 'maternité'] },
  { id: 'p_danger', icon: '👨', title: 'Pour mon mari : signes de danger', audience: 'partenaire', core: 'danger_partenaire', words: ['mari', 'papa', 'partenaire', 'epoux', 'époux'] },
  { id: 'p_cpn', icon: '👨', title: 'Pour mon mari : la consultation', audience: 'partenaire', core: 'cpn_partenaire', words: [] },
  { id: 'p_term', icon: '👨', title: 'Pour mon mari : l\'accouchement', audience: 'partenaire', core: 'term_partenaire', words: [] },
];

/** Texte + audio d'un message dans la langue demandée (traduction validée ET approuvée), sinon français. */
export function coreMedia(coreId, lang) {
  const core = MATERNITE_CORES.find(c => c.id === coreId);
  if (!core) throw new Error(`Message inconnu : ${coreId}`);
  if (lang && lang !== 'fr') {
    const row = db.prepare(`SELECT t.id, t.text, t.audio_file FROM translations t JOIN prompts p ON p.id=t.prompt_id
      WHERE p.key=? AND t.lang=? AND ${ELIGIBLE_SQL}
      ORDER BY (t.audio_file IS NOT NULL) DESC, (t.yes - t.no) DESC, t.id ASC LIMIT 1`).get(maternitePromptKey(coreId), lang);
    if (row) return { text: row.text || core.fr, lang, audio_id: row.audio_file ? row.id : null, translated: true };
  }
  return { text: core.fr, lang: 'fr', audio_id: null, translated: false };
}

export function registerAssistant(app, { wrap, rate }) {
  app.get('/api/assistant/topics', rate('asst', 120, 60000), wrap((req, res) => {
    const lang = MAT_LANGS.includes(req.query.lang) ? req.query.lang : 'fr';
    res.set('Cache-Control', 'no-store');
    res.json({
      lang,
      topics: ASSISTANT_TOPICS.map(t => {
        const m = coreMedia(t.core, lang);
        return {
          id: t.id, icon: t.icon, title: t.title, audience: t.audience, words: t.words,
          text: m.text, lang: m.lang, translated: m.translated, audio_url: m.audio_id ? `/api/assistant/audio/${m.audio_id}` : null,
        };
      }),
    });
  }));

  // Audio public uniquement pour les traductions de cette mission, validées et approuvées par un admin.
  app.get('/api/assistant/audio/:id', rate('asa', 120, 60000), wrap((req, res) => {
    const t = db.prepare(`SELECT t.audio_file FROM translations t JOIN prompts p ON p.id=t.prompt_id
      WHERE t.id=? AND p.key LIKE 's4.%' AND ${ELIGIBLE_SQL} AND t.audio_file IS NOT NULL`).get(Number(req.params.id));
    if (!t) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(AUDIO_DIR, path.basename(t.audio_file)));
  }));
}
