// Les quatre zones du jeu + le foyer de Yaaba. Chaque fonction construit autour d'une origine (ox, oz).
import * as THREE from 'three';
import { M, G } from './batch.js';
import { rng } from './textures.js';
import { house, hut, granary, compoundWalls, tree, shrub, chair, table, bench, parasol, barrel, crate, sack, pile, bowl, pole, lamp, parkedMoto, slab, sign, addCollider, rectPoly, rectCollider, shade, DOORS } from './props.js';

const face = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
const A = (ctx, name, x, z, toX, toZ, y = 0) => { ctx.anchors[name] = { x, y, z, ry: face(x, z, toX, toZ) }; };
const amb = (ctx, spec, x, z, toX, toZ, mode = 'idle', y = 0) => ctx.ambient.push({ spec, x, y, z, ry: face(x, z, toX, toZ), mode });

export const FOOTPRINTS = {
  home:    { w: 28, d: 22 }, market: { w: 52, d: 46 }, maquis: { w: 26, d: 20 }, taxi: { w: 20, d: 8 },
  csps:    { w: 68, d: 50 }, meeting: { w: 70, d: 48 }, culture: { w: 82, d: 60 },
};

export function buildHome(ctx, ox, oz) {
  const { B, R } = ctx;
  compoundWalls(ctx, ox, oz, 24, 17, 'nsw', 3.4, '#e6c9a0');
  house(ctx, ox, oz + 4.2, 10, 5, { ry: Math.PI, wall: '#e8d2a8', roof: '#8e949a', kind: 'mono', doorX: 1.5, h: 3.0 });
  hut(ctx, ox + 8, oz - .5, 1.9); hut(ctx, ox + 8, oz + 5, 1.6); granary(ctx, ox - 8.5, oz - 1);
  tree(ctx, ox - 8.5, oz + 4.5, 1.15, 'mango'); bench(ctx, ox - 6.6, oz + 4.3, Math.PI / 2, 2.0);
  B.add(G.cyl, M(ox - 3, .5, oz - 3.5, 0, .45, 1.0, .45), '#8a5a3a', 'paint', .05);                // canari
  barrel(ctx, ox + 4.5, oz - 4.5, '#2b6cb0');
  for (let i = 0; i < 3; i++) B.add(G.ico0, M(ox + 2 + i * .5, .12, oz + 7.1, 0, .22, .16, .22), '#6a9a3a', 'paint', .1);
  A(ctx, 'home', ox + 1.6, oz + 1.3, ox + 1.6, oz - 10);
  ctx.anchors.spawn = { x: ox - 1.2, y: 0, z: oz - 13, ry: Math.PI };
}

// ------------------------------------------------------------------ MARCHÉ
export function buildMarket(ctx, ox, oz) {
  const { B, R } = ctx;
  ctx.decal('earthLight', ox, oz, 50, 44);
  const goods = [
    ['#d93a2a', 'tomates'], ['#b66aa0', 'oignons'], ['#f3a712', 'mangues'], ['#e8dcc0', 'riz'], ['#f39c12', 'oranges'], ['#4f9a3a', 'piments'], ['#d84c2a', 'piments'],
  ];
  const cols = [['#e53935', '#fdd835', '#1e88e5'], ['#8e24aa', '#ffb300', '#26a69a'], ['#2e7d32', '#fdd835', '#d81b60'], ['#ef6c00', '#fafafa', '#0288d1']];
  const npcCols = { t: 0, o: 1, r: 2 };
  for (let row = 0; row < 3; row++) for (let c = 0; c < 5; c++) {
    const x = ox + (c - 2) * 9.2, z = oz + (row - 1) * 12.5;
    const isNpc = row === 1 && c >= 1 && c <= 3;
    const key = isNpc ? ['t', 'o', 'r'][c - 1] : null;
    const g = key ? (key === 't' ? goods[0] : key === 'o' ? goods[1] : goods[3]) : goods[(row * 5 + c + 2) % goods.length];
    table(ctx, x, z, 2.6, 1.1, '#9a6a3a');
    rectCollider(ctx, x, z, 2.7, 1.2);
    parasol(ctx, x, z - .6, 2.1, cols[(row + c) % cols.length]);
    if (g[1] === 'riz') { for (let i = 0; i < 4; i++) sack(ctx, x - 1.0 + i * .6, z, 0, '#e8dcc0', 1.3); bowl(ctx, x + .9, .8, z, .22, '#d9a05b'); }
    else { for (let i = -1; i <= 1; i++) { pile(ctx, x + i * .8, .78, z, g[0], 16, .1, .34); bowl(ctx, x + i * .8, .78, z, .38, '#b98050'); } }
    sack(ctx, x + 1.9, z + 1.4, R() * 6, '#cdbd96'); crate(ctx, x - 1.9, z + 1.2, R() * 3, .5);
    if (key) { A(ctx, 'market.' + key, x, z - 1.5, x, z + 6); }
    else if (R() < .65) amb(ctx, ctx.randomSpec(R, 'vendor'), x + (R() - .5) * 1.5, z - 1.5, x, z + 6, 'idle');
  }
  // entrée
  sign(ctx, 'MARCHÉ', ox, 4.1, oz - 21.5, Math.PI, 5.6, 1.3, { bg: '#c0392b', sub: 'Frais • Légumes • Céréales', posts: true });
  sign(ctx, 'MARCHÉ', ox, 4.1, oz - 21.5, 0, 5.6, 1.3, { bg: '#c0392b', sub: 'Frais • Légumes • Céréales' });
  for (let i = 0; i < 5; i++) { const x = ox - 22 + R() * 44, z = oz + 18 + R() * 3; pile(ctx, x, 0, z, '#e8dcc0', 10, .22, .5); }
  for (const [x, z] of [[-24, -18], [24, -18], [-24, 19], [24, 19]]) { B.add(G.cyl, M(ox + x, 1.4, oz + z, 0, .1, 2.8, .1), '#6a5a48', 'paint', 0); ctx.circles.push({ x: ox + x, z: oz + z, r: .15 }); }
  barrel(ctx, ox + 21, oz - 17, '#2b6cb0'); barrel(ctx, ox + 21.8, oz - 17, '#c0392b');
  tree(ctx, ox - 25, oz + 6, 1.3, 'neem'); tree(ctx, ox + 26, oz - 8, 1.2, 'mango');
  for (let i = 0; i < 4; i++) amb(ctx, ctx.randomSpec(R, 'shopper'), ox - 15 + i * 10, oz + 6.2 + (R() - .5) * 2, ox - 15 + i * 10, oz, 'idle');
  ctx.zones.push({ key: 'quartier', name: 'Marché', x: ox, z: oz, r: 28, sub: 'market' });
}

