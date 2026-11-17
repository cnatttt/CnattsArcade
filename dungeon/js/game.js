// =====================================================================
//  NIGHTFALL DEPTHS - a dark fantasy dungeon roguelike
//  WASD move | Mouse aim + click attack (or ARROW keys) | Right click / K special
//  SPACE / SHIFT dodge roll | Q drink potion | ESC pause
// =====================================================================
(() => {
'use strict';
const W = 1280, H = 720, LW = 320, LH = 180, S = 4, TS = 16, RW = 17, RH = 11;
const RX = (LW - RW * TS) / 2, RY = (LH - RH * TS) / 2;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const lo = document.createElement('canvas'); lo.width = LW; lo.height = LH;
const lx = lo.getContext('2d');
const dark = document.createElement('canvas'); dark.width = LW; dark.height = LH;
const dx = dark.getContext('2d');
const FONT = '"Press Start 2P", monospace';

// ------------------------------------------------------------ helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = n => Math.floor(n).toLocaleString('en-US');
let rng = Math.random;
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = (a, b) => a + Math.random() * (b - a);
const rrand = (a, b) => a + rng() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const rpick = a => a[Math.floor(rng() * a.length)];
function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(h, a) { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, f) { const c = hex(h); const k = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255); return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`; }

// ------------------------------------------------------------ sprites
const SPR = {};
function buildSprite(rows, pal, tint) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    let col = pal[ch]; if (!col) return;
    if (tint && ch !== 'o' && ch !== 'e') { const a = hex(col), b = hex(tint); col = `rgb(${(a[0] + b[0] * 2) / 3 | 0},${(a[1] + b[1] * 2) / 3 | 0},${(a[2] + b[2] * 2) / 3 | 0})`; }
    x.fillStyle = col; x.fillRect(i, j, 1, 1);
  }));
  return c;
}
function white(c) { const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; const x = n.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, n.width, n.height); return n; }
function sprite(name, tint) {
  const key = name + (tint || '');
  if (!SPR[key]) { const d = SPR_DEF[name]; SPR[key] = buildSprite(d.rows, d.pal, tint); SPR[key + '_w'] = white(SPR[key]); }
  return SPR[key];
}
const ICONS = {};
function relicIcon(r) {
  if (!ICONS[r.id]) ICONS[r.id] = buildSprite(ICON_SHAPES[r.icon] || ICON_SHAPES.gem, { o: '#0a0610', a: r.col[0], b: r.col[1], c: r.col[2] });
  return ICONS[r.id];
}

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_nightfall';
const freshSave = () => ({ souls: 0, up: {}, classes: ['knight'], seenRelics: {}, seenEnemies: {}, runs: 0, wins: 0, bestFloor: 0, kills: 0, daily: {}, tutorial: false });
let save = freshSave();
try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) save = Object.assign(freshSave(), d); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const upLvl = id => save.up[id] || 0;

// ------------------------------------------------------------ input
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false, right: false };
const UI = { click: null, down: false, px: 0, py: 0, hover: null, lastHover: null };
let usingMouse = true;
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return; keys[e.code] = true;
  if (e.code.startsWith('Arrow')) usingMouse = false;
  if (e.code === 'Escape') { if (screen === 'play') pause(); else if (screen === 'pause') resume(); else if (['sanctum', 'codex', 'classes'].includes(screen)) goMenu(); }
  if (screen === 'play' && (e.code === 'KeyQ' || e.code === 'KeyF')) drinkPotion();
  if (e.code === 'KeyM') Sound.setMusic(!Sound.musicOn);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; mouse.right = false; });
function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('contextmenu', e => e.preventDefault());
const touch = { on: false, sticks: new Map() };
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  const [x, y] = toCanvas(e); mouse.x = x; mouse.y = y; UI.down = true; UI.px = x; UI.py = y;
  if (e.pointerType === 'touch') { touch.on = true; if (screen === 'play') { touchDown(e.pointerId, x, y); return; } }
  else usingMouse = true;
  if (e.button === 2) mouse.right = true; else mouse.down = true;
});
cv.addEventListener('pointermove', e => { const [x, y] = toCanvas(e); mouse.x = x; mouse.y = y; if (e.pointerType !== 'touch') usingMouse = true; const s = touch.sticks.get(e.pointerId); if (s) { s.x = x; s.y = y; } });
cv.addEventListener('pointerup', e => {
  const [x, y] = toCanvas(e); UI.down = false; UI.click = { x, y, px: UI.px, py: UI.py };
  if (e.button === 2) mouse.right = false; else mouse.down = false;
  touch.sticks.delete(e.pointerId);
});
cv.addEventListener('pointercancel', e => { touch.sticks.delete(e.pointerId); mouse.down = false; UI.down = false; });
const TBTN = { dodge: { x: W - 130, y: H - 250, r: 50 }, special: { x: W - 250, y: H - 140, r: 46 }, potion: { x: W - 110, y: H - 360, r: 36 } };
const touchTap = { dodge: false, special: false };
function touchDown(id, x, y) {
  for (const k in TBTN) { const b = TBTN[k]; if (Math.hypot(x - b.x, y - b.y) < b.r) { if (k === 'potion') drinkPotion(); else touchTap[k] = true; return; } }
  touch.sticks.set(id, { side: x < W / 2 ? 'move' : 'aim', ox: x, oy: y, x, y });
}
function stick(side) { for (const s of touch.sticks.values()) if (s.side === side) { const ddx = s.x - s.ox, ddy = s.y - s.oy, d = Math.hypot(ddx, ddy); if (d > 12) return { x: ddx / Math.max(d, 60), y: ddy / Math.max(d, 60), on: true }; return { x: 0, y: 0, on: true }; } return null; }

// ------------------------------------------------------------ state
let screen = 'loading';     // loading menu classes sanctum codex play pause dead victory
let t = 0, run = null, room = null, P = null;
let enemies = [], shots = [], pickups = [], parts = [], nums = [], hazards = [], beams = [], chests = [], fx = [];
let shake = 0, hitstop = 0, slowmo = 1, transition = null, banner = null, toastQ = [], flashW = 0;
let menuSel = 0, classSel = 0, dailyMode = false;

// ------------------------------------------------------------ dungeon generation
const LAYOUTS = [
  ['...............', '...............', '...............', '...............', '...............', '...............', '...............', '...............', '...............'],
  ['...............', '...............', '...#.......#...', '...............', '...............', '...............', '...#.......#...', '...............', '...............'],
  ['...............', '..##.......##..', '..#.........#..', '...............', '.......x.......', '...............', '..#.........#..', '..##.......##..', '...............'],
  ['...............', '...............', '.....ppppp.....', '....pp...pp....', '....p.....p....', '....pp...pp....', '.....ppppp.....', '...............', '...............'],
  ['...............', '.x...........x.', '...###...###...', '...............', '...............', '...............', '...###...###...', '.x...........x.', '...............'],
  ['...............', '...............', '..p.p.p.p.p.p..', '...............', '...............', '...............', '..p.p.p.p.p.p..', '...............', '...............'],
  ['xx...........xx', 'x.............x', '.....#...#.....', '...............', '.......#.......', '...............', '.....#...#.....', 'x.............x', 'xx...........xx'],
  ['...............', '.###.......###.', '.#...........#.', '.#...........#.', '...............', '.#...........#.', '.#...........#.', '.###.......###.', '...............'],
  ['...............', '...............', '...pppp.pppp...', '...p.......p...', '...............', '...p.......p...', '...pppp.pppp...', '...............', '...............'],
  ['...............', '....x.....x....', '..#.........#..', '.......#.......', '......###......', '.......#.......', '..#.........#..', '....x.....x....', '...............'],
  ['...............', '..##.......##..', '...............', '.....#...#.....', '...............', '.....#...#.....', '...............', '..##.......##..', '...............'],
  ['ppp.........ppp', 'pp...........pp', 'p......x......p', '...............', '...............', '...............', 'p......x......p', 'pp...........pp', 'ppp.........ppp'],
];
const DIRS = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
const OPP = { n: 's', s: 'n', w: 'e', e: 'w' };
function genFloor(fi) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const rooms = {}, key = (x, y) => x + ',' + y;
    const target = 8 + Math.min(fi, 6) + Math.floor(rng() * 3);
    rooms[key(4, 4)] = { x: 4, y: 4 };
    const list = [rooms[key(4, 4)]];
    let guard = 0;
    while (list.length < target && guard++ < 500) {
      const base = rpick(list), [ddx, ddy] = DIRS[rpick(['n', 's', 'w', 'e'])];
      const nx = base.x + ddx, ny = base.y + ddy;
      if (nx < 0 || ny < 0 || nx > 8 || ny > 8 || rooms[key(nx, ny)]) continue;
      const nb = ['n', 's', 'w', 'e'].filter(d => rooms[key(nx + DIRS[d][0], ny + DIRS[d][1])]).length;
      if (nb > 1 || (rng() < 0.5 && list.length > 3 && nb > 0 && list.filter(r => Math.abs(r.x - nx) + Math.abs(r.y - ny) === 1).length > 1)) continue;
      const r = { x: nx, y: ny }; rooms[key(nx, ny)] = r; list.push(r);
    }
    list.forEach(r => { r.doors = {}; for (const d in DIRS) if (rooms[key(r.x + DIRS[d][0], r.y + DIRS[d][1])]) r.doors[d] = true; });
    // distances from start
    const distTo = {}; const q = [list[0]]; distTo[key(4, 4)] = 0;
    while (q.length) { const r = q.shift(); for (const d in r.doors) { const n = rooms[key(r.x + DIRS[d][0], r.y + DIRS[d][1])]; if (distTo[key(n.x, n.y)] === undefined) { distTo[key(n.x, n.y)] = distTo[key(r.x, r.y)] + 1; q.push(n); } } }
    const ends = list.filter((r, i) => i > 0 && Object.keys(r.doors).length === 1).sort((a, b) => distTo[key(b.x, b.y)] - distTo[key(a.x, a.y)]);
    if (ends.length < 3) continue;
    list.forEach(r => { r.type = 'normal'; });
    list[0].type = 'start';
    ends[0].type = 'boss'; ends[1].type = 'treasure'; ends[2].type = 'shop';
    if (ends[3] && rng() < 0.6) ends[3].type = 'altar';
    list.forEach(r => {
      r.cleared = r.type !== 'normal' && r.type !== 'boss'; r.visited = false; r.seen = false;
      r.layout = (r.type === 'normal') ? makeLayout(r) : LAYOUTS[0].map(s => s.split(''));
      r.decoSeed = Math.floor(rng() * 1e9); r.cv = null; r.decal = null; r.contents = null;
    });
    return { rooms, list, key };
  }
  throw new Error('floor gen failed');
}
function makeLayout(r) {
  for (let k = 0; k < 10; k++) {
    let L = rpick(LAYOUTS).map(s => s.split(''));
    if (rng() < 0.5) L = L.map(row => row.slice().reverse());
    if (rng() < 0.5) L = L.slice().reverse();
    // keep doorways clear
    [[7, 0], [7, 1], [7, 8], [7, 7], [0, 4], [1, 4], [14, 4], [13, 4]].forEach(([c, rr]) => { L[rr][c] = '.'; });
    if (layoutOK(L, r)) return L;
  }
  return LAYOUTS[0].map(s => s.split(''));
}
function layoutOK(L, r) {
  const ok = (c, rr) => c >= 0 && rr >= 0 && c < 15 && rr < 9 && L[rr][c] === '.';
  const start = [7, 4]; if (!ok(...start)) return false;
  const seen = new Set([start + '']), q = [start];
  while (q.length) { const [c, rr] = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const n = [c + a, rr + b]; if (ok(...n) && !seen.has(n + '')) { seen.add(n + ''); q.push(n); } }); }
  const need = { n: [7, 0], s: [7, 8], w: [0, 4], e: [14, 4] };
  return Object.keys(r.doors).every(d => seen.has(need[d] + ''));
}

// ------------------------------------------------------------ room tiles
// room-space pixel coords: (0,0) top-left of the outer wall; interior tiles are 1..15 x 1..9
function tileAt(c, r) {
  if (c < 0 || r < 0 || c >= RW || r >= RH) return '#';
  if (c === 0 || r === 0 || c === RW - 1 || r === RH - 1) {
    const isDoor = (r === 0 && c === 8 && room.doors.n) || (r === RH - 1 && c === 8 && room.doors.s) || (c === 0 && r === 5 && room.doors.w) || (c === RW - 1 && r === 5 && room.doors.e);
    return isDoor ? (doorsOpen() ? 'D' : '#') : '#';
  }
  return room.layout[r - 1][c - 1];
}
const solidFor = (ch, fly) => ch === '#' || ch === 'x' || (!fly && ch === 'p');
function blocked(x, y, rad, fly) {
  const c0 = Math.floor((x - rad) / TS), c1 = Math.floor((x + rad) / TS), r0 = Math.floor((y - rad) / TS), r1 = Math.floor((y + rad) / TS);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solidFor(tileAt(c, r), fly)) return true;
  return false;
}
function moveEnt(e, mx, my, fly, ghost) {
  if (ghost) { e.x = clamp(e.x + mx, TS + e.r, (RW - 1) * TS - e.r); e.y = clamp(e.y + my, TS + e.r, (RH - 1) * TS - e.r); return; }
  if (!blocked(e.x + mx, e.y, e.r, fly)) e.x += mx; else { e.hitWall = true; }
  if (!blocked(e.x, e.y + my, e.r, fly)) e.y += my; else { e.hitWall = true; }
}
const doorsOpen = () => room && room.cleared;

// flow field toward the player (for walking monsters)
let flow = null, flowT = 0;
function buildFlow() {
  const f = Array.from({ length: RH }, () => new Array(RW).fill(1e9));
  const pc = Math.floor(P.x / TS), pr = Math.floor(P.y / TS);
  if (pc < 1 || pr < 1 || pc > RW - 2 || pr > RH - 2) { flow = f; return; }
  f[pr][pc] = 0; const q = [[pc, pr]];
  for (let h = 0; h < q.length; h++) {
    const [c, r] = q[h];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + a, nr = r + b;
      if (nc < 1 || nr < 1 || nc > RW - 2 || nr > RH - 2 || solidFor(tileAt(nc, nr), false)) continue;
      if (f[nr][nc] > f[r][c] + 1) { f[nr][nc] = f[r][c] + 1; q.push([nc, nr]); }
    }
  }
  flow = f;
}
function flowDir(e) {
  const c = Math.floor(e.x / TS), r = Math.floor(e.y / TS);
  if (!flow || !flow[r] || flow[r][c] >= 1e9 || flow[r][c] <= 1) return { x: P.x - e.x, y: P.y - e.y };
  let best = null, bd = flow[r][c];
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const nc = c + a, nr = r + b; if (!flow[nr] || flow[nr][nc] === undefined) continue;
    if (a && b && (solidFor(tileAt(c + a, r), false) || solidFor(tileAt(c, r + b), false))) continue;
    if (flow[nr][nc] < bd) { bd = flow[nr][nc]; best = [nc, nr]; }
  }
  if (!best) return { x: P.x - e.x, y: P.y - e.y };
  return { x: best[0] * TS + 8 - e.x, y: best[1] * TS + 8 - e.y };
}

// ------------------------------------------------------------ room rendering (cached)
// per-theme look for the room renderer
const LOOK = {
  bones:     { floor: '#3a3446', floor2: '#332e3e', mortar: '#16121e', brick: '#4e4560', brick2: '#443c56', cap: '#6e6488', capD: '#2a2436', ao: '#08050e', tint: '#0a0618', pillar: 'stone', pit: 'void',  moss: null,      lightCol: '#ffb050' },
  mushrooms: { floor: '#2e3a2e', floor2: '#283228', mortar: '#101810', brick: '#3e4a36', brick2: '#36422e', cap: '#5e6e4c', capD: '#1e281a', ao: '#050a04', tint: '#06100a', pillar: 'rock',  pit: 'void',  moss: '#3a6a2a', lightCol: '#ff9ac0' },
  ice:       { floor: '#3a4a64', floor2: '#34425a', mortar: '#18223a', brick: '#5a7496', brick2: '#4e6888', cap: '#b8d8f0', capD: '#2a3e58', ao: '#060c18', tint: '#060c1c', pillar: 'ice',   pit: 'water', moss: null,      lightCol: '#a8e8ff' },
  lava:      { floor: '#3e2c28', floor2: '#362622', mortar: '#140a08', brick: '#5a3228', brick2: '#4e2a22', cap: '#7a4a3a', capD: '#2a140e', ao: '#0a0402', tint: '#140604', pillar: 'basalt', pit: 'lava', moss: null,      lightCol: '#ff8a3a' },
  void:      { floor: '#2a1e3e', floor2: '#241a36', mortar: '#0c0618', brick: '#3c2a5c', brick2: '#342450', cap: '#5c4484', capD: '#1a1030', ao: '#04020a', tint: '#08041a', pillar: 'crystal', pit: 'void', moss: null,      lightCol: '#c46cff' },
};
const look = () => LOOK[run.theme.deco];

function renderRoom(rm) {
  const L = LOOK[run.theme.deco], R = seeded(rm.decoSeed), Wd = RW * TS, Hd = RH * TS;
  const c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
  const x = c.getContext('2d');
  const img = x.createImageData(Wd, Hd), D = img.data;
  const set = (px_, py_, col, a = 1) => {
    if (px_ < 0 || py_ < 0 || px_ >= Wd || py_ >= Hd) return;
    const i = (py_ * Wd + px_) * 4;
    D[i] = D[i] * (1 - a) + col[0] * a; D[i + 1] = D[i + 1] * (1 - a) + col[1] * a; D[i + 2] = D[i + 2] * (1 - a) + col[2] * a; D[i + 3] = 255;
  };
  const C = h => hex(h);
  const vary = (col, v) => [clamp(col[0] + v, 0, 255), clamp(col[1] + v, 0, 255), clamp(col[2] + v, 0, 255)];
  const prevRoom = room; room = rm;
  const lay = (cc, r) => (cc < 1 || r < 1 || cc > RW - 2 || r > RH - 2) ? '#' : rm.layout[r - 1][cc - 1];
  // ---------- floor: irregular flagstones
  const F1 = C(L.floor), F2 = C(L.floor2), MO = C(L.mortar);
  for (let r = 1; r < RH - 1; r++) for (let cc = 1; cc < RW - 1; cc++) {
    const px0 = cc * TS, py0 = r * TS;
    const split = Math.floor(R() * 5);           // 0 full, 1 horiz, 2 vert, 3 quad, 4 full
    const stones = split === 1 ? [[0, 0, 16, 8], [0, 8, 16, 8]] : split === 2 ? [[0, 0, 8, 16], [8, 0, 8, 16]] : split === 3 ? [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]] : [[0, 0, 16, 16]];
    stones.forEach(([sx, sy, sw, sh]) => {
      const base = vary(R() < 0.5 ? F1 : F2, Math.floor(R() * 14 - 7));
      const cracked = R() < 0.12;
      for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) {
        const X = px0 + sx + xx, Y = py0 + sy + yy;
        if (xx === sw - 1 || yy === sh - 1) { set(X, Y, MO); continue; }
        let col = base;
        if (xx === 0 || yy === 0) col = vary(base, 10);
        else if (xx === sw - 2 || yy === sh - 2) col = vary(base, -9);
        else { const n = R(); if (n < 0.08) col = vary(base, -6); else if (n > 0.95) col = vary(base, 6); }
        set(X, Y, col);
      }
      if (cracked) { let cx = px0 + sx + 2 + Math.floor(R() * (sw - 4)), cy = py0 + sy + 1; for (let k = 0; k < sh - 3; k++) { set(cx, cy + k, MO, 0.8); if (R() < 0.4) cx += R() < 0.5 ? 1 : -1; } }
    });
  }
  // moss / dirt patches
  if (L.moss) for (let k = 0; k < 7; k++) {
    const cx = 2 * TS + R() * (RW - 4) * TS, cy = 2 * TS + R() * (RH - 4) * TS, rad = 6 + R() * 12;
    for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) { const d = Math.hypot(xx, yy) / rad; if (d < 1 && R() < (1 - d) * 0.7) set(Math.round(cx + xx), Math.round(cy + yy), vary(C(L.moss), Math.floor(R() * 20 - 10)), 0.75); }
  }
  // ---------- ambient occlusion along walls and under obstacles
  const AO = C(L.ao);
  for (let r = 1; r < RH - 1; r++) for (let cc = 1; cc < RW - 1; cc++) {
    const px0 = cc * TS, py0 = r * TS;
    for (let yy = 0; yy < TS; yy++) for (let xx = 0; xx < TS; xx++) {
      let a = 0;
      if (lay(cc, r - 1) === '#' || r === 1) a = Math.max(a, (1 - yy / 9) * 0.55);
      if (lay(cc - 1, r) === '#' || cc === 1) a = Math.max(a, (1 - xx / 6) * 0.4);
      if (lay(cc + 1, r) === '#' || cc === RW - 2) a = Math.max(a, (1 - (15 - xx) / 6) * 0.4);
      if (lay(cc, r + 1) === '#' && r < RH - 2) a = Math.max(a, (1 - (15 - yy) / 4) * 0.25);
      if (a > 0) set(px0 + xx, py0 + yy, AO, a);
    }
  }
  // ---------- walls
  const BR = C(L.brick), BR2 = C(L.brick2), CAP = C(L.cap), CAPD = C(L.capD);
  // top wall: cap + tall brick face
  for (let xx = 0; xx < Wd; xx++) {
    for (let yy = 0; yy < 4; yy++) set(xx, yy, yy === 3 ? vary(CAP, 18) : vary(CAPD, yy * 6));
  }
  for (let row = 0; row < 3; row++) {
    const yy0 = 4 + row * 4, off = row % 2 ? 4 : 0;
    for (let bx = -off; bx < Wd; bx += 8) {
      const bc = vary(R() < 0.5 ? BR : BR2, Math.floor(R() * 16 - 8));
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 8; xx++) {
        const X = bx + xx, Y = yy0 + yy;
        if (xx === 7 || yy === 3) set(X, Y, MO);
        else set(X, Y, yy === 0 ? vary(bc, 14) : (xx === 6 ? vary(bc, -10) : (R() < 0.1 ? vary(bc, -8) : bc)));
      }
    }
  }
  // side + bottom walls: thick stone tops with an inner lip
  const capTile = (X0, Y0, w, h, lip) => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      let col = vary(CAPD, Math.floor(R() * 8 - 4));
      if ((xx + Math.floor((Y0 + yy) / 6) * 3) % 9 === 0 || (Y0 + yy) % 6 === 0) col = vary(MO, 4);
      set(X0 + xx, Y0 + yy, col);
    }
    lip();
  };
  capTile(0, TS, TS, Hd - TS, () => { for (let yy = TS; yy < Hd - TS; yy++) { set(TS - 2, yy, vary(CAP, -10)); set(TS - 1, yy, CAP); } });
  capTile(Wd - TS, TS, TS, Hd - TS, () => { for (let yy = TS; yy < Hd - TS; yy++) { set(Wd - TS, yy, CAP); set(Wd - TS + 1, yy, vary(CAP, -10)); } });
  capTile(TS, Hd - TS, Wd - 2 * TS, TS, () => { for (let xx = TS - 1; xx < Wd - TS + 1; xx++) { set(xx, Hd - TS, CAP); set(xx, Hd - TS + 1, vary(CAP, -14)); } });
  for (let yy = 0; yy < TS; yy++) for (let xx = 0; xx < TS; xx++) { set(xx, yy, vary(CAPD, -6)); set(Wd - 1 - xx, yy, vary(CAPD, -6)); set(xx, Hd - 1 - yy, vary(CAPD, -6)); set(Wd - 1 - xx, Hd - 1 - yy, vary(CAPD, -6)); }
  x.putImageData(img, 0, 0);

  // ---------- obstacles, pits, decor (drawn with canvas)
  const P_ = (X, Y, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), w, h); };
  for (let r = 1; r < RH - 1; r++) for (let cc = 1; cc < RW - 1; cc++) {
    const ch = lay(cc, r), X = cc * TS, Y = r * TS;
    if (ch === 'p') drawPit(x, P_, X, Y, lay(cc, r - 1) !== 'p', lay(cc - 1, r) !== 'p', lay(cc + 1, r) !== 'p', L);
  }
  for (let r = 1; r < RH - 1; r++) for (let cc = 1; cc < RW - 1; cc++) {
    if (lay(cc, r) === '#') drawPillar(x, P_, cc * TS, r * TS, L, R);
  }
  rm.lights = [];
  drawDecor(x, P_, rm, L, R, lay);
  // torches: wall sconces on the top wall (and the sides in boss rooms)
  rm.torches = [[3.5, 0], [13.5, 0]].map(([cc]) => ({ x: cc * TS, y: 9 }));
  if (rm.type === 'boss' || rm.type === 'treasure') rm.torches.push({ x: 8.5 * TS - 40, y: 9 }, { x: 8.5 * TS + 40, y: 9 });
  rm.torches.forEach(tc => { P_(tc.x - 3, tc.y + 1, '#1a120c', 6, 2); P_(tc.x - 2, tc.y + 3, '#2a1a10', 4, 2); P_(tc.x - 1, tc.y + 5, '#1a120c', 2, 3); P_(tc.x - 3, tc.y + 1, '#5a4a3a', 6, 1); });
  // special room floors
  if (rm.type === 'shop') {
    P_(4 * TS + 2, 3 * TS + 2, '#2a0a14', 9 * TS - 4, 4 * TS - 4); P_(4 * TS, 3 * TS, '#5a1a2a', 9 * TS - 4, 4 * TS - 4);
    for (let k = 0; k < 9 * TS - 4; k += 4) { P_(4 * TS + k, 3 * TS, '#e8c060', 2, 1); P_(4 * TS + k, 7 * TS - 5, '#e8c060', 2, 1); }
    for (let yy = 3 * TS + 4; yy < 7 * TS - 6; yy += 6) for (let k = 4 * TS + 4; k < 13 * TS - 8; k += 12) P_(k + ((yy / 6) % 2) * 6, yy, '#7a2a3a', 3, 3);
    rm.lights.push({ x: 8.5 * TS, y: 3 * TS, r: 50, col: '#ffcc66', a: 0.7 });
  }
  if (rm.type === 'treasure') {
    for (let k = 0; k < 360; k += 6) { const a = k * Math.PI / 180; P_(8.5 * TS + Math.cos(a) * 46, 5.5 * TS + Math.sin(a) * 26, '#c8a040'); }
    rm.lights.push({ x: 8.5 * TS, y: 5.5 * TS, r: 70, col: '#ffcc66', a: 0.6 });
  }
  if (rm.type === 'boss') {
    for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 360; k += 3) { const a = k * Math.PI / 180, rr = 38 + ring * 18; P_(8.5 * TS + Math.cos(a) * rr * 1.6, 5.5 * TS + Math.sin(a) * rr, ring ? 'rgba(160,20,40,0.35)' : 'rgba(200,30,50,0.45)'); }
  }
  if (rm.type === 'altar') rm.lights.push({ x: 8.5 * TS, y: 5 * TS, r: 50, col: '#ff3a4a', a: 0.6 });
  room = prevRoom;
  rm.cv = c;
  rm.decal = document.createElement('canvas'); rm.decal.width = Wd; rm.decal.height = Hd;
}
function drawPit(x, P_, X, Y, topEdge, leftEdge, rightEdge, L) {
  if (L.pit === 'lava') {
    P_(X, Y, '#c83a0a', TS, TS);
    for (let k = 0; k < 6; k++) P_(X + (k * 5) % 14, Y + 3 + (k * 7) % 11, '#ff8a1a', 3, 1);
    if (topEdge) { P_(X, Y, '#2a140e', TS, 3); P_(X, Y + 3, '#5a1a08', TS, 2); }
  } else if (L.pit === 'water') {
    P_(X, Y, '#0e2440', TS, TS);
    for (let k = 0; k < 4; k++) P_(X + (k * 6) % 13, Y + 4 + (k * 5) % 10, '#2a5a8a', 4, 1);
    if (topEdge) { P_(X, Y, '#c8e8ff', TS, 2); P_(X, Y + 2, '#5a7a9a', TS, 2); }
  } else {
    P_(X, Y, '#020104', TS, TS);
    if (topEdge) { P_(X, Y, shade(L.floor, -0.35), TS, 3); P_(X, Y + 3, shade(L.floor, -0.6), TS, 3); P_(X, Y + 6, '#08050c', TS, 2); }
  }
  if (leftEdge) P_(X, Y, 'rgba(0,0,0,0.35)', 2, TS);
  if (rightEdge) P_(X + TS - 2, Y, 'rgba(0,0,0,0.35)', 2, TS);
}
function drawPillar(x, P_, X, Y, L, R) {
  // shadow
  x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.ellipse(X + 9, Y + 15, 9, 3, 0, 0, 6.3); x.fill();
  const kind = L.pillar;
  if (kind === 'ice') {
    P_(X + 1, Y - 3, '#6a9ac0', 14, 18); P_(X + 2, Y - 2, '#a8d8f0', 12, 16); P_(X + 2, Y - 2, '#e8f8ff', 12, 4);
    P_(X + 3, Y + 3, '#ffffff', 1, 6); P_(X + 5, Y + 1, '#ffffff', 1, 3); P_(X + 11, Y + 6, '#7ab0d8', 2, 8); P_(X + 2, Y + 12, '#5a8ab0', 12, 2);
    return;
  }
  if (kind === 'crystal') {
    P_(X + 2, Y + 8, '#1a1030', 12, 7); P_(X + 3, Y + 9, '#2a1a48', 10, 5);
    [[4, -4, 3, 13, '#7a3ad0', '#d8a8ff'], [8, -8, 3, 17, '#9a4ae0', '#f0d8ff'], [11, -1, 2, 10, '#6a2ab0', '#c8a0ff']].forEach(([a, b, w, h, c1, c2]) => { P_(X + a, Y + b, c1, w, h); P_(X + a, Y + b, c2, 1, h); P_(X + a, Y + b - 1, c2, w - 1, 1); });
    return;
  }
  const top = { stone: '#7a7090', rock: '#6a7a58', basalt: '#5a4a48' }[kind], face = { stone: '#4e4560', rock: '#46523a', basalt: '#3a2c2a' }[kind], dark = { stone: '#2a2436', rock: '#222a1a', basalt: '#1a1010' }[kind];
  if (kind === 'rock') {
    x.fillStyle = dark; x.beginPath(); x.ellipse(X + 8, Y + 8, 8, 8, 0, 0, 6.3); x.fill();
    x.fillStyle = face; x.beginPath(); x.ellipse(X + 8, Y + 7, 7, 7, 0, 0, 6.3); x.fill();
    x.fillStyle = top; x.beginPath(); x.ellipse(X + 7, Y + 4, 5, 4, 0, 0, 6.3); x.fill();
    P_(X + 3, Y + 2, '#3a6a2a', 6, 2); P_(X + 9, Y + 1, '#4a8a3a', 4, 2);
    if (R() < 0.6) { P_(X + 11, Y - 1, '#e8dcc8', 1, 3); P_(X + 10, Y - 2, '#ff6a8a', 3, 1); }
    return;
  }
  // stone / basalt block: lit top face + bricked front face
  P_(X, Y - 4, dark, 16, 20);
  P_(X + 1, Y - 4, top, 14, 7); P_(X + 1, Y - 4, shade(top, 0.2), 14, 1);
  P_(X + 1, Y + 3, face, 14, 12);
  for (let k = 0; k < 3; k++) { P_(X + 1, Y + 6 + k * 3, dark, 14, 1); P_(X + 1 + ((k % 2) ? 4 : 9), Y + 3 + k * 3, dark, 1, 3); }
  P_(X + 1, Y + 3, shade(face, 0.15), 14, 1);
  if (kind === 'basalt') { P_(X + 4, Y + 8, '#ff6a1a', 1, 4); P_(X + 5, Y + 11, '#ff6a1a', 3, 1); P_(X + 10, Y + 5, '#ffa040', 1, 3); }
  else if (R() < 0.35) { P_(X + 6, Y - 2, '#e8e4d8', 4, 3); P_(X + 6, Y - 1, '#2a2030', 1, 1); P_(X + 8, Y - 1, '#2a2030', 1, 1); }
}
function drawDecor(x, P_, rm, L, R, lay) {
  const deco = run.theme.deco, free = (cc, r) => lay(cc, r) === '.';
  const spot = () => { for (let k = 0; k < 30; k++) { const cc = 1 + Math.floor(R() * 15), r = 1 + Math.floor(R() * 9); if (free(cc, r) && !(Math.abs(cc - 8.5) < 2 && (r <= 2 || r >= 8)) && !(Math.abs(r - 5) < 1.5 && (cc <= 2 || cc >= 14))) return [cc * TS + 2 + Math.floor(R() * 10), r * TS + 3 + Math.floor(R() * 9)]; } return null; };
  // cobwebs in the top corners
  if (deco !== 'lava') [[TS, TS, 1], [(RW - 1) * TS - 1, TS, -1]].forEach(([cx, cy, s]) => {
    x.strokeStyle = 'rgba(220,220,235,0.35)'; x.lineWidth = 1;
    for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + s * (14 - k * 3), cy + k * 4); x.stroke(); }
    for (let k = 1; k < 4; k++) { x.beginPath(); x.arc(cx, cy, k * 4, s > 0 ? 0 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI); x.stroke(); }
  });
  // wall hangings on the top wall face
  const hangs = Math.floor(R() * 2) + 1;
  for (let k = 0; k < hangs; k++) {
    const hx = (k === 0 ? 6 : 11) * TS + Math.floor(R() * 8);
    if (deco === 'bones' || deco === 'void') { const col = deco === 'void' ? '#4a1a6a' : '#6a1a2a'; P_(hx, 4, '#2a1a10', 8, 1); P_(hx, 5, col, 8, 10); P_(hx, 5, shade(col, 0.2), 8, 1); P_(hx + 3, 8, deco === 'void' ? '#c46cff' : '#e8c060', 2, 3); P_(hx, 15, col, 2, 1); P_(hx + 3, 15, col, 2, 1); P_(hx + 6, 15, col, 2, 1); }
    else if (deco === 'ice') { for (let j = 0; j < 6; j++) { const ix = hx + j * 3, len = 2 + Math.floor(R() * 6); P_(ix, 15, '#e8f8ff', 2, 1); P_(ix, 16, '#c8e8ff', 1, len); } }
    else if (deco === 'lava') { P_(hx + 3, 4, '#3a3a44', 1, 9); P_(hx + 2, 13, '#5a5a66', 3, 2); P_(hx + 1, 15, '#3a3a44', 5, 1); }
    else if (deco === 'mushrooms') { for (let j = 0; j < 5; j++) P_(hx + j * 2, 14 + Math.floor(R() * 3), '#2a4a1a', 1, 3 + Math.floor(R() * 4)); }
  }
  // floor details per theme
  const n = 10 + Math.floor(R() * 6);
  for (let k = 0; k < n; k++) {
    const s = spot(); if (!s) continue; const [px0, py0] = s;
    const roll = R();
    if (deco === 'bones') {
      if (roll < 0.35) { P_(px0, py0, '#c8c4b8', 6, 1); P_(px0 - 1, py0 - 1, '#e8e4d8', 1, 3); P_(px0 + 6, py0 - 1, '#e8e4d8', 1, 3); }
      else if (roll < 0.55) { P_(px0, py0, '#d8d4c8', 4, 3); P_(px0, py0 + 3, '#b8b4a8', 4, 1); P_(px0 + 1, py0 + 1, '#2a2030'); P_(px0 + 3, py0 + 1, '#2a2030'); }
      else if (roll < 0.75) { P_(px0, py0, '#e8e0c8', 2, 4); P_(px0, py0 + 4, '#5a4a3a', 2, 1); rm.lights.push({ x: px0 + 1, y: py0 - 2, r: 18, col: '#ffcc66', a: 0.5, candle: true }); }
      else { x.fillStyle = 'rgba(90,20,30,0.3)'; x.beginPath(); x.ellipse(px0, py0, 4 + R() * 3, 2 + R() * 2, 0, 0, 6.3); x.fill(); }
    } else if (deco === 'mushrooms') {
      if (roll < 0.55) {
        const col = R() < 0.5 ? '#ff6a9a' : (R() < 0.5 ? '#6affd0' : '#ffd84a');
        const m = 1 + Math.floor(R() * 3);
        for (let j = 0; j < m; j++) { const mx = px0 + j * 3 - 2, my = py0 + (j % 2) * 2, h = 2 + Math.floor(R() * 2); P_(mx + 1, my, '#e8dcc8', 1, h); P_(mx, my - 1, col, 3, 1); P_(mx + 1, my - 2, col); P_(mx, my - 1, shade(col, 0.4)); }
        rm.lights.push({ x: px0, y: py0 - 2, r: 16, col, a: 0.55 });
      } else { P_(px0, py0, '#2a4a1a', 1, 1); P_(px0 + 2, py0 - 1, '#3a6a2a', 1, 2); P_(px0 - 2, py0, '#3a6a2a', 1, 1); }
    } else if (deco === 'ice') {
      if (roll < 0.5) { x.fillStyle = 'rgba(200,240,255,0.18)'; x.beginPath(); x.ellipse(px0, py0, 7 + R() * 5, 3 + R() * 2, 0, 0, 6.3); x.fill(); P_(px0 - 3, py0 - 1, 'rgba(255,255,255,0.5)', 3, 1); }
      else if (roll < 0.75) { P_(px0, py0 - 4, '#c8f0ff', 1, 5); P_(px0 + 2, py0 - 2, '#a8e0f8', 1, 3); P_(px0 - 2, py0 - 1, '#a8e0f8', 1, 2); P_(px0, py0 - 4, '#ffffff'); }
      else { P_(px0, py0, '#5a7a9a', 2, 1); P_(px0 + 3, py0 + 1, '#5a7a9a', 1, 1); }
    } else if (deco === 'lava') {
      if (roll < 0.5) { let lx0 = px0, ly0 = py0; for (let j = 0; j < 8; j++) { P_(lx0, ly0, j % 3 ? '#ff6a1a' : '#ffb040'); lx0 += 1; ly0 += Math.round(R() * 2 - 1); } rm.lights.push({ x: px0 + 4, y: py0, r: 14, col: '#ff6a1a', a: 0.5, lava: true }); }
      else if (roll < 0.75) { P_(px0, py0, '#1a1210', 5, 3); P_(px0 + 1, py0 - 1, '#2a2220', 3, 1); P_(px0 + 2, py0 + 1, '#ff6a1a'); }
      else { P_(px0, py0, '#3a3a44', 6, 1); P_(px0, py0 + 3, '#3a3a44', 6, 1); P_(px0, py0, '#3a3a44', 1, 4); P_(px0 + 5, py0, '#3a3a44', 1, 4); }
    } else if (deco === 'void') {
      if (roll < 0.35) { x.strokeStyle = 'rgba(196,108,255,0.45)'; x.lineWidth = 1; x.beginPath(); x.arc(px0, py0, 6, 0, 6.3); x.stroke(); P_(px0 - 1, py0 - 3, '#c46cff', 2, 6); P_(px0 - 3, py0, '#c46cff', 6, 1); rm.lights.push({ x: px0, y: py0, r: 18, col: '#c46cff', a: 0.45 }); }
      else if (roll < 0.6) { P_(px0, py0 - 5, '#7a3ad0', 2, 6); P_(px0, py0 - 5, '#d8a8ff', 1, 6); P_(px0 + 3, py0 - 3, '#5a2ab0', 2, 4); }
      else { P_(px0, py0, '#e8e0ff'); P_(px0 + 4, py0 + 2, '#a8b8ff'); P_(px0 - 3, py0 + 3, '#ffffff'); }
    }
  }
  // snow drifts along the top wall / embers glow under the top wall
  if (deco === 'ice') for (let xx = TS; xx < (RW - 1) * TS; xx++) { const h = 2 + Math.round(Math.sin(xx * 0.2) * 1.5 + Math.sin(xx * 0.07) * 2); P_(xx, TS, '#e8f4ff', 1, Math.max(1, h)); P_(xx, TS + Math.max(1, h), '#b8d0e8', 1, 1); }
}

function splat(x, y, col, n = 6) {
  if (!room.decal) return; const d = room.decal.getContext('2d');
  for (let k = 0; k < n; k++) { d.fillStyle = rgba(col, rand(0.25, 0.5)); const s = Math.random() < 0.3 ? 2 : 1; d.fillRect(Math.round(x + rand(-6, 6)), Math.round(y + rand(-5, 5)), s, s); }
}

// ------------------------------------------------------------ run setup
function recalc() {
  const st = { dmg: 1 + 0.1 * upLvl('might'), rate: 1, speed: 1, range: 1, crit: 0.05, critMult: 2, multi: 0, pierce: 0, homing: 0, burn: 0, slow: 0, poison: 0,
    lifesteal: 0, thorns: 0, orbitals: 0, boom: 0, wisp: 0, dodge: 1 - 0.25 * upLvl('swift'), trail: 0, roomheal: 0, enemyslow: 0, gold: 1, souls: 1 + 0.25 * upLvl('greed'),
    luck: 0.08 * upLvl('keen'), discount: 0, magnet: 0, chain: 0 };
  let maxhp = run.cls.hp + 2 * upLvl('vit');
  run.relics.forEach(r => {
    const f = r.fx;
    if (f.dmg) st.dmg += f.dmg; if (f.rate) st.rate += f.rate; if (f.speed) st.speed += f.speed; if (f.range) st.range += f.range; if (f.crit) st.crit += f.crit;
    if (f.critdmg) st.critMult = 3; if (f.multi) st.multi += f.multi; if (f.pierce) st.pierce = 1; if (f.homing) st.homing = 1; if (f.burn) st.burn = 1; if (f.slow) st.slow = 1;
    if (f.poison) st.poison = 1; if (f.lifesteal) st.lifesteal += f.lifesteal; if (f.thorns) st.thorns += f.thorns; if (f.orbitals) st.orbitals += f.orbitals; if (f.boom) st.boom = 1;
    if (f.wisp) st.wisp += f.wisp; if (f.dodge) st.dodge *= 1 - f.dodge; if (f.trail) st.trail = 1; if (f.roomheal) st.roomheal += f.roomheal; if (f.enemyslow) st.enemyslow += f.enemyslow;
    if (f.gold) st.gold += f.gold; if (f.souls) st.souls += f.souls; if (f.luck) st.luck += f.luck; if (f.discount) st.discount = Math.max(st.discount, f.discount); if (f.magnet) st.magnet = 1;
    if (f.maxhp) maxhp += f.maxhp; if (f.chain) st.chain = 1;
  });
  run.st = st;
  const old = P.maxhp; P.maxhp = Math.max(2, maxhp); if (P.maxhp > old) P.hp += P.maxhp - old; P.hp = Math.min(P.hp, P.maxhp);
}
function newRun(clsId, daily) {
  dailyMode = !!daily;
  const seed = daily ? Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')) : Math.floor(Math.random() * 1e9);
  rng = seeded(seed);
  boss = null; bossIntro = null; relicBanner = null; banner = null; parts = []; shots = []; hazards = []; beams = []; fx = []; slowmo = 1; fade = 0; fadeCb = null; transition = null;
  const cls = CLASSES.find(c => c.id === clsId);
  run = { seed, cls, fi: 0, relics: [], gold: 20 * upLvl('fort'), keys: 0, potions: 1 + upLvl('alch'), souls: 0, kills: 0, time: 0, dmgDealt: 0, killedBy: '', st: null, revived: false, startT: performance.now() };
  P = { x: 8.5 * TS, y: 5.5 * TS, vx: 0, vy: 0, r: 5, hp: cls.hp, maxhp: cls.hp, iframes: 0, roll: 0, rollCd: 0, rollDir: { x: 1, y: 0 }, atkCd: 0, specCd: 0, aim: 0, face: 1, swing: 0, spin: 0, walkT: 0, orbT: 0, wispCd: 0, wisp: { x: 8.5 * TS, y: 5.5 * TS } };
  if (upLvl('heir')) run.relics.push(rollRelic(0));
  recalc(); P.hp = P.maxhp;
  save.runs++; store();
  startFloor(0);
  screen = 'play';
  if (!save.tutorial) { save.tutorial = true; store(); setTimeout(() => toast('WASD move - MOUSE aim & click - SPACE dodge - RIGHT CLICK special', '#ffe680', 6), 2500); }
}
function startFloor(fi) {
  run.fi = fi;
  run.theme = FLOORS[fi % FLOORS.length];
  run.loop = Math.floor(fi / FLOORS.length);
  run.map = genFloor(fi); boss = null; beams = [];
  enterRoom(run.map.list[0], null);
  banner = { title: (run.loop ? `ENDLESS ${run.loop} - ` : `FLOOR ${fi + 1} - `) + run.theme.name, sub: run.theme.sub, t: 0, col: run.theme.accent };
  Sound.playSong(SONGS[run.theme.song]);
  save.bestFloor = Math.max(save.bestFloor, fi + 1); store();
}
function enterRoom(rm, fromDir) {
  room = rm; room.visited = true;
  for (const d in rm.doors) { const n = run.map.rooms[run.map.key(rm.x + DIRS[d][0], rm.y + DIRS[d][1])]; if (n) n.seen = true; }
  rm.seen = true;
  if (!rm.cv) renderRoom(rm);
  enemies = []; shots = []; hazards = []; beams = []; fx = [];
  pickups = rm.savedPickups || []; chests = rm.savedChests || [];
  if (fromDir) {
    const ent = { n: [8.5 * TS, TS * 1.6], s: [8.5 * TS, (RH - 1.6) * TS], w: [TS * 1.6, 5.5 * TS], e: [(RW - 1.6) * TS, 5.5 * TS] }[fromDir];
    P.x = ent[0]; P.y = ent[1];
  }
  P.wisp.x = P.x; P.wisp.y = P.y;
  if (!rm.contents) { rm.contents = true; populate(rm, fromDir); }
  flow = null; flowT = 0;
}
function leaveRoom() { room.savedPickups = pickups.filter(p => p.kind !== 'soul'); room.savedChests = chests; }

function populate(rm, fromDir) {
  const fi = run.fi, F = run.theme;
  if (rm.type === 'normal') {
    const n = Math.min(9, 3 + Math.floor(fi * 0.8) + Math.floor(rng() * 3) + run.loop);
    const pool = F.enemies.slice(0, 3 + Math.min(fi + 1, 3));
    for (let k = 0; k < n; k++) {
      const type = rpick(pool);
      const p = freeSpot(fromDir, ENEMIES[type].fly);
      spawnEnemy(type, p.x, p.y, rng() < (fi >= 1 ? 0.12 : 0.04));
    }
  } else if (rm.type === 'boss') {
    spawnBoss(F.boss);
  } else if (rm.type === 'treasure') {
    const a = rollRelic(), b = rollRelic(a);
    pickups.push(relicPickup(a, 6 * TS + 8, 5 * TS + 8, { pedestal: true, group: 'treasure' }));
    if (b) pickups.push(relicPickup(b, 10 * TS + 8, 5 * TS + 8, { pedestal: true, group: 'treasure' }));
  } else if (rm.type === 'shop') {
    const items = [];
    const r1 = rollRelic(); if (r1) items.push(relicPickup(r1, 5 * TS + 8, 5 * TS, { price: 30 + r1.r * 25 + fi * 6 }));
    const r2 = rollRelic(r1); if (r2) items.push(relicPickup(r2, 7 * TS + 8, 5 * TS, { price: 30 + r2.r * 25 + fi * 6 }));
    items.push({ kind: 'heart', x: 9 * TS + 8, y: 5 * TS, price: 8 + fi * 2, val: 2 });
    items.push({ kind: 'potion', x: 11 * TS + 8, y: 5 * TS, price: 14 + fi * 3 });
    items.push({ kind: 'key', x: 13 * TS - 8, y: 5 * TS, price: 10 + fi * 2 });
    items.forEach(i => { i.shop = true; i.vx = 0; i.vy = 0; pickups.push(i); });
    rm.keeper = { x: 8.5 * TS, y: 2.4 * TS };
  } else if (rm.type === 'altar') {
    const r = rollRelic(null, 2) || rollRelic();
    if (r) pickups.push(relicPickup(r, 8.5 * TS, 5.2 * TS, { pedestal: true, altar: true }));
  }
}
function freeSpot(fromDir, fly) {
  const ent = fromDir ? { n: [8, 1], s: [8, 9], w: [1, 5], e: [15, 5] }[fromDir] : [8, 5];
  for (let k = 0; k < 80; k++) {
    const c = 1 + Math.floor(rng() * 15), r = 1 + Math.floor(rng() * 9);
    if (solidFor(tileAt(c, r), fly)) continue;
    if (Math.abs(c - ent[0]) + Math.abs(r - ent[1]) < 6) continue;
    return { x: c * TS + 8, y: r * TS + 8 };
  }
  return { x: 8.5 * TS, y: 3.5 * TS };
}
function rollRelic(not, forceTier) {
  const owned = new Set(run.relics.map(r => r.id)); if (not) owned.add(not.id);
  const pickupOwned = new Set(pickups.filter(p => p.relic).map(p => p.relic.id));
  let tier = forceTier;
  if (tier === undefined) { const x = rng(); tier = x < 0.05 + run.st?.luck * 0.3 ? 2 : x < 0.38 + (run.st ? run.st.luck : 0) ? 1 : 0; }
  for (let tt = tier; tt >= 0; tt--) {
    const pool = RELICS.filter(r => r.r === tt && !owned.has(r.id) && !pickupOwned.has(r.id));
    if (pool.length) return rpick(pool);
  }
  return null;
}
function relicPickup(r, x, y, o = {}) { return Object.assign({ kind: 'relic', relic: r, x, y, vx: 0, vy: 0, t: rand(0, 6) }, o); }

// ------------------------------------------------------------ entities
function spawnEnemy(type, x, y, elite) {
  const d = ENEMIES[type], scale = 1 + 0.2 * run.fi + 0.7 * run.loop;
  const e = { type, d, x, y, vx: 0, vy: 0, hp: d.hp * scale * (elite ? 2.2 : 1), r: d.r * (elite ? 1.25 : 1) * (d.scale || 1), t: rand(0, 3), cd: rand(0.8, 2), state: 'idle', st: 0,
    flash: 0, burn: 0, poison: 0, slow: 0, elite, spawn: 0.5, ang: 0, hitBy: {}, face: 1 };
  e.maxhp = e.hp;
  enemies.push(e);
  burst(x, y, 10, '#8a7aa0', 40);
  save.seenEnemies[type] = (save.seenEnemies[type] || 0);
  return e;
}
let boss = null;
function spawnBoss(id) {
  const B = BOSSES[id], scale = 1 + run.loop * 0.8;
  boss = { id, B, x: 8.5 * TS, y: 3.8 * TS, vx: 0, vy: 0, hp: B.hp * scale, maxhp: B.hp * scale, r: B.r, t: 0, phase: 1, act: 'intro', at: 0, flash: 0, burn: 0, poison: 0, slow: 0, isBoss: true, ang: 0, face: 1, hitBy: {}, spawn: 0, z: 0, segs: [] };
  if (id === 'frostwyrm') { for (let k = 0; k < 12; k++) boss.segs.push({ x: boss.x, y: boss.y - k * 6 }); boss.trail = []; }
  enemies.push(boss);
  Sound.playSong(SONGS.boss);
  bossIntro = { t: 0, name: B.name };
  shake = 0.4;
}
let bossIntro = null;

// ------------------------------------------------------------ combat
function hurtPlayer(dmg, src) {
  if (P.iframes > 0 || P.roll > 0 || screen !== 'play') return;
  P.hp -= dmg; P.iframes = 1.0; shake = 0.35; hitstop = 0.08; flashW = 0.35;
  SND.hurt(); burst(P.x, P.y, 14, '#e83a4a', 70); splat(P.x, P.y, '#a81a2a', 8);
  if (src && src.d && run.st.thorns && src !== boss) damageEnemy(src, run.st.thorns, { noStatus: true });
  if (src && src.name) run.killedBy = src.name;
  else if (src && src.d) run.killedBy = src.d.name;
  else if (src && src.B) run.killedBy = src.B.name;
  if (P.hp <= 0) {
    const ph = run.relics.findIndex(r => r.fx.revive);
    if (ph >= 0 && !run.revived) {
      run.revived = true; run.relics.splice(ph, 1); recalc(); P.hp = Math.ceil(P.maxhp / 2); P.iframes = 2.5;
      toast('THE PHOENIX FEATHER BURNS - YOU RISE AGAIN!', '#ff8a3a', 4); burst(P.x, P.y, 60, '#ff8a3a', 140); SND.revive(); return;
    }
    die();
  }
}
function damageEnemy(e, dmg, o = {}) {
  if (e.dead || e.spawn > 0.3 || (e.isBoss && e.act === 'intro')) return;
  let crit = false;
  if (!o.raw) { dmg *= run.st.dmg; if (Math.random() < run.st.crit) { dmg *= run.st.critMult; crit = true; } }
  dmg = Math.round(dmg * 10) / 10;
  e.hp -= dmg; e.flash = 0.1; run.dmgDealt += dmg;
  nums.push({ x: e.x + rand(-4, 4), y: e.y - e.r - 4, v: dmg, t: 0, crit, col: o.col || (crit ? '#ffe650' : '#ffffff') });
  if (o.kx !== undefined && !e.isBoss && e.type !== 'golem') { e.vx += o.kx; e.vy += o.ky; }
  if (!o.noStatus) {
    if (run.st.burn) e.burn = 3; if (run.st.poison) e.poison = Math.min(8, e.poison + 4); if (run.st.slow) e.slow = 2;
    if (run.st.chain && !o.chained) {
      const others = enemies.filter(x => x !== e && !x.dead && dist(x, e) < 60).sort((a, b) => dist(a, e) - dist(b, e)).slice(0, 2);
      others.forEach(x => { fx.push({ kind: 'bolt', x1: e.x, y1: e.y, x2: x.x, y2: x.y, t: 0 }); damageEnemy(x, dmg * 0.5, { raw: true, chained: true, col: '#ffe650' }); });
      if (others.length) SND.zap();
    }
  }
  SND.hit(crit);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true;
  const col = e.isBoss ? '#ffffff' : (e.d.tint || ({ slime: '#4ac05a', shroom: '#ff6a8a', imp: '#ff6a3a', eye: '#ff3a8a', ghost: '#c8d8ff', bat: '#6a3a8a' }[e.type] || '#e8e4d8'));
  burst(e.x, e.y, e.isBoss ? 120 : 22, col, e.isBoss ? 160 : 90);
  splat(e.x, e.y, { slime: '#2a8a3a', shroom: '#8a2a4a', imp: '#8a2a0a', eye: '#6a1a4a' }[e.type] || '#4a3a4a', e.isBoss ? 30 : 8);
  run.kills++; save.kills++;
  if (!e.isBoss) save.seenEnemies[e.type] = (save.seenEnemies[e.type] || 0) + 1;
  // drops
  const souls = Math.round((e.isBoss ? e.B.souls : e.d.souls * (e.elite ? 3 : 1)) * run.st.souls);
  for (let k = 0; k < souls; k++) pickups.push({ kind: 'soul', x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), t: 0, delay: 0.3 + k * 0.03 });
  if (!e.isBoss) {
    const g = e.d.gold * (e.elite ? 3 : 1) * run.st.gold;
    let n = Math.floor(g) + (Math.random() < g % 1 ? 1 : 0);
    for (let k = 0; k < n; k++) pickups.push({ kind: 'coin', x: e.x, y: e.y, vx: rand(-50, 50), vy: rand(-50, 50), t: 0 });
    if (Math.random() < 0.05) pickups.push({ kind: 'heart', val: 1, x: e.x, y: e.y, vx: 0, vy: 0, t: 0 });
    if (Math.random() < 0.025) pickups.push({ kind: 'key', x: e.x, y: e.y, vx: 0, vy: 0, t: 0 });
    if (e.d.split && e.r >= 5.5 && !e.small) {
      for (let k = 0; k < 2; k++) { const s = spawnEnemy('slime', e.x + rand(-6, 6), e.y + rand(-6, 6), false); s.small = true; s.r = 4; s.hp = s.maxhp = 6 * (1 + 0.2 * run.fi); s.spawn = 0; s.vx = rand(-80, 80); s.vy = rand(-80, 80); }
    }
    if (e.d.spores) hazards.push({ kind: 'spore', x: e.x, y: e.y, r: 16, t: 0, dur: 3, dmg: 1 });
    if (run.st.lifesteal && Math.random() < run.st.lifesteal && P.hp < P.maxhp) { P.hp++; nums.push({ x: P.x, y: P.y - 10, v: '+1', t: 0, col: '#ff6a7a' }); SND.heal(); }
  }
  if (run.st.boom && !e.isBoss) { explode(e.x, e.y, 22, 6, true); }
  SND.kill(e.isBoss);
  if (e.isBoss) bossDefeated(e);
}
function explode(x, y, rad, dmg, friendly) {
  burst(x, y, 30, '#ff8a3a', 120); burst(x, y, 16, '#ffe650', 80);
  fx.push({ kind: 'ring', x, y, r: 2, max: rad, t: 0, col: '#ffcc66' });
  shake = Math.max(shake, 0.2); SND.boom();
  if (friendly) enemies.forEach(e => { if (!e.dead && dist(e, { x, y }) < rad + e.r) damageEnemy(e, dmg, { raw: true, noStatus: true, col: '#ff8a3a' }); });
  else if (dist(P, { x, y }) < rad + P.r) hurtPlayer(1, { name: 'an explosion' });
}
function bossDefeated(b) {
  boss = null; slowmo = 0.25; setTimeout(() => { slowmo = 1; }, 1400);
  flashW = 1; shake = 1;
  enemies.forEach(e => { if (!e.dead && e !== b) killEnemy(e); });
  const r = rollRelic(null, run.fi >= 2 ? undefined : undefined) || rollRelic();
  setTimeout(() => {
    if (room.type !== 'boss') return;
    if (r) pickups.push(relicPickup(r, 8.5 * TS, 4.2 * TS, { pedestal: true }));
    pickups.push({ kind: 'heart', val: 2, x: 6.5 * TS, y: 6 * TS, vx: 0, vy: 0, t: 0 }, { kind: 'heart', val: 2, x: 10.5 * TS, y: 6 * TS, vx: 0, vy: 0, t: 0 });
    room.stairs = { x: 8.5 * TS, y: 7.2 * TS };
    toast(run.fi === 4 && !run.loop ? 'THE NIGHTFALL IS BROKEN!' : 'The way down is open...', run.theme.accent, 4);
    Sound.playSong(SONGS.victory);
  }, 1500);
}

// ------------------------------------------------------------ player
function playerUpdate(dt) {
  const st = run.st;
  let mx = 0, my = 0;
  if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1; if (keys.KeyW) my -= 1; if (keys.KeyS) my += 1;
  const ms = stick('move'); if (ms) { mx = ms.x; my = ms.y; }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  // aim
  let aimX = 0, aimY = 0, firing = false, arrowAim = false;
  if (keys.ArrowLeft) aimX -= 1; if (keys.ArrowRight) aimX += 1; if (keys.ArrowUp) aimY -= 1; if (keys.ArrowDown) aimY += 1;
  if (aimX || aimY) { P.aim = Math.atan2(aimY, aimX); firing = true; arrowAim = true; }
  const as = stick('aim');
  if (as) { if (as.x || as.y) { P.aim = Math.atan2(as.y, as.x); firing = true; } }
  else if (!arrowAim && usingMouse && !touch.on) {
    const wx = mouse.x / S - RX - shakeX, wy = mouse.y / S - RY - shakeY;
    P.aim = Math.atan2(wy - P.y, wx - P.x);
    if (mouse.down || keys.KeyJ) firing = true;
  }
  if (keys.KeyJ) firing = true;
  P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
  // dodge roll
  const wantRoll = keys.Space || keys.ShiftLeft || keys.ShiftRight || touchTap.dodge; touchTap.dodge = false;
  if (wantRoll && P.rollCd <= 0 && P.roll <= 0) {
    const d = m > 0 ? { x: mx, y: my } : { x: Math.cos(P.aim), y: Math.sin(P.aim) };
    P.rollDir = d; P.roll = 0.26; P.rollCd = 0.75 * st.dodge; SND.roll(); burst(P.x, P.y + 4, 8, '#8a7aa0', 40);
  }
  let spd = run.cls.speed * st.speed;
  if (P.chill > 0) { spd *= 0.6; P.chill -= dt; }
  if (P.roll > 0) {
    P.roll -= dt;
    moveEnt(P, P.rollDir.x * 175 * dt, P.rollDir.y * 175 * dt, false);
    if (st.trail && Math.random() < 0.5) hazards.push({ kind: 'fire', x: P.x, y: P.y + 2, r: 7, t: 0, dur: 2, friendly: true, dmg: 4 });
  } else {
    P.vx = lerp(P.vx, mx * spd, 1 - Math.exp(-dt * 18)); P.vy = lerp(P.vy, my * spd, 1 - Math.exp(-dt * 18));
    moveEnt(P, P.vx * dt, P.vy * dt, false);
  }
  if (m > 0.1) { P.walkT += dt * 10; if (Math.random() < dt * 6) parts.push({ x: P.x + rand(-2, 2), y: P.y + 6, vx: rand(-8, 8), vy: rand(-12, -4), life: 0.4, t: 0, col: 'rgba(160,150,180,0.5)', s: 1 }); }
  P.rollCd -= dt; P.iframes = Math.max(0, P.iframes - dt); P.atkCd -= dt; P.specCd -= dt; P.swing = Math.max(0, P.swing - dt); P.spin = Math.max(0, P.spin - dt);
  if (firing && P.atkCd <= 0 && P.roll <= 0) attack();
  const wantSpec = mouse.right || keys.KeyK || keys.KeyE || touchTap.special; touchTap.special = false;
  if (wantSpec && P.specCd <= 0 && P.roll <= 0) special();
  // orbitals
  P.orbT += dt * 3.2;
  for (let k = 0; k < st.orbitals; k++) {
    const a = P.orbT + k * Math.PI * 2 / st.orbitals, ox = P.x + Math.cos(a) * 22 * st.range, oy = P.y + Math.sin(a) * 22 * st.range;
    enemies.forEach(e => { if (!e.dead && Math.hypot(e.x - ox, e.y - oy) < e.r + 5 && (!e.hitBy['orb' + k] || t - e.hitBy['orb' + k] > 0.45)) { e.hitBy['orb' + k] = t; damageEnemy(e, 5, { noStatus: true }); } });
    shots.forEach(s => { if (s.enemy && Math.hypot(s.x - ox, s.y - oy) < 6) s.dead = true; });
  }
  // wisp familiar
  if (st.wisp) {
    P.wisp.x = lerp(P.wisp.x, P.x - P.face * 14, 0.08); P.wisp.y = lerp(P.wisp.y, P.y - 12 + Math.sin(t * 3) * 3, 0.08);
    P.wispCd -= dt;
    const target = nearestEnemy(P.wisp, 140);
    if (target && P.wispCd <= 0) { P.wispCd = 0.7 / st.wisp; const a = Math.atan2(target.y - P.wisp.y, target.x - P.wisp.x); shots.push({ x: P.wisp.x, y: P.wisp.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, r: 2, dmg: 3, life: 1.2, col: '#ffe680', kind: 'wisp', friendly: true, hit: new Set(), raw: false }); SND.wisp(); }
  }
  // doors
  if (doorsOpen()) {
    const tc = Math.floor(P.x / TS), tr = Math.floor(P.y / TS);
    let dir = null;
    if (tr <= 0 && room.doors.n) dir = 'n'; else if (tr >= RH - 1 && room.doors.s) dir = 's'; else if (tc <= 0 && room.doors.w) dir = 'w'; else if (tc >= RW - 1 && room.doors.e) dir = 'e';
    if (dir) goThrough(dir);
  }
  // stairs
  if (room.stairs && dist(P, room.stairs) < 9) descend();
}
function nearestEnemy(from, maxD) { let best = null, bd = maxD; enemies.forEach(e => { if (e.dead || e.spawn > 0) return; const d = dist(e, from); if (d < bd) { bd = d; best = e; } }); return best; }
function attack() {
  const st = run.st, A = run.cls.attack;
  P.atkCd = A.cd / st.rate;
  const a = P.aim;
  if (A.kind === 'slash') {
    P.swing = 0.18; P.swingA = a; P.swingDir = (P.swingDir || 1) * -1;
    const reach = A.reach * st.range;
    fx.push({ kind: 'slash', x: P.x, y: P.y, a, r: reach, t: 0, dir: P.swingDir });
    SND.swing();
    enemies.forEach(e => {
      if (e.dead) return;
      const d = dist(e, P); if (d > reach + e.r) return;
      let da = Math.atan2(e.y - P.y, e.x - P.x) - a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 1.1 || d < e.r + 6) damageEnemy(e, A.dmg, { kx: Math.cos(a) * 120, ky: Math.sin(a) * 120 });
    });
    shots.forEach(s => { if (s.enemy && dist(s, P) < reach + 2) { let da = Math.atan2(s.y - P.y, s.x - P.x) - a; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; if (Math.abs(da) < 1.1) { s.dead = true; burst(s.x, s.y, 4, '#ffffff', 30); } } });
    breakAround(P.x + Math.cos(a) * 14, P.y + Math.sin(a) * 14, 12);
    for (let k = 0; k < st.multi; k++) {
      const aa = a + (k - (st.multi - 1) / 2) * 0.25;
      shots.push({ x: P.x, y: P.y, vx: Math.cos(aa) * 160, vy: Math.sin(aa) * 160, r: 4 * st.range, dmg: A.dmg * 0.6, life: 0.45, col: '#c8f0ff', kind: 'beam', friendly: true, hit: new Set(), pierce: true, ang: aa });
    }
  } else {
    const n = 1 + st.multi, spread = A.kind === 'arrow' ? 0.14 : 0.22;
    for (let k = 0; k < n; k++) {
      const aa = a + (k - (n - 1) / 2) * spread;
      const sp = A.speed * (0.9 + 0.1 * st.range);
      shots.push({ x: P.x + Math.cos(aa) * 6, y: P.y + Math.sin(aa) * 6, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, r: (A.kind === 'fireball' ? 3.5 : 2) * st.range, dmg: A.dmg, life: 1.4 * st.range,
        col: A.kind === 'fireball' ? '#ff8a3a' : '#e8d8b0', kind: A.kind, friendly: true, hit: new Set(), pierce: st.pierce, splash: A.splash ? A.splash * st.range : 0, ang: aa });
    }
    if (A.kind === 'arrow') SND.bow(); else SND.fire();
  }
}
function special() {
  const S2 = run.cls.special, st = run.st;
  P.specCd = S2.cd / Math.sqrt(st.rate);
  if (run.cls.id === 'knight') {
    P.spin = 0.4; SND.whirl(); fx.push({ kind: 'ring', x: P.x, y: P.y, r: 4, max: 36 * st.range, t: 0, col: '#c8f0ff' });
    enemies.forEach(e => { if (!e.dead && dist(e, P) < 36 * st.range + e.r) { const a = Math.atan2(e.y - P.y, e.x - P.x); damageEnemy(e, 12, { kx: Math.cos(a) * 200, ky: Math.sin(a) * 200 }); } });
    shots.forEach(s => { if (s.enemy && dist(s, P) < 38) s.dead = true; });
    breakAround(P.x, P.y, 36);
  } else if (run.cls.id === 'ranger') {
    for (let k = 0; k < 7 + st.multi * 2; k++) { const aa = P.aim + (k - 3 - st.multi) * 0.13; shots.push({ x: P.x, y: P.y, vx: Math.cos(aa) * 240, vy: Math.sin(aa) * 240, r: 2 * st.range, dmg: 5, life: 1.2, col: '#e8d8b0', kind: 'arrow', friendly: true, hit: new Set(), pierce: 1, ang: aa }); }
    SND.volley();
  } else {
    for (let k = 0; k < 12; k++) { const aa = k / 12 * Math.PI * 2; shots.push({ x: P.x, y: P.y, vx: Math.cos(aa) * 140, vy: Math.sin(aa) * 140, r: 3.5 * st.range, dmg: 6, life: 1.1, col: '#ff8a3a', kind: 'fireball', friendly: true, hit: new Set(), splash: 14, ang: aa }); }
    SND.nova(); flashW = 0.15;
  }
}
function breakAround(x, y, rad) {
  for (let r = 1; r < RH - 1; r++) for (let c = 1; c < RW - 1; c++) {
    if (room.layout[r - 1][c - 1] !== 'x') continue;
    if (Math.hypot(c * TS + 8 - x, r * TS + 8 - y) < rad + 8) breakCrate(c, r);
  }
}
function breakCrate(c, r) {
  room.layout[r - 1][c - 1] = '.'; const x = c * TS + 8, y = r * TS + 8;
  burst(x, y, 14, '#9a7a3a', 70); SND.crate(); flow = null;
  if (Math.random() < 0.45) pickups.push({ kind: 'coin', x, y, vx: rand(-40, 40), vy: rand(-40, 40), t: 0 });
  if (Math.random() < 0.06) pickups.push({ kind: 'heart', val: 1, x, y, vx: 0, vy: 0, t: 0 });
}
function drinkPotion() {
  if (!run || run.potions <= 0 || P.hp >= P.maxhp) { if (run && run.potions > 0) toast('Already at full health', '#c8c0e8', 1.2); return; }
  run.potions--; P.hp = Math.min(P.maxhp, P.hp + 4); SND.heal(); burst(P.x, P.y, 20, '#ff6a8a', 50);
  nums.push({ x: P.x, y: P.y - 10, v: '+2 HEARTS', t: 0, col: '#ff6a8a' });
}

// ------------------------------------------------------------ rooms & doors
function goThrough(dir) {
  const n = run.map.rooms[run.map.key(room.x + DIRS[dir][0], room.y + DIRS[dir][1])];
  if (!n) return;
  leaveRoom();
  const from = room;
  if (!n.cv) renderRoom(n);
  transition = { from, to: n, dir, t: 0 };
  enterRoom(n, OPP[dir]);
  SND.door();
}
function descend() {
  room.stairs = null; SND.stairs();
  if (run.fi === 4 && run.loop === 0 && !run.wonOnce) { run.wonOnce = true; victory(); return; }
  fadeTo(() => startFloor(run.fi + 1));
}
let fade = 0, fadeCb = null;
function fadeTo(cb) { fadeCb = cb; fade = 0.001; }
function checkClear() {
  if (room.cleared || enemies.some(e => !e.dead)) return;
  room.cleared = true;
  if (room.type === 'normal') {
    SND.clear();
    const x = rng();
    if (x < 0.07) chests.push({ x: 8.5 * TS, y: 5.5 * TS, gold: true, open: false });
    else if (x < 0.32) chests.push({ x: 8.5 * TS, y: 5.5 * TS, gold: false, open: false });
    if (run.st.roomheal && Math.random() < run.st.roomheal && P.hp < P.maxhp) { P.hp++; nums.push({ x: P.x, y: P.y - 10, v: '+1', t: 0, col: '#4ac05a' }); SND.heal(); }
  }
}

// ------------------------------------------------------------ enemy AI
function enemyUpdate(e, dt) {
  if (e.dead) return;
  if (e.spawn > 0) { e.spawn -= dt; return; }
  e.t += dt; e.flash -= dt; e.cd -= dt;
  const slowF = (e.slow > 0 ? 0.5 : 1) * (1 - run.st.enemyslow);
  if (e.burn > 0) { e.burn -= dt; e.dot = (e.dot || 0) + dt; }
  if (e.poison > 0) { e.poison -= dt; e.dotP = (e.dotP || 0) + dt; }
  if (e.dot >= 0.5) { e.dot = 0; damageEnemy(e, 2, { raw: true, noStatus: true, col: '#ff8a3a' }); burst(e.x, e.y - 4, 3, '#ff8a3a', 20); if (e.dead) return; }
  if (e.dotP >= 0.6) { e.dotP = 0; damageEnemy(e, 1.5, { raw: true, noStatus: true, col: '#6ae06a' }); if (e.dead) return; }
  e.slow -= dt;
  if (e.isBoss) return bossUpdate(e, dt * slowF);
  const d = e.d, toP = { x: P.x - e.x, y: P.y - e.y }, dp = Math.hypot(toP.x, toP.y) || 1;
  const sp = d.speed * slowF * (e.elite ? 1.15 : 1);
  let mvx = 0, mvy = 0;
  const go = (vx, vy, s) => { const m = Math.hypot(vx, vy) || 1; mvx = vx / m * s; mvy = vy / m * s; };
  switch (d.ai) {
    case 'chase': { const f = flowDir(e); go(f.x, f.y, sp); break; }
    case 'flutter': go(toP.x + Math.sin(e.t * 5) * 30, toP.y + Math.cos(e.t * 4) * 30, sp); break;
    case 'hop': {
      const ph = e.t % 1.1;
      if (ph < 0.35) { if (!e.hopDir) { const f = flowDir(e); e.hopDir = { x: f.x, y: f.y }; } go(e.hopDir.x, e.hopDir.y, sp * 2.6); e.z = Math.sin(ph / 0.35 * Math.PI) * 4; }
      else { e.hopDir = null; e.z = 0; }
      break;
    }
    case 'ranged': {
      const f = flowDir(e);
      if (dp < 50) go(-toP.x, -toP.y, sp); else if (dp > 100) go(f.x, f.y, sp); else go(-toP.y * Math.sin(e.t), toP.x * Math.sin(e.t), sp * 0.6);
      if (e.cd <= 0 && dp < 170) { e.cd = d.shot.cd * rand(0.8, 1.2); enemyShoot(e, Math.atan2(toP.y, toP.x)); }
      break;
    }
    case 'phase': go(toP.x, toP.y, sp); e.alpha = 0.55 + 0.35 * Math.sin(e.t * 3); break;
    case 'lunge': {
      if (e.state === 'idle') { const f = flowDir(e); go(f.x, f.y, sp); if (dp < 55 && e.cd <= 0) { e.state = 'wind'; e.st = 0.45; e.lungeA = Math.atan2(toP.y, toP.x); } }
      else if (e.state === 'wind') { e.st -= dt; e.shakeX = rand(-1, 1); if (e.st <= 0) { e.state = 'dash'; e.st = 0.32; SND.lunge(); } }
      else { go(Math.cos(e.lungeA), Math.sin(e.lungeA), 170); e.st -= dt; if (e.st <= 0) { e.state = 'idle'; e.cd = rand(1.2, 2); } }
      break;
    }
    case 'charge': {
      if (e.state === 'idle') { const f = flowDir(e); go(f.x, f.y, sp); if (e.cd <= 0 && dp < 120) { e.state = 'wind'; e.st = 0.7; e.lungeA = Math.atan2(toP.y, toP.x); } }
      else if (e.state === 'wind') { e.st -= dt; e.shakeX = rand(-1.5, 1.5); if (e.st <= 0) { e.state = 'dash'; e.st = 1.6; e.hitWall = false; SND.roar(); } }
      else if (e.state === 'dash') { go(Math.cos(e.lungeA), Math.sin(e.lungeA), 135); e.st -= dt; if (e.hitWall || e.st <= 0) { e.state = 'stun'; e.st = 1.1; shake = 0.25; burst(e.x, e.y, 14, '#8a849a', 60); SND.thud(); } }
      else { e.st -= dt; if (e.st <= 0) { e.state = 'idle'; e.cd = rand(1.5, 2.5); } }
      break;
    }
    case 'summoner': {
      if (dp < 60) go(-toP.x, -toP.y, sp); else if (dp > 110) { const f = flowDir(e); go(f.x, f.y, sp); }
      if (e.cd <= 0) { e.cd = d.shot.cd; for (let k = 0; k < d.shot.ring; k++) enemyShoot(e, k / d.shot.ring * Math.PI * 2 + e.t); }
      e.sum = (e.sum || 4) - dt;
      if (e.sum <= 0 && enemies.filter(x => !x.dead).length < 11) { e.sum = 7; for (let k = 0; k < 2; k++) spawnEnemy('bat', e.x + rand(-10, 10), e.y + rand(-10, 10), false); SND.summon(); }
      break;
    }
    case 'turret': {
      go(toP.x + Math.sin(e.t) * 40, toP.y + Math.cos(e.t) * 40, sp);
      e.ang += dt * 2.2;
      if (e.cd <= 0) { e.cd = d.shot.cd; e.burstN = (e.burstN || 0) + 1; enemyShoot(e, e.ang); enemyShoot(e, e.ang + Math.PI); if (e.burstN % 14 === 0) e.cd = 1.6; }
      break;
    }
    case 'blink': {
      const f = flowDir(e); go(f.x, f.y, sp * 0.5);
      if (e.cd <= 0) {
        e.cd = d.shot.cd;
        if (Math.random() < 0.4) { burst(e.x, e.y, 10, '#3a1a1a', 40); for (let k = 0; k < 20; k++) { const a = rand(0, 6.28), rr = rand(40, 70); const nx = P.x + Math.cos(a) * rr, ny = P.y + Math.sin(a) * rr; if (!blocked(nx, ny, e.r, false) && nx > TS && ny > TS && nx < (RW - 1) * TS && ny < (RH - 1) * TS) { e.x = nx; e.y = ny; break; } } burst(e.x, e.y, 10, '#ff6a3a', 40); SND.blink(); }
        else enemyShoot(e, Math.atan2(P.y - e.y, P.x - e.x));
      }
      break;
    }
  }
  e.vx = lerp(e.vx, mvx, 1 - Math.exp(-dt * 8)); e.vy = lerp(e.vy, mvy, 1 - Math.exp(-dt * 8));
  e.hitWall = false;
  moveEnt(e, e.vx * dt, e.vy * dt, d.fly, d.ai === 'phase');
  if (Math.abs(e.vx) > 2) e.face = e.vx > 0 ? 1 : -1;
  // separation
  enemies.forEach(o => { if (o === e || o.dead) return; const ddx = e.x - o.x, ddy = e.y - o.y, dd = Math.hypot(ddx, ddy); if (dd < e.r + o.r && dd > 0) { const push = (e.r + o.r - dd) * 0.3; moveEnt(e, ddx / dd * push, ddy / dd * push, d.fly, d.ai === 'phase'); } });
  // contact damage
  if (dist(e, P) < e.r + P.r && (!e.z || e.z < 2)) hurtPlayer(e.elite ? 2 : d.dmg, e);
}
function enemyShoot(e, a, o = {}) {
  const sh = o.shot || e.d.shot;
  const n = sh.spread || 1;
  for (let k = 0; k < n; k++) {
    const aa = a + (k - (n - 1) / 2) * 0.25;
    shots.push({ x: e.x, y: e.y, vx: Math.cos(aa) * sh.speed, vy: Math.sin(aa) * sh.speed, r: o.r || 2.5, life: o.life || 3, col: sh.col, enemy: true, slow: sh.slow, burn: sh.burn, src: e, ang: aa });
  }
  if (!o.quiet) SND.eshot();
}
function bulletRing(x, y, n, speed, col, off = 0, o = {}) { for (let k = 0; k < n; k++) { const a = off + k / n * Math.PI * 2; shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: o.r || 3, life: o.life || 4, col, enemy: true, slow: o.slow, burn: o.burn, src: boss, ang: a }); } SND.eshot(); }

// ------------------------------------------------------------ bosses
function bossUpdate(b, dt) {
  b.t += dt; b.at += dt; b.flash -= dt;
  if (b.act === 'intro') { if (b.t > 1.8) { b.act = 'idle'; b.at = 0; } return; }
  if (b.phase === 1 && b.hp < b.maxhp * 0.5) { b.phase = 2; toast(`${b.B.name} IS ENRAGED!`, '#ff5a5a', 2.5); shake = 0.6; flashW = 0.4; SND.roar(); b.act = 'idle'; b.at = 0; }
  const P2 = b.phase === 2, toP = Math.atan2(P.y - b.y, P.x - b.x), dp = dist(b, P);
  const next = (acts) => { b.act = pick(acts); b.at = 0; b.n = 0; b.tx = null; };
  const walk = (s) => { const f = flowDir(b); const m = Math.hypot(f.x, f.y) || 1; moveEnt(b, f.x / m * s * dt, f.y / m * s * dt, false); b.face = f.x > 0 ? 1 : -1; };
  switch (b.id) {
    case 'boneking': {
      if (b.act === 'idle') { walk(b.B.speed * (P2 ? 1.4 : 1)); if (b.at > (P2 ? 1.2 : 1.8)) next(['ring', 'ring', 'summon', 'leap', 'aimed']); }
      else if (b.act === 'ring') { if (b.at > 0.4 * (b.n + 1) && b.n < 3) { bulletRing(b.x, b.y, P2 ? 16 : 12, 70, '#e8e4d8', b.n * 0.13, { r: 3 }); b.n++; } if (b.at > 1.6) next(['idle']); }
      else if (b.act === 'aimed') { if (b.at > 0.18 * (b.n + 1) && b.n < (P2 ? 8 : 5)) { enemyShoot(b, toP + rand(-0.1, 0.1), { shot: { speed: 120, col: '#ffe680' }, r: 3 }); b.n++; } if (b.at > 1.6) next(['idle']); }
      else if (b.act === 'summon') { if (b.n === 0) { const cnt = P2 ? 3 : 2; for (let k = 0; k < cnt; k++) spawnEnemy(k % 2 ? 'archer' : 'skeleton', b.x + rand(-30, 30), b.y + rand(10, 30), false); b.n = 1; SND.summon(); } if (b.at > 1) next(['idle']); }
      else if (b.act === 'leap') {
        if (!b.tx) { b.tx = { x: P.x, y: P.y }; b.sx = b.x; b.sy = b.y; hazards.push({ kind: 'warn', x: P.x, y: P.y, r: 22, t: 0, dur: 0.9 }); }
        const u = clamp(b.at / 0.9, 0, 1); b.x = lerp(b.sx, b.tx.x, u); b.y = lerp(b.sy, b.tx.y, u); b.z = Math.sin(u * Math.PI) * 30;
        if (u >= 1 && b.n === 0) { b.n = 1; b.z = 0; shake = 0.5; SND.thud(); bulletRing(b.x, b.y, P2 ? 20 : 14, 80, '#c8c4b8'); if (dist(b, P) < 24) hurtPlayer(1, b.B); burst(b.x, b.y, 30, '#8a849a', 90); }
        if (b.at > 1.4) next(['idle']);
      }
      break;
    }
    case 'mothershroom': {
      b.x = lerp(b.x, 8.5 * TS + Math.sin(b.t * 0.4) * 30, 0.02);
      if (b.act === 'idle') { if (b.at > (P2 ? 0.8 : 1.3)) next(['spiral', 'spores', 'babies', 'burst']); }
      else if (b.act === 'spiral') { b.ang += dt * (P2 ? 3 : 2.2); if (b.at > 0.12 * (b.n + 1)) { b.n++; for (let k = 0; k < (P2 ? 4 : 3); k++) { const a = b.ang + k * Math.PI * 2 / (P2 ? 4 : 3); shots.push({ x: b.x, y: b.y + 6, vx: Math.cos(a) * 65, vy: Math.sin(a) * 65, r: 3, life: 4, col: '#ff6a8a', enemy: true, src: b, ang: a }); } if (b.n % 4 === 0) SND.eshot(); } if (b.at > 3) next(['idle']); }
      else if (b.act === 'spores') { if (b.n === 0) { b.n = 1; for (let k = 0; k < (P2 ? 6 : 4); k++) { const x = rand(2 * TS, (RW - 2) * TS), y = rand(2 * TS, (RH - 2) * TS); hazards.push({ kind: 'warn', x, y, r: 20, t: 0, dur: 1, then: { kind: 'spore', r: 20, dur: 4, dmg: 1 } }); } hazards.push({ kind: 'warn', x: P.x, y: P.y, r: 20, t: 0, dur: 1, then: { kind: 'spore', r: 20, dur: 4, dmg: 1 } }); } if (b.at > 1.5) next(['idle']); }
      else if (b.act === 'babies') { if (b.n === 0 && enemies.filter(x => !x.dead).length < 8) { for (let k = 0; k < 3; k++) spawnEnemy('shroom', b.x + rand(-30, 30), b.y + rand(15, 30), false); SND.summon(); } b.n = 1; if (b.at > 1) next(['idle']); }
      else if (b.act === 'burst') { if (b.at > 0.5 * (b.n + 1) && b.n < 3) { bulletRing(b.x, b.y, 18, 60 + b.n * 15, '#ffb0c8', b.n * 0.17, { r: 2.5 }); b.n++; } if (b.at > 1.8) next(['idle']); }
      break;
    }
    case 'frostwyrm': {
      // the head swims around; body segments follow its trail
      if (b.act === 'idle' || b.act === 'swim') {
        b.ang = b.ang || 0;
        const want = Math.atan2(P.y - b.y, P.x - b.x) + Math.sin(b.t * 2) * 0.9;
        let da = want - b.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
        b.ang += clamp(da, -2.2 * dt, 2.2 * dt);
        const sp = (P2 ? 78 : 62);
        b.x += Math.cos(b.ang) * sp * dt; b.y += Math.sin(b.ang) * sp * dt;
        if (b.x < 2 * TS || b.x > (RW - 2) * TS) { b.ang = Math.PI - b.ang; b.x = clamp(b.x, 2 * TS, (RW - 2) * TS); }
        if (b.y < 2 * TS || b.y > (RH - 2) * TS) { b.ang = -b.ang; b.y = clamp(b.y, 2 * TS, (RH - 2) * TS); }
        b.cdS = (b.cdS || 2) - dt;
        if (b.cdS <= 0) { b.cdS = P2 ? 1.3 : 2; for (let k = -2; k <= 2; k++) enemyShoot(b, toP + k * 0.22, { shot: { speed: 90, col: '#a8f0ff', slow: true }, r: 3, quiet: k !== 0 }); }
        if (b.at > (P2 ? 5 : 7)) next(P2 ? ['dive', 'swim'] : ['dive', 'swim', 'swim']);
      } else if (b.act === 'dive') {
        if (b.n === 0) { b.n = 1; b.under = true; SND.roar(); }
        if (b.at > 1.3 && b.n === 1) { b.n = 2; b.x = clamp(P.x + rand(-20, 20), 2 * TS, (RW - 2) * TS); b.y = clamp(P.y + rand(-20, 20), 2 * TS, (RH - 2) * TS); hazards.push({ kind: 'warn', x: b.x, y: b.y, r: 20, t: 0, dur: 0.8 }); }
        if (b.at > 2.1 && b.n === 2) { b.n = 3; b.under = false; shake = 0.5; bulletRing(b.x, b.y, P2 ? 18 : 12, 80, '#a8f0ff', 0, { slow: true }); if (dist(b, P) < 22) hurtPlayer(1, b.B); burst(b.x, b.y, 30, '#a8f0ff', 100); b.segs.forEach(s => { s.x = b.x; s.y = b.y; }); b.trail = []; }
        if (b.at > 2.5) next(['swim']);
      }
      b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 120) b.trail.length = 120;
      b.segs.forEach((s, k) => { const p = b.trail[Math.min(b.trail.length - 1, (k + 1) * 6)]; if (p) { s.x = p.x; s.y = p.y; } });
      if (!b.under) b.segs.forEach(s => { if (Math.hypot(s.x - P.x, s.y - P.y) < 7 + P.r) hurtPlayer(1, b.B); });
      break;
    }
    case 'forgedemon': {
      if (b.act === 'idle') { walk(b.B.speed * (P2 ? 1.3 : 1)); if (b.at > (P2 ? 0.9 : 1.4)) next(['rain', 'fan', 'dash', 'dash', 'spiral']); }
      else if (b.act === 'rain') { if (b.n === 0) { b.n = 1; for (let k = 0; k < (P2 ? 9 : 6); k++) { const x = k === 0 ? P.x : rand(2 * TS, (RW - 2) * TS), y = k === 0 ? P.y : rand(2 * TS, (RH - 2) * TS); hazards.push({ kind: 'warn', x, y, r: 16, t: -k * 0.12, dur: 1.1, then: { kind: 'blast', r: 16 } }); } SND.roar(); } if (b.at > 2) next(['idle']); }
      else if (b.act === 'fan') { if (b.at > 0.35 * (b.n + 1) && b.n < 3) { for (let k = -3; k <= 3; k++) enemyShoot(b, toP + k * 0.18, { shot: { speed: 105, col: '#ff8a3a', burn: true }, r: 3, quiet: k !== 0 }); b.n++; } if (b.at > 1.4) next(['idle']); }
      else if (b.act === 'dash') {
        if (b.n === 0) { b.n = 1; b.dashA = toP; fx.push({ kind: 'line', x: b.x, y: b.y, a: toP, t: 0, dur: 0.6 }); }
        if (b.at > 0.6 && b.at < 1.15) { moveEnt(b, Math.cos(b.dashA) * 230 * dt, Math.sin(b.dashA) * 230 * dt, false); if (Math.random() < 0.6) hazards.push({ kind: 'fire', x: b.x, y: b.y + 6, r: 7, t: 0, dur: 2.5, dmg: 1 }); }
        if (b.at > 1.5) next(['idle']);
      }
      else if (b.act === 'spiral') { b.ang += dt * 4; if (b.at > 0.1 * (b.n + 1)) { b.n++; enemyShoot(b, b.ang, { shot: { speed: 85, col: '#ffcc33', burn: true }, r: 3, quiet: b.n % 3 }); enemyShoot(b, b.ang + Math.PI, { shot: { speed: 85, col: '#ffcc33', burn: true }, r: 3, quiet: true }); } if (b.at > 2.4) next(['idle']); }
      break;
    }
    case 'voidlord': {
      b.y = lerp(b.y, (b.ty || 4.5 * TS) + Math.sin(b.t * 1.5) * 6, 0.05); b.x = lerp(b.x, b.tx2 || 8.5 * TS, 0.05);
      if (b.act === 'idle') { if (b.at > (P2 ? 0.7 : 1.1)) next(P2 ? ['spiral', 'burst', 'beams', 'beams', 'teleport', 'summon'] : ['spiral', 'burst', 'teleport', 'summon', 'aimed']); }
      else if (b.act === 'spiral') { b.ang += dt * 2.6; if (b.at > 0.09 * (b.n + 1)) { b.n++; for (let k = 0; k < 4; k++) { const a = b.ang + k * Math.PI / 2; shots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 75, vy: Math.sin(a) * 75, r: 3, life: 4, col: '#c46cff', enemy: true, src: b, ang: a }); } if (b.n % 4 === 0) SND.eshot(); } if (b.at > 3) next(['idle']); }
      else if (b.act === 'burst') { if (b.at > 0.45 * (b.n + 1) && b.n < 4) { bulletRing(b.x, b.y, 22, 70, b.n % 2 ? '#ff3a8a' : '#c46cff', b.n * 0.14, { r: 3 }); b.n++; } if (b.at > 2) next(['idle']); }
      else if (b.act === 'aimed') { if (b.at > 0.15 * (b.n + 1) && b.n < 10) { enemyShoot(b, toP + rand(-0.15, 0.15), { shot: { speed: 130, col: '#ff3a8a' }, r: 3 }); b.n++; } if (b.at > 1.8) next(['idle']); }
      else if (b.act === 'teleport') { if (b.n === 0) { b.n = 1; burst(b.x, b.y, 40, '#c46cff', 100); const spots = [[4.5, 3.5], [12.5, 3.5], [8.5, 4.5], [4.5, 7.5], [12.5, 7.5]]; const s = pick(spots); b.tx2 = s[0] * TS; b.ty = s[1] * TS; b.x = b.tx2; b.y = b.ty; SND.blink(); burst(b.x, b.y, 40, '#c46cff', 100); } if (b.at > 0.8) next(['burst', 'spiral']); }
      else if (b.act === 'summon') { if (b.n === 0 && enemies.filter(x => !x.dead).length < 6) { spawnEnemy('eye', b.x - 40, b.y + 20, false); spawnEnemy('eye', b.x + 40, b.y + 20, false); SND.summon(); } b.n = 1; if (b.at > 1) next(['idle']); }
      else if (b.act === 'beams') {
        if (b.n === 0) { b.n = 1; b.beamA = rand(0, 6.28); beams = [0, 1, 2].map(k => ({ a: b.beamA + k * Math.PI * 2 / 3, warm: 1.0 })); SND.charge(); }
        beams.forEach(bm => { bm.warm -= dt; if (bm.warm <= 0) bm.a += dt * (P2 ? 0.9 : 0.6); });
        if (b.at > 5) { beams = []; next(['idle']); }
      }
      break;
    }
  }
  if (dist(b, P) < b.r + P.r && !b.under && (!b.z || b.z < 6)) hurtPlayer(1, b.B);
}

// ------------------------------------------------------------ world update
let shakeX = 0, shakeY = 0;
function update(dt) {
  run.time += dt;
  if (transition) { transition.t += dt / 0.35; if (transition.t >= 1) transition = null; return; }
  if (bossIntro) { bossIntro.t += dt; if (bossIntro.t > 2.2) bossIntro = null; }
  flowT -= dt; if (flowT <= 0) { buildFlow(); flowT = 0.25; }
  playerUpdate(dt);
  enemies.forEach(e => enemyUpdate(e, dt));
  enemies = enemies.filter(e => !e.dead);
  // shots
  shots.forEach(s => {
    s.life -= dt;
    if (s.friendly && run.st.homing && s.kind !== 'beam') {
      const tg = nearestEnemy(s, 90);
      if (tg) { const want = Math.atan2(tg.y - s.y, tg.x - s.x), sp = Math.hypot(s.vx, s.vy); let a = Math.atan2(s.vy, s.vx); let da = want - a; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; a += clamp(da, -5 * dt, 5 * dt); s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; }
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.ang = Math.atan2(s.vy, s.vx);
    const c = Math.floor(s.x / TS), r = Math.floor(s.y / TS), ch = tileAt(c, r);
    if (ch === '#' || ch === 'x' || c <= 0 || r <= 0 || c >= RW - 1 || r >= RH - 1) {
      if (ch === 'x' && s.friendly) breakCrate(c, r);
      s.dead = true; burst(s.x - s.vx * dt, s.y - s.vy * dt, 4, s.col, 30);
      if (s.splash) explodeShot(s);
    }
    if (s.life <= 0) { s.dead = true; if (s.splash) explodeShot(s); }
    if (s.dead) return;
    if (s.friendly) {
      for (const e of enemies) {
        if (e.dead || s.hit.has(e) || e.spawn > 0.3 || e.under) continue;
        const rr = e.isBoss && e.id === 'frostwyrm' ? null : e.r;
        let hit = rr !== null && Math.hypot(e.x - s.x, e.y - (s.y) + (e.z || 0)) < rr + s.r;
        if (e.isBoss && e.id === 'frostwyrm') hit = Math.hypot(e.x - s.x, e.y - s.y) < 9 + s.r || e.segs.some(g => Math.hypot(g.x - s.x, g.y - s.y) < 6 + s.r);
        if (!hit) continue;
        s.hit.add(e);
        damageEnemy(e, s.dmg, { kx: s.vx * 0.4, ky: s.vy * 0.4 });
        if (s.splash) { explodeShot(s); s.dead = true; break; }
        if (!s.pierce) { s.dead = true; break; }
      }
    } else if (Math.hypot(P.x - s.x, P.y - s.y) < P.r + s.r - 1) {
      if (P.roll > 0 || P.iframes > 0) continue_();
      else { s.dead = true; if (s.slow) P.chill = 1.5; hurtPlayer(1, s.src && (s.src.d || s.src.B) ? s.src : { name: 'a stray shot' }); }
    }
  });
  function continue_() {}
  shots = shots.filter(s => !s.dead);
  // hazards
  hazards.forEach(h => {
    h.t += dt;
    if (h.kind === 'warn' && h.t >= h.dur) {
      h.dead = true;
      if (h.then && h.then.kind === 'blast') { explode(h.x, h.y, h.then.r, 1, false); hazards.push({ kind: 'fire', x: h.x, y: h.y, r: 10, t: 0, dur: 2.5, dmg: 1 }); }
      else if (h.then) hazards.push(Object.assign({ x: h.x, y: h.y, t: 0 }, h.then));
    }
    if ((h.kind === 'spore' || h.kind === 'fire') && h.t < h.dur) {
      if (h.friendly) enemies.forEach(e => { if (!e.dead && dist(e, h) < h.r + e.r && (!e.hitBy.fire || t - e.hitBy.fire > 0.4)) { e.hitBy.fire = t; damageEnemy(e, h.dmg, { raw: true, noStatus: true, col: '#ff8a3a' }); } });
      else if (dist(P, h) < h.r * 0.85) hurtPlayer(h.dmg || 1, { name: h.kind === 'spore' ? 'toxic spores' : 'the flames' });
      if (Math.random() < dt * 10) parts.push({ x: h.x + rand(-h.r, h.r) * 0.7, y: h.y + rand(-h.r, h.r) * 0.5, vx: 0, vy: rand(-20, -8), life: 0.6, t: 0, col: h.kind === 'spore' ? '#8ae06a' : (Math.random() < 0.5 ? '#ff8a3a' : '#ffe650'), s: 1 });
    }
    if (h.t >= h.dur && h.kind !== 'warn') h.dead = true;
  });
  hazards = hazards.filter(h => !h.dead);
  // beams
  beams.forEach(bm => {
    if (bm.warm > 0 || !boss) return;
    const ex = boss.x + Math.cos(bm.a) * 400, ey = boss.y + Math.sin(bm.a) * 400;
    const L2 = (ex - boss.x) ** 2 + (ey - boss.y) ** 2, u = clamp(((P.x - boss.x) * (ex - boss.x) + (P.y - boss.y) * (ey - boss.y)) / L2, 0, 1);
    if (Math.hypot(P.x - (boss.x + u * (ex - boss.x)), P.y - (boss.y + u * (ey - boss.y))) < 5) hurtPlayer(1, boss.B);
  });
  // pickups
  pickups.forEach(p => {
    p.t = (p.t || 0) + dt;
    if (p.kind === 'soul') {
      if (p.t < (p.delay || 0)) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; return; }
      const a = Math.atan2(P.y - p.y, P.x - p.x), sp = 60 + p.t * 220;
      p.x += Math.cos(a) * sp * dt; p.y += Math.sin(a) * sp * dt;
      if (dist(p, P) < 5) { p.dead = true; run.souls++; SND.soul(); }
      return;
    }
    if (p.vx || p.vy) { moveEnt(Object.assign(p, { r: 2 }), p.vx * dt, p.vy * dt, false); p.vx *= 0.9; p.vy *= 0.9; if (Math.abs(p.vx) < 1) p.vx = 0; if (Math.abs(p.vy) < 1) p.vy = 0; }
    const d = dist(p, P);
    if (run.st.magnet && !p.shop && !p.pedestal && p.kind !== 'relic' && d < 70 && d > 4) { const a = Math.atan2(P.y - p.y, P.x - p.x); p.x += Math.cos(a) * 110 * dt; p.y += Math.sin(a) * 110 * dt; }
    if (p.kind === 'coin' && d < 40 && p.t > 0.4 && !p.shop) { const a = Math.atan2(P.y - p.y, P.x - p.x); p.x += Math.cos(a) * 70 * dt; p.y += Math.sin(a) * 70 * dt; }
    if (d < (p.kind === 'relic' ? 9 : 7) && p.t > 0.3) collect(p);
  });
  pickups = pickups.filter(p => !p.dead);
  // chests
  chests.forEach(c => {
    if (c.open || dist(c, P) > 12) return;
    if (c.gold && run.keys <= 0) { if (!c.warned) { c.warned = true; toast('Golden chests need a KEY', '#ffcc33', 1.8); } return; }
    if (c.gold) run.keys--;
    c.open = true; SND.chest(); burst(c.x, c.y, 20, '#ffe650', 60);
    if (c.gold) { const r = rollRelic(null, Math.random() < 0.3 ? 2 : 1) || rollRelic(); if (r) pickups.push(relicPickup(r, c.x, c.y + 14, { vx: 0, vy: 0 })); }
    else {
      const n = 3 + Math.floor(Math.random() * 4); for (let k = 0; k < n; k++) pickups.push({ kind: 'coin', x: c.x, y: c.y, vx: rand(-70, 70), vy: rand(10, 80), t: 0 });
      const x = Math.random(); if (x < 0.25) pickups.push({ kind: 'heart', val: 2, x: c.x, y: c.y + 8, vx: rand(-30, 30), vy: 40, t: 0 }); else if (x < 0.45) pickups.push({ kind: 'key', x: c.x, y: c.y + 8, vx: rand(-30, 30), vy: 40, t: 0 }); else if (x < 0.6) pickups.push({ kind: 'potion', x: c.x, y: c.y + 8, vx: rand(-30, 30), vy: 40, t: 0 });
    }
  });
  checkClear();
}
function explodeShot(s) {
  burst(s.x, s.y, 14, '#ff8a3a', 70); fx.push({ kind: 'ring', x: s.x, y: s.y, r: 2, max: s.splash, t: 0, col: '#ffb070' }); SND.pop();
  enemies.forEach(e => { if (!e.dead && !s.hit.has(e) && dist(e, s) < s.splash + e.r) damageEnemy(e, s.dmg * 0.5, {}); });
  breakAround(s.x, s.y, s.splash);
}
function collect(p) {
  if (p.shop) {
    const price = Math.max(1, Math.round(p.price * (1 - run.st.discount)));
    if (run.gold < price) { if (!p.warned || t - p.warned > 2) { p.warned = t; toast(`Need ${price} gold`, '#ff8c78', 1.4); SND.nope(); } return; }
    if (p.kind === 'heart' && P.hp >= P.maxhp) { if (!p.warned || t - p.warned > 2) { p.warned = t; toast('Already at full health', '#c8c0e8', 1.2); } return; }
    run.gold -= price; p.shop = false; SND.buy();
  }
  if (p.kind === 'coin') { run.gold += 1; p.dead = true; SND.coin(); }
  else if (p.kind === 'heart') { if (P.hp >= P.maxhp) return; P.hp = Math.min(P.maxhp, P.hp + (p.val || 2)); p.dead = true; SND.heal(); burst(p.x, p.y, 10, '#ff6a8a', 40); }
  else if (p.kind === 'key') { run.keys++; p.dead = true; SND.key(); }
  else if (p.kind === 'potion') { if (run.potions >= 3) { if (!p.warned) { p.warned = true; toast('You can carry 3 potions', '#c8c0e8', 1.4); } return; } run.potions++; p.dead = true; SND.key(); }
  else if (p.kind === 'relic') {
    if (p.altar) {
      if (P.maxhp <= 2) { if (!p.warned) { p.warned = true; toast('Too weak to make the blood offering', '#ff8c78', 2); } return; }
      run.relics.push({ id: 'blood_offering', name: 'Blood Offering', fx: { maxhp: -2 }, hidden: true });
      toast('The altar drinks your blood... (-1 max heart)', '#ff3a4a', 3); SND.hurt();
    }
    p.dead = true; run.relics.push(p.relic); save.seenRelics[p.relic.id] = 1; store(); recalc();
    relicBanner = { r: p.relic, t: 0 }; SND.relic(); flashW = 0.25;
    burst(p.x, p.y, 30, RARITY_COL[p.relic.r], 90);
    if (p.group) pickups.forEach(o => { if (o.group === p.group && o !== p) { o.dead = true; burst(o.x, o.y, 20, '#8a7aa0', 60); } });
  }
}
let relicBanner = null;

// ------------------------------------------------------------ particles
function burst(x, y, n, col, sp) { for (let k = 0; k < n; k++) { const a = rand(0, 6.283), v = rand(0.2, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: rand(0.25, 0.6), t: 0, col, s: Math.random() < 0.3 ? 2 : 1, g: 60 }); } }
function updateParts(dt) {
  parts.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + (p.g || 0) * dt; });
  parts = parts.filter(p => p.t < p.life);
  if (parts.length > 600) parts.splice(0, parts.length - 600);
  nums.forEach(n => { n.t += dt; n.y -= 18 * dt; }); nums = nums.filter(n => n.t < 0.8);
  fx.forEach(f => { f.t += dt; }); fx = fx.filter(f => f.t < (f.dur || 0.3));
}

// ------------------------------------------------------------ world drawing (low-res)
function px(x, y, col, w = 1, h = 1) { lx.fillStyle = col; lx.fillRect(Math.round(x), Math.round(y), w, h); }
function drawSpr(img, x, y, o = {}) {
  const sc = o.scale || 1, w = img.width * sc, h = img.height * sc;
  lx.save(); lx.translate(Math.round(x), Math.round(y));
  if (o.rot) lx.rotate(o.rot);
  lx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
  if (o.alpha !== undefined) lx.globalAlpha = o.alpha;
  lx.drawImage(img, -w / 2, -h + (o.oy || 0), w, h);
  lx.restore();
}
function drawRoomAt(rm, ox, oy, live) {
  lx.drawImage(rm.cv, ox, oy);
  lx.drawImage(rm.decal, ox, oy);
  const L = look();
  // animated pits (lava bubbles / water glints)
  if (L.pit !== 'void') for (let r = 1; r < RH - 1; r++) for (let c = 1; c < RW - 1; c++) {
    if (rm.layout[r - 1][c - 1] !== 'p') continue;
    const X = ox + c * TS, Y = oy + r * TS;
    for (let k = 0; k < 3; k++) {
      const ph = (t * (L.pit === 'lava' ? 0.8 : 0.5) + k * 0.33 + c * 0.17 + r * 0.29) % 1;
      const bx = X + 2 + ((k * 5 + c * 3) % 11), by = Y + 5 + ((k * 4 + r * 7) % 9);
      if (L.pit === 'lava') { lx.globalAlpha = Math.sin(ph * Math.PI); px(bx, by, ph < 0.5 ? '#ffd040' : '#ff8a1a', 2, 1); }
      else { lx.globalAlpha = Math.sin(ph * Math.PI) * 0.6; px(bx, by, '#a8d8ff', 3, 1); }
    }
    lx.globalAlpha = 1;
  }
  // crates & urns
  for (let r = 1; r < RH - 1; r++) for (let c = 1; c < RW - 1; c++) {
    if (rm.layout[r - 1][c - 1] === 'x') {
      const img = sprite((c + r) % 3 === 0 ? 'urn' : 'crate');
      lx.fillStyle = 'rgba(0,0,0,0.35)'; lx.beginPath(); lx.ellipse(ox + c * TS + 9, oy + r * TS + 14, 7, 2, 0, 0, 6.3); lx.fill();
      lx.drawImage(img, ox + c * TS + 8 - img.width / 2, oy + r * TS + 14 - img.height);
    }
  }
  // doors: stone arches with iron gates
  const open = rm.cleared;
  for (const d in rm.doors) {
    const n = run.map.rooms[run.map.key(rm.x + DIRS[d][0], rm.y + DIRS[d][1])];
    const bossDoor = (n && n.type === 'boss') || rm.type === 'boss';
    const special = n && ({ treasure: '#e8c060', shop: '#4ae07a', altar: '#e83a4a' }[n.type]);
    const [dc, dr] = { n: [8, 0], s: [8, RH - 1], w: [0, 5], e: [RW - 1, 5] }[d];
    const X = ox + dc * TS, Y = oy + dr * TS;
    const frame = bossDoor ? '#6a1a24' : shade(L.cap, -0.15), frameL = bossDoor ? '#a82a3a' : L.cap;
    if (d === 'n') {
      px(X, Y, '#030106', TS, TS); px(X + 2, Y + 2, '#0a0610', 12, 14);
      px(X - 3, Y, frame, 3, TS); px(X + TS, Y, frame, 3, TS); px(X - 3, Y, frameL, 1, TS); px(X - 3, Y, frameL, TS + 6, 2);
      if (bossDoor) { px(X + 5, Y + 1, '#e8e4d8', 6, 4); px(X + 6, Y + 2, '#2a0a10'); px(X + 9, Y + 2, '#2a0a10'); }
      if (special) { px(X + 6, Y + 1, special, 4, 2); }
    } else if (d === 's') {
      px(X, Y, '#030106', TS, TS);
      px(X - 3, Y, frame, 3, TS); px(X + TS, Y, frame, 3, TS); px(X - 3, Y, frameL, TS + 6, 1);
      if (special) px(X + 6, Y + 12, special, 4, 2);
    } else {
      px(X, Y, '#030106', TS, TS);
      px(X, Y - 3, frame, TS, 3); px(X, Y + TS, frame, TS, 3); px(X, Y - 3, frameL, TS, 1);
      if (special) px(X + (d === 'w' ? 1 : 12), Y + 6, special, 3, 4);
    }
    if (!open) {
      const g = bossDoor ? '#8a2a34' : '#5a5468', gh = bossDoor ? '#c8505a' : '#8a849a';
      for (let k = 0; k < 4; k++) {
        if (d === 'n' || d === 's') { px(X + 1 + k * 4, Y, g, 2, TS); px(X + 1 + k * 4, Y, gh, 1, TS); }
        else { px(X, Y + 1 + k * 4, g, TS, 2); px(X, Y + 1 + k * 4, gh, TS, 1); }
      }
      if (d === 'n' || d === 's') { px(X, Y + 5, g, TS, 2); px(X, Y + 11, g, TS, 2); } else { px(X + 5, Y, g, 2, TS); px(X + 11, Y, g, 2, TS); }
    }
  }
  // torch flames
  (rm.torches || []).forEach((tc, i) => {
    const fx_ = ox + tc.x, fy = oy + tc.y, f = Math.floor(t * 10 + i * 3) % 3;
    px(fx_ - 2, fy - 3, '#ff6a1a', 4, 4);
    px(fx_ - 1 - (f === 1 ? 1 : 0), fy - 6, '#ff8a2a', 3, 3);
    px(fx_ - 1 + (f === 2 ? 1 : 0), fy - 8, '#ffb040', 2, 2);
    px(fx_ - 1, fy - 3, '#ffe680', 2, 3);
    px(fx_, fy - 1, '#ffffff');
    if (live && Math.random() < 0.08) parts.push({ x: tc.x + rand(-1, 1), y: tc.y - 8, vx: rand(-3, 3), vy: rand(-18, -8), life: 0.7, t: 0, col: Math.random() < 0.5 ? '#ffb040' : '#5a4a4a', s: 1 });
  });
  // candle flames + pulsing glow spots
  (rm.lights || []).forEach((l, i) => {
    if (l.candle) { const f = Math.sin(t * 14 + i * 3) > 0; px(ox + l.x - (f ? 1 : 0), oy + l.y - 1, '#ffb040', 1, 2); px(ox + l.x, oy + l.y, '#ffe680'); }
  });
  if (rm.stairs) {
    const s = sprite('stairs');
    lx.drawImage(s, ox + rm.stairs.x - 8, oy + rm.stairs.y - 6);
    lx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3); px(ox + rm.stairs.x - 10, oy + rm.stairs.y - 8, run.theme.accent, 20, 16); lx.globalAlpha = 1;
  }
}
function drawShots() {
  shots.forEach(s => {
    if (s.kind === 'arrow') {
      const a = s.ang;
      lx.globalAlpha = 0.35; for (let k = 2; k < 9; k++) px(s.x - Math.cos(a) * k * 1.4, s.y - Math.sin(a) * k * 1.4, '#e8d8b0'); lx.globalAlpha = 1;
      for (let k = 0; k < 6; k++) px(s.x - Math.cos(a) * k, s.y - Math.sin(a) * k, k < 2 ? '#e8eef8' : '#a07040');
      px(s.x - Math.cos(a) * 6 - Math.sin(a), s.y - Math.sin(a) * 6 + Math.cos(a), '#ffffff'); px(s.x - Math.cos(a) * 6 + Math.sin(a), s.y - Math.sin(a) * 6 - Math.cos(a), '#ffffff');
    } else if (s.kind === 'beam') {
      lx.globalAlpha = Math.min(1, s.life * 3);
      lx.strokeStyle = 'rgba(168,240,255,0.5)'; lx.lineWidth = 4; lx.beginPath(); lx.arc(s.x - Math.cos(s.ang) * 6, s.y - Math.sin(s.ang) * 6, 6 * run.st.range, s.ang - 1, s.ang + 1); lx.stroke();
      lx.strokeStyle = '#ffffff'; lx.lineWidth = 1; lx.beginPath(); lx.arc(s.x - Math.cos(s.ang) * 6, s.y - Math.sin(s.ang) * 6, 6 * run.st.range, s.ang - 0.9, s.ang + 0.9); lx.stroke();
      lx.globalAlpha = 1;
    } else if (s.kind === 'fireball') {
      const r = Math.max(2, Math.round(s.r));
      lx.globalAlpha = 0.3; lx.fillStyle = '#ff6a1a'; lx.beginPath(); lx.arc(s.x, s.y, r + 3, 0, 6.3); lx.fill(); lx.globalAlpha = 1;
      lx.fillStyle = '#ff6a1a'; lx.beginPath(); lx.arc(s.x, s.y, r, 0, 6.3); lx.fill();
      lx.fillStyle = '#ffd040'; lx.beginPath(); lx.arc(s.x + Math.cos(s.ang) * 0.5, s.y + Math.sin(s.ang) * 0.5, r * 0.6, 0, 6.3); lx.fill();
      px(s.x, s.y - 1, '#ffffff');
      if (Math.random() < 0.6) parts.push({ x: s.x - Math.cos(s.ang) * r, y: s.y - Math.sin(s.ang) * r, vx: rand(-10, 10), vy: rand(-14, 4), life: 0.35, t: 0, col: Math.random() < 0.5 ? '#ff8a3a' : '#ffd040', s: 1 });
    } else {
      // glowing orb
      const r = Math.max(1.5, s.r);
      lx.globalAlpha = 0.16; lx.fillStyle = s.col; lx.beginPath(); lx.arc(s.x, s.y, r + 2, 0, 6.3); lx.fill(); lx.globalAlpha = 1;
      if (s.enemy) { lx.fillStyle = '#10060c'; lx.beginPath(); lx.arc(s.x, s.y, r + 0.8, 0, 6.3); lx.fill(); }
      lx.fillStyle = s.col; lx.beginPath(); lx.arc(s.x, s.y, r, 0, 6.3); lx.fill();
      lx.fillStyle = 'rgba(255,255,255,0.8)'; lx.fillRect(Math.round(s.x - r * 0.5), Math.round(s.y - r * 0.5), 1, 1);
    }
  });
}
// floating dust in the light
let motes = [];
function drawMotes(dt) {
  while (motes.length < 26) motes.push({ x: rand(TS, (RW - 1) * TS), y: rand(TS, (RH - 1) * TS), ph: rand(0, 6), s: rand(0.3, 1) });
  motes.forEach(m => { m.ph += dt; m.x += Math.sin(m.ph * 0.7) * 3 * dt; m.y -= (2 + m.s * 3) * dt; if (m.y < TS) { m.y = (RH - 1) * TS; m.x = rand(TS, (RW - 1) * TS); }
    const a = (0.25 + 0.25 * Math.sin(m.ph * 2)) * m.s; lx.globalAlpha = a; px(m.x, m.y, run.theme.deco === 'lava' ? '#ffb070' : run.theme.deco === 'mushrooms' ? '#c8ffb0' : '#d8d0f0'); });
  lx.globalAlpha = 1;
}
function drawWorld() {
  const F = run.theme;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.fillStyle = '#05030a'; lx.fillRect(0, 0, LW, LH);
  shakeX = shake > 0 ? Math.round(rand(-1, 1) * shake * 5) : 0; shakeY = shake > 0 ? Math.round(rand(-1, 1) * shake * 5) : 0;
  if (transition) {
    const u = transition.t, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const [ddx, ddy] = DIRS[transition.dir];
    const offX = -ddx * RW * TS * e, offY = -ddy * RH * TS * e;
    drawRoomAt(transition.from, RX + offX, RY + offY, false);
    drawRoomAt(transition.to, RX + offX + ddx * RW * TS, RY + offY + ddy * RH * TS, false);
    return;
  }
  lx.translate(RX + shakeX, RY + shakeY);
  drawRoomAt(room, 0, 0, true);
  // hazards (under)
  hazards.forEach(h => {
    if (h.kind === 'warn') { const u = clamp(h.t / h.dur, 0, 1); lx.strokeStyle = `rgba(255,60,60,${0.4 + 0.5 * u})`; lx.lineWidth = 1; lx.beginPath(); lx.arc(h.x, h.y, h.r, 0, 6.3); lx.stroke(); lx.fillStyle = `rgba(255,60,60,${0.15 * u})`; lx.beginPath(); lx.arc(h.x, h.y, h.r * u, 0, 6.3); lx.fill(); }
    else if (h.kind === 'spore') { lx.fillStyle = `rgba(120,220,90,${0.25 * (1 - h.t / h.dur) + 0.1})`; lx.beginPath(); lx.arc(h.x, h.y, h.r, 0, 6.3); lx.fill(); }
    else if (h.kind === 'fire') { const a = 1 - h.t / h.dur; for (let k = 0; k < 4; k++) px(h.x + Math.sin(t * 9 + k * 2) * h.r * 0.5 - 1, h.y - Math.abs(Math.sin(t * 13 + k)) * 4, k % 2 ? '#ff8a3a' : '#ffe650', 2, 2); lx.fillStyle = `rgba(255,120,40,${0.18 * a})`; lx.beginPath(); lx.arc(h.x, h.y, h.r, 0, 6.3); lx.fill(); }
  });
  fx.forEach(f => { if (f.kind === 'line') { lx.strokeStyle = `rgba(255,80,40,${0.6 * Math.sin(f.t / f.dur * Math.PI)})`; lx.lineWidth = 6; lx.beginPath(); lx.moveTo(f.x, f.y); lx.lineTo(f.x + Math.cos(f.a) * 300, f.y + Math.sin(f.a) * 300); lx.stroke(); } });
  // chests
  chests.forEach(c => { const img = sprite(c.open ? 'chestopen' : (c.gold ? 'goldchest' : 'chest')); lx.drawImage(img, Math.round(c.x - img.width / 2), Math.round(c.y - img.height / 2)); if (c.gold && !c.open) { if (Math.sin(t * 4) > 0.7) px(c.x + 4, c.y - 6, '#ffffff'); } });
  // shop keeper
  if (room.keeper) { drawSpr(sprite('cultist', '#e8c060'), room.keeper.x, room.keeper.y + 8, { flip: P.x < room.keeper.x }); }
  // entities sorted by y
  const list = [];
  pickups.forEach(p => list.push({ y: p.y - 4, f: () => drawPickup(p) }));
  enemies.forEach(e => list.push({ y: e.y, f: () => drawEnemy(e) }));
  list.push({ y: P.y, f: drawPlayer });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  drawShots();
  // beams
  beams.forEach(bm => {
    if (!boss) return;
    const ex = boss.x + Math.cos(bm.a) * 400, ey = boss.y + Math.sin(bm.a) * 400;
    lx.strokeStyle = bm.warm > 0 ? `rgba(196,108,255,${0.3 + 0.3 * Math.sin(t * 30)})` : '#ff3aff'; lx.lineWidth = bm.warm > 0 ? 1 : 5;
    lx.beginPath(); lx.moveTo(boss.x, boss.y); lx.lineTo(ex, ey); lx.stroke();
    if (bm.warm <= 0) { lx.strokeStyle = '#ffffff'; lx.lineWidth = 1; lx.beginPath(); lx.moveTo(boss.x, boss.y); lx.lineTo(ex, ey); lx.stroke(); }
  });
  // effects
  fx.forEach(f => {
    if (f.kind === 'slash') {
      const u = f.t / 0.3; lx.strokeStyle = `rgba(230,240,255,${1 - u})`; lx.lineWidth = 3 - u * 2;
      lx.beginPath(); const a0 = f.a - 1.1, a1 = f.a + 1.1; lx.arc(f.x, f.y, f.r * (0.7 + u * 0.3), f.dir > 0 ? a0 : a1, f.dir > 0 ? a1 : a0, f.dir < 0); lx.stroke();
      lx.strokeStyle = `rgba(160,220,255,${0.5 * (1 - u)})`; lx.lineWidth = 1; lx.beginPath(); lx.arc(f.x, f.y, f.r * 0.55, a0, a1); lx.stroke();
    } else if (f.kind === 'ring') { const u = f.t / 0.3; lx.strokeStyle = rgba(f.col, 1 - u); lx.lineWidth = 2; lx.beginPath(); lx.arc(f.x, f.y, lerp(f.r, f.max, u), 0, 6.3); lx.stroke(); }
    else if (f.kind === 'bolt') { lx.strokeStyle = `rgba(255,240,120,${1 - f.t / 0.3})`; lx.lineWidth = 1; lx.beginPath(); lx.moveTo(f.x1, f.y1); for (let k = 1; k < 5; k++) lx.lineTo(lerp(f.x1, f.x2, k / 5) + rand(-3, 3), lerp(f.y1, f.y2, k / 5) + rand(-3, 3)); lx.lineTo(f.x2, f.y2); lx.stroke(); }
  });
  parts.forEach(p => { lx.globalAlpha = 1 - p.t / p.life; px(p.x, p.y, p.col, p.s, p.s); }); lx.globalAlpha = 1;
  drawMotes(screen === 'play' ? 1 / 60 : 0);
  // lighting
  lx.setTransform(1, 0, 0, 1, 0, 0);
  drawDarkness();
  // damage numbers (on top of the darkness)
  lx.translate(RX + shakeX, RY + shakeY);
  lx.setTransform(1, 0, 0, 1, 0, 0);
}
function drawPickup(p) {
  const bob = Math.sin(p.t * 4) * 1.5;
  if (p.kind === 'soul') { px(p.x - 1, p.y - 1, '#8ad8ff', 2, 2); px(p.x, p.y, '#ffffff'); return; }
  if (p.pedestal) { const ped = sprite('pedestal'); lx.drawImage(ped, Math.round(p.x - 6), Math.round(p.y - 2)); if (p.altar) { const al = sprite('altar'); lx.drawImage(al, Math.round(p.x - 6), Math.round(p.y - 2)); } }
  if (p.shop) { const ped = sprite('pedestal'); lx.drawImage(ped, Math.round(p.x - 6), Math.round(p.y + 2)); }
  const lift = p.pedestal || p.shop ? -8 : 0;
  if (p.kind === 'relic') {
    const ic = relicIcon(p.relic), c = RARITY_COL[p.relic.r];
    lx.globalAlpha = 0.25 + 0.15 * Math.sin(p.t * 3); lx.fillStyle = c; lx.beginPath(); lx.arc(p.x, p.y + lift - 2 + bob, 9, 0, 6.3); lx.fill(); lx.globalAlpha = 1;
    lx.drawImage(ic, Math.round(p.x - 5), Math.round(p.y + lift - 7 + bob));
  } else {
    const img = sprite(p.kind === 'heart' ? 'heart' : p.kind);
    lx.drawImage(img, Math.round(p.x - img.width / 2), Math.round(p.y + lift - img.height + 2 + (p.shop ? bob : 0)));
  }
}
function drawEnemy(e) {
  if (e.isBoss) return drawBoss(e);
  const img = sprite(e.d.sprite, e.d.tint), wimg = SPR[e.d.sprite + (e.d.tint || '') + '_w'];
  const sc = (e.small ? 0.65 : (e.elite ? 1.25 : 1)) * (e.d.scale || 1);
  let sy = 1, sx = 1, oy = 0;
  if (e.d.ai === 'hop') { const ph = e.t % 1.1; if (ph > 0.35 && ph < 0.55) { sy = 0.8; sx = 1.2; } oy = -(e.z || 0); }
  else if (e.d.fly) oy = -3 - Math.sin(e.t * 6) * 2;
  else { const w = Math.sin(e.t * 10) * (Math.hypot(e.vx, e.vy) > 5 ? 1 : 0); oy = -Math.abs(w); }
  if (e.spawn > 0) { lx.globalAlpha = 1 - e.spawn / 0.5; }
  // shadow
  lx.fillStyle = 'rgba(0,0,0,0.35)'; lx.beginPath(); lx.ellipse(e.x, e.y + 1, e.r, e.r * 0.4, 0, 0, 6.3); lx.fill();
  const alpha = e.d.ai === 'phase' ? e.alpha : undefined;
  if (e.elite) { lx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 6); drawSpr(wimg, e.x + 1, e.y + 1 + oy, { scale: sc * 1.1, flip: e.face < 0, sx, sy }); lx.globalAlpha = 1; }
  drawSpr(e.flash > 0 ? wimg : img, e.x + (e.shakeX || 0), e.y + oy, { scale: sc, flip: e.face < 0, sx, sy, alpha });
  if (e.elite) { px(e.x - 3, e.y - img.height * sc - 4 + oy, '#ffcc33', 6, 1); }
  if (e.burn > 0 && Math.random() < 0.3) parts.push({ x: e.x + rand(-3, 3), y: e.y - 6, vx: 0, vy: -20, life: 0.3, t: 0, col: '#ff8a3a', s: 1 });
  if (e.poison > 0 && Math.random() < 0.2) parts.push({ x: e.x + rand(-3, 3), y: e.y - 6, vx: 0, vy: -10, life: 0.4, t: 0, col: '#6ae06a', s: 1 });
  if (e.slow > 0) { px(e.x - 4, e.y - 2, 'rgba(168,240,255,0.6)', 8, 2); }
  if (e.state === 'wind') { px(e.x - 1, e.y - img.height * sc - 6, '#ff3a3a', 2, 3); }
  lx.globalAlpha = 1;
  if (e.hp < e.maxhp && !e.isBoss) { px(e.x - 6, e.y + 3, '#1a0a14', 12, 2); px(e.x - 6, e.y + 3, '#e83a4a', 12 * Math.max(0, e.hp / e.maxhp), 2); }
}
function drawBoss(b) {
  if (b.id === 'frostwyrm') {
    if (b.under) { lx.fillStyle = 'rgba(168,240,255,0.25)'; lx.beginPath(); lx.ellipse(b.x, b.y, 10, 4, 0, 0, 6.3); lx.fill(); return; }
    for (let k = b.segs.length - 1; k >= 0; k--) {
      const s = b.segs[k], r = 7 - k * 0.3;
      lx.fillStyle = '#0a1a2a'; lx.beginPath(); lx.arc(s.x, s.y, r + 1, 0, 6.3); lx.fill();
      lx.fillStyle = b.flash > 0 ? '#ffffff' : (k % 2 ? '#5a9ac8' : '#7ab8e0'); lx.beginPath(); lx.arc(s.x, s.y, r, 0, 6.3); lx.fill();
      px(s.x - 1, s.y - r - 2, '#e8f8ff', 2, 3);
    }
    const a = b.ang || 0;
    lx.save(); lx.translate(b.x, b.y); lx.rotate(a);
    lx.fillStyle = '#0a1a2a'; lx.fillRect(-9, -8, 20, 16);
    lx.fillStyle = b.flash > 0 ? '#ffffff' : '#a8e0f8'; lx.fillRect(-8, -7, 18, 14);
    lx.fillStyle = '#e8f8ff'; lx.fillRect(-8, -7, 18, 3);
    lx.fillStyle = '#ff3a3a'; lx.fillRect(4, -5, 3, 2); lx.fillRect(4, 3, 3, 2);
    lx.fillStyle = '#ffffff'; lx.fillRect(10, -6, 3, 2); lx.fillRect(10, 4, 3, 2);
    lx.fillStyle = '#c8f0ff'; lx.fillRect(-6, -11, 2, 4); lx.fillRect(-6, 7, 2, 4);
    lx.restore();
    return;
  }
  const B = b.B, img = sprite(B.sprite, B.tint), wimg = SPR[B.sprite + (B.tint || '') + '_w'];
  let sc = B.scale, oy = -(b.z || 0);
  if (b.act === 'intro') { const u = clamp(b.t / 1.5, 0, 1); sc *= 0.3 + 0.7 * u; lx.globalAlpha = u; }
  if (b.id === 'voidlord') {
    oy -= 6;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + t * 0.7; lx.strokeStyle = '#3a1a5a'; lx.lineWidth = 3; lx.beginPath(); lx.moveTo(b.x, b.y - 18); for (let j = 1; j < 6; j++) lx.lineTo(b.x + Math.cos(a + Math.sin(t * 2 + j) * 0.3) * j * 6, b.y - 18 + Math.sin(a + Math.sin(t * 2 + j) * 0.3) * j * 6); lx.stroke(); }
  }
  lx.fillStyle = 'rgba(0,0,0,0.4)'; lx.beginPath(); lx.ellipse(b.x, b.y + 2, b.r, b.r * 0.35, 0, 0, 6.3); lx.fill();
  drawSpr(b.flash > 0 ? wimg : img, b.x, b.y + oy + 2, { scale: sc, flip: b.face < 0 });
  if (B.crown) { const cy = b.y + oy + 2 - img.height * sc - 3; px(b.x - 8, cy, '#ffcc33', 16, 4); for (let k = 0; k < 4; k++) px(b.x - 8 + k * 5, cy - 3, '#ffcc33', 2, 3); px(b.x - 1, cy + 1, '#e83a4a', 2, 2); }
  if (b.phase === 2 && Math.random() < 0.3) parts.push({ x: b.x + rand(-b.r, b.r), y: b.y - rand(0, b.r * 2), vx: 0, vy: -30, life: 0.5, t: 0, col: '#ff3a3a', s: 1 });
  lx.globalAlpha = 1;
}
function drawPlayer() {
  const cls = run.cls.id, img = sprite(cls), wimg = SPR[cls + '_w'];
  const moving = Math.hypot(P.vx, P.vy) > 8;
  let oy = moving ? -Math.abs(Math.sin(P.walkT)) * 1.5 : 0, rot = 0, sx = 1, sy = 1;
  if (P.roll > 0) { rot = (1 - P.roll / 0.26) * Math.PI * 2 * (P.rollDir.x >= 0 ? 1 : -1); }
  if (P.spin > 0) rot = (1 - P.spin / 0.4) * Math.PI * 4;
  lx.fillStyle = 'rgba(0,0,0,0.4)'; lx.beginPath(); lx.ellipse(P.x, P.y + 1, 5, 2, 0, 0, 6.3); lx.fill();
  const blink = P.iframes > 0 && Math.floor(P.iframes * 15) % 2 === 0;
  if (!blink) {
    // weapon behind/in front
    const a = P.aim, hx = P.x + Math.cos(a) * 4, hy = P.y - 6 + Math.sin(a) * 3;
    const drawWeapon = () => {
      if (P.roll > 0 || P.spin > 0) return;
      lx.save(); lx.translate(Math.round(hx), Math.round(hy));
      if (cls === 'knight') { const sw = P.swing > 0 ? (P.swingDir || 1) * (1 - P.swing / 0.18) * 2.2 - (P.swingDir || 1) * 1.1 : 0; lx.rotate(a + sw); lx.fillStyle = '#5a3a1a'; lx.fillRect(0, -1, 3, 2); lx.fillStyle = '#e8c060'; lx.fillRect(3, -2, 1, 4); lx.fillStyle = '#e8eef8'; lx.fillRect(4, -1, 10, 2); lx.fillStyle = '#ffffff'; lx.fillRect(4, -1, 10, 1); }
      else if (cls === 'ranger') { lx.rotate(a); lx.strokeStyle = '#a07040'; lx.lineWidth = 1.5; lx.beginPath(); lx.arc(2, 0, 7, -1.2, 1.2); lx.stroke(); lx.strokeStyle = '#e8e4d8'; lx.lineWidth = 0.6; lx.beginPath(); lx.moveTo(2 + Math.cos(-1.2) * 7, Math.sin(-1.2) * 7); lx.lineTo(P.atkCd > 0.1 ? 2 : -2, 0); lx.lineTo(2 + Math.cos(1.2) * 7, Math.sin(1.2) * 7); lx.stroke(); }
      else { lx.rotate(a); lx.fillStyle = '#6a4a2a'; lx.fillRect(-2, -1, 13, 2); lx.fillStyle = '#c46cff'; lx.fillRect(11, -2, 3, 3); lx.fillStyle = '#ffffff'; lx.fillRect(12, -1, 1, 1); }
      lx.restore();
    };
    if (Math.sin(P.aim) < 0) drawWeapon();
    drawSpr(P.iframes > 0.85 ? wimg : img, P.x, P.y + 1 + oy, { flip: P.face < 0, rot, sx, sy });
    if (Math.sin(P.aim) >= 0) drawWeapon();
  }
  // orbitals
  for (let k = 0; k < run.st.orbitals; k++) { const a = P.orbT + k * Math.PI * 2 / run.st.orbitals; const ox = P.x + Math.cos(a) * 22 * run.st.range, oy2 = P.y - 4 + Math.sin(a) * 22 * run.st.range; px(ox - 3, oy2 - 3, '#0a0610', 6, 6); px(ox - 2, oy2 - 2, '#e8e4d8', 4, 4); px(ox - 2, oy2 - 1, '#1a1020', 1, 1); px(ox + 1, oy2 - 1, '#1a1020', 1, 1); }
  if (run.st.wisp) { px(P.wisp.x - 2, P.wisp.y - 2, 'rgba(255,230,128,0.4)', 5, 5); px(P.wisp.x - 1, P.wisp.y - 1, '#ffe680', 3, 3); px(P.wisp.x, P.wisp.y, '#ffffff'); }
}
function drawDarkness() {
  const L = look();
  let darkness = run.theme.dark * (room.cleared ? 0.62 : 1) * (room.type === 'boss' ? 0.8 : 1);
  const [tr, tg, tb] = hex(L.tint);
  dx.globalCompositeOperation = 'source-over';
  dx.clearRect(0, 0, LW, LH);
  dx.fillStyle = `rgba(${tr},${tg},${tb},${Math.min(0.9, darkness + 0.08)})`; dx.fillRect(0, 0, LW, LH);
  dx.globalCompositeOperation = 'destination-out';
  const light = (x, y, r, a = 1) => { const g = dx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dx.fillStyle = g; dx.fillRect(x - r, y - r, r * 2, r * 2); };
  const ox = RX + shakeX, oy = RY + shakeY;
  light(P.x + ox, P.y + oy - 4, 72 + Math.sin(t * 3) * 2, 0.95);
  (room.torches || []).forEach((tc, i) => light(tc.x + ox, tc.y + oy - 2, 52 + Math.sin(t * 9 + i) * 3, 0.9));
  (room.lights || []).forEach((l, i) => light(l.x + ox, l.y + oy, l.r * (1 + 0.08 * Math.sin(t * 5 + i)), l.a));
  shots.forEach(s => { if (s.kind === 'fireball' || s.enemy) light(s.x + ox, s.y + oy, s.enemy ? 9 : 22, s.enemy ? 0.35 : 0.6); });
  pickups.forEach(p => { if (p.kind === 'relic') light(p.x + ox, p.y + oy - 6, 28, 0.8); else if (p.kind === 'soul') light(p.x + ox, p.y + oy, 8, 0.6); });
  hazards.forEach(h => { if (h.kind === 'fire') light(h.x + ox, h.y + oy, 22, 0.7); });
  if (boss && boss.id === 'voidlord') light(boss.x + ox, boss.y + oy - 18, 44, 0.7);
  if (room.stairs) light(room.stairs.x + ox, room.stairs.y + oy, 30, 0.8);
  if (P.spin > 0 || flashW > 0) light(P.x + ox, P.y + oy, 120, 1);
  lx.drawImage(dark, 0, 0);
  // colored glow pass
  lx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => { const [cr, cg, cb] = hex(col); const g = lx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`); lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2); };
  (room.torches || []).forEach((tc, i) => glow(tc.x + ox, tc.y + oy - 2, 40, L.lightCol === '#ff8a3a' || run.theme.deco === 'bones' ? '#ff9a40' : '#ff9a40', 0.16 + 0.04 * Math.sin(t * 9 + i)));
  (room.lights || []).forEach((l, i) => glow(l.x + ox, l.y + oy, l.r * 1.2, l.col, (l.lava ? 0.18 : 0.12) * (1 + 0.25 * Math.sin(t * 4 + i * 1.7))));
  shots.forEach(s => { if (s.kind === 'fireball') glow(s.x + ox, s.y + oy, 16, '#ff6a1a', 0.25); else if (s.enemy) glow(s.x + ox, s.y + oy, 8, s.col.length === 7 ? s.col : '#ffffff', 0.07); });
  hazards.forEach(h => { if (h.kind === 'fire') glow(h.x + ox, h.y + oy, 20, '#ff6a1a', 0.2); else if (h.kind === 'spore') glow(h.x + ox, h.y + oy, h.r, '#6ae06a', 0.1); });
  glow(P.x + ox, P.y + oy - 6, 30, L.lightCol, 0.06);
  lx.globalCompositeOperation = 'source-over';
  // vignette
  if (!drawDarkness.vig) { const v = document.createElement('canvas'); v.width = LW; v.height = LH; const vx = v.getContext('2d'); const g = vx.createRadialGradient(LW / 2, LH / 2, LH * 0.35, LW / 2, LH / 2, LH * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); vx.fillStyle = g; vx.fillRect(0, 0, LW, LH); drawDarkness.vig = v; }
  lx.drawImage(drawDarkness.vig, 0, 0);
}

