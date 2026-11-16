// Combat feedback: sparks, blade trail, lightning, rings, damage numbers.
import * as THREE from '../vendor/three-warden.r187.min.js';
import { softCanvas } from './world.js';

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    // spark particles
    this.N = 600;
    this.p = new Float32Array(this.N * 3); this.v = new Float32Array(this.N * 3);
    this.c = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    const sprite = new THREE.CanvasTexture(softCanvas(32));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.075, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.points.frustumCulled = false; scene.add(this.points);
    // blade trail ribbon
    this.TN = 18;
    this.trail = [];
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.TN * 2 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.TN * 2 * 4), 4));
    const idx = [];
    for (let i = 0; i < this.TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    this.trailMesh = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.trailMesh.frustumCulled = false; scene.add(this.trailMesh);
    this.rings = []; this.bolts = []; this.nums = [];
    this.numLayer = document.getElementById('nums');
  }
  burst(pos, n, color, speed = 6, up = 2, life = 0.5) {
    const col = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.i = (this.i + 1) % this.N;
      this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = speed * (0.3 + Math.random());
      this.v[i * 3] = Math.cos(a) * Math.sqrt(1 - e * e) * s; this.v[i * 3 + 1] = e * s * 0.6 + up; this.v[i * 3 + 2] = Math.sin(a) * Math.sqrt(1 - e * e) * s;
      this.c[i * 3] = col.r * 2; this.c[i * 3 + 1] = col.g * 2; this.c[i * 3 + 2] = col.b * 2;
      this.life[i] = life * (0.5 + Math.random());
    }
  }
  // Trail: push the blade base and tip world positions each frame.
  trailPush(base, tip, active) {
    this.trail.unshift({ b: base.clone(), t: tip.clone(), a: active ? 1 : 0 });
    if (this.trail.length > this.TN) this.trail.pop();
  }
  ring(pos, maxR, dur, color, width = 0.5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = 0.06; this.scene.add(m);
    this.rings.push({ m, maxR, dur, t: 0, width });
  }
  telegraph(pos, r, dur, color = 0xff2040) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = 0.05; this.scene.add(m);
    this.rings.push({ m, maxR: 0, dur, t: 0, tele: true });
  }
  bolt(a, b, color = 0x46f0e0) {
    const pts = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (i && i < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5));
      pts.push(p);
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), transparent: true, toneMapped: false }));
    this.scene.add(l); this.bolts.push({ l, t: 0.18 });
  }
  number(pos, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'dmg ' + cls; el.textContent = text;
    this.numLayer.appendChild(el);
    this.nums.push({ el, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 30 });
  }
  update(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.p[i * 3 + 1] = -100; continue; }
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= 14 * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < 0.02) { this.p[i * 3 + 1] = 0.02; this.v[i * 3 + 1] *= -0.3; this.v[i * 3] *= 0.6; this.v[i * 3 + 2] *= 0.6; }
      const f = Math.min(1, this.life[i] * 3);
      this.c[i * 3] *= 0.985; this.c[i * 3 + 1] *= 0.97; this.c[i * 3 + 2] *= 0.97;
      if (f < 1) { this.c[i * 3] *= f; this.c[i * 3 + 1] *= f; this.c[i * 3 + 2] *= f; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // trail
    const pa = this.trailMesh.geometry.attributes.position.array, ca = this.trailMesh.geometry.attributes.color.array;
    for (const s of this.trail) s.a *= Math.pow(0.0008, dt);
    for (let i = 0; i < this.TN; i++) {
      const s = this.trail[Math.min(i, this.trail.length - 1)];
      if (!s) break;
      const k = 1 - i / this.TN;
      pa.set([s.b.x, s.b.y, s.b.z], i * 6); pa.set([s.t.x, s.t.y, s.t.z], i * 6 + 3);
      const a = s.a * k;
      ca.set([2.4 * a, 0.12 * a, 0.5 * a, a * 0.2], i * 8); ca.set([4 * a, 0.5 * a, 1.2 * a, a], i * 8 + 4);
    }
    this.trailMesh.geometry.attributes.position.needsUpdate = true;
    this.trailMesh.geometry.attributes.color.needsUpdate = true;
    // rings / telegraphs
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      const k = r.t / r.dur;
      if (r.tele) { r.m.material.opacity = 0.15 + 0.25 * k; }
      else { const s = 0.2 + r.maxR * k; r.m.scale.set(s, s, s); r.m.material.opacity = 1 - k; }
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt; b.l.material.opacity = Math.max(0, b.t / 0.18);
      if (b.t <= 0) { this.scene.remove(b.l); b.l.geometry.dispose(); this.bolts.splice(i, 1); }
    }
    // damage numbers
    const w = innerWidth, h = innerHeight, v = new THREE.Vector3();
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t += dt;
      v.copy(n.pos); v.y += n.t * 1.2; v.project(this.camera);
      if (v.z > 1 || n.t > 0.9) { n.el.remove(); this.nums.splice(i, 1); continue; }
      n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w + n.dx}px, ${(-v.y * 0.5 + 0.5) * h}px) scale(${1 + Math.max(0, 0.3 - n.t) * 2})`;
      n.el.style.opacity = String(1 - Math.max(0, n.t - 0.5) / 0.4);
    }
  }
}
