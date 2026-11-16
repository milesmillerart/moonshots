# WARDEN — Lore Bible (synced from Don's Drive canon)

> **This file is the source of truth for story, world and system design.** It is a faithful
> consolidation of Don's Google Drive docs. Where it disagrees with `docs/bible.md`, the shipped
> build, or anything an agent remembers, **this file wins**. Nightly improvement passes must
> read it first.
>
> - **Drive folder:** "Warden - A test Game" — https://drive.google.com/drive/folders/1vEgVos85hxS9IqFXMJrvOzjvxi-VPe3p (folder id `1vEgVos85hxS9IqFXMJrvOzjvxi-VPe3p`)
> - **Last synced:** 2026-11-16 ~2:55 PM ET (all files in the folder read in full; no comments on any doc)
> - Don keeps expanding the folder. To re-sync: list the folder, compare each file's Drive
>   `modifiedTime` with the table below, re-read only changed/new files, rewrite that file's
>   section in Part B, then update Part A, the conflicts list and this header.

## Ground rules for agents (from Don's docs — non-negotiable)

1. **Canon levels.** Don's docs mark things as *approved/established*, *working/provisional*
   (favored names, not final), or *open*. Keep those labels. Never promote a provisional name
   or an example to canon.
2. **Do not fill open questions.** "No open question should be silently filled in by the
   autonomous development agent." Do not invent explanations for synth's origin, the Rot,
   abominations' origin, the Tribunal, the Oath, the Presidium's makeup, the empire, or the
   millennium.
3. **The shipped build is a historical snapshot**, not canon. Changing the game to match this
   bible needs a separate, planned task (with migration notes, save compatibility and tests for
   big system changes). Do not set fixed balance numbers or replace Cores without a
   task-specific approval.
4. **Keep systems separate.** Rarity, Temper rank, synth flag, material proficiency, learned
   effects, slotted effects and inscriptions are independent per item. Innate Attunement and
   Wielder Synth Proficiency are independent per character. One source of truth for rarity
   labels and slot counts.
5. **Don't collapse concepts:** Dissonance ≠ the Rot; abominations are not assumed to be
   Dissonance victims; no single universal cause of abominations; no established synth church,
   deity or title yet; the Tribunal is not the Presidium.
6. Don's concept art lives in Drive only (not copied into this public repo). Link, don't rehost.

## Source list

