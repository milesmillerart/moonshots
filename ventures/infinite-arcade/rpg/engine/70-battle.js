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