// ------------------------------------------------------------ sounds
const SND = {
  swing: () => Sound.hiss(0.12, { filter: 'bandpass', freq: 1800, sweep: 600, q: 1.2, vol: 0.18 }),
  bow: () => { Sound.blip(900, 0.05, { type: 'triangle', vol: 0.12, slide: 300 }); Sound.hiss(0.06, { freq: 4000, vol: 0.05 }); },
  fire: () => { Sound.hiss(0.18, { filter: 'lowpass', freq: 1800, sweep: 400, vol: 0.18 }); Sound.blip(220, 0.1, { type: 'sawtooth', vol: 0.05, slide: 110, lp: 1200 }); },
  hit: crit => { Sound.blip(crit ? 1400 : 300, 0.05, { type: 'square', vol: crit ? 0.1 : 0.08, slide: crit ? 700 : 120 }); Sound.hiss(0.05, { freq: 2500, vol: 0.07 }); },
  kill: big => { Sound.hiss(big ? 1.2 : 0.2, { filter: 'lowpass', freq: big ? 900 : 1500, sweep: 100, vol: big ? 0.5 : 0.15 }); Sound.blip(big ? 80 : 160, big ? 0.8 : 0.1, { type: 'square', vol: 0.08, slide: 50 }); },
  hurt: () => { Sound.blip(220, 0.2, { type: 'sawtooth', vol: 0.18, slide: 70, lp: 2000 }); Sound.hiss(0.15, { filter: 'lowpass', freq: 1200, vol: 0.2 }); },
  roll: () => Sound.hiss(0.18, { filter: 'bandpass', freq: 600, sweep: 2000, q: 1, vol: 0.1 }),
  coin: () => { Sound.blip(1318, 0.04, { type: 'square', vol: 0.06 }); Sound.blip(1976, 0.08, { type: 'square', vol: 0.05, delay: 0.04 }); },
  soul: () => Sound.blip(1800 + Math.random() * 600, 0.04, { type: 'sine', vol: 0.04 }),
  heal: () => { [523, 659, 784].forEach((f, i) => Sound.blip(f, 0.08, { type: 'triangle', vol: 0.12, delay: i * 0.05 })); },
  key: () => { Sound.blip(1047, 0.05, { type: 'triangle', vol: 0.12 }); Sound.blip(1568, 0.1, { type: 'triangle', vol: 0.1, delay: 0.05 }); },
  buy: () => Sound.play('buy'), nope: () => Sound.play('error'),
  relic: () => { [392, 523, 659, 784, 1047].forEach((f, i) => Sound.blip(f, 0.12, { type: 'square', vol: 0.09, delay: i * 0.07, verb: 0.4 })); Sound.blip(1568, 0.6, { type: 'triangle', vol: 0.1, delay: 0.35, verb: 0.6, vib: 0.01 }); },
  chest: () => { Sound.blip(200, 0.1, { type: 'square', vol: 0.1, slide: 400 }); [784, 988, 1175].forEach((f, i) => Sound.blip(f, 0.06, { type: 'triangle', vol: 0.1, delay: 0.1 + i * 0.05 })); },
  door: () => { Sound.blip(110, 0.15, { type: 'square', vol: 0.06, slide: 80, lp: 600 }); Sound.hiss(0.2, { filter: 'lowpass', freq: 500, vol: 0.12 }); },
  clear: () => { [392, 523, 784].forEach((f, i) => Sound.blip(f, 0.1, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); },
  stairs: () => { [523, 440, 349, 262, 196].forEach((f, i) => Sound.blip(f, 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.08 })); },
  eshot: () => Sound.blip(520, 0.05, { type: 'square', vol: 0.03, slide: 260 }),
  boom: () => { Sound.hiss(0.5, { filter: 'lowpass', freq: 900, sweep: 60, vol: 0.35 }); Sound.blip(90, 0.3, { type: 'sine', vol: 0.25, slide: 30 }); },
  pop: () => Sound.hiss(0.2, { filter: 'lowpass', freq: 1400, sweep: 200, vol: 0.14 }),
  crate: () => { Sound.hiss(0.15, { filter: 'bandpass', freq: 700, vol: 0.2 }); Sound.blip(160, 0.06, { type: 'square', vol: 0.06, slide: 90 }); },
  roar: () => { Sound.blip(90, 0.6, { type: 'sawtooth', vol: 0.12, slide: 60, lp: 600 }); Sound.hiss(0.6, { filter: 'lowpass', freq: 500, vol: 0.2 }); },
  thud: () => { Sound.blip(70, 0.25, { type: 'sine', vol: 0.4, slide: 35 }); Sound.hiss(0.2, { filter: 'lowpass', freq: 400, vol: 0.2 }); },
  lunge: () => Sound.blip(400, 0.1, { type: 'sawtooth', vol: 0.06, slide: 900, lp: 2000 }),
  summon: () => { Sound.blip(200, 0.4, { type: 'sine', vol: 0.12, slide: 800 }); Sound.hiss(0.4, { filter: 'bandpass', freq: 800, sweep: 3000, vol: 0.08 }); },
  blink: () => Sound.blip(1200, 0.12, { type: 'sine', vol: 0.1, slide: 300 }),
  charge: () => Sound.blip(100, 1.0, { type: 'sawtooth', vol: 0.08, slide: 600, lp: 1500 }),
  zap: () => Sound.hiss(0.1, { freq: 5000, vol: 0.1 }),
  wisp: () => Sound.blip(1600, 0.04, { type: 'sine', vol: 0.04, slide: 2400 }),
  whirl: () => { Sound.hiss(0.4, { filter: 'bandpass', freq: 800, sweep: 3000, q: 1.5, vol: 0.2 }); },
  volley: () => { for (let k = 0; k < 5; k++) Sound.blip(900 - k * 60, 0.04, { type: 'triangle', vol: 0.08, delay: k * 0.02, slide: 300 }); },
  nova: () => { Sound.hiss(0.6, { filter: 'lowpass', freq: 2400, sweep: 200, vol: 0.3 }); Sound.blip(300, 0.4, { type: 'sawtooth', vol: 0.08, slide: 80, lp: 1500 }); },
  revive: () => { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => Sound.blip(f, 0.15, { type: 'square', vol: 0.1, delay: i * 0.07, verb: 0.5 })); },
};

