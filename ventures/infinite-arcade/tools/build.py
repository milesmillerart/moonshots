#!/usr/bin/env python3
"""Build the Daycade static site into ../public from src/.

- src/games.json         brand + game catalog (a game is live once `released` <= today)
- src/kit.js             shared runtime, copied into every game bundle
- src/games/<slug>/      game.js (+ optional body.html, style.css, extra files)
- src/thumbs/<slug>.jpg  card thumbnail (16:9), src/thumbs/<slug>-og.jpg (1200x630), home-og.jpg
- src/shell/             site.css, icon.svg

Usage: tools/build.py [--date YYYY-MM-DD] [--all]
Each game's play/ folder is self-contained with relative paths only, so it can be
zipped as-is for portal submission (see tools/package.sh).
"""
import argparse, datetime as dt, html, json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "public"
E = html.escape


def load():
    return json.loads((SRC / "games.json").read_text())


LOGO = (SRC / "shell" / "icon.svg").read_text().replace('<svg xmlns="http://www.w3.org/2000/svg" ', '<svg aria-hidden="true" ')


def head(title, desc, url, image, extra=""):
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{E(url)}">
<meta name="theme-color" content="#0b0a17">
<link rel="icon" href="{{R}}assets/icon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Daycade">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{E(url)}">
<meta property="og:image" content="{E(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{E(title)}">
<meta name="twitter:description" content="{E(desc)}">
<meta name="twitter:image" content="{E(image)}">
<link rel="stylesheet" href="{{R}}assets/site.css">
{extra}
<!-- HOOK: analytics / ad network loader goes here once approved (none loaded in v1) -->
</head>"""


def topbar(R):
    return f"""<body>
<header class="top"><div class="wrap">
<a class="logo" href="{R}">{LOGO}<span><b>Daycade</b></span></a>
<nav><a href="{R}#games">Games</a><a class="hide-sm" href="{R}duality/">Daily puzzle</a></nav>
</div></header>"""


def footer(brand):
    return f"""<footer><div class="wrap">
<span>© {dt.date.today().year} {E(brand['name'])}. Original games, made fresh. No sign-up, no tracking cookies.</span>
<span>Scores are saved only on your device.</span>
</div></footer>"""


def thumb(slug, kind=""):
    name = f"{slug}{kind}.jpg"
    return name if (SRC / "thumbs" / name).exists() else None


def card(g, R, today):
    t = thumb(g["slug"])
    img = f'<img src="{R}{g["slug"]}/thumb.jpg" alt="{E(g["title"])} gameplay" loading="lazy" width="800" height="450">' if t else \
        f'<div style="position:absolute;inset:0;background:linear-gradient(135deg,{g["accent"]},#16142b)"></div>'
    new = (today - dt.date.fromisoformat(g["released"])).days <= 2
    chip = '<span class="chip new">New</span>' if new else f'<span class="chip">{E(g["genre"])}</span>'
    if g.get("daily"):
        chip = '<span class="chip new">Daily</span>'
    return f"""<a class="card" href="{R}{g['slug']}/" data-slug="{g['slug']}"><div class="th">{img}{chip}</div>
