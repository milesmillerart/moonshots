// Procedural models, v2 (build 0.4 graphics pass). Everything is still built in code, no assets:
// sculpted lathe / shell / tube / noise-displaced shapes are authored as many small meshes, then
// baked into ONE mesh per material per animated bone so draw calls stay low (phones included).
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { pbrMaps } from './pbr.js';
import { canvas } from './util.js';
import { detectTouch } from './touch.js';

export const LOW = detectTouch();          // phones/tablets get fewer segments, arcs and motes
const SEG = LOW ? 12 : 20;
const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true;
  if (parent) parent.add(m); return m;
}
function put(m, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); return m; }
const rbox = (w, h, d) => new THREE.BoxGeometry(w, h, d, 1, 1, 1);
const lathe = (pts, seg = SEG, p0 = 0, pl = TAU) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg, p0, pl);
const shell = (rt, rb, h, t0, tl, seg = SEG) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, true, t0, tl);
const sphere = (r, w = SEG, h = Math.max(6, SEG * 0.6 | 0), t0 = 0, tl = Math.PI) => new THREE.SphereGeometry(r, w, h, 0, TAU, t0, tl);
function tube(pts, r, segs = 12, rad = 5) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), segs, r, rad); }
// Horizontal torus arc that follows a Cylinder/Lathe's theta convention (theta 0 = +Z, PI/2 = +X).
function arcTorus(r, tubeR, t0, tl, seg = SEG) {
  const g = new THREE.TorusGeometry(r, tubeR, 4, Math.max(4, Math.round(seg * tl / TAU) + 2), tl);
  g.rotateX(Math.PI / 2); g.rotateY(t0 - (Math.PI / 2 - tl)); return g;
}
// Orient a mesh whose local +Z (or +Y) should follow a direction.
function aim(m, dir, axis = V(0, 1, 0)) { m.quaternion.setFromUnitVectors(axis, dir.clone().normalize()); return m; }

// ---- tiny value noise (for organic displacement) -----------------------------------------------
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.55 + noise3(x * 2.1 + 5, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3 + 3, z * 4.3) * 0.15;
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Displace along the outward direction (from the center, or radially from the Y axis for limbs) and
// paint mottled vertex colors: darker in the folds, raw patches here and there.
function lump(geo, amp, freq, seed, pal, radial = false) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = fbm(x * freq + seed, y * freq + seed * 0.7, z * freq - seed);
    d.set(x, radial ? 0 : y, z); if (d.lengthSq() < 1e-8) d.set(0, Math.sign(y) || 1, 0); d.normalize();
    const k = (f - 0.5) * 2 * amp;
    p.setXYZ(i, x + d.x * k, y + d.y * k, z + d.z * k);
    const raw = noise3(x * freq * 2.3 + 9 + seed, y * freq * 2.3, z * freq * 2.3);
    c.copy(pal[0]).lerp(pal[1], c01(0.55 - (f - 0.5) * 2.6));
    if (raw > 0.66) c.lerp(pal[2], c01((raw - 0.66) * 3.2));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
const LS = LOW ? 10 : 16;
const blob = (r, pal, amp = 0.06, freq = 3, seed = 0) => lump(new THREE.SphereGeometry(r, LS, LS * 0.75 | 0), r * amp * 2.2, freq / r * 1.1, seed, pal);
// Tapered, slightly muscled limb hanging down -Y from its joint, rounded at both ends.
function limbGeo(r0, r1, len, pal, seed = 0, amp = 0.25) {
  const pts = [[0.001, -len - r1 * 0.8], [r1 * 0.75, -len - r1 * 0.45]];
  for (let i = 0; i <= 5; i++) { const t = 1 - i / 5; pts.push([(r0 + (r1 - r0) * t) * (1 + 0.16 * Math.sin(t * Math.PI)), -len * t]); }
  pts.push([r0 * 0.75, r0 * 0.45], [0.001, r0 * 0.8]);
  return lump(lathe(pts, LOW ? 7 : 10), (r0 + r1) * 0.5 * amp * 1.3, 9 / (r0 + r1), seed, pal, true);
}

// ---- bake: merge every static mesh under each bone into one mesh per material ------------------
function mergeGeos(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const hasCol = parts.every((g) => g.attributes.color && g.attributes.color.itemSize === 3);
  const hasUv = parts.every((g) => g.attributes.uv);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = hasCol ? new Float32Array(n * 3) : null, uv = hasUv ? new Float32Array(n * 2) : null;
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (col) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3);
    if (uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
function bake(root, bones, shadow = true) {
  root.updateMatrixWorld(true);
  const boneSet = new Set(bones), M4 = new THREE.Matrix4();
  for (const bone of bones) {
    const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert();
    const byMat = new Map(), dead = [];
    const walk = (o) => {
      for (const c of o.children) {
        if (boneSet.has(c) || c.userData.keep) continue;
        if (c.isMesh) {
          const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
          g.applyMatrix4(M4.multiplyMatrices(inv, c.matrixWorld));
          if (!byMat.has(c.material)) byMat.set(c.material, []);
          byMat.get(c.material).push(g); dead.push(c);
        }
        walk(c);
      }
    };
    walk(bone);
    for (const c of dead) { c.parent.remove(c); c.geometry.dispose(); }
    for (const [mat, list] of byMat) {
      const m = new THREE.Mesh(mergeGeos(list), mat); m.castShadow = shadow && !mat.userData.noShadow;
      bone.add(m);
    }
  }
}

// ---- materials ------------------------------------------------------------------------------------
const DNOISE = `float dh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh(i), dh(i + vec3(1,0,0)), f.x), mix(dh(i + vec3(0,1,0)), dh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh(i + vec3(0,0,1)), dh(i + vec3(1,0,1)), f.x), mix(dh(i + vec3(0,1,1)), dh(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
// Fresnel rim (so matte-black plate reads as a silhouette in the rain) and an optional noise
// dissolve with a glowing edge (enemy deaths). Both are small onBeforeCompile patches.
function patch(mat, { rim = null, power = 3.2, dissolve = null, edge = '0.35, 2.8, 2.4' } = {}) {
  mat.onBeforeCompile = (sh) => {
    if (dissolve) {
      sh.uniforms.uDissolve = dissolve;
      sh.vertexShader = 'varying vec3 vDPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vDPos = position;');
      sh.fragmentShader = 'uniform float uDissolve; varying vec3 vDPos;\n' + DNOISE + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float dN = dnoise(vDPos * 9.0) * 0.7 + dnoise(vDPos * 23.0) * 0.3; if (dN < uDissolve) discard;`)
        .replace('#include <dithering_fragment>', `gl_FragColor.rgb += vec3(${edge}) * (1.0 - smoothstep(0.0, 0.06, dN - uDissolve)) * step(0.001, uDissolve);
          #include <dithering_fragment>`);
    }
    if (rim) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(${rim.join(',')}) * pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), ${power.toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => `p2|${rim ? rim.join(',') + '|' + power : ''}|${dissolve ? 'd' + edge : ''}`;
  return mat;
}
let _grunge = null;
function grunge() {
  if (_grunge) return _grunge;
  _grunge = new THREE.CanvasTexture(canvas(128, 128, (g) => {
    g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const v = (105 + Math.random() * 110) | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    g.strokeStyle = 'rgba(60,60,60,0.6)'; g.lineWidth = 0.7;
    for (let i = 0; i < 45; i++) { const x = Math.random() * 128, y = Math.random() * 128, a = Math.random() * TAU, l = 4 + Math.random() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }));
  _grunge.wrapS = _grunge.wrapT = THREE.RepeatWrapping;
  return _grunge;
}
const glow = (r, g, b) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false }); m.userData.noShadow = true; return m; };
export const MAT = {
  plate: () => patch(new THREE.MeshStandardMaterial({ color: 0x0d0e11, metalness: 0.9, roughness: 0.55, roughnessMap: grunge(), side: THREE.DoubleSide, envMapIntensity: 1.25 }), { rim: [0.1, 0.13, 0.2], power: 3.0 }),
  trim: () => patch(new THREE.MeshStandardMaterial({ color: 0x1c1e23, metalness: 1, roughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 1.2 }), { rim: [0.07, 0.09, 0.13], power: 3.0 }),
  plateDull: () => { const t = pbrMaps('metal_plate', 2, 2); const m = new THREE.MeshStandardMaterial({ color: 0x2a2c31, map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, metalness: 0.5, roughness: 0.85, side: THREE.DoubleSide }); m.normalScale.set(0.5, 0.5); return patch(m, { rim: [0.06, 0.08, 0.12] }); },
  leather: () => { const t = pbrMaps('brown_leather', 2, 2); const m = new THREE.MeshStandardMaterial({ color: 0x3a2d26, map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, roughness: 0.95, metalness: 0.05 }); m.normalScale.set(0.8, 0.8); return m; },
  cloth: () => new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.95, side: THREE.DoubleSide }),
  visor: () => glow(1.0, 0.01, 0.03),
};

