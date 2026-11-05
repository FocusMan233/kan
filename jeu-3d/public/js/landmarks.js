// Repères réels du quartier (mosquées, écoles, stations, marchés…) et plaques de rues, d'après OpenStreetMap.
import { M, G } from './batch.js';
import { sign, rectCollider, parasol } from './props.js';

export const LM = {
  mosque:   { label: 'Mosquée', wall: '#f3ecd9', roof: '#d9d2bd', h: 6.2, bg: '#1d7a4d' },
  church:   { label: 'Église', wall: '#efe7d6', roof: '#a0583a', h: 7.5, bg: '#5b3a8c' },
  worship:  { label: 'Lieu de culte', wall: '#efe7d6', roof: '#8e949a', h: 5, bg: '#5b3a8c' },
  school:   { label: 'École', wall: '#f2d27a', roof: '#a23a2f', h: 4.2, bg: '#c0392b' },
  health:   { label: 'Santé', wall: '#f4f4f0', roof: '#3aa6a0', h: 4, bg: '#1f8a85' },
  pharmacy: { label: 'Pharmacie', wall: '#e6f3e6', roof: '#2e8b57', h: 3.4, bg: '#1e8f5a' },
  market:   { label: 'Marché', wall: '#e8b86a', roof: '#8e949a', h: 3.6, bg: '#d9822b' },
  fuel:     { label: 'Station', wall: '#ececec', roof: '#c0392b', h: 3.4, bg: '#c0392b' },
  bank:     { label: 'Banque', wall: '#cfd8e2', roof: '#5c6b73', h: 4.6, bg: '#1f4e8c' },
  food:     { label: 'Restauration', wall: '#e9c9a0', roof: '#7a8087', h: 3.2, bg: '#b8541f' },
  hotel:    { label: 'Hôtel', wall: '#eadcc0', roof: '#a0583a', h: 6, bg: '#7b3fa0' },
  gov:      { label: 'Administration', wall: '#e7e1cf', roof: '#6b7a8a', h: 4.6, bg: '#1e6fb8' },
  sport:    { label: 'Sport', wall: '#d8d2c0', roof: '#6b7a8a', h: 3.2, bg: '#2e7d4f' },
  shop:     { label: 'Boutique', wall: '#e8c9a0', roof: '#8e949a', h: 3.2, bg: '#d4a017' },
  other:    { label: '', wall: '#e8d9b8', roof: '#8e949a', h: 3.4, bg: '#4a5568' },
};
export const lmStyle = t => LM[t] || LM.other;

const label = L => (L.name || lmStyle(L.type).label || '').slice(0, 34);

