/* ---- 00-core.js ---- */
/* Ebbmarrow engine: core utilities, input, global namespace.
   All engine files share the global `G` and are concatenated by tools/build_rpg.py. */
'use strict';
const G = (window.G = window.G || {});
G.VERSION = '17d5a13729';
G.TILE = 16;
G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.wait = (ms) => new Promise((r) => setTimeout(r, ms));
G.hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
G.rng = (seed) => {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
G.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
G.DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/* Eastern-time date helpers: chapters unlock at midnight America/New_York. */
G.etParts = (d = new Date()) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const o = {}; for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
};
G.etToday = () => { const p = G.etParts(); return `${p.year}-${p.month}-${p.day}`; };
G.untilEtMidnight = () => { const p = G.etParts(); return 86400 - (+p.hour * 3600 + +p.minute * 60 + +p.second); };
G.fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
G.fmtCountdown = (s) => { s = Math.max(0, s | 0); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

/* ---------------- input ----------------
   Keyboard + on-screen touch pad. Consumers read G.input.held(dir) and
   G.input.take('a'|'b'|'menu') for edge-triggered presses. */
G.input = (() => {
  const held = new Set(), pressed = new Set();
  const map = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'a', Enter: 'a', KeyZ: 'a', KeyE: 'a', Escape: 'menu', KeyX: 'b', Backspace: 'b', KeyM: 'menu', Tab: 'menu', ShiftLeft: 'run', ShiftRight: 'run',
  };
  let lastDir = null, listeners = [];
  const down = (k) => { if (!held.has(k)) pressed.add(k); held.add(k); if (G.DIRS[k]) lastDir = k; for (const l of listeners) l(k); };
  const up = (k) => held.delete(k);
  addEventListener('keydown', (e) => {
    const k = map[e.code]; if (!k) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    e.preventDefault(); if (!e.repeat) down(k);
    G.audio && G.audio.unlock();
  });
  addEventListener('keyup', (e) => { const k = map[e.code]; if (k) up(k); });
  addEventListener('blur', () => held.clear());
  return {
    held: (k) => held.has(k),
    take: (k) => { const h = pressed.has(k); pressed.delete(k); return h; },
    clear: () => { pressed.clear(); },
    dir: () => { if (lastDir && held.has(lastDir)) return lastDir; for (const d of ['up', 'down', 'left', 'right']) if (held.has(d)) return d; return null; },
    press: down, release: up,
    on: (f) => listeners.push(f),
    off: (f) => { listeners = listeners.filter((x) => x !== f); },
  };
})();

G.isTouch = () => matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

/* ---- 10-art.js ---- */
/* Procedural pixel art. Every tile, character and monster is drawn in code, so the
   art can be upgraded one painter at a time (see docs/roadmap.md, "Graphics").
   Palette: "Marrow-32", a cool-sea / warm-lamplight split. */