function capeAlpha() {
  return canvas(64, 128, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#000';
    // tattered bottom edge: long ragged strips, a few deep tears, holes
    g.beginPath(); g.moveTo(0, 128);
    for (let x = 0; x <= 64; x += 2) g.lineTo(x, 96 + Math.random() * 14 + (x % 8 === 0 ? 14 : 0) * Math.random());
    g.lineTo(64, 128); g.fill();
    for (let i = 0; i < 5; i++) { const x = 4 + Math.random() * 56, y = 52 + Math.random() * 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2.5, 128); g.lineTo(x - 2.5, 128); g.fill(); }
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(6 + Math.random() * 52, 40 + Math.random() * 60, 1 + Math.random() * 2, 0, TAU); g.fill(); }
  });
}
let _mote = null;
function moteTex() {
  if (_mote) return _mote;
  _mote = new THREE.CanvasTexture(canvas(32, 32, (g) => {
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  }));
  return _mote;
}

// ---- Synthblade ---------------------------------------------------------------------------------
// Blade along +Y from the guard, dark steel spine on -X, the ONE synth edge on +X.
const BL = 1.12, B0 = 0.24, BW = 0.125, BT = 0.019, TIPY = B0 + BL + 0.14, TIPX = -BW * 0.16;
const yOf = (u) => B0 + u * (TIPY - B0);
function backX(u) { const b = (v) => -BW * 0.5 * (1 - 0.12 * v) * (1 + 0.42 * (1 - c01(v / 0.17)) ** 2); // flared shoulder under the guard (concept art)
  return u < 0.9 ? b(u) : b(0.9) + (TIPX - b(0.9)) * ((u - 0.9) / 0.1); }
