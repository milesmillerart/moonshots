// The Warden: movement, stamina, dodge, synthblade combo, procedural animation.
import * as THREE from '../vendor/three-warden.r187.min.js';
import { buildWarden } from './models.js';
import { moveCircle } from './world.js';
import { clamp, damp, dampAngle, smooth } from './util.js';
import { audio } from './audio.js';

const N = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const P = (x, y, z) => new THREE.Vector3(x, y, z);
// Poses in torso space. Character faces +Z; its right hand side is -X.
const IDLE = { g: P(-0.4, -0.12, 0.22), d: N(-0.55, -0.42, 0.72), tw: -0.12 };
const RUN = { g: P(-0.36, -0.2, 0.05), d: N(-0.3, -0.35, -0.89), tw: -0.15 };
const ATTACKS = {
  l1: { keys: [{ g: P(-0.42, 0.38, 0.12), d: N(-0.8, 0.35, -0.45), tw: -0.55 }, { g: P(-0.08, 0.25, 0.58), d: N(-0.15, 0.05, 1), tw: 0 }, { g: P(0.38, 0.14, 0.32), d: N(0.95, -0.1, 0.15), tw: 0.55 }],
    t: [0.13, 0.13, 0.26], mult: 1.0, range: 2.7, arc: 1.3, sta: 9, poise: 1, lunge: 2.2 },
  l2: { keys: [{ g: P(0.3, 0.0, 0.3), d: N(0.8, -0.45, 0.2), tw: 0.5 }, { g: P(0, 0.2, 0.58), d: N(0, 0.2, 1), tw: 0 }, { g: P(-0.36, 0.48, 0.24), d: N(-0.75, 0.62, 0.1), tw: -0.5 }],
    t: [0.11, 0.13, 0.26], mult: 1.1, range: 2.7, arc: 1.3, sta: 9, poise: 1, lunge: 2.2 },
  l3: { keys: [{ g: P(-0.06, 0.7, 0.08), d: N(0, 0.5, -0.86), tw: -0.15 }, { g: P(-0.05, 0.45, 0.55), d: N(0, 0.3, 1), tw: 0 }, { g: P(-0.05, -0.08, 0.55), d: N(0, -0.8, 0.6), tw: 0.05 }],
    t: [0.16, 0.12, 0.36], mult: 1.35, range: 2.9, arc: 0.9, sta: 12, poise: 2, lunge: 3.5, finisher: true },
  heavy: { keys: [{ g: P(-0.42, 0.62, 0.0), d: N(-0.55, 0.55, -0.6), tw: -0.7 }, { g: P(-0.1, 0.35, 0.6), d: N(-0.1, 0.3, 1), tw: 0 }, { g: P(0.32, -0.1, 0.45), d: N(0.6, -0.65, 0.45), tw: 0.7 }],
    t: [0.4, 0.15, 0.45], mult: 2.3, range: 3.1, arc: 1.6, sta: 24, poise: 3.5, lunge: 4.5, heavy: true },
};
const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.game = game;
    this.model = buildWarden();
    this.u = this.model.userData;
    this.pos = this.model.position;
    this.face = Math.PI; this.vel = new THREE.Vector3();
    this.hp = 100; this.sta = 100; this.charge = 0;
    this.state = 'move'; this.t = 0; this.atk = null; this.combo = 0; this.buffer = null;
    this.iframes = 0; this.hurtT = 0; this.stimT = 0; this.walkPh = 0;
    this.pose = { g: IDLE.g.clone(), d: IDLE.d.clone(), tw: 0 };
    this.edgeDir = new THREE.Vector3(1, 0, 0); this.lastD = IDLE.d.clone();
    this.staDelay = 0; this.hitSet = new Set(); this.speedMul = 1;
    this.bladeSpeed = 0;
    this.lastTip = new THREE.Vector3();
  }
  get stats() { return this.game.stats; }
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.face), 0, Math.cos(this.face)); }
  get busy() { return this.state === 'attack' || this.state === 'dodge' || this.state === 'dead'; }

  update(dt, inp, camYaw) {
    const s = this.stats;
    this.t += dt; this.iframes -= dt; this.hurtT -= dt; this.staDelay -= dt;
    const aspd = 1 + s.aspd / 100;
    // movement intent relative to camera
    const fwd = tmpA.set(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right = tmpB.set(-Math.cos(camYaw), 0, Math.sin(camYaw));
    const mv = tmpC.set(0, 0, 0);
    if (inp.f) mv.add(fwd); if (inp.b) mv.sub(fwd); if (inp.r) mv.add(right); if (inp.l) mv.sub(right);
    if (inp.joy) { mv.addScaledVector(fwd, -inp.joy.y).addScaledVector(right, inp.joy.x); }
    const moving = mv.lengthSq() > 0.01; if (moving) mv.normalize();

    if (this.state === 'dead') { this.animate(dt, 0); return; }

    // stamina regen
    if (this.state !== 'attack' && this.state !== 'dodge' && this.staDelay <= 0) {
      this.sta = Math.min(s.sta, this.sta + 32 * (1 + s.regen / 100) * dt * (inp.sprint && moving ? 0.2 : 1));
    }
    if (this.stimT > 0) { this.stimT -= dt; this.hp = Math.min(s.hp, this.hp + s.hp * 0.45 * dt / 1.2); }

    if (this.state === 'move') {
      const sprint = inp.sprint && moving && this.sta > 5;
      const speed = (sprint ? 6.6 : 4.3) * (this.stimT > 0 ? 0.6 : 1);
      if (sprint) { this.sta -= 14 * dt; this.staDelay = 0.3; }
      const target = moving ? mv.clone().multiplyScalar(speed) : new THREE.Vector3();
      this.vel.x = damp(this.vel.x, target.x, 12, dt); this.vel.z = damp(this.vel.z, target.z, 12, dt);
      if (moving) {
        const want = this.game.lockTarget ? Math.atan2(this.game.lockTarget.pos.x - this.pos.x, this.game.lockTarget.pos.z - this.pos.z) : Math.atan2(mv.x, mv.z);
        this.face = dampAngle(this.face, want, 12, dt);
      } else if (this.game.lockTarget) {
        this.face = dampAngle(this.face, Math.atan2(this.game.lockTarget.pos.x - this.pos.x, this.game.lockTarget.pos.z - this.pos.z), 10, dt);
      }
      moveCircle(this.pos, this.vel.x * dt, this.vel.z * dt, 0.45);
      // actions
      if (inp.dodge) this.startDodge(moving ? mv : this.forward().multiplyScalar(-1));
      else if (inp.light || this.buffer === 'light') this.startAttack(this.combo < 3 ? ['l1', 'l2', 'l3'][this.combo] : 'l1');
      else if (inp.heavy || this.buffer === 'heavy') this.startAttack('heavy');
      else if (inp.stim) this.useStim();
      this.buffer = null;
      if (this.t > 0.6) this.combo = 0;
    } else if (this.state === 'attack') {
      const A = this.atk, T = this.t * aspd;
      const [tw, ta, tr] = A.t;
      // aim assist while winding up
      if (T < tw) {
        const tgt = this.game.aimTarget(this);
        if (tgt) this.face = dampAngle(this.face, Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z), 18, dt);
        else if (moving) this.face = dampAngle(this.face, Math.atan2(mv.x, mv.z), 10, dt);
      }
      // lunge during the active part
      if (T >= tw * 0.6 && T < tw + ta) {
        const f = this.forward();
        const tgt = this.game.aimTarget(this);
        const close = tgt && tgt.pos.distanceTo(this.pos) < 1.4 + tgt.def.radius;
        if (!close) moveCircle(this.pos, f.x * A.lunge * dt * aspd, f.z * A.lunge * dt * aspd, 0.45);
      }
      this.vel.multiplyScalar(0.8);
      if (T >= tw && T < tw + ta) { this.activeHit = true; this.game.meleeCheck(this, A); }
      else this.activeHit = false;
      if (T >= tw + ta * 0.5) {
        if (inp.light) this.buffer = 'light';
        if (inp.heavy) this.buffer = 'heavy';
        if (inp.dodge) this.buffer = 'dodge';
      }
      const cancel = T >= tw + ta + tr * 0.35 && this.buffer;
      if (T >= tw + ta + tr || cancel) {
        this.state = 'move'; this.t = 0; this.activeHit = false;
        if (this.buffer === 'dodge') { this.buffer = null; this.startDodge(moving ? mv : this.forward().multiplyScalar(-1)); }
      }
    } else if (this.state === 'dodge') {
      const dur = 0.52;
      const k = this.t / dur;
      const sp = (this.game.perk('quickstep') ? 12.5 : 10.5) * (1 - k) * 1.6;
      moveCircle(this.pos, this.dodgeDir.x * sp * dt, this.dodgeDir.z * sp * dt, 0.45);
      if (this.t >= dur) { this.state = 'move'; this.t = 0; }
    } else if (this.state === 'hurt') {
      moveCircle(this.pos, this.vel.x * dt, this.vel.z * dt, 0.45);
      this.vel.multiplyScalar(Math.pow(0.02, dt));
      if (this.t > 0.32) { this.state = 'move'; this.t = 0; }
    }
    this.animate(dt, moving ? (inp.sprint ? 1.4 : 1) : 0);
  }

  startAttack(kind) {
    const A = ATTACKS[kind];
    if (this.sta < 4) return;
    this.sta -= A.sta; this.staDelay = 0.6;
    this.state = 'attack'; this.t = 0; this.atk = { ...A, kind };
    this.hitSet.clear();
    this.fromPose = { g: this.pose.g.clone(), d: this.pose.d.clone(), tw: this.pose.tw };
    if (kind === 'heavy') this.combo = 0; else this.combo = (this.combo % 3) + 1;
    setTimeout(() => audio.swing(kind === 'heavy'), (A.t[0] * 1000 * 0.8) / (1 + this.stats.aspd / 100));
  }
  startDodge(dir) {
    const cost = this.game.perk('quickstep') ? 15 : 22;
    if (this.sta < cost * 0.5) return;
    this.sta -= cost; this.staDelay = 0.5;
    this.state = 'dodge'; this.t = 0; this.dodgeDir = dir.clone().normalize();
    this.face = Math.atan2(dir.x, dir.z); this.iframes = 0.38;
    audio.dodge(); this.combo = 0;
  }
  useStim() {
    const g = this.game;
    if (g.save.stims <= 0 || this.stimT > 0 || this.hp >= this.stats.hp) return;
    g.save.stims--; this.stimT = 1.2; audio.pickup(1);
    g.fx.burst(this.pos.clone().setY(1.2), 20, 0xff3060, 2, 1.5, 0.6);
    g.ui.toast('Stim injected');
  }
  takeHit(dmg, from, knock = 4) {
    if (this.iframes > 0 || this.state === 'dead') return false;
    const s = this.stats;
    let d = dmg * (1 - s.reduction);
    if (this.state === 'attack') d *= 1 - 0.12 * this.game.perk('iron_resolve');
    this.hp -= d; this.iframes = 0.45;
    this.game.onPlayerHurt(d);
    if (this.hp <= 0) {
      if (this.game.perk('last_rites') && this.game.time - (this.lastRites || -999) > 90) {
        this.hp = 1; this.lastRites = this.game.time; this.game.ui.toast('LAST RITES. You refuse to fall.', 'gold');
      } else { this.hp = 0; this.state = 'dead'; this.t = 0; this.game.onPlayerDeath(); return true; }
    }
    if (this.state !== 'attack' || this.atk?.heavy !== true) {
      const away = this.pos.clone().sub(from).setY(0).normalize();
      this.vel.copy(away.multiplyScalar(knock)); this.state = 'hurt'; this.t = 0;
    }
    audio.hurt();
    return true;
  }

  // ---- procedural animation --------------------------------------------------
  animate(dt, moveAmt) {
    const u = this.u;
    this.model.rotation.y = this.face;
    const spd = Math.hypot(this.vel.x, this.vel.z);
    // legs
    this.walkPh += dt * spd * 2.1;
    const sw = Math.sin(this.walkPh) * Math.min(1, spd / 4) * 0.7;
    u.legs[0].thigh.rotation.x = damp(u.legs[0].thigh.rotation.x, sw, 20, dt);
    u.legs[1].thigh.rotation.x = damp(u.legs[1].thigh.rotation.x, -sw, 20, dt);
    u.legs[0].shin.rotation.x = Math.max(0, -Math.cos(this.walkPh)) * 0.8 * Math.min(1, spd / 4);
    u.legs[1].shin.rotation.x = Math.max(0, Math.cos(this.walkPh)) * 0.8 * Math.min(1, spd / 4);
    u.hips.position.y = 1.02 + Math.abs(Math.cos(this.walkPh)) * 0.04 * Math.min(1, spd / 4) - (this.state === 'attack' ? 0.06 : 0);
    // pose target
    let target;
    if (this.state === 'attack') {
      const A = this.atk, T = this.t * (1 + this.stats.aspd / 100);
      const [tw, ta, tr] = A.t;
      if (T < tw) target = lerpPose(this.fromPose, A.keys[0], smooth(T / tw));
      else if (T < tw + ta) {
        const k = (T - tw) / ta;
        target = k < 0.5 ? lerpPose(A.keys[0], A.keys[1], k * 2) : lerpPose(A.keys[1], A.keys[2], (k - 0.5) * 2);
      } else target = lerpPose(A.keys[2], IDLE, smooth(clamp((T - tw - ta) / tr, 0, 1)) * 0.6);
      this.pose = target;
    } else {
      const base = spd > 5 ? RUN : IDLE;
      const tgt = this.state === 'dodge' ? RUN : base;
      this.pose.g.lerp(tgt.g, 1 - Math.exp(-10 * dt));
      this.pose.d.lerp(tgt.d, 1 - Math.exp(-10 * dt)).normalize();
      this.pose.tw = damp(this.pose.tw, tgt.tw + (spd > 0.5 ? Math.sin(this.walkPh) * 0.06 : 0), 10, dt);
      // idle breathing
      this.pose.g.y += Math.sin(this.t * 2) * 0.0015;
    }
    u.torso.rotation.y = this.pose.tw;
    u.torso.rotation.x = this.state === 'attack' ? 0.12 : spd > 5 ? 0.18 : 0.04;
    // dodge roll
    if (this.state === 'dodge') {
      const k = clamp(this.t / 0.52, 0, 1);
      u.body.rotation.x = smooth(k) * Math.PI * 2;
      u.body.position.y = -Math.sin(k * Math.PI) * 0.45;
    } else { u.body.rotation.x = this.state === 'dead' ? damp(u.body.rotation.x, -1.45, 6, dt) : 0; u.body.position.y = this.state === 'dead' ? damp(u.body.position.y, -0.75, 6, dt) : 0; }
    if (this.state === 'hurt') u.torso.rotation.x = -0.25;
    // sword orientation from pose: y = blade dir, x = edge (leading direction of motion)
    const d = this.pose.d;
    const delta = tmpA.copy(d).sub(this.lastD);
    this.bladeSpeed = damp(this.bladeSpeed, delta.length() / Math.max(dt, 1e-3), 10, dt);
    if (delta.lengthSq() > 1e-6) this.edgeDir.lerp(delta.normalize(), 0.5);
    this.lastD.copy(d);
    Y.copy(d);
    X.copy(this.edgeDir).addScaledVector(Y, -this.edgeDir.dot(Y));
    if (X.lengthSq() < 1e-4) X.set(0, 0, 1).addScaledVector(Y, -Y.z);
    X.normalize(); Z.crossVectors(X, Y).normalize();
    M.makeBasis(X, Y, Z);
    u.sword.quaternion.setFromRotationMatrix(M);
    u.sword.position.copy(this.pose.g);
    // arm IK toward the grip (right hand high on the grip, left hand lower)
    this.model.updateMatrixWorld(true);
    for (const a of u.arms) {
      const hand = u.sword.localToWorld(tmpA.set(0, a.side < 0 ? 0.08 : -0.08, 0));
      const sh = u.torso.localToWorld(tmpB.copy(a.shoulder));
      ik(a, sh, hand, u.torso);
    }
    this.capeAndBlade(dt, spd, this.state === 'attack' ? 1 : 0);
  }
  capeAndBlade(dt, spd, act) {
    const u = this.u;
    // cape sway
    const cp = u.cape.geometry.attributes.position, rest = u.capeRest;
    const sway = Math.min(1.2, spd / 5);
    for (let i = 0; i < cp.count; i++) {
      const y = rest[i * 3 + 1], k = -y / 1.45;
      const flutter = Math.sin(this.t * 6 + rest[i * 3] * 3 + y * 4) * 0.04 * k;
      cp.array[i * 3 + 2] = rest[i * 3 + 2] - (sway * 0.55 + 0.05) * k * k + flutter;
      cp.array[i * 3 + 1] = y + sway * 0.18 * k * k;
    }
    cp.needsUpdate = true;
    u.cape.geometry.computeVertexNormals();
    // blade glow + crackle
    const sw2 = u.sword.userData;
    sw2.glowMat.opacity = 0.25 + 0.25 * act + 0.05 * Math.sin(this.t * 30);
    sw2.light.intensity = 2 + act * 4;
    if (Math.random() < 0.35 + act * 0.6) sw2.crackle(0.4 + act * 0.8 + this.game.bladeRarity * 0.15); else sw2.arcs.geometry.setDrawRange(0, 0);
    // trail sample
    if (this.titleMode) { u.visorMat.color.setRGB(5, 0.25, 0.3); return; }
    const b = u.sword.localToWorld(tmpA.copy(sw2.baseLocal));
    const tp = u.sword.localToWorld(tmpB.copy(sw2.tipLocal));
    this.game.fx.trailPush(b, tp, this.state === 'attack' && this.bladeSpeed > 3);
    audio.setHum(Math.min(1, this.bladeSpeed / 15));
    this.lastTip.copy(tp);
    // hurt flash on visor
    u.visorMat.color.setRGB(this.hurtT > 0 ? 8 : 5, this.hurtT > 0 ? 2 : 0.25, 0.3);
  }
  bladeTip() { return this.lastTip; }
}

