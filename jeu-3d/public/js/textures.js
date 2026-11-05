// Textures procédurales (canvas) : latérite, bitume, tôle, crépi, pagnes wax, Faso Dan Fani, panneaux, ciel.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = true, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// dessine en répétant aux bords pour que la texture se raccorde
function wrapDraw(ctx, w, h, x, y, r, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    if (x + dx + r < 0 || x + dx - r > w || y + dy + r < 0 || y + dy - r > h) continue;
    fn(x + dx, y + dy);
  }
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

export function lateriteTexture(seed = 1, light = 0) {
  const S = 512, [c, ctx] = canvas(S, S), R = rng(seed);
  ctx.fillStyle = hsl(15, 55, 40 + light); ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { // grandes taches douces
    const x = R() * S, y = R() * S, r = 40 + R() * 90, l = 34 + R() * 14 + light, hh = 10 + R() * 12;
    wrapDraw(ctx, S, S, x, y, r, (px, py) => { const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, hsl(hh, 50, l, .35)); g.addColorStop(1, hsl(hh, 50, l, 0)); ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2); });
  }
  for (let i = 0; i < 5500; i++) { // grain et petits cailloux
    const x = R() * S, y = R() * S, s = .6 + R() * 2.2, l = 28 + R() * 30 + light;
    wrapDraw(ctx, S, S, x, y, s, (px, py) => { ctx.fillStyle = hsl(8 + R() * 18, 45 + R() * 15, l, .25 + R() * .4); ctx.beginPath(); ctx.ellipse(px, py, s, s * (.6 + R() * .5), R() * 3, 0, 7); ctx.fill(); });
  }
  for (let i = 0; i < 260; i++) { // cailloux clairs
    const x = R() * S, y = R() * S, s = .8 + R() * 1.6;
    wrapDraw(ctx, S, S, x, y, s, (px, py) => { ctx.fillStyle = hsl(28, 25, 62 + R() * 15, .6); ctx.beginPath(); ctx.ellipse(px, py, s, s * .7, R() * 3, 0, 7); ctx.fill(); });
  }
  return tex(c, { aniso: 8 });
}

