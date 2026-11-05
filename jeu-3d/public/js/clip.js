// Enregistrement d'un clip vertical de 30 s (format réseaux sociaux) avec sous-titres et écran final d'invitation.
export class ClipRecorder {
  constructor(glCanvas, getMeta) {
    this.gl = glCanvas; this.getMeta = getMeta;
    this.out = document.createElement('canvas'); this.out.width = 720; this.out.height = 1280;
    this.ctx = this.out.getContext('2d');
    this.state = 'idle'; this.caption = null; this.t0 = 0; this.endAt = 0;
    this.maxMs = 30000; this.endCardMs = 2800;
  }
  static supported() { return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; }
  get elapsed() { return this.state === 'idle' ? 0 : (performance.now() - this.t0) / 1000; }

  setCaption(fr, local, lang) { this.caption = { fr, local, lang, at: performance.now() }; }

  start(onDone) {
    if (this.state !== 'idle') return false;
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    this.mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const stream = this.out.captureStream(30);
    try { this.rec = new MediaRecorder(stream, this.mime ? { mimeType: this.mime, videoBitsPerSecond: 3_000_000 } : undefined); } catch (e) { return false; }
    this.chunks = []; this.onDone = onDone;
    this.rec.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.onstop = () => { const type = this.rec.mimeType || this.mime || 'video/webm'; this.state = 'idle'; this.onDone?.(new Blob(this.chunks, { type }), type); };
    this.t0 = performance.now(); this.state = 'rec'; this.endAt = 0;
    this.rec.start(250);
    return true;
  }
  /** demande l'arrêt : on joue l'écran final puis on coupe */
  stop() { if (this.state === 'rec') { this.state = 'end'; this.endAt = performance.now(); } }

  /** à appeler juste après renderer.render() */
  capture() {
    if (this.state === 'idle') return;
    const now = performance.now(), c = this.ctx, W = 720, H = 1280;
    if (this.state === 'rec' && now - this.t0 >= this.maxMs) this.stop();
    if (this.state === 'end') {
      this._endCard(now - this.endAt);
      if (now - this.endAt >= this.endCardMs) { this.state = 'finishing'; this.rec.stop(); }
      return;
    }
    if (this.state !== 'rec') return;
    // image du jeu, recadrée en vertical (cover)
    const sw = this.gl.width, sh = this.gl.height, k = Math.max(W / sw, H / sh), dw = W / k, dh = H / k;
    c.drawImage(this.gl, (sw - dw) / 2, (sh - dh) / 2, dw, dh, 0, 0, W, H);
    const meta = this.getMeta();
    const g = c.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 170);
    c.fillStyle = '#f4c542'; c.font = '900 46px "Trebuchet MS", Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('KAN', 34, 70);
    c.fillStyle = '#fff'; c.font = '600 28px "Trebuchet MS", Arial, sans-serif'; c.fillText(meta.quartier, 34, 118);
    const left = Math.max(0, Math.ceil((this.maxMs - (now - this.t0)) / 1000));
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '700 26px Arial'; c.fillText('● REC ' + left + ' s', W - 34, 70);
    // sous-titres
    const cap = this.caption;
    if (cap && now - cap.at < 9000) {
      const lines = [...wrap(c, cap.fr, 620, '600 34px "Trebuchet MS", Arial, sans-serif')];
      const l2 = cap.local ? [...wrap(c, cap.local, 620, '700 36px "Trebuchet MS", Arial, sans-serif')] : [];
      const lh = 46, hh = (lines.length + l2.length) * lh + 40 + (l2.length ? 30 : 0);
      const y0 = H - 270 - hh;
      c.fillStyle = 'rgba(10,20,14,.72)'; roundRect(c, 40, y0, W - 80, hh, 26); c.fill();
      c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '600 34px "Trebuchet MS", Arial, sans-serif';
      lines.forEach((l, i) => c.fillText(l, W / 2, y0 + 36 + i * lh));
      if (l2.length) {
        c.fillStyle = '#f4c542'; c.font = '700 22px Arial'; c.fillText((cap.lang || '').toUpperCase(), W / 2, y0 + 36 + lines.length * lh + 6);
        c.font = '700 36px "Trebuchet MS", Arial, sans-serif'; l2.forEach((l, i) => c.fillText(l, W / 2, y0 + 36 + lines.length * lh + 40 + i * lh));
      }
    }
    // bandeau bas
    const g2 = c.createLinearGradient(0, H - 200, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.65)'); c.fillStyle = g2; c.fillRect(0, H - 200, W, 200);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '700 30px "Trebuchet MS", Arial, sans-serif'; c.fillText('Joue à Kan et parle ta langue', W / 2, H - 80);
    c.fillStyle = '#f4c542'; c.font = '600 26px Arial'; c.fillText(meta.host, W / 2, H - 38);
  }
  _endCard(ms) {
    const c = this.ctx, W = 720, H = 1280, meta = this.getMeta(), p = Math.min(1, ms / 400);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1f4a31'); g.addColorStop(1, '#0d1812'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = p; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#f4c542'; c.font = '900 150px "Trebuchet MS", Arial, sans-serif'; c.fillText('KAN', W / 2, 360);
    c.fillStyle = '#fff'; c.font = '600 38px "Trebuchet MS", Arial, sans-serif'; c.fillText('Visite ton quartier du Burkina', W / 2, 470); c.fillText('et parle ta langue', W / 2, 520);
    c.fillStyle = '#f4c542'; roundRect(c, 70, 640, W - 140, 150, 40); c.fill();
    c.fillStyle = '#2a1a05'; c.font = '800 44px "Trebuchet MS", Arial, sans-serif'; c.fillText('Crée ton compte', W / 2, 690); c.fillText('et joue à ton tour !', W / 2, 745);
    c.fillStyle = '#fff'; c.font = '700 34px Arial'; c.fillText(meta.host, W / 2, 880);
    ['#d6232a', '#f6cf1c', '#1b9a48'].forEach((col, i) => { c.fillStyle = col; c.fillRect(W / 2 - 150 + i * 100, 960, 100, 14); });
    c.globalAlpha = 1;
  }
}

function* wrap(c, text, maxW, font) {
  c.font = font; const words = String(text || '').split(/\s+/); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { yield line; line = w; } else line = t; }
  if (line) yield line;
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
