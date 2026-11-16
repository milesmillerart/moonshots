#!/usr/bin/env python3
"""Build Warden: copy game/ -> public/ and stamp a content hash on every module import
so browsers pick up each daily improvement without stale caches. No node needed."""
import hashlib, json, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "game", ROOT / "public"

def main():
    h = hashlib.sha1()
    for p in sorted(SRC.rglob("*")):
        if p.is_file():
            h.update(p.relative_to(SRC).as_posix().encode()); h.update(p.read_bytes())
    build = h.hexdigest()[:10]
    json.loads((SRC / "data" / "changelog.json").read_text())  # validate
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT)
    imp = re.compile(r"""(from\s+['"]|import\s*\(\s*['"])(\./[\w\-/]+\.js)(['"])""")
    for js in (OUT / "src").rglob("*.js"):
        t = js.read_text()
        t = imp.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={build}{m.group(3)}", t)
        js.write_text(t)
    idx = OUT / "index.html"
    idx.write_text(idx.read_text().replace("{{BUILD}}", build))
    (OUT / "build.json").write_text(json.dumps({"build": build}))
    print(f"warden build {build} -> {OUT}")

if __name__ == "__main__":
    sys.exit(main())
