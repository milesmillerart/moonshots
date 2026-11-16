# WARDEN — Game Vision & Possibilities (consolidated)

Source: Don's Drive doc **"WARDEN — Game Vision & Possibilities (Living Document v0.1)"**, https://docs.google.com/document/d/112YgYYK5LluEmvi4Vol-T--E7VxbYcSVsXza7iile6w/edit, in the lore folder (https://drive.google.com/drive/folders/1vEgVos85hxS9IqFXMJrvOzjvxi-VPe3p). Synced 2026-11-16 ~4:40 PM ET.
Re-sync: re-read the Drive doc and replace this file section by section. Keep Don's own status labels. Never upgrade a label here.

**How to use this file (the doc's own rules):** this is creative direction, **not** a to-do list. Nothing here authorizes implementation. An idea becomes buildable only when Don promotes it to **APPROVED FOR DEVELOPMENT** with success criteria, dependencies and safeguards. `docs/lore.md` defines established facts and outranks this file on canon; approved specs define scope; tests verify behavior. Preserve save compatibility and (once it exists) the consequences ledger.

Labels used below, from the doc: **CANON** (verified in current lore) · **VISION** (desired long-term experience) · **POSSIBILITY** (speculative) · **DECISION NEEDED** (not established) · **APPROVED FOR DEVELOPMENT** (none yet). My tags: **[established]** = Don's stated intent or rule; **[idea]** = possibility/vision, not approved.

---

## Executive vision
- **VISION [established intent]:** a large, immersive, third-person open-world action RPG. You are a Warden, an enforcer of law in a dangerous cyber-medieval society: explore, fight, investigate, judge, build capability, and shape a consequential political and social world. Not good-vs-evil: different people and institutions judge your actions by law, interest, knowledge, history and circumstance.
- **Defining promise [established intent]:** *the world remembers what you do, but not everyone knows the same things or responds the same way.* (A lawful execution may win one faction, cost an ally, harm a family, close off opportunities; sparing has other costs.)
- **Visuals are foundational [established intent]:** current graphics are a proof of concept. The long-term art target follows Don's supplied concept art, not the current implementation. **DECISION NEEDED:** attach/link the artwork and say which images are authoritative.

## 1. Feeling and references
- **VISION:** oppressive, atmospheric, believable, dangerous, richly detailed, emotionally consequential. The Warden is formidable in combat but never immune to politics, fear, loyalty and the repercussions of authority.
- **References (inspiration, not feature parity):** Skyrim (exploration, freedom), The Witcher 3 (ambiguous quests, delayed outcomes), Cyberpunk 2077 (progression, tech atmosphere), Red Dead Redemption 2 (living world, observed NPCs), Baldur's Gate 3 (agency, alternate approaches), Game of Thrones (ruthless lawful authority, allegiances, political consequence).
- **Player questions to provoke:** Who will remember this? Who knows what actually happened? Was that legal but politically disastrous? What changes if I ignore it, investigate, or kill the person?

### Visual direction (first-class requirement)
- **VISION:** art direction, animation, lighting, environmental storytelling and presentation matter enormously; evaluate new visual work against an approved reference set.
- **CANON (current art vocabulary):** dark cyber-medieval city; near-black greys; red/magenta Synthblade glow; teal Rot/city lighting; heavy fog, constant rain; Warden in dark plate with red T-visor and mantle. These are facts of the current art, not a constraint against later redesign within the approved direction.
- **POSSIBILITY (criteria to define from the reference images):** silhouettes and armor materials; architecture and density; grounded vs stylized proportions; texture/weathering; volumetric light, mist, rain, reflections; creature design; combat VFX, hit reactions, animation; camera framing; UI/typography; quality tiers at gameplay distance.
- **DECISION NEEDED:** which images are authoritative and what to preserve vs reinterpret; define a visual quality benchmark in one representative playable street/combat encounter **before scaling the world**. (Note: in 0.8 the Synthblade and Warden were matched to `synthblade-concept-on/off.jpg` and `warden-cover-with-blade.jpg` from the lore folder; whether those are the authoritative set is still Don's call.)

## 2. Core loop
- **Minute to minute [VISION]:** third-person movement/exploration, observing, conversing, investigating/interacting with objects, real-time Synthblade combat, dodging and abilities, loot and resources, unmarked encounters.
- **Hour to hour [VISION]:** travel districts and beyond, uncover crimes/conflicts, investigate and choose approaches, render judgments or act, immediate and delayed consequences, grow skills and relationships, acquire/Temper gear, install Cores, intertwined personal/political/overarching arcs.
- **Design principle [established intent]:** meaningful scenarios often allow more than one response (question, search, negotiate, apprehend, punish, fight, flee, decline), within plausibility, the Warden's code and world state. Combat is vital but not the only solution.

## 3. Scale, structure, replayability
- **VISION:** large open world, substantial authored campaign, extensive optional exploration, distinct settlements/regions, replayability through changed outcomes; inhabited and worth revisiting rather than just large; the world keeps developing while you pursue other goals.
- **CANON (as written in the doc, from Lore Outline v0.4):** one playable district; the Sump is future/not playable; other wards implied. *Conflict note:* the doc says "one playable district of Hallowmere: the Ninth Ward", but newer canon (World, History & Geography v0.1; docs/lore.md) has the Ninth Ward as a province-sized territory with Hallowmere as its provisional capital. lore.md wins; flagged for Don.
- **POSSIBILITY:** NPC schedules, local economies, rival organizations, regional crises, rumor spread, crime and political responses. Depth over indiscriminate procedural content.

## 4. What WARDEN should never be [established]
- Not a simple honor/karma bar.
- Not a world where every decision resolves to the same storyline.
- Not a giant empty map.
- Not NPCs that merely repeat scripted quest prompts.
- Not an action game where violence has no social cost.
- Not an AI conversation demo whose dialogue can contradict canon or rewrite quests.
- Not a live-service grind at the expense of narrative integrity.
- Not a game whose final look is defined by expedient proof-of-concept assets.
- Freedom must not mean incoherence: improvised conversation stays grounded in the character's knowledge, motives, location and permitted actions. The Warden's harsh-but-lawful code guides authored choices. **DECISION NEEDED:** whether unlawful player actions are possible and how they are adjudicated.

## 5. Must-haves, stretch goals, technical principles
**Foundational must-haves (long-term VISION):**
- Third-person exploration and a responsive real-time combat system.
- A rich, visually cohesive world aligned with approved reference art.
- Progression, equipment, Cores, skill specializations, Tempering.
- Persistent records of consequential choices and their immediate/delayed fallout.
- Context-specific institutional, personal and community reactions (not binary morality).
- Meaningful NPC and environment interactions; alternate approaches where appropriate.
- Quest and world-state changes that honor important actions.
- A deep authored narrative backbone that can respond to significant branches.

**High-ambition POSSIBILITIES (research/prototype only):**
- AI natural-language conversations with individually parameterized NPCs.
- NPC memory, rumor transmission, different access to facts.
- Harming/killing many non-hostile NPCs with credible legal and narrative consequences.
- Dynamic arrests, interrogation, incarceration, investigation, trials.
- Succession, replacements, lost questlines and emergent follow-ups after NPC deaths.
- Interdependent factions, political power, social routines, regional systemic events.
- A broadly interactable world, limited by believable affordances and performance.

**The Consequence Engine — primary differentiator (VISION; implementation principle is *proposed*):**
- Significant events record actor, action, target, location, time, relevant law, witnesses, evidence, who learns later, affected relationships/institutions, irreversible changes. Each faction/individual interprets through its own goals and knowledge. Consequences fire immediately, delayed, or on another event.
- World truth ≠ knowledge: "the player killed someone" vs "the Tribunal knows". Dialogue may only use what the speaker knows; characters can be wrong, lie, withhold, infer, spread rumor without changing the authoritative record.
- Proposed principle: a deterministic structured world state + event ledger is the source of truth, changed only by authored rules and validated game actions. An AI model may voice dialogue and propose allowed interactions but never modifies canon, invents completed quests or overwrites state.

## 6. Story, quests, consequences, endgame
- **CANON (current build):** Hallowmere; the Ninth Ward; an ancient code of law; the Wall of pylons; the Grave Gate; the Rot; the distant Tribunal spire; Gaoler Brann; Mira Toll; the Bellwright; the Dread / Measure / Inquest judgments. The story currently ends after the Bellwright and ongoing fights. The wider political and historical story is unwritten.
- **VISION:** an overarching story about law vs justice, survival, legitimacy, power, loyalty and the Warden's role; playthroughs diverge meaningfully without every choice spawning a separate campaign.
- **EXAMPLE POSSIBILITY:** a lawful execution angers a political body that found the prisoner useful; some citizens approve, a witness loses faith, a rival exploits it; sparing creates a security risk or an obligation. Neither is labeled good or evil.
- **Presidium — DECISION NEEDED (per this doc):** Tribunal, a branch of it, a rival, or something else? Do not merge silently. *Note:* the later Wards, Paramount & Presidium doc already makes the Presidium the provisional central institution (docs/lore.md B2); its relation to the Tribunal is still open.
- **CANON TO EXPAND:** Mira's Dread/Measure/Inquest choice affects the scene and a persistent trait but not future NPCs, prices or quests yet. Flagged by Don as an excellent contained prototype for delayed consequences (Mira's family, Brann and his son, the Wall, witnesses, public sentiment, later access to information).
- **Endgame — DECISION NEEDED:** candidates are a resolved campaign then a changing world of Warden duties, post-campaign faction conflict/investigations, escalating Rot threats, divergent political outcomes. Prioritize a satisfying ending before infinite content.

## 7. Monetization — DECISION NEEDED
- Not specified by Don. Candidate for discussion: a traditional premium single-player release, optional substantial expansions later.
- Do not assume subscriptions, cosmetic shops, multiplayer or live service without an explicit decision. Monetization must not undercut choices or visual/narrative quality.

## "What If?" idea bank (all POSSIBILITY; none approved)
Entry format the doc asks for: ID, working title, question, category, motivation, possible consequences, canon links, technical dependencies, status, decision/next experiment.
- **WI-001 The Ward Remembers:** important judgments change how specific people see you, who talks to you, which quests are possible. First prototype: branches of Mira Toll's case.
- **WI-002 Everyone Knows Something Different:** responses depend on what an NPC witnessed, heard, misunderstood or concealed; a secret murder isn't instantly public.
- **WI-003 Living NPC Conversations:** natural speech with many inhabitants shaped by identity, relationships, routines, events, bounded memories. Needs moderation, safeguards, cost/latency targets, fallback dialogue, authoritative world-state control.
- **WI-004 Nobody Is Entirely Plot-Protected:** key NPCs can die (loss of information, succession, investigation, retaliation, alternate paths); define exceptions carefully.
- **WI-005 The Environment Responds:** objects, doors, evidence, equipment, homes, shops, infrastructure with contextual interactions that matter later; a believable verb set over "everything is usable".
- **WI-006 A Visual Slice Worth Building Toward:** rebuild one street, one indoor scene and one combat encounter toward the final reference-art target, setting models, materials, lighting, post, effects and performance budgets before the world expands.

## Open decisions (from the doc, verbatim order)
1. Attach/link the artwork and decide which references are canonical targets.
2. Resolve the Presidium / Tribunal relationship.
3. Define the Warden's authority and lawful vs unlawful player action.
4. Which NPCs can be killed and how quests continue after a death.
5. A practical natural-language NPC prototype scope and content safeguards.
6. How consequences propagate across story beats and how much time may pass.
7. World-size ambition in phases, and a visually compelling vertical slice.
8. Campaign end-state and post-campaign philosophy.
9. Whether premium single-player monetization matches Don's goals.

## Fit with 0.8 and the current roadmap (my notes, not Don's)
- No conflict with the 0.8 scope; 0.8 is unchanged by this doc.
- It strongly supports Don's 2026-11-16 update "complete Hallowmere before any new zone" (open decision 7, WI-006: benchmark a slice before scaling).
- Cost note: WI-003 (AI NPC conversations) would need a paid model/API and a backend. That is a cost, so it needs Don's explicit approval before any prototype.
