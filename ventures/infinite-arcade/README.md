# Infinite Arcade → Ebbmarrow

**Now:** one big original browser RPG, **Ebbmarrow**, at
https://moon.sparelimbstudios.com/arcade/, improved a little every day (graphics, feel,
gameplay experiments, story). The original five Daycade games are kept under
**Extras** at https://moon.sparelimbstudios.com/arcade/extras/.

- Game bible (starting point, not a fixed plan): `docs/game-bible.md`
- Living improvement backlog: `docs/roadmap.md`
- Daily job: `jobs/daily-improve.sh` (rebuild + deploy only, no paid APIs)

## Ebbmarrow layout

```
rpg/engine/NN-*.js      vanilla JS engine, concatenated in order (core, art, audio, state,
                        world, script, battle, ui, main)
rpg/web/                index.html template, style.css, icon.svg
rpg/data/core.json      tiles, items, skills, player curve, enemies, looks, music
rpg/data/chapters/      story Parts (maps, entities, dialogs, quests); start by flag, no dates
rpg/data/changelog.json in-game "What's new"
tools/build_rpg.py      validate data + bundle -> public/index.html, public/game, public/data
tools/rpg_test.py       Playwright smoke test, desktop + mobile, screenshots
tools/rpg_playthrough.py  story bot: plays prologue + Part 1 to the end
```

```
python3 tools/build.py && python3 tools/build_rpg.py      # build both (order matters)
python3 tools/build_rpg.py --check                         # validate data only
python3 tools/rpg_test.py http://127.0.0.1:8777/arcade/
python3 tools/rpg_playthrough.py http://127.0.0.1:8777/arcade/
```

---

## Extras: the original Daycade arcade

Brand note: "Infinite Arcade" is already used by a web3 gaming company (Coda Labs,
infinitearcade.com), so the arcade used the placeholder **Daycade**. That is a
quick web check only, not a trademark search; clear it before buying a domain.

## Layout

```
src/games.json          catalog: brand + games (slug, title, copy, released date...)
src/kit.js              shared runtime (canvas stage, input, WebAudio synth, overlays,
                        localStorage scores, portal SDK hooks), copied into each game
src/games/<slug>/       game.js (+ body.html / style.css for DOM games)
src/shell/              site.css, icon.svg, hooks.js (share, fullscreen, game events)
src/thumbs/             gameplay thumbnails + OG images (made by tools/shots.py)
tools/build.py          src -> public/ (extras/ home, game pages, play bundles, sitemap.xml)
tools/smoke_test.py     Playwright: load, inputs, console errors, screenshots
tools/shots.py          regenerate thumbnails / OG images
tools/package.py        zip each play/ bundle into dist/ for portal upload
jobs/daily-improve.sh   daily rebuild + deploy of Ebbmarrow and Extras
research/               market + portal compliance notes
public/                 build output (RPG at root, arcade at extras/), deployed to /arcade
```

## Games (launch set, 2026-11-15)

| slug | game | type |
|---|---|---|
| stackfall | Stackfall | one-tap physics stacker |
| polarity | Polarity Run | one-tap gravity-flip endless runner |
| nova-merge | Nova Merge | drop-and-merge number puzzle |
| neon-siege | Neon Siege | arena survivor with upgrades |
| duality | Duality | daily seeded sun/moon logic puzzle + practice |

All code and art are original (canvas-drawn or inline SVG), and all sound is synthesized
live with WebAudio. No third-party libraries, fonts, assets, trackers or ads.

## Workflow

```
python3 tools/build.py                 # build for today (only released games go live)
python3 tools/build.py --all           # preview including queued games
python3 tools/smoke_test.py http://127.0.0.1:8765/arcade/
/srv/moonshots/bin/moonshots deploy infinite-arcade
```

Adding arcade games still works the same way (a games.json entry with a `released`
date); `daily-improve` rebuilds daily so dated games go live. The focus is now Ebbmarrow.

## Hooks for later

- Portal SDKs: `Kit.sdk` forwards gameplayStart/Stop, happytime, midgame ad breaks and
  mute to `window.CrazyGames.SDK` / `window.PokiSDK` when a portal build includes their
  script (marked `PORTAL HOOK` in each play/index.html). Nothing is loaded in v1.
- Site ads/analytics: `HOOK` comment in every page head, hidden `.ad-slot` divs, and
  `window.DaycadeHooks.onGameEvent` receives postMessage events from game iframes.
- Debug hooks `window.__game.*` exist for tests and thumbnails.
