// =====================================================================
//  Audio engine - music + sound effects, all synthesized live
//  (no sound files needed). Shared by the arcade menu and the games.
//  Mute settings are shared across the whole site.
// =====================================================================
const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, reverbSend, echo;
  let musicOn = true, sfxOn = true;
  try {
    musicOn = localStorage.getItem('cnatt_music') !== 'off';
    sfxOn = localStorage.getItem('cnatt_sfx') !== 'off';
  } catch (e) {}

  const MUSIC_VOL = 0.55, SFX_VOL = 0.8;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? MUSIC_VOL : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? SFX_VOL : 0; sfxBus.connect(master);
    // reverb (generated impulse)
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = ir;
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.28;
    reverbSend.connect(conv); conv.connect(master);
    // echo
    echo = ctx.createDelay(1.0); echo.delayTime.value = 0.32;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.35;
    echo.connect(fb); fb.connect(echo); echo.connect(echoOut); echoOut.connect(musicBus);
    if (pendingSong) { const s = pendingSong; pendingSong = null; playSong(s); }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, init, { capture: true, passive: true }));

  // ------------------------------------------------------------ primitives
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function tone(t, freq, dur, o = {}) {
    if (!ctx) return;
    const type = o.type || 'square', vol = o.vol ?? 0.2, att = o.attack ?? 0.005, rel = o.release ?? 0.06;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.slideTime ?? dur));
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibRate || 5.5; lg.gain.value = freq * o.vib;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t + 0.08); lfo.stop(t + dur + rel + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    const sus = o.sustain ?? 0.7;
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * sus), t + Math.max(att + 0.01, dur * 0.5));
    g.gain.setValueAtTime(Math.max(0.0001, vol * sus), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    let node = g;
    osc.connect(g);
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); node = f; }
    const dest = o.dest || sfxBus;
    node.connect(dest);
    if (o.verb && reverbSend) { const s = ctx.createGain(); s.gain.value = o.verb; node.connect(s); s.connect(reverbSend); }
    if (o.echo && echo) { const s = ctx.createGain(); s.gain.value = o.echo; node.connect(s); s.connect(echo); }
    osc.start(t); osc.stop(t + dur + rel + 0.05);
  }
  let noiseBuf = null;
  function noise(t, dur, o = {}) {
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'highpass'; f.frequency.setValueAtTime(o.freq || 6000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    if (o.q) f.Q.value = o.q;
    const g = ctx.createGain(), vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    if (o.verb && reverbSend) { const s = ctx.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(reverbSend); }
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const now = () => ctx ? ctx.currentTime + 0.01 : 0;

  // ------------------------------------------------------------ sound effects
  const SFX = {
    click()  { const t = now(); tone(t, 988, 0.03, { vol: 0.16 }); tone(t + 0.03, 1319, 0.04, { vol: 0.12 }); },
    click2() { const t = now(); tone(t, 660, 0.04, { type: 'triangle', vol: 0.3, slide: 990 }); },
    hover()  { tone(now(), 1760, 0.015, { type: 'triangle', vol: 0.07, release: 0.03 }); },
    tab()    { const t = now(); tone(t, 523, 0.04, { type: 'triangle', vol: 0.25 }); tone(t + 0.04, 784, 0.05, { type: 'triangle', vol: 0.2 }); },
    back()   { const t = now(); tone(t, 784, 0.04, { type: 'triangle', vol: 0.22 }); tone(t + 0.04, 523, 0.06, { type: 'triangle', vol: 0.2 }); },
    error()  { const t = now(); tone(t, 180, 0.12, { vol: 0.16, slide: 110 }); tone(t + 0.13, 140, 0.16, { vol: 0.14, slide: 90 }); },
    coin()   { const t = now(); tone(t, 1319, 0.05, { vol: 0.14 }); tone(t + 0.05, 1976, 0.14, { vol: 0.12, verb: 0.2 }); },
    buy() {
      const t = now();
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.055, f, 0.07, { vol: 0.14, verb: 0.2 }));
      tone(t + 0.24, 2093, 0.25, { type: 'triangle', vol: 0.12, verb: 0.4 });
      noise(t + 0.22, 0.25, { freq: 9000, vol: 0.05 });
    },
    sell() { const t = now(); for (let i = 0; i < 6; i++) tone(t + i * 0.045, 1319 + i * 120, 0.05, { vol: 0.1 }); tone(t + 0.3, 2637, 0.2, { type: 'triangle', vol: 0.1, verb: 0.3 }); },
    charge(p) { tone(now(), 300 + p * 700, 0.03, { type: 'triangle', vol: 0.05 }); },
    cast() {
      const t = now();
      noise(t, 0.35, { filter: 'bandpass', freq: 3500, sweep: 500, q: 1.5, vol: 0.28 });
      tone(t, 900, 0.25, { type: 'sine', vol: 0.06, slide: 300 });
    },
    reelOut() { const t = now(); for (let i = 0; i < 10; i++) noise(t + i * 0.03, 0.015, { freq: 5000, vol: 0.06 }); },
    splash(size = 1) {
      const t = now();
      noise(t, 0.35 * size, { filter: 'lowpass', freq: 2500, sweep: 300, vol: 0.32 * size, verb: 0.2 });
      tone(t, 420, 0.1, { type: 'sine', vol: 0.25 * size, slide: 110, release: 0.05 });
    },
    plop() { const t = now(); tone(t, 520, 0.06, { type: 'sine', vol: 0.22, slide: 160 }); noise(t, 0.06, { filter: 'lowpass', freq: 1800, vol: 0.06 }); },
    bite() {
      const t = now();
      noise(t, 0.3, { filter: 'lowpass', freq: 1800, sweep: 300, vol: 0.3 });
      tone(t, 300, 0.12, { type: 'sine', vol: 0.3, slide: 90 });
      tone(t + 0.04, 1568, 0.08, { type: 'square', vol: 0.12 }); tone(t + 0.12, 2093, 0.18, { type: 'square', vol: 0.12, verb: 0.3 });
    },
    hook() { const t = now(); tone(t, 220, 0.05, { type: 'sawtooth', vol: 0.12, slide: 660, lp: 3000 }); noise(t, 0.08, { freq: 3000, vol: 0.1 }); },
    reelTick(pitch = 1) { noise(now(), 0.018, { freq: 6500 * pitch, vol: 0.05 }); },
    strain() { tone(now(), 1400 + Math.random() * 300, 0.06, { type: 'sawtooth', vol: 0.025, lp: 2500 }); },
    escape() {
      const t = now();
      [659, 587, 523, 392].forEach((f, i) => tone(t + i * 0.11, f, 0.12, { type: 'triangle', vol: 0.2 }));
      noise(t, 0.3, { filter: 'lowpass', freq: 1500, sweep: 200, vol: 0.2 });
    },
    snap() { const t = now(); noise(t, 0.12, { freq: 2500, vol: 0.4 }); tone(t, 1800, 0.12, { type: 'sawtooth', vol: 0.12, slide: 120 }); },
    catch(tier = 0) {
      const t = now();
      const seqs = [[523, 659, 784], [523, 659, 784, 1047], [587, 740, 880, 1175, 1480],
                    [523, 659, 784, 1047, 1319, 1568, 2093], [392, 494, 587, 784, 988, 1175, 1568, 1976, 2349]];
      const s = seqs[tier];
      s.forEach((f, i) => tone(t + i * 0.07, f, 0.09, { vol: 0.15, verb: 0.25 }));
      const end = t + s.length * 0.07;
      tone(end, s[s.length - 1], 0.5 + tier * 0.15, { type: 'triangle', vol: 0.18, vib: 0.01, verb: 0.5 });
      tone(end, s[s.length - 3] || s[0], 0.5 + tier * 0.15, { type: 'square', vol: 0.06, verb: 0.4 });
      if (tier >= 3) for (let i = 0; i < 12; i++) tone(end + 0.1 + i * 0.05, 2000 + Math.random() * 2000, 0.04, { type: 'triangle', vol: 0.05, verb: 0.6 });
      noise(t, 0.4, { filter: 'lowpass', freq: 2000, sweep: 300, vol: 0.18 });
    },
    newFish() { const t = now() + 0.55; [1568, 2093, 2637].forEach((f, i) => tone(t + i * 0.06, f, 0.08, { type: 'triangle', vol: 0.12, verb: 0.4 })); },
    unlock() {
      const t = now();
      [262, 330, 392, 523].forEach(f => tone(t, f, 0.9, { type: 'triangle', vol: 0.1, attack: 0.2, verb: 0.6 }));
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(t + 0.3 + i * 0.08, f, 0.1, { vol: 0.12, verb: 0.4 }));
    },
    travel() { const t = now(); noise(t, 0.9, { filter: 'bandpass', freq: 400, sweep: 3000, q: 2, vol: 0.12, attack: 0.3 }); },
    whoosh() { noise(now(), 0.25, { filter: 'bandpass', freq: 1200, sweep: 4000, q: 1, vol: 0.12 }); },
    secret() {
      const t = now();
      for (let i = 0; i < 16; i++) tone(t + i * 0.045, mtof(72 + [0, 4, 7, 11, 12, 16, 19, 23][i % 8] + (i >= 8 ? 12 : 0)), 0.08, { type: 'triangle', vol: 0.13, verb: 0.5 });
      tone(t + 0.75, mtof(84), 1.2, { type: 'square', vol: 0.08, vib: 0.012, verb: 0.6 });
      tone(t + 0.75, mtof(88), 1.2, { type: 'triangle', vol: 0.1, verb: 0.6 });
    },
  };
  function play(name, ...args) { if (!ctx || !sfxOn) return; try { SFX[name] && SFX[name](...args); } catch (e) {} }

  // ------------------------------------------------------------ music
  //  A song is generated from a small description: key, scale, chord
  //  progression, tempo, instruments. A seeded random melody is written
  //  as motifs that repeat and follow the chords, so it sounds composed.
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    harmonic: [0, 2, 3, 5, 7, 8, 11], penta: [0, 2, 4, 7, 9, 12, 14],
  };
  function compose(def) {
    const R = rng(def.seed || 1), sc = SCALES[def.scale || 'major'], root = def.root || 60;
    const deg = (d, oct = 0) => { const n = sc.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return root + sc[i] + 12 * (o + oct); };
    const prog = def.prog, steps = 16, bars = prog.length;
    // three melodic motifs (2 bars each) in "degrees relative to chord root"
    function motif(density, range) {
      const m = []; let cur = 0;
      for (let s = 0; s < 32; s++) {
        const strong = s % 4 === 0, half = s % 8 === 0;
        const p = half ? 0.85 : strong ? 0.6 : (s % 2 === 0 ? 0.32 : 0.12);
        if (R() < p * density) {
          if (strong) cur = [0, 2, 4, 7][Math.floor(R() * 4)] + (R() < 0.3 ? -3 : 0);
          else cur += R() < 0.5 ? 1 : -1;
          cur = Math.max(-3, Math.min(range, cur));
          let len = 1; while (len < 6 && R() < (strong ? 0.55 : 0.3)) len++;
          m.push({ s, d: cur, len });
        }
      }
      return m;
    }
    const dn = (def.density || 0.8) * 0.8, mA = motif(dn, 7), mB = motif(dn * 0.9, 9), mC = motif(dn * 1.1, 11);
    const form = def.form || ['A', 'A', 'B', 'A'];
    const events = []; // {step, kind, midi, len}
    let bar0 = 0;
    form.forEach((sec, si) => {
      const mot = sec === 'A' ? mA : sec === 'B' ? mB : mC;
      const lift = sec === 'B' ? 2 : 0;
      for (let b = 0; b < bars; b++) {
        const chordDeg = prog[b], base = (bar0 + b) * steps;
        const chord = [deg(chordDeg), deg(chordDeg + 2), deg(chordDeg + 4)];
        // bass
        const bp = def.bass || 'x.......x.......';
        for (let s = 0; s < 16; s++) if (bp[s] === 'x' || bp[s] === 'o') events.push({ step: base + s, kind: 'bass', midi: deg(chordDeg + (bp[s] === 'o' ? 4 : 0), -2), len: def.bassLen || 3 });
        // pad
        if (def.pad) [...chord, deg(chordDeg + 6)].forEach(m => events.push({ step: base, kind: 'pad', midi: m - 12 + (def.padOct || 0) * 12, len: 16 }));
        // arp
        if (def.arp && !(si === 0 && def.introNoArp)) {
          const pattern = def.arpPattern || [0, 1, 2, 1];
          for (let s = 0; s < 16; s += def.arpRate || 2) events.push({ step: base + s, kind: 'arp', midi: chord[pattern[(s / (def.arpRate || 2)) % pattern.length]] + 12 * (def.arpOct ?? 1), len: 1 });
        }
        // melody (motif covers 2 bars)
        if (!(si === 0 && def.introNoLead)) {
          const half = b % 2;
          mot.forEach(n => {
            if (Math.floor(n.s / 16) !== half) return;
            const vary = (si === 3 && b >= bars - 2) ? 0 : 0;
            events.push({ step: base + (n.s % 16), kind: 'lead', midi: deg(chordDeg + n.d + lift + vary, def.leadOct ?? 1), len: n.len });
          });
        }
        // drums
        const dk = def.kick || '', ds = def.snare || '', dh = def.hat || '';
        if (!(si === 0 && def.introNoDrums))
          for (let s = 0; s < 16; s++) {
            if (dk[s] === 'x') events.push({ step: base + s, kind: 'kick' });
            if (ds[s] === 'x') events.push({ step: base + s, kind: 'snare' });
            if (dh[s] === 'x') events.push({ step: base + s, kind: 'hat' });
          }
      }
      bar0 += bars;
    });
    const byStep = new Map();
    events.forEach(e => { if (!byStep.has(e.step)) byStep.set(e.step, []); byStep.get(e.step).push(e); });
    return { def, byStep, total: bar0 * steps, stepDur: 60 / def.bpm / 4 };
  }

  // ------------------------------------------------------------ clean instruments
  // soft electric-piano lead, bell plucks, warm detuned pad, round bass and gentle drums
  function synth(t, freq, dur, o) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 0.6;
    f.frequency.setValueAtTime(o.cut, t);
    if (o.cutEnd) f.frequency.exponentialRampToValueAtTime(o.cutEnd, t + (o.cutTime || 0.6));
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol, t + o.att);
    if (o.decay) g.gain.setTargetAtTime(Math.max(0.0001, o.vol * (o.sus ?? 0)), t + o.att, o.decay);
    g.gain.setTargetAtTime(0.0001, Math.max(end, t + o.att + 0.01), o.rel / 4);
    for (const [type, mult, det, lv] of o.oscs) {
      const osc = ctx.createOscillator(), og = ctx.createGain();
      osc.type = type; osc.frequency.value = freq * mult; osc.detune.value = det; og.gain.value = lv;
      osc.connect(og); og.connect(f); osc.start(t); osc.stop(end + o.rel + 0.1);
    }
    f.connect(g); g.connect(musicBus);
    if (o.verb && reverbSend) { const s = ctx.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(reverbSend); }
    if (o.echo && echo) { const s = ctx.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(echo); }
  }
  function voice(e, t, def, stepDur) {
    const d = (e.len || 1) * stepDur, I = def.inst || {}, hv = 0.85 + Math.random() * 0.3, dv = I.drumVol ?? 1;
    const f = e.midi != null ? mtof(e.midi) : 0, L = I.lead || {};
    switch (e.kind) {
      case 'lead': synth(t + Math.random() * 0.006, f, Math.max(d * 0.95, 0.12), { oscs: [['triangle', 1, -5, 0.7], ['sine', 1, 6, 0.6], ['sine', 2, 0, 0.1]], cut: 3400, cutEnd: 1300, cutTime: 0.45,
        vol: 0.1 * hv * (L.vol ? Math.min(1.6, L.vol / 0.09) : 1), att: 0.008, decay: 0.38, sus: 0.32, rel: 0.4, verb: 0.32, echo: L.echo != null ? L.echo * 0.6 : 0.1 }); break;
      case 'arp': synth(t, f, d, { oscs: [['sine', 1, 0, 0.85], ['sine', 3, 0, 0.07]], cut: 4200, vol: 0.05 * hv, att: 0.004, decay: 0.14, sus: 0, rel: 0.3, verb: 0.4, echo: 0.18 }); break;
      case 'pad': synth(t, f, d, { oscs: [['sawtooth', 1, -10, 0.3], ['sawtooth', 1, 10, 0.3], ['triangle', 0.5, 0, 0.45]], cut: 950, q: 0.4, vol: 0.022, att: 0.7, rel: 1.4, verb: 0.6 }); break;
      case 'bass': synth(t, f, Math.max(d * 0.85, 0.1), { oscs: [['sine', 1, 0, 0.95], ['triangle', 1, 0, 0.3]], cut: 650, vol: 0.2, att: 0.012, decay: 0.45, sus: 0.55, rel: 0.12 }); break;
      case 'kick': {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * dv, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
        noise(t, 0.012, { filter: 'lowpass', freq: 2500, vol: 0.05 * dv, dest: musicBus });
        break;
      }
      case 'snare': noise(t, 0.16, { filter: 'bandpass', freq: 2100, q: 0.7, vol: 0.075 * dv * hv, dest: musicBus, verb: 0.35 }); tone(t, 190, 0.03, { type: 'sine', vol: 0.05 * dv, release: 0.05, dest: musicBus }); break;
      case 'hat': noise(t, 0.02 + Math.random() * 0.02, { freq: 9000, vol: 0.022 * dv * hv, dest: musicBus }); break;
    }
  }

  let current = null, timer = null, pendingSong = null;
  function playSong(def) {
    if (!def) return stopSong();
    if (current && current.def === def) return;
    if (!ctx) { pendingSong = def; return; }
    stopSong(true);
    const song = compose(def);
    current = { def, song, step: 0, next: ctx.currentTime + 0.15 };
    // fade in
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(musicOn ? MUSIC_VOL : 0.0001, ctx.currentTime + 1.2);
    timer = setInterval(tick, 40);
    tick();
  }
  function tick() {
    if (!current || !ctx) return;
    const { song } = current;
    while (current.next < ctx.currentTime + 0.25) {
      const evs = song.byStep.get(current.step);
      if (evs && musicOn) evs.forEach(e => voice(e, current.next, song.def, song.stepDur));
      current.next += song.stepDur + (current.step % 2 === 0 ? (song.def.swing || 0) * song.stepDur : -(song.def.swing || 0) * song.stepDur);
      current.step = (current.step + 1) % song.total;
    }
  }
  function stopSong(quick) {
    pendingSong = null;
    if (timer) clearInterval(timer);
    timer = null; current = null;
  }

  function setMusic(on) {
    musicOn = on; try { localStorage.setItem('cnatt_music', on ? 'on' : 'off'); } catch (e) {}
    if (musicBus) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, ctx.currentTime, 0.1);
  }
  function setSfx(on) {
    sfxOn = on; try { localStorage.setItem('cnatt_sfx', on ? 'on' : 'off'); } catch (e) {}
    if (sfxBus) sfxBus.gain.setTargetAtTime(on ? SFX_VOL : 0, ctx.currentTime, 0.05);
  }

  let analyser = null;
  function level() {             // for testing: current output loudness 0..1
    if (!ctx) return -1;
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser); }
    const d = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(d);
    let m = 0; for (const v of d) { if (!isFinite(v)) return NaN; m = Math.max(m, Math.abs(v)); } return m;
  }
  // custom one-off sounds for games (respects the SFX mute)
  function blip(freq, dur, o = {}) { if (!ctx || !sfxOn) return; tone(now() + (o.delay || 0), freq, dur, o); }
  function hiss(dur, o = {}) { if (!ctx || !sfxOn) return; noise(now() + (o.delay || 0), dur, o); }
  return {
    init, play, level, blip, hiss, playSong, stopSong, setMusic, setSfx, compose,
    get musicOn() { return musicOn; }, get sfxOn() { return sfxOn; },
    get ready() { return !!ctx && ctx.state === 'running'; },
  };
})();

