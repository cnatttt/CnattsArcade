// =====================================================================
//  POWDER PEAK - 3D freeride ski / snowboard. Carve down the mountain,
//  hit kickers and rails, spin, flip and grab, land clean for points.
// =====================================================================
'use strict';
(() => {
const glc = document.getElementById('gl'), ui = document.getElementById('ui');
const R3 = createRenderer(glc);
const ctx = ui.getContext('2d');
const U = GameUI(ui), W = 1280, H = 720;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

if (!R3) { ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H); U.txt('Your browser does not support WebGL 2.', W / 2, H / 2, 24, '#fff', 'center'); return; }

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_ski';
let save = { best: 0, bestTime: 0, runs: 0, board: false, col: 0, course: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(save, s); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const JACKETS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#111827', '#f8fafc'];

SONGS.ski = { seed: 2024, bpm: 104, root: 62, scale: 'lydian', prog: [0, 4, 5, 3, 0, 4, 1, 3], density: 0.55, swing: 0.08,
  bass: 'x.....x...x.....', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x.x.x.', pad: true, arp: true, arpRate: 2, arpOct: 1, introNoLead: true, form: ['A', 'B', 'A', 'C'] };
SONGS.skiMenu = { seed: 88, bpm: 80, root: 57, scale: 'major', prog: [0, 4, 5, 3], density: 0.45, swing: 0.1, bass: 'x.......x.......', kick: 'x.......x.......', hat: '..x...x...x...x.', pad: true, arp: true, arpRate: 2, introNoDrums: true, introNoLead: true };
let windNode = null;
const sfx = {
  land(clean) { Sound.hiss(0.25, { filter: 'lowpass', freq: clean ? 1800 : 900, vol: 0.3 }); Sound.blip(clean ? 140 : 90, 0.12, { type: 'sine', vol: 0.3, slide: 60 }); },
  trick() { [659, 880, 1175].forEach((f, i) => Sound.blip(f, 0.1, { type: 'sine', vol: 0.12, delay: i * 0.05 })); },
  crash() { Sound.hiss(0.6, { filter: 'lowpass', freq: 1200, sweep: 200, vol: 0.4 }); Sound.blip(110, 0.3, { type: 'triangle', vol: 0.3, slide: 50 }); },
  pop() { Sound.hiss(0.12, { filter: 'bandpass', freq: 1800, q: 1, vol: 0.18 }); },
  token() { Sound.blip(1320, 0.08, { type: 'sine', vol: 0.12 }); Sound.blip(1760, 0.12, { type: 'sine', vol: 0.1, delay: 0.06 }); },
  grind() { Sound.hiss(0.08, { filter: 'highpass', freq: 4000, vol: 0.06 }); },
};

// ------------------------------------------------------------ the mountain
const COURSES = [
  { name: 'Bluebird Bowl', len: 1500, seed: 11, slope: 0.36, sky: ['#3d7fe0', '#cfe6ff'], fog: [0.82, 0.89, 0.97], fogD: 0.0017, sun: [0.4, 0.75, -0.5], kickers: 9, rails: 5, trees: 1 },
  { name: 'Pine Forest', len: 1800, seed: 23, slope: 0.4, sky: ['#5a8fd0', '#e4eef8'], fog: [0.86, 0.9, 0.95], fogD: 0.0023, sun: [-0.4, 0.7, -0.6], kickers: 11, rails: 6, trees: 2.2 },
  { name: 'Sunset Couloir', len: 1600, seed: 37, slope: 0.46, sky: ['#5b4b9a', '#ffc79a'], fog: [0.98, 0.82, 0.72], fogD: 0.002, sun: [0.3, 0.35, -0.9], kickers: 12, rails: 6, trees: 1.3 },
];
let C = null, feats = null;
const cx = z => 38 * Math.sin(z * 0.0041) + 22 * Math.sin(z * 0.0013 + 1);
function terrain(x, z) {
  let y = -z * C.slope - Math.max(0, z - 300) * 0.05 + 7 * Math.sin(z * 0.009) + 2.4 * Math.sin(z * 0.031 + x * 0.04) + 1.2 * Math.sin(x * 0.11 + z * 0.05);
  const dx = x - cx(z), half = 62;
  const out = Math.max(0, Math.abs(dx) - half); y += out * 0.28 + out * out * 0.0025 + Math.sin(x * 0.05 + z * 0.02) * Math.min(out, 40) * 0.08;
  if (z < 40) y = Math.max(y, -z * 0.2 + (40 - z) * 0.4);   // start plateau
  return y;
}
function heightAt(x, z) {
  let y = terrain(x, z);
  for (const k of feats.kickers) {
    const u = z - (k.z - k.len), v = Math.abs(x - k.x);
    if (u > 0 && u < k.len && v < k.w / 2) y += k.h * Math.pow(u / k.len, 1.6);
  }
  return y;
}
function normalAt(x, z) { const e = 0.8; const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); const n = [-hx, 2 * e, -hz]; const l = Math.hypot(...n); return [n[0] / l, n[1] / l, n[2] / l]; }

function buildCourse(ci) {
  C = COURSES[ci]; const R = rng(C.seed);
  feats = { kickers: [], rails: [], trees: [], rocks: [], tokens: [] };
  for (let i = 0; i < C.kickers; i++) {
    const z = 140 + (i + 0.5) * (C.len - 220) / C.kickers + (R() - 0.5) * 40;
    const big = R() < 0.3, x = cx(z) + (R() - 0.5) * 40;
    feats.kickers.push({ x, z, w: big ? 14 : 10, len: big ? 16 : 11, h: big ? 4.4 : 2.6, big });
    if (R() < 0.5) feats.kickers.push({ x: x + (R() < 0.5 ? -24 : 24), z: z + 6, w: 8, len: 8, h: 1.6, big: false });
  }
  for (let i = 0; i < C.rails; i++) {
    const z0 = 200 + (i + 0.3) * (C.len - 320) / C.rails + (R() - 0.5) * 30, x = cx(z0) + (R() < 0.5 ? -1 : 1) * (12 + R() * 16), len = 18 + R() * 16;
    if (feats.kickers.some(k => Math.abs(k.z - z0 - len / 2) < len)) continue;
    feats.rails.push({ x, z0, z1: z0 + len, hgt: 1.0, box: R() < 0.4 });
  }
  const treeN = Math.round(900 * C.trees);
  for (let i = 0; i < treeN; i++) {
    const z = R() * (C.len + 200) - 40, side = R() < 0.5 ? -1 : 1, edge = R() < 0.82;
    const x = cx(z) + (edge ? side * (52 + R() * 120) : (R() - 0.5) * 100);
    if (!edge && (z < 80 || feats.kickers.some(k => Math.hypot(k.x - x, k.z - z) < 30) || feats.rails.some(r => Math.abs(r.x - x) < 8 && z > r.z0 - 10 && z < r.z1 + 10))) continue;
    if (!edge && R() < 0.5) continue;
    feats.trees.push({ x, z, s: 0.7 + R() * 0.8, y: 0 });
  }
  for (let i = 0; i < 70; i++) { const z = 60 + R() * C.len, x = cx(z) + (R() - 0.5) * 120; if (Math.abs(x - cx(z)) < 18) continue; feats.rocks.push({ x, z, s: 0.8 + R() * 1.6 }); }
  // tokens show good lines: in front of kickers and along the middle
  for (let z = 80; z < C.len - 20; z += 22) { const x = cx(z) + Math.sin(z * 0.02) * 14; if (feats.kickers.some(k => Math.abs(k.z - z) < 20) || feats.trees.some(t => Math.hypot(t.x - x, t.z - z) < 4)) continue; feats.tokens.push({ x, z, got: false }); }
  feats.trees.forEach(t => t.y = terrain(t.x, t.z)); feats.rocks.forEach(r => r.y = terrain(r.x, r.z));
  buildMeshes();
}

// ------------------------------------------------------------ meshes
let chunks = [], kickerMesh = null, railMesh = null, skyMesh = null, finishMesh = null, rider = null, tokenMesh = null, ghostRider = null;
const CH = 48;
function snowCol(y, n, R) { const k = 0.8 + R() * 0.035; const blue = clamp((1 - n[1]) * 2.2, 0, 1); return [k - 0.04 - blue * 0.1, k - 0.01 - blue * 0.04, k + 0.05]; }
function buildMeshes() {
  chunks.forEach(c => R3.free(c.m)); chunks = [];
  const R = rng(C.seed + 5);
  for (let z0 = -80; z0 < C.len + 260; z0 += CH) {
    const mb = new MB(), step = 4, xs = [];
    const cz = cx(z0 + CH / 2);
    for (let x = cz - 200; x <= cz + 200; x += step) xs.push(x);
    for (let z = z0; z < z0 + CH; z += step) for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      const p = (x, zz) => [x, terrain(x, zz), zz];
      const a = p(x0, z), b = p(x1, z), c = p(x1, z + step), d = p(x0, z + step);
      const n = normalAt((x0 + x1) / 2, z + 2);
      let col = snowCol(a[1], n, R);
      if (n[1] < 0.8) col = [0.4 + R() * 0.05, 0.42, 0.48];   // steep = rock
      mb.tri(a, c, b, [...col, 0]); mb.tri(a, d, c, [...col, 0]);
    }
    // trees + rocks in this chunk
    feats.trees.forEach(t => { if (t.z < z0 || t.z >= z0 + CH) return; const s = t.s;
      mb.cyl(M4.compose(t.x, t.y - 0.5, t.z, 0, 0.35 * s, 2.2 * s, 0.35 * s), 6, [0.32, 0.22, 0.15], [0.3, 0.2, 0.14]);
      for (let k = 0; k < 3; k++) { const yy = t.y + (1.3 + k * 1.9) * s, rr = (2.6 - k * 0.65) * s; mb.cone(M4.compose(t.x, yy, t.z, R() * 6, rr, 2.6 * s, rr), 7, [0.09, 0.27 + R() * 0.06, 0.17], 0.12); mb.cone(M4.compose(t.x, yy + 1.0 * s, t.z, R() * 6, rr * 0.55, 1.2 * s, rr * 0.55), 7, [0.93, 0.95, 1], 0.03); } });
    feats.rocks.forEach(r => { if (r.z < z0 || r.z >= z0 + CH) return; mb.sphere(M4.compose(r.x, r.y + r.s * 0.3, r.z, R() * 6, r.s * 1.4, r.s, r.s * 1.2), 6, 4, [0.42, 0.43, 0.47], 0.2); mb.sphere(M4.compose(r.x, r.y + r.s * 0.9, r.z, 0, r.s * 0.9, r.s * 0.35, r.s * 0.8), 6, 3, [0.95, 0.96, 1], 0.03); });
    chunks.push({ z0, m: R3.mesh(mb) });
  }
  // kickers: wooden wedge covered in snow
  const km = new MB();
  feats.kickers.forEach(k => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, z0 = k.z - k.len + u0 * k.len, z1 = k.z - k.len + u1 * k.len;
      const yA = terrain(k.x, z0) + k.h * Math.pow(u0, 1.6), yB = terrain(k.x, z1) + k.h * Math.pow(u1, 1.6);
      const L = k.x - k.w / 2, Rr = k.x + k.w / 2;
      km.quad([L, yA, z0], [Rr, yA, z0], [Rr, yB, z1], [L, yB, z1], [0.96, 0.97, 1, 0]);
      [[L, -1], [Rr, 1]].forEach(([x, s]) => km.quad([x, terrain(x, z0) - 0.3, z0], [x, yA, z0], [x, yB, z1], [x, terrain(x, z1) - 0.3, z1], [0.82, 0.86, 0.95, 0]));
    }
    const zl = k.z, yl = terrain(k.x, zl) + k.h;
    km.quad([k.x - k.w / 2, terrain(k.x, zl) - 0.3, zl], [k.x + k.w / 2, terrain(k.x, zl) - 0.3, zl], [k.x + k.w / 2, yl, zl], [k.x - k.w / 2, yl, zl], [0.55, 0.38, 0.24, 0]);
    // marker flags
    [-1, 1].forEach(s => { km.cyl(M4.compose(k.x + s * (k.w / 2 + 0.6), yl - 0.2, zl, 0, 0.06, 2.2, 0.06), 5, [0.2, 0.2, 0.2]); km.box(M4.compose(k.x + s * (k.w / 2 + 0.6) + 0.35, yl + 1.7, zl, 0, 0.7, 0.45, 0.04), k.big ? [0.95, 0.3, 0.2, 0.3] : [0.2, 0.55, 0.95, 0.3]); });
  });
  R3.free(kickerMesh); kickerMesh = R3.mesh(km);
  const rm = new MB();
  feats.rails.forEach(r => {
    const n = Math.ceil((r.z1 - r.z0) / 2);
    for (let i = 0; i < n; i++) {
      const z0 = r.z0 + i / n * (r.z1 - r.z0), z1 = r.z0 + (i + 1) / n * (r.z1 - r.z0), y0 = terrain(r.x, z0) + r.hgt, y1 = terrain(r.x, z1) + r.hgt, w = r.box ? 0.45 : 0.08;
      rm.quad([r.x - w, y0, z0], [r.x + w, y0, z0], [r.x + w, y1, z1], [r.x - w, y1, z1], r.box ? [0.95, 0.75, 0.15, 0] : [0.85, 0.87, 0.92, 0]);
      rm.quad([r.x - w, y0 - 0.12, z0], [r.x - w, y0, z0], [r.x - w, y1, z1], [r.x - w, y1 - 0.12, z1], [0.5, 0.52, 0.58, 0]);
      rm.quad([r.x + w, y0 - 0.12, z0], [r.x + w, y0, z0], [r.x + w, y1, z1], [r.x + w, y1 - 0.12, z1], [0.5, 0.52, 0.58, 0]);
    }
    for (let z = r.z0; z <= r.z1; z += (r.z1 - r.z0) / 3) rm.cyl(M4.compose(r.x, terrain(r.x, z) - 0.2, z, 0, 0.07, r.hgt + 0.1, 0.07), 5, [0.3, 0.32, 0.38]);
  });
  // finish arch
  const fz = C.len, fx = cx(fz), fy = terrain(fx, fz);
  [-1, 1].forEach(s => rm.box(M4.compose(fx + s * 20, fy + 3, fz, 0, 1, 6.5, 1), [0.9, 0.2, 0.25, 0]));
  rm.box(M4.compose(fx, fy + 6.6, fz, 0, 42, 1.6, 0.6), [0.9, 0.2, 0.25, 0.25]);
  for (let i = 0; i < 10; i++) rm.box(M4.compose(fx - 18 + i * 4, fy + 6.6, fz - 0.35, 0, 1.8, 1.3, 0.05), i % 2 ? [1, 1, 1, 0.4] : [0.1, 0.1, 0.12, 0.2]);
  R3.free(railMesh); railMesh = R3.mesh(rm);
  // sky dome with distant peaks
  const sk = new MB(), top = col4(C.sky[0]), hor = col4(C.sky[1]), SR = 1800;
  for (let v = 0; v < 12; v++) for (let u = 0; u < 28; u++) {
    const e0 = v / 12 * Math.PI / 2, e1 = (v + 1) / 12 * Math.PI / 2, a0 = u / 28 * 6.283, a1 = (u + 1) / 28 * 6.283;
    const p = (e, a) => [Math.cos(a) * Math.cos(e) * SR, Math.sin(e) * SR, Math.sin(a) * Math.cos(e) * SR];
    const k = Math.pow((v + 0.5) / 12, 0.6); const c = [lerp(hor[0], top[0], k), lerp(hor[1], top[1], k), lerp(hor[2], top[2], k), 1];
    sk.quad(p(e0, a0), p(e0, a1), p(e1, a1), p(e1, a0), c);
  }
  for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283 + R() * 0.1, d = SR * 0.8, h = 140 + R() * 260, w = 160 + R() * 160; sk.cone(M4.compose(Math.cos(a) * d, -60, Math.sin(a) * d, R() * 6, w, h, w), 6, [0.62, 0.68, 0.8, 0.6], 0.06); sk.cone(M4.compose(Math.cos(a) * d, -60 + h * 0.6, Math.sin(a) * d, 0, w * 0.4, h * 0.4, w * 0.4), 6, [0.97, 0.98, 1, 0.7], 0.03); }
  R3.free(skyMesh); skyMesh = R3.mesh(sk);
  // token (snowflake gem)
  const tm = new MB(); tm.sphere(M4.compose(0, 0, 0, 0, 0.5, 0.7, 0.5), 6, 4, [0.4, 0.85, 1, 0.8], 0); R3.free(tokenMesh); tokenMesh = R3.mesh(tm);
}
function buildRider(board, jacket) {
  const mb = new MB(), J = col4(jacket), P = [0.12, 0.13, 0.18], skin = [0.95, 0.78, 0.65], helm = col4(jacket === '#f8fafc' ? '#111827' : '#f8fafc');
  if (board) {
    mb.box(M4.compose(0, 0.06, 0, Math.PI / 2, 0.32, 0.05, 1.6), [0.15, 0.15, 0.2], 0, J);   // board (across)
    [-0.22, 0.22].forEach(s => { mb.box(M4.compose(s, 0.55, 0, 0, 0.17, 0.95, 0.19), P); });
    mb.box(M4.compose(0, 1.35, 0, 0, 0.55, 0.7, 0.32), J);
    [-0.38, 0.38].forEach(s => mb.box(M4.compose(s, 1.3, 0, 0, 0.14, 0.6, 0.16), J));
  } else {
    [-0.18, 0.18].forEach(s => { mb.box(M4.compose(s, 0.04, 0.1, 0, 0.11, 0.05, 1.9), [0.1, 0.1, 0.12], 0, J); mb.box(M4.compose(s, 0.55, 0, 0, 0.17, 0.95, 0.2), P); });
    mb.box(M4.compose(0, 1.35, -0.05, 0, 0.55, 0.7, 0.32), J);
    [-0.38, 0.38].forEach(s => { mb.box(M4.compose(s, 1.25, 0.12, 0, 0.13, 0.55, 0.15), J); mb.cyl(M4.compose(s * 1.25, 0.2, 0.25, 0, 0.025, 1.2, 0.025), 4, [0.7, 0.72, 0.78]); });
  }
  mb.sphere(M4.compose(0, 1.98, 0, 0, 0.24, 0.26, 0.24), 8, 6, skin, 0);
  mb.sphere(M4.compose(0, 2.06, -0.02, 0, 0.27, 0.22, 0.27), 8, 5, helm, 0);
  mb.box(M4.compose(0, 2.0, 0.21, 0, 0.36, 0.11, 0.05), [0.95, 0.6, 0.15, 0.5]);
  return R3.mesh(mb);
}

