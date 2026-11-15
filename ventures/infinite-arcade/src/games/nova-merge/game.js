/* Nova Merge: drop numbered stars into columns; touching twins fuse and double. */
(function () {
  'use strict';
  const W = 400, H = 700, COLS = 5, ROWS = 7, CELL = 70, GX = (W - COLS * CELL) / 2, GY = 150;
  const S = Kit.stage(document.getElementById('c'), { w: W, h: H });
  const ctx = S.ctx, A = Kit.audio;
  let state = 'menu', grid, tiles, active, phase, score, next, next2, cursor, popups, parts, chain, t, wait, maxV, bestNow, hoverCol, shake;

  function cellX(c) { return GX + c * CELL + CELL / 2; }
  function cellY(r) { return GY + (ROWS - 1 - r) * CELL + CELL / 2; }
  function reset() {
    grid = []; for (let c = 0; c < COLS; c++) grid.push(new Array(ROWS).fill(null));
    tiles = []; active = []; phase = 'idle'; score = 0; popups = []; parts = []; chain = 0; t = 0; wait = 0; maxV = 2; shake = 0;
    cursor = 2; hoverCol = -1; next = rollTile(); next2 = rollTile();
  }
  function rollTile() {
    const top = Math.max(8, Math.min(64, maxV / 16));
    const opts = []; for (let v = 2; v <= top; v *= 2) opts.push(v);
    // weight smaller values more
    const w = opts.map((_, i) => Math.pow(0.55, i)); const sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum; for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; }
    return opts[0];
  }
  function colTop(c) { for (let r = 0; r < ROWS; r++) if (!grid[c][r]) return r; return ROWS; }
  function canDrop(c, v) { const r = colTop(c); return r < ROWS || grid[c][ROWS - 1].v === v; }
  function drop(c) {
    if (state !== 'play' || phase !== 'idle') return;
    cursor = c;
    const v = next;
    let r = colTop(c);
    if (r >= ROWS) {
      if (grid[c][ROWS - 1].v !== v) { A.tone(140, 0.12, 'square', 0.1); shake = 0.15; return; }
      // merge straight into the full column top
      const tt = grid[c][ROWS - 1]; tt.v *= 2; tt.pop = 1; score += tt.v; active.push(tt); fx(tt, 0);
      next = next2; next2 = rollTile(); phase = 'resolve'; wait = 0.12; chain = 0; return;
    }
    const tile = { v: v, c: c, r: r, x: cellX(c), y: GY - 60, pop: 0, dead: false };
    grid[c][r] = tile; tiles.push(tile); active.push(tile);
    next = next2; next2 = rollTile();
    phase = 'resolve'; wait = 0; chain = 0;
    A.tone(330, 0.06, 'triangle', 0.12, 220);
  }
  function settled() { return tiles.every(k => Math.abs(k.x - cellX(k.c)) < 1 && Math.abs(k.y - cellY(k.r)) < 1); }
  function gravity() {
    let moved = false;
    for (let c = 0; c < COLS; c++) {
      let w = 0;
      for (let r = 0; r < ROWS; r++) {
        const k = grid[c][r];
        if (k) { if (r !== w) { grid[c][w] = k; grid[c][r] = null; k.r = w; moved = true; if (!active.includes(k)) active.push(k); } w++; }
      }
    }
    return moved;
  }
  function neighbors(k) {
    const out = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => { const c = k.c + d[0], r = k.r + d[1]; if (c >= 0 && c < COLS && r >= 0 && r < ROWS && grid[c][r]) out.push(grid[c][r]); });
    return out;
  }
  function fx(k, ch) {
    const col = colorOf(k.v);
    for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 200; parts.push({ x: cellX(k.c), y: cellY(k.r), vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.3, c: col }); }
    popups.push({ x: cellX(k.c), y: cellY(k.r) - 20, txt: '+' + k.v + (ch > 1 ? '  x' + ch : ''), life: 0.9 });
    A.tone(A.note(4 + Math.log2(k.v) + ch, 220), 0.18, 'triangle', 0.22);
    A.tone(A.note(8 + Math.log2(k.v) + ch, 220), 0.14, 'sine', 0.1, null, 0.04);
    if (k.v >= 512) Kit.sdk.happytime();
  }
  function step() {
    if (gravity()) { wait = 0.02; return; }
    while (active.length) {
      const k = active.shift();
      if (k.dead) continue;
      const nb = neighbors(k).filter(n => n.v === k.v);
      if (nb.length) {
        chain++;
        for (const n of nb) { n.dead = true; grid[n.c][n.r] = null; n.tx = k.c; n.ty = k.r; n.fade = 1; }
        k.v = k.v * Math.pow(2, nb.length); k.pop = 1;
        maxV = Math.max(maxV, k.v);
        const gain = k.v * chain; score += gain; Kit.sdk.score(score);
        fx(k, chain);
        active.unshift(k);
        wait = 0.16;
        return;
      }
    }
    phase = 'idle';
    tiles = tiles.filter(k => !k.dead || k.fade > 0);
    if (!Array.from({ length: COLS }, (_, c) => c).some(c => canDrop(c, next))) lose();
  }
  function lose() {
    state = 'dying'; wait = 0.9; shake = 0.3;
    A.tone(260, 0.7, 'sawtooth', 0.15, 60);
    bestNow = Kit.best(score);
  }
  function start() { reset(); state = 'play'; Kit.sdk.gameplayStart(); }

  function update(dt) {
    t += dt;
    for (const k of tiles) {
      if (k.dead) { k.x += (cellX(k.tx) - k.x) * Math.min(1, dt * 18); k.y += (cellY(k.ty) - k.y) * Math.min(1, dt * 18); k.fade -= dt * 6; continue; }
      const tx = cellX(k.c), ty = cellY(k.r);
      k.x += (tx - k.x) * Math.min(1, dt * 20);
      if (k.y < ty) { k.vy = (k.vy || 0) + 5000 * dt; k.y = Math.min(ty, k.y + k.vy * dt); if (k.y === ty) { k.vy = 0; } } else { k.y = ty; k.vy = 0; }
      k.pop = Math.max(0, k.pop - dt * 4);
    }
    tiles = tiles.filter(k => !k.dead || k.fade > 0);
    if (phase === 'resolve' && state === 'play') { wait -= dt; if (wait <= 0 && settled()) step(); }
    if (state === 'dying') { wait -= dt; if (wait <= 0) { state = 'over'; Kit.sdk.gameplayStop(); Kit.over({ score: score, best: bestNow.best, isNew: bestNow.isNew, extra: ['Biggest star: <b>' + fmt(maxV) + '</b>'] }, start); } }
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; q.life -= dt; }
    parts = parts.filter(q => q.life > 0);
    for (const q of popups) { q.life -= dt; q.y -= 40 * dt; }
    popups = popups.filter(q => q.life > 0);
    shake = Math.max(0, shake - dt);
    if (state === 'menu' && tiles.length === 0) demo();
  }
  function demo() { // decorative board behind the title card
    const vals = [[2, 4, 8, 16], [4, 2, 32], [8, 64], [2, 4, 2, 8, 128], [16]];
    vals.forEach((col, c) => col.forEach((v, r) => { const k = { v: v, c: c, r: r, x: cellX(c), y: cellY(r), pop: 0 }; grid[c][r] = k; tiles.push(k); }));
  }
  function fmt(v) { return v >= 1048576 ? (v / 1048576) + 'M' : v >= 1024 ? (v / 1024) + 'K' : String(v); }
  function colorOf(v) { const i = Math.log2(v); return `hsl(${(i * 37 + 180) % 360},85%,${58 + (i % 2) * 6}%)`; }

  function star(x, y, v, scale, alpha) {
    const i = Math.log2(v), r = 30 * scale;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha == null ? 1 : alpha;
    const col = colorOf(v);
    ctx.shadowColor = col; ctx.shadowBlur = 14 + Math.min(20, i * 2);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.25, col); g.addColorStop(1, `hsl(${(i * 37 + 200) % 360},70%,28%)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill();
    ctx.shadowBlur = 0;
    if (i >= 6) { // rings for big stars
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.35, Math.sin(t + i) * 0.4 - 0.3, 0, 6.28); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const s = fmt(v); ctx.font = `800 ${s.length > 3 ? 18 : s.length > 2 ? 21 : 25}px system-ui,sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeText(s, 0, 1); ctx.fillText(s, 0, 1);
    ctx.restore();
  }
  const bgStars = []; const rr = Kit.rng(3); for (let i = 0; i < 120; i++) bgStars.push({ x: rr() * 900 - 250, y: rr() * 1200 - 250, s: rr() * 1.8 + 0.3 });
  function render() {
    S.begin();
    const v = S.view;
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, 700);
    g.addColorStop(0, '#2b1460'); g.addColorStop(1, '#070514');
    ctx.fillStyle = g; ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.fillStyle = '#fff';
    for (const s of bgStars) { ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 1.5 + s.x); ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 30 * shake, 0);
    // board
    ctx.fillStyle = 'rgba(255,255,255,.05)'; roundRect(GX - 8, GY - 8, COLS * CELL + 16, ROWS * CELL + 16, 18); ctx.fill();
    for (let c = 0; c < COLS; c++) {
      const hl = (c === hoverCol || c === cursor) && state === 'play';
      ctx.fillStyle = hl ? 'rgba(126,249,200,.10)' : (c % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.045)');
      roundRect(GX + c * CELL + 3, GY, CELL - 6, ROWS * CELL, 12); ctx.fill();
    }
    // danger line
    ctx.strokeStyle = 'rgba(255,80,120,.35)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(GX, GY + 1); ctx.lineTo(GX + COLS * CELL, GY + 1); ctx.stroke(); ctx.setLineDash([]);
    for (const k of tiles) star(k.x, k.y, k.v, (k.dead ? 0.9 : 1) + (k.pop || 0) * 0.25, k.dead ? Math.max(0, k.fade) : 1);
    for (const q of parts) { ctx.globalAlpha = Math.max(0, q.life * 1.6); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 6.28); ctx.fill(); }
    ctx.globalAlpha = 1;
    // next tile preview above column
    if (state === 'play') {
      const c = hoverCol >= 0 ? hoverCol : cursor;
      star(cellX(c), GY - 46 + Math.sin(t * 4) * 3, next, 0.8, phase === 'idle' ? 1 : 0.4);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(cellX(c) - 7, GY - 12); ctx.lineTo(cellX(c) + 7, GY - 12); ctx.lineTo(cellX(c), GY - 4); ctx.fill();
    }
    ctx.restore();
    // HUD
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
    if (state !== 'menu') {
      ctx.font = '800 34px system-ui,sans-serif'; ctx.fillText(String(score), GX, 56);
      ctx.font = '600 12px system-ui,sans-serif'; ctx.globalAlpha = 0.6; ctx.fillText('BEST ' + Kit.store.get('best', 0), GX, 74); ctx.globalAlpha = 1;
      ctx.textAlign = 'right'; ctx.font = '600 11px system-ui,sans-serif'; ctx.globalAlpha = 0.6; ctx.fillText('THEN', W - GX - 28, 50); ctx.globalAlpha = 1;
      star(W - GX - 12, 46, next2, 0.45, 0.8);
    }
    ctx.textAlign = 'center';
    for (const q of popups) { ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = '800 18px system-ui,sans-serif'; ctx.fillStyle = '#ffd23f'; ctx.fillText(q.txt, q.x, q.y); }
    ctx.globalAlpha = 1;
    if (state === 'play') { ctx.font = '600 13px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillText('Tap a column to drop', W / 2, GY + ROWS * CELL + 40); }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function colAt(p) { if (p.x < GX || p.x > GX + COLS * CELL) return -1; return Math.floor((p.x - GX) / CELL); }

  Kit.pointer(S, {
    down: p => { const c = colAt(p); if (c >= 0) { hoverCol = c; } },
    move: (p, e) => { const c = colAt(p); hoverCol = (e.pointerType === 'mouse' || e.buttons) ? c : hoverCol; },
    up: (p, e) => { const c = colAt(p); if (c >= 0 && state === 'play') drop(c); if (e.pointerType !== 'mouse') hoverCol = -1; },
  });
  Kit.onKey(e => {
    if (state !== 'play') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { cursor = (cursor + COLS - 1) % COLS; hoverCol = -1; A.tone(600, 0.03, 'sine', 0.05); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { cursor = (cursor + 1) % COLS; hoverCol = -1; A.tone(600, 0.03, 'sine', 0.05); }
    else if (['Space', 'Enter', 'ArrowDown', 'KeyS'].includes(e.code)) drop(cursor);
    else { const n = parseInt(e.key, 10); if (n >= 1 && n <= COLS) drop(n - 1); }
  });
  reset();
  Kit.loop(update, render);
  Kit.sdk.init().then(() => {
    Kit.sdk.loaded();
    Kit.menu({ title: 'Nova Merge', howto: 'Drop stars into the columns. Twins that touch fuse into one star worth double, and chain reactions multiply your score. Don\'t let the board fill up.', keys: 'Tap a column · or ←/→ and Space · or keys 1–5' }, start);
  });
  window.__game = { get state() { return state; }, get score() { return score; }, drop: drop, start: start, get phase() { return phase; } };
})();
