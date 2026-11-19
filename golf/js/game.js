// =====================================================================
//  PUTT PARK - nine holes of mini golf. Solo, vs the computer, or pass
//  the mouse / phone around for a party of up to 4.
//  Drag back from anywhere and let go to putt (or aim with A/D or the
//  arrows and hold SPACE).
// =====================================================================
'use strict';
(() => {
const cv = document.getElementById('game');
const U = GameUI(cv), ctx = U.ctx, W = 1280, H = 720;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_golf';
let save = { best: 0, bestPar: null, rounds: 0, aces: 0, wins: 0, holeBest: {}, guide: true };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(save, s); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const myName = () => (window.Account && Account.user && Account.user.username) || 'You';

// ------------------------------------------------------------ sound
SONGS.golf = { seed: 4242, bpm: 92, root: 60, scale: 'major', prog: [0, 5, 3, 4, 0, 5, 1, 4], density: 0.5, swing: 0.16,
  bass: 'x.....x...x.....', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', pad: true, arp: true, arpRate: 2, arpOct: 1, introNoLead: true,
  inst: { lead: { type: 'triangle', vol: 0.11, echo: 0.25 }, arp: { type: 'sine', vol: 0.035 }, drumVol: 0.55 } };
let quiet = false;
const SFX = {
  putt(p) { Sound.blip(170 + p * 60, 0.05, { type: 'triangle', vol: 0.18 + p * 0.25 }); Sound.hiss(0.03, { filter: 'bandpass', freq: 2600, q: 1.2, vol: 0.08 + p * 0.1 }); },
  wall(v) { const k = clamp(v / 700, 0.08, 1); Sound.blip(420 + Math.random() * 80, 0.035, { type: 'square', vol: 0.05 * k + 0.02 }); Sound.hiss(0.02, { filter: 'bandpass', freq: 1800, q: 2, vol: 0.06 * k }); },
  bumper() { Sound.blip(880, 0.09, { type: 'sine', vol: 0.16, slide: 1320 }); Sound.blip(1320, 0.07, { type: 'triangle', vol: 0.06, delay: 0.03 }); },
  sink() { [0, 0.06, 0.13, 0.22].forEach((d, i) => Sound.blip(300 - i * 40, 0.05, { type: 'triangle', vol: 0.16, delay: d })); setTimeout(() => [523, 659, 784].forEach((f, i) => Sound.blip(f, 0.16, { type: 'sine', vol: 0.12, delay: i * 0.07 })), 260); },
  ace() { [523, 659, 784, 1047, 1319].forEach((f, i) => Sound.blip(f, 0.22, { type: 'triangle', vol: 0.14, delay: i * 0.08 })); },
  splash() { Sound.hiss(0.5, { filter: 'lowpass', freq: 1400, sweep: 300, vol: 0.3 }); Sound.blip(160, 0.2, { type: 'sine', vol: 0.15, slide: 60 }); },
  sand() { Sound.hiss(0.18, { filter: 'bandpass', freq: 3000, q: 0.6, vol: 0.08 }); },
  portal() { Sound.blip(300, 0.3, { type: 'sine', vol: 0.12, slide: 1400 }); },
  lip() { Sound.blip(520, 0.05, { type: 'triangle', vol: 0.1 }); },
};
const sfx = new Proxy(SFX, { get: (o, k) => quiet ? () => {} : o[k] });

// ------------------------------------------------------------ geometry
const BR = 8, CUP_R = 12;
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const edges = P => P.map((p, i) => [p[0], p[1], P[(i + 1) % P.length][0], P[(i + 1) % P.length][1]]);
function closest(px, py, s) { const dx = s[2] - s[0], dy = s[3] - s[1], L = dx * dx + dy * dy || 1; const k = clamp(((px - s[0]) * dx + (py - s[1]) * dy) / L, 0, 1); return [s[0] + dx * k, s[1] + dy * k]; }
const polyCenter = P => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]);

// ------------------------------------------------------------ hole state
let hole = null, HI = 0, holeT = 0;   // hole: the built hole (static walls etc.)
function buildHole(i) {
  const d = HOLES[i];
  const h = { d, i, walls: [], field: null, theme: THEMES[d.theme] };
  h.walls.push(...edges(d.course));
  (d.blocks || []).forEach(b => h.walls.push(...edges(b)));
  h.decor = makeDecor(d, h.theme);
  h.field = distField(h);
  return h;
}
// moving things at time T
function spinnerSegs(s, T) { const a0 = T * s.speed, out = []; for (let k = 0; k < s.arms; k++) { const a = a0 + k * Math.PI * 2 / s.arms; out.push([s.x, s.y, s.x + Math.cos(a) * s.len, s.y + Math.sin(a) * s.len]); } return out; }
function moverPos(m, T) { const f = (1 - Math.cos(((T / m.period) + (m.ph || 0)) * Math.PI * 2)) / 2; return [m.x + m.dx * f, m.y + m.dy * f]; }
function moverVel(m, T) { const w = Math.PI * 2 / m.period, s = Math.sin(((T / m.period) + (m.ph || 0)) * Math.PI * 2) * w / 2; return [m.dx * s, m.dy * s]; }

// distance-to-cup map, used by the computer golfers to judge where a shot ends up
function distField(h) {
  const C = 10, gw = Math.ceil(W / C), gh = Math.ceil(H / C), d = h.d;
  const ok = new Uint8Array(gw * gh), dist = new Float32Array(gw * gh).fill(1e9);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = i * C + C / 2, y = j * C + C / 2;
    if (!inPoly(x, y, d.course)) continue;
    if ((d.blocks || []).some(b => inPoly(x, y, b))) continue;
    if ((d.water || []).some(w => inPoly(x, y, w))) continue;
    if (h.walls.some(s => { const c = closest(x, y, s); return Math.hypot(c[0] - x, c[1] - y) < BR; })) continue;
    ok[j * gw + i] = 1;
  }
  const ci = Math.floor(d.cup[0] / C), cj = Math.floor(d.cup[1] / C);
  const q = [[ci, cj]]; dist[cj * gw + ci] = 0;
  const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  // simple label-correcting search (the grid is small)
  for (let qi = 0; qi < q.length; qi++) {
    const [i, j] = q[qi], dd = dist[j * gw + i];
    for (const [a, b, c] of N) {
      const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
      const k = nj * gw + ni; if (!ok[k]) continue;
      const nd = dd + c * C; if (nd < dist[k] - 0.01) { dist[k] = nd; q.push([ni, nj]); }
    }
  }
  return { at(x, y) { const i = clamp(Math.floor(x / C), 0, gw - 1), j = clamp(Math.floor(y / C), 0, gh - 1); return dist[j * gw + i]; } };
}

