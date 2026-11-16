#!/usr/bin/env python3
"""Synthblade close-ups for 0.8: Dormant vs Awakened, same pose and camera, plus a full-body pair.
Usage: python3 tools/blade_shots.py [URL] [OUTDIR] [--mobile]. Asserts zero console errors."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
MOBILE = "--mobile" in sys.argv
URL = args[0] if args else "http://127.0.0.1:8765/"
OUT = Path(args[1] if len(args) > 1 else "/workspace/warden-08"); OUT.mkdir(parents=True, exist_ok=True)
TAG = "mobile" if MOBILE else "desktop"
errors = []
CAM = r"""(dist, along, side) => { const g = window.__warden.game, T = window.__warden.THREE, sw = g.player.u.sword;
  sw.updateMatrixWorld(true);
  const c = sw.localToWorld(new T.Vector3(0.0, along, 0)), n = new T.Vector3(0, 0, 1).transformDirection(sw.matrixWorld);
  const y = new T.Vector3(0, 1, 0).transformDirection(sw.matrixWorld), x = new T.Vector3(1, 0, 0).transformDirection(sw.matrixWorld);
  g.cine = { pos: c.clone().addScaledVector(n, dist).addScaledVector(x, side), look: c }; g._lastCine = null; }"""

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        ctx = b.new_context(**p.devices["iPhone 13 landscape"]) if MOBILE else b.new_context(viewport={"width": 1600, "height": 900})
        pg = ctx.new_page(); pg.set_default_timeout(180000)
        pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("window.__warden && window.__wardenItems && document.querySelector('#menu button')", timeout=90000)
        pg.evaluate("""() => { const I = window.__wardenItems;
          const s = { schema: 4, v: 4, name: 'Kade', level: 3, xp: 0, points: 0, perks: {}, equip: I.starterGear(), bag: [], scrap: 0, stims: 3,
            trait: 'inquest', flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: Date.now(), kills: 0, pos: [12, -4], hp: 999, ground: [], playTime: 1, saved: Date.now() };
          localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] })); }""")
        pg.reload(wait_until="load")
        pg.wait_for_function("window.__warden && document.querySelector('#menu button[data-act=continue]')", timeout=90000)
        pg.evaluate("window.__wardenNoDyn = true")
        pg.click("#menu button[data-act=continue]")
        pg.wait_for_function("window.__warden.game.state === 'play'", timeout=60000)
        E = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
        E("for (const e of g.enemies) e.dispose(); g.enemies = []; g.applySetting && g.applySetting('scale', 1); g.player.pos.set(12, 0, -4); g.player.face = 0.5; g.camYaw = 0.5; g.player.restT = 30;")
        time.sleep(3)
        def freeze(): E("if (!g._realUpdate) { g._realUpdate = g.update; g.update = function () {}; }")
        def thaw(): E("if (g._realUpdate) { g.update = g._realUpdate; g._realUpdate = null; }")
        for state, k in (("dormant", 0), ("awakened", 1)):
            thaw(); E(f"g.player.forceAwake = {k};"); time.sleep(2.0)
            E(f"({CAM})(0.62, 0.78, 0.0)"); time.sleep(1.5); freeze(); time.sleep(0.5)
            # one more rendered frame at the frozen state so the camera move lands
            pg.screenshot(path=str(OUT / f"{TAG}-synthblade-{state}-closeup.png")); print("saved", state, "closeup")
            thaw(); E(f"({CAM})(1.25, 0.75, 0.25)"); time.sleep(1.2); freeze(); time.sleep(0.5)
            pg.screenshot(path=str(OUT / f"{TAG}-synthblade-{state}-blade.png")); print("saved", state, "blade")
            thaw(); E("g.cine = null; g._lastCine = null;"); time.sleep(1.5)
            pg.screenshot(path=str(OUT / f"{TAG}-synthblade-{state}-gameplay.png")); print("saved", state, "gameplay")
        b.close()
    print("console errors:", len(errors))
    for e in errors: print("  ", e)
    (OUT / f"{TAG}-blade-errors.json").write_text(json.dumps(errors, indent=1))
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