G.art = (() => {
  const T = G.TILE;
  const P = {
    ink: '#1a1426', void: '#05070d',
    sea0: '#0e2a44', sea1: '#17405e', sea2: '#2a6f8a', sea3: '#47a0b0', foam: '#a9e4dc',
    sand0: '#cfb27c', sand1: '#e3c993', sand2: '#f0dcae', wet0: '#8e7a58', wet1: '#a08c66', wet2: '#b39f77',
    g0: '#2a5536', g1: '#356b3e', g2: '#3e7a46', g3: '#4f8f4f', g4: '#6fae5c',
    r0: '#33313d', r1: '#45434f', r2: '#5a5866', r3: '#75737f', r4: '#9a98a3',
    w0: '#4a2e20', w1: '#5b3a29', w2: '#7d5236', w3: '#9c6f48', w4: '#b08156',
    roof0: '#6e2a28', roof1: '#9a4038', roof2: '#b5523f', slate0: '#323c55', slate1: '#4a5a78', slate2: '#5d6f92',
    st0: '#454a58', st1: '#5a5f6c', st2: '#6b6f7a', st3: '#80858f', moss: '#4f6a4a',
    cream: '#f2e6c9', lamp: '#f5b85a', ember: '#ff7b54', rose: '#e07a8a', coral: '#f09a5a', teal: '#8fd6d0', glow: '#7ff0e0',
    cave0: '#1e1b26', cave1: '#2a2632', cave2: '#3d3848', cave3: '#514a5e',
  };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  const px = (x, X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  const speck = (x, n, cols, seed, area = [0, 0, T, T]) => {
    const r = G.rng(seed);
    for (let i = 0; i < n; i++) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect(area[0] + ((r() * area[2]) | 0), area[1] + ((r() * area[3]) | 0), 1, 1); }
  };
  const ellipse = (x, cx, cy, rx, ry, col) => {
    x.fillStyle = col;
    for (let yy = -ry; yy <= ry; yy++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry + 0.0001))));
      if (w > 0 || yy === 0) x.fillRect(Math.round(cx - w), Math.round(cy + yy), Math.max(1, w * 2), 1);
    }
  };
  const outline = (src, col = P.ink, alphaMin = 40) => {
    const w = src.width, h = src.height, [c, x] = mk(w, h);
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    const a = (X, Y) => (X < 0 || Y < 0 || X >= w || Y >= h ? 0 : d[(Y * w + X) * 4 + 3]);
    x.fillStyle = col;
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++)
      if (a(X, Y) < alphaMin && (a(X - 1, Y) >= alphaMin || a(X + 1, Y) >= alphaMin || a(X, Y - 1) >= alphaMin || a(X, Y + 1) >= alphaMin)) x.fillRect(X, Y, 1, 1);
    x.drawImage(src, 0, 0);
    return c;
  };

  /* ---------------- tiles ---------------- */
  const painters = {
    void: (x) => px(x, 0, 0, T, T, P.void),
    grass: (x, s) => {
      px(x, 0, 0, T, T, P.g2); speck(x, 22, [P.g1, P.g1, P.g3], s);
      const r = G.rng(s + 7); for (let i = 0; i < 3; i++) { const X = 1 + ((r() * 13) | 0), Y = 3 + ((r() * 11) | 0); px(x, X, Y, 1, 2, P.g3); px(x, X + 1, Y + 1, 1, 1, P.g4); }
    },
    tallgrass: (x, s) => {
      px(x, 0, 0, T, T, P.g1); speck(x, 14, [P.g0, P.g2], s);
      const r = G.rng(s + 3); for (let i = 0; i < 7; i++) { const X = (r() * 15) | 0, Y = 4 + ((r() * 10) | 0); px(x, X, Y, 1, 3, P.g3); px(x, X, Y, 1, 1, P.g4); px(x, X + 1, Y + 1, 1, 2, P.g2); }
    },
    flowers: (x, s) => {
      painters.grass(x, s);
      const r = G.rng(s + 11), cols = [P.cream, P.lamp, '#e98aa0', '#b9a8ff'];
      for (let i = 0; i < 4; i++) { const X = 2 + ((r() * 12) | 0), Y = 2 + ((r() * 12) | 0), c = cols[(r() * 4) | 0]; px(x, X - 1, Y, 3, 1, c); px(x, X, Y - 1, 1, 3, c); px(x, X, Y, 1, 1, '#ffe9a0'); }
    },
    sand: (x, s) => {
      px(x, 0, 0, T, T, P.sand1); speck(x, 26, [P.sand0, P.sand0, P.sand2], s);
      if (G.hash(s, 3) < 0.15) { px(x, 6, 9, 2, 1, '#f6efe0'); px(x, 7, 8, 1, 1, '#f6efe0'); }
    },
    wet: (x, s) => {
      px(x, 0, 0, T, T, P.wet1); speck(x, 24, [P.wet0, P.wet2], s);
      const r = G.rng(s + 5); for (let i = 0; i < 2; i++) { const Y = 2 + ((r() * 12) | 0), X = (r() * 8) | 0; px(x, X, Y, 4, 1, P.wet0); px(x, X + 4, Y - 1, 3, 1, P.wet0); }
      if (G.hash(s, 9) < 0.12) { px(x, 9, 6, 2, 2, '#d8d0bf'); px(x, 9, 7, 1, 1, '#a59c8c'); }
    },
    shallow: (x, s, f) => {
      painters.wet(x, s); x.fillStyle = 'rgba(52,140,165,0.62)'; x.fillRect(0, 0, T, T);
      const r = G.rng(s + 1); for (let i = 0; i < 4; i++) { const X = ((r() * 16 + f * 0.75) | 0) % 16, Y = (r() * 15) | 0; px(x, X, Y, 2, 1, 'rgba(169,228,220,0.8)'); }
    },
    water: (x, s, f) => {
      px(x, 0, 0, T, T, P.sea1); speck(x, 10, [P.sea0], s);
      const o = Math.round(f + G.hash(s, 1) * 8);
      for (const Y of [3, 8, 13]) { const X = (o * 2 + Y * 3) % 16; px(x, X, Y, 4, 1, P.sea2); px(x, (X + 8) % 16, Y + 1, 3, 1, P.sea2); }
      if ((f + ((s * 7) | 0)) % 8 === 0) px(x, (s * 13) % 14 | 0, 6, 1, 1, P.foam);
    },
    deep: (x, s, f) => {
      px(x, 0, 0, T, T, P.sea0); const o = Math.round(f + G.hash(s, 2) * 8);
      for (const Y of [5, 12]) px(x, (o * 2 + Y) % 16, Y, 3, 1, P.sea1);
    },
    path: (x, s) => {
      px(x, 0, 0, T, T, '#a98458'); speck(x, 26, ['#937049', '#bf9a6b', '#937049'], s);
      const r = G.rng(s + 2); for (let i = 0; i < 2; i++) { const X = (r() * 14) | 0, Y = (r() * 14) | 0; px(x, X, Y, 2, 1, '#7f6a55'); px(x, X, Y - 1, 2, 1, '#c8a87a'); }
    },
    planks: (x, s) => {
      for (let i = 0; i < 4; i++) { px(x, 0, i * 4, T, 4, i % 2 ? P.w2 : '#8a5a3a'); px(x, 0, i * 4 + 3, T, 1, P.w0); const sx = ((G.hash(s, i) * 12) | 0) + 2; px(x, sx, i * 4, 1, 3, P.w0); px(x, 1, i * 4 + 1, 1, 1, '#c9b9a0'); px(x, 14, i * 4 + 1, 1, 1, '#c9b9a0'); }
      speck(x, 6, [P.w3], s);
    },
    rock: (x, s) => {
      px(x, 0, 0, T, T, P.r2); px(x, 0, 0, T, 3, P.r3); px(x, 0, 0, T, 1, P.r4); px(x, 0, 13, T, 3, P.r1);
      speck(x, 18, [P.r1, P.r3], s, [0, 3, 16, 10]);
      const r = G.rng(s); const X = 2 + ((r() * 10) | 0); px(x, X, 4, 1, 5, P.r0); px(x, X + 1, 8, 1, 3, P.r0); px(x, X + 1, 4, 1, 1, P.r4);
    },
    cliff: (x, s) => {
      px(x, 0, 0, T, T, P.r1);
      for (let Y = 0; Y < T; Y += 4) { px(x, 0, Y, T, 1, P.r2); px(x, ((G.hash(s, Y) * 14) | 0), Y + 1, 3, 1, P.r0); }
      speck(x, 10, [P.r0, P.r2], s); px(x, 0, 15, T, 1, P.r0);
    },
    tree: (x, s) => {
      painters.grass(x, s);
      const [c, y] = mk(T, T);
      px(y, 7, 11, 2, 5, P.w1); px(y, 7, 11, 1, 5, P.w2);
      ellipse(y, 8, 7, 7, 6, '#24502f'); ellipse(y, 7, 6, 6, 5, '#2f6a3c'); ellipse(y, 6, 5, 4, 3, '#3f8a49');
      speck(y, 6, ['#5fa457'], s + 4, [3, 2, 7, 4]); speck(y, 6, ['#1f4428'], s + 5, [3, 9, 10, 3]);
      x.drawImage(outline(c, '#14261b'), 0, 0);
    },
    pine: (x, s) => {
      painters.grass(x, s);
      const [c, y] = mk(T, T);
      px(y, 7, 12, 2, 4, P.w1);
      for (let i = 0; i < 4; i++) { const w = 2 + i * 2; px(y, 8 - w, 1 + i * 3, w * 2, 3, i % 2 ? '#24502f' : '#2a5e38'); px(y, 8 - w, 1 + i * 3, w, 1, '#3f8a49'); }
      x.drawImage(outline(c, '#14261b'), 0, 0);
    },
    roof: (x, s) => {
      for (let Y = 0; Y < T; Y += 4) { px(x, 0, Y, T, 4, (Y / 4) % 2 ? P.roof1 : P.roof2); px(x, 0, Y + 3, T, 1, P.roof0); for (let X = (Y / 4) % 2 ? 2 : 6; X < T; X += 8) px(x, X, Y, 1, 3, P.roof0); }
      px(x, 0, 0, T, 1, '#cf6d55');
    },
    slate: (x, s) => {
      for (let Y = 0; Y < T; Y += 4) { px(x, 0, Y, T, 4, (Y / 4) % 2 ? P.slate1 : P.slate2); px(x, 0, Y + 3, T, 1, P.slate0); for (let X = (Y / 4) % 2 ? 3 : 7; X < T; X += 8) px(x, X, Y, 1, 3, P.slate0); }
    },
    wall: (x, s) => {
      for (let X = 0; X < T; X += 4) { px(x, X, 0, 4, T, X % 8 ? P.w3 : P.w4); px(x, X, 0, 1, T, '#6e4a30'); }
      px(x, 0, 0, T, 2, '#4a2e20'); px(x, 0, 15, T, 1, '#4a2e20');
      if (G.hash(s, 4) < 0.45) { px(x, 4, 4, 8, 7, P.w0); px(x, 5, 5, 6, 5, P.lamp); px(x, 5, 5, 6, 1, '#ffd890'); px(x, 7, 5, 1, 5, P.w0); px(x, 5, 7, 6, 1, P.w0); px(x, 4, 11, 8, 1, P.w4); }
    },
    door: (x, s) => {
      painters.wall(x, 999);
      px(x, 3, 3, 10, 13, P.w0); px(x, 4, 4, 8, 12, P.w1); px(x, 6, 4, 1, 12, P.w0); px(x, 9, 4, 1, 12, P.w0); px(x, 10, 10, 1, 1, P.lamp); px(x, 3, 3, 10, 1, '#3a2418');
    },
    fence: (x, s) => {
      painters.grass(x, s);
      px(x, 0, 6, T, 2, '#a2724a'); px(x, 0, 10, T, 2, '#a2724a'); px(x, 0, 8, T, 1, P.w0); px(x, 0, 12, T, 1, P.w0);
      for (const X of [2, 12]) { px(x, X, 4, 2, 11, P.w2); px(x, X, 4, 2, 1, P.w4); px(x, X + 1, 5, 1, 10, P.w1); }
    },
    barrel: (x, s, f, base) => {
      (painters[base] || painters.sand)(x, s);
      const [c, y] = mk(T, T);
      px(y, 3, 3, 10, 12, P.w2); px(y, 4, 2, 8, 14, P.w2); px(y, 3, 5, 10, 1, P.r1); px(y, 3, 11, 10, 1, P.r1); px(y, 4, 3, 2, 11, P.w3); px(y, 10, 3, 2, 11, P.w1);
      ellipse(y, 8, 3, 4, 1, '#a2724a');
      x.drawImage(outline(c), 0, 0);
    },
    crate: (x, s, f, base) => {
      (painters[base] || painters.sand)(x, s);
      const [c, y] = mk(T, T);
      px(y, 2, 3, 12, 12, P.w3); px(y, 2, 3, 12, 2, P.w4); px(y, 3, 5, 10, 9, P.w2);
      for (let i = 0; i < 9; i++) { px(y, 3 + i, 5 + i, 2, 1, P.w3); px(y, 12 - i, 5 + i, 1, 1, P.w3); }
      x.drawImage(outline(c), 0, 0);
    },
    netrack: (x, s) => {
      painters.grass(x, s);
      px(x, 1, 2, 2, 13, P.w1); px(x, 13, 2, 2, 13, P.w1); px(x, 1, 2, 14, 1, P.w2);
      x.fillStyle = 'rgba(214,204,180,0.9)'; for (let i = 3; i < 15; i += 3) { x.fillRect(3, i, 10, 1); } for (let i = 4; i < 13; i += 3) x.fillRect(i, 3, 1, 10);
    },
    lamp: (x, s, f) => {
      painters.grass(x, s);
      px(x, 7, 5, 2, 11, P.r0); px(x, 6, 14, 4, 2, P.r1); px(x, 5, 1, 6, 5, P.r0);
      const g = f % 4 < 2 ? P.lamp : '#ffcf7a'; px(x, 6, 2, 4, 3, g); px(x, 6, 2, 4, 1, '#fff0c0');
    },
    reeds: (x, s) => {
      px(x, 0, 0, T, T, '#7b7650'); speck(x, 14, ['#6b6644', P.wet1], s);
      const r = G.rng(s + 9); for (let i = 0; i < 7; i++) { const X = (r() * 15) | 0, h = 5 + ((r() * 7) | 0); px(x, X, 15 - h, 1, h, i % 2 ? '#8a9a52' : '#6b7a3e'); px(x, X, 14 - h, 1, 2, '#c2a86a'); }
    },
    mud: (x, s) => {
      px(x, 0, 0, T, T, '#5e4b3a'); speck(x, 20, ['#4e3e30', '#6e5a46'], s);
      if (G.hash(s, 6) < 0.5) { ellipse(x, 8, 9, 4, 2, '#4a5a5a'); px(x, 6, 8, 2, 1, '#7a9a9a'); }
    },
    stone: (x, s) => {
      px(x, 0, 0, T, T, P.st2);
      px(x, 0, 7, T, 1, P.st1); px(x, 0, 15, T, 1, P.st1); const o = G.hash(s, 1) < 0.5 ? 4 : 10; px(x, o, 0, 1, 7, P.st1); px(x, (o + 6) % 16, 8, 1, 7, P.st1);
      speck(x, 10, [P.st3, P.st1], s); if (G.hash(s, 2) < 0.3) speck(x, 6, [P.moss], s + 1, [0, 10, 8, 5]);
    },
    stonewall: (x, s) => {
      px(x, 0, 0, T, T, P.st0);
      for (let Y = 0; Y < T; Y += 4) { px(x, 0, Y + 3, T, 1, '#33364a'); for (let X = (Y / 4) % 2 ? 0 : 4; X < T; X += 8) px(x, X, Y, 1, 3, '#33364a'); px(x, 0, Y, T, 1, P.st1); }
      speck(x, 8, ['#3f5a4a', '#4f6a4a'], s, [0, 8, 16, 8]);
    },
    coral: (x, s) => {
      painters.wet(x, s);
      const [c, y] = mk(T, T), r = G.rng(s + 1), col = G.hash(s, 5) < 0.5 ? [P.rose, '#f5a6b0'] : [P.coral, '#ffc58a'];
      const branch = (X, Y, h, d) => { for (let i = 0; i < h; i++) { px(y, X + ((i * d) >> 2), Y - i, 2, 1, col[0]); } px(y, X + ((h * d) >> 2), Y - h, 2, 1, col[1]); };
      branch(6, 15, 9, -1); branch(8, 15, 11, 1); branch(4, 15, 5, -2); branch(10, 15, 6, 2); if (r() < 0.5) branch(7, 10, 4, 3);
      x.drawImage(outline(c, '#3a1e28'), 0, 0);
    },
    kelp: (x, s) => {
      painters.wet(x, s);
      const r = G.rng(s + 2); for (let i = 0; i < 4; i++) { let X = 2 + ((r() * 12) | 0); for (let Y = 15; Y > 4 + ((r() * 4) | 0); Y--) { px(x, X, Y, 1, 1, i % 2 ? '#4f6a3a' : '#6b8a3a'); if (Y % 4 === 0) X += r() < 0.5 ? -1 : 1; } }
    },
    wreck: (x, s) => {
      painters.wet(x, s);
      const [c, y] = mk(T, T);
      for (let i = 0; i < 3; i++) { const Y = 3 + i * 4 + ((G.hash(s, i) * 2) | 0); px(y, 1, Y, 14, 3, i % 2 ? '#4a3a30' : '#5b4636'); px(y, 1, Y, 14, 1, '#6e5644'); }
      speck(y, 7, ['#d8d0bf', '#a59c8c'], s, [1, 3, 14, 11]);
      x.drawImage(outline(c), 0, 0);
    },
    seal: (x, s, f) => {
      painters.wet(x, s);
      const [c, y] = mk(T, T);
      ellipse(y, 8, 8, 7, 7, P.st1); ellipse(y, 8, 8, 6, 6, P.st2); ellipse(y, 7, 7, 4, 4, P.st3);
      const a = 0.55 + 0.45 * Math.sin(f * 0.8);
      y.fillStyle = `rgba(127,240,224,${a.toFixed(2)})`;
      y.fillRect(8, 3, 1, 11); y.fillRect(4, 8, 9, 1); y.fillRect(5, 5, 1, 1); y.fillRect(11, 5, 1, 1); y.fillRect(5, 11, 1, 1); y.fillRect(11, 11, 1, 1);
      x.drawImage(outline(c), 0, 0);
    },
    rubble: (x, s) => { painters.stone(x, s); speck(x, 10, [P.st0, P.st3, '#8e7a58'], s + 3); },
    cavefloor: (x, s) => { px(x, 0, 0, T, T, P.cave1); speck(x, 22, [P.cave0, P.cave2], s); if (G.hash(s, 7) < 0.2) px(x, 5, 9, 3, 1, P.cave3); },
    cavewall: (x, s) => {
      px(x, 0, 0, T, T, P.cave0); px(x, 0, 12, T, 4, P.cave2); px(x, 0, 12, T, 1, P.cave3);
      speck(x, 12, [P.cave1, P.cave2], s, [0, 0, 16, 12]);
    },
    shrub: (x, s) => {
      painters.grass(x, s);
      const [c, y] = mk(T, T); ellipse(y, 8, 10, 6, 4, '#2f6a3c'); ellipse(y, 7, 9, 4, 2, '#3f8a49'); speck(y, 3, [P.rose], s, [4, 8, 8, 4]);
      x.drawImage(outline(c, '#14261b'), 0, 0);
    },
  };

  const cache = new Map();
  const ANIM = { water: 8, deep: 8, shallow: 8, seal: 8, lamp: 4 };
  function tile(kind, X, Y, frame, base) {
    const v = (G.hash(X, Y, 17) * 4) | 0;
    const fr = ANIM[kind] ? frame % ANIM[kind] : 0;
    const key = kind + ':' + v + ':' + fr + ':' + (base || '');
    let c = cache.get(key);
    if (!c) {
      let x; [c, x] = mk(T, T);
      (painters[kind] || painters.void)(x, v * 31 + 7, fr, base);
      cache.set(key, c);
    }
    return c;
  }
  // Foam edges where water meets land, drawn on top of water tiles.
  function foam(x, X, Y, sides, frame) {
    const a = 0.55 + 0.25 * Math.sin(frame * 0.6 + X + Y);
    x.fillStyle = `rgba(200,240,232,${a.toFixed(2)})`;
    if (sides & 1) { x.fillRect(X, Y, T, 1); for (let i = (frame + X) % 4; i < T; i += 4) x.fillRect(X + i, Y + 1, 2, 1); }
    if (sides & 2) { x.fillRect(X, Y + T - 1, T, 1); }
    if (sides & 4) { x.fillRect(X, Y, 1, T); for (let i = (frame + Y) % 4; i < T; i += 4) x.fillRect(X + 1, Y + i, 1, 2); }
    if (sides & 8) { x.fillRect(X + T - 1, Y, 1, T); for (let i = (frame + Y) % 4; i < T; i += 4) x.fillRect(X + T - 2, Y + i, 1, 2); }
  }

  /* ---------------- characters (paper-doll humanoids) ---------------- */
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = G.clamp(Math.round(r * f), 0, 255); g = G.clamp(Math.round(g * f), 0, 255); b = G.clamp(Math.round(b * f), 0, 255);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  };
  function human(p, dir, frame) {
    const [c, x] = mk(16, 16);
    const skin = p.skin || '#f1c9a5', hair = p.hair || '#4a2e20', top = p.top || '#3f6fa0', bot = p.bottom || '#3b3a46', shoe = p.shoe || '#2a1e1a';
    const topD = shade(top, 0.75), skinD = shade(skin, 0.85), hairL = shade(hair, 1.3);
    const side = dir === 'left' || dir === 'right';
    const l1 = frame === 1, l2 = frame === 2;
    // legs + feet
    if (!side) {
      px(x, 5, 12, 2, l1 ? 2 : 3, bot); px(x, 9, 12, 2, l2 ? 2 : 3, bot);
      px(x, 5, l1 ? 14 : 15, 2, 1, shoe); px(x, 9, l2 ? 14 : 15, 2, 1, shoe);
    } else {
      if (frame === 0) { px(x, 6, 12, 4, 3, bot); px(x, 6, 15, 4, 1, shoe); }
      else { px(x, l1 ? 5 : 6, 12, 2, 3, bot); px(x, l1 ? 9 : 8, 12, 2, 3, shoe === bot ? bot : shade(bot, 0.8)); px(x, l1 ? 4 : 5, 15, 3, 1, shoe); px(x, l1 ? 9 : 8, 15, 2, 1, shoe); }
    }
    // torso
    if (p.robe) { px(x, 4, 7, 8, 8, top); px(x, 4, 14, 8, 1, topD); }
    if (!side) {
      px(x, 4, 7, 8, 5, top); px(x, 11, 7, 1, 5, topD); px(x, 4, 11, 8, 1, topD);
      if (p.apron) { px(x, 6, 8, 4, 5, p.apron); }
      if (p.scarf) px(x, 4, 7, 8, 1, p.scarf);
      if (p.belt) px(x, 4, 11, 8, 1, p.belt);
      const sw = frame ? (l1 ? -1 : 1) : 0;
      px(x, 3, 8 + sw, 1, 3, top); px(x, 12, 8 - sw, 1, 3, top); px(x, 3, 11 + sw, 1, 1, skin); px(x, 12, 11 - sw, 1, 1, skin);
    } else {
      px(x, 5, 7, 6, 5, top); px(x, 5, 11, 6, 1, topD);
      if (p.apron) px(x, 5, 8, 2, 5, p.apron);
      if (p.scarf) px(x, 5, 7, 6, 1, p.scarf);
      if (p.belt) px(x, 5, 11, 6, 1, p.belt);
      const ax = frame === 0 ? 7 : l1 ? 6 : 8; px(x, ax, 8, 2, 3, topD); px(x, ax, 11, 2, 1, skin);
    }
    // head
    if (p.hat === 'helm') {
      ellipse(x, 8, 4, 4, 4, '#b8862f'); ellipse(x, 7, 3, 3, 3, '#d9a64a');
      if (dir !== 'up') { const wx = dir === 'left' ? 4 : dir === 'right' ? 8 : 6; px(x, wx, 3, 4, 3, '#1f4a52'); px(x, wx, 3, 2, 1, P.glow); }
      px(x, 4, 4, 1, 1, '#7a5a22'); px(x, 11, 4, 1, 1, '#7a5a22');
    } else {
      if (!side) {
        px(x, 5, 2, 6, 6, skin); px(x, 5, 7, 6, 1, skinD);
        if (dir === 'down') { px(x, 6, 5, 1, 1, P.ink); px(x, 9, 5, 1, 1, P.ink); if (!p.beard) px(x, 5, 6, 1, 1, '#e8a090'), px(x, 10, 6, 1, 1, '#e8a090'); }
      } else {
        px(x, 4, 2, 6, 6, skin); px(x, 4, 7, 6, 1, skinD); px(x, 3, 5, 1, 1, skin);
        px(x, 5, 5, 1, 1, P.ink);
      }
      const hs = p.hairStyle || 'short';
      if (hs !== 'bald') {
        if (dir === 'up') { px(x, 4, 1, 8, 7, hair); px(x, 5, 1, 4, 1, hairL); }
        else if (!side) { px(x, 5, 1, 6, 1, hair); px(x, 4, 2, 8, 2, hair); px(x, 4, 4, 1, 2, hair); px(x, 11, 4, 1, 2, hair); px(x, 6, 1, 3, 1, hairL); if (hs === 'fringe') px(x, 5, 4, 2, 1, hair); }
        else { px(x, 5, 1, 5, 1, hair); px(x, 4, 2, 7, 2, hair); px(x, 8, 4, 3, 3, hair); px(x, 6, 1, 2, 1, hairL); }
        if (hs === 'long') { if (!side) { px(x, 3, 4, 2, 5, hair); px(x, 11, 4, 2, 5, hair); } else px(x, 8, 4, 3, 6, hair); if (dir === 'up') px(x, 4, 7, 8, 3, hair); }
        if (hs === 'bun') { px(x, 7, 0, 2, 1, hair); px(x, 6, -0, 4, 1, hair); }
        if (hs === 'tail') { if (dir === 'up') px(x, 7, 8, 2, 3, hair); else if (side) px(x, 10, 4, 2, 4, hair); }
        if (hs === 'spiky') { px(x, 4, 0, 1, 2, hair); px(x, 7, 0, 2, 1, hair); px(x, 11, 0, 1, 2, hair); }
      } else if (dir !== 'down') px(x, 4, 2, 8, 2, skinD);
      if (p.beard && dir !== 'up') { if (!side) { px(x, 5, 6, 6, 2, p.beard); px(x, 6, 8, 4, 1, p.beard); } else px(x, 4, 6, 4, 2, p.beard); }
      if (p.glasses && dir !== 'up') { if (!side) { px(x, 5, 5, 2, 1, '#cfe8ff'); px(x, 9, 5, 2, 1, '#cfe8ff'); px(x, 7, 5, 2, 1, P.ink); } else px(x, 4, 5, 2, 1, '#cfe8ff'); }
      if (p.hat === 'cap') { px(x, 4, 1, 8, 2, p.hatColor || '#8a3b3b'); if (dir === 'down') px(x, 3, 3, 10, 1, shade(p.hatColor || '#8a3b3b', 0.7)); else if (side) px(x, 2, 3, 4, 1, shade(p.hatColor || '#8a3b3b', 0.7)); }
      if (p.hat === 'brim') { px(x, 5, 0, 6, 2, p.hatColor || '#6b5a3a'); px(x, 2, 2, 12, 1, shade(p.hatColor || '#6b5a3a', 0.8)); }
      if (p.hat === 'tricorn') { px(x, 3, 1, 10, 2, p.hatColor || '#2b2b3a'); px(x, 6, 0, 4, 1, p.hatColor || '#2b2b3a'); px(x, 3, 1, 10, 1, '#d9a64a'); }
      if (p.hat === 'hood') { px(x, 3, 1, 10, 3, p.hatColor || top); if (dir !== 'up') { px(x, 3, 4, 2, 4, p.hatColor || top); px(x, 11, 4, 2, 4, p.hatColor || top); } else px(x, 3, 1, 10, 8, p.hatColor || top); }
    }
    let out = outline(c, p.ghost ? '#20305a' : P.ink);
    if (p.ghost) { const [c2, x2] = mk(16, 16); x2.drawImage(out, 0, 0); x2.globalCompositeOperation = 'source-atop'; x2.fillStyle = 'rgba(120,200,255,0.45)'; x2.fillRect(0, 0, 16, 16); out = c2; }
    return out;
  }

  /* ---------------- monsters (24x24, 2 frames) ---------------- */
  const monsters = {
    crab: (x, f, p) => {
      const sh = p.shell || '#d0603f', shD = shade(sh, 0.7), shL = shade(sh, 1.25);
      for (const [X, d] of [[6, -1], [8, -1], [10, -1], [14, 1], [16, 1], [18, 1]]) { px(x, X, 17, 1, 2, shD); px(x, X + d, 19, 1, 2, shD); }
      ellipse(x, 12, 15, 8, 4, sh); ellipse(x, 11, 13, 5, 2, shL); px(x, 5, 17, 14, 1, shD);
      if (p.barnacles) speck(x, 8, ['#d8d0bf', '#8a8478'], 5, [6, 12, 12, 4]);
      const cy = f ? 9 : 10;
      for (const X of [3, 21]) { ellipse(x, X, cy, 3, 3, sh); px(x, X - 1, cy - 3, 2, 2, shL); px(x, X - (X < 12 ? -1 : 1), cy - 1 - (f ? 1 : 0), 1, 2, 'rgba(0,0,0,0)'); x.clearRect(X - (X < 12 ? 0 : 1), cy - 3 + (f ? 0 : 1), 2, 2); }
      px(x, 5, 12, 2, 2, sh); px(x, 17, 12, 2, 2, sh);
      px(x, 9, 9, 1, 3, shD); px(x, 14, 9, 1, 3, shD);
      px(x, 8, 7, 3, 3, '#f6efe0'); px(x, 13, 7, 3, 3, '#f6efe0'); px(x, 9, 8, 1, 1, P.ink); px(x, 14, 8, 1, 1, P.ink);
      if (p.angry) { px(x, 8, 6, 3, 1, P.ink); px(x, 13, 6, 3, 1, P.ink); }
    },
    jelly: (x, f, p) => {
      const b = p.body || '#c9b8ee', bL = shade(b, 1.12), bD = shade(b, 0.78);
      const t = f ? 1 : 0;
      for (let i = 0; i < 5; i++) { const X = 6 + i * 3; for (let Y = 15; Y < 22; Y++) px(x, X + (((Y + i + t) >> 1) % 2), Y, 1, 1, i % 2 ? bD : b); }
      ellipse(x, 12, 11 + t, 8, 6, b); x.clearRect(0, 15 + t, 24, 9); px(x, 4, 14 + t, 16, 2, bD);
      ellipse(x, 10, 8 + t, 4, 2, bL); px(x, 8, 6 + t, 2, 1, '#ffffff');
      px(x, 9, 11 + t, 2, 2, P.ink); px(x, 14, 11 + t, 2, 2, P.ink); px(x, 11, 14 + t, 3, 1, bD);
    },
    bird: (x, f, p) => {
      const b = p.body || '#dfe3ea', bD = shade(b, 0.75), w = p.wing || '#8a93a6';
      ellipse(x, 11, 14, 6, 4, b); px(x, 6, 16, 10, 1, bD);
      px(x, 3, 12, 3, 2, w); px(x, 2, 11, 2, 1, w);
      ellipse(x, 16, 9, 3, 3, b); px(x, 19, 9, 3, 1, '#f09a5a'); px(x, 19, 10, 2, 1, '#d07a3a'); px(x, 17, 8, 1, 1, P.ink);
      if (!f) { for (let i = 0; i < 6; i++) px(x, 8 + i, 4 + i, 3, 2, w); px(x, 8, 3, 2, 2, bD); }
      else { for (let i = 0; i < 5; i++) px(x, 8 + i, 17 + (i >> 1), 4, 1, w); }
      px(x, 10, 18, 1, 3, '#d07a3a'); px(x, 13, 18, 1, 3, '#d07a3a');
    },
    eel: (x, f, p) => {
      const b = p.body || '#6b7a52', bl = p.belly || '#a8b07a';
      for (let i = 0; i < 20; i++) { const t = i / 19; const X = 3 + t * 15, Y = 20 - t * 14 + Math.sin(t * 6 + f * 1.5) * 3; ellipse(x, X, Y, 2, 2, b); px(x, Math.round(X), Math.round(Y) + 1, 1, 1, bl); }
      ellipse(x, 19, 5, 3, 3, b); px(x, 20, 4, 1, 1, '#f5d85a'); px(x, 21, 7, 2, 1, P.ink); px(x, 17, 3, 2, 1, shade(b, 1.3));
    },
    urchin: (x, f, p) => {
      const b = p.body || '#5a3a6e';
      for (let a = 0; a < 16; a++) { const an = (a / 16) * Math.PI * 2 + f * 0.1; for (let r = 5; r < 10; r++) px(x, Math.round(12 + Math.cos(an) * r), Math.round(13 + Math.sin(an) * r * 0.9), 1, 1, r > 8 ? shade(b, 1.5) : shade(b, 1.1)); }
      ellipse(x, 12, 13, 6, 5, b); ellipse(x, 11, 12, 3, 2, shade(b, 1.3)); px(x, 9, 13, 2, 2, '#f5d85a'); px(x, 14, 13, 2, 2, '#f5d85a'); px(x, 10, 14, 1, 1, P.ink); px(x, 15, 14, 1, 1, P.ink);
    },
    wight: (x, f, p) => {
      const b = p.body || '#3f5a32', bL = shade(b, 1.5);
      ellipse(x, 12, 13, 6, 9, b);
      for (let i = 0; i < 6; i++) { const X = 7 + i * 2; for (let Y = 8 + (i % 3); Y < 23; Y += 2) px(x, X + ((Y + f) % 4 > 1 ? 1 : 0), Y, 1, 1, bL); }
      px(x, 3, 12 + f, 4, 1, b); px(x, 2, 13 + f, 2, 4, b); px(x, 17, 12 - f, 4, 1, b); px(x, 20, 13 - f, 2, 4, b);
      px(x, 9, 9, 2, 2, '#f5d85a'); px(x, 13, 9, 2, 2, '#f5d85a');
    },
    moth: (x, f, p) => {
      const w = p.wing || '#9ad8d0', wD = shade(w, 0.7), up = f ? -2 : 0;
      ellipse(x, 7, 9 + up, 6, 5, w); ellipse(x, 17, 9 + up, 6, 5, w); ellipse(x, 7, 17, 4, 3, wD); ellipse(x, 17, 17, 4, 3, wD);
      ellipse(x, 6, 9 + up, 2, 2, '#f2e6c9'); ellipse(x, 18, 9 + up, 2, 2, '#f2e6c9'); px(x, 6, 9 + up, 1, 1, P.ink); px(x, 18, 9 + up, 1, 1, P.ink);
      px(x, 11, 6, 2, 14, '#3a2e44'); px(x, 10, 3, 1, 3, '#3a2e44'); px(x, 13, 3, 1, 3, '#3a2e44');
    },
    clam: (x, f, p) => {
      const b = p.body || '#b8a6c8', o = f ? 3 : 1;
      ellipse(x, 12, 17, 9, 4, shade(b, 0.8)); ellipse(x, 12, 12 - o, 9, 4, b);
      for (let i = -3; i <= 3; i++) px(x, 12 + i * 2, 9 - o, 1, 5, shade(b, 0.7));
      px(x, 5, 14 - o + 1, 14, o + 1, '#5a2030'); if (f) { ellipse(x, 12, 15, 2, 1, '#f6efe0'); }
      px(x, 9, 15, 1, 1, '#f5d85a'); px(x, 15, 15, 1, 1, '#f5d85a');
    },
  };
  function monster(kind, pal, frame) {
    const [c, x] = mk(24, 24);
    if (kind === 'human') { const h = human(pal, 'down', 0); x.drawImage(h, 4, 4); }
    else (monsters[kind] || monsters.jelly)(x, frame, pal || {});
    return outline(c, (pal && pal.outline) || P.ink);
  }
  const sprCache = new Map();
  const cached = (key, f) => { let c = sprCache.get(key); if (!c) { c = f(); sprCache.set(key, c); } return c; };
  return {
    P, mk, outline, ellipse, tile, foam, shade, painters,
    human: (p, dir = 'down', frame = 0) => cached('h' + JSON.stringify(p) + dir + frame, () => human(p, dir === 'right' ? 'left' : dir, frame)),
    monster: (kind, pal, frame = 0) => cached('m' + kind + JSON.stringify(pal || {}) + frame, () => monster(kind, pal, frame)),
    portrait(p) {
      return cached('p' + JSON.stringify(p), () => {
        const [c, x] = mk(48, 48);
        x.fillStyle = '#20263d'; x.fillRect(0, 0, 48, 48);
        const h = human(p, 'down', 0); x.drawImage(h, 0, 0, 16, 11, 0, 2, 48, 33); x.drawImage(h, 0, 7, 16, 6, 0, 35, 48, 18);
        return c;
      });
    },
  };
})();