// ------------------------------------------------------------ UI helpers (full-res)
function text(s, x, y, size = 16, col = '#fff', align = 'left', shadow = true) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(s, x + Math.max(2, size / 8), y + Math.max(2, size / 8)); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function wrapText(s, x, y, maxW, size, col, lh, align = 'left') {
  ctx.font = `${size}px ${FONT}`; const words = s.split(' '); let line = '', yy = y;
  words.forEach(w => { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { text(line, x, yy, size, col, align); line = w; yy += lh; } else line = tt; });
  if (line) text(line, x, yy, size, col, align); return yy + lh;
}
function panel(x, y, w, h, border = '#4a3a6a', fill = '#0e0a1a') {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 8, y + 8, w, h);
  ctx.fillStyle = '#05030a'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = fill; ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
  ctx.fillStyle = shade(border, 0.3); ctx.fillRect(x + 4, y + 4, w - 8, 2);
}
function button(id, x, y, w, h, label, o = {}) {
  const over = mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  if (over && !o.disabled) UI.hover = id;
  const pressed = over && UI.down, base = o.disabled ? '#2a2434' : (o.color || '#3a2a5a'), dy = pressed ? 3 : 0;
  ctx.fillStyle = '#05030a'; ctx.fillRect(x, y + 4, w, h);
  ctx.fillStyle = shade(base, -0.45); ctx.fillRect(x, y + dy, w, h);
  ctx.fillStyle = over && !o.disabled ? shade(base, 0.15) : base; ctx.fillRect(x, y + dy, w, h - 5);
  ctx.fillStyle = shade(base, 0.35); ctx.fillRect(x, y + dy, w, 3);
  text(label, x + w / 2, y + dy + (h - 5 - (o.size || 16)) / 2 + 1, o.size || 16, o.disabled ? '#6a6478' : (o.tc || '#ffffff'), 'center');
  const c = UI.click;
  if (c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { UI.click = null; if (o.disabled) { Sound.play('error'); return false; } Sound.play(o.sfx || 'click'); return true; }
  return false;
}
function heartsAt(x, y0, hp, max, size = 4) {
  let y = y0;
  const img = sprite('heart');
  for (let k = 0; k < Math.ceil(max / 2); k++) {
    const hx = x + (k % 10) * 32, full = hp - k * 2; y = y0 + Math.floor(k / 10) * 30;
    ctx.globalAlpha = 0.25; ctx.drawImage(img, hx, y, img.width * size, img.height * size); ctx.globalAlpha = 1;
    if (full >= 2) ctx.drawImage(img, hx, y, img.width * size, img.height * size);
    else if (full === 1) ctx.drawImage(img, 0, 0, Math.ceil(img.width / 2), img.height, hx, y, Math.ceil(img.width / 2) * size, img.height * size);
  }
}
function toast(s, col = '#fff', dur = 2.5) { toastQ.push({ s, col, t: 0, dur }); if (toastQ.length > 3) toastQ.shift(); }

// ------------------------------------------------------------ HUD
function drawHUD() {
  ctx.imageSmoothingEnabled = false;
  heartsAt(20, 16, P.hp, P.maxhp);
  // resources
  const res = [[sprite('coin'), run.gold, '#ffd65a'], [sprite('key'), run.keys, '#fff3c4'], [sprite('potion'), run.potions + (touch.on ? '' : '  [Q]'), '#ff9ab0']];
  const ry = P.maxhp > 20 ? 30 : 0;
  res.forEach(([img, v, col], i) => { ctx.drawImage(img, 22, 60 + ry + i * 34, img.width * 4, img.height * 4); text(String(v), 70, 66 + ry + i * 34, 16, col); });
  ctx.fillStyle = '#8ad8ff'; ctx.fillRect(26, 172 + ry, 8, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(28, 174 + ry, 4, 4);
  text(String(run.souls), 70, 168 + ry, 16, '#8ad8ff');
  // minimap
  const mm = 14, mx0 = W - 20 - 9 * mm, my0 = 16;
  ctx.fillStyle = 'rgba(5,3,10,0.7)'; ctx.fillRect(mx0 - 6, my0 - 6, 9 * mm + 12, 9 * mm + 12);
  run.map.list.forEach(r => {
    if (!r.seen) return;
    const x = mx0 + r.x * mm, y = my0 + r.y * mm;
    ctx.fillStyle = r === room ? '#ffffff' : r.visited ? '#6a6080' : '#2a2438';
    ctx.fillRect(x + 1, y + 1, mm - 2, mm - 2);
    const ic = { boss: '#e83a4a', treasure: '#ffcc33', shop: '#4ae07a', altar: '#c81a2a' }[r.type];
    if (ic) { ctx.fillStyle = ic; ctx.fillRect(x + 4, y + 4, mm - 8, mm - 8); }
  });
  text(run.loop ? `ENDLESS ${run.loop}-${run.fi % 5 + 1}` : `FLOOR ${run.fi + 1}`, W - 20, my0 + 9 * mm + 12, 8, run.theme.accent, 'right');
  // relics
  const shown = run.relics.filter(r => !r.hidden);
  shown.forEach((r, i) => {
    const x = 20 + (i % 12) * 34, y = H - 44 - Math.floor(i / 12) * 34;
    ctx.fillStyle = 'rgba(5,3,10,0.6)'; ctx.fillRect(x - 2, y - 2, 32, 32);
    ctx.drawImage(relicIcon(r), x + 1, y + 1, 30 - 2, 30 - 2);
    if (mouse.x >= x && mouse.x < x + 30 && mouse.y >= y && mouse.y < y + 30) hoverRelic = r;
  });
  // ability cooldowns
  const cx = W - 70, cy = H - 70;
  [[run.cls.special.name, P.specCd, run.cls.special.cd, '#c46cff', touch.on ? '' : 'R-CLICK'], ['DODGE', P.rollCd, 0.75 * run.st.dodge, '#6ad0ff', touch.on ? '' : 'SPACE']].forEach(([nm, cdv, max, col, k], i) => {
    const x = cx - i * 110, r = 34;
    ctx.fillStyle = 'rgba(5,3,10,0.7)'; ctx.beginPath(); ctx.arc(x, cy, r, 0, 6.3); ctx.fill();
    const f = clamp(1 - cdv / max, 0, 1);
    ctx.strokeStyle = f >= 1 ? col : shade(col, -0.5); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, cy, r - 4, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    text(nm.slice(0, 7), x, cy - 6, 8, f >= 1 ? '#ffffff' : '#6a6478', 'center');
    if (k) text(k, x, cy + 40, 8, '#8a84b0', 'center');
  });
  // boss bar
  if (boss && !boss.dead) {
    const bw = 640, bx = (W - bw) / 2, by = H - 70;
    text(boss.B.name, W / 2, by - 26, 12, '#ff6a6a', 'center');
    ctx.fillStyle = '#05030a'; ctx.fillRect(bx - 4, by - 4, bw + 8, 28);
    ctx.fillStyle = '#3a0a14'; ctx.fillRect(bx, by, bw, 20);
    ctx.fillStyle = boss.phase === 2 ? '#ff3a3a' : '#c81a2a'; ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxhp, 0, 1), 20);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxhp, 0, 1), 4);
  }
  // shop prices + labels
  ctx.save();
  pickups.forEach(p => {
    const sx = (p.x + RX) * S, sy = (p.y + RY) * S;
    if (p.shop) { const price = Math.max(1, Math.round(p.price * (1 - run.st.discount))); ctx.fillStyle = 'rgba(5,3,10,0.75)'; ctx.fillRect(sx - 30, sy + 50, 60, 22); text(`${price}g`, sx, sy + 55, 12, run.gold >= price ? '#ffd65a' : '#ff8c78', 'center'); }
    if (p.kind === 'relic' && dist(p, P) < 36) {
      text(p.relic.name, sx, sy - 100, 12, RARITY_COL[p.relic.r], 'center');
      text(p.relic.desc, sx, sy - 80, 8, '#e8e4ff', 'center');
      if (p.altar) text('COSTS 1 MAX HEART', sx, sy - 64, 8, '#ff3a4a', 'center');
    }
  });
  ctx.restore();
  // damage numbers
  nums.forEach(n => { ctx.globalAlpha = 1 - n.t / 0.8; text(typeof n.v === 'number' ? String(Math.round(n.v)) : n.v, (n.x + RX) * S, (n.y + RY) * S - 10, n.crit ? 16 : 12, n.col, 'center'); ctx.globalAlpha = 1; });
  if (touch.on) drawTouch();
}
let hoverRelic = null;
function drawTouch() {
  for (const k in TBTN) { const b = TBTN[k]; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.fill(); text(k.toUpperCase(), b.x, b.y - 4, 8, '#fff', 'center'); }
  for (const s of touch.sticks.values()) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.ox, s.oy, 60, 0, 6.3); ctx.stroke(); const d = Math.min(60, Math.hypot(s.x - s.ox, s.y - s.oy)), a = Math.atan2(s.y - s.oy, s.x - s.ox); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(s.ox + Math.cos(a) * d, s.oy + Math.sin(a) * d, 26, 0, 6.3); ctx.fill(); }
}

