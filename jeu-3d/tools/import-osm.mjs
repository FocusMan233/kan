// Importe la vraie carte OpenStreetMap d'un quartier (rues, bâtiments, arbres) vers public/data/quartiers/<id>.json
// Usage : node tools/import-osm.mjs            (les 4 quartiers)
//         node tools/import-osm.mjs gounghin   (un seul)
// Nécessite un accès Internet (Nominatim + Overpass). Zone importée : 300 m x 300 m autour du centre du quartier.
// Pour un point précis : node tools/import-osm.mjs gounghin --center=12.3714,-1.5426
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
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

const poiType = t => {
  const a = t.amenity, sh = t.shop, b = t.building;
  if (a === 'place_of_worship' || b === 'mosque' || b === 'church' || b === 'cathedral') return (t.religion === 'muslim' || b === 'mosque') ? 'mosque' : (t.religion === 'christian' || b === 'church' || b === 'cathedral') ? 'church' : 'worship';
  if (/^(school|college|university|kindergarten)$/.test(a)) return 'school';
  if (a === 'fuel') return 'fuel';
  if (a === 'marketplace' || sh === 'market') return 'market';
  if (/^(bank|atm|bureau_de_change)$/.test(a)) return 'bank';
  if (/^(hospital|clinic|doctors|pharmacy)$/.test(a)) return a === 'pharmacy' ? 'pharmacy' : 'health';
  if (/^(restaurant|bar|cafe|fast_food|pub|nightclub)$/.test(a)) return 'food';
  if (t.tourism && /hotel|guest_house|hostel|motel/.test(t.tourism)) return 'hotel';
  if (/^(police|townhall|courthouse|post_office|fire_station)$/.test(a)) return 'gov';
  if (t.leisure && /pitch|stadium|sports_centre/.test(t.leisure)) return 'sport';
  if (sh) return 'shop';
  return a || t.tourism || t.leisure ? 'other' : null;
};
const TYPE_W = { mosque: 3, church: 3, worship: 2, school: 3, market: 5, fuel: 2.5, bank: 2, health: 3, pharmacy: 1.5, food: 1, hotel: 1.5, gov: 2.5, sport: 2, shop: .6, other: .5 };


// ---------- Overture Maps (bâtiments Microsoft/Google, lieux Meta/Microsoft…) : complète OpenStreetMap, facultatif ----------
const overtureType = cat => {
  const c = String(cat || '').toLowerCase();
  if (/mosque/.test(c)) return 'mosque';
  if (/church|cathedral|chapel|place_of_worship|religious/.test(c)) return 'church';
  if (/school|college|university|education|kindergarten/.test(c)) return 'school';
  if (/pharmacy/.test(c)) return 'pharmacy';
  if (/hospital|clinic|health|doctor|dentist|medical/.test(c)) return 'health';
  if (/gas_station|fuel|petrol/.test(c)) return 'fuel';
  if (/bank|atm|financial|money_transfer/.test(c)) return 'bank';
  if (/marketplace|^market|open_air_market/.test(c)) return 'market';
  if (/restaurant|bar$|^bar|cafe|food|fast_food|pub|night_club|maquis/.test(c)) return 'food';
  if (/hotel|lodging|guest_house|hostel|motel/.test(c)) return 'hotel';
  if (/government|police|post_office|town_hall|courthouse|fire_station|embassy/.test(c)) return 'gov';
  if (/sport|stadium|gym|football|playground/.test(c)) return 'sport';
  if (/shop|store|retail|boutique|supermarket|grocery/.test(c)) return 'shop';
  return 'other';
};
function runOverture(type, bboxArr, out) {
  return new Promise(resolve => {
    execFile('overturemaps', ['download', `--bbox=${bboxArr.join(',')}`, '-f', 'geojson', `--type=${type}`, '-o', out], { timeout: 6 * 60 * 1000, maxBuffer: 1 << 24 }, err => resolve(!err));
  });
}
async function overtureFeatures(type, bboxArr) {
  const fx = process.env.OVERTURE_FIXTURE_DIR;
  const file = fx ? path.join(fx, type + '.geojson') : path.join(os.tmpdir(), `kan-overture-${type}-${process.pid}.geojson`);
  if (!fx && !(await runOverture(type, bboxArr, file))) return null;
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (!fx) fs.rmSync(file, { force: true }); return j.features || []; } catch { return null; }
}
const ringCentroid = r => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];

