// Hallowmere street dressing, after Don's mood reference (research/refs/ref_mood_hallowmere_street_1.jpg):
// crenellated stone arch bridges over Lantern Street receding into the fog, big rusted pipes with flanges and valve
// wheels along the walls, sagging cables, hot-pink and teal neon tubes, and hooded figures in the haze.
// Everything is merged into a handful of meshes per material so phones pay only a few draw calls.
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { mulberry32 } from './util.js';
import { buildPerson } from './models.js';
import { Q } from './quality.js';

const R = mulberry32(1709); // own seed: the main world layout sequence stays unchanged
const rr = (a, b) => a + R() * (b - a);

// Collects transformed primitives and merges them into one non-indexed BufferGeometry, with UVs scaled to metres
// so tiling PBR textures keep a constant size on stretched boxes/cylinders.
class Batch {
  constructor() { this.parts = []; }
  add(geo, m, uvScale) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (uvScale) uvScale(g); g.applyMatrix4(m); this.parts.push(g); }
  box(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, tile = 2) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uv = g.attributes.uv; // faces: +x, -x, +y, -y, +z, -z (4 verts each)
    const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
    this.add(g, mat4(x, y, z, sx, sy, sz, rx, ry, rz));
  }
  cyl(x, y, z, r, len, rx = 0, ry = 0, rz = 0, seg = 10, tile = 2) {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    this.add(g, mat4(x, y, z, 1, 1, 1, rx, ry, rz), (gg) => { const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r / tile, uv.getY(i) * len / tile); });
  }
  geo(g, m) { this.add(g, m); }
  mesh(mat, scene, { shadow = true } = {}) {
    if (!this.parts.length) return null;
    const out = merge(this.parts); this.parts.forEach((p) => p.dispose());
    const m = new THREE.Mesh(out, mat); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m;
  }
}
function mat4(x, y, z, sx, sy, sz, rx, ry, rz) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
function merge(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    const c = p.attributes.position.count;
    pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere(); return g;
}

// sagging cable between two points (catenary-ish parabola)
function cableCurve(a, b, sag) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
  return new THREE.CatmullRomCurve3(pts);
}

