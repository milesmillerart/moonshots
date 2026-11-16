# WARDEN — Lore Bible (synced from Don's Drive canon)

> **This file is the source of truth for story, world and system design.** It is a faithful
> consolidation of Don's Google Drive docs. Where it disagrees with `docs/bible.md`, the shipped
> build, or anything an agent remembers, **this file wins**. Nightly improvement passes must
> read it first.
>
> - **Drive folder:** "Warden - A test Game" — https://drive.google.com/drive/folders/1vEgVos85hxS9IqFXMJrvOzjvxi-VPe3p (folder id `1vEgVos85hxS9IqFXMJrvOzjvxi-VPe3p`)
> - **Last synced:** 2026-11-16 ~3:10 PM ET (folder re-listed; new doc: The Prismatic Order; all other docs unchanged since the 2:55 PM sync; no comments on any doc)
> - **Don's written direction (2026-11-16):** `docs/direction-2026-11-16.md` — summarized and tagged in the "Direction from Don" section below.
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
   Dissonance victims; no single universal cause of abominations; the Tribunal is not the
   Presidium. The religion is now the **Prismatic Order** (members: **Prisms**) — but no named
   high priest, parish hierarchy, miracles, deity or fixed creed (see B7). The Order did not
   (canonically) create abominations or the old catastrophe.
6. Don's concept art lives in Drive only (not copied into this public repo). Link, don't rehost.

## Source list