// ------------------------------------------------------------ screens
let menuT = 0, menuBg = null;
function drawMenuBg() {
  // animated torch-lit dungeon backdrop
  if (!menuBg) {
    menuBg = document.createElement('canvas'); menuBg.width = LW; menuBg.height = LH;
    const b = menuBg.getContext('2d'), R = seeded(42);
    for (let y = 0; y < LH; y += 8) for (let x = 0; x < LW; x += 16) {
      const off = (y / 8) % 2 ? 8 : 0;
      b.fillStyle = ['#1a1428', '#1e1830', '#161222'][Math.floor(R() * 3)]; b.fillRect(x - off, y, 16, 8);
      b.fillStyle = '#0a0812'; b.fillRect(x - off, y + 7, 16, 1); b.fillRect(x - off + 15, y, 1, 8);
    }
    b.fillStyle = '#0a0812'; b.fillRect(0, 140, LW, 40);
    for (let x = 0; x < LW; x += 16) { b.fillStyle = (x / 16) % 2 ? '#14101e' : '#181424'; b.fillRect(x, 140, 16, 40); }
    b.fillStyle = '#05030a'; b.fillRect(130, 70, 60, 70); b.beginPath(); b.arc(160, 70, 30, Math.PI, 0); b.fill();
  }
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.drawImage(menuBg, 0, 0);
  // torches
  [[70, 70], [250, 70]].forEach(([x, y], i) => {
    px(x - 2, y, '#2a1a10', 4, 4); px(x - 1, y + 4, '#2a1a10', 2, 4);
    const f = Math.sin(t * 12 + i) > 0; px(x - 2, y - 5, f ? '#ffcc33' : '#ff8a3a', 4, 5); px(x - 1, y - 8, '#ff6a1a', 2, 3); px(x - 1, y - 3, '#fff3a0', 2, 2);
    if (Math.random() < 0.2) parts.push({ x: x + rand(-1, 1), y: y - 8, vx: rand(-4, 4), vy: rand(-20, -10), life: 0.8, t: 0, col: '#ffb040', s: 1 });
  });
  // wandering silhouettes in the doorway
  const k = (t * 0.3) % 1;
  if (k < 0.5) { lx.globalAlpha = Math.sin(k * 2 * Math.PI) * 0.6; drawSpr(sprite('skeleton'), 160, 140, {}); lx.globalAlpha = 1; }
  parts.forEach(p => { lx.globalAlpha = 1 - p.t / p.life; px(p.x, p.y, p.col); }); lx.globalAlpha = 1;
  dx.globalCompositeOperation = 'source-over'; dx.clearRect(0, 0, LW, LH); dx.fillStyle = 'rgba(4,2,10,0.7)'; dx.fillRect(0, 0, LW, LH);
  dx.globalCompositeOperation = 'destination-out';
  [[70, 66], [250, 66]].forEach(([x, y], i) => { const r = 70 + Math.sin(t * 9 + i) * 4; const g = dx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); dx.fillStyle = g; dx.fillRect(x - r, y - r, r * 2, r * 2); });
  lx.drawImage(dark, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, W, H);
}
function title(y) {
  const t1 = 'NIGHTFALL', t2 = 'DEPTHS';
  [...t1].forEach((ch, i) => { const x = W / 2 - t1.length * 30 + i * 60 + 30, yy = y + Math.sin(t * 2 + i * 0.5) * 4; for (const [a, b] of [[-4, 0], [4, 0], [0, -4], [0, 4], [6, 6]]) text(ch, x + a, yy + b, 56, '#1a0a14', 'center', false); text(ch, x, yy, 56, i % 2 ? '#e8c060' : '#ffcc66', 'center', false); });
  text(t2, W / 2, y + 74, 32, '#c46cff', 'center');
}
function drawMenu() {
  drawMenuBg();
  title(80);
  text('a dungeon roguelike by Cnatt', W / 2, 200, 8, '#a8a0d0', 'center');
  const bx = W / 2 - 200;
  if (button('play', bx, 250, 400, 64, 'DESCEND', { color: '#7a2a3a', size: 24 })) { screen = 'classes'; dailyMode = false; }
  const today = new Date().toISOString().slice(0, 10), dbest = save.daily[today];
  if (button('daily', bx, 330, 400, 52, 'DAILY DUNGEON', { color: '#2a4a6a' })) { screen = 'classes'; dailyMode = true; }
  text(dbest ? `today's best: floor ${dbest}` : 'same dungeon for everyone today', W / 2, 388, 8, '#8ab8d8', 'center');
  if (button('sanct', bx, 412, 196, 52, 'SANCTUM', { color: '#3a2a5a', size: 12 })) screen = 'sanctum';
  if (button('codex', bx + 204, 412, 196, 52, 'CODEX', { color: '#3a2a5a', size: 12 })) screen = 'codex';
  if (button('mus', bx, 476, 196, 40, Sound.musicOn ? 'MUSIC ON' : 'MUSIC OFF', { color: '#2a2434', size: 8 })) Sound.setMusic(!Sound.musicOn);
  if (button('sfx', bx + 204, 476, 196, 40, Sound.sfxOn ? 'SOUND ON' : 'SOUND OFF', { color: '#2a2434', size: 8 })) Sound.setSfx(!Sound.sfxOn);
  ctx.fillStyle = '#8ad8ff'; ctx.fillRect(W / 2 - 110, 552, 12, 12);
  text(`${fmt(save.souls)} souls`, W / 2 - 90, 552, 12, '#8ad8ff');
  text(`Runs ${save.runs}   Best floor ${save.bestFloor}   Wins ${save.wins}   Kills ${fmt(save.kills)}`, W / 2, 590, 8, '#8a84b0', 'center');
  text('WASD move - MOUSE aim/attack (or ARROWS) - SPACE dodge - RIGHT CLICK special - Q potion', W / 2, 680, 8, '#6a6488', 'center');
}
function drawClasses() {
  drawMenuBg();
  ctx.fillStyle = 'rgba(5,3,10,0.5)'; ctx.fillRect(0, 0, W, H);
  text(dailyMode ? 'DAILY DUNGEON - CHOOSE YOUR HERO' : 'CHOOSE YOUR HERO', W / 2, 50, 24, '#e8c060', 'center');
  CLASSES.forEach((c, i) => {
    const x = 90 + i * 380, y = 100, w = 340, h = 520;
    const owned = save.classes.includes(c.id);
    panel(x, y, w, h, owned ? shade(c.color, -0.5) : '#2a2434');
    const img = sprite(c.id);
    ctx.globalAlpha = owned ? 1 : 0.25;
    ctx.drawImage(img, x + w / 2 - 64, y + 40 + Math.sin(t * 2 + i) * 6, 128, 128);
    ctx.globalAlpha = 1;
    text(c.name, x + w / 2, y + 196, 24, owned ? c.color : '#6a6478', 'center');
    wrapText(c.desc, x + w / 2, y + 236, w - 60, 8, '#c8c0e8', 16, 'center');
    text(`HEARTS ${c.hp / 2}`, x + 40, y + 282, 8, '#ff9aa8');
    text(`SPEED ${c.speed}`, x + 40, y + 300, 8, '#6ad0ff');
    text(`ATTACK ${c.attack.kind.toUpperCase()}`, x + 40, y + 318, 8, '#ffd65a');
    text(`SPECIAL: ${c.special.name}`, x + 40, y + 336, 8, '#c46cff');
    wrapText(c.special.desc, x + 40, y + 354, w - 80, 8, '#8a84b0', 14);
    if (owned) { if (button('c' + c.id, x + 40, y + h - 76, w - 80, 56, 'PLAY', { color: '#7a2a3a' })) { Sound.init(); newRun(c.id, dailyMode); } }
    else if (button('c' + c.id, x + 40, y + h - 76, w - 80, 56, `UNLOCK ${c.cost} SOULS`, { color: save.souls >= c.cost ? '#2a5a7a' : '#2a2434', size: 12, disabled: save.souls < c.cost, sfx: 'buy' })) { save.souls -= c.cost; save.classes.push(c.id); store(); }
  });
  if (button('back', 40, 650, 200, 48, 'BACK', { color: '#2a2434', size: 12, sfx: 'back' })) goMenu();
  ctx.fillStyle = '#8ad8ff'; ctx.fillRect(W - 260, 666, 12, 12); text(`${fmt(save.souls)} souls`, W - 240, 666, 12, '#8ad8ff');
}
function drawSanctum() {
  drawMenuBg();
  ctx.fillStyle = 'rgba(5,3,10,0.55)'; ctx.fillRect(0, 0, W, H);
  text('THE SANCTUM', W / 2, 40, 32, '#c46cff', 'center');
  text('Spend souls on blessings that last forever', W / 2, 90, 8, '#a8a0d0', 'center');
  ctx.fillStyle = '#8ad8ff'; ctx.fillRect(W / 2 - 90, 116, 12, 12); text(`${fmt(save.souls)} souls`, W / 2 - 70, 116, 12, '#8ad8ff');
  UPGRADES.forEach((u, i) => {
    const x = 110 + (i % 2) * 540, y = 160 + Math.floor(i / 2) * 110, w = 520, h = 96;
    const lvl = upLvl(u.id), max = u.costs.length, cost = u.costs[lvl];
    panel(x, y, w, h, lvl >= max ? '#6a5a2a' : '#3a2a5a');
    text(u.name.toUpperCase(), x + 24, y + 22, 16, '#ffffff');
    text(u.desc, x + 24, y + 50, 8, '#c8c0e8');
    for (let k = 0; k < max; k++) { ctx.fillStyle = k < lvl ? '#c46cff' : '#2a2434'; ctx.fillRect(x + 24 + k * 22, y + 68, 16, 10); }
    if (lvl >= max) text('MAXED', x + w - 30, y + 38, 12, '#ffcc33', 'right');
    else if (button('u' + u.id, x + w - 170, y + 22, 146, 52, `${cost}`, { color: save.souls >= cost ? '#2a5a7a' : '#2a2434', disabled: save.souls < cost, size: 16, sfx: 'buy' })) { save.souls -= cost; save.up[u.id] = lvl + 1; store(); }
  });
  if (button('back', 40, 640, 200, 48, 'BACK', { color: '#2a2434', size: 12, sfx: 'back' })) goMenu();
}
let codexTab = 'relics';
function drawCodex() {
  drawMenuBg();
  ctx.fillStyle = 'rgba(5,3,10,0.6)'; ctx.fillRect(0, 0, W, H);
  text('CODEX', W / 2, 30, 32, '#e8c060', 'center');
  if (button('tr', W / 2 - 250, 80, 240, 44, 'RELICS', { color: codexTab === 'relics' ? '#6a4a1a' : '#2a2434', size: 12, sfx: 'tab' })) codexTab = 'relics';
  if (button('tb', W / 2 + 10, 80, 240, 44, 'BESTIARY', { color: codexTab === 'beasts' ? '#6a4a1a' : '#2a2434', size: 12, sfx: 'tab' })) codexTab = 'beasts';
  let hov = null;
  if (codexTab === 'relics') {
    RELICS.forEach((r, i) => {
      const x = 120 + (i % 8) * 132, y = 150 + Math.floor(i / 8) * 120, seen = save.seenRelics[r.id];
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y, 116, 104);
      ctx.fillStyle = seen ? RARITY_COL[r.r] : '#2a2434'; ctx.fillRect(x, y, 116, 3);
      if (seen) ctx.drawImage(relicIcon(r), x + 28, y + 14, 60, 60); else { ctx.globalAlpha = 0.15; ctx.drawImage(relicIcon(r), x + 28, y + 14, 60, 60); ctx.globalAlpha = 1; }
      text(seen ? r.name.split(' ').pop() : '???', x + 58, y + 84, 8, seen ? '#ffffff' : '#4a4458', 'center');
      if (seen && mouse.x >= x && mouse.x < x + 116 && mouse.y >= y && mouse.y < y + 104) hov = r;
    });
    text(`${Object.keys(save.seenRelics).length}/${RELICS.length} found`, W / 2, 650, 8, '#a8a0d0', 'center');
    if (hov) { panel(mouse.x + 16, mouse.y - 70, 360, 70, '#4a3a6a'); text(hov.name, mouse.x + 34, mouse.y - 54, 12, RARITY_COL[hov.r]); text(hov.desc, mouse.x + 34, mouse.y - 30, 8, '#e8e4ff'); }
  } else {
    Object.keys(ENEMIES).forEach((id, i) => {
      const d = ENEMIES[id], x = 120 + (i % 6) * 176, y = 150 + Math.floor(i / 6) * 230, n = save.seenEnemies[id] || 0;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y, 160, 210);
      const img = sprite(d.sprite, d.tint);
      if (!n) ctx.filter = 'brightness(0)';
      ctx.drawImage(img, x + 32, y + 20, 96, 96); ctx.filter = 'none';
      text(n ? d.name : '???', x + 80, y + 130, 8, n ? '#ffffff' : '#4a4458', 'center');
      if (n) { text(`HP ${d.hp}`, x + 80, y + 154, 8, '#ff9aa8', 'center'); text(`slain ${n}`, x + 80, y + 176, 8, '#c8c0e8', 'center'); }
    });
  }
  if (button('back', 40, 640, 200, 48, 'BACK', { color: '#2a2434', size: 12, sfx: 'back' })) goMenu();
}
function drawPause() {
  ctx.fillStyle = 'rgba(5,3,10,0.75)'; ctx.fillRect(0, 0, W, H);
  text('PAUSED', W / 2, 60, 32, '#e8c060', 'center');
  text(`${run.cls.name}  -  FLOOR ${run.fi + 1}  -  ${Math.floor(run.time / 60)}:${String(Math.floor(run.time % 60)).padStart(2, '0')}  -  SEED ${run.seed}`, W / 2, 110, 8, '#a8a0d0', 'center');
  const st = run.st;
  const stats = [['DAMAGE', `x${st.dmg.toFixed(2)}`], ['ATTACK SPEED', `x${st.rate.toFixed(2)}`], ['MOVE SPEED', `x${st.speed.toFixed(2)}`], ['RANGE', `x${st.range.toFixed(2)}`], ['CRIT', `${Math.round(st.crit * 100)}%`], ['PROJECTILES', `+${st.multi}`]];
  stats.forEach(([a, b], i) => { text(a, 140, 160 + i * 28, 8, '#c8c0e8'); text(b, 380, 160 + i * 28, 8, '#ffffff', 'right'); });
  text('RELICS', 520, 150, 12, '#e8c060');
  run.relics.filter(r => !r.hidden).forEach((r, i) => {
    const x = 520 + (i % 2) * 330, y = 180 + Math.floor(i / 2) * 44;
    ctx.drawImage(relicIcon(r), x, y, 30, 30);
    text(r.name, x + 40, y + 2, 8, RARITY_COL[r.r]); text(r.desc, x + 40, y + 18, 8, '#a8a0d0');
  });
  if (!run.relics.length) text('none yet - find them in chests, shops and treasure rooms', 520, 186, 8, '#6a6478');
  if (button('res', 140, 400, 300, 60, 'RESUME', { color: '#3a6a3a' })) resume();
  if (button('mus', 140, 476, 145, 44, Sound.musicOn ? 'MUSIC ON' : 'MUSIC OFF', { color: '#2a2434', size: 8 })) Sound.setMusic(!Sound.musicOn);
  if (button('sfx', 295, 476, 145, 44, Sound.sfxOn ? 'SOUND ON' : 'SOUND OFF', { color: '#2a2434', size: 8 })) Sound.setSfx(!Sound.sfxOn);
  if (button('quit', 140, 540, 300, 52, 'ABANDON RUN', { color: '#6a1a2a', size: 12, sfx: 'back' })) { run.killedBy = 'giving up'; die(); }
}
let deathT = 0;
function die() {
  screen = 'dead'; deathT = 0; P.hp = 0;
  const souls = run.souls; save.souls += souls;
  if (dailyMode) { const d = new Date().toISOString().slice(0, 10); save.daily[d] = Math.max(save.daily[d] || 0, run.fi + 1); }
  store(); Sound.playSong(SONGS.death); SND.kill(true);
}
function victory() {
  screen = 'victory'; deathT = 0;
  save.wins++; save.souls += run.souls + 100; run.souls += 100;
  if (dailyMode) { const d = new Date().toISOString().slice(0, 10); save.daily[d] = Math.max(save.daily[d] || 0, 6); }
  store(); Sound.playSong(SONGS.victory); Sound.play('catch', 4);
}
function drawEnd(won) {
  deathT += 1 / 60;
  ctx.fillStyle = `rgba(5,3,10,${Math.min(0.85, deathT)})`; ctx.fillRect(0, 0, W, H);
  if (deathT < 0.6) return;
  const a = Math.min(1, (deathT - 0.6) * 2); ctx.globalAlpha = a;
  text(won ? 'THE NIGHTFALL IS LIFTED' : 'YOU HAVE FALLEN', W / 2, 80, won ? 32 : 40, won ? '#ffcc66' : '#e83a4a', 'center');
  text(won ? 'The Void Lord is no more. Dawn returns to the depths.' : `Slain by ${run.killedBy || 'the darkness'} on floor ${run.fi + 1}`, W / 2, 140, 12, '#c8c0e8', 'center');
  const mins = Math.floor(run.time / 60), secs = String(Math.floor(run.time % 60)).padStart(2, '0');
  const rows = [['HERO', run.cls.name], ['FLOOR REACHED', String(run.fi + 1)], ['MONSTERS SLAIN', String(run.kills)], ['DAMAGE DEALT', fmt(run.dmgDealt)], ['RELICS', String(run.relics.filter(r => !r.hidden).length)], ['TIME', `${mins}:${secs}`]];
  rows.forEach(([k, v], i) => { text(k, W / 2 - 260, 200 + i * 36, 12, '#a8a0d0'); text(v, W / 2 + 260, 200 + i * 36, 12, '#ffffff', 'right'); });
  ctx.fillStyle = '#8ad8ff'; ctx.fillRect(W / 2 - 150, 430, 16, 16);
  text(`+${run.souls} SOULS`, W / 2 - 124, 430, 16, '#8ad8ff');
  run.relics.filter(r => !r.hidden).forEach((r, i) => ctx.drawImage(relicIcon(r), W / 2 - (run.relics.length * 36) / 2 + i * 36, 470, 30, 30));
  ctx.globalAlpha = 1;
  if (deathT > 1.2) {
    if (won) {
      if (button('endless', W / 2 - 310, 540, 300, 60, 'ENDLESS DEPTHS', { color: '#5a2a8a', size: 12 })) { screen = 'play'; fadeTo(() => startFloor(run.fi + 1)); }
      if (button('menu', W / 2 + 10, 540, 300, 60, 'RETURN', { color: '#3a2a5a', size: 12 })) goMenu();
    } else {
      if (button('again', W / 2 - 310, 540, 300, 60, 'TRY AGAIN', { color: '#7a2a3a' })) { newRun(run.cls.id, dailyMode); }
      if (button('sanct', W / 2 + 10, 540, 300, 60, 'SANCTUM', { color: '#3a2a5a' })) { screen = 'sanctum'; Sound.playSong(SONGS.dmenu); }
      if (button('menu', W / 2 - 150, 616, 300, 48, 'MENU', { color: '#2a2434', size: 12, sfx: 'back' })) goMenu();
    }
  }
}
function pause() { screen = 'pause'; Sound.play('back'); }
function resume() { screen = 'play'; Sound.play('click'); }
function goMenu() { screen = 'menu'; parts = []; Sound.playSong(SONGS.dmenu); }

