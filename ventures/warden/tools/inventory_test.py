#!/usr/bin/env python3
"""Armory (inventory) test for Warden 0.6+.
Desktop 1600x900: a 0.5 (schema 2) save migrates to schema 3 (got/seen/fav on every item, nothing lost);
I opens the Armory; live 3D paper-doll renders (non-blank pixels); stat sheet matches the game's stat math;
hover shows compare with green/red deltas; slot + tier filters and all 4 sorts; click-again equips; Lock blocks
salvage and survives reload; salvage needs a confirm tap; bulk salvage of unlocked Base; Forge entry.
Mobile (iPhone 13, Pixel 7, iPhone SE landscape, real touch): GEAR button, tap selects (no hover), tap again
equips, filter chips, every control on screen, zero console errors.
Usage: python3 tools/inventory_test.py [URL] [OUTDIR]"""
import io, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
try:
    from PIL import Image, ImageStat
except ImportError:
    Image = None

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/warden-inv"); OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
READY = "window.__warden && window.__wardenItems && document.querySelector('#menu button')"

# A 0.5-era save (schema 2): items have no got/seen/fav.
V05 = """() => { const I = window.__wardenItems, strip = (it) => { delete it.got; delete it.seen; delete it.fav; for (const c of it.cores || []) strip(c); return it; };
  const eq = I.starterGear(); const blade = I.makeItem('blade', 2, 5); blade.upgrade = 2; eq.blade = blade;
  const bag = [I.makeItem('blade', 4, 7), I.makeItem('cuirass', 3, 6), I.makeItem('helm', 1, 4), I.makeItem('helm', 0, 2), I.makeItem('greaves', 0, 2),
    I.makeItem('mantle', 2, 5), I.makeItem('gauntlets', 0, 1), I.makeCore('arc', 1), I.makeCore('edge', 2), I.makeItem('blade', 0, 1), I.makeItem('greaves', 3, 6), I.makeItem('mantle', 4, 7)];
  for (const k in eq) strip(eq[k]); bag.forEach(strip);
  const s = { schema: 2, v: 2, name: 'Aldric Vane', level: 6, xp: 10, points: 1, perks: { keen_edge: 2 }, equip: eq, bag, scrap: 820, stims: 3, trait: 'inquest',
    flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: 1763300000000, kills: 60, pos: [10, -5], face: 1.2, camYaw: 1.2,
    hp: 150, playTime: 3600, saved: Date.now() - 60000, ground: [], area: 'Statute Plaza' };
  localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] }));
  return { bag: bag.map(x => x.uid), equip: Object.fromEntries(Object.entries(eq).map(([k, v]) => [k, v.uid])) }; }"""

def nonblank(pg, sel):
    if not Image: return True
    bb = pg.locator(sel).bounding_box()
    png = pg.screenshot(clip={"x": bb["x"] + 4, "y": bb["y"] + 4, "width": bb["width"] - 8, "height": bb["height"] - 30})
    st = ImageStat.Stat(Image.open(io.BytesIO(png)).convert("L"))
    return st.stddev[0] > 6

def start(pg, G):
    pg.goto(URL, wait_until="load"); pg.wait_for_function(READY, timeout=180000)
    pg.evaluate("localStorage.clear()"); ids = pg.evaluate(V05)
    pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=180000); pg.evaluate("window.__wardenNoDyn = true")
    return ids