// ------------------------------------------------------------ rider physics
const G = 15;
let P = null, screen = 'title', t = 0, run = null, cam = { eye: [0, 10, -12], at: [0, 0, 10], fov: 1.05 }, pops = [], parts = [];
function newRun(ci) {
  buildCourse(ci); save.course = ci; store();
  const x = cx(10);
  P = { x, z: 10, y: heightAt(x, 10), vx: 0, vy: 0, vz: 4, yaw: 0, ground: true, air: 0, spin: 0, flip: 0, roll: 0, grab: 0, charge: 0, crash: 0, grind: null, grindT: 0, tuck: 0, lean: 0, lastLand: -9 };
  run = { time: 0, score: 0, combo: 1, comboT: 0, tokens: 0, done: false, tricks: 0, best: '', bestPts: 0, startT: 3 };
  if (rider) R3.free(rider); rider = buildRider(save.board, JACKETS[save.col]);
  feats.tokens.forEach(k => k.got = false);
  screen = 'play'; pops = []; parts = [];
  Sound.playSong(SONGS.ski);
}
function readInput() {
  const k = U.keys;
  return { left: k.KeyA || k.ArrowLeft, right: k.KeyD || k.ArrowRight, up: k.KeyW || k.ArrowUp, down: k.KeyS || k.ArrowDown, jump: k.Space, grab: k.ShiftLeft || k.ShiftRight || k.KeyK };
}
const GRABS = ['MUTE GRAB', 'INDY', 'SAFETY', 'JAPAN', 'TAIL GRAB', 'MELON', 'STALEFISH'];
function trickName(spinDeg, flips, grab) {
  const parts2 = [];
  if (flips >= 1) parts2.push((flips >= 3 ? 'TRIPLE ' : flips === 2 ? 'DOUBLE ' : '') + (P.flipDir > 0 ? 'FRONTFLIP' : 'BACKFLIP'));
  if (spinDeg >= 180) parts2.push(spinDeg + (flips ? '' : ' SPIN'));
  if (grab) parts2.push(grab);
  return parts2.join(' + ');
}
function crash(why) {
  if (P.crash > 0) return;
  P.crash = 1.6; P.ground = true; P.grind = null; run.combo = 1; run.comboT = 0; sfx.crash();
  pops.push({ text: why || 'BAIL!', sub: '', col: '#f87171', t: 0 });
  for (let i = 0; i < 40; i++) parts.push([P.x, P.y + 0.5, P.z, rand(-4, 4), rand(1, 6), rand(-2, 6), 0, rand(0.6, 1.2)]);
}
function land() {
  // was it clean? skis/board must point along the direction of travel and be upright
  const travel = Math.atan2(P.vx, P.vz), facing = P.yaw + P.spin;
  const d = Math.abs(angDiff(facing, travel)), dSwitch = Math.abs(angDiff(facing + Math.PI, travel));
  const pitchOff = Math.abs(angDiff(0, P.flip % (Math.PI * 2)));
  const clean = pitchOff < 0.75 && Math.min(d, dSwitch) < 0.75 && P.crash <= 0;
  if (!clean) { crash(pitchOff >= 0.75 ? 'OVER-ROTATED!' : 'SKETCHY LANDING'); P.spin = 0; P.flip = 0; P.grab = 0; return; }
  const spinDeg = Math.round(Math.abs(P.spinTotal) / Math.PI) * 180, flips = Math.round(Math.abs(P.flipTotal) / (Math.PI * 2));
  const grab = P.grabT > 0.35 ? P.grabName : null;
  const switchLand = dSwitch < d && spinDeg > 0;
  let pts = Math.round((spinDeg / 180) * 120 + flips * 400 + (grab ? 150 + Math.min(1.5, P.grabT) * 120 : 0) + P.air * 60);
  if (pts > 60 && (spinDeg || flips || grab)) {
    if (switchLand) pts = Math.round(pts * 1.2);
    run.comboT = 4; const gained = pts * run.combo; run.score += gained; run.tricks++;
    const name = (switchLand ? 'SWITCH ' : '') + trickName(spinDeg, flips, grab);
    if (gained > run.bestPts) { run.bestPts = gained; run.best = name; }
    pops.push({ text: name, sub: `+${gained.toLocaleString()}${run.combo > 1 ? `  (x${run.combo})` : ''}`, col: '#fde047', t: 0 });
    run.combo = Math.min(8, run.combo + 1); sfx.trick();
  } else if (P.air > 0.9) { run.score += Math.round(P.air * 40 * run.combo); pops.push({ text: 'BIG AIR', sub: `+${Math.round(P.air * 40 * run.combo)}`, col: '#93c5fd', t: 0 }); }
  sfx.land(true);
  // reorient: keep the facing (switch is fine), drop rotation
  P.yaw = switchLand ? travel : travel; P.spin = 0; P.flip = 0; P.grab = 0;
  for (let i = 0; i < 18; i++) parts.push([P.x, P.y + 0.2, P.z, rand(-3, 3), rand(1, 3.5), rand(-1, 3), 0, rand(0.4, 0.8)]);
}
function blocked(x, z) { return feats.trees.some(t => Math.abs(t.z - z) < 3 && Math.abs(t.x - x) < 3 * t.s) || feats.rocks.some(r => Math.hypot(r.x - x, r.z - z) < r.s * 2); }
function stepRider(dt) {
  const I = readInput();
  if (run.startT > 0) { run.startT -= dt; if (run.startT > 0) { P.vx = P.vz = 0; P.vz = 2; return; } }
  if (!run.done) run.time += dt;
  run.comboT -= dt; if (run.comboT <= 0 && run.combo > 1) { run.combo = 1; }
  if (P.crash > 0) {
    P.crash -= dt; P.vx *= Math.exp(-dt * 3); P.vz *= Math.exp(-dt * 3); P.x += P.vx * dt; P.z += P.vz * dt; P.y = heightAt(P.x, P.z);
    P.roll += dt * 9;
    if (P.crash <= 0) { P.roll = 0; P.yaw = 0; P.vx = 0; P.vz = 6; P.spin = P.flip = 0; P.ground = true; P.safe = 1.2;
      if (blocked(P.x, P.z)) { P.x = cx(P.z); if (blocked(P.x, P.z)) P.z += 4; P.y = heightAt(P.x, P.z); } }
    return;
  }
  // grinding
  if (P.grind) {
    const r = P.grind; P.grindT += dt; P.x = r.x; P.z += P.vz * dt; P.vz = Math.max(P.vz, 8); P.y = terrain(r.x, P.z) + r.hgt + 0.05;
    run.score += Math.round(dt * 220 * run.combo); if (Math.random() < 0.3) sfx.grind();
    parts.push([P.x, P.y, P.z, rand(-1, 1), rand(0.5, 2), rand(-1, 0), 1, 0.3]);
    if (P.z > r.z1 || I.jump && P.grindT > 0.25) {
      const pts = Math.round(P.grindT * 300) * run.combo; run.score += pts; run.combo = Math.min(8, run.combo + 1); run.comboT = 4;
      pops.push({ text: r.box ? 'BOARDSLIDE' : '50-50 GRIND', sub: `+${pts}`, col: '#fde047', t: 0 }); sfx.trick();
      P.grind = null; P.ground = false; P.vy = 4.5; P.air = 0; P.spinTotal = P.flipTotal = 0; P.grabT = 0; P.flipDir = 0;
    }
    return;
  }
  if (P.ground) {
    const n = normalAt(P.x, P.z);
    // gravity along the slope
    P.vx += G * n[0] * n[1] * dt; P.vz += G * n[2] * n[1] * dt;
    // steering
    const sp = Math.hypot(P.vx, P.vz);
    const steer = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    P.yaw += steer * dt * (sp < 6 ? 2.6 : 1.9) * (I.down ? 1.3 : 1);
    P.lean = lerp(P.lean, steer, dt * 6);
    // grip: velocity follows the skis
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let along = P.vx * fx + P.vz * fz, side = P.vx * fz - P.vz * fx;
    side *= Math.exp(-dt * (I.down ? 3 : 7));
    if (Math.abs(side) > 3 && Math.random() < 0.8) parts.push([P.x - fx * 0.5, P.y + 0.1, P.z - fz * 0.5, fz * Math.sign(side) * rand(1, 4), rand(1, 3), -fx * Math.sign(side) * rand(1, 4), 0, rand(0.3, 0.6)]);
    // drag
    P.tuck = lerp(P.tuck, I.up ? 1 : 0, dt * 5);
    const fric = I.down ? 10 : 0.5, air = I.up ? 0.0026 : 0.0042;
    along -= Math.sign(along) * Math.min(Math.abs(along), (fric + air * along * along) * dt);
    if (along < 0) along *= Math.exp(-dt * 2);   // skiing backwards slows down
    along = Math.min(along, 32);
    P.vx = fx * along + fz * side; P.vz = fz * along - fx * side;
    // jump (charge while holding space)
    if (I.jump) P.charge = Math.min(1, P.charge + dt * 2);
    const prevY = P.y;
    const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt, gy = heightAt(nx, nz);
    const groundVy = (gy - prevY) / dt;
    if (!I.jump && P.charge > 0) {   // release = pop
      P.ground = false; P.vy = Math.max(groundVy, 0) + 3.5 + P.charge * 3.5; P.charge = 0; sfx.pop();
      P.air = 0; P.spinTotal = P.flipTotal = 0; P.grabT = 0; P.grabName = GRABS[Math.floor(Math.random() * GRABS.length)]; P.flipDir = 0;
    } else if (P.vyPrev != null && groundVy < P.vyPrev - G * dt * 1.4 && P.vyPrev > -2) {
      // ground fell away faster than gravity (a kicker lip or a drop): take off
      P.ground = false; P.vy = P.vyPrev; P.air = 0; P.spinTotal = P.flipTotal = 0; P.grabT = 0; P.grabName = GRABS[Math.floor(Math.random() * GRABS.length)]; P.flipDir = 0;
    }
    P.x = nx; P.z = nz;
    if (P.ground) { P.y = gy; P.vyPrev = groundVy; } else { P.y = prevY + P.vy * dt; P.vyPrev = null; }
  } else {
    // in the air: spin, flip, grab
    P.air += dt; P.vy -= G * dt;
    const sp = ((I.right ? 1 : 0) - (I.left ? 1 : 0)) * 6.2, fp = ((I.down ? 1 : 0) - (I.up ? 1 : 0)) * 5.2;
    P.spin += sp * dt; P.spinTotal += sp * dt;
    if (fp) { P.flip += fp * dt; P.flipTotal += fp * dt; P.flipDir = Math.sign(fp) * -1; }
    if (I.grab) { P.grabT += dt; P.grab = Math.min(1, P.grab + dt * 8); } else P.grab = Math.max(0, P.grab - dt * 8);
    P.x += P.vx * dt; P.z += P.vz * dt; P.y += P.vy * dt;
    // rails: land on one while coming down
    for (const r of feats.rails) {
      if (P.vy > 0 || P.z < r.z0 || P.z > r.z1 - 2 || Math.abs(P.x - r.x) > (r.box ? 1.1 : 0.8)) continue;
      const ry = terrain(r.x, P.z) + r.hgt;
      if (P.y < ry + 0.4 && P.y > ry - 0.6) { P.grind = r; P.grindT = 0; P.spin = 0; P.flip = 0; P.yaw = 0; P.vx = 0; sfx.land(true); return; }
    }
    const gy = heightAt(P.x, P.z);
    if (P.y <= gy) {
      P.y = gy; P.ground = true;
      const n = normalAt(P.x, P.z), vn = P.vx * n[0] + P.vy * n[1] + P.vz * n[2];
      P.vx -= vn * n[0]; P.vz -= vn * n[2]; P.vy = 0;
      const impact = -vn; if (impact > 14) { P.vx *= 0.7; P.vz *= 0.7; }
      land(); P.vyPrev = 0;
    }
  }
  // trees and rocks
  P.safe = Math.max(0, (P.safe || 0) - dt);
  if (P.safe <= 0) {
  for (const tr of feats.trees) { if (Math.abs(tr.z - P.z) < 1.4 && Math.abs(tr.x - P.x) < 1.4 * tr.s && P.y < tr.y + 6 * tr.s) { crash('TREE!'); P.vx = -P.vx * 0.2; P.vz = 0; break; } }
  for (const rk of feats.rocks) { if (Math.hypot(rk.x - P.x, rk.z - P.z) < rk.s * 1.2 && P.y < rk.y + rk.s * 1.2) { crash('ROCK!'); P.vz = 0; break; } }
  }
  // tokens
  feats.tokens.forEach(k => { if (!k.got && Math.abs(k.z - P.z) < 2.2 && Math.abs(k.x - P.x) < 2.2) { k.got = true; run.tokens++; run.score += 50 * run.combo; sfx.token(); } });
  // finish
  if (!run.done && P.z >= C.len) {
    run.done = true; const timeBonus = Math.max(0, Math.round((C.len / 14 - run.time) * 80));
    run.timeBonus = timeBonus; run.total = run.score + timeBonus; run.finishT = 0;
    save.runs++; if (run.total > save.best) save.best = run.total; if (!save.bestTime || run.time < save.bestTime) save.bestTime = Math.round(run.time * 100) / 100; store();
    setTimeout(() => { if (run.done) screen = 'results'; }, 1600);
  }
  if (P.z > C.len + 120) { P.vz *= 0.9; P.vx *= 0.9; }
}

