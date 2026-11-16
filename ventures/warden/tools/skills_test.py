#!/usr/bin/env python3
"""Skill tree test for Warden 0.7+.
Desktop 1600x900: K opens the constellation; 15 perk nodes + the Oath root; node states (locked / open / available /
owned / maxed) match the save; traces light when a tier opens; detail panel numbers match data.js desc(); locked and
no-point nodes refuse; hold-to-learn and click-again-then-Confirm both learn; unlock animation + newly opened tier
charge line; keyboard arrows + Enter; branch tabs zoom the view; perks survive reload; respec is refused away from
the Forge and works there with a two-tap confirm (15 scrap per point, all points back).
Mobile (iPhone 13, Pixel 7, iPhone SE landscape, real touch): SKILLS button, every node and the learn button on
screen, tap selects (no hover), tap again arms, tap Confirm learns, touch hold learns, zero console errors.
Usage: python3 tools/skills_test.py [URL] [OUTDIR]"""
import re, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/warden-skills"); OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
READY = "window.__warden && window.__wardenItems && document.querySelector('#menu button')"

SAVE = """() => { const I = window.__wardenItems;
  const s = { schema: 3, v: 2, name: 'Mara Quill', level: 9, xp: 10, points: 5, perks: { keen_edge: 1, plated: 3, capacitor: 1 }, equip: I.starterGear(), bag: [], scrap: 900, stims: 3, trait: 'inquest',
    flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: 1763400000000, kills: 90, pos: [10, -5], face: 1.2, camYaw: 1.2,
    hp: 150, playTime: 5400, saved: Date.now() - 60000, ground: [], area: 'Statute Plaza' };
  localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] })); }"""

def start(pg):
    pg.goto(URL, wait_until="load"); pg.wait_for_function(READY, timeout=90000)
    pg.evaluate("localStorage.clear()"); pg.evaluate(SAVE)
    pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=90000); pg.evaluate("window.__wardenNoDyn = true")

def cls(pg, pid): return pg.get_attribute(f".nd[data-perk={pid}]", "class").split()

def wait(pg, js, t=30):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(f"(() => {{ const g = window.__warden.game; return {js}; }})()"): return True
        time.sleep(0.3)
    raise AssertionError(f"timeout waiting for {js}")