| Doc | Status (Don's label) | Drive modifiedTime (UTC) | ET | Link |
|---|---|---|---|---|
| WARDEN — World, History & Geography | working canon v0.1 | 2026-11-16T19:15:59Z | 2:15 PM | https://docs.google.com/document/d/1gcnUi-M_Qkdmp0JIejRE3fJFZe8fG1TFWD7NF8tBT8g/edit |
| WARDEN — Wards, Paramount & Presidium | working canon v0.1 | 2026-11-16T19:18:36Z | 2:18 PM | https://docs.google.com/document/d/1kal17N2XIzCDjUs1lHw09HVijgMScIKh5ikQqmUns-w/edit |
| WARDEN — Augmentation, Binding & Echoes | working canon v0.1 | 2026-11-16T19:18:41Z | 2:18 PM | https://docs.google.com/document/d/1EFFYWUW4a0Vmg-yxEuLxINumnFHP6thyynE3PIeF8Cs/edit |
| WARDEN — Synth Technology & Equipment Systems | **approved design spec v1.0** | 2026-11-16T17:45:42Z | 12:45 PM | https://docs.google.com/document/d/1IGOZ_IsbfTS027GWvbc5yAdhV59Hn6uI9GiYeARAqKQ/edit |
| WARDEN — The Prismatic Order | working canon v0.1 | 2026-11-16T20:02:12Z | 3:02 PM | https://docs.google.com/document/d/1CepYHrX481or4ncRpdMg89XGGWY-FIFQjV-ufIsOg0U/edit |
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
Studied and revered by the **Prismatic Order** (see below). Default synth colour is
purple-pink/fuchsia (Order doc); the Synthblade's approved edge look is the red-to-pink
contained barrier in the concept art.

**The Prismatic Order (working canon v0.1).** The world's primary scientific *and* religious
institution. Members are **Prisms**. Maxim: *"To understand is to be divine."* Pursues knowledge
and implementation of synth and hoped-for proof of a higher order that made synth accessible
(unproven). One broad Order with sub-sects and wide interpretive freedom (incl. attunement-purist
zealots under its umbrella; the anti-augment "Clean" are separate). Runs parallel to the Warden
system, not bound to Ward borders; Wardens *may* employ a Prism but needn't. Uneasy, pragmatic
tolerance by the Wardens. Main income: supplying synth tech/expertise to the Presidium.
Publicly known, semi-secretive internally. Colleges are the usual path to recognition, not the
only one. Attunement ≠ divine selection (prevailing view, not a binding creed).

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

# Direction from Don, 2026-11-16

Source: Don's written "Development Questions & Direction" (saved as `docs/direction-2026-11-16.md`).
Tags: **[ESTABLISHED]** canon · **[RECOMMENDED — pending]** Don's preferred direction, usable as a
reversible starting point but not formally decided · **[OPEN]** still undecided.

1. **Defeat.**
   - [RECOMMENDED — pending] Checkpoint-based: defeat returns the player to the last
     synchronization point. It is a *gameplay rewind*, not a canonical resurrection; the
     character did not die and come back. Physical sync locations can be save points.
   - [ESTABLISHED guardrail] Binding / Greater Consciousness do not reconstruct bodies, restore
     the dead, or duplicate the Warden. Avoid "Rise, Warden"; use neutral wording such as
     "Defeated" / "Synchronization Restored". Death screen + retry is enough; no penalties yet.
   - [OPEN] Penalties, lost resources, recovery mechanics.
2. **Cores.**
   - [ESTABLISHED] Cores no longer increase rarity. Rarity, Tempering, learned material effects
     and Runes are separate systems.
   - [RECOMMENDED — pending] Cores stay a distinct technological module that changes how
     compatible equipment behaves (damage-type interactions, defense, utility); predictable,
     with tradeoffs and compatibility rules; not a replacement for adaptive proficiency.
     Arc/Ember/Leech/Bastion/Kinetic/Overclock/Edge stay as provisional categories.
   - [ESTABLISHED for now] Preserve existing Core functionality where practical; **no new Core
     rules, slots, progression or crafting** without approval.
3. **Attunement & Awakening.**
   - [ESTABLISHED] Innate attunement exists at varying levels; proficiency grows with
     experience/training.
   - [Don's preference] The player Warden has *some* innate attunement, not exceptional; not a
     chosen one / divinely selected.
   - [RECOMMENDED — pending] Awakening = compatible synth item + successful interaction of
     wielder, attunement and proficiency; higher proficiency makes it easier/more effective;
     the item keeps its shape. Synthblade awakened = contained barrier along the inset edge
     channel; dormant = still a working sword. Conditions discovered through play, no elaborate
     tutorial.
   - [ESTABLISHED guardrail] No religious blessing, bloodline or named ritual is universally
     required.
4. **Names.**
   - [ESTABLISHED] Paramount (not King); Presidium (provisional) as the central institution; a
     Ward is an autonomous territory governed by its Warden; Hallowmere = provisional capital of
     the Ninth Ward. Prismatic Order / Prisms; independent of Warden government, crosses
     territories, Wardens need not employ a religious adviser.
   - [ESTABLISHED rule] "King Vael" → "Paramount" only where the character actually holds that
     office; don't assume Vael is the current Paramount or finalize identity. Review each
     "Saint" individually (a scholar might be a Prism); no blanket replace.
   - [ESTABLISHED for now] **Kade** stays as the provisional default name, editable.
   - [ESTABLISHED guardrail] No new canonical rulers, religious authorities, family histories or
     biographies without approval.
5. **Next zone.**
   - [RECOMMENDED — pending] **Ruins first, then Subterranean** (City → Ruins → Subterranean, not
     strictly linear; short underground entrances in the Ruins may tease deeper areas). Ruins =
     inhabited/exploited decline, not a monster wasteland. One coherent explorable area beats
     many unfinished ones.
   - [ESTABLISHED — Don update, 2026-11-16 ~3:47 PM ET] **Ruins are NOT next.** Complete the first
     area (Hallowmere, the capital) before any new zone; the Ruins come later (the City → Ruins →
     Subterranean order above still stands, it just starts after Hallowmere is finished).
   - [AWAITING DON'S INPUT] **The opening / start of the game.** Don wants to shape it himself.
     0.8 only applied the canon fixes to the intro text (capital, the Rot as slang, belief not
     fact); no further rework of the intro, title flow or first minutes until he weighs in.
6. **Priorities (ESTABLISHED order):** (1) rarity names/colours/effect slots; (2) remove
   Core-driven rarity promotion; (3) Synthblade dormant/awakened visuals; (4) remove resurrection
   implications from defeat text; (5) Ninth Ward geography + "the Rot" references; (6) begin
   replacing placeholder political/religious terms. Then (Don, original direction) a focused Ruins
   expansion; superseded by the 3:47 PM update: complete Hallowmere first. The
   Prismatic Order influences NPCs, dialogue, environment, institutions and lore only — **no
   reputation/membership/faction/college system yet**.

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

## B7. The Prismatic Order — working canon v0.1
Source: https://docs.google.com/document/d/1CepYHrX481or4ncRpdMg89XGGWY-FIFQjV-ufIsOg0U/edit · modified 2026-11-16T20:02:12Z

- **Established — identity:** name *The Prismatic Order*; members *Prism / Prisms*. Both religious
  and scientific; not a Warden government, not a combat mage guild, not a local priesthood. A
  Prism may be an engineer, theoretician, physician, archivist, historian, theologian, explorer
  or wielder; synth proficiency is not required for authority. Maxim: **"To understand is to be
  divine."** Goal: expand knowledge and implementation of synth and seek proof of a higher being /
  intelligence / fundamental order believed to have made synth accessible. No proof exists; its
  nature and the faith's correctness are unknown.
- **Established — symbolism:** synth's purple-pink/fuchsia light and *refraction* (a prism reveals
  hidden components; scholars refract the same mystery differently). Not every robe or building
  glows; whether light is worshipped is not established.
- **Established — theology:** knowledge and inquiry are sacred; observation, experiment, recovering
  lost tech, preserving records and applying discoveries can be devotion. Ritual may encode real
  working procedures (none canonized). Prevailing view: innate attunement is natural, origin
  unknowable short of full enlightenment; attunement ≠ divine selection (widely held, not a binding
  creed). Enlightenment's mechanism/feasibility is OPEN. Innate Attunement, Wielder Synth
  Proficiency and **Synth Knowledge** are distinct.
- **Established — sects:** one broad Order with sub-sects and local scholarly cultures; individual
  Prisms have wide latitude. Attunement-purist zealots (exceptional attunement = divine election)
  exist under the umbrella; the anti-augment "Clean" are separate. Ethical disputes over hazardous
  research; no universal risk threshold or licence to harm.
- **Established — politics:** parallel to the Warden system; not bounded by Wards. Wardens may
  invite/commission/employ a Prism; not required. Serving a Warden doesn't make a Prism a civil
  servant. Wardens don't fully trust the Order (opaque experiments vs duty to protect) but
  tolerate it (tradition; losing its expertise would be worse). No automatic immunity from Ward law.
- **Established — economy:** principal income is supplying synth technologies, services and
  expertise to the Presidium. Contracts, pricing, exclusivity, manufacturing control: OPEN. The
  Order does not make all technology or control all augmentation.
- **Established — secrecy:** publicly known (Prisms and some institutions recognizable), internally
  semi-secretive. No hidden mastermind, conspiracy or secret proof of divinity.
- **Established — colleges:** formal training/admission required to be a recognized Prism; college
  is the traditional path (ancient college + technical institute + religious academy), studying
  synth theory, history, research, theology, consciousness/augmentation. Not one-per-Ward. Also:
  apprenticeship under a Prism, or recognition of an exceptional independent researcher — same
  title, no inferior grade.
- **Design direction:** scholarly reputation separate from administrative office and political
  power; no mandatory central chain of command.
- **Provisional — NOT canon:** ranks Aspirant / Initiate / Prism / Preceptor / Luminary (only Prism is
  final); an initiation exercise "the Refraction". No fixed five-level ladder.
- **Established framework — sites:** colleges, sanctuaries, workshops, research communities,
  expeditions, religious areas — can sit beyond normal Ward geography, incl. subterranean sites;
  may be agreed, tolerated, disputed or out of reach; not sovereign states.
- **Guardrails:** Prisms may know synth, interfaces, Echoes and Binding, but these aren't
  Order-exclusive. No automatic link Dissonance ↔ Rot ↔ abominations. Don't presume the Order
  created abominations or the old catastrophe. Use "Prismatic Order"/"Prism(s)"; review each old
  "Saint" individually. **Don't add:** Warden-bound parishes, compulsory Warden-appointed priests,
  religious police, a named high priest, mandated miracles, a fixed statement about synth's
  creator. Synth is purple-pink/fuchsia by default; equipment may have its own approved look. Keep
  the Order morally ambiguous (not all enemies, not all good; devout Wardens aren't subordinates).
  New religious mechanics only as reversible proposals.
- **Open (author-reserved):** founding/age; colleges' names/number/locations; leadership; who
  approves non-college admission; initiation form; reality of enlightenment; whether synth was
  gifted; depth of the Order's understanding; restricted archives/tech; dealings with the
  Paramount; rules at Order sites; whether named NPCs are Prisms; rites, symbols, clothing;
  factions and relations with the Clean; any hidden discovery behind the secrecy.

---

# Conflicts with current build (status after 0.8)

0.8 (2026-11-16) implemented Don's priorities 1-6. Each change is reversible.

**Resolved in 0.8**
1. ~~Rarity tiers~~: now Base (silver) / Uncommon (blue) / Rare (purple) / Legendary (gold) / Exalted
   (orange). Effect slots are 0/0/1/2/3. Save schema 4 maps old tiers by position.
2. ~~Cores raise rarity~~: removed. Power uses base rarity. Core effects are unchanged. *Provisional:*
   effect slots hold Cores until status effects are designed. Cores already installed on Base or
   Uncommon gear in old saves are kept (that item keeps one slot per installed Core).
3. ~~Synthblade~~: a steel longsword with an inset channel along its one edge. Awakened = a contained
   red barrier inside the channel (lightning stays in the channel; no wide glow sheath, no mist).
   Dormant = a dark channel and dark gems. The shape is identical in both states. It wakes in combat
   (attacking, dodging, the riposte window, lock-on, or an aggressive abomination within 16 m) and
   settles about 2.5 s after. There is no ritual or tutorial. The "glow grows with rarity/Cores"
   behaviour is gone. The statue blade is always Dormant.
4. ~~Death / respawn~~: "Defeated" → resume from the last synchronization point (Statute Plaza) with
   everything kept → "SYNCHRONIZATION RESTORED" banner. No penalties. (Don: recommended, pending.)
5. ~~Opening narration / scale~~: "THE NINTH WARD. HALLOWMERE, ITS CAPITAL." The Ward runs out to
   ruins, depths and countryside, and the map is a few sites in the capital. Banners and objectives
   now say Hallowmere or "the capital".
6. ~~"Things that were once people" / Rot as fact~~: now "The street calls it the Rot. Some swear the
   things were people once." The Bellwright line is "They say it was a bell-ringer once." Objectives
   say "Hunt the abominations".
7. ~~King / Saint / Old Kingdom / Cathedral placeholders~~, each reviewed on its own:
   "Hearthplate of King Vael" → "Vael's Hearthplate" (Vael's identity left unresolved; not made
   Paramount). "Saint Ossery's Verdict" → "Ossery's Verdict" (no evidence Ossery is a scholar, so not
   made a Prism). "Saint-Wired" prefix → "Lattice-Wired". "Cathedral" prefix → "Spire-Wrought". "Old
   Kingdom" → "Elder-Wrought". "Crown of the Unblinking" → "Visor of the Unblinking" (royalty
   implied). The "Tempered" prefix → "Quenched" (it clashed with Tempering). Old saves are renamed in
   migration. Kade stays the default name and can be edited.

**Still open / not yet in game**
8. Tribunal names (the "Tribunal" prefix, "Hands of the Tribunal") stay as names. Nothing implies the
   Tribunal is the Presidium.
9. No Innate Attunement or Synth Proficiency stats yet. The player is not a chosen one. Awakening
   conditions are to be discovered through play (pending Don).
10. Affixes stay as "baseline stats". Status effects as a separate learned, Forge-slotted system are not
    built; Cores stand in for them.
11. Tempering matches canon (+1..+10, scrap, Forge) and never raises rarity.
12. Not built yet: material proficiency, runes/Inscription, the Exalted buff (placeholder line in the
    UI), Echo sequences, archive sync points as in-world save points, Ruins/Subterranean/Countryside,
    the "Clean" faction, Dissonance, Prismatic Order NPCs.
13. Synth colour: the Order doc says synth is purple-pink/fuchsia by default, but the approved
    Synthblade concept art is red-to-pink, so 0.8 follows the art for the blade. Other synth (Order
    emblems, future items) should default to purple-pink.
14. The neon "ROT" sign at the Grave Gate stays as street graffiti, which fits slang usage.
15. `docs/bible.md` is the old v0.4 snapshot. This file overrides it.

# Open questions for Don (collected)
- Final approval of checkpoint defeat (recommended). Zone order: Hallowmere first is now established; Ruins after it.
- The game's opening / start: awaiting Don's input.
- Cores long-term: Don recommends distinct modules with tradeoffs and compatibility rules. Details
  pending. Should Cores keep occupying effect slots once status effects exist?
- The Exalted buff pool. The first status-effect list. Awakening thresholds. Attunement as binary or
  a spectrum.
- Identities of Vael and Ossery (renamed neutrally for now). Whether any existing NPC (Brann, Mira)
  is a Prism (default: no).
- The Tribunal's role; the Oath's text; the Ward's universal compact.
- Plus every "Open" item listed in B1–B4 and B7.
