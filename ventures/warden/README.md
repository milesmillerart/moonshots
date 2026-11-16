# WARDEN

A cyber-medieval 3D third-person action RPG in the browser. Live at https://moon.sparelimbstudios.com/warden/

You are the Warden of Hallowmere's Ninth Ward: unapologetic, ruthless, fair, professional. You carry the Synthblade, a longsword with one synth edge that cuts almost anything, and you keep the law against the abominations of the Rot.

## Layout
- `game/`: the source, served as plain ES modules (no bundler needed)
  - `index.html`, `style.css`, `icon.svg`
  - `src/main.js` boot, renderer, bloom, adaptive resolution
  - `src/game.js` states, story, waves, combat resolution, loot, autosave triggers
  - `src/save.js` save slots, schema + migration, backups, export/import codes
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
- `jobs/daily-improve.sh` nightly rebuild + deploy
- `docs/roadmap.md` prioritized daily backlog, `docs/bible.md` world and tone

## Dev
    python3 tools/build.py && (cd public && python3 -m http.server 8765)
    python3 tools/shots.py http://127.0.0.1:8765/ /tmp/warden-shots
