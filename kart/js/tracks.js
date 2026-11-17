// =====================================================================
//  TURBO KARTS - tracks, racers, items. Tweak numbers here.
// =====================================================================
'use strict';

// control points: [x, z, height]. The track is a smooth loop through them.
// Every track starts on a straight heading +x from the first point.
// f = fraction of the lap (0..1). lane = metres from the centre line.
const TRACKS = [
  {
    id: 'meadow', name: 'Sunny Circuit', theme: 'meadow', width: 17, scale: 1.45, song: 'k1',
    desc: 'Rolling hills and a hilltop hairpin',
    pts: [[0, 0, 0], [60, 0, 0], [120, 5, 0], [165, 25, 1], [185, 70, 4], [170, 115, 8], [125, 135, 11], [80, 120, 11], [50, 90, 8], [10, 85, 5], [-30, 110, 3], [-75, 120, 2], [-115, 95, 1], [-125, 50, 0], [-100, 15, 0], [-55, 0, 0]],
    items: [0.16, 0.48, 0.78], boosts: [[0.08, 0], [0.62, -3], [0.9, 3]], ramps: [], ice: [],
    coins: [0.25, 0.42, 0.7, 0.95],
  },
  {
    id: 'canyon', name: 'Dusty Canyon', theme: 'desert', width: 16, scale: 1.4, song: 'k2',
    desc: 'Big jump over the canyon gap',
    pts: [[0, 0, 0], [70, 0, 0], [140, -10, 0], [190, -50, 2], [205, -110, 6], [170, -160, 10], [105, -175, 10], [45, -150, 6], [-5, -170, 4], [-60, -200, 3], [-120, -185, 2], [-155, -130, 1], [-140, -75, 3], [-100, -55, 4], [-95, -20, 2], [-60, 0, 0]],
    items: [0.14, 0.44, 0.74], boosts: [[0.36, 0], [0.86, 0]], ramps: [0.38], ice: [],
    coins: [0.22, 0.55, 0.66, 0.93],
  },
  {
    id: 'frost', name: 'Frostbite Pass', theme: 'snow', width: 16, scale: 1.4, song: 'k3',
    desc: 'Icy mountain climb, slippery corners',
    pts: [[0, 0, 0], [70, 0, 2], [130, -20, 7], [160, -70, 13], [150, -130, 18], [100, -160, 20], [40, -140, 18], [10, -100, 14], [-30, -80, 11], [-80, -100, 9], [-130, -80, 6], [-150, -30, 4], [-120, 10, 2], [-60, 15, 0]],
    items: [0.15, 0.45, 0.76], boosts: [[0.56, 0], [0.92, -2]], ramps: [0.6], ice: [[0.3, 0.36], [0.82, 0.87]],
    coins: [0.2, 0.4, 0.66, 0.97],
  },
  {
    id: 'neon', name: 'Neon Nights', theme: 'city', width: 17, scale: 1.45, song: 'k4',
    desc: 'Glowing city streets with tons of boost pads',
    pts: [[0, 0, 0], [80, 0, 0], [125, 0, 0], [152, -22, 0], [156, -70, 0], [150, -112, 0], [120, -132, 0], [62, -132, 0], [30, -112, 2], [20, -72, 6], [-10, -52, 8], [-60, -56, 8], [-100, -82, 5], [-142, -82, 2], [-166, -52, 0], [-160, -12, 0], [-120, 10, 0], [-60, 5, 0]],
    items: [0.13, 0.42, 0.72], boosts: [[0.06, -3], [0.06, 3], [0.3, 0], [0.5, 0], [0.66, 0], [0.88, 0]], ramps: [], ice: [],
    coins: [0.2, 0.36, 0.58, 0.8, 0.95],
  },
];

// ------------------------------------------------------------ build a smooth centre line
// Returns samples spaced ~STEP metres apart: { x, y, z, tx, tz (tangent), rx, rz (right) }
const STEP = 2;
function buildCenterline(def) {
  const P = def.pts.map(([x, z, y]) => [x * def.scale, y, z * def.scale]);
  const n = P.length, dense = [];
  const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) { const t = k / 40; dense.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)]); }
  }
  // resample by arc length
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) { const p = dense[i - 1], q = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[2] - p[2])); }
  const total = cum[cum.length - 1], N = Math.round(total / STEP), out = [];
  let j = 0;
  for (let s = 0; s < N; s++) {
    const d = s * total / N;
    while (cum[j + 1] < d) j++;
    const p = dense[j], q = dense[(j + 1) % dense.length], u = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push({ x: p[0] + (q[0] - p[0]) * u, y: p[1] + (q[1] - p[1]) * u, z: p[2] + (q[2] - p[2]) * u });
  }
  for (let i = 0; i < N; i++) {
    const a = out[(i - 1 + N) % N], b = out[(i + 1) % N];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    out[i].tx = tx; out[i].tz = tz; out[i].rx = -tz; out[i].rz = tx;   // right-hand side when looking along +tangent
    out[i].slope = (b.y - a.y) / (2 * STEP);
  }
  // curvature (for AI braking + drifting)
  for (let i = 0; i < N; i++) { const a = out[(i - 4 + N) % N], b = out[(i + 4) % N]; out[i].curve = Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz); }
  return { pts: out, length: total, N };
}

