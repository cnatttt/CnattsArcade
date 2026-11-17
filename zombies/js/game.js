// =====================================================================
//  NIGHTFALL HORDE - zombie wave survival
//  WASD / arrows move. Weapons fire on their own.
//  After every wave pick 1 of 3 upgrades. Survive 30 waves.
// =====================================================================
(() => {
'use strict';
const W = 1280, H = 720, S = 2, VW = 640, VH = 360, WORLD = 1600;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const lo = document.createElement('canvas'); lo.width = VW; lo.height = VH;
const lx = lo.getContext('2d');
const dark = document.createElement('canvas'); dark.width = VW; dark.height = VH;
const dx_ = dark.getContext('2d');
const FONT = '"Press Start 2P", monospace';

// ------------------------------------------------------------ helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.floor(n).toLocaleString('en-US');
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex(h) { if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number); h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(h, a) { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, f) { const c = hex(h); const k = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255); return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`; }
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------ sprites
const SPR = {};
function buildSprite(rows, pal, tint, flip) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    let col = pal[ch]; if (!col) return;
    if (tint && ch !== 'o' && ch !== 'e') { const a = hex(col), b = hex(tint); col = `rgb(${(a[0] + b[0] * 2) / 3 | 0},${(a[1] + b[1] * 2) / 3 | 0},${(a[2] + b[2] * 2) / 3 | 0})`; }
    x.fillStyle = col; x.fillRect(flip ? w - 1 - i : i, j, 1, 1);
  }));
  return c;
}
function whiteOf(c) { const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; const x = n.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, n.width, n.height); return n; }
// returns { n: normal, f: flipped, w: white, wf: white flipped }
function sprite(name, tint, palOver) {
  const k = name + (tint || '') + (palOver ? JSON.stringify(palOver) : '');
  if (!SPR[k]) {
    const d = SPR_DEF[name], pal = palOver ? Object.assign({}, d.pal, palOver) : d.pal;
    const n = buildSprite(d.rows, pal, tint, false), f = buildSprite(d.rows, pal, tint, true);
    SPR[k] = { n, f, w: whiteOf(n), wf: whiteOf(f), width: n.width, height: n.height };
  }
  return SPR[k];
}
const ICONS = {};
function icon(id, kind) {
  const D = kind === 'weapon' ? WEAPONS[id] : kind === 'passive' ? PASSIVES[id] : null;
  const key = kind + id;
  if (!ICONS[key]) {
    const shape = D ? ICON_SHAPES[D.icon] : ICON_SHAPES[id];
    const col = D ? D.col : kind === 'gold' ? ['#f2c14e', '#fff3c4', '#a07a20'] : kind === 'misc' ? ['#e8e4d8', '#ffffff', '#8a8478'] : ['#e8a040', '#ffe0a0', '#8a4a1a'];
    ICONS[key] = buildSprite(shape, { o: '#0a0610', a: col[0], b: col[1], c: col[2] });
  }
  return ICONS[key];
}
let shadowImg = null;
function shadow(w) {
  if (!shadowImg) { shadowImg = document.createElement('canvas'); shadowImg.width = 16; shadowImg.height = 6; const x = shadowImg.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.38)'; x.beginPath(); x.ellipse(8, 3, 8, 3, 0, 0, 6.3); x.fill(); }
  return shadowImg;
}

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_horde';
let save = { coins: 0, shop: {}, chars: { jake: 1 }, char: 'jake', best: 0, bestKills: 0, runs: 0, tutorial: false };
try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) save = Object.assign(save, d); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const shopLv = id => save.shop[id] || 0;

// ------------------------------------------------------------ input
const keys = {};
const mouse = { x: -1, y: -1 };
const UI = { click: null, down: false, px: 0, py: 0, hover: null, lastHover: null };
const stick = { on: false, ox: 0, oy: 0, x: 0, y: 0, id: null };
function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); const [x, y] = toCanvas(e); mouse.x = x; mouse.y = y; UI.down = true; UI.px = x; UI.py = y;
  if (state === 'play' && e.pointerType !== 'mouse') { stick.on = true; stick.ox = x; stick.oy = y; stick.x = x; stick.y = y; stick.id = e.pointerId; }
});
cv.addEventListener('pointermove', e => { const [x, y] = toCanvas(e); mouse.x = x; mouse.y = y; if (stick.on && e.pointerId === stick.id) { stick.x = x; stick.y = y; } });
cv.addEventListener('pointerup', e => { const [x, y] = toCanvas(e); UI.down = false; UI.click = { x, y, px: UI.px, py: UI.py }; if (e.pointerId === stick.id) stick.on = false; });
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return; keys[e.code] = true;
  if (state === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) pause();
  else if (state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resume();
  else if (state === 'pick' && pickT > 0.6) { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && cards[i]) choose(i); if (e.code === 'KeyR') reroll(); }
  if (e.code === 'KeyM') Sound.setMusic(!Sound.musicOn);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') pause(); });

// ------------------------------------------------------------ world / ground
let ground = null, gx = null, lamps = [], fires = [], props = [];
function buildGround() {
  const R = seeded(424242);
  ground = document.createElement('canvas'); ground.width = WORLD; ground.height = WORLD;
  gx = ground.getContext('2d');
  const img = gx.createImageData(WORLD, WORLD), D = img.data;
  const grass = ['#1f2d1c', '#23331f', '#1a2718', '#283a23'].map(hex);
  const asph = ['#2a2a31', '#27272d', '#2e2e35', '#25252b'].map(hex);
  const C = WORLD / 2, roadW = 46;
  const isRoadV = x => Math.abs(x - C) < roadW, isRoadH = y => Math.abs(y - C) < roadW;
  const ringR = (x, y) => Math.hypot(x - C, y - C);
  for (let y = 0; y < WORLD; y++) for (let x = 0; x < WORLD; x++) {
    const i = (y * WORLD + x) * 4;
    const n = Math.sin(x * 0.021 + Math.sin(y * 0.017) * 2) + Math.sin(y * 0.023 + Math.sin(x * 0.013) * 2);
    let col = grass[n > 0.9 ? 3 : n > 0 ? 1 : n > -0.9 ? 0 : 2];
    const rr = ringR(x, y);
    if (isRoadV(x) || isRoadH(y) || (rr > 300 && rr < 360)) {
      col = asph[((x >> 2) * 7 + (y >> 2) * 13 + (R() < 0.2 ? 1 : 0)) & 3];
      // sidewalk edges
      const e = Math.min(isRoadV(x) ? roadW - Math.abs(x - C) : 99, isRoadH(y) ? roadW - Math.abs(y - C) : 99, rr > 300 && rr < 360 ? Math.min(rr - 300, 360 - rr) : 99);
      if (e < 5 && !(isRoadV(x) && isRoadH(y))) col = (x + y) % 9 === 0 ? [58, 58, 64] : [74, 74, 82];
    } else if (rr < 150) { // central plaza
      const bx = (x + ((y >> 3) & 1) * 4) & 7, by = y & 7;
      col = bx === 0 || by === 0 ? [48, 46, 54] : [70 + (R() * 8 | 0), 66, 72];
      if (rr > 146) col = [40, 38, 46];
    }
    if (R() < 0.012) col = [col[0] + 14, col[1] + 14, col[2] + 14];
    D[i] = col[0]; D[i + 1] = col[1]; D[i + 2] = col[2]; D[i + 3] = 255;
  }
  gx.putImageData(img, 0, 0);
  const P_ = (x, y, col, w = 1, h = 1) => { gx.fillStyle = col; gx.fillRect(Math.round(x), Math.round(y), w, h); };
  // road paint: dashed yellow center lines
  for (let k = 0; k < WORLD; k += 24) { if (Math.abs(k - C) > roadW + 4) { P_(C - 1, k, '#8a7a3a', 2, 12); P_(k, C - 1, '#8a7a3a', 12, 2); } }
  // crosswalk
  for (let k = -roadW + 6; k < roadW - 4; k += 8) { P_(C + k, C - roadW - 18, '#7a7a82', 5, 14); P_(C + k, C + roadW + 4, '#7a7a82', 5, 14); P_(C - roadW - 18, C + k, '#7a7a82', 14, 5); P_(C + roadW + 4, C + k, '#7a7a82', 14, 5); }
  // cracks
  for (let k = 0; k < 300; k++) { let x = R() * WORLD, y = R() * WORLD; gx.strokeStyle = 'rgba(10,10,14,0.5)'; gx.lineWidth = 1; gx.beginPath(); gx.moveTo(x, y); for (let j = 0; j < 5; j++) { x += rand(-8, 8); y += rand(-8, 8); gx.lineTo(x, y); } gx.stroke(); }
  // puddles
  for (let k = 0; k < 40; k++) { const x = R() * WORLD, y = R() * WORLD, w = 10 + R() * 30; gx.fillStyle = 'rgba(30,40,70,0.55)'; gx.beginPath(); gx.ellipse(x, y, w, w * 0.4, 0, 0, 6.3); gx.fill(); gx.fillStyle = 'rgba(120,140,200,0.25)'; gx.fillRect(x - w * 0.4, y - 1, w * 0.4, 1); }
  // grass tufts + dead flowers
  for (let k = 0; k < 9000; k++) { const x = R() * WORLD, y = R() * WORLD; if (isRoadV(x) || isRoadH(y)) continue; P_(x, y, '#344a2c'); P_(x + 1, y - 1, '#3e5634'); if (k % 9 === 0) P_(x + 2, y, pick(['#8a6a8a', '#6a7aa0', '#a08a4a'])); }
  // ----- props (not solid; they're scenery)
  lamps = []; fires = []; props = [];
  const nearRoad = (x, y, m) => Math.abs(x - C) < roadW + m || Math.abs(y - C) < roadW + m;
  // street lamps along the roads
  for (let k = 120; k < WORLD - 60; k += 200) {
    if (Math.abs(k - C) < 160) continue;
    lamps.push({ x: C - roadW - 10, y: k }, { x: C + roadW + 10, y: k + 100 }, { x: k, y: C - roadW - 10 }, { x: k + 100, y: C + roadW + 10 });
  }
  lamps = lamps.filter(l => l.x > 30 && l.y > 30 && l.x < WORLD - 30 && l.y < WORLD - 30);
  lamps.forEach(l => { gx.fillStyle = 'rgba(0,0,0,0.3)'; gx.beginPath(); gx.ellipse(l.x + 3, l.y + 2, 6, 2, 0, 0, 6.3); gx.fill(); P_(l.x - 1, l.y - 22, '#1a1a20', 3, 24); P_(l.x, l.y - 22, '#4a4a56', 1, 22); P_(l.x - 3, l.y - 24, '#2a2a30', 7, 3); P_(l.x - 2, l.y - 22, '#ffe8a0', 5, 1); });
  // wrecked cars on the roads
  const carCols = ['#8a2a2a', '#2a4a8a', '#c8b84a', '#4a6a4a', '#d8d8e0', '#6a3a7a'];
  for (let k = 0; k < 22; k++) {
    const onV = R() < 0.5, along = 80 + R() * (WORLD - 160);
    if (Math.abs(along - C) < 140) continue;
    const x = onV ? C + rand(-30, 30) : along, y = onV ? along : C + rand(-30, 30);
    drawCar(x, y, onV, pick(carCols), R);
  }
  // parking lot (bottom right) with cars in rows
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const x = C + 260 + c * 50, y = C + 300 + r * 90; for (let k = 0; k < 2; k++) P_(x - 16 + k * 40, y - 20, '#6a6a72', 1, 40); if (R() < 0.6) drawCar(x + 4, y, true, pick(carCols), R); }
  // cemetery (top left)
  const gx0 = 160, gy0 = 160;
  gx.strokeStyle = '#3a3440'; gx.lineWidth = 2; gx.strokeRect(gx0 - 20, gy0 - 20, 420, 360);
  for (let k = 0; k < 420; k += 6) { P_(gx0 - 20 + k, gy0 - 24, '#4a4450', 1, 5); P_(gx0 - 20 + k, gy0 + 336, '#4a4450', 1, 5); }
  for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) { if (R() < 0.15) continue; const x = gx0 + c * 44 + rand(-3, 3), y = gy0 + r * 56 + rand(-3, 3); drawGrave(x, y, R); }
  // park (top right): trees
  for (let k = 0; k < 70; k++) { const x = C + 120 + R() * (C - 180), y = 80 + R() * (C - 200); if (nearRoad(x, y, 30) || Math.hypot(x - C, y - C) < 380) continue; drawTree(x, y, R); }
  // trees elsewhere
  for (let k = 0; k < 90; k++) { const x = 40 + R() * (WORLD - 80), y = 40 + R() * (WORLD - 80); if (nearRoad(x, y, 30) || Math.hypot(x - C, y - C) < 380 || (x < 600 && y < 540)) continue; drawTree(x, y, R); }
  // houses (bottom left)
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) drawHouse(140 + c * 190, C + 220 + r * 230, R);
  // burning barrels + crates scattered
  for (let k = 0; k < 26; k++) { const x = 60 + R() * (WORLD - 120), y = 60 + R() * (WORLD - 120); if (Math.hypot(x - C, y - C) < 160) continue; if (k % 2) { fires.push({ x, y }); drawBarrel(x, y); } else drawCrate(x, y); }
  // plaza fountain
  gx.fillStyle = '#2a2830'; gx.beginPath(); gx.arc(C, C, 34, 0, 6.3); gx.fill(); gx.fillStyle = '#5a5664'; gx.beginPath(); gx.arc(C, C, 30, 0, 6.3); gx.fill(); gx.fillStyle = '#1a2a4a'; gx.beginPath(); gx.arc(C, C, 25, 0, 6.3); gx.fill(); gx.fillStyle = '#2a4a7a'; gx.beginPath(); gx.arc(C - 4, C - 4, 14, 0, 6.3); gx.fill();
  P_(C - 3, C - 10, '#6a6674', 6, 14); P_(C - 2, C - 10, '#8a8694', 2, 14);
  lamps.push({ x: C - 120, y: C - 120 }, { x: C + 120, y: C - 120 }, { x: C - 120, y: C + 120 }, { x: C + 120, y: C + 120 });
  lamps.slice(-4).forEach(l => { P_(l.x - 1, l.y - 22, '#1a1a20', 3, 24); P_(l.x - 3, l.y - 24, '#2a2a30', 7, 3); P_(l.x - 2, l.y - 22, '#ffe8a0', 5, 1); });
  // arena wall
  gx.fillStyle = '#121016'; gx.fillRect(0, 0, WORLD, 14); gx.fillRect(0, WORLD - 14, WORLD, 14); gx.fillRect(0, 0, 14, WORLD); gx.fillRect(WORLD - 14, 0, 14, WORLD);
  for (let k = 0; k < WORLD; k += 12) { P_(k, 10, '#3a3640', 10, 3); P_(k, WORLD - 13, '#3a3640', 10, 3); P_(10, k, '#3a3640', 3, 10); P_(WORLD - 13, k, '#3a3640', 3, 10); P_(k, 4, '#5a5664', 1, 6); P_(4, k, '#5a5664', 6, 1); }
  // old blood stains
  for (let k = 0; k < 120; k++) splat(R() * WORLD, R() * WORLD, '#3a0a0a', 6 + R() * 6, 0.5);
}
function drawCar(x, y, vert, col, R) {
  const w = vert ? 20 : 36, h = vert ? 36 : 20;
  gx.fillStyle = 'rgba(0,0,0,0.35)'; gx.fillRect(x - w / 2 + 3, y - h / 2 + 4, w, h);
  gx.fillStyle = '#0a0a10'; gx.fillRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
  gx.fillStyle = shade(col, -0.35); gx.fillRect(x - w / 2, y - h / 2, w, h);
  gx.fillStyle = col; gx.fillRect(x - w / 2, y - h / 2, w, h - 3);
  gx.fillStyle = shade(col, 0.25); gx.fillRect(x - w / 2, y - h / 2, w, 1);
  gx.fillStyle = '#1a2a3a'; if (vert) { gx.fillRect(x - w / 2 + 3, y - h / 2 + 7, w - 6, 6); gx.fillRect(x - w / 2 + 3, y + h / 2 - 12, w - 6, 5); } else { gx.fillRect(x - w / 2 + 8, y - h / 2 + 3, 6, h - 7); gx.fillRect(x + w / 2 - 13, y - h / 2 + 3, 5, h - 7); }
  gx.fillStyle = '#3a5a7a'; if (vert) gx.fillRect(x - w / 2 + 4, y - h / 2 + 8, 3, 1); else gx.fillRect(x - w / 2 + 9, y - h / 2 + 4, 1, 3);
  if (R() < 0.5) { gx.fillStyle = '#0a0a0a'; gx.fillRect(x - 3, y - 2, 7, 5); gx.fillStyle = '#3a2a1a'; gx.fillRect(x - 2, y - 1, 3, 2); }
}
function drawGrave(x, y, R) {
  gx.fillStyle = 'rgba(0,0,0,0.3)'; gx.fillRect(x - 5, y + 9, 13, 3);
  gx.fillStyle = '#2a2830'; gx.fillRect(x - 6, y - 1, 13, 12);
  if (R() < 0.6) { gx.fillStyle = '#6a6674'; gx.fillRect(x - 5, y, 11, 10); gx.fillRect(x - 4, y - 1, 9, 1); gx.fillStyle = '#8a8694'; gx.fillRect(x - 5, y, 11, 1); gx.fillStyle = '#3a3640'; gx.fillRect(x - 1, y + 2, 2, 5); gx.fillRect(x - 3, y + 3, 6, 1); }
  else { gx.fillStyle = '#5a5664'; gx.fillRect(x - 1, y - 2, 3, 13); gx.fillRect(x - 4, y + 1, 9, 2); }
  gx.fillStyle = '#2a1e14'; gx.fillRect(x - 4, y + 13, 9, 14); gx.fillStyle = '#3a2a1a'; gx.fillRect(x - 3, y + 14, 7, 12);
}
function drawTree(x, y, R) {
  gx.fillStyle = 'rgba(0,0,0,0.35)'; gx.beginPath(); gx.ellipse(x + 4, y + 10, 14, 5, 0, 0, 6.3); gx.fill();
  gx.fillStyle = '#2a1a10'; gx.fillRect(x - 1, y, 4, 11);
  const cols = R() < 0.3 ? ['#1a1e14', '#262a1c', '#323624'] : ['#0e2014', '#16301c', '#204226'];
  [[cols[0], 13, 0, 0], [cols[1], 11, -1, -2], [cols[2], 7, -3, -4]].forEach(([c, r, ox, oy]) => { gx.fillStyle = c; gx.beginPath(); gx.arc(x + ox, y - 4 + oy, r, 0, 6.3); gx.fill(); });
}
function drawHouse(x, y, R) {
  const w = 110, h = 80;
  gx.fillStyle = 'rgba(0,0,0,0.4)'; gx.fillRect(x + 6, y + 8, w, h);
  gx.fillStyle = '#0a080c'; gx.fillRect(x - 2, y - 2, w + 4, h + 4);
  const roof = pick(['#5a2a2a', '#3a3a5a', '#4a3a2a']);
  for (let k = 0; k < h; k += 6) { gx.fillStyle = k % 12 ? roof : shade(roof, -0.2); gx.fillRect(x, y + k, w, 6); }
  gx.fillStyle = shade(roof, 0.2); gx.fillRect(x, y + h / 2 - 2, w, 4);
  gx.fillStyle = '#2a2a2a'; gx.fillRect(x + w - 26, y + 10, 10, 14);
  if (R() < 0.6) { gx.fillStyle = '#0a0a0a'; gx.fillRect(x + 20, y + 30, 24, 18); gx.fillStyle = '#1a1010'; gx.fillRect(x + 22, y + 32, 20, 14); }
}
function drawBarrel(x, y) { gx.fillStyle = 'rgba(0,0,0,0.35)'; gx.fillRect(x - 4, y + 5, 11, 3); gx.fillStyle = '#1a1a1a'; gx.fillRect(x - 5, y - 6, 11, 13); gx.fillStyle = '#5a3a2a'; gx.fillRect(x - 4, y - 5, 9, 11); gx.fillStyle = '#7a5a3a'; gx.fillRect(x - 4, y - 5, 2, 11); gx.fillStyle = '#2a1a10'; gx.fillRect(x - 4, y - 2, 9, 1); gx.fillRect(x - 4, y + 3, 9, 1); gx.fillStyle = '#0a0606'; gx.fillRect(x - 3, y - 6, 7, 2); }
function drawCrate(x, y) { gx.fillStyle = 'rgba(0,0,0,0.35)'; gx.fillRect(x - 5, y + 6, 14, 3); gx.fillStyle = '#1a0c04'; gx.fillRect(x - 7, y - 7, 14, 14); gx.fillStyle = '#7a5a2a'; gx.fillRect(x - 6, y - 6, 12, 12); gx.fillStyle = '#5a3a1a'; for (let k = 0; k < 12; k++) { gx.fillRect(x - 6 + k, y - 6 + k, 1, 1); gx.fillRect(x + 5 - k, y - 6 + k, 1, 1); } gx.fillStyle = '#9a7a3a'; gx.fillRect(x - 6, y - 6, 12, 1); }
function splat(x, y, col, size, a = 0.8) {
  if (!gx) return;
  gx.globalAlpha = a; gx.fillStyle = col;
  const n = Math.max(3, size | 0);
  for (let k = 0; k < n; k++) { const ang = Math.random() * 6.283, r = Math.random() * size; gx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y + Math.sin(ang) * r * 0.6), 1 + (Math.random() < 0.4 ? 1 : 0), 1); }
  gx.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 2);
  gx.globalAlpha = 1;
}

// ------------------------------------------------------------ state
let state = 'loading', t = 0, run = null, P = null;
let zs = [], bullets = [], ebullets = [], rangs = [], pools = [], rockets = [], beams = [], novas = [], slashes = [], strikes = [], lobs = [];
let pickups = [], parts = [], floats = [], rings = [], tele = [];
let cards = [], pickT = 0, pickHover = -1, shake = 0, hurtFlash = 0, whiteFlash = 0, banner = null, toastQ = [];
const cam = { x: 0, y: 0 };

function charDef(id) { return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]; }
// ---- mid-run save: written at the start of every wave, cleared when the run ends
const RUN_KEY = 'cnatt_horde_run';
function saveRun() {
  if (!run || !P) return;
  const snap = { v: 1, char: run.char.id, wave: run.wave, kills: run.kills, coins: run.coins, time: run.time, rerolls: run.rerolls, revive: run.revive, endless: run.endless,
    weapons: P.weapons.map(w => [w.id, w.lv]), passives: P.passives, hp: P.hp, when: Date.now() };
  try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) {}
}
function loadRunSave() { try { return JSON.parse(localStorage.getItem(RUN_KEY)); } catch (e) { return null; } }
function clearRunSave() { try { localStorage.removeItem(RUN_KEY); } catch (e) {} }
function continueRun() { const s = loadRunSave(); if (s) startRun(s.char, s); }
function startRun(charId, snap) {
  const C = charDef(charId || save.char);
  run = { char: C, wave: 0, kills: 0, coins: 0, time: 0, spawnLeft: 0, quota: 0, spawnAcc: 0, spawnDur: 1, spawnT: 0, hordes: [], bossDone: false, boss: null,
    phase: 'ready', phaseT: 2.5, rerolls: shopLv('reroll'), revive: shopLv('revive') > 0, endless: false, extraPicks: 0, killedWave: 0 };
  P = { x: WORLD / 2, y: WORLD / 2 + 60, hp: 1, maxHp: 1, inv: 0, face: 1, aimX: 1, aimY: 0, anim: 0, moving: false,
    weapons: [], passives: {}, regenAcc: 0 };
  addWeapon(C.weapon);
  recalc(); P.hp = P.maxHp;
  zs = []; bullets = []; ebullets = []; rangs = []; pools = []; rockets = []; beams = []; novas = []; slashes = []; strikes = []; lobs = [];
  pickups = []; parts = []; floats = []; rings = []; tele = []; toastQ = [];
  buildGround();
  state = 'play';
  if (snap) {
    Object.assign(run, { wave: snap.wave, kills: snap.kills, coins: snap.coins, time: snap.time, rerolls: snap.rerolls, revive: snap.revive, endless: snap.endless });
    P.weapons = []; snap.weapons.forEach(([id, lv]) => { if (WEAPONS[id]) { addWeapon(id); P.weapons[P.weapons.length - 1].lv = lv; } });
    P.passives = {}; Object.entries(snap.passives || {}).forEach(([id, lv]) => { if (PASSIVES[id]) P.passives[id] = lv; });
    recalc(); P.hp = Math.max(1, Math.min(P.maxHp, snap.hp));
    run.phase = 'ready'; run.phaseT = 3;
    banner = { title: 'RUN RESTORED', sub: `WAVE ${run.wave + 1} IN...`, t: 0, col: '#8aff6a', dur: 3, count: true };
    Sound.playSong(run.wave + 1 > 20 ? SONGS.zfight3 : run.wave + 1 > 10 ? SONGS.zfight2 : SONGS.zfight1);
    return;
  }
  save.runs++; store();
  openPick();
}
function addWeapon(id) { P.weapons.push({ id, lv: 1, cd: 0.5, st: {} }); }
function wstat(w) { const L = WEAPONS[w.id].lv, o = {}; for (let i = 0; i < w.lv; i++) Object.assign(o, L[i]); return o; }
function recalc() {
  const C = run.char, pv = id => P.passives[id] || 0;
  const oldMax = P.maxHp;
  P.maxHp = C.hp + shopLv('hp') * 10 + pv('vitality') * 25;
  if (P.maxHp > oldMax && oldMax > 1) P.hp += P.maxHp - oldMax;
  P.speed = 78 * C.speed * (1 + 0.04 * shopLv('speed')) * (1 + 0.08 * pv('sneakers'));
  P.dmgMul = (1 + 0.05 * shopLv('dmg')) * (1 + 0.12 * pv('power'));
  P.cdMul = 1 - 0.07 * pv('haste');
  P.area = 1 + 0.12 * pv('growth');
  P.magnet = 40 * (1 + 0.2 * shopLv('magnet')) * (1 + 0.35 * pv('magnet'));
  P.armor = 0.07 * pv('kevlar');
  P.regen = 0.5 * pv('regen');
  P.multi = Math.floor((pv('multishot') + 1) / 2);
  P.crit = 0.05 + 0.06 * pv('lucky');
  P.coinMul = (1 + 0.15 * shopLv('greed')) * (1 + 0.1 * pv('lucky'));
}

// ------------------------------------------------------------ waves
function beginWave() {
  saveRun();
  run.wave++; run.killedWave = 0;
  const n = run.wave;
  run.quota = run.endless ? Math.round(waveQuota(Math.min(n, 40)) * (1 + (n - 30) * 0.03)) : waveQuota(n);
  run.spawnLeft = run.quota; run.spawnAcc = 0; run.spawnT = 0;
  run.spawnDur = 16 + Math.min(n, 30) * 0.9;
  run.hordes = n >= 4 ? (n >= 12 ? [0.3, 0.6, 0.85] : [0.45, 0.8]) : [];
  run.bossDone = !(BOSSES[n] || (run.endless && n % 5 === 0));
  run.phase = 'fight';
  const isBoss = !run.bossDone;
  banner = { title: `WAVE ${n}`, sub: isBoss ? 'A BOSS IS COMING' : `${fmt(run.quota)} ZOMBIES`, t: 0, col: isBoss ? '#ff4a4a' : '#ffe680', dur: 2 };
  const song = n > 20 ? SONGS.zfight3 : n > 10 ? SONGS.zfight2 : SONGS.zfight1;
  Sound.playSong(song);
  SND.horn();
}
function monsterPool(n) {
  return Object.entries(MONSTERS).filter(([, d]) => d.from <= n).map(([id, d]) => ({ id, w: d.weight * (id === 'walker' ? Math.max(0.35, 1 - n * 0.025) : 1) }));
}
function rollType(pool) { let s = 0; pool.forEach(p => s += p.w); let r = Math.random() * s; for (const p of pool) { r -= p.w; if (r <= 0) return p.id; } return pool[0].id; }
function spawnPos(rad) {
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * 6.283, r = rad || rand(380, 470);
    const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
    if (x > 24 && y > 24 && x < WORLD - 24 && y < WORLD - 24) return { x, y };
  }
  const a = Math.random() * 6.283; return { x: clamp(P.x + Math.cos(a) * 400, 24, WORLD - 24), y: clamp(P.y + Math.sin(a) * 400, 24, WORLD - 24) };
}
const MAX_ALIVE = 1400;
function spawnZombie(type, pos) {
  const D = MONSTERS[type], n = run.wave;
  const hp = D.hp * waveHp(n) * (run.endless ? 1 + (n - 30) * 0.12 : 1);
  const p = pos || spawnPos();
  const z = { type, D, x: p.x, y: p.y, kx: 0, ky: 0, hp, max: hp, r: D.r, spd: D.speed * (1 + Math.min(0.25, 0.007 * (n - 1))) * rand(0.9, 1.1), dmg: D.dmg * (1 + 0.045 * (n - 1)),
    slow: 0, slowT: 0, frozen: 0, burnT: 0, burn: 0, flash: 0, face: 1, anim: Math.random() * 6, atk: rand(1, 3), bladeT: 0, auraT: 0, spr: sprite(D.sprite, D.tint) };
  zs.push(z); return z;
}
function spawnBoss() {
  const B = BOSSES[run.wave] || BOSSES[30];
  const mul = run.endless ? 1 + (run.wave - 30) * 0.15 : 1;
  const p = spawnPos(340);
  const z = { type: B.id, D: B, boss: true, x: p.x, y: p.y, kx: 0, ky: 0, hp: B.hp * mul, max: B.hp * mul, r: B.r, spd: B.speed, dmg: B.dmg * (run.endless ? mul : 1),
    slow: 0, slowT: 0, frozen: 0, burnT: 0, burn: 0, flash: 0, face: 1, anim: 0, atk: 3, bladeT: 0, auraT: 0, spr: sprite(B.sprite, B.tint), mode: 'walk', modeT: 0, ai: 0 };
  zs.push(z); run.boss = z; run.bossDone = true;
  shake = 0.8; SND.roar();
  banner = { title: B.name, sub: 'KILL IT TO FINISH THE WAVE', t: 0, col: '#ff4a4a', dur: 2.6 };
  Sound.playSong(SONGS.zboss);
}
function updateSpawns(dt) {
  if (run.phase !== 'fight') return;
  run.spawnT += dt;
  const prog = clamp(run.spawnT / run.spawnDur, 0, 1);
  // boss arrives about a third into a boss wave
  if (!run.bossDone && prog > 0.3) spawnBoss();
  // hordes: a ring of zombies all at once
  if (run.hordes.length && prog >= run.hordes[0] && run.spawnLeft > 0) {
    run.hordes.shift();
    const cnt = Math.min(run.spawnLeft, Math.round(run.quota * 0.14), MAX_ALIVE - zs.length);
    const pool = monsterPool(run.wave), r = rand(250, 300), off = Math.random() * 6.283;
    for (let k = 0; k < cnt; k++) {
      const a = off + k / cnt * 6.283, rr = r + rand(-20, 20);
      spawnZombie(rollType(pool), { x: clamp(P.x + Math.cos(a) * rr, 20, WORLD - 20), y: clamp(P.y + Math.sin(a) * rr, 20, WORLD - 20) });
    }
    run.spawnLeft -= cnt;
    toast('HORDE INCOMING!', '#ff5a5a', 2); SND.horde();
  }
  // steady trickle; the rate ramps up through the wave
  const rate = run.quota / run.spawnDur * (0.6 + prog * 0.8);
  run.spawnAcc += rate * dt;
  const pool = monsterPool(run.wave);
  while (run.spawnAcc >= 1 && run.spawnLeft > 0 && zs.length < MAX_ALIVE) {
    run.spawnAcc -= 1; run.spawnLeft--;
    const type = rollType(pool);
    if (Math.random() < 0.25 && run.spawnLeft > 4) { // small clump
      const p = spawnPos(); for (let k = 0; k < 4; k++) spawnZombie(type, { x: p.x + rand(-14, 14), y: p.y + rand(-14, 14) }); run.spawnLeft -= 3;
    } else spawnZombie(type);
  }
  if (run.spawnT > run.spawnDur + 3 && run.spawnLeft > 0 && zs.length < MAX_ALIVE) { run.spawnAcc += run.spawnLeft * dt; }
  if (run.spawnLeft <= 0 && run.bossDone && zs.length === 0) waveCleared();
}
function waveCleared() {
  run.phase = 'clear'; run.phaseT = 1.6;
  if (!run.endless) save.best = Math.max(save.best, run.wave); else save.best = Math.max(save.best, run.wave);
  store();
  pickups.forEach(p => { if (p.kind === 'coin') p.pull = true; });
  const heal = Math.round(Math.min(P.maxHp - P.hp, P.maxHp * 0.3));
  if (heal > 0) { P.hp += heal; floats.push({ x: P.x, y: P.y - 20, text: '+' + heal, col: '#6aff6a', t: 0, big: true }); }
  banner = { title: `WAVE ${run.wave} CLEARED`, sub: heal > 0 ? `+${heal} HEALTH` : '', t: 0, col: '#8aff6a', dur: 1.6 };
  SND.clear();
}

// ------------------------------------------------------------ cards
function cardOptions() {
  const opts = [];
  P.weapons.forEach(w => { if (w.lv < MAX_LV) opts.push({ kind: 'weapon', id: w.id, from: w.lv, w: 1.5 }); });
  Object.entries(P.passives).forEach(([id, lv]) => { if (lv < MAX_LV) opts.push({ kind: 'passive', id, from: lv, w: 1.2 }); });
  if (P.weapons.length < WEAPON_SLOTS) Object.keys(WEAPONS).forEach(id => { if (!P.weapons.some(w => w.id === id)) opts.push({ kind: 'weapon', id, from: 0, w: 1.1 }); });
  if (Object.keys(P.passives).length < PASSIVE_SLOTS) Object.keys(PASSIVES).forEach(id => { if (!P.passives[id]) opts.push({ kind: 'passive', id, from: 0, w: 0.9 }); });
  return opts;
}
function dealCards() {
  const opts = cardOptions(), out = [];
  while (out.length < 3 && opts.length) {
    let s = 0; opts.forEach(o => s += o.w); let r = Math.random() * s, i = 0;
    for (; i < opts.length; i++) { r -= opts[i].w; if (r <= 0) break; }
    const o = opts.splice(Math.min(i, opts.length - 1), 1)[0];
    const epic = o.from > 0 && o.from <= MAX_LV - 2 && Math.random() < 0.12;
    o.to = o.from + (epic ? 2 : 1); o.epic = epic;
    out.push(o);
  }
  while (out.length < 3) out.push(out.length % 2 ? { kind: 'heal', id: 'burger', to: 1 } : { kind: 'gold', id: 'coin', to: 1 });
  cards = out; pickT = 0; pickHover = -1;
}
function openPick() { dealCards(); state = 'pick'; Sound.playSong(SONGS.zpick); SND.cards(); }
function choose(i) {
  const c = cards[i]; if (!c) return;
  if (c.kind === 'weapon') { let w = P.weapons.find(x => x.id === c.id); if (!w) { addWeapon(c.id); w = P.weapons[P.weapons.length - 1]; } w.lv = c.to; }
  else if (c.kind === 'passive') { P.passives[c.id] = c.to; recalc(); if (c.id === 'vitality') P.hp = Math.min(P.maxHp, P.hp + 25 * (c.to - c.from)); }
  else if (c.kind === 'heal') P.hp = P.maxHp;
  else if (c.kind === 'gold') addCoins(40);
  recalc();
  SND.pick(c.to >= MAX_LV);
  for (let k = 0; k < 40; k++) parts.push({ x: P.x + rand(-10, 10), y: P.y + rand(-14, 4), vx: rand(-20, 20), vy: rand(-80, -30), life: rand(0.5, 1), t: 0, col: pick(['#ffe650', '#ffffff', '#8aff6a']), s: 1 });
  if (run.extraPicks > 0) { run.extraPicks--; dealCards(); return; }
  state = 'play'; run.phase = 'ready'; run.phaseT = 2.2;
  banner = { title: 'GET READY', sub: `WAVE ${run.wave + 1} IN...`, t: 0, col: '#ffe680', dur: 2.2, count: true };
  Sound.playSong(run.wave + 1 > 20 ? SONGS.zfight3 : run.wave + 1 > 10 ? SONGS.zfight2 : SONGS.zfight1);
}
function reroll() { if (run.rerolls <= 0) { Sound.play('error'); return; } run.rerolls--; dealCards(); Sound.play('tab'); }

// ------------------------------------------------------------ spatial grid
const CELL = 32, GC = Math.ceil(WORLD / CELL);
const grid = Array.from({ length: GC * GC }, () => []);
function buildGrid() {
  for (let i = 0; i < grid.length; i++) grid[i].length = 0;
  for (let i = 0; i < zs.length; i++) { const z = zs[i]; const c = clamp(z.x / CELL | 0, 0, GC - 1), r = clamp(z.y / CELL | 0, 0, GC - 1); grid[r * GC + c].push(z); }
}
function query(x, y, rad, fn) {
  const c0 = clamp((x - rad - 14) / CELL | 0, 0, GC - 1), c1 = clamp((x + rad + 14) / CELL | 0, 0, GC - 1);
  const r0 = clamp((y - rad - 14) / CELL | 0, 0, GC - 1), r1 = clamp((y + rad + 14) / CELL | 0, 0, GC - 1);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const cell = grid[r * GC + c]; for (let i = 0; i < cell.length; i++) { const z = cell[i]; if (z.dead) continue; const d = (z.x - x) ** 2 + (z.y - y) ** 2, rr = rad + z.r; if (d <= rr * rr) { if (fn(z, d) === false) return; } } }
}
function nearest(x, y, maxR = 260) {
  let best = null, bd = maxR * maxR;
  // search rings of cells outward
  query(x, y, maxR, (z, d) => { if (d < bd) { bd = d; best = z; } });
  return best;
}
function randomOnScreen() {
  const list = [];
  for (const z of zs) if (!z.dead && z.x > cam.x && z.x < cam.x + VW && z.y > cam.y && z.y < cam.y + VH) list.push(z);
  return list;
}

// ------------------------------------------------------------ combat
function hit(z, dmg, o = {}) {
  if (z.dead) return;
  let crit = Math.random() < P.crit;
  dmg *= P.dmgMul * (crit ? 2 : 1);
  if (z.D.armor) dmg *= 1 - z.D.armor;
  z.hp -= dmg; z.flash = 0.07;
  if (o.kb && !z.D.heavy && !z.boss) { z.kx += o.kb.x; z.ky += o.kb.y; }
  if (o.burn && !z.boss) { z.burnT = 2.5; z.burn = Math.max(z.burn, dmg * 0.25); }
  if (o.slow) { z.slow = Math.max(z.slow, z.boss ? o.slow * 0.5 : o.slow); z.slowT = o.slowT || 1.5; }
  if (o.freeze && !z.boss) z.frozen = Math.max(z.frozen, o.freeze);
  if ((crit || dmg >= 40 || z.boss) && floats.length < 70) floats.push({ x: z.x + rand(-4, 4), y: z.y - z.r * 2 - 6, text: String(Math.round(dmg)), col: crit ? '#ffe650' : '#ffffff', t: 0, big: crit });
  if (z.hp <= 0) kill(z);
  else sfx('hit', 0.04, () => Sound.blip(rand(180, 260), 0.03, { type: 'square', vol: 0.025 }));
}
const DEATH_COL = { walker: '#4a7a2a', crawler: '#5a7a3a', runner: '#7a2a1a', spitter: '#9aa02a', bloater: '#8aa04a', brute: '#4a5a3a', riot: '#3a4a2a', ghoul: '#6a6a7a', witch: '#5a2a7a', hound: '#7a1a0a', titan: '#6a3a4a' };
function kill(z) {
  z.dead = true; run.kills++; run.killedWave++;
  const col = DEATH_COL[z.type] || '#6a1a1a';
  const big = z.boss || z.D.heavy;
  splat(z.x, z.y, '#4a0a0a', z.r * (big ? 2.2 : 1.4), 0.7);
  splat(z.x + rand(-2, 2), z.y, col, z.r * 0.9, 0.6);
  const n = z.boss ? 120 : big ? 24 : 6;
  if (parts.length < 1400) for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, v = rand(20, z.boss ? 160 : 70); parts.push({ x: z.x, y: z.y - z.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rand(0.3, 0.6), t: 0, col: k % 3 ? col : '#8a1a1a', s: Math.random() < 0.3 ? 2 : 1, g: 160 }); }
  sfx('die', 0.05, () => { Sound.hiss(0.06, { filter: 'lowpass', freq: 1400, vol: 0.06 }); Sound.blip(rand(90, 140), 0.06, { type: 'square', vol: 0.03, slide: 50 }); });
  // drops
  const coinCh = z.D.coin || 0.05;
  if (Math.random() < coinCh * P.coinMul) dropCoin(z.x, z.y, z.D.heavy ? 5 : 1);
  if (Math.random() < 0.004) pickups.push({ kind: 'meat', x: z.x, y: z.y, t: 0 });
  else if (Math.random() < 0.0015) pickups.push({ kind: 'magnet', x: z.x, y: z.y, t: 0 });
  else if (Math.random() < 0.0012 && run.wave >= 3) pickups.push({ kind: 'nuke', x: z.x, y: z.y, t: 0 });
  if (z.D.explode) explode(z.x, z.y, z.D.explode, 0, true, z.dmg * 1.2);
  if (z.boss) {
    run.boss = null; shake = 1.2; whiteFlash = 0.7; SND.bossDie();
    pickups.push({ kind: 'chest', x: z.x, y: z.y, t: 0 });
    for (let k = 0; k < 20; k++) dropCoin(z.x + rand(-20, 20), z.y + rand(-20, 20), 5);
    toast(`${z.D.name} IS DEAD!`, '#ffe680', 3);
    Sound.playSong(run.wave > 20 ? SONGS.zfight3 : run.wave > 10 ? SONGS.zfight2 : SONGS.zfight1);
  }
}
function dropCoin(x, y, v) {
  if (pickups.length > 700) { const c = pickups.find(p => p.kind === 'coin'); if (c) { c.v += v; return; } }
  pickups.push({ kind: 'coin', x: x + rand(-3, 3), y: y + rand(-3, 3), v, t: 0, vx: rand(-30, 30), vy: rand(-30, 30) });
}
function addCoins(v) { run.coins += v; }
function explode(x, y, r, dmg, zombieBlast, playerDmg) {
  rings.push({ x, y, r: 2, max: r, t: 0, dur: 0.3, col: zombieBlast ? '#b8e04a' : '#ffb040' });
  if (parts.length < 1400) for (let k = 0; k < (zombieBlast ? 16 : 26); k++) { const a = Math.random() * 6.283, v = rand(30, 110); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.25, 0.5), t: 0, col: zombieBlast ? pick(['#b8e04a', '#6a8a2a', '#e8f08a']) : pick(['#ff8a3a', '#ffe650', '#ff5a1a', '#5a5464']), s: 2 }); }
  if (zombieBlast) { if (Math.hypot(P.x - x, P.y - y) < r + 6) hurtPlayer(playerDmg, 'blast'); splat(x, y, '#6a8a2a', r * 0.6, 0.5); sfx('blob', 0.1, () => Sound.hiss(0.25, { filter: 'lowpass', freq: 600, vol: 0.12 })); return; }
  query(x, y, r, z => hit(z, dmg * (1 - 0.4 * Math.hypot(z.x - x, z.y - y) / (r + z.r)), { kb: { x: (z.x - x) * 2, y: (z.y - y) * 2 } }));
  shake = Math.max(shake, 0.15);
  lights.push({ x, y, r: r * 2.2, t: 0, dur: 0.25, col: '#ffb040' });
  sfx('boom', 0.06, () => { Sound.hiss(0.3, { filter: 'lowpass', freq: 900, sweep: 120, vol: 0.14 }); Sound.blip(70, 0.2, { type: 'sine', vol: 0.12, slide: 35 }); });
}
let lights = [];
function hurtPlayer(d, src = '?') {
  if (P.inv > 0 || state !== 'play') return;
  (run.dmgLog = run.dmgLog || {})[src] = ((run.dmgLog || {})[src] || 0) + d;
  d *= 1 - P.armor;
  P.hp -= d; P.inv = src === 'boss' || src === 'slam' ? 1.0 : 0.45; hurtFlash = 0.35; shake = Math.max(shake, 0.25);
  floats.push({ x: P.x, y: P.y - 18, text: '-' + Math.round(d), col: '#ff4a4a', t: 0, big: true });
  SND.hurt();
  if (P.hp <= 0) {
    if (run.revive) {
      run.revive = false; P.hp = P.maxHp * 0.5; P.inv = 2.5; whiteFlash = 1;
      query(P.x, P.y, 140, z => { if (!z.boss) hit(z, 99999); });
      toast('SECOND LIFE!', '#8aff6a', 2.5); SND.pick(true);
    } else die();
  }
}
function die() {
  P.hp = 0; state = 'dead'; endT = 0; toastQ = []; clearRunSave(); bankCoins();
  Sound.playSong(SONGS.zlose); SND.death();
  for (let k = 0; k < 60; k++) parts.push({ x: P.x, y: P.y - 6, vx: rand(-90, 90), vy: rand(-120, 20), life: rand(0.5, 1.2), t: 0, col: pick(['#c83a3a', '#8a1a1a', '#2a6ad0']), s: 2, g: 200 });
}
function bankCoins() { if (run.banked) return; run.banked = true; save.coins += run.coins; save.bestKills = Math.max(save.bestKills, run.kills); store(); }

// ------------------------------------------------------------ weapons
function fireWeapons(dt) {
  for (const w of P.weapons) {
    const s = wstat(w), id = w.id;
    if (id === 'blades') { blades(w, s, dt); continue; }
    if (id === 'aura') { aura(w, s, dt); continue; }
    if (id === 'drone') { drones(w, s, dt); continue; }
    w.cd -= dt;
    if (w.cd > 0) continue;
    const cd = s.cd * P.cdMul;
    if (id === 'pistol') {
      const tg = nearest(P.x, P.y, 230); if (!tg) { w.cd = 0.1; continue; }
      const n = s.count + P.multi;
      for (let k = 0; k < n; k++) {
        const a = Math.atan2(tg.y - P.y, tg.x - P.x) + (k - (n - 1) / 2) * 0.12;
        bullets.push({ x: P.x, y: P.y - 6, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, dmg: s.dmg, pierce: s.pierce, life: 0.9, r: 2, hit: [], kind: 'bullet' });
      }
      muzzle(tg); w.cd = cd;
      sfx('pistol', 0.05, () => Sound.blip(rand(700, 800), 0.05, { type: 'square', vol: 0.05, slide: 200 }));
    } else if (id === 'shotgun') {
      const tg = nearest(P.x, P.y, 150); if (!tg) { w.cd = 0.1; continue; }
      const base = Math.atan2(tg.y - P.y, tg.x - P.x), n = s.count + P.multi * 2;
      for (let k = 0; k < n; k++) { const a = base + rand(-s.spread, s.spread), v = rand(260, 330); bullets.push({ x: P.x, y: P.y - 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dmg: s.dmg, pierce: 1, life: s.range * rand(0.8, 1.1), r: 2, hit: [], kind: s.burn ? 'fire' : 'pellet', burn: s.burn, kb: 50 }); }
      muzzle(tg); w.cd = cd; shake = Math.max(shake, 0.08);
      sfx('shotgun', 0.08, () => { Sound.hiss(0.18, { filter: 'lowpass', freq: 1800, vol: 0.14 }); Sound.blip(120, 0.12, { type: 'square', vol: 0.08, slide: 60 }); });
    } else if (id === 'boomerang') {
      const n = s.count + P.multi, tg = nearest(P.x, P.y, 260);
      const base = tg ? Math.atan2(tg.y - P.y, tg.x - P.x) : Math.atan2(P.aimY, P.aimX);
      for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * (6.283 / Math.max(n, 3)) * (n > 1 ? 1 : 0); rangs.push({ x: P.x, y: P.y - 6, a, d: 0, back: false, spin: 0, dmg: s.dmg, size: s.size * P.area, max: s.dist * P.area, burn: s.burn, hits: new Map() }); }
      w.cd = cd; sfx('rang', 0.1, () => Sound.hiss(0.25, { filter: 'bandpass', freq: 1500, sweep: 600, q: 2, vol: 0.08 }));
    } else if (id === 'lightning') {
      const list = randomOnScreen(); if (!list.length) { w.cd = 0.2; continue; }
      const n = s.count + P.multi;
      for (let k = 0; k < n; k++) {
        let z = pick(list); strike(z.x, z.y, s.dmg);
        if (s.chain) { let cur = z; const done = [z]; for (let j = 0; j < s.chain; j++) { const nx = nearestExcept(cur, done, 70); if (!nx) break; strikes.push({ x1: cur.x, y1: cur.y - 6, x2: nx.x, y2: nx.y - 6, t: 0, chain: true }); hit(nx, s.dmg * 0.7); done.push(nx); cur = nx; } }
      }
      w.cd = cd; SND.zap();
    } else if (id === 'molotov') {
      const n = s.count + P.multi;
      for (let k = 0; k < n; k++) {
        const list = []; query(P.x, P.y, 170, z => { list.push(z); });
        const tg = list.length ? pick(list) : { x: P.x + rand(-100, 100), y: P.y + rand(-80, 80) };
        lobs.push({ sx: P.x, sy: P.y - 8, tx: tg.x + rand(-8, 8), ty: tg.y + rand(-8, 8), t: 0, dur: 0.55, s });
      }
      w.cd = cd; sfx('throw', 0.1, () => Sound.hiss(0.15, { filter: 'bandpass', freq: 900, q: 1, vol: 0.06 }));
    } else if (id === 'rockets') {
      const n = s.count + P.multi;
      for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.5; rockets.push({ x: P.x, y: P.y - 8, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, tg: null, dmg: s.dmg, r: s.radius * P.area, life: 3 }); }
      w.cd = cd; sfx('rocket', 0.1, () => Sound.hiss(0.35, { filter: 'bandpass', freq: 700, sweep: 2000, q: 1, vol: 0.1 }));
    } else if (id === 'frost') {
      const r = s.radius * P.area;
      novas.push({ x: P.x, y: P.y, r: 0, max: r, t: 0 });
      query(P.x, P.y, r, z => hit(z, s.dmg, { slow: s.slow, slowT: 2.5, freeze: Math.random() < (s.freeze || 0) ? 1.2 : 0 }));
      w.cd = cd; SND.frost();
    } else if (id === 'laser') {
      const tg = nearest(P.x, P.y, 300); if (!tg) { w.cd = 0.15; continue; }
      const base = Math.atan2(tg.y - P.y, tg.x - P.x);
      for (let k = 0; k < s.count; k++) { const a = base + k * 6.283 / s.count; laser(a, s.dmg, s.width * P.area); }
      w.cd = cd; SND.laser();
    } else if (id === 'cleaver') {
      const reach = s.reach * P.area, a = Math.atan2(P.aimY, P.aimX);
      const dirs = s.spin ? [null] : s.both ? [a, a + Math.PI] : [a];
      dirs.forEach(d => {
        slashes.push({ a: d, reach, t: 0, spin: !!s.spin });
        query(P.x, P.y - 4, reach, z => {
          if (d !== null) { let da = Math.atan2(z.y - P.y, z.x - P.x) - d; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; if (Math.abs(da) > 1.25) return; }
          hit(z, s.dmg, { kb: { x: (z.x - P.x) * 3, y: (z.y - P.y) * 3 } });
        });
      });
      w.cd = cd; sfx('slash', 0.08, () => Sound.hiss(0.12, { filter: 'highpass', freq: 2500, sweep: 6000, vol: 0.1 }));
    }
  }
}
function nearestExcept(z0, ex, r) { let best = null, bd = r * r; query(z0.x, z0.y, r, (z, d) => { if (!ex.includes(z) && d < bd) { bd = d; best = z; } }); return best; }
function muzzle(tg) { const a = Math.atan2(tg.y - P.y, tg.x - P.x); P.aimX = Math.cos(a); P.aimY = Math.sin(a); P.muzzle = 0.06; }
function strike(x, y, dmg) {
  strikes.push({ x1: x + rand(-20, 20), y1: y - 180, x2: x, y2: y - 4, t: 0 });
  query(x, y, 14 * P.area, z => hit(z, dmg));
  lights.push({ x, y, r: 70, t: 0, dur: 0.15, col: '#ffffa0' });
  if (parts.length < 1400) for (let k = 0; k < 8; k++) parts.push({ x, y, vx: rand(-60, 60), vy: rand(-80, -10), life: 0.3, t: 0, col: pick(['#ffffa0', '#ffffff', '#ffe650']), s: 1, g: 200 });
}
function laser(a, dmg, width) {
  const len = 320, ex = P.x + Math.cos(a) * len, ey = P.y - 6 + Math.sin(a) * len;
  beams.push({ x1: P.x, y1: P.y - 6, x2: ex, y2: ey, t: 0, w: width });
  // walk along the beam hitting each zombie once
  const done = new Set();
  for (let d = 0; d < len; d += 16) {
    const x = P.x + Math.cos(a) * d, y = P.y - 6 + Math.sin(a) * d;
    query(x, y, width + 6, z => { if (!done.has(z)) { done.add(z); hit(z, dmg); } });
  }
}
function blades(w, s, dt) {
  w.st.ang = (w.st.ang || 0) + s.spin * dt;
  const r = s.radius * P.area, n = s.count;
  w.st.pos = [];
  for (let k = 0; k < n; k++) {
    const a = w.st.ang + k * 6.283 / n, x = P.x + Math.cos(a) * r, y = P.y - 4 + Math.sin(a) * r * 0.8;
    w.st.pos.push({ x, y, a });
    query(x, y, 7 * P.area, z => { if (z.bladeT <= 0) { z.bladeT = 0.35; hit(z, s.dmg, { kb: { x: Math.cos(a) * 60, y: Math.sin(a) * 60 } }); sfx('blade', 0.06, () => Sound.blip(rand(1800, 2200), 0.03, { type: 'triangle', vol: 0.03 })); } });
  }
}
function aura(w, s, dt) {
  w.st.t = (w.st.t || 0) + dt;
  if (w.st.t < 0.25) return; w.st.t = 0;
  query(P.x, P.y, s.radius * P.area, z => hit(z, s.dps * 0.25, { slow: s.slow || 0, slowT: 0.4 }));
}
function drones(w, s, dt) {
  w.st.ds = w.st.ds || [];
  while (w.st.ds.length < s.count) w.st.ds.push({ x: P.x, y: P.y, cd: Math.random() * 0.4, ph: w.st.ds.length * 2.1 });
  w.st.ds.forEach((d, i) => {
    d.ph += dt * 1.6;
    const tx = P.x + Math.cos(d.ph) * 26, ty = P.y - 22 + Math.sin(d.ph * 1.3) * 8;
    d.x = lerp(d.x, tx, Math.min(1, dt * 6)); d.y = lerp(d.y, ty, Math.min(1, dt * 6));
    d.cd -= dt;
    if (d.cd <= 0) { const tg = nearest(d.x, d.y + 16, 170); if (tg) { const a = Math.atan2(tg.y - 4 - d.y, tg.x - d.x); bullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, dmg: s.dmg, pierce: 0, life: 0.7, r: 2, hit: [], kind: 'laser' }); d.cd = s.cd * P.cdMul; sfx('drone', 0.06, () => Sound.blip(1400, 0.03, { type: 'square', vol: 0.025, slide: 900 })); } else d.cd = 0.1; }
  });
}
function updateShots(dt) {
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    query(b.x, b.y + 4, b.r, z => {
      if (b.hit.includes(z)) return;
      b.hit.push(z);
      hit(z, b.dmg, { kb: b.kb ? { x: b.vx / 300 * b.kb, y: b.vy / 300 * b.kb } : { x: b.vx * 0.05, y: b.vy * 0.05 }, burn: b.burn });
      if (b.pierce-- <= 0) { b.dead = true; return false; }
    });
  }
  bullets = bullets.filter(b => !b.dead);
  for (const r of rangs) {
    r.spin += dt * 18;
    const sp = 230;
    if (!r.back) { r.d += sp * dt; r.x += Math.cos(r.a) * sp * dt; r.y += Math.sin(r.a) * sp * dt; if (r.d >= r.max) r.back = true; }
    else { const dx = P.x - r.x, dy = P.y - 6 - r.y, d = Math.hypot(dx, dy); if (d < 10) { r.dead = true; continue; } r.x += dx / d * sp * 1.1 * dt; r.y += dy / d * sp * 1.1 * dt; }
    query(r.x, r.y + 4, 6 * r.size, z => { const last = r.hits.get(z) || -9; if (t - last > 0.4) { r.hits.set(z, t); hit(z, r.dmg, { burn: r.burn, kb: { x: Math.cos(r.a) * 40, y: Math.sin(r.a) * 40 } }); } });
    if (r.burn && parts.length < 1400 && Math.random() < 0.6) parts.push({ x: r.x, y: r.y, vx: 0, vy: -20, life: 0.3, t: 0, col: pick(['#ff8a3a', '#ffe650']), s: 1 });
  }
  rangs = rangs.filter(r => !r.dead);
  for (const l of lobs) {
    l.t += dt;
    if (l.t >= l.dur) { l.dead = true; pools.push({ x: l.tx, y: l.ty, r: l.s.radius * P.area, dps: l.s.dps, t: 0, dur: l.s.dur, tick: 0 }); sfx('glass', 0.08, () => { Sound.hiss(0.08, { freq: 6000, vol: 0.08 }); Sound.hiss(0.6, { filter: 'lowpass', freq: 800, vol: 0.08 }); }); }
  }
  lobs = lobs.filter(l => !l.dead);
  for (const p of pools) {
    p.t += dt; p.tick += dt;
    if (p.tick >= 0.25) { p.tick = 0; query(p.x, p.y, p.r, z => hit(z, p.dps * 0.25, { burn: false })); }
    if (parts.length < 1400 && Math.random() < 0.7) { const a = Math.random() * 6.283, r = Math.random() * p.r; parts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.6, vx: 0, vy: rand(-30, -15), life: 0.4, t: 0, col: pick(['#ff6a1a', '#ffb040', '#ffe650']), s: Math.random() < 0.3 ? 2 : 1 }); }
    if (p.t > p.dur) p.dead = true;
  }
  pools = pools.filter(p => !p.dead);
  for (const r of rockets) {
    r.life -= dt;
    if (!r.tg || r.tg.dead) r.tg = nearest(r.x, r.y, 260) || (zs.length ? pick(zs) : null);
    if (r.tg) { const a = Math.atan2(r.tg.y - 4 - r.y, r.tg.x - r.x), sp = 200; r.vx = lerp(r.vx, Math.cos(a) * sp, Math.min(1, dt * 4)); r.vy = lerp(r.vy, Math.sin(a) * sp, Math.min(1, dt * 4)); }
    r.x += r.vx * dt; r.y += r.vy * dt;
    if (parts.length < 1400) parts.push({ x: r.x, y: r.y, vx: rand(-8, 8), vy: rand(-8, 8), life: 0.35, t: 0, col: Math.random() < 0.5 ? '#ffb040' : '#8a8a94', s: 1 });
    let boom = r.life <= 0;
    if (!boom) query(r.x, r.y + 4, 4, () => { boom = true; return false; });
    if (boom) { r.dead = true; explode(r.x, r.y, r.r, r.dmg); }
  }
  rockets = rockets.filter(r => !r.dead);
  // enemy bullets
  for (const b of ebullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD) { b.dead = true; continue; }
    if (Math.hypot(b.x - P.x, b.y - (P.y - 6)) < b.r + 5) { b.dead = true; hurtPlayer(b.dmg, 'shot'); }
  }
  ebullets = ebullets.filter(b => !b.dead);
}

// ------------------------------------------------------------ zombies
function updateZombies(dt) {
  buildGrid();
  for (const z of zs) {
    if (z.dead) continue;
    z.flash -= dt; z.bladeT -= dt;
    if (z.burnT > 0) { z.burnT -= dt; z.burnTick = (z.burnTick || 0) + dt; if (z.burnTick > 0.33) { z.burnTick = 0; z.hp -= z.burn * 0.33; if (z.hp <= 0) { kill(z); continue; } if (parts.length < 1400) parts.push({ x: z.x + rand(-3, 3), y: z.y - 8, vx: 0, vy: -20, life: 0.35, t: 0, col: '#ff8a3a', s: 1 }); } }
    if (z.slowT > 0) z.slowT -= dt; else z.slow = 0;
    // knockback
    z.x += z.kx * dt; z.y += z.ky * dt; z.kx *= 0.85; z.ky *= 0.85;
    if (z.frozen > 0) { z.frozen -= dt; continue; }
    const dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy) || 1;
    let mx = dx / d, my = dy / d, sp = z.spd * (1 - z.slow);
    if (z.boss) { bossAI(z, dt, dx, dy, d); if (z.mode === 'charge' || z.mode === 'tele') { sp = 0; } }
    else if (z.D.ranged) {
      if (d < 110) { mx = -mx * 0.6; my = -my * 0.6; } else if (d < 150) { mx = -my; my = dx / d; sp *= 0.5; }
      z.atk -= dt; if (z.atk <= 0 && d < 200) { z.atk = rand(3.5, 4.5); const a = Math.atan2(dy - 6, dx); ebullets.push({ x: z.x, y: z.y - 8, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, dmg: z.dmg, r: 3, life: 3, col: '#c8e03a' }); sfx('spit', 0.15, () => Sound.hiss(0.1, { filter: 'bandpass', freq: 1200, q: 2, vol: 0.05 })); }
    } else if (z.D.summons) {
      z.atk -= dt; if (z.atk <= 0 && d < 260) { z.atk = 6; for (let k = 0; k < 4; k++) { const m = spawnZombie('crawler', { x: z.x + rand(-16, 16), y: z.y + rand(-16, 16) }); } run.quota += 4; rings.push({ x: z.x, y: z.y, r: 2, max: 26, t: 0, dur: 0.4, col: '#c46cff' }); }
    }
    z.x += mx * sp * dt; z.y += my * sp * dt;
    // keep apart from neighbours
    const c = clamp(z.x / CELL | 0, 0, GC - 1), r = clamp(z.y / CELL | 0, 0, GC - 1);
    let px_ = 0, py_ = 0, cnt = 0;
    for (let rr = Math.max(0, r - 1); rr <= Math.min(GC - 1, r + 1); rr++) for (let cc = Math.max(0, c - 1); cc <= Math.min(GC - 1, c + 1); cc++) {
      const cell = grid[rr * GC + cc];
      for (let i = 0; i < cell.length && cnt < 10; i++) {
        const o = cell[i]; if (o === z) continue;
        const ox = z.x - o.x, oy = z.y - o.y, min = z.r + o.r - 1;
        const dd = ox * ox + oy * oy;
        if (dd < min * min && dd > 0.01) { const dl = Math.sqrt(dd), push = (min - dl) / dl * (z.boss ? 0.05 : o.boss ? 1 : 0.5); px_ += ox * push; py_ += oy * push; cnt++; }
      }
    }
    z.x += clamp(px_, -3, 3); z.y += clamp(py_, -3, 3);
    z.x = clamp(z.x, 16, WORLD - 16); z.y = clamp(z.y, 18, WORLD - 14);
    z.face = dx < 0 ? -1 : 1; z.anim += dt * (sp / 10);
    // touch damage
    if (d < z.r + 6) hurtPlayer(z.dmg, z.boss ? 'boss' : z.type);
  }
  zs = zs.filter(z => !z.dead);
}
function bossAI(z, dt, dx, dy, d) {
  z.modeT -= dt; z.atk -= dt;
  const B = z.D;
  if (z.mode === 'walk' && z.atk <= 0) {
    const atk = pick(B.attacks);
    z.atk = rand(3, 4.5);
    if (atk === 'ring') { const n = 18; for (let k = 0; k < n; k++) { const a = k / n * 6.283; ebullets.push({ x: z.x, y: z.y - z.r, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, dmg: z.dmg * 0.6, r: 4, life: 4, col: B.tint || '#b8e04a' }); } SND.bossShot(); }
    else if (atk === 'spiral') { z.mode = 'spiral'; z.modeT = 2.2; z.spiralA = 0; z.spiralT = 0; }
    else if (atk === 'summon' && B.summon) { for (let k = 0; k < 10; k++) spawnZombie(B.summon, { x: z.x + rand(-40, 40), y: z.y + rand(-40, 40) }); run.quota += 10; rings.push({ x: z.x, y: z.y, r: 4, max: 60, t: 0, dur: 0.5, col: '#c46cff' }); SND.summon(); }
    else if (atk === 'charge') { z.mode = 'tele'; z.modeT = 0.8; const a = Math.atan2(dy, dx); z.ca = a; tele.push({ kind: 'line', x: z.x, y: z.y, a, len: 260, t: 0, dur: 0.8 }); SND.warn(); }
    else if (atk === 'slam') { z.mode = 'slamwait'; z.modeT = 1.0; z.slamX = P.x; z.slamY = P.y; tele.push({ kind: 'circle', x: P.x, y: P.y, r: 70, t: 0, dur: 1.0 }); SND.warn(); }
  }
  if (z.mode === 'spiral') { z.spiralT -= dt; if (z.spiralT <= 0) { z.spiralT = 0.08; for (let k = 0; k < 3; k++) { const a = z.spiralA + k * 2.094; ebullets.push({ x: z.x, y: z.y - z.r, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, dmg: z.dmg * 0.5, r: 3, life: 4, col: B.tint || '#ff6ad8' }); } z.spiralA += 0.32; } if (z.modeT <= 0) z.mode = 'walk'; }
  if (z.mode === 'tele' && z.modeT <= 0) { z.mode = 'charge'; z.modeT = 1.0; shake = 0.3; SND.roar(); }
  if (z.mode === 'charge') { z.x += Math.cos(z.ca) * 260 * dt; z.y += Math.sin(z.ca) * 260 * dt; if (parts.length < 1400) parts.push({ x: z.x + rand(-z.r, z.r), y: z.y, vx: 0, vy: -10, life: 0.4, t: 0, col: '#6a5a4a', s: 2 }); if (z.modeT <= 0) z.mode = 'walk'; }
  if (z.mode === 'slamwait' && z.modeT <= 0) {
    z.mode = 'walk'; z.x = lerp(z.x, z.slamX, 0.6); z.y = lerp(z.y, z.slamY, 0.6);
    if (Math.hypot(P.x - z.slamX, P.y - z.slamY) < 70) hurtPlayer(z.dmg * 1.3, 'slam');
    rings.push({ x: z.slamX, y: z.slamY, r: 4, max: 70, t: 0, dur: 0.35, col: '#ffb040' }); shake = 0.8; SND.slam();
    for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283; parts.push({ x: z.slamX + Math.cos(a) * 60, y: z.slamY + Math.sin(a) * 40, vx: Math.cos(a) * 40, vy: -40, life: 0.5, t: 0, col: '#6a5a4a', s: 2, g: 150 }); }
  }
}

// ------------------------------------------------------------ player
function updatePlayer(dt) {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (stick.on) { const sx = stick.x - stick.ox, sy = stick.y - stick.oy, l = Math.hypot(sx, sy); if (l > 10) { mx = sx / Math.max(l, 60); my = sy / Math.max(l, 60); } }
  if (window.__zbAI) { const v = window.__zbAI(); mx = v[0]; my = v[1]; }
  const l = Math.hypot(mx, my);
  if (l > 1) { mx /= l; my /= l; }
  P.moving = l > 0.1;
  if (P.moving) { P.aimX = mx / (l || 1); P.aimY = my / (l || 1); if (Math.abs(mx) > 0.1) P.face = mx > 0 ? 1 : -1; P.anim += dt * 10; }
  P.x = clamp(P.x + mx * P.speed * dt, 20, WORLD - 20); P.y = clamp(P.y + my * P.speed * dt, 26, WORLD - 18);
  P.inv -= dt; P.muzzle = (P.muzzle || 0) - dt;
  if (P.regen) { P.hp = Math.min(P.maxHp, P.hp + P.regen * dt); }
  // pickups
  for (const p of pickups) {
    p.t += dt;
    if (p.vx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; if (Math.abs(p.vx) < 1) p.vx = 0; }
    const d = Math.hypot(P.x - p.x, P.y - 4 - p.y);
    if (d < 9) { p.dead = true; collect(p); continue; }
    if (p.pull || d < P.magnet || (p.kind !== 'coin' && d < 24)) {
      if (p.kind === 'coin' || p.pull) p.pull = true;
      p.pt = (p.pt || 0) + dt; const step = Math.min(d, (240 + p.pt * 300) * dt); p.x += (P.x - p.x) / d * step; p.y += (P.y - 4 - p.y) / d * step;
    }
  }
  pickups = pickups.filter(p => !p.dead);
}
function collect(p) {
  if (p.kind === 'coin') { addCoins(p.v); sfx('coin', 0.03, () => Sound.blip(1318 + Math.random() * 300, 0.04, { type: 'square', vol: 0.03 })); }
  else if (p.kind === 'meat') { P.hp = Math.min(P.maxHp, P.hp + 30); floats.push({ x: P.x, y: P.y - 18, text: '+30', col: '#6aff6a', t: 0, big: true }); SND.heal(); }
  else if (p.kind === 'magnet') { pickups.forEach(q => { if (q.kind === 'coin') q.pull = true; }); toast('MAGNET!', '#ff6a6a', 1.5); SND.heal(); }
  else if (p.kind === 'nuke') { whiteFlash = 1; shake = 1; randomOnScreen().forEach(z => { if (!z.boss) hit(z, 99999); else hit(z, 500); }); toast('NUKE!', '#ffe650', 1.5); SND.nuke(); }
  else if (p.kind === 'chest') { run.extraPicks++; addCoins(30); toast('BOSS CHEST: +1 extra upgrade after this wave!', '#ffe680', 3); SND.pick(true); }
}

// ------------------------------------------------------------ update
function update(dt) {
  if (state !== 'play') return;
  run.time += dt;
  if (run.phase === 'ready') { run.phaseT -= dt; if (run.phaseT <= 0) beginWave(); }
  else if (run.phase === 'clear') { run.phaseT -= dt; if (run.phaseT <= 0 && !pickups.some(p => p.pull)) { if (run.wave >= FINAL_WAVE && !run.endless) { win(); return; } openPick(); } }
  updatePlayer(dt);
  updateSpawns(dt);
  fireWeapons(dt);
  updateShots(dt);
  updateZombies(dt);
}
function updateFx(dt) {
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + (p.g || 0) * dt; }
  parts = parts.filter(p => p.t < p.life);
  floats.forEach(f => { f.t += dt; f.y -= 22 * dt; }); floats = floats.filter(f => f.t < 0.8);
  rings.forEach(r => r.t += dt); rings = rings.filter(r => r.t < r.dur);
  strikes.forEach(s => s.t += dt); strikes = strikes.filter(s => s.t < 0.16);
  beams.forEach(b => b.t += dt); beams = beams.filter(b => b.t < 0.22);
  novas.forEach(n => { n.t += dt; n.r = n.max * Math.min(1, n.t / 0.3); }); novas = novas.filter(n => n.t < 0.45);
  slashes.forEach(s => s.t += dt); slashes = slashes.filter(s => s.t < 0.2);
  tele.forEach(s => s.t += dt); tele = tele.filter(s => s.t < s.dur);
  lights.forEach(l => l.t += dt); lights = lights.filter(l => l.t < l.dur);
  shake = Math.max(0, shake - dt * 2.5); hurtFlash = Math.max(0, hurtFlash - dt); whiteFlash = Math.max(0, whiteFlash - dt * 1.5);
}

// ------------------------------------------------------------ drawing (world, low-res)
function px(x, y, col, w = 1, h = 1) { lx.fillStyle = col; lx.fillRect(Math.round(x), Math.round(y), w, h); }
function drawWorld() {
  cam.x = Math.round(clamp(P.x - VW / 2, 0, WORLD - VW)); cam.y = Math.round(clamp(P.y - VH / 2, 0, WORLD - VH));
  const sx = shake > 0 ? Math.round(rand(-1, 1) * shake * 5) : 0, sy = shake > 0 ? Math.round(rand(-1, 1) * shake * 5) : 0;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.drawImage(ground, cam.x + sx, cam.y + sy, VW, VH, 0, 0, VW, VH);
  lx.translate(-cam.x - sx, -cam.y - sy);
  const inView = (x, y, m = 30) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
  // fire pools
  pools.forEach(p => { if (!inView(p.x, p.y, 60)) return; const a = Math.min(1, (p.dur - p.t) * 2); lx.globalAlpha = 0.35 * a; lx.fillStyle = '#ff5a1a'; lx.beginPath(); lx.ellipse(p.x, p.y, p.r, p.r * 0.6, 0, 0, 6.3); lx.fill(); lx.globalAlpha = 0.5 * a; lx.fillStyle = '#ffb040'; lx.beginPath(); lx.ellipse(p.x, p.y, p.r * 0.6, p.r * 0.35, 0, 0, 6.3); lx.fill(); lx.globalAlpha = 1; });
  // aura
  const aw = P.weapons.find(w => w.id === 'aura');
  if (aw) { const s = wstat(aw), r = s.radius * P.area; lx.globalAlpha = 0.13 + 0.05 * Math.sin(t * 6); lx.fillStyle = '#6aff4a'; lx.beginPath(); lx.ellipse(P.x, P.y - 2, r, r * 0.8, 0, 0, 6.3); lx.fill(); lx.globalAlpha = 0.5; lx.strokeStyle = '#b8ff8a'; lx.lineWidth = 1; lx.setLineDash([3, 3]); lx.lineDashOffset = -t * 20; lx.stroke(); lx.setLineDash([]); lx.globalAlpha = 1; }
  // telegraphs
  tele.forEach(s => { const a = 0.3 + 0.4 * Math.abs(Math.sin(s.t * 14)); lx.globalAlpha = a; if (s.kind === 'line') { lx.strokeStyle = '#ff3a3a'; lx.lineWidth = 12; lx.beginPath(); lx.moveTo(s.x, s.y); lx.lineTo(s.x + Math.cos(s.a) * s.len, s.y + Math.sin(s.a) * s.len); lx.stroke(); } else { lx.fillStyle = '#ff3a3a'; lx.beginPath(); lx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, 6.3); lx.fill(); lx.globalAlpha = 0.9; lx.strokeStyle = '#ffffff'; lx.lineWidth = 1; lx.beginPath(); lx.ellipse(s.x, s.y, s.r * s.t / s.dur, s.r * 0.7 * s.t / s.dur, 0, 0, 6.3); lx.stroke(); } lx.globalAlpha = 1; });
  // pickups
  pickups.forEach(p => {
    if (!inView(p.x, p.y)) return;
    const bob = Math.sin(t * 5 + p.x) * 1.5;
    if (p.kind === 'coin') { const s = sprite('coin'); const sc = p.v >= 5 ? 1.6 : 1; lx.drawImage(s.n, Math.round(p.x - 3 * sc), Math.round(p.y - 6 * sc + bob), s.width * sc, s.height * sc); }
    else { const name = p.kind === 'chest' ? 'goldchest' : p.kind; const s = sprite(name); lx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 6); lx.fillStyle = p.kind === 'nuke' ? '#ffe650' : p.kind === 'meat' ? '#ff6a6a' : '#ffffff'; lx.beginPath(); lx.arc(p.x, p.y - 4, 9, 0, 6.3); lx.fill(); lx.globalAlpha = 1; lx.drawImage(s.n, Math.round(p.x - s.width / 2), Math.round(p.y - s.height + bob)); }
  });
  // collect sprites, sort by y
  const list = [];
  for (const z of zs) if (inView(z.x, z.y, 40 + z.r * 2)) list.push(z);
  list.push(P);
  list.sort((a, b) => a.y - b.y);
  const sh = shadow();
  for (const z of list) {
    if (z === P) { drawPlayer(); continue; }
    const sc = (z.boss ? z.D.scale : z.D.scale) * (z.type === 'crawler' && !z.boss ? 0.9 : 1);
    const s = z.spr, w = s.width * sc, h = s.height * sc;
    const moving = z.frozen <= 0;
    const bob = moving ? -Math.abs(Math.sin(z.anim)) * 1.2 * sc : 0;
    const lean = moving ? Math.sin(z.anim) * 0.06 : 0;
    lx.drawImage(sh, Math.round(z.x - w * 0.4), Math.round(z.y - 2), Math.round(w * 0.8), Math.max(3, Math.round(4 * sc)));
    const big = z.boss || z.D.heavy;
    const img = z.flash > 0 && !big ? (z.face < 0 ? s.wf : s.w) : (z.face < 0 ? s.f : s.n);
    if (lean && big) { lx.save(); lx.translate(Math.round(z.x), Math.round(z.y)); lx.rotate(lean); lx.drawImage(img, -w / 2, -h + bob, w, h); if (z.flash > 0) { lx.globalAlpha = 0.45; lx.drawImage(z.face < 0 ? s.wf : s.w, -w / 2, -h + bob, w, h); lx.globalAlpha = 1; } lx.restore(); }
    else lx.drawImage(img, Math.round(z.x - w / 2), Math.round(z.y - h + bob), w, h);
    if (z.frozen > 0) { lx.globalAlpha = 0.55; lx.drawImage(z.face < 0 ? s.wf : s.w, Math.round(z.x - w / 2), Math.round(z.y - h), w, h); lx.globalAlpha = 1; px(z.x - w / 2, z.y - h, '#c8f0ff', w, 1); }
    else if (z.slow > 0 && Math.random() < 0.05) parts.push({ x: z.x + rand(-3, 3), y: z.y - h * 0.6, vx: 0, vy: -10, life: 0.4, t: 0, col: '#a8e8ff', s: 1 });
    if (z.D.crown) { const cy = z.y - h + bob - 4; px(z.x - 9, cy, '#ffcc33', 18, 4); for (let k = 0; k < 4; k++) px(z.x - 9 + k * 5, cy - 3, '#ffcc33', 3, 3); px(z.x - 1, cy + 1, '#e83a4a', 2, 2); }
    if (z.boss && z.mode === 'charge') { lx.globalAlpha = 0.4; px(z.x - w / 2, z.y - h, '#ff3a3a', w, h); lx.globalAlpha = 1; }
    if (!z.boss && z.hp < z.max && (z.D.heavy || z.D.summons)) { const bw = Math.max(10, w * 0.7); px(z.x - bw / 2 - 1, z.y - h - 4, '#0a0610', bw + 2, 3); px(z.x - bw / 2, z.y - h - 3, '#ff4a5a', bw * Math.max(0, z.hp / z.max), 1); }
  }
  // drones
  P.weapons.forEach(w => { if (w.id === 'drone' && w.st.ds) w.st.ds.forEach(d => { lx.drawImage(sh, Math.round(d.x - 4), Math.round(d.y + 18), 8, 3); px(d.x - 4, d.y - 2, '#1a1a24', 9, 5); px(d.x - 3, d.y - 1, '#6a6a7a', 7, 3); px(d.x - 1, d.y, Math.sin(t * 10) > 0 ? '#ff3a3a' : '#ff9a9a', 2, 1); px(d.x - 6, d.y - 4, '#aaaaba', 4, 1); px(d.x + 3, d.y - 4, '#aaaaba', 4, 1); }); });
  // blades
  P.weapons.forEach(w => { if (w.id === 'blades' && w.st.pos) { const s = wstat(w), big = s.max ? 1.5 : 1; w.st.pos.forEach(b => { lx.save(); lx.translate(b.x, b.y); lx.rotate(t * 14); const r = 5 * big * P.area; lx.fillStyle = '#1a1a24'; lx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * 0.785, rr = k % 2 ? r * 0.55 : r + 1; lx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } lx.fill(); lx.fillStyle = s.max ? '#ffd080' : '#c8d8f0'; lx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * 0.785, rr = k % 2 ? r * 0.45 : r; lx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } lx.fill(); lx.fillStyle = '#ffffff'; lx.fillRect(-1, -1, 2, 2); lx.restore(); }); } });
  // boomerangs
  rangs.forEach(r => { lx.save(); lx.translate(r.x, r.y); lx.rotate(r.spin); const s = 5 * r.size; lx.strokeStyle = '#1a0a04'; lx.lineWidth = 4; lx.beginPath(); lx.moveTo(-s, -s * 0.2); lx.lineTo(0, s * 0.5); lx.lineTo(s, -s * 0.2); lx.stroke(); lx.strokeStyle = r.burn ? '#ff8a3a' : '#e8a040'; lx.lineWidth = 2; lx.stroke(); lx.restore(); });
  // molotov bottles in the air
  lobs.forEach(l => { const u = l.t / l.dur, x = lerp(l.sx, l.tx, u), y = lerp(l.sy, l.ty, u) - Math.sin(u * Math.PI) * 40; px(x - 1, y - 2, '#3a8a3a', 3, 4); px(x, y - 4, '#ffb040', 1, 2); });
  // rockets
  rockets.forEach(r => { const a = Math.atan2(r.vy, r.vx); lx.save(); lx.translate(r.x, r.y); lx.rotate(a); lx.fillStyle = '#d8d8e0'; lx.fillRect(-4, -1.5, 7, 3); lx.fillStyle = '#e83a3a'; lx.fillRect(2, -1.5, 2, 3); lx.fillStyle = '#ffe650'; lx.fillRect(-6, -1, 2, 2); lx.restore(); });
  // bullets
  bullets.forEach(b => {
    if (b.kind === 'laser') { lx.strokeStyle = '#ff5a5a'; lx.lineWidth = 1; lx.beginPath(); lx.moveTo(b.x, b.y); lx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); lx.stroke(); return; }
    if (b.kind === 'fire') { px(b.x - 1, b.y - 1, '#ff8a3a', 3, 3); px(b.x, b.y, '#ffe650'); return; }
    lx.strokeStyle = b.kind === 'pellet' ? '#ffd080' : '#fff3a0'; lx.lineWidth = b.kind === 'pellet' ? 1 : 2; lx.beginPath(); lx.moveTo(b.x, b.y); lx.lineTo(b.x - b.vx * 0.015, b.y - b.vy * 0.015); lx.stroke();
  });
  ebullets.forEach(b => { lx.globalAlpha = 0.4; px(b.x - b.r - 1, b.y - b.r - 1, b.col, b.r * 2 + 3, b.r * 2 + 3); lx.globalAlpha = 1; px(b.x - b.r + 1, b.y - b.r + 1, b.col, b.r * 2 - 1, b.r * 2 - 1); px(b.x - 1, b.y - 1, '#ffffff', 2, 2); });
  // beams
  beams.forEach(b => { const a = 1 - b.t / 0.22; lx.globalAlpha = a; lx.strokeStyle = '#ff3a8a'; lx.lineWidth = b.w * 2 * a + 1; lx.beginPath(); lx.moveTo(b.x1, b.y1); lx.lineTo(b.x2, b.y2); lx.stroke(); lx.strokeStyle = '#ffe0f0'; lx.lineWidth = Math.max(1, b.w * a * 0.7); lx.stroke(); lx.globalAlpha = 1; });
  // lightning
  strikes.forEach(s => { const a = 1 - s.t / 0.16; lx.strokeStyle = `rgba(255,255,170,${a})`; lx.lineWidth = s.chain ? 1 : 2; lx.beginPath(); lx.moveTo(s.x1, s.y1); const n = s.chain ? 4 : 8; for (let k = 1; k < n; k++) lx.lineTo(lerp(s.x1, s.x2, k / n) + rand(-5, 5), lerp(s.y1, s.y2, k / n) + rand(-3, 3)); lx.lineTo(s.x2, s.y2); lx.stroke(); lx.strokeStyle = `rgba(255,255,255,${a})`; lx.lineWidth = 1; lx.stroke(); });
  // slashes
  slashes.forEach(s => { const u = s.t / 0.2; lx.globalAlpha = 1 - u; lx.strokeStyle = '#ffffff'; lx.lineWidth = 3; lx.beginPath(); if (s.spin) lx.arc(P.x, P.y - 4, s.reach * (0.6 + u * 0.4), u * 6.28, u * 6.28 + 4.5); else lx.arc(P.x, P.y - 4, s.reach * (0.6 + u * 0.4), s.a - 1.2 + u * 0.6, s.a + 1.2 * (u * 2 - 1)); lx.stroke(); lx.strokeStyle = '#c8d8f0'; lx.lineWidth = 1; lx.stroke(); lx.globalAlpha = 1; });
  // novas
  novas.forEach(n => { lx.globalAlpha = 1 - n.t / 0.45; lx.strokeStyle = '#c8f0ff'; lx.lineWidth = 3; lx.beginPath(); lx.ellipse(n.x, n.y, n.r, n.r * 0.75, 0, 0, 6.3); lx.stroke(); lx.fillStyle = 'rgba(140,210,255,0.15)'; lx.fill(); lx.globalAlpha = 1; });
  rings.forEach(r => { const u = r.t / r.dur; lx.globalAlpha = 1 - u; lx.strokeStyle = r.col; lx.lineWidth = 2; lx.beginPath(); lx.ellipse(r.x, r.y, lerp(r.r, r.max, u), lerp(r.r, r.max, u) * 0.75, 0, 0, 6.3); lx.stroke(); lx.globalAlpha = 1; });
  // particles
  for (const p of parts) { if (!inView(p.x, p.y, 4)) continue; lx.globalAlpha = 1 - p.t / p.life; lx.fillStyle = p.col; lx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
  lx.globalAlpha = 1;
  // burning barrels (animated fire)
  fires.forEach(f => { if (!inView(f.x, f.y)) return; for (let k = 0; k < 4; k++) { const h = 3 + Math.abs(Math.sin(t * 9 + k * 1.7 + f.x)) * 6; px(f.x - 4 + k * 2, f.y - 6 - h, k % 2 ? '#ff6a1a' : '#ffb040', 2, h); } px(f.x - 1, f.y - 8, '#ffe650', 2, 2); });
  lx.setTransform(1, 0, 0, 1, 0, 0);
  drawLighting();
}
function drawPlayer() {
  const C = run.char, s = sprite('hero', null, { h: C.hair, H: shade(C.hair, 0.25), j: C.jacket, J: shade(C.jacket, 0.3) });
  const bob = P.moving ? -Math.abs(Math.sin(P.anim)) * 1.5 : Math.sin(t * 2) * 0.5;
  lx.drawImage(shadow(), Math.round(P.x - 6), Math.round(P.y - 2), 12, 4);
  lx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5); lx.strokeStyle = '#8aff6a'; lx.lineWidth = 1; lx.beginPath(); lx.ellipse(P.x, P.y, 9, 4, 0, 0, 6.3); lx.stroke(); lx.globalAlpha = 1;
  if (P.inv > 0 && Math.floor(t * 20) % 2) return;
  const img = P.inv > 0.3 ? (P.face < 0 ? s.wf : s.w) : (P.face < 0 ? s.f : s.n);
  // legs scissor
  lx.drawImage(img, Math.round(P.x - 6), Math.round(P.y - 16 + bob));
  // gun in hand pointing at aim
  const a = Math.atan2(P.aimY, P.aimX);
  lx.save(); lx.translate(Math.round(P.x), Math.round(P.y - 7 + bob)); lx.rotate(a);
  if (Math.cos(a) < 0) lx.scale(1, -1);
  lx.fillStyle = '#0a0a10'; lx.fillRect(2, -2, 8, 3); lx.fillStyle = '#5a5a6a'; lx.fillRect(3, -2, 6, 2);
  if (P.muzzle > 0) { lx.fillStyle = '#ffe650'; lx.fillRect(10, -3, 3, 4); lx.fillStyle = '#ffffff'; lx.fillRect(10, -2, 2, 2); }
  lx.restore();
  // hp bar
  if (P.hp < P.maxHp) { px(P.x - 9, P.y + 3, '#0a0610', 18, 3); px(P.x - 8, P.y + 4, '#3a0a14', 16, 1); px(P.x - 8, P.y + 4, '#5aff5a', 16 * clamp(P.hp / P.maxHp, 0, 1), 1); }
}
function drawLighting() {
  const g = dx_;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, VW, VH);
  const n = run ? run.wave : 1;
  g.fillStyle = `rgba(6,6,22,${Math.min(0.6, 0.48 + n * 0.004)})`; g.fillRect(0, 0, VW, VH);
  g.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => { const sx = x - cam.x, sy = y - cam.y; if (sx < -r || sy < -r || sx > VW + r || sy > VH + r) return; const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(sx - r, sy - r, r * 2, r * 2); };
  hole(P.x, P.y - 6, 170, 0.95);
  lamps.forEach(l => hole(l.x, l.y - 10, 75 + Math.sin(t * 3 + l.x) * 2, 0.85));
  fires.forEach(f => hole(f.x, f.y - 8, 55 + Math.sin(t * 13 + f.x) * 5, 0.8));
  pools.forEach(p => hole(p.x, p.y, p.r * 2.4, 0.8));
  lights.forEach(l => hole(l.x, l.y, l.r, 1 - l.t / l.dur));
  rockets.forEach(r => hole(r.x, r.y, 30, 0.6));
  if (P.muzzle > 0) hole(P.x, P.y - 6, 80, 0.6);
  g.globalCompositeOperation = 'source-over';
  lx.drawImage(dark, 0, 0);
  // warm glow colour on top
  lx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => { const sx = x - cam.x, sy = y - cam.y; if (sx < -r || sy < -r || sx > VW + r || sy > VH + r) return; const gr = lx.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); lx.fillStyle = gr; lx.fillRect(sx - r, sy - r, r * 2, r * 2); };
  lamps.forEach(l => glow(l.x, l.y - 18, 40, '#ffd890', 0.18));
  fires.forEach(f => glow(f.x, f.y - 8, 34, '#ff7a2a', 0.25 + Math.sin(t * 11 + f.x) * 0.05));
  pools.forEach(p => glow(p.x, p.y, p.r * 1.6, '#ff6a1a', 0.2));
  lights.forEach(l => glow(l.x, l.y, l.r * 0.6, l.col, 0.35 * (1 - l.t / l.dur)));
  lx.globalCompositeOperation = 'source-over';
  // zombie eyes glow in the dark (big ones only, keeps it cheap)
}

// ------------------------------------------------------------ UI helpers
function text(s, x, y, size = 16, col = '#fff', align = 'left', shadow_ = true) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow_) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(s, x + Math.max(2, size / 8), y + Math.max(2, size / 8)); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function wrapText(s, x, y, maxW, size, col, lh, align = 'left') {
  ctx.font = `${size}px ${FONT}`; const words = s.split(' '); let line = '', yy = y;
  words.forEach(w => { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { text(line, x, yy, size, col, align); line = w; yy += lh; } else line = tt; });
  if (line) text(line, x, yy, size, col, align); return yy + lh;
}
function panel(x, y, w, h, border = '#3a4a3a', fill = '#101410') {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 6, y + 6, w, h);
  ctx.fillStyle = '#050605'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = fill; ctx.fillRect(x + 7, y + 7, w - 14, h - 14);
  ctx.fillStyle = shade(border, 0.3); ctx.fillRect(x + 3, y + 3, w - 6, 2);
}
function button(id, x, y, w, h, label, o = {}) {
  const over = mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  if (over && !o.disabled) UI.hover = id;
  const pressed = over && UI.down, base = o.disabled ? '#2a2e2a' : (o.color || '#2a5a2a'), dy = pressed ? 3 : 0;
  ctx.fillStyle = '#050605'; ctx.fillRect(x, y + 4, w, h);
  ctx.fillStyle = shade(base, -0.45); ctx.fillRect(x, y + dy, w, h);
  ctx.fillStyle = over && !o.disabled ? shade(base, 0.15) : base; ctx.fillRect(x, y + dy, w, h - 5);
  ctx.fillStyle = shade(base, 0.35); ctx.fillRect(x, y + dy, w, 3);
  if (o.draw) o.draw(x, y + dy);
  if (label) text(label, x + w / 2, y + dy + (h - 5 - (o.size || 16)) / 2 + 1, o.size || 16, o.disabled ? '#6a706a' : (o.tc || '#ffffff'), 'center');
  const c = UI.click;
  if (c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { UI.click = null; if (o.disabled) { Sound.play('error'); return false; } Sound.play(o.sfx || 'click'); return true; }
  return false;
}
function drawIcon(kind, id, x, y, sc) { ctx.imageSmoothingEnabled = false; ctx.drawImage(icon(id, kind), x, y, 10 * sc, 10 * sc); }
function pips(x, y, lv, to, size = 10, gap = 4) { for (let k = 0; k < MAX_LV; k++) { ctx.fillStyle = '#050605'; ctx.fillRect(x + k * (size + gap) - 1, y - 1, size + 2, size + 2); ctx.fillStyle = k < lv ? '#ffcc33' : k < to ? (Math.sin(t * 8) > 0 ? '#8aff6a' : '#4a8a3a') : '#2a2a2a'; ctx.fillRect(x + k * (size + gap), y, size, size); } }
function toast(s, col = '#fff', dur = 2.5) { toastQ.push({ s, col, t: 0, dur }); if (toastQ.length > 3) toastQ.shift(); }
const sfxLast = {};
function sfx(name, gap, fn) { if (t - (sfxLast[name] || -9) < gap) return; sfxLast[name] = t; fn(); }

// ------------------------------------------------------------ HUD
function drawHUD() {
  // weapon + passive slots
  for (let i = 0; i < WEAPON_SLOTS; i++) {
    const x = 16 + i * 54, y = 14, w = P.weapons[i];
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, 48, 48); ctx.fillStyle = w ? (w.lv >= MAX_LV ? '#8a6a1a' : '#2a3a2a') : '#1a1a1a'; ctx.fillRect(x + 2, y + 2, 44, 44);
    if (w) { drawIcon('weapon', w.id, x + 4, y + 2, 4); for (let k = 0; k < w.lv; k++) { ctx.fillStyle = w.lv >= MAX_LV ? '#ffcc33' : '#e8e8e8'; ctx.fillRect(x + 5 + k * 8, y + 42, 6, 3); } }
  }
  const pas = Object.entries(P.passives);
  for (let i = 0; i < PASSIVE_SLOTS; i++) {
    const x = 16 + i * 40, y = 68, p = pas[i];
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, 34, 34); ctx.fillStyle = p ? '#2a2a3a' : '#141414'; ctx.fillRect(x + 2, y + 2, 30, 30);
    if (p) { drawIcon('passive', p[0], x + 2, y + 1, 3); for (let k = 0; k < p[1]; k++) { ctx.fillStyle = p[1] >= MAX_LV ? '#ffcc33' : '#c8c8d8'; ctx.fillRect(x + 4 + k * 6, y + 29, 4, 2); } }
  }
  // wave + progress
  const left = run.phase === 'fight' ? run.spawnLeft + zs.length : 0;
  text(run.endless && run.wave > FINAL_WAVE ? `WAVE ${run.wave}` : `WAVE ${run.wave}/${FINAL_WAVE}`, W / 2, 14, 20, '#ffe680', 'center');
  if (run.phase === 'fight') {
    const bw = 360, bx = W / 2 - bw / 2, by = 44, prog = clamp(1 - left / Math.max(1, run.quota), 0, 1);
    ctx.fillStyle = '#050605'; ctx.fillRect(bx - 3, by - 3, bw + 6, 16); ctx.fillStyle = '#1a2a1a'; ctx.fillRect(bx, by, bw, 10); ctx.fillStyle = '#5ac83a'; ctx.fillRect(bx, by, bw * prog, 10); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, bw * prog, 3);
    text(`${fmt(left)} ZOMBIES LEFT`, W / 2, by + 18, 8, '#c8d8c8', 'center');
  }
  // boss bar
  if (run.boss && !run.boss.dead) {
    const z = run.boss, bw = 600, bx = W / 2 - bw / 2, by = 92;
    text(z.D.name, W / 2, by, 12, '#ff6a6a', 'center');
    ctx.fillStyle = '#050605'; ctx.fillRect(bx - 4, by + 20, bw + 8, 22); ctx.fillStyle = '#3a0a14'; ctx.fillRect(bx, by + 24, bw, 14);
    ctx.fillStyle = '#e8303a'; ctx.fillRect(bx, by + 24, bw * clamp(z.hp / z.max, 0, 1), 14); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(bx, by + 24, bw * clamp(z.hp / z.max, 0, 1), 3);
    // arrow if off screen
    const sx = (z.x - cam.x) * S, sy = (z.y - cam.y) * S;
    if (sx < 0 || sy < 0 || sx > W || sy > H) { const a = Math.atan2(sy - H / 2, sx - W / 2), ax = W / 2 + Math.cos(a) * 300, ay = H / 2 + Math.sin(a) * 260; ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.fill(); ctx.restore(); }
  }
  // coins / kills / time
  const cs = sprite('coin');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(cs.n, W - 200, 16, 24, 24); text(fmt(run.coins), W - 168, 20, 16, '#ffd65a');
  const sk = icon('skull', 'misc'); ctx.drawImage(sk, W - 200, 52, 24, 24); text(fmt(run.kills), W - 168, 56, 12, '#e8e4d8');
  text(fmtTime(run.time), W - 16, 92, 12, '#8a9a8a', 'right');
  // health bar
  const hb = 420, hx = W / 2 - hb / 2, hy = H - 40;
  ctx.fillStyle = '#050605'; ctx.fillRect(hx - 4, hy - 4, hb + 8, 26); ctx.fillStyle = '#3a0a14'; ctx.fillRect(hx, hy, hb, 18);
  const f = clamp(P.hp / P.maxHp, 0, 1);
  ctx.fillStyle = f < 0.3 ? (Math.sin(t * 10) > 0 ? '#ff3a3a' : '#c81a1a') : '#e83a4a'; ctx.fillRect(hx, hy, hb * f, 18); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(hx, hy, hb * f, 4);
  text(`${Math.ceil(P.hp)} / ${P.maxHp}`, W / 2, hy + 4, 8, '#ffffff', 'center');
  if (run.revive) text('SECOND LIFE READY', W / 2, hy - 18, 8, '#8aff6a', 'center');
  if (button('pz', W - 64, H - 60, 48, 44, 'II', { color: '#2a2a2a', size: 12, sfx: 'back' })) pause();
  // floating numbers
  floats.forEach(fl => { ctx.globalAlpha = 1 - fl.t / 0.8; text(fl.text, (fl.x - cam.x) * S, (fl.y - cam.y) * S, fl.big ? 16 : 8, fl.col, 'center'); ctx.globalAlpha = 1; });
  // touch stick
  if (stick.on) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 60, 0, 6.3); ctx.fill(); ctx.globalAlpha = 0.7; ctx.beginPath(); const sx = stick.x - stick.ox, sy = stick.y - stick.oy, l = Math.min(60, Math.hypot(sx, sy)), a = Math.atan2(sy, sx); ctx.arc(stick.ox + Math.cos(a) * l, stick.oy + Math.sin(a) * l, 26, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  // banner
  if (banner) {
    banner.t += 1 / 60;
    const d = banner.dur, a = banner.t < 0.3 ? banner.t / 0.3 : banner.t > d - 0.4 ? Math.max(0, (d - banner.t) / 0.4) : 1;
    if (banner.t > d) banner = null;
    else {
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 250, W, 120); ctx.fillStyle = banner.col; ctx.fillRect(0, 250, W, 3); ctx.fillRect(0, 367, W, 3);
      const sc = 1 + Math.max(0, 0.3 - banner.t) * 2;
      ctx.save(); ctx.translate(W / 2, 290); ctx.scale(sc, sc); text(banner.title, 0, -18, 36, banner.col, 'center'); ctx.restore();
      let sub = banner.sub; if (banner.count && run.phase === 'ready') sub = `WAVE ${run.wave + 1} IN ${Math.ceil(run.phaseT)}...`;
      if (sub) text(sub, W / 2, 334, 12, '#e8e4d8', 'center');
      ctx.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------ screens
let menuZ = [];
function drawBackdrop(darkA = 0.6) {
  // a slow pan over the town with zombies shuffling
  if (!ground) buildGround();
  const px0 = WORLD / 2 - VW / 2 + Math.sin(t * 0.05) * 300, py0 = WORLD / 2 - VH / 2 + Math.cos(t * 0.04) * 200;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.drawImage(ground, px0, py0, VW, VH, 0, 0, VW, VH);
  if (menuZ.length < 70) menuZ.push({ x: rand(0, VW), y: rand(0, VH), type: pick(['walker', 'walker', 'crawler', 'runner', 'brute', 'bloater']), a: rand(0, 6), vx: rand(-8, 8), vy: rand(-4, 4) });
  menuZ.sort((a, b) => a.y - b.y).forEach(z => {
    z.a += 0.1; z.x += z.vx / 60; z.y += z.vy / 60; if (z.x < -20) z.x = VW + 20; if (z.x > VW + 20) z.x = -20; if (z.y < -20) z.y = VH + 20; if (z.y > VH + 20) z.y = -20;
    const D = MONSTERS[z.type], s = sprite(D.sprite, D.tint); lx.drawImage(shadow(), Math.round(z.x - 6), Math.round(z.y - 2), 12, 4); lx.drawImage(z.vx < 0 ? s.f : s.n, Math.round(z.x - s.width / 2), Math.round(z.y - s.height - Math.abs(Math.sin(z.a)) * 1.5));
  });
  lx.fillStyle = `rgba(6,6,22,${darkA})`; lx.fillRect(0, 0, VW, VH);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, W, H);
}
function drawTitle() {
  drawBackdrop(0.55);
  const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.8)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  text('NIGHTFALL', W / 2, 60, 24, '#c8d8c8', 'center');
  const T = 'HORDE';
  [...T].forEach((ch, i) => { const x = W / 2 - 2 * 92 + i * 92, y = 100 + Math.sin(t * 2 + i * 0.7) * 4; for (const [a, b] of [[-5, 0], [5, 0], [0, -5], [0, 5], [6, 6]]) text(ch, x + a, y + b, 80, '#0a1a04', 'center', false); text(ch, x, y, 80, i % 2 ? '#8aff4a' : '#b8ff6a', 'center', false); ctx.fillStyle = '#5ac83a'; ctx.fillRect(x - 6 + (i * 13) % 20, y + 80, 6, 10 + ((t * 20 + i * 7) % 26)); });
  text('Survive 30 waves of the undead. Over 1,000 at once.', W / 2, 230, 8, '#a8b8a8', 'center');
  const C = charDef(save.char);
  if (button('play', W / 2 - 170, 290, 340, 76, 'PLAY', { color: '#2a6a1a', size: 24 })) startRun(save.char);
  // character preview
  const s = sprite('hero', null, { h: C.hair, H: shade(C.hair, 0.25), j: C.jacket, J: shade(C.jacket, 0.3) });
  if (button('chars', W / 2 - 170, 384, 165, 70, '', { color: '#2a3a5a', draw: (X, Y) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(s.n, X + 14, Y + 8, 36, 48); text('HERO', X + 105, Y + 16, 8, '#c8d8ff', 'center'); text(C.name, X + 105, Y + 36, 12, '#ffffff', 'center'); } })) state = 'chars';
  if (button('shop', W / 2 + 5, 384, 165, 70, '', { color: '#5a4a1a', draw: (X, Y) => { ctx.drawImage(sprite('coin').n, X + 14, Y + 18, 30, 30); text('SHOP', X + 105, Y + 16, 8, '#ffe8a0', 'center'); text(fmt(save.coins), X + 105, Y + 36, 12, '#ffd65a', 'center'); } })) state = 'shop';
  if (button('mus', W / 2 - 170, 472, 165, 44, Sound.musicOn ? 'MUSIC ON' : 'MUSIC OFF', { color: '#2a2a2a', size: 8 })) Sound.setMusic(!Sound.musicOn);
  if (button('sfx', W / 2 + 5, 472, 165, 44, Sound.sfxOn ? 'SFX ON' : 'SFX OFF', { color: '#2a2a2a', size: 8 })) Sound.setSfx(!Sound.sfxOn);
  const rs = loadRunSave();
  if (rs) { const rc = charDef(rs.char); if (button('cont', W / 2 - 170, 534, 340, 56, `CONTINUE: ${rc.name} WAVE ${rs.wave + 1}`, { color: '#2a5a7a', size: 12 })) continueRun(); }
  if (save.best) text(`BEST WAVE: ${save.best}    MOST KILLS: ${fmt(save.bestKills)}`, W / 2, rs ? 604 : 548, 8, '#ffe680', 'center');
  text('WASD / ARROWS move  -  weapons fire on their own  -  pick 1 of 3 upgrades after each wave', W / 2, 640, 8, '#8a9a8a', 'center');
  text('Picking something you already have levels it up (max 5 = super version)', W / 2, 662, 8, '#8a9a8a', 'center');
}
function drawChars() {
  drawBackdrop(0.8);
  text('CHOOSE YOUR HERO', W / 2, 40, 24, '#8aff6a', 'center');
  text(`COINS: ${fmt(save.coins)}`, W / 2, 84, 12, '#ffd65a', 'center');
  CHARACTERS.forEach((C, i) => {
    const cw = 228, x = 32 + i * (cw + 10), y = 130, owned = save.chars[C.id], sel = save.char === C.id;
    panel(x, y, cw, 440, sel ? '#8aff6a' : owned ? '#3a5a3a' : '#2a2a2a', '#0e140e');
    const s = sprite('hero', null, { h: C.hair, H: shade(C.hair, 0.25), j: C.jacket, J: shade(C.jacket, 0.3) });
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = owned ? 1 : 0.5; ctx.drawImage(s.n, x + cw / 2 - 48, y + 30 + Math.sin(t * 3 + i) * 3, 96, 128); ctx.globalAlpha = 1;
    text(C.name, x + cw / 2, y + 180, 16, sel ? '#8aff6a' : '#ffffff', 'center');
    wrapText(C.desc, x + cw / 2, y + 210, cw - 30, 8, '#a8b8a8', 14, 'center');
    text(`HP ${C.hp}`, x + 24, y + 262, 8, '#ff9aa8'); text(`SPEED ${Math.round(C.speed * 100)}%`, x + 24, y + 282, 8, '#c8d8ff');
    drawIcon('weapon', C.weapon, x + 24, y + 306, 4); text(WEAPONS[C.weapon].name, x + 72, y + 320, 8, '#e8e4d8');
    if (owned) { if (!sel && button('sel' + C.id, x + 20, y + 370, cw - 40, 48, 'SELECT', { color: '#2a6a1a', size: 12 })) { save.char = C.id; store(); } if (sel) text('SELECTED', x + cw / 2, y + 388, 12, '#8aff6a', 'center'); }
    else if (button('buy' + C.id, x + 20, y + 370, cw - 40, 48, '', { color: save.coins >= C.cost ? '#6a5a1a' : '#2a2a2a', disabled: save.coins < C.cost, sfx: 'buy', draw: (X, Y) => { ctx.drawImage(sprite('coin').n, X + 30, Y + 12, 20, 20); text(fmt(C.cost), X + 108, Y + 16, 12, '#ffffff', 'center'); } })) { save.coins -= C.cost; save.chars[C.id] = 1; save.char = C.id; store(); }
  });
  if (button('back', W / 2 - 130, 610, 260, 56, 'BACK', { color: '#2a2a2a', size: 12, sfx: 'back' })) state = 'title';
}
function drawShop() {
  drawBackdrop(0.8);
  text('UPGRADE SHOP', W / 2, 40, 24, '#ffd65a', 'center');
  text(`COINS: ${fmt(save.coins)}`, W / 2, 84, 12, '#ffd65a', 'center');
  text('Permanent. Earn coins by killing zombies.', W / 2, 108, 8, '#a8b8a8', 'center');
  SHOP.forEach((it, i) => {
    const x = 100 + (i % 2) * 550, y = 140 + Math.floor(i / 2) * 104, lv = shopLv(it.id), maxed = lv >= it.max, cost = it.cost(lv);
    panel(x, y, 530, 92, maxed ? '#8a6a1a' : '#3a4a3a', '#0e140e');
    text(it.name.toUpperCase(), x + 22, y + 20, 12, maxed ? '#ffcc33' : '#ffffff');
    text(it.desc, x + 22, y + 44, 8, '#a8b8a8');
    for (let k = 0; k < it.max; k++) { ctx.fillStyle = k < lv ? '#ffcc33' : '#2a2a2a'; ctx.fillRect(x + 22 + k * 22, y + 62, 16, 8); }
    if (maxed) text('MAX', x + 500, y + 34, 12, '#ffcc33', 'right');
    else if (button('sh' + it.id, x + 370, y + 20, 140, 52, '', { color: save.coins >= cost ? '#6a5a1a' : '#2a2a2a', disabled: save.coins < cost, sfx: 'buy', draw: (X, Y) => { ctx.drawImage(sprite('coin').n, X + 14, Y + 14, 20, 20); text(fmt(cost), X + 84, Y + 18, 12, '#ffffff', 'center'); } })) { save.coins -= cost; save.shop[it.id] = lv + 1; store(); }
  });
  if (button('back', W / 2 - 130, 610, 260, 56, 'BACK', { color: '#2a2a2a', size: 12, sfx: 'back' })) state = 'title';
}
function drawPick() {
  pickT += 1 / 60;
  ctx.fillStyle = `rgba(4,6,4,${Math.min(0.8, pickT * 2)})`; ctx.fillRect(0, 0, W, H);
  text(run.wave === 0 ? 'PICK A STARTING UPGRADE' : `WAVE ${run.wave} SURVIVED!`, W / 2, 50, 28, '#8aff6a', 'center');
  text(run.extraPicks > 0 ? 'BOSS CHEST: PICK ONE, THEN ONE MORE' : run.wave === 0 ? 'WASD / ARROWS to move. Your weapons fire on their own.' : 'CHOOSE AN UPGRADE', W / 2, 98, 12, '#e8e4d8', 'center');
  pickHover = -1;
  cards.forEach((c, i) => {
    const cw = 320, ch = 400, x = W / 2 - 1.5 * cw - 30 + i * (cw + 30), delay = i * 0.12;
    const u = clamp((pickT - delay) * 3, 0, 1), ease = 1 - (1 - u) ** 3;
    const y = 140 + (1 - ease) * 400;
    if (u <= 0) return;
    const over = mouse.x >= x && mouse.x < x + cw && mouse.y >= y && mouse.y < y + ch && u >= 1;
    if (over) { pickHover = i; UI.hover = 'card' + i; }
    const D = c.kind === 'weapon' ? WEAPONS[c.id] : c.kind === 'passive' ? PASSIVES[c.id] : null;
    const maxCard = c.to >= MAX_LV && D;
    const border = c.epic ? '#c46cff' : maxCard ? '#ffcc33' : c.from === 0 && D ? '#4ac0ff' : '#5ac83a';
    ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); const s = over ? 1.05 : 1; ctx.scale(s, s); ctx.translate(-cw / 2, -ch / 2);
    if (c.epic || maxCard) { ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 5); ctx.fillStyle = border; ctx.fillRect(-10, -10, cw + 20, ch + 20); ctx.globalAlpha = 1; }
    panel(0, 0, cw, ch, border, '#0c120c');
    // icon frame
    ctx.fillStyle = '#050605'; ctx.fillRect(cw / 2 - 64, 30, 128, 128); ctx.fillStyle = shade(border, -0.6); ctx.fillRect(cw / 2 - 60, 34, 120, 120);
    const ic = c.kind === 'weapon' || c.kind === 'passive' ? icon(c.id, c.kind) : icon(c.kind === 'heal' ? 'burger' : 'coin', c.kind);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(ic, cw / 2 - 50, 44 + Math.sin(t * 3 + i) * 3, 100, 100);
    const name = D ? D.name : c.kind === 'heal' ? 'Big Burger' : 'Coin Bag';
    text(name.toUpperCase(), cw / 2, 178, 16, '#ffffff', 'center');
    let tag = '', tagCol = '#8aff6a';
    if (!D) tag = 'BONUS'; else if (c.from === 0) { tag = c.kind === 'weapon' ? 'NEW WEAPON!' : 'NEW ITEM!'; tagCol = '#4ac0ff'; } else tag = `LV ${c.from} > ${c.to}`;
    if (c.epic) { tag = `EPIC! LV ${c.from} > ${c.to}`; tagCol = '#d89cff'; }
    if (maxCard) { tag = c.kind === 'weapon' ? 'MAX LEVEL: SUPER!' : 'MAX LEVEL'; tagCol = '#ffcc33'; }
    text(tag, cw / 2, 206, 8, tagCol, 'center');
    if (D) pips(cw / 2 - 33, 228, c.from, c.to, 10, 4);
    let desc = '';
    if (c.kind === 'weapon') { desc = c.from === 0 ? D.desc[0] : D.desc.slice(c.from, c.to).join('. '); }
    else if (c.kind === 'passive') desc = D.desc + (c.to - c.from > 1 ? ' (x2)' : '');
    else desc = c.kind === 'heal' ? 'Heal to full health' : '+40 coins';
    wrapText(desc, cw / 2, 262, cw - 44, 12, '#d8e0d8', 24, 'center');
    text(`[${i + 1}]`, cw / 2, ch - 40, 12, over ? '#ffffff' : '#6a7a6a', 'center');
    ctx.restore();
    const cl = UI.click;
    if (u >= 1 && pickT > 0.6 && cl && cl.x >= x && cl.x < x + cw && cl.y >= y && cl.y < y + ch) { UI.click = null; Sound.play('buy'); choose(i); }
  });
  if (run.rerolls > 0 && button('rr', W / 2 - 120, 580, 240, 52, `REROLL (${run.rerolls})`, { color: '#4a3a6a', size: 12 })) reroll();
  // loadout
  text('YOUR GEAR', W / 2, 650, 8, '#6a7a6a', 'center');
  const all = [...P.weapons.map(w => ['weapon', w.id, w.lv]), ...Object.entries(P.passives).map(([id, lv]) => ['passive', id, lv])];
  all.forEach(([k, id, lv], i) => { const x = W / 2 - all.length * 22 + i * 44; drawIcon(k, id, x, 668, 4); text(String(lv), x + 38, 696, 8, lv >= MAX_LV ? '#ffcc33' : '#ffffff', 'right'); });
}
let endT = 0;
function drawEnd(won) {
  endT += 1 / 60;
  ctx.fillStyle = `rgba(4,2,2,${Math.min(0.82, endT)})`; ctx.fillRect(0, 0, W, H);
  if (endT < 0.6) return;
  panel(W / 2 - 340, 110, 680, 500, won ? '#8a6a1a' : '#6a1a1a', '#100808');
  text(won ? 'YOU SURVIVED THE NIGHT!' : 'YOU DIED', W / 2, 150, won ? 24 : 40, won ? '#ffe680' : '#ff4a4a', 'center');
  const rows = [['Wave reached', run.wave], ['Zombies killed', fmt(run.kills)], ['Time', fmtTime(run.time)], ['Coins earned', fmt(run.coins)]];
  rows.forEach(([a, b], i) => { text(a, W / 2 - 260, 240 + i * 40, 12, '#a8b8a8'); text(String(b), W / 2 + 260, 240 + i * 40, 12, i === 3 ? '#ffd65a' : '#ffffff', 'right'); });
  if (run.wave >= save.best && run.wave > 1) text('NEW BEST!', W / 2, 410, 12, '#8aff6a', 'center');
  text(`Bank: ${fmt(save.coins)} coins - spend them in the shop`, W / 2, 440, 8, '#c8b870', 'center');
  if (won) {
    if (button('endless', W / 2 - 300, 500, 290, 64, 'KEEP GOING', { color: '#4a2a6a', size: 12 })) { run.endless = true; run.banked = false; state = 'play'; run.phase = 'ready'; run.phaseT = 2; openPick(); }
    if (button('menu', W / 2 + 10, 500, 290, 64, 'MENU', { color: '#2a5a2a', size: 12 })) goTitle();
  } else {
    if (button('retry', W / 2 - 300, 500, 290, 64, 'TRY AGAIN', { color: '#6a3a1a', size: 12 })) startRun(save.char);
    if (button('menu', W / 2 + 10, 500, 290, 64, 'MENU', { color: '#2a2a2a', size: 12, sfx: 'back' })) goTitle();
  }
}
function win() {
  toastQ = []; clearRunSave(); state = 'win'; endT = 0; addCoins(500); bankCoins(); Sound.playSong(SONGS.zwin); SND.pick(true);
  if (!save.won) { save.won = 1; store(); }
}
function drawPause() {
  ctx.fillStyle = 'rgba(4,6,4,0.75)'; ctx.fillRect(0, 0, W, H);
  panel(W / 2 - 240, 150, 480, 420, '#3a5a3a', '#0c120c');
  text('PAUSED', W / 2, 186, 32, '#8aff6a', 'center');
  text(`Wave ${run.wave}  -  ${fmt(run.kills)} kills  -  ${fmt(run.coins)} coins`, W / 2, 236, 8, '#a8b8a8', 'center');
  if (button('res', W / 2 - 180, 280, 360, 64, 'RESUME', { color: '#2a6a1a' })) resume();
  if (button('saveq', W / 2 - 180, 364, 175, 56, 'SAVE & QUIT', { color: '#2a4a6a', size: 8 })) goTitle();
  if (button('quit', W / 2 + 5, 364, 175, 56, 'GIVE UP', { color: '#6a2a1a', size: 8 })) { bankCoins(); clearRunSave(); goTitle(); }
  text('Save & quit: continue from the start of this wave', W / 2, 428, 8, '#8a9a8a', 'center');
  if (button('mus', W / 2 - 180, 446, 175, 44, Sound.musicOn ? 'MUSIC ON' : 'MUSIC OFF', { color: '#2a2a2a', size: 8 })) Sound.setMusic(!Sound.musicOn);
  if (button('sfx', W / 2 + 5, 446, 175, 44, Sound.sfxOn ? 'SFX ON' : 'SFX OFF', { color: '#2a2a2a', size: 8 })) Sound.setSfx(!Sound.sfxOn);
  text('ESC / P to resume', W / 2, 520, 8, '#6a7a6a', 'center');
}
function pause() { if (state !== 'play') return; state = 'pause'; Sound.play('back'); }
function resume() { state = 'play'; Sound.play('click'); }
function goTitle() { state = 'title'; run = null; P = null; ground = null; menuZ = []; Sound.playSong(SONGS.zmenu); }

// ------------------------------------------------------------ sounds
const SND = {
  horn: () => { Sound.blip(147, 0.7, { type: 'sawtooth', vol: 0.1, lp: 1100, attack: 0.08 }); Sound.blip(220, 0.7, { type: 'sawtooth', vol: 0.07, lp: 1100, attack: 0.08, delay: 0.05 }); },
  horde: () => { for (let k = 0; k < 3; k++) Sound.blip(110, 0.25, { type: 'sawtooth', vol: 0.1, lp: 900, delay: k * 0.3 }); Sound.hiss(1, { filter: 'lowpass', freq: 400, vol: 0.15 }); },
  roar: () => { Sound.blip(80, 1, { type: 'sawtooth', vol: 0.16, slide: 40, lp: 600 }); Sound.hiss(1, { filter: 'lowpass', freq: 500, vol: 0.3 }); },
  bossDie: () => { Sound.hiss(1.5, { filter: 'lowpass', freq: 900, sweep: 80, vol: 0.4 }); [392, 523, 659, 784].forEach((f, i) => Sound.blip(f, 0.15, { type: 'square', vol: 0.08, delay: 0.4 + i * 0.1 })); },
  bossShot: () => Sound.blip(300, 0.25, { type: 'sawtooth', vol: 0.08, slide: 120, lp: 1500 }),
  summon: () => Sound.blip(160, 0.5, { type: 'sine', vol: 0.12, slide: 700 }),
  warn: () => { Sound.blip(880, 0.1, { type: 'square', vol: 0.06 }); Sound.blip(880, 0.1, { type: 'square', vol: 0.06, delay: 0.2 }); },
  slam: () => { Sound.hiss(0.5, { filter: 'lowpass', freq: 400, vol: 0.35 }); Sound.blip(55, 0.4, { type: 'sine', vol: 0.2, slide: 30 }); },
  zap: () => sfx('zap', 0.08, () => { Sound.hiss(0.15, { freq: 5000, vol: 0.1 }); Sound.blip(180, 0.1, { type: 'sawtooth', vol: 0.05, slide: 1400, lp: 3000 }); }),
  frost: () => { Sound.blip(2200, 0.5, { type: 'triangle', vol: 0.08, slide: 400 }); Sound.hiss(0.4, { freq: 7000, vol: 0.08 }); },
  laser: () => sfx('laser', 0.1, () => Sound.blip(1600, 0.25, { type: 'sawtooth', vol: 0.05, slide: 200, lp: 4000 })),
  hurt: () => { Sound.blip(160, 0.15, { type: 'square', vol: 0.12, slide: 70 }); Sound.hiss(0.1, { filter: 'lowpass', freq: 1200, vol: 0.1 }); },
  heal: () => [523, 784, 1047].forEach((f, i) => Sound.blip(f, 0.08, { type: 'triangle', vol: 0.1, delay: i * 0.06 })),
  nuke: () => { Sound.hiss(1.6, { filter: 'lowpass', freq: 1500, sweep: 60, vol: 0.45 }); Sound.blip(50, 1, { type: 'sine', vol: 0.25, slide: 25 }); },
  clear: () => [523, 659, 784, 1047, 1319].forEach((f, i) => Sound.blip(f, 0.12, { type: 'square', vol: 0.07, delay: i * 0.07 })),
  cards: () => [0, 1, 2].forEach(i => Sound.hiss(0.08, { filter: 'bandpass', freq: 2500, q: 2, vol: 0.08, delay: i * 0.12 })),
  pick: big => { (big ? [523, 659, 784, 1047, 1319, 1568] : [659, 988, 1319]).forEach((f, i) => Sound.blip(f, 0.1, { type: 'square', vol: 0.08, delay: i * 0.05 })); },
  death: () => { Sound.blip(300, 1.2, { type: 'sawtooth', vol: 0.12, slide: 60, lp: 1200 }); Sound.hiss(0.8, { filter: 'lowpass', freq: 700, vol: 0.2 }); },
};

// ------------------------------------------------------------ main loop
let last = 0;
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += rdt;
  UI.hover = null;
  ctx.imageSmoothingEnabled = false;
  if (state === 'title') drawTitle();
  else if (state === 'chars') drawChars();
  else if (state === 'shop') drawShop();
  else if (run) {
    if (state === 'play') { update(rdt); updateFx(rdt); }
    else if (state === 'dead' || state === 'win') updateFx(rdt * 0.4);
    drawWorld();
    ctx.drawImage(lo, 0, 0, W, H);
    if (hurtFlash > 0) { ctx.fillStyle = `rgba(255,20,30,${hurtFlash * 0.4})`; ctx.fillRect(0, 0, W, H); }
    if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, whiteFlash) * 0.7})`; ctx.fillRect(0, 0, W, H); }
    if (P.hp < P.maxHp * 0.3 && state === 'play') { const g = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 700); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${0.35 + 0.15 * Math.sin(t * 6)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (state !== 'pick') drawHUD();
    if (state === 'pick') drawPick();
    if (state === 'pause') drawPause();
    if (state === 'dead') drawEnd(false);
    if (state === 'win') drawEnd(true);
  }
  // toasts
  toastQ.forEach((m, i) => {
    m.t += rdt; const a = m.t < 0.2 ? m.t / 0.2 : m.t > m.dur - 0.4 ? Math.max(0, (m.dur - m.t) / 0.4) : 1;
    ctx.globalAlpha = a; ctx.font = `12px ${FONT}`; const tw = ctx.measureText(m.s).width + 40, y = 150 + i * 42;
    ctx.fillStyle = 'rgba(4,6,4,0.85)'; ctx.fillRect(W / 2 - tw / 2, y, tw, 32); ctx.fillStyle = m.col; ctx.fillRect(W / 2 - tw / 2, y, 4, 32);
    text(m.s, W / 2, y + 10, 12, m.col, 'center'); ctx.globalAlpha = 1;
  });
  toastQ = toastQ.filter(m => m.t < m.dur);
  if (UI.hover && UI.hover !== UI.lastHover) Sound.play('hover');
  UI.lastHover = UI.hover; UI.click = null;
  requestAnimationFrame(frame);
}
const fontReady = document.fonts ? Promise.race([document.fonts.load(`16px ${FONT}`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontReady.then(() => { state = 'title'; Sound.playSong(SONGS.zmenu); requestAnimationFrame(n => { last = n; frame(n); }); });

window.__zb = {
  get eb() { return ebullets; }, get tele() { return tele; }, get boss() { return run && run.boss; }, get pk() { return pickups.map(p => [p.kind, Math.round(p.x), Math.round(p.y), p.pull, p.v]).slice(0, 6); }, get state() { return state; }, get run() { return run; }, get P() { return P; }, get zs() { return zs; },
  start: startRun, continueRun, choose, deal: dealCards, get cards() { return cards; }, save: () => save, recalc,
  setWave(n) { run.wave = n - 1; run.phase = 'ready'; run.phaseT = 0.1; }, sim(dt, n) { for (let k = 0; k < n; k++) { if (state === 'pick') return 'pick'; if (state !== 'play') return state; update(dt); updateFx(dt); } return state; },
  setLv(kind, id, lv) { if (kind === 'weapon') { let w = P.weapons.find(x => x.id === id); if (!w) { addWeapon(id); w = P.weapons[P.weapons.length - 1]; } w.lv = lv; } else P.passives[id] = lv; recalc(); },
};
})();
