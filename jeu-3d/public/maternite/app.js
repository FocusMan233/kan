'use strict';
const API = '/api/maternite';
const LANGS = [['fr', 'Français'], ['moore', 'Mooré'], ['dioula', 'Dioula']];
const langName = c => (LANGS.find(l => l[0] === c) || [, c])[1];
let token = sessionStorage.getItem('kan.mat') || '';
let me = JSON.parse(sessionStorage.getItem('kan.mat.me') || 'null');
let signs = [];

// Petit créateur d'éléments : tout le texte passe par textContent (aucune injection possible).
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
const show = (...nodes) => root.replaceChildren(...nodes);

async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    method: opts.body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { logout(); throw new Error('Session expirée, reconnecte-toi.'); }
  if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
  return j;
}
function logout() { token = ''; me = null; sessionStorage.removeItem('kan.mat'); sessionStorage.removeItem('kan.mat.me'); login(); }
const frDate = iso => iso ? iso.split('-').reverse().join('/') : '';
const bar = (title, sub, right) => h('div', { class: 'top' },
  h('h1', {}, title, sub ? h('small', {}, sub) : null), right || null);

// ---------- connexion ----------
function login(msg) {
  const err = h('div', { class: 'err', hidden: !msg }, msg || '');
  const phone = h('input', { type: 'tel', inputmode: 'tel', autocomplete: 'username', placeholder: 'Ex. 70 11 22 33' });
  const pin = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'current-password', placeholder: 'Code à 4 chiffres ou plus' });
  const btn = h('button', { class: 'btn' }, 'Se connecter');
  const form = h('form', {
    onsubmit: async e => {
      e.preventDefault(); btn.disabled = true; err.hidden = true;
      try {
        const j = await api('/login', { body: { phone: phone.value, pin: pin.value } });
        token = j.token; me = { name: j.name, csps: j.csps_name };
        sessionStorage.setItem('kan.mat', token); sessionStorage.setItem('kan.mat.me', JSON.stringify(me));
        home();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
    },
  }, h('label', {}, 'Ton numéro de téléphone'), phone, h('label', {}, 'Ton code'), pin, err, btn);
  show(bar('Kan Maternité', 'Suivi des grossesses'), h('main', {}, h('div', { class: 'card' }, form),
    h('p', { class: 'muted' }, 'Réservé aux agents de santé. Pas de compte ? Demande-le à ton responsable.')));
}

// ---------- liste ----------
async function home(flash) {
  show(bar('Kan Maternité', me?.csps || '', h('button', { onclick: logout }, 'Quitter')), h('main', {}, h('p', { class: 'muted' }, 'Chargement…')));
  try {
    if (!signs.length) signs = (await api('/signs')).signs;
    const list = await api('/pregnancies');
    const cards = list.map(p => h('div', { class: 'card tap', onclick: () => detail(p.id) },
      h('div', { class: 'row' }, h('span', { class: 'name' }, p.mother_name), h('span', { class: 'pill' }, p.weeks + ' SA')),
      h('div', { class: 'muted' }, 'Langue : ' + langName(p.mother_lang) + (p.partner_name ? ' · Partenaire : ' + p.partner_name : '')),
      h('div', { class: 'muted' }, p.next_cpn ? `Prochaine CPN ${p.next_cpn.cpn} : ${frDate(p.next_cpn.due_date)}` : 'Aucune CPN à venir')));
    show(bar('Kan Maternité', me?.csps || '', h('button', { onclick: logout }, 'Quitter')),
      h('main', {}, flash ? h('div', { class: 'ok' }, flash) : null,
        h('button', { class: 'btn', onclick: enrollForm }, '+ Inscrire une femme enceinte'),
        h('h2', {}, `Mes dossiers (${list.length})`),
        cards.length ? cards : h('div', { class: 'empty' }, 'Aucun dossier pour le moment.')));
  } catch (ex) { show(bar('Kan Maternité'), h('main', {}, h('div', { class: 'err' }, ex.message), h('button', { class: 'btn', onclick: () => home() }, 'Réessayer'))); }
}

// ---------- inscription ----------
function enrollForm() {
  const f = {};
  const inp = (key, props) => (f[key] = h('input', props));
  const sel = key => (f[key] = h('select', {}, LANGS.map(([v, l]) => h('option', { value: v }, l))));
  const chk = key => (f[key] = h('input', { type: 'checkbox' }));
  const err = h('div', { class: 'err', hidden: true });
  const btn = h('button', { class: 'btn' }, 'Enregistrer');
  const today = new Date().toISOString().slice(0, 10);
  const form = h('form', {
    onsubmit: async e => {
      e.preventDefault(); err.hidden = true; btn.disabled = true;
      try {
        const r = await api('/pregnancies', { body: {
          mother_name: f.mn.value, mother_phone: f.mp.value, mother_lang: f.ml.value, lmp: f.lmp.value, mother_consent: f.mc.checked,
          partner_name: f.pn.value, partner_phone: f.pp.value, partner_lang: f.pl.value, partner_consent: f.pc.checked,
        } });
        home(`Dossier enregistré (${r.week} semaines). Un message de bienvenue a été envoyé.`);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; window.scrollTo(0, 0); }
    },
  },
    err,
    h('label', {}, 'Nom de la femme'), inp('mn', { required: true, autocomplete: 'off' }),
    h('label', {}, 'Son numéro de téléphone'), inp('mp', { type: 'tel', inputmode: 'tel', required: true }),
    h('label', {}, 'Langue des messages'), sel('ml'),
    h('label', {}, 'Date des dernières règles'), inp('lmp', { type: 'date', required: true, max: today }),
    h('label', { class: 'check' }, chk('mc'), h('span', {}, 'La femme accepte de recevoir des messages sur sa grossesse (consentement obligatoire).')),
    h('h2', {}, 'Partenaire (facultatif)'),
    h('label', {}, 'Nom du partenaire'), inp('pn', { autocomplete: 'off' }),
    h('label', {}, 'Son numéro de téléphone'), inp('pp', { type: 'tel', inputmode: 'tel' }),
    h('label', {}, 'Langue des messages'), sel('pl'),
    h('label', { class: 'check' }, chk('pc'), h('span', {}, 'La femme est d\'accord pour que son partenaire reçoive des messages.')),
    btn);
  show(bar('Nouvelle inscription', '', h('button', { onclick: () => home() }, 'Retour')), h('main', {}, h('div', { class: 'card' }, form)));
}

