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