def desktop(p):
    errors = []
    b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={"width": 1600, "height": 900}); pg.set_default_timeout(180000)
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    print("== desktop 1600x900")
    ids = start(pg, G)
    pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1)
    s = G("return { schema: g.save.schema, n: g.save.bag.length, all: [...Object.values(g.save.equip), ...g.save.bag].every(it => typeof it.got === 'number' && it.seen === true && it.fav === false), up: g.save.equip.blade.upgrade, bag: g.save.bag.map(x => x.uid) }")
    assert s["schema"] == 4 and s["n"] == 12 and s["all"] and s["up"] == 2 and s["bag"] == ids["bag"], s
    print("  OK 0.5 save migrated to schema 4: 12 items keep order, every item got got/seen/fav, Temper intact")
    G("g.allowUnlockedAttack = true; g.noLock = true; g.save.bag.push(window.__wardenItems.makeItem('helm', 3, 8, { noCores: true })); g.save.bag.push(window.__wardenItems.makeCore('ember', 3));")
    pg.keyboard.press("i"); time.sleep(2.5)
    assert G("return g.ui.screen") == "armory"
    assert pg.locator("#dollhost canvas").count() == 1, "no paper-doll canvas"
    assert nonblank(pg, "#dollhost"), "paper-doll render is blank"
    print("  OK I opens the Armory; live 3D paper-doll is rendering")
    pw = pg.inner_text(".power b"); dmg = pg.inner_text(".sheet .st:first-child b")
    want = G("return Math.round(window.__wardenItems.computeStats(g.save).dmgFinal)")
    assert int(dmg) == want, (dmg, want); print(f"  OK stat sheet matches game math (damage {dmg}), Power {pw}")
    assert pg.locator(".tile.new").count() == 2; print("  OK new pickups marked NEW")
    pg.screenshot(path=str(OUT / "desktop-01-overview.png"))
    # hover the Exalted blade -> compare
    sov = ids["bag"][0]
    pg.hover(f".tile[data-item='{sov}']"); time.sleep(0.5)
    assert pg.locator("#invdetail .cmp2").count() == 1 and pg.locator("#invdetail .dl.up").count() >= 1, "no compare deltas"
    print("  OK hover shows compare vs equipped:", pg.inner_text("#invdetail .cmp2").replace("\n", " | ")[:160])
    pg.screenshot(path=str(OUT / "desktop-02-compare.png"))
    weak = ids["bag"][9]  # Base blade -> red deltas
    pg.hover(f".tile[data-item='{weak}']"); time.sleep(0.4)
    assert pg.locator("#invdetail .dl.dn").count() >= 1; print("  OK weaker item shows red deltas")
    pg.mouse.move(800, 880); time.sleep(0.2)
    # filters
    pg.click(".chips [data-v=helm]"); time.sleep(0.4)
    n = pg.locator("#invgrid .tile").count(); assert n == G("return g.save.bag.filter(x => x.slot === 'helm').length") == 3, n
    pg.click(".rchips [data-v='3']"); time.sleep(0.4)
    exp = G("const I = window.__wardenItems; return g.save.bag.filter(x => x.slot === 'helm' && I.tierOf(x) === 3).length")
    assert exp >= 1 and pg.locator("#invgrid .tile").count() == exp
    pg.screenshot(path=str(OUT / "desktop-03-filter.png"))
    pg.click(".rchips [data-v='-1']"); pg.click(".chips [data-v=core]"); time.sleep(0.3)
    assert pg.locator("#invgrid .tile").count() == 3; pg.click(".chips [data-v=all]"); time.sleep(0.3)
    print("  OK slot + tier filters (helm=3, helm+Legendary=1, cores=3)")
    for srt in ["newest", "rarity", "power", "slot"]:
        pg.click(f".sorts [data-v={srt}]"); time.sleep(0.3)
        order = pg.evaluate("[...document.querySelectorAll('#invgrid .tile')].map(t => t.dataset.item)")
        exp = G(f"return g.ui.armory.list().map(x => x.uid)"); assert order == exp
        if srt == "rarity":
            rs = G("const I = window.__wardenItems; return g.ui.armory.list().map(x => I.tierOf(x))"); assert rs == sorted(rs, reverse=True), rs
        if srt == "newest": assert order[0] in G("return g.save.bag.slice(-2).map(x => x.uid)")
    print("  OK sorts: newest, rarity, power, slot")
    # double-click equip
    pg.click(f".tile[data-item='{sov}']"); time.sleep(0.3)
    pg.click(f".tile[data-item='{sov}']"); time.sleep(0.4)
    assert G("return g.save.equip.blade.uid") == sov, "click-again did not equip"; print("  OK click selects, click again equips (old blade back in pack)")
    # lock + salvage protection
    tgt = ids["bag"][3]
    pg.click(f".tile[data-item='{tgt}']"); time.sleep(0.3)
    pg.click("#invdetail [data-inv=lock]"); time.sleep(0.3)
    assert G(f"return g.save.bag.find(x => x.uid === '{tgt}').fav") is True
    assert pg.locator("#invdetail [data-inv=salvage]").is_disabled(); print("  OK Lock disables Salvage")
    other = ids["bag"][4]; scrap0 = G("return g.save.scrap")
    pg.click(f".tile[data-item='{other}']"); time.sleep(0.3)
    pg.click("#invdetail [data-inv=salvage]"); time.sleep(0.3)
    assert G(f"return !!g.save.bag.find(x => x.uid === '{other}')"), "salvaged without confirm"
    assert "confirm" in pg.inner_text("#invdetail [data-inv=salvage]").lower()
    pg.screenshot(path=str(OUT / "desktop-04-salvage-confirm.png"))
    pg.click("#invdetail [data-inv=salvage]"); time.sleep(0.3)
    assert not G(f"return !!g.save.bag.find(x => x.uid === '{other}')") and G("return g.save.scrap") > scrap0; print("  OK Salvage takes a confirm tap")
    # bulk salvage skips locked
    pg.click("[data-inv=bulk]"); time.sleep(0.2); pg.click("[data-inv=bulk]"); time.sleep(0.4)
    left = G("return g.save.bag.filter(x => x.kind === 'gear' && x.rarity === 0).map(x => x.uid)")
    assert left == [tgt], left; print("  OK bulk salvage of unlocked Base keeps the locked one")
    # forge entry: far away -> hint; near -> forge tab
    pg.click(".pfoot .forge-btn"); time.sleep(0.3)
    assert "Forge" in pg.inner_text("#toasts")
    G("g.ui.close(); g.player.pos.set(14.2,0,-7.2);"); time.sleep(0.8)
    pg.keyboard.press("i"); time.sleep(1.5); pg.click(".pfoot .forge-btn"); time.sleep(0.6)
    assert G("return g.ui.screen") == "forge"; print("  OK Forge entry: hint when away, opens the Forge when near")
    G("g.ui.close()"); time.sleep(0.3)
    # persistence of lock + equip
    pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=180000)
    pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(0.8)
    assert G(f"return g.save.bag.find(x => x.uid === '{tgt}').fav") is True and G("return g.save.equip.blade.uid") == sov
    print("  OK lock + equip survive reload")
    pg.keyboard.press("i"); time.sleep(0.8); pg.keyboard.press("i"); time.sleep(0.4)
    assert G("return g.ui.screen") is None; print("  OK I toggles the Armory closed")
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
    def tap(sel):
        pg.locator(sel).first.scroll_into_view_if_needed(); time.sleep(0.2)
        bb = onscreen(sel); x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        assert pg.evaluate("([x, y, s]) => { const e = document.elementFromPoint(x, y); return !!e && (e.matches(s) || !!e.closest(s)); }", [x, y, sel]), f"{sel} is covered at its centre"
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]}); time.sleep(0.05)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); time.sleep(0.45)
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    print(f"== {tag}: {devname} {vw}x{vh}")
    ids = start(pg, G); time.sleep(1.5)
    tap("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1.2)
    tap("#touch .tmenu [data-t=armory]"); time.sleep(2)
    assert G("return g.ui.screen") == "armory"
    for sel in [".power", "#dollhost", ".eslot[data-slot=helm]", ".eslot[data-slot=mantle]", ".chips [data-v=all]", ".tb .scycle", ".rchips [data-v='4']", ".pfoot .forge-btn", "[data-act=close]"]:
        onscreen(sel)
    assert nonblank(pg, "#dollhost"), "doll blank"
    pg.screenshot(path=str(OUT / f"{tag}-01-overview.png")); print("  OK GEAR opens Armory; doll, slots, filters, sorts, footer all on screen")
    sov = ids["bag"][0]
    tap(f".tile[data-item='{sov}']"); time.sleep(0.4)
    assert G("return g.ui.armory.sel") == sov and G("return g.save.equip.blade.uid") != sov, "first tap should only select"
    assert pg.locator("#invdetail .cmp2").count() == 1
    eq = pg.locator("#invdetail [data-inv=equip]"); eq.scroll_into_view_if_needed(); onscreen("#invdetail [data-inv=equip]")
    pg.screenshot(path=str(OUT / f"{tag}-02-compare.png")); print("  OK tap selects + shows compare (no hover needed), Equip button reachable")
    tap(f".tile[data-item='{sov}']"); time.sleep(0.4)
    assert G("return g.save.equip.blade.uid") == sov, "second tap did not equip"; print("  OK tap again equips")
    pg.locator(".chips [data-v=helm]").scroll_into_view_if_needed(); tap(".chips [data-v=helm]"); time.sleep(0.4)
    assert pg.locator("#invgrid .tile").count() == G("return g.save.bag.filter(x => x.slot === 'helm').length") == 2
    tap(".tb .scycle"); time.sleep(0.3); assert G("return g.ui.armory.pref.sort") == "rarity"
    pg.screenshot(path=str(OUT / f"{tag}-03-filter.png")); print("  OK filter chip + sort by touch")
    tap(".eslot[data-slot=cuirass]"); time.sleep(0.4)
    assert G("return g.ui.armory.pref.slot") == "cuirass" and pg.locator("#invdetail .eqb").count() == 1; print("  OK tapping a worn slot inspects it and filters the pack")
    tap("[data-act=close]"); time.sleep(0.4); assert G("return g.ui.screen") is None
    b.close(); return errors

def main():
    with sync_playwright() as p:
        errs = desktop(p)
        for dn, tag in [("iPhone 13 landscape", "iphone13"), ("Pixel 7 landscape", "pixel7"), ("iPhone SE landscape", "iphonese")]:
            errs += mobile(p, dn, tag)
    if errs: print("ERRORS:"); [print(" ", e) for e in errs]; sys.exit(1)
    print("inventory_test: ALL OK, zero console errors. Screenshots in", OUT)

if __name__ == "__main__":
    main()
