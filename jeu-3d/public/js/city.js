// La ville qui vit : motos, voitures et piétons qui suivent le vrai réseau de rues.
import * as THREE from 'three';
import { motoModel } from './props.js';
import { buildCharacter } from './characters.js';

class Path {
  constructor(pts) {
    this.pts = pts; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
  }
  /** position et direction (unitaire) à la distance s */
  at(s, out) {
    const c = this.cum; let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
    const a = this.pts[lo], b = this.pts[hi], L = c[hi] - c[lo] || 1, t = Math.min(1, Math.max(0, (s - c[lo]) / L));
    out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.dx = (b[0] - a[0]) / L; out.dz = (b[1] - a[1]) / L;
    return out;
  }
}

const CAR_COLS = ['#f4f4f0', '#c9ccd1', '#2f3a4a', '#8a1c1c', '#f1c40f', '#1f6b3a', '#5a4632'];
function carModel(col, taxi) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: taxi ? '#2c8a4b' : col, roughness: .45, metalness: .35 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1c2833', roughness: .2, metalness: .6 });
  const m = (w, h, d, x, y, z, mat) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  m(1.75, .62, 4.2, 0, .62, 0, body);
  m(1.55, .55, 2.1, 0, 1.2, -.2, glass); m(1.5, .08, 2.0, 0, 1.52, -.2, body);
  m(1.6, .12, .12, 0, .42, 2.08, new THREE.MeshStandardMaterial({ color: '#222' }));
  m(.3, .12, .06, .6, .75, 2.12, new THREE.MeshBasicMaterial({ color: '#fff3c8' })); m(.3, .12, .06, -.6, .75, 2.12, new THREE.MeshBasicMaterial({ color: '#fff3c8' }));
  m(.3, .1, .06, .65, .75, -2.12, new THREE.MeshBasicMaterial({ color: '#d33' })); m(.3, .1, .06, -.65, .75, -2.12, new THREE.MeshBasicMaterial({ color: '#d33' }));
  if (taxi) m(.8, .22, .35, 0, 1.68, -.2, new THREE.MeshStandardMaterial({ color: '#f1c40f', emissive: '#7a6200' }));
  const wheels = [], tm = new THREE.MeshStandardMaterial({ color: '#151515', roughness: .9 });
  for (const [x, z] of [[.85, 1.3], [-.85, 1.3], [.85, -1.3], [-.85, -1.3]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .24, 12).rotateZ(Math.PI / 2), tm); w.position.set(x, .34, z); w.castShadow = true; g.add(w); wheels.push(w); }
  g.userData.wheels = wheels; return g;
}

export class CityLife {
  constructor(world, R, randomSpec, quality) {
    this.world = world; this.R = R; this.randomSpec = randomSpec; this.q = quality;
    this.vehicles = []; this.peds = []; this.events = []; this.honkAt = 0;
    const good = world.roads.filter(r => r.pts.length >= 2).map(r => ({ r, path: new Path(r.pts) })).filter(o => o.path.len > 25);
    this.paths = good;
    if (!good.length) return;
    // les rues proches du joueur sont favorisées
    const wt = good.map(o => { const m = o.path.at(o.path.len / 2, {}); return o.path.len * (o.r.kind === 'asphalt' ? 1.6 : 1) / (1 + Math.hypot(m.x, m.z) / 140); });
    const tot = wt.reduce((a, b) => a + b, 0), pickRoad = () => { let x = R() * tot; for (let i = 0; i < good.length; i++) { x -= wt[i]; if (x <= 0) return good[i]; } return good[0]; };
    const nVeh = quality === 'low' ? 8 : quality === 'mid' ? 16 : 22, nPed = quality === 'low' ? 14 : quality === 'mid' ? 30 : 44;
    for (let i = 0; i < nVeh; i++) {
      const o = pickRoad(), dir = R() < .5 ? 1 : -1, kind = R() < .72 ? 'moto' : (R() < .5 ? 'taxi' : 'car');
      let g, wheels;
      if (kind === 'moto') {
        g = motoModel(['#c0392b', '#2e86de', '#27ae60', '#e67e22', '#8e44ad', '#f1c40f', '#222'][i % 7]);
        const rider = buildCharacter(randomSpec(R, 'rider'));
        rider.group.position.set(0, -.2, -.32); rider.parts.legL.rotation.x = rider.parts.legR.rotation.x = -1.2; rider.parts.legL.scale.y = rider.parts.legR.scale.y = .55;
        rider.parts.armL.rotation.x = rider.parts.armR.rotation.x = -1.25; rider.group.scale.setScalar(.95); g.add(rider.group);
        if (R() < .35) { const p2 = buildCharacter(randomSpec(R, 'visitor_f')); p2.group.position.set(0, -.14, -.95); p2.group.scale.setScalar(.9); p2.parts.legL.rotation.x = p2.parts.legR.rotation.x = -1.2; p2.parts.legL.scale.y = p2.parts.legR.scale.y = .55; g.add(p2.group); }
      } else g = carModel(CAR_COLS[Math.floor(R() * CAR_COLS.length)], kind === 'taxi');
      wheels = g.userData.wheels; g.visible = false; world.group.add(g);
      const base = (kind === 'moto' ? 6.5 : 5.2) + R() * 3.2;
      this.vehicles.push({ g, wheels, o, dir, kind, s: R() * o.path.len, speed: base, base, lane: (o.r.w || 5) * (.2 + R() * .08), pos: new THREE.Vector3(), vel: 0, honk: R() * 20, tmp: {} });
    }
    for (let i = 0; i < nPed; i++) {
      const o = pickRoad(), dir = R() < .5 ? 1 : -1, side = R() < .5 ? 1 : -1;
      const ch = buildCharacter(randomSpec(R, i % 3 === 0 ? 'vendor' : i % 3 === 1 ? 'shopper' : 'visitor_m')); ch.group.visible = false; world.group.add(ch.group);
      this.peds.push({ ch, o, dir, side, s: R() * o.path.len, speed: .9 + R() * .7, off: (o.r.w || 5) / 2 + .9 + R() * 1.2, pause: 0, tmp: {}, pos: ch.group.position });
    }
  }

