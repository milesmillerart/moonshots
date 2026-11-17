// Game data: rarities, gear, Cores, perks, enemies, story. Tweak freely; the daily
// improvement pass mostly lives here.

// Rarity (approved design v1.0, docs/lore.md): baseline quality + potential. Independent of synth,
// Tempering and Cores; nothing installed raises it. slots = effect slots (0/0/1/2/3). Until status
// effects are designed, effect slots hold Cores (provisional). Exalted also grants a buff while
// equipped; that buff is not designed yet (placeholder, see EXALTED_BUFF).
export const RARITIES = [
  { id: 'base', name: 'Base', color: '#c4cad3', mult: 1.0, slots: 0, affixes: 0 },
  { id: 'uncommon', name: 'Uncommon', color: '#4aa3ff', mult: 1.12, slots: 0, affixes: 1 },
  { id: 'rare', name: 'Rare', color: '#a66bff', mult: 1.26, slots: 1, affixes: 2 },
  { id: 'legendary', name: 'Legendary', color: '#f2c447', mult: 1.42, slots: 2, affixes: 3 },
  { id: 'exalted', name: 'Exalted', color: '#ff8a1f', mult: 1.62, slots: 3, affixes: 4 },
];
export const EXALTED_BUFF = { placeholder: true, label: 'Exalted buff (while equipped): not designed yet' };

export const SLOTS = [
  { id: 'blade', name: 'Synthblade', icon: '†' },
  { id: 'helm', name: 'Helm', icon: '◓' },
  { id: 'cuirass', name: 'Cuirass', icon: '▣' },
  { id: 'gauntlets', name: 'Gauntlets', icon: '✋' },
  { id: 'greaves', name: 'Greaves', icon: '▥' },
  { id: 'mantle', name: 'Mantle', icon: '⌇' },
];

export const BASES = {
  blade: ['Synthblade', 'Longedge', 'Verdict-Blade', 'Oathcutter', 'Gravesword', 'Statute Edge'],
  helm: ['Visor Helm', 'Sallet', 'Greathelm', 'Conduit Helm'],
  cuirass: ['Cuirass', 'Plate Coat', 'Brigandine', 'Ward Plate'],
  gauntlets: ['Gauntlets', 'Vambraces', 'Iron Hands'],
  greaves: ['Greaves', 'Sabatons', 'Tread-Plates'],
  mantle: ['Mantle', 'Shroud', 'Rain-Cloak', 'Tabard'],
};

export const PREFIXES = {
  base: ['Ward-Issue', 'Ninth Ward', 'Gaol-Iron'],
  uncommon: ['Forged', 'Blackglass', 'Sodium-Lit', 'Rivetbound'],
  rare: ['Quenched', 'Conduit', 'Tribunal', 'Spire-Wrought'],
  legendary: ['Hallowed', 'Elder-Wrought', 'Ossuary', 'Lattice-Wired'],
  exalted: ['Exalted'],
};

// Unique names for Exalted drops. 0.8: placeholder royal/saint titles removed per Don's direction
// (no King; "Saint" reviewed one by one). Named people (Ossery, Vael) keep unresolved identities.
export const EXALTED_NAMES = {
  blade: ["The Last Statute", "Mercy's End", "Ossery's Verdict", 'Rainbreaker'],
  helm: ['Visor of the Unblinking', 'The Ninth Eye'],
  cuirass: ["Vael's Hearthplate", 'The Iron Oath'],
  gauntlets: ["Hangman's Grasp", 'Hands of the Tribunal'],
  greaves: ['Gate-Walkers', 'The Long Patrol'],
  mantle: ['Shroud of the Drowned Bell', 'Banner of Hallowmere'],
};
// Save migration (schema 4): old placeholder names -> 0.8 names. Exact names first, then prefixes.
export const RENAMES = {
  exact: { "Saint Ossery's Verdict": "Ossery's Verdict", 'Hearthplate of King Vael': "Vael's Hearthplate", 'Crown of the Unblinking': 'Visor of the Unblinking' },
  prefix: { 'Tempered ': 'Quenched ', 'Cathedral ': 'Spire-Wrought ', 'Old Kingdom ': 'Elder-Wrought ', 'Saint-Wired ': 'Lattice-Wired ', 'Sovereign ': 'Exalted ' },
};

