// Combat feedback: sparks, blade trail, lightning, rings, damage numbers.
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { softCanvas } from './world.js';
import { detectTouch } from './touch.js';

const LOWFX = detectTouch();
// Swing trail: a tapered additive ribbon, Catmull-Rom smoothed between frames so fast cuts stay
// round even at low frame rates. 0.8: deep red, hot only at the very edge (motion of the synth edge, not a beam).
const TRAIL_VS = `attribute vec3 aT; varying vec3 vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TRAIL_FS = `varying vec3 vT;
void main(){
  float k = vT.x, s = vT.y, a = vT.z;
  float fade = pow(1.0 - k, 2.2);
  float edge = pow(s, 2.2);
  float streak = 0.72 + 0.28 * sin(k * 70.0 + s * 9.0);
  vec3 col = mix(vec3(0.42, 0.0, 0.05), vec3(3.1, 0.22, 0.5), edge) + vec3(2.2, 1.0, 1.3) * pow(s, 16.0) * (1.0 - k);
  float inner = smoothstep(0.0, 0.35, s);
  gl_FragColor = vec4(col * a * fade * (0.03 + 0.55 * edge * edge) * inner * streak, 1.0);
}`;
const CR = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };

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
    this.TN = 20; this.SUB = LOWFX ? 2 : 4;
    this.trail = [];
    const NV = (this.TN - 1) * this.SUB + 1; this.NV = NV;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NV * 2 * 3), 3));
    tg.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(NV * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < NV - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    tg.setDrawRange(0, 0);
    this.trailMesh = new THREE.Mesh(tg, new THREE.ShaderMaterial({ vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
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
  updateTrail(dt) {
    const tr = this.trail, geo = this.trailMesh.geometry;
    for (const s of tr) s.a *= Math.pow(0.0008, dt);
    const m = tr.length;
    if (m < 2 || tr[0].a + tr[Math.min(3, m - 1)].a < 0.004) { geo.setDrawRange(0, 0); return; }
    const pa = geo.attributes.position.array, ta = geo.attributes.aT.array, S = this.SUB;
    const at = (i) => tr[Math.max(0, Math.min(m - 1, i))];
    const total = (m - 1) * S;
    let v = 0;
    for (let i = 0; i < m - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let j = 0; j < S || (i === m - 2 && j === S); j++) {
        const t = j / S, k = (i * S + j) / total;
        const tx = CR(p0.t.x, p1.t.x, p2.t.x, p3.t.x, t), ty = CR(p0.t.y, p1.t.y, p2.t.y, p3.t.y, t), tz = CR(p0.t.z, p1.t.z, p2.t.z, p3.t.z, t);
        const bx = CR(p0.b.x, p1.b.x, p2.b.x, p3.b.x, t), by = CR(p0.b.y, p1.b.y, p2.b.y, p3.b.y, t), bz = CR(p0.b.z, p1.b.z, p2.b.z, p3.b.z, t);
        const w = 0.8 * Math.pow(1 - k, 1.1); // taper: the inner edge slides out toward the tip with age
        const a = p1.a + (p2.a - p1.a) * t;
        pa[v * 6] = tx + (bx - tx) * w; pa[v * 6 + 1] = ty + (by - ty) * w; pa[v * 6 + 2] = tz + (bz - tz) * w;
        pa[v * 6 + 3] = tx; pa[v * 6 + 4] = ty; pa[v * 6 + 5] = tz;
        ta[v * 6] = k; ta[v * 6 + 1] = 0; ta[v * 6 + 2] = a;
        ta[v * 6 + 3] = k; ta[v * 6 + 4] = 1; ta[v * 6 + 5] = a;
        v++;
      }
    }
    geo.setDrawRange(0, Math.max(0, v - 1) * 6);
    geo.attributes.position.needsUpdate = true; geo.attributes.aT.needsUpdate = true;
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
    this.updateTrail(dt);
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
