// Gear generation, upgrading, Cores, and the derived stat sheet.
import { RARITIES, SLOTS, BASES, PREFIXES, EXALTED_NAMES, AFFIXES, CORES, CORE_GRADES, EXALTED_BUFF, PERKS, TRAITS } from './data.js';
import { pick, randi, rand, uid } from './util.js';

export const MAX_UPGRADE = 10;

export function rollRarity(luck = 0) {
  // luck shifts weights toward rarer tiers (elites, chests).
  const w = [52, 28, 13, 5.5, 1.5].map((x, i) => x * Math.pow(1 + luck, i));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { if ((r -= w[i]) <= 0) return i; }
  return 0;
}

export function makeCore(type, grade = 1) {
  return { uid: uid(), kind: 'core', core: type || pick(Object.keys(CORES)), grade, got: Date.now(), seen: false, fav: false };
}

export function makeItem(slot, rarity, ilvl, opts = {}) {
  const rid = RARITIES[rarity].id;
  const base = pick(BASES[slot]);
  let name = rarity === 4 ? pick(EXALTED_NAMES[slot]) : `${pick(PREFIXES[rid])} ${base}`;
  if (opts.name) name = opts.name;
  const affixes = [];
  const pool = [...AFFIXES];
  for (let i = 0; i < RARITIES[rarity].affixes && pool.length; i++) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    affixes.push({ id: a.id, v: randi(a.roll[0], a.roll[1]) });
  }
  const item = {
    uid: uid(), kind: 'gear', slot, rarity, ilvl: Math.max(1, ilvl), name, base,
    upgrade: 0, affixes, cores: [], sockets: RARITIES[rarity].slots, // effect slots (field name kept for save compatibility)
    got: Date.now(), seen: false, fav: false,
  };
  // High-rarity drops can arrive with Cores already installed.
  if (!opts.noCores && rarity >= 3) {
    const n = rarity === 4 ? randi(1, 2) : Math.random() < 0.5 ? 1 : 0;
    for (let i = 0; i < n && item.cores.length < item.sockets; i++) item.cores.push(makeCore(null, rarity === 4 ? 3 : 2));
  }
  return item;
}

export function randomGear(ilvl, luck = 0) {
  return makeItem(pick(SLOTS).id, rollRarity(luck), ilvl);
}

export function starterGear() {
  const o = { noCores: true };
  const g = {
    blade: makeItem('blade', 0, 1, { ...o, name: 'Ward-Issue Synthblade' }),
    helm: makeItem('helm', 0, 1, { ...o, name: 'Ninth Ward Visor Helm' }),
    cuirass: makeItem('cuirass', 0, 1, { ...o, name: 'Ninth Ward Cuirass' }),
    gauntlets: makeItem('gauntlets', 0, 1, { ...o, name: 'Gaol-Iron Gauntlets' }),
    greaves: makeItem('greaves', 0, 1, { ...o, name: 'Gaol-Iron Greaves' }),
    mantle: makeItem('mantle', 0, 1, { ...o, name: 'Tattered Mantle' }),
  };
  for (const k in g) g[k].seen = true;
  return g;
}
// Destiny-style power: item level, Temper and BASE rarity of everything worn (Cores never count as tiers).
export function powerOf(it) { return it ? Math.round(it.ilvl * 10 + it.upgrade * 6 + it.rarity * 12) : 0; }
export function gearPower(equip) { return Math.round(SLOTS.reduce((a, s) => a + powerOf(equip[s.id]), 0) / SLOTS.length); }

// Display tier for colours/sorting. Gear: its own rarity, always (0.8: Cores no longer promote rarity).
// Cores have no rarity; their frame colour follows the grade (Mk I/II/III) for readability only.
export const tierOf = (it) => (it.kind === 'core' ? Math.min(4, it.grade + 1) : it.rarity);
// Effect slots on a gear item: the rarity's count, never fewer than the Cores already installed
// (older saves may hold Cores on Base/Uncommon gear; those are preserved).
export const slotCount = (rarity, installed = 0) => Math.max(RARITIES[rarity]?.slots ?? 0, installed);

