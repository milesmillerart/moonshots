// Procedural low-poly models. Everything is built from primitives in code.
import * as THREE from '../vendor/three-warden.r187.min.js';
import { canvas } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true;
  if (parent) parent.add(m); return m;
}
const rbox = (w, h, d) => new THREE.BoxGeometry(w, h, d, 1, 1, 1);

// Fresnel rim so matte-black plate still reads as a silhouette edge in the rain.
function rimmed(mat, color = [0.13, 0.16, 0.23], power = 3.2) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(${color.join(',')}) * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), ${power.toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => 'rim' + color.join(',');
  return mat;
}
export const MAT = {
  plate: () => rimmed(new THREE.MeshStandardMaterial({ color: 0x0f1013, metalness: 0.85, roughness: 0.32 })),
  plateDull: () => rimmed(new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.5, roughness: 0.6 }), [0.08, 0.1, 0.14]),
  cloth: () => new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.95, side: THREE.DoubleSide }),
  visor: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.25, 0.3), toneMapped: false }),
};

function capeAlpha() {
  return canvas(64, 128, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#000';
    // tattered bottom edge + a couple of rips
    g.beginPath(); g.moveTo(0, 128);
    for (let x = 0; x <= 64; x += 4) g.lineTo(x, 100 + Math.random() * 26);
    g.lineTo(64, 128); g.fill();
    for (let i = 0; i < 4; i++) { const x = 8 + Math.random() * 48, y = 60 + Math.random() * 40; g.fillRect(x, y, 2, 10 + Math.random() * 14); }
  });
}

// ---- Synthblade ---------------------------------------------------------
export function buildSword() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 0.95, roughness: 0.22 });
  const dark = MAT.plate();
  mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 8), new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.8 }), 0, 0, 0, g);
  const gem = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.4), toneMapped: false });
  mesh(new THREE.SphereGeometry(0.05, 10, 8), dark, 0, -0.19, 0, g);
  const pommelGem = mesh(new THREE.SphereGeometry(0.025, 8, 6), gem, 0, -0.2, 0.035, g);
  mesh(rbox(0.36, 0.05, 0.07), dark, 0, 0.18, 0, g);
  mesh(rbox(0.08, 0.1, 0.09), dark, 0, 0.22, 0, g);
  // Blade along +Y, synth edge on +X.
  const L = 1.12;
  const blade = mesh(rbox(0.065, L, 0.016), steel, -0.005, 0.24 + L / 2, 0, g);
  const tip = mesh(new THREE.ConeGeometry(0.046, 0.16, 4), steel, -0.005, 0.24 + L + 0.08, 0, g);
  tip.scale.z = 0.35; tip.rotation.y = Math.PI / 4;
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 0.22, 0.55), toneMapped: false });
  const edge = mesh(rbox(0.014, L + 0.05, 0.02), edgeMat, 0.034, 0.24 + L / 2 + 0.02, 0, g);
  edge.castShadow = false;
  // glow sheath around the edge
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.04, 0.18), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glow = mesh(rbox(0.06, L + 0.1, 0.06), glowMat, 0.04, 0.24 + L / 2 + 0.02, 0, g); glow.castShadow = false;
  // Crackling lightning along the edge.
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
  const arcs = new THREE.LineSegments(arcGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(5, 1.2, 2.5), transparent: true, opacity: 0.9, toneMapped: false }));
  g.add(arcs);
  const light = new THREE.PointLight(0xff2050, 2.5, 4, 2); light.position.set(0.05, 0.45, 0); g.add(light);
  g.userData = { edgeMat, glowMat, arcs, light, gem, pommelGem, baseLocal: V(0.034, 0.3, 0), tipLocal: V(0.0, 0.24 + L + 0.14, 0) };
  g.userData.crackle = (intensity) => {
    const p = arcGeo.attributes.position.array;
    let n = 0;
    const segs = Math.floor(3 + intensity * 10);
    for (let s = 0; s < segs && n < 40; s++) {
      let y = 0.3 + Math.random() * L; let x = 0.04, z = 0;
      for (let k = 0; k < 3 && n < 38; k++) {
        p[n * 3] = x; p[n * 3 + 1] = y; p[n * 3 + 2] = z; n++;
        x = 0.04 + Math.random() * 0.09 * intensity; y += (Math.random() - 0.3) * 0.12; z = (Math.random() - 0.5) * 0.08;
        p[n * 3] = x; p[n * 3 + 1] = y; p[n * 3 + 2] = z; n++;
      }
    }
    for (let i = n; i < 40; i++) { p[i * 3] = p[i * 3 + 1] = p[i * 3 + 2] = 0; }
    arcGeo.attributes.position.needsUpdate = true;
    arcGeo.setDrawRange(0, n);
  };
  return g;
}