// ------------------------------------------------------------------ MAQUIS
export function buildMaquis(ctx, ox, oz) {
  const { B, R } = ctx;
  ctx.decal('paving', ox, oz, 20, 14);
  slab(ctx, ox, 3.4, oz, 17, 12, 0, .05, '#7a8087', .12);
  for (const [x, z] of [[-8, -5.5], [8, -5.5], [-8, 5.5], [8, 5.5], [0, -5.5], [0, 5.5]]) { B.add(G.cyl, M(ox + x, 1.7, oz + z, 0, .12, 3.4, .12), '#5a3c28', 'paint', 0); ctx.circles.push({ x: ox + x, z: oz + z, r: .18 }); }
  const tcol = ['#c0392b', '#2e86de', '#27ae60', '#f39c12'];
  [[-5.5, -1.5], [-1.5, -1.5], [2.5, -1.5], [6, -1.5], [-5.5, 2.4], [-1.5, 2.4]].forEach(([x, z], i) => {
    table(ctx, ox + x, oz + z, 1.0, 1.0, '#e8e3d6'); B.add(G.box, M(ox + x, .8, oz + z, 0, 1.05, .02, 1.05), tcol[i % 4], 'paint', 0);
    for (const [a, b] of [[-.8, 0], [.8, 0], [0, -.8], [0, .8]]) chair(ctx, ox + x + a, oz + z + b, Math.atan2(-a, -b), tcol[(i + 1) % 4]);
    rectCollider(ctx, ox + x, oz + z, 1.1, 1.1);
  });
  // comptoir + réfrigérateur
  B.add(G.box, M(ox + 1, .55, oz + 5.0, 0, 8, 1.1, .9), '#a0522d', 'paint', .04); B.add(G.box, M(ox + 1, 1.12, oz + 5.0, 0, 8.2, .08, 1.0), '#6a3a1e', 'paint', 0);
  rectCollider(ctx, ox + 1, oz + 5.0, 8.2, 1.0);
  B.add(G.box, M(ox + 6.8, .9, oz + 5.7, 0, .9, 1.8, .8), '#f2f2f2', 'paint', 0); B.add(G.box, M(ox + 6.8, 1.45, oz + 5.28, 0, .78, .02, .02), '#c0392b', 'paint', 0);
  for (let i = 0; i < 9; i++) B.add(G.cyl, M(ox - 2.5 + i * .55, 1.28, oz + 5.0, 0, .05, .26, .05), ['#6b3f1d', '#2e7d32', '#c0392b', '#f1c40f'][i % 4], 'paint', .05);
  // grill (poulet braisé) + fumée
  B.add(G.box, M(ox - 9.2, .45, oz + 2.5, 0, 1.6, .9, 2.4), '#3b3f45', 'paint', 0); B.add(G.box, M(ox - 9.2, .93, oz + 2.5, 0, 1.4, .08, 2.2), '#ff6a1a', 'glow', 0);
  for (let i = 0; i < 4; i++) B.add(new THREE.CapsuleGeometry(.12, .2, 3, 8).rotateZ(Math.PI / 2), M(ox - 9.2, 1.04, oz + 1.8 + i * .5), '#b86a2a', 'paint', .08);
  rectCollider(ctx, ox - 9.2, oz + 2.5, 1.8, 2.6);
  ctx.smoke.push({ x: ox - 9.2, y: 1.2, z: oz + 2.5 });
  // guirlande lumineuse
  for (let i = 0; i < 18; i++) B.add(G.sphere, M(ox - 8 + i * .94, 3.15 - Math.sin(i / 17 * 3.14) * .15, oz - 5.4, 0, .07, .07, .07), ['#ffd54f', '#ff8a65', '#fff59d'][i % 3], 'glow', 0);
  sign(ctx, 'MAQUIS', ox, 4.15, oz - 6.2, Math.PI, 5.0, 1.15, { bg: '#7b1e12', sub: 'Poulet braisé • Riz • Bissap' });
  sign(ctx, 'MAQUIS', ox, 4.15, oz + 6.2, 0, 5.0, 1.15, { bg: '#7b1e12', sub: 'Poulet braisé • Riz • Bissap' });
  A(ctx, 'maquis', ox + 3.2, oz + 3.8, ox + 3.2, oz - 8);
  amb(ctx, ctx.randomSpec(R, 'client_m'), ox + 2.5 + .0, oz - 1.5 + 1.0, ox + 2.5, oz - 1.5, 'sit');
  ctx.zones.push({ key: 'quartier', name: 'Maquis', x: ox, z: oz, r: 12, sub: 'maquis' });
}

