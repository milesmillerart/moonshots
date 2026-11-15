# CrazyGames technical compliance (checked 2026-11-15)

Source: https://docs.crazygames.com/requirements/technical/ and /requirements/intro/

| Requirement | Status |
|---|---|
| Initial download ≤ 50 MB (≤ 20 MB for mobile homepage) | PASS. Each bundle is 27–37 KB raw, 10–13 KB zipped |
| Total ≤ 250 MB, ≤ 1500 files | PASS. 3–4 files per game |
| Relative paths only | PASS. play/ bundles reference only kit.js, game.js, style.css |
| External hosted files reach gameplay ≤ 20 s | PASS. Nothing external is loaded |
| Works in Chrome / Edge, also Safari | Chrome tested headless (desktop and mobile emulation). Safari and Edge not tested yet |
| Chromebook, 4 GB RAM smooth | Likely. Canvas 2D, DPR capped at 2. Neon Siege holds 60 fps with 300+ enemies in headless Chrome |
| Mouse, keyboard and touch if mobile is supported | PASS. All five games |
| Landscape playable on desktop; portrait allowed with bars | PASS. Portrait games letterbox with a full-bleed background |
| Don't use touch detection to show mobile controls | PASS. No touch detection; pointer events everywhere |
| user-select: none on body | PASS (set in kit.js) |
| Resume AudioContext after an iOS interruption, on a user gesture | PASS. Kit resumes on pointerdown/touchend/keydown/click |
| No external links in the game | PASS. Duality share copies to the clipboard only. Share links live on the arcade page, outside the game bundle |
| No external ads in Basic Launch | PASS. No ads |
| PEGI 12 | PASS. Abstract shapes, no violence against people |
| SDK (optional for Basic, required for Full): gameplayStart etc. | READY. Kit.sdk calls CrazyGames.SDK if present. Gap: the SDK script tag must be added to the portal build, and muteAudio is read only at init |
| Land directly in gameplay (Full Launch) | GAP. Games open on a one-tap title card. Consider auto-start for portal builds |
| Progress saving through the Data module (Full Launch) | GAP. Scores use localStorage only |
| Covers: 1920x1080, 800x1200, 800x800 + video | GAP. Only 16:9 gameplay thumbnails and OG images exist so far |
| Metadata: description and controls | READY in src/games.json |
| Privacy notice if collecting extra data | N/A. Nothing is collected |