// Random stat lines rolled onto non-Issued gear.
export const AFFIXES = [
  { id: 'dmg', label: (v) => `+${v}% damage`, roll: [4, 10] },
  { id: 'hp', label: (v) => `+${v} health`, roll: [8, 22] },
  { id: 'sta', label: (v) => `+${v} stamina`, roll: [6, 16] },
  { id: 'crit', label: (v) => `+${v}% critical chance`, roll: [2, 6] },
  { id: 'aspd', label: (v) => `+${v}% attack speed`, roll: [3, 8] },
  { id: 'regen', label: (v) => `+${v}% stamina recovery`, roll: [6, 16] },
  { id: 'leech', label: (v) => `${v}% life drain`, roll: [1, 3] },
];

// Cores: provisional technological modules that occupy an item's effect slots. They add their effect
// and never change rarity (Don, 2026-11-16).
export const CORES = {
  arc: { name: 'Arc Core', color: '#46f0e0', desc: (g) => `${8 + 4 * g}% chance for hits to arc lightning to a nearby enemy` },
  ember: { name: 'Ember Core', color: '#ff6a2a', desc: (g) => `Hits set enemies burning for ${15 + 10 * g}% damage over 3s` },
  leech: { name: 'Leech Core', color: '#ff2f6d', desc: (g) => `${1 + g}% of damage dealt restores health` },
  bastion: { name: 'Bastion Core', color: '#9fb4c8', desc: (g) => `+${8 + 6 * g}% armor` },
  kinetic: { name: 'Kinetic Core', color: '#d9ff5a', desc: (g) => `+${10 + 8 * g}% stamina recovery` },
  overclock: { name: 'Overclock Core', color: '#ffd23a', desc: (g) => `+${4 + 3 * g}% attack speed` },
  edge: { name: 'Edge Core', color: '#ff4040', desc: (g) => `+${3 + 2 * g}% critical chance, +${15 + 10 * g}% critical damage` },
};
export const CORE_GRADES = ['Mk I', 'Mk II', 'Mk III'];

export const PERKS = [
  // Blade
  { id: 'keen_edge', branch: 'blade', tier: 0, max: 3, name: 'Keen Edge', desc: (r) => `+8% damage per rank (now +${8 * r}%)` },
  { id: 'momentum', branch: 'blade', tier: 1, max: 1, name: 'Momentum', desc: () => 'The third strike of a combo deals +60% damage' },
  { id: 'cleave', branch: 'blade', tier: 2, max: 1, name: 'Cleave', desc: () => 'Heavy attacks strike every enemy around you' },
  { id: 'executioner', branch: 'blade', tier: 3, max: 2, name: 'Executioner', desc: (r) => `+25% damage per rank to enemies below 35% health (now +${25 * r}%)` },
  { id: 'verdict', branch: 'blade', tier: 4, max: 1, name: 'The Verdict', desc: () => 'Killing blows restore 25 stamina and 4% health' },
  // Bulwark
  { id: 'plated', branch: 'bulwark', tier: 0, max: 3, name: 'Plated', desc: (r) => `+15 maximum health per rank (now +${15 * r})` },
  { id: 'second_wind', branch: 'bulwark', tier: 1, max: 2, name: 'Second Wind', desc: (r) => `+20% stamina recovery per rank (now +${20 * r}%)` },
  { id: 'quickstep', branch: 'bulwark', tier: 2, max: 1, name: 'Quickstep', desc: () => 'Dodges cost 30% less stamina and carry you further' },
  { id: 'iron_resolve', branch: 'bulwark', tier: 3, max: 2, name: 'Iron Resolve', desc: (r) => `Take 12% less damage per rank while attacking (now ${12 * r}%)` },
  { id: 'last_rites', branch: 'bulwark', tier: 4, max: 1, name: 'Last Rites', desc: () => 'Once every 90 seconds, a killing blow leaves you standing at 1 health' },
  // Circuit
  { id: 'capacitor', branch: 'circuit', tier: 0, max: 2, name: 'Capacitor', desc: (r) => `Build Charge 35% faster per rank (now +${35 * r}%)` },
  { id: 'overload', branch: 'circuit', tier: 1, max: 1, name: 'Overload', desc: () => 'Unlocks OVERLOAD [F]: spend 100 Charge to release a shock nova that damages and staggers' },
  { id: 'arc_edge', branch: 'circuit', tier: 2, max: 2, name: 'Arc Edge', desc: (r) => `Hits have a 10% chance per rank to arc lightning to a nearby enemy (now ${10 * r}%)` },
  { id: 'leech_protocol', branch: 'circuit', tier: 3, max: 1, name: 'Leech Protocol', desc: () => 'Kills restore 6% health' },
  { id: 'overclock', branch: 'circuit', tier: 4, max: 1, name: 'Overclock', desc: () => '+15% attack speed. Overload needs only half Charge' },
];
export const BRANCHES = [
  { id: 'blade', name: 'Blade', sub: 'The edge of the law', color: '#ff3355' },
  { id: 'bulwark', name: 'Bulwark', sub: 'The wall that does not fall', color: '#9fb4c8' },
  { id: 'circuit', name: 'Circuit', sub: 'The current in the steel', color: '#46f0e0' },
];
// Points that must be spent in a branch before each tier opens.
export const TIER_REQ = [0, 1, 2, 3, 5];