// --------------------------------------------------------------- song book
const SONGS = {
  // arcade menu: chill, warm and clean
  arcade: { seed: 12, bpm: 88, root: 57, scale: 'dorian', prog: [0, 5, 2, 6, 0, 5, 3, 4], density: 0.55, swing: 0.12,
    bass: 'x.....x...x.....', kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.',
    pad: true, arp: true, arpRate: 2, arpOct: 1, arpPattern: [0, 1, 2, 1, 2, 0], introNoLead: true, introNoDrums: true, form: ['A', 'A', 'B', 'A'],
    inst: { drumVol: 0.8 } },
  moonlit: { seed: 11, bpm: 76, root: 57, scale: 'dorian', prog: [0, 3, 5, 4, 0, 3, 1, 4], density: 0.55, swing: 0.12,
    bass: 'x.......x...o...', kick: 'x.......x.......', hat: '....x.......x..x', snare: '........x.......',
    pad: true, arp: true, arpRate: 4, arpOct: 1, introNoLead: true, introNoDrums: true,
    inst: { lead: { type: 'triangle', vol: 0.14, vib: 0.01 }, drumVol: 0.6 } },
  swamp: { seed: 23, bpm: 92, root: 55, scale: 'mixolydian', prog: [0, 0, 3, 3, 0, 0, 4, 3], density: 0.6, swing: 0.2,
    bass: 'x..x.o..x..x.o..', kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    arp: false, pad: true, inst: { lead: { type: 'sawtooth', vol: 0.06, lp: 1600, vib: 0.008 }, bass: { type: 'square', vol: 0.12, lp: 600 }, drumVol: 0.7 } },
  glacier: { seed: 31, bpm: 84, root: 62, scale: 'lydian', prog: [0, 4, 5, 3, 0, 4, 1, 3], density: 0.5,
    bass: 'x...........x...', kick: 'x.......x.......', hat: '..x...x...x...x.',
    arp: true, arpRate: 1, arpOct: 2, arpPattern: [0, 1, 2, 1, 0, 2, 1, 2], pad: true, introNoLead: true,
    inst: { lead: { type: 'triangle', vol: 0.13, verb: 0.5, echo: 0.3 }, arp: { type: 'triangle', vol: 0.03, echo: 0.2 }, drumVol: 0.45 } },
  crystal: { seed: 43, bpm: 70, root: 57, scale: 'harmonic', prog: [0, 5, 3, 4, 0, 5, 1, 4], density: 0.45,
    bass: 'x.......x.......', kick: 'x.........x.....', hat: '......x.......x.',
    arp: true, arpRate: 2, arpOct: 2, pad: true, padOct: 1, introNoLead: true, introNoDrums: true,
    inst: { lead: { type: 'sine', vol: 0.16, echo: 0.5, verb: 0.5 }, arp: { type: 'sine', vol: 0.05, echo: 0.4 }, drumVol: 0.5 } },
  abyss: { seed: 59, bpm: 66, root: 50, scale: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 5, 4], density: 0.4,
    bass: 'x...............', kick: 'x.......x..x....', snare: '............x...', hat: '..x...x...x...x.',
    pad: true, arp: true, arpRate: 4, arpOct: 1, introNoLead: true,
    inst: { lead: { type: 'square', vol: 0.06, echo: 0.5, verb: 0.5, lp: 2000, vib: 0.012 }, pad: { type: 'sawtooth', vol: 0.02, lp: 900 }, drumVol: 0.55 } },
  shop_moonlit: { seed: 101, bpm: 112, root: 65, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 4, 4], density: 0.85, swing: 0.15,
    bass: 'x...o...x...o...', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    inst: { lead: { type: 'square', vol: 0.07 }, bass: { type: 'triangle', vol: 0.2 } } },
  shop_swamp: { seed: 102, bpm: 104, root: 58, scale: 'dorian', prog: [0, 3, 0, 3, 0, 3, 4, 4], density: 0.85, swing: 0.25,
    bass: 'x..o..x.x..o..x.', kick: 'x.....x.........', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    inst: { lead: { type: 'sawtooth', vol: 0.05, lp: 2000 }, drumVol: 0.8 } },
  shop_glacier: { seed: 103, bpm: 120, root: 67, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.8,
    bass: 'x...x...x...x...', kick: 'x...x...x...x...', hat: '..x...x...x...x.', arp: true, arpRate: 1, arpOct: 2,
    inst: { lead: { type: 'triangle', vol: 0.12 }, arp: { type: 'triangle', vol: 0.025 }, drumVol: 0.6 } },
  shop_crystal: { seed: 104, bpm: 108, root: 62, scale: 'lydian', prog: [0, 1, 0, 1, 3, 4, 3, 4], density: 0.75,
    bass: 'x..x..x...x..x..', kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', arp: true, arpRate: 2, arpOct: 2,
    inst: { lead: { type: 'sine', vol: 0.15, echo: 0.3 }, arp: { type: 'sine', vol: 0.04 }, drumVol: 0.6 } },
  shop_abyss: { seed: 105, bpm: 96, root: 57, scale: 'harmonic', prog: [0, 0, 5, 4, 0, 0, 3, 4], density: 0.75,
    bass: 'x.x...x.x.x...x.', kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.',
    inst: { lead: { type: 'square', vol: 0.06, lp: 2500, echo: 0.3 }, drumVol: 0.7 } },
  secret: { seed: 777, bpm: 150, root: 64, scale: 'major', prog: [0, 4, 5, 3], density: 1.0,
    bass: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', arp: true, arpRate: 1,
    form: ['A', 'B', 'C', 'A'], inst: { lead: { type: 'square', vol: 0.08 } } },
};
