import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kan-mat-'));
process.env.DATA_DIR = dir;
process.env.ADMIN_PASSWORD = 'testpass';
process.env.SMS_PROVIDER = 'log';

const M = await import('../server/maternite.js');
const { db } = await import('../server/db.js');
const { app } = await import('../server/server.js');
const { maternitePromptKey } = await import('../server/content.js');

let server, base, adminToken, asbcToken;
const post = (url, body, token) => fetch(base + url, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
}).then(async r => ({ status: r.status, body: await r.json() }));
const get = (url, token) => fetch(base + url, { headers: token ? { authorization: `Bearer ${token}` } : {} })
  .then(async r => ({ status: r.status, body: await r.json() }));

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await post('/api/admin/login', { password: 'testpass' })).body.token;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('semaines d\'aménorrhée et dates', () => {
  assert.equal(M.weeksOfAmenorrhea('2026-01-01', '2026-01-01'), 0);
  assert.equal(M.weeksOfAmenorrhea('2026-01-01', '2026-03-26'), 12);
  assert.equal(M.dueDateForWeek('2026-01-01', 12), '2026-03-26');
});

test('numéros de téléphone', () => {
  assert.equal(M.normalizePhone('71 33 15 23'), '22671331523');
  assert.equal(M.normalizePhone('+233 59 950 2721'), '233599502721');
  assert.equal(M.normalizePhone('0022671331523'), '22671331523');
  assert.equal(M.normalizePhone('123'), null);
});

test('inscription : consentements et dates obligatoires', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const ok = { mother_name: 'Awa', mother_phone: '70112233', mother_consent: true, lmp: '2026-03-09' };
  assert.equal(M.validateEnrollment(ok, now).errors.length, 0);
  assert.ok(M.validateEnrollment({ ...ok, mother_consent: false }, now).errors.length);
  assert.ok(M.validateEnrollment({ ...ok, lmp: '2026-09-01' }, now).errors.length);
  assert.ok(M.validateEnrollment({ ...ok, lmp: '2025-01-01' }, now).errors.length);
  assert.ok(M.validateEnrollment({ ...ok, partner_phone: '70998877' }, now).errors.length, 'partenaire sans accord');
});

