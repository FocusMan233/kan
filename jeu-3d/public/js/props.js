// Éléments de décor : maisons, arbres, mobilier, motos, poteaux... (tous fusionnés dans le Batcher)
import * as THREE from 'three';
import { M, G } from './batch.js';
import { signTexture } from './textures.js';

export const PAL = {
  chaud: { walls: ['#e0a46c', '#d9b48a', '#eadcc0', '#c98a5a', '#e8c9a0', '#d99a7a'], roofs: ['#8e949a', '#7a8087', '#a0583a', '#6b7a8a', '#9a6a4f'], },
  ocre:  { walls: ['#d8a95a', '#e3c27d', '#c98f4a', '#efe0b8', '#b97b48', '#e9d19a'], roofs: ['#7a8087', '#a0583a', '#8e949a', '#5c6b73', '#b0653f'] },
  frais: { walls: ['#9cc4c9', '#b9d7b4', '#f0e6d2', '#cfe0ea', '#e8c4b8', '#a9c8e0'], roofs: ['#6b7a8a', '#8e949a', '#a0583a', '#5c6b73', '#7a8087'] },
  vert:  { walls: ['#b9cf9a', '#e6dfc4', '#d6a77a', '#a8c4a2', '#f0e8d8', '#c8b08a'], roofs: ['#8e949a', '#6b7a8a', '#9a6a4f', '#7a8087', '#a0583a'] },
};
export const DOORS = ['#1f7a7a', '#a83232', '#3a6ea5', '#6b4423', '#2e7d4f', '#d4a017', '#7b3fa0'];
const pick = (R, a) => a[Math.floor(R() * a.length)];
const LEAF = ['#4f8a3a', '#5c9a40', '#6aa84a', '#468236', '#79a653'];
const LEAF_DRY = ['#8aa04a', '#9bae55', '#7d9444', '#a5b25e'];

// ---------- primitives de collision ----------
export function rectPoly(cx, cz, w, d, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hd = d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
}
export function addCollider(ctx, pts) {
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const [x, z] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
  ctx.colliders.push({ pts, minx, maxx, minz, maxz });
}
export const rectCollider = (ctx, cx, cz, w, d, ry = 0) => addCollider(ctx, rectPoly(cx, cz, w, d, ry));

// ---------- toits ----------
// dalle de tôle : largeur w (travers), longueur d (pente), ribs le long de d
export function slab(ctx, cx, cy, cz, w, d, ry, tilt, color, thick = .07) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, ry, 0, 'YXZ')), new THREE.Vector3(w, thick, d));
  ctx.B.add(G.box, m, color, 'roof', .06, [Math.max(1, w / 3.2), Math.max(1, d / 6)]);
}
function gableTri(w, h, d) { // prisme triangulaire (pignons) : deux triangles
  const g = new THREE.BufferGeometry(), hw = w / 2, hd = d / 2;
  const v = [-hw, 0, hd, hw, 0, hd, 0, h, hd, hw, 0, -hd, -hw, 0, -hd, 0, h, -hd];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1, 0, 0, 1, 0, .5, 1], 2));
  return g;
}

