// =====================================================================
//  2 PLAYER TAG
//  P1: WASD + Left Shift / Space to dash
//  P2: Arrow keys + Right Shift / Enter to dash  (or play vs the CPU)
// =====================================================================
(() => {
'use strict';
const W = 1280, H = 720, T = 40, COLS = 32, ROWS = 16, TOP = 80;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const FONT = '"Press Start 2P", monospace';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
function rgba(h, a) { h = h.replace('#', ''); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }
function shade(h, f) { h = h.replace('#', ''); const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); const k = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255); return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`; }

// ------------------------------------------------------------ music
Object.assign(SONGS, {
  tag_menu: { seed: 2024, bpm: 118, root: 62, scale: 'dorian', prog: [0, 3, 4, 3, 0, 3, 5, 4], density: 0.85,
    bass: 'x..x..x.x..x..x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    arp: true, arpRate: 2, inst: { lead: { type: 'square', vol: 0.07, lp: 3000 } } },
  tag_battle: { seed: 4242, bpm: 150, root: 57, scale: 'minor', prog: [0, 5, 3, 4, 0, 5, 6, 4], density: 0.95,
    bass: 'x.xxx.xxx.xxx.xx', kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    arp: true, arpRate: 1, arpPattern: [0, 2, 1, 2], form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.065 }, bass: { type: 'sawtooth', vol: 0.1, lp: 900 }, drumVol: 0.9 } },
  tag_win: { seed: 99, bpm: 132, root: 64, scale: 'major', prog: [0, 4, 5, 3], density: 1, form: ['A', 'B'],
    bass: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: true, arpRate: 1 },
});
const sfx = {
  tick: () => Sound.blip(880, 0.06, { type: 'square', vol: 0.18 }),
  go: () => { Sound.blip(1320, 0.25, { type: 'square', vol: 0.2, verb: 0.3 }); Sound.blip(1760, 0.25, { type: 'triangle', vol: 0.15, delay: 0.05 }); },
  tag: () => { Sound.hiss(0.18, { freq: 2500, vol: 0.35 }); Sound.blip(180, 0.15, { type: 'square', vol: 0.25, slide: 60 }); Sound.blip(660, 0.08, { type: 'square', vol: 0.15, delay: 0.05, slide: 1320 }); },
  dash: () => { Sound.hiss(0.18, { filter: 'bandpass', freq: 900, sweep: 4000, q: 1, vol: 0.18 }); },
  power: () => { [784, 988, 1175, 1568].forEach((f, i) => Sound.blip(f, 0.06, { type: 'square', vol: 0.11, delay: i * 0.045 })); },
  freeze: () => { Sound.blip(2400, 0.4, { type: 'triangle', vol: 0.12, slide: 400 }); Sound.hiss(0.4, { freq: 7000, vol: 0.12 }); },
  coin: () => Sound.play('coin'),
  boom: () => { Sound.hiss(0.9, { filter: 'lowpass', freq: 1200, sweep: 80, vol: 0.6 }); Sound.blip(90, 0.6, { type: 'sine', vol: 0.5, slide: 30 }); },
  fuse: f => Sound.blip(f, 0.03, { type: 'square', vol: 0.08 }),
  portal: () => { Sound.blip(300, 0.25, { type: 'sine', vol: 0.18, slide: 1200 }); },
  boost: () => { Sound.blip(400, 0.18, { type: 'sawtooth', vol: 0.08, slide: 1600, lp: 3000 }); },
  score: () => { [523, 659, 784].forEach((f, i) => Sound.blip(f, 0.09, { type: 'square', vol: 0.14, delay: i * 0.07 })); },
  win: () => Sound.play('catch', 4),
};

// ------------------------------------------------------------ settings
const COLORS = ['#ffd400', '#e83a3a', '#3aa8ff', '#6ae06a', '#c46cff', '#ff8ad8', '#ff8a2a', '#f0f0f0'];
const FACES = ['happy', 'cool', 'angry', 'cat', 'robot'];
const MODES = [
  { id: 'classic', name: 'CLASSIC', target: 10, desc: 'Runner survives 20 seconds to score. Tag to swap roles.' },
  { id: 'longest', name: 'LONGEST RUN', target: 0, desc: 'Each player runs once. Longest time alive wins.' },
  { id: 'potato', name: 'HOT POTATO', target: 5, desc: 'IT holds a bomb. Pass it with a tag before it explodes!' },
  { id: 'coins', name: 'COIN RUSH', target: 15, desc: 'Runner grabs coins. Tagger tags to steal the runner role.' },
];
const OPP = [['human', '2 PLAYERS'], ['easy', 'CPU EASY'], ['normal', 'CPU NORMAL'], ['hard', 'CPU HARD']];
let settings = { mode: 0, arena: 0, opp: 0, target: 10, skins: [{ color: 0, face: 0 }, { color: 1, face: 2 }] };
try { const s = JSON.parse(localStorage.getItem('cnatt_tag_settings')); if (s) settings = Object.assign(settings, s); } catch (e) {}
let wins = [0, 0];
try { wins = JSON.parse(localStorage.getItem('cnatt_tag_wins')) || [0, 0]; } catch (e) {}
const saveSettings = () => { try { localStorage.setItem('cnatt_tag_settings', JSON.stringify(settings)); localStorage.setItem('cnatt_tag_wins', JSON.stringify(wins)); } catch (e) {} };

// ------------------------------------------------------------ input
const keys = {};
let touchMode = false;
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (e.code === 'Escape') { if (screen === 'play') pauseGame(); else if (screen === 'pause') resume(); else if (screen === 'over') toMenu(); }
  if (e.code === 'KeyF') toggleFullscreen();
  if (e.code === 'Enter' && screen === 'menu') startMatch();
  if (e.code === 'KeyM') Sound.setMusic(!Sound.musicOn);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const UI = { mx: -1, my: -1, down: false, px: 0, py: 0, click: null, hover: null, lastHover: null };
const pointers = new Map(); // touch joysticks
function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const [x, y] = toCanvas(e);
  if (e.pointerType === 'touch') touchMode = true;
  UI.mx = x; UI.my = y; UI.down = true; UI.px = x; UI.py = y;
  if (screen === 'play' && touchMode) {
    const side = x < W / 2 ? 0 : 1;
    if (side === 1 && players[1] && players[1].cpu) return;
    const dashBtn = side === 0 ? { x: 230, y: H - 110 } : { x: W - 230, y: H - 110 };
    if (Math.hypot(x - dashBtn.x, y - dashBtn.y) < 60) { dashReq[side] = true; return; }
    pointers.set(e.pointerId, { side, ox: x, oy: y, x, y });
  }
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener('pointermove', e => {
  const [x, y] = toCanvas(e); UI.mx = x; UI.my = y;
  const p = pointers.get(e.pointerId); if (p) { p.x = x; p.y = y; }
});
const endPointer = e => {
  const [x, y] = toCanvas(e); UI.down = false;
  UI.click = { x, y, px: UI.px, py: UI.py };
  pointers.delete(e.pointerId);
};
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
const dashReq = [false, false];

function readInput(i) {
  let x = 0, y = 0, dash = false;
  if (i === 0) {
    if (keys.KeyA) x -= 1; if (keys.KeyD) x += 1; if (keys.KeyW) y -= 1; if (keys.KeyS) y += 1;
    dash = keys.ShiftLeft || keys.Space;
  } else {
    if (keys.ArrowLeft) x -= 1; if (keys.ArrowRight) x += 1; if (keys.ArrowUp) y -= 1; if (keys.ArrowDown) y += 1;
    dash = keys.ShiftRight || keys.Enter || keys.Slash || keys.Numpad0;
  }
  for (const p of pointers.values()) {
    if (p.side !== i) continue;
    const dx = p.x - p.ox, dy = p.y - p.oy, d = Math.hypot(dx, dy);
    if (d > 10) { x = dx / Math.max(d, 50); y = dy / Math.max(d, 50); }
  }
  if (dashReq[i]) { dash = true; dashReq[i] = false; }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  return { x, y, dash };
}

// ------------------------------------------------------------ arena
let grid = [], arena = ARENAS[0], portals = {}, spawns = [];
function loadArena(a) {
  arena = a;
  const inner = a.rows.map(r => (r + '.'.repeat(30)).slice(0, 30));
  while (inner.length < 14) inner.push('.'.repeat(30));
  grid = ['#'.repeat(32), ...inner.map(r => '#' + r + '#'), '#'.repeat(32)].map(r => r.split(''));
  portals = {}; spawns = [null, null];
  grid.forEach((row, r) => row.forEach((ch, c) => {
    if (ch === '1') { spawns[0] = { c, r }; row[c] = '.'; }
    if (ch === '2') { spawns[1] = { c, r }; row[c] = '.'; }
    if ('AaCc'.includes(ch)) { (portals[ch.toUpperCase()] = portals[ch.toUpperCase()] || []).push({ c, r }); }
  }));
  if (!spawns[0]) spawns[0] = { c: 1, r: 1 };
  if (!spawns[1]) spawns[1] = { c: 30, r: 14 };
  bake();
}
const tileAt = (c, r) => (r < 0 || r >= ROWS || c < 0 || c >= COLS) ? '#' : grid[r][c];
const solid = (c, r) => tileAt(c, r) === '#';
const tileOf = (x, y) => [Math.floor(x / T), Math.floor((y - TOP) / T)];
const center = (c, r) => ({ x: c * T + T / 2, y: TOP + r * T + T / 2 });

// pre-rendered arena (static layer)
const bakeCv = document.createElement('canvas'); bakeCv.width = W; bakeCv.height = H - TOP;
function bake() {
  const b = bakeCv.getContext('2d'), col = arena.color;
  b.fillStyle = arena.floor; b.fillRect(0, 0, W, H - TOP);
  // floor grid
  b.strokeStyle = rgba(col, 0.08); b.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) { b.beginPath(); b.moveTo(c * T + 0.5, 0); b.lineTo(c * T + 0.5, H - TOP); b.stroke(); }
  for (let r = 0; r <= ROWS; r++) { b.beginPath(); b.moveTo(0, r * T + 0.5); b.lineTo(W, r * T + 0.5); b.stroke(); }
  grid.forEach((row, r) => row.forEach((ch, c) => {
    const x = c * T, y = r * T;
    if (ch === '~') {
      b.fillStyle = '#1e4e70'; b.fillRect(x, y, T, T);
      b.fillStyle = 'rgba(255,255,255,0.10)'; b.fillRect(x + ((c * 7 + r * 3) % 20), y + 6 + ((c + r) % 3) * 8, 14, 2);
      b.fillStyle = 'rgba(168,240,255,0.08)'; b.fillRect(x, y, T, 2);
    } else if (ch === ',') {
      b.fillStyle = '#3a1a24'; b.fillRect(x, y, T, T);
      b.fillStyle = '#4e2430'; for (let k = 0; k < 3; k++) b.fillRect(x + ((c * 13 + k * 11) % 32), y + ((r * 7 + k * 13) % 32), 6, 6);
    } else if (ch === '>') {
      b.fillStyle = '#2a1408'; b.fillRect(x + 2, y + 2, T - 4, T - 4);
    }
  }));
  // walls with bevel
  grid.forEach((row, r) => row.forEach((ch, c) => {
    if (ch !== '#') return;
    const x = c * T, y = r * T;
    b.fillStyle = shade(col, -0.72); b.fillRect(x, y, T, T);
    b.fillStyle = shade(col, -0.55); b.fillRect(x + 3, y + 3, T - 6, T - 6);
    // neon edges only where the wall meets the floor
    b.fillStyle = col;
    if (!solid(c, r - 1)) b.fillRect(x, y, T, 3);
    if (!solid(c, r + 1)) b.fillRect(x, y + T - 3, T, 3);
    if (!solid(c - 1, r)) b.fillRect(x, y, 3, T);
    if (!solid(c + 1, r)) b.fillRect(x + T - 3, y, 3, T);
  }));
}

// ------------------------------------------------------------ game state
let screen = 'menu';      // menu | play | pause | over
let phase = 'countdown';  // countdown | live | freeze
let phaseT = 0, t = 0, roundT = 0, matchT = 0;
let players = [], score = [0, 0], itIdx = 0, round = 1, longestTimes = [0, 0];
let powerups = [], coins = [], particles = [], rings = [], floaters = [], shake = 0, hitstop = 0, slowmo = 1;
let nextPower = 4, bomb = null, announce = null, winner = -1, confetti = [], matchId = 0;
const later = (fn, ms) => { const id = matchId; setTimeout(() => { if (id === matchId && (screen === 'play' || screen === 'pause')) fn(); }, ms); };
const mode = () => MODES[settings.mode];

function makePlayer(i) {
  const sk = settings.skins[i], s = spawns[i], c = center(s.c, s.r);
  return {
    i, x: c.x, y: c.y, vx: 0, vy: 0, color: COLORS[sk.color], face: FACES[sk.face],
    name: i === 1 && settings.opp > 0 ? 'CPU' : 'P' + (i + 1), cpu: i === 1 && settings.opp > 0,
    frozen: 0, ghost: 0, shield: 0, speed: 0, shrink: 0, dashCd: 0, dashT: 0, portalCd: 0, stun: 0,
    inBush: false, trail: [], look: { x: i === 0 ? 1 : -1, y: 0 }, squash: 0,
    ai: { next: 0, path: [], goal: null }, stats: { tags: 0, dashes: 0, powers: 0, coins: 0 },
  };
}
function sizeOf(p) { let s = p.i === itIdx ? 32 : 26; if (p.shrink > 0) s *= 0.6; return s; }

function startMatch() {
  Sound.init(); Sound.play('click');
  loadArena(ARENAS[settings.arena]);
  score = [0, 0]; round = 1; longestTimes = [0, 0]; matchT = 0; winner = -1; matchId++;
  itIdx = settings.mode === 1 ? 1 : (Math.random() < 0.5 ? 0 : 1);
  saveSettings();
  newRound(false);
  screen = 'play';
  Sound.playSong(SONGS.tag_battle);
}
function newRound(swap) {
  if (swap) itIdx = 1 - itIdx;
  players = [makePlayer(0), makePlayer(1)];
  // tagger starts at the far spawn from the runner
  powerups = []; coins = []; particles = []; rings = []; bomb = null; nextPower = rand(3, 6);
  roundT = 0; phase = 'countdown'; phaseT = 0;
  if (mode().id === 'potato') bomb = { fuse: rand(18, 30), t: 0, beep: 0 };
  if (mode().id === 'coins') for (let k = 0; k < 3; k++) spawnCoin();
  announce = { text: mode().id === 'longest' ? `${players[1 - itIdx].name} RUNS!` : `${players[itIdx].name} IS IT!`, col: players[itIdx].color, t: 0 };
}
function pauseGame() { screen = 'pause'; Sound.play('back'); }
function resume() { screen = 'play'; Sound.play('click'); }
function toMenu() { screen = 'menu'; matchId++; Sound.playSong(SONGS.tag_menu); }
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  else (document.exitFullscreen || (() => {})).call(document);
}

function freeTile(minDistFromPlayers = 3) {
  for (let k = 0; k < 200; k++) {
    const c = 1 + Math.floor(Math.random() * 30), r = 1 + Math.floor(Math.random() * 14);
    if (tileAt(c, r) !== '.' && tileAt(c, r) !== '~' && tileAt(c, r) !== ',') continue;
    const p = center(c, r);
    if (players.some(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < minDistFromPlayers * T)) continue;
    if (powerups.some(u => Math.hypot(u.x - p.x, u.y - p.y) < T * 2) || coins.some(u => Math.hypot(u.x - p.x, u.y - p.y) < T * 3)) continue;
    return p;
  }
  return center(15, 7);
}
const POWERS = {
  speed:  { col: '#ffe650', label: 'SPEED',  dur: 4 },
  freeze: { col: '#a8f0ff', label: 'FREEZE', dur: 1.3 },
  ghost:  { col: '#d8d0ff', label: 'GHOST',  dur: 3.5 },
  shield: { col: '#6affd0', label: 'SHIELD', dur: 3.5 },
  shrink: { col: '#ff8ad8', label: 'SHRINK', dur: 5 },
};
function spawnPower() { const p = freeTile(4); powerups.push({ x: p.x, y: p.y, kind: pick(Object.keys(POWERS)), t: 0 }); }
function spawnCoin() { const p = freeTile(3); coins.push({ x: p.x, y: p.y, t: rand(0, 6) }); }

// ------------------------------------------------------------ physics
function moveAxis(p, dx, dy, s) {
  const half = s / 2;
  p.x += dx; p.y += dy;
  if (p.ghost > 0) { p.x = clamp(p.x, T + half, W - T - half); p.y = clamp(p.y, TOP + T + half, H - T - half); return; }
  const c0 = Math.floor((p.x - half) / T), c1 = Math.floor((p.x + half - 0.01) / T);
  const r0 = Math.floor((p.y - half - TOP) / T), r1 = Math.floor((p.y + half - 0.01 - TOP) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!solid(c, r)) continue;
    if (dx > 0) { p.x = c * T - half; p.vx = -p.vx * 0.2; }
    else if (dx < 0) { p.x = (c + 1) * T + half; p.vx = -p.vx * 0.2; }
    if (dy > 0) { p.y = TOP + r * T - half; p.vy = -p.vy * 0.2; }
    else if (dy < 0) { p.y = TOP + (r + 1) * T + half; p.vy = -p.vy * 0.2; }
  }
}
function updatePlayer(p, dt) {
  const inp = p.cpu ? cpuInput(p, dt) : readInput(p.i);
  const [c, r] = tileOf(p.x, p.y), tile = tileAt(c, r);
  const ice = tile === '~', mud = tile === ',';
  p.inBush = tile === 'B';
  let max = 300 * (p.i === itIdx ? 1.06 : 1) * (p.speed > 0 ? 1.4 : 1) * (mud ? 0.55 : 1) * (p.shrink > 0 ? 1.1 : 1);
  if (p.cpu) max *= [1, 0.82, 0.93, 1.0][settings.opp];
  const accel = ice ? 700 : 3200, fric = ice ? 0.6 : 10;
  if (p.frozen > 0 || p.stun > 0) { inp.x = 0; inp.y = 0; inp.dash = false; }
  p.vx += inp.x * accel * dt; p.vy += inp.y * accel * dt;
  if (!inp.x || ice) p.vx *= Math.exp(-fric * dt);
  if (!inp.y || ice) p.vy *= Math.exp(-fric * dt);
  if (inp.x || inp.y) p.look = { x: inp.x, y: inp.y };
  // dash
  if (inp.dash && p.dashCd <= 0 && (inp.x || inp.y || Math.hypot(p.vx, p.vy) > 40)) {
    const dx = inp.x || p.look.x, dy = inp.y || p.look.y, m = Math.hypot(dx, dy) || 1;
    p.vx = dx / m * 820; p.vy = dy / m * 820; p.dashT = 0.16; p.dashCd = 2.2; p.stats.dashes++;
    sfx.dash(); burst(p.x, p.y, 10, p.color, 160);
  }
  const sp = Math.hypot(p.vx, p.vy);
  const cap = p.dashT > 0 ? 900 : max;
  if (sp > cap) { const k = p.dashT > 0 ? cap / sp : lerp(1, cap / sp, ice ? 0.05 : 0.5); p.vx *= k; p.vy *= k; }
  const s = sizeOf(p);
  moveAxis(p, p.vx * dt, 0, s); moveAxis(p, 0, p.vy * dt, s);
  // tiles
  const [c2, r2] = tileOf(p.x, p.y), t2 = tileAt(c2, r2);
  if (t2 === '>' && p.dashT <= 0 && sp > 30 && p.portalCd <= 0) {
    const m = sp || 1; p.vx = p.vx / m * 760; p.vy = p.vy / m * 760; p.dashT = 0.25; p.portalCd = 0.4; sfx.boost(); burst(p.x, p.y, 12, '#ff8a3a', 180);
  }
  if ('AaCc'.includes(t2) && p.portalCd <= 0) {
    const pair = portals[t2.toUpperCase()], other = pair.find(q => q.c !== c2 || q.r !== r2);
    if (other) {
      burst(p.x, p.y, 16, '#c46cff', 200); const o = center(other.c, other.r); p.x = o.x; p.y = o.y;
      p.portalCd = 0.8; sfx.portal(); burst(p.x, p.y, 16, '#c46cff', 200); ring(p.x, p.y, '#c46cff');
    }
  }
  if (p.inBush && Math.random() < dt * 8 * (sp / 300)) particles.push({ x: p.x + rand(-12, 12), y: p.y + rand(-12, 12), vx: rand(-30, 30), vy: rand(-60, -20), life: 0.5, t: 0, col: '#4ac05a', s: 4, g: 200 });
  // timers
  ['frozen', 'ghost', 'shield', 'speed', 'shrink', 'dashCd', 'dashT', 'portalCd', 'stun'].forEach(k => { p[k] = Math.max(0, p[k] - dt); });
  // ghost ending inside a wall: push out to nearest free tile
  if (p.ghost <= 0) { const [cc, rr] = tileOf(p.x, p.y); if (solid(cc, rr)) { const f = nearestFree(cc, rr); const o = center(f.c, f.r); p.x = o.x; p.y = o.y; } }
  // trail
  p.trail.push({ x: p.x, y: p.y, s }); if (p.trail.length > (p.dashT > 0 || p.speed > 0 ? 10 : 5)) p.trail.shift();
  p.squash = lerp(p.squash, Math.min(1, sp / 900), 0.2);
}
function nearestFree(c, r) {
  for (let d = 1; d < 10; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) if (!solid(c + dc, r + dr)) return { c: c + dc, r: r + dr };
  return spawns[0];
}

// ------------------------------------------------------------ CPU brain
function bfs(fromC, fromR) {
  const dist = Array.from({ length: ROWS }, () => new Array(COLS).fill(1e9));
  const q = [[fromC, fromR]]; if (solid(fromC, fromR)) return dist;
  dist[fromR][fromC] = 0;
  for (let h = 0; h < q.length; h++) {
    const [c, r] = q[h], d = dist[r][c];
    const nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
    const ch = tileAt(c, r);
    if ('AaCc'.includes(ch)) { const o = portals[ch.toUpperCase()].find(p => p.c !== c || p.r !== r); if (o) nb.push([o.c, o.r]); }
    for (const [nc, nr] of nb) {
      if (solid(nc, nr)) continue;
      const cost = tileAt(nc, nr) === ',' ? 2 : 1;
      if (dist[nr][nc] > d + cost) { dist[nr][nc] = d + cost; q.push([nc, nr]); }
    }
  }
  return dist;
}
function stepToward(p, dist) {
  const [c, r] = tileOf(p.x, p.y);
  let best = null, bd = dist[r] ? dist[r][c] : 1e9;
  const nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
  const ch = tileAt(c, r);
  for (const [nc, nr] of nb) if (!solid(nc, nr) && dist[nr][nc] < bd) { bd = dist[nr][nc]; best = [nc, nr]; }
  return best ? center(best[0], best[1]) : null;
}
function cpuInput(p, dt) {
  const lvl = settings.opp, react = [0, 0.38, 0.2, 0.09][lvl];
  const me = p, foe = players[0];
  p.ai.next -= dt;
  if (p.ai.next <= 0) {
    p.ai.next = react * rand(0.7, 1.3);
    const [fc, fr] = tileOf(foe.x, foe.y), [mc, mr] = tileOf(me.x, me.y);
    const iAmIt = p.i === itIdx;
    const hidden = foe.inBush && Math.random() < 0.6;
    if (iAmIt && !(mode().id === 'longest' && p.i !== itIdx)) {
      // chase (aim a little ahead of where the player is going)
      let tc = fc, tr = fr;
      if (lvl >= 2) { const [pc, pr] = tileOf(foe.x + foe.vx * 0.3, foe.y + foe.vy * 0.3); if (!solid(pc, pr)) { tc = pc; tr = pr; } }
      if (hidden && p.ai.lastSeen) { tc = p.ai.lastSeen[0]; tr = p.ai.lastSeen[1]; }
      else p.ai.lastSeen = [fc, fr];
      p.ai.dist = bfs(tc, tr);
      p.ai.wantDash = Math.hypot(foe.x - me.x, foe.y - me.y) < [0, 70, 120, 150][lvl] && Math.random() < [0, 0.3, 0.6, 0.9][lvl];
    } else {
      // flee: pick a reachable spot far from the tagger
      const dT = bfs(fc, fr), dA = bfs(mc, mr);
      let best = null, bs = -1e9;
      for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
        if (dA[r][c] > 9 || dA[r][c] >= 1e9) continue;
        let s = dT[r][c] * 1.0 - dA[r][c] * 0.35 + Math.random() * [0, 6, 3, 1][lvl];
        if (tileAt(c, r) === 'B') s += 3;
        if (mode().id === 'coins') coins.forEach(cn => { const [cc, cr] = tileOf(cn.x, cn.y); if (cc === c && cr === r) s += 6; });
        powerups.forEach(u => { const [uc, ur] = tileOf(u.x, u.y); if (uc === c && ur === r) s += 4; });
        if (s > bs) { bs = s; best = [c, r]; }
      }
      p.ai.dist = best ? bfs(best[0], best[1]) : dT;
      p.ai.wantDash = Math.hypot(foe.x - me.x, foe.y - me.y) < [0, 60, 90, 110][lvl] && Math.random() < [0, 0.3, 0.6, 0.9][lvl];
    }
  }
  let x = 0, y = 0;
  if (p.ai.dist) {
    const nxt = stepToward(p, p.ai.dist);
    const [mc, mr] = tileOf(me.x, me.y);
    let tgt = nxt;
    if (!tgt) tgt = p.i === itIdx ? { x: foe.x, y: foe.y } : null;
    if (p.i === itIdx && Math.hypot(foe.x - me.x, foe.y - me.y) < T * 1.2) tgt = { x: foe.x, y: foe.y };
    if (tgt) {
      // stay centered in corridors
      const cc = center(mc, mr);
      const dx = tgt.x - me.x + (Math.abs(tgt.x - cc.x) < 2 ? (cc.x - me.x) * 0.5 : 0);
      const dy = tgt.y - me.y + (Math.abs(tgt.y - cc.y) < 2 ? (cc.y - me.y) * 0.5 : 0);
      const m = Math.hypot(dx, dy) || 1; x = dx / m; y = dy / m;
    }
  }
  const dash = !!p.ai.wantDash; p.ai.wantDash = false;
  return { x, y, dash };
}

// ------------------------------------------------------------ rules
function onTag(tagger, runner) {
  tagger.stats.tags++;
  sfx.tag(); hitstop = 0.14; shake = 0.35;
  burst(runner.x, runner.y, 30, tagger.color, 320); ring(runner.x, runner.y, tagger.color); ring(runner.x, runner.y, '#ffffff');
  floaters.push({ x: runner.x, y: runner.y - 30, text: 'TAGGED!', col: '#ffffff', t: 0 });
  const m = mode().id;
  if (m === 'longest') {
    longestTimes[runner.i] = roundT;
    endLongestRound();
    return;
  }
  itIdx = runner.i;
  runner.stun = 0.9;           // new tagger waits a moment
  tagger.shield = Math.max(tagger.shield, 0.9);
  if (m === 'classic') { roundT = 0; }
  if (m === 'potato') { bomb.t = Math.max(0, bomb.t - 2); }
  announce = { text: `${runner.name} IS IT!`, col: runner.color, t: 0, small: true };
}
function endLongestRound() {
  phase = 'freeze'; phaseT = 0;
  if (round === 1) {
    announce = { text: `${players[1 - itIdx].name}: ${longestTimes[1 - itIdx].toFixed(1)}s`, col: players[1 - itIdx].color, t: 0 };
    later(() => { round = 2; newRound(true); }, 2200);
  } else {
    const w = longestTimes[0] === longestTimes[1] ? -1 : (longestTimes[0] > longestTimes[1] ? 0 : 1);
    later(() => endMatch(w), 2200);
  }
}
function addPoint(i, why) {
  score[i]++; sfx.score();
  floaters.push({ x: players[i].x, y: players[i].y - 34, text: why || '+1', col: players[i].color, t: 0 });
  const target = settings.target || mode().target;
  if (score[i] >= target) { endMatch(i); return true; }
  return false;
}
function endMatch(w) {
  winner = w; screen = 'over'; matchT = 0;
  if (w >= 0) wins[w]++; saveSettings();
  sfx.win(); Sound.playSong(SONGS.tag_win);
  confetti = Array.from({ length: 160 }, () => ({ x: rand(0, W), y: rand(-H, 0), vx: rand(-60, 60), vy: rand(80, 240), r: rand(0, 6), vr: rand(-8, 8), col: pick(COLORS), s: rand(6, 12) }));
}
function updateRules(dt) {
  const m = mode().id;
  roundT += dt;
  const [a, b] = players;
  const tagger = players[itIdx], runner = players[1 - itIdx];
  // tag check
  const s = (sizeOf(tagger) + sizeOf(runner)) / 2 + 4;
  if (Math.abs(tagger.x - runner.x) < s && Math.abs(tagger.y - runner.y) < s && runner.shield <= 0 && tagger.stun <= 0 && tagger.frozen <= 0) onTag(tagger, runner);
  if (phase !== 'live') return;
  if (m === 'classic' && roundT >= 20) {
    if (!addPoint(runner.i, 'SURVIVED! +1')) { phase = 'freeze'; phaseT = 0; later(() => newRound(true), 1300); }
  }
  if (m === 'longest' && roundT >= 90) { longestTimes[runner.i] = 90; endLongestRound(); }
  if (m === 'potato' && bomb) {
    bomb.t += dt;
    const left = bomb.fuse - bomb.t;
    bomb.beep -= dt;
    if (bomb.beep <= 0) { bomb.beep = clamp(left / 6, 0.08, 0.9); sfx.fuse(left < 3 ? 1400 : 900); }
    if (left <= 0) {
      const it = players[itIdx];
      sfx.boom(); shake = 0.8; hitstop = 0.2;
      burst(it.x, it.y, 80, '#ff8a3a', 500); burst(it.x, it.y, 40, '#ffe650', 300); ring(it.x, it.y, '#ff8a3a'); ring(it.x, it.y, '#ffffff');
      if (!addPoint(1 - itIdx, 'BOOM! +1')) { phase = 'freeze'; phaseT = 0; later(() => newRound(false), 1500); }
    }
  }
  if (m === 'coins') {
    coins.forEach(cn => {
      cn.t += dt;
      if (Math.hypot(cn.x - runner.x, cn.y - runner.y) < 26) {
        cn.dead = true; runner.stats.coins++; sfx.coin(); burst(cn.x, cn.y, 12, '#ffe650', 160);
        addPoint(runner.i, '+1');
      }
    });
    coins = coins.filter(c => !c.dead);
    while (coins.length < 3 && screen === 'play') spawnCoin();
  }
  // power-ups
  nextPower -= dt;
  if (nextPower <= 0 && powerups.length < 2) { spawnPower(); nextPower = rand(5, 9); }
  powerups.forEach(u => {
    u.t += dt;
    players.forEach(p => {
      if (u.dead || Math.hypot(u.x - p.x, u.y - p.y) > 28) return;
      u.dead = true; p.stats.powers++; sfx.power(); burst(u.x, u.y, 16, POWERS[u.kind].col, 200); ring(u.x, u.y, POWERS[u.kind].col);
      const o = players[1 - p.i], P = POWERS[u.kind];
      if (u.kind === 'freeze') { o.frozen = P.dur; sfx.freeze(); }
      else if (u.kind === 'shield' && p.i === itIdx) p.speed = 3;
      else p[u.kind] = P.dur;
      floaters.push({ x: p.x, y: p.y - 30, text: u.kind === 'freeze' ? 'FREEZE!' : P.label, col: P.col, t: 0 });
    });
  });
  powerups = powerups.filter(u => !u.dead && u.t < 14);
}

// ------------------------------------------------------------ effects
function burst(x, y, n, col, sp) { for (let i = 0; i < n; i++) { const a = rand(0, 6.283), v = rand(0.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.7), t: 0, col, s: rand(3, 7), g: 0 }); } }
function ring(x, y, col) { rings.push({ x, y, r: 6, t: 0, col }); }

// ------------------------------------------------------------ drawing helpers
function text(s, x, y, size = 16, col = '#fff', align = 'left', shadow = true) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(s, x + Math.max(2, size / 8), y + Math.max(2, size / 8)); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function box(x, y, w, h, fill, border) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 6, y + 6, w, h);
  ctx.fillStyle = border; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
}
function button(id, x, y, w, h, label, o = {}) {
  const over = UI.mx >= x && UI.mx < x + w && UI.my >= y && UI.my < y + h;
  const pressed = over && UI.down;
  if (over) UI.hover = id;
  const base = o.color || '#3a2f8a';
  const dy = pressed ? 4 : 0;
  ctx.fillStyle = '#05040e'; ctx.fillRect(x, y + 4, w, h);
  ctx.fillStyle = shade(base, -0.4); ctx.fillRect(x, y + dy, w, h);
  ctx.fillStyle = over ? shade(base, 0.15) : base; ctx.fillRect(x, y + dy, w, h - 6);
  ctx.fillStyle = shade(base, 0.35); ctx.fillRect(x, y + dy, w, 4);
  text(label, x + w / 2, y + dy + (h - 6 - (o.size || 16)) / 2 + 1, o.size || 16, o.textCol || '#fff', 'center');
  const c = UI.click;
  if (c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { UI.click = null; Sound.play(o.sfx || 'click'); return true; }
  return false;
}
function arrows(id, x, y, w, label, onPrev, onNext, col = '#6ad0ff') {
  if (button(id + 'l', x, y, 52, 52, '<', { color: '#2a2440', sfx: 'tab' })) onPrev();
  if (button(id + 'r', x + w - 52, y, 52, 52, '>', { color: '#2a2440', sfx: 'tab' })) onNext();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 60, y, w - 120, 48);
  text(label, x + w / 2, y + 16, 16, col, 'center');
}

function drawPlayer(p, x = p.x, y = p.y, scale = 1, forMenu = false) {
  const s = (forMenu ? 26 : sizeOf(p)) * scale;
  const isIt = !forMenu && p.i === itIdx;
  let alpha = 1;
  if (!forMenu && p.inBush) alpha = 0.18;
  if (!forMenu && p.ghost > 0) alpha *= 0.5;
  ctx.save(); ctx.globalAlpha = alpha;
  // trail
  if (!forMenu) p.trail.forEach((q, k) => { ctx.globalAlpha = alpha * (k / p.trail.length) * 0.35; ctx.fillStyle = p.color; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); });
  ctx.globalAlpha = alpha;
  // IT aura
  if (isIt) {
    const pul = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.fillStyle = `rgba(255,60,60,${0.18 + 0.12 * pul})`; ctx.fillRect(x - s / 2 - 8, y - s / 2 - 8, s + 16, s + 16);
  }
  // body with squash in movement direction
  const sq = forMenu ? 0 : p.squash * 0.18;
  const bw = s * (1 + (Math.abs(p.vx) > Math.abs(p.vy) ? sq : -sq * 0.6)), bh = s * (1 + (Math.abs(p.vy) >= Math.abs(p.vx) ? sq : -sq * 0.6));
  ctx.fillStyle = '#05040e'; ctx.fillRect(x - bw / 2 - 3, y - bh / 2 - 3, bw + 6, bh + 6);
  ctx.fillStyle = p.color; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
  ctx.fillStyle = shade(p.color, 0.35); ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh * 0.22);
  ctx.fillStyle = shade(p.color, -0.3); ctx.fillRect(x - bw / 2, y + bh / 2 - bh * 0.16, bw, bh * 0.16);
  // face
  const lk = forMenu ? { x: 0.6, y: 0.2 } : p.look, ex = clamp(lk.x, -1, 1) * s * 0.08, ey = clamp(lk.y, -1, 1) * s * 0.08;
  const e = s * 0.16, eyY = y - s * 0.08 + ey;
  const blink = (Math.floor(t * 10 + p.i * 7) % 40) === 0;
  const eyeL = x - s * 0.2 + ex, eyeR = x + s * 0.2 + ex;
  if (p.face === 'cool') {
    ctx.fillStyle = '#05040e'; ctx.fillRect(eyeL - e, eyY - e * 0.6, e * 2.2 + s * 0.4, e * 1.4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(eyeL - e * 0.6, eyY - e * 0.4, e * 0.6, e * 0.3);
  } else if (p.face === 'robot') {
    ctx.fillStyle = '#05040e'; ctx.fillRect(x - s * 0.36 + ex, eyY - e * 0.6, s * 0.72, e * 1.3);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x - s * 0.36 + ex + ((t * 60) % (s * 0.6)), eyY - e * 0.4, e, e * 0.9);
    ctx.fillStyle = '#05040e'; ctx.fillRect(x - 1, y - bh / 2 - 8, 2, 8); ctx.fillRect(x - 3, y - bh / 2 - 10, 6, 4);
  } else {
    [eyeL, eyeR].forEach(ex2 => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ex2 - e * 0.7, eyY - (blink ? 1 : e * 0.7), e * 1.4, blink ? 2 : e * 1.4);
      if (!blink) { ctx.fillStyle = '#05040e'; ctx.fillRect(ex2 - e * 0.35 + ex * 0.6, eyY - e * 0.35 + ey * 0.6, e * 0.7, e * 0.7); }
    });
    if (p.face === 'angry') { ctx.fillStyle = '#05040e'; ctx.fillRect(eyeL - e, eyY - e * 1.2, e * 2, 3); ctx.fillRect(eyeR - e, eyY - e * 1.2, e * 2, 3); }
    if (p.face === 'cat') {
      ctx.fillStyle = p.color;
      [[-1, 1], [1, -1]].forEach(([sx]) => { ctx.beginPath(); ctx.moveTo(x + sx * s * 0.42, y - bh / 2); ctx.lineTo(x + sx * s * 0.18, y - bh / 2); ctx.lineTo(x + sx * s * 0.34, y - bh / 2 - s * 0.3); ctx.fill(); });
    }
  }
  // mouth
  ctx.fillStyle = '#05040e';
  const my = y + s * 0.2 + ey;
  if (p.face === 'happy' || p.face === 'cat') { ctx.fillRect(x - s * 0.15 + ex, my, s * 0.3, 3); ctx.fillRect(x - s * 0.18 + ex, my - 3, 3, 3); ctx.fillRect(x + s * 0.15 + ex - 3, my - 3, 3, 3); }
  else if (p.face === 'angry') ctx.fillRect(x - s * 0.12 + ex, my + 2, s * 0.24, 3);
  else if (p.face === 'cool') { ctx.fillRect(x - s * 0.1 + ex, my, s * 0.24, 3); ctx.fillRect(x + s * 0.12 + ex, my - 3, 3, 3); }
  // status overlays
  if (!forMenu) {
    if (p.frozen > 0) { ctx.fillStyle = 'rgba(168,240,255,0.55)'; ctx.fillRect(x - s / 2 - 6, y - s / 2 - 6, s + 12, s + 12); ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 2; ctx.strokeRect(x - s / 2 - 6, y - s / 2 - 6, s + 12, s + 12); }
    if (p.shield > 0) { ctx.strokeStyle = rgba('#6affd0', 0.6 + 0.3 * Math.sin(t * 12)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, Math.PI * 2); ctx.stroke(); }
    if (p.stun > 0) for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; text('*', x + Math.cos(a) * 18 - 4, y - s / 2 - 16 + Math.sin(a) * 5, 8, '#ffe650'); }
    if (isIt) { text(mode().id === 'potato' ? '' : 'IT', x, y - s / 2 - 22, 12, '#ff5a5a', 'center'); }
    if (isIt && bomb) drawBomb(x + s * 0.45, y - s * 0.6);
    if (p.cpu && !p.inBush) text('CPU', x, y + s / 2 + 8, 8, '#c8c0e8', 'center');
  }
  ctx.restore();
}
function drawBomb(x, y) {
  const left = bomb.fuse - bomb.t, flash = left < 4 && Math.sin(t * (30 - left * 5)) > 0;
  ctx.fillStyle = '#05040e'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ff3a3a' : '#2a2440'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x - 5, y - 5, 3, 3);
  ctx.fillStyle = '#c8a050'; ctx.fillRect(x + 5, y - 13, 3, 6);
  ctx.fillStyle = Math.random() < 0.5 ? '#ffe650' : '#ff8a3a'; ctx.fillRect(x + 4 + rand(-2, 2), y - 17 + rand(-2, 2), 4, 4);
}
function drawTiles() {
  // animated tiles: boost pads, portals, bushes (drawn over players), coins, power-ups
  grid.forEach((row, r) => row.forEach((ch, c) => {
    const x = c * T, y = TOP + r * T;
    if (ch === '>') {
      for (let k = 0; k < 3; k++) {
        const ph = ((t * 2 + k / 3) % 1);
        ctx.fillStyle = rgba('#ff8a3a', 1 - ph);
        const ax = x + 8 + ph * 20;
        ctx.beginPath(); ctx.moveTo(ax, y + 10); ctx.lineTo(ax + 10, y + 20); ctx.lineTo(ax, y + 30); ctx.lineTo(ax + 4, y + 20); ctx.fill();
      }
    } else if ('AaCc'.includes(ch)) {
      const col = ch.toUpperCase() === 'A' ? '#c46cff' : '#6ad0ff';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = rgba(col, 0.9 - k * 0.25); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x + T / 2, y + T / 2, 16 - k * 4, 16 - k * 4, 0, t * (3 + k) + k, t * (3 + k) + k + 4.5); ctx.stroke();
      }
    } else if (ch === ',') {
      if (Math.sin(t * 2 + c * 3 + r * 5) > 0.97) { ctx.fillStyle = '#6a2a3a'; ctx.beginPath(); ctx.arc(x + 20 + Math.sin(c) * 10, y + 20 + Math.cos(r) * 10, 4, 0, 6.3); ctx.fill(); }
    }
  }));
}
function drawBushes() {
  grid.forEach((row, r) => row.forEach((ch, c) => {
    if (ch !== 'B') return;
    const x = c * T, y = TOP + r * T, sway = Math.sin(t * 1.5 + c * 0.7 + r) * 2;
    ctx.fillStyle = '#1a5a2a'; ctx.fillRect(x - 2, y + 4, T + 4, T - 2);
    ctx.fillStyle = '#2a8a3a';
    [[8, 10], [24, 8], [16, 22], [32, 22], [6, 28]].forEach(([bx, by], k) => { ctx.beginPath(); ctx.arc(x + bx + sway * (k % 2 ? 1 : -1), y + by, 10, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#4ac05a'; ctx.fillRect(x + 10 + sway, y + 6, 4, 4); ctx.fillRect(x + 26 - sway, y + 18, 4, 4);
  }));
}
function drawPickups() {
  coins.forEach(cn => {
    const w = Math.abs(Math.cos(cn.t * 4)) * 12 + 2, y = cn.y + Math.sin(cn.t * 3) * 3;
    ctx.fillStyle = 'rgba(255,230,80,0.25)'; ctx.beginPath(); ctx.arc(cn.x, y, 18, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#5a3a0e'; ctx.fillRect(cn.x - w / 2 - 2, y - 14, w + 4, 28);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(cn.x - w / 2, y - 12, w, 24);
    ctx.fillStyle = '#fff3c4'; ctx.fillRect(cn.x - w / 2, y - 12, Math.max(2, w * 0.3), 24);
  });
  powerups.forEach(u => {
    const P = POWERS[u.kind], y = u.y + Math.sin(u.t * 4) * 4, blink = u.t > 11 && Math.sin(u.t * 20) > 0;
    if (blink) return;
    ctx.fillStyle = rgba(P.col, 0.25 + 0.1 * Math.sin(u.t * 6)); ctx.beginPath(); ctx.arc(u.x, y, 22, 0, 6.3); ctx.fill();
    ctx.save(); ctx.translate(u.x, y); ctx.rotate(Math.PI / 4 + Math.sin(u.t * 2) * 0.2);
    ctx.fillStyle = '#05040e'; ctx.fillRect(-14, -14, 28, 28); ctx.fillStyle = P.col; ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.fillStyle = '#05040e';
    const ic = { speed: '>>', freeze: '*', ghost: '?', shield: 'O', shrink: 'v' }[u.kind];
    text(ic, u.x, y - 6, 12, '#05040e', 'center', false);
  });
}

// ------------------------------------------------------------ HUD
function drawHUD() {
  ctx.fillStyle = '#07061a'; ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = arena.color; ctx.fillRect(0, TOP - 4, W, 4);
  const target = settings.target || mode().target;
  players.forEach((p, i) => {
    const x = i === 0 ? 24 : W - 24, al = i === 0 ? 'left' : 'right';
    drawPlayer(p, i === 0 ? x + 18 : x - 18, 40, 1, true);
    const tx = i === 0 ? x + 54 : x - 54;
    text(p.name, tx, 14, 12, p.color, al);
    if (mode().id === 'longest') text(round > 1 || i !== 1 - itIdx ? `${longestTimes[i].toFixed(1)}s` : '--', tx, 38, 16, '#fff', al);
    else text(`${score[i]}/${target}`, tx, 38, 16, '#fff', al);
    // role
    const role = mode().id === 'potato' ? (i === itIdx ? 'HAS BOMB' : 'SAFE') : (i === itIdx ? 'TAGGER' : 'RUNNER');
    text(role, i === 0 ? tx + 150 : tx - 150, 16, 8, i === itIdx ? '#ff5a5a' : '#6ae06a', al);
    // dash meter
    const dx = i === 0 ? tx + 150 : tx - 150 - 100;
    ctx.fillStyle = '#1a1830'; ctx.fillRect(dx, 34, 100, 10);
    ctx.fillStyle = p.dashCd <= 0 ? '#6ad0ff' : '#3a5a7a'; ctx.fillRect(dx, 34, 100 * (1 - p.dashCd / 2.2), 10);
    text('DASH', i === 0 ? dx : dx + 100, 50, 8, p.dashCd <= 0 ? '#6ad0ff' : '#5a6a8a', al);
    // active powers
    let k = 0;
    Object.keys(POWERS).forEach(key => {
      const v = key === 'freeze' ? p.frozen : p[key]; if (v <= 0) return;
      const px = i === 0 ? dx + 112 + k * 26 : dx - 26 - k * 26;
      ctx.fillStyle = POWERS[key].col; ctx.fillRect(px, 30, 20, 20 * Math.min(1, v / POWERS[key].dur)); k++;
    });
  });
  // center: mode + timer
  const m = mode().id;
  text(mode().name, W / 2, 12, 12, arena.color, 'center');
  let tt = '';
  if (m === 'classic') tt = Math.max(0, 20 - roundT).toFixed(1);
  else if (m === 'longest') tt = roundT.toFixed(1) + 's';
  else if (m === 'potato') tt = bomb ? (bomb.fuse - bomb.t < 5 ? '!!!' : '???') : '';
  else tt = '';
  text(tt, W / 2, 36, 24, m === 'potato' && bomb && bomb.fuse - bomb.t < 5 ? '#ff5a5a' : '#ffffff', 'center');
  if (m === 'classic') { ctx.fillStyle = '#1a1830'; ctx.fillRect(W / 2 - 120, 66, 240, 6); ctx.fillStyle = players[1 - itIdx].color; ctx.fillRect(W / 2 - 120, 66, 240 * clamp(roundT / 20, 0, 1), 6); }
}
function drawTouch() {
  if (!touchMode) return;
  [0, 1].forEach(side => {
    if (side === 1 && players[1] && players[1].cpu) return;
    const bx = side === 0 ? 230 : W - 230, by = H - 110;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(bx, by, 52, 0, 6.3); ctx.fill();
    text('DASH', bx, by - 6, 12, '#ffffff', 'center');
  });
  for (const p of pointers.values()) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.ox, p.oy, 50, 0, 6.3); ctx.stroke();
    const dx = p.x - p.ox, dy = p.y - p.oy, d = Math.min(50, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(p.ox + Math.cos(a) * d, p.oy + Math.sin(a) * d, 22, 0, 6.3); ctx.fill();
  }
}

// ------------------------------------------------------------ screens
let menuPreview = 0;
function drawMenu() {
  // animated background: arena preview with two bots chasing
  ctx.fillStyle = '#07061a'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.35; ctx.drawImage(bakeCv, 0, TOP); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(7,6,26,0.55)'; ctx.fillRect(0, 0, W, H);
  // title
  const title = '2 PLAYER TAG';
  [...title].forEach((ch, i) => text(ch, W / 2 - title.length * 22 + i * 44 + 22, 34 + Math.sin(t * 3 + i * 0.4) * 6, 40, i < 2 ? '#ffd400' : (i % 2 ? '#ff5a5a' : '#ffd400'), 'center'));
  text('Dev: Mcant', W / 2, 92, 8, '#a8a0d0', 'center');
  const col1 = 120, col2 = 680, w = 480;
  // mode
  text('MODE', col1, 132, 12, '#a8a0d0');
  arrows('mode', col1, 152, w, MODES[settings.mode].name, () => { settings.mode = (settings.mode + 3) % 4; settings.target = MODES[settings.mode].target; }, () => { settings.mode = (settings.mode + 1) % 4; settings.target = MODES[settings.mode].target; }, '#ffd400');
  text(MODES[settings.mode].desc, col1, 214, 8, '#c8c0e8');
  // arena
  text('ARENA', col1, 248, 12, '#a8a0d0');
  arrows('arena', col1, 268, w, ARENAS[settings.arena].name, () => { settings.arena = (settings.arena + ARENAS.length - 1) % ARENAS.length; loadArena(ARENAS[settings.arena]); }, () => { settings.arena = (settings.arena + 1) % ARENAS.length; loadArena(ARENAS[settings.arena]); }, ARENAS[settings.arena].color);
  text(ARENAS[settings.arena].desc, col1, 330, 8, '#c8c0e8');
  // mini map
  ctx.fillStyle = '#05040e'; ctx.fillRect(col1 - 4, 352, 32 * 8 + 8, 16 * 8 + 8);
  ctx.drawImage(bakeCv, col1, 356, 32 * 8, 16 * 8);
  // opponent + target
  text('OPPONENT', col1 + 290, 352, 12, '#a8a0d0');
  OPP.forEach(([id, label], k) => { if (button('opp' + k, col1 + 290, 372 + k * 30, 190, 26, label, { color: settings.opp === k ? '#6a3aa0' : '#2a2440', size: 8, sfx: 'tab' })) settings.opp = k; });
  if (settings.mode !== 1) {
    text('FIRST TO', col1, 500, 12, '#a8a0d0');
    [3, 5, 10, 15, 20].forEach((n, k) => { if (button('tg' + n, col1 + k * 96, 520, 88, 44, String(n), { color: (settings.target || MODES[settings.mode].target) === n ? '#6a3aa0' : '#2a2440', sfx: 'tab' })) settings.target = n; });
  }
  // players
  [0, 1].forEach(i => {
    const x = col2, y = 132 + i * 200, sk = settings.skins[i];
    box(x, y, w, 180, '#120e26', COLORS[sk.color]);
    const fake = { i, color: COLORS[sk.color], face: FACES[sk.face], look: { x: Math.sin(t + i), y: 0 }, vx: 0, vy: 0, squash: 0, trail: [] };
    ctx.save(); drawPlayer(fake, x + 70, y + 90, 2.4, true); ctx.restore();
    text(i === 1 && settings.opp > 0 ? 'CPU' : 'PLAYER ' + (i + 1), x + 150, y + 22, 16, COLORS[sk.color]);
    text(i === 0 ? 'WASD + SHIFT/SPACE dash' : (settings.opp > 0 ? OPP[settings.opp][1] : 'ARROWS + R-SHIFT/ENTER dash'), x + 150, y + 50, 8, '#c8c0e8');
    COLORS.forEach((c, k) => {
      const bx = x + 150 + k * 38, by = y + 76;
      ctx.fillStyle = sk.color === k ? '#ffffff' : '#05040e'; ctx.fillRect(bx - 3, by - 3, 34, 34);
      ctx.fillStyle = c; ctx.fillRect(bx, by, 28, 28);
      if (UI.click && UI.click.x >= bx && UI.click.x < bx + 28 && UI.click.y >= by && UI.click.y < by + 28) { UI.click = null; sk.color = k; Sound.play('tab'); }
    });
    if (button('face' + i, x + 150, y + 118, 300, 44, 'FACE: ' + FACES[sk.face].toUpperCase(), { color: '#2a2440', size: 12, sfx: 'tab' })) sk.face = (sk.face + 1) % FACES.length;
    text(`WINS ${wins[i]}`, x + w - 20, y + 22, 8, '#ffe680', 'right');
  });
  if (button('play', col2, 556, w, 76, 'PLAY', { color: '#3a8a3a', size: 24 })) startMatch();
  if (button('fs', col1, 590, 230, 44, 'FULLSCREEN', { color: '#2a2440', size: 12 })) toggleFullscreen();
  if (button('snd', col1 + 250, 590, 230, 44, Sound.musicOn ? 'MUSIC: ON' : 'MUSIC: OFF', { color: '#2a2440', size: 12 })) Sound.setMusic(!Sound.musicOn);
  text('ENTER = play   ESC = pause   F = fullscreen   M = music', W / 2, 676, 8, '#8a84b0', 'center');
}
function drawPause() {
  ctx.fillStyle = 'rgba(4,2,12,0.7)'; ctx.fillRect(0, 0, W, H);
  box(W / 2 - 260, 190, 520, 340, '#120e26', '#ffd400');
  text('PAUSED', W / 2, 230, 32, '#ffd400', 'center');
  if (button('res', W / 2 - 200, 300, 400, 64, 'RESUME', { color: '#3a8a3a' })) resume();
  if (button('rst', W / 2 - 200, 376, 400, 56, 'RESTART', { color: '#3a2f8a' })) startMatch();
  if (button('men', W / 2 - 200, 444, 400, 56, 'MENU', { color: '#8a2a3a', sfx: 'back' })) toMenu();
}
function drawOver() {
  matchT += 1 / 60;
  ctx.fillStyle = 'rgba(4,2,12,0.6)'; ctx.fillRect(0, 0, W, H);
  confetti.forEach(c => { c.x += c.vx / 60; c.y += c.vy / 60; c.r += c.vr / 60; if (c.y > H + 20) { c.y = -20; c.x = rand(0, W); }
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.col; ctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); ctx.restore(); });
  const pop = Math.min(1, matchT * 3);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop); ctx.translate(-W / 2, -H / 2);
  const wc = winner >= 0 ? players[winner].color : '#ffffff';
  box(W / 2 - 340, 110, 680, 480, '#120e26', wc);
  text(winner >= 0 ? `${players[winner].name} WINS!` : 'DRAW!', W / 2, 150, 40, wc, 'center');
  if (winner >= 0) { const w2 = Object.assign({}, players[winner], { look: { x: Math.sin(t * 2), y: 0 } }); drawPlayer(w2, W / 2, 270 + Math.abs(Math.sin(t * 5)) * -12, 3, true); }
  // stats
  const m = mode().id;
  players.forEach((p, i) => {
    const x = W / 2 - 280 + i * 300;
    text(p.name, x + 130, 340, 16, p.color, 'center');
    const line = m === 'longest' ? `TIME ${longestTimes[i].toFixed(1)}s` : `SCORE ${score[i]}`;
    text(line, x + 130, 372, 12, '#ffffff', 'center');
    text(`TAGS ${p.stats.tags}  DASHES ${p.stats.dashes}`, x + 130, 398, 8, '#c8c0e8', 'center');
    text(`POWER-UPS ${p.stats.powers}`, x + 130, 416, 8, '#c8c0e8', 'center');
  });
  ctx.restore();
  if (button('again', W / 2 - 300, 470, 290, 72, 'REMATCH', { color: '#3a8a3a', size: 16 })) startMatch();
  if (button('menu', W / 2 + 10, 470, 290, 72, 'MENU', { color: '#3a2f8a', size: 16, sfx: 'back' })) toMenu();
}

// ------------------------------------------------------------ main loop
let last = 0;
function frame(now) {
  let dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
  UI.hover = null;
  if (screen === 'menu') drawMenu();
  else {
    if (screen === 'play') {
      if (hitstop > 0) { hitstop -= dt; dt = 0; }
      phaseT += dt;
      if (phase === 'countdown') {
        const before = Math.ceil(3 - (phaseT - dt)), after = Math.ceil(3 - phaseT);
        if (after !== before && after > 0) sfx.tick();
        if (phaseT >= 3) { phase = 'live'; sfx.go(); }
      }
      if (phase === 'live') {
        players.forEach(p => updatePlayer(p, dt));
        updateRules(dt);
      } else if (phase === 'freeze') players.forEach(p => { p.vx *= 0.9; p.vy *= 0.9; });
    }
    if (screen !== 'pause') {
      particles.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.vy += (p.g || 0) * dt; });
      particles = particles.filter(p => p.t < p.life);
      rings.forEach(r => { r.t += dt; r.r += 380 * dt; }); rings = rings.filter(r => r.t < 0.45);
      floaters.forEach(f => { f.t += dt; f.y -= 40 * dt; }); floaters = floaters.filter(f => f.t < 1.2);
    }
    shake = Math.max(0, shake - dt);
    // draw arena
    ctx.save();
    if (shake > 0) ctx.translate(rand(-1, 1) * shake * 16, rand(-1, 1) * shake * 16);
    ctx.drawImage(bakeCv, 0, TOP);
    drawTiles(); drawPickups();
    players.forEach(p => drawPlayer(p));
    drawBushes();
    particles.forEach(p => { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); });
    ctx.globalAlpha = 1;
    rings.forEach(r => { ctx.strokeStyle = rgba(r.col.length === 7 ? r.col : '#ffffff', 1 - r.t / 0.45); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.3); ctx.stroke(); });
    floaters.forEach(f => { ctx.globalAlpha = 1 - f.t / 1.2; text(f.text, f.x, f.y, 12, f.col, 'center'); ctx.globalAlpha = 1; });
    ctx.restore();
    drawHUD();
    drawTouch();
    if (phase === 'countdown' && screen === 'play') {
      const n = Math.ceil(3 - phaseT), k = 1 - ((3 - phaseT) % 1);
      ctx.fillStyle = 'rgba(4,2,12,0.35)'; ctx.fillRect(0, TOP, W, H - TOP);
      text(String(n), W / 2, H / 2 - 50 - k * 10, 80 + k * 20, '#ffffff', 'center');
    }
    if (phase === 'live' && phaseT < 0.6) text('GO!', W / 2, H / 2 - 50, 80, '#6ae06a', 'center');
    if (announce) {
      announce.t += dt;
      const a = announce.t < 0.2 ? announce.t / 0.2 : Math.max(0, 1 - (announce.t - 1.4) / 0.4);
      if (a <= 0) announce = null;
      else { ctx.globalAlpha = a; text(announce.text, W / 2, announce.small ? TOP + 30 : H / 2 + 60, announce.small ? 16 : 24, announce.col, 'center'); ctx.globalAlpha = 1; }
    }
    if (screen === 'pause') drawPause();
    if (screen === 'over') drawOver();
    if (screen === 'play' && !touchMode) {
      if (button('pz', W / 2 - 50, H - 34, 100, 30, 'PAUSE', { color: '#2a2440', size: 8, sfx: 'back' })) pauseGame();
    } else if (screen === 'play' && touchMode) {
      if (button('pz', W / 2 - 60, H - 52, 120, 44, 'PAUSE', { color: '#2a2440', size: 12, sfx: 'back' })) pauseGame();
    }
  }
  if (UI.hover && UI.hover !== UI.lastHover) Sound.play('hover');
  UI.lastHover = UI.hover;
  UI.click = null;
  requestAnimationFrame(frame);
}

// boot
loadArena(ARENAS[settings.arena]);
players = [makePlayer(0), makePlayer(1)];
Sound.playSong(SONGS.tag_menu);
const fontReady = document.fonts ? Promise.race([document.fonts.load(`16px ${FONT}`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontReady.then(() => requestAnimationFrame(n => { last = n; frame(n); }));

window.__tag = { get screen() { return screen; }, get phase() { return phase; }, get score() { return score; }, get players() { return players; }, get it() { return itIdx; },
  settings, startMatch, cpuInput, tileOf, setArena(i) { settings.arena = i; loadArena(ARENAS[i]); } };
})();
