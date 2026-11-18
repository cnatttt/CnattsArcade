// =====================================================================
//  NIGHTFALL SIEGE - tower defense
//  1-7 pick a tower | click to build | click a tower to select
//  U upgrade | S sell | T targeting | SPACE start wave | Q meteor | W freeze
//  F speed | ESC pause / cancel
// =====================================================================
(() => {
'use strict';
const W = 1280, H = 720, S = 4, TS = 16, COLS = 16, ROWS = 11;
const MW = COLS * TS, MH = ROWS * TS, MY = 2;      // map in low-res pixels (offset 2 from the top)
const PX = MW * S;                                 // side panel starts here (1024)
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const lo = document.createElement('canvas'); lo.width = MW; lo.height = MH + 4;
let lx = lo.getContext('2d');
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
const fmt = n => Math.floor(n).toLocaleString('en-US');
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex(h) { if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number); h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
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
function whiteOf(c) { const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; const x = n.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, n.width, n.height); return n; }
function sprite(name, tint) { const k = name + (tint || ''); if (!SPR[k]) { const d = SPR_DEF[name]; SPR[k] = buildSprite(d.rows, d.pal, tint); SPR[k + '_w'] = whiteOf(SPR[k]); } return SPR[k]; }

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_siege';
let save = { stars: {}, best: {}, perks: {}, tutorial: false };
try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) save = Object.assign(save, d); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const perk = id => !!save.perks[id];
const starsEarned = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
const starsSpent = () => PERKS.filter(p => save.perks[p.id]).reduce((a, p) => a + p.cost, 0);
const unlocked = i => i === 0 || (save.stars[MAPS[i - 1].id] || 0) > 0;

// ------------------------------------------------------------ input
const mouse = { x: -1, y: -1, down: false };
const UI = { click: null, rclick: false, down: false, px: 0, py: 0, hover: null, lastHover: null };
const keys = {};
function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => { e.preventDefault(); const [x, y] = toCanvas(e); mouse.x = x; mouse.y = y; UI.down = true; UI.px = x; UI.py = y; if (e.button === 2) UI.rclick = true; });
cv.addEventListener('pointermove', e => { [mouse.x, mouse.y] = toCanvas(e); });
cv.addEventListener('pointerup', e => { const [x, y] = toCanvas(e); UI.down = false; if (e.button !== 2) UI.click = { x, y, px: UI.px, py: UI.py }; });
window.addEventListener('keydown', e => {
  if (e.code === 'Space') e.preventDefault();
  if (keys[e.code]) return; keys[e.code] = true;
  if (screen === 'play') {
    const tw = TOWERS.find(t => t.key === e.key); if (tw) { startPlacing(tw.id); return; }
    if (e.code === 'Escape') { if (placing || targeting || selected) { placing = null; targeting = null; selected = null; } else pause(); }
    if (e.code === 'Space') startWave();
    if (e.code === 'KeyU' && selected) upgrade(selected);
    if (e.code === 'KeyS' && selected) sell(selected);
    if (e.code === 'KeyT' && selected) cycleTarget(selected);
    if (e.code === 'KeyQ') castSpell(0);
    if (e.code === 'KeyW') castSpell(1);
    if (e.code === 'KeyF') toggleSpeed();
  } else if (screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resume();
  if (e.code === 'KeyM') Sound.setMusic(!Sound.musicOn);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ------------------------------------------------------------ map rendering
const THEMES = {
  meadow: { ground: ['#4a8a3a', '#539440', '#447e35', '#5c9e46'], path: ['#b89462', '#a8844e', '#c8a470', '#9c7a48'], edge: '#5a3e22', accent: '#ffe650', ambient: 'leaves', tint: null, flowers: ['#ffe650', '#ff8ab0', '#ffffff', '#a8d8ff'] },
  crypt:  { ground: ['#3c4a3a', '#36432f', '#2f3b2a', '#455240'], path: ['#6e687c', '#5e586c', '#7a7488', '#544e60'], edge: '#1e1a24', accent: '#b07cff', ambient: 'fog', tint: 'rgba(20,10,40,0.18)', flowers: ['#8a7aa0', '#6a8a6a'] },
  frozen: { ground: ['#e4eef8', '#d6e4f2', '#f2f8ff', '#cad8ea'], path: ['#9ab4cc', '#8aa4be', '#aac2da', '#8098b2'], edge: '#5a7894', accent: '#8ad8ff', ambient: 'snow', tint: null, flowers: ['#ffffff', '#b8d8f0'] },
  forge:  { ground: ['#4e3c36', '#45342e', '#574440', '#3e2e2a'], path: ['#2e2628', '#3a3032', '#262022', '#342a2c'], edge: '#140c0c', accent: '#ff6a1a', ambient: 'embers', tint: 'rgba(60,10,0,0.12)', flowers: ['#6a4a3a', '#ff6a1a'] },
  void:   { ground: ['#30264a', '#2a2042', '#382c54', '#2e2246'], path: ['#4c3c6c', '#56467a', '#423462', '#5a4a84'], edge: '#140a24', accent: '#c46cff', ambient: 'motes', tint: 'rgba(30,0,60,0.12)', flowers: ['#c46cff', '#ff8ad8', '#8ab8ff'] },
};
let mapCv = null, pathTiles = null, blockTiles = null, pathPts = [], pathLen = 0, segLens = [], waterTiles = [];
function buildPath(M) {
  pathTiles = new Set(); pathPts = M.path.map(([c, r]) => ({ x: c * TS + 8, y: r * TS + 8 }));
  for (let i = 0; i < M.path.length - 1; i++) {
    const [c0, r0] = M.path[i], [c1, r1] = M.path[i + 1];
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let k = 0; k <= steps; k++) { const c = c0 + Math.sign(c1 - c0) * k, r = r0 + Math.sign(r1 - r0) * k; if (c >= 0 && r >= 0 && c < COLS && r < ROWS) pathTiles.add(c + ',' + r); }
  }
  segLens = []; pathLen = 0;
  for (let i = 0; i < pathPts.length - 1; i++) { const l = Math.hypot(pathPts[i + 1].x - pathPts[i].x, pathPts[i + 1].y - pathPts[i].y); segLens.push(l); pathLen += l; }
}
function posAt(d) {
  d = clamp(d, 0, pathLen);
  for (let i = 0; i < segLens.length; i++) {
    if (d <= segLens[i]) { const a = pathPts[i], b = pathPts[i + 1], u = d / segLens[i]; return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), dir: Math.atan2(b.y - a.y, b.x - a.x) }; }
    d -= segLens[i];
  }
  const L = pathPts[pathPts.length - 1]; return { x: L.x, y: L.y, dir: 0 };
}
const isPath = (c, r) => pathTiles.has(c + ',' + r);
function castleTiles(M) { const [c, r] = M.castle; return [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]]; }
function renderMap(M) {
  const T = THEMES[M.theme], R = seeded(M.id.length * 977 + 13);
  buildPath(M);
  blockTiles = new Set(castleTiles(M).map(([c, r]) => c + ',' + r));
  const c = document.createElement('canvas'); c.width = MW; c.height = MH;
  const x = c.getContext('2d');
  const img = x.createImageData(MW, MH), D = img.data;
  const set = (px_, py_, col, a = 1) => { if (px_ < 0 || py_ < 0 || px_ >= MW || py_ >= MH) return; const i = (py_ * MW + px_) * 4; D[i] = D[i] * (1 - a) + col[0] * a; D[i + 1] = D[i + 1] * (1 - a) + col[1] * a; D[i + 2] = D[i + 2] * (1 - a) + col[2] * a; D[i + 3] = 255; };
  const G = T.ground.map(hex), Pc = T.path.map(hex), E = hex(T.edge);
  // ground: soft noise patches
  const noise = (xx, yy) => Math.sin(xx * 0.13 + Math.sin(yy * 0.09) * 2) + Math.sin(yy * 0.11 + Math.sin(xx * 0.07) * 2);
  for (let yy = 0; yy < MH; yy++) for (let xx = 0; xx < MW; xx++) {
    const n = noise(xx, yy), k = n > 0.9 ? 3 : n > 0.1 ? 1 : n > -0.8 ? 0 : 2;
    let col = G[k];
    const r = R(); if (r < 0.06) col = G[(k + 1) % 4]; else if (r > 0.97) col = G[2];
    set(xx, yy, col);
  }
  // grass tufts / snow sparkles / ash specks
  for (let k = 0; k < 360; k++) {
    const xx = Math.floor(R() * MW), yy = Math.floor(R() * MH);
    if (M.theme === 'meadow' || M.theme === 'crypt') { set(xx, yy, hex(shade(T.ground[3], 0.18))); set(xx + 1, yy - 1, hex(shade(T.ground[3], 0.1))); set(xx - 1, yy - 1, hex(shade(T.ground[0], 0.12))); }
    else if (M.theme === 'frozen') set(xx, yy, [255, 255, 255]);
    else set(xx, yy, hex(T.flowers[k % T.flowers.length]), 0.6);
  }
  if (T.flowers && (M.theme === 'meadow')) for (let k = 0; k < 70; k++) { const xx = Math.floor(R() * MW), yy = Math.floor(R() * MH), fc = hex(pick(T.flowers)); set(xx, yy, fc); set(xx + 1, yy, fc); set(xx, yy + 1, [60, 120, 40]); }
  // path
  for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
    if (!isPath(cc, r)) continue;
    for (let yy = 0; yy < TS; yy++) for (let xx = 0; xx < TS; xx++) {
      const X = cc * TS + xx, Y = r * TS + yy;
      let col = Pc[(Math.floor(X / 5) * 7 + Math.floor(Y / 4) * 3 + (R() < 0.15 ? 1 : 0)) % 4];
      if (M.theme === 'crypt' || M.theme === 'void' || M.theme === 'forge') { // cobbles
        const bx = (X + (Math.floor(Y / 5) % 2) * 3) % 6, by = Y % 5;
        if (bx === 0 || by === 0) col = hex(shade(T.path[3], -0.25));
        else if (bx === 1 || by === 1) col = hex(shade(T.path[0], 0.12));
      }
      set(X, Y, col);
      if (R() < 0.04) set(X, Y, hex(shade(T.path[0], 0.3)));
    }
    // edges with an overhang of ground
    const edges = [[0, -1, 'top'], [0, 1, 'bot'], [-1, 0, 'left'], [1, 0, 'right']];
    edges.forEach(([dc, dr, side]) => {
      const nc = cc + dc, nr = r + dr;
      const open = nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || isPath(nc, nr);
      if (open) return;
      for (let k = 0; k < TS; k++) {
        const wob = Math.round(Math.sin((cc * TS + k) * 0.9 + r) * 0.8 + R() * 0.8);
        let X, Y;
        if (side === 'top') { X = cc * TS + k; for (let j = 0; j <= 1 + wob; j++) set(X, r * TS + j, j === 1 + wob ? E : G[0], j === 1 + wob ? 0.55 : 1); }
        if (side === 'bot') { X = cc * TS + k; for (let j = 0; j <= 1 + wob; j++) set(X, r * TS + 15 - j, j === 1 + wob ? E : G[1], j === 1 + wob ? 0.4 : 1); }
        if (side === 'left') { Y = r * TS + k; for (let j = 0; j <= 1 + wob; j++) set(cc * TS + j, Y, j === 1 + wob ? E : G[0], j === 1 + wob ? 0.5 : 1); }
        if (side === 'right') { Y = r * TS + k; for (let j = 0; j <= 1 + wob; j++) set(cc * TS + 15 - j, Y, j === 1 + wob ? E : G[1], j === 1 + wob ? 0.5 : 1); }
      }
    });
  }
  x.putImageData(img, 0, 0);
  const P_ = (X, Y, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), w, h); };
  // decorations on tiles far from the path (these tiles can't be built on)
  waterTiles = [];
  const nearPath = (cc, r) => { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (isPath(cc + dc, r + dr)) return true; return false; };
  const cands = [];
  for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) if (!isPath(cc, r) && !nearPath(cc, r) && !blockTiles.has(cc + ',' + r)) cands.push([cc, r]);
  cands.sort(() => R() - 0.5);
  const nDeco = Math.floor(cands.length * 0.32);
  // a pond / lava pool / ice lake
  if (cands.length > 6) {
    const [pc, pr] = cands[0];
    const pool = [[pc, pr]]; [[1, 0], [0, 1], [1, 1]].forEach(([a, b]) => { if (cands.some(([q, w]) => q === pc + a && w === pr + b)) pool.push([pc + a, pr + b]); });
    pool.forEach(([cc, r]) => { blockTiles.add(cc + ',' + r); waterTiles.push([cc, r]); });
    const xs = pool.map(p => p[0]), ys = pool.map(p => p[1]);
    const x0 = Math.min(...xs) * TS, y0 = Math.min(...ys) * TS, w = (Math.max(...xs) - Math.min(...xs) + 1) * TS, h = (Math.max(...ys) - Math.min(...ys) + 1) * TS;
    const liq = { meadow: ['#3a7ab8', '#5a9ad8', '#2a5a8a'], crypt: ['#2a3a4a', '#3a4a5a', '#1a2430'], frozen: ['#8ac8f0', '#c8f0ff', '#5a9ac8'], forge: ['#e8501a', '#ffb040', '#a82a0a'], void: ['#1a0a30', '#5a2a9a', '#0a0418'] }[M.theme];
    x.fillStyle = shade(liq[2], -0.3); x.beginPath(); x.ellipse(x0 + w / 2, y0 + h / 2 + 1, w / 2 - 1, h / 2 - 1, 0, 0, 6.3); x.fill();
    x.fillStyle = liq[0]; x.beginPath(); x.ellipse(x0 + w / 2, y0 + h / 2, w / 2 - 2, h / 2 - 2, 0, 0, 6.3); x.fill();
    x.fillStyle = liq[1]; x.beginPath(); x.ellipse(x0 + w / 2 - 3, y0 + h / 2 - 3, w / 4, h / 6, 0, 0, 6.3); x.fill();
    if (M.theme === 'meadow') { [[x0 + 4, y0 + h - 6], [x0 + w - 7, y0 + 4]].forEach(([lx0, ly0]) => { P_(lx0, ly0, '#3a8a3a', 5, 3); P_(lx0 + 1, ly0 - 1, '#5aaa4a', 3, 1); P_(lx0 + 3, ly0, '#ff8ab0'); }); }
    waterArea = { x: x0, y: y0, w, h, liq };
  }
  for (let k = 1; k < nDeco + 1 && k < cands.length; k++) {
    const [cc, r] = cands[k]; if (blockTiles.has(cc + ',' + r)) continue;
    blockTiles.add(cc + ',' + r);
    decoAt(x, P_, cc * TS, r * TS, M.theme, R);
  }
  // spawn cave / portal where the path enters
  const s0 = M.path[0], s1 = M.path[1];
  const ex = clamp(s0[0], 0, COLS - 1) * TS + 8, ey = clamp(s0[1], 0, ROWS - 1) * TS + 8;
  spawnPt = { x: ex, y: ey };
  // castle
  drawCastleBase(x, P_, M);
  mapCv = c;
}
let waterArea = null, spawnPt = { x: 0, y: 0 };
function decoAt(x, P_, X, Y, theme, R) {
  const shadow = (cx, cy, rw) => { x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(cx, cy, rw, rw * 0.35, 0, 0, 6.3); x.fill(); };
  const roll = R();
  if (theme === 'meadow') {
    if (roll < 0.7) { // round tree
      const cx = X + 8 + Math.round(R() * 2 - 1), cy = Y + 9;
      shadow(cx + 2, cy + 6, 7);
      P_(cx - 1, cy + 1, '#5a3a1a', 3, 6); P_(cx - 1, cy + 1, '#7a5a2a', 1, 6);
      [['#2a6a2a', 7, 0, 0], ['#3a8a32', 6, -1, -1], ['#4aa03a', 4, -2, -3], ['#6ab84a', 2, -3, -4]].forEach(([col, rr, ox, oy]) => { x.fillStyle = col; x.beginPath(); x.arc(cx + ox, cy - 3 + oy, rr, 0, 6.3); x.fill(); });
      if (R() < 0.3) { P_(cx + 2, cy - 4, '#e83a3a'); P_(cx - 3, cy - 1, '#e83a3a'); }
    } else { shadow(X + 9, Y + 12, 6); x.fillStyle = '#7a7a84'; x.beginPath(); x.ellipse(X + 8, Y + 9, 6, 4, 0, 0, 6.3); x.fill(); x.fillStyle = '#9a9aa4'; x.beginPath(); x.ellipse(X + 7, Y + 7, 4, 2.5, 0, 0, 6.3); x.fill(); P_(X + 3, Y + 11, '#3a8a32', 3, 1); }
  } else if (theme === 'crypt') {
    if (roll < 0.5) { shadow(X + 8, Y + 14, 5); P_(X + 5, Y + 4, '#2a2830', 7, 11); P_(X + 5, Y + 4, '#7a7488', 6, 10); P_(X + 6, Y + 3, '#7a7488', 4, 1); P_(X + 5, Y + 4, '#9a94a8', 6, 1); P_(X + 7, Y + 6, '#4a4458', 2, 4); P_(X + 6, Y + 7, '#4a4458', 4, 1); P_(X + 4, Y + 14, '#3a5a3a', 8, 1); }
    else if (roll < 0.8) { const cx = X + 8; shadow(cx + 2, Y + 14, 6); P_(cx, Y + 3, '#2a2024', 2, 12); P_(cx - 4, Y + 5, '#2a2024', 4, 1); P_(cx - 4, Y + 4, '#2a2024', 1, 1); P_(cx + 2, Y + 7, '#2a2024', 4, 1); P_(cx + 5, Y + 6, '#2a2024', 1, 1); P_(cx - 2, Y + 9, '#2a2024', 2, 1); }
    else { shadow(X + 8, Y + 12, 5); P_(X + 4, Y + 9, '#c8c4b8', 8, 3); P_(X + 5, Y + 8, '#e8e4d8', 3, 2); P_(X + 9, Y + 8, '#d8d4c8', 2, 2); }
  } else if (theme === 'frozen') {
    if (roll < 0.7) { const cx = X + 8; shadow(cx + 2, Y + 15, 6); P_(cx - 1, Y + 12, '#4a3a2a', 2, 3);
      for (let k = 0; k < 4; k++) { const w = 3 + k * 2, yy = Y + 1 + k * 3; P_(cx - w / 2, yy, '#2a5a4a', w, 3); P_(cx - w / 2, yy, '#ffffff', w, 1); P_(cx - w / 2 + 1, yy + 1, '#3a7a5a', w - 2, 1); } }
    else { shadow(X + 9, Y + 12, 6); P_(X + 3, Y + 6, '#a8c8e0', 10, 6); P_(X + 4, Y + 5, '#e8f8ff', 8, 2); P_(X + 11, Y + 7, '#7aa0c0', 2, 5); }
  } else if (theme === 'forge') {
    if (roll < 0.5) { shadow(X + 8, Y + 14, 6); P_(X + 5, Y + 3, '#1a1012', 6, 12); P_(X + 6, Y + 2, '#2a1e20', 4, 12); P_(X + 7, Y + 1, '#3a2a2c', 2, 4); P_(X + 7, Y + 7, '#ff6a1a', 1, 3); }
    else if (roll < 0.8) { shadow(X + 8, Y + 12, 6); x.fillStyle = '#2a1e20'; x.beginPath(); x.ellipse(X + 8, Y + 9, 6, 4, 0, 0, 6.3); x.fill(); P_(X + 5, Y + 9, '#ff6a1a', 3, 1); P_(X + 9, Y + 8, '#ffb040', 2, 1); }
    else { P_(X + 6, Y + 6, '#3a3a44', 4, 1); P_(X + 7, Y + 4, '#5a5a66', 2, 8); P_(X + 5, Y + 11, '#3a3a44', 6, 2); }
  } else {
    if (roll < 0.6) { shadow(X + 8, Y + 14, 6); [[5, 4, 2, 10, '#7a3ad0', '#d8a8ff'], [8, 1, 3, 13, '#9a4ae0', '#f0d8ff'], [11, 6, 2, 8, '#6a2ab0', '#c8a0ff']].forEach(([a, b, w, h, c1, c2]) => { P_(X + a, Y + b, c1, w, h); P_(X + a, Y + b, c2, 1, h); }); }
    else { shadow(X + 8, Y + 15, 5); P_(X + 3, Y + 5, '#1a1028', 10, 4); P_(X + 4, Y + 4, '#3a2a58', 8, 2); P_(X + 5, Y + 9, '#1a1028', 6, 2); P_(X + 7, Y + 11, '#1a1028', 2, 1); }
  }
}
function drawCastleBase(x, P_, M) {
  const [c, r] = M.castle, X = c * TS, Y = r * TS;
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(X + 17, Y + 30, 16, 4, 0, 0, 6.3); x.fill();
  const stone = { meadow: ['#9a94a8', '#7a7488', '#5a5468'], crypt: ['#6a647a', '#4e485e', '#363044'], frozen: ['#c8d8e8', '#a8b8cc', '#8898ac'], forge: ['#5a4a48', '#463634', '#2e2220'], void: ['#5a4a7a', '#463660', '#2e2248'] }[M.theme];
  P_(X + 2, Y + 10, stone[2], 28, 20); P_(X + 3, Y + 10, stone[1], 26, 19); P_(X + 3, Y + 10, stone[0], 26, 2);
  for (let k = 0; k < 4; k++) { P_(X + 3, Y + 14 + k * 4, stone[2], 26, 1); for (let j = 0; j < 4; j++) P_(X + 3 + ((k % 2) * 3) + j * 7, Y + 14 + k * 4 - 3, stone[2], 1, 3); }
  // towers
  [[X, Y + 2], [X + 24, Y + 2]].forEach(([tx, ty]) => { P_(tx, ty, stone[2], 8, 28); P_(tx + 1, ty, stone[1], 6, 27); P_(tx + 1, ty, stone[0], 6, 2); for (let k = 0; k < 3; k++) P_(tx + k * 3, ty - 2, stone[1], 2, 2); P_(tx + 3, ty + 8, '#1a1420', 2, 4); });
  for (let k = 0; k < 5; k++) P_(X + 8 + k * 4, Y + 8, stone[1], 2, 2);
  // gate
  P_(X + 12, Y + 18, '#2a1a10', 8, 12); P_(X + 13, Y + 19, '#5a3a1a', 6, 11); for (let k = 0; k < 3; k++) P_(X + 13 + k * 2, Y + 19, '#3a2410', 1, 11); P_(X + 12, Y + 17, stone[0], 8, 1);
}

