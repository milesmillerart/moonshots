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
_UNUSED = r"""(dist, along, side) => { const g = window.__warden.game, T = window.__warden.THREE, sw = g.player.u.sword;
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
        pg.wait_for_function("window.__warden && window.__wardenItems && document.querySelector('#menu button')", timeout=180000)
        pg.evaluate("""() => { const I = window.__wardenItems;
          const s = { schema: 4, v: 4, name: 'Kade', level: 3, xp: 0, points: 0, perks: {}, equip: I.starterGear(), bag: [], scrap: 0, stims: 3,
            trait: 'inquest', flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: Date.now(), kills: 0, pos: [12, -4], hp: 999, ground: [], playTime: 1, saved: Date.now() };
          localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] })); }""")
        pg.reload(wait_until="load")
        pg.wait_for_function("window.__warden && document.querySelector('#menu button[data-act=continue]')", timeout=180000)
        pg.evaluate("window.__wardenNoDyn = true")
        pg.click("#menu button[data-act=continue]")
        pg.wait_for_function("window.__warden.game.state === 'play'", timeout=60000)
        E = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
        E("for (const e of g.enemies) e.dispose(); g.enemies = []; g.applySetting && g.applySetting('scale', 1); g.player.pos.set(12, 0, -4); g.player.face = 0.5; g.camYaw = 0.5; g.player.restT = 30;")
        time.sleep(3)
        # 1) hero close-ups: a display Synthblade (same buildSword the Warden carries) stood upright in the plaza
        #    with a soft fill light, so the steel and the channel read in both states. Same camera for both.
        E("""g.player.model.visible = false; window.__bs = { t: 0 }; return import('./src/models.js?v=' + window.__warden.build).then((M) => {
             const T = window.__warden.THREE, p = g.player, f = p.face, fw = new T.Vector3(Math.sin(f), 0, Math.cos(f));
             const sw = M.buildSword(); const S = p.pos.clone().addScaledVector(fw, 2.6).setY(0.55);
             sw.position.copy(S); sw.rotation.set(0, f + Math.PI + 0.32, 0); g.scene.add(sw);
             const fill = new T.PointLight(0xc8d4ff, 6, 6, 1.6); fill.position.copy(S).addScaledVector(fw, -1.1).add(new T.Vector3(0.7, 1.2, 0)); g.scene.add(fill);
             const rim = new T.PointLight(0x7fe8ff, 3, 5, 1.6); rim.position.copy(S).addScaledVector(fw, 0.8).add(new T.Vector3(-0.8, 1.4, 0)); g.scene.add(rim);
             window.__bs = { sw, S, fw, t: 0 };
             const loop = () => { const B = window.__bs; if (!B.sw) return; B.t += 1 / 30; const ud = B.sw.userData; ud.tick(1 / 30, B.t, 0.2, 0);
               if (ud.awake > 0.25 && Math.random() < 0.45) ud.crackle(0.6); else ud.arcs.geometry.setDrawRange(0, 0); setTimeout(loop, 33); };
             loop(); });""")
        def frame(dist, up, side):
            E(f"""const T = window.__warden.THREE, B = window.__bs, c = B.S.clone().add(new T.Vector3(0, {up}, 0));
                 const rt = new T.Vector3(-B.fw.z, 0, B.fw.x);
                 g.cine = {{ pos: c.clone().addScaledVector(B.fw, -{dist}).addScaledVector(rt, {side}), look: c }}; g._lastCine = null;""")
        for state, k in (("dormant", 0), ("awakened", 1)):
            E(f"window.__bs.sw.userData.setAwake({k});")
            frame(1.55, 0.72, 0.15); time.sleep(3.0)
            pg.screenshot(path=str(OUT / f"{TAG}-synthblade-{state}-full.png")); print("saved", state, "full")
            frame(0.5, 0.95, 0.12); time.sleep(3.0)
            pg.screenshot(path=str(OUT / f"{TAG}-synthblade-{state}-closeup.png")); print("saved", state, "closeup")
        E("const B = window.__bs; g.scene.remove(B.sw); B.sw = null; g.player.model.visible = true; g.cine = null; g._lastCine = null;")
        # 2) in play: the Warden holding it, Dormant (calm) vs Awakened (forced), side-on camera
        for state, k in (("dormant", 0), ("awakened", 1)):
            E(f"g.player.forceAwake = {k}; g.player.restT = 30;"); time.sleep(2.0)
            E("""const T = window.__warden.THREE, p = g.player, f = p.face, fw = new T.Vector3(Math.sin(f), 0, Math.cos(f)), rt = new T.Vector3(-Math.cos(f), 0, Math.sin(f));
                 g.cine = { pos: p.pos.clone().addScaledVector(fw, 2.3).addScaledVector(rt, 0.9).add(new T.Vector3(0, 1.35, 0)), look: p.pos.clone().add(new T.Vector3(0, 1.0, 0)) }; g._lastCine = null;""")
            time.sleep(3.0)
            pg.screenshot(path=str(OUT / f"{TAG}-synthblade-{state}-warden.png")); print("saved", state, "warden")
        E("g.player.forceAwake = null; g.cine = null;")
        b.close()
    print("console errors:", len(errors))
    for e in errors: print("  ", e)
    (OUT / f"{TAG}-blade-errors.json").write_text(json.dumps(errors, indent=1))
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
