// Save system (build 0.5): versioned schema, 3 slots, migration, backups, export/import codes.
// Everything lives in this browser's localStorage. No accounts, no server.
//   warden.slot.<n>      current save for slot n (0..2)
//   warden.slot.<n>.bak  the previous good write (used if the current one is unreadable)
//   warden.meta          { last: <slot>, v1Done: [<created> of each migrated 0.4 Warden] }
//   warden.save.v1       the single 0.1-0.4 save. Migrated into a slot once, then left in place as a backup.
import { starterGear, slotCount } from './items.js';
import { RENAMES } from './data.js';

export const SCHEMA = 5;
export const SLOTS = 3;
const LEGACY_KEY = 'warden.save.v1', META_KEY = 'warden.meta';
const slotKey = (n) => `warden.slot.${n}`;
const CODE_PREFIX = 'WARDEN-SAVE';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { localStorage.setItem(k, v); }, // throws on quota / disabled storage: callers handle it
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const num = (v, d = 0, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function meta() { return Object.assign({ last: null, v1Done: [] }, obj(parse(ls.get(META_KEY)))); }
function setMeta(m) { try { ls.set(META_KEY, JSON.stringify(m)); } catch { /* ignore */ } }

const validItem = (it) => it && typeof it === 'object' && typeof it.uid === 'string' && (it.kind === 'gear' || it.kind === 'core');
function fixGear(it) {
  it.fav = !!it.fav; if (typeof it.got !== 'number') it.got = 0; if (it.seen == null) it.seen = true;
  if (it.kind !== 'gear') return it;
  it.upgrade = num(it.upgrade, 0, 0, 99);
  // 0.8 (schema 4): rarity keeps its position (Issued/Forged/Tempered/Relic/Sovereign ->
  // Base/Uncommon/Rare/Legendary/Exalted); 'sockets' now means effect slots (0/0/1/2/3).
  // Installed Cores are never removed: an item keeps at least as many slots as it has Cores.
  it.rarity = num(Math.round(it.rarity), 0, 0, 4);
  it.cores = Array.isArray(it.cores) ? it.cores.filter(validItem) : [];
  it.sockets = slotCount(it.rarity, it.cores.length);
  if (typeof it.name === 'string') {
    if (RENAMES.exact[it.name]) it.name = RENAMES.exact[it.name];
    for (const [a, b] of Object.entries(RENAMES.prefix)) if (it.name.startsWith(a)) { it.name = b + it.name.slice(a.length); break; }
  } else it.name = String(it.base || 'Gear');
  return it;
}

// Bring any older save up to the current schema and repair missing or broken fields.
// Never throws for a plausible save; returns null for something that isn't a Warden save at all.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || typeof raw.level !== 'number') return null;
  const s = JSON.parse(JSON.stringify(raw));
  const from = s.schema || s.v || 1;
  if (from < 2) {
    // 0.1-0.4 (v1): same core data, no play time / timestamps / ground loot / facing.
    s.playTime = 0; s.saved = s.saved || Date.now(); s.ground = []; s.migratedFrom = 1;
  }
  if (from < 3) {
    // 0.6: items gain got (pickup time, for "newest" sorting), seen (NEW marker) and fav (lock against salvage).
    // Older items keep their pack order as their age and count as already seen.
    const t0 = (typeof s.created === 'number' ? s.created : Date.now() - 864e5);
    let i = 0;
    const stamp = (it) => { if (it && typeof it === 'object') { if (typeof it.got !== 'number') it.got = t0 + i++; if (it.seen == null) it.seen = true; it.fav = !!it.fav; } };
    for (const k in obj(s.equip)) stamp(s.equip[k]);
    (Array.isArray(s.bag) ? s.bag : []).forEach(stamp);
    (Array.isArray(s.ground) ? s.ground : []).forEach((g) => stamp(g?.item));
  }
  s.schema = SCHEMA; s.v = SCHEMA;
  s.flags = obj(s.flags);
  if (from < 5 || !['act1', 'legacy', 'done'].includes(s.flags.opening)) {
    // 0.10 (schema 5): the cold open. Wardens who already judged Mira keep everything and never replay it ('legacy').
    // Anyone else plays the new cold open; an older save already chose its name, so the naming step is skipped later.
    if (s.flags.judged && s.flags.opening !== 'act1') s.flags.opening = 'legacy';
    else { s.flags.opening = 'act1'; if (from < 5) s.flags.named = true; }
  }
  // A new cold-open Warden is nameless ("Warden") until character creation; everyone else defaults to Kade.
  const unnamed = s.flags.opening === 'act1' && !s.flags.named && !s.flags.created;
  s.name = s.name.slice(0, 20) || (unnamed ? '' : 'Kade');
  s.level = num(s.level, 1, 1, 999); s.xp = num(s.xp, 0, 0); s.points = num(s.points, 0, 0);
  s.scrap = num(s.scrap, 0, 0); s.stims = num(s.stims, 3, 0, 9); s.kills = num(s.kills, 0, 0);
  s.playTime = num(s.playTime, 0, 0); s.saved = num(s.saved, Date.now()); s.created = num(s.created, Date.now());
  s.perks = obj(s.perks); for (const k in s.perks) s.perks[k] = num(s.perks[k], 0, 0, 9);
  s.equip = obj(s.equip);
  if (!Object.keys(s.equip).length) s.equip = starterGear();
  for (const k in s.equip) { if (!validItem(s.equip[k])) delete s.equip[k]; else fixGear(s.equip[k]); }
  s.bag = Array.isArray(s.bag) ? s.bag.filter(validItem).map(fixGear) : [];
  s.ground = Array.isArray(s.ground) ? s.ground.filter((g) => g && validItem(g.item) && Number.isFinite(g.x) && Number.isFinite(g.z)).map((g) => ({ ...g, item: fixGear(g.item) })) : [];
  if (s.trait != null && !['dread', 'measure', 'inquest'].includes(s.trait)) s.trait = null;
  // 0.10.7 pack objects (story items, never gear): only known ids, one of each
  s.pack = Array.isArray(s.pack) ? s.pack.filter((o, i, a) => o && o.id === 'fused_fragment' && a.findIndex((x) => x?.id === o.id) === i).map((o) => ({ id: o.id, got: num(o.got, Date.now()) })) : [];
  if (!Array.isArray(s.pos) || s.pos.length < 2 || !s.pos.every(Number.isFinite)) delete s.pos;
  if (s.hp != null) s.hp = num(s.hp, 0, 0);
  if (from < 4) s.migratedRarity = true; // 0.8: tiers renamed by position, Cores stop promoting rarity
  return s;
}

