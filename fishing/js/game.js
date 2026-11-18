// =====================================================================
//  FISHING SIMULATOR
//  World is drawn on a 320x180 pixel canvas and scaled x4.
//  UI is drawn on top at full 1280x720 with a pixel font.
// =====================================================================
(() => {
'use strict';
const W = 1280, H = 720, LW = 320, LH = 180, S = 4;
const M = LAKE_META._shared;
const HORIZON = M.horizon;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const lo = document.createElement('canvas'); lo.width = LW; lo.height = LH;
const lx = lo.getContext('2d');
const FONT = 'Inter, system-ui, sans-serif';
const HEADF = '"Plus Jakarta Sans", Inter, sans-serif';
const fontOf = size => size >= 24 ? `800 ${Math.round(size * 1.25)}px ${HEADF}` : `${size <= 8 ? 600 : 700} ${Math.round(size * (size <= 8 ? 1.5 : 1.3))}px ${FONT}`;
function rrect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function bigTitle(str, x, y, size, c1, c2) {
  ctx.font = `800 ${size}px ${HEADF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const w = ctx.measureText(str).width, g = ctx.createLinearGradient(0, y, 0, y + size); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.35; ctx.shadowOffsetY = size * 0.06; ctx.fillStyle = g; ctx.fillText(str, x, y); ctx.restore();
  return w;
}
function modernPanel(x, y, w, h, border, fill) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
  rrect(x, y, w, h, 16); ctx.fillStyle = fill; ctx.globalAlpha = 0.96; ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  rrect(x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  rrect(x + 0.5, y + 0.5, w - 1, h - 1, 16); ctx.strokeStyle = border; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
}
function modernButton(x, y, w, h, base, over, pressed, disabled) {
  const dy = pressed ? 1 : over && !disabled ? -1 : 0, r = Math.min(12, h / 2);
  ctx.save(); if (!disabled) { ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = over ? 16 : 8; ctx.shadowOffsetY = 4; }
  rrect(x, y + dy, w, h, r); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(base, over && !disabled ? 0.2 : 0.1)); g.addColorStop(1, shade(base, over && !disabled ? -0.02 : -0.12));
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  rrect(x + 0.5, y + dy + 0.5, w - 1, h - 1, r); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  return dy;
}


// ------------------------------------------------------------ helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const inRect = (px, py, x, y, w, h) => px >= x && px < x + w && py >= y && py < y + h;
const fmt = n => Math.floor(n).toLocaleString('en-US');
const byId = (arr, id) => arr.find(a => a.id === id);
function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, f) { const [r, g, b] = hexToRgb(h); const k = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255); return `rgb(${k(r)},${k(g)},${k(b)})`; }

// ------------------------------------------------------------ assets
const IMG = {};
const loading = [];
function img(key, src) {
  const im = new Image();
  loading.push(new Promise(r => { im.onload = r; im.onerror = () => { console.warn('missing', src); r(); }; }));
  im.src = src; IMG[key] = im; return im;
}
LAKES.forEach(l => { img('lake_' + l.id, `images/lake_${l.id}.png`); img('keeper_' + l.id, `images/keeper_${l.id}.png`); });
img('fisher', 'images/fisher.png');
FISH.forEach(f => img('fish_' + f.id, `images/fish/${f.id}.png`));
BAITS.forEach(b => img('bait_' + b.id, `images/bait/${b.id}.png`));
JUNK.forEach(j => { img('junk_' + j.id, `images/junk/${j.id}.png`); Object.assign(j, { junkItem: true, tier: 0, size: [0, 0], mouth: [0, 4], lake: 'any', likes: [], diff: j.chest ? 35 : 10, motion: j.chest ? 'sinker' : 'smooth' }); });
HATS.forEach(h => img('hat_' + h.id, `images/hats/${h.id}.png`));
img('fisher_base', 'images/fisher_base.png');
const fimg = f => IMG[(f.junkItem ? 'junk_' : 'fish_') + f.id];
const anyItem = id => FISH.find(f => f.id === id) || JUNK.find(j => j.id === id);

// small generated pixel icons
function pixelIcon(rows, pal) {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, y, 1, 1); } }));
  return c;
}
const ICON = {
  coin: pixelIcon(['..oooo..', '.oyYYyo.', 'oyYyyyyo', 'oyYyyyyo', 'oyyyyyDo', 'oyyyyyDo', '.oyDDDo.', '..oooo..'],
                  { o: '#5a3a0e', y: '#f2c14e', Y: '#fff3c4', D: '#c08a20' }),
  bucket: pixelIcon(['.oooooooo.', 'oGGGGGGGGo', 'oggggggggo', '.oggggggo.', '.oggggggo.', '.oggggggo.', '..oggggo..', '..oooooo..'],
                  { o: '#1a1420', g: '#7a8090', G: '#c8d0dc' }),
  note: pixelIcon(['....oo', '...oWo', '...oo.', '...o..', '.ooo..', 'oWWo..', 'oWWo..', '.oo...'], { o: '#16101e', W: '#ffffff' }),
  spk: pixelIcon(['...o....', '..oo..o.', 'oooo.o..', 'oWWo.o.o', 'oWWo.o.o', 'oooo.o..', '..oo..o.', '...o....'], { o: '#16101e', W: '#ffffff' }),
  lock: pixelIcon(['..oooo..', '.o....o.', '.o....o.', 'oooooooo', 'oyyyyyyo', 'oyyooyyo', 'oyyyyyyo', 'oooooooo'], { o: '#16101e', y: '#f2c14e' }),
  star: pixelIcon(['...o...', '..oyo..', 'ooyyyoo', 'oyyyyyo', '.oyyyo.', '.oyoyo.', 'oo...oo'], { o: '#5a3a0e', y: '#ffe680' }),
};
// rod icon (diagonal rod), cached per rod
const rodIconCache = {};
function rodIcon(rod) {
  if (rodIconCache[rod.id]) return rodIconCache[rod.id];
  const c = document.createElement('canvas'); c.width = 18; c.height = 18;
  const x = c.getContext('2d');
  const [handle, blank, tip, glowc] = rod.c;
  for (let i = 0; i < 16; i++) {
    const px = 1 + i, py = 16 - i;
    let col = i < 5 ? handle : (i > 14 ? tip : blank);
    if (col === 'rainbow') col = `hsl(${i * 30},90%,65%)`;
    x.fillStyle = col; x.fillRect(px, py, 1, 1);
    if (i < 5) { x.fillStyle = shade(handle, 0.25); x.fillRect(px, py - 1, 1, 1); x.fillStyle = shade(handle, -0.4); x.fillRect(px + 1, py, 1, 1); }
  }
  x.fillStyle = '#7a8090'; x.fillRect(4, 10, 3, 3); x.fillStyle = '#c8d0dc'; x.fillRect(4, 10, 1, 1);
  if (glowc) { x.fillStyle = rgba(glowc, 0.5); x.fillRect(15, 0, 3, 3); }
  return rodIconCache[rod.id] = c;
}

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_fishing_v2';
const fresh = () => ({
  coins: 0, lake: 'moonlit', unlocked: ['moonlit'], rods: ['twig'], rod: 'twig',
  baits: { worm: Infinity }, bait: 'worm', bucket: [], dex: {}, caught: 0, secretRod: false, tips: {},
  hats: ['cap'], hat: 'cap', bobbers: ['classic'], bobber: 'classic', jobs: {}, jobsDone: 0, awards: {}, perfects: 0, bestStreak: 0,
});
let save = fresh();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d) { save = Object.assign(fresh(), d); save.baits.worm = Infinity; }
  } catch (e) {}
}
function store() {
  try { const c = Object.assign({}, save, { baits: Object.assign({}, save.baits, { worm: 0 }) }); localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch (e) {}
}
const lake = () => byId(LAKES, save.lake);
const rod = () => byId(RODS, save.rod);
const bait = () => byId(BAITS, save.bait);
const lakeMeta = () => LAKE_META[save.lake];
const speciesCaught = lakeId => FISH.filter(f => f.lake === lakeId && save.dex[f.id]).length;

// ------------------------------------------------------------ input
const UI = { mx: -1, my: -1, down: false, px: 0, py: 0, click: null, regions: [], prevRegions: [], hover: null, lastHover: null, onUI: false };
function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); cv.setPointerCapture(e.pointerId);
  const [x, y] = toCanvas(e); UI.mx = x; UI.my = y; UI.down = true; UI.px = x; UI.py = y;
  UI.onUI = overlay !== null || UI.prevRegions.some(r => inRect(x, y, ...r));
  if (!UI.onUI) worldDown();
});
cv.addEventListener('pointermove', e => { [UI.mx, UI.my] = toCanvas(e); });
cv.addEventListener('pointerup', e => {
  const [x, y] = toCanvas(e); UI.down = false;
  UI.click = { x, y, px: UI.px, py: UI.py };
  if (!UI.onUI) worldUp();
});
cv.addEventListener('pointercancel', () => { UI.down = false; worldUp(); });
let spaceDown = false;
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault(); if (spaceDown) return; spaceDown = true;
    if (screen === 'title') return startGame();
    if (overlay === 'card') return closeCard();
    if (!overlay) worldDown();
  } else if (e.code === 'Escape') { if (overlay && overlay !== 'card') closeOverlay(); }
  else if (e.code === 'KeyM') { Sound.setMusic(!Sound.musicOn); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; if (!overlay) worldUp(); } });
window.addEventListener('blur', () => { spaceDown = false; UI.down = false; worldUp(); });
const holding = () => (UI.down && !UI.onUI) || spaceDown;

// ------------------------------------------------------------ game state
let screen = 'loading';    // loading | title | play
let state = 'idle';        // idle charging flight waiting nibble bite fight landing reelin
let overlay = null;        // null | shop | map | dex | gear | card | settings
let t = 0, stateT = 0;
let power = 0, powerDir = 1;
let biteAt = 0, nibbles = 0, nextNibble = 0, biteWindow = 0;
let hooked = null;           // fish data
let fight = null;            // minigame state
let landing = null;          // flying fish
let card = null;             // catch card data
let shopTab = 'rods', dexLake = 'moonlit', keeperLine = '', keeperT = 0;
let toasts = [], banner = null, fade = 0, fadeTo = null, shake = 0;
let coinShown = 0;

function setState(s) { state = s; stateT = 0; }
function toast(text, col = '#ffffff', dur = 2.6) { toasts.push({ text, col, t: 0, dur }); if (toasts.length > 4) toasts.shift(); }

// ------------------------------------------------------------ world physics
const HANDS = { x: 91, y: 130 };
const ROD_LEN = 42;
const rodPhys = { a: -1.05, v: 0, target: -1.05, bend: 0 };
const bob = { x: 0, y: 0, vx: 0, vy: 0, surf: 0, sink: 0, inWater: false, visible: true, x0: 0, y0: 0, tx: 0, ty: 0, flightT: 0, flightDur: 1 };
const ROPE_N = 18;
const rope = Array.from({ length: ROPE_N }, () => ({ x: 0, y: 0, ox: 0, oy: 0 }));
let ropeSeg = 1, ropeInit = false;
let particles = [], ripples = [], ambient = [], jumpers = [];

function rodTip() {
  const a = rodPhys.a;
  let tx = HANDS.x + Math.cos(a) * ROD_LEN, ty = HANDS.y + Math.sin(a) * ROD_LEN;
  // bend toward the line
  const b = rodPhys.bend;
  if (b) {
    const dx = bob.x - tx, dy = bob.y - ty, d = Math.hypot(dx, dy) || 1;
    tx += dx / d * b * 3; ty += b * 10;
  }
  return { x: tx, y: ty };
}
function idleBobberTarget() { const tip = rodTip(); return { x: tip.x, y: tip.y + 14 }; }

function updateRod(dt) {
  let target = -1.05;
  if (state === 'charging') target = lerp(-1.25, -2.25, power);
  else if (state === 'flight') target = -0.45;
  else if (['waiting', 'nibble', 'bite'].includes(state)) target = -0.62;
  else if (state === 'fight') target = -0.75 + (fight ? (fight.inZone ? 0.05 : -0.15) : 0) + Math.sin(t * 30) * 0.02 * (fight && !fight.inZone ? 1 : 0);
  else if (state === 'landing') target = -1.35;
  else if (state === 'reelin') target = -0.95;
  if (screen === 'title') target = -1.05 + Math.sin(t * 0.8) * 0.04;
  const k = state === 'flight' ? 260 : 90, damp = state === 'flight' ? 14 : 11;
  rodPhys.v += ((target - rodPhys.a) * k - rodPhys.v * damp) * dt;
  rodPhys.a += rodPhys.v * dt;
  let bend = 0;
  if (state === 'fight' && fight) bend = fight.inZone ? 0.55 : 0.95;
  else if (state === 'bite') bend = 0.5;
  else if (state === 'nibble') bend = 0.12 + Math.max(0, bob.sink) * 0.04;
  else if (state === 'reelin') bend = 0.25;
  rodPhys.bend = lerp(rodPhys.bend, bend, 1 - Math.exp(-dt * 10));
}

function updateBobber(dt) {
  const tip = rodTip();
  if (state === 'idle' || state === 'charging' || screen === 'title') {
    // dangling under the rod tip like a pendulum
    bob.inWater = false;
    const L = 14;
    bob.vy += 160 * dt;
    bob.x += bob.vx * dt; bob.y += bob.vy * dt;
    const dx = bob.x - tip.x, dy = bob.y - tip.y, d = Math.hypot(dx, dy) || 1;
    if (d > L) {
      const nx = dx / d, ny = dy / d;
      bob.x = tip.x + nx * L; bob.y = tip.y + ny * L;
      const vn = bob.vx * nx + bob.vy * ny; bob.vx -= vn * nx; bob.vy -= vn * ny;
    }
    bob.vx *= 1 - 1.5 * dt; bob.vy *= 1 - 1.5 * dt;
  } else if (state === 'flight') {
    bob.flightT += dt;
    const u = clamp(bob.flightT / bob.flightDur, 0, 1);
    const arc = 30 + 40 * power;
    bob.x = lerp(bob.x0, bob.tx, u);
    bob.y = lerp(bob.y0, bob.ty, u) - arc * 4 * u * (1 - u);
    if (u >= 1) land();
  } else if (state === 'reelin') {
    const tgt = idleBobberTarget();
    const dx = tgt.x - bob.x, dy = tgt.y - bob.y, d = Math.hypot(dx, dy);
    const sp = 260 * dt;
    if (d < sp + 1) { bob.vx = 0; bob.vy = 0; bob.inWater = false; setState('idle'); }
    else {
      bob.x += dx / d * sp; bob.y += dy / d * sp - (bob.inWater ? 0 : 0);
      if (bob.inWater && bob.y < bob.surf - 2) { bob.inWater = false; }
      if (Math.random() < 0.3 && bob.inWater) ripple(bob.x, bob.surf, 4);
    }
  } else if (bob.inWater) {
    const wave = Math.sin(t * 2.1 + bob.x * 0.1) * 0.6;
    if (state === 'fight' && fight) {
      const tx = bob.tx + Math.sin(t * 1.3) * 6 + (fight.fishPos - 0.5) * 30;
      bob.x = lerp(bob.x, tx, 1 - Math.exp(-dt * 3));
      bob.sink = 7;
      if (Math.random() < dt * 6) ripple(bob.x, bob.surf, 3 + Math.random() * 4);
      if (Math.random() < dt * (fight.inZone ? 2 : 5)) splashParticles(bob.x, bob.surf, 3, lakeMeta().shimmer);
    }
    const goal = bob.surf + bob.sink + wave;
    bob.vy += (-(bob.y - goal) * 110 - bob.vy * 7) * dt;
    bob.y += bob.vy * dt;
    bob.sink *= state === 'bite' || state === 'fight' ? 1 : Math.exp(-dt * 6);
  }
}

function updateRope(dt) {
  const tip = rodTip();
  const end = { x: bob.x, y: bob.y - 4 };
  if (!ropeInit) { rope.forEach((p, i) => { p.x = p.ox = lerp(tip.x, end.x, i / (ROPE_N - 1)); p.y = p.oy = lerp(tip.y, end.y, i / (ROPE_N - 1)); }); ropeInit = true; }
  const dist = Math.hypot(end.x - tip.x, end.y - tip.y);
  let slack = 1.04;
  if (state === 'waiting' || state === 'nibble') slack = 1.06;
  if (state === 'flight') slack = 1.02;
  if (state === 'fight' || state === 'bite') slack = 1.0;
  ropeSeg = Math.max(0.5, dist * slack / (ROPE_N - 1));
  for (let i = 1; i < ROPE_N - 1; i++) {
    const p = rope[i];
    const vx = (p.x - p.ox) * 0.96, vy = (p.y - p.oy) * 0.96;
    p.ox = p.x; p.oy = p.y;
    p.x += vx; p.y += vy + 420 * dt * dt;
    if (p.y > bob.surf && bob.inWater && p.x > M.deckX + 4) p.y = lerp(p.y, bob.surf, 0.3);
  }
  rope[0].x = tip.x; rope[0].y = tip.y; rope[ROPE_N - 1].x = end.x; rope[ROPE_N - 1].y = end.y;
  for (let k = 0; k < 10; k++) {
    for (let i = 0; i < ROPE_N - 1; i++) {
      const a = rope[i], b = rope[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.0001;
      const diff = (d - ropeSeg) / d * 0.5;
      if (i > 0) { a.x += dx * diff; a.y += dy * diff; }
      if (i + 1 < ROPE_N - 1) { b.x -= dx * diff; b.y -= dy * diff; }
    }
  }
}

// ------------------------------------------------------------ fishing flow
function worldDown() {
  if (screen !== 'play' || overlay) return;
  Sound.init();
  if (state === 'idle') { setState('charging'); power = 0; powerDir = 1; }
  else if (state === 'waiting') { toast('Reeled in.', '#c8c8dc', 1.4); reelIn(); }
  else if (state === 'nibble') { toast('Too early! You spooked it.', '#ffb464'); Sound.play('escape'); useBait(); breakStreak(); reelIn(); }
  else if (state === 'bite') startFight();
}
function worldUp() {
  if (state === 'charging') cast();
}
function cast() {
  setState('flight');
  const tip = rodTip();
  bob.x0 = tip.x; bob.y0 = tip.y;
  bob.tx = 116 + power * 178; bob.ty = 154 - power * 44;
  bob.flightT = 0; bob.flightDur = 0.55 + power * 0.5;
  bob.inWater = false; bob.sink = 0;
  Sound.play('cast'); Sound.play('reelOut');
  save.tips.cast = true;
}
function land() {
  setState('waiting');
  bob.inWater = true; bob.surf = bob.ty; bob.y = bob.ty - 2; bob.vy = 40; bob.x = bob.tx;
  splashParticles(bob.x, bob.surf, 14, '#e8f4ff'); ripple(bob.x, bob.surf, 3); ripple(bob.x, bob.surf, 1);
  Sound.play('splash', 0.8);
  const b = bait();
  biteAt = rand(3.2, 8.5) * b.bite * (1 - power * 0.12) * WEATHER[weather.id].bite;
  nibbles = Math.floor(rand(1, 4)); nextNibble = Math.max(0.6, biteAt - nibbles * rand(0.6, 0.9));
}
function reelIn() { setState('reelin'); hooked = null; fight = null; Sound.play('reelOut'); }
function useBait() {
  const b = bait();
  if (b.pack === 0) return;
  save.baits[b.id] = (save.baits[b.id] || 0) - 1;
  if (save.baits[b.id] <= 0) { delete save.baits[b.id]; save.bait = 'worm'; toast(`Out of ${b.name}! Switched to Worm.`, '#ffb464'); }
  store();
}
function chooseFish() {
  const b = bait(), r = rod();
  if (Math.random() < 0.07) {
    const jw = JUNK.map(j => j.w); let x = Math.random() * jw.reduce((a, c) => a + c, 0);
    for (const j of JUNK) { x -= j.w; if (x <= 0) return j; }
  }
  const luck = r.luck + b.luck + power * 0.12 + WEATHER[weather.id].luck;
  const pool = FISH.filter(f => f.lake === save.lake && (!f.needs || f.needs === b.id));
  const w = pool.map(f => f.w * (1 + luck * f.tier * 0.9) * (f.likes.includes(b.id) ? 2.2 : 1));
  let x = Math.random() * w.reduce((a, c) => a + c, 0);
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
  return pool[0];
}
function updateFishing(dt) {
  stateT += dt;
  if (state === 'charging') {
    power += powerDir * dt / 1.05;
    if (power >= 1) { power = 1; powerDir = -1; Sound.play('charge', 1); }
    if (power <= 0) { power = 0; powerDir = 1; }
    if (Math.floor(stateT * 12) !== Math.floor((stateT - dt) * 12)) Sound.play('charge', power);
  } else if (state === 'waiting') {
    if (stateT >= nextNibble && nibbles > 0) {
      setState('nibble'); stateT = 0;
    }
    // shadow of a curious fish drifting near the bobber
  } else if (state === 'nibble') {
    if (stateT > 0.05 && stateT < 0.1 && bob.sink < 1) { bob.vy += 38; bob.sink = 2.5; ripple(bob.x, bob.surf, 3); Sound.play('plop'); }
    if (stateT > rand(0.7, 1.0)) {
      nibbles--;
      if (nibbles <= 0) {
        hooked = chooseFish(); setState('bite');
        bob.sink = 9; bob.vy += 60;
        biteWindow = 0.95 - 0.38 * hooked.diff / 100;
        splashParticles(bob.x, bob.surf, 10, '#e8f4ff'); ripple(bob.x, bob.surf, 4); ripple(bob.x, bob.surf, 1);
        Sound.play('bite'); shake = 0.15;
      } else { setState('nibble'); }
    }
  } else if (state === 'bite') {
    if (stateT > biteWindow) { toast('Too slow... it got away.', '#ff8c78'); Sound.play('escape'); useBait(); breakStreak(); reelIn(); }
  } else if (state === 'fight') {
    updateFight(dt);
  } else if (state === 'landing') {
    landing.t += dt;
    if (landing.t >= landing.dur) { setState('idle'); showCard(); }
  }
}

// ------------------------------------------------------------ catch minigame
function startFight() {
  const usedBait = save.bait;
  useBait();
  const f = hooked, r = rod();
  if (f.junkItem && !f.chest) { fight = { perfect: false, bait: usedBait, progress: 1 }; Sound.play('hook'); winFight(); return; }
  fight = {
    zone: r.zone * (1.3 - 0.5 * f.diff / 100 * 0.84), zonePos: 0.0, zoneVel: 0, fishPos: 0.35, fishVel: 0, fishTarget: 0.5, retarget: 0.6,
    progress: 0.32, inZone: true, perfect: true, d: f.diff / 100 * 0.84, motion: f.motion, tick: 0, jumpT: rand(2, 5), bait: usedBait,
  };
  setState('fight');
  Sound.play('hook'); shake = 0.2;
  if (!save.tips.fight) toast('HOLD to raise the green bar - keep the fish inside it!', '#ffe680', 4);
  save.tips.fight = true;
}
function updateFight(dt) {
  const F = fight, d = F.d, r = rod();
  // player bar physics
  const hold = holding();
  F.zoneVel += (hold ? 3.6 : -2.9) * dt;
  F.zoneVel *= 1 - 0.9 * dt;
  F.zonePos += F.zoneVel * dt;
  if (F.zonePos < 0) { F.zonePos = 0; F.zoneVel = Math.abs(F.zoneVel) > 0.25 ? -F.zoneVel * 0.4 : 0; }
  if (F.zonePos + F.zone > 1) { F.zonePos = 1 - F.zone; F.zoneVel = Math.min(0, F.zoneVel) * 0.3; }
  // fish movement
  F.retarget -= dt;
  let motion = F.motion;
  if (motion === 'mixed') motion = ['smooth', 'dart', 'sinker', 'floater'][Math.floor(t / 3) % 4];
  if (F.retarget <= 0) {
    let target = Math.random();
    if (motion === 'sinker') target = Math.pow(Math.random(), 1.8) * 0.8;
    if (motion === 'floater') target = 1 - Math.pow(Math.random(), 1.8) * 0.8;
    if (motion === 'smooth') target = clamp(F.fishPos + rand(-0.35, 0.35), 0.05, 0.95);
    if (motion === 'dart') target = F.fishPos + (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 0.5);
    F.fishTarget = clamp(target, 0.03, 0.97);
    F.retarget = lerp(1.8, 0.55, d) * rand(0.6, 1.4);
  }
  const accel = (motion === 'dart' ? 20 : 14) * (0.3 + 1.2 * d);
  F.fishVel += (F.fishTarget - F.fishPos) * accel * dt;
  F.fishVel *= 1 - (5.5 - d * 2.5) * dt;
  F.fishVel += (Math.random() - 0.5) * d * 2.2 * dt;
  F.fishPos = clamp(F.fishPos + F.fishVel * dt, 0, 1);
  // progress
  F.inZone = F.fishPos >= F.zonePos - 0.01 && F.fishPos <= F.zonePos + F.zone + 0.01;
  if (F.inZone) F.progress += 0.27 * r.reel * dt;
  else { F.progress -= (0.17 + 0.24 * d) * dt; F.perfect = false; }
  F.tick += dt;
  if (F.tick > (F.inZone ? 0.07 : 0.18)) { F.tick = 0; Sound.play(F.inZone ? 'reelTick' : 'strain', F.inZone ? 1 : 0.6); }
  // fish leaps for drama
  F.jumpT -= dt;
  if (F.jumpT <= 0 && hooked.tier >= 1) { F.jumpT = rand(2.5, 6); jumpers.push({ x: bob.x + rand(-6, 6), y: bob.surf, t: 0, dur: 0.7, fish: hooked, big: true }); Sound.play('splash', 0.6); }
  if (F.progress >= 1) winFight();
  else if (F.progress <= 0) { toast(`The ${hooked.name} got away!`, '#ff8c78'); Sound.play('escape'); breakStreak(); reelIn(); }
}
function winFight() {
  const f = hooked, F = fight;
  let size = 0, value = f.value, isNew = false, isRecord = false, chestCoins = 0, chestBait = null;
  if (f.junkItem) {
    if (f.chest) {
      chestCoins = Math.round(rand(0.7, 1.4) * [90, 450, 1800, 6000, 22000][LAKES.indexOf(lake())]);
      const pool = BAITS.filter(b => b.pack && LAKES.indexOf(byId(LAKES, b.lake)) <= LAKES.indexOf(lake()));
      chestBait = pick(pool); save.baits[chestBait.id] = (save.baits[chestBait.id] || 0) + 10;
      save.coins += chestCoins; value = 0; award('treasure');
    } else if (f.value > 0) save.bucket.push({ id: f.id, size: 0, value: f.value });
    if (f.id === 'boot') award('junk');
  } else {
    const u = Math.pow(Math.random(), 1.6);
    size = Math.round(lerp(f.size[0], f.size[1], u));
    streak++; save.bestStreak = Math.max(save.bestStreak, streak);
    const sBonus = 1 + Math.min(streak - 1, 10) * 0.05;
    value = Math.round(f.value * (0.75 + 0.5 * u) * (F.perfect ? 1.25 : 1) * sBonus);
    const prev = save.dex[f.id];
    isNew = !prev; isRecord = !!prev && size > prev.best;
    save.dex[f.id] = { n: (prev ? prev.n : 0) + 1, best: Math.max(size, prev ? prev.best : 0) };
    save.bucket.push({ id: f.id, size, value });
    save.caught++;
    if (F.perfect) save.perfects++;
    progressJobs(f, size);
    if (f.tier >= 2) award('rare'); if (f.tier >= 3) award('legend'); if (f.tier >= 4) award('mythic');
    if (F.perfect) award('perfect');
    if (streak >= 5) award('streak5'); if (streak >= 15) award('streak15');
    if (weather.id === 'storm') award('storm');
    if (size >= 200) award('giant');
    if (f.id === 'devourer') award('devourer');
    checkAwards();
  }
  store();
  card = { f, size, value, isNew, isRecord, perfect: F.perfect && !f.junkItem, t: 0, bait: F.bait, streak: f.junkItem ? 0 : streak, chestCoins, chestBait };
  landing = { f, t: 0, dur: 0.85, x0: bob.x, y0: bob.surf, x1: HANDS.x + 4, y1: HANDS.y - 18 };
  splashParticles(bob.x, bob.surf, 22, '#e8f4ff'); ripple(bob.x, bob.surf, 6); ripple(bob.x, bob.surf, 2);
  Sound.play('splash', 1.2);
  fight = null; setState('landing'); shake = 0.25;
  bob.inWater = false; bob.x = HANDS.x + 6; bob.y = HANDS.y; bob.vx = 0; bob.vy = 0;
}
function showCard() {
  overlay = 'card'; card.t = 0;
  Sound.play('catch', card.f.tier);
  if (card.isNew) Sound.play('newFish');
  if (card.f.tier >= 3) shake = 0.4;
}
function closeCard() { overlay = null; card = null; Sound.play('click'); }

// ------------------------------------------------------------ particles & ambience
function splashParticles(x, y, n, col) {
  for (let i = 0; i < n; i++) particles.push({ x, y, vx: rand(-40, 40), vy: rand(-75, -25), life: rand(0.4, 0.8), t: 0, col, g: 220, size: Math.random() < 0.3 ? 2 : 1 });
}
function ripple(x, y, r0) { ripples.push({ x, y, r: r0, life: 1.2 + r0 * 0.05, t: 0 }); }
function initAmbient() {
  ambient = [];
  const m = lakeMeta(), type = m.particles;
  const n = { fireflies: 16, wisps: 9, snow: 90, motes: 34, embers: 26 }[type] || 0;
  for (let i = 0; i < n; i++) ambient.push({ x: rand(0, LW), y: rand(0, LH), vx: rand(-4, 4), vy: rand(-4, 4), ph: rand(0, 6.28), s: rand(0.5, 1.5) });
}
function updateAmbient(dt) {
  const type = lakeMeta().particles;
  ambient.forEach(p => {
    p.ph += dt;
    if (type === 'fireflies' || type === 'wisps') {
      p.vx += rand(-20, 20) * dt; p.vy += rand(-20, 20) * dt; p.vx *= 0.98; p.vy *= 0.98;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < 70 || p.y > 135) p.vy *= -1;
      if (p.x < 0) p.x = LW; if (p.x > LW) p.x = 0;
      p.y = clamp(p.y, 68, 137);
    } else if (type === 'snow') {
      p.y += (10 + p.s * 10) * dt; p.x += Math.sin(p.ph * 1.3) * 6 * dt - 3 * dt;
      if (p.y > LH) { p.y = -2; p.x = rand(0, LW); } if (p.x < 0) p.x = LW;
    } else if (type === 'motes' || type === 'embers') {
      p.y -= (4 + p.s * 6) * dt; p.x += Math.sin(p.ph) * 4 * dt;
      if (p.y < 0) { p.y = rand(100, LH); p.x = type === 'embers' && Math.random() < 0.5 ? (lakeMeta().flame[0] + rand(-2, 2)) : rand(0, LW); if (type === 'embers' && Math.abs(p.x - lakeMeta().flame[0]) < 3) p.y = lakeMeta().flame[1]; }
    }
  });
  particles.forEach(p => { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
  particles = particles.filter(p => p.t < p.life);
  ripples.forEach(r => { r.t += dt; r.r += 14 * dt; });
  ripples = ripples.filter(r => r.t < r.life);
  // distant fish jumping now and then
  if (Math.random() < dt * 0.18 && screen !== 'loading') {
    const pool = FISH.filter(f => f.lake === save.lake && f.tier <= 1);
    jumpers.push({ x: rand(130, 300), y: rand(HORIZON + 6, 130), t: 0, dur: 0.6, fish: pick(pool), big: false });
  }
  jumpers.forEach(j => {
    const before = j.t; j.t += dt;
    if (before === 0 || (before < j.dur && j.t >= j.dur)) { ripple(j.x + (j.t >= j.dur ? 8 : 0), j.y, 1); splashParticles(j.x + (j.t >= j.dur ? 8 : 0), j.y, j.big ? 8 : 4, lakeMeta().shimmer); }
  });
  jumpers = jumpers.filter(j => j.t < j.dur + 0.05);
}

// ------------------------------------------------------------ world rendering (low-res)
function px(x, y, col, w = 1, h = 1) { lx.fillStyle = col; lx.fillRect(Math.round(x), Math.round(y), w, h); }
function drawWorld() {
  const m = lakeMeta();
  lx.setTransform(1, 0, 0, 1, 0, 0);
  const sh = shake > 0 ? shake * 6 : 0;
  lx.translate(Math.round(rand(-sh, sh)), Math.round(rand(-sh, sh)));
  lx.drawImage(IMG['lake_' + save.lake], 0, 0);
  if (save.lake !== 'crystal') {
    const off = (t * 3) % (LW * 2);
    lx.globalAlpha = weather.id === 'storm' || weather.id === 'rain' ? 0.45 : 0.16;
    lx.drawImage(cloudCv, -off, 4); lx.drawImage(cloudCv, LW * 2 - off, 4);
    lx.globalAlpha = 1;
  }
  drawShadows();
  // animated water shimmer
  lx.globalAlpha = 0.35;
  for (let i = 0; i < 46; i++) {
    const y = HORIZON + 3 + ((i * 37) % (LH - HORIZON - 4));
    const sp = 2 + (y - HORIZON) * 0.05;
    const x = ((i * 71 + t * sp * (i % 2 ? 1 : -1)) % (LW + 20) + LW + 20) % (LW + 20) - 10;
    const len = 2 + ((i * 13) % 5) + Math.floor((y - HORIZON) / 18);
    if (x > M.deckX + 6 || y < M.deckY) px(x, y, m.shimmer, len, 1);
  }
  lx.globalAlpha = 1;
  // light flicker glow
  lx.globalCompositeOperation = 'lighter';
  m.lights.forEach(([x, y, c, r], i) => {
    const f = 0.18 + 0.06 * Math.sin(t * 7 + i) + 0.04 * Math.sin(t * 13.7 + i * 2);
    const g = lx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, f)); g.addColorStop(1, rgba(c, 0));
    lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2);
  });
  lx.globalCompositeOperation = 'source-over';
  // sparkles (crystal)
  (m.sparkles || []).forEach(([x, y], i) => {
    const s = Math.sin(t * 2 + i * 1.7);
    if (s > 0.85) { px(x, y, '#ffffff'); if (s > 0.95) { px(x - 1, y, '#d8f8ff'); px(x + 1, y, '#d8f8ff'); px(x, y - 1, '#d8f8ff'); px(x, y + 1, '#d8f8ff'); } }
  });
  // flame (abyss brazier)
  if (m.flame) {
    const [fx, fy] = m.flame;
    for (let i = 0; i < 6; i++) {
      const h = 2 + Math.abs(Math.sin(t * 9 + i * 1.3)) * 4;
      px(fx - 3 + i, fy - h, i % 2 ? '#c46cff' : '#ff9ae0', 1, h);
    }
    px(fx - 1, fy - 2, '#ffffff', 2, 2);
  }
  // shooting stars
  if ((save.lake === 'abyss' || save.lake === 'glacier') && Math.sin(t * 0.37) > 0.995) {
    const sx = (t * 97) % LW, sy = 10 + (t * 13) % 40;
    for (let k = 0; k < 8; k++) { lx.globalAlpha = 1 - k / 8; px(sx - k * 2, sy - k, '#ffffff'); }
    lx.globalAlpha = 1;
  }
  // ambient particles behind
  drawAmbient(m.particles, true);
  // distant jumpers
  jumpers.forEach(j => {
    const u = clamp(j.t / j.dur, 0, 1);
    const im = fimg(j.fish); if (!im) return;
    const sc = j.big ? 0.5 : 0.25;
    const x = j.x + u * 8, y = j.y - Math.sin(u * Math.PI) * (j.big ? 14 : 6);
    lx.save(); lx.translate(Math.round(x), Math.round(y)); lx.rotate(-0.8 + u * 1.6); lx.scale(-sc, sc);
    lx.drawImage(im, -im.width / 2, -im.height / 2); lx.restore();
  });
  // ripples
  ripples.forEach(r => {
    const a = 1 - r.t / r.life;
    lx.globalAlpha = a * 0.7;
    for (let k = 0; k < 28; k++) {
      const ang = k / 28 * Math.PI * 2;
      const x = r.x + Math.cos(ang) * r.r, y = r.y + Math.sin(ang) * r.r * 0.28;
      if (Math.sin(ang) > -0.3 || r.r < 5) px(x, y, '#d8e0ff');
    }
    lx.globalAlpha = 1;
  });
  // fish shadow under water while waiting
  if ((state === 'waiting' && stateT > nextNibble - 1.5) || state === 'nibble') {
    const k = state === 'nibble' ? 1 : clamp((stateT - (nextNibble - 1.5)) / 1.5, 0, 1);
    lx.globalAlpha = 0.28 * k;
    const sx = bob.x + 6 + Math.sin(t * 2) * 3 - (1 - k) * 18, sy = bob.surf + 5;
    lx.fillStyle = '#000010'; lx.beginPath(); lx.ellipse(sx, sy, 7, 2, 0, 0, Math.PI * 2); lx.fill();
    lx.globalAlpha = 1;
  }
  // fisher + rod + line + bobber
  if (screen !== 'loading') {
    drawFisher();
    drawLine(); drawRod(); drawBobber();
  }
  // fish flying to the dock
  if (state === 'landing' && landing) {
    const u = clamp(landing.t / landing.dur, 0, 1), im = fimg(landing.f);
    const x = lerp(landing.x0, landing.x1, u), y = lerp(landing.y0, landing.y1, u) - Math.sin(u * Math.PI) * 34;
    lx.save(); lx.translate(Math.round(x), Math.round(y)); lx.rotate(u * Math.PI * 2.5);
    const sc = clamp(28 / Math.max(im.width, im.height), 0.4, 1);
    lx.scale(sc, sc); lx.drawImage(im, -im.width / 2, -im.height / 2); lx.restore();
    if (Math.random() < 0.5) particles.push({ x, y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.4, t: 0, col: '#e8f4ff', g: 120, size: 1 });
  }
  particles.forEach(p => { lx.globalAlpha = 1 - p.t / p.life; px(p.x, p.y, p.col, p.size, p.size); });
  lx.globalAlpha = 1;
  drawAmbient(m.particles, false);
  drawWeather();
}
function drawAmbient(type, behind) {
  ambient.forEach((p, i) => {
    if ((i % 3 === 0) !== behind && type !== 'snow') return;
    if (type === 'fireflies') {
      const a = Math.max(0, Math.sin(p.ph * 2.2)); if (a < 0.1) return;
      lx.globalAlpha = a; px(p.x, p.y, '#e8ff8a'); lx.globalAlpha = a * 0.25; px(p.x - 1, p.y - 1, '#e8ff8a', 3, 3);
    } else if (type === 'wisps') {
      const a = 0.6 + 0.4 * Math.sin(p.ph * 1.5);
      lx.globalAlpha = a * 0.2; px(p.x - 2, p.y - 2, '#8aff7a', 5, 5);
      lx.globalAlpha = a; px(p.x, p.y, '#d8ffc8', 1, 1); px(p.x - 1, p.y, '#8aff7a'); px(p.x + 1, p.y, '#8aff7a');
    } else if (type === 'snow') {
      if (behind !== (p.s < 1)) return;
      lx.globalAlpha = 0.6 + p.s * 0.25; px(p.x, p.y, '#ffffff', p.s > 1.2 ? 2 : 1, p.s > 1.2 ? 2 : 1);
    } else if (type === 'motes') {
      const a = 0.5 + 0.5 * Math.sin(p.ph * 3);
      lx.globalAlpha = a; px(p.x, p.y, i % 2 ? '#d8a8ff' : '#a8f8ff');
    } else if (type === 'embers') {
      const a = 0.5 + 0.5 * Math.sin(p.ph * 4);
      lx.globalAlpha = a; px(p.x, p.y, i % 3 ? '#c46cff' : '#ff9ae0');
    }
    lx.globalAlpha = 1;
  });
}
function drawRod() {
  const r = rod(), [handle, blank, tipc, glowc] = r.c;
  const tip = rodTip(), a = rodPhys.a;
  const ux = HANDS.x + Math.cos(a) * ROD_LEN, uy = HANDS.y + Math.sin(a) * ROD_LEN;
  const cx = HANDS.x + (ux - HANDS.x) * 0.55, cy = HANDS.y + (uy - HANDS.y) * 0.55;
  const back = { x: HANDS.x - Math.cos(a) * 7, y: HANDS.y - Math.sin(a) * 7 };
  // handle extends behind the hands
  for (let i = 0; i <= 8; i++) { const u = i / 8; px(lerp(back.x, HANDS.x, u), lerp(back.y, HANDS.y, u), i % 3 === 0 ? shade(handle, -0.3) : handle, 2, 2); }
  const N = 46;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = (1 - u) * (1 - u) * HANDS.x + 2 * (1 - u) * u * cx + u * u * tip.x;
    const y = (1 - u) * (1 - u) * HANDS.y + 2 * (1 - u) * u * cy + u * u * tip.y;
    let col = blank === 'rainbow' ? `hsl(${(u * 300 + t * 120) % 360},90%,65%)` : blank;
    if (u > 0.94) col = tipc;
    px(x, y, col, u < 0.3 ? 2 : 1, u < 0.3 ? 2 : 1);
    if ((i === 18 || i === 28 || i === 38)) px(x + 0.5, y + 1, '#c8d0dc');
  }
  // reel
  const rx = HANDS.x + Math.cos(a) * 5 + 2, ry = HANDS.y + Math.sin(a) * 5 + 3;
  px(rx - 1, ry - 1, '#5a6070', 3, 3); px(rx - 1, ry - 1, '#c8d0dc');
  const spin = state === 'fight' || state === 'reelin' ? t * 20 : 0;
  px(rx + Math.cos(spin) * 2, ry + Math.sin(spin) * 2, '#e8e8f0');
  if (glowc) {
    lx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 4); px(tip.x - 1, tip.y - 1, glowc, 3, 3); lx.globalAlpha = 1;
  }
}
function drawLine() {
  lx.globalAlpha = 0.85;
  for (let i = 0; i < ROPE_N - 1; i++) {
    const a = rope[i], b = rope[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let k = 0; k < n; k++) {
      const x = lerp(a.x, b.x, k / n), y = lerp(a.y, b.y, k / n);
      const under = bob.inWater && y > bob.surf + 0.5 && x > M.deckX + 4;
      px(x, y, under ? 'rgba(200,210,255,0.35)' : '#e8e4f0');
    }
  }
  lx.globalAlpha = 1;
}
function drawBobber() {
  const x = Math.round(bob.x), y = Math.round(bob.y);
  const clipY = bob.inWater ? Math.round(bob.surf + 1) : 999;
  const sk = byId(BOBBERS, save.bobber) || BOBBERS[0];
  const rows = sk.duck ? ['.......', '...oo..', '..orRo.', '..orroW', 'oorrro.', 'orrrrro', '.ooooo.', '.......'] : ['..o..', '.ooo.', 'orrro', 'oRrro', 'owwwo', 'oWwwo', '.ooo.', '..o..'];
  const pal = sk.pal, ox = sk.duck ? 3 : 2;
  if (sk.glow) { lx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4); px(x - 4, y - 7, sk.glow, 9, Math.min(10, clipY - (y - 7))); lx.globalAlpha = 1; }
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const yy = y - 6 + j;
    if (ch !== '.' && yy < clipY) px(x - ox + i, yy, pal[ch]);
  }));
  // bait on the hook (visible while out of the water)
  if (!bob.inWater && state !== 'landing') {
    const b = bait();
    px(x, y + 2, '#c8d0dc'); px(x, y + 3, '#c8d0dc'); px(x, y + 4, '#a0a8b4');
    px(x - 1, y + 5, b.col, 3, 2); px(x - 1, y + 5, shade(b.col, 0.4));
    if (b.glow) { lx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 5); px(x - 2, y + 4, b.col, 5, 4); lx.globalAlpha = 1; }
  }
  if (bob.inWater && y + 2 >= clipY) { px(x - 3, clipY, 'rgba(220,230,255,0.6)', 7, 1); }
}

// ------------------------------------------------------------ UI primitives (full-res)
function text(s, x, y, size = 16, col = '#fff', align = 'left', shadow = true) {
  ctx.font = fontOf(size); ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = Math.max(4, size / 3); ctx.shadowOffsetY = Math.max(1, size / 10); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore(); }
  else { ctx.fillStyle = col; ctx.fillText(s, x, y); }
}
function wrap(s, x, y, maxW, size, col, lineH) {
  ctx.font = fontOf(size);
  const words = s.split(' '); let line = '', yy = y;
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { text(line, x, yy, size, col); line = w; yy += lineH; } else line = test;
  });
  if (line) text(line, x, yy, size, col);
  return yy + lineH;
}
function panel(x, y, w, h, fill = '#1a1530', border = '#3a2f63', light = null) {
  modernPanel(x, y, w, h, border, fill);
  void light;
}
function hitRegion(x, y, w, h) { UI.regions.push([x, y, w, h]); }
function button(id, x, y, w, h, label, o = {}) {
  hitRegion(x, y, w, h);
  const over = inRect(UI.mx, UI.my, x, y, w, h);
  const pressed = over && UI.down && inRect(UI.px, UI.py, x, y, w, h);
  if (over && !o.disabled) UI.hover = id;
  const base = o.disabled ? '#3a3a4a' : (o.color || '#4a3a8a');
  const top = pressed ? 4 : 0;
  modernButton(x, y, w, h, base, over, pressed, o.disabled);
  if (o.icon) {
    const isz = o.iconSize || 24;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(o.icon, x + 12, y + (h - 8 - isz) / 2 + top, isz, isz);
  }
  const sz = o.size || 16;
  text(label, x + w / 2 + (o.icon ? 14 : 0), y + (h - sz * 1.3) / 2 + top + 1, sz, o.disabled ? '#8a8a9a' : (o.textCol || '#ffffff'), 'center');
  const c = UI.click;
  if (c && inRect(c.x, c.y, x, y, w, h) && inRect(c.px, c.py, x, y, w, h)) {
    UI.click = null;
    if (o.disabled) { Sound.play('error'); if (o.onDisabled) o.onDisabled(); return false; }
    Sound.play(o.sfx || 'click'); return true;
  }
  return false;
}
function bar(x, y, w, h, frac, col) {
  ctx.fillStyle = '#0a0812'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2a2440'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(frac, 0, 1), h - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(frac, 0, 1), 2);
}
function sprite(im, x, y, scale) { if (!im) return; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, Math.round(x), Math.round(y), im.width * scale, im.height * scale); }
function fishFit(f, cx, cy, maxW, maxH, silhouette) {
  const im = fimg(f); if (!im || !im.width) return;
  const sc = Math.max(1, Math.floor(Math.min(maxW / im.width, maxH / im.height)));
  const x = cx - im.width * sc / 2, y = cy - im.height * sc / 2;
  if (silhouette) { ctx.filter = 'brightness(0)'; ctx.globalAlpha = 0.55; }
  sprite(im, x, y, sc);
  ctx.filter = 'none'; ctx.globalAlpha = 1;
  return { x, y, sc };
}
function closeButton(x, y) { return button('close', x, y, 52, 52, 'X', { color: '#8a2a3a', sfx: 'back' }); }
function closeOverlay() { overlay = null; Sound.play('back'); Sound.playSong(SONGS[save.lake]); }

// ------------------------------------------------------------ HUD
function drawHUD() {
  const l = lake();
  coinShown = coinShown < save.coins ? Math.min(save.coins, coinShown + Math.max(1, (save.coins - coinShown) * 0.12)) : save.coins;
  panel(16, 16, 330, 104, l.panel, shade(l.accent, -0.45));
  sprite(ICON.coin, 34, 34, 4);
  text(fmt(coinShown), 78, 38, 24, '#ffd65a');
  sprite(ICON.bucket, 32, 76, 3);
  const bv = save.bucket.reduce((a, b) => a + b.value, 0);
  text(`${save.bucket.length} fish  (${fmt(bv)}c)`, 78, 80, 12, '#e8e4ff');
  // lake name
  text(l.name.toUpperCase(), W / 2, 22, 16, l.accent, 'center');
  text(`${speciesCaught(l.id)}/8 SPECIES`, W / 2, 46, 8, '#a8a0d0', 'center');
  // sound toggles
  if (button('music', W - 132, 16, 56, 56, '', { icon: ICON.note, iconSize: 32, color: Sound.musicOn ? '#3a6a4a' : '#5a2a3a', sfx: 'tab' })) Sound.setMusic(!Sound.musicOn);
  if (button('sfx', W - 72, 16, 56, 56, '', { icon: ICON.spk, iconSize: 32, color: Sound.sfxOn ? '#3a6a4a' : '#5a2a3a', sfx: 'tab' })) { Sound.setSfx(!Sound.sfxOn); }
  if (!Sound.musicOn) { ctx.fillStyle = '#ff5a5a'; ctx.fillRect(W - 128, 40, 48, 4); }
  if (!Sound.sfxOn) { ctx.fillStyle = '#ff5a5a'; ctx.fillRect(W - 68, 40, 48, 4); }
  // gear readout (bottom left)
  const r = rod(), b = bait();
  panel(16, H - 108, 360, 92, l.panel, shade(l.accent, -0.45));
  sprite(rodIcon(r), 32, H - 92, 3);
  text(r.name, 94, H - 88, 12, '#ffffff');
  sprite(IMG['bait_' + b.id], 92, H - 66, 3);
  text(b.name + (b.pack ? `  x${save.baits[b.id] || 0}` : '  (free)'), 130, H - 60, 12, b.pack ? '#ffe680' : '#a8a0d0');
  // menu buttons
  const busy = !['idle'].includes(state);
  const bx = W - 5 * 128 - 12, by = H - 84, nope = () => toast('Reel in first!', '#ffb464', 1.2);
  if (button('shop', bx, by, 120, 68, 'SHOP', { color: '#8a5a1a', disabled: busy, onDisabled: nope })) openShop();
  if (button('gear', bx + 128, by, 120, 68, 'GEAR', { color: '#2a5a8a', disabled: busy, onDisabled: nope })) { overlay = 'gear'; }
  if (button('map', bx + 256, by, 120, 68, 'MAP', { color: '#2a7a5a', disabled: busy, onDisabled: nope })) { overlay = 'map'; }
  if (button('dex', bx + 384, by, 120, 68, 'DEX', { color: '#7a2a7a' })) { overlay = 'dex'; dexLake = save.lake; }
  if (button('tank', bx + 512, by, 120, 68, 'TANK', { color: '#1a6a8a' })) openTank();
  // weather badge
  const wx = WEATHER[weather.id];
  text(`${wx.name.toUpperCase()}${wx.luck ? '  +' + Math.round(wx.luck * 100) + '% LUCK' : ''}`, W / 2, 62, 8, wx.col, 'center');
  // streak
  if (streak >= 2) { const fl = Math.sin(t * 12) > 0 ? '#ff8a3a' : '#ffcc33'; text(`STREAK x${streak}  +${Math.min(streak - 1, 10) * 5}%`, 30, 128, 8, fl); }
  const ready = jobs().filter(j => j.got >= j.n).length;
  if (ready && state === 'idle') text(`${ready} JOB${ready > 1 ? 'S' : ''} DONE - VISIT SHOP!`, bx + 60, by - 22, 8, Math.sin(t * 5) > 0 ? '#6ae06a' : '#ffe680', 'center');
  // contextual hint
  let hint = '';
  if (state === 'idle') hint = save.tips.cast ? 'HOLD to charge your cast' : 'HOLD the mouse or SPACE to charge, RELEASE to cast!';
  else if (state === 'charging') hint = 'RELEASE to cast!';
  else if (state === 'waiting') hint = 'Wait for a bite...';
  else if (state === 'nibble') hint = 'Steady... wait for it...';
  else if (state === 'bite') hint = 'NOW! CLICK!';
  if (hint) {
    const pulse = state === 'bite' ? (Math.sin(t * 20) > 0 ? '#ffe650' : '#ff6a5a') : '#e8e4ff';
    text(hint, W / 2, H - 150, state === 'bite' ? 24 : 12, pulse, 'center');
  }
  // power meter
  if (state === 'charging') {
    const x = HANDS.x * S - 70, y = HANDS.y * S - 230;
    panel(x - 12, y - 12, 48, 184, '#120e22', '#3a2f63');
    ctx.fillStyle = '#0a0812'; ctx.fillRect(x, y, 24, 160);
    const g = ctx.createLinearGradient(0, y + 160, 0, y);
    g.addColorStop(0, '#4aa8ff'); g.addColorStop(0.6, '#6ad06a'); g.addColorStop(1, '#ffcc33');
    ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2 + 156 * (1 - power), 20, 156 * power);
    if (power > 0.9) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 2, y + 2, 20, 156); }
  }
  // "!" over bobber
  if (state === 'bite') {
    const bx2 = bob.x * S, by2 = bob.surf * S - 110 + Math.sin(t * 25) * 6;
    text('!', bx2, by2, 48, '#ffe650', 'center');
  }
}

// ------------------------------------------------------------ minigame UI
function drawFight() {
  const F = fight; if (!F) return;
  const w = 200, h = 500, bu = bob.x * S;
  const x = clamp(bu > 720 ? bu - 330 : bu + 130, 420, W - w - 16), y = 96;
  const trackX = x + 40, trackY = y + 40, trackW = 72, trackH = h - 80;
  panel(x, y, w, h, '#0e1a2a', '#2a4a6a');
  // water track
  const g = ctx.createLinearGradient(0, trackY, 0, trackY + trackH);
  g.addColorStop(0, '#1a4a7a'); g.addColorStop(1, '#0a1a3a');
  ctx.fillStyle = '#05080f'; ctx.fillRect(trackX - 4, trackY - 4, trackW + 8, trackH + 8);
  ctx.fillStyle = g; ctx.fillRect(trackX, trackY, trackW, trackH);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(trackX + 8, trackY + ((i * 53 + t * 40) % trackH), trackW - 16, 4); }
  // zone
  const zy = trackY + trackH * (1 - F.zonePos - F.zone), zh = trackH * F.zone;
  ctx.fillStyle = F.inZone ? 'rgba(106,224,106,0.75)' : 'rgba(106,224,106,0.45)';
  ctx.fillRect(trackX, zy, trackW, zh);
  ctx.fillStyle = '#c8ffc8'; ctx.fillRect(trackX, zy, trackW, 4); ctx.fillRect(trackX, zy + zh - 4, trackW, 4);
  // fish
  const fy = trackY + trackH * (1 - F.fishPos);
  const im = fimg(hooked);
  if (im) {
    const sc = Math.max(1, Math.floor(56 / Math.max(im.width, im.height * 1.6)));
    const wob = Math.sin(t * 18) * (F.inZone ? 1 : 3);
    sprite(im, trackX + trackW / 2 - im.width * sc / 2 + wob, fy - im.height * sc / 2, sc);
  }
  // progress
  const prX = trackX + trackW + 20, prH = trackH;
  ctx.fillStyle = '#05080f'; ctx.fillRect(prX - 4, trackY - 4, 32, prH + 8);
  ctx.fillStyle = '#1a1a2a'; ctx.fillRect(prX, trackY, 24, prH);
  const pc = F.progress < 0.3 ? '#e85a4a' : F.progress < 0.7 ? '#f0c846' : '#6ae06a';
  ctx.fillStyle = pc; ctx.fillRect(prX, trackY + prH * (1 - F.progress), 24, prH * F.progress);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(prX, trackY + prH * (1 - F.progress), 24, 4);
  text(hooked.tier >= 3 ? RARITY[hooked.tier].name.toUpperCase() + '!' : 'REEL!', x + w / 2, y + 12, 12, RARITY[hooked.tier].color, 'center');
  text(F.perfect ? 'PERFECT' : '', x + w / 2, y + h - 30, 8, '#ffe680', 'center');
  text('HOLD = UP', x + w / 2, y + h + 16, 8, '#c8c0e8', 'center');
}

// ------------------------------------------------------------ overlays
function dim(a = 0.65) { ctx.fillStyle = `rgba(4,2,12,${a})`; ctx.fillRect(0, 0, W, H); hitRegion(0, 0, W, H); }

function drawCard() {
  const c = card; c.t += 1 / 60;
  dim(0.7);
  const f = c.f, rc = RARITY[f.tier].color;
  const pw = 640, ph = 470, x = (W - pw) / 2, y = (H - ph) / 2 - 10;
  // rays for rare+
  if (f.tier >= 2) {
    ctx.save(); ctx.translate(W / 2, y + 180); ctx.rotate(t * 0.3);
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = rgba(rc, 0.08 + 0.02 * f.tier); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -500); ctx.lineTo(40, -500); ctx.fill(); }
    ctx.restore();
  }
  const pop = Math.min(1, c.t * 4);
  const shineX = ((c.t * 900) % 2400) - 600;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop); ctx.translate(-W / 2, -H / 2);
  panel(x, y, pw, ph, '#14102a', shade(rc, -0.35), rc);
  text(f.chest ? 'TREASURE!' : f.junkItem ? 'JUNK...' : c.isNew ? 'NEW SPECIES!' : (c.isRecord ? 'NEW RECORD!' : 'YOU CAUGHT'), W / 2, y + 30, 16, c.isNew || c.isRecord || f.chest ? '#ffe680' : '#c8c0e8', 'center');
  text(f.name.toUpperCase(), W / 2, y + 62, 24, '#ffffff', 'center');
  text(f.junkItem ? (f.chest ? 'LOOT' : 'TRASH') : RARITY[f.tier].name.toUpperCase(), W / 2, y + 96, 12, f.chest ? '#ffcc33' : rc, 'center');
  // fish display w/ bait in its mouth
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 40, y + 124, pw - 80, 190);
  const bob_ = Math.sin(t * 3) * 6;
  const fit = fishFit(f, W / 2, y + 219 + bob_, pw - 140, 160);
  if (fit && !f.junkItem) {
    const bim = IMG['bait_' + (c.bait || 'worm')];
    if (bim) sprite(bim, fit.x + f.mouth[0] * fit.sc - bim.width * fit.sc * 0.45, fit.y + f.mouth[1] * fit.sc - bim.height * fit.sc * 0.4, Math.max(2, Math.floor(fit.sc * 0.8)));
  }
  if (f.chest) text(`+${fmt(c.chestCoins)} coins   +10 ${c.chestBait.name}`, W / 2, y + 334, 12, '#ffd65a', 'center');
  else {
    if (!f.junkItem) text(`${c.size >= 100 ? (c.size / 100).toFixed(2) + ' m' : c.size + ' cm'}`, x + 60, y + 334, 16, '#e8e4ff');
    text(`${fmt(c.value)}c`, x + pw - 60, y + 334, 16, '#ffd65a', 'right');
    if (c.perfect) text('PERFECT +25%', W / 2, y + 326, 8, '#6ae06a', 'center');
    if (c.streak >= 2) text(`STREAK x${c.streak} +${Math.min(c.streak - 1, 10) * 5}%`, W / 2, y + 344, 8, '#ff8a3a', 'center');
  }
  wrap(f.desc, x + 60, y + 372, pw - 120, 12, '#a8a0d0', 22);
  if (f.tier >= 2 || f.chest) {
    ctx.save(); ctx.beginPath(); ctx.rect(x + 12, y + 12, pw - 24, ph - 24); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x + shineX, y); ctx.lineTo(x + shineX + 80, y); ctx.lineTo(x + shineX - 120, y + ph); ctx.lineTo(x + shineX - 200, y + ph); ctx.fill(); ctx.restore();
  }
  text('CLICK TO CONTINUE', W / 2, y + ph - 34, 8, Math.sin(t * 4) > 0 ? '#ffffff' : '#8a84b0', 'center');
  ctx.restore();
  if (UI.click) { UI.click = null; closeCard(); }
}

function openShop() {
  overlay = 'shop'; shopTab = 'rods';
  keeperLine = pick(lake().keeper.hello); keeperT = 0;
  Sound.playSong(SONGS['shop_' + save.lake]);
}
function say(kind) { keeperLine = pick(lake().keeper[kind]); keeperT = 0; }
function drawShop() {
  const l = lake();
  dim(0.75);
  const x = 60, y = 50, w = W - 120, h = H - 100;
  panel(x, y, w, h, l.panel, shade(l.accent, -0.4), l.accent);
  // keeper area
  const kx = x + 40, ky = y + 70;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(kx - 10, ky + 40, 280, 420);
  const kim = IMG['keeper_' + l.id];
  const breathe = Math.round(Math.sin(t * 2) * 2);
  sprite(kim, kx + 20, ky + 140 + breathe, 5);
  // counter
  ctx.fillStyle = '#3a2414'; ctx.fillRect(kx - 10, ky + 380, 280, 80); ctx.fillStyle = '#6b4226'; ctx.fillRect(kx - 10, ky + 380, 280, 12);
  ctx.fillStyle = '#9a6a3e'; ctx.fillRect(kx - 10, ky + 380, 280, 4);
  text(l.keeper.name.toUpperCase(), kx + 130, ky + 408, 12, l.accent, 'center');
  text(l.keeper.title, kx + 130, ky + 430, 8, '#c8c0e8', 'center');
  // speech bubble with typewriter
  keeperT += 1 / 60;
  const shown = keeperLine.slice(0, Math.floor(keeperT * 40));
  ctx.fillStyle = '#f2f0e8'; ctx.fillRect(kx - 10, ky - 10, 290, 130);
  ctx.fillStyle = '#16101e'; ctx.fillRect(kx - 10, ky - 10, 290, 4); ctx.fillRect(kx - 10, ky + 116, 290, 4);
  ctx.fillRect(kx - 10, ky - 10, 4, 130); ctx.fillRect(kx + 276, ky - 10, 4, 130);
  ctx.fillStyle = '#f2f0e8'; ctx.fillRect(kx + 120, ky + 120, 20, 12); ctx.fillRect(kx + 126, ky + 132, 8, 8);
  ctx.font = fontOf(12);
  const words = shown.split(' '); let line = '', yy = ky + 10;
  words.forEach(wd => { const tst = line ? line + ' ' + wd : wd; if (ctx.measureText(tst).width > 250 && line) { text(line, kx + 6, yy, 12, '#16101e', 'left', false); line = wd; yy += 22; } else line = tst; });
  if (line) text(line, kx + 6, yy, 12, '#16101e', 'left', false);
  // tabs
  const tx = x + 360, ty = y + 30;
  [['rods', 'RODS'], ['bait', 'BAIT'], ['jobs', 'JOBS'], ['style', 'STYLE'], ['sell', 'SELL']].forEach(([id, label], i) => {
    const active = shopTab === id;
    const done = id === 'jobs' && jobs().some(j => j.got >= j.n);
    if (button('tab_' + id, tx + i * 116, ty, 110, 56, label, { color: active ? shade(l.accent, -0.35) : (done ? '#2a6a3a' : '#2a2440'), sfx: 'tab', textCol: active ? '#ffffff' : '#a8a0d0', size: 12 })) shopTab = id;
  });
  text(fmt(save.coins) + 'c', tx + 5 * 116 + 6, ty + 22, 12, '#ffd65a');
  if (closeButton(x + w - 80, y + 26)) closeOverlay();
  const lx0 = tx, ly0 = ty + 80, lw = w - 380;
  if (shopTab === 'rods') {
    RODS.filter(r => r.lake === l.id).forEach((r, i) => {
      const ry = ly0 + i * 150;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(lx0, ry, lw, 136);
      sprite(rodIcon(r), lx0 + 16, ry + 22, 5);
      text(r.name, lx0 + 120, ry + 16, 16, '#ffffff');
      text(r.desc, lx0 + 120, ry + 42, 8, '#a8a0d0');
      const stat = (lab, v, max, yy, col) => { text(lab, lx0 + 120, yy, 8, '#c8c0e8'); bar(lx0 + 190, yy - 4, 220, 16, v / max, col); };
      stat('ZONE', r.zone, 0.46, ry + 70, '#6ae06a'); stat('REEL', r.reel, 2.25, ry + 92, '#4aa8ff'); stat('LUCK', r.luck, 0.7, ry + 114, '#ffcc33');
      const owned = save.rods.includes(r.id), eq = save.rod === r.id;
      const bx = lx0 + lw - 210, by = ry + 40;
      if (eq) button('r' + r.id, bx, by, 190, 60, 'EQUIPPED', { disabled: true });
      else if (owned) { if (button('r' + r.id, bx, by, 190, 60, 'EQUIP', { color: '#2a5a8a' })) { save.rod = r.id; store(); toast(`Equipped ${r.name}`, '#a8f0ff'); } }
      else if (button('r' + r.id, bx, by, 190, 60, fmt(r.price) + 'c', { color: save.coins >= r.price ? '#3a7a3a' : '#5a3a3a', sfx: 'buy', disabled: save.coins < r.price, onDisabled: () => say('poor') })) {
        save.coins -= r.price; save.rods.push(r.id); save.rod = r.id; store(); say('buy'); toast(`Bought ${r.name}!`, '#6ae06a'); checkAwards();
      }
    });
  } else if (shopTab === 'bait') {
    BAITS.filter(b => b.lake === l.id).forEach((b, i) => {
      const ry = ly0 + i * 150;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(lx0, ry, lw, 136);
      sprite(IMG['bait_' + b.id], lx0 + 20, ry + 30, 7);
      text(b.name, lx0 + 120, ry + 16, 16, '#ffffff');
      text(b.desc, lx0 + 120, ry + 42, 8, '#a8a0d0');
      const likers = FISH.filter(f => f.likes.includes(b.id) || f.needs === b.id);
      text('Loved by: ' + likers.map(f => save.dex[f.id] ? f.name : '???').slice(0, 4).join(', '), lx0 + 120, ry + 66, 8, '#c8c0e8');
      text(`Bite speed +${Math.round((1 - b.bite) * 100)}%   Luck +${Math.round(b.luck * 100)}%`, lx0 + 120, ry + 90, 8, '#ffe680');
      const have = b.pack ? (save.baits[b.id] || 0) : Infinity;
      text(b.pack ? `Owned: ${have}` : 'Owned: unlimited', lx0 + 120, ry + 112, 8, '#e8e4ff');
      const bx = lx0 + lw - 210;
      if (b.pack && button('b' + b.id, bx, ry + 14, 190, 52, `x10 ${fmt(b.price)}c`, { color: save.coins >= b.price ? '#3a7a3a' : '#5a3a3a', sfx: 'buy', disabled: save.coins < b.price, size: 12, onDisabled: () => say('poor') })) {
        save.coins -= b.price; save.baits[b.id] = (save.baits[b.id] || 0) + b.pack; store(); say('buy');
      }
      const eq = save.bait === b.id;
      if (button('e' + b.id, bx, ry + 74, 190, 52, eq ? 'EQUIPPED' : 'EQUIP', { color: '#2a5a8a', disabled: eq || have <= 0, size: 12 })) { save.bait = b.id; store(); }
    });
  } else if (shopTab === 'jobs') {
    drawJobs(lx0, ly0, lw);
  } else if (shopTab === 'style') {
    drawStyle(lx0, ly0, lw);
  } else {
    const groups = {};
    save.bucket.forEach(b => { (groups[b.id] = groups[b.id] || { n: 0, v: 0 }); groups[b.id].n++; groups[b.id].v += b.value; });
    const ids = Object.keys(groups);
    const total = save.bucket.reduce((a, b) => a + b.value, 0);
    if (!ids.length) text('Your bucket is empty. Go catch something!', lx0 + lw / 2, ly0 + 160, 12, '#a8a0d0', 'center');
    ids.slice(0, 12).forEach((id, i) => {
      const f = anyItem(id), cx = lx0 + (i % 3) * (lw / 3), cy = ly0 + Math.floor(i / 3) * 84;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx, cy, lw / 3 - 10, 74);
      fishFit(f, cx + 50, cy + 37, 80, 56);
      text(`x${groups[id].n}`, cx + 104, cy + 14, 12, RARITY[f.tier].color);
      text(`${fmt(groups[id].v)}c`, cx + 104, cy + 42, 12, '#ffd65a');
    });
    if (ids.length > 12) text(`+ ${ids.length - 12} more kinds`, lx0, ly0 + 340, 8, '#a8a0d0');
    if (button('sellall', lx0 + lw / 2 - 180, y + h - 110, 360, 72, `SELL ALL  ${fmt(total)}c`, { color: '#8a6a1a', disabled: !total, sfx: 'sell' })) {
      save.coins += total; save.bucket = []; store(); say('sell'); toast(`+${fmt(total)} coins!`, '#ffd65a'); checkAwards();
    }
  }
}

function drawGear() {
  const l = lake();
  dim(0.75);
  const x = 140, y = 60, w = W - 280, h = H - 120;
  panel(x, y, w, h, l.panel, shade(l.accent, -0.4), l.accent);
  text('YOUR GEAR', x + 40, y + 36, 24, l.accent);
  if (closeButton(x + w - 80, y + 26)) closeOverlay();
  text('RODS', x + 40, y + 96, 12, '#c8c0e8');
  save.rods.map(id => byId(RODS, id)).filter(Boolean).forEach((r, i) => {
    const bx = x + 40 + (i % 6) * 146, by = y + 120 + Math.floor(i / 6) * 120;
    const eq = save.rod === r.id;
    ctx.fillStyle = eq ? rgba(l.accent, 0.25) : 'rgba(0,0,0,0.3)'; ctx.fillRect(bx, by, 136, 110);
    sprite(rodIcon(r), bx + 41, by + 8, 3);
    ctx.font = fontOf(8);
    text(r.name.length > 14 ? r.name.slice(0, 13) + '.' : r.name, bx + 68, by + 68, 8, '#ffffff', 'center');
    hitRegion(bx, by, 136, 110);
    if (eq) text('EQUIPPED', bx + 68, by + 88, 8, l.accent, 'center');
    if (UI.click && inRect(UI.click.x, UI.click.y, bx, by, 136, 110)) { UI.click = null; save.rod = r.id; store(); Sound.play('click'); }
  });
  const by0 = y + 120 + Math.ceil(save.rods.length / 6) * 120 + 20;
  text('BAIT', x + 40, by0, 12, '#c8c0e8');
  BAITS.filter(b => !b.pack || save.baits[b.id] > 0).forEach((b, i) => {
    const bx = x + 40 + (i % 6) * 146, by = by0 + 24 + Math.floor(i / 6) * 120;
    const eq = save.bait === b.id;
    ctx.fillStyle = eq ? rgba(l.accent, 0.25) : 'rgba(0,0,0,0.3)'; ctx.fillRect(bx, by, 136, 110);
    sprite(IMG['bait_' + b.id], bx + 38, by + 6, 6);
    text(b.name, bx + 68, by + 72, 8, '#ffffff', 'center');
    text(b.pack ? 'x' + save.baits[b.id] : 'FREE', bx + 68, by + 90, 8, eq ? l.accent : '#a8a0d0', 'center');
    hitRegion(bx, by, 136, 110);
    if (UI.click && inRect(UI.click.x, UI.click.y, bx, by, 136, 110)) { UI.click = null; save.bait = b.id; store(); Sound.play('click'); }
  });
}

function drawMap() {
  dim(0.8);
  const x = 60, y = 40, w = W - 120, h = H - 80;
  panel(x, y, w, h, '#120e22', '#5a4a2a', '#c8a050');
  text('WORLD MAP', x + 40, y + 34, 24, '#ffd890');
  if (closeButton(x + w - 80, y + 26)) closeOverlay();
  const pos = [[150, 420], [380, 260], [610, 430], [840, 250], [1010, 440]];
  // path
  ctx.fillStyle = '#5a4a2a';
  for (let i = 0; i < pos.length - 1; i++) {
    const [ax, ay] = pos[i], [bx, by] = pos[i + 1];
    for (let k = 0; k < 1; k += 0.04) ctx.fillRect(lerp(ax, bx, k) + 60, lerp(ay, by, k) + 50, 8, 8);
  }
  LAKES.forEach((l, i) => {
    const [px0, py0] = pos[i];
    const unlocked = save.unlocked.includes(l.id), here = save.lake === l.id;
    const prev = LAKES[i - 1];
    const ready = !unlocked && prev && save.unlocked.includes(prev.id) && speciesCaught(prev.id) >= l.need;
    const bw = 184, bh = 104;
    ctx.fillStyle = here ? l.accent : '#0a0812'; ctx.fillRect(px0 - 8, py0 - 8, bw + 16, bh + 16);
    ctx.imageSmoothingEnabled = false;
    if (unlocked || ready) ctx.drawImage(IMG['lake_' + l.id], px0, py0, bw, bh);
    else { ctx.filter = 'brightness(0.25) grayscale(1)'; ctx.drawImage(IMG['lake_' + l.id], px0, py0, bw, bh); ctx.filter = 'none'; }
    if (!unlocked) sprite(ICON.lock, px0 + bw / 2 - 16, py0 + bh / 2 - 16, 4);
    text(l.name.toUpperCase(), px0 + bw / 2, py0 + bh + 18, 8, unlocked ? l.accent : '#8a84b0', 'center');
    hitRegion(px0, py0, bw, bh);
    const by = py0 + bh + 40;
    if (unlocked) {
      text(`${speciesCaught(l.id)}/8 species`, px0 + bw / 2, py0 - 26, 8, '#c8c0e8', 'center');
      if (!here && button('go' + l.id, px0 + 22, by, bw - 44, 48, 'TRAVEL', { color: '#2a6a5a', sfx: 'travel', size: 12 })) travel(l.id);
      if (here) text('YOU ARE HERE', px0 + bw / 2, by + 16, 8, l.accent, 'center');
    } else {
      const needTxt = prev ? `${speciesCaught(prev.id)}/${l.need} ${prev.name.split(' ')[0]} species` : '';
      text(needTxt, px0 + bw / 2, py0 - 26, 8, ready ? '#6ae06a' : '#ff8c78', 'center');
      if (button('ul' + l.id, px0 + 2, by, bw - 4, 48, `${fmt(l.cost)}c`, { color: ready && save.coins >= l.cost ? '#7a5a1a' : '#4a3a3a', size: 12, sfx: 'unlock',
        disabled: !ready || save.coins < l.cost, onDisabled: () => toast(!ready ? `Catch ${l.need} species at ${prev.name} first!` : 'Not enough coins!', '#ff8c78') })) {
        save.coins -= l.cost; save.unlocked.push(l.id); store(); award('travel'); checkAwards();
        toast(`${l.name} unlocked!`, l.accent, 3); travel(l.id);
      }
    }
  });
}

function drawDex() {
  dim(0.8);
  const x = 60, y = 40, w = W - 120, h = H - 80;
  panel(x, y, w, h, '#14102a', '#3a5a8a', '#8ab8ff');
  const total = Object.keys(save.dex).length;
  text('FISHDEX', x + 40, y + 34, 24, '#a8d8ff');
  text(`${total}/${FISH.length} discovered   ${fmt(save.caught)} caught`, x + 300, y + 42, 8, '#c8c0e8');
  if (closeButton(x + w - 80, y + 26)) closeOverlay();
  if (button('dlaw', x + 40 + 5 * 184, y + 86, 172, 48, 'AWARDS', { color: dexLake === 'awards' ? '#7a5a1a' : '#2a2440', size: 12, sfx: 'tab' })) dexLake = 'awards';
  if (dexLake === 'awards') { drawAwards(x, y, w, h); }
  LAKES.forEach((l, i) => {
    const open = save.unlocked.includes(l.id);
    if (button('dl' + l.id, x + 40 + i * 184, y + 86, 172, 48, open ? l.name.split(' ')[0].toUpperCase() : '???', { color: dexLake === l.id ? shade(l.accent, -0.4) : '#2a2440', size: 12, sfx: 'tab', disabled: !open })) dexLake = l.id;
  });
  const list = dexLake === 'awards' ? [] : FISH.filter(f => f.lake === dexLake);
  list.forEach((f, i) => {
    const cw = (w - 100) / 4, ch = 210;
    const cx = x + 40 + (i % 4) * (cw + 6), cy = y + 150 + Math.floor(i / 4) * (ch + 12);
    const known = save.dex[f.id];
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = known ? RARITY[f.tier].color : '#3a3450'; ctx.fillRect(cx, cy, cw, 4);
    fishFit(f, cx + cw / 2, cy + 70, cw - 40, 90, !known);
    text(known ? f.name : '???', cx + cw / 2, cy + 128, 8, known ? '#ffffff' : '#6a648a', 'center');
    text(RARITY[f.tier].name, cx + cw / 2, cy + 146, 8, known ? RARITY[f.tier].color : '#4a4468', 'center');
    if (known) {
      text(`Caught ${known.n}   Best ${known.best >= 100 ? (known.best / 100).toFixed(1) + 'm' : known.best + 'cm'}`, cx + cw / 2, cy + 170, 8, '#c8c0e8', 'center');
    } else {
      const hint = f.needs ? `Needs ${byId(BAITS, f.needs).name}` : (f.likes[0] ? `Likes ${byId(BAITS, f.likes[0]).name}` : '');
      text(hint, cx + cw / 2, cy + 170, 8, '#8a84b0', 'center');
    }
  });
}

function travel(id) {
  fadeTo = id; fade = 0.0001;
}
function arrive(id) {
  save.lake = id; store();
  overlay = null; initAmbient(); particles = []; ripples = []; jumpers = [];
  setState('idle'); bob.inWater = false;
  banner = { l: lake(), t: 0 };
  Sound.playSong(SONGS[id]);
  rollWeather(true); shadows = []; meteors = [];
}


// ------------------------------------------------------------ streak
let streak = 0;
function breakStreak() { if (streak >= 3) toast(`Streak lost (x${streak})`, '#ff8c78', 1.6); streak = 0; }

// ------------------------------------------------------------ weather
let weather = { id: 'clear', t: 0, dur: 90 };
let rain = [], flash = 0, nextBolt = 5, meteors = [];
function rollWeather(silent) {
  const opts = LAKE_WEATHER[save.lake] || ['clear'];
  let id = pick(opts); if (id === weather.id && Math.random() < 0.6) id = pick(opts);
  weather = { id, t: 0, dur: id === 'frenzy' ? rand(35, 50) : id === 'clear' ? rand(70, 120) : rand(80, 140) };
  rain = [];
  if (!silent && id !== 'clear') { toast(`${WEATHER[id].name.toUpperCase()}! ${WEATHER[id].desc}`, WEATHER[id].col, 4); Sound.play(id === 'frenzy' ? 'buy' : 'whoosh'); }
}
function updateWeather(dt) {
  weather.t += dt;
  if (weather.t > weather.dur) rollWeather();
  const id = weather.id;
  const want = { rain: 140, storm: 260, blizzard: 220 }[id] || 0;
  while (rain.length < want) rain.push({ x: rand(-40, LW + 40), y: rand(-LH, LH), s: rand(0.7, 1.3) });
  if (rain.length > want) rain.length = want;
  rain.forEach(d => {
    if (id === 'blizzard') { d.x -= (70 + 40 * d.s) * dt; d.y += (40 + 25 * d.s) * dt + Math.sin(t * 3 + d.s * 9) * 0.3; }
    else { d.x -= 40 * dt; d.y += (190 + 80 * d.s) * dt; }
    if (d.y > LH || d.x < -20) {
      if (id !== 'blizzard' && d.y > HORIZON && Math.random() < 0.25) ripples.push({ x: d.x, y: rand(HORIZON + 4, LH), r: 0.5, life: 0.4, t: 0 });
      d.y = rand(-30, -2); d.x = rand(0, LW + 60);
    }
  });
  if (id === 'storm') { nextBolt -= dt; if (nextBolt <= 0) { nextBolt = rand(4, 11); flash = 1; setTimeout(() => Sound.hiss(1.6, { filter: 'lowpass', freq: 260, sweep: 60, vol: 0.7 }), 300); } }
  flash = Math.max(0, flash - dt * 2.5);
  if ((id === 'meteors' && Math.random() < dt * 1.6) || (Math.random() < dt * 0.03 && save.lake !== 'crystal')) meteors.push({ x: rand(40, LW + 80), y: rand(-10, 30), t: 0, sp: rand(140, 220) });
  meteors.forEach(m => { m.t += dt; m.x -= m.sp * dt; m.y += m.sp * 0.45 * dt; });
  meteors = meteors.filter(m => m.t < 0.9 && m.y < HORIZON - 4);
}
function drawWeather() {
  const id = weather.id;
  meteors.forEach(m => { for (let k = 0; k < 10; k++) { lx.globalAlpha = (1 - k / 10) * (1 - m.t / 0.9); px(m.x + k * 2, m.y - k * 0.9, k < 2 ? '#ffffff' : '#ffb070'); } });
  lx.globalAlpha = 1;
  if (id === 'rain' || id === 'storm') {
    lx.fillStyle = id === 'storm' ? 'rgba(8,8,26,0.32)' : 'rgba(18,26,52,0.18)'; lx.fillRect(0, 0, LW, LH);
    lx.globalAlpha = 0.45; rain.forEach(d => { px(d.x, d.y, '#a8c8ff', 1, 3); }); lx.globalAlpha = 1;
  } else if (id === 'blizzard') {
    lx.fillStyle = 'rgba(220,240,255,0.10)'; lx.fillRect(0, 0, LW, LH);
    rain.forEach(d => { lx.globalAlpha = 0.5 + d.s * 0.3; px(d.x, d.y, '#ffffff', d.s > 1.1 ? 2 : 1, 1); }); lx.globalAlpha = 1;
  } else if (id === 'fog') {
    for (let k = 0; k < 4; k++) {
      const y = HORIZON - 26 + k * 18, x = ((t * (4 + k * 2) + k * 90) % (LW + 200)) - 200;
      lx.globalAlpha = 0.16; lx.fillStyle = '#d8e0e8';
      lx.beginPath(); lx.ellipse(x + 100, y, 150, 9 + k * 2, 0, 0, 6.3); lx.fill();
      lx.beginPath(); lx.ellipse(x + 100 - LW - 200, y, 150, 9 + k * 2, 0, 0, 6.3); lx.fill();
    }
    lx.globalAlpha = 1;
  } else if (id === 'bloom') {
    lx.fillStyle = `rgba(196,108,255,${0.06 + 0.05 * Math.sin(t * 1.5)})`; lx.fillRect(0, 0, LW, LH);
    for (let k = 0; k < 14; k++) { const x = (k * 53 + t * 9) % LW, y = HORIZON + 6 + (k * 29) % 70; if (Math.sin(t * 3 + k) > 0.6) px(x, y, '#ffffff'); }
  } else if (id === 'frenzy') {
    for (let k = 0; k < 20; k++) { const x = 110 + (k * 47) % 200, y = HORIZON + 8 + (k * 17) % 70; if (Math.sin(t * 4 + k * 1.3) > 0.7) { px(x, y, '#ffcc33'); px(x + 1, y, '#ffe680'); } }
  }
  if (flash > 0) { lx.fillStyle = `rgba(230,235,255,${flash * 0.6})`; lx.fillRect(0, 0, LW, LH); }
}

// ------------------------------------------------------------ clouds + passing shadows
const cloudCv = document.createElement('canvas'); cloudCv.width = LW * 2; cloudCv.height = 70;
(() => {
  const c = cloudCv.getContext('2d');
  for (let k = 0; k < 16; k++) {
    const cx = (k * 47 + (k % 3) * 13) % (LW * 2), cy = 20 + (k * 17) % 34, rw = 18 + (k * 11) % 26, rh = 5 + (k * 7) % 6;
    for (let y = -rh; y <= rh; y++) for (let x = -rw; x <= rw; x++) {
      const d = (x / rw) ** 2 + (y / rh) ** 2;
      const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][(cy + y + 64) % 4][(cx + x + 64) % 4] / 16;
      if (d < 1 && bayer < (1 - d) * 1.6) { c.fillStyle = y < 0 ? '#ffffff' : '#c8c8e0'; c.fillRect((cx + x + LW * 2) % (LW * 2), cy + y, 1, 1); }
    }
  }
})();
let shadows = [];
function updateShadows(dt) {
  if (Math.random() < dt * 0.05 && shadows.length < 2) shadows.push({ x: Math.random() < 0.5 ? LW + 30 : 80, y: rand(HORIZON + 22, LH - 12), dir: 0, big: rand(10, 22), t: 0 });
  shadows.forEach(sh => { if (!sh.dir) sh.dir = sh.x > LW ? -1 : 1; sh.x += sh.dir * 14 * dt; sh.t += dt; });
  shadows = shadows.filter(sh => sh.x > 60 && sh.x < LW + 60);
}
function drawShadows() {
  shadows.forEach(sh => {
    const a = Math.min(1, sh.t / 2) * 0.16;
    lx.globalAlpha = a; lx.fillStyle = '#000008';
    lx.beginPath(); lx.ellipse(sh.x, sh.y, sh.big, sh.big * 0.22, 0, 0, 6.3); lx.fill();
    lx.beginPath(); lx.moveTo(sh.x - sh.dir * sh.big, sh.y); lx.lineTo(sh.x - sh.dir * (sh.big + 7), sh.y - 3 + Math.sin(t * 6) * 1.5); lx.lineTo(sh.x - sh.dir * (sh.big + 7), sh.y + 3 + Math.sin(t * 6) * 1.5); lx.fill();
    lx.globalAlpha = 1;
  });
}

// ------------------------------------------------------------ fisher with hat
function drawFisher() {
  const fx = 78, fy = 119;
  lx.drawImage(IMG.fisher_base, fx, fy);
  if (Math.floor(t * 10) % 47 === 0) px(fx + 8, fy + 5, '#f0c8a0');
  const h = IMG['hat_' + save.hat];
  if (h && h.width) lx.drawImage(h, fx, fy + 5 - h.height + (save.hat === 'halo' ? -1 + Math.round(Math.sin(t * 2)) : 0));
}

// ------------------------------------------------------------ jobs
function genJob(lakeId) {
  const li = Math.max(0, LAKES.findIndex(l => l.id === lakeId)), pool = FISH.filter(f => f.lake === lakeId);
  const mult = [1, 3, 10, 30, 100][li], r = Math.random();
  if (r < 0.4) { const f = pick(pool.filter(f => f.tier <= 1)); const n = 2 + Math.floor(Math.random() * 3); return { type: 'species', fish: f.id, n, got: 0, reward: Math.round(f.value * n * 1.8) }; }
  if (r < 0.62) { const tier = Math.random() < 0.75 ? 2 : 3; return { type: 'tier', tier, n: 1, got: 0, reward: Math.round((tier === 2 ? 150 : 700) * mult) }; }
  if (r < 0.82) { const f = pick(pool.filter(f => f.tier <= 2)); return { type: 'size', fish: f.id, size: Math.round(lerp(f.size[0], f.size[1], 0.65)), n: 1, got: 0, reward: Math.round(f.value * 5) }; }
  const n = 5 + Math.floor(Math.random() * 6); return { type: 'count', n, got: 0, reward: Math.round(18 * n * mult) };
}
function jobs() { const l = save.lake; if (!save.jobs[l]) save.jobs[l] = [genJob(l), genJob(l), genJob(l)]; return save.jobs[l]; }
function jobText(j) {
  const f = j.fish && byId(FISH, j.fish), nm = f ? (save.dex[f.id] ? f.name : '???') : '';
  if (j.type === 'species') return `Catch ${j.n} ${nm}`;
  if (j.type === 'tier') return `Catch a ${RARITY[j.tier].name} fish or better`;
  if (j.type === 'size') return `Catch a ${nm} over ${j.size >= 100 ? (j.size / 100).toFixed(1) + 'm' : j.size + 'cm'}`;
  return `Catch ${j.n} fish here`;
}
function progressJobs(f, size) {
  jobs().forEach(j => {
    if (j.got >= j.n) return;
    if ((j.type === 'species' && j.fish === f.id) || (j.type === 'tier' && f.tier >= j.tier) || (j.type === 'size' && j.fish === f.id && size >= j.size) || j.type === 'count') {
      j.got++; if (j.got >= j.n) setTimeout(() => toast(`JOB DONE: ${jobText(j)}`, '#6ae06a', 3), 1200);
    }
  });
}
function drawJobs(x0, y0, w) {
  const l = lake();
  text(`${l.keeper.name} has some work for you:`, x0, y0 - 4, 8, '#c8c0e8');
  jobs().forEach((j, i) => {
    const y = y0 + 20 + i * 140;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0, y, w, 126);
    const f = j.fish && byId(FISH, j.fish);
    if (f) fishFit(f, x0 + 70, y + 60, 110, 80, !save.dex[f.id]); else sprite(ICON.star, x0 + 42, y + 34, 8);
    text(jobText(j), x0 + 150, y + 22, 12, '#ffffff');
    bar(x0 + 150, y + 54, 300, 20, j.got / j.n, j.got >= j.n ? '#6ae06a' : l.accent);
    text(`${j.got}/${j.n}`, x0 + 466, y + 58, 12, '#e8e4ff');
    text(`Reward: ${fmt(j.reward)}c`, x0 + 150, y + 90, 12, '#ffd65a');
    const done = j.got >= j.n;
    if (button('job' + i, x0 + w - 200, y + 34, 180, 60, done ? 'CLAIM' : 'WORKING', { color: done ? '#3a8a3a' : '#3a3a4a', disabled: !done, sfx: 'sell' })) {
      save.coins += j.reward; save.jobsDone++; toast(`+${fmt(j.reward)} coins!`, '#ffd65a'); say('sell');
      jobs()[i] = genJob(save.lake); store(); if (save.jobsDone >= 5) award('jobs5'); checkAwards();
    }
  });
  text(`Jobs finished: ${save.jobsDone}`, x0, y0 + 452, 8, '#a8a0d0');
}

// ------------------------------------------------------------ cosmetics shop
function bobberPreview(sk, x, y, sc) {
  const rows = sk.duck ? ['...oo..', '..orRo.', '..orroW', 'oorrro.', 'orrrrro', '.ooooo.'] : ['..o..', '.ooo.', 'orrro', 'oRrro', 'owwwo', 'oWwwo', '.ooo.', '..o..'];
  if (sk.glow) { ctx.fillStyle = rgba(sk.glow, 0.25); ctx.fillRect(x - sc * 2, y - sc * 2, (rows[0].length + 4) * sc, (rows.length + 4) * sc); }
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { ctx.fillStyle = sk.pal[ch]; ctx.fillRect(x + i * sc, y + j * sc, sc, sc); } }));
}
function drawStyle(x0, y0, w) {
  text('HATS', x0, y0 - 4, 12, '#c8c0e8');
  const hats = HATS.filter(h => !h.secret || save.hats.includes(h.id));
  hats.forEach((h, i) => {
    const cx = x0 + (i % 5) * 150, cy = y0 + 16 + Math.floor(i / 5) * 140;
    const own = save.hats.includes(h.id), eq = save.hat === h.id;
    ctx.fillStyle = eq ? rgba(lake().accent, 0.25) : 'rgba(0,0,0,0.3)'; ctx.fillRect(cx, cy, 140, 130);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(IMG.fisher_base, 0, 0, 16, 14, cx + 46, cy + 34, 48, 42);
    const hi = IMG['hat_' + h.id]; if (hi && hi.width) ctx.drawImage(hi, cx + 46, cy + 34 + 15 - hi.height * 3, hi.width * 3, hi.height * 3);
    text(h.name, cx + 70, cy + 84, 8, '#ffffff', 'center');
    text(eq ? 'WEARING' : own ? 'OWNED' : fmt(h.price) + 'c', cx + 70, cy + 106, 8, eq ? lake().accent : own ? '#c8c0e8' : (save.coins >= h.price ? '#ffd65a' : '#a85a5a'), 'center');
    hitRegion(cx, cy, 140, 130);
    if (UI.click && inRect(UI.click.x, UI.click.y, cx, cy, 140, 130)) {
      UI.click = null;
      if (own) { save.hat = h.id; Sound.play('click'); }
      else if (save.coins >= h.price) { save.coins -= h.price; save.hats.push(h.id); save.hat = h.id; Sound.play('buy'); say('buy'); award('fashion'); }
      else { Sound.play('error'); say('poor'); }
      store();
    }
  });
  const by = y0 + 16 + Math.ceil(hats.length / 5) * 140 + 10;
  text('BOBBERS', x0, by, 12, '#c8c0e8');
  BOBBERS.forEach((b, i) => {
    const cx = x0 + i * 125, cy = by + 20;
    const own = save.bobbers.includes(b.id), eq = save.bobber === b.id;
    ctx.fillStyle = eq ? rgba(lake().accent, 0.25) : 'rgba(0,0,0,0.3)'; ctx.fillRect(cx, cy, 116, 120);
    bobberPreview(b, cx + 40, cy + 14, 5);
    text(b.name, cx + 58, cy + 76, 8, '#ffffff', 'center');
    text(eq ? 'USING' : own ? 'OWNED' : fmt(b.price) + 'c', cx + 58, cy + 98, 8, eq ? lake().accent : own ? '#c8c0e8' : (save.coins >= b.price ? '#ffd65a' : '#a85a5a'), 'center');
    hitRegion(cx, cy, 116, 120);
    if (UI.click && inRect(UI.click.x, UI.click.y, cx, cy, 116, 120)) {
      UI.click = null;
      if (own) { save.bobber = b.id; Sound.play('click'); }
      else if (save.coins >= b.price) { save.coins -= b.price; save.bobbers.push(b.id); save.bobber = b.id; Sound.play('buy'); say('buy'); award('fashion'); }
      else { Sound.play('error'); say('poor'); }
      store();
    }
  });
}

// ------------------------------------------------------------ awards
function award(id) {
  if (save.awards[id]) return;
  const a = byId(AWARDS, id); if (!a) return;
  save.awards[id] = 1; save.coins += a.reward; store();
  setTimeout(() => { toast(`AWARD: ${a.name}!  +${fmt(a.reward)}c`, '#ffe680', 4); Sound.play('unlock'); }, 900);
}
function checkAwards() {
  if (save.caught >= 1) award('first'); if (save.caught >= 10) award('ten'); if (save.caught >= 100) award('hundred'); if (save.caught >= 500) award('fivehund');
  if (save.perfects >= 10) award('perfect10');
  if (LAKES.some(l => speciesCaught(l.id) >= 8)) award('complete1');
  if (Object.keys(save.dex).length >= FISH.length) award('dex40');
  if (save.unlocked.length >= 5) award('allLakes');
  if (save.coins >= 10000) award('rich'); if (save.coins >= 250000) award('tycoon');
}
function drawAwards(x, y, w, h) {
  const got = AWARDS.filter(a => save.awards[a.id]).length;
  text(`${got}/${AWARDS.length} AWARDS`, x + w - 120, y + 44, 8, '#ffe680', 'right');
  AWARDS.forEach((a, i) => {
    const cw = (w - 100) / 3, cx = x + 40 + (i % 3) * (cw + 10), cy = y + 150 + Math.floor(i / 3) * 58;
    const ok = save.awards[a.id];
    ctx.fillStyle = ok ? 'rgba(255,204,51,0.15)' : 'rgba(0,0,0,0.35)'; ctx.fillRect(cx, cy, cw, 52);
    ctx.globalAlpha = ok ? 1 : 0.35; sprite(ICON.star, cx + 10, cy + 10, 4); ctx.globalAlpha = 1;
    text(a.name, cx + 50, cy + 10, 8, ok ? '#ffe680' : '#8a84b0');
    text(a.desc, cx + 50, cy + 28, 8, ok ? '#e8e4ff' : '#6a648a');
    text(`+${fmt(a.reward)}`, cx + cw - 10, cy + 10, 8, ok ? '#6ae06a' : '#6a648a', 'right');
  });
}

// ------------------------------------------------------------ aquarium
let tankFish = [], bubbles = [], tankHover = null;
function openTank() {
  overlay = 'tank';
  const caught = FISH.filter(f => save.dex[f.id]);
  tankFish = caught.map(f => ({ f, x: rand(140, 1080), y: rand(200, 520), vx: rand(20, 60) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, 6), dart: 0 }));
  bubbles = [];
  Sound.play('splash', 0.5);
}
function drawTank() {
  dim(0.85);
  const x = 60, y = 40, w = W - 120, h = H - 80;
  panel(x, y, w, h, '#0a1a2a', '#2a6a8a', '#8ad8ff');
  text('AQUARIUM', x + 40, y + 34, 24, '#8ad8ff');
  text(`${tankFish.length}/${FISH.length} species`, x + 300, y + 42, 8, '#c8c0e8');
  if (closeButton(x + w - 80, y + 26)) closeOverlay();
  const tx = x + 40, ty = y + 96, tw = w - 80, th = h - 136;
  const g = ctx.createLinearGradient(0, ty, 0, ty + th);
  g.addColorStop(0, '#1a6a9a'); g.addColorStop(0.6, '#0e3a6a'); g.addColorStop(1, '#0a2448');
  ctx.fillStyle = g; ctx.fillRect(tx, ty, tw, th);
  // light rays
  ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
  for (let k = 0; k < 6; k++) {
    const rx = tx + 100 + k * 190 + Math.sin(t * 0.3 + k) * 30;
    ctx.fillStyle = 'rgba(200,240,255,0.05)'; ctx.beginPath(); ctx.moveTo(rx, ty); ctx.lineTo(rx + 60, ty); ctx.lineTo(rx + 140, ty + th); ctx.lineTo(rx + 40, ty + th); ctx.fill();
  }
  // sand + rocks + castle + plants
  ctx.fillStyle = '#c8a870'; ctx.fillRect(tx, ty + th - 40, tw, 40);
  ctx.fillStyle = '#a88a58'; for (let k = 0; k < 60; k++) ctx.fillRect(tx + (k * 37) % tw, ty + th - 36 + (k * 13) % 30, 8, 4);
  ctx.fillStyle = '#5a5a6a'; ctx.fillRect(tx + tw - 230, ty + th - 140, 120, 100); ctx.fillRect(tx + tw - 250, ty + th - 180, 40, 140); ctx.fillRect(tx + tw - 130, ty + th - 180, 40, 140);
  ctx.fillStyle = '#3a3a4a'; ctx.fillRect(tx + tw - 190, ty + th - 90, 40, 50);
  for (let k = 0; k < 5; k++) { ctx.fillStyle = '#5a5a6a'; ctx.fillRect(tx + tw - 250 + k * 8 * (k % 2), ty + th - 192, 8, 12); ctx.fillRect(tx + tw - 130 + k * 8 * (k % 2), ty + th - 192, 8, 12); }
  for (let k = 0; k < 9; k++) {
    const px0 = tx + 40 + k * 120 + (k % 2) * 30, hh = 60 + (k * 23) % 80;
    for (let s2 = 0; s2 < hh; s2 += 8) { const sway = Math.sin(t * 1.4 + k + s2 * 0.05) * (s2 / hh) * 12; ctx.fillStyle = s2 % 16 ? '#2a8a4a' : '#3aa85a'; ctx.fillRect(px0 + sway, ty + th - 40 - s2, 10, 8); }
  }
  // bubbles
  if (Math.random() < 0.3) bubbles.push({ x: tx + tw - 170 + rand(-10, 10), y: ty + th - 90, r: rand(3, 7) });
  if (Math.random() < 0.1) bubbles.push({ x: rand(tx, tx + tw), y: ty + th - 40, r: rand(2, 5) });
  bubbles.forEach(b => { b.y -= 60 / 60 * (1 + b.r * 0.2); b.x += Math.sin(t * 3 + b.r) * 0.4; ctx.strokeStyle = 'rgba(220,240,255,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); });
  bubbles = bubbles.filter(b => b.y > ty + 6);
  // fish
  tankHover = null;
  tankFish.forEach(o => {
    o.ph += 1 / 60;
    const sp = o.dart > 0 ? 4 : 1; o.dart = Math.max(0, o.dart - 1 / 60);
    o.x += o.vx / 60 * sp; o.y += Math.sin(o.ph * 1.3) * 0.4;
    if (o.x < tx + 60 || o.x > tx + tw - 60) { o.vx *= -1; o.x = clamp(o.x, tx + 60, tx + tw - 60); }
    const im = fimg(o.f); if (!im) return;
    const sc = im.width > 46 ? 2 : 3;
    const fw = im.width * sc, fh = im.height * sc, bob = Math.sin(o.ph * 2) * 3;
    ctx.save(); ctx.translate(o.x, o.y + bob);
    if (o.vx > 0) ctx.scale(-1, 1);
    ctx.drawImage(im, -fw / 2, -fh / 2, fw, fh); ctx.restore();
    if (inRect(UI.mx, UI.my, o.x - fw / 2, o.y - fh / 2, fw, fh)) tankHover = o;
    if (UI.click && inRect(UI.click.x, UI.click.y, o.x - fw / 2, o.y - fh / 2, fw, fh)) { UI.click = null; o.dart = 0.6; o.vx *= -1; Sound.play('plop'); }
  });
  ctx.restore();
  hitRegion(tx, ty, tw, th);
  if (!tankFish.length) text('Catch some fish and they will swim here!', W / 2, ty + th / 2 - 20, 12, '#c8e8ff', 'center');
  if (tankHover) {
    const f = tankHover.f, d = save.dex[f.id];
    ctx.font = fontOf(12);
    const label = `${f.name}  -  best ${d.best >= 100 ? (d.best / 100).toFixed(1) + 'm' : d.best + 'cm'}`;
    const lw2 = ctx.measureText(label).width + 24;
    ctx.fillStyle = 'rgba(5,4,14,0.85)'; ctx.fillRect(UI.mx + 14, UI.my - 34, lw2, 30);
    text(label, UI.mx + 26, UI.my - 26, 12, RARITY[f.tier].color);
  }
  // glass shine
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(tx + 20, ty, 30, th); ctx.fillRect(tx + 60, ty, 10, th);
}

// ------------------------------------------------------------ vignette
let vignette = null;
function drawVignette() {
  if (!vignette) { vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,10,0.45)'); }
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------ title
function drawTitle() {
  ctx.fillStyle = 'rgba(4,2,12,0.35)'; ctx.fillRect(0, 0, W, H);
  const title = 'FISHING', sub = 'SIMULATOR';
  bigTitle(title, W / 2, 140, 96, '#fff4c2', '#f5b40b');
  text(sub, W / 2, 250, 32, '#a8d8ff', 'center');
  if (Math.random() < 0.03) jumpers.push({ x: rand(140, 290), y: rand(HORIZON + 10, 150), t: 0, dur: 0.8, fish: pick(FISH.filter(f => f.lake === save.lake)), big: true });
  text('by Cnatt', W / 2, 306, 12, '#c8c0e8', 'center');
  if (Math.sin(t * 4) > -0.3) text('CLICK TO START', W / 2, 470, 16, '#ffffff', 'center');
  text('5 lakes - 40 fish - weather - jobs - aquarium - hats', W / 2, 520, 8, '#a8a0d0', 'center');
  if (UI.click) { UI.click = null; startGame(); }
}
function startGame() {
  Sound.init(); Sound.play('click');
  screen = 'play';
  Sound.playSong(SONGS[save.lake]);
  banner = { l: lake(), t: 0 };
  if (!save.secretRod) {
    let found = false; try { found = localStorage.getItem('cnatt_arcade_secret') === 'found'; } catch (e) {}
    if (found) { save.secretRod = true; save.rods.push('sporecaster'); store(); setTimeout(() => { toast('A gift from the arcade: SPORECASTER ROD!', '#ff9ab0', 5); Sound.play('secret'); }, 1500); }
  }
  let found2 = false; try { found2 = localStorage.getItem('cnatt_arcade_secret') === 'found'; } catch (e) {}
  if (found2 && !save.hats.includes('shroom')) { save.hats.push('shroom'); store(); setTimeout(() => toast('Secret MUSHROOM CAP unlocked! (Shop > Style)', '#ff9ab0', 5), 3200); }
  checkAwards();
}

// ------------------------------------------------------------ main loop
let last = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
  // update
  if (screen !== 'loading') {
    if (!overlay || overlay === 'card') {
      if (screen === 'play') updateFishing(dt);
      updateRod(dt); updateBobber(dt); updateRope(dt);
    }
    updateAmbient(dt);
    updateWeather(dt); updateShadows(dt);
  }
  shake = Math.max(0, shake - dt);
  if (fade > 0) {
    fade += dt * (fadeTo ? 2.2 : -2.2);
    if (fadeTo && fade >= 1) { arrive(fadeTo); fadeTo = null; fade = 1; }
    if (!fadeTo && fade <= 0) fade = 0;
  }
  // draw world
  drawWorld();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0, W, H);
  drawVignette();
  // UI
  UI.prevRegions = UI.regions; UI.regions = []; UI.hover = null;
  if (screen === 'title') drawTitle();
  else if (screen === 'play') {
    drawHUD();
    if (state === 'fight') drawFight();
    if (overlay === 'shop') drawShop();
    else if (overlay === 'gear') drawGear();
    else if (overlay === 'map') drawMap();
    else if (overlay === 'dex') drawDex();
    else if (overlay === 'card') drawCard();
    else if (overlay === 'tank') drawTank();
  }
  if (UI.hover && UI.hover !== UI.lastHover) Sound.play('hover');
  UI.lastHover = UI.hover;
  // banner
  if (banner) {
    banner.t += dt;
    const a = banner.t < 0.5 ? banner.t / 0.5 : banner.t > 3 ? Math.max(0, 1 - (banner.t - 3) / 0.6) : 1;
    if (a <= 0) banner = null;
    else {
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(4,2,12,0.6)'; ctx.fillRect(0, 230, W, 120);
      ctx.fillStyle = banner.l.accent; ctx.fillRect(0, 230, W, 4); ctx.fillRect(0, 346, W, 4);
      text(banner.l.name.toUpperCase(), W / 2 + (1 - a) * 60, 254, 32, banner.l.accent, 'center');
      text(banner.l.tagline, W / 2, 308, 12, '#e8e4ff', 'center');
      ctx.globalAlpha = 1;
    }
  }
  // toasts
  toasts.forEach((m, i) => {
    m.t += dt;
    const a = m.t < 0.2 ? m.t / 0.2 : m.t > m.dur - 0.4 ? Math.max(0, (m.dur - m.t) / 0.4) : 1;
    ctx.globalAlpha = a;
    ctx.font = fontOf(12);
    const tw = ctx.measureText(m.text).width + 40;
    const y = 100 + i * 44;
    ctx.fillStyle = 'rgba(8,6,20,0.85)'; ctx.fillRect(W / 2 - tw / 2, y, tw, 34);
    ctx.fillStyle = m.col; ctx.fillRect(W / 2 - tw / 2, y, 4, 34);
    text(m.text, W / 2, y + 11, 12, m.col, 'center');
    ctx.globalAlpha = 1;
  });
  toasts = toasts.filter(m => m.t < m.dur);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(fade, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
  UI.click = null;
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ boot
ctx.fillStyle = '#07061a'; ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#fff'; ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.fillText('Loading...', W / 2, H / 2);
const fontReady = document.fonts ? Promise.race([Promise.all([document.fonts.load(fontOf(16)), document.fonts.load(fontOf(30))]), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
Promise.all([...loading, fontReady]).then(() => {
  load();
  coinShown = save.coins;
  initAmbient();
  const tip = rodTip(); bob.x = tip.x; bob.y = tip.y + 14;
  screen = 'title';
  requestAnimationFrame(n => { last = n; frame(n); });
});

// debug/test hooks
window.__fish = {
  get state() { return state; }, get screen() { return screen; }, get overlay() { return overlay; },
  set overlay(v) { overlay = v; }, save: () => save, setSave(s) { save = Object.assign(fresh(), s); store(); },
  start: startGame, forceBite() { biteAt = 0; nextNibble = 0; nibbles = 1; stateT = 99; },
  winFight() { if (fight) fight.progress = 2; }, travel: arrive, openShop, setTab(tb) { shopTab = tb; },
  setWeather(id) { weather = { id, t: 0, dur: 999 }; }, openTank, setDexTab(d) { dexLake = d; }, hookJunk(id) { hooked = JUNK.find(j => j.id === id); },
};

// ------------------------------------------------------------ owner cheats (only shown for the site admin, see account/cheats.js)
window.__cheats = [
  { name: '+10,000 coins', icon: '💰', run() { save.coins += 10000; store(); } },
  { name: 'Unlock every lake, rod, hat and bobber', icon: '🔓', run() { save.unlocked = LAKES.map(l => l.id); save.rods = RODS.map(r => r.id); save.hats = HATS.map(h => h.id); save.bobbers = BOBBERS.map(b => b.id); store(); } },
  { name: 'Instant bite', icon: '🎣', run() { biteAt = 0; nextNibble = 0; nibbles = 1; stateT = 99; } },
  { name: 'Win the fight', icon: '💪', run() { if (fight) fight.progress = 2; } },
];

})();
