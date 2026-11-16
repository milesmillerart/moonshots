// Abominations (street slang: "the Rot"; their origin is unknown in canon): Husk, Skitter, Bile Spitter, the Bellwright.
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { buildEnemy } from './models.js';
import { ENEMIES } from './data.js';
import { moveCircle } from './world.js';
import { angleDiff, clamp, dampAngle, rand } from './util.js';
import { audio } from './audio.js';

let NEXT = 1;
export class Enemy {
  constructor(game, type, pos, level = 1) {
    this.game = game; this.type = type; this.def = ENEMIES[type]; this.id = NEXT++;
    this.model = buildEnemy(type); this.u = this.model.userData;
    this.pos = this.model.position; this.pos.copy(pos);
    this.level = level;
    const k = 1 + 0.14 * (level - 1);
    this.maxHp = Math.round(this.def.hp * k); this.hp = this.maxHp; this.dmg = this.def.dmg * (1 + 0.1 * (level - 1));
    this.face = rand(0, 6.28); this.state = 'idle'; this.t = rand(0, 1); this.cd = rand(0.5, 1.5);
    this.poise = 0; this.flash = 0; this.dead = false; this.deadT = 0; this.ph = rand(0, 10);
    this.burn = 0; this.burnDps = 0; this.aggro = false; this.vel = new THREE.Vector3();
    this.phase2 = false; this.home = pos.clone(); this.react = 0; this.reactSide = 1;
    game.scene.add(this.model);
  }
  get elite() { return !!this.def.elite; }

