/* Polarity Run: one-tap gravity flip runner through a neon corridor. */
(function () {
  'use strict';
  const H = 400, TOP = 70, BOT = 330, PS = 26, PX = 130;
  const S = Kit.stage(document.getElementById('c'), { h: H, minW: 420 });
  const ctx = S.ctx, A = Kit.audio;
  let state = 'menu', p, spikes, orbs, parts, trail, speed, dist, orbScore, nextX, lastSide, t, shake, dieT, buffer, bestNow, popups, milestone;
  const G = 2800;

  function reset() {
    p = { y: BOT - PS, vy: 0, g: 1, ground: true, rot: 0, coyote: 0 };
    spikes = []; orbs = []; parts = []; trail = []; popups = [];
    speed = 330; dist = 0; orbScore = 0; nextX = 900; lastSide = 1; t = 0; shake = 0; buffer = 0; milestone = 100;
  }
  function flipTime() { return Math.sqrt(2 * (BOT - TOP - PS) / G); }
  function gen() {
    const view = S.W + 200;
    while (nextX < dist + view) {
      // choose side: mostly alternate, sometimes repeat
      const side = Math.random() < 0.7 ? -lastSide : lastSide; // 1 = floor, -1 = ceiling
      const teeth = 1 + Math.floor(Math.random() * Math.min(7, 2 + dist / 1500));
      const len = teeth * 22;
      spikes.push({ x: nextX, len: len, side: side });
      // orb above/below the safe lane sometimes
      if (Math.random() < 0.45) orbs.push({ x: nextX + len / 2, y: side === 1 ? TOP + 18 : BOT - 18, got: false });
      if (Math.random() < 0.25) orbs.push({ x: nextX + len + 40, y: (TOP + BOT) / 2, got: false });
      const need = side !== lastSide ? speed * (flipTime() + 0.3) + PS + 40 : speed * 0.28 + 40;
      const slack = Math.max(0, 260 - dist / 60) * Math.random();
      nextX += len + need + slack;
      lastSide = side;
    }
  }
  function flip() {
    if (state !== 'play') return;
    if (p.ground || p.coyote > 0) doFlip(); else buffer = 0.14;
  }
  function doFlip() {
    p.g = -p.g; p.ground = false; p.coyote = 0; buffer = 0; p.vy = p.g * 120;
    A.tone(p.g > 0 ? 520 : 780, 0.09, 'square', 0.08, p.g > 0 ? 300 : 1200);
  }
  function die() {
    state = 'dying'; dieT = 0; shake = 0.4;
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, s = 100 + Math.random() * 400; parts.push({ x: PX + PS / 2, y: p.y + PS / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8 + Math.random() * 0.5, c: Math.random() < 0.5 ? '#ff3df2' : '#36f1ff' }); }
    A.noise(0.45, 0.3, 700); A.tone(300, 0.5, 'sawtooth', 0.15, 40);
    bestNow = Kit.best(score());
  }
  function score() { return Math.floor(dist / 10) + orbScore; }
  function start() { reset(); state = 'play'; Kit.sdk.gameplayStart(); }

  function update(dt) {
    t += dt;
    if (state === 'play' || state === 'menu') {
      if (state === 'menu') { // demo: auto-flip to dodge
        gen();
        const ahead = spikes.find(s => s.x + s.len > dist + PX - 10 && s.x < dist + PX + 150);
        if (ahead && ((ahead.side === 1 && p.g > 0) || (ahead.side === -1 && p.g < 0)) && p.ground) doFlip();
      }
      speed = Math.min(600, 330 + dist / 45);
      dist += speed * dt;
      gen();
      // physics
      p.vy += G * p.g * dt;
      p.y += p.vy * dt;
      const wasGround = p.ground;
      p.ground = false;
      if (p.g > 0 && p.y >= BOT - PS) { p.y = BOT - PS; p.vy = 0; p.ground = true; }
      if (p.g < 0 && p.y <= TOP) { p.y = TOP; p.vy = 0; p.ground = true; }
      if (p.ground && !wasGround) { A.tone(160, 0.05, 'triangle', 0.1); for (let i = 0; i < 6; i++) parts.push({ x: PX + Math.random() * PS, y: p.g > 0 ? BOT : TOP, vx: -speed * 0.4 - Math.random() * 80, vy: -p.g * Math.random() * 120, life: 0.3, c: '#9af' }); }
      if (p.ground) { p.coyote = 0.07; if (buffer > 0) doFlip(); } else p.coyote -= dt;
      buffer -= dt;
      const tr = p.g > 0 ? 0 : Math.PI; p.rot += (tr - p.rot) * Math.min(1, dt * 14);
      trail.push({ x: dist + PX, y: p.y }); if (trail.length > 14) trail.shift();
      // collisions (shrunk hitbox)
      const px0 = dist + PX + 4, px1 = dist + PX + PS - 4, py0 = p.y + 4, py1 = p.y + PS - 4;
      for (const s of spikes) {
        if (s.x > px1 || s.x + s.len < px0) continue;
        const sy0 = s.side === 1 ? BOT - 16 : TOP, sy1 = s.side === 1 ? BOT : TOP + 16;
        if (py1 > sy0 && py0 < sy1) { if (state === 'play') die(); else { /* demo */ } break; }
      }
      for (const o of orbs) {
        if (o.got) continue;
        if (Math.abs(o.x - (dist + PX + PS / 2)) < 20 && Math.abs(o.y - (p.y + PS / 2)) < 22) {
          o.got = true; if (state === 'play') { orbScore += 10; popups.push({ x: PX + 10, y: o.y, txt: '+10', life: 0.8 }); }
          A.tone(1046, 0.08, 'sine', 0.15); A.tone(1568, 0.12, 'sine', 0.12, null, 0.05);
        }
      }
      spikes = spikes.filter(s => s.x + s.len > dist - 100);
      orbs = orbs.filter(o => o.x > dist - 100);
      if (state === 'play' && score() >= milestone) { popups.push({ x: S.W / 2, y: H / 2, txt: milestone + '!', life: 1.2, big: true }); A.tone(A.note(10), 0.15, 'triangle', 0.15); A.tone(A.note(12), 0.2, 'triangle', 0.15, null, 0.08); milestone += 100; Kit.sdk.score(score()); }
    }
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.life -= dt; }
    parts = parts.filter(q => q.life > 0);
    for (const q of popups) { q.life -= dt; q.y -= 40 * dt; }
    popups = popups.filter(q => q.life > 0);
    shake = Math.max(0, shake - dt);
    if (state === 'dying') { dieT += dt; if (dieT > 0.8) { state = 'over'; Kit.sdk.gameplayStop(); Kit.over({ score: score(), best: bestNow.best, isNew: bestNow.isNew, extra: [Math.floor(dist / 10) + ' m run, ' + (orbScore / 10) + ' orbs'] }, start); } }
  }

  function render() {
    S.begin();
    const v = S.view, Wd = S.W;
    const g = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
    g.addColorStop(0, '#120a2e'); g.addColorStop(0.5, '#2a0f4a'); g.addColorStop(1, '#120a2e');
    ctx.fillStyle = g; ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 24 * shake, (Math.random() - 0.5) * 24 * shake);
    // sun + parallax skyline
    ctx.fillStyle = 'rgba(255,90,200,.18)'; ctx.beginPath(); ctx.arc(Wd * 0.7, H / 2, 90, 0, 6.28); ctx.fill();
    ctx.fillStyle = 'rgba(80,40,140,.55)';
    for (let i = -1; i < Wd / 60 + 2; i++) {
      const bx = i * 60 - (dist * 0.15 % 60), bh = 40 + (Math.abs(Math.sin((i + Math.floor(dist * 0.15 / 60)) * 12.9898)) * 90);
      ctx.fillRect(bx, H / 2 - bh / 2, 46, bh);
    }
    // corridor grid
    ctx.strokeStyle = 'rgba(54,241,255,.14)'; ctx.lineWidth = 1;
    for (let x = -(dist % 40); x < Wd; x += 40) { ctx.beginPath(); ctx.moveTo(x, BOT); ctx.lineTo(x - 30, H + 40); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x - 30, -40); ctx.stroke(); }
    ctx.fillStyle = '#0a0620'; ctx.fillRect(v.x, BOT, v.w, v.y + v.h - BOT); ctx.fillRect(v.x, v.y, v.w, TOP - v.y);
    ctx.shadowColor = '#36f1ff'; ctx.shadowBlur = 12; ctx.fillStyle = '#36f1ff';
    ctx.fillRect(v.x, BOT, v.w, 3); ctx.fillRect(v.x, TOP - 3, v.w, 3);
    // spikes
    ctx.shadowColor = '#ff3df2'; ctx.fillStyle = '#ff3df2';
    for (const s of spikes) {
      const sx = s.x - dist; if (sx > Wd + 50 || sx + s.len < -50) continue;
      ctx.beginPath();
      for (let k = 0; k < s.len / 22; k++) {
        const x0 = sx + k * 22;
        if (s.side === 1) { ctx.moveTo(x0, BOT); ctx.lineTo(x0 + 11, BOT - 22); ctx.lineTo(x0 + 22, BOT); }
        else { ctx.moveTo(x0, TOP); ctx.lineTo(x0 + 11, TOP + 22); ctx.lineTo(x0 + 22, TOP); }
      }
      ctx.fill();
    }
    // orbs
    ctx.shadowColor = '#ffd23f'; ctx.fillStyle = '#ffd23f';
    for (const o of orbs) { if (o.got) continue; const ox = o.x - dist; ctx.beginPath(); ctx.arc(ox, o.y + Math.sin(t * 5 + o.x) * 3, 7, 0, 6.28); ctx.fill(); }
    // player
    if (state !== 'dying' && state !== 'over') {
      ctx.shadowBlur = 0;
      trail.forEach((q, i) => { ctx.globalAlpha = i / trail.length * 0.35; ctx.fillStyle = '#36f1ff'; const s = PS * (0.4 + 0.6 * i / trail.length); ctx.fillRect(q.x - dist - (trail.length - i) * 0 + (PS - s) / 2, q.y + (PS - s) / 2, s, s); });
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(PX + PS / 2, p.y + PS / 2); ctx.rotate(p.rot);
      ctx.shadowColor = '#36f1ff'; ctx.shadowBlur = 18; ctx.fillStyle = '#e8fdff'; ctx.fillRect(-PS / 2, -PS / 2, PS, PS);
      ctx.shadowBlur = 0; ctx.fillStyle = '#120a2e'; ctx.fillRect(2, -6, 6, 6); ctx.fillStyle = '#36f1ff'; ctx.fillRect(-PS / 2, PS / 2 - 5, PS, 5);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    for (const q of parts) { ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); ctx.fillStyle = q.c; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
    ctx.restore();
    // HUD
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    if (state !== 'menu') {
      ctx.font = '800 30px system-ui,sans-serif'; ctx.fillText(String(score()), 16, 44);
      ctx.font = '600 12px system-ui,sans-serif'; ctx.globalAlpha = 0.6; ctx.fillText('BEST ' + Kit.store.get('best', 0), 16, 60); ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    for (const q of popups) { ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = (q.big ? '800 44px' : '800 18px') + ' system-ui,sans-serif'; ctx.fillStyle = q.big ? '#ffd23f' : '#fff'; ctx.fillText(q.txt, q.x, q.y); }
    ctx.globalAlpha = 1;
  }

  Kit.pointer(S, { down: () => flip() });
  Kit.onKey(e => { if (['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) flip(); });
  reset();
  Kit.loop(update, render);
  Kit.sdk.init().then(() => {
    Kit.sdk.loaded();
    Kit.menu({ title: 'Polarity Run', howto: 'Tap to flip gravity. Dodge the spikes on the floor and ceiling, grab gold orbs, and see how far you get as the speed ramps up.', keys: 'Space / Up / tap to flip' }, start);
  });
  window.__game = { get state() { return state; }, get score() { return score(); }, flip: flip, start: start, get gravity() { return p.g; },
    get world() { return { spikes: spikes, dist: dist, p: p, speed: speed, PX: PX, PS: PS }; } }; // test hooks
})();