export function edgeX(u) { const e = (v) => BW * 0.5 * (1 - 0.16 * v); return u < 0.78 ? e(u) : e(0.78) + (TIPX - e(0.78)) * Math.pow((u - 0.78) / 0.22, 1.4); }
const thick = (u) => BT * (1 - 0.55 * u);
// cross-section, back (0) to edge (1): flat spine, a fuller groove, a squared wall, then the edge.
// Approved design (docs/lore.md): a real metal longsword with an INSET CHANNEL along its one synth
// edge. Along most of the blade the steel past the wall (fx >= 0.6) is cut down to a thin web: that
// recess is the channel. At the guard and the tip the steel is full (the metal "notches" in Don's
// concept art), so the silhouette never changes between Dormant and Awakened.
const PROF = [[0, 0.5], [0.1, 0.5], [0.2, 0.2], [0.34, 0.2], [0.4, 0.47], [0.48, 0.45], [0.5, 0.43], [1, 0], [0.5, -0.43], [0.48, -0.45], [0.4, -0.47], [0.34, -0.2], [0.2, -0.2], [0.1, -0.5], [0, -0.5]];
const CH_IN = 0.5, CH_FLOOR = 0.11, CH_U0 = 0.045, CH_U1 = 0.885; // channel inner wall (fraction), web half-thickness, start/end along blade
const chDepth = (u) => c01((u - CH_U0) / 0.03) * c01((CH_U1 - u) / 0.035); // 0 = full steel, 1 = channel
const chZ = (u) => CH_FLOOR * thick(u) + 0.0009; // barrier sits just above the web, inside the recess
function bladeGeo() {
  const S = LOW ? 16 : 30, n = PROF.length, rings = [];
  for (let i = 0; i <= S; i++) {
    const u = i / S, xb = backX(u), xe = edgeX(u), t = thick(u), y = yOf(u), ring = [], d = chDepth(u);
    for (const [fx, fz0] of PROF) {
      let fz = fz0;
      if (fx > 0.15 && fx < 0.36) fz = Math.sign(fz0) * (Math.abs(fz0) + (0.47 - Math.abs(fz0)) * c01((u - 0.6) / 0.15)); // fuller runs out
      if (fx >= CH_IN) fz = Math.sign(fz0) * (Math.abs(fz0) + (Math.max(CH_FLOOR * (fx === 1 ? 0.4 : 1), 0) - Math.abs(fz0)) * d); // cut the channel
      ring.push([xb + (xe - xb) * fx, y, fz * t]);
    }
    rings.push(ring);
  }
  const pos = [], uv = [];
  for (let i = 0; i < S; i++) for (let k = 0; k < n; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % n], c = rings[i + 1][(k + 1) % n], d = rings[i + 1][k];
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    const u0 = k / n, u1 = (k + 1) / n, v0 = i / S, v1 = (i + 1) / S;
    uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); // non-indexed: crisp flat facets on the steel
  return g;
}
// The synth barrier: two thin sheets that exactly fill the channel (one per face) plus a hairline
// strip standing on the edge itself. uv.x runs inner wall (0) -> edge (1), uv.y along the channel.
function barrierGeo() {
  const S = LOW ? 16 : 34, pos = [], uv = [], idx = [];
  let v = 0;
  for (const side of [1, -1]) {
    for (let i = 0; i <= S; i++) {
      const u = CH_U0 + 0.012 + (i / S) * (CH_U1 - CH_U0 - 0.03), xb = backX(u), xe = edgeX(u), y = yOf(u), z = side * chZ(u);
      const xi = xb + (xe - xb) * CH_IN + 0.0015;
      pos.push(xi, y, z, xe - 0.0008, y, z * 0.4);
      uv.push(0, i / S, 1, i / S);
      if (i < S) { const q = v + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    v += (S + 1) * 2;
  }
  // edge hairline (stands across the blade plane, within the web's thickness)
  for (let i = 0; i <= S; i++) {
    const u = CH_U0 + 0.012 + (i / S) * (CH_U1 - CH_U0 - 0.03), xe = edgeX(u) + 0.0006, y = yOf(u), w = chZ(u) * 0.55;
    pos.push(xe, y, -w, xe, y, w); uv.push(0.94, i / S, 1, i / S);
    if (i < S) { const q = v + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const EDGE_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// Contained barrier: deep red fill, a hot pink-white seam at the edge, slow drifting veins. Everything
// is drawn inside the channel; uAwake fades it to nothing (Dormant = dark channel).
const EDGE_FS = `uniform float uTime, uHeat, uAwake; uniform vec3 uColor, uHot; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  if (uAwake < 0.004) discard;
  float a = vUv.y, x = vUv.x;
  float flow = n(vec2(a * 14.0 - uTime * 3.0, x * 3.0 + uTime * 0.9)) * 0.6 + n(vec2(a * 37.0 - uTime * 8.0, x * 7.0)) * 0.4;
  float flick = 0.88 + 0.12 * sin(uTime * 47.0 + a * 19.0) * sin(uTime * 11.0 + 1.3);
  float seam = exp(-pow((1.0 - x) * 9.0, 2.0));                 // hot line along the edge
  float wall = exp(-pow(x * 14.0, 2.0)) * 0.35;                  // faint line where it meets the steel wall
  float vein = smoothstep(0.82, 0.98, n(vec2(a * 60.0 - uTime * 6.0, x * 9.0 + uTime * 2.0))) * 0.9;
  float ends = smoothstep(0.0, 0.035, a) * smoothstep(1.0, 0.965, a);
  float fill = 0.34 + 0.3 * flow;
  float hot = clamp(seam * 0.95 + vein * 0.7 + uHeat * 0.3, 0.0, 1.0);
  vec3 col = mix(uColor, uHot, hot);
  float I = (fill + seam * 0.85 + wall + vein * 0.6) * flick * ends * uAwake * (1.0 + uHeat * 0.9);
  gl_FragColor = vec4(col * I, 1.0);
}`;
function edgeMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uHeat: U.uHeat, uAwake: U.uAwake, uColor: U.uColor, uHot: U.uHot },
    vertexShader: EDGE_VS, fragmentShader: EDGE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  m.userData.noShadow = true;
  return m;
}
// World-space embers shed by the awakened edge. Added to the scene by the Player.
function makeMotes(n, size) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(-999), col = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: moteTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.frustumCulled = false;
  return { pts, pos, col, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n).fill(1), n, i: 0, acc: 0 };
}

// Synthblade. ud.setAwake(k) 0..1: 0 = Dormant (channel dark, gems dark, no light, no arcs), 1 = Awakened
// (contained barrier in the channel). Shape and size never change. Statues are always Dormant stone.
export function buildSword({ statue = false, stone = null } = {}) {
  const g = new THREE.Group();
  const steel = stone || new THREE.MeshStandardMaterial({ color: 0x7a808a, metalness: 0.8, roughness: 0.42, roughnessMap: grunge(), envMapIntensity: 1.9 });
  const web = stone || new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: 0.85, roughness: 0.5, envMapIntensity: 0.8 });
  const dark = stone || MAT.plate(), trim = stone || MAT.trim();
  const leather = stone || new THREE.MeshStandardMaterial({ color: 0x120d0b, roughness: 0.9 });
  const wrap = stone || new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.75, metalness: 0.1 });
  const GEM_ON = new THREE.Color(3, 0.12, 0.2), GEM_OFF = new THREE.Color(0.09, 0.02, 0.025);
  const gem = statue ? (stone || steel) : glow(3, 0.12, 0.2);
  // grip, leather wraps, faceted pommel with a synth gem
  mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.3, 10), leather, 0, 0, 0, g);
  for (let k = 0; k < 7; k++) put(mesh(new THREE.TorusGeometry(0.029, 0.0055, 4, 10), wrap, 0, -0.13 + k * 0.043, 0, g), Math.PI / 2, 0, 0.2);
  mesh(lathe([[0.001, -0.29], [0.026, -0.282], [0.04, -0.245], [0.042, -0.2], [0.03, -0.165], [0.02, -0.148]], 8), dark, 0, 0, 0, g); // long faceted pommel (concept)
  const pommelGem = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 3).rotateX(-Math.PI / 2), gem, 0, -0.205, 0.044, g);
  // crossguard (concept art): a flat, wide forged bar with squared ends that turn down, and a
  // triangular synth gem on each face pointing down the blade
  const tri = (r, d) => new THREE.CylinderGeometry(r, r, d, 3).rotateX(-Math.PI / 2); // flat triangle in XY, point toward the blade
  mesh(rbox(0.1, 0.07, 0.072), dark, 0, 0.2, 0, g);
  mesh(rbox(0.12, 0.02, 0.078), trim, 0, 0.168, 0, g);
  for (const s of [-1, 1]) {
    put(mesh(rbox(0.13, 0.036, 0.052), dark, s * 0.11, 0.214, 0, g), 0, 0, s * 0.05);
    put(mesh(rbox(0.12, 0.008, 0.056), trim, s * 0.11, 0.236, 0, g), 0, 0, s * 0.05);
    put(mesh(rbox(0.075, 0.036, 0.056), dark, s * 0.2, 0.226, 0, g), 0, 0, s * 0.6); // ends bend toward the blade
  }
  for (const z of [-1, 1]) mesh(tri(0.026, 0.012), gem, 0, 0.2, z * 0.034, g);
  // ricasso collar + engraved vents along the spine (dark steel; they no longer glow)
  mesh(rbox(BW * 1.12, 0.05, 0.032), trim, -0.004, 0.262, 0, g);
  for (let k = 0; k < 3; k++) mesh(rbox(0.012, 0.024, 0.024), trim, backX(0.05) + 0.012, 0.31 + k * 0.045, 0, g);
  // the blade itself (steel body with the channel cut into its edge side) + the dark web at the channel floor
  mesh(bladeGeo(), steel, 0, 0, 0, g);
  for (const z of [-1, 1]) {
    const wall = [], spine = [];
    for (let i = 0; i <= 12; i++) { const u = CH_U0 + (i / 12) * (CH_U1 - CH_U0), xb = backX(u), xe = edgeX(u);
      wall.push([xb + (xe - xb) * (CH_IN - 0.06), yOf(u), z * (0.47 * thick(u) + 0.0012)]);
      if (u < 0.6) spine.push([xb + (xe - xb) * 0.27, yOf(u), z * (0.2 * thick(u) + 0.0012)]); }
    mesh(tube(wall, 0.0021, 24, 3), trim, 0, 0, 0, g); mesh(tube(spine, 0.0016, 16, 3), trim, 0, 0, 0, g);
    for (const u of [0.3, 0.33, 0.36]) { const xb = backX(u), xe = edgeX(u); // chevron vents
      put(mesh(rbox(0.022, 0.004, 0.002), trim, xb + (xe - xb) * 0.27, yOf(u), z * (0.2 * thick(u) + 0.0012), g), 0, 0, 0.5); }
  }
  void web;
  // the synth barrier: one animated shader confined to the channel
  const U = { uTime: { value: 0 }, uHeat: { value: 0 }, uAwake: { value: statue ? 0 : 1 }, uColor: { value: new THREE.Color(1.05, 0.02, 0.055) }, uHot: { value: new THREE.Color(2.6, 0.62, 0.95) } };
  const edgeMat = edgeMaterial(U);
  const keep = (m) => { m.userData.keep = true; m.castShadow = false; return m; };
  const barrier = statue ? null : keep(mesh(barrierGeo(), edgeMat, 0, 0, 0, g));
  bake(g, [g], !statue);
  // lightning: short jagged bolts that crawl INSIDE the channel (never fork out into the air)
  const MAXV = LOW ? 48 : 140;
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3));
  const arcMat = new THREE.LineBasicMaterial({ color: new THREE.Color(2.6, 0.9, 1.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const arcs = new THREE.LineSegments(arcGeo, arcMat);
  arcs.frustumCulled = false; arcs.visible = !statue; g.add(arcs);
  const light = new THREE.PointLight(0xff1838, statue ? 0 : 2.2, 4, 2); light.position.set(0.06, 0.75, 0); g.add(light);
  const motes = statue ? null : { ember: makeMotes(LOW ? 24 : 64, 0.026) };
  const gems = [];
  g.traverse((o) => { if (o.isMesh && o.material === gem && !statue) gems.push(o); });
  const ud = g.userData = { edgeMat, barrier, arcs, light, gem, pommelGem, uniforms: U, motes, awake: statue ? 0 : 1, statue,
    baseLocal: V(edgeX(0.05), 0.3, 0), tipLocal: V(TIPX, TIPY, 0) };
  ud.setAwake = (k) => {
    k = statue ? 0 : c01(k); ud.awake = k; U.uAwake.value = k;
    if (barrier) barrier.visible = k > 0.004;
    if (!statue) gem.color.copy(GEM_OFF).lerp(GEM_ON, k);
    arcs.visible = !statue && k > 0.25;
  };
  const R = Math.random;
  const inCh = (u, f) => { const xb = backX(u), xe = edgeX(u); return xb + (xe - xb) * (CH_IN + (1 - CH_IN) * f); };
  ud.crackle = (intensity) => {
    const p = arcGeo.attributes.position.array;
    let n = 0;
    const push = (a, b) => { if (n > MAXV - 2) return; p.set(a, n * 3); p.set(b, n * 3 + 3); n += 2; };
    const bolts = Math.min(LOW ? 2 : 4, 1 + Math.floor(intensity * (LOW ? 1.2 : 2.5) * (0.5 + R())));
    for (let b = 0; b < bolts; b++) {
      const u0 = CH_U0 + 0.03 + R() * (CH_U1 - CH_U0 - 0.2), u1 = Math.min(CH_U1 - 0.02, u0 + 0.05 + R() * 0.16);
      const side = R() < 0.5 ? 1 : -1, steps = LOW ? 4 : 7;
      let prev = [inCh(u0, 0.3 + R() * 0.6), yOf(u0), side * chZ(u0) * 1.05];
      for (let s = 1; s <= steps; s++) {
        const u = u0 + (u1 - u0) * (s / steps);
        const cur = [inCh(u, 0.08 + R() * 0.88), yOf(u) + (R() - 0.5) * 0.006, side * chZ(u) * 1.05];
        push(prev, cur); prev = cur;
      }
    }
    arcGeo.attributes.position.needsUpdate = true;
    arcGeo.setDrawRange(0, n);
  };
  // Per-frame: shader time + heat, embers shed from the awakened edge (world space).
  const tmp = new THREE.Vector3();
  ud.tick = (dt, t, act = 0, heat = 0) => {
    U.uTime.value = t % 1000; U.uHeat.value = heat;
    if (!motes || dt <= 0) return;
    const rateK = (LOW ? 0.4 : 1) * ud.awake;
    const emit = (M, rate, init) => {
      M.acc += rate * rateK * dt;
      while (M.acc >= 1) {
        M.acc -= 1; const i = M.i = (M.i + 1) % M.n, u = CH_U0 + R() * (CH_U1 - CH_U0);
        g.localToWorld(tmp.set(edgeX(u) + 0.004, yOf(u), (R() - 0.5) * 0.008));
        M.pos[i * 3] = tmp.x; M.pos[i * 3 + 1] = tmp.y; M.pos[i * 3 + 2] = tmp.z;
        init(i, M);
      }
    };
    emit(motes.ember, 1.5 + act * 10 + heat * 30, (i, M) => {
      M.vel[i * 3] = (R() - 0.5) * 0.7; M.vel[i * 3 + 1] = 0.2 + R() * 0.7; M.vel[i * 3 + 2] = (R() - 0.5) * 0.7;
      M.life[i] = M.max[i] = 0.3 + R() * 0.5;
    });
    const step = (M, cr, cg, cb, drag, rise) => {
      const dr = Math.pow(drag, dt);
      for (let i = 0; i < M.n; i++) {
        if (M.life[i] <= 0) { if (M.pos[i * 3 + 1] > -900) { M.pos[i * 3 + 1] = -999; M.col[i * 3] = M.col[i * 3 + 1] = M.col[i * 3 + 2] = 0; } continue; }
        M.life[i] -= dt;
        M.vel[i * 3] *= dr; M.vel[i * 3 + 2] *= dr; M.vel[i * 3 + 1] = M.vel[i * 3 + 1] * dr + rise * dt;
        M.pos[i * 3] += M.vel[i * 3] * dt; M.pos[i * 3 + 1] += M.vel[i * 3 + 1] * dt; M.pos[i * 3 + 2] += M.vel[i * 3 + 2] * dt;
        const k = c01(M.life[i] / M.max[i]), f = k * k * (1.2 + 0.8 * Math.sin(M.life[i] * 40 + i));
        M.col[i * 3] = cr * f; M.col[i * 3 + 1] = cg * f; M.col[i * 3 + 2] = cb * f;
      }
      M.pts.geometry.attributes.position.needsUpdate = true; M.pts.geometry.attributes.color.needsUpdate = true;
    };
    step(motes.ember, 3.2, 0.5, 0.3, 0.25, 0.25);
  };
  ud.setAwake(ud.awake);
  return g;
}

// ---- The Warden ------------------------------------------------------------------------------------
const HELM = [[0.176, -0.228], [0.158, -0.205], [0.137, -0.172], [0.142, -0.14], [0.162, -0.09], [0.172, -0.02], [0.172, 0.05], [0.156, 0.12], [0.122, 0.175], [0.072, 0.205], [0.001, 0.216]];
const CORE = [[0.17, -0.08], [0.2, 0.08], [0.25, 0.25], [0.282, 0.42], [0.286, 0.52], [0.255, 0.6], [0.17, 0.655], [0.11, 0.68]];
const BREAST = [[0.206, 0.12], [0.262, 0.26], [0.298, 0.42], [0.3, 0.5], [0.272, 0.585], [0.2, 0.635]];
function profR(pr, y) { // radius of a lathe profile at height y
  for (let i = 0; i < pr.length - 1; i++) { const [r0, y0] = pr[i], [r1, y1] = pr[i + 1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0)); }
  return pr[pr.length - 1][0];
}
// a raised trim line running around a lathe surface at height y, from theta t0 over tl
function bandAt(pr, y, sz, t0, tl, rad = 0.007, lift = 0.004) {
  const r = profR(pr, y) + lift, pts = [], n = 10;
  for (let i = 0; i <= n; i++) { const t = t0 + (tl * i) / n; pts.push([Math.sin(t) * r, y, Math.cos(t) * r * sz]); }
  return tube(pts, rad, 16, 4);
}
export function buildWarden({ statue = false } = {}) {
  const stone = statue ? new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.7, metalness: 0.2 }) : null;
  const plate = stone || MAT.plate(), trim = stone || MAT.trim(), dull = stone || MAT.plateDull(), leather = stone || MAT.leather(), cloth = stone || MAT.cloth();
  const visorMat = statue ? glow(2, 0.15, 0.2) : MAT.visor();
  const port = statue ? visorMat : glow(2.6, 0.12, 0.2);
  const black = stone || new THREE.MeshBasicMaterial({ color: 0x010101 });
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // rolls / bob
  const hips = new THREE.Group(); hips.position.y = 1.02; body.add(hips);
  // ---- hips: under-layer, belt with buckle core + pouches, layered tassets
  put(mesh(lathe([[0.1, -0.17], [0.18, -0.1], [0.2, 0], [0.195, 0.1]]), dull, 0, 0, 0, hips), 0, 0, 0, 1, 1, 0.74);
  put(mesh(new THREE.TorusGeometry(0.208, 0.03, 6, SEG), leather, 0, 0.05, 0, hips), Math.PI / 2, 0, 0, 1, 0.74, 1);
  mesh(rbox(0.085, 0.075, 0.03), trim, 0, 0.05, 0.16, hips);
  mesh(rbox(0.03, 0.03, 0.012), port, 0, 0.05, 0.177, hips);
  for (const a of [1.15, -1.15, 2.35, -2.5]) {
    const x = Math.sin(a) * 0.215, z = Math.cos(a) * 0.215 * 0.74;
    put(mesh(rbox(0.075, 0.09, 0.05), leather, x, -0.005, z, hips), 0, a, 0);
    put(mesh(rbox(0.08, 0.028, 0.058), leather, x, 0.04, z, hips), 0.1, a, 0);
  }
  const tasset = (a, n, w) => { for (let i = 0; i < n; i++) put(mesh(shell(0.215 + 0.013 * i, 0.255 + 0.016 * i, 0.1, a - w / 2, w), plate, 0, -0.035 - i * 0.082, 0, hips), 0, 0, 0, 1, 1, 0.78); };
  for (const s of [-1, 1]) { tasset(s * 0.42, 3, 0.74); tasset(s * 1.5, 2, 0.7); }
  tasset(Math.PI, 2, 1.1);
  // ---- legs: under-layer, cuisse, knee cop with wing, greave with ridge, segmented sabaton
  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(side * 0.12, -0.08, 0); hips.add(thigh);
    mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.44, SEG >> 1), dull, 0, -0.22, 0, thigh);
    mesh(shell(0.102, 0.088, 0.34, -1.55, 3.1), plate, 0, -0.19, 0.004, thigh);
    mesh(tube([[0, -0.03, 0.104], [0, -0.2, 0.098], [0, -0.36, 0.09]], 0.007, 8, 4), trim, 0, 0, 0, thigh);
    put(mesh(sphere(0.072), plate, 0, -0.46, 0.045, thigh), 0, 0, 0, 1, 0.85, 0.9);
    put(mesh(sphere(0.062, 10, 6), trim, side * 0.074, -0.46, 0.02, thigh), 0, 0, 0, 0.32, 1.05, 1);
    const shin = new THREE.Group(); shin.position.y = -0.47; thigh.add(shin);
    put(mesh(lathe([[0.058, -0.43], [0.066, -0.36], [0.082, -0.2], [0.087, -0.1], [0.074, -0.01]]), plate, 0, 0, 0, shin), 0, 0, 0, 1, 1, 1.06);
    mesh(tube([[0, -0.03, 0.08], [0, -0.18, 0.093], [0, -0.4, 0.068]], 0.007, 8, 4), trim, 0, 0, 0, shin);
    mesh(rbox(0.118, 0.055, 0.25), plate, 0, -0.478, 0.05, shin);
    for (let k = 0; k < 3; k++) put(mesh(rbox(0.124, 0.03, 0.075), k === 1 ? trim : plate, 0, -0.438 - k * 0.012, -0.01 + k * 0.062, shin), 0.28 + k * 0.1, 0, 0);
    put(mesh(sphere(0.064, SEG, 6, 0, Math.PI / 2), plate, 0, -0.478, 0.15, shin), 0, 0, 0, 0.95, 0.75, 1.3);
    legs.push({ thigh, shin });
  }
  // ---- torso: backplate core, ridged breastplate, abdomen lames, power spine, gorget, pauldrons
  const torso = new THREE.Group(); torso.position.y = 0.12; hips.add(torso);
  put(mesh(lathe(CORE), plate, 0, 0, 0, torso), 0, 0, 0, 1, 1, 0.62);
  put(mesh(lathe(BREAST, SEG, -1.65, 3.3), plate, 0, 0, 0, torso), 0, 0, 0, 1, 1, 0.7);
  mesh(tube(BREAST.map(([r, y]) => [0, y, r * 0.7 + 0.004]), 0.011, 14, 5), trim, 0, 0, 0, torso);
  mesh(bandAt(BREAST, 0.31, 0.7, -1.2, 2.4), trim, 0, 0, 0, torso);
  mesh(bandAt(BREAST, 0.6, 0.7, -1.35, 2.7, 0.009), trim, 0, 0, 0, torso);
  for (let i = 0; i < 3; i++) {
    put(mesh(shell(0.205 + 0.007 * i, 0.215 + 0.007 * i, 0.072, -1.75, 3.5), plate, 0, 0.13 - i * 0.066, 0, torso), 0, 0, 0, 1, 1, 0.72);
    put(mesh(arcTorus(0.215 + 0.007 * i, 0.005, -1.7, 3.4), trim, 0, 0.094 - i * 0.066, 0, torso), 0, 0, 0, 1, 1, 0.72);
  }
  mesh(tube([[0, 0.62, -0.165], [0, 0.42, -0.186], [0, 0.18, -0.16], [0, 0.0, -0.13]], 0.012, 12, 4), trim, 0, 0, 0, torso);
  mesh(rbox(0.13, 0.11, 0.06), dull, 0, 0.5, -0.185, torso);
  for (const x of [-0.04, 0, 0.04]) put(mesh(new THREE.TorusGeometry(0.016, 0.005, 4, 10), port, x, 0.52, -0.217, torso), 0, 0, 0);
  mesh(shell(0.13, 0.172, 0.06, 0, TAU), plate, 0, 0.655, 0, torso);
  mesh(shell(0.108, 0.142, 0.055, 0, TAU), trim, 0, 0.7, 0, torso);
  mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 10), dull, 0, 0.74, 0, torso);
  // cloth cowl draped round the neck and over the shoulders, open at the chest (cover art)
  { const cowl = stone || cloth.clone(); if (!statue) cowl.side = THREE.DoubleSide;
    put(mesh(shell(0.15, 0.31, 0.2, 0.75, TAU - 1.5), cowl, 0, 0.64, -0.01, torso), 0, 0, 0, 1, 1, 0.74);
    put(mesh(shell(0.2, 0.33, 0.07, 0.95, TAU - 1.9), cowl, 0, 0.555, -0.02, torso), 0, 0, 0, 1, 1, 0.76); }
  for (const side of [-1, 1]) {
    const pd = new THREE.Group(); pd.position.set(side * 0.36, 0.578, 0); pd.rotation.z = -side * 0.42; torso.add(pd);
    put(mesh(sphere(0.19, SEG, 10, 0, Math.PI / 2), plate, 0, 0, 0, pd), 0, 0, 0, 1, 0.8, 1.12);
    put(mesh(new THREE.TorusGeometry(0.19, 0.013, 5, SEG), trim, 0, 0, 0, pd), Math.PI / 2, 0, 0, 1, 1.12, 1);
    mesh(tube([[0, 0.02, 0.214], [0, 0.11, 0.152], [0, 0.155, 0], [0, 0.11, -0.152], [0, 0.02, -0.214]], 0.01, 14, 4), trim, 0, 0, 0, pd);
    mesh(tube([[side * 0.1, 0.0, 0.175], [side * 0.12, 0.1, 0.0], [side * 0.1, 0.0, -0.175]], 0.007, 10, 4), trim, 0, 0, 0, pd);
    const t0 = side > 0 ? Math.PI / 2 - 1.4 : -Math.PI / 2 - 1.4;
    for (let i = 0; i < 3; i++) {
      const lame = new THREE.Group(); lame.position.set(side * (0.012 + 0.014 * i), -0.04 - i * 0.068, 0); lame.rotation.z = -side * 0.07 * i; pd.add(lame);
      put(mesh(shell(0.198 - 0.01 * i, 0.215 - 0.01 * i, 0.085, t0, 2.8), plate, 0, 0, 0, lame), 0, 0, 0, 1, 1, 1.1);
      put(mesh(arcTorus(0.215 - 0.01 * i, 0.006, t0, 2.8), trim, 0, -0.042, 0, lame), 0, 0, 0, 1, 1, 1.1);
    }
  }
  // ---- head: smooth dome helm with flared neck guard, red T-visor, center ridge, rear cables
  const head = new THREE.Group(); head.position.y = 0.86; torso.add(head);
  const helm = new THREE.Group(); helm.scale.set(0.95, 1, 1.12); head.add(helm);
  mesh(lathe(HELM, SEG + 4), plate, 0, 0, 0, helm);
  mesh(new THREE.TorusGeometry(0.176, 0.009, 4, SEG + 4), trim, 0, -0.228, 0, helm).rotation.x = Math.PI / 2;
  const ridge = []; for (const [r, y] of HELM) if (y > 0.11) ridge.push([0, y, r + 0.003]);
  for (let i = HELM.length - 2; i >= 0; i--) { const [r, y] = HELM[i]; if (y > -0.16) ridge.push([0, y, -(r + 0.003)]); }
  mesh(tube(ridge, 0.0075, 30, 4), trim, 0, 0, 0, helm);
  mesh(bandAt(HELM, -0.13, 1, -1.3, 2.6, 0.005, 0.002), trim, 0, 0, 0, helm);
  mesh(arcTorus(0.158, 0.019, -0.8, 1.6), black, 0, 0.032, 0, helm);
  const visorH = mesh(arcTorus(0.173, 0.0105, -0.74, 1.48), visorMat, 0, 0.032, 0, helm);
  mesh(rbox(0.038, 0.13, 0.03), black, 0, -0.036, 0.15, helm);
  const visorV = mesh(rbox(0.022, 0.118, 0.022), visorMat, 0, -0.036, 0.166, helm);
  visorH.castShadow = visorV.castShadow = false;
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) put(mesh(rbox(0.026, 0.007, 0.02), black, side * 0.118, -0.085 - k * 0.019, 0.112, helm), 0, side * 0.75, 0);
  put(mesh(sphere(0.06, 10, 6), plate, 0, -0.14, 0.128, helm), 0, 0, 0, 1.45, 0.75, 0.8);
  for (const x of [-0.075, 0, 0.075]) {
    const pts = [V(x, 0.02, -0.17), V(x * 1.3, -0.08, -0.258), V(x * 1.7, -0.26, -0.272), V(x * 2.0, -0.42, -0.232)];
    const curve = new THREE.CatmullRomCurve3(pts);
    mesh(new THREE.TubeGeometry(curve, LOW ? 8 : 14, x === 0 ? 0.024 : 0.019, LOW ? 5 : 6), dull, 0, 0, 0, head);
    for (const t of [0.3, 0.52, 0.74]) aim(mesh(new THREE.TorusGeometry(x === 0 ? 0.027 : 0.022, 0.005, 4, 10), trim, ...curve.getPoint(t).toArray(), head), curve.getTangent(t), V(0, 0, 1));
    aim(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), trim, ...curve.getPoint(0.02).toArray(), head), curve.getTangent(0.02));
    aim(mesh(new THREE.TorusGeometry(0.03, 0.005, 4, 12), port, ...curve.getPoint(0.06).toArray(), head), curve.getTangent(0.06), V(0, 0, 1));
  }
  // ---- arms (driven by 2-bone IK toward the grip; each segment's local +Z runs down the limb)
  const arms = [];
  const zGeo = (geo) => { geo.rotateX(Math.PI / 2); return geo; };
  for (const side of [-1, 1]) {
    const upper = new THREE.Group(); torso.add(upper);
    mesh(zGeo(new THREE.CylinderGeometry(0.06, 0.056, 0.3, SEG >> 1)), dull, 0, 0, 0.15, upper);
    mesh(zGeo(shell(0.074, 0.08, 0.2, side * Math.PI / 2 - 1.45, 2.9)), plate, 0, 0, 0.15, upper);
    put(mesh(sphere(0.066), plate, 0, 0, 0.3, upper), 0, 0, 0, 1, 1, 0.9);
    put(mesh(sphere(0.06, 10, 6), trim, side * 0.06, 0, 0.29, upper), 0, 0, 0, 0.3, 1.1, 1.05);
    const fore = new THREE.Group(); torso.add(fore);
    mesh(zGeo(lathe([[0.065, 0.0], [0.064, 0.12], [0.056, 0.25]])), plate, 0, 0, 0.02, fore);
    mesh(tube([[0, 0.066, 0.04], [0, 0.068, 0.14], [0, 0.06, 0.25]], 0.006, 6, 4), trim, 0, 0, 0, fore);
    mesh(zGeo(new THREE.CylinderGeometry(0.068, 0.088, 0.085, SEG, 1, true)), plate, 0, 0, 0.275, fore);
    mesh(rbox(0.088, 0.094, 0.1), plate, 0, 0, 0.355, fore);
    mesh(rbox(0.094, 0.032, 0.045), trim, 0, 0.034, 0.385, fore);
    for (let k = 0; k < 3; k++) put(mesh(rbox(0.09, 0.026, 0.036), plate, 0, 0.02 - k * 0.022, 0.415 + k * 0.012, fore), 0.5 + k * 0.45, 0, 0);
    mesh(rbox(0.03, 0.03, 0.07), plate, -side * 0.05, -0.01, 0.35, fore);
    arms.push({ side, upper, fore, shoulder: V(side * 0.33, 0.52, 0) });
  }
  // ---- cape: tattered cloth, simulated by the Player (verlet), pinned under the pauldrons
  const CW = LOW ? 5 : 7, CH = LOW ? 10 : 14, CWID = 0.92, CLEN = 1.55;
  const capeGeo = new THREE.PlaneGeometry(CWID, CLEN, CW, CH);
  capeGeo.translate(0, -CLEN / 2, 0);
  { const p = capeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), k = -y / CLEN, e = x / (CWID / 2);
      p.setXYZ(i, x * (1 + 0.28 * k), y, 0.075 * e * e * (1 - 0.6 * k) - 0.04 * k); } }
  capeGeo.computeVertexNormals();
  const capeMat = cloth.clone();
  if (!statue) { capeMat.alphaMap = new THREE.CanvasTexture(capeAlpha()); capeMat.alphaTest = 0.5; }
  const cape = new THREE.Mesh(capeGeo, capeMat); cape.position.set(0, 0.63, -0.215); cape.castShadow = !statue; cape.userData.keep = true;
  torso.add(cape);
  const capeRest = Float32Array.from(capeGeo.attributes.position.array);
  // sword in a holder group so it can be posed in torso space
  const sword = buildSword({ statue, stone }); sword.userData.keep = true; torso.add(sword);
  const bones = [body, hips, torso, head, ...legs.flatMap((l) => [l.thigh, l.shin]), ...arms.flatMap((a) => [a.upper, a.fore])];
  bake(root, bones, !statue);
  root.userData = { body, hips, torso, head, legs, arms, cape, capeRest, capeSim: { cols: CW, rows: CH }, sword, visorMat };
  return root;
}

