# WARDEN roadmap: daily improvement backlog

**Lore rule (from 0.8): read `docs/lore.md` first.** It is synced from Don's Drive canon and overrides everything here. Never fill an open question, never promote a provisional name to canon, and keep Don's tags (established / recommended-pending / open). Anything below that conflicts with `docs/lore.md` waits for Don.

Rule: every night ships one or two visible improvements (graphics a little at a time, feel, content). Each gets a line in `game/data/changelog.json`. Run `tools/shots.py` (desktop), `tools/mobile_test.py` (phone emulation) `tools/save_test.py` (saves) `tools/inventory_test.py` (Armory) and `tools/skills_test.py` (skill tree) before shipping. Any change to the save shape must bump `SCHEMA` in `game/src/save.js` and add a step in `migrate()` so no player loses progress; zero console errors.

## Now (next 7 nights, highest impact first)
-1. ~~**Lore alignment (Don's priorities 1-6, 2026-11-16 direction)**~~ shipped 2026-11-16 (build 0.8): rarity Base/Uncommon/Rare/Legendary/Exalted (colours silver/blue/purple/gold/orange), effect slots 0/0/1/2/3 (Cores fill them for now; Cores already installed on Base/Uncommon gear are kept), Exalted buff = labelled placeholder, Cores no longer promote rarity (Power uses base rarity), save schema 4 (tiers by position, item renames), Synthblade with an inset edge channel: Awakened (contained red barrier, arcs stay in the channel) in combat, Dormant (dark channel, dark gems) out of combat, shape unchanged; defeat = "Defeated" + resume from checkpoint + "Synchronization restored" (no penalty); Hallowmere = capital of a province-sized Ninth Ward, "the Rot" as street slang, "were people once" as belief; King/Saint/Cathedral/Old Kingdom placeholders neutralized. Test: `tools/rarity_test.py` + all suites.
0. ~~**Saving (Don's #1 ask)**~~ shipped 2026-11-16 (build 0.5): `game/src/save.js` with versioned schema 2 and migration from the 0.1-0.4 single save (`warden.save.v1` copied into slot 1, old key kept), 3 slots (`warden.slot.N` + `.bak` of the previous write), title slot picker (name, level, verdict, chapter, area, play time, last saved; Play/Export/Delete, New/Import), Continue = most recent slot, event autosaves (pickup, equip, salvage, forge, Cores, perk, level, verdict, wave clears, boss, area change) + 15 s periodic + pagehide/visibilitychange/beforeunload, ground loot + facing/camera saved, pause-menu Save now + HUD "Saved" mark, export/import as a checksummed code or `.wsave.txt` file. Test: `tools/save_test.py` (desktop + iPhone 13/Pixel 7/SE landscape). Follow-ups: cloud sync only if Don approves a backend; "Ledger" of past Wardens; warn when two tabs play the same slot.
1. ~~**Inventory management visualization (Don's #2 ask)**~~ shipped 2026-11-16 (build 0.6): `game/src/inventory.js` (Armory screen), `preview.js` (live turning 3D Warden in a second small WebGL canvas, tinted by worn tiers, drag to turn), `icons.js` (procedural SVG icons per slot + Cores). Paper-doll with 6 slots, stat sheet + Power, pack grid with tier frames/Temper/socket pips/NEW/▲ upgrade marks, filter by slot/Cores/tier, sort newest/rarity/power/slot, inspect panel with Temper bar, Cores, compare vs equipped (green/red deltas), select then tap again to equip, Lock (protects from salvage), salvage with confirm, bulk salvage of unlocked Issued, Forge entry. Save schema 3 adds item `got`/`seen`/`fav` with migration. Test: `tools/inventory_test.py`. Follow-ups: gear visibly changing the 3D model per item (helm/pauldron variants), drag-and-drop on desktop, item comparison for Cores, stash beyond the pack.
2. ~~**Skill tree visualization (Don's #3 ask)**~~ shipped 2026-11-16 (build 0.7, deploy 9cca1b4c53): `game/src/skills.js`. SVG circuit-constellation of all 15 perks growing from an Oath root, procedural glyph per perk, node states locked/open/available/owned/mastered with rank arcs, traces + tier gates (TIER_REQ numbers) that light as you invest, charge line when a tier opens, branch tabs that zoom the view, inspect panel (exact effect now/next rank, requirement with points invested, cost, leads-to), hold-to-learn or tap again + Confirm, keyboard arrows + Enter, burst/flash/chime unlock, big skill-point counter + per-branch progress, respec at the Forge (15 scrap per point, two-tap confirm). No save change. Test: `tools/skills_test.py`. Follow-ups: free drag/pinch pan-zoom, respec preview (plan points before committing), new active abilities per branch (see Skill tree v2).
3. ~~**Combat feel pass**~~ shipped 2026-11-16 (build 0.2): perfect dodge (0.24 s window, enemy time-dilation, guaranteed-crit Riposte), final-kill slow-mo + FOV punch, heavy wind-up crouch/lean + blade charge, enemy hit-react flinch, dodge-cancel windows, trail only during the cut. Follow-ups: a true parry on heavy-attack timing, and per-move recovery tuning once gamepad lands.
4. ~~**Warden model v2 + Synthblade + Abomination art**~~ shipped 2026-11-16 (build 0.4): procedural sculpted Warden (lathe/shell/tube parts baked to one mesh per material per bone), T-visor helm + rear cables, verlet cape, rest pose (blade point-down when calm), stride/turn-lean/attack-stance animation; Synthblade with faceted steel, energy edge shader, forked arcs, world-space mist/embers, Catmull-Rom tapered trail; noise-displaced abominations with ribs/cleaver/mandibles/jaws, dissolve death; Bellwright redesign (bell-head, clapper hammer, pipe hump); cloaked townsfolk. Test: `tools/gfx_shots.py` (before/after close-ups, `--mobile`). Follow-ups: gear visibly changing the Warden, cape self-collision with legs while sprinting, enemy LOD at distance, a real skinned rig if procedural animation hits its limit, a darker bronze/verdigris pass on the Bellwright's bell.
5. **Puddle reflections**: planar reflections (Reflector) or screen-space reflections on the wet street so neon reflects. Splash rings where rain hits.
6. **Abomination telegraphs**: art v2 shipped in 0.4; still to do: individual attack telegraphs that read from a distance, and per-type death sounds.
7. ~~**Touch controls**~~ shipped 2026-11-16 (build 0.3): floating stick (edge = sprint, analog walk), right-side drag look + tap-to-strike, thumb buttons (STRIKE hold-repeat, HEAVY, ROLL, LOCK, STIM, OVERLOAD, contextual FORGE/SEARCH), GEAR/SKILLS/pause, compact landscape menus, rotate prompt + auto-pause in portrait, iOS audio unlock, mobile render defaults (0.85 scale, DPR cap 1.25, quarter-res bloom, 512 shadows, 2200 rain). Test: `tools/mobile_test.py`. Follow-ups: **Gamepad API** mapping; haptics (navigator.vibrate on hits, Android only); customizable button size/left-handed layout; a real portrait layout; test on a physical iPhone and a mid-range Android for FPS.
8. **Loot feel**: drops arc out of the corpse, rarity sounds, beam heights, a compare tooltip on pickup, and gear visibly changing the Warden (helm and pauldron variants, mantle colors).
9. **Performance**: merge static city geometry into a few draw calls, instance the windows and lamps, a quality preset menu (Low/Medium/High), and an FPS meter toggle.

## Next (weeks 2 to 4)
- **The Ruins (Don's recommendation, pending approval: City → Ruins → Subterranean)**: ONE coherent, explorable Ruins area on the capital's edge. It's a place people still live in or scavenge (squatters, scavengers, salvage crews), not just a monster wasteland. Decayed infrastructure, environmental storytelling about decline, its own enemy mix, and at most a short sealed or teased way down (no full Subterranean zone yet). Quality over quantity.
- **Prismatic Order presence (influence only)**: Prisms as NPCs, dialogue lines, environmental details (a workshop, a college notice, refraction motifs, purple-pink synth light used sparingly). NO reputation, membership, faction, rank or college systems, no named high priest, no miracles (see docs/lore.md B7).
- **The Subterranean** (after the Ruins): older buried societies, lost Ward archives. Design waits on Don.
- (Deferred) District "the Sump" with drowned chapels: the Sump is a v0.4 detail. Fold it into the Subterranean plan only if Don wants it; "chapels" would need to fit the Prismatic Order.
- **Contracts board**: daily bounties (kill X, purge a zone, hunt a named abomination) for scrap and Cores. A daily reason to come back.
- **Collection: the Warden's Ledger**: a codex of every abomination, Core, Exalted item and judgment. Track 100%.
- **More judgments**: one moral case per district. Each verdict changes the world (NPCs, prices, who appears later).
- **Core synergies / fusion**: ON HOLD. Don: no new Core rules, slots, progression or crafting without approval.
- **Status effects, material proficiency, runes, Attunement/Synth Proficiency, Exalted buff pool**: approved target design (docs/lore.md B4), but the numbers and catalogues are open. Write proposals for Don first.
- **Skill tree v2**: active abilities per branch (Blade: Execution finisher; Bulwark: Oath Shield; Circuit: Overload variants), (respec at the Forge shipped in 0.7).
- **Enemy variety**: shielded Husks, a sniper on rooftops, swarm events at the Gate.
- **Audio**: layered rain by surface, distant bells, a dynamic combat score (still synthesized).

## Later (moonshots)
- Open-ish city of several wards connected by gates, day 4000 of the rain.
- Named Exalted weapons with unique movesets.
- Seasonal "Tribunal" events with leaderboards (needs an approved backend).
- Photo mode for sharing poster-style shots.
- Desktop build (Electron/Tauri) for itch.io or Steam, if Don wants to sell it (needs approval).

## Shipped log
- 2026-11-16 build 0.1: vertical slice.
- 2026-11-16 build 0.2: combat feel pass (perfect dodge + Riposte, last-kill slow-mo, heavy wind-up weight, hit-reacts, cancel windows).
- 2026-11-16 build 0.3: mobile touch controls and small-screen layout.
- 2026-11-16 build 0.4: graphics pass (Synthblade, Warden model v2, abominations, Bellwright).
- 2026-11-16 build 0.5: save system (3 slots, autosave, migration, export/import, Save now, Saved mark).
- 2026-11-16 build 0.6: Armory rebuilt (live 3D paper-doll, icons, compare, filters/sorts, lock, bulk salvage).
- 2026-11-16 build 0.7: Skill tree rebuilt (constellation graph, node states, lit traces, inspect panel, hold-to-learn, unlock fx, Forge respec).
- 2026-11-16 build 0.8: lore alignment (new rarity tiers + effect slots, no Core rarity promotion, Synthblade Dormant/Awakened channel, neutral defeat + checkpoint, Hallowmere as capital, placeholder titles removed).

## Known gaps in the vertical slice (v0.1)
- Animation is procedural (no skeletal rig or mocap), so poses read as stiff.
- No real collision against props beyond simple circles. The camera can clip props.
- No gamepad yet (touch shipped in 0.3).
- Enemy pathing is direct: no navmesh, so they can get stuck on corners.
- Only one district and one elite. The story is one scene plus the breach.