// ------------------------------------------------------------ ball physics (shared by play, aim guide and the CPU)
function newBall(x, y) { return { x, y, vx: 0, vy: 0, moving: false, sunk: false, sinkT: 0, rest: [x, y], portalCD: 0, trail: [], inSand: false }; }
const MAX_SPEED = 1150;
function surface(h, x, y) {
  const d = h.d;
  for (const w of d.water || []) if (inPoly(x, y, w)) return 'water';
  for (const s of d.sand || []) if (inPoly(x, y, s)) return 'sand';
  return 'grass';
}
// one physics step. ev(type, value) gets events (sounds/particles); returns false when the ball has stopped
function stepBall(h, b, dt, T, ev) {
  const d = h.d;
  if (b.sunk) return false;
  const sp0 = Math.hypot(b.vx, b.vy);
  // slopes
  for (const s of d.slopes || []) if (inPoly(b.x, b.y, s.poly)) {
    let ax = s.ax, ay = s.ay;
    if (s.bump) { const c = polyCenter(s.poly); ax += (b.x - c[0]) * 3.0; }
    if (s.bowl) { const [bx, by, br] = s.bowl, dx = bx - b.x, dy = by - b.y, dd = Math.hypot(dx, dy); if (dd < br && dd > CUP_R) { ax += dx / dd * 120; ay += dy / dd * 120; } }
    b.vx += ax * dt; b.vy += ay * dt;
  }
  // cup: a gentle pull into the hole once you are over it
  const cdx = d.cup[0] - b.x, cdy = d.cup[1] - b.y, cd = Math.hypot(cdx, cdy);
  if (cd < CUP_R) {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < 430) { b.sunk = true; b.vx = b.vy = 0; b.x = lerp(b.x, d.cup[0], 0.5); b.y = lerp(b.y, d.cup[1], 0.5); ev && ev('sink'); return false; }
    // too fast: it hops the cup and loses some pace, bent towards the centre
    if (!b.lipT) { b.lipT = 0.15; b.vx = b.vx * 0.82 + cdx * 6; b.vy = b.vy * 0.82 + cdy * 6; ev && ev('lip'); }
  }
  if (b.lipT) b.lipT = Math.max(0, b.lipT - dt);
  // friction
  const surf = surface(h, b.x, b.y);
  if (surf === 'water') { ev && ev('water'); return false; }
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    const dec = surf === 'sand' ? 520 + sp * 3.2 : 55 + sp * 0.55;
    const ns = Math.max(0, sp - dec * dt); b.vx *= ns / sp; b.vy *= ns / sp;
    if (surf === 'sand' && !b.inSand && sp > 80) ev && ev('sand');
  }
  b.inSand = surf === 'sand';
  // move
  b.x += b.vx * dt; b.y += b.vy * dt;
  // walls (static, spinner arms, movers)
  const hit = (s, svx, svy, e) => {
    const c = closest(b.x, b.y, s), dx = b.x - c[0], dy = b.y - c[1], dd = Math.hypot(dx, dy);
    if (dd >= BR || dd < 1e-6) return;
    const nx = dx / dd, ny = dy / dd; b.x = c[0] + nx * BR; b.y = c[1] + ny * BR;
    const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; if (-vn > 60) ev && ev('wall', -vn); }
  };
  for (const s of h.walls) hit(s, 0, 0, 0.72);
  for (const s of d.spinners || []) for (const g of spinnerSegs(s, T)) { const c = closest(b.x, b.y, g), rx = c[0] - s.x, ry = c[1] - s.y; hit(g, -ry * s.speed, rx * s.speed, 0.6); }
  for (const m of d.movers || []) { const [mx, my] = moverPos(m, T), [vx, vy] = moverVel(m, T); for (const s of edges(rectP(mx, my, mx + m.w, my + m.h))) hit(s, vx, vy, 0.6); }
  for (const p of d.bumpers || []) {
    const dx = b.x - p.x, dy = b.y - p.y, dd = Math.hypot(dx, dy), R = p.r + BR;
    if (dd < R && dd > 1e-6) { const nx = dx / dd, ny = dy / dd; b.x = p.x + nx * R; b.y = p.y + ny * R; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 2.15 * vn * nx; b.vy -= 2.15 * vn * ny; const s2 = Math.hypot(b.vx, b.vy); if (s2 < 260) { b.vx *= 260 / s2; b.vy *= 260 / s2; } ev && ev('bumper', p); } }
  }
  // portals
  if (b.portalCD > 0) b.portalCD -= dt;
  const PP = d.portals; if (PP && b.portalCD <= 0 && Math.hypot(b.x - PP[0].x, b.y - PP[0].y) < 15) { b.x = PP[1].x; b.y = PP[1].y; b.portalCD = 0.6; ev && ev('portal'); }
  // speed cap and stop
  const s2 = Math.hypot(b.vx, b.vy); if (s2 > MAX_SPEED) { b.vx *= MAX_SPEED / s2; b.vy *= MAX_SPEED / s2; }
  if (s2 < 5) {
    // only rest if nothing is pushing the ball
    const pushed = (d.slopes || []).some(s => inPoly(b.x, b.y, s.poly) && (s.ax || s.ay || s.bump && Math.abs(b.x - polyCenter(s.poly)[0]) > 6));
    if (!pushed) { b.vx = b.vy = 0; return false; }
  }
  return true;
}
// simulate a whole shot (no side effects). Returns where it ended up.
function simShot(h, x, y, ang, pow, T0, maxT = 9) {
  const b = newBall(x, y), dt = 1 / 240; b.vx = Math.cos(ang) * pow * MAX_SPEED; b.vy = Math.sin(ang) * pow * MAX_SPEED;
  let water = false, T = T0, n = 0;
  const ev = e => { if (e === 'water') water = true; };
  while (n++ < maxT * 240) { if (!stepBall(h, b, dt, T, ev)) break; T += dt; }
  return { x: b.x, y: b.y, sunk: b.sunk, water, t: T - T0 };
}
function guidePath(h, x, y, ang, pow, T0) {
  const b = newBall(x, y), dt = 1 / 240, pts = [[x, y]]; b.vx = Math.cos(ang) * pow * MAX_SPEED; b.vy = Math.sin(ang) * pow * MAX_SPEED;
  let len = 0, T = T0, lx = x, ly = y; const maxLen = 120 + pow * 260;
  for (let n = 0; n < 1200 && len < maxLen; n++) { if (!stepBall(h, b, dt, T, null)) break; T += dt; len += Math.hypot(b.x - lx, b.y - ly); lx = b.x; ly = b.y; if (n % 6 === 0) pts.push([b.x, b.y]); }
  return pts;
}

// ------------------------------------------------------------ players and the round
const PCOLS = ['#f8fafc', '#fb7185', '#60a5fa', '#facc15'];
const CPU_NAMES = ['Birdie Bot', 'Chip', 'Ace', 'Sandy', 'Putter', 'Mulligan'];
let game = null;   // { mode, players: [{ name, cpu, skill, col, skin, scores: [], ball, strokes, done }], turn, phase, ... }
let screen = 'title', t = 0, msg = null, parts = [], shake = 0;
function mySkin() { return window.Arcade ? Arcade.equipped('golf', 'ball') : null; }
function makeGame(mode, opts = {}) {
  const players = [];
  players.push({ name: mode === 'party' ? (opts.names && opts.names[0]) || 'Player 1' : myName(), cpu: false, col: PCOLS[0], skin: mySkin() });
  if (mode === 'cpu') {
    const n = opts.cpus || 1, names = [...CPU_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) players.push({ name: names[i], cpu: true, skill: opts.skill == null ? 1 : opts.skill, col: PCOLS[i + 1] });
  }
  if (mode === 'party') for (let i = 1; i < (opts.count || 2); i++) players.push({ name: (opts.names && opts.names[i]) || 'Player ' + (i + 1), cpu: false, col: PCOLS[i], skin: null });
  players.forEach(p => { p.scores = []; });
  return { mode, players, holeIdx: 0, phase: 'intro', phaseT: 0, turn: 0, cpuPlan: null, aces: 0, opts };
}
function startGame(mode, opts = {}) {
  game = makeGame(mode, opts); loadHole(0); msg = null; paused = false;
  screen = 'play';
  Sound.playSong(SONGS.golf);
}
function loadHole(i) {
  HI = i; hole = buildHole(i); holeT = 0; parts = [];
  const d = hole.d;
  game.players.forEach((p, k) => { p.ball = newBall(d.tee[0], d.tee[1]); p.strokes = 0; p.done = false; p.onTee = true; });
  game.turn = 0; game.phase = 'intro'; game.phaseT = 0; game.cpuPlan = null; game.rolling = null;
  aim.ang = Math.atan2(d.cup[1] - d.tee[1], d.cup[0] - d.tee[0]); aim.pow = 0; aim.drag = null; aim.charging = false;
}
const cur = () => game.players[game.turn];
function nextTurn() {
  const P = game.players, n = P.length;
  if (P.every(p => p.done)) { game.phase = 'holeDone'; game.phaseT = 0; return; }
  // the player furthest from the cup goes next (like real golf), ties go round the table
  let best = -1, bd = -1;
  for (let k = 1; k <= n; k++) { const i = (game.turn + k) % n, p = P[i]; if (p.done) continue; const dd = Math.hypot(p.ball.x - hole.d.cup[0], p.ball.y - hole.d.cup[1]) + (p.onTee ? 1e5 - i : 0); if (dd > bd) { bd = dd; best = i; } }
  game.turn = best; game.phase = 'aim'; game.phaseT = 0; game.cpuPlan = null;
  const b = cur().ball; aim.ang = Math.atan2(hole.d.cup[1] - b.y, hole.d.cup[0] - b.x); aim.pow = 0; aim.drag = null; aim.charging = false;
}
function shoot(ang, pow) {
  const p = cur(), b = p.ball;
  b.rest = [b.x, b.y]; b.vx = Math.cos(ang) * pow * MAX_SPEED; b.vy = Math.sin(ang) * pow * MAX_SPEED; b.moving = true; b.trail = [];
  p.strokes++; p.onTee = false; game.phase = 'roll'; game.phaseT = 0; game.rolling = p;
  sfx.putt(pow); shake = Math.max(shake, pow * 3);
}
function scoreWord(s, par) {
  if (s === 1) return 'HOLE IN ONE!';
  const d = s - par; return d <= -3 ? 'ALBATROSS!' : d === -2 ? 'EAGLE!' : d === -1 ? 'BIRDIE!' : d === 0 ? 'PAR' : d === 1 ? 'BOGEY' : d === 2 ? 'DOUBLE BOGEY' : `+${d}`;
}
function onEvent(p, e, v) {
  const b = p.ball;
  if (e === 'wall') { sfx.wall(v); if (v > 300) burst(b.x, b.y, 4, '#ffffff', 60); }
  else if (e === 'bumper') { sfx.bumper(); v.hitT = 1; burst(b.x, b.y, 8, '#fde047', 140); shake = Math.max(shake, 3); }
  else if (e === 'lip') sfx.lip();
  else if (e === 'sand') { sfx.sand(); burst(b.x, b.y, 10, '#e9d5a1', 90); }
  else if (e === 'portal') { sfx.portal(); burst(hole.d.portals[0].x, hole.d.portals[0].y, 14, '#c084fc', 160); burst(b.x, b.y, 14, '#c084fc', 160); }
  else if (e === 'water') {
    sfx.splash(); burst(b.x, b.y, 22, '#bae6fd', 170); ripple(b.x, b.y);
    p.strokes++; b.vx = b.vy = 0; b.moving = false; b.x = b.rest[0]; b.y = b.rest[1];
    say(p.cpu || game.players.length > 1 ? `${p.name}: SPLASH  +1` : 'SPLASH!  +1 stroke', '#7dd3fc');
    game.phase = 'settle'; game.phaseT = 0;
  } else if (e === 'sink') {
    sfx.sink(); p.done = true; p.scores[HI] = p.strokes; b.sinkT = 0;
    const word = scoreWord(p.strokes, hole.d.par);
    if (p.strokes === 1) { sfx.ace(); confetti(); if (!p.cpu) { save.aces++; store(); if (window.Arcade) Arcade.event('golf', 'ace', { hole: HI }); } }
    say((game.players.length > 1 ? p.name + ': ' : '') + word, p.strokes <= hole.d.par ? '#fde047' : '#ffffff', p.strokes === 1);
    burst(hole.d.cup[0], hole.d.cup[1], 16, p.col, 150);
    game.phase = 'settle'; game.phaseT = 0;
  }
}
function say(text, col, big) { msg = { text, col, big, t: 0 }; }