// ------------------------------------------------------------ game state
let screen = 'loading', t = 0;
let G = null, placing = null, selected = null, targeting = null, hoverTile = null;
let enemies = [], towers = [], shots = [], bolts = [], parts = [], floats = [], rings = [], amb = [];
let banner = null, shake = 0, flashRed = 0, speed = 1, menuMap = 0;
// ---- mid-map save: written when a map starts and after every wave, cleared when the map ends
const RUN_KEY = 'cnatt_siege_run';
function saveRun() {
  if (!G) return;
  const snap = { v: 1, mi: G.mi, gold: G.gold, lives: G.lives, wave: G.wave, kills: G.kills, leaks: G.leaks, endless: G.endless, won: G.won, time: G.time,
    towers: towers.map(tw => ({ id: tw.id, c: tw.c, r: tw.r, lv: tw.lv, spent: tw.spent, mode: tw.mode })), when: Date.now() };
  try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) {}
}
function loadRunSave() { try { return JSON.parse(localStorage.getItem(RUN_KEY)); } catch (e) { return null; } }
function clearRunSave() { try { localStorage.removeItem(RUN_KEY); } catch (e) {} }
function continueRun() { const s = loadRunSave(); if (s && MAPS[s.mi]) newGame(s.mi, s.endless, s); }
function newGame(mi, endless, snap) {
  const M = MAPS[mi];
  renderMap(M);
  G = { mi, M, gold: 260 + mi * 50 + (perk('chest') ? 100 : 0), lives: 20 + (perk('walls') ? 5 : 0), maxLives: 20 + (perk('walls') ? 5 : 0), wave: 0, active: false, queue: [], qT: 0,
    spellCd: [0, 0], kills: 0, leaks: 0, endless: !!endless, won: false, auto: false, time: 0, boss: null };
  enemies = []; towers = []; shots = []; bolts = []; parts = []; floats = []; rings = []; amb = [];
  placing = null; selected = null; targeting = null; speed = 1;
  screen = 'play';
  banner = { title: M.name, sub: M.sub, t: 0, col: THEMES[M.theme].accent };
  Sound.playSong(SONGS[M.song]);
  if (snap) {
    Object.assign(G, { gold: snap.gold, lives: snap.lives, wave: snap.wave, kills: snap.kills, leaks: snap.leaks, won: snap.won, time: snap.time || 0 });
    snap.towers.forEach(s => { const T = TOWERS.find(t => t.id === s.id); if (!T || !tileFree(s.c, s.r)) return; towers.push({ id: T.id, T, c: s.c, r: s.r, x: s.c * TS + 8, y: s.r * TS + 8, lv: s.lv, cd: 0.2, ang: -Math.PI / 2, spent: s.spent, mode: s.mode || 'first', built: 9, kills: 0 }); });
    banner = { title: 'MAP RESTORED', sub: `${M.name} - WAVE ${G.wave + 1} NEXT`, t: 0, col: THEMES[M.theme].accent };
    return;
  }
  saveRun();
  if (!save.tutorial) setTimeout(() => !save.tutorial && screen === 'play' && toast('Pick a tower on the right, then click next to the road to build it', '#ffe680', 6), 1500);
}