// Ruban de route : u = travers (0..1), v = longueur (1 tuile = 8 m)
export function roadTexture(kind, seed = 3) {
  const W = 256, H = 256, [c, ctx] = canvas(W, H), R = rng(seed);
  if (kind === 'asphalt') {
    ctx.fillStyle = '#3b3b3f'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${R() * .07})`; ctx.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2); }
    for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(15,15,18,.5)'; ctx.lineWidth = 1; ctx.beginPath(); let x = R() * W, y = R() * H; ctx.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - .5) * 30; y += (R() - .2) * 26; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = '#d8d3c4'; ctx.fillRect(W * .035, 0, 4, H); ctx.fillRect(W * .965 - 4, 0, 4, H); // bords
    ctx.fillStyle = '#e6c94a'; ctx.fillRect(W * .5 - 2, 20, 4, 90); ctx.fillRect(W * .5 - 2, 148, 4, 90); // axe pointillé
    // bandes de poussière sur les bords
    const g1 = ctx.createLinearGradient(0, 0, W * .2, 0); g1.addColorStop(0, 'rgba(190,100,60,.45)'); g1.addColorStop(1, 'rgba(190,100,60,0)'); ctx.fillStyle = g1; ctx.fillRect(0, 0, W * .2, H);
    const g2 = ctx.createLinearGradient(W, 0, W * .8, 0); g2.addColorStop(0, 'rgba(190,100,60,.45)'); g2.addColorStop(1, 'rgba(190,100,60,0)'); ctx.fillStyle = g2; ctx.fillRect(W * .8, 0, W * .2, H);
  } else { // terre battue
    ctx.fillStyle = '#bd6a3e'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6000; i++) { ctx.fillStyle = hsl(14 + R() * 16, 45, 36 + R() * 28, .3); ctx.fillRect(R() * W, R() * H, 1 + R() * 2.4, 1 + R() * 2.4); }
    for (const u of [.32, .68]) { // traces de roues
      const g = ctx.createLinearGradient((u - .12) * W, 0, (u + .12) * W, 0); g.addColorStop(0, 'rgba(120,55,28,0)'); g.addColorStop(.5, 'rgba(120,55,28,.35)'); g.addColorStop(1, 'rgba(120,55,28,0)'); ctx.fillStyle = g; ctx.fillRect((u - .12) * W, 0, .24 * W, H);
    }
    const gl = ctx.createLinearGradient(0, 0, W * .22, 0); gl.addColorStop(0, 'rgba(150,170,70,.4)'); gl.addColorStop(1, 'rgba(150,170,70,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W * .22, H);
    const gr = ctx.createLinearGradient(W, 0, W * .78, 0); gr.addColorStop(0, 'rgba(150,170,70,.4)'); gr.addColorStop(1, 'rgba(150,170,70,0)'); ctx.fillStyle = gr; ctx.fillRect(W * .78, 0, W * .22, H);
  }
  const t = tex(c, { aniso: 8 }); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

export function plasterTexture(seed = 5) {
  const S = 256, [c, ctx] = canvas(S, S), R = rng(seed);
  ctx.fillStyle = '#f2f2f0'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 7000; i++) { const v = 200 + R() * 55; ctx.fillStyle = `rgba(${v},${v},${v},${.12 + R() * .2})`; ctx.fillRect(R() * S, R() * S, 1 + R() * 3, 1 + R() * 3); }
  for (let i = 0; i < 26; i++) { // coulures
    const x = R() * S, h = 30 + R() * 90; const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(90,70,50,.0)'); g.addColorStop(1, 'rgba(90,70,50,.10)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 2 + R() * 6, h);
  }
  const g = ctx.createLinearGradient(0, S, 0, S * .72); g.addColorStop(0, 'rgba(120,70,40,.55)'); g.addColorStop(1, 'rgba(120,70,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, S * .72, S, S * .28); // éclaboussures de terre
  const g2 = ctx.createLinearGradient(0, 0, 0, S * .2); g2.addColorStop(0, 'rgba(255,255,255,.18)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, S, S * .2);
  return tex(c);
}

const roofCache = new Map();
export function roofTexture(color = '#8e949a') {
  if (roofCache.has(color)) return roofCache.get(color);
  const S = 256, [c, ctx] = canvas(S, S), R = rng(9);
  const base = new THREE.Color(color), r = base.r * 255 | 0, g = base.g * 255 | 0, b = base.b * 255 | 0;
  ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
  const P = 16;
  for (let x = 0; x < S; x += P) {
    const gr = ctx.createLinearGradient(x, 0, x + P, 0);
    gr.addColorStop(0, 'rgba(0,0,0,.30)'); gr.addColorStop(.35, 'rgba(255,255,255,.22)'); gr.addColorStop(.55, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.30)');
    ctx.fillStyle = gr; ctx.fillRect(x, 0, P, S);
  }
  for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${120 + R() * 40},${60 + R() * 30},30,${.15 + R() * .3})`; ctx.fillRect(R() * S, R() * S, 1 + R() * 3, 3 + R() * 14); }
  for (let y = 0; y < S; y += 128) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, y, S, 2); }
  const t = tex(c, { aniso: 8 }); roofCache.set(color, t); return t;
}

export function grainTexture() {
  const S = 128, [c, ctx] = canvas(S, S), R = rng(4);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) { const v = 215 + R() * 40; ctx.fillStyle = `rgba(${v},${v},${v},${.2 + R() * .3})`; ctx.fillRect(R() * S, R() * S, 1 + R() * 2, 1 + R() * 2); }
  return tex(c);
}