// ------------------------------------------------------------ main loop
let last = 0;
function frame(now) {
  let dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
  UI.hover = null; hoverRelic = null;
  ctx.imageSmoothingEnabled = false;
  if (screen === 'menu') { updateParts(dt); drawMenu(); }
  else if (screen === 'classes') { updateParts(dt); drawClasses(); }
  else if (screen === 'sanctum') { updateParts(dt); drawSanctum(); }
  else if (screen === 'codex') { updateParts(dt); drawCodex(); }
  else if (run) {
    if (screen === 'play') {
      if (hitstop > 0) { hitstop -= dt; dt = 0; }
      dt *= slowmo;
      if (fade <= 0) update(dt);
      updateParts(dt);
    } else if (screen === 'dead' || screen === 'victory') updateParts(dt * 0.3);
    shake = Math.max(0, shake - dt * 1.5);
    flashW = Math.max(0, flashW - dt * 2);
    drawWorld();
    ctx.drawImage(lo, 0, 0, W, H);
    if (flashW > 0) { ctx.fillStyle = `rgba(255,255,255,${flashW * 0.5})`; ctx.fillRect(0, 0, W, H); }
    if (P.hp <= 2 && screen === 'play') { ctx.fillStyle = `rgba(160,0,20,${0.12 + 0.08 * Math.sin(t * 6)})`; ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, H - 10, W, 10); ctx.fillRect(0, 0, 10, H); ctx.fillRect(W - 10, 0, 10, H); }
    drawHUD();
    if (hoverRelic) { panel(mouse.x + 16, mouse.y - 76, 380, 70, '#4a3a6a'); text(hoverRelic.name, mouse.x + 34, mouse.y - 60, 12, RARITY_COL[hoverRelic.r]); text(hoverRelic.desc, mouse.x + 34, mouse.y - 36, 8, '#e8e4ff'); }
    // floor banner
    if (banner) {
      banner.t += dt || 1 / 60;
      const a = banner.t < 0.6 ? banner.t / 0.6 : banner.t > 3.2 ? Math.max(0, 1 - (banner.t - 3.2) / 0.8) : 1;
      if (a <= 0) banner = null;
      else { ctx.globalAlpha = a; ctx.fillStyle = 'rgba(5,3,10,0.7)'; ctx.fillRect(0, 250, W, 130); ctx.fillStyle = banner.col; ctx.fillRect(0, 250, W, 3); ctx.fillRect(0, 377, W, 3); text(banner.title, W / 2, 280, 24, banner.col, 'center'); text(banner.sub, W / 2, 330, 12, '#c8c0e8', 'center'); ctx.globalAlpha = 1; }
    }
    if (bossIntro) {
      const a = bossIntro.t < 0.4 ? bossIntro.t / 0.4 : Math.max(0, 1 - (bossIntro.t - 1.8) / 0.4);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(5,3,10,0.6)'; ctx.fillRect(0, H / 2 - 60, W, 120);
      text(bossIntro.name, W / 2 + (1 - a) * 80, H / 2 - 24, 32, '#ff5a5a', 'center'); ctx.globalAlpha = 1;
    }
    if (relicBanner) {
      relicBanner.t += 1 / 60;
      const r = relicBanner.r, a = relicBanner.t < 0.3 ? relicBanner.t / 0.3 : Math.max(0, 1 - (relicBanner.t - 2.4) / 0.5);
      if (a <= 0) relicBanner = null;
      else { ctx.globalAlpha = a; panel(W / 2 - 330, 110, 660, 110, shade(RARITY_COL[r.r], -0.4)); ctx.drawImage(relicIcon(r), W / 2 - 300, 136, 60, 60); text(RARITY_NAME[r.r], W / 2 - 220, 132, 8, RARITY_COL[r.r]); text(r.name.toUpperCase(), W / 2 - 220, 152, 16, '#ffffff'); text(r.desc, W / 2 - 220, 182, 8, '#e8e4ff'); ctx.globalAlpha = 1; }
    }
    if (screen === 'pause') drawPause();
    if (screen === 'dead') drawEnd(false);
    if (screen === 'victory') drawEnd(true);
    if (screen === 'play' && button('pz', W / 2 - 40, 8, 80, 30, 'II', { color: '#2a2434', size: 8, sfx: 'back' })) pause();
  } else { ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H); }
  // toasts
  toastQ.forEach((m, i) => {
    m.t += 1 / 60; const a = m.t < 0.2 ? m.t / 0.2 : m.t > m.dur - 0.4 ? Math.max(0, (m.dur - m.t) / 0.4) : 1;
    ctx.globalAlpha = a; ctx.font = `12px ${FONT}`; const tw = ctx.measureText(m.s).width + 40, y = 56 + i * 42;
    ctx.fillStyle = 'rgba(5,3,10,0.85)'; ctx.fillRect(W / 2 - tw / 2, y, tw, 32); ctx.fillStyle = m.col; ctx.fillRect(W / 2 - tw / 2, y, 4, 32);
    text(m.s, W / 2, y + 10, 12, m.col, 'center'); ctx.globalAlpha = 1;
  });
  toastQ = toastQ.filter(m => m.t < m.dur);
  // fade
  if (fade > 0) {
    fade += 1 / 60 * 2.5;
    if (fade >= 1 && fadeCb) { const cb = fadeCb; fadeCb = null; cb(); fade = 1.0001; }
    const a = fade <= 1 ? fade : Math.max(0, 2 - fade);
    ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H);
    if (fade >= 2) fade = 0;
  }
  if (UI.hover && UI.hover !== UI.lastHover) Sound.play('hover');
  UI.lastHover = UI.hover; UI.click = null;
  requestAnimationFrame(frame);
}

