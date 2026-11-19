// =====================================================================
//  POWDER PEAK - the mountain: terrain, park features and scenery.
//  World axes: x = across the slope, y = up, z = downhill.
// =====================================================================
'use strict';
const D2R = Math.PI / 180;
const GRAV = 13;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function smax(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return a + (b - a) * h + k * h * (1 - h); }
function hash2(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function v3l(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function vquad(mb, a, b, c, d, ca, cb, cc, cd) {   // quad with a colour per corner
  const n = (() => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...x) || 1; return x.map(q => q / l); })();
  for (const [p, k] of [[a, ca], [b, cb], [c, cc], [a, ca], [c, cc], [d, cd]]) mb.d.push(p[0], p[1], p[2], n[0], n[1], n[2], k[0], k[1], k[2], k[3]);
}
function triNC(mb, a, b, c, na, nb, nc, ca, cb, cc, aOff = 0) {   // smooth normals + a colour per vertex
  const fx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), fy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), fz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2]) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [cb, cc] = [cc, cb]; }
  for (const [p, n, k] of [[a, na, ca], [b, nb, cb], [c, nc, cc]]) mb.d.push(p[0], p[1], p[2], n[0], n[1], n[2], k[0], k[1], k[2], k[3] + aOff);
}
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function hex(c) { const h = c.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }

// ------------------------------------------------------------ course book
// feats: [type, z, a, b]   jump: size + x offset   rail/box/log/kink: x offset   drop: x offset   pipe: length
const JUMP_SIZES = {
  S: { vd: 12.5, lip: 27, Lt: 7, w: 9, land: 31, col: '#22c55e' },
  M: { vd: 15.5, lip: 29, Lt: 8.5, w: 11, land: 32, col: '#3b82f6' },
  L: { vd: 18.5, lip: 31, Lt: 10, w: 13, land: 33, col: '#111827' },
  XL: { vd: 21.5, lip: 32, Lt: 11.5, w: 15, land: 34, col: '#111827' },
  BIG: { vd: 25, lip: 33, Lt: 13, w: 18, land: 35, col: '#ef4444' },
};
const COURSES = [
  { id: 'park', name: 'Bluebird Park', blurb: 'Groomed slopestyle. Learn to spin, grab and grind.', len: 1060, seed: 11,
    sky: ['#2563c9', '#bcd9ff'], fog: [0.78, 0.86, 0.97], fogD: 0.0011, sun: [0.62, 0.55, 0.3], sunCol: [1.2, 1.1, 0.98], amb: [0.5, 0.6, 0.85], gnd: [0.7, 0.72, 0.78],
    slopes: [[0, 0.24], [150, 0.3], [500, 0.27], [800, 0.3], [1100, 0.2]], rough: [[0, 0.5], [180, 0.08], [1000, 0.08]], trees: 1, glade: 0, snowfall: 0.25, wind: 0.08, medals: [3000, 7000, 12500],
    feats: [['jump', 230, 'S', 0], ['box', 228, -19], ['rail', 232, 19], ['jump', 330, 'M', 0], ['box', 330, 20], ['jump', 435, 'M', 0], ['rail', 438, -20],
      ['box', 540, -9], ['rail', 545, 8], ['kink', 610, 0], ['box', 672, 11], ['rail', 675, -11], ['jump', 775, 'M', 0], ['jump', 890, 'L', 0], ['box', 892, 21]],
    ch: [['spin', 360, 'Land a 360'], ['rails', 3, 'Grind 3 rails in one run'], ['tokens', 20, 'Collect 20 snowflakes']] },
  { id: 'pine', name: 'Pine Ridge', blurb: 'Freeride through the trees. Cliff drops and log slides.', len: 1420, seed: 23,
    sky: ['#5583c2', '#dfe9f4'], fog: [0.82, 0.87, 0.94], fogD: 0.0017, sun: [-0.6, 0.6, 0.2], sunCol: [1.05, 1.0, 0.95], amb: [0.56, 0.62, 0.8], gnd: [0.7, 0.72, 0.76],
    slopes: [[0, 0.24], [120, 0.36], [500, 0.42], [900, 0.36], [1300, 0.3]], rough: [[0, 0.4], [150, 1], [1400, 1]], trees: 1.6, glade: 1, snowfall: 0.8, wind: 0.2, medals: [3500, 8000, 14000],
    feats: [['drop', 260, 0], ['jump', 360, 'M', 14], ['log', 365, -16], ['log', 470, 6], ['drop', 560, -8], ['jump', 680, 'L', 0], ['log', 690, 20], ['drop', 820, 10], ['jump', 950, 'M', -10], ['log', 960, 12],
      ['drop', 1070, 0], ['jump', 1200, 'L', 0], ['log', 1310, -6]],
    ch: [['drops', 4, 'Clear all 4 cliff drops'], ['speed', 90, 'Hit 90 km/h'], ['flip', 1, 'Land a flip']] },
  { id: 'summit', name: 'Summit Pro', blurb: 'Big jumps, kinked rails and a superpipe at sunset.', len: 1330, seed: 37,
    sky: ['#4b3f8f', '#ffbe8a'], fog: [0.97, 0.8, 0.7], fogD: 0.0013, sun: [0.75, 0.32, 0.45], sunCol: [1.35, 1.0, 0.75], amb: [0.55, 0.52, 0.72], gnd: [0.72, 0.6, 0.6],
    slopes: [[0, 0.26], [150, 0.33], [700, 0.33], [840, 0.25], [1150, 0.25], [1250, 0.18]], rough: [[0, 0.3], [160, 0.06], [1300, 0.06]], trees: 0.8, glade: 0, snowfall: 0, wind: 0.15, medals: [8000, 20000, 36000],
    feats: [['jump', 240, 'L', 0], ['kink', 330, -14], ['rail', 335, 14], ['jump', 430, 'XL', 0], ['box', 525, -12], ['kink', 530, 12], ['jump', 640, 'XL', 0], ['rail', 745, 0],
      ['pipe', 860, 260]],
    ch: [['spin', 1080, 'Land a 1080'], ['flips', 2, 'Land a double flip'], ['trick', 3000, 'Score 3,000 in one trick']] },
  { id: 'bigair', name: 'Big Air Night', blurb: 'One giant jump under the lights. Best 2 of 3.', len: 330, seed: 51, bigair: true,
    sky: ['#05070f', '#1b2440'], fog: [0.07, 0.09, 0.16], fogD: 0.0026, sun: [0.3, 0.8, -0.5], sunCol: [0.38, 0.42, 0.6], amb: [0.2, 0.24, 0.38], gnd: [0.12, 0.13, 0.2],
    slopes: [[0, 0.5], [130, 0.58], [175, 0.2], [330, 0.15]], rough: [[0, 0]], trees: 0.6, glade: 0, snowfall: 0.35, wind: 0.1, medals: [2500, 5000, 8000],
    feats: [['jump', 175, 'BIG', 0]], lights: true,
    ch: [['cork', 1, 'Land a cork (flip + spin)'], ['trick', 3000, 'Score 3,000 on one jump']] },
  { id: 'garden', name: 'Rail Garden', blurb: 'Golden-hour jib park: boxes, ledges, kinks. Stall everything.', len: 960, seed: 64,
    sky: ['#2f4fa3', '#ffd2a8'], fog: [0.98, 0.86, 0.78], fogD: 0.0014, sun: [0.8, 0.36, -0.25], sunCol: [1.4, 1.08, 0.82], amb: [0.5, 0.55, 0.8], gnd: [0.78, 0.66, 0.62],
    slopes: [[0, 0.22], [120, 0.24], [900, 0.22]], rough: [[0, 0.3], [120, 0.05], [960, 0.05]], trees: 0.7, glade: 0, snowfall: 0, wind: 0.05, medals: [3500, 8000, 14000],
    feats: [['box', 150, -8], ['box', 152, 8], ['ledge', 215, 0], ['rail', 275, -10], ['kink', 278, 10], ['jump', 330, 'S', 0], ['ledge', 440, -12], ['box', 443, 12], ['rail', 500, 0],
      ['jump', 560, 'M', 0], ['kink', 668, -10], ['ledge', 670, 10], ['box', 730, 0], ['rail', 785, -9], ['rail', 788, 9], ['jump', 840, 'S', 0]],
    ch: [['rails', 6, 'Grind 6 features in one run'], ['stall', 1, 'Land a stall on a rail, box or ledge'], ['butter', 360, 'Land a 360 butter']] },
  { id: 'bowl', name: 'Backcountry Bowl', blurb: 'Steep powder, big cliffs and a storm rolling in.', len: 1500, seed: 79, expo: 0.95,
    sky: ['#5b6b86', '#e6ebf2'], fog: [0.8, 0.84, 0.9], fogD: 0.0023, sun: [-0.4, 0.75, 0.3], sunCol: [0.85, 0.88, 0.95], amb: [0.62, 0.68, 0.82], gnd: [0.7, 0.72, 0.78],
    slopes: [[0, 0.28], [150, 0.42], [600, 0.46], [1000, 0.4], [1400, 0.3]], rough: [[0, 0.6], [150, 1.2], [1500, 1.2]], trees: 1.9, glade: 1, snowfall: 1.3, wind: 0.35, medals: [3000, 7500, 13000],
    feats: [['drop', 220, -10], ['jump', 330, 'M', 12], ['drop', 430, 8], ['log', 545, -14], ['drop', 600, -4], ['jump', 720, 'L', -8], ['drop', 840, 12], ['log', 945, -10],
      ['drop', 1000, 0], ['jump', 1120, 'L', 6], ['drop', 1250, -10], ['log', 1360, 8]],
    ch: [['drops', 5, 'Clear 5 cliff drops'], ['speed', 100, 'Hit 100 km/h'], ['flip', 1, 'Land a flip']] },
];