// ---------- maisons ----------
export function house(ctx, cx, cz, w, d, o = {}) {
  const { B, R, pal } = ctx;
  const wall = o.wall || pick(R, pal.walls), roof = o.roof || pick(R, pal.roofs), h = o.h || 2.9 + R() * .5;
  const ry = o.ry || 0;
  const kind = o.kind || (R() < .6 ? 'mono' : R() < .6 ? 'gable' : 'flat');
  const toW = (lx, lz) => [cx + lx * Math.cos(ry) + lz * Math.sin(ry), cz - lx * Math.sin(ry) + lz * Math.cos(ry)];
  B.add(G.box, M(cx, h / 2, cz, ry, w, h, d), wall, 'wall', .04);
  B.add(G.box, M(cx, .22, cz, ry, w + .1, .44, d + .1), '#8a7a6a', 'wall', .05);                     // soubassement
  const ov = .55;
  if (kind === 'mono') {
    const tilt = .12; slab(ctx, cx, h + .38, cz, w + ov * 2, d + ov * 2, ry, tilt, roof);
    B.add(G.box, M(cx, h + .1, cz, ry, w + .02, .2, d + .02), wall, 'wall', .04);
  } else if (kind === 'gable') {
    const rh = Math.min(d * .26, 1.6), ang = Math.atan2(rh, d / 2), l2 = Math.hypot(d / 2, rh) + ov * .8;
    for (const sd of [-1, 1]) {
      const lz = sd * (d / 4 + .05), px = cx + lz * Math.sin(ry), pz = cz + lz * Math.cos(ry);
      slab(ctx, px, h + rh / 2 + .03, pz, w + ov * 1.4, l2, ry, sd * ang, roof);
    }
    B.add(gableTri(d, rh, w), M(cx, h, cz, ry + Math.PI / 2), wall, 'wall', .04);
  } else {
    B.add(G.box, M(cx, h + .18, cz, ry, w + .3, .36, d + .3), wall, 'wall', .05);                       // acrotère
    B.add(G.box, M(cx, h + .32, cz, ry, w - .1, .08, d - .1), '#7a7268', 'wall', .05);
  }
  // porte et fenêtres sur la face « avant » (+z local)
  const door = pick(R, DOORS);
  const dx = (o.doorX ?? (R() - .5) * (w - 3)), fz = d / 2 + .02;
  const put = (lx, ly, lz, sw, sh, col, mat = 'paint') => { const [x, z] = toW(lx, lz); B.add(G.box, M(x, ly, z, ry, sw, sh, .07), col, mat, .02); };
  put(dx, 1.05, fz, 1.0, 2.1, door); put(dx, 1.05, fz + .02, .08, 2.1, shade(door, .6));
  put(dx, 2.18, fz, 1.2, .09, '#59483a');
  for (const sx of [-1, 1]) {
    const wx = dx + sx * (w * .26 + .6); if (Math.abs(wx) < w / 2 - .7) { put(wx, 1.7, fz, .9, .85, '#2b3a47'); put(wx, 1.7, fz + .02, .98, .06, '#efe9dc'); put(wx, 1.28, fz + .02, 1.0, .06, '#efe9dc'); put(wx, 1.7, fz + .03, .05, .85, '#efe9dc'); }
  }
  if (R() < .45) { // véranda
    const [px, pz] = toW(dx, d / 2 + 1.05);
    slab(ctx, px, h - .25, pz, Math.min(w - .6, 4.2), 2.3, ry, .1, roof);
    for (const sx of [-1, 1]) { const [qx, qz] = toW(dx + sx * Math.min((w - .6) / 2 - .15, 2), d / 2 + 2); B.add(G.cyl, M(qx, (h - .3) / 2, qz, 0, .08, h - .3, .08), '#6a5a48', 'paint', .05); }
  }
  if (R() < .35) { // citerne / château d'eau
    const [tx, tz] = toW(w / 2 - .8, -d / 2 + .8);
    B.add(G.cyl, M(tx, h + 1.0, tz, 0, .55, .9, .55), '#2b6cb0', 'paint', .04);
    for (const [ax, az] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) B.add(G.cyl, M(tx + ax, h + .35, tz + az, 0, .04, .7, .04), '#555', 'paint', 0);
  }
  addCollider(ctx, rectPoly(cx, cz, w, d, ry));
  return { w, d, h };
}

