// Armory (build 0.6): paper-doll with a live Warden render + 6 slots, total stats, a sortable/filterable
// pack grid with procedural icons, and an inspect panel with compare-vs-equipped deltas.
// Touch first: tap selects, tap the selected item again (or the button) to equip; hover only previews.
import { RARITIES, SLOTS, CORES, AFFIXES, TRAITS, COLD_OPEN } from './data.js';
import { itemName, tierOf, rarityNote, salvageValue, MAX_UPGRADE, computeStats, baseStat, powerOf, gearPower } from './items.js';
import { itemIcon, slotIcon } from './icons.js';
import { WardenPreview } from './preview.js';
import { fmt } from './util.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PREF_KEY = 'warden.inv.v1';
const DOLL_L = ['helm', 'cuirass', 'gauntlets'], DOLL_R = ['blade', 'greaves', 'mantle'];
// stat rows for the sheet and the compare deltas: [key, label, fmt, higherIsBetter]
const STATS = [
  ['dmgFinal', 'Damage', (v) => Math.round(v)],
  ['armor', 'Armor', (v) => Math.round(v)],
  ['reduction', 'Damage reduction', (v) => `${Math.round(v * 100)}%`, 100],
  ['hp', 'Health', (v) => Math.round(v)],
  ['sta', 'Stamina', (v) => Math.round(v)],
  ['crit', 'Crit chance', (v) => `${Math.round(v)}%`],
  ['critDmg', 'Crit damage', (v) => `+${Math.round(v)}%`],
  ['aspd', 'Attack speed', (v) => `+${Math.round(v)}%`],
  ['regen', 'Stamina recovery', (v) => `+${Math.round(v)}%`],
  ['leech', 'Life drain', (v) => `${Math.round(v)}%`],
  ['arc', 'Arc chance', (v) => `${Math.round(v)}%`],
  ['ember', 'Burn', (v) => `${Math.round(v)}%`],
  ['scrapPct', 'Scrap find', (v) => `+${Math.round(v)}%`],
];
const SORTS = { newest: 'Newest', rarity: 'Rarity', power: 'Power', slot: 'Slot' };