| Doc | Status (Don's label) | Drive modifiedTime (UTC) | ET | Link |
|---|---|---|---|---|
| WARDEN — World, History & Geography | working canon v0.1 | 2026-11-16T19:15:59Z | 2:15 PM | https://docs.google.com/document/d/1gcnUi-M_Qkdmp0JIejRE3fJFZe8fG1TFWD7NF8tBT8g/edit |
| WARDEN — Wards, Paramount & Presidium | working canon v0.1 | 2026-11-16T19:18:36Z | 2:18 PM | https://docs.google.com/document/d/1kal17N2XIzCDjUs1lHw09HVijgMScIKh5ikQqmUns-w/edit |
| WARDEN — Augmentation, Binding & Echoes | working canon v0.1 | 2026-11-16T19:18:41Z | 2:18 PM | https://docs.google.com/document/d/1EFFYWUW4a0Vmg-yxEuLxINumnFHP6thyynE3PIeF8Cs/edit |
| WARDEN — Synth Technology & Equipment Systems | **approved design spec v1.0** | 2026-11-16T17:45:42Z | 12:45 PM | https://docs.google.com/document/d/1IGOZ_IsbfTS027GWvbc5yAdhV59Hn6uI9GiYeARAqKQ/edit |
| WARDEN — Lore Outline (current canon, v0.4) | snapshot of the shipped build (written by Moonshots; unedited since creation) | 2026-11-16T15:42:12Z | 10:42 AM | https://docs.google.com/document/d/1fWx0CWp95JAadPOWlLxfIHjekRb9BLykXko98YRvbdA/edit |
| synthblade-concept-on.jpg (image) | WIP concept art | 2026-11-16T17:11:45Z | 12:11 PM | https://drive.google.com/file/d/1NVCYrg2y2ljCyi5xIAPrbSWF8TD6Dw3M/view |
| synthblade-concept-off.jpg (image) | WIP concept art | 2026-11-16T17:17:09Z | 12:17 PM | https://drive.google.com/file/d/11Xu8hvcSGKZTzeLU1ZTe7Xj_WVoBe21W/view |
| warden-cover-with-blade.jpg (image) | WIP cover art | 2026-11-16T16:47:22Z | 11:47 AM | https://drive.google.com/file/d/1qUTZk4NjHqBSHWvDPNsTqxJY_6vwRQFz/view |

---

# Part A — Consolidated canon (quick reference)

**World.** *Synth-medieval*: a mostly medieval society (gothic cities, fortified settlements,
melee weapons, medieval governance, hard travel) with selective high technology. Augmentation
and powered infrastructure are ordinary; **synth is exceptionally rare, poorly understood,
almost mythologized.** No everyday cars, no universal personal internet/messaging (some
restricted long-distance comms exist). Firearms exist but are scarce/impractical; bows,
crossbows and melee dominate. People maintain inherited systems they can't recreate, but
ordinary craft, medicine and engineering are well understood.

**Vertical civilization.** Cities are built upward on top of older societies; the original
reason is lost. Deeper = older, less understood, more dangerous. Buried societies may have known
things the present cannot explain.

**History.** Earlier civilizations → a centralized **empire** (name open) that collapsed
catastrophically (cause unknown) → an anarchic era of mass death and rising abominations → the
current **Paramount/Presidium + Warden** order, now nearing **~1,000 years** of continuity
(individual Wards have collapsed, been restored, annexed, divided or abandoned). The gap
between collapse and founding is undated. The millennium may become a narrative pressure point;
no prophecy/date/mechanism is canon.

**Politics.** The **Paramount** (title approved; deliberately *not* "King") is the overarching
authority over the Warden order. **Presidium** = favored working name for the central
institution. The order endures because it works better than the empire did, not because it's
just. Each **Ward** is an autonomous province-scale jurisdiction; its **Warden** sets local law
(the local Code), administration and succession, and may rule fairly or tyrannically. Nothing
automatically stops an abusive Warden; in dire cases the centre can charge *other Wardens* to
intervene (no standing central army). Succession is local (hereditary/appointed/elective…).

**A Ward's zones (common pattern, not mandatory):** City (capital; safest; richest NPCs) ·
Ruins (decayed outskirts; scavengers, the poor) · Subterranean (buried older societies; more
dangerous with depth) · Countryside (villages, farms, frontier; thin enforcement).

**The Ninth Ward / Hallowmere.** The Ninth Ward is a large territory; **Hallowmere is its
provisional capital**. Statute Plaza, Lantern Street, the Forge, the gaol, the Grave Gate and
the Tribunal spire can stay as sites in the capital. The Ninth Ward *may* sit over older former
Wards (appealing, unconfirmed).

**The Warden's role.** Ruler/lawgiver/enforcer of a whole Ward (not a city constable) —
writes and keeps the Code, answers upward to the Paramount's order, has better access to
augmentation, may be Bound to the Ward's archive, and inherits predecessors' Echoes. (Don's
original pitch still holds for tone: unapologetic and ruthless but fair and professional,
upholding the law of the land.)

**Abominations & the Rot.** Persistent threats tied to depths, ruins and less-protected lands.
Encounters had become rare for most of this age and are **increasing again — cause unknown**
(more of them? failing defenses? changed patterns?). Wardens, the Presidium and synth religious
authorities hold competing theories. **"The Rot" is street slang**, not a diagnosis or proof of
infection. Origin/nature of abominations is open, and not necessarily single.

**Augmentation.** Common (limbs, organs, blood pumps); quality/access unequal. "Clean"
(unaugmented) people and movements increasingly see augmented people as impure (a social
prejudice, not truth).

**Binding, archives, Echoes.** *Binding* = a locally governed Warden initiation linking a
person's interface and augments to external repositories (required in some Wards, not
others). Each Ward has its own **archive**; syncing needs a physical **jack-in** (no telepathy,
no wireless mind-net). Information flows **up** to a **Greater Consciousness** but generally
not back out. A successor can access predecessors' recorded experiences — insight, not
identity replacement. An **Echo** (working term) is a first-person memory record you can
immerse in; it carries the recorder's bias, errors and gaps, may be fragmented, and better
interface/proficiency/augments recover more (never truth that was never recorded). Inherited
gut feelings ("that family is bad") can be wrong — the player should investigate.

