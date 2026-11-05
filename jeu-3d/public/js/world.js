// Construction du quartier : terrain, routes, concessions, arbres, zones, PNJ, circulation, lumière.
import * as THREE from 'three';
import { Batcher, M, G } from './batch.js';
import { rng, lateriteTexture, roadTexture, plasterTexture, roofTexture, pavingTexture, softPatchTexture, flagTexture, fasoDanFaniTexture, cloudTexture, smokeTexture, makeSky, signTexture } from './textures.js';
import { PAL, house, hut, compoundWalls, tree, shrub, tuft, pole, wire, lamp, parkedMoto, motoModel, barrel, crate, chair, sign, addCollider, rectPoly, rectCollider, bench } from './props.js';
import { buildHome, buildMarket, buildMaquis, buildTaxi, buildCSPS, buildMeeting, buildCulture, FOOTPRINTS } from './prefabs.js';
import { buildCharacter } from './characters.js';
import { CityLife } from './city.js';
import { lmStyle, decorateBuilding, standaloneLandmark, streetSign } from './landmarks.js';

export const HALF = 150;
const ORIGINS = {
  home: [-2, 27], market: [-96, 32], maquis: [-51, 17], taxi: [-48, -8.4], csps: [-4, -34], meeting: [79, -36], culture: [80, 44],
};
const STREET_X = [-67, 32, 125], LANES_Z = [-72, 80];

const WAX = [['#c0392b', '#f1c40f'], ['#16a085', '#f39c12'], ['#e84393', '#fdcb6e'], ['#2980b9', '#f1c40f'], ['#8e44ad', '#f39c12'], ['#d35400', '#ecf0f1'], ['#27ae60', '#ffeaa7'], ['#c0392b', '#2c3e50']];
const MCOL = [['#2c3e80', '#e8d9a0'], ['#a4161a', '#f1c40f'], ['#1e7f4f', '#f4d03f'], ['#e17055', '#2d3436'], ['#6c5ce7', '#dfe6e9'], ['#0984e3', '#ffffff'], ['#7f4f24', '#f5deb3']];
const pick = (R, a) => a[Math.floor(R() * a.length)];

function randomSpec(R, role = '') {
  const fem = /_f$|^vendor$|^shopper$/.test(role) ? (role === 'vendor' ? R() < .75 : true) : /_m$|^rider$/.test(role) ? false : R() < .5;
  const skin = 2 + Math.floor(R() * 4);
  if (fem) {
    const [c1, c2] = pick(R, WAX), outfit = pick(R, ['pagne', 'pagne', 'boubou_f', 'tshirt']);
    return { gender: 'f', age: 'adult', skin, outfit, colors: [c1, c2], pattern: Math.floor(R() * 15), head: R() < .7 ? 'foulard' : 'aucun', hair: pick(R, ['tresses', 'court']) };
  }
  const [c1, c2] = pick(R, MCOL);
  return { gender: 'm', age: R() < .12 ? 'elder' : 'adult', skin, outfit: pick(R, ['boubou', 'chemise', 'tshirt', 'chemise']), colors: [c1, c2], pattern: Math.floor(R() * 9), head: role === 'rider' ? 'casque' : pick(R, ['aucun', 'aucun', 'casquette', 'kufi', 'bonnet']), hair: pick(R, ['court', 'afro', 'court']) };
}

// ---------- géométrie utilitaire ----------
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  let t = L2 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function distToRoads(roads, x, z) {
  let best = 1e9, bw = 0;
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) {
    const d = segDist(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) - r.w / 2;
    if (d < best) { best = d; bw = r.w; }
  }
  return best;
}
const rectOverlap = (a, b, m = 0) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + m && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + m;

function proceduralSpec(q) {
  const R = rng(q.seed * 977 + 13), E = HALF;
  const roads = [];
  const curve = (pts, amp, f) => pts.map(([x, z], i) => [x + (i > 0 && i < pts.length - 1 ? Math.sin(z * f + q.seed) * amp : 0), z + Math.sin(x * f * .7 + q.seed * 2) * amp * .0]);
  const line = (x0, z0, x1, z1, n = 16) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]);
  roads.push({ pts: line(-E - 20, 0, E + 20, 0, 30).map(([x, z]) => [x, z + Math.sin(x * .02 + q.seed) * .8]), w: 10, kind: 'asphalt' });
  for (const x of STREET_X) roads.push({ pts: curve(line(x, -E - 20, x, E + 20, 24), 1.2, .05), w: 6, kind: 'dirt' });
  for (const z of LANES_Z) roads.push({ pts: line(-E - 20, z, E + 20, z, 24).map(([x, zz]) => [x, zz + Math.sin(x * .04 + q.seed) * 1.2]), w: 5, kind: 'dirt' });
  roads.push({ pts: line(-20, 5, -20, 20, 4), w: 4, kind: 'dirt' });         // petite rue vers le foyer
  return { roads, origins: ORIGINS, osm: null, R };
}

export class World {
  constructor({ scene, renderer, quality = 'high' }) {
    this.scene = scene; this.renderer = renderer; this.quality = quality;
    this.group = new THREE.Group(); scene.add(this.group);
    this.npcs = new Map(); this.ambient = []; this.walkers = []; this.traffic = []; this.flags = []; this.smokes = []; this.clouds = [];
    this.colliders = []; this.circles = []; this.grid = new Map(); this.zones = []; this.anchors = {};
    this.sunDir = new THREE.Vector3(.55, .5, .35).normalize();
    this.cheer = false; this.t = 0;
    this.sky = makeSky(); scene.add(this.sky);
    this._setupLights();
  }

