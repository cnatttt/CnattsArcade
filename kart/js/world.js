// =====================================================================
//  TURBO KARTS - builds the 3D world for a track (terrain, road, scenery)
// =====================================================================
'use strict';

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hexRGB(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }
function rgbMix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function seededRand(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// quad that always faces up (for ground-like surfaces)
function upQuad(mb, a, b, c, d, col, jit) {
  const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
  if (uz * vx - ux * vz < 0) mb.quad(a, d, c, b, col, jit); else mb.quad(a, b, c, d, col, jit);
}

// ------------------------------------------------------------ prefabs (built once)
const PREFAB = {};
function prefab(name) {
  if (PREFAB[name]) return PREFAB[name];
  const b = new MB(), C = M4.compose;
  switch (name) {
    case 'tree': b.cyl(C(0, 1.2, 0, 0, 0.6, 2.4, 0.6), 6, '#6a4a2a'); b.sphere(C(0, 3.6, 0, 0, 4.2, 3.6, 4.2), 7, 5, '#3a9a3a', 0.12); b.sphere(C(0.5, 5.0, 0.3, 0, 3, 2.6, 3), 6, 4, '#4ab048', 0.12); break;
    case 'tree2': b.cyl(C(0, 1.5, 0, 0, 0.5, 3, 0.5), 6, '#7a5a3a'); b.sphere(C(0, 4.4, 0, 0, 3.4, 4.4, 3.4), 6, 5, '#2a8a4a', 0.12); break;
    case 'bush': b.sphere(C(0, 0.6, 0, 0, 2.2, 1.6, 2.2), 6, 4, '#4aa040', 0.15); break;
    case 'rock': b.sphere(C(0, 0.6, 0, 0, 2.6, 1.8, 2.2), 6, 4, '#8a8a94', 0.18); break;
    case 'flowers': for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 0.4 + (k % 3) * 0.5; b.box(C(Math.cos(a) * r, 0.25, Math.sin(a) * r, 0, 0.35, 0.35, 0.35), ['#ffe650', '#ff7ab0', '#ffffff', '#8ad8ff'][k % 4]); b.box(C(Math.cos(a) * r, 0.05, Math.sin(a) * r, 0, 0.08, 0.3, 0.08), '#3a8a2a'); } break;
    case 'pine':
      b.cyl(C(0, 0.8, 0, 0, 0.6, 1.6, 0.6), 5, '#5a3a2a');
      [[1.2, 4.6, 3.6], [3.0, 3.6, 3.0], [4.6, 2.6, 2.6]].forEach(([y, w, h]) => { b.cone(C(0, y, 0, 0.3, w, h, w), 7, '#2a6a4a', 0.1); b.cone(C(0, y + h * 0.55, 0, 0.3, w * 0.48, h * 0.45, w * 0.48), 7, '#f4f8ff', 0.05); });
      break;
    case 'snowman': b.sphere(C(0, 0.9, 0, 0, 1.9, 1.8, 1.9), 7, 5, '#f8fbff', 0.04); b.sphere(C(0, 2.3, 0, 0, 1.35, 1.3, 1.35), 7, 5, '#f8fbff', 0.04); b.sphere(C(0, 3.35, 0, 0, 0.95, 0.95, 0.95), 7, 5, '#f8fbff', 0.04); b.cone(C(0, 3.35, 0.4, 0, 0.18, 0.7, 0.18, Math.PI / 2), 5, '#ff8a1a', 0); b.box(C(-0.18, 3.5, 0.42, 0, 0.12, 0.12, 0.1), '#1a1a1a'); b.box(C(0.18, 3.5, 0.42, 0, 0.12, 0.12, 0.1), '#1a1a1a'); b.cyl(C(0, 3.9, 0, 0, 0.9, 0.1, 0.9), 8, '#2a2a2a'); b.cyl(C(0, 4.2, 0, 0, 0.6, 0.6, 0.6), 8, '#2a2a2a'); b.box(C(0, 2.75, 0.05, 0, 1.4, 0.25, 1.4), '#e83a3a'); break;
    case 'cabin': b.box(C(0, 1.6, 0, 0, 6, 3.2, 5), '#8a5a3a'); b.taper(C(0, 3.2, 0, 0, 7, 2.4, 6), 0.05, 1, '#f4f8ff'); b.box(C(0, 1.2, 2.55, 0, 1.2, 2.2, 0.1), '#4a2a1a'); b.box(C(1.8, 1.9, 2.55, 0, 1.2, 1, 0.1), [1, 0.85, 0.4, 0.8]); b.box(C(2.2, 4.6, -1, 0, 0.8, 2, 0.8), '#6a4a3a'); break;
    case 'cactus': b.cyl(C(0, 2.4, 0, 0, 0.9, 4.8, 0.9), 7, '#3a9a4a', '#5ab85a'); b.cyl(C(0.8, 2.2, 0, 0, 0.6, 0.6, 0.6, 0, Math.PI / 2), 6, '#3a9a4a'); b.cyl(C(1.15, 3.0, 0, 0, 0.6, 1.8, 0.6), 6, '#3a9a4a', '#5ab85a'); b.cyl(C(-0.7, 3.1, 0, 0, 0.5, 0.5, 0.5, 0, Math.PI / 2), 6, '#3a9a4a'); b.cyl(C(-1.0, 3.6, 0, 0, 0.5, 1.2, 0.5), 6, '#3a9a4a', '#5ab85a'); break;
    case 'mesa': [['#c8703a', 1, 0], ['#d8844a', 0.86, 1], ['#b8603a', 0.72, 2]].forEach(([c, s, i]) => b.cyl(C(0, 4 + i * 7.5, 0, i * 0.4, 22 * s, 8, 18 * s), 7, c, '#e8a060', 0.1)); break;
    case 'desertrock': b.sphere(C(0, 0.8, 0, 0, 3.4, 2.4, 2.8), 6, 4, '#c87a4a', 0.15); break;
    case 'skull': b.sphere(C(0, 0.5, 0, 0, 1.2, 1.0, 1.4), 6, 4, '#f0e8d8'); b.box(C(-0.25, 0.6, 0.6, 0, 0.3, 0.3, 0.2), '#1a1a1a'); b.box(C(0.25, 0.6, 0.6, 0, 0.3, 0.3, 0.2), '#1a1a1a'); break;
    case 'lamp': b.cyl(C(0, 3.5, 0, 0, 0.3, 7, 0.3), 6, '#3a3a4a'); b.box(C(0, 7.1, 0.8, 0, 0.3, 0.3, 1.8), '#3a3a4a'); b.box(C(0, 6.9, 1.6, 0, 0.9, 0.3, 0.6), [1, 0.95, 0.75, 1]); break;
    case 'billboard': b.box(C(-3, 3, 0, 0, 0.4, 6, 0.4), '#3a3a4a'); b.box(C(3, 3, 0, 0, 0.4, 6, 0.4), '#3a3a4a'); b.box(C(0, 7.5, 0, 0, 9, 4, 0.4), '#1a1a2a'); break;
    case 'grandstand':
      for (let s = 0; s < 5; s++) { const ht = 0.8 + s * 1.1; b.box(C(0, ht / 2, -s * 1.6, 0, 30, ht, 1.6), s % 2 ? '#b8b8c8' : '#9a9aaa'); for (let k = 0; k < 24; k++) if ((k * 7 + s * 3) % 5) b.box(C(-14 + k * 1.2, ht + 0.4, -s * 1.6 - 0.2, 0, 0.6, 0.8, 0.5), ['#e83a3a', '#3a8ae8', '#ffe03a', '#5ad03a', '#ff8ad8', '#ffffff'][(k * 3 + s) % 6]); }
      b.box(C(0, 8, -5, 0, 32, 0.4, 9), '#e83a3a'); b.box(C(-15.5, 4, -5, 0, 0.4, 8, 0.4), '#d8d8e0'); b.box(C(15.5, 4, -5, 0, 0.4, 8, 0.4), '#d8d8e0');
      break;
    case 'windmill': b.taper(C(0, 0, 0, 0, 5, 12, 5), 0.55, 0.55, '#f0e8d8'); b.taper(C(0, 12, 0, 0, 3.4, 2.4, 3.4), 0.1, 0.1, '#c83a3a'); b.box(C(0, 1.5, 2.4, 0, 1.4, 3, 0.2), '#6a4a2a'); break;
    case 'blades': for (let k = 0; k < 4; k++) b.box(M4.mul(M4.rotZ(k * Math.PI / 2), C(0, 4.2, 0, 0, 1.4, 8, 0.15)), '#f8f8f0'); b.box(C(0, 0, 0, 0, 0.8, 0.8, 0.6), '#5a3a2a'); break;
    case 'balloon': b.sphere(C(0, 6, 0, 0, 8, 9, 8), 8, 6, '#e83a3a', 0); for (let k = 0; k < 8; k += 2) b.sphere(C(0, 6, 0, k * Math.PI / 4 + 0.39, 8.1, 9.1, 3.2), 8, 6, '#ffe03a', 0); b.box(C(0, 0, 0, 0, 1.8, 1.4, 1.8), '#8a5a2a'); break;
  }
  PREFAB[name] = b; return b;
}
function buildingPrefab(R, w, h, d, neon) {
  const b = new MB(), C = M4.compose;
  const base = ['#2a2440', '#241e38', '#30284a', '#1e1a30'][Math.floor(R() * 4)];
  b.box(C(0, h / 2, 0, 0, w, h, d), base);
  const glow = [[1, 0.85, 0.4, 1], [0.3, 0.9, 1, 1], [1, 0.3, 0.75, 1], [0.6, 0.5, 1, 1]][Math.floor(R() * 4)];
  for (let y = 3; y < h - 1; y += 3) {
    if (R() < 0.25) continue;
    const g = R() < 0.7 ? glow : [glow[0] * 0.5, glow[1] * 0.5, glow[2] * 0.5, 1];
    b.box(C(0, y, 0, 0, w + 0.06, 0.7, d + 0.06), g);
  }
  if (R() < 0.6) { b.box(C(0, h + 0.4, 0, 0, w * 0.6, 0.8, d * 0.6), '#3a3050'); b.cyl(C(w * 0.2, h + 3, 0, 0, 0.2, 5, 0.2), 4, '#5a5a6a'); b.box(C(w * 0.2, h + 5.6, 0, 0, 0.5, 0.5, 0.5), [1, 0.2, 0.2, 1]); }
  if (neon && R() < 0.5) b.box(C(0, h * 0.6, d / 2 + 0.35, 0, w * 0.7, 2.2, 0.3), [[1, 0.25, 0.7, 1], [0.25, 0.9, 1, 1], [1, 0.9, 0.3, 1]][Math.floor(R() * 3)]);
  return b;
}

