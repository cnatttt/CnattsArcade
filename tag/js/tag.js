// =====================================================================
//  2 PLAYER TAG
//  P1: WASD + Left Shift / Space to dash
//  P2: Arrow keys + Right Shift / Enter to dash  (or play vs the CPU)
// =====================================================================
(() => {
'use strict';
const W = 1280, H = 720, T = 40, COLS = 32, ROWS = 16, TOP = 80;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const FONT = 'Inter, system-ui, sans-serif', HEAD = '"Plus Jakarta Sans", Inter, sans-serif';

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
const oppLvl = () => NET.cpuRanked ? 4 : settings.opp;
const OPP = [['human', '2 PLAYERS'], ['easy', 'CPU EASY'], ['normal', 'CPU NORMAL'], ['hard', 'CPU HARD']];
let settings = { mode: 0, arena: 0, opp: 0, target: 10, skins: [{ color: 0, face: 0 }, { color: 1, face: 2 }] };
try { const s = JSON.parse(localStorage.getItem('cnatt_tag_settings')); if (s) settings = Object.assign(settings, s); } catch (e) {}
let wins = [0, 0];
try { wins = JSON.parse(localStorage.getItem('cnatt_tag_wins')) || [0, 0]; } catch (e) {}
const NET = { role: null, me: 0, names: ['P1', 'P2'], own: [false, false], remote: { x: 0, y: 0, dashN: 0 }, lastDashN: 0, fx: [], input: '', typing: false, screen: 'menu', error: '', ranked: false };
const saveSettings = () => { try { localStorage.setItem('cnatt_tag_settings', JSON.stringify(settings)); localStorage.setItem('cnatt_tag_wins', JSON.stringify(wins)); } catch (e) {} };

// ------------------------------------------------------------ input
const keys = {};
let touchMode = false;
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (e.code === 'Escape' && (screen === 'online' || screen === 'ranked')) { netLeave(); screen = 'menu'; return; }
  if (e.code === 'Enter' && (screen === 'online' || screen === 'ranked')) return;
  if (e.code === 'Escape') { if (screen === 'play') pauseGame(); else if (screen === 'pause') resume(); else if (screen === 'over') toMenu(); }
  if (e.code === 'KeyF' && !NET.typing) toggleFullscreen();
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
  if (NET.role === 'host' && i === 1) { const r = NET.remote; const d = r.dashN !== NET.lastDashN; NET.lastDashN = r.dashN; return { x: r.x || 0, y: r.y || 0, dash: d || !!r.dash }; }
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
function mix(a, b, k) { const A = [0, 2, 4].map(i => parseInt(a.slice(1 + i, 3 + i), 16)), B = [0, 2, 4].map(i => parseInt(b.slice(1 + i, 3 + i), 16)); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
function bake() {
  const b = bakeCv.getContext('2d'), col = arena.color, fl = arena.floor;
  b.clearRect(0, 0, W, H - TOP);
  const g = b.createLinearGradient(0, 0, 0, H - TOP); g.addColorStop(0, mix(fl, '#ffffff', 0.04)); g.addColorStop(1, mix(fl, '#000000', 0.25));
  b.fillStyle = g; b.fillRect(0, 0, W, H - TOP);
  // soft checker floor
  b.fillStyle = 'rgba(255,255,255,0.022)';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if ((r + c) % 2) b.fillRect(c * T, r * T, T, T);
  // special floor tiles
  grid.forEach((row, r) => row.forEach((ch, c) => {
    const x = c * T, y = r * T;
    if (ch === '~') {
      b.fillStyle = (r + c) % 2 ? '#2b6a92' : '#2f7099'; b.fillRect(x, y, T, T);
      b.fillStyle = 'rgba(255,255,255,0.13)'; b.save(); b.translate(x + ((c * 7 + r * 3) % 18) + 6, y + 8 + ((c + r) % 3) * 9); b.rotate(-0.5); b.fillRect(0, 0, 16, 2); b.restore();
    } else if (ch === ',') {
      b.fillStyle = (r + c) % 2 ? '#4a2c22' : '#4f2f24'; b.fillRect(x, y, T, T);
      b.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 3; k++) { b.beginPath(); b.arc(x + 6 + ((c * 13 + k * 11) % 28), y + 6 + ((r * 7 + k * 13) % 28), 3 + k, 0, 6.3); b.fill(); }
    } else if (ch === '>') {
      rr(x + 3, y + 3, T - 6, T - 6, 8, b); b.fillStyle = 'rgba(255,138,58,0.16)'; b.fill(); b.strokeStyle = 'rgba(255,138,58,0.5)'; b.lineWidth = 1.5; b.stroke();
    } else if ('AaCc'.includes(ch)) {
      const pc = ch.toUpperCase() === 'A' ? '#c46cff' : '#6ad0ff';
      const rg = b.createRadialGradient(x + T / 2, y + T / 2, 2, x + T / 2, y + T / 2, T * 0.6); rg.addColorStop(0, rgba(pc, 0.45)); rg.addColorStop(1, rgba(pc, 0));
      b.fillStyle = rg; b.fillRect(x - 6, y - 6, T + 12, T + 12);
    }
  }));
  // walls: soft drop shadow, a front face and a raised top
  const walls = []; grid.forEach((row, r) => row.forEach((ch, c) => { if (ch === '#') walls.push([c, r]); }));
  b.save(); b.filter = 'blur(7px)'; b.fillStyle = 'rgba(0,0,0,0.55)'; walls.forEach(([c, r]) => b.fillRect(c * T + 3, r * T + 9, T, T)); b.restore();
  const top = mix(fl, col, 0.42), side = mix(fl, col, 0.2);
  walls.forEach(([c, r]) => { if (!solid(c, r + 1)) { b.fillStyle = side; b.fillRect(c * T, r * T + T - 7, T, 7); } });
  walls.forEach(([c, r]) => {
    const x = c * T, y = r * T - 7;
    const tg = b.createLinearGradient(0, y, 0, y + T); tg.addColorStop(0, mix(top, '#ffffff', 0.08)); tg.addColorStop(1, top);
    b.fillStyle = tg; b.fillRect(x, y, T, T);
    b.fillStyle = rgba(col, 0.75);
    if (!solid(c, r - 1)) b.fillRect(x, y, T, 2);
    b.fillStyle = 'rgba(0,0,0,0.12)';
    if (!solid(c - 1, r)) b.fillRect(x, y, 1, T);
    if (!solid(c + 1, r)) b.fillRect(x + T - 1, y, 1, T);
  });
  // vignette
  const vg = b.createRadialGradient(W / 2, (H - TOP) / 2, 200, W / 2, (H - TOP) / 2, 760); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  b.fillStyle = vg; b.fillRect(0, 0, W, H - TOP);
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
    name: NET.role ? NET.names[i] : i === 1 && oppLvl() > 0 ? (NET.cpuRanked ? 'PRO CPU' : 'CPU') : 'P' + (i + 1), cpu: !NET.role && i === 1 && oppLvl() > 0, own: NET.role ? NET.own[i] : i === 0 && !!(window.Account && Account.isOwnerMe && Account.isOwnerMe()),
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
function pauseGame() { if (NET.role) { NET.menu = !NET.menu; Sound.play('back'); return; } screen = 'pause'; Sound.play('back'); }
function resume() { screen = 'play'; Sound.play('click'); }
function toMenu() { if (NET.role) netLeave(); endCpuRanked(screen === 'play' || screen === 'pause'); screen = 'menu'; matchId++; Sound.playSong(SONGS.tag_menu); }
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
  if (p.cpu) max *= [1, 0.82, 0.93, 1.0, 1.0][oppLvl()];
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
  const lvl = oppLvl(), react = [0, 0.38, 0.2, 0.09, 0.035][lvl];
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
      if (lvl >= 2) { const lead = lvl >= 4 ? 0.45 : 0.3, [pc, pr] = tileOf(foe.x + foe.vx * lead, foe.y + foe.vy * lead); if (!solid(pc, pr)) { tc = pc; tr = pr; } }
      if (hidden && p.ai.lastSeen) { tc = p.ai.lastSeen[0]; tr = p.ai.lastSeen[1]; }
      else p.ai.lastSeen = [fc, fr];
      p.ai.dist = bfs(tc, tr);
      const dd = Math.hypot(foe.x - me.x, foe.y - me.y);
      if (lvl >= 4) { const sp = Math.hypot(me.vx, me.vy) || 1, aim = ((foe.x - me.x) * me.vx + (foe.y - me.y) * me.vy) / (dd * sp || 1); p.ai.wantDash = dd < 165 && aim > 0.85; }
      else p.ai.wantDash = dd < [0, 70, 120, 150][lvl] && Math.random() < [0, 0.3, 0.6, 0.9][lvl];
    } else {
      // flee: pick a reachable spot far from the tagger
      const dT = bfs(fc, fr), dA = bfs(mc, mr);
      let best = null, bs = -1e9;
      for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
        if (dA[r][c] > (lvl >= 4 ? 12 : 9) || dA[r][c] >= 1e9) continue;
        let s = dT[r][c] * 1.0 - dA[r][c] * 0.35 + Math.random() * [0, 6, 3, 1, 0.2][lvl];
        if (lvl >= 4) {   // pro: never run somewhere the tagger reaches first, and keep escape routes open
          if (dT[r][c] <= dA[r][c] + 1) s -= 25;
          s += [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => !solid(c + a, r + b)).length * 1.6;
        }
        if (tileAt(c, r) === 'B') s += 3;
        if (mode().id === 'coins') coins.forEach(cn => { const [cc, cr] = tileOf(cn.x, cn.y); if (cc === c && cr === r) s += 6; });
        powerups.forEach(u => { const [uc, ur] = tileOf(u.x, u.y); if (uc === c && ur === r) s += 4; });
        if (s > bs) { bs = s; best = [c, r]; }
      }
      p.ai.dist = best ? bfs(best[0], best[1]) : dT;
      p.ai.wantDash = Math.hypot(foe.x - me.x, foe.y - me.y) < [0, 60, 90, 110, 95][lvl] && Math.random() < [0, 0.3, 0.6, 0.9, 1][lvl];
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
  if (NET.ranked && NET.role === 'host') reportRanked(w === NET.me);
  if (NET.cpuRanked) reportCpuRanked(w === 0);
  if (w >= 0 && !NET.role) wins[w]++; saveSettings();
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
function burst(x, y, n, col, sp) { if (NET.role === 'host') NET.fx.push(['b', x, y, n, col, sp]); for (let i = 0; i < n; i++) { const a = rand(0, 6.283), v = rand(0.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.7), t: 0, col, s: rand(3, 7), g: 0 }); } }
function ring(x, y, col) { if (NET.role === 'host') NET.fx.push(['r', x, y, col]); rings.push({ x, y, r: 6, t: 0, col }); }