// ---- The Warden -----------------------------------------------------------
export function buildWarden({ statue = false } = {}) {
  const plate = statue ? new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.7, metalness: 0.2 }) : MAT.plate();
  const dull = statue ? plate : MAT.plateDull();
  const cloth = statue ? plate : MAT.cloth();
  const visorMat = statue ? new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.15, 0.2), toneMapped: false }) : MAT.visor();
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // for rolls / bob
  const hips = new THREE.Group(); hips.position.y = 1.02; body.add(hips);
  mesh(rbox(0.42, 0.22, 0.28), dull, 0, 0, 0, hips);
  // tassets (faulds)
  for (const x of [-0.14, 0.14]) { const t = mesh(rbox(0.2, 0.3, 0.05), plate, x, -0.18, 0.15, hips); t.rotation.x = -0.15; }
  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(side * 0.13, -0.08, 0); hips.add(thigh);
    mesh(rbox(0.17, 0.46, 0.2), dull, 0, -0.23, 0, thigh);
    mesh(rbox(0.19, 0.12, 0.22), plate, 0, -0.46, 0.02, thigh); // knee cop
    const shin = new THREE.Group(); shin.position.y = -0.47; thigh.add(shin);
    mesh(rbox(0.16, 0.44, 0.19), plate, 0, -0.22, 0, shin);
    mesh(rbox(0.17, 0.1, 0.3), plate, 0, -0.47, 0.05, shin); // sabaton
    legs.push({ thigh, shin });
  }
  const torso = new THREE.Group(); torso.position.y = 0.12; hips.add(torso);
  const chest = mesh(rbox(0.56, 0.52, 0.32), plate, 0, 0.36, 0, torso);
  const chestPlate = mesh(rbox(0.46, 0.36, 0.06), plate, 0, 0.42, 0.17, torso); chestPlate.rotation.x = -0.08;
  mesh(rbox(0.4, 0.18, 0.28), dull, 0, 0.05, 0, torso);
  // pauldrons
  for (const side of [-1, 1]) {
    const p = mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), plate, side * 0.36, 0.6, 0, torso);
    p.scale.set(1.1, 0.9, 1.15); p.rotation.z = -side * 0.35;
    const p2 = mesh(rbox(0.06, 0.2, 0.3), plate, side * 0.47, 0.5, 0, torso); p2.rotation.z = -side * 0.25;
  }
  mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 10), dull, 0, 0.66, 0, torso); // gorget
  // head
  const head = new THREE.Group(); head.position.y = 0.86; torso.add(head);
  const helm = mesh(new THREE.SphereGeometry(0.17, 16, 12), plate, 0, 0.02, 0, head); helm.scale.set(0.92, 1.22, 1.08);
  const jaw = mesh(rbox(0.22, 0.12, 0.2), plate, 0, -0.1, 0.04, head); jaw.rotation.x = 0.2;
  const visorH = mesh(rbox(0.21, 0.026, 0.02), visorMat, 0, 0.035, 0.172, head); visorH.castShadow = false;
  const visorV = mesh(rbox(0.026, 0.13, 0.02), visorMat, 0, -0.035, 0.172, head); visorV.castShadow = false;
  // cables from the back of the helm into the backplate
  for (const x of [-0.06, 0.06]) {
    const curve = new THREE.CatmullRomCurve3([V(x, 0.05, -0.14), V(x * 1.6, -0.08, -0.26), V(x * 2, -0.3, -0.24), V(x * 2.2, -0.42, -0.17)]);
    mesh(new THREE.TubeGeometry(curve, 10, 0.022, 6), dull, 0, 0, 0, head);
  }
  // arms (driven by 2-bone IK toward the grip)
  const arms = [];
  for (const side of [-1, 1]) {
    const upper = new THREE.Group(); torso.add(upper);
    mesh(rbox(0.13, 0.13, 0.32), dull, 0, 0, 0.16, upper);
    const fore = new THREE.Group(); torso.add(fore);
    mesh(rbox(0.13, 0.13, 0.3), plate, 0, 0, 0.15, fore);
    mesh(rbox(0.16, 0.15, 0.14), plate, 0, 0, 0.3, fore); // gauntlet
    arms.push({ side, upper, fore, shoulder: V(side * 0.33, 0.52, 0) });
  }
  // cape
  const capeGeo = new THREE.PlaneGeometry(0.86, 1.45, 6, 12);
  capeGeo.translate(0, -0.725, 0);
  const capeMat = cloth.clone ? cloth.clone() : cloth;
  if (!statue) { capeMat.alphaMap = new THREE.CanvasTexture(capeAlpha()); capeMat.alphaTest = 0.5; }
  const cape = new THREE.Mesh(capeGeo, capeMat); cape.position.set(0, 0.62, -0.2); cape.castShadow = true;
  torso.add(cape);
  const capeRest = Float32Array.from(capeGeo.attributes.position.array);
  // sword in a holder group so it can be posed in torso space
  const sword = buildSword(); torso.add(sword);
  if (statue) sword.traverse((o) => { if (o.isMesh && o.material !== sword.userData.edgeMat) o.material = plate; });
  root.userData = { body, hips, torso, head, legs, arms, cape, capeRest, sword, visorMat };
  root.traverse((o) => { if (o.isMesh) o.castShadow = !statue; });
  return root;
}

