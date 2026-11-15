#!/usr/bin/env python3
"""Build Ebbmarrow (the RPG) into public/ so it is the main experience at /arcade/.

  rpg/engine/*.js        engine, concatenated in filename order -> public/game/ebbmarrow.<hash>.js
  rpg/web/               index.html template + style.css
  rpg/data/core.json     tiles, items, enemies, arts, cast looks, music
  rpg/data/chapters/*.json  story parts (maps, dialogs, quests, patches), loaded in order
  rpg/data/changelog.json   in-game "What's new"

Content is validated first (dialog refs, items, enemies, maps, exits, tiles under
entities); any error aborts the build so a broken daily improvement never deploys.
Run AFTER tools/build.py (which rebuilds public/ and puts the arcade at extras/).
Usage: tools/build_rpg.py [--check]
"""
import hashlib, json, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RPG, OUT = ROOT / "rpg", ROOT / "public"


def load():
    core = json.loads((RPG / "data/core.json").read_text())
    chapters = [(p.name, json.loads(p.read_text())) for p in sorted((RPG / "data/chapters").glob("*.json"))]
    log = json.loads((RPG / "data/changelog.json").read_text())
    return core, chapters, log


def validate(core, chapters, log):
    errs = []
    D = {k: dict(core.get(k, {})) for k in ("items", "enemies", "skills", "music", "looks", "tiles")}
    maps, dialogs, quests, patches = {}, {}, {}, []
    nums = set()
    for name, ch in chapters:
        for k in D:
            D[k].update(ch.get(k, {}))
        for k, dst in (("maps", maps), ("dialogs", dialogs), ("quests", quests)):
            for key in ch.get(k, {}):
                if key in dst:
                    errs.append(f"{name}: duplicate {k[:-1]} '{key}'")
            dst.update(ch.get(k, {}))
        patches += ch.get("patches", [])
        for f in ("id", "number", "title"):
            if f not in ch:
                errs.append(f"{name}: missing '{f}'")
        if ch.get("number") in nums:
            errs.append(f"{name}: duplicate chapter number")
        nums.add(ch.get("number"))
    tiles = D["tiles"]

    def tile(m, x, y):
        rows = maps[m]["rows"]
        if y < 0 or y >= len(rows):
            return None
        r = rows[y]
        return r[x] if 0 <= x < len(r) else maps[m].get("fill", ".")

    def walkable(m, x, y):
        t = tile(m, x, y)
        return t is not None and t in tiles and not tiles[t].get("solid")

    def check_ref(ref, where):
        if ref is None:
            return
        if isinstance(ref, str):
            if ref not in dialogs:
                errs.append(f"{where}: unknown dialog '{ref}'")
        elif isinstance(ref, list):
            check_nodes(ref, where)

    def check_actions(acts, where):
        for a in acts:
            op, args = a[0], a[1:]
            if op in ("give", "take") and args[0] not in D["items"]:
                errs.append(f"{where}: unknown item '{args[0]}'")
            if op == "quest" and args[0] not in quests:
                errs.append(f"{where}: unknown quest '{args[0]}'")
            if op == "learn" and args[0] not in D["skills"]:
                errs.append(f"{where}: unknown skill '{args[0]}'")
            if op == "battle":
                for e in args[0]:
                    if e not in D["enemies"]:
                        errs.append(f"{where}: unknown enemy '{e}'")
            if op == "shop":
                for i in args[0]:
                    if i not in D["items"]:
                        errs.append(f"{where}: shop item '{i}'")
            if op == "music" and args[0] and args[0] not in D["music"]:
                errs.append(f"{where}: unknown music '{args[0]}'")
            if op == "warp" and args[0] not in maps:
                errs.append(f"{where}: unknown map '{args[0]}'")
            if op not in ("flag", "unflag", "give", "take", "shells", "quest", "heal", "battle", "warp", "sfx", "music", "shake", "wait", "flash", "fade",
                          "card", "toast", "learn", "equip", "save", "respawn", "chapterEnd", "shop", "face", "walk", "refresh"):
                errs.append(f"{where}: unknown action '{op}'")

    def check_nodes(nodes, where):
        for n in nodes:
            if isinstance(n, str):
                continue
            if "s" in n and n["s"] != "me" and n["s"] not in D["looks"]:
                errs.append(f"{where}: unknown speaker '{n['s']}'")
            for o in n.get("c", []):
                check_ref(o.get("go"), where)
                check_actions(o.get("do", []), where)
            check_ref(n.get("then"), where)
            check_ref(n.get("else"), where)
            check_ref(n.get("go"), where)
            check_actions(n.get("do", []), where)

    for k, nodes in dialogs.items():
        check_nodes(nodes, f"dialog {k}")
    for name, ch in chapters:
        check_ref(ch.get("start"), f"{name} start")
    for mid, m in maps.items():
        w = max(len(r) for r in m["rows"])
        for i, r in enumerate(m["rows"]):
            for c in r:
                if c not in tiles:
                    errs.append(f"map {mid} row {i}: unknown tile '{c}'")
            if len(r) != w:
                errs.append(f"map {mid} row {i}: width {len(r)} != {w} (will be padded)")
        if m.get("music") and m["music"] not in D["music"]:
            errs.append(f"map {mid}: unknown music")
        for e in m.get("entities", []) + [e for p in patches if p["map"] == mid for e in p.get("entities", [])]:
            where = f"map {mid} entity {e.get('id')}"
            t = e["type"]
            if t in ("npc", "enemy", "chest", "shrine", "sign") and not e.get("hidden") and not walkable(mid, e["x"], e["y"]):
                errs.append(f"{where}: sits on solid tile '{tile(mid, e['x'], e['y'])}' at {e['x']},{e['y']}")
            d = e.get("dialog")
            if isinstance(d, list) and d and isinstance(d[0], dict) and "d" in d[0]:
                for o in d:
                    check_ref(o["d"], where)
            else:
                check_ref(d, where)
            check_ref(e.get("after"), where)
            if t == "npc" and isinstance(e.get("look"), str) and e["look"] not in D["looks"]:
                errs.append(f"{where}: unknown look")
            if t == "enemy":
                for g in e["group"]:
                    if g not in D["enemies"]:
                        errs.append(f"{where}: unknown enemy '{g}'")
            if t == "chest" and e.get("item") and e["item"] not in D["items"]:
                errs.append(f"{where}: unknown item")
            if t == "exit":
                if e["to"] not in maps:
                    errs.append(f"{where}: exit to unknown map '{e['to']}'")
                elif not walkable(e["to"], e["tx"], e["ty"]):
                    errs.append(f"{where}: exit lands on solid tile in {e['to']} at {e['tx']},{e['ty']}")
    for q, d in quests.items():
        if not d.get("steps"):
            errs.append(f"quest {q}: no steps")
    p = core["player"]["start"]
    if p["map"] not in maps or not walkable(p["map"], p["x"], p["y"]):
        errs.append("player start is not walkable")
    for e in log:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", e.get("date", "")) or not e.get("items"):
            errs.append(f"changelog entry malformed: {e}")
    return errs