// ------------------------------------------------------------ drawing helpers
const fontOf = size => size >= 24 ? `800 ${Math.round(size * 1.25)}px ${HEAD}` : `${size <= 8 ? 600 : 700} ${Math.round(size * (size <= 8 ? 1.5 : 1.3))}px ${FONT}`;
function text(s, x, y, size = 16, col = '#fff', align = 'left', shadow = true) {
  ctx.font = fontOf(size); ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = Math.max(4, size / 3); ctx.shadowOffsetY = Math.max(1, size / 12); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore(); }
  else { ctx.fillStyle = col; ctx.fillText(s, x, y); }
}
function rr(x, y, w, h, r, c = ctx) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function box(x, y, w, h, fill, border) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  rr(x, y, w, h, 18); ctx.fillStyle = 'rgba(17,19,30,0.92)'; ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba(border, 0.16)); g.addColorStop(1, 'rgba(255,255,255,0.02)');
  rr(x, y, w, h, 18); ctx.fillStyle = g; ctx.fill();
  rr(x + 0.5, y + 0.5, w - 1, h - 1, 18); ctx.strokeStyle = rgba(border, 0.55); ctx.lineWidth = 1.5; ctx.stroke();
}
function button(id, x, y, w, h, label, o = {}) {
  const over = UI.mx >= x && UI.mx < x + w && UI.my >= y && UI.my < y + h;
  const pressed = over && UI.down;
  if (over) UI.hover = id;
  const base = o.color || '#2a2d3e';
  const dy = pressed ? 1 : over ? -1 : 0, r = Math.min(12, h / 2);
  ctx.save(); ctx.shadowColor = rgba(base.length === 7 ? base : '#000000', over ? 0.45 : 0.25); ctx.shadowBlur = over ? 18 : 10; ctx.shadowOffsetY = 4;
  rr(x, y + dy, w, h, r); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(base, over ? 0.16 : 0.08)); g.addColorStop(1, shade(base, over ? -0.04 : -0.14));
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  rr(x + 0.5, y + dy + 0.5, w - 1, h - 1, r); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = fontOf(o.size || 16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = o.textCol || '#fff'; ctx.fillText(label, x + w / 2, y + dy + h / 2 + 1);
  const c = UI.click;
  if (c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { UI.click = null; Sound.play(o.sfx || 'click'); return true; }
  return false;
}
function arrows(id, x, y, w, label, onPrev, onNext, col = '#6ad0ff') {
  if (button(id + 'l', x, y, 52, 52, '<', { color: '#262a3b', sfx: 'tab' })) onPrev();
  if (button(id + 'r', x + w - 52, y, 52, 52, '>', { color: '#262a3b', sfx: 'tab' })) onNext();
  rr(x + 60, y, w - 120, 52, 12); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
  text(label, x + w / 2, y + 15, 16, col, 'center', false);
}

function drawPlayer(p, x = p.x, y = p.y, scale = 1, forMenu = false) {
  const s = (forMenu ? 26 : sizeOf(p)) * scale;
  const isIt = !forMenu && p.i === itIdx;
  let alpha = 1;
  if (!forMenu && p.inBush) alpha = 0.18;
  if (!forMenu && p.ghost > 0) alpha *= 0.5;
  ctx.save(); ctx.globalAlpha = alpha;
  // trail
  if (!forMenu) p.trail.forEach((q, k) => { ctx.globalAlpha = alpha * (k / p.trail.length) * 0.3; ctx.fillStyle = p.color; rr(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s, q.s * 0.3); ctx.fill(); });
  ctx.globalAlpha = alpha;
  // IT aura
  if (isIt) {
    const pul = 0.5 + 0.5 * Math.sin(t * 8), ag = ctx.createRadialGradient(x, y, s * 0.3, x, y, s * 1.25);
    ag.addColorStop(0, `rgba(255,70,70,${0.35 + 0.15 * pul})`); ag.addColorStop(1, 'rgba(255,70,70,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x, y, s * 1.25, 0, 6.3); ctx.fill();
  }
  // body with squash in movement direction
  const sq = forMenu ? 0 : p.squash * 0.18;
  const bw = s * (1 + (Math.abs(p.vx) > Math.abs(p.vy) ? sq : -sq * 0.6)), bh = s * (1 + (Math.abs(p.vy) >= Math.abs(p.vx) ? sq : -sq * 0.6));
  const R = Math.min(bw, bh) * 0.32;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + bh / 2 + 2, bw * 0.5, bh * 0.14, 0, 0, 6.3); ctx.fill();
  const bg = ctx.createLinearGradient(0, y - bh / 2, 0, y + bh / 2); bg.addColorStop(0, shade(p.color, 0.22)); bg.addColorStop(0.55, p.color); bg.addColorStop(1, shade(p.color, -0.25));
  rr(x - bw / 2, y - bh / 2, bw, bh, R); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = shade(p.color, -0.45); ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; rr(x - bw / 2 + bw * 0.14, y - bh / 2 + bh * 0.08, bw * 0.34, bh * 0.12, bh * 0.06); ctx.fill();
  // face
  const ink = '#141621';
  const lk = forMenu ? { x: 0.6, y: 0.2 } : p.look, ex = clamp(lk.x, -1, 1) * s * 0.08, ey = clamp(lk.y, -1, 1) * s * 0.08;
  const e = s * 0.15, eyY = y - s * 0.06 + ey;
  const blink = (Math.floor(t * 10 + p.i * 7) % 40) === 0;
  const eyeL = x - s * 0.19 + ex, eyeR = x + s * 0.19 + ex;
  if (p.face === 'cool') {
    ctx.fillStyle = ink; rr(eyeL - e * 1.1, eyY - e * 0.7, e * 2.2, e * 1.4, e * 0.5); ctx.fill(); rr(eyeR - e * 1.1, eyY - e * 0.7, e * 2.2, e * 1.4, e * 0.5); ctx.fill(); ctx.fillRect(eyeL, eyY - e * 0.5, eyeR - eyeL, e * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(eyeL - e * 0.6, eyY - e * 0.4, e * 0.5, e * 0.25);
  } else if (p.face === 'robot') {
    ctx.fillStyle = ink; rr(x - s * 0.36 + ex, eyY - e * 0.7, s * 0.72, e * 1.4, e * 0.7); ctx.fill();
    ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(x - s * 0.26 + ex + ((t * 40) % (s * 0.52)), eyY, e * 0.42, 0, 6.3); ctx.fill();
    ctx.strokeStyle = shade(p.color, -0.45); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - bh / 2); ctx.lineTo(x, y - bh / 2 - 8); ctx.stroke();
    ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(x, y - bh / 2 - 9, 3, 0, 6.3); ctx.fill();
  } else {
    [eyeL, eyeR].forEach(ex2 => {
      ctx.fillStyle = '#ffffff';
      if (blink) ctx.fillRect(ex2 - e * 0.7, eyY - 1, e * 1.4, 2);
      else { ctx.beginPath(); ctx.ellipse(ex2, eyY, e * 0.72, e * 0.82, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(ex2 + ex * 0.6, eyY + ey * 0.6, e * 0.38, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex2 + ex * 0.6 + e * 0.14, eyY + ey * 0.6 - e * 0.14, e * 0.12, 0, 6.3); ctx.fill(); }
    });
    if (p.face === 'angry') { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(eyeL - e, eyY - e * 1.3); ctx.lineTo(eyeL + e * 0.6, eyY - e * 0.85); ctx.moveTo(eyeR + e, eyY - e * 1.3); ctx.lineTo(eyeR - e * 0.6, eyY - e * 0.85); ctx.stroke(); }
    if (p.face === 'cat') {
      ctx.fillStyle = p.color; ctx.strokeStyle = shade(p.color, -0.45); ctx.lineWidth = Math.max(1.5, s * 0.06);
      [-1, 1].forEach(sx => { ctx.beginPath(); ctx.moveTo(x + sx * s * 0.44, y - bh / 2 + R * 0.6); ctx.lineTo(x + sx * s * 0.14, y - bh / 2 + 1); ctx.lineTo(x + sx * s * 0.38, y - bh / 2 - s * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    }
  }
  // mouth
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round';
  const my = y + s * 0.2 + ey;
  ctx.beginPath();
  if (p.face === 'happy' || p.face === 'cat') ctx.arc(x + ex, my - s * 0.06, s * 0.13, 0.25, Math.PI - 0.25);
  else if (p.face === 'angry') { ctx.moveTo(x - s * 0.1 + ex, my + 2); ctx.quadraticCurveTo(x + ex, my - 3, x + s * 0.1 + ex, my + 2); }
  else if (p.face === 'cool') { ctx.moveTo(x - s * 0.08 + ex, my); ctx.quadraticCurveTo(x + s * 0.04 + ex, my + 4, x + s * 0.14 + ex, my - 3); }
  ctx.stroke(); ctx.lineCap = 'butt';
  // status overlays
  if (!forMenu) {
    if (p.frozen > 0) { rr(x - s / 2 - 6, y - s / 2 - 6, s + 12, s + 12, s * 0.35); ctx.fillStyle = 'rgba(168,240,255,0.5)'; ctx.fill(); ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (p.shield > 0) { ctx.strokeStyle = rgba('#6affd0', 0.6 + 0.3 * Math.sin(t * 12)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, Math.PI * 2); ctx.stroke(); }
    if (p.stun > 0) for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; text('*', x + Math.cos(a) * 18 - 4, y - s / 2 - 16 + Math.sin(a) * 5, 8, '#ffe650'); }
    if (isIt && mode().id !== 'potato') { rr(x - 15, y - s / 2 - 28, 30, 18, 9); ctx.fillStyle = '#ef4444'; ctx.fill(); text('IT', x, y - s / 2 - 26, 9, '#ffffff', 'center', false); }
    if (isIt && bomb) drawBomb(x + s * 0.45, y - s * 0.6);
    if (p.cpu && !p.inBush) text('CPU', x, y + s / 2 + 8, 7, 'rgba(255,255,255,0.6)', 'center', false);
  }
  ctx.restore();
}
function drawBomb(x, y) {
  const left = bomb.fuse - bomb.t, flash = left < 4 && Math.sin(t * (30 - left * 5)) > 0;
  ctx.fillStyle = '#141621'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ff3a3a' : '#262a3b'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
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
    const B = [[8, 12], [26, 9], [17, 22], [32, 25], [6, 29]];
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + T / 2, y + T - 2, T * 0.6, 7, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1f7a3e'; B.forEach(([bx, by], k) => { ctx.beginPath(); ctx.arc(x + bx + sway * (k % 2 ? 1 : -1), y + by + 2, 11, 0, 6.3); ctx.fill(); });
    ctx.fillStyle = '#2f9e52'; B.forEach(([bx, by], k) => { ctx.beginPath(); ctx.arc(x + bx + sway * (k % 2 ? 1 : -1) - 1, y + by - 1, 9, 0, 6.3); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x + 9 + sway, y + 9, 3.5, 0, 6.3); ctx.arc(x + 25 - sway, y + 6, 3, 0, 6.3); ctx.fill();
  }));
}
function drawPickups() {
  coins.forEach(cn => {
    const w = Math.abs(Math.cos(cn.t * 4)) * 12 + 2, y = cn.y + Math.sin(cn.t * 3) * 3;
    const cg = ctx.createRadialGradient(cn.x, y, 2, cn.x, y, 22); cg.addColorStop(0, 'rgba(255,215,80,0.45)'); cg.addColorStop(1, 'rgba(255,215,80,0)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cn.x, y, 22, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#b7791f'; ctx.beginPath(); ctx.ellipse(cn.x, y, w / 2 + 2, 13, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(cn.x, y, w / 2, 11, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(cn.x - w * 0.15, y - 4, Math.max(1, w * 0.12), 4, 0, 0, 6.3); ctx.fill();
  });
  powerups.forEach(u => {
    const P = POWERS[u.kind], y = u.y + Math.sin(u.t * 4) * 4, blink = u.t > 11 && Math.sin(u.t * 20) > 0;
    if (blink) return;
    const pg = ctx.createRadialGradient(u.x, y, 4, u.x, y, 28); pg.addColorStop(0, rgba(P.col, 0.5 + 0.1 * Math.sin(u.t * 6))); pg.addColorStop(1, rgba(P.col, 0)); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(u.x, y, 28, 0, 6.3); ctx.fill();
    rr(u.x - 15, y - 15, 30, 30, 9); const ig = ctx.createLinearGradient(0, y - 15, 0, y + 15); ig.addColorStop(0, shade(P.col, 0.25)); ig.addColorStop(1, shade(P.col, -0.2)); ctx.fillStyle = ig; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    drawPowerIcon(u.kind, u.x, y);
  });
}

function drawPowerIcon(kind, x, y, k = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.strokeStyle = '#141621'; ctx.fillStyle = '#141621'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  if (kind === 'speed') { ctx.moveTo(-7, -6); ctx.lineTo(-1, 0); ctx.lineTo(-7, 6); ctx.moveTo(1, -6); ctx.lineTo(7, 0); ctx.lineTo(1, 6); ctx.stroke(); }
  else if (kind === 'freeze') { for (let a = 0; a < 3; a++) { const c = Math.cos(a * Math.PI / 3) * 8, s2 = Math.sin(a * Math.PI / 3) * 8; ctx.moveTo(-c, -s2); ctx.lineTo(c, s2); } ctx.stroke(); }
  else if (kind === 'ghost') { ctx.arc(0, -1, 7, Math.PI, 0); ctx.lineTo(7, 7); ctx.lineTo(3.5, 4.5); ctx.lineTo(0, 7); ctx.lineTo(-3.5, 4.5); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); }
  else if (kind === 'shield') { ctx.moveTo(0, -8); ctx.lineTo(7, -5); ctx.quadraticCurveTo(7, 5, 0, 9); ctx.quadraticCurveTo(-7, 5, -7, -5); ctx.closePath(); ctx.stroke(); }
  else if (kind === 'shrink') { ctx.moveTo(-7, -7); ctx.lineTo(-2, -2); ctx.moveTo(7, 7); ctx.lineTo(2, 2); ctx.moveTo(-2, -6); ctx.lineTo(-2, -2); ctx.lineTo(-6, -2); ctx.moveTo(2, 6); ctx.lineTo(2, 2); ctx.lineTo(6, 2); ctx.stroke(); }
  ctx.restore();
}
// ------------------------------------------------------------ HUD
function drawHUD() {
  const hg = ctx.createLinearGradient(0, 0, 0, TOP); hg.addColorStop(0, '#12141d'); hg.addColorStop(1, '#0d0f16'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = rgba(arena.color, 0.5); ctx.fillRect(0, TOP - 1, W, 1);
  const target = settings.target || mode().target;
  players.forEach((p, i) => {
    const x = i === 0 ? 24 : W - 24, al = i === 0 ? 'left' : 'right';
    drawPlayer(p, i === 0 ? x + 18 : x - 18, 40, 1, true);
    const tx = i === 0 ? x + 54 : x - 54;
    text(p.name, tx, 14, 12, p.color, al);
    if (p.own && window.Account && Account.drawOwnerTag && (!NET.role || Account.ownerOK(p.name, p.own))) { ctx.font = fontOf(12); const nw = ctx.measureText(p.name).width; Account.drawOwnerTag(ctx, i === 0 ? tx + nw + 8 : tx - nw - 8, 8, 20, al); }
    if (NET.role && i === NET.me) text('YOU', tx, 62, 8, '#ffe680', al);
    if (mode().id === 'longest') text(round > 1 || i !== 1 - itIdx ? `${longestTimes[i].toFixed(1)}s` : '--', tx, 38, 16, '#fff', al);
    else text(`${score[i]}/${target}`, tx, 38, 16, '#fff', al);
    // role
    const role = mode().id === 'potato' ? (i === itIdx ? 'HAS BOMB' : 'SAFE') : (i === itIdx ? 'TAGGER' : 'RUNNER');
    text(role, i === 0 ? tx + 150 : tx - 150, 16, 8, i === itIdx ? '#ff5a5a' : '#6ae06a', al);
    // dash meter
    const dx = i === 0 ? tx + 150 : tx - 150 - 100;
    rr(dx, 34, 100, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    rr(dx, 34, Math.max(8, 100 * (1 - p.dashCd / 2.2)), 8, 4); ctx.fillStyle = p.dashCd <= 0 ? '#38bdf8' : '#475569'; ctx.fill();
    text('DASH', i === 0 ? dx : dx + 100, 50, 8, p.dashCd <= 0 ? '#6ad0ff' : '#5a6a8a', al);
    // active powers
    let k = 0;
    Object.keys(POWERS).forEach(key => {
      const v = key === 'freeze' ? p.frozen : p[key]; if (v <= 0) return;
      const px = i === 0 ? dx + 112 + k * 26 : dx - 26 - k * 26;
      rr(px, 28, 22, 22, 6); ctx.fillStyle = rgba(POWERS[key].col, 0.3); ctx.fill(); ctx.save(); rr(px, 28, 22, 22, 6); ctx.clip(); ctx.fillStyle = POWERS[key].col; ctx.fillRect(px, 50 - 22 * Math.min(1, v / POWERS[key].dur), 22, 22); ctx.restore(); drawPowerIcon(key, px + 11, 39, 0.7); k++;
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
  if (m === 'classic') { rr(W / 2 - 120, 66, 240, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); rr(W / 2 - 120, 66, Math.max(6, 240 * clamp(roundT / 20, 0, 1)), 6, 3); ctx.fillStyle = players[1 - itIdx].color; ctx.fill(); }
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
  ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.3; ctx.drawImage(bakeCv, 0, TOP); ctx.globalAlpha = 1;
  const mg = ctx.createLinearGradient(0, 0, 0, H); mg.addColorStop(0, 'rgba(11,13,20,0.9)'); mg.addColorStop(0.5, 'rgba(11,13,20,0.6)'); mg.addColorStop(1, 'rgba(11,13,20,0.85)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
  // title
  ctx.font = `800 52px ${HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const tw = ctx.measureText('2 Player Tag').width, tg2 = ctx.createLinearGradient(W / 2 - tw / 2, 0, W / 2 + tw / 2, 0); tg2.addColorStop(0, '#fde047'); tg2.addColorStop(1, '#fb7185');
  ctx.save(); ctx.shadowColor = 'rgba(251,113,133,0.35)'; ctx.shadowBlur = 30; ctx.fillStyle = tg2; ctx.fillText('2 Player Tag', W / 2, 26); ctx.restore();
  text('by Mcant', W / 2, 92, 8, 'rgba(255,255,255,0.45)', 'center', false);
  const col1 = 120, col2 = 680, w = 480;
  // mode
  text('MODE', col1, 132, 12, '#8b91a7');
  arrows('mode', col1, 152, w, MODES[settings.mode].name, () => { settings.mode = (settings.mode + 3) % 4; settings.target = MODES[settings.mode].target; }, () => { settings.mode = (settings.mode + 1) % 4; settings.target = MODES[settings.mode].target; }, '#ffd400');
  text(MODES[settings.mode].desc, col1, 214, 8, '#a1a7bb');
  // arena
  text('ARENA', col1, 248, 12, '#8b91a7');
  arrows('arena', col1, 268, w, ARENAS[settings.arena].name, () => { settings.arena = (settings.arena + ARENAS.length - 1) % ARENAS.length; loadArena(ARENAS[settings.arena]); }, () => { settings.arena = (settings.arena + 1) % ARENAS.length; loadArena(ARENAS[settings.arena]); }, ARENAS[settings.arena].color);
  text(ARENAS[settings.arena].desc, col1, 330, 8, '#a1a7bb');
  // mini map
  ctx.save(); rr(col1, 356, 32 * 8, 16 * 8, 10); ctx.clip(); ctx.drawImage(bakeCv, col1, 356, 32 * 8, 16 * 8); ctx.restore(); rr(col1, 356, 32 * 8, 16 * 8, 10); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  // opponent + target
  text('OPPONENT', col1 + 290, 352, 12, '#8b91a7');
  OPP.forEach(([id, label], k) => { if (button('opp' + k, col1 + 290, 372 + k * 30, 190, 26, label, { color: settings.opp === k ? '#6366f1' : '#262a3b', size: 8, sfx: 'tab' })) settings.opp = k; });
  if (settings.mode !== 1) {
    text('FIRST TO', col1, 500, 12, '#8b91a7');
    [3, 5, 10, 15, 20].forEach((n, k) => { if (button('tg' + n, col1 + k * 96, 520, 88, 44, String(n), { color: (settings.target || MODES[settings.mode].target) === n ? '#6366f1' : '#262a3b', sfx: 'tab' })) settings.target = n; });
  }
  // players
  [0, 1].forEach(i => {
    const x = col2, y = 132 + i * 200, sk = settings.skins[i];
    box(x, y, w, 180, '#11131e', COLORS[sk.color]);
    const fake = { i, color: COLORS[sk.color], face: FACES[sk.face], look: { x: Math.sin(t + i), y: 0 }, vx: 0, vy: 0, squash: 0, trail: [] };
    ctx.save(); drawPlayer(fake, x + 70, y + 90, 2.4, true); ctx.restore();
    text(i === 1 && settings.opp > 0 ? 'CPU' : 'PLAYER ' + (i + 1), x + 150, y + 22, 16, COLORS[sk.color]);
    text(i === 0 ? 'WASD + SHIFT/SPACE dash' : (settings.opp > 0 ? OPP[settings.opp][1] : 'ARROWS + R-SHIFT/ENTER dash'), x + 150, y + 50, 8, '#a1a7bb');
    COLORS.forEach((c, k) => {
      const bx = x + 150 + k * 38, by = y + 76;
      if (sk.color === k) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx + 14, by + 14, 17, 0, 6.3); ctx.stroke(); }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx + 14, by + 14, 13, 0, 6.3); ctx.fill();
      if (UI.click && UI.click.x >= bx && UI.click.x < bx + 28 && UI.click.y >= by && UI.click.y < by + 28) { UI.click = null; sk.color = k; Sound.play('tab'); }
    });
    if (button('face' + i, x + 150, y + 118, 300, 44, 'FACE: ' + FACES[sk.face].toUpperCase(), { color: '#262a3b', size: 12, sfx: 'tab' })) sk.face = (sk.face + 1) % FACES.length;
    text(`WINS ${wins[i]}`, x + w - 20, y + 22, 8, '#ffe680', 'right');
  });
  if (button('play', col2, 556, w, 76, 'PLAY', { color: '#16a34a', size: 24 })) startMatch();
  if (button('online', col1, 590, 150, 44, 'ONLINE', { color: '#2563eb', size: 12 })) { NET.error = ''; screen = 'online'; NET.screen = 'menu'; }
  if (button('ranked', col1 + 165, 590, 150, 44, 'RANKED', { color: '#d97706', size: 12 })) openRanked();
  if (button('snd', col1 + 330, 590, 150, 44, Sound.musicOn ? 'MUSIC ON' : 'MUSIC OFF', { color: '#262a3b', size: 10 })) Sound.setMusic(!Sound.musicOn);
  text('ENTER = play   ESC = pause   F = fullscreen   M = music', W / 2, 676, 8, '#6b7189', 'center');
}
function drawPause() {
  ctx.fillStyle = 'rgba(8,10,16,0.7)'; ctx.fillRect(0, 0, W, H);
  box(W / 2 - 260, 190, 520, 340, '#11131e', '#ffd400');
  text('PAUSED', W / 2, 230, 32, '#ffd400', 'center');
  if (button('res', W / 2 - 200, 300, 400, 64, 'RESUME', { color: '#16a34a' })) resume();
  if (!NET.cpuRanked && button('rst', W / 2 - 200, 376, 400, 56, 'RESTART', { color: '#334155' })) startMatch();
  if (button('men', W / 2 - 200, 444, 400, 56, 'MENU', { color: '#dc2626', sfx: 'back' })) toMenu();
}
function drawOver() {
  matchT += 1 / 60;
  ctx.fillStyle = 'rgba(8,10,16,0.6)'; ctx.fillRect(0, 0, W, H);
  confetti.forEach(c => { c.x += c.vx / 60; c.y += c.vy / 60; c.r += c.vr / 60; if (c.y > H + 20) { c.y = -20; c.x = rand(0, W); }
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.col; ctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); ctx.restore(); });
  const pop = Math.min(1, matchT * 3);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop); ctx.translate(-W / 2, -H / 2);
  const wc = winner >= 0 ? players[winner].color : '#ffffff';
  box(W / 2 - 340, 110, 680, 480, '#11131e', wc);
  text(winner >= 0 ? `${players[winner].name} WINS!` : 'DRAW!', W / 2, 150, 40, wc, 'center');
  if (winner >= 0) { const w2 = Object.assign({}, players[winner], { look: { x: Math.sin(t * 2), y: 0 } }); drawPlayer(w2, W / 2, 270 + Math.abs(Math.sin(t * 5)) * -12, 3, true); }
  // stats
  const m = mode().id;
  players.forEach((p, i) => {
    const x = W / 2 - 280 + i * 300;
    text(p.name, x + 130, 340, 16, p.color, 'center');
    const line = m === 'longest' ? `TIME ${longestTimes[i].toFixed(1)}s` : `SCORE ${score[i]}`;
    text(line, x + 130, 372, 12, '#ffffff', 'center');
    text(`TAGS ${p.stats.tags}  DASHES ${p.stats.dashes}`, x + 130, 398, 8, '#a1a7bb', 'center');
    text(`POWER-UPS ${p.stats.powers}`, x + 130, 416, 8, '#a1a7bb', 'center');
  });
  ctx.restore();
  if (NET.ranked || NET.cpuRanked) drawRankedResult();
  if (NET.cpuRanked) {
    if (button('again', W / 2 - 300, 470, 290, 72, 'NEXT MATCH', { color: '#d97706', size: 16 })) startCpuRanked();
  } else if (NET.ranked) {
    if (button('again', W / 2 - 300, 470, 290, 72, 'FIND MATCH', { color: '#d97706', size: 16 })) { netLeave(); openRanked(true); }
  } else if (NET.role === 'client') { text('WAITING FOR HOST...', W / 2 - 155, 500, 10, '#a1a7bb', 'center'); }
  else if (button('again', W / 2 - 300, 470, 290, 72, 'REMATCH', { color: '#16a34a', size: 16 })) startMatch();
  if (button('menu', W / 2 + 10, 470, 290, 72, 'MENU', { color: '#334155', size: 16, sfx: 'back' })) toMenu();
}

// ------------------------------------------------------------ main loop
let last = 0;
function frame(now) {
  let dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
  UI.hover = null;
  NetTransport.frame();
  if (screen === 'menu') drawMenu();
  else if (screen === 'online') drawOnline();
  else if (screen === 'ranked') drawRanked();
  else {
    if (NET.role === 'client') netClientFrame(dt);
    if (screen === 'play' && NET.role !== 'client') {
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
    particles.forEach(p => { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.55 * (1 - 0.5 * p.t / p.life), 0, 6.3); ctx.fill(); });
    ctx.globalAlpha = 1;
    rings.forEach(r => { ctx.strokeStyle = rgba(r.col.length === 7 ? r.col : '#ffffff', 1 - r.t / 0.45); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.3); ctx.stroke(); });
    floaters.forEach(f => { ctx.globalAlpha = 1 - f.t / 1.2; text(f.text, f.x, f.y, 12, f.col, 'center'); ctx.globalAlpha = 1; });
    ctx.restore();
    drawHUD();
    drawTouch();
    if (phase === 'countdown' && screen === 'play') {
      const n = Math.ceil(3 - phaseT), k = 1 - ((3 - phaseT) % 1);
      ctx.fillStyle = 'rgba(8,10,16,0.35)'; ctx.fillRect(0, TOP, W, H - TOP);
      text(String(n), W / 2, H / 2 - 50 - k * 10, 80 + k * 20, '#ffffff', 'center');
    }
    if (phase === 'live' && phaseT < 0.6) text('GO!', W / 2, H / 2 - 50, 80, '#6ae06a', 'center');
    if (announce) {
      announce.t += dt;
      const a = announce.t < 0.2 ? announce.t / 0.2 : Math.max(0, 1 - (announce.t - 1.4) / 0.4);
      if (a <= 0) announce = null;
      else { ctx.globalAlpha = a; text(announce.text, W / 2, announce.small ? TOP + 30 : H / 2 + 60, announce.small ? 16 : 24, announce.col, 'center'); ctx.globalAlpha = 1; }
    }
    if (NET.role === 'host') netHostFrame(dt);
    if (screen === 'pause') drawPause();
    if (screen === 'over') drawOver();
    if (NET.role && screen === 'play') drawNetOverlay();
    if (screen === 'play' && !touchMode) {
      if (button('pz', W / 2 - 50, H - 34, 100, 30, 'PAUSE', { color: '#262a3b', size: 8, sfx: 'back' })) pauseGame();
    } else if (screen === 'play' && touchMode) {
      if (button('pz', W / 2 - 60, H - 52, 120, 44, 'PAUSE', { color: '#262a3b', size: 12, sfx: 'back' })) pauseGame();
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
const fontReady = document.fonts ? Promise.race([Promise.all([document.fonts.load(`700 16px Inter`), document.fonts.load(`800 40px "Plus Jakarta Sans"`)]), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontReady.then(() => requestAnimationFrame(n => { last = n; frame(n); }));


// ============================================================ ONLINE + RANKED
// Host runs the game; the guest sends their controls and draws what the host sends.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RANKS = [[0, 'BRONZE', '#c8844a'], [900, 'SILVER', '#c8d0e0'], [1100, 'GOLD', '#ffd400'], [1300, 'PLATINUM', '#5ae0d0'], [1500, 'DIAMOND', '#6ab8ff'], [1700, 'MASTER', '#c46cff'], [1900, 'CHAMPION', '#ff5a5a']];
function rankOf(elo) {
  let k = 0; for (let i = 0; i < RANKS.length; i++) if (elo >= RANKS[i][0]) k = i;
  const [lo, name, col] = RANKS[k], hi = RANKS[k + 1] ? RANKS[k + 1][0] : lo + 300;
  const div = k === RANKS.length - 1 ? '' : [' III', ' II', ' I'][Math.min(2, Math.floor((elo - lo) / ((hi - lo) / 3)))];
  return { name: name + div, col, tier: k, lo, hi };
}
function drawRankBadge(x, y, s, elo) {
  const r = rankOf(elo);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = shade(r.col, -0.55); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(26, -15); ctx.lineTo(26, 15); ctx.lineTo(0, 32); ctx.lineTo(-26, 15); ctx.lineTo(-26, -15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = r.col; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(20, -12); ctx.lineTo(20, 12); ctx.lineTo(0, 25); ctx.lineTo(-20, 12); ctx.lineTo(-20, -12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(r.col, 0.45); ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(20, -12); ctx.lineTo(0, 0); ctx.lineTo(-20, -12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(r.col, -0.35);
  for (let k = 0; k <= Math.min(r.tier, 6); k++) { const a = -Math.PI / 2 + (k - Math.min(r.tier, 6) / 2) * 0.42; ctx.beginPath(); ctx.arc(Math.cos(a) * 9, 6 + Math.sin(a) * 9 + 6, 2.6, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
const myName = () => (window.Account && Account.user && Account.user.username) || ('P' + (Math.floor(Math.random() * 900) + 100));
const OWN2 = () => !!(window.Account && Account.isOwnerMe && Account.isOwnerMe());

function netSend(m) { if (NET.tr) NET.tr.broadcast(m); }
function netReset() {
  NetTransport.announce('tag', null);
  if (NET.tr) try { NET.tr.close(); } catch (e) {} NET.tr = null;
  NET.role = null; NET.guestId = null; NET.snap = null; NET.menu = false; NET.matchId = null; NET.reported = false;
}
function netLeave() { if (NET.role) netSend({ t: 'bye' }); netReset(); NET.ranked = false; NET.queue && NET.queue.leave(); }
function netLost(why) { const r = NET.ranked; netReset(); NET.ranked = false; NET.error = why; screen = r ? 'ranked' : 'online'; NET.screen = 'menu'; if (r) NET.rscreen = 'home'; Sound.playSong(SONGS.tag_menu); }

function hostRoom(opts = {}) {
  netReset(); NET.error = '';
  screen = 'online'; NET.role = 'host'; NET.me = 0; NET.code = opts.code || Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  NET.screen = 'connecting'; NET.names = [myName(), '...']; NET.own = [OWN2(), false];
  NET.tr = NetTransport.host(NET.code, {
    ready: () => { NET.screen = 'lobby'; NetTransport.announce('tag', NET.code); },
    join: id => { if (NET.guestId && NET.guestId !== id) { NET.tr.send(id, { t: 'full' }); return; } NET.guestId = id; },
    leave: id => { if (id !== NET.guestId) return; NET.guestId = null; NET.names[1] = '...';
      if (screen === 'play' || screen === 'over') { if (NET.ranked && screen === 'play') { winByForfeit(); } else { netLost('The other player left.'); } } },
    msg: (id, d) => {
      if (id !== NET.guestId) return;
      if (d.t === 'hello') { NET.names[1] = String(d.name || 'P2').slice(0, 16); NET.own[1] = !!d.own; NET.oppUser = d.uid || null; NET.oppElo = d.elo || 1000; netLobby(); if (NET.ranked && NET.autoStart) setTimeout(() => { if (NET.role === 'host' && NET.guestId) netStart(); }, 1200); }
      else if (d.t === 'in') NET.remote = d;
      else if (d.t === 'bye') { NET.tr.kick && NET.tr.kick(id); NET.guestId = null; if (NET.ranked && screen === 'play') winByForfeit(); else netLost('The other player left.'); }
    },
    error: e => netLost(e === 'taken' ? 'Room code clash, try again.' : String(e)),
  });
}
function joinRoom(code) {
  netReset(); NET.error = '';
  screen = 'online'; NET.role = 'client'; NET.me = 1; NET.code = code.toUpperCase(); NET.screen = 'connecting';
  NET.tr = NetTransport.join(NET.code, {
    ready: () => {
      NetTransport.announce('tag', NET.code);
      const hello = () => netSend({ t: 'hello', name: myName(), own: OWN2(), uid: window.Account && Account.user ? Account.user.id : null, elo: NET.myElo || 1000 });
      hello(); let n = 0; const tr = NET.tr;
      const iv = setInterval(() => { if (NET.tr !== tr || NET.screen === 'lobby' || screen === 'play' || ++n > 10) { clearInterval(iv); if (NET.tr === tr && NET.screen !== 'lobby' && screen !== 'play') netLost('The room did not answer.'); return; } hello(); }, 1500);
    },
    leave: () => { if (NET.ranked && screen === 'play') { NET.forfeitWin = true; reportRanked(true); screen = 'over'; winner = NET.me; } else netLost('Lost connection to the host.'); },
    msg: (id, d) => {
      if (d.t === 'lobby') { NET.screen = 'lobby'; NET.names = d.names; NET.own = d.own; NET.oppUser = d.uid; NET.oppElo = d.elo || 1000; NET.matchId = d.matchId || NET.matchId; NET.ranked = !!d.ranked || NET.ranked; }
      else if (d.t === 'state') applySnap(d);
      else if (d.t === 'closed' || d.t === 'bye') { if (NET.ranked && screen === 'play') { reportRanked(true); winner = NET.me; screen = 'over'; } else netLost('The host closed the room.'); }
      else if (d.t === 'full') netLost('That room is full.');
    },
    error: e => netLost(String(e)),
  });
}
function netLobby() { if (NET.role === 'host') netSend({ t: 'lobby', names: NET.names, own: NET.own, uid: window.Account && Account.user ? Account.user.id : null, elo: NET.myElo || 1000, ranked: NET.ranked, matchId: NET.matchId }); }
function netStart() {
  if (NET.cpuRanked) endCpuRanked(false);
  if (NET.ranked) { settings.mode = 0; settings.target = 5; settings.arena = Math.floor(Math.random() * ARENAS.length); NET.matchId = NET.code + '-' + Date.now().toString(36); NET.reported = false; netLobby(); }
  settings.opp = 0; startMatch();
}

// host: send the game state ~20 times a second
let sendT = 0;
const PKEYS = ['i', 'x', 'y', 'vx', 'vy', 'color', 'face', 'name', 'own', 'frozen', 'ghost', 'shield', 'speed', 'shrink', 'dashCd', 'dashT', 'stun', 'inBush', 'look', 'squash', 'stats'];
function netHostFrame(dt) {
  sendT += dt;
  if (sendT < 0.05 || !NET.guestId) return; sendT = 0;
  const fx = NET.fx.splice(0);
  netSend({ t: 'state', screen, phase, phaseT, roundT, score, itIdx, round, longestTimes, winner, arena: settings.arena, mode: settings.mode, target: settings.target,
    players: players.map(p => { const o = {}; PKEYS.forEach(k => o[k] = p[k]); o.x = Math.round(p.x * 10) / 10; o.y = Math.round(p.y * 10) / 10; return o; }),
    powerups, coins, bomb, floaters, announce, fx, ranked: NET.ranked, matchId: NET.matchId });
}
NetTransport.backgroundTicker(dt => {  // keep hosting when the tab is hidden
  if (NET.role !== 'host' || screen !== 'play') return;
  phaseT += dt; if (phase === 'countdown' && phaseT >= 3) phase = 'live';
  if (phase === 'live') { players.forEach(p => updatePlayer(p, dt)); updateRules(dt); }
  netHostFrame(dt);
});
// client: apply the host's state, smoothing positions
function applySnap(d) {
  const was = screen;
  if (d.arena !== settings.arena) { settings.arena = d.arena; loadArena(ARENAS[d.arena]); }
  settings.mode = d.mode; settings.target = d.target;
  phase = d.phase; phaseT = d.phaseT; roundT = d.roundT; score = d.score; itIdx = d.itIdx; round = d.round; longestTimes = d.longestTimes; winner = d.winner;
  powerups = d.powerups; coins = d.coins; bomb = d.bomb; floaters = d.floaters || []; if (d.announce && (!announce || announce.text !== d.announce.text)) announce = d.announce;
  NET.matchId = d.matchId || NET.matchId; NET.ranked = !!d.ranked || NET.ranked;
  if (players.length !== 2 || was === 'online' || was === 'ranked' || was === 'menu') players = d.players.map(p => Object.assign({ trail: [], ai: {} }, p));
  d.players.forEach((p, i) => { const q = players[i]; const ox = q.x, oy = q.y; Object.assign(q, p); q.tx = p.x; q.ty = p.y; q.x = ox; q.y = oy; if (Math.hypot(ox - p.x, oy - p.y) > 120 || ox == null) { q.x = p.x; q.y = p.y; } });
  (d.fx || []).forEach(f => { if (f[0] === 'b') burst(f[1], f[2], f[3], f[4], f[5]); else if (f[0] === 'r') ring(f[1], f[2], f[3]); else if (f[0] === 's' && sfx[f[1]]) sfxRaw[f[1]](...(f[2] || [])); });
  if (d.screen === 'play' && was !== 'play') { screen = 'play'; NET.menu = false; Sound.playSong(SONGS.tag_battle); }
  if (d.screen === 'over' && was !== 'over') { endMatchClient(d.winner); }
}
function endMatchClient(w) {
  winner = w; screen = 'over'; matchT = 0; sfxRaw.win(); Sound.playSong(SONGS.tag_win);
  confetti = Array.from({ length: 160 }, () => ({ x: rand(0, W), y: rand(-H, 0), vx: rand(-60, 60), vy: rand(80, 240), r: rand(0, 6), vr: rand(-8, 8), col: pick(COLORS), s: rand(6, 12) }));
  if (NET.ranked) reportRanked(w === NET.me);
}
let inT = 0;
function netClientFrame(dt) {
  players.forEach(p => { if (p.tx != null) { const k = Math.min(1, dt * 14); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; } });
  inT += dt;
  if (inT >= 1 / 30 && screen === 'play') {
    inT = 0;
    const a = readInput(0), b = readInput(1);   // either set of keys works
    const x = Math.max(-1, Math.min(1, a.x + b.x)), y = Math.max(-1, Math.min(1, a.y + b.y));
    if (a.dash || b.dash) NET.dashN = (NET.dashN || 0) + 1;
    netSend({ t: 'in', x, y, dashN: NET.dashN || 0 });
  }
}
// host forwards sounds to the guest
const sfxRaw = Object.assign({}, sfx);
Object.keys(sfx).forEach(k => { sfx[k] = (...a) => { sfxRaw[k](...a); if (NET.role === 'host' && k !== 'tick') NET.fx.push(['s', k, a]); }; });

function drawNetOverlay() {
  const st = NetTransport.status;
  text(NET.role === 'client' && NET.snapAge > 2 ? 'WAITING FOR HOST...' : `ONLINE${st.ping ? ' ' + st.ping + 'MS' : ''}${st.mode === 'relay' ? ' (RELAY)' : ''}`, W / 2 + 300, H - 22, 8, '#6ae06a', 'center');
  if (NET.ranked) text('RANKED', W / 2, 60, 8, '#ffd400', 'center');
  if (!NET.menu) return;
  ctx.fillStyle = 'rgba(8,10,16,0.7)'; ctx.fillRect(0, 0, W, H);
  box(W / 2 - 260, 230, 520, 240, '#11131e', '#ffd400');
  text(NET.ranked ? 'LEAVING COUNTS AS A LOSS' : 'MENU', W / 2, 262, NET.ranked ? 12 : 24, '#ffd400', 'center');
  if (button('nres', W / 2 - 200, 310, 400, 60, 'KEEP PLAYING', { color: '#16a34a' })) NET.menu = false;
  if (button('nlv', W / 2 - 200, 386, 400, 56, 'LEAVE MATCH', { color: '#dc2626', sfx: 'back' })) { if (NET.ranked) reportRanked(false); toMenu(); }
}

// ------------------------------------------------------------ online menu screen
function drawOnline() {
  ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.25; ctx.drawImage(bakeCv, 0, TOP); ctx.globalAlpha = 1;
  text('PLAY ONLINE', W / 2, 60, 32, '#6ad0ff', 'center');
  text('Play a friend on another computer, anywhere.', W / 2, 112, 8, '#a1a7bb', 'center');
  if (NET.screen === 'menu' || !NET.screen) {
    if (button('host', W / 2 - 260, 180, 520, 76, 'CREATE ROOM', { color: '#16a34a', size: 20 })) hostRoom();
    text('OR JOIN WITH A CODE', W / 2, 300, 12, '#8b91a7', 'center');
    box(W / 2 - 260, 330, 360, 70, '#05040e', NET.typing ? '#ffd400' : '#334155');
    text(NET.input + (NET.typing && Math.floor(t * 2) % 2 ? '_' : ''), W / 2 - 80, 354, 24, '#ffffff', 'center');
    if (UI.click && UI.click.x > W / 2 - 260 && UI.click.x < W / 2 + 100 && UI.click.y > 330 && UI.click.y < 400) { NET.typing = true; UI.click = null; }
    if (button('join', W / 2 + 116, 330, 144, 70, 'JOIN', { color: '#2563eb', size: 16 }) && NET.input.length >= 4) joinRoom(NET.input);
    if (NET.error) text(NET.error, W / 2, 430, 10, '#ff8a8a', 'center');
  } else if (NET.screen === 'connecting') {
    text(NET.role === 'host' ? 'CREATING ROOM...' : 'JOINING ' + NET.code + '...', W / 2, 260, 16, '#ffffff', 'center');
    text(NetTransport.status.text || '', W / 2, 300, 8, '#8b91a7', 'center');
  } else if (NET.screen === 'lobby') {
    text('ROOM CODE', W / 2, 160, 12, '#8b91a7', 'center');
    text(NET.code, W / 2, 186, 48, '#ffd400', 'center');
    [0, 1].forEach(i => {
      const x = W / 2 - 300 + i * 340, sk = settings.skins[i];
      box(x, 270, 260, 150, '#11131e', COLORS[sk.color]);
      const fake = { i, color: COLORS[sk.color], face: FACES[sk.face], look: { x: Math.sin(t + i), y: 0 }, vx: 0, vy: 0, squash: 0, trail: [] };
      drawPlayer(fake, x + 130, 330, 2, true);
      text(NET.names[i] || '...', x + 130, 384, 12, '#ffffff', 'center');
      if (i === NET.me) text('YOU', x + 130, 404, 8, '#ffe680', 'center');
    });
    if (NET.role === 'host') {
      text(`${MODES[settings.mode].name}  ·  ${ARENAS[settings.arena].name}  ·  FIRST TO ${settings.target || MODES[settings.mode].target}`, W / 2, 448, 8, '#a1a7bb', 'center');
      text('(change these on the main menu before creating the room)', W / 2, 466, 8, '#6b7189', 'center');
      if (button('nstart', W / 2 - 200, 500, 400, 70, NET.guestId ? 'START MATCH' : 'WAITING FOR PLAYER...', { color: NET.guestId ? '#16a34a' : '#262a3b', size: 16 }) && NET.guestId) netStart();
    } else text('WAITING FOR THE HOST TO START...', W / 2, 520, 12, '#a1a7bb', 'center');
  }
  if (button('nback', 40, H - 80, 200, 50, 'BACK', { color: '#262a3b', size: 12, sfx: 'back' })) { netLeave(); screen = 'menu'; }
}
window.addEventListener('keydown', e => {
  if (screen !== 'online' || !NET.typing) return;
  if (e.key === 'Backspace') NET.input = NET.input.slice(0, -1);
  else if (e.key === 'Enter') { if (NET.input.length >= 4) joinRoom(NET.input); NET.typing = false; }
  else if (/^[a-zA-Z0-9]$/.test(e.key) && NET.input.length < 6) NET.input += e.key.toUpperCase();
});

// ------------------------------------------------------------ ranked
// Signed-in players queue up; two waiting players are matched and one hosts the room.
// Both players report the result; when they agree, Elo changes (Supabase function ranked_report).
function openRanked(search) {
  screen = 'ranked'; NET.rscreen = 'home'; NET.error = ''; NET.ranked = false;
  loadRankedInfo();
  if (search) startQueue();
}
async function loadRankedInfo() {
  const A = window.Account;
  if (!A || !A.configured) return;
  await A.init();
  if (!A.user || !A.sb) return;
  try {
    const me = await A.sb.from('ranked').select('elo,wins,losses,streak,peak').eq('user_id', A.user.id).maybeSingle();
    NET.myRank = me.data || { elo: 1000, wins: 0, losses: 0, streak: 0, peak: 1000 }; NET.myElo = NET.myRank.elo;
    const top = await A.sb.from('ranked').select('elo,wins,losses,user_id,profiles(username,color)').order('elo', { ascending: false }).limit(10);
    NET.top = top.data || [];
  } catch (e) { NET.rankErr = 'Ranked needs the latest database setup.'; }
}
function startQueue() {
  const A = window.Account;
  if (!A || !A.user || !A.sb) { NET.error = 'Sign in on the arcade to play ranked.'; return; }
  NET.rscreen = 'queue'; NET.queueT = 0; NET.error = '';
  const ch = A.sb.channel('tag-ranked-queue', { config: { presence: { key: A.user.id }, broadcast: { self: false } } });
  const me = { id: A.user.id, name: A.user.username, elo: NET.myElo || 1000, at: Date.now() };
  let matched = false;
  const tryPair = () => {
    if (matched) return;
    const st = ch.presenceState(); const list = Object.values(st).map(a => a[0]).filter(Boolean).filter(p => p.id).sort((a, b) => a.at - b.at);
    if (list.length < 2 || list[0].id !== me.id) return;   // the player waiting longest picks an opponent
    const others = list.slice(1); const opp = others.reduce((best, p) => Math.abs(p.elo - me.elo) < Math.abs(best.elo - me.elo) ? p : best, others[0]);
    matched = true;
    const code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    ch.send({ type: 'broadcast', event: 'match', payload: { to: opp.id, code, from: me.id } });
    NET.queue.leave(); NET.ranked = true; NET.autoStart = true; NET.oppUser = opp.id; NET.oppElo = opp.elo;
    screen = 'online'; hostRoom({ code });
  };
  ch.on('presence', { event: 'sync' }, tryPair);
  ch.on('broadcast', { event: 'match' }, ({ payload }) => {
    if (matched || !payload || payload.to !== me.id) return;
    matched = true; NET.queue.leave(); NET.ranked = true; NET.oppUser = payload.from;
    screen = 'online'; setTimeout(() => joinRoom(payload.code), 900);
  });
  ch.subscribe(s => { if (s === 'SUBSCRIBED') ch.track(me); });
  NET.queue = { leave() { try { ch.untrack(); A.sb.removeChannel(ch); } catch (e) {} NET.queue = null; }, ch };
  NET.queueTimer = setInterval(() => { if (!NET.queue) { clearInterval(NET.queueTimer); return; } tryPair(); }, 2000);
}
async function reportRanked(won) {
  if (NET.reported || !NET.matchId || !NET.oppUser) return;
  NET.reported = true;
  const A = window.Account; if (!A || !A.sb || !A.user) return;
  const before = NET.myElo || 1000;
  NET.result = { won, before, after: null };
  try {
    const r = await A.sb.rpc('ranked_report', { p_match: NET.matchId, p_opp: NET.oppUser, p_won: won });
    for (let k = 0; k < 6; k++) {   // wait for the other player's report
      await new Promise(res => setTimeout(res, 1500));
      const me = await A.sb.from('ranked').select('elo').eq('user_id', A.user.id).maybeSingle();
      if (me.data && me.data.elo !== before) { NET.result.after = me.data.elo; NET.myElo = me.data.elo; break; }
    }
  } catch (e) {}
}
// ranked against the PRO CPU: classic, first to 5, random arena. Quitting counts as a loss.
function startCpuRanked() {
  const A = window.Account, online = !!(A && A.configured && A.user && A.sb);
  const before = online ? (NET.myElo || (NET.myRank && NET.myRank.elo) || 1000) : (settings.relo || 1000);
  if (!NET.cpuRanked) NET.cpuPrev = { mode: settings.mode, target: settings.target, arena: settings.arena };
  NET.cpuRanked = { before, cpuElo: Math.max(1250, before + 150), online, done: false };
  NET.result = null; NET.forfeitWin = false; NET.ranked = false;
  settings.mode = 0; settings.target = 5; settings.arena = Math.floor(Math.random() * ARENAS.length); loadArena(ARENAS[settings.arena]);
  startMatch();
}
function reportCpuRanked(won) {
  const R = NET.cpuRanked; if (!R || R.done) return; R.done = true;
  NET.result = { won, before: R.before, after: null };
  const exp = 1 / (1 + Math.pow(10, (R.cpuElo - R.before) / 400)), d = Math.round(32 * ((won ? 1 : 0) - exp));
  if (!R.online) { settings.relo = Math.max(0, R.before + d); NET.result.after = settings.relo; saveSettings(); return; }
  const A = window.Account;
  A.sb.rpc('ranked_cpu', { p_cpu_elo: R.cpuElo, p_won: won }).then(r => {
    const e = r && r.data && r.data.elo; NET.result.after = e != null ? e : R.before;
    if (e != null) { NET.myElo = e; if (NET.myRank) NET.myRank.elo = e; }
  }).catch(() => { NET.result.after = R.before; });
}
function endCpuRanked(quit) {
  if (!NET.cpuRanked) return;
  if (quit && !NET.cpuRanked.done) reportCpuRanked(false);
  const pv = NET.cpuPrev; if (pv) { settings.mode = pv.mode; settings.target = pv.target; settings.arena = pv.arena; loadArena(ARENAS[settings.arena]); saveSettings(); }
  NET.cpuRanked = null; NET.cpuPrev = null;
}
function winByForfeit() { winner = NET.me; screen = 'over'; matchT = 0; sfxRaw.win(); reportRanked(true); NET.forfeitWin = true; }
function drawRankedResult() {
  const r = NET.result; if (!r) return;
  const y = 440;
  if (r.after == null) text('UPDATING RANK...', W / 2 - 155, y, 8, '#a1a7bb', 'center');
  else { const d = r.after - r.before; text(`${d >= 0 ? '+' : ''}${d} ELO  ->  ${r.after}  ${rankOf(r.after).name}`, W / 2, y, 10, d >= 0 ? '#6ae06a' : '#ff8a8a', 'center'); }
  if (NET.forfeitWin) text('OPPONENT LEFT', W / 2, y - 20, 8, '#ffe680', 'center');
}
function drawRanked() {
  ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.2; ctx.drawImage(bakeCv, 0, TOP); ctx.globalAlpha = 1;
  text('RANKED', W / 2, 46, 32, '#ffd400', 'center');
  text('Classic mode, first to 5, random arena. Win to climb.', W / 2, 96, 8, '#a1a7bb', 'center');
  const A = window.Account;
  if (!A || !A.configured || !A.user) {
    const le = settings.relo || 1000, lr = rankOf(le);
    box(80, 140, 520, 340, '#11131e', lr.col);
    drawRankBadge(200, 250, 2.4, le);
    text(lr.name, 330, 200, 16, lr.col); text(`${le} ELO`, 330, 236, 20, '#ffffff');
    text('OFFLINE RANK (THIS COMPUTER)', 330, 276, 8, '#a1a7bb');
    text('Sign in on the arcade to play people', 330, 296, 8, '#8b91a7');
    if (button('rcpu', 140, 380, 400, 64, 'RANKED VS PRO CPU', { color: '#6366f1', size: 16 })) startCpuRanked();
  } else {
    // my card
    const m = NET.myRank || { elo: 1000, wins: 0, losses: 0, streak: 0, peak: 1000 }, rk = rankOf(m.elo);
    box(80, 140, 520, 340, '#11131e', rk.col);
    drawRankBadge(200, 260, 2.6 + Math.sin(t * 2) * 0.05, m.elo);
    text(rk.name, 330, 200, 16, rk.col);
    text(`${m.elo} ELO`, 330, 236, 20, '#ffffff');
    // progress to next rank
    ctx.fillStyle = '#1a1830'; ctx.fillRect(330, 276, 220, 12); ctx.fillStyle = rk.col; ctx.fillRect(330, 276, 220 * clamp((m.elo - rk.lo) / (rk.hi - rk.lo), 0, 1), 12);
    text(`WINS ${m.wins}   LOSSES ${m.losses}`, 330, 306, 8, '#a1a7bb');
    text(`PEAK ${m.peak}   STREAK ${m.streak > 0 ? 'W' + m.streak : m.streak < 0 ? 'L' + -m.streak : '-'}`, 330, 326, 8, '#a1a7bb');
    if (NET.rscreen === 'queue') {
      NET.queueT = (NET.queueT || 0) + 1 / 60;
      const n = NET.queue && NET.queue.ch ? Object.keys(NET.queue.ch.presenceState()).length : 1;
      text('FINDING AN OPPONENT' + '...'.slice(0, 1 + Math.floor(t * 2) % 3), 340, 390, 12, '#ffffff', 'center');
      text(`${Math.floor(NET.queueT)}s  ·  ${n} in queue`, 340, 414, 8, '#8b91a7', 'center');
      if (button('rcancel', 190, 430, 300, 40, 'CANCEL', { color: '#dc2626', size: 10, sfx: 'back' })) { NET.queue && NET.queue.leave(); NET.rscreen = 'home'; }
    } else {
      if (button('rfind', 140, 366, 400, 56, 'FIND MATCH', { color: '#d97706', size: 16 })) startQueue();
      if (button('rcpu', 140, 430, 400, 40, 'RANKED VS PRO CPU', { color: '#6366f1', size: 11 })) startCpuRanked();
    }
  }
  // leaderboard
  box(640, 140, 560, 460, '#11131e', '#334155');
  text('TOP PLAYERS', 920, 160, 12, '#ffd400', 'center');
  (NET.top || []).forEach((r, i) => {
    const y = 196 + i * 38, p = r.profiles || {}, rk = rankOf(r.elo);
    text(`${i + 1}`, 676, y + 6, 10, i < 3 ? ['#ffd400', '#d8dce8', '#e8a060'][i] : '#6b7189');
    drawRankBadge(720, y + 12, 0.55, r.elo);
    text(p.username || '?', 750, y + 2, 10, p.color || '#ffffff');
    text(rk.name, 750, y + 18, 8, rk.col);
    text(`${r.elo}`, 1170, y + 6, 12, '#ffffff', 'right');
  });
  if (!NET.top || !NET.top.length) text(NET.rankErr || 'NO RANKED PLAYERS YET', 920, 300, 8, '#8b91a7', 'center');
  if (NET.error) text(NET.error, W / 2, 520, 10, '#ff8a8a', 'center');
  if (button('rback', 80, H - 100, 240, 54, 'BACK', { color: '#262a3b', size: 12, sfx: 'back' })) { NET.queue && NET.queue.leave(); screen = 'menu'; }
}
// opened from a friend's JOIN button
{ const jc = NetTransport.joinCode(); if (jc) setTimeout(() => { screen = 'online'; joinRoom(jc); }, 300); }

window.__tag = { NET, hostRoom, joinRoom, netStart, rankOf, endMatch, openRanked, get screen() { return screen; }, get phase() { return phase; }, get score() { return score; }, get players() { return players; }, get it() { return itIdx; },
  settings, startMatch, cpuInput, tileOf, startCpuRanked, endMatch, setArena(i) { settings.arena = i; loadArena(ARENAS[i]); } };

// ------------------------------------------------------------ owner cheats (only shown for the site admin, see account/cheats.js)
const inMatch = () => screen === 'play' ? '' : 'Start a match first';
window.__cheats = [
  { name: '+1 point for Player 1', icon: '🏅', need: inMatch, run() { score[0]++; } },
  { name: 'Make Player 2 IT', icon: '👉', need: inMatch, run() { itIdx = 1; } },
  { name: 'Make Player 1 IT', icon: '👈', need: inMatch, run() { itIdx = 0; } },
  { name: 'Freeze Player 2 for 4s', icon: '🧊', need: inMatch, run() { players[1].frozen = 4; } },
  { name: 'Super speed for Player 1', icon: '⚡', need: inMatch, run() { players[0].speed = 8; } },
  { name: 'Shield for Player 1', icon: '🛡', need: inMatch, run() { players[0].shield = 8; } },
];

})();
