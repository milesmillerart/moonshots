// DOM UI: title, naming, dialogue, HUD, Armory, Forge, Skills, pause, changelog.
import { RARITIES, SLOTS, CORES, PERKS, BRANCHES, TIER_REQ, TRAITS } from './data.js';
import { itemLines, itemName, effectiveRarity, upgradeCost, salvageValue, MAX_UPGRADE, computeStats } from './items.js';
import { audio } from './audio.js';
import { fmt } from './util.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rc = (it) => RARITIES[effectiveRarity(it)].color;

export class UI {
  constructor(game) {
    this.g = game; this.screen = null; this.sel = null; this.forgeSel = null;
    this.hud = $('#hud'); this.panel = $('#panel'); this.dlg = $('#dialogue');
    this.panel.addEventListener('click', (e) => this.onClick(e));
    this.panel.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-item]'); if (el && this.screen === 'armory') { this.hover = el.dataset.item; this.renderDetail(); } });
    $('#title').addEventListener('click', (e) => this.onTitleClick(e));
    this.toasts = $('#toasts');
    this.lastHud = 0;
  }
  // ---- title & naming -------------------------------------------------------
  showTitle(hasSave, saveName) {
    const t = $('#title'); t.classList.remove('hidden');
    $('#menu').innerHTML = `
      ${hasSave ? `<button data-act="continue" class="primary">Continue <span class="sub">${esc(saveName)}</span></button>` : ''}
      <button data-act="new" class="${hasSave ? '' : 'primary'}">${hasSave ? 'New Warden' : 'Take the Oath'}</button>
      <button data-act="news">What's new</button>
      <button data-act="controls">Controls</button>`;
    this.hud.classList.add('hidden'); t.classList.remove('naming-on');
  }
  hideTitle() { $('#title').classList.add('hidden'); $('#title').classList.remove('naming-on'); }
  onTitleClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    audio.init(); audio.ui();
    const a = b.dataset.act;
    if (a === 'continue') this.g.continueGame();
    else if (a === 'new') {
      if (this.g.hasSave() && !confirm('Start a new Warden? Your current Warden will be lost.')) return;
      this.showNaming();
    } else if (a === 'news') this.open('news');
    else if (a === 'controls') this.open('controls');
    else if (a === 'oath') {
      const name = ($('#wname').value || '').trim().slice(0, 20) || 'Kade';
      this.g.newGame(name);
    } else if (a === 'back') this.g.toTitle();
  }
  showNaming() {
    $('#menu').innerHTML = `
      <div class="naming">
        <label for="wname">Name your Warden</label>
        <input id="wname" maxlength="20" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Kade" />
        <p class="hint">The Ninth Ward will know you by this name. A real name, a title, anything you like.</p>
        <button data-act="oath" class="primary">Take the Oath</button>
        <button data-act="back">Back</button>
      </div>`;
    if (this.g.touch?.on) $('#title').classList.add('naming-on');
    const inp = $('#wname'); inp.focus();
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('[data-act="oath"]').click(); });
  }
  // ---- dialogue -------------------------------------------------------------
  say(lines, choices = null) {
    return new Promise((resolve) => {
      let i = 0;
      const name = this.g.save?.name || 'Warden';
      const show = () => {
        const L = lines[i];
        const who = L.who === 'Warden' ? `Warden ${name}` : L.who;
        const last = i === lines.length - 1;
        this.dlg.innerHTML = `${who ? `<div class="who">${esc(who)}</div>` : ''}<div class="line ${who ? '' : 'narr'}">${esc(L.text.replaceAll('{name}', name))}</div>
          ${last && choices ? `<div class="choices">${choices.map((c, k) => `<button data-c="${k}"><span class="k">${k + 1}</span>${esc(c.label)}</button>`).join('')}</div>` : `<div class="more">${this.g.touch?.on ? 'Tap to continue' : 'Click or press Space'} ▸</div>`}`;
        this.dlg.classList.remove('hidden');
      };
      const advance = (k) => {
        if (i < lines.length - 1) { i++; show(); audio.ui(); return; }
        if (choices && k == null) return;
        cleanup(); this.dlg.classList.add('hidden'); audio.ui(); resolve(k);
      };
      const onKey = (e) => {
        if (choices && i === lines.length - 1) { const n = parseInt(e.key, 10); if (n >= 1 && n <= choices.length) advance(n - 1); return; }
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); advance(); }
      };
      const onClick = (e) => { const b = e.target.closest('[data-c]'); if (b) advance(+b.dataset.c); else if (!choices || i < lines.length - 1) advance(); };
      const cleanup = () => { removeEventListener('keydown', onKey, true); this.dlg.removeEventListener('click', onClick); this.g.dialogueOpen = false; };
      this.g.dialogueOpen = true;
      addEventListener('keydown', onKey, true); this.dlg.addEventListener('click', onClick);
      this.g.debugAdvance = advance;
      show();
    });
  }
  // ---- HUD ------------------------------------------------------------------
  showHud() { this.hud.classList.remove('hidden'); }
  updateHud() {
    const g = this.g, p = g.player, s = g.stats, sv = g.save;
    if (!p) return;
    const pct = (a, b) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;
    $('#hp-fill').style.width = pct(p.hp, s.hp); $('#hp-txt').textContent = `${Math.ceil(p.hp)} / ${s.hp}`;
    $('#sta-fill').style.width = pct(p.sta, s.sta);
    $('#chg-fill').style.width = pct(p.charge, 100);
    $('#chg').classList.toggle('ready', g.perk('overload') && p.charge >= g.overloadCost());
    $('#chg').classList.toggle('locked', !g.perk('overload'));
    const now = performance.now();
    if (now - this.lastHud > 150) {
      this.lastHud = now;
      $('#pname').textContent = `Warden ${sv.name}`;
      $('#plevel').textContent = `Level ${sv.level}`;
      $('#xp-fill').style.width = pct(sv.xp, g.xpNeed());
      $('#scrap').textContent = fmt(sv.scrap);
      $('#stims').textContent = sv.stims;
      const T = !!g.touch?.on;
      $('#pts').textContent = sv.points ? `${sv.points} skill point${sv.points > 1 ? 's' : ''}${T ? '' : ' [K]'}` : '';
      $('#objective').innerHTML = g.objective || '';
      const b = g.boss && !g.boss.dead && g.boss.aggro ? g.boss : null;
      $('#boss').classList.toggle('hidden', !b);
      if (b) { $('#boss-fill').style.width = pct(b.hp, b.maxHp); $('#boss-name').textContent = b.def.name; }
      const pr = T ? (g.prompt || '').replace('[E] ', 'Tap USE: ') : g.prompt || '';
      $('#prompt').textContent = pr; $('#prompt').classList.toggle('hidden', !g.prompt);
      $('#lock').classList.toggle('hidden', !g.lockTarget);
      if (T) g.touch.update();
    }
  }
  toast(text, cls = '', color) {
    const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text;
    if (color) el.style.borderLeftColor = color, el.style.color = color;
    this.toasts.prepend(el);
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3200);
    while (this.toasts.children.length > 6) this.toasts.lastChild.remove();
  }
  banner(title, sub = '') {
    const b = $('#banner'); b.innerHTML = `<div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  hurtFlash(k) { const v = $('#vignette'); v.style.opacity = String(Math.min(1, 0.35 + k)); setTimeout(() => (v.style.opacity = '0'), 160); }

  // ---- panels ---------------------------------------------------------------
  get isOpen() { return !!this.screen; }
  open(name) {
    this.screen = name; this.panel.classList.remove('hidden'); this.sel = null; this.hover = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.render(); audio.ui();
  }
  close() { this.screen = null; this.panel.classList.add('hidden'); this.panel.innerHTML = ''; audio.ui(); this.g.onPanelClosed(); }
  toggle(name) { if (this.screen === name) this.close(); else this.open(name); }
  tabs() {
    const T = !!this.g.touch?.on;
    const t = [['armory', T ? 'Armory' : 'Armory [I]'], ['skills', T ? 'Skills' : 'Skills [K]']];
    if (this.g.nearForge) t.push(['forge', T ? 'Forge' : 'Forge [E]']);
    return `<div class="tabs">${t.map(([k, l]) => `<button data-tab="${k}" class="${this.screen === k ? 'on' : ''}">${l}</button>`).join('')}<button data-act="close" class="x">✕</button></div>`;
  }
  render() {
    const s = this.screen; if (!s) return;
    if (s === 'armory') this.panel.innerHTML = this.tabs() + this.armoryHtml();
    else if (s === 'skills') this.panel.innerHTML = this.tabs() + this.skillsHtml();
    else if (s === 'forge') this.panel.innerHTML = this.tabs() + this.forgeHtml();
    else if (s === 'pause') this.panel.innerHTML = this.pauseHtml();
    else if (s === 'news') this.panel.innerHTML = this.newsHtml();
    else if (s === 'controls') this.panel.innerHTML = this.controlsHtml();
    else if (s === 'dead') this.panel.innerHTML = `<div class="card center"><h2 class="red">You have fallen</h2><p>The Ward endures. The forge-wardens drag you back to the Plaza.</p><button data-act="respawn" class="primary">Rise, Warden</button></div>`;
    this.panel.className = 'panel ' + s;
  }
  itemCard(it, where) {
    const r = effectiveRarity(it);
    const icon = it.kind === 'core' ? '◆' : SLOTS.find((x) => x.id === it.slot).icon;
    const col = it.kind === 'core' ? CORES[it.core].color : rc(it);
    return `<div class="item r${r} ${this.sel === it.uid || this.forgeSel === it.uid ? 'sel' : ''}" data-item="${it.uid}" data-where="${where}" style="--rc:${col}">
      <span class="ic">${icon}</span><span class="nm">${esc(itemName(it))}</span>
      ${it.kind === 'gear' ? `<span class="sk">${'◆'.repeat(it.cores.length)}${'◇'.repeat(it.sockets - it.cores.length)}</span>` : ''}</div>`;
  }
  findItem(uid) {
    const sv = this.g.save;
    for (const k in sv.equip) if (sv.equip[k]?.uid === uid) return { it: sv.equip[k], where: 'equip' };
    const it = sv.bag.find((x) => x.uid === uid); return it ? { it, where: 'bag' } : null;
  }
  detailHtml(it, actions = true) {
    if (!it) return '<div class="detail empty">Hover or select an item.</div>';
    const r = effectiveRarity(it);
    const col = it.kind === 'core' ? CORES[it.core].color : rc(it);
    const sv = this.g.save;
    const equipped = it.kind === 'gear' && sv.equip[it.slot]?.uid === it.uid;
    const cmp = it.kind === 'gear' && !equipped ? sv.equip[it.slot] : null;
    return `<div class="detail" style="--rc:${col}">
      <div class="dn">${esc(itemName(it))}</div>
      <div class="dr">${it.kind === 'core' ? 'Core' : `${RARITIES[r].name} ${SLOTS.find((x) => x.id === it.slot).name}`}${it.kind === 'gear' && r !== it.rarity ? ` <span class="muted">(base ${RARITIES[it.rarity].name}, raised by Cores)</span>` : ''}</div>
      ${it.kind === 'gear' ? `<div class="muted">Item level ${it.ilvl} · Upgrade +${it.upgrade}/${MAX_UPGRADE}</div>` : ''}
      <ul>${itemLines(it).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      ${it.kind === 'gear' ? `<div class="cores">${it.cores.map((c) => `<div class="core" style="color:${CORES[c.core].color}">◆ ${esc(itemName(c))}: ${esc(CORES[c.core].desc(c.grade))}</div>`).join('')}${'<div class="core empty">◇ Empty socket</div>'.repeat(it.sockets - it.cores.length)}</div>` : ''}
      ${cmp ? `<div class="cmp">Equipped: ${esc(itemName(cmp))} · ${esc(itemLines(cmp)[0])}</div>` : ''}
      ${actions ? `<div class="acts">
        ${it.kind === 'gear' && !equipped ? `<button data-act="equip" data-uid="${it.uid}" class="primary">Equip</button>` : ''}
        ${!equipped ? `<button data-act="salvage" data-uid="${it.uid}">Salvage (+${salvageValue(it)} scrap)</button>` : ''}
        ${it.kind === 'core' ? '<div class="muted">Install Cores at the Forge.</div>' : ''}
      </div>` : ''}
    </div>`;
  }
  statsHtml() {
    const s = computeStats(this.g.save);
    const t = this.g.save.trait;
    return `<div class="stats">
      <div><b>${Math.round(s.dmgFinal)}</b> damage</div><div><b>${s.armor}</b> armor (${Math.round(s.reduction * 100)}% reduction)</div>
      <div><b>${s.hp}</b> health</div><div><b>${s.sta}</b> stamina</div><div><b>${s.crit}%</b> crit · +${s.critDmg}% crit dmg</div>
      <div><b>+${s.aspd}%</b> attack speed</div>
      ${s.leech ? `<div><b>${s.leech}%</b> life drain</div>` : ''}${s.arc ? `<div><b>${s.arc}%</b> arc chance</div>` : ''}${s.ember ? `<div><b>${s.ember}%</b> burn</div>` : ''}
      ${t ? `<div class="trait">Verdict trait: <b>${TRAITS[t].name}</b>. ${TRAITS[t].desc}</div>` : ''}
    </div>`;
  }
  armoryHtml() {
    const sv = this.g.save;
    const cur = this.findItem(this.sel || this.hover)?.it;
    return `<div class="cols3">
      <div class="col"><h3>Equipped</h3>${SLOTS.map((sl) => `<div class="slot"><span class="sl">${sl.name}</span>${sv.equip[sl.id] ? this.itemCard(sv.equip[sl.id], 'equip') : '<div class="item none">Empty</div>'}</div>`).join('')}${this.statsHtml()}</div>
      <div class="col"><h3>Pack <span class="muted">${sv.bag.length} items · ${fmt(sv.scrap)} scrap</span></h3><div class="bag">${sv.bag.length ? sv.bag.map((it) => this.itemCard(it, 'bag')).join('') : '<p class="muted">Nothing yet. Abominations drop gear and Cores.</p>'}</div>
        <div class="legend">${RARITIES.map((r) => `<span style="color:${r.color}">■ ${r.name}</span>`).join(' ')}</div></div>
      <div class="col" id="detail">${this.detailHtml(cur)}</div></div>`;
  }
  renderDetail() { const d = $('#detail'); if (d) d.innerHTML = this.detailHtml(this.findItem(this.sel || this.hover)?.it); }
  forgeHtml() {
    const sv = this.g.save;
    const all = [...SLOTS.map((s) => sv.equip[s.id]).filter(Boolean), ...sv.bag.filter((x) => x.kind === 'gear')];
    const cores = sv.bag.filter((x) => x.kind === 'core');
    const it = all.find((x) => x.uid === this.forgeSel) || all[0];
    if (it) this.forgeSel = it.uid;
    const cost = it ? upgradeCost(it) : 0;
    const free = it ? it.sockets - it.cores.length : 0;
    return `<div class="cols3">
      <div class="col"><h3>Choose gear</h3><div class="bag">${all.map((x) => this.itemCard(x, sv.equip[x.slot]?.uid === x.uid ? 'equip' : 'bag')).join('')}</div></div>
      <div class="col">${this.detailHtml(it, false)}
        <div class="forge-acts">
          <h3>Temper</h3>
          ${it.upgrade >= MAX_UPGRADE ? '<p class="muted">Fully tempered.</p>' : `<button data-act="upgrade" class="primary" ${sv.scrap < cost ? 'disabled' : ''}>Temper to +${it.upgrade + 1} · ${fmt(cost)} scrap</button><p class="muted">+10% base ${it.slot === 'blade' ? 'damage' : 'armor'} per level.</p>`}
          <p class="muted">You have ${fmt(sv.scrap)} scrap. Stims refilled: ${sv.stims}/3.</p>
        </div></div>
      <div class="col"><h3>Install a Core <span class="muted">${free} free socket${free === 1 ? '' : 's'}</span></h3>
        <p class="muted">Each Core adds its effect and raises the item one rarity tier. Installed Cores are permanent (extract to break them for scrap).</p>
        <div class="bag">${cores.length ? cores.map((c) => `<div class="item core-pick" style="--rc:${CORES[c.core].color}"><span class="ic">◆</span><span class="nm">${esc(itemName(c))}<br><small>${esc(CORES[c.core].desc(c.grade))}</small></span><button data-act="socket" data-uid="${c.uid}" ${free ? '' : 'disabled'}>Install</button></div>`).join('') : '<p class="muted">No Cores in your pack.</p>'}</div>
        ${it.cores.length ? `<h3>Installed</h3>${it.cores.map((c, i) => `<div class="core" style="color:${CORES[c.core].color}">◆ ${esc(itemName(c))} <button data-act="extract" data-i="${i}">Break (+${5 * c.grade} scrap)</button></div>`).join('')}` : ''}
      </div></div>`;
  }
  skillsHtml() {
    const g = this.g, sv = g.save;
    return `<div class="skills-head"><div>Level ${sv.level} · <b class="${sv.points ? 'gold' : ''}">${sv.points}</b> point${sv.points === 1 ? '' : 's'} to spend</div><div class="muted">One point per level. Deeper perks open as you invest in a branch.</div></div>
      <div class="tree">${BRANCHES.map((b) => {
        const spent = PERKS.filter((p) => p.branch === b.id).reduce((a, p) => a + (sv.perks[p.id] || 0), 0);
        return `<div class="branch" style="--bc:${b.color}"><h3>${b.name}</h3><div class="muted">${b.sub} · ${spent} spent</div>
          ${PERKS.filter((p) => p.branch === b.id).map((p) => {
            const r = sv.perks[p.id] || 0, open = spent >= TIER_REQ[p.tier], can = open && r < p.max && sv.points > 0;
            return `<div class="perk ${r ? 'has' : ''} ${open ? '' : 'locked'} ${r >= p.max ? 'max' : ''}">
              <div class="pn">${p.name} <span class="rk">${r}/${p.max}</span></div>
              <div class="pd">${esc(p.desc(Math.max(1, r)))}</div>
              ${open ? '' : `<div class="req">Needs ${TIER_REQ[p.tier]} points in ${b.name}</div>`}
              <button data-act="perk" data-id="${p.id}" ${can ? '' : 'disabled'}>${r >= p.max ? 'Mastered' : 'Learn'}</button></div>`;
          }).join('<div class="link"></div>')}</div>`;
      }).join('')}</div>`;
  }
  pauseHtml() {
    const st = this.g.settings, T = !!this.g.touch?.on;
    return `<div class="card center"><h2>Paused</h2>
      <button data-act="resume" class="primary">Resume</button>
      <button data-tab="armory">Armory</button><button data-tab="skills">Skills</button>
      <button data-tab="news">What's new</button><button data-tab="controls">Controls</button>
      <div class="settings">
        <label><input type="checkbox" data-set="bloom" ${st.bloom ? 'checked' : ''}> Bloom glow</label>
        <label><input type="checkbox" data-set="shadows" ${st.shadows ? 'checked' : ''}> Shadows (reload)</label>
        <label><input type="checkbox" data-set="invertY" ${st.invertY ? 'checked' : ''}> Invert ${T ? 'look' : 'mouse'} Y</label>
        <label><input type="checkbox" data-set="mute" ${audio.muted ? 'checked' : ''}> Mute${T ? '' : ' [M]'}</label>
        <label>${T ? 'Look' : 'Mouse'} sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${st.sens}" data-set="sens"></label>
        <label>Render scale <input type="range" min="0.5" max="1.5" step="0.05" value="${st.scale}" data-set="scale"></label>
      </div>
      ${T && document.fullscreenEnabled ? `<button data-act="fullscreen">${document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'}</button>` : ''}
      <button data-act="title">Save and quit to title</button></div>`;
  }
  newsHtml() {
    const log = this.g.changelog || [];
    return `<div class="card news"><div class="tabs"><b>What's new in Warden</b><button data-act="close" class="x">✕</button></div>
      <p class="muted">Warden is improved every day. Here is what changed.</p>
      ${log.map((e) => `<div class="entry"><div class="ed">${esc(e.date)} · build ${esc(e.build)}</div><h4>${esc(e.title)}</h4><ul>${e.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>`;
  }
  controlsHtml() {
    if (this.g.touch?.on) {
      const tr = [['Left thumb', 'Move (push to the edge to sprint)'], ['Drag right side', 'Look around'], ['Tap right side / STRIKE', 'Light strike (hold STRIKE to keep the combo going)'], ['HEAVY', 'Heavy strike'], ['ROLL', 'Dodge roll (roll through an attack at the last instant for a Riposte)'], ['LOCK', 'Lock on to the nearest enemy'], ['STIM', 'Inject a stim (heal)'], ['OVERLOAD', 'Shock nova (Circuit perk)'], ['USE / FORGE', 'Appears near the Forge or a cache'], ['ARMORY · SKILLS · ❚❚', 'Gear, perks and pause (top right)']];
      return `<div class="card"><div class="tabs"><b>Touch controls</b><button data-act="close" class="x">✕</button></div><table class="ctl">${tr.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table><p class="muted">Play in landscape. Keyboard and mouse also work.</p></div>`;
    }
    const rows = [['W A S D', 'Move'], ['Shift', 'Sprint'], ['Mouse', 'Look (click the game to capture the mouse)'], ['Left click', 'Light strike (chain three for a combo)'], ['Right click', 'Heavy strike'], ['Space', 'Dodge roll (brief invulnerability)'], ['Q', 'Lock on to the nearest enemy'], ['R', 'Inject a stim (heal)'], ['F', 'Overload (Circuit perk)'], ['E', 'Interact / use the Forge'], ['I or Tab', 'Armory'], ['K', 'Skills'], ['Esc', 'Pause'], ['M', 'Mute']];
    return `<div class="card"><div class="tabs"><b>Controls</b><button data-act="close" class="x">✕</button></div><table class="ctl">${rows.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table></div>`;
  }
  onClick(e) {
    const g = this.g;
    const tab = e.target.closest('[data-tab]'); if (tab) { this.screen = tab.dataset.tab; this.sel = null; this.render(); audio.ui(); return; }
    const set = e.target.closest('[data-set]');
    if (set) { g.applySetting(set.dataset.set, set.type === 'checkbox' ? set.checked : parseFloat(set.value)); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'close' || a === 'resume') { if (!g.started && (this.screen === 'news' || this.screen === 'controls')) { this.screen = null; this.panel.classList.add('hidden'); return; } this.close(); return; }
      if (a === 'equip') { g.equip(act.dataset.uid); this.sel = act.dataset.uid; }
      if (a === 'salvage') { g.salvage(act.dataset.uid); this.sel = null; }
      if (a === 'perk') g.learnPerk(act.dataset.id);
      if (a === 'upgrade') g.upgrade(this.forgeSel);
      if (a === 'socket') g.socket(this.forgeSel, act.dataset.uid);
      if (a === 'extract') g.extract(this.forgeSel, +act.dataset.i);
      if (a === 'respawn') { g.respawn(); return; }
      if (a === 'title') { g.toTitle(); return; }
      if (a === 'fullscreen') { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {}))).catch(() => {}).finally(() => setTimeout(() => this.render(), 300)); return; }
      this.render(); return;
    }
    const item = e.target.closest('[data-item]');
    if (item) {
      if (this.screen === 'forge') this.forgeSel = item.dataset.item; else this.sel = item.dataset.item;
      this.render(); audio.ui();
    }
  }
}
