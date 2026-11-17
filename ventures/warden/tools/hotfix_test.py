#!/usr/bin/env python3
"""Hotfix 0.10.1.1: stamina regenerates while walking (not sprinting), and
dialogue pauses enemies so they cannot damage the player until it closes.
Usage: python3 tools/hotfix_test.py [URL] [OUTDIR]"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/warden-010"); OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
READY = "window.__warden && window.__wardenItems && document.querySelector('#menu button')"

def main():
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={"width": 1280, "height": 720}); pg.set_default_timeout(180000)
        pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
        pg.goto(URL, wait_until="load"); pg.wait_for_function(READY, timeout=180000)
        pg.evaluate("localStorage.clear()"); pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=180000)
        pg.evaluate("window.__wardenNoDyn = true")
        G("g.debugSkipOpening('Kade', 'inquest'); g.allowUnlockedAttack = true; g.noLock = true;")
        pg.wait_for_function("window.__warden.game.state === 'play'", timeout=180000); time.sleep(0.6)

        sta = G("""
          const p = g.player;
          const sample = (inp, dt, delay, sta) => {
            p.state = 'move'; p.staDelay = delay; p.sta = sta; p.vel.set(0,0,0);
            p.update(dt, inp, 0);
            return { sta: p.sta, delay: p.staDelay };
          };
          const walk = sample({ f: true }, 0.5, 0, 40);
          const idle = sample({}, 0.5, 0, 40);
          const run = sample({ f: true, sprint: true }, 0.5, 0, 40);
          const held = sample({ f: true, sprint: true }, 0.5, 0, 4); // shift held, too tired to sprint
          const wait = sample({ f: true }, 0.2, 1, 40);
          return { walk, idle, run, held, wait };
        """)
        assert sta["walk"]["sta"] > 40, sta["walk"]
        assert sta["idle"]["sta"] > 40, sta["idle"]
        assert sta["run"]["sta"] < 40, sta["run"]
        assert sta["held"]["sta"] > 4, sta["held"]
        assert sta["wait"]["sta"] == 40 and sta["wait"]["delay"] < 1, sta["wait"]
        print("  OK stamina refills while idle or walking, drains only while sprinting, post-spend delay held")

        dlg = G("""
          const T = window.__warden.THREE, Enemy = window.__wardenEnemy;
          for (const e of g.enemies) e.dispose(); g.enemies = []; g.lockTarget = null; g.boss = null;
          g.player.pos.set(0, 0, 0); g.player.state = 'move'; g.player.hp = g.stats.hp; g.player.iframes = 0; g.player.vel.set(0,0,0);
          const e = new Enemy(g, 'husk', new T.Vector3(1.4, 0, 1.4), 1); e.aggro = true; g.enemies.push(e);
          const hp0 = g.player.hp, e0 = e.pos.clone();
          g.ui.say([{ who: '', text: 'Hold.' }]);
          const open = !!g.dialogueOpen;
          for (let i = 0; i < 40; i++) g.update(0.05);
          const mid = { hp: g.player.hp, moved: e.pos.distanceTo(e0), stillOpen: !!g.dialogueOpen, hit: g.player.takeHit(80, e.pos, 0) };
          g.debugAdvance();
          const closed = !g.dialogueOpen;
          for (let i = 0; i < 40; i++) g.update(0.05);
          return { open, mid, closed, resumed: e.pos.distanceTo(e0) > 0.05 || e.state !== 'idle', hp0 };
        """)
        assert dlg["open"] and dlg["mid"]["stillOpen"] and dlg["closed"], dlg
        assert dlg["mid"]["hp"] == dlg["hp0"] and dlg["mid"]["moved"] < 0.01 and dlg["mid"]["hit"] is False, dlg
        assert dlg["resumed"], dlg
        print("  OK dialogue pauses enemies and blocks damage; they resume after it closes")

        # Bellwright intro path: spawn the wave the same way the Grave Gate does
        boss = G("""
          const T = window.__warden.THREE;
          for (const e of g.enemies) e.dispose(); g.enemies = []; g.boss = null; g.wave = null;
          g.player.pos.set(0, 0, -60); g.player.state = 'move'; g.player.hp = g.stats.hp; g.player.iframes = 0;
          g.save.flags.waveC = true; g.save.flags.boss = false;
          g.spawnWave('BOSS');
          g.ui.say([{ who: '', text: 'They say it was a bell-ringer once. Now it is the bell.' }]);
          const hp0 = g.player.hp;
          const before = g.enemies.map(e => ({ type: e.type, aggro: e.aggro, pos: e.pos.clone() }));
          for (let i = 0; i < 40; i++) g.update(0.05);
          const during = { hp: g.player.hp, open: !!g.dialogueOpen, moved: g.enemies.some((e, i) => e.pos.distanceTo(before[i].pos) > 0.01) };
          g.debugAdvance();
          for (let i = 0; i < 20; i++) g.update(0.05);
          return { spawned: g.enemies.length, types: g.enemies.map(e => e.type), during, closed: !g.dialogueOpen, hp0 };
        """)
        assert 'bellwright' in boss["types"] and boss["spawned"] >= 3, boss
        assert boss["during"]["open"] and boss["during"]["hp"] == boss["hp0"] and boss["during"]["moved"] is False, boss
        assert boss["closed"], boss
        print("  OK Bellwright intro: the court holds still and deals no damage until the line is closed")

        # close leftover UI if any
        G("if (g.dialogueOpen && g.debugAdvance) g.debugAdvance();")
        b.close()
    if errors:
        print("ERRORS:"); [print(" ", e) for e in errors]; sys.exit(1)
    print("hotfix_test: ALL OK, zero console errors.")

if __name__ == "__main__":
    main()
