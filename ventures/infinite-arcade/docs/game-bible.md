# Ebbmarrow: game bible (starting point, not a contract)

> Working title **Ebbmarrow**. Original IP. Checked 2026-11-15 against existing games:
> Lanternwake, Hushlight, Tidefall and The Long Ebb are all taken; "Ebbmarrow" had no game
> results (quick web check, not a trademark search).

This document describes where the game *starts*. It is deliberately loose. The game is
improved every day, and the story, mechanics, and even the genre are allowed to drift toward
whatever turns out to be fun (a collection game, a tide-sim, a cozy village builder,
whatever). When the game and this doc disagree, the game wins; update the doc.

## Pitch

Every night the sea goes out a little further, and leaves something behind. Tamsin Vey,
a fisher's daughter from Kettle Cove, follows the retreating tide onto flats nobody has
walked in three hundred years, where the drowned kingdom of Marrow is surfacing one road,
one ghost, one broken seal at a time. Somebody in her dead mother's diving helm is out
there breaking them first.

## Tone

- Coastal folk tale with a melancholy undertow: warm village, cold sea, and grief people
  don't talk about.
- Dry humor from the locals (Ama's bluntness, Pim's patience, the Clerk's bureaucracy).
- Wonder over horror. The sea is strange, not evil.
- Short, punchy dialogue. Every scene ends with a choice, a reward, or a question.

## World

- **Kettle Cove**: a fishing hamlet under a cliff. A lighthouse bell nobody rings any more.
  Smells of tar and kelp smoke. The starting hub.
- **The Bared Flats**: miles of wet sand, tide pools and wreck ribs exposed by the
  impossible low tide. Marrow's **Royal Causeway** runs across them.
- **Marrow**: a kingdom drowned three centuries ago when its seven **Tide Seals** were
  set to hold the sea back from something under it. Its ghosts still keep their jobs.
- **The Tide**: a living rhythm (Low, Rising, High, Ebbing) that drives combat and,
  eventually, the world (tide-dependent paths, creatures, and events).

## Cast

| Name | Role |
| --- | --- |
| Tamsin Vey | Player. Seventeen, stubborn, good with a gaff hook. Her mother Isolde drowned nine years ago. |
| Ama | Her grandmother. Retired diver, keeper of the cove's old knowledge, the Tide Arts. |
| Cobb | Gruff fisherman and neighbour. Teaches fighting by throwing you at crabs. |
| Mags | Runs the cove stall. Sells cakes and salves, buys gossip. |
| Old Pim | Widower searching the flats for his wife Merriam's ring, lost 31 years ago. |
| Clerk Oswin Fairweather | Ghost toll-keeper of the Royal Causeway. Rules are rules. |
| Nell, Hob, Bo | Cove villagers; room to grow into side stories. |
| The Diver | A figure in Isolde's brass helm, breaking the seals ahead of Tamsin. |

## Central mystery (open)

Two of seven seals are already broken when the game begins. Each broken seal lets the sea
out further. Who is the Diver: Isolde alive, something wearing her, or someone else?
Why is "Isolde Vey, and heirs" written in fresh ink in a three-hundred-year-old toll
ledger? What is under Marrow? None of this is locked; answers should be written when the
game is ready for them, and may change.

## Core mechanics (current)

- Tile-based overworld, 16 px tiles, smooth tweened movement, run button.
- NPC dialogue with typewriter text, portraits and branching choices.
- Quests with step lists and an on-screen objective.
- Turn-based combat built around the **Tide** meter:
  - Water arts (Brine Lash, Undertow) hit ×0.7 at Low tide and ×1.5 at High tide.
  - Physical crits are likelier at Low tide.
  - Crabs harden their shells at High tide; some enemies telegraph charged attacks.
- Breath (BR) is the resource for arts. Items, Guard and Flee round out the menu.
- Inventory and two equipment slots (weapon, charm), levels and learned arts.
- Shrines heal and save; defeat returns you to the last shrine at the cost of 20% of shells.
- localStorage saves, desktop keyboard and mobile touch (d-pad plus A/B).

## Art direction (upgraded a little at a time)

- Everything is procedural pixel art drawn in code (`rpg/engine/10-art.js`), so it can be
  improved without asset pipelines or licences.
- A low-res buffer (about 176 px on the short side) is upscaled by an integer factor for
  crisp pixels.
- Palette: cold sea blues and teals against warm lamplight ambers, with sand, kelp and rust
  in between.
- Lighting: per-map darkness, radial lights, glow, and story-driven phases (dawn to day).
- Particles: spray, drips, fireflies, fog.
- Goal: each day nudges one thing closer to "GOOD": better tiles, animation frames,
  water, weather, portraits, battle backdrops, and screen juice.

## Music and sound

Generated WebAudio only: a seeded chiptune sequencer with songs defined as data, plus
synthesized sound effects. No samples or licences.

## Content format

- `rpg/data/core.json`: tiles, items, skills, player curve, enemies, looks, music.
- `rpg/data/chapters/NN-*.json`: a story "Part" (maps, entities, dialogs, quests).
  Parts start when their `requires` flag holds. No dates.
- `rpg/data/changelog.json`: the in-game "What's new".
- `tools/build_rpg.py` validates every reference before it builds.

## Daily improvement format

1. Pick one or two items from `docs/roadmap.md`.
2. Change engine or data; run `tools/build_rpg.py --check`, `tools/rpg_test.py`,
   and `tools/rpg_playthrough.py`.
3. Add a changelog entry (date, title, 2–6 short player-facing bullets).
4. Commit; the `daily-improve` job rebuilds and redeploys.