<div class="bd"><h4>{E(g['title'])}</h4><p>{E(g['tagline'])}</p></div></a>"""


def build(today, include_all=False):
    data = load()
    brand, base = data["brand"], data["brand"]["base_url"]
    games = [g for g in data["games"] if include_all or dt.date.fromisoformat(g["released"]) <= today]
    games.sort(key=lambda g: g["released"], reverse=True)
    if not games:
        sys.exit("no released games")
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "assets").mkdir(parents=True)
    shutil.copy(SRC / "shell" / "site.css", OUT / "assets" / "site.css")
    shutil.copy(SRC / "shell" / "icon.svg", OUT / "assets" / "icon.svg")
    shutil.copy(SRC / "shell" / "hooks.js", OUT / "assets" / "hooks.js")
    if (SRC / "thumbs" / "home-og.jpg").exists():
        shutil.copy(SRC / "thumbs" / "home-og.jpg", OUT / "assets" / "og.jpg")

    newest = games[0]["released"]
    fresh = [g for g in games if g["released"] == newest]
    featured = fresh[today.toordinal() % len(fresh)]
    catalog = [{k: g[k] for k in ("slug", "title", "tagline", "genre", "released")} for g in games]

    # ---------- game bundles + pages ----------
    for g in games:
        s = g["slug"]
        gdir, pdir = OUT / s, OUT / s / "play"
        pdir.mkdir(parents=True)
        src = SRC / "games" / s
        for f in src.iterdir():
            if f.name not in ("body.html",) and f.is_file():
                shutil.copy(f, pdir / f.name)
        shutil.copy(SRC / "kit.js", pdir / "kit.js")
        body = (src / "body.html").read_text() if (src / "body.html").exists() else '<canvas id="c"></canvas>'
        css = '<link rel="stylesheet" href="style.css">' if (src / "style.css").exists() else ""
        (pdir / "index.html").write_text(f"""<!doctype html>
<html lang="en" data-game="{s}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>{E(g['title'])}</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0a17">
<!-- PORTAL HOOK: portal builds insert the CrazyGames or Poki SDK <script> here, before kit.js. Kit.sdk forwards events to it. -->
{css}
</head><body>
{body}
<script src="kit.js"></script>
<script src="game.js"></script>
</body></html>
""")
        for kind, name in (("", "thumb.jpg"), ("-og", "og.jpg")):
            if thumb(s, kind):
                shutil.copy(SRC / "thumbs" / f"{s}{kind}.jpg", gdir / name)

        R = "../"
        url = base + s + "/"
        img = base + s + "/og.jpg" if thumb(s, "-og") else base + "assets/og.jpg"
        title = f"{g['title']}: play free online | Daycade"
        ld = {"@context": "https://schema.org", "@type": "VideoGame", "name": g["title"], "url": url,
              "description": g["description"], "genre": g["genre"], "image": img, "playMode": "SinglePlayer",
              "applicationCategory": "Game", "operatingSystem": "Web browser", "gamePlatform": ["Web browser", "Mobile web"],
              "datePublished": g["released"], "isAccessibleForFree": True,
              "publisher": {"@type": "Organization", "name": brand["name"]},
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}
        extra = f'<script type="application/ld+json">{json.dumps(ld)}</script>'
        others = "\n".join(card(o, R, today) for o in games if o["slug"] != s)
        share_txt = f"{g['title']}: {g['tagline']}"
        q = lambda x: __import__("urllib.parse").parse.quote(x, safe="")
        page = head(title, g["description"], url, img, extra).replace("{R}", R) + topbar(R) + f"""
