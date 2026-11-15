#!/usr/bin/env python3
"""Zip each game's self-contained play/ bundle for portal upload (CrazyGames, Poki).
Usage: tools/package.py  -> dist/<slug>.zip  (index.html at zip root, relative paths only)
Does not upload anything; submission is done by a human from the portal account.
"""
import zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
pub, dist = ROOT / "public", ROOT / "dist"
dist.mkdir(exist_ok=True)
for play in sorted(pub.glob("*/play")):
    slug = play.parent.name
    out = dist / f"{slug}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        files = [f for f in play.rglob("*") if f.is_file()]
        for f in files:
            z.write(f, f.relative_to(play))
    size = sum(f.stat().st_size for f in files)
    print(f"{slug}: {len(files)} files, {size/1024:.1f} KB raw, zip {out.stat().st_size/1024:.1f} KB -> {out}")