// ------------------------------------------------------------ CPU golfer
// search a fan of shots with the real physics, keep the one that ends closest (by walking distance) to the cup
function* cpuThink(p) {
  const b = p.ball, d = hole.d, h = hole, T0 = holeT + 1.6;
  const score = r => r.sunk ? -1e5 + r.t : r.water ? 5e4 : h.field.at(r.x, r.y);
  const cand = [];
  const POW = [0.12, 0.2, 0.28, 0.36, 0.45, 0.55, 0.66, 0.8, 1.0];
  let n = 0;
  for (let a = 0; a < 72; a++) for (const pw of POW) {
    const ang = a / 72 * Math.PI * 2, r = simShot(h, b.x, b.y, ang, pw, T0);
    cand.push({ ang, pw, s: score(r), r });
    if (++n % 40 === 0) yield;
  }
  cand.sort((x, y) => x.s - y.s);
  // refine around the best few
  const top = cand.slice(0, 5);
  for (const c of top) for (let da = -3; da <= 3; da++) for (let dp = -3; dp <= 3; dp++) {
    const ang = c.ang + da * 0.011, pw = clamp(c.pw + dp * 0.025, 0.05, 1), r = simShot(h, b.x, b.y, ang, pw, T0);
    cand.push({ ang, pw, s: score(r), r }); if (++n % 40 === 0) yield;
  }
  cand.sort((x, y) => x.s - y.s);
  // prefer a safe shot: average the result of tiny misses around the pick
  let best = cand[0];
  for (const c of cand.slice(0, 6)) {
    let tot = 0; for (const [da, dp] of [[-0.012, 0], [0.012, 0], [0, -0.03], [0, 0.03]]) tot += score(simShot(h, b.x, b.y, c.ang + da, clamp(c.pw + dp, 0.05, 1), T0));
    c.safe = c.s * 0.5 + tot / 4 * 0.5; if (!best.safe || c.safe < best.safe) best = c;
    yield;
  }
  return { ang: best.ang, pw: best.pw, T: T0 };
}

// ------------------------------------------------------------ input (drag to putt, or keys)
const aim = { ang: 0, pow: 0, drag: null, charging: false, chargeT: 0 };
let wasDown = false;
function humanInput(dt) {
  const p = cur(), b = p.ball;
  const k = U.keys;
  const turn = (k.ArrowLeft || k.KeyA ? -1 : 0) + (k.ArrowRight || k.KeyD ? 1 : 0);
  if (turn) aim.ang += turn * dt * (k.ShiftLeft || k.ShiftRight ? 0.35 : 1.5);
  if (k.ArrowUp || k.KeyW) aim.pow = clamp(aim.pow + dt * 0.6, 0, 1);
  if (k.ArrowDown || k.KeyS) aim.pow = clamp(aim.pow - dt * 0.6, 0, 1);
  // space: hold to charge (the meter swings), let go to putt
  if (k.Space && !aim.drag) { if (!aim.charging) { aim.charging = true; aim.chargeT = 0; } aim.chargeT += dt; aim.pow = 1 - Math.abs(1 - (aim.chargeT / 1.1) % 2); }
  else if (aim.charging) { aim.charging = false; if (aim.pow > 0.03) { shoot(aim.ang, aim.pow); return; } }
  if (U.pressed.Enter && aim.pow > 0.03) { shoot(aim.ang, aim.pow); return; }
  // drag
  const inHud = U.my < 70;
  if (U.down && !wasDown && !inHud) aim.drag = { x: U.mx, y: U.my };
  if (aim.drag && U.down) {
    const dx = aim.drag.x - U.mx, dy = aim.drag.y - U.my, L = Math.hypot(dx, dy);
    if (L > 6) { aim.ang = Math.atan2(dy, dx); aim.pow = clamp((L - 6) / 230, 0, 1); }
  }
  if (aim.drag && !U.down) { const was = aim.drag; aim.drag = null; if (Math.hypot(was.x - U.mx, was.y - U.my) > 12 && aim.pow > 0.02) { shoot(aim.ang, aim.pow); return; } }
  // hovering with the mouse (not dragging): point the aim at the cursor for a quick look
}