export function hut(ctx, cx, cz, r = 2.0) { // case ronde en banco + toit de chaume
  const { B, R } = ctx;
  B.add(new THREE.CylinderGeometry(r, r * 1.04, 2.1, 16), M(cx, 1.05, cz), pick(R, ['#c98a5a', '#b97b48', '#d9a577']), 'wall', .05);
  B.add(new THREE.ConeGeometry(r * 1.45, 1.9, 18), M(cx, 3.0, cz), '#c4a257', 'thatch', .1);
  B.add(G.box, M(cx, .8, cz + r - .02, 0, .8, 1.6, .06), '#4a3322', 'paint', .02);
  addCollider(ctx, [...Array(10)].map((_, i) => [cx + Math.cos(i / 10 * 6.283) * r, cz + Math.sin(i / 10 * 6.283) * r]));
}
export function granary(ctx, cx, cz) {
  const { B } = ctx;
  B.add(new THREE.CylinderGeometry(.9, 1.0, 1.5, 12), M(cx, 1.15, cz), '#b98050', 'wall', .05);
  B.add(new THREE.ConeGeometry(1.3, 1.1, 14), M(cx, 2.4, cz), '#c4a257', 'thatch', .1);
  for (const [a, b] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) B.add(G.cyl, M(cx + a, .2, cz + b, 0, .12, .4, .12), '#7b5a3a', 'paint', .05);
  ctx.circles.push({ x: cx, z: cz, r: 1.1 });
}

// clôture rectangulaire avec portail (ouverture) côté `gate` : 'n','s','e','w'
export function compoundWalls(ctx, cx, cz, w, d, gate = 's', gateW = 2.6, col = null) {
  const { B, R, pal } = ctx;
  col = col || pick(R, pal.walls);
  const t = .3, h = 1.9, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const seg = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az); if (L < .1) return;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, ry = Math.abs(bx - ax) > Math.abs(bz - az) ? 0 : Math.PI / 2;
    B.add(G.box, M(mx, h / 2, mz, ry, L, h, t), col, 'wall', .04);
    B.add(G.box, M(mx, h + .06, mz, ry, L + .05, .12, t + .1), '#8d7e6e', 'wall', .04);
    addCollider(ctx, rectPoly(mx, mz, ry === 0 ? L : t, ry === 0 ? t : L));
  };
  const sides = { n: [x0, z0, x1, z0], s: [x0, z1, x1, z1], w: [x0, z0, x0, z1], e: [x1, z0, x1, z1] };
  for (const [k, [ax, az, bx, bz]] of Object.entries(sides)) {
    if (k !== gate) { seg(ax, az, bx, bz); continue; }
    const horiz = ax !== bx, mid = horiz ? (ax + bx) / 2 : (az + bz) / 2;
    if (horiz) { seg(ax, az, mid - gateW / 2, bz); seg(mid + gateW / 2, az, bx, bz); const gc = pick(R, DOORS); for (const s of [-1, 1]) B.add(G.box, M(mid + s * gateW * .25, 1.1, az, 0, gateW * .48, 2.0, .06), gc, 'paint', .02); }
    else { seg(ax, az, bx, mid - gateW / 2); seg(ax, mid + gateW / 2, bx, bz); const gc = pick(R, DOORS); for (const s of [-1, 1]) B.add(G.box, M(ax, 1.1, mid + s * gateW * .25, 0, .06, 2.0, gateW * .48), gc, 'paint', .02); }
  }
}

