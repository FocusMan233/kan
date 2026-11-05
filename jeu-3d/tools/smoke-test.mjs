// Test de bout en bout du serveur : node tools/smoke-test.mjs  (serveur déjà lancé, PORT/ADMIN_PASSWORD en env)
const BASE = process.env.BASE || 'http://localhost:3100';
const ADMIN = process.env.ADMIN_PASSWORD || 'testpass';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const call = async (method, url, body, token, raw) => {
  const r = await fetch(BASE + url, { method, headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...(raw ? { 'Content-Type': raw } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: raw ? body : body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.clone().json(); } catch {} return { s: r.status, j, r };
};
const mk = async (name, phone, langs = ['moore']) => (await call('POST', '/api/register', { name, phone, langs, quartier: 'gounghin', consent: true, avatar: { skin: 3 } })).j;

console.log('Inscription');
const c = (await call('GET', '/api/content')).j;
ok(c.missions.length >= 13 && c.missions[0].steps[0].key === 'q1.1', 'contenu : ' + c.missions.length + ' missions');
ok((await call('POST', '/api/register', { name: 'A', phone: '123', langs: ['moore'], consent: true })).s === 400, 'refuse un numéro invalide');
ok((await call('POST', '/api/register', { name: 'Ali', phone: '70123456', langs: ['moore'], consent: false })).s === 400, 'refuse sans consentement');
const users = [];
for (let i = 0; i < 5; i++) users.push(await mk('Joueur' + i, '7000000' + i));
ok(users.every(u => u.token), '5 joueurs créés (numéro non vérifié)');
const again = await mk('Joueur0 bis', '70000000');
ok(again.token === users[0].token, 'même numéro => même compte');

console.log('Traduction');
const T = users[0].token;
let r = await call('POST', '/api/translate', { prompt_key: 'q1.1', lang: 'moore', text: 'Bonjour, comment vas-tu ce matin ?' }, T);
ok(r.s === 400, 'refuse du français copié');
r = await call('POST', '/api/translate', { prompt_key: 'q1.1', lang: 'dioula', text: 'I ni sogoma' }, T);
ok(r.s === 400, 'refuse une langue non déclarée');
r = await call('POST', '/api/translate', { prompt_key: 'q1.1', lang: 'moore', text: 'Ne y yibeoogo, yaa wãn la a sõma ?' }, T);
ok(r.s === 200 && r.j.points_awarded === 10, 'traduction enregistrée (+10)');
const tid = r.j.id;
const audio = Buffer.alloc(4000, 7);
r = await call('POST', `/api/translate/${tid}/audio`, audio, T, 'audio/webm');
ok(r.s === 200 && r.j.points_awarded === 5, 'audio enregistré (+5)');
// quelques traductions supplémentaires pour avoir de la matière à écouter
for (const [k, t] of [['q1.2', 'Yaa wãn la rãmba ?'], ['q1.3', 'Barka wusgo']]) await call('POST', '/api/translate', { prompt_key: k, lang: 'moore', text: t }, T);

console.log('Écoute & validation');
let validated = 0;
for (let i = 1; i <= 3; i++) {
  const U = users[i].token;
  const l = (await call('GET', '/api/listen?zone=quartier', null, U)).j.task;
  if (!l) { ok(false, 'tâche écoute joueur ' + i); continue; }
  if (i === 1) ok(l.options.length === 4 && l.audio_url !== undefined, 'tâche d\'écoute à 4 choix');
  // on triche en choisissant la bonne réponse via la clé de la traduction (tid=1ère) pour tester la validation
  const truth = c.missions[0].steps; // q1.1..4
  const tr = l.text;
  const map = { 'Ne y yibeoogo, yaa wãn la a sõma ?': 'Bonjour, comment vas-tu ce matin ?', 'Yaa wãn la rãmba ?': 'Comment va ta famille ?', 'Barka wusgo': 'Merci beaucoup, et à bientôt.' };
  const right = l.options.find(o => o.text === map[tr]);
  const a = await call('POST', '/api/listen/answer', { translation_id: l.translation_id, chosen_prompt_id: right.prompt_id }, U);
  ok(a.s === 200 && a.j.correct === true, `joueur ${i} comprend « ${tr.slice(0, 22)}… » (+${a.j.points_awarded})`);
}
// 3 votes sur la même traduction
const tgt = tid;
for (const i of [1, 2, 3, 4]) {
  const U = users[i].token;
  await call('POST', '/api/listen/answer', { translation_id: tgt, chosen_prompt_id: 1 }, U); // peut échouer (409) si déjà voté
}
const ov0 = (await call('POST', '/api/admin/login', { password: 'mauvais' })).s;
ok(ov0 === 401, 'admin refuse un mauvais mot de passe');
const AT = (await call('POST', '/api/admin/login', { password: ADMIN })).j.token;
let list = (await call('GET', '/api/admin/translations?lang=moore', null, AT)).j;
ok(list.total >= 3, 'admin voit ' + list.total + ' traductions');
console.log('   statuts :', list.rows.map(x => `${x.id}:${x.status}(${x.yes}/${x.no})`).join(' '));

console.log('Admin');
const first = list.rows.find(x => x.id === tid);
r = await call('PATCH', `/api/admin/translations/${tid}`, { admin_status: 'approved' }, AT);
ok(r.s === 200 && r.j.status === 'validated', 'admin approuve => validée');
const ov = (await call('GET', '/api/admin/overview', null, AT)).j;
ok(ov.totals.players === 5 && ov.totals.voice === 1, 'vue d\'ensemble : ' + JSON.stringify(ov.totals));
r = await call('POST', '/api/admin/translations', { prompt_key: 'q2.2', lang: 'dioula', text: 'Tomati bɛ sɔngɔ kɛmɛ duuru' }, AT);
ok(r.s === 200, 'admin ajoute une traduction dioula');
r = await call('POST', '/api/admin/prompts', { zone: 'meeting', text_fr: 'Le Burkina accueille aujourd\'hui un grand festival.', news: true }, AT);
ok(r.s === 200 && (await call('GET', '/api/content')).j.missions.some(m => m.id === 'flash'), 'actualité ajoutée => mission « Flash info »');

console.log('API de langue');
ok((await call('GET', '/api/v1/pairs')).s === 401, 'API refuse sans clé');
const key = (await call('POST', '/api/admin/keys', { label: 'test' }, AT)).j.key;
const api = async p => (await fetch(BASE + '/api/v1' + p, { headers: { 'X-API-Key': key } }));
let j = await (await api('/languages')).json();
ok(j.find(l => l.code === 'moore').validated >= 1, 'GET /languages');
j = await (await api('/pairs?target=moore')).json();
ok(j.data.length >= 1 && j.data[0].audio_url, 'GET /pairs (avec audio) : ' + j.data.length);
j = await (await api('/translate?text=' + encodeURIComponent('Bonjour, comment vas-tu ce matin') + '&source=fr&target=moore')).json();
ok(j.matches[0]?.translation?.startsWith('Ne y yibeoogo'), 'GET /translate fr→moore : ' + j.matches[0]?.translation + ' (' + j.matches[0]?.score + ')');
j = await (await api('/translate?text=' + encodeURIComponent('Tomati bɛ sɔngɔ kɛmɛ duuru') + '&source=dioula&target=fr')).json();
ok(j.matches[0]?.exact, 'GET /translate dioula→fr : ' + j.matches[0]?.translation);
const au = await api('/audio/' + tid); ok(au.status === 200, 'GET /audio/:id');
const ex = await (await api('/export?format=jsonl')).text(); ok(ex.trim().split('\n').length >= 1, 'export JSONL');
const csv = await (await fetch(`${BASE}/api/admin/export?format=csv&scope=all&t=${AT}`)).text(); ok(csv.includes('source_text'), 'export CSV admin');

console.log('Santé (phrases sensibles)');
r = await call('POST', '/api/translate', { prompt_key: 's2.1', lang: 'moore', text: 'Mon enfant na kaoogo' }, T); const sid = r.j.id;
await call('PATCH', `/api/admin/translations/${sid}`, { admin_status: 'approved' }, AT);
await call('PATCH', `/api/admin/translations/${sid}`, { admin_status: '' }, AT); // retire l'approbation admin
// on force 3 votes positifs via la DB serait plus direct ; ici on vérifie juste que sensible non approuvée n'est pas exportée
const ex2 = await (await api('/pairs?zone=sante')).json();
ok(ex2.data.length === 0, 'phrase de santé non approuvée => absente de l\'API');
await call('PATCH', `/api/admin/translations/${sid}`, { admin_status: 'approved' }, AT);
const ex3 = await (await api('/pairs?zone=sante')).json();
ok(ex3.data.length === 1, 'approuvée par un admin => présente');

console.log(fails ? `\n${fails} échec(s)` : '\nTout est OK');
process.exit(fails ? 1 : 0);
