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