**Dissonance.** Serious instability from failing to reconcile foreign/excessive/fragmented
experience (augmentation and susceptibility may compound it). Not inevitable; augmented people
aren't inherently dangerous. Spectrum of severity; severe cases hard to recover; the extreme is
**complete, irreversible loss of human consciousness** (never reversible). Stage names
(Interference → Dissonance → Fracture → Unraveling → Hollowing) and "Echo Sickness" are
candidates only.

**Synth.** Rare, adaptive, *living* technology. Responds differently to different users,
awakens under the right conditions, remembers material interactions, improves with exposure.
Origin/biology/mechanism deliberately unexplained. **Dormant** synth items pass as ordinary
gear. **Awakened** = responds to a compatible, proficient user. Synth is neither hot nor cold.
Surrounded by a **synth religion/tradition** (shaman-like synth-knowledge figure per Ward); all
structure, names and doctrine deferred to a future religion doc.

**The Synthblade.** A real metal longsword (other shapes/sizes possible) with an **incut
channel along one edge**. Awakened: a contained red synth boundary fills that channel. **Not a
blade of light, not a lightsaber**; silhouette and dimensions don't change. Dormant: same sword,
channel dark.

**Equipment system (approved v1.0).**
- **Rarity:** Base (silver, 0 effect slots) · Uncommon (blue, 0) · Rare (purple, 1) ·
  Legendary (gold, 2) · Exalted (orange, 3 + a character buff *only while equipped*). Independent
  of synth. Tempering/Cores/runes/mastery never raise rarity; a rare costly process may raise
  it by one tier (details open).
