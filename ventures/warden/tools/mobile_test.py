#!/usr/bin/env python3
"""Mobile smoke test for Warden: Chromium with phone emulation (hasTouch, isMobile), real CDP
touch events. Walks title -> naming -> judgment -> play, moves with the left stick, looks with a
right-side drag, strikes, rolls, opens Armory / Skills / Pause, checks the portrait prompt,
asserts zero console errors and saves screenshots.
Usage: python3 tools/mobile_test.py [URL] [OUTDIR]"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/warden-mobile"); OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

def run(p, devname, tag, full):
    dev = dict(p.devices[devname]); dev.pop("default_browser_type", None)
    errors = []
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(**dev); pg = ctx.new_page(); pg.set_default_timeout(120000)
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    pg.on("dialog", lambda d: d.accept())
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, pts):
        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, x, y in pts]})
    def tap(x, y):
        touch("touchStart", [(9, x, y)]); time.sleep(0.06); touch("touchEnd", [])
    def tap_el(sel):
        bb = pg.locator(sel).first.bounding_box(); assert bb, f"no box for {sel}"
        tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); time.sleep(0.35)
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    vw, vh = dev["viewport"]["width"], dev["viewport"]["height"]
    print(f"== {tag}: {devname} {vw}x{vh}")
    pg.goto(URL + ("&" if "?" in URL else "?") + "fresh=" + str(time.time()), wait_until="load")
    pg.wait_for_function("window.__warden && document.querySelector('#menu button')", timeout=90000)
    pg.evaluate("localStorage.clear()"); pg.reload(wait_until="load")
    pg.wait_for_function("window.__warden && document.querySelector('#menu button')", timeout=90000)
    pg.evaluate("window.__wardenNoDyn = true")
    assert pg.evaluate("document.documentElement.classList.contains('touch')"), "touch mode not detected"
    time.sleep(2.5)
    if full: pg.screenshot(path=str(OUT / f"{tag}-01-title.png"))
    # title buttons must fit on screen
    for bb in [pg.locator(s).bounding_box() for s in ["#menu button >> nth=-1"]]:
        assert bb["y"] + bb["height"] <= vh, f"title menu overflows: {bb}"
    tap_el("#menu button[data-act=new]")
    pg.wait_for_selector("#wname")
    tap_el("#wname"); pg.keyboard.type("Aldric Vane")
    if full: pg.screenshot(path=str(OUT / f"{tag}-02-naming.png"))
    bb = pg.locator("[data-act=oath]").bounding_box(); assert bb["y"] + bb["height"] <= vh, "oath button off screen"
    tap_el("[data-act=oath]")
    pg.wait_for_selector("#dialogue:not(.hidden)", timeout=30000)
    for _ in range(14):
        if pg.query_selector("#dialogue .choices"): break
        time.sleep(0.5); tap(vw * 0.5, vh * 0.25)  # tap the scene to advance
    pg.wait_for_selector("#dialogue .choices button", timeout=20000); time.sleep(1.5)
    if full: pg.screenshot(path=str(OUT / f"{tag}-03-judgment.png"))
    last = pg.locator("#dialogue .choices button").last.bounding_box()
    assert last["y"] + last["height"] <= vh, f"judgment choices off screen: {last}"
    tap_el("#dialogue .choices button[data-c='2']")
    for _ in range(20):
        time.sleep(0.7)
        if G("return g.state") == "play" and not G("return g.dialogueOpen"): break
        if pg.query_selector("#dialogue:not(.hidden)"): tap_el("#dialogue")
    time.sleep(1.2)
    assert G("return g.state") == "play", "did not reach play"
    assert G("return g.save.trait") == "inquest"
    assert pg.is_visible("#touch .b-light"), "touch buttons not visible"
    # joystick: push up from the lower-left for 1.4 s
    p0 = G("return [g.player.pos.x, g.player.pos.z]")
    sx, sy = vw * 0.18, vh * 0.72
    touch("touchStart", [(1, sx, sy)])
    for k in range(1, 8): touch("touchMove", [(1, sx, sy - 9 * k)]); time.sleep(0.03)
    time.sleep(1.2)
    joy = G("return g.joy")
    if full: pg.screenshot(path=str(OUT / f"{tag}-04-gameplay-controls.png"))
    # second finger drags the camera while the stick is held
    yaw0 = G("return g.camYaw")
    rx, ry = vw * 0.6, vh * 0.4
    touch("touchStart", [(1, sx, sy - 63), (2, rx, ry)])
    for k in range(1, 8): touch("touchMove", [(1, sx, sy - 63), (2, rx + 12 * k, ry)]); time.sleep(0.03)
    touch("touchEnd", [(1, sx, sy - 63)]); touch("touchEnd", [])
    yaw1 = G("return g.camYaw")
    p1 = G("return [g.player.pos.x, g.player.pos.z]")
    moved = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5
    print(f"  joystick {joy}, moved {moved:.2f} m, camera yaw {yaw0:.2f} -> {yaw1:.2f}")
    assert moved > 1.0, "joystick did not move the Warden"
    assert abs(yaw1 - yaw0) > 0.1, "right-side drag did not orbit the camera"
    assert G("return g.joy") is None, "stick did not release"
    # attack + dodge via buttons
    G("g._atk = 0; const o = g.player.startAttack.bind(g.player); g.player.startAttack = (k) => { g._atk++; return o(k); }")
    def wait_move():
        for _ in range(80):
            if G("return g.player.state") == "move": return
            time.sleep(0.1)
    wait_move(); tap_el("#touch .b-light"); time.sleep(0.5); wait_move(); tap_el("#touch .b-heavy"); time.sleep(0.8)
    atk = G("return g._atk"); assert atk >= 2, f"attacks not triggered ({atk})"
    wait_move()
    G("g.player.sta = g.stats.sta")
    st = []
    tap(*(lambda bb: (bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2))(pg.locator("#touch .b-dodge").bounding_box()))
    for _ in range(6): st.append(G("return g.player.state")); time.sleep(0.05)
    assert "dodge" in st, f"dodge not triggered {st}"
    tap_el("#touch .b-lock"); time.sleep(0.2)
    print(f"  attacks {atk}, dodge states {st[:3]}, lock {G('return !!g.lockTarget')}")
    # menus
    tap_el("#touch [data-t=armory]"); time.sleep(0.8)
    assert G("return g.ui.screen") == "armory"
    tap_el("#panel [data-item]"); time.sleep(0.4)
    if full: pg.screenshot(path=str(OUT / f"{tag}-05-armory.png"))
    tap_el("#panel [data-tab=skills]"); time.sleep(0.6)
    assert G("return g.ui.screen") == "skills"
    G("g.ui.skills.sel = null"); tap_el("#panel .nd.avail .hex"); time.sleep(0.4)  # select (or arm if already selected)
    if not G("return g.ui.skills.armed"): tap_el("#panel .nd.sel .hex"); time.sleep(0.4)  # tap again arms
    tap_el("#panel .sk-learn.armed"); time.sleep(0.6)
    learned = G("return Object.values(g.save.perks).reduce((a,b)=>a+b,0)")
    assert learned >= 1, "could not learn a perk by tapping"
    if full: pg.screenshot(path=str(OUT / f"{tag}-06-skills.png"))
    tap_el("#panel [data-act=close]"); time.sleep(0.5)
    assert not G("return g.ui.isOpen")
    pg.wait_for_selector("#touch [data-t=pause]", state="visible", timeout=20000)
    tap_el("#touch [data-t=pause]"); time.sleep(0.6)
    assert G("return g.ui.screen") == "pause"
    if full: pg.screenshot(path=str(OUT / f"{tag}-07-pause.png"))
    tap_el("#panel [data-tab=news]"); time.sleep(0.6)
    if full: pg.screenshot(path=str(OUT / f"{tag}-08-whats-new.png"))
    tap_el("#panel [data-act=close]"); time.sleep(0.4)
    # forge: walk the Warden there and use the contextual button
    G("const F = window.__wardenPOI; if (F) g.player.pos.set(F.forge.x + 1.5, 0, F.forge.z + 1.5);")
    time.sleep(0.8)
    if G("return !!g.nearForge"):
        tap_el("#touch .b-use"); time.sleep(0.7)
        assert G("return g.ui.screen") == "forge"
        if full: pg.screenshot(path=str(OUT / f"{tag}-09-forge.png"))
        tap_el("#panel [data-act=close]"); time.sleep(0.4)
    # HUD overlap check: objective vs name block
    ob = pg.locator("#objective").bounding_box(); nb = pg.locator("#hud .tl").bounding_box()
    assert ob["x"] >= nb["x"] + nb["width"] - 1 or ob["y"] >= nb["y"] + nb["height"], f"objective overlaps name: {ob} {nb}"
    perf = G("return { pr: g.renderer.getPixelRatio(), shadows: g.renderer.shadowMap.enabled, scale: g.settings.scale }")
    print("  render", perf)
    # portrait prompt
    pg.set_viewport_size({"width": vh, "height": vw}); time.sleep(0.8)
    assert pg.is_visible("#rotate"), "rotate prompt not shown in portrait"
    if full: pg.screenshot(path=str(OUT / f"{tag}-10-portrait-prompt.png"))
    pg.set_viewport_size({"width": vw, "height": vh}); time.sleep(0.5)
    assert not pg.is_visible("#rotate")
    b.close()
    print(f"  console errors: {len(errors)}")
    for e in errors: print("   ", e)
    return errors

def main():
    with sync_playwright() as p:
        errs = []
        errs += run(p, "iPhone 13 landscape", "iphone13", True)
        errs += run(p, "Pixel 7 landscape", "pixel7", True)
        dev = "iPhone SE landscape" if "iPhone SE landscape" in p.devices else "iPhone 8 landscape"
        errs += run(p, dev, "small", False)
        assert not errs, "console errors"
        print("MOBILE OK")

if __name__ == "__main__":
    main()