// ------------------------------------------------------------ waves
function makeWave(n) {
  const M = G.M, hpMul = M.hp * (1 + 0.17 * (n - 1) + 0.0065 * (n - 1) * (n - 1)) * (n > 20 ? 1 + (n - 20) * 0.09 : 1);
  const avail = M.pool.slice(0, Math.min(M.pool.length, 1 + Math.floor((n + 1) / 3)));
  const list = []; let tt = 0;
  const add = (type, count, gap, mul = 1) => { for (let k = 0; k < count; k++) { list.push({ t: tt, type, hp: hpMul * mul }); tt += gap; } tt += 1.2; };
  const bossWave = n % 10 === 0;
  if (bossWave) {
    add(avail[0], 4 + Math.floor(n / 4), 0.8);
    list.push({ t: tt + 1, boss: M.boss, hp: (n >= 20 ? 1 : 0.4) * (1 + Math.max(0, n - 20) * 0.12) * M.hp / 1.0 });
    tt += 3;
    add(avail[avail.length - 1], 3 + Math.floor(n / 5), 1.2);
  } else if (n % 5 === 0) {
    const sw = avail.includes('bat') ? 'bat' : (avail.includes('wolf') ? 'wolf' : avail[0]);
    add(sw, 10 + n, 0.35, 0.8);
    add(avail[avail.length - 1], 2 + Math.floor(n / 5), 1.4);
  } else {
    const groups = 1 + Math.min(2, Math.floor(n / 4));
    const total = 6 + Math.floor(n * 1.1);
    for (let g = 0; g < groups; g++) {
      const type = g === groups - 1 && n > 3 ? avail[Math.min(avail.length - 1, Math.floor(Math.random() * avail.length))] : pick(avail);
      const D = ENEMIES[type];
      const cnt = Math.max(1, Math.round(total / groups * (D.big ? 0.25 : D.heals ? 0.3 : D.armor ? 0.7 : 1)));
      add(type, cnt, D.big ? 2.2 : D.speed > 1.5 ? 0.5 : 0.85);
    }
  }
  return list;
}
function nextWavePreview() {
  const n = G.wave + 1, M = G.M;
  if (n % 10 === 0) return [M.boss];
  const avail = M.pool.slice(0, Math.min(M.pool.length, 1 + Math.floor((n + 1) / 3)));
  return n % 5 === 0 ? [avail.includes('bat') ? 'bat' : avail.includes('wolf') ? 'wolf' : avail[0], avail[avail.length - 1]] : avail.slice(-3);
}
function startWave() {
  if (G.won && !G.endless) return;
  if (G.queue.length) return;                               // still sending the current wave
  const early = G.active && enemies.length > 0;
  G.wave++; G.active = true; G.qT = 0;
  G.queue = makeWave(G.wave);
  const bonus = early ? 10 + G.wave * 2 : 0;
  if (bonus) { G.gold += bonus; toast(`Called early: +${bonus} gold`, '#ffd65a', 1.6); }
  const isBoss = G.wave % 10 === 0;
  banner = { title: isBoss ? `WAVE ${G.wave} - BOSS!` : `WAVE ${G.wave}`, sub: isBoss ? BOSSES[G.M.boss].name + ' APPROACHES' : '', t: 0, col: isBoss ? '#ff5a5a' : '#ffe680', small: !isBoss };
  SND.horn();
  if (isBoss) { Sound.playSong(SONGS.sboss); shake = 0.4; }
  save.tutorial = true; store();
}
function endWave() {
  G.active = false;
  const bonus = 25 + G.wave * 4;
  let mineGold = 0;
  towers.forEach(tw => { if (tw.id === 'mine') { const g = TOWERS[6].lv[tw.lv].gold; mineGold += g; floats.push({ x: tw.x, y: tw.y - 14, text: '+' + g, col: '#ffd65a', t: 0 }); } });
  G.gold += bonus + mineGold;
  toast(`WAVE ${G.wave} CLEARED  +${bonus + mineGold} gold`, '#6ae06a', 2);
  SND.clear();
  if (G.wave % 10 === 0) Sound.playSong(SONGS[G.M.song]);
  if (G.wave >= WAVES_PER_MAP && !G.won) { win(); return; }
  saveRun();
  if (G.endless) { save.best[G.M.id] = Math.max(save.best[G.M.id] || 0, G.wave); store(); }
  if (G.auto) setTimeout(() => { if (screen === 'play' && !G.active) startWave(); }, 1500);
}

// ------------------------------------------------------------ enemies
function spawnEnemy(type, hpMul, d0 = 0) {
  const D = ENEMIES[type];
  const e = { type, D, d: d0, hp: D.hp * hpMul, maxhp: D.hp * hpMul, speed: D.speed, slow: 0, slowT: 0, frozen: 0, stun: 0, burn: 0, burnT: 0, flash: 0, t: rand(0, 5), x: spawnPt.x, y: spawnPt.y, fly: !!D.fly, armor: D.armor || 0, lives: D.lives || 1, gold: D.gold };
  enemies.push(e); return e;
}
function spawnBoss(id, hpMul) {
  const B = BOSSES[id];
  const e = { type: id, D: B, boss: true, d: 0, hp: B.hp * hpMul, maxhp: B.hp * hpMul, speed: B.speed, slow: 0, slowT: 0, frozen: 0, stun: 0, burn: 0, burnT: 0, flash: 0, t: 0, x: spawnPt.x, y: spawnPt.y, fly: !!B.fly, armor: B.armor || 0, lives: B.lives, gold: Math.round(B.gold * Math.min(1, hpMul + 0.3)), sum: 5, blink: 7 };
  enemies.push(e); G.boss = e;
  shake = 0.5; SND.roar();
  return e;
}
function enemyUpdate(e, dt) {
  e.t += dt; e.flash -= dt;
  if (e.burnT > 0) { e.burnT -= dt; e.burnTick = (e.burnTick || 0) + dt; if (e.burnTick > 0.33) { e.burnTick = 0; hurt(e, e.burn * 0.33, 'burn'); if (Math.random() < 0.5) parts.push({ x: e.x + rand(-3, 3), y: e.y - 6, vx: 0, vy: -20, life: 0.4, t: 0, col: '#ff8a3a', s: 1 }); } }
  if (e.dead) return;
  if (e.slowT > 0) e.slowT -= dt; else e.slow = 0;
  if (e.frozen > 0) { e.frozen -= dt; return; }
  if (e.stun > 0) { e.stun -= dt; return; }
  e.d += e.speed * TS * (1 - e.slow) * dt;
  const p = posAt(e.d); e.x = p.x; e.y = p.y; e.dir = p.dir;
  if (e.D.heals) { e.healT = (e.healT || 0) + dt; if (e.healT > 2) { e.healT = 0; enemies.forEach(o => { if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 26 && o.hp < o.maxhp) { o.hp = Math.min(o.maxhp, o.hp + o.maxhp * 0.07); floats.push({ x: o.x, y: o.y - 12, text: '+', col: '#6aff6a', t: 0 }); } }); rings.push({ x: e.x, y: e.y, r: 2, max: 26, t: 0, col: '#6aff6a' }); } }
  if (e.boss) {
    e.sum -= dt;
    if (e.D.summon && e.sum <= 0) { e.sum = 8; for (let k = 0; k < 2; k++) { const m = spawnEnemy(e.D.summon, (0.6 + G.wave * 0.06) * G.M.hp, Math.max(0, e.d - 10 - k * 8)); } burst(e.x, e.y, 20, '#c46cff', 60); SND.summon(); }
    if (e.D.blink) { e.blink -= dt; if (e.blink <= 0) { e.blink = 7; burst(e.x, e.y, 30, '#c46cff', 80); e.d += TS * 1.6; burst(posAt(e.d).x, posAt(e.d).y, 30, '#c46cff', 80); SND.blink(); } }
  }
  if (e.d >= pathLen) {
    e.dead = true; e.leaked = true;
    G.lives -= e.lives; G.leaks++; flashRed = 0.5; shake = 0.3; SND.leak();
    floats.push({ x: e.x, y: e.y - 10, text: `-${e.lives}`, col: '#ff5a5a', t: 0 });
    if (G.lives <= 0) { G.lives = 0; lose(); }
  }
}
function hurt(e, dmg, type, o = {}) {
  if (e.dead) return 0;
  const D = e.D;
  if (type === 'phys') { dmg = Math.max(dmg * 0.25, dmg - e.armor); if (D.ethereal) dmg *= 0.5; }
  if (type === 'fire' || type === 'burn') { if (D.fireproof && !o.blue) return 0; }
  e.hp -= dmg; e.flash = 0.08;
  if (e.hp <= 0) kill(e);
  return dmg;
}
function kill(e) {
  e.dead = true; G.kills++;
  const col = e.D.tint || { slime: '#4ac05a', imp: '#ff6a3a', eye: '#ff3a8a', ghost: '#c8d8ff', bat: '#6a3a8a', wolf: '#8a849a', shaman: '#5a9a3a', knight: '#5a5468', golem: '#8a849a' }[e.type] || '#e8e4d8';
  burst(e.x, e.y - 4, e.boss ? 120 : 14, col, e.boss ? 140 : 60);
  G.gold += e.gold;
  floats.push({ x: e.x, y: e.y - 10, text: '+' + e.gold, col: '#ffd65a', t: 0 });
  SND.die(e.boss);
  if (e.D.split && !e.small) for (let k = 0; k < 2; k++) { const s = spawnEnemy('slime', e.maxhp / ENEMIES.slime.hp * 0.35, Math.max(0, e.d - k * 6)); s.small = true; s.speed = 1.2; s.gold = 1; }
  if (e.boss) { G.boss = null; shake = 1; flashWhite = 0.6; toast(`${e.D.name} DEFEATED!`, '#ffe680', 3); }
}
let flashWhite = 0;

