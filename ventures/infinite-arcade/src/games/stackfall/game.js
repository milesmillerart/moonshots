/* Stackfall: tap to drop the sliding slab. Overhangs get sliced off. Perfect drops chain. */
(function () {
  'use strict';
  const W = 400, H = 700, SH = 30, D = 16, BASE_W = 200;
  const S = Kit.stage(document.getElementById('c'), { w: W, h: H });
  const ctx = S.ctx, A = Kit.audio;
  let state = 'menu', stack, cur, falling, parts, popups, cam, combo, score, t, dieT, flash, shakeT, stars, bestNow;

  function hue(i) { return (190 + i * 9) % 360; }
  function reset() {
    stack = [{ x: (W - BASE_W) / 2, w: BASE_W }];
    falling = []; parts = []; popups = []; cam = 0; combo = 0; score = 0; t = 0; flash = 0; shakeT = 0;
    spawn();
  }
  function spawn() {
    const prev = stack[stack.length - 1], n = stack.length;
    cur = { w: prev.w, dir: n % 2 ? 1 : -1, ph: 0, x: 0 };
    cur.period = Math.max(0.62, 1.55 - n * 0.022);
    placeCur();
  }
  function placeCur() {
    // triangle wave from one side across to the other
    const p = (cur.ph % 2), tri = p < 1 ? p : 2 - p; // 0..1..0
    const s = cur.dir === 1 ? tri : 1 - tri;
    const minX = -cur.w * 0.45, maxX = W - cur.w * 0.55;
    cur.x = minX + (maxX - minX) * s;
  }
  function yOf(level) { return 610 - level * SH + cam; }

  function drop() {
    if (state !== 'play') return;
    window.__drops = (window.__drops || 0) + 1;
    const prev = stack[stack.length - 1], n = stack.length;
    const tol = 7;
    if (Math.abs(cur.x - prev.x) <= tol) {
      combo++;
      let w = prev.w;
      if (combo >= 3) w = Math.min(BASE_W, w + 8);
      const x = prev.x - (w - prev.w) / 2;
      stack.push({ x: x, w: w });
      flash = 1;
      A.tone(A.note(5 + Math.min(combo, 12)), 0.22, 'triangle', 0.25);
      A.tone(A.note(10 + Math.min(combo, 12)), 0.18, 'sine', 0.12, null, 0.05);
      popups.push({ txt: combo > 1 ? 'PERFECT x' + combo : 'PERFECT', x: W / 2, y: yOf(n) - 40, life: 1 });
      burst(x + w / 2, yOf(n), hue(n), 18);
      if (combo === 5) Kit.sdk.happytime();
    } else {
      const L = Math.max(cur.x, prev.x), R = Math.min(cur.x + cur.w, prev.x + prev.w);
      combo = 0;
      if (R - L <= 0) { fall(cur.x, cur.w, n, cur.x < prev.x ? -1 : 1); return lose(); }
      stack.push({ x: L, w: R - L });
      if (cur.x < L) fall(cur.x, L - cur.x, n, -1);
      if (cur.x + cur.w > R) fall(R, cur.x + cur.w - R, n, 1);
      A.tone(A.note(n % 10 + 2, 196), 0.09, 'square', 0.1);
      A.noise(0.09, 0.18, 900);
      shakeT = 0.08;
    }
    score = stack.length - 1;
    Kit.sdk.score(score);
    if (score % 10 === 0) { popups.push({ txt: score + '!', x: W / 2, y: 140, life: 1.4, big: true }); A.tone(A.note(15), 0.3, 'triangle', 0.2); A.tone(A.note(17), 0.3, 'triangle', 0.15, null, 0.1); }
    spawn();
  }
  function fall(x, w, level, side) {
    falling.push({ x: x, w: w, y: yOf(level) - SH - cam, vx: side * (40 + Math.random() * 60), vy: -60, r: 0, vr: side * (1 + Math.random() * 2), h: hue(level) });
  }
  function burst(x, y, h, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220; parts.push({ x: x, y: y - cam, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.6 + Math.random() * 0.4, h: h }); }
  }
  function lose() {
    state = 'dying'; dieT = 0; shakeT = 0.35;
    A.tone(220, 0.6, 'sawtooth', 0.18, 50); A.noise(0.5, 0.25, 500);
    const r = Kit.best(score); bestNow = r;
  }
  function gameOver() {
    state = 'over'; Kit.sdk.gameplayStop();
    Kit.over({ score: score, best: bestNow.best, isNew: bestNow.isNew, extra: [score >= 50 ? 'You reached orbit.' : score >= 25 ? 'Above the clouds!' : ''].filter(Boolean) }, start);
  }
  function start() { reset(); state = 'play'; Kit.sdk.gameplayStart(); }

  // stars for the high-altitude sky
  stars = []; const r0 = Kit.rng(7);
  for (let i = 0; i < 90; i++) stars.push({ x: r0() * 1600 - 600, y: r0() * 2000, s: r0() * 1.6 + 0.4, p: r0() * 0.5 + 0.2 });

  function update(dt) {
    t += dt;
    if (state === 'play' || state === 'menu') {
      if (!cur) reset();
      if (cur.ph !== 1e-3) { cur.ph += dt / cur.period; placeCur(); } // one sweep across per period
    }
    const target = Math.max(0, (stack.length - 9) * SH);
    cam += (target - cam) * Math.min(1, dt * 6);
    for (const f of falling) { f.vy += 1900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vr * dt; }
    falling = falling.filter(f => f.y + cam < H + 300);
    for (const p of parts) { p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    parts = parts.filter(p => p.life > 0);
    for (const p of popups) { p.life -= dt; p.y -= 30 * dt; }
    popups = popups.filter(p => p.life > 0);
    flash = Math.max(0, flash - dt * 3); shakeT = Math.max(0, shakeT - dt);
    if (state === 'dying') { dieT += dt; if (dieT > 0.9) gameOver(); }
  }

  function slab(x, y, w, h, hu, light) {
    const l = light || 0;
    ctx.fillStyle = `hsl(${hu},70%,${62 + l}%)`; // top
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + D, y - D); ctx.lineTo(x + w + D, y - D); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `hsl(${hu},62%,${38 + l}%)`; // side
    ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + D, y - D); ctx.lineTo(x + w + D, y + h - D); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `hsl(${hu},66%,${50 + l}%)`; // front
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, 3);
  }

  function render() {
    S.begin();
    const v = S.view, n = stack ? stack.length : 1;
    const alt = Math.min(1, cam / (SH * 60));
    const h1 = (230 + alt * 40) % 360;
    const g = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
    g.addColorStop(0, `hsl(${h1},${55 - alt * 25}%,${(1 - alt) * 22 + 6}%)`);
    g.addColorStop(1, `hsl(${(h1 + 60) % 360},${60 - alt * 30}%,${(1 - alt) * 45 + 10}%)`);
    ctx.fillStyle = g; ctx.fillRect(v.x, v.y, v.w, v.h);
    // stars fade in with altitude
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      const y = ((s.y + cam * s.p) % 2000) - 600;
      ctx.globalAlpha = Math.min(1, alt * 1.6) * (0.5 + 0.5 * Math.sin(t * 2 + s.x));
      ctx.fillRect(s.x, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // distant hills that sink as you rise
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.moveTo(v.x, H + cam * 0.3);
    for (let x = v.x; x <= v.x + v.w + 20; x += 20) ctx.lineTo(x, 560 + Math.sin(x * 0.012) * 30 + Math.sin(x * 0.031) * 12 + cam * 0.3);
    ctx.lineTo(v.x + v.w, v.y + v.h + 1000); ctx.lineTo(v.x, v.y + v.h + 1000); ctx.fill();

    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 10 * shakeT * 10, (Math.random() - 0.5) * 10 * shakeT * 10);
    if (stack) {
      // pedestal
      const b = stack[0];
      ctx.fillStyle = 'hsl(230,30%,18%)'; ctx.fillRect(b.x, yOf(0), b.w, 2000);
      ctx.fillStyle = 'hsl(230,30%,12%)';
      ctx.beginPath(); ctx.moveTo(b.x + b.w, yOf(0)); ctx.lineTo(b.x + b.w + D, yOf(0) - D); ctx.lineTo(b.x + b.w + D, yOf(0) + 2000); ctx.lineTo(b.x + b.w, yOf(0) + 2000); ctx.fill();
      const first = Math.max(0, Math.floor((cam - 200) / SH));
      for (let i = first; i < stack.length; i++) {
        const s = stack[i];
        slab(s.x, yOf(i) - SH, s.w, SH, hue(i), i === stack.length - 1 ? flash * 18 : 0);
      }
      if (state === 'play' || state === 'menu') {
        const i = stack.length;
        // drop guide
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(cur.x, yOf(i) - SH, cur.w, SH + 4);
        slab(cur.x, yOf(i) - SH - 6 + Math.sin(t * 6) * 1.5, cur.w, SH, hue(i), 6);
      }
      for (const f of falling) {
        ctx.save(); ctx.translate(f.x + f.w / 2, f.y + cam + SH / 2); ctx.rotate(f.r);
        slab(-f.w / 2, -SH / 2, f.w, SH, f.h, -6); ctx.restore();
      }
      for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = `hsl(${p.h},90%,75%)`; ctx.fillRect(p.x - 2, p.y + cam - 2, 4, 4); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // HUD
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    if (state !== 'menu') {
      ctx.font = '800 64px system-ui,sans-serif'; ctx.globalAlpha = 0.95;
      ctx.fillText(String(score), W / 2, 90);
      ctx.font = '600 14px system-ui,sans-serif'; ctx.globalAlpha = 0.6;
      ctx.fillText('BEST ' + Kit.store.get('best', 0), W / 2, 114); ctx.globalAlpha = 1;
    }
    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2); ctx.font = (p.big ? '800 40px' : '800 22px') + ' system-ui,sans-serif';
      ctx.fillStyle = p.big ? '#ffd23f' : '#fff'; ctx.fillText(p.txt, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  Kit.pointer(S, { down: () => drop() });
  Kit.onKey(e => { if (['Space', 'Enter', 'ArrowDown', 'KeyS'].includes(e.code)) drop(); });
  reset();
  Kit.loop(update, render);
  Kit.sdk.init().then(() => {
    Kit.sdk.loaded();
    Kit.menu({ title: 'Stackfall', howto: 'Tap to drop the slab. Anything hanging over the edge gets sliced off. Land it <b>perfectly</b> to chain combos and grow it back.', keys: 'Space / Enter / tap to drop' }, start);
  });
  window.__game = { get state() { return state; }, get score() { return score; }, drop: drop, start: start,
    aim(off) { const prev = stack[stack.length - 1]; cur.x = prev.x + (off || 0); cur.ph = 1e-3; } }; // aim(): test/screenshot hook
})();