export function baseStat(it) {
  const m = RARITIES[it.rarity].mult * (1 + 0.1 * it.upgrade);
  if (it.slot === 'blade') return Math.round((12 + 2.2 * it.ilvl) * m);
  const w = { helm: 0.8, cuirass: 1.4, gauntlets: 0.7, greaves: 0.9, mantle: 0.6 }[it.slot] || 1;
  return Math.round((5 + 1.4 * it.ilvl) * w * m);
}

export function upgradeCost(it) {
  return Math.round(12 * Math.pow(it.upgrade + 1, 1.45) * (1 + it.rarity * 0.35) * (1 + it.ilvl * 0.06));
}
export function salvageValue(it) {
  if (it.kind === 'core') return 10 * it.grade;
  return Math.round((6 + it.ilvl * 1.5) * (1 + it.rarity) + it.upgrade * 5);
}

export function itemLines(it) {
  if (it.kind === 'core') return [CORES[it.core].desc(it.grade)];
  const out = [it.slot === 'blade' ? `${baseStat(it)} damage` : `${baseStat(it)} armor`];
  for (const a of it.affixes) out.push(AFFIXES.find((x) => x.id === a.id).label(a.v));
  return out;
}
export function rarityNote(it) {
  if (it.kind !== 'gear') return '';
  if (it.rarity === 4) return EXALTED_BUFF.label;
  return '';
}
export function itemName(it) {
  if (it.kind === 'core') return `${CORES[it.core].name} ${CORE_GRADES[it.grade - 1]}`;
  return it.upgrade ? `${it.name} +${it.upgrade}` : it.name;
}

// Full stat sheet from gear + perks + trait.
export function computeStats(state) {
  const s = { dmg: 10, armor: 0, hp: 100, sta: 100, crit: 5, critDmg: 50, aspd: 0, regen: 0, leech: 0,
    dmgPct: 0, scrapPct: 0, arc: 0, ember: 0, bastion: 0 };
  const perk = (id) => state.perks[id] || 0;
  for (const slot of SLOTS) {
    const it = state.equip[slot.id];
    if (!it) continue;
    if (slot.id === 'blade') s.dmg = baseStat(it); else s.armor += baseStat(it);
    for (const a of it.affixes) {
      if (a.id === 'dmg') s.dmgPct += a.v; else if (a.id === 'hp') s.hp += a.v; else if (a.id === 'sta') s.sta += a.v;
      else if (a.id === 'crit') s.crit += a.v; else if (a.id === 'aspd') s.aspd += a.v; else if (a.id === 'regen') s.regen += a.v;
      else if (a.id === 'leech') s.leech += a.v;
    }
    for (const c of it.cores) {
      const g = c.grade;
      if (c.core === 'arc') s.arc += 8 + 4 * g; else if (c.core === 'ember') s.ember += 15 + 10 * g;
      else if (c.core === 'leech') s.leech += 1 + g; else if (c.core === 'bastion') s.bastion += 8 + 6 * g;
      else if (c.core === 'kinetic') s.regen += 10 + 8 * g; else if (c.core === 'overclock') s.aspd += 4 + 3 * g;
      else if (c.core === 'edge') { s.crit += 3 + 2 * g; s.critDmg += 15 + 10 * g; }
    }
  }
  s.armor = Math.round(s.armor * (1 + s.bastion / 100));
  s.dmgPct += 8 * perk('keen_edge');
  s.hp += 15 * perk('plated');
  s.regen += 20 * perk('second_wind');
  s.arc += 10 * perk('arc_edge');
  if (perk('overclock')) s.aspd += 15;
  if (state.trait === 'dread') s.dmgPct += 10;
  if (state.trait === 'measure') s.scrapPct += 20;
  if (state.trait === 'inquest') s.crit += 6;
  s.hp += (state.level - 1) * 6;
  s.dmgFinal = s.dmg * (1 + s.dmgPct / 100);
  s.reduction = s.armor / (s.armor + 90);
  return s;
}

export const perkDef = (id) => PERKS.find((p) => p.id === id);
export const traitDef = (id) => TRAITS[id];
export { rand };