// ------------------------------------------------------------ rendering
function env() {
  const s = C.sun, l = Math.hypot(...s);
  return { fog: C.fog, fogD: C.fogD, sun: s.map(v => v / l), sunCol: [1.05, 1.0, 0.95], sky: [0.62, 0.7, 0.86], ground: [0.55, 0.58, 0.66] };
}
function updateCam(dt, snap) {
  let dir = Math.atan2(P.vx, P.vz); if (Math.hypot(P.vx, P.vz) < 2) dir = 0;
  cam.dir = cam.dir == null || snap ? dir : cam.dir + angDiff(cam.dir, dir) * Math.min(1, dt * 2.5);
  const back = 8.5 + Math.min(4, Math.hypot(P.vx, P.vz) * 0.08), up = 4.2;
  const e = [P.x - Math.sin(cam.dir) * back, P.y + up, P.z - Math.cos(cam.dir) * back];
  const ge = heightAt(e[0], e[2]) + 1.5; if (e[1] < ge) e[1] = ge;
  const k = snap ? 1 : Math.min(1, dt * 8);
  cam.eye = cam.eye.map((v, i) => lerp(v, e[i], k));
  cam.at = [P.x + Math.sin(cam.dir) * 6, P.y + 1.2, P.z + Math.cos(cam.dir) * 6];
  cam.fov = lerp(cam.fov, 1.0 + Math.min(0.25, Math.hypot(P.vx, P.vz) / 120), dt * 2);
}
function render3D(dt) {
  const E = env(), view = { x: 0, y: 0, w: W, h: H };
  // shadows around the rider
  R3.shadowBegin([P.x, P.y, P.z], E.sun, 40);
  chunks.forEach(c => { if (c.z0 > P.z - 60 && c.z0 < P.z + 60) R3.shadowDraw(c.m); });
  R3.shadowDraw(kickerMesh); R3.shadowDraw(railMesh);
  R3.shadowDraw(rider, riderMatrix());
  R3.shadowEnd();
  R3.begin(view, cam, E);
  R3.sky(skyMesh);
  chunks.forEach(c => { if (c.z0 > P.z - 120 && c.z0 < P.z + 700) R3.draw(c.m); });
  R3.draw(kickerMesh); R3.draw(railMesh, null, null, 0, false, { spec: 0.6 });
  feats.tokens.forEach(k => { if (k.got || k.z < P.z - 10 || k.z > P.z + 200) return; const y = terrain(k.x, k.z) + 1.4 + Math.sin(t * 3 + k.z) * 0.25; R3.draw(tokenMesh, M4.compose(k.x, y, k.z, t * 2 + k.z), null, 0.6, false, { spec: 1 }); });
  R3.draw(rider, riderMatrix(), null, 0, false, { spec: 0.4 });
  // snow particles
  const pts = [];
  parts.forEach(p => { p[0] += p[3] * dt; p[1] += p[4] * dt; p[2] += p[5] * dt; p[4] -= 9 * dt; p[7] -= dt; pts.push(p[0], p[1], p[2], p[6] ? 1 : 0.97, p[6] ? 0.85 : 0.98, p[6] ? 0.4 : 1, Math.min(1, p[7] * 2), 0.35); });
  parts = parts.filter(p => p[7] > 0);
  // falling snowflakes around the camera
  for (let i = 0; i < 160; i++) { const a = i * 12.9898, x = cam.eye[0] + ((Math.sin(a) * 437.5 + t * (0.6 + i % 3)) % 60) - 30, z = cam.eye[2] + ((Math.cos(a) * 913.1) % 60) + 10, y = cam.eye[1] + 12 - ((t * (1.4 + (i % 5) * 0.2) + i * 3.7) % 24); pts.push(x, y, z, 1, 1, 1, 0.8, 0.12); }
  R3.points(pts, false);
  R3.end();
}
function riderMatrix() {
  const crashT = P.crash > 0 ? P.roll : 0;
  let m = M4.trans(P.x, P.y, P.z);
  m = M4.mul(m, M4.rotY(P.yaw + P.spin + (save.board && P.ground && !P.grind ? -Math.PI / 2 * 0 : 0)));
  m = M4.mul(m, M4.rotX(-P.flip + crashT));
  m = M4.mul(m, M4.rotZ(-P.lean * 0.35 * (P.ground ? 1 : 0)));
  const crouch = 1 - P.charge * 0.25 - P.tuck * 0.15 - P.grab * 0.2;
  m = M4.mul(m, M4.scale(1, crouch, 1));
  return m;
}
function pill(s, x, y, size) {
  ctx.font = `800 ${size}px Inter, sans-serif`; const w = ctx.measureText(s).width + size * 1.6, h = size * 2;
  U.rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(15,23,42,0.55)'; ctx.fill();
  U.txt(s, x, y, size, '#ffffff', 'center', { weight: 800, base: 'middle', shadow: false });
}
function drawHUD(dt) {
  ctx.clearRect(0, 0, W, H);
  const hg = ctx.createLinearGradient(0, 0, 0, 130); hg.addColorStop(0, 'rgba(15,23,42,0.35)'); hg.addColorStop(1, 'rgba(15,23,42,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 130);
  // progress
  const prog = clamp(P.z / C.len, 0, 1);
  U.rr(W / 2 - 220, 18, 440, 8, 4); ctx.fillStyle = 'rgba(15,23,42,0.35)'; ctx.fill();
  U.rr(W / 2 - 220, 18, 440 * prog, 8, 4); ctx.fillStyle = '#ffffff'; ctx.fill();
  U.txt(C.name, W / 2, 34, 13, '#ffffff', 'center', { weight: 700 });
  // score + combo
  U.txt(run.score.toLocaleString(), 36, 26, 40, '#ffffff', 'left', { head: true, weight: 800 });
  if (run.combo > 1) U.txt(`x${run.combo} COMBO`, 38, 74, 16, '#fde047', 'left', { weight: 800 });
  // time + speed
  U.txt(run.time.toFixed(1) + 's', W - 36, 26, 34, '#ffffff', 'right', { head: true, weight: 800 });
  U.txt(`${Math.round(Math.hypot(P.vx, P.vz, P.vy || 0) * 3.6)} km/h`, W - 36, 68, 16, '#e2e8f0', 'right', { weight: 700 });
  U.txt(`❄ ${run.tokens}`, W - 36, 92, 14, '#7dd3fc', 'right', { weight: 700 });
  // trick popups
  pops.forEach((p, i) => { p.t += dt; const a = p.t < 0.15 ? p.t / 0.15 : Math.max(0, 1 - (p.t - 1.4) / 0.5); ctx.globalAlpha = a;
    U.txt(p.text, W / 2, H * 0.3 - i * 0 + (1 - Math.min(1, p.t * 6)) * 20, 34, p.col, 'center', { head: true, weight: 800 });
    if (p.sub) U.txt(p.sub, W / 2, H * 0.3 + 44, 22, '#ffffff', 'center', { weight: 800 }); ctx.globalAlpha = 1; });
  pops = pops.filter(p => p.t < 1.9).slice(-1);
  // charge meter
  if (P.charge > 0) { U.rr(W / 2 - 60, H - 60, 120, 10, 5); ctx.fillStyle = 'rgba(15,23,42,0.4)'; ctx.fill(); U.rr(W / 2 - 60, H - 60, 120 * P.charge, 10, 5); ctx.fillStyle = '#fde047'; ctx.fill(); }
  if (!P.ground && !P.grind) { const sd = Math.round(Math.abs(P.spinTotal) / Math.PI) * 180, fl = Math.round(Math.abs(P.flipTotal) / (Math.PI * 2)); if (sd || fl || P.grabT > 0.35) pill(trickName(sd, fl, P.grabT > 0.35 ? P.grabName : null), W / 2, H - 100, 20); }
  if (run.startT > 0) { const n = Math.ceil(run.startT); U.txt(n > 0 ? String(n) : '', W / 2, H / 2 - 80, 100, '#ffffff', 'center', { head: true, weight: 800 }); }
  else if (run.startT > -0.8) { U.txt('DROP IN!', W / 2, H / 2 - 80, 80, '#fde047', 'center', { head: true, weight: 800 }); run.startT -= dt; }
  if (run.done) U.txt('FINISH!', W / 2, H / 2 - 100, 90, '#ffffff', 'center', { head: true, weight: 800 });
  if (run.time < 14 && save.runs < 3) pill('A/D steer · W tuck · S brake · hold SPACE, release to jump · in the air: A/D spin, W/S flip, SHIFT grab', W / 2, H - 40, 13);
}
function drawResults() {
  ctx.fillStyle = 'rgba(15,23,42,0.5)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 330, 110, 660, 500);
  U.txt('RUN COMPLETE', W / 2, 140, 40, '#ffffff', 'center', { head: true, weight: 800 });
  U.txt(C.name, W / 2, 196, 16, '#94a3b8', 'center');
  const rows = [['Trick score', run.score.toLocaleString()], ['Time', run.time.toFixed(2) + 's'], ['Time bonus', '+' + run.timeBonus.toLocaleString()], ['Snowflakes', String(run.tokens)], ['Best trick', run.best || '–']];
  rows.forEach(([a, b], i) => { U.txt(a, W / 2 - 250, 240 + i * 38, 18, '#cbd5e1', 'left', { weight: 600 }); U.txt(b, W / 2 + 250, 240 + i * 38, 18, '#ffffff', 'right', { weight: 800 }); });
  U.txt(run.total.toLocaleString(), W / 2, 440, 54, '#fde047', 'center', { head: true, weight: 800 });
  U.txt(run.total >= save.best ? 'NEW BEST!' : `Best ${save.best.toLocaleString()}`, W / 2, 500, 16, run.total >= save.best ? '#4ade80' : '#94a3b8', 'center');
  if (U.button('again', W / 2 - 310, 530, 300, 56, 'RIDE AGAIN', { color: '#3b82f6', size: 18 })) newRun(save.course);
  if (U.button('menu', W / 2 + 10, 530, 300, 56, 'MENU', { ghost: true, size: 18, sfx: 'back' })) { screen = 'title'; Sound.playSong(SONGS.skiMenu); }
}
// menu: slow fly-over of the mountain
function drawTitle(dt) {
  if (!C) { buildCourse(save.course); P = { x: cx(10), z: 10, y: 0, vx: 0, vy: 0, vz: 10, yaw: 0, ground: true, spin: 0, flip: 0, roll: 0, grab: 0, charge: 0, crash: 0, lean: 0, tuck: 0 }; rider = buildRider(save.board, JACKETS[save.col]); }
  P.z += dt * 18; if (P.z > C.len - 50) P.z = 20; P.x = cx(P.z) + Math.sin(P.z * 0.05) * 10; P.y = heightAt(P.x, P.z); P.vx = Math.cos(P.z * 0.05) * 0.5 * 18; P.vz = 18; P.yaw = Math.atan2(P.vx, P.vz); P.lean = Math.cos(P.z * 0.05) * 0.6;
  updateCam(dt); render3D(dt);
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(15,23,42,0.75)'); g.addColorStop(0.55, 'rgba(15,23,42,0.1)'); g.addColorStop(1, 'rgba(15,23,42,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  U.txt('POWDER', 80, 90, 88, '#ffffff', 'left', { head: true, weight: 800 });
  U.txt('PEAK', 80, 176, 88, '#7dd3fc', 'left', { head: true, weight: 800 });
  U.txt('Freeride. Send it. Land clean.', 84, 280, 18, '#e2e8f0', 'left', { weight: 600 });
  U.txt('MOUNTAIN', 84, 330, 12, '#94a3b8', 'left');
  COURSES.forEach((c, i) => { if (U.button('c' + i, 84 + i * 150, 352, 140, 46, c.name.split(' ')[0], { ghost: save.course !== i, size: 15, sfx: 'tab' })) { save.course = i; store(); C = null; } });
  U.txt('RIDER', 84, 420, 12, '#94a3b8', 'left');
  if (U.button('ski', 84, 442, 140, 46, 'Skis', { ghost: save.board, size: 15, sfx: 'tab' })) { save.board = false; store(); rider = buildRider(false, JACKETS[save.col]); }
  if (U.button('board', 234, 442, 140, 46, 'Snowboard', { ghost: !save.board, size: 15, sfx: 'tab' })) { save.board = true; store(); rider = buildRider(true, JACKETS[save.col]); }
  JACKETS.forEach((c, i) => { const x = 400 + i * 34, y = 465; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); if (save.col === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); } if (U.click && Math.hypot(U.click.x - x, U.click.y - y) < 14) { U.click = null; save.col = i; store(); rider = buildRider(save.board, c); Sound.play('tab'); } });
  if (U.button('go', 84, 520, 320, 64, 'DROP IN', { color: '#3b82f6', size: 22 })) newRun(save.course);
  U.txt(`Best score ${save.best.toLocaleString()}   ·   Runs ${save.runs}`, 84, 610, 14, '#cbd5e1', 'left', { weight: 600 });
}

