#!/usr/bin/env python3
"""Headless smoke test for every Daycade game (Playwright, Chromium).
Usage: tools/smoke_test.py BASE_URL [SHOT_DIR]
Checks: no console errors / page errors, canvas renders non-blank, start + inputs change state.
"""
import sys, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
SHOTS = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/arcade-shots"); SHOTS.mkdir(parents=True, exist_ok=True)
results = {}

def nonblank(page):
    return page.evaluate("""() => { const c = document.querySelector('canvas'); if (!c) return true;
      const x = document.createElement('canvas'); x.width = 64; x.height = 64; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data; let s = new Set(); for (let i = 0; i < d.length; i += 16) s.add(d[i] >> 4 << 8 | d[i+1] >> 4 << 4 | d[i+2] >> 4); return s.size > 6; }""")

def start(page):
    page.wait_for_selector(".dk-ov.on .dk-btn", timeout=8000)
    page.click(".dk-ov.on .dk-btn")
    page.wait_for_timeout(300)

def run(p, slug, mobile):
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(**({"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True} if mobile else {"viewport": {"width": 1280, "height": 720}}))
    page = ctx.new_page()
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("requestfailed", lambda r: errs.append("requestfailed " + r.url))
    page.goto(BASE + slug + "/play/", wait_until="load")
    page.wait_for_timeout(600)
    notes = []
    tag = "mobile" if mobile else "desktop"
    page.screenshot(path=str(SHOTS / f"{slug}-{tag}-menu.png"))
    start(page)
    st = lambda: page.evaluate("window.__game.state")
    sc = lambda: page.evaluate("window.__game.score")
    tap = (lambda x, y: page.touchscreen.tap(x, y)) if mobile else (lambda x, y: page.mouse.click(x, y))
    W, H = (390, 844) if mobile else (1280, 720)
    ok = True
    if slug == "stackfall":
        for i in range(6):
            page.wait_for_timeout(450)
            if i % 2: page.keyboard.press("Space")
            else: tap(W // 2, H // 2)
        page.wait_for_timeout(200)
        notes.append(f"state={st()} score={sc()} drops={page.evaluate('window.__drops')}")
        ok = page.evaluate('window.__drops') >= 1
    elif slug == "polarity":
        g0 = page.evaluate("window.__game.gravity")
        tap(W // 2, H // 2); page.wait_for_timeout(500)
        g1 = page.evaluate("window.__game.gravity")
        page.keyboard.press("Space"); page.wait_for_timeout(500)
        g2 = page.evaluate("window.__game.gravity")
        page.wait_for_timeout(1500)
        notes.append(f"gravity {g0}->{g1}->{g2} state={st()} score={sc()}")
        ok = g0 != g1 and g1 != g2
    elif slug == "nova-merge":
        page.keyboard.press("Space"); page.wait_for_timeout(700)
        for c in range(5):
            box = page.evaluate("(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.width, c.height]; })()")
            # columns are centered; logical board 350 of 400 wide
            s = min(box[0] / 400, box[1] / 700); ox = (box[0] - 400 * s) / 2; oy = (box[1] - 700 * s) / 2
            x = ox + (25 + 35 + c * 70) * s; y = oy + 400 * s
            tap(x, y); page.wait_for_timeout(700)
        page.keyboard.press("ArrowLeft"); page.keyboard.press("Enter"); page.wait_for_timeout(800)
        cnt = page.evaluate("window.__game.phase")
        notes.append(f"state={st()} score={sc()} phase={cnt}")
        ok = st() in ("play", "over", "dying")
    elif slug == "neon-siege":
        p0 = page.evaluate("[window.__game.player.x, window.__game.player.y]")
        if mobile:
            page.touchscreen.tap(200, 500)
            # drag via dispatching pointer events (touchscreen API has no drag)
            page.evaluate("""() => { const c = document.querySelector('canvas'); const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, {clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', bubbles: true, buttons: 1}));
              ev('pointerdown', 200, 500); ev('pointermove', 260, 500); window.__drag = ev; }""")
            page.wait_for_timeout(800)
            page.evaluate("window.__drag('pointerup', 260, 500)")
        else:
            page.keyboard.down("KeyD"); page.wait_for_timeout(800); page.keyboard.up("KeyD")
        p1 = page.evaluate("[window.__game.player.x, window.__game.player.y]")
        page.evaluate("window.__game.grantXp(10)"); page.wait_for_timeout(300)
        picked = page.evaluate("!!document.querySelector('.dk-pick')")
        if picked:
            page.screenshot(path=str(SHOTS / f"{slug}-{tag}-upgrade.png"))
            page.keyboard.press("1"); page.wait_for_timeout(200)
        page.wait_for_timeout(2500)
        notes.append(f"moved {p0}->{p1} upgradeMenu={picked} state={st()} enemies={page.evaluate('window.__game.enemies')}")
        ok = abs(p1[0] - p0[0]) > 20 and picked
    elif slug == "duality":
        cells = page.query_selector_all(".cell")
        sol = page.evaluate("window.__game.solution"); cur = page.evaluate("window.__game.cells")
        empt = [i for i, v in enumerate(cur) if v < 0]
        cells[empt[0]].click(); page.wait_for_timeout(100)
        after = page.evaluate("window.__game.cells")[empt[0]]
        page.keyboard.press("KeyZ"); page.wait_for_timeout(100)
        undone = page.evaluate("window.__game.cells")[empt[0]]
        notes.append(f"givens={36-len(empt)} click->{after} undo->{undone}")
        page.screenshot(path=str(SHOTS / f"{slug}-{tag}-play.png"))
        # solve the rest through the UI to test the win flow
        for i in empt:
            want = sol[i]
            for _ in range(3):
                if page.evaluate("window.__game.cells")[i] == want: break
                cells[i].click()
        page.wait_for_timeout(1500)
        notes.append(f"state={st()} overlay={page.evaluate('!!document.querySelector(\".dk-ov.on .share\")')}")
        ok = after == 0 and undone == -1 and st() == "solved"
    blank_ok = nonblank(page)
    page.screenshot(path=str(SHOTS / f"{slug}-{tag}.png"))
    # one-more-try: if game over panel is open, retry with Space
    over = page.evaluate("!!document.querySelector('.dk-ov.on .dk-btn')")
    b.close()
    return {"ok": ok and blank_ok and not errs, "errors": errs, "notes": notes, "nonblank": blank_ok, "overlay_after": over}

with sync_playwright() as p:
    for slug in ["stackfall", "polarity", "nova-merge", "neon-siege", "duality"]:
        for mobile in (False, True):
            r = run(p, slug, mobile)
            results[f"{slug}:{'mobile' if mobile else 'desktop'}"] = r
            print(("PASS " if r["ok"] else "FAIL ") + slug + (" mobile " if mobile else " desktop ") + json.dumps(r))
    # shell pages
    b = p.chromium.launch(); 
    for vp, tag in (({"width": 1280, "height": 900}, "desktop"), ({"width": 390, "height": 844}, "mobile")):
        ctx = b.new_context(viewport=vp, device_scale_factor=1 if tag == "desktop" else 2)
        pg = ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("requestfailed", lambda r: errs.append("requestfailed " + r.url))
        pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(500)
        pg.screenshot(path=str(SHOTS / f"home-{tag}.png"), full_page=True)
        pg.goto(BASE + "stackfall/", wait_until="networkidle"); pg.wait_for_timeout(1200)
        pg.screenshot(path=str(SHOTS / f"gamepage-stackfall-{tag}.png"))
        print(("PASS" if not errs else "FAIL") + f" shell {tag} {errs}")
    b.close()
fails = [k for k, v in results.items() if not v["ok"]]
print("SUMMARY", "all passed" if not fails else "failed: " + ", ".join(fails))
sys.exit(1 if fails else 0)
