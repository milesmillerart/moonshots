/* Duality: a daily sun & moon logic puzzle (binary grid). Same puzzle for everyone each day, plus endless practice. */
(function () {
  'use strict';
  const N = 6, HALF = 3, EPOCH = Date.UTC(2026, 10, 15);
  const A = Kit.audio, $ = id => document.getElementById(id);
  const SUN = '<svg viewBox="0 0 40 40"><g fill="#ffd23f"><circle cx="20" cy="20" r="8.5"/><g stroke="#ffd23f" stroke-width="3" stroke-linecap="round"><path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M8 32l3.5-3.5M28.5 11.5L32 8"/></g></g></svg>';
  const MOON = '<svg viewBox="0 0 40 40"><path fill="#b9a8ff" d="M17.74 7.06A14 14 0 1 0 32.94 22.26A11 11 0 0 1 17.74 7.06Z"/><circle cx="14" cy="24" r="1.8" fill="#8f7be8"/><circle cx="20" cy="30" r="1.2" fill="#8f7be8"/></svg>';
  let mode, puzzle, cells, sol, givens, history, t0, elapsed, penalty, solved, curIdx = 0, timerId, dayKey, dayNo;

  /* ---------- generator / solver ---------- */
  function ok(g, i) { // partial validity around index i
    const r = Math.floor(i / N), c = i % N, v = g[i];
    if (v < 0) return true;
    // three in a row horizontally / vertically
    for (let k = -2; k <= 0; k++) {
      const c0 = c + k; if (c0 >= 0 && c0 + 2 < N && g[r * N + c0] === v && g[r * N + c0 + 1] === v && g[r * N + c0 + 2] === v) return false;
      const r0 = r + k; if (r0 >= 0 && r0 + 2 < N && g[r0 * N + c] === v && g[(r0 + 1) * N + c] === v && g[(r0 + 2) * N + c] === v) return false;
    }
    let rc = 0, cc = 0; for (let k = 0; k < N; k++) { if (g[r * N + k] === v) rc++; if (g[k * N + c] === v) cc++; }
    return rc <= HALF && cc <= HALF;
  }
  function fill(g, rand) {
    const i = g.indexOf(-1); if (i < 0) return true;
    const order = rand() < 0.5 ? [0, 1] : [1, 0];
    for (const v of order) { g[i] = v; if (ok(g, i) && fill(g, rand)) return true; }
    g[i] = -1; return false;
  }
  function count(g, limit) {
    const i = g.indexOf(-1); if (i < 0) return 1;
    let n = 0;
    for (const v of [0, 1]) { g[i] = v; if (ok(g, i)) { n += count(g, limit - n); if (n >= limit) break; } }
    g[i] = -1; return n;
  }
  function generate(seed) {
    const rand = Kit.rng(seed);
    const full = new Array(N * N).fill(-1); fill(full, rand);
    const p = full.slice();
    const order = [...Array(N * N).keys()]; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let left = N * N; const target = 11;
    for (const i of order) {
      if (left <= target) break;
      const keep = p[i]; p[i] = -1;
      if (count(p.slice(), 2) !== 1) p[i] = keep; else left--;
    }
    return { sol: full, giv: p };
  }

  /* ---------- state ---------- */
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function setup(m) {
    mode = m; dayKey = today();
    dayNo = Math.floor((Date.UTC(+dayKey.slice(0, 4), +dayKey.slice(5, 7) - 1, +dayKey.slice(8, 10)) - EPOCH) / 864e5) + 1;
    const seed = m === 'daily' ? Kit.hashStr('duality-' + dayKey) : (Math.random() * 4294967296) >>> 0;
    puzzle = generate(seed); sol = puzzle.sol; givens = puzzle.giv;
    cells = givens.slice(); history = []; penalty = 0; solved = false; elapsed = 0;
    $('mode').textContent = m === 'daily' ? 'Daily #' + dayNo : 'Practice';
    $('switch').textContent = m === 'daily' ? 'Practice' : 'Daily';
    $('board').classList.remove('win');
    const done = m === 'daily' && Kit.store.get('day-' + dayKey, null);
    if (done) { cells = sol.slice(); solved = true; elapsed = done.time; }
    build(); paint(); tick();
    t0 = performance.now() - elapsed * 1000;
    clearInterval(timerId); timerId = setInterval(tick, 250);
    if (!solved) Kit.sdk.gameplayStart();
  }
  function build() {
    const b = $('board'); b.innerHTML = '';
    for (let i = 0; i < N * N; i++) {
      const e = document.createElement('button'); e.className = 'cell'; e.setAttribute('role', 'gridcell'); e.dataset.i = i;
      e.addEventListener('click', () => { curIdx = i; tap(i, 1); });
      b.appendChild(e);
    }
  }
  function errors() {
    const bad = new Set();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = cells[r * N + c]; if (v < 0) continue;
      if (c + 2 < N && cells[r * N + c + 1] === v && cells[r * N + c + 2] === v) [0, 1, 2].forEach(k => bad.add(r * N + c + k));
      if (r + 2 < N && cells[(r + 1) * N + c] === v && cells[(r + 2) * N + c] === v) [0, 1, 2].forEach(k => bad.add((r + k) * N + c));
    }
    for (let k = 0; k < N; k++) for (const v of [0, 1]) {
      let rc = 0, cc = 0; for (let j = 0; j < N; j++) { if (cells[k * N + j] === v) rc++; if (cells[j * N + k] === v) cc++; }
      if (rc > HALF) for (let j = 0; j < N; j++) if (cells[k * N + j] === v && givens[k * N + j] < 0) bad.add(k * N + j);
      if (cc > HALF) for (let j = 0; j < N; j++) if (cells[j * N + k] === v && givens[j * N + k] < 0) bad.add(j * N + k);
    }
    return bad;
  }
  function paint(changed) {
    const bad = errors();
    [...$('board').children].forEach((e, i) => {
      const v = cells[i];
      if (changed === undefined || changed === i || e.dataset.v !== String(v)) { e.innerHTML = v === 0 ? SUN : v === 1 ? MOON : ''; e.dataset.v = v; }
      e.classList.toggle('given', givens[i] >= 0);
      e.classList.toggle('err', bad.has(i));
      e.classList.toggle('cur', i === curIdx && kbUsed);
      e.setAttribute('aria-label', (v === 0 ? 'sun' : v === 1 ? 'moon' : 'empty') + (givens[i] >= 0 ? ', fixed' : ''));
    });
    return bad;
  }
  function tap(i, dir) {
    if (solved || givens[i] >= 0 || Kit.overlayOpen()) { if (givens[i] >= 0) A.tone(160, 0.05, 'sine', 0.05); return; }
    const order = [-1, 0, 1], v = cells[i];
    set(i, order[(order.indexOf(v) + (dir || 1) + 3) % 3]);
  }
  function set(i, v) {
    if (solved || givens[i] >= 0 || cells[i] === v) return;
    history.push([i, cells[i]]); cells[i] = v;
    const bad = paint(i);
    if (bad.has(i)) A.tone(190, 0.09, 'square', 0.06); else A.tone(v === 0 ? 660 : v === 1 ? 495 : 330, 0.07, 'triangle', 0.12);
    check();
  }
  function check() {
    if (cells.includes(-1) || errors().size) return;
    // any valid completed grid counts (should equal the unique solution)
    solved = true; elapsed = (performance.now() - t0) / 1000 + penalty; tick(); clearInterval(timerId);
    Kit.sdk.gameplayStop(); Kit.sdk.happytime();
    $('board').classList.add('win');
    [...$('board').children].forEach((e, k) => e.style.animationDelay = ((k % N) + Math.floor(k / N)) * 40 + 'ms');
    [0, 2, 4, 7, 9].forEach((s, k) => A.tone(A.note(s + 5), 0.25, 'triangle', 0.18, null, k * 0.09));
    const time = Math.round(elapsed);
    let extra = [], isNew = false, best;
    if (mode === 'daily') {
      Kit.store.set('day-' + dayKey, { time: time });
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yk = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      const st = Kit.store.get('streak', { n: 0, last: '' });
      const n = st.last === dayKey ? st.n : st.last === yk ? st.n + 1 : 1;
      Kit.store.set('streak', { n: n, last: dayKey });
      extra.push('Streak: <b>' + n + ' day' + (n > 1 ? 's' : '') + '</b> · New puzzle at midnight');
      const r = Kit.best(time, true); best = r.best; isNew = r.isNew;
    } else { const r = Kit.best(time, true); best = r.best; isNew = r.isNew; }
    setTimeout(() => {
      Kit.over({ heading: mode === 'daily' ? 'Daily #' + dayNo + ' solved' : 'Solved!', score: time, best: best, isNew: isNew, fmt: fmtT, extra: extra, button: mode === 'daily' ? 'Play a practice puzzle' : 'Next puzzle', quips: ['Clean solve.', 'Nicely reasoned.', 'Balance restored.'] }, () => setup('practice'));
      const card = document.querySelector('.dk-card'), btn = document.createElement('button');
      btn.className = 'share'; btn.textContent = 'Share result';
      btn.addEventListener('click', () => share(time, btn));
      card.insertBefore(btn, card.querySelector('.dk-keys'));
    }, 900);
  }
  function share(time, btn) {
    const txt = 'Duality ' + (mode === 'daily' ? '#' + dayNo : '(practice)') + ' ☀️🌙 solved in ' + fmtT(time) + (penalty ? ' (' + penalty / 15 + ' hint' + (penalty > 15 ? 's' : '') + ')' : '');
    const done = () => { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Share result', 1500); };
    // clipboard only: no outbound links from inside the game
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => prompt('Copy your result:', txt));
    else prompt('Copy your result:', txt);
  }
  function fmtT(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function tick() { if (!solved && t0) elapsed = (performance.now() - t0) / 1000 + penalty; $('timer').textContent = fmtT(elapsed); }
  function hint() {
    if (solved) return;
    const wrong = cells.map((v, i) => i).filter(i => givens[i] < 0 && cells[i] >= 0 && cells[i] !== sol[i]);
    const empty = cells.map((v, i) => i).filter(i => cells[i] < 0);
    const pick = wrong.length ? wrong[0] : empty[Math.floor(Math.random() * empty.length)];
    if (pick === undefined) return;
    penalty += 15; set(pick, sol[pick]);
    const e = $('board').children[pick]; e.classList.add('err'); setTimeout(() => paint(), 400);
  }
  function undo() { const h = history.pop(); if (!h || solved) return; cells[h[0]] = h[1]; paint(h[0]); A.tone(400, 0.05, 'sine', 0.06); }
  let kbUsed = false;
  $('undo').onclick = undo; $('hint').onclick = hint;
  $('clear').onclick = () => { if (solved) return; for (let i = 0; i < N * N; i++) if (givens[i] < 0 && cells[i] >= 0) history.push([i, cells[i]]); cells = givens.slice(); paint(); };
  $('switch').onclick = () => setup(mode === 'daily' ? 'practice' : 'daily');
  Kit.onKey(e => {
    const r = Math.floor(curIdx / N), c = curIdx % N;
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] }[e.code];
    if (mv) { kbUsed = true; curIdx = ((r + mv[0] + N) % N) * N + (c + mv[1] + N) % N; paint(); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); kbUsed = true; tap(curIdx, 1); }
    else if (e.key === '1') set(curIdx, 0); else if (e.key === '2') set(curIdx, 1);
    else if (e.key === '0' || e.code === 'Backspace' || e.code === 'Delete') set(curIdx, -1);
    else if (e.code === 'KeyZ') undo(); else if (e.code === 'KeyH') hint();
  });
  Kit.sdk.init().then(() => {
    Kit.sdk.loaded();
    const done = Kit.store.get('day-' + today(), null);
    setup(done ? 'practice' : 'daily');
    Kit.sdk.gameplayStop(); clearInterval(timerId);
    Kit.menu({ title: 'Duality', howto: 'Fill the grid with suns and moons. Every row and column needs <b>3 of each</b>, and never <b>3 of the same in a row</b>. Tap a cell to cycle it. ' + (done ? '<br><br>You already solved today\'s puzzle in <b>' + fmtT(done.time) + '</b>. Warm up with practice puzzles.' : 'Everyone gets the same puzzle today.'), button: done ? 'Practice puzzle' : 'Play today\'s puzzle', fmt: fmtT, keys: 'Tap cells · or arrows + Space · 1 sun · 2 moon · Z undo' }, () => { t0 = performance.now(); clearInterval(timerId); timerId = setInterval(tick, 250); Kit.sdk.gameplayStart(); });
  });
  window.__game = { get state() { return solved ? 'solved' : 'play'; }, get cells() { return cells.slice(); }, get solution() { return sol.slice(); }, set: set, get mode() { return mode; } };
})();
