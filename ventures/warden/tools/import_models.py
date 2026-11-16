#!/usr/bin/env python3
"""Import Don's GLB models into Warden: validate names, optimize a desktop and a phone version, update the manifest.

Source: GLBs downloaded from the Drive lore folder's 'models' subfolder into an inbox directory. The Drive download
itself is done by the nightly routine / agent with the Google Drive connector (it lists the folder, downloads new or
changed .glb files into the inbox and writes their Drive metadata to drive-index.json). This script needs no
credentials and runs on the box.

  python3 tools/import_models.py [--src /workspace/warden-models-inbox] [--index drive-index.json] [--dry-run] [--force]

Naming (docs/assets.md): type_name_variant_v#.glb, type in char|enemy|weapon|prop|bldg, lowercase a-z0-9, e.g.
  char_warden_base_v1.glb -> id char_warden        enemy_husk_base_v2.glb -> id enemy_husk
  enemy_husk_burnt_v1.glb -> id enemy_husk_burnt   prop_lamppost_iron_v3.glb -> id prop_lamppost_iron
('base' or 'default' variant maps to the plain id.) The highest v# per id wins.

Output: game/assets/models/<id>.glb (desktop) + <id>.lo.glb (phone), meshopt-compressed, WebP textures, and
game/assets/manifest.json entries {file, fileLow, type, version, source, triangles, trianglesLow, textures, clips, scale,
warnings}. Existing hand-edited fields (scale, offset, rotationY, placements, clips) are preserved.
Exit code 0 = ok (warnings allowed), 1 = a model failed.
"""
import argparse, hashlib, json, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools" / "three-bundle"
OUT = ROOT / "game" / "assets" / "models"
MANIFEST = ROOT / "game" / "assets" / "manifest.json"
NAME = re.compile(r"^(char|enemy|weapon|prop|bldg)_([a-z0-9]+)(?:_([a-z0-9]+))?_v(\d+)\.glb$")
# Surfaces for models that arrive without textures (ids from game/src/pbr.js PBR_SETS).
DEFAULT_PBR = {
    "char": {"pbr": "metal_plate", "tint": "#3a3c42", "rough": 0.7, "metal": 0.6},
    "enemy": {"pbr": "brown_leather", "tint": "#4a3a36", "rough": 0.85, "metal": 0.0},
    "weapon": {"pbr": "metal_plate", "tint": "#9aa0aa", "rough": 0.35, "metal": 1.0},
    "prop": {"pbr": "rusty_metal_02", "tint": "#8a7a70", "rough": 0.8, "metal": 0.4},
    "bldg": {"pbr": "dark_brick_wall", "tint": "#6a6a70", "rough": 0.9, "metal": 0.0},
}
# Budgets (docs/assets.md). tex = max texture edge; tris = warning threshold for the desktop file.
BUDGET = {
    "char":   {"tex": 2048, "texLow": 1024, "tris": 60000, "trisLow": 20000, "ratioLow": 0.4},
    "enemy":  {"tex": 2048, "texLow": 1024, "tris": 40000, "trisLow": 12000, "ratioLow": 0.4},
    "weapon": {"tex": 1024, "texLow": 512,  "tris": 12000, "trisLow": 4000,  "ratioLow": 0.5},
    "prop":   {"tex": 1024, "texLow": 512,  "tris": 8000,  "trisLow": 3000,  "ratioLow": 0.5},
    "bldg":   {"tex": 2048, "texLow": 1024, "tris": 80000, "trisLow": 25000, "ratioLow": 0.35},
}
HEIGHT = {"char": (1.5, 2.3), "enemy": (0.4, 6.0)}  # expected real-world heights in metres

def node(*args):
    r = subprocess.run(["node", *args], cwd=TOOLS, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return r.stdout

def gt(*args):
    r = subprocess.run([str(TOOLS / "node_modules" / ".bin" / "gltf-transform"), *args], cwd=TOOLS, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-2000:] or r.stdout.strip()[-2000:])
    return r.stdout

def inspect(p): return json.loads(node("inspect.mjs", str(p)))

def logical_id(t, name, variant):
    return f"{t}_{name}" if variant in (None, "base", "default") else f"{t}_{name}_{variant}"

def sha1(p): return hashlib.sha1(Path(p).read_bytes()).hexdigest()

def auto_clips(anims):
    sys.path.insert(0, str(ROOT / "tools"))
    pats = {  # mirror of game/src/assets.js CLIP_ALIASES (first match wins)
        "idle": [r"^idle", r"breath", r"stand"], "walk": [r"^walk", r"walking"], "run": [r"^run", r"running", r"sprint", r"jog"],
        "attack": [r"^attack$", r"slash", r"attack", r"swing", r"punch", r"strike"], "attack2": [r"attack ?2", r"slash ?2", r"combo"],
        "attack3": [r"attack ?3", r"slash ?3"], "heavy": [r"heavy", r"great ?sword ?slash", r"power"], "dodge": [r"dodge", r"roll", r"evade", r"jump"],
        "hit": [r"^hit", r"hit ?react", r"impact", r"hurt", r"damage"], "death": [r"death", r"dying", r"^die", r"defeat"]}
    out = {}
    for k, ps in pats.items():
        for p in ps:
            m = next((a for a in anims if re.search(p, a.split("|")[-1], re.I)), None)
            if m: out[k] = m; break
    return out

