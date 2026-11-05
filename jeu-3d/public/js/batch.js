// Fusionne des milliers de petites formes en quelques maillages (rapide sur téléphone).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { rng } from './textures.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function M(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

export class Batcher {
  constructor(seed = 1) { this.lists = {}; this.R = rng(seed); this.tris = 0; }
  /** geom : BufferGeometry ; matrix : Matrix4 ; color : couleur ; mat : nom du matériau ; jitter : variation de teinte */
  add(geom, matrix, color = '#ffffff', mat = 'paint', jitter = 0.05, uvScale = null) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3), c = new THREE.Color(color);
    const j = 1 + (this.R() - .5) * 2 * jitter;
    for (let i = 0; i < n; i++) { arr[i * 3] = Math.min(1, c.r * j); arr[i * 3 + 1] = Math.min(1, c.g * j); arr[i * 3 + 2] = Math.min(1, c.b * j); }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (uvScale) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]); }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    this.tris += n / 3;
    (this.lists[mat] ||= []).push(g);
  }
  /** materials : { nom: { material, cast, receive } } */
  build(materials, parent) {
    const out = [];
    for (const [name, list] of Object.entries(this.lists)) {
      const cfg = materials[name]; if (!cfg) { console.warn('matériau manquant', name); continue; }
      // on découpe en paquets de ~60k sommets pour garder des indices raisonnables
      let batch = [], count = 0;
      const flush = () => {
        if (!batch.length) return;
        const g = mergeGeometries(batch, false); g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, cfg.material); mesh.castShadow = cfg.cast !== false; mesh.receiveShadow = cfg.receive !== false;
        mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.name = 'batch:' + name; parent.add(mesh); out.push(mesh); batch = []; count = 0;
      };
      for (const g of list) { batch.push(g); count += g.attributes.position.count; if (count > 400000) flush(); }
      flush();
      list.length = 0;
    }
    return out;
  }
}

// primitives réutilisables
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 10),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
// boîte posée sur le sol : base à y, centre en x,z
export function addBox(B, w, h, d, x, y, z, ry, color, mat = 'wall', jitter = .04) { B.add(G.box, M(x, y + h / 2, z, ry, w, h, d), color, mat, jitter); }
export function addCyl(B, r, h, x, y, z, color, mat = 'paint', rt = r, seg = 12) {
  const g = seg === 12 && rt === r ? G.cyl : new THREE.CylinderGeometry(rt, r, 1, seg);
  B.add(g, M(x, y + h / 2, z, 0, seg === 12 && rt === r ? r : 1, h, seg === 12 && rt === r ? r : 1), color, mat, .03);
}
