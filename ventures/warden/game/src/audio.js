// All sound is synthesized with WebAudio: no audio files, nothing to license.
let ctx = null, master = null, sfx = null, amb = null, hum = null, humGain = null;
let muted = false;

function noiseBuffer(sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let NOISE = null;

export const audio = {
  get ready() { return !!ctx; },
  init() {
    if (ctx) {
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => {});
        // older iOS also wants a sound started inside the gesture
        try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch {}
      }
      return;
    }
    // iOS: play through the ringer/silent switch like a game, not like a notification
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    amb = ctx.createGain(); amb.gain.value = 0.55; amb.connect(master);
    NOISE = noiseBuffer(3);
    // Rain bed.
    const rain = ctx.createBufferSource(); rain.buffer = NOISE; rain.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    const rg = ctx.createGain(); rg.gain.value = 0.16;
    rain.connect(hp).connect(lp).connect(rg).connect(amb); rain.start();
    // Low city drone.
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 180;
    const dg = ctx.createGain(); dg.gain.value = 0.05;
    for (const f of [41.2, 41.7, 61.8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(dl); o.start();
    }
    dl.connect(dg).connect(amb);
    // Synthblade hum, louder when the blade moves.
    hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 82;
    const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 400;
    humGain = ctx.createGain(); humGain.gain.value = 0.0;
    hum.connect(hl).connect(humGain).connect(sfx); hum.start();
    setInterval(() => { if (Math.random() < 0.25) this.thunder(); }, 14000);
  },
  setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; },
  get muted() { return muted; },
  setHum(level) {
    if (!ctx) return;
    humGain.gain.setTargetAtTime(0.012 + level * 0.05, ctx.currentTime, 0.05);
    hum.frequency.setTargetAtTime(82 + level * 60, ctx.currentTime, 0.05);
  },
  _noise(dur, type, f0, f1, gain, q = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = NOISE;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(sfx); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  },
  _tone(freq, dur, type = 'sine', gain = 0.2, f1 = null, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  swing(heavy) { this._noise(heavy ? 0.32 : 0.2, 'bandpass', heavy ? 400 : 700, heavy ? 2600 : 3400, heavy ? 0.5 : 0.35, 1.4); },
  hit(heavy, crit) {
    this._tone(heavy ? 90 : 130, 0.18, 'sine', 0.5, 40);
    this._noise(0.09, 'highpass', 2500, 1200, 0.35);
    this._tone(crit ? 1480 : 980, 0.25, 'square', 0.03, crit ? 1300 : 900);
  },
  hurt() { this._noise(0.25, 'lowpass', 900, 120, 0.6); this._tone(70, 0.3, 'sine', 0.4, 40); },
  dodge() { this._noise(0.25, 'lowpass', 1600, 300, 0.25); },
  pickup(r = 0) { this._tone(660 + r * 110, 0.2, 'sine', 0.12); this._tone(990 + r * 160, 0.3, 'sine', 0.1, null, 0.08); },
  ui() { this._tone(520, 0.06, 'triangle', 0.06); },
  forge() { this._tone(1200, 0.6, 'square', 0.04, 1100); this._noise(0.4, 'highpass', 3000, 2000, 0.2); this._tone(180, 0.3, 'sine', 0.3, 90); },
  zap() { this._noise(0.25, 'bandpass', 3000, 6000, 0.25, 4); this._tone(1800, 0.12, 'sawtooth', 0.05, 300); },
  nova() { this._noise(0.8, 'bandpass', 200, 5000, 0.5, 2); this._tone(60, 0.8, 'sawtooth', 0.2, 30); },
  spit() { this._noise(0.3, 'lowpass', 600, 200, 0.4, 5); },
  growl(pitch = 1) { this._tone(70 * pitch, 0.6, 'sawtooth', 0.06, 50 * pitch); this._noise(0.5, 'bandpass', 300 * pitch, 150, 0.15, 3); },
  bell() {
    if (!ctx) return;
    for (const [f, g] of [[110, 0.3], [220.8, 0.18], [331, 0.12], [497, 0.08], [742, 0.05]]) this._tone(f, 2.6, 'sine', g);
  },
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.5, 'triangle', 0.08, null, i * 0.09)); },
  thunder() { this._noise(3.5, 'lowpass', 300, 40, 0.5); },
  // Perfect dodge: a low whoomp under a rising glass shimmer.
  perfect() { this._tone(90, 0.5, 'sine', 0.35, 45); this._noise(0.35, 'bandpass', 900, 5200, 0.22, 3); [1320, 1760, 2640].forEach((f, i) => this._tone(f, 0.45, 'sine', 0.05, null, 0.05 + i * 0.04)); },
  // Last abomination of a fight falls: a deep toll and a sub drop.
  lastKill(big = false) { this._tone(big ? 55 : 82, big ? 2.2 : 1.3, 'sine', 0.4, big ? 28 : 40); this._noise(big ? 1.6 : 0.9, 'lowpass', 1200, 60, 0.35); this._tone(big ? 330 : 440, 1.2, 'triangle', 0.05, null, 0.06); },
  // Heavy wind-up: the synth edge drawing charge.
  charge(dur = 0.4) { this._tone(140, dur, 'sawtooth', 0.04, 520); this._noise(dur, 'bandpass', 500, 3800, 0.08, 6); },
  // Skill learned: a charge sweep into a struck chord, a crackle and a low bloom. Mastery adds a high bell.
  perkUnlock(max = false) {
    this._tone(180, 0.35, 'sawtooth', 0.035, 900); this._noise(0.3, 'bandpass', 600, 4200, 0.12, 5);
    [392, 523, 659, 784].forEach((f, i) => this._tone(f, 0.9, 'triangle', 0.07, null, 0.26 + i * 0.05));
    this._tone(65, 1.1, 'sine', 0.35, 40, 0.24);
    if (max) [1568, 2093].forEach((f, i) => this._tone(f, 1.4, 'sine', 0.05, null, 0.5 + i * 0.08));
  },
  holdTick(k) { this._tone(300 + k * 700, 0.05, 'square', 0.015); },
  death() { this._tone(110, 1.5, 'sawtooth', 0.12, 30); },
};
