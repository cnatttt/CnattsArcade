// =====================================================================
//  TURBO KARTS - 3D kart racing
//  Solo: arrows / WASD drive, SPACE drift, E or X item
//  2P:   P1 WASD + SPACE drift + E item / P2 arrows + / drift + ENTER item
// =====================================================================
(() => {
'use strict';
const W = 1280, H = 720;
const glc = document.getElementById('gl'), ui = document.getElementById('ui'), ctx = ui.getContext('2d');
const R = createRenderer(glc);
const FONT = '"Russo One", "Arial Black", sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const ORD = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const fmtT = s => { if (s == null || !isFinite(s)) return '--:--.--'; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`; };
const hexA = (h, a = 1) => { const c = hexRGB(h); return `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${a})`; };

if (!R) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = `24px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Your browser does not support WebGL 2, so this game cannot run.', W / 2, H / 2); return; }

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_kart';
const DEFAULT_BINDS = {
  p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', drift: 'Space', item: 'KeyE', back: 'KeyQ' },
  p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drift: 'ShiftRight', item: 'Enter', back: 'Slash' },
};
const DEFAULT_SET = { laps: 3, mirror: false, items: true, ai: 7, units: 'kmh', minimap: true, shadows: true, res: 1, particles: 'high', cam: 1, fov: 1, fps: false, music: 0.8, sfx: 0.9, engine: 1, name: '' };
let save = { cls: 1, p1: 'blaze', p2: 'sky', trophies: {}, bestLap: {}, bestRace: {}, races: 0, wins: 0, autoGas: false, gp: null, set: {}, binds: {} };
try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) save = Object.assign(save, d); } catch (e) {}
save.set = Object.assign({}, DEFAULT_SET, save.set || {});
save.binds = { p1: Object.assign({}, DEFAULT_BINDS.p1, (save.binds || {}).p1), p2: Object.assign({}, DEFAULT_BINDS.p2, (save.binds || {}).p2) };
if (!save.set.name) save.set.name = 'Racer' + Math.floor(100 + Math.random() * 900);
// signed-in arcade players race under their account name
const myName = () => (window.Account && Account.user && Account.user.username) || SET().name;
// the site owner gets a gold OWNER tag next to their name
const OWN = () => !!(window.Account && Account.isOwnerMe && Account.isOwnerMe());
const ownOK = (n, f) => !!(window.Account && Account.ownerOK && Account.ownerOK(n, f));
const ownTag = (x, y, h, align) => (window.Account && Account.drawOwnerTag ? Account.drawOwnerTag(ctx, x, y, h, align) : 0);
const SET = () => save.set;
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ------------------------------------------------------------ input
const keys = {}, pressed = {};
const mouse = { x: -1, y: -1 }, UI = { click: null, down: false, hover: null, lastHover: null };
let touch = { on: false, left: false, right: false, drift: false, item: false, used: false };
function toCanvas(e) { const r = ui.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
ui.addEventListener('contextmenu', e => e.preventDefault());
ui.addEventListener('pointerdown', e => { e.preventDefault(); [mouse.x, mouse.y] = toCanvas(e); UI.down = true; UI.px = mouse.x; UI.py = mouse.y; if (e.pointerType === 'touch') { touch.used = true; touchPts.set(e.pointerId, [mouse.x, mouse.y]); } });
ui.addEventListener('pointermove', e => { [mouse.x, mouse.y] = toCanvas(e); if (touchPts.has(e.pointerId)) touchPts.set(e.pointerId, [mouse.x, mouse.y]); });
ui.addEventListener('pointerup', e => { const [x, y] = toCanvas(e); UI.down = false; UI.click = { x, y, px: UI.px, py: UI.py }; touchPts.delete(e.pointerId); });
ui.addEventListener('pointercancel', e => touchPts.delete(e.pointerId));
const touchPts = new Map();
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
  // rebinding a key in Settings
  if (state === 'settings' && capture) {
    e.preventDefault();
    if (e.code !== 'Escape') {
      const B = save.binds, old = B[capture.p][capture.a];
      for (const p of ['p1', 'p2']) for (const a of ACTIONS) if (B[p][a] === e.code && !(p === capture.p && a === capture.a)) B[p][a] = old;   // swap with whatever used it
      B[capture.p][capture.a] = e.code; store(); Sound.play('click');
    }
    capture = null; return;
  }
  // typing a name / room code
  if (state === 'online' && !net.role && net.field) {
    if (e.key === 'Backspace') { if (net.field === 'name') SET().name = SET().name.slice(0, -1); else net.codeInput = net.codeInput.slice(0, -1); e.preventDefault(); return; }
    if (e.key === 'Enter') { if (net.field === 'code' && net.codeInput.length === 5) joinRoom(net.codeInput); store(); return; }
    if (e.key === 'Tab') { net.field = net.field === 'name' ? 'code' : 'name'; return; }
    if (e.key.length === 1) {
      if (net.field === 'name' && /[\w \-!]/.test(e.key) && SET().name.length < 12) { SET().name += e.key; store(); }
      if (net.field === 'code' && /[a-z0-9]/i.test(e.key) && net.codeInput.length < 5) net.codeInput += e.key.toUpperCase();
      return;
    }
  }
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'race') { if (race.online) race.menu = !race.menu; else pause(); }
  else if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'pause') resume();
  else if (e.code === 'Escape' && state === 'settings') { store(); state = setFrom; }
  if (e.code === 'KeyM' && state !== 'online') Sound.setMusic(!Sound.musicOn);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'race' && !race.online) pause(); });
// control sets
// controls come from the key bindings in Settings. Solo play accepts both players' keys.
const ACTIONS = ['up', 'down', 'left', 'right', 'drift', 'item', 'back'];
function ctrlSet(which) {
  const o = {};
  ACTIONS.forEach(a => { o[a] = which === 'solo' ? [save.binds.p1[a], save.binds.p2[a]] : [save.binds[which][a]]; });
  if (which === 'solo') o.drift.push('ShiftLeft');
  return o;
}
const any = (list, map) => list.some(k => map[k]);

// ------------------------------------------------------------ meshes
const MESH = {};
function staticMeshes() {
  if (MESH.wheel) return;
  MESH.wheel = R.mesh(buildWheel()); MESH.box = R.mesh(buildItemBox()); MESH.boxCore = R.mesh(buildItemCore()); MESH.coin = R.mesh(buildCoin());
  MESH.oil = R.mesh(buildOil()); MESH.orb = R.mesh(buildOrb([0.25, 0.95, 0.35, 0.35])); MESH.rocket = R.mesh(buildRocket()); MESH.bomb = R.mesh(buildBomb());
  MESH.blades = R.mesh(prefab('blades')); MESH.balloon = R.mesh(prefab('balloon'));
  RACERS.forEach((r, i) => { const kb = buildKart(r, i + 1); MESH['kart_' + r.id] = R.mesh(kb.mb); KART_WHEELS[r.id] = kb.wheels; });
  // podium
  const pb = new MB(); [[0, 3.2, '#ffcc33'], [-4.2, 2.2, '#c8c8d8'], [4.2, 1.4, '#c87a3a']].forEach(([x, h, c]) => { pb.box(M4.compose(x, h / 2, 0, 0, 4, h, 4), c); });
  MESH.podium = R.mesh(pb);
}
const KART_WHEELS = {};
let world = null, worldMesh = null;
// mirror mode flips the track left-to-right
function trackDef(ti, mirror) {
  const T = TRACKS[ti]; if (!mirror) return T;
  return Object.assign({}, T, { id: T.id + '_m', name: T.name + ' (Mirror)', pts: T.pts.map(([x, z, y]) => [x, -z, y]), boosts: T.boosts.map(([f, l]) => [f, -l]) });
}
function loadTrack(ti, mirror) {
  mirror = !!mirror;
  if (world && world.ti === ti && world.mirror === mirror) return;
  if (worldMesh) { R.free(worldMesh.st); R.free(worldMesh.bm); R.free(worldMesh.sky); }
  world = buildWorld(trackDef(ti, mirror)); world.mirror = mirror;
  worldMesh = { st: R.mesh(world.st), bm: R.mesh(world.bm), sky: R.mesh(world.sky) }; world.verts = worldMesh.st.n;
  world.st = world.bm = world.sky = null;   // free the CPU copies
  const th = world.th, L = Math.hypot(...th.sun);
  world.env = { fog: hexRGB(th.fog), fogD: th.fogD, sun: th.sun.map(v => v / L), sunCol: th.sunCol, sky: th.amb, ground: th.gnd };
  world.ti = ti;
}

// ------------------------------------------------------------ race state
let state = 'loading', t = 0;
let race = null, karts = [], objs = [], parts = [], skids = [], toasts = [];
const CAMS = [];
function makeKart(racer, human, slot) {
  return { racer, human, slot, mesh: 'kart_' + racer.id, x: 0, y: 0, z: 0, vy: 0, air: false, h: 0, vh: 0, speed: 0, steerVis: 0, drift: 0, charge: 0, boostT: 0, spinT: 0, spinA: 0, starT: 0, shrinkT: 0,
    item: null, itemN: 0, rouletteT: 0, coins: 0, i: 0, prog: 0, finished: false, finishT: 0, place: slot + 1, lapTimes: [], lapStart: 0, lap: 1, wheelRot: 0, trickT: 0, trickReady: false, trickDone: false,
    offroad: false, onIce: false, bumpT: 0, wrongT: 0, hitFlash: 0, lastPads: -99, startBoost: 0, gasHeld: 0, scale: 1, landT: 0,
    ai: { lane: rand(-0.25, 0.25), laneT: rand(2, 5), skill: 1, itemT: rand(1, 4), driftT: 0 } };
}
const CLS = () => CLASSES[race && race.cls !== undefined ? race.cls : save.cls];
function stat(k, s) { return s - 3; }   // -2..+2
function topSpeed(k) {
  const r = k.racer; let v = CLS().speed * (1 + stat(0, r.speed) * 0.025) * (1 + k.coins * 0.009);
  if (k.human < 0) v *= k.ai.skill;
  if (k.starT > 0) v *= 1.15;
  if (k.shrinkT > 0) v *= 0.72;
  return v;
}
function startRace(mode, ti, opts = {}) {
  staticMeshes();
  const on = opts.online || null;
  const mirror = on ? on.mirror : (mode === 'gp' ? false : SET().mirror);
  loadTrack(ti, mirror);
  const humans = mode === 'vs' ? 2 : 1;
  karts = []; objs = []; parts = []; skids = []; toasts = [];
  // build the grid: a list of { racer, human, owner, name }
  let grid;
  if (on) grid = on.grid.map(gq => ({ racer: RACERS.find(r => r.id === gq.racer), human: gq.owner === net.myId ? 0 : -1, owner: gq.owner, name: gq.name }));
  else {
    const picks = [RACERS.find(r => r.id === save.p1)];
    if (humans === 2) picks.push(RACERS.find(r => r.id === save.p2) || RACERS[1]);
    let others = RACERS.filter(r => !picks.includes(r)).sort(() => Math.random() - 0.5);
    if (mode === 'quick' || mode === 'vs') others = others.slice(0, Math.max(0, Math.min(others.length, SET().ai)));
    const order = mode === 'tt' ? [picks[0]] : (opts.gridOrder || [...others, ...picks]);
    grid = order.map(r => ({ racer: r, human: picks.indexOf(r), owner: picks.includes(r) ? 'me' : 'ai', name: r.name, own: picks.indexOf(r) === 0 && OWN() }));
  }
  const P = world.P, N = world.N;
  grid.forEach((gq, slot) => {
    const k = makeKart(gq.racer, gq.human, slot);
    k.owner = gq.owner; k.name = gq.name || gq.racer.name; k.own = !!gq.own;
    if (on && gq.owner !== 'ai' && gq.owner !== net.myId) k.remote = true;        // another player's kart
    if (on && net.role === 'client' && gq.owner === 'ai') k.remote = true;          // the host drives the AI
    const row = Math.floor(slot / 2), side = slot % 2 ? 1 : -1, back = 4 + row * 3.5;
    const i = (N - Math.round(back)) % N, p = P[i];
    k.x = p.x + p.rx * side * world.W * 0.22; k.z = p.z + p.rz * side * world.W * 0.22; k.y = p.y;
    k.x -= p.tx * (slot % 2) * 2.5; k.z -= p.tz * (slot % 2) * 2.5;
    k.h = k.vh = Math.atan2(p.tx, p.tz); k.i = i; k.prog = -(N - i);
    const aiSkill = [1.0, 0.985, 0.97, 0.955, 0.94, 0.925, 0.91, 0.9];
    k.ai.skill = CLASSES[on ? on.cls : save.cls].ai * (aiSkill[(slot * 3) % 8] || 0.93);
    if (mode === 'tt') { k.item = 'turbo3'; k.itemN = 3; }
    k.net = null; k.slotIdx = slot;
    karts.push(k);
  });
  race = { mode, ti, t: 0, phase: 'intro', phaseT: 0, laps: on ? on.laps : mode === 'gp' ? LAPS : SET().laps, humans, done: false, finishOrder: [], endT: 0, gp: opts.gp || null,
    items: on ? on.items : (mode === 'gp' ? true : SET().items), cls: on ? on.cls : save.cls, mirror, online: !!on };
  CAMS.length = 0; karts.filter(k => k.human >= 0).sort((a, b) => a.human - b.human).forEach(k => CAMS.push({ k, eye: [k.x, k.y + 30, k.z], at: [k.x, k.y, k.z], fov: 1.1, shake: 0 }));
  state = 'race';
  Sound.stopSong && Sound.stopSong();
  engines.start(humans);
  save.races++; store();
}

// ------------------------------------------------------------ track queries
function findIndex(k) {
  const P = world.P, N = world.N;
  let best = k.i, bd = 1e18;
  for (let d = -8; d <= 8; d++) { const i = (k.i + d + N) % N, p = P[i], dd = (p.x - k.x) ** 2 + (p.z - k.z) ** 2; if (dd < bd) { bd = dd; best = i; } }
  return best;
}
function trackInfo(x, z, i) {
  const P = world.P, N = world.N, p = P[i], q = P[(i + 1) % N];
  const dx = x - p.x, dz = z - p.z;
  const along = dx * p.tx + dz * p.tz, lat = dx * p.rx + dz * p.rz;
  const u = clamp(along / STEP, -1, 1);
  const y = u >= 0 ? lerp(p.y, q.y, u) : lerp(p.y, P[(i - 1 + N) % N].y, -u);
  return { lat, y, p };
}

// ------------------------------------------------------------ kart physics
function controlsFor(k) {
  if (k.human < 0 || k.finished || window.__ktAI) return aiControls(k);
  const set = ctrlSet(race.humans === 2 ? (k.human === 0 ? 'p1' : 'p2') : 'solo');
  k.lookBack = any(set.back, keys);
  let steer = (any(set.right, keys) ? 1 : 0) - (any(set.left, keys) ? 1 : 0);
  let gas = any(set.up, keys) || save.autoGas || (race.mode === 'online' && SET().autoGasOnline) ? 1 : 0; if (any(set.down, keys)) gas = -1;
  let drift = any(set.drift, keys), item = set.item.some(c => pressed[c]);
  if (touch.used && race.humans === 1) { // simple touch: left/right thirds steer, buttons at the bottom right
    let tl = false, tr = false, td = false, ti = false;
    touchPts.forEach(([x, y]) => { if (x > W - 300 && y > H - 170) { if (x > W - 150) ti = true; else td = true; } else if (x < W / 2) tl = true; else tr = true; });
    steer = (tr ? 1 : 0) - (tl ? 1 : 0); gas = 1; drift = drift || td; if (ti && !touch.item) item = true; touch.item = ti;
  }
  return { steer, gas, drift, item };
}
function aiControls(k) {
  const P = world.P, N = world.N, a = k.ai;
  a.laneT -= 1 / 60; if (a.laneT <= 0) { a.laneT = rand(2, 6); a.lane = rand(-0.28, 0.28); }
  const look = Math.round(5 + Math.abs(k.speed) * 0.32);
  const ti = (k.i + look) % N, tp = P[ti];
  // hug the inside of upcoming corners
  const curve = P[(k.i + look + 6) % N].curve;
  let lane = a.lane * world.W - clamp(curve * 18, -world.W * 0.25, world.W * 0.25);
  // dodge oil slicks ahead
  for (const o of objs) if (o.kind === 'oil') { const d = ((o.i - k.i + N) % N); if (d > 2 && d < 14) { const ol = (o.x - P[o.i].x) * P[o.i].rx + (o.z - P[o.i].z) * P[o.i].rz; if (Math.abs(ol - lane) < 3) lane += ol > lane ? -4 : 4; } }
  const tx = tp.x + tp.rx * lane, tz = tp.z + tp.rz * lane;
  const want = Math.atan2(tx - k.x, tz - k.z), diff = wrapA(want - k.h);
  let steer = clamp(diff * 2.4, -1, 1), gas = 1;
  if (Math.abs(diff) > 0.8 && k.speed > 12) gas = 0.2;
  if (race.phase !== 'race') gas = 0;
  // drift through long corners
  const bend = Math.abs(P[(k.i + 10) % N].curve) + Math.abs(P[(k.i + 16) % N].curve);
  let drift = false;
  if (k.drift) drift = bend > 0.18 && k.charge < 2.6 + a.skill;
  else if (bend > 0.4 && k.speed > 16 && Math.random() < 0.05) drift = true;
  // items
  let item = false;
  if (k.item && k.rouletteT <= 0) {
    a.itemT -= 1 / 60;
    const ahead = karts.filter(o => o !== k && o.prog > k.prog && o.prog - k.prog < 40).length, behind = karts.filter(o => o !== k && o.prog < k.prog && k.prog - o.prog < 12).length;
    if (a.itemT <= 0) {
      if (k.item === 'oil' && behind) item = true;
      else if (['bouncer', 'homing', 'bomb'].includes(k.item) && ahead) item = true;
      else if (['turbo', 'turbo3', 'shield', 'zap'].includes(k.item) && Math.abs(P[(k.i + 15) % N].curve) < 0.15) item = true;
      if (a.itemT < -6) item = true;
    }
    if (item) a.itemT = rand(0.6, 2);
  }
  return { steer, gas, drift, item };
}
function updateKart(k, dt, ctl) {
  const P = world.P, N = world.N, th = world.th;
  ctl = ctl || aiControls(k);
  const c = race.phase === 'race' || k.finished ? ctl : { steer: 0, gas: 0, drift: false, item: false, pre: ctl };
  // start boost: hold gas when the light turns green (timing from countdown)
  if (race.phase === 'count' && k.human >= 0) { const pc = c.pre; if (pc && pc.gas > 0) k.gasHeld += dt; else k.gasHeld = 0; }
  if (race.phase === 'count' && k.human < 0 && race.phaseT > 2.4 && Math.random() < 0.02) k.gasHeld = 0.3;
  // timers
  k.boostT = Math.max(0, k.boostT - dt); k.starT = Math.max(0, k.starT - dt); k.shrinkT = Math.max(0, k.shrinkT - dt); k.hitFlash -= dt; k.bumpT -= dt; k.landT -= dt;
  k.scale = lerp(k.scale, k.shrinkT > 0 ? 0.6 : 1, dt * 6);
  if (k.rouletteT > 0) { k.rouletteT -= dt; if (k.rouletteT <= 0) { if (k.human >= 0) SND.itemGot(); } }
  const top = topSpeed(k);
  const turnRate = 1.6 + stat(0, k.racer.handling) * 0.12;
  const accel = 10 + stat(0, k.racer.accel) * 1.6;
  let steer = c.steer;
  if (k.spinT > 0) {
    k.spinT -= dt; k.spinA += dt * 14; k.speed *= Math.pow(0.15, dt); steer = 0; k.drift = 0;
  } else {
    k.spinA = 0;
    // throttle
    let target = top;
    if (k.offroad && k.boostT <= 0 && k.starT <= 0) target *= 0.55;
    if (k.boostT > 0) target = top * 1.38;
    if (c.gas > 0) { if (k.speed < target) k.speed += accel * (1 - 0.55 * Math.max(0, k.speed) / target) * dt * (k.boostT > 0 ? 3 : 1); else k.speed = lerp(k.speed, target, dt * 2); }
    else if (c.gas < 0) { if (k.speed > 0) k.speed -= 28 * dt; else k.speed = Math.max(-9, k.speed - 10 * dt); }
    else k.speed *= Math.pow(0.55, dt);
    if (k.speed > target && c.gas >= 0) k.speed = lerp(k.speed, target, dt * (k.offroad ? 3 : 1.2));
    // drifting
    if (c.drift && !k.drift && !k.air && Math.abs(steer) > 0.2 && k.speed > 11) { k.drift = Math.sign(steer); k.charge = 0; k.vy = 3.2; k.air = true; SND.hop(k); }
    if (k.drift && (!c.drift || k.speed < 8)) {
      const lvl = k.charge > 3.2 ? 3 : k.charge > 2.0 ? 2 : k.charge > 1.0 ? 1 : 0;
      if (lvl) { k.boostT = Math.max(k.boostT, [0, 0.55, 0.95, 1.4][lvl]); SND.miniTurbo(k, lvl); }
      k.drift = 0; k.charge = 0;
    }
    if (k.drift) k.charge += dt * (steer * k.drift > 0.3 ? 1.5 : 0.8);
    // trick off ramps
    if (k.air && k.trickReady && c.drift && !k.trickDone) { k.trickDone = true; k.trickT = 0.5; SND.trick(k); }
  }
  // steering
  const grip = k.onIce ? 2.2 : k.drift ? 3.2 : 9;
  const sp = Math.abs(k.speed), spF = Math.min(1, sp / 9) * (k.speed < 0 ? -1 : 1);
  if (k.drift) k.h += (k.drift * 0.55 + steer * 0.55) * turnRate * 1.12 * dt * Math.min(1, sp / 12);
  else k.h += steer * turnRate * spF * dt * (k.onIce ? 0.8 : 1);
  k.steerVis = lerp(k.steerVis, steer, dt * 10);
  k.vh += wrapA(k.h - k.vh) * Math.min(1, grip * dt);
  // move
  k.x += Math.sin(k.vh) * k.speed * dt; k.z += Math.cos(k.vh) * k.speed * dt;
  // track position
  const prevI = k.i;
  k.i = findIndex(k);
  let d = k.i - prevI; if (d > N / 2) d -= N; if (d < -N / 2) d += N;
  k.prog += d;
  if (d < 0 && k.speed > 5) k.wrongT += dt; else if (d > 0) k.wrongT = 0;
  const info = trackInfo(k.x, k.z, k.i);
  // walls
  const lim = world.WALL - 1.0;
  if (Math.abs(info.lat) > lim) {
    const s = Math.sign(info.lat), over = Math.abs(info.lat) - lim, p = info.p;
    k.x -= p.rx * s * over; k.z -= p.rz * s * over;
    const ta = Math.atan2(p.tx, p.tz), rel = wrapA(k.vh - ta);
    if (Math.abs(rel) < Math.PI / 2) { k.vh = ta + rel * 0.3; k.h = lerp(k.h, ta + wrapA(k.h - ta) * 0.4, 0.5); }
    else { k.vh = ta + Math.PI + wrapA(rel - Math.PI) * 0.3; }
    if (k.bumpT <= 0 && Math.abs(k.speed) > 6) { k.speed *= 0.75; k.bumpT = 0.3; SND.bump(k); for (let n = 0; n < 8; n++) spark(k.x + p.rx * s * 0.8, k.y + 0.5, k.z + p.rz * s * 0.8, '#ffe08a'); if (k.human >= 0) camShake(k, 0.25); }
  }
  k.offroad = Math.abs(info.lat) > world.half + 0.6;
  k.onIce = world.iceSet.has(k.i) && Math.abs(info.lat) < world.half;
  // height / jumps
  let ground = info.y;
  const ri = world.rampIdx.find(r => { const dd = (k.i - r + N) % N; return dd >= 0 && dd < 5; });
  if (ri !== undefined) ground += 0.12 + ((k.i - ri + N) % N) * 0.28;
  if (ri !== undefined && !k.air && (k.i - ri + N) % N >= 4 && k.speed > 12) { k.air = true; k.vy = 7 + k.speed * 0.2; k.trickReady = true; k.trickDone = false; }
  if (k.air) {
    k.vy -= 30 * dt; k.y += k.vy * dt;
    if (k.y <= ground) { k.y = ground; k.air = false; k.vy = 0; k.landT = 0.2; if (k.trickDone) { k.boostT = Math.max(k.boostT, 0.9); if (k.human >= 0) toast(k, 'TRICK BOOST!', '#ffe03a'); } k.trickReady = false; k.trickDone = false; for (let n = 0; n < 6; n++) dust(k); }
  } else k.y = ground;
  k.trickT = Math.max(0, k.trickT - dt);
  // boost pads
  for (const pad of world.boostPads) { const dd = (k.i - pad.i + N) % N; if (dd >= 0 && dd < pad.len && Math.abs(info.lat - pad.lane) < 2.4 && t - k.lastPads > 0.6) { k.lastPads = t; k.boostT = Math.max(k.boostT, 1.2); SND.boost(k); } }
  k.wheelRot += k.speed * dt / 0.36;
  // laps
  if (!k.finished) {
    const lap = Math.floor(k.prog / N) + 1;
    if (lap > k.lap && lap >= 2) {
      k.lapTimes.push(race.t - k.lapStart); k.lapStart = race.t; k.lap = lap;
      if (lap > race.laps) finishKart(k);
      else if (k.human >= 0) { if (lap === race.laps) { toast(k, 'FINAL LAP!', '#ff5a5a', 2.5); SND.finalLap(); } else toast(k, `LAP ${lap}/${race.laps}`, '#ffffff', 1.5); SND.lap(); }
    }
  }
  kartFx(k);
}
// sparks, flames, dust and skid marks (also used for other players' karts online)
function kartFx(k) {
  const low = SET().particles === 'low';
  if (k.drift && !k.air) {
    const lvl = k.charge > 3.2 ? 3 : k.charge > 2.0 ? 2 : k.charge > 1.0 ? 1 : 0;
    const col = ['#c8c8c8', '#4ab8ff', '#ff9a2a', '#d86aff'][lvl];
    for (const s of [-1, 1]) { const wx = k.x + Math.sin(k.h - Math.PI / 2) * s * 0.75 - Math.sin(k.h) * 0.9, wz = k.z + Math.cos(k.h - Math.PI / 2) * s * 0.75 - Math.cos(k.h) * 0.9; if (lvl || Math.random() < 0.3) spark(wx, k.y + 0.2, wz, col, lvl ? 1 : 0.5); }
    addSkid(k);
  } else k.lastSkid = null;
  if (k.boostT > 0) for (let n = 0; n < 2; n++) parts.push({ x: k.x - Math.sin(k.h) * 1.5 + rand(-0.3, 0.3), y: k.y + 0.65, z: k.z - Math.cos(k.h) * 1.5 + rand(-0.3, 0.3), vx: -Math.sin(k.h) * 8, vy: rand(0, 2), vz: -Math.cos(k.h) * 8, t: 0, life: 0.25, col: pick(['#ffe03a', '#ff8a1a', '#ff4a1a']), size: 1.1, add: true });
  if (k.offroad && k.speed > 6 && Math.random() < 0.5) dust(k);
  if (k.starT > 0 && Math.random() < 0.6) spark(k.x + rand(-1, 1), k.y + rand(0.5, 2), k.z + rand(-1, 1), pick(['#ff5a5a', '#ffe03a', '#5aff5a', '#5ad8ff', '#d86aff']), 1);
}
function finishKart(k) {
  k.finished = true; k.finishT = race.t;
  race.finishOrder.push(k);
  k.place = race.finishOrder.length;
  if (k.human >= 0) {
    toast(k, k.place === 1 ? 'YOU WIN!' : `FINISHED ${ORD(k.place).toUpperCase()}`, k.place <= 3 ? '#ffe03a' : '#ffffff', 4);
    SND.finish(k.place);
    const id = world.def.id, best = Math.min(...k.lapTimes);
    if (!save.bestLap[id] || best < save.bestLap[id]) { save.bestLap[id] = best; toast(k, 'NEW BEST LAP!', '#8aff6a', 3); }
    if (race.mode === 'tt' && (!save.bestRace[id] || k.finishT < save.bestRace[id])) save.bestRace[id] = k.finishT;
    if (k.place === 1 && race.mode !== 'tt') save.wins++;
    store();
  }
}
function hitKart(k, by, shrink) {
  if (k.starT > 0 || k.spinT > 0) return false;
  if (k.remote) { if (race.online && net.role === 'host') netSend(k.owner, { t: 'hit', shrink: shrink || 0 }); k.spinT = 1.1; return true; }
  if (shrink) k.shrinkT = shrink;
  k.spinT = 1.1; k.drift = 0; k.charge = 0; k.hitFlash = 0.3;
  if (k.coins > 0) { k.coins = Math.max(0, k.coins - 2); }
  for (let n = 0; n < 14; n++) spark(k.x, k.y + 1, k.z, pick(['#ffffff', '#ffe03a', '#ff8a3a']), 1.2);
  SND.spin(k);
  if (k.human >= 0) camShake(k, 0.5);
  return true;
}

// ------------------------------------------------------------ items
function rollItem(k) {
  if (race.mode === 'tt') return null;
  const n = karts.length, band = k.place <= Math.max(1, Math.round(n * 0.25)) ? 0 : k.place >= n - Math.round(n * 0.35) + 1 ? 2 : 1;
  const ids = Object.keys(ITEMS); let s = 0; ids.forEach(id => s += ITEMS[id].w[band]);
  let r = Math.random() * s; for (const id of ids) { r -= ITEMS[id].w[band]; if (r <= 0) return id; } return 'turbo';
}
function useItem(k) {
  const it = k.item; if (!it || k.rouletteT > 0 || k.spinT > 0) return;
  const P = world.P, N = world.N, fx = Math.sin(k.h), fz = Math.cos(k.h);
  if (it === 'turbo' || it === 'turbo3') { k.boostT = Math.max(k.boostT, 1.15); k.speed = Math.max(k.speed, topSpeed(k) * 1.15); SND.turbo(k); }
  else if (it === 'shield') { k.starT = 7; k.boostT = Math.max(k.boostT, 1); SND.star(k); }
  else if (race.online && net.role === 'client') { netSend('host', { t: 'use', item: it }); if (it === 'zap') { flash = 0.6; SND.zap(); } else if (it === 'oil' || it === 'bomb') SND.drop(k); else SND.shoot(k); }
  else spawnItem(k, it);
  if (it === 'turbo3' && --k.itemN > 0) return;
  k.item = null; k.itemN = 0;
}
// puts a thrown/dropped item into the world (host or offline only)
function spawnItem(k, it) {
  const P = world.P, N = world.N, fx = Math.sin(k.h), fz = Math.cos(k.h);
  if (it === 'oil') { objs.push({ kind: 'oil', x: k.x - fx * 2.6, y: k.y, z: k.z - fz * 2.6, i: k.i, t: 0, owner: k }); SND.drop(k); }
  else if (it === 'bouncer') { objs.push({ kind: 'orb', x: k.x + fx * 2.4, y: k.y + 0.7, z: k.z + fz * 2.4, vx: fx * 52, vz: fz * 52, i: k.i, t: 0, life: 7, owner: k }); SND.shoot(k); }
  else if (it === 'homing') {
    const ahead = karts.filter(o => o !== k && !o.finished && o.prog > k.prog).sort((a, b) => a.prog - b.prog)[0];
    objs.push({ kind: 'rocket', x: k.x + fx * 2.4, y: k.y + 0.9, z: k.z + fz * 2.4, h: k.h, i: k.i, t: 0, life: 9, owner: k, target: ahead || null }); SND.rocket(k);
  }
  else if (it === 'bomb') { const ti = (k.i + 16) % N, info = trackInfo(k.x, k.z, k.i), p = P[ti]; objs.push({ kind: 'bomb', sx: k.x, sy: k.y + 1, sz: k.z, x: k.x, y: k.y + 1, z: k.z, tx: p.x + p.rx * info.lat * 0.7, ty: p.y + 0.9, tz: p.z + p.rz * info.lat * 0.7, i: ti, t: 0, fly: 0.7, fuse: 1.3, owner: k }); SND.drop(k); }
  else if (it === 'zap') { karts.forEach(o => { if (o !== k && o.prog > k.prog && o.starT <= 0) hitKart(o, k, 4); }); flash = 0.6; SND.zap(); }
}
function updateObjs(dt) {
  const P = world.P, N = world.N;
  for (const o of objs) {
    o.t += dt;
    if (o.kind === 'oil') { for (const k of karts) if (!k.air && Math.hypot(k.x - o.x, k.z - o.z) < 1.9) { if (hitKart(k, o.owner)) { o.dead = true; break; } else if (k.starT > 0) o.dead = true; } }
    else if (o.kind === 'orb' || o.kind === 'rocket') {
      o.life -= dt; if (o.life <= 0) { o.dead = true; boom(o.x, o.y, o.z, false); continue; }
      if (o.kind === 'rocket') {
        let tx, tz; const tg = o.target;
        if (tg && !tg.finished && ((tg.i - o.i + N) % N) < 18) { tx = tg.x; tz = tg.z; } else { const p = P[(o.i + 8) % N]; tx = p.x; tz = p.z; }
        const want = Math.atan2(tx - o.x, tz - o.z); o.h += clamp(wrapA(want - o.h), -5 * dt, 5 * dt);
        o.vx = Math.sin(o.h) * 58; o.vz = Math.cos(o.h) * 58;
        if (Math.random() < 0.8) parts.push({ x: o.x, y: o.y, z: o.z, vx: rand(-1, 1), vy: rand(0, 1), vz: rand(-1, 1), t: 0, life: 0.5, col: pick(['#ffb040', '#c8c8c8']), size: 0.8 });
      }
      o.x += o.vx * dt; o.z += o.vz * dt;
      // stay on the track
      let bi = o.i, bd = 1e9; for (let d = -6; d <= 6; d++) { const i = (o.i + d + N) % N, dd = (P[i].x - o.x) ** 2 + (P[i].z - o.z) ** 2; if (dd < bd) { bd = dd; bi = i; } } o.i = bi;
      const inf = trackInfo(o.x, o.z, o.i); o.y = inf.y + 0.75;
      if (Math.abs(inf.lat) > world.WALL - 0.8) { const p = inf.p, s = Math.sign(inf.lat); o.x -= p.rx * s * (Math.abs(inf.lat) - world.WALL + 0.8); o.z -= p.rz * s * (Math.abs(inf.lat) - world.WALL + 0.8); const dot = o.vx * p.rx + o.vz * p.rz; o.vx -= 2 * dot * p.rx; o.vz -= 2 * dot * p.rz; if (o.kind === 'rocket') o.h = Math.atan2(o.vx, o.vz); else SND.bounce(o); }
      for (const k of karts) { if (k === o.owner && o.t < 0.5) continue; if (Math.hypot(k.x - o.x, k.z - o.z) < 2.0 && Math.abs(k.y + 0.6 - o.y) < 2.5) { hitKart(k, o.owner); o.dead = true; boom(o.x, o.y, o.z, o.kind === 'rocket'); break; } }
      for (const q of objs) if (q !== o && q.kind === 'oil' && Math.hypot(q.x - o.x, q.z - o.z) < 2) { q.dead = true; o.dead = true; }
    } else if (o.kind === 'bomb') {
      if (o.t < o.fly) { const u = o.t / o.fly; o.x = lerp(o.sx, o.tx, u); o.z = lerp(o.sz, o.tz, u); o.y = lerp(o.sy, o.ty, u) + Math.sin(u * Math.PI) * 6; }
      else { o.x = o.tx; o.y = o.ty; o.z = o.tz; const near = karts.some(k => Math.hypot(k.x - o.x, k.z - o.z) < 2.6); if (o.t > o.fly + o.fuse || near) { o.dead = true; boom(o.x, o.y, o.z, true); karts.forEach(k => { if (Math.hypot(k.x - o.x, k.z - o.z) < 8.5) hitKart(k, o.owner); }); } }
    }
  }
  objs = objs.filter(o => !o.dead);
  // item boxes + coins
  for (const b of world.boxes) {
    if (!race.items) break;
    if (b.gone > 0) { b.gone -= dt; continue; }
    for (const k of karts) if (Math.hypot(k.x - b.x, k.z - b.z) < 2.3 && Math.abs(k.y + 1 - b.y) < 2.5) {
      b.gone = 3;
      for (let n = 0; n < 16; n++) spark(b.x, b.y, b.z, pick(['#ff5a5a', '#5ad8ff', '#ffe03a', '#6aff6a', '#d86aff']), 1.2);
      if (!k.item && race.mode !== 'tt') { k.item = rollItem(k); k.itemN = k.item === 'turbo3' ? 3 : 1; k.rouletteT = k.human >= 0 ? 1.4 : 0.8; if (k.human >= 0) SND.box(); if (k.remote) netSend(k.owner, { t: 'give', item: k.item, n: k.itemN }); }
      break;
    }
  }
  for (const c of world.coins) {
    if (c.gone > 0) { c.gone -= dt; continue; }
    for (const k of karts) if (Math.hypot(k.x - c.x, k.z - c.z) < 1.9 && Math.abs(k.y + 1 - c.y) < 2.5) { c.gone = 10; if (k.coins < 10) k.coins++; if (k.remote) netSend(k.owner, { t: 'coin' }); if (k.human >= 0) SND.coin(); for (let n = 0; n < 6; n++) spark(c.x, c.y, c.z, '#ffd84a', 0.8); break; }
  }
}
function boom(x, y, z, big) {
  for (let n = 0; n < (big ? 50 : 20); n++) { const a = rand(0, 6.28), e = rand(-0.3, 1.2), v = rand(4, big ? 16 : 9); parts.push({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + 3, vz: Math.sin(a) * Math.cos(e) * v, t: 0, life: rand(0.4, 0.8), col: pick(['#ffe03a', '#ff8a1a', '#ff4a1a', '#ffffff']), size: big ? 2.2 : 1.4, add: true, g: 10 }); }
  for (let n = 0; n < (big ? 20 : 6); n++) parts.push({ x, y, z, vx: rand(-3, 3), vy: rand(2, 6), vz: rand(-3, 3), t: 0, life: rand(0.8, 1.4), col: '#5a5a64', size: 3, g: -1 });
  SND.boom(big, x, z);
}
function spark(x, y, z, col, s = 1) { if (SET().particles === 'low' && Math.random() < 0.6) return; parts.push({ x, y, z, vx: rand(-4, 4), vy: rand(2, 6), vz: rand(-4, 4), t: 0, life: rand(0.2, 0.45), col, size: 0.5 * s + 0.3, add: true, g: 18 }); }
function dust(k) { const col = { meadow: '#8a7a5a', desert: '#e8c08a', snow: '#ffffff', city: '#5a5a6a' }[world.def.theme]; parts.push({ x: k.x - Math.sin(k.h) * 1.2 + rand(-0.6, 0.6), y: k.y + 0.3, z: k.z - Math.cos(k.h) * 1.2 + rand(-0.6, 0.6), vx: rand(-1, 1), vy: rand(1, 2.5), vz: rand(-1, 1), t: 0, life: 0.7, col, size: 1.8, g: -0.5 }); }
function addSkid(k) {
  const pts = [];
  for (const s of [-1, 1]) pts.push([k.x + Math.sin(k.h - Math.PI / 2) * s * 0.75 - Math.sin(k.h) * 0.9, k.y + 0.08, k.z + Math.cos(k.h - Math.PI / 2) * s * 0.75 - Math.cos(k.h) * 0.9]);
  if (k.lastSkid) for (let s = 0; s < 2; s++) { const a = k.lastSkid[s], b = pts[s]; if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 3) skids.push([a, b]); }
  if (skids.length > 900) skids.splice(0, skids.length - 900);
  k.lastSkid = pts;
}

// ------------------------------------------------------------ race flow
let flash = 0;
const authority = () => !race.online || net.role === 'host';
function onGo() {
  race.phase = 'race'; race.phaseT = 0; SND.beep(true);
  Sound.playSong(SONGS[TRACKS[race.ti].song]);
  karts.forEach(k => { if (k.remote) return; if (k.gasHeld > 0.05 && k.gasHeld < 0.75) { k.boostT = 1.2; k.speed = topSpeed(k) * 0.8; if (k.human >= 0) toast(k, 'ROCKET START!', '#ffe03a', 1.5); } else if (k.gasHeld > 1.6) { k.spinT = 0.6; if (k.human >= 0) toast(k, 'STALLED!', '#ff8a8a', 1.2); } k.lapStart = 0; });
}
function updateRace(dt) {
  const auth = authority();
  race.t += race.phase === 'race' ? dt : 0;
  race.phaseT += dt;
  if (auth) {
    if (race.phase === 'intro' && race.phaseT > 3.2) { race.phase = 'count'; race.phaseT = 0; }
    if (race.phase === 'count' && race.phaseT >= 3) onGo();
  }
  if (race.phase === 'count') { const n = Math.floor(race.phaseT); if (n !== race.lastBeep && n < 3) { race.lastBeep = n; SND.beep(false); } }
  // karts
  for (const k of karts) {
    if (k.remote) { followNet(k, dt); kartFx(k); continue; }
    const c = controlsFor(k);
    if (race.phase === 'race' && c.item && k.item && !race.menu) useItem(k);
    if (race.menu && k.human >= 0) { c.steer = 0; c.drift = false; }
    updateKart(k, dt, c);
  }
  for (const k in pressed) delete pressed[k];
  // kart-kart bumps (each machine only moves the karts it drives)
  for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {
    const A = karts[a], B = karts[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d < 2.1 && d > 0.01 && Math.abs(A.y - B.y) < 1.5) {
      if (auth) { if (A.starT > 0 && B.starT <= 0) { hitKart(B, A); continue; } if (B.starT > 0 && A.starT <= 0) { hitKart(A, B); continue; } }
      const ma = 0.8 + A.racer.weight * 0.1 * A.scale, mb = 0.8 + B.racer.weight * 0.1 * B.scale, push = (2.1 - d), nx = dx / d, nz = dz / d;
      const fa = B.remote && !A.remote ? 1 : mb / (ma + mb), fb = A.remote && !B.remote ? 1 : ma / (ma + mb);
      if (!A.remote) { A.x -= nx * push * fa; A.z -= nz * push * fa; }
      if (!B.remote) { B.x += nx * push * fb; B.z += nz * push * fb; }
      if (A.bumpT <= 0 && B.bumpT <= 0 && Math.abs(A.speed - B.speed) > 3) { A.bumpT = B.bumpT = 0.4; SND.bump(A.human >= 0 ? A : B); if (!A.remote) A.speed *= 0.95; if (!B.remote) B.speed *= 0.95; }
    }
  }
  if (auth) updateObjs(dt);
  else { for (const o of objs) o.t += dt; updateNetObjs(dt); }
  // positions
  if (auth) { const order = karts.filter(k => !k.finished).sort((a, b) => b.prog - a.prog); order.forEach((k, j) => k.place = race.finishOrder.length + j + 1); }
  // particles
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= (p.g || 0) * dt; p.vx *= 0.96; p.vz *= 0.96; }
  parts = parts.filter(p => p.t < p.life); if (parts.length > 2500) parts.splice(0, parts.length - 2500);
  toasts.forEach(m => m.t += dt); toasts = toasts.filter(m => m.t < m.dur);
  flash = Math.max(0, flash - dt);
  // network
  if (race.online) netRaceTick(dt);
  // end of race
  if (auth) {
    const humans = karts.filter(k => k.human >= 0 || (race.online && k.owner !== 'ai'));
    if (!race.done && humans.every(k => k.finished)) { race.done = true; race.endT = 0; }
    if (race.done) {
      race.endT += dt;
      if (race.endT > 4 || karts.every(k => k.finished)) {
        karts.filter(k => !k.finished).sort((a, b) => b.prog - a.prog).forEach(k => { k.finished = true; k.finishT = race.t + (race.laps * world.N - k.prog) / Math.max(5, topSpeed(k)) * STEP; race.finishOrder.push(k); k.place = race.finishOrder.length; });
        if (race.online) netBroadcast({ t: 'end', order: race.finishOrder.map(k => [k.slotIdx, +k.finishT.toFixed(2)]) });
        endRace();
      }
    }
  }
  if (race.phase === 'race' && Sound.ready) engines.update();
}
function endRace() {
  engines.stop();
  state = 'results'; resT = 0;
  const gp = race.gp;
  if (gp) { race.finishOrder.forEach((k, i) => { gp.points[k.racer.id] = (gp.points[k.racer.id] || 0) + GP_POINTS[i]; }); gp.results.push(race.finishOrder.map(k => k.racer.id)); saveGP(); }
  const best = karts.filter(k => k.human >= 0).map(k => k.place).sort((a, b) => a - b)[0];
  Sound.playSong(best <= 3 ? SONGS.kwin : SONGS.klose);
}

// ------------------------------------------------------------ online multiplayer
const net = { role: null, code: '', myId: null, tr: null, players: [], cfg: { ti: 0, mirror: false, laps: 3, items: true, cls: 1, ai: true }, screen: 'menu', error: '', field: 'code', codeInput: '', sendT: 0, inRace: false, objId: 0 };
function netSend(to, m) { if (net.tr) net.tr.send(to, m); }
function netBroadcast(m) { if (net.tr) net.tr.broadcast(m); }
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function hostRoom() {
  netReset();
  net.role = 'host'; net.myId = 'host'; net.screen = 'connecting'; net.error = '';
  net.code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  net.tr = NetTransport.host(net.code, {
    ready: () => { net.screen = 'lobby'; net.players = [{ id: 'host', name: myName(), racer: save.p1, own: OWN() }]; netLobby(); },
    join: () => {},
    leave: id => netPlayerLeft(id),
    msg: (from, d) => hostMsg(from, d),
    error: e => { if (e === 'taken') { hostRoom(); return; } net.error = 'Online error: ' + e; net.screen = 'menu'; netReset(true); },
  });
}
function joinRoom(code) {
  netReset();
  net.role = 'client'; net.code = code.toUpperCase(); net.screen = 'connecting'; net.error = '';
  net.tr = NetTransport.join(net.code, {
    ready: id => {
      net.myId = id;
      const hello = () => netSend('host', { t: 'hello', name: myName(), racer: save.p1, own: OWN() });
      hello(); let n = 0; const tr = net.tr;
      const iv = setInterval(() => { if (net.tr !== tr || net.screen === 'lobby' || ++n > 10) { clearInterval(iv); if (net.tr === tr && net.screen !== 'lobby') netLost('The room did not answer. Try again.'); return; } hello(); }, 1500);
    },
    join: () => {},
    leave: () => netLost('The host left the room'),
    msg: (from, d) => clientMsg(d),
    error: e => { net.error = e === 'Room not found' ? `Room ${net.code} was not found` : 'Online error: ' + e; net.screen = 'menu'; netReset(true); },
  });
}
function netReset(keepError) { if (net.tr) try { net.tr.close(); } catch (e) {} net.tr = null; net.role = null; net.players = []; net.inRace = false; if (!keepError) net.error = ''; }
function netLost(why) {
  const wasRacing = state === 'race' || state === 'results' || state === 'pause';
  netReset(); net.error = why; net.screen = 'menu';
  if (wasRacing) engines.stop();
  go('online');
}
function leaveOnline() { if (net.role === 'client') netSend('host', { t: 'bye' }); netReset(); net.screen = 'menu'; engines.stop(); go('title'); }
function netLobby() { netBroadcast({ t: 'lobby', players: net.players, cfg: net.cfg, inRace: net.inRace }); }
function netPlayerLeft(id) {
  const p = net.players.find(q => q.id === id); net.players = net.players.filter(q => q.id !== id);
  if (net.inRace && race && race.online) { const k = karts.find(q => q.owner === id); if (k) { k.remote = false; k.owner = 'ai'; k.human = -1; toast(CAMS[0] && CAMS[0].k, `${p ? p.name : 'A player'} left`, '#ff8a8a', 2); } }
  netLobby();
}
function freeRacer(want, id) {
  const taken = new Set(net.players.filter(p => p.id !== id).map(p => p.racer));
  if (!taken.has(want)) return want;
  return RACERS.map(r => r.id).find(r => !taken.has(r));
}
function hostMsg(from, d) {
  if (d.t === 'hello') {
    if (net.players.length >= 8) { netSend(from, { t: 'full' }); return; }
    if (!net.players.some(p => p.id === from)) net.players.push({ id: from, name: String(d.name || 'Racer').slice(0, 16), racer: freeRacer(d.racer, from), own: !!d.own });
    netLobby();
  } else if (d.t === 'pick') { const p = net.players.find(q => q.id === from); if (p) { p.racer = freeRacer(d.racer, from); netLobby(); } }
  else if (d.t === 'bye') netPlayerLeft(from);
  else if (!race || !race.online) return;
  else if (d.t === 'st') { const k = karts.find(q => q.owner === from); if (k) { k.net = d; k.netT = t; } }
  else if (d.t === 'use') { const k = karts.find(q => q.owner === from); if (k) spawnItem(k, d.item); }
}
function clientMsg(d) {
  if (d.t === 'lobby') { net.players = d.players; net.cfg = d.cfg; net.inRace = d.inRace; if (net.screen !== 'lobby') { net.screen = 'lobby'; if (state !== 'race') go('online'); } const me = d.players.find(p => p.id === net.myId); if (me && me.racer !== save.p1) { save.p1 = me.racer; store(); } }
  else if (d.t === 'full') { netLost('That room is full (8 players)'); }
  else if (d.t === 'closed') netLost('The host closed the room');
  else if (d.t === 'start') { net.inRace = true; startRace('online', d.ti, { online: d }); }
  else if (d.t === 'lobbyback') { net.inRace = false; engines.stop(); go('online'); net.screen = 'lobby'; }
  else if (!race || !race.online) return;
  else if (d.t === 'snap') applySnap(d);
  else if (d.t === 'give') { const k = myKart(); if (k) { k.item = d.item; k.itemN = d.n; k.rouletteT = 1.4; SND.box(); } }
  else if (d.t === 'coin') { const k = myKart(); if (k && k.coins < 10) { k.coins++; SND.coin(); } }
  else if (d.t === 'hit') { const k = myKart(); if (k) hitKart(k, null, d.shrink); }
  else if (d.t === 'end') {
    race.finishOrder = d.order.map(([slot, ft]) => { const k = karts[slot]; k.finished = true; k.finishT = ft; return k; });
    race.finishOrder.forEach((k, i) => k.place = i + 1);
    endRace();
  }
}
const myKart = () => karts.find(k => k.human === 0);
function hostStart() {
  const c = net.cfg, humans = net.players.slice(0, 8);
  const used = new Set(humans.map(p => p.racer));
  const ai = c.ai ? RACERS.filter(r => !used.has(r.id)).slice(0, 8 - humans.length).map(r => ({ racer: r.id, owner: 'ai', name: r.name })) : [];
  const grid = [...ai.sort(() => Math.random() - 0.5), ...humans.map(p => ({ racer: p.racer, owner: p.id, name: p.name, own: !!p.own }))];
  const msg = { t: 'start', grid, ti: c.ti, mirror: c.mirror, laps: c.laps, items: c.items, cls: c.cls };
  net.inRace = true; netBroadcast(msg); netLobby();
  startRace('online', c.ti, { online: msg });
}
const R2 = v => Math.round(v * 100) / 100;
function netRaceTick(dt) {
  net.sendT += dt; if (net.sendT < 0.05) return; net.sendT = 0;
  if (net.role === 'host') {
    netBroadcast({ t: 'snap', ph: race.phase, pt: R2(race.phaseT), rt: R2(race.t),
      k: karts.map(k => [k.slotIdx, R2(k.x), R2(k.y), R2(k.z), R2(k.h), R2(k.speed), k.drift, R2(k.charge), R2(k.boostT), R2(k.spinT), R2(k.spinA), R2(k.starT), R2(k.shrinkT), k.air ? 1 : 0, R2(k.steerVis), R2(k.prog), k.lap, k.place, k.finished ? 1 : 0, R2(k.finishT), k.coins, k.item || '']),
      o: objs.map(o => { if (!o.id) o.id = ++net.objId; return [o.id, o.kind, R2(o.x), R2(o.y), R2(o.z), R2(o.h || 0), R2(o.t), o.fly || 0, R2(o.vx || 0), R2(o.vz || 0)]; }),
      bx: world.boxes.map(b => b.gone > 0 ? 1 : 0).join(''), cn: world.coins.map(c => c.gone > 0 ? 1 : 0).join('') });
  } else {
    const k = myKart(); if (!k) return;
    netSend('host', { t: 'st', x: R2(k.x), y: R2(k.y), z: R2(k.z), h: R2(k.h), speed: R2(k.speed), drift: k.drift, charge: R2(k.charge), boostT: R2(k.boostT), spinT: R2(k.spinT), spinA: R2(k.spinA), starT: R2(k.starT), shrinkT: R2(k.shrinkT), air: k.air ? 1 : 0, steerVis: R2(k.steerVis), prog: R2(k.prog), lap: k.lap, fin: k.finished ? 1 : 0, finT: R2(k.finishT), coins: k.coins, item: k.item || '' });
  }
}
function applySnap(s) {
  if (s.ph !== race.phase) { if (s.ph === 'race' && race.phase !== 'race') onGo(); race.phase = s.ph; race.phaseT = s.pt; }
  if (Math.abs(race.phaseT - s.pt) > 0.25) race.phaseT = s.pt;
  if (Math.abs(race.t - s.rt) > 0.25) race.t = s.rt;
  for (const a of s.k) {
    const k = karts[a[0]]; if (!k) continue;
    k.place = a[17];
    if (!k.remote) continue;
    k.net = { x: a[1], y: a[2], z: a[3], h: a[4], speed: a[5], drift: a[6], charge: a[7], boostT: a[8], spinT: a[9], spinA: a[10], starT: a[11], shrinkT: a[12], air: a[13], steerVis: a[14], prog: a[15], lap: a[16], fin: a[18], finT: a[19], coins: a[20], item: a[21] };
    k.netT = t;
  }
  const old = new Map(objs.map(o => [o.id, o]));
  objs = s.o.map(([id, kind, x, y, z, h, ot, fly, vx, vz]) => { const o = old.get(id) || { id, kind, x, y, z }; Object.assign(o, { kind, h, t: ot, fly, vx, vz, tx: x, ty: y, tz: z }); if (!old.has(id)) { o.x = x; o.y = y; o.z = z; } return o; });
  world.boxes.forEach((b, i) => { b.gone = s.bx[i] === '1' ? 1 : 0; });
  world.coins.forEach((c, i) => { c.gone = s.cn[i] === '1' ? 1 : 0; });
}
function followNet(k, dt) {
  const n = k.net; if (!n) return;
  const age = Math.min(0.25, t - k.netT), f = 1 - Math.exp(-dt * 14);
  const tx = n.x + Math.sin(n.h) * n.speed * age, tz = n.z + Math.cos(n.h) * n.speed * age;
  if (Math.hypot(tx - k.x, tz - k.z) > 25) { k.x = tx; k.z = tz; k.y = n.y; } else { k.x += (tx - k.x) * f; k.z += (tz - k.z) * f; k.y += (n.y - k.y) * f; }
  k.h += wrapA(n.h - k.h) * f; k.vh = k.h;
  k.speed = n.speed; k.drift = n.drift; k.charge = n.charge; k.boostT = n.boostT; k.spinT = n.spinT; k.spinA = n.spinA; k.starT = n.starT; k.shrinkT = n.shrinkT; k.air = !!n.air; k.steerVis = n.steerVis; k.coins = n.coins; k.item = n.item || null;
  k.prog = n.prog; k.lap = n.lap;
  k.scale = lerp(k.scale, k.shrinkT > 0 ? 0.6 : 1, dt * 6);
  k.i = findIndex(k); k.wheelRot += k.speed * dt / 0.36;
  k.offroad = Math.abs(trackInfo(k.x, k.z, k.i).lat) > world.half + 0.6;
  if (net.role === 'host' && n.fin && !k.finished) { k.finished = true; k.finishT = n.finT; race.finishOrder.push(k); k.place = race.finishOrder.length; }
  if (net.role === 'client') { k.finished = !!n.fin; k.finishT = n.finT; }
}
function updateNetObjs(dt) { for (const o of objs) { if (o.tx === undefined) continue; if (o.vx || o.vz) { o.tx += o.vx * dt; o.tz += o.vz * dt; } const f = 1 - Math.exp(-dt * 15); o.x += (o.tx - o.x) * f; o.y += (o.ty - o.y) * f; o.z += (o.tz - o.z) * f; } }

// ------------------------------------------------------------ grand prix
function startGP() { save.gp = { cls: save.cls, p1: save.p1, race: 0, points: {}, results: [] }; store(); startRace('gp', 0, { gp: save.gp }); }
function saveGP() { store(); }
function nextGPRace() {
  const gp = save.gp; gp.race++;
  if (gp.race >= TRACKS.length) { finishGP(); return; }
  // grid order: reverse standings so the leader starts at the back
  const stand = standings(); const order = stand.slice().reverse().map(s => RACERS.find(r => r.id === s.id));
  store(); startRace('gp', gp.race, { gp, gridOrder: order });
}
function standings() { const gp = save.gp; return RACERS.map(r => ({ id: r.id, r, pts: gp.points[r.id] || 0 })).sort((a, b) => b.pts - a.pts); }
let trophy = null;
function finishGP() {
  const st = standings(), place = st.findIndex(s => s.id === save.gp.p1) + 1;
  const cup = place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : null;
  const rank = { gold: 3, silver: 2, bronze: 1 }, cls = CLASSES[save.gp.cls].id;
  if (cup && (!save.trophies[cls] || rank[cup] > rank[save.trophies[cls]])) save.trophies[cls] = cup;
  trophy = { st, place, cup, t: 0 };
  save.gp = null; store();
  state = 'trophy'; Sound.playSong(place <= 3 ? SONGS.kwin : SONGS.klose);
  if (place <= 3) SND.finish(1);
}

// ------------------------------------------------------------ cameras + drawing
function camShake(k, a) { const c = CAMS.find(c => c.k === k); if (c) c.shake = Math.max(c.shake, a); }
function updateCam(c, dt, snap) {
  const cd = [0.78, 1, 1.28][SET().cam], k = c.k, back = (6.4 + Math.min(1.5, k.speed * 0.03)) * cd, up = (2.7 + Math.min(1, k.speed * 0.02)) * (0.85 + cd * 0.15);
  let h = k.h + (k.drift ? -k.drift * 0.18 : 0);
  if (k.lookBack && state === 'race' && race.phase !== 'intro') { h += Math.PI; const e = [k.x - Math.sin(h) * back, k.y + up, k.z - Math.cos(h) * back]; c.eye = e; c.at = [k.x + Math.sin(h) * 3, k.y + 1.3, k.z + Math.cos(h) * 3]; c.wasBack = true; return; }
  if (c.wasBack) { c.wasBack = false; snap = true; }
  if (state === 'race' && race.phase === 'intro') {
    const a = race.phaseT * 0.5 + 1.2, r = 26 - race.phaseT * 5;
    c.eye = [k.x + Math.sin(k.h + a) * r, k.y + 8 - race.phaseT * 1.6, k.z + Math.cos(k.h + a) * r]; c.at = [k.x, k.y + 1, k.z]; c.fov = 1.05; return;
  }
  const want = [k.x - Math.sin(h) * back, k.y + up, k.z - Math.cos(h) * back];
  const f = snap ? 1 : 1 - Math.exp(-dt * 7);
  for (let i = 0; i < 3; i++) c.eye[i] = lerp(c.eye[i], want[i], i === 1 ? 1 - Math.exp(-dt * 5) : f);
  const at = [k.x + Math.sin(k.h) * 3, k.y + 1.3, k.z + Math.cos(k.h) * 3];
  for (let i = 0; i < 3; i++) c.at[i] = lerp(c.at[i], at[i], snap ? 1 : 1 - Math.exp(-dt * 12));
  // keep the camera above the ground
  const n = world.nearestAny(c.eye[0], c.eye[2], 30); if (n) c.eye[1] = Math.max(c.eye[1], world.P[n.i].y + 1.2);
  c.fov = lerp(c.fov, (1.08 + (k.boostT > 0 ? 0.2 : 0) + Math.max(0, k.speed - 20) * 0.006) * [0.88, 1, 1.14][SET().fov], dt * 4);
  c.shake = Math.max(0, c.shake - dt * 2);
}
function kartMatrix(k) {
  const pitch = k.air ? -k.vy * 0.02 : -Math.atan((world.P[k.i].slope || 0)) * 0;
  const roll = (k.drift ? k.drift * 0.12 : 0) + k.steerVis * 0.03 * Math.min(1, k.speed / 15);
  const yaw = k.h + (k.drift ? k.drift * 0.32 : 0) + k.spinA + (k.trickT > 0 ? (0.5 - k.trickT) / 0.5 * Math.PI * 2 : 0);
  const squash = k.landT > 0 ? 1 - k.landT * 0.5 : 1;
  let m = M4.mul(M4.trans(k.x, k.y + (k.drift && !k.air ? Math.abs(Math.sin(t * 30)) * 0.03 : 0), k.z), M4.rotY(yaw));
  m = M4.mul(m, M4.rotX(pitch)); m = M4.mul(m, M4.rotZ(roll)); m = M4.mul(m, M4.scale(k.scale, k.scale * squash, k.scale));
  return m;
}
const KSPEC = { spec: 0.75 };
function drawKart(k, m, tint, emi, depth) {
  const wl = KART_WHEELS[k.racer.id] || [];
  if (depth) R.shadowDraw(MESH[k.mesh], m); else R.draw(MESH[k.mesh], m, tint, emi, false, KSPEC);
  for (const [wx, wy, wz, r, w, front] of wl) {
    let wm = M4.mul(m, M4.trans(wx, wy, wz));
    if (front) wm = M4.mul(wm, M4.rotY(k.steerVis * 0.45));
    wm = M4.mul(wm, M4.rotX(k.wheelRot * 0.36 / r)); wm = M4.mul(wm, M4.rotZ(Math.PI / 2)); wm = M4.mul(wm, M4.scale(r * 2, w, r * 2));
    if (depth) R.shadowDraw(MESH.wheel, wm); else R.draw(MESH.wheel, wm, tint, 0, false, { spec: 0.35 });
  }
}
function drawWorld(view, cam) {
  const e = world.env;
  const shk = cam.shake ? [rand(-1, 1) * cam.shake * 0.3, rand(-1, 1) * cam.shake * 0.3, 0] : [0, 0, 0];
  // shadow map around what the camera looks at
  const mats = karts.map(k => kartMatrix(k));
  if (SET().shadows) {
    const fdir = [cam.at[0] - cam.eye[0], 0, cam.at[2] - cam.eye[2]], fl = Math.hypot(fdir[0], fdir[2]) || 1;
    const focus = [cam.at[0] + fdir[0] / fl * 30, cam.at[1], cam.at[2] + fdir[2] / fl * 30];
    R.shadowBegin(focus, e.sun, 62);
    R.shadowDraw(worldMesh.st);
    karts.forEach((k, i) => drawKart(k, mats[i], null, 0, true));
    R.shadowEnd();
  } else R.shadowsOff();
  R.begin(view, { eye: [cam.eye[0] + shk[0], cam.eye[1] + shk[1], cam.eye[2]], at: cam.at, fov: cam.fov }, e);
  R.sky(worldMesh.sky);
  R.draw(worldMesh.st);
  const pulse = 0.75 + 0.25 * Math.sin(t * 8);
  R.draw(worldMesh.bm, null, [pulse, pulse, pulse], 0);
  // animated scenery
  for (const d of world.dyn) {
    if (d.mesh === 'blades') R.draw(MESH.blades, M4.mul(M4.compose(d.x, d.y, d.z, d.ry), M4.mul(M4.rotZ(t * d.spin), M4.scale(d.s, d.s, d.s))));
    else R.draw(MESH.balloon, M4.compose(d.x + Math.sin(t * 0.1 + d.float) * 20, d.y + Math.sin(t * 0.5 + d.float) * 3, d.z + Math.cos(t * 0.08 + d.float) * 20, t * 0.1, d.s, d.s, d.s), d.tint, 0, false, { spec: 0.3 });
  }
  // item boxes + coins
  const boxList = race && race.items === false ? [] : world.boxes;
  for (const b of boxList) {
    if (b.gone > 0 && b.gone >= 0.4) continue;
    const sc = b.gone > 0 ? (0.4 - b.gone) * 2.5 : 1, y = b.y + Math.sin(t * 2 + b.ph) * 0.25;
    R.draw(MESH.boxCore, M4.compose(b.x, y, b.z, -t * 2 + b.ph, sc, sc, sc), [1, 1, 1], 1);
  }
  for (const c of world.coins) { if (c.gone > 0) continue; R.draw(MESH.coin, M4.compose(c.x, c.y + Math.sin(t * 3 + c.i) * 0.15, c.z, t * 3 + c.i), null, 0, false, { spec: 1 }); }
  // items in the world
  for (const o of objs) {
    if (o.kind === 'oil') R.draw(MESH.oil, M4.trans(o.x, o.y + 0.1, o.z));
    else if (o.kind === 'orb') R.draw(MESH.orb, M4.compose(o.x, o.y, o.z, t * 5));
    else if (o.kind === 'rocket') R.draw(MESH.rocket, M4.compose(o.x, o.y, o.z, o.h));
    else if (o.kind === 'bomb') { const blink = o.t > o.fly && Math.sin(o.t * (10 + o.t * 12)) > 0; R.draw(MESH.bomb, M4.trans(o.x, o.y, o.z), blink ? [3, 0.6, 0.6] : null, blink ? 0.3 : 0); }
  }
  // karts
  karts.forEach((k, i) => {
    const star = k.starT > 0, tint = star ? [1 + 0.8 * Math.sin(t * 20), 1 + 0.8 * Math.sin(t * 20 + 2), 1 + 0.8 * Math.sin(t * 20 + 4)] : k.hitFlash > 0 ? [2, 2, 2] : null;
    drawKart(k, mats[i], tint, star ? 0.25 : 0);
  });
  // glass item boxes (see-through, drawn after solid things)
  for (const b of boxList) {
    if (b.gone > 0 && b.gone >= 0.4) continue;
    const sc = b.gone > 0 ? (0.4 - b.gone) * 2.5 : 1;
    R.draw(MESH.box, M4.mul(M4.compose(b.x, b.y + Math.sin(t * 2 + b.ph) * 0.25, b.z, t * 1.4 + b.ph, sc, sc, sc), M4.rotX(0.5)), null, 0, false, { spec: 0.9, alpha: 0.55 });
  }
  // flat transparent stuff: shadows + skid marks
  const f = [];
  const push = (p, c) => f.push(p[0], p[1], p[2], c[0], c[1], c[2], c[3]);
  if (!SET().shadows) for (const k of karts) {
    const info = trackInfo(k.x, k.z, k.i), gy = info.y + 0.1 + (world.rampIdx.some(r => ((k.i - r + world.N) % world.N) < 5) ? 1.5 : 0);
    const sh = Math.max(0.15, 0.45 - (k.y - info.y) * 0.05);
    for (let s = 0; s < 12; s++) { const a0 = s / 12 * 6.283, a1 = (s + 1) / 12 * 6.283, rx = 1.1 * k.scale, rz = 1.6 * k.scale; const cs = Math.cos(k.h), sn = Math.sin(k.h);
      const p = (a) => [k.x + (Math.cos(a) * rx) * cs + (Math.sin(a) * rz) * sn, Math.min(gy, k.y + 0.12), k.z - (Math.cos(a) * rx) * sn + (Math.sin(a) * rz) * cs];
      push([k.x, Math.min(gy, k.y + 0.12), k.z], [0, 0, 0, sh]); push(p(a0), [0, 0, 0, 0]); push(p(a1), [0, 0, 0, 0]); }
  }
  for (const [a, b] of skids) {
    const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.16, nz = dx / l * 0.16, c = [0.05, 0.05, 0.06, 0.4];
    push([a[0] - nx, a[1], a[2] - nz], c); push([a[0] + nx, a[1], a[2] + nz], c); push([b[0] + nx, b[1], b[2] + nz], c);
    push([a[0] - nx, a[1], a[2] - nz], c); push([b[0] + nx, b[1], b[2] + nz], c); push([b[0] - nx, b[1], b[2] - nz], c);
  }
  // star glow rings
  R.flat(f);
  // particles
  const pa = [], pn = [];
  for (const p of parts) { const c = hexRGB(p.col), a = 1 - p.t / p.life, s = p.size * (p.add ? 1 : 1 + p.t * 1.5); (p.add ? pa : pn).push(p.x, p.y, p.z, c[0], c[1], c[2], p.add ? a : a * 0.6, s); }
  R.points(pn, false); R.points(pa, true);
  R.end();
}

// ------------------------------------------------------------ 2D UI helpers
function txt(s, x, y, size, col = '#fff', align = 'left', o = {}) {
  ctx.font = `${o.italic ? 'italic ' : ''}${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeCol || '#000'; ctx.strokeText(s, x, y); }
  else if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(s, x + size * 0.06 + 1, y + size * 0.06 + 1); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function panel(x, y, w, h, o = {}) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  rr(x, y, w, h, o.r || 18); ctx.fillStyle = o.fill || 'rgba(14,18,34,0.82)'; ctx.fill(); ctx.restore();
  rr(x, y, w, h, o.r || 18); ctx.lineWidth = 3; ctx.strokeStyle = o.border || 'rgba(255,255,255,0.18)'; ctx.stroke();
}
function button(id, x, y, w, h, label, o = {}) {
  const over = mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h && !o.disabled;
  if (over) UI.hover = id;
  const s = over ? 1.04 : 1, cx = x + w / 2, cy = y + h / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  const base = o.disabled ? '#3a3f50' : (o.color || '#ff7a1a');
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  rr(x, y, w, h, o.r || 14); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shadeHex(base, 0.25)); g.addColorStop(1, shadeHex(base, -0.2)); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  rr(x + 3, y + 3, w - 6, h * 0.42, (o.r || 14) - 3); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
  if (o.selected) { rr(x - 4, y - 4, w + 8, h + 8, (o.r || 14) + 4); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
  if (o.draw) o.draw(x, y, w, h);
  if (label) txt(label, cx, cy - (o.size || 24) * 0.55, o.size || 24, o.disabled ? '#8a8fa0' : '#ffffff', 'center');
  ctx.restore();
  const c = UI.click;
  if (c && !o.disabled && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { UI.click = null; Sound.play(o.sfx || 'click'); return true; }
  return false;
}
function shadeHex(h, f) { const c = hexRGB(h).map(v => v * 255); const k = v => Math.round(clamp(f < 0 ? v * (1 + f) : v + (255 - v) * f, 0, 255)); return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`; }
function toast(k, s, col = '#fff', dur = 2) { toasts.push({ k, s, col, t: 0, dur }); }
function itemIcon(id, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  const it = ITEMS[id];
  if (id === 'turbo' || id === 'turbo3') {
    const n = id === 'turbo3' ? 3 : 1;
    for (let k = 0; k < n; k++) { ctx.save(); ctx.translate((k - (n - 1) / 2) * 26, 0); ctx.rotate(-0.5);
      ctx.fillStyle = '#e83a3a'; rr(-12, -30, 24, 50, 10); ctx.fill(); ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.moveTo(-12, -24); ctx.quadraticCurveTo(0, -48, 12, -24); ctx.fill();
      ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.moveTo(-10, 20); ctx.lineTo(0, 44); ctx.lineTo(10, 20); ctx.fill(); ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(-5, 20); ctx.lineTo(0, 34); ctx.lineTo(5, 20); ctx.fill(); ctx.restore(); }
  } else if (id === 'oil') { ctx.fillStyle = '#2a2236'; ctx.beginPath(); ctx.ellipse(0, 8, 40, 22, 0, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.ellipse(-22, 0, 16, 12, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#8a6ad8'; ctx.beginPath(); ctx.ellipse(8, 2, 14, 5, -0.3, 0, 6.3); ctx.fill(); }
  else if (id === 'bouncer') { const g = ctx.createRadialGradient(-10, -12, 4, 0, 0, 36); g.addColorStop(0, '#d8ffd8'); g.addColorStop(0.4, '#4ae85a'); g.addColorStop(1, '#1a7a2a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 6.3); ctx.fill(); }
  else if (id === 'homing') { ctx.rotate(-0.6); ctx.fillStyle = '#e83a3a'; rr(-12, -26, 24, 52, 8); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-12, -24); ctx.quadraticCurveTo(0, -50, 12, -24); ctx.fill(); ctx.fillStyle = '#ffcc33'; ctx.fillRect(-22, 12, 44, 8); ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(0, -4, 7, 0, 6.3); ctx.fill(); }
  else if (id === 'bomb') { ctx.fillStyle = '#22222c'; ctx.beginPath(); ctx.arc(0, 6, 32, 0, 6.3); ctx.fill(); ctx.fillStyle = '#6a6a7a'; ctx.fillRect(-9, -32, 18, 12); ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -32); ctx.quadraticCurveTo(10, -46, 20, -40); ctx.stroke(); ctx.fillStyle = '#ffe03a'; ctx.beginPath(); ctx.arc(21, -41, 6, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-12, -6, 8, 0, 6.3); ctx.fill(); }
  else if (id === 'shield') { ctx.fillStyle = `hsl(${(t * 300) % 360},90%,60%)`; ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 16 : 38, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-6, -6, 5, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(8, -6, 5, 0, 6.3); ctx.fill(); }
  else if (id === 'zap') { ctx.fillStyle = '#ffe03a'; ctx.strokeStyle = '#8ad8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, -42); ctx.lineTo(-20, 6); ctx.lineTo(0, 6); ctx.lineTo(-10, 42); ctx.lineTo(22, -8); ctx.lineTo(2, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function coinIcon(x, y, r) { ctx.fillStyle = '#c8901a'; ctx.beginPath(); ctx.arc(x, y + 2, r, 0, 6.3); ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - r * 0.15, y - r * 0.55, r * 0.3, r * 1.1); }

// ------------------------------------------------------------ HUD
function drawHUD(view, k) {
  const s = view.h / 720, X = view.x, Y = view.y, Wv = view.w;
  ctx.save();
  // item box
  const bx = X + Wv / 2 - 60 * s, by = Y + 18 * s, bs = 120 * s;
  rr(bx, by, bs, bs, 22 * s); ctx.fillStyle = 'rgba(10,14,30,0.7)'; ctx.fill(); ctx.lineWidth = 5 * s; ctx.strokeStyle = k.item ? '#ffffff' : 'rgba(255,255,255,0.35)'; ctx.stroke();
  if (k.item) {
    if (k.rouletteT > 0) { const ids = Object.keys(ITEMS); itemIcon(ids[Math.floor(t * 14) % ids.length], bx + bs / 2, by + bs / 2, 80 * s); }
    else { itemIcon(k.item, bx + bs / 2, by + bs / 2, 84 * s); if (k.item === 'turbo3') txt('x' + k.itemN, bx + bs - 8 * s, by + bs - 30 * s, 22 * s, '#fff', 'right', { stroke: 4 * s }); }
  }
  // lap + time
  txt(`LAP ${Math.min(k.lap, race.laps)}/${race.laps}`, X + 26 * s, Y + 20 * s, 34 * s, '#ffffff', 'left', { stroke: 6 * s, italic: true });
  txt(fmtT(k.finished ? k.finishT : race.t), X + 28 * s, Y + 64 * s, 22 * s, '#ffe680', 'left', { stroke: 5 * s });
  k.lapTimes.forEach((lt, i) => txt(`${i + 1}  ${fmtT(lt)}`, X + 30 * s, Y + (96 + i * 24) * s, 16 * s, '#c8d8ff', 'left', { stroke: 4 * s }));
  // coins
  coinIcon(X + 44 * s, Y + view.h - 46 * s, 18 * s); txt(String(k.coins), X + 72 * s, Y + view.h - 64 * s, 30 * s, k.coins >= 10 ? '#ffe03a' : '#ffffff', 'left', { stroke: 6 * s });
  // position
  if (race.mode !== 'tt') {
    const pc = k.place === 1 ? '#ffe03a' : k.place === 2 ? '#d8e0f0' : k.place === 3 ? '#ff9a4a' : '#ffffff';
    const px = race.humans === 2 ? X + 260 * s : X + Wv - 70 * s;
    txt(String(k.place), px, Y + view.h - 128 * s, 110 * s, pc, 'right', { stroke: 10 * s, italic: true });
    txt(ORD(k.place).slice(-2).toUpperCase(), px + 4 * s, Y + view.h - 112 * s, 38 * s, pc, 'left', { stroke: 7 * s, italic: true });
  }
  // speed + drift charge
  const mph = SET().units === 'mph', spd = Math.round(Math.max(0, k.speed) * 3.6 * (mph ? 0.621 : 1));
  if (race.humans === 1) txt(`${spd} ${mph ? 'mph' : 'km/h'}`, X + Wv - 26 * s, Y + 22 * s, 22 * s, '#ffffff', 'right', { stroke: 5 * s, italic: true });
  if (k.drift) { const lvl = k.charge > 3.2 ? 3 : k.charge > 2.0 ? 2 : k.charge > 1.0 ? 1 : 0; const cols = ['#9aa0b0', '#4ab8ff', '#ff9a2a', '#d86aff']; const w = 180 * s, x0 = X + Wv / 2 - w / 2, y0 = Y + view.h - 50 * s;
    rr(x0, y0, w, 14 * s, 7 * s); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); rr(x0, y0, w * Math.min(1, k.charge / 3.2), 14 * s, 7 * s); ctx.fillStyle = cols[lvl]; ctx.fill();
    txt(['DRIFT', 'MINI TURBO', 'SUPER TURBO', 'ULTRA TURBO'][lvl], X + Wv / 2, y0 - 26 * s, 18 * s, cols[lvl], 'center', { stroke: 4 * s }); }
  if (k.wrongT > 1.2 && !k.finished) txt('WRONG WAY!', X + Wv / 2, Y + view.h * 0.35, 46 * s, '#ff4a4a', 'center', { stroke: 8 * s, italic: true });
  // toasts for this kart
  toasts.filter(m => m.k === k).slice(-2).forEach((m, i) => { const a = Math.min(1, m.t * 5, (m.dur - m.t) * 3); ctx.globalAlpha = a; const sc = 1 + Math.max(0, 0.15 - m.t); txt(m.s, X + Wv / 2, Y + view.h * 0.24 + i * 54 * s - (sc - 1) * 40, 44 * s * sc, m.col, 'center', { stroke: 8 * s, italic: true }); ctx.globalAlpha = 1; });
  // countdown
  if (race.phase === 'count') { const n = 3 - Math.floor(race.phaseT), u = race.phaseT % 1; ctx.globalAlpha = 1 - u * 0.6; txt(String(n), X + Wv / 2, Y + view.h * 0.3 - u * 20, (140 + u * 60) * s, ['#ff4a4a', '#ffb03a', '#ffe03a'][3 - n], 'center', { stroke: 12 * s, italic: true }); ctx.globalAlpha = 1;
    if (k.human >= 0 && race.humans === 1) txt('Hold the gas just before GO for a rocket start!', X + Wv / 2, Y + view.h * 0.62, 18 * s, '#ffffff', 'center', { stroke: 4 * s }); }
  if (race.phase === 'race' && race.phaseT < 1) { ctx.globalAlpha = 1 - race.phaseT; txt('GO!', X + Wv / 2, Y + view.h * 0.28, 160 * s, '#5aff5a', 'center', { stroke: 14 * s, italic: true }); ctx.globalAlpha = 1; }
  if (race.phase === 'intro') { txt(TRACKS[race.ti].name.toUpperCase(), X + Wv / 2, Y + view.h * 0.7, 56 * s, '#ffffff', 'center', { stroke: 10 * s, italic: true }); txt(race.mode === 'gp' ? `GRAND PRIX - RACE ${race.ti + 1} OF ${TRACKS.length}   ${CLS().name}` : race.mode === 'tt' ? 'TIME TRIAL' : `${CLS().name}`, X + Wv / 2, Y + view.h * 0.7 + 66 * s, 22 * s, '#ffe680', 'center', { stroke: 5 * s }); }
  if (race.humans === 2) txt(k.human === 0 ? 'P1' : 'P2', X + 220 * s, Y + 20 * s, 34 * s, k.human === 0 ? '#5ad8ff' : '#ff6ab0', 'left', { stroke: 6 * s, italic: true });
  ctx.restore();
}
function drawMinimap(x, y, size) {
  const P = world.P, w = world.maxX - world.minX, h = world.maxZ - world.minZ, sc = size / Math.max(w, h);
  const mx = p => x + (p.x - world.minX) * sc + (size - w * sc) / 2, mz = p => y + (p.z - world.minZ) * sc + (size - h * sc) / 2;
  ctx.save(); ctx.lineJoin = 'round';
  ctx.beginPath(); P.forEach((p, i) => { if (i) ctx.lineTo(mx(p), mz(p)); else ctx.moveTo(mx(p), mz(p)); }); ctx.closePath();
  ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(mx(P[0]) - 5, mz(P[0]) - 5, 10, 10);
  karts.slice().sort((a, b) => (a.human >= 0) - (b.human >= 0)).forEach(k => { const px = x + (k.x - world.minX) * sc + (size - w * sc) / 2, pz = y + (k.z - world.minZ) * sc + (size - h * sc) / 2; ctx.fillStyle = k.racer.body; ctx.beginPath(); ctx.arc(px, pz, k.human >= 0 ? 8 : 5.5, 0, 6.3); ctx.fill(); ctx.lineWidth = k.human >= 0 ? 3 : 1.5; ctx.strokeStyle = k.human >= 0 ? '#ffffff' : '#000'; ctx.stroke(); });
  ctx.restore();
}

// ------------------------------------------------------------ screens
let menuDemo = null;
function demoTick(dt) {
  // attract mode: AI karts race around the menu track
  if (!menuDemo || !world) return;
  if (!race || race.mode !== 'demo') return;
  race.phase = 'race';
  for (const k of karts) { k.human = -1; const c = aiControls(k); if (c.item && k.item) useItem(k); updateKart(k, dt, c); }
  updateObjs(dt);
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= (p.g || 0) * dt; }
  parts = parts.filter(p => p.t < p.life);
  menuDemo.t += dt;
  if (menuDemo.t > menuDemo.next) { menuDemo.next = menuDemo.t + 6; menuDemo.kart = pick(karts); menuDemo.style = (menuDemo.style + 1) % 3; }
}
function startDemo(ti) {
  staticMeshes(); loadTrack(ti);
  karts = []; objs = []; parts = []; skids = [];
  const P = world.P, N = world.N;
  RACERS.forEach((r, slot) => { const k = makeKart(r, -1, slot), i = (N - 6 - slot * 9) % N, p = P[i]; k.x = p.x + p.rx * (slot % 2 ? 3 : -3); k.z = p.z + p.rz * (slot % 2 ? 3 : -3); k.y = p.y; k.h = k.vh = Math.atan2(p.tx, p.tz); k.i = i; k.prog = i; k.speed = 15; k.ai.skill = 0.82 + slot * 0.012; karts.push(k); });
  race = { mode: 'demo', ti, t: 0, phase: 'race', phaseT: 9, laps: 99, humans: 0, finishOrder: [] };
  menuDemo = { t: 0, next: 6, kart: karts[0], style: 0, cam: { eye: [0, 20, 0], at: [0, 0, 0], fov: 1.0, shake: 0 } };
}
function drawDemo(dt) {
  if (!menuDemo) return;
  const k = menuDemo.kart, c = menuDemo.cam;
  if (menuDemo.style === 0) { c.k = k; updateCam(c, dt, false); }
  else if (menuDemo.style === 1) { const a = menuDemo.t * 0.3; c.eye = [k.x + Math.sin(a) * 9, k.y + 3, k.z + Math.cos(a) * 9]; c.at = [k.x, k.y + 1, k.z]; c.fov = 0.9; }
  else { const p = world.P[(k.i + 30) % world.N]; c.eye = [p.x + p.rx * (world.WALL + 3), p.y + 4, p.z + p.rz * (world.WALL + 3)]; c.at = [k.x, k.y + 1, k.z]; c.fov = 0.8; }
  drawWorld({ x: 0, y: 0, w: W, h: H }, c);
}
function showroom(dt, racer, right) {
  // the chosen kart spinning on the start line
  if (!menuDemo) return;
  const P = world.P, p = P[Math.floor(world.N * 0.02)];
  let k = karts.find(x => x.showroom);
  if (!k) { k = makeKart(racer, -1, 0); k.showroom = true; karts.push(k); }
  karts = [k]; k.racer = racer; k.mesh = 'kart_' + racer.id;
  k.x = p.x; k.z = p.z; k.y = p.y; k.h = t * 0.6; k.i = Math.floor(world.N * 0.02); k.speed = 0; k.drift = 0; k.steerVis = Math.sin(t) * 0.5; k.wheelRot += dt * 2;
  const c = menuDemo.cam; c.eye = [p.x + p.tx * 8 - p.rx * 2.5, p.y + 2.8, p.z + p.tz * 8 - p.rz * 2.5]; c.at = [p.x + p.rx * 3.2, p.y + 1.2, p.z + p.rz * 3.2]; c.fov = 0.72; c.shake = 0;
  drawWorld({ x: 0, y: 0, w: W, h: H }, c);
}
function logo(y) {
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.04);
  const t1 = 'TURBO', t2 = 'KARTS';
  ctx.font = `italic 108px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 22; ctx.strokeStyle = '#1a1030'; ctx.strokeText(t1, -10, 0);
  const g = ctx.createLinearGradient(0, -50, 0, 50); g.addColorStop(0, '#fff07a'); g.addColorStop(0.5, '#ffb01a'); g.addColorStop(1, '#ff5a1a'); ctx.fillStyle = g; ctx.fillText(t1, -10, 0);
  ctx.font = `italic 74px ${FONT}`; ctx.lineWidth = 18; ctx.strokeText(t2, 60, 76);
  const g2 = ctx.createLinearGradient(0, 40, 0, 110); g2.addColorStop(0, '#8af0ff'); g2.addColorStop(1, '#3a7ae8'); ctx.fillStyle = g2; ctx.fillText(t2, 60, 76);
  ctx.restore();
}
let screenT = 0, sel = { mode: 'quick', pickFor: 1 };
function drawTitle() {
  logo(118);
  const bx = 70, bw = 380, y0 = 226;
  const gp = save.gp;
  if (gp) { if (button('cont', W - 420, 376, 380, 70, `CONTINUE CUP (RACE ${gp.race + 2})`, { color: '#2ac85a', size: 22 })) { save.cls = gp.cls; save.p1 = gp.p1; nextGPRace(); } }
  if (button('gp', bx, y0, bw, 62, 'GRAND PRIX', { color: '#ff7a1a', size: 28 })) { sel.mode = 'gp'; sel.pickFor = 1; go('chars'); }
  if (button('quick', bx, y0 + 70, bw, 56, 'QUICK RACE', { color: '#3a8ae8', size: 24 })) { sel.mode = 'quick'; sel.pickFor = 1; go('chars'); }
  if (button('vs', bx, y0 + 134, bw, 56, '2 PLAYER', { color: '#e83a8a', size: 24 })) { sel.mode = 'vs'; sel.pickFor = 1; go('chars'); }
  if (button('online', bx, y0 + 198, bw, 56, 'ONLINE', { color: '#1ab8a8', size: 24 })) { net.screen = net.role ? net.screen : 'menu'; go('online'); }
  if (button('tt', bx, y0 + 262, bw, 56, 'TIME TRIAL', { color: '#8a4ae8', size: 24 })) { sel.mode = 'tt'; sel.pickFor = 1; go('chars'); }
  CLASSES.forEach((c, i) => { if (button('cls' + i, bx + i * 130, y0 + 334, 120, 44, c.name, { color: save.cls === i ? '#2ac85a' : '#3a3f58', size: 18, selected: save.cls === i, sfx: 'tab' })) { save.cls = i; store(); } });
  if (button('set', bx, y0 + 392, bw, 46, 'SETTINGS', { color: '#4a5070', size: 20 })) openSettings('title');
  // trophies
  panel(W - 420, 470, 380, 210);
  txt('TROPHIES', W - 230, 488, 22, '#ffe680', 'center');
  CLASSES.forEach((c, i) => { const tr = save.trophies[c.id], x = W - 360 + i * 120; trophyIcon(x, 560, 0.55, tr); txt(c.name, x, 612, 16, '#c8d0e8', 'center'); });
  txt(`Races ${save.races}   Wins ${save.wins}`, W - 230, 642, 15, '#a8b0c8', 'center');
  const B = save.binds.p1;
  txt(`Drive: ${keyName(B.up)}${keyName(B.left)}${keyName(B.down)}${keyName(B.right)} / arrows   Drift: ${keyName(B.drift)}   Item: ${keyName(B.item)}   Look back: ${keyName(B.back)}`, W / 2, H - 28, 15, '#ffffff', 'center', { stroke: 4 });
}
const KEYNAMES = { Space: 'SPACE', Enter: 'ENTER', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', Tab: 'TAB', Backspace: 'BKSP', CapsLock: 'CAPS' };
function keyName(c) { if (!c) return '-'; if (KEYNAMES[c]) return KEYNAMES[c]; if (c.startsWith('Key')) return c.slice(3); if (c.startsWith('Digit')) return c.slice(5); if (c.startsWith('Numpad')) return 'NUM' + c.slice(6); return c.toUpperCase().slice(0, 6); }

// ------------------------------------------------------------ settings screen
let setTab = 0, setFrom = 'title', capture = null, confirmReset = 0;
function openSettings(from) { setFrom = from; capture = null; confirmReset = 0; state = 'settings'; }
function applySettings() { R.setScale(SET().res); Sound.setVolumes(SET().music, SET().sfx); store(); }
function drawSettings() {
  ctx.fillStyle = 'rgba(8,10,26,0.72)'; ctx.fillRect(0, 0, W, H);
  txt('SETTINGS', W / 2, 22, 44, '#ffffff', 'center', { stroke: 8, italic: true });
  ['CONTROLS', 'GAME', 'GRAPHICS', 'AUDIO'].forEach((n, i) => { if (button('tab' + i, 150 + i * 250, 86, 230, 50, n, { color: setTab === i ? '#ff7a1a' : '#3a3f58', size: 20, selected: setTab === i, sfx: 'tab' })) { setTab = i; capture = null; } });
  panel(110, 152, 1060, 470);
  const S = SET(); let y = 176;
  const row = (label, value, onPrev, onNext, desc) => {
    txt(label, 150, y + 10, 22, '#ffffff');
    if (desc) txt(desc, 150, y + 38, 13, '#9aa2c0');
    if (button('p' + label, 640, y, 56, 48, '<', { color: '#3a3f58', size: 24, sfx: 'tab' })) { onPrev(); applySettings(); }
    txt(value, 840, y + 10, 22, '#ffe680', 'center');
    if (button('n' + label, 984, y, 56, 48, '>', { color: '#3a3f58', size: 24, sfx: 'tab' })) { onNext(); applySettings(); }
    y += 62;
  };
  const toggle = (label, key, desc) => row(label, S[key] ? 'ON' : 'OFF', () => S[key] = !S[key], () => S[key] = !S[key], desc);
  const cycle = (label, key, list, names, desc) => { const i = Math.max(0, list.indexOf(S[key])); row(label, names[i], () => S[key] = list[(i - 1 + list.length) % list.length], () => S[key] = list[(i + 1) % list.length], desc); };
  const slider = (label, key) => {
    txt(label, 150, y + 10, 22, '#ffffff');
    const x0 = 520, w = 420; rr(x0, y + 16, w, 14, 7); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); rr(x0, y + 16, w * S[key], 14, 7); ctx.fillStyle = '#ff9a2a'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x0 + w * S[key], y + 23, 14, 0, 6.3); ctx.fill();
    txt(Math.round(S[key] * 100) + '%', 1000, y + 10, 22, '#ffe680');
    if (UI.down && mouse.y > y && mouse.y < y + 48 && mouse.x > x0 - 20 && mouse.x < x0 + w + 20) { S[key] = clamp((mouse.x - x0) / w, 0, 1); applySettings(); }
    y += 62;
  };
  if (setTab === 0) {
    txt('ACTION', 150, y, 18, '#9aa2c0'); txt('PLAYER 1', 620, y, 18, '#5ad8ff', 'center'); txt('PLAYER 2', 900, y, 18, '#ff6ab0', 'center'); y += 34;
    const NAMES = { up: 'Gas', down: 'Brake / reverse', left: 'Steer left', right: 'Steer right', drift: 'Drift / hop', item: 'Use item', back: 'Look behind' };
    ACTIONS.forEach(a => {
      txt(NAMES[a], 150, y + 8, 20, '#ffffff');
      ['p1', 'p2'].forEach((p, j) => {
        const on = capture && capture.p === p && capture.a === a;
        if (button(`kb${p}${a}`, 500 + j * 280, y, 240, 42, on ? 'PRESS A KEY...' : keyName(save.binds[p][a]), { color: on ? '#ff7a1a' : '#2a3048', size: on ? 16 : 20, sfx: 'tab' })) capture = { p, a };
      });
      y += 50;
    });
    txt('Click a key, then press the new key (ESC cancels). In single player both columns work.', W / 2, 568, 15, '#9aa2c0', 'center');
    if (button('kbreset', 150, 590, 260, 26, 'RESET CONTROLS', { color: '#5a3a3a', size: 14 })) { save.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); store(); }
  } else if (setTab === 1) {
    cycle('Laps', 'laps', [1, 2, 3, 4, 5, 7, 10], ['1', '2', '3', '4', '5', '7', '10'], 'Quick race, 2 player and time trial');
    toggle('Mirror mode', 'mirror', 'Tracks are flipped left to right');
    toggle('Items', 'items', 'Turn off for a pure racing skill test');
    cycle('Computer racers', 'ai', [0, 1, 2, 3, 4, 5, 6, 7], ['0', '1', '2', '3', '4', '5', '6', '7'], 'In quick race and 2 player');
    row('Auto gas', save.autoGas ? 'ON' : 'OFF', () => save.autoGas = !save.autoGas, () => save.autoGas = !save.autoGas, 'Accelerate without holding a key');
    cycle('Speed units', 'units', ['kmh', 'mph'], ['KM/H', 'MPH']);
    toggle('Minimap', 'minimap');
  } else if (setTab === 2) {
    toggle('Shadows', 'shadows', 'Real-time shadows (turn off if the game is slow)');
    cycle('Resolution', 'res', [0.5, 0.75, 1, 1.5], ['50%', '75%', '100%', '150%'], 'Lower is faster, higher is sharper');
    cycle('Particles', 'particles', ['low', 'high'], ['LOW', 'HIGH']);
    cycle('Camera distance', 'cam', [0, 1, 2], ['CLOSE', 'NORMAL', 'FAR']);
    cycle('Field of view', 'fov', [0, 1, 2], ['NARROW', 'NORMAL', 'WIDE']);
    toggle('Show FPS', 'fps');
  } else {
    slider('Music volume', 'music');
    slider('Sound effects', 'sfx');
    slider('Engine sound', 'engine');
    row('Music', Sound.musicOn ? 'ON' : 'OFF', () => Sound.setMusic(!Sound.musicOn), () => Sound.setMusic(!Sound.musicOn));
    row('Sound effects', Sound.sfxOn ? 'ON' : 'OFF', () => Sound.setSfx(!Sound.sfxOn), () => Sound.setSfx(!Sound.sfxOn));
    y += 10;
    if (button('wipe', 150, y, 360, 48, confirmReset ? 'CLICK AGAIN TO ERASE' : 'ERASE ALL SAVED DATA', { color: confirmReset ? '#c82a2a' : '#5a3a3a', size: 17 })) {
      if (confirmReset) { localStorage.removeItem(SAVE_KEY); location.reload(); } else confirmReset = 1;
    }
  }
  if (button('sback', W / 2 - 150, 640, 300, 58, 'DONE', { color: '#2ac85a', size: 26, sfx: 'back' })) { capture = null; store(); state = setFrom; }
}