def build(check_only=False):
    core, chapters, log = load()
    errs = validate(core, chapters, log)
    hard = [e for e in errs if "will be padded" not in e]
    for e in errs:
        print(("ERROR " if e in hard else "warn  ") + e, file=sys.stderr)
    if hard:
        sys.exit(f"{len(hard)} content error(s); not building")
    if check_only:
        print("content ok")
        return
    js = "\n".join(f"/* ---- {p.name} ---- */\n" + p.read_text() for p in sorted((RPG / "engine").glob("*.js")))
    h = hashlib.sha1((js + json.dumps([c for _, c in chapters]) + json.dumps(core) + json.dumps(log)).encode()).hexdigest()[:10]
    js = js.replace("'__BUILD__'", f"'{h}'")
    OUT.mkdir(exist_ok=True)
    for d in ("game", "data"):
        if (OUT / d).exists():
            shutil.rmtree(OUT / d)
    (OUT / "game").mkdir()
    (OUT / "data/chapters").mkdir(parents=True)
    (OUT / "game" / f"ebbmarrow.{h}.js").write_text(js)
    css = (RPG / "web/style.css").read_text()
    (OUT / "game" / f"style.{h}.css").write_text(css)
    for f in ("icon.svg",):
        if (RPG / "web" / f).exists():
            shutil.copy(RPG / "web" / f, OUT / "game" / f)
    if (RPG / "web/og.jpg").exists():
        shutil.copy(RPG / "web/og.jpg", OUT / "game/og.jpg")
    (OUT / "data/core.json").write_text(json.dumps(core, separators=(",", ":")))
    metas = []
    for name, ch in chapters:
        (OUT / "data/chapters" / name).write_text(json.dumps(ch, separators=(",", ":")))
        metas.append({"id": ch["id"], "number": ch["number"], "title": ch["title"], "file": "chapters/" + name})
    (OUT / "data/changelog.json").write_text(json.dumps(sorted(log, key=lambda e: e["date"], reverse=True), separators=(",", ":")))
    (OUT / "data/manifest.json").write_text(json.dumps({"build": h, "core": "core.json", "changelog": "changelog.json", "chapters": metas}))
    html = (RPG / "web/index.html").read_text().replace("{{H}}", h)
    (OUT / "index.html").write_text(html)
    print(f"ebbmarrow built {h}: {len(chapters)} story parts, {len(log)} changelog entries -> {OUT}")


if __name__ == "__main__":
    build("--check" in sys.argv)