function lerpPose(a, b, k) {
  return { g: a.g.clone().lerp(b.g, k), d: a.d.clone().lerp(b.d, k).normalize(), tw: a.tw + (b.tw - a.tw) * k };
}
const E = new THREE.Vector3(), POLE = new THREE.Vector3();
function ik(a, sh, hand, torso) {
  const A = 0.31, B = 0.33;
  const dir = hand.clone().sub(sh);
  let dist = dir.length();
  dist = clamp(dist, 0.08, A + B - 0.01);
  dir.normalize();
  const cosA = clamp((A * A + dist * dist - B * B) / (2 * A * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  // elbows point down and outward
  torso.localToWorld(POLE.set(a.side * 0.6, -0.4, -0.3).add(torso.position).sub(torso.position));
  const origin = torso.localToWorld(new THREE.Vector3());
  POLE.sub(origin).normalize();
  const perp = POLE.addScaledVector(dir, -POLE.dot(dir)).normalize();
  E.copy(sh).addScaledVector(dir, A * cosA).addScaledVector(perp, A * sinA);
  a.upper.position.copy(torso.worldToLocal(sh.clone()));
  a.upper.lookAt(E);
  a.fore.position.copy(torso.worldToLocal(E.clone()));
  const handT = sh.clone().addScaledVector(dir, dist);
  a.fore.lookAt(handT);
}

// Pose any Warden model holding the blade point-down, hands on the grip (title / statue).
export function posePoster(model, lean = 0) {
  const u = model.userData;
  const g = new THREE.Vector3(0, 0.3, 0.36), d = new THREE.Vector3(0, -0.97, 0.22).normalize();
  u.torso.rotation.set(0.05 + lean, 0, 0);
  for (const l of u.legs) { l.thigh.rotation.x = 0; l.shin.rotation.x = 0; }
  u.legs[0].thigh.rotation.z = 0.08; u.legs[1].thigh.rotation.z = -0.08;
  Y.copy(d); X.set(0, 0, 1).addScaledVector(Y, -Y.z).normalize(); X.crossVectors(Y, new THREE.Vector3(1, 0, 0)).normalize();
  Z.crossVectors(X, Y).normalize(); M.makeBasis(X, Y, Z);
  u.sword.quaternion.setFromRotationMatrix(M); u.sword.position.copy(g);
  model.updateMatrixWorld(true);
  for (const a of u.arms) {
    const hand = u.sword.localToWorld(new THREE.Vector3(0, a.side < 0 ? 0.1 : -0.04, 0));
    const sh = u.torso.localToWorld(a.shoulder.clone());
    ik(a, sh, hand, u.torso);
  }
}
