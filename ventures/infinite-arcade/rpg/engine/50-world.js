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