/* ---- 20-audio.js ---- */
/* Generated audio: a tiny seeded chiptune sequencer + synthesized SFX (WebAudio).
   No samples, no third-party assets. Songs are data (core.json -> music). */
G.audio = (() => {
  let ac = null, master, musicBus, sfxBus, noiseBuf, cur = null, timer = null;
  const vol = { music: 0.55, sfx: 0.7, muted: false };
  try { Object.assign(vol, JSON.parse(localStorage.getItem('ebbmarrow.audio') || '{}')); } catch (e) {}
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10] };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
    musicBus = ac.createGain(); sfxBus = ac.createGain(); musicBus.connect(master); sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply(); return true;
  }
  function apply() { if (!ac) return; master.gain.value = vol.muted ? 0 : 1; musicBus.gain.value = vol.music * 0.5; sfxBus.gain.value = vol.sfx * 0.6; localStorage.setItem('ebbmarrow.audio', JSON.stringify(vol)); }
  function tone(bus, type, f, t, dur, g, opts = {}) {
    const o = ac.createOscillator(), e = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.attack || 0.005;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opts.lp; o.connect(fl); node = fl; }
    node.connect(e); e.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(bus, t, dur, g, f = 6000, type = 'highpass') {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), e = ac.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f;
    e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(e); e.connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }
  /* ---------- music ---------- */
  function play(name) {
    if (!G.data || !G.data.music) return;
    const song = G.data.music[name]; if (!song) { stop(); return; }
    if (cur && cur.name === name) return;
    cur = { name, song, step: 0, next: 0 };
    if (!init()) return;
    cur.next = ac.currentTime + 0.12;
    if (!timer) timer = setInterval(tick, 50);
  }
  function stop() { cur = null; }
  function tick() {
    if (!cur || !ac || ac.state !== 'running') return;
    const s = cur.song, sp = 60 / s.bpm / 4;
    while (cur.next < ac.currentTime + 0.25) { stepAt(cur, s, cur.step, cur.next); cur.step++; cur.next += sp * (s.swing && cur.step % 2 ? 1 + s.swing : s.swing && !(cur.step % 2) ? 1 - s.swing : 1); }
  }
  function stepAt(c, s, step, t) {
    const sc = SCALES[s.scale] || SCALES.minor, root = s.root || 57;
    const bar = (step / 16) | 0, st = step % 16, deg = s.prog[bar % s.prog.length];
    const note = (d, oct = 0) => root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
    const sp = 60 / s.bpm / 4;
    if (st === 0 && s.pad !== false) for (const k of [0, 2, 4]) tone(musicBus, 'triangle', hz(note(deg + k)), t, sp * 16, 0.05, { attack: 0.4, detune: k * 3 });
    if (s.bass !== false && (st === 0 || st === 8 || (s.busy && (st === 6 || st === 14)))) tone(musicBus, s.bassWave || 'triangle', hz(note(deg, -1)), t, sp * (st === 0 ? 6 : 4), 0.16, { lp: 900 });
    // phrase-seeded melody: repeats every 4 bars so it reads as a tune, not noise
    const r = G.rng((s.seed || 1) * 977 + (bar % 4) * 131 + st * 7);
    const density = s.density || 0.45;
    if (st % 2 === 0 && r() < density) {
      const ch = [0, 2, 4, 7, 5][(r() * (r() < 0.7 ? 3 : 5)) | 0];
      tone(musicBus, s.leadWave || 'square', hz(note(deg + ch, s.leadOct == null ? 1 : s.leadOct)), t, sp * (r() < 0.3 ? 4 : 2), 0.045, { lp: s.lp || 2400 });
    }
    if (s.arp && st % 2 === 1) tone(musicBus, 'sine', hz(note(deg + [0, 2, 4, 2][(st >> 1) % 4], 1)), t, sp * 1.5, 0.03);
    if (s.drums) {
      if (st % 4 === 2 || (s.drums === 'drive' && st % 2 === 1)) noise(musicBus, t, 0.04, 0.05);
      if (st === 0 || (s.drums === 'drive' && st === 8)) tone(musicBus, 'sine', 120, t, 0.18, 0.25, { slide: 40 });
      if (s.drums === 'drive' && (st === 4 || st === 12)) noise(musicBus, t, 0.12, 0.09, 1800, 'bandpass');
    }
    if (s.waves && st === 0 && bar % 2 === 0) noise(musicBus, t, sp * 14, 0.05, 500, 'lowpass');
  }
  /* ---------- sfx ---------- */
  const fx = {
    blip: (t) => tone(sfxBus, 'square', 880 + Math.random() * 60, t, 0.03, 0.03, { lp: 3000 }),
    move: (t) => tone(sfxBus, 'square', 660, t, 0.04, 0.05, { lp: 2600 }),
    select: (t) => { tone(sfxBus, 'square', 880, t, 0.06, 0.06, { lp: 3000 }); tone(sfxBus, 'square', 1320, t + 0.05, 0.08, 0.05, { lp: 3000 }); },
    cancel: (t) => tone(sfxBus, 'square', 440, t, 0.08, 0.05, { slide: 300, lp: 2000 }),
    hit: (t) => { noise(sfxBus, t, 0.12, 0.3, 1200, 'bandpass'); tone(sfxBus, 'square', 220, t, 0.1, 0.12, { slide: 80 }); },
    crit: (t) => { noise(sfxBus, t, 0.2, 0.4, 2000, 'bandpass'); tone(sfxBus, 'sawtooth', 520, t, 0.18, 0.12, { slide: 90 }); },
    hurt: (t) => { tone(sfxBus, 'sawtooth', 160, t, 0.2, 0.16, { slide: 60, lp: 1200 }); noise(sfxBus, t, 0.1, 0.2, 800, 'lowpass'); },
    splash: (t) => { noise(sfxBus, t, 0.45, 0.35, 900, 'bandpass'); tone(sfxBus, 'sine', 600, t, 0.3, 0.08, { slide: 1400 }); },
    heal: (t) => { for (let i = 0; i < 4; i++) tone(sfxBus, 'triangle', hz(72 + [0, 4, 7, 12][i]), t + i * 0.07, 0.25, 0.08); },
    guard: (t) => tone(sfxBus, 'triangle', 300, t, 0.25, 0.12, { slide: 500 }),
    chest: (t) => { [0, 4, 7, 11, 12].forEach((n, i) => tone(sfxBus, 'square', hz(76 + n), t + i * 0.06, 0.15, 0.05, { lp: 3500 })); },
    level: (t) => { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(sfxBus, 'square', hz(72 + n), t + i * 0.09, 0.2, 0.06, { lp: 3500 })); },
    win: (t) => { [0, 4, 7, 12].forEach((n, i) => tone(sfxBus, 'square', hz(67 + n), t + i * 0.12, 0.3, 0.06, { lp: 3000 })); tone(sfxBus, 'triangle', hz(55), t, 0.8, 0.12); },
    battle: (t) => { tone(sfxBus, 'sawtooth', 200, t, 0.5, 0.1, { slide: 900, lp: 2500 }); noise(sfxBus, t, 0.5, 0.15, 3000); },
    door: (t) => noise(sfxBus, t, 0.35, 0.18, 400, 'lowpass'),
    bell: (t) => { for (const [m, g] of [[57, 0.18], [64, 0.08], [69, 0.06], [76, 0.03]]) tone(sfxBus, 'sine', hz(m), t, 3.5, g, { attack: 0.01 }); },
    seal: (t) => { tone(sfxBus, 'sine', hz(62), t, 2.2, 0.14, { attack: 0.3 }); tone(sfxBus, 'sine', hz(69), t + 0.2, 2, 0.1, { attack: 0.3 }); noise(sfxBus, t, 1.8, 0.06, 600, 'lowpass'); },
    flee: (t) => { [0, 3, 6].forEach((n, i) => tone(sfxBus, 'square', hz(70 - n * 2), t + i * 0.05, 0.08, 0.05)); },
    buy: (t) => { tone(sfxBus, 'square', hz(84), t, 0.06, 0.05); tone(sfxBus, 'square', hz(91), t + 0.07, 0.12, 0.05); },
  };
  return {
    unlock() { if (init() && ac.state === 'suspended') ac.resume(); },
    play, stop,
    sfx(name) { if (!ac || ac.state !== 'running' || vol.muted) return; const f = fx[name]; if (f) f(ac.currentTime + 0.005); },
    get vol() { return vol; },
    set(k, v) { vol[k] = v; apply(); },
    get current() { return cur && cur.name; },
  };
})();

/* ---- 30-state.js ---- */
/* Data loading (date-gated chapters), game state, conditions, inventory, quests, save/load. */
G.SAVE_KEY = 'ebbmarrow.save.1';
G.loadData = async () => {
  const bust = 'b=' + G.VERSION;
  const get = async (f) => { const r = await fetch('data/' + f + '?' + bust, { cache: 'no-cache' }); if (!r.ok) throw new Error('load ' + f + ' ' + r.status); return r.json(); };
  const man = await get('manifest.json');
  const core = await get(man.core);
  const D = { manifest: man, tiles: core.tiles, items: core.items, enemies: core.enemies, skills: core.skills, player: core.player, music: core.music, looks: core.looks || {}, maps: {}, dialogs: {}, quests: {}, patches: [], chapters: [], changelog: [] };
  const merge = (src) => {
    for (const k of ['items', 'enemies', 'skills', 'music', 'looks', 'maps', 'dialogs', 'quests', 'tiles']) if (src[k]) Object.assign(D[k], src[k]);
    if (src.patches) D.patches.push(...src.patches);
  };
  merge(core);
  for (const meta of man.chapters) {
    const ch = await get(meta.file);
    for (const p of ch.patches || []) if (p.when == null) p.when = ch.id + '_started';
    merge(ch);
    D.chapters.push({ ...meta, ...ch, locked: false, maps: undefined, dialogs: undefined, patches: undefined });
  }
  try { D.changelog = await get(man.changelog); } catch (e) { D.changelog = []; }
  G.data = D;
  return D;
};