export const ENEMIES = {
  husk: { name: 'Hollowed Husk', hp: 60, dmg: 12, speed: 2.3, range: 1.9, xp: 20, scrap: [4, 8], poise: 3, radius: 0.55 },
  skitter: { name: 'Skitter', hp: 30, dmg: 8, speed: 4.6, range: 5.5, xp: 12, scrap: [2, 5], poise: 1, radius: 0.5 },
  spitter: { name: 'Bile Spitter', hp: 48, dmg: 14, speed: 1.9, range: 11, xp: 18, scrap: [4, 7], poise: 2, radius: 0.7 },
  // 0.10.6 cold-open boss (working name): three Husks fused into one mass; cause deliberately unexplained
  clot: { name: 'The Clot', hp: 680, dmg: 18, speed: 1.9, range: 3.0, xp: 180, scrap: [0, 0], poise: 30, radius: 1.35, elite: true },
  shard: { name: 'Clot Shard', hp: 70, dmg: 8, speed: 3.0, range: 1.6, xp: 0, scrap: [0, 0], poise: 2, radius: 0.5 },
  bellwright: { name: 'The Bellwright', hp: 900, dmg: 22, speed: 2.5, range: 3.6, xp: 260, scrap: [55, 70], poise: 26, radius: 1.5, elite: true },
};

export const TRAITS = {
  dread: { name: 'Dread', desc: '+10% damage. The Ward fears your name.' },
  measure: { name: 'Measure', desc: '+20% scrap. The Ward trusts your scales.' },
  inquest: { name: 'Inquest', desc: '+6% critical chance. Nothing hides from you.' },
};

// 0.10 cold open (Opening Act v0.1 + implementation spec). Working text; Don can rewrite any line without changing the flow.
export const COLD_OPEN = {
  arrival: [
    { who: '', text: 'THE NINTH WARD. HALLOWMERE, ITS CAPITAL.' },
    { who: '', text: 'Rain without end, a wall of humming pylons, a code of law older than the wall, and one Warden.' },
  ],
  caseLines: [
    { who: 'Gaoler Brann', text: 'Warden. Caught this one stripping a power cell out of the east pylon. That stretch of the Wall is dark now.' },
    { who: 'Gaoler Brann', text: 'Code says hand or head for theft from the Wall.' },
    { who: 'Mira Toll', text: "My brother's lung-pump died. Three days he's breathed through a wet rag. I'd do it again." },
  ],
  questions: [
    { id: 'dark', label: 'How long has that stretch been dark?', lines: [
      { who: 'Gaoler Brann', text: 'We caught her with the cell still in her hands. That stretch has been dark ever since, and it is dark now.' } ] },
    { id: 'brother', label: 'Your brother. Where is he now?', lines: [
      { who: 'Mira Toll', text: 'Here in the capital. Still breathing through that rag, because the pump is still dead.' } ] },
    { id: 'how', label: 'How did you get the cell out?', lines: [
      { who: 'Mira Toll', text: 'I did what I had to.' } ] },
  ],
  silent: 'Say nothing.',
  // 0.10.7: the Fused Fragment (working name), a unique pack object; not a Core
  fragment: { id: 'fused_fragment', name: 'Fused Fragment', note: 'Not a Core. It cannot be equipped, installed or tempered.',
    look: 'Warm, and faintly humming. The light inside it is the wrong color for anything the Wall burns.' },
  examine: [
    { who: '', text: 'Warm, and faintly humming. The light inside it is the wrong color for anything the Wall burns.' },
    { who: 'Gaoler Brann', text: 'Twenty years I have kept this gaol. The Ward has no name for that.' },
  ],
  objective: 'The east pylon is still dark. Take the fragment. <b>Find what is changing.</b>',
  affinities: [
    { id: 'blade', perk: 'keen_edge', name: 'Blade', desc: 'Keen Edge: +8% damage' },
    { id: 'bulwark', perk: 'plated', name: 'Bulwark', desc: 'Plated: +15 maximum health' },
    { id: 'circuit', perk: 'capacitor', name: 'Circuit', desc: 'Capacitor: build Charge 35% faster' },
  ],
  verdictPrompt: [{ who: 'Gaoler Brann', text: 'The stretch is still dark, Warden. Code still says hand or head. Your verdict.' }],
  // the buttons carry only the sentence; ids map to the existing outcomes (STORY.choices[].after) and traits
  verdicts: [
    { id: 'dread', label: 'Theft from the Wall is theft from every life behind it. The sentence is death.' },
    { id: 'measure', label: 'The cell goes back. She serves the Wall until the debt is paid. Mark her.' },
    { id: 'inquest', label: 'Pylon locks need a Ward key. Who sold you one?' },
  ],
  alarm: [
    { who: '', text: 'A scream cuts through the rain, close, down the street. Then the gaol bell, ringing hard.' },
    { who: 'Gaoler Brann', text: 'Hollowed, in the street! The dark stretch let them through.' },
  ],
};

