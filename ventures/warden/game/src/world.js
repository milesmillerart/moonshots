// Hallowmere, Ninth Ward: procedural cyber-medieval district.
import * as THREE from '../vendor/three-warden.r187.min.js';
import { canvas, mulberry32 } from './util.js';

const R = mulberry32(9);
const rr = (a, b) => a + R() * (b - a);

// ---- layout -------------------------------------------------------------
export const WALK = [
  { x0: -7, x1: 7, z0: -60, z1: 66 },      // Lantern Street
  { x0: -22, x1: 22, z0: -13, z1: 13 },    // Statute Plaza
  { x0: -18, x1: 18, z0: -88, z1: -57 },   // Grave Gate court
  { x0: -35, x1: -21, z0: -3, z1: 3 },     // Cutpurse Alley
];
export const POI = {
  start: new THREE.Vector3(0, 0, 58),
  judgment: new THREE.Vector3(0, 0, 47),
  forge: new THREE.Vector3(16.5, 0, -8.5),
  statue: new THREE.Vector3(0, 0, 0),
  gate: new THREE.Vector3(0, 0, -86),
  bossArena: new THREE.Vector3(0, 0, -72),
  cache: new THREE.Vector3(-33, 0, 0),
  respawn: new THREE.Vector3(12, 0, -4),
};
export const colliders = []; // {x,z,r}

export function walkable(x, z, pad = 0.4) {
  for (const r of WALK) if (x > r.x0 + pad && x < r.x1 - pad && z > r.z0 + pad && z < r.z1 - pad) return true;
  return false;
}
// Move a circle at (p) by (dx,dz) respecting walkable rects and props.
export function moveCircle(p, dx, dz, rad = 0.45) {
  if (walkable(p.x + dx, p.z + dz, rad)) { p.x += dx; p.z += dz; }
  else if (walkable(p.x + dx, p.z, rad)) p.x += dx;
  else if (walkable(p.x, p.z + dz, rad)) p.z += dz;
  for (const c of colliders) {
    const ox = p.x - c.x, oz = p.z - c.z, d = Math.hypot(ox, oz), m = c.r + rad;
    if (d < m && d > 1e-4) { p.x = c.x + (ox / d) * m; p.z = c.z + (oz / d) * m; }
  }
}

