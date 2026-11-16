#!/usr/bin/env python3
"""Close-up art screenshots for Warden graphics passes (before/after comparisons).
Usage: python3 tools/gfx_shots.py [URL] [OUTDIR] [PREFIX] [--mobile]
Loads a judged save, parks the camera on cinematic close-ups and freezes the sim for each shot:
warden idle (front + back), blade swing with trail, the three abominations, a death dissolve,
the Bellwright, and a townsperson. Asserts zero console errors."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
MOBILE = "--mobile" in sys.argv
URL = args[0] if len(args) > 0 else "http://127.0.0.1:8765/"
OUT = Path(args[1] if len(args) > 1 else "/workspace/warden-gfx"); OUT.mkdir(parents=True, exist_ok=True)
PRE = args[2] if len(args) > 2 else "after"
errors = []

SETUP = r"""
window.__gfx = {
  freeze() { const g = window.__warden.game; if (!g._realUpdate) { g._realUpdate = g.update; g.update = function () {}; } },
  thaw() { const g = window.__warden.game; if (g._realUpdate) { g.update = g._realUpdate; g._realUpdate = null; } },
  clear() { const g = window.__warden.game; for (const e of g.enemies) e.dispose(); g.enemies = []; g.combatOn = false; g.lockTarget = null; },
  cam(off, lookY = 1.3, lookOff = [0, 0, 0]) {
    const g = window.__warden.game, T = window.__warden.THREE, p = g.player, f = p.face;
    const fw = new T.Vector3(Math.sin(f), 0, Math.cos(f)), rt = new T.Vector3(-Math.cos(f), 0, Math.sin(f));
    const at = (o) => p.pos.clone().addScaledVector(rt, o[0]).add(new T.Vector3(0, o[1], 0)).addScaledVector(fw, o[2]);
    const look = at(lookOff); look.y += lookY;
    g.cine = { pos: at(off), look }; g._lastCine = null;
  },
  async spawn(type, side, fwd) {
    const g = window.__warden.game, T = window.__warden.THREE, p = g.player, f = p.face;
    const { Enemy } = await import('./src/enemies.js?v=' + window.__warden.build);
    const fw = new T.Vector3(Math.sin(f), 0, Math.cos(f)), rt = new T.Vector3(-Math.cos(f), 0, Math.sin(f));
    const pos = p.pos.clone().addScaledVector(rt, side).addScaledVector(fw, fwd);
    const e = new Enemy(g, type, pos, 1); e.aggro = false; e.face = f + Math.PI; e.home = pos.clone(); g.enemies.push(e); return g.enemies.length - 1;
  },
};
"""

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        if MOBILE:
            ctx = b.new_context(**p.devices["iPhone 13 landscape"])
        else:
            ctx = b.new_context(viewport={"width": 1600, "height": 900})
        pg = ctx.new_page(); pg.set_default_timeout(180000)
        pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("window.__warden && window.__wardenItems && document.querySelector('#menu button')", timeout=90000)
        pg.evaluate("""() => { const I = window.__wardenItems;
          const s = { v: 1, name: 'Aldric Vane', level: 3, xp: 0, points: 0, perks: {}, equip: I.starterGear(), bag: [], scrap: 0, stims: 3,
            trait: 'inquest', flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: Date.now(), kills: 0, pos: [12, -4], hp: 999 };
          localStorage.setItem('warden.save.v1', JSON.stringify(s)); }""")
        pg.reload(wait_until="load")
        pg.wait_for_function("window.__warden && document.querySelector('#menu button[data-act=continue]')", timeout=90000)
        time.sleep(2)
        pg.screenshot(path=str(OUT / f"{PRE}-00-title.png"))
        pg.evaluate("window.__wardenNoDyn = true")
        pg.click("#menu button[data-act=continue]")
        pg.wait_for_function("window.__warden.game.state === 'play'", timeout=60000)
        pg.evaluate(SETUP)
        E = lambda js: pg.evaluate(f"(async () => {{ const g = window.__warden.game, X = window.__gfx; {js} }})()")
        E("X.clear(); g.applySetting && g.applySetting('scale', 1); g.player.pos.set(12, 0, -4); g.player.face = 0.5; g.camYaw = 0.5; g.ui.close && g.ui.isOpen && g.ui.close();")
        time.sleep(1.5)
        def shot(name, setup, wait=2.0):
            E("X.thaw(); X.clear();" + setup)
            time.sleep(wait)
            E("X.freeze()"); time.sleep(0.4)
            pg.screenshot(path=str(OUT / f"{PRE}-{name}.png"))
            print("saved", name)
        shot("01-warden-idle", "X.cam([0.55, 1.55, 2.3], 1.35);", 3)
        shot("02-warden-back", "X.cam([-1.6, 1.9, -2.6], 1.3);", 2)
        # blade swing: trigger a heavy and freeze in the late part of the cut so the trail is long
        E("X.thaw(); X.clear(); X.cam([2.6, 1.5, 1.2], 1.2, [0, 0, 0.6]);"); time.sleep(1.5)
        E("""const p = g.player; const real = g.update; let armed = false;
             g.update = function (dt) { real.call(g, dt); if (p.state === 'attack' && p.atk && p.atk.heavy) { armed = true;
               const T = p.t * (1 + g.stats.aspd / 100), [tw, ta] = p.atk.t; if (T >= tw + ta * 0.8) { g.update = function () {}; g._realUpdate = real; } } };
             g.edge.heavy = true;""")
        for _ in range(100):
            if pg.evaluate("!!window.__warden.game._realUpdate"): break
            time.sleep(0.1)
        time.sleep(0.4); pg.screenshot(path=str(OUT / f"{PRE}-03-blade-swing.png")); print("saved 03-blade-swing")
        # light combo swing from behind-ish
        E("X.thaw(); X.clear(); X.cam([1.8, 1.9, -2.4], 1.2, [0, 0, 1]);"); time.sleep(1.2)
        E("""const p = g.player; const real = g.update;
             g.update = function (dt) { real.call(g, dt); if (p.state === 'attack' && p.atk && p.atk.kind === 'l1') {
               const T = p.t * (1 + g.stats.aspd / 100), [tw, ta] = p.atk.t; if (T >= tw + ta * 0.9) { g.update = function () {}; g._realUpdate = real; } } };
             g.player.combo = 0; g.edge.light = true;""")
        for _ in range(100):
            if pg.evaluate("!!window.__warden.game._realUpdate"): break
            time.sleep(0.1)
        time.sleep(0.4); pg.screenshot(path=str(OUT / f"{PRE}-04-blade-light.png")); print("saved 04-blade-light")
        shot("05-enemies", "await X.spawn('husk', -1.6, 4.2); await X.spawn('skitter', 0.3, 3.4); await X.spawn('spitter', 2.3, 5.0); X.cam([0.4, 1.4, 0.6], 0.9, [0.2, 0, 4.2]);", 2.5)
        shot("06-husk-close", "await X.spawn('husk', 0, 3.2); X.cam([0.6, 1.5, 1.2], 1.1, [0, 0, 3.2]);", 2.0)
        # death dissolve
        E("X.thaw(); X.clear(); await X.spawn('husk', 0, 3.2); await X.spawn('skitter', -6, 9); X.cam([0.9, 1.4, 1.0], 0.8, [0, 0, 3.2]);"); time.sleep(1.5)
        E("const e = g.enemies[0]; e.hp = 1; e.hurt(5, g.player.pos, 0, false);"); time.sleep(1.2)
        E("X.freeze()"); time.sleep(0.4); pg.screenshot(path=str(OUT / f"{PRE}-07-death.png")); print("saved 07-death")
        E("X.thaw(); g.boss = null;")
        shot("08-boss", "const i = await X.spawn('bellwright', 0, 8); X.cam([1.2, 1.1, 0.5], 2.4, [0, 0, 8]);", 3.0)
        shot("09-townsperson", """const T = window.__warden.THREE, p = g.player, f = p.face; const n = g.watch, m = g.brann, k = g.mira;
             const put = (o, s, d, rot) => { o.visible = true; o.position.copy(p.pos).add(new T.Vector3(Math.sin(f) * d - Math.cos(f) * s, 0, Math.cos(f) * d + Math.sin(f) * s)); o.rotation.set(0, f + Math.PI + rot, 0); };
             put(n, -0.9, 3.2, 0.3); put(m, 1.1, 3.8, -0.3); put(k, 0.1, 2.6, 0); X.cam([0.3, 1.5, 0.2], 0.9, [0.1, 0, 3.2]);""", 2.0)
        shot("10-warden-rest", "g.player.restT = 30; g.player.face = 0.5; X.cam([0.9, 1.5, 2.6], 1.2);", 3.0)
        shot("11-helm", "X.cam([0.25, 2.0, 0.9], 1.95);", 1.5)
        info = pg.evaluate("(() => { const r = window.__warden.renderer.info; return {calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, tex: r.memory.textures}; })()")
        print("render info:", info)
        b.close()
    print("console errors:", len(errors))
    for e in errors: print("  ", e)
    (OUT / f"{PRE}-errors.json").write_text(json.dumps(errors, indent=1))
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