G.state = (() => {
  let S = null;
  const D = () => G.data;
  const api = {
    get S() { return S; },
    newGame() {
      const p = D().player;
      S = { v: 1, name: p.name, map: p.start.map, x: p.start.x, y: p.start.y, dir: p.start.dir || 'down', lvl: 1, xp: 0, hp: 0, sp: 0, shells: p.start.shells || 0,
        equip: { weapon: null, charm: null }, inv: { ...(p.start.inv || {}) }, flags: {}, quests: {}, skills: [], respawn: { ...p.start }, time: 0, savedAt: null, tempFoes: {} };
      api.learnFor(1); const st = api.stats(); S.hp = st.hp; S.sp = st.sp;
      return S;
    },
    load() {
      try { const raw = localStorage.getItem(G.SAVE_KEY); if (!raw) return null; const s = JSON.parse(raw); if (!s || s.v !== 1) return null; S = s; S.tempFoes = {}; if (!D().maps[S.map]) { S.map = S.respawn.map; S.x = S.respawn.x; S.y = S.respawn.y; } return S; } catch (e) { return null; }
    },
    peek() { try { return JSON.parse(localStorage.getItem(G.SAVE_KEY) || 'null'); } catch (e) { return null; } },
    save() { if (!S) return; S.savedAt = new Date().toISOString(); const { tempFoes, ...rest } = S; localStorage.setItem(G.SAVE_KEY, JSON.stringify(rest)); },
    wipe() { localStorage.removeItem(G.SAVE_KEY); },
    stats() {
      const p = D().player, L = S.lvl - 1, st = {};
      for (const k of ['hp', 'sp', 'atk', 'def', 'spd']) st[k] = p.base[k] + Math.floor(p.growth[k] * L);
      for (const slot of ['weapon', 'charm']) { const it = S.equip[slot] && D().items[S.equip[slot]]; if (it && it.bonus) for (const k in it.bonus) st[k] = (st[k] || 0) + it.bonus[k]; }
      return st;
    },
    xpFor(l) { const c = D().player.xpCurve; return l - 1 < c.length ? c[l - 1] : c[c.length - 1] + (l - c.length) * 400; },
    learnFor(l) { const out = []; for (const sk of D().player.skills[String(l)] || []) if (!S.skills.includes(sk)) { S.skills.push(sk); out.push(sk); } return out; },
    gainXp(n) {
      S.xp += n; const ups = [];
      while (S.xp >= api.xpFor(S.lvl + 1)) { const before = api.stats(); S.lvl++; const after = api.stats(); S.hp += after.hp - before.hp; S.sp += after.sp - before.sp; ups.push({ lvl: S.lvl, learned: api.learnFor(S.lvl) }); }
      return ups;
    },
    has(id, n = 1) { return (S.inv[id] || 0) >= n || S.equip.weapon === id || S.equip.charm === id; },
    count(id) { return S.inv[id] || 0; },
    give(id, n = 1) { S.inv[id] = (S.inv[id] || 0) + n; const it = D().items[id]; if (it && (it.type === 'weapon' || it.type === 'charm')) { const cur = S.equip[it.type] && D().items[S.equip[it.type]]; const score = (x) => x ? Object.values(x.bonus || {}).reduce((a, b) => a + b, 0) : -1; if (!cur || score(it) > score(cur)) { api.equip(id); if (cur && G.ui && G.ui.toast) G.ui.toast('Equipped ' + it.name); } } },
    take(id, n = 1) { S.inv[id] = Math.max(0, (S.inv[id] || 0) - n); if (!S.inv[id]) delete S.inv[id]; },
    equip(id) {
      const it = D().items[id]; if (!it || !(it.type === 'weapon' || it.type === 'charm')) return;
      const st0 = api.stats(); const old = S.equip[it.type]; if (old) api.give2(old); api.take(id); S.equip[it.type] = id;
      const st1 = api.stats(); S.hp = G.clamp(S.hp + (st1.hp - st0.hp), 1, st1.hp); S.sp = G.clamp(S.sp + (st1.sp - st0.sp), 0, st1.sp);
    },
    give2(id) { S.inv[id] = (S.inv[id] || 0) + 1; },
    heal(all = true) { const st = api.stats(); S.hp = st.hp; S.sp = st.sp; },
    flag(f, v = true) { if (v) S.flags[f] = v; else delete S.flags[f]; },
    startQuest(id) { if (!S.quests[id]) { S.quests[id] = 'active'; return true; } return false; },
    questStep(id) { const q = D().quests[id]; if (!q) return null; return q.steps.find((s) => !api.cond(s.flag)) || null; },
    /* Returns ids of quests that just completed (all step flags set). */
    checkQuests() {
      const done = [];
      for (const id in S.quests) if (S.quests[id] === 'active') { const q = D().quests[id]; if (q && q.steps.every((s) => api.cond(s.flag))) { S.quests[id] = 'done'; done.push(id); } }
      return done;
    },
    /* Condition mini-language: space-separated terms, all must hold.
       flag | !flag | item:id | item:id>=3 | quest:id (active) | done:id | lvl>=N | shells>=N | any:a,b (any flag) */
    cond(c) {
      if (c == null || c === '' || c === true) return true;
      for (let term of String(c).trim().split(/\s+/)) {
        let neg = false; if (term[0] === '!') { neg = true; term = term.slice(1); }
        let ok;
        const m = term.match(/^(item|lvl|shells):?([\w-]*)(>=|<=|>|<|=)?(\d+)?$/);
        if (term.startsWith('item:')) { const mm = term.slice(5).match(/^([\w-]+)(>=(\d+))?$/); ok = api.has(mm[1], mm[3] ? +mm[3] : 1); }
        else if (term.startsWith('quest:')) ok = S.quests[term.slice(6)] === 'active';
        else if (term.startsWith('done:')) ok = S.quests[term.slice(5)] === 'done';
        else if (term.startsWith('any:')) ok = term.slice(4).split(',').some((f) => !!S.flags[f]);
        else if (/^(lvl|shells)(>=|<=|>|<|=)\d+$/.test(term)) { const [, k, op, n] = term.match(/^(lvl|shells)(>=|<=|>|<|=)(\d+)$/); const v = S[k], N = +n; ok = op === '>=' ? v >= N : op === '<=' ? v <= N : op === '>' ? v > N : op === '<' ? v < N : v === N; }
        else ok = !!S.flags[term];
        void m;
        if (neg) ok = !ok; if (!ok) return false;
      }
      return true;
    },
    text(t) { return String(t).replace(/\{name\}/g, S ? S.name : 'Tamsin').replace(/\{shells\}/g, S ? S.shells : 0); },
  };
  return api;
})();

/* ---- 50-world.js ---- */
/* Tile world: map building (with date/flag-gated patches), entities, movement,
   camera, rendering, lighting and ambient particles. */
G.world = (() => {
  const T = G.TILE, A = G.art, st = G.state;
  let M = null; // runtime map
  const pl = { x: 0, y: 0, px: 0, py: 0, dir: 'down', moving: false, fx: 0, fy: 0, t: 0, frame: 0, step: 0 };
  let particles = [], frame = 0, clock = 0, shake = 0, onStep = null, lastBump = 0;
  const tdef = (ch) => (G.data.tiles[ch] || G.data.tiles['.']);

  function build(id) {
    const def = G.data.maps[id]; if (!def) throw new Error('no map ' + id);
    const fill = def.fill || '.';
    const rows = def.rows.map((r) => r.split(''));
    const W = Math.max(...rows.map((r) => r.length)), H = rows.length;
    for (const r of rows) while (r.length < W) r.push(fill);
    const ents = [];
    const addEnt = (e, src) => ents.push({ ...e, _src: src, px: e.x * T, py: e.y * T, dir: e.dir || 'down', ox: e.x, oy: e.y, mt: Math.random() * 2, moving: false, fx: e.x, fy: e.y });
    (def.entities || []).forEach((e) => addEnt(e, 'map'));
    for (const p of G.data.patches) {
      if (p.map !== id || !st.cond(p.when)) continue;
      if (p.rect) { const [x0, y0, w, h, ch] = p.rect; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (rows[y] && x < W) rows[y][x] = ch; }
      for (const [x, y, ch] of p.tiles || []) if (rows[y]) rows[y][x] = ch;
      if (p.rows) p.rows.rows.forEach((r, i) => r.split('').forEach((ch, j) => { if (ch !== ' ' && rows[p.rows.y + i]) rows[p.rows.y + i][p.rows.x + j] = ch; }));
      (p.entities || []).forEach((e) => addEnt(e, 'patch'));
    }
    // phases: the same map can change mood with story progress (dawn -> day, storm, etc.)
    let dark = def.dark || 0, tint = def.tint || null, music = def.music, particles = def.particles;
    for (const ph of def.phases || []) if (st.cond(ph.when)) { if (ph.dark != null) dark = ph.dark; if (ph.tint !== undefined) tint = ph.tint; if (ph.music) music = ph.music; if (ph.particles !== undefined) particles = ph.particles; }
    return { id, def, W, H, grid: rows, ents, name: def.name, dark, tint, music, particles };
  }
  function visible(e) {
    const S = st.S;
    if (e.when && !st.cond(e.when)) return false;
    if (e.unless && st.cond(e.unless)) return false;
    if (e.type === 'enemy' && (S.flags['foe:' + M.id + ':' + e.id] || S.tempFoes[M.id + ':' + e.id])) return false;
    if (e.type === 'chest' && S.flags['chest:' + M.id + ':' + e.id] && e.style !== 'chest') return false;
    return true;
  }
  function enter(id, x, y, dir) {
    const S = st.S; M = build(id);
    S.map = id; S.x = x; S.y = y; if (dir) S.dir = dir;
    pl.x = x; pl.y = y; pl.px = x * T; pl.py = y * T; pl.dir = S.dir; pl.moving = false;
    S.tempFoes = {};
    particles = [];
    G.audio.play(M.music);
    return M;
  }
  function refresh() { if (!M) return; const old = M; M = build(M.id); if (M.music !== old.music) G.audio.play(M.music); for (const e of M.ents) { const o = old.ents.find((q) => q.id && q.id === e.id); if (o) Object.assign(e, { x: o.x, y: o.y, px: o.px, py: o.py, dir: o.dir, fx: o.fx, fy: o.fy }); } }
  const inb = (x, y) => x >= 0 && y >= 0 && x < M.W && y < M.H;
  const entAt = (x, y, pred) => M.ents.find((e) => visible(e) && ((e.w ? x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + (e.h || 1) : e.x === x && e.y === y) || (e.moving && e.fx === x && e.fy === y)) && (!pred || pred(e)));
  const solidEnt = (e) => e.type === 'npc' || e.type === 'enemy' || e.type === 'chest' || e.type === 'sign' || e.type === 'shrine' || e.type === 'prop' || (e.type === 'block' && visible(e));
  function blocked(x, y, who) {
    if (!inb(x, y)) return true;
    if (tdef(M.grid[y][x]).solid) return true;
    const e = entAt(x, y, solidEnt); if (e && e !== who) return true;
    if (who && who !== pl && pl.x === x && pl.y === y) return true;
    return false;
  }
  function tryMove(dir) {
    const [dx, dy] = G.DIRS[dir]; pl.dir = dir; st.S.dir = dir;
    const nx = pl.x + dx, ny = pl.y + dy;
    const foe = entAt(nx, ny, (e) => e.type === 'enemy');
    if (foe) { G.main.encounter(foe); return; }
    if (blocked(nx, ny, pl)) { if (clock - lastBump > 0.35) { lastBump = clock; } return; }
    pl.moving = true; pl.fx = nx; pl.fy = ny; pl.t = 0;
  }
  function arrive() {
    const S = st.S; pl.x = pl.fx; pl.y = pl.fy; S.x = pl.x; S.y = pl.y; pl.moving = false; pl.step++;
    const ex = M.ents.find((e) => e.type === 'exit' && visible(e) && pl.x >= e.x && pl.x < e.x + (e.w || 1) && pl.y >= e.y && pl.y < e.y + (e.h || 1));
    if (ex) { G.main.travel(ex.to, ex.tx, ex.ty, ex.dir || pl.dir); return; }
    const tr = M.ents.find((e) => e.type === 'trigger' && visible(e) && pl.x >= e.x && pl.x < e.x + (e.w || 1) && pl.y >= e.y && pl.y < e.y + (e.h || 1) && !(e.once !== false && S.flags['trig:' + e.id]));
    if (tr) { if (tr.once !== false) st.flag('trig:' + tr.id); G.main.runScript(tr.dialog, tr); return; }
    const foe = M.ents.find((e) => e.type === 'enemy' && visible(e) && Math.abs(e.x - pl.x) + Math.abs(e.y - pl.y) === 0);
    if (foe) G.main.encounter(foe);
  }
  function facing() { const [dx, dy] = G.DIRS[pl.dir]; return entAt(pl.x + dx, pl.y + dy, (e) => e.type !== 'exit' && e.type !== 'trigger' && e.type !== 'light'); }
  function interact() {
    const e = facing(); if (!e) return false;
    if (e.type === 'npc') { const back = { up: 'down', down: 'up', left: 'right', right: 'left' }; if (!e.fixed) e.dir = back[pl.dir]; }
    G.main.interact(e); return true;
  }
  function updateEnts(dt) {
    for (const e of M.ents) {
      if (!visible(e)) continue;
      if (e.moving) {
        e.mtT += dt * (e.type === 'enemy' ? 3.2 : 2.6);
        e.px = G.lerp(e.x * T, e.fx * T, Math.min(1, e.mtT)); e.py = G.lerp(e.y * T, e.fy * T, Math.min(1, e.mtT));
        if (e.mtT >= 1) { e.x = e.fx; e.y = e.fy; e.moving = false; }
        continue;
      }
      if (!(e.wander || e.chase) || G.main.locked()) continue;
      e.mt -= dt; if (e.mt > 0) continue;
      e.mt = 0.8 + Math.random() * 2.2;
      let dir;
      const d = Math.abs(e.x - pl.x) + Math.abs(e.y - pl.y);
      if (e.type === 'enemy' && e.chase && d <= e.chase) { e.mt = 0.45; const dx = Math.sign(pl.x - e.x), dy = Math.sign(pl.y - e.y); dir = Math.abs(pl.x - e.x) > Math.abs(pl.y - e.y) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
      else dir = ['up', 'down', 'left', 'right'][(Math.random() * 4) | 0];
      const [dx, dy] = G.DIRS[dir], nx = e.x + dx, ny = e.y + dy;
      e.dir = dir;
      if (e.type === 'enemy' && nx === pl.x && ny === pl.y && !pl.moving) { G.main.encounter(e); return; }
      const R = e.wander || 3;
      if (Math.abs(nx - e.ox) > R || Math.abs(ny - e.oy) > R) continue;
      if (blocked(nx, ny, e) || (pl.moving && pl.fx === nx && pl.fy === ny) || tdef(M.grid[ny][nx]).noNpc) continue;
      e.moving = true; e.fx = nx; e.fy = ny; e.mtT = 0;
    }
  }
  function update(dt) {
    if (!M) return;
    clock += dt; frame = (clock * 6) | 0;
    updateEnts(dt);
    if (pl.moving) {
      const run = G.input.held('run') || G.input.held('b');
      pl.t += dt * (run ? 8.5 : 5.5);
      const t = Math.min(1, pl.t);
      pl.px = G.lerp(pl.x * T, pl.fx * T, t); pl.py = G.lerp(pl.y * T, pl.fy * T, t);
      pl.frame = [1, 0, 2, 0][((pl.step * 2 + (t > 0.5 ? 1 : 0)) % 4)];
      if (pl.t >= 1) { arrive(); if (!pl.moving && !G.main.locked()) { const d = G.input.dir(); if (d) tryMove(d); } }
    } else if (!G.main.locked()) {
      pl.frame = 0;
      const d = G.input.dir();
      if (d) tryMove(d);
    }
    // particles
    const kind = M.particles;
    if (kind && particles.length < 40 && Math.random() < dt * 14) particles.push(spawnP(kind));
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
  }
  function spawnP(kind) {
    const cx = pl.px + (Math.random() - 0.5) * 360, cy = pl.py + (Math.random() - 0.5) * 260;
    if (kind === 'drips') return { k: kind, x: cx, y: cy - 60, vx: 0, vy: 70, life: 1.2 };
    if (kind === 'fireflies') return { k: kind, x: cx, y: cy, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 3 + Math.random() * 3, ph: Math.random() * 6 };
    if (kind === 'fog') return { k: kind, x: cx, y: cy, vx: 6 + Math.random() * 6, vy: 0, life: 6, r: 20 + Math.random() * 30 };
    return { k: kind, x: cx, y: cy, vx: 8 + Math.random() * 10, vy: -3 - Math.random() * 4, life: 2 + Math.random() * 3 };
  }

  /* ---------------- rendering ---------------- */
  function cam(VW, VH) {
    let cx = pl.px + T / 2 - VW / 2, cy = pl.py + T / 2 - VH / 2;
    const mw = M.W * T, mh = M.H * T;
    cx = mw <= VW ? (mw - VW) / 2 : G.clamp(cx, 0, mw - VW);
    cy = mh <= VH ? (mh - VH) / 2 : G.clamp(cy, 0, mh - VH);
    if (shake) { cx += (Math.random() - 0.5) * shake; cy += (Math.random() - 0.5) * shake; }
    return [Math.round(cx), Math.round(cy)];
  }
  const isWater = (ch) => { const k = tdef(ch).kind; return k === 'water' || k === 'deep'; };
  let lightCv = null, lightX = null;
  function render(x, VW, VH) {
    if (!M) return;
    const [cx, cy] = cam(VW, VH);
    x.fillStyle = A.P.void; x.fillRect(0, 0, VW, VH);
    const x0 = Math.max(0, (cx / T) | 0), y0 = Math.max(0, (cy / T) | 0), x1 = Math.min(M.W, ((cx + VW) / T | 0) + 2), y1 = Math.min(M.H, ((cy + VH) / T | 0) + 2);
    for (let y = y0; y < y1; y++) for (let X = x0; X < x1; X++) {
      const ch = M.grid[y][X], d = tdef(ch), sx = X * T - cx, sy = y * T - cy;
      x.drawImage(A.tile(d.kind, X, y, frame, d.base), sx, sy);
      if (isWater(ch)) {
        let s = 0; const land = (a, b) => inb(a, b) && !isWater(M.grid[b][a]) && tdef(M.grid[b][a]).kind !== 'void';
        if (land(X, y - 1)) s |= 1; if (land(X, y + 1)) s |= 2; if (land(X - 1, y)) s |= 4; if (land(X + 1, y)) s |= 8;
        if (s) A.foam(x, sx, sy, s, frame);
      } else if (d.shadowBelow && inb(X, y + 1) && !tdef(M.grid[y + 1][X]).solid) { /* cliff drop shadow */ }
      if (inb(X, y - 1) && tdef(M.grid[y - 1][X]).castShadow && !d.solid) { x.fillStyle = 'rgba(10,10,30,0.22)'; x.fillRect(sx, sy, T, 3); }
    }
    // y-sorted entities + player
    const list = M.ents.filter((e) => visible(e) && e.type !== 'exit' && e.type !== 'trigger' && e.type !== 'light');
    list.push({ _pl: true, py: pl.py });
    list.sort((a, b) => a.py - b.py);
    const near = facing();
    for (const e of list) {
      if (e._pl) { if (!pl.hidden) drawPlayer(x, cx, cy); continue; }
      drawEnt(x, e, e.px - cx, e.py - cy);
      if (e === near && !G.main.locked() && e.type !== 'block' && !e.hidden) { const b = Math.sin(clock * 6) * 1.5; x.fillStyle = '#fff'; x.fillRect(e.px - cx + 7, e.py - cy - 7 + b, 3, 1); x.fillRect(e.px - cx + 8, e.py - cy - 6 + b, 1, 1); }
    }
    // particles
    for (const p of particles) {
      const sx = p.x - cx, sy = p.y - cy;
      if (p.k === 'fog') { const g = x.createRadialGradient(sx, sy, 0, sx, sy, p.r); g.addColorStop(0, 'rgba(220,230,240,0.10)'); g.addColorStop(1, 'rgba(220,230,240,0)'); x.fillStyle = g; x.fillRect(sx - p.r, sy - p.r, p.r * 2, p.r * 2); }
      else if (p.k === 'fireflies') { x.fillStyle = `rgba(220,255,140,${0.5 + 0.5 * Math.sin(clock * 4 + p.ph)})`; x.fillRect(sx, sy, 1, 1); }
      else if (p.k === 'drips') { x.fillStyle = 'rgba(143,214,208,0.6)'; x.fillRect(sx, sy, 1, 2); }
      else { x.fillStyle = 'rgba(240,248,255,0.55)'; x.fillRect(sx, sy, 1, 1); }
    }
    if (M.tint) { x.fillStyle = M.tint; x.fillRect(0, 0, VW, VH); }
    lighting(x, VW, VH, cx, cy);
  }
  function lighting(x, VW, VH, cx, cy) {
    const dark = M.dark; if (dark <= 0.02) return;
    if (!lightCv || lightCv.width !== VW || lightCv.height !== VH) { [lightCv, lightX] = A.mk(VW, VH); }
    const l = lightX; l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, VW, VH);
    l.fillStyle = `rgba(6,10,26,${dark})`; l.fillRect(0, 0, VW, VH);
    l.globalCompositeOperation = 'destination-out';
    const lights = [];
    const flick = 1 + Math.sin(clock * 9) * 0.03 + Math.sin(clock * 23) * 0.02;
    lights.push([pl.px + 8 - cx, pl.py + 6 - cy, (M.def.playerLight || 44) * flick, 'rgba(255,190,110,0.10)']);
    const x0 = Math.max(0, (cx / T | 0) - 4), y0 = Math.max(0, (cy / T | 0) - 4), x1 = Math.min(M.W, ((cx + VW) / T | 0) + 5), y1 = Math.min(M.H, ((cy + VH) / T | 0) + 5);
    for (let y = y0; y < y1; y++) for (let X = x0; X < x1; X++) { const d = tdef(M.grid[y][X]); if (d.light) lights.push([X * T + 8 - cx, y * T + 6 - cy, d.light * flick, d.lightColor || 'rgba(255,190,110,0.14)']); }
    for (const e of M.ents) if (visible(e) && (e.type === 'light' || e.light)) lights.push([e.px + 8 - cx, e.py + 8 - cy, (e.r || e.light || 40) * flick, e.color || 'rgba(127,240,224,0.12)']);
    for (const [lx, ly, r] of lights) { const g = l.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); l.fillStyle = g; l.fillRect(lx - r, ly - r, r * 2, r * 2); }
    x.drawImage(lightCv, 0, 0);
    x.globalCompositeOperation = 'lighter';
    for (const [lx, ly, r, c] of lights) { const g = x.createRadialGradient(lx, ly, 0, lx, ly, r * 0.8); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(lx - r, ly - r, r * 2, r * 2); }
    x.globalCompositeOperation = 'source-over';
  }
  function shadow(x, sx, sy, w = 10) { x.fillStyle = 'rgba(10,12,30,0.32)'; x.fillRect(sx + 8 - w / 2, sy + 14, w, 2); x.fillRect(sx + 8 - w / 2 + 1, sy + 13, w - 2, 1); x.fillRect(sx + 8 - w / 2 + 1, sy + 16, w - 2, 1); }
  function blit(x, img, sx, sy, flip, alpha = 1) {
    if (alpha < 1) x.globalAlpha = alpha;
    if (flip) { x.save(); x.translate(Math.round(sx) + img.width, Math.round(sy)); x.scale(-1, 1); x.drawImage(img, 0, 0); x.restore(); }
    else x.drawImage(img, Math.round(sx), Math.round(sy));
    x.globalAlpha = 1;
  }
  function drawPlayer(x, cx, cy) {
    const sx = pl.px - cx, sy = pl.py - cy - 2;
    shadow(x, sx, sy + 2);
    blit(x, A.human(G.data.looks.tamsin, pl.dir, pl.frame), sx, sy, pl.dir === 'right');
  }
  function drawEnt(x, e, sx, sy) {
    const P = A.P;
    if (e.type === 'npc') {
      const look = typeof e.look === 'string' ? G.data.looks[e.look] : e.look || {};
      const fr = e.moving ? [1, 2][(clock * 6 | 0) % 2] : 0;
      const bob = look.ghost ? Math.sin(clock * 2 + e.x) * 1.5 - 2 : 0;
      if (!look.ghost) shadow(x, sx, sy); else { x.fillStyle = 'rgba(127,200,255,0.18)'; x.fillRect(sx + 4, sy + 14, 8, 2); }
      blit(x, A.human(look, e.dir, fr), sx, sy - 2 + bob, e.dir === 'right', look.ghost ? 0.78 : 1);
      if (e.mark && [].concat(e.mark).some((c) => st.cond(c))) { const b = Math.sin(clock * 5) * 1.5; x.fillStyle = P.ink; x.fillRect(sx + 6, sy - 12 + b, 4, 8); x.fillStyle = P.lamp; x.fillRect(sx + 7, sy - 11 + b, 2, 4); x.fillRect(sx + 7, sy - 6 + b, 2, 1); }
    } else if (e.type === 'enemy') {
      const en = G.data.enemies[e.group[0]]; const spr = en.sprite;
      const img = A.monster(spr.kind, spr.pal, (clock * 3 | 0) % 2);
      x.fillStyle = 'rgba(10,12,30,0.35)'; x.fillRect(sx + 1, sy + 13, 14, 3);
      const flip = e.dir === 'right';
      x.save(); x.translate(Math.round(sx + 8), Math.round(sy + 16)); if (flip) x.scale(-1, 1); x.drawImage(img, -10, -19, 20, 20); x.restore();
    } else if (e.type === 'chest') {
      const open = st.S.flags['chest:' + M.id + ':' + e.id];
      if (e.style === 'glint') { const a = (clock * 2 + e.x) % 3; if (a < 1) { x.fillStyle = '#fff'; x.fillRect(sx + 7, sy + 4, 1, 7); x.fillRect(sx + 4, sy + 7, 7, 1); x.fillStyle = P.glow; x.fillRect(sx + 6, sy + 6, 3, 3); } else { x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(sx + 7, sy + 7, 2, 2); } }
      else if (e.style === 'trap') { shadow(x, sx, sy); x.fillStyle = P.w1; x.fillRect(sx + 2, sy + 6, 12, 8); x.fillStyle = '#c9b9a0'; for (let i = 3; i < 14; i += 3) x.fillRect(sx + i, sy + 6, 1, 8); x.fillRect(sx + 2, sy + 9, 12, 1); x.fillStyle = P.ink; x.fillRect(sx + 2, sy + 14, 12, 1); }
      else { shadow(x, sx, sy, 14); x.fillStyle = P.ink; x.fillRect(sx + 1, sy + 4, 14, 11); x.fillStyle = open ? P.w1 : P.w2; x.fillRect(sx + 2, sy + (open ? 7 : 5), 12, open ? 7 : 9); x.fillStyle = open ? '#1a1010' : P.w3; x.fillRect(sx + 2, sy + 5, 12, open ? 2 : 3); x.fillStyle = P.lamp; x.fillRect(sx + 7, sy + 8, 2, 2); }
    } else if (e.type === 'sign' && !e.hidden) {
      shadow(x, sx, sy, 8); x.fillStyle = P.ink; x.fillRect(sx + 2, sy + 2, 12, 8); x.fillRect(sx + 7, sy + 9, 2, 6);
      x.fillStyle = P.w3; x.fillRect(sx + 3, sy + 3, 10, 6); x.fillStyle = P.w1; x.fillRect(sx + 4, sy + 5, 8, 1); x.fillRect(sx + 4, sy + 7, 6, 1); x.fillStyle = P.w2; x.fillRect(sx + 7, sy + 10, 2, 5);
    } else if (e.type === 'shrine') {
      shadow(x, sx, sy, 14); x.fillStyle = P.ink; x.fillRect(sx + 1, sy + 5, 14, 10); x.fillStyle = P.st2; x.fillRect(sx + 2, sy + 6, 12, 8); x.fillStyle = P.st3; x.fillRect(sx + 2, sy + 6, 12, 2);
      const a = 0.6 + 0.4 * Math.sin(clock * 3); x.fillStyle = `rgba(127,240,224,${a})`; x.fillRect(sx + 4, sy + 6, 8, 2); x.fillStyle = P.sea3; x.fillRect(sx + 5, sy + 2 + Math.sin(clock * 2) * 1, 6, 1);
    } else if (e.type === 'block') {
      if (e.sprite === 'gate') { x.fillStyle = P.ink; x.fillRect(sx, sy + 3, 16, 10); x.fillStyle = '#c94f4f'; x.fillRect(sx, sy + 5, 16, 3); x.fillStyle = P.cream; for (let i = 2; i < 16; i += 6) x.fillRect(sx + i, sy + 5, 3, 3); x.fillStyle = P.w1; x.fillRect(sx + 1, sy + 4, 2, 9); x.fillRect(sx + 13, sy + 4, 2, 9); }
      else if (e.sprite === 'kelpwall') { x.drawImage(A.tile('kelp', e.x, e.y, 0), sx, sy); x.fillStyle = 'rgba(40,70,40,0.9)'; for (let i = 0; i < 16; i += 2) x.fillRect(sx + i, sy + (i % 4), 1, 16 - (i % 4)); }
      else { x.drawImage(A.tile('rubble', e.x, e.y, 0), sx, sy); x.fillStyle = P.r2; x.fillRect(sx + 2, sy + 4, 6, 6); x.fillRect(sx + 8, sy + 7, 6, 7); x.fillStyle = P.r3; x.fillRect(sx + 3, sy + 4, 4, 2); x.fillRect(sx + 9, sy + 7, 4, 2); }
    } else if (e.type === 'prop') {
      if (e.sprite === 'bell') { x.fillStyle = P.ink; x.fillRect(sx + 2, sy - 2, 12, 16); x.fillStyle = '#b8862f'; x.fillRect(sx + 3, sy + 1, 10, 12); x.fillRect(sx + 5, sy - 1, 6, 2); x.fillStyle = '#d9a64a'; x.fillRect(sx + 4, sy + 2, 3, 9); x.fillStyle = '#3a7a6a'; x.fillRect(sx + 3, sy + 9, 10, 2); }
      else if (e.sprite === 'helm') { blit(x, A.human(G.data.looks.diver, 'down', 0), sx, sy - 2, false, 0.9); }
      else if (e.sprite === 'boat') { x.fillStyle = P.ink; x.fillRect(sx - 8, sy + 5, 32, 9); x.fillStyle = P.w2; x.fillRect(sx - 7, sy + 6, 30, 6); x.fillStyle = P.w3; x.fillRect(sx - 7, sy + 6, 30, 2); x.fillStyle = P.w0; x.fillRect(sx - 4, sy + 12, 24, 1); }
      else if (e.sprite === 'fire') { const f = (clock * 8 | 0) % 3; x.fillStyle = P.r1; x.fillRect(sx + 3, sy + 12, 10, 3); x.fillStyle = P.ember; x.fillRect(sx + 5, sy + 6 + f, 6, 7 - f); x.fillStyle = P.lamp; x.fillRect(sx + 6, sy + 8 + f, 4, 5 - f); x.fillStyle = '#fff0c0'; x.fillRect(sx + 7, sy + 10, 2, 2); }
    }
  }
  return {
    enter, refresh, update, render, interact, facing,
    get map() { return M; }, get player() { return pl; },
    shake(n = 6) { shake = n; },
    findEnt: (id) => M && M.ents.find((e) => e.id === id),
    visible: (e) => visible(e),
    tdef,
  };
})();

