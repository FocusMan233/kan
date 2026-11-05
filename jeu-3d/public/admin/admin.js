const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let TOKEN = sessionStorage.getItem('kan.admin') || '';
const ZONES = { quartier: 'Quartier', sante: 'Santé', meeting: 'Meeting', culture: 'Culture' };
const LANGS = { moore: 'Mooré', dioula: 'Dioula' };

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { TOKEN = ''; sessionStorage.removeItem('kan.admin'); showLogin(); throw new Error('Session expirée'); }
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status); return j;
}
function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
$('#lf').onsubmit = async e => {
  e.preventDefault();
  try { const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); TOKEN = j.token; sessionStorage.setItem('kan.admin', TOKEN); start(); }
  catch (er) { $('#lerr').textContent = er.message; }
};
$('#out').onclick = () => { TOKEN = ''; sessionStorage.removeItem('kan.admin'); location.reload(); };

const TABS = [['overview', 'Vue d\'ensemble'], ['translations', 'Traductions'], ['prompts', 'Phrases'], ['players', 'Joueurs'], ['keys', 'API de langue'], ['export', 'Export']];
let tab = 'overview';
function start() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#nav').innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('');
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { tab = b.dataset.t; start(); });
  VIEWS[tab]().catch(e => { $('#main').innerHTML = `<p class="mut">${esc(e.message)}</p>`; });
}
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden'); }
const closeModal = () => $('#modal').classList.add('hidden');
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const VIEWS = {
  async overview() {
    const o = await api('GET', '/api/admin/overview'), t = o.totals;
    const cards = [['players', 'Joueurs'], ['translations', 'Traductions'], ['validated', 'Validées'], ['pending', 'En attente'], ['rejected', 'Rejetées'], ['voice', 'Avec voix'], ['votes', 'Votes'], ['to_review', 'Santé à relire']];
    const max = Math.max(1, ...o.per_day.map(d => d.n));
    $('#main').innerHTML = `<div class="cards">${cards.map(([k, l]) => `<div class="card"><b>${t[k] ?? 0}</b><span>${l}</span></div>`).join('')}</div>
    <div class="grid2">
      <div class="box2"><h3>Par langue</h3>${o.by_lang.map(r => `<div class="bar"><span>${LANGS[r.lang] || r.lang}</span><i><u style="width:${pct(r.validated, r.total)}%"></u></i><span>${r.validated}/${r.total}</span></div>`).join('') || '<span class="mut">Aucune donnée</span>'}<p class="mut" style="font-size:12px">Vert = validées. Voix : ${o.by_lang.map(r => `${LANGS[r.lang] || r.lang} ${r.voice}`).join(' · ')}</p></div>
      <div class="box2"><h3>Par zone</h3>${o.by_zone.map(r => `<div class="bar"><span>${ZONES[r.zone] || r.zone}</span><i><u style="width:${pct(r.validated, r.total)}%"></u></i><span>${r.validated}/${r.total}</span></div>`).join('') || '<span class="mut">Aucune donnée</span>'}</div>
      <div class="box2"><h3>Traductions par jour (14 j)</h3><div class="days">${o.per_day.map(d => `<div style="height:${Math.max(3, d.n / max * 100)}%"><span>${d.n}</span></div>`).join('') || '<span class="mut">Aucune donnée</span>'}</div></div>
      <div class="box2"><h3>Phrases les moins traduites</h3>${o.coverage.map(c => `<div style="padding:4px 0;border-bottom:1px solid var(--b)"><span class="tag">${ZONES[c.zone]}</span> ${esc(c.text_fr)} <span class="mut">(${c.n})</span></div>`).join('')}</div>
    </div>
    <p class="mut">Règle de validation : ${o.config.min_votes} votes minimum, ${Math.round(o.config.yes_ratio * 100)} % de oui. Les phrases de santé ne sortent dans l'API qu'après ton approbation.</p>`;
  },

  async translations(state = {}) {
    const f = { q: '', lang: '', status: '', zone: '', voice: '', review: '', offset: 0, ...state };
    const params = new URLSearchParams({ limit: 30 }); for (const k of ['q', 'lang', 'status', 'zone', 'voice', 'review', 'offset']) if (f[k]) params.set(k, f[k]);
    const d = await api('GET', '/api/admin/translations?' + params);
    const sel = (k, opts) => `<select data-f="${k}"><option value="">${opts[0]}</option>${opts.slice(1).map(([v, l]) => `<option value="${v}" ${f[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    $('#main').innerHTML = `<div class="filters"><input data-f="q" placeholder="Recherche…" value="${esc(f.q)}">
      ${sel('lang', ['Langue', ...Object.entries(LANGS)])}${sel('status', ['Statut', ['pending', 'En attente'], ['validated', 'Validée'], ['rejected', 'Rejetée']])}${sel('zone', ['Zone', ...Object.entries(ZONES)])}
      ${sel('voice', ['Voix ?', ['1', 'Avec voix']])}${sel('review', ['Relecture', ['1', 'Santé à relire']])}<button class="btn ghost" id="add">+ Ajouter</button></div>
    <table><tr><th>#</th><th>Français</th><th>Traduction</th><th>Statut</th><th>Joueur</th><th>Actions</th></tr>${d.rows.map(r => `<tr>
      <td>${r.id}</td><td class="fr">${esc(r.text_fr)}<br><span class="tag">${ZONES[r.zone]}</span>${r.sensitive ? ' <span class="tag w">santé</span>' : ''}${r.verify ? ' <span class="tag w">à vérifier</span>' : ''}</td>
      <td><span class="loc">${esc(r.text)}</span><br><span class="mut">${LANGS[r.lang] || r.lang}</span>${r.has_audio ? `<br><button class="btn s ghost" data-play="${r.id}">▶ voix</button>` : ''}</td>
      <td><span class="tag ${r.status}">${r.status}</span>${r.admin_status ? `<br><span class="tag">admin : ${r.admin_status}</span>` : ''}<br><span class="mut">👍${r.yes} 👎${r.no}</span></td>
      <td>${esc(r.user_name || (r.source === 'admin' ? 'admin' : '—'))}<br><span class="mut">${esc(r.quartier || '')}</span></td>
      <td><div class="act"><button class="btn s g" data-a="approved" data-id="${r.id}">✓</button><button class="btn s r" data-a="rejected" data-id="${r.id}">✗</button><button class="btn s ghost" data-edit="${r.id}">✎</button><button class="btn s ghost" data-del="${r.id}">🗑</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="mut">Aucune traduction.</td></tr>'}</table>
    <div class="pager"><button class="btn ghost s" id="prev" ${f.offset ? '' : 'disabled'}>◀</button><span class="mut">${f.offset + 1}–${Math.min(f.offset + 30, d.total)} sur ${d.total}</span><button class="btn ghost s" id="next" ${f.offset + 30 < d.total ? '' : 'disabled'}>▶</button></div>`;
    const reload = (extra = {}) => VIEWS.translations({ ...f, ...extra });
    document.querySelectorAll('[data-f]').forEach(el => el.onchange = () => reload({ [el.dataset.f]: el.value, offset: 0 }));
    $('#prev').onclick = () => reload({ offset: Math.max(0, f.offset - 30) }); $('#next').onclick = () => reload({ offset: f.offset + 30 });
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { await api('PATCH', '/api/admin/translations/' + b.dataset.id, { admin_status: b.dataset.a }); reload(); });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('Supprimer cette traduction ?')) { await api('DELETE', '/api/admin/translations/' + b.dataset.del); reload(); } });
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const r = d.rows.find(x => x.id == b.dataset.edit);
      modal(`<h3>Corriger la traduction #${r.id}</h3><div class="fr">${esc(r.text_fr)}</div><textarea id="et" rows="3">${esc(r.text)}</textarea><input id="en" placeholder="Note interne" value="${esc(r.admin_note || '')}"><div class="act"><button class="btn ghost" id="c">Annuler</button><button class="btn g" id="s">Enregistrer et approuver</button></div>`);
      $('#c').onclick = closeModal; $('#s').onclick = async () => { await api('PATCH', '/api/admin/translations/' + r.id, { text: $('#et').value, admin_note: $('#en').value, admin_status: 'approved' }); closeModal(); reload(); }; });
    document.querySelectorAll('[data-play]').forEach(b => b.onclick = () => new Audio(`/api/admin/audio/${b.dataset.play}?t=${TOKEN}`).play());
    $('#add').onclick = async () => {
      const ps = await api('GET', '/api/admin/prompts');
      modal(`<h3>Ajouter une traduction (référence)</h3><select id="ap">${ps.map(p => `<option value="${p.key}">${esc(p.text_fr.slice(0, 70))}</option>`).join('')}</select><select id="al">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><textarea id="at" rows="3" placeholder="Traduction"></textarea><div class="act"><button class="btn ghost" id="c">Annuler</button><button class="btn g" id="s">Ajouter (approuvée)</button></div>`);
      $('#c').onclick = closeModal; $('#s').onclick = async () => { try { await api('POST', '/api/admin/translations', { prompt_key: $('#ap').value, lang: $('#al').value, text: $('#at').value }); closeModal(); reload(); } catch (e) { alert(e.message); } };
    };
  },

  async prompts() {
    const ps = await api('GET', '/api/admin/prompts');
    $('#main').innerHTML = `<div class="filters"><button class="btn" id="np">+ Nouvelle phrase</button><button class="btn ghost" id="nn">📣 Nouveau « flash info »</button></div>
    <table><tr><th>#</th><th>Phrase (français)</th><th>Zone</th><th>Traductions</th><th>Drapeaux</th><th></th></tr>${ps.map(p => `<tr style="${p.active ? '' : 'opacity:.4'}"><td>${p.id}</td><td>${esc(p.text_fr)}${p.news ? ' <span class="tag">flash</span>' : ''}</td><td>${ZONES[p.zone]}</td><td>${p.validated}/${p.n}</td>
      <td><label><input type="checkbox" data-f="sensitive" data-id="${p.id}" ${p.sensitive ? 'checked' : ''}> santé</label><br><label><input type="checkbox" data-f="verify" data-id="${p.id}" ${p.verify ? 'checked' : ''}> à vérifier</label></td>
      <td><button class="btn s ghost" data-act="${p.id}" data-v="${p.active ? 0 : 1}">${p.active ? 'Désactiver' : 'Activer'}</button></td></tr>`).join('')}</table>`;
    document.querySelectorAll('[data-f]').forEach(c => c.onchange = async () => { await api('PATCH', '/api/admin/prompts/' + c.dataset.id, { [c.dataset.f]: c.checked }); });
    document.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { await api('PATCH', '/api/admin/prompts/' + b.dataset.act, { active: b.dataset.v === '1' }); VIEWS.prompts(); });
    const add = news => modal(`<h3>${news ? 'Nouveau flash info' : 'Nouvelle phrase'}</h3><p class="mut">${news ? 'Une bonne nouvelle vraie et positive sur le Burkina. Elle apparaît à la Place des bonnes nouvelles.' : 'Phrase en français que les joueurs traduiront.'}</p><textarea id="pt" rows="3"></textarea>
      ${news ? '' : `<select id="pz">${Object.entries(ZONES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><label><input type="checkbox" id="ps"> Santé (relecture avant export)</label>`}<label><input type="checkbox" id="pv" ${news ? 'checked' : ''}> À vérifier</label><div class="act"><button class="btn ghost" id="c">Annuler</button><button class="btn g" id="s">Créer</button></div>`);
    const go = news => { $('#c').onclick = closeModal; $('#s').onclick = async () => { try { await api('POST', '/api/admin/prompts', { text_fr: $('#pt').value, zone: news ? 'meeting' : $('#pz').value, sensitive: !news && $('#ps').checked, verify: $('#pv').checked, news }); closeModal(); VIEWS.prompts(); } catch (e) { alert(e.message); } }; };
    $('#np').onclick = () => { add(false); go(false); }; $('#nn').onclick = () => { add(true); go(true); };
  },

  async players() {
    const ps = await api('GET', '/api/admin/players');
    $('#main').innerHTML = `<p class="mut">${ps.length} joueurs. Les numéros ne sont pas vérifiés.</p><table><tr><th>#</th><th>Nom</th><th>Téléphone</th><th>Langues</th><th>Quartier</th><th>⭐</th><th>Trad.</th><th>Écoute</th></tr>${ps.map(p => `<tr><td>${p.id}</td><td>${esc(p.name)}</td><td>${esc(p.phone)}</td><td>${JSON.parse(p.langs || '[]').map(l => LANGS[l] || l).join(', ')}</td><td>${esc(p.quartier)}</td><td>${p.points}</td><td>${p.validated}/${p.translations}</td><td>${p.listen_correct}/${p.listen_total}</td></tr>`).join('')}</table>`;
  },

  async keys() {
    const ks = await api('GET', '/api/admin/keys'), o = location.origin;
    $('#main').innerHTML = `<div class="box2" style="margin-bottom:14px"><h3>API de langue — v1</h3><p>Chaque traduction validée par les joueurs alimente cette API. Crée une clé pour chaque partenaire (opérateur télécom, santé, doublage…).</p>
    <pre><code>curl -H "X-API-Key: kan_..." "${o}/api/v1/translate?text=Bonjour&amp;source=fr&amp;target=moore"
curl -H "X-API-Key: kan_..." "${o}/api/v1/pairs?target=dioula&amp;limit=100"
curl -H "X-API-Key: kan_..." "${o}/api/v1/export?format=jsonl&amp;lang=moore"
curl -H "X-API-Key: kan_..." "${o}/api/v1/languages"</code></pre></div>
    <div class="filters"><input id="kl" placeholder="Nom du partenaire"><button class="btn" id="kn">Créer une clé</button></div>
    <table><tr><th>Préfixe</th><th>Nom</th><th>Appels</th><th>Dernier</th><th>État</th><th></th></tr>${ks.map(k => `<tr><td><code>${esc(k.prefix)}…</code></td><td>${esc(k.label)}</td><td>${k.calls}</td><td>${esc(k.last_used || '—')}</td><td>${k.active ? 'active' : 'révoquée'}</td><td>${k.active ? `<button class="btn s r" data-rv="${k.id}">Révoquer</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">Aucune clé.</td></tr>'}</table>`;
    $('#kn').onclick = async () => { const r = await api('POST', '/api/admin/keys', { label: $('#kl').value }); modal(`<h3>Clé créée</h3><pre><code>${esc(r.key)}</code></pre><p class="mut">${esc(r.note)}</p><button class="btn" id="c">OK</button>`); $('#c').onclick = () => { closeModal(); VIEWS.keys(); }; };
    document.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => { if (confirm('Révoquer cette clé ?')) { await api('DELETE', '/api/admin/keys/' + b.dataset.rv); VIEWS.keys(); } });
  },

  async export() {
    $('#main').innerHTML = `<div class="box2"><h3>Exporter les données</h3><div class="filters"><select id="el"><option value="">Toutes les langues</option>${Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <select id="es"><option value="eligible">Validées seulement (prêtes pour l'IA)</option><option value="all">Tout (y compris en attente)</option></select>
    <select id="ef"><option value="jsonl">JSONL</option><option value="csv">CSV</option><option value="json">JSON</option></select><button class="btn" id="go">Télécharger</button></div>
    <p class="mut">Les phrases de santé n'apparaissent dans « validées » qu'après approbation manuelle.</p></div>`;
    $('#go').onclick = async () => {
      const r = await fetch(`/api/admin/export?format=${$('#ef').value}&scope=${$('#es').value}&lang=${$('#el').value}`, { headers: { Authorization: 'Bearer ' + TOKEN } });
      const b = await r.blob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `kan-export.${$('#ef').value}`; a.click();
    };
  },
};
TOKEN ? start() : showLogin();
