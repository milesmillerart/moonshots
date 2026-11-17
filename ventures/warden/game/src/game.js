// Game orchestration: states, story, waves, combat resolution, loot, saving.
import * as THREE from '../vendor/three-warden.r187-09.min.js';
import { buildWorld, POI, walkable } from './world.js';
import { buildWarden, buildPerson, buildLoot, buildEnemy } from './models.js';
import { Player, posePoster } from './player.js';
import { Enemy, Projectile } from './enemies.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { TouchControls, detectTouch } from './touch.js';
import { audio } from './audio.js';
import { STORY, COLD_OPEN, TRAITS, RARITIES, CORES, PERKS, TIER_REQ } from './data.js';
import { computeStats, starterGear, randomGear, makeItem, makeCore, itemName, tierOf, upgradeCost, salvageValue, MAX_UPGRADE } from './items.js';
import { angleDiff, clamp, damp, dampAngle, rand, randi, pick } from './util.js';

import * as Save from './save.js';
import { Q, TIERS } from './quality.js';

const SET_KEY = 'warden.settings.v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  constructor(renderer, composer, bloom, scene, camera) {
    Object.assign(this, { renderer, composer, bloom, scene, camera });
    this.isTouch = detectTouch();
    // phones default to a lighter render scale; saved settings always win
    this.settings = Object.assign({ bloom: true, shadows: true, invertY: false, sens: 1, scale: this.isTouch ? 0.85 : 1, mute: false, quality: Q.name }, JSON.parse(localStorage.getItem(SET_KEY) || '{}'));
    audio.setMuted(this.settings.mute);
    bloom.enabled = this.settings.bloom;
    renderer.shadowMap.enabled = this.settings.shadows;
    this.world = buildWorld(scene, renderer, { shadows: this.settings.shadows, mobile: this.isTouch, tier: Q });
    this.tiers = TIERS; this.tierNow = Q.name;
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
    // Soft cool fill that follows the lens so black plate still reads against the night.
    this.fill = new THREE.PointLight(0x9fb6e0, 4, 9, 1.6); scene.add(this.fill);
    this.rim = new THREE.PointLight(0xff3060, 2.2, 6, 2); scene.add(this.rim);
    // Statue of the first Warden in Statute Plaza.
    const statue = buildWarden({ statue: true }); statue.scale.setScalar(2.1); statue.position.set(0, 2.0, 0); statue.rotation.y = Math.PI * 0.85;
    scene.add(statue); posePoster(statue);
    // Story cast
    this.brann = buildPerson({ coat: 0x2b2a2e, hood: false, lantern: true, keys: true });
    this.mira = buildPerson({ coat: 0x3a2c24, kneel: true });
    this.watch = buildPerson({ coat: 0x1f2226, hood: false, helm: true, polearm: true });
    this.brann.position.set(1.7, 0, 44.6); this.mira.position.set(0, 0, 45.0); this.watch.position.set(-1.6, 0, 44.9);
    for (const n of [this.brann, this.mira, this.watch]) scene.add(n);
    this.cacheMarker = buildLoot('#ffb547', false, 2); this.cacheMarker.position.copy(POI.cache); scene.add(this.cacheMarker);
    fetch('data/changelog.json').then((r) => r.json()).then((j) => (this.changelog = j)).catch(() => (this.changelog = []));
    this.bindInput();
    // save whenever the page is hidden or closed (app switch, tab close, phone lock)
    const flush = () => { if (this.save && this.state !== 'title') this.persist(); };
    addEventListener('pagehide', flush);
    addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    // iOS/Android only start WebAudio inside a real gesture (touchend/click), so unlock on the first ones
    const unlock = () => audio.init();
    for (const ev of ['touchend', 'click', 'keydown']) addEventListener(ev, unlock, { passive: true, capture: true });
    this.touch = new TouchControls(this);
    if (this.isTouch) this.touch.enable();
    // a touch on a desktop-detected device (tablet with keyboard, touchscreen laptop) switches touch controls on
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !this.touch.on) { this.isTouch = true; this.touch.enable(); } }, true);
  }
  // ---- save (see save.js) -----------------------------------------------------
  // persist(): write the current Warden to its slot. why: 'auto' (quiet periodic / page hide) or an event name;
  // every non-auto save flashes the small Saved indicator.
  persist(why = 'auto') {
    if (!this.save || this.slot == null) return false;
    const p = this.player, sv = this.save;
    if (p.state === 'dead') sv.pos = [POI.respawn.x, POI.respawn.z];
    else if (this.state === 'play') { sv.pos = [p.pos.x, p.pos.z]; sv.face = p.face; sv.camYaw = this.camYaw; }
    sv.hp = p.hp;
    sv.area = Save.areaAt(p.pos.x, p.pos.z);
    // loot still lying in the street survives a reload
    sv.ground = this.loot.filter((l) => !l.taken).map((l) => ({ item: l.item, x: +l.m.position.x.toFixed(2), z: +l.m.position.z.toFixed(2) }));
    sv.saved = Date.now(); sv.build = window.__warden?.build || sv.build;
    const ok = Save.writeSlot(this.slot, sv);
    if (!ok) { if (!this.saveFailWarned) { this.saveFailWarned = true; this.ui.toast('Could not save: browser storage is full or blocked. Export your save from the pause menu.', 'red'); } return false; }
    this.saveFailWarned = false; this.lastSaved = sv.saved; this.autosave = 0;
    if (why !== 'auto') this.ui.savedFlash(why === 'manual' ? 'Game saved' : 'Saved');
    return true;
  }
  perk(id) { return this.save?.perks[id] || 0; }
  refreshStats() {
    this.stats = computeStats(this.save);
    this.player.hp = Math.min(this.player.hp, this.stats.hp);
  }
  xpNeed() { return Math.round(60 * Math.pow(this.save.level, 1.45)); }
  overloadCost() { return this.perk('overclock') ? 50 : 100; }

  // ---- flow -------------------------------------------------------------------
  boot() {
    Save.migrateLegacy();
    this.save = null; this.slot = null; this.area = null;
    this.touch?.root?.classList.add('hidden'); this.touch?.reset?.();
    this.ui.showTitle();
    this.state = 'title';
    this.player.pos.set(0, 0, 30); this.player.face = 0; posePoster(this.player.model);
  }
  toTitle() {
    this.persist('quit'); this.ui.screen = null; this.ui.panel.classList.add('hidden');
    for (const e of this.enemies) e.dispose(); this.enemies = [];
    for (const l of this.loot) this.scene.remove(l.m); this.loot = [];
    document.getElementById('banner').classList.remove('show'); this.ui.toasts.innerHTML = '';
    this.openGen = (this.openGen || 0) + 1; this.ui.cancelSay?.(); this.cine = null; this.creating = false; this.clearCivilians();
    document.documentElement.classList.remove('opening');
    if (this.ui.finishCreation) { this.ui.finishCreation = null; document.getElementById('title').classList.remove('naming-on', 'create-on'); }
    this.started = false; this.combatOn = false; this.boss = null; this.hunts = false; this.wave = null; this.lockTarget = null; this.objective = '';
    this.boot();
  }
  // 0.10: a new game goes straight into the cold open. The Warden is nameless ("Warden") until character creation.
  newGame(name = '', slot = 0) {
    this.slot = slot;
    this.save = { schema: Save.SCHEMA, v: Save.SCHEMA, name, level: 1, xp: 0, points: 1, perks: {}, equip: starterGear(), bag: [], scrap: 0, stims: 3, trait: null,
      flags: { opening: 'act1', named: !!name }, created: Date.now(), kills: 0, playTime: 0, ground: [] };
    this.refreshStats(); this.player.hp = this.stats.hp; this.player.sta = this.stats.sta;
    this.persist('new'); Save.requestPersist();
    this.ui.hideTitle();
    this.runCase();
  }
  inOpening() { return Save.inOpening(this.save); }
  // Tests and debugging: finish the cold open instantly (named, judged, created) and start the open world.
  debugSkipOpening(name = 'Kade', trait = 'inquest') {
    if (!this.save) this.newGame('', this.slot ?? 0);
    this.openGen = (this.openGen || 0) + 1; this.ui.cancelSay?.(); this.cine = null; this.creating = false;
    if (this.ui.finishCreation) { this.ui.finishCreation = null; this.ui.hideTitle(); }
    document.getElementById('fade').style.opacity = '0';
    const f = this.save.flags; this.save.name = name; this.save.trait = trait;
    Object.assign(f, { opening: 'done', named: true, created: true, judged: true });
    this.refreshStats(); this.persist('skip'); this.clearCivilians();
    this.hideCast(); this.player.pos.copy(POI.judgment); this.player.face = Math.PI; this.player.state = 'move';
    this.startPlay(); this.camYaw = Math.PI; this.camPitch = 0.22;
    this.resumeProgress();
  }
  // Mid-open reload: pick up at the last beat checkpoint instead of restarting the whole cold open.
  resumeOpening() {
    const f = this.save.flags;
    if (!(f.caseDone || f.judged)) { this.runCase(); return; }
    this.placeCast('gaol');
    if (!f.waveA) { this.player.pos.set(0, 0, 40); this.player.face = Math.PI; this.startPlay(); this.camYaw = Math.PI; this.spawnWave('A'); return; }
    this.spawnCivilians(f.ledger);
    if (!f.judged) { this.runVerdict(); return; }
    if (!f.bossDown) { this.hideCast(); if (f.merged) this.startClot(); else this.runMerge(); return; }
    this.player.pos.set(0, 0, 24); this.player.face = Math.PI; this.startPlay(); this.camYaw = Math.PI;
    this.beginCreation();
  }
  // Brann, Mira (restrained) and the watchman at the gaol checkpoint, with the stolen cell on a crate.
  placeCast(stage) {
    this.mira.visible = this.brann.visible = this.watch.visible = true;
    this.mira.position.set(0, 0, 45.0); this.mira.rotation.set(0, 0, 0);
    this.brann.position.set(1.7, 0, 44.6); this.brann.rotation.set(0, 0.4, 0); this.watch.position.set(-1.6, 0, 44.9); this.watch.rotation.set(0, 0, 0);
    if (stage === 'gaol') { this.watch.position.set(-2.6, 0, 40.5); this.watch.rotation.set(0, Math.PI, 0); }
    if (!this.cellProp) {
      const g = new THREE.Group();
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9 }));
      crate.position.y = 0.3; g.add(crate);
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0x1a2a2c, emissive: new THREE.Color(0.1, 0.8, 0.75), emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.4 }));
      cell.rotation.z = Math.PI / 2; cell.position.y = 0.72; g.add(cell);
      g.position.set(2.9, 0, 45.6); this.scene.add(g); this.cellProp = g;
    }
    this.cellProp.visible = true;
  }
  // Character creation, after the cold open (0.10.1: name only, if not already chosen). Then the capital opens.
  beginCreation() {
    if (this.creating) return;
    this.creating = true; this.state = 'story'; this.combatOn = false; this.keys = {};
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.ui.hud.classList.add('hidden'); this.touch?.root?.classList.add('hidden');
    const pend = this.save.flags.pendingTrait || this.save.trait;
    this.ui.showCreation({ needName: !this.save.flags.named, trait: pend ? TRAITS[pend] : null }).then(({ name }) => {
      const f = this.save.flags;
      if (f.pendingTrait) { this.save.trait = f.pendingTrait; delete f.pendingTrait; this.refreshStats(); this.player.hp = this.stats.hp; }
      if (!f.named) { this.save.name = (name || '').trim().slice(0, 20) || 'Kade'; f.named = true; }
      f.created = true; f.opening = 'done'; this.creating = false;
      this.clearCivilians(); this.syncOpening();
      if (f.deferredXp) { const x = f.deferredXp; f.deferredXp = 0; this.gainXp(x); }
      this.persist('created');
      this.ui.hideTitle(); this.startPlay();
      this.objective = 'Push north into <b>Statute Plaza</b>';
      this.ui.toast(`Warden ${this.save.name}. Hallowmere is yours to keep. Push north.`, 'gold');
    });
  }
  continueGame(slot = Save.lastSlot()) {
    if (slot == null) return;
    const sv = Save.readSlot(slot);
    if (!sv) { this.ui.toast('That save could not be read.', 'red'); return; }
    this.slot = slot; this.save = sv; this.lastSaved = sv.saved;
    this.refreshStats(); this.player.hp = clamp(this.save.hp || this.stats.hp, 1, this.stats.hp); this.player.sta = this.stats.sta;
    this.ui.hideTitle();
    Save.requestPersist();
    if (this.inOpening()) { this.resumeOpening(); return; }
    this.hideCast();
    const p = this.save.pos;
    if (p && walkable(p[0], p[1])) this.player.pos.set(p[0], 0, p[1]); else this.player.pos.copy(POI.respawn);
    if (Number.isFinite(sv.face)) this.player.face = sv.face;
    this.startPlay();
    if (Number.isFinite(sv.camYaw)) this.camYaw = sv.camYaw;
    for (const g of sv.ground || []) this.dropAt(new THREE.Vector3(g.x, 0, g.z), g.item, true);
    this.area = Save.areaAt(this.player.pos.x, this.player.pos.z);
    this.resumeProgress();
    this.ui.toast(`Welcome back, ${Save.displayName(sv)}. Hallowmere, ${sv.area || this.area}.`);
  }
  // test/debug: load a save object directly into a slot
  importToSlot(slot, sv) { return Save.writeSlot(slot, sv); }
  hideCast() {
    this.watch.visible = false;
    if ((this.save.trait || this.save.flags?.pendingTrait) === 'dread') { this.mira.visible = true; this.mira.rotation.set(-1.5, 0, 0); this.mira.position.set(0, 0.3, 45); }
    else this.mira.visible = false;
    this.brann.position.set(5, 0, 46.5); this.brann.rotation.y = -1.2;
    if (this.cellProp) this.cellProp.visible = false;
  }
  syncOpening() { document.documentElement.classList.toggle('opening', !!this.save && this.inOpening()); }
  startPlay() {
    this.state = 'play'; this.started = true; this.combatOn = true; this.syncOpening();
    this.ui.showHud(); this.camYaw = this.player.face;
  }
  async fade(on, ms = 500) { const f = document.getElementById('fade'); f.style.transition = `opacity ${ms}ms`; f.style.opacity = on ? '1' : '0'; await sleep(ms); }

  // 0.10.2 Beat 1: arrival, the case, up to three optional questions, then the alarm (no verdict yet).
  async runCase() {
    const gen = this.openGen = (this.openGen || 0) + 1, live = () => gen === this.openGen && this.state !== 'title';
    this.state = 'story'; this.started = true; this.combatOn = false;
    const p = this.player, f = this.save.flags;
    this.placeCast('case');
    p.pos.set(0, 0, 64); p.face = Math.PI; p.state = 'move'; this.camYaw = Math.PI;
    // arrival: the Warden walks the wet street to the gaol while two lines set the scene (~10 s)
    const look = new THREE.Vector3(0, 1.4, 60);
    this.cine = { pos: new THREE.Vector3(3.4, 2.2, 46.0), look };
    this.storyInp = { joy: { x: 0, y: -1, m: 0.45 } };
    let walking = true;
    const walk = (async () => { while (walking && live() && p.pos.z > 49.6) { look.set(p.pos.x, 1.4, p.pos.z - 1); await sleep(50); } this.storyInp = null; })();
    await this.fade(false, 900);
    if (!live()) return;
    await this.ui.say(COLD_OPEN.arrival);
    if (!live()) return;
    while (live() && p.pos.z > 49.7) await sleep(100);
    walking = false; await walk; this.storyInp = null; p.vel?.set?.(0, 0, 0);
    if (!live()) return;
    // the case at the gaol checkpoint
    this.cine = { pos: new THREE.Vector3(3.6, 1.9, 48.8), look: new THREE.Vector3(0, 1.0, 45.0) };
    const asked = [];
    let lines = COLD_OPEN.caseLines;
    for (;;) {
      const left = COLD_OPEN.questions.filter((q) => !asked.includes(q.id));
      if (!left.length) { await this.ui.say(lines); if (!live()) return; break; }
      const choices = [...left.map((q) => ({ id: q.id, label: q.label })), { id: 'silent', label: COLD_OPEN.silent }];
      const k = await this.ui.say(lines, choices);
      if (!live()) return;
      const c = choices[k];
      if (c.id === 'silent') break;
      asked.push(c.id);
      this.cine = asked.length % 2 ? { pos: new THREE.Vector3(-2.2, 1.8, 48.4), look: new THREE.Vector3(0.6, 1.1, 45.0) } : { pos: new THREE.Vector3(3.6, 1.9, 48.8), look: new THREE.Vector3(0, 1.0, 45.0) };
      lines = COLD_OPEN.questions.find((q) => q.id === c.id).lines;
    }
    f.asked = asked;
    // the interruption
    audio.bell(); this.shake(0.3);
    this.cine = { pos: new THREE.Vector3(0.5, 2.4, 50), look: new THREE.Vector3(0, 2.0, 28) };
    await this.ui.say(COLD_OPEN.alarm);
    if (!live()) return;
    f.caseDone = true; this.persist('case');
    await this.fade(true, 300);
    if (!live()) return;
    this.placeCast('gaol');
    this.cine = null; p.pos.set(0, 0, 46.5); p.face = Math.PI;
    this.camYaw = Math.PI; this.camPitch = 0.22;
    this.startPlay();
    this.spawnWave('A');
    await this.fade(false, 500);
    if (!live()) return;
    this.ui.toast(this.touch?.on ? 'Left thumb moves. Drag right to look. Tap STRIKE to fight.' : 'Click the game to capture the mouse. Esc to pause.');
  }
  // Return to the unresolved case once the street is clear (0.10.2: the 0.9 verdict choices, reworked in 0.10.4).
  async runVerdict() {
    const gen = this.openGen = (this.openGen || 0) + 1, live = () => gen === this.openGen && this.state !== 'title';
    this.state = 'story'; this.combatOn = false; this.keys = {};
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.ui.hud.classList.add('hidden'); this.touch?.root?.classList.add('hidden');
    const p = this.player;
    await this.fade(true, 400);
    if (!live()) return;
    this.placeCast('case'); p.pos.copy(POI.judgment); p.face = Math.PI; p.state = 'move'; p.vel?.set?.(0, 0, 0);
    this.cine = { pos: new THREE.Vector3(3.6, 1.9, 48.8), look: new THREE.Vector3(0, 1.0, 45.0) };
    await this.fade(false, 500);
    if (!live()) return;
    const k = await this.ui.say(COLD_OPEN.verdictPrompt, COLD_OPEN.verdicts);
    if (!live()) return;
    const v = COLD_OPEN.verdicts[k], ch = STORY.choices.find((c) => c.id === v.id);
    const f = this.save.flags, led = f.ledger || {};
    // the trait applies at character creation (handoff); the ledger keeps the verdict, who saw it, and the street's cost
    f.judged = true; f.pendingTrait = ch.id;
    f.ledger = { ...led, verdict: ch.id, witnesses: (led.present || ['brann', 'watchman', 'mira']).filter((w) => !(ch.id === 'dread' && w === 'mira')), civiliansDead: led.civiliansDead || 0 };
    this.persist('verdict');
    if (ch.id === 'dread') {
      p.startAttack('heavy'); p.sta = this.stats.sta;
      await sleep(420); audio.hit(true, true); this.fx.burst(new THREE.Vector3(0, 1.1, 45.3), 50, 0xff2050, 5, 2, 0.7); this.hitstop = 0.15;
      if (!live()) return;
      this.mira.rotation.x = -1.5; this.mira.position.y = 0.3;
      await sleep(500);
      if (!live()) return;
    }
    this.cine = { pos: new THREE.Vector3(-3.0, 1.7, 49.5), look: new THREE.Vector3(0, 1.5, 44) };
    await this.ui.say(ch.after);
    if (!live()) return;
    this.hideCast();
    this.runMerge();
  }
  // ---- 0.10.6: the Husks' bodies crawl together and fuse into THE CLOT (cause deliberately unexplained) ----
  async runMerge() {
    const gen = this.openGen = (this.openGen || 0) + 1, live = () => gen === this.openGen && this.state !== 'title';
    this.state = 'story'; this.combatOn = false; this.keys = {};
    this.ui.hud.classList.add('hidden'); this.touch?.root?.classList.add('hidden');
    for (const e of this.enemies) e.dispose(); this.enemies = [];
    const C = new THREE.Vector3(0, 0, 28), p = this.player;
    p.pos.set(0, 0, 38.5); p.face = Math.PI; p.state = 'move'; p.vel?.set?.(0, 0, 0);
    const spots = this.huskFell?.length === 3 ? this.huskFell : [new THREE.Vector3(-2.5, 0, 30), new THREE.Vector3(2.5, 0, 27), new THREE.Vector3(0, 0, 23)];
    const bodies = spots.map((at, i) => { const m = buildEnemy('husk'); m.position.copy(at).setY(0.05); m.rotation.set(1.35, i * 2.1, 0); this.scene.add(m); return { m, from: at.clone() }; });
    const clot = buildEnemy('clot'); clot.position.copy(C); clot.scale.setScalar(0.05); this.scene.add(clot);
    this.cine = { pos: new THREE.Vector3(1.2, 2.6, 37.5), look: new THREE.Vector3(0, 0.8, 27), blend: true };
    await this.fade(false, 500);
    const T = 9.0; let t = 0, last = performance.now();
    audio.growl(0.4);
    while (t < T) {
      if (!live()) { for (const b of bodies) this.scene.remove(b.m); this.scene.remove(clot); return; }
      await sleep(33); const now = performance.now(); t += Math.min(0.1, (now - last) / 1000); last = now;
      const k = t / T;
      bodies.forEach((b, i) => {
        const pull = clamp((k - 0.12 - i * 0.05) / 0.6, 0, 1), ease = pull * pull * (3 - 2 * pull);
        b.m.position.lerpVectors(b.from, C, ease * 0.92); b.m.position.y = 0.05 + Math.sin(t * 7 + i) * 0.04 * (1 - ease);
        b.m.rotation.z = Math.sin(t * (5 + i)) * 0.25 * (1 - ease); // twitching as they drag
        b.m.scale.setScalar(Math.max(0.05, 1 - clamp((k - 0.55) / 0.35, 0, 1)));
        if (Math.random() < 0.25) this.fx.burst(b.m.position.clone().setY(0.5), 2, i % 2 ? 0x46f0e0 : 0xa040ff, 1.5, 1, 0.5);
      });
      const g = clamp((k - 0.35) / 0.6, 0, 1); clot.scale.setScalar(0.05 + 0.95 * g * g * (3 - 2 * g));
      clot.rotation.y += 0.004;
      if (clot.userData.current) { const fl = Math.random() < 0.15 ? 2.4 : 0.7; clot.userData.current.color.setRGB(1.6 * fl, 0.35 * fl, 2.4 * fl); }
      if (Math.random() < 0.06) { this.shake(0.15); audio.growl(0.5 + Math.random() * 0.4); }
      this.cine.look.set(0, 0.8 + g * 0.8, 27.5);
      this.cine.pos.set(1.2 + g * 0.6, 2.6 + g * 0.5, 37.5 - (1 - g) * 1.5);
    }
    for (const b of bodies) this.scene.remove(b.m); this.scene.remove(clot);
    this.save.flags.merged = true; this.persist('boss');
    this.startClot();
  }
  startClot() {
    const f = this.save.flags, p = this.player;
    for (const e of this.enemies) e.dispose(); this.enemies = []; this.projectiles = []; this.shockwaves = [];
    const e = new Enemy(this, 'clot', new THREE.Vector3(0, 0, 28), 1); e.wave = 'CLOT'; e.aggro = true; e.face = 0; e.searDmg = 0; e.lastHitT = this.time;
    this.enemies.push(e); this.boss = e; this.clot = { shards: 0, phase2At: 0, lastSear: -99 };
    if (p.pos.z < 34 || p.state === 'dead') { p.pos.set(0, 0, 38.5); p.face = Math.PI; }
    p.state = 'move'; p.hp = this.stats.hp; p.charge = Math.max(p.charge, f.openCharge || 60);
    this.cine = null; this.startPlay(); this.camYaw = Math.PI;
    this.ui.banner('THE CLOT', 'Something the Ward has not seen.'); audio.bell(); this.shake(0.4);
    this.objective = 'Destroy <b>the Clot</b>';
    if (!f.tipClot) { f.tipClot = true; setTimeout(() => this.ui.toast(this.touch?.on ? 'It heals what you cut. CAUTERIZE seals the wound.' : 'It heals what you cut. Cauterize (C) seals the wound.', 'cyan'), 2600); }
  }
  clotUpdate(dt) {
    const b = this.boss, S = this.clot;
    if (!b || b.type !== 'clot' || !S) return;
    if (b.dead) return;
    // phase 1: slow regen of uncauterized damage (cauterized wounds never reseal)
    const cap = b.maxHp - (b.searDmg || 0);
    if (!b.phase2 && this.time - (b.lastHitT || 0) > 2 && b.hp < cap) b.hp = Math.min(cap, b.hp + 6 * dt);
    if (!b.phase2 && b.hp < b.maxHp * 0.5) {
      b.phase2 = true; S.phase2At = this.time; this.splitShard(b);
      this.ui.toast('A shard tears loose from the mass.', 'red'); audio.bell(); this.shake(0.5);
    }
    if (b.phase2 && S.shards < 2 && this.time - S.phase2At > 12 && this.time - S.lastSear > 12) { this.splitShard(b); this.ui.toast('Another shard splits off.', 'red'); }
    // phase 2: shards that were not cauterized crawl back and rejoin
    for (const sh of this.enemies) {
      if (sh.type !== 'shard' || sh.dead) continue;
      sh.age = (sh.age || 0) + dt;
      if (sh.cauterized) continue;
      if (sh.age > 9) {
        sh.prey = { pos: b.pos, dead: false, hurt: () => {} };
        if (sh.pos.distanceTo(b.pos) < b.def.radius + 0.9) {
          b.hp = Math.min(b.maxHp - (b.searDmg || 0), b.hp + sh.hp + 50); sh.hp = 0; sh.dead = true; sh.state = 'dead'; sh.deadT = 9;
          this.fx.burst(b.pos.clone().setY(1.2), 30, 0xa040ff, 4, 2, 0.6); this.ui.toast('The shard rejoins the mass.', 'red');
        }
      }
    }
  }
  splitShard(b) {
    const S = this.clot; S.shards++;
    const a = Math.random() * 6.28, at = b.pos.clone().add(new THREE.Vector3(Math.sin(a) * 2.4, 0, Math.cos(a) * 2.4));
    const sh = new Enemy(this, 'shard', at, 1); sh.wave = 'CLOT'; sh.aggro = true; sh.age = 0; this.enemies.push(sh);
    this.fx.burst(at.clone().setY(1), 40, 0x46f0e0, 5, 2, 0.6);
  }
  async onClotDown() {
    const f = this.save.flags;
    for (const e of this.enemies) if (!e.dead) { e.hp = 0; e.dead = true; e.state = 'dead'; e.deadT = 0; }
    f.bossDown = true; this.boss = null; this.objective = ''; this.persist('boss');
    await sleep(2400);
    if (!this.inOpening() || this.state !== 'play') return;
    this.afterClot();
  }
  // 0.10.6: the street is safe; (0.10.7 adds the loot) then character creation
  afterClot() { this.beginCreation(); }
  // legacy entry point (0.9 and older flows call this): the cold open now starts with the case
  runIntro() { return this.runCase(); }

  // ---- waves & objectives --------------------------------------------------
  resumeProgress() {
    const f = this.save.flags;
    if (f.boss) { this.hunts = true; this.objective = 'Hunt the abominations. Temper your gear at the <b>Forge</b>.'; return; }
    if (f.waveC) { this.objective = 'Enter the <b>Grave Gate</b> court'; return; }
    if (f.waveB) { this.spawnWave('C'); return; }
    if (f.waveA) { this.objective = 'Purge <b>Statute Plaza</b>'; return; }
    this.spawnWave('A');
  }
  spawnWave(id) {
    const L = this.save.level;
    const at = (type, x, z, lvl = L, aggro = false) => { const e = new Enemy(this, type, new THREE.Vector3(x, 0, z), lvl); e.aggro = aggro; e.wave = id; this.enemies.push(e); return e; };
    this.wave = id;
    if (id === 'A') {
      at('husk', -2.5, 30, 1, true); at('husk', 2.5, 27, 1, true); at('husk', 0, 23, 1, true);
      if (this.inOpening()) { this.spawnCivilians(); this.objective = 'Hollowed in the street. <b>Protect the people</b>'; this.teach = { t: 0, step: 0 }; }
      else this.objective = 'The Grave Gate is breached. Purge the Hollowed';
    }
    if (id === 'B') { at('husk', -8, -3, L); at('husk', 9, 4, L); at('skitter', -4, -8, L); at('skitter', 5, -9, L); at('spitter', 0, -11, L); this.objective = 'Purge <b>Statute Plaza</b>'; }
    if (id === 'C') { at('husk', -3, -26, L); at('husk', 3, -31, L); at('spitter', 0, -42, L); at('skitter', -3, -46, L); at('skitter', 3, -48, L); at('husk', 0, -52, L); at('spitter', 4, -36, L); this.objective = 'Clear <b>Lantern Street</b> to the Grave Gate'; }
    if (id === 'BOSS') {
      this.boss = at('bellwright', 0, -78, Math.max(2, L), false);
      at('skitter', -6, -70, L); at('skitter', 6, -70, L);
      this.objective = 'Slay <b>the Bellwright</b>';
    }
  }
  // ---- 0.10.3 cold-open skirmish: three civilians and the watchman at the gaol ----
  spawnCivilians(ledger = null) {
    this.clearCivilians();
    const defs = [
      { id: 'vendor', label: 'The lantern-cart vendor', x: 3.8, z: 32.5, coat: 0x3a2e22, hood: true },
      { id: 'laborer1', label: 'A laborer under the arch', x: -4.6, z: 35.2, coat: 0x26303a, hood: false },
      { id: 'laborer2', label: 'A laborer under the arch', x: -3.3, z: 36.8, coat: 0x332a30, hood: true },
    ];
    const game = this;
    this.civs = defs.map((d) => {
      const m = buildPerson({ coat: d.coat, hood: d.hood }); m.position.set(d.x, 0, d.z); m.rotation.y = Math.atan2(-d.x, 26 - d.z);
      this.scene.add(m);
      const c = { ...d, m, pos: m.position, hp: 40, max: 40, state: 'safe', dead: false, warned: false,
        hurt(dmg) {
          if (c.dead) return; c.hp -= dmg; audio.hit?.(false, false); game.fx.burst(c.pos.clone().setY(1.2), 10, 0xff3050, 3, 1.5, 0.4);
          if (!c.warned) { c.warned = true; game.ui.toast(`${c.label} is under attack!`, 'red'); }
          if (c.hp <= 0) { c.dead = true; c.state = 'dead'; m.rotation.x = -1.5; m.position.y = 0.25; game.ui.toast(`${c.label} is dead.`, 'red'); }
          else if (c.hp <= c.max * 0.5 && c.state === 'safe') { c.state = 'wounded'; m.rotation.x = 0.35; m.position.y = -0.15; }
        } };
      const st = ledger?.civilians?.[d.id];
      if (st === 'dead') { c.dead = true; c.state = 'dead'; c.hp = 0; m.rotation.x = -1.5; m.position.y = 0.25; }
      else if (st === 'wounded') { c.state = 'wounded'; c.hp = 20; m.rotation.x = 0.35; m.position.y = -0.15; }
      return c;
    });
    if (!this.cart) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.8), new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.85 })); box.position.y = 0.75; g.add(box);
      for (const sx of [-0.5, 0.5]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 14), new THREE.MeshStandardMaterial({ color: 0x1c1a18 })); w.position.set(sx, 0.3, 0.42); g.add(w); }
      for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: new THREE.Color(1, 0.62, 0.2), emissiveIntensity: 2.2 })); l.position.set(-0.4 + i * 0.4, 1.18, 0); g.add(l); }
      g.position.set(4.9, 0, 32.2); g.rotation.y = 0.3; this.scene.add(g); this.cart = g;
    }
    this.cart.visible = true;
    const w = this.watch;
    this.watchman = { pos: w.position, dead: false, hurtFlag: !!ledger?.watchmanHurt, cd: 1, hurt: (dmg) => {
      if (!this.watchman.hurtFlag) { this.watchman.hurtFlag = true; this.ui.toast('The watchman is hurt, but he holds the gaol approach.', 'red'); }
      this.fx.burst(w.position.clone().setY(1.3), 8, 0xff3050, 3, 1.5, 0.4); void dmg; } };
  }
  clearCivilians() {
    if (this.civs) for (const c of this.civs) this.scene.remove(c.m);
    this.civs = null; this.watchman = null; this.teach = null;
    if (this.cart) this.cart.visible = false;
  }
  skirmishUpdate(dt) {
    const p = this.player.pos, w = this.watchman;
    const husks = this.enemies.filter((e) => !e.dead && e.wave === 'A');
    husks.forEach((e, i) => {
      if (e.provokedT > 0 || e.pos.distanceTo(p) < 4.5) { e.prey = null; return; }
      if (i === 0 && husks.length > 1 && w && e.pos.distanceTo(w.pos) < 16) { e.prey = w; return; }
      let best = null, bd = 18;
      for (const c of this.civs) { if (c.dead) continue; const d = e.pos.distanceTo(c.pos); if (d < bd) { bd = d; best = c; } }
      e.prey = best;
    });
    // the watchman's polearm keeps one approach (never a killing blow)
    if (w && (w.cd -= dt) <= 0) {
      const near = husks.find((e) => e.pos.distanceTo(w.pos) < 2.6 && e.hp > 12);
      if (near) { w.cd = 1.7; near.hurt(7, w.pos.clone(), 1, false); near.provokedT = 0; this.watch.rotation.y = Math.atan2(near.pos.x - w.pos.x, near.pos.z - w.pos.z); }
      else w.cd = 0.3;
    }
    // soft gate: the opening stays at the gaol and this stretch of street
    if (p.z < 19) { p.z = 19; if (!this._gateT || this.time - this._gateT > 4) { this._gateT = this.time; this.ui.toast('Gaoler Brann: "Warden! The people here, not the Gate!"'); } }
    // contextual teaching: move / light / heavy, then dodge, then stamina
    const T = this.teach, touch = !!this.touch?.on;
    if (T) {
      T.t += dt;
      if (T.step === 0 && T.t > 1.2) { T.step = 1; this.ui.toast(touch ? 'Left thumb moves. STRIKE for a light attack, HEAVY for a heavy one.' : 'WASD to move. Left click for a light attack, right click for a heavy one.'); }
      if (T.step === 1 && husks.some((e) => e.state === 'windup' && e.pos.distanceTo(p) < 4 && !e.prey)) { T.step = 2; this.ui.toast(touch ? 'ROLL through an attack as it lands.' : 'Space to roll through an attack as it lands.'); }
      if (T.step >= 1 && !T.sta && this.player.sta < this.stats.sta * 0.35) { T.sta = true; this.ui.toast('Strikes and rolls spend stamina, the green bar. Ease off and it refills.'); }
    }
  }
  closeSkirmish() {
    const f = this.save.flags, cs = this.civs || [];
    const civilians = Object.fromEntries(cs.map((c) => [c.id, c.state]));
    f.ledger = { ...(f.ledger || {}), civiliansDead: cs.filter((c) => c.dead).length, civilians, watchmanHurt: !!this.watchman?.hurtFlag,
      present: ['brann', 'watchman', 'mira', ...cs.filter((c) => !c.dead).map((c) => c.id)] };
    for (const e of this.enemies) e.prey = null;
    this.teach = null;
  }
  waveAlive(id) { return this.enemies.some((e) => e.wave === id && !e.dead); }
  progress() {
    const f = this.save.flags, p = this.player.pos;
    if (this.wave === 'A' && !this.waveAlive('A') && !f.waveA) {
      f.waveA = true; this.persist('progress');
      if (this.inOpening()) { this.objective = ''; setTimeout(() => { if (!this.inOpening() || this.state !== 'play') return; if (!f.judged) this.runVerdict(); else this.beginCreation(); }, 1600); }
      else { this.objective = 'Push north into <b>Statute Plaza</b>'; this.ui.toast('The street is clear. Push north.'); }
      if (this.civs) this.closeSkirmish();
      if (this.inOpening()) { const pl = this.player; pl.charge = clamp(pl.charge, 55, 70); f.openCharge = Math.round(pl.charge); }
      if (!f.starterCore && !this.inOpening()) { f.starterCore = true; this.dropAt(new THREE.Vector3(0, 0, 21), makeCore('arc', 1)); this.ui.toast('An Arc Core fell from the Hollowed. Install Cores at the Forge.', 'cyan'); }
    }
    if (f.waveA && !f.waveB && this.wave !== 'B' && p.z < 18 && !this.inOpening()) this.spawnWave('B');
    if (this.wave === 'B' && !this.waveAlive('B') && !f.waveB) {
      f.waveB = true; this.persist('progress'); this.ui.banner('STATUTE PLAZA HELD', 'Use the Forge (east side of the plaza) to temper gear');
      this.objective = 'Visit the <b>Forge</b>, then clear <b>Lantern Street</b> north';
      setTimeout(() => this.spawnWave('C'), 1200);
    }
    if (this.wave === 'C' && !this.waveAlive('C') && !f.waveC) { f.waveC = true; this.persist('progress'); this.objective = 'Enter the <b>Grave Gate</b> court'; }
    if (f.waveC && !f.boss && !this.boss && p.z < -58 && f.opening === 'legacy') { this.spawnWave('BOSS'); this.ui.say(STORY.bossIntro).then(() => { this.boss.aggro = true; }); this.ui.banner('THE BELLWRIGHT', 'Abomination of the Sump'); audio.bell(); }
    if (this.boss && !this.boss.dead && !this.boss.phase2 && this.boss.hp < this.boss.maxHp * 0.5) {
      this.boss.phase2 = true; this.ui.toast('The Bellwright tolls. More of them answer.', 'red'); audio.bell();
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
    if (e.hp / e.maxHp < 0.35 && !A?.nocrit) dmg *= 1 + 0.25 * this.perk('executioner');
    const crit = !A?.nocrit && (!!A?.riposte || Math.random() * 100 < s.crit);
    if (crit) dmg *= 1 + s.critDmg / 100;
    dmg *= rand(0.92, 1.08);
    e.hurt(dmg, p.pos, A ? A.poise : 0.5, crit); e.lastHitT = this.time;
    const hp = e.pos.clone().lerp(p.pos, 0.35); hp.y = e.elite ? 2.2 : 1.1;
    this.fx.number(hp, Math.round(dmg) + (crit ? '!' : ''), crit ? 'crit' : src === 'arc' ? 'arc' : '');
    if (src === 'blade') {
      this.fx.burst(hp, crit ? 26 : 14, 0xff3a50, 7, 2.5, 0.4);
      this.fx.burst(hp, 8, 0x46f0e0, 4, 1, 0.6);
      this.hitstop = Math.max(this.hitstop, (A.heavy ? 0.11 : 0.055) + (crit ? 0.03 : 0));
      this.shake(A.heavy ? 0.32 : 0.14);
      audio.hit(A.heavy, crit);
      this.addCharge((A.heavy ? 16 : 8) * (1 + 0.35 * this.perk('capacitor')));
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
  // ---- 0.10.5 Synth Charge: hits and perfect dodges build it; Cauterize (no perk) and Overload spend it ----
  cauterizeCost() { return 50; }
  addCharge(n) {
    const p = this.player, was = p.charge;
    p.charge = Math.min(100, p.charge + n); p.chargeT = this.time;
    if (was < this.cauterizeCost() && p.charge >= this.cauterizeCost()) this.chargeReady();
  }
  chargeReady() {
    const p = this.player;
    this.fx.burst(p.pos.clone().setY(1.2), 24, 0x46f0e0, 4, 1.6, 0.5); this.fx.ring(p.pos.clone(), 2.2, 0.35, 0x46f0e0, 0.2);
    audio.charge(0.25); navigator.vibrate?.(40);
    if (!this.save.flags.tipCaut) { this.save.flags.tipCaut = true; this.ui.toast(this.touch?.on ? 'The synthblade is charged. Tap CAUTERIZE.' : 'The synthblade is charged. Press C to Cauterize.', 'cyan'); }
  }
  chargeTick(dt) {
    const p = this.player;
    if (this.dialogueOpen || this.ui.isOpen || this.slow || this.state !== 'play') { p.chargeT = Math.max(p.chargeT || 0, this.time - 3); return; }
    if (p.charge > 0 && this.time - (p.chargeT || 0) > 3) p.charge = Math.max(0, p.charge - 5 * dt);
    // out of combat, the Warden's wounds close (8-10 HP/s after 4 s)
    const quiet = this.time - (p.lastHurtT || -99) > 4 && this.time - (p.chargeT || -99) > 4 && !this.enemies.some((e) => !e.dead && e.aggro && e.pos.distanceTo(p.pos) < 16);
    if (quiet && p.state !== 'dead' && p.hp < this.stats.hp) p.hp = Math.min(this.stats.hp, p.hp + 9 * dt);
  }
  cauterize() {
    const p = this.player, cost = this.cauterizeCost();
    if (p.state === 'dead') return;
    if (p.charge < cost) { this.ui.toast('Not enough Charge. Land hits to build it.'); return; }
    p.charge -= cost; p.chargeT = this.time;
    const dir = this.lockTarget ? Math.atan2(this.lockTarget.pos.x - p.pos.x, this.lockTarget.pos.z - p.pos.z) : p.face;
    p.face = dir;
    const fwd = new THREE.Vector3(Math.sin(dir), 0, Math.cos(dir));
    // a directed searing line: VFX along the cone
    for (let i = 1; i <= 7; i++) this.fx.burst(p.pos.clone().addScaledVector(fwd, i).setY(1.1), 10, i % 2 ? 0x46f0e0 : 0xffd0a0, 3, 1.2, 0.45);
    this.fx.bolt(p.pos.clone().setY(1.2), p.pos.clone().addScaledVector(fwd, 7.5).setY(1.1));
    audio.nova(); this.shake(0.35); this.hitstop = 0.07;
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = e.pos.clone().sub(p.pos).setY(0), d = to.length();
      if (d > 7.5 + e.def.radius || Math.abs(angleDiff(dir, Math.atan2(to.x, to.z))) > (d < 2 ? 1.2 : 0.55)) continue;
      // 15-20% of a big body's max HP; ordinary Hollowed take a heavy searing hit
      const sear = e.elite ? e.maxHp * 0.175 : Math.max(e.maxHp * 0.175, this.stats.dmgFinal * 2.2);
      e.cauterized = true; e.cauterT = this.time; n++;
      const before = e.hp;
      this.hitEnemy(e, { mult: sear / Math.max(1, this.stats.dmgFinal), poise: 8, nocrit: true }, 'arc');
      e.searDmg = (e.searDmg || 0) + Math.max(0, before - Math.max(0, e.hp));
      if (this.clot && (e.type === 'clot' || e.type === 'shard')) this.clot.lastSear = this.time;
      this.fx.burst(e.pos.clone().setY(1.2), 30, 0xffd0a0, 4, 2, 0.6);
      e.onCauterized?.();
    }
    this.save.flags.cauterized = (this.save.flags.cauterized || 0) + 1;
    return n;
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
    p.sta = Math.min(s.sta, p.sta + 20); this.addCharge(10);
    this.slowmo(1.1, 0.22, false, 'perfect');
    const at = p.pos.clone().setY(1.1);
    this.fx.ring(p.pos.clone(), 3.2, 0.35, 0x46f0e0, 0.25);
    this.fx.burst(at, 30, 0x46f0e0, 5, 1.5, 0.5);
    this.fx.number(at.clone().setY(2.1), 'PERFECT', 'perfect');
    audio.perfect();
    if (!this.save?.flags?.tipRiposte && this.save) { this.save.flags.tipRiposte = true; this.ui.toast('Perfect dodge. Strike now for a guaranteed critical Riposte.', 'cyan'); }
    void from;
  }
  onPlayerHurt(d) { this.player.lastHurtT = this.time; this._onPlayerHurt(d); }
  _onPlayerHurt(d) { this.ui.hurtFlash(d / this.stats.hp * 3); this.shake(0.25); this.player.hurtT = 0.2; this.fx.burst(this.player.pos.clone().setY(1.2), 8, 0x802030, 3, 1, 0.3); }
  onPlayerDeath() { audio.death(); this.lockTarget = null; setTimeout(() => this.ui.open('dead'), 1400); }
  respawn() {
    const p = this.player;
    if (this.inOpening() && this.save.flags.merged && !this.save.flags.bossDown) {
      // defeat by the Clot returns to the boss checkpoint: a fresh mass, full health
      p.state = 'move'; p.hp = this.stats.hp; p.sta = this.stats.sta; p.pos.set(0, 0, 38.5); p.face = Math.PI; this.save.stims = 3;
      this.ui.close(); this.startClot(); this.persist('respawn');
      this.ui.banner('SYNCHRONIZATION RESTORED', 'Back at the gaol. The Clot waits in the street');
      return;
    }
    p.state = 'move'; p.hp = this.stats.hp; p.sta = this.stats.sta; p.pos.copy(POI.respawn); p.face = Math.PI;
    this.save.stims = 3;
    for (const e of this.enemies) { e.aggro = false; if (e.elite) { e.hp = e.maxHp; e.pos.copy(e.home); e.phase2 = false; } }
    this.enemies = this.enemies.filter((e) => { if (!e.elite && e.wave === 'BOSS') { e.dispose(); return false; } return true; });
    if (this.boss && !this.boss.dead) { this.boss.aggro = false; }
    this.ui.close(); this.persist('respawn');
    this.ui.banner('SYNCHRONIZATION RESTORED', 'Resumed from your last checkpoint');
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
    const xp = Math.round(e.def.xp * (1 + 0.15 * (e.level - 1)));
    if (this.inOpening()) sv.flags.deferredXp = (sv.flags.deferredXp || 0) + xp; else this.gainXp(xp);
    if (this.perk('verdict')) { p.sta = Math.min(s.sta, p.sta + 25); p.hp = Math.min(s.hp, p.hp + s.hp * 0.04); }
    if (this.perk('leech_protocol')) p.hp = Math.min(s.hp, p.hp + s.hp * 0.06);
    // loot
    if (e.type === 'clot') { this.onClotDown(e); this.persist('boss'); return; }
    if (e.type === 'husk' && this.inOpening()) (this.huskFell = this.huskFell || []).push(e.pos.clone().setY(0));
    if (e.elite) {
      this.dropAt(e.pos.clone().add(new THREE.Vector3(1.2, 0, 0)), randomGear(sv.level + 1, 6));
      this.dropAt(e.pos.clone().add(new THREE.Vector3(-1.2, 0, 0.5)), makeItem('blade', Math.random() < 0.35 ? 4 : 3, sv.level + 1));
      this.dropAt(e.pos.clone().add(new THREE.Vector3(0, 0, 1.4)), makeCore(null, 2));
      sv.flags.boss = true; this.persist('boss');
      setTimeout(async () => { this.ui.banner('HALLOWMERE HOLDS', 'For tonight'); await this.ui.say(STORY.victory); this.hunts = true; this.objective = 'Hunt the abominations. Temper your gear at the <b>Forge</b>.'; }, 1500);
    } else if (!this.inOpening()) {
      const r = Math.random();
      if (r < 0.26) this.dropAt(e.pos.clone(), randomGear(sv.level, 0));
      else if (r < 0.34) this.dropAt(e.pos.clone(), makeCore(null, Math.random() < 0.15 ? 2 : 1));
    }
    this.persist(e.elite ? 'boss' : 'auto');
  }
  gainXp(x) {
    const sv = this.save; sv.xp += x;
    while (sv.xp >= this.xpNeed()) {
      sv.xp -= this.xpNeed(); sv.level++; sv.points++;
      this.refreshStats(); this.player.hp = this.stats.hp;
      this.ui.banner(`LEVEL ${sv.level}`, 'Skill point earned. Press K'); audio.levelUp();
      this.levelled = true;
    }
    if (this.levelled) { this.levelled = false; this.persist('level'); }
  }
  dropAt(pos, item, restored = false) {
    const col = item.kind === 'core' ? CORES[item.core].color : RARITIES[tierOf(item)].color;
    const m = buildLoot(col, item.kind === 'core', item.kind === 'core' ? 2 : tierOf(item));
    pos.y = 0; if (!walkable(pos.x, pos.z, 0.5)) pos.copy(this.player.pos);
    m.position.copy(pos); this.scene.add(m);
    this.loot.push({ m, item, t: restored ? 1 : 0 });
  }
  pickup(l) {
    const sv = this.save;
    l.item.got = Date.now(); l.item.seen = false; sv.bag.push(l.item); this.scene.remove(l.m);
    const col = l.item.kind === 'core' ? CORES[l.item.core].color : RARITIES[tierOf(l.item)].color;
    this.ui.toast(`${itemName(l.item)}`, 'loot', col);
    audio.pickup(tierOf(l.item));
    this.persist('pickup');
  }
  // ---- inventory actions ---------------------------------------------------------
  equip(uid) {
    const sv = this.save, i = sv.bag.findIndex((x) => x.uid === uid); if (i < 0) return;
    const it = sv.bag[i]; if (it.kind !== 'gear') return;
    sv.bag.splice(i, 1);
    if (sv.equip[it.slot]) sv.bag.push(sv.equip[it.slot]);
    sv.equip[it.slot] = it; this.refreshStats(); this.persist('equip'); audio.pickup(2);
  }
  toggleFav(uid) {
    const it = this.findGear(uid) || this.save.bag.find((x) => x.uid === uid); if (!it) return;
    it.fav = !it.fav; audio.ui(); this.persist('lock');
  }
  // bulk salvage: every unlocked pack item that passes test(it). Returns [count, scrap].
  salvageMany(test) {
    const sv = this.save; let n = 0, v = 0;
    sv.bag = sv.bag.filter((it) => { if (it.fav || !test(it)) return true; n++; v += salvageValue(it); return false; });
    if (n) { sv.scrap += v; this.ui.toast(`Salvaged ${n} item${n > 1 ? 's' : ''} for ${v} scrap`); audio.forge(); this.persist('salvage'); }
    return [n, v];
  }
  salvage(uid) {
    const sv = this.save, i = sv.bag.findIndex((x) => x.uid === uid); if (i < 0 || sv.bag[i].fav) return;
    const v = salvageValue(sv.bag[i]); sv.bag.splice(i, 1); sv.scrap += v; this.ui.toast(`Salvaged for ${v} scrap`); this.persist('salvage');
  }
  findGear(uid) { const sv = this.save; return Object.values(sv.equip).find((x) => x?.uid === uid) || sv.bag.find((x) => x.uid === uid); }
  upgrade(uid) {
    const it = this.findGear(uid); if (!it || it.upgrade >= MAX_UPGRADE) return;
    const c = upgradeCost(it); if (this.save.scrap < c) return;
    this.save.scrap -= c; it.upgrade++; this.refreshStats(); this.persist('forge');
    audio.forge(); this.fx.burst(POI.forge.clone().setY(1.1), 40, 0xffa040, 5, 3, 0.6); this.ui.toast(`${itemName(it)}`, 'gold');
  }
  socket(uid, coreUid) {
    const it = this.findGear(uid), sv = this.save, ci = sv.bag.findIndex((x) => x.uid === coreUid);
    if (!it || ci < 0 || it.cores.length >= it.sockets) return;
    it.cores.push(sv.bag.splice(ci, 1)[0]); this.refreshStats(); this.persist('forge'); audio.zap(); audio.forge();
    this.ui.toast(`Core installed in ${it.name}`, 'loot', RARITIES[it.rarity].color);
  }
  extract(uid, i) {
    const it = this.findGear(uid); if (!it || !it.cores[i]) return;
    const c = it.cores.splice(i, 1)[0]; this.save.scrap += 5 * c.grade; this.refreshStats(); this.persist('forge');
  }
  learnPerk(id) {
    const sv = this.save, p = PERKS.find((x) => x.id === id);
    const spent = PERKS.filter((x) => x.branch === p.branch).reduce((a, x) => a + (sv.perks[x.id] || 0), 0);
    if (!sv.points || (sv.perks[id] || 0) >= p.max || spent < TIER_REQ[p.tier]) return false;
    sv.points--; sv.perks[id] = (sv.perks[id] || 0) + 1; this.refreshStats(); this.persist('perk'); audio.perkUnlock(sv.perks[id] >= p.max);
    return true;
  }
  respecCost() { return 15 * Object.values(this.save.perks).reduce((a, r) => a + r, 0); }
  // Unlearn every perk at the Forge for scrap; all points come back.
  respec() {
    const sv = this.save, spent = Object.values(sv.perks).reduce((a, r) => a + r, 0), cost = this.respecCost();
    if (!this.nearForge || !spent || sv.scrap < cost) return false;
    sv.scrap -= cost; sv.points += spent; sv.perks = {};
    this.refreshStats(); this.player.charge = Math.min(this.player.charge, 100);
    audio.forge(); this.persist('respec');
    return true;
  }
  applySetting(k, v) {
    if (k === 'mute') { audio.setMuted(v); this.settings.mute = v; }
    else this.settings[k] = v;
    if (k === 'bloom') this.bloom.enabled = v;
    if (k === 'scale') this.onResize?.();
    localStorage.setItem(SET_KEY, JSON.stringify(this.settings));
  }
  onPanelClosed() { if (this.state === 'play' && !document.pointerLockElement && !this.touch?.on) this.requestLock?.(); }

  // ---- input --------------------------------------------------------------------------
  bindInput() {
    const cv = this.renderer.domElement;
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
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
    this.requestLock = () => { if (this.touch?.on) return; try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} };
  }
  interact() {
    if (this.nearForge) { this.save.stims = 3; this.ui.open('forge'); return; }
    if (this.nearCache) {
      this.save.flags.cache = true; this.cacheMarker.visible = false;
      this.dropAt(POI.cache.clone().add(new THREE.Vector3(1.5, 0, 0)), randomGear(this.save.level, 3));
      this.dropAt(POI.cache.clone().add(new THREE.Vector3(1.5, 0, 1.2)), makeCore(null, 1));
      this.save.scrap += 25; this.ui.toast('+25 scrap from the cache'); this.persist('cache');
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
        sprint: k.ShiftLeft || k.ShiftRight || !!this.touch?.sprint, dodge: this.consume('Space'), light: this.consume('light'), heavy: this.consume('heavy'),
        stim: this.consume('KeyR'), joy: this.joy,
      };
      if (!block && this.consume('KeyF')) this.overload();
      if (!block && this.consume('KeyC')) this.cauterize();
      if (!block && this.consume('KeyQ')) this.toggleLock();
      if (this.lockTarget && (this.lockTarget.dead || this.lockTarget.pos.distanceTo(p.pos) > 24)) this.lockTarget = null;
      p.update(dt, inp, this.camYaw);
      if (this.lockTarget) this.camYaw = dampAngle(this.camYaw, Math.atan2(this.lockTarget.pos.x - p.pos.x, this.lockTarget.pos.z - p.pos.z), 6, dtReal);
      this.edge = {};
    } else if (this.state === 'story') {
      p.update(dt, this.storyInp || {}, this.camYaw);
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
      if (!paused && this.civs && this.inOpening()) this.skirmishUpdate(dt);
      if (!paused && this.clot && this.boss?.type === 'clot') this.clotUpdate(dt);
      this.chargeTick(dt);
      if (!paused) this.progress();
      // play time counts wall-clock seconds (dt is clamped on slow frames), capped so a backgrounded tab doesn't count
      const now = performance.now(), wall = this.lastWall ? Math.min(1, (now - this.lastWall) / 1000) : 0; this.lastWall = now;
      if (!paused) this.save.playTime = (this.save.playTime || 0) + wall;
      const area = Save.areaAt(p.pos.x, p.pos.z);
      if (area !== this.area) { const first = !this.area; this.area = area; if (!first && p.state !== 'dead') this.persist('area'); }
      this.autosave = (this.autosave || 0) + dtReal; if (this.autosave > 15) this.persist();
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