export function readSlot(n) {
  let s = migrate(parse(ls.get(slotKey(n))));
  if (!s) s = migrate(parse(ls.get(slotKey(n) + '.bak')));
  return s;
}

// Write a slot. Keeps the previous good copy as .bak. Returns true on success.
export function writeSlot(n, save) {
  const key = slotKey(n), json = JSON.stringify(save);
  const prev = ls.get(key);
  try {
    if (prev && parse(prev)) ls.set(key + '.bak', prev);
    ls.set(key, json);
  } catch {
    // probably out of space: drop backups and try once more
    for (let i = 0; i < SLOTS; i++) ls.del(slotKey(i) + '.bak');
    try { ls.set(key, json); } catch { return false; }
  }
  const m = meta(); m.last = n; setMeta(m);
  return true;
}
export function deleteSlot(n) {
  ls.del(slotKey(n)); ls.del(slotKey(n) + '.bak');
  const m = meta(); if (m.last === n) { m.last = null; setMeta(m); }
}
export function listSlots() { return Array.from({ length: SLOTS }, (_, n) => readSlot(n)); }
export function firstEmpty() { return listSlots().findIndex((s) => !s); }
export function lastSlot() {
  const m = meta(), all = listSlots();
  if (m.last != null && all[m.last]) return m.last;
  let best = -1; all.forEach((s, i) => { if (s && (best < 0 || s.saved > all[best].saved)) best = i; });
  return best < 0 ? null : best;
}

