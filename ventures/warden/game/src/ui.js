// DOM UI: title, naming, dialogue, HUD, Armory, Forge, Skills, pause, changelog.
import { RARITIES, SLOTS, CORES, PERKS, BRANCHES, TIER_REQ, TRAITS } from './data.js';
import { itemLines, itemName, tierOf, rarityNote, upgradeCost, salvageValue, MAX_UPGRADE, computeStats } from './items.js';
import { audio } from './audio.js';
import { fmt } from './util.js';
import * as Save from './save.js';
import { Armory } from './inventory.js';
import { SkillTree } from './skills.js';
import { itemIcon } from './icons.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rc = (it) => RARITIES[tierOf(it)].color;

export class UI {
  constructor(game) {
    this.g = game; this.screen = null; this.sel = null; this.forgeSel = null;
    this.hud = $('#hud'); this.panel = $('#panel'); this.dlg = $('#dialogue');
    this.panel.addEventListener('click', (e) => this.onClick(e));
    this.panel.addEventListener('change', (e) => { if (e.target.id === 'impfile') this.readImportFile(e.target); if (e.target.dataset?.set === 'quality') { this.g.applySetting('quality', e.target.value); this.render(); } });
    this.armory = new Armory(this);
    this.skills = new SkillTree(this);
    this.panel.addEventListener('mouseover', (e) => {
      if (this.screen !== 'armory') return;
      const el = e.target.closest('[data-item]');
      if (el) this.armory.onHover(el.dataset.item);
      else if (this.armory.hover && !e.target.closest('#invdetail')) { this.armory.hover = null; this.armory.renderDetail(); }
    });
    $('#title').addEventListener('click', (e) => this.onTitleClick(e));
    this.toasts = $('#toasts');
    this.lastHud = 0;
  }
  // ---- title, slots & naming ------------------------------------------------
  showTitle() {
    const t = $('#title'); t.classList.remove('hidden', 'naming-on', 'slots-on');
    const slots = Save.listSlots(), last = Save.lastSlot(), any = slots.some(Boolean);
    const L = last != null ? slots[last] : null;
    $('#menu').innerHTML = `
      ${L ? `<button data-act="continue" data-slot="${last}" class="primary">Continue <span class="sub">Warden ${esc(L.name)} · Level ${L.level} · ${esc(L.area || Save.chapterOf(L))}${L.playTime >= 1 ? ` · ${Save.fmtPlay(L.playTime)}` : ''}</span></button>` : ''}
      ${any ? '<button data-act="slots">Wardens <span class="sub">Load, export or delete a save · 3 slots</span></button>' : ''}
      <button data-act="new" class="${any ? '' : 'primary'}">${any ? 'New Warden' : 'Take the Oath'}</button>
      <button data-act="import">Import save</button>
      <button data-act="news">What's new</button>
      <button data-act="controls">Controls</button>`;
    this.hud.classList.add('hidden');
  }
  // mode: 'load' (pick a Warden to play) or 'new' (pick a slot for a new Warden)
  showSlots(mode = 'load') {
    this.slotMode = mode; this.armed = null;
    const t = $('#title'); t.classList.remove('naming-on'); t.classList.add('slots-on');
    this.renderSlots();
  }
  renderSlots() {
    const mode = this.slotMode, slots = Save.listSlots();
    const tr = (s) => (s?.trait ? (TRAITS[s.trait]?.name || s.trait) : 'No verdict yet');
    const arm = (k, label, armedLabel) => (this.armed === k ? armedLabel : label);
    $('#menu').innerHTML = `<div class="slots">
      <div class="slots-h">${mode === 'new' ? 'Choose a slot for your new Warden' : 'Your Wardens'}</div>
      ${slots.map((s, n) => s ? `
        <div class="slotcard${mode === 'load' && n === Save.lastSlot() ? ' last' : ''}" data-slot="${n}">
          <div class="si"><div class="sn"><span class="no">${n + 1}</span>Warden ${esc(s.name)} <span class="lv">Lv ${s.level}</span></div>
            <div class="sd">${esc(tr(s))} · ${esc(Save.chapterOf(s))}</div>
            <div class="sd">Hallowmere · ${esc(s.area || 'Lantern Street')}${s.playTime >= 1 ? ` · played ${Save.fmtPlay(s.playTime)}` : ''} · saved ${Save.fmtAgo(s.saved)}</div></div>
          <div class="sb">${mode === 'new'
            ? `<button data-act="slot-new" data-slot="${n}" class="${this.armed === 'new' + n ? 'danger' : ''}">${arm('new' + n, 'Overwrite', 'Tap again: erase')}</button>`
            : `<button data-act="slot-play" data-slot="${n}" class="primary">Play</button><button data-act="slot-export" data-slot="${n}">Export</button><button data-act="slot-del" data-slot="${n}" class="${this.armed === 'del' + n ? 'danger' : ''}">${arm('del' + n, 'Delete', 'Tap again')}</button>`}</div>
        </div>` : `
        <div class="slotcard empty" data-slot="${n}">
          <div class="si"><div class="sn"><span class="no">${n + 1}</span>Empty slot</div><div class="sd">An oath not yet taken.</div></div>
          <div class="sb"><button data-act="slot-new" data-slot="${n}" class="${mode === 'new' ? 'primary' : ''}">New Warden</button><button data-act="slot-import" data-slot="${n}">Import</button></div>
        </div>`).join('')}
      <button data-act="back">Back</button></div>`;
  }
  hideTitle() { $('#title').classList.add('hidden'); $('#title').classList.remove('naming-on', 'slots-on'); }
  onTitleClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    audio.init(); audio.ui();
    const a = b.dataset.act, n = b.dataset.slot != null ? +b.dataset.slot : null;
    const wasArmed = this.armed; this.armed = null;
    if (a === 'continue') this.g.continueGame(n);
    else if (a === 'slots') this.showSlots('load');
    else if (a === 'new') {
      const empty = Save.firstEmpty();
      if (!Save.listSlots().some(Boolean)) this.showNaming(empty < 0 ? 0 : empty);
      else this.showSlots('new');
    } else if (a === 'slot-play') this.g.continueGame(n);
    else if (a === 'slot-new') {
      if (Save.readSlot(n) && wasArmed !== 'new' + n) { this.armed = 'new' + n; this.renderSlots(); return; }
      this.showNaming(n);
    } else if (a === 'slot-del') {
      if (wasArmed !== 'del' + n) { this.armed = 'del' + n; this.renderSlots(); return; }
      Save.deleteSlot(n); this.toast(`Slot ${n + 1} deleted`);
      if (Save.listSlots().some(Boolean)) this.renderSlots(); else this.showTitle();
    } else if (a === 'slot-export') { this.exportSave = Save.readSlot(n); this.exportSlot = n; this.open('export'); }
    else if (a === 'slot-import' || a === 'import') { this.openImport(a === 'import' ? null : n); }
    else if (a === 'news') this.open('news');
    else if (a === 'controls') this.open('controls');
    else if (a === 'oath') {
      const name = ($('#wname').value || '').trim().slice(0, 20) || 'Kade';
      this.g.newGame(name, this.nameSlot ?? 0);
    } else if (a === 'back') { if ($('#title').classList.contains('slots-on') || !Save.listSlots().some(Boolean)) this.showTitle(); else this.showSlots(this.slotMode || 'load'); }
    else if (this.slotMode && $('#title').classList.contains('slots-on')) this.renderSlots();
  }
  showNaming(slot = 0) {
    this.nameSlot = slot;
    $('#title').classList.remove('slots-on');
    $('#menu').innerHTML = `
      <div class="naming">
        <label for="wname">Name your Warden <span class="muted">· slot ${slot + 1}</span></label>
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
  // small "Saved" mark under the HUD block
  savedFlash(text = 'Saved') {
    const el = $('#saved'); if (!el) return;
    el.querySelector('span').textContent = text;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this.savedT); this.savedT = setTimeout(() => el.classList.remove('on'), 1800);
    if (this.screen === 'pause') this.render();
  }
  hurtFlash(k) { const v = $('#vignette'); v.style.opacity = String(Math.min(1, 0.35 + k)); setTimeout(() => (v.style.opacity = '0'), 160); }

  // ---- panels ---------------------------------------------------------------
  get isOpen() { return !!this.screen; }
  open(name) {
    this.screen = name; this.panel.classList.remove('hidden'); this.sel = null; this.hover = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.render(); audio.ui();
  }
  close() { if (this.screen === 'armory') this.armory.closed(); this.screen = null; this.panel.classList.add('hidden'); this.panel.innerHTML = ''; audio.ui(); this.g.onPanelClosed(); if (this.g.touch?.on) this.g.touch.update(); }
  toggle(name) { if (this.screen === name) this.close(); else this.open(name); }
  tabs() {
    const T = !!this.g.touch?.on;
    const t = [['armory', T ? 'Armory' : 'Armory [I]'], ['skills', T ? 'Skills' : 'Skills [K]']];
    if (this.g.nearForge) t.push(['forge', T ? 'Forge' : 'Forge [E]']);
    return `<div class="tabs">${t.map(([k, l]) => `<button data-tab="${k}" class="${this.screen === k ? 'on' : ''}">${l}</button>`).join('')}<button data-act="close" class="x">✕</button></div>`;
  }
  render() {
    const s = this.screen; if (!s) return;
    if (s !== 'armory') this.armory.preview?.stop();
    if (s === 'armory') this.panel.innerHTML = this.tabs() + this.armory.html();
    else if (s === 'skills') this.panel.innerHTML = this.tabs() + this.skills.html();
    else if (s === 'forge') this.panel.innerHTML = this.tabs() + this.forgeHtml();
    else if (s === 'pause') this.panel.innerHTML = this.pauseHtml();
    else if (s === 'news') this.panel.innerHTML = this.newsHtml();
    else if (s === 'controls') this.panel.innerHTML = this.controlsHtml();
    else if (s === 'export') this.panel.innerHTML = this.exportHtml();
    else if (s === 'import') this.panel.innerHTML = this.importHtml();
    else if (s === 'dead') this.panel.innerHTML = `<div class="card center defeat"><h2 class="red">Defeated</h2><p>Your journey resumes from the last synchronization point, Statute Plaza. Your gear, levels and progress are kept.</p><button data-act="respawn" class="primary">Resume from checkpoint</button></div>`;
    this.panel.className = 'panel ' + s;
    if (s === 'armory') this.armory.afterRender();
    if (s === 'skills') this.skills.afterRender();
  }
  itemCard(it, where) {
    const r = tierOf(it);
    const col = it.kind === 'core' ? CORES[it.core].color : rc(it);
    return `<div class="item r${r} ${this.sel === it.uid || this.forgeSel === it.uid ? 'sel' : ''}" data-item="${it.uid}" data-where="${where}" style="--rc:${col}">
      <span class="ic">${itemIcon(it, 26)}</span><span class="nm">${esc(itemName(it))}</span>
      ${it.kind === 'gear' ? `<span class="sk">${'◆'.repeat(it.cores.length)}${'◇'.repeat(it.sockets - it.cores.length)}</span>` : ''}</div>`;
  }
  findItem(uid) {
    const sv = this.g.save;
    for (const k in sv.equip) if (sv.equip[k]?.uid === uid) return { it: sv.equip[k], where: 'equip' };
    const it = sv.bag.find((x) => x.uid === uid); return it ? { it, where: 'bag' } : null;
  }
  detailHtml(it, actions = true) {
    if (!it) return '<div class="detail empty">Hover or select an item.</div>';
    const r = tierOf(it);
    const col = it.kind === 'core' ? CORES[it.core].color : rc(it);
    const sv = this.g.save;
    const equipped = it.kind === 'gear' && sv.equip[it.slot]?.uid === it.uid;
    const cmp = it.kind === 'gear' && !equipped ? sv.equip[it.slot] : null;
    return `<div class="detail" style="--rc:${col}">
      <div class="dn">${esc(itemName(it))}</div>
      <div class="dr">${it.kind === 'core' ? 'Core' : `${RARITIES[r].name} ${SLOTS.find((x) => x.id === it.slot).name}`}</div>
      ${rarityNote(it) ? `<div class="muted xbuff">${esc(rarityNote(it))}</div>` : ''}
      ${it.kind === 'gear' ? `<div class="muted">Item level ${it.ilvl} · Upgrade +${it.upgrade}/${MAX_UPGRADE}</div>` : ''}
      <ul>${itemLines(it).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      ${it.kind === 'gear' ? `<div class="cores">${it.cores.map((c) => `<div class="core" style="color:${CORES[c.core].color}">◆ ${esc(itemName(c))}: ${esc(CORES[c.core].desc(c.grade))}</div>`).join('')}${'<div class="core empty">◇ Empty effect slot</div>'.repeat(it.sockets - it.cores.length)}</div>` : ''}
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
      <div class="col"><h3>Install a Core <span class="muted">${free} free effect slot${free === 1 ? '' : 's'}</span></h3>
        <p class="muted">${it && !it.sockets ? 'Base and Uncommon gear has no effect slots. Rare has 1, Legendary 2, Exalted 3.' : 'A Core adds its effect in one of the item\'s effect slots. It does not change the item\'s rarity.'} Installed Cores are permanent (break them for scrap).</p>
        <div class="bag">${cores.length ? cores.map((c) => `<div class="item core-pick" style="--rc:${CORES[c.core].color}"><span class="ic">◆</span><span class="nm">${esc(itemName(c))}<br><small>${esc(CORES[c.core].desc(c.grade))}</small></span><button data-act="socket" data-uid="${c.uid}" ${free ? '' : 'disabled'}>Install</button></div>`).join('') : '<p class="muted">No Cores in your pack.</p>'}</div>
        ${it.cores.length ? `<h3>Installed</h3>${it.cores.map((c, i) => `<div class="core" style="color:${CORES[c.core].color}">◆ ${esc(itemName(c))} <button data-act="extract" data-i="${i}">Break (+${5 * c.grade} scrap)</button></div>`).join('')}` : ''}
      </div></div>`;
  }
  pauseHtml() {
    const st = this.g.settings, T = !!this.g.touch?.on;
    const g = this.g, sv = g.save;
    return `<div class="card center pause-card"><h2>Paused</h2>
      <div class="savebox"><div class="ss">Slot ${(g.slot ?? 0) + 1} · Warden ${esc(sv?.name || '')} · Lv ${sv?.level || 1}<br><span class="muted">Played ${Save.fmtPlay(sv?.playTime)} · last saved ${Save.fmtAgo(g.lastSaved)} · autosaves as you play</span></div>
        <div class="sbtn"><button data-act="savenow" class="${this.justSaved ? 'ok' : ''}">${this.justSaved ? 'Saved ✓' : 'Save now'}</button><button data-act="export">Export save</button></div></div>
      <div class="pc"><div class="pc-l">
      <button data-act="resume" class="primary">Resume</button>
      <div class="pnav"><button data-tab="armory">Armory</button><button data-tab="skills">Skills</button>
      <button data-tab="news">What's new</button><button data-tab="controls">Controls</button></div>
      <button data-act="title" class="quit">Save and quit to title</button></div>
      <div class="pc-r"><div class="settings">
        <label><input type="checkbox" data-set="bloom" ${st.bloom ? 'checked' : ''}> Bloom glow</label>
        <label><input type="checkbox" data-set="shadows" ${st.shadows ? 'checked' : ''}> Shadows (reload)</label>
        <label><input type="checkbox" data-set="invertY" ${st.invertY ? 'checked' : ''}> Invert ${T ? 'look' : 'mouse'} Y</label>
        <label><input type="checkbox" data-set="mute" ${audio.muted ? 'checked' : ''}> Mute${T ? '' : ' [M]'}</label>
        <label>${T ? 'Look' : 'Mouse'} sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${st.sens}" data-set="sens"></label>
        <label>Render scale <input type="range" min="0.5" max="1.5" step="0.05" value="${st.scale}" data-set="scale"></label>
        <label>Graphics <select data-set="quality">${Object.values(g.tiers).map((t) => `<option value="${t.name}" ${st.quality === t.name ? 'selected' : ''}>${t.label}</option>`).join('')}</select>${st.quality !== g.tierNow ? ' <b class="gold">reload to apply</b>' : ''}</label>
      </div>
      ${T && document.fullscreenEnabled ? `<button data-act="fullscreen">${document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'}</button>` : ''}
      </div></div></div>`;
  }
  // ---- export / import ------------------------------------------------------
  exportHtml() {
    const sv = this.exportSave; if (!sv) return '<div class="card center"><p>No save to export.</p><button data-act="close">Close</button></div>';
    const code = Save.exportCode(sv);
    this.exportText = code;
    return `<div class="card xfer"><div class="tabs"><b>Export save · Warden ${esc(sv.name)}</b><button data-act="close" class="x">✕</button></div>
      <p class="muted">This code is your whole Warden: level, gear, Temper, Cores, perks, verdict and progress. Keep it in a notes app or email it to yourself. On any device, open Warden and choose <b>Import save</b> to bring this Warden back, even after clearing browser data.</p>
      <textarea id="expcode" readonly spellcheck="false">${esc(code)}</textarea>
      <div class="xb"><button data-act="copy" class="primary">${this.copied ? 'Copied ✓' : 'Copy code'}</button><button data-act="download">Download save file</button><button data-act="close">Done</button></div>
      <p class="muted">Level ${sv.level} · ${esc(Save.chapterOf(sv))} · played ${Save.fmtPlay(sv.playTime)} · ${code.length.toLocaleString()} characters</p></div>`;
  }
  openImport(slot) {
    const empty = Save.firstEmpty();
    this.importSlot = slot ?? (empty < 0 ? null : empty); this.importErr = ''; this.importText = ''; this.armed = null;
    this.open('import');
  }
  importHtml() {
    const slots = Save.listSlots();
    return `<div class="card xfer"><div class="tabs"><b>Import save</b><button data-act="close" class="x">✕</button></div>
      <p class="muted">Paste a Warden save code, or choose a save file you downloaded.</p>
      <textarea id="impcode" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="WARDEN-SAVE.2....">${esc(this.importText || '')}</textarea>
      <label class="filepick"><input type="file" id="impfile" accept=".txt,.json,.wsave,text/plain,application/json"><span>Choose save file…</span></label>
      <div class="impslots"><span class="muted">Import into:</span>${slots.map((s, n) => `<button data-act="impslot" data-slot="${n}" class="${this.importSlot === n ? 'on' : ''}">${n + 1}: ${s ? `${esc(s.name)} Lv ${s.level}` : 'Empty'}</button>`).join('')}</div>
      ${this.importErr ? `<div class="err">${esc(this.importErr)}</div>` : ''}
      <div class="xb"><button data-act="doimport" class="primary ${this.armed === 'imp' ? 'danger' : ''}" ${this.importSlot == null ? 'disabled' : ''}>${this.armed === 'imp' ? `Tap again: replace slot ${this.importSlot + 1}` : 'Import'}</button><button data-act="close">Cancel</button></div></div>`;
  }
  readImportFile(input) {
    const f = input.files?.[0]; if (!f) return;
    if (f.size > 2e6) { this.importErr = 'That file is too large to be a Warden save.'; this.render(); return; }
    f.text().then((t) => { this.importText = t.trim(); this.importErr = ''; this.render(); }).catch(() => { this.importErr = 'Could not read that file.'; this.render(); });
  }
  doImport() {
    const ta = $('#impcode'); if (ta) this.importText = ta.value;
    let sv;
    try { sv = Save.importCode(this.importText); } catch (err) { this.importErr = err.message; this.armed = null; this.render(); return false; }
    const n = this.importSlot; if (n == null) return false;
    if (Save.readSlot(n) && this.armed !== 'imp') { this.armed = 'imp'; this.importErr = ''; this.render(); return false; }
    sv.saved = Date.now();
    if (!Save.writeSlot(n, sv)) { this.importErr = 'Could not write the save: browser storage is full or blocked.'; this.render(); return false; }
    this.armed = null; this.screen = null; this.panel.classList.add('hidden'); this.panel.innerHTML = '';
    this.toast(`Imported Warden ${sv.name} (Lv ${sv.level}) into slot ${n + 1}`, 'gold');
    this.showSlots('load');
    return true;
  }
  download() {
    const sv = this.exportSave; if (!sv) return;
    const blob = new Blob([this.exportText + '\n'], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `warden-${(sv.name || 'save').replace(/[^\w-]+/g, '_')}-lv${sv.level}-${new Date().toISOString().slice(0, 10)}.wsave.txt`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  copy() {
    const done = () => { this.copied = true; this.render(); setTimeout(() => { this.copied = false; if (this.screen === 'export') this.render(); }, 2000); };
    const fallback = () => { const ta = $('#expcode'); if (!ta) return; ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); try { document.execCommand('copy'); done(); } catch { this.toast('Select the code and copy it'); } };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(this.exportText).then(done, fallback); else fallback();
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
    const tab = e.target.closest('[data-tab]'); if (tab) { if (this.screen === 'armory' && tab.dataset.tab !== 'armory') this.armory.closed(); this.screen = tab.dataset.tab; this.sel = null; this.render(); audio.ui(); return; }
    if (this.screen === 'armory' && !e.target.closest('[data-act],[data-set]') && this.armory.onClick(e)) { audio.ui(); return; }
    if (this.screen === 'skills' && this.skills.onClick(e)) return;
    const set = e.target.closest('[data-set]');
    if (set && set.tagName === 'SELECT') return;
    if (set) { g.applySetting(set.dataset.set, set.type === 'checkbox' ? set.checked : parseFloat(set.value)); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'close' || a === 'resume') {
        if (!g.started && ['news', 'controls', 'export', 'import'].includes(this.screen)) { this.screen = null; this.panel.classList.add('hidden'); this.panel.innerHTML = ''; return; }
        if (g.started && this.screen === 'export') { this.open('pause'); return; }
        this.close(); return;
      }
      if (a === 'savenow') { if (g.persist('manual')) { this.justSaved = true; setTimeout(() => { this.justSaved = false; if (this.screen === 'pause') this.render(); }, 1800); } this.render(); return; }
      if (a === 'export') { g.persist(); this.exportSave = g.save; this.exportSlot = g.slot; this.copied = false; this.open('export'); return; }
      if (a === 'copy') { this.copy(); return; }
      if (a === 'download') { this.download(); return; }
      if (a === 'impslot') { const ta = $('#impcode'); if (ta) this.importText = ta.value; this.importSlot = +act.dataset.slot; this.armed = null; this.render(); return; }
      if (a === 'doimport') { this.doImport(); return; }
      if (a === 'equip') { g.equip(act.dataset.uid); this.sel = act.dataset.uid; }
      if (a === 'salvage') { g.salvage(act.dataset.uid); this.sel = null; }
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