// ---------- pagnes wax ----------
const waxCache = new Map();
export function waxTexture(c1, c2, pattern = 0) {
  const key = `${c1}|${c2}|${pattern % 5}`;
  if (waxCache.has(key)) return waxCache.get(key);
  const S = 256, [c, ctx] = canvas(S, S), R = rng(pattern * 131 + 7);
  const A = new THREE.Color(c1), B = new THREE.Color(c2);
  const mix = (t) => '#' + A.clone().lerp(B, t).getHexString();
  const dark = '#1c1a22', cream = '#f6ecd2';
  ctx.fillStyle = c1; ctx.fillRect(0, 0, S, S);
  const kind = pattern % 5;
  if (kind === 0) { // cercles concentriques
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const x = gx * 64 + (gy % 2 ? 32 : 0) + 16, y = gy * 64 + 16;
      wrapDraw(ctx, S, S, x, y, 30, (px, py) => { [[28, c2], [21, cream], [15, dark], [8, c2], [3, cream]].forEach(([r, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); }); });
    }
  } else if (kind === 1) { // losanges et points
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
      const x = gx * 32 + 16, y = gy * 32 + 16, odd = (gx + gy) % 2;
      ctx.fillStyle = odd ? c2 : cream; ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x + 13, y); ctx.lineTo(x, y + 13); ctx.lineTo(x - 13, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
    }
  } else if (kind === 2) { // feuilles
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 5; gx++) {
      const x = gx * 52 + (gy % 2 ? 26 : 0), y = gy * 52 + 26;
      wrapDraw(ctx, S, S, x, y, 30, (px, py) => {
        ctx.save(); ctx.translate(px, py); ctx.rotate(((gx + gy) % 2 ? .6 : -.6));
        ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(0, 0, 9, 22, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = cream; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
        for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(0, k * 5); ctx.lineTo(7, k * 5 - 5); ctx.moveTo(0, k * 5); ctx.lineTo(-7, k * 5 - 5); ctx.stroke(); }
        ctx.restore();
      });
    }
  } else if (kind === 3) { // éventails
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 5; gx++) {
      const x = gx * 52 + 26, y = gy * 52 + 40;
      wrapDraw(ctx, S, S, x, y, 40, (px, py) => { [[26, dark], [21, c2], [15, cream], [9, mix(.5)], [4, dark]].forEach(([r, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, r, Math.PI, 0); ctx.fill(); }); });
    }
  } else { // rayures + zigzag
    for (let x = 0; x < S; x += 32) { ctx.fillStyle = (x / 32) % 2 ? c2 : mix(.3); ctx.fillRect(x, 0, 32, S); }
    ctx.strokeStyle = cream; ctx.lineWidth = 4; for (let y = 10; y < S; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + (x / 16 % 2 ? 9 : 0)); ctx.stroke(); }
    ctx.fillStyle = dark; for (let y = 28; y < S; y += 36) for (let x = 8; x < S; x += 32) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
  }
  for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(0,0,0,${R() * .05})`; ctx.fillRect(R() * S, R() * S, 1, 2); } // fibres
  const t = tex(c); waxCache.set(key, t); return t;
}

const fdfCache = new Map();
export function fasoDanFaniTexture(pattern = 0) {
  const k = pattern % 4; if (fdfCache.has(k)) return fdfCache.get(k);
  const S = 256, [c, ctx] = canvas(S, S), R = rng(k * 77 + 3);
  const sets = [['#b22222', '#f4efe2', '#1d1d1d', '#e9b82e'], ['#1f4e8c', '#f4efe2', '#9c2b2b', '#e9b82e'], ['#2e7d4f', '#f4efe2', '#1d1d1d', '#c0392b'], ['#6b3fa0', '#f4efe2', '#e9b82e', '#1d1d1d']][k];
  let x = 0, i = 0;
  while (x < S) {
    const w = 10 + (R() * 22 | 0), col = sets[i % sets.length];
    ctx.fillStyle = col; ctx.fillRect(x, 0, w, S);
    if (i % 3 === 1) { ctx.fillStyle = sets[(i + 2) % sets.length]; for (let y = 0; y < S; y += 14) ctx.fillRect(x + 2, y, w - 4, 6); }
    x += w; i++;
  }
  ctx.globalAlpha = .13; ctx.fillStyle = '#000'; for (let y = 0; y < S; y += 3) ctx.fillRect(0, y, S, 1);
  ctx.globalAlpha = .08; for (let xx = 0; xx < S; xx += 3) ctx.fillRect(xx, 0, 1, S);
  const t = tex(c); fdfCache.set(k, t); return t;
}

// ---------- panneaux ----------
export function signTexture(text, { bg = '#1e6fb8', fg = '#ffffff', w = 512, h = 160, sub = '', border = '#ffffff', size = 0 } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = size || (sub ? h * .42 : h * .5);
  ctx.font = `bold ${fs}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
  let f = fs; while (ctx.measureText(text).width > w - 50 && f > 14) { f -= 2; ctx.font = `bold ${f}px "Trebuchet MS", Arial, sans-serif`; }
  ctx.fillText(text, w / 2, sub ? h * .38 : h / 2);
  if (sub) { ctx.font = `600 ${h * .2}px "Trebuchet MS", Arial, sans-serif`; ctx.fillText(sub, w / 2, h * .74); }
  return tex(c, { repeat: false });
}