// ---------- végétation ----------
export function tree(ctx, x, z, s = 1, kind = 'neem') {
  const { B, R } = ctx;
  if (kind === 'baobab') {
    B.add(G.cyl, M(x, 3.2 * s, z, 0, 1.7 * s, 6.4 * s, 1.7 * s), '#7a6a58', 'paint', .05);
    B.add(new THREE.CylinderGeometry(1.0, 1.5, 1, 12), M(x, 6.6 * s, z, 0, 1.6 * s, 1.2 * s, 1.6 * s), '#7a6a58', 'paint', .05);
    B.add(G.sphere, M(x, .1, z, 0, 2.3 * s, .8 * s, 2.3 * s), '#6f6050', 'paint', .05);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.283 + R(), len = (2.8 + R() * 1.6) * s, up = .55 + R() * .5;
      const bx = x + Math.cos(a) * len * .5, bz = z + Math.sin(a) * len * .5, by = 7.5 * s + len * up * .5;
      B.add(G.cyl, M(bx, by, bz, 0, .3 * s, len, .3 * s, Math.sin(a) * (1.0), -Math.cos(a) * 1.0), '#78685a', 'paint', .05);
      B.add(G.ico, M(x + Math.cos(a) * len * 1.05, 7.5 * s + len * up * 1.0, z + Math.sin(a) * len * 1.05, R() * 6, 1.5 * s, .9 * s, 1.5 * s), pick(R, LEAF_DRY), 'paint', .06);
    }
    ctx.circles.push({ x, z, r: 2.0 * s, crown: 4.2 * s });
    return;
  }
  const th = (2.4 + R() * .8) * s;
  B.add(new THREE.CylinderGeometry(.17 * s, .26 * s, 1, 7), M(x, th / 2, z, 0, 1, th, 1), '#6b4a30', 'paint', .06);
  const n = kind === 'mango' ? 6 : 5, base = kind === 'mango' ? ['#2f6b34', '#3a7a3c', '#357238'] : LEAF;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283 + R() * .8, rr = (.8 + R() * 1.1) * s, rad = (1.3 + R() * .9) * s * (kind === 'mango' ? 1.05 : 1);
    B.add(G.ico, M(x + Math.cos(a) * rr, th + .7 * s + R() * 1.1 * s, z + Math.sin(a) * rr, R() * 6, rad, rad * .82, rad), pick(R, base), 'paint', .07);
  }
  B.add(G.ico, M(x, th + 1.8 * s, z, 0, 1.6 * s, 1.2 * s, 1.6 * s), pick(R, base), 'paint', .06);
  ctx.circles.push({ x, z, r: .38 * s, crown: 3.1 * s });
}
export function shrub(ctx, x, z, s = 1) { const { B, R } = ctx; B.add(G.ico0, M(x, .35 * s, z, R() * 6, .8 * s, .5 * s, .8 * s), pick(R, LEAF_DRY), 'paint', .08); }
export function tuft(ctx, x, z) { const { B, R } = ctx; for (let i = 0; i < 3; i++) B.add(G.cone, M(x + (R() - .5) * .3, .22, z + (R() - .5) * .3, 0, .06, .45, .06, (R() - .5) * .5, (R() - .5) * .5), pick(R, LEAF_DRY), 'paintDS', .1); }

// ---------- mobilier ----------
export function chair(ctx, x, z, ry, col = '#c0392b') {
  const { B } = ctx, [lx, lz] = [Math.sin(ry), Math.cos(ry)];
  B.add(G.box, M(x, .45, z, ry, .42, .04, .42), col, 'paint', .06);
  B.add(G.box, M(x - lx * .2, .72, z - lz * .2, ry, .42, .5, .04), col, 'paint', .06);
  for (const [a, b] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) {
    const ox = a * Math.cos(ry) + b * Math.sin(ry), oz = -a * Math.sin(ry) + b * Math.cos(ry);
    B.add(G.box, M(x + ox, .22, z + oz, 0, .03, .44, .03), '#e8e8e8', 'paint', 0);
  }
}
export function table(ctx, x, z, w = 1.0, d = 1.0, col = '#8a5a3a') {
  const { B } = ctx;
  B.add(G.box, M(x, .75, z, 0, w, .06, d), col, 'paint', .05);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(G.box, M(x + a * (w / 2 - .06), .36, z + b * (d / 2 - .06), 0, .05, .72, .05), '#5a3c28', 'paint', 0);
}
export function bench(ctx, x, z, ry, w = 2.2, col = '#7a5230') {
  const { B } = ctx;
  B.add(G.box, M(x, .46, z, ry, w, .06, .42), col, 'paint', .05);
  B.add(G.box, M(x - Math.sin(ry) * .2, .78, z - Math.cos(ry) * .2, ry, w, .45, .05), col, 'paint', .05);
  for (const s of [-1, 1]) B.add(G.box, M(x + Math.cos(ry) * s * (w / 2 - .1), .22, z - Math.sin(ry) * s * (w / 2 - .1), ry, .06, .44, .36), '#4a3322', 'paint', 0);
  addCollider(ctx, rectPoly(x, z, w, .5, ry));
}
export function parasol(ctx, x, z, r = 1.7, cols = ['#e53935', '#fdd835', '#1e88e5', '#43a047'], y = 2.3) {
  const { B } = ctx, n = 8;
  B.add(G.cyl, M(x, y / 2, z, 0, .04, y, .04), '#7a7a7a', 'paint', 0);
  for (let i = 0; i < n; i++) B.add(new THREE.ConeGeometry(r, .55, 1, 1, true, i * Math.PI * 2 / n, Math.PI * 2 / n), M(x, y + .2, z), cols[i % cols.length], 'paintDS', .02);
}
export function barrel(ctx, x, z, col = '#2b6cb0') { ctx.B.add(G.cyl, M(x, .45, z, 0, .3, .9, .3), col, 'paint', .06); ctx.circles.push({ x, z, r: .32 }); }
export function crate(ctx, x, z, ry = 0, s = .6, col = '#9a7448') { ctx.B.add(G.box, M(x, s / 2, z, ry, s, s, s), col, 'paint', .08); }
export function sack(ctx, x, z, ry, col = '#e6d9b8', s = 1) { ctx.B.add(G.sphere, M(x, .24 * s, z, ry, .32 * s, .26 * s, .22 * s), col, 'paint', .06); ctx.B.add(G.box, M(x, .46 * s, z, ry, .2 * s, .05, .08), shade(col, .8), 'paint', .02); }
export function pile(ctx, x, y, z, color, n = 14, rad = .1, spread = .3) {
  const { B, R } = ctx;
  for (let i = 0; i < n; i++) { const a = R() * 6.28, rr = Math.sqrt(R()) * spread, hh = (1 - rr / spread) * .1; B.add(G.sphere, M(x + Math.cos(a) * rr, y + hh + rad * .8, z + Math.sin(a) * rr, 0, rad, rad * .9, rad), color, 'paint', .1); }
}
export function bowl(ctx, x, y, z, r = .3, col = '#d9a05b') { ctx.B.add(new THREE.SphereGeometry(1, 12, 6, 0, 6.283, 0, 1.5), M(x, y, z, 0, r, r * .6, r), col, 'paintDS', .05); }