test('parcours complet : ASBC, inscription, bond dans le temps, alerte', async () => {
  const created = await post('/api/admin/maternite/asbc', {
    name: 'Ousmane', phone: '70000001', pin: '1234', csps_name: 'CSPS de Bouboulou', csps_phone: '70000002',
  }, adminToken);
  assert.equal(created.status, 200);
  assert.equal((await post('/api/maternite/login', { phone: '70000001', pin: '0000' })).status, 401);
  asbcToken = (await post('/api/maternite/login', { phone: '70000001', pin: '1234' })).body.token;
  assert.ok(asbcToken);
  assert.equal((await get('/api/maternite/pregnancies')).status, 401);

  const lmp = new Date(Date.now() - 6 * 7 * DAY()).toISOString().slice(0, 10);
  const bad = await post('/api/maternite/pregnancies', { mother_name: 'Awa', mother_phone: '70112233', lmp }, asbcToken);
  assert.equal(bad.status, 400, 'consentement manquant');

  const enrolled = await post('/api/maternite/pregnancies', {
    mother_name: 'Awa', mother_phone: '70112233', mother_consent: true, mother_lang: 'moore',
    partner_name: 'Ali', partner_phone: '70998877', partner_consent: true, partner_lang: 'dioula', lmp,
  }, asbcToken);
  assert.equal(enrolled.status, 200);
  assert.equal(enrolled.body.week, 6);
  const id = enrolled.body.id;

  let box = db.prepare('SELECT recipient, template, status FROM mat_outbox WHERE pregnancy_id=?').all(id);
  assert.deepEqual(box.map(b => b.recipient).sort(), ['mere', 'partenaire']);
  assert.ok(box.every(b => b.template === 'welcome' && b.status === 'simulated'));

  // rien ne part à 6 semaines
  assert.equal((await M.runDaily({ asOf: new Date() })).sent, 0);

  // bond dans le temps : semaine 11 -> rappel CPN1 pour la mère et le partenaire
  const w11 = M.dueDateForWeek(lmp, 11);
  const dry = await M.runDaily({ asOf: w11, dryRun: true });
  assert.equal(dry.items.length, 2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mat_outbox WHERE pregnancy_id=?').get(id).n, 2, 'dryRun n\'écrit rien');
  const run = await M.runDaily({ asOf: w11 });
  assert.equal(run.sent, 2);
  const again = await M.runDaily({ asOf: w11 });
  assert.equal(again.sent, 0, 'idempotent');
  const cpn = db.prepare("SELECT text FROM mat_outbox WHERE pregnancy_id=? AND template='cpn1' AND recipient='mere'").get(id);
  assert.match(cpn.text, /^Awa : Votre consultation prénatale approche/);
  assert.match(cpn.text, /\[CPN 1, vers le \d\d\/\d\d\/\d{4}\]$/);

  // rendez-vous honoré => plus de rappel
  const appt = (await get(`/api/maternite/pregnancies/${id}`, asbcToken)).body.appointments[0];
  assert.equal(appt.cpn, 1);

  // alerte
  const alert = await post(`/api/maternite/pregnancies/${id}/alert`, { sign: 'Saignement' }, asbcToken);
  assert.deepEqual(alert.body.notified, ['csps', 'partenaire']);
  const csps = db.prepare("SELECT to_phone, text FROM mat_outbox WHERE recipient='csps'").get();
  assert.equal(csps.to_phone, '22670000002');
  assert.match(csps.text, /^ALERTE : l'agent de santé Ousmane réfère Awa \(Saignement, 6 SA\) au CSPS de Bouboulou/);
  assert.equal((await post(`/api/maternite/pregnancies/${id}/alert`, { sign: 'Inconnu' }, asbcToken)).status, 400);
});

test('sans accord du partenaire, aucun message au partenaire', async () => {
  const asbc = db.prepare("SELECT id FROM mat_asbc WHERE phone='22670000001'").get().id;
  const lmp = new Date(Date.now() - 10 * 7 * DAY()).toISOString().slice(0, 10);
  const r = await M.enroll(asbc, { mother_name: 'Fati', mother_phone: '70555555', mother_consent: true, lmp });
  const rows = db.prepare('SELECT recipient FROM mat_outbox WHERE pregnancy_id=?').all(r.id);
  assert.deepEqual(rows.map(x => x.recipient), ['mere']);
});

test('un ASBC ne voit pas les dossiers d\'un autre', async () => {
  await post('/api/admin/maternite/asbc', { name: 'Autre', phone: '70000009', pin: '4321' }, adminToken);
  const tok = (await post('/api/maternite/login', { phone: '70000009', pin: '4321' })).body.token;
  const mine = db.prepare("SELECT id FROM mat_pregnancies LIMIT 1").get().id;
  assert.equal((await get(`/api/maternite/pregnancies/${mine}`, tok)).status, 404);
  assert.equal((await post(`/api/maternite/pregnancies/${mine}/alert`, { sign: 'Saignement' }, tok)).status, 400);
  assert.equal((await get('/api/maternite/pregnancies', tok)).body.length, 0);
});

test('la traduction validée et approuvée est utilisée, sinon repli en français', () => {
  const key = maternitePromptKey('cpn_mere');
  const prompt = db.prepare('SELECT id, sensitive FROM prompts WHERE key=?').get(key);
  assert.ok(prompt && prompt.sensitive === 1, 'phrase de santé sensible');
  assert.equal(M.coreText('cpn_mere', 'moore').lang, 'fr', 'aucune traduction');
  db.prepare("INSERT INTO translations (prompt_id, lang, text, status) VALUES (?,?,?,'validated')").run(prompt.id, 'moore', 'TEXTE-MOORE');
  assert.equal(M.coreText('cpn_mere', 'moore').lang, 'fr', 'validée par les joueurs mais pas approuvée par l\'admin');
  db.prepare("UPDATE translations SET admin_status='approved' WHERE prompt_id=?").run(prompt.id);
  assert.deepEqual(M.coreText('cpn_mere', 'moore'), { text: 'TEXTE-MOORE', lang: 'moore' });
  assert.equal(M.coreText('cpn_mere', 'dioula').lang, 'fr');
});

test('les données de santé ne sortent pas dans l\'API publique', async () => {
  const r = await fetch(`${base}/api/v1/stats`);
  assert.equal(r.status, 401);
  const all = JSON.stringify(await (await fetch(`${base}/api/content`)).json());
  assert.ok(!all.includes('22670112233') && !all.includes('Ousmane'));
});

function DAY() { return 86400000; }