def optimize(src, dst, kind, low):
    b = BUDGET[kind]
    args = ["optimize", str(src), str(dst), "--compress", "meshopt", "--texture-compress", "webp",
            "--texture-size", str(b["texLow"] if low else b["tex"])]
    if kind in ("char", "enemy", "weapon"):  # keep the node/bone hierarchy and named parts the game looks up
        args += ["--flatten", "false", "--join", "false", "--instance", "false", "--palette", "false"]
    if low: args += ["--simplify", "true", "--simplify-ratio", str(b["ratioLow"]), "--simplify-error", "0.002"]
    else: args += ["--simplify", "false"]
    gt(*args)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="/workspace/warden-models-inbox")
    ap.add_argument("--index", default=None, help="drive-index.json written by the routine: [{name,id,modifiedTime,webViewLink}]")
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    src = Path(a.src)
    if not (TOOLS / "node_modules").exists(): sys.exit("run `npm ci` in tools/three-bundle first")
    man = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"version": 1, "assets": {}}
    index = {e["name"]: e for e in json.loads(Path(a.index).read_text())} if a.index and Path(a.index).exists() else {}
    files = sorted(src.glob("*.glb")) if src.exists() else []
    if not files: print(f"no .glb files in {src}: nothing to import"); return 0
    best, report, failed = {}, [], False
    for f in files:
        m = NAME.match(f.name)
        if not m: report.append({"file": f.name, "status": "skipped: name does not match type_name_variant_v#.glb"}); continue
        t, name, variant, ver = m.group(1), m.group(2), m.group(3), int(m.group(4))
        lid = logical_id(t, name, variant)
        if lid not in best or ver > best[lid][1]: best[lid] = (f, ver, t)
    OUT.mkdir(parents=True, exist_ok=True)
    for lid, (f, ver, t) in sorted(best.items()):
        prev = man["assets"].get(lid, {})
        h = sha1(f)
        if not a.force and prev.get("source", {}).get("sha1") == h:
            report.append({"id": lid, "file": f.name, "status": "unchanged"}); continue
        warn = []
        try:
            info = inspect(f)
            if a.dry_run: report.append({"id": lid, "file": f.name, "status": "would import", "triangles": info["triangles"]}); continue
            with tempfile.TemporaryDirectory() as td:
                hi, lo = Path(td) / "hi.glb", Path(td) / "lo.glb"
                optimize(f, hi, t, False); optimize(f, lo, t, True)
                ihi, ilo = inspect(hi), inspect(lo)
                shutil.copy(hi, OUT / f"{lid}.glb"); shutil.copy(lo, OUT / f"{lid}.lo.glb")
            b = BUDGET[t]
            if ihi["triangles"] > b["tris"]: warn.append(f"desktop triangles {ihi['triangles']} > budget {b['tris']}")
            if ilo["triangles"] > b["trisLow"]: warn.append(f"phone triangles {ilo['triangles']} > budget {b['trisLow']}")
            size = info["bbox"]["size"]; height = size[1]
            scale = prev.get("scale")
            if scale is None:
                scale = 1.0
                if t in HEIGHT and height > 0:
                    lo_h, hi_h = HEIGHT[t]
                    if not (lo_h <= height <= hi_h):
                        guess = 1.85 / height if t == "char" else (0.01 if height > 50 else 1.0)
                        warn.append(f"height {height:.2f} m outside {lo_h}-{hi_h} m; scale set to {guess:.4f} (export at real-world metres to avoid this)")
                        scale = round(guess, 5)
            if t in ("char", "enemy") and not info["skins"]: warn.append("no skin/armature: it will be placed but not animated")
            if t in ("char", "enemy") and info["skins"] and not info["animations"]: warn.append("rigged but no animation clips: export with Mixamo animations (idle, walk, run, attack, dodge, hit, death)")
            clips = {**auto_clips(info["animations"]), **prev.get("clips", {})}
            if t in ("char", "enemy") and info["animations"]:
                missing = [k for k in ("idle", "walk", "run", "attack", "dodge", "hit", "death") if k not in clips]
                if missing: warn.append("missing clips (fallbacks used): " + ", ".join(missing))
            materials = prev.get("materials")
            if materials is None and not ihi["textures"]:  # untextured (e.g. Meshy free plan): use Warden's CC0 PBR surfaces
                materials = [{"match": "*", **DEFAULT_PBR[t]}]
                warn.append(f"no textures: using PBR set {DEFAULT_PBR[t]['pbr']} (edit 'materials' in the manifest to change)")
            src_meta = {"name": f.name, "sha1": h, "imported": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
            if f.name in index: src_meta.update({k: index[f.name].get(k) for k in ("id", "modifiedTime", "webViewLink") if index[f.name].get(k)})
            entry = {**prev, "type": t, "version": ver, "file": f"models/{lid}.glb", "fileLow": f"models/{lid}.lo.glb", "scale": scale,
                     "source": src_meta, "triangles": ihi["triangles"], "trianglesLow": ilo["triangles"],
                     "textures": [f"{x['w']}x{x['h']}" for x in ihi["textures"]], "texturesLow": [f"{x['w']}x{x['h']}" for x in ilo["textures"]],
                     "bytes": (OUT / f"{lid}.glb").stat().st_size, "bytesLow": (OUT / f"{lid}.lo.glb").stat().st_size,
                     "animations": info["animations"], "clips": clips, "bones": info["bones"], "warnings": warn}
            if materials is not None: entry["materials"] = materials
            man["assets"][lid] = entry
            report.append({"id": lid, "file": f.name, "status": "imported", "triangles": ihi["triangles"], "trianglesLow": ilo["triangles"],
                           "kb": round(entry["bytes"] / 1024), "kbLow": round(entry["bytesLow"] / 1024), "warnings": warn})
        except Exception as e:
            failed = True; report.append({"id": lid, "file": f.name, "status": "FAILED", "error": str(e)[:500]})
    if not a.dry_run: MANIFEST.write_text(json.dumps(man, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