export function pole(ctx, x, z, h = 8) {
  const { B } = ctx;
  B.add(G.cyl6, M(x, h / 2, z, 0, .12, h, .12), '#6f5a44', 'paint', .05);
  B.add(G.box, M(x, h - .5, z, 0, 2.0, .1, .1), '#5a4836', 'paint', 0);
  ctx.circles.push({ x, z, r: .15 });
}
export function wire(ctx, x1, z1, x2, z2, h = 7.5, sag = .7, off = 0, col = '#222') {
  const { B } = ctx, N = 6, dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, y0 = h - sag * 4 * t0 * (1 - t0), y1 = h - sag * 4 * t1 * (1 - t1);
    const mx = x1 + dx * (t0 + t1) / 2 + (-dz / L) * off, mz = z1 + dz * (t0 + t1) / 2 + (dx / L) * off;
    B.add(G.box, M(mx, (y0 + y1) / 2, mz, ry, L / N + .05, .03, .03, 0, Math.atan2(y1 - y0, L / N)), col, 'paint', 0);
  }
}
export function lamp(ctx, x, z, h = 5.5, ry = 0) {
  const { B } = ctx;
  B.add(G.cyl6, M(x, h / 2, z, 0, .07, h, .07), '#3b3f45', 'paint', 0);
  B.add(G.box, M(x + Math.sin(ry) * .6, h, z + Math.cos(ry) * .6, ry, .24, .1, 1.2), '#3b3f45', 'paint', 0);
  B.add(G.box, M(x + Math.sin(ry) * 1.1, h - .08, z + Math.cos(ry) * 1.1, ry, .2, .06, .3), '#fff3c8', 'glow', 0);
  ctx.circles.push({ x, z, r: .15 });
}

