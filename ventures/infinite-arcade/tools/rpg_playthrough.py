#!/usr/bin/env python3
"""Story playthrough bot: plays the prologue + Part 1 to the end through the real game
(dialogue, choices, battles incl. the boss, quests), teleporting between objectives.
Proves the slice is completable. Usage: tools/rpg_playthrough.py BASE_URL [SHOT_DIR]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
SHOTS = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/rpg-shots"); SHOTS.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1280, "height": 720}); errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("pageerror " + str(e)))
    ev = pg.evaluate
    S = lambda js: ev("(() => { const S = __rpg.G.state.S; return " + js + "; })()")
    def settle(limit=400, choices=None):
        """Advance dialogue / battles until the game is idle. choices: list of option texts to prefer."""
        idle = 0
        for _ in range(limit):
            mode = ev("__rpg.mode"); busy = ev("__rpg.busy + (__rpg.G.ui.modal ? 1 : 0)")
            if mode == "world" and busy == 0:
                idle += 1
                if idle >= 3: return True
                pg.wait_for_timeout(200); continue
            idle = 0
            if mode == "battle" and ev("!!document.querySelector('.bpanel .chooser.cmd')"):
                hp = S("S.hp / __rpg.G.state.stats().hp")
                if hp < 0.4 and S("(S.inv.kelpcake||0) + (S.inv.salve||0)") > 0:
                    pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(80); pg.keyboard.press("Enter"); pg.wait_for_timeout(250); pg.keyboard.press("Enter")
                elif S("S.sp") >= 3 and ev("(__rpg.G.battle && true)") and S("S.skills.includes('brine')") and ev("document.querySelector('.tide.t2') !== null"):
                    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(80); pg.keyboard.press("Enter"); pg.wait_for_timeout(250); pg.keyboard.press("Enter"); pg.wait_for_timeout(250); pg.keyboard.press("Enter")
                else:
                    pg.keyboard.press("Enter"); pg.wait_for_timeout(250); pg.keyboard.press("Enter")
                pg.wait_for_timeout(300); continue
            if choices and ev("!!document.querySelector('.chooser.dchoice')"):
                opts = ev("[...document.querySelectorAll('.chooser.dchoice .ch-item')].map(e => e.textContent)")
                for c in choices:
                    for i, o in enumerate(opts):
                        if c in o:
                            for _ in range(i): pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(60)
                            break
                    else: continue
                    break
            pg.keyboard.press("Enter"); pg.wait_for_timeout(230)
        return False
    def at(m, x, y, d):
        ev(f"__rpg.G.world.enter('{m}', {x}, {y}, '{d}')"); pg.wait_for_timeout(250)
    def talk(m, x, y, d, choices=None):
        at(m, x, y, d); pg.keyboard.press("Enter"); pg.wait_for_timeout(400); assert settle(choices=choices), f"stuck talking at {m} {x},{y}"
    def step(d, n=1):
        K = {"up": "ArrowUp", "down": "ArrowDown", "left": "ArrowLeft", "right": "ArrowRight"}[d]
        for _ in range(n):
            for _try in range(4):
                before = S("[S.map,S.x,S.y].join()")
                pg.keyboard.down(K); pg.wait_for_timeout(190); pg.keyboard.up(K); pg.wait_for_timeout(160)
                settle()
                if S("[S.map,S.x,S.y].join()") != before: break
    def check(cond, msg):
        ok = S(cond); print(("ok   " if ok else "FAIL ") + msg, flush=True)
        if not ok: print("     flags:", S("Object.keys(S.flags).join(',')"), "pos", S("[S.map,S.x,S.y,S.dir]"), "facing", ev("(__rpg.G.world.facing()||{}).id"), "busy", ev("__rpg.busy"), "modal", ev("__rpg.G.ui.modal"), "mode", ev("__rpg.mode"), "dlg", ev("(document.querySelector('.dlg:not(.hidden) .dlg-text')||{}).textContent"))
        if not ok: print("     errs:", errs)
        assert ok, msg
    pg.goto(BASE); pg.wait_for_selector(".title .ch-item"); ev("localStorage.clear(); localStorage.setItem('ebbmarrow.textspeed','4')")
    pg.reload(); pg.wait_for_selector(".title .ch-item")
    pg.locator(".title .ch-item", has_text="New game").click(); pg.wait_for_timeout(3800); settle()
    check("S.quests.q_pro === 'active'", "prologue started")
    talk("cove", 30, 13, "right"); check("S.flags.pro_ama && S.skills.includes('brine')", "talked to Ama, learned Brine Lash")
    talk("cove", 3, 10, "up"); check("S.equip.weapon === 'gaff'", "gaff hook equipped")
    talk("cove", 33, 17, "right", choices=["Leave it"]); check("S.flags.pro_crab", "beat the crab in Cobb's boat")
    talk("cove", 20, 23, "down"); check("S.flags.pro_seal", "touched the first Tide Seal")
    pg.screenshot(path=str(SHOTS / "story-seal.png"))
    talk("cove", 30, 13, "right", choices=["I'll go"]); check("S.flags.ch00_done && S.flags.ch01_started && S.quests.q_cause === 'active'", "prologue complete, Part 1 started")
    talk("cove", 33, 17, "right"); check("S.quests.q_trap === 'active'", "Cobb gave the trap quest")
    at("cove", 17, 28, "down"); step("down"); check("S.map === 'flats'", "walked onto the flats")
    pg.screenshot(path=str(SHOTS / "story-flats.png"))
    talk("flats", 9, 8, "up", choices=["keep an eye"]); check("S.quests.q_ring === 'active'", "Pim's ring quest")
    talk("flats", 33, 8, "up"); check("S.flags.trap_found", "found Cobb's trap")
    talk("flats", 12, 22, "up"); check("S.inv.pearl >= 1", "pearl on the flats")
    at("flats", 20, 15, "down"); step("down"); check("S.flags.p1_toll_seen", "met the toll clerk")
    talk("flats", 20, 16, "down", choices=["lapsed"]); check("S.quests.q_ledger === 'active'", "clerk asked for the ledger")
    at("flats", 3, 15, "up"); step("up"); check("S.map === 'warren'", "entered the Crab Warren")
    pg.screenshot(path=str(SHOTS / "story-warren.png"))
    talk("warren", 21, 3, "up"); check("S.flags.ledger_found", "found the ledger page")
    talk("warren", 3, 3, "up"); check("S.flags.ring_found", "found Pim's ring")
    talk("warren", 6, 11, "up"); talk("warren", 22, 10, "up"); check("S.inv.pearl >= 3", "three tide pearls")
    # a few real fights in the warren to level up like a player would
    for fx, fy, d in ((5, 10, "up"), (19, 17, "up"), (20, 5, "up")):
        at("warren", fx, fy, d); step(d)
    print("     level after warren fights:", S("S.lvl"), "hp", S("S.hp"))
    talk("flats", 9, 8, "up"); check("S.flags.ring_returned && S.equip.weapon === 'pimhook'", "returned the ring, got Merriam's Hook")
    talk("flats", 20, 16, "down", choices=["ledger page"]); check("S.flags.toll_ledger && S.flags.p1_toll_open", "clerk opened the gate (ledger route)")
    for fx, fy in ((20, 21), (20, 24)):
        at("flats", fx, fy, "down"); step("down")
    talk("flats", 18, 25, "down")  # rest at basin (A on shrine -> choose Rest)
    print("     level before boss:", S("S.lvl"), "hp", S("S.hp"), "/", S("__rpg.G.state.stats().hp"))
    at("flats", 20, 26, "down"); step("down"); step("down")
    pg.screenshot(path=str(SHOTS / "story-boss.png"))
    if not S("S.flags.p1_grandclaw"):
        at("flats", 20, 28, "down"); step("down")
    check("S.flags.p1_grandclaw && S.inv.shard", "defeated Grandclaw")
    talk("flats", 20, 30, "down"); check("S.flags.p1_seal2", "saw the Diver at the second seal")
    pg.screenshot(path=str(SHOTS / "story-diver.png"))
    talk("cove", 33, 17, "right"); check("S.flags.trap_returned", "returned Cobb's trap")
    talk("cove", 30, 13, "right", choices=["find her"]); check("S.flags.p1_done && S.flags.ch01_done", "Part 1 complete")
    check("S.quests.q_pro === 'done' && S.quests.q_cause === 'done' && S.quests.q_trap === 'done' && S.quests.q_ring === 'done' && S.quests.q_ledger === 'done'", "all quests done")
    print("     final: level", S("S.lvl"), "shells", S("S.shells"), "playtime(s)", round(S("S.time")))
    print("console errors:", errs)
    b.close()
    sys.exit(1 if errs else 0)
