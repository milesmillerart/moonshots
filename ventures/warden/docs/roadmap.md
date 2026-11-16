# WARDEN roadmap: daily improvement backlog

Rule: every night ships one or two visible improvements (graphics a little at a time, feel, content). Each gets a line in `game/data/changelog.json`. Run `tools/shots.py` (desktop), `tools/mobile_test.py` (phone emulation) and `tools/save_test.py` (saves) before shipping. Any change to the save shape must bump `SCHEMA` in `game/src/save.js` and add a step in `migrate()` so no player loses progress; zero console errors.

## Now (next 7 nights, highest impact first)
0. ~~**Saving (Don's #1 ask)**~~ shipped 2026-11-16 (build 0.5): `game/src/save.js` with versioned schema 2 and migration from the 0.1-0.4 single save (`warden.save.v1` copied into slot 1, old key kept), 3 slots (`warden.slot.N` + `.bak` of the previous write), title slot picker (name, level, verdict, chapter, area, play time, last saved; Play/Export/Delete, New/Import), Continue = most recent slot, event autosaves (pickup, equip, salvage, forge, Cores, perk, level, verdict, wave clears, boss, area change) + 15 s periodic + pagehide/visibilitychange/beforeunload, ground loot + facing/camera saved, pause-menu Save now + HUD "Saved" mark, export/import as a checksummed code or `.wsave.txt` file. Test: `tools/save_test.py` (desktop + iPhone 13/Pixel 7/SE landscape). Follow-ups: cloud sync only if Don approves a backend; "Ledger" of past Wardens; warn when two tabs play the same slot.
1. **Inventory management visualization (Don's #2 ask, next up)**: a real Armory screen: paper-doll Warden with each slot on the body, grid pack with rarity frames and icons, sort/filter (slot, rarity, new), compare-on-hover stat deltas, bulk salvage by rarity, Core sockets drawn on the item.
2. **Skill tree visualization (Don's #3 ask)**: a node graph per branch (Blade, Bulwark, Circuit) with connecting lines that light up, tier gates, hover cards, respec preview; Cyberpunk/Skyrim/Baldur's Gate feel.
3. ~~**Combat feel pass**~~ shipped 2026-11-16 (build 0.2): perfect dodge (0.24 s window, enemy time-dilation, guaranteed-crit Riposte), final-kill slow-mo + FOV punch, heavy wind-up crouch/lean + blade charge, enemy hit-react flinch, dodge-cancel windows, trail only during the cut. Follow-ups: a true parry on heavy-attack timing, and per-move recovery tuning once gamepad lands.
4. ~~**Warden model v2 + Synthblade + Abomination art**~~ shipped 2026-11-16 (build 0.4): procedural sculpted Warden (lathe/shell/tube parts baked to one mesh per material per bone), T-visor helm + rear cables, verlet cape, rest pose (blade point-down when calm), stride/turn-lean/attack-stance animation; Synthblade with faceted steel, energy edge shader, forked arcs, world-space mist/embers, Catmull-Rom tapered trail; noise-displaced abominations with ribs/cleaver/mandibles/jaws, dissolve death; Bellwright redesign (bell-head, clapper hammer, pipe hump); cloaked townsfolk. Test: `tools/gfx_shots.py` (before/after close-ups, `--mobile`). Follow-ups: gear visibly changing the Warden, cape self-collision with legs while sprinting, enemy LOD at distance, a real skinned rig if procedural animation hits its limit, a darker bronze/verdigris pass on the Bellwright's bell.
5. **Puddle reflections**: planar reflections (Reflector) or screen-space reflections on the wet street so neon reflects. Splash rings where rain hits.
6. **Abomination telegraphs**: art v2 shipped in 0.4; still to do: individual attack telegraphs that read from a distance, and per-type death sounds.
7. ~~**Touch controls**~~ shipped 2026-11-16 (build 0.3): floating stick (edge = sprint, analog walk), right-side drag look + tap-to-strike, thumb buttons (STRIKE hold-repeat, HEAVY, ROLL, LOCK, STIM, OVERLOAD, contextual FORGE/SEARCH), GEAR/SKILLS/pause, compact landscape menus, rotate prompt + auto-pause in portrait, iOS audio unlock, mobile render defaults (0.85 scale, DPR cap 1.25, quarter-res bloom, 512 shadows, 2200 rain). Test: `tools/mobile_test.py`. Follow-ups: **Gamepad API** mapping; haptics (navigator.vibrate on hits, Android only); customizable button size/left-handed layout; a real portrait layout; test on a physical iPhone and a mid-range Android for FPS.
8. **Loot feel**: drops arc out of the corpse, rarity sounds, beam heights, a compare tooltip on pickup, and gear visibly changing the Warden (helm and pauldron variants, mantle colors).
9. **Performance**: merge static city geometry into a few draw calls, instance the windows and lamps, a quality preset menu (Low/Medium/High), and an FPS meter toggle.

## Next (weeks 2 to 4)
- **District 2: the Sump** under the Ward, with drowned chapels and a new elite.
- **Contracts board**: daily bounties (kill X, purge a zone, hunt a named abomination) for scrap and Cores. A daily reason to come back.
- **Collection: the Warden's Ledger**: a codex of every abomination, Core, Sovereign item and judgment. Track 100%.
- **More judgments**: one moral case per district. Each verdict changes the world (NPCs, prices, who appears later).
- **Core synergies**: two matching Cores on one item unlock a bonus. Core fusion at the Forge.
- **Skill tree v2**: active abilities per branch (Blade: Execution finisher; Bulwark: Oath Shield; Circuit: Overload variants), plus respec at the Forge.
- **Enemy variety**: shielded Husks, a sniper on rooftops, swarm events at the Gate.
- **Audio**: layered rain by surface, distant bells, a dynamic combat score (still synthesized).

## Later (moonshots)
- Open-ish city of several wards connected by gates, day 4000 of the rain.
- Named Sovereign weapons with unique movesets.
- Seasonal "Tribunal" events with leaderboards (needs an approved backend).
- Photo mode for sharing poster-style shots.
- Desktop build (Electron/Tauri) for itch.io or Steam, if Don wants to sell it (needs approval).

## Shipped log
- 2026-11-16 build 0.1: vertical slice.
- 2026-11-16 build 0.2: combat feel pass (perfect dodge + Riposte, last-kill slow-mo, heavy wind-up weight, hit-reacts, cancel windows).
- 2026-11-16 build 0.3: mobile touch controls and small-screen layout.
- 2026-11-16 build 0.4: graphics pass (Synthblade, Warden model v2, abominations, Bellwright).
- 2026-11-16 build 0.5: save system (3 slots, autosave, migration, export/import, Save now, Saved mark).

## Known gaps in the vertical slice (v0.1)
- Animation is procedural (no skeletal rig or mocap), so poses read as stiff.
- No real collision against props beyond simple circles. The camera can clip props.
- No gamepad yet (touch shipped in 0.3).
- Enemy pathing is direct: no navmesh, so they can get stuck on corners.
- Only one district and one elite. The story is one scene plus the breach.