// ------------------------------------------------------------------ TAXI-MOTO
export function buildTaxi(ctx, ox, oz) {
  const { B, R } = ctx;
  parasol(ctx, ox + 3.5, oz - 2.5, 2.4, ['#fdd835', '#212121'], 2.6);
  bench(ctx, ox + 3.5, oz - 3.6, 0, 2.4, '#8a5a3a');
  const cols = ['#c0392b', '#2e86de', '#27ae60', '#e67e22', '#8e44ad'];
  for (let i = 0; i < 5; i++) parkedMoto(ctx, ox - 6 + i * 2.3, oz - 2.2 + (R() - .5) * .5, Math.PI / 2 * 0 + (R() - .5) * .35, cols[i]);
  sign(ctx, 'TAXI-MOTO', ox - 3, 3.2, oz - 5.3, Math.PI, 3.4, .9, { bg: '#f1c40f', fg: '#1a1a1a', border: '#1a1a1a', posts: true });
  A(ctx, 'taxi', ox + 1.4, oz - 3.3, ox + 1.4, oz + 8);
  amb(ctx, ctx.randomSpec(R, 'rider'), ox + 5.5, oz - 3.3, ox + 1.4, oz + 8, 'idle');
  ctx.zones.push({ key: 'quartier', name: 'Station de taxi-moto', x: ox, z: oz, r: 9, sub: 'taxi' });
}

