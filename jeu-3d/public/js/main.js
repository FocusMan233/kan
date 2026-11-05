import * as THREE from 'three';
import { World, HALF } from './world.js';
import { buildCharacter, avatarSpec, SKINS } from './characters.js';
import { Api, LS } from './api.js';
import { ClipRecorder } from './clip.js';

const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- qualité & rendu
function detectQuality() {
  const f = qs.get('quality'); if (['high', 'mid', 'low'].includes(f)) return f;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const mem = navigator.deviceMemory || (mobile ? 3 : 8), cores = navigator.hardwareConcurrency || 4;
  if (mem <= 2 || cores <= 4 && mobile) return 'low';
  if (mobile || mem <= 4) return 'mid';
  return 'high';
}
const quality = detectQuality();
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'mid' ? 1.5 : 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, .1, 900);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 66 : 54; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const world = new World({ scene, renderer, quality });

// ---------------------------------------------------------------- état
const G = {
  content: null, user: null, done: new Set(), me: null,
  mode: 'boot',            // boot | stage | play
  player: null, pos: new THREE.Vector3(), ry: 0, speed: 0,
  cam: { yaw: 0, pitch: .38, dist: 6.2 },
  mission: null, step: 0, beacon: null, zoneKey: null, busy: false,
  keys: new Set(), joy: { x: 0, y: 0 }, stage: null, t: 0,
};
window.__game = G; G.world = world; G.THREE = THREE;

