// =====================================================================
//  SNAKE ARENA - io-style snake battle. Eat glowing food, grow huge, make
//  other snakes crash into you. Bots fill the arena; play online with
//  friends (host runs the world, guests send their steering).
// =====================================================================
'use strict';
(() => {
const cv = document.getElementById('game');
const U = GameUI(cv), ctx = U.ctx, W = 1280, H = 720;
const { rr, rgba, shade } = U;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const pick = a => a[Math.floor(Math.random() * a.length)];

const R = 2300;                 // arena radius
const FOOD_N = 1100, BOT_N = 16;
const SKINS = [['#22d3ee', '#0e7490'], ['#a78bfa', '#5b21b6'], ['#f472b6', '#9d174d'], ['#facc15', '#a16207'], ['#4ade80', '#166534'], ['#fb923c', '#9a3412'], ['#60a5fa', '#1e3a8a'], ['#f87171', '#991b1b'], ['#e5e7eb', '#4b5563'], ['#2dd4bf', '#115e59']];
const FOOD_COLS = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#60a5fa', '#f87171'];
const BOT_NAMES = ['noodle', 'zigzag', 'Slinky', 'viper_x', 'Mamba', 'wormy', 'SNEK', 'kaa', 'Hissy', 'Ouroboros', 'spaghetti', 'Basilisk', 'curly', 'Nagini', 'twisty', 'Sir Hiss', 'pretzel', 'Medusa', 'rattle', 'ribbon'];

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_snake';
let save = { best: 0, kills: 0, games: 0, skin: 0, name: '' };
// shop skins (Arcade cosmetics) live after the 10 free ones, in a fixed order so online players agree
const BASE_SKINS = SKINS.length, SHOP_SKINS = window.Arcade ? Arcade.CATALOG.filter(i => i.game === 'snake') : [];
SHOP_SKINS.forEach(i => SKINS.push([i.c1, i.c2]));
const mySkin = () => { const it = window.Arcade && Arcade.equipped('snake', 'skin'); const k = it ? SHOP_SKINS.indexOf(SHOP_SKINS.find(x => x.id === it.id)) : -1; return k >= 0 ? BASE_SKINS + k : save.skin; };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(save, s); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const myName = () => (window.Account && Account.user && Account.user.username) || save.name || 'You';
const OWN = () => !!(window.Account && Account.isOwnerMe && Account.isOwnerMe());

SONGS.snake = { seed: 909, bpm: 100, root: 55, scale: 'minor', prog: [0, 5, 3, 4, 0, 5, 6, 4], density: 0.5, swing: 0.08,
  bass: 'x..x....x..x..o.', kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x.x.x...x.', pad: true, arp: true, arpRate: 2, arpOct: 1, introNoLead: true };
const sfx = {
  eat(n) { if (Math.random() < 0.35) Sound.blip(700 + Math.random() * 500, 0.04, { type: 'sine', vol: 0.05 + Math.min(0.1, n * 0.01) }); },
  die() { Sound.hiss(0.6, { filter: 'lowpass', freq: 1500, sweep: 100, vol: 0.35 }); Sound.blip(220, 0.5, { type: 'sine', vol: 0.3, slide: 55 }); },
  kill() { [523, 784, 1047].forEach((f, i) => Sound.blip(f, 0.12, { type: 'sine', vol: 0.15, delay: i * 0.06 })); },
  boost() { Sound.hiss(0.08, { filter: 'bandpass', freq: 600, q: 1, vol: 0.04 }); },
};

// ------------------------------------------------------------ world
let snakes = [], food = [], foodId = 1, screen = 'title', t = 0, me = null, cam = { x: 0, y: 0, z: 1 }, deadInfo = null;
let mode = 'solo';   // solo | online
const spacing = 7;
function lenOf(m) { return 60 + m * 5; }
function radOf(m) { return Math.min(30, 9 + Math.sqrt(m) * 0.95); }
function makeSnake(o) {
  const a = rand(0, Math.PI * 2), d = rand(0, R * 0.75);
  const s = Object.assign({ id: Math.random().toString(36).slice(2, 8), x: Math.cos(a) * d, y: Math.sin(a) * d, a: rand(0, 6.28), mass: 12, boost: false, alive: true,
    skin: Math.floor(Math.random() * SKINS.length), name: pick(BOT_NAMES.filter(n => !snakes.some(o => o.alive && o.name === n)).concat(['worm'])), bot: true, kills: 0, want: 0, ai: { t: 0, target: null }, born: t }, o || {});
  s.path = []; for (let i = 0; i < lenOf(s.mass) / spacing; i++) s.path.push({ x: s.x - Math.cos(s.a) * i * spacing, y: s.y - Math.sin(s.a) * i * spacing });
  s.want = s.a;
  return s;
}
function addFood(x, y, v, col) {
  if (x == null) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * (R - 40); x = Math.cos(a) * d; y = Math.sin(a) * d; }
  const f = { id: foodId++, x, y, v: v || rand(0.6, 1.6), c: col || pick(FOOD_COLS), p: rand(0, 6.28) };
  food.push(f); if (NET.role === 'host') NET.foodAdd.push([f.id, Math.round(f.x), Math.round(f.y), Math.round(f.v * 10) / 10, f.c]);
  return f;
}
function resetWorld() {
  snakes = []; food = []; foodId = 1;
  for (let i = 0; i < FOOD_N; i++) addFood();
  for (let i = 0; i < BOT_N; i++) { const b = makeSnake({ mass: rand(8, 60) }); snakes.push(b); }
}
function spawnPlayer(o) {
  const s = makeSnake(Object.assign({ bot: false, name: myName(), skin: mySkin(), mass: 12, own: OWN() }, o));
  // spawn away from big snakes
  for (let k = 0; k < 20; k++) { if (!snakes.some(o2 => o2.alive && Math.hypot(o2.x - s.x, o2.y - s.y) < 400)) break; const a = rand(0, 6.28), d = rand(0, R * 0.7); s.x = Math.cos(a) * d; s.y = Math.sin(a) * d; s.path = s.path.map((p, i) => ({ x: s.x - Math.cos(s.a) * i * spacing, y: s.y - Math.sin(s.a) * i * spacing })); }
  snakes.push(s); return s;
}

// ------------------------------------------------------------ grid of body points for collisions
const CELL = 90;
let grid = new Map();
function buildGrid() {
  grid.clear();
  snakes.forEach(s => {
    if (!s.alive) return;
    const r = radOf(s.mass), stepN = Math.max(1, Math.floor(r / spacing));
    for (let i = 3; i < s.path.length; i += stepN) {
      const p = s.path[i], k = Math.floor(p.x / CELL) + ',' + Math.floor(p.y / CELL);
      let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(s, p.x, p.y, r);
    }
  });
}
function hitBody(x, y, r, self) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = grid.get((cx + i) + ',' + (cy + j)); if (!c) continue;
    for (let k = 0; k < c.length; k += 4) { if (c[k] === self) continue; const dx = c[k + 1] - x, dy = c[k + 2] - y, m = c[k + 3] + r * 0.6; if (dx * dx + dy * dy < m * m) return c[k]; }
  }
  return null;
}