// ------------------------------------------------------------ themes (colours + lighting)
const THEMES = {
  meadow: { skyTop: '#3a8ae8', skyHorizon: '#bfe4ff', fog: '#bfe4ff', fogD: 0.0021, sun: [0.45, 0.8, 0.35], sunCol: [1.0, 0.95, 0.85], amb: [0.42, 0.5, 0.62], gnd: [0.32, 0.3, 0.22],
    grass: ['#5fb04a', '#6cbd52', '#57a042', '#78c85a'], verge: '#4a9a3a', road: ['#5a5a64', '#56565f', '#5e5e68'], line: '#f0f0f0', curb: ['#e83a3a', '#f8f8f8'], wall: ['#f8f8f8', '#e83a3a'], wallH: 1.0,
    hills: 7, mountains: ['#6a8aa8', '#7a9ab8', '#e8f0f8'] },
  desert: { skyTop: '#e88a4a', skyHorizon: '#ffe0b0', fog: '#f8d8a8', fogD: 0.0022, sun: [0.3, 0.7, -0.4], sunCol: [1.05, 0.9, 0.7], amb: [0.55, 0.45, 0.4], gnd: [0.45, 0.32, 0.2],
    grass: ['#e8b070', '#dca064', '#f0bc7c', '#d49458'], verge: '#c8905a', road: ['#7a6a5a', '#74645a', '#806e5e'], line: '#fff0c8', curb: ['#e86a2a', '#fff0d8'], wall: ['#c8703a', '#e8a060'], wallH: 1.0,
    hills: 10, mountains: ['#c86a3a', '#b85a32', '#e8945a'] },
  snow: { skyTop: '#6a9ad8', skyHorizon: '#e8f4ff', fog: '#e0ecf8', fogD: 0.0026, sun: [-0.3, 0.75, 0.45], sunCol: [0.95, 0.97, 1.05], amb: [0.6, 0.66, 0.78], gnd: [0.5, 0.52, 0.6],
    grass: ['#f2f6fc', '#e6eef8', '#fafcff', '#dce6f2'], verge: '#d0dcea', road: ['#5a6070', '#565c6a', '#606676'], line: '#ffffff', curb: ['#3a6ad8', '#ffffff'], wall: ['#3a6ad8', '#e8f0ff'], wallH: 1.0,
    hills: 16, mountains: ['#7a8aa8', '#8a9ab8', '#ffffff'] },
  city: { skyTop: '#0a0620', skyHorizon: '#3a1a5a', fog: '#2a1440', fogD: 0.0030, sun: [0.2, 0.8, 0.3], sunCol: [0.42, 0.38, 0.6], amb: [0.32, 0.3, 0.5], gnd: [0.12, 0.1, 0.2],
    grass: ['#2a2a3a', '#26263a', '#2e2e40', '#24243a'], verge: '#3a3a52', road: ['#30303e', '#2c2c3a', '#343444'], line: '#ffe650', curb: ['#ff3aa8', '#3ae8ff'], wall: ['#ff3aa8', '#3ae8ff'], wallH: 1.1, neon: true,
    hills: 0, mountains: ['#1a1030', '#221438', '#3a2058'] },
};

// ------------------------------------------------------------ racers
// stats 1..5: speed (top speed), accel, handling, weight
const RACERS = [
  { id: 'blaze', name: 'BLAZE', body: '#e83a3a', trim: '#ffcc33', suit: '#c82a2a', helmet: '#ffffff', speed: 3, accel: 3, handling: 3, weight: 3 },
  { id: 'sky',   name: 'SKY',   body: '#3a8ae8', trim: '#ffffff', suit: '#2a5ab8', helmet: '#8ad8ff', speed: 2, accel: 5, handling: 4, weight: 2 },
  { id: 'lime',  name: 'LIME',  body: '#5ad03a', trim: '#1a1a1a', suit: '#3a9a2a', helmet: '#e8ff8a', speed: 3, accel: 3, handling: 5, weight: 2 },
  { id: 'rosa',  name: 'ROSA',  body: '#ff6ab0', trim: '#ffffff', suit: '#d84a8a', helmet: '#ffd0e8', speed: 2, accel: 5, handling: 5, weight: 1 },
  { id: 'max',   name: 'MAX',   body: '#ff8a1a', trim: '#2a2a2a', suit: '#c86a1a', helmet: '#2a2a2a', speed: 5, accel: 2, handling: 2, weight: 5 },
  { id: 'volt',  name: 'VOLT',  body: '#ffe03a', trim: '#2a2a2a', suit: '#c8a82a', helmet: '#3a3a3a', speed: 5, accel: 2, handling: 3, weight: 3 },
  { id: 'nova',  name: 'NOVA',  body: '#9a4ae8', trim: '#3ae8ff', suit: '#6a2ab0', helmet: '#e8d0ff', speed: 4, accel: 3, handling: 3, weight: 3 },
  { id: 'frost', name: 'FROST', body: '#3ad8e8', trim: '#ffffff', suit: '#2a9ab0', helmet: '#ffffff', speed: 3, accel: 4, handling: 4, weight: 2 },
];