const toastEl = $('toast');
function toast(msg, ms = 2400) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), ms); }
function confetti() {
  const box = $('confetti'); const cols = ['#d6232a', '#f6cf1c', '#1b9a48', '#fff', '#f4c542'];
  for (let i = 0; i < 70; i++) { const p = document.createElement('i'); p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 5]};animation-delay:${Math.random() * .5}s;animation-duration:${1.6 + Math.random() * 1.4}s;transform:rotate(${Math.random() * 360}deg)`; box.appendChild(p); setTimeout(() => p.remove(), 3500); }
}
const sheet = $('sheet'), sheetBody = $('sheetBody');
function openSheet(html, { lock = false } = {}) { sheetBody.innerHTML = html; sheet.classList.remove('hidden'); sheet.dataset.lock = lock ? '1' : ''; sheetBody.scrollTop = 0; return sheetBody; }
function closeSheet() { sheet.classList.add('hidden'); sheetBody.innerHTML = ''; stopMic(true); }
function setPoints(p) { if (G.user) G.user.points = p; $('chipPts').textContent = '⭐ ' + p; }
function addPoints(n) { if (n) setPoints((G.user.points || 0) + n); }

// ---------------------------------------------------------------- chargement
function progress(p, msg) { $('barFill').style.width = Math.round(p * 100) + '%'; if (msg) $('loadMsg').textContent = msg; }
function showLoading(on) { $('loading').classList.toggle('hidden', !on); }

// ---------------------------------------------------------------- scène de présentation (avatar)
function makeStage() {
  const g = new THREE.Group(); g.position.set(0, 0, 0);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshStandardMaterial({ color: '#c47a45', roughness: 1 }));
  disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true; g.add(disc);
  scene.add(g); G.stage = { group: g, char: null, av: null };
  scene.background = new THREE.Color('#f0cf9b');
}
function stageSet(av) {
  const s = G.stage; if (s.char) { s.group.remove(s.char.group); }
  s.av = av; s.char = buildCharacter(avatarSpec(av)); s.char.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  s.group.add(s.char.group);
}
function dropStage() { if (G.stage) { scene.remove(G.stage.group); G.stage = null; } scene.background = null; }

// ---------------------------------------------------------------- inscription
const OUTFITS_M = [['tshirt', 'T-shirt'], ['chemise', 'Chemise'], ['boubou', 'Boubou']];
const OUTFITS_F = [['pagne', 'Pagne'], ['boubou_f', 'Boubou'], ['blouse', 'Blouse']];
const HEADS = [['aucun', 'Rien'], ['foulard', 'Foulard'], ['foulard_blanc', 'Foulard blanc'], ['bonnet', 'Bonnet'], ['kufi', 'Kufi'], ['casquette', 'Casquette'], ['chapeau', 'Chapeau']];
const HAIRS = [['court', 'Court'], ['afro', 'Afro'], ['tresses', 'Tresses'], ['aucun', 'Rasé']];
const PALS = [['#c0392b', '#f1c40f'], ['#1f6fb2', '#f4d03f'], ['#1e8f5a', '#f7e9a8'], ['#8e44ad', '#f1c40f'], ['#e67e22', '#2c3e50'], ['#d81b60', '#ffd54f']];

const reg = { name: '', phone: '', langs: [], quartier: null, consent: false, av: { gender: 'f', skin: 3, outfit: 'pagne', color: 0, pattern: 1, head: 'foulard', hair: 'tresses' } };
function ob(html) { $('obPanel').innerHTML = html; $('onboard').classList.remove('hidden'); $('obPanel').scrollTop = 0; }
const obHide = () => $('onboard').classList.add('hidden');

function stepIdentity(err = '') {
  const C = G.content;
  ob(`<h1>Kan</h1><p class="lead">Visite ton quartier de Ouagadougou et aide ta langue à entrer dans l'intelligence artificielle.</p>
  ${err ? `<p style="color:#ff9a8f;font-weight:600">${esc(err)}</p>` : ''}
  <div class="field"><label>Ton prénom ou pseudo</label><input type="text" id="fName" maxlength="30" autocomplete="nickname" value="${esc(reg.name)}"></div>
  <div class="field"><label>Ton numéro de téléphone (il ne sera pas vérifié)</label><input type="tel" id="fPhone" inputmode="tel" placeholder="+226 70 00 00 00" value="${esc(reg.phone)}"></div>
  <div class="field"><label>Tu parles… (au moins une langue)</label><div class="chips">${C.languages.map(l => `<button class="chip ${reg.langs.includes(l.code) ? 'on' : ''}" data-lang="${l.code}">${esc(l.name)}</button>`).join('')}</div></div>
  <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--mut);margin:14px 0;line-height:1.4"><input type="checkbox" id="fConsent" ${reg.consent ? 'checked' : ''} style="width:22px;height:22px;flex:none;margin-top:2px">
  <span>J'accepte que mes traductions écrites et mes enregistrements de voix soient conservés et utilisés pour construire des outils de langue (IA) pour le mooré et le dioula.</span></label>
  <button class="btn" id="obNext" style="width:100%">Continuer</button>`);
  document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { const c = b.dataset.lang; reg.langs = reg.langs.includes(c) ? reg.langs.filter(x => x !== c) : [...reg.langs, c]; b.classList.toggle('on'); });
  $('obNext').onclick = () => {
    reg.name = $('fName').value.trim(); reg.phone = $('fPhone').value.trim(); reg.consent = $('fConsent').checked;
    if (reg.name.length < 2) return stepIdentity('Écris ton prénom.');
    if (reg.phone.replace(/\D/g, '').length < 8) return stepIdentity('Numéro invalide.');
    if (!reg.langs.length) return stepIdentity('Choisis au moins une langue.');
    if (!reg.consent) return stepIdentity('Accepte les conditions pour jouer.');
    stepAvatar();
  };
}

function stepAvatar() {
  const av = reg.av, fem = av.gender === 'f';
  const row = (title, items, key, fmt) => `<div class="field"><label>${title}</label><div class="chips">${items.map(([v, l]) => `<button class="chip ${av[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  ob(`<h2>Ton personnage</h2>
  <div class="field"><div class="chips">${[['f', 'Femme'], ['m', 'Homme']].map(([v, l]) => `<button class="chip ${av.gender === v ? 'on' : ''}" data-k="gender" data-v="${v}">${l}</button>`).join('')}</div></div>
  <div class="field"><label>Teint</label><div class="swatches">${SKINS.map((c, i) => `<button class="sw ${av.skin === i ? 'on' : ''}" style="background:${c}" data-k="skin" data-n="${i}"></button>`).join('')}</div></div>
  ${row('Tenue', fem ? OUTFITS_F : OUTFITS_M, 'outfit')}
  <div class="field"><label>Couleurs</label><div class="swatches">${PALS.map((p, i) => `<button class="sw ${av.color === i ? 'on' : ''}" style="background:linear-gradient(135deg,${p[0]} 50%,${p[1]} 50%)" data-k="color" data-n="${i}"></button>`).join('')}</div></div>
  <div class="field"><label>Motif</label><div class="chips">${[0, 1, 2, 3, 4].map(i => `<button class="chip ${av.pattern === i ? 'on' : ''}" data-k="pattern" data-n="${i}">${i + 1}</button>`).join('')}</div></div>
  ${row('Sur la tête', HEADS, 'head')}${row('Cheveux', HAIRS, 'hair')}
  <div class="row"><button class="btn ghost" id="obBack">Retour</button><button class="btn" id="obNext">Choisir mon quartier</button></div>`);
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k; av[k] = b.dataset.n !== undefined ? +b.dataset.n : b.dataset.v;
    if (k === 'gender') { av.outfit = av.gender === 'f' ? 'pagne' : 'boubou'; av.head = av.gender === 'f' ? 'foulard' : 'aucun'; av.hair = av.gender === 'f' ? 'tresses' : 'court'; }
    stageSet(av); const y = $('obPanel').scrollTop; stepAvatar(); $('obPanel').scrollTop = y;
  });
  $('obBack').onclick = () => stepIdentity(); $('obNext').onclick = () => stepQuartier();
  if (!G.stage.char || G.stage.av !== av) stageSet(av);
}

function stepQuartier(err = '') {
  const C = G.content, real = G.realMaps || {};
  if (!reg.quartier) reg.quartier = C.quartiers[0].id;
  ob(`<h2>Où habites-tu ?</h2><p class="lead">Choisis ton quartier de Ouagadougou. Tu commences chez toi.</p>
  ${err ? `<p style="color:#ff9a8f;font-weight:600">${esc(err)}</p>` : ''}
  <div class="qgrid">${C.quartiers.map(q => `<button class="qcard ${reg.quartier === q.id ? 'on' : ''}" data-q="${q.id}"><b>${esc(q.name)}</b><span>${esc(q.tagline)}</span><em>${real[q.id] ? 'Carte réelle ✓' : 'Plan stylisé'}</em></button>`).join('')}</div>
  <div class="row" style="margin-top:14px"><button class="btn ghost" id="obBack">Retour</button><button class="btn green" id="obNext">C'est parti !</button></div>`);
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { reg.quartier = b.dataset.q; document.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === b)); });
  $('obBack').onclick = () => stepAvatar();
  $('obNext').onclick = async () => {
    $('obNext').disabled = true;
    try {
      const r = await Api.register({ name: reg.name, phone: reg.phone, langs: reg.langs, quartier: reg.quartier, consent: true, avatar: reg.av, ref: +(qs.get('ref') || LS.get('kan.ref') || 0) || undefined });
      Api.setToken(r.token); G.user = r.user; obHide(); dropStage(); await enterGame();
    } catch (e) { stepQuartier(e.message); }
  };
}

