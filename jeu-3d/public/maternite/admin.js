'use strict';
let TOKEN = sessionStorage.getItem('kan.admin') || '';
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const root = document.getElementById('app');
async function api(path, body) {
  const r = await fetch('/api/admin/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { TOKEN = ''; sessionStorage.removeItem('kan.admin'); loginView(); throw new Error('Session expirée'); }
  if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
  return j;
}
const header = (right) => h('div', { class: 'top' }, h('h1', {}, 'Kan Maternité', h('small', {}, 'Administration')), right || null);

function loginView(msg) {
  const pw = h('input', { type: 'password', placeholder: 'Mot de passe administrateur', autofocus: true });
  const err = h('div', { class: 'err', hidden: !msg }, msg || '');
  root.replaceChildren(header(), h('main', {}, h('form', { class: 'card', onsubmit: async e => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw.value }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      TOKEN = j.token; sessionStorage.setItem('kan.admin', TOKEN); view();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  } }, pw, err, h('button', { class: 'btn' }, 'Entrer'))));
}

async function view(flash) {
  let o;
  try { o = await api('maternite/overview'); } catch (ex) { return; }

  // --- création d'un agent de santé
  const f = {};
  const field = (key, label, props) => h('div', {}, h('label', {}, label), (f[key] = h('input', props)));
  const aerr = h('div', { class: 'err', hidden: true });
  const addForm = h('form', { onsubmit: async e => {
    e.preventDefault(); aerr.hidden = true;
    try {
      await api('maternite/asbc', { name: f.name.value, phone: f.phone.value, pin: f.pin.value, csps_name: f.cn.value, csps_phone: f.cp.value });
      view('Agent de santé créé.');
    } catch (ex) { aerr.textContent = ex.message; aerr.hidden = false; }
  } }, h('div', { class: 'grid' },
    field('name', 'Nom de l\'agent', { required: true }), field('phone', 'Téléphone', { type: 'tel', required: true }),
    field('pin', 'Code (4 à 8 chiffres)', { inputmode: 'numeric', required: true, autocomplete: 'off' }),
    field('cn', 'Centre de santé', { placeholder: 'CSPS de …' }), field('cp', 'Téléphone du centre (alertes)', { type: 'tel' })),
    aerr, h('button', { class: 'btn' }, 'Créer l\'agent'));

  // --- envoi / simulation
  const day = h('input', { type: 'date' });
  const dry = h('input', { type: 'checkbox', checked: true });
  const out = h('div');
  const runBtn = h('button', { class: 'btn', onclick: async () => {
    runBtn.disabled = true; out.replaceChildren();
    try {
      const r = await api('maternite/run', { asOf: day.value || undefined, dryRun: dry.checked });
      out.replaceChildren(h('div', { class: 'ok' }, r.dryRun ? `Simulation au ${r.asOf} : ${r.items.length} message(s) partiraient.` : `Envoi au ${r.asOf} : ${r.sent} message(s) envoyés, ${r.skipped} déjà envoyés.`),
        ...r.items.map(i => h('div', { class: 'msg' }, h('b', {}, `Dossier ${i.pregnancy} · ${i.recipient} · ${i.lang}`), h('div', {}, i.text))));
      if (!r.dryRun) setTimeout(() => view(), 1500);
    } catch (ex) { out.replaceChildren(h('div', { class: 'err' }, ex.message)); }
    runBtn.disabled = false;
  } }, 'Lancer');
  const runCard = h('div', { class: 'card' },
    h('p', { class: 'muted' }, 'L\'envoi tourne tout seul chaque jour. Ici : lancer à la main, ou simuler un autre jour (« bond dans le temps ») pour une démonstration.'),
    h('div', { class: 'inline' }, h('div', {}, h('label', {}, 'Simuler au jour (vide = aujourd\'hui)'), day),
      h('label', { class: 'check', style: 'margin:0' }, dry, h('span', {}, 'Simulation seulement (n\'envoie rien)')), runBtn), out);

  const tbl = (head, rows) => h('table', {}, h('tr', {}, head.map(x => h('th', {}, x))), rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))));
  root.replaceChildren(header(h('a', { href: '/admin', style: 'color:#fff;font-size:14px' }, 'Admin Kan')),
    h('main', {},
      flash ? h('div', { class: 'ok' }, flash) : null,
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'name' }, `${o.pregnancies} grossesse(s) suivie(s)`),
        h('span', { class: o.provider === 'log' ? 'pill warn' : 'pill' }, o.provider === 'log' ? 'SMS simulés (aucun envoi réel)' : 'SMS : ' + o.provider)),
        h('div', { class: 'muted' }, 'Dernier envoi automatique : ' + (o.last_run || 'jamais'))),
      h('h2', {}, 'Envoi des messages'), runCard,
      h('h2', {}, 'Nouvel agent de santé'), h('div', { class: 'card' }, addForm),
      h('h2', {}, 'Agents de santé'), h('div', { class: 'card' }, o.asbc.length ? tbl(['Nom', 'Téléphone', 'Centre', 'Dossiers'], o.asbc.map(a => [a.name, a.phone, a.csps_name + (a.csps_phone ? ' · ' + a.csps_phone : ' · pas de numéro d\'alerte'), String(a.pregnancies)])) : h('div', { class: 'muted' }, 'Aucun agent.')),
      h('h2', {}, 'Alertes récentes'), h('div', { class: 'card' }, o.alerts.length ? tbl(['Date', 'Femme', 'Signe', 'Agent'], o.alerts.map(a => [a.created_at, a.mother_name, a.sign, a.asbc])) : h('div', { class: 'muted' }, 'Aucune alerte.')),
      h('h2', {}, 'Derniers messages'), h('div', { class: 'card' }, o.outbox.length ? tbl(['Date', 'Pour', 'Langue', 'Message', 'État'], o.outbox.map(m => [m.created_at, m.recipient, m.lang, m.text, m.status + (m.error ? ' : ' + m.error : '')])) : h('div', { class: 'muted' }, 'Aucun message.'))));
}
TOKEN ? view() : loginView();