/** Décorations propres au type de lieu (minaret, croix, auvent de station…). b = {minx,maxx,minz,maxz,cx,cz,h} */
function features(ctx, L, b, dir) {
  const { B } = ctx, st = lmStyle(L.type);
  if (L.type === 'mosque') {
    const mx = b.maxx - .9, mz = b.minz + .9, mh = Math.max(11, b.h + 5);
    B.add(G.cyl, M(mx, mh / 2, mz, 0, .65, mh, .65), '#f3ecd9', 'wall', .02);
    B.add(G.cyl, M(mx, mh * .72, mz, 0, .95, .35, .95), '#1d7a4d', 'paint', 0);
    B.add(G.cone, M(mx, mh + .9, mz, 0, .8, 1.8, .8), '#1d7a4d', 'paint', 0);
    B.add(G.sphere, M(b.cx, b.h + .2, b.cz, 0, Math.min(2.6, (b.maxx - b.minx) / 3), Math.min(2.2, (b.maxx - b.minx) / 3.5), Math.min(2.6, (b.maxz - b.minz) / 3)), '#1d7a4d', 'paint', 0);
  } else if (L.type === 'church' || L.type === 'worship') {
    B.add(G.box, M(b.cx, b.h + 1.9, b.cz, 0, .28, 2.8, .28), '#f6f0e0', 'paint', 0);
    B.add(G.box, M(b.cx, b.h + 2.6, b.cz, 0, 1.5, .28, .28), '#f6f0e0', 'paint', 0);
  } else if (L.type === 'fuel') {
    const cx = b.cx + dir.x * ((b.maxx - b.minx) / 2 + 6), cz = b.cz + dir.z * ((b.maxz - b.minz) / 2 + 6);
    B.add(G.box, M(cx, 4.5, cz, 0, 10, .45, 6), '#c0392b', 'paint', 0);
    for (const sx of [-4, 4]) for (const sz of [-2, 2]) B.add(G.cyl, M(cx + sx, 2.2, cz + sz, 0, .16, 4.4, .16), '#dcdcdc', 'paint', 0);
    for (const sx of [-2.5, 2.5]) B.add(G.box, M(cx + sx, .55, cz, 0, .7, 1.1, .5), '#c0392b', 'paint', 0);
  } else if (L.type === 'market') {
    const cx = b.cx + dir.x * ((b.maxx - b.minx) / 2 + 4), cz = b.cz + dir.z * ((b.maxz - b.minz) / 2 + 4);
    for (let i = -1; i <= 1; i++) parasol(ctx, cx + dir.z * i * 4.2, cz - dir.x * i * 4.2, 1.8);
  } else if (L.type === 'school') {
    B.add(G.cyl, M(b.minx - .8, 4, b.minz - .8, 0, .06, 8, .06), '#aaaaaa', 'paint', 0);
    for (const [i, c] of ['#d6232a', '#f6cf1c', '#1b9a48'].entries()) B.add(G.box, M(b.minx - .8 + .55, 7.3 - i * .26, b.minz - .8, 0, 1.1, .26, .03), c, 'paint', 0);
  }
}

/** Plaque avec le nom, plantée devant le lieu, face à la rue la plus proche. */
function nameSign(ctx, L, b, dir) {
  const st = lmStyle(L.type), t = label(L); if (!t) return;
  const r = Math.max(b.maxx - b.minx, b.maxz - b.minz) / 2, w = Math.max(3.4, Math.min(8, t.length * .38 + 1.2));
  const x = b.cx + dir.x * (r + 1.6), z = b.cz + dir.z * (r + 1.6);
  sign(ctx, t, x, 3.5, z, Math.atan2(dir.x, dir.z), w, 1.25, { bg: st.bg, sub: st.label && st.label !== t ? st.label : '', posts: true });
}

export function decorateBuilding(ctx, L, b, dir) { features(ctx, L, b, dir); nameSign(ctx, L, b, dir); }

/** Lieu sans bâtiment OSM : petit bâtiment-repère + plaque. */
export function standaloneLandmark(ctx, L, dir) {
  const st = lmStyle(L.type), w = L.type === 'market' ? 12 : 7, d = L.type === 'market' ? 8 : 5, h = Math.min(st.h, 4);
  const b = { minx: L.x - w / 2, maxx: L.x + w / 2, minz: L.z - d / 2, maxz: L.z + d / 2, cx: L.x, cz: L.z, h };
  if (L.type !== 'market') {
    ctx.B.add(G.box, M(L.x, h / 2, L.z, 0, w, h, d), st.wall, 'wall', .05);
    ctx.B.add(G.box, M(L.x, h + .12, L.z, 0, w + .6, .24, d + .6), st.roof, 'roof', .05);
    rectCollider(ctx, L.x, L.z, w, d, 0);
  }
  decorateBuilding(ctx, L, b, dir);
}

/** Plaque de rue (vert), lisible dans les deux sens. */
export function streetSign(ctx, name, x, z, tx, tz, roadW) {
  const l = Math.hypot(tx, tz) || 1, ux = tx / l, uz = tz / l, nx = -uz, nz = ux, off = roadW / 2 + 1.1;
  const px = x + nx * off, pz = z + nz * off, w = Math.max(2.4, Math.min(6, name.length * .3 + .9));
  const ry = Math.atan2(ux, uz);
  sign(ctx, name, px, 2.7, pz, ry, w, .7, { bg: '#1f6f46', border: '#ffffff', posts: true });
  sign(ctx, name, px - ux * .12, 2.7, pz - uz * .12, ry + Math.PI, w, .7, { bg: '#1f6f46', border: '#ffffff', posts: false });
}