// ---------------------------------------------------------------- entrée dans le jeu
async function enterGame(quartierId) {
  const u = G.user, C = G.content;
  const q = C.quartiers.find(x => x.id === (quartierId || u.quartier)) || C.quartiers[0];
  G.mode = 'boot'; G.mission = null; clearBeacon();
  $('hud').classList.add('hidden'); showLoading(true); progress(0, 'Chargement de ' + q.name + '…');
  await world.build(q, C, progress);
  G.quartier = q;
  // joueur
  if (G.player) scene.remove(G.player.group);
  G.player = buildCharacter(avatarSpec(u.avatar || {}));
  G.player.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(G.player.group);
  const sp = world.anchors.spawn || { x: 0, z: 0, ry: 0 };
  G.pos.set(sp.x, 0, sp.z); G.ry = sp.ry || 0; G.cam.yaw = G.ry; G.speed = 0;
  G.mini = world.minimapStatic(280);
  $('chipName').textContent = u.name; setPoints(u.points || 0);
  $('chipDot').style.background = '#1b9a48';
  showLoading(false); $('hud').classList.remove('hidden'); G.mode = 'play';
  if (!LS.get('kan.seenIntro')) { LS.set('kan.seenIntro', '1'); introSheet(); } else toast('Bienvenue à ' + q.name + ' !');
}

function introSheet() {
  openSheet(`<h2>Bienvenue chez Yaaba 👵🏾</h2>
  <p class="lead">Yaaba, ta grand-mère, ne parle que la langue du pays. Tu es son interprète : on te dit une phrase en français, tu la traduis dans ta langue.<br><br>
  🕹️ Bouge avec le joystick (ou les flèches), tourne la caméra en glissant. Approche-toi d'une personne et appuie sur <b>Parler</b>.</p>
  <button class="btn green" id="goMissions" style="width:100%">Voir les missions</button>`);
  $('goMissions').onclick = missionBoard;
}

// ---------------------------------------------------------------- missions
function zoneOfMission(m) { return G.content.zones[m.zone]; }
function missionBoard(tab) {
  const C = G.content, zones = Object.keys(C.zones);
  tab = typeof tab === 'string' ? tab : (G.tab || 'quartier'); G.tab = tab;
  const list = C.missions.filter(m => m.zone === tab);
  openSheet(`<h2>Missions</h2><div class="tabs">${zones.map(z => `<button class="chip ${z === tab ? 'on' : ''}" data-tab="${z}">${C.zones[z].icon} ${esc(C.zones[z].name)}</button>`).join('')}</div>
  ${list.map(m => `<button class="mission ${G.done.has(m.id) ? 'done' : ''} ${G.mission?.id === m.id ? 'cur' : ''}" data-m="${m.id}"><div class="ic">${G.done.has(m.id) ? '✅' : zoneOfMission(m).icon}</div><div><b>${esc(m.title)}</b><span>${esc(m.summary)}</span></div><div class="rw">+${m.reward || 0}⭐</div></button>`).join('') || '<p class="lead">Rien ici pour le moment.</p>'}
  <button class="btn ghost" id="shClose" style="width:100%;margin-top:6px">Fermer</button>`);
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => missionBoard(b.dataset.tab));
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => startMission(b.dataset.m));
  $('shClose').onclick = closeSheet;
}

function startMission(id) {
  const m = G.content.missions.find(x => x.id === id); if (!m) return;
  G.mission = m; G.step = 0; closeSheet(); updateObjective();
  const z = G.content.zones[m.zone];
  toast(`${z.icon} ${m.title}`);
}
function currentTargetNpc() { if (!G.mission) return null; return world.npcs.get(G.mission.steps[G.step]?.npc) || null; }