/* ---- 60-script.js ---- */
/* Dialogue + action interpreter. Dialogs are data (chapter JSON -> dialogs).
   Node forms:
     "text"                               narration
     {"s":"ama","t":"Hello"}              line spoken by a cast member (looks.<s>); "me" = the player
     {"c":[{"t":"Option","go":"id"|[...],"if":"cond"}], "q":"prompt?"}   choice
     {"if":"cond","then":"id"|[...],"else":"id"|[...]}
     {"do":[["flag","x"],["give","kelpcake",2],...]}
     {"go":"id"}   {"end":1}                                                   */
G.script = (() => {
  const st = G.state;
  class Stop extends Error {}
  async function run(ref, ctx = {}) {
    if (ref == null) return;
    const nodes = typeof ref === 'string' ? G.data.dialogs[ref] : ref;
    if (!nodes) { console.warn('missing dialog', ref); return; }
    for (const n of nodes) {
      if (typeof n === 'string') { await G.ui.say(null, n, null); continue; }
      if (n.t != null && n.c == null) {
        let look = null, name = null;
        if (n.s === 'me') { look = G.data.looks.tamsin; name = st.S.name; }
        else if (n.s) { look = G.data.looks[n.s] || null; name = (look && look.name) || n.s; }
        if (n.if && !st.cond(n.if)) continue;
        await G.ui.say(name, n.t, look && !look.noFace ? look : null);
        continue;
      }
      if (n.c) {
        const opts = n.c.filter((o) => !o.if || st.cond(o.if));
        if (n.q) { const sp = n.qs === 'me' ? G.data.looks.tamsin : G.data.looks[n.qs]; await G.ui.say(sp ? (n.qs === 'me' ? st.S.name : sp.name) : null, n.q, sp || null, { noWait: true }); }
        const i = await G.ui.choose(opts.map((o) => ({ label: G.esc(st.text(o.t)) })), { cancel: false, cls: 'dchoice' });
        G.ui.hideDlg();
        const o = opts[i];
        if (o.do) await actions(o.do, ctx);
        if (o.go) { await run(o.go, ctx); }
        continue;
      }
      if (n.if != null && (n.then || n.else)) { const b = st.cond(n.if) ? n.then : n.else; if (b) await run(b, ctx); continue; }
      if (n.do) { await actions(n.do, ctx); continue; }
      if (n.go) { await run(n.go, ctx); return; }
      if (n.end) throw new Stop();
    }
  }
  async function actions(list, ctx) {
    for (const a of list) {
      const [op, ...args] = a;
      const f = OPS[op]; if (!f) { console.warn('unknown action', op); continue; }
      const r = await f(...args, ctx);
      if (r === 'stop') throw new Stop();
    }
    G.ui.updateHud();
  }
  const item = (id) => G.data.items[id] || { name: id };
  const OPS = {
    flag: (f) => st.flag(f), unflag: (f) => st.flag(f, false),
    give: async (id, n = 1) => { st.give(id, n); G.audio.sfx('chest'); G.ui.toast(`Got <b>${G.esc(item(id).name)}</b>${n > 1 ? ' ×' + n : ''}`); },
    take: (id, n = 1) => st.take(id, n),
    shells: (n) => { st.S.shells = Math.max(0, st.S.shells + n); if (n > 0) G.ui.toast(`+${n} shells`); },
    quest: (id) => { if (st.startQuest(id)) { G.audio.sfx('select'); G.ui.toast(`New quest: <b>${G.esc(G.data.quests[id].title)}</b>`, 3200); } },
    heal: () => { st.heal(); G.audio.sfx('heal'); },
    battle: async (group, opts = {}, ctx) => { const r = await G.main.fight(group, opts); if (r === 'lose') return 'stop'; if (r === 'flee' && opts.mustWin) return 'stop'; },
    warp: async (map, x, y, dir) => { await G.main.travel(map, x, y, dir, true); },
    sfx: (n) => G.audio.sfx(n), music: (n) => G.audio.play(n),
    shake: (n = 6) => { G.world.shake(n); }, wait: (ms) => G.wait(ms), flash: (c, ms) => G.ui.flash(c, ms),
    fade: (on, ms) => G.ui.fade(!!on, ms),
    card: (small, title, sub, ms) => G.ui.card(small, title, sub, ms),
    toast: (t) => G.ui.toast(G.esc(st.text(t))),
    learn: (sk) => { if (!st.S.skills.includes(sk)) { st.S.skills.push(sk); G.audio.sfx('level'); G.ui.toast(`Learned <b>${G.esc(G.data.skills[sk].name)}</b>`, 3200); } },
    equip: (id) => st.equip(id),
    save: () => { st.save(); G.ui.toast('Game saved'); },
    respawn: (map, x, y) => { st.S.respawn = { map, x, y }; },
    chapterEnd: async (id) => G.main.chapterEnd(id),
    shop: async (list) => G.main.shop(list),
    face: (id, dir) => { const e = id === 'me' ? null : G.world.findEnt(id); if (e) e.dir = dir; else if (id === 'me') { G.world.player.dir = dir; st.S.dir = dir; } },
    walk: async (id, dir, steps = 1) => {
      const e = id === 'me' ? null : G.world.findEnt(id); const [dx, dy] = G.DIRS[dir];
      for (let i = 0; i < steps; i++) {
        if (e) { e.dir = dir; e.fx = e.x + dx; e.fy = e.y + dy; e.mtT = 0; e.moving = true; await G.wait(400); e.x = e.fx; e.y = e.fy; e.px = e.x * 16; e.py = e.y * 16; e.moving = false; }
        else { const p = G.world.player; p.dir = dir; p.fx = p.x + dx; p.fy = p.y + dy; p.t = 0; p.moving = true; await G.wait(200); }
      }
    },
    refresh: () => G.world.refresh(),
  };
  return { run: async (ref, ctx) => { try { await run(ref, ctx); } catch (e) { if (!(e instanceof Stop)) throw e; } finally { G.ui.hideDlg(); } }, actions, OPS };
})();

/* ---- 70-battle.js ---- */
/* Turn-based combat with the Tide: every round the tide turns
   (Low -> Rising -> High -> Ebbing). Water arts hit hardest at High tide,
   blades find gaps at Low tide, and some foes change behaviour with it. */