// ------------------------------------------------------------ simulation
function killSnake(s, killer) {
  s.alive = false; s.diedAt = t;
  if (s === me && window.Arcade) Arcade.event('snake', 'death', { len: Math.round(s.mass), kills: s.kills });
  // body turns into food
  const n = Math.min(160, Math.floor(s.mass * 0.9));
  for (let i = 0; i < n; i++) { const p = s.path[Math.floor(i / n * s.path.length)]; if (p) addFood(p.x + rand(-10, 10), p.y + rand(-10, 10), rand(1.2, 2.6), SKINS[s.skin][0]); }
  if (killer) { killer.kills++; if (killer === me) { sfx.kill(); save.kills++; store(); popups.push({ text: `You ate ${s.name}!`, t: 0 }); } }
  if (s === me) { sfx.die(); deadInfo = { len: Math.floor(s.mass), kills: s.kills, by: killer ? killer.name : 'the wall', rank: rankOf(s) }; if (Math.floor(s.mass) > save.best) save.best = Math.floor(s.mass); save.games++; store(); }
  if (NET.role === 'host') NET.deaths.push([s.id, killer ? killer.id : null]);
}
function rankOf(s) { return snakes.filter(o => o.alive || o === s).sort((a, b) => b.mass - a.mass).indexOf(s) + 1; }
function updateSnake(s, dt) {
  const r = radOf(s.mass);
  const turn = 4.2 / (1 + s.mass / 220);
  s.a += clamp(angDiff(s.a, s.want), -turn * dt, turn * dt);
  const boosting = s.boost && s.mass > 10;
  const sp = boosting ? 380 : 200;
  s.x += Math.cos(s.a) * sp * dt; s.y += Math.sin(s.a) * sp * dt;
  if (boosting) { s.mass -= 3.2 * dt; if (Math.random() < dt * 6) { const tail = s.path[s.path.length - 1]; addFood(tail.x, tail.y, 0.8, SKINS[s.skin][0]); } if (s === me && Math.random() < dt * 6) sfx.boost(); }
  // path follows the head
  const h = s.path[0], dx = s.x - h.x, dy = s.y - h.y, d = Math.hypot(dx, dy);
  if (d >= spacing) { const n = Math.floor(d / spacing); for (let i = 1; i <= n; i++) s.path.unshift({ x: h.x + dx * i * spacing / d, y: h.y + dy * i * spacing / d }); }
  const maxN = Math.ceil(lenOf(s.mass) / spacing); while (s.path.length > maxN) s.path.pop();
  // walls
  if (Math.hypot(s.x, s.y) > R - r * 0.5) return killSnake(s, null);
  // eat
  const eatR = r + 14 + (s.mass > 80 ? 8 : 0);
  let ate = 0;
  for (let i = food.length - 1; i >= 0; i--) {
    const f = food[i], fx = f.x - s.x, fy = f.y - s.y;
    if (fx * fx + fy * fy < eatR * eatR) { s.mass += f.v; ate++; if (NET.role === 'host') NET.foodDel.push(f.id); food.splice(i, 1); }
    else if (fx * fx + fy * fy < (eatR + 40) * (eatR + 40)) { f.x -= fx * dt * 4; f.y -= fy * dt * 4; }   // suck in nearby food
  }
  if (ate && s === me) sfx.eat(ate);
  // crash into another snake?
  const hit = hitBody(s.x + Math.cos(s.a) * r * 0.6, s.y + Math.sin(s.a) * r * 0.6, r, s);
  if (hit) killSnake(s, hit);
}
function botThink(s, dt) {
  s.ai.t -= dt;
  const r = radOf(s.mass);
  // danger probes ahead (left / straight / right)
  const danger = a => { let d = 0; for (const dist of [40, 80, 130, 190]) { const x = s.x + Math.cos(a) * (dist + r), y = s.y + Math.sin(a) * (dist + r); if (Math.hypot(x, y) > R - 60) d += 3; if (hitBody(x, y, r, s)) d += 4 - dist / 60; } return d; };
  const dS = danger(s.a);
  if (dS > 0) {
    const dl = danger(s.a - 0.8), drr = danger(s.a + 0.8);
    s.want = s.a + (dl < drr ? -1.3 : 1.3); s.boost = dS > 3 && s.mass > 30 && Math.random() < 0.3; return;
  }
  if (s.ai.t <= 0) {
    s.ai.t = rand(0.25, 0.6);
    s.boost = false;
    // hunt smaller snakes nearby sometimes
    const prey = snakes.find(o => o.alive && o !== s && o.mass < s.mass * 0.7 && Math.hypot(o.x - s.x, o.y - s.y) < 420);
    if (prey && s.mass > 40 && Math.random() < 0.5) {
      const lead = 120; s.ai.target = { x: prey.x + Math.cos(prey.a) * lead, y: prey.y + Math.sin(prey.a) * lead }; s.boost = s.mass > 60 && Math.random() < 0.5;
    } else {
      // best food nearby
      let best = null, bs = -1;
      for (let i = 0; i < food.length; i += 2) { const f = food[i], d = Math.hypot(f.x - s.x, f.y - s.y); if (d > 480) continue; const sc = f.v * 120 / (d + 40); if (sc > bs) { bs = sc; best = f; } }
      s.ai.target = best ? { x: best.x, y: best.y } : { x: rand(-R, R) * 0.5, y: rand(-R, R) * 0.5 };
    }
  }
  if (s.ai.target) s.want = Math.atan2(s.ai.target.y - s.y, s.ai.target.x - s.x);
  if (Math.hypot(s.x, s.y) > R - 300) s.want = Math.atan2(-s.y, -s.x);
}
let popups = [];
function step(dt) {
  buildGrid();
  snakes.forEach(s => { if (!s.alive) return; if (s.bot) botThink(s, dt); updateSnake(s, dt); });
  // respawn bots, keep food topped up
  snakes = snakes.filter(s => s.alive || !s.bot || t - s.diedAt < 0.1);
  snakes.filter(s => !s.alive && !s.bot && t - s.diedAt > 60).forEach(s => { s.gone = true; });
  snakes = snakes.filter(s => !s.gone);
  const bots = snakes.filter(s => s.bot && s.alive).length;
  if (bots < BOT_N && Math.random() < dt * 2) { const b = makeSnake({ mass: rand(8, 40) }); if (!snakes.some(o => o.alive && Math.hypot(o.x - b.x, o.y - b.y) < 300)) snakes.push(b); }
  while (food.length < FOOD_N) addFood();
}

