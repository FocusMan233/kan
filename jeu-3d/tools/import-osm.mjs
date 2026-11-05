// Importe la vraie carte OpenStreetMap d'un quartier (rues, bâtiments, arbres) vers public/data/quartiers/<id>.json
// Usage : node tools/import-osm.mjs            (les 4 quartiers)
//         node tools/import-osm.mjs gounghin   (un seul)
// Nécessite un accès Internet (Nominatim + Overpass). Zone importée : 300 m x 300 m autour du centre du quartier.
// Pour un point précis : node tools/import-osm.mjs gounghin --center=12.3714,-1.5426
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUARTIERS } from '../server/content.js';

const HALF = 150, OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'quartiers');
const UA = { 'User-Agent': 'KanGame/1.0 (language data game; contact: admin)' };
const OVERPASS = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const ORIGINS = { home: [-2, 27], market: [-96, 32], maquis: [-51, 17], taxi: [-48, -8.4], csps: [-4, -34], meeting: [79, -36], culture: [80, 44] };
const CLEAR = { home: 12, market: 20, maquis: 11, taxi: 7, csps: 18, meeting: 22, culture: 26 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(q) {
  const r = await fetch(NOMINATIM + '?format=json&limit=1&q=' + encodeURIComponent(q), { headers: UA });
  const j = await r.json(); if (!j[0]) throw new Error('Quartier introuvable : ' + q);
  return [+j[0].lat, +j[0].lon];
}
async function overpass(query) {
  let err;
  for (const url of OVERPASS) {
    try { const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...UA } }); if (r.ok) return await r.json(); err = new Error('Overpass ' + r.status); } catch (e) { err = e; }
  }
  throw err;
}
const ROAD = { motorway: [12, 'asphalt'], trunk: [12, 'asphalt'], primary: [11, 'asphalt'], secondary: [9, 'asphalt'], tertiary: [7.5, 'asphalt'], residential: [5.5, 'dirt'], unclassified: [5, 'dirt'], service: [3.5, 'dirt'], track: [3.5, 'dirt'], living_street: [4.5, 'dirt'] };
const inside = ([x, z]) => Math.abs(x) <= HALF + 10 && Math.abs(z) <= HALF + 10;

function simplify(pts, tol = .8) { const o = [pts[0]]; for (let i = 1; i < pts.length - 1; i++) { const [px, pz] = o[o.length - 1]; if (Math.hypot(pts[i][0] - px, pts[i][1] - pz) >= tol * 3) o.push(pts[i]); } o.push(pts[pts.length - 1]); return o; }
function clipSeg(a, b, L = HALF + 8) { // Liang–Barsky : découpe un segment au carré de jeu
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dz = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] + L], [dx, L - a[0]], [-dz, a[1] + L], [dz, L - a[1]]]) {
    if (p === 0) { if (q < 0) return null; } else { const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
  }
  return [[a[0] + t0 * dx, a[1] + t0 * dz], [a[0] + t1 * dx, a[1] + t1 * dz]];
}
function clipLine(pts) { const out = []; let cur = []; for (let i = 0; i < pts.length - 1; i++) { const s = clipSeg(pts[i], pts[i + 1]); if (!s) { if (cur.length > 1) out.push(cur); cur = []; continue; } const [p, q] = s; if (!cur.length) cur.push(p); else if (Math.hypot(cur[cur.length - 1][0] - p[0], cur[cur.length - 1][1] - p[1]) > .01) { out.push(cur); cur = [p]; } cur.push(q); } if (cur.length > 1) out.push(cur); return out.map(l => l.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10])); }
function distToSeg(px, pz, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1; let t = ((px - a[0]) * dx + (pz - a[1]) * dz) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz); }