// ------------------------------------------------------------ the track world
function buildWorld(def) {
  const th = THEMES[def.theme], cl = buildCenterline(def), P = cl.pts, N = cl.N, W = def.width, half = W / 2;
  const WALL = half + 4.5;                       // wall line (metres from centre)
  const R = seededRand(def.id.length * 1013 + N);
  // spatial grid of centre-line samples
  const CELL = 16, grid = new Map(), key = (cx, cz) => cx * 100003 + cz;
  P.forEach((p, i) => { const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  function nearestAny(x, z, maxR = 90) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), rr = Math.ceil(maxR / CELL);
    let best = -1, bd = maxR * maxR;
    for (let a = -rr; a <= rr; a++) for (let c = -rr; c <= rr; c++) { const l = grid.get(key(cx + a, cz + c)); if (!l) continue; for (const i of l) { const p = P[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  }
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  P.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
  const cx0 = (minX + maxX) / 2, cz0 = (minZ + maxZ) / 2;
  const noise = (x, z) => Math.sin(x * 0.013 + Math.sin(z * 0.011) * 1.7) * 0.6 + Math.sin(z * 0.017 + x * 0.004) * 0.4 + 0.5 * Math.sin(x * 0.031) * Math.sin(z * 0.027);
  // height from the distance to the track (D) and the track height nearby (ty)
  function heightFrom(x, z, D, ty) {
    let h = th.hills * noise(x, z);
    if (th.hills) h += Math.min(60, Math.max(0, D - 120) * 0.14);
    else h = -0.4;
    if (ty === null) return h;
    return ty + (h - ty) * smooth(WALL + 2, WALL + 40, D);
  }

  const st = new MB();   // static scenery
  // ---------- terrain
  const PAD = 260, STEP_T = 8;
  const x0 = Math.floor((minX - PAD) / STEP_T) * STEP_T, z0 = Math.floor((minZ - PAD) / STEP_T) * STEP_T;
  const nx = Math.ceil((maxX - minX + PAD * 2) / STEP_T), nz = Math.ceil((maxZ - minZ + PAD * 2) / STEP_T);
  const H = new Float32Array((nx + 1) * (nz + 1)), DD = new Float32Array((nx + 1) * (nz + 1)), TY = new Array((nx + 1) * (nz + 1)).fill(null);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const n = nearestAny(x0 + i * STEP_T, z0 + j * STEP_T, 90), k = j * (nx + 1) + i; DD[k] = n ? n.d : 1e9; TY[k] = n ? P[n.i].y - 0.45 : null; }
  // chamfer distance transform so far-away points know how far the track is
  const NX = nx + 1, d1 = STEP_T, d2 = STEP_T * 1.414;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const k = j * NX + i; let v = DD[k]; if (i) v = Math.min(v, DD[k - 1] + d1); if (j) { v = Math.min(v, DD[k - NX] + d1); if (i) v = Math.min(v, DD[k - NX - 1] + d2); if (i < nx) v = Math.min(v, DD[k - NX + 1] + d2); } DD[k] = v; }
  for (let j = nz; j >= 0; j--) for (let i = nx; i >= 0; i--) { const k = j * NX + i; let v = DD[k]; if (i < nx) v = Math.min(v, DD[k + 1] + d1); if (j < nz) { v = Math.min(v, DD[k + NX] + d1); if (i < nx) v = Math.min(v, DD[k + NX + 1] + d2); if (i) v = Math.min(v, DD[k + NX - 1] + d2); } DD[k] = v; }
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const k = j * NX + i; H[k] = heightFrom(x0 + i * STEP_T, z0 + j * STEP_T, DD[k], TY[k]); }
  // ground height anywhere (bilinear from the grid)
  function terrainH(x, z) {
    const fx = clampN((x - x0) / STEP_T, 0, nx - 0.001), fz = clampN((z - z0) / STEP_T, 0, nz - 0.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = H[j * NX + i], b = H[j * NX + i + 1], c = H[(j + 1) * NX + i], d = H[(j + 1) * NX + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  const G = th.grass.map(hexRGB), vergeC = hexRGB(th.verge);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * STEP_T, Z = z0 + j * STEP_T;
    const a = [X, H[j * (nx + 1) + i], Z], b = [X + STEP_T, H[j * (nx + 1) + i + 1], Z], c = [X + STEP_T, H[(j + 1) * (nx + 1) + i + 1], Z + STEP_T], d = [X, H[(j + 1) * (nx + 1) + i], Z + STEP_T];
    for (const tri of [[a, b, c], [a, c, d]]) {
      const hy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const slope = Math.max(...tri.map(p => p[1])) - Math.min(...tri.map(p => p[1]));
      let col = G[Math.floor(R() * 4)];
      if (def.theme === 'snow' && slope > 4.5) col = rgbMix(col, [0.55, 0.58, 0.66], 0.6);
      if (def.theme === 'desert' && slope > 4) col = rgbMix(col, [0.72, 0.38, 0.22], 0.5);
      if (def.theme === 'meadow' && hy > 30) col = rgbMix(col, [0.55, 0.6, 0.5], smooth(30, 60, hy));
      if (def.theme === 'meadow' && hy > 55) col = rgbMix(col, [0.95, 0.97, 1], smooth(55, 70, hy));
      const k = [col[0], col[1], col[2], 0];
      // keep winding facing up
      const t0 = tri[0], t1 = tri[1], t2 = tri[2];
      const ux = t1[0] - t0[0], uz = t1[2] - t0[2], vx = t2[0] - t0[0], vz = t2[2] - t0[2];
      if (uz * vx - ux * vz < 0) st.tri(t0, t2, t1, k, 0.06); else st.tri(t0, t1, t2, k, 0.06);
    }
  }
  // far ground ring (so the horizon is never empty)
  { const F = 3000, y = th.hills ? -1 : -0.5, gc = hexRGB(th.grass[2]); const k = [gc[0] * 0.9, gc[1] * 0.9, gc[2] * 0.9, 0];
    const ex0 = x0, ex1 = x0 + nx * STEP_T, ez0 = z0, ez1 = z0 + nz * STEP_T;
    upQuad(st, [cx0 - F, y, cz0 - F], [cx0 + F, y, cz0 - F], [cx0 + F, y, ez0], [cx0 - F, y, ez0], k);
    upQuad(st, [cx0 - F, y, ez1], [cx0 + F, y, ez1], [cx0 + F, y, cz0 + F], [cx0 - F, y, cz0 + F], k);
    upQuad(st, [cx0 - F, y, ez0], [ex0, y, ez0], [ex0, y, ez1], [cx0 - F, y, ez1], k);
    upQuad(st, [ex1, y, ez0], [cx0 + F, y, ez0], [cx0 + F, y, ez1], [ex1, y, ez1], k); }

  // ---------- road, lines, curbs, verge, walls
  const at = (i, lat, dy = 0) => { const p = P[((Math.round(i) % N) + N) % N]; return [p.x + p.rx * lat, p.y + dy, p.z + p.rz * lat]; };
  const roadC = th.road.map(c => col4(c)), lineC = col4(th.line, th.neon ? 0.8 : 0.15), curbC = th.curb.map(c => col4(c, th.neon ? 0.9 : 0)), wallC = th.wall.map(c => col4(c, th.neon ? 0.85 : 0));
  const vC = [vergeC[0], vergeC[1], vergeC[2], 0];
  const iceSet = new Set(); (def.ice || []).forEach(([a, b]) => { for (let i = Math.floor(a * N); i < b * N; i++) iceSet.add(i % N); });
  for (let i = 0; i < N; i++) {
    const j = i + 1;
    const rc = iceSet.has(i) ? [0.72, 0.86, 0.97, 0.15] : roadC[Math.floor(i / 3) % roadC.length];
    upQuad(st, at(i, -half, 0.05), at(i, half, 0.05), at(j, half, 0.05), at(j, -half, 0.05), rc, 0.03);
    // edge lines
    if (i % 2 === 0 || th.neon) for (const s of [-1, 1]) upQuad(st, at(i, s * (half - 0.9), 0.07), at(i, s * (half - 0.5), 0.07), at(j, s * (half - 0.5), 0.07), at(j, s * (half - 0.9), 0.07), lineC);
    // curbs
    for (const s of [-1, 1]) {
      const cc = curbC[Math.floor(i / 2) % 2];
      upQuad(st, at(i, s * half, 0.09), at(i, s * (half + 1.3), 0.16), at(j, s * (half + 1.3), 0.16), at(j, s * half, 0.09), cc);
      upQuad(st, at(i, s * (half + 1.3), 0.0), at(i, s * WALL, -0.05), at(j, s * WALL, -0.05), at(j, s * (half + 1.3), 0.0), vC, 0.05);
    }
    // walls
    for (const s of [-1, 1]) {
      const a = at(i, s * (WALL + 0.3)), b = at(j, s * (WALL + 0.3));
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2, len = Math.hypot(b[0] - a[0], b[2] - a[2]) + 0.15;
      const ry = Math.atan2(b[0] - a[0], b[2] - a[2]);
      if (th.neon) {
        st.box(M4.compose(mx, my + 0.5, mz, ry, 0.6, 1.0, len), '#1a1428');
        st.box(M4.compose(mx, my + 1.05, mz, ry, 0.7, 0.18, len), wallC[(Math.floor(i / 6) + (s > 0 ? 1 : 0)) % 2]);
      } else st.box(M4.compose(mx, my + th.wallH / 2, mz, ry, 0.6, th.wallH, len), wallC[Math.floor(i / 3) % 2], 0, shadeArr(wallC[Math.floor(i / 3) % 2], 1.1));
    }
  }
  // start line checker + gantry
  for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) {
    const lat0 = -half + c * W / 10, lat1 = lat0 + W / 10, col = (r + c) % 2 ? [0.08, 0.08, 0.1, 0] : [0.97, 0.97, 0.97, 0];
    const p0 = P[0], f0 = r * 1.2 - 1.2, f1 = f0 + 1.2;
    const pt = (lat, f) => [p0.x + p0.rx * lat + p0.tx * f, p0.y + 0.08, p0.z + p0.rz * lat + p0.tz * f];
    upQuad(st, pt(lat0, f0), pt(lat1, f0), pt(lat1, f1), pt(lat0, f1), col);
  }
  { const p0 = P[0], ry = Math.atan2(p0.tx, p0.tz);
    for (const s of [-1, 1]) st.box(M4.compose(p0.x + p0.rx * s * (WALL + 1.2), p0.y + 4.5, p0.z + p0.rz * s * (WALL + 1.2), ry, 1.2, 9, 1.2), '#d8d8e0');
    st.box(M4.compose(p0.x, p0.y + 9.4, p0.z, ry, (WALL + 1.8) * 2, 1.8, 1.2), '#e83a3a');
    for (let k = 0; k < 8; k++) st.box(M4.mul(M4.compose(p0.x + p0.rx * (-WALL + 2 + k * (WALL * 2 - 4) / 7), p0.y + 9.4, p0.z + p0.rz * (-WALL + 2 + k * (WALL * 2 - 4) / 7), ry), M4.scale(0.9, 0.9, 1.4)), k % 2 ? [1, 1, 0.5, 1] : [1, 0.4, 0.2, 1]);
  }
  // ramps
  const rampIdx = (def.ramps || []).map(f => Math.floor(f * N));
  rampIdx.forEach(i0 => { for (let k = 0; k < 5; k++) { const i = i0 + k; upQuad(st, at(i, -half, 0.12 + k * 0.28), at(i, half, 0.12 + k * 0.28), at(i + 1, half, 0.12 + (k + 1) * 0.28), at(i + 1, -half, 0.12 + (k + 1) * 0.28), k % 2 ? [1, 0.8, 0.1, 0.2] : [0.15, 0.15, 0.18, 0]); } });
  // boost pads (own mesh so they can pulse)
  const bm = new MB();
  const boostPads = (def.boosts || []).map(([f, lane]) => {
    const i0 = Math.floor(f * N), pad = { i: i0, lane, len: 3 };
    for (let k = 0; k < 3; k++) {
      const i = i0 + k, a = at(i, lane - 1.8, 0.1), b = at(i, lane + 1.8, 0.1), c = at(i + 1, lane + 1.8, 0.1), d = at(i + 1, lane - 1.8, 0.1);
      upQuad(bm, a, b, c, d, [0.95, 0.45, 0.05, 0.7]);
      // chevron
      const ma = at(i, lane, 0.13), mb2 = at(i + 1, lane, 0.13), m = [(ma[0] + mb2[0]) / 2, ma[1], (ma[2] + mb2[2]) / 2], tip = [m[0] + P[i % N].tx * 0.9, m[1], m[2] + P[i % N].tz * 0.9];
      const l = at(i, lane - 1.2, 0.13), r = at(i, lane + 1.2, 0.13);
      bm.tri(l, tip, m, [1, 0.95, 0.3, 1]); bm.tri(m, tip, r, [1, 0.95, 0.3, 1]);
    }
    return pad;
  });

  // ---------- scenery placement
  const decor = [];   // {x,z,r} footprint list to avoid overlaps
  const place = (name, x, z, rot, s, r) => {
    const n = nearestAny(x, z, 60); if (n && n.d < WALL + 3 + r) return false;
    if (decor.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2)) return false;
    const y = terrainH(x, z) - 0.2;
    st.add(prefab(name), M4.compose(x, y, z, rot, s, s, s));
    decor.push({ x, z, r }); return true;
  };
  const scatter = (name, count, rMin, rMax, sMin, sMax, rad, near) => {
    let n = 0, tries = 0;
    while (n < count && tries < count * 12) {
      tries++;
      let x, z;
      if (near) { const i = Math.floor(R() * N), side = R() < 0.5 ? -1 : 1, off = WALL + 4 + R() * near; x = P[i].x + P[i].rx * side * off; z = P[i].z + P[i].rz * side * off; }
      else { x = minX - rMax + R() * (maxX - minX + rMax * 2); z = minZ - rMax + R() * (maxZ - minZ + rMax * 2); }
      const s = sMin + R() * (sMax - sMin);
      if (place(name, x, z, R() * 6.28, s, rad * s)) n++;
    }
  };
  const dyn = [];   // animated scenery: { mesh, M, spin }
  if (def.theme === 'meadow') {
    // grandstand by the start line
    const p0 = P[6]; st.add(prefab('grandstand'), M4.compose(p0.x - p0.rx * (WALL + 9), p0.y - 0.3, p0.z - p0.rz * (WALL + 9), Math.atan2(p0.rx, p0.rz)));
    decor.push({ x: p0.x - p0.rx * (WALL + 9), z: p0.z - p0.rz * (WALL + 9), r: 18 });
    scatter('tree', 140, 0, 150, 0.8, 1.4, 2.4, 40); scatter('tree2', 60, 0, 150, 0.8, 1.3, 2, 60); scatter('tree', 120, 0, 240, 1, 1.8, 2.4);
    scatter('bush', 80, 0, 0, 0.7, 1.3, 1.2, 25); scatter('rock', 30, 0, 0, 0.6, 1.6, 1.4, 50); scatter('flowers', 120, 0, 0, 1, 1.6, 1, 30);
    // windmills
    for (let k = 0; k < 3; k++) { const i = Math.floor((0.25 + k * 0.3) * N), p = P[i], x = p.x + p.rx * (WALL + 30), z = p.z + p.rz * (WALL + 30); if (place('windmill', x, z, Math.atan2(-p.rx, -p.rz), 1.2, 6)) dyn.push({ mesh: 'blades', x: x - p.rx * 3.4 * 1.2, y: terrainH(x, z) + 12.4 * 1.2, z: z - p.rz * 3.4 * 1.2, ry: Math.atan2(-p.rx, -p.rz), spin: 0.8, s: 1.2 }); }
    for (let k = 0; k < 4; k++) dyn.push({ mesh: 'balloon', x: cx0 + Math.cos(k * 1.7) * 160, y: 55 + k * 12, z: cz0 + Math.sin(k * 1.7) * 140, ry: 0, float: k, s: 1 + k * 0.1, tint: [[1, 1, 1], [0.6, 0.8, 1.4], [0.8, 1.3, 0.7], [1.3, 0.8, 1.2]][k] });
  } else if (def.theme === 'desert') {
    scatter('cactus', 120, 0, 0, 0.8, 1.5, 1.4, 50); scatter('desertrock', 70, 0, 0, 0.6, 2, 2, 60); scatter('skull', 14, 0, 0, 1, 1.4, 1, 20);
    scatter('mesa', 26, 0, 260, 0.8, 1.6, 14);
    // rock arches over the road
    [0.24, 0.6].forEach(f => { const i = Math.floor(f * N), p = P[i], ry = Math.atan2(p.tx, p.tz);
      for (const s of [-1, 1]) st.box(M4.compose(p.x + p.rx * s * (WALL + 3), p.y + 6, p.z + p.rz * s * (WALL + 3), ry, 5, 13, 5), '#c8703a', 0.1, '#d8844a');
      st.box(M4.mul(M4.compose(p.x, p.y + 13.5, p.z, ry), M4.scale((WALL + 5.5) * 2, 4, 5)), '#b8603a', 0.1, '#e8945a'); });
  } else if (def.theme === 'snow') {
    scatter('pine', 200, 0, 0, 0.8, 1.6, 2.2, 45); scatter('pine', 140, 0, 220, 1, 2, 2.2); scatter('snowman', 12, 0, 0, 1, 1.2, 1.2, 14); scatter('rock', 40, 0, 0, 0.8, 1.8, 1.6, 40);
    scatter('cabin', 7, 0, 0, 1, 1.2, 5, 30);
  } else if (def.theme === 'city') {
    // dense buildings along both sides
    for (let i = 0; i < N; i += 7) for (const s of [-1, 1]) {
      const p = P[i], off = WALL + 9 + R() * 14, x = p.x + p.rx * s * off, z = p.z + p.rz * s * off;
      const w = 10 + R() * 10, d = 10 + R() * 10, h = 14 + R() * 50;
      const n = nearestAny(x, z, 60); if (n && n.d < WALL + 3 + Math.max(w, d) * 0.72) continue;
      if (decor.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + Math.max(w, d) * 0.6) ** 2)) continue;
      st.add(buildingPrefab(R, w, h, d, true), M4.compose(x, -0.4, z, Math.atan2(p.tx, p.tz)));
      decor.push({ x, z, r: Math.max(w, d) * 0.6 });
    }
    for (let k = 0; k < 160; k++) { const x = minX - 200 + R() * (maxX - minX + 400), z = minZ - 200 + R() * (maxZ - minZ + 400), w = 12 + R() * 16, d = 12 + R() * 16, h = 20 + R() * 90;
      const n = nearestAny(x, z, 60); if (n && n.d < WALL + 6 + Math.max(w, d) * 0.72) continue;
      if (decor.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + Math.max(w, d) * 0.6) ** 2)) continue;
      st.add(buildingPrefab(R, w, h, d, true), M4.compose(x, -0.4, z, R() * 3)); decor.push({ x, z, r: Math.max(w, d) * 0.6 }); }
    for (let i = 0; i < N; i += 12) for (const s of [-1, 1]) { const p = P[i]; st.add(prefab('lamp'), M4.compose(p.x + p.rx * s * (WALL + 1.6), p.y - 0.3, p.z + p.rz * s * (WALL + 1.6), Math.atan2(-p.rx * s, -p.rz * s))); }
    for (let k = 0; k < 10; k++) { const i = Math.floor(R() * N), s = R() < 0.5 ? -1 : 1, p = P[i]; const x = p.x + p.rx * s * (WALL + 6), z = p.z + p.rz * s * (WALL + 6);
      if (decor.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + 6) ** 2)) continue;
      const ry = Math.atan2(-p.rx * s, -p.rz * s); st.add(prefab('billboard'), M4.compose(x, p.y - 0.3, z, ry));
      st.box(M4.mul(M4.compose(x, p.y + 7.2, z, ry), M4.compose(0, 0, 0.25, 0, 8.4, 3.4, 0.1)), [[1, 0.25, 0.7, 1], [0.25, 0.9, 1, 1], [1, 0.9, 0.3, 1], [0.6, 1, 0.3, 1]][k % 4]); decor.push({ x, z, r: 5 }); }
  }
  // distant mountains / skyline ring
  for (let k = 0; k < 46; k++) {
    const a = k / 46 * Math.PI * 2 + R() * 0.1, rad = Math.max(maxX - minX, maxZ - minZ) / 2 + 420 + R() * 300;
    const x = cx0 + Math.cos(a) * rad, z = cz0 + Math.sin(a) * rad;
    if (th.neon) { const w = 30 + R() * 40, h = 80 + R() * 160; st.add(buildingPrefab(R, w, h, w, false), M4.compose(x, -1, z, R() * 3)); continue; }
    const s = 180 + R() * 220, h = 110 + R() * 190;
    st.cone(M4.compose(x, -2, z, R() * 6, s, h, s * (0.8 + R() * 0.4)), 7, th.mountains[k % 2], 0.08);
    if (def.theme !== 'desert') st.cone(M4.compose(x, -2 + h * 0.62, z, 0, s * 0.38, h * 0.38, s * 0.38), 7, th.mountains[2], 0.04);
  }

  // ---------- sky dome
  const sky = new MB(), top = hexRGB(th.skyTop), hor = hexRGB(th.skyHorizon), SR = 1500;
  const segU = 28, segV = 14;
  for (let v = 0; v < segV; v++) for (let u = 0; u < segU; u++) {
    const el0 = v / segV * Math.PI / 2, el1 = (v + 1) / segV * Math.PI / 2, a0 = u / segU * Math.PI * 2, a1 = (u + 1) / segU * Math.PI * 2;
    const p = (el, a) => [Math.cos(a) * Math.cos(el) * SR, Math.sin(el) * SR, Math.sin(a) * Math.cos(el) * SR];
    const c = rgbMix(hor, top, Math.pow((v + 0.5) / segV, 0.7));
    sky.quad(p(el0, a0), p(el0, a1), p(el1, a1), p(el1, a0), [c[0], c[1], c[2], 1]);
  }
  { const fg = hexRGB(th.fog); for (let u = 0; u < segU; u++) { const a0 = u / segU * Math.PI * 2, a1 = (u + 1) / segU * Math.PI * 2; sky.quad([Math.cos(a0) * SR, 0, Math.sin(a0) * SR], [Math.cos(a1) * SR, 0, Math.sin(a1) * SR], [Math.cos(a1) * SR, -SR, Math.sin(a1) * SR], [Math.cos(a0) * SR, -SR, Math.sin(a0) * SR], [fg[0], fg[1], fg[2], 1]); } }
  // sun / moon
  { const s = th.sun, l = Math.hypot(...s), d = [s[0] / l, s[1] / l * 0.5 + 0.2, s[2] / l]; const dl = Math.hypot(...d); const c = [d[0] / dl * SR * 0.9, d[1] / dl * SR * 0.9, d[2] / dl * SR * 0.9];
    const ry = Math.atan2(-c[0], -c[2]), rx = Math.atan2(c[1], Math.hypot(c[0], c[2]));
    const sm = M4.mul(M4.compose(c[0], c[1], c[2], ry), M4.rotX(rx));
    const sunCol = th.neon ? [0.95, 0.92, 1, 1] : def.theme === 'desert' ? [1, 0.95, 0.75, 1] : [1, 0.98, 0.85, 1];
    for (let k = 0; k < 16; k++) { const a0 = k / 16 * 6.283, a1 = (k + 1) / 16 * 6.283, r = th.neon ? 50 : 70; sky.tri(M4.pt(sm, 0, 0, 0), M4.pt(sm, Math.cos(a0) * r, Math.sin(a0) * r, 0), M4.pt(sm, Math.cos(a1) * r, Math.sin(a1) * r, 0), sunCol); }
  }
  if (th.neon) { for (let k = 0; k < 400; k++) { const a = R() * 6.283, el = 0.15 + R() * 1.3, r = SR * 0.95, x = Math.cos(a) * Math.cos(el) * r, y = Math.sin(el) * r, z = Math.sin(a) * Math.cos(el) * r, s = 2 + R() * 3; sky.tri([x - s, y, z], [x + s, y, z], [x, y + s * 1.6, z], [1, 1, 1, 1]); } }
  else for (let k = 0; k < 26; k++) {
    const a = R() * 6.283, r = 600 + R() * 600, y = 170 + R() * 200, x = Math.cos(a) * r, z = Math.sin(a) * r;
    for (let j = 0; j < 4; j++) sky.sphere(M4.compose(x + (j - 1.5) * 40 + R() * 20, y + R() * 14, z + R() * 30, a, 90 + R() * 50, 28 + R() * 16, 60 + R() * 30), 7, 4, [1, 1, 1, 1], 0.04);
  }

  // ---------- item boxes and coins (dynamic)
  const boxes = [], coins = [];
  (def.items || []).forEach(f => { const i = Math.floor(f * N); for (let k = 0; k < 5; k++) { const lat = (k - 2) * (W * 0.19); const p = at(i, lat); boxes.push({ x: p[0], y: p[1] + 1.4, z: p[2], i, gone: 0, ph: k }); } });
  (def.coins || []).forEach((f, ci) => { const i0 = Math.floor(f * N), lat = ((ci * 37) % 5 - 2) * W * 0.15; for (let k = 0; k < 5; k++) { const p = at(i0 + k * 3, lat); coins.push({ x: p[0], y: p[1] + 1.0, z: p[2], i: (i0 + k * 3) % N, gone: 0 }); } });

  return { def, th, cl, P, N, W, half, WALL, nearestAny, terrainH, st, bm, sky, boostPads, rampIdx, iceSet, boxes, coins, dyn, cx: cx0, cz: cz0, minX, maxX, minZ, maxZ };
}
function shadeArr(c, f) { return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f), c[3]]; }

