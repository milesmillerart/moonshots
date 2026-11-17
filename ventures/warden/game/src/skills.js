// Skill screen (build 0.7): a circuit-constellation graph of the three branches growing from the Warden's oath.
// SVG nodes + traces, branch tabs that zoom the view, an inspect panel with exact effects and requirements,
// and hold-to-learn (or tap the selected node again, then Confirm). Respec lives at the Forge.
import { PERKS, BRANCHES, TIER_REQ } from './data.js';
import { audio } from './audio.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const VB = { all: [0, 0, 1020, 660] };
const ROWS = { blade: 135, bulwark: 335, circuit: 535 };
const COLS = [255, 425, 595, 765, 935];
const ZIG = [0, -16, 12, -14, 0];
const ROOT = [88, 335];
for (const b of BRANCHES) VB[b.id] = [150, ROWS[b.id] - 120, 860, 245];
const HOLD_MS = 650;

// Exact effect per rank (keeps data.js balance; numbers mirror items.js / game.js / player.js).
const EFFECT = {
  keen_edge: (r) => `+${8 * r}% damage`,
  momentum: () => 'Combo finisher (3rd light strike) +60% damage',
  cleave: () => 'Heavy strikes hit every enemy in reach, all around you',
  executioner: (r) => `+${25 * r}% damage to enemies under 35% health`,
  verdict: () => 'Each kill: +25 stamina, +4% max health',
  plated: (r) => `+${15 * r} max health`,
  second_wind: (r) => `+${20 * r}% stamina recovery`,
  quickstep: () => 'Dodge costs 15 stamina instead of 22 and rolls 19% further',
  iron_resolve: (r) => `${12 * r}% less damage taken while attacking`,
  last_rites: () => 'A killing blow leaves you at 1 health (90 s cooldown)',
  capacitor: (r) => `+${35 * r}% Charge per hit`,
  overload: () => 'OVERLOAD [F]: spend 100 Charge for a 6.5 m shock nova, 2.4x hit damage + stagger',
  arc_edge: (r) => `+${10 * r}% chance for hits to arc to a nearby enemy`,
  leech_protocol: () => 'Each kill restores 6% max health',
  overclock: () => '+15% attack speed; Overload costs 50 Charge',
};

// Procedural glyphs (48x48, stroked in currentColor).
const G = {
  root: '<path d="M10 30 C10 14 17 8 24 8 C31 8 38 14 38 30 L35 40 L28 41 L28 33 L20 33 L20 41 L13 40 Z" fill="none"/><path d="M15 22 H33 V25 H26 V35 H22 V25 H15 Z" fill="currentColor" stroke="none"/>',
  keen_edge: '<path d="M12 36 L33 11 L37 11 L37 15 L16 40" /><path d="M9 33 L19 43"/><path d="M38 6 L38 10 M36 8 L40 8" />',
  momentum: '<path d="M10 14 L20 24 L10 34 M20 14 L30 24 L20 34 M30 14 L40 24 L30 34"/>',
  cleave: '<path d="M8 30 A17 17 0 0 1 40 30" /><path d="M36 22 L41 31 L31 31"/><path d="M24 40 L24 22 M20 26 L28 26"/>',
  executioner: '<path d="M14 10 H34 L30 22 H18 Z" fill="currentColor" fill-opacity=".25"/><path d="M24 22 V40 M16 40 H32 M10 10 V40 M38 10 V40"/>',
  verdict: '<path d="M24 8 V40 M14 40 H34 M10 16 H38"/><path d="M10 16 L6 28 H14 Z M38 16 L34 28 H42 Z"/><circle cx="24" cy="8" r="2" fill="currentColor"/>',
  plated: '<path d="M24 6 L39 12 V24 C39 33 32 39 24 42 C16 39 9 33 9 24 V12 Z"/><path d="M24 12 V36 M15 21 H33"/>',
  second_wind: '<path d="M6 18 H28 C33 18 34 11 29 10 C25 9 24 14 26 15"/><path d="M6 26 H36 C41 26 42 33 37 34 C33 35 32 30 34 29"/><path d="M6 34 H20"/>',
  quickstep: '<path d="M22 12 L30 12 L32 30 L40 34 L40 38 L22 38 Z"/><path d="M6 18 H16 M4 26 H16 M8 34 H16"/>',
  iron_resolve: '<path d="M8 18 H36 L40 14 V22 L34 26 H28 L30 34 H16 L18 26 H12 Z"/><path d="M14 40 H34"/>',
  last_rites: '<path d="M24 6 C30 13 30 19 24 22 C18 19 18 13 24 6 Z" fill="currentColor" fill-opacity=".3"/><path d="M24 26 V42 M17 32 H31"/><path d="M14 42 H34"/>',
  capacitor: '<path d="M4 24 H18 M30 24 H44"/><path d="M18 12 V36 M30 12 V36" stroke-width="3.5"/><path d="M36 8 V16 M32 12 H40"/>',
  overload: '<circle cx="24" cy="24" r="6" fill="currentColor"/><path d="M24 4 V12 M24 36 V44 M4 24 H12 M36 24 H44 M10 10 L15 15 M33 33 L38 38 M38 10 L33 15 M10 38 L15 33"/>',
  arc_edge: '<path d="M27 4 L13 26 H23 L19 44 L35 20 H25 Z" fill="currentColor" fill-opacity=".25"/>',
  leech_protocol: '<path d="M24 6 C32 17 36 24 36 30 C36 37 30 42 24 42 C18 42 12 37 12 30 C12 24 16 17 24 6 Z"/><path d="M18 30 H22 L24 25 L27 35 L29 30 H31"/>',
  overclock: '<circle cx="24" cy="26" r="15"/><path d="M24 26 L33 17"/><path d="M14 30 A11 11 0 0 1 18 18" stroke-dasharray="2 3"/><path d="M20 6 H28"/>',
};
const glyph = (id, s = 40, x = -s / 2, y = -s / 2) => `<svg class="gl" x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${G[id] || G.root}</svg>`;