export function iconSprite(emoji, bg = '#ffffff', ring = '#e8a33d') {
  const S = 128, [c, ctx] = canvas(S, S);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(S / 2, S / 2, 56, 0, 7); ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = ring; ctx.stroke();
  ctx.font = '64px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji, S / 2, S / 2 + 4);
  const t = tex(c, { repeat: false });
  const m = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m); s.renderOrder = 20; return s;
}

export function cloudTexture() {
  const S = 256, [c, ctx] = canvas(S, S / 2), R = rng(21);
  for (let i = 0; i < 18; i++) {
    const x = 50 + R() * 156, y = 70 + R() * 30 - Math.abs(x - 128) * .2, r = 20 + R() * 36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return tex(c, { repeat: false });
}

export function smokeTexture() {
  const S = 64, [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c, { repeat: false });
}

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#4d8fdc') }, mid: { value: new THREE.Color('#9fc8ee') }, hor: { value: new THREE.Color('#f7dcb2') }, sunDir: { value: new THREE.Vector3(.5, .4, .3).normalize() }, sunCol: { value: new THREE.Color('#fff1c9') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top, mid, hor, sunCol, sunDir;
      void main(){ float h = clamp(vP.y, -0.2, 1.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, h)); c = mix(c, top, smoothstep(0.2, 0.85, h));
        if (vP.y < 0.0) c = mix(hor, hor * 0.92, clamp(-vP.y*4.0,0.0,1.0));
        float s = max(dot(normalize(vP), normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 600.0) * 1.2 + pow(s, 24.0) * 0.28 + pow(s, 5.0) * 0.10);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10; return m;
}

export function pavingTexture() {
  const S = 512, [c, ctx] = canvas(S, S), R = rng(31);
  ctx.fillStyle = '#c9c4b8'; ctx.fillRect(0, 0, S, S);
  const N = 4, T = S / N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = 188 + R() * 30; ctx.fillStyle = `rgb(${v},${v - 4},${v - 14})`; ctx.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
  }
  for (let i = 0; i < 6000; i++) { ctx.fillStyle = `rgba(${R() < .5 ? 255 : 60},${R() < .5 ? 255 : 60},${R() < .5 ? 250 : 50},${R() * .06})`; ctx.fillRect(R() * S, R() * S, 1 + R() * 2, 1 + R() * 2); }
  ctx.strokeStyle = 'rgba(80,70,60,.55)'; ctx.lineWidth = 5; for (let i = 0; i <= N; i++) { ctx.beginPath(); ctx.moveTo(i * T, 0); ctx.lineTo(i * T, S); ctx.moveTo(0, i * T); ctx.lineTo(S, i * T); ctx.stroke(); }
  return tex(c, { aniso: 8 });
}
export function softPatchTexture() {
  const S = 128, [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; ctx.fillRect(Math.random() * S, Math.random() * S, 2, 3); }
  return tex(c, { repeat: false });
}
export function flagTexture() {
  const W = 256, H = 170, [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#d6232a'; ctx.fillRect(0, 0, W, H / 2); ctx.fillStyle = '#1b9a48'; ctx.fillRect(0, H / 2, W, H / 2);
  ctx.fillStyle = '#f6cf1c'; ctx.beginPath(); const cx = W / 2, cy = H / 2, R1 = 42, R2 = 17;
  for (let i = 0; i < 10; i++) { const r = i % 2 ? R2 : R1, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  return tex(c, { repeat: false });
}
