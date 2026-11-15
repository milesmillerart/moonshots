# Infinite Arcade (public brand: Daycade, placeholder)

An AI game studio that ships an original browser game every day, growing toward a
"TikTok of games" feed where people play, create and remix. v1 is a static arcade
with five launch games, served at https://moon.sparelimbstudios.com/arcade/.

Brand note: "Infinite Arcade" is already used by a web3 gaming company (Coda Labs,
infinitearcade.com), so the public site uses the placeholder **Daycade**. That is a
quick web check only, not a trademark search; clear it before buying a domain.

## Layout

```
src/games.json          catalog: brand + games (slug, title, copy, released date...)
src/kit.js              shared runtime (canvas stage, input, WebAudio synth, overlays,
                        localStorage scores, portal SDK hooks), copied into each game
src/games/<slug>/       game.js (+ body.html / style.css for DOM games)
src/shell/              site.css, icon.svg, hooks.js (share, fullscreen, game events)
src/thumbs/             gameplay thumbnails + OG images (made by tools/shots.py)
tools/build.py          src -> public/ (home, game pages, play bundles, sitemap.xml)
tools/smoke_test.py     Playwright: load, inputs, console errors, screenshots
tools/shots.py          regenerate thumbnails / OG images
tools/package.py        zip each play/ bundle into dist/ for portal upload
jobs/ship-daily.sh      daily release train (rebuild + deploy), stub for game generation
research/               market + portal compliance notes
public/                 build output, deployed to /arcade by `bin/moonshots deploy`
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

To queue tomorrow's game: add `src/games/<slug>/game.js` and a games.json entry with
`"released": "YYYY-MM-DD"`. The `ship-daily` job (05:05 UTC) releases it on that date.

## Hooks for later

- Portal SDKs: `Kit.sdk` forwards gameplayStart/Stop, happytime, midgame ad breaks and
  mute to `window.CrazyGames.SDK` / `window.PokiSDK` when a portal build includes their
  script (marked `PORTAL HOOK` in each play/index.html). Nothing is loaded in v1.
- Site ads/analytics: `HOOK` comment in every page head, hidden `.ad-slot` divs, and
  `window.DaycadeHooks.onGameEvent` receives postMessage events from game iframes.
- Debug hooks `window.__game.*` exist for tests and thumbnails.
