#!/usr/bin/env python3
"""0.9 asset-pipeline test. Usage: python3 tools/assets_test.py [URL] [OUTDIR] [--mobile]
Loads the game with ?assets=assets/test/manifest.json, where a CC0 rigged robot (three.js RobotExpressive) stands in
for Don's GLB models, and checks:
1. Manifest loads; char_warden / enemy_husk / prop_testcrate load; enemy_skitter (missing file on purpose) fails soft.
2. The Warden is drawn by the GLB (procedural plate hidden), the AnimationMixer runs idle -> walk/run -> attack clips
   from Mixamo-style names, and the Synthblade sits in the GLB's right hand.
3. A husk spawns as the GLB (walk/attack/death clips); a skitter falls back to the procedural model.
4. Manifest placements spawn props in the world. 5. Default manifest (no override) = procedural only, zero errors.
The only allowed console error is the deliberate 404 for the missing test file."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
MOBILE = "--mobile" in sys.argv
URL = (args[0] if args else "http://127.0.0.1:8765/").rstrip("/") + "/"
OUT = Path(args[1] if len(args) > 1 else "/workspace/warden-09/assets"); OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
SAVE = """() => { const I = window.__wardenItems;
  const s = { schema: 4, v: 4, name: 'Kade', level: 3, xp: 0, points: 0, perks: {}, equip: I.starterGear(), bag: [], scrap: 0, stims: 3,
    trait: 'inquest', flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: Date.now(), kills: 0, pos: [0, 30], hp: 999, ground: [], playTime: 1, saved: Date.now() };
  localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] })); }"""
fails = []
def ok(c, msg):
    print(("  OK " if c else "  FAIL ") + msg, flush=True)
    if not c: fails.append(msg)

def run(p, query):
    errors = []
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(**p.devices["iPhone 13 landscape"]) if MOBILE else b.new_context(viewport={"width": 1280, "height": 720})
    pg = ctx.new_page(); pg.set_default_timeout(180000)
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    pg.goto(URL + query, wait_until="load")
    pg.wait_for_function("window.__warden && window.__wardenItems && document.querySelector('#menu button')", timeout=150000)
    pg.evaluate(SAVE); pg.reload(wait_until="load")
    pg.wait_for_function("window.__warden && document.querySelector('#menu button[data-act=continue]')", timeout=150000)
    pg.evaluate("window.__wardenNoDyn = true")
    pg.click("#menu button[data-act=continue]")
    pg.wait_for_function("window.__warden.game.state === 'play'", timeout=90000)
    return b, pg, errors

def main():
    with sync_playwright() as p:
        print("== test manifest", "(mobile)" if MOBILE else "", flush=True)
        b, pg, errors = run(p, "?assets=assets/test/manifest.json")
        E = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game, A = window.__warden.Assets; {js} }})()")
        info = E("return { list: A.list(), errors: A.errors.map((e) => e.id), tier: window.__warden.Q.name };")
        print("  ", info)
        ok(set(["char_warden", "enemy_husk", "prop_testcrate"]) <= set(info["list"]), "char_warden, enemy_husk, prop_testcrate loaded")
        ok(info["errors"] == ["enemy_skitter"], "missing enemy_skitter GLB fails soft (procedural fallback)")
        E("for (const e of g.enemies) e.dispose(); g.enemies = []; g.player.restT = 0;")
        pg.wait_for_function("window.__warden.game.player.skinState === 'idle'", timeout=60000)
        st = E("""const p = g.player; let hid = 0, vis = 0; p.model.traverse((o) => { if (o.userData.hiddenBySkin) hid++; });
          p.skin.root.traverse((o) => { if (o.isMesh && o.visible) vis++; });
          return { skin: !!p.skin, anim: !!p.skin.anim, hid, vis, clips: Object.keys(p.skin.anim.actions), hand: p.hand?.name };""")
        print("  ", st)
        ok(st["skin"] and st["anim"] and st["hid"] > 10 and st["vis"] > 5, "Warden drawn by the GLB, procedural plate hidden")
        ok({"idle", "walk", "run", "attack", "dodge", "hit", "death"} <= set(st["clips"]), "logical clips mapped from Mixamo-style names")
        d = E("""const p = g.player, T = window.__warden.THREE; p.model.updateMatrixWorld(true);
          const a = p.u.sword.getWorldPosition(new T.Vector3()), h = p.hand.getWorldPosition(new T.Vector3()); return a.distanceTo(h);""")
        ok(d < 0.25, f"Synthblade grip sits in the GLB right hand ({d:.3f} m)")
        pg.keyboard.down("w")
        pg.wait_for_function("['walk', 'run'].includes(window.__warden.game.player.skinState)", timeout=60000)
        ok(True, "moving plays walk/run: " + E("return g.player.skinState;"))
        pg.keyboard.up("w")
        pg.wait_for_function("window.__warden.game.player.skinState === 'idle'", timeout=60000)
        E("g.edge.light = true;")
        pg.mouse.move(640, 360); pg.mouse.down(); time.sleep(0.15); pg.mouse.up()
        pg.wait_for_function("(window.__warden.game.player.skinState || '').startsWith('attack')", timeout=60000)
        ok(True, "attack plays an attack clip: " + E("return g.player.skinState;"))
        sp = E("""const T = window.__warden.THREE, p = g.player, Enemy = window.__wardenEnemy;
          const h = new Enemy(g, 'husk', p.pos.clone().add(new T.Vector3(1.5, 0, -5)), 1); h.aggro = true; g.enemies.push(h);
          const s = new Enemy(g, 'skitter', p.pos.clone().add(new T.Vector3(-3, 0, -9)), 1); g.enemies.push(s);
          let svis = 0; s.model.traverse((o) => { if (o.isMesh && o.visible) svis++; });
          return { husk: !!h.skin, huskAnim: !!h.skin?.anim, skitter: !!s.skin, svis };""")
        print("  ", sp)
        ok(sp["husk"] and sp["huskAnim"], "husk spawns as the GLB with an AnimationMixer")
        ok(not sp["skitter"] and sp["svis"] > 3, "skitter falls back to the procedural model")
        pg.wait_for_function("(() => { const h = window.__warden.game.enemies.find((e) => e.type === 'husk'); return h && ['walk','run','attack','idle'].includes(h.skinState); })()", timeout=90000)
        ok(True, "husk animates: " + E("return g.enemies.find((e) => e.type === 'husk').skinState;"))
        E("g.enemies.find((e) => e.type === 'husk').hurt(9999, g.player.pos, 0, false);")
        pg.wait_for_function("(() => { const h = window.__warden.game.enemies.find((e) => e.type === 'husk'); return !h || h.skinState === 'death'; })()", timeout=60000)
        ok(True, "husk death clip")
        props = E("let n = 0; g.scene.traverse((o) => { if (o.userData?.assetId === 'prop_testcrate') n++; }); return n;")
        ok(props >= 1, f"manifest placements spawn props ({props})")
        E("""for (const e of g.enemies) e.dispose(); g.enemies = []; const T = window.__warden.THREE, p = g.player; g.ui.hud.classList.add('hidden');
          g.cine = { pos: p.pos.clone().add(new T.Vector3(1.4, 1.7, 3.4)), look: p.pos.clone().add(new T.Vector3(0, 0.9, 0)) }; g._lastCine = null;""")
        time.sleep(3); pg.screenshot(path=str(OUT / f"{'mobile' if MOBILE else 'desktop'}-assets-testbot.png"))
        bad = [e for e in errors if "missing_on_purpose" not in e and "404" not in e and "Failed to load resource" not in e]
        ok(not bad, f"no unexpected console errors ({len(errors)} total, {len(bad)} unexpected) {bad[:3]}")
        b.close()
        print("== default manifest", flush=True)
        b, pg, errors = run(p, "")
        lst = pg.evaluate("window.__warden.Assets.list()")
        ok(lst == [] and pg.evaluate("!window.__warden.game.player.skin"), "default manifest: procedural models only")
        ok(not errors, f"zero console errors ({errors[:3]})")
        b.close()
    print("assets_test:", "ALL OK" if not fails else f"{len(fails)} FAILED")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