- **Innate Attunement** (inborn compatibility; not XP) · **Wielder Synth Proficiency**
  (learned; gates awakening, strength, ability tiers, item-learning speed) · **Item
  Proficiency** (the item's own learning history; stays with the item when it changes hands).
  Unqualified users still get the physical weapon. Enemies/bosses can be highly proficient.
- **Tempering:** Forge upgrade of physical stats, any gear; keep +1..+10 and scrap for now.
- **Material proficiency:** synth items only; weapons and armor learn from meaningful contact
  with materials (wood/flesh/metal/stone are examples); can unlock multiple effects per material;
  anti-farming needed; Rare can max out like Exalted.
- **Status effects:** universal slot mechanic (synth or not). Learned independently, kept when
  unslotted; slot count by rarity; **change slotted effects only at the Forge**. Examples:
  burning, bleeding, discharge, corrosion (not a final list).
- **Runes / Inscription:** engraved modifiers, separate from rarity/effect slots; replacing one
  is costly and destroys the old one; Base items provisionally can't be inscribed. "Runework" /
  "Runewright" are candidate terms.
- **Cores:** keep provisionally as a separate tech component, but **retire "a Core raises
  rarity."** Relationship to runes/effects is open — don't build duplicate stacking systems.
- **Slots (unchanged):** Synthblade, Helm, Cuirass, Gauntlets, Greaves, Mantle.

**Visual canon (concept art).** See Part B §6.

---

# Part B — Per-document notes (re-sync unit)

## B1. World, History & Geography — working canon v0.1
Source: https://docs.google.com/document/d/1gcnUi-M_Qkdmp0JIejRE3fJFZe8fG1TFWD7NF8tBT8g/edit · modified 2026-11-16T19:15:59Z

- **Established:** synth-medieval definition (above); vertical building pattern; Ward = large
  autonomous jurisdiction with City/Ruins/Subterranean/Countryside as a common (not mandatory)
  framework; Ninth Ward is a broad territory with Hallowmere as capital (name provisional);
  history sequence empire → anarchy → current ~1,000-year order; abominations increasing again,
  cause unknown; "the Rot" is colloquial.
- **Provisional:** the name Hallowmere; Ninth Ward possibly standing over former Wards; the
  millennium as narrative pressure.
- **Carried from v0.4, not yet connected to anything:** eleven years of rain, a code older than
  the pylon Wall, the first Warden statue, the Bellwright and the Sump.
- **Guidance:** adjust the old opening narration and geography *during implementation*, not
  silently.
- **Open:** world name; chronology; empire's name/nature; why societies built upward; why
  encounters are rising; Hallowmere's final name/bounds; former Wards' geography; comms network
  realities; whether abominations share one origin.

## B2. Wards, Paramount & Presidium — working canon v0.1
Source: https://docs.google.com/document/d/1kal17N2XIzCDjUs1lHw09HVijgMScIKh5ikQqmUns-w/edit · modified 2026-11-16T19:18:36Z

- **Established:** Paramount (approved title, not King) over the Warden order; Ward sovereignty
  (local laws, Code, administration, succession; rule may be harsh/tyrannical); the stated ideal
  is reciprocal prosperity; local Code ≠ the universal compact (unwritten); no automatic check on
  abusive Wardens; dire-case intervention by other Wardens on the centre's charge; local
  succession; Binding is known Warden practice whose mandatory status varies; legitimacy,
  technological capacity and practical control are independent.
- **Provisional:** "Presidium" name and structure; task-force-like intervention capacity.
- **Deferred:** synth religion (shaman-like figure per Ward) to its own doc; no titles/deity.
- **v0.4 continuity:** "Warden of Hallowmere's Ninth Ward", Brann's local Code and the Tribunal
  spire stay; the Tribunal's constitutional role is open — **not the Presidium**.
- **Open:** Presidium membership; Paramount selection/succession; universal obligations;
  intervention authorization/appeal/refusal; who recognizes usurpers; Tribunal's function; how
  many Wards exist and which are fallen/disputed/replaced.

## B3. Augmentation, Binding & Echoes — working canon v0.1
Source: https://docs.google.com/document/d/1EFFYWUW4a0Vmg-yxEuLxINumnFHP6thyynE3PIeF8Cs/edit · modified 2026-11-16T19:18:41Z

- **Established:** ordinary augmentation; "clean" movements/prejudice; Wardens' better access;
  Binding as local initiation, distinct from innate attunement, Synth Proficiency and interface
  quality; per-Ward archives; physical jack-in sync; one-way upward flow to the Greater
  Consciousness (not confirmed = Presidium); successors access, not assimilate; recording tech not
  Warden-exclusive; Echoes are biased, fallible, possibly fragmented first-person records whose
  fidelity scales with capability; Dissonance spectrum up to irreversible loss of consciousness.
- **Provisional:** the words Echo, Immersion, Echo Sickness; the five Dissonance stage names.
- **Proposed gameplay (not designed):** archive sync as diegetic save points; first-person Echo
  investigation sequences; recovered archives of fallen Wards under the Ninth Ward as an
  exploration/progression source; revisiting Echoes with better gear. **Saves must not imply
  resurrection/immortality — the v0.4 death/respawn needs reconciling.**
- **Open:** what binds to what; which augments allow Echo access; what is recorded and who
  controls it; who runs archives; copying/falsifying/censoring/planting; can the centre send
  back; what happens after consciousness is lost; voluntary transfer; non-Warden repositories;
  how Wards treat Dissonance.

## B4. Synth Technology & Equipment Systems — approved design v1.0
Source: https://docs.google.com/document/d/1IGOZ_IsbfTS027GWvbc5yAdhV59Hn6uI9GiYeARAqKQ/edit · modified 2026-11-16T17:45:42Z

Approved *target* design (not a claim about the current build). Full content summarized in Part
A "Synth", "The Synthblade" and "Equipment system". Additional specifics:
- Guiding rubric: rarity = baseline quality/potential; Tempering = physical construction; synth
  gear learns through exposure; status effects = specialized abilities; runes = inscriptions;
  attunement + proficiency govern synth access; item learning travels with the item. Applies to
  **all** slots and future categories.
- Wielder proficiency doesn't reshape the item or rewrite its base stats.
- Conventional items get effects via craftsmanship or inscription (recipes TBD); conventional
  effects need no synth requirement unless specified later.
- Rune bonuses may improve stats, modify effect behavior or speed progression. Number of rune
  positions per item open. Keep "Innate Attunement" for wielder compatibility only.
- Worked examples (illustrative): A — Rare Synthblade, mastered wood, one effect chosen at the
  Forge; a novice attuned wielder gets weak versions. B — Exalted conventional sword: 3 slots +
  equip buff, no material learning. C — Dormant Exalted Synthblade in unqualified hands: strong
  physical sword, no synth; a proficient boss could awaken it.
- **Open (must not invent):** binary vs spectrum attunement; awakening/ability thresholds;
  material families and exposure rules; effect catalog/leveling/conventional acquisition; rune
  availability/capacity/price/naming; Cores' distinct function; rarity-elevation process/cost;
  Temper balance; Exalted buff pool/stacking; armor interactions; origin of synth; why some
  people are compatible.

## B5. Lore Outline (current canon, v0.4)
Source: https://docs.google.com/document/d/1fWx0CWp95JAadPOWlLxfIHjekRb9BLykXko98YRvbdA/edit · modified 2026-11-16T15:42:12Z (unedited)

The snapshot of what shipped (Ninth Ward places, Mira Toll's Judgment, the four abominations,
Issued→Sovereign tiers, Cores, perks, placeholder names like King Vael, Saint Ossery, default
name Kade). Don's newer docs treat it as **historical**; anything here that conflicts with B1–B4
loses. See `docs/bible.md` for the in-repo version of this snapshot.

## B6. Concept art (images)
- **synthblade-concept-on.jpg** — Awakened Synthblade on grey. Dark gunmetal longsword with a
  segmented grip, faceted pommel with a small red gem, a flat angular crossguard with a red
  triangular gem at the centre. Blade face carries engraved circuit-like channels. **One edge**
  has a recessed channel running from guard to tip filled with a glowing red-to-pink energy
  edge, with white-pink lightning crackling along it and orange sparks/embers. Spine edge is
  plain dark steel. The glow stays inside the channel — no light extends past the blade.
- **synthblade-concept-off.jpg** — the same sword Dormant: identical silhouette; the channel is
  dark metal with a visible stepped notch near the guard and near the tip where the edge insert
  sits. No glow at all; the red gems are dark.
- **warden-cover-with-blade.jpg** — poster: the Warden facing camera, matte black segmented
  plate armour, high collar, tattered black cape to the ground, belt pouches, smooth domed black
  helm with a **red T-visor** and cables running from the back of the helm. Holds the Awakened
  synthblade point-down in front of him with one hand on the guard; red mist and lightning around
  the edge. Background: foggy, dark gothic-industrial towers with small **teal** window lights
  and gantries. "WARDEN" in distressed white caps at the bottom.

---

# Conflicts with current build (v0.7) and needed game changes

Listed by priority. None of these are implemented yet; each needs its own planned task.

1. **Rarity tiers** — build: Issued (grey) / Forged (green) / Tempered (blue) / Relic (violet) /
   Sovereign (gold) with sockets 1/1/2/2/3 and affixes 0–4 (`data.js RARITIES`, `PREFIXES`,
   `SOVEREIGN_NAMES`, inventory "Salvage Issued", icons, save data). Canon: Base silver /
   Uncommon blue / Rare purple / Legendary gold / Exalted orange; effect slots 0/0/1/2/3;
   Exalted equip-only buff. Needs save migration (old index 0–4 → new 0–4 maps cleanly by
   position; colours and names change).
2. **Cores raise rarity** — build: `effectiveRarity = rarity + cores.length` (`items.js`) and the
   power score uses it. Canon: retired. Cores stay provisionally as a separate component; their
   relationship to effects/runes is undecided → **ask Don before redesigning Cores**; the minimal
   compliant change is to stop Cores raising tier.
3. **Synthblade look & behaviour** — build: edge glow always on, glow "grows with rarity and
   Cores", described as red/magenta. Canon: contained red edge in an incut channel on one side
   only, Dormant vs Awakened states, no change in silhouette. Needs a modelled channel, a
   Dormant state (e.g., sheathed/out of combat or before awakening), and an awakening rule.
4. **Death / respawn** — build: "You have fallen… the forge-wardens drag you back to the Plaza.
   Rise, Warden." Canon: saves must not imply resurrection; reconcile (e.g., being dragged back
   wounded is fine; anything implying revival from death is not). Ask Don how he wants defeat
   framed.
