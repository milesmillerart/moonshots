/* Ebbmarrow engine: core utilities, input, global namespace.
   All engine files share the global `G` and are concatenated by tools/build_rpg.py. */
'use strict';
const G = (window.G = window.G || {});
G.VERSION = '__BUILD__';
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