function updateObjective() {
  const m = G.mission, o = $('objective');
  if (!m) { o.classList.add('hidden'); $('arrow').classList.add('hidden'); clearBeacon(); return; }
  const s = m.steps[G.step], n = world.npcs.get(s.npc);
  o.classList.remove('hidden');
  $('objTitle').textContent = `${m.title} · ${G.step + 1}/${m.steps.length}`;
  $('objText').textContent = n ? `Va voir ${n.def.name} (${n.def.role})` : 'Continue';
  setBeacon(n);
}
function setBeacon(n) {
  clearBeacon(); if (!n) return;
  const g = new THREE.Group();
  const col = new THREE.Color(G.content.zones[G.mission.zone].color);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 7; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.7, .95, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .06; g.add(ring);
  g.position.set(n.pos.x, 0, n.pos.z); scene.add(g); G.beacon = { g, ring, n };
}
function clearBeacon() { if (G.beacon) { scene.remove(G.beacon.g); G.beacon = null; } }

// ---------------------------------------------------------------- dialogues
let mic = null;
function stopMic(discard) { if (mic) { try { mic.rec.state !== 'inactive' && mic.rec.stop(); } catch {} mic.stream.getTracks().forEach(t => t.stop()); if (discard) mic.blob = null; clearInterval(mic.timer); mic = null; } }
function speakFr(text) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = .95; speechSynthesis.speak(u); } catch {} }

function talk() {
  if (G.busy || G.mode !== 'play') return;
  const n = world.nearestNpc(G.pos, 3.6); if (!n) return;
  const target = currentTargetNpc();
  if (G.mission && target && target.id === n.id) return translateDialog(n);
  // sinon : tâche d'écoute (valider les traductions des autres joueurs)
  listenDialog(n);
}

function faceNpc(n) {
  const dx = G.pos.x - n.pos.x, dz = G.pos.z - n.pos.z; n.char.group.rotation.y = Math.atan2(dx, dz);
  G.ry = Math.atan2(-dx, -dz);
}

function translateDialog(n) {
  const m = G.mission, s = m.steps[G.step], langs = G.user.langs;
  let lang = G.lang && langs.includes(G.lang) ? G.lang : langs[0], recorded = null;
  faceNpc(n); n.talking = true;
  const langName = c => G.content.languages.find(l => l.code === c)?.name || c;
  const micOk = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const body = openSheet(`<div style="font-size:13px;color:var(--mut)">${esc(n.def.name)} · ${esc(n.def.role)}</div>
  <div class="say">« ${esc(s.say)} »<button class="tts" id="tts">🔊</button></div>
  ${m.intro && G.step === 0 ? `<p class="lead" style="font-size:13.5px">${esc(m.intro)}</p>` : ''}
  ${langs.length > 1 ? `<div class="tabs">${langs.map(l => `<button class="chip ${l === lang ? 'on' : ''}" data-l="${l}">${esc(langName(l))}</button>`).join('')}</div>` : ''}
  <div class="field"><label>Traduis en ${esc(langName(lang))}</label><textarea id="tr" rows="3" placeholder="Écris la phrase en ${esc(langName(lang))}…"></textarea></div>
  ${micOk ? `<div class="row" style="margin-bottom:10px"><button class="btn ghost" id="micBtn">🎙️ Dire à voix haute</button><span id="micInfo" style="color:var(--mut);font-size:13px"></span></div>` : ''}
  <div class="row"><button class="btn ghost" id="skip">Passer</button><button class="btn green" id="send">Envoyer</button></div>`, { lock: true });
  const close = () => { n.talking = false; stopMic(true); };
  $('tts').onclick = () => speakFr(s.say);
  body.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { lang = G.lang = b.dataset.l; const txt = $('tr').value; translateDialogRedraw(); function translateDialogRedraw() { close(); translateDialog(n); setTimeout(() => $('tr').value = txt, 0); } });
  $('skip').onclick = () => { close(); closeSheet(); advance(false); };
  if (micOk) $('micBtn').onclick = async () => {
    const btn = $('micBtn'), info = $('micInfo');
    if (mic?.rec?.state === 'recording') { mic.rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
      mic = { rec, stream, blob: null, t0: Date.now() };
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = () => { clearInterval(mic?.timer); stream.getTracks().forEach(t => t.stop()); recorded = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); if ($('micBtn')) { $('micBtn').textContent = '🎙️ Réécouter / refaire'; info.textContent = '✅ Voix enregistrée'; } mic = null; };
      rec.start(); btn.textContent = '⏹️ Arrêter'; mic.timer = setInterval(() => { const t = (Date.now() - mic.t0) / 1000; info.textContent = '● ' + t.toFixed(0) + ' s'; if (t > 25) rec.stop(); }, 300);
    } catch (e) { info.textContent = 'Micro indisponible (il faut HTTPS et ton accord).'; }
  };
  $('send').onclick = async () => {
    const text = $('tr').value.trim();
    if (text.length < 2) return toast('Écris ta traduction.');
    $('send').disabled = true;
    if (mic?.rec?.state === 'recording') { mic.rec.stop(); await sleep(250); }
    try {
      const r = await Api.translate(s.key, lang, text); let pts = r.points_awarded || 0;
      if (recorded) { try { const a = await Api.uploadAudio(r.id, recorded); pts += a.points_awarded || 0; } catch (e) { toast('Voix non envoyée : ' + e.message); } }
      addPoints(pts); clip.setCaption(s.say, text, langName(lang));
      close(); closeSheet(); toast(pts ? `Merci ! +${pts}⭐` : 'Merci, traduction mise à jour'); advance(true);
    } catch (e) { $('send').disabled = false; toast(e.message, 3500); }
  };
}