// Move the 0.1-0.4 single save into the first free slot, once per Warden (keyed by its creation time).
// The old key is left untouched as a backup.
export function migrateLegacy() {
  const raw = parse(ls.get(LEGACY_KEY)), m = meta();
  const old = migrate(raw);
  if (!old) return null;
  const sig = String(raw.created || raw.name + raw.level);
  const done = Array.isArray(m.v1Done) ? m.v1Done : [];
  if (done.includes(sig)) return null;
  const slot = firstEmpty();
  if (slot < 0 || !writeSlot(slot, old)) return null;
  const m2 = meta(); m2.last = slot; m2.v1Done = [...done, sig]; setMeta(m2);
  return slot;
}

// Ask the browser not to evict our storage under pressure (no prompt in Chrome/Safari; Firefox would prompt, so skip it).
export function requestPersist() {
  try { if (!/Firefox/.test(navigator.userAgent)) navigator.storage?.persist?.().catch(() => {}); } catch { /* ignore */ }
}

// ---- export / import -----------------------------------------------------------
function b64encode(str) { const b = new TextEncoder().encode(str); let s = ''; for (const c of b) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64decode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }

export function exportCode(save) {
  const body = b64encode(JSON.stringify(save));
  return `${CODE_PREFIX}.${SCHEMA}.${body}.${fnv(body)}`;
}
// Accepts a save code, a downloaded save file's text, or raw save JSON (any schema).
export function importCode(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) throw new Error('Paste a save code or choose a save file.');
  let raw = null;
  if (t.startsWith(CODE_PREFIX)) {
    const parts = t.split('.');
    if (parts.length !== 4) throw new Error('That save code is incomplete. Copy the whole code, start to end.');
    const [, , body, sum] = parts;
    if (fnv(body) !== sum) throw new Error('That save code is damaged or cut off. Copy the whole code again.');
    try { raw = JSON.parse(b64decode(body)); } catch { throw new Error('That save code could not be read.'); }
  } else if (t.startsWith('{')) {
    raw = parse(String(text));
    if (raw && raw.save) raw = raw.save;
  }
  const s = migrate(raw);
  if (!s) throw new Error('That is not a Warden save.');
  return s;
}

// ---- display helpers -----------------------------------------------------------
export function fmtPlay(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m` : `${sec}s`;
}
export function fmtAgo(ts) {
  if (!ts) return 'never';
  const d = (Date.now() - ts) / 1000;
  if (d < 10) return 'just now';
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
export function areaAt(x, z) {
  if (x < -21) return 'Cutpurse Alley';
  if (z < -57) return 'Grave Gate Court';
  if (z < -13) return 'Lantern Street';
  if (z <= 13) return 'Statute Plaza';
  return 'South Lantern Street';
}
// "Warden Kade", or just "Warden" while a new Warden is still nameless in the cold open
export const displayName = (s) => (s?.name ? `Warden ${s.name}` : 'Warden');
export const inOpening = (s) => s?.flags?.opening === 'act1' && !s.flags.created;
export function chapterOf(s) {
  const f = s.flags || {};
  if (inOpening(s)) {
    if (f.waveA) return 'The cold open · the street is clear';
    if (f.judged) return 'The cold open · the breach';
    return 'The cold open · the case';
  }
  if (f.boss) return 'The capital holds · hunting abominations';
  if (f.waveC) return 'At the Grave Gate';
  if (f.waveB) return 'Plaza held · clearing Lantern Street';
  if (f.waveA) return 'Pushing into Statute Plaza';
  if (f.judged) return 'The breach';
  return 'The Judgment';
}
