#!/usr/bin/env python3
"""Art check: fixed camera views of Warden plus side-by-sides against Don's Drive concept art, for the nightly routine
and for before/after graphics passes.
Usage: python3 tools/art_check.py [URL] [OUTDIR] [REFDIR] [--prefix=after] [--quality=high|medium|low] [--before=DIR] [--views=a,b]
Views (same camera every run, so nights can be compared):
  lantern-cover  portrait 765x1024, the Warden mid Lantern Street facing camera, Synthblade awakened (vs warden-cover-with-blade.jpg)
  warden-front   portrait close-up, awakened and dormant
  street-north / street-south  1600x900 street views (fog, lamps, wet cobbles)
  blade-awakened / blade-dormant  studio render of the in-game Synthblade (vs synthblade-concept-on/off.jpg)
Writes PREFIX-<view>.png, compare-*.png and art_check.json (colour stats and a histogram similarity vs each reference;
higher = closer palette). If --before=DIR holds an earlier run's PNGs, before|after|reference panels are made too.
Exit 1 on console errors."""
import base64, io, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
sys.path.insert(0, str(Path(__file__).parent))
from reference_compare import STUDIO, bloom, panel  # noqa: E402

pos = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
URL = (pos[0] if pos else "http://127.0.0.1:8765/").rstrip("/") + "/"
OUT = Path(pos[1] if len(pos) > 1 else "/workspace/warden-art"); OUT.mkdir(parents=True, exist_ok=True)
REF = Path(pos[2] if len(pos) > 2 else "/workspace/lore")
PRE = opt.get("prefix", "after"); QUAL = opt.get("quality"); BEFORE = Path(opt["before"]) if "before" in opt else None
errors = []
WZ = -18.0  # the Warden's spot on Lantern Street (x=0, z=WZ), facing south (+z) toward the camera

VIEWS = [  # name, viewport, camera pos, look at, blade awake
    ("lantern-cover", (765, 1024), (0.0, 1.3, WZ + 4.0), (0.0, 1.22, WZ), 1),
    ("warden-front", (765, 1024), (0.0, 1.35, WZ + 3.0), (0.0, 1.05, WZ), 1),
    ("warden-front-dormant", (765, 1024), (0.0, 1.35, WZ + 3.0), (0.0, 1.05, WZ), 0),
    ("street-north", (1600, 900), (1.6, 2.3, WZ + 7.0), (0.0, 1.6, WZ - 25.0), 1),
    ("street-south", (1600, 900), (-1.8, 2.0, WZ - 4.0), (0.5, 1.3, WZ + 30.0), 1),
]

def stats(im):
    im = im.convert("RGB").resize((256, round(256 * im.height / im.width)))
    s = ImageStat.Stat(im); r, g, b = s.mean
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    hist = im.convert("RGB").histogram(); n = im.width * im.height
    return {"mean": [round(r, 1), round(g, 1), round(b, 1)], "lum": round(lum, 1), "contrast": round(sum(s.stddev) / 3, 1)}, [h / n for h in hist]

def similarity(h1, h2):  # histogram intersection on 3x256 bins, 1 = identical palette
    return round(sum(min(a, b) for a, b in zip(h1, h2)) / 3, 3)

