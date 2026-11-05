// Appels au serveur (avec un mode démo local sans serveur pour tester l'affichage : ?demo=1).
const LS = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} },
};
export { LS };

export const Api = {
  token: LS.get('kan.token') || '',
  demo: false,
  setToken(t) { this.token = t || ''; t ? LS.set('kan.token', t) : LS.del('kan.token'); },

  async req(method, url, body, raw) {
    const headers = {};
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    if (body && !raw) headers['Content-Type'] = 'application/json';
    if (raw) headers['Content-Type'] = raw;
    let r;
    try { r = await fetch(url, { method, headers, body: raw ? body : body ? JSON.stringify(body) : undefined }); }
    catch { throw new Error('Pas de connexion au serveur.'); }
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(j?.error || 'Erreur ' + r.status); e.status = r.status; throw e; }
    return j;
  },

  content() { return this.req('GET', '/api/content'); },
  register(p) { return this.req('POST', '/api/register', p); },
  me() { return this.req('GET', '/api/me'); },
  leaderboard(q) { return this.req('GET', '/api/leaderboard' + (q ? '?quartier=' + q : '')); },
  stats() { return this.req('GET', '/api/stats'); },

  async translate(prompt_key, lang, text, voice = false) {
    if (this.demo) return { id: 0, points_awarded: 10 };
    return this.req('POST', '/api/translate', { prompt_key, lang, text, voice });
  },
  async uploadAudio(id, blob) {
    if (this.demo || !id) return { points_awarded: 5 };
    return this.req('POST', `/api/translate/${id}/audio`, blob, blob.type || 'audio/webm');
  },
  async listen(zone) {
    if (this.demo) return null;
    try { return (await this.req('GET', '/api/listen?zone=' + zone)).task; } catch { return null; }
  },
  async answer(translation_id, chosen_prompt_id, flagged) {
    if (this.demo) return { correct: true, correct_text: '', points_awarded: 5 };
    return this.req('POST', '/api/listen/answer', { translation_id, chosen_prompt_id, flagged });
  },
  async complete(mission_id, reward = 0) {
    if (this.demo) return { points_awarded: reward, points: reward };
    return this.req('POST', '/api/mission/complete', { mission_id });
  },
  async audioBlobUrl(url) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + this.token } });
    if (!r.ok) throw new Error('audio');
    return URL.createObjectURL(await r.blob());
  },
};