// ------------------------------------------------------------ towers
function tileFree(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS && !isPath(c, r) && !blockTiles.has(c + ',' + r) && !towers.some(tw => tw.c === c && tw.r === r); }
const costOf = id => Math.round(TOWERS.find(t => t.id === id).cost * (perk('cheap') ? 0.9 : 1));
function startPlacing(id) { placing = id; selected = null; targeting = null; Sound.play('tab'); }
function place(c, r) {
  const cost = costOf(placing);
  if (G.gold < cost) { toast('Not enough gold', '#ff8c78', 1.2); Sound.play('error'); return; }
  if (!tileFree(c, r)) { Sound.play('error'); return; }
  G.gold -= cost;
  const T = TOWERS.find(t => t.id === placing);
  const tw = { id: T.id, T, c, r, x: c * TS + 8, y: r * TS + 8, lv: 0, cd: 0.2, ang: -Math.PI / 2, spent: cost, mode: T.id === 'ballista' ? 'strong' : 'first', built: 0, kills: 0 };
  towers.push(tw);
  burst(tw.x, tw.y + 4, 16, '#c8b090', 50); SND.build();
  if (!keys.ShiftLeft && !keys.ShiftRight) { placing = null; selected = tw; }
}
const stat = (tw, k) => tw.T.lv[tw.lv][k] !== undefined ? tw.T.lv[tw.lv][k] : tw.T.lv[0][k];
function towerRange(tw) { return (stat(tw, 'range') || 0) * TS * (perk('eagle') ? 1.1 : 1); }
function upgrade(tw) {
  if (tw.lv >= 3) return;
  const cost = Math.round(tw.T.lv[tw.lv + 1].cost * (perk('cheap') ? 0.9 : 1));
  if (G.gold < cost) { toast('Not enough gold', '#ff8c78', 1.2); Sound.play('error'); return; }
  G.gold -= cost; tw.lv++; tw.spent += cost; tw.built = 0;
  for (let k = 0; k < 20; k++) parts.push({ x: tw.x + rand(-6, 6), y: tw.y + rand(-4, 6), vx: 0, vy: rand(-50, -20), life: 0.6, t: 0, col: k % 2 ? '#ffe650' : tw.T.color, s: 1 });
  SND.upgrade();
}
function sell(tw) {
  const v = Math.round(tw.spent * 0.7);
  G.gold += v; towers = towers.filter(x => x !== tw); selected = null;
  burst(tw.x, tw.y, 16, '#c8b090', 50); floats.push({ x: tw.x, y: tw.y - 10, text: '+' + v, col: '#ffd65a', t: 0 }); SND.sell();
}
const MODES = ['first', 'last', 'strong', 'close'];
function cycleTarget(tw) { tw.mode = MODES[(MODES.indexOf(tw.mode) + 1) % MODES.length]; Sound.play('tab'); }
function findTarget(tw, range, air) {
  let best = null, bs = -1e9;
  for (const e of enemies) {
    if (e.dead || (e.fly && !air)) continue;
    const d = Math.hypot(e.x - tw.x, e.y - tw.y); if (d > range) continue;
    const s = tw.mode === 'first' ? e.d : tw.mode === 'last' ? -e.d : tw.mode === 'strong' ? e.hp : -d;
    if (s > bs) { bs = s; best = e; }
  }
  return best;
}
function towerUpdate(tw, dt) {
  tw.built += dt;
  if (tw.id === 'mine') { if (Math.random() < dt * 0.6) parts.push({ x: tw.x + rand(-4, 4), y: tw.y - 2, vx: 0, vy: -15, life: 0.6, t: 0, col: '#ffe650', s: 1 }); return; }
  tw.cd -= dt;
  const L = tw.T.lv[tw.lv], range = towerRange(tw);
  const target = findTarget(tw, range, tw.T.air);
  if (target) { const want = Math.atan2(target.y - tw.y, target.x - tw.x); let da = want - tw.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; tw.ang += clamp(da, -12 * dt, 12 * dt); }
  if (!target || tw.cd > 0) return;
  const dmgMul = (tw.id === 'archer' && perk('archer')) || (tw.id === 'cannon' && perk('cannon')) ? 1.25 : 1;
  const D = stat(tw, 'dmg') * dmgMul;
  tw.cd = L.rate;
  tw.recoil = 1;
  if (tw.id === 'archer') {
    const n = L.shots || 1;
    const targets = [target, ...enemies.filter(e => e !== target && !e.dead && Math.hypot(e.x - tw.x, e.y - tw.y) < range)].slice(0, n);
    targets.forEach(tg => shots.push({ kind: 'arrow', x: tw.x, y: tw.y - 8, tg, sp: 220, dmg: D, type: 'phys' }));
    SND.bow();
  } else if (tw.id === 'cannon') {
    const lead = 0.5 * tg_speed(target);
    const p = posAt(target.d + lead);
    shots.push({ kind: 'shell', x: tw.x, y: tw.y - 6, sx: tw.x, sy: tw.y - 6, tx: p.x, ty: p.y, t: 0, dur: 0.5, dmg: D, splash: L.splash * TS, cluster: L.cluster || 0 });
    SND.cannon(); shake = Math.max(shake, 0.05);
  } else if (tw.id === 'frost') {
    shots.push({ kind: 'frost', x: tw.x, y: tw.y - 10, tg: target, sp: 160, dmg: D, slow: Math.min(0.85, L.slow + (perk('frost') ? 0.1 : 0)), area: (L.area || 0) * TS, freeze: L.freeze || 0, type: 'magic' });
    SND.frost();
  } else if (tw.id === 'storm') {
    const chain = L.chain + (perk('storm') ? 1 : 0);
    let cur = target, hit = new Set(), from = { x: tw.x, y: tw.y - 12 }, dmg = D;
    for (let k = 0; k < chain && cur; k++) {
      hit.add(cur); bolts.push({ x1: from.x, y1: from.y, x2: cur.x, y2: cur.y - 4, t: 0 });
      hurt(cur, dmg, 'magic'); if (L.stun && Math.random() < L.stun && !cur.boss) cur.stun = 0.5;
      from = { x: cur.x, y: cur.y - 4 }; dmg *= 0.85;
      let nx = null, nd = TS * 1.8; enemies.forEach(e => { if (!e.dead && !hit.has(e)) { const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < nd) { nd = d; nx = e; } } }); cur = nx;
    }
    SND.zap();
  } else if (tw.id === 'flame') {
    const burnDps = L.burn * (perk('flame') ? 1.5 : 1);
    enemies.forEach(e => {
      if (e.dead || e.fly) return;
      const d = Math.hypot(e.x - tw.x, e.y - tw.y); if (d > range) return;
      let da = Math.atan2(e.y - tw.y, e.x - tw.x) - tw.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      if (Math.abs(da) > 0.6) return;
      if (hurt(e, D, 'fire', { blue: L.blue }) > 0 || L.blue) { if (!e.D.fireproof || L.blue) { e.burn = Math.max(e.burn, burnDps); e.burnT = 3 * (perk('flame') ? 1.5 : 1); } }
    });
    for (let k = 0; k < 3; k++) { const a = tw.ang + rand(-0.45, 0.45), sp = rand(60, 110) * (range / (1.8 * TS)); parts.push({ x: tw.x + Math.cos(tw.ang) * 4, y: tw.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.28, t: 0, col: L.blue ? pick(['#6ad0ff', '#c8f0ff', '#3a8aff']) : pick(['#ff6a1a', '#ffb040', '#ffe650']), s: 2, fire: true }); }
    if (Math.random() < 0.3) SND.flame();
  } else if (tw.id === 'ballista') {
    let dmg = D; const crit = L.crit && Math.random() < L.crit; if (crit) dmg *= 3;
    hurt(target, dmg, 'pierce');
    bolts.push({ x1: tw.x, y1: tw.y - 8, x2: target.x, y2: target.y - 4, t: 0, kind: 'ballista' });
    if (crit) floats.push({ x: target.x, y: target.y - 16, text: 'CRIT!', col: '#ffe650', t: 0 });
    SND.ballista();
  }
}
const tg_speed = e => e.speed * TS * (1 - e.slow) * (e.frozen > 0 ? 0 : 1);
function shotUpdate(s, dt) {
  if (s.kind === 'shell') {
    s.t += dt; const u = s.t / s.dur;
    s.x = lerp(s.sx, s.tx, u); s.y = lerp(s.sy, s.ty, u) - Math.sin(u * Math.PI) * 18;
    if (u >= 1) {
      s.dead = true; boom(s.tx, s.ty, s.splash, s.dmg);
      for (let k = 0; k < s.cluster; k++) { const a = rand(0, 6.28), r = rand(10, 22); shots.push({ kind: 'shell', x: s.tx, y: s.ty, sx: s.tx, sy: s.ty, tx: s.tx + Math.cos(a) * r, ty: s.ty + Math.sin(a) * r, t: 0, dur: 0.35, dmg: s.dmg * 0.35, splash: s.splash * 0.6, cluster: 0, small: true }); }
    }
    return;
  }
  const tg = s.tg;
  if (!tg || tg.dead) { s.dead = true; return; }
  const dx = tg.x - s.x, dy = tg.y - 4 - s.y, d = Math.hypot(dx, dy);
  s.ang = Math.atan2(dy, dx);
  if (d < s.sp * dt + 3) {
    s.dead = true;
    if (s.kind === 'arrow') hurt(tg, s.dmg, 'phys');
    else if (s.kind === 'frost') {
      const affect = e => { if (e.dead) return; hurt(e, s.dmg, 'magic'); if (!e.D.noslow) { e.slow = Math.max(e.slow, e.boss ? s.slow * 0.6 : s.slow); e.slowT = 1.6; if (s.freeze && Math.random() < s.freeze && !e.boss) { e.frozen = 1.1; } } };
      affect(tg);
      if (s.area) { enemies.forEach(e => { if (e !== tg && Math.hypot(e.x - tg.x, e.y - tg.y) < s.area) affect(e); }); rings.push({ x: tg.x, y: tg.y, r: 2, max: s.area, t: 0, col: '#a8f0ff' }); }
      burst(tg.x, tg.y - 4, 6, '#c8f0ff', 30);
    }
  } else { s.x += dx / d * s.sp * dt; s.y += dy / d * s.sp * dt; }
}
function boom(x, y, rad, dmg) {
  burst(x, y, 18, '#ff8a3a', 70); burst(x, y, 10, '#ffe650', 50); burst(x, y, 10, '#5a5468', 40);
  rings.push({ x, y, r: 2, max: rad, t: 0, col: '#ffcc66' });
  enemies.forEach(e => { if (e.dead || e.fly) return; const d = Math.hypot(e.x - x, e.y - y); if (d < rad + 4) hurt(e, dmg * (1 - 0.5 * d / (rad + 4)), 'phys'); });
  SND.boom();
}

// ------------------------------------------------------------ spells
function castSpell(i) {
  if (screen !== 'play') return;
  if (G.spellCd[i] > 0) { Sound.play('error'); return; }
  if (i === 0) { targeting = 'meteor'; placing = null; selected = null; Sound.play('tab'); toast('Click where the meteor should land', '#ff8a3a', 1.6); }
  else {
    enemies.forEach(e => { if (!e.D.noslow) e.frozen = e.boss ? 1.5 : 3; });
    G.spellCd[1] = SPELLS[1].cd * (perk('meteor') ? 0.7 : 1);
    flashIce = 0.8; SND.freeze();
  }
}
let flashIce = 0, meteors = [];
function dropMeteor(x, y) {
  meteors.push({ x, y, t: 0 });
  G.spellCd[0] = SPELLS[0].cd * (perk('meteor') ? 0.7 : 1);
  targeting = null; SND.whoosh();
}

// ------------------------------------------------------------ particles
function burst(x, y, n, col, sp) { for (let k = 0; k < n; k++) { const a = rand(0, 6.283), v = rand(0.2, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, life: rand(0.3, 0.6), t: 0, col, s: Math.random() < 0.3 ? 2 : 1, g: 80 }); } }
let toastQ = [];
function toast(s, col = '#fff', dur = 2.5) { toastQ.push({ s, col, t: 0, dur }); if (toastQ.length > 3) toastQ.shift(); }

// ------------------------------------------------------------ update
function update(dt) {
  G.time += dt;
  G.spellCd = G.spellCd.map(c => Math.max(0, c - dt));
  // spawn queue
  if (G.queue.length) {
    G.qT += dt;
    while (G.queue.length && G.queue[0].t <= G.qT) {
      const q = G.queue.shift();
      if (q.boss) spawnBoss(q.boss, q.hp); else spawnEnemy(q.type, q.hp);
    }
  }
  enemies.forEach(e => enemyUpdate(e, dt));
  enemies = enemies.filter(e => !e.dead);
  towers.forEach(tw => towerUpdate(tw, dt));
  shots.forEach(s => shotUpdate(s, dt)); shots = shots.filter(s => !s.dead);
  meteors.forEach(m => {
    m.t += dt;
    if (m.t >= 0.7 && !m.hit) {
      m.hit = true; const dmg = 160 + G.wave * 30;
      enemies.forEach(e => { if (Math.hypot(e.x - m.x, e.y - m.y) < 24) { hurt(e, dmg, 'magic'); if (!e.D.fireproof) { e.burn = Math.max(e.burn, 10 + G.wave); e.burnT = 3; } } });
      burst(m.x, m.y, 50, '#ff8a3a', 120); burst(m.x, m.y, 30, '#ffe650', 90); rings.push({ x: m.x, y: m.y, r: 2, max: 26, t: 0, col: '#ffb040' });
      shake = 0.6; SND.boom(); SND.boom();
    }
  });
  meteors = meteors.filter(m => m.t < 1);
  if (G.active && !G.queue.length && !enemies.length) endWave();
}
function updateFx(dt) {
  parts.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.fire) { p.vx *= 0.93; p.vy = p.vy * 0.93 + (p.g || 0) * dt; } });
  parts = parts.filter(p => p.t < p.life); if (parts.length > 900) parts.splice(0, parts.length - 900);
  floats.forEach(f => { f.t += dt; f.y -= 16 * dt; }); floats = floats.filter(f => f.t < 0.9);
  rings.forEach(r => { r.t += dt; }); rings = rings.filter(r => r.t < 0.35);
  bolts.forEach(b => { b.t += dt; }); bolts = bolts.filter(b => b.t < 0.14);
  // ambient
  const th = G ? G.M.theme : 'meadow';
  while (amb.length < (th === 'frozen' ? 70 : 24)) amb.push({ x: rand(0, MW), y: rand(-10, MH), ph: rand(0, 6), s: rand(0.5, 1.4) });
  amb.forEach(a => {
    a.ph += dt;
    if (th === 'frozen') { a.y += (10 + a.s * 8) * dt; a.x += Math.sin(a.ph) * 6 * dt - 4 * dt; }
    else if (th === 'meadow') { a.y += (6 + a.s * 3) * dt; a.x += Math.sin(a.ph * 1.3) * 12 * dt; }
    else if (th === 'forge' || th === 'void') { a.y -= (6 + a.s * 6) * dt; a.x += Math.sin(a.ph) * 4 * dt; }
    else { a.x += 3 * dt * a.s; }
    if (a.y > MH + 4) { a.y = -4; a.x = rand(0, MW); } if (a.y < -6) { a.y = MH + 2; a.x = rand(0, MW); } if (a.x > MW + 10) a.x = -10; if (a.x < -10) a.x = MW + 10;
  });
}

