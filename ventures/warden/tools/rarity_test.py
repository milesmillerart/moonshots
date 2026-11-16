#!/usr/bin/env python3
"""0.8 lore-alignment test (desktop 1600x900, or --mobile for iPhone 13 landscape).
Usage: python3 tools/rarity_test.py [URL] [OUTDIR] [--mobile]
1. Rarity migration: a 0.7 (schema 3) save with old-tier items migrates to schema 4 by position,
   effect slots become 0/0/1/2/3, installed Cores are never lost (a Base item keeps a slot per Core),
   placeholder names (King Vael, Saint Ossery, Old Kingdom, Cathedral, Saint-Wired, Tempered) are renamed.
2. No rarity promotion: Cores never change tier, colour or Power; installing a Core keeps rarity;
   Armory shows the new tier names and no "raised by Cores".
3. New loot: slots by tier, no placeholder royal/saint names in 600 rolls.
4. Defeat: "Defeated" screen (no "Rise"/"fallen"), resume keeps progress, "SYNCHRONIZATION RESTORED".
5. Synthblade: Dormant with no enemies, Awakens when an aggressive abomination is near; statue stays Dormant.
6. Story text: Hallowmere as capital of the Ninth Ward; the Rot as street talk.
Zero console errors."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
MOBILE = "--mobile" in sys.argv
URL = args[0] if args else "http://127.0.0.1:8765/"
OUT = Path(args[1] if len(args) > 1 else "/workspace/warden-08/rarity"); OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
READY = "window.__warden && window.__wardenItems && document.querySelector('#menu button')"

V07 = """() => { const I = window.__wardenItems;
  const mk = (slot, r, name, cores, sockets) => { const it = I.makeItem(slot, r, 6, { noCores: true, name }); it.cores = cores.map(([c, g]) => I.makeCore(c, g)); it.sockets = sockets; it.got = Date.now(); it.seen = true; it.fav = false; return it; };
  const eq = I.starterGear();
  eq.blade = mk('blade', 0, 'Ward-Issue Synthblade', [['edge', 1]], 1);              // old Issued: 1 socket, a Core installed
  eq.helm = mk('helm', 1, 'Tempered Sallet', [], 1);                                 // old Forged: 1 empty socket
  eq.cuirass = mk('cuirass', 2, 'Cathedral Plate Coat', [['bastion', 2], ['arc', 1]], 2); // old Tempered, 2 Cores -> old effective Sovereign
  const bag = [mk('helm', 3, 'Old Kingdom Greathelm', [], 2), mk('mantle', 3, 'Saint-Wired Mantle', [['ember', 2]], 2),
    mk('blade', 4, "Saint Ossery's Verdict", [['arc', 3]], 3), mk('cuirass', 4, 'Hearthplate of King Vael', [], 3), mk('helm', 4, 'Crown of the Unblinking', [], 3), I.makeCore('leech', 2)];
  const s = { schema: 3, v: 3, name: 'Kade', level: 7, xp: 5, points: 0, perks: {}, equip: eq, bag, scrap: 900, stims: 3, trait: 'measure',
    flags: { judged: true, waveA: true, waveB: true, waveC: true, boss: true }, created: 1763300000000, kills: 40, pos: [10, -5], face: 1.2, camYaw: 1.2,
    hp: 150, playTime: 1800, saved: Date.now() - 60000, ground: [], area: 'Statute Plaza' };
  localStorage.setItem('warden.slot.0', JSON.stringify(s)); localStorage.setItem('warden.meta', JSON.stringify({ last: 0, v1Done: [] }));
  return { cores: [...Object.values(eq), ...bag].reduce((a, it) => a + (it.cores ? it.cores.length : 0), 0) }; }"""

def main():
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        ctx = b.new_context(**p.devices["iPhone 13 landscape"]) if MOBILE else b.new_context(viewport={"width": 1600, "height": 900})
        pg = ctx.new_page(); pg.set_default_timeout(180000)
        pg.on("console", lambda m: m.type == "error" and errors.append(f"[console] {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        G = lambda js: pg.evaluate(f"(() => {{ const g = window.__warden.game, I = window.__wardenItems; {js} }})()")
        tag = "mobile" if MOBILE else "desktop"
        print("==", tag)
        pg.goto(URL, wait_until="load"); pg.wait_for_function(READY, timeout=90000)
        pg.evaluate("localStorage.clear()"); info = pg.evaluate(V07)
        pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=90000); pg.evaluate("window.__wardenNoDyn = true")
        # 6 (data part) story text
        st = pg.evaluate("""(async () => { const D = await import('./src/data.js?v=' + window.__warden.build); return D.STORY.intro.map(x => x.text).join(' | ') + ' || ' + D.STORY.bossIntro[0].text; })()""")
        assert "HALLOWMERE, ITS CAPITAL" in st and "street calls it the Rot" in st and "Some swear the things were people once" in st and "They say it was a bell-ringer" in st, st
        assert "the Rot breeds" not in st, st
        print("  OK story: Hallowmere is the capital; the Rot is street talk; 'were people' is belief")
        pg.click("#menu button[data-act=continue]"); pg.wait_for_function("window.__warden.game.state === 'play'"); time.sleep(1)
        G("g.allowUnlockedAttack = true; g.noLock = true; g.applySetting && g.applySetting('scale', 0.5);")
        # 1. migration
        m = G("""const all = [...Object.values(g.save.equip), ...g.save.bag].filter(x => x.kind === 'gear');
          return { schema: g.save.schema, items: all.map(x => [x.slot, x.rarity, x.sockets, x.cores.length, x.name]),
                   cores: [...Object.values(g.save.equip), ...g.save.bag].reduce((a, it) => a + (it.cores ? it.cores.length : 0), 0) }""")
        assert m["schema"] == 4, m
        assert m["cores"] == info["cores"], (m["cores"], info)
        names = [x[4] for x in m["items"]]
        for bad in ["King", "Saint", "Old Kingdom", "Cathedral", "Tempered ", "Crown"]:
            assert not any(bad in n for n in names), (bad, names)
        for good in ["Ossery's Verdict", "Vael's Hearthplate", "Elder-Wrought Greathelm", "Spire-Wrought Plate Coat", "Lattice-Wired Mantle", "Quenched Sallet", "Visor of the Unblinking"]:
            assert good in names, (good, names)
        want = {"Ward-Issue Synthblade": (0, 1, 1), "Quenched Sallet": (1, 0, 0), "Spire-Wrought Plate Coat": (2, 2, 2), "Elder-Wrought Greathelm": (3, 2, 0),
                "Lattice-Wired Mantle": (3, 2, 1), "Ossery's Verdict": (4, 3, 1), "Vael's Hearthplate": (4, 3, 0)}
        for sl, r, so, nc, n in m["items"]:
            if n in want: assert (r, so, nc) == want[n], (n, (r, so, nc), want[n])
        print("  OK schema 3 -> 4: tiers kept by position, slots 0/0/1/2/3, every installed Core kept (incl. on Base gear), placeholder names renamed")
        # 2. no promotion
        np = G("""const cu = g.save.equip.cuirass, bare = { ...cu, cores: [] };
          const R = window.__wardenData ? null : null;
          return { tier: I.tierOf(cu), r: cu.rarity, p1: I.powerOf(cu), p2: I.powerOf(bare), hasEff: typeof I.effectiveRarity }""")
        assert np["tier"] == np["r"] == 2 and np["p1"] == np["p2"] and np["hasEff"] == "undefined", np
        # install a Core into a Rare item with a free slot -> rarity unchanged
        G("""const it = I.makeItem('greaves', 2, 6, { noCores: true }); g.save.bag.push(it); g.equip(it.uid);
             const c = g.save.bag.find(x => x.kind === 'core'); g.socket(it.uid, c.uid);""")
        s2 = G("const it = g.save.equip.greaves; return [it.rarity, it.cores.length, I.tierOf(it), it.sockets]")
        assert s2 == [2, 1, 2, 1], s2
        # Base gear has no slot: installing must refuse
        r0 = G("""const it = I.makeItem('gauntlets', 0, 6, { noCores: true }); g.save.bag.push(it); const c = I.makeCore('arc', 1); g.save.bag.push(c);
                  g.socket(it.uid, c.uid); return [it.sockets, it.cores.length, it.rarity]""")
        assert r0 == [0, 0, 0], r0
        print("  OK Cores never promote: tier/Power use base rarity; Core into Rare keeps Rare; Base gear has no effect slot")
        # Armory text
        G("g.ui.toggle('armory')"); time.sleep(1.2)
        G("const cu = g.save.equip.cuirass; g.ui.armory.sel = cu.uid; g.ui.render();"); time.sleep(0.6)
        txt = pg.inner_text(".panel").lower()
        assert "rare" in txt and "raised by cores" not in txt and "issued" not in txt and "sovereign" not in txt, txt[:400]
        pg.screenshot(path=str(OUT / f"{tag}-armory-rare.png"))
        G("const it = g.save.bag.find(x => x.rarity === 4 && x.slot === 'blade'); g.ui.armory.sel = it.uid; g.ui.render();"); time.sleep(0.6)
        txt = pg.inner_text(".panel").lower()
        assert "exalted" in txt and "not designed yet" in txt, txt[:500]
        pg.screenshot(path=str(OUT / f"{tag}-armory-exalted.png"))
        print("  OK Armory shows new tier names, effect slots, Exalted buff placeholder")
        G("g.ui.close()"); time.sleep(0.4)
        # 3. new loot
        nl = G("""const slots = [0,1,2,3,4].map(r => I.makeItem('helm', r, 5).sockets); let bad = [];
          for (let i = 0; i < 600; i++) { const it = I.randomGear(5, 2); if (/King|Saint|Kingdom|Cathedral|Sovereign|Crown/.test(it.name)) bad.push(it.name); if (it.cores.length > it.sockets) bad.push('overfull'); }
          return { slots, bad }""")
        assert nl["slots"] == [0, 0, 1, 2, 3] and not nl["bad"], nl
        print("  OK new loot: slots 0/0/1/2/3, no placeholder names in 600 rolls")
        # 5. blade dormant / awakened
        G("for (const e of g.enemies) e.dispose(); g.enemies = []; g.lockTarget = null; g.player.forceAwake = null; g.player.state = 'move';")
        # sim time runs slowly under SwiftShader (dt is capped per frame), so wait on the state, not the clock
        pg.wait_for_function("window.__warden.game.player.u.sword.userData.awake < 0.08", timeout=150000)
        d = G("return g.player.u.sword.userData.awake")
        assert d < 0.08, d
        G("""const T = window.__warden.THREE; return import('./src/enemies.js?v=' + window.__warden.build).then(({ Enemy }) => {
             const e = new Enemy(g, 'husk', g.player.pos.clone().add(new T.Vector3(0, 0, 6)), 1); e.aggro = true; g.enemies.push(e); });""")
        pg.wait_for_function("window.__warden.game.player.u.sword.userData.awake > 0.85", timeout=150000)
        a = G("return g.player.u.sword.userData.awake")
        assert a > 0.85, a
        sv = G("let s = null; g.scene.traverse(o => { if (o.userData && o.userData.statue === true && o.userData.setAwake) s = o.userData.awake; }); return s")
        assert sv == 0, sv
        print(f"  OK Synthblade Dormant out of combat ({d:.2f}), Awakened near an aggressive abomination ({a:.2f}); statue blade Dormant")
        # 4. defeat
        before = G("return [g.save.level, g.save.bag.length, g.save.scrap, Object.keys(g.save.flags).length]")
        G("for (const e of g.enemies) e.dispose(); g.enemies = []; const p = g.player; p.iframes = 0; p.hp = 1; p.state = 'move'; p.takeHit(99999, p.pos.clone().setX(p.pos.x + 1), 0);")
        pg.wait_for_function("document.querySelector('.panel.dead')", timeout=60000); time.sleep(0.8)
        dt = pg.inner_text(".panel.dead")
        dl = dt.lower(); assert "defeated" in dl and "rise" not in dl and "fallen" not in dl and "synchronization point" in dl, dt
        pg.screenshot(path=str(OUT / f"{tag}-defeat.png"))
        pg.click("[data-act=respawn]"); time.sleep(0.5)
        bn = pg.inner_text("#banner")
        assert "SYNCHRONIZATION RESTORED" in bn.upper(), bn
        pg.screenshot(path=str(OUT / f"{tag}-sync-restored.png"))
        after = G("return [g.save.level, g.save.bag.length, g.save.scrap, Object.keys(g.save.flags).length]")
        assert before == after, (before, after)
        print("  OK defeat: 'Defeated' (no resurrection wording), resume keeps progress, 'Synchronization restored'")
        # reload: migrated data persisted
        pg.reload(wait_until="load"); pg.wait_for_function(READY, timeout=90000)
        sc = pg.evaluate("JSON.parse(localStorage.getItem('warden.slot.0')).schema"); assert sc == 4, sc
        b.close()
    print("console errors:", len(errors))
    for e in errors: print("  ", e)
    (OUT / f"{tag}-errors.json").write_text(json.dumps(errors, indent=1))
    if errors: return 1
    print("ALL OK", tag); return 0

if __name__ == "__main__":
    sys.exit(main())
