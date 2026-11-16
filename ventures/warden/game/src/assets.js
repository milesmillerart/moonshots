// Asset pipeline: logical ids (char_warden, enemy_husk, weapon_synthblade, prop_lamppost, bldg_...) -> GLB files
// listed in assets/manifest.json. Anything missing or failing to load falls back to the procedural models, so the
// game always runs. Characters may be skinned + animated (Mixamo-style clips); see docs/assets.md.
import * as THREE from '../vendor/three-warden.r187-09.min.js';

// Logical clip names the game asks for, and the source names we accept for each (Mixamo, Meshy, Blender exports).
export const CLIP_ALIASES = {
  idle: [/^idle/i, /breath/i, /stand/i],
  walk: [/^walk/i, /walking/i],
  run: [/^run/i, /running/i, /sprint/i, /jog/i],
  attack: [/^attack$/i, /slash/i, /attack/i, /swing/i, /punch/i, /strike/i],
  attack2: [/attack ?2/i, /slash ?2/i, /combo/i],
  attack3: [/attack ?3/i, /slash ?3/i],
  heavy: [/heavy/i, /great ?sword ?slash/i, /power/i],
  dodge: [/dodge/i, /roll/i, /evade/i, /jump/i],
  hit: [/^hit/i, /hit ?react/i, /impact/i, /hurt/i, /damage/i],
  death: [/death/i, /dying/i, /^die/i, /defeat/i],
};
const FALLBACK = { attack2: 'attack', attack3: 'attack', heavy: 'attack', run: 'walk', walk: 'idle', dodge: 'run', hit: 'idle' };

export const Assets = {
  tier: 'high', manifest: { assets: {} }, loaded: {}, errors: [], base: 'assets/',
  async init({ tier = 'high', manifestUrl = null, timeoutMs = 20000 } = {}) {
    this.tier = tier;
    const url = manifestUrl || new URLSearchParams(location.search).get('assets') || this.base + 'manifest.json';
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) this.manifest = await r.json();
    } catch (e) { console.warn('[assets] manifest unavailable, procedural models only', e); }
    this.base = url.replace(/[^/]*$/, '');
    const ids = Object.keys(this.manifest.assets || {});
    if (!ids.length) return this;
    const loader = new THREE.GLTFLoader();
    const draco = new THREE.DRACOLoader(); draco.setDecoderPath(new URL('../vendor/draco/', import.meta.url).href);
    loader.setDRACOLoader(draco); loader.setMeshoptDecoder(THREE.MeshoptDecoder);
    const one = async (id) => {
      const a = this.manifest.assets[id];
      const file = (tier === 'low' && a.fileLow) ? a.fileLow : a.file;
      try {
        const gltf = await Promise.race([loader.loadAsync(this.base + file), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))]);
        this.loaded[id] = { gltf, meta: a, clips: mapClips(gltf.animations, a.clips) };
      } catch (e) { this.errors.push({ id, file, error: String(e) }); console.warn(`[assets] ${id} (${file}) failed, using procedural fallback`, e); }
    };
    await Promise.all(ids.map(one));
    draco.dispose();
    return this;
  },
  has(id) { return !!this.loaded[id]; },
  list() { return Object.keys(this.loaded); },
  // A fresh, independently animatable copy of a loaded asset (skinned meshes are cloned with their skeletons).
  instance(id) {
    const L = this.loaded[id]; if (!L) return null;
    const src = L.gltf.scene;
    const root = THREE.SkeletonUtils.clone(src);
    const m = L.meta, s = m.scale ?? 1;
    root.scale.setScalar(s);
    if (m.offset) root.position.fromArray(m.offset);
    if (m.rotationY) root.rotation.y = m.rotationY;
    root.traverse((o) => {
      if (o.isMesh) {
        if (m.type === 'char' || m.type === 'enemy' || /^(char|enemy)_/.test(id)) o.material = Array.isArray(o.material) ? o.material.map((x) => x.clone()) : o.material.clone(); // per-instance flashes
        o.castShadow = m.castShadow !== false; o.receiveShadow = true;
        if (o.isSkinnedMesh) o.frustumCulled = false; // animated bounds lag the bind pose
        if (o.material && o.material.envMapIntensity !== undefined) o.material.envMapIntensity = m.envMapIntensity ?? 1;
      }
    });
    const anim = L.gltf.animations.length ? new Animator(root, L.clips) : null;
    return { root, anim, meta: m, id };
  },
  bone(root, names) { // first bone/object whose name matches one of the patterns
    let hit = null;
    const san = (n) => THREE.PropertyBinding.sanitizeNodeName(n); // GLTFLoader strips '.', ':' etc from node names
    root.traverse((o) => { if (!hit && names.some((n) => (n instanceof RegExp ? n.test(o.name) : o.name === n || o.name === san(n)))) hit = o; });
    return hit;
  },
};

// map logical clip names -> AnimationClip, honoring explicit manifest names first, then aliases, then fallbacks
export function mapClips(anims, explicit = {}) {
  const out = {};
  for (const key of Object.keys(CLIP_ALIASES)) {
    const want = explicit?.[key];
    let c = want ? anims.find((a) => a.name === want) : null;
    if (!c) for (const re of CLIP_ALIASES[key]) { c = anims.find((a) => re.test(a.name.replace(/^.*\|/, ''))); if (c) break; }
    if (c) out[key] = c;
  }
  for (const [k, fb] of Object.entries(FALLBACK)) if (!out[k] && out[fb]) out[k] = out[fb];
  if (!out.idle && anims[0]) out.idle = anims[0];
  return out;
}

// Plays logical states with cross-fades. One-shots (attack, dodge, hit, death) play once; death clamps.
export class Animator {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root); this.clips = clips; this.actions = {}; this.cur = null; this.state = null;
    for (const [k, c] of Object.entries(clips)) this.actions[k] = this.mixer.clipAction(c);
  }
  has(k) { return !!this.actions[k]; }
  play(k, { fade = 0.15, once = false, speed = 1, restart = false } = {}) {
    if (!this.actions[k] && /^(attack\d|heavy)$/.test(k)) k = this.actions[k.replace(/\d$/, '')] ? k.replace(/\d$/, '') : 'attack'; // combo/heavy fall back to the base attack clip
    if (!this.actions[k]) k = 'idle';
    const a = this.actions[k]; if (!a) return;
    a.timeScale = speed;
    if (this.cur === a && !restart) return;
    a.reset(); a.enabled = true;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, fade, false);
    a.play(); this.cur = a; this.state = k;
  }
  update(dt) { this.mixer.update(dt); }
}

// Swap a procedural model's visuals for a loaded GLB (keeps the procedural group as the logic/animation rig).
// `keep` = procedural sub-groups that stay visible (e.g. the Synthblade while no weapon GLB exists).
export function attachSkin(model, id, keep = []) {
  const inst = Assets.instance(id); if (!inst) return null;
  const kept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
  model.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && !kept(o)) { o.visible = false; o.userData.hiddenBySkin = true; } });
  model.add(inst.root);
  inst.mats = [];
  inst.root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.emissive) { inst.mats.push(m); m.userData.baseEmissive = m.emissive.clone(); } });
  inst.flash = (k) => { for (const m of inst.mats) m.emissive.copy(m.userData.baseEmissive).lerp(new THREE.Color(1.2, 1.1, 1.1), k); };
  return inst;
}
