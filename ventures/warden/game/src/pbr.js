// CC0 PBR texture sets (Poly Haven, see CREDITS.md) at a tier-sized resolution: diff (sRGB), nor (OpenGL normal),
// arm (R = ambient occlusion, G = roughness, B = metalness). One GPU upload per image, shared by every material.
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { Q } from './quality.js';

const loader = new THREE.TextureLoader();
const cache = new Map();
export const PBR_SETS = ['cobblestone_floor_08', 'castle_wall_slates', 'dark_brick_wall', 'rusty_metal_02', 'brown_leather', 'metal_plate'];
// Load every set before the world is built so no material ever samples an empty texture.
export async function preloadPBR() {
  await Promise.all(PBR_SETS.flatMap((id) => [['diff', true], ['nor', false], ['arm', false]].map(async ([m, srgb]) => {
    const key = `${id}/${m}`;
    try {
      const t = await loader.loadAsync(new URL(`../assets/tex/${id}/${m}_${Q.tex}.jpg`, import.meta.url).href);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Q.maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      cache.set(key, t);
    } catch (e) { console.warn('[pbr] missing', key, e); }
  })));
}
function load(id, m, srgb) {
  const key = `${id}/${m}`;
  if (!cache.has(key)) {
    const t = loader.load(new URL(`../assets/tex/${id}/${m}_${Q.tex}.jpg`, import.meta.url).href, undefined, undefined, (e) => console.warn('[pbr] missing', key, e));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Q.maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(key, t);
  }
  return cache.get(key);
}
// Maps for a set, repeated (rx, ry). Repeated copies share the source image.
export function pbrMaps(id, rx = 1, ry = rx) {
  const out = {};
  for (const [k, m, s] of [['map', 'diff', true], ['normalMap', 'nor', false], ['arm', 'arm', false]]) {
    const base = load(id, m, s);
    const t = rx === 1 && ry === 1 ? base : base.clone();
    t.repeat.set(rx, ry); t.needsUpdate = false;
    out[k] = t;
  }
  return out;
}
// A MeshStandardMaterial from a set. `tint` darkens/colours the albedo (Hallowmere is near-black).
export function pbrMaterial(id, { rx = 1, ry = rx, tint = 0xffffff, rough = 1, metal = 0, normal = 1, ao = 1, extra = {} } = {}) {
  const t = pbrMaps(id, rx, ry);
  const mat = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, metalnessMap: metal > 0 ? t.arm : null, aoMap: ao > 0 ? t.arm : null,
    aoMapIntensity: ao, color: tint, roughness: rough, metalness: metal, ...extra });
  mat.normalScale.set(normal, normal);
  return mat;
}
