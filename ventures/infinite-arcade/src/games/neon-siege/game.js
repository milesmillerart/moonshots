/* Neon Siege: arena survivor. Move, auto-fire, collect shards, pick upgrades, outlast the swarm. */
(function () {
  'use strict';
  const S = Kit.stage(document.getElementById('c'), {});
  const ctx = S.ctx, A = Kit.audio;
  let state = 'menu', P, enemies, bullets, gems, parts, texts, time, kills, spawnAcc, eliteT, xp, xpNeed, level, cam, zoom, joy, shake, bestNow, lastShot, pulseT, pulses, hurtFlash, demoT;
  const UPG = [
    { id: 'rate', name: 'Rapid Fire', desc: '+25% fire rate', max: 6 },
    { id: 'dmg', name: 'Heavy Rounds', desc: '+1 bullet damage', max: 6 },
    { id: 'multi', name: 'Split Shot', desc: '+1 projectile per volley', max: 4 },
    { id: 'pierce', name: 'Piercing Core', desc: 'Bullets pass through +1 enemy', max: 3 },
    { id: 'orbit', name: 'Orbit Blade', desc: '+1 blade circling you', max: 5 },
    { id: 'pulse', name: 'Nova Pulse', desc: 'Periodic shockwave, bigger each level', max: 5 },
    { id: 'speed', name: 'Thrusters', desc: '+12% move speed', max: 4 },
    { id: 'magnet', name: 'Tractor Field', desc: '+50% shard pickup radius', max: 3 },
    { id: 'hp', name: 'Hull Plating', desc: '+1 max HP and full repair', max: 5 },
  ];
  function reset() {
    P = { x: 0, y: 0, r: 14, hp: 5, maxHp: 5, speed: 210, inv: 0, fire: 2.2, dmg: 1, multi: 1, pierce: 0, orbit: 0, pulse: 0, magnet: 80, lv: {}, ang: 0, face: 0 };
    enemies = []; bullets = []; gems = []; parts = []; texts = []; pulses = [];
    time = 0; kills = 0; spawnAcc = 0; eliteT = 60; xp = 0; xpNeed = 5; level = 1; cam = { x: 0, y: 0 }; joy = null; shake = 0; lastShot = 0; pulseT = 0; hurtFlash = 0; demoT = 0;
  }
  const grid = new Map(), CS = 64;
  function buildGrid() { grid.clear(); for (const e of enemies) { const k = ((e.x / CS) | 0) + ',' + ((e.y / CS) | 0); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(e); } }
  function near(x, y, r, f) { const x0 = Math.floor((x - r) / CS), x1 = Math.floor((x + r) / CS), y0 = Math.floor((y - r) / CS), y1 = Math.floor((y + r) / CS); for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const a = grid.get(i + ',' + j); if (a) for (const e of a) f(e); } }

  function spawn(type) {
    const ang = Math.random() * Math.PI * 2, d = Math.max(S.W, S.H) / zoom * 0.6 + 60;
    const x = P.x + Math.cos(ang) * d, y = P.y + Math.sin(ang) * d, sc = 1 + time / 80;
    const T = {
      drone: { r: 11, hp: 2, sp: 85 + Math.random() * 25, c: '#ff3df2', xp: 1 },
      dart: { r: 8, hp: 1, sp: 165, c: '#36f1ff', xp: 1 },
      brute: { r: 22, hp: 12, sp: 55, c: '#ff9f1c', xp: 4 },
      elite: { r: 32, hp: 90, sp: 70, c: '#ffd23f', xp: 15 },
    }[type];
    enemies.push({ type: type, x: x, y: y, r: T.r, hp: Math.ceil(T.hp * sc), maxHp: Math.ceil(T.hp * sc), sp: T.sp, c: T.c, xp: T.xp, hit: 0, oc: 0 });
  }
  function hurtEnemy(e, d) {
    if (e.dead) return;
    e.hp -= d; e.hit = 0.08;
    if (e.hp <= 0) {
      e.dead = true; kills++;
      for (let i = 0; i < (e.type === 'elite' ? 10 : 1); i++) gems.push({ x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y + (Math.random() - 0.5) * e.r * 2, v: e.type === 'elite' ? 2 : e.xp });
      if (e.type === 'elite') { gems.push({ x: e.x, y: e.y, heart: true }); Kit.sdk.happytime(); }
      for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 160; parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, c: e.c }); }
      A.noise(0.08, 0.08, 1500); A.tone(220 + Math.random() * 80, 0.06, 'square', 0.05, 80);
    }
  }
  function shoot() {
    let best = null, bd = 480 * 480;
    for (const e of enemies) { const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2; if (d < bd) { bd = d; best = e; } }
    if (!best) return;
    const base = Math.atan2(best.y - P.y, best.x - P.x); P.face = base;
    for (let i = 0; i < P.multi; i++) {
      const a = base + (i - (P.multi - 1) / 2) * 0.16;
      bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 0.9, pierce: P.pierce, hitSet: new Set() });
    }
    A.tone(880, 0.04, 'square', 0.03, 440);
  }
  function levelUp() {
    level++; xp -= xpNeed; xpNeed = Math.floor(xpNeed * 1.28 + 3);
    A.tone(523, 0.1, 'triangle', 0.2); A.tone(659, 0.1, 'triangle', 0.2, null, 0.08); A.tone(784, 0.18, 'triangle', 0.2, null, 0.16);
    const pool = UPG.filter(u => (P.lv[u.id] || 0) < u.max);
    const choice = []; while (choice.length < 3 && pool.length) choice.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (!choice.length) return;
    state = 'pick'; joy = null;
    Kit.picks('Level ' + level + ' · choose an upgrade', choice.map(u => ({ name: u.name + ' ' + roman((P.lv[u.id] || 0) + 1), desc: u.desc, id: u.id })), it => { apply(it.id); state = 'play'; if (xp >= xpNeed) levelUp(); });
  }
  function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][n] || n; }
  function apply(id) {
    P.lv[id] = (P.lv[id] || 0) + 1;
    if (id === 'rate') P.fire *= 1.25; else if (id === 'dmg') P.dmg += 1; else if (id === 'multi') P.multi += 1; else if (id === 'pierce') P.pierce += 1;
    else if (id === 'orbit') P.orbit += 1; else if (id === 'pulse') P.pulse += 1; else if (id === 'speed') P.speed *= 1.12; else if (id === 'magnet') P.magnet *= 1.5;
    else if (id === 'hp') { P.maxHp += 1; P.hp = P.maxHp; }
  }
  function damagePlayer() {
    if (P.inv > 0 || state !== 'play') return;
    P.hp--; P.inv = 1; shake = 0.25; hurtFlash = 0.3;
    A.tone(180, 0.25, 'sawtooth', 0.2, 60); A.noise(0.2, 0.2, 600);
    if (P.hp <= 0) {
      state = 'dying'; demoT = 0;
      for (let i = 0; i < 50; i++) { const a = Math.random() * 6.28, s = 80 + Math.random() * 300; parts.push({ x: P.x, y: P.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: '#7ef9c8' }); }
      bestNow = Kit.best(score());
    }
  }
  function score() { return kills + Math.floor(time) * 2; }
  function fmtT(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function start() { reset(); state = 'play'; spawnAcc = 4; Kit.sdk.gameplayStart(); }

  function update(dt) {
    zoom = Kit.clamp(Math.min(S.cssW, S.cssH) / 600, 0.62, 1.5);
    if (state === 'pick' || state === 'paused') return;
    const live = state === 'play' || state === 'menu';
    if (live) {
      time += dt;
      // movement
      let mx = 0, my = 0;
      const K = Kit.keys;
      if (K.has('KeyA') || K.has('ArrowLeft')) mx -= 1; if (K.has('KeyD') || K.has('ArrowRight')) mx += 1;
      if (K.has('KeyW') || K.has('ArrowUp')) my -= 1; if (K.has('KeyS') || K.has('ArrowDown')) my += 1;
      if (joy && joy.active) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy); if (d > 6) { mx = dx / Math.max(d, 50); my = dy / Math.max(d, 50); } }
      if (state === 'menu') { demoT += dt; mx = Math.cos(demoT * 0.7); my = Math.sin(demoT * 1.1); }
      const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      P.x += mx * P.speed * dt; P.y += my * P.speed * dt;
      if (m > 0.1) P.ang = Math.atan2(my, mx);
      P.inv = Math.max(0, P.inv - dt);
      // spawning
      const rate = 1.6 + time * 0.045 + Math.pow(time / 60, 2) * 0.9;
      spawnAcc += rate * dt;
      while (spawnAcc >= 1) { spawnAcc -= 1; const r = Math.random(); spawn(time > 70 && r < 0.12 ? 'brute' : time > 25 && r < 0.35 ? 'dart' : 'drone'); }
      if (enemies.length > 420) enemies.splice(0, enemies.length - 420);
      eliteT -= dt; if (eliteT <= 0) { eliteT = 60; spawn('elite'); texts.push({ x: 0, y: 0, screen: true, txt: 'ELITE INBOUND', life: 2 }); A.tone(110, 0.6, 'sawtooth', 0.15, 220); }
      // shooting
      lastShot += dt; if (lastShot >= 1 / P.fire) { lastShot = 0; shoot(); }
      buildGrid();
      // enemies
      for (const e of enemies) {
        const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
        let vx = dx / d * e.sp, vy = dy / d * e.sp;
        near(e.x, e.y, e.r * 2, o => { if (o === e) return; const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy) || 1, min = e.r + o.r; if (od < min) { vx += ox / od * (min - od) * 8; vy += oy / od * (min - od) * 8; } });
        e.x += vx * dt; e.y += vy * dt; e.hit = Math.max(0, e.hit - dt); e.oc = Math.max(0, e.oc - dt);
        if (d < e.r + P.r - 3) damagePlayer();
      }
      // bullets
      for (const b of bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        near(b.x, b.y, 40, e => { if (b.life <= 0 || e.dead || b.hitSet.has(e)) return; if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + 4) ** 2) { hurtEnemy(e, P.dmg); b.hitSet.add(e); if (b.pierce-- <= 0) b.life = 0; } });
      }
      bullets = bullets.filter(b => b.life > 0);
      // orbit blades
      if (P.orbit) {
        for (let i = 0; i < P.orbit; i++) {
          const a = time * 3.2 + i * Math.PI * 2 / P.orbit, bx = P.x + Math.cos(a) * 64, by = P.y + Math.sin(a) * 64;
          near(bx, by, 50, e => { if (!e.dead && e.oc <= 0 && (e.x - bx) ** 2 + (e.y - by) ** 2 < (e.r + 12) ** 2) { hurtEnemy(e, 1 + Math.floor(P.dmg / 2)); e.oc = 0.35; } });
        }
      }
      // nova pulse
      if (P.pulse) {
        pulseT += dt;
        if (pulseT >= Math.max(1.6, 3.2 - P.pulse * 0.3)) {
          pulseT = 0; const R = 100 + P.pulse * 25;
          pulses.push({ x: P.x, y: P.y, r: 0, R: R, life: 0.35 });
          near(P.x, P.y, R, e => { if ((e.x - P.x) ** 2 + (e.y - P.y) ** 2 < R * R) { hurtEnemy(e, 1 + P.pulse); const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; e.x += (e.x - P.x) / d * 30; e.y += (e.y - P.y) / d * 30; } });
          A.tone(140, 0.25, 'sine', 0.2, 60);
        }
      }
      enemies = enemies.filter(e => !e.dead);
      // gems
      for (const g of gems) {
        const dx = P.x - g.x, dy = P.y - g.y, d = Math.hypot(dx, dy);
        if (d < P.magnet || g.pull) { g.pull = true; const s = 420 + (g.pullT = (g.pullT || 0) + dt) * 600; g.x += dx / d * s * dt; g.y += dy / d * s * dt; }
        if (d < P.r + 6) {
          g.got = true;
          if (g.heart) { P.hp = Math.min(P.maxHp, P.hp + 1); texts.push({ x: P.x, y: P.y - 20, txt: '+1 HP', life: 1 }); A.tone(660, 0.15, 'sine', 0.2); }
          else if (state === 'play') { xp += g.v; A.tone(1200 + Math.random() * 300, 0.04, 'sine', 0.05); }
        }
      }
      gems = gems.filter(g => !g.got && Math.abs(g.x - P.x) < 2000 && Math.abs(g.y - P.y) < 2000);
      if (state === 'play' && xp >= xpNeed) levelUp();
      if (state === 'menu' && P.hp < 5) P.hp = 5;
    }
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.life -= dt; }
    parts = parts.filter(q => q.life > 0);
    for (const q of pulses) { q.life -= dt; q.r = q.R * (1 - q.life / 0.35); }
    pulses = pulses.filter(q => q.life > 0);
    for (const q of texts) { q.life -= dt; if (!q.screen) q.y -= 30 * dt; }
    texts = texts.filter(q => q.life > 0);
    cam.x += (P.x - cam.x) * Math.min(1, dt * 8); cam.y += (P.y - cam.y) * Math.min(1, dt * 8);
    shake = Math.max(0, shake - dt); hurtFlash = Math.max(0, hurtFlash - dt);
    if (state === 'dying') { demoT += dt; if (demoT > 1.1) { state = 'over'; Kit.sdk.gameplayStop(); Kit.over({ score: score(), best: bestNow.best, isNew: bestNow.isNew, extra: ['Survived <b>' + fmtT(time) + '</b> · ' + kills + ' kills · level ' + level] }, start); } }
  }

  function render() {
    S.begin();
    const Wd = S.W, Hd = S.H;
    ctx.fillStyle = '#0a0818'; ctx.fillRect(0, 0, Wd, Hd);
    ctx.save();
    ctx.translate(Wd / 2, Hd / 2); ctx.scale(zoom, zoom);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 20 * shake, (Math.random() - 0.5) * 20 * shake);
    ctx.translate(-cam.x, -cam.y);
    const vw = Wd / zoom / 2 + 60, vh = Hd / zoom / 2 + 60;
    // grid floor
    ctx.strokeStyle = 'rgba(120,90,255,.13)'; ctx.lineWidth = 1;
    const gs = 60, x0 = Math.floor((cam.x - vw) / gs) * gs, y0 = Math.floor((cam.y - vh) / gs) * gs;
    ctx.beginPath();
    for (let x = x0; x < cam.x + vw; x += gs) { ctx.moveTo(x, cam.y - vh); ctx.lineTo(x, cam.y + vh); }
    for (let y = y0; y < cam.y + vh; y += gs) { ctx.moveTo(cam.x - vw, y); ctx.lineTo(cam.x + vw, y); }
    ctx.stroke();
    // gems
    for (const g of gems) {
      if (g.heart) { ctx.fillStyle = '#ff4d6d'; heart(g.x, g.y, 9); continue; }
      ctx.fillStyle = g.v > 1 ? '#ffd23f' : '#7ef9c8';
      ctx.beginPath(); ctx.moveTo(g.x, g.y - 6); ctx.lineTo(g.x + 4, g.y); ctx.lineTo(g.x, g.y + 6); ctx.lineTo(g.x - 4, g.y); ctx.fill();
    }
    // pulses
    for (const q of pulses) { ctx.strokeStyle = `rgba(126,249,200,${q.life * 2.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.28); ctx.stroke(); }
    // enemies
    for (const e of enemies) {
      if (Math.abs(e.x - cam.x) > vw || Math.abs(e.y - cam.y) > vh) continue;
      ctx.fillStyle = e.hit > 0 ? '#fff' : e.c;
      ctx.shadowColor = e.c; ctx.shadowBlur = e.type === 'elite' ? 20 : 8;
      if (e.type === 'dart') { const a = Math.atan2(P.y - e.y, P.x - e.x); ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * e.r * 1.4, e.y + Math.sin(a) * e.r * 1.4); ctx.lineTo(e.x + Math.cos(a + 2.4) * e.r, e.y + Math.sin(a + 2.4) * e.r); ctx.lineTo(e.x + Math.cos(a - 2.4) * e.r, e.y + Math.sin(a - 2.4) * e.r); ctx.fill(); }
      else if (e.type === 'brute' || e.type === 'elite') { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time * (e.type === 'elite' ? 1 : 0.5)); const n = e.type === 'elite' ? 8 : 6; ctx.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * 6.28, rr = i % 2 && e.type === 'elite' ? e.r * 0.7 : e.r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#1a0a2a'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.4, 0, 6.28); ctx.fill(); }
      if (e.type === 'elite' || (e.type === 'brute' && e.hp < e.maxHp)) { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 4); ctx.fillStyle = e.c; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * Math.max(0, e.hp / e.maxHp), 4); }
    }
    ctx.shadowBlur = 0;
    // bullets
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#7ef9c8'; ctx.shadowBlur = 10;
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 6.28); ctx.fill(); }
    // orbit blades
    ctx.fillStyle = '#b9a8ff'; ctx.shadowColor = '#b9a8ff';
    for (let i = 0; i < P.orbit; i++) { const a = time * 3.2 + i * Math.PI * 2 / P.orbit; ctx.save(); ctx.translate(P.x + Math.cos(a) * 64, P.y + Math.sin(a) * 64); ctx.rotate(a * 2); ctx.fillRect(-11, -3, 22, 6); ctx.fillRect(-3, -11, 6, 22); ctx.restore(); }
    // player
    if (state !== 'dying' && state !== 'over' && !(P.inv > 0 && Math.floor(P.inv * 16) % 2)) {
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.ang);
      ctx.shadowColor = '#7ef9c8'; ctx.shadowBlur = 18; ctx.fillStyle = '#e9fff6';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, 12); ctx.lineTo(-6, 0); ctx.lineTo(-12, -12); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (P.magnet > 81) { ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(126,249,200,.08)'; ctx.beginPath(); ctx.arc(P.x, P.y, P.magnet, 0, 6.28); ctx.stroke(); }
    }
    ctx.shadowBlur = 0;
    for (const q of parts) { ctx.globalAlpha = Math.max(0, q.life * 2); ctx.fillStyle = q.c; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.font = '800 14px system-ui,sans-serif';
    for (const q of texts) if (!q.screen) { ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = '#ff8fab'; ctx.fillText(q.txt, q.x, q.y); }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (hurtFlash > 0) { ctx.fillStyle = `rgba(255,40,80,${hurtFlash})`; ctx.fillRect(0, 0, Wd, Hd); }
    // HUD
    if (state !== 'menu') {
      const top = 12;
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, 0, Wd, 6);
      ctx.fillStyle = '#7ef9c8'; ctx.fillRect(0, 0, Wd * Math.min(1, xp / xpNeed), 6);
      ctx.fillStyle = '#ff4d6d'; for (let i = 0; i < P.maxHp; i++) { ctx.globalAlpha = i < P.hp ? 1 : 0.2; heart(22 + i * 22, top + 20, 8); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = '800 26px system-ui,sans-serif'; ctx.fillText(fmtT(time), Wd / 2, top + 30);
      ctx.font = '600 12px system-ui,sans-serif'; ctx.globalAlpha = 0.7; ctx.fillText('LV ' + level + ' · ' + kills + ' KILLS', Wd / 2, top + 47); ctx.globalAlpha = 1;
      for (const q of texts) if (q.screen) { ctx.globalAlpha = Math.min(1, q.life); ctx.font = '800 28px system-ui,sans-serif'; ctx.fillStyle = '#ffd23f'; ctx.fillText(q.txt, Wd / 2, Hd * 0.3); }
      ctx.globalAlpha = 1;
    }
    if (joy && joy.active) {
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, 6.28); ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), k = d > 50 ? 50 / d : 1;
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(joy.ox + dx * k, joy.oy + dy * k, 22, 0, 6.28); ctx.fill();
    }
  }
  function heart(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y + s * 0.9); ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4); ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); ctx.fill(); }

  Kit.pointer(S, {
    down: p => { if (state === 'play') joy = { ox: p.x, oy: p.y, x: p.x, y: p.y, active: true }; },
    move: p => { if (joy && joy.active) { joy.x = p.x; joy.y = p.y; } },
    up: () => { joy = null; },
  });
  function pause() {
    if (state !== 'play') return;
    state = 'paused'; Kit.sdk.gameplayStop();
    Kit.show('<h2>Paused</h2><h1>Neon Siege</h1><p>Survived ' + fmtT(time) + ' so far.</p><button class="dk-btn">Resume</button>', () => { state = 'play'; Kit.sdk.gameplayStart(); });
    // Kit.show wires the action to the button and Space/Enter
  }
  Kit.onKey(e => { if (e.code === 'Escape' || e.code === 'KeyP') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  reset(); zoom = 1;
  for (let i = 0; i < 25; i++) { time = 30; spawn(i % 5 ? 'drone' : 'dart'); } time = 0;
  Kit.loop(update, render);
  Kit.sdk.init().then(() => {
    Kit.sdk.loaded();
    Kit.menu({ title: 'Neon Siege', howto: 'Survive the swarm. Your ship fires on its own, so just move. Grab shards to level up and stack upgrades. A new elite shows up every minute.', keys: 'WASD / arrows · or drag anywhere to steer · Esc to pause' }, start);
  });
  window.__game = { get state() { return state; }, get score() { return score(); }, start: start, get player() { return P; }, get enemies() { return enemies.length; }, grantXp(n) { xp += n; }, warp(s) { time = s; eliteT = 2; } }; // test/screenshot hooks
})();