// ------------------------------------------------------------------ CENTRE DE SANTÉ
export function buildCSPS(ctx, ox, oz) {
  const { B, R } = ctx;
  ctx.decal('paving', ox, oz + 6, 44, 24);
  compoundWalls(ctx, ox, oz, 64, 46, 'snwe', 9, '#dfe9ef');  // portails sur les 4 côtés : on entre d'où qu'on vienne
  const wall = '#e9eef0', band = '#1d6fb8', bz = oz - 9;
  // bâtiment principal
  B.add(G.box, M(ox, 2.0, bz, 0, 27, 4.0, 8), wall, 'wall', 0); B.add(G.box, M(ox, .25, bz, 0, 27.2, .5, 8.2), '#9aa5ad', 'wall', 0);
  B.add(G.box, M(ox, 3.7, bz + 4.02, 0, 27.2, .5, .08), band, 'paint', 0);
  slab(ctx, ox, 4.5, bz, 29.5, 11, 0, .1, '#7a8087', .12);
  addCollider(ctx, rectPoly(ox, bz, 27, 8));
  for (let i = -5; i <= 5; i++) if (Math.abs(i) > 1) { B.add(G.box, M(ox + i * 2.4, 1.7, bz + 4.04, 0, 1.2, 1.1, .06), '#2b3a47', 'paint', 0); B.add(G.box, M(ox + i * 2.4, 1.7, bz + 4.07, 0, 1.4, 1.3, .04), band, 'paint', 0); }
  B.add(G.box, M(ox, 1.2, bz + 4.04, 0, 2.6, 2.4, .08), '#1d6fb8', 'paint', 0);       // porte d'entrée
  B.add(G.box, M(ox - .65, 1.2, bz + 4.09, 0, 1.2, 2.2, .04), '#bfe0f2', 'paint', 0); B.add(G.box, M(ox + .65, 1.2, bz + 4.09, 0, 1.2, 2.2, .04), '#bfe0f2', 'paint', 0);
  // véranda
  slab(ctx, ox, 3.55, bz + 6.1, 27, 4.2, 0, .1, '#8e949a', .1);
  for (let i = -6; i <= 6; i++) { B.add(G.cyl, M(ox + i * 2.2, 1.78, bz + 7.8, 0, .1, 3.55, .1), '#f4f6f7', 'paint', 0); ctx.circles.push({ x: ox + i * 2.2, z: bz + 7.8, r: .14 }); }
  sign(ctx, 'CSPS', ox, 5.7, bz + 4.4, 0, 6.4, 1.8, { bg: '#1d6fb8', sub: 'Centre de Santé', size: 120 });
  B.add(G.box, M(ox - 4.9, 5.75, bz + 4.46, 0, 1.3, .36, .06), '#ffffff', 'paint', 0); B.add(G.box, M(ox - 4.9, 5.75, bz + 4.46, 0, .36, 1.3, .06), '#ffffff', 'paint', 0);  // croix
  // accueil sous la véranda
  table(ctx, ox - 8, bz + 5.0, 2.2, .9, '#8a5a3a'); B.add(G.box, M(ox - 8, 1.0, bz + 5.0, 0, .5, .35, .04), '#222', 'paint', 0); B.add(G.box, M(ox - 8, .86, bz + 4.95, 0, .3, .04, .25), '#555', 'paint', 0);
  rectCollider(ctx, ox - 8, bz + 5.0, 2.3, 1.0);
  A(ctx, 'csps.accueil', ox - 8, bz + 4.35, ox - 8, bz + 14);
  for (const x of [-2, 3.5, 9]) bench(ctx, ox + x, bz + 7.1, Math.PI, 2.4, '#4a6f8a');
  amb(ctx, ctx.randomSpec(R, 'patient_f'), ox + 3.4, bz + 6.4, ox + 3.4, bz + 14, 'sit');
  amb(ctx, ctx.randomSpec(R, 'patient_m'), ox + 9.4, bz + 6.4, ox + 9.4, bz + 14, 'sit');
  // pavillon de consultation
  const cx = ox + 17.5, cz = oz + 6;
  slab(ctx, cx, 3.4, cz, 7.5, 6.5, 0, .06, '#8e949a', .1);
  for (const [x, z] of [[-3.3, -2.8], [3.3, -2.8], [-3.3, 2.8], [3.3, 2.8]]) { B.add(G.cyl, M(cx + x, 1.6, cz + z, 0, .1, 3.2, .1), '#f4f6f7', 'paint', 0); ctx.circles.push({ x: cx + x, z: cz + z, r: .14 }); }
  B.add(G.box, M(cx, .2, cz, 0, 7, .4, 6), '#d3dadf', 'wall', 0);
  B.add(G.box, M(cx + 1.6, .6, cz - .6, 0, 1.0, .5, 2.2), '#f4f4f4', 'paint', 0); B.add(G.box, M(cx + 1.6, .88, cz - .6, 0, .9, .1, 2.0), '#3a8fc0', 'paint', 0);
  rectCollider(ctx, cx + 1.6, cz - .6, 1.1, 2.3);
  table(ctx, cx - 1.8, cz - 1.2, 1.5, .8, '#8a5a3a'); rectCollider(ctx, cx - 1.8, cz - 1.2, 1.6, .9);
  B.add(G.box, M(cx - 2.8, .45, cz + 1.4, 0, .5, .9, .4), '#cfd6da', 'paint', 0); B.add(G.box, M(cx - 2.8, 1.0, cz + 1.4, 0, .3, .1, .3), '#2b2b2b', 'paint', 0);  // balance
  sign(ctx, 'CONSULTATION', cx, 3.0, cz + 3.35, 0, 3.6, .8, { bg: '#2f8f83' });
  A(ctx, 'csps.consult', cx - 1.0, cz + 1.1, cx - 12, cz + 4);
  // maternité / CPN
  const mx = ox - 18, mz = oz + 2.5;
  house(ctx, mx, mz, 10, 6, { ry: 0, wall: '#f1e9f2', roof: '#6b7a8a', kind: 'mono', h: 3.1, doorX: 0 });
  B.add(G.box, M(mx, 2.75, mz + 3.1, 0, 10.6, .25, .1), '#d46a9a', 'paint', 0);
  sign(ctx, 'CPN', mx, 4.6, mz + 3.4, 0, 3.2, 1.2, { bg: '#c2527f', sub: 'Maternité', size: 110 });
  A(ctx, 'csps.pre', mx - 2.6, mz + 4.2, mx, mz + 14);
  // ambulance
  const ax = ox + 25, az = oz + 17;
  B.add(G.box, M(ax, 1.1, az, Math.PI / 2, 5.0, 1.8, 2.2), '#f4f4f4', 'paint', 0); B.add(G.box, M(ax + 2.8, .85, az, Math.PI / 2, 1.8, 1.2, 2.2), '#f4f4f4', 'paint', 0);
  B.add(G.box, M(ax, 1.5, az + 1.12, Math.PI / 2, 4.6, .3, .02), '#c0392b', 'paint', 0); B.add(G.box, M(ax, 1.5, az - 1.12, Math.PI / 2, 4.6, .3, .02), '#c0392b', 'paint', 0);
  for (const dx of [-1.5, 1.6]) for (const dz of [-1.05, 1.05]) B.add(new THREE.CylinderGeometry(.38, .38, .3, 12).rotateX(Math.PI / 2), M(ax + dx, .38, az + dz), '#1a1a1a', 'paint', 0);
  B.add(G.box, M(ax, 2.1, az, 0, .3, .12, .5), '#e53935', 'glow', 0);
  addCollider(ctx, rectPoly(ax, az, 5.1, 2.3, -Math.PI / 2 * 0 - Math.PI / 2 * 0 + 0));
  tree(ctx, ox - 4, oz + 16, 1.2, 'neem'); tree(ctx, ox + 8, oz + 18, 1.1, 'mango'); tree(ctx, ox - 27, oz + 14, 1.2, 'neem');
  for (let i = 0; i < 6; i++) B.add(G.ico, M(ox - 12 + i * 1.1, .3, oz + 12, R() * 6, .45, .35, .45), ['#d84c7a', '#f3c912', '#e84c3d'][i % 3], 'paint', .1);
  ctx.zones.push({ key: 'sante', name: 'Centre de santé', x: ox, z: oz, r: 32, sub: 'csps' });
}

