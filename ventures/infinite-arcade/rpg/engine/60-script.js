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