export const STORY = {
  intro: [
    { who: '', text: 'THE NINTH WARD. HALLOWMERE, ITS CAPITAL.' },
    { who: '', text: 'The Ward runs from these streets out to ruins, buried depths and far country. Its law is yours to keep.' },
    { who: '', text: 'The rain has not stopped in eleven years. Past the Grave Gate, abominations stir. The street calls it the Rot. Some swear the things were people once.' },
    { who: '', text: 'Between them and the capital stands a wall of humming pylons, a code of law older than the wall, and one Warden.' },
  ],
  judgment: [
    { who: 'Gaoler Brann', text: 'Warden {name}. Caught this one stripping a power cell out of the east pylon. That stretch of the Wall is dark now.' },
    { who: 'Gaoler Brann', text: 'Code says hand or head for theft from the Wall. Your verdict.' },
    { who: 'Mira Toll', text: "My brother's lung-pump died. Three days he's breathed through a wet rag. I'd do it again." },
  ],
  choices: [
    {
      id: 'dread', label: 'Execute her. "Theft from the Wall is theft from every life behind it."',
      after: [
        { who: '', text: 'One stroke. The synthblade does not hesitate, and neither do you.' },
        { who: 'Gaoler Brann', text: '...The code is served, Warden.' },
      ],
    },
    {
      id: 'measure', label: 'Sentence her. "The cell goes back. You serve the Wall until the debt is paid."',
      after: [
        { who: 'Warden', text: 'Her hand stays. Her debt is a month of night shifts on the east wall. Mark her.' },
        { who: 'Mira Toll', text: 'And my brother?' },
        { who: 'Warden', text: 'Is not the Wall\'s concern. Nor mine. Take her.' },
      ],
    },
    {
      id: 'inquest', label: 'Question her. "Pylon locks need a Ward key. Who sold you one?"',
      after: [
        { who: 'Mira Toll', text: "...His boy. The gaoler's son. Six coppers for the key." },
        { who: 'Warden', text: 'Then the debt is shared. She serves the Wall a month. Your son hangs at dawn, Brann.' },
        { who: 'Gaoler Brann', text: '...Yes, Warden.' },
      ],
    },
  ],
  breach: [
    { who: '', text: 'Somewhere north, a bell begins to toll. The dark stretch of Wall has let them in.' },
    { who: 'Gaoler Brann', text: 'The Grave Gate! They are in the capital!' },
  ],
  bossIntro: [{ who: '', text: 'They say it was a bell-ringer once. Now it is the bell.' }],
  victory: [
    { who: '', text: 'The Bellwright falls silent. For tonight, Hallowmere holds.' },
    { who: '', text: 'More will come through the Gate. Hunt what remains, temper your steel, and keep the law of the Ward.' },
  ],
};