// ------------------------------------------------------------------ PLACE DES BONNES NOUVELLES
export function buildMeeting(ctx, ox, oz) {
  const { B, R } = ctx;
  ctx.decal('paving', ox, oz, 58, 42);
  const py = oz - 14;
  // podium
  B.add(G.box, M(ox, .5, py, 0, 13, 1.0, 6.4), '#b9b2a6', 'wall', 0); B.add(G.box, M(ox, 1.03, py, 0, 13.2, .08, 6.6), '#8a2a22', 'paint', 0);
  addCollider(ctx, rectPoly(ox, py, 13, 6.4));
  B.add(G.box, M(ox, .25, py + 3.9, 0, 3.6, .5, 1.0), '#a8a196', 'wall', 0); B.add(G.box, M(ox, .12, py + 4.5, 0, 3.6, .24, 0.9), '#a8a196', 'wall', 0);
  // auvent + draps tricolores
  for (const [x, z] of [[-6, -2.6], [6, -2.6], [-6, 2.6], [6, 2.6]]) { B.add(G.cyl, M(ox + x, 3.2, py + z, 0, .12, 4.4, .12), '#555', 'paint', 0); }
  B.add(G.box, M(ox, 5.4, py, 0, 13.4, .12, 6.4), '#7a8087', 'paint', 0);
  const stripes = ['#d6232a', '#f6cf1c', '#1b9a48'];
  stripes.forEach((c, i) => B.add(G.box, M(ox, 5.2, py - 2.1 + i * 2.1, 0, 13.0, .08, 2.0), c, 'paintDS', 0));
  sign(ctx, 'BIENVENUE', ox, 3.5, py - 2.9, 0, 9.5, 2.2, { bg: '#0f5d2e', fg: '#f6cf1c', sub: 'Place des bonnes nouvelles', border: '#f6cf1c' });
  // haut-parleurs
  for (const s of [-1, 1]) { B.add(G.cyl, M(ox + s * 8.4, 1.2, py + 1, 0, .05, 2.4, .05), '#222', 'paint', 0); B.add(G.box, M(ox + s * 8.4, 2.8, py + 1, 0, .8, 1.4, .6), '#1b1b1b', 'paint', 0); B.add(G.cyl, M(ox + s * 8.4, 3.0, py + 1.31, 0, .24, .02, .24, Math.PI / 2), '#333', 'paint', 0); }
  // pupitre
  B.add(G.box, M(ox, 1.6, py + 1.2, 0, 1.0, 1.1, .6), '#6a3a1e', 'paint', 0); B.add(G.box, M(ox, 2.2, py + 1.2, 0, .12, .5, .12), '#222', 'paint', 0);
  A(ctx, 'meeting.podium', ox, py + .2, ox, oz + 20, 1.08);
  // drapeaux
  for (let i = 0; i < 6; i++) {
    const x = ox - 25 + i * 10, z = oz - 19;
    B.add(G.cyl, M(x, 3.6, z, 0, .06, 7.2, .06), '#bfbfbf', 'paint', 0); B.add(G.sphere, M(x, 7.3, z, 0, .1, .1, .1), '#f6cf1c', 'paint', 0);
    ctx.flags.push({ x: x + .9, y: 6.2, z, i }); ctx.circles.push({ x, z, r: .12 });
  }
  // fanions
  for (let k = 0; k < 2; k++) for (let i = 0; i < 24; i++) {
    const t = i / 23, x = ox - 25 + t * 50, z = oz - 19 + k * 38 - (k ? 0 : 0), y = 6.0 - Math.sin(t * 3.14) * 1.0 - (i % 2) * .0;
    B.add(new THREE.ConeGeometry(.22, .5, 3).rotateX(Math.PI), M(x, y - .25, z), stripes[i % 3], 'paintDS', 0);
  }
  // chaises
  const cc = ['#d6232a', '#f6cf1c', '#1b9a48'];
  for (let r = 0; r < 6; r++) for (let c = -7; c <= 7; c++) {
    if (Math.abs(c) < 1) continue;
    chair(ctx, ox + c * .95 + Math.sign(c) * .2, oz + 2 + r * 1.5, Math.PI, cc[(r + (c + 7)) % 3]);
  }
  // tentes sur les côtés
  for (const s of [-1, 1]) {
    const tx = ox + s * 25, tz = oz + 3;
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) B.add(G.cyl, M(tx + x, 1.5, tz + z, 0, .07, 3, .07), '#999', 'paint', 0);
    B.add(G.box, M(tx, 3.1, tz, 0, 7.4, .1, 7.4), '#f2f2f2', 'paintDS', 0); B.add(new THREE.ConeGeometry(5.3, 1.0, 4).rotateY(Math.PI / 4), M(tx, 3.6, tz), '#f2f2f2', 'paintDS', 0);
    table(ctx, tx, tz, 3.0, 1.0, '#d9d4c7'); rectCollider(ctx, tx, tz, 3.1, 1.1);
    for (let i = -1; i <= 1; i++) bowl(ctx, tx + i * .9, .78, tz, .22, '#d9a05b');
  }
  // foule
  const n = ctx.quality === 'low' ? 5 : 11;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 4), c = (i % 4) - 1.5;
    const x = ox + (i % 2 ? 1 : -1) * (2 + (i * 1.9) % 9), z = oz + 1.2 + r * 1.5 + (i % 3) * .2;
    amb(ctx, ctx.randomSpec(R, i % 3 === 0 ? 'crowd_f' : 'crowd_m'), x, z, ox, py, 'cheer');
  }
  tree(ctx, ox - 31, oz + 12, 1.4, 'neem'); tree(ctx, ox + 31, oz - 10, 1.3, 'neem'); tree(ctx, ox + 30, oz + 16, 1.2, 'mango');
  ctx.zones.push({ key: 'meeting', name: 'Place des bonnes nouvelles', x: ox, z: oz, r: 30, sub: 'meeting' });
}