  hurt(dmg, from, poiseDmg, crit) {
    if (this.dead) return;
    this.hp -= dmg; this.flash = 0.12; this.aggro = true;
    this.react = Math.min(1.4, (this.react > 0.3 ? this.react : 0) + 0.7 + poiseDmg * 0.12 + (crit ? 0.25 : 0)); this.reactSide = Math.random() < 0.5 ? -1 : 1;
    this.poise += poiseDmg;
    const away = this.pos.clone().sub(from).setY(0).normalize();
    if (!this.elite) this.vel.addScaledVector(away, 3 + poiseDmg);
    if (this.poise >= this.def.poise && this.state !== 'stagger') {
      this.poise = 0; this.state = 'stagger'; this.t = 0; this.telegraphing = false;
      if (this.elite) this.game.ui.toast('STAGGERED', 'red');
    }
    if (this.hp <= 0) this.die();
  }
  die() {
    this.dead = true; this.state = 'dead'; this.t = 0;
    audio.growl(this.elite ? 0.5 : 1.2);
    this.game.onEnemyKilled(this);
  }
  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt; this.ph += dt; this.flash -= dt; this.cd -= dt; this.react = Math.max(0, this.react - dt * 5);
    this.poise = Math.max(0, this.poise - dt * (this.elite ? 4 : 1.5));
    // material flash / glow
    const f = this.flash > 0 ? 1 : 0;
    this.u.flesh.emissive.setRGB(f * 1.5, f * 1.4, f * 1.4);
    const vein = this.telegraphing ? 4.5 : 1.5 + Math.sin(this.ph * 3) * 0.3;
    this.u.vein.color.setRGB(0.3 * vein / 2.4, vein, vein * 0.88);
    if (this.dead) {
      this.deadT += dt;
      if (!this.shadowOff) { this.shadowOff = true; this.model.traverse((o) => { if (o.isMesh) o.castShadow = false; }); }
      this.model.rotation.x = Math.min(1.4, this.deadT * 4) * (this.type === 'skitter' ? 0 : 1);
      this.model.position.y = -Math.max(0, this.deadT - 1.2) * 0.25;
      if (this.type === 'skitter') this.model.rotation.z = Math.min(3.1, this.deadT * 8);
      // the Rot lets go: flesh burns away from the inside in a teal-edged dissolve, shedding motes
      const big = this.type === 'bellwright', k = clamp((this.deadT - (big ? 0.6 : 0.3)) / (big ? 2.2 : 1.4), 0, 1);
      this.u.dissolve.value = k * 1.02;
      if (k > 0 && k < 1 && Math.random() < (g.isTouch ? 0.35 : 0.8)) {
        const s = big ? 2.3 : 1;
        g.fx.burst(this.pos.clone().add(new THREE.Vector3(rand(-0.4, 0.4) * s, rand(0.15, 1.1) * s, rand(-0.4, 0.4) * s)), big ? 3 : 2, 0x46f0e0, 0.5, 1.4, 0.7);
      }
      return this.deadT < (big ? 3.2 : 2.0);
    }
    if (this.burn > 0) {
      this.burn -= dt; this.hp -= this.burnDps * dt;
      if (Math.random() < 0.3) g.fx.burst(this.pos.clone().setY(1 + Math.random()), 1, 0xff6a2a, 1, 2, 0.4);
      if (this.hp <= 0) { this.die(); return true; }
    }
    const toP = p.pos.clone().sub(this.pos); toP.y = 0;
    const dist = toP.length();
    const want = Math.atan2(toP.x, toP.z);
    if (!this.aggro && dist < (this.elite ? 26 : 17) && p.state !== 'dead' && g.combatOn) { this.aggro = true; audio.growl(this.elite ? 0.5 : 1); }
    if (p.state === 'dead' || !g.combatOn) this.aggro = false;
    // separation
    for (const o of g.enemies) {
      if (o === this || o.dead) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = this.def.radius + o.def.radius;
      if (d < m && d > 0.001) moveCircle(this.pos, (dx / d) * (m - d) * 0.5, (dz / d) * (m - d) * 0.5, this.def.radius);
    }
    // knockback
    moveCircle(this.pos, this.vel.x * dt, this.vel.z * dt, this.def.radius);
    this.vel.multiplyScalar(Math.pow(0.004, dt));
    const T = this.type;
    if (this.state === 'stagger') {
      if (this.t > (this.elite ? 1.4 : 0.7)) { this.state = 'chase'; this.t = 0; }
    } else if (!this.aggro) {
      // idle wander near home
      if (this.state !== 'wander' || this.t > 3) { this.state = 'wander'; this.t = 0; this.wdir = rand(0, 6.28); this.wmove = Math.random() < 0.5; }
      if (this.wmove) {
        this.face = dampAngle(this.face, this.wdir, 3, dt);
        const back = this.pos.distanceTo(this.home) > 6;
        if (back) this.wdir = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
        moveCircle(this.pos, Math.sin(this.face) * 0.8 * dt, Math.cos(this.face) * 0.8 * dt, this.def.radius);
      }
    } else if (this.state === 'windup' || this.state === 'attack' || this.state === 'recover') {
      this.attackUpdate(dt, dist, want, toP);
    } else {
      // chase / position
      this.state = 'chase';
      this.face = dampAngle(this.face, want, T === 'skitter' ? 10 : 5, dt);
      let sp = this.def.speed * (this.phase2 ? 1.35 : 1);
      let dir = 1;
      if (T === 'spitter') { if (dist < 6) dir = -1; else if (dist < this.def.range) dir = 0; }
      const stop = T === 'skitter' ? 3.5 : this.def.range * 0.75;
      if (T !== 'spitter' && dist < stop) dir = 0;
      // circle-strafe a little when close
      const strafe = Math.sin(this.ph * 0.7 + this.id) * (dist < 6 ? 0.6 : 0);
      const fx = Math.sin(this.face), fz = Math.cos(this.face);
      moveCircle(this.pos, (fx * dir + fz * strafe) * sp * dt, (fz * dir - fx * strafe) * sp * dt, this.def.radius);
      if (this.cd <= 0 && dist < this.def.range && Math.abs(angleDiff(this.face, want)) < 0.6) this.beginAttack(dist);
    }
    this.model.rotation.y = this.face;
    this.animate(dt);
    return true;
  }
  beginAttack(dist) {
    this.state = 'windup'; this.t = 0; this.telegraphing = true; this.hitDone = false;
    const T = this.type;
    if (T === 'bellwright') {
      const r = Math.random();
      this.move = dist > 7 ? 'charge' : r < (this.phase2 ? 0.45 : 0.3) ? 'slam' : 'swipe';
      this.windT = { swipe: 0.75, slam: 1.15, charge: 0.85 }[this.move] * (this.phase2 ? 0.8 : 1);
      if (this.move === 'slam') { this.game.fx.telegraph(this.pos.clone(), 3.2, this.windT, 0xff2040); audio.bell(); }
      if (this.move === 'charge') this.chargeDir = Math.atan2(this.game.player.pos.x - this.pos.x, this.game.player.pos.z - this.pos.z);
    } else this.windT = { husk: 0.6, skitter: 0.45, spitter: 0.7 }[T];
    audio.growl(T === 'bellwright' ? 0.45 : T === 'skitter' ? 1.8 : 1);
  }
  attackUpdate(dt, dist, want, toP) {
    const g = this.game, p = g.player, T = this.type;
    if (this.state === 'windup') {
      if (T !== 'bellwright' || this.move !== 'charge') this.face = dampAngle(this.face, want, 4, dt);
      if (this.t >= this.windT) { this.state = 'attack'; this.t = 0; this.telegraphing = false;
        if (T === 'spitter') this.spit(); if (T === 'skitter') this.leapDir = this.face;
        if (T === 'bellwright' && this.move === 'slam') this.slam();
      }
    } else if (this.state === 'attack') {
      const fx = Math.sin(this.face), fz = Math.cos(this.face);
      if (T === 'husk' || (T === 'bellwright' && this.move === 'swipe')) {
        moveCircle(this.pos, fx * 2 * dt, fz * 2 * dt, this.def.radius);
        if (!this.hitDone && this.t > 0.05 && dist < this.def.range + 0.3 && Math.abs(angleDiff(this.face, want)) < 1.2) {
          this.hitDone = true; p.takeHit(this.dmg, this.pos, T === 'bellwright' ? 9 : 4);
        }
        if (this.t > 0.22) this.endAttack(T === 'bellwright' ? 0.9 : 1.3);
      } else if (T === 'skitter') {
        moveCircle(this.pos, Math.sin(this.leapDir) * 13 * dt, Math.cos(this.leapDir) * 13 * dt, this.def.radius);
        if (!this.hitDone && dist < 1.1) { this.hitDone = true; p.takeHit(this.dmg, this.pos, 3); }
        if (this.t > 0.38) this.endAttack(1.6);
      } else if (T === 'spitter') { if (this.t > 0.3) this.endAttack(2.4); }
      else if (T === 'bellwright' && this.move === 'charge') {
        moveCircle(this.pos, Math.sin(this.chargeDir) * 14 * dt, Math.cos(this.chargeDir) * 14 * dt, this.def.radius);
        this.face = this.chargeDir;
        if (!this.hitDone && dist < 2.6) { this.hitDone = true; p.takeHit(this.dmg * 0.9, this.pos, 10); }
        if (Math.random() < 0.5) g.fx.burst(this.pos.clone().setY(0.2), 2, 0x8899aa, 3, 1, 0.4);
        if (this.t > 0.7) this.endAttack(1.0);
      } else if (T === 'bellwright' && this.move === 'slam') { if (this.t > 0.4) this.endAttack(1.2); }
    } else if (this.state === 'recover') {
      if (this.t > this.recT) { this.state = 'chase'; this.t = 0; }
    }
    void toP;
  }
  endAttack(cd) { this.state = 'recover'; this.t = 0; this.recT = 0.35; this.cd = cd * rand(0.8, 1.3); }
  spit() {
    audio.spit();
    const g = this.game, p = g.player;
    const from = this.pos.clone().setY(1.6);
    const tgt = p.pos.clone().addScaledVector(p.vel, 0.5);
    g.spawnProjectile(from, tgt, this.dmg);
  }
  slam() {
    const g = this.game;
    g.fx.ring(this.pos.clone(), 9, 0.8, 0xff3050);
    g.fx.burst(this.pos.clone().setY(0.3), 40, 0x8899aa, 9, 2, 0.8);
    g.shake(0.6);
    g.shockwaves.push({ c: this.pos.clone(), t: 0, dur: 0.8, maxR: 9, dmg: this.dmg * 1.35, hit: false });
    audio.bell();
  }
  animate(dt) {
    const u = this.u, T = this.type;
    const moving = this.state === 'chase' || (this.state === 'wander' && this.wmove) || (this.state === 'attack' && T !== 'spitter');
    const sp = moving ? (T === 'skitter' ? 18 : 7) : 2;
    const ph = this.ph * sp;
    const wk = this.state === 'windup' ? clamp(this.t / this.windT, 0, 1) : 0;
    for (const l of u.limbs) {
      if (T === 'skitter') {
        const g = ph + l.i * 2 + (l.side > 0 ? 1 : 0);
        l.g.rotation.y = Math.sin(g) * 0.4;
        l.g.rotation.z = -l.side * (Math.max(0, Math.cos(g)) * (moving ? 0.28 : 0.04) + (this.state === 'windup' ? 0.25 * wk : 0));
      } else if (l.arm) {
        let base = Math.sin(ph * 0.5 + (l.side > 0 ? Math.PI : 0)) * 0.3 - 0.2, bend = -0.35 + Math.sin(ph * 0.5 + l.side) * 0.12;
        if (this.state === 'windup') { base = -2.2 * wk; bend = -0.2 - 0.9 * wk; }
        if (this.state === 'attack') { base = 0.9; bend = -0.05; }
        if (this.state === 'stagger') bend = -0.9;
        l.g.rotation.x = base;
        if (l.fore) l.fore.rotation.x = bend;
      } else {
        const g = ph * 0.5 + (l.side > 0 ? Math.PI : 0);
        l.g.rotation.x = Math.sin(g) * (moving ? 0.5 : 0.05);
        if (l.shin) l.shin.rotation.x = 0.12 + Math.max(0, -Math.cos(g)) * (moving ? 0.7 : 0.05);
      }
    }
    // jaws gape on the wind-up, mandibles clack, the head twitches like something is wrong with it
    if (u.jaw) u.jaw.rotation.x = this.state === 'windup' ? 0.55 * wk : this.state === 'attack' ? 0.6 : 0.1 + 0.07 * Math.sin(this.ph * 2.2);
    if (u.mand) for (const m of u.mand) m.g.rotation.y = m.side * (this.state === 'windup' ? 0.55 * wk : 0.15 + 0.2 * Math.abs(Math.sin(this.ph * 6)));
    if (u.head) u.head.rotation.z = Math.sin(this.ph * 2.3) * 0.1 + (Math.sin(this.ph * 5.7 + this.id) > 0.96 ? 0.3 : 0);
    if (u.clapper) u.clapper.position.z = -0.04 + Math.sin(this.ph * 2.6) * 0.04;
    if (u.body) {
      u.body.rotation.z = Math.sin(this.ph * 1.3) * 0.06;
      if (this.state === 'windup') u.body.rotation.x = -0.25 * clamp(this.t / this.windT, 0, 1);
      else if (this.state === 'attack') u.body.rotation.x = 0.3;
      else if (this.state === 'stagger') u.body.rotation.x = -0.4 + Math.sin(this.t * 20) * 0.05;
      else u.body.rotation.x *= 0.85;
      if (T === 'spitter') { const s = 1 + Math.sin(this.ph * 2) * 0.04 + (this.state === 'windup' ? 0.15 * this.t / this.windT : 0); u.body.scale.set(s, s, s); }
    }
    // hit-react: snap back from the blow, twist off-line, squash, then settle
    const r = this.react * this.react * (this.elite ? 0.35 : 1);
    this.model.rotation.x = -0.32 * r;
    this.model.rotation.z = 0.16 * r * this.reactSide;
    if (u.head) u.head.rotation.x = (u.headBase || 0) - 0.6 * r;
    if (T !== 'spitter' && u.body) { const sq = 0.09 * r; u.body.scale.set(1 + sq, 1 - sq, 1 + sq); }
    if (u.bellMat) u.bellMat.emissive.setRGB(this.telegraphing ? 1.2 : 0.05, this.telegraphing ? 0.1 : 0.02, 0.05);
  }
  dispose() { this.game.scene.remove(this.model); }
}