// ------------------------------------------------------------ drawing (low-res world)
function px(x, y, col, w = 1, h = 1) { lx.fillStyle = col; lx.fillRect(Math.round(x), Math.round(y), w, h); }
function drawWorld() {
  const th = THEMES[G.M.theme];
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.fillStyle = '#05030a'; lx.fillRect(0, 0, MW, MH + 4);
  const sx = shake > 0 ? Math.round(rand(-1, 1) * shake * 4) : 0, sy = shake > 0 ? Math.round(rand(-1, 1) * shake * 4) : 0;
  lx.translate(sx, MY + sy);
  lx.drawImage(mapCv, 0, 0);
  // animated water / lava shimmer
  if (waterArea) { const a = waterArea; for (let k = 0; k < 6; k++) { const ph = (t * 0.6 + k / 6) % 1; lx.globalAlpha = Math.sin(ph * Math.PI) * 0.7; px(a.x + 4 + ((k * 7) % (a.w - 10)), a.y + 4 + ((k * 5) % (a.h - 8)), a.liq[1], 3, 1); } lx.globalAlpha = 1; }
  // spawn portal
  const sp = spawnPt, pc = th.accent;
  for (let k = 0; k < 3; k++) { lx.strokeStyle = rgba(pc === '#ffe650' ? '#7a3ad0' : pc, 0.7 - k * 0.2); lx.lineWidth = 1; lx.beginPath(); lx.ellipse(sp.x, sp.y, 6 - k * 1.5 + Math.sin(t * 3 + k) * 0.8, 7 - k * 1.5, 0, 0, 6.3); lx.stroke(); }
  // path direction chevrons near the spawn (before the first wave)
  if (G.wave === 0) for (let k = 0; k < 6; k++) { const d = ((t * 30 + k * 18) % 110); const p = posAt(d); lx.globalAlpha = 0.6 * (1 - d / 110); px(p.x - 1, p.y - 1, '#ffffff', 3, 3); lx.globalAlpha = 1; }
  // castle flags
  const [cc, cr] = G.M.castle;
  [[cc * TS + 3, cr * TS - 1], [cc * TS + 27, cr * TS - 1]].forEach(([fx, fy], i) => { px(fx, fy - 8, '#3a2a1a', 1, 10); const wv = Math.sin(t * 6 + i) > 0 ? 1 : 0; px(fx + 1, fy - 8, th.accent === '#ffe650' ? '#3a6ad0' : th.accent, 5, 3); px(fx + 6, fy - 8 + wv, th.accent === '#ffe650' ? '#3a6ad0' : th.accent, 1, 2); });
  // castle damage smoke when low
  if (G.lives < G.maxLives * 0.4 && Math.random() < 0.2) parts.push({ x: cc * TS + rand(4, 28), y: cr * TS + rand(4, 12), vx: rand(-3, 3), vy: -12, life: 1, t: 0, col: '#4a4458', s: 2 });
  // range + placement preview
  if (hoverTile && placing) {
    const ok = tileFree(hoverTile.c, hoverTile.r) && G.gold >= costOf(placing);
    const T = TOWERS.find(x => x.id === placing), r = (T.lv[0].range || 0) * TS * (perk('eagle') ? 1.1 : 1);
    const X = hoverTile.c * TS, Y = hoverTile.r * TS;
    lx.fillStyle = ok ? 'rgba(120,255,120,0.25)' : 'rgba(255,80,80,0.35)'; lx.fillRect(X, Y, TS, TS);
    if (r) { lx.strokeStyle = ok ? 'rgba(255,255,255,0.7)' : 'rgba(255,90,90,0.7)'; lx.setLineDash([2, 2]); lx.beginPath(); lx.arc(X + 8, Y + 8, r, 0, 6.3); lx.stroke(); lx.setLineDash([]); lx.fillStyle = ok ? 'rgba(255,255,255,0.08)' : 'rgba(255,90,90,0.08)'; lx.fill(); }
    lx.globalAlpha = 0.65; drawTower({ id: placing, T, x: X + 8, y: Y + 8, lv: 0, ang: -Math.PI / 2, built: 9 }); lx.globalAlpha = 1;
  } else if (hoverTile && !placing && !targeting && tileFree(hoverTile.c, hoverTile.r)) { lx.fillStyle = 'rgba(255,255,255,0.08)'; lx.fillRect(hoverTile.c * TS, hoverTile.r * TS, TS, TS); }
  if (selected) { const r = towerRange(selected); if (r) { lx.strokeStyle = 'rgba(255,255,255,0.75)'; lx.setLineDash([2, 2]); lx.beginPath(); lx.arc(selected.x, selected.y, r, 0, 6.3); lx.stroke(); lx.setLineDash([]); lx.fillStyle = 'rgba(255,255,255,0.07)'; lx.fill(); } }
  if (targeting && hoverTile) { const mx = mouse.x / S, my = mouse.y / S - MY; lx.strokeStyle = 'rgba(255,140,40,0.9)'; lx.lineWidth = 1; lx.beginPath(); lx.arc(mx, my, 24, 0, 6.3); lx.stroke(); lx.fillStyle = 'rgba(255,120,40,0.15)'; lx.fill(); }
  // sort towers + enemies by y
  const list = [];
  towers.forEach(tw => list.push({ y: tw.y, f: () => drawTower(tw) }));
  enemies.forEach(e => list.push({ y: e.y + (e.fly ? 6 : 0), f: () => drawEnemy(e) }));
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  // shots
  shots.forEach(s => {
    if (s.kind === 'arrow') { const a = s.ang || 0; for (let k = 0; k < 5; k++) px(s.x - Math.cos(a) * k, s.y - Math.sin(a) * k, k < 1 ? '#e8eef8' : '#a07040'); }
    else if (s.kind === 'shell') { const r = s.small ? 1 : 2; px(s.x - r, s.y - r, '#1a1420', r * 2 + 1, r * 2 + 1); px(s.x - r + 1, s.y - r + 1, '#4a4458', r, r); if (Math.random() < 0.5) parts.push({ x: s.x, y: s.y, vx: 0, vy: -4, life: 0.3, t: 0, col: 'rgba(200,200,200,0.5)', s: 1 }); }
    else if (s.kind === 'frost') { lx.globalAlpha = 0.35; px(s.x - 3, s.y - 3, '#8ad8ff', 6, 6); lx.globalAlpha = 1; px(s.x - 1.5, s.y - 1.5, '#c8f0ff', 3, 3); px(s.x - 0.5, s.y - 0.5, '#ffffff'); parts.push({ x: s.x, y: s.y, vx: rand(-5, 5), vy: rand(-5, 5), life: 0.25, t: 0, col: '#a8e8ff', s: 1 }); }
  });
  // bolts
  bolts.forEach(b => {
    if (b.kind === 'ballista') { lx.strokeStyle = `rgba(230,210,255,${1 - b.t / 0.14})`; lx.lineWidth = 2; lx.beginPath(); lx.moveTo(b.x1, b.y1); lx.lineTo(b.x2, b.y2); lx.stroke(); return; }
    lx.strokeStyle = `rgba(255,250,170,${1 - b.t / 0.14})`; lx.lineWidth = 1; lx.beginPath(); lx.moveTo(b.x1, b.y1);
    for (let k = 1; k < 5; k++) lx.lineTo(lerp(b.x1, b.x2, k / 5) + rand(-3, 3), lerp(b.y1, b.y2, k / 5) + rand(-3, 3));
    lx.lineTo(b.x2, b.y2); lx.stroke();
    lx.strokeStyle = `rgba(255,255,255,${1 - b.t / 0.14})`; lx.beginPath(); lx.moveTo(b.x1, b.y1); lx.lineTo(b.x2, b.y2); lx.stroke();
  });
  // meteors
  meteors.forEach(m => {
    if (m.t < 0.7) { const u = m.t / 0.7; const x = m.x + (1 - u) * 60, y = m.y - (1 - u) * 120; lx.strokeStyle = 'rgba(255,120,40,0.8)'; lx.beginPath(); lx.arc(m.x, m.y, 24, 0, 6.3); lx.stroke(); for (let k = 0; k < 8; k++) px(x + k * 3, y - k * 6, k < 2 ? '#ffe650' : '#ff6a1a', 4 - k * 0.3, 4 - k * 0.3); px(x - 3, y - 3, '#ffffff', 6, 6); }
  });
  rings.forEach(r => { lx.strokeStyle = rgba(r.col, 1 - r.t / 0.35); lx.lineWidth = 1; lx.beginPath(); lx.arc(r.x, r.y, lerp(r.r, r.max, r.t / 0.35), 0, 6.3); lx.stroke(); });
  parts.forEach(p => { lx.globalAlpha = 1 - p.t / p.life; px(p.x, p.y, p.col, p.s, p.s); }); lx.globalAlpha = 1;
  // ambient
  amb.forEach((a, i) => {
    if (th.ambient === 'snow') { lx.globalAlpha = 0.85; px(a.x, a.y, '#ffffff', a.s > 1 ? 2 : 1, a.s > 1 ? 2 : 1); }
    else if (th.ambient === 'leaves') { if (i % 3) return; lx.globalAlpha = 0.9; px(a.x, a.y, i % 2 ? '#e8a040' : '#8ac04a', 2, 1); }
    else if (th.ambient === 'embers') { lx.globalAlpha = 0.5 + 0.5 * Math.sin(a.ph * 4); px(a.x, a.y, i % 2 ? '#ff8a3a' : '#ffcc33'); }
    else if (th.ambient === 'motes') { lx.globalAlpha = 0.5 + 0.5 * Math.sin(a.ph * 3); px(a.x, a.y, i % 2 ? '#c46cff' : '#8ab8ff'); }
    else { lx.globalAlpha = 0.12; lx.fillStyle = '#c8c8e0'; lx.beginPath(); lx.ellipse(a.x, a.y, 24, 4, 0, 0, 6.3); lx.fill(); }
  });
  lx.globalAlpha = 1;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  if (th.tint) { lx.fillStyle = th.tint; lx.fillRect(0, 0, MW, MH + 4); }
  if (flashIce > 0) { lx.fillStyle = `rgba(180,230,255,${flashIce * 0.35})`; lx.fillRect(0, 0, MW, MH + 4); }
}
function drawTower(tw) {
  const x = Math.round(tw.x), y = Math.round(tw.y), lv = tw.lv, a = tw.ang, T = tw.T;
  const pop = Math.min(1, (tw.built || 9) * 6), dy = Math.round((1 - pop) * 4);
  const rec = (tw.recoil || 0); if (tw.recoil) tw.recoil = Math.max(0, tw.recoil - 0.12);
  // shadow + stone base
  lx.fillStyle = 'rgba(0,0,0,0.3)'; lx.beginPath(); lx.ellipse(x + 1, y + 6, 8, 3, 0, 0, 6.3); lx.fill();
  const stoneA = lv >= 1 ? '#8a849a' : '#7a6a5a', stoneB = lv >= 1 ? '#5a5468' : '#5a4a3a';
  if (tw.id !== 'mine') { px(x - 6, y + 1 + dy, '#1a1420', 12, 6); px(x - 5, y + 1 + dy, stoneA, 10, 4); px(x - 5, y + 4 + dy, stoneB, 10, 2); px(x - 5, y + 1 + dy, shade(stoneA, 0.2), 10, 1); }
  const Y = y + dy;
  const trim = lv >= 3 ? '#ffcc33' : lv >= 2 ? '#c8c8d8' : '#8a6a3a';
  if (tw.id === 'archer') {
    px(x - 4, Y - 8, '#2a1a10', 8, 10); px(x - 3, Y - 8, '#8a5a2a', 6, 9); px(x - 3, Y - 8, '#a87a3a', 2, 9);
    px(x - 5, Y - 10, '#2a1a10', 10, 3); px(x - 4, Y - 10, trim, 8, 2);
    if (lv >= 2) { px(x + 4, Y - 18, '#3a2a1a', 1, 8); px(x + 5, Y - 18, '#e83a3a', 4, 3); }
    lx.save(); lx.translate(x, Y - 12); lx.rotate(a);
    lx.fillStyle = '#5a3a1a'; lx.fillRect(-2, -1, 7, 2); lx.strokeStyle = lv >= 3 ? '#ffcc33' : '#c8a060'; lx.lineWidth = 1; lx.beginPath(); lx.arc(3 - rec, 0, 4, -1.3, 1.3); lx.stroke();
    lx.restore();
  } else if (tw.id === 'cannon') {
    px(x - 5, Y - 6, '#2a2430', 10, 7); px(x - 4, Y - 6, '#6a6478', 8, 6); px(x - 4, Y - 6, '#8a849a', 8, 1);
    lx.save(); lx.translate(x, Y - 6); lx.rotate(a);
    const len = 7 + lv, w = 4 + (lv >= 2 ? 1 : 0);
    lx.fillStyle = '#0a0810'; lx.fillRect(-2 - rec * 2, -w / 2 - 0.5, len + 1, w + 1); lx.fillStyle = '#2a2830'; lx.fillRect(-1 - rec * 2, -w / 2, len, w);
    lx.fillStyle = trim; lx.fillRect(1 - rec * 2, -w / 2, 1, w); if (lv >= 1) lx.fillRect(len - 3 - rec * 2, -w / 2, 1, w);
    lx.fillStyle = '#5a5468'; lx.fillRect(-1 - rec * 2, -w / 2, len, 1);
    lx.restore();
    px(x - 2, Y - 8, '#4a4458', 4, 3);
  } else if (tw.id === 'frost') {
    px(x - 3, Y - 10, '#1a2a4a', 6, 11); px(x - 2, Y - 10, '#3a6aa8', 4, 10); px(x - 2, Y - 10, '#5a9ad8', 1, 10);
    const orbY = Y - 15 + Math.sin(t * 3) * 1.5;
    lx.globalAlpha = 0.35; px(x - 4, orbY - 4, '#8ad8ff', 8, 8); lx.globalAlpha = 1;
    px(x - 2, orbY - 2, '#a8e8ff', 5, 5); px(x - 1, orbY - 1, '#ffffff', 2, 2);
    for (let k = 0; k < lv + 1; k++) { const aa = t * 2 + k * 6.283 / (lv + 1); px(x + Math.cos(aa) * 6, orbY + Math.sin(aa) * 2, '#c8f0ff'); }
    if (lv >= 3) { px(x - 5, Y - 6, '#ffcc33', 1, 3); px(x + 4, Y - 6, '#ffcc33', 1, 3); }
  } else if (tw.id === 'storm') {
    px(x - 3, Y - 12, '#1a1420', 6, 13); px(x - 2, Y - 12, '#5a5468', 4, 12); px(x - 2, Y - 12, '#8a849a', 1, 12);
    for (let k = 0; k < 2 + lv; k++) px(x - 4, Y - 3 - k * 3, '#c88a3a', 8, 1);
    const orbY = Y - 16;
    px(x - 2, orbY - 2, '#ffe650', 5, 5); px(x - 1, orbY - 1, '#ffffff', 3, 3);
    if (Math.random() < 0.3) { const aa = rand(0, 6.28); px(x + Math.cos(aa) * 4, orbY + Math.sin(aa) * 4, '#ffffa0'); }
  } else if (tw.id === 'flame') {
    px(x - 5, Y - 5, '#1a1012', 10, 5); px(x - 4, Y - 5, '#4a3a38', 8, 4); px(x - 5, Y - 6, trim === '#8a6a3a' ? '#6a5a58' : trim, 10, 1);
    const blue = lv >= 3;
    for (let k = 0; k < 5; k++) { const h = 3 + Math.abs(Math.sin(t * 10 + k * 1.3)) * (4 + lv); px(x - 4 + k * 2, Y - 6 - h, blue ? (k % 2 ? '#6ad0ff' : '#c8f0ff') : (k % 2 ? '#ff6a1a' : '#ffb040'), 2, h); }
    px(x - 1, Y - 8, blue ? '#ffffff' : '#ffe650', 2, 2);
  } else if (tw.id === 'ballista') {
    px(x - 6, Y - 4, '#2a1a10', 12, 4); px(x - 5, Y - 4, '#8a5a2a', 10, 3); px(x - 5, Y - 4, '#a87a3a', 10, 1);
    lx.save(); lx.translate(x, Y - 6); lx.rotate(a);
    lx.fillStyle = '#3a2a1a'; lx.fillRect(-4 - rec * 2, -1, 12, 2);
    lx.strokeStyle = lv >= 3 ? '#ffcc33' : '#c8a060'; lx.lineWidth = 1.5; lx.beginPath(); lx.arc(4 - rec * 2, 0, 6, -1.4, 1.4); lx.stroke();
    lx.fillStyle = '#e8e8f0'; lx.fillRect(6 - rec * 3, -0.5, 4, 1);
    lx.restore();
  } else if (tw.id === 'mine') {
    lx.fillStyle = 'rgba(0,0,0,0.3)'; lx.beginPath(); lx.ellipse(x + 1, Y + 6, 8, 3, 0, 0, 6.3); lx.fill();
    px(x - 6, Y - 4, '#3a3028', 12, 9); px(x - 5, Y - 5, '#5a4a3a', 10, 3); px(x - 3, Y - 2, '#0a0806', 6, 7); px(x - 4, Y - 3, '#8a5a2a', 8, 1); px(x - 4, Y - 3, '#8a5a2a', 1, 8); px(x + 3, Y - 3, '#8a5a2a', 1, 8);
    const pile = 2 + lv * 2; for (let k = 0; k < pile; k++) px(x - 6 + (k * 3) % 13, Y + 3 - Math.floor(k / 4), k % 2 ? '#f2c14e' : '#ffe680', 2, 2);
    if (Math.sin(t * 3) > 0.9) px(x + 3, Y + 1, '#ffffff');
  }
  // level pips
  if (tw.id !== 'mine' || true) for (let k = 0; k <= lv; k++) px(x - 4 + k * 3, y + 8, lv >= 3 ? '#ffcc33' : '#e8e4f0', 2, 1);
  if (selected === tw) { lx.strokeStyle = '#ffffff'; lx.lineWidth = 1; lx.strokeRect(x - 8 + 0.5, y - 8 + 0.5, 15, 15); }
}
function drawEnemy(e) {
  const B = e.boss, D = e.D;
  const name = D.sprite, img = sprite(name, D.tint), wimg = SPR[name + (D.tint || '') + '_w'];
  let sc = B ? 1.8 : (e.small ? 0.6 : D.big ? 1.25 : name === 'knight' || name === 'wolf' ? 0.95 : 0.85);
  const bob = e.frozen > 0 || e.stun > 0 ? 0 : (e.fly ? Math.sin(e.t * 6) * 1.5 : -Math.abs(Math.sin(e.t * 8)) * 1);
  const lift = e.fly ? 8 : 0;
  lx.fillStyle = 'rgba(0,0,0,0.3)'; lx.beginPath(); lx.ellipse(e.x, e.y + 4, 5 * sc, 2 * sc, 0, 0, 6.3); lx.fill();
  const flip = Math.cos(e.dir || 0) < -0.1;
  const w = img.width * sc, h = img.height * sc;
  lx.save(); lx.translate(Math.round(e.x), Math.round(e.y + 5 - lift + bob)); if (flip) lx.scale(-1, 1);
  if (D.ethereal) lx.globalAlpha = 0.75;
  lx.drawImage(e.flash > 0 ? wimg : img, -w / 2, -h, w, h);
  lx.restore();
  if (e.slow > 0 && e.frozen <= 0) { lx.globalAlpha = 0.35; px(e.x - w / 2, e.y + 5 - lift - h, '#8ad8ff', w, h); lx.globalAlpha = 1; }
  if (e.frozen > 0) { lx.globalAlpha = 0.6; px(e.x - w / 2 - 1, e.y + 5 - lift - h - 1, '#c8f0ff', w + 2, h + 2); lx.globalAlpha = 1; px(e.x - w / 2 - 1, e.y + 5 - lift - h - 1, '#ffffff', w + 2, 1); }
  if (e.stun > 0) for (let k = 0; k < 2; k++) px(e.x + Math.cos(t * 8 + k * 3) * 4, e.y - h - lift + 2, '#ffe650');
  if (D.crown) { const cy = e.y + 5 - lift - h - 2; px(e.x - 6, cy, '#ffcc33', 12, 3); for (let k = 0; k < 4; k++) px(e.x - 6 + k * 4, cy - 2, '#ffcc33', 2, 2); }
  // hp bar
  if (e.hp < e.maxhp && !B) { const bw = Math.max(10, w * 0.8); px(e.x - bw / 2 - 1, e.y - h - lift - 2, '#0a0610', bw + 2, 3); px(e.x - bw / 2, e.y - h - lift - 1, '#3a0a14', bw, 1); px(e.x - bw / 2, e.y - h - lift - 1, D.armor ? '#c8c8e0' : '#ff4a5a', bw * Math.max(0, e.hp / e.maxhp), 1); }
}

