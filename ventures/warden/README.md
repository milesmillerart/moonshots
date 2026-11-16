# WARDEN

A cyber-medieval 3D third-person action RPG in the browser. Live at https://moon.sparelimbstudios.com/warden/

You are the Warden of the Ninth Ward, a province-sized territory whose capital is Hallowmere: unapologetic, ruthless, fair, professional. You carry the Synthblade, a steel longsword with a synth channel along one edge (Dormant out of combat, Awakened in it), and you keep the law against the abominations the street calls the Rot.

Canon lives in `docs/lore.md` (synced from Don's Drive lore folder; it overrides everything else). Don's direction: `docs/direction-2026-11-16.md`.

## Layout
- `game/`: the source, served as plain ES modules (no bundler needed)
  - `index.html`, `style.css`, `icon.svg`
  - `src/main.js` boot, renderer, bloom, adaptive resolution
  - `src/game.js` states, story, waves, combat resolution, loot, autosave triggers
  - `src/save.js` save slots, schema + migration, backups, export/import codes
  - `src/inventory.js` Armory screen; `src/preview.js` live 3D paper-doll; `src/icons.js` procedural item icons
  - `src/skills.js` skill tree screen (SVG constellation, perk glyphs, hold-to-learn, Forge respec)
  - `src/player.js` movement, stamina, dodge, combo, procedural animation + arm IK
  - `src/enemies.js` Husk, Skitter, Bile Spitter, the Bellwright, projectiles
  - `src/world.js` the district, rain, height fog, neon, lights
  - `src/models.js` procedural models; `src/fx.js` sparks, trail, rings, numbers
  - `src/items.js` gear, rarity, Cores, stat sheet; `src/data.js` all tunable data + story text
  - `src/ui.js` title, naming, dialogue, HUD, Armory, Forge, Skills, pause, changelog
  - `data/changelog.json` the in-game "What's new"
  - `vendor/` three.js bundle (MIT)
- `tools/build.py` copies `game/` to `public/` and cache-busts module URLs
- `tools/shots.py` headless Chromium smoke test + screenshots
- `tools/save_test.py`, `tools/inventory_test.py`, `tools/skills_test.py`, `tools/mobile_test.py` save, Armory, skill tree and phone (touch) tests
- `tools/rarity_test.py` (0.8 rarity migration, no Core promotion, defeat wording, blade states; `--mobile`), `tools/blade_shots.py` (Synthblade Dormant/Awakened close-ups)
- `jobs/daily-improve.sh` nightly rebuild + deploy
- `docs/roadmap.md` prioritized daily backlog, `docs/lore.md` canon (overrides `docs/bible.md`, the v0.4 snapshot)

## Dev
    python3 tools/build.py && (cd public && python3 -m http.server 8765)
    python3 tools/shots.py http://127.0.0.1:8765/ /tmp/warden-shots