export class Projectile {
  constructor(game, from, to, dmg) {
    this.game = game; this.dmg = dmg;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 3, 2.4), toneMapped: false }));
    m.position.copy(from); game.scene.add(m); this.m = m;
    const flat = to.clone().sub(from); flat.y = 0;
    const T = clamp(flat.length() / 11, 0.4, 1.3);
    this.v = flat.divideScalar(T); this.v.y = (to.y + 0.3 - from.y) / T + 0.5 * 18 * T;
    this.life = 3;
  }
  update(dt) {
    this.v.y -= 18 * dt; this.m.position.addScaledVector(this.v, dt); this.life -= dt;
    if (Math.random() < 0.6) this.game.fx.burst(this.m.position, 1, 0x46f0e0, 0.5, 0, 0.3);
    if (this.m.position.y <= 0.1 || this.life <= 0) {
      const p = this.game.player;
      this.game.fx.burst(this.m.position.clone().setY(0.2), 26, 0x46f0e0, 4, 2, 0.6);
      this.game.fx.ring(this.m.position.clone(), 1.8, 0.4, 0x46f0e0);
      if (p.pos.distanceTo(this.m.position.clone().setY(0)) < 1.7) p.takeHit(this.dmg, this.m.position, 3);
      this.game.scene.remove(this.m); return false;
    }
    return true;
  }
}