async function advance() {
  const m = G.mission; if (!m) return;
  G.step++;
  if (G.step >= m.steps.length) return finishMission(m);
  updateObjective();
}

async function finishMission(m) {
  G.mission = null; updateObjective();
  let r = { points_awarded: 0 };
  try { r = await Api.complete(m.id, m.reward); } catch {}
  const first = !G.done.has(m.id); G.done.add(m.id);
  if (r.points != null) setPoints(r.points); else addPoints(r.points_awarded || 0);
  confetti();
  const next = G.content.missions.find(x => !G.done.has(x.id) && x.id !== 'flash');
  openSheet(`<div style="text-align:center"><div style="font-size:54px">🎉</div><h2>Mission réussie !</h2><p class="lead">${esc(m.title)}${first && r.points_awarded ? ` · <b style="color:var(--gold)">+${r.points_awarded}⭐</b>` : ''}</p></div>
  <div class="row"><button class="btn ghost" id="mClip">🎬 Faire un clip</button><button class="btn green" id="mNext">${next ? 'Mission suivante' : 'Missions'}</button></div>`);
  $('mClip').onclick = () => { closeSheet(); clipSheet(); };
  $('mNext').onclick = () => missionBoard(next?.zone || G.tab);
}

// ---- écoute / validation par les autres joueurs
async function listenDialog(n) {
  G.busy = true; faceNpc(n);
  const zone = world.zoneAt(G.pos.x, G.pos.z)?.key || 'quartier';
  const task = await Api.listen(zone); G.busy = false;
  if (!task) {
    const lines = ['Bonjour ! Fais une mission pour m\'aider.', 'Il fait chaud aujourd\'hui, hein ?', 'Le Burkina avance, courage !'];
    return toast(`${n.def.name} : « ${lines[Math.floor(Math.random() * lines.length)]} »`, 3200);
  }
  n.talking = true;
  const langName = G.content.languages.find(l => l.code === task.lang)?.name || task.lang;
  const body = openSheet(`<div style="font-size:13px;color:var(--mut)">${esc(n.def.name)} · ${esc(n.def.role)}</div>
  <div class="say local"><span class="lang">${esc(langName)}</span>« ${esc(task.text)} »${task.audio_url ? '<button class="tts" id="play">▶️</button>' : ''}</div>
  <p class="lead" style="margin-bottom:4px">Un autre joueur a écrit ça. Qu'est-ce que ça veut dire ?</p>
  <div class="opts">${task.options.map(o => `<button class="opt" data-p="${o.prompt_id}">${esc(o.text)}</button>`).join('')}</div>
  <div class="row"><button class="btn ghost" id="flag">🚩 Ce n'est pas du ${esc(langName)}</button><button class="btn ghost" id="shClose">Fermer</button></div>`, { lock: true });
  let url = null;
  if ($('play')) $('play').onclick = async () => { try { url = url || await Api.audioBlobUrl(task.audio_url); new Audio(url).play(); } catch { toast('Audio indisponible'); } };
  const done = async (chosen, flagged) => {
    body.querySelectorAll('.opt,#flag').forEach(b => b.disabled = true);
    try {
      const r = await Api.answer(task.translation_id, chosen, flagged); addPoints(r.points_awarded);
      body.querySelectorAll('.opt').forEach(b => { const ok = r.correct_text && b.textContent === r.correct_text; if (ok) b.classList.add('good'); else if (+b.dataset.p === chosen) b.classList.add('bad'); });
      toast(flagged ? 'Merci, signalé.' : r.correct ? `Bravo ! +${r.points_awarded}⭐` : `C'était : ${r.correct_text}`, 2600);
      await sleep(1500);
    } catch (e) { toast(e.message); }
    n.talking = false; closeSheet();
  };
  body.querySelectorAll('.opt').forEach(b => b.onclick = () => done(+b.dataset.p, false));
  $('flag').onclick = () => done(0, true);
  $('shClose').onclick = () => { n.talking = false; closeSheet(); };
}