def main():
    shots = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        ctx = b.new_context(viewport={"width": 1600, "height": 900})
        pg = ctx.new_page(); pg.set_default_timeout(180000)
        pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        q = f"?quality={QUAL}" if QUAL else ""
        pg.goto(URL + q, wait_until="load")
        pg.wait_for_function("window.__warden && window.__wardenItems && document.querySelector('#menu button')", timeout=120000)
        pg.evaluate("""() => { const I = window.__wardenItems;
          const s = { schema: 4, v: 4, name: 'Kade', level: 3, xp: 0, points: 0, perks: {}, equip: I.starterGear(), bag: [], scrap: 0, stims: 3,
            trait: 'inquest', flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: Date.now(), kills: 0, pos: [0, %f], hp: 999, ground: [], playTime: 1, saved: Date.now() };
          localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] })); }""" % WZ)
        pg.reload(wait_until="load")
        pg.wait_for_function("window.__warden && document.querySelector('#menu button[data-act=continue]')", timeout=120000)
        pg.evaluate("window.__wardenNoDyn = true")
        pg.click("#menu button[data-act=continue]")
        pg.wait_for_function("window.__warden.game.state === 'play'", timeout=90000)
        for state, k in (("dormant", 0), ("awakened", 1)):
            if opt.get("views") and f"blade-{state}" not in opt["views"]: continue
            url = pg.evaluate(STUDIO, k)
            im = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
            if k: im = bloom(im)
            path = OUT / f"{PRE}-blade-{state}.png"; im.save(path); shots[f"blade-{state}"] = path; print("saved", path.name)
        E = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
        perf = None
        only = opt.get("views", "").split(",") if opt.get("views") else None
        for name, (vw, vh), cp, la, awake in VIEWS:
            if only and name not in only: continue
            pg.set_viewport_size({"width": vw, "height": vh})
            E(f"""for (const e of g.enemies) e.dispose(); g.enemies = []; g.combatOn = false; g.lockTarget = null;
                 const T = window.__warden.THREE, p = g.player; p.pos.set(0, 0, {WZ}); p.vel && p.vel.set(0, 0, 0); p.face = 0; g.camYaw = Math.PI;
                 p.restT = 30; p.forceAwake = {awake}; g.ui.hud.classList.add('hidden'); g.ui.isOpen && g.ui.close && g.ui.close();
                 g.cine = {{ pos: new T.Vector3({cp[0]}, {cp[1]}, {cp[2]}), look: new T.Vector3({la[0]}, {la[1]}, {la[2]}) }}; g._lastCine = null;""")
            time.sleep(3.5)
            path = OUT / f"{PRE}-{name}.png"; pg.screenshot(path=str(path)); shots[name] = path; print("saved", path.name)
            if name == "street-north" and pg.evaluate("!!(window.__warden.perf)"): perf = pg.evaluate("window.__warden.perf()")
        E("g.player.forceAwake = null; g.cine = null;")
        b.close()
    refs = {"lantern-cover": "warden-cover-with-blade.jpg", "warden-front": "warden-cover-with-blade.jpg",
            "blade-awakened": "synthblade-concept-on.jpg", "blade-dormant": "synthblade-concept-off.jpg"}
    summary = {"url": URL, "quality": QUAL or "default", "prefix": PRE, "time": time.strftime("%Y-%m-%d %H:%M %Z"), "perf": perf, "views": {}}
    for name, path in shots.items():
        st, h = stats(Image.open(path)); entry = {"file": path.name, **st}
        if name in refs and (REF / refs[name]).exists():
            rst, rh = stats(Image.open(REF / refs[name]))
            entry.update({"ref": refs[name], "refStats": rst, "paletteSimilarity": similarity(h, rh)})
            ims, labels = [Image.open(REF / refs[name]), Image.open(path)], [f"Drive: {refs[name]}", f"in game ({PRE})"]
            if BEFORE and (BEFORE / f"before-{name}.png").exists():
                bim = Image.open(BEFORE / f"before-{name}.png"); bst, bh = stats(bim)
                entry["before"] = {**bst, "paletteSimilarity": similarity(bh, rh)}
                ims.insert(1, bim); labels.insert(1, "before")
            panel(ims, labels, f"{name}: reference vs game", OUT / f"compare-{name}.png")
        elif BEFORE and (BEFORE / f"before-{name}.png").exists():
            panel([Image.open(BEFORE / f"before-{name}.png"), Image.open(path)], ["before", PRE], f"{name}: before / after", OUT / f"compare-{name}.png")
        summary["views"][name] = entry
    (OUT / "art_check.json").write_text(json.dumps(summary, indent=2) + "\n")
    for n, v in summary["views"].items():
        print(f"  {n:22s} lum {v['lum']:5.1f}  mean {v['mean']}" + (f"  palette~ref {v['paletteSimilarity']}" if "paletteSimilarity" in v else "")
              + (f" (before {v['before']['paletteSimilarity']})" if "before" in v else ""))
    print("console errors:", len(errors))
    for e in errors: print("  ", e)
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