// Generic townsfolk for story scenes.
export function buildPerson({ coat = 0x2a2620, hood = true, kneel = false, lantern = false } = {}) {
  const g = new THREE.Group();
  const c = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a7468, roughness: 0.8 });
  const h = kneel ? 0.55 : 1;
  mesh(new THREE.CylinderGeometry(0.2, 0.34, 1.1 * h, 8), c, 0, 0.55 * h, 0, g);
  mesh(rbox(0.44, 0.5, 0.26), c, 0, 1.1 * h + 0.2, 0, g);
  mesh(new THREE.SphereGeometry(0.13, 10, 8), skin, 0, 1.1 * h + 0.6, 0.02, g);
  if (hood) { const hd = mesh(new THREE.SphereGeometry(0.17, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), c, 0, 1.1 * h + 0.63, -0.02, g); hd.scale.z = 1.15; }
  if (lantern) {
    const L = mesh(rbox(0.12, 0.18, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6), toneMapped: false }), 0.32, 0.8, 0.1, g);
    const pl = new THREE.PointLight(0xffa860, 5, 7, 2); pl.position.copy(L.position); g.add(pl);
  }
  return g;
}

// ---- Abominations ---------------------------------------------------------
function fleshMat(hex = 0x5b524c) { return rimmed(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.75, metalness: 0.05, emissive: 0x000000 }), [0.08, 0.3, 0.28], 3.0); }
function veinMat() { return new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.6, 2.3), toneMapped: false }); }
const scrapMat = () => new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.6, metalness: 0.6 });