// ------------------------------------------------------------------ COIN CULTUREL
function rockColumn(ctx, x, z, r, h, seed) {
  const { B } = ctx, R = rng(seed);
  const cols = ['#b08a62', '#c29a6c', '#a57e58', '#cfa877'];
  const seg = 3, sh = h / seg;
  for (let i = 0; i < seg; i++) {
    const g = new THREE.CylinderGeometry(r * (1 - (i + 1) * .08), r * (1 - i * .08), sh, 9, 3);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { // déformation reproductible selon la position
      const px = p.getX(k), py = p.getY(k), pz = p.getZ(k);
      const n = 1 + .16 * Math.sin(px * 3.1 + seed) * Math.cos(pz * 2.7 + py * 1.9 + seed * 2) + .07 * Math.sin(py * 5 + seed);
      p.setXYZ(k, px * n, py, pz * n);
    }
    g.computeVertexNormals();
    B.add(g, M(x, i * sh + sh / 2, z, R() * 6, 1, 1, 1), cols[(i + Math.floor(R() * 3)) % 4], 'paint', .04);
  }
  B.add(G.ico, M(x, h + .1, z, R() * 6, r * .72, r * .4, r * .72), '#b8935f', 'paint', .05);
  ctx.circles.push({ x, z, r: r * 1.05 });
}

