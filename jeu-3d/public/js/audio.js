// Ambiance sonore 100 % synthétisée (aucun fichier) : rumeur de ville, moteurs, klaxons, oiseaux, pas.
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

export const Sound = {
  ctx: null, on: LS.get('kan.sound') !== '0', ready: false, voices: [], nextBird: 4, stepT: 0,
  init() {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    try { this.ctx = new AudioContext(); } catch { return; }
    const c = this.ctx; this.master = c.createGain(); this.master.gain.value = this.on ? .9 : 0; this.master.connect(c.destination);
    const noise = (kind) => { const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; };
    this.noiseBuf = noise('white'); const brown = noise('brown');
    const src = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    // rumeur grave de la ville
    const rum = c.createGain(); rum.gain.value = .5; src(brown).connect(rum); rum.connect(this.master);
    // murmure de foule (bruit filtré qui respire)
    const mur = c.createBiquadFilter(); mur.type = 'bandpass'; mur.frequency.value = 900; mur.Q.value = .7; const mg = c.createGain(); mg.gain.value = .05; src(this.noiseBuf).connect(mur); mur.connect(mg); mg.connect(this.master);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .13; lg.gain.value = .025; lfo.connect(lg); lg.connect(mg.gain); lfo.start();
    // 4 voix de moteur
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 80; const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 40;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; const g = c.createGain(); g.gain.value = 0; const p = c.createStereoPanner();
      o.connect(f); o2.connect(f); f.connect(g); g.connect(p); p.connect(this.master); o.start(); o2.start(); this.voices.push({ o, o2, f, g, p });
    }
    this.ready = true;
  },
  resume() { this.init(); if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); },
  toggle() { this.on = !this.on; LS.set('kan.sound', this.on ? '1' : '0'); this.resume(); if (this.master) this.master.gain.setTargetAtTime(this.on ? .9 : 0, this.ctx.currentTime, .08); return this.on; },

  _env(node, t0, a, d, peak) { const g = node.gain; g.cancelScheduledValues(t0); g.setValueAtTime(0, t0); g.linearRampToValueAtTime(peak, t0 + a); g.exponentialRampToValueAtTime(.0005, t0 + a + d); },
  /** pas : 'road' (dur) ou 'dust' (latérite) */
  step(surface = 'dust', run = false) {
    if (!this.ready || !this.on) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = .8 + Math.random() * .5;
    const f = c.createBiquadFilter(); f.type = surface === 'road' ? 'bandpass' : 'lowpass'; f.frequency.value = surface === 'road' ? 1800 + Math.random() * 600 : 700 + Math.random() * 300; f.Q.value = surface === 'road' ? 1.2 : .5;
    const g = c.createGain(); s.connect(f); f.connect(g); g.connect(this.master);
    this._env(g, t, .004, surface === 'road' ? .07 : .13, (run ? .34 : .24) * (.85 + Math.random() * .3));
    s.start(t, Math.random() * 2, .2);
    // petit « toc » grave du talon
    const o = c.createOscillator(), og = c.createGain(); o.frequency.value = 90 + Math.random() * 20; o.connect(og); og.connect(this.master); this._env(og, t, .002, .07, .16); o.start(t); o.stop(t + .1);
  },
  honk(x, z, pp, light) {
    if (!this.ready || !this.on) return; const d = Math.hypot(x - pp.x, z - pp.z); if (d > 70) return;
    const c = this.ctx, t = c.currentTime, vol = Math.min(.3, 2.2 / (d + 6)), g = c.createGain(); g.connect(this.master);
    const f = light ? [880, 1100] : [400, 500];
    for (const fr of f) { const o = c.createOscillator(); o.type = light ? 'square' : 'sawtooth'; o.frequency.value = fr; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; o.connect(lp); lp.connect(g); o.start(t); o.stop(t + .45); }
    this._env(g, t, .02, .4, vol);
  },
  bird() {
    if (!this.ready || !this.on) return; const c = this.ctx, t = c.currentTime, n = 2 + Math.floor(Math.random() * 3), base = 2400 + Math.random() * 1600, g = c.createGain(); g.connect(this.master); g.gain.value = .02 + Math.random() * .02;
    for (let i = 0; i < n; i++) { const o = c.createOscillator(); o.type = 'sine'; const t0 = t + i * .14; o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + .08); const eg = c.createGain(); eg.gain.setValueAtTime(0, t0); eg.gain.linearRampToValueAtTime(1, t0 + .02); eg.gain.exponentialRampToValueAtTime(.001, t0 + .1); o.connect(eg); eg.connect(g); o.start(t0); o.stop(t0 + .12); }
  },
  /** à appeler à chaque image : moteurs proches + événements de la ville */
  update(dt, t, city, pp, camYaw) {
    if (!this.ready) return;
    if (this.ctx.state !== 'running') return;
    const near = city ? city.nearVehicles(pp, this.voices.length) : [], ct = this.ctx.currentTime;
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw); // axe « droite » de la caméra
    this.voices.forEach((vo, i) => {
      const n = near[i];
      if (!n) { vo.g.gain.setTargetAtTime(0, ct, .1); return; }
      const v = n.v, dx = v.pos.x - pp.x, dz = v.pos.z - pp.z, d = n.d + .01;
      const radial = (v.dx * dx + v.dz * dz) / d * v.vel; // >0 : s'éloigne
      const dop = 1 - Math.max(-12, Math.min(12, radial)) / 343 * 6;
      const base = (v.kind === 'moto' ? 70 : 48) + v.vel * (v.kind === 'moto' ? 9 : 6);
      vo.o.frequency.setTargetAtTime(base * dop, ct, .08); vo.o2.frequency.setTargetAtTime(base * .5 * dop, ct, .08);
      vo.f.frequency.setTargetAtTime(380 + v.vel * 50 + 600 / (1 + d / 8), ct, .1);
      vo.g.gain.setTargetAtTime(Math.min(.16, .9 / (d + 5)) * (v.kind === 'moto' ? 1 : .8), ct, .12);
      vo.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, (dx * rx + dz * rz) / 18)), ct, .1);
    });
    if (city) while (city.events.length) { const e = city.events.shift(); if (e.type === 'honk') this.honk(e.x, e.z, pp, e.light); }
    if (t > this.nextBird) { this.nextBird = t + 5 + Math.random() * 12; this.bird(); }
  },
};