// ---------------------------------------------------------------- menu
async function menu() {
  let me = null; try { me = await Api.me(); } catch {}
  let lb = []; try { lb = await Api.leaderboard(); } catch {}
  const st = me?.stats || {}, u = G.user;
  const link = location.origin + '/?ref=' + u.id;
  openSheet(`<h2>${esc(u.name)}</h2>
  <div class="stat"><div><b>${u.points || 0}</b><span>Points</span></div><div><b>${st.translations ?? 0}</b><span>Traductions</span></div><div><b>${st.validated ?? 0}</b><span>Validées</span></div></div>
  <div class="stat"><div><b>${st.voice ?? 0}</b><span>Voix</span></div><div><b>#${st.rank ?? '-'}</b><span>Rang</span></div><div><b>${st.listen_correct ?? 0}/${st.listen_total ?? 0}</b><span>Écoute</span></div></div>
  <h2 style="font-size:17px;margin-top:14px">🏆 Classement</h2>
  ${lb.slice(0, 8).map((r, i) => `<div class="lb"><b>${i + 1}</b><span>${esc(r.name)}</span><span>⭐ ${r.points}</span></div>`).join('') || '<p class="lead">Pas encore de joueurs.</p>'}
  <div class="row" style="margin-top:14px"><button class="btn ghost" id="mInv">📨 Inviter</button><button class="btn ghost" id="mQ">🏘️ Changer de quartier</button></div>
  <div class="row" style="margin-top:8px"><button class="btn ghost" id="mOut">Se déconnecter</button><button class="btn" id="shClose">Fermer</button></div>`);
  $('shClose').onclick = closeSheet;
  $('mInv').onclick = async () => { const data = { title: 'Kan', text: 'Viens jouer à Kan, visite ton quartier du Burkina et parle ta langue !', url: link }; try { navigator.share ? await navigator.share(data) : (await navigator.clipboard.writeText(link), toast('Lien copié')); } catch {} };
  $('mQ').onclick = () => {
    const C = G.content;
    openSheet(`<h2>Changer de quartier</h2><div class="qgrid">${C.quartiers.map(q => `<button class="qcard ${G.quartier?.id === q.id ? 'on' : ''}" data-q="${q.id}"><b>${esc(q.name)}</b><span>${esc(q.tagline)}</span><em>${(G.realMaps || {})[q.id] ? 'Carte réelle ✓' : 'Plan stylisé'}</em></button>`).join('')}</div>`);
    document.querySelectorAll('[data-q]').forEach(b => b.onclick = async () => { closeSheet(); G.user.quartier = b.dataset.q; await enterGame(b.dataset.q); });
  };
  $('mOut').onclick = () => { Api.setToken(''); location.href = '/'; };
}

// ---------------------------------------------------------------- clip
const clip = new ClipRecorder(renderer.domElement, () => ({ quartier: G.quartier ? G.quartier.name + ', Ouagadougou' : 'Burkina Faso', host: location.host }));
function clipSheet() {
  if (!ClipRecorder.supported()) return openSheet(`<h2>Clip indisponible</h2><p class="lead">Ton navigateur ne sait pas enregistrer la vidéo. Essaie Chrome.</p><button class="btn" id="shClose" style="width:100%">Fermer</button>`), $('shClose').onclick = closeSheet;
  openSheet(`<h2>🎬 Clip de 30 s</h2><p class="lead">On enregistre ton aventure en vidéo verticale (30 secondes max), avec tes traductions en sous-titres. À la fin, un message invite tes amis à créer leur compte et jouer.</p>
  <div class="row"><button class="btn ghost" id="shClose">Annuler</button><button class="btn red" id="cGo">● Enregistrer</button></div>`);
  $('shClose').onclick = closeSheet;
  $('cGo').onclick = () => {
    closeSheet();
    const ok = clip.start((blob, type) => { $('rec').classList.add('hidden'); clipDone(blob, type); });
    if (!ok) return toast('Enregistrement impossible sur cet appareil.');
    $('rec').classList.remove('hidden');
  };
}
$('recStop').onclick = () => clip.stop();
function clipDone(blob, type) {
  const ext = type.includes('mp4') ? 'mp4' : 'webm', file = new File([blob], `kan-${Date.now()}.${ext}`, { type: type.split(';')[0] });
  const url = URL.createObjectURL(blob);
  openSheet(`<h2>Ton clip est prêt 🎉</h2><video class="preview" src="${url}" controls playsinline loop autoplay muted></video>
  <div class="row" style="margin-top:12px"><button class="btn ghost" id="dl">⬇️ Télécharger</button><button class="btn green" id="sh">📤 Partager</button></div>
  <button class="btn ghost" id="shClose" style="width:100%;margin-top:8px">Fermer</button>`);
  $('shClose').onclick = closeSheet;
  $('dl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); };
  $('sh').onclick = async () => {
    const data = { files: [file], title: 'Kan', text: `Je joue à Kan ! Crée ton compte et joue : ${location.origin}` };
    try { if (navigator.canShare?.(data)) await navigator.share(data); else if (navigator.share) await navigator.share({ title: 'Kan', text: data.text, url: location.origin }); else $('dl').click(); } catch {}
  };
}

// ---------------------------------------------------------------- contrôles
const dock = { missions: $('btnMissions'), clip: $('btnClip'), menu: $('btnMenu') };
dock.missions.onclick = () => G.mode === 'play' && missionBoard();
dock.clip.onclick = () => G.mode === 'play' && (clip.state === 'idle' ? clipSheet() : clip.stop());
dock.menu.onclick = () => G.mode === 'play' && menu();
$('btnTalk').onclick = talk;
sheet.addEventListener('pointerdown', e => { if (e.target === sheet && !sheet.dataset.lock) closeSheet(); });
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'z', 'q', 'shift'].includes(k)) { G.keys.add(k); e.preventDefault(); }
  if ((k === 'e' || k === ' ' || k === 'enter') && !e.repeat && sheet.classList.contains('hidden')) { talk(); e.preventDefault(); }
  if (k === 'escape') closeSheet();
});
addEventListener('keyup', e => G.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => G.keys.clear());