  update(dt, t, pp) {
    const FAR2 = 190 * 190, tmp = this._t || (this._t = {});
    for (const v of this.vehicles) {
      const L = v.o.path.len; v.path = v.o.path;
      // freine si le joueur (ou un autre véhicule lent) est devant
      let target = v.base;
      const ahead = v.o.path.at(Math.min(L, Math.max(0, v.s + v.dir * 6)), tmp), px = pp.x - v.pos.x, pz = pp.z - v.pos.z, along = px * (v.dx || 0) + pz * (v.dz || 0), lat = Math.abs(px * -(v.dz || 0) + pz * (v.dx || 0));
      if (along > 0 && along < 9 && lat < 2.2) { target = Math.max(0, (along - 3) * .8); if (t - this.honkAt > 2.5 && along < 7) { this.honkAt = t; this.events.push({ type: 'honk', x: v.pos.x, z: v.pos.z }); } }
      v.speed += (target - v.speed) * Math.min(1, dt * 2.5);
      v.s += v.dir * v.speed * dt;
      if (v.s > L) { v.s = L; v.dir = -1; } if (v.s < 0) { v.s = 0; v.dir = 1; }
      const c = v.o.path.at(v.s, v.tmp), nx = -c.dz * v.dir, nz = c.dx * v.dir;
      const x = c.x + nx * v.lane, z = c.z + nz * v.lane;
      v.dx = c.dx * v.dir; v.dz = c.dz * v.dir; v.vel = v.speed;
      v.pos.set(x, 0, z);
      const d2 = (x - pp.x) ** 2 + (z - pp.z) ** 2, vis = d2 < FAR2; v.g.visible = vis;
      if (!vis) continue;
      v.g.position.set(x, 0, z);
      const ry = Math.atan2(v.dx, v.dz); let d = ry - v.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); v.g.rotation.y += d * Math.min(1, dt * 8);
      v.g.rotation.z = v.kind === 'moto' ? -d * .35 : 0;
      for (const w of v.wheels) w.rotation.x += v.speed * dt / (v.kind === 'moto' ? .3 : .34);
      v.honk -= dt; if (v.honk < 0) { v.honk = 14 + this.R() * 30; if (d2 < 60 * 60) this.events.push({ type: 'honk', x, z, light: v.kind === 'moto' }); }
    }
    for (const p of this.peds) {
      const L = p.o.path.len, g = p.ch.group;
      const d2p = (p.pos.x - pp.x) ** 2 + (p.pos.z - pp.z) ** 2;
      if (p.pause > 0) { p.pause -= dt; if (d2p < FAR2) p.ch.update(dt, { speed: 0, t }); continue; }
      p.s += p.dir * p.speed * dt;
      if (p.s > L) { p.s = L; p.dir = -1; } if (p.s < 0) { p.s = 0; p.dir = 1; }
      if (this.R() < dt * .01) p.pause = 2 + this.R() * 5;
      const c = p.o.path.at(p.s, p.tmp), x = c.x + -c.dz * p.side * p.off, z = c.z + c.dx * p.side * p.off;
      g.position.set(x, 0, z);
      const vis = d2p < 120 * 120; g.visible = vis; if (!vis) continue;
      g.rotation.y = Math.atan2(c.dx * p.dir, c.dz * p.dir);
      p.ch.update(dt, { speed: p.speed, t });
    }
  }
  /** les véhicules les plus proches (pour le bruit de moteur) */
  nearVehicles(pp, n = 4, maxD = 55) {
    const a = []; for (const v of this.vehicles) { const d = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z); if (d < maxD) a.push({ v, d }); }
    return a.sort((x, y) => x.d - y.d).slice(0, n);
  }
  dispose() { for (const v of this.vehicles) this.world.group.remove(v.g); for (const p of this.peds) this.world.group.remove(p.ch.group); this.vehicles = []; this.peds = []; }
}
