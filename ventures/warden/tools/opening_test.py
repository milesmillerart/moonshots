#!/usr/bin/env python3
"""0.10 cold-open test: plays the opening headless on desktop (1600x900) or, with --mobile, on iPhone 13, Pixel 7
and iPhone SE landscape with real CDP touch taps. Grows with each 0.10.x milestone.
0.10.1 (flow restructure): no naming at the title -> cold open (case, verdict, Wave A) -> character creation -> open world.
  Checks: nameless new Warden ("Warden"), schema 5 + flags.opening 'act1', mid-open reloads resume at the last beat
  (case / skirmish / creation), creation names the Warden and opens the capital, legacy judged saves skip the cold open
  ('legacy'), a named-but-unjudged old save plays the cold open and keeps its name (no name field). Zero console errors.
Usage: python3 tools/opening_test.py [URL] [OUTDIR] [--mobile] [--shot=PATH]"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) if "=" in a else (a[2:], True) for a in sys.argv[1:] if a.startswith("--"))
MOBILE = bool(opt.get("mobile"))
URL = (args[0] if args else "http://127.0.0.1:8765/").rstrip("/") + "/"
OUT = Path(args[1] if len(args) > 1 else "/workspace/warden-010/opening"); OUT.mkdir(parents=True, exist_ok=True)
SHOT = opt.get("shot")
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
READY = "window.__warden && window.__wardenItems && document.querySelector('#menu button')"

def ok(c, msg):
    if not c: raise AssertionError(msg)
    print("  OK", msg)

def run(p, devname, tag):
    errors = []
    b = p.chromium.launch(args=ARGS)
    if devname:
        dev = dict(p.devices[devname]); dev.pop("default_browser_type", None); ctx = b.new_context(**dev)
    else:
        ctx = b.new_context(viewport={"width": 1600, "height": 900})
    pg = ctx.new_page(); pg.set_default_timeout(180000)
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    vw, vh = pg.viewport_size["width"], pg.viewport_size["height"]
    cdp = ctx.new_cdp_session(pg) if devname else None
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    def press(sel):  # tap on phones, click on desktop
        bb = pg.locator(sel).first.bounding_box(); assert bb, f"no box for {sel}"
        ok_vis = bb["y"] >= 0 and bb["y"] + bb["height"] <= vh + 1 and bb["x"] + bb["width"] <= vw + 1
        assert ok_vis, f"{sel} off screen {bb} in {vw}x{vh}"
        x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        if cdp:
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 7}]}); time.sleep(0.06)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        else: pg.mouse.click(x, y)
        time.sleep(0.35)
    def boot(clear=True):
        if clear: G("g.save && g.toTitle()"); pg.evaluate("localStorage.clear()")
        pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=180000); pg.evaluate("window.__wardenNoDyn = true"); time.sleep(1.0)
    def advance_until(cond_js, limit=40):
        for _ in range(limit):
            if G(f"return !!({cond_js})"): return True
            if pg.query_selector("#dialogue:not(.hidden) .more"): press("#dialogue")
            else: time.sleep(0.5)
        return G(f"return !!({cond_js})")
    def kill_wave():
        G("for (const e of g.enemies) if (!e.dead) e.hurt(99999, g.player.pos, 999, false);")
    pg.goto(URL, wait_until="load"); pg.wait_for_function(READY, timeout=180000)
    print(f"== {tag}: {devname or 'desktop'} {vw}x{vh}")
    boot()
    # 1. title: no naming, straight into the cold open
    press("#menu button[data-act=new]")
    pg.wait_for_selector("#dialogue:not(.hidden)", timeout=60000)
    ok(not pg.query_selector("#wname"), "new game skips naming at the title and starts the cold open")
    s = pg.evaluate("window.__wardenSave.readSlot(0)")
    ok(s["schema"] == 5 and s["flags"]["opening"] == "act1" and s["name"] == "" and not s["flags"].get("named"), "new save: schema 5, opening 'act1', nameless")
    who = G("return [...document.querySelectorAll('#dialogue .who, #dialogue .line')].map(e => e.textContent).join(' | ')")
    ok("Warden {name}" not in who and "Warden Kade" not in who, f"the Warden is addressed only as 'Warden' ({who[:80]})")
    # 2. mid-case reload resumes the case
    boot(clear=False)
    sub = pg.inner_text("#menu button[data-act=continue]")
    ok("cold open" in sub.lower() and "Warden ·" in sub, f"Continue shows the nameless Warden in the cold open: {sub!r}")
    press("#menu button[data-act=continue]")
    pg.wait_for_selector("#dialogue:not(.hidden)", timeout=60000); ok(True, "reload during the case resumes the case")
    # 3. verdict (0.10.1 keeps the old scene), then the skirmish
    ok(advance_until("document.querySelector('#dialogue .choices')"), "dialogue advances to the verdict")
    press("#dialogue .choices button[data-c='2']")
    ok(advance_until("g.state === 'play' && !g.dialogueOpen", 50), "verdict leads into the skirmish")
    st = G("return { trait: g.save.trait, alive: g.enemies.filter(e => !e.dead).length, judged: g.save.flags.judged }")
    ok(st["trait"] == "inquest" and st["alive"] == 3 and st["judged"], f"skirmish: three Husks {st}")
    # 4. mid-skirmish reload resumes the skirmish (no replay of the case)
    boot(clear=False); press("#menu button[data-act=continue]"); time.sleep(2.5)
    st = G("return { state: g.state, dlg: g.dialogueOpen, alive: g.enemies.filter(e => !e.dead).length }")
    ok(st["state"] == "play" and not st["dlg"] and st["alive"] == 3, f"reload during the skirmish resumes the skirmish {st}")
    # 5. clear the street -> character creation
    kill_wave()
    pg.wait_for_selector("#title.create-on #wname", timeout=60000); time.sleep(1.2)
    ok(G("return g.state") != "play" and not G("return g.save.flags.created"), "clearing the street opens character creation")
    if SHOT and tag in ("desktop", "iphone13"): pg.screenshot(path=SHOT if tag == "desktop" else SHOT.replace(".png", "-phone.png")); print("  saved", SHOT)
    pg.screenshot(path=str(OUT / f"{tag}-creation.png"))
    # 5b. reload at creation returns to creation
    boot(clear=False); press("#menu button[data-act=continue]")
    pg.wait_for_selector("#title.create-on #wname", timeout=60000); ok(True, "reload at character creation returns to creation")
    press("#wname"); pg.keyboard.type("Aldric Vane"); press("[data-act=oath]"); time.sleep(1.5)
    s = pg.evaluate("window.__wardenSave.readSlot(0)")
    ok(s["name"] == "Aldric Vane" and s["flags"]["created"] and s["flags"]["opening"] == "done" and G("return g.state") == "play", "Take the Oath names the Warden and opens the capital")
    ok("Statute Plaza" in G("return g.objective"), "objective points into the capital")
    boot(clear=False); press("#menu button[data-act=continue]"); time.sleep(2.0)
    ok(G("return g.state") == "play" and not G("return g.dialogueOpen") and not pg.query_selector("#title.create-on"), "after creation, Continue goes to the open world")
    # 6. legacy: a 0.9 (schema 4) Warden who judged Mira never replays the cold open
    G("g.toTitle()"); time.sleep(0.5)  # drop the live save first, or the unload autosave writes it back
    pg.evaluate("""() => { localStorage.clear(); const I = window.__wardenItems;
      const s = { schema: 4, v: 4, name: 'Old Hand', level: 6, xp: 3, points: 0, perks: { keen_edge: 1 }, equip: I.starterGear(), bag: [], scrap: 500, stims: 3, trait: 'dread',
        flags: { judged: true, waveA: true, waveB: true }, created: 1763300000000, kills: 40, playTime: 900, saved: Date.now(), ground: [], pos: [0, -4] };
      localStorage.setItem('warden.slot.1', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 1, v1Done: [] })); }""")
    boot(clear=False); press("#menu button[data-act=continue]"); time.sleep(2.0)
    st = G("return { state: g.state, dlg: g.dialogueOpen, op: g.save.flags.opening, name: g.save.name, lvl: g.save.level, trait: g.save.trait, schema: g.save.schema }")
    ok(st["state"] == "play" and not st["dlg"] and st["op"] == "legacy" and st["name"] == "Old Hand" and st["lvl"] == 6 and st["trait"] == "dread" and st["schema"] == 5, f"legacy judged save continues in the open world {st}")
    # 7. named-but-unjudged old save: plays the cold open, keeps its name, creation has no name field
    G("g.toTitle()"); time.sleep(0.5)  # drop the live save first, or the unload autosave writes it back
    pg.evaluate("""() => { localStorage.clear(); const I = window.__wardenItems;
      const s = { schema: 4, v: 4, name: 'Sera Quill', level: 1, xp: 0, points: 1, perks: {}, equip: I.starterGear(), bag: [], scrap: 0, stims: 3, trait: null,
        flags: {}, created: Date.now(), kills: 0, playTime: 5, saved: Date.now(), ground: [] };
      localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] })); }""")
    boot(clear=False); press("#menu button[data-act=continue]")
    pg.wait_for_selector("#dialogue:not(.hidden)", timeout=60000)
    ok(G("return g.save.flags.opening") == "act1" and G("return g.save.flags.named") is True, "named unjudged old save starts the cold open")
    ok(advance_until("document.querySelector('#dialogue .choices')"), "…and reaches the verdict"); press("#dialogue .choices button[data-c='1']")
    ok(advance_until("g.state === 'play' && !g.dialogueOpen", 50), "…and the skirmish"); kill_wave()
    pg.wait_for_selector("#title.create-on [data-act=oath]", timeout=60000)
    ok(not pg.query_selector("#wname"), "creation skips the name field for a Warden who already chose one")
    press("[data-act=oath]"); time.sleep(1.0)
    ok(G("return g.save.name") == "Sera Quill" and G("return g.save.flags.created"), "name kept, capital opens")
    b.close()
    print("  console errors:", len(errors))
    for e in errors: print("   ", e)
    return errors

def main():
    errs = []
    with sync_playwright() as p:
        if MOBILE:
            for dev, tag in (("iPhone 13 landscape", "iphone13"), ("Pixel 7 landscape", "pixel7"), ("iPhone SE landscape", "iphonese")):
                errs += run(p, dev, tag)
        else: errs += run(p, None, "desktop")
    print("opening_test:", "ALL OK" if not errs else f"{len(errs)} console errors")
    return 1 if errs else 0

if __name__ == "__main__":
    sys.exit(main())