// joystick
{
  const joy = $('joy'), stick = $('stick'); let id = null;
  const set = e => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 - 8;
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    stick.style.transform = `translate(${dx}px,${dy}px)`; G.joy.x = dx / R; G.joy.y = dy / R;
  };
  joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); set(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; stick.style.transform = ''; G.joy.x = G.joy.y = 0; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
}
// caméra : glisser sur la scène
{
  const pts = new Map(); let pd = 0;
  canvas.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); G.cam.dist = THREE.MathUtils.clamp(G.cam.dist - (d - pd) * .02, 3, 12); pd = d; return; }
    G.cam.yaw -= dx * .006; G.cam.pitch = THREE.MathUtils.clamp(G.cam.pitch + dy * .004, .08, 1.15);
  });
  const up = e => pts.delete(e.pointerId); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { G.cam.dist = THREE.MathUtils.clamp(G.cam.dist + e.deltaY * .005, 3, 12); }, { passive: true });
}

// ---------------------------------------------------------------- boucle
let _last = performance.now(); const _v = new THREE.Vector3();
function updatePlay(dt) {
  const k = G.keys; let ix = G.joy.x, iy = G.joy.y;
  if (k.has('arrowleft') || k.has('a') || k.has('q')) ix -= 1; if (k.has('arrowright') || k.has('d')) ix += 1;
  if (k.has('arrowup') || k.has('w') || k.has('z')) iy -= 1; if (k.has('arrowdown') || k.has('s')) iy += 1;
  const mag = Math.min(1, Math.hypot(ix, iy)), locked = !sheet.classList.contains('hidden');
  if (mag > .08 && !locked) {
    // direction caméra → monde
    const fx = -Math.sin(G.cam.yaw), fz = -Math.cos(G.cam.yaw), rx = -fz, rz = fx;
    let dx = rx * ix + fx * -iy, dz = rz * ix + fz * -iy; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const sp = (k.has('shift') ? 6.4 : 4.1) * mag; G.speed = sp;
    G.pos.x += dx * sp * dt; G.pos.z += dz * sp * dt;
    const target = Math.atan2(dx, dz); let d = target - G.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); G.ry += d * Math.min(1, dt * 12);
  } else G.speed *= .8;
  world.resolve(G.pos, .38);
  G.pos.x = THREE.MathUtils.clamp(G.pos.x, -HALF + 2, HALF - 2); G.pos.z = THREE.MathUtils.clamp(G.pos.z, -HALF + 2, HALF - 2);
  const pg = G.player.group; pg.position.set(G.pos.x, 0, G.pos.z); pg.rotation.y = G.ry;
  G.player.update(dt, { speed: G.speed < .3 ? 0 : G.speed, t: G.t, cheering: world.cheer && G.zoneKey === 'meeting' });
  // caméra
  const c = G.cam, ty = 1.5; let dist = c.dist;
  const cp = c.pitch, hx = Math.sin(c.yaw) * Math.cos(cp), hz = Math.cos(c.yaw) * Math.cos(cp), hy = Math.sin(cp);
  while (dist > 1.6 && ((world._insideCollider(G.pos.x + hx * dist, G.pos.z + hz * dist, .3) && ty + hy * dist < 7) || world.inCrown(G.pos.x + hx * dist, G.pos.z + hz * dist, ty + hy * dist))) dist -= .5;
  const want = _v.set(G.pos.x + hx * dist, Math.max(.5, ty + hy * dist), G.pos.z + hz * dist);
  camera.position.lerp(want, Math.min(1, dt * 14)); camera.lookAt(G.pos.x, ty, G.pos.z);
  // zones
  const z = world.zoneAt(G.pos.x, G.pos.z), key = z?.key || null;
  if (key !== G.zoneKey) {
    G.zoneKey = key; const zn = $('zoneName');
    if (key) { const Z = G.content.zones[key]; zn.textContent = `${Z.icon} ${Z.name}`; zn.classList.add('show'); setTimeout(() => zn.classList.remove('show'), 3000); } else zn.classList.remove('show');
    world.cheer = key === 'meeting';
  }
  // bouton parler
  const near = world.nearestNpc(G.pos, 3.6), bt = $('btnTalk');
  if (near && sheet.classList.contains('hidden')) {
    const tg = currentTargetNpc();
    $('talkLabel').textContent = tg && tg.id === near.id ? 'Traduire' : 'Écouter ' + near.def.name.split(' ')[0];
    bt.classList.remove('hidden');
  } else bt.classList.add('hidden');
  // balise + flèche
  const tg = currentTargetNpc();
  if (G.beacon) { G.beacon.ring.scale.setScalar(1 + Math.sin(G.t * 4) * .15); G.beacon.g.position.set(G.beacon.n.pos.x, 0, G.beacon.n.pos.z); }
  const ar = $('arrow');
  if (tg) {
    const dx = tg.pos.x - G.pos.x, dz = tg.pos.z - G.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 5) { const ang = Math.atan2(dx, dz) - (G.cam.yaw + Math.PI); ar.classList.remove('hidden'); ar.querySelector('i').style.transform = `rotate(${(-ang * 180 / Math.PI + 180) % 360}deg)`; $('arrowDist').textContent = Math.round(dd) + ' m'; } else ar.classList.add('hidden');
  } else ar.classList.add('hidden');
  drawMini(tg);
  // recording UI
  if (clip.state !== 'idle') { const e = clip.elapsed; $('recTime').textContent = `0:${String(Math.min(30, Math.floor(e))).padStart(2, '0')}`; }
}