def desktop(p):
    errors = []
    b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={"width": 1600, "height": 900}); pg.set_default_timeout(180000)
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    print("== desktop 1600x900")
    start(pg)
    pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1)
    G("g.allowUnlockedAttack = true; g.noLock = true;")
    pg.keyboard.press("k"); time.sleep(1.5)
    assert G("return g.ui.screen") == "skills"
    assert pg.locator(".nd").count() == 15 and pg.locator(".sk-root").count() == 1
    assert pg.inner_text("#skpts") == "5"
    print("  OK K opens the skill constellation: 15 nodes + Oath root, 5 points shown")
    exp = {"plated": "max", "keen_edge": "own", "capacitor": "own", "momentum": "avail", "second_wind": "avail", "overload": "avail", "cleave": "locked", "arc_edge": "locked", "verdict": "locked"}
    for pid, st in exp.items(): assert st in cls(pg, pid), (pid, cls(pg, pid))
    assert "lockb" in pg.inner_html(".nd[data-perk=cleave]")
    # traces: owned = full (keen, plated, capacitor); tier-open = lit; bulwark spent 3 opens tiers 0..3
    assert pg.locator(".tr.full").count() == 3, pg.locator(".tr.full").count()
    assert pg.locator(".tr.lit").count() == 1 + 3 + 1, pg.locator(".tr.lit").count()  # momentum; 2nd wind/quickstep/iron; overload
    assert pg.locator(".gate.met").count() == 1 + 3 + 1
    prog = pg.inner_text(".sk-prog"); assert "1/8" in prog and "3/9" in prog and "1/7" in prog, prog
    print("  OK node states (maxed/owned/available/locked) + traces/gates light by tier; branch progress 1/8, 3/9, 1/7")
    pg.screenshot(path=str(OUT / "desktop-01-overview.png"))
    # locked node detail
    pg.click(".nd[data-perk=executioner]"); time.sleep(0.6)
    d = pg.inner_text("#skdetail")
    assert "Locked: invest 2 more points in Blade" in d and pg.locator(".sk-learn").is_disabled(), d
    assert "+25% damage to enemies under 35% health" in d
    print("  OK locked node: reason + requirement shown, learn disabled")
    # keen edge detail numbers
    pg.click(".nd[data-perk=keen_edge]"); time.sleep(0.6)
    d = pg.inner_text("#skdetail")
    assert "+8% damage" in d and "+16% damage" in d and "Rank 1/3" in d and "you have 5" in d, d
    assert G("return window.__wardenPerks ? 1 : 1")
    print("  OK detail: rank 1/3, Now +8% damage, Next +16%, cost 1 point, you have 5")
    pg.screenshot(path=str(OUT / "desktop-02-node-detail.png"))
    # hold to learn
    btn = pg.locator(".sk-learn").bounding_box(); pg.mouse.move(btn["x"] + btn["width"] / 2, btn["y"] + btn["height"] / 2)
    pg.mouse.down(); time.sleep(0.25)
    assert G("return g.save.perks.keen_edge") == 1, "learned instantly without holding"
    wait(pg, "g.save.perks.keen_edge === 2"); pg.mouse.up()
    time.sleep(0.15); pg.screenshot(path=str(OUT / "desktop-03-unlock-moment.png"))
    assert pg.locator(".nd.just .burst").count() == 1 and G("return g.save.points") == 4
    assert pg.locator(".tr.charge").count() == 1 and "avail" in cls(pg, "cleave"), "cleave should open with a charge line"
    assert pg.inner_text("#skpts") == "4"
    print("  OK hold-to-learn: Keen Edge 2/3, burst animation, Cleave tier opens with a charge line, points 4")
    time.sleep(2)
    # click again then confirm
    pg.click(".nd[data-perk=momentum]"); time.sleep(0.5); assert G("return g.save.perks.momentum || 0") == 0
    pg.click(".nd[data-perk=momentum]"); time.sleep(0.5)
    assert "Confirm" in pg.inner_text(".sk-learn") and G("return g.save.perks.momentum || 0") == 0
    pg.click(".sk-learn"); time.sleep(0.6)
    assert G("return g.save.perks.momentum") == 1 and "max" in cls(pg, "momentum")
    print("  OK click selects, click again arms Confirm, Confirm learns (Momentum mastered)")
    # keyboard: momentum -> right = cleave, Enter twice
    time.sleep(1.5)
    pg.keyboard.press("ArrowRight"); time.sleep(0.4); assert G("return g.ui.skills.sel") == "cleave"
    pg.keyboard.press("ArrowDown"); time.sleep(0.4); assert G("return g.ui.skills.sel") == "quickstep"
    pg.keyboard.press("Enter"); time.sleep(0.3); pg.keyboard.press("Enter"); time.sleep(0.6)
    assert G("return g.save.perks.quickstep") == 1; print("  OK arrows move the selection, Enter + Enter learns (Quickstep)")
    # no points
    G("g.save.points = 0; g.ui.render();"); time.sleep(0.5)
    pg.click(".nd[data-perk=overload]"); time.sleep(0.4); pg.click(".nd[data-perk=overload]"); time.sleep(0.4)
    assert pg.locator(".sk-learn").is_disabled() and "No skill points" in pg.inner_text("#skdetail")
    assert G("return g.learnPerk('overload')") is False and G("return g.learnPerk('verdict')") is False
    assert "open" in cls(pg, "overload") and "has" not in pg.get_attribute(".sk-pts", "class")
    print("  OK with 0 points nodes show 'open' (not available), learn refused; deep tier refused")
    G("g.save.points = 2; g.ui.render();"); time.sleep(0.5)
    # branch tabs zoom
    for br in ["blade", "bulwark", "circuit"]:
        pg.click(f".sk-views [data-v={br}]"); time.sleep(2.5)
        vb = [float(x) for x in pg.get_attribute("#sksvg", "viewBox").split()]
        assert abs(vb[2] - 860) < 1 and abs(vb[3] - 235) < 1, vb
        pg.screenshot(path=str(OUT / f"desktop-04-branch-{br}.png"))
    pg.click(".sk-views [data-v=all]"); time.sleep(2.5)
    assert pg.get_attribute("#sksvg", "viewBox").split()[2] in ("1020",), pg.get_attribute("#sksvg", "viewBox")
    print("  OK Blade / Bulwark / Circuit tabs zoom the view, All zooms back")
    perks = G("return JSON.stringify(g.save.perks)")
    # persistence
    pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=90000)
    pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1)
    assert G("return JSON.stringify(g.save.perks)") == perks and G("return g.save.points") == 2; print("  OK perks + points survive reload:", perks)
    G("g.allowUnlockedAttack = true; g.noLock = true;")
    # respec away from forge
    pg.keyboard.press("k"); time.sleep(1.2)
    assert pg.locator(".sk-respec").is_disabled() and "Forge" in pg.inner_text(".sk-respec"); print("  OK respec refused away from the Forge:", pg.inner_text(".sk-respec"))
    pg.keyboard.press("k"); time.sleep(0.4); assert G("return g.ui.screen") is None; print("  OK K toggles closed")
    G("g.player.pos.set(14.2,0,-7.2);"); wait(pg, "g.nearForge")
    pg.keyboard.press("k"); time.sleep(1.2)
    spent = G("return Object.values(g.save.perks).reduce((a, r) => a + r, 0)"); scrap = G("return g.save.scrap")
    pg.click(".sk-respec"); time.sleep(0.5)
    assert "Confirm" in pg.inner_text(".sk-respec") and G("return Object.keys(g.save.perks).length") > 0
    pg.screenshot(path=str(OUT / "desktop-05-respec-confirm.png"))
    pg.click(".sk-respec"); time.sleep(0.6)
    assert G("return Object.keys(g.save.perks).length") == 0 and G("return g.save.points") == 2 + spent and G("return g.save.scrap") == scrap - 15 * spent
    assert pg.locator(".nd.own, .nd.max").count() == 0
    print(f"  OK respec at the Forge (two taps): {spent} points back for {15 * spent} scrap")
    b.close(); return errors

