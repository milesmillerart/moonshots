/* Generated audio: a tiny seeded chiptune sequencer + synthesized SFX (WebAudio).
   No samples, no third-party assets. Songs are data (core.json -> music). */
G.audio = (() => {
  let ac = null, master, musicBus, sfxBus, noiseBuf, cur = null, timer = null;
  const vol = { music: 0.55, sfx: 0.7, muted: false };
  try { Object.assign(vol, JSON.parse(localStorage.getItem('ebbmarrow.audio') || '{}')); } catch (e) {}
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10] };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
    musicBus = ac.createGain(); sfxBus = ac.createGain(); musicBus.connect(master); sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply(); return true;
  }
  function apply() { if (!ac) return; master.gain.value = vol.muted ? 0 : 1; musicBus.gain.value = vol.music * 0.5; sfxBus.gain.value = vol.sfx * 0.6; localStorage.setItem('ebbmarrow.audio', JSON.stringify(vol)); }
  function tone(bus, type, f, t, dur, g, opts = {}) {
    const o = ac.createOscillator(), e = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.attack || 0.005;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opts.lp; o.connect(fl); node = fl; }
    node.connect(e); e.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(bus, t, dur, g, f = 6000, type = 'highpass') {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), e = ac.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f;
    e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(e); e.connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }
  /* ---------- music ---------- */
  function play(name) {
    if (!G.data || !G.data.music) return;
    const song = G.data.music[name]; if (!song) { stop(); return; }
    if (cur && cur.name === name) return;
    cur = { name, song, step: 0, next: 0 };
    if (!init()) return;
    cur.next = ac.currentTime + 0.12;
    if (!timer) timer = setInterval(tick, 50);
  }
  function stop() { cur = null; }
  function tick() {
    if (!cur || !ac || ac.state !== 'running') return;
    const s = cur.song, sp = 60 / s.bpm / 4;
    while (cur.next < ac.currentTime + 0.25) { stepAt(cur, s, cur.step, cur.next); cur.step++; cur.next += sp * (s.swing && cur.step % 2 ? 1 + s.swing : s.swing && !(cur.step % 2) ? 1 - s.swing : 1); }
  }
  function stepAt(c, s, step, t) {
    const sc = SCALES[s.scale] || SCALES.minor, root = s.root || 57;
    const bar = (step / 16) | 0, st = step % 16, deg = s.prog[bar % s.prog.length];
    const note = (d, oct = 0) => root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
    const sp = 60 / s.bpm / 4;
    if (st === 0 && s.pad !== false) for (const k of [0, 2, 4]) tone(musicBus, 'triangle', hz(note(deg + k)), t, sp * 16, 0.05, { attack: 0.4, detune: k * 3 });
    if (s.bass !== false && (st === 0 || st === 8 || (s.busy && (st === 6 || st === 14)))) tone(musicBus, s.bassWave || 'triangle', hz(note(deg, -1)), t, sp * (st === 0 ? 6 : 4), 0.16, { lp: 900 });
    // phrase-seeded melody: repeats every 4 bars so it reads as a tune, not noise
    const r = G.rng((s.seed || 1) * 977 + (bar % 4) * 131 + st * 7);
    const density = s.density || 0.45;
    if (st % 2 === 0 && r() < density) {
      const ch = [0, 2, 4, 7, 5][(r() * (r() < 0.7 ? 3 : 5)) | 0];
      tone(musicBus, s.leadWave || 'square', hz(note(deg + ch, s.leadOct == null ? 1 : s.leadOct)), t, sp * (r() < 0.3 ? 4 : 2), 0.045, { lp: s.lp || 2400 });
    }
    if (s.arp && st % 2 === 1) tone(musicBus, 'sine', hz(note(deg + [0, 2, 4, 2][(st >> 1) % 4], 1)), t, sp * 1.5, 0.03);
    if (s.drums) {
      if (st % 4 === 2 || (s.drums === 'drive' && st % 2 === 1)) noise(musicBus, t, 0.04, 0.05);
      if (st === 0 || (s.drums === 'drive' && st === 8)) tone(musicBus, 'sine', 120, t, 0.18, 0.25, { slide: 40 });
      if (s.drums === 'drive' && (st === 4 || st === 12)) noise(musicBus, t, 0.12, 0.09, 1800, 'bandpass');
    }
    if (s.waves && st === 0 && bar % 2 === 0) noise(musicBus, t, sp * 14, 0.05, 500, 'lowpass');
  }
  /* ---------- sfx ---------- */
  const fx = {
    blip: (t) => tone(sfxBus, 'square', 880 + Math.random() * 60, t, 0.03, 0.03, { lp: 3000 }),
    move: (t) => tone(sfxBus, 'square', 660, t, 0.04, 0.05, { lp: 2600 }),
    select: (t) => { tone(sfxBus, 'square', 880, t, 0.06, 0.06, { lp: 3000 }); tone(sfxBus, 'square', 1320, t + 0.05, 0.08, 0.05, { lp: 3000 }); },
    cancel: (t) => tone(sfxBus, 'square', 440, t, 0.08, 0.05, { slide: 300, lp: 2000 }),
    hit: (t) => { noise(sfxBus, t, 0.12, 0.3, 1200, 'bandpass'); tone(sfxBus, 'square', 220, t, 0.1, 0.12, { slide: 80 }); },
    crit: (t) => { noise(sfxBus, t, 0.2, 0.4, 2000, 'bandpass'); tone(sfxBus, 'sawtooth', 520, t, 0.18, 0.12, { slide: 90 }); },
    hurt: (t) => { tone(sfxBus, 'sawtooth', 160, t, 0.2, 0.16, { slide: 60, lp: 1200 }); noise(sfxBus, t, 0.1, 0.2, 800, 'lowpass'); },
    splash: (t) => { noise(sfxBus, t, 0.45, 0.35, 900, 'bandpass'); tone(sfxBus, 'sine', 600, t, 0.3, 0.08, { slide: 1400 }); },
    heal: (t) => { for (let i = 0; i < 4; i++) tone(sfxBus, 'triangle', hz(72 + [0, 4, 7, 12][i]), t + i * 0.07, 0.25, 0.08); },
    guard: (t) => tone(sfxBus, 'triangle', 300, t, 0.25, 0.12, { slide: 500 }),
    chest: (t) => { [0, 4, 7, 11, 12].forEach((n, i) => tone(sfxBus, 'square', hz(76 + n), t + i * 0.06, 0.15, 0.05, { lp: 3500 })); },
    level: (t) => { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(sfxBus, 'square', hz(72 + n), t + i * 0.09, 0.2, 0.06, { lp: 3500 })); },
    win: (t) => { [0, 4, 7, 12].forEach((n, i) => tone(sfxBus, 'square', hz(67 + n), t + i * 0.12, 0.3, 0.06, { lp: 3000 })); tone(sfxBus, 'triangle', hz(55), t, 0.8, 0.12); },
    battle: (t) => { tone(sfxBus, 'sawtooth', 200, t, 0.5, 0.1, { slide: 900, lp: 2500 }); noise(sfxBus, t, 0.5, 0.15, 3000); },
    door: (t) => noise(sfxBus, t, 0.35, 0.18, 400, 'lowpass'),
    bell: (t) => { for (const [m, g] of [[57, 0.18], [64, 0.08], [69, 0.06], [76, 0.03]]) tone(sfxBus, 'sine', hz(m), t, 3.5, g, { attack: 0.01 }); },
    seal: (t) => { tone(sfxBus, 'sine', hz(62), t, 2.2, 0.14, { attack: 0.3 }); tone(sfxBus, 'sine', hz(69), t + 0.2, 2, 0.1, { attack: 0.3 }); noise(sfxBus, t, 1.8, 0.06, 600, 'lowpass'); },
    flee: (t) => { [0, 3, 6].forEach((n, i) => tone(sfxBus, 'square', hz(70 - n * 2), t + i * 0.05, 0.08, 0.05)); },
    buy: (t) => { tone(sfxBus, 'square', hz(84), t, 0.06, 0.05); tone(sfxBus, 'square', hz(91), t + 0.07, 0.12, 0.05); },
  };
  return {
    unlock() { if (init() && ac.state === 'suspended') ac.resume(); },
    play, stop,
    sfx(name) { if (!ac || ac.state !== 'running' || vol.muted) return; const f = fx[name]; if (f) f(ac.currentTime + 0.005); },
    get vol() { return vol; },
    set(k, v) { vol[k] = v; apply(); },
    get current() { return cur && cur.name; },
  };
})();