// ------------------------------------------------------------ input
let pointerAim = true;
function playerInput() {
  if (!me || !me.alive) return null;
  let want = me.want, boost = U.down || U.keys.Space || U.keys.ShiftLeft || U.keys.ShiftRight;
  const k = U.keys, kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), ky = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
  if (kx || ky) { pointerAim = false; want = Math.atan2(ky, kx); }
  if (U.mx !== U.lastMx || U.my !== U.lastMy) pointerAim = true;
  U.lastMx = U.mx; U.lastMy = U.my;
  if (pointerAim && U.mx >= 0) { const sx = W / 2 + (me.x - cam.x) * cam.z, sy = H / 2 + (me.y - cam.y) * cam.z; want = Math.atan2(U.my - sy, U.mx - sx); }
  return { want, boost: !!boost };
}

// ------------------------------------------------------------ drawing
const spriteCache = {};
function ballSprite(col, dark) {
  const k = col + dark; if (spriteCache[k]) return spriteCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 22, 3, 32, 32, 31); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.55, col); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.stroke();
  return spriteCache[k] = c;
}
function glowSprite(col) {
  const k = 'g' + col; if (spriteCache[k]) return spriteCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(0.5, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return spriteCache[k] = c;
}
let bgTile = null;
function drawBackground() {
  if (!bgTile) {
    bgTile = document.createElement('canvas'); bgTile.width = 120; bgTile.height = 104; const g = bgTile.getContext('2d');
    g.fillStyle = '#0d1018'; g.fillRect(0, 0, 120, 104);
    g.strokeStyle = 'rgba(255,255,255,0.045)'; g.lineWidth = 2;
    const hex = (cx, cy) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34); } g.closePath(); g.stroke(); };
    hex(30, 52); hex(90, 0); hex(90, 104); hex(-30, 0); hex(-30, 104); hex(150, 52);
  }
  ctx.fillStyle = '#07080c'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  // arena disc with hex pattern
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.save(); ctx.clip();
  const pat = ctx.createPattern(bgTile, 'repeat'); ctx.fillStyle = pat;
  const vw = W / cam.z, vh = H / cam.z; ctx.fillRect(cam.x - vw / 2 - 120, cam.y - vh / 2 - 120, vw + 240, vh + 240);
  const vg = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(239,68,68,0.12)'); ctx.fillStyle = vg; ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  ctx.lineWidth = 10 / cam.z + 6; ctx.strokeStyle = 'rgba(239,68,68,0.55)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
  ctx.restore();
}
function inView(x, y, m) { const vx = (x - cam.x) * cam.z, vy = (y - cam.y) * cam.z; return vx > -W / 2 - m && vx < W / 2 + m && vy > -H / 2 - m && vy < H / 2 + m; }
function drawFood() {
  ctx.globalCompositeOperation = 'lighter';
  for (const f of food) {
    if (!inView(f.x, f.y, 30)) continue;
    const s = (6 + f.v * 5) * (1 + 0.15 * Math.sin(t * 3 + f.p));
    ctx.drawImage(glowSprite(f.c), f.x - s, f.y - s, s * 2, s * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawSnake(s) {
  const r = radOf(s.mass), [c1, c2] = SKINS[s.skin % SKINS.length], spr = ballSprite(c1, c2), spr2 = ballSprite(shade(c1, -0.18), shade(c2, -0.25));
  const P = s.path, stepN = Math.max(1, Math.round(r * 0.45 / spacing));
  if (!inView(s.x, s.y, 900 * cam.z)) return;
  if (s.boost && s.mass > 10) { ctx.globalCompositeOperation = 'lighter'; for (let i = P.length - 1; i >= 0; i -= stepN * 2) { const p = P[i]; ctx.globalAlpha = 0.35; ctx.drawImage(glowSprite(c1), p.x - r * 2, p.y - r * 2, r * 4, r * 4); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = P.length - 1; i >= 0; i -= stepN * 3) { const p = P[i]; ctx.beginPath(); ctx.arc(p.x + 4, p.y + 6, r, 0, 7); ctx.fill(); }
  for (let i = P.length - 1; i >= 0; i -= stepN) {
    const p = P[i]; if (!inView(p.x, p.y, r * cam.z + 10)) continue;
    const taper = i > P.length - 8 ? 0.6 + 0.4 * (P.length - i) / 8 : 1;
    const band = Math.floor(i / (stepN * 4)) % 2;
    ctx.drawImage(band ? spr2 : spr, p.x - r * taper, p.y - r * taper, r * 2 * taper, r * 2 * taper);
  }
  // head
  ctx.drawImage(spr, s.x - r * 1.08, s.y - r * 1.08, r * 2.16, r * 2.16);
  const ex = Math.cos(s.a), ey = Math.sin(s.a), px = -ey, py = ex;
  [-1, 1].forEach(side => {
    const x = s.x + ex * r * 0.35 + px * side * r * 0.45, y = s.y + ey * r * 0.35 + py * side * r * 0.45;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.34, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(x + Math.cos(s.want) * r * 0.12, y + Math.sin(s.want) * r * 0.12, r * 0.18, 0, 7); ctx.fill();
  });
  if (SHOP_SKINS[s.skin - BASE_SKINS] && SHOP_SKINS[s.skin - BASE_SKINS].fx === 'crown') {
    const cx2 = s.x - ex * r * 0.2, cy2 = s.y - ey * r * 0.2 - r * 0.9, w = r * 1.1;
    ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#92400e'; ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath(); ctx.moveTo(cx2 - w / 2, cy2); ctx.lineTo(cx2 - w / 2, cy2 - r * 0.5); ctx.lineTo(cx2 - w / 4, cy2 - r * 0.22); ctx.lineTo(cx2, cy2 - r * 0.62); ctx.lineTo(cx2 + w / 4, cy2 - r * 0.22); ctx.lineTo(cx2 + w / 2, cy2 - r * 0.5); ctx.lineTo(cx2 + w / 2, cy2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (s.mass > 30 || s !== me) {
    const nm = s.name; ctx.font = `700 ${clamp(12 / cam.z, 12, 28)}px ${U.FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(nm, s.x + 1, s.y - r - 8 + 1); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(nm, s.x, s.y - r - 8);
    if (s.own && window.Account && (mode !== 'online' || Account.ownerOK(s.name, s.own))) Account.drawOwnerTag(ctx, s.x, s.y - r - 34 / Math.max(0.6, cam.z), 18 / Math.max(0.6, cam.z), 'center');
  }
}
function drawWorld() {
  drawBackground();
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  drawFood();
  snakes.filter(s => s.alive).sort((a, b) => a.mass - b.mass).forEach(drawSnake);
  ctx.restore();
}
function drawHUD(dt) {
  // leaderboard
  const top = snakes.filter(s => s.alive).sort((a, b) => b.mass - a.mass).slice(0, 10);
  U.panel(W - 250, 16, 234, 46 + top.length * 24, { r: 14 });
  U.txt('LEADERBOARD', W - 233, 30, 12, '#94a3b8', 'left', { shadow: false });
  top.forEach((s, i) => {
    const y = 54 + i * 24, mine = s === me;
    U.txt(`${i + 1}. ${s.name}`, W - 233, y, 14, mine ? '#fde047' : '#e5e7eb', 'left', { weight: mine ? 800 : 600, shadow: false });
    U.txt(String(Math.floor(s.mass)), W - 30, y, 14, mine ? '#fde047' : '#94a3b8', 'right', { weight: 700, shadow: false });
  });
  // my stats
  if (me && me.alive) {
    U.panel(16, H - 86, 250, 70, { r: 14 });
    U.txt(`Length ${Math.floor(me.mass)}`, 32, H - 74, 20, '#ffffff', 'left', { weight: 800, shadow: false });
    U.txt(`Rank ${rankOf(me)} of ${snakes.filter(s => s.alive).length}  ·  ${me.kills} eaten`, 32, H - 44, 13, '#94a3b8', 'left', { shadow: false });
  }
  // minimap
  const mx = W - 96, my = H - 96, mr = 76;
  ctx.fillStyle = 'rgba(14,15,22,0.8)'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(239,68,68,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  snakes.forEach(s => { if (!s.alive) return; ctx.fillStyle = s === me ? '#fde047' : s.bot ? 'rgba(255,255,255,0.35)' : SKINS[s.skin][0]; ctx.beginPath(); ctx.arc(mx + s.x / R * mr, my + s.y / R * mr, s === me ? 4 : 1.5 + radOf(s.mass) / 14, 0, 7); ctx.fill(); });
  popups.forEach(p => { p.t += dt; ctx.globalAlpha = Math.max(0, 1 - p.t / 2); U.txt(p.text, W / 2, 120 - p.t * 10, 24, '#fde047', 'center', { weight: 800 }); ctx.globalAlpha = 1; });
  popups = popups.filter(p => p.t < 2);
  if (mode === 'online') { const st = NetTransport.status; U.txt(`${NET.role === 'host' ? 'Hosting ' + NET.code : 'Online'}${st.ping ? ' · ' + st.ping + ' ms' : ''}${st.mode === 'relay' ? ' · relay' : ''}`, 20, 20, 13, '#4ade80', 'left', { weight: 700 }); }
}
function updateCamera(dt) {
  const target = me && me.alive ? me : null;
  if (target) { cam.x += (target.x - cam.x) * Math.min(1, dt * 8); cam.y += (target.y - cam.y) * Math.min(1, dt * 8); }
  else { cam.x += Math.cos(t * 0.1) * 30 * dt; cam.y += Math.sin(t * 0.13) * 30 * dt; }
  const z = target ? clamp(1.1 - radOf(target.mass) / 60, 0.55, 1) : 0.7;
  cam.z += (z - cam.z) * Math.min(1, dt * 2);
}

// ------------------------------------------------------------ online
const NET = { role: null, code: '', screen: 'menu', error: '', input: { value: '', max: 6, upper: true, allow: /[a-zA-Z0-9]/ }, players: new Map(), foodAdd: [], foodDel: [], deaths: [] };
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const netSend = m => NET.tr && NET.tr.broadcast(m);
function netReset() { NetTransport.announce('snake', null); if (NET.tr) try { NET.tr.close(); } catch (e) {} NET.tr = null; NET.role = null; NET.players.clear(); }
function netLost(why) { netReset(); NET.error = why; NET.screen = 'menu'; screen = 'online'; mode = 'solo'; me = null; }
function hostRoom() {
  netReset(); NET.error = ''; NET.role = 'host'; NET.screen = 'connecting'; mode = 'online';
  NET.code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  NET.tr = NetTransport.host(NET.code, {
    ready: () => { NetTransport.announce('snake', NET.code); NET.screen = 'ready'; resetWorld(); me = spawnPlayer(); deadInfo = null; screen = 'play'; Sound.playSong(SONGS.snake); },
    join: id => { if (NET.players.size >= 7) { NET.tr.send(id, { t: 'full' }); return; } NET.players.set(id, { snake: null }); },
    leave: id => { const p = NET.players.get(id); if (p && p.snake && p.snake.alive) killSnake(p.snake, null); NET.players.delete(id); },
    msg: (id, d) => {
      const p = NET.players.get(id); if (!p) return;
      if (d.t === 'hello' || d.t === 'respawn') {
        if (p.snake && p.snake.alive) return;
        p.snake = spawnPlayer({ name: String(d.name || 'guest').slice(0, 16), skin: (d.skin | 0) % SKINS.length, own: !!d.own });
        NET.tr.send(id, { t: 'you', id: p.snake.id, food: food.map(f => [f.id, Math.round(f.x), Math.round(f.y), Math.round(f.v * 10) / 10, f.c]) });
      } else if (d.t === 'in' && p.snake) { p.snake.want = +d.w || 0; p.snake.boost = !!d.b; }
    },
    error: e => netLost(e === 'taken' ? 'Room code clash, try again.' : String(e)),
  });
}
function joinRoom(code) {
  netReset(); NET.error = ''; NET.role = 'client'; NET.code = code.toUpperCase(); NET.screen = 'connecting'; screen = 'online'; mode = 'online';
  NET.tr = NetTransport.join(NET.code, {
    ready: () => { NetTransport.announce('snake', NET.code); netSend({ t: 'hello', name: myName(), skin: mySkin(), own: OWN() }); },
    leave: () => netLost('Lost connection to the host.'),
    msg: (id, d) => {
      if (d.t === 'you') { NET.myId = d.id; food = d.food.map(f => ({ id: f[0], x: f[1], y: f[2], v: f[3], c: f[4], p: rand(0, 6) })); snakes = []; me = null; deadInfo = null; screen = 'play'; Sound.playSong(SONGS.snake); }
      else if (d.t === 'S') applySnap(d);
      else if (d.t === 'F') { const del = new Set(d.d); if (del.size) food = food.filter(f => !del.has(f.id)); d.a.forEach(f => food.push({ id: f[0], x: f[1], y: f[2], v: f[3], c: f[4], p: rand(0, 6) })); (d.k || []).forEach(([sid, kid]) => { const s = snakes.find(x => x.id === sid); if (s && s.alive) { s.alive = false; if (s === me) { sfx.die(); deadInfo = { len: Math.floor(s.mass), kills: s.kills, by: (snakes.find(x => x.id === kid) || { name: 'the wall' }).name, rank: rankOf(s) }; if (deadInfo.len > save.best) { save.best = deadInfo.len; store(); } } if (kid === NET.myId) { sfx.kill(); popups.push({ text: `You ate ${s.name}!`, t: 0 }); } } }); }
      else if (d.t === 'closed' || d.t === 'bye') netLost('The host left.');
      else if (d.t === 'full') netLost('That arena is full.');
    },
    error: e => netLost(String(e)),
  });
}
let sendT = 0, inT = 0;
function hostSend(dt) {
  sendT += dt; if (sendT < 1 / 15) return; sendT = 0;
  const Rn = v => Math.round(v);
  netSend({ t: 'S', s: snakes.filter(s => s.alive).map(s => [s.id, Rn(s.x), Rn(s.y), Math.round(s.a * 100) / 100, Math.round(s.mass * 10) / 10, s.boost ? 1 : 0, s.skin, s.name, s.kills, s.own ? 1 : 0, Math.round(s.want * 100) / 100]) });
  if (NET.foodAdd.length || NET.foodDel.length || NET.deaths.length) { netSend({ t: 'F', a: NET.foodAdd.splice(0), d: NET.foodDel.splice(0), k: NET.deaths.splice(0) }); }
}
function applySnap(d) {
  const seen = new Set();
  d.s.forEach(a => {
    seen.add(a[0]);
    let s = snakes.find(x => x.id === a[0]);
    if (!s) { s = makeSnake({ id: a[0], x: a[1], y: a[2], a: a[3], mass: a[4], skin: a[6], name: a[7], bot: false }); s.path = []; for (let i = 0; i < lenOf(a[4]) / spacing; i++) s.path.push({ x: a[1] - Math.cos(a[3]) * i * spacing, y: a[2] - Math.sin(a[3]) * i * spacing }); snakes.push(s); if (a[0] === NET.myId) me = s; }
    s.tx = a[1]; s.ty = a[2]; s.ta = a[3]; s.mass = a[4]; s.boost = !!a[5]; s.kills = a[8]; s.own = !!a[9]; s.remoteWant = a[10]; s.alive = true;
  });
  snakes = snakes.filter(s => seen.has(s.id) || (s === me));
  if (me && !seen.has(me.id) && me.alive) me.alive = false;
}
function clientFrame(dt) {
  snakes.forEach(s => {
    if (!s.alive || s.tx == null) return;
    const sp = s.boost ? 380 : 200;
    s.tx += Math.cos(s.ta) * sp * dt; s.ty += Math.sin(s.ta) * sp * dt;
    const k = Math.min(1, dt * 10); s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; s.a += angDiff(s.a, s.ta) * k;
    if (s !== me) s.want = s.remoteWant != null ? s.remoteWant : s.a;
    const h = s.path[0] || { x: s.x, y: s.y }, dx = s.x - h.x, dy = s.y - h.y, dd = Math.hypot(dx, dy);
    if (dd >= spacing) { const n = Math.floor(dd / spacing); for (let i = 1; i <= n; i++) s.path.unshift({ x: h.x + dx * i * spacing / dd, y: h.y + dy * i * spacing / dd }); }
    const maxN = Math.ceil(lenOf(s.mass) / spacing); while (s.path.length > maxN) s.path.pop();
  });
  // food vanishing right under my head looks instant
  if (me && me.alive) { const r = radOf(me.mass) + 14; for (const f of food) { const dx = f.x - me.x, dy = f.y - me.y; if (dx * dx + dy * dy < (r + 40) * (r + 40)) { f.x -= dx * dt * 4; f.y -= dy * dt * 4; } } }
  inT += dt;
  const I = playerInput(); if (I && me) me.want = I.want;
  if (inT >= 1 / 20 && I) { inT = 0; netSend({ t: 'in', w: Math.round(I.want * 100) / 100, b: I.boost ? 1 : 0 }); }
}

// ------------------------------------------------------------ screens
let demoReady = false;
function demo(dt) { if (!demoReady) { resetWorld(); demoReady = true; me = null; } step(dt); updateCamera(dt); drawWorld(); }
function drawTitle(dt) {
  demo(dt);
  ctx.fillStyle = 'rgba(7,8,12,0.55)'; ctx.fillRect(0, 0, W, H);
  U.txt('SNAKE', W / 2, 96, 96, '#ffffff', 'center', { head: true, weight: 800 });
  U.txt('ARENA', W / 2, 186, 96, '#4ade80', 'center', { head: true, weight: 800 });
  U.txt('Eat. Grow. Make them crash into you.', W / 2, 300, 18, '#cbd5e1', 'center', { weight: 600 });
  // skin picker
  U.txt('YOUR COLOR', W / 2, 344, 12, '#94a3b8', 'center');
  SKINS.slice(0, BASE_SKINS).forEach((sk, i) => { const x = W / 2 - BASE_SKINS * 22 + i * 44 + 22, y = 384; ctx.drawImage(ballSprite(sk[0], sk[1]), x - 16, y - 16, 32, 32); if (save.skin === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 21, 0, 7); ctx.stroke(); } if (U.click && Math.hypot(U.click.x - x, U.click.y - y) < 18) { U.click = null; save.skin = i; store(); Sound.play('tab'); } });
  if (U.button('play', W / 2 - 200, 430, 400, 64, 'PLAY', { color: '#4ade80', size: 22, light: true })) { mode = 'solo'; me = spawnPlayer(); deadInfo = null; screen = 'play'; Sound.playSong(SONGS.snake); }
  if (U.button('online', W / 2 - 200, 508, 400, 56, 'PLAY WITH FRIENDS ONLINE', { color: '#3b82f6', size: 16 })) { screen = 'online'; NET.screen = 'menu'; NET.error = ''; }
  U.txt(`Best length ${save.best}   ·   Snakes eaten ${save.kills}`, W / 2, 586, 14, '#94a3b8', 'center', { weight: 600 });
  U.txt('Steer with the mouse (or WASD / arrows)  ·  hold click or Space to boost', W / 2, H - 46, 13, '#64748b', 'center', { weight: 600 });
}
function drawOnline(dt) {
  demo(dt); ctx.fillStyle = 'rgba(7,8,12,0.6)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 320, 120, 640, 440);
  U.txt('PLAY ONLINE', W / 2, 148, 34, '#ffffff', 'center', { head: true, weight: 800 });
  if (NET.screen === 'menu') {
    U.txt('Host an arena and share the code (up to 8 players + bots).', W / 2, 200, 14, '#94a3b8', 'center', { weight: 600 });
    if (U.button('host', W / 2 - 220, 240, 440, 62, 'HOST AN ARENA', { color: '#4ade80', size: 20, light: true })) hostRoom();
    U.txt('OR JOIN WITH A CODE', W / 2, 334, 13, '#94a3b8', 'center', { weight: 700 });
    U.input('code', W / 2 - 220, 360, 300, 60, NET.input, 'ROOM CODE');
    NET.input.onEnter = v => { if (v.length >= 4) joinRoom(v); };
    if (U.button('join', W / 2 + 90, 360, 130, 60, 'JOIN', { color: '#3b82f6', size: 18 }) && NET.input.value.length >= 4) joinRoom(NET.input.value);
    if (NET.error) U.txt(NET.error, W / 2, 450, 15, '#f87171', 'center', { weight: 700 });
  } else U.txt(NET.role === 'host' ? 'Opening arena...' : `Joining ${NET.code}...`, W / 2, 300, 22, '#ffffff', 'center');
  if (U.button('oback', 40, H - 80, 140, 48, 'Back', { ghost: true, size: 15, sfx: 'back' })) { netReset(); screen = 'title'; mode = 'solo'; }
}
function drawDead() {
  ctx.fillStyle = 'rgba(7,8,12,0.55)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 260, 200, 520, 300);
  U.txt('YOU CRASHED', W / 2, 228, 40, '#f87171', 'center', { head: true, weight: 800 });
  U.txt(`into ${deadInfo.by}`, W / 2, 286, 16, '#cbd5e1', 'center', { weight: 600 });
  U.txt(`Length ${deadInfo.len}  ·  Rank ${deadInfo.rank}  ·  ${deadInfo.kills} eaten`, W / 2, 326, 18, '#ffffff', 'center');
  if (U.button('again', W / 2 - 230, 400, 220, 60, 'PLAY AGAIN', { color: '#4ade80', size: 18, light: true })) {
    deadInfo = null; if (mode === 'online' && NET.role === 'client') netSend({ t: 'respawn', name: myName(), skin: mySkin(), own: OWN() }); else me = spawnPlayer();
  }
  if (U.button('menu', W / 2 + 10, 400, 220, 60, 'MENU', { ghost: true, size: 18, sfx: 'back' })) { if (mode === 'online') { netSend({ t: 'bye' }); netReset(); } mode = 'solo'; screen = 'title'; me = null; deadInfo = null; demoReady = false; Sound.playSong(SONGS.snake); }
}

let last = 0, paused = false;
function frame(now) {
  let dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
  NetTransport.frame();
  if (screen === 'title') drawTitle(dt);
  else if (screen === 'online') drawOnline(dt);
  else {
    if (mode === 'online' && NET.role === 'client') clientFrame(dt);
    else {
      const I = playerInput(); if (I && me) { me.want = I.want; me.boost = I.boost; }
      if (!paused || mode === 'online') step(dt);
      if (NET.role === 'host') hostSend(dt);
    }
    updateCamera(dt); drawWorld(); drawHUD(dt);
    if (deadInfo) drawDead();
    else if (paused) {
      ctx.fillStyle = 'rgba(7,8,12,0.6)'; ctx.fillRect(0, 0, W, H); U.panel(W / 2 - 200, 260, 400, 200);
      U.txt('PAUSED', W / 2, 284, 32, '#fff', 'center', { head: true, weight: 800 });
      if (U.button('res', W / 2 - 160, 340, 320, 50, 'RESUME', { color: '#4ade80', light: true })) paused = false;
      if (U.button('quit', W / 2 - 160, 400, 320, 44, 'QUIT', { ghost: true, size: 15, sfx: 'back' })) { paused = false; if (mode === 'online') { netSend({ t: 'bye' }); netReset(); } mode = 'solo'; screen = 'title'; me = null; demoReady = false; }
    }
  }
  if (U.pressed.Escape) { if (screen === 'play' && !deadInfo) paused = !paused; else if (screen === 'online') { netReset(); screen = 'title'; } }
  U.endFrame();
  requestAnimationFrame(frame);
}
NetTransport.backgroundTicker(dt => { if (screen === 'play' && NET.role === 'host') { step(dt); hostSend(dt); } });
Sound.playSong(SONGS.snake);
const fontReady = document.fonts ? Promise.race([document.fonts.load(`800 40px 'Plus Jakarta Sans'`), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
fontReady.then(() => { requestAnimationFrame(n => { last = n; frame(n); }); const jc = NetTransport.joinCode(); if (jc) joinRoom(jc); });

window.__sn = { get snakes() { return snakes; }, get me() { return me; }, get food() { return food; }, get screen() { return screen; }, NET, hostRoom, joinRoom, step, spawnPlayer, resetWorld, save: () => save,
  start() { resetWorld(); mode = 'solo'; me = spawnPlayer(); deadInfo = null; screen = 'play'; }, get dead() { return deadInfo; } };
const alive = () => me && me.alive && (!NET.role || NET.role === 'host') ? '' : 'Start playing (or host) first';
window.__cheats = [
  { name: '+200 length', icon: '🐍', need: alive, run() { me.mass += 200; } },
  { name: 'Invincible', icon: '🛡', need: alive, toggle: () => !!me && !!me.god, run() { me.god = !me.god; } },
  { name: 'Eat every snake near you', icon: '💥', need: alive, run() { snakes.filter(s => s.alive && s !== me && Math.hypot(s.x - me.x, s.y - me.y) < 900).forEach(s => killSnake(s, me)); } },
  { name: 'Food explosion', icon: '✨', need: alive, run() { for (let i = 0; i < 200; i++) addFood(me.x + rand(-500, 500), me.y + rand(-500, 500), 2.5); } },
];
// invincibility: skip deaths for the owner
const _kill = killSnake;
killSnake = (s, k) => { if (s.god) { if (Math.hypot(s.x, s.y) > R - 40) { s.a += Math.PI; s.want = s.a; } return; } _kill(s, k); };
})();
