// The Warden: movement, stamina, dodge, synthblade combo, procedural animation.
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { buildWarden } from './models.js';
import { Assets, attachSkin } from './assets.js';
import { moveCircle } from './world.js';
import { angleDiff, clamp, damp, dampAngle, smooth } from './util.js';
import { audio } from './audio.js';

const N = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const P = (x, y, z) => new THREE.Vector3(x, y, z);
// Poses in torso space. Character faces +Z; its right hand side is -X.
const IDLE = { g: P(-0.4, -0.12, 0.22), d: N(-0.55, -0.42, 0.72), tw: -0.12 };
// Poster stance when calm: point planted, both hands resting on the grip.
const REST = { g: P(0.0, 0.27, 0.34), d: N(0, -0.97, 0.2), tw: 0 };
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
    this.riposte = 0; this.perfectCd = 0; this.chargeFx = false;
    this.restT = 0; this.turnLean = 0; this.lastFace = this.face; this.cloth = null;
    // GLB character (Don's models via the asset manifest): the procedural rig keeps driving logic, the GLB is drawn.
    this.skin = attachSkin(this.model, 'char_warden', [this.u.sword]);
    if (this.skin) {
      const g = this.skin.meta.weaponGrip || {};
      this.hand = Assets.bone(this.skin.root, g.bone ? [g.bone] : [/mixamorig:?RightHand$/i, /^RightHand$/i, /^hand[._]?r$/i, /^Hand_R$/i, /^Palm2\.?R$/i]);
      this.gripQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(g.rotation || [-90, 0, 0]).map((d) => (d * Math.PI) / 180)));
      this.gripO = new THREE.Vector3(...(g.offset || [0, 0.08, 0]));
      this.skinAtk = 0;
    }
    const wpn = Assets.instance('weapon_synthblade');
    if (wpn) { // Don's blade replaces the procedural steel; a mesh/material named *synth_channel* glows when Awakened
      const sw = this.u.sword;
      sw.traverse((o) => { if (o.isMesh && !o.userData.keep) o.visible = false; });
      sw.add(wpn.root); this.wpn = wpn; wpn.channel = [];
      wpn.root.traverse((o) => { if (o.isMesh && /synth_?channel/i.test(o.name + ' ' + (o.material?.name || ''))) { o.material = o.material.clone(); wpn.channel.push(o.material); } });
    }
    const motes = this.u.sword.userData.motes; // red mist + embers live in world space
    if (motes) for (const k in motes) game.scene.add(motes[k].pts);
  }
  get stats() { return this.game.stats; }
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.face), 0, Math.cos(this.face)); }
  get busy() { return this.state === 'attack' || this.state === 'dodge' || this.state === 'dead'; }

  update(dt, inp, camYaw) {
    const s = this.stats;
    this.t += dt; this.iframes -= dt; this.hurtT -= dt; this.staDelay -= dt; this.riposte -= dt; this.perfectCd -= dt;
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
      const analog = inp.joy && inp.joy.m != null && !sprint ? Math.max(0.4, Math.min(1, inp.joy.m * 1.15)) : 1;
      const speed = (sprint ? 6.6 : 4.3) * (this.stimT > 0 ? 0.6 : 1) * analog;
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
      // heavy wind-up: the synth edge visibly draws charge, then flashes when it is about to fall
      if (A.heavy && !this.chargeFx && T >= tw * 0.85) {
        this.chargeFx = true;
        this.game.fx.burst(this.lastTip.clone(), 12, 0xff3050, 2.5, 1, 0.35);
      }
      // cancel window: dodge out of any wind-up, getting half the stamina back
      if (inp.dodge && T < tw * 0.85) {
        this.sta = Math.min(s.sta, this.sta + A.sta * 0.5);
        this.state = 'move'; this.t = 0; this.activeHit = false; this.buffer = null;
        this.startDodge(moving ? mv : this.forward().multiplyScalar(-1));
        this.animate(dt, 1); return;
      }
      if (T >= tw && T < tw + ta) { this.activeHit = true; this.game.meleeCheck(this, A); }
      else this.activeHit = false;
      if (T >= tw + ta * 0.5) {
        if (inp.light) this.buffer = 'light';
        if (inp.heavy) this.buffer = 'heavy';
      }
      if (inp.dodge) this.buffer = 'dodge';
      const cancel = (T >= tw + ta + tr * 0.35 && this.buffer) || (T >= tw + ta && this.buffer === 'dodge');
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
    this.state = 'attack'; this.t = 0; this.atk = { ...A, kind }; this.chargeFx = false;
    if (this.riposte > 0) { this.atk.riposte = true; this.riposte = 0; }
    if (A.heavy) audio.charge(A.t[0] / (1 + this.stats.aspd / 100));
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
    if (this.state === 'dodge' && this.t < 0.24 && this.perfectCd <= 0) { this.game.onPerfectDodge(from); return false; }
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
    const walkK = Math.min(1, spd / 4), run = clamp((spd - 4.3) / 2.3, 0, 1);
    const sw = Math.sin(this.walkPh) * walkK * (0.62 + 0.22 * run);
    // attack stance: left foot steps into the cut, right foot braces behind
    let st = 0;
    if (this.state === 'attack') {
      const T = this.t * (1 + this.stats.aspd / 100), [tw, ta, tr] = this.atk.t;
      st = smooth(clamp(T / tw, 0, 1)) * (1 - smooth(clamp((T - tw - ta) / tr, 0, 1))) * (this.atk.heavy ? 1 : 0.7);
    }
    const shinA = Math.max(0, -Math.cos(this.walkPh)) * (0.8 + 0.5 * run) * walkK, shinB = Math.max(0, Math.cos(this.walkPh)) * (0.8 + 0.5 * run) * walkK;
    u.legs[0].thigh.rotation.x = damp(u.legs[0].thigh.rotation.x, sw * (1 - st) + 0.36 * st, 20, dt);
    u.legs[1].thigh.rotation.x = damp(u.legs[1].thigh.rotation.x, -sw * (1 - st) - 0.48 * st, 20, dt);
    u.legs[0].shin.rotation.x = shinA * (1 - st) + 0.22 * st;
    u.legs[1].shin.rotation.x = shinB * (1 - st) + 0.5 * st;
    // stride weight: hips swing and roll with each step, the torso counter-twists below
    u.hips.rotation.y = Math.sin(this.walkPh) * 0.11 * walkK * (1 - st);
    u.hips.rotation.z = Math.cos(this.walkPh) * 0.035 * walkK;
    u.hips.position.x = Math.cos(this.walkPh) * 0.018 * walkK;
    // lean into turns
    const dFace = angleDiff(this.lastFace, this.face) / Math.max(dt, 1e-3); this.lastFace = this.face;
    this.turnLean = damp(this.turnLean, clamp(-dFace * 0.035 * walkK, -0.22, 0.22), 8, dt);
    let crouch = this.state === 'attack' ? 0.06 : 0, lean = 0.12;
    if (this.state === 'attack' && this.atk.heavy) {
      // heavy: sink the hips and lean back through the wind-up, then throw the weight forward
      const T = this.t * (1 + this.stats.aspd / 100), [tw, ta] = this.atk.t;
      const w = smooth(clamp(T / tw, 0, 1)), r = clamp((T - tw) / (ta + 0.12), 0, 1);
      crouch = T < tw ? 0.06 + 0.1 * w : 0.16 - 0.08 * r;
      lean = T < tw ? 0.12 - 0.3 * w : -0.18 + 0.58 * Math.sin(Math.min(1, r * 1.4) * Math.PI * 0.5) - 0.18 * clamp((T - tw - ta) / 0.3, 0, 1);
    }
    this.atkLean = lean;
    u.hips.position.y = 1.02 + Math.abs(Math.cos(this.walkPh)) * 0.04 * Math.min(1, spd / 4) - crouch;
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
      const calm = this.state === 'move' && spd < 0.3 && !this.game.lockTarget && !this.game.enemies.some((e) => !e.dead && e.aggro);
      this.restT = calm ? this.restT + dt : 0;
      const resting = this.restT > 2.2;
      const base = spd > 5 ? RUN : resting ? REST : IDLE;
      const tgt = this.state === 'dodge' ? RUN : base;
      const rate = resting ? 3.5 : 10;
      this.pose.g.lerp(tgt.g, 1 - Math.exp(-rate * dt));
      this.pose.d.lerp(tgt.d, 1 - Math.exp(-rate * dt)).normalize();
      if (resting) this.edgeDir.lerp(tmpC.set(0, 0, 1), 1 - Math.exp(-4 * dt)).normalize();
      this.pose.tw = damp(this.pose.tw, tgt.tw + (spd > 0.5 ? Math.sin(this.walkPh) * 0.06 : 0), 10, dt);
      // idle breathing
      this.pose.g.y += Math.sin(this.t * 2) * 0.0015;
    }
    u.torso.rotation.y = this.pose.tw - u.hips.rotation.y * 0.8;
    u.torso.rotation.x = this.state === 'attack' ? this.atkLean : 0.04 + 0.15 * run + (this.restT > 2.2 ? 0.03 : 0);
    // idle breathing: chest rises, helm dips a touch
    const br = Math.sin(this.t * 1.9) * (spd < 0.5 && this.state !== 'attack' ? 1 : 0.3);
    u.torso.position.y = 0.12 + br * 0.006;
    u.head.rotation.x = -0.035 * br + (this.restT > 2.2 ? 0.12 : 0);
    // dodge roll
    if (this.state === 'dodge') {
      const k = clamp(this.t / 0.52, 0, 1);
      u.body.rotation.x = smooth(k) * Math.PI * 2;
      u.body.position.y = -Math.sin(k * Math.PI) * 0.45;
      u.body.rotation.z = 0;
    } else { u.body.rotation.z = this.state === 'dead' ? 0 : this.turnLean; u.body.rotation.x = this.state === 'dead' ? damp(u.body.rotation.x, -1.45, 6, dt) : 0; u.body.position.y = this.state === 'dead' ? damp(u.body.position.y, -0.75, 6, dt) : 0; }
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
    if (this.skin) this.updateSkin(dt, spd);
    if (this.wpn) for (const m of this.wpn.channel) { m.emissive?.setRGB(1, 0.05, 0.12); if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 3.5 * (this.u.sword.userData.awake ?? 1); }
  }
  // Logical animation state -> clip (Mixamo-style names mapped in assets.js / the manifest), then hand the blade to the rig.
  updateSkin(dt, spd) {
    const A = this.skin.anim;
    if (A) {
      if (this.state === 'dead') A.play('death', { once: true, fade: 0.25 });
      else if (this.state === 'dodge') A.play('dodge', { once: true, fade: 0.08 });
      else if (this.state === 'hurt') A.play('hit', { once: true, fade: 0.08 });
      else if (this.state === 'attack') {
        const kind = this.atk?.kind, k = kind === 'heavy' ? 'heavy' : kind === 'l3' ? 'attack3' : kind === 'l2' ? 'attack2' : 'attack';
        const fresh = this.atk !== this.skinAtk || this.t < this.lastSkinT; this.skinAtk = this.atk; this.lastSkinT = this.t;
        A.play(k, { once: true, fade: 0.08, restart: fresh, speed: 1 + this.stats.aspd / 100 });
      } else if (spd > 5) A.play('run', { speed: spd / 6.6 });
      else if (spd > 0.35) A.play('walk', { speed: Math.max(0.6, spd / 2.6) });
      else A.play('idle');
      A.update(dt);
    }
    this.skinState = A?.state || 'static';
    if (this.hand) { // put the Synthblade in the GLB's right hand
      const u = this.u, sw = u.sword;
      this.skin.root.updateMatrixWorld(true);
      const hp = this.hand.getWorldPosition(tmpA), hq = this.hand.getWorldQuaternion(new THREE.Quaternion()).multiply(this.gripQ);
      hp.add(tmpB.copy(this.gripO).applyQuaternion(hq));
      u.torso.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(u.torso.matrixWorld).invert();
      const m = new THREE.Matrix4().compose(hp, hq, tmpC.set(1, 1, 1)).premultiply(inv);
      m.decompose(sw.position, sw.quaternion, tmpC);
    }
  }
  // Tattered cape: a small verlet cloth pinned under the pauldrons, simulated in world space so it
  // trails behind movement, rolls and turns; kept behind the back/legs with a cheap body proxy.
  simCape(dt, spd) {
    const u = this.u, cape = u.cape, geo = cape.geometry, pa = geo.attributes.position, rest = u.capeRest;
    const W = u.capeSim.cols + 1, n = pa.count;
    cape.updateWorldMatrix(true, false);
    const mw = cape.matrixWorld, v = tmpA;
    const c = this.cloth;
    if (!c || dt <= 0) {
      if (!c) {
        const P = new Float32Array(n * 3), Q = new Float32Array(n * 3), cons = [];
        for (let i = 0; i < n; i++) { v.fromArray(rest, i * 3).applyMatrix4(mw); v.toArray(P, i * 3); v.toArray(Q, i * 3); }
        const L = (a, b) => Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
        for (let i = 0; i < n; i++) {
          const x = i % W;
          if (x < W - 1) cons.push(i, i + 1, L(i, i + 1));
          if (i + W < n) cons.push(i, i + W, L(i, i + W));
          if (i + 2 * W < n) cons.push(i, i + 2 * W, -L(i, i + 2 * W)); // negative = stretch-only link
        }
        this.cloth = { P, Q, cons, inv: new THREE.Matrix4() };
      }
      return;
    }
    const { P, Q, cons, inv } = c;
    // teleports (respawn, cutscene jumps): snap the cloth back to rest
    v.fromArray(rest, 0).applyMatrix4(mw);
    if (v.distanceToSquared(tmpB.fromArray(P, 0)) > 1.5) { this.cloth = null; return this.simCape(0, spd); }
    inv.copy(mw).invert();
    const steps = dt > 1 / 40 ? 2 : 1, h = Math.min(dt, 0.05) / steps, t = this.t;
    const wk = (this.titleMode ? 0.5 + spd * 0.5 : 0.35) * 2.2;
    const wx = (Math.sin(t * 0.7) * 0.6 + Math.sin(t * 2.3) * 0.3) * wk, wz = (Math.cos(t * 0.5) * 0.5 - 0.4) * wk;
    const fr = Math.pow(0.965, h * 60);
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        if (i < W) { v.fromArray(rest, k).applyMatrix4(mw); P[k] = Q[k] = v.x; P[k + 1] = Q[k + 1] = v.y; P[k + 2] = Q[k + 2] = v.z; continue; }
        const fl = Math.sin(t * 7 + i * 0.7) * 0.8 * wk;
        for (let a = 0; a < 3; a++) {
          const cur = P[k + a], vel = (cur - Q[k + a]) * fr;
          Q[k + a] = cur;
          P[k + a] = cur + vel + (a === 1 ? -9.8 : a === 0 ? wx + fl : wz + fl * 0.5) * h * h;
        }
      }
      for (let it = 0; it < 3; it++) {
        for (let q = 0; q < cons.length; q += 3) {
          const a = cons[q] * 3, b = cons[q + 1] * 3;
          let len = cons[q + 2];
          const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          if (len < 0) { len = -len; if (d < len) continue; }
          const diff = (d - len) / d;
          const pinA = cons[q] < W, pinB = cons[q + 1] < W;
          const wa = pinA ? 0 : pinB ? 1 : 0.5, wb = pinB ? 0 : pinA ? 1 : 0.5;
          P[a] += dx * diff * wa; P[a + 1] += dy * diff * wa; P[a + 2] += dz * diff * wa;
          P[b] -= dx * diff * wb; P[b + 1] -= dy * diff * wb; P[b + 2] -= dz * diff * wb;
        }
      }
    }
    // body proxy (cape-local space = torso space shifted): stay behind the back and the legs
    for (let i = W; i < n; i++) {
      const k = i * 3;
      v.set(P[k], Math.max(P[k + 1], this.pos.y + 0.03), P[k + 2]).applyMatrix4(inv);
      const ax = Math.abs(v.x);
      let zl = v.y > -0.75 ? (ax < 0.29 ? 0.215 - 0.177 * Math.sqrt(1 - (ax / 0.29) ** 2) - 0.03 : 0.3) : 0.07;
      if (v.y > -0.2 && ax > 0.2) zl = Math.min(zl, 0.06); // under the pauldrons
      if (v.z > zl) v.z = zl;
      pa.setXYZ(i, v.x, v.y, v.z);
      v.applyMatrix4(mw); P[k] = v.x; P[k + 1] = v.y; P[k + 2] = v.z;
    }
    for (let i = 0; i < W; i++) pa.setXYZ(i, rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
    pa.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  capeAndBlade(dt, spd, act) {
    const u = this.u;
    this.simCape(dt, spd);
    // blade: Dormant out of combat (channel dark), Awakened in combat (contained barrier in the channel).
    // No ritual or tutorial: it simply wakes when the Warden fights and settles a few seconds after.
    const sw2 = u.sword.userData;
    const want = this.titleMode || this.wantsAwake() ? 1 : 0;
    if (want) this.calmT = 0; else this.calmT = (this.calmT || 0) + dt;
    const target = want || this.calmT < 2.5 ? 1 : 0;
    if (this.forceAwake != null) this.bladeAwake = this.forceAwake; // tests / screenshots
    else this.bladeAwake = (this.bladeAwake ?? 0) + (target - (this.bladeAwake ?? 0)) * Math.min(1, dt * (target ? 5 : 1.6));
    sw2.setAwake(this.bladeAwake);
    const aw = sw2.awake;
    let heat = 0;
    if (this.state === 'attack' && this.atk?.heavy) heat = clamp(this.t * (1 + this.stats.aspd / 100) / this.atk.t[0], 0, 1);
    if (this.riposte > 0) heat = Math.max(heat, 0.6 + 0.4 * Math.sin(this.t * 18));
    heat *= aw;
    sw2.light.intensity = aw * (1.6 + act * 2.5 + heat * 5) * (0.9 + 0.1 * Math.random());
    if (aw > 0.25 && Math.random() < 0.25 + act * 0.5) sw2.crackle(0.4 + act * 0.8 + heat * 0.5); else sw2.arcs.geometry.setDrawRange(0, 0);
    sw2.tick(dt, this.t, act * aw, heat);
    // trail sample
    if (this.titleMode) { u.visorMat.color.setRGB(1.25, 0.015, 0.04); return; }
    const b = u.sword.localToWorld(tmpA.copy(sw2.baseLocal));
    const tp = u.sword.localToWorld(tmpB.copy(sw2.tipLocal));
    const cutting = this.state === 'attack' && this.t * (1 + this.stats.aspd / 100) >= this.atk.t[0] * 0.75;
    this.game.fx.trailPush(b, tp, cutting && this.bladeSpeed > 3 && aw > 0.5);
    audio.setHum(Math.min(1, this.bladeSpeed / 15));
    this.lastTip.copy(tp);
    if (this.skin) this.skin.flash(this.hurtT > 0 ? 0.6 : 0);
    // hurt flash on visor
    u.visorMat.color.setRGB(this.hurtT > 0 ? 3.2 : 1.25, this.hurtT > 0 ? 0.6 : 0.015, this.hurtT > 0 ? 0.2 : 0.04); // deep red T-visor (cover art)
  }
  bladeTip() { return this.lastTip; }
  // In combat: swinging, dodging, riposte window, locked on, or an aggressive abomination close by.
  wantsAwake() {
    if (this.state === 'attack' || this.state === 'dodge' || this.riposte > 0 || this.game.lockTarget) return true;
    for (const e of this.game.enemies || []) if (!e.dead && e.aggro && e.pos.distanceTo(this.pos) < 16) return true;
    return false;
  }
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