// ------------------------------------------------------------ UI helpers (full res)
function text(s, x, y, size = 16, col = '#fff', align = 'left', shadow = true) {
  ctx.font = fontOf(size); ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = Math.max(4, size / 3); ctx.shadowOffsetY = Math.max(1, size / 10); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore(); }
  else { ctx.fillStyle = col; ctx.fillText(s, x, y); }
}
function wrapText(s, x, y, maxW, size, col, lh, align = 'left') {
  ctx.font = fontOf(size); const words = s.split(' '); let line = '', yy = y;
  words.forEach(w => { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { text(line, x, yy, size, col, align); line = w; yy += lh; } else line = tt; });
  if (line) text(line, x, yy, size, col, align); return yy + lh;
}
function panel(x, y, w, h, border = '#5a4a3a', fill = '#1a140e') {
  modernPanel(x, y, w, h, border, fill);
}
function button(id, x, y, w, h, label, o = {}) {
  const over = mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  if (over && !o.disabled) UI.hover = id;
  const pressed = over && UI.down, base = o.disabled ? '#3a3430' : (o.color || '#5a3a2a'), dy = pressed ? 3 : 0;
  modernButton(x, y, w, h, base, over, pressed, o.disabled);
  if (o.draw) o.draw(x, y + dy);
  if (label) text(label, x + w / 2, y + dy + (h - (o.size || 16) * 1.3) / 2 + 1 + (o.oy || 0), o.size || 16, o.disabled ? '#7a7068' : (o.tc || '#ffffff'), 'center');
  const c = UI.click;
  if (c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { UI.click = null; if (o.disabled) { Sound.play('error'); return false; } Sound.play(o.sfx || 'click'); return true; }
  return false;
}
function towerIcon(T, x, y, scale = 3) {
  const key = 'icon_' + T.id;
  if (!SPR[key]) {
    const c = document.createElement('canvas'); c.width = 20; c.height = 26;
    const keep = lx, sel = selected; lx = c.getContext('2d'); selected = null;
    try { drawTower({ id: T.id, T, x: 10, y: 15, lv: 0, ang: -0.6, built: 9 }); } finally { lx = keep; selected = sel; }
    SPR[key] = c;
  }
  ctx.imageSmoothingEnabled = false; ctx.drawImage(SPR[key], x, y, 20 * scale, 26 * scale);
}

// ------------------------------------------------------------ HUD + side panel
function drawPanel() {
  const x0 = PX;
  ctx.fillStyle = '#120c08'; ctx.fillRect(x0, 0, W - x0, H);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x0, 0, 4, H);
  for (let y = 0; y < H; y += 32) { ctx.fillStyle = (y / 32) % 2 ? '#160f0a' : '#140d09'; ctx.fillRect(x0 + 4, y, W - x0 - 4, 32); }
  // lives + gold + wave
  const hs = sprite('heart'), cs = sprite('coin');
  ctx.imageSmoothingEnabled = false;
  const lshake = flashRed > 0 ? rand(-3, 3) : 0;
  ctx.drawImage(hs, x0 + 18 + lshake, 16, hs.width * 4, hs.height * 4); text(String(G.lives), x0 + 58 + lshake, 20, 16, flashRed > 0 ? '#ff5a5a' : '#ff9aa8');
  ctx.drawImage(cs, x0 + 128, 16, cs.width * 4, cs.height * 4); text(fmt(G.gold), x0 + 162, 20, 16, '#ffd65a');
  text(G.endless || G.wave > WAVES_PER_MAP ? `WAVE ${G.wave}` : `WAVE ${G.wave}/${WAVES_PER_MAP}`, x0 + 18, 56, 12, '#e8e4f0');
  if (G.endless) text('ENDLESS', W - 16, 56, 8, '#c46cff', 'right');
  // tower buttons
  TOWERS.forEach((T, i) => {
    const bx = x0 + 14 + (i % 2) * 120, by = 84 + Math.floor(i / 2) * 76, cost = costOf(T.id), can = G.gold >= cost;
    const on = placing === T.id;
    if (button('t' + T.id, bx, by, 112, 70, '', { color: on ? '#7a5a2a' : (can ? '#3a2a1e' : '#2a2018'), sfx: 'tab', draw: (X, Y) => {
      towerIcon(T, X + 4, Y + 4, 2);
      text(T.name.split(' ')[0], X + 48, Y + 10, 8, can ? '#ffffff' : '#7a7068');
      text(String(cost), X + 62, Y + 34, 12, can ? '#ffd65a' : '#8a5a4a');
      ctx.drawImage(cs, X + 46, Y + 34, cs.width * 2, cs.height * 2);
      text(T.key, X + 100, Y + 52, 8, '#8a7a6a', 'right');
    } })) { if (placing === T.id) placing = null; else startPlacing(T.id); }
    if (mouse.x >= bx && mouse.x < bx + 112 && mouse.y >= by && mouse.y < by + 70) hoverBuild = T;
  });
  // info box
  const iy = 392, ih = 186;
  panel(x0 + 10, iy, 236, ih, '#4a3424', '#1a120c');
  const info = selected ? selected.T : (hoverBuild || (placing ? TOWERS.find(t => t.id === placing) : null));
  if (selected) {
    const tw = selected, T = tw.T, L = T.lv[tw.lv];
    text(T.name, x0 + 24, iy + 18, 8, T.color);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k <= tw.lv ? '#ffcc33' : '#3a3028'; ctx.fillRect(x0 + 24 + k * 16, iy + 34, 12, 6); }
    const lines = statLines(tw.id, tw.lv);
    lines.forEach((l, i) => text(l, x0 + 24, iy + 50 + i * 16, 8, '#e8e4d8'));
    if (tw.id !== 'mine') { if (button('tgt', x0 + 150, iy + 30, 86, 26, tw.mode.toUpperCase(), { color: '#2a3a4a', size: 8 })) cycleTarget(tw); }
    if (tw.lv < 3) {
      const nc = Math.round(T.lv[tw.lv + 1].cost * (perk('cheap') ? 0.9 : 1));
      const nxt = statLines(tw.id, tw.lv + 1, tw.lv);
      text('NEXT: ' + (T.lv[tw.lv + 1].note || nxt[0] || ''), x0 + 24, iy + 116, 8, '#8ae08a');
      if (button('up', x0 + 20, iy + 134, 120, 40, `UP ${nc}`, { color: G.gold >= nc ? '#3a6a2a' : '#2a2a22', size: 12, disabled: G.gold < nc, sfx: 'buy' })) upgrade(tw);
    } else text('MAX LEVEL', x0 + 24, iy + 116, 8, '#ffcc33');
    if (button('sell', x0 + 148, iy + 134, 88, 40, `$${Math.round(tw.spent * 0.7)}`, { color: '#6a2a2a', size: 12, sfx: 'back' })) sell(tw);
  } else if (info) {
    text(info.name, x0 + 24, iy + 18, 8, info.color);
    wrapText(info.desc, x0 + 24, iy + 38, 206, 8, '#c8c0b0', 15);
    statLines(info.id, 0).forEach((l, i) => text(l, x0 + 24, iy + 92 + i * 16, 8, '#e8e4d8'));
    text(placing ? 'Click a tile next to the road' : 'Click to build', x0 + 24, iy + ih - 26, 8, '#8a7a6a');
  } else {
    text('NEXT WAVE', x0 + 24, iy + 18, 8, '#c8c0b0');
    nextWavePreview().forEach((type, i) => { const D = ENEMIES[type] || BOSSES[type]; const im = sprite(D.sprite, D.tint); ctx.drawImage(im, x0 + 24 + i * 56, iy + 40, im.width * 3, im.height * 3); });
    const D0 = ENEMIES[nextWavePreview()[0]] || BOSSES[nextWavePreview()[0]];
    const tips = [];
    nextWavePreview().forEach(type => { const D = ENEMIES[type] || BOSSES[type]; if (D.fly) tips.push('Flyers: cannons/fire can\'t hit'); if (D.armor) tips.push('Armored: use magic or ballista'); if (D.fireproof) tips.push('Fireproof: flames won\'t work'); if (D.noslow) tips.push('Can\'t be slowed'); if (D.ethereal) tips.push('Ghostly: half arrow/cannon dmg'); });
    [...new Set(tips)].slice(0, 3).forEach((tp, i) => text(tp, x0 + 24, iy + 106 + i * 18, 8, '#ff9a7a'));
  }
  // spells
  SPELLS.forEach((sp, i) => {
    const bx = x0 + 14 + i * 120, by = 590, cd = G.spellCd[i], max = sp.cd * (perk('meteor') ? 0.7 : 1);
    if (button('sp' + i, bx, by, 112, 50, '', { color: i === 0 ? '#6a2a14' : '#1a4a6a', disabled: cd > 0, draw: (X, Y) => {
      text(sp.name, X + 56, Y + 10, 8, cd > 0 ? '#7a7068' : '#ffffff', 'center');
      text(cd > 0 ? Math.ceil(cd) + 's' : `[${sp.key}]`, X + 56, Y + 26, 8, cd > 0 ? '#c8c0b0' : '#ffe680', 'center');
      if (cd > 0) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(X, Y, 112 * (cd / max), 45); }
    } })) castSpell(i);
  });
  // wave button + speed
  const canStart = !G.queue.length && !(G.won && !G.endless);
  const lbl = !G.active ? (G.wave === 0 ? 'START' : 'NEXT WAVE') : (G.queue.length ? 'SENDING...' : 'CALL EARLY');
  if (button('wave', x0 + 14, 650, 160, 56, lbl, { color: canStart ? (G.active ? '#6a5a1a' : '#2a6a2a') : '#2a2a22', size: lbl.length > 8 ? 8 : 12, disabled: !canStart })) startWave();
  if (button('spd', x0 + 182, 650, 60, 56, speed + 'x', { color: speed > 1 ? '#7a5a1a' : '#3a2a1e', size: 12, sfx: 'tab' })) toggleSpeed();
  if (G.wave === 0 && Math.sin(t * 5) > 0) { ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 3; ctx.strokeRect(x0 + 12, 648, 164, 60); }
}
let hoverBuild = null;
function statLines(id, lv, prevLv) {
  const T = TOWERS.find(t => t.id === id), L = T.lv[lv], g = k => L[k] !== undefined ? L[k] : T.lv[0][k];
  if (id === 'mine') return [`+${g('gold')} gold per wave`];
  const out = [`DMG ${g('dmg')}  SPD ${(1 / g('rate')).toFixed(1)}/s`, `RANGE ${g('range')}`];
  if (g('splash')) out.push(`SPLASH ${g('splash')}`);
  if (g('slow')) out.push(`SLOW ${Math.round(g('slow') * 100)}%`);
  if (g('chain')) out.push(`CHAINS ${g('chain')}`);
  if (g('burn')) out.push(`BURN ${g('burn')}/s`);
  out.push(T.air ? 'Hits flyers' : 'Ground only');
  return out.slice(0, 4);
}
function toggleSpeed() { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; Sound.play('tab'); }
function drawMapHUD() {
  // floating numbers
  floats.forEach(f => { ctx.globalAlpha = 1 - f.t / 0.9; text(f.text, f.x * S, (f.y + MY) * S, 12, f.col, 'center'); ctx.globalAlpha = 1; });
  // boss bar
  if (G.boss && !G.boss.dead) {
    const bw = 600, bx = (PX - bw) / 2, by = 18;
    text(G.boss.D.name, PX / 2, by, 12, '#ff6a6a', 'center');
    ctx.fillStyle = '#0a0610'; ctx.fillRect(bx - 4, by + 22, bw + 8, 22);
    ctx.fillStyle = '#3a0a14'; ctx.fillRect(bx, by + 26, bw, 14);
    ctx.fillStyle = '#e8303a'; ctx.fillRect(bx, by + 26, bw * clamp(G.boss.hp / G.boss.maxhp, 0, 1), 14);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(bx, by + 26, bw * clamp(G.boss.hp / G.boss.maxhp, 0, 1), 3);
  }
  if (button('pz', PX - 70, 10, 56, 40, 'II', { color: '#3a2a1e', size: 12, sfx: 'back' })) pause();
  if (G.wave === 0 && !placing && !selected) {
    const a = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.globalAlpha = a; text('1. Pick a tower on the right', PX / 2, 600, 12, '#ffe680', 'center'); text('2. Build it next to the road   3. Press START', PX / 2, 626, 12, '#ffe680', 'center'); ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------ screens
let menuDemo = null;
let runSaveCache = null, runSaveT = -1;
function drawMenu() {
  if (t - runSaveT > 1) { runSaveCache = loadRunSave(); runSaveT = t; }
  if (!menuDemo) { renderMap(MAPS[0]); menuDemo = { cv: mapCv, en: [] }; }
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.drawImage(menuDemo.cv, 0, MY);
  if (Math.random() < 0.02) menuDemo.en.push({ d: 0, type: pick(['skeleton', 'wolf', 'slime', 'knight']) });
  menuDemo.en.forEach(e => { e.d += ENEMIES[e.type].speed * 16 / 60; const p = posAt(e.d); const im = sprite(ENEMIES[e.type].sprite); lx.drawImage(im, Math.round(p.x - 7), Math.round(p.y - 12 + MY)); });
  menuDemo.en = menuDemo.en.filter(e => e.d < pathLen);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, MW * S * 1.25, (MH + 4) * S * 1.25 * 0.73);
  ctx.fillStyle = 'rgba(10,6,4,0.55)'; ctx.fillRect(0, 0, W, H);
  // title
  const t1 = 'NIGHTFALL', t2 = 'SIEGE';
  bigTitle(t1, W / 2, 30, 64, '#fff1c2', '#f59e0b');
  text(t2, W / 2, 104, 32, '#ff8a3a', 'center');
  text('defend the castle - a tower defense by Cnatt', W / 2, 150, 8, '#c8b8a0', 'center');
  // map cards
  MAPS.forEach((M, i) => {
    const cw = 224, x = 28 + i * (cw + 12), y = 186, ok = unlocked(i), st = save.stars[M.id] || 0;
    panel(x, y, cw, 360, ok ? '#5a4030' : '#2a2420', ok ? '#1e150e' : '#141210');
    if (!SPR['map_' + M.id]) { renderMap(M); SPR['map_' + M.id] = mapCv; }
    ctx.globalAlpha = ok ? 1 : 0.3; ctx.drawImage(SPR['map_' + M.id], x + 12, y + 12, cw - 24, (cw - 24) * MH / MW); ctx.globalAlpha = 1;
    text(M.name, x + cw / 2, y + 160, 8, ok ? THEMES[M.theme].accent : '#5a5048', 'center');
    for (let k = 0; k < 3; k++) { const sx = x + cw / 2 - 42 + k * 30; drawStar(sx, y + 182, k < st); }
    if (save.best[M.id]) text(`Endless best: ${save.best[M.id]}`, x + cw / 2, y + 220, 8, '#c46cff', 'center');
    if (ok) {
      const rs = runSaveCache && runSaveCache.mi === i ? runSaveCache : null;
      if (rs) {
        if (button('cont' + i, x + 20, y + 246, cw - 40, 48, `CONTINUE W${rs.wave + 1}`, { color: '#2a5a7a', size: 12 })) continueRun();
        if (button('new' + i, x + 20, y + 302, cw - 40, 40, rs.endless ? 'NEW ENDLESS' : 'NEW GAME', { color: '#5a3a1a', size: 8 })) newGame(i, rs.endless);
      } else {
        if (button('play' + i, x + 20, y + 246, cw - 40, 48, 'PLAY', { color: '#3a6a2a' })) newGame(i, false);
        if (st > 0 && button('endl' + i, x + 20, y + 302, cw - 40, 40, 'ENDLESS', { color: '#4a2a6a', size: 12 })) newGame(i, true);
      }
    } else text('Beat the last map', x + cw / 2, y + 266, 8, '#6a6058', 'center');
  });
  const avail = starsEarned() - starsSpent();
  if (button('perks', W / 2 - 220, 570, 210, 56, '', { color: '#5a3a1a', draw: (X, Y) => { drawStar(X + 30, Y + 12, true); text(`UPGRADES (${avail})`, X + 122, Y + 20, 8, '#ffffff', 'center'); } })) screen = 'perks';
  if (button('mus', W / 2 + 10, 570, 100, 56, Sound.musicOn ? 'MUSIC' : 'MUTED', { color: '#2a2420', size: 8 })) Sound.setMusic(!Sound.musicOn);
  if (button('sfx', W / 2 + 120, 570, 100, 56, Sound.sfxOn ? 'SFX' : 'NO SFX', { color: '#2a2420', size: 8 })) Sound.setSfx(!Sound.sfxOn);
  text('1-7 towers  U upgrade  S sell  T target  SPACE wave  Q meteor  W freeze  F speed', W / 2, 660, 8, '#8a7a6a', 'center');
}
function drawStar(x, y, on) {
  ctx.fillStyle = on ? '#ffcc33' : '#3a3028';
  ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 7 : 16, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(x + 12 + Math.cos(a) * r, y + 14 + Math.sin(a) * r); } ctx.fill();
  if (on) { ctx.fillStyle = '#fff3c4'; ctx.fillRect(x + 8, y + 6, 4, 4); }
}
function drawPerks() {
  drawMenu();
  ctx.fillStyle = 'rgba(10,6,4,0.85)'; ctx.fillRect(0, 0, W, H);
  const avail = starsEarned() - starsSpent();
  text('UPGRADES', W / 2, 40, 32, '#ffcc66', 'center');
  text(`Earn stars by beating maps. You have ${avail} to spend.`, W / 2, 90, 8, '#c8b8a0', 'center');
  PERKS.forEach((p, i) => {
    const x = 110 + (i % 2) * 540, y = 130 + Math.floor(i / 2) * 96, owned = save.perks[p.id];
    panel(x, y, 520, 84, owned ? '#6a5a2a' : '#4a3424', '#1a120c');
    text(p.name.toUpperCase(), x + 22, y + 20, 12, owned ? '#ffcc33' : '#ffffff');
    text(p.desc, x + 22, y + 46, 8, '#c8c0b0');
    if (owned) text('OWNED', x + 498, y + 32, 12, '#ffcc33', 'right');
    else if (button('pk' + p.id, x + 380, y + 18, 120, 48, '', { color: avail >= p.cost ? '#3a6a2a' : '#2a2420', disabled: avail < p.cost, sfx: 'buy', draw: (X, Y) => { drawStar(X + 16, Y + 8, true); text(String(p.cost), X + 76, Y + 16, 12, '#ffffff', 'center'); } })) { save.perks[p.id] = 1; store(); }
  });
  if (button('reset', 110, 640, 220, 48, 'REFUND ALL', { color: '#4a2a2a', size: 12 })) { save.perks = {}; store(); }
  if (button('back', W - 330, 640, 220, 48, 'BACK', { color: '#3a2a1e', size: 12, sfx: 'back' })) screen = 'menu';
}
function win() {
  clearRunSave();
  G.won = true;
  const stars = G.lives >= G.maxLives * 0.9 ? 3 : G.lives >= G.maxLives * 0.5 ? 2 : 1;
  G.stars = stars; const prev = save.stars[G.M.id] || 0;
  save.stars[G.M.id] = Math.max(prev, stars); store();
  screen = 'win'; endT = 0; Sound.playSong(SONGS.swin); Sound.play('catch', 4);
}
function lose() {
  clearRunSave();
  if (G.endless) { save.best[G.M.id] = Math.max(save.best[G.M.id] || 0, G.wave - 1); store(); }
  screen = 'lose'; endT = 0; Sound.playSong(SONGS.slose); SND.leak();
}
let endT = 0;
function drawEnd(won) {
  endT += 1 / 60;
  ctx.fillStyle = `rgba(10,6,4,${Math.min(0.8, endT)})`; ctx.fillRect(0, 0, W, H);
  if (endT < 0.5) return;
  panel(W / 2 - 330, 120, 660, 460, won ? '#8a6a2a' : '#6a2a2a', '#1a120c');
  text(won ? 'VICTORY!' : (G.endless ? 'THE CASTLE FELL' : 'DEFEAT'), W / 2, 160, 40, won ? '#ffcc66' : '#ff5a5a', 'center');
  text(won ? `${G.M.name} is safe` : `You reached wave ${G.wave}`, W / 2, 222, 12, '#e8e4d8', 'center');
  if (won) for (let k = 0; k < 3; k++) { const pop = clamp((endT - 0.6 - k * 0.3) * 4, 0, 1); ctx.save(); ctx.translate(W / 2 - 90 + k * 70 + 12, 290); ctx.scale(pop * 2, pop * 2); drawStar(-12, -14, k < G.stars); ctx.restore(); if (pop > 0 && pop < 0.1 && k < G.stars) Sound.play('coin'); }
  text(`Monsters slain: ${G.kills}`, W / 2, 360, 12, '#c8c0b0', 'center');
  text(`Lives left: ${G.lives}/${G.maxLives}`, W / 2, 388, 12, '#c8c0b0', 'center');
  if (won) {
    if (button('endless', W / 2 - 300, 470, 290, 64, 'KEEP GOING', { color: '#4a2a6a', size: 12 })) { G.endless = true; screen = 'play'; Sound.playSong(SONGS[G.M.song]); toast('ENDLESS MODE: how long can you last?', '#c46cff', 3); }
    if (button('menu', W / 2 + 10, 470, 290, 64, 'MAP SELECT', { color: '#3a6a2a', size: 12 })) goMenu();
  } else {
    if (button('retry', W / 2 - 300, 470, 290, 64, 'TRY AGAIN', { color: '#6a3a1a', size: 12 })) newGame(G.mi, G.endless);
    if (button('menu', W / 2 + 10, 470, 290, 64, 'MAP SELECT', { color: '#3a2a1e', size: 12, sfx: 'back' })) goMenu();
  }
}
function drawPause() {
  ctx.fillStyle = 'rgba(10,6,4,0.7)'; ctx.fillRect(0, 0, W, H);
  panel(W / 2 - 220, 180, 440, 360, '#5a4030', '#1a120c');
  text('PAUSED', W / 2, 216, 32, '#ffcc66', 'center');
  if (button('res', W / 2 - 160, 280, 320, 60, 'RESUME', { color: '#3a6a2a' })) resume();
  if (button('rst', W / 2 - 160, 356, 320, 50, 'RESTART MAP', { color: '#6a3a1a', size: 12 })) newGame(G.mi, G.endless);
  if (button('men', W / 2 - 160, 422, 320, 50, 'SAVE & QUIT', { color: '#2a4a6a', size: 12, sfx: 'back' })) goMenu();
  text('Saved after every wave', W / 2, 528, 8, '#8a7a6a', 'center');
  if (button('mus', W / 2 - 160, 486, 155, 36, Sound.musicOn ? 'MUSIC ON' : 'MUSIC OFF', { color: '#2a2420', size: 8 })) Sound.setMusic(!Sound.musicOn);
  if (button('sfx', W / 2 + 5, 486, 155, 36, Sound.sfxOn ? 'SFX ON' : 'SFX OFF', { color: '#2a2420', size: 8 })) Sound.setSfx(!Sound.sfxOn);
}
function pause() { screen = 'pause'; Sound.play('back'); }
function resume() { screen = 'play'; Sound.play('click'); }
function goMenu() { runSaveT = -9; screen = 'menu'; menuDemo = null; Sound.playSong(SONGS.smenu); }

