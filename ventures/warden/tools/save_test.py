#!/usr/bin/env python3
"""Save-system test for Warden (build 0.5+).
Desktop 1600x900: a 0.4-format save migrates into slot 1 without losing anything; progress made in play
(XP, level, perk, gear, Temper, Core, scrap, stims, flags, loot left on the ground, position, play time)
survives a reload; page-hide autosave; .bak recovery from a corrupted slot; export code -> wipe all
storage -> import round-trip; slot picker (new / overwrite / delete); pause-menu Save + Saved mark.
Mobile (iPhone 13 + Pixel 7 landscape, real touch events): slot picker, pause save box and export panel
fit the screen, Play from a slot by touch.
Usage: python3 tools/save_test.py [URL] [OUTDIR]"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/warden-save"); OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
READY = "window.__warden && window.__wardenItems && document.querySelector('#menu button')"

V04 = """() => { const I = window.__wardenItems;
  const blade = I.makeItem('blade', 3, 4); blade.upgrade = 3; blade.cores = [I.makeCore('ember', 2)];
  const eq = I.starterGear(); eq.blade = blade;
  const s = { v: 1, name: 'Aldric Vane', level: 4, xp: 37, points: 2, perks: { keen_edge: 2, plated: 1 }, equip: eq,
    bag: [I.makeItem('helm', 2, 4), I.makeCore('arc', 1)], scrap: 345, stims: 2, trait: 'measure',
    flags: { judged: true, waveA: true, waveB: true, starterCore: true, cache: true, tipRiposte: true },
    created: 1763300000000, kills: 21, pos: [-30, 0.5], hp: 77 };
  localStorage.setItem('warden.save.v1', JSON.stringify(s)); return s; }"""

def snap_js():
    return """(() => { const g = window.__warden.game, s = g.save; return JSON.parse(JSON.stringify({
      name: s.name, level: s.level, xp: s.xp, points: s.points, perks: s.perks, scrap: s.scrap, stims: s.stims, trait: s.trait,
      flags: s.flags, kills: s.kills, equip: s.equip, bag: s.bag, slot: g.slot,
      pos: [Math.round(g.player.pos.x * 10) / 10, Math.round(g.player.pos.z * 10) / 10],
      ground: g.loot.map(l => l.item.uid).sort(), playTime: s.playTime })) })()"""

def compare(a, b, keys, label):
    bad = [k for k in keys if a.get(k) != b.get(k)]
    assert not bad, f"{label}: mismatch in {bad}: " + "; ".join(f"{k}: {a.get(k)!r} != {b.get(k)!r}" for k in bad)
    print(f"  OK {label}: {', '.join(keys)} all restored")

CORE = ["name", "level", "xp", "points", "perks", "scrap", "stims", "trait", "flags", "kills", "equip", "bag"]

def desktop(p):
    errors = []
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={"width": 1600, "height": 900}, accept_downloads=True)
    pg = ctx.new_page(); pg.set_default_timeout(180000)
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    def load(clear=False):
        if clear:
            pg.evaluate("localStorage.clear()")
        pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=90000); pg.evaluate("window.__wardenNoDyn = true"); time.sleep(1.5)
    pg.goto(URL, wait_until="load"); pg.wait_for_function(READY, timeout=90000)
    print("== desktop 1600x900")
    # 1. v0.4 save migrates
    pg.evaluate("localStorage.clear()"); v04 = pg.evaluate(V04); load()
    keys = pg.evaluate("Object.keys(localStorage).sort()")
    assert "warden.slot.0" in keys and "warden.save.v1" in keys, keys
    sub = pg.inner_text("#menu button[data-act=continue]")
    assert "Aldric Vane" in sub and "Level 4" in sub, sub
    print("  OK v0.4 save migrated to slot 1 (legacy key kept as backup); Continue shows:", sub.replace("\n", " "))
    pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1)
    s = pg.evaluate(snap_js())
    compare(s, v04, CORE, "v0.4 migration")
    assert s["pos"] == [-30, 0.5], s["pos"]; print("  OK position restored", s["pos"])
    # 2. make progress
    G("g.allowUnlockedAttack = true; g.noLock = true; g.applySetting('scale', 0.5);")
    G("""const I = window.__wardenItems, P = window.__wardenPOI;
      g.gainXp(900); g.learnPerk('capacitor'); g.save.scrap += 500;
      const it = I.makeItem('cuirass', 4, 6); g.save.bag.push(it); g.equip(it.uid);
      g.upgrade(g.save.equip.blade.uid);
      const core = g.save.bag.find(x => x.kind === 'core'); if (core && g.save.equip.cuirass.sockets) g.socket(g.save.equip.cuirass.uid, core.uid);
      g.save.stims = 1; g.save.flags.waveC = true;
      g.dropAt(new window.__warden.THREE.Vector3(3, 0, -6), I.makeItem('gauntlets', 4, 6));
      g.player.pos.set(6, 0, -9); g.player.face = 1.1;""")
    time.sleep(1.2)
    # 3. pause menu manual save + saved indicator
    G("g.ui.open('pause')"); time.sleep(0.6)
    pg.click("[data-act=savenow]"); time.sleep(0.25)
    assert "saved" in pg.inner_text("[data-act=savenow]").lower(), "save button did not confirm"
    assert G("return document.getElementById('saved').classList.contains('on')"), "saved mark not shown"
    pg.screenshot(path=str(OUT / "desktop-03-pause-save.png")); print("  OK pause menu Save now -> 'Saved ✓' + HUD mark")
    G("g.ui.close()"); time.sleep(0.3)
    G("g.persist('pickup')"); time.sleep(0.15)
    pg.screenshot(path=str(OUT / "desktop-04-saved-indicator.png"))
    before = pg.evaluate(snap_js())
    assert before["level"] > 4 and before["perks"].get("capacitor") == 1 and before["equip"]["blade"]["upgrade"] == 4 and len(before["ground"]) >= 1, before
    # 4. reload without any manual save: page-hide/unload autosave catches the latest position
    G("g.player.pos.set(8, 0, -2); g.save.scrap += 1;")
    before = pg.evaluate(snap_js())
    load()
    pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1)
    after = pg.evaluate(snap_js())
    compare(after, before, CORE + ["pos", "ground"], "reload (progress + unload autosave + ground loot)")
    assert after["playTime"] >= before["playTime"] - 0.5 and before["playTime"] > 0, (before["playTime"], after["playTime"])
    print(f"  OK play time tracked: {before['playTime']:.1f}s")
    # 5. corrupted slot -> .bak recovery
    G("g.persist('manual')"); G("g.save.scrap += 7; g.persist('manual')")
    pg.evaluate("localStorage.setItem('warden.slot.0', '{broken json')"); load()
    rec = pg.evaluate("window.__wardenSave.readSlot(0)")
    assert rec and rec["name"] == "Aldric Vane", "bak recovery failed"
    print("  OK corrupted slot recovered from .bak (scrap", rec["scrap"], ")")
    pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(0.8)
    G("g.persist('manual')")
    full = pg.evaluate(snap_js())
    # 6. export -> wipe -> import
    G("g.ui.open('pause')"); time.sleep(0.4); pg.click("[data-act=export]"); time.sleep(0.5)
    code = pg.input_value("#expcode"); assert code.startswith("WARDEN-SAVE.2."), code[:30]
    pg.screenshot(path=str(OUT / "desktop-05-export.png"))
    with pg.expect_download() as dl: pg.click("[data-act=download]")
    path = OUT / dl.value.suggested_filename; dl.value.save_as(path)
    assert path.read_text().strip() == code; print(f"  OK export code ({len(code)} chars) + download file {path.name}")
    G("g.ui.close(); g.toTitle()"); time.sleep(0.3)
    pg.evaluate("localStorage.clear()"); load()
    assert not pg.query_selector("#menu button[data-act=continue]"), "storage not wiped"
    pg.click("#menu button[data-act=import]"); time.sleep(0.4)
    pg.fill("#impcode", code[:-6]); pg.click("[data-act=doimport]"); time.sleep(0.3)
    assert "damaged" in pg.inner_text(".xfer .err") or "incomplete" in pg.inner_text(".xfer .err"); print("  OK truncated code rejected:", pg.inner_text(".xfer .err"))
    pg.set_input_files("#impfile", str(path)); time.sleep(0.6)
    pg.click("[data-act=impslot][data-slot='1']"); time.sleep(0.2)
    pg.screenshot(path=str(OUT / "desktop-06-import.png"))
    pg.click("[data-act=doimport]"); time.sleep(0.6)
    assert pg.query_selector(".slotcard[data-slot='1'] [data-act=slot-play]"), "imported slot not shown"
    pg.click(".slotcard[data-slot='1'] [data-act=slot-play]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1)
    imp = pg.evaluate(snap_js())
    compare(imp, full, CORE + ["pos", "ground"], "export file -> wipe -> import")
    assert imp["slot"] == 1
    # paste-code path too
    G("g.toTitle()"); time.sleep(0.5)
    pg.click("#menu button[data-act=import]"); time.sleep(0.3); pg.fill("#impcode", code)
    pg.click("[data-act=impslot][data-slot='2']"); pg.click("[data-act=doimport]"); time.sleep(0.4)
    assert pg.evaluate("window.__wardenSave.readSlot(2).name") == "Aldric Vane"; print("  OK pasted code imports into slot 3")
    # overwrite needs a second tap
    pg.click("#menu button[data-act=back]"); time.sleep(0.2)
    pg.click("#menu button[data-act=import]"); time.sleep(0.3); pg.fill("#impcode", code)
    pg.click("[data-act=impslot][data-slot='2']"); pg.click("[data-act=doimport]"); time.sleep(0.2)
    assert "tap again" in pg.inner_text("[data-act=doimport]").lower(); G("g.ui.screen=null; g.ui.panel.classList.add('hidden')"); print("  OK import over a used slot asks for a second tap")
    # 7. slot picker: delete slot 3 (two taps), new Warden into it
    G("g.ui.showSlots('load')"); time.sleep(0.3)
    pg.click(".slotcard[data-slot='2'] [data-act=slot-del]"); time.sleep(0.2)
    assert pg.evaluate("!!window.__wardenSave.readSlot(2)"), "deleted on first tap"
    pg.click(".slotcard[data-slot='2'] [data-act=slot-del]"); time.sleep(0.3)
    assert not pg.evaluate("window.__wardenSave.readSlot(2)"); print("  OK delete takes two taps")
    pg.click("#menu button[data-act=back]"); time.sleep(0.2)
    pg.click("#menu button[data-act=new]"); time.sleep(0.3)
    pg.click(".slotcard[data-slot='2'] [data-act=slot-new]"); time.sleep(0.3)
    pg.fill("#wname", "Sera Quill"); pg.click("[data-act=oath]")
    pg.wait_for_selector("#dialogue:not(.hidden)", timeout=30000)
    for _ in range(14):
        if pg.query_selector("#dialogue .choices"): break
        G("g.debugAdvance && g.debugAdvance()"); time.sleep(0.4)
    pg.keyboard.press("1")
    for _ in range(10):
        time.sleep(0.5)
        if G("return g.state") == "play": break
        G("g.debugAdvance && g.debugAdvance()")
    assert G("return g.slot") == 2 and pg.evaluate("window.__wardenSave.readSlot(2).trait") == "dread"
    print("  OK new Warden in slot 3, verdict autosaved")
    G("g.gainXp(200)"); G("g.toTitle()"); time.sleep(0.8)
    pg.click("#menu button[data-act=slots]"); time.sleep(0.6)
    pg.screenshot(path=str(OUT / "desktop-02-slots.png"))
    pg.click("#menu button[data-act=back]"); time.sleep(0.5)
    pg.screenshot(path=str(OUT / "desktop-01-title.png"))
    assert "sera quill" in pg.inner_text("#menu button[data-act=continue]").lower(); print("  OK Continue picks the most recent Warden")
    b.close()
    return errors, code

def mobile(p, devname, tag, code):
    errors = []
    dev = dict(p.devices[devname]); dev.pop("default_browser_type", None)
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(**dev); pg = ctx.new_page(); pg.set_default_timeout(180000)
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    cdp = ctx.new_cdp_session(pg)
    def tap(sel):
        bb = pg.locator(sel).first.bounding_box(); assert bb, f"no box for {sel}"
        assert bb["x"] >= 0 and bb["y"] >= 0 and bb["x"] + bb["width"] <= vw + 1 and bb["y"] + bb["height"] <= vh + 1, f"{sel} off screen: {bb}"
        x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]}); time.sleep(0.05)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); time.sleep(0.4)
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
    vw, vh = dev["viewport"]["width"], dev["viewport"]["height"]
    print(f"== {tag}: {devname} {vw}x{vh}")
    pg.goto(URL, wait_until="load"); pg.wait_for_function(READY, timeout=90000)
    pg.evaluate("localStorage.clear()"); pg.evaluate(V04)
    pg.evaluate("c => { const s = window.__wardenSave.importCode(c); s.name = 'Sera Quill'; s.level = 2; s.playTime = 754; s.saved = Date.now() - 3*86400e3; window.__wardenSave.writeSlot(2, s); }", code)
    pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=90000); pg.evaluate("window.__wardenNoDyn = true"); time.sleep(2)
    pg.screenshot(path=str(OUT / f"{tag}-01-title.png"))
    tap("#menu button[data-act=slots]"); time.sleep(0.5)
    for sel in [".slotcard[data-slot='0'] [data-act=slot-del]", ".slotcard[data-slot='1'] [data-act=slot-import]", "#menu button[data-act=back]"]:
        bb = pg.locator(sel).bounding_box(); assert bb and bb["y"] + bb["height"] <= vh + 1 and bb["x"] + bb["width"] <= vw + 1, f"{sel} off screen {bb}"
    pg.screenshot(path=str(OUT / f"{tag}-02-slots.png")); print("  OK slot picker fits", vw, "x", vh)
    tap(".slotcard[data-slot='0'] [data-act=slot-play]")
    pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1.5)
    assert G("return g.save.name") == "Aldric Vane" and G("return g.slot") == 0
    tap("#touch .tmenu [data-t=pause]"); time.sleep(0.6)
    tap("[data-act=savenow]"); time.sleep(0.25)
    assert "saved" in pg.inner_text("[data-act=savenow]").lower()
    for sel in ["[data-act=title]", "[data-act=export]"]:
        bb = pg.locator(sel).bounding_box(); assert bb and bb["y"] + bb["height"] <= vh + 1, f"{sel} off screen {bb}"
    pg.screenshot(path=str(OUT / f"{tag}-03-pause-save.png")); print("  OK pause Save now by touch, all pause buttons on screen")
    tap("[data-act=export]"); time.sleep(0.5)
    for sel in ["[data-act=copy]", "[data-act=download]"]:
        bb = pg.locator(sel).bounding_box(); assert bb and bb["y"] + bb["height"] <= vh + 1, f"{sel} off screen {bb}"
    pg.screenshot(path=str(OUT / f"{tag}-05-export.png")); print("  OK export panel fits")
    tap("#panel [data-act=close].x"); time.sleep(0.4)
    tap("[data-act=resume]"); time.sleep(0.4)
    G("g.persist('forge')"); time.sleep(0.15)
    pg.screenshot(path=str(OUT / f"{tag}-04-saved-indicator.png"))
    G("g.toTitle()"); time.sleep(0.6)
    tap("#menu button[data-act=import]"); time.sleep(0.5)
    for sel in ["[data-act=doimport]", ".filepick"]:
        bb = pg.locator(sel).bounding_box(); assert bb and bb["y"] + bb["height"] <= vh + 1, f"{sel} off screen {bb}"
    pg.screenshot(path=str(OUT / f"{tag}-06-import.png")); print("  OK import panel fits")
    b.close()
    return errors

def main():
    with sync_playwright() as p:
        errs, code = desktop(p)
        for dn, tag in [("iPhone 13 landscape", "iphone13"), ("Pixel 7 landscape", "pixel7"), ("iPhone SE landscape", "iphonese")]:
            errs += mobile(p, dn, tag, code)
    if errs:
        print("ERRORS:"); [print(" ", e) for e in errs]; sys.exit(1)
    print("save_test: ALL OK, zero console errors. Screenshots in", OUT)

if __name__ == "__main__":
    main()
