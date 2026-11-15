# Ebbmarrow roadmap: living improvement backlog

The daily cadence is **improvements**, not scheduled chapters. Each day pick something from
here, ship it, log it in `rpg/data/changelog.json`, and move it to "Shipped". Reorder this
freely. Experiments are welcome; cut what isn't fun.

Legend: **[P1]** next up · **[P2]** soon · **[P3]** someday · *(exp)* experiment

## Top 5 right now

1. **[P1] Graphics: water and shoreline pass.** Animated waves, depth gradients, wet-sand
   sheen, reflections of lamps. Water is most of the screen; it should sell the game.
2. **[P1] Feel: combat juice.** Attack lunges, hit-stop, enemy flash and knockback, a tide
   meter that visibly swells, and better damage numbers and crit callouts.
3. **[P1] Experiment: Tidepool collection.** Catalogue creatures and relics found at low
   tide (a "Tide Log" with silhouettes for unfound entries). A cheap, low-risk test of
   whether collecting is the hook.
4. **[P2] Story: Part 2 seed.** Follow the Diver's lamp out past the Seal Steps; a third
   seal; Isolde's ledger entry starts to make sense. Written when it's ready, no date.
5. **[P2] Graphics: character art.** Walk cycles with more frames, idle breathing, bigger
   expressive portraits, and more varied villager silhouettes.

## Graphics

- [P1] Water, foam and shoreline animation (see Top 5).
- [P2] Battle backdrops with parallax layers per area (flats, cave, cove, bell).
- [P2] Day/night and tide cycle tint on the overworld.
- [P2] Weather: rain, sea fog banks, gulls crossing the screen.
- [P2] Title screen: animated bay with the lighthouse and the receding tide.
- [P3] Tile autotiling (smooth sand/grass/water edges instead of hard squares).
- [P3] Monster idle and attack animation frames.

## Feel

- [P1] Combat juice (see Top 5).
- [P2] Footstep sounds per surface; splashes in shallows.
- [P2] Dialogue polish: per-character voice blips, shake/emphasis tags.
- [P2] Quicker menus on mobile (bigger targets, swipe to close).
- [P3] Screen transitions per map (tide wipe).
- [P3] Accessibility: high-contrast text, reduced motion, remappable keys.

## Gameplay experiments

- *(exp)* [P1] **Tidepool collection / Tide Log** (see Top 5).
- *(exp)* [P2] **Befriend creatures**: some defeated foes can join as a companion
  that acts on its own in battle. If it lands, it could grow into a creature-collector.
- *(exp)* [P2] **Tide-dependent overworld**: paths open at low tide, close at high tide.
- *(exp)* [P2] **Fishing / beachcombing minigame** feeding the collection and the shop.
- *(exp)* [P3] **Cove rebuilding**: spend finds to restore the lighthouse, the dock, the stall.
- [P2] Equipment variety: more weapons and charms with tide-based effects.
- [P2] Balance pass using playthrough telemetry (time per area, deaths, level at boss).

## Story expansions

- [P2] Part 2 seed (see Top 5).
- [P2] Side stories for Nell, Hob and Bo in the cove.
- [P2] More of Marrow's ghosts with jobs they still keep (a lamplighter, a customs officer).
- [P3] Optional lore: shards that reveal what's under Marrow.
- [P3] Multiple endings tied to choices made with the ghosts.

## Tech

- [P2] Save slots and export/import of saves.
- [P2] Automated balance report from `tools/rpg_playthrough.py`.
- [P3] Map editor page (data-driven maps make this cheap).
- [P3] Offline/PWA install.

## Shipped

- 2026-11-15: Ebbmarrow begins. Prologue "The Night the Sea Breathed Out" and Part 1
  "The Bared Flats" (Kettle Cove, the flats, the Crab Warren, Grandclaw boss), Tide combat,
  quests, gear, levels, saves, touch controls, generated music, in-game "What's new".