// ------------------------------------------------------------ sounds
const SND = {
  bow: () => Sound.blip(900, 0.04, { type: 'triangle', vol: 0.05, slide: 400 }),
  cannon: () => { Sound.blip(110, 0.18, { type: 'square', vol: 0.12, slide: 50, lp: 800 }); Sound.hiss(0.15, { filter: 'lowpass', freq: 900, vol: 0.12 }); },
  boom: () => { Sound.hiss(0.35, { filter: 'lowpass', freq: 1000, sweep: 100, vol: 0.18 }); Sound.blip(80, 0.2, { type: 'sine', vol: 0.15, slide: 35 }); },
  frost: () => Sound.blip(1800, 0.08, { type: 'triangle', vol: 0.04, slide: 2600 }),
  zap: () => { Sound.hiss(0.1, { freq: 4000, vol: 0.1 }); Sound.blip(200, 0.08, { type: 'sawtooth', vol: 0.05, slide: 1200, lp: 3000 }); },
  flame: () => Sound.hiss(0.15, { filter: 'bandpass', freq: 600, q: 0.8, vol: 0.05 }),
  ballista: () => { Sound.blip(160, 0.12, { type: 'square', vol: 0.1, slide: 60 }); Sound.hiss(0.1, { freq: 3000, vol: 0.08 }); },
  die: big => { Sound.hiss(big ? 1 : 0.1, { filter: 'lowpass', freq: big ? 800 : 1800, sweep: 200, vol: big ? 0.4 : 0.05 }); if (!big) Sound.blip(1318 + Math.random() * 200, 0.03, { type: 'square', vol: 0.025 }); },
  leak: () => { Sound.blip(200, 0.3, { type: 'sawtooth', vol: 0.14, slide: 60, lp: 1500 }); Sound.blip(150, 0.4, { type: 'square', vol: 0.08, slide: 50, delay: 0.1 }); },
  build: () => { Sound.blip(220, 0.06, { type: 'square', vol: 0.1, slide: 330 }); Sound.hiss(0.15, { filter: 'lowpass', freq: 700, vol: 0.12 }); Sound.blip(660, 0.08, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
  upgrade: () => { [523, 659, 784, 1047].forEach((f, i) => Sound.blip(f, 0.07, { type: 'square', vol: 0.08, delay: i * 0.05 })); },
  sell: () => Sound.play('coin'),
  clear: () => { [523, 659, 784, 1047].forEach((f, i) => Sound.blip(f, 0.1, { type: 'triangle', vol: 0.12, delay: i * 0.08 })); },
  horn: () => { Sound.blip(196, 0.6, { type: 'sawtooth', vol: 0.09, lp: 1200, attack: 0.08 }); Sound.blip(294, 0.6, { type: 'sawtooth', vol: 0.06, lp: 1200, attack: 0.08, delay: 0.05 }); },
  roar: () => { Sound.blip(90, 0.8, { type: 'sawtooth', vol: 0.14, slide: 50, lp: 600 }); Sound.hiss(0.8, { filter: 'lowpass', freq: 500, vol: 0.25 }); },
  summon: () => Sound.blip(200, 0.4, { type: 'sine', vol: 0.1, slide: 800 }),
  blink: () => Sound.blip(1200, 0.15, { type: 'sine', vol: 0.12, slide: 200 }),
  freeze: () => { Sound.blip(2400, 0.6, { type: 'triangle', vol: 0.12, slide: 300 }); Sound.hiss(0.6, { freq: 7000, vol: 0.15 }); },
  whoosh: () => Sound.hiss(0.7, { filter: 'bandpass', freq: 3000, sweep: 300, q: 1, vol: 0.2 }),
};

// ------------------------------------------------------------ main loop
let last = 0;
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += rdt;
  UI.hover = null; hoverBuild = null;
  ctx.imageSmoothingEnabled = false;
  if (screen === 'menu') { drawMenu(); }
  else if (screen === 'perks') { drawPerks(); }
  else if (G) {
    // input on the map
    const mx = mouse.x / S, my = mouse.y / S - MY;
    hoverTile = mouse.x < PX && my >= 0 && my < MH ? { c: Math.floor(mx / TS), r: Math.floor(my / TS) } : null;
    if (screen === 'play') {
      const steps = speed;
      for (let k = 0; k < steps; k++) update(rdt);
      updateFx(rdt * speed);
    } else updateFx(rdt * 0.3);
    shake = Math.max(0, shake - rdt * 2); flashRed = Math.max(0, flashRed - rdt); flashIce = Math.max(0, flashIce - rdt); flashWhite = Math.max(0, flashWhite - rdt);
    drawWorld();
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, PX, H);
    ctx.drawImage(lo, 0, 0, MW * S, (MH + 4) * S);
    if (flashRed > 0) { ctx.fillStyle = `rgba(255,30,40,${flashRed * 0.35})`; ctx.fillRect(0, 0, PX, H); }
    if (flashWhite > 0) { ctx.fillStyle = `rgba(255,255,255,${flashWhite * 0.6})`; ctx.fillRect(0, 0, PX, H); }
    drawMapHUD();
    drawPanel();
    // banner
    if (banner) {
      banner.t += rdt;
      const a = banner.t < 0.4 ? banner.t / 0.4 : banner.t > (banner.small ? 1.6 : 2.6) ? Math.max(0, 1 - (banner.t - (banner.small ? 1.6 : 2.6)) / 0.5) : 1;
      if (a <= 0) banner = null;
      else { ctx.globalAlpha = a; ctx.fillStyle = 'rgba(10,6,4,0.6)'; ctx.fillRect(0, 280, PX, banner.small ? 70 : 120); ctx.fillStyle = banner.col; ctx.fillRect(0, 280, PX, 3); text(banner.title, PX / 2, 300, banner.small ? 24 : 32, banner.col, 'center'); if (banner.sub) text(banner.sub, PX / 2, 352, 12, '#e8e4d8', 'center'); ctx.globalAlpha = 1; }
    }
    // clicks on the map
    if (screen === 'play' && UI.click && UI.click.x < PX) {
      const c = UI.click; UI.click = null;
      if (hoverTile) {
        if (targeting === 'meteor') dropMeteor(mx, my);
        else if (placing) place(hoverTile.c, hoverTile.r);
        else { const tw = towers.find(x => x.c === hoverTile.c && x.r === hoverTile.r); selected = tw || null; if (tw) Sound.play('tab'); }
      }
    }
    if (UI.rclick) { placing = null; targeting = null; selected = null; }
    if (screen === 'pause') drawPause();
    if (screen === 'win') drawEnd(true);
    if (screen === 'lose') drawEnd(false);
  }
  // toasts
  toastQ.forEach((m, i) => {
    m.t += rdt; const a = m.t < 0.2 ? m.t / 0.2 : m.t > m.dur - 0.4 ? Math.max(0, (m.dur - m.t) / 0.4) : 1;
    ctx.globalAlpha = a; ctx.font = fontOf(12); const tw = ctx.measureText(m.s).width + 40, y = 70 + i * 42, cx = screen === 'play' ? PX / 2 : W / 2;
    ctx.fillStyle = 'rgba(10,6,4,0.85)'; ctx.fillRect(cx - tw / 2, y, tw, 32); ctx.fillStyle = m.col; ctx.fillRect(cx - tw / 2, y, 4, 32);
    text(m.s, cx, y + 10, 12, m.col, 'center'); ctx.globalAlpha = 1;
  });
  toastQ = toastQ.filter(m => m.t < m.dur);
  if (UI.hover && UI.hover !== UI.lastHover) Sound.play('hover');
  UI.lastHover = UI.hover; UI.click = null; UI.rclick = false;
  requestAnimationFrame(frame);
}

