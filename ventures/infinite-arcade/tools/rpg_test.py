#!/usr/bin/env python3
"""Headless Playwright test for Ebbmarrow.
Usage: tools/rpg_test.py BASE_URL [SHOT_DIR]
Desktop + mobile: title, new game, prologue dialogue, walking, NPC talk with a choice,
one battle to victory, save, reload + continue. Fails on any console/page error."""
import sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ARGS = [a for a in sys.argv[1:] if not a.startswith("-")]
BASE = ARGS[0].rstrip("/") + "/"
SHOTS = Path(ARGS[1] if len(ARGS) > 1 else "/workspace/rpg-shots"); SHOTS.mkdir(parents=True, exist_ok=True)
fails = []

def run(p, mobile):
    tag = "mobile" if mobile else "desktop"
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(**({"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True} if mobile else {"viewport": {"width": 1280, "height": 720}}))
    pg = ctx.new_page(); errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("pageerror " + str(e)))
    pg.on("requestfailed", lambda r: errs.append("requestfailed " + r.url))
    ev = lambda js: pg.evaluate(js)
    mode = lambda: ev("window.__rpg && window.__rpg.mode")
    busy = lambda: ev("window.__rpg.busy + (window.__rpg.G.ui.modal ? 1 : 0)")
    def press(k, n=1, gap=120):
        for _ in range(n): pg.keyboard.press(k); pg.wait_for_timeout(gap)
    def a():
        if mobile: pg.locator(".abtns .ab").dispatch_event("pointerdown"); pg.wait_for_timeout(40); pg.locator(".abtns .ab").dispatch_event("pointerup")
        else: pg.keyboard.press("Enter")
    def drain(limit=80):
        for _ in range(limit):
            if busy() == 0: return True
            if "-v" in sys.argv: print("  drain", busy(), ev("(document.querySelector('.dlg:not(.hidden) .dlg-text')||{}).textContent || (document.querySelector('.chooser')||{}).textContent || '-'")[:60])
            if ev("!!document.querySelector('.dlg:not(.hidden) .dlg-next[style*=visible]') || !!document.querySelector('.chooser') || !!document.querySelector('.dlg:not(.hidden)')"):
                if mobile and ev("!!document.querySelector('.dlg:not(.hidden)')") and not ev("!!document.querySelector('.chooser')"): pg.locator(".dlg").dispatch_event("pointerdown")
                else: pg.keyboard.press("Enter")
            pg.wait_for_timeout(260)
        return busy() == 0
    pg.goto(BASE, wait_until="load"); pg.wait_for_selector(".title .ch-item", timeout=10000); pg.wait_for_timeout(700)
    pg.screenshot(path=str(SHOTS / f"title-{tag}.png"))
    # new game
    pg.locator(".title .ch-item", has_text="New game").click(); pg.wait_for_timeout(1200)
    assert mode() == "world", "not in world after new game"
    pg.wait_for_timeout(2600)  # chapter card
    pg.wait_for_selector(".dlg:not(.hidden)", timeout=8000); pg.wait_for_timeout(900)
    pg.screenshot(path=str(SHOTS / f"intro-{tag}.png"))
    assert drain(), "intro dialogue did not finish"
    # walk
    print('  step walk', flush=True)
    x0 = ev("[__rpg.G.world.player.x, __rpg.G.world.player.y]")
    if mobile:
        for k in ("right", "down"):
            pg.locator(f".dpad [data-k={k}]").dispatch_event("pointerdown"); pg.wait_for_timeout(700); pg.locator(f".dpad [data-k={k}]").dispatch_event("pointerup"); pg.wait_for_timeout(200)
    else:
        pg.keyboard.down("ArrowRight"); pg.wait_for_timeout(700); pg.keyboard.up("ArrowRight"); pg.keyboard.down("ArrowDown"); pg.wait_for_timeout(500); pg.keyboard.up("ArrowDown")
    pg.wait_for_timeout(400)
    x1 = ev("[__rpg.G.world.player.x, __rpg.G.world.player.y]")
    assert x1 != x0, f"player did not move {x0} {x1}"
    # go to Ama, talk (dialogue with a choice)
    print('  step talk', flush=True)
    ev("__rpg.G.world.enter('cove', 30, 13, 'right')"); pg.wait_for_timeout(500)
    pg.screenshot(path=str(SHOTS / f"world-{tag}.png"))
    a(); pg.wait_for_timeout(1600)
    assert busy() > 0, "talking to Ama did nothing"
    pg.screenshot(path=str(SHOTS / f"dialogue-{tag}.png"))
    for _ in range(3): pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
    assert drain(120), "Ama dialogue stuck"
    assert ev("__rpg.G.state.S.skills.includes('brine')"), "Brine Lash not learned"
    assert ev("__rpg.G.state.S.quests.q_pro") == "active"
    # battle
    print('  step battle', flush=True)
    ev("__rpg.G.state.give('gaff'); window.__fight = __rpg.G.main.fight(['brinecrab'], {tide: 2}).then(r => window.__res = r); null")
    pg.wait_for_selector(".bpanel .ch-item", timeout=8000); pg.wait_for_timeout(1600)
    pg.screenshot(path=str(SHOTS / f"combat-{tag}.png"))
    for i in range(60):
        if ev("window.__res"): break
        if ev("!!document.querySelector('.bpanel .chooser')"):
            # use Brine Lash once (Arts), otherwise Attack
            if i == 0: press("ArrowRight"); press("Enter", gap=300); press("Enter", gap=300)
            else: press("Enter", gap=200)
        else: pg.keyboard.press("Enter")
        pg.wait_for_timeout(350)
        if i == 2: pg.screenshot(path=str(SHOTS / f"combat2-{tag}.png"))
    res = ev("window.__res"); assert res == "win", f"battle result {res}"
    pg.wait_for_timeout(800)
    assert mode() == "world"
    xp = ev("__rpg.G.state.S.xp"); assert xp > 0
    # save + reload + continue
    print('  step save', flush=True)
    ev("__rpg.G.state.S.flags.test_marker = 1; __rpg.G.state.save()")
    pos = ev("[__rpg.G.state.S.map, __rpg.G.state.S.x, __rpg.G.state.S.y]")
    pg.reload(wait_until="load"); pg.wait_for_selector(".title .ch-item", timeout=10000)
    pg.locator(".title .ch-item", has_text="Continue").click(); pg.wait_for_timeout(1500)
    pos2 = ev("[__rpg.G.state.S.map, __rpg.G.state.S.x, __rpg.G.state.S.y]")
    assert pos == pos2 and ev("__rpg.G.state.S.flags.test_marker") == 1 and ev("__rpg.G.state.S.xp") == xp, f"save mismatch {pos} {pos2}"
    # menu
    print('  step menu', flush=True)
    pg.keyboard.press("Escape") if not mobile else pg.locator(".menu-btn").click()
    pg.wait_for_timeout(500); pg.screenshot(path=str(SHOTS / f"menu-{tag}.png")); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    b.close()
    return errs

with sync_playwright() as p:
    for mobile in ((True,) if '--mobile' in sys.argv else (False,) if '--desktop' in sys.argv else (False, True)):
        tag = "mobile" if mobile else "desktop"
        try:
            e = run(p, mobile)
            if e: fails.append(f"{tag}: console errors {e}")
            print(f"{tag}: ok" if not e else f"{tag}: errors {e}")
        except Exception as ex:
            fails.append(f"{tag}: {ex}"); print(f"{tag}: FAIL {ex}")
print(json.dumps({"ok": not fails, "fails": fails}))
sys.exit(1 if fails else 0)