// ---- Townsfolk: hooded / cloaked low-poly figures ---------------------------------------------------
export function buildPerson({ coat = 0x2a2620, hood = true, kneel = false, lantern = false, helm = false, polearm = false, keys = false } = {}) {
  const g = new THREE.Group();
  const robeMat = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.93, side: THREE.DoubleSide });
  const mantleMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(coat).multiplyScalar(0.62), roughness: 0.95, side: THREE.DoubleSide });
  const skin = new THREE.MeshStandardMaterial({ color: hood ? 0x4a3a33 : 0x7d675c, roughness: 0.8 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3b3e44, metalness: 0.85, roughness: 0.38 });
  const k = kneel ? 0.62 : 1, Y = (y) => y * k;
  // robe: a bell-shaped lathe with vertical folds and a ragged hem
  const robe = lathe([[0.37, 0], [0.34, 0.08], [0.28, 0.42], [0.23, 0.78], [0.21, 0.98], [0.235, 1.16], [0.25, 1.28], [0.2, 1.4], [0.11, 1.47]].map(([r, y]) => [r, Y(y)]), LOW ? 12 : 22);
  { const p = robe.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), lo = 1 - y / Y(1.5);
      const f = 1 + 0.045 * Math.sin(a * 9) * lo + (y < Y(0.12) ? 0.07 * Math.sin(a * 5 + 1.3) : 0);
      p.setXYZ(i, x * f, y + (y < 0.02 ? -0.02 * Math.abs(Math.sin(a * 7)) : 0) + (y < 0.05 ? 0.03 : 0), z * f); }
    robe.computeVertexNormals(); }
  mesh(robe, robeMat, 0, 0, 0, g);
  mesh(lathe([[0.31, Y(1.02)], [0.3, Y(1.18)], [0.235, Y(1.35)], [0.12, Y(1.45)]], LOW ? 10 : 18), mantleMat, 0, 0, 0, g);
  put(mesh(new THREE.TorusGeometry(0.215, 0.022, 5, 16), leather, 0, Y(0.95), 0, g), Math.PI / 2, 0, 0, 1, 0.9, 1);
  // sleeves hanging from the shoulders, hands clasped (or holding a lantern / polearm)
  for (const s of [-1, 1]) {
    const reach = (lantern && s > 0) || (polearm && s > 0);
    const sl = put(mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.56, 8, 1, true), mantleMat, s * 0.25, Y(1.08), reach ? 0.12 : 0.08, g), reach ? -0.9 : -0.35, 0, s * 0.22);
    void sl;
    mesh(new THREE.SphereGeometry(0.045, 8, 6), skin, s * (reach ? 0.31 : 0.07), Y(reach ? 0.98 : 0.84), reach ? 0.38 : 0.24, g);
  }
  // head + hood / helm / coif
  const hy = Y(1.58) + (kneel ? -0.04 : 0), hz = kneel ? 0.06 : 0.02;
  mesh(new THREE.SphereGeometry(0.105, 12, 10), skin, 0, hy, hz, g);
  if (hood) {
    put(mesh(new THREE.SphereGeometry(0.155, LOW ? 10 : 16, 10, Math.PI / 2 + 0.75, TAU - 1.5, 0, Math.PI * 0.64), mantleMat, 0, hy + 0.02, hz - 0.01, g), kneel ? 0.35 : 0.08, 0, 0, 1, 1.05, 1.15);
    put(mesh(new THREE.ConeGeometry(0.07, 0.16, 8), mantleMat, 0, hy + 0.07, hz - 0.17, g), -1.1, 0, 0);
    mesh(new THREE.SphereGeometry(0.096, 10, 8), new THREE.MeshBasicMaterial({ color: 0x030303 }), 0, hy - 0.005, hz + 0.03, g);
  } else if (helm) {
    mesh(lathe([[0.2, 0], [0.19, 0.015], [0.125, 0.03], [0.115, 0.09], [0.085, 0.14], [0.001, 0.155]], 14), metal, 0, hy + 0.035, hz, g);
  } else {
    put(mesh(new THREE.SphereGeometry(0.115, 12, 8, 0, TAU, 0, Math.PI * 0.55), leather, 0, hy + 0.01, hz - 0.01, g), -0.25, 0, 0);
    put(mesh(new THREE.TorusGeometry(0.1, 0.035, 5, 12), mantleMat, 0, hy - 0.09, hz, g), Math.PI / 2, 0, 0); // scarf
  }
  if (lantern) {
    const L = mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.16, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6), toneMapped: false }), 0.33, Y(0.8), 0.4, g);
    mesh(new THREE.ConeGeometry(0.075, 0.06, 6), metal, 0.33, Y(0.8) + 0.11, 0.4, g);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 4), metal, 0.33, Y(0.8) + 0.2, 0.4, g);
    const pl = new THREE.PointLight(0xffa860, 5, 7, 2); pl.position.copy(L.position); g.add(pl);
  }
  if (polearm) {
    mesh(new THREE.CylinderGeometry(0.017, 0.017, 2.3, 6), leather, 0.32, 1.15, 0.38, g);
    mesh(rbox(0.012, 0.22, 0.14), metal, 0.32, 2.22, 0.45, g);
    mesh(new THREE.ConeGeometry(0.025, 0.24, 5), metal, 0.32, 2.42, 0.38, g);
  }
  if (keys) for (let i = 0; i < 3; i++) put(mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 10), metal, -0.17 + i * 0.012, Y(0.88), 0.12, g), 0.3, 0.9, i * 0.6);
  bake(g, [g]);
  return g;
}