// ------------------------------------------------------------ world state
let C = null, W0 = null;   // current course + its data
function slopeAt(z) { const S = C.slopes; if (z <= S[0][0]) return S[0][1]; for (let i = 1; i < S.length; i++) if (z < S[i][0]) { const k = (z - S[i - 1][0]) / (S[i][0] - S[i - 1][0]); const t = k * k * (3 - 2 * k); return lerp(S[i - 1][1], S[i][1], t); } return S[S.length - 1][1]; }
function tableAt(T, z) { if (z <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (z < T[i][0]) return lerp(T[i - 1][1], T[i][1], (z - T[i - 1][0]) / (T[i][0] - T[i - 1][0])); return T[T.length - 1][1]; }
function cx(z) { const s = C.seed; return 22 * Math.sin(z * 0.0033 + s) + 7 * Math.sin(z * 0.0095 + s * 2.3); }
function profZ(z) {   // height along the fall line (cumulative slope)
  const H = W0.H, i = Math.floor(z + 200);
  if (i < 0) return H[0] + (-(z + 200)) * 0.2;
  if (i >= H.length - 1) return H[H.length - 1] - (z + 200 - (H.length - 1)) * 0.2;
  const f = z + 200 - i; return H[i] + (H[i + 1] - H[i]) * f;
}
function baseH(x, z) {
  const c = cx(z), ad = Math.abs(x - c), s = C.seed;
  const rough = W0.roughAt(z);
  let y = profZ(z);
  y += rough * (1.3 * Math.sin(z * 0.05 + Math.sin(x * 0.035) * 1.6) + 1.6 * (vnoise(x * 0.06, z * 0.06, s) - 0.5));
  y += (vnoise(x * 0.011, z * 0.011, s + 7) - 0.5) * (2 + 4 * rough);
  const gw = C.bigair ? 30 : 42, out = Math.max(0, ad - gw);
  y += out * 0.17 + out * out * 0.0008 + (vnoise(x * 0.035, z * 0.035, s + 3) - 0.5) * Math.min(out, 80) * 0.3;
  const far = Math.max(0, ad - 200); y += far * far * 0.004;
  const pf = W0.pipe;
  if (pf) { const wz = clamp(Math.min((z - pf.z0 + 25) / 25, (pf.z1 + 25 - z) / 25), 0, 1); if (wz > 0) { const wx = clamp(1 - (Math.abs(x - pf.x) - 22) / 18, 0, 1); y = lerp(y, profZ(z), wz * wx); } }
  if (z < 30) y += (30 - z) * 0.18;   // start shelf
  return y;
}
// features add on top with a smooth max
function featH(x, z, b) {
  let y = b; const dev = b - profZ(z);
  for (const f of W0.feats) {
    if (z < f.z0 || z > f.z1) continue;
    if (f.kind === 'pipe') { y = Math.max(y, pipeH(f, x, z)); continue; }
    if (!f.prof) continue;
    const v = Math.abs(x - f.x), side = Math.max(0, v - f.w / 2);
    if (side > f.reach) continue;
    const u = (z - f.z0) / f.du, i = Math.floor(u); if (i < 0 || i >= f.prof.length - 1) continue;
    const py = f.prof[i] + (f.prof[i + 1] - f.prof[i]) * (u - i) + dev - side * f.sideK - fadeIn(Math.min(z - f.z0, f.z1 - z));
    y = smax(y, py, f.soft);
  }
  return y;
}
function fadeIn(m) { if (m >= 3) return 0; const k = clamp(m / 3, 0, 1); return 1.4 * (1 - k * k * (3 - 2 * k)); }
function heightAt(x, z) { return featH(x, z, baseH(x, z)); }
function normalAt(x, z) { const e = 0.35; const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l]; }
function baseNormal(x, z) { const e = 1; const hx = baseH(x + e, z) - baseH(x - e, z), hz = baseH(x, z + e) - baseH(x, z - e); const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l]; }

