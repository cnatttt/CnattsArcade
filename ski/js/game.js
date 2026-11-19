// =====================================================================
//  POWDER PEAK - 3D freeride + slopestyle on skis or a snowboard.
//  Keys are rebindable (Controls screen). Defaults: A/D steer (air: spin) · W tuck (air: frontflip) · S brake (air: backflip)
//  hold SPACE to crouch, release to pop · F stall (rails) / butter (snow) · SHIFT K L I grabs · C camera
// =====================================================================
'use strict';
(() => {
const glc = document.getElementById('gl'), ui = document.getElementById('ui');
const R3 = createRenderer(glc);
const ctx = ui.getContext('2d');
const U = GameUI(ui), W = 1280, H = 720;
const rand = (a, b) => a + Math.random() * (b - a);
const angW = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
if (!R3) { ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H); U.txt('Your browser does not support WebGL 2.', W / 2, H / 2, 24, '#fff', 'center'); return; }

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_ski';
const JACKETS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc', '#111827'];
const PANTS = ['#1f2937', '#334155', '#1e3a8a', '#14532d', '#7c2d12', '#e5e7eb', '#a16207', '#4c1d95'];
const HELMETS = ['#f8fafc', '#111827', '#ef4444', '#3b82f6', '#facc15', '#22c55e'];
const DECKS = ['#0f172a', '#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#e5e7eb'];
let save = { best: 0, runs: 0, board: false, jacket: 5, pants: 0, helmet: 0, deck: 0, course: 0, cbest: {}, medal: {}, ch: {}, cam: 0, tips: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(save, s); } catch (e) {}
if (!(save.course >= 0 && save.course < COURSES.length)) save.course = 0;
// ---- graphics quality + dynamic resolution (drops the render scale when frames run slow, raises it back when there's headroom)
if (typeof save.gfx !== 'number') save.gfx = 1;
let dynRes = 1, frameEma = 1 / 60, resT = 0;
function applyGfx() { R3.setQuality(save.gfx); dynRes = 1; fitRes(true); }
function fitRes(force) {
  const r = glc.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const cap = [1, 1.5, 2][R3.quality] || 1, want = Math.max(0.5, Math.min(cap, (r.width * dpr) / 1280) * dynRes);
  const q = Math.round(want * 10) / 10;
  if (force || Math.abs(q * 1280 - glc.width) > 1) R3.setScale(q);
}
function resTick(dt) {
  if (window.__noRender || !dt) return;
  frameEma += (dt - frameEma) * 0.05; resT += dt;
  if (resT < 1.2) return; resT = 0;
  if (frameEma > 1 / 48 && dynRes > 0.55) { dynRes = Math.max(0.55, dynRes - 0.1); fitRes(); }
  else if (frameEma < 1 / 57 && dynRes < 1) { dynRes = Math.min(1, dynRes + 0.05); fitRes(); }
  else fitRes();
}
if (typeof save.jacket !== 'number' || save.jacket >= JACKETS.length) save.jacket = 5;
['cbest', 'medal', 'ch'].forEach(k => { if (!save[k] || typeof save[k] !== 'object') save[k] = {}; });
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const outfit = () => window.Arcade && Arcade.equipped('ski', 'outfit');
const look = () => { const o = outfit(); return { board: save.board, jacket: o ? o.jacket : JACKETS[save.jacket], pants: o ? o.pants : PANTS[save.pants] || PANTS[0], helmet: o ? o.helmet : HELMETS[save.helmet] || HELMETS[0], deck: o ? o.deck : DECKS[save.deck] || DECKS[0] }; };

// ------------------------------------------------------------ audio
SONGS.ski = { seed: 2024, bpm: 100, root: 62, scale: 'lydian', prog: [0, 4, 5, 3, 0, 4, 1, 3], density: 0.5, swing: 0.06,
  bass: 'x.....x...x.....', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x.x.x.', pad: true, arp: true, arpRate: 2, arpOct: 1, introNoLead: true, form: ['A', 'B', 'A', 'C'] };
SONGS.skiMenu = { seed: 88, bpm: 78, root: 57, scale: 'major', prog: [0, 4, 5, 3], density: 0.42, swing: 0.1, bass: 'x.......x.......', kick: 'x.......x.......', hat: '..x...x...x...x.', pad: true, arp: true, arpRate: 2, introNoDrums: true, introNoLead: true };
SONGS.skiNight = { seed: 909, bpm: 112, root: 57, scale: 'dorian', prog: [0, 5, 3, 4], density: 0.6, swing: 0.04, bass: 'x..x..x.x..x..x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', pad: true, arp: true, arpRate: 1, introNoLead: true };
const sfxRaw = {
  land(q) { Sound.hiss(0.3, { filter: 'lowpass', freq: q === 'hard' ? 700 : 1600, vol: 0.32 }); Sound.blip(q === 'hard' ? 80 : 120, 0.14, { type: 'sine', vol: 0.32, slide: 55 }); },
  trick(n) { const base = [523, 659, 784, 988, 1175]; for (let i = 0; i < Math.min(5, 2 + n); i++) Sound.blip(base[i], 0.12, { type: 'sine', vol: 0.11, delay: i * 0.055 }); },
  crash() { Sound.hiss(0.7, { filter: 'lowpass', freq: 1300, sweep: 180, vol: 0.45 }); Sound.blip(100, 0.35, { type: 'triangle', vol: 0.3, slide: 45 }); },
  pop(p) { Sound.hiss(0.1, { filter: 'bandpass', freq: 2200, q: 1.2, vol: 0.22 }); if (p) Sound.blip(880, 0.08, { type: 'sine', vol: 0.1 }); },
  token() { Sound.blip(1568, 0.07, { type: 'sine', vol: 0.11 }); Sound.blip(2093, 0.1, { type: 'sine', vol: 0.09, delay: 0.05 }); },
  rail() { Sound.blip(1900, 0.18, { type: 'triangle', vol: 0.12 }); Sound.hiss(0.12, { filter: 'highpass', freq: 5000, vol: 0.1 }); },
  medal() { [523, 659, 784, 1047].forEach((f, i) => Sound.blip(f, 0.22, { type: 'triangle', vol: 0.14, delay: i * 0.09 })); },
  challenge() { [784, 988, 1319].forEach((f, i) => Sound.blip(f, 0.16, { type: 'sine', vol: 0.13, delay: i * 0.07 })); },
};
let quiet = false, brain = null;   // quiet: simulating a CPU rider (no sounds / popups)
const sfx = new Proxy(sfxRaw, { get: (o, k) => quiet ? () => {} : o[k] });
let loops = null;
function ensureLoops() {
  if (loops || !Sound.ready || !Sound.loop) return;
  loops = { wind: Sound.loop({ filter: 'bandpass', freq: 500, q: 0.6 }), carve: Sound.loop({ filter: 'highpass', freq: 2500, q: 0.4 }), grind: Sound.loop({ filter: 'bandpass', freq: 3200, q: 6, rate: 0.6 }),
    snow: Sound.loop({ filter: 'lowpass', freq: 900, q: 0.9, rate: 0.5 }), rumble: Sound.loop({ filter: 'lowpass', freq: 140, q: 1.2, rate: 0.25 }) };
  if (!loops.wind) loops = null;
}

// ------------------------------------------------------------ rider state
const SPIN_MAX = 7.6, FLIP_MAX = 5.7;
let P = null, run = null, screen = 'title', t = 0;
const cam = { eye: [0, 10, -12], at: [0, 0, 10], fov: 1.1, dir: 0 };
let pops = [], parts = [], tracks = [], hint = null, treeGrid = new Map(), fade = 0;
let built = -1, botInput = null, myMesh = null;
function buildWorld(ci) {
  if (built === ci) return;
  buildCourse(ci); buildMeshes(R3); built = ci;
  treeGrid = new Map();
  for (const tr of W0.trees) { const k = Math.floor(tr.z / 4); if (!treeGrid.has(k)) treeGrid.set(k, []); treeGrid.get(k).push(tr); }
  myMesh = Rider.build(R3, look(), myMesh);
}
function freshRider(z) {
  const x = cx(z), y = heightAt(x, z);
  return { p: [x, y, z], v: [0, 0, 1], yaw: 0, fakie: false, ground: true, n: [0, 1, 0], upN: [0, 1, 0], air: 0, spin: 0, flip: 0, spinV: 0, flipV: 0, flipDir: 0,
    grab: null, grabK: 0, grabT: 0, grabs: [], lastGrab: null, charge: 0, queuedPop: 0, tuck: 0, lean: 0, slip: 0, squash: 0, groundT: 0, rail: null, bal: 0, balV: 0,
    crash: 0, tumble: [0, 0], tumbleV: [0, 0], safe: 0, feat: null, takeoffFakie: false, pop: 0, lastRel: -9, speedCheck: 0, spinOn: 0, maxAir: 0, pipeAir: null };
}
function newRun(ci) {
  save.course = ci; store();
  buildWorld(ci);
  W0.tokens.forEach(k => k.got = false);
  P = freshRider(C.bigair ? 4 : 10);
  run = { mode: C.bigair ? 'bigair' : 'slope', time: 0, score: 0, combo: 1, comboT: 0, tricks: [], used: {}, tokens: 0, rails: 0, drops: new Set(), maxSpeed: 0, best: null,
    crashes: 0, done: false, startT: 2.6, attempt: 0, attempts: [0, 0, 0], attemptScore: 0, landedAt: null, chNew: [], total: 0 };
  screen = 'play'; pops = []; parts = []; tracks = []; hint = null; fade = 0; rec = []; snapCam();
  Sound.playSong(C.bigair ? SONGS.skiNight : SONGS.ski);
}
// rebindable controls (Controls screen). Arrow keys always work too for steering / tuck / brake.
const ACTIONS = [
  ['left', 'Steer left  ·  spin left in the air', 'KeyA'], ['right', 'Steer right  ·  spin right in the air', 'KeyD'],
  ['up', 'Tuck for speed  ·  frontflip in the air', 'KeyW'], ['down', 'Brake / hockey stop  ·  backflip in the air', 'KeyS'],
  ['jump', 'Crouch (hold) and pop (let go)', 'Space'], ['stall', 'Stall on rails & boxes  ·  butter on the snow', 'KeyF'],
  ['g1', 'Grab 1', 'ShiftLeft'], ['g2', 'Grab 2', 'KeyK'], ['g3', 'Grab 3', 'KeyL'], ['g4', 'Grab 4', 'KeyI'], ['cam', 'Change camera', 'KeyC'],
  ['replay', 'Instant replay', 'KeyP'],
];
const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(a => [a[0], a[2]]));
const KB = () => Object.assign({}, DEFAULT_KEYS, save.keys || {});
function keyName(code) {
  if (!code) return '—';
  const map = { Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: 'ENTER', Tab: 'TAB', CapsLock: 'CAPS', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
  return map[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase();
}
const KN = a => keyName(KB()[a]);
function input() {
  if (brain) return brain(P);
  if (botInput) return botInput(P);
  const k = U.keys, B = KB(), d = a => !!k[B[a]];
  return { left: d('left') || !!k.ArrowLeft, right: d('right') || !!k.ArrowRight, up: d('up') || !!k.ArrowUp, down: d('down') || !!k.ArrowDown, jump: d('jump'), stall: d('stall'),
    g1: d('g1'), g2: d('g2'), g3: d('g3'), g4: d('g4') };
}
const GRAB_KEYS = () => save.board ? ['indy', 'melon', 'tail', 'nose'] : ['mute', 'safety', 'tail', 'japan'];
const GRAB_NAME = { indy: 'Indy', melon: 'Melon', tail: 'Tail Grab', nose: 'Nose Grab', mute: 'Mute', safety: 'Safety', japan: 'Japan' };

// ------------------------------------------------------------ scoring
const SPIN_PTS = { 0: 0, 180: 120, 360: 300, 540: 520, 720: 800, 900: 1150, 1080: 1550, 1260: 2000, 1440: 2500 };
const spinPts = d => SPIN_PTS[d] !== undefined ? SPIN_PTS[d] : 2500 + (d - 1440) / 180 * 550;
const flipPts = f => [0, 650, 1700, 3200, 5000][Math.min(4, f)];
function trickName(spinDeg, flips, grabs, fk) {
  const g = [...new Set(grabs.map(x => GRAB_NAME[x.type]))];
  const tweak = grabs.some(x => x.t > 0.9);
  let s = fk ? 'Switch ' : '';
  const mult = flips >= 4 ? 'Quad ' : flips === 3 ? 'Triple ' : flips === 2 ? 'Double ' : '';
  if (flips >= 1 && spinDeg >= 360) s += mult + 'Cork ' + spinDeg;
  else if (flips >= 1) s += mult + (P.flipDir > 0 ? 'Frontflip' : 'Backflip') + (spinDeg ? ' ' + spinDeg : '');
  else if (spinDeg >= 180) s += spinDeg;
  if (g.length) {
    const solo = !spinDeg && !flips && g.length === 1 && !g[0].includes('Grab');
    s += ' ' + (tweak ? 'Tweaked ' : '') + g.join(' to ') + (solo ? ' Grab' : '');
  }
  return s.replace(/\s+/g, ' ').trim();
}
function award(name, pts, quality, key) {
  const used = run.used[key] || 0; run.used[key] = used + 1;
  const vary = Math.max(0.4, 1 - used * 0.3);
  const qm = { perfect: 1.25, clean: 1, sketchy: 0.6, hard: 0.75 }[quality] || 1;
  const gained = Math.round(pts * vary * qm * run.combo / 10) * 10;
  run.score += gained; run.attemptScore += gained;
  run.tricks.push({ name, pts: gained });
  if (!run.best || gained > run.best.pts) run.best = { name, pts: gained };
  if (quiet) { run.combo = Math.min(10, run.combo + 1); run.comboT = 3.2; return gained; }
  const qText = { perfect: 'PERFECT', clean: 'CLEAN', sketchy: 'SKETCHY', hard: 'HARD LANDING' }[quality] || '';
  const qCol = { perfect: '#4ade80', clean: '#e2e8f0', sketchy: '#fbbf24', hard: '#fb923c' }[quality] || '#e2e8f0';
  pops.push({ text: name, sub: `+${gained.toLocaleString()}${run.combo > 1 ? `  (×${run.combo})` : ''}`, q: qText, qCol, rep: used ? `repeat −${Math.round((1 - vary) * 100)}%` : '', t: 0, big: gained >= 1500 });
  sfx.trick(Math.min(3, Math.floor(gained / 800)));
  run.combo = Math.min(10, run.combo + 1); run.comboT = 3.2;
  checkCh('trick', gained);
  return gained;
}
function checkCh(type, val) {
  if (quiet) return;
  (C.ch || []).forEach(([ty, target, text], i) => {
    const key = C.id + ':' + i;
    if (ty !== type || val < target || save.ch[key]) return;
    save.ch[key] = true; store(); run.chNew.push(text);
    pops.push({ text: 'CHALLENGE COMPLETE', sub: text, q: '', qCol: '#4ade80', t: 0, ch: true, col: '#4ade80' }); sfx.challenge();
  });
}
function popMsg(text, col = '#f87171', sub = '') { if (quiet) return; pops.push({ text, sub, q: '', qCol: col, t: 0, col }); }

// ------------------------------------------------------------ physics
function featUnder(x, z) { for (const f of W0.jumps) if (z > f.z0 - 2 && z < f.z1 && Math.abs(x - f.x) < f.w / 2 + 3) return f; return null; }
function crash(reason) {
  if (P.crash > 0) return;
  P.crash = 2.0; P.rail = null; P.butter = null; P.wind = 0; P.grab = null; P.grabK = 0; P.charge = 0; P.queuedPop = 0;
  P.tumbleV = [rand(5, 9) * (Math.random() < 0.5 ? -1 : 1), rand(3, 7) * (Math.random() < 0.5 ? -1 : 1)];
  run.combo = 1; run.comboT = 0; run.crashes++;
  sfx.crash(); popMsg(reason || 'BAIL!');
  puffBurst(16, 1.0, 3, 1.8, 1.8);
  for (let i = 0; i < 50; i++) parts.push([P.p[0], P.p[1] + 0.6, P.p[2], rand(-4, 4) + P.v[0] * 0.3, rand(1, 6), rand(-2, 4) + P.v[2] * 0.3, rand(0.7, 1.3), rand(0.25, 0.6), 0]);
}
function takeoff(kind) {
  P.ground = false; P.air = 0; P.spin = 0; P.flip = 0; P.spinV = 0; P.flipV = 0; P.flipDir = 0; P.grabs = []; P.grab = null; P.grabT = 0;
  P.takeoffFakie = P.fakie; P.feat = featUnder(P.p[0], P.p[2]); P.pop = 0; P.maxAir = 0;
  if (kind !== 'rail') P.spinOn = 0;
  if (P.butter) { const bs = P.butter.spinV; P.butter = null; P.spin = 0; P.spinV = bs; }
  if (P.wind && kind !== 'rail' && kind !== 'fall') { P.spinV += P.wind * 5.2; P.wind = 0; }
  const pipe = inPipe(P.p[0], P.p[2]);
  if (pipe && Math.abs(P.p[0] - pipe.x) > PIPE.floor + 2.5) { P.pipeAir = pipe; P.v[0] = -Math.sign(P.p[0] - pipe.x) * 0.9; P.yaw = 0; }
  else P.pipeAir = null;
  // pop: a charged release on the lip gives extra height
  const n = P.n, pq = P.queuedPop || (kind === 'natural' && P.charge > 0.2 ? P.charge * 0.7 : 0);
  if (kind === 'natural' && pq > 0) {
    const perfect = !!P.queuedPop && t - P.lastRel < 0.32;
    const k = 1.6 + pq * 2.6 + (perfect ? 0.8 : 0);
    P.v = v3.add(P.v, v3.mul(n, k)); P.pop = perfect ? 2 : 1; sfx.pop(perfect);
    if (perfect) popMsg('PERFECT POP', '#7dd3fc');
  }
  P.queuedPop = 0; P.charge = 0;
}
function groundStep(dt, I) {
  const n = normalAt(P.p[0], P.p[2]); P.n = n;
  // gravity along the surface
  const gk = GRAV * n[1];
  P.v[0] += gk * n[0] * dt; P.v[1] += (-GRAV + gk * n[1]) * dt; P.v[2] += gk * n[2] * dt;
  const sp = v3.len(P.v);
  const steer = (I.left ? 1 : 0) - (I.right ? 1 : 0);
  // butters: hold stall on the snow to press onto the nose (tuck) or tail (brake) and spin on it
  if (I.stall && !P.butter && sp > 2 && P.groundT > 0.15) { P.butter = { k: I.down ? -1 : 1, t: 0, spinV: 0 }; P.spin = 0; }
  if (P.butter) {
    const B = P.butter; B.t += dt;
    if (I.down) B.k = -1; else if (I.up) B.k = 1;
    B.spinV += (steer * 4.6 - B.spinV) * Math.min(1, dt * 7);
    P.spin += B.spinV * dt;
    if (!steer && Math.abs(B.spinV) < 1.6) { const q = Math.round(P.spin / Math.PI) * Math.PI; P.spin += clamp(q - P.spin, -3.2 * dt, 3.2 * dt); }
    if (!I.stall) endButter();
  }
  // carving: the turn builds up smoothly; at speed the turn widens; braking lets you pivot harder
  const rate = (I.down ? 2.6 : 2.05) + 1.7 / (1 + sp * 0.11);
  const target = P.butter ? 0 : steer * rate;
  P.yawV = (P.yawV || 0) + (target - (P.yawV || 0)) * Math.min(1, dt * (steer ? 8 : 11));
  P.yaw += P.yawV * dt;
  P.lean += (clamp(P.yawV * Math.max(3, sp) / 24, -1, 1) * (P.butter ? 0.2 : 1) - P.lean) * Math.min(1, dt * 7);
  // hockey stop: the rider swings sideways to the hill and sprays snow
  P.skidA = (P.skidA || 0) + (((I.down && sp > 5 && !P.butter) ? (Math.sign(P.yawV) || (P.fakie ? -1 : 1)) * 1.15 : 0) - (P.skidA || 0)) * Math.min(1, dt * 8);
  // winding up a spin while crouching
  if (I.jump && steer) P.wind = clamp((P.wind || 0) + steer * dt * 2.4, -1, 1); else if (!I.jump) P.wind = (P.wind || 0) * Math.exp(-dt * 4);
  let F = [Math.sin(P.yaw), 0, Math.cos(P.yaw)]; F = v3.norm(v3.sub(F, v3.mul(n, v3.dot(F, n))));
  let S = v3.cross(n, F);
  let vf = v3.dot(P.v, F), vs = v3.dot(P.v, S);
  if (vf < -1.2) { P.yaw += Math.PI; P.fakie = !P.fakie; F = v3.mul(F, -1); S = v3.mul(S, -1); vf = -vf; vs = -vs; }
  // edges bite: sideways speed bleeds off (skidding when braking)
  const grip = I.down ? 2.6 : P.butter ? 5 : 7.5;
  P.slip = Math.abs(vs);
  vs *= Math.exp(-grip * dt);
  // snow spray off the edges when carving hard, skidding or stopping
  const spray = clamp((Math.abs(P.yawV) * sp - 14) / 30, 0, 1) + (I.down ? clamp(sp / 18, 0, 1) : 0) + clamp((P.slip - 2) / 6, 0, 1);
  if (!quiet && spray > 0.05 && Math.random() < spray * 1.4) {
    const side = Math.sign(P.yawV) || 1, out = v3.mul(S, -side);
    for (let i = 0; i < 2; i++) parts.push([P.p[0] + rand(-0.3, 0.3), P.p[1] + 0.08, P.p[2] + rand(-0.3, 0.3), out[0] * rand(2, 5) + P.v[0] * 0.5, rand(1, 3.2), out[2] * rand(2, 5) + P.v[2] * 0.5, rand(0.45, 0.8), rand(0.18, 0.4), 0]);
  }
  P.tuck += (((I.up && !I.down) ? 1 : 0) - P.tuck) * Math.min(1, dt * 6);
  const drag = 0.0045 - 0.0021 * P.tuck;
  const dec = 0.045 * GRAV * n[1] + drag * vf * vf + (I.down ? 8.5 : 0) + P.slip * 0.25 + (P.butter ? 1.2 : 0);
  vf = vf > 0 ? Math.max(0, vf - dec * dt) : vf * Math.exp(-dt * 3);
  // speed check on park jump in-runs so the landings work
  P.speedCheck = 0;
  for (const f of W0.jumps) {
    if (f.kind !== 'jump' || P.p[2] < f.z0 - 26 || P.p[2] > f.lipZ - 0.5 || Math.abs(P.p[0] - f.x) > f.w / 2 + 1.5) continue;
    const lipY = f.lipY + (baseH(P.p[0], P.p[2]) - profZ(P.p[2])), vt = Math.sqrt(f.vd * f.vd + 2 * GRAV * Math.max(0, lipY - P.p[1]));
    const lo = vt * 0.97, hi = vt * 1.04;
    if (vf > hi) { vf -= Math.min(vf - hi, 9 * dt); P.speedCheck = -1; } else if (vf < lo) { vf += Math.min(lo - vf, (P.p[2] > f.z0 ? 13 : 5.5) * dt); P.speedCheck = 1; }
  }
  // pumping the pipe walls keeps your speed up
  const pp = W0.pipe;
  if (pp && P.p[2] > pp.z0 + 10 && P.p[2] < pp.z1 - 10 && Math.abs(P.p[0] - pp.x) > PIPE.floor - 0.5 && P.v[1] > 0.5) vf += 4.8 * dt;
  P.v = v3.add(v3.mul(F, vf), v3.mul(S, vs));
  // crouch / pop
  if (I.jump) P.charge = Math.min(1, P.charge + dt * 2.2);
  else if (P.charge > 0.08) {
    // released on a jump's take-off: save it for the lip
    const f = featUnder(P.p[0], P.p[2]);
    P.lastRel = t;
    if (f && f.kind === 'jump' && P.p[2] < f.lipZ && f.lipZ - P.p[2] < 7) { P.queuedPop = P.charge; P.charge = 0; }
    else { const k = 3.2 + P.charge * 3.6; P.v = v3.add(P.v, v3.mul(n, k)); P.p[1] += 0.02; takeoff('ollie'); sfx.pop(false); return; }
  } else P.charge = 0;
  // move + stick to the snow (or leave it when it falls away faster than gravity)
  P.p = v3.add(P.p, v3.mul(P.v, dt));
  const h = heightAt(P.p[0], P.p[2]), d = P.p[1] - h, n2 = normalAt(P.p[0], P.p[2]);
  // leave the snow when it falls away faster than gravity could follow it (lips, knuckles, rollers)
  const spd0 = v3.len(P.v);
  if (spd0 > 3 && d > -0.03) {
    const tau = Math.min(0.04, 0.45 / spd0), yb = P.p[1] + P.v[1] * tau - 0.5 * GRAV * tau * tau;
    const ys = heightAt(P.p[0] + P.v[0] * tau, P.p[2] + P.v[2] * tau);
    if (ys < yb - 0.004) { if (d > 0) P.p[1] = Math.max(h, P.p[1]); takeoff('natural'); return; }
  }
  P.p[1] = h;
  const vn = v3.dot(P.v, n2), spd = v3.len(P.v);
  P.v = v3.sub(P.v, v3.mul(n2, vn));
  if (d > 0) P.v = v3.mul(v3.norm(P.v), spd);
  P.groundT += dt;
  if (P.squash > 0) P.squash = Math.max(0, P.squash - dt * 3);
}
function airStep(dt, I) {
  P.air += dt;
  P.v[1] -= GRAV * dt;
  const sp = v3.len(P.v); P.v = v3.mul(P.v, 1 - 0.0009 * sp * dt);
  if (P.pipeAir) P.v[0] *= Math.exp(-dt * 1.5);
  const steer = (I.left ? 1 : 0) - (I.right ? 1 : 0), fl = (I.up ? 1 : 0) - (I.down ? 1 : 0);
  if (steer) P.spinV += clamp(steer * SPIN_MAX - P.spinV, -30 * dt, 30 * dt); else P.spinV += clamp(-P.spinV, -42 * dt, 42 * dt);
  if (fl) { P.flipV += clamp(fl * FLIP_MAX - P.flipV, -26 * dt, 26 * dt); P.flipDir = fl; } else P.flipV += clamp(-P.flipV, -34 * dt, 34 * dt);
  P.spin += P.spinV * dt; P.flip += P.flipV * dt;
  // let go and the rider settles into the nearest clean landing position
  if (!steer && Math.abs(P.spinV) < 1.5) { const tgt = Math.round(P.spin / Math.PI) * Math.PI, e = tgt - P.spin; if (Math.abs(e) < 0.9) P.spin += clamp(e, -2.6 * dt, 2.6 * dt); }
  if (!fl && Math.abs(P.flipV) < 1.5) { const tgt = Math.round(P.flip / (Math.PI * 2)) * Math.PI * 2, e = tgt - P.flip; if (Math.abs(e) < 1.1) P.flip += clamp(e, -2.6 * dt, 2.6 * dt); }
  // grabs
  const gk = GRAB_KEYS(), want = I.g1 ? gk[0] : I.g2 ? gk[1] : I.g3 ? gk[2] : I.g4 ? gk[3] : null;
  if (want && want !== P.grab) { if (P.grab && P.grabT > 0.15) P.grabs.push({ type: P.grab, t: P.grabT }); P.grab = want; P.grabT = 0; }
  if (!want && P.grab) { if (P.grabT > 0.15) P.grabs.push({ type: P.grab, t: P.grabT }); P.grab = null; }
  if (P.grab) { P.grabT += dt; P.grabK = Math.min(1, P.grabK + dt * 7); } else P.grabK = Math.max(0, P.grabK - dt * 7);
  P.upN = v3.norm(v3.lerp(P.upN, [0, 1, 0], Math.min(1, dt * 2)));
  P.p = v3.add(P.p, v3.mul(P.v, dt));
  if (tryRail()) return;
  const h = heightAt(P.p[0], P.p[2]);
  P.maxAir = Math.max(P.maxAir, P.p[1] - h);
  if (P.p[1] <= h && P.air > 0.04) { P.p[1] = h; land(); }
}
function land() {
  const n = normalAt(P.p[0], P.p[2]);
  const yawR = P.yaw + (P.fakie ? Math.PI : 0) + P.spin, sf = Math.sin(P.flip), cf = Math.cos(P.flip);
  const Up = [Math.sin(yawR) * sf, cf, Math.cos(yawR) * sf], Bf = [Math.sin(yawR) * cf, -sf, Math.cos(yawR) * cf];
  const pipe = !!P.pipeAir;
  const upDot = pipe ? Up[1] : v3.dot(Up, n);
  let travel = pipe ? v3.norm([P.v[0] * 0.3, 0, P.v[2]]) : v3.norm(v3.sub(P.v, v3.mul(n, v3.dot(P.v, n))));
  const Bp = pipe ? v3.norm([Bf[0], 0, Bf[2]]) : v3.norm(v3.sub(Bf, v3.mul(n, v3.dot(Bf, n))));
  if (pipe && Math.abs(P.v[2]) < 1) travel = [0, 0, 1];
  const ang = Math.acos(clamp(v3.dot(Bp, travel), -1, 1)), sw = ang > Math.PI / 2, err = sw ? Math.PI - ang : ang;
  const impact = pipe ? Math.max(0, -P.v[1] * 0.35) : -v3.dot(P.v, n);
  const holdingGrab = P.grab && P.grabK > 0.6;
  if (P.grab && P.grabT > 0.15) P.grabs.push({ type: P.grab, t: P.grabT });
  P.grab = null;
  const spinDeg = Math.round(Math.abs(P.spin) / Math.PI) * 180, flips = Math.round(Math.abs(P.flip) / (Math.PI * 2));
  // ground the rider
  P.ground = true; P.groundT = 0; P.n = n;
  P.v = v3.sub(P.v, v3.mul(n, v3.dot(P.v, n)));
  if (pipe) { const s = v3.len(P.v); P.v = v3.mul(v3.norm([P.v[0], P.v[1], Math.max(Math.abs(P.v[2]), 2)]), s); }
  if (upDot < 0.5 || err > 64 * D2R) { P.spin = P.flip = 0; P.pipeAir = null; crash(upDot < 0.5 ? (flips || Math.abs(P.flip) > 1 ? 'OVER-ROTATED' : 'UNDER-ROTATED') : 'CAUGHT AN EDGE'); return; }
  if (impact > 22) { P.spin = P.flip = 0; P.pipeAir = null; crash('FLAT LANDING'); return; }
  const loss = clamp((impact - 7) / 35, 0, 0.45) + (err > 35 * D2R ? 0.18 : 0);
  P.v = v3.mul(P.v, 1 - loss);
  let quality = err < 13 * D2R && upDot > 0.96 ? 'perfect' : err < 34 * D2R ? 'clean' : 'sketchy';
  if (impact > 13 && quality !== 'sketchy') quality = 'hard';
  if (holdingGrab && quality === 'perfect') quality = 'clean';
  // new heading = where we're going; landing backwards = switch
  const tv = v3.len(P.v) > 0.5 ? v3.norm(P.v) : travel;
  P.yaw = Math.atan2(tv[0], tv[2]);
  P.fakie = sw; P.spin = 0; P.flip = 0; P.squash = clamp(impact / 14, 0.25, 1);
  sfx.land(quality === 'hard' ? 'hard' : 'ok');
  if (quality === 'perfect') flash(0.09, [1, 0.95, 0.82]);
  cam.shake = Math.max(cam.shake || 0, clamp((impact - 6) / 14, 0, 1) * 0.35);
  if (!P.rail) puffBurst(Math.round(6 + Math.min(impact, 16) * 0.6), 0.75, 1.6 + Math.min(impact, 16) * 0.12, 0.9, 1.3);
  for (let i = 0; i < 26; i++) parts.push([P.p[0] + rand(-0.4, 0.4), P.p[1] + 0.1, P.p[2] + rand(-0.4, 0.4), rand(-3, 3) + P.v[0] * 0.25, rand(1, 3.6), rand(-1.5, 2) + P.v[2] * 0.25, rand(0.5, 0.9), rand(0.2, 0.5), 0]);
  // score
  const gp = P.grabs.reduce((a, g) => a + 120 + Math.min(g.t, 2) * 260 + (g.t > 0.9 ? 150 : 0), 0);
  let pts = spinPts(spinDeg) + flipPts(flips) + gp + (P.air > 0.6 ? P.air * 70 : 0) + (P.pop === 2 ? 150 : P.pop ? 50 : 0);
  if (flips >= 1 && spinDeg >= 360) pts *= 1.25;
  if (pipe) pts = pts * 1.15 + Math.max(0, P.maxAir || 0) * 60;
  const isTrick = spinDeg >= 180 || flips >= 1 || P.grabs.length;
  if (P.feat && P.feat.kind === 'drop' && P.air > 0.7) { run.drops.add(P.feat); checkCh('drops', run.drops.size); }
  if (isTrick) {
    const name = trickName(spinDeg, flips, P.grabs, P.takeoffFakie);
    award(name, pts, quality, name);
    checkCh('spin', spinDeg); checkCh('flip', flips); checkCh('flips', flips); if (flips >= 1 && spinDeg >= 360) checkCh('cork', 1);
  } else if (P.air > 1.1) {
    const drop = P.feat && P.feat.kind === 'drop';
    award(drop ? 'Cliff Drop' : pipe ? 'Pipe Air' : 'Big Air', P.air * 90 + (drop ? 150 : 0) + (pipe ? (P.maxAir || 0) * 60 : 0), quality, 'air' + (P.feat ? W0.feats.indexOf(P.feat) : pipe ? 'pipe' : ''));
  }
  P.grabs = []; P.pipeAir = null; P.feat = null; P.maxAir = 0;
  if (run.mode === 'bigair' && P.air > 0.8) run.landedAt = t;
}
function endButter() {
  const B = P.butter; if (!B) return; P.butter = null;
  const q = Math.round(P.spin / Math.PI), err = Math.abs(P.spin - q * Math.PI), deg = Math.abs(q) * 180;
  P.spin = 0;
  if (err > 0.95) { crash('CAUGHT AN EDGE'); return; }
  if (q % 2) { P.fakie = !P.fakie; }
  if (B.t < 0.35 && !deg) return;
  const nm = (B.k > 0 ? 'Nose ' : 'Tail ') + (deg ? 'Butter ' + deg : 'Press');
  award(nm, 140 + deg * 1.1 + Math.min(2, B.t) * 120, err < 0.3 ? 'perfect' : 'clean', nm);
  checkCh('butter', deg || 1);
}
// ------------------------------------------------------------ rails
function railY(r, z) { const p = r.pts; for (let i = 0; i < p.length - 1; i++) if (z <= p[i + 1][2] || i === p.length - 2) { const k = (z - p[i][2]) / (p[i + 1][2] - p[i][2]); return [p[i][1] + (p[i + 1][1] - p[i][1]) * k, (p[i + 1][1] - p[i][1]) / (p[i + 1][2] - p[i][2])]; } return [p[0][1], 0]; }
function tryRail() {
  if (P.crash > 0 || (P.railCd || 0) > t) return false;
  for (const r of W0.rails) {
    const z0 = r.pts[0][2], z1 = r.pts[r.pts.length - 1][2];
    if (P.p[2] < z0 || P.p[2] > z1 - 1.5 || Math.abs(P.p[0] - r.x) > r.width + 0.42) continue;
    const [ry] = railY(r, P.p[2]), dy = P.p[1] - ry;
    if (dy < -0.45 || dy > 0.5 || P.v[1] > 2.5) continue;
    // lock on
    const yawR = angW(P.yaw + (P.fakie ? Math.PI : 0) + P.spin);
    const a = Math.abs(yawR), side = a > 50 * D2R && a < 130 * D2R;
    P.spinOn = P.ground ? 0 : Math.round(Math.abs(P.spin) / (Math.PI / 2)) * 90;
    P.rail = r; P.railT = 0; P.stallT = 0; P.stallDone = false; P.stallResumed = false; P.railSide = side ? Math.sign(yawR) : 0; P.fakie = side ? P.fakie : a > 90 * D2R;
    P.railSpeed = Math.max(5, Math.abs(P.v[2])); P.yaw = 0; P.spin = 0; P.flip = 0; P.ground = false; P.grab = null; P.grabK = 0; P.charge = 0;
    P.bal = (Math.random() - 0.5) * 0.15; P.balV = (Math.random() - 0.5) * 0.4;
    P.p[0] = r.x; P.p[1] = ry; sfx.rail();
    return true;
  }
  return false;
}
function railStep(dt, I) {
  const r = P.rail, [, slope] = railY(r, P.p[2]);
  P.railT += dt;
  const sl = Math.atan(slope);
  if (!(P.stallT > 0 && !P.stallDone)) { P.railSpeed += (-GRAV * Math.sin(sl) - (r.kind === 'log' ? 1.6 : 0.9)) * dt; P.railSpeed = Math.max(3.5, P.railSpeed); }
  P.p[2] += P.railSpeed * Math.cos(sl) * dt; P.p[0] = r.x;
  const [ry2, slope2] = railY(r, P.p[2]); P.p[1] = ry2;
  const vz = P.railSpeed * Math.cos(Math.atan(slope2));
  P.v = [0, slope2 * vz, vz];
  // balance: it drifts more the longer you stay on; steer to keep it centred
  const steer = (I.left ? 1 : 0) - (I.right ? 1 : 0);
  // stall: hold the stall key to stop dead on the feature, let go (or after 2 s) to slide on
  if (I.stall && !P.stallDone && P.railT > 0.08) {
    if (!P.stallT) { P.stallT = 0.0001; P.stallFrom = P.railSpeed; P.stallKind = P.railT < 0.45 ? 'Nose Stall' : (r.pts[r.pts.length - 1][2] - P.p[2] < 3 ? 'Tail Stall' : 'Stall'); sfx.rail(); }
    P.stallT += dt; P.railSpeed = Math.max(0, P.railSpeed - Math.max(P.railSpeed * 9, 6) * dt);
    if (P.stallT > 2) P.stallDone = true;
  } else if (P.stallT > 0 && !P.stallDone) P.stallDone = true;
  if (P.stallDone && P.stallT > 0 && !P.stallResumed) { P.stallResumed = true; P.railSpeed = Math.max(4.5, P.stallFrom * 0.7); }
  const stalling = P.stallT > 0 && !P.stallDone;
  P.balV += ((Math.random() - 0.5) * 3.2 * (1 + P.railT * 0.45) * (stalling ? 0.35 : 1) + P.bal * 2.2 - steer * 4.2) * dt;
  P.balV *= Math.exp(-dt * 1.2);
  P.bal += P.balV * dt;
  if (Math.random() < 0.5) parts.push([P.p[0], P.p[1], P.p[2], rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1, 0.5), 0.35, 0.12, r.kind === 'log' ? 0 : 1]);
  const z1 = r.pts[r.pts.length - 1][2];
  const jumpOff = !I.jump && P.charge > 0.08;
  if (I.jump) P.charge = Math.min(1, P.charge + dt * 2.2);
  if (Math.abs(P.bal) > 1) {
    P.rail = null; P.railCd = t + 0.6; run.combo = 1; run.comboT = 0; P.stallT = 0; P.stallDone = false; P.stallResumed = false;
    P.v = [Math.sign(P.bal) * -2.2, 1.5, P.railSpeed * 0.7]; P.charge = 0; takeoff('fall'); popMsg('LOST BALANCE', '#fbbf24');
    return;
  }
  if (P.p[2] >= z1 || jumpOff) {
    const kind = r.kind, st = P.stallT > 0.25 ? P.stallKind : '';
    const nm = (P.spinOn ? P.spinOn + ' on ' : '') + (st && st !== 'Stall' ? st + ' to ' : '') + (P.railSide ? (save.board ? 'Boardslide' : 'Rail Slide') : (P.fakie ? 'Switch 50-50' : '50-50')) + (st === 'Stall' ? ' Stall' : '') + (kind === 'kink' ? ' Kink' : kind === 'log' ? ' Log' : kind === 'box' ? ' Box' : kind === 'ledge' ? ' Ledge' : '');
    const pts = 220 + P.railT * 380 + (kind === 'kink' ? 350 : 0) + (P.spinOn ? P.spinOn * 1.6 : 0) + (P.p[2] >= z1 ? 150 : 0) + (st ? 250 + Math.min(2, P.stallT) * 350 : 0);
    if (st) checkCh('stall', 1);
    P.stallT = 0; P.stallDone = false; P.stallResumed = false;
    const balOK = Math.abs(P.bal) < 0.35 ? 'perfect' : 'clean';
    const side = P.railSide;
    P.rail = null; P.railCd = t + 0.35; run.rails++; checkCh('rails', run.rails);
    const ex = jumpOff ? 3.2 + P.charge * 2.5 : 0.6;
    P.v = [0, slope2 * vz + ex, vz];
    award(nm, pts, balOK, nm);
    takeoff('rail'); P.spin = side ? side * Math.PI / 2 : 0; P.spinOn = 0;
    if (jumpOff) sfx.pop(false);
  }
}

function crashStep(dt) {
  P.crash -= dt;
  P.tumble[0] += P.tumbleV[0] * dt; P.tumble[1] += P.tumbleV[1] * dt;
  const h = heightAt(P.p[0], P.p[2]);
  if (P.p[1] > h + 0.05) { P.v[1] -= GRAV * dt; }
  else { P.p[1] = h; const n = normalAt(P.p[0], P.p[2]); const vn = v3.dot(P.v, n); if (vn < 0) P.v = v3.sub(P.v, v3.mul(n, vn * 1.3)); P.v = v3.mul(P.v, Math.exp(-dt * 2.4)); P.tumbleV = P.tumbleV.map(v => v * Math.exp(-dt * 2.2)); }
  P.p = v3.add(P.p, v3.mul(P.v, dt));
  if (P.p[1] < heightAt(P.p[0], P.p[2])) P.p[1] = heightAt(P.p[0], P.p[2]);
  if (P.crash <= 0) {
    if (run.mode === 'bigair') { nextAttempt(); return; }
    // back on your feet, pointing downhill
    let x = P.p[0], z = P.p[2];
    if (blocked(x, z) || Math.abs(x - cx(z)) > 150) { x = cx(z); z += 2; }
    const f = featUnder(x, z); if (f && z > f.z0 - 2 && z < f.knuckleZ + 2) z = f.knuckleZ + 4;
    const keep = Object.assign(freshRider(z), { p: [x, heightAt(x, z), z] });
    keep.v = [0, 0, 5]; keep.safe = 1.5;
    P = keep; if (!quiet) snapCam(true);
  }
}
function blocked(x, z) {
  const k = Math.floor(z / 4);
  for (let j = k - 1; j <= k + 1; j++) for (const tr of treeGrid.get(j) || []) if (Math.hypot(tr.x - x, tr.z - z) < 2.5 * tr.s) return true;
  return false;
}
function obstacles() {
  if (P.safe > 0 || P.crash > 0) return;
  const k = Math.floor(P.p[2] / 4), x = P.p[0], z = P.p[2];
  for (let j = k - 1; j <= k + 1; j++) for (const tr of treeGrid.get(j) || []) {
    const d = Math.hypot(tr.x - x, tr.z - z), above = P.p[1] - tr.y;
    if (above < 8.5 * tr.s && d < (tr.kind ? 0.5 : 0.55 + 0.9 * clamp(1 - above / (8 * tr.s), 0, 1)) * tr.s + 0.25) { crash('TREE!'); P.v = v3.mul(P.v, -0.15); return; }
  }
  for (const rk of W0.rocks) if (Math.abs(rk.z - z) < 4 && Math.hypot(rk.x - x, rk.z - z) < rk.s * 0.9 && P.p[1] < rk.y + rk.s * 1.1) { crash('ROCK!'); P.v = v3.mul(P.v, -0.1); return; }
  for (const L of W0.lift) if (Math.abs(L[2] - z) < 1.5 && Math.abs(L[0] - x) < 0.9) { crash('LIFT TOWER!'); P.v = v3.mul(P.v, -0.1); return; }
}
function riderPhys(dt) {
  const I = input();
  P.safe = Math.max(0, P.safe - dt);
  if (P.crash > 0) { crashStep(dt); return; }
  if (P.rail) railStep(dt, I);
  else if (P.ground) { groundStep(dt, I); if (P.ground && !P.rail) tryRailGround(); }
  else airStep(dt, I);
  obstacles();
  if (P.ground && !P.rail && run.combo > 1) { run.comboT -= dt; if (run.comboT <= 0) run.combo = 1; }
  const kmh = v3.len(P.v) * 3.6; if (kmh > run.maxSpeed) { run.maxSpeed = kmh; checkCh('speed', kmh); }
  if (Math.abs(P.p[0] - cx(P.p[2])) > 185 && P.crash <= 0) crash('OUT OF BOUNDS');
}
function step(dt) {
  if (!P || !run || screen !== 'play') return;
  if (run.startT > 0) { run.startT -= dt; P.v = [0, 0, 0.5]; P.p[1] = heightAt(P.p[0], P.p[2]); return; }
  if (!run.done) run.time += dt;
  run.raceT = (run.raceT || 0) + dt;
  riderPhys(dt);
  if (run.mode !== 'race') for (const k of W0.tokens) { if (k.got || Math.abs(k.z - P.p[2]) > 2) continue; if (Math.hypot(k.x - P.p[0], k.y - (P.p[1] + 0.9), k.z - P.p[2]) < 1.9) { k.got = true; run.tokens++; run.score += 25 * run.combo; run.attemptScore += 25; sfx.token(); checkCh('tokens', run.tokens); } }
  if (run.mode === 'race' && run.gate) gateCheck(P, run.gate, true);
  if ((run.mode === 'slope' || run.mode === 'race') && !run.done && P.p[2] >= C.len) finishRun();
  if (run.done && P.ground) { const sp = v3.len(P.v); if (sp > 0.5) P.v = v3.mul(P.v, Math.max(0, sp - 9 * dt) / sp); }
  if (run.mode === 'bigair' && !run.done) {
    if (run.landedAt && t - run.landedAt > 1.8) nextAttempt();
    else if (P.ground && P.p[2] > W0.jumps[0].z1 + 30) nextAttempt();
  }
  // CPU riders in a ranked heat
  if (run.heat) for (const o of run.heat.riders) if (o.cpu && !o.fin) {
    const sp = P, sr = run; P = o.P; run = o.run; quiet = true; brain = o.brain;
    try { riderPhys(dt); o.P = P; } finally { P = sp; run = sr; quiet = false; brain = null; }
    if (o.gate) gateCheck(o.P, o.gate, false);
    if (o.P.p[2] >= C.len) { o.fin = true; o.finT = run.raceT; }
  }
}
function tryRailGround() {
  // rolling off an on-ramp straight onto the rail
  for (const r of W0.rails) {
    const z0 = r.pts[0][2];
    if (Math.abs(P.p[2] - z0) < 0.6 && Math.abs(P.p[0] - r.x) < r.width + 0.42) { const [ry] = railY(r, z0 + 0.1); if (Math.abs(P.p[1] - ry) < 0.5) { P.p[2] = z0 + 0.1; tryRail(); return; } }
  }
}
function nextAttempt() {
  run.attempts[run.attempt] = run.attemptScore; run.attemptScore = 0; run.landedAt = null;
  run.attempt++;
  if (run.attempt >= 3) { finishRun(); return; }
  fade = 1; P = freshRider(4); run.startT = 1.2; run.combo = 1; tracks = []; snapCam();
  popMsg(`JUMP ${run.attempt + 1} OF 3`, '#ffffff');
}
function finishRun() {
  if (run.done) return;
  run.done = true;
  if (run.mode === 'race') { run.total = run.time + run.gate.pen; return; }
  if (run.mode === 'bigair') { if (run.attempt < 3) run.attempts[run.attempt] = run.attemptScore; const a = [...run.attempts].sort((p, q) => q - p); run.total = a[0] + a[1]; }
  else run.total = run.score;
  const m = C.medals; run.medal = run.total >= m[2] ? 3 : run.total >= m[1] ? 2 : run.total >= m[0] ? 1 : 0;
  run.newBest = run.total > (save.cbest[C.id] || 0);
  save.runs++;
  if (run.newBest) save.cbest[C.id] = run.total;
  if (run.medal > (save.medal[C.id] || 0)) save.medal[C.id] = run.medal;
  save.best = Math.max(save.best || 0, ...Object.values(save.cbest));
  store();
  if (window.Arcade && !run.heat) Arcade.event('ski', 'run', { score: run.total, mode: run.mode });
  if (run.medal) setTimeout(() => sfx.medal(), 900);
  if (!run.heat) setTimeout(() => { if (run && run.done && screen === 'play' && !run.heat) screen = 'results'; }, run.mode === 'bigair' ? 600 : 1800);
}

// ------------------------------------------------------------ CPU riders
const CPU_NAMES = ['Kaito', 'Freya', 'Jonas', 'Mila', 'Rafa', 'Sienna', 'Theo', 'Ivy', 'Luca', 'Noor', 'Axel', 'Yuki', 'Oskar', 'Lena', 'Bodhi', 'Nova', 'Elias', 'Saga'];
function predictAir(Q) {
  let x = Q.p[0], y = Q.p[1], z = Q.p[2], vx = Q.v[0], vy = Q.v[1], vz = Q.v[2], T = 0;
  if (Q.pipeAir) vx *= 0.3;
  for (let i = 0; i < 300; i++) { const d = 0.02; vy -= GRAV * d; x += vx * d; y += vy * d; z += vz * d; T += d; if (y <= heightAt(x, z)) break; }
  return T;
}
function planTrick(Q, B, skill, R) {
  const T = predictAir(Q);
  const pl = { spin: 0, flip: 0, dir: R() < 0.5 ? 1 : -1, fdir: R() < 0.65 ? -1 : 1, grab: 0, g0: 0.15, g1: 0 };
  if (T < 0.5) return pl;
  const Tu = T - 0.3;
  let halves = Math.max(0, Math.floor((SPIN_MAX * (Tu - 0.15) - 0.4) / Math.PI));
  let flips = 0;
  if (T > 1.45 && R() < 0.3 + skill * 0.55) flips = 1;
  if (T > 2.6 && skill > 0.93 && R() < 0.65) flips = 2;
  if (Q.pipeAir) { flips = T > 1.6 && R() < 0.4 ? 1 : 0; halves = Math.min(halves, 4); }
  if (R() > skill) halves = Math.max(0, halves - 1 - Math.floor(R() * 2));
  // judges like variety
  for (let n = 0; n < 3 && B.used[halves + ':' + flips] && halves > 1; n++) halves--;
  B.used[halves + ':' + flips] = 1;
  pl.spin = halves * Math.PI; pl.flip = flips * Math.PI * 2;
  if (T > 0.75) { pl.grab = 1 + Math.floor(R() * 4); pl.g1 = Math.max(0.35, T - 0.42); }
  if (R() > 0.93 + skill * 0.07) pl.spin += (R() < 0.5 ? -1 : 1) * (0.7 + R() * 0.5);   // the odd mistake
  return pl;
}
function makeBrain(skill, R) {
  const B = { plan: null, rails: new Map(), used: {}, side: R() < 0.5 ? 1 : -1 };
  const railOK = (r, nj) => {
    if (nj && Math.abs(r.zc - nj.zc) < 28) return false;
    if (!B.rails.has(r)) B.rails.set(r, R() < 0.55 + 0.45 * skill);
    return B.rails.get(r);
  };
  return Q => {
    const I = { left: false, right: false, up: false, down: false, jump: false, g1: false, g2: false, g3: false, g4: false };
    if (Q.crash > 0) { B.plan = null; return I; }
    if (Q.rail) { const u = Q.bal + Q.balV * 0.45; I.left = u > 0.02; I.right = u < -0.02; return I; }
    if (Q.ground) {
      B.plan = null;
      const z = Q.p[2], x = Q.p[0], sp = v3.len(Q.v);
      let tx = cx(z + 25) + Math.sin(z * 0.013) * 6, look = Math.max(10, sp * 0.8), aim = null;
      const nj = W0.jumps.find(f => f.lipZ > z + 0.5 && f.z0 < z + 160);
      const nr = W0.rails.find(r => r.pts[0][2] > z + 3 && r.pts[0][2] < z + 80 && railOK(r, nj));
      const pf = W0.pipe, inP = pf && z > pf.z0 - 4 && z < pf.z1 - 10;
      if (inP) {
        const dx = x - pf.x;
        if (Math.abs(dx) > 4 && Math.sign(Q.v[0]) === -Math.sign(dx)) B.side = -Math.sign(dx);
        aim = B.side * 0.72;
      } else if (nr && (!nj || nr.pts[0][2] < nj.z0 - 6)) { tx = nr.x; look = clamp((nr.pts[0][2] - z) * 0.55, 5, look); }
      else if (nj) {
        tx = nj.x; if (nj.lipZ - z < 45) look = clamp((nj.lipZ - z) * 0.5, 5, look);
        const dl = nj.lipZ - z; if (nj.kind === 'jump') I.jump = dl < 13 && dl > 2.6;
      }
      // keep clear of trees
      if (!inP) {
        const k0 = Math.floor(z / 4), reach = 4 + sp * 0.9, slope = Q.v[0] / Math.max(1, Q.v[2]);
        let best = null;
        for (let j = k0; j <= k0 + Math.ceil(reach / 4) + 1; j++) for (const tr of treeGrid.get(j) || []) {
          const dz = tr.z - z; if (dz < 0.5 || dz > reach) continue;
          const px = x + slope * dz, clear = 1.4 * tr.s + 1.4;
          if (Math.abs(tr.x - px) < clear && (!best || dz < best.dz)) best = { tr, dz, px };
        }
        if (best) { const s = Math.sign(best.px - best.tr.x) || 1; tx = best.tr.x + s * (1.8 * best.tr.s + 2.5); look = Math.max(4, best.dz); }
      }
      const des = aim !== null ? aim : Math.atan2(tx - x, look);
      const e = angW(des - Q.yaw);
      I.left = e > 0.025; I.right = e < -0.025;
      I.up = !inP && (!nj || nj.z0 - z > 55) && !nr;
      return I;
    }
    if (!B.plan) B.plan = planTrick(Q, B, skill, R);
    const pl = B.plan, at = Q.air;
    if (pl.spin && at > 0.04) { const m = Q.spinV * Q.spinV / 84 + 0.06; if (Math.abs(Q.spin) < pl.spin - m) { if (pl.dir > 0) I.left = true; else I.right = true; } }
    if (pl.flip && at > 0.06) { const m = Q.flipV * Q.flipV / 68 + 0.06; if (Math.abs(Q.flip) < pl.flip - m) { if (pl.fdir > 0) I.up = true; else I.down = true; } }
    if (pl.grab && at > pl.g0 && at < pl.g1) I['g' + pl.grab] = true;
    return I;
  };
}

// ------------------------------------------------------------ race mode: downhill through gates vs 3 CPU racers
const RACE = { gates: null, diff: 1 };
const fmtRace = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`; };
function buildGates(ci) {
  const R = rng(ci * 131 + 7), g = []; let side = R() < 0.5 ? 1 : -1;
  for (let z = 70; z < C.len - 30; z += 30 + R() * 12) {
    if (W0.feats.some(f => z > f.z0 - 8 && z < f.z1 + 10) || W0.rails.some(r => z > r.pts[0][2] - 8 && z < r.pts[r.pts.length - 1][2] + 8)) continue;
    const clear = x => ![...W0.trees, ...(W0.rocks || [])].some(o => o.z > z - 14 && o.z < z + 5 && Math.abs(o.x - x) < 6.5 + (o.s || 1) * 1.5);
    const want = side * (3 + R() * 4.5), x = [want, want * 0.5, 0, -want * 0.5, -want].map(o => cx(z) + o).find(clear);
    if (x === undefined) continue;
    g.push({ z, x, w: 7, y: heightAt(x, z), red: side > 0 }); side = -side;
  }
  return g;
}
function gateCheck(Q, G, me) {
  const gates = RACE.gates; if (!gates) return;
  while (G.gi < gates.length && Q.p[2] >= gates[G.gi].z) {
    const g = gates[G.gi++];
    if (Math.abs(Q.p[0] - g.x) > g.w / 2 + 0.3) { G.pen += 2; G.missed++; if (me) { popMsg('MISSED GATE', '#f87171', '+2.00 s'); Sound.play('error'); } }
    else if (me) { G.lastOK = t; Sound.play('tab'); }
  }
}
function makeRaceBrain(skill, R) {
  const B = { gi: 0, wob: R() * 10 };
  return Q => {
    const I = { left: false, right: false, up: false, down: false, jump: false, g1: false, g2: false, g3: false, g4: false };
    if (Q.crash > 0) return I;
    if (Q.rail) { const u = Q.bal + Q.balV * 0.45; I.left = u > 0.02; I.right = u < -0.02; return I; }
    if (!Q.ground) return I;   // racers keep it clean in the air
    const z = Q.p[2], x = Q.p[0], sp = v3.len(Q.v), gates = RACE.gates;
    while (B.gi < gates.length && gates[B.gi].z < z + 2.5) B.gi++;
    const g = gates[B.gi];
    let tx = g ? g.x : cx(z + 30), tz = g ? g.z : z + 30;
    // a slightly sloppy line for the weaker racers
    tx += Math.sin(t * 0.8 + B.wob) * (1 - skill) * 5;
    // trees
    const k0 = Math.floor(z / 4), reach = 4 + sp * 0.9, slope = Q.v[0] / Math.max(1, Q.v[2]);
    let best = null;
    for (let j = k0; j <= k0 + Math.ceil(reach / 4) + 1; j++) for (const tr of treeGrid.get(j) || []) {
      const dz = tr.z - z; if (dz < 0.5 || dz > reach) continue;
      const px = x + slope * dz; if (Math.abs(tr.x - px) < 1.4 * tr.s + 1.4 && (!best || dz < best.dz)) best = { tr, dz, px };
    }
    if (best) { const s = Math.sign(best.px - best.tr.x) || 1; tx = best.tr.x + s * (1.8 * best.tr.s + 2.5); tz = best.tr.z; }
    const des = Math.atan2(tx - x, Math.max(5, Math.min(tz - z, sp * 1.4 + 6)));
    const e = angW(des - Q.yaw);
    I.left = e > 0.03; I.right = e < -0.03;
    I.up = Math.abs(e) < 0.12 + skill * 0.16 && (skill > 0.95 || Math.sin(t * 1.3 + B.wob) < skill * 1.6 - 0.6);
    I.down = sp > 34 + skill * 14;   // weaker racers scrub a little speed
    return I;
  };
}
function raceTotal(o) { return o.me ? (run.done ? run.time + run.gate.pen : null) : o.fin ? o.finT + o.gate.pen : null; }
function raceStandings() {
  const L = run.heat.riders.map(o => ({ o, s: raceTotal(o), z: o.me ? P.p[2] : o.P.p[2] }));
  return L.sort((a, b) => (a.s != null) !== (b.s != null) ? (a.s != null ? -1 : 1) : a.s != null ? a.s - b.s : b.z - a.z);
}
function closeRace() {
  const h = run.heat; if (h.closed) return; h.closed = true;
  // anyone still on the hill gets a projected time
  h.riders.forEach(o => { if (!o.me && !o.fin) { const sp = Math.max(8, v3.len(o.P.v)); o.fin = true; o.finT = run.raceT + Math.max(0, C.len - o.P.p[2]) / sp + 3; o.dnf = true; } });
  const st = raceStandings(); h.place = st.findIndex(x => x.o.me) + 1;
  const tot = run.time + run.gate.pen; save.rbest = save.rbest || {};
  h.newBest = !save.rbest[C.id] || tot < save.rbest[C.id]; if (h.newBest) save.rbest[C.id] = tot;
  if (h.place === 1) { save.rwins = save.rwins || {}; save.rwins[C.id] = Math.max(save.rwins[C.id] || 0, h.diff + 1); }
  store();
  if (window.Arcade) Arcade.event('ski', 'race', { place: h.place, time: tot, diff: h.diff });
  if (h.place === 1) setTimeout(() => sfx.medal(), 500);
  setTimeout(() => { if (run && run.heat === h) screen = 'raceres'; }, 600);
}
function drawRaceTop() {
  const st = raceStandings(), pl = st.findIndex(x => x.o.me) + 1, G = run.gate, n = RACE.gates.length;
  const w = U.txt(['', '1st', '2nd', '3rd', '4th'][pl], 34, 18, 46, pl === 1 ? '#fde047' : '#ffffff', 'left', { head: true, weight: 800 });
  U.txt(`/ ${st.length}`, 44 + w, 40, 18, '#cbd5e1', 'left', { weight: 700 });
  U.txt(`GATE ${Math.min(n, G.gi + 1)} / ${n}`, 36, 78, 15, '#e2e8f0', 'left', { weight: 800 });
  if (G.pen) U.txt(`+${G.pen.toFixed(0)} s penalty`, 36, 100, 14, '#f87171', 'left', { weight: 800 });
  // marker over the next gate
  const g = RACE.gates[G.gi];
  if (g && !run.done && run.startT <= 0) {
    const q = R3.project([g.x, g.y + 2.7, g.z], { x: 0, y: 0, w: W, h: H });
    if (q && q[1] > 0 && q[1] < H) { ctx.fillStyle = g.red ? '#ef4444' : '#3b82f6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q[0] - 10, q[1] - 16); ctx.lineTo(q[0] + 10, q[1] - 16); ctx.lineTo(q[0], q[1] - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
}
let gateMeshes = null;
function drawGates(camZ) {
  if (!gateMeshes) gateMeshes = [[0.9, 0.16, 0.2], [0.16, 0.42, 0.95]].map(c => {
    const m = new MB();
    [-1, 1].forEach(s => {
      m.tube(M4.compose(s * 3.5, 0.6, 0, 0, 0.07, 3.2, 0.07), 8, [0.96, 0.96, 0.98, 0]);
      m.tube(M4.compose(s * 2.4, 0.5, 0, 0, 0.06, 2.8, 0.06), 8, [0.96, 0.96, 0.98, 0]);
      m.box(M4.compose(s * 2.95, 1.35, 0, 0, 1.1, 0.8, 0.04), [...c, 0]);
      m.box(M4.compose(s * 2.95, 1.35, 0, 0, 1.12, 0.1, 0.05), [1, 1, 1, 0]);
    });
    return R3.mesh(m);
  });
  for (const g of RACE.gates) { if (g.z < camZ - 6 || g.z > camZ + 320) continue; R3.draw(gateMeshes[g.red ? 0 : 1], M4.compose(g.x, g.y, g.z, 0), null, 0, false); }
}
function raceSelect(dt) {
  flyover(dt); updateCam(dt); render3D(dt);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,12,28,0.55)'; ctx.fillRect(0, 0, W, H);
  U.txt('Race', 70, 46, 40, '#fff', 'left', { head: true, weight: 800 });
  U.txt('Downhill against three computer racers. Ride through every gate: a missed gate costs 2 seconds.', 72, 98, 15, '#cbd5e1', 'left', { weight: 600 });
  save.rbest = save.rbest || {}; save.rwins = save.rwins || {};
  if (sel > 2) sel = 0;
  [0, 1, 2].forEach(ci => {
    const c = COURSES[ci], x = 70 + ci * 380, y = 140, w = 360, h = 220, on = sel === ci;
    U.panel(x, y, w, h, { fill: on ? 'rgba(16,185,129,0.3)' : 'rgba(14,15,22,0.78)', stroke: on ? '#6ee7b7' : 'rgba(255,255,255,0.09)' });
    const sk = ctx.createLinearGradient(0, y + 16, 0, y + 90); sk.addColorStop(0, c.sky[0]); sk.addColorStop(1, c.sky[1]);
    ctx.save(); U.rr(x + 16, y + 16, w - 32, 74, 12); ctx.clip(); ctx.fillStyle = sk; ctx.fillRect(x + 16, y + 16, w - 32, 74);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.moveTo(x + 16, y + 92); ctx.lineTo(x + 90, y + 46); ctx.lineTo(x + 150, y + 66); ctx.lineTo(x + 230, y + 30); ctx.lineTo(x + 290, y + 60); ctx.lineTo(x + w - 16, y + 44); ctx.lineTo(x + w - 16, y + 92); ctx.fill(); ctx.restore();
    U.txt(c.name, x + 18, y + 104, 21, '#fff', 'left', { weight: 800 });
    U.txt(`${(c.len / 1000).toFixed(2)} km`, x + w - 18, y + 108, 14, '#94a3b8', 'right', { weight: 700 });
    U.txt('Best time', x + 18, y + 146, 13, '#94a3b8', 'left', { weight: 700 });
    U.txt(save.rbest[c.id] ? fmtRace(save.rbest[c.id]) : '—', x + 18, y + 166, 22, '#fff', 'left', { weight: 800 });
    const wn = save.rwins[c.id] || 0;
    ['Easy', 'Medium', 'Hard'].forEach((d, k) => { const got = wn > k; U.txt((got ? '✓ ' : '') + d, x + w - 18, y + 140 + k * 22, 13, got ? '#6ee7b7' : 'rgba(255,255,255,0.35)', 'right', { weight: 700 }); });
    if (U.click && U.click.x > x && U.click.x < x + w && U.click.y > y && U.click.y < y + h) { U.click = null; if (sel !== ci) { sel = ci; Sound.play('tab'); } }
  });
  if (U.pressed.ArrowRight || U.pressed.KeyD) { sel = (sel + 1) % 3; Sound.play('tab'); }
  if (U.pressed.ArrowLeft || U.pressed.KeyA) { sel = (sel + 2) % 3; Sound.play('tab'); }
  U.panel(70, 390, 740, 150);
  U.txt('Racers', 94, 410, 18, '#fff', 'left', { weight: 800 });
  ['EASY', 'MEDIUM', 'HARD'].forEach((d, k) => { const on = RACE.diff === k; if (U.button('df' + k, 94 + k * 236, 450, 220, 56, d, on ? { color: ['#22c55e', '#f59e0b', '#ef4444'][k], size: 16, sfx: 'tab' } : { ghost: true, size: 16, sfx: 'tab' })) RACE.diff = k; });
  U.panel(830, 390, 380, 150);
  U.txt('Tips', 854, 410, 18, '#fff', 'left', { weight: 800 });
  wrap('Hold W to tuck on the straights. Carve early so you are already lined up for the next gate. The arrow marks the next one.', 854, 444, 330, 13, '#cbd5e1', 19);
  if (U.button('go', 940, 638, 270, 58, 'START RACE', { color: '#10b981', size: 20 }) || U.pressed.Enter) startHeat(sel, 'race', { diff: RACE.diff });
  else if (U.button('back', 70, 638, 160, 58, 'BACK', { ghost: true, size: 16, sfx: 'back' }) || U.pressed.Escape) screen = 'title';
}
function raceResults() {
  const h = run.heat; if (!h) return;
  ctx.fillStyle = 'rgba(8,12,28,0.6)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 380, 60, 760, 600);
  const place = h.place;
  U.txt(place === 1 ? 'YOU WIN!' : `${['', '1st', '2nd', '3rd', '4th'][place]} place`, W / 2, 86, 46, place === 1 ? '#fde047' : '#fff', 'center', { head: true, weight: 800 });
  U.txt(`${C.name}  ·  ${['Easy', 'Medium', 'Hard'][h.diff]} racers${h.newBest ? '  ·  NEW BEST TIME' : ''}`, W / 2, 148, 15, h.newBest ? '#6ee7b7' : '#94a3b8', 'center', { weight: 700 });
  const st = raceStandings(), win = st[0].s;
  st.forEach(({ o, s }, i) => {
    const y = 190 + i * 56, G = o.me ? run.gate : o.gate;
    U.rr(W / 2 - 320, y, 640, 48, 12); ctx.fillStyle = o.me ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.05)'; ctx.fill();
    U.txt(String(i + 1), W / 2 - 290, y + 24, 20, i === 0 ? '#fde047' : '#e2e8f0', 'center', { base: 'middle', weight: 800, shadow: false });
    ctx.fillStyle = o.me ? look().jacket : o.look.jacket; ctx.beginPath(); ctx.arc(W / 2 - 252, y + 24, 8, 0, 7); ctx.fill();
    U.txt(o.name, W / 2 - 232, y + 24, 18, '#fff', 'left', { base: 'middle', weight: 800, shadow: false });
    U.txt(o.dnf ? 'still on the hill (projected)' : G.missed ? `${G.missed} missed gate${G.missed > 1 ? 's' : ''}` : 'clean run', W / 2 - 40, y + 24, 13, G.missed || o.dnf ? '#fca5a5' : '#94a3b8', 'left', { base: 'middle', weight: 600, shadow: false });
    U.txt(fmtRace(s), W / 2 + 200, y + 24, 18, '#fde047', 'right', { base: 'middle', weight: 800, shadow: false });
    if (i) U.txt(`+${(s - win).toFixed(2)}`, W / 2 + 300, y + 24, 14, '#94a3b8', 'right', { base: 'middle', weight: 700, shadow: false });
  });
  U.txt(`Your best on this course: ${fmtRace(save.rbest[C.id])}`, W / 2, 440, 15, '#cbd5e1', 'center', { weight: 600 });
  if (U.button('again', W / 2 - 330, 586, 320, 58, 'RACE AGAIN', { color: '#10b981', size: 18 }) || U.pressed.Enter) startHeat(built, 'race', { diff: h.diff });
  else if (U.button('menu', W / 2 + 10, 586, 320, 58, 'RACE MENU', { ghost: true, size: 18, sfx: 'back' }) || U.pressed.Escape) { run.heat = null; P = null; screen = 'racesel'; Sound.playSong(SONGS.skiMenu); }
}

// ------------------------------------------------------------ ranked
const RANKS = [[0, 'Bronze', '#cd7f32'], [900, 'Silver', '#cbd5e1'], [1100, 'Gold', '#facc15'], [1300, 'Platinum', '#5eead4'], [1500, 'Diamond', '#60a5fa'], [1700, 'Master', '#c084fc'], [1900, 'Champion', '#f87171']];
function rankOf(elo) {
  let k = 0; for (let i = 0; i < RANKS.length; i++) if (elo >= RANKS[i][0]) k = i;
  const [lo, name, col] = RANKS[k], hi = RANKS[k + 1] ? RANKS[k + 1][0] : lo + 300;
  const div = k === RANKS.length - 1 ? '' : [' III', ' II', ' I'][Math.min(2, Math.floor((elo - lo) / ((hi - lo) / 3)))];
  return { name: name + div, col, tier: k, lo, hi };
}
function drawBadge(x, y, s, elo) {
  const r = rankOf(elo);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); } ctx.closePath();
  const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, U.shade(r.col, 0.35)); g.addColorStop(1, U.shade(r.col, -0.35)); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(15,23,42,0.75)'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(14, 8); ctx.lineTo(-14, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(5, -8); ctx.lineTo(-5, -8); ctx.closePath(); ctx.fill();
  for (let i = 0; i < Math.min(3, r.tier); i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8 + i * 8, 17, 2.5, 0, 7); ctx.fill(); }
  ctx.restore();
}
const RK = { screen: 'home', me: null, top: [], err: '', queue: null, net: null, result: null, loading: false };
const ACC = () => window.Account;
const signedIn = () => { const A = ACC(); return !!(A && A.configured && A.user && A.sb); };
const myName = () => { const A = ACC(); return (A && A.user && A.name()) || 'You'; };
function myElo() { return signedIn() ? (RK.me ? RK.me.elo : 1000) : (save.relo || 1000); }
async function loadRanked() {
  const A = ACC(); RK.loading = true;
  try {
    if (A && A.configured) await A.init();
    if (!signedIn()) { RK.me = { elo: save.relo || 1000, wins: save.rw || 0, losses: save.rl || 0, peak: save.rpeak || 1000 }; RK.top = []; return; }
    const me = await A.sb.from('ranked_game').select('elo,wins,losses,streak,peak').eq('user_id', A.user.id).eq('game', 'ski').maybeSingle();
    if (me.error) throw me.error;
    RK.me = me.data || { elo: 1000, wins: 0, losses: 0, streak: 0, peak: 1000 };
    const top = await A.sb.from('ranked_game').select('elo,wins,losses,user_id,profiles(username)').eq('game', 'ski').order('elo', { ascending: false }).limit(8);
    RK.top = top.data || []; RK.err = '';
  } catch (e) { RK.err = 'Online ranks need the latest database setup.'; RK.me = RK.me || { elo: 1000, wins: 0, losses: 0, peak: 1000 }; }
  finally { RK.loading = false; }
}
function openRanked() { screen = 'ranked'; RK.screen = 'home'; RK.result = null; loadRanked(); buildWorld(sel); }

// a heat: everyone drops at once, best score wins
let cpuMeshes = [];
function startHeat(ci, kind, opts = {}) {
  newRun(ci);
  cpuMeshes.forEach(m => { for (const k in m) R3.free(m[k]); }); cpuMeshes = [];
  const heat = { kind, riders: [{ me: true, name: myName() }], startElo: myElo(), rated: true, endT: null, matchId: opts.matchId || null };
  run.heat = heat;
  if (kind === 'race') {
    heat.rated = false; heat.diff = opts.diff == null ? 1 : opts.diff; run.mode = 'race'; run.gate = { gi: 0, pen: 0, missed: 0 };
    RACE.gates = buildGates(ci);
    const R = rng((Date.now() & 0xffff) + ci * 91), names = [...CPU_NAMES].sort(() => R() - 0.5);
    const SK = [[0.62, 0.56, 0.5], [0.82, 0.77, 0.72], [1.0, 0.96, 0.92]][heat.diff];
    [-5, 5, -2.5].forEach((off, i) => {
      const lk = { board: R() < 0.45, jacket: JACKETS[Math.floor(R() * JACKETS.length)], pants: PANTS[Math.floor(R() * PANTS.length)], helmet: HELMETS[Math.floor(R() * HELMETS.length)], deck: DECKS[Math.floor(R() * DECKS.length)] };
      const Q = freshRider(10); Q.p[0] += off; Q.p[1] = heightAt(Q.p[0], Q.p[2]);
      const mesh = Rider.build(R3, lk); cpuMeshes.push(mesh);
      heat.riders.push({ cpu: true, name: names[i], look: lk, mesh, P: Q, brain: makeRaceBrain(SK[i], R), fin: false, gate: { gi: 0, pen: 0, missed: 0 },
        run: { mode: 'slope', score: 0, combo: 1, comboT: 0, tricks: [], used: {}, attemptScore: 0, chNew: [], rails: 0, drops: new Set(), maxSpeed: 0, crashes: 0, best: null, tokens: 0 } });
    });
  }
  if (kind === 'cpu') {
    const R = rng((Date.now() & 0xffff) + ci * 77), names = [...CPU_NAMES].sort(() => R() - 0.5);
    const base = Math.max(1150, heat.startElo + 120);
    [[-5, 0.99, 260], [5, 0.95, 160], [-2.5, 0.9, 40]].forEach(([off, sk, bonus], i) => {
      const elo = Math.round(base + bonus + (R() - 0.5) * 60);
      const skill = clamp(sk - Math.max(0, 1400 - elo) / 9000, 0.86, 0.995);
      const lk = { board: R() < 0.45, jacket: JACKETS[Math.floor(R() * JACKETS.length)], pants: PANTS[Math.floor(R() * PANTS.length)], helmet: HELMETS[Math.floor(R() * HELMETS.length)], deck: DECKS[Math.floor(R() * DECKS.length)] };
      const Q = freshRider(10); Q.p[0] += off; Q.p[1] = heightAt(Q.p[0], Q.p[2]);
      const mesh = Rider.build(R3, lk); cpuMeshes.push(mesh);
      heat.riders.push({ cpu: true, name: names[i], elo, look: lk, mesh, P: Q, brain: makeBrain(skill, R), fin: false,
        run: { mode: 'slope', score: 0, combo: 1, comboT: 0, tricks: [], used: {}, attemptScore: 0, chNew: [], rails: 0, drops: new Set(), maxSpeed: 0, crashes: 0, best: null, tokens: 0 } });
    });
  }
  if (kind === 'online') {
    const o = RK.net.opp;
    const mesh = Rider.build(R3, o.look); cpuMeshes.push(mesh);
    heat.riders.push({ remote: true, name: o.name, elo: o.elo, look: o.look, mesh, P: Object.assign(freshRider(10), { menuFor: 'remote' }), score: 0, fin: false, snaps: [] });
    P.p[0] -= 3; P.p[1] = heightAt(P.p[0], P.p[2]);
  }
  run.startT = 3.4;
}
function others() { return run && run.heat ? run.heat.riders.filter(o => !o.me) : []; }
function heatScore(o) { return o.me ? run.score : o.cpu ? o.run.score : o.score; }
function standings() {
  if (run.heat.kind === 'race') return raceStandings();
  return run.heat.riders.map(o => ({ o, s: heatScore(o) })).sort((a, b) => b.s - a.s);
}
function heatTick(dt) {
  const h = run && run.heat; if (!h || screen !== 'play') return;
  if (h.kind === 'online') netHeatFrame(dt);
  if (!run.done || h.closed) return;
  const all = h.riders.every(o => o.me || o.fin);
  if (h.endT === null) h.endT = t;
  if (all || t - h.endT > (h.kind === 'online' ? 50 : 25)) closeHeat(false);
}
function closeHeat(forfeitWin) {
  const h = run.heat; if (h.closed) return; if (h.kind === 'race') { closeRace(); return; } h.closed = true;
  const st = standings(), place = st.findIndex(x => x.o.me) + 1;
  h.place = forfeitWin ? 1 : place; h.forfeit = forfeitWin;
  if (window.Arcade) Arcade.event('ski', 'heat', { place: h.place, score: run.score, online: h.kind === 'online' });
  const before = h.startElo;
  h.result = { before, after: null, place: h.place };
  if (h.kind === 'cpu') {
    const cpus = h.riders.filter(o => o.cpu), beaten = cpus.filter(o => run.score > o.run.score).length;
    const S = beaten / cpus.length, E = cpus.reduce((a, o) => a + 1 / (1 + Math.pow(10, (o.elo - before) / 400)), 0) / cpus.length;
    const avg = Math.round(cpus.reduce((a, o) => a + o.elo, 0) / cpus.length);
    if (signedIn()) {
      ACC().sb.rpc('ranked_game_cpu', { p_game: 'ski', p_cpu_elo: avg, p_score: S }).then(r => {
        if (r.error) { h.result.after = before; h.result.err = 'Rank not saved (database needs the latest setup).'; return; }
        h.result.after = r.data && r.data.elo != null ? r.data.elo : before + Math.round(32 * (S - E)); if (RK.me) RK.me.elo = h.result.after;
      }).catch(() => { h.result.after = before; });
    } else {
      const d = Math.round(32 * (S - E)); save.relo = Math.max(0, before + d); save.rpeak = Math.max(save.rpeak || 1000, save.relo);
      if (S >= 0.5) save.rw = (save.rw || 0) + 1; else save.rl = (save.rl || 0) + 1; store(); h.result.after = save.relo;
    }
  } else reportOnline(h.place === 1);
  setTimeout(() => { if (run && run.heat === h) screen = 'heatres'; }, 400);
}

// ------------------------------------------------------------ online (ranked vs people)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
function netClose() {
  const N = RK.net; if (!N) return;
  try { N.tr && N.tr.broadcast({ t: 'bye' }); } catch (e) {}
  try { N.tr && N.tr.close(); } catch (e) {}
  RK.net = null;
}
function queueLeave() { const q = RK.queue; if (!q) return; RK.queue = null; clearInterval(q.timer); try { q.ch.untrack(); ACC().sb.removeChannel(q.ch); } catch (e) {} }
function findMatch() {
  if (!signedIn()) { RK.err = 'Sign in on the arcade to race other players.'; return; }
  const A = ACC(); RK.screen = 'queue'; RK.qT = 0; RK.err = '';
  const ch = A.sb.channel('ski-ranked-queue', { config: { presence: { key: A.user.id }, broadcast: { self: false } } });
  const me = { id: A.user.id, name: A.name(), elo: myElo(), at: Date.now() };
  let matched = false;
  const tryPair = () => {
    if (matched) return;
    const list = Object.values(ch.presenceState()).map(a => a[0]).filter(p => p && p.id).sort((a, b) => a.at - b.at);
    if (list.length < 2 || list[0].id !== me.id) return;
    const others = list.slice(1), opp = others.reduce((b, p) => Math.abs(p.elo - me.elo) < Math.abs(b.elo - me.elo) ? p : b, others[0]);
    matched = true; const code = newCode();
    ch.send({ type: 'broadcast', event: 'match', payload: { to: opp.id, code, from: me.id } });
    queueLeave(); netHost(code, opp);
  };
  ch.on('presence', { event: 'sync' }, tryPair);
  ch.on('broadcast', { event: 'match' }, ({ payload }) => {
    if (matched || !payload || payload.to !== me.id) return;
    matched = true; queueLeave(); setTimeout(() => netJoin(payload.code, payload.from), 900);
  });
  ch.subscribe(st => { if (st === 'SUBSCRIBED') ch.track(me); });
  RK.queue = { ch, timer: setInterval(tryPair, 2000) };
}
function helloMsg() { const A = ACC(); return { t: 'hello', name: myName(), uid: A && A.user ? A.user.id : null, elo: myElo(), look: look() }; }
function netHost(code, opp) {
  netClose(); RK.screen = 'connecting';
  const N = RK.net = { role: 'host', code, opp: { name: opp.name || 'Rider', uid: opp.id, elo: opp.elo || 1000, look: null }, guest: null };
  N.tr = NetTransport.host(code, {
    ready: () => {},
    join: id => { if (N.guest && N.guest !== id) { N.tr.send(id, { t: 'full' }); return; } N.guest = id; },
    leave: id => { if (id === N.guest) oppLeft(); },
    msg: (id, d) => {
      if (id !== N.guest) return;
      if (d.t === 'hello' && !N.started) {
        Object.assign(N.opp, { name: String(d.name || 'Rider').slice(0, 16), uid: d.uid || N.opp.uid, elo: d.elo || 1000, look: d.look || look() });
        N.started = true; const ci = Math.floor(Math.random() * 3);
        N.matchId = code + '-' + Date.now().toString(36);
        N.tr.broadcast(Object.assign(helloMsg(), { t: 'go', ci, matchId: N.matchId }));
        startHeat(ci, 'online', { matchId: N.matchId });
      } else onNetMsg(d);
    },
    error: e => netFail(String(e)),
  });
  setTimeout(() => { if (RK.net === N && !N.started) netFail('The other rider did not connect.'); }, 25000);
}
function netJoin(code, oppId) {
  netClose(); RK.screen = 'connecting';
  const N = RK.net = { role: 'client', code, opp: { name: 'Rider', uid: oppId, elo: 1000, look: null } };
  N.tr = NetTransport.join(code, {
    ready: () => { const hi = () => N.tr && N.tr.broadcast(helloMsg()); hi(); let n = 0; N.hiT = setInterval(() => { if (N.started || RK.net !== N || ++n > 10) { clearInterval(N.hiT); if (RK.net === N && !N.started) netFail('The room did not answer.'); return; } hi(); }, 1500); },
    leave: () => oppLeft(),
    msg: (id, d) => {
      if (d.t === 'go' && !N.started) { N.started = true; Object.assign(N.opp, { name: String(d.name || 'Rider').slice(0, 16), uid: d.uid || N.opp.uid, elo: d.elo || 1000, look: d.look || look() }); N.matchId = d.matchId; startHeat(d.ci, 'online', { matchId: d.matchId }); }
      else if (d.t === 'full') netFail('That match is full.');
      else onNetMsg(d);
    },
    error: e => netFail(String(e)),
  });
}
function netFail(why) { netClose(); queueLeave(); RK.err = why; RK.screen = 'home'; if (screen === 'play') { screen = 'ranked'; Sound.playSong(SONGS.skiMenu); } }
function oppLeft() {
  const h = run && run.heat;
  if (screen === 'play' && h && h.kind === 'online' && !h.closed) { popMsg('OPPONENT LEFT', '#fde047'); h.riders.forEach(o => { if (o.remote) o.fin = true; }); if (!run.done) { closeHeat(true); } return; }
  if (!h || h.closed) return;
  netFail('The other rider left.');
}
function onNetMsg(d) {
  const h = run && run.heat; if (!h || h.kind !== 'online') return;
  const o = h.riders.find(r => r.remote); if (!o) return;
  if (d.t === 'st') { o.snaps.push({ at: performance.now(), d }); if (o.snaps.length > 6) o.snaps.shift(); o.score = d.sc; if (d.fin) o.fin = true; }
  else if (d.t === 'fin') { o.score = d.sc; o.fin = true; }
  else if (d.t === 'pop') { o.lastTrick = d.n; o.lastTrickT = t; }
  else if (d.t === 'bye') oppLeft();
}
let netSendT = 0, lastPopsLen = 0;
function netHeatFrame(dt) {
  const N = RK.net; if (!N || !N.tr) return;
  netSendT += dt;
  if (netSendT > 1 / 12) {
    netSendT = 0;
    const r2 = v => Math.round(v * 100) / 100;
    N.tr.broadcast({ t: 'st', p: P.p.map(r2), v: P.v.map(r2), u: P.upN.map(r2), y: r2(P.yaw), fk: P.fakie ? 1 : 0, sp: r2(P.spin), fl: r2(P.flip), c: r2(P.crash), tb: P.tumble.map(r2), ln: r2(P.lean), g: P.ground ? 1 : 0, r: P.rail ? 1 : 0, rs: P.railSide || 0, b: r2(P.bal), ch: r2(P.charge), sq: r2(P.squash), tk: r2(P.tuck), gb: P.grab || P.lastGrab, gk: r2(P.grabK), a: r2(P.air), sc: run.score, fin: run.done ? 1 : 0 });
  }
  if (run.tricks.length !== lastPopsLen) { lastPopsLen = run.tricks.length; const tr = run.tricks[run.tricks.length - 1]; if (tr) N.tr.broadcast({ t: 'pop', n: tr.name + '  +' + tr.pts.toLocaleString() }); }
  // smooth the other rider between snapshots (~100 ms behind)
  const o = run.heat.riders.find(r => r.remote); if (!o || !o.snaps.length) return;
  const now = performance.now() - 110; let a = o.snaps[0], b = o.snaps[o.snaps.length - 1];
  for (let i = 0; i < o.snaps.length - 1; i++) if (o.snaps[i].at <= now && o.snaps[i + 1].at >= now) { a = o.snaps[i]; b = o.snaps[i + 1]; break; }
  const k = b.at > a.at ? clamp((now - a.at) / (b.at - a.at), 0, 1.3) : 1, A = a.d, Bd = b.d, Q = o.P;
  Q.p = v3.lerp(A.p, Bd.p, k); Q.v = Bd.v; Q.upN = v3.norm(v3.lerp(A.u, Bd.u, k)); Q.yaw = A.y + angW(Bd.y - A.y) * k; Q.fakie = !!Bd.fk; Q.spin = lerp(A.sp, Bd.sp, k); Q.flip = lerp(A.fl, Bd.fl, k);
  Q.crash = Bd.c; Q.tumble = Bd.tb; Q.lean = Bd.ln; Q.ground = !!Bd.g; Q.rail = Bd.r ? {} : null; Q.railSide = Bd.rs; Q.bal = Bd.b; Q.charge = Bd.ch; Q.squash = Bd.sq; Q.tuck = Bd.tk; Q.grab = Bd.gk > 0.5 ? Bd.gb : null; Q.lastGrab = Bd.gb; Q.grabK = Bd.gk; Q.air = Bd.a;
}
async function reportOnline(won) {
  const h = run.heat, N = RK.net, A = ACC();
  if (N && N.tr) N.tr.broadcast({ t: 'fin', sc: run.score });
  if (!A || !A.sb || !N || !N.opp.uid || !N.matchId) { h.result.after = h.result.before; return; }
  try {
    const r = await A.sb.rpc('ranked_game_report', { p_game: 'ski', p_match: N.matchId, p_opp: N.opp.uid, p_won: won });
    if (r.error) { h.result.after = h.result.before; h.result.err = 'Rank not saved (database needs the latest setup).'; return; }
    for (let k = 0; k < 8; k++) {
      await new Promise(res => setTimeout(res, 1500));
      const me = await A.sb.from('ranked_game').select('elo').eq('user_id', A.user.id).eq('game', 'ski').maybeSingle();
      if (me.data && me.data.elo !== h.result.before) { h.result.after = me.data.elo; if (RK.me) RK.me.elo = me.data.elo; return; }
    }
    h.result.after = h.result.before; h.result.pending = true;
  } catch (e) { h.result.after = h.result.before; }
}

// ------------------------------------------------------------ camera
function snapCam() { if (!P) return; cam.dir = 0; updateCam(1, true); }
function updateCam(dt, snap) {
  const sp = Math.hypot(P.v[0], P.v[2]);
  let want = sp > 2 ? Math.atan2(P.v[0], P.v[2]) : P.yaw;
  if (P.pipeAir || inPipe(P.p[0], P.p[2])) want = 0;
  if (run && run.mode === 'bigair' && screen === 'play') want = angW(want) * 0.3;
  const follow = P.crash > 0 ? 0.6 : P.ground || P.rail ? 3.2 : 1.2;
  cam.dir = snap ? want : cam.dir + angW(want - cam.dir) * Math.min(1, dt * follow);
  const near = save.cam === 1;
  const dist = (near ? 3.6 : 4.9) + Math.min(2.2, v3.len(P.v) * 0.045) + (P.ground ? 0 : 1.0), hgt = (near ? 1.45 : 1.95) + (P.ground ? 0 : 0.6);
  const f = [Math.sin(cam.dir), 0, Math.cos(cam.dir)];
  const e = [P.p[0] - f[0] * dist, P.p[1] + hgt, P.p[2] - f[2] * dist];
  const ge = heightAt(e[0], e[2]) + 1.2; if (e[1] < ge) e[1] = ge;
  // smooth the camera's offset from the rider (not its absolute position), so it never falls behind at speed
  const k = snap ? 1 : 1 - Math.exp(-dt * (P.ground ? 7 : 4.5));
  if (!cam.off || snap) cam.off = v3.sub(e, P.p);
  const want3 = v3.sub(e, P.p); for (let i = 0; i < 3; i++) cam.off[i] += (want3[i] - cam.off[i]) * k;
  const lag = v3.mul(P.v, -0.035);
  for (let i = 0; i < 3; i++) cam.eye[i] = P.p[i] + cam.off[i] + lag[i];
  if (cam.eye[1] < ge) cam.eye[1] = ge;
  // landing / speed shake
  cam.shake = Math.max(0, (cam.shake || 0) - dt * 2.2);
  const sh = cam.shake * cam.shake + (P.ground && !P.rail ? clamp((sp - 20) / 30, 0, 1) * 0.012 : 0), tt = t * 37;
  if (!snap && sh > 0) { cam.eye[0] += Math.sin(tt) * sh * 0.6; cam.eye[1] += Math.sin(tt * 1.37 + 1) * sh; }
  const at = [P.p[0] + f[0] * 4.5, P.p[1] + 0.75, P.p[2] + f[2] * 4.5];
  if (!cam.atOff || snap) cam.atOff = v3.sub(at, P.p);
  const wa = v3.sub(at, P.p); for (let i = 0; i < 3; i++) cam.atOff[i] += (wa[i] - cam.atOff[i]) * Math.min(1, dt * 10);
  for (let i = 0; i < 3; i++) cam.at[i] = P.p[i] + cam.atOff[i];
  cam.fov += (1.02 + Math.min(0.26, v3.len(P.v) / 120) - cam.fov) * (snap ? 1 : Math.min(1, dt * 2));
}

// ------------------------------------------------------------ drawing
const hx3 = c => { const h = c.replace('#', ''); return [0, 2, 4].map(i => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2) * 1.25); };
function env() { const s = C.sun, l = Math.hypot(...s); return { fog: C.fog, fogD: C.fogD, sun: s.map(v => v / l), sunCol: C.sunCol, sky: C.amb, ground: C.gnd, expo: C.expo || 1.0 }; }
function riderRoot(P) {
  const n = P.upN, yawR = P.yaw + (P.fakie ? Math.PI : 0) + P.spin;
  let F = [Math.sin(yawR), 0, Math.cos(yawR)]; F = v3.norm(v3.sub(F, v3.mul(n, v3.dot(F, n)))); const X = v3.cross(n, F);
  const m = new Float32Array(16); m[0] = X[0]; m[1] = X[1]; m[2] = X[2]; m[4] = n[0]; m[5] = n[1]; m[6] = n[2]; m[8] = F[0]; m[9] = F[1]; m[10] = F[2]; m[12] = P.p[0]; m[13] = P.p[1]; m[14] = P.p[2]; m[15] = 1;
  let r = m;
  if (P.crash > 0) { r = M4.mul(r, M4.trans(0, 0.45, 0)); r = M4.mul(r, M4.rotX(P.tumble[0])); r = M4.mul(r, M4.rotZ(P.tumble[1])); r = M4.mul(r, M4.trans(0, -0.45, 0)); }
  else {
    if (P.flip) { r = M4.mul(r, M4.trans(0, 0.85, 0)); r = M4.mul(r, M4.rotX(P.flip)); r = M4.mul(r, M4.trans(0, -0.85, 0)); }
    if (P.rail && P.railSide) r = M4.mul(r, M4.rotY(P.railSide * Math.PI / 2));
    if (P.butter) { const k = P.butter.k, e = Math.min(1, P.butter.t * 6), pv = k * 0.62; r = M4.mul(r, M4.trans(0, 0, pv)); r = M4.mul(r, M4.rotX(-k * 0.32 * e)); r = M4.mul(r, M4.trans(0, 0, -pv)); }
    if (P.skidA && P.ground && !P.rail) r = M4.mul(r, M4.rotY(P.skidA));
    r = M4.mul(r, M4.rotZ(-P.lean * 0.42 * (P.ground ? 1 : 0.3) + (P.rail ? P.bal * 0.4 : 0)));
  }
  return r;
}
function riderPose(P, board = save.board) {
  const ground = P.ground && !P.rail;
  return { board, t,
    crouch: P.crash > 0 ? 0.8 : clamp((ground ? 0.22 + Math.abs(P.lean) * 0.22 : 0.42) + P.charge * 0.6 + P.squash * 0.5 + (P.rail ? 0.15 : 0), 0, 1),
    lean: P.rail ? P.bal * 0.6 : 0, tuck: ground ? P.tuck : 0, arms: P.crash > 0 ? 1 : P.rail ? 0.9 : ground ? 0.12 : 0.55,
    grab: P.grab || (P.grabK > 0.05 ? P.lastGrab : null), grabK: P.grabK, tweak: P.grabK * Math.sin(t * 3), tuckLegs: !ground && !P.rail && P.crash <= 0 ? 0.3 : 0, plant: 0,
    twist: (P.twist || 0) + (board ? 0.25 : 0),
    ...(window.__poseOv || {}) };
}
function buildTracks() {
  const out = [];
  const col = C.bigair ? [0.32, 0.36, 0.5, 0.5] : [0.62, 0.69, 0.83, 0.5];
  const offs = save.board ? [[0, 0.15]] : [[0.13, 0.05], [-0.13, 0.05]];
  for (let i = 1; i < tracks.length; i++) {
    const a = tracks[i - 1], b = tracks[i];
    if (b.brk) continue;
    const al = col[3] * (i / tracks.length);
    for (const [o, w] of offs) {
      const pa = [a.p[0] + a.s[0] * o, a.p[1] + 0.03, a.p[2] + a.s[2] * o], pb = [b.p[0] + b.s[0] * o, b.p[1] + 0.03, b.p[2] + b.s[2] * o];
      const A1 = [pa[0] + a.s[0] * w, pa[1], pa[2] + a.s[2] * w], A2 = [pa[0] - a.s[0] * w, pa[1], pa[2] - a.s[2] * w], B1 = [pb[0] + b.s[0] * w, pb[1], pb[2] + b.s[2] * w], B2 = [pb[0] - b.s[0] * w, pb[1], pb[2] - b.s[2] * w];
      for (const q of [A1, B1, B2, A1, B2, A2]) out.push(q[0], q[1], q[2], col[0], col[1], col[2], al);
    }
  }
  return out;
}
function render3D(dt) {
  if (window.__noRender) return;
  const E = env(), view = { x: 0, y: 0, w: W, h: H };
  const camZ = cam.eye[2];
  const RV = rpView || { p: P.p, root: riderRoot(P), pose: riderPose(P) };
  R3.shadowBegin([RV.p[0], RV.p[1], RV.p[2] + 6], E.sun, 46);
  MESH.chunks.forEach(c => { if (c.z0 > RV.p[2] - 90 && c.z0 < RV.p[2] + 60) R3.shadowDraw(c.m); });
  R3.shadowDraw(MESH.feats); R3.shadowDraw(MESH.rails);
  Rider.draw(R3, myMesh, RV.root, RV.pose, true);
  if (!rpView) others().forEach(o => { if (o.mesh && Math.abs(o.P.p[2] - P.p[2]) < 50) Rider.draw(R3, o.mesh, riderRoot(o.P), riderPose(o.P, o.look.board), true); });
  R3.shadowEnd();
  if (window.__camOv) { const o = window.__camOv(P); cam.eye = o.eye; cam.at = o.at; cam.fov = o.fov || cam.fov; }
  R3.begin(view, cam, E);
  R3.skyDome({ top: hx3(C.sky[0]), hor: hx3(C.sky[1]), sun: E.sun, sunCol: C.sunCol, fog: C.fog, night: !!C.bigair, time: t, cloud: (GRADE[C.id] || GRADE.park).cloud, cloudCol: (GRADE[C.id] || GRADE.park).cloudC });
  R3.sky(MESH.sky);
  R3.draw(MESH.mtn, M4.trans(cam.eye[0], cam.eye[1] - 40, cam.eye[2]), null, 0, true, { fogD: C.fogD * 0.55, mtn: C.bigair ? 2 : 1 });
  MESH.chunks.forEach(c => { if (c.z0 > camZ - 200 && c.z0 < camZ + 1000) R3.draw(c.m, null, null, 0, false, { snow: 1 }); });
  R3.draw(MESH.feats, null, null, 0, false, { snow: 1 });
  R3.draw(MESH.rails, null, null, 0, false, { spec: 0.5 });
  if (run && run.mode === 'race' && RACE.gates) drawGates(camZ);
  for (const k of W0.tokens) { if (run && run.mode === 'race') break; if (k.got || k.z < camZ - 5 || k.z > camZ + 160) continue; R3.draw(MESH.token, M4.compose(k.x, k.y + Math.sin(t * 2.5 + k.z) * 0.15, k.z, t * 1.8 + k.z), null, 0, false, { spec: 1 }); }
  // chairlift: chairs go up one cable and down the other
  const L = W0.lift;
  if (L.length > 1) {
    const total = (L.length - 1) * 85, spacing = 28;
    for (let k = 0; k * spacing < total * 2; k++) {
      let s = (k * spacing + t * 2.4) % (total * 2); const up = s < total; if (!up) s = total * 2 - s;
      const i = Math.min(L.length - 2, Math.floor(s / 85)), f = s / 85 - i, a = L[i], b = L[i + 1];
      const p = [lerp(a[0], b[0], f) + (up ? -2.5 : 2.5), lerp(a[1], b[1], f) - 0.1 - Math.sin(f * Math.PI) * 1.2, lerp(a[2], b[2], f)];
      if (Math.abs(p[2] - camZ) > 450) continue;
      R3.draw(MESH.chair, M4.compose(p[0], p[1], p[2], up ? Math.PI : 0), null, 0, false);
    }
  }
  Rider.draw(R3, myMesh, RV.root, RV.pose, false, 0.25);
  if (!rpView) others().forEach(o => { if (o.mesh && Math.abs(o.P.p[2] - cam.eye[2]) < 400) Rider.draw(R3, o.mesh, riderRoot(o.P), riderPose(o.P, o.look.board), false, 0.25); });
  R3.flat(buildTracks(), false);
  const pts = [], sparks = [], clouds = [];
  const snowTint = C.bigair ? [0.55, 0.58, 0.72] : [0.97, 0.98, 1];
  parts.forEach(p => {
    const k = p[8];
    if (k === 2) {   // powder cloud: drifts, slows hard, swells and thins out
      p[3] *= 1 - Math.min(1, dt * 2.6); p[5] *= 1 - Math.min(1, dt * 2.6); p[4] = p[4] * (1 - Math.min(1, dt * 2)) - 0.4 * dt;
      p[0] += p[3] * dt + (C.wind || 0) * dt * 2; p[1] += p[4] * dt; p[2] += p[5] * dt; p[6] -= dt; p[7] += dt * (p[10] || 1.2);
      const life = p[6] / p[9], a = clamp(life * 1.4, 0, 1) * clamp((1 - life) * 8, 0, 1) * 0.5;
      clouds.push(p[0], p[1], p[2], snowTint[0], snowTint[1], snowTint[2], a, p[7]);
      return;
    }
    p[0] += p[3] * dt; p[1] += p[4] * dt; p[2] += p[5] * dt; p[4] -= (k ? 11 : 7) * dt; p[3] *= 1 - dt * 1.5; p[5] *= 1 - dt * 1.5; p[6] -= dt;
    const a = clamp(p[6] * 1.6, 0, 1);
    if (k) sparks.push(p[0], p[1], p[2], 3.2, 1.7, 0.6, a, p[7] * 0.7); else pts.push(p[0], p[1], p[2], snowTint[0], snowTint[1], snowTint[2], a * 0.85, p[7]);
  });
  parts = parts.filter(p => p[6] > 0);
  if (parts.length > 900) parts.splice(0, parts.length - 900);
  if (clouds.length) R3.points(clouds, false, true);
  if (sparks.length) R3.points(sparks, true);
  const sf = C.snowfall || 0;
  for (let i = 0; i < 260 * sf; i++) { const a = i * 12.9898, x = cam.eye[0] + ((((Math.sin(a) * 437.5 + t * (0.5 + i % 3 * 0.3)) % 50) + 50) % 50) - 25, z = cam.eye[2] + ((((Math.cos(a) * 913.1 - t * 1.5) % 50) + 50) % 50) - 12, y = cam.eye[1] + 10 - ((t * (1.1 + (i % 5) * 0.2) + i * 3.7) % 18); pts.push(x, y, z, 1, 1, 1, 0.85, 0.07); }
  if (pts.length) R3.points(pts, false);
  // lamp heads: small and very bright so the bloom makes the halo
  if (C.lights) { const lp = []; W0.lights.forEach(Lg => { if (Math.abs(Lg.z - camZ) < 400) lp.push(Lg.x, Lg.y + 9.9, Lg.z, 5, 4.4, 3.4, 1, 1.3); }); if (lp.length) R3.points(lp, true); }
  postFX(dt);
  R3.end();
}

// ------------------------------------------------------------ replays
// The run is recorded at 30 Hz (rider transform + pose); replays cut between cinematic cameras and slow down in the air.
let rec = [], recT = 0, rp = null, rpView = null;
function recFrame(dt) {
  if (!P || !run || run.done && P.ground) return;
  recT += dt; if (recT < 1 / 30) return; recT %= 1 / 30;
  const pose = riderPose(P); delete pose.board;
  rec.push({ p: [...P.p], v: [...P.v], root: riderRoot(P), pose, air: !P.ground && !P.rail && P.crash <= 0, crash: P.crash > 0 });
  if (rec.length > 30 * 25) rec.shift();
}
function startReplay(secs, back) {
  if (rec.length < 20) return;
  const n = Math.min(rec.length, Math.round(secs * 30));
  rp = { i0: rec.length - n, f: rec.length - n, back, shot: -1, shotT: 0, cam: null, speed: 1 };
  screen = 'replay'; nextShot();
}
function nextShot() {
  rp.shot = (rp.shot + 1) % 3; rp.shotT = 0;
  const fr = rec[Math.min(rec.length - 1, Math.floor(rp.f) + 50)] || rec[rec.length - 1];
  // trackside: plant a camera ahead of where the rider will be, off to one side
  const side = Math.random() < 0.5 ? -1 : 1, v = v3.norm([fr.v[0], 0, fr.v[2] || 1]);
  const px = fr.p[0] + v[2] * side * 7 + v[0] * 6, pz = fr.p[2] + v[2] * 6 - v[0] * side * 7;
  rp.fixed = [px, Math.max(heightAt(px, pz) + 1.4, fr.p[1] + 0.6), pz];
  rp.orbitA = Math.random() * 6.28;
}
function replayStep(dt) {
  const fi = Math.floor(rp.f), fr = rec[Math.min(rec.length - 1, fi)], fr2 = rec[Math.min(rec.length - 1, fi + 1)], k = rp.f - fi;
  const want = fr.air || fr.crash ? 0.4 : 1; rp.speed += (want - rp.speed) * Math.min(1, dt * 4);
  rp.f += dt * 30 * rp.speed; rp.shotT += dt;
  if (rp.f >= rec.length - 1) { rp.f = rp.i0; rp.shot = -1; nextShot(); }
  if (rp.shotT > (rp.shot === 1 ? 2.6 : 3.4)) nextShot();
  const p = v3.lerp(fr.p, fr2.p, k), root = new Float32Array(fr.root); root[12] = p[0]; root[13] = p[1]; root[14] = p[2];
  rpView = { p, root, pose: Object.assign({ board: save.board }, fr.pose) };
  const at = [p[0], p[1] + 0.9, p[2]];
  if (rp.shot === 0) { cam.eye = [...rp.fixed]; cam.at = at; const d = v3.len(v3.sub(at, cam.eye)); cam.fov = clamp(6 / d, 0.22, 0.9); }
  else if (rp.shot === 1) { const a = rp.orbitA + rp.shotT * 0.35, r = 3.2; cam.eye = [p[0] + Math.sin(a) * r, p[1] + 1.1, p[2] + Math.cos(a) * r]; cam.at = at; cam.fov = 0.8; }
  else { const v = v3.norm([fr.v[0], 0, fr.v[2] || 1]); cam.eye = [p[0] - v[0] * 5.5, p[1] + 2.0, p[2] - v[2] * 5.5]; cam.at = [p[0] + v[0] * 3, p[1] + 0.8, p[2] + v[2] * 3]; cam.fov = 1.0; }
  const g = heightAt(cam.eye[0], cam.eye[2]) + 0.5; if (cam.eye[1] < g) cam.eye[1] = g;
}
function replayScreen(dt) {
  replayStep(dt); render3D(dt);
  rpView = null;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 54); ctx.fillRect(0, H - 54, W, 54);
  const blink = Math.sin(t * 5) > 0;
  ctx.fillStyle = blink ? '#ef4444' : 'rgba(239,68,68,0.35)'; ctx.beginPath(); ctx.arc(46, 27, 7, 0, 7); ctx.fill();
  U.txt('REPLAY', 62, 27, 16, '#fff', 'left', { weight: 800, base: 'middle' });
  if (rp.speed < 0.7) U.txt('SLOW-MO', W - 40, 27, 14, '#fde047', 'right', { weight: 800, base: 'middle' });
  const prog = (rp.f - rp.i0) / Math.max(1, rec.length - 1 - rp.i0);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W / 2 - 200, H - 30, 400, 4); ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 200, H - 30, 400 * clamp(prog, 0, 1), 4);
  U.txt('ESC / ENTER to exit', W - 40, H - 27, 13, '#94a3b8', 'right', { weight: 700, base: 'middle' });
  if (U.pressed.Escape || U.pressed.Enter || U.pressed[KB().replay] || U.click) { screen = rp.back; rp = null; cam.off = null; if (screen === 'play') updateCam(0, true); }
}

// colour grade per run + speed streaks + flashes
const GRADE = {
  park: { cloud: 0.42, cloudC: [1.15, 1.15, 1.2], lift: [0.004, 0.01, 0.026], gain: [1.02, 1.0, 0.97], sat: 1.1, con: 1.05, shaft: 0.45 },
  pine: { cloud: 0.55, cloudC: [1.05, 1.07, 1.12], lift: [0.006, 0.012, 0.024], gain: [1.0, 1.0, 0.98], sat: 1.04, con: 1.05, shaft: 0.7 },
  summit: { cloud: 0.4, cloudC: [1.25, 1.0, 0.95], lift: [0.02, 0.008, 0.03], gain: [1.05, 0.99, 0.93], sat: 1.12, con: 1.06, shaft: 0.85 },
  bigair: { cloud: 0, cloudC: [0.1, 0.12, 0.2], lift: [0.008, 0.01, 0.03], gain: [1.0, 1.0, 1.04], sat: 1.06, con: 1.08, shaft: 0, thr: 0.75, bloom: 0.9 },
  garden: { cloud: 0.38, cloudC: [1.3, 1.05, 0.9], lift: [0.022, 0.01, 0.02], gain: [1.06, 1.0, 0.92], sat: 1.1, con: 1.05, shaft: 0.85 },
  bowl: { cloud: 0.85, cloudC: [0.82, 0.86, 0.94], lift: [0.02, 0.024, 0.034], gain: [0.98, 1.0, 1.03], sat: 0.9, con: 1.03, shaft: 0.3, bloom: 0.45 },
};
let fxFlash = 0, fxFlashC = [1, 1, 1];
function flash(k, col = [1, 1, 1]) { fxFlash = Math.max(fxFlash, k); fxFlashC = col; }
function postFX(dt) {
  const F = R3.fx, g = GRADE[C.id] || GRADE.park;
  F.lift = g.lift; F.gain = g.gain; F.sat = g.sat; F.con = g.con; F.shaft = g.shaft; F.thr = g.thr || 1.7; F.bloom = g.bloom || 0.4;
  F.sunC = C.sunCol.map(v => v * 0.6); F.vig = 0.5; F.time = t;
  const sp = P && screen === 'play' ? v3.len(P.v) : 0;
  F.speed += ((window.__noSpeedFx || (P && P.crash > 0) ? 0 : clamp((sp - 16) / 26, 0, 1)) - F.speed) * Math.min(1, dt * 4);
  fxFlash = Math.max(0, fxFlash - dt * 2.6); F.flash = fxFlash; F.flashC = fxFlashC;
}

// ------------------------------------------------------------ HUD
function pill(s, x, y, size, col = '#fff', bg = 'rgba(15,23,42,0.6)') {
  ctx.font = `800 ${size}px Inter, sans-serif`; const w = ctx.measureText(s).width + size * 1.6, h = size * 2;
  U.rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  U.txt(s, x, y, size, col, 'center', { weight: 800, base: 'middle', shadow: false });
}
function medalCol(m) { return ['#64748b', '#cd7f32', '#cbd5e1', '#facc15'][m] || '#64748b'; }
function fmtTime(s) { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; }
function drawHUD(dt) {
  ctx.clearRect(0, 0, W, H);
  const hg = ctx.createLinearGradient(0, 0, 0, 150); hg.addColorStop(0, 'rgba(10,15,30,0.42)'); hg.addColorStop(1, 'rgba(10,15,30,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 150);
  if (run.mode === 'race') drawRaceTop();
  else U.txt(run.score.toLocaleString(), 34, 22, 44, '#ffffff', 'left', { head: true, weight: 800 });
  if (run.combo > 1 && run.mode !== 'race') {
    U.txt(`×${run.combo}`, 36, 78, 22, '#fde047', 'left', { weight: 800, head: true });
    U.rr(84, 88, 120, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    U.rr(84, 88, Math.max(6, 120 * clamp(run.comboT / 3.2, 0, 1)), 6, 3); ctx.fillStyle = '#fde047'; ctx.fill();
  }
  if (run.mode !== 'bigair') {
    const prog = clamp(P.p[2] / C.len, 0, 1);
    U.rr(W / 2 - 200, 20, 400, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
    U.rr(W / 2 - 200, 20, Math.max(6, 400 * prog), 6, 3); ctx.fillStyle = '#ffffff'; ctx.fill();
    if (run.mode === 'slope') C.medals.forEach((m, i) => { ctx.fillStyle = run.score >= m ? medalCol(i + 1) : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(W / 2 - 30 + i * 30, 46, 7, 0, 7); ctx.fill(); });
  } else {
    U.txt(`JUMP ${Math.min(3, run.attempt + 1)} / 3`, W / 2, 18, 16, '#ffffff', 'center', { weight: 800 });
    run.attempts.forEach((s, i) => U.txt(i < run.attempt ? s.toLocaleString() : '–', W / 2 - 110 + i * 110, 44, 14, i < run.attempt ? '#e2e8f0' : 'rgba(255,255,255,0.35)', 'center', { weight: 700 }));
  }
  U.txt(`${Math.round(v3.len(P.v) * 3.6)}`, W - 82, 20, 40, '#ffffff', 'right', { head: true, weight: 800 });
  U.txt('km/h', W - 34, 40, 14, '#cbd5e1', 'right', { weight: 700 });
  U.txt(fmtTime(run.time), W - 34, 72, 16, '#e2e8f0', 'right', { weight: 700 });
  if (run.mode !== 'race') U.txt(`❄ ${run.tokens}`, W - 34, 96, 15, '#7dd3fc', 'right', { weight: 800 });
  // trick popups, newest on top
  const show = pops.slice(-3);
  show.forEach((p, i) => {
    p.t += dt;
    const life = p.big ? 2.6 : 2.0, a = p.t < 0.12 ? p.t / 0.12 : clamp(1 - (p.t - life + 0.5) / 0.5, 0, 1);
    const k = show.length - 1 - i, y = H * 0.22 + k * 70, sc = p.t < 0.15 ? 1.25 - p.t / 0.15 * 0.25 : 1;
    ctx.globalAlpha = a * (k ? 0.5 : 1);
    ctx.save(); ctx.translate(W / 2, y); ctx.scale(sc, sc);
    U.txt(p.text, 0, 0, k ? 22 : (p.big ? 40 : 34), p.col || '#ffffff', 'center', { head: true, weight: 800 });
    const line = [p.sub, p.q, p.rep].filter(Boolean).join('   ·   ');
    if (line && !k) U.txt(line, 0, p.big ? 50 : 44, 18, p.qCol || '#e2e8f0', 'center', { weight: 800 });
    ctx.restore(); ctx.globalAlpha = 1;
  });
  pops = pops.filter(p => p.t < (p.big ? 2.6 : 2.0));
  if (!P.ground && !P.rail && P.crash <= 0 && P.air > 0.15) {
    const sd = Math.round(Math.abs(P.spin) / Math.PI) * 180, fl = Math.round(Math.abs(P.flip) / (Math.PI * 2));
    const g = P.grab ? [...P.grabs, { type: P.grab, t: P.grabT }] : P.grabs;
    const nm = trickName(sd, fl, g, P.takeoffFakie);
    if (nm) pill(nm, W / 2, H - 120, 20);
  }
  if (P.rail) {
    const bx = W / 2, by = H - 130;
    U.rr(bx - 150, by, 300, 12, 6); ctx.fillStyle = 'rgba(15,23,42,0.55)'; ctx.fill();
    U.rr(bx - 45, by, 90, 12, 6); ctx.fillStyle = 'rgba(74,222,128,0.35)'; ctx.fill();
    const mx = bx + clamp(P.bal, -1, 1) * 150; ctx.fillStyle = Math.abs(P.bal) > 0.7 ? '#f87171' : '#ffffff'; ctx.beginPath(); ctx.arc(mx, by + 6, 10, 0, 7); ctx.fill();
    U.txt(P.stallT > 0 ? 'STALL!' : `BALANCE  ·  ${KN('left')} / ${KN('right')}`, bx, by + 22, 12, P.stallT > 0 ? '#fde047' : '#e2e8f0', 'center', { weight: 800 });
  }
  if (P.charge > 0.05 || P.queuedPop) {
    const k = P.queuedPop ? P.queuedPop : P.charge;
    U.rr(W / 2 - 60, H - 74, 120, 8, 4); ctx.fillStyle = 'rgba(15,23,42,0.5)'; ctx.fill();
    U.rr(W / 2 - 60, H - 74, Math.max(8, 120 * k), 8, 4); ctx.fillStyle = P.queuedPop ? '#7dd3fc' : '#fde047'; ctx.fill();
    if (P.queuedPop) U.txt('POP ON THE LIP', W / 2, H - 92, 12, '#7dd3fc', 'center', { weight: 800 });
  }
  if (run.startT > 0 && run.mode !== 'bigair') { const n = Math.ceil(run.startT); U.txt(n <= 3 ? String(n) : '', W / 2, H / 2 - 110, 110, '#ffffff', 'center', { head: true, weight: 800 }); }
  else if (run.mode !== 'bigair' && run.time < 0.9 && run.time > 0) U.txt(run.mode === 'race' ? 'GO!' : 'DROP IN!', W / 2, H / 2 - 110, 80, '#fde047', 'center', { head: true, weight: 800 });
  if (run.done && run.mode !== 'bigair') U.txt('FINISH', W / 2, H / 2 - 120, 92, '#ffffff', 'center', { head: true, weight: 800 });
  if (run.heat) drawHeatHUD();
  drawTips();
  if (fade > 0) { ctx.fillStyle = `rgba(5,7,15,${fade})`; ctx.fillRect(0, 0, W, H); fade = Math.max(0, fade - dt * 1.6); }
}
const TIPS = [
  ['ground', () => `${KN('left')} / ${KN('right')} to carve  ·  ${KN('up')} to tuck  ·  ${KN('down')} to brake  ·  hold ${KN('stall')} to butter`],
  ['charge', () => `Hold ${KN('jump')} to crouch, let go to jump. Hold ${KN('left')} or ${KN('right')} while crouching to wind up a spin`],
  ['air', () => `In the air: ${KN('left')} / ${KN('right')} spin  ·  ${KN('up')} / ${KN('down')} flip  ·  ${KN('g1')} ${KN('g2')} ${KN('g3')} ${KN('g4')} to grab`],
  ['land', 'Land with your skis pointing downhill. Backwards counts too: that is switch!'],
  ['rail', () => `Rails: keep your balance with ${KN('left')} / ${KN('right')}. Hold ${KN('stall')} to stall`],
];
function drawTips() {
  if (save.tips >= TIPS.length || run.mode !== 'slope' || run.startT > 0) return;
  const [when, text0] = TIPS[save.tips], text = typeof text0 === 'function' ? text0() : text0;
  const show = when === 'ground' ? run.time < 6 : when === 'charge' ? run.time > 6 && run.time < 14 : when === 'air' ? !P.ground && P.air > 0.2 : when === 'land' ? !P.ground && P.air > 0.45 : when === 'rail' ? P.p[2] > 500 && P.p[2] < 560 : false;
  if (show) { pill(text.replace('skis', save.board ? 'board' : 'skis'), W / 2, H - 36, 14); hint = when; }
  else if (hint === when) { save.tips++; store(); hint = null; }
}

// ------------------------------------------------------------ menus
let menuCam = 0, sel = save.course === 3 ? 0 : save.course;
function flyover(dt) {
  menuCam += dt;
  buildWorld(sel);
  if (!P || P.menuFor !== sel) { P = freshRider(30); P.menuFor = sel; P.v = [0, 0, 14]; snapCam(); }
  const z = 30 + ((menuCam * 14) % Math.max(100, C.len - 80)), x = cx(z) + Math.sin(z * 0.03) * 12;
  P.p = [x, heightAt(x, z), z]; P.v = [Math.cos(z * 0.03) * 0.36 * 14, 0, 14]; P.yaw = Math.atan2(P.v[0], P.v[2]); P.lean = -Math.cos(z * 0.03) * 0.5; P.ground = true; P.n = normalAt(x, z);
  P.upN = v3.norm(v3.lerp(P.upN, P.n, Math.min(1, dt * 8)));
}
function title(dt) {
  flyover(dt); updateCam(dt); render3D(dt);
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(8,12,28,0.82)'); g.addColorStop(0.5, 'rgba(8,12,28,0.25)'); g.addColorStop(1, 'rgba(8,12,28,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  U.txt('POWDER', 80, 84, 92, '#ffffff', 'left', { head: true, weight: 800 });
  U.txt('PEAK', 80, 172, 92, '#7dd3fc', 'left', { head: true, weight: 800 });
  U.txt('Freeride, park and big air on skis or a snowboard.', 84, 288, 18, '#e2e8f0', 'left', { weight: 600 });
  if (U.button('ride', 84, 340, 330, 64, 'RIDE', { color: '#3b82f6', size: 22 }) || U.pressed.Enter) screen = 'courses';
  if (U.button('rk', 84, 418, 160, 58, 'RANKED', { color: '#f59e0b', size: 17 })) openRanked();
  if (U.button('race', 254, 418, 160, 58, 'RACE', { color: '#10b981', size: 17 })) { screen = 'racesel'; if (sel > 2) sel = 0; }
  if (U.button('ba', 84, 488, 160, 50, 'BIG AIR', { color: '#e11d48', size: 15 })) newRun(COURSES.findIndex(c => c.bigair));
  if (U.button('rider', 254, 488, 160, 50, 'RIDER', { ghost: true, size: 15, sfx: 'tab' })) screen = 'rider';
  if (U.button('ctl', 84, 548, 330, 44, 'CONTROLS', { ghost: true, size: 14, sfx: 'tab' })) screen = 'controls';
  const medals = Object.values(save.medal).reduce((a, m) => a + (m || 0), 0), chs = Object.keys(save.ch).length, chTotal = COURSES.reduce((a, c) => a + c.ch.length, 0);
  U.txt(`Best ${(save.best || 0).toLocaleString()}   ·   Medals ${medals}/12   ·   Challenges ${chs}/${chTotal}`, 84, 612, 14, '#cbd5e1', 'left', { weight: 600 });
}
function wrap(s, x, y, maxW, size, col, lh) {
  ctx.font = `600 ${size}px Inter, sans-serif`; const words = s.split(' '); let line = '', yy = y;
  words.forEach(w => { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { U.txt(line, x, yy, size, col, 'left', { weight: 600, shadow: false }); line = w; yy += lh; } else line = tt; });
  if (line) U.txt(line, x, yy, size, col, 'left', { weight: 600, shadow: false });
}
function courses(dt) {
  flyover(dt); updateCam(dt); render3D(dt);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,12,28,0.55)'; ctx.fillRect(0, 0, W, H);
  U.txt('Choose a run', 70, 46, 40, '#fff', 'left', { head: true, weight: 800 });
  const ORDER = [0, 1, 2, 4, 5, 3].filter(i => COURSES[i]);
  ORDER.forEach((ci, i) => {
    const c = COURSES[ci], x = 70 + (i % 3) * 380, y = 100 + Math.floor(i / 3) * 154, w = 360, h = 140, on = sel === ci;
    U.panel(x, y, w, h, { fill: on ? 'rgba(37,99,235,0.35)' : 'rgba(14,15,22,0.78)', stroke: on ? '#93c5fd' : 'rgba(255,255,255,0.09)' });
    const sk = ctx.createLinearGradient(0, y + 14, 0, y + 58); sk.addColorStop(0, c.sky[0]); sk.addColorStop(1, c.sky[1]);
    ctx.save(); U.rr(x + 14, y + 14, 92, 112, 12); ctx.clip(); ctx.fillStyle = sk; ctx.fillRect(x + 14, y + 14, 92, 112);
    ctx.fillStyle = c.bigair ? 'rgba(180,190,220,0.6)' : 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.moveTo(x + 14, y + 96); ctx.lineTo(x + 40, y + 60); ctx.lineTo(x + 58, y + 74); ctx.lineTo(x + 80, y + 46); ctx.lineTo(x + 106, y + 80); ctx.lineTo(x + 106, y + 126); ctx.lineTo(x + 14, y + 126); ctx.fill(); ctx.restore();
    U.txt(c.name, x + 122, y + 16, 19, '#fff', 'left', { weight: 800 });
    wrap(c.blurb, x + 122, y + 46, w - 136, 12, '#cbd5e1', 16);
    const m = save.medal[c.id] || 0;
    [1, 2, 3].forEach(k => { ctx.fillStyle = m >= k ? medalCol(k) : 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(x + 130 + (k - 1) * 22, y + 116, 8, 0, 7); ctx.fill(); });
    U.txt(save.cbest[c.id] ? save.cbest[c.id].toLocaleString() : '—', x + w - 16, y + 106, 15, '#fff', 'right', { weight: 800 });
    if ((c.id === 'garden' || c.id === 'bowl') && !save.cbest[c.id]) U.txt('NEW', x + w - 16, y + 16, 11, '#4ade80', 'right', { weight: 800 });
    if (U.click && U.click.x > x && U.click.x < x + w && U.click.y > y && U.click.y < y + h) { U.click = null; if (sel !== ci) { sel = ci; Sound.play('tab'); } }
  });
  const oi = Math.max(0, ORDER.indexOf(sel));
  if (U.pressed.ArrowRight || U.pressed.KeyD) { sel = ORDER[(oi + 1) % ORDER.length]; Sound.play('tab'); }
  if (U.pressed.ArrowLeft || U.pressed.KeyA) { sel = ORDER[(oi + ORDER.length - 1) % ORDER.length]; Sound.play('tab'); }
  if (U.pressed.ArrowDown || U.pressed.KeyS) { sel = ORDER[(oi + 3) % ORDER.length]; Sound.play('tab'); }
  if (U.pressed.ArrowUp || U.pressed.KeyW) { sel = ORDER[(oi + 3) % ORDER.length]; Sound.play('tab'); }
  const c = COURSES[sel] || COURSES[0];
  U.panel(70, 422, 560, 196);
  U.txt('Challenges', 94, 440, 18, '#fff', 'left', { weight: 800 });
  c.ch.forEach(([, , text], i) => { const done = save.ch[c.id + ':' + i]; ctx.fillStyle = done ? '#22c55e' : 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(106, 486 + i * 40, 11, 0, 7); ctx.fill(); if (done) U.txt('✓', 106, 486 + i * 40, 14, '#fff', 'center', { base: 'middle', shadow: false, weight: 800 }); U.txt(text, 128, 486 + i * 40, 16, done ? '#86efac' : '#e2e8f0', 'left', { base: 'middle', weight: 600 }); });
  U.panel(650, 422, 560, 196);
  U.txt('Medals', 674, 440, 18, '#fff', 'left', { weight: 800 });
  ['Bronze', 'Silver', 'Gold'].forEach((n, i) => { ctx.fillStyle = medalCol(i + 1); ctx.beginPath(); ctx.arc(686, 486 + i * 40, 10, 0, 7); ctx.fill(); U.txt(`${n}  ·  ${c.medals[i].toLocaleString()}${c.bigair ? '  (best 2 jumps)' : ''}`, 708, 486 + i * 40, 16, '#e2e8f0', 'left', { base: 'middle', weight: 600 }); });
  if (U.button('go', 940, 638, 270, 58, 'DROP IN', { color: '#3b82f6', size: 20 }) || U.pressed.Enter || U.pressed.Space) newRun(sel);
  else if (U.button('back', 70, 638, 160, 58, 'BACK', { ghost: true, size: 16, sfx: 'back' }) || U.pressed.Escape) screen = 'title';
}
let riderSpin = 0;
function riderScreen(dt) {
  const rc = sel === 3 ? 0 : sel;
  buildWorld(rc);
  if (!P || P.menuFor !== 'rider') { P = freshRider(16); P.menuFor = 'rider'; P.v = [0, 0, 0]; P.upN = normalAt(P.p[0], P.p[2]); }
  riderSpin += dt * 0.6; P.yaw = riderSpin; P.lean = 0; P.ground = true;
  const p = P.p;
  cam.eye = [p[0] + 1.6, p[1] + 1.5, p[2] - 3.3]; cam.at = [p[0] - 0.75, p[1] + 0.85, p[2]]; cam.fov = 0.85;
  render3D(dt);
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(W, 0, W * 0.45, 0); g.addColorStop(0, 'rgba(8,12,28,0.88)'); g.addColorStop(1, 'rgba(8,12,28,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const x = 760;
  U.txt('Your rider', x, 56, 40, '#fff', 'left', { head: true, weight: 800 });
  const rebuild = () => { store(); myMesh = Rider.build(R3, look(), myMesh); };
  if (U.button('sk', x, 126, 200, 50, 'Skis', { ghost: save.board, size: 16, sfx: 'tab' })) { save.board = false; rebuild(); }
  if (U.button('sb', x + 214, 126, 200, 50, 'Snowboard', { ghost: !save.board, size: 16, sfx: 'tab' })) { save.board = true; rebuild(); }
  const swatches = (label, y, list, key) => {
    U.txt(label, x, y, 13, '#94a3b8', 'left', { weight: 700 });
    list.forEach((c, i) => { const sx = x + 16 + i * 40, sy = y + 36; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      if (save[key] === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, 18, 0, 7); ctx.stroke(); }
      if (U.click && Math.hypot(U.click.x - sx, U.click.y - sy) < 17) { U.click = null; save[key] = i; rebuild(); Sound.play('tab'); } });
  };
  if (outfit()) U.txt(`Shop outfit on: ${outfit().name} (change it in the arcade shop)`, x, 186, 12, '#fde047', 'left', { weight: 700 });
  swatches('JACKET', 204, JACKETS, 'jacket'); swatches('PANTS', 284, PANTS, 'pants'); swatches('HELMET', 364, HELMETS, 'helmet'); swatches(save.board ? 'BOARD' : 'SKIS', 444, DECKS, 'deck');
  if (U.button('cam', x, 538, 414, 48, `Camera: ${save.cam ? 'Close' : 'Normal'}`, { ghost: true, size: 15, sfx: 'tab' })) { save.cam = save.cam ? 0 : 1; store(); }
  if (U.button('done', x, 606, 414, 58, 'DONE', { color: '#3b82f6', size: 18 }) || U.pressed.Escape || U.pressed.Enter) { screen = 'title'; P = null; }
}
let rebind = null;
window.addEventListener('keydown', e => {
  if (!rebind) return;
  e.preventDefault(); e.stopPropagation();
  if (e.code === 'Escape') { rebind = null; return; }
  const B = KB(), was = B[rebind];
  // taking a key that another action uses swaps them
  for (const k in B) if (k !== rebind && B[k] === e.code) B[k] = was;
  B[rebind] = e.code; save.keys = B; store(); rebind = null; Sound.play('tab');
}, true);
function controlsScreen(dt) {
  flyover(dt); updateCam(dt); render3D(dt);
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(8,12,28,0.72)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 460, 40, 920, 640);
  U.txt('Controls', W / 2, 62, 34, '#fff', 'center', { head: true, weight: 800 });
  U.txt('Click a key to change it, then press the new key (ESC cancels). Arrow keys always steer too.', W / 2, 110, 14, '#94a3b8', 'center', { weight: 600 });
  const gk = GRAB_KEYS().map(g => GRAB_NAME[g]), B = KB();
  ACTIONS.forEach(([id, desc], i) => {
    const col = i < 6 ? 0 : 1, row = col ? i - 6 : i, x = W / 2 - 430 + col * 450, y = 150 + row * 64;
    const label = id[0] === 'g' && id.length === 2 ? `Grab: ${gk[+id[1] - 1]}` : desc;
    U.txt(label, x + 150, y + 26, 14, '#e2e8f0', 'left', { weight: 600, base: 'middle' });
    const on = rebind === id;
    if (U.button('kb' + id, x, y + 4, 136, 44, on ? 'PRESS A KEY' : keyName(B[id]), on ? { color: '#f59e0b', size: 13 } : { ghost: true, size: 15, sfx: 'tab' })) rebind = on ? null : id;
  });
  U.txt('Stalls: hold the stall key on a rail or box to stop dead, let go to slide on.  Butters: hold it on the snow (with tuck = nose, brake = tail)', W / 2, 560, 13, '#cbd5e1', 'center', { weight: 600 });
  U.txt('and steer to spin on your tips. Wind up spins by holding a steer key while you crouch for a jump.', W / 2, 580, 13, '#cbd5e1', 'center', { weight: 600 });
  if (U.button('kreset', W / 2 - 320, 616, 200, 50, 'RESET KEYS', { ghost: true, size: 14, sfx: 'tab' })) { save.keys = {}; store(); rebind = null; }
  if (U.button('gfx', W / 2 - 100, 616, 200, 50, 'GRAPHICS: ' + ['LOW', 'HIGH', 'ULTRA'][R3.quality], { ghost: true, size: 14, sfx: 'tab' })) { save.gfx = R3.hasPost ? (R3.quality + 1) % 3 : 0; store(); applyGfx(); }
  if (U.button('back', W / 2 + 120, 616, 200, 50, 'DONE', { color: '#3b82f6', size: 16, sfx: 'back' }) || (U.pressed.Escape && !rebind)) { rebind = null; screen = 'title'; }
}
function results() {
  ctx.fillStyle = 'rgba(8,12,28,0.55)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 360, 70, 720, 590);
  U.txt(C.bigair ? 'BIG AIR RESULTS' : 'RUN COMPLETE', W / 2, 96, 36, '#fff', 'center', { head: true, weight: 800 });
  U.txt(C.name, W / 2, 146, 15, '#94a3b8', 'center');
  U.txt(run.total.toLocaleString(), W / 2, 176, 64, '#fde047', 'center', { head: true, weight: 800 });
  const m = run.medal;
  if (m) { ctx.fillStyle = medalCol(m); ctx.beginPath(); ctx.arc(W / 2 - 92, 272, 14, 0, 7); ctx.fill(); U.txt(['', 'BRONZE', 'SILVER', 'GOLD'][m] + ' MEDAL', W / 2 - 70, 272, 18, medalCol(m), 'left', { base: 'middle', weight: 800 }); }
  else U.txt(`${(C.medals[0] - run.total).toLocaleString()} more for bronze`, W / 2, 272, 16, '#94a3b8', 'center', { base: 'middle', weight: 700 });
  U.txt(run.newBest ? 'NEW PERSONAL BEST' : `Best ${(save.cbest[C.id] || 0).toLocaleString()}`, W / 2, 300, 14, run.newBest ? '#4ade80' : '#94a3b8', 'center', { weight: 800 });
  const top = [...run.tricks].sort((a, b) => b.pts - a.pts).slice(0, 5);
  U.txt('Top tricks', W / 2 - 320, 334, 15, '#94a3b8', 'left', { weight: 800 });
  top.forEach((tr, i) => { ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - 320, 350, 230, 160); ctx.clip(); U.txt(tr.name, W / 2 - 320, 362 + i * 28, 16, '#fff', 'left', { weight: 700 }); ctx.restore(); U.txt(tr.pts.toLocaleString(), W / 2 - 20, 362 + i * 28, 16, '#fde047', 'right', { weight: 800 }); });
  if (!top.length) U.txt('No tricks landed yet. Hit the kickers and spin!', W / 2 - 320, 362, 15, '#cbd5e1', 'left');
  const stats = C.bigair ? run.attempts.map((s, i) => [`Jump ${i + 1}`, s.toLocaleString()]) : [['Time', fmtTime(run.time)], ['Snowflakes', `${run.tokens}`], ['Rails', `${run.rails}`], ['Top speed', `${Math.round(run.maxSpeed)} km/h`], ['Bails', `${run.crashes}`]];
  stats.forEach(([a, b], i) => { U.txt(a, W / 2 + 30, 362 + i * 28, 15, '#cbd5e1', 'left', { weight: 600 }); U.txt(b, W / 2 + 320, 362 + i * 28, 16, '#fff', 'right', { weight: 800 }); });
  if (run.chNew.length) U.txt('Challenge complete: ' + run.chNew.join(', '), W / 2, 524, 14, '#4ade80', 'center', { weight: 800 });
  if (U.button('again', W / 2 - 340, 574, 166, 58, 'RIDE AGAIN', { color: '#3b82f6', size: 16 }) || U.pressed.Enter) newRun(built);
  else if (U.button('replay', W / 2 - 166, 574, 160, 58, 'REPLAY', { color: '#ef4444', size: 16 }) || U.pressed[KB().replay]) startReplay(25, 'results');
  else if (U.button('runs', W / 2 + 2, 574, 160, 58, 'RUNS', { ghost: true, size: 16, sfx: 'tab' })) { screen = 'courses'; sel = built; P = null; Sound.playSong(SONGS.skiMenu); }
  else if (U.button('menu', W / 2 + 170, 574, 166, 58, 'MENU', { ghost: true, size: 16, sfx: 'back' }) || U.pressed.Escape) { screen = 'title'; P = null; Sound.playSong(SONGS.skiMenu); }
}

// ------------------------------------------------------------ ranked screens
function drawHeatHUD() {
  const h = run.heat, st = standings(), view = { x: 0, y: 0, w: W, h: H };
  // live standings
  const x = W - 260, y0 = 128;
  U.rr(x, y0, 226, 22 + st.length * 34, 14); ctx.fillStyle = 'rgba(10,15,30,0.5)'; ctx.fill();
  st.forEach(({ o, s }, i) => {
    const y = y0 + 12 + i * 34;
    if (o.me) { U.rr(x + 6, y - 4, 214, 32, 10); ctx.fillStyle = 'rgba(59,130,246,0.45)'; ctx.fill(); }
    U.txt(String(i + 1), x + 22, y + 12, 15, i === 0 ? '#fde047' : '#e2e8f0', 'center', { base: 'middle', weight: 800, shadow: false });
    ctx.fillStyle = o.me ? JACKETS[save.jacket] : o.look.jacket; ctx.beginPath(); ctx.arc(x + 44, y + 12, 6, 0, 7); ctx.fill();
    U.txt(o.name + (o.fin && !o.me ? ' ✓' : ''), x + 58, y + 12, 14, '#fff', 'left', { base: 'middle', weight: 700, shadow: false });
    U.txt(h.kind === 'race' ? (s != null ? fmtRace(s) : '') : s.toLocaleString(), x + 210, y + 12, 14, '#fde047', 'right', { base: 'middle', weight: 800, shadow: false });
  });
  // name tags over the other riders
  others().forEach(o => {
    const q = R3.project([o.P.p[0], o.P.p[1] + 2.4, o.P.p[2]], view);
    if (!q || q[0] < -50 || q[0] > W + 50 || q[1] < 0 || q[1] > H) return;
    const d = Math.hypot(o.P.p[0] - cam.eye[0], o.P.p[2] - cam.eye[2]); if (d > 160) return;
    ctx.globalAlpha = clamp(1.4 - d / 120, 0.4, 1);
    pill(o.name, q[0], q[1], 12, '#fff', 'rgba(15,23,42,0.55)');
    if (h.kind === 'race') { ctx.globalAlpha = 1; return; }
    const tr = o.cpu ? o.run.tricks[o.run.tricks.length - 1] : null, ttxt = o.cpu ? (tr && o.run.tricks.length !== o.seenT ? tr : null) : (o.lastTrick && t - o.lastTrickT < 2 ? o.lastTrick : null);
    if (o.cpu && tr && o.run.tricks.length !== o.seenT) { o.seenT = o.run.tricks.length; o.trickT = t; o.trickTxt = tr.name + '  +' + tr.pts.toLocaleString(); }
    const tt = o.cpu ? (o.trickT && t - o.trickT < 2 ? o.trickTxt : null) : ttxt;
    if (tt && d < 70 && (Math.abs(q[0] - W / 2) > 170 || q[1] > H * 0.5)) U.txt(tt, q[0], q[1] - 30, 12, '#fde047', 'center', { weight: 800 });
    ctx.globalAlpha = 1;
  });
  if (run.done && !h.closed) pill(h.kind === 'online' ? 'Waiting for the other rider to finish…' : 'Waiting for the others to finish…', W / 2, H - 60, 15);
}
function forfeit() {
  const h = run.heat;
  if (h && !h.closed) {
    if (h.kind === 'online') { reportOnline(false); netClose(); }
    else if (signedIn()) ACC().sb.rpc('ranked_game_cpu', { p_game: 'ski', p_cpu_elo: Math.round(h.riders.filter(o => o.cpu).reduce((a, o) => a + o.elo, 0) / 3), p_score: 0 }).then(r => { if (r.data && RK.me) RK.me.elo = r.data.elo; }).catch(() => {});
    else { save.relo = Math.max(0, (save.relo || 1000) - 12); save.rl = (save.rl || 0) + 1; store(); }
    h.closed = true;
  }
  run.heat = null; screen = 'ranked'; RK.screen = 'home'; P = null; loadRanked(); Sound.playSong(SONGS.skiMenu);
}
function rankedScreen(dt) {
  flyover(dt); updateCam(dt); render3D(dt);
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(8,12,28,0.66)'; ctx.fillRect(0, 0, W, H);
  U.txt('Ranked', 70, 44, 42, '#fff', 'left', { head: true, weight: 800 });
  U.txt('Slopestyle heats on a random mountain. Highest score wins. Win to climb.', 72, 100, 15, '#cbd5e1', 'left', { weight: 600 });
  const m = RK.me || { elo: myElo(), wins: 0, losses: 0, peak: myElo() }, rk = rankOf(m.elo);
  U.panel(70, 140, 560, 300);
  drawBadge(170, 250, 2.2 + Math.sin(t * 2) * 0.04, m.elo);
  U.txt(rk.name, 270, 184, 26, rk.col, 'left', { head: true, weight: 800 });
  U.txt(`${m.elo} Elo`, 270, 224, 22, '#fff', 'left', { weight: 800 });
  U.rr(270, 264, 320, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  U.rr(270, 264, Math.max(10, 320 * clamp((m.elo - rk.lo) / (rk.hi - rk.lo), 0, 1)), 10, 5); ctx.fillStyle = rk.col; ctx.fill();
  U.txt(`${m.wins || 0} wins  ·  ${m.losses || 0} losses  ·  best ${m.peak || m.elo}`, 270, 290, 14, '#94a3b8', 'left', { weight: 600 });
  U.txt(signedIn() ? 'Your rank is saved to your account.' : 'Not signed in: your rank stays on this computer.', 94, 360, 13, signedIn() ? '#86efac' : '#fbbf24', 'left', { weight: 600 });
  if (!signedIn()) U.txt('Sign in on the arcade to race real players.', 94, 382, 13, '#94a3b8', 'left', { weight: 600 });
  if (RK.err) U.txt(RK.err, 94, 408, 13, '#f87171', 'left', { weight: 700 });
  // leaderboard
  U.panel(650, 140, 560, 300);
  U.txt('Top riders', 674, 160, 18, '#fff', 'left', { weight: 800 });
  if (!RK.top.length) U.txt(signedIn() ? (RK.loading ? 'Loading…' : 'No ranked riders yet. Be the first!') : 'Sign in to see the online ladder.', 674, 200, 14, '#94a3b8', 'left', { weight: 600 });
  RK.top.forEach((r, i) => { const y = 198 + i * 29, rr = rankOf(r.elo); U.txt(`${i + 1}.`, 690, y, 14, '#94a3b8', 'right', { weight: 700 }); U.txt((r.profiles && r.profiles.username) || 'rider', 704, y, 14, '#fff', 'left', { weight: 700 }); U.txt(rr.name, 1050, y, 13, rr.col, 'right', { weight: 700 }); U.txt(String(r.elo), 1186, y, 14, '#fde047', 'right', { weight: 800 }); });
  // actions
  if (RK.screen === 'home') {
    if (U.button('cpu', 70, 470, 360, 84, 'RACE THE CPUs', { color: '#3b82f6', size: 20 })) startHeat(Math.floor(Math.random() * 3), 'cpu');
    U.txt('3 pro riders. They are good.', 250, 562, 13, '#94a3b8', 'center', { weight: 600 });
    if (U.button('pvp', 450, 470, 360, 84, 'FIND A PLAYER', { color: signedIn() ? '#f59e0b' : '#475569', size: 20 })) findMatch();
    U.txt('1 v 1 against a real rider online', 630, 562, 13, '#94a3b8', 'center', { weight: 600 });
    if (U.button('back', 830, 470, 380, 84, 'BACK', { ghost: true, size: 18, sfx: 'back' }) || U.pressed.Escape) { screen = 'title'; }
  } else {
    RK.qT = (RK.qT || 0) + dt;
    const txt = RK.screen === 'queue' ? `Looking for a rider…  ${Math.floor(RK.qT)}s` : 'Connecting…';
    U.panel(70, 470, 740, 84); U.txt(txt, 100, 512, 22, '#fff', 'left', { base: 'middle', weight: 800 });
    if (RK.screen === 'queue' && RK.qT > 40) U.txt('Nobody around? Race the CPUs meanwhile.', 100, 572, 13, '#94a3b8', 'left', { weight: 600 });
    if (RK.screen === 'connecting') U.txt(NetTransport.status.text || '', 100, 572, 13, '#94a3b8', 'left', { weight: 600 });
    if (U.button('cancel', 830, 470, 380, 84, 'CANCEL', { ghost: true, size: 18, sfx: 'back' }) || U.pressed.Escape) { queueLeave(); netClose(); RK.screen = 'home'; RK.qT = 0; }
  }
}
function heatResults() {
  const h = run.heat; if (!h) return;
  ctx.fillStyle = 'rgba(8,12,28,0.6)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 380, 60, 760, 600);
  const place = h.place, word = ['', '1st', '2nd', '3rd', '4th'][place] || place + 'th';
  U.txt(place === 1 ? 'YOU WIN!' : `${word} place`, W / 2, 86, 46, place === 1 ? '#fde047' : '#fff', 'center', { head: true, weight: 800 });
  U.txt(`${C.name}${h.forfeit ? '  ·  opponent left' : ''}`, W / 2, 148, 15, '#94a3b8', 'center', { weight: 600 });
  standings().forEach(({ o, s }, i) => {
    const y = 190 + i * 52;
    U.rr(W / 2 - 320, y, 640, 44, 12); ctx.fillStyle = o.me ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.05)'; ctx.fill();
    U.txt(String(i + 1), W / 2 - 290, y + 22, 20, i === 0 ? '#fde047' : '#e2e8f0', 'center', { base: 'middle', weight: 800, shadow: false });
    ctx.fillStyle = o.me ? JACKETS[save.jacket] : o.look.jacket; ctx.beginPath(); ctx.arc(W / 2 - 252, y + 22, 8, 0, 7); ctx.fill();
    U.txt(o.name, W / 2 - 232, y + 22, 18, '#fff', 'left', { base: 'middle', weight: 800, shadow: false });
    const best = o.me ? run.best : o.cpu ? o.run.best : null;
    if (best) U.txt(best.name, W / 2 - 40, y + 22, 13, '#94a3b8', 'left', { base: 'middle', weight: 600, shadow: false });
    U.txt(s.toLocaleString(), W / 2 + 300, y + 22, 18, '#fde047', 'right', { base: 'middle', weight: 800, shadow: false });
  });
  const r = h.result;
  const ry = 190 + h.riders.length * 52 + 20;
  if (r) {
    if (r.after == null) U.txt('Updating rank…', W / 2, ry, 16, '#94a3b8', 'center', { weight: 700 });
    else { const d = r.after - r.before, rk = rankOf(r.after); U.txt(`${d >= 0 ? '+' : ''}${d} Elo   →   ${r.after}   ${rk.name}`, W / 2, ry, 20, d >= 0 ? '#4ade80' : '#f87171', 'center', { weight: 800 }); if (rankOf(r.before).tier !== rk.tier || rankOf(r.before).name !== rk.name) U.txt(d >= 0 ? 'RANK UP!' : 'Rank down', W / 2, ry + 32, 15, rk.col, 'center', { weight: 800 }); }
    if (r.err) U.txt(r.err, W / 2, ry + 58, 13, '#f87171', 'center', { weight: 600 });
    if (r.pending) U.txt('Waiting for the other rider to confirm the result.', W / 2, ry + 58, 13, '#94a3b8', 'center', { weight: 600 });
  }
  const again = h.kind === 'online' ? 'FIND ANOTHER' : 'NEXT HEAT';
  if (U.button('again', W / 2 - 330, 586, 320, 58, again, { color: '#f59e0b', size: 18 }) || U.pressed.Enter) {
    const kind = h.kind; netClose(); run.heat = null;
    if (kind === 'online') { openRanked(); findMatch(); } else startHeat(Math.floor(Math.random() * 3), 'cpu');
  } else if (U.button('menu', W / 2 + 10, 586, 320, 58, 'RANKED MENU', { ghost: true, size: 18, sfx: 'back' }) || U.pressed.Escape) { netClose(); run.heat = null; P = null; openRanked(); Sound.playSong(SONGS.skiMenu); }
}

// ------------------------------------------------------------ loop
let last = 0, paused = false, hold = false;
function puff(p, v, life, size, grow = 1.2) { parts.push([p[0], p[1], p[2], v[0], v[1], v[2], life, size, 2, life, grow]); }
function puffBurst(n, size, spread, up, life = 1.4) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = rand(0.3, 1) * spread; puff([P.p[0] + Math.cos(a) * 0.4, P.p[1] + 0.25, P.p[2] + Math.sin(a) * 0.4], [Math.cos(a) * r + P.v[0] * 0.25, rand(0.3, 1) * up, Math.sin(a) * r + P.v[2] * 0.25], rand(life * 0.7, life * 1.2), size * rand(0.7, 1.2), 1.4); }
}
function effects(dt) {
  if (!P) return;
  if (P.ground && !P.rail && P.crash <= 0) {
    const sp = v3.len(P.v), I = input(), amt = clamp((P.slip - 1.5) / 6, 0, 1) + (I.down && sp > 4 ? 0.6 : 0);
    const S = sp > 0.5 ? v3.norm(v3.cross(P.n, v3.norm(P.v))) : [1, 0, 0], side = Math.sign(P.lean || 1);
    if (amt > 0 && Math.random() < amt * 1.5 && sp > 1) {
      for (let i = 0; i < 3; i++) parts.push([P.p[0] - side * S[0] * 0.3, P.p[1] + 0.1, P.p[2] - side * S[2] * 0.3, -side * S[0] * rand(2, 5) + P.v[0] * 0.4, rand(1, 3.4), -side * S[2] * rand(2, 5) + P.v[2] * 0.4, rand(0.4, 0.8), rand(0.12, 0.3), 0]);
      // a spray of powder off the edge on hard carves / skids
      if (Math.random() < amt * 0.7) puff([P.p[0] - side * S[0] * 0.35, P.p[1] + 0.2, P.p[2] - side * S[2] * 0.35], [-side * S[0] * rand(1.5, 3.5) + P.v[0] * 0.35, rand(0.6, 1.8), -side * S[2] * rand(1.5, 3.5) + P.v[2] * 0.35], rand(0.7, 1.2), rand(0.5, 0.9), 1.6);
    }
    // off the groomer, deep snow kicks up a lingering trail
    const deep = Math.abs(P.p[0] - cx(P.p[2])) > 40 || (C.rough && W0.roughAt(P.p[2]) > 0.7);
    if (deep && sp > 6 && Math.random() < dt * (6 + sp * 0.35)) puff([P.p[0] + rand(-0.3, 0.3), P.p[1] + 0.15, P.p[2] + rand(-0.3, 0.3)], [rand(-0.6, 0.6) + P.v[0] * 0.15, rand(0.4, 1.2), rand(-0.6, 0.6) + P.v[2] * 0.15], rand(1.2, 2.0), rand(0.5, 0.8), 1.1);
    const lt = tracks[tracks.length - 1];
    if (!lt || Math.hypot(lt.p[0] - P.p[0], lt.p[2] - P.p[2]) > 0.6) {
      const S = v3.norm(v3.cross(P.n, sp > 0.5 ? v3.norm(P.v) : [Math.sin(P.yaw), 0, Math.cos(P.yaw)]));
      tracks.push({ p: [...P.p], s: S, brk: !lt || Math.hypot(lt.p[0] - P.p[0], lt.p[2] - P.p[2]) > 2.5 });
      if (tracks.length > 420) tracks.shift();
    }
  }
  if (P.ground && !P.rail) P.upN = v3.norm(v3.lerp(P.upN, P.n, Math.min(1, dt * 10)));
  if (P.rail) P.upN = v3.norm(v3.lerp(P.upN, [0, 1, 0], Math.min(1, dt * 10)));
  if (P.grab) P.lastGrab = P.grab;
  // upper-body twist: wind up against the spin, lead into it in the air, face down the hill in carves
  const air = !P.ground && !P.rail && P.crash <= 0;
  const twT = P.crash > 0 ? 0 : air ? clamp((P.spinV || 0) * 0.06, -0.55, 0.55) : P.rail ? 0 : -(P.wind || 0) * 0.75 - P.lean * 0.18;
  P.twist = (P.twist || 0) + (twT - (P.twist || 0)) * Math.min(1, dt * (air ? 5 : 9));
}
function sounds(on) {
  if (!loops) return;
  if (!on || !P || P.crash > 0) { loops.wind.set(on ? 0.03 : 0.015); loops.carve.set(0); loops.grind.set(0); loops.snow.set(0); loops.rumble.set(0); return; }
  const sp = v3.len(P.v), gnd = P.ground && !P.rail, deep = Math.abs(P.p[0] - cx(P.p[2])) > 40 || W0.roughAt(P.p[2]) > 0.7;
  // snow under the skis: crunchy on the groomer, soft and muffled in powder, with a low rumble at speed
  loops.snow.set(gnd ? clamp(sp / 18, 0, 1) * (deep ? 0.09 : 0.13) * (0.7 + Math.random() * 0.6) : 0, deep ? 520 + sp * 8 : 900 + sp * 26);
  loops.rumble.set(gnd ? clamp((sp - 8) / 25, 0, 1) * 0.35 : 0, 110 + sp * 2);
  // whoosh for every half turn spun in the air
  if (!P.ground && !P.rail) { const d = Math.abs(P.spin - (P._lsp || 0)) + Math.abs(P.flip - (P._lfl || 0)); P._acc = (P._acc || 0) + d; if (P._acc > Math.PI) { P._acc -= Math.PI; Sound.hiss(0.22, { filter: 'bandpass', freq: 700, sweep: 2600, q: 1.4, vol: 0.09 }); } }
  else P._acc = 0;
  P._lsp = P.spin; P._lfl = P.flip;
  loops.wind.set(0.03 + clamp(sp / 32, 0, 1) * 0.2 + (C.wind || 0) * 0.1, 300 + sp * 28);
  loops.carve.set(P.ground && !P.rail ? clamp(sp / 25, 0, 1) * 0.05 + clamp(P.slip / 6, 0, 1) * 0.15 : 0, 1800 + sp * 60);
  loops.grind.set(P.rail ? 0.12 : 0, P.rail && P.rail.kind === 'log' ? 900 : 3200);
}
function frame(now) {
  const rawDt = (now - last) / 1000 || 0;
  let dt = Math.min(0.05, rawDt); last = now; t += dt; resTick(Math.min(0.1, rawDt));
  ensureLoops(); NetTransport.frame();
  if (screen === 'title') { title(dt); sounds(0); }
  else if (screen === 'courses') { courses(dt); sounds(0); }
  else if (screen === 'rider') { riderScreen(dt); sounds(0); }
  else if (screen === 'controls') { controlsScreen(dt); sounds(0); }
  else if (screen === 'ranked') { rankedScreen(dt); sounds(0); }
  else if (screen === 'racesel') { raceSelect(dt); sounds(0); }
  else if (screen === 'replay') { replayScreen(dt); sounds(0); }
  else {
    if (screen === 'play' && !paused && !hold) {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      for (let i = 0; i < n && screen === 'play'; i++) step(dt / n);
      effects(dt); recFrame(dt);
      heatTick(dt);
    }
    updateCam(paused || hold ? 0 : dt); render3D(paused || hold ? 0 : dt);
    drawHUD(paused ? 0 : dt);
    sounds(screen === 'play' && !paused ? 1 : 0);
    if (screen === 'results') results();
    if (screen === 'heatres') heatResults();
    if (screen === 'raceres') raceResults();
    if (paused) {
      ctx.fillStyle = 'rgba(8,12,28,0.6)'; ctx.fillRect(0, 0, W, H); U.panel(W / 2 - 210, 220, 420, 280);
      U.txt('Paused', W / 2, 246, 36, '#fff', 'center', { head: true, weight: 800 });
      if (U.button('res', W / 2 - 170, 310, 340, 56, 'RESUME', { color: '#3b82f6' }) || U.pressed.Escape) paused = false;
      else if ((!run.heat || run.heat.kind === 'race') && U.button('rst', W / 2 - 170, 378, 165, 48, 'RESTART', { ghost: true, size: 15 })) { paused = false; if (run.heat) startHeat(built, 'race', { diff: run.heat.diff }); else newRun(built); }
      else if (run.heat && run.heat.kind !== 'race') { if (U.button('quit', W / 2 + 5, 378, 165, 48, 'FORFEIT', { ghost: true, size: 15, sfx: 'back' })) { paused = false; forfeit(); } }
      else if (U.button('quit', W / 2 + 5, 378, 165, 48, 'MENU', { ghost: true, size: 15, sfx: 'back' })) { paused = false; const wasRace = run && run.mode === 'race'; if (run && run.heat) run.heat = null; screen = wasRace ? 'racesel' : 'title'; P = null; Sound.playSong(SONGS.skiMenu); }
      U.txt('C to change camera', W / 2, 450, 13, '#94a3b8', 'center', { weight: 600 });
    } else if (screen === 'play') {
      if (U.pressed.Escape) paused = true;
      if (paused && run.heat && run.heat.kind === 'online') { /* the other rider keeps going */ }
      if (U.pressed.KeyR && !run.heat) newRun(built);
      if (U.pressed[KB().replay] && !run.heat && !run.done) startReplay(8, 'play');
      if (U.pressed.KeyR && run.heat && run.heat.kind === 'race') startHeat(built, 'race', { diff: run.heat.diff });
    }
  }
  if (U.pressed[KB().cam] && screen === 'play') { save.cam = save.cam ? 0 : 1; store(); }
  U.endFrame();
  requestAnimationFrame(frame);
}

Sound.playSong(SONGS.skiMenu);
const fontReady = document.fonts ? Promise.race([document.fonts.load(`800 40px 'Plus Jakarta Sans'`), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
applyGfx();
fontReady.then(() => requestAnimationFrame(n => { last = n; frame(n); }));

window.__ski = {
  rebuild() { myMesh = Rider.build(R3, look(), myMesh); }, get cam() { return cam; }, get myMesh() { return myMesh; }, riderPose, riderRoot,
  U, get P() { return P; }, set P(v) { P = v; }, get run() { return run; }, get screen() { return screen; }, set screen(v) { screen = v; }, newRun, step, takeoff,
  get C() { return C; }, get W0() { return W0; }, recFrame, startReplay, heightAt, set bot(f) { botInput = f; }, snapCam() { updateCam(1, true); }, freeze(v) { hold = v; }, save: () => save, finishRun,
  get pops() { return pops; }, makeBrain, makeRaceBrain, startHeat, RACE, raceStandings, closeRace, get paused() { return paused; }, openRanked, standings: () => standings().map(x => [x.o.name, x.s, x.o.fin || false, x.o.cpu ? x.o.P.p[2].toFixed(0) : '', x.o.cpu ? x.o.run.crashes : '']), get RK() { return RK; },
  cpuTricks: () => run.heat.riders.filter(o => o.cpu).map(o => [o.name, o.run.tricks.map(t => t.name + ' ' + t.pts).join(' | ')]),
};
const inRun = () => screen === 'play' && P && run ? '' : 'Start a run first';
window.__cheats = [
  { name: 'Moon gravity', icon: '🌙', need: inRun, toggle: () => !!window.__moon, run() { window.__moon = !window.__moon; } },
  { name: '+10,000 points', icon: '⭐', need: inRun, run() { run.score += 10000; run.attemptScore += 10000; } },
  { name: 'Launch into the sky', icon: '🚀', need: inRun, run() { P.rail = null; P.p[1] += 0.3; P.v[1] = 22; takeoff('cheat'); } },
  { name: 'Skip to the finish', icon: '🏁', need: inRun, run() { if (run.mode === 'bigair') { finishRun(); return; } const z = C.len - 25, x = cx(z); P = Object.assign(freshRider(z), { p: [x, heightAt(x, z), z] }); P.v = [0, 0, 10]; snapCam(); } },
  { name: 'Unlock all medals', icon: '🏅', run() { COURSES.forEach(c => save.medal[c.id] = 3); store(); } },
];
setInterval(() => { if (window.__moon && P && !P.ground && !P.rail) P.v[1] += 7 * 0.05; }, 50);
// touch controls for phones / tablets
if (window.TouchPad) TouchPad.setup({ active: () => screen === 'play' && !paused && !!P, stick: { up: () => KB().up, down: () => KB().down, left: () => KB().left, right: () => KB().right }, pause: 'Escape',
  buttons: [{ label: 'JUMP', code: () => KB().jump, hold: true, color: 'rgba(59,130,246,0.6)' }, { label: 'GRAB', code: () => KB().g1, hold: true, color: 'rgba(245,158,11,0.5)' }, { label: 'STALL', code: () => KB().stall, hold: true, color: 'rgba(236,72,153,0.5)' }, { label: 'GRAB 2', code: () => KB().g2, hold: true }] });
})();
