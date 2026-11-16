# WARDEN roadmap: daily improvement backlog

Rule: every night ships one or two visible improvements (graphics a little at a time, feel, content). Each gets a line in `game/data/changelog.json`. Run `tools/shots.py` before shipping; zero console errors.

## Now (next 7 nights, highest impact first)
1. ~~**Combat feel pass**~~ shipped 2026-11-16 (build 0.2): perfect dodge (0.24 s window, enemy time-dilation, guaranteed-crit Riposte), final-kill slow-mo + FOV punch, heavy wind-up crouch/lean + blade charge, enemy hit-react flinch, dodge-cancel windows, trail only during the cut. Follow-ups: a true parry on heavy-attack timing, and per-move recovery tuning once gamepad lands.
2. **Warden model v2**: bevelled plate pieces, a proper backplate and gorget, a real helmet silhouette (smooth dome, flared neck guard), cape cloth with gravity and wind, and the red mist particles around the blade like the poster.
3. **Puddle reflections**: planar reflections (Reflector) or screen-space reflections on the wet street so neon reflects. Splash rings where rain hits.
4. **Abomination art v2**: real silhouettes (exposed ribs, cables, tumorous plating), death dissolve shader, and individual attack telegraphs that read from a distance.
5. **Touch and gamepad controls**: Gamepad API mapping, plus a virtual stick and buttons on mobile.
6. **Loot feel**: drops arc out of the corpse, rarity sounds, beam heights, a compare tooltip on pickup, and gear visibly changing the Warden (helm and pauldron variants, mantle colors).
7. **Performance**: merge static city geometry into a few draw calls, instance the windows and lamps, a quality preset menu (Low/Medium/High), and an FPS meter toggle.

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

## Known gaps in the vertical slice (v0.1)
- Animation is procedural (no skeletal rig or mocap), so poses read as stiff.
- No real collision against props beyond simple circles. The camera can clip props.
- No gamepad or touch yet.
- Enemy pathing is direct: no navmesh, so they can get stuck on corners.
- Only one district and one elite. The story is one scene plus the breach.