// ---------- dossier ----------
async function detail(id, flash) {
  show(bar('Dossier', '', h('button', { onclick: () => home() }, 'Retour')), h('main', {}, h('p', { class: 'muted' }, 'Chargement…')));
  try {
    const p = await api('/pregnancies/' + id);
    const setAppt = async (a, status) => { await api('/appointments/' + a.id, { body: { status } }); detail(id); };
    const appts = p.appointments.map(a => h('div', { class: 'appt' },
      h('div', { class: 'd' }, h('b', {}, 'CPN ' + a.cpn), h('div', { class: 'muted' }, `${frDate(a.due_date)} · ${a.week} SA`)),
      a.status === 'programme'
        ? [h('button', { class: 'btn alt sm', onclick: () => setAppt(a, 'honore') }, 'Venue'), h('button', { class: 'btn alt sm', onclick: () => setAppt(a, 'rate') }, 'Manquée')]
        : h('span', { class: a.status === 'honore' ? 'pill' : 'pill bad' }, a.status === 'honore' ? 'Venue' : 'Manquée')));
    const sign = h('select', {}, h('option', { value: '' }, 'Choisir le signe de danger…'), signs.map(s => h('option', { value: s }, s)));
    const aerr = h('div', { class: 'err', hidden: true });
    const abtn = h('button', { class: 'btn red' }, 'Envoyer l\'alerte');
    let armed = false;
    abtn.onclick = async () => {
      aerr.hidden = true;
      if (!sign.value) { aerr.textContent = 'Choisis d\'abord le signe de danger.'; aerr.hidden = false; return; }
      if (!armed) { armed = true; abtn.textContent = 'Appuie encore pour confirmer'; return; }
      abtn.disabled = true;
      try {
        const r = await api(`/pregnancies/${id}/alert`, { body: { sign: sign.value } });
        detail(id, r.notified.length ? 'Alerte envoyée : ' + r.notified.map(n => n === 'csps' ? 'centre de santé' : 'partenaire').join(' et ') + '.'
          : 'Alerte enregistrée, mais aucun numéro n\'est configuré pour la transmettre. Préviens le centre de santé directement.');
      } catch (ex) { aerr.textContent = ex.message; aerr.hidden = false; abtn.disabled = false; armed = false; abtn.textContent = 'Envoyer l\'alerte'; }
    };
    show(bar(p.mother_name, `${p.weeks} semaines d'aménorrhée`, h('button', { onclick: () => home() }, 'Retour')),
      h('main', {}, flash ? h('div', { class: 'ok' }, flash) : null,
        h('div', { class: 'card' },
          h('div', { class: 'muted' }, 'Téléphone : ' + p.mother_phone + ' · ' + langName(p.mother_lang)),
          p.partner_name || p.partner_phone ? h('div', { class: 'muted' }, `Partenaire : ${p.partner_name || ''} ${p.partner_phone || ''} · ${p.partner_consent ? 'messages acceptés' : 'sans accord : aucun message'}`) : null,
          h('div', { class: 'muted' }, 'Dernières règles : ' + frDate(p.lmp))),
        h('h2', {}, 'Signe de danger'),
        h('div', { class: 'card danger' }, sign, aerr, abtn,
          h('p', { class: 'muted' }, 'Le centre de santé et le partenaire reçoivent un SMS. Dans tous les cas, oriente la femme vers le centre de santé.')),
        h('h2', {}, 'Consultations prénatales'), h('div', { class: 'card' }, appts.length ? appts : h('div', { class: 'muted' }, 'Aucune CPN à venir.')),
        h('h2', {}, 'Derniers messages'),
        h('div', { class: 'card' }, p.messages.length
          ? p.messages.map(m => h('div', { class: 'msg' }, h('b', {}, (m.recipient === 'mere' ? 'Mère' : m.recipient === 'partenaire' ? 'Partenaire' : 'Centre de santé') + ' · ' + langName(m.lang)), h('div', {}, m.text), h('div', { class: 'muted' }, m.created_at + ' · ' + m.status)))
          : h('div', { class: 'muted' }, 'Aucun message pour le moment.'))));
  } catch (ex) { show(bar('Dossier', '', h('button', { onclick: () => home() }, 'Retour')), h('main', {}, h('div', { class: 'err' }, ex.message))); }
}

token ? home() : login();
