// Boot: renderer, post-processing, resize, main loop, test hooks.
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { Game } from './game.js';
import * as Items from './items.js';
import * as SaveSys from './save.js';
import { detectTouch } from './touch.js';
import { POI } from './world.js';

import { Q, pickTier } from './quality.js';
import { Assets } from './assets.js';
import { makeGradePass } from './post.js';
import { preloadPBR } from './pbr.js';

const BUILD = document.documentElement.dataset.build || 'dev';
const savedSettings = (() => { try { return JSON.parse(localStorage.getItem('warden.settings.v1') || '{}'); } catch { return {}; } })();
const qParam = new URLSearchParams(location.search).get('quality');
pickTier(qParam ? { quality: qParam } : savedSettings, detectTouch());
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('cv'), antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('boot').innerHTML = '<p>Warden needs WebGL. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration on.</p>';
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFShadowMap; // r187: PCF with shadow.radius gives the soft look
renderer.info.autoReset = false; // count the whole post chain per frame (perf table)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 700);
// Boot-time loads: CC0 HDRI for image-based light (tier-sized) + any GLB assets in the manifest.
const bootMsg = document.querySelector('#boot .bs');
if (bootMsg) bootMsg.textContent = 'Forging the Ward… (loading assets)';
const [hdri] = await Promise.all([
  new THREE.HDRLoader().loadAsync(`assets/hdri/cobblestone_street_night_${Q.hdri}.hdr`).catch((e) => { console.warn('[hdri] unavailable', e); return null; }),
  Assets.init({ tier: Q.name }),
  preloadPBR(),
]);
Q.hdriTex = hdri;
// Post chain: scene -> (High) GTAO ambient occlusion -> bloom -> tone map/sRGB -> grade (cover-art colour, vignette, grain)
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
let gtao = null;
if (Q.ao) {
  gtao = new THREE.GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.output = THREE.GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  composer.addPass(gtao);
}
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.5, 0.9);
composer.addPass(bloom);
if (Q.bloomDiv > 2) { const bs = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bs(w / 2, h / 2); } // quarter-res bloom mips on Low
composer.addPass(new THREE.OutputPass());
const grade = makeGradePass(THREE, Q);
composer.addPass(grade);
let smaa = null;
if (Q.aa) { smaa = new THREE.SMAAPass(innerWidth, innerHeight); composer.addPass(smaa); }

const game = new Game(renderer, composer, bloom, scene, camera);
let dyn = 1; // dynamic resolution factor
function resize() {
  const pr = Math.min(devicePixelRatio || 1, Q.prCap) * game.settings.scale * dyn;
  const bq = Q.bloomDiv; // bloom works at a quarter resolution on Low
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / bq, innerHeight / bq);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
game.onResize = resize;
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 250));
window.visualViewport?.addEventListener('resize', () => setTimeout(resize, 50));
resize();

let last = performance.now(), acc = 0, frames = 0, slow = 0;
const stats = { fps: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const real = (now - last) / 1000, dt = Math.min(0.05, real); last = now;
  game.update(dt);
  grade.uniforms.uTime.value = now / 1000;
  renderer.info.reset();
  composer.render(dt);
  // adaptive resolution: drop render scale if the frame budget is blown for a while
  acc += real; frames++;
  if (acc > 2) {
    stats.fps = frames / acc;
    if (!window.__wardenNoDyn) {
      const floor = game.isTouch ? 0.5 : 0.6;
      if (stats.fps < 40 && dyn > floor) { dyn = Math.max(floor, dyn - 0.15); resize(); slow++; }
      else if (stats.fps > 58 && dyn < 1) { dyn = Math.min(1, dyn + 0.1); resize(); }
    }
    acc = 0; frames = 0;
  }
}
game.boot();
document.getElementById('boot').remove();
requestAnimationFrame(frame);

// Test / debug hooks (used by the automated smoke test).
window.__warden = { game, THREE, build: BUILD, stats, renderer, Q, Assets, composer, grade, gtao,
  perf: () => perfReport(renderer, scene) };
window.__wardenItems = Items;
window.__wardenSave = SaveSys;
window.__wardenPOI = POI;

// Per-frame cost snapshot for the perf table: draw calls, triangles, textures and an estimate of their GPU memory.
function perfReport(r, sc) {
  const info = r.info, seen = new Set(); let texBytes = 0;
  sc.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'alphaMap']) {
      const t = m[k]; if (!t || seen.has(t.source || t)) continue; seen.add(t.source || t);
      const img = t.image; const w = img?.width || img?.videoWidth || 0, h = img?.height || img?.videoHeight || 0;
      texBytes += w * h * 4 * 1.33;
    }
  });
  return { tier: Q.name, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
    texMB: +(texBytes / 1048576).toFixed(1), pr: +r.getPixelRatio().toFixed(3), size: [r.domElement.width, r.domElement.height], assets: Assets.list(), assetErrors: Assets.errors.length };
}
