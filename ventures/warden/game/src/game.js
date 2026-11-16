// Game orchestration: states, story, waves, combat resolution, loot, saving.
import * as THREE from '../vendor/three-warden.r187.min.js';
import { buildWorld, POI, walkable } from './world.js';
import { buildWarden, buildPerson, buildLoot } from './models.js';
import { Player, posePoster } from './player.js';
import { Enemy, Projectile } from './enemies.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import { STORY, RARITIES, CORES, PERKS, TIER_REQ } from './data.js';
import { computeStats, starterGear, randomGear, makeItem, makeCore, itemName, effectiveRarity, upgradeCost, salvageValue, MAX_UPGRADE } from './items.js';
import { angleDiff, clamp, damp, dampAngle, rand, randi, pick } from './util.js';

const SAVE_KEY = 'warden.save.v1', SET_KEY = 'warden.settings.v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  constructor(renderer, composer, bloom, scene, camera) {
    Object.assign(this, { renderer, composer, bloom, scene, camera });
    this.settings = Object.assign({ bloom: true, shadows: true, invertY: false, sens: 1, scale: 1, mute: false }, JSON.parse(localStorage.getItem(SET_KEY) || '{}'));
    audio.setMuted(this.settings.mute);
    bloom.enabled = this.settings.bloom;
    renderer.shadowMap.enabled = this.settings.shadows;
    this.world = buildWorld(scene, renderer, { shadows: this.settings.shadows });
    this.fx = new FX(scene, camera);
    this.ui = new UI(this);
    this.player = new Player(this);
    scene.add(this.player.model);
    this.enemies = []; this.projectiles = []; this.loot = []; this.shockwaves = [];
    this.time = 0; this.hitstop = 0; this.shakeAmt = 0;
    this.slow = null; this.fov = 58;
    this.camYaw = Math.PI; this.camPitch = 0.26; this.camDist = 5.4;
    this.keys = {}; this.edge = {}; this.state = 'title'; this.started = false;
    this.lockTarget = null; this.combatOn = false; this.save = null;
    this.stats = computeStats({ equip: {}, perks: {}, level: 1 });
    this.bladeRarity = 0;
    // Soft cool fill that follows the lens so black plate still reads against the night.
    this.fill = new THREE.PointLight(0x9fb6e0, 4, 9, 1.6); scene.add(this.fill);
    this.rim = new THREE.PointLight(0xff3060, 2.2, 6, 2); scene.add(this.rim);
    // Statue of the first Warden in Statute Plaza.
    const statue = buildWarden({ statue: true }); statue.scale.setScalar(2.1); statue.position.set(0, 2.0, 0); statue.rotation.y = Math.PI * 0.85;
    scene.add(statue); posePoster(statue);
    // Story cast
    this.brann = buildPerson({ coat: 0x2b2a2e, hood: false, lantern: true });
    this.mira = buildPerson({ coat: 0x3a2c24, kneel: true });
    this.watch = buildPerson({ coat: 0x1f2226, hood: false });
    this.brann.position.set(1.7, 0, 44.6); this.mira.position.set(0, 0, 45.0); this.watch.position.set(-1.6, 0, 44.9);
    for (const n of [this.brann, this.mira, this.watch]) scene.add(n);
    this.cacheMarker = buildLoot('#ffb547', false, 2); this.cacheMarker.position.copy(POI.cache); scene.add(this.cacheMarker);
    fetch('data/changelog.json').then((r) => r.json()).then((j) => (this.changelog = j)).catch(() => (this.changelog = []));
    this.bindInput();
  }
  // ---- save -------------------------------------------------------------------
  hasSave() { try { return !!JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return false; } }
  loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } }
  persist() {
    if (!this.save) return;
    this.save.pos = [this.player.pos.x, this.player.pos.z];
    this.save.hp = this.player.hp;
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
  }
  perk(id) { return this.save?.perks[id] || 0; }
  refreshStats() {
    this.stats = computeStats(this.save);
    this.player.hp = Math.min(this.player.hp, this.stats.hp);
    this.bladeRarity = this.save.equip.blade ? effectiveRarity(this.save.equip.blade) : 0;
  }
  xpNeed() { return Math.round(60 * Math.pow(this.save.level, 1.45)); }
  overloadCost() { return this.perk('overclock') ? 50 : 100; }

  // ---- flow -------------------------------------------------------------------
  boot() {
    const s = this.loadSave();
    this.ui.showTitle(!!s, s ? `Warden ${s.name} · Level ${s.level}` : '');
    this.state = 'title';
    this.player.pos.set(0, 0, 30); this.player.face = 0; posePoster(this.player.model);
  }
  toTitle() {
    this.persist(); this.ui.screen = null; this.ui.panel.classList.add('hidden');
    for (const e of this.enemies) e.dispose(); this.enemies = [];
    for (const l of this.loot) this.scene.remove(l.m); this.loot = [];
    this.started = false; this.combatOn = false; this.boss = null;
    this.boot();
  }
  newGame(name) {
    localStorage.removeItem(SAVE_KEY);
    this.save = { v: 1, name, level: 1, xp: 0, points: 1, perks: {}, equip: starterGear(), bag: [], scrap: 0, stims: 3, trait: null,
      flags: {}, created: Date.now(), kills: 0 };
    this.refreshStats(); this.player.hp = this.stats.hp; this.player.sta = this.stats.sta;
    this.persist();
    this.ui.hideTitle();
    this.runIntro();
  }
  continueGame() {
    this.save = this.loadSave();
    if (!this.save) return;
    this.refreshStats(); this.player.hp = clamp(this.save.hp || this.stats.hp, 1, this.stats.hp); this.player.sta = this.stats.sta;
    this.ui.hideTitle();
    if (!this.save.flags.judged) { this.runIntro(); return; }
    this.hideCast();
    const p = this.save.pos;
    if (p && walkable(p[0], p[1])) this.player.pos.set(p[0], 0, p[1]); else this.player.pos.copy(POI.respawn);
    this.startPlay();
    this.resumeProgress();
  }
  hideCast() {
    this.watch.visible = false;
    if (this.save.trait === 'dread') { this.mira.visible = true; this.mira.rotation.set(-1.5, 0, 0); this.mira.position.set(0, 0.3, 45); }
    else this.mira.visible = false;
    this.brann.position.set(5, 0, 46.5); this.brann.rotation.y = -1.2;
  }
  startPlay() {
    this.state = 'play'; this.started = true; this.combatOn = true;
    this.ui.showHud(); this.camYaw = this.player.face;
  }
  async fade(on, ms = 500) { const f = document.getElementById('fade'); f.style.transition = `opacity ${ms}ms`; f.style.opacity = on ? '1' : '0'; await sleep(ms); }

  async runIntro() {
    this.state = 'story'; this.started = true; this.combatOn = false;
    const p = this.player;
    p.pos.copy(POI.judgment); p.face = Math.PI; p.state = 'move';
    this.mira.visible = this.watch.visible = this.brann.visible = true;
    this.mira.position.set(0, 0, 45.0); this.mira.rotation.set(0, 0, 0);
    this.brann.position.set(1.7, 0, 44.6); this.brann.rotation.set(0, 0.4, 0); this.watch.position.set(-1.6, 0, 44.9);
    this.cine = { pos: new THREE.Vector3(0, 9, 20), look: new THREE.Vector3(0, 6, -30) };
    await this.fade(false, 900);
    this.cine = { pos: new THREE.Vector3(2.5, 3.2, 36), look: new THREE.Vector3(0, 6, -40), drift: true };
    await this.ui.say(STORY.intro);
    this.cine = { pos: new THREE.Vector3(3.6, 1.9, 48.8), look: new THREE.Vector3(0, 1.0, 45.0) };
    const k = await this.ui.say(STORY.judgment, STORY.choices);
    const ch = STORY.choices[k];
    this.save.trait = ch.id; this.save.flags.judged = true; this.refreshStats(); this.persist();
    if (ch.id === 'dread') {
      p.startAttack('heavy'); p.sta = this.stats.sta;
      await sleep(420); audio.hit(true, true); this.fx.burst(new THREE.Vector3(0, 1.1, 45.3), 50, 0xff2050, 5, 2, 0.7); this.hitstop = 0.15;
      this.mira.rotation.x = -1.5; this.mira.position.y = 0.3;
      await sleep(500);
    }
    this.cine = { pos: new THREE.Vector3(-3.0, 1.7, 49.5), look: new THREE.Vector3(0, 1.5, 44) };
    await this.ui.say(ch.after);
    this.ui.toast(`Verdict trait: ${ch.id === 'dread' ? 'Dread' : ch.id === 'measure' ? 'Measure' : 'Inquest'}`, 'gold');
    audio.bell(); this.shake(0.3);
    this.cine = { pos: new THREE.Vector3(0.5, 2.4, 50), look: new THREE.Vector3(0, 2.5, 20) };
    await this.ui.say(STORY.breach);
    await this.fade(true, 300);
    this.hideCast();
    this.cine = null;
    this.camYaw = Math.PI; this.camPitch = 0.22;
    this.startPlay();
    this.spawnWave('A');
    await this.fade(false, 500);
    this.ui.toast('Click the game to capture the mouse. Esc to pause.');
  }

  // ---- waves & objectives --------------------------------------------------
  resumeProgress() {
    const f = this.save.flags;
    if (f.boss) { this.hunts = true; this.objective = 'Hunt the Rot. Temper your gear at the <b>Forge</b>.'; return; }
    if (f.waveC) { this.objective = 'Enter the <b>Grave Gate</b> court'; return; }
    if (f.waveB) { this.spawnWave('C'); return; }
    if (f.waveA) { this.objective = 'Purge <b>Statute Plaza</b>'; return; }
    this.spawnWave('A');
  }
  spawnWave(id) {
    const L = this.save.level;
    const at = (type, x, z, lvl = L, aggro = false) => { const e = new Enemy(this, type, new THREE.Vector3(x, 0, z), lvl); e.aggro = aggro; e.wave = id; this.enemies.push(e); return e; };
    this.wave = id;
    if (id === 'A') { at('husk', -2.5, 30, 1, true); at('husk', 2.5, 27, 1, true); at('husk', 0, 23, 1, true); this.objective = 'The Grave Gate is breached. Purge the Hollowed'; }
    if (id === 'B') { at('husk', -8, -3, L); at('husk', 9, 4, L); at('skitter', -4, -8, L); at('skitter', 5, -9, L); at('spitter', 0, -11, L); this.objective = 'Purge <b>Statute Plaza</b>'; }
    if (id === 'C') { at('husk', -3, -26, L); at('husk', 3, -31, L); at('spitter', 0, -42, L); at('skitter', -3, -46, L); at('skitter', 3, -48, L); at('husk', 0, -52, L); at('spitter', 4, -36, L); this.objective = 'Clear <b>Lantern Street</b> to the Grave Gate'; }
    if (id === 'BOSS') {
      this.boss = at('bellwright', 0, -78, Math.max(2, L), false);
      at('skitter', -6, -70, L); at('skitter', 6, -70, L);
      this.objective = 'Slay <b>the Bellwright</b>';
    }
  }
  waveAlive(id) { return this.enemies.some((e) => e.wave === id && !e.dead); }
  progress() {
    const f = this.save.flags, p = this.player.pos;
    if (this.wave === 'A' && !this.waveAlive('A') && !f.waveA) {
      f.waveA = true; this.persist(); this.objective = 'Push north into <b>Statute Plaza</b>';
      this.ui.toast('The street is clear. Push north.');
      if (!f.starterCore) { f.starterCore = true; this.dropAt(new THREE.Vector3(0, 0, 21), makeCore('arc', 1)); this.ui.toast('An Arc Core fell from the Hollowed. Install Cores at the Forge.', 'cyan'); }
    }
    if (f.waveA && !f.waveB && this.wave !== 'B' && p.z < 18) this.spawnWave('B');
    if (this.wave === 'B' && !this.waveAlive('B') && !f.waveB) {
      f.waveB = true; this.persist(); this.ui.banner('STATUTE PLAZA HELD', 'Use the Forge (east side of the plaza) to temper gear');
      this.objective = 'Visit the <b>Forge</b>, then clear <b>Lantern Street</b> north';
      setTimeout(() => this.spawnWave('C'), 1200);
    }
    if (this.wave === 'C' && !this.waveAlive('C') && !f.waveC) { f.waveC = true; this.persist(); this.objective = 'Enter the <b>Grave Gate</b> court'; }
    if (f.waveC && !f.boss && !this.boss && p.z < -58) { this.spawnWave('BOSS'); this.ui.say(STORY.bossIntro).then(() => { this.boss.aggro = true; }); this.ui.banner('THE BELLWRIGHT', 'Abomination of the Sump'); audio.bell(); }
    if (this.boss && !this.boss.dead && !this.boss.phase2 && this.boss.hp < this.boss.maxHp * 0.5) {
      this.boss.phase2 = true; this.ui.toast('The Bellwright tolls. More Rot answers.', 'red'); audio.bell();
      for (const x of [-5, 5]) { const e = new Enemy(this, 'skitter', new THREE.Vector3(x, 0, -84), this.save.level); e.aggro = true; e.wave = 'BOSS'; this.enemies.push(e); }
    }
    if (this.hunts) {
      this.huntT = (this.huntT || 0) - this.dtReal;
      const alive = this.enemies.filter((e) => !e.dead).length;
      if (this.huntT <= 0 && alive < 6) {
        this.huntT = 16;
        const zones = [[0, 30], [0, -30], [-12, 6], [12, -6], [0, -70], [-28, 0]];
        const [zx, zz] = pick(zones.filter(([x, z]) => Math.hypot(x - p.x, z - p.z) > 22));
        const n = randi(2, 4);
        for (let i = 0; i < n; i++) { const e = new Enemy(this, pick(['husk', 'husk', 'skitter', 'spitter']), new THREE.Vector3(zx + rand(-3, 3), 0, zz + rand(-3, 3)), this.save.level); e.wave = 'H'; this.enemies.push(e); }
      }
    }
  }

  // ---- combat -------------------------------------------------------------------
  aimTarget(p) {
    if (this.lockTarget && !this.lockTarget.dead) return this.lockTarget;
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.pos.distanceTo(p.pos) - e.def.radius;
      if (d > 4.5) continue;
      const a = Math.abs(angleDiff(this.camYaw, Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z)));
      const score = d + a * 2;
      if (a < 1.2 && score < bd) { bd = score; best = e; }
    }
    return best;
  }
  meleeCheck(p, A) {
    for (const e of this.enemies) {
      if (e.dead || p.hitSet.has(e.id)) continue;
      const to = e.pos.clone().sub(p.pos); to.y = 0;
      const d = to.length() - e.def.radius * (e.elite ? 2.3 / 1.5 : 1);
      if (d > A.range) continue;
      const ang = Math.abs(angleDiff(p.face, Math.atan2(to.x, to.z)));
      if (ang > A.arc && !(A.heavy && this.perk('cleave') && d < A.range)) continue;
      p.hitSet.add(e.id);
      this.hitEnemy(e, A);
    }
  }
  hitEnemy(e, A, src = 'blade', mult = 1) {
    const s = this.stats, p = this.player;
    let dmg = s.dmgFinal * (A ? A.mult : 1) * mult;
    if (A?.finisher && this.perk('momentum')) dmg *= 1.6;
    if (A?.riposte) dmg *= 1.5;
    if (e.hp / e.maxHp < 0.35) dmg *= 1 + 0.25 * this.perk('executioner');
    const crit = !!A?.riposte || Math.random() * 100 < s.crit;
    if (crit) dmg *= 1 + s.critDmg / 100;
    dmg *= rand(0.92, 1.08);
    e.hurt(dmg, p.pos, A ? A.poise : 0.5, crit);
    const hp = e.pos.clone().lerp(p.pos, 0.35); hp.y = e.elite ? 2.2 : 1.1;
    this.fx.number(hp, Math.round(dmg) + (crit ? '!' : ''), crit ? 'crit' : src === 'arc' ? 'arc' : '');
    if (src === 'blade') {
      this.fx.burst(hp, crit ? 26 : 14, 0xff3a50, 7, 2.5, 0.4);
      this.fx.burst(hp, 8, 0x46f0e0, 4, 1, 0.6);
      this.hitstop = Math.max(this.hitstop, (A.heavy ? 0.11 : 0.055) + (crit ? 0.03 : 0));
      this.shake(A.heavy ? 0.32 : 0.14);
      audio.hit(A.heavy, crit);
      p.charge = Math.min(100, p.charge + 7 * (A.heavy ? 1.8 : 1) * (1 + 0.35 * this.perk('capacitor')));
      if (s.leech) p.hp = Math.min(s.hp, p.hp + dmg * s.leech / 100);
      if (s.ember) { e.burn = 3; e.burnDps = (dmg * s.ember / 100) / 3; }
      if (s.arc && Math.random() * 100 < s.arc) this.arcFrom(e, dmg * 0.6);
    }
  }
  arcFrom(e, dmg) {
    const near = this.enemies.filter((o) => o !== e && !o.dead && o.pos.distanceTo(e.pos) < 7).sort((a, b) => a.pos.distanceTo(e.pos) - b.pos.distanceTo(e.pos))[0];
    if (!near) return;
    this.fx.bolt(e.pos.clone().setY(1.2), near.pos.clone().setY(1.2));
    audio.zap();
    this.hitEnemy(near, null, 'arc', dmg / this.stats.dmgFinal);
  }
  overload() {
    const p = this.player;
    if (!this.perk('overload')) { this.ui.toast('Overload is a Circuit perk [K]'); return; }
    if (p.charge < this.overloadCost()) { this.ui.toast('Not enough Charge. Land hits to build it.'); return; }
    p.charge -= this.overloadCost();
    this.fx.ring(p.pos.clone(), 7, 0.5, 0x46f0e0); this.fx.burst(p.pos.clone().setY(1), 60, 0x46f0e0, 9, 2, 0.6);
    audio.nova(); this.shake(0.4); this.hitstop = 0.08;
    for (const e of this.enemies) {
      if (e.dead || e.pos.distanceTo(p.pos) > 6.5) continue;
      this.fx.bolt(p.pos.clone().setY(1.3), e.pos.clone().setY(1.2));
      this.hitEnemy(e, { mult: 2.4, poise: 12 }, 'arc');
    }
  }
  spawnProjectile(from, to, dmg) { this.projectiles.push(new Projectile(this, from, to, dmg)); }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  // Time dilation. world: the scale for abominations/projectiles; all: also slow the Warden.
  slowmo(dur, scale, all, kind) {
    if (this.slow && this.slow.t > dur && this.slow.all && !all) return;
    this.slow = { t: dur, dur, scale, all, kind };
  }
  onPerfectDodge(from) {
    const p = this.player, s = this.stats;
    p.perfectCd = 0.6; p.iframes = Math.max(p.iframes, 0.5); p.riposte = 1.6;
    p.sta = Math.min(s.sta, p.sta + 20); p.charge = Math.min(100, p.charge + 15);
    this.slowmo(1.1, 0.22, false, 'perfect');
    const at = p.pos.clone().setY(1.1);
    this.fx.ring(p.pos.clone(), 3.2, 0.35, 0x46f0e0, 0.25);
    this.fx.burst(at, 30, 0x46f0e0, 5, 1.5, 0.5);
    this.fx.number(at.clone().setY(2.1), 'PERFECT', 'perfect');
    audio.perfect();
    if (!this.save?.flags?.tipRiposte && this.save) { this.save.flags.tipRiposte = true; this.ui.toast('Perfect dodge. Strike now for a guaranteed critical Riposte.', 'cyan'); }
    void from;
  }
  onPlayerHurt(d) { this.ui.hurtFlash(d / this.stats.hp * 3); this.shake(0.25); this.player.hurtT = 0.2; this.fx.burst(this.player.pos.clone().setY(1.2), 8, 0x802030, 3, 1, 0.3); }
  onPlayerDeath() { audio.death(); this.lockTarget = null; setTimeout(() => this.ui.open('dead'), 1400); }
  respawn() {
    const p = this.player;
    p.state = 'move'; p.hp = this.stats.hp; p.sta = this.stats.sta; p.pos.copy(POI.respawn); p.face = Math.PI;
    this.save.stims = 3;
    for (const e of this.enemies) { e.aggro = false; if (e.elite) { e.hp = e.maxHp; e.pos.copy(e.home); e.phase2 = false; } }
    this.enemies = this.enemies.filter((e) => { if (!e.elite && e.wave === 'BOSS') { e.dispose(); return false; } return true; });
    if (this.boss && !this.boss.dead) { this.boss.aggro = false; }
    this.ui.close(); this.persist();
  }
  onEnemyKilled(e) {
    const sv = this.save, p = this.player, s = this.stats;
    sv.kills++;
    if (this.lockTarget === e) this.lockTarget = null;
    this.fx.burst(e.pos.clone().setY(1), e.elite ? 120 : 40, 0x46f0e0, 6, 3, 0.9);
    // last abomination standing: the world holds its breath
    if (!this.enemies.some((o) => o !== e && !o.dead)) {
      this.slowmo(e.elite ? 1.6 : 0.85, e.elite ? 0.12 : 0.2, true, 'final');
      this.shake(e.elite ? 0.7 : 0.35); audio.lastKill(e.elite);
      this.fx.ring(e.pos.clone(), e.elite ? 10 : 5, e.elite ? 1.2 : 0.7, 0xff3050, 0.35);
    }
    const scrap = Math.round(randi(e.def.scrap[0], e.def.scrap[1]) * (1 + 0.1 * (e.level - 1)) * (1 + s.scrapPct / 100));
    sv.scrap += scrap; this.fx.number(e.pos.clone().setY(2), `+${scrap} scrap`, 'scrap');
    this.gainXp(Math.round(e.def.xp * (1 + 0.15 * (e.level - 1))));
    if (this.perk('verdict')) { p.sta = Math.min(s.sta, p.sta + 25); p.hp = Math.min(s.hp, p.hp + s.hp * 0.04); }
    if (this.perk('leech_protocol')) p.hp = Math.min(s.hp, p.hp + s.hp * 0.06);
    // loot
    if (e.elite) {
      this.dropAt(e.pos.clone().add(new THREE.Vector3(1.2, 0, 0)), randomGear(sv.level + 1, 6));
      this.dropAt(e.pos.clone().add(new THREE.Vector3(-1.2, 0, 0.5)), makeItem('blade', Math.random() < 0.35 ? 4 : 3, sv.level + 1));
      this.dropAt(e.pos.clone().add(new THREE.Vector3(0, 0, 1.4)), makeCore(null, 2));
      sv.flags.boss = true; this.persist();
      setTimeout(async () => { this.ui.banner('THE WARD HOLDS', 'For tonight'); await this.ui.say(STORY.victory); this.hunts = true; this.objective = 'Hunt the Rot. Temper your gear at the <b>Forge</b>.'; }, 1500);
    } else {
      const r = Math.random();
      if (r < 0.26) this.dropAt(e.pos.clone(), randomGear(sv.level, 0));
      else if (r < 0.34) this.dropAt(e.pos.clone(), makeCore(null, Math.random() < 0.15 ? 2 : 1));
    }
    this.persist();
  }
  gainXp(x) {
    const sv = this.save; sv.xp += x;
    while (sv.xp >= this.xpNeed()) {
      sv.xp -= this.xpNeed(); sv.level++; sv.points++;
      this.refreshStats(); this.player.hp = this.stats.hp;
      this.ui.banner(`LEVEL ${sv.level}`, 'Skill point earned. Press K'); audio.levelUp();
    }
  }
  dropAt(pos, item) {
    const col = item.kind === 'core' ? CORES[item.core].color : RARITIES[effectiveRarity(item)].color;
    const m = buildLoot(col, item.kind === 'core', item.kind === 'core' ? 2 : effectiveRarity(item));
    pos.y = 0; if (!walkable(pos.x, pos.z, 0.5)) pos.copy(this.player.pos);
    m.position.copy(pos); this.scene.add(m);
    this.loot.push({ m, item, t: 0 });
  }
  pickup(l) {
    const sv = this.save;
    sv.bag.push(l.item); this.scene.remove(l.m);
    const col = l.item.kind === 'core' ? CORES[l.item.core].color : RARITIES[effectiveRarity(l.item)].color;
    this.ui.toast(`${itemName(l.item)}`, 'loot', col);
    audio.pickup(effectiveRarity(l.item));
    this.persist();
  }
  // ---- inventory actions ---------------------------------------------------------
  equip(uid) {
    const sv = this.save, i = sv.bag.findIndex((x) => x.uid === uid); if (i < 0) return;
    const it = sv.bag[i]; if (it.kind !== 'gear') return;
    sv.bag.splice(i, 1);
    if (sv.equip[it.slot]) sv.bag.push(sv.equip[it.slot]);
    sv.equip[it.slot] = it; this.refreshStats(); this.persist(); audio.pickup(2);
  }
  salvage(uid) {
    const sv = this.save, i = sv.bag.findIndex((x) => x.uid === uid); if (i < 0) return;
    const v = salvageValue(sv.bag[i]); sv.bag.splice(i, 1); sv.scrap += v; this.ui.toast(`Salvaged for ${v} scrap`); this.persist();
  }
  findGear(uid) { const sv = this.save; return Object.values(sv.equip).find((x) => x?.uid === uid) || sv.bag.find((x) => x.uid === uid); }
  upgrade(uid) {
    const it = this.findGear(uid); if (!it || it.upgrade >= MAX_UPGRADE) return;
    const c = upgradeCost(it); if (this.save.scrap < c) return;
    this.save.scrap -= c; it.upgrade++; this.refreshStats(); this.persist();
    audio.forge(); this.fx.burst(POI.forge.clone().setY(1.1), 40, 0xffa040, 5, 3, 0.6); this.ui.toast(`${itemName(it)}`, 'gold');
  }
  socket(uid, coreUid) {
    const it = this.findGear(uid), sv = this.save, ci = sv.bag.findIndex((x) => x.uid === coreUid);
    if (!it || ci < 0 || it.cores.length >= it.sockets) return;
    const before = effectiveRarity(it);
    it.cores.push(sv.bag.splice(ci, 1)[0]); this.refreshStats(); this.persist(); audio.zap(); audio.forge();
    const after = effectiveRarity(it);
    this.ui.toast(after > before ? `${it.name} rose to ${RARITIES[after].name}` : `Core installed in ${it.name}`, 'loot', RARITIES[after].color);
  }
  extract(uid, i) {
    const it = this.findGear(uid); if (!it || !it.cores[i]) return;
    const c = it.cores.splice(i, 1)[0]; this.save.scrap += 5 * c.grade; this.refreshStats(); this.persist();
  }
  learnPerk(id) {
    const sv = this.save, p = PERKS.find((x) => x.id === id);
    const spent = PERKS.filter((x) => x.branch === p.branch).reduce((a, x) => a + (sv.perks[x.id] || 0), 0);
    if (!sv.points || (sv.perks[id] || 0) >= p.max || spent < TIER_REQ[p.tier]) return;
    sv.points--; sv.perks[id] = (sv.perks[id] || 0) + 1; this.refreshStats(); this.persist(); audio.levelUp();
  }
  applySetting(k, v) {
    if (k === 'mute') { audio.setMuted(v); this.settings.mute = v; }
    else this.settings[k] = v;
    if (k === 'bloom') this.bloom.enabled = v;
    if (k === 'scale') this.onResize?.();
    localStorage.setItem(SET_KEY, JSON.stringify(this.settings));
  }
  onPanelClosed() { if (this.state === 'play' && !document.pointerLockElement) this.requestLock?.(); }

  // ---- input --------------------------------------------------------------------------
  bindInput() {
    const cv = this.renderer.domElement;
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys[e.code] = true; this.edge[e.code] = true;
      if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
      if (this.state !== 'play') return;
      if (e.code === 'KeyM') this.applySetting('mute', !audio.muted);
      if (this.dialogueOpen) return;
      if (e.code === 'Escape') { if (this.ui.isOpen) { if (this.ui.screen !== 'dead') this.ui.close(); } else this.ui.open('pause'); }
      if (this.ui.screen === 'dead') return;
      if (e.code === 'KeyI' || e.code === 'Tab') this.ui.toggle('armory');
      if (e.code === 'KeyK') this.ui.toggle('skills');
      if (e.code === 'KeyE' && !this.ui.isOpen) this.interact();
      else if (e.code === 'KeyE' && this.ui.screen === 'forge') this.ui.close();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    cv.addEventListener('mousedown', (e) => {
      audio.init();
      if (this.state !== 'play' || this.ui.isOpen || this.dialogueOpen) return;
      if (!document.pointerLockElement && !this.noLock) { this.requestLock(); if (!this.allowUnlockedAttack) return; }
      if (e.button === 0) this.edge.light = true;
      if (e.button === 2) this.edge.heavy = true;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== cv) return;
      const s = 0.0024 * this.settings.sens;
      this.camYaw -= e.movementX * s;
      this.camPitch = clamp(this.camPitch + e.movementY * s * (this.settings.invertY ? -1 : 1), -0.35, 1.15);
    });
    cv.addEventListener('wheel', (e) => { this.camDist = clamp(this.camDist + Math.sign(e.deltaY) * 0.4, 2.6, 7.5); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'play' && !this.ui.isOpen && !this.dialogueOpen && this.player.state !== 'dead') this.ui.open('pause');
    });
    this.requestLock = () => { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} };
  }
  interact() {
    if (this.nearForge) { this.save.stims = 3; this.ui.open('forge'); return; }
    if (this.nearCache) {
      this.save.flags.cache = true; this.cacheMarker.visible = false;
      this.dropAt(POI.cache.clone().add(new THREE.Vector3(1.5, 0, 0)), randomGear(this.save.level, 3));
      this.dropAt(POI.cache.clone().add(new THREE.Vector3(1.5, 0, 1.2)), makeCore(null, 1));
      this.save.scrap += 25; this.ui.toast('+25 scrap from the cache'); this.persist();
    }
  }
  consume(code) { const v = this.edge[code]; this.edge[code] = false; return !!v; }

  // ---- frame ----------------------------------------------------------------------------
  update(dtReal) {
    this.dtReal = dtReal;
    this.time += dtReal;
    const t = this.time;
    const paused = this.ui.isOpen && this.state === 'play';
    let dt = paused ? 0 : dtReal;
    if (this.hitstop > 0) { this.hitstop -= dtReal; dt *= 0.06; }
    let worldScale = 1;
    if (this.slow) {
      if (!paused) this.slow.t -= dtReal;
      if (this.slow.t <= 0 || this.state !== 'play') this.slow = null;
      else {
        const k = Math.min(1, this.slow.t / 0.3, (this.slow.dur - this.slow.t) / 0.06 + 0.2); // ease out of it
        const sc = 1 - (1 - this.slow.scale) * k;
        if (this.slow.all) dt *= sc; else worldScale = sc;
      }
    }
    const fxEl = this._slowEl || (this._slowEl = document.getElementById('slowmo'));
    if (fxEl) { const on = this.slow ? Math.min(1, this.slow.t / 0.3) : 0; fxEl.style.opacity = String(on); fxEl.dataset.kind = this.slow?.kind || ''; }
    const p = this.player;
    if (this.state === 'play' && !paused) {
      const k = this.keys;
      const block = this.dialogueOpen;
      const inp = block ? {} : {
        f: k.KeyW || k.ArrowUp, b: k.KeyS || k.ArrowDown, l: k.KeyA || k.ArrowLeft, r: k.KeyD || k.ArrowRight,
        sprint: k.ShiftLeft || k.ShiftRight, dodge: this.consume('Space'), light: this.consume('light'), heavy: this.consume('heavy'),
        stim: this.consume('KeyR'), joy: this.joy,
      };
      if (!block && this.consume('KeyF')) this.overload();
      if (!block && this.consume('KeyQ')) this.toggleLock();
      if (this.lockTarget && (this.lockTarget.dead || this.lockTarget.pos.distanceTo(p.pos) > 24)) this.lockTarget = null;
      p.update(dt, inp, this.camYaw);
      if (this.lockTarget) this.camYaw = dampAngle(this.camYaw, Math.atan2(this.lockTarget.pos.x - p.pos.x, this.lockTarget.pos.z - p.pos.z), 6, dtReal);
      this.edge = {};
    } else if (this.state === 'story') {
      p.update(dt, {}, this.camYaw);
    } else if (this.state === 'title') {
      p.model.rotation.y = 0; p.t += dtReal; p.titleMode = true; p.capeAndBlade(dtReal, 1.5 + Math.sin(t * 0.7), 0.2); p.titleMode = false;
    }
    // enemies, projectiles, shockwaves
    if (dt > 0) {
      const dw = dt * worldScale;
      this.enemies = this.enemies.filter((e) => { const alive = e.update(dw); if (!alive) e.dispose(); return alive; });
      this.projectiles = this.projectiles.filter((pr) => pr.update(dw));
      for (const s of this.shockwaves) {
        s.t += dw; const r = (s.t / s.dur) * s.maxR, d = p.pos.distanceTo(s.c);
        if (!s.hit && Math.abs(d - r) < 0.9) { if (p.state !== 'dodge' || p.t < 0.24) { s.hit = true; p.takeHit(s.dmg, s.c, 8); } }
      }
      this.shockwaves = this.shockwaves.filter((s) => s.t < s.dur);
    }
    // loot
    for (const l of this.loot) {
      l.t += dtReal; l.m.userData.shard.rotation.y += dtReal * 2; l.m.userData.shard.position.y = 0.6 + Math.sin(l.t * 3) * 0.08;
      if (this.state === 'play' && p.state !== 'dead' && l.t > 0.6 && l.m.position.distanceTo(p.pos) < 1.5) { l.taken = true; this.pickup(l); }
    }
    this.loot = this.loot.filter((l) => !l.taken);
    // interactions
    if (this.state === 'play' && this.save) {
      this.nearForge = p.pos.distanceTo(POI.forge) < 3.6;
      this.nearCache = !this.save.flags.cache && p.pos.distanceTo(POI.cache) < 2.6;
      this.cacheMarker.visible = !this.save.flags.cache;
      this.prompt = this.nearForge ? '[E] Use the Forge (temper gear, install Cores, refill stims)' : this.nearCache ? '[E] Search the cache' : '';
      if (!paused) this.progress();
      this.autosave = (this.autosave || 0) + dtReal; if (this.autosave > 10) { this.autosave = 0; this.persist(); }
    }
    this.fx.update(dtReal);
    this.updateCamera(dtReal, t);
    this.world.update(dtReal, t, this.camera, p.pos);
    this.fill.position.copy(this.camera.position).lerp(p.pos, 0.35); this.fill.position.y += 1.2;
    const back = new THREE.Vector3().subVectors(p.pos, this.camera.position).setY(0).normalize();
    this.rim.position.copy(p.pos).addScaledVector(back, 1.6); this.rim.position.y += 2.2;
    if (this.state !== 'title') this.ui.updateHud();
  }
  toggleLock() {
    if (this.lockTarget) { this.lockTarget = null; return; }
    const p = this.player; let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.pos.distanceTo(p.pos); if (d > 20) continue;
      const a = Math.abs(angleDiff(this.camYaw, Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z)));
      if (a > 1.4) continue;
      const s = d + a * 6; if (s < bd) { bd = s; best = e; }
    }
    this.lockTarget = best;
  }
  updateCamera(dt, t) {
    const cam = this.camera, p = this.player;
    const wantFov = this.slow ? (this.slow.kind === 'final' ? 49 : 53) : 58;
    this.fov += (wantFov - this.fov) * (1 - Math.exp(-(this.slow ? 10 : 4) * dt));
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    if (this.state === 'title') {
      const k = Math.sin(t * 0.1);
      cam.position.set(-1.1 + k * 0.25, 1.05, 34.6 + Math.cos(t * 0.13) * 0.2);
      cam.lookAt(-2.3, 1.55, 29);
      return;
    }
    if (this.cine) {
      const c = this.cine;
      if (c !== this._lastCine) { this._lastCine = c; if (!c.blend) { cam.position.copy(c.pos); this._look = c.look.clone(); } }
      if (c.drift) c.pos.z -= dt * 0.6;
      cam.position.lerp(c.pos, 1 - Math.exp(-3 * dt));
      this._look = (this._look || c.look.clone()).lerp(c.look, 1 - Math.exp(-3 * dt));
      cam.lookAt(this._look);
      return;
    }
    const tgt = p.pos.clone(); tgt.y += 1.55;
    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const dist = this.camDist + (p.state === 'dodge' ? 0.3 : 0);
    const want = tgt.clone().addScaledVector(fwd, -dist * Math.cos(this.camPitch)).addScaledVector(right, 0.8);
    want.y += dist * Math.sin(this.camPitch);
    // pull in when a wall is between the Warden and the lens
    const steps = 14; let ok = tgt.clone();
    for (let i = 1; i <= steps; i++) {
      const q = tgt.clone().lerp(want, i / steps);
      if (!walkable(q.x, q.z, 0.15) && q.y < 20) break;
      ok = q;
    }
    want.copy(ok); want.y = Math.max(0.35, want.y);
    this._camPos = this._camPos || want.clone();
    this._camPos.lerp(want, 1 - Math.exp(-18 * dt));
    cam.position.copy(this._camPos);
    if (this.shakeAmt > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shakeAmt * 0.25; cam.position.y += (Math.random() - 0.5) * this.shakeAmt * 0.25;
      this.shakeAmt *= Math.pow(0.002, dt);
    }
    const look = tgt.clone().addScaledVector(right, 0.8).addScaledVector(fwd, 2.5); look.y += 0.15;
    look.y -= Math.max(0, this.camPitch - 0.3) * 0.5;
    cam.lookAt(look);
  }
}