  _setupLights() {
    const s = this.scene;
    s.fog = new THREE.Fog('#ecd0a6', 70, 340);
    this.hemi = new THREE.HemisphereLight('#bcd6f2', '#b9773f', 1.15); s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffd9a3', 3.1); s.add(this.sun); s.add(this.sun.target);
    const sh = this.sun.shadow, q = this.quality;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sun.castShadow = q !== 'low';
    const ms = q === 'high' ? 4096 : q === 'mid' ? 2048 : 1024; sh.mapSize.set(ms, ms);
    const e = 48; Object.assign(sh.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 220 });
    sh.bias = -0.0006; sh.normalBias = 0.04;
  }

  clear() {
    this.city = null;
    for (const c of [...this.group.children]) { this.group.remove(c); c.traverse?.(o => { o.geometry?.dispose?.(); }); }
    this.npcs.clear(); this.ambient.length = 0; this.walkers.length = 0; this.traffic.length = 0; this.flags.length = 0; this.smokes.length = 0;
    this.colliders.length = 0; this.circles.length = 0; this.grid.clear(); this.zones.length = 0; this.anchors = {};
  }

  /** Charge les données OpenStreetMap du quartier si elles existent (importées par tools/import-osm.mjs). */
  async loadOsm(id) {
    try { const r = await fetch(`/data/quartiers/${id}.json`, { cache: 'no-cache' }); if (!r.ok) return null; const j = await r.json(); return j && j.roads?.length ? j : null; } catch { return null; }
  }

  async build(quartier, content, onProgress = () => {}) {
    this.clear(); this.quartier = quartier; this.landmarks = [];
    const tick = async (p, msg) => { onProgress(p, msg); await new Promise(r => setTimeout(r, 0)); };
    await tick(.05, 'Préparation du terrain…');
    const osm = await this.loadOsm(quartier.id);
    const spec = proceduralSpec(quartier);
    this.realMap = !!osm;
    const pal = PAL[quartier.palette] || PAL.chaud;
    const R = spec.R;
    const B = new Batcher(quartier.seed);
    const ctx = {
      B, R, pal, quality: this.quality, colliders: this.colliders, circles: this.circles, anchors: this.anchors, zones: this.zones,
      ambient: this.ambient, flags: [], smoke: [], extras: [], fdfPlanes: [], decals: [],
      randomSpec, decal: (kind, cx, cz, w, d, y = .02, ry = 0) => ctx.decals.push({ kind, cx, cz, w, d, y, ry }),
    };
    let roads = spec.roads;
    let origins = { ...spec.origins };
    const blocked = [];
    if (osm) { roads = osm.roads.map(r => ({ pts: r.pts, w: r.w || 5, kind: r.kind || 'dirt', name: r.name })); for (const k of Object.keys(origins)) if (osm.anchors?.[k]) origins[k] = osm.anchors[k]; }
    this.roads = roads; this.origins = origins;
    for (const [k, [x, z]] of Object.entries(origins)) { const f = FOOTPRINTS[k]; blocked.push({ k, x, z, w: f.w + 4, d: f.d + 4 }); }

    await tick(.15, 'Les rues…');
    this._buildGround();
    this._buildRoads(roads);

    await tick(.3, 'Les zones du quartier…');
    buildHome(ctx, ...origins.home); buildMarket(ctx, ...origins.market); buildMaquis(ctx, ...origins.maquis); buildTaxi(ctx, ...origins.taxi);
    buildCSPS(ctx, ...origins.csps); buildMeeting(ctx, ...origins.meeting); buildCulture(ctx, ...origins.culture);
    // voisins
    const nb = { voisin1: [-36, 10.6], voisin2: [13, 10.4], voisin3: [26, 12.4] };
    for (const [k, [x, z]] of Object.entries(nb)) {
      const ox = origins.home[0] - ORIGINS.home[0], oz = origins.home[1] - ORIGINS.home[1];
      ctx.anchors[k] = { x: x + (osm ? ox : 0), y: 0, z: z + (osm ? oz : 0), ry: Math.PI };
      blocked.push({ k, x: x + (osm ? ox : 0), z: z + (osm ? oz : 0), w: 7, d: 6 });
    }

    await tick(.45, 'Maisons et concessions…');
    if (osm) this._osmBuildings(ctx, osm, blocked); else this._residential(ctx, roads, blocked);
    this._places(ctx, blocked);

    await tick(.6, 'Arbres et détails…');
    this._avenueProps(ctx, roads, blocked);
    this._scatterTrees(ctx, roads, blocked, osm);
    this._boundary(ctx);

    await tick(.72, 'Peinture et lumière…');
    const mk = (o, extra = {}) => ({ material: new THREE.MeshStandardMaterial(o), ...extra });
    const mats = {
      paint: mk({ vertexColors: true, roughness: .88 }),
      paintDS: mk({ vertexColors: true, roughness: .9, side: THREE.DoubleSide }),
      wall: mk({ vertexColors: true, map: plasterTexture(), roughness: .96 }),
      roof: mk({ vertexColors: true, map: roofTexture('#d2d2d2'), roughness: .5, metalness: .3 }),
      thatch: mk({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
      glow: { material: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), cast: false, receive: false },
      patch: { material: new THREE.MeshStandardMaterial({ vertexColors: true, map: softPatchTexture(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), cast: false },
    };
    B.build(mats, this.group);
    this._buildDecals(ctx);
    ctx.extras.forEach(m => this.group.add(m));
    this._buildFlags(ctx);
    this._buildFdf(ctx);
    this._buildSmoke(ctx);
    this.sky.visible = true;
    this._buildClouds();

    await tick(.85, 'Les habitants…');
    this._spawnNpcs(content, R);
    this._spawnAmbient(ctx, R);
    this.city = new CityLife(this, R, randomSpec, this.quality);
    this._buildGrid();
    this._minimapStatic = null;
    await tick(1, 'Bienvenue !');
    this.stats = { tris: B.tris | 0 };
  }

  // ---------- terrain & routes ----------
  _buildGround() {
    const t = lateriteTexture(7); t.repeat.set(110, 110);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    m.receiveShadow = true; this.ground = m; this.group.add(m);
  }
  _buildRoads(roads) {
    const texA = roadTexture('asphalt'), texD = roadTexture('dirt');
    roads.forEach((r, idx) => {
      const pts = r.pts, n = pts.length, pos = [], uv = [], ind = [];
      let dist = 0;
      for (let i = 0; i < n; i++) {
        const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        const nx = -dz, nz = dx, hw = r.w / 2;
        if (i > 0) dist += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
        pos.push(p[0] + nx * hw, 0, p[1] + nz * hw, p[0] - nx * hw, 0, p[1] - nz * hw);
        uv.push(0, dist / 8, 1, dist / 8);
        if (i < n - 1) { const k = i * 2; ind.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: r.kind === 'asphalt' ? texA : texD, roughness: r.kind === 'asphalt' ? .85 : 1, polygonOffset: true, polygonOffsetFactor: -1 - (r.kind === 'asphalt' ? 2 : 0), polygonOffsetUnits: -1 }));
      mesh.position.y = r.kind === 'asphalt' ? .03 : .02 + idx * .001; mesh.receiveShadow = true; this.group.add(mesh);
    });
  }
  _buildDecals(ctx) {
    const cache = {};
    for (const d of ctx.decals) {
      let base = cache[d.kind]; if (!base) base = cache[d.kind] = d.kind === 'paving' ? pavingTexture() : lateriteTexture(33, 14);
      const t = base.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, d.w / (d.kind === 'paving' ? 4 : 8)), Math.max(1, d.d / (d.kind === 'paving' ? 4 : 8)));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.position.set(d.cx, d.y, d.cz); m.rotation.y = d.ry; m.receiveShadow = true; this.group.add(m);
    }
  }
  _buildFlags(ctx) {
    const tex = flagTexture();
    ctx.flags.forEach(f => {
      const g = new THREE.PlaneGeometry(1.9, 1.25, 10, 6); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: .9 }));
      m.position.set(f.x, f.y, f.z); m.castShadow = true; this.group.add(m);
      this.flags.push({ mesh: m, base: g.attributes.position.array.slice(), phase: f.i });
    });
  }
  _buildFdf(ctx) {
    for (const p of ctx.fdfPlanes) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshStandardMaterial({ map: fasoDanFaniTexture(p.p), side: THREE.DoubleSide, roughness: .95 }));
      m.position.set(p.x, p.y, p.z); m.rotation.y = p.ry; m.castShadow = true; this.group.add(m);
    }
  }
  _buildSmoke(ctx) {
    const tex = smokeTexture(), n = this.quality === 'low' ? 6 : 12;
    for (const e of ctx.smoke) for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#d9d2c8', transparent: true, depthWrite: false, opacity: 0 }));
      sp.position.set(e.x, e.y, e.z); this.group.add(sp); this.smokes.push({ sp, e, t: i / n * 4, life: 4 });
    }
  }
  _buildClouds() {
    const tex = cloudTexture(), R = rng(5);
    for (let i = 0; i < 9; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: .85, depthWrite: false, fog: false }));
      sp.scale.set(260 + R() * 220, 120 + R() * 60, 1); sp.position.set((R() - .5) * 1200, 170 + R() * 80, (R() - .5) * 1200); this.group.add(sp); this.clouds.push(sp);
    }
  }

  // ---------- concessions résidentielles ----------
  _residential(ctx, roads, blocked) {
    const { R } = ctx, E = HALF, comps = [];
    const near = [];
    let tries = 0;
    while (comps.length < (this.quality === 'low' ? 70 : 125) && tries++ < 4000) {
      const w = 13 + R() * 8, d = 12 + R() * 6, x = (R() - .5) * (E * 2 - 22), z = (R() - .5) * (E * 2 - 22);
      const rc = { x, z, w, d };
      if (blocked.some(b => rectOverlap(rc, b, 1.5))) continue;
      if (comps.some(c => rectOverlap(rc, c, 3.2))) continue;
      let ok = true;
      for (let i = 0; i <= 8 && ok; i++) for (const [px, pz] of [[x - w / 2 + w * i / 8, z - d / 2], [x - w / 2 + w * i / 8, z + d / 2], [x - w / 2, z - d / 2 + d * i / 8], [x + w / 2, z - d / 2 + d * i / 8]]) if (distToRoads(roads, px, pz) < 2.2) { ok = false; break; }
      if (!ok) continue;
      comps.push(rc);
    }
    for (const c of comps) {
      // gate vers la route la plus proche
      const sides = { n: [c.x, c.z - c.d / 2], s: [c.x, c.z + c.d / 2], w: [c.x - c.w / 2, c.z], e: [c.x + c.w / 2, c.z] };
      let gate = 's', bd = 1e9; for (const [k, [px, pz]] of Object.entries(sides)) { const dd = distToRoads(roads, px, pz); if (dd < bd) { bd = dd; gate = k; } }
      compoundWalls(ctx, c.x, c.z, c.w, c.d, gate, 2.8);
      const ry = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[gate];
      const horiz = gate === 'n' || gate === 's', front = horiz ? c.w : c.d, depth = horiz ? c.d : c.w;
      const hw = Math.min(front - 5, 7 + R() * 5), hd = Math.min(depth - 7, 4.6 + R() * 2.2);
      const back = { s: [0, -1], n: [0, 1], e: [-1, 0], w: [1, 0] }[gate], off = (depth - hd) / 2 - 1.6;
      house(ctx, c.x + back[0] * off, c.z + back[1] * off, hw, hd, { ry });
      if (R() < .5) { const side = { s: [1, 0], n: [-1, 0], e: [0, 1], w: [0, -1] }[gate]; hut(ctx, c.x + side[0] * (front / 2 - 3) + back[0] * 1.5, c.z + side[1] * (front / 2 - 3) + back[1] * 1.5, 1.5); }
      const yx = c.x - back[0] * (depth / 2 - 4), yz = c.z - back[1] * (depth / 2 - 4);
      if (R() < .6) tree(ctx, yx + (R() - .5) * 3, yz + (R() - .5) * 3, .9 + R() * .5, R() < .5 ? 'neem' : 'mango');
      if (R() < .5) parkedMoto(ctx, yx + (R() - .5) * 4, yz + (R() - .5) * 2, R() * 6, ['#c0392b', '#2e86de', '#27ae60', '#e67e22'][Math.floor(R() * 4)]);
      if (R() < .4) barrel(ctx, c.x + (R() - .5) * c.w * .6, c.z + (R() - .5) * c.d * .6, ['#2b6cb0', '#c0392b', '#2e7d4f'][Math.floor(R() * 3)]);
      if (R() < .3) crate(ctx, c.x + (R() - .5) * c.w * .5, c.z + (R() - .5) * c.d * .5, R() * 3, .7);
    }
    this.compounds = comps;
  }

  _nearestRoad(x, z) {
    let best = null, bd = 1e9;
    for (const r of this.roads) for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)), px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(px - x, pz - z);
      if (d < bd) { bd = d; best = { x: px, z: pz, d }; }
    }
    return best;
  }
  _dirToRoad(x, z) { const n = this._nearestRoad(x, z); if (!n || n.d < .1) return { x: 0, z: 1 }; return { x: (n.x - x) / n.d, z: (n.z - z) / n.d }; }

  _osmBuildings(ctx, osm, blocked) {
    const { B, R, pal } = ctx;
    const wallCols = pal.walls;
    const lms = (osm.landmarks || []).map(L => ({ ...L, used: false }));
    this.landmarks = lms;
    for (const b of osm.buildings || []) {
      const pts = b.pts; if (!pts || pts.length < 3) continue;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; for (const [x, z] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
      if (blocked.some(bk => rectOverlap({ x: (minx + maxx) / 2, z: (minz + maxz) / 2, w: maxx - minx, d: maxz - minz }, bk, 0))) continue;
      // un repère réel (mosquée, école…) est-il sur ce bâtiment ?
      let L = null, bestD = 7;
      for (const l of lms) { if (l.used) continue; const dx = Math.max(minx - l.x, 0, l.x - maxx), dz = Math.max(minz - l.z, 0, l.z - maxz), d = Math.hypot(dx, dz); if (d < bestD) { bestD = d; L = l; } }
      if (!L && b.kind) { /* bâtiment typé OSM sans nom */ }
      const st = L ? lmStyle(L.type) : null;
      const h = Math.max(2.6, Math.min(L ? Math.max(b.h || 3.2, st.h) : (b.h || 3.2), 14)), shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .1, uv.getY(i) * .1);
      B.add(g, null, L ? st.wall : wallCols[Math.floor(R() * wallCols.length)], 'wall', .05);
      const rg = new THREE.ShapeGeometry(shape); rg.rotateX(-Math.PI / 2); rg.translate(0, h + .05, 0);
      const ruv = rg.attributes.uv, rp = rg.attributes.position; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rp.getX(i) / 3.2, rp.getZ(i) / 3.2);
      B.add(rg, null, L ? st.roof : pal.roofs[Math.floor(R() * pal.roofs.length)], 'roof', .06);
      addCollider(ctx, pts);
      this._facade(ctx, pts, h, L ? st : null);
      if (L) { L.used = true; L.x = cx; L.z = cz; decorateBuilding(ctx, L, { minx, maxx, minz, maxz, cx, cz, h }, this._dirToRoad(cx, cz)); }
    }
    // repères sans bâtiment dans OSM : petit bâtiment-repère
    for (const L of lms) if (!L.used) { if (blocked.some(bk => rectOverlap({ x: L.x, z: L.z, w: 12, d: 9 }, bk, 0))) continue; L.used = true; standaloneLandmark(ctx, L, this._dirToRoad(L.x, L.z)); }
    // plaques de rues
    for (const s of osm.streets || []) {
      const r = this.roads.find(r => r.name === s.name); if (!r) continue;
      let i = Math.floor(r.pts.length / 2); const a = r.pts[Math.max(0, i - 1)], b2 = r.pts[Math.min(r.pts.length - 1, i + 1)];
      streetSign(ctx, s.name, r.pts[i][0], r.pts[i][1], b2[0] - a[0], b2[1] - a[1], r.w || 5);
    }
  }

  /** Détails de façade : socle, fenêtres, porte côté rue, rebord de toit, parfois un château d'eau. */
  _facade(ctx, pts, h, st) {
    const { B, R } = ctx, n = pts.length;
    const inside = (x, z) => { let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    let doorEdge = -1, bd = 1e9;
    const E = [];
    for (let i = 0; i < n; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % n], dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < 2.4) { E.push(null); continue; }
      const ux = dx / len, uz = dz / len; let nx = uz, nz = -ux; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (inside(mx + nx * .4, mz + nz * .4)) { nx = -nx; nz = -nz; }
      const dr = distToRoads(this.roads, mx, mz); if (dr < bd && len >= 3) { bd = dr; doorEdge = i; }
      E.push({ ax, az, ux, uz, nx, nz, len, mx, mz, ry: -Math.atan2(dz, dx) });
    }
    E.forEach((e, i) => {
      if (!e) return;
      B.add(G.box, M(e.mx + e.nx * .04, .22, e.mz + e.nz * .04, e.ry, e.len, .44, .1), '#8d7a68', 'wall', .02);
      B.add(G.box, M(e.mx + e.nx * .06, h + .12, e.mz + e.nz * .06, e.ry, e.len, .3, .14), '#6f6a64', 'wall', .02);
      const cnt = Math.floor((e.len - 1.2) / 2.3);
      for (let k = 0; k < cnt; k++) {
        const t = -e.len / 2 + .6 + (k + .5) * (e.len - 1.2) / cnt;
        if (i === doorEdge && k === Math.floor(cnt / 2)) {
          B.add(G.box, M(e.mx + e.ux * t + e.nx * .05, 1.05, e.mz + e.uz * t + e.nz * .05, e.ry, 1.1, 2.1, .12), ['#2e5e8c', '#7a3b1d', '#2f6b4a', '#a23b2a'][Math.floor(R() * 4)], 'paint', 0);
          continue;
        }
        if (h < 2.8 || R() < .12) continue;
        const wx = e.mx + e.ux * t + e.nx * .04, wz = e.mz + e.uz * t + e.nz * .04;
        B.add(G.box, M(wx, 1.7, wz, e.ry, .95, 1.05, .1), '#1c2833', 'paint', 0);
        B.add(G.box, M(wx + e.nx * .02, 1.7, wz + e.nz * .02, e.ry, 1.1, .08, .12), '#cfc8bc', 'paint', 0);
        B.add(G.box, M(wx + e.nx * .02, 1.7, wz + e.nz * .02, e.ry, .06, 1.05, .12), '#cfc8bc', 'paint', 0);
        if (h > 6.2) B.add(G.box, M(wx, 4.3, wz, e.ry, .95, 1.05, .1), '#1c2833', 'paint', 0);
      }
    });
    if (!st && R() < .12) { const e = pts.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]); B.add(G.cyl, M(e[0], h + 1.1, e[1], 0, 1.1, 1.8, 1.1), '#2b6cb0', 'paint', 0); }
  }

  /** Lieux confirmés par les joueurs (co-construction) : construits comme les repères OSM. */
  _places(ctx, blocked) {
    this.landmarks = this.landmarks || [];
    for (const p of (this.placesData || []).filter(p => p.status === 'confirmed')) {
      if (this.landmarks.some(l => (l.name || '').toLowerCase() === p.name.toLowerCase() && Math.hypot(l.x - p.x, l.z - p.z) < 40)) continue;
      const dir = this._dirToRoad(p.x, p.z), L = { type: p.type, name: p.name, local: Object.values(p.names || {})[0] || '', x: p.x - dir.x * 4.5, z: p.z - dir.z * 4.5 };
      if (p.type !== 'junction' && blocked.some(bk => rectOverlap({ x: L.x, z: L.z, w: 9, d: 7 }, bk, 0))) continue;
      standaloneLandmark(ctx, L, dir); this.landmarks.push({ type: p.type, name: p.name, x: p.x, z: p.z });
    }
  }

  /** Lieux proposés, en attente de confirmation : repère lumineux léger + étiquette « à confirmer ». */
  setPendingPlaces(list) {
    if (this.pendingGroup) { this.group.remove(this.pendingGroup); this.pendingGroup.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); }
    const g = this.pendingGroup = new THREE.Group(); this.group.add(g);
    for (const p of list) {
      const col = p.mine ? '#7ee0a5' : '#f4c542';
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 7, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.set(p.x, 3.5, p.z); g.add(beam);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture('❓ ' + p.name, { bg: p.mine ? '#1f7a4d' : '#f4c542', fg: p.mine ? '#fff' : '#2a1a05', w: 512, h: 128, sub: p.mine ? 'à confirmer par les voisins' : 'ça existe ?', border: '#fff' }), depthWrite: false, fog: false }));
      sp.scale.set(4.4, 1.1, 1); sp.position.set(p.x, 7.6, p.z); g.add(sp);
    }
  }

  _avenueProps(ctx, roads, blocked) {
    const { B, R } = ctx, E = HALF - 8;
    const free = (x, z, m = 2) => !blocked.some(b => rectOverlap({ x, z, w: 3, d: 3 }, b, m));
    // poteaux + fils le long de l'avenue (côté nord)
    let prev = null;
    for (let x = -E; x <= E; x += 22) {
      const z = -7.2; if (!free(x, z, -1)) { prev = null; continue; }
      pole(ctx, x, z, 8);
      if (prev) { wire(ctx, prev, z, x, z, 7.5, .6, -.35); wire(ctx, prev, z, x, z, 7.5, .6, .35); wire(ctx, prev, z, x, z, 7.2, .6, 0); }
      prev = x;
    }
    for (let x = -E + 10; x <= E; x += 44) if (free(x, 7.2, -1)) lamp(ctx, x, 7.2, 5.5, Math.PI);
    // kiosques et boutiques
    const kiosks = [['KIOSQUE', '#1e6fb8'], ['MOBILE MONEY', '#e67e22'], ['BOUTIQUE', '#2e7d4f'], ['COIFFURE', '#8e24aa'], ['PHARMACIE', '#2e9e5b'], ['BOULANGERIE', '#c75a1a'], ['COUTURE', '#c2185b'], ['CYBER', '#37474f']];
    let k = 0; const used = [];
    for (let tries = 0; tries < 80 && k < 12; tries++) {
      const side = R() < .5 ? -1 : 1, x = (R() - .5) * (E * 2 - 10), z = side * (8.3 + R() * .4);
      if (!free(x, z, 1.5) || used.some(u => Math.abs(u - x) < 9 && Math.sign(u) === Math.sign(x)) ) { continue; }
      used.push(x); const [txt, col] = kiosks[k % kiosks.length]; k++;
      const ry = side < 0 ? 0 : Math.PI, w = 3.4, d = 2.6;
      B.add(G.box, M(x, 1.3, z, 0, w, 2.6, d), col, 'wall', .02);
      B.add(G.box, M(x, 2.75, z, 0, w + .8, .12, d + .8), '#7a8087', 'roof', .05, [1, 1]);
      B.add(G.box, M(x, 1.0, z + (side < 0 ? 1 : -1) * (d / 2 + .02), 0, 2.2, 1.0, .05), '#1b2733', 'paint', 0);
      const ks = new THREE.Mesh(new THREE.PlaneGeometry(3.0, .62), new THREE.MeshStandardMaterial({ map: signTexture(txt, { bg: '#ffffff', fg: col, w: 512, h: 105, border: col }), roughness: .8 }));
      ks.position.set(x, 2.25, z + (side < 0 ? 1 : -1) * (d / 2 + .09)); ks.rotation.y = side < 0 ? 0 : Math.PI; ctx.extras.push(ks);
      addCollider(ctx, rectPoly(x, z, w, d));
      if (R() < .6) { B.add(G.cyl, M(x + w / 2 + .8, 1.4, z + side * (-.8), 0, .04, 2.8, .04), '#777', 'paint', 0); parkedMoto(ctx, x - w / 2 - 1.3, z + side * -.4, Math.PI / 2 + R() * .3, ['#c0392b', '#2e86de', '#27ae60'][k % 3]); }
    }
  }

  _scatterTrees(ctx, roads, blocked, osm) {
    const { R, B } = ctx, E = HALF - 6;
    // alignement de neems le long de l'avenue
    for (let x = -E; x <= E; x += 13 + R() * 5) for (const side of [-1, 1]) {
      const z = side * (11.8 + R() * 1.2);
      if (blocked.some(b => rectOverlap({ x, z, w: 3, d: 3 }, b, 0)) || this._insideCollider(x, z, 2)) continue;
      if (R() < .75) tree(ctx, x, z, .95 + R() * .45, R() < .6 ? 'neem' : 'mango');
    }
    if (osm?.trees) for (const [x, z] of osm.trees) if (!blocked.some(b => rectOverlap({ x, z, w: 3, d: 3 }, b, 0))) tree(ctx, x, z, .9 + R() * .5, R() < .6 ? 'neem' : 'mango');
    const N = osm ? 50 : (this.quality === 'low' ? 40 : 80);
    for (let i = 0, ok = 0; i < 600 && ok < N; i++) {
      const x = (R() - .5) * E * 2, z = (R() - .5) * E * 2;
      if (blocked.some(b => rectOverlap({ x, z, w: 4, d: 4 }, b, 1)) || distToRoads(roads, x, z) < 2.5 || this._insideCollider(x, z, 2.2)) continue;
      tree(ctx, x, z, .8 + R() * .7, R() < .55 ? 'neem' : 'mango'); ok++;
    }
    for (let i = 0, ok = 0; i < 900 && ok < 260; i++) {
      const x = (R() - .5) * E * 2, z = (R() - .5) * E * 2;
      if (blocked.some(b => rectOverlap({ x, z, w: 2, d: 2 }, b, 0)) || distToRoads(roads, x, z) < 1.2 || this._insideCollider(x, z, 1)) continue;
      R() < .35 ? shrub(ctx, x, z, .7 + R() * .7) : tuft(ctx, x, z); ok++;
      if (R() < .25) B.add(G.plane, M(x, .016, z, R() * 6, 3 + R() * 4, 1, 3 + R() * 4), ['#8aa04a', '#9bae55', '#7d9444'][Math.floor(R() * 3)], 'patch', .08);
    }
  }
  _insideCollider(x, z, m = 0) {
    for (const c of this.colliders) if (x > c.minx - m && x < c.maxx + m && z > c.minz - m && z < c.maxz + m) return true;
    return false;
  }
  _boundary(ctx) {
    const { B, R } = ctx, E = HALF + 6;
    for (let t = -E; t <= E; t += 7 + R() * 3) for (const [x, z] of [[t, -E], [t, E], [-E, t], [E, t]]) {
      if (R() < .85) tree(ctx, x + (R() - .5) * 4, z + (R() - .5) * 4, 1.3 + R() * .6, R() < .5 ? 'neem' : 'mango');
    }
    // murs invisibles
    const w = 20; for (const [x, z, ww, dd] of [[0, -E - 6, E * 2 + 40, w], [0, E + 6, E * 2 + 40, w], [-E - 6, 0, w, E * 2 + 40], [E + 6, 0, w, E * 2 + 40]]) addCollider(ctx, rectPoly(x, z, ww, dd));
  }

  // ---------- personnages ----------
  _spawnNpcs(content, R) {
    for (const [id, def] of Object.entries(content.npcs)) {
      const a = this.anchors[def.at]; if (!a) { console.warn('ancre manquante', def.at); continue; }
      const ch = buildCharacter(def);
      ch.group.position.set(a.x, a.y || 0, a.z); ch.group.rotation.y = a.ry;
      this.group.add(ch.group);
      this.npcs.set(id, { id, def, char: ch, home: new THREE.Vector3(a.x, a.y || 0, a.z), homeRy: a.ry, pos: ch.group.position, talking: false, follow: false, speed: 0, height: ch.height });
    }
  }
  _spawnAmbient(ctx, R) {
    const limit = this.quality === 'low' ? 14 : 40;
    for (const a of ctx.ambient.slice(0, limit)) {
      const ch = buildCharacter(a.spec); ch.group.position.set(a.x, a.y || 0, a.z); ch.group.rotation.y = a.ry;
      if (a.mode === 'sit') { ch.group.position.y -= .42; ch.parts.legL.rotation.x = -1.45; ch.parts.legR.rotation.x = -1.45; }
      this.group.add(ch.group); this.ambient.push({ ...a, char: ch, phase: R() * 6, ref: null });
    }
    // on remplace la liste d'entrée par celle des instances (les specs d'origine ont été consommées)
    this.ambient = this.ambient.filter(a => a.char);
  }
  _spawnWalkers(R) {
    const n = this.quality === 'low' ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, z = (i % 4 < 2 ? -1 : 1) * (7.6 + R() * 1.2), x = (R() - .5) * 250;
      const ch = buildCharacter(randomSpec(R, i % 3 ? 'shopper' : 'visitor_m')); ch.group.position.set(x, 0, z); this.group.add(ch.group);
      this.walkers.push({ char: ch, dir, z, x, speed: 1.0 + R() * .5 });
    }
  }
  _spawnTraffic(R) {
    const n = this.quality === 'low' ? 3 : 6, cols = ['#c0392b', '#2e86de', '#27ae60', '#e67e22', '#8e44ad', '#f1c40f'];
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, g = motoModel(cols[i % cols.length]), rider = buildCharacter(randomSpec(R, 'rider'));
      rider.group.position.set(0, -.2, -.32); rider.parts.legL.rotation.x = rider.parts.legR.rotation.x = -1.2; rider.parts.legL.scale.y = rider.parts.legR.scale.y = .55;
      rider.parts.armL.rotation.x = rider.parts.armR.rotation.x = -1.25; rider.group.scale.setScalar(.95); g.add(rider.group);
      g.position.set((R() - .5) * 280, 0, dir * (2.0 + R() * .8)); g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(g); this.traffic.push({ g, dir, speed: 5 + R() * 4, wheels: g.userData.wheels });
    }
  }

  // ---------- collisions ----------
  _buildGrid() {
    const C = 16; this.cell = C; this.grid.clear();
    const put = (k, v) => { let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(v); };
    this.colliders.forEach(c => { for (let gx = Math.floor(c.minx / C); gx <= Math.floor(c.maxx / C); gx++) for (let gz = Math.floor(c.minz / C); gz <= Math.floor(c.maxz / C); gz++) put(gx + ',' + gz, c); });
    this.circles.forEach(c => { for (let gx = Math.floor((c.x - c.r) / C); gx <= Math.floor((c.x + c.r) / C); gx++) for (let gz = Math.floor((c.z - c.r) / C); gz <= Math.floor((c.z + c.r) / C); gz++) put(gx + ',' + gz, c); });
  }
  /** Repousse `p` (Vector3) hors des obstacles. */
  resolve(p, r = .38) {
    const C = this.cell;
    for (let it = 0; it < 3; it++) {
      const seen = new Set();
      for (let gx = Math.floor((p.x - r) / C); gx <= Math.floor((p.x + r) / C); gx++) for (let gz = Math.floor((p.z - r) / C); gz <= Math.floor((p.z + r) / C); gz++) {
        const lst = this.grid.get(gx + ',' + gz); if (!lst) continue;
        for (const o of lst) {
          if (seen.has(o)) continue; seen.add(o);
          if (o.pts) {
            if (p.x < o.minx - r || p.x > o.maxx + r || p.z < o.minz - r || p.z > o.maxz + r) continue;
            let best = 1e9, bx = 0, bz = 0; const pts = o.pts, n = pts.length; let inside = false;
            for (let i = 0, j = n - 1; i < n; j = i++) {
              const [ax, az] = pts[j], [bx2, bz2] = pts[i];
              if (((az > p.z) !== (bz2 > p.z)) && (p.x < (bx2 - ax) * (p.z - az) / (bz2 - az) + ax)) inside = !inside;
              const dx = bx2 - ax, dz = bz2 - az, L2 = dx * dx + dz * dz; let t = L2 ? ((p.x - ax) * dx + (p.z - az) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
              const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(p.x - qx, p.z - qz);
              if (d < best) { best = d; bx = qx; bz = qz; }
            }
            if (inside) { const dx = bx - p.x, dz = bz - p.z, L = Math.hypot(dx, dz) || 1; p.x = bx + dx / L * r; p.z = bz + dz / L * r; }
            else if (best < r) { const dx = p.x - bx, dz = p.z - bz, L = Math.hypot(dx, dz) || 1; p.x = bx + dx / L * r; p.z = bz + dz / L * r; }
          } else {
            const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
            if (d < m && d > 1e-4) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; }
          }
        }
      }
    }
    for (const n of this.npcs.values()) { const dx = p.x - n.pos.x, dz = p.z - n.pos.z, d = Math.hypot(dx, dz), m = .45 + r; if (d < m && d > 1e-4) { p.x = n.pos.x + dx / d * m; p.z = n.pos.z + dz / d * m; } }
    return p;
  }

  nearestNpc(p, maxDist = 3.4) {
    let best = null, bd = maxDist;
    for (const n of this.npcs.values()) { const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  /** vrai si un point (caméra) est dans le feuillage d'un arbre */
  inCrown(x, z, y) {
    if (y > 8) return false;
    for (const c of this.circles) if (c.crown && Math.abs(c.x - x) < c.crown && Math.abs(c.z - z) < c.crown && Math.hypot(c.x - x, c.z - z) < c.crown) return true;
    return false;
  }
  /** 'road' si le joueur est sur le goudron, sinon 'dust' */
  surfaceAt(x, z) {
    for (const r of this.roads) if (r.kind === 'asphalt') for (let i = 0; i < r.pts.length - 1; i++) if (segDist(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) < r.w / 2) return 'road';
    return 'dust';
  }
  /** vrai si un cycliste/piéton de rayon r ne peut pas se tenir en (x,z) */
  blockedAt(x, z, r = .42) {
    const p = this._bp || (this._bp = new THREE.Vector3()); p.set(x, 0, z); const ox = x, oz = z;
    const sv = this.npcs; this.npcs = new Map(); this.resolve(p, r); this.npcs = sv;
    return Math.abs(p.x - ox) > .02 || Math.abs(p.z - oz) > .02;
  }
  /** Chemin (liste de points) entre deux positions, en contournant murs et bâtiments (A* sur grille de 1,5 m). */
  findPath(ax, az, bx, bz) {
    const C = 1.5, N = Math.ceil((HALF + 10) * 2 / C), off = HALF + 10, key = (i, j) => i * N + j;
    const ci = x => Math.max(0, Math.min(N - 1, Math.floor((x + off) / C))), wc = i => i * C - off + C / 2;
    const free = new Map(), ok = (i, j) => { const k = key(i, j); let v = free.get(k); if (v === undefined) { v = !this.blockedAt(wc(i), wc(j), .5); free.set(k, v); } return v; };
    let si = ci(ax), sj = ci(az), gi = ci(bx), gj = ci(bz);
    const open = [[0, si, sj]], g = new Map([[key(si, sj), 0]]), from = new Map();
    const h = (i, j) => Math.hypot(i - gi, j - gj);
    let best = null, n = 0;
    while (open.length && n++ < 30000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, i, j] = open.splice(bi, 1)[0];
      if (Math.hypot(i - gi, j - gj) <= 2.2) { best = [i, j]; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        if (!ok(ni, nj)) continue; if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
        const ng = g.get(key(i, j)) + (di && dj ? 1.414 : 1); if (ng >= (g.get(key(ni, nj)) ?? 1e9)) continue;
        g.set(key(ni, nj), ng); from.set(key(ni, nj), key(i, j)); open.push([ng + h(ni, nj), ni, nj]);
      }
    }
    if (!best) return null;
    const out = []; let k = key(best[0], best[1]);
    while (k !== undefined) { out.push([wc(Math.floor(k / N)), wc(k % N)]); k = from.get(k); }
    out.reverse(); out.push([bx, bz]); return out;
  }
  zoneAt(x, z) {
    let best = null, bd = 1e9;
    for (const zn of this.zones) { const d = Math.hypot(zn.x - x, zn.z - z); if (d < zn.r && d < bd) { bd = d; best = zn; } }
    return best;
  }

  // ---------- mise à jour ----------
  update(dt, t, playerPos) {
    this.t = t;
    // soleil qui suit le joueur
    this.sun.target.position.set(playerPos.x, 0, playerPos.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 100);
    this.sky.position.set(playerPos.x, 0, playerPos.z);
    for (const f of this.flags) {
      const a = f.mesh.geometry.attributes.position, b = f.base;
      for (let i = 0; i < a.count; i++) { const x = b[i * 3], k = x / 1.9; a.setZ(i, Math.sin(x * 3.2 - t * 4 + f.phase) * .14 * k + Math.sin(t * 2 + b[i * 3 + 1]) * .03 * k); a.setY(i, b[i * 3 + 1] - Math.sin(x * 3.2 - t * 4 + f.phase) * .03 * k); a.setX(i, x); }
      a.needsUpdate = true; f.mesh.geometry.computeVertexNormals();
    }
    for (const s of this.smokes) {
      s.t += dt; if (s.t > s.life) s.t -= s.life; const k = s.t / s.life;
      s.sp.position.set(s.e.x + Math.sin(k * 6 + s.t) * .25 * k + k * .5, s.e.y + k * 3.2, s.e.z + Math.cos(k * 5) * .2 * k);
      s.sp.scale.setScalar(.5 + k * 2.2); s.sp.material.opacity = Math.sin(k * 3.14) * .32;
    }
    for (const c of this.clouds) { c.position.x += dt * 2.2; if (c.position.x > 700) c.position.x = -700; }
    this.city?.update(dt, t, playerPos);
    const R2 = 70 * 70;
    for (const a of this.ambient) {
      const d2 = (a.char.group.position.x - playerPos.x) ** 2 + (a.char.group.position.z - playerPos.z) ** 2;
      a.char.group.visible = d2 < 180 * 180; if (d2 > R2 * 2) continue;
      a.char.update(dt, { speed: 0, t: t + a.phase, cheering: a.mode === 'cheer' && this.cheer, look: a.mode === 'idle' && d2 < 150 ? playerPosVec(playerPos) : null });
    }
    for (const n of this.npcs.values()) {
      const d2 = (n.pos.x - playerPos.x) ** 2 + (n.pos.z - playerPos.z) ** 2;
      n.char.group.visible = d2 < 160 * 160; if (d2 > 90 * 90 && !n.follow) continue;
      n.char.update(dt, { speed: n.speed, t, talking: n.talking, look: d2 < 12 * 12 ? playerPosVec(playerPos, 1.55) : null });
    }
  }

  /** Dessine la couche statique de la minicarte et renvoie un canvas. */
  minimapStatic(size = 280) {
    if (this._minimapStatic?.width === size) return this._minimapStatic;
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), s = size / (HALF * 2 + 20), o = size / 2;
    g.fillStyle = '#b86a3e'; g.fillRect(0, 0, size, size);
    const P = (x, z) => [o + x * s, o + z * s];
    for (const r of this.roads) { g.strokeStyle = r.kind === 'asphalt' ? '#55565b' : '#d9a074'; g.lineWidth = Math.max(1.5, r.w * s * 1.1); g.lineJoin = 'round'; g.beginPath(); r.pts.forEach(([x, z], i) => { const [px, pz] = P(x, z); i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.stroke(); }
    g.fillStyle = 'rgba(70,40,25,.8)';
    for (const col of this.colliders) { if (col.maxx - col.minx > 60) continue; g.beginPath(); col.pts.forEach(([x, z], i) => { const [px, pz] = P(x, z); i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.closePath(); g.fill(); }
    const Z = { quartier: '#e8a33d', sante: '#3aa6a0', meeting: '#d9534f', culture: '#7b5ea7' };
    for (const z of this.zones) { const [px, pz] = P(z.x, z.z); g.fillStyle = Z[z.key] + '55'; g.strokeStyle = Z[z.key]; g.lineWidth = 2; g.beginPath(); g.arc(px, pz, z.r * s, 0, 7); g.fill(); g.stroke(); }
    this._minimapStatic = c; c.scale = s; return c;
  }
}

const _pv = new THREE.Vector3();
function playerPosVec(p, y = 1.5) { return _pv.set(p.x, y, p.z); }
