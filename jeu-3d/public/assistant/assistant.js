'use strict';
const LANGS = [['fr', 'Français'], ['moore', 'Mooré'], ['dioula', 'Dioula']];
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let lang = LS.get('kan.asst.lang') || 'fr';
let topics = [];
let current = null;       // sujet affiché
let audio = null;         // lecture en cours
let installEvent = null;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

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
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- voix ----------
function stopAll() {
  if (audio) { audio.pause(); audio = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function speakFr(text) {
  if (!('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR'; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith('fr'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
  return true;
}
/** Lit la réponse : enregistrement dans sa langue s'il existe, sinon voix française du téléphone. */
function play(t) {
  stopAll();
  if (t.audio_url) {
    audio = new Audio(t.audio_url);
    audio.play().catch(() => { if (t.lang === 'fr') speakFr(t.text); });
    return;
  }
  if (t.lang === 'fr') speakFr(t.text);
}

// ---------- données ----------
async function loadTopics() {
  const key = 'kan.asst.topics.' + lang;
  try {
    const r = await fetch('/api/assistant/topics?lang=' + lang);
    if (!r.ok) throw new Error();
    const j = await r.json();
    topics = j.topics; LS.set(key, JSON.stringify(topics));
  } catch {
    try { topics = JSON.parse(LS.get(key) || '[]'); } catch { topics = []; }   // hors ligne : dernière copie
  }
}
function match(text) {
  const q = ' ' + norm(text) + ' ';
  let best = null, bestScore = 0;
  for (const t of topics.filter(x => x.audience === 'femme')) {
    const score = t.words.reduce((n, w) => n + (q.includes(norm(w)) ? 1 : 0), 0);
    if (score > bestScore) { best = t; bestScore = score; }
  }
  if (/\b(mari|papa|partenaire|epoux)\b/.test(q)) {
    const map = { danger: 'p_danger', cpn: 'p_cpn', term: 'p_term' };
    return topics.find(t => t.id === (map[best?.id] || 'p_danger')) || best;
  }
  return best;
}

// ---------- écrans ----------
let status;
function setStatus(msg) { if (status) status.textContent = msg; }

function answerCard(t) {
  const notTranslated = lang !== 'fr' && !t.translated;
  return h('div', { class: 'answer', role: 'status' },
    h('h3', {}, t.icon + ' ' + t.title),
    notTranslated ? h('div', { class: 'note' }, 'Ce message n\'est pas encore disponible en ' + LANGS.find(l => l[0] === lang)[1] + '. Voici le message en français.') : null,
    h('p', {}, t.text),
    h('div', { class: 'row' }, h('button', { onclick: () => play(t) }, '🔊 Écouter'), h('button', { class: 'alt', onclick: stopAll }, '⏹ Arrêter')));
}
function openTopic(t, heard) {
  current = t; render(heard);
  play(t);
  document.getElementById('ans')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const MIC_ERRORS = {
  'not-allowed': 'Le micro est bloqué. Autorise-le (cadenas à côté de l\'adresse), puis réessaie.',
  'service-not-allowed': 'Le micro est bloqué. Autorise-le (cadenas à côté de l\'adresse), puis réessaie.',
  'no-speech': 'Je n\'ai rien entendu. Appuie et parle plus près.',
  'audio-capture': 'Aucun micro détecté sur cet appareil.',
  'network': 'La voix a besoin d\'internet. Vérifie ta connexion, ou écris ta question.',
  'language-not-supported': 'Ce navigateur ne comprend pas le français parlé. Écris ta question.',
};
function answer(said) {
  const t = match(said);
  if (t) openTopic(t, said);
  else {
    setStatus('Je n\'ai pas bien compris. Choisis une image ci-dessous.');
    speakFr('Je n\'ai pas bien compris. Choisis un sujet en appuyant sur une image.');
  }
}
let rec = null;
function listen() {
  const btn = document.getElementById('mic');
  if (rec) { try { rec.stop(); } catch {} return; }          // 2e appui = arrêter
  stopAll();
  setStatus('Démarrage du micro…');
  let got = false;
  try {
    rec = new SR();
    rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onstart = () => { btn.classList.add('on'); setStatus('Je t\'écoute… parle maintenant.'); };
    rec.onresult = e => { got = true; answer(e.results[0][0].transcript); };
    rec.onerror = e => { got = true; setStatus(MIC_ERRORS[e.error] || 'Micro indisponible (' + e.error + '). Écris ta question ci-dessous.'); };
    rec.onend = () => { btn.classList.remove('on'); rec = null; if (!got) setStatus('Je n\'ai rien entendu. Réessaie ou écris ta question.'); };
    rec.start();
  } catch (e) {
    rec = null; btn.classList.remove('on');
    setStatus('Le micro ne démarre pas sur ce navigateur. Écris ta question ci-dessous.');
  }
}

function render(heard) {
  const frOnlyMic = lang === 'fr' && SR;
  status = h('div', { class: 'status', 'aria-live': 'polite' }, heard ? `Tu as dit : « ${heard} »` : '');
  const women = topics.filter(t => t.audience === 'femme');
  const partner = topics.filter(t => t.audience === 'partenaire');
  const card = t => h('button', { class: 'topic c-' + t.id, onclick: () => openTopic(t) }, h('span', { class: 'i' }, t.icon), t.title);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const L = LANGS.find(l => l[0] === lang)[1];
  root.replaceChildren(
    h('div', { class: 'hero' }, h('h1', {}, 'Bonjour 👋'), h('div', { class: 'sub' }, 'Je t\'aide pendant ta grossesse. Parle ou appuie sur une image.')),
    h('main', {},
      h('div', { class: 'panel' },
        h('div', { class: 'langs', role: 'group', 'aria-label': 'Langue' }, LANGS.map(([c, n]) =>
          h('button', { 'aria-pressed': String(c === lang), onclick: async () => { lang = c; LS.set('kan.asst.lang', c); stopAll(); current = null; await loadTopics(); render(); } }, n))),
        frOnlyMic
          ? h('div', { class: 'mic' }, h('button', { id: 'mic', onclick: listen, 'aria-label': 'Parler à l\'assistant' }, '🎤'), h('div', { class: 'label' }, 'Appuie et parle'), status)
          : h('div', { class: 'mic' }, h('div', { class: 'hint' }, lang === 'fr' ? 'Ton navigateur ne permet pas de parler à l\'assistant. Appuie sur une image.' : 'Comprendre la voix en ' + L + ' n\'est pas encore possible : appuie sur une image pour écouter.'), status),
        h('form', { class: 'ask', onsubmit: e => { e.preventDefault(); const i = e.target.q; if (i.value.trim()) answer(i.value); } },
          h('input', { name: 'q', type: 'text', placeholder: 'Ou écris ici : danger, rendez-vous, bébé…', autocomplete: 'off' }), h('button', { type: 'submit' }, 'OK')),
        installEvent && !installed ? h('button', { class: 'install', onclick: async () => { installEvent.prompt(); await installEvent.userChoice; installEvent = null; render(); } }, '📲 Installer l\'application') : null,
        ios && !installed ? h('div', { class: 'hint' }, 'Pour installer : bouton Partager de Safari, puis « Sur l\'écran d\'accueil ».') : null),
      current ? h('div', { id: 'ans' }, answerCard(current)) : null,
      h('h2', {}, 'Que veux-tu savoir ?'), h('div', { class: 'grid' }, women.map(card)),
      partner.length ? [h('h2', {}, 'Pour mon mari'), h('div', { class: 'grid' }, partner.map(card))] : null,
      h('div', { class: 'urgent' }, '🚨 Urgence (saignement, forte fièvre, convulsions) : va tout de suite au centre de santé.'),
      h('div', { class: 'foot' }, h('a', { href: '/' }, '🎮 Jouer à Kan'), h('a', { class: 'alt', href: '/maternite/' }, 'Agent de santé'))));
}

addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; render(); });
if ('speechSynthesis' in window) speechSynthesis.getVoices();
loadTopics().then(() => render());