export const branchOf = (id) => BRANCHES.find((b) => b.id === id);
const pos = (p) => [COLS[p.tier], ROWS[p.branch] + ZIG[p.tier]];

export class SkillTree {
  constructor(ui) { this.ui = ui; this.g = ui.g; this.sel = null; this.view = 'all'; this.armed = false; this.just = null; this.vb = null; this.hold = null; this.keys = false; }
  get T() { return !!this.g.touch?.on; }
  spent(b) { const sv = this.g.save; return PERKS.filter((p) => p.branch === b).reduce((a, p) => a + (sv.perks[p.id] || 0), 0); }
  total(b) { return PERKS.filter((p) => p.branch === b).reduce((a, p) => a + p.max, 0); }
  state(p) {
    const sv = this.g.save, r = sv.perks[p.id] || 0, open = this.spent(p.branch) >= TIER_REQ[p.tier];
    if (r >= p.max) return 'max';
    if (r > 0) return sv.points ? 'own avail' : 'own';
    if (!open) return 'locked';
    return sv.points ? 'avail' : 'open';
  }
  canLearn(p) { const sv = this.g.save; return !!sv.points && (sv.perks[p.id] || 0) < p.max && this.spent(p.branch) >= TIER_REQ[p.tier]; }
  // ---- html ------------------------------------------------------------------------------------
  html() {
    const sv = this.g.save, pts = sv.points;
    if (!this.sel) this.sel = (PERKS.find((p) => this.canLearn(p)) || PERKS[0]).id;
    return `<div class="sk">
      <div class="sk-head">
        <div class="sk-pts ${pts ? 'has' : ''}"><b id="skpts">${pts}</b><span>skill point${pts === 1 ? '' : 's'}<em>Level ${sv.level} · 1 per level</em></span></div>
        <div class="sk-views">${[['all', 'All'], ...BRANCHES.map((b) => [b.id, b.name])].map(([k, l]) => `<button data-sk="view" data-v="${k}" class="${this.view === k ? 'on' : ''}" style="${k !== 'all' ? `--bc:${branchOf(k).color}` : ''}">${l}</button>`).join('')}</div>
        <div class="sk-prog">${BRANCHES.map((b) => { const s = this.spent(b.id), t = this.total(b.id); return `<div class="bp" style="--bc:${b.color}"><span>${b.name}</span><i><u style="width:${(s / t) * 100}%"></u></i><b>${s}/${t}</b></div>`; }).join('')}</div>
      </div>
      <div class="sk-body"><div class="sk-map" id="skmap">${this.svg()}</div><div class="sk-detail" id="skdetail">${this.detailHtml()}</div></div>
    </div>`;
  }
  svg() {
    const sv = this.g.save;
    const vb = this.vb || VB[this.view];
    let defs = `<defs>
      <filter id="skglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <pattern id="skgrid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0 H0 V34" fill="none" stroke="rgba(120,160,200,0.05)" stroke-width="1"/></pattern>
      <radialGradient id="skroot"><stop offset="0" stop-color="#ff2a55" stop-opacity=".5"/><stop offset="1" stop-color="#ff2a55" stop-opacity="0"/></radialGradient>
    </defs>`;
    // background: grid, faint stars, circuit traces
    let bg = '<rect x="-400" y="-400" width="1820" height="1400" fill="url(#skgrid)"/>';
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) bg += `<circle cx="${(rnd() * 1060 - 20).toFixed(0)}" cy="${(rnd() * 640 - 20).toFixed(0)}" r="${(rnd() * 1.6 + 0.4).toFixed(1)}" fill="rgba(200,220,255,${(rnd() * 0.25 + 0.05).toFixed(2)})"/>`;
    let lines = '', gates = '', nodes = '';
    for (const b of BRANCHES) {
      const ps = PERKS.filter((p) => p.branch === b.id).sort((a, c) => a.tier - c.tier), spent = this.spent(b.id);
      // branch label + rail
      const y = ROWS[b.id];
      bg += `<path d="M ${COLS[0] - 60} ${y + 62} H ${COLS[4] + 50}" stroke="${b.color}" stroke-opacity=".08" stroke-width="1" stroke-dasharray="2 6"/>`;
      bg += `<text class="sk-bl" data-b="${b.id}" x="${COLS[0] - 58}" y="${y - 84}" fill="${b.color}">${b.name.toUpperCase()}</text><text class="sk-bs" data-b="${b.id}" x="${COLS[0] - 58}" y="${y - 67}">${esc(b.sub)} · ${spent}/${this.total(b.id)}</text>`;
      let prev = ROOT;
      for (const p of ps) {
        const [x, yy] = pos(p), open = spent >= TIER_REQ[p.tier], r = sv.perks[p.id] || 0;
        const owned = r > 0, cls = owned ? 'full' : open ? 'lit' : 'dim';
        const fresh = this.justOpened?.includes(p.id) ? ' charge' : '';
        // circuit trace: horizontal run, then a 45° jog
        const mx = prev[0] + (x - prev[0]) * 0.55;
        const d = prev === ROOT ? `M ${prev[0]} ${prev[1]} C ${prev[0] + 70} ${prev[1]}, ${x - 110} ${yy}, ${x - 42} ${yy}` : `M ${prev[0] + 42} ${prev[1]} H ${mx - Math.abs(yy - prev[1])} L ${mx} ${yy} H ${x - 42}`;
        lines += `<path class="tr ${cls}${fresh}" data-b="${b.id}" d="${d}" style="--bc:${b.color}"/>`;
        if (p.tier > 0) {
          const gx = mx + (x - 42 - mx) / 2, met = spent >= TIER_REQ[p.tier];
          gates += `<g class="gate ${met ? 'met' : ''}" data-b="${b.id}" transform="translate(${gx} ${yy})" style="--bc:${b.color}"><path d="M0 -11 L11 0 L0 11 L-11 0 Z"/><text y="4">${TIER_REQ[p.tier]}</text></g>`;
        }
        prev = [x, yy];
        nodes += this.nodeSvg(p, x, yy, b);
      }
    }
    const root = `<g class="sk-root" transform="translate(${ROOT[0]} ${ROOT[1]})"><circle r="70" fill="url(#skroot)"/><circle r="40" class="rr"/><circle r="33" class="ri"/>${glyph('root', 40)}<text y="62" class="sk-lbl">OATH</text><text y="80" class="sk-rk">Lv ${sv.level}</text></g>`;
    return `<svg id="sksvg" data-focus="${this.view}" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${defs}<g class="bg">${bg}</g><g class="lines">${lines}</g><g class="gates">${gates}</g>${root}<g class="nodes">${nodes}</g></svg>`;
  }
  nodeSvg(p, x, y, b) {
    const sv = this.g.save, r = sv.perks[p.id] || 0, st = this.state(p);
    const R = 38, segs = [];
    // rank arcs around the ring
    const gap = p.max > 1 ? 0.22 : 0;
    for (let i = 0; i < p.max; i++) {
      const a0 = -Math.PI / 2 + (i / p.max) * Math.PI * 2 + gap / 2, a1 = -Math.PI / 2 + ((i + 1) / p.max) * Math.PI * 2 - gap / 2;
      const rr = R + 7, large = a1 - a0 > Math.PI ? 1 : 0;
      const pt = (a) => `${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
      segs.push(p.max === 1 ? `<circle r="${rr}" class="pip ${i < r ? 'f' : ''}"/>` : `<path class="pip ${i < r ? 'f' : ''}" d="M ${pt(a0)} A ${rr} ${rr} 0 ${large} 1 ${pt(a1)}"/>`);
    }
    const above = false, ly = R + 30;
    return `<g data-b="${p.branch}" class="nd ${st} ${this.sel === p.id ? 'sel' : ''} ${this.just === p.id ? 'just' : ''}" data-perk="${p.id}" transform="translate(${x} ${y})" style="--bc:${b.color}">
      <circle r="${R + 16}" class="hit"/>
      ${this.sel === p.id ? `<circle r="${R + 15}" class="selring"/>` : ''}
      ${segs.join('')}
      <path class="hex" d="${hex(R)}"/><path class="hexi" d="${hex(R - 6)}"/>
      ${glyph(p.id, 38)}
      ${st === 'locked' ? '<g class="lockb" transform="translate(24 -26)"><rect x="-8" y="-4" width="16" height="12" rx="2"/><path d="M-5 -4 V-8 A5 5 0 0 1 5 -8 V-4" fill="none"/></g>' : ''}
      ${this.just === p.id ? `<g class="burst">${Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return `<line x1="${(Math.cos(a) * 46).toFixed(1)}" y1="${(Math.sin(a) * 46).toFixed(1)}" x2="${(Math.cos(a) * 80).toFixed(1)}" y2="${(Math.sin(a) * 80).toFixed(1)}"/>`; }).join('')}<circle r="44" class="wave"/></g>` : ''}
      <text class="sk-lbl" y="${ly}">${esc(p.name)}</text>
      <text class="sk-rk" y="${ly + (above ? -18 : 18)}">${st === 'max' ? 'MASTERED' : `${r}/${p.max}`}</text>
    </g>`;
  }
  detailHtml() {
    const p = PERKS.find((x) => x.id === this.sel); if (!p) return '';
    const sv = this.g.save, b = branchOf(p.branch), r = sv.perks[p.id] || 0, spent = this.spent(p.branch), need = TIER_REQ[p.tier];
    const st = this.state(p), open = spent >= need, can = this.canLearn(p);
    const next = PERKS.find((x) => x.branch === p.branch && x.tier === p.tier + 1);
    const base = p.desc(Math.max(1, r)).replace(/\s*\((now|currently)[^)]*\)/i, '');
    let why = '';
    if (r >= p.max) why = 'Mastered. Every rank is yours.';
    else if (!open) why = `Locked: invest ${need - spent} more point${need - spent === 1 ? '' : 's'} in ${b.name}.`;
    else if (!sv.points) why = 'No skill points. You earn one each level.';
    const holdLbl = this.armed ? `Confirm: learn ${esc(p.name)}` : `Hold to learn${r ? ` rank ${r + 1}` : ''}${this.T ? '' : ' · 1 point'}`;
    return `<div class="skd" style="--bc:${b.color}">
      <div class="skd-h"><div class="skd-ic ${st}">${`<svg viewBox="-30 -30 60 60" width="56" height="56">${glyph(p.id, 38)}</svg>`}</div>
        <div><div class="skd-n">${esc(p.name)}</div><div class="skd-b">${b.name} · Tier ${p.tier + 1}${p.id === 'overload' ? ' · Active ability' : ''}</div>
        <div class="skd-r">${Array.from({ length: p.max }, (_, i) => `<i class="${i < r ? 'f' : ''}"></i>`).join('')}<span>Rank ${r}/${p.max}</span></div></div></div>
      <p class="skd-d">${esc(base)}.</p>
      <div class="skd-fx">
        ${r ? `<div class="now"><span>Now</span><b>${esc(EFFECT[p.id](r))}</b></div>` : ''}
        ${r < p.max ? `<div class="nx"><span>${r ? 'Next rank' : 'Rank 1'}</span><b>${esc(EFFECT[p.id](r + 1))}</b></div>` : ''}
      </div>
      <div class="skd-req">
        <div class="${open ? 'ok' : 'no'}"><span>Requires</span><b>${need ? `${need} point${need === 1 ? '' : 's'} in ${b.name} (you have ${spent})` : 'Nothing: first perk of the branch'}</b></div>
        <div><span>Cost</span><b>1 skill point per rank · you have <em class="${sv.points ? 'gold' : ''}">${sv.points}</em></b></div>
        ${next ? `<div><span>Leads to</span><b>${esc(next.name)} (opens at ${TIER_REQ[next.tier]} in ${b.name})</b></div>` : '<div><span>Leads to</span><b>The pinnacle of the branch</b></div>'}
      </div>
      ${why ? `<div class="skd-why">${why}</div>` : ''}
      <button class="sk-learn ${this.armed ? 'armed' : ''}" data-sk="learn" ${can ? '' : 'disabled'}><i class="fill"></i><span>${can ? holdLbl : r >= p.max ? 'Mastered' : 'Cannot learn yet'}</span></button>
      <div class="skd-foot"><span class="muted">${this.T ? 'Tap a node to inspect it. Tap it again, then Confirm, or hold the button.' : 'Click a node to inspect it. Click it again, then Confirm, or hold the button. Arrow keys move, Enter learns.'}</span>
        ${this.respecHtml()}</div>
    </div>`;
  }
  respecHtml() {
    const g = this.g, spent = Object.values(g.save.perks).reduce((a, r) => a + r, 0);
    if (!spent) return '';
    const cost = g.respecCost(), ok = g.nearForge && g.save.scrap >= cost;
    return `<button class="sk-respec ${this.armedRespec ? 'danger' : ''}" data-sk="respec" ${ok ? '' : 'disabled'} title="${g.nearForge ? '' : 'Only at the Forge'}">${this.armedRespec ? `Confirm: unlearn all for ${cost} scrap` : g.nearForge ? `Respec at the Forge · ${cost} scrap` : `Respec: visit the Forge (${cost} scrap)`}</button>`;
  }
  // ---- lifecycle ---------------------------------------------------------------------------------
  afterRender() {
    const btn = document.querySelector('.sk-learn');
    if (btn && !btn.disabled) {
      const start = (e) => { e.preventDefault(); this.startHold(btn); };
      btn.addEventListener('pointerdown', start);
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => this.endHold(false));
    }
    if (this.just) {
      const pts = document.getElementById('skpts'); pts?.classList.add('bump');
      clearTimeout(this.justT); this.justT = setTimeout(() => { this.just = null; this.justOpened = null; document.querySelector('.nd.just')?.classList.remove('just'); document.querySelectorAll('.tr.charge').forEach((e) => e.classList.remove('charge')); }, 2600);
    }
    if (!this.keys) { this.keys = true; addEventListener('keydown', (e) => this.onKey(e)); }
  }
  startHold(btn) {
    if (this.hold) return;
    if (this.armed) { this.commit(); return; } // armed by tapping the node again: one tap confirms
    const t0 = performance.now(); let ticks = 0;
    btn.classList.add('holding');
    const step = () => {
      if (!this.hold) return;
      const k = Math.min(1, (performance.now() - t0) / HOLD_MS);
      btn.style.setProperty('--k', k.toFixed(3));
      if (k * 6 > ticks) { audio.holdTick(k); ticks++; }
      if (k >= 1) { this.hold = null; this.commit(); return; }
      this.hold = requestAnimationFrame(step);
    };
    this.hold = requestAnimationFrame(step);
  }
  endHold() {
    if (!this.hold) return;
    cancelAnimationFrame(this.hold); this.hold = null;
    const btn = document.querySelector('.sk-learn'); if (btn) { btn.classList.remove('holding'); btn.style.setProperty('--k', 0); }
  }
  commit() {
    const p = PERKS.find((x) => x.id === this.sel); if (!p) return;
    const before = new Set(PERKS.filter((x) => x.branch === p.branch && this.spent(p.branch) >= TIER_REQ[x.tier]).map((x) => x.id));
    if (!this.g.learnPerk(p.id)) return;
    this.armed = false; this.just = p.id;
    this.justOpened = PERKS.filter((x) => x.branch === p.branch && this.spent(p.branch) >= TIER_REQ[x.tier] && !before.has(x.id)).map((x) => x.id);
    const r = this.g.save.perks[p.id];
    this.ui.render();
    this.flash(branchOf(p.branch).color);
    if (this.justOpened.length) this.ui.toast(`${PERKS.find((x) => x.id === this.justOpened[0]).name} is now open`, 'cyan');
    this.ui.toast(r >= p.max ? `${p.name} mastered` : `${p.name} rank ${r}`, 'gold');
  }
  flash(col) {
    const m = document.getElementById('skmap'); if (!m) return;
    const f = document.createElement('div'); f.className = 'sk-flash'; f.style.setProperty('--bc', col); m.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }
  zoomTo(view) {
    if (this._zoomRaf) cancelAnimationFrame(this._zoomRaf);
    clearTimeout(this._zoomTimer);
    const from = (this.vb || VB[this.view]).slice(), to = VB[view]; this.view = view;
    const t0 = performance.now(), dur = 380;
    const apply = (vb, done = false) => {
      this.vb = done ? null : vb;
      document.getElementById('sksvg')?.setAttribute('viewBox', vb.join(' '));
    };
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      apply(from.map((v, i) => v + (to[i] - v) * e), k >= 1);
      if (k < 1) this._zoomRaf = requestAnimationFrame(step); else this._zoomRaf = 0;
    };
    this._zoomRaf = requestAnimationFrame(step);
    // SwiftShader CI can stall rAF for seconds; snap so the tab still lands.
    this._zoomTimer = setTimeout(() => {
      if (this._zoomRaf) cancelAnimationFrame(this._zoomRaf);
      this._zoomRaf = 0;
      if (this.view === view) apply(to, true);
    }, dur + 30);
    document.querySelectorAll('.sk-views button').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
    document.getElementById('sksvg')?.setAttribute('data-focus', view);
  }
  select(id) {
    this.sel = id; this.armed = false; this.armedRespec = false;
    document.querySelectorAll('.nd').forEach((n) => { n.classList.toggle('sel', n.dataset.perk === id); n.querySelector('.selring')?.remove(); if (n.dataset.perk === id) n.insertAdjacentHTML('afterbegin', '<circle r="53" class="selring"/>'); });
    const d = document.getElementById('skdetail'); if (d) { d.innerHTML = this.detailHtml(); this.afterRender(); }
  }
  onClick(e) {
    const b = e.target.closest('[data-sk]');
    if (b) {
      const a = b.dataset.sk;
      if (a === 'view') { this.zoomTo(b.dataset.v); return true; }
      if (a === 'respec') {
        if (!this.armedRespec) { this.armedRespec = true; this.select(this.sel); this.armedRespec = true; const d = document.getElementById('skdetail'); if (d) { d.innerHTML = this.detailHtml(); this.afterRender(); } return true; }
        this.armedRespec = false; if (this.g.respec()) this.ui.toast('Every perk unlearned. Your points are back.', 'gold');
        this.ui.render(); return true;
      }
      if (a === 'learn') return true; // handled by pointer hold
    }
    const n = e.target.closest('[data-perk]');
    if (n) {
      const id = n.dataset.perk, p = PERKS.find((x) => x.id === id);
      if (this.sel === id && this.canLearn(p)) {
        if (this.armed) { this.commit(); return true; }
        this.armed = true; const d = document.getElementById('skdetail'); if (d) { d.innerHTML = this.detailHtml(); this.afterRender(); }
        audio.holdTick(0.6); return true;
      }
      this.select(id); audio.ui(); return true;
    }
    return false;
  }
  onKey(e) {
    if (this.ui.screen !== 'skills' || e.target.tagName === 'INPUT') return;
    const p = PERKS.find((x) => x.id === this.sel); if (!p) return;
    const bi = BRANCHES.findIndex((b) => b.id === p.branch);
    let q = null;
    if (e.code === 'ArrowRight') q = PERKS.find((x) => x.branch === p.branch && x.tier === p.tier + 1);
    if (e.code === 'ArrowLeft') q = PERKS.find((x) => x.branch === p.branch && x.tier === p.tier - 1);
    if (e.code === 'ArrowDown') q = PERKS.find((x) => x.branch === BRANCHES[(bi + 1) % 3].id && x.tier === p.tier);
    if (e.code === 'ArrowUp') q = PERKS.find((x) => x.branch === BRANCHES[(bi + 2) % 3].id && x.tier === p.tier);
    if (q) { e.preventDefault(); this.select(q.id); audio.ui(); return; }
    if (e.code === 'Enter' && this.canLearn(p)) { e.preventDefault(); if (this.armed) this.commit(); else { this.armed = true; const d = document.getElementById('skdetail'); if (d) { d.innerHTML = this.detailHtml(); this.afterRender(); } } }
  }
}
function hex(r) { return Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${i ? 'L' : 'M'} ${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`; }).join(' ') + ' Z'; }