<main class="wrap gp">
<div class="stagebox {'port' if g['orientation'] == 'portrait' else 'land'}" id="stage">
<iframe src="play/" title="{E(g['title'])}" allow="autoplay; fullscreen; clipboard-write" allowfullscreen></iframe>
</div>
<div class="gbar">
<h1>{E(g['title'])}</h1>
<div class="share">
<button class="js-fs" type="button">⛶ Fullscreen</button>
<button class="js-share" type="button" data-title="{E(g['title'])}" data-text="{E(share_txt)}" data-url="{E(url)}">Share</button>
<button class="js-copy" type="button" data-url="{E(url)}">Copy link</button>
<a href="https://twitter.com/intent/tweet?text={q(share_txt)}&amp;url={q(url)}" target="_blank" rel="noopener">X</a>
<a href="https://www.facebook.com/sharer/sharer.php?u={q(url)}" target="_blank" rel="noopener">Facebook</a>
<a href="https://www.reddit.com/submit?url={q(url)}&amp;title={q(share_txt)}" target="_blank" rel="noopener">Reddit</a>
<a href="https://wa.me/?text={q(share_txt + ' ' + url)}" target="_blank" rel="noopener">WhatsApp</a>
</div>
</div>
<div class="ad-slot" data-slot="below-game" hidden></div>
<section class="about">
<div class="box"><h2>About {E(g['title'])}</h2><p>{E(g['description'])}</p>
<div class="tags">{''.join(f'<span>{E(t)}</span>' for t in [g['genre']] + g['tags'])}</div></div>
<div class="box"><h2>Controls</h2><p>{E(g['controls'])}</p><p>Works on phones, tablets and computers. Your best score is saved on this device.</p></div>
</section>
<h3 class="sec">More games</h3>
<div class="grid">{others}</div>
</main>
{footer(brand)}
<script src="../assets/hooks.js"></script>
</body></html>
"""
        (gdir / "index.html").write_text(page)

    # ---------- home ----------
    R = ""
    ft = thumb(featured["slug"])
    fimg = f'<img src="{featured["slug"]}/thumb.jpg" alt="{E(featured["title"])} gameplay" width="800" height="450">' if ft else \
        f'<div style="position:absolute;inset:0;background:linear-gradient(135deg,{featured["accent"]},#16142b)"></div>'
    grid = "\n".join(card(g, R, today) for g in games)
    upcoming = sorted((g for g in data["games"] if dt.date.fromisoformat(g["released"]) > today), key=lambda g: g["released"])
    soon = '<div class="card soon"><div><b>Next game drops at midnight</b>A brand-new original game lands every day.<div class="cd" id="cd">--:--:--</div></div></div>'
    home_ld = {"@context": "https://schema.org", "@type": "WebSite", "name": brand["name"], "url": base, "description": brand["description"]}
    home = head(f"{brand['name']}: {brand['tagline']} Free browser games", brand["description"], base, base + "assets/og.jpg",
                f'<script type="application/ld+json">{json.dumps(home_ld)}</script>').replace("{R}", R) + topbar(R) + f"""
<main class="wrap">
<section class="hero">
<h1>{E(brand['tagline'])}</h1>
<p>Original games you can play right away, on your phone or computer. No downloads, no sign-up.</p>
</section>
<span class="label"><i></i> New today</span>
<a class="feature" id="feature" href="{featured['slug']}/">
<div class="art">{fimg}</div>
<div class="info"><span class="label" style="color:var(--mute)">{E(featured['genre'])}</span>
<h2>{E(featured['title'])}</h2><p>{E(featured['tagline'])}</p><span class="btn">▶ Play now</span></div>
</a>
<div class="ad-slot" data-slot="home-top" hidden></div>
<h3 class="sec" id="games">All games</h3>
<div class="grid">{grid}
{soon}</div>
</main>
{footer(brand)}
<script>window.DAYCADE_CATALOG={json.dumps(catalog)};</script>
<script src="assets/hooks.js"></script>
</body></html>
"""
    (OUT / "index.html").write_text(home)

    # ---------- sitemap ----------
    urls = [(base, today.isoformat(), "daily", "1.0")] + [(base + g["slug"] + "/", g["released"], "weekly", "0.8") for g in games]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + \
        "".join(f"  <url><loc>{E(u)}</loc><lastmod>{m}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>\n" for u, m, c, p in urls) + "</urlset>\n"
    (OUT / "sitemap.xml").write_text(sm)
    (OUT / "release.json").write_text(json.dumps({"built": today.isoformat(), "featured": featured["slug"], "live": [g["slug"] for g in games], "queued": [g["slug"] for g in upcoming]}, indent=1))
    print(f"built {len(games)} games, featured={featured['slug']}, queued={len(upcoming)} -> {OUT}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=dt.date.today().isoformat())
    ap.add_argument("--all", action="store_true", help="include unreleased games (preview)")
    a = ap.parse_args()
    build(dt.date.fromisoformat(a.date), a.all)