// ---- halfpipe: raised walls either side of a flat floor, floor follows the base
const PIPE = { floor: 7.5, R: 5.4, maxA: 82 * D2R, deck: 5, outer: 0.75 };
function pipeH(f, x, z) {
  const v = Math.abs(x - f.x) - PIPE.floor;
  const ramp = clamp(Math.min((z - f.z0) / 22, (f.z1 - z) / 18), 0, 1);
  if (v <= 0 || ramp <= 0) return -1e9;
  const yb = profZ(z) + f.yoff;
  const sA = Math.sin(PIPE.maxA), wallTop = PIPE.R * (1 - Math.cos(PIPE.maxA)) + 0.35;
  let h;
  if (v < PIPE.R * sA) h = PIPE.R - Math.sqrt(PIPE.R * PIPE.R - v * v);
  else h = Math.min(wallTop, PIPE.R * (1 - Math.cos(PIPE.maxA)) + (v - PIPE.R * sA) * Math.tan(PIPE.maxA));
  const vTop = PIPE.R * sA + 0.35 / Math.tan(PIPE.maxA);
  if (v > vTop + PIPE.deck) h = wallTop - (v - vTop - PIPE.deck) * PIPE.outer;
  return yb + h * ramp - (1 - ramp) * 2;
}
function inPipe(x, z) { for (const f of W0.feats) if (f.kind === 'pipe' && z > f.z0 + 10 && z < f.z1 - 8 && Math.abs(x - f.x) < PIPE.floor + PIPE.R + 3) return f; return null; }

// ---- table-top jump / drop profile, integrated along z
function buildProfile(f) {
  const J = f.kind === 'drop' ? null : JUMP_SIZES[f.size];
  const du = 0.25, s0 = slopeAt(f.zc), ys = profZ(f.zc - (J ? J.Lt + 2 : 6));
  const base = u => profZ(f.zc - (J ? J.Lt + 2 : 6) + u);
  const ang = []; // target angle (rad, + = up) as a function of u, built piecewise
  const segs = [];
  const a0 = -Math.atan(s0);
  if (J) {
    const th = J.lip * D2R;
    segs.push([2, a0, a0], [J.Lt, a0, th]);
    // flight to deck height: where does the design trajectory come back to lip height - 0.6?
    const vs = J.vd * Math.sin(th), vx = J.vd * Math.cos(th);
    const tt = (vs + Math.sqrt(vs * vs + 2 * GRAV * 0.6)) / GRAV, Dk = vx * tt;
    f.deckLen = Dk * 0.72; f.vd = J.vd; f.lipAngle = th;
    segs.push(['drop', 0.6], [f.deckLen, -0.05, -0.05], [4, -0.05, -J.land * D2R], [80, -J.land * D2R, -J.land * D2R]);
  } else {
    // cliff drop: a shelf that stays high while the slope falls away, then a steep landing
    segs.push([6, a0, -0.06], [26, -0.06, -0.08], [1.5, -0.08, -42 * D2R], [60, -42 * D2R, -42 * D2R]);
    f.deckLen = 0;
  }
  const prof = []; let y = ys - 0.7, u = 0, lipU = 0, knuckleU = 0, endU = 0;
  prof.push(y);
  for (const sg of segs) {
    if (sg[0] === 'drop') { y -= sg[1]; prof[prof.length - 1] = Math.max(prof[prof.length - 1], y); lipU = u; continue; }
    const [L, A, B] = sg, n = Math.max(1, Math.round(L / du));
    for (let k = 0; k < n; k++) {
      const a = lerp(A, B, (k + 0.5) / n); y += Math.tan(a) * du; u += du; prof.push(y);
      if (u > 12 && y < base(u) - 1.2) break;
    }
    if (sg === segs[1] && J) lipU = u;
    if (!J && sg === segs[1]) knuckleU = u;
    if (J && sg === segs[3]) knuckleU = u;
    if (y < base(u) - 1.2) break;
  }
  endU = u;
  f.z0 = f.zc - (J ? J.Lt + 2 : 6); f.du = du; f.prof = prof; f.z1 = f.z0 + endU;
  f.lipZ = f.z0 + lipU; f.knuckleZ = f.z0 + knuckleU; f.lipY = prof[Math.round(lipU / du)];
  f.w = J ? J.w : 30; f.sideK = J ? 0.85 : 0.5; f.soft = 0.35;
  let mo = 0; for (let i = 0; i < prof.length; i++) mo = Math.max(mo, prof[i] - base(i * du));
  f.reach = mo / f.sideK + 2; f.maxOff = mo;
}

// ---- rails
function buildRail(f) {
  const kind = f.kind, len = kind === 'kink' ? 26 : kind === 'log' ? 14 : kind === 'box' ? 12 : kind === 'ledge' ? 11 : 16;
  const hgt = kind === 'box' ? 0.55 : kind === 'log' ? 0.6 : kind === 'ledge' ? 0.7 : 0.85;
  const z0 = f.zc - len / 2, z1 = f.zc + len / 2, x = f.x;
  const pts = [];
  const yAt = z => baseH(x, z) + hgt;
  if (kind === 'kink') { const zm = z0 + 10; pts.push([x, yAt(z0) + 0.2, z0], [x, yAt(zm) + 0.2, zm], [x, yAt(z1) - 0.5, z1]); }
  else pts.push([x, yAt(z0), z0], [x, yAt(z1), z1]);
  f.pts = pts; f.hgt = hgt; f.width = kind === 'box' ? 0.32 : kind === 'ledge' ? 0.5 : kind === 'log' ? 0.22 : 0.05;
  // on-ramp: a little snow wedge that ends just under the rail start
  const ramp = { kind: 'ramp', zc: z0, x, w: 2.4, du: 0.25, soft: 0.2, sideK: 1.2 };
  const rl = 4.5, rz0 = z0 - rl - 0.3, prof = [];
  for (let u = 0; u <= rl + 1.0; u += 0.25) { const zz = rz0 + u, k = clamp(u / rl, 0, 1); prof.push(u <= rl ? profZ(zz) + (hgt - 0.12) * k * k * (3 - 2 * k) : profZ(zz) - 2); }
  Object.assign(ramp, { z0: rz0, z1: rz0 + rl + 1.0, prof, reach: 2, maxOff: hgt });
  return ramp;
}