G.battle = (() => {
  const st = G.state, A = G.art;
  const TIDES = [{ n: 'Low tide', w: 0.7, crit: 0.17, icon: '▁' }, { n: 'Rising tide', w: 1, crit: 0.05, icon: '▃' }, { n: 'High tide', w: 1.5, crit: 0, icon: '▇' }, { n: 'Ebbing tide', w: 1, crit: 0.08, icon: '▅' }];
  let B = null, panel = null, msgEl = null, nums = [];
  const active = () => !!B;
  const alive = () => B.foes.filter((f) => f.hp > 0);

  function waitKey(ms) {
    return new Promise((res) => { let done = false; const f = (k) => { if (k === 'a' && !done) { done = true; G.input.off(f); res(); } }; G.input.on(f); setTimeout(() => { if (!done) { done = true; G.input.off(f); res(); } }, ms); });
  }
  async function msg(t, ms = 950) { msgEl.innerHTML = t; msgEl.classList.add('on'); await waitKey(ms); }
  function hud() {
    const S = st.S, s = st.stats(), td = TIDES[B.tide];
    const pct = (v, m) => (100 * G.clamp(v / m, 0, 1)).toFixed(1) + '%';
    panel.querySelector('.bstat').innerHTML = `<div class="bs-name"><b>${G.esc(S.name)}</b> <span>Lv ${S.lvl}</span>${B.guard ? ' <em>Guarding</em>' : ''}</div>
      <div class="bar hp"><i style="width:${pct(S.hp, s.hp)}"></i><span>HP</span><em>${S.hp}/${s.hp}</em></div>
      <div class="bar sp"><i style="width:${pct(S.sp, s.sp)}"></i><span>BR</span><em>${S.sp}/${s.sp}</em></div>
      <div class="tide t${B.tide}" title="Water arts ×${td.w}"><span class="tw">${TIDES.map((t, i) => `<i class="${i === B.tide ? 'on' : ''}"></i>`).join('')}</span>${td.n}</div>`;
    G.ui.updateHud();
  }
  function popNum(f, text, cls) {
    const v = G.main.view; const [lx, ly] = f === 'me' ? [B.me.x, B.me.y - 30] : [f.x, f.y - 36 * f.scale / 2];
    const e = G.ui.el('div', 'bnum ' + (cls || ''), text);
    e.style.left = (v.ox + lx * v.css) + 'px'; e.style.top = (v.oy + ly * v.css) + 'px';
    G.ui.root().append(e); setTimeout(() => e.remove(), 1100);
  }
  function layout(VW, VH) {
    const gy = Math.round(VH * (VW < 260 ? 0.5 : 0.58));
    B.me.x = Math.round(VW * (VW < 260 ? 0.17 : 0.22)); B.me.y = gy + 4;
    const fs = B.foes, n = fs.length, x0 = VW * (VW < 260 ? 0.42 : 0.52), x1 = VW * 0.9;
    fs.forEach((f, i) => { f.x = Math.round(n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1)); f.y = gy + (VW < 260 && n > 1 ? (i % 2 ? 14 : -6) : (i % 2 ? 6 : 0)); });
    B.gy = gy;
  }
  function render(x, VW, VH) {
    if (!B) return;
    if (B.VW !== VW || B.VH !== VH) { B.VW = VW; B.VH = VH; layout(VW, VH); }
    const t = performance.now() / 1000, bg = B.bg, gy = B.gy;
    const sky = x.createLinearGradient(0, 0, 0, gy);
    const pal = { flats: ['#2a4a6e', '#9fc4c8'], shore: ['#3a3a6e', '#e8a878'], cave: ['#0b0a14', '#2a2632'], wood: ['#1e3326', '#5a7a5a'], bell: ['#101a30', '#3a5a7a'] }[bg] || ['#2a4a6e', '#9fc4c8'];
    sky.addColorStop(0, pal[0]); sky.addColorStop(1, pal[1]); x.fillStyle = sky; x.fillRect(0, 0, VW, gy);
    // sea band rises and falls with the tide
    const tideH = [4, 9, 15, 9][B.tide]; const sy = gy - 18 - tideH;
    if (bg !== 'cave') {
      x.fillStyle = '#17405e'; x.fillRect(0, sy, VW, gy - sy);
      x.fillStyle = '#47a0b0'; for (let i = 0; i < VW; i += 12) x.fillRect((i + t * 10) % (VW + 12) - 12, sy + 2 + ((i / 12) % 3) * 4, 6, 1);
      x.fillStyle = 'rgba(200,240,232,0.8)'; for (let i = 0; i < VW; i += 6) x.fillRect(i, gy - 1 + Math.round(Math.sin(i * 0.3 + t * 3)), 4, 1);
    } else { x.fillStyle = '#1e1b26'; for (let i = 0; i < VW; i += 14) x.fillRect(i, 0, 8, 10 + ((i * 7) % 22)); }
    const gr = x.createLinearGradient(0, gy, 0, VH);
    const gp = { flats: ['#a08c66', '#6e5f46'], shore: ['#e3c993', '#a88a5a'], cave: ['#3d3848', '#1e1b26'], wood: ['#3e5a3a', '#1e2e1e'], bell: ['#5a5f6c', '#2a2e3a'] }[bg] || ['#a08c66', '#6e5f46'];
    gr.addColorStop(0, gp[0]); gr.addColorStop(1, gp[1]); x.fillStyle = gr; x.fillRect(0, gy, VW, VH - gy);
    x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 1; i < 6; i++) x.fillRect(0, gy + i * i * 3, VW, 1);
    // player
    const me = B.me, lunge = me.lunge > 0 ? Math.sin(me.lunge * Math.PI) * 14 : 0;
    const img = A.human(G.data.looks.tamsin, 'right', me.lunge > 0 ? 1 : 0);
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(me.x - 10 + lunge, me.y - 2, 20, 4);
    x.save(); x.translate(me.x + lunge + 16, me.y - 32 + (me.hit > 0 ? (Math.random() - 0.5) * 4 : 0)); x.scale(-2, 2); x.drawImage(img, 0, 0); x.restore();
    if (me.hit > 0 && ((t * 20) | 0) % 2) { x.fillStyle = 'rgba(255,80,80,0.35)'; x.fillRect(me.x - 16, me.y - 32, 32, 32); }
    if (B.guard) { x.strokeStyle = 'rgba(143,214,208,0.8)'; x.beginPath(); x.arc(me.x + 2, me.y - 16, 20 + Math.sin(t * 6), -1.2, 1.2); x.stroke(); }
    // foes
    for (const f of B.foes) {
      if (f.hp <= 0 && f.die <= 0) continue;
      const s = f.scale, img = A.monster(f.def.sprite.kind, f.def.sprite.pal, ((t * 3) | 0) % 2), w = 24 * s;
      const ox = (f.shake > 0 ? (Math.random() - 0.5) * 6 : 0) - (f.lunge > 0 ? Math.sin(f.lunge * Math.PI) * 16 : 0);
      const bob = f.def.float ? Math.sin(t * 2 + f.x) * 3 - 8 : 0;
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(f.x - w * 0.35, f.y - 2, w * 0.7, 4);
      if (f.hp <= 0) x.globalAlpha = Math.max(0, f.die);
      x.drawImage(img, Math.round(f.x - w / 2 + ox), Math.round(f.y - w + 2 + bob), w, w);
      if (f.flash > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = f.flash; x.drawImage(img, Math.round(f.x - w / 2 + ox), Math.round(f.y - w + 2 + bob), w, w); x.globalCompositeOperation = 'source-over'; }
      x.globalAlpha = 1;
      if (f.charging) { x.fillStyle = `rgba(255,123,84,${0.5 + 0.5 * Math.sin(t * 10)})`; x.fillRect(f.x - 2, f.y - w - 8 + bob, 4, 5); x.fillRect(f.x - 2, f.y - w - 2 + bob, 4, 2); }
      if (f.hp > 0) { const bw = Math.max(20, w * 0.6); x.fillStyle = '#1a1426'; x.fillRect(f.x - bw / 2 - 1, f.y + 4, bw + 2, 4); x.fillStyle = '#5a2030'; x.fillRect(f.x - bw / 2, f.y + 5, bw, 2); x.fillStyle = f.hp / f.max < 0.3 ? '#ff7b54' : '#7ef9a0'; x.fillRect(f.x - bw / 2, f.y + 5, Math.round((bw * f.hp) / f.max), 2); }
      if (f === B.target) { x.fillStyle = '#fff'; const yy = f.y - w - 6 + bob + Math.sin(t * 8) * 2; x.fillRect(f.x - 3, yy, 7, 1); x.fillRect(f.x - 2, yy + 1, 5, 1); x.fillRect(f.x - 1, yy + 2, 3, 1); x.fillRect(f.x, yy + 3, 1, 1); }
    }
    // fx
    for (const p of B.fx) {
      const k = 1 - p.t / p.life;
      if (p.k === 'slash') { x.strokeStyle = `rgba(255,255,255,${k})`; x.lineWidth = 2; x.beginPath(); x.moveTo(p.x - 12, p.y - 14 + p.t * 40); x.lineTo(p.x + 12, p.y + 10 + p.t * 40); x.stroke(); x.lineWidth = 1; }
      else { x.fillStyle = p.c; x.globalAlpha = k; x.fillRect(p.x + p.vx * p.t, p.y + p.vy * p.t + 60 * p.t * p.t, p.s, p.s); x.globalAlpha = 1; }
    }
  }
  function update(dt) {
    if (!B) return;
    const dec = (o, k, r = 1) => { if (o[k] > 0) o[k] = Math.max(0, o[k] - dt * r); };
    dec(B.me, 'lunge', 3); dec(B.me, 'hit', 2.5);
    for (const f of B.foes) { dec(f, 'flash', 4); dec(f, 'shake', 3); dec(f, 'lunge', 3); if (f.hp <= 0) dec(f, 'die', 1.6); }
    for (const p of B.fx) p.t += dt; B.fx = B.fx.filter((p) => p.t < p.life);
  }
  function burst(x, y, c, n = 14, spread = 60) { for (let i = 0; i < n; i++) B.fx.push({ k: 'p', x, y, vx: (Math.random() - 0.5) * spread * 2, vy: -Math.random() * spread, t: 0, life: 0.6 + Math.random() * 0.4, c: c[(Math.random() * c.length) | 0], s: Math.random() < 0.3 ? 2 : 1 }); }
  const roll = (base) => base * (0.9 + Math.random() * 0.2);
  function calc(att, power, def, type, extra = 1) {
    const tm = type === 'water' ? TIDES[B.tide].w : 1;
    return Math.max(1, Math.round(roll(att * power) * tm * extra - def * 0.5));
  }
  async function hitFoe(f, power, type, opts = {}) {
    const s = st.stats(); let crit = false, mul = 1;
    if (type === 'phys' && Math.random() < 0.08 + TIDES[B.tide].crit) { crit = true; mul = 1.6; }
    if (f.def.weak === type) mul *= 1.5; if (f.def.resist === type) mul *= 0.6;
    const def = f.defv + (f.harden ? f.def.harden || 4 : 0);
    const dmg = calc(s.atk, power, type === 'water' ? def * 0.5 : def, type, mul);
    f.hp = Math.max(0, f.hp - dmg); f.flash = 1; f.shake = 1;
    if (type === 'water') { burst(f.x, f.y - 20, ['#47a0b0', '#8fd6d0', '#ffffff'], 22, 70); G.audio.sfx('splash'); }
    else { B.fx.push({ k: 'slash', x: f.x, y: f.y - 22, t: 0, life: 0.25 }); G.audio.sfx(crit ? 'crit' : 'hit'); }
    if (crit) G.world.shake(5);
    popNum(f, (crit ? 'CRIT ' : '') + dmg, crit ? 'crit' : type === 'water' ? 'water' : '');
    if (f.hp <= 0) { f.die = 1; burst(f.x, f.y - 18, ['#f2e6c9', '#f5b85a', '#ffffff'], 18, 50); }
    await G.wait(380);
    if (crit) await msg('A critical hit!', 600);
    if (f.def.weak === type && !opts.quiet) await msg(`${G.esc(f.name)} reels. It's weak to that!`, 700);
    if (f.hp <= 0) await msg(`${G.esc(f.name)} is defeated.`, 650);
  }
  async function hurtMe(dmg, from) {
    const S = st.S; if (B.guard) dmg = Math.max(1, Math.round(dmg * 0.45));
    S.hp = Math.max(0, S.hp - dmg); B.me.hit = 1; G.audio.sfx('hurt'); G.world.shake(4); popNum('me', dmg, 'hurt'); hud(); await G.wait(420);
  }
  async function useSkill(sk) {
    const S = st.S, s = st.stats(), def = G.data.skills[sk];
    if (def.cost) S.sp -= def.cost;
    if (def.kind === 'heal') {
      const n = Math.round(s.hp * def.heal); S.hp = Math.min(s.hp, S.hp + n); G.audio.sfx('heal'); burst(B.me.x, B.me.y - 16, ['#7ef9a0', '#ffffff'], 16, 30); popNum('me', '+' + n, 'heal'); hud();
      await msg(`${G.esc(S.name)} uses ${G.esc(def.name)}. Recovered ${n} HP.`, 900); return;
    }
    await msg(`${G.esc(S.name)} uses ${G.esc(def.name)}!`, 600);
    B.me.lunge = 1; await G.wait(150);
    const targets = def.target === 'all' ? alive() : [B.target];
    for (const f of targets) await hitFoe(f, def.power, def.type || 'phys', { quiet: targets.length > 1 });
    if (def.type === 'water' && B.tide === 2) await msg('The high tide surges behind it!', 600);
  }
  async function pickTarget() {
    const fs = alive(); if (fs.length === 1) { B.target = fs[0]; return true; }
    const i = await G.ui.choose(fs.map((f) => ({ label: G.esc(f.name), sub: `${f.hp}/${f.max}` })), { title: 'Target', parent: panel, cls: 'bmenu', onMove: (j) => (B.target = fs[j]) });
    if (i < 0) { B.target = null; return false; }
    B.target = fs[i]; return true;
  }
  async function playerTurn() {
    const S = st.S;
    for (;;) {
      hud(); B.target = null; msgEl.classList.remove('on');
      const cmds = [{ label: '⚔ Attack' }, { label: '≈ Arts' }, { label: '✚ Items' }, { label: '⛨ Guard' }, { label: '↩ Flee', disabled: !!B.opts.noFlee }];
      const c = await G.ui.choose(cmds, { parent: panel, cls: 'bmenu cmd', cols: 2, cancel: false, start: B.lastCmd || 0 });
      B.lastCmd = c;
      if (c === 0) { if (!(await pickTarget())) continue; B.me.lunge = 1; await G.wait(160); await hitFoe(B.target, 1, 'phys'); return; }
      if (c === 1) {
        const sks = S.skills.filter((k) => G.data.skills[k] && G.data.skills[k].kind !== 'basic');
        if (!sks.length) { await msg('No arts learned yet.', 700); continue; }
        const i = await G.ui.choose(sks.map((k) => { const d = G.data.skills[k]; return { label: G.esc(d.name), sub: d.cost ? d.cost + ' BR' : '', disabled: S.sp < (d.cost || 0), detail: G.esc(d.desc) }; }), { title: 'Arts', parent: panel, cls: 'bmenu', detail: true });
        if (i < 0) continue; const d = G.data.skills[sks[i]];
        if (d.kind !== 'heal' && d.target !== 'all' && !(await pickTarget())) continue;
        await useSkill(sks[i]); return;
      }
      if (c === 2) {
        const its = Object.keys(S.inv).filter((k) => G.data.items[k] && G.data.items[k].type === 'consumable');
        if (!its.length) { await msg('Your satchel has nothing useful.', 700); continue; }
        const i = await G.ui.choose(its.map((k) => ({ label: G.esc(G.data.items[k].name), sub: '×' + S.inv[k], detail: G.esc(G.data.items[k].desc) })), { title: 'Items', parent: panel, cls: 'bmenu', detail: true });
        if (i < 0) continue; await useItem(its[i]); return;
      }
      if (c === 3) { B.guard = true; G.audio.sfx('guard'); hud(); await msg(`${G.esc(S.name)} braces against the swell.`, 650); return; }
      if (c === 4) {
        const es = alive().reduce((a, f) => a + f.spd, 0) / alive().length, chance = G.clamp(0.55 + (st.stats().spd - es) * 0.08, 0.2, 0.95);
        if (Math.random() < chance) { G.audio.sfx('flee'); await msg('You slip away along the tideline.', 800); B.result = 'flee'; return; }
        await msg("Can't get away!", 700); return;
      }
    }
  }
  async function useItem(id) {
    const S = st.S, s = st.stats(), it = G.data.items[id]; st.take(id);
    let t = `${G.esc(S.name)} uses ${G.esc(it.name)}.`;
    if (it.heal) { const n = Math.min(s.hp - S.hp, it.heal); S.hp += n; popNum('me', '+' + n, 'heal'); t += ` +${n} HP.`; }
    if (it.sp) { const n = Math.min(s.sp - S.sp, it.sp); S.sp += n; t += ` +${n} BR.`; }
    G.audio.sfx('heal'); burst(B.me.x, B.me.y - 16, ['#7ef9a0', '#ffffff'], 12, 30); hud(); await msg(t, 900);
  }
  async function foeTurn(f) {
    if (f.hp <= 0 || st.S.hp <= 0) return;
    const S = st.S, s = st.stats(), td = B.tide;
    if (f.def.harden) f.harden = td === 2;
    let mv;
    if (f.charging) { mv = f.charging; f.charging = null; }
    else {
      const opts = (f.def.moves || [{ name: 'Attack', power: 1 }]).filter((m) => (!m.tide || m.tide === TIDES[td].n.split(' ')[0].toLowerCase()) && (!m.hurt || f.hp < f.max * 0.5) && (!m.heal || f.hp < f.max * 0.7));
      let tot = opts.reduce((a, m) => a + (m.w || 1), 0), r = Math.random() * tot; mv = opts[0];
      for (const m of opts) { r -= m.w || 1; if (r <= 0) { mv = m; break; } }
      if (mv.charge) { f.charging = { ...mv, charge: false }; await msg(G.esc(mv.tell || `${f.name} is gathering strength...`), 1000); return; }
    }
    if (mv.heal) { const n = Math.round(f.max * mv.heal); f.hp = Math.min(f.max, f.hp + n); burst(f.x, f.y - 20, ['#7ef9a0'], 10, 30); popNum(f, '+' + n, 'heal'); await msg(`${G.esc(f.name)} ${G.esc(mv.msg || 'recovers')}.`, 800); return; }
    if (mv.buff) { f.defv += mv.buff; await msg(`${G.esc(f.name)} ${G.esc(mv.msg || 'hardens its shell')}.`, 800); return; }
    await msg(`${G.esc(f.name)} ${G.esc(mv.msg || 'attacks')}!`, 550);
    f.lunge = 1; await G.wait(180);
    const hits = mv.hits || 1;
    for (let i = 0; i < hits && S.hp > 0; i++) await hurtMe(calc(f.atk, mv.power || 1, s.def, mv.type || 'phys'));
    if (mv.drain) { f.sapped = true; const n = Math.min(S.sp, mv.drain); S.sp -= n; hud(); if (n) await msg(`It steals ${n} breath.`, 650); }
  }
  async function start(group, opts = {}) {
    const S = st.S;
    const counts = {};
    const foes = group.map((id) => { const d = G.data.enemies[id]; counts[id] = (counts[id] || 0) + 1; return { id, def: d, name: d.name, hp: d.hp, max: d.hp, atk: d.atk, defv: d.def, spd: d.spd || 4, scale: d.scale || 2, flash: 0, shake: 0, lunge: 0, die: 0 }; });
    const seen = {}; for (const f of foes) if (counts[f.id] > 1) { seen[f.id] = (seen[f.id] || 0) + 1; f.name += ' ' + 'ABCD'[seen[f.id] - 1]; }
    B = { foes, opts, tide: opts.tide != null ? opts.tide : (Math.random() * 4) | 0, me: { x: 0, y: 0, lunge: 0, hit: 0 }, fx: [], guard: false, bg: opts.bg || (G.world.map && G.world.map.def.battle) || 'flats', result: null };
    panel = G.ui.el('div', 'bpanel', '<div class="bstat"></div>'); msgEl = G.ui.el('div', 'bmsg');
    G.ui.root().append(panel, msgEl);
    G.audio.play(opts.music || (opts.boss ? 'boss' : 'battle'));
    hud();
    const names = [...new Set(foes.map((f) => f.def.name))];
    await msg(opts.intro ? G.esc(opts.intro) : `${names.map((n) => G.esc(n)).join(' and ')} ${foes.length > 1 ? 'block your path' : 'appears'}!`, 1100);
    await msg(`${TIDES[B.tide].icon} ${TIDES[B.tide].n}.`, 600);
    let round = 0;
    while (!B.result) {
      B.guard = false;
      await playerTurn();
      if (B.result) break;
      if (!alive().length) { B.result = 'win'; break; }
      for (const f of alive()) { await foeTurn(f); if (S.hp <= 0) break; }
      if (S.hp <= 0) { B.result = 'lose'; break; }
      round++; B.tide = (B.tide + 1) % 4; hud();
      await msg(`${TIDES[B.tide].icon} The tide turns: ${TIDES[B.tide].n.toLowerCase()}.`, 550);
    }
    let res = B.result;
    if (res === 'win') {
      G.audio.play(null); G.audio.sfx('win');
      const xp = foes.reduce((a, f) => a + (f.def.xp || 0), 0), sh = foes.reduce((a, f) => a + (f.def.shells || 0), 0);
      S.shells += sh;
      await msg(`Victory! ${xp} XP and ${sh} shells.`, 1400);
      for (const f of foes) for (const d of f.def.drops || []) if (Math.random() < d.chance) { st.give(d.item, 1); await msg(`${G.esc(f.def.name)} dropped ${G.esc(G.data.items[d.item].name)}.`, 1000); }
      for (const u of st.gainXp(xp)) {
        G.audio.sfx('level'); hud(); await msg(`<b>Level ${u.lvl}!</b> You feel the sea in your bones.`, 1400);
        for (const k of u.learned) await msg(`Learned <b>${G.esc(G.data.skills[k].name)}</b>: ${G.esc(G.data.skills[k].desc)}`, 1800);
      }
    } else if (res === 'lose') {
      G.audio.play(null); await msg(`${G.esc(S.name)} is swept off her feet...`, 1400);
    }
    panel.remove(); msgEl.remove(); document.querySelectorAll('.bnum').forEach((e) => e.remove());
    B = null; G.ui.updateHud();
    return res;
  }
  return { start, render, update, active, TIDES };
})();