5. **Opening narration / scale** — build intro: "HALLOWMERE. THE NINTH WARD." and bible.md calls
   Hallowmere "a walled city" with the Ninth Ward as a district by the Grave Gate. Canon: the
   Ninth Ward is a province-scale territory; Hallowmere is its capital; current map = sites in
   the capital. Rewrite intro text and bible.md geography.
6. **"Things that were once people" / Rot fuses people with scrap** — build intro and bible.md
   assert abominations come from people via the Rot (teal Rot bioluminescence). Canon: the Rot
   is folk slang and abomination origin is open. Soften the narration to in-world belief
   ("they say…") rather than fact. The Bellwright line ("It was a bell-ringer once") is v0.4
   detail the World doc keeps as "known context" — leave it but don't generalize.
7. **King / Old Kingdom placeholders** — "Hearthplate of King Vael", prefix "Old Kingdom"
   contradict the approved "Paramount, not King" (the pre-order polity was an *empire*). Replace
   (e.g., imperial-era phrasing) — names need Don's OK. Also "Saint Ossery", "Saint-Wired",
   "Cathedral" imply an established church; the synth religion is deferred, so treat as
   placeholders to review.
8. **"Tribunal" prefix and "Hands of the Tribunal"** — fine as names, but nothing should imply the
   Tribunal is the Presidium or central government.