// ------------------------------------------------------------ build
function buildCourse(ci) {
  C = COURSES[ci];
  const R = rng(C.seed);
  const H = new Float32Array(Math.ceil(C.len) + 1200); H[0] = 0;
  for (let i = 1; i < H.length; i++) H[i] = H[i - 1] - slopeAt(i - 200);
  W0 = { H, feats: [], rails: [], trees: [], rocks: [], tokens: [], lights: [], fences: [], roughAt: z => tableAt(C.rough, z) };
  // features
  for (const d of C.feats) {
    const [type, zc, a, b] = d;
    if (type === 'jump') { const f = { kind: 'jump', size: a, zc, x: cx(zc) + (b || 0) }; buildProfile(f); W0.feats.push(f); }
    else if (type === 'drop') { const f = { kind: 'drop', zc, x: cx(zc) + (a || 0) }; buildProfile(f); W0.feats.push(f); }
    else if (type === 'pipe') { const f = { kind: 'pipe', z0: zc, z1: zc + a, x: cx(zc + a / 2), yoff: 0 }; W0.feats.push(f); W0.pipe = f; }
    else { const f = { kind: type, zc, x: cx(zc) + (a || 0) }; const ramp = buildRail(f); W0.rails.push(f); W0.feats.push(ramp); }
  }
  W0.feats.sort((p, q) => p.z0 - q.z0);
  W0.jumps = W0.feats.filter(f => f.kind === 'jump' || f.kind === 'drop');
  // the pipe runs straight: flatten the base under it (follow its own centre)
  // trees
  const clearOf = (x, z, r) => {
    if (z < 40 && Math.abs(x - cx(z)) < 30) return false;
    for (const f of W0.feats) { if (f.kind === 'ramp') continue; if (z > f.z0 - r - 8 && z < f.z1 + r + 8 && Math.abs(x - f.x) < (f.kind === 'pipe' ? 32 : (f.w || 4) / 2 + (f.reach || 2) + r + 3)) return false; }
    for (const rl of W0.rails) if (z > rl.pts[0][2] - 14 && z < rl.pts[rl.pts.length - 1][2] + 8 && Math.abs(x - rl.x) < 6 + r) return false;
    return true;
  };
  const N = Math.round(2200 * C.trees * (C.len / 1200));
  for (let k = 0; k < N; k++) {
    const z = R() * (C.len + 260) - 60, c = cx(z), side = R() < 0.5 ? -1 : 1;
    let dx;
    const roll = R();
    if (roll < 0.86) dx = side * (46 + Math.pow(R(), 0.8) * 150);
    else if (C.glade && z > 130 && W0.roughAt(z) > 0.5) { dx = (R() - 0.5) * 84; if (Math.abs(dx - Math.sin(z * 0.013) * 14) < 9) continue; }
    else dx = side * (40 + R() * 20);
    const x = c + dx;
    if (!clearOf(x, z, 3)) continue;
    if (Math.abs(dx) < 46 && W0.trees.some(t => Math.abs(t.z - z) < 6 && Math.abs(t.x - x) < 6)) continue;
    W0.trees.push({ x, z, s: 0.75 + R() * 0.75, y: heightAt(x, z), kind: R() < 0.08 ? 1 : 0 });
  }
  for (let k = 0; k < 90 * (C.len / 1200); k++) {
    const z = R() * C.len, x = cx(z) + (R() < 0.5 ? -1 : 1) * (45 + R() * 90);
    if (!clearOf(x, z, 2)) continue;
    W0.rocks.push({ x, z, s: 0.8 + R() * 2.2, y: heightAt(x, z), r: R() * 6 });
  }
  // snowflake tokens: arcs through the air over every jump, lines down rails, and trails between
  for (const f of W0.jumps) {
    if (f.kind === 'drop') continue;
    const th = f.lipAngle, v = f.vd * 0.98, vx = v * Math.cos(th), vy = v * Math.sin(th);
    for (let k = 1; k <= 3; k++) { const t = 0.28 * k + 0.12; W0.tokens.push({ x: f.x, z: f.lipZ + vx * t, y: f.lipY + vy * t - GRAV * t * t / 2 + 1.0, air: true }); }
  }
  for (const rl of W0.rails) { const a = rl.pts[0], b = rl.pts[rl.pts.length - 1]; for (let k = 1; k <= 2; k++) { const t = k / 3; W0.tokens.push({ x: lerp(a[0], b[0], t), z: lerp(a[2], b[2], t), y: lerp(a[1], b[1], t) + 1.0 }); } }
  for (let z = 70; z < C.len - 30; z += 16) {
    const x = cx(z) + Math.sin(z * 0.021 + C.seed) * 24;
    if (!clearOf(x, z, 1) || W0.trees.some(t => Math.abs(t.z - z) < 4 && Math.abs(t.x - x) < 4)) continue;
    if (W0.tokens.some(t => Math.abs(t.z - z) < 12)) continue;
    W0.tokens.push({ x, z, y: heightAt(x, z) + 1.1 });
  }
  W0.tokens.forEach(t => t.got = false);
  // night lights
  if (C.lights) for (let z = -10; z < C.len; z += 34) for (const s of [-1, 1]) { const x = cx(z) + s * 26; W0.lights.push({ x, z, y: heightAt(x, z) }); }
  // chairlift line
  W0.lift = [];
  const lx = C.bigair ? -48 : 62;
  for (let z = -60; z < C.len + 100; z += 85) { const x = cx(z) + lx + Math.sin(z * 0.01) * 4; W0.lift.push([x, heightAt(x, z) + 11, z]); }
}

// ------------------------------------------------------------ meshes
const MESH = { chunks: [], feats: null, rails: null, deco: null, sky: null, mtn: null, token: null, chair: null, light: null };
function freeAll(R3) { MESH.chunks.forEach(c => R3.free(c.m)); MESH.chunks = []; for (const k of ['feats', 'rails', 'deco', 'sky', 'mtn', 'token', 'chair']) { R3.free(MESH[k]); MESH[k] = null; } }
function snowColor(x, z, n, groomed, R) {
  const k = vnoise(x * 0.08, z * 0.08, 9) * 0.05 + vnoise(x * 0.5, z * 0.5, 4) * 0.025;
  const steep = clamp((0.92 - n[1]) * 3, 0, 1);
  let c = [0.86 + k, 0.89 + k, 0.95 + k * 0.5];
  if (groomed) c = [c[0] - 0.015, c[1] - 0.005, c[2]];
  c = mixc(c, [0.78, 0.82, 0.92], steep * 0.6);
  if (n[1] < 0.72) c = mixc(c, [0.36, 0.37, 0.42], clamp((0.72 - n[1]) * 6, 0, 1));
  return c;
}
function lightPool(x, z) {   // baked lamp light (night course): returns glow 0..1
  if (!W0.lights.length) return 0;
  let g = 0; for (const L of W0.lights) { if (Math.abs(L.z - z) > 30) continue; const d = Math.hypot(L.x - x, L.z - z); g += Math.exp(-d * d / 260); }
  return clamp(g * 0.55, 0, 0.7);
}
function vcol(c, x, z) { const g = lightPool(x, z); if (!g) return [c[0], c[1], c[2], 0]; const w = mixc(c, [1.0, 0.93, 0.8], 0.5); return [w[0] * (0.25 + g * 0.6), w[1] * (0.25 + g * 0.6), w[2] * (0.25 + g * 0.6), g]; }