// ------------------------------------------------------------ karts
function buildKart(r) {
  const b = new MB(), C = M4.compose;
  const body = r.body, trim = r.trim, dark = '#1e1e26';
  // floor pan + body
  b.box(C(0, 0.32, 0, 0, 1.5, 0.22, 2.5), dark);
  b.taper(C(0, 0.4, 0.15, 0, 1.25, 0.42, 2.0), 0.8, 0.85, body, 0, 0);
  b.taper(C(0, 0.38, 1.25, 0, 1.0, 0.32, 0.7), 0.7, 0.5, body, 0, -0.12);   // nose
  b.box(C(0, 0.42, 1.62, 0, 1.6, 0.18, 0.22), trim);                         // front bumper
  for (const s of [-1, 1]) { b.box(C(s * 0.72, 0.5, 0.0, 0, 0.32, 0.36, 1.25), body); b.box(C(s * 0.72, 0.72, 0.0, 0, 0.34, 0.06, 1.2), trim); }  // side pods
  // seat + engine + exhaust
  b.box(C(0, 0.8, -0.45, 0, 0.8, 0.7, 0.18), '#2a2a34'); b.box(C(0, 0.62, -0.25, 0, 0.8, 0.14, 0.5), '#2a2a34');
  b.box(C(0, 0.68, -1.0, 0, 0.9, 0.55, 0.6), '#4a4a56'); b.box(C(0, 0.98, -1.0, 0, 0.6, 0.1, 0.4), trim);
  for (const s of [-1, 1]) b.cyl(C(s * 0.28, 0.62, -1.38, 0, 0.18, 0.4, 0.18, Math.PI / 2), 6, '#9a9aa8', '#1a1a1a');
  // spoiler
  for (const s of [-1, 1]) b.box(C(s * 0.45, 1.05, -1.15, 0, 0.08, 0.5, 0.15), dark);
  b.box(C(0, 1.32, -1.2, 0, 1.6, 0.08, 0.42), trim); for (const s of [-1, 1]) b.box(C(s * 0.82, 1.28, -1.2, 0, 0.06, 0.25, 0.5), body);
  // steering column + wheel
  b.box(C(0, 0.85, 0.55, 0, 0.08, 0.08, 0.5, -0.6), dark); b.cyl(C(0, 1.02, 0.36, 0, 0.5, 0.06, 0.5, -1.0), 8, dark);
  // driver
  b.box(C(0, 1.08, -0.2, 0, 0.62, 0.62, 0.42), r.suit);
  for (const s of [-1, 1]) { b.box(C(s * 0.36, 1.1, 0.1, 0, 0.18, 0.18, 0.55, 0.5), r.suit); b.box(C(s * 0.3, 0.92, 0.42, 0, 0.18, 0.18, 0.12), '#f0c8a0'); }
  b.sphere(C(0, 1.62, -0.15, 0, 0.66, 0.64, 0.7), 8, 6, r.helmet, 0.03);
  b.box(C(0, 1.62, 0.13, 0, 0.5, 0.2, 0.2), [0.08, 0.1, 0.16, 0.15]);
  b.box(C(0, 1.93, -0.15, 0, 0.12, 0.08, 0.6), body);
  return b;
}
function buildWheel() { const b = new MB(); b.cyl(M4.ident(), 10, '#1a1a1e', '#2a2a30'); b.cyl(M4.compose(0, 0, 0, 0, 0.55, 1.04, 0.55), 6, '#c8c8d4', '#9a9aa8'); return b; }
function buildItemBox() {
  const b = new MB(), C = M4.compose;
  const cols = [[1, 0.3, 0.3, 0.75], [0.3, 0.8, 1, 0.75], [1, 0.85, 0.2, 0.75], [0.4, 1, 0.4, 0.75], [0.9, 0.4, 1, 0.75], [1, 0.6, 0.2, 0.75]];
  const p = [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5], [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]].map(v => M4.pt(C(0, 0, 0, 0, 1.7, 1.7, 1.7), ...v));
  b.quad(p[3], p[7], p[6], p[2], cols[0]); b.quad(p[0], p[1], p[5], p[4], cols[1]); b.quad(p[4], p[5], p[6], p[7], cols[2]); b.quad(p[1], p[0], p[3], p[2], cols[3]); b.quad(p[5], p[1], p[2], p[6], cols[4]); b.quad(p[0], p[4], p[7], p[3], cols[5]);
  // "?" on every side
  const q = new MB(); [[0, 0.4, 0.45, 0.12], [0.18, 0.25, 0.12, 0.3], [0.06, 0.02, 0.24, 0.12], [0, -0.12, 0.12, 0.18], [0, -0.4, 0.12, 0.12], [-0.13, 0.32, 0.12, 0.12]].forEach(([x, y, w, h]) => q.box(C(x, y, 0.88, 0, w, h, 0.05), [1, 1, 1, 1]));
  for (let k = 0; k < 4; k++) b.add(q, M4.rotY(k * Math.PI / 2));
  return b;
}
function buildCoin() { const b = new MB(); b.cyl(M4.compose(0, 0, 0, 0, 1.3, 0.16, 1.3, Math.PI / 2), 12, [1, 0.8, 0.15, 0.35], [1, 0.9, 0.4, 0.45]); b.box(M4.compose(0, 0, 0, 0, 0.2, 0.7, 0.22), [1, 0.95, 0.6, 0.6]); return b; }
function buildOil() { const b = new MB(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, r = 1.3 + (k % 3) * 0.3; b.cyl(M4.compose(Math.cos(a) * 0.5, 0.03, Math.sin(a) * 0.5, 0, r, 0.05, r), 8, [0.12, 0.08, 0.2, 0.1]); } b.cyl(M4.compose(0.3, 0.06, -0.2, 0, 0.6, 0.02, 0.4), 6, [0.5, 0.4, 0.9, 0.5]); return b; }
function buildOrb(col) { const b = new MB(); b.sphere(M4.compose(0, 0, 0, 0, 1.3, 1.3, 1.3), 8, 6, col, 0.05); b.sphere(M4.compose(0.2, 0.25, 0.2, 0, 0.5, 0.5, 0.5), 6, 4, [1, 1, 1, 0.8], 0); return b; }
function buildRocket() { const b = new MB(), C = M4.compose; b.cyl(C(0, 0, 0, 0, 0.5, 1.6, 0.5, Math.PI / 2), 8, '#e83a3a', '#2a2a2a'); b.cone(C(0, 0, 0.8, 0, 0.5, 0.7, 0.5, Math.PI / 2), 8, '#f8f8f8', 0); for (let k = 0; k < 4; k++) b.box(M4.mul(M4.rotZ(k * Math.PI / 2), C(0, 0.4, -0.6, 0, 0.06, 0.5, 0.5)), '#ffcc33'); return b; }
function buildBomb() { const b = new MB(), C = M4.compose; b.sphere(C(0, 0, 0, 0, 1.8, 1.8, 1.8), 9, 7, '#22222c', 0.04); b.cyl(C(0, 0.95, 0, 0, 0.5, 0.3, 0.5), 8, '#6a6a7a'); b.cyl(C(0.1, 1.3, 0, 0, 0.1, 0.5, 0.1, 0, 0.3), 4, '#c8a060'); b.box(C(-0.5, 0.3, 0.7, 0, 0.3, 0.3, 0.1), [1, 1, 1, 0.6]); return b; }
