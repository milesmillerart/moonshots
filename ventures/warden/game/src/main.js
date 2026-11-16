// Boot: renderer, post-processing, resize, main loop, test hooks.
import * as THREE from '../vendor/three-warden.r187.min.js';
import { Game } from './game.js';
import * as Items from './items.js';
import { detectTouch } from './touch.js';
import { POI } from './world.js';

const BUILD = document.documentElement.dataset.build || 'dev';
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('cv'), antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('boot').innerHTML = '<p>Warden needs WebGL. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration on.</p>';
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 700);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.85, 0.55, 0.88);
composer.addPass(bloom);
if (detectTouch()) { const bs = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bs(w / 2, h / 2); } // quarter-res bloom mips on phones
composer.addPass(new THREE.OutputPass());

const game = new Game(renderer, composer, bloom, scene, camera);
let dyn = 1; // dynamic resolution factor
function resize() {
  const pr = Math.min(devicePixelRatio || 1, game.isTouch ? 1.25 : 1.5) * game.settings.scale * dyn;
  const bq = game.isTouch ? 4 : 2; // bloom works at a quarter resolution on phones
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
window.__warden = { game, THREE, build: BUILD, stats, renderer };
window.__wardenItems = Items;
window.__wardenPOI = POI;