// ------------------------------------------------------------ update
function update(dt) {
  holeT += dt; game.phaseT += dt;
  if (msg) msg.t += dt;
  shake = Math.max(0, shake - dt * 12);
  const P = game.players, d = hole.d;
  // sinking animation
  P.forEach(p => { if (p.ball.sunk) p.ball.sinkT += dt; });
  if (game.phase === 'intro') { if (game.phaseT > 1.6 || (!quiet && U.click && game.phaseT > 0.3)) { if (!quiet) U.click = null; game.turn = 0; game.phase = 'aim'; game.phaseT = 0; const b = cur().ball; aim.ang = Math.atan2(d.cup[1] - b.y, d.cup[0] - b.x); } }
  else if (game.phase === 'aim') {
    const p = cur();
    if (p.cpu) {
      if (!game.cpuPlan) game.cpuPlan = { it: cpuThink(p), res: null, show: 0 };
      const cp = game.cpuPlan;
      if (!cp.res) { const r = cp.it.next(); if (r.done) { cp.res = r.value; const sk = p.skill, sa = [0.075, 0.035, 0.016][sk], spw = [0.15, 0.075, 0.035][sk]; cp.ang = cp.res.ang + gauss() * sa; cp.pw = clamp(cp.res.pw * (1 + gauss() * spw), 0.04, 1); cp.from = aim.ang; } }
      else {
        cp.show += dt; const k = clamp(cp.show / 0.7, 0, 1), e = k * k * (3 - 2 * k);
        aim.ang = cp.from + ((cp.ang - cp.from + Math.PI * 3) % (Math.PI * 2) - Math.PI) * e; aim.pow = cp.pw * e;
        if (holeT >= cp.res.T && k >= 1) shoot(cp.ang, cp.pw);
      }
    } else humanInput(dt);
  }
  // balls
  const dtS = 1 / 240;
  if (game.phase === 'roll') {
    const p = game.rolling, b = p.ball;
    let n = Math.max(1, Math.round(dt / dtS)), moving = true;
    for (let i = 0; i < n && moving && game.phase === 'roll'; i++) moving = stepBall(hole, b, dt / n, holeT - dt + dt * (i + 1) / n, (e, v) => onEvent(p, e, v));
    if (game.phase === 'roll') {
      b.trail.push([b.x, b.y]); if (b.trail.length > 14) b.trail.shift();
      if (!moving) { b.moving = false; game.phase = 'settle'; game.phaseT = 0; if (p.strokes >= 8 && !p.done) { p.done = true; p.scores[HI] = 8; say(`${P.length > 1 ? p.name + ': ' : ''}PICKED UP (8)`, '#fca5a5'); } }
      if (game.phaseT > 14) { b.vx = b.vy = 0; b.moving = false; game.phase = 'settle'; game.phaseT = 0; }
    }
  } else if (game.phase === 'settle') {
    const p = game.rolling; if (p) { p.ball.trail.shift(); }
    if (game.phaseT > (p && p.done ? 1.1 : 0.35)) nextTurn();
  } else if (game.phase === 'holeDone') {
    if (game.phaseT > 1.2 && !quiet) { screen = 'card'; cardT = 0; }
  }
  // particles
  parts.forEach(q => { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 2.5; q.vy = q.vy * (1 - dt * 2.5) + (q.g || 0) * dt; });
  parts = parts.filter(q => q.t < q.life);
  (d.bumpers || []).forEach(p => { if (p.hitT) p.hitT = Math.max(0, p.hitT - dt * 4); });
}
function burst(x, y, n, col, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rand(0.3, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.35, 0.7), col, r: rand(1.5, 3.2) }); } }
function ripple(x, y) { parts.push({ x, y, vx: 0, vy: 0, t: 0, life: 1.1, ring: true, col: '#e0f2fe' }); parts.push({ x, y, vx: 0, vy: 0, t: -0.2, life: 1.1, ring: true, col: '#e0f2fe' }); }
function confetti() { const C = ['#f43f5e', '#fde047', '#22d3ee', '#a3e635', '#c084fc', '#fb923c']; for (let i = 0; i < 160; i++) parts.push({ x: rand(0, W), y: rand(-80, -10), vx: rand(-40, 40), vy: rand(80, 260), t: 0, life: rand(2.2, 3.6), col: C[i % C.length], r: rand(3, 6), conf: true, rot: rand(0, 6), g: 30 }); }