/* ---- 80-ui.js ---- */
/* DOM UI: dialogue, choice lists, pages, HUD, toasts, title cards, fades, touch pad. */
G.ui = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  let root, dlg, hud, toastBox, cardEl, fadeEl, touch, modalDepth = 0;
  const textSpeed = () => +(localStorage.getItem('ebbmarrow.textspeed') || 2);

  function init() {
    root = $('#ui');
    hud = el('div', 'hud hidden', `<div class="hud-card"><div class="hud-top"><b class="hud-name">Tamsin</b><span class="hud-lv">Lv 1</span><span class="hud-sh" title="Shells">◈ 0</span></div>
      <div class="bar hp"><i></i><span>HP</span><em></em></div><div class="bar sp"><i></i><span>BR</span><em></em></div></div><div class="hud-obj"></div>`);
    const mb = el('button', 'menu-btn hidden', '<span></span><span></span><span></span>'); mb.setAttribute('aria-label', 'Menu'); mb.onclick = () => G.input.press('menu') || setTimeout(() => G.input.release('menu'), 50);
    dlg = el('div', 'dlg hidden', '<canvas class="dlg-face" width="48" height="48"></canvas><div class="dlg-body"><div class="dlg-name"></div><div class="dlg-text"></div></div><div class="dlg-next">▼</div>');
    toastBox = el('div', 'toasts');
    cardEl = el('div', 'card hidden', '<div class="card-in"><small></small><h2></h2><p></p></div>');
    fadeEl = el('div', 'fade');
    touch = el('div', 'touch hidden', `<div class="dpad"><button data-k="up" aria-label="Up">▲</button><button data-k="left" aria-label="Left">◀</button><button data-k="right" aria-label="Right">▶</button><button data-k="down" aria-label="Down">▼</button></div>
      <div class="abtns"><button data-k="b" class="bb" aria-label="Run / Back">B</button><button data-k="a" class="ab" aria-label="Talk / OK">A</button></div>`);
    root.append(hud, mb, touch, dlg, toastBox, cardEl, fadeEl);
    for (const b of touch.querySelectorAll('button')) {
      const k = b.dataset.k;
      const on = (e) => { e.preventDefault(); G.audio.unlock(); G.input.press(k); b.classList.add('on'); };
      const off = (e) => { e && e.preventDefault(); G.input.release(k); b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    }
    // swipe-free d-pad: slide finger between arrows
    const dp = touch.querySelector('.dpad');
    dp.addEventListener('pointermove', (e) => {
      if (!e.buttons && e.pointerType !== 'touch') return;
      const t = document.elementFromPoint(e.clientX, e.clientY); const k = t && t.dataset && t.dataset.k;
      for (const d of ['up', 'down', 'left', 'right']) if (d !== k && G.input.held(d)) { G.input.release(d); dp.querySelector(`[data-k=${d}]`).classList.remove('on'); }
      if (k && G.DIRS[k] && !G.input.held(k)) { G.input.press(k); t.classList.add('on'); }
    });
    dlg.addEventListener('pointerdown', (e) => { e.preventDefault(); G.audio.unlock(); G.input.press('a'); setTimeout(() => G.input.release('a'), 30); });
  }
  function showWorldUI(on) {
    hud.classList.toggle('hidden', !on); $('.menu-btn').classList.toggle('hidden', !on);
    const touchPref = localStorage.getItem('ebbmarrow.touch');
    touch.classList.toggle('hidden', !on || !(touchPref === '1' || (touchPref == null && G.isTouch())));
  }
  function updateHud() {
    const S = G.state.S; if (!S) return; const st = G.state.stats();
    $('.hud-name', hud).textContent = S.name; $('.hud-lv', hud).textContent = 'Lv ' + S.lvl; $('.hud-sh', hud).textContent = '◈ ' + S.shells;
    const bar = (c, v, m) => { const b = $('.bar.' + c, hud); b.querySelector('i').style.width = (100 * G.clamp(v / m, 0, 1)) + '%'; b.querySelector('em').textContent = v + '/' + m; };
    bar('hp', S.hp, st.hp); bar('sp', S.sp, st.sp);
    let obj = '';
    const ids = Object.keys(S.quests).filter((q) => S.quests[q] === 'active').sort((a, b) => (G.data.quests[b]?.main ? 1 : 0) - (G.data.quests[a]?.main ? 1 : 0));
    for (const id of ids) { const s = G.state.questStep(id); if (s) { obj = `<b>${G.esc(G.data.quests[id].title)}</b> ${G.esc(s.text)}`; break; } }
    const o = $('.hud-obj', hud); o.innerHTML = obj; o.classList.toggle('hidden', !obj);
  }
  /* wait for an edge-triggered key, also resolving on click handlers that call G.input.press */
  const nextKey = (keys) => new Promise((res) => { const f = (k) => { if (keys.includes(k)) { G.input.off(f); res(k); } }; G.input.on(f); });

  async function say(name, text, look, opts = {}) {
    text = G.state.text(text);
    dlg.classList.remove('hidden'); dlg.classList.toggle('narr', !name);
    const face = $('.dlg-face', dlg);
    if (look) { face.style.display = ''; const fx = face.getContext('2d'); fx.imageSmoothingEnabled = false; fx.clearRect(0, 0, 48, 48); fx.drawImage(G.art.portrait(look), 0, 0); } else face.style.display = 'none';
    $('.dlg-name', dlg).textContent = name || ''; $('.dlg-name', dlg).style.display = name ? '' : 'none';
    const tx = $('.dlg-text', dlg); tx.innerHTML = '';
    const nx = $('.dlg-next', dlg); nx.style.visibility = 'hidden';
    G.input.clear();
    // render with **emphasis**
    const html = G.esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>');
    const tmp = el('div'); tmp.innerHTML = html;
    const chars = []; (function walk(n, parent) { for (const c of [...n.childNodes]) { if (c.nodeType === 3) { for (const ch of c.textContent) chars.push([parent, ch]); } else { const cl = c.cloneNode(false); chars.push([parent, cl, true]); walk(c, cl); } } })(tmp, tx);
    let skip = false; const sp = textSpeed();
    const f = (k) => { if (k === 'a' || k === 'b') skip = true; }; G.input.on(f);
    for (let i = 0; i < chars.length; i++) {
      const [p, ch, isEl] = chars[i];
      if (isEl) p.appendChild(ch); else p.appendChild(document.createTextNode(ch));
      if (isEl) continue;
      if (!skip && sp < 4) { if (i % 3 === 0 && ch.trim()) G.audio.sfx('blip'); await G.wait(ch === '.' || ch === '!' || ch === '?' ? 90 / sp : 24 / sp); }
    }
    G.input.off(f);
    nx.style.visibility = 'visible';
    if (opts.noWait) return;
    await G.wait(60); G.input.clear();
    await nextKey(['a', 'b']);
    G.input.clear();
    G.audio.sfx('move');
    if (!opts.keep) dlg.classList.add('hidden');
  }
  const hideDlg = () => dlg.classList.add('hidden');

  /* Generic list chooser. items: [{label, sub, disabled, value}] ; resolves to index or -1 */
  function choose(items, opts = {}) {
    return new Promise((res) => {
      modalDepth++;
      const box = el('div', 'chooser ' + (opts.cls || ''));
      if (opts.title) box.append(el('div', 'ch-title', G.esc(opts.title)));
      if (opts.html) box.append(el('div', 'ch-html', opts.html));
      const list = el('div', 'ch-list'); box.append(list);
      const detail = opts.detail ? el('div', 'ch-detail') : null; if (detail) box.append(detail);
      let idx = Math.max(0, items.findIndex((i) => !i.disabled)); if (opts.start != null) idx = opts.start;
      const btns = items.map((it, i) => {
        const b = el('button', 'ch-item' + (it.disabled ? ' dis' : ''), `<span>${it.label}</span>${it.sub != null ? `<small>${it.sub}</small>` : ''}`);
        b.onclick = (e) => { e.preventDefault(); if (it.disabled) { G.audio.sfx('cancel'); return; } idx = i; done(i); };
        b.onpointerenter = () => { idx = i; sel(); };
        list.append(b); return b;
      });
      if (opts.cancel !== false) { const c = el('button', 'ch-close', '✕'); c.setAttribute('aria-label', 'Close'); c.onclick = (e) => { e.preventDefault(); done(-1); }; box.append(c); }
      (opts.parent || root).append(box);
      const sel = () => { btns.forEach((b, i) => b.classList.toggle('sel', i === idx)); if (btns[idx]) btns[idx].scrollIntoView({ block: 'nearest' }); if (detail) detail.innerHTML = items[idx] ? items[idx].detail || '' : ''; if (opts.onMove) opts.onMove(idx); };
      sel();
      const cols = opts.cols || 1;
      const f = (k) => {
        if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
          const d = k === 'up' ? -cols : k === 'down' ? cols : cols > 1 ? (k === 'left' ? -1 : 1) : 0; if (!d) return;
          let n = idx; for (let t = 0; t < items.length; t++) { n = (n + d + items.length) % items.length; if (!items[n].disabled) break; }
          idx = n; G.audio.sfx('move'); sel();
        } else if (k === 'a') { if (items[idx] && !items[idx].disabled) done(idx); }
        else if ((k === 'b' || k === 'menu') && opts.cancel !== false) done(-1);
      };
      G.input.clear(); G.input.on(f);
      function done(i) { G.input.off(f); box.remove(); modalDepth--; G.audio.sfx(i < 0 ? 'cancel' : 'select'); G.input.clear(); res(i); }
    });
  }
  async function page(title, html, opts = {}) {
    return choose([{ label: opts.ok || 'Close' }], { title, html, cls: 'page ' + (opts.cls || '') });
  }
  function toast(t, ms = 2600) { const e = el('div', 'toast', t); toastBox.append(e); setTimeout(() => e.classList.add('out'), ms); setTimeout(() => e.remove(), ms + 500); }
  async function card(small, title, sub, ms = 2600) {
    $('small', cardEl).textContent = small || ''; $('h2', cardEl).textContent = title || ''; $('p', cardEl).textContent = sub || '';
    cardEl.classList.remove('hidden'); requestAnimationFrame(() => cardEl.classList.add('on'));
    await G.wait(ms); cardEl.classList.remove('on'); await G.wait(500); cardEl.classList.add('hidden');
  }
  async function fade(on, ms = 350) { fadeEl.style.transitionDuration = ms + 'ms'; fadeEl.classList.toggle('on', on); await G.wait(ms + 20); }
  function flash(color = '#fff', ms = 300) { const f = el('div', 'flash'); f.style.background = color; root.append(f); requestAnimationFrame(() => f.classList.add('go')); setTimeout(() => f.remove(), ms + 100); }
  return { init, say, hideDlg, choose, page, toast, card, fade, flash, updateHud, showWorldUI, el, $, get modal() { return modalDepth > 0; }, root: () => root };
})();