9. **Character progression lacks Attunement / Synth Proficiency** — build has XP, perks (Blade /
   Bulwark / Circuit) and no attunement stat. Canon introduces Innate Attunement (inborn) and
   Wielder Synth Proficiency (learned). The Circuit branch is the natural home, but thresholds
   are open → design task + Don's sign-off.
10. **Affixes and status effects** — build rolls random stat affixes on every non-Issued tier
    (Forged gets 1). Canon: Base/Uncommon have 0 effect slots; status effects are learned and
    slotted only at the Forge. Affixes as "baseline stats" may survive; the effect-slot system
    is new work.
11. **Tempering** — matches (+1..+10, scrap, Forge). Keep. Ensure Temper never raises rarity
    (it doesn't today).
12. **Not yet in game (future features from canon):** material proficiency on synth gear; rune
    inscription at the Forge; Echo sequences; archive sync points as diegetic saves (could
    re-skin the 0.5 save system once Don approves); Ruins / Subterranean / Countryside zones;
    "clean" anti-augment faction; Dissonance.
13. **docs/bible.md** — its "Systems vocabulary" and "Hallowmere" sections are now outdated; it is
    kept as the v0.4 snapshot, and this file overrides it.

# Open questions for Don (collected)
- Defeat/death framing given "no resurrection".
- What Cores become (keep as a 4th system? fold into runes or effects? retire?).
- How a synth item is Dormant vs Awakened in play (combat stance? attunement gate at story start?).
  Is the player's Warden innately attuned?
- Replacement names for King Vael / Old Kingdom / Saint items, and whether default name "Kade" stays.
- Is the current Grave Gate/Statute Plaza map the City, or should the next zone be Ruins or
  Subterranean?
- Tribunal's role; what the Oath says; the Ward's universal compact.
- Exalted buff examples; first status-effect list to implement.
- Plus every "Open" item listed in B1–B4.
