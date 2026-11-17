#!/usr/bin/env python3
"""Headless smoke test + screenshots for Warden.
Usage: python3 tools/shots.py [URL] [OUTDIR]
Runs Chromium with SwiftShader WebGL, walks title -> naming -> judgment -> combat ->
armory -> forge -> skills, asserts no console errors, and saves 1600x900 PNGs."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/warden-shots"); OUT.mkdir(parents=True, exist_ok=True)
errors, logs = [], []

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 1600, "height": 900}); pg.set_default_timeout(180000)
        pg.on("console", lambda m: (errors if m.type == "error" else logs).append(f"[{m.type}] {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("window.__warden && document.querySelector('#menu button')", timeout=60000)
        pg.evaluate("window.__wardenNoDyn = true")
        G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game; {js} }})()")
        def settle(sec): time.sleep(sec)
        settle(3)
        pg.screenshot(path=str(OUT / "01-title.png"))
        # new game -> the 0.10 cold open (no naming at the title); opening_test.py plays the opening itself.
        pg.click("#menu button[data-act=new]")
        pg.wait_for_selector("#dialogue:not(.hidden)", timeout=60000)
        settle(2.5)
        pg.screenshot(path=str(OUT / "03-story.png"))
        G("g.debugSkipOpening('Aldric Vane', 'inquest')")
        settle(1.5)
        assert G("return g.state") == "play", "did not reach play state"
        st = G("return {trait: g.save.trait, enemies: g.enemies.length, name: g.save.name}")
        print("after intro:", st)
        assert st["trait"] == "inquest" and st["enemies"] == 3
        # play: walk forward and fight wave A with scripted inputs
        G("g.allowUnlockedAttack = true; g.noLock = true;")
        pg.keyboard.down("w"); settle(1.2); pg.keyboard.up("w")
        pg.screenshot(path=str(OUT / "05-gameplay.png"))
        G("g.applySetting('scale', 0.4)")
        t0 = time.time(); shot = False
        while time.time() - t0 < 240:
            alive = G("""const p=g.player; const es=g.enemies.filter(e=>!e.dead); if(!es.length) return 0;
              es.sort((a,b)=>a.pos.distanceTo(p.pos)-b.pos.distanceTo(p.pos)); const e=es[0];
              g.camYaw=Math.atan2(e.pos.x-p.pos.x,e.pos.z-p.pos.z); p.hp=g.stats.hp; p.sta=g.stats.sta;
              if (e.pos.distanceTo(p.pos)>2.4){ g.keys.KeyW=true; } else { g.keys.KeyW=false; g.edge[Math.random()<0.7?'light':'heavy']=true; }
              return es.length;""")
            if not shot and time.time() - t0 > 4 and G("return g.player.state==='attack' && g.player.activeHit"):
                G("g.applySetting('scale', 1)"); settle(0.3); pg.screenshot(path=str(OUT / "06-combat.png")); shot = True; G("g.applySetting('scale', 0.4)")
            if alive == 0: break
            settle(0.12)
        G("g.keys.KeyW=false; g.applySetting('scale', 1)")
        if not shot: pg.screenshot(path=str(OUT / "06-combat.png"))
        res = G("return {kills: g.save.kills, xp: g.save.xp, level: g.save.level, scrap: g.save.scrap, bag: g.save.bag.length, wave: g.wave, waveA: !!g.save.flags.waveA, loot: g.loot.length}")
        print("after wave A:", res)
        assert res["kills"] >= 3, "wave A not cleared"
        settle(1)
        # pick up dropped loot
        G("for (const l of g.loot) { g.player.pos.copy(l.m.position); l.t = 1; }"); settle(0.5)
        G("for (const l of g.loot) { g.player.pos.copy(l.m.position); l.t = 1; }"); settle(0.5)
        # give a spread of gear to show rarity tiers, then open the armory
        G("""const I = window.__wardenItems; g.save.scrap += 400;
             for (const [s,r] of [['blade',4],['cuirass',3],['helm',2],['gauntlets',1],['mantle',0]]) g.save.bag.push(I.makeItem(s,r,3));
             g.save.bag.push(I.makeCore('ember',2), I.makeCore('edge',1)); g.persist();""")
        pg.keyboard.press("i"); settle(1)
        first = G("return g.save.bag.find(x=>x.kind==='gear' && x.rarity===4)?.uid")
        if first: pg.click(f"[data-item='{first}']"); settle(0.5)
        pg.screenshot(path=str(OUT / "07-inventory.png"))
        pg.click("#invdetail [data-inv=equip]"); settle(0.3)
        pg.keyboard.press("Escape"); settle(0.5)
        if G("return g.ui.isOpen"): G("g.ui.close()")
        # forge: walk there, temper + socket
        G("g.player.pos.set(14.2,0,-7.2); g.player.face = 2.2; g.camYaw = 2.2;"); settle(1)
        assert G("return g.nearForge"), "not near forge"
        pg.keyboard.press("e"); settle(0.8)
        bu = G("return g.save.equip.blade.uid")
        G(f"g.ui.forgeSel='{bu}'; g.ui.render();")
        before = G("return g.save.equip.blade.upgrade")
        pg.click("[data-act=upgrade]"); settle(0.3)
        core = G("return g.save.bag.find(x=>x.kind==='core')?.uid")
        free = G("const b=g.save.equip.blade; return b.sockets-b.cores.length")
        if core and free: pg.click(f"[data-act=socket][data-uid='{core}']"); settle(0.3)
        pg.screenshot(path=str(OUT / "08-forge.png"))
        after = G("return {up: g.save.equip.blade.upgrade, cores: g.save.equip.blade.cores.length}")
        print("forge:", before, "->", after)
        assert after["up"] == before + 1
        G("g.ui.close()"); settle(0.3)
        # skills
        G("g.gainXp(500)")
        pg.keyboard.press("k"); settle(0.6)
        for pid in ["keen_edge", "capacitor", "overload", "plated"]:
            if "locked" in pg.get_attribute(f".nd[data-perk={pid}]", "class"): continue
            pg.click(f".nd[data-perk={pid}] .hex", force=True); settle(0.2); pg.click(f".nd[data-perk={pid}] .hex", force=True); settle(0.2)
            if pg.query_selector(".sk-learn.armed"): pg.click(".sk-learn"); settle(0.6)
        pg.screenshot(path=str(OUT / "09-skills.png"))
        perks = G("return g.save.perks"); print("perks:", perks)
        assert perks.get("keen_edge") == 1 and perks.get("overload") == 1
        G("g.ui.close()"); settle(0.3)
        # plaza wave + overload + boss fight shot
        G("g.player.pos.set(0,0,10); g.player.face=Math.PI; g.camYaw=Math.PI;"); settle(2)
        G("g.player.charge = 100; g.edge.KeyF = true;"); settle(0.5)
        G("""g.save.flags.opening='legacy'; g.save.flags.waveA=g.save.flags.waveB=g.save.flags.waveC=true; for(const e of g.enemies) e.dispose(); g.enemies=[]; g.wave='C';
             g.player.pos.set(0,0,-60); g.player.face=Math.PI; g.camYaw=Math.PI; g.camPitch=0.18;""")
        settle(1.5)
        G("g.debugAdvance && g.debugAdvance()"); settle(0.5)
        G("if (g.boss) { g.boss.aggro = true; g.boss.pos.set(0,0,-67); }"); settle(2)
        t0 = time.time()
        while time.time() - t0 < 6:
            G("""const p=g.player, e=g.boss; if(!e) return; g.camYaw=Math.atan2(e.pos.x-p.pos.x,e.pos.z-p.pos.z); p.hp=g.stats.hp; p.sta=g.stats.sta;
                 if (e.pos.distanceTo(p.pos)>4.2) g.keys.KeyW=true; else { g.keys.KeyW=false; g.edge.light=true; }""")
            settle(0.15)
        G("g.keys.KeyW=false")
        pg.screenshot(path=str(OUT / "10-boss.png"))
        # pause + changelog
        G("g.ui.open('news')"); settle(0.6)
        pg.screenshot(path=str(OUT / "11-changelog.png"))
        G("g.ui.close()")
        # save round trip
        G("g.persist()")
        saved = pg.evaluate("window.__wardenSave.readSlot(window.__warden.game.slot)")
        assert saved["name"] == "Aldric Vane" and saved["flags"]["judged"]
        fps = pg.evaluate("window.__warden.stats.fps")
        info = pg.evaluate("(() => { const r = window.__warden.renderer.info; return {calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, tex: r.memory.textures}; })()")
        print("swiftshader fps:", round(fps, 1), "render info:", info)
        pg.reload(wait_until="load")
        pg.wait_for_function("window.__warden && document.querySelector('#menu button[data-act=continue]')", timeout=60000)
        print("continue button present after reload: yes")
        b.close()
    print("console errors:", len(errors))
    for e in errors: print("  ", e)
    warn = [l for l in logs if "warn" in l.lower()]
    for w in warn[:10]: print("  ", w)
    (OUT / "smoke.json").write_text(json.dumps({"errors": errors, "warnings": warn[:30]}, indent=1))
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