// ---- Abominations of the Rot ---------------------------------------------------------------------------
const C = (h) => new THREE.Color(h);
const PALS = {
  husk: [C(0x726660), C(0x241b1e), C(0x7e2e2a)],
  skitter: [C(0x433b3b), C(0x120f11), C(0x4d1d21)],
  spitter: [C(0x6a6d52), C(0x23241a), C(0x6f5a28)],
  bellwright: [C(0x7a6b68), C(0x2a2022), C(0x7a2e2a)],
};
function enemyMats(dissolve) {
  const flesh = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0.05, emissive: 0x000000 }), { rim: [0.03, 0.08, 0.08], power: 3.2, dissolve });
  const bone = patch(new THREE.MeshStandardMaterial({ color: 0xb3a791, roughness: 0.55, metalness: 0.02 }), { dissolve });
  const scrap = patch(new THREE.MeshStandardMaterial({ color: 0x2d2621, roughness: 0.55, metalness: 0.7, roughnessMap: grunge() }), { dissolve });
  const vein = patch(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.6, 2.3), toneMapped: false }), { dissolve });
  const wound = patch(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.55, 0.48), toneMapped: false }), { dissolve });
  vein.userData.noShadow = wound.userData.noShadow = true;
  return { flesh, bone, scrap, vein, wound };
}
// small helper: stud glowing pustules over a sphere of radius r (deterministic per seed)
function pustules(parent, mat, n, r, cx, cy, cz, sMin, sMax, seed, sy = 1, sz = 1) {
  for (let i = 0; i < n; i++) {
    const a = hash3(i, seed, 1) * TAU, e = hash3(i, seed, 2) * 1.6 - 0.6, s = sMin + hash3(i, seed, 3) * (sMax - sMin);
    mesh(new THREE.SphereGeometry(s, 7, 5), mat, cx + Math.cos(a) * Math.cos(e) * r, cy + Math.sin(e) * r * sy, cz + Math.sin(a) * Math.cos(e) * r * sz, parent);
  }
}
function claws(parent, mat, n, y, len, spread, r = 0.022) {
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * spread;
    put(mesh(new THREE.ConeGeometry(r, len, 5), mat, Math.sin(a) * 0.035, y - len * 0.4, Math.cos(a) * 0.03 + 0.02, parent), Math.PI - 0.35, 0, a);
  }
}
export function buildEnemy(type) {
  const root = new THREE.Group();
  const dissolve = { value: 0 };
  const M = enemyMats(dissolve), pal = PALS[type] || PALS.husk;
  const { flesh, bone, scrap, vein, wound } = M;
  const parts = { flesh, vein, scrap, bone, limbs: [], dissolve, headBase: 0 };
  const bones = [];
  const B = (parent, x, y, z) => { const b = new THREE.Group(); b.position.set(x, y, z); parent.add(b); bones.push(b); return b; };
  if (type === 'husk') {
    const body = B(root, 0, 1.0, 0);
    const chest = new THREE.Group(); chest.position.set(0, 0.32, 0.06); chest.rotation.x = 0.55; body.add(chest);
    put(mesh(blob(0.36, pal, 0.07, 3, 1), flesh, 0, 0, 0, chest), 0, 0, 0, 1, 1.2, 0.78);
    put(mesh(blob(0.25, pal, 0.06, 3, 2), flesh, 0.02, -0.34, 0.05, chest), 0, 0, 0, 1.05, 0.8, 0.95);
    // torn-open chest: a glowing wound behind exposed ribs
    put(mesh(new THREE.SphereGeometry(0.1, 10, 8), wound, 0.1, 0.08, 0.22, chest), 0, 0, 0, 1, 1.6, 0.4);
    for (let i = 0; i < 5; i++) put(mesh(arcTorus(0.37 - Math.abs(i - 2) * 0.03, 0.017, -0.35, 2.0, 14), bone, 0, 0.26 - i * 0.075, 0, chest), 0, 0, 0, 1, 1, 0.82);
    mesh(tube([[0, 0.3, 0.27], [0.01, 0.1, 0.29], [0, -0.1, 0.26]], 0.022, 8, 5), bone, 0, 0, 0, chest); // sternum
    for (let i = 0; i < 6; i++) mesh(blob(0.045, [C(0xb3a791), C(0x5e5547), C(0x7e2e2a)], 0.08, 3, 10 + i), bone, 0, 0.36 - i * 0.12, -0.27 + Math.abs(i - 2.5) * 0.012, chest);
    for (const s of [-1, 1]) {
      mesh(tube([[0, 0.2, -0.27], [s * 0.15, 0.3, -0.25], [s * 0.28, 0.36, -0.08]], 0.018, 10, 5), scrap, 0, 0, 0, chest);
      mesh(new THREE.SphereGeometry(0.03, 6, 5), vein, s * 0.28, 0.36, -0.08, chest);
    }
    mesh(blob(0.17, pal, 0.1, 3, 3), flesh, -0.3, 0.38, -0.02, chest);
    pustules(chest, vein, 4, 0.16, -0.3, 0.38, -0.02, 0.022, 0.04, 3);
    const head = B(body, 0, 0.72, 0.44); parts.head = head;
    put(mesh(blob(0.17, pal, 0.08, 3, 4), flesh, 0, 0, 0, head), 0, 0, 0, 0.85, 0.95, 1.25);
    put(mesh(blob(0.08, [C(0xb3a791), C(0x5e5547), C(0x7e2e2a)], 0.1, 3, 5), bone, 0, 0.065, 0.13, head), 0, 0, 0, 2, 0.55, 0.7);
    mesh(new THREE.SphereGeometry(0.03, 7, 5), vein, 0.065, 0.02, 0.19, head);
    mesh(new THREE.SphereGeometry(0.021, 7, 5), vein, -0.06, 0.035, 0.185, head);
    mesh(new THREE.SphereGeometry(0.014, 6, 4), vein, 0.015, 0.095, 0.175, head);
    mesh(rbox(0.1, 0.024, 0.07), vein, 0, -0.035, 0.16, head);
    const jaw = B(head, 0, -0.05, 0.06); parts.jaw = jaw;
    put(mesh(blob(0.1, pal, 0.08, 3, 6), flesh, 0, -0.03, 0.07, jaw), 0, 0, 0, 1, 0.45, 1.35);
    for (let i = 0; i < 6; i++) put(mesh(new THREE.ConeGeometry(0.011, 0.045, 4), bone, -0.05 + i * 0.02, 0.005, 0.17 - Math.abs(i - 2.5) * 0.01, jaw), 0, 0, 0);
    for (const side of [-1, 1]) {
      const arm = B(body, side * 0.38, 0.6, 0.24);
      mesh(blob(0.11, pal, 0.08, 3, 7 + side), flesh, 0, 0.02, 0, arm);
      mesh(limbGeo(0.08, 0.058, 0.48, pal, 8 + side), flesh, 0, 0, 0, arm);
      const fore = B(arm, 0, -0.48, 0);
      mesh(blob(0.05, [C(0xb3a791), C(0x5e5547), C(0x7e2e2a)], 0.1, 3, 9 + side), bone, 0, 0, -0.02, fore);
      mesh(limbGeo(0.062, 0.045, 0.46, pal, 10 + side), flesh, 0, 0, 0, fore);
      mesh(blob(0.06, pal, 0.1, 3, 11 + side), flesh, 0, -0.48, 0.01, fore);
      claws(fore, bone, 3, -0.5, 0.2, 0.45);
      if (side > 0) { // a rusted cleaver grafted into the forearm
        put(mesh(rbox(0.018, 0.55, 0.09), scrap, side * 0.05, -0.36, 0.04, fore), 0, 0, -side * 0.08);
        for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), scrap, side * 0.035, -0.12 - k * 0.1, 0.03, fore).rotation.z = Math.PI / 2;
      }
      parts.limbs.push({ g: arm, fore, side, arm: true });
      const thigh = B(body, side * 0.17, 0, 0);
      mesh(limbGeo(0.09, 0.065, 0.48, pal, 12 + side), flesh, 0, 0, 0, thigh);
      const shin = B(thigh, 0, -0.48, 0);
      mesh(limbGeo(0.065, 0.045, 0.46, pal, 13 + side), flesh, 0, 0, 0, shin);
      put(mesh(blob(0.07, pal, 0.1, 3, 14 + side), flesh, 0, -0.5, 0.06, shin), 0, 0, 0, 1, 0.5, 1.6);
      parts.limbs.push({ g: thigh, shin, side, arm: false });
    }
    parts.body = body;
  } else if (type === 'bellwright') {
    const body = B(root, 0, 1.0, 0);
    const bellMat = patch(new THREE.MeshStandardMaterial({ color: 0x6e4c1e, metalness: 0.6, roughness: 0.4, roughnessMap: grunge(), emissive: 0x000000, envMapIntensity: 0.3 }), { rim: [0.1, 0.07, 0.03], power: 2.5, dissolve });
    const rope = patch(new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.95 }), { dissolve });
    const mass = new THREE.Group(); mass.position.set(0, 0.38, 0.06); mass.rotation.x = 0.6; body.add(mass);
    put(mesh(blob(0.44, pal, 0.07, 3, 21), flesh, 0, 0, 0, mass), 0, 0, 0, 1.25, 1.1, 0.85);
    mesh(blob(0.32, pal, 0.09, 3, 22), flesh, 0, 0.34, -0.3, mass);
    put(mesh(blob(0.3, pal, 0.06, 3, 23), flesh, 0, -0.4, 0.1, mass), 0, 0, 0, 1.1, 0.85, 1);
    pustules(mass, vein, 7, 0.42, 0, 0.05, 0, 0.025, 0.05, 21, 1.1, 0.85);
    for (let i = 0; i < 6; i++) put(mesh(arcTorus(0.47 - Math.abs(i - 2.5) * 0.02, 0.022, 0.1, 1.5, 14), bone, 0, 0.3 - i * 0.1, 0, mass), 0, 0, 0, 1.25, 1, 0.85);
    // organ-pipe chimneys sprouting from the hump: the bell tower it carries
    for (let i = 0; i < 7; i++) {
      const x = -0.27 + i * 0.09, h = 0.35 + hash3(i, 7, 7) * 0.45 + (3 - Math.abs(i - 3)) * 0.08;
      const pipe = new THREE.Group(); pipe.position.set(x, 0.5, -0.42); pipe.rotation.set(-0.5 - hash3(i, 2, 2) * 0.3, 0, -x * 0.9); mass.add(pipe);
      mesh(new THREE.CylinderGeometry(0.032, 0.04, h, 8), scrap, 0, h / 2, 0, pipe);
      mesh(new THREE.CylinderGeometry(0.05, 0.034, 0.06, 8, 1, true), scrap, 0, h + 0.02, 0, pipe);
      mesh(new THREE.CircleGeometry(0.03, 8), vein, 0, h + 0.015, 0, pipe).rotation.x = -Math.PI / 2;
    }
    mesh(tube([[-0.45, 0.25, 0.32], [-0.1, 0.05, 0.42], [0.25, -0.1, 0.4], [0.5, -0.25, 0.2]], 0.02, 14, 5), scrap, 0, 0, 0, mass);
    mesh(tube([[0.45, 0.3, 0.3], [0.1, 0.0, 0.43], [-0.3, -0.25, 0.38]], 0.018, 12, 5), scrap, 0, 0, 0, mass);
    // the BELL it wears as a head: mouth down, eyes glowing under the lip, a molten clapper-tongue
    const head = B(body, 0, 0.9, 0.38); head.rotation.x = -0.42; parts.head = head; parts.headBase = -0.42;
    const BELLP = [[0.37, -0.33], [0.35, -0.3], [0.3, -0.25], [0.262, -0.12], [0.238, 0.02], [0.226, 0.12], [0.19, 0.2], [0.12, 0.236], [0.001, 0.246]];
    const bellM = mesh(lathe(BELLP, LOW ? 14 : 24), bellMat, 0, 0, 0, head); bellM.material.side = THREE.DoubleSide;
    mesh(new THREE.TorusGeometry(0.36, 0.032, 6, LOW ? 14 : 24), bellMat, 0, -0.31, 0, head).rotation.x = Math.PI / 2;
    for (const y of [-0.02, 0.12]) mesh(new THREE.TorusGeometry(profR(BELLP, y) + 0.004, 0.012, 4, LOW ? 14 : 24), bellMat, 0, y, 0, head).rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), bellMat, 0, 0.29, 0, head);
    mesh(tube([[0.1, 0.18, 0.15], [0.14, 0.08, 0.2], [0.17, -0.02, 0.19], [0.22, -0.16, 0.2], [0.26, -0.26, 0.21]], 0.005, 10, 3), wound, 0, 0, 0, head); // glowing crack
    put(mesh(blob(0.2, pal, 0.08, 3, 24), flesh, 0, -0.2, 0.04, head), 0, 0, 0, 1.1, 0.8, 1.05);
    for (const x of [-0.13, -0.05, 0.05, 0.13]) mesh(new THREE.SphereGeometry(Math.abs(x) > 0.1 ? 0.02 : 0.03, 7, 5), vein, x, -0.24 + Math.abs(x) * 0.15, 0.22, head);
    mesh(rbox(0.16, 0.03, 0.05), vein, 0, -0.32, 0.2, head);
    const clapper = mesh(new THREE.SphereGeometry(0.085, 10, 8), vein, 0, -0.36, -0.04, head); clapper.userData.keep = true; parts.clapper = clapper;
    mesh(tube([[0, 0.3, -0.02], [0, 0.32, -0.25], [0, 0.0, -0.5], [0, -0.4, -0.6]], 0.02, 12, 5), rope, 0, 0, 0, head);
    for (const side of [-1, 1]) {
      const big = side < 0;
      const arm = B(body, side * 0.55, 0.62, 0.22);
      mesh(blob(big ? 0.19 : 0.15, pal, 0.08, 3, 25 + side), flesh, 0, 0.02, 0, arm);
      mesh(limbGeo(big ? 0.13 : 0.1, big ? 0.1 : 0.075, big ? 0.55 : 0.6, pal, 26 + side), flesh, 0, 0, 0, arm);
      const fore = B(arm, 0, big ? -0.55 : -0.6, 0);
      mesh(limbGeo(big ? 0.11 : 0.08, big ? 0.085 : 0.06, big ? 0.52 : 0.6, pal, 27 + side), flesh, 0, 0, 0, fore);
      const hy = big ? -0.56 : -0.64;
      mesh(blob(big ? 0.11 : 0.08, pal, 0.1, 3, 28 + side), flesh, 0, hy, 0.02, fore);
      if (big) { // a huge iron clapper on a haft: its bell-hammer
        const haft = new THREE.Group(); haft.position.set(0, hy, 0.05); haft.rotation.x = 1.2; fore.add(haft);
        mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), scrap, 0, -0.3, 0, haft);
        const ball = mesh(blob(0.2, [C(0x3a302a), C(0x14100e), C(0x5a3a22)], 0.12, 3, 29), scrap, 0, -0.85, 0, haft); void ball;
        for (let i = 0; i < 6; i++) { const a = i * 1.05; put(mesh(new THREE.ConeGeometry(0.035, 0.14, 5), scrap, Math.cos(a) * 0.19, -0.85 + Math.sin(a * 2) * 0.06, Math.sin(a) * 0.19, haft), Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); }
        pustules(haft, vein, 5, 0.19, 0, -0.85, 0, 0.02, 0.035, 29);
      } else { // a long chain of small bells trailing from the claws
        claws(fore, bone, 4, hy - 0.04, 0.2, 0.35, 0.025);
        mesh(tube([[0, hy - 0.05, 0.04], [0.03, hy - 0.3, 0.1], [0.02, hy - 0.55, 0.0], [-0.02, hy - 0.75, -0.06]], 0.01, 12, 4), scrap, 0, 0, 0, fore);
        for (let i = 0; i < 3; i++) mesh(lathe(BELLP.map(([r, y]) => [r * 0.22, y * 0.22]), 10), bellMat, 0.02, hy - 0.32 - i * 0.2, 0.06 - i * 0.05, fore);
      }
      parts.limbs.push({ g: arm, fore, side, arm: true });
      const thigh = B(body, side * 0.27, 0, 0);
      mesh(limbGeo(0.14, 0.11, 0.46, pal, 30 + side), flesh, 0, 0, 0, thigh);
      const shin = B(thigh, 0, -0.46, 0);
      mesh(limbGeo(0.11, 0.08, 0.46, pal, 31 + side), flesh, 0, 0, 0, shin);
      put(mesh(blob(0.1, pal, 0.1, 3, 32 + side), flesh, 0, -0.5, 0.07, shin), 0, 0, 0, 1, 0.5, 1.5);
      parts.limbs.push({ g: thigh, shin, side, arm: false });
    }
    parts.body = body; parts.bellMat = bellMat; parts.bell = head;
    root.scale.setScalar(2.3);
  } else if (type === 'skitter') {
    const body = B(root, 0, 0.45, 0);
    put(mesh(blob(0.34, pal, 0.07, 3, 41), flesh, 0, 0, -0.05, body), 0, 0, 0, 1, 0.58, 1.3);
    for (let i = 0; i < 3; i++) put(mesh(sphere(0.3, LS, 6, 0, Math.PI * 0.36), scrap, 0, 0.06, -0.26 + i * 0.17, body), -0.25 + i * 0.12, 0, 0, 0.95, 0.75, 0.55);
    put(mesh(lump(new THREE.SphereGeometry(0.17, 10, 8), 0.02, 9, 42, pal), vein, 0, 0.1, -0.45, body), 0, 0, 0, 1, 0.85, 1.2);
    const head = B(body, 0, 0.04, 0.4); parts.head = head;
    put(mesh(blob(0.15, pal, 0.08, 3, 43), flesh, 0, 0, 0, head), 0, 0, 0, 1, 0.78, 1.1);
    for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(i < 2 ? 0.026 : 0.014, 6, 4), vein, (i % 2 ? 1 : -1) * (0.03 + (i >> 1) * 0.03), 0.06 - (i >> 1) * 0.015, 0.13 - (i >> 1) * 0.02, head);
    parts.mand = [];
    for (const s of [-1, 1]) {
      const m = B(head, s * 0.055, -0.05, 0.1);
      put(mesh(new THREE.ConeGeometry(0.022, 0.16, 5), bone, 0, 0, 0.07, m), Math.PI / 2, 0, -s * 0.0).rotation.y = -s * 0.35;
      parts.mand.push({ g: m, side: s });
    }
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const leg = B(body, side * 0.22, 0, -0.18 + i * 0.2);
      put(mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.42, 6), scrap, side * 0.16, 0.14, 0, leg), 0, 0, -side * 0.95);
      mesh(new THREE.SphereGeometry(0.038, 7, 5), flesh, side * 0.32, 0.27, 0, leg);
      put(mesh(new THREE.CylinderGeometry(0.024, 0.006, 0.8, 6), scrap, side * 0.44, -0.1, 0, leg), 0, 0, side * 0.3);
      put(mesh(new THREE.ConeGeometry(0.018, 0.08, 4), bone, side * 0.36, 0.3, 0, leg), 0, 0, -side * 0.6);
      parts.limbs.push({ g: leg, side, i });
    }
    parts.body = body;
  } else if (type === 'spitter') {
    const body = B(root, 0, 0.85, 0);
    put(mesh(blob(0.6, pal, 0.08, 3, 51), flesh, 0, 0, 0, body), 0, 0, 0, 1, 0.9, 1);
    pustules(body, vein, LOW ? 8 : 12, 0.55, 0, 0, 0, 0.05, 0.13, 51, 0.9, 1);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26, x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
      mesh(tube([[x, -0.4, z], [x * 1.2, -0.62, z * 1.2], [x * 1.1 + 0.05, -0.78, z * 1.1], [x * 1.3, -0.84, z * 1.3 + 0.05]], 0.025 - i * 0.002, 10, 5), flesh, 0, 0, 0, body);
    }
    const neck = new THREE.Group(); neck.position.set(0, 0.42, 0.22); neck.rotation.x = -(Math.PI - 0.65); body.add(neck);
    mesh(limbGeo(0.17, 0.12, 0.4, pal, 52), flesh, 0, 0, 0, neck);
    const head = B(body, 0, 0.76, 0.48); parts.head = head;
    put(mesh(blob(0.17, pal, 0.08, 3, 53), flesh, 0, 0, 0, head), 0, 0, 0, 1, 0.9, 1.15);
    mesh(new THREE.TorusGeometry(0.08, 0.026, 6, 12), vein, 0, -0.02, 0.17, head);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; put(mesh(new THREE.ConeGeometry(0.012, 0.05, 4), bone, Math.cos(a) * 0.075, -0.02 + Math.sin(a) * 0.075, 0.175, head), 0, 0, a + Math.PI / 2); }
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.014, 6, 4), vein, -0.04 + i * 0.04, 0.13, 0.08, head);
    for (const side of [-1, 1]) for (const z of [-0.25, 0.25]) {
      const leg = B(body, side * 0.4, -0.35, z);
      mesh(limbGeo(0.08, 0.055, 0.42, pal, 54 + side + z), flesh, 0, 0, 0, leg);
      put(mesh(blob(0.07, pal, 0.1, 3, 55 + side + z), flesh, 0, -0.46, 0.03, leg), 0, 0, 0, 1, 0.5, 1.4);
      parts.limbs.push({ g: leg, side, arm: false });
    }
    parts.body = body;
  }
  bake(root, bones);
  root.userData = parts;
  return root;
}

// Ground loot: a glowing shard and a light pillar in rarity color.
export function buildLoot(color, isCore, rarity) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const shard = new THREE.Mesh(isCore ? new THREE.OctahedronGeometry(0.16) : new THREE.BoxGeometry(0.12, 0.5, 0.05),
    new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.5), toneMapped: false }));
  shard.position.y = 0.6; g.add(shard);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 2 + rarity * 1.2, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  beam.position.y = (2 + rarity * 1.2) / 2; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  g.userData = { shard };
  return g;
}
