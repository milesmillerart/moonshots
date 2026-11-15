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