// ---- textures -----------------------------------------------------------
function tex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cobbleCanvases() {
  const S = 512, stones = [];
  const r = mulberry32(3);
  for (let y = 0; y < S; y += 32) {
    const off = (y / 32) % 2 ? 24 : 0;
    for (let x = -off; x < S; x += 48) stones.push([x + r() * 4, y + r() * 3, 44 + r() * 4, 28 + r() * 3, r()]);
  }
  const color = canvas(S, S, (g) => {
    g.fillStyle = '#0c0d10'; g.fillRect(0, 0, S, S);
    for (const [x, y, w, h, v] of stones) {
      const l = 22 + v * 16;
      g.fillStyle = `rgb(${l},${l + 1},${l + 4})`;
      g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 7); g.fill();
    }
    for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.25})`; g.fillRect(r() * S, r() * S, 2, 2); }
  });
  const bump = canvas(S, S, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    for (const [x, y, w, h, v] of stones) {
      const grd = g.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, w * 0.6);
      grd.addColorStop(0, `rgb(${200 + v * 50},${200 + v * 50},${200 + v * 50})`); grd.addColorStop(1, '#555');
      g.fillStyle = grd; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 8); g.fill();
    }
  });
  // Roughness: gaps rough, stones semi-wet, puddles mirror-smooth.
  const rough = canvas(S, S, (g) => {
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, S, S);
    for (const [x, y, w, h, v] of stones) { const l = 90 + v * 60; g.fillStyle = `rgb(${l},${l},${l})`; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 7); g.fill(); }
    g.filter = 'blur(10px)';
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgb(14,14,14)'; g.beginPath(); g.ellipse(r() * S, r() * S, 30 + r() * 70, 18 + r() * 40, r() * 3, 0, 7); g.fill(); }
    g.filter = 'none';
  });
  return { color, bump, rough };
}

function facadeCanvas(seed) {
  const r = mulberry32(seed);
  return canvas(256, 256, (g) => {
    g.fillStyle = '#16171b'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 32) {
      const l = 18 + r() * 10; g.fillStyle = `rgb(${l},${l},${l + 3})`; g.fillRect(x + ((y / 16) % 2) * 16, y, 31, 15);
    }
    for (let i = 0; i < 40; i++) { // rain streaks / grime
      g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.3})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 30 + r() * 120);
    }
  });
}
function windowCanvas(seed, cols = ['#3ff0e0', '#ffb070', '#ffcf9a', '#ff3060']) {
  const r = mulberry32(seed);
  return canvas(256, 256, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    for (let y = 8; y < 256; y += 32) {
      const active = r() < 0.3, rowCol = r() < 0.7 ? cols[1 + Math.floor(r() * 2)] : cols[r() < 0.8 ? 0 : 3];
      for (let x = 8; x < 256; x += 32) {
        if (active && r() < 0.45) { g.globalAlpha = 0.3 + r() * 0.35; g.fillStyle = rowCol; g.fillRect(x, y, 6, 12); g.globalAlpha = 1; }
        else if (r() < 0.015) { g.globalAlpha = 0.6; g.fillStyle = cols[0]; g.fillRect(x, y, 6, 12); g.globalAlpha = 1; }
        else { g.fillStyle = '#050608'; g.fillRect(x, y, 6, 12); }
      }
    }
  });
}
export function softCanvas(size = 128, inner = 'rgba(255,255,255,1)') {
  return canvas(size, size, (g) => {
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, inner); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
  });
}
function cloudCanvas() {
  const r = mulberry32(77);
  return canvas(256, 256, (g) => {
    for (let i = 0; i < 40; i++) {
      const x = 60 + r() * 136, y = 80 + r() * 96, rad = 30 + r() * 50;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.18)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    }
  });
}
export function signCanvas(text, color, vertical = false) {
  const w = vertical ? 128 : 64 + text.length * 46, h = vertical ? 64 + text.length * 70 : 128;
  return canvas(w, h, (g) => {
    g.font = `700 ${vertical ? 64 : 72}px "Arial Narrow", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const draw = (blur, style, lw) => {
      g.shadowColor = color; g.shadowBlur = blur; g.strokeStyle = style; g.lineWidth = lw; g.fillStyle = style;
      if (vertical) [...text].forEach((ch, i) => { g.strokeText(ch, w / 2, 70 + i * 70); })
      else g.strokeText(text, w / 2, h / 2);
    };
    draw(28, color, 7); draw(6, '#ffffff', 2.5);
    g.strokeStyle = color; g.lineWidth = 3; g.shadowBlur = 12; g.strokeRect(6, 6, w - 12, h - 12);
  });
}

// Height fog: regular exponential fog plus a low ground mist (like the poster's street fog).
export function installHeightFog() {
  const C = THREE.ShaderChunk;
  if (C.fog_fragment.includes('vFogWorld')) return;
  C.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogWorld;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogWorld = (inverse(viewMatrix) * mvPosition).xyz;\n#endif';
  C.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorld;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar;\n #endif\n#endif';
  C.fog_fragment = `#ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    float mist = (1.0 - exp(-vFogDepth * 0.075)) * exp(-max(vFogWorld.y, 0.0) * 0.55);
    gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3(0.105, 0.118, 0.145), clamp(mist * 0.78, 0.0, 1.0) );
  #endif`;
}