// ------------------------------------------------------------ online screens
function drawOnline() {
  txt('ONLINE', W / 2, 22, 44, '#ffffff', 'center', { stroke: 8, italic: true });
  if (net.screen === 'menu' || !net.role && net.screen !== 'connecting') {
    panel(70, 100, 560, 520);
    txt('YOUR NAME', 100, 124, 18, '#9aa2c0');
    if (button('fname', 100, 150, 500, 56, myName() + (net.field === 'name' && Math.sin(t * 8) > 0 ? '_' : ''), { color: net.field === 'name' ? '#3a4a78' : '#2a3048', size: 24, sfx: 'tab' })) net.field = 'name';
    if (button('host', 100, 236, 500, 72, 'HOST A ROOM', { color: '#1ab8a8', size: 28 })) hostRoom();
    txt('OR JOIN WITH A ROOM CODE', 100, 330, 18, '#9aa2c0');
    if (button('fcode', 100, 356, 300, 64, (net.codeInput || (net.field === 'code' ? '' : 'CODE')) + (net.field === 'code' && Math.sin(t * 8) > 0 ? '_' : ''), { color: net.field === 'code' ? '#3a4a78' : '#2a3048', size: 32, sfx: 'tab' })) net.field = 'code';
    if (button('join', 410, 356, 190, 64, 'JOIN', { color: net.codeInput.length === 5 ? '#2ac85a' : '#3a3f58', size: 28, disabled: net.codeInput.length !== 5 })) joinRoom(net.codeInput);
    if (net.error) txt(net.error, 100, 440, 18, '#ff8a8a');
    txt('Click a box and type. Share your room code with friends', 100, 490, 15, '#c8d0e8');
    txt('so they can race you from their own computer.', 100, 512, 15, '#c8d0e8');
    txt('Up to 8 players. Empty spots can be filled by the computer.', 100, 540, 15, '#c8d0e8');
    if (button('oback', 100, 560, 200, 46, 'BACK', { color: '#3a3f58', size: 20, sfx: 'back' })) { net.field = 'code'; go('title'); }
    return;
  }
  if (net.screen === 'connecting') {
    panel(W / 2 - 300, 260, 600, 200);
    txt(net.role === 'host' ? 'Creating room...' : `Joining room ${net.code}...`, W / 2, 300, 28, '#ffffff', 'center');
    txt(NetTransport.status.text || 'Connecting to the online service', W / 2, 346, 16, '#9aa2c0', 'center');
    if (button('ccancel', W / 2 - 100, 390, 200, 50, 'CANCEL', { color: '#3a3f58', size: 20, sfx: 'back' })) { netReset(); net.screen = 'menu'; }
    return;
  }
  // lobby
  const isHost = net.role === 'host', c = net.cfg;
  panel(40, 96, 560, 590);
  txt('ROOM CODE', 70, 116, 18, '#9aa2c0');
  txt(net.code, 70, 140, 64, '#5affe8', 'left', { stroke: 8 });
  if (NetTransport.local) txt('(same-computer test mode)', 330, 170, 13, '#9aa2c0');
  txt(`PLAYERS ${net.players.length}/8`, 70, 230, 18, '#9aa2c0');
  net.players.forEach((p, i) => {
    const r = RACERS.find(q => q.id === p.racer) || RACERS[0], y = 258 + i * 46;
    rr(64, y - 4, 512, 40, 10); ctx.fillStyle = p.id === net.myId ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'; ctx.fill();
    ctx.fillStyle = r.body; ctx.beginPath(); ctx.arc(88, y + 16, 12, 0, 6.3); ctx.fill();
    txt(p.name, 110, y + 4, 22, '#ffffff'); if (ownOK(p.name, p.own)) ownTag(118 + ctx.measureText(p.name).width, y + 5, 24); txt(r.name, 400, y + 6, 18, r.body);
    if (p.id === 'host') txt('HOST', 560, y + 8, 15, '#ffe680', 'right'); else if (p.id === net.myId) txt('YOU', 560, y + 8, 15, '#8aff6a', 'right');
    else if (isHost && button('kick' + p.id, 506, y + 2, 54, 30, 'KICK', { color: '#6a2a2a', size: 12 })) { netSend(p.id, { t: 'closed' }); if (net.tr.kick) net.tr.kick(p.id); netPlayerLeft(p.id); }
  });
  if (net.inRace) txt('A race is in progress...', 70, 640, 18, '#ffe680');
  // right side
  panel(640, 96, 600, 590);
  const me = net.players.find(p => p.id === net.myId), myR = me ? me.racer : save.p1, ri = RACERS.findIndex(r => r.id === myR);
  txt('YOUR RACER', 670, 116, 18, '#9aa2c0');
  const pickR = d => { let i = ri; for (let n = 0; n < 8; n++) { i = (i + d + 8) % 8; if (!net.players.some(p => p.id !== net.myId && p.racer === RACERS[i].id)) break; } save.p1 = RACERS[i].id; store(); if (isHost) { me.racer = save.p1; netLobby(); } else netSend('host', { t: 'pick', racer: save.p1 }); };
  if (button('rp', 670, 142, 56, 50, '<', { color: '#3a3f58', size: 24, sfx: 'tab' })) pickR(-1);
  txt(RACERS[ri] ? RACERS[ri].name : '', 900, 150, 30, RACERS[ri] ? RACERS[ri].body : '#fff', 'center', { stroke: 6, italic: true });
  if (button('rn', 1074, 142, 56, 50, '>', { color: '#3a3f58', size: 24, sfx: 'tab' })) pickR(1);
  let y = 214;
  const opt = (label, value, prev, next) => {
    txt(label, 670, y + 12, 20, '#ffffff');
    if (isHost && button('op' + label, 860, y, 46, 42, '<', { color: '#3a3f58', size: 20, sfx: 'tab' })) { prev(); netLobby(); }
    txt(value, 1010, y + 12, 20, '#ffe680', 'center');
    if (isHost && button('on' + label, 1114, y, 46, 42, '>', { color: '#3a3f58', size: 20, sfx: 'tab' })) { next(); netLobby(); }
    y += 52;
  };
  opt('Track', TRACKS[c.ti].name, () => c.ti = (c.ti + TRACKS.length - 1) % TRACKS.length, () => c.ti = (c.ti + 1) % TRACKS.length);
  opt('Laps', String(c.laps), () => c.laps = Math.max(1, c.laps - 1), () => c.laps = Math.min(10, c.laps + 1));
  opt('Class', CLASSES[c.cls].name, () => c.cls = (c.cls + 2) % 3, () => c.cls = (c.cls + 1) % 3);
  opt('Items', c.items ? 'ON' : 'OFF', () => c.items = !c.items, () => c.items = !c.items);
  opt('Mirror', c.mirror ? 'ON' : 'OFF', () => c.mirror = !c.mirror, () => c.mirror = !c.mirror);
  opt('Computer racers', c.ai ? 'FILL' : 'NONE', () => c.ai = !c.ai, () => c.ai = !c.ai);
  rr(670, y + 4, 230, 150, 12); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); miniTrack(TRACKS[c.ti], 680, y + 12, 210, 134);
  if (isHost) { if (button('ostart', 930, y + 40, 280, 76, 'START RACE', { color: '#2ac85a', size: 28, disabled: net.inRace })) hostStart(); }
  else txt('Waiting for the host to start...', 1060, y + 66, 17, '#c8d0e8', 'center');
  if (button('oleave', 70, 620, 200, 50, 'LEAVE', { color: '#6a2a2a', size: 20, sfx: 'back' })) { if (isHost) netBroadcast({ t: 'closed' }); leaveOnline(); }
}
function drawOnlineMenu() {
  ctx.fillStyle = 'rgba(8,10,24,0.55)'; ctx.fillRect(0, 0, W, H);
  panel(W / 2 - 200, 220, 400, 260);
  txt('ONLINE RACE', W / 2, 244, 32, '#ffffff', 'center', { stroke: 6, italic: true });
  txt('The race keeps going while this is open', W / 2, 290, 14, '#9aa2c0', 'center');
  if (button('omres', W / 2 - 150, 320, 300, 56, 'BACK TO RACE', { color: '#2ac85a', size: 22 })) race.menu = false;
  if (button('omleave', W / 2 - 150, 392, 300, 56, 'LEAVE ROOM', { color: '#6a2a2a', size: 22, sfx: 'back' })) { if (net.role === 'host') netBroadcast({ t: 'closed' }); leaveOnline(); }
}
function drawNames(view, cam) {
  // name tags over other players' karts
  if (!cam) return;
  for (const k of karts) {
    if (k.owner === 'ai' || k.human === 0) continue;
    const p = R.project([k.x, k.y + 2.8, k.z], view); if (!p) continue;
    const d = Math.hypot(k.x - cam.eye[0], k.z - cam.eye[2]); if (d > 120) continue;
    const s = clamp(30 / d, 0.5, 1.2);
    txt(k.name, p[0], p[1] - 20 * s, 18 * s, k.racer.body, 'center', { stroke: 4 * s });
    if (ownOK(k.name, k.own)) ownTag(p[0], p[1] - 46 * s, 22 * s, 'center');
  }
}
function trophyIcon(x, y, s, kind) {
  const col = { gold: '#ffcc33', silver: '#d8dde8', bronze: '#d8844a' }[kind] || '#3a3f58';
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-40, -50); ctx.lineTo(40, -50); ctx.quadraticCurveTo(40, 20, 0, 26); ctx.quadraticCurveTo(-40, 20, -40, -50); ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(-40, -26, 18, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(40, -26, 18, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  ctx.fillRect(-8, 24, 16, 22); ctx.fillRect(-30, 44, 60, 14);
  if (kind) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-26, -42, 10, 40); }
  else { txt('?', 0, -42, 44, '#5a5f78', 'center', { shadow: false }); }
  ctx.restore();
}
let hoverRacer = null;
function drawChars() {
  const who = sel.pickFor;
  txt(sel.mode === 'vs' ? `PLAYER ${who}: CHOOSE YOUR RACER` : 'CHOOSE YOUR RACER', W / 2, 26, 40, who === 2 ? '#ff6ab0' : '#ffffff', 'center', { stroke: 8, italic: true });
  const r0 = RACERS.find(r => r.id === (who === 2 ? save.p2 : save.p1)) || RACERS[0];
  hoverRacer = null;
  RACERS.forEach((r, i) => {
    const cw = 136, x = 54 + (i % 4) * (cw + 12), y = 110 + Math.floor(i / 4) * 150;
    const chosen = r === r0, taken = sel.mode === 'vs' && who === 2 && r.id === save.p1;
    if (mouse.x >= x && mouse.x < x + cw && mouse.y >= y && mouse.y < y + 136) hoverRacer = r;
    if (button('r' + r.id, x, y, cw, 136, '', { color: taken ? '#2a2f40' : r.body, selected: chosen, disabled: taken, sfx: 'tab', draw: (X, Y) => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(X + cw / 2, Y + 54, 34, 0, 6.3); ctx.fill();
      ctx.fillStyle = r.helmet; ctx.beginPath(); ctx.arc(X + cw / 2, Y + 52, 28, 0, 6.3); ctx.fill(); ctx.fillStyle = '#1a2030'; rr(X + cw / 2 - 18, Y + 46, 36, 14, 6); ctx.fill(); ctx.fillStyle = r.body; ctx.fillRect(X + cw / 2 - 4, Y + 22, 8, 22);
      txt(r.name, X + cw / 2, Y + 96, 20, '#ffffff', 'center', { stroke: 4 }); if (taken) txt('P1', X + cw / 2, Y + 8, 16, '#5ad8ff', 'center'); } })) {
      if (who === 2) save.p2 = r.id; else save.p1 = r.id; store();
    }
  });
  // stats of the selected racer
  const sr = hoverRacer || r0;
  panel(54, 420, 580, 200);
  txt(sr.name, 80, 438, 34, sr.body, 'left', { stroke: 6, italic: true });
  [['SPEED', sr.speed], ['ACCEL', sr.accel], ['HANDLING', sr.handling], ['WEIGHT', sr.weight]].forEach(([n, v], i) => {
    txt(n, 80, 492 + i * 30, 17, '#c8d0e8'); for (let k = 0; k < 5; k++) { rr(220 + k * 56, 492 + i * 30, 50, 18, 6); ctx.fillStyle = k < v ? sr.body : 'rgba(255,255,255,0.12)'; ctx.fill(); }
  });
  if (button('back', 54, 640, 200, 56, 'BACK', { color: '#3a3f58', size: 22, sfx: 'back' })) { if (sel.mode === 'vs' && who === 2) sel.pickFor = 1; else go('title'); }
  if (button('next', 434, 640, 200, 56, 'NEXT', { color: '#2ac85a', size: 26 })) {
    if (sel.mode === 'vs' && who === 1) { sel.pickFor = 2; if (save.p2 === save.p1) save.p2 = RACERS.find(r => r.id !== save.p1).id; }
    else if (sel.mode === 'gp') startGP();
    else go('tracks');
  }
}
function drawTracks() {
  txt(sel.mode === 'tt' ? 'TIME TRIAL: PICK A TRACK' : 'PICK A TRACK', W / 2, 26, 40, '#ffffff', 'center', { stroke: 8, italic: true });
  TRACKS.forEach((T, i) => {
    const cw = 280, x = 52 + i * (cw + 14), y = 110;
    if (button('t' + i, x, y, cw, 420, '', { color: ['#3a9a3a', '#c8702a', '#3a7ad8', '#8a3ad8'][i], selected: sel.track === i, sfx: 'tab', draw: (X, Y) => {
      rr(X + 14, Y + 14, cw - 28, 220, 12); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      miniTrack(T, X + 24, Y + 24, cw - 48, 200);
      txt(T.name.toUpperCase(), X + cw / 2, Y + 252, 24, '#ffffff', 'center', { stroke: 5 });
      txt(T.desc, X + cw / 2, Y + 290, 14, '#ffffff', 'center');
      txt('BEST LAP', X + cw / 2, Y + 330, 14, '#ffe680', 'center'); txt(fmtT(save.bestLap[T.id]), X + cw / 2, Y + 350, 22, '#ffffff', 'center', { stroke: 4 });
      if (sel.mode === 'tt') { txt('BEST RACE', X + cw / 2, Y + 382, 14, '#ffe680', 'center'); txt(fmtT(save.bestRace[T.id]), X + cw / 2, Y + 398, 18, '#ffffff', 'center', { stroke: 4 }); }
    } })) { sel.track = i; startRace(sel.mode === 'tt' ? 'tt' : sel.mode === 'vs' ? 'vs' : 'quick', i); }
  });
  if (button('back', 52, 620, 200, 56, 'BACK', { color: '#3a3f58', size: 22, sfx: 'back' })) go('chars');
  txt('Click a track to race!', W / 2, 600, 20, '#ffffff', 'center', { stroke: 5 });
}
const miniCache = {};
function miniTrack(T, x, y, w, h) {
  if (!miniCache[T.id]) miniCache[T.id] = buildCenterline(T).pts;
  const P = miniCache[T.id]; let a = 1e9, b = -1e9, c = 1e9, d = -1e9; P.forEach(p => { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); });
  const sc = Math.min(w / (b - a), h / (d - c)), ox = x + (w - (b - a) * sc) / 2, oz = y + (h - (d - c) * sc) / 2;
  ctx.beginPath(); P.forEach((p, i) => { const X = ox + (p.x - a) * sc, Z = oz + (p.z - c) * sc; if (i) ctx.lineTo(X, Z); else ctx.moveTo(X, Z); }); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(ox + (P[0].x - a) * sc, oz + (P[0].z - c) * sc, 7, 0, 6.3); ctx.fill();
}
let resT = 0;
function drawResults(dt) {
  resT += dt;
  ctx.fillStyle = 'rgba(8,10,24,0.55)'; ctx.fillRect(0, 0, W, H);
  const gp = race.gp;
  txt(race.mode === 'tt' ? 'TIME TRIAL' : 'RESULTS', W / 2, 30, 48, '#ffffff', 'center', { stroke: 9, italic: true });
  const list = race.finishOrder;
  panel(W / 2 - 360, 100, 720, 46 + list.length * 52);
  list.forEach((k, i) => {
    const a = clamp((resT - i * 0.08) * 4, 0, 1); if (a <= 0) return;
    ctx.globalAlpha = a;
    const y = 122 + i * 52, hum = k.human >= 0;
    if (hum) { rr(W / 2 - 348, y - 6, 696, 46, 10); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill(); }
    txt(ORD(i + 1), W / 2 - 320, y, 26, i === 0 ? '#ffe03a' : i === 1 ? '#d8e0f0' : i === 2 ? '#ff9a4a' : '#ffffff', 'left', { stroke: 5, italic: true });
    ctx.fillStyle = k.racer.body; ctx.beginPath(); ctx.arc(W / 2 - 220, y + 16, 14, 0, 6.3); ctx.fill();
    const rName = (race.online && k.owner !== 'ai' ? k.name : k.racer.name) + (hum ? (race.humans === 2 ? ` (P${k.human + 1})` : ' (YOU)') : '');
    txt(rName, W / 2 - 194, y + 2, 24, hum ? '#ffe680' : '#ffffff', 'left', { stroke: 5 });
    if (k.own && (k.owner === 'me' || ownOK(k.name, k.own))) ownTag(W / 2 - 184 + ctx.measureText(rName).width, y + 4, 24);
    txt(fmtT(k.finishT), W / 2 + 150, y + 4, 22, '#c8d0e8', 'right', { stroke: 4 });
    if (gp) { txt(`+${GP_POINTS[i]}`, W / 2 + 230, y + 4, 22, '#8aff6a', 'right', { stroke: 4 }); txt(String(gp.points[k.racer.id] || 0), W / 2 + 330, y + 2, 26, '#ffffff', 'right', { stroke: 5 }); }
    ctx.globalAlpha = 1;
  });
  if (gp) txt('PTS', W / 2 + 330, 104, 14, '#a8b0c8', 'right');
  const by = Math.min(H - 76, 160 + list.length * 52);
  if (resT < 0.6) return;
  if (gp) { if (button('nxt', W / 2 - 150, by, 300, 62, gp.race + 1 >= TRACKS.length ? 'SEE RESULTS' : 'NEXT RACE', { color: '#2ac85a', size: 26 })) nextGPRace(); if (button('q', W / 2 + 170, by + 8, 160, 48, 'MENU', { color: '#3a3f58', size: 18, sfx: 'back' })) go('title'); }
  else if (race.online) {
    if (net.role === 'host') { if (button('lob', W / 2 - 150, by, 300, 62, 'BACK TO LOBBY', { color: '#1ab8a8', size: 24 })) { net.inRace = false; netBroadcast({ t: 'lobbyback' }); engines.stop(); go('online'); net.screen = 'lobby'; netLobby(); } }
    else txt('Waiting for the host...', W / 2, by + 18, 20, '#c8d0e8', 'center');
  }
  else {
    if (button('again', W / 2 - 330, by, 300, 62, 'RACE AGAIN', { color: '#2ac85a', size: 26 })) startRace(race.mode, race.ti);
    if (button('tr', W / 2 + 30, by, 300, 62, 'MENU', { color: '#3a3f58', size: 24, sfx: 'back' })) go('title');
  }
}
function drawTrophy(dt) {
  trophy.t += dt;
  // podium scene on the last track
  const P = world.P, p = P[Math.floor(world.N * 0.04)];
  const st = trophy.st.slice(0, 3);
  karts = st.map((s, i) => { const k = makeKart(s.r, s.id === save.p1 ? 0 : -1, i); const off = [0, -4.2, 4.2][i], hgt = [3.2, 2.2, 1.4][i]; k.x = p.x + p.rx * off; k.z = p.z + p.rz * off; k.y = p.y + hgt; k.h = Math.atan2(-p.tx, -p.tz) + Math.sin(t * 2 + i) * 0.2; k.i = Math.floor(world.N * 0.04); return k; });
  const c = { eye: [p.x - p.tx * 14, p.y + 5, p.z - p.tz * 14], at: [p.x, p.y + 2.5, p.z], fov: 0.8, shake: 0 };
  if (Math.random() < 0.6) parts.push({ x: p.x + rand(-8, 8), y: p.y + 12, z: p.z + rand(-3, 3), vx: rand(-1, 1), vy: -3, vz: rand(-1, 1), t: 0, life: 4, col: pick(['#ff5a5a', '#ffe03a', '#5ad8ff', '#6aff6a', '#ff6ab0']), size: 0.6, add: true });
  for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
  parts = parts.filter(q => q.t < q.life);
  R.shadowsOff(); R.begin({ x: 0, y: 0, w: W, h: H }, c, world.env); R.sky(worldMesh.sky); R.draw(worldMesh.st);
  R.draw(MESH.podium, M4.compose(p.x, p.y, p.z, Math.atan2(-p.tx, -p.tz)));
  for (const k of karts) drawKart(k, kartMatrix(k));
  const pa = []; for (const q of parts) { const cc = hexRGB(q.col); pa.push(q.x, q.y, q.z, cc[0], cc[1], cc[2], 1, q.size); } R.points(pa, true); R.end();
  // overlay
  const pl = trophy.place;
  txt(pl <= 3 ? 'CONGRATULATIONS!' : 'GRAND PRIX OVER', W / 2, 30, 52, pl <= 3 ? '#ffe03a' : '#ffffff', 'center', { stroke: 10, italic: true });
  txt(`You finished ${ORD(pl)} in the ${CLASSES[save.cls].name} cup`, W / 2, 96, 24, '#ffffff', 'center', { stroke: 5 });
  if (trophy.cup) { const s = Math.min(1, trophy.t * 2); trophyIcon(W - 170, 300, 1.4 * s, trophy.cup); txt(trophy.cup.toUpperCase() + ' TROPHY', W - 170, 400, 26, '#ffffff', 'center', { stroke: 5 }); }
  panel(40, 150, 300, 40 + trophy.st.length * 40);
  trophy.st.forEach((s, i) => { txt(`${i + 1}. ${s.r.name}`, 64, 166 + i * 40, 20, s.id === save.p1 ? '#ffe680' : '#ffffff', 'left', { stroke: 4 }); txt(String(s.pts), 316, 166 + i * 40, 20, '#ffffff', 'right', { stroke: 4 }); });
  if (trophy.t > 1.5 && button('m', W / 2 - 150, H - 100, 300, 64, 'MENU', { color: '#2ac85a', size: 26 })) go('title');
}
function drawPause() {
  ctx.fillStyle = 'rgba(8,10,24,0.6)'; ctx.fillRect(0, 0, W, H);
  panel(W / 2 - 220, 170, 440, 420);
  txt('PAUSED', W / 2, 196, 52, '#ffffff', 'center', { stroke: 9, italic: true });
  if (button('res', W / 2 - 160, 280, 320, 62, 'RESUME', { color: '#2ac85a', size: 26 })) resume();
  if (button('rst', W / 2 - 160, 356, 320, 54, 'RESTART RACE', { color: '#ff7a1a', size: 22 })) startRace(race.mode, race.ti, race.gp ? { gp: race.gp } : {});
  if (button('quit', W / 2 - 160, 424, 320, 54, race.gp ? 'SAVE & QUIT CUP' : 'QUIT', { color: '#3a3f58', size: 22, sfx: 'back' })) { engines.stop(); if (race.gp) { save.gp.race = race.ti - 1; store(); } go('title'); }
  if (button('pset', W / 2 - 160, 490, 320, 44, 'SETTINGS', { color: '#4a5070', size: 18 })) openSettings('pause');
  txt(race.gp ? 'Your cup is saved between races' : 'ESC to resume', W / 2, 560, 15, '#a8b0c8', 'center');
}
function pause() { state = 'pause'; engines.stop(); Sound.play('back'); }
function resume() { state = 'race'; engines.start(race.humans); Sound.play('click'); }
function go(s) {
  state = s; screenT = 0;
  if (s === 'title' || s === 'chars' || s === 'tracks' || s === 'online') {
    if (!race || race.mode !== 'demo') { startDemo(Math.floor(Math.random() * TRACKS.length)); }
    if (s === 'title') Sound.playSong(SONGS.kmenu);
  }
}

