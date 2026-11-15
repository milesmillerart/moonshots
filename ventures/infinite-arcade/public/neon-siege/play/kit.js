/* Daycade Kit v1: shared runtime for every Daycade game.
 * Self-contained, no network calls. Copied into each game's folder at build time
 * so every game bundle stays portable (relative paths only) for portal submission.
 *
 * Portal hooks: if a portal SDK is present on the page (CrazyGames v3 or Poki),
 * Kit.sdk forwards gameplayStart/Stop, happytime and ad breaks to it. Nothing is
 * loaded from here; portal builds add the SDK <script> themselves.
 */
(function () {
  'use strict';
  const GAME = (document.documentElement.dataset.game || 'game');
  const NS = 'daycade.' + GAME + '.';

  /* ---------- storage ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { } },
  };
  function best(score, lowerIsBetter) {
    const b = store.get('best', null);
    const isNew = b === null || (lowerIsBetter ? score < b : score > b);
    if (isNew) store.set('best', score);
    return { best: isNew ? score : b, isNew: isNew && (b !== null || score > 0) };
  }

  /* ---------- audio (WebAudio synth, no files) ---------- */
  let ac = null, master = null, noiseBuf = null;
  let muted = (function () { try { return localStorage.getItem('daycade.muted') === '1'; } catch (e) { return false; } })();
  function ensureAudio() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.55;
        master.connect(ac.destination);
      }
      if (ac.state !== 'running') ac.resume();
    } catch (e) { }
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, ensureAudio, { passive: true }));
  function tone(f, d, type, v, f2, delay) {
    if (!ac || muted) return;
    d = d || 0.1; v = v == null ? 0.2 : v;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v, freq, delay) {
    if (!ac || muted) return;
    d = d || 0.2; v = v == null ? 0.2 : v;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq || 1200;
    const g = ac.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(master);
    s.start(t); s.stop(t + d + 0.03);
  }
  const SCALE = [0, 2, 4, 7, 9]; // major pentatonic
  function note(i, base) { base = base || 262; const o = Math.floor(i / 5), s = ((i % 5) + 5) % 5; return base * Math.pow(2, o + SCALE[s] / 12); }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('daycade.muted', muted ? '1' : '0'); } catch (e) { }
    if (master) master.gain.value = muted ? 0 : 0.55;
    if (muteBtn) muteBtn.innerHTML = muted ? ICON_OFF : ICON_ON;
    if (muteBtn) muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  /* ---------- portal SDK hooks ---------- */
  const listeners = {};
  function emit(type, data) {
    (listeners[type] || []).forEach(f => { try { f(data); } catch (e) { } });
    try { if (window.parent !== window) window.parent.postMessage({ source: 'daycade', game: GAME, type: type, data: data }, '*'); } catch (e) { }
  }
  function cg() { return window.CrazyGames && window.CrazyGames.SDK; }
  function poki() { return window.PokiSDK; }
  let playing = false;
  const sdk = {
    async init() {
      try { if (cg()) await cg().init(); } catch (e) { }
      try { if (poki()) await poki().init(); } catch (e) { }
      try { if (cg() && cg().game && cg().game.settings) setMuted(cg().game.settings.muteAudio || muted); } catch (e) { }
    },
    loaded() { try { if (poki()) poki().gameLoadingFinished(); } catch (e) { } emit('loaded'); },
    gameplayStart() { if (playing) return; playing = true; try { if (cg()) cg().game.gameplayStart(); if (poki()) poki().gameplayStart(); } catch (e) { } emit('gameplayStart'); },
    gameplayStop() { if (!playing) return; playing = false; try { if (cg()) cg().game.gameplayStop(); if (poki()) poki().gameplayStop(); } catch (e) { } emit('gameplayStop'); },
    happytime() { try { if (cg()) cg().game.happytime(); } catch (e) { } emit('happytime'); },
    score(s) { emit('score', s); },
    // Ad break hook: resolves immediately until an ad provider is wired in.
    midgameAd() {
      return new Promise(res => {
        try {
          if (cg() && cg().ad) {
            const was = muted; setMuted(true);
            cg().ad.requestAd('midgame', { adFinished: () => { setMuted(was); res(); }, adError: () => { setMuted(was); res(); }, adStarted: () => { } });
            return;
          }
          if (poki()) { poki().commercialBreak().then(res, res); return; }
        } catch (e) { }
        res();
      });
    },
    on(type, f) { (listeners[type] = listeners[type] || []).push(f); },
  };

  /* ---------- stage: DPR-aware canvas with logical coordinates ---------- */
  // opts: {w, h} fixed logical playfield (letterboxed, view extends to fill)
  //       {h} height-locked (width follows aspect)  |  {} fill (1 unit = 1 CSS px)
  function stage(canvas, opts) {
    opts = opts || {};
    ui(); // inject base CSS first so the canvas has its real size before the first resize
    const ctx = canvas.getContext('2d');
    const S = { canvas, ctx, scale: 1, W: opts.w || 0, H: opts.h || 0, view: { x: 0, y: 0, w: 0, h: 0 }, cssW: 0, cssH: 0 };
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
      S.cssW = cw; S.cssH = ch;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      let scale, ox, oy;
      if (opts.w && opts.h) {
        scale = Math.min(cw / opts.w, ch / opts.h);
        ox = (cw - opts.w * scale) / 2; oy = (ch - opts.h * scale) / 2;
      } else if (opts.h) {
        scale = ch / opts.h;
        if (opts.minW && cw / scale < opts.minW) scale = cw / opts.minW;
        S.W = cw / scale; ox = 0; oy = (ch - opts.h * scale) / 2;
      } else {
        scale = 1; S.W = cw; S.H = ch; ox = 0; oy = 0;
      }
      S.scale = scale; S.ox = ox; S.oy = oy; S.dpr = dpr;
      S.view = { x: -ox / scale, y: -oy / scale, w: cw / scale, h: ch / scale };
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      if (S.onResize) S.onResize();
    }
    S.begin = function () { ctx.setTransform(S.dpr * S.scale, 0, 0, S.dpr * S.scale, S.dpr * S.ox, S.dpr * S.oy); };
    S.toLogical = function (cx, cy) { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left - S.ox) / S.scale, y: (cy - r.top - S.oy) / S.scale }; };
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) { let lw = 0, lh = 0; new ResizeObserver(() => { if (canvas.clientWidth !== lw || canvas.clientHeight !== lh) { lw = canvas.clientWidth; lh = canvas.clientHeight; resize(); } }).observe(canvas); }
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    resize();
    S.resize = resize;
    return S;
  }

  /* ---------- input ---------- */
  const keys = new Set();
  const keyHandlers = [];
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space'].includes(e.key) || e.code === 'Space') e.preventDefault();
    if (e.repeat) { keys.add(e.code); return; }
    keys.add(e.code);
    if (overlay && overlay.classList.contains('on')) { overlayKey(e); return; }
    for (const h of keyHandlers) h(e);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  function onKey(f) { keyHandlers.push(f); }
  function pointer(S, h) {
    const c = S.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (_) { } const p = S.toLogical(e.clientX, e.clientY); h.down && h.down(p, e); });
    c.addEventListener('pointermove', e => { const p = S.toLogical(e.clientX, e.clientY); h.move && h.move(p, e); });
    const up = e => { const p = S.toLogical(e.clientX, e.clientY); h.up && h.up(p, e); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  /* ---------- loop ---------- */
  function loop(update, render) {
    let last = performance.now(), running = true;
    function frame(t) {
      let dt = (t - last) / 1000; last = t;
      if (dt > 1 / 20) dt = 1 / 20;
      if (running) update(dt);
      render();
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => { last = performance.now(); running = !document.hidden; });
    requestAnimationFrame(frame);
  }

  /* ---------- overlay UI (menus, game over, upgrade picks) ---------- */
  const ICON_ON = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>';
  let muteBtn = null, overlay = null, overlayAction = null;
  const css = `
  html,body{margin:0;height:100%;overflow:hidden;background:#0b0b16;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,sans-serif;
    -webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
  canvas{display:block;width:100vw;height:100vh;height:100dvh;touch-action:none}
  .dk-mute{position:fixed;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:20;width:40px;height:40px;border-radius:12px;border:0;
    background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(6px)}
  .dk-ov{position:fixed;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(6,6,16,.55);backdrop-filter:blur(3px);padding:20px}
  .dk-ov.on{display:flex;animation:dkfade .18s ease-out}
  @keyframes dkfade{from{opacity:0}to{opacity:1}}
  @keyframes dkpop{from{transform:scale(.92);opacity:0}to{transform:none;opacity:1}}
  .dk-card{max-width:360px;width:100%;text-align:center;background:linear-gradient(160deg,rgba(40,36,80,.95),rgba(20,18,44,.95));border:1px solid rgba(255,255,255,.12);
    border-radius:22px;padding:24px 22px;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:dkpop .22s ease-out}
  .dk-card h1{margin:0 0 6px;font-size:32px;letter-spacing:.5px;line-height:1.05}
  .dk-card h2{margin:0 0 8px;font-size:15px;font-weight:600;opacity:.75;text-transform:uppercase;letter-spacing:2px}
  .dk-card p{margin:8px 0;opacity:.85;font-size:15px;line-height:1.4}
  .dk-big{font-size:56px;font-weight:800;margin:4px 0;line-height:1}
  .dk-new{display:inline-block;background:#ffd23f;color:#201a00;font-weight:800;border-radius:999px;padding:4px 12px;font-size:13px;margin:4px 0;animation:dkpop .4s ease-out}
  .dk-btn{display:block;width:100%;margin-top:14px;padding:15px;border:0;border-radius:14px;font-size:18px;font-weight:800;cursor:pointer;color:#14102a;
    background:linear-gradient(180deg,#7ef9c8,#38d39f);box-shadow:0 6px 0 #1f8f68}
  .dk-btn:focus{outline:none}.dk-btn:focus-visible{outline:2px solid rgba(255,255,255,.6);outline-offset:3px}
  .dk-btn:active{transform:translateY(3px);box-shadow:0 3px 0 #1f8f68}
  .dk-btn.alt{background:rgba(255,255,255,.12);color:#fff;box-shadow:none;font-weight:700;font-size:16px}
  .dk-keys{font-size:12px;opacity:.55;margin-top:12px}
  .dk-picks{display:grid;gap:10px;margin-top:12px}
  .dk-pick{display:flex;gap:12px;align-items:center;text-align:left;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);
    color:#fff;cursor:pointer;font:inherit}
  .dk-pick:hover,.dk-pick:focus{background:rgba(255,255,255,.16);outline:none}
  .dk-pick b{display:block;font-size:16px}.dk-pick span{opacity:.75;font-size:13px}
  .dk-pick i{font-style:normal;font-size:12px;font-weight:800;min-width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:rgba(255,255,255,.18)}
  `;
  function ui() {
    if (overlay) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    muteBtn = document.createElement('button'); muteBtn.className = 'dk-mute';
    muteBtn.addEventListener('pointerdown', e => e.stopPropagation());
    muteBtn.addEventListener('click', e => { e.stopPropagation(); ensureAudio(); setMuted(!muted); });
    document.body.appendChild(muteBtn); setMuted(muted);
    overlay = document.createElement('div'); overlay.className = 'dk-ov';
    overlay.addEventListener('pointerdown', e => e.stopPropagation());
    document.body.appendChild(overlay);
  }
  function overlayKey(e) {
    {
      if (overlayAction && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); const a = overlayAction; a(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) { const b = overlay.querySelectorAll('.dk-pick')[n - 1]; if (b) b.click(); }
    }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function show(html, action) {
    ui();
    overlay.innerHTML = '<div class="dk-card">' + html + '</div>';
    overlay.classList.add('on');
    overlayAction = action ? () => { hide(); action(); } : null;
    const b = overlay.querySelector('.dk-btn');
    if (b && action) { b.addEventListener('click', overlayAction); setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (e) { } }, 30); }
  }
  function hide() { if (overlay) { overlay.classList.remove('on'); overlay.innerHTML = ''; } overlayAction = null; }
  function menu(o, onPlay) {
    const b = store.get('best', null);
    show(`<h2>Daycade</h2><h1>${esc(o.title)}</h1><p>${o.howto}</p>` +
      (b !== null && b !== 0 ? `<p>Best: <b>${esc(o.fmt ? o.fmt(b) : b)}</b></p>` : '') +
      `<button class="dk-btn">${esc(o.button || 'Play')}</button><div class="dk-keys">${o.keys || 'Space / Enter to start'}</div>`, onPlay);
  }
  function over(o, onAgain) {
    const fmt = o.fmt || (x => x);
    const lines = (o.extra || []).map(l => `<p>${l}</p>`).join('');
    const quips = o.quips || ['So close. One more?', 'You were just warming up.', 'Again. You know you want to.', 'That run had a great middle.', 'Next one is the one.'];
    show(`<h2>${esc(o.heading || 'Game over')}</h2><div class="dk-big">${esc(fmt(o.score))}</div>` +
      (o.isNew ? '<div class="dk-new">NEW BEST!</div>' : `<p>Best: <b>${esc(fmt(o.best))}</b></p>`) + lines +
      `<p style="opacity:.6">${esc(o.isNew ? 'Beat that tomorrow.' : quips[Math.floor(Math.random() * quips.length)])}</p>` +
      `<button class="dk-btn">${esc(o.button || 'Play again')}</button><div class="dk-keys">Space / Enter to retry</div>`, onAgain);
  }
  function picks(title, items, onPick) {
    show(`<h2>${esc(title)}</h2><div class="dk-picks">` + items.map((it, i) =>
      `<button class="dk-pick" data-i="${i}"><i>${i + 1}</i><div><b>${esc(it.name)}</b><span>${esc(it.desc)}</span></div></button>`).join('') + '</div>', null);
    overlay.querySelectorAll('.dk-pick').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.i; hide(); onPick(items[i], i); }));
    const f = overlay.querySelector('.dk-pick'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
  }
  function overlayOpen() { return !!(overlay && overlay.classList.contains('on')); }

  /* ---------- utils ---------- */
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  window.Kit = { GAME, store, best, audio: { tone, noise, note, ensure: ensureAudio, setMuted, get muted() { return muted; } }, sdk, stage, keys, onKey, pointer, loop, ui, menu, over, picks, hide, show, overlayOpen, rng, hashStr, lerp, clamp, esc };
  if (document.body) ui(); else document.addEventListener('DOMContentLoaded', ui);
})();