async function importQuartier(q, centerArg) {
  console.log(`\n== ${q.name} ==`);
  const fixed = centerArg || (q.center ? q.center.join(',') : null);
  const [lat0, lon0] = fixed ? fixed.split(',').map(Number) : await geocode(q.geocode);
  const mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180), SEARCH = fixed ? 0 : 850, d = SEARCH + HALF + 30;
  const bbox = [lat0 - d / mLat, lon0 - d / mLon, lat0 + d / mLat, lon0 + d / mLon].join(',');
  const data = await overpass(`[out:json][timeout:90];(way["highway"](${bbox});way["building"](${bbox});node["natural"="tree"](${bbox});nwr["name"]["amenity"](${bbox});nwr["name"]["shop"](${bbox});nwr["name"]["tourism"](${bbox});nwr["name"]["leisure"](${bbox});nwr["amenity"="marketplace"](${bbox});nwr["shop"="market"](${bbox}););out geom;`);
  const P0 = (lat, lon) => [(lon - lon0) * mLon, -(lat - lat0) * mLat];   // mètres : x est, z sud
  const roads0 = [], bld0 = [], trees0 = [], pois0 = [];
  for (const e of data.elements) {
    const t = e.tags || {};
    if (e.type === 'node' && t.natural === 'tree') { trees0.push(P0(e.lat, e.lon)); continue; }
    if (e.type === 'way' && t.highway && ROAD[t.highway] && e.geometry) {
      roads0.push({ pts: e.geometry.map(g => P0(g.lat, g.lon)), w: ROAD[t.highway][0], kind: t.surface && /asphalt|paved|concrete/.test(t.surface) ? 'asphalt' : ROAD[t.highway][1], name: t.name || t['name:fr'] || '' });
      continue;
    }
    const isB = e.type === 'way' && t.building && e.geometry && e.geometry.length >= 4;
    if (isB) { const pts = e.geometry.map(g => P0(g.lat, g.lon)); pts.pop(); const lv = Number(t['building:levels']); bld0.push({ pts, h: lv ? lv * 3.1 : 3.2, tags: t }); }
    const name = t.name || t['name:fr'];
    const ty = name || t.amenity === 'marketplace' || t.shop === 'market' ? poiType(t) : null;
    if (ty) {
      const c = e.type === 'node' ? P0(e.lat, e.lon) : e.geometry ? (() => { const a = e.geometry.map(g => P0(g.lat, g.lon)); return [a.reduce((s, p) => s + p[0], 0) / a.length, a.reduce((s, p) => s + p[1], 0) / a.length]; })() : e.bounds ? P0((e.bounds.minlat + e.bounds.maxlat) / 2, (e.bounds.minlon + e.bounds.maxlon) / 2) : null;
      if (c) pois0.push({ type: ty, name: name || (ty === 'market' ? 'Marché' : ''), p: c });
    }
  }
  // --- Overture : bâtiments et lieux en plus d'OpenStreetMap ---
  if (process.env.OVERTURE !== '0') {
    const bb = [lon0 - d / mLon, lat0 - d / mLat, lon0 + d / mLon, lat0 + d / mLat];
    const [ob, op] = [await overtureFeatures('building', bb), await overtureFeatures('place', bb)];
    if (ob === null && op === null) console.log('  (Overture indisponible ici : OpenStreetMap seul)');
    else {
      // grille des bâtiments OSM déjà connus, pour ne pas dupliquer
      const cell = 25, grid = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
      for (const b of bld0) { const [cx, cz] = ringCentroid(b.pts); const k = key(cx, cz); (grid.get(k) || grid.set(k, []).get(k)).push([cx, cz]); }
      const known = (cx, cz) => { for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const [x, z] of grid.get((Math.floor(cx / cell) + a) + ',' + (Math.floor(cz / cell) + c)) || []) if (Math.hypot(x - cx, z - cz) < 6) return true; return false; };
      let nb = 0, np = 0;
      for (const f of ob || []) {
        const g = f.geometry; const rings = g?.type === 'Polygon' ? [g.coordinates[0]] : g?.type === 'MultiPolygon' ? g.coordinates.map(c => c[0]) : [];
        for (const ring of rings) {
          if (!ring || ring.length < 4) continue; const pts = ring.slice(0, -1).map(([lo, la]) => P0(la, lo)); const [cx, cz] = ringCentroid(pts);
          if (known(cx, cz)) continue; const pr = f.properties || {}, fl = Number(pr.num_floors);
          bld0.push({ pts, h: pr.height ? Math.min(Number(pr.height), 20) : fl ? fl * 3.1 : 3.2, tags: {} }); (grid.get(key(cx, cz)) || grid.set(key(cx, cz), []).get(key(cx, cz))).push([cx, cz]); nb++;
        }
      }
      for (const f of op || []) {
        const pr = f.properties || {}, name = pr.names?.primary || pr.name; if (!name || f.geometry?.type !== 'Point' || (pr.confidence != null && pr.confidence < .45)) continue;
        const [lo, la] = f.geometry.coordinates, cat = pr.categories?.primary || pr.category || pr.categories?.main || '';
        const c = P0(la, lo), ty = overtureType(cat);
        if (pois0.some(q => q.name && q.name.toLowerCase() === name.toLowerCase() && Math.hypot(q.p[0] - c[0], q.p[1] - c[1]) < 60)) continue;
        pois0.push({ type: ty, name, p: c }); np++;
      }
      console.log(`  Overture : +${nb} bâtiments, +${np} lieux`);
    }
  }
  // --- fenêtre de jeu 300 m x 300 m : celle qui contient le plus de lieux reconnaissables ---
  let win = [0, 0];
  if (SEARCH) {
    let best = -1e9;
    for (let wx = -SEARCH; wx <= SEARCH; wx += 50) for (let wz = -SEARCH; wz <= SEARCH; wz += 50) {
      const inW = ([x, z]) => Math.abs(x - wx) <= HALF && Math.abs(z - wz) <= HALF;
      const names = new Set(); let sc = 0;
      for (const p of pois0) if (inW(p.p) && p.name && !names.has(p.name)) { names.add(p.name); sc += TYPE_W[p.type] * 3; }
      for (const b of bld0) { const c = b.pts[0]; if (inW(c)) sc += .12; }
      const rn = new Set(); for (const r of roads0) if (r.pts.some(inW)) { if (r.name) rn.add(r.name); sc += .6; }
      sc += rn.size * 1.5 - Math.hypot(wx, wz) / 150;
      if (sc > best) { best = sc; win = [wx, wz]; }
    }
    console.log(`  fenêtre choisie : ${Math.round(win[0])} m E, ${Math.round(-win[1])} m N du centre géocodé (centre = ${(lat0 - win[1] / mLat).toFixed(5)}, ${(lon0 + win[0] / mLon).toFixed(5)})`);
  }
  const P = ([x, z]) => [Math.round((x - win[0]) * 10) / 10, Math.round((z - win[1]) * 10) / 10];
  const roads = [], buildings = [], trees = [], pois = [];
  for (const r of roads0) { const pts = r.pts.map(P); for (const seg of clipLine(pts)) roads.push({ pts: simplify(seg), w: r.w, kind: r.kind, name: r.name || undefined }); }
  for (const b of bld0) {
    let pts = b.pts.map(P); const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (!inside([cx, cz])) continue;
    let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } if (a < 0) pts.reverse();
    buildings.push({ pts, h: b.h, ...(poiType(b.tags) && b.tags.building !== 'yes' && /mosque|church|cathedral|school|hospital/.test(b.tags.building) ? { kind: poiType(b.tags) } : {}) });
  }
  for (const t of trees0) { const p = P(t); if (inside(p)) trees.push(p); }
  for (const p of pois0) { const q2 = P(p.p); if (Math.abs(q2[0]) <= HALF - 6 && Math.abs(q2[1]) <= HALF - 6) pois.push({ k: p.type, p: q2, name: p.name }); }
  console.log(`  ${roads.length} rues, ${buildings.length} bâtiments, ${trees.length} arbres, ${pois.length} lieux nommés : ${[...new Set(pois.filter(p => p.name).map(p => p.name))].slice(0, 12).join(' · ')}`);
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
    let want = [ox, oz]; const kk = k === 'csps' ? 'health' : k === 'maquis' ? 'food' : k; const poi = pois.find(p => p.k === kk && inside(p.p)); if (poi) want = poi.p;
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
  const taken0 = taken.slice();
  const seenN = new Set(), landmarks = [];
  for (const p of pois.filter(p => p.name && p.k !== 'shop' || p.k === 'market').sort((a, b) => TYPE_W[b.k] - TYPE_W[a.k])) {
    if (seenN.has(p.name) || landmarks.length >= 22) continue; if (taken0.some(([tx, tz, tr]) => Math.hypot(tx - p.p[0], tz - p.p[1]) < tr)) continue;
    seenN.add(p.name); landmarks.push({ type: p.k, name: p.name, x: Math.round(p.p[0]), z: Math.round(p.p[1]) });
  }
  const streets = [], seenS = new Set();
  for (const r of roads.filter(r => r.name).sort((a, b) => b.pts.length - a.pts.length)) {
    if (seenS.has(r.name) || streets.length >= 14) continue; seenS.add(r.name);
    const m = r.pts[Math.floor(r.pts.length / 2)]; streets.push({ name: r.name, x: m[0], z: m[1], w: r.w });
  }
  const out = { id: q.id, name: q.name, source: 'OpenStreetMap contributors (ODbL)', center: [+(lat0 - win[1] / mLat).toFixed(6), +(lon0 + win[0] / mLon).toFixed(6)], half: HALF, roads, buildings: kept.slice(0, 900), landmarks, streets, window: { lat: +(lat0 - win[1] / mLat).toFixed(6), lon: +(lon0 + win[0] / mLon).toFixed(6) }, trees: trees.filter(([x, z]) => !cut(x, z)).slice(0, 500), anchors };
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, q.id + '.json'), JSON.stringify(out));
  console.log(`  ✓ ${q.id}.json écrit (${(JSON.stringify(out).length / 1024).toFixed(0)} Ko)`);
}

const args = process.argv.slice(2), center = args.find(a => a.startsWith('--center='))?.slice(9), ids = args.filter(a => !a.startsWith('--'));
for (const q of QUARTIERS.filter(q => !ids.length || ids.includes(q.id))) {
  try { await importQuartier(q, center); } catch (e) { console.error('  ✗', e.message); }
  await sleep(1500);
}