const fontReady = document.fonts ? Promise.race([Promise.all([document.fonts.load(fontOf(16)), document.fonts.load(fontOf(30))]), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontReady.then(() => { screen = 'menu'; Sound.playSong(SONGS.smenu); requestAnimationFrame(n => { last = n; frame(n); }); });

window.__sg = { get G() { return G; }, get screen() { return screen; }, get towers() { return towers; }, get enemies() { return enemies; }, newGame, sell, cast: castSpell, meteor(x, y) { dropMeteor(x, y); }, place(id, c, r) { placing = id; place(c, r); placing = null; }, startWave, upgrade, isPath: (c, r) => isPath(c, r), tileFree: (c, r) => tileFree(c, r), sim(dt, n) { for (let k = 0; k < n && screen === 'play'; k++) { update(dt); updateFx(dt); } return screen; }, save: () => save, setScreen(s) { screen = s; }, get pathLen() { return pathLen; } };

// ------------------------------------------------------------ owner cheats (only shown for the site admin, see account/cheats.js)
const inMap = () => G && (screen === 'play' || screen === 'pause') ? '' : 'Start a map first';
window.__cheats = [
  { name: '+1,000 gold', icon: '💰', need: inMap, run() { G.gold += 1000; } },
  { name: '+20 lives', icon: '❤', need: inMap, run() { G.lives += 20; G.maxLives = Math.max(G.maxLives, G.lives); } },
  { name: 'Destroy every enemy', icon: '💥', need: inMap, run() { enemies.slice().forEach(e => hurt(e, 1e9)); } },
  { name: '3 stars on every map', icon: '⭐', run() { MAPS.forEach(m => save.stars[m.id] = 3); store(); } },
  { name: '+10,000 gold', icon: '🏦', need: inMap, run() { G.gold += 10000; } },
  { name: 'Send the next wave now', icon: '⏭', need: inMap, run() { if (!G.active) startWave(); } },
];

})();