/* ---- 90-main.js ---- */
/* Scene manager: title, world, battle; menus; chapter gating; main loop. */
G.main = (() => {
  const st = G.state, ui = G.ui;
  let cv, cx, low, lx, mode = 'boot', busy = 0, last = 0, VW = 320, VH = 180;
  const view = { css: 4, ox: 0, oy: 0 };
  let titleEl = null, titleT = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    const scale = Math.max(1, Math.floor(Math.min(w, h) / 176));
    cv.width = w; cv.height = h; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    VW = Math.ceil(w / scale); VH = Math.ceil(h / scale);
    low.width = VW; low.height = VH; lx.imageSmoothingEnabled = false; cx.imageSmoothingEnabled = false;
    view.css = scale / dpr; view.scale = scale;
  }
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    try {
      if (mode === 'world' || mode === 'title') {
        if (mode === 'world') { st.S.time += dt; if (!locked() && G.input.take('menu')) pauseMenu(); else if (!locked() && G.input.take('a')) G.world.interact(); }
        G.world.update(dt);
        if (mode === 'title') { titleT += dt; const p = G.world.player; p.px = 16 * 14 + Math.sin(titleT * 0.05) * 120; p.py = 16 * 18; }
        G.world.render(lx, VW, VH);
      } else if (mode === 'battle') { G.battle.update(dt); G.battle.render(lx, VW, VH); }
      cx.drawImage(low, 0, 0, VW * view.scale, VH * view.scale);
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  const locked = () => mode !== 'world' || busy > 0 || ui.modal;

  async function boot() {
    cv = document.getElementById('cv'); cx = cv.getContext('2d'); [low, lx] = G.art.mk(320, 180);
    ui.init(); resize(); addEventListener('resize', resize);
    addEventListener('pointerdown', () => G.audio.unlock(), { passive: true });
    try { await G.loadData(); } catch (e) { document.getElementById('ui').innerHTML = '<div class="err">Could not load the story data. Please refresh.</div>'; throw e; }
    window.__rpg = { G, get mode() { return mode; }, get busy() { return busy; } };
    requestAnimationFrame(frame);
    showTitle();
  }

  /* ---------------- title ---------------- */
  function chapterInfo() {
    const open = [...G.data.chapters].sort((a, b) => a.number - b.number);
    return { open };
  }
  function showTitle() {
    mode = 'title'; busy = 0; ui.showWorldUI(false);
    st.newGame(); G.world.enter(G.data.player.titleMap || 'cove', 14, 18, 'down'); G.world.player.hidden = true;
    G.audio.play('title');
    const save = st.peek();
    const log = G.data.changelog[0], seen = localStorage.getItem('ebbmarrow.seenlog');
    titleEl = ui.el('div', 'title', `<div class="t-wrap">
      <div class="t-logo"><span>EBB</span><span>MARROW</span></div>
      <p class="t-tag">Every night the sea goes out a little further,<br>and leaves something behind.</p>
      <div class="t-btns"></div>
      ${log ? `<div class="t-log">${log.date === G.etToday() ? 'Improved today' : 'Latest update'}: ${G.esc(log.title)}</div>` : ''}
      <div class="t-foot">Original game. Art, music and sound generated in code. Saves stay on this device. · <a href="extras/">Extras: the Daycade arcade</a></div></div>`);
    ui.root().append(titleEl);
    titleMenu(save, log && log.date !== seen);
  }
  async function titleMenu(save, newLog) {
    for (;;) {
      const items = [];
      if (save) items.push({ label: 'Continue', sub: `${G.esc(save.name)} · Lv ${save.lvl} · ${G.esc((G.data.maps[save.map] || {}).name || '')}`, v: 'cont' });
      items.push({ label: 'New game', v: 'new' }, { label: 'Story so far', v: 'journal' }, { label: "What's new" + (newLog ? ' <i class="badge">NEW</i>' : ''), v: 'log' }, { label: 'Settings', v: 'settings' }, { label: 'Credits', v: 'credits' });
      const i = await ui.choose(items, { parent: titleEl.querySelector('.t-btns'), cancel: false, cls: 'tmenu' });
      const v = items[i].v;
      if (v === 'cont') { if (st.load()) return startPlay(false); }
      if (v === 'new') {
        if (save) { const c = await ui.choose([{ label: 'Start over' }, { label: 'Keep my save' }], { title: 'Starting a new game replaces your save on this device.', cancel: false }); if (c !== 0) continue; }
        st.newGame(); return startPlay(true);
      }
      if (v === 'journal') await journal();
      if (v === 'log') { await whatsNew(); newLog = false; }
      if (v === 'settings') await settings();
      if (v === 'credits') await ui.page('Credits', `<p><b>Ebbmarrow</b> is an original story-driven RPG that grows by one chapter every day.</p><p>Engine, pixel art, music and sound effects are all generated in code: no third-party art or audio is used. Text set in your device's system fonts.</p><p>Made by Moonshots.</p>`);
    }
  }
  async function startPlay(fresh) {
    if (titleEl) { titleEl.remove(); titleEl = null; }
    await ui.fade(true, 300);
    G.world.player.hidden = false;
    G.world.enter(st.S.map, st.S.x, st.S.y, st.S.dir);
    mode = 'world'; ui.showWorldUI(true); ui.updateHud();
    await ui.fade(false, 400);
    if (!fresh) ui.toast(`Welcome back. ${G.esc(G.world.map.name)}`);
    await checkChapters();
  }

  /* ---------------- chapters ---------------- */
  async function checkChapters() {
    const S = st.S;
    for (const ch of [...G.data.chapters].sort((a, b) => a.number - b.number)) {
      if (S.flags[ch.id + '_started']) continue;
      if (ch.requires && !st.cond(ch.requires)) return;
      st.flag(ch.id + '_started'); G.world.refresh();
      busy++;
      try {
        await ui.card(ch.number === 0 ? 'Prologue' : 'Part ' + ch.number, ch.title, ch.sub || '', 2800);
        if (ch.start) await G.script.run(ch.start);
      } finally { busy--; }
      after(); st.save();
      return;
    }
  }
  async function chapterEnd(id) {
    const ch = G.data.chapters.find((c) => c.id === id); st.flag(id + '_done');
    G.audio.sfx('win');
    await ui.card(ch.number === 0 ? 'End of the Prologue' : 'End of Part ' + ch.number, ch.title, 'Progress saved', 2600);
    st.save();
    const next = G.data.chapters.find((c) => c.number === ch.number + 1);
    if (!next && ch.number > 0) await ui.page('The tide is still going out', `<p>That's the story so far. Ebbmarrow gets better every day: new art, smoother play, and more of the drowned kingdom as the sea pulls back.</p><p>Your save stays on this device. The cove and the flats are still yours to explore, and side quests may still be waiting.</p>`, { ok: 'Keep exploring' });
  }
  async function journal() {
    const { open } = chapterInfo(); const S = mode === 'world' ? st.S : st.peek();
    let h = '<div class="journal">', shown = 0;
    for (const c of open) {
      const reached = S && S.flags && S.flags[c.id + '_started'];
      if (!reached && shown) break;
      shown++;
      h += `<section><small>${c.number === 0 ? 'Prologue' : 'Part ' + c.number}${S && S.flags && S.flags[c.id + '_done'] ? ' · <b class="ok">complete</b>' : reached ? ' · in progress' : ''}</small><h3>${G.esc(c.title)}</h3><p>${G.esc(reached ? c.recap || '' : c.blurb || c.recap || '')}</p></section>`;
    }
    await ui.page('Story so far', h + '</div>', { cls: 'wide' });
  }
  async function whatsNew() {
    const L = G.data.changelog; localStorage.setItem('ebbmarrow.seenlog', L[0] ? L[0].date : '');
    const h = L.slice(0, 10).map((e) => `<section><small>${G.fmtDate(e.date)}${e.date === G.etToday() ? ' · today' : ''}</small><h3>${G.esc(e.title)}</h3><ul>${e.items.map((i) => `<li>${G.esc(i)}</li>`).join('')}</ul></section>`).join('');
    await ui.page("What's new", `<div class="journal">${h || '<p>Nothing yet.</p>'}</div>`, { cls: 'wide' });
  }

  /* ---------------- world interactions ---------------- */
  function after() {
    for (const q of st.checkQuests()) { G.audio.sfx('chest'); ui.toast(`Quest complete: <b>${G.esc(G.data.quests[q].title)}</b>`, 3400); const d = G.data.quests[q]; if (d.onDone) G.script.actions(d.onDone); }
    G.world.refresh(); ui.updateHud();
  }
  async function runScript(ref, ctx) {
    busy++;
    try { await G.script.run(ref, ctx); } finally { busy--; G.input.clear(); }
    after(); await checkChapters();
  }
  function pickDialog(d) { if (!Array.isArray(d)) return d; for (const o of d) if (!o.if || st.cond(o.if)) return o.d; return null; }
  async function interact(e) {
    if (e.type === 'npc' || e.type === 'block' || e.type === 'prop') { const d = pickDialog(e.dialog); if (d) await runScript(d, e); return; }
    if (e.type === 'sign') { await runScript([e.text]); return; }
    if (e.type === 'chest') {
      const key = 'chest:' + G.world.map.id + ':' + e.id;
      if (st.S.flags[key]) { await runScript(['It\'s empty.']); return; }
      if (e.need && !st.cond(e.need)) { await runScript(e.locked ? [e.locked] : ['It won\'t budge.']); return; }
      st.flag(key);
      const acts = []; if (e.item) acts.push(['give', e.item, e.n || 1]); if (e.shells) acts.push(['shells', e.shells]); for (const f of [].concat(e.flag || [])) acts.push(['flag', f]);
      await runScript([{ do: acts }, ...(e.dialog ? [{ go: e.dialog }] : [])]);
      return;
    }
    if (e.type === 'shrine') {
      busy++;
      try {
        await ui.say(null, 'A tide-basin of old Marrow stone. Seawater in it stays fresh and cold, and it hums when you lean close.', null, { keep: true });
        const i = await ui.choose([{ label: 'Rest and save' }, { label: 'Leave it' }], { cancel: true, cls: 'dchoice' }); ui.hideDlg();
        if (i === 0) { st.heal(); st.S.respawn = { map: G.world.map.id, x: st.S.x, y: st.S.y }; st.save(); G.audio.sfx('heal'); ui.flash('rgba(127,240,224,0.5)', 400); ui.toast('Rested. Game saved.'); }
      } finally { busy--; G.input.clear(); }
      ui.updateHud();
    }
  }
  async function encounter(foe) {
    if (busy || mode !== 'world') return;
    busy++;
    let r;
    try { r = await fight(foe.group, { boss: foe.boss, noFlee: foe.noFlee || foe.boss, intro: foe.intro, tide: foe.tide }); } finally { busy--; }
    const key = G.world.map.id + ':' + foe.id;
    if (r === 'win') { if (foe.respawn) st.S.tempFoes[key] = 1; else st.flag('foe:' + key); if (foe.flag) st.flag(foe.flag); if (foe.after) await runScript(foe.after); }
    else if (r === 'flee') { st.S.tempFoes[key] = 1; }
    after();
  }
  async function fight(group, opts = {}) {
    G.audio.sfx('battle'); ui.flash('#fff', 250); await ui.fade(true, 250);
    mode = 'battle'; ui.showWorldUI(false); await ui.fade(false, 200);
    const r = await G.battle.start(group, opts);
    await ui.fade(true, 250); mode = 'world'; ui.showWorldUI(true); G.audio.play(G.world.map.music);
    if (r === 'lose') await defeat(); else await ui.fade(false, 250);
    return r;
  }
  async function defeat() {
    const S = st.S; const lost = Math.floor(S.shells * 0.2); S.shells -= lost;
    st.heal(); G.world.enter(S.respawn.map, S.respawn.x, S.respawn.y, 'down');
    await ui.fade(false, 600);
    await G.script.run([`You wake beside the tide-basin, soaked and aching.${lost ? ` ${lost} shells are gone from your pouch.` : ''} The sea, it seems, gave you back.`]);
    st.save();
  }
  async function travel(map, x, y, dir, quiet) {
    busy++;
    try {
      G.audio.sfx('door'); await ui.fade(true, 260);
      const prev = G.world.map && G.world.map.name;
      G.world.enter(map, x, y, dir); st.save();
      await ui.fade(false, 300);
      if (!quiet && G.world.map.name !== prev) ui.toast(`<b>${G.esc(G.world.map.name)}</b>`, 2000);
    } finally { busy--; }
    await checkChapters();
  }
  async function shop(list) {
    busy++;
    try {
      for (;;) {
        const S = st.S;
        const items = list.map((id) => { const it = G.data.items[id]; return { label: G.esc(it.name), sub: `◈ ${it.price}`, disabled: S.shells < it.price || (it.unique && st.has(id)), detail: `${G.esc(it.desc)}<br><small>You have ${st.count(id) + (S.equip.weapon === id || S.equip.charm === id ? 1 : 0)} · Shells: ${S.shells}</small>` }; });
        const i = await ui.choose(items, { title: `Mags's Stall  ·  ◈ ${S.shells}`, detail: true });
        if (i < 0) break;
        const it = G.data.items[list[i]]; S.shells -= it.price; st.give(list[i]); G.audio.sfx('buy'); ui.toast(`Bought <b>${G.esc(it.name)}</b>`); ui.updateHud();
      }
    } finally { busy--; }
  }

  /* ---------------- pause menu ---------------- */
  async function pauseMenu() {
    busy++;
    try {
      for (;;) {
        const i = await ui.choose([{ label: 'Items' }, { label: 'Equipment & arts' }, { label: 'Quests' }, { label: 'Story so far' }, { label: "What's new" }, { label: 'Save' }, { label: 'Settings' }, { label: 'Title screen' }], { title: 'Menu', cls: 'pmenu' });
        if (i < 0) break;
        if (i === 0) await itemsMenu();
        if (i === 1) await equipMenu();
        if (i === 2) await questsPage();
        if (i === 3) await journal();
        if (i === 4) await whatsNew();
        if (i === 5) { st.save(); G.audio.sfx('chest'); ui.toast('Game saved'); }
        if (i === 6) await settings();
        if (i === 7) { const c = await ui.choose([{ label: 'Save and quit' }, { label: 'Quit without saving' }, { label: 'Back' }], { title: 'Return to the title screen?' }); if (c === 0) st.save(); if (c === 0 || c === 1) { busy = 0; return showTitle(); } }
      }
    } finally { if (busy > 0) busy--; }
    ui.updateHud();
  }
  async function itemsMenu() {
    for (;;) {
      const S = st.S, ids = Object.keys(S.inv);
      if (!ids.length) { await ui.page('Items', '<p>Your satchel is empty.</p>'); return; }
      const order = { consumable: 0, weapon: 1, charm: 2, key: 3 };
      ids.sort((a, b) => (order[G.data.items[a].type] ?? 9) - (order[G.data.items[b].type] ?? 9));
      const i = await ui.choose(ids.map((k) => { const it = G.data.items[k]; return { label: G.esc(it.name), sub: '×' + S.inv[k], detail: G.esc(it.desc) + (it.type === 'key' ? '<br><small>Key item</small>' : '') }; }), { title: 'Items', detail: true });
      if (i < 0) return;
      const id = ids[i], it = G.data.items[id];
      if (it.type === 'consumable') { const s = st.stats(); if (S.hp >= s.hp && (!it.sp || S.sp >= s.sp)) { ui.toast('Already at full strength'); continue; } st.take(id); S.hp = Math.min(s.hp, S.hp + (it.heal || 0)); S.sp = Math.min(s.sp, S.sp + (it.sp || 0)); G.audio.sfx('heal'); ui.toast(`Used ${G.esc(it.name)}`); ui.updateHud(); }
      else if (it.type === 'weapon' || it.type === 'charm') { st.equip(id); G.audio.sfx('select'); ui.toast(`Equipped ${G.esc(it.name)}`); ui.updateHud(); }
    }
  }
  async function equipMenu() {
    const S = st.S, s = st.stats(), nm = (id) => (id ? G.esc(G.data.items[id].name) : '<i>none</i>');
    const arts = S.skills.map((k) => G.data.skills[k]).filter((d) => d && d.kind !== 'basic').map((d) => `<li><b>${G.esc(d.name)}</b>${d.cost ? ` (${d.cost} BR)` : ''}: ${G.esc(d.desc)}</li>`).join('');
    const need = st.xpFor(S.lvl + 1) - S.xp;
    await ui.page('Equipment & arts', `<div class="stats"><div><b>Level ${S.lvl}</b> · ${need} XP to next</div><div>HP ${s.hp} · Breath ${s.sp} · Attack ${s.atk} · Defense ${s.def} · Speed ${s.spd}</div>
      <div>Weapon: ${nm(S.equip.weapon)}</div><div>Charm: ${nm(S.equip.charm)}</div></div><p><small>Equip new gear from Items.</small></p><h4>Arts</h4><ul>${arts || '<li>None yet</li>'}</ul>
      <h4>The Tide</h4><p><small>In battle the tide turns every round. Water arts are strongest at high tide; blades crit more at low tide.</small></p>`, { cls: 'wide' });
  }
  async function questsPage() {
    const S = st.S; let h = '';
    const ids = Object.keys(S.quests);
    for (const id of ids.sort((a, b) => (S.quests[a] === 'done') - (S.quests[b] === 'done'))) {
      const q = G.data.quests[id]; if (!q) continue;
      h += `<section class="${S.quests[id]}"><h3>${q.main ? '★ ' : ''}${G.esc(q.title)}${S.quests[id] === 'done' ? ' <b class="ok">done</b>' : ''}</h3><p>${G.esc(q.desc)}</p><ul class="steps">`;
      for (const s of q.steps) { const ok = st.cond(s.flag); h += `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${G.esc(s.text)}</li>`; if (!ok) break; }
      h += '</ul></section>';
    }
    await ui.page('Quests', `<div class="journal">${h || '<p>No quests yet.</p>'}</div>`, { cls: 'wide' });
  }
  async function settings() {
    const lv = [0, 0.3, 0.55, 0.8], nm = (v) => (v === 0 ? 'Off' : v < 0.4 ? 'Low' : v < 0.7 ? 'Medium' : 'High');
    const ts = ['', 'Slow', 'Normal', 'Fast', 'Instant'];
    let at = 0;
    for (;;) {
      const a = G.audio.vol, sp = +(localStorage.getItem('ebbmarrow.textspeed') || 2), tp = localStorage.getItem('ebbmarrow.touch');
      const i = await ui.choose([{ label: 'Music', sub: nm(a.music) }, { label: 'Sound effects', sub: nm(a.sfx) }, { label: 'Text speed', sub: ts[sp] }, { label: 'Touch controls', sub: tp == null ? 'Auto' : tp === '1' ? 'On' : 'Off' }, { label: 'Delete save data', sub: '' }], { title: 'Settings', start: at });
      if (i < 0) return; at = i;
      const nxt = (v) => lv[(lv.indexOf(lv.reduce((p, c) => (Math.abs(c - v) < Math.abs(p - v) ? c : p))) + 1) % lv.length];
      if (i === 0) { G.audio.unlock(); G.audio.set('music', nxt(a.music)); }
      if (i === 1) { G.audio.unlock(); G.audio.set('sfx', nxt(a.sfx)); G.audio.sfx('select'); }
      if (i === 2) localStorage.setItem('ebbmarrow.textspeed', String((sp % 4) + 1));
      if (i === 3) { if (tp == null) localStorage.setItem('ebbmarrow.touch', '1'); else if (tp === '1') localStorage.setItem('ebbmarrow.touch', '0'); else localStorage.removeItem('ebbmarrow.touch'); if (mode === 'world') ui.showWorldUI(true); }
      if (i === 4) { const c = await ui.choose([{ label: 'Delete everything' }, { label: 'Cancel' }], { title: 'Delete your save on this device? This cannot be undone.' }); if (c === 0) { st.wipe(); ui.toast('Save deleted'); if (mode !== 'world') { location.reload(); } } }
    }
  }
  return { boot, locked, interact, encounter, fight, travel, runScript, chapterEnd, shop, view, get mode() { return mode; } };
})();
addEventListener('DOMContentLoaded', () => G.main.boot());