// boot
const fontReady = document.fonts ? Promise.race([document.fonts.load(`16px ${FONT}`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontReady.then(() => { screen = 'menu'; Sound.playSong(SONGS.dmenu); requestAnimationFrame(n => { last = n; frame(n); }); });

// test hooks
window.__dg = {
  get screen() { return screen; }, get run() { return run; }, get room() { return room; }, get P() { return P; }, get enemies() { return enemies; }, get pickups() { return pickups; },
  newRun, killAll() { enemies.forEach(e => { if (!e.dead) { e.hp = 0.01; damageEnemy(e, 999, { raw: true }); } }); },
  goBoss() { const b = run.map.list.find(r => r.type === 'boss'); leaveRoom(); enterRoom(b, 's'); P.x = 8.5 * TS; P.y = 8.5 * TS; },
  goRoom(type) { const r = run.map.list.find(x => x.type === type); leaveRoom(); enterRoom(r, 's'); P.x = 8.5 * TS; P.y = 8.5 * TS; },
  giveRelic(id) { run.relics.push(RELICS.find(r => r.id === id)); recalc(); }, startFloor, save: () => save, setScreen(s) { screen = s; },
  hurtBoss(f) { if (boss) { boss.hp = boss.maxhp * f; } }, godmode() { P.hp = 999; P.maxhp = 999; },
};
})();
