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
