// Personnages 3D procéduraux : peaux, tenues burkinabè (boubou, pagne wax, Faso Dan Fani, blouse...), coiffes, animations.
import * as THREE from 'three';
import { DETAIL } from './quality.js';
import { Batcher, M, G } from './batch.js';
import { waxTexture, fasoDanFaniTexture } from './textures.js';

export const SKINS = ['#e3b48c', '#c98f60', '#a8693f', '#8b5a3a', '#6a4127', '#4b2d19'];
export const OUTFITS = {
  m: ['boubou', 'chemise', 'tshirt'],
  f: ['pagne', 'boubou_f', 'tshirt'],
};
const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: 0, side: THREE.DoubleSide });
const matCache = new Map();
function patMat(kind, c1, c2, pattern) {
  const key = `${kind}|${c1}|${c2}|${pattern}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ map: kind === 'fdf' ? fasoDanFaniTexture(pattern) : waxTexture(c1, c2, pattern), roughness: .88, side: THREE.DoubleSide }));
  return matCache.get(key);
}

const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, DETAIL.cap[0], DETAIL.cap[1]);
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

export function buildCharacter(spec) {
  const o = { gender: 'm', age: 'adult', skin: 3, outfit: 'tshirt', colors: ['#c0392b', '#2c3e50'], pattern: 0, head: 'aucun', hair: 'court', beard: false, ...spec };
  const [c1, c2] = o.colors;
  const skin = SKINS[Math.max(0, Math.min(5, o.skin))];
  const skinD = shade(skin, .82);
  const child = o.age === 'child', elder = o.age === 'elder', fem = o.gender === 'f';
  const S = child ? .62 : fem ? .955 : elder ? .97 : 1;
  const HS = child ? 1.32 : 1;               // tête plus grosse chez l'enfant
  const hipY = .93;
  const mats = { p: { material: charMat }, wax: { material: patMat('wax', c1, c2, o.pattern) }, fdf: { material: patMat('fdf', c1, c2, o.pattern) } };

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);          // porte l'échelle
  body.scale.setScalar(S);
  const mk = () => new Batcher(o.pattern + 3);
  const P = { torso: mk(), armL: mk(), armR: mk(), legL: mk(), legR: mk(), head: mk() };
  const add = (k, g, m, col, mat = 'p') => P[k].add(g, m, col, mat, 0);

  // ---------- jambes ----------
  const shoe = o.outfit === 'blouse' ? '#f4f4f4' : (fem ? '#3a2a22' : '#2b2420');
  for (const k of ['legL', 'legR']) {
    add(k, CAP(.066, .72), M(0, -.45, 0), skin);
    add(k, G.box, M(0, -.905, .045, 0, .095, .05, .22), shoe);
  }
  // ---------- bras ----------
  for (const k of ['armL', 'armR']) {
    add(k, CAP(.048, .42), M(0, -.27, 0), skin);
    add(k, G.sphere, M(0, -.58, 0, 0, .055, .06, .055), skin);
  }
  // ---------- torse ----------
  const tw = fem ? 1.05 : 1.2;
  add('torso', CAP(.14, .30), M(0, .30, 0, 0, tw, 1, .76), skin);           // base
  add('torso', new THREE.CylinderGeometry(.055, .06, .12, 10), M(0, .60, 0), skin);  // cou

  // ---------- tenues ----------
  const trousers = (col, len = .82, r = .082) => { for (const k of ['legL', 'legR']) add(k, new THREE.CylinderGeometry(r, r * .92, len, 12), M(0, -len / 2 + .02, 0), col); };
  const sleeves = (mat, col, len = .5, r = .062, r2 = r) => { for (const k of ['armL', 'armR']) add(k, new THREE.CylinderGeometry(r, r2, len, 12), M(0, -len / 2 + .02, 0), col, mat); };
  const shirt = (mat, col, len = .55) => add('torso', CAP(.155, .30 + (len - .55)), M(0, .3 - (len - .55) / 2 + 0, 0, 0, tw, 1, .8), col, mat);

  switch (o.outfit) {
    case 'tshirt':
      shirt('p', c1); sleeves('p', c1, .22, .06, .06); trousers(c2); break;
    case 'chemise':
      if (o.pattern % 2 === 0) { shirt('fdf', '#ffffff'); sleeves('fdf', '#ffffff', .5, .058, .056); }
      else { shirt('p', c1); sleeves('p', c1, .5, .058, .056); }
      trousers(shade(c2, .55)); break;
    case 'uniforme':
      shirt('p', c1, .5); sleeves('p', c1, .2, .058, .058); trousers(c2, .26, .075); break;
    case 'blouse':
      shirt('p', '#ffffff'); sleeves('p', '#ffffff', .36, .062, .066);
      add('torso', new THREE.CylinderGeometry(.19, .3, .55, 14, 1, true), M(0, .02 - .18, 0, 0, 1, 1, .9), '#ffffff');
      add('torso', G.box, M(0, .5, .1, 0, .12, .1, .02), c2); // badge/col
      trousers('#f2f2f2'); break;
    case 'boubou': case 'boubou_f': {
      add('torso', new THREE.CylinderGeometry(.19, .43, .86, 20, 1, true), M(0, .62 - .43 - .06, 0, 0, 1, 1, .78), c1);
      add('torso', CAP(.158, .30), M(0, .3, 0, 0, tw, 1, .8), c1);
      add('torso', new THREE.TorusGeometry(.19, .02, 6, 24).rotateX(Math.PI / 2), M(0, -.35, 0, 0, 1, 1, .8), c2);     // bande de broderie bas
      add('torso', new THREE.TorusGeometry(.115, .02, 6, 20).rotateX(Math.PI / 2), M(0, .56, 0, 0, 1, 1, .78), c2);    // col
      add('torso', G.box, M(0, .4, .125, 0, .07, .26, .02), c2);                                                   // plastron brodé
      sleeves('p', c1, .46, .1, .17); trousers(c1, .5, .09); break;
    }
    case 'pagne':
      add('torso', CAP(.15, .30), M(0, .33, 0, 0, tw, 1, .8), c1);                                               // blouse
      add('torso', new THREE.CylinderGeometry(.2, .31, .74, 20, 1, true), M(0, -.22 + .0, 0, 0, 1, 1, .85), '#ffffff', 'wax'); // jupe wax
      add('torso', new THREE.TorusGeometry(.205, .022, 6, 24).rotateX(Math.PI / 2), M(0, .14, 0, 0, 1, 1, .85), shade(c2, .85)); // ceinture
      add('torso', new THREE.CylinderGeometry(.075, .098, .5, 10), M(0, .3, 0), c1);  // (cache)
      sleeves('p', c1, .22, .062, .064);
      for (const k of ['legL', 'legR']) add(k, new THREE.CylinderGeometry(.07, .07, .05, 8), M(0, -.9, 0), skin);
      break;
    case 'tablier':
      add('torso', CAP(.15, .30), M(0, .3, 0, 0, tw, 1, .8), '#f3efe6');
      sleeves('p', '#f3efe6', .22, .062, .064);
      add('torso', new THREE.CylinderGeometry(.2, .3, .72, 20, 1, true), M(0, -.2, 0, 0, 1, 1, .85), shade(c2, .5));
      add('torso', G.box, M(0, .13, .17, 0, .3, .62, .03), c1);                      // tablier
      add('torso', G.box, M(0, .46, .13, 0, .24, .16, .03), c1); break;
    default: shirt('p', c1); trousers(c2);
  }

  // ---------- tête ----------
  const hy = .93 + .76 - .93;                       // hauteur relative des hanches
  const hr = .118;
  const headG = new THREE.Group();
  add('head', G.sphere, M(0, 0, 0, 0, hr * .95, hr * 1.1, hr), skin);
  add('head', G.sphere, M(0, -.075, .018, 0, hr * .7, hr * .62, hr * .75), skin); // menton/mâchoire
  for (const s of [-1, 1]) {
    add('head', G.sphere, M(s * .043, .016, hr * .88, 0, .019, .014, .009), '#f4f1ea');                 // œil blanc
    add('head', G.sphere, M(s * .043, .016, hr * .88 + .006, 0, .0095, .0095, .006), '#1b1410');        // pupille
    add('head', G.box, M(s * .045, .054, hr * .86, 0, .04, .008, .01, 0, -s * .12), '#201712');       // sourcil
    add('head', G.sphere, M(s * (hr * .93), -.005, -.004, 0, .014, .03, .022), skin);                    // oreille
  }
  add('head', G.sphere, M(0, -.012, hr * .96, 0, .019, .022, .02), skinD);                               // nez
  add('head', G.box, M(0, -.058, hr * .83, 0, .042, .008, .01), '#5e2a26');                              // bouche
  add('head', G.sphere, M(0, -.052, hr * .84, 0, .026, .006, .01), '#7a3a34');

  const hairCol = elder ? '#d9d6d0' : '#16100d';
  const hairy = o.hair !== 'aucun' && !['foulard', 'foulard_blanc', 'casque'].includes(o.head);
  if (hairy && o.hair === 'court') add('head', new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * .5), M(0, .012, -.004, 0, hr * 1.04, hr * 1.12, hr * 1.04, -.42), hairCol);
  if (hairy && o.hair === 'afro') add('head', G.sphere, M(0, .045, -.012, 0, hr * 1.22, hr * 1.1, hr * 1.2), hairCol);
  if (hairy && o.hair === 'tresses') {
    add('head', new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * .5), M(0, .012, -.004, 0, hr * 1.05, hr * 1.12, hr * 1.05, -.42), hairCol);
    for (let i = 0; i < 6; i++) { const a = -.85 + i * .34; add('head', CAP(.011, .2), M(Math.sin(a) * .1, -.07, -Math.cos(a) * .09 - .02, 0, 1, 1, 1, .08), hairCol); }
  }
  if (o.beard) add('head', G.sphere, M(0, -.085, .05, 0, hr * .62, hr * .55, hr * .5), elder ? '#d9d6d0' : '#16100d');

  const wrap = (col, mat) => {
    add('head', G.sphere, M(0, .048, -.008, 0, hr * 1.1, hr * .7, hr * 1.1), col, mat);
    add('head', new THREE.TorusGeometry(hr * 1.0, .026, 8, 22).rotateX(Math.PI / 2), M(0, .035, 0, 0, 1.0, 1, 1.08), col, mat);
    add('head', G.sphere, M(.055, .125, -.065, 0, .05, .045, .05), col, mat);
    add('head', G.box, M(.095, .1, -.07, 0, .06, .02, .03, 0, -.5), col, mat);
  };
  switch (o.head) {
    case 'foulard': wrap('#ffffff', 'wax'); break;
    case 'foulard_blanc': { add('head', G.sphere, M(0, .03, -.02, 0, hr * 1.1, hr * 1.12, hr * 1.14), '#fbfbfb'); add('head', new THREE.TorusGeometry(hr * 1.02, .02, 8, 22).rotateX(Math.PI / 2), M(0, .04, 0, 0, 1, 1, 1.05), '#e8e8e8'); break; }
    case 'bonnet': add('head', new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .46), M(0, .02, 0, 0, hr * 1.08, hr * 1.05, hr * 1.08, -.1), c2); add('head', new THREE.TorusGeometry(hr * 1.03, .022, 6, 20).rotateX(Math.PI / 2), M(0, .035, -.005, 0, 1, 1, 1), shade(c2, .7)); break;
    case 'kufi': add('head', new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .4), M(0, .035, 0, 0, hr * 1.05, hr * 1.0, hr * 1.05, -.05), '#f4efe2'); add('head', new THREE.TorusGeometry(hr * .98, .016, 6, 20).rotateX(Math.PI / 2), M(0, .045, 0, 0, 1, 1, 1), c2); break;
    case 'casquette': add('head', new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5), M(0, .03, 0, 0, hr * 1.06, hr * 1.04, hr * 1.06, -.12), c1); add('head', G.box, M(0, .035, hr * 1.1, 0, .17, .012, .12, .12), shade(c1, .75)); break;
    case 'chapeau': add('head', new THREE.CylinderGeometry(.095, .105, .09, 16), M(0, .1, 0), '#d8b878'); add('head', new THREE.CylinderGeometry(.21, .21, .014, 24), M(0, .05, 0), '#c9a86a'); add('head', new THREE.TorusGeometry(.1, .01, 6, 18).rotateX(Math.PI / 2), M(0, .075, 0), c1); break;
    case 'casque': add('head', G.sphere, M(0, .012, -.004, 0, hr * 1.2, hr * 1.2, hr * 1.2), c1); add('head', G.box, M(0, .01, hr * 1.12, 0, .17, .05, .03), '#101418'); add('head', G.box, M(0, -.075, hr * 1.0, 0, .12, .035, .08), c1); break;
  }
  headG.position.set(0, hipY + .76 + (child ? .03 : 0), 0);
  headG.scale.setScalar(HS);

  // accessoire : canne pour les anciens
  if (elder) add('armR', CAP(.014, 1.0), M(.0, -.58, .1, 0, 1, 1, 1, .0), '#7a5230');

  // ---------- assemblage des pivots ----------
  const mkPivot = (k, x, y) => {
    const g = new THREE.Group(); g.position.set(x, y, 0);
    const meshes = P[k].build(mats, g); meshes.forEach(m => { m.matrixAutoUpdate = true; });
    body.add(g); return g;
  };
  const legL = mkPivot('legL', -.095, hipY), legR = mkPivot('legR', .095, hipY);
  const torso = mkPivot('torso', 0, hipY);
  const shoulderY = hipY + .5, shW = fem ? .205 : .235;
  const armL = mkPivot('armL', -shW, shoulderY), armR = mkPivot('armR', shW, shoulderY);
  P.head.build(mats, headG).forEach(m => { m.matrixAutoUpdate = true; });
  body.add(headG);
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
  armL.rotation.z = .07; armR.rotation.z = -.07;
  if (elder) torso.rotation.x = .06;

  const state = { phase: Math.random() * 6, headYaw: 0, headPitch: 0, wave: 0, lookT: null };
  const tmp = new THREE.Vector3();

  /** opts : { speed (m/s), talking, cheering, t, look (Vector3 monde) } */
  function update(dt, opts = {}) {
    const speed = opts.speed || 0, t = opts.t ?? performance.now() / 1000;
    const moving = Math.min(1, speed / 1.3);
    state.phase += dt * (3 + speed * 2.4);
    const sw = Math.sin(state.phase) * .62 * moving;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    const bob = Math.abs(Math.sin(state.phase)) * .035 * moving;
    body.position.y = bob;
    const breathe = Math.sin(t * 1.9 + state.phase) * .008;
    torso.scale.y = 1 + breathe;
    if (opts.cheering) {
      const a = -2.5 + Math.sin(t * 7 + state.phase) * .35;
      armL.rotation.x = a; armR.rotation.x = a + Math.sin(t * 6) * .1; armL.rotation.z = .25; armR.rotation.z = -.25;
      body.position.y = Math.abs(Math.sin(t * 6 + state.phase)) * .08;
    } else if (opts.talking) {
      armL.rotation.x = -sw * .9 * moving; armL.rotation.z = .07;
      armR.rotation.x = -.9 + Math.sin(t * 5.2 + state.phase) * .35; armR.rotation.z = -.2;
    } else {
      armL.rotation.x = -sw * .85; armR.rotation.x = sw * .85;
      armL.rotation.z += (.07 + Math.sin(t * 1.3 + state.phase) * .015 - armL.rotation.z) * Math.min(1, dt * 8);
      armR.rotation.z += (-.07 - Math.sin(t * 1.3 + state.phase) * .015 - armR.rotation.z) * Math.min(1, dt * 8);
    }
    if (elder && !opts.cheering) { armR.rotation.x = -.15 + sw * .2; }
    // regard
    let ty = 0, tp = 0;
    if (opts.look) {
      root.updateWorldMatrix(true, false);
      tmp.copy(opts.look); root.worldToLocal(tmp);
      ty = Math.max(-1.1, Math.min(1.1, Math.atan2(tmp.x, tmp.z)));
      tp = Math.max(-.35, Math.min(.35, -Math.atan2(tmp.y - 1.5, Math.hypot(tmp.x, tmp.z)) * .6));
    }
    state.headYaw += (ty - state.headYaw) * Math.min(1, dt * 6);
    state.headPitch += (tp - state.headPitch) * Math.min(1, dt * 6);
    headG.rotation.set(state.headPitch + (opts.talking ? Math.sin(t * 6) * .03 : 0), state.headYaw, 0);
  }

  return { group: root, update, height: 1.8 * S, parts: { armL, armR, legL, legR, torso, head: headG } };
}

/** Prépare la spec d'un joueur à partir des choix d'avatar. */
export function avatarSpec(av = {}) {
  const fem = av.gender === 'f';
  const palettes = [['#c0392b', '#f1c40f'], ['#1f6fb2', '#f4d03f'], ['#1e8f5a', '#f7e9a8'], ['#8e44ad', '#f1c40f'], ['#e67e22', '#2c3e50'], ['#d81b60', '#ffd54f']];
  const pal = palettes[(av.color ?? 0) % palettes.length];
  return {
    gender: fem ? 'f' : 'm', age: 'adult', skin: av.skin ?? 3,
    outfit: av.outfit || (fem ? 'pagne' : 'boubou'),
    colors: pal, pattern: av.pattern ?? 1,
    head: av.head || (fem ? 'foulard' : 'aucun'),
    hair: av.hair || (fem ? 'tresses' : 'court'),
  };
}