// ---- build --------------------------------------------------------------
export function buildWorld(scene, renderer, opts = {}) {
  installHeightFog();
  const W = { lights: [], flicker: [], smoke: [], fogCards: [], signs: [], update: null };
  colliders.length = 0;
  scene.background = new THREE.Color(0x07090d);
  scene.fog = new THREE.FogExp2(0x0a0d12, 0.017);

  // Environment for wet reflections: a dark dome with neon panels.
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x05060a);
  const panel = (c, x, y, z, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(0x1fd8c8, 8, 3, 2, 3, 6); panel(0xff1f5a, -8, 4, -3, 2, 5); panel(0xffa050, 2, 2, -9, 5, 2);
  panel(0x303a50, 0, 10, 0, 20, 20); panel(0x0c4b52, -5, 2, 8, 6, 2); panel(0x9a1030, 6, 1.5, -6, 3, 2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  scene.environmentIntensity = 0.55;

  // Lights
  scene.add(new THREE.HemisphereLight(0x2a3a55, 0x090909, 0.55));
  const moon = new THREE.DirectionalLight(0x8fa6d8, 0.55);
  moon.position.set(-20, 40, 15);
  moon.castShadow = !!opts.shadows;
  moon.shadow.mapSize.set(opts.mobile ? 512 : 1024, opts.mobile ? 512 : 1024);
  const sc = moon.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 90;
  moon.shadow.bias = -0.0008;
  scene.add(moon, moon.target);
  W.moon = moon;

  // Ground
  const cb = cobbleCanvases();
  const rep = 70;
  const groundMat = new THREE.MeshStandardMaterial({
    map: tex(cb.color, rep, rep), bumpMap: tex(cb.bump, rep, rep, false), bumpScale: 1.6,
    roughnessMap: tex(cb.rough, rep, rep, false), roughness: 1, metalness: 0.15, color: 0xb8c0cc,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  // Building materials (shared textures, cloned per repeat).
  const facades = [1, 2, 3].map((s) => tex(facadeCanvas(s)));
  const windows = [11, 12, 13].map((s) => tex(windowCanvas(s), 1, 1, true));
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.7, roughness: 0.45 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x2a1d18, metalness: 0.5, roughness: 0.7 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.85 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  const cone4 = new THREE.ConeGeometry(1, 1, 4);

  const addMesh = (geo, mat, x, y, z, sx, sy, sz, ry = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry;
    scene.add(m); return m;
  };

  function building(cx, cz, w, d, h, style, facing) {
    const fi = Math.floor(R() * 3);
    const f = facades[fi].clone(); f.repeat.set(Math.max(1, w / 6), Math.max(1, h / 6)); f.needsUpdate = true;
    const e = windows[fi].clone(); e.repeat.set(Math.max(1, w / 4), Math.max(1, h / 4)); e.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: f, emissiveMap: e, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.8, metalness: 0.1 });
    const b = addMesh(box, mat, cx, h / 2, cz, w, h, d);
    b.receiveShadow = true;
    // Ground-floor plinth / arcade
    addMesh(box, stone, cx, 1.2, cz, w + 0.3, 2.4, d + 0.3);
    const fx = facing[0], fz = facing[1]; // direction toward the street
    if (style === 'gothic') {
      const s = Math.min(w, d);
      const sp = addMesh(cone4, stone, cx, h + s * 0.9, cz, s * 0.62, s * 1.8, s * 0.62, Math.PI / 4);
      sp.castShadow = false;
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        addMesh(box, stone, cx + ox * w * 0.46, h + 1.5, cz + oz * d * 0.46, 0.7, 3, 0.7);
        addMesh(cone4, stone, cx + ox * w * 0.46, h + 4.2, cz + oz * d * 0.46, 0.5, 2.4, 0.5, Math.PI / 4);
      }
      // buttresses on the street face
      for (let i = -1; i <= 1; i += 2) {
        const bx = cx + fx * (Math.abs(fx) ? -(w / 2) : 0) * -1, bz = cz + fz * (Math.abs(fz) ? (d / 2) : 0);
        const along = Math.abs(fx) ? [0, i * d * 0.3] : [i * w * 0.3, 0];
        addMesh(box, stone, (Math.abs(fx) ? cx + fx * (w / 2 + 0.4) : cx + along[0]), h * 0.35, (Math.abs(fz) ? cz + fz * (d / 2 + 0.4) : cz + along[1]), Math.abs(fx) ? 0.8 : 1, h * 0.7, Math.abs(fz) ? 0.8 : 1);
        void bx; void bz;
      }
    } else if (style === 'industrial') {
      const sx = cx + rr(-w / 4, w / 4), sz = cz + rr(-d / 4, d / 4), sh = rr(10, 22);
      addMesh(cyl, rust, sx, h + sh / 2, sz, 0.9, sh, 0.9);
      addMesh(cyl, darkMetal, sx, h + sh, sz, 1.05, 0.5, 1.05);
      W.smoke.push(new THREE.Vector3(sx, h + sh + 0.5, sz));
      // horizontal pipes along the street face
      for (let k = 0; k < 2; k++) {
        const py = rr(3, Math.min(12, h - 2));
        const p = addMesh(cyl, k ? rust : darkMetal, cx + fx * (w / 2 + 0.35), py, cz + fz * (d / 2 + 0.35), 0.22, Math.abs(fx) ? d * 0.95 : w * 0.95, 0.22);
        if (Math.abs(fx)) p.rotation.x = Math.PI / 2; else p.rotation.z = Math.PI / 2;
      }
    } else {
      // brutalist setbacks
      addMesh(box, mat, cx, h + 3, cz, w * 0.7, 6, d * 0.7);
      addMesh(box, darkMetal, cx, h + 6.5, cz, 0.15, 5, 0.15); // antenna
    }
    return b;
  }

  function fillEdge(ax, az, bx, bz, nx, nz, hMin = 16, hMax = 40) {
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    let s = 0;
    while (s < len - 1) {
      const wlen = Math.min(len - s, rr(7, 13));
      const depth = rr(8, 14);
      const mx = ax + ux * (s + wlen / 2) + nx * (depth / 2), mz = az + uz * (s + wlen / 2) + nz * (depth / 2);
      const w = Math.abs(ux) > 0.5 ? wlen : depth, d = Math.abs(ux) > 0.5 ? depth : wlen;
      const st = R();
      building(mx, mz, w - 0.2, d - 0.2, rr(hMin, hMax), st < 0.38 ? 'gothic' : st < 0.7 ? 'industrial' : 'brutal', [-nx, -nz]);
      s += wlen;
    }
  }
  fillEdge(-7, 13, -7, 70, -1, 0); fillEdge(7, 13, 7, 70, 1, 0);
  fillEdge(-7, -57, -7, -13, -1, 0); fillEdge(7, -57, 7, -13, 1, 0);
  fillEdge(-22, -13, -22, -3, -1, 0, 18, 34); fillEdge(-22, 3, -22, 13, -1, 0, 18, 34);
  fillEdge(22, -13, 22, 13, 1, 0, 20, 44);
  fillEdge(-22, -13, -7, -13, 0, -1); fillEdge(7, -13, 22, -13, 0, -1);
  fillEdge(-22, 13, -7, 13, 0, 1); fillEdge(7, 13, 22, 13, 0, 1);
  fillEdge(-36, -3, -22, -3, 0, -1, 10, 20); fillEdge(-36, 3, -22, 3, 0, 1, 10, 20);
  fillEdge(-36, -3, -36, 3, -1, 0, 10, 18);
  fillEdge(-18, -88, -18, -57, -1, 0, 22, 40); fillEdge(18, -88, 18, -57, 1, 0, 22, 40);
  fillEdge(-18, -57, -7, -57, 0, 1, 18, 30); fillEdge(7, -57, 18, -57, 0, 1, 18, 30);
  // South end: the Ward tower behind the start.
  building(0, 72, 16, 10, 48, 'gothic', [0, -1]);

  // Distant skyline silhouettes (unfogged, layered greys like the poster).
  const skyMat = (l) => new THREE.MeshBasicMaterial({ color: new THREE.Color(l, l * 1.05, l * 1.18), fog: false });
  for (let ring = 0; ring < 2; ring++) {
    const mat = skyMat(ring ? 0.035 : 0.055);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + R() * 0.1, rad = ring ? 230 : 160;
      const x = Math.sin(a) * rad, z = Math.cos(a) * rad, h = rr(30, ring ? 110 : 80), w = rr(10, 24);
      addMesh(box, mat, x, h / 2, z, w, h, w, a);
      if (R() < 0.5) addMesh(cone4, mat, x, h + w * 0.9, z, w * 0.45, w * 1.8, w * 0.45, Math.PI / 4);
      if (R() < 0.3) addMesh(cyl, mat, x + w * 0.3, h + 12, z, 1.4, 24, 1.4);
    }
  }
  // The Tribunal: a colossal spire far north with a red beacon.
  const tri = skyMat(0.05);
  addMesh(box, tri, 0, 60, -200, 30, 120, 30);
  addMesh(cone4, tri, 0, 150, -200, 20, 60, 20, Math.PI / 4);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.5), fog: false }));
  beacon.position.set(0, 181, -200); scene.add(beacon); W.beacon = beacon;
  // Sky haze
  const haze = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    map: new THREE.CanvasTexture(canvas(4, 256, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#040507'); grd.addColorStop(0.42, '#0b0f16'); grd.addColorStop(0.5, '#1a2230'); grd.addColorStop(0.53, '#0c0e13'); grd.addColorStop(1, '#050608');
      g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    })),
  }));
  haze.material.map.colorSpace = THREE.SRGBColorSpace;
  scene.add(haze); W.haze = haze;

  // Neon signs
  const signs = [
    ['WARD IX', '#3ff0e0', -6.9, 7, 52, 1, false], ['GAOL', '#ff2f6d', 6.9, 6, 40, -1, true],
    ['SCRAP', '#ffb35a', -6.9, 5, 28, 1, true], ['THE LAW ENDURES', '#3ff0e0', 6.9, 9, 22, -1, false],
    ['CELLS', '#ff2f6d', -6.9, 6.5, -24, 1, true], ['OSSUARY', '#3ff0e0', 6.9, 7, -32, -1, true],
    ['CURFEW', '#ff2f6d', -6.9, 9, -46, 1, false], ['TOLL', '#3ff0e0', 6.9, 5.5, -50, -1, true],
    ['NO PASSAGE', '#ff2f6d', -17.9, 8, -70, 1, false], ['ROT', '#3ff0e0', 17.9, 9, -80, -1, true],
    ['FORGE', '#ffb35a', 21.9, 6, -8.5, -1, false], ['TRIBUNAL', '#3ff0e0', -21.9, 9, 8, 1, false],
  ];
  const signLights = new Set([0, 3, 6, 10]);
  signs.forEach(([text, col, x, y, z, side, vert], i) => {
    const c = signCanvas(text, col, vert);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sc = 0.012;
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.width * sc, c.height * sc), mat);
    m.position.set(x + side * 0.12, y, z); m.rotation.y = side * Math.PI / 2;
    scene.add(m);
    const back = addMesh(box, darkMetal, x, y, z, 0.15, c.height * sc + 0.2, c.width * sc + 0.2); back.rotation.y = 0;
    if (side === 0) back.rotation.y = 0;
    if (Math.random() < 0.35) W.flicker.push({ mat, base: 1.5, t: Math.random() * 10 });
    if (signLights.has(i) && !opts.lowLights) {
      const L = new THREE.PointLight(new THREE.Color(col), 18, 16, 1.8);
      L.position.set(x + side * 1.5, y - 1, z); scene.add(L); W.lights.push(L);
    }
    W.signs.push(m);
  });

  // Lamp posts down Lantern Street.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1, 0.55, 0.25), emissiveIntensity: 3 });
  let li = 0;
  for (let z = 62; z > -58; z -= 15) {
    const side = li % 2 ? 1 : -1, x = side * 5.6;
    addMesh(cyl, darkMetal, x, 2.5, z, 0.09, 5, 0.09);
    addMesh(box, darkMetal, x - side * 0.5, 5, z, 1.1, 0.08, 0.08);
    addMesh(box, lampMat, x - side * 1.0, 4.85, z, 0.25, 0.3, 0.25);
    colliders.push({ x, z, r: 0.25 });
    if (li % 3 === 0 && !opts.lowLights) {
      const L = new THREE.PointLight(0xff9a50, 14, 14, 1.8); L.position.set(x - side * 1.0, 4.4, z); scene.add(L); W.lights.push(L);
    }
    li++;
  }

  // Checkpoint barricade (judgment scene)
  for (const x of [-5.2, 5.2]) {
    addMesh(box, rust, x, 0.6, 44, 3, 1.2, 0.6);
    addMesh(box, lampMat, x, 1.25, 44, 0.2, 0.1, 0.2);
    colliders.push({ x: x - 0.8, z: 44, r: 0.7 }, { x: x + 0.8, z: 44, r: 0.7 });
  }
  const shrine = addMesh(box, stone, -3.2, 1.0, 42, 0.8, 2, 0.8);
  const candle = new THREE.PointLight(0xffa860, 6, 8, 2); candle.position.set(-3.2, 2.3, 42); scene.add(candle); W.lights.push(candle);
  W.flicker.push({ light: candle, base: 6, t: 0 });
  void shrine;

  // Statute Plaza: plinth (statue added by game), fountain ring.
  addMesh(cyl, stone, 0, 0.6, 0, 3.2, 1.2, 3.2);
  addMesh(cyl, stone, 0, 1.6, 0, 1.6, 0.8, 1.6);
  colliders.push({ x: 0, z: 0, r: 3.3 });

  // Forge
  const fp = POI.forge;
  addMesh(box, stone, fp.x + 3, 1.8, fp.z, 2.6, 3.6, 3.2);
  const mouth = addMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0.25), toneMapped: false }), fp.x + 1.68, 1.3, fp.z, 0.05, 1.1, 1.4);
  void mouth;
  addMesh(cyl, rust, fp.x + 3, 6, fp.z, 0.5, 5, 0.5);
  W.smoke.push(new THREE.Vector3(fp.x + 3, 8.6, fp.z));
  const anvil = addMesh(box, darkMetal, fp.x, 0.55, fp.z, 1.2, 0.7, 0.55);
  addMesh(box, darkMetal, fp.x, 0.95, fp.z, 1.5, 0.15, 0.6);
  void anvil;
  colliders.push({ x: fp.x + 3, z: fp.z, r: 1.9 }, { x: fp.x, z: fp.z, r: 0.8 });
  const forgeLight = new THREE.PointLight(0xff7a2a, 20, 12, 1.6); forgeLight.position.set(fp.x + 0.8, 1.6, fp.z); scene.add(forgeLight);
  W.lights.push(forgeLight); W.flicker.push({ light: forgeLight, base: 20, t: 0, fire: true });

  // Grave Gate: towers + broken arch, Rot glow beyond.
  for (const x of [-11, 11]) {
    addMesh(box, stone, x, 14, -89, 7, 28, 6);
    addMesh(cone4, stone, x, 32, -89, 5, 8, 5, Math.PI / 4);
  }
  addMesh(box, stone, 0, 20, -89, 16, 6, 5);
  for (let i = -3; i <= 3; i++) addMesh(box, rust, i * 1.6, 11 - Math.abs(i) * 0.6, -88.5, 0.18, 10 - Math.abs(i) * 1.2, 0.18);
  const rot = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(softCanvas(128, 'rgba(255,255,255,0.9)')), color: new THREE.Color(0.1, 0.9, 0.8), transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  rot.position.set(0, 6, -91.5); scene.add(rot); W.rot = rot;
  const gateLight = new THREE.PointLight(0x30ffe0, 40, 30, 1.6); gateLight.position.set(0, 4, -84); scene.add(gateLight); W.lights.push(gateLight);
  W.flicker.push({ light: gateLight, base: 40, t: 0 });
  // Pylons on the walls of the court.
  for (const z of [-62, -72, -82]) for (const x of [-16.8, 16.8]) {
    addMesh(cyl, darkMetal, x, 5, z, 0.25, 10, 0.25);
    addMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.5, 2.2), toneMapped: false }), x, 10.2, z, 0.35, 0.35, 0.35);
  }

  // Alley cache crate area
  addMesh(box, rust, -34.4, 0.5, -1.8, 1.2, 1, 1); addMesh(box, rust, -34.6, 0.4, 1.9, 0.9, 0.8, 0.9);

  // Crates and debris along the street
  for (let i = 0; i < 18; i++) {
    const side = R() < 0.5 ? -1 : 1, z = rr(-56, 64), x = side * rr(5.6, 6.6);
    if (Math.abs(z - 44) < 3) continue;
    const s = rr(0.6, 1.2);
    addMesh(box, R() < 0.5 ? rust : darkMetal, x, s / 2, z, s, s, s, rr(0, 1));
  }

  // ---- rain (GPU-animated line drops) --------------------------------
  const N = opts.lowRain ? 2200 : 6000, AREA = 44, HGT = 26;
  const pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 3), endA = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const sx = Math.random() * AREA, sy = Math.random() * HGT, sz = Math.random() * AREA;
    for (let k = 0; k < 2; k++) { seed.set([sx, sy, sz], (i * 2 + k) * 3); endA[i * 2 + k] = k; }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  rg.setAttribute('aEnd', new THREE.BufferAttribute(endA, 1));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uArea: { value: AREA }, uH: { value: HGT } },
    vertexShader: `attribute vec3 aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCenter; uniform float uArea; uniform float uH; varying float vA;
      void main(){ vec3 p; p.y = mod(aSeed.y - uTime*17.0, uH);
        p.x = uCenter.x + mod(aSeed.x - uCenter.x + uTime*1.2, uArea) - uArea*0.5;
        p.z = uCenter.z + mod(aSeed.z - uCenter.z, uArea) - uArea*0.5;
        p += vec3(0.07, 0.75, 0.0) * aEnd;
        vec4 mv = modelViewMatrix * vec4(p,1.0); vA = (0.35 + 0.65*aEnd) * clamp(1.0 - (-mv.z)/38.0, 0.0, 1.0) * smoothstep(0.0, 1.5, p.y);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.55,0.62,0.72, 0.27*vA); }`,
  });
  const rain = new THREE.LineSegments(rg, rainMat); rain.frustumCulled = false; scene.add(rain);

  // Ground fog cards
  const fogTex = new THREE.CanvasTexture(cloudCanvas());
  for (let i = 0; i < 18; i++) {
    const zone = WALK[i % 3];
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, color: 0x56627a, transparent: true, opacity: rr(0.08, 0.16), depthWrite: false }));
    s.position.set(rr(zone.x0, zone.x1), rr(4, 9), rr(zone.z0, zone.z1));
    const k = rr(9, 18); s.scale.set(k, k * 0.45, 1);
    scene.add(s); W.fogCards.push({ s, vx: rr(-0.3, 0.3), base: s.position.clone() });
  }
  // Smoke columns
  const smokeTex = new THREE.CanvasTexture(softCanvas(64, 'rgba(255,255,255,0.5)'));
  const smokeSprites = [];
  for (const p of W.smoke) for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x30343c, transparent: true, opacity: 0.4, depthWrite: false }));
    s.userData = { base: p, ph: i / 6 }; scene.add(s); smokeSprites.push(s);
  }

  W.update = (dt, t, cam, focus) => {
    rainMat.uniforms.uTime.value = t; rainMat.uniforms.uCenter.value.copy(cam.position);
    for (const f of W.flicker) {
      f.t -= dt;
      if (f.light) {
        f.light.intensity = f.base * (f.fire ? 0.8 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3) + 0.1 * Math.random() : 0.85 + 0.15 * Math.sin(t * 2.1));
      } else if (f.t < 0) {
        f.mat.color.setScalar(Math.random() < 0.3 ? 0.4 : f.base);
        f.t = Math.random() < 0.2 ? 0.05 : rand(0.6, 5);
      }
    }
    for (const c of W.fogCards) { c.s.position.x = c.base.x + Math.sin(t * 0.05 + c.base.z) * 3; }
    for (const s of smokeSprites) {
      const k = (t * 0.08 + s.userData.ph) % 1;
      s.position.set(s.userData.base.x + k * 4, s.userData.base.y + k * 14, s.userData.base.z + k * 1.5);
      const sz = 2 + k * 9; s.scale.set(sz, sz, 1); s.material.opacity = 0.45 * (1 - k);
    }
    if (W.rot) W.rot.material.opacity = 0.28 + 0.08 * Math.sin(t * 1.7);
    if (focus) {
      moon.position.set(focus.x - 20, 40, focus.z + 15); moon.target.position.copy(focus);
    }
  };
  return W;
}
function rand(a, b) { return a + Math.random() * (b - a); }
