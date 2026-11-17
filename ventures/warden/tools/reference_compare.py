#!/usr/bin/env python3
"""Reference vs in-game comparisons for 0.8 (Don's Drive concept art).
Renders the in-game Synthblade (the same buildSword the Warden carries) in a neutral grey studio like the
concept sheets, Dormant and Awakened, and a front-on shot of the in-game Warden like the cover. Then builds
side-by-side PNGs with PIL: reference | studio render | in-game.
Usage: python3 tools/reference_compare.py [URL] [OUTDIR] [REFDIR]. REFDIR holds synthblade-concept-on/off.jpg and
warden-cover-with-blade.jpg (copies of the Drive images). Asserts zero console errors."""
import base64, io, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/warden-08"); OUT.mkdir(parents=True, exist_ok=True)
REF = Path(sys.argv[3] if len(sys.argv) > 3 else "/workspace/lore")
errors = []
W, H = 765, 1024

STUDIO = """async (k) => { const T = window.__warden.THREE, g = window.__warden.game;
  const M = await import('./src/models.js?v=' + window.__warden.build);
  const cv = document.createElement('canvas'); cv.width = %d; cv.height = %d;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const sc = new T.Scene(); sc.background = new T.Color(0x3c3c3c);
  // soft studio environment: grey room with two bright panels, so the dark steel reads like the concept sheet
  const env = new T.Scene(); const room = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x555555, side: T.BackSide })); env.add(room);
  for (const [x, y, z, s] of [[-3, 3, 4, 3], [4, 1, 2, 2], [0, 4.5, -2, 4]]) { const p = new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p); }
  const pm = new T.PMREMGenerator(r); sc.environment = pm.fromScene(env, 0.04).texture;
  const key = new T.DirectionalLight(0xffffff, 1.4); key.position.set(-2, 3, 4); sc.add(key);
  sc.add(new T.HemisphereLight(0x9aa0a8, 0x202020, 0.6));
  const sw = M.buildSword(); sc.add(sw); sw.rotation.set(0, Math.PI, Math.PI); sw.position.y = 1.32; // point down, channel on the right, like the concept sheet
  sw.userData.setAwake(k);
  const cam = new T.PerspectiveCamera(30, cv.width / cv.height, 0.05, 50); cam.position.set(0, 0.66, 3.75); cam.lookAt(0, 0.66, 0);
  for (let i = 0; i < 40; i++) sw.userData.tick(1 / 30, 3 + i / 30, 0.2, 0);
  if (k > 0.5) sw.userData.crackle(0.9); else sw.userData.arcs.geometry.setDrawRange(0, 0);
  r.render(sc, cam);
  const url = cv.toDataURL('image/png'); r.dispose(); return url; }""" % (W, H)

def bloom(im):
    """Cheap bloom for the studio render (the game itself runs a bloom pass): blur the bright pixels and add them."""
    hi = im.point(lambda v: max(0, v - 150) * 2)
    glow = hi.filter(ImageFilter.GaussianBlur(14))
    glow2 = hi.filter(ImageFilter.GaussianBlur(4))
    return ImageChops.add(ImageChops.add(im, glow), glow2)