export function buildCulture(ctx, ox, oz) {
  const { B, R } = ctx;
  ctx.decal('earthLight', ox, oz, 78, 54);
  const S = { sindou: [-27, 11], loro: [24, 14], faso: [24, -12], cuisine: [-24, -11] };
  // allées
  for (const [k, [sx, sz]] of Object.entries(S)) {
    const len = Math.hypot(sx, sz), ang = Math.atan2(sx, sz);
    ctx.decal('paving', ox + sx / 2, oz + sz / 2, 3.2, len, 0.03, ang);
  }
  tree(ctx, ox, oz, 1.35, 'baobab');
  bench(ctx, ox + 4.4, oz + 4.0, Math.PI * .75, 2.0); bench(ctx, ox - 4.4, oz - 4, -Math.PI * .25, 2.0);
  // portail
  sign(ctx, 'ESPACE CULTURE', ox, 5.0, oz - 27, Math.PI, 8.0, 1.5, { bg: '#4a2f78', sub: 'et patrimoine du Burkina', posts: true });
  // --- Sindou
  const [sx, sz] = [ox + S.sindou[0], oz + S.sindou[1]];
  [[0, 0, 1.5, 8.5], [2.8, 1.2, 1.1, 6.2], [-2.6, 1.6, 1.2, 7.1], [1.6, -2.4, 1.0, 5.2], [-1.4, -2.6, 1.3, 6.6], [4.4, -1.0, .9, 4.0], [-4.3, -.6, 1.0, 4.8], [.4, 3.6, .9, 3.7], [3.4, -3.8, .8, 3.0]]
    .forEach(([dx, dz, r, h], i) => rockColumn(ctx, sx + dx, sz + dz, r, h, 11 + i * 7));
  for (let i = 0; i < 8; i++) B.add(G.ico, M(sx + (R() - .5) * 12, .3, sz + (R() - .5) * 9, R() * 6, .5 + R() * .6, .4, .5 + R() * .6), '#b49066', 'paint', .06);
  sign(ctx, 'PICS DE SINDOU', sx + 3, 2.0, sz - 7.5, Math.PI, 3.6, 1.0, { bg: '#7a4a24', sub: 'Région des Cascades', posts: true });
  A(ctx, 'culture.sindou', sx + 4.5, sz - 5.2, ox, oz);
  // --- Loropéni
  const [lx, lz] = [ox + S.loro[0], oz + S.loro[1]];
  const stone = ['#6f4a36', '#7d5440', '#5f3f2e', '#86604a'];
  const wallSeg = (x1, z1, x2, z2, hh) => {
    const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(L / 1.6)), a = Math.atan2(-(z2 - z1), x2 - x1);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t, hh2 = hh * (.55 + R() * .55);
      B.add(G.box, M(px, hh2 / 2, pz, a, L / n + .1, hh2, 1.0 + R() * .2), stone[i % 4], 'paint', .06);
      if (R() < .5) B.add(G.box, M(px + (R() - .5) * .5, hh2 + .2, pz, a + (R() - .5) * .5, (L / n) * .6, .45, .9), stone[(i + 1) % 4], 'paint', .06);
    }
    addCollider(ctx, rectPoly((x1 + x2) / 2, (z1 + z2) / 2, Math.abs(x2 - x1) > Math.abs(z2 - z1) ? L : 1.2, Math.abs(x2 - x1) > Math.abs(z2 - z1) ? 1.2 : L));
  };
  const hw = 7.5, hd = 5.5;
  wallSeg(lx - hw, lz - hd, lx + hw, lz - hd, 3.6); wallSeg(lx - hw, lz - hd, lx - hw, lz + hd, 3.2); wallSeg(lx + hw, lz - hd, lx + hw, lz + hd, 3.4);
  wallSeg(lx - hw, lz + hd, lx - 1.8, lz + hd, 3.0); wallSeg(lx + 1.8, lz + hd, lx + hw, lz + hd, 3.0);
  for (let i = 0; i < 9; i++) B.add(G.box, M(lx + (R() - .5) * 11, .25, lz + (R() - .5) * 8, R() * 3, .8 + R(), .5, .7), stone[i % 4], 'paint', .08);
  sign(ctx, 'RUINES DE LOROPÉNI', lx, 2.0, lz + hd + 3.2, 0, 4.2, 1.0, { bg: '#3b2a22', sub: 'Patrimoine mondial UNESCO', posts: true });
  A(ctx, 'culture.loro', lx - 4.8, lz + hd + 2.6, ox, oz);
  // --- tissage
  const [fx, fz] = [ox + S.faso[0], oz + S.faso[1]];
  for (const [x, z] of [[-1.9, -1], [1.9, -1], [-1.9, 1], [1.9, 1]]) { B.add(G.cyl, M(fx + x, 1.2, fz + z, 0, .07, 2.4, .07), '#6a4a2a', 'paint', 0); ctx.circles.push({ x: fx + x, z: fz + z, r: .12 }); }
  B.add(G.box, M(fx, 2.4, fz, 0, 4.0, .12, 2.2), '#5a3c28', 'paint', 0); slab(ctx, fx, 2.9, fz, 4.8, 3.2, 0, .1, '#a08a60', .08);
  B.add(G.box, M(fx, 1.4, fz - .3, 0, 3.0, .09, .09), '#7a5a3a', 'paint', 0); B.add(G.box, M(fx, .9, fz + .1, 0, 3.2, .06, .08), '#7a5a3a', 'paint', 0);
  for (let i = 0; i < 26; i++) B.add(G.box, M(fx - 1.45 + i * .115, 1.15, fz - .1, 0, .012, 1.0, .01), ['#f4efe2', '#b22222', '#e9b82e', '#1d1d1d'][i % 4], 'paint', 0);
  B.add(G.box, M(fx, .35, fz + 1.5, 0, .5, .5, .5), '#6a4a2a', 'paint', 0);
  for (let k = 0; k < 4; k++) ctx.fdfPlanes.push({ x: fx - 7 + k * 1.4 + (k > 1 ? 1 : 0), y: 1.8, z: fz + 4.2, w: 1.0, h: 2.0, ry: 0, p: k });
  B.add(G.cyl, M(fx - 4.6, 1.8, fz + 4.2, 0, .03, 3.6, .03), '#6a4a2a', 'paint', 0); B.add(G.cyl, M(fx + 3.4, 1.8, fz + 4.2, 0, .03, 3.6, .03), '#6a4a2a', 'paint', 0);
  B.add(G.box, M(fx - 1.6, 2.7, fz + 4.2, 0, 8.2, .05, .05), '#6a4a2a', 'paint', 0);
  for (let i = 0; i < 6; i++) B.add(G.sphere, M(fx + 2.8 + (R() - .5) * 1.2, .3, fz - 2.5 + (R() - .5), 0, .26, .22, .26), '#fbfaf5', 'paint', .02);
  sign(ctx, 'FASO DAN FANI', fx + 1, 3.6, fz - 2.9, Math.PI, 3.4, .9, { bg: '#b22222', sub: 'Tissage traditionnel' });
  A(ctx, 'culture.faso', fx + 3.1, fz - 3.9, ox, oz);
  // --- cuisine
  const [kx, kz] = [ox + S.cuisine[0], oz + S.cuisine[1]];
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; B.add(G.ico0, M(kx + Math.cos(a) * .5, .22, kz + Math.sin(a) * .5, a, .24, .22, .24), '#4a4440', 'paint', .05); }
  B.add(G.sphere, M(kx, .0 + .85, kz, 0, .62, .5, .62), '#1c1c1c', 'paint', 0); B.add(new THREE.TorusGeometry(.6, .05, 6, 16).rotateX(Math.PI / 2), M(kx, 1.15, kz), '#2b2b2b', 'paint', 0);
  B.add(G.cyl, M(kx, .34, kz, 0, .4, .1, .4), '#ff7a1a', 'glow', 0); ctx.circles.push({ x: kx, z: kz, r: .8 });
  ctx.smoke.push({ x: kx, y: 1.3, z: kz });
  table(ctx, kx + 2.6, kz + 1.0, 2.2, .9, '#9a6a3a'); rectCollider(ctx, kx + 2.6, kz + 1.0, 2.3, 1.0);
  for (let i = 0; i < 3; i++) bowl(ctx, kx + 1.8 + i * .8, .78, kz + 1.0, .24, '#e8c36a');
  for (let i = 0; i < 3; i++) { B.add(G.cyl, M(kx + 3.9 + i * .22, .5, kz + 1.0 + i * .1, 0, .09, .5, .09), '#b5183d', 'paint', .04); }
  for (let i = 0; i < 4; i++) bowl(ctx, kx - 1.6 + i * .5, .1, kz + 2.2, .3, '#c98a4a');
  for (const s of [[-.6, 2.0], [.6, 2.2]]) { B.add(G.cyl, M(kx + s[0] - 1.2, .2, kz + s[1], 0, .22, .4, .22), '#8a5a3a', 'paint', .05); }
  parasol(ctx, kx + 1.4, kz + .4, 3.2, ['#f39c12', '#ffffff'], 2.8);
  sign(ctx, 'CUISINE DU FASO', kx, 3.8, kz - 3.2, Math.PI, 3.8, .9, { bg: '#c75a1a', sub: 'Tô • Sauces • Bissap', posts: true });
  A(ctx, 'culture.cuisine', kx + 4.8, kz + 2.4, ox, oz);
  // --- cinéma en plein air
  const cx = ox, cz = oz + 22;
  B.add(G.box, M(cx, 3.1, cz + 4, 0, 7.4, 4.0, .08), '#f4f1e8', 'paint', 0); B.add(G.box, M(cx, 3.1, cz + 4.06, 0, 7.8, 4.4, .06), '#222', 'paint', 0);
  for (const s of [-1, 1]) B.add(G.cyl, M(cx + s * 4, 1.2, cz + 4.1, 0, .09, 2.4, .09), '#333', 'paint', 0);
  for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) chair(ctx, cx + c * .85, cz - 1 + r * 1.3, 0, ['#8a2a22', '#1d6fb8', '#2e7d4f'][(r + c + 6) % 3]);
  sign(ctx, 'CINÉMA', cx, 6.0, cz + 4.1, 0, 3.0, .7, { bg: '#1c1c28', fg: '#f6cf1c', sub: 'en plein air', border: '#f6cf1c' });
  for (const [x, z] of [[-30, 20], [34, -22], [-34, -22], [36, 22]]) tree(ctx, ox + x, oz + z, 1.3, ((x + z) & 1) ? 'neem' : 'mango');
  amb(ctx, ctx.randomSpec(R, 'visitor_f'), ox + 5, oz + 10, ox - 4, oz + 14, 'idle'); amb(ctx, ctx.randomSpec(R, 'visitor_m'), ox - 9, oz + 6, ox - 27, oz + 11, 'idle');
  ctx.zones.push({ key: 'culture', name: 'Coin culturel', x: ox, z: oz, r: 38, sub: 'culture' });
}