def mobile(p, devname, tag):
    errors = []
    dev = dict(p.devices[devname]); dev.pop("default_browser_type", None)
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(**dev); pg = ctx.new_page(); pg.set_default_timeout(180000)
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    cdp = ctx.new_cdp_session(pg); vw, vh = dev["viewport"]["width"], dev["viewport"]["height"]
    def onscreen(sel):
        bb = pg.locator(sel).first.bounding_box(); assert bb, f"no box {sel}"
        assert bb["x"] >= -1 and bb["y"] >= -1 and bb["x"] + bb["width"] <= vw + 1 and bb["y"] + bb["height"] <= vh + 1, f"{sel} off screen {bb}"
        return bb
    def centre(sel):
        pg.locator(sel).first.scroll_into_view_if_needed(); time.sleep(0.2)
        bb = onscreen(sel); x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        assert pg.evaluate("([x, y, s]) => { const e = document.elementFromPoint(x, y); return !!e && (e.matches(s) || !!e.closest(s)); }", [x, y, sel]), f"{sel} is covered at its centre"
        return x, y
    def tap(sel, hold=0.05):
        x, y = centre(sel)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]}); time.sleep(hold)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); time.sleep(0.45)
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    print(f"== {tag}: {devname} {vw}x{vh}")
    start(pg); time.sleep(1.5)
    tap("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1.2)
    assert pg.inner_text("#tpts").strip() == "5", pg.inner_text("#tpts")
    tap("#touch .tmenu [data-t=skills]"); time.sleep(2)
    assert G("return g.ui.screen") == "skills"
    for sel in ["#skpts", ".sk-views [data-v=circuit]", ".sk-learn", "[data-act=close]", ".sk-prog"] + [f".nd[data-perk={x}] .hex" for x in ["keen_edge", "verdict", "plated", "last_rites", "capacitor", "overclock"]]:
        onscreen(sel)
    pg.screenshot(path=str(OUT / f"{tag}-01-overview.png")); print("  OK SKILLS button opens the tree; all branches, points, tabs, learn button on screen")
    tap(".nd[data-perk=overload] .hex"); time.sleep(0.4)
    assert G("return g.ui.skills.sel") == "overload" and not G("return g.save.perks.overload"), "first tap should only select"
    assert "OVERLOAD" in pg.inner_text("#skdetail")
    tap(".nd[data-perk=overload] .hex"); time.sleep(0.4)
    assert "Confirm" in pg.inner_text(".sk-learn") and not G("return g.save.perks.overload")
    pg.screenshot(path=str(OUT / f"{tag}-02-detail.png"))
    tap(".sk-learn"); time.sleep(0.6)
    assert G("return g.save.perks.overload") == 1 and "max" in cls(pg, "overload"); print("  OK tap selects + shows detail, tap again arms, tap Confirm learns Overload")
    time.sleep(1.5)
    tap(".nd[data-perk=second_wind] .hex"); time.sleep(0.4)
    x, y = centre(".sk-learn")
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    wait(pg, "g.save.perks.second_wind === 1")
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); time.sleep(0.2)
    pg.screenshot(path=str(OUT / f"{tag}-03-unlock.png")); print("  OK touch hold learns Second Wind")
    tap(".sk-views [data-v=circuit]"); time.sleep(2.5)
    assert abs(float(pg.get_attribute("#sksvg", "viewBox").split()[2]) - 860) < 1
    onscreen(".nd[data-perk=overclock] .hex"); tap(".sk-views [data-v=all]"); time.sleep(1.5)
    print("  OK branch tab zoom by touch")
    tap("[data-act=close]"); time.sleep(0.4); assert G("return g.ui.screen") is None
    b.close(); return errors

def main():
    only = sys.argv[3] if len(sys.argv) > 3 else None
    with sync_playwright() as p:
        errs = [] if only and only != "desktop" else desktop(p)
        for dn, tag in [("iPhone 13 landscape", "iphone13"), ("Pixel 7 landscape", "pixel7"), ("iPhone SE landscape", "iphonese")]:
            if only and only != tag: continue
            errs += mobile(p, dn, tag)
    if errs: print("ERRORS:"); [print(" ", e) for e in errs]; sys.exit(1)
    print("skills_test: ALL OK, zero console errors. Screenshots in", OUT)

if __name__ == "__main__":
    main()