def panel(images, labels, title, path):
    hgt = 900
    ims = [i.convert("RGB").resize((round(i.width * hgt / i.height), hgt)) for i in images]
    wid = sum(i.width for i in ims) + 20 * (len(ims) + 1)
    out = Image.new("RGB", (wid, hgt + 110), (18, 18, 20)); d = ImageDraw.Draw(out)
    try: f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22); ft = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    except Exception: f = ft = ImageFont.load_default()
    d.text((20, 14), title, fill=(235, 235, 235), font=ft)
    x = 20
    for im, lb in zip(ims, labels):
        out.paste(im, (x, 60)); d.text((x, 70 + hgt), lb, fill=(200, 200, 200), font=f); x += im.width + 20
    out.save(path); print("saved", path)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        ctx = b.new_context(viewport={"width": 1600, "height": 900})
        pg = ctx.new_page(); pg.set_default_timeout(180000)
        pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("window.__warden && window.__wardenItems && document.querySelector('#menu button')", timeout=180000)
        pg.evaluate("""() => { const I = window.__wardenItems;
          const s = { schema: 4, v: 4, name: 'Kade', level: 3, xp: 0, points: 0, perks: {}, equip: I.starterGear(), bag: [], scrap: 0, stims: 3,
            trait: 'inquest', flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: Date.now(), kills: 0, pos: [12, -4], hp: 999, ground: [], playTime: 1, saved: Date.now() };
          localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] })); }""")
        pg.reload(wait_until="load")
        pg.wait_for_function("window.__warden && document.querySelector('#menu button[data-act=continue]')", timeout=180000)
        pg.evaluate("window.__wardenNoDyn = true")
        pg.click("#menu button[data-act=continue]")
        pg.wait_for_function("window.__warden.game.state === 'play'", timeout=60000)
        studio = {}
        for state, k in (("dormant", 0), ("awakened", 1)):
            url = pg.evaluate(STUDIO, k)
            im = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
            if k: im = bloom(im)
            studio[state] = im; im.save(OUT / f"studio-synthblade-{state}.png"); print("saved studio", state)
        # in-game Warden, front-on like the cover (Awakened), and the same Dormant
        E = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
        E("for (const e of g.enemies) e.dispose(); g.enemies = []; g.player.pos.set(12, 0, -4); g.player.face = 0.5; g.camYaw = 0.5; g.player.restT = 30; g.ui.hud.classList.add('hidden');")
        ingame = {}
        for state, k in (("dormant", 0), ("awakened", 1)):
            E(f"g.player.forceAwake = {k}; g.player.restT = 30;"); time.sleep(2.5)
            E("""const T = window.__warden.THREE, p = g.player, f = p.face, fw = new T.Vector3(Math.sin(f), 0, Math.cos(f));
                 g.cine = { pos: p.pos.clone().addScaledVector(fw, 3.1).add(new T.Vector3(0, 1.25, 0)), look: p.pos.clone().add(new T.Vector3(0, 1.0, 0)) }; g._lastCine = null;""")
            time.sleep(3.0)
            path = OUT / f"ingame-warden-front-{state}.png"; pg.screenshot(path=str(path)); print("saved", path)
            ingame[state] = Image.open(path)
        E("g.player.forceAwake = null; g.cine = null;")
        b.close()
    crop = lambda im: im.crop((im.width // 2 - 380, 0, im.width // 2 + 380, im.height))
    on, off, cover = (Image.open(REF / n) for n in ("synthblade-concept-on.jpg", "synthblade-concept-off.jpg", "warden-cover-with-blade.jpg"))
    full = lambda s: Image.open(OUT / f"desktop-synthblade-{s}-full.png") if (OUT / f"desktop-synthblade-{s}-full.png").exists() else None
    for state, ref in (("awakened", on), ("dormant", off)):
        ims = [ref, studio[state]] + ([crop(full(state))] if full(state) else [])
        labels = [f"Drive concept: synthblade-concept-{'on' if state == 'awakened' else 'off'}.jpg", "0.8 in-game model, studio render", "0.8 in game (plaza, live lighting)"][:len(ims)]
        panel(ims, labels, f"Synthblade {state.capitalize()}: reference vs 0.8", OUT / f"compare-synthblade-{state}.png")
    panel([cover, crop(ingame["awakened"]), crop(ingame["dormant"])], ["Drive: warden-cover-with-blade.jpg", "0.8 in game, Awakened", "0.8 in game, Dormant"],
          "Warden armor, helm, cape: cover art vs 0.8", OUT / "compare-warden-cover.png")
    print("console errors:", len(errors))
    for e in errors: print("  ", e)
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