// ---------- motos ----------
export function motoModel(col = '#c0392b', rider = null) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .25 });
  const geoms = [];
  const add = (geo, m, c) => { const gg = geo.index ? geo.toNonIndexed() : geo.clone(); gg.applyMatrix4(m); const n = gg.attributes.position.count, arr = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; } gg.setAttribute('color', new THREE.BufferAttribute(arr, 3)); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'color'].includes(k)) gg.deleteAttribute(k); geoms.push(gg); };
  add(G.box, M(0, .55, 0, 0, .22, .16, 1.0), '#2b2b2f');          // cadre
  add(G.box, M(0, .72, .15, 0, .28, .2, .5), col);                   // réservoir
  add(G.box, M(0, .74, -.32, 0, .3, .1, .6), '#1c1c1c');             // selle
  add(G.box, M(0, .93, .55, 0, .66, .04, .05), '#222');              // guidon
  add(G.box, M(0, .62, .62, 0, .06, .5, .06, -.35), '#999');         // fourche
  add(G.box, M(0, .46, -.55, 0, .24, .09, .6), col);                 // garde-boue arrière
  add(G.box, M(.12, .32, -.35, 0, .06, .06, .5), '#888');            // échappement
  add(G.box, M(0, .84, .66, 0, .22, .16, .12), '#ffeb99');           // phare
  const body = new THREE.Mesh(mergeSimple(geoms), mat); body.castShadow = true; g.add(body);
  const wheels = [];
  for (const z of [.72, -.72]) {
    const w = new THREE.Group(); w.position.set(0, .3, z);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(.26, .07, 8, 16).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#151515', roughness: .9 })); tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .05, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b8b8b8', metalness: .6, roughness: .4 }));
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(.04, .38, .03), new THREE.MeshStandardMaterial({ color: '#777' }));
    w.add(tire, rim, spoke); g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}
function mergeSimple(geoms) { // fusion minimale sans dépendance
  let n = 0; for (const g of geoms) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geoms) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); return out;
}
// moto garée (statique, fusionnée dans le batcher)
export function parkedMoto(ctx, x, z, ry, col = '#c0392b') {
  const { B } = ctx;
  const L = (lx, ly, lz, sx, sy, sz, c, mat = 'paint', rx = 0) => { const px = x + lx * Math.cos(ry) + lz * Math.sin(ry), pz = z - lx * Math.sin(ry) + lz * Math.cos(ry); B.add(G.box, M(px, ly, pz, ry, sx, sy, sz, rx), c, mat, .02); };
  L(0, .55, 0, .22, .16, 1.0, '#2b2b2f'); L(0, .72, .15, .28, .2, .5, col); L(0, .74, -.32, .3, .1, .6, '#1c1c1c'); L(0, .93, .55, .66, .04, .05, '#222'); L(0, .46, -.55, .24, .09, .6, col); L(0, .84, .66, .22, .16, .12, '#ffeb99');
  for (const lz of [.72, -.72]) { const px = x + lz * Math.sin(ry), pz = z + lz * Math.cos(ry); B.add(new THREE.CylinderGeometry(.33, .33, .13, 14).rotateZ(Math.PI / 2), M(px, .33, pz, ry), '#161616', 'paint', 0); B.add(new THREE.CylinderGeometry(.18, .18, .15, 10).rotateZ(Math.PI / 2), M(px, .33, pz, ry), '#aaa', 'paint', 0); }
  addCollider(ctx, rectPoly(x, z, .5, 1.9, -ry));
}

export function shade(hex, k) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }

// ---------- panneaux ----------
export function sign(ctx, text, x, y, z, ry, w = 3.2, h = 1.0, o = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: signTexture(text, { bg: o.bg || '#1e6fb8', fg: o.fg || '#ffffff', w: 512, h: Math.round(512 * h / w), sub: o.sub || '', border: o.border || '#ffffff' }), roughness: .7 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x + Math.sin(ry) * .05, y, z + Math.cos(ry) * .05); m.rotation.y = ry; m.castShadow = false; m.receiveShadow = true;
  ctx.B.add(G.box, M(x, y, z, ry, w + .12, h + .12, .08), '#33302e', 'paint', 0);
  ctx.extras.push(m);
  if (o.posts) for (const s of [-1, 1]) ctx.B.add(G.cyl, M(x + Math.cos(ry) * s * (w / 2 - .1), (y - h / 2) / 2, z - Math.sin(ry) * s * (w / 2 - .1), 0, .06, y - h / 2, .06), '#4a4a4a', 'paint', 0);
}