async function importQuartier(q, centerArg) {
  console.log(`\n== ${q.name} ==`);
  const [lat0, lon0] = centerArg ? centerArg.split(',').map(Number) : await geocode(q.geocode);
  const mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180), d = HALF + 25;
  const bbox = [lat0 - d / mLat, lon0 - d / mLon, lat0 + d / mLat, lon0 + d / mLon].join(',');
  const data = await overpass(`[out:json][timeout:60];(way["highway"](${bbox});way["building"](${bbox});node["natural"="tree"](${bbox});nwr["amenity"~"marketplace|clinic|hospital|doctors|bar|restaurant|place_of_worship|school"](${bbox});nwr["shop"="market"](${bbox}););out geom;`);
  const P = (lat, lon) => [Math.round((lon - lon0) * mLon * 10) / 10, Math.round(-(lat - lat0) * mLat * 10) / 10]; // x est, z sud
  const roads = [], buildings = [], trees = [], pois = [];
  for (const e of data.elements) {
    const t = e.tags || {};
    if (e.type === 'node' && t.natural === 'tree') { const p = P(e.lat, e.lon); if (inside(p)) trees.push(p); continue; }
    if (e.type === 'way' && t.highway && ROAD[t.highway] && e.geometry) {
      const pts = e.geometry.map(g => P(g.lat, g.lon));
      for (const seg of clipLine(pts)) roads.push({ pts: simplify(seg), w: ROAD[t.highway][0], kind: t.surface && /asphalt|paved|concrete/.test(t.surface) ? 'asphalt' : ROAD[t.highway][1], name: t.name || undefined });
      continue;
    }
    if (e.type === 'way' && t.building && e.geometry && e.geometry.length >= 4) {
      let pts = e.geometry.map(g => P(g.lat, g.lon)); pts.pop();
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      if (!inside([cx, cz])) continue;
      // sens horaire/anti-horaire cohérent
      let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } if (a < 0) pts.reverse();
      const lv = Number(t['building:levels']); buildings.push({ pts: pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]), h: lv ? lv * 3.1 : 3.2 });
      continue;
    }
    const c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : e.geometry?.[0]);
    if (c && (t.amenity || t.shop)) pois.push({ k: t.amenity === 'marketplace' || t.shop === 'market' ? 'market' : /clinic|hospital|doctors/.test(t.amenity) ? 'csps' : /bar|restaurant/.test(t.amenity) ? 'maquis' : 'other', p: P(c.lat, c.lon), name: t.name });
  }
  console.log(`  ${roads.length} rues, ${buildings.length} bâtiments, ${trees.length} arbres, ${pois.length} lieux`);
  if (roads.length < 5) throw new Error('Trop peu de données OSM ici : vérifie le centre (--center=lat,lon).');
  // Emplacements des zones de jeu : endroits dégagés, près des positions souhaitées (ou d'un vrai lieu OSM)
  const segs = []; for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) segs.push([r.pts[i], r.pts[i + 1], r.w]);
  const bpts = buildings.map(b => b.pts);
  const bc = buildings.map(b => [b.pts.reduce((s, p) => s + p[0], 0) / b.pts.length, b.pts.reduce((s, p) => s + p[1], 0) / b.pts.length]);
  // coût d'un emplacement : éloignement du lieu souhaité + routes traversées (fort) + bâtiments à raser (léger)
  const cost = (x, z, R, want) => {
    let c = Math.hypot(x - want[0], z - want[1]);
    for (const [a, b, w] of segs) { const d = distToSeg(x, z, a, b); if (d < w / 2 + R * .5) c += 400 * (1 - d / (w / 2 + R * .5)) + 60; }
    for (const [bx, bz] of bc) if (Math.hypot(bx - x, bz - z) < R) c += 2.5;
    return c;
  };
  const anchors = {}, taken = [];
  for (const [k, [ox, oz]] of Object.entries(ORIGINS)) {
    let want = [ox, oz]; const poi = pois.find(p => p.k === k && inside(p.p)); if (poi) want = poi.p;
    let best = null, bc0 = 1e12;
    for (let x = -HALF + CLEAR[k]; x <= HALF - CLEAR[k]; x += 4) for (let z = -HALF + CLEAR[k]; z <= HALF - CLEAR[k]; z += 4) {
      if (taken.some(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) < tr + CLEAR[k])) continue;
      const c = cost(x, z, CLEAR[k], want); if (c < bc0) { bc0 = c; best = [x, z]; }
    }
    if (!best) { console.warn(`  ! pas de place pour ${k}`); best = [ox, oz]; }
    anchors[k] = best; taken.push([best[0], best[1], CLEAR[k]]);
  }
  // le terrain des zones de jeu doit rester libre : on retire bâtiments/arbres qui chevauchent
  const cut = (x, z) => taken.some(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) < tr);
  const kept = buildings.filter(b => { const cx = b.pts.reduce((s, p) => s + p[0], 0) / b.pts.length, cz = b.pts.reduce((s, p) => s + p[1], 0) / b.pts.length; return !cut(cx, cz); });
  const out = { id: q.id, name: q.name, source: 'OpenStreetMap contributors (ODbL)', center: [lat0, lon0], half: HALF, roads, buildings: kept.slice(0, 900), trees: trees.filter(([x, z]) => !cut(x, z)).slice(0, 500), anchors };
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, q.id + '.json'), JSON.stringify(out));
  console.log(`  ✓ ${q.id}.json écrit (${(JSON.stringify(out).length / 1024).toFixed(0)} Ko)`);
}

const args = process.argv.slice(2), center = args.find(a => a.startsWith('--center='))?.slice(9), ids = args.filter(a => !a.startsWith('--'));
for (const q of QUARTIERS.filter(q => !ids.length || ids.includes(q.id))) {
  try { await importQuartier(q, center); } catch (e) { console.error('  ✗', e.message); }
  await sleep(1500);
}