// ------------------------------------------------------------ drawing
const rr = U.rr;
function pathPoly(P) { ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
function makeDecor(d, th) {
  // bushes, trees and flowers scattered around (never on the course)
  const out = [], seed = d.name.length * 977 + d.par * 31; let s = seed;
  const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const clearOf = (x, y, m) => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (inPoly(x + Math.cos(a) * m, y + Math.sin(a) * m, d.course)) return false; } return !inPoly(x, y, d.course); };
  for (let i = 0; i < 70; i++) { const x = R() * W, y = 70 + R() * (H - 60), r = 14 + R() * 26; if (clearOf(x, y, r + 14)) out.push({ k: 'tree', x, y, r, c: th.deco[i % th.deco.length] }); }
  for (let i = 0; i < 90; i++) { const x = R() * W, y = 70 + R() * (H - 60); if (clearOf(x, y, 10)) out.push({ k: 'flower', x, y, c: th.flower[i % th.flower.length] }); }
  return out.sort((a, b) => a.y - b.y);
}
let grassCache = null;
function grassPattern(th) {
  if (grassCache && grassCache.th === th) return grassCache.pat;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = th.grass; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; g.fillRect(Math.random() * 64, Math.random() * 64, 1.5, 1.5); }
  const pat = ctx.createPattern(c, 'repeat'); grassCache = { th, pat }; return pat;
}
function drawBackground(th) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 820); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft mown pattern on the surrounding lawn
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#ffffff'; for (let x = -H; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 40 + H, H); ctx.lineTo(x + H, H); ctx.fill(); } ctx.globalAlpha = 1;
}
function drawDecor(h, under) {
  for (const o of h.decor) {
    if (o.k === 'flower') { if (!under) continue; ctx.fillStyle = o.c; for (let k = 0; k < 5; k++) { const a = k * 1.256; ctx.beginPath(); ctx.arc(o.x + Math.cos(a) * 2.6, o.y + Math.sin(a) * 2.6, 2.1, 0, 7); ctx.fill(); } ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(o.x, o.y, 1.6, 0, 7); ctx.fill(); continue; }
    if (under) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(o.x + o.r * 0.25, o.y + o.r * 0.35, o.r * 1.05, o.r * 0.9, 0, 0, 7); ctx.fill(); continue; }
    const g = ctx.createRadialGradient(o.x - o.r * 0.35, o.y - o.r * 0.4, o.r * 0.1, o.x, o.y, o.r); g.addColorStop(0, U.shade(o.c, 0.25)); g.addColorStop(1, U.shade(o.c, -0.2));
    ctx.fillStyle = g; ctx.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr2 = o.r * (0.93 + 0.07 * Math.sin(a * 6 + o.x)); k ? ctx.lineTo(o.x + Math.cos(a) * rr2, o.y + Math.sin(a) * rr2) : ctx.moveTo(o.x + Math.cos(a) * rr2, o.y + Math.sin(a) * rr2); } ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.35, o.r * 0.42, 0, 7); ctx.fill();
  }
}
function drawCourse(h) {
  const d = h.d, th = h.theme;
  // shadow under the whole course
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 14; pathPoly(d.course); ctx.fillStyle = th.wall; ctx.fill(); ctx.restore();
  // grass with mowing stripes
  ctx.save(); pathPoly(d.course); ctx.clip();
  ctx.fillStyle = grassPattern(th); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.045)'; for (let x = -H; x < W + H; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 32 - H * 0.5, H); ctx.lineTo(x - H * 0.5, H); ctx.fill(); }
  ctx.save(); ctx.lineJoin = 'round'; pathPoly(d.course); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 34; ctx.stroke(); pathPoly(d.course); ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 20; ctx.stroke(); ctx.restore();
  // tee pad
  const [tx, ty] = d.tee; rr(tx - 26, ty - 26, 52, 52, 10); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill(); rr(tx - 24, ty - 24, 48, 48, 9); ctx.fillStyle = U.shade(th.grass, -0.12); ctx.fill();
  // slopes: darker shading + drifting chevrons showing the pull
  for (const s of d.slopes || []) {
    pathPoly(s.poly);
    if (s.bump) { const c = polyCenter(s.poly), g = ctx.createLinearGradient(s.poly[0][0], 0, s.poly[1][0], 0); g.addColorStop(0, 'rgba(0,0,0,0.12)'); g.addColorStop(0.5, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.12)'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(c[0], s.poly[0][1] + 6); ctx.lineTo(c[0], s.poly[2][1] - 6); ctx.stroke(); ctx.setLineDash([]); continue; }
    if (s.bowl) { const [bx, by, br] = s.bowl, g = ctx.createRadialGradient(bx, by, 10, bx, by, br); g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fill(); continue; }
    ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fill();
    ctx.save(); pathPoly(s.poly); ctx.clip();
    const a = Math.atan2(s.ay, s.ax), L = Math.hypot(s.ax, s.ay), ph = (t * L * 0.12) % 60, [x0, y0] = s.poly[0], [x1, y1] = s.poly[2];
    ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let yy = y0 - 60; yy < y1 + 60; yy += 60) for (let xx = x0 - 60; xx < x1 + 60; xx += 60) {
      const cxp = xx + 30 + Math.cos(a) * ph, cyp = yy + 30 + Math.sin(a) * ph;
      ctx.save(); ctx.translate(cxp, cyp); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(4, 0); ctx.lineTo(-6, 9); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  // sand
  for (const s of d.sand || []) {
    ctx.save(); pathPoly(s); ctx.clip();
    ctx.fillStyle = '#e8d29b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(160,120,60,0.18)'; for (let i = 0; i < 120; i++) { const p = s[i % s.length]; ctx.fillRect(p[0] + ((i * 37) % 120) - 60, p[1] + ((i * 53) % 120) - 60, 2, 2); }
    ctx.restore();
    ctx.save(); pathPoly(s); ctx.strokeStyle = 'rgba(120,90,40,0.35)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  // water with moving ripples and a foam edge
  for (const w of d.water || []) {
    ctx.save(); pathPoly(w); ctx.clip();
    const g = ctx.createLinearGradient(0, w[0][1], 0, w[2][1]); g.addColorStop(0, '#38bdf8'); g.addColorStop(1, '#0369a1'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
    for (let yy = w[0][1] + 14; yy < w[2][1]; yy += 22) { ctx.beginPath(); for (let xx = w[0][0]; xx <= w[1][0]; xx += 12) { const y2 = yy + Math.sin(xx * 0.05 + t * 2 + yy) * 3; xx === w[0][0] ? ctx.moveTo(xx, y2) : ctx.lineTo(xx, y2); } ctx.stroke(); }
    ctx.restore();
    ctx.save(); pathPoly(w); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 12; ctx.stroke(); ctx.restore();
  }
  if (d.bridge) { const [x0, y0, x1, y1] = d.bridge; ctx.fillStyle = '#a16207'; ctx.fillRect(x0, y0 - 2, x1 - x0, y1 - y0 + 4); for (let x = x0; x < x1; x += 18) { ctx.fillStyle = (x / 18) % 2 < 1 ? '#c58a3a' : '#b97f32'; ctx.fillRect(x + 1, y0, 16, y1 - y0); } ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0, y0, x1 - x0, 4); ctx.fillRect(x0, y1 - 4, x1 - x0, 4); }
  // cup
  const [cx, cy] = d.cup;
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, CUP_R + 4, 0, 7); ctx.fill();
  const cg = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, CUP_R); cg.addColorStop(0, '#05080a'); cg.addColorStop(1, '#1f2937'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, CUP_R, 0, 7); ctx.fill();
  ctx.restore();
  // walls: a bevelled rail running round the outline
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  pathPoly(d.course); ctx.strokeStyle = U.shade(th.wall, -0.35); ctx.lineWidth = 18; ctx.stroke();
  pathPoly(d.course); ctx.strokeStyle = th.wall; ctx.lineWidth = 14; ctx.stroke();
  ctx.translate(-1, -2); pathPoly(d.course); ctx.strokeStyle = th.wallTop; ctx.lineWidth = 6; ctx.stroke();
  ctx.restore();
  // portals
  for (const [k, p] of (d.portals || []).entries()) {
    ctx.save(); ctx.translate(p.x, p.y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22); g.addColorStop(0, k ? 'rgba(192,132,252,0.15)' : 'rgba(17,6,40,0.95)'); g.addColorStop(1, 'rgba(192,132,252,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
    ctx.rotate(t * (k ? -2 : 3)); ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 12 + i * 4, i * 2, i * 2 + 3.6); ctx.stroke(); }
    ctx.restore();
  }
}
function raised(P, col, top, hgt = 9) {
  ctx.save(); ctx.translate(5, 7); pathPoly(P); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.restore();
  pathPoly(P); ctx.fillStyle = U.shade(col, -0.3); ctx.fill();
  ctx.save(); ctx.translate(0, -hgt * 0.4); pathPoly(P); const c = polyCenter(P), g = ctx.createLinearGradient(0, c[1] - 60, 0, c[1] + 60); g.addColorStop(0, top); g.addColorStop(1, col); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
}
function drawObstacles(h) {
  const d = h.d, th = h.theme;
  for (const b of d.blocks || []) raised(b, th.block, th.blockTop);
  // windmill house roof
  if (d.house) {
    const { x, y } = d.house;
    ctx.save(); ctx.translate(x, y);
    const roof = (yy, hh) => { const g = ctx.createLinearGradient(-50, 0, 50, 0); g.addColorStop(0, '#9f1239'); g.addColorStop(0.5, '#e11d48'); g.addColorStop(1, '#9f1239'); ctx.fillStyle = g; rr(-50, yy, 100, hh, 8); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; for (let i = -40; i <= 40; i += 10) { ctx.beginPath(); ctx.moveTo(i, yy + 4); ctx.lineTo(i, yy + hh - 4); ctx.stroke(); } ctx.fillStyle = '#fde68a'; ctx.fillRect(-3, yy + 2, 6, hh - 4); };
    roof(-140, 118); roof(22, 118);
    ctx.restore();
  }
  // movers
  for (const m of d.movers || []) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; rr(m.x + m.w / 2 - 5, m.y + 6, 10, m.dy + m.h - 12, 5); ctx.fill();
    const [mx, my] = moverPos(m, holeT);
    raised(rectP(mx, my, mx + m.w, my + m.h), '#f59e0b', '#fde68a', 10);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 3; k++) { ctx.save(); ctx.beginPath(); ctx.rect(mx + 4, my + 10 + k * 26, m.w - 8, 12); ctx.clip(); for (let s2 = -20; s2 < m.w; s2 += 14) { ctx.beginPath(); ctx.moveTo(mx + s2, my + 22 + k * 26); ctx.lineTo(mx + s2 + 8, my + 6 + k * 26); ctx.lineTo(mx + s2 + 14, my + 6 + k * 26); ctx.lineTo(mx + s2 + 6, my + 22 + k * 26); ctx.fill(); } ctx.restore(); }
  }
  // bumpers
  for (const p of d.bumpers || []) {
    const k = p.hitT || 0, r = p.r + k * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(p.x + 4, p.y + 6, r, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.4, 2, p.x, p.y, r); g.addColorStop(0, '#fff1f2'); g.addColorStop(0.4, k ? '#fde047' : '#fb7185'); g.addColorStop(1, '#9f1239');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.62, 0, 7); ctx.stroke();
  }
  // windmill sails
  for (const s of d.spinners || []) {
    const segs = spinnerSegs(s, holeT);
    ctx.save(); ctx.lineCap = 'round';
    segs.forEach(g => { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(g[0] + 6, g[1] + 9); ctx.lineTo(g[2] + 6, g[3] + 9); ctx.stroke(); });
    segs.forEach(g => {
      const a = Math.atan2(g[3] - g[1], g[2] - g[0]);
      ctx.save(); ctx.translate(g[0], g[1]); ctx.rotate(a);
      ctx.fillStyle = '#f8fafc'; rr(14, -9, s.len - 14, 18, 4); ctx.fill(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; for (let x = 24; x < s.len; x += 12) { ctx.beginPath(); ctx.moveTo(x, -9); ctx.lineTo(x, 9); ctx.stroke(); }
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, -2.5, s.len, 5);
      ctx.restore();
    });
    ctx.fillStyle = '#451a03'; ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill();
    ctx.restore();
  }
}
function drawFlag(h) {
  const [cx, cy] = h.d.cup;
  const near = Math.min(...game.players.filter(p => !p.ball.sunk).map(p => Math.hypot(p.ball.x - cx, p.ball.y - cy)).concat([999]));
  const a = clamp((near - 40) / 120, 0.18, 1);
  ctx.save(); ctx.globalAlpha = a;
  // pole shadow and pole
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 34, cy + 20); ctx.stroke();
  ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 64); ctx.stroke();
  const flagCol = h.theme.night ? '#f472b6' : '#ef4444';
  ctx.fillStyle = flagCol; ctx.beginPath(); ctx.moveTo(cx + 1, cy - 64);
  for (let i = 0; i <= 8; i++) { const x = cx + 1 + i * 4.4, w = Math.sin(t * 5 - i * 0.6) * 2.4 * (i / 8); ctx.lineTo(x, cy - 64 + w); }
  for (let i = 8; i >= 0; i--) { const x = cx + 1 + i * 4.4, w = Math.sin(t * 5 - i * 0.6) * 2.4 * (i / 8); ctx.lineTo(x, cy - 42 + w - (i / 8) * 0); }
  ctx.closePath(); ctx.fill();
  U.txt(String(h.i + 1), cx + 18, cy - 53, 13, '#fff', 'center', { base: 'middle', weight: 800, shadow: false });
  ctx.restore();
}
function drawBall(p, active) {
  const b = p.ball; if (b.sunk && b.sinkT > 0.35) return;
  const sk = p.skin, col = sk ? sk.col : p.col, s = b.sunk ? 1 - b.sinkT / 0.35 : 1, r = BR * s;
  // trail
  if (b.trail.length > 1) {
    for (let i = 1; i < b.trail.length; i++) {
      const k = i / b.trail.length, q = b.trail[i];
      let c = 'rgba(255,255,255,' + (0.22 * k) + ')';
      if (sk && sk.fx === 'fire') c = `rgba(${255},${Math.round(120 + 100 * k)},40,${0.5 * k})`;
      else if (sk && sk.fx === 'rainbow') c = `hsla(${(i * 30 + t * 200) % 360},90%,60%,${0.55 * k})`;
      else if (sk && (sk.fx === 'crown' || sk.fx === 'shine')) c = `rgba(253,224,71,${0.5 * k})`;
      else if (sk && sk.fx === 'stars') c = `rgba(165,180,252,${0.5 * k})`;
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(q[0], q[1], r * (0.4 + 0.6 * k), 0, 7); ctx.fill();
    }
  }
  if (!active && !b.moving && game.players.length > 1) ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 4, r, r * 0.85, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, U.shade(col.length === 7 ? col : '#cccccc', -0.45));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
  if (sk && sk.fx === 'stars') { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; ctx.fillRect(b.x + Math.cos(a) * r * 0.5 - 0.7, b.y + Math.sin(a) * r * 0.5 - 0.7, 1.4, 1.4); } }
  if (sk && sk.fx === 'crown') { ctx.save(); ctx.translate(b.x, b.y - r - 5); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-6, -3); ctx.lineTo(-3, 0); ctx.lineTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(6, -3); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill(); ctx.restore(); }
  if (game.players.length > 1 && !b.sunk && !b.moving) { ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, r + 4 + (active ? Math.sin(t * 6) * 1.5 : 0), 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawAim() {
  const p = cur(), b = p.ball;
  // pulsing ring under the ball
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 16 + Math.sin(t * 4) * 2, 0, 7); ctx.stroke();
  if (aim.pow <= 0.01) {
    if (!p.cpu && !aim.drag) { const a = aim.ang; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * 20, b.y + Math.sin(a) * 20); ctx.lineTo(b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70); ctx.stroke(); ctx.setLineDash([]); }
    return;
  }
  const a = aim.ang, pw = aim.pow, col = `hsl(${120 - pw * 120},90%,55%)`;
  // guide: where the first part of the putt goes (bounces included)
  if (save.guide && !p.cpu) {
    const pts = guidePath(hole, b.x, b.y, a, pw, holeT);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    pts.forEach((q, i) => { if (i % 2) return; const k = 1 - i / pts.length; ctx.globalAlpha = k * 0.9; ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([2, 8]); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(a) * (60 + pw * 200), b.y + Math.sin(a) * (60 + pw * 200)); ctx.stroke(); ctx.setLineDash([]);
  }
  // the "pull back" stick behind the ball shows the power
  const L = 18 + pw * 90, bx = b.x - Math.cos(a) * (14 + L), by = b.y - Math.sin(a) * (14 + L);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 14, b.y - Math.sin(a) * 14 + 3); ctx.lineTo(bx, by + 3); ctx.stroke();
  const g = ctx.createLinearGradient(b.x, b.y, bx, by); g.addColorStop(0, '#ffffff'); g.addColorStop(1, col);
  ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 14, b.y - Math.sin(a) * 14); ctx.lineTo(bx, by); ctx.stroke();
  // arrow head in front
  const fx = b.x + Math.cos(a) * 22, fy = b.y + Math.sin(a) * 22;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx + Math.cos(a) * 12, fy + Math.sin(a) * 12); ctx.lineTo(fx + Math.cos(a + 2.4) * 8, fy + Math.sin(a + 2.4) * 8); ctx.lineTo(fx + Math.cos(a - 2.4) * 8, fy + Math.sin(a - 2.4) * 8); ctx.closePath(); ctx.fill();
  U.txt(Math.round(pw * 100) + '%', bx, by - 22, 14, '#fff', 'center', { base: 'middle', weight: 800 });
}
function drawParts() {
  for (const q of parts) {
    if (q.t < 0) continue; const k = 1 - q.t / q.life;
    if (q.ring) { ctx.strokeStyle = q.col; ctx.globalAlpha = k * 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 6 + (1 - k) * 34, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; continue; }
    ctx.globalAlpha = clamp(k * 1.6, 0, 1); ctx.fillStyle = q.col;
    if (q.conf) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.t * 6); ctx.fillRect(-q.r, -q.r * 0.4, q.r * 2, q.r * 0.8); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawHUD() {
  const d = hole.d, P = game.players;
  const g = ctx.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, 'rgba(5,10,8,0.6)'); g.addColorStop(1, 'rgba(5,10,8,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 90);
  U.txt(`HOLE ${HI + 1}`, 32, 18, 26, '#ffffff', 'left', { head: true, weight: 800 });
  U.txt(`${d.name}  ·  PAR ${d.par}`, 34, 50, 14, 'rgba(255,255,255,0.75)', 'left', { weight: 700 });
  // players
  let x = W - 32;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i], on = i === game.turn && (game.phase === 'aim' || game.phase === 'roll'), tot = p.scores.reduce((a, s) => a + (s || 0), 0), par = HOLES.slice(0, p.scores.filter(s => s).length).reduce((a, h2, k) => a + (p.scores[k] ? h2.par : 0), 0);
    const w = 150; x -= w;
    rr(x, 14, w - 10, 50, 12); ctx.fillStyle = on ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.28)'; ctx.fill();
    if (on) { ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = p.skin ? p.skin.col : p.col; ctx.beginPath(); ctx.arc(x + 18, 39, 7, 0, 7); ctx.fill();
    U.txt(p.name.length > 11 ? p.name.slice(0, 10) + '…' : p.name, x + 32, 22, 13, '#fff', 'left', { weight: 800, shadow: false });
    const tp = tot - par;
    U.txt(`${p.done ? '✓ ' : ''}${p.strokes} this hole`, x + 32, 42, 11, 'rgba(255,255,255,0.7)', 'left', { weight: 600, shadow: false });
    U.txt(par ? (tp === 0 ? 'E' : (tp > 0 ? '+' : '') + tp) : '', x + w - 20, 22, 13, tp < 0 ? '#86efac' : tp > 0 ? '#fca5a5' : '#fff', 'right', { weight: 800, shadow: false });
  }
  // whose turn
  const p = cur();
  if (game.phase === 'aim' && P.length > 1) pill(p.cpu ? `${p.name} is lining up…` : p.name === 'You' ? 'Your turn' : `${p.name}'s turn`, W / 2, H - 34, 15, p.col);
  else if (game.phase === 'aim' && HI === 0 && p.strokes === 0 && !aim.drag) pill(d.tip, W / 2, H - 34, 14);
  if (game.phase === 'aim' && !p.cpu && P.length === 1 && HI > 0 && p.strokes === 0 && game.phaseT < 4) pill(d.tip, W / 2, H - 34, 14);
  // hole intro banner
  if (game.phase === 'intro') {
    const k = clamp(game.phaseT * 3, 0, 1) * clamp((1.6 - game.phaseT) * 3, 0, 1);
    ctx.globalAlpha = k; rr(W / 2 - 240, H / 2 - 70, 480, 140, 24); ctx.fillStyle = 'rgba(6,12,10,0.78)'; ctx.fill();
    U.txt(`HOLE ${HI + 1}`, W / 2, H / 2 - 52, 18, '#86efac', 'center', { weight: 800 });
    U.txt(d.name, W / 2, H / 2 - 26, 44, '#fff', 'center', { head: true, weight: 800 });
    U.txt(`PAR ${d.par}`, W / 2, H / 2 + 30, 16, 'rgba(255,255,255,0.75)', 'center', { weight: 800 }); ctx.globalAlpha = 1;
  }
  // score popup
  if (msg && msg.t < 2.2) {
    const k = msg.t < 0.15 ? msg.t / 0.15 : clamp((2.2 - msg.t) * 2, 0, 1), sc = msg.t < 0.18 ? 1.3 - msg.t / 0.18 * 0.3 : 1;
    ctx.globalAlpha = k; ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(sc, sc);
    U.txt(msg.text, 0, 0, msg.big ? 64 : 40, msg.col, 'center', { head: true, weight: 800, base: 'middle' }); ctx.restore(); ctx.globalAlpha = 1;
  }
  // pause button (for touch)
  const pzx = W - 32 - P.length * 150 - 56;
  if (U.button('pz', pzx, 14, 44, 44, '', { ghost: true, sfx: 'tab', icon: (x2, y2) => { ctx.fillStyle = '#fff'; ctx.fillRect(x2 + 16, y2 + 14, 4, 16); ctx.fillRect(x2 + 24, y2 + 14, 4, 16); } })) paused = true;
}
function pill(s, x, y, size, dot) {
  ctx.font = `700 ${size}px Inter, sans-serif`; const w = ctx.measureText(s).width + 34 + (dot ? 16 : 0);
  rr(x - w / 2, y - size, w, size * 2, size); ctx.fillStyle = 'rgba(6,12,10,0.66)'; ctx.fill();
  if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x - w / 2 + 20, y, 5, 0, 7); ctx.fill(); }
  U.txt(s, x + (dot ? 8 : 0), y, size, '#fff', 'center', { base: 'middle', weight: 700, shadow: false });
}
function drawPlay(dt) {
  const th = hole.theme;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawBackground(th); drawDecor(hole, true);
  drawCourse(hole); drawObstacles(hole);
  game.players.forEach((p, i) => { if (i !== game.turn) drawBall(p, false); });
  if (game.phase === 'aim') drawAim();
  drawBall(cur(), true);
  drawFlag(hole);
  drawDecor(hole, false);
  drawParts();
  if (th.night) { const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 900); g.addColorStop(0, 'rgba(10,8,30,0)'); g.addColorStop(1, 'rgba(10,8,30,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

// ------------------------------------------------------------ scorecard
let cardT = 0;
function totals(p) { return p.scores.reduce((a, s) => a + (s || 0), 0); }
function drawCard(dt) {
  cardT += dt;
  drawPlay(dt);
  ctx.fillStyle = 'rgba(4,8,6,0.62)'; ctx.fillRect(0, 0, W, H);
  const P = game.players, last = HI === HOLES.length - 1;
  const x0 = 100, w = W - 200, y0 = 110;
  U.panel(x0, y0 - 40, w, 120 + P.length * 56 + (last ? 190 : 130));
  U.txt(last ? 'Final scores' : `After hole ${HI + 1}`, W / 2, y0 - 22, 30, '#fff', 'center', { head: true, weight: 800 });
  const cw = 64, cx0 = x0 + 230;
  U.txt('HOLE', x0 + 30, y0 + 34, 12, '#94a3b8', 'left', { weight: 800 }); U.txt('PAR', x0 + 30, y0 + 60, 12, '#94a3b8', 'left', { weight: 800 });
  HOLES.forEach((h2, i) => { const cx = cx0 + i * cw; U.txt(String(i + 1), cx + cw / 2, y0 + 34, 13, i === HI ? '#fde047' : '#cbd5e1', 'center', { weight: 800 }); U.txt(String(h2.par), cx + cw / 2, y0 + 60, 13, '#94a3b8', 'center', { weight: 700 }); });
  U.txt('TOTAL', cx0 + 9 * cw + 50, y0 + 34, 12, '#94a3b8', 'center', { weight: 800 });
  const parSoFar = HOLES.slice(0, HI + 1).reduce((a, h2) => a + h2.par, 0);
  U.txt(String(parSoFar), cx0 + 9 * cw + 50, y0 + 60, 13, '#94a3b8', 'center', { weight: 700 });
  const order = [...P].sort((a, b) => totals(a) - totals(b));
  order.forEach((p, r) => {
    const y = y0 + 88 + r * 56, k = clamp((cardT - r * 0.1) * 4, 0, 1);
    ctx.globalAlpha = k;
    rr(x0 + 16, y, w - 32, 46, 12); ctx.fillStyle = r === 0 && P.length > 1 ? 'rgba(250,204,21,0.14)' : 'rgba(255,255,255,0.05)'; ctx.fill();
    ctx.fillStyle = p.skin ? p.skin.col : p.col; ctx.beginPath(); ctx.arc(x0 + 40, y + 23, 8, 0, 7); ctx.fill();
    U.txt(p.name, x0 + 58, y + 23, 17, '#fff', 'left', { base: 'middle', weight: 800, shadow: false });
    HOLES.forEach((h2, i) => {
      const s = p.scores[i]; if (!s) return; const cx = cx0 + i * cw + cw / 2, dd = s - h2.par;
      if (dd < 0) { ctx.strokeStyle = '#86efac'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, y + 23, 14, 0, 7); ctx.stroke(); }
      if (dd > 0) { ctx.strokeStyle = 'rgba(252,165,165,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(cx - 13, y + 10, 26, 26); }
      U.txt(String(s), cx, y + 23, 16, s === 1 ? '#fde047' : '#fff', 'center', { base: 'middle', weight: 800, shadow: false });
    });
    const tot = totals(p), tp = tot - parSoFar;
    U.txt(`${tot}`, cx0 + 9 * cw + 38, y + 23, 18, '#fff', 'center', { base: 'middle', weight: 800, shadow: false });
    U.txt(tp === 0 ? 'E' : (tp > 0 ? '+' : '') + tp, cx0 + 9 * cw + 80, y + 23, 14, tp < 0 ? '#86efac' : tp > 0 ? '#fca5a5' : '#e2e8f0', 'center', { base: 'middle', weight: 800, shadow: false });
    ctx.globalAlpha = 1;
  });
  const by = y0 + 88 + P.length * 56 + 30;
  if (last) {
    if (!game.finished) finishRound();
    const r = game.finished;
    U.txt(r.headline, W / 2, by - 6, 22, r.col, 'center', { weight: 800 });
    if (U.button('again', W / 2 - 320, by + 34, 300, 56, 'PLAY AGAIN', { color: '#22c55e', size: 18 })) startGame(game.mode, game.opts);
    if (U.button('menu', W / 2 + 20, by + 34, 300, 56, 'MENU', { ghost: true, size: 18, sfx: 'back' })) { screen = 'title'; game = null; }
  } else if (cardT > 0.4 && (U.button('next', W / 2 - 150, by, 300, 56, `HOLE ${HI + 2}  →`, { color: '#22c55e', size: 18 }) || U.pressed.Enter || U.pressed.Space || (P.every(p => p.cpu || false) && cardT > 3))) {
    loadHole(HI + 1); screen = 'play';
  }
}
function finishRound() {
  const P = game.players, me = P[0], par = HOLES.reduce((a, h2) => a + h2.par, 0), tot = totals(me), tp = tot - par;
  const best = Math.min(...P.map(totals)), won = P.length === 1 ? tp <= 0 : totals(me) === best && P.filter(p => totals(p) === best).length === 1;
  let headline, col = '#fff';
  if (game.mode === 'party') { const w = P.filter(p => totals(p) === best); headline = w.length > 1 ? 'It is a tie!' : `${w[0].name} wins!`; col = '#fde047'; }
  else if (P.length > 1) { headline = won ? 'You win the round!' : `${P.find(p => totals(p) === best).name} wins this one.`; col = won ? '#fde047' : '#fff'; }
  else { headline = `${tot} strokes  ·  ${tp === 0 ? 'even par' : (tp > 0 ? '+' : '') + tp}${!save.best || tot < save.best ? '  ·  NEW BEST!' : ''}`; col = tp <= 0 ? '#86efac' : '#fff'; }
  if (game.mode !== 'party') {
    save.rounds++; if (!save.best || tot < save.best) { save.best = tot; save.bestPar = tp; }
    if (won && P.length > 1) save.wins++;
    HOLES.forEach((h2, i) => { const s = me.scores[i]; if (s && (!save.holeBest[i] || s < save.holeBest[i])) save.holeBest[i] = s; });
    store();
    if (window.Arcade) Arcade.event('golf', 'round', { won, strokes: tot, toPar: tp, cpu: P.length > 1 });
  }
  game.finished = { headline, col, won };
}

// ------------------------------------------------------------ menus
let demo = null, sub = 'main', party = { count: 2, names: ['Player 1', 'Player 2', 'Player 3', 'Player 4'] }, cpuOpt = { n: 1, skill: 1 };
function demoTick(dt) {
  // a quiet game with computer golfers in the background of the menu
  const keep = { game, hole, HI, holeT, parts, msg, aim: Object.assign({}, aim) };
  quiet = true;
  try {
    if (!demo || demo.done) {
      const h = demo ? (demo.HI + 1) % HOLES.length : 2;
      game = makeGame('cpu', { cpus: 2, skill: 2 }); game.players[0] = Object.assign(game.players[0], { cpu: true, skill: 2, name: 'Ace', skin: null });
      loadHole(h); msg = null; demo = { game, hole, HI, holeT, parts, msg, aim: Object.assign({}, aim) };
    } else { game = demo.game; hole = demo.hole; HI = demo.HI; holeT = demo.holeT; parts = demo.parts; msg = demo.msg; Object.assign(aim, demo.aim); }
    update(dt);
    if ((game.phase === 'holeDone' && game.phaseT > 0.8) || game.phaseT > 30) demo.done = true;
    drawPlay(dt);
    Object.assign(demo, { holeT, parts, msg, aim: Object.assign({}, aim) });
  } finally {
    quiet = false;
    game = keep.game; hole = keep.hole; HI = keep.HI; holeT = keep.holeT; parts = keep.parts; msg = keep.msg; Object.assign(aim, keep.aim);
  }
}
function drawTitle(dt) {
  demoTick(dt);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(4,10,7,0.88)'); g.addColorStop(0.45, 'rgba(4,10,7,0.55)'); g.addColorStop(1, 'rgba(4,10,7,0.1)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  U.txt('PUTT', 80, 80, 96, '#ffffff', 'left', { head: true, weight: 800 });
  U.txt('PARK', 80, 170, 96, '#86efac', 'left', { head: true, weight: 800 });
  U.txt('Nine holes of mini golf. Windmills, bumpers, water and one sneaky shortcut.', 84, 282, 17, '#d1fae5', 'left', { weight: 600 });
  if (sub === 'main') {
    if (U.button('solo', 84, 330, 340, 62, 'PLAY 9 HOLES', { color: '#22c55e', size: 20 }) || U.pressed.Enter) startGame('solo');
    if (U.button('cpu', 84, 404, 340, 56, 'VS COMPUTER', { color: '#3b82f6', size: 18 })) sub = 'cpu';
    if (U.button('party', 84, 472, 340, 56, 'PARTY (2-4 PLAYERS)', { color: '#f59e0b', size: 18 })) sub = 'party';
    if (U.button('guide', 84, 540, 340, 44, `AIM GUIDE: ${save.guide ? 'ON' : 'OFF'}`, { ghost: true, size: 14, sfx: 'tab' })) { save.guide = !save.guide; store(); }
    U.txt(`Best round ${save.best ? save.best + ' (' + (save.bestPar === 0 ? 'E' : (save.bestPar > 0 ? '+' : '') + save.bestPar) + ')' : '—'}   ·   Holes in one ${save.aces}   ·   Rounds ${save.rounds}`, 84, 608, 14, '#a7f3d0', 'left', { weight: 600 });
    U.txt('Drag back from anywhere and let go to putt  ·  or A/D to aim, hold SPACE', 84, 640, 13, 'rgba(209,250,229,0.7)', 'left', { weight: 600 });
  } else if (sub === 'cpu') {
    U.panel(84, 320, 420, 300);
    U.txt('Vs computer', 108, 340, 22, '#fff', 'left', { head: true, weight: 800 });
    U.txt('Opponents', 108, 388, 13, '#94a3b8', 'left', { weight: 800 });
    [1, 2, 3].forEach(n => { if (U.button('n' + n, 108 + (n - 1) * 124, 410, 112, 46, String(n), cpuOpt.n === n ? { color: '#3b82f6', size: 17 } : { ghost: true, size: 17, sfx: 'tab' })) cpuOpt.n = n; });
    U.txt('Skill', 108, 472, 13, '#94a3b8', 'left', { weight: 800 });
    ['CASUAL', 'GOOD', 'PRO'].forEach((s, k) => { if (U.button('s' + k, 108 + k * 124, 494, 112, 46, s, cpuOpt.skill === k ? { color: ['#22c55e', '#f59e0b', '#ef4444'][k], size: 14 } : { ghost: true, size: 14, sfx: 'tab' })) cpuOpt.skill = k; });
    if (U.button('go', 108, 556, 240, 50, 'TEE OFF', { color: '#22c55e', size: 17 }) || U.pressed.Enter) startGame('cpu', { cpus: cpuOpt.n, skill: cpuOpt.skill });
    if (U.button('bk', 358, 556, 122, 50, 'BACK', { ghost: true, size: 15, sfx: 'back' }) || U.pressed.Escape) sub = 'main';
  } else if (sub === 'party') {
    U.panel(84, 320, 470, 340);
    U.txt('Party', 108, 340, 22, '#fff', 'left', { head: true, weight: 800 });
    U.txt('Take turns on one computer or phone.', 108, 374, 13, '#94a3b8', 'left', { weight: 600 });
    [2, 3, 4].forEach(n => { if (U.button('pc' + n, 108 + (n - 2) * 140, 400, 128, 44, n + ' players', party.count === n ? { color: '#f59e0b', size: 14 } : { ghost: true, size: 14, sfx: 'tab' })) party.count = n; });
    for (let i = 0; i < party.count; i++) {
      const st = party.st = party.st || [0, 1, 2, 3].map(k => ({ value: party.names[k], max: 12 }));
      ctx.fillStyle = PCOLS[i]; ctx.beginPath(); ctx.arc(120, 478 + i * 36, 7, 0, 7); ctx.fill();
      U.input('nm' + i, 136, 460 + i * 36, 250, 32, st[i], 'Player ' + (i + 1));
      party.names[i] = st[i].value || 'Player ' + (i + 1);
    }
    if (U.button('go', 400, 460, 130, 50, 'START', { color: '#22c55e', size: 16 })) startGame('party', { count: party.count, names: party.names.slice() });
    if (U.button('bk', 400, 520, 130, 44, 'BACK', { ghost: true, size: 14, sfx: 'back' }) || (U.pressed.Escape && !U.typing)) sub = 'main';
  }
}

// ------------------------------------------------------------ loop
let last = 0, paused = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
  if (screen === 'title') drawTitle(dt);
  else if (screen === 'card') drawCard(dt);
  else {
    if (!paused) update(dt);
    drawPlay(dt); drawHUD();
    if (paused) {
      ctx.fillStyle = 'rgba(4,8,6,0.6)'; ctx.fillRect(0, 0, W, H); U.panel(W / 2 - 210, 210, 420, 300);
      U.txt('Paused', W / 2, 236, 34, '#fff', 'center', { head: true, weight: 800 });
      if (U.button('res', W / 2 - 170, 300, 340, 54, 'RESUME', { color: '#22c55e' }) || U.pressed.Escape) paused = false;
      else if (U.button('gd', W / 2 - 170, 366, 340, 44, `AIM GUIDE: ${save.guide ? 'ON' : 'OFF'}`, { ghost: true, size: 14, sfx: 'tab' })) { save.guide = !save.guide; store(); }
      else if (U.button('quit', W / 2 - 170, 422, 340, 48, 'QUIT TO MENU', { ghost: true, size: 15, sfx: 'back' })) { paused = false; screen = 'title'; game = null; }
    } else if (U.pressed.Escape) paused = true;
  }
  wasDown = U.down;
  U.endFrame();
  requestAnimationFrame(frame);
}
const fontReady = document.fonts ? Promise.race([document.fonts.load(`800 40px 'Plus Jakarta Sans'`), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
fontReady.then(() => requestAnimationFrame(n => { last = n; frame(n); }));
Sound.playSong(SONGS.golf);

// test hooks
window.__golf = {
  get game() { return game; }, get hole() { return hole; }, get screen() { return screen; }, set screen(v) { screen = v; }, get holeT() { return holeT; },
  startGame, loadHole, shoot, simShot, update, cpuThink, nextTurn, save: () => save,
  playCpuHole() { const p = cur(); const it = cpuThink(p); let r; do { r = it.next(); } while (!r.done); return r.value; },
};
// owner cheats (shown only for the site admin, see account/cheats.js)
const inPlay = () => screen === 'play' && game && game.phase === 'aim' && !cur().cpu ? '' : 'Wait for your turn on a hole';
window.__cheats = [
  { name: 'Sink this putt', icon: '⛳', need: inPlay, run() { const p = cur(), b = p.ball; p.strokes++; b.x = hole.d.cup[0]; b.y = hole.d.cup[1]; onEvent(p, 'sink'); } },
  { name: 'Skip to the last hole', icon: '⏭', need: () => screen === 'play' && game ? '' : 'Start a round first', run() { game.players.forEach(p => { for (let i = 0; i < 8; i++) if (!p.scores[i]) p.scores[i] = HOLES[i].par; }); loadHole(8); } },
  { name: 'Aim guide shows the whole putt', icon: '🔭', toggle: () => !!window.__golfLong, run() { window.__golfLong = !window.__golfLong; } },
];
// touch: the canvas drag already works; only show the rotate hint
if (window.TouchPad) TouchPad.setup({ active: () => false });
})();