// ------------------------------------------------------------ audio
const engines = (() => {
  let list = [];
  function make() {
    const ac = Sound.ctx, out = Sound.sfxBus; if (!ac || !out) return null;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(out); o1.start(); o2.start();
    // tyre screech
    const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true; const bf = ac.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 3; const ng = ac.createGain(); ng.gain.value = 0;
    ns.connect(bf); bf.connect(ng); ng.connect(out); ns.start();
    return { o1, o2, f, g, ns, ng };
  }
  return {
    start(n) { this.stop(); if (!Sound.ready) return; for (let i = 0; i < n; i++) { const e = make(); if (e) list.push(e); } },
    stop() { list.forEach(e => { try { e.g.gain.value = 0; e.ng.gain.value = 0; e.o1.stop(); e.o2.stop(); e.ns.stop(); } catch (x) {} }); list = []; },
    update() {
      if (!list.length && Sound.ready && race && race.humans) this.start(race.humans);
      const hum = karts.filter(k => k.human >= 0).sort((a, b) => a.human - b.human);
      list.forEach((e, i) => {
        const k = hum[i]; if (!k) return; const ac = Sound.ctx, now = ac.currentTime;
        const sp = Math.abs(k.speed), gear = sp % 9 / 9, base = 55 + sp * 3.2 + gear * 28 + (k.boostT > 0 ? 30 : 0);
        e.o1.frequency.setTargetAtTime(base, now, 0.05); e.o2.frequency.setTargetAtTime(base * 0.502, now, 0.05);
        e.f.frequency.setTargetAtTime(500 + sp * 40, now, 0.1);
        e.g.gain.setTargetAtTime((k.finished ? 0.02 : 0.05 + Math.min(0.05, sp * 0.002)) * SET().engine, now, 0.1);
        e.ng.gain.setTargetAtTime(k.drift && !k.air ? 0.05 * SET().engine : 0, now, 0.05);
      });
    },
  };
})();
const near = k => k && k.human >= 0;
const SND = {
  hop: k => near(k) && Sound.blip(300, 0.08, { type: 'square', vol: 0.06, slide: 500 }),
  miniTurbo: (k, l) => near(k) && (Sound.hiss(0.4 + l * 0.15, { filter: 'bandpass', freq: 1200 + l * 400, sweep: 3000, q: 1, vol: 0.15 }), Sound.blip(400 + l * 200, 0.15, { type: 'square', vol: 0.06, slide: 900 })),
  trick: k => near(k) && [880, 1175].forEach((f, i) => Sound.blip(f, 0.08, { type: 'square', vol: 0.06, delay: i * 0.06 })),
  bump: k => near(k) && (Sound.hiss(0.12, { filter: 'lowpass', freq: 900, vol: 0.18 }), Sound.blip(90, 0.1, { type: 'square', vol: 0.08, slide: 50 })),
  boost: k => near(k) && Sound.hiss(0.6, { filter: 'bandpass', freq: 900, sweep: 3500, q: 1, vol: 0.18 }),
  turbo: k => near(k) && (Sound.hiss(0.7, { filter: 'bandpass', freq: 700, sweep: 3000, q: 1, vol: 0.2 }), Sound.blip(200, 0.3, { type: 'sawtooth', vol: 0.06, slide: 600, lp: 2000 })),
  spin: k => near(k) && (Sound.blip(600, 0.6, { type: 'square', vol: 0.07, slide: 150 }), Sound.hiss(0.4, { filter: 'bandpass', freq: 2000, q: 2, vol: 0.1 })),
  box: () => [523, 784, 1047].forEach((f, i) => Sound.blip(f, 0.08, { type: 'triangle', vol: 0.1, delay: i * 0.04 })),
  itemGot: () => Sound.blip(1319, 0.12, { type: 'square', vol: 0.06 }),
  coin: () => { Sound.blip(988, 0.06, { type: 'square', vol: 0.05 }); Sound.blip(1319, 0.12, { type: 'square', vol: 0.05, delay: 0.06 }); },
  drop: k => near(k) && Sound.blip(200, 0.12, { type: 'sine', vol: 0.1, slide: 90 }),
  shoot: k => near(k) && Sound.blip(500, 0.15, { type: 'square', vol: 0.07, slide: 200 }),
  bounce: () => {},
  rocket: k => near(k) && Sound.hiss(0.5, { filter: 'bandpass', freq: 600, sweep: 2500, q: 1, vol: 0.12 }),
  boom: (big) => { Sound.hiss(big ? 0.8 : 0.4, { filter: 'lowpass', freq: 900, sweep: 100, vol: big ? 0.25 : 0.12 }); Sound.blip(70, 0.3, { type: 'sine', vol: 0.12, slide: 35 }); },
  star: k => near(k) && [523, 659, 784, 1047, 1319].forEach((f, i) => Sound.blip(f, 0.08, { type: 'square', vol: 0.06, delay: i * 0.05 })),
  zap: () => { Sound.hiss(0.6, { freq: 6000, vol: 0.2 }); Sound.blip(150, 0.4, { type: 'sawtooth', vol: 0.1, slide: 1500, lp: 4000 }); },
  beep: go => Sound.blip(go ? 880 : 440, go ? 0.5 : 0.25, { type: 'square', vol: 0.12 }),
  lap: () => [784, 1047].forEach((f, i) => Sound.blip(f, 0.1, { type: 'square', vol: 0.07, delay: i * 0.08 })),
  finalLap: () => [659, 784, 988, 1319].forEach((f, i) => Sound.blip(f, 0.12, { type: 'square', vol: 0.08, delay: i * 0.1 })),
  finish: p => (p <= 3 ? [523, 659, 784, 1047, 784, 1047] : [392, 349, 330, 262]).forEach((f, i) => Sound.blip(f, 0.14, { type: 'square', vol: 0.08, delay: i * 0.1 })),
};

