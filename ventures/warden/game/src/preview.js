// Armory paper-doll: a live, slowly turning render of the Warden in a small second WebGL canvas.
// Built once and reused (the canvas is re-attached on every panel render, so the GL context survives).
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { buildWarden } from './models.js';
import { posePoster } from './player.js';
import { RARITIES } from './data.js';
import { tierOf } from './items.js';

export class WardenPreview {
  constructor(lowPower) {
    this.low = lowPower; this.ok = false; this.yaw = 0.5; this.spin = 0.35; this.drag = null; this.running = false;
    try {
      this.canvas = document.createElement('canvas'); this.canvas.id = 'dollcv';
      this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !lowPower, alpha: true, powerPreference: 'low-power' });
      this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.15;
      this.r.setClearColor(0x000000, 0);
    } catch { return; }
    const sc = this.scene = new THREE.Scene();
    const env = new THREE.Scene(); env.background = new THREE.Color(0x05060a);
    const panel = (c, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    panel(0x1fd8c8, 8, 3, 2, 3, 6); panel(0xff1f5a, -8, 4, -3, 2, 5); panel(0x303a50, 0, 10, 0, 20, 20); panel(0x0c4b52, -5, 2, 8, 6, 2);
    sc.environment = new THREE.PMREMGenerator(this.r).fromScene(env, 0.03).texture; sc.environmentIntensity = 0.7;
    sc.add(new THREE.HemisphereLight(0x8aa0c8, 0x100808, 0.7));
    const key = new THREE.DirectionalLight(0xdfe6ff, 2.2); key.position.set(2, 4, 3); sc.add(key);
    this.rim = new THREE.PointLight(0xff3060, 9, 6, 1.6); this.rim.position.set(-1.2, 2.2, -1.3); sc.add(this.rim);
    this.rim2 = new THREE.PointLight(0x46f0e0, 6, 6, 1.6); this.rim2.position.set(1.4, 1.4, -1.0); sc.add(this.rim2);
    // floor: a rarity-tinted ring under his feet
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.56, 64), new THREE.MeshBasicMaterial({ color: 0xff2a55, transparent: true, opacity: 0.85, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.01; sc.add(this.ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.52, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005; sc.add(disc);
    this.model = buildWarden(); posePoster(this.model); sc.add(this.model);
    this.capeMat = this.model.userData.cape.material; this.capeBase = this.capeMat.color.clone();
    this.cam = new THREE.PerspectiveCamera(30, 0.7, 0.1, 30);
    this.cam.position.set(0, 1.25, 5.0); this.cam.lookAt(0, 1.0, 0);
    // drag to turn (mouse or touch)
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: this.yaw }; c.setPointerCapture?.(e.pointerId); e.stopPropagation(); });
    c.addEventListener('pointermove', (e) => { if (this.drag) { this.yaw = this.drag.y + (e.clientX - this.drag.x) * 0.012; } });
    const up = () => { this.drag = null; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    this.ok = true;
  }
  // reflect current gear: cape tint from the mantle, ring + rim from the blade, visor brightness from the helm
  dress(equip) {
    if (!this.ok) return;
    const col = (it) => new THREE.Color(RARITIES[it ? tierOf(it) : 0].color);
    const m = equip.mantle; this.capeMat.color.copy(this.capeBase).lerp(col(m), m ? 0.12 + 0.05 * tierOf(m) : 0);
    const b = equip.blade, br = b ? tierOf(b) : 0;
    this.ring.material.color.copy(col(b)); this.rim2.color.copy(col(b)); this.rim2.intensity = 4 + br * 2;
    const h = equip.helm, vm = this.model.userData.visorMat; if (vm?.color) vm.color.setRGB(1.1 + (h ? tierOf(h) : 0) * 0.15, 0.015, 0.04);
  }
  mount(host) {
    if (!this.ok || !host) return false;
    host.appendChild(this.canvas);
    let last = 0;
    const size = () => {
      const w = Math.max(60, host.clientWidth), h = Math.max(80, host.clientHeight);
      const k = w * 10000 + h; if (k === last) return; last = k;
      this.r.setPixelRatio(Math.min(devicePixelRatio || 1, this.low ? 1 : 1.5));
      this.r.setSize(w, h, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
      this.cam.aspect = w / h; this.cam.fov = w / h < 0.6 ? 34 : 30; this.cam.updateProjectionMatrix();
    };
    size();
    requestAnimationFrame(size);
    this._ro?.disconnect();
    if (typeof ResizeObserver === 'function') { this._ro = new ResizeObserver(size); this._ro.observe(host); }
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this.loop(t)); }
    return true;
  }
  stop() { this.running = false; this._ro?.disconnect(); }
  loop(t) {
    if (!this.running) return;
    if (!this.canvas.isConnected) { this.running = false; return; }
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.1, (t - this.last) / 1000);
    if (dt < (this.low ? 1 / 30 : 1 / 60) - 0.002) return; // phones: ~30 fps is plenty for a turntable
    this.last = t;
    if (!this.drag) this.yaw += dt * this.spin;
    this.model.rotation.y = this.yaw;
    const sw = this.model.userData.sword.userData; sw.setAwake?.(this.awake ?? 1); sw.tick?.(0, t / 1000, 0.2, 0.15);
    this.ring.material.opacity = 0.65 + 0.2 * Math.sin(t / 500);
    this.r.render(this.scene, this.cam);
  }
}
