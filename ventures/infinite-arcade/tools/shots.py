#!/usr/bin/env python3
"""Capture gameplay thumbnails (src/thumbs/<slug>.jpg 800x450, <slug>-og.jpg 1200x630, home-og.jpg).
Usage: tools/shots.py BASE_URL   (e.g. a local server serving public/ at /arcade/)
"""
import sys, io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = Path(__file__).resolve().parent.parent / "src" / "thumbs"; OUT.mkdir(parents=True, exist_ok=True)

def stage(page, slug):
    if slug == "stackfall":
        page.click(".dk-ov.on .dk-btn"); page.wait_for_timeout(200)
        offs = [0, 0, 9, 0, 0, 0, -12, 0, 0, 8, 0, 0, 0, -10, 0, 0, 0, 0, 14, 0, 0, 0]
        for o in offs:
            page.evaluate(f"window.__game.aim({o})"); page.evaluate("window.__game.drop()"); page.wait_for_timeout(120)
        page.wait_for_timeout(250)
    elif slug in ("polarity", "nova-merge"):
        page.evaluate("Kit.hide()"); page.wait_for_timeout(1800 if slug == "polarity" else 600)
    elif slug == "neon-siege":
        page.click(".dk-ov.on .dk-btn")
        page.evaluate("window.__game.player.hp = 99; window.__game.player.maxHp = 99; window.__game.player.orbit = 3; window.__game.player.multi = 3; window.__game.player.pulse = 1")
        page.evaluate("window.__game.warp(140)")
        page.keyboard.down("KeyD"); page.wait_for_timeout(2500); page.keyboard.up("KeyD")
        page.keyboard.down("KeyS"); page.wait_for_timeout(2500); page.keyboard.up("KeyS")
        page.wait_for_timeout(5000)
        page.evaluate("Kit.hide()")
        page.evaluate("window.__game.player.hp = 4; window.__game.player.maxHp = 5")
        page.wait_for_timeout(200)
    elif slug == "duality":
        page.click(".dk-ov.on .dk-btn"); page.wait_for_timeout(200)
        sol = page.evaluate("window.__game.solution"); cur = page.evaluate("window.__game.cells")
        empt = [i for i, v in enumerate(cur) if v < 0][:14]
        for i in empt: page.evaluate(f"window.__game.set({i}, {sol[i]})")
        page.wait_for_timeout(400)

with sync_playwright() as p:
    b = p.chromium.launch()
    for slug in ["stackfall", "polarity", "nova-merge", "neon-siege", "duality"]:
        ctx = b.new_context(viewport={"width": 960, "height": 540}, device_scale_factor=2)
        page = ctx.new_page()
        page.goto(BASE + slug + "/play/", wait_until="load"); page.wait_for_timeout(700)
        stage(page, slug)
        page.evaluate("document.querySelector('.dk-mute') && (document.querySelector('.dk-mute').style.display='none')")
        img = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        img.resize((800, 450), Image.LANCZOS).save(OUT / f"{slug}.jpg", quality=86, optimize=True, progressive=True)
        # og 1200x630: scale to width then center-crop height
        og = img.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652))
        og.save(OUT / f"{slug}-og.jpg", quality=86, optimize=True, progressive=True)
        ctx.close(); print("thumb", slug)
    b.close()

# home OG collage
W, H = 1200, 630
bg = Image.new("RGB", (W, H), (11, 10, 23)); d = ImageDraw.Draw(bg)
slugs = ["stackfall", "polarity", "nova-merge", "neon-siege", "duality"]
tw, th = 360, 203
pos = [(30, 200), (420, 200), (810, 200), (225, 415), (615, 415)]
for s, (x, y) in zip(slugs, pos):
    t = Image.open(OUT / f"{s}.jpg").resize((tw, th), Image.LANCZOS)
    m = Image.new("L", (tw, th), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, tw, th), 18, fill=255)
    bg.paste(t, (x, y), m)
def font(sz, bold=True):
    for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"]:
        if Path(f).exists(): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
d.text((40, 40), "Daycade", font=font(84), fill=(126, 249, 200))
d.text((44, 140), "A new game every day. Free, no sign-up.", font=font(34), fill=(243, 241, 255))
bg.save(OUT / "home-og.jpg", quality=86, optimize=True)
print("home og")