// ------------------------------------------------------------ loop
let last = 0, paused = false, hold = false;
function frame(now) {
  let dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
  if (screen === 'title') drawTitle(dt);
  else {
    if (screen === "play" && !paused && !hold) { const n = 3; for (let i = 0; i < n; i++) stepRider(dt / n); }
    updateCam(dt); render3D(paused ? 0 : dt);
    drawHUD(dt);
    if (screen === 'results') drawResults();
    if (paused) {
      ctx.fillStyle = 'rgba(15,23,42,0.55)'; ctx.fillRect(0, 0, W, H); U.panel(W / 2 - 200, 240, 400, 240);
      U.txt('PAUSED', W / 2, 266, 34, '#fff', 'center', { head: true, weight: 800 });
      if (U.button('res', W / 2 - 160, 326, 320, 52, 'RESUME', { color: '#3b82f6' })) paused = false;
      if (U.button('rst', W / 2 - 160, 388, 155, 46, 'RESTART', { ghost: true, size: 15 })) { paused = false; newRun(save.course); }
      if (U.button('quit', W / 2 + 5, 388, 155, 46, 'MENU', { ghost: true, size: 15, sfx: 'back' })) { paused = false; screen = 'title'; Sound.playSong(SONGS.skiMenu); }
    }
  }
  if (U.pressed.Escape && screen === 'play') paused = !paused;
  if (U.pressed.KeyR && screen === 'play' && !paused) newRun(save.course);
  U.endFrame();
  requestAnimationFrame(frame);
}
Sound.playSong(SONGS.skiMenu);
const fontReady = document.fonts ? Promise.race([document.fonts.load(`800 40px 'Plus Jakarta Sans'`), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
fontReady.then(() => requestAnimationFrame(n => { last = n; frame(n); }));

window.__ski = { U, snapCam() { updateCam(0.016, true); }, freeze(v) { hold = v; }, get C() { return C; }, get P() { return P; }, get run() { return run; }, get screen() { return screen; }, newRun, stepRider, heightAt, get feats() { return feats; }, save: () => save };
const inRun = () => screen === 'play' ? '' : 'Start a run first';
window.__cheats = [
  { name: 'Moon gravity', icon: '🌙', need: inRun, toggle: () => window.__moon, run() { window.__moon = !window.__moon; } },
  { name: '+10,000 points', icon: '⭐', need: inRun, run() { run.score += 10000; } },
  { name: 'Launch into the sky', icon: '🚀', need: inRun, run() { P.ground = false; P.vy = 22; P.air = 0; P.spinTotal = P.flipTotal = 0; P.grabT = 0; P.grabName = GRABS[0]; P.flipDir = 0; } },
  { name: 'Skip to the finish', icon: '🏁', need: inRun, run() { P.z = C.len - 30; P.x = cx(P.z); P.y = heightAt(P.x, P.z); } },
];
setInterval(() => { if (window.__moon && P && !P.ground) P.vy += 10 * 0.05; }, 50);
})();