export class Armory {
  constructor(ui) {
    this.ui = ui; this.g = ui.g;
    this.sel = null; this.hover = null; this.armed = null;
    this.pref = Object.assign({ slot: 'all', rarity: -1, sort: 'newest' }, (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } })());
    this.preview = null;
  }
  savePref() { try { localStorage.setItem(PREF_KEY, JSON.stringify(this.pref)); } catch { /* ignore */ } }
  get T() { return !!this.g.touch?.on; }
  find(uid) {
    const sv = this.g.save; if (!uid) return null;
    for (const k in sv.equip) if (sv.equip[k]?.uid === uid) return { it: sv.equip[k], where: 'equip' };
    const it = sv.bag.find((x) => x.uid === uid); return it ? { it, where: 'bag' } : null;
  }
  list() {
    const sv = this.g.save, p = this.pref;
    let items = sv.bag.map((it, i) => ({ it, i }));
    if (p.slot === 'core') items = items.filter((x) => x.it.kind === 'core');
    else if (p.slot !== 'all') items = items.filter((x) => x.it.slot === p.slot);
    if (p.rarity >= 0) items = items.filter((x) => tierOf(x.it) === p.rarity);
    const slotIdx = (it) => (it.kind === 'core' ? 99 : SLOTS.findIndex((s) => s.id === it.slot));
    const pow = (it) => (it.kind === 'core' ? it.grade * 20 : powerOf(it));
    const cmp = {
      newest: (a, b) => (b.it.got || 0) - (a.it.got || 0) || b.i - a.i,
      rarity: (a, b) => tierOf(b.it) - tierOf(a.it) || pow(b.it) - pow(a.it),
      power: (a, b) => pow(b.it) - pow(a.it),
      slot: (a, b) => slotIdx(a.it) - slotIdx(b.it) || tierOf(b.it) - tierOf(a.it),
    }[p.sort] || (() => 0);
    return items.sort(cmp).map((x) => x.it);
  }
  // ---- html ------------------------------------------------------------------------------------
  html() {
    const sv = this.g.save, s = computeStats(sv);
    const cur = this.find(this.hover)?.it || this.find(this.sel)?.it;
    return `<div class="inv">
      <div class="inv-doll">
        <div class="doll-h"><div><div class="dn">Warden ${esc(sv.name)}</div><div class="muted">Level ${sv.level}${sv.trait ? ` · ${esc(TRAITS[sv.trait].name)}` : ''}</div></div>
          <div class="power" title="Gear power: item level, Temper and tier of everything you wear"><b>${gearPower(sv.equip)}</b><span>Power</span></div></div>
        <div class="doll">
          <div class="dcol">${DOLL_L.map((k) => this.slotHtml(k)).join('')}</div>
          <div class="dview" id="dollhost">${this.preview?.ok === false ? '<div class="nogl">◆</div>' : ''}<div class="dhint">${this.T ? 'Drag to turn' : 'Drag to turn'}</div></div>
          <div class="dcol">${DOLL_R.map((k) => this.slotHtml(k)).join('')}</div>
        </div>
        ${this.statsHtml(s)}
      </div>
      <div class="inv-pack">${this.toolbarHtml()}${(sv.pack || []).length ? `<div class="inv-keep" id="invkeep"><b>${esc(COLD_OPEN.fragment.name)}</b> · story item<p>${esc(COLD_OPEN.fragment.look)} ${esc(COLD_OPEN.fragment.note)}</p></div>` : ''}
        <div class="grid" id="invgrid">${this.gridHtml()}</div>
        ${this.footHtml()}
      </div>
      <div class="inv-detail" id="invdetail">${this.detailHtml(cur)}</div>
    </div>`;
  }
  slotHtml(k) {
    const it = this.g.save.equip[k], sl = SLOTS.find((s) => s.id === k);
    if (!it) return `<button class="eslot empty" data-inv="slot" data-slot="${k}">${slotIcon(k, 34)}<span class="en">${sl.name}</span></button>`;
    const r = tierOf(it);
    return `<button class="eslot r${r} ${this.sel === it.uid ? 'sel' : ''} ${this.pref.slot === k ? 'filt' : ''}" data-inv="slot" data-slot="${k}" data-item="${it.uid}" style="--rc:${RARITIES[r].color}">
      ${itemIcon(it, 38)}<span class="en"><span class="es">${sl.name}</span><span class="ei">${esc(it.name)}</span><span class="ep">${it.upgrade ? `+${it.upgrade} · ` : ''}${'◆'.repeat(it.cores.length)}${'◇'.repeat(it.sockets - it.cores.length)}</span></span>${it.fav ? '<i class="lk">🔒</i>' : ''}</button>`;
  }
  statsHtml(s) {
    const rows = STATS.filter(([k]) => ['dmgFinal', 'armor', 'hp', 'sta', 'crit', 'critDmg', 'aspd'].includes(k) || s[k]);
    return `<div class="sheet">${rows.filter(([k]) => k !== 'reduction').map(([k, l, f]) => `<div class="st"><span>${l}</span><b>${f(s[k])}</b></div>`).join('')}
      <div class="st"><span>Damage reduction</span><b>${Math.round(s.reduction * 100)}%</b></div></div>`;
  }
  toolbarHtml() {
    const p = this.pref, sv = this.g.save;
    const count = (f) => sv.bag.filter(f).length;
    const chips = [['all', 'All', count(() => true)], ...SLOTS.map((s) => [s.id, s.name === 'Synthblade' ? 'Blades' : s.name, count((x) => x.slot === s.id)]), ['core', 'Cores', count((x) => x.kind === 'core')]];
    return `<div class="tb">
      <div class="chips">${chips.map(([k, l, n]) => `<button data-inv="fslot" data-v="${k}" class="${p.slot === k ? 'on' : ''}" title="${l}">${k === 'all' ? 'All' : k === 'core' ? '<span class="ci">◆</span>' : slotIcon(k, 18)}${k === 'all' ? '' : `<span class="cl">${l}</span>`}<i>${n}</i></button>`).join('')}</div>
      <div class="tb2">
        <div class="rchips"><button data-inv="frar" data-v="-1" class="${p.rarity < 0 ? 'on' : ''}">Any tier</button>${RARITIES.map((r, i) => `<button data-inv="frar" data-v="${i}" class="rr ${p.rarity === i ? 'on' : ''}" style="--rc:${r.color}" title="${r.name}"><span></span><em>${r.name}</em></button>`).join('')}</div>
        <button class="scycle" data-inv="sort" data-v="${Object.keys(SORTS)[(Object.keys(SORTS).indexOf(p.sort) + 1) % 4]}">⇅ ${SORTS[p.sort]}</button>
        <div class="sorts"><span class="muted">Sort</span>${Object.entries(SORTS).map(([k, l]) => `<button data-inv="sort" data-v="${k}" class="${p.sort === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div></div>`;
  }
  gridHtml() {
    const items = this.list();
    if (!items.length) return `<p class="muted empty">${this.g.save.bag.length ? 'Nothing matches this filter.' : 'Your pack is empty. Abominations drop gear and Cores.'}</p>`;
    return items.map((it) => this.tileHtml(it)).join('');
  }
  tileHtml(it) {
    const r = tierOf(it), col = it.kind === 'core' ? CORES[it.core].color : RARITIES[r].color;
    const eq = it.kind === 'gear' ? this.g.save.equip[it.slot] : null;
    const better = it.kind === 'gear' && eq && powerOf(it) > powerOf(eq);
    return `<button class="tile r${r} ${this.sel === it.uid ? 'sel' : ''} ${it.seen === false ? 'new' : ''}" data-item="${it.uid}" style="--rc:${col}" title="${esc(itemName(it))}">
      ${itemIcon(it, 44)}
      ${it.kind === 'gear' && it.upgrade ? `<span class="up">+${it.upgrade}</span>` : ''}
      ${it.kind === 'gear' && it.sockets ? `<span class="pips">${'<i class="f"></i>'.repeat(it.cores.length)}${'<i></i>'.repeat(it.sockets - it.cores.length)}</span>` : ''}
      ${it.fav ? '<span class="lk">🔒</span>' : ''}${better ? '<span class="bt" title="Higher power than equipped">▲</span>' : ''}
      ${it.seen === false ? '<span class="nw">NEW</span>' : ''}</button>`;
  }
  footHtml() {
    const sv = this.g.save, junk = sv.bag.filter((x) => x.kind === 'gear' && !x.fav && x.rarity === 0);
    const v = junk.reduce((a, x) => a + salvageValue(x), 0);
    return `<div class="pfoot"><span>${sv.bag.length} item${sv.bag.length === 1 ? '' : 's'} · <b>⬢ ${fmt(sv.scrap)}</b> scrap</span>
      <button data-inv="bulk" class="${this.armed === 'bulk' ? 'danger' : ''}" ${junk.length ? '' : 'disabled'}>${this.armed === 'bulk' ? `Confirm: salvage ${junk.length} for ${v}` : `Salvage <span class="lg">unlocked </span>Base (${junk.length})`}</button>
      <button data-inv="forge" class="forge-btn">${this.g.nearForge ? 'Open <span class="lg">the </span>Forge ▸' : 'Forge<span class="lg"> &amp; Cores</span> ▸'}</button></div>`;
  }
  detailHtml(it) {
    if (!it) {
      return `<div class="insp empty"><div class="ih">Inspect</div><p class="muted">${this.T ? 'Tap an item to inspect it. Tap it again to equip.' : 'Hover an item to inspect it. Click to select it, click it again (or press Equip) to wear it.'}</p>
        <p class="muted rlegend">Rarity: ${RARITIES.map((r) => `<b style="color:${r.color}">${r.name}</b>${r.slots ? ` <span>(${r.slots} effect slot${r.slots > 1 ? 's' : ''})</span>` : ''}`).join(' · ')}. Higher tiers add stat lines. Cores fill effect slots and never change rarity.</p>
        <p class="muted">🔒 Lock an item to protect it from salvage.</p></div>`;
    }
    const sv = this.g.save, r = tierOf(it);
    if (it.kind === 'core') {
      const C = CORES[it.core];
      return `<div class="insp" style="--rc:${C.color}"><div class="ihead"><div class="iic">${itemIcon(it, 56)}</div><div><div class="iname">${esc(itemName(it))}</div><div class="itier">Core · Grade ${it.grade}</div></div></div>
        <div class="lines"><div class="ln core" style="color:${C.color}">◆ ${esc(C.desc(it.grade))}</div></div>
        <p class="muted">Install at the Forge into a free effect slot (Rare gear and above). It adds this effect; the item's rarity does not change.</p>
        ${this.actsHtml(it, false)}</div>`;
    }
    const equipped = sv.equip[it.slot]?.uid === it.uid, eq = equipped ? null : sv.equip[it.slot];
    const slotName = SLOTS.find((x) => x.id === it.slot).name;
    return `<div class="insp" style="--rc:${RARITIES[r].color}">
      <div class="ihead"><div class="iic">${itemIcon(it, 56)}</div><div><div class="iname">${esc(itemName(it))}</div>
        <div class="itier">${RARITIES[r].name} ${slotName}</div>
        <div class="muted">Item level ${it.ilvl} · Power ${powerOf(it)}${equipped ? ' · <b class="eqb">EQUIPPED</b>' : ''}</div></div></div>
      <div class="temper"><span>Temper</span><div class="tbar">${Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < it.upgrade ? 'f' : ''}"></i>`).join('')}</div><b>+${it.upgrade}/${MAX_UPGRADE}</b></div>
      <div class="lines"><div class="ln main">${baseStat(it)} ${it.slot === 'blade' ? 'damage' : 'armor'}</div>
        ${it.affixes.map((a) => `<div class="ln">${esc(AFFIXES.find((x) => x.id === a.id).label(a.v))}</div>`).join('')}</div>
      <div class="cores">${it.cores.map((c) => `<div class="ln core" style="color:${CORES[c.core].color}">◆ ${esc(itemName(c))}: ${esc(CORES[c.core].desc(c.grade))}</div>`).join('')}${'<div class="ln core empty">◇ Empty effect slot</div>'.repeat(it.sockets - it.cores.length)}</div>
      ${rarityNote(it) ? `<div class="ln xbuff">✦ ${esc(rarityNote(it))}</div>` : ''}
      ${eq ? this.compareHtml(it, eq) : ''}
      ${this.actsHtml(it, equipped)}</div>`;
  }
  compareHtml(it, eq) {
    const sv = this.g.save, a = computeStats(sv), b = computeStats({ ...sv, equip: { ...sv.equip, [it.slot]: it } });
    const rows = STATS.map(([k, l, f, mul]) => {
      const d = (b[k] - a[k]) * (mul || 1); if (Math.abs(d) < 0.5) return '';
      const v = Math.round(d);
      return `<div class="dl ${d > 0 ? 'up' : 'dn'}"><span>${l}</span><b>${d > 0 ? '▲ +' : '▼ '}${v}${['dmgFinal', 'armor', 'hp', 'sta'].includes(k) ? '' : '%'}</b><em>${f(a[k])} → ${f(b[k])}</em></div>`;
    }).join('');
    return `<div class="cmp2"><div class="ch">vs equipped <span style="color:${RARITIES[tierOf(eq)].color}">${esc(itemName(eq))}</span></div>
      <div class="sbs"><div class="sb1">${itemIcon(eq, 30)}<span>Power ${powerOf(eq)}</span></div><div class="arrow">→</div><div class="sb1">${itemIcon(it, 30)}<span>Power ${powerOf(it)}</span></div></div>
      ${rows || '<div class="muted">No change to your stats.</div>'}</div>`;
  }
  actsHtml(it, equipped) {
    const k = 'salv' + it.uid, armed = this.armed === k;
    return `<div class="iacts">
      ${it.kind === 'gear' && !equipped ? `<button data-inv="equip" data-uid="${it.uid}" class="primary">Equip</button>` : ''}
      <button data-inv="lock" data-uid="${it.uid}" class="${it.fav ? 'on' : ''}">${it.fav ? '🔒 Locked' : 'Lock'}</button>
      ${equipped ? '' : `<button data-inv="salvage" data-uid="${it.uid}" class="${armed ? 'danger' : ''}" ${it.fav ? 'disabled title="Unlock it first"' : ''}>${armed ? `Confirm +${salvageValue(it)} scrap` : `Salvage +${salvageValue(it)}`}</button>`}
      ${it.kind === 'gear' ? `<button data-inv="forge" data-uid="${it.uid}">Temper / Cores ▸</button>` : ''}
    </div>`;
  }
  // ---- lifecycle ---------------------------------------------------------------------------------
  afterRender() {
    const host = document.getElementById('dollhost'); if (!host) return;
    if (!this.preview) this.preview = new WardenPreview(this.T);
    if (this.preview.ok) { this.preview.dress(this.g.save.equip); this.preview.mount(host); }
    else if (!host.querySelector('.nogl')) host.insertAdjacentHTML('afterbegin', '<div class="nogl">◆</div>');
  }
  closed() {
    this.preview?.stop(); this.armed = null; this.hover = null;
    for (const it of this.g.save?.bag || []) it.seen = true;
  }
  renderDetail() { const d = document.getElementById('invdetail'); if (d) d.innerHTML = this.detailHtml(this.find(this.hover)?.it || this.find(this.sel)?.it); }
  onHover(uid) {
    if (this.T || uid === this.hover) return;
    this.hover = uid; const f = this.find(uid); if (f) f.it.seen = true; this.renderDetail();
  }
  // returns true if handled
  onClick(e) {
    const g = this.g, ui = this.ui;
    const b = e.target.closest('[data-inv]');
    const keepArm = b && ['salvage', 'bulk'].includes(b.dataset.inv);
    const wasArmed = this.armed; if (!keepArm) this.armed = null;
    if (b) {
      const a = b.dataset.inv, v = b.dataset.v, uid = b.dataset.uid;
      if (a === 'fslot') { this.pref.slot = v; this.savePref(); }
      else if (a === 'frar') { this.pref.rarity = +v; this.savePref(); }
      else if (a === 'sort') { this.pref.sort = v; this.savePref(); }
      else if (a === 'slot') {
        const k = b.dataset.slot, it = g.save.equip[k];
        if (it) { this.sel = it.uid; this.hover = null; }
        this.pref.slot = this.pref.slot === k ? 'all' : k; this.savePref();
      } else if (a === 'equip') { this.equip(uid); }
      else if (a === 'lock') g.toggleFav(uid);
      else if (a === 'salvage') {
        if (wasArmed !== 'salv' + uid) this.armed = 'salv' + uid;
        else { g.salvage(uid); this.armed = null; this.sel = null; this.hover = null; }
      } else if (a === 'bulk') {
        if (wasArmed !== 'bulk') this.armed = 'bulk';
        else { g.salvageMany((x) => x.kind === 'gear' && x.rarity === 0); this.armed = null; this.sel = null; }
      } else if (a === 'forge') {
        if (g.nearForge) { if (uid) ui.forgeSel = uid; ui.screen = 'forge'; ui.render(); return true; }
        ui.toast('The Forge stands on the east side of Statute Plaza. Temper gear and install Cores there.', 'gold');
        if (!g.save.flags.waveB) ui.toast('Clear the street and hold the Plaza to reach it.');
      }
      ui.render(); return true;
    }
    const tile = e.target.closest('[data-item]');
    if (tile) {
      const uid = tile.dataset.item, f = this.find(uid); if (!f) return true;
      f.it.seen = true;
      // tap/click the already-selected pack item again to equip it
      if (this.sel === uid && f.where === 'bag' && f.it.kind === 'gear') { this.equip(uid); ui.render(); return true; }
      this.sel = uid; this.hover = null; ui.render(); return true;
    }
    return false;
  }
  equip(uid) {
    const f = this.find(uid); if (!f || f.where !== 'bag' || f.it.kind !== 'gear') return;
    this.g.equip(uid); this.sel = uid; this.hover = null;
    this.ui.toast(`Equipped ${itemName(f.it)}`, 'loot', RARITIES[tierOf(f.it)].color);
  }
}