export function buildEnemy(type) {
  const root = new THREE.Group();
  const flesh = fleshMat(type === 'spitter' ? 0x5d6050 : type === 'skitter' ? 0x3f3a3a : 0x5b524c);
  const vein = veinMat();
  const scrap = scrapMat();
  const parts = { flesh, vein, scrap, limbs: [] };
  if (type === 'husk' || type === 'bellwright') {
    const big = type === 'bellwright';
    const body = new THREE.Group(); body.position.y = 1.0; root.add(body);
    const torso = mesh(rbox(0.6, 0.75, 0.42), flesh, 0, 0.35, 0.1, body); torso.rotation.x = 0.55;
    mesh(rbox(0.5, 0.3, 0.12), scrap, 0.05, 0.5, 0.34, body).rotation.x = 0.5;
    const head = mesh(new THREE.SphereGeometry(0.2, 10, 8), flesh, 0, 0.75, 0.42, body); head.scale.set(1, 0.9, 1.2);
    for (const x of [-0.07, 0.07]) mesh(new THREE.SphereGeometry(0.035, 6, 5), vein, x, 0.78, 0.62, body);
    mesh(rbox(0.16, 0.04, 0.05), vein, 0, 0.66, 0.6, body); // glowing maw
    // spine of pipes
    for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), scrap, -0.15 + i * 0.15, 0.72, -0.12, body).rotation.x = 0.4;
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * 0.38, 0.6, 0.25); body.add(arm);
      mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.95, 6), flesh, 0, -0.45, 0, arm);
      const claw = mesh(new THREE.ConeGeometry(0.09, 0.3, 5), scrap, 0, -1.0, 0.03, arm); claw.rotation.x = Math.PI;
      parts.limbs.push({ g: arm, side, arm: true });
      const leg = new THREE.Group(); leg.position.set(side * 0.17, 0, 0); body.add(leg);
      mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.95, 6), flesh, 0, -0.5, 0, leg);
      parts.limbs.push({ g: leg, side, arm: false });
    }
    parts.body = body; parts.head = head;
    if (big) {
      // A cathedral bell fused into its chest and an iron halo of pipes.
      const bellMat = new THREE.MeshStandardMaterial({ color: 0x5a4224, metalness: 0.9, roughness: 0.35, emissive: 0x000000 });
      const bell = mesh(new THREE.CylinderGeometry(0.22, 0.48, 0.65, 14, 1, true), bellMat, 0, 0.3, 0.45, body);
      bell.material.side = THREE.DoubleSide; bell.rotation.x = 0.3;
      const clapper = mesh(new THREE.SphereGeometry(0.1, 8, 6), vein, 0, 0.05, 0.5, body);
      for (let i = 0; i < 7; i++) {
        const a = -1.2 + (i / 6) * 2.4;
        const p = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 5), scrap, Math.sin(a) * 0.45, 0.9 + Math.cos(a) * 0.3, -0.15, body);
        p.rotation.z = -a;
      }
      for (const x of [-0.32, 0.32]) { const h2 = mesh(new THREE.SphereGeometry(0.14, 8, 6), flesh, x, 0.7, 0.3, body); mesh(new THREE.SphereGeometry(0.03, 5, 4), vein, x, 0.72, 0.43, body); void h2; }
      parts.bell = bell; parts.bellMat = bellMat; parts.clapper = clapper;
      root.scale.setScalar(2.3);
    }
  } else if (type === 'skitter') {
    const body = new THREE.Group(); body.position.y = 0.45; root.add(body);
    const b = mesh(new THREE.SphereGeometry(0.34, 10, 8), flesh, 0, 0, 0, body); b.scale.set(1, 0.55, 1.35);
    const sac = mesh(new THREE.SphereGeometry(0.18, 8, 6), vein, 0, 0.12, -0.32, body); sac.scale.set(1, 0.8, 1.2);
    const head = mesh(new THREE.SphereGeometry(0.15, 8, 6), flesh, 0, 0.05, 0.42, body);
    for (const x of [-0.05, 0.05]) mesh(new THREE.SphereGeometry(0.03, 5, 4), vein, x, 0.1, 0.55, body);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const leg = new THREE.Group(); leg.position.set(side * 0.25, 0, -0.2 + i * 0.22); body.add(leg);
      const up = mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.5, 5), scrap, side * 0.2, 0.12, 0, leg); up.rotation.z = -side * 1.0;
      const dn = mesh(new THREE.CylinderGeometry(0.025, 0.01, 0.55, 5), scrap, side * 0.42, -0.15, 0, leg); dn.rotation.z = side * 0.35;
      parts.limbs.push({ g: leg, side, i });
    }
    parts.body = body; parts.head = head;
  } else if (type === 'spitter') {
    const body = new THREE.Group(); body.position.y = 0.85; root.add(body);
    const b = mesh(new THREE.SphereGeometry(0.6, 12, 10), flesh, 0, 0, 0, body); b.scale.set(1, 0.9, 1);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, y = -0.2 + (i % 3) * 0.25;
      mesh(new THREE.SphereGeometry(0.1 + (i % 2) * 0.05, 7, 5), vein, Math.sin(a) * 0.52, y, Math.cos(a) * 0.52, body);
    }
    const neck = mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.4, 7), flesh, 0, 0.55, 0.25, body); neck.rotation.x = 0.6;
    const head = mesh(new THREE.SphereGeometry(0.17, 8, 6), flesh, 0, 0.75, 0.42, body);
    mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10), vein, 0, 0.72, 0.58, body);
    for (const side of [-1, 1]) for (const z of [-0.25, 0.25]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.4, -0.35, z); body.add(leg);
      mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.6, 6), flesh, 0, -0.2, 0, leg);
      parts.limbs.push({ g: leg, side, arm: false });
    }
    parts.body = body; parts.head = head;
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
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