function buildMeshes(R3) {
  freeAll(R3);
  const R = rng(C.seed + 5);
  // terrain: dense grid near the run, sparse further out. Sampled from the base (features have their own meshes)
  const CH = 40, step = 2.5;
  for (let z0 = -140; z0 < C.len + 360; z0 += CH) {
    const mb = new MB(), c = cx(z0 + CH / 2), xs = [];
    for (let x = -260; x < -70; x += 9) xs.push(c + x);
    for (let x = -70; x <= 70; x += step) xs.push(c + x);
    for (let x = 79; x <= 260; x += 9) xs.push(c + x);
    const P = [], N = [], Cc = [];
    for (let j = 0; j * step <= CH; j++) {
      const z = z0 + j * step, row = [], nrow = [], crow = [];
      for (const x of xs) {
        const y = baseH(x, z) - 0.06, n = baseNormal(x, z);
        row.push([x, y, z]); nrow.push(n);
        crow.push(vcol(snowColor(x, z, n, Math.abs(x - cx(z)) < 40, R), x, z));
      }
      P.push(row); N.push(nrow); Cc.push(crow);
    }
    for (let j = 0; j < P.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) {
      const a = P[j][i], b = P[j][i + 1], cc = P[j + 1][i + 1], d = P[j + 1][i];
      const g = Math.abs((a[0] + b[0]) / 2 - cx(a[2])) < 40 ? -2 : 0;   // groomed piste flag for the shader
      triNC(mb, a, cc, b, N[j][i], N[j + 1][i + 1], N[j][i + 1], Cc[j][i], Cc[j + 1][i + 1], Cc[j][i + 1], g);
      triNC(mb, a, d, cc, N[j][i], N[j + 1][i], N[j + 1][i + 1], Cc[j][i], Cc[j + 1][i], Cc[j + 1][i + 1], g);
    }
    // trees + rocks in this chunk
    W0.trees.forEach(t => { if (t.z >= z0 && t.z < z0 + CH) addTree(mb, t, R); });
    W0.rocks.forEach(r => { if (r.z >= z0 && r.z < z0 + CH) {
      mb.ball(M4.compose(r.x, r.y + r.s * 0.2, r.z, r.r, r.s * 1.6, r.s * 1.1, r.s * 1.3), 10, 7, [0.33, 0.34, 0.38, 0]);
      mb.ball(M4.compose(r.x + 0.3, r.y + r.s * 0.05, r.z + 0.4, r.r + 1, r.s * 0.9, r.s * 0.7, r.s * 0.8), 8, 6, [0.29, 0.3, 0.34, 0]);
      mb.ball(M4.compose(r.x + 0.1, r.y + r.s * 0.66, r.z, r.r, r.s * 1.3, r.s * 0.42, r.s * 1.05), 10, 5, [0.93, 0.95, 1, 0]); } });
    MESH.chunks.push({ z0, m: R3.mesh(mb) });
  }
  // features: fine grids so lips and knuckles look crisp
  const fm = new MB();
  for (const f of W0.feats) {
    if (f.kind === 'pipe') { buildPipeMesh(fm, f, R); continue; }
    const half = f.w / 2 + f.reach, dv = f.kind === 'ramp' ? 0.4 : 0.8, du = f.kind === 'ramp' ? 0.4 : 0.5;
    const J = f.kind === 'jump' ? JUMP_SIZES[f.size] : null, dye = J ? hex(J.col === '#111827' ? '#2563eb' : J.col) : null;
    const us = []; for (let z = f.z0; z <= f.z1 + 0.01; z += du) us.push(z);
    const vs = []; for (let v = -half; v <= half + 0.01; v += dv) vs.push(f.x + v);
    const G = us.map(z => vs.map(x => [x, heightAt(x, z), z]));
    const Nn = us.map(z => vs.map(x => normalAt(x, z)));
    for (let j = 0; j < us.length - 1; j++) for (let i = 0; i < vs.length - 1; i++) {
      const a = G[j][i], b = G[j][i + 1], cc = G[j + 1][i + 1], d = G[j + 1][i];
      // skip cells that sit on the plain base (the terrain mesh already covers them)
      const above = Math.max(a[1] - baseH(a[0], a[2]), b[1] - baseH(b[0], b[2]), cc[1] - baseH(cc[0], cc[2]), d[1] - baseH(d[0], d[2]));
      if (above < 0.02) continue;
      const zz = (a[2] + d[2]) / 2, xx = (a[0] + b[0]) / 2, inW = Math.abs(xx - f.x) < f.w / 2;
      let col = snowColor(xx, zz, Nn[j][i], true, R);
      col = mixc(col, [0.97, 0.98, 1.0], inW ? 0.5 : 0);   // freshly shaped
      if (dye && inW && (Math.abs(zz - f.lipZ) < 0.22 || Math.abs(zz - f.knuckleZ) < 0.22)) col = dye;
      if (f.kind === 'drop' && inW && Math.abs(zz - f.knuckleZ) < 0.4) col = [0.2, 0.45, 0.95];
      const c4 = vcol(col, xx, zz);
      fm.triN(a, cc, b, Nn[j][i], Nn[j + 1][i + 1], Nn[j][i + 1], c4);
      fm.triN(a, d, cc, Nn[j][i], Nn[j + 1][i], Nn[j + 1][i + 1], c4);
    }
    if (J) {   // size sign + lip flags
      const sx = f.x - f.w / 2 - 2.2, sz = f.z0 - 6, sy = heightAt(sx, sz);
      fm.tube(M4.compose(sx, sy + 1.1, sz, 0, 0.09, 2.2, 0.09), 6, [0.25, 0.25, 0.3, 0]);
      const sc = hex(J.col);
      if (f.size === 'XL' || f.size === 'BIG') { [-0.32, 0.32].forEach(o => fm.box(M4.compose(sx + o, sy + 2.3, sz, Math.PI / 4, 0.42, 0.42, 0.06), [...sc, 0.15])); }
      else if (f.size === 'S') fm.cyl(M4.compose(sx, sy + 2.3, sz, 0, 0.7, 0.06, 0.7, Math.PI / 2), 14, [...sc, 0.15]);
      else if (f.size === 'M') fm.box(M4.compose(sx, sy + 2.3, sz, 0, 0.66, 0.66, 0.06), [...sc, 0.15]);
      else fm.box(M4.compose(sx, sy + 2.3, sz, Math.PI / 4, 0.55, 0.55, 0.06), [...sc, 0.15]);
      [-1, 1].forEach(s => { const x = f.x + s * (f.w / 2 + 0.4), y = heightAt(x, f.lipZ); fm.tube(M4.compose(x, y + 0.8, f.lipZ, 0, 0.05, 1.6, 0.05), 5, [0.2, 0.2, 0.22, 0]); const fc = hex(s < 0 ? '#ef4444' : '#2563eb'); fm.surf(M4.compose(x, y + 1.45, f.lipZ), (u, v) => [s * u * 0.75, (v - 0.5) * 0.42 * (1 - u * 0.35), Math.sin(u * 4.2 + v * 0.6) * 0.07 * u], 10, 3, [...fc, 0.2], [0, 0, -1]); });
    }
  }
  MESH.feats = R3.mesh(fm);
  // rails, boxes and logs
  const rm = new MB();
  for (const r of W0.rails) {
    for (let k = 0; k < r.pts.length - 1; k++) {
      const a = r.pts[k], b = r.pts[k + 1], L = Math.hypot(b[1] - a[1], b[2] - a[2]), pitch = Math.atan2(-(b[1] - a[1]), b[2] - a[2]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
      if (r.kind === 'ledge') {   // concrete ledge with steel coping
        rm.rbox(M4.mul(M4.compose(mx, my - 0.42, mz), M4.mul(M4.rotX(pitch), M4.scale(1.1, 0.86, L))), 16, 8, [0.62, 0.62, 0.6, 0], 0.18);
        [-0.52, 0.52].forEach(o => rm.tube(M4.mul(M4.compose(mx + o, my - 0.02, mz), M4.mul(M4.rotX(pitch + Math.PI / 2), M4.scale(0.07, L, 0.07))), 8, [0.75, 0.78, 0.84, 0]));
        rm.rbox(M4.mul(M4.compose(mx, my - 0.02, mz), M4.mul(M4.rotX(pitch), M4.scale(1.04, 0.05, L))), 12, 3, [0.7, 0.7, 0.68, 0], 0.3);
      } else if (r.kind === 'box') {
        // fun box: rounded body in team colour with a white racing stripe, slick white top, steel edges
        const bc = hex(r.x > cx(r.zc) ? '#f59e0b' : '#3b82f6'), RX = M4.rotX(pitch);
        rm.rbox(M4.mul(M4.compose(mx, my - 0.33, mz), M4.mul(RX, M4.scale(0.6, 0.6, L - 0.02))), 16, 10, [...bc, 0], 0.08);
        [-0.301, 0.301].forEach(o => rm.box(M4.mul(M4.compose(mx + o, my - 0.36, mz), M4.mul(RX, M4.scale(0.01, 0.07, L * 0.9))), [0.95, 0.96, 0.98, 0]));
        rm.rbox(M4.mul(M4.compose(mx, my - 0.03, mz), M4.mul(RX, M4.scale(0.64, 0.06, L))), 12, 4, [0.92, 0.93, 0.95, 0], 0.25);
        [-0.32, 0.32].forEach(o => rm.tube(M4.mul(M4.compose(mx + o, my - 0.04, mz), M4.mul(M4.rotX(pitch + Math.PI / 2), M4.scale(0.03, L, 0.03))), 8, [0.72, 0.75, 0.8, 0]));
      } else if (r.kind === 'log') {
        rm.tube(M4.mul(M4.compose(mx, my - 0.18, mz), M4.mul(M4.rotX(pitch + Math.PI / 2), M4.scale(0.42, L + 0.4, 0.42))), 9, [0.45, 0.3, 0.2, 0], [0.75, 0.6, 0.42, 0]);
        rm.box(M4.mul(M4.compose(mx, my + 0.02, mz), M4.mul(M4.rotX(pitch), M4.scale(0.3, 0.06, L))), [0.95, 0.97, 1, 0]);
      } else {
        rm.tube(M4.mul(M4.compose(mx, my - 0.05, mz), M4.mul(M4.rotX(pitch + Math.PI / 2), M4.scale(0.1, L, 0.1))), 14, [0.82, 0.84, 0.9, 0]);
        if (k === 0 || k === r.pts.length - 2) { const e = k === 0 ? a : b; rm.ball(M4.compose(e[0], e[1] - 0.05, e[2], 0, 0.2, 0.2, 0.2), 10, 6, [0.25, 0.26, 0.3, 0]); }
      }
    }
    // legs
    const n = r.kind === 'kink' ? 4 : 3;
    for (let k = 0; k <= n; k++) {
      const t = k / n, tot = r.pts.length - 1, seg = Math.min(tot - 1, Math.floor(t * tot)), lt = t * tot - seg;
      const a = r.pts[seg], b = r.pts[seg + 1], y = lerp(a[1], b[1], lt), z = lerp(a[2], b[2], lt), gy = baseH(r.x, z);
      if (r.kind === 'log' || r.kind === 'ledge') continue;
      rm.tube(M4.compose(r.x, (y + gy) / 2 - 0.2, z, 0, 0.08, Math.max(0.2, y - gy + 0.2), 0.08), 10, [0.32, 0.34, 0.4, 0]);
      rm.ball(M4.compose(r.x, gy - 0.05, z, 0, 0.55, 0.22, 0.55), 12, 6, [0.93, 0.95, 1, 0]);   // snow banked round the post
    }
  }
  // finish line + start gate
  const fz = C.bigair ? -1e9 : C.len, fx = cx(fz), fy = baseH(fx, fz);
  if (!C.bigair) {
    [-1, 1].forEach(s => rm.box(M4.compose(fx + s * 21, fy + 3.2, fz, 0, 1.1, 6.6, 1.1), [0.92, 0.94, 0.98, 0]));
    rm.box(M4.compose(fx, fy + 6.9, fz, 0, 43.2, 1.8, 0.8), [0.12, 0.13, 0.18, 0]);
    for (let i = 0; i < 16; i++) rm.box(M4.compose(fx - 20 + i * 2.66, fy + 6.9, fz - 0.42, 0, 2.6, 1.5, 0.04), i % 2 ? [0.95, 0.96, 1, 0.3] : [0.1, 0.1, 0.12, 0.1]);
    // fences + crowd around the finish
    for (let z = fz - 30; z < fz + 40; z += 2.2) for (const s of [-1, 1]) {
      const x = cx(z) + s * 23, y = baseH(x, z);
      rm.box(M4.compose(x, y + 0.5, z, 0, 0.08, 1.0, 2.2), [0.95, 0.42, 0.12, 0]);
      if (z > fz - 25 && R() < 0.75) { const px = x + s * (1.2 + R() * 2.5), py = baseH(px, z); const jc = hex(['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#f8fafc', '#111827'][Math.floor(R() * 8)]);
        const sw = R() * 6.28; rm.rbox(M4.compose(px, py + 0.45, z, 0, 0.34, 0.9, 0.26), 8, 6, [0.15, 0.16, 0.22, 0], 0.5); rm.rbox(M4.compose(px, py + 1.2, z, 0, 0.5, 0.66, 0.34), 10, 6, [...jc, 0], 0.5);
          rm.ball(M4.compose(px, py + 1.66, z, 0, 0.26, 0.3, 0.26), 8, 6, [0.95, 0.8, 0.68, 0]); rm.ball(M4.compose(px, py + 1.76, z, 0, 0.29, 0.2, 0.29), 8, 5, [...jc, 0]);
          if (R() < 0.4) rm.tube(M4.compose(px + Math.cos(sw) * 0.2, py + 1.75, z, 0, 0.05, 0.6, 0.05), 5, [...jc, 0]); }
    }
  }
  const sz = 6, sx = cx(sz), sy = baseH(sx, sz);
  [-1, 1].forEach(s => rm.box(M4.compose(sx + s * 7, sy + 2.5, sz, 0, 0.6, 5, 0.6), [0.15, 0.16, 0.22, 0]));
  rm.box(M4.compose(sx, sy + 5.2, sz, 0, 14.6, 1.0, 0.5), [0.15, 0.16, 0.22, 0]);
  rm.box(M4.compose(sx, sy + 5.2, sz - 0.27, 0, 13, 0.6, 0.04), [0.23, 0.51, 0.96, 0.35]);
  // start hut
  const hx = sx - 16, hy = baseH(hx, -8);
  rm.box(M4.compose(hx, hy + 1.5, -8, 0.2, 6, 3, 5), [0.55, 0.36, 0.24, 0], 0, [0.55, 0.36, 0.24, 0]);
  rm.taper(M4.compose(hx, hy + 3, -8, 0.2, 7, 2, 6), 0.05, 1, [0.95, 0.97, 1, 0]);
  // groomed run edge markers (orange/black poles)
  if (!C.bigair) for (let z = 40; z < C.len; z += 26) for (const s of [-1, 1]) { const x = cx(z) + s * 44, y = baseH(x, z); rm.tube(M4.compose(x, y + 0.9, z, 0, 0.06, 1.8, 0.06), 5, s < 0 ? [0.95, 0.45, 0.1, 0] : [0.12, 0.12, 0.14, 0]); }
  // chairlift towers + cables
  W0.lift.forEach((p, i) => {
    const gy = baseH(p[0], p[2]);
    rm.tube(M4.compose(p[0], (gy + p[1]) / 2, p[2], 0, 0.45, p[1] - gy + 0.5, 0.45), 8, [0.42, 0.45, 0.52, 0]);
    rm.box(M4.compose(p[0], p[1] + 0.2, p[2], 0, 5.6, 0.35, 0.5), [0.42, 0.45, 0.52, 0]);
    [-2.5, 2.5].forEach(o => rm.cyl(M4.compose(p[0] + o, p[1] + 0.2, p[2], 0, 0.7, 0.25, 0.7, Math.PI / 2), 10, [0.18, 0.2, 0.25, 0]));
    const q = W0.lift[i + 1]; if (!q) return;
    [-2.5, 2.5].forEach(o => { const a = [p[0] + o, p[1] - 0.1, p[2]], b = [q[0] + o, q[1] - 0.1, q[2]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      rm.box(M4.mul(M4.trans((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), M4.mul(M4.rotY(Math.atan2(b[0] - a[0], b[2] - a[2])), M4.mul(M4.rotX(-Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2]))), M4.scale(0.05, 0.05, L)))), [0.1, 0.1, 0.12, 0]); });
  });
  // night lamps
  W0.lights.forEach(L => { rm.tube(M4.compose(L.x, L.y + 5, L.z, 0, 0.18, 10, 0.18), 6, [0.25, 0.27, 0.33, 0]); rm.box(M4.compose(L.x, L.y + 10.1, L.z, 0, 1.6, 0.5, 0.9), [1, 0.95, 0.82, 1]); });
  MESH.rails = R3.mesh(rm);
  // sky: the gradient + sun are drawn per pixel (R3.skyDome); this mesh only holds soft clouds
  const sk = new MB(), hor = hex(C.sky[1]);
  for (let k = 0; k < 18 && false; k++) {
    const a = R() * 6.28, d = 1700 + R() * 500, y = 260 + R() * 380, n = 4 + Math.floor(R() * 4), cc = mixc(hor, [1, 1, 1], 0.78).map(x => x / 1.15);
    for (let j = 0; j < n; j++) { const o = (j - n / 2) * (60 + R() * 40); sk.ball(M4.compose(Math.cos(a) * d - Math.sin(a) * o, y + R() * 40 - Math.abs(j - n / 2) * 12, Math.sin(a) * d + Math.cos(a) * o, a, 110 + R() * 110, 46 + R() * 34, 120 + R() * 90), 12, 7, [...cc, 1]); }
  }
  MESH.sky = R3.mesh(sk);
  // distant mountains: a smooth ring of peaks around the camera, snow on the gentle slopes, rock on the steep faces
  const mm = new MB(), NA = 360, RS = [], seed = C.seed;
  for (let r = 950; r < 2700; r *= 1.075) RS.push(r);
  const hAt = (a, r) => {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    let h = 0, amp = 1, fr = 1 / 520;
    for (let o = 0; o < 6; o++) { const v = vnoise(x * fr + 31.7, z * fr - 12.3, seed + o * 3); const ridge = 1 - Math.abs(v * 2 - 1); h += ridge * ridge * amp; amp *= 0.47; fr *= 2.03; }
    const big = 0.45 + 0.85 * vnoise(x / 1400 + 9, z / 1400 + 9, seed + 31);
    const env = clamp((r - 950) / 650, 0, 1);
    return -240 + h * 520 * big * (env * env * (3 - 2 * env));
  };
  const G = RS.map(r => { const row = []; for (let i = 0; i <= NA; i++) { const a = i / NA * 6.2832; row.push([Math.cos(a) * r, hAt(a, r), Math.sin(a) * r]); } return row; });
  const nrm = (j, i) => { const p = G[j][i], A = G[j][(i + 1) % (NA + 1)], B = G[Math.min(RS.length - 1, j + 1)][i], Cq = G[j][(i + NA - 1) % (NA + 1)], D = G[Math.max(0, j - 1)][i];
    const u = [A[0] - Cq[0], A[1] - Cq[1], A[2] - Cq[2]], v = [B[0] - D[0], B[1] - D[1], B[2] - D[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (n[1] < 0) n = n.map(x => -x); const l = Math.hypot(...n) || 1; return n.map(x => x / l); };
  const N = G.map((row, j) => row.map((_, i) => nrm(j, i)));
  const rockC = C.bigair ? [0.16, 0.17, 0.22] : [0.34, 0.33, 0.36], rock2 = C.bigair ? [0.12, 0.13, 0.18] : [0.25, 0.25, 0.29], snowC = [0.93, 0.95, 1.0];
  const colAt = (j, i) => {
    const p = G[j][i], n = N[j][i], a = i / NA * 6.2832, line = -150 + (vnoise(Math.cos(a) * 9, Math.sin(a) * 9, seed + 77) - 0.5) * 120;
    const steep = clamp((0.62 - n[1]) * 3.5, 0, 1), high = clamp((p[1] - line) / 70, 0, 1);
    const streak = vnoise(p[0] * 0.02, p[2] * 0.02, seed + 5);
    const rock = mixc(rock2, rockC, streak);
    let c = mixc(rock, snowC, high * (1 - steep * 0.85));
    if (p[1] < -170) c = mixc(c, [0.42, 0.48, 0.5], clamp((-170 - p[1]) / 90, 0, 0.5));   // hazy valleys
    return [c[0], c[1], c[2], 0];
  };
  const Cc = G.map((row, j) => row.map((_, i) => colAt(j, i)));
  for (let j = 0; j < RS.length - 1; j++) for (let i = 0; i < NA; i++) {
    triNC(mm, G[j][i], G[j + 1][i], G[j + 1][i + 1], N[j][i], N[j + 1][i], N[j + 1][i + 1], Cc[j][i], Cc[j + 1][i], Cc[j + 1][i + 1]);
    triNC(mm, G[j][i], G[j + 1][i + 1], G[j][i + 1], N[j][i], N[j + 1][i + 1], N[j][i + 1], Cc[j][i], Cc[j + 1][i + 1], Cc[j][i + 1]);
  }
  MESH.mtn = R3.mesh(mm);
  const tk = new MB();
  for (let k = 0; k < 6; k++) tk.box(M4.compose(0, 0, 0, k * Math.PI / 6, 0.12, 0.12, 1.1), [0.55, 0.9, 1, 0.75]);
  tk.ball(M4.compose(0, 0, 0, 0, 0.42, 0.42, 0.42), 8, 6, [0.8, 0.97, 1, 0.85]);
  MESH.token = R3.mesh(tk);
  const ch = new MB();
  ch.box(M4.compose(0, -2.6, 0, 0, 2.6, 0.12, 0.7), [0.2, 0.22, 0.28, 0]); ch.box(M4.compose(0, -2.25, -0.33, 0, 2.6, 0.7, 0.1), [0.2, 0.22, 0.28, 0]);
  ch.tube(M4.compose(0, -1.2, 0, 0, 0.07, 2.4, 0.07), 5, [0.3, 0.32, 0.38, 0]); ch.box(M4.compose(0, -2.1, 0.25, 0, 2.5, 0.06, 0.06), [0.3, 0.32, 0.38, 0]);
  MESH.chair = R3.mesh(ch);
}
function addTree(mb, t, R) {
  const s = t.s, x = t.x, y = t.y, z = t.z;
  if (t.kind === 1) {   // bare larch
    mb.cone(M4.compose(x, y - 0.3, z, 0, 0.5 * s, 8 * s, 0.5 * s), 6, [0.3, 0.24, 0.2, 0], 0.05);
    for (let k = 0; k < 6; k++) { const yy = y + (2.5 + k * 0.9) * s, a = R() * 6.28; mb.box(M4.mul(M4.compose(x + Math.cos(a) * 0.6 * s, yy, z + Math.sin(a) * 0.6 * s, -a), M4.mul(M4.rotZ(0.4), M4.scale(1.4 * s, 0.08, 0.08))), [0.3, 0.24, 0.2, 0]); }
    return;
  }
  // spruce: tiers of star-shaped branch skirts (tips droop), snow lying on the inner part of every tier
  const g = 0.17 + R() * 0.08, hue = R() * 0.04;
  const deep = [0.035, g * 0.62, 0.075 + hue, 0], green = [0.06 + hue, g, 0.1 + hue * 2, 0], tipC = [0.1 + hue, g + 0.06, 0.12, 0];
  const cover = C.bigair ? 0.35 : 0.35 + R() * 0.55, snow = [0.9, 0.93, 1.0, 0], under = [0.03, 0.08, 0.06, 0];
  mb.tube(M4.compose(x, y + 0.6 * s, z, 0, 0.3 * s, 1.6 * s, 0.3 * s), 7, [0.26, 0.19, 0.14, 0]);
  const tiers = 6, nb = 7;
  const tier = (yy, r, h, rot, k) => {
    const ap = [x, yy + h, z], tip = [], mid = [];
    for (let i = 0; i <= nb * 2; i++) {
      const a = rot + i / (nb * 2) * 6.2832, isTip = i % 2 === 0 && i < nb * 2 || i === nb * 2, rr = r * (isTip ? 0.92 + 0.16 * Math.sin(a * 5 + rot * 3) : 0.6);
      const dy = isTip ? -0.32 * r : -0.06 * r;
      tip.push([x + Math.cos(a) * rr, yy + dy, z + Math.sin(a) * rr, a, isTip]);
      mid.push([x + Math.cos(a) * rr * 0.5, yy + h * 0.45 + dy * 0.4, z + Math.sin(a) * rr * 0.5, a]);
    }
    const nrm = (q, up) => { const l = Math.hypot(1, up); return [Math.cos(q[3]) / l, up / l, Math.sin(q[3]) / l]; };
    const sc = (k2) => mixc(green, snow, k2);
    const midC = [...sc(clamp(cover * 1.3, 0, 1)), 0], apC = [...sc(clamp(cover * 1.5, 0, 1)), 0];
    for (let i = 0; i < nb * 2; i++) {
      const t0 = tip[i], t1 = tip[i + 1], m0 = mid[i], m1 = mid[i + 1];
      const c0 = t0[4] ? tipC : deep, c1 = t1[4] ? tipC : deep;
      triNC(mb, ap, m0, m1, [0, 1, 0], nrm(m0, 1.4), nrm(m1, 1.4), apC, midC, midC);
      triNC(mb, m0, t0, t1, nrm(m0, 1.4), nrm(t0, 0.7), nrm(t1, 0.7), midC, [...c0, 0].slice(0, 4), [...c1, 0].slice(0, 4));
      triNC(mb, m0, t1, m1, nrm(m0, 1.4), nrm(t1, 0.7), nrm(m1, 1.4), midC, [...c1, 0].slice(0, 4), midC);
      // underside, dark
      const u0 = [x + (t0[0] - x) * 0.3, yy - 0.02 * r, z + (t0[2] - z) * 0.3], u1 = [x + (t1[0] - x) * 0.3, yy - 0.02 * r, z + (t1[2] - z) * 0.3];
      triNC(mb, t0, u0, u1, [0, -1, 0], [0, -1, 0], [0, -1, 0], under, under, under);
      triNC(mb, t0, u1, t1, [0, -1, 0], [0, -1, 0], [0, -1, 0], under, under, under);
    }
  };
  for (let k = 0; k < tiers; k++) {
    const f = k / tiers, yy = y + (1.2 + k * 1.15) * s, r = (2.8 * (1 - f * 0.82)) * s, h = (1.7 - f * 0.4) * s;
    tier(yy, r, h, R() * 6.28, k);
  }
  tier(y + (1.2 + tiers * 1.15) * s - 0.2 * s, 0.45 * s, 1.3 * s, R() * 6.28, tiers);
}
function buildPipeMesh(mb, f, R) {
  const half = PIPE.floor + PIPE.R + PIPE.deck + 12;
  const xs = []; for (let v = -half; v <= half + 0.01; v += (Math.abs(v) < PIPE.floor - 1 ? 1.5 : 0.5)) xs.push(f.x + v);
  for (let z = f.z0; z < f.z1; z += 1.5) {
    const z2 = Math.min(f.z1, z + 1.5);
    for (let i = 0; i < xs.length - 1; i++) {
      const p = (x, zz) => [x, heightAt(x, zz), zz];
      const a = p(xs[i], z), b = p(xs[i + 1], z), c = p(xs[i + 1], z2), d = p(xs[i], z2);
      if (Math.max(a[1] - baseH(a[0], a[2]), b[1] - baseH(b[0], b[2])) < 0.02 && Math.abs(xs[i] - f.x) > PIPE.floor) continue;
      const n = normalAt((a[0] + b[0]) / 2, z + 0.75), v = Math.abs((a[0] + b[0]) / 2 - f.x);
      let col = snowColor(a[0], z, n, true, R);
      col = mixc(col, [0.98, 0.99, 1], 0.4);
      const vTop = PIPE.floor + PIPE.R * Math.sin(PIPE.maxA) + 0.35 / Math.tan(PIPE.maxA);
      if (v > vTop + 0.05 && v < vTop + 0.6) col = [0.2, 0.45, 0.95];   // dye line along the lip
      mb.triN(a, c, b, normalAt(a[0], a[2]), normalAt(c[0], c[2]), normalAt(b[0], b[2]), vcol(col, a[0], z));
      mb.triN(a, d, c, normalAt(a[0], a[2]), normalAt(d[0], d[2]), normalAt(c[0], c[2]), vcol(col, a[0], z));
    }
  }
}