// engine classes: top speed in m/s, AI skill
const CLASSES = [
  { id: '50cc',  name: '50cc',  speed: 22, ai: 0.88, desc: 'Relaxed' },
  { id: '100cc', name: '100cc', speed: 27, ai: 0.95, desc: 'Normal' },
  { id: '150cc', name: '150cc', speed: 31, ai: 1.0,  desc: 'Fast + tough' },
];

// items, with how likely each one is depending on your race position (front / middle / back)
const ITEMS = {
  turbo:   { name: 'TURBO',          col: '#ff8a1a', w: [2, 4, 5] },
  turbo3:  { name: 'TRIPLE TURBO',   col: '#ff5a1a', w: [0, 2, 4] },
  oil:     { name: 'OIL SLICK',      col: '#3a3a48', w: [6, 3, 1] },
  bouncer: { name: 'BOUNCER ORB',    col: '#3ae84a', w: [5, 4, 2] },
  homing:  { name: 'HOMING ROCKET',  col: '#e83a3a', w: [1, 4, 4] },
  bomb:    { name: 'BOMB',           col: '#2a2a3a', w: [2, 3, 2] },
  shield:  { name: 'STAR POWER',     col: '#ffe03a', w: [0, 1, 3] },
  zap:     { name: 'THUNDER',        col: '#8ad8ff', w: [0, 0, 1.2] },
};

const GP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
const LAPS = 3;

// ------------------------------------------------------------ music
if (typeof SONGS !== 'undefined') Object.assign(SONGS, {
  kmenu: { seed: 9101, bpm: 124, root: 57, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.75, bass: 'x..x..x.x..x..x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.06, echo: 0.2 }, bass: { type: 'triangle', vol: 0.14 }, drumVol: 0.6 } },
  k1: { seed: 9201, bpm: 150, root: 60, scale: 'major', prog: [0, 5, 3, 4, 0, 5, 1, 4], density: 0.9, bass: 'x.xx.xx.x.xx.xx.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.06 }, bass: { type: 'triangle', vol: 0.15 }, drumVol: 0.75 } },
  k2: { seed: 9301, bpm: 140, root: 55, scale: 'dorian', prog: [0, 3, 6, 4, 0, 3, 5, 4], density: 0.9, bass: 'x..xx..xx..xx.x.', kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'sawtooth', vol: 0.045, lp: 2600 }, bass: { type: 'square', vol: 0.1, lp: 900 }, drumVol: 0.8 } },
  k3: { seed: 9401, bpm: 146, root: 62, scale: 'minor', prog: [0, 5, 2, 6, 0, 5, 3, 4], density: 0.85, bass: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    arp: true, arpRate: 1, arpOct: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'triangle', vol: 0.11, echo: 0.25 }, arp: { type: 'square', vol: 0.03 }, bass: { type: 'triangle', vol: 0.14 }, drumVol: 0.7 } },
  k4: { seed: 9501, bpm: 158, root: 53, scale: 'minor', prog: [0, 0, 5, 6, 0, 0, 3, 4], density: 0.95, bass: 'xxx.xxx.xxx.xxx.', kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'sawtooth', vol: 0.05, lp: 3000 }, bass: { type: 'sawtooth', vol: 0.11, lp: 800 }, drumVol: 0.85 } },
  kwin: { seed: 9601, bpm: 132, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.85, bass: 'x...x...x...x...', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, inst: { lead: { type: 'square', vol: 0.07 }, drumVol: 0.6 } },
  klose: { seed: 9701, bpm: 96, root: 57, scale: 'minor', prog: [0, 5, 3, 4], density: 0.55, bass: 'x.......x.......', kick: 'x.......x.......', hat: '..x...x...x...x.',
    inst: { lead: { type: 'triangle', vol: 0.12, echo: 0.3 }, drumVol: 0.4 } },
});

if (typeof module !== 'undefined') module.exports = { TRACKS, buildCenterline, THEMES, RACERS };
