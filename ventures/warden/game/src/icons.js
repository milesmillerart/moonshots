// Procedural SVG item icons. Dark forged metal shapes outlined in the item's tier colour;
// small variations come from the item's base name so a Sallet and a Greathelm read differently.
import { RARITIES, CORES } from './data.js';
import { tierOf } from './items.js';

const h = (s) => { let x = 7; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const METAL = '<defs><linearGradient id="ICM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f4a"/><stop offset=".55" stop-color="#16181d"/><stop offset="1" stop-color="#0b0c0f"/></linearGradient></defs>';

const SHAPES = {
  blade: (v, c) => `
    <path d="M10 38 L34.5 9.5 L39 9 L38.5 13.5 L14 42 Z" fill="url(#ICM)" stroke="#8a919c" stroke-width="1"/>
    <path d="M14 42 L38.5 13.5 L39 9" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" class="edge"/>
    <path d="M${v ? '5 33 L15 43' : '6 34 L14 42'}" stroke="#b9c0ca" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M9.5 38.5 L4.5 43.5" stroke="#5a4636" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="3.8" cy="44.2" r="2.2" fill="${c}"/>`,
  helm: (v, c) => `
    <path d="M10 30 C10 13 17 7 24 7 C31 7 38 13 38 30 L36 40 L28 42 L28 33 L20 33 L20 42 L12 40 Z" fill="url(#ICM)" stroke="#8a919c" stroke-width="1.2"/>
    <path d="M15 22 L33 22 L33 25.5 L26 25.5 L26 36 L22 36 L22 25.5 L15 25.5 Z" fill="${c}" class="edge"/>
    ${v === 1 ? '<path d="M24 7 L24 3" stroke="#8a919c" stroke-width="2.5"/>' : v === 2 ? '<path d="M38 26 C43 28 44 34 41 39" stroke="#5c6470" stroke-width="2" fill="none"/>' : ''}`,
  cuirass: (v, c) => `
    <path d="M9 12 L18 8 C20 12 28 12 30 8 L39 12 L37 26 C36 34 31 40 24 42 C17 40 12 34 11 26 Z" fill="url(#ICM)" stroke="#8a919c" stroke-width="1.2"/>
    <path d="M24 13 L24 40" stroke="#5c6470" stroke-width="1.4"/>
    <path d="M14 ${v ? 30 : 28} C20 ${v ? 33 : 31} 28 ${v ? 33 : 31} 34 ${v ? 30 : 28}" stroke="${c}" stroke-width="1.8" fill="none" class="edge"/>
    <circle cx="24" cy="20" r="2.6" fill="${c}" class="edge"/>`,
  gauntlets: (v, c) => `
    <path d="M14 44 L14 30 L11 22 C10 19 13 18 14.5 20.5 L17 25 L17 11 C17 8.5 20.5 8.5 20.5 11 L20.5 22 L21.5 8 C21.5 5.5 25 5.5 25 8 L25 22 L26.5 9.5 C26.5 7 30 7 30 9.5 L29.5 23 L31.5 13 C32 10.5 35 11 34.6 13.5 L33 31 L33 44 Z" fill="url(#ICM)" stroke="#8a919c" stroke-width="1.1"/>
    <path d="M14 36 L33 36" stroke="${c}" stroke-width="2" class="edge"/>
    ${v ? '<path d="M16 40 L31 40" stroke="#5c6470" stroke-width="1.4"/>' : ''}`,
  greaves: (v, c) => `
    <path d="M11 6 L21 6 L21 34 L23 40 L9 42 L9 36 L11 32 Z" fill="url(#ICM)" stroke="#8a919c" stroke-width="1.1"/>
    <path d="M27 6 L37 6 L37 32 L39 36 L39 42 L25 40 L27 34 Z" fill="url(#ICM)" stroke="#8a919c" stroke-width="1.1"/>
    <circle cx="16" cy="${v ? 18 : 20}" r="2.4" fill="${c}" class="edge"/><circle cx="32" cy="${v ? 18 : 20}" r="2.4" fill="${c}" class="edge"/>
    <path d="M12 30 L20 30 M28 30 L36 30" stroke="${c}" stroke-width="1.4" class="edge"/>`,
  mantle: (v, c) => `
    <path d="M16 6 L32 6 L40 40 L36 37 L33 43 L29 38 L25 44 L21 38 L17 43 L14 37 L8 40 Z" fill="url(#ICM)" stroke="#8a919c" stroke-width="1.1"/>
    <path d="M16 6 C20 10 28 10 32 6" stroke="${c}" stroke-width="2" fill="none" class="edge"/>
    <path d="M20 12 L17 34 M28 12 L31 34" stroke="#3f4550" stroke-width="1.2"/>
    ${v ? `<circle cx="24" cy="10" r="2" fill="${c}"/>` : ''}`,
};

export function itemIcon(it, size = 48) {
  if (it.kind === 'core') {
    const c = CORES[it.core].color;
    return `<svg class="icon" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${METAL}
      <path d="M24 4 L41 14 L41 34 L24 44 L7 34 L7 14 Z" fill="url(#ICM)" stroke="${c}" stroke-width="1.6"/>
      <path d="M24 12 L33 24 L24 36 L15 24 Z" fill="${c}" class="edge"/>
      ${Array.from({ length: it.grade }, (_, i) => `<rect x="${18 + i * 5}" y="38.5" width="3" height="3" fill="${c}"/>`).join('')}
    </svg>`;
  }
  const c = RARITIES[tierOf(it)].color;
  return `<svg class="icon" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${METAL}${SHAPES[it.slot](h(it.base || it.name) % 3, c)}</svg>`;
}
export function slotIcon(slot, size = 40) {
  return `<svg class="icon ghost" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${METAL}${SHAPES[slot](0, '#3a3f48')}</svg>`;
}
