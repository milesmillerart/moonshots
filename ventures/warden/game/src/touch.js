// Touch controls (phones / tablets): floating left stick, right-side camera drag, thumb buttons.
// Only built when a touch device is detected (or ?touch=1); desktop input is untouched.
import { audio } from './audio.js';
import { clamp } from './util.js';

const qs = new URLSearchParams(location.search);
export function detectTouch() {
  if (qs.get('touch') === '1') return true;
  if (qs.get('touch') === '0') return false;
  const coarse = matchMedia('(pointer: coarse)').matches, fine = matchMedia('(any-pointer: fine)').matches;
  return coarse || (navigator.maxTouchPoints > 0 && !fine);
}

const BTN = [
  // id, label, class (layout slot)
  ['light', 'STRIKE', 'b-light'], ['heavy', 'HEAVY', 'b-heavy'], ['dodge', 'ROLL', 'b-dodge'],
  ['lock', 'LOCK', 'b-lock'], ['stim', 'STIM', 'b-stim'], ['over', 'OVERLOAD', 'b-over'], ['caut', 'CAUTERIZE', 'b-caut'], ['use', 'USE', 'b-use'],
];

export class TouchControls {
  constructor(game) {
    this.g = game; this.on = false; this.stick = null; this.look = null; this.sprint = false;
    this.lightHeld = null;
  }
  enable() {
    if (this.on) return; this.on = true;
    const g = this.g;
    document.documentElement.classList.add('touch');
    g.touch = this; g.noLock = true; g.allowUnlockedAttack = true;
    const root = this.root = document.createElement('div'); root.id = 'touch'; root.className = 'hidden';
    root.innerHTML = `<div class="zone" id="tz"></div>
      <div class="stick hidden" id="tstick"><div class="knob" id="tknob"></div></div>
      <div class="tmenu"><button data-t="armory" aria-label="Armory">GEAR</button><button data-t="skills" aria-label="Skills">SKILLS<i id="tpts"></i></button><button data-t="pause" aria-label="Pause">❚❚</button></div>
      <div class="tact">${BTN.map(([id, l, c]) => `<button data-b="${id}" class="tb ${c}"><span>${l}</span></button>`).join('')}</div>`;
    document.body.appendChild(root);
    this.zone = root.querySelector('#tz'); this.stickEl = root.querySelector('#tstick'); this.knob = root.querySelector('#tknob');
    this.btnOver = root.querySelector('.b-over'); this.btnUse = root.querySelector('.b-use'); this.btnLock = root.querySelector('.b-lock');
    this.btnCaut = root.querySelector('.b-caut'); this.btnStim = root.querySelector('.b-stim'); this.pts = root.querySelector('#tpts');
    // movement + camera
    this.zone.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e), { passive: false });
    addEventListener('pointerup', (e) => this.up(e)); addEventListener('pointercancel', (e) => this.up(e));
    // buttons
    root.querySelectorAll('[data-b]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audio.init(); b.classList.add('pr'); this.press(b.dataset.b); });
      const rel = () => { b.classList.remove('pr'); if (b.dataset.b === 'light') { clearInterval(this.lightHeld); this.lightHeld = null; } };
      b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel); b.addEventListener('pointerleave', rel);
    });
    root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); audio.init();
      if (g.state !== 'play' || g.dialogueOpen || g.ui.screen === 'dead') return;
      const t = b.dataset.t; if (t === 'pause') g.ui.open('pause'); else g.ui.toggle(t);
    }));
    // a backgrounded tab pauses the game
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.reset(); if (g.state === 'play' && !g.ui.isOpen && !g.dialogueOpen && g.player.state !== 'dead') g.ui.open('pause'); } });
    // turning the phone to portrait mid-fight pauses (the rotate prompt covers the screen)
    matchMedia('(orientation: portrait)').addEventListener?.('change', (m) => { if (m.matches) { this.reset(); if (g.state === 'play' && !g.ui.isOpen && !g.dialogueOpen && g.player.state !== 'dead') g.ui.open('pause'); } });
    // tapping the scene advances story dialogue
    g.renderer.domElement.addEventListener('click', () => { if (g.dialogueOpen && g.debugAdvance) g.debugAdvance(); });
  }
  press(id) {
    const g = this.g;
    if (g.state !== 'play' || g.ui.isOpen) return;
    if (id === 'light') { g.edge.light = true; clearInterval(this.lightHeld); this.lightHeld = setInterval(() => { g.edge.light = true; }, 170); }
    if (id === 'heavy') g.edge.heavy = true;
    if (id === 'dodge') g.edge.Space = true;
    if (id === 'lock') g.edge.KeyQ = true;
    if (id === 'stim') g.edge.KeyR = true;
    if (id === 'over') g.edge.KeyF = true;
    if (id === 'caut') g.edge.KeyC = true;
    if (id === 'use' && !g.dialogueOpen) g.interact();
  }
  down(e) {
    e.preventDefault(); audio.init();
    const g = this.g; if (g.state !== 'play') return;
    const leftSide = e.clientX < innerWidth * 0.42;
    if (leftSide && !this.stick) {
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      const s = this.stickEl.style; s.left = e.clientX + 'px'; s.top = e.clientY + 'px';
      this.stickEl.classList.remove('hidden'); this.knob.style.transform = 'translate(-50%,-50%)';
      g.joy = { x: 0, y: 0 };
    } else if (!leftSide && !this.look) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    }
    try { this.zone.setPointerCapture(e.pointerId); } catch {}
  }
  move(e) {
    const g = this.g;
    if (this.stick && e.pointerId === this.stick.id) {
      e.preventDefault();
      const R = Math.min(64, innerHeight * 0.16);
      let dx = e.clientX - this.stick.x, dy = e.clientY - this.stick.y;
      const d = Math.hypot(dx, dy);
      // the stick follows a thumb that drifts too far, so it never feels stuck
      if (d > R * 1.6) { const k = (d - R * 1.6) / d; this.stick.x += dx * k; this.stick.y += dy * k; dx = e.clientX - this.stick.x; dy = e.clientY - this.stick.y;
        const s = this.stickEl.style; s.left = this.stick.x + 'px'; s.top = this.stick.y + 'px'; }
      const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
      const kx = Math.cos(a) * m, ky = Math.sin(a) * m;
      this.knob.style.transform = `translate(calc(-50% + ${kx * R}px), calc(-50% + ${ky * R}px))`;
      g.joy = m < 0.12 ? { x: 0, y: 0 } : { x: kx, y: ky, m };
      this.sprint = m > 0.96 && Math.hypot(e.clientX - this.stick.x, e.clientY - this.stick.y) > R * 1.15;
      this.stickEl.classList.toggle('sprint', this.sprint);
    } else if (this.look && e.pointerId === this.look.id) {
      e.preventDefault();
      const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y; this.look.x = e.clientX; this.look.y = e.clientY;
      this.look.moved += Math.abs(dx) + Math.abs(dy);
      if (g.state !== 'play' || g.ui.isOpen) return;
      const s = 0.0062 * g.settings.sens;
      g.camYaw -= dx * s;
      g.camPitch = clamp(g.camPitch + dy * s * 0.8 * (g.settings.invertY ? -1 : 1), -0.35, 1.15);
    }
  }
  up(e) {
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.sprint = false; this.g.joy = null; this.stickEl.classList.add('hidden'); this.stickEl.classList.remove('sprint'); }
    if (this.look && e.pointerId === this.look.id) {
      // a quick tap on the right side (no drag) is a light strike
      if (this.look.moved < 10 && performance.now() - this.look.t < 220) this.press('light'), clearInterval(this.lightHeld);
      this.look = null;
    }
  }
  reset() { this.stick = null; this.look = null; this.sprint = false; this.g.joy = null; this.stickEl?.classList.add('hidden'); clearInterval(this.lightHeld); }
  // called from the HUD refresh (~7 Hz)
  update() {
    const g = this.g, sv = g.save;
    const show = g.state === 'play' && !g.ui.isOpen;
    this.root.classList.toggle('hidden', !show);
    this.root.classList.toggle('dlg', !!g.dialogueOpen);
    if (!show) { if (this.stick || this.look) this.reset(); return; }
    if (!sv) return;
    this.btnOver.classList.toggle('hidden', !g.perk('overload'));
    this.btnOver.classList.toggle('ready', g.perk('overload') && g.player.charge >= g.overloadCost());
    this.btnCaut.classList.toggle('ready', g.player.charge >= g.cauterizeCost());
    this.btnUse.classList.toggle('hidden', !g.prompt);
    this.btnUse.querySelector('span').textContent = g.nearForge ? 'FORGE' : g.nearCache ? 'SEARCH' : 'USE';
    this.btnLock.classList.toggle('on', !!g.lockTarget);
    this.btnStim.querySelector('span').textContent = `STIM ${sv.stims}`;
    this.pts.textContent = sv.points ? String(sv.points) : '';
  }
}