// ------------------------------------------------------------ main loop
let last = 0, fpsN = 0, fpsT = 0, fpsV = 0;
function frame(now) {
  NetTransport.frame();
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
  UI.hover = null;
  ctx.clearRect(0, 0, W, H);
  if (state === 'race') {
    updateRace(dt);
    CAMS.forEach(c => updateCam(c, dt, false));
    const views = race.humans === 2 ? [{ x: 0, y: 0, w: W, h: H / 2 }, { x: 0, y: H / 2, w: W, h: H / 2 }] : [{ x: 0, y: 0, w: W, h: H }];
    views.forEach((v, i) => drawWorld(v, CAMS[i]));
    views.forEach((v, i) => drawHUD(v, CAMS[i].k));
    if (race.humans === 2) { ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, H / 2 - 3, W, 6); if (SET().minimap) drawMinimap(W - 170, H / 2 - 80, 160); }
    else if (SET().minimap) drawMinimap(30, H - 270, 200);
    if (race.online) { drawNames(views[0], CAMS[0]); const pg = NetTransport.status.ping; txt(pg ? `ONLINE ${pg} ms` : 'ONLINE', W / 2, H - 26, 14, pg > 150 ? '#ffcc55' : '#7aff9a', 'center', { stroke: 3 }); }
    if (race.online && race.menu) drawOnlineMenu();
    if (flash > 0) { ctx.fillStyle = `rgba(200,230,255,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    if (touch.used && race.humans === 1) { ctx.globalAlpha = 0.35; rr(W - 290, H - 160, 130, 130, 20); ctx.fillStyle = '#ffffff'; ctx.fill(); rr(W - 145, H - 160, 130, 130, 20); ctx.fill(); ctx.globalAlpha = 1; txt('DRIFT', W - 225, H - 106, 20, '#000', 'center', { shadow: false }); txt('ITEM', W - 80, H - 106, 20, '#000', 'center', { shadow: false }); }
  } else if (state === 'settings' && setFrom === 'pause') {
    const views = race.humans === 2 ? [{ x: 0, y: 0, w: W, h: H / 2 }, { x: 0, y: H / 2, w: W, h: H / 2 }] : [{ x: 0, y: 0, w: W, h: H }];
    views.forEach((v, i) => drawWorld(v, CAMS[i]));
    drawSettings();
  } else if (state === 'pause') {
    const views = race.humans === 2 ? [{ x: 0, y: 0, w: W, h: H / 2 }, { x: 0, y: H / 2, w: W, h: H / 2 }] : [{ x: 0, y: 0, w: W, h: H }];
    views.forEach((v, i) => drawWorld(v, CAMS[i]));
    drawPause();
  } else if (state === 'results') {
    // keep the race running behind the results (AI finishes driving)
    for (const k of karts) updateKart(k, dt, aiControls(k));
    for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    parts = parts.filter(p => p.t < p.life);
    CAMS.forEach(c => updateCam(c, dt, false));
    if (CAMS[0]) drawWorld({ x: 0, y: 0, w: W, h: H }, CAMS[0]);
    drawResults(dt);
  } else if (state === 'trophy') {
    drawTrophy(dt);
  } else if (state === 'title' || state === 'chars' || state === 'tracks' || state === 'online' || (state === 'settings' && setFrom === 'title')) {
    screenT += dt;
    if (state === 'online') { if (karts.length > 1 || !karts[0] || !karts[0].showroom) karts = []; const me = net.players.find(p => p.id === net.myId); showroom(dt, RACERS.find(r => r.id === (me ? me.racer : save.p1)) || RACERS[0], true); }
    else if (state === 'chars') { if (karts.length > 1 || !karts[0] || !karts[0].showroom) karts = []; showroom(dt, hoverRacer || RACERS.find(r => r.id === (sel.pickFor === 2 ? save.p2 : save.p1)) || RACERS[0]); }
    else { if (karts.some(k => k.showroom)) startDemo(world.ti); demoTick(dt); drawDemo(dt); }
    const vg = ctx.createLinearGradient(0, 0, W * 0.6, 0); vg.addColorStop(0, 'rgba(8,10,30,0.55)'); vg.addColorStop(1, 'rgba(8,10,30,0)');
    if (state !== 'tracks') { ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); } else { ctx.fillStyle = 'rgba(8,10,30,0.45)'; ctx.fillRect(0, 0, W, H); }
    if (state === 'title') drawTitle(); else if (state === 'chars') drawChars(); else if (state === 'online') drawOnline(); else if (state === 'settings') drawSettings(); else drawTracks();
  }
  if (SET().fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { fpsV = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; } txt(fpsV + ' FPS', W - 12, H - 24, 14, '#8aff6a', 'right', { stroke: 3 }); }
  if (UI.hover && UI.hover !== UI.lastHover) Sound.play('hover');
  UI.lastHover = UI.hover; UI.click = null;
  for (const k in pressed) delete pressed[k];
  requestAnimationFrame(frame);
}
// keep online races running (and sending) while the tab is in the background
NetTransport.backgroundTicker(dt => { if (state === 'race' && race && race.online) { t += dt; updateRace(dt); } });
const fontReady = document.fonts ? Promise.race([document.fonts.load(`24px ${FONT}`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontReady.then(() => { applySettings(); go('title'); requestAnimationFrame(n => { last = n; frame(n); }); });

window.__kt = {
  get state() { return state; }, get race() { return race; }, get karts() { return karts; }, get world() { return world; }, save: () => save,
  startRace, go, startGP, nextGPRace, standings, useItem: k => useItem(k), get objs() { return objs; }, net, hostRoom, joinRoom, hostStart, openSettings, get SET() { return SET(); },
  sim(dt, n) { for (let i = 0; i < n; i++) { if (state !== 'race') return state; updateRace(dt); } CAMS.forEach(c => { for (let j = 0; j < 90; j++) updateCam(c, 1 / 60, false); }); return state; },
  setHumanAI(on) { this._ai = on; },
};

// ------------------------------------------------------------ owner cheats (only shown for the site admin, see account/cheats.js)
const inRace = () => state === 'race' && myKart() ? '' : 'Start a race first';
const giveIt = id => { const k = myKart(); k.item = id; k.itemN = id === 'turbo3' ? 3 : 1; k.rouletteT = 0; };
window.__cheats = [
  { name: 'Get a Triple Turbo', icon: '🚀', need: inRace, run() { giveIt('turbo3'); } },
  { name: 'Get a Homing Shell', icon: '🎯', need: inRace, run() { giveIt('homing'); } },
  { name: 'Get a Zap', icon: '⚡', need: inRace, run() { giveIt('zap'); } },
  { name: 'Get a Shield', icon: '🛡', need: inRace, run() { giveIt('shield'); } },
  { name: 'Mega boost', icon: '💨', need: inRace, run() { myKart().boostT = 3.5; } },
  { name: 'Star power', icon: '⭐', need: inRace, run() { myKart().starT = 8; } },
  { name: 'Gold trophy in every class', icon: '🏆', run() { CLASSES.forEach(c => save.trophies[c.id] = 'gold'); store(); } },
];

})();