export function dressLanternStreet(scene, { stone, rust, W, colliders, mobile }) {
  const S = new Batch(), P = new Batch(), C = new Batch(), N = { pink: new Batch(), teal: new Batch() };
  const neonMat = {
    pink: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.35, 1.6), toneMapped: false }),
    teal: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.8, 2.6), toneMapped: false }),
  };
  const glow = (col, x, y, z, size = 1.2, streak = 0.7) => W.glows.push({ p: new THREE.Vector3(x, y, z), col: col === 'pink' ? new THREE.Color(1, 0.2, 0.65) : new THREE.Color(0.2, 1, 0.92), size: size * 0.6, streak, halo: 0.8 });
  const lights = [];
  const halfW = 6.85; // facade line (plinths) either side of Lantern Street

  // --- crenellated arch bridges, receding north into the fog (and one over the south end) ---
  const arches = [-27, -39, -51, 25];
  arches.forEach((z, ai) => {
    const depth = 2.6, rad = 7.4, cy = 1.4, top = cy + rad + 1.3; // segmental arch springing from the walls ~3.2 m up
    const a0 = Math.acos(halfW / rad), segs = 13;
    for (let i = 0; i < segs; i++) {
      const a = a0 + (Math.PI - 2 * a0) * (i + 0.5) / segs, x = Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      const wseg = (Math.PI - 2 * a0) * rad / segs + 0.05;
      S.box(x, y + 0.45, z, wseg, 0.9, depth + 0.3, 0, 0, a - Math.PI / 2); // voussoir ring
      const yb = y + 0.85; S.box(x, (yb + top) / 2, z, wseg, top - yb, depth, 0, 0, 0); // spandrel fill up to the deck
    }
    S.box(0, top + 0.35, z, halfW * 2 + 0.6, 0.7, depth + 0.5); // deck / string course
    for (const side of [-1, 1]) { // parapet with merlons on both faces
      S.box(0, top + 1.0, z + side * (depth / 2 + 0.05), halfW * 2 + 0.6, 0.6, 0.4);
      for (let x = -halfW + 0.4; x <= halfW - 0.3; x += 1.5) S.box(x, top + 1.65, z + side * (depth / 2 + 0.05), 0.8, 0.7, 0.4);
    }
    for (const sx of [-1, 1]) S.box(sx * (halfW - 0.2), 1.9, z, 1.0, 3.8, depth + 0.6); // piers against the walls
    // neon: a pink tube along the soffit crown, and a vertical tube on one pier (alternating colours)
    const crown = cy + rad - 0.05;
    N.pink.box(0, crown, z + depth / 2 + 0.2, 3.2, 0.07, 0.07); glow('pink', 0, crown, z + depth / 2 + 0.25, 1.6, 0.9);
    const vc = ai % 2 ? 'teal' : 'pink', vx = (ai % 2 ? 1 : -1) * (halfW - 0.75);
    N[vc].box(vx, 2.6, z + depth / 2 + 0.35, 0.07, 2.2, 0.07); glow(vc, vx, 2.6, z + depth / 2 + 0.4, 1.3, 1);
    if (!mobile || ai < 2) lights.push([ai % 2 ? 0xff3aa8 : 0xff3aa8, 0, crown - 0.6, z + depth / 2 + 1.0, 10]);
    // a sagging pink cable under the arch, like the reference
    C.geo(new THREE.TubeGeometry(cableCurve(new THREE.Vector3(-halfW + 0.6, crown - 1.0, z + depth / 2 + 0.25), new THREE.Vector3(halfW - 0.6, crown - 0.7, z + depth / 2 + 0.25), 1.3), 16, 0.025, 4), new THREE.Matrix4());
  });

  // --- rusted pipe runs along both walls with flanges, elbows, drops and valve wheels ---
  const pipeRuns = [[-1, -56, -15, 3.4, 0.28], [1, -56, -16, 5.2, 0.34], [-1, -50, -20, 6.4, 0.2], [1, 16, 62, 3.6, 0.3], [-1, 20, 60, 5.4, 0.24]];
  for (const [side, z0, z1, y, r] of pipeRuns) {
    const x = side * (halfW - 0.1 - r);
    P.cyl(x, y, (z0 + z1) / 2, r, z1 - z0, Math.PI / 2, 0, 0, 12);
    for (let z = z0 + 1; z < z1; z += rr(2.6, 3.6)) P.cyl(x, y, z, r * 1.32, 0.16, Math.PI / 2, 0, 0, 12); // flanges
    for (const z of [z0 + rr(2, 6), z1 - rr(2, 6)]) { // drops to the ground with an elbow and a valve wheel
      if (R() < 0.25) continue;
      const xd = x - side * (r * 1.8);
      P.geo(new THREE.SphereGeometry(r * 1.15, 10, 8), mat4(x, y, z, 1, 1, 1, 0, 0, 0));
      P.cyl((x + xd) / 2, y, z, r * 0.9, Math.abs(xd - x) + r, 0, 0, Math.PI / 2, 10);
      P.cyl(xd, y / 2, z, r * 0.9, y, 0, 0, 0, 10);
      P.cyl(xd, 0.12, z, r * 1.35, 0.24, 0, 0, 0, 10);
      P.geo(new THREE.TorusGeometry(r * 1.6, 0.04, 6, 14), mat4(xd - side * (r + 0.12), 1.3, z, 1, 1, 1, 0, Math.PI / 2, 0));
      P.cyl(xd - side * (r * 0.5 + 0.06), 1.3, z, 0.05, r + 0.12, 0, 0, Math.PI / 2, 6);
      colliders.push({ x: xd, z, r: r + 0.2 });
    }
  }
  // a few big vertical stacks climbing the facades
  for (const [side, z, r] of [[1, -33, 0.42], [-1, -45, 0.36], [1, 40, 0.38]]) {
    const x = side * (halfW - 0.1 - r); P.cyl(x, 9, z, r, 18, 0, 0, 0, 12);
    for (let y = 1.5; y < 18; y += 3.2) P.cyl(x, y, z, r * 1.25, 0.18, 0, 0, 0, 12);
    colliders.push({ x, z, r: r + 0.15 });
  }

  // --- cables strung across the street ---
  for (let z = -57; z < 64; z += rr(5, 9)) {
    if (z > -14 && z < 14) continue; // keep the plaza sky open
    const y0 = rr(5.5, 8.5), y1 = y0 + rr(-1, 1);
    C.geo(new THREE.TubeGeometry(cableCurve(new THREE.Vector3(-halfW, y0, z), new THREE.Vector3(halfW, y1, z + rr(-2, 2)), rr(0.8, 2.0)), 14, 0.03, 4), new THREE.Matrix4());
  }

  // --- wall neon tubes (pink and teal) on the facades ---
  for (const [side, z, y, col, len] of [[1, -31, 3.6, 'teal', 1.8], [-1, -35, 4.2, 'pink', 2.2], [1, -47, 3.0, 'pink', 1.6], [-1, -22, 3.4, 'teal', 1.5], [1, 30, 3.8, 'teal', 1.8], [-1, 36, 3.2, 'pink', 1.6]]) {
    const x = side * (halfW - 0.08);
    N[col].box(x, y, z, 0.06, 0.06, len); glow(col, x - side * 0.15, y, z, 1.3, 0.8);
    C.box(x + side * 0.0, y + 0.12, z - len / 2 - 0.05, 0.03, 0.03, 0.03);
  }

  const stoneM = S.mesh(stone, scene), pipeM = P.mesh(rust, scene);
  const cableM = C.mesh(new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.6, metalness: 0.3 }), scene, { shadow: false });
  for (const k of ['pink', 'teal']) N[k].mesh(neonMat[k], scene, { shadow: false });
  if (Q.name !== 'low') for (const [c, x, y, z, i] of lights) { const L = new THREE.PointLight(c, i, 12, 1.8); L.position.set(x, y, z); scene.add(L); W.lights.push(L); }
  else if (lights[0]) { const [c, x, y, z, i] = lights[0]; const L = new THREE.PointLight(c, i, 12, 1.8); L.position.set(x, y, z); scene.add(L); W.lights.push(L); }

  // --- hooded figures standing in the haze (decor; they keep to the walls) ---
  for (const [x, z, f, coat] of [[-5.4, -43, 0.4, 0x1e2024], [5.2, -36.5, -2.6, 0x26221f], [-5.6, 32, 2.8, 0x1d1f23]]) {
    const p = buildPerson({ coat, hood: true }); p.position.set(x, 0, z); p.rotation.y = f; scene.add(p);
    p.traverse((o) => { if (o.isMesh) { o.castShadow = !mobile; o.receiveShadow = true; } });
    colliders.push({ x, z, r: 0.45 });
  }
  return { stone: stoneM, pipes: pipeM, cables: cableM };
}