const mc = $('miniCanvas'), mg = mc.getContext('2d');
function drawMini(tg) {
  const S = mc.width, s = G.mini.scale, o = S / 2;
  mg.clearRect(0, 0, S, S); mg.save();
  // la carte tourne avec la caméra, centrée sur le joueur (zoom ×2.2)
  const z = 2.2; mg.translate(S / 2, S / 2); mg.rotate(G.cam.yaw + Math.PI); mg.scale(z, z); mg.translate(-(o + G.pos.x * s), -(o + G.pos.z * s));
  mg.drawImage(G.mini, 0, 0);
  if (tg) { mg.fillStyle = '#ffd33d'; mg.strokeStyle = '#000'; mg.lineWidth = 1; mg.beginPath(); mg.arc(o + tg.pos.x * s, o + tg.pos.z * s, 4, 0, 7); mg.fill(); mg.stroke(); }
  mg.restore();
  mg.fillStyle = '#fff'; mg.strokeStyle = '#1b9a48'; mg.lineWidth = 3; mg.beginPath();
  mg.moveTo(S / 2, S / 2 - 12); mg.lineTo(S / 2 + 9, S / 2 + 9); mg.lineTo(S / 2, S / 2 + 4); mg.lineTo(S / 2 - 9, S / 2 + 9); mg.closePath(); mg.fill(); mg.stroke();
}

function updateStage(dt) {
  const s = G.stage; if (!s?.char) return;
  s.char.group.rotation.y += dt * .6; s.char.update(dt, { speed: 0, t: G.t });
  camera.position.set(0, 1.25, 2.9); camera.lookAt(0, .2, 0);
  world.sky.position.set(0, 0, 0);
}

function loop() {
  requestAnimationFrame(loop);
  const _n = performance.now(); const dt = Math.min((_n - _last) / 1000, .05); _last = _n; G.t += dt;
  if (G.mode === 'play') { updatePlay(dt); world.update(dt, G.t, G.pos); }
  else if (G.mode === 'stage') updateStage(dt);
  else return;
  renderer.render(scene, camera);
  clip.capture();
}
loop();

// ---------------------------------------------------------------- démarrage
(async function boot() {
  try {
    progress(.1, 'Connexion…');
    G.content = await Api.content();
    try { const t = await Promise.all(G.content.quartiers.map(q => fetch(`/data/quartiers/${q.id}.json`, { method: 'HEAD' }).then(r => [q.id, r.ok && !(r.headers.get('content-type') || '').includes('html')]))); G.realMaps = Object.fromEntries(t); } catch { G.realMaps = {}; }
    if (qs.get('ref')) LS.set('kan.ref', qs.get('ref'));
    progress(.4, 'Prêt');
    // mode test sans inscription
    if (qs.get('demo') === '1') {
      Api.demo = true; const q = qs.get('q') || G.content.quartiers[0].id;
      G.user = { id: 0, name: 'Testeur', langs: ['moore', 'dioula'], quartier: q, avatar: { gender: qs.get('g') || 'f', skin: 3, outfit: qs.get('g') === 'm' ? 'boubou' : 'pagne', color: 1, pattern: 2, head: qs.get('g') === 'm' ? 'aucun' : 'foulard', hair: 'tresses' }, points: 0 };
      await enterGame(q); return;
    }
    if (Api.token) {
      try { const me = await Api.me(); G.user = me.user; G.done = new Set(me.missions_done); await enterGame(); return; }
      catch (e) { if (e.status === 401) Api.setToken(''); else throw e; }
    }
    showLoading(false); G.mode = 'stage'; makeStage(); stepIdentity();
  } catch (e) {
    console.error(e); $('loadMsg').textContent = 'Erreur : ' + e.message; $('barFill').style.background = '#d6232a';
  }
})();
addEventListener('error', e => { if (G.mode === 'boot') $('loadMsg').textContent = 'Erreur : ' + e.message; });
