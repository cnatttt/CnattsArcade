// =====================================================================
//  ROCKET SOCCER - top-down car soccer. 1v1 or 2v2, vs CPU (3 levels),
//  2 players on one keyboard, or online (with friends JOIN support).
// =====================================================================
'use strict';
(() => {
const cv = document.getElementById('game');
const U = GameUI(cv), ctx = U.ctx, W = 1280, H = 720;
const { rr, txt, shade, rgba } = U;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ------------------------------------------------------------ field
const CX = 640, CY = 410, FW = 540, FH = 262, CR = 84, GH = 86, GD = 58;
const TEAM = [{ name: 'BLUE', col: '#3b82f6', light: '#93c5fd', dark: '#1e3a8a' }, { name: 'ORANGE', col: '#f97316', light: '#fdba74', dark: '#7c2d12' }];
const PADS = [];
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => PADS.push({ x: sx * (FW - 60), y: sy * (FH - 50), big: true }));
PADS.push({ x: 0, y: -FH + 40, big: true }, { x: 0, y: FH - 40, big: true });
[[-300, 0], [300, 0], [-160, -150], [160, -150], [-160, 150], [160, 150], [-420, -130], [420, -130], [-420, 130], [420, 130], [0, -110], [0, 110]].forEach(([x, y]) => PADS.push({ x, y, big: false }));

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_soccer';
let save = { wins: 0, losses: 0, goals: 0, matches: 0, bestWinHard: 0, set: { size: 1, cpu: 1, time: 180, name: '' }, colors: [0, 1] };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(save, s, { set: Object.assign(save.set, s.set || {}) }); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const myName = () => (window.Account && Account.user && Account.user.username) || 'Player';
const OWN = () => !!(window.Account && Account.isOwnerMe && Account.isOwnerMe());

// ------------------------------------------------------------ audio
SONGS.soccer = { seed: 314, bpm: 118, root: 57, scale: 'dorian', prog: [0, 5, 3, 4, 0, 5, 2, 4], density: 0.6, swing: 0.06,
  bass: 'x..x..x.x..x..x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', pad: true, arp: true, arpRate: 2, form: ['A', 'B', 'A', 'C'], inst: { drumVol: 0.85 } };
SONGS.soccerMenu = { seed: 77, bpm: 96, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.5, swing: 0.1,
  bass: 'x.....x...x.....', kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.', pad: true, arp: true, arpRate: 2, introNoLead: true, introNoDrums: true };
const sfx = {
  hit(p) { Sound.blip(130 + p * 160, 0.09, { type: 'sine', vol: 0.25 + p * 0.25, slide: 70 }); Sound.hiss(0.05, { filter: 'lowpass', freq: 2500, vol: 0.12 + p * 0.15 }); },
  bump() { Sound.blip(90, 0.08, { type: 'triangle', vol: 0.2, slide: 50 }); Sound.hiss(0.06, { filter: 'lowpass', freq: 900, vol: 0.12 }); },
  flip() { Sound.hiss(0.2, { filter: 'bandpass', freq: 900, sweep: 3000, q: 1, vol: 0.15 }); },
  boost() { Sound.hiss(0.09, { filter: 'bandpass', freq: 1400, q: 0.8, vol: 0.05 }); },
  pad(big) { Sound.blip(big ? 660 : 990, 0.08, { type: 'sine', vol: 0.12, slide: big ? 1320 : 1480 }); },
  beep(hi) { Sound.blip(hi ? 1320 : 880, hi ? 0.35 : 0.12, { type: 'sine', vol: 0.22 }); },
  goal() {
    Sound.hiss(1.6, { filter: 'bandpass', freq: 1200, q: 0.4, vol: 0.25, attack: 0.08 });
    [392, 494, 587, 784].forEach((f, i) => Sound.blip(f, 0.6, { type: 'sawtooth', vol: 0.06, lp: 2400, delay: i * 0.02 }));
    Sound.blip(110, 0.7, { type: 'sine', vol: 0.4, slide: 55 });
  },
  whistle() { Sound.blip(2400, 0.12, { type: 'sine', vol: 0.12, vib: 0.03 }); Sound.blip(2400, 0.4, { type: 'sine', vol: 0.12, vib: 0.03, delay: 0.16 }); },
};

// ------------------------------------------------------------ entities
let cars = [], ball = null, parts = [], pads = [], score = [0, 0], timeLeft = 180, overtime = false;
let phase = 'kickoff', phaseT = 0, lastTouch = -1, shake = 0, goalFx = null, winner = -1, matchSeconds = 0;
let screen = 'title', t = 0, match = null;   // match: { size, cpu, mode: 'cpu'|'local'|'online', time }

function makeCar(team, slot, ctrl, name) {
  return { team, slot, ctrl, name, x: 0, y: 0, a: 0, vx: 0, vy: 0, boost: 34, flipT: 0, flipCd: 0, boosting: false, own: false,
    in: { th: 0, st: 0, bo: false, fl: false }, ai: { t: 0, tx: 0, ty: 0 }, trail: [], goals: 0, saves: 0, shots: 0, hitT: 0 };
}
function kickoffPositions() {
  const spots = { 1: [[-330, 0]], 2: [[-300, -110], [-420, 120]] }[match.size];
  cars.forEach(c => {
    const s = spots[c.slot] || spots[0], sx = c.team === 0 ? 1 : -1;
    c.x = s[0] * sx; c.y = s[1] * (c.team === 0 ? 1 : -1); c.a = c.team === 0 ? 0 : Math.PI;
    c.vx = c.vy = 0; c.boost = Math.max(c.boost, 34); c.flipT = 0; c.trail = [];
  });
  ball = { x: 0, y: 0, vx: 0, vy: 0, r: 20, spin: 0, ang: 0, trail: [] };
  phase = 'kickoff'; phaseT = 0;
}
function startMatch(m) {
  match = m; score = [0, 0]; timeLeft = m.time; overtime = false; winner = -1; parts = []; matchSeconds = 0; goalFx = null;
  pads = PADS.map(p => Object.assign({ t: 0 }, p));
  cars = [];
  const humans = m.humans || [];   // [{team, ctrl, name, own}]
  for (let team = 0; team < 2; team++) for (let slot = 0; slot < m.size; slot++) {
    const h = humans.find(x => x.team === team && x.slot === slot);
    const c = makeCar(team, slot, h ? h.ctrl : 'cpu', h ? h.name : ['ROOKIE', 'PRO', 'ALL-STAR', 'LEGEND'][m.cpu] + (m.size > 1 ? ' ' + (slot + 1) : ''));
    c.own = !!(h && h.own); c.human = !!h; cars.push(c);
  }
  kickoffPositions();
  screen = 'play';
  Sound.playSong(SONGS.soccer);
}

// ------------------------------------------------------------ physics
const CAR_R = 22, MAXV = 380, BOOSTV = 600, ACC = 760, TURN = 3.5;
function arenaCollide(o, r, bounce) {
  // inside a goal mouth?
  const ax = Math.abs(o.x), sx = Math.sign(o.x) || 1;
  if (ax > FW - r && Math.abs(o.y) < GH) {
    // goal box walls
    if (o.y - r < -GH && ax > FW) { o.y = -GH + r; if (o.vy < 0) o.vy = -o.vy * bounce; }
    if (o.y + r > GH && ax > FW) { o.y = GH - r; if (o.vy > 0) o.vy = -o.vy * bounce; }
    if (ax + r > FW + GD) { o.x = sx * (FW + GD - r); if (o.vx * sx > 0) o.vx = -o.vx * bounce; }
  } else {
    const qx = ax - (FW - CR), qy = Math.abs(o.y) - (FH - CR);
    if (qx > 0 && qy > 0) {
      const d = Math.hypot(qx, qy);
      if (d + r > CR) {
        const nx = qx / d * sx, ny = qy / d * (Math.sign(o.y) || 1), pen = d + r - CR;
        o.x -= nx * pen; o.y -= ny * pen;
        const vn = o.vx * nx + o.vy * ny; if (vn > 0) { o.vx -= (1 + bounce) * vn * nx; o.vy -= (1 + bounce) * vn * ny; }
        return true;
      }
    } else {
      let hit = false;
      if (ax + r > FW) { o.x = sx * (FW - r); if (o.vx * sx > 0) o.vx = -o.vx * bounce; hit = true; }
      if (Math.abs(o.y) + r > FH) { const sy = Math.sign(o.y) || 1; o.y = sy * (FH - r); if (o.vy * sy > 0) o.vy = -o.vy * bounce; hit = true; }
      return hit;
    }
  }
  // goal posts
  for (const px of [-FW, FW]) for (const py of [-GH, GH]) {
    const dx = o.x - px, dy = o.y - py, d = Math.hypot(dx, dy), m = r + 7;
    if (d < m && d > 0) { const nx = dx / d, ny = dy / d; o.x = px + nx * m; o.y = py + ny * m; const vn = o.vx * nx + o.vy * ny; if (vn < 0) { o.vx -= (1 + bounce) * vn * nx; o.vy -= (1 + bounce) * vn * ny; } return true; }
  }
  return false;
}
function updateCar(c, dt, frozen) {
  const I = c.in, fx = Math.cos(c.a), fy = Math.sin(c.a);
  let vf = c.vx * fx + c.vy * fy, vl = -c.vx * fy + c.vy * fx;
  c.flipCd = Math.max(0, c.flipCd - dt); c.flipT = Math.max(0, c.flipT - dt); c.hitT = Math.max(0, c.hitT - dt);
  c.boosting = false;
  if (!frozen) {
    if (I.th > 0) vf += I.th * ACC * dt * (vf < 0 ? 2.2 : 1);
    else if (I.th < 0) vf += I.th * ACC * dt * (vf > 0 ? 2.2 : 0.7);
    else vf *= Math.exp(-dt * 0.9);
    if (I.bo && c.boost > 0) { vf += 1050 * dt; c.boost = Math.max(0, c.boost - 34 * dt); c.boosting = true; }
    const steerK = clamp(Math.abs(vf) / 140, 0, 1) * (vf >= 0 ? 1 : -1);
    c.a += I.st * TURN * dt * steerK * (c.boosting ? 0.85 : 1);
    if (I.fl && c.flipCd <= 0) {   // dodge: quick burst forward, extra kick on the ball
      c.flipCd = 1.1; c.flipT = 0.28; vf += 330; sfx.flip();
      for (let k = 0; k < 10; k++) parts.push({ x: c.x - fx * 20, y: c.y - fy * 20, vx: rand(-80, 80) - fx * 120, vy: rand(-80, 80) - fy * 120, t: 0, life: 0.4, s: rand(2, 4), col: '#e5e7eb' });
    }
  } else vf *= Math.exp(-dt * 6);
  I.fl = false;
  vl *= Math.exp(-dt * (c.flipT > 0 ? 3 : 9));
  const legend = !c.human && match && match.cpu === 3 ? 1.05 : 1;
  const cap = (c.boosting || c.flipT > 0 ? BOOSTV : MAXV) * legend;
  vf = clamp(vf, -MAXV * 0.55, cap);
  const nfx = Math.cos(c.a), nfy = Math.sin(c.a);
  c.vx = nfx * vf - nfy * vl; c.vy = nfy * vf + nfx * vl;
  const sp = Math.hypot(c.vx, c.vy); if (sp > cap * 1.05) { c.vx *= cap * 1.05 / sp; c.vy *= cap * 1.05 / sp; }
  c.x += c.vx * dt; c.y += c.vy * dt;
  if (arenaCollide(c, CAR_R, 0.35) && sp > 200) { shake = Math.max(shake, 0.08); }
  if (c.boosting) {
    for (let k = 0; k < 2; k++) parts.push({ x: c.x - nfx * 28 + rand(-4, 4), y: c.y - nfy * 28 + rand(-4, 4), vx: -nfx * rand(160, 320) + rand(-30, 30), vy: -nfy * rand(160, 320) + rand(-30, 30), t: 0, life: rand(0.18, 0.32), s: rand(3, 6), col: Math.random() < 0.5 ? '#fde68a' : TEAM[c.team].light, add: true });
    if (Math.random() < 0.2) sfx.boost();
  }
  c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 10) c.trail.shift();
  // pads
  pads.forEach(p => { if (p.t <= 0 && Math.hypot(c.x - p.x, c.y - p.y) < (p.big ? 30 : 22) && c.boost < 100) { c.boost = Math.min(100, c.boost + (p.big ? 100 : 14)); p.t = p.big ? 10 : 4; if (c.human) sfx.pad(p.big); } });
}
function carBall(c) {
  const dx = ball.x - c.x, dy = ball.y - c.y, d = Math.hypot(dx, dy), R = CAR_R + ball.r + (c.flipT > 0 ? 6 : 0);
  if (d >= R || d === 0) return;
  const nx = dx / d, ny = dy / d;
  ball.x = c.x + nx * R; ball.y = c.y + ny * R;
  const rvx = c.vx - ball.vx, rvy = c.vy - ball.vy, vn = rvx * nx + rvy * ny;
  const fx = Math.cos(c.a), fy = Math.sin(c.a), front = nx * fx + ny * fy;
  let power = Math.max(0, vn) * 1.55 + 70;
  if (front > 0.55) power += Math.max(0, c.vx * fx + c.vy * fy) * 0.35;
  if (c.flipT > 0) power *= 1.45;
  ball.vx += nx * power; ball.vy += ny * power;
  ball.spin += (rvx * ny - rvy * nx) * 0.01;
  c.vx -= nx * power * 0.12; c.vy -= ny * power * 0.12;
  const bs = Math.hypot(ball.vx, ball.vy); if (bs > 1250) { ball.vx *= 1250 / bs; ball.vy *= 1250 / bs; }
  if (c.hitT <= 0) { sfx.hit(clamp(power / 900, 0, 1)); c.hitT = 0.12; if (power > 650) shake = Math.max(shake, 0.12); }
  // shot on goal? (heading toward the other goal)
  const gx = c.team === 0 ? FW : -FW; if (Math.sign(ball.vx) === Math.sign(gx) && Math.abs(ball.vy / (ball.vx || 1) * (gx - ball.x)) < GH * 1.6) c.shots++;
  lastTouch = cars.indexOf(c);
}
function carCar(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), R = CAR_R * 2;
  if (d >= R || d === 0) return;
  const nx = dx / d, ny = dy / d, pen = (R - d) / 2;
  a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn > 0) { const j = vn * 0.9; a.vx -= nx * j; a.vy -= ny * j; b.vx += nx * j; b.vy += ny * j; if (vn > 160) sfx.bump(); }
}
function step(dt) {
  const frozen = phase === 'kickoff' && phaseT < 3;
  phaseT += dt;
  if (phase === 'kickoff') {
    const before = Math.ceil(3 - (phaseT - dt)), after = Math.ceil(3 - phaseT);
    if (after !== before && after >= 0 && phaseT < 3.05) sfx.beep(after === 0);
    if (phaseT >= 3) phase = 'live';
  }
  if (phase === 'goal') {
    // slow motion celebration
    dt *= 0.35;
    if (phaseT > 2.6) { if (winner >= 0) { endMatch(); return; } kickoffPositions(); }
  }
  if (phase === 'live' && !overtime) { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; if (score[0] === score[1]) { overtime = true; sfx.whistle(); } else { endMatch(); return; } } }
  matchSeconds += dt;
  cars.forEach(c => { if (c.ctrl === 'cpu') aiDrive(c, dt); });
  cars.forEach(c => updateCar(c, dt, frozen || phase === 'goal'));
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) carCar(cars[i], cars[j]);
  // ball
  ball.vx *= Math.exp(-dt * 0.32); ball.vy *= Math.exp(-dt * 0.32);
  const sub = 3;
  for (let s = 0; s < sub; s++) {
    ball.x += ball.vx * dt / sub; ball.y += ball.vy * dt / sub;
    if (arenaCollide(ball, ball.r, 0.78) && Math.hypot(ball.vx, ball.vy) > 220) sfx.bump();
    cars.forEach(carBall);
  }
  ball.ang += Math.hypot(ball.vx, ball.vy) * dt / ball.r * 0.6 + ball.spin * dt; ball.spin *= Math.exp(-dt * 2);
  ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 14) ball.trail.shift();
  pads.forEach(p => { p.t = Math.max(0, p.t - dt); });
  // goal?
  if (phase === 'live' && Math.abs(ball.x) > FW + ball.r * 0.6) scoreGoal(ball.x > 0 ? 0 : 1);
}
function scoreGoal(team) {
  score[team]++; phase = 'goal'; phaseT = 0; shake = 0.6;
  const sc = cars[lastTouch];
  if (sc) { if (sc.team === team) sc.goals++; }
  goalFx = { team, t: 0, scorer: sc && sc.team === team ? sc.name : TEAM[team].name, own: sc && sc.team !== team };
  sfx.goal();
  for (let k = 0; k < 140; k++) { const a = rand(0, 6.28), v = rand(100, 700); parts.push({ x: ball.x, y: ball.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.6, 1.6), s: rand(3, 8), col: Math.random() < 0.6 ? TEAM[team].col : '#ffffff', g: 0, drag: 2.2 }); }
  if (overtime) winner = team;
}
function endMatch() {
  winner = score[0] > score[1] ? 0 : 1; screen = 'over'; phaseT = 0;
  Sound.playSong(SONGS.soccerMenu); sfx.whistle();
  if (match.mode !== 'online' || NET.role) {
    const me = cars.find(c => c.ctrl === 'p1' || c.ctrl === 'net-me');
    if (me && match.mode !== 'local') {
      save.matches++; save.goals += me.goals;
      if (me.team === winner) { save.wins++; if (match.mode === 'cpu' && match.cpu === 2) save.bestWinHard++; } else save.losses++;
      store();
    }
  }
  { const me = cars.find(c => c.ctrl === 'p1' || c.ctrl === 'net-me' || c.ctrl === 'p1both'); if (window.Arcade && me && match.mode !== 'local') Arcade.event('soccer', 'match', { won: me.team === winner, goals: me.goals || 0, cpu: match.cpu });
    rankedFinish(); }
  if (NET.role === 'host') netSendState(true);
}

// ------------------------------------------------------------ CPU drivers (3 levels)
function aiDrive(c, dt) {
  const lvl = c.lvl != null ? c.lvl : match.cpu, I = c.in;
  c.ai.t -= dt;
  const attackX = c.team === 0 ? FW : -FW, ownX = -attackX;
  const mates = cars.filter(o => o.team === c.team);
  const closest = mates.reduce((b, o) => Math.hypot(o.x - ball.x, o.y - ball.y) < Math.hypot(b.x - ball.x, b.y - ball.y) ? o : b, mates[0]);
  if (c.ai.t <= 0) {
    c.ai.t = [0.32, 0.14, 0.03, 0.012][lvl];
    const err = [70, 28, 6, 1.5][lvl];
    // predict the ball a little
    const look = [0.08, 0.18, 0.22, 0.26][lvl];
    const bx = ball.x + ball.vx * look, by = ball.y + ball.vy * look;
    let tx, ty;
    const dangerous = Math.sign(ball.vx) === Math.sign(ownX) && Math.abs(ball.x - ownX) < 520;
    const behind = (c.x - bx) * Math.sign(attackX) > 0;   // car is between ball and opponent goal
    if (c !== closest && mates.length > 1) { tx = ownX * 0.72 + (bx - ownX * 0.72) * 0.25; ty = by * 0.5; }   // defender
    else if (dangerous && behind) { tx = ownX * 0.85; ty = clamp(by, -GH, GH); }
    else {
      const gx = attackX - bx, gy = (lvl ? 0 : rand(-60, 60)) - by, gl = Math.hypot(gx, gy) || 1;
      const off = behind ? 90 : 34;
      tx = bx - gx / gl * off; ty = by - gy / gl * off;
      if (behind) ty += (c.y > by ? 1 : -1) * 70;   // go around the ball
    }
    c.ai.tx = tx + rand(-err, err); c.ai.ty = ty + rand(-err, err);
  }
  const want = Math.atan2(c.ai.ty - c.y, c.ai.tx - c.x), d = angDiff(c.a, want), dist = Math.hypot(c.ai.tx - c.x, c.ai.ty - c.y);
  if (Math.abs(d) > 2.2 && dist < 140) { I.th = -1; I.st = clamp(-d * 2, -1, 1); }
  else { I.th = dist > 30 ? 1 : 0.3; I.st = clamp(d * 2.6, -1, 1); }
  I.bo = c.boost > [40, 15, 5, 2][lvl] && Math.abs(d) < 0.3 && dist > [420, 260, 160, 110][lvl];
  const bd = Math.hypot(ball.x - c.x, ball.y - c.y), ba = Math.abs(angDiff(c.a, Math.atan2(ball.y - c.y, ball.x - c.x)));
  I.fl = lvl > 0 && bd < 95 && ba < 0.35 && Math.random() < [0, 0.3, 0.6, 0.9][lvl];
  if (lvl === 0) I.th *= 0.85;
}

// ------------------------------------------------------------ human input
const BINDS = {
  p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], boost: ['ShiftLeft'], flip: ['Space'] },
  p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], boost: ['ShiftRight', 'Enter'], flip: ['Slash', 'ControlRight', 'Numpad0'] },
};
function readHuman(which, both) {
  const k = c => U.keys[c];
  const sets = both ? [BINDS.p1, BINDS.p2] : [BINDS[which]];
  let th = 0, st = 0, bo = false, fl = false;
  sets.forEach(B => {
    if (B.up.some(k)) th += 1; if (B.down.some(k)) th -= 1; if (B.left.some(k)) st -= 1; if (B.right.some(k)) st += 1;
    if (B.boost.some(k)) bo = true; if (B.flip.some(c => U.pressed[c])) fl = true;
  });
  return { th: clamp(th, -1, 1), st: clamp(st, -1, 1), bo, fl };
}

// ------------------------------------------------------------ art: field (cached), stadium, cars, ball
let fieldCv = null;
function buildField() {
  fieldCv = document.createElement('canvas'); fieldCv.width = W; fieldCv.height = H;
  const g = fieldCv.getContext('2d');
  // stadium bowl
  const bg = g.createRadialGradient(CX, CY, 200, CX, CY, 900); bg.addColorStop(0, '#1b2433'); bg.addColorStop(1, '#07090e');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // crowd
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * Math.PI * 2, rx = FW + 70 + Math.random() * 140, ry = FH + 60 + Math.random() * 110;
    const x = CX + Math.cos(a) * rx, y = CY + Math.sin(a) * ry; if (y < 96) continue;
    g.fillStyle = Math.random() < 0.5 ? (Math.cos(a) < 0 ? '#2b4f8f' : '#8f4a24') : ['#5b6170', '#6b7280', '#3f4554', '#9ca3af'][i % 4];
    g.globalAlpha = 0.35 + Math.random() * 0.35; g.beginPath(); g.arc(x, y, 2.2 + Math.random() * 1.4, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  // pitch shape
  const path = () => { g.beginPath(); g.moveTo(CX - FW + CR, CY - FH); g.lineTo(CX + FW - CR, CY - FH); g.arcTo(CX + FW, CY - FH, CX + FW, CY - FH + CR, CR); g.lineTo(CX + FW, CY - GH); g.lineTo(CX + FW + GD, CY - GH); g.lineTo(CX + FW + GD, CY + GH); g.lineTo(CX + FW, CY + GH); g.lineTo(CX + FW, CY + FH - CR); g.arcTo(CX + FW, CY + FH, CX + FW - CR, CY + FH, CR); g.lineTo(CX - FW + CR, CY + FH); g.arcTo(CX - FW, CY + FH, CX - FW, CY + FH - CR, CR); g.lineTo(CX - FW, CY + GH); g.lineTo(CX - FW - GD, CY + GH); g.lineTo(CX - FW - GD, CY - GH); g.lineTo(CX - FW, CY - GH); g.lineTo(CX - FW, CY - FH + CR); g.arcTo(CX - FW, CY - FH, CX - FW + CR, CY - FH, CR); g.closePath(); };
  // wall shadow + rim
  g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 40; path(); g.fillStyle = '#1f7a3e'; g.fill(); g.restore();
  g.save(); path(); g.clip();
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#25864a' : '#22803f'; g.fillRect(CX - FW - GD + i * ((FW * 2 + GD * 2) / 14), CY - FH, (FW * 2 + GD * 2) / 14 + 1, FH * 2); }
  // grass texture
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)'; g.fillRect(CX - FW - GD + Math.random() * (FW + GD) * 2, CY - FH + Math.random() * FH * 2, 2, 2); }
  // lighting
  const lg = g.createRadialGradient(CX, CY - 60, 50, CX, CY, 700); lg.addColorStop(0, 'rgba(255,255,255,0.10)'); lg.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
  // goals (nets) tinted by team
  [-1, 1].forEach(s => {
    const team = s < 0 ? 0 : 1, x0 = s < 0 ? CX - FW - GD : CX + FW;
    g.fillStyle = rgba(TEAM[team].col, 0.18); g.fillRect(x0, CY - GH, GD, GH * 2);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
    for (let k = 0; k <= GD; k += 9) { g.beginPath(); g.moveTo(x0 + k, CY - GH); g.lineTo(x0 + k, CY + GH); g.stroke(); }
    for (let k = 0; k <= GH * 2; k += 9) { g.beginPath(); g.moveTo(x0, CY - GH + k); g.lineTo(x0 + GD, CY - GH + k); g.stroke(); }
  });
  // lines
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(CX, CY - FH); g.lineTo(CX, CY + FH); g.stroke();
  g.beginPath(); g.arc(CX, CY, 78, 0, 7); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(CX, CY, 5, 0, 7); g.fill();
  [-1, 1].forEach(s => {
    const gx = CX + s * FW;
    g.beginPath(); g.rect(Math.min(gx, gx - s * 120), CY - 150, 120, 300); g.stroke();
    g.beginPath(); g.arc(gx - s * 120, CY, 52, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : Math.PI * 1.5); g.stroke();
    g.strokeStyle = rgba(TEAM[s < 0 ? 0 : 1].col, 0.9); g.lineWidth = 5; g.beginPath(); g.moveTo(gx, CY - GH); g.lineTo(gx, CY + GH); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
  });
  g.restore();
  // wall rim
  path(); g.strokeStyle = '#e5e7eb'; g.lineWidth = 6; g.stroke();
  path(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
}
function drawPad(p) {
  const x = CX + p.x, y = CY + p.y, on = p.t <= 0, r = p.big ? 17 : 9;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x, y + 2, r + 4, 0, 7); ctx.fill();
  ctx.fillStyle = on ? '#fbbf24' : '#3f3f46'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 7); ctx.fill();
  ctx.fillStyle = on ? '#fde68a' : '#52525b'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (on) { const k = 0.5 + 0.5 * Math.sin(t * 5 + p.x); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 3); gl.addColorStop(0, `rgba(253,224,71,${0.35 + k * 0.2})`); gl.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
}
function drawCar(c, x, y, a, sc = 1) {
  const T = TEAM[c.team];
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(sc, sc);
  const flip = c.flipT > 0 ? 1 + Math.sin(c.flipT / 0.28 * Math.PI) * 0.18 : 1;
  ctx.scale(flip, flip);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(-27, -12, 56, 30, 9); ctx.fill();
  // wheels
  ctx.fillStyle = '#0b0b0f'; [[-17, -16], [11, -16], [-17, 11], [11, 11]].forEach(([wx, wy]) => { rr(wx, wy, 12, 5, 2); ctx.fill(); });
  // body
  // your shop paint (the stripe keeps your team colour so teams stay readable)
  const cos = (c.ctrl === 'p1' || c.ctrl === 'net-me') && window.Arcade ? Arcade.equipped('soccer', 'car') : null;
  const body = cos ? cos.col : T.col;
  const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, cos ? shade(body, 0.35) : T.light); g.addColorStop(0.45, body); g.addColorStop(1, cos ? shade(body, -0.45) : T.dark);
  rr(-28, -14, 56, 28, 10); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  // stripe + spoiler
  ctx.fillStyle = cos ? T.light : 'rgba(255,255,255,0.85)'; ctx.fillRect(-28, -2.5, 56, 5);
  ctx.fillStyle = shade(T.col, -0.5); rr(-30, -13, 5, 26, 2); ctx.fill();
  // cabin
  const cg = ctx.createLinearGradient(-10, -10, 10, 10); cg.addColorStop(0, '#93c5fd'); cg.addColorStop(1, '#0f172a');
  rr(-11, -10, 20, 20, 5); ctx.fillStyle = '#111827'; ctx.fill();
  rr(1, -9, 8, 18, 3); ctx.fillStyle = cg; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(3, -8, 2, 7);
  // headlights
  ctx.fillStyle = '#fef9c3'; ctx.fillRect(24, -11, 3, 5); ctx.fillRect(24, 6, 3, 5);
  ctx.fillStyle = '#ef4444'; ctx.fillRect(-28, -11, 2, 4); ctx.fillRect(-28, 7, 2, 4);
  if (cos && cos.fx === 'crown') { ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-24, -7); ctx.lineTo(-24, 7); ctx.lineTo(-19, 7); ctx.lineTo(-16, 4); ctx.lineTo(-19, 0); ctx.lineTo(-16, -4); ctx.lineTo(-19, -7); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function drawBall() {
  const x = CX + ball.x, y = CY + ball.y, r = ball.r, sp = Math.hypot(ball.vx, ball.vy);
  if (sp > 500) { ball.trail.forEach((p, i) => { ctx.globalAlpha = i / ball.trail.length * 0.25 * Math.min(1, (sp - 500) / 400); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(CX + p.x, CY + p.y, r * (0.4 + i / ball.trail.length * 0.6), 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 7, r, r * 0.8, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - 7, y - 8, 2, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e5e7eb'); g.addColorStop(1, '#9ca3af');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  ctx.fillStyle = '#1f2937';
  for (let k = 0; k < 5; k++) { const a = ball.ang + k * 1.2566, px = x + Math.cos(a) * r * 0.62, py = y + Math.sin(a * 0.9) * r * 0.55; ctx.beginPath(); for (let j = 0; j < 5; j++) { const b = j * 1.2566 + a; ctx.lineTo(px + Math.cos(b) * 5, py + Math.sin(b) * 5); } ctx.fill(); }
  ctx.beginPath(); for (let j = 0; j < 5; j++) { const b = j * 1.2566 + ball.ang; ctx.lineTo(x + Math.cos(b) * 6, y + Math.sin(b) * 6); } ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
}
function drawWorld(dt) {
  if (!fieldCv) buildField();
  ctx.save();
  if (shake > 0) { ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 14); }
  ctx.drawImage(fieldCv, 0, 0);
  pads.forEach(drawPad);
  // ball-cam indicator ring when the ball is near a goal
  parts.forEach(p => { if (!p.add) return; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(CX + p.x, CY + p.y, p.s, 0, 7); ctx.fill(); });
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  cars.forEach(c => drawCar(c, CX + c.x, CY + c.y, c.a));
  drawBall();
  parts.forEach(p => { if (p.add) return; ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.col; ctx.fillRect(CX + p.x - p.s / 2, CY + p.y - p.s / 2, p.s, p.s); });
  ctx.globalAlpha = 1;
  // names
  cars.forEach(c => {
    if (match.mode === 'demo' || (!c.human && match.size === 1 && match.mode === 'cpu')) return;
    U.txt(c.name, CX + c.x, CY + c.y - 40, 12, '#ffffff', 'center', { weight: 700 });
    if (c.own && window.Account && (match.mode !== 'online' || Account.ownerOK(c.name, c.own))) { ctx.font = `700 12px ${U.FONT}`; Account.drawOwnerTag(ctx, CX + c.x, CY + c.y - 62, 18, 'center'); }
  });
  ctx.restore();
  parts.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.exp(-dt * (p.drag || 3)); p.vx *= k; p.vy *= k; });
  parts = parts.filter(p => p.t < p.life);
  shake = Math.max(0, shake - dt);
}
function drawHUD() {
  // scoreboard
  const sw = 420, sx = W / 2 - sw / 2, sy = 18;
  U.panel(sx, sy, sw, 64, { r: 18, fill: 'rgba(10,12,18,0.85)' });
  ctx.fillStyle = TEAM[0].col; rr(sx + 6, sy + 6, 120, 52, 13); ctx.fill();
  ctx.fillStyle = TEAM[1].col; rr(sx + sw - 126, sy + 6, 120, 52, 13); ctx.fill();
  U.txt(String(score[0]), sx + 66, sy + 34, 36, '#ffffff', 'center', { base: 'middle', head: true, weight: 800 });
  U.txt(String(score[1]), sx + sw - 66, sy + 34, 36, '#ffffff', 'center', { base: 'middle', head: true, weight: 800 });
  const m = Math.floor(Math.ceil(timeLeft) / 60), s = Math.ceil(timeLeft) % 60;
  U.txt(overtime ? 'OT' : `${m}:${String(s).padStart(2, '0')}`, W / 2, sy + 26, 28, overtime ? '#fbbf24' : '#ffffff', 'center', { base: 'middle', head: true, weight: 800 });
  U.txt(overtime ? 'NEXT GOAL WINS' : match.mode === 'online' ? 'ONLINE' : `${match.size}v${match.size}`, W / 2, sy + 50, 11, '#9ca3af', 'center', { base: 'middle', weight: 700 });
  // boost meters for human cars
  cars.filter(c => c.human).forEach((c, i) => {
    const left = c.team === 0, bx = left ? 70 : W - 70, by = H - 70;
    ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(bx, by, 38, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    ctx.strokeStyle = c.boost > 0 ? '#fbbf24' : '#52525b'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(bx, by, 38, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * c.boost / 100); ctx.stroke(); ctx.lineCap = 'butt';
    U.txt(String(Math.round(c.boost)), bx, by, 24, '#ffffff', 'center', { base: 'middle', head: true, weight: 800 });
    U.txt(c.name, bx, by + 30, 11, TEAM[c.team].light, 'center', { base: 'middle' });
  });
  // countdown / goal banner
  if (phase === 'kickoff' && phaseT < 3.4) {
    const n = Math.ceil(3 - phaseT), k = (phaseT % 1);
    U.txt(n > 0 ? String(n) : 'GO!', W / 2, CY - 20, 110 - k * 20, n > 0 ? '#ffffff' : '#4ade80', 'center', { base: 'middle', head: true, weight: 800 });
  }
  if (phase === 'goal' && goalFx) {
    const k = Math.min(1, phaseT * 3), T = TEAM[goalFx.team];
    ctx.save(); ctx.translate(W / 2, CY - 20); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    U.txt('GOAL!', 0, -10, 120, T.col, 'center', { base: 'middle', head: true, weight: 800 });
    U.txt(goalFx.own ? 'OWN GOAL!' : `${goalFx.scorer} scores`, 0, 60, 22, '#ffffff', 'center', { base: 'middle' });
    ctx.restore();
  }
}

// ------------------------------------------------------------ online (host runs the game; guest sends controls)
// ------------------------------------------------------------ ranked (vs LEGEND CPU or a player online)
const RK = { screen: 'home', q: null, online: false, started: false, result: null, matchId: null, opp: null, cpuElo: 1300, err: '' };
function rankedFinish() {
  if (!match || !match.ranked || RK.result) return;
  const me = cars.find(c => c.ctrl === 'p1' || c.ctrl === 'net-me' || c.ctrl === 'p1both'); if (!me) return;
  const won = me.team === winner; RK.result = { pending: true, won };
  const done = r => { RK.result = Object.assign(r, { won }); };
  if (match.ranked === 'cpu') Ranked.cpu('soccer', RK.cpuElo, won ? 1 : 0).then(done);
  else Ranked.report('soccer', RK.matchId, RK.opp && RK.opp.id, won).then(done);
}
function startRankedCpu() {
  RK.online = false; RK.result = null; RK.cpuElo = Math.max(1300, Ranked.elo('soccer') + 150);
  startMatch({ mode: 'cpu', ranked: 'cpu', size: 1, cpu: 3, time: 180, humans: [{ team: 0, slot: 0, ctrl: 'p1both', name: myName(), own: OWN() }] });
}
function findRanked() {
  if (!Ranked.signedIn()) { RK.err = 'Sign in on the arcade to play ranked online.'; return; }
  RK.err = ''; RK.screen = 'queue';
  RK.q = Ranked.queue('soccer', m => {
    RK.q = null; RK.online = true; RK.started = false; RK.opp = m.opp; RK.screen = 'connecting';
    if (m.role === 'host') hostRoom(m.code); else joinRoom(m.code);
    setTimeout(() => { if (RK.screen === 'connecting' && !RK.started) { netReset(); RK.online = false; RK.screen = 'home'; RK.err = 'Could not connect to the other player.'; screen = 'ranked'; } }, 25000);
  });
}
function drawRanked(dt) {
  demoTick(dt);
  ctx.fillStyle = 'rgba(8,9,13,0.72)'; ctx.fillRect(0, 0, W, H);
  U.txt('Ranked', 70, 44, 42, '#fff', 'left', { head: true, weight: 800 });
  U.txt('1v1, 3 minutes. Beat the LEGEND computer or a real player to climb.', 72, 100, 15, '#cbd5e1', 'left', { weight: 600 });
  const st = Ranked.state.soccer || {}, m = st.me || { elo: Ranked.elo('soccer'), wins: 0, losses: 0, peak: 1000 }, rk = Ranked.rankOf(m.elo);
  U.panel(70, 140, 560, 290);
  Ranked.drawBadge(ctx, 170, 250, 2.2 + Math.sin(t * 2) * 0.04, m.elo);
  U.txt(rk.name, 270, 184, 26, rk.col, 'left', { head: true, weight: 800 });
  U.txt(`${m.elo} Elo`, 270, 224, 22, '#fff', 'left', { weight: 800 });
  U.rr(270, 264, 320, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  U.rr(270, 264, Math.max(10, 320 * clamp((m.elo - rk.lo) / (rk.hi - rk.lo), 0, 1)), 10, 5); ctx.fillStyle = rk.col; ctx.fill();
  U.txt(`${m.wins || 0} wins  ·  ${m.losses || 0} losses  ·  best ${m.peak || m.elo}`, 270, 290, 14, '#94a3b8', 'left', { weight: 600 });
  U.txt(Ranked.signedIn() ? 'Your rank is saved to your account.' : 'Not signed in: your rank stays on this computer.', 94, 352, 13, Ranked.signedIn() ? '#86efac' : '#fbbf24', 'left', { weight: 600 });
  if (RK.err || st.err) U.txt(RK.err || st.err, 94, 380, 13, '#f87171', 'left', { weight: 700 });
  U.panel(650, 140, 560, 290);
  U.txt('Top players', 674, 160, 18, '#fff', 'left', { weight: 800 });
  const top = st.top || [];
  if (!top.length) U.txt(Ranked.signedIn() ? (st.loading ? 'Loading…' : 'Nobody ranked yet. Be the first!') : 'Sign in to see the online ladder.', 674, 200, 14, '#94a3b8', 'left', { weight: 600 });
  top.forEach((r, i) => { const y = 196 + i * 28, rr2 = Ranked.rankOf(r.elo); U.txt(`${i + 1}.`, 690, y, 14, '#94a3b8', 'right', { weight: 700 }); U.txt((r.profiles && r.profiles.username) || 'player', 704, y, 14, '#fff', 'left', { weight: 700 }); U.txt(rr2.name, 1050, y, 13, rr2.col, 'right', { weight: 700 }); U.txt(String(r.elo), 1186, y, 14, '#fde047', 'right', { weight: 800 }); });
  if (RK.screen === 'home') {
    if (U.button('rcpu', 70, 460, 360, 84, 'VS LEGEND CPU', { color: '#3b82f6', size: 20 })) startRankedCpu();
    U.txt('Fastest, smartest computer driver', 250, 552, 13, '#94a3b8', 'center', { weight: 600 });
    if (U.button('rpvp', 450, 460, 360, 84, 'FIND A PLAYER', { color: Ranked.signedIn() ? '#f59e0b' : '#475569', size: 20 })) findRanked();
    U.txt('1v1 against a real player online', 630, 552, 13, '#94a3b8', 'center', { weight: 600 });
    if (U.button('rback', 830, 460, 380, 84, 'BACK', { ghost: true, size: 18, sfx: 'back' })) screen = 'title';
  } else {
    const secs = RK.q ? Math.floor((Date.now() - RK.q.started) / 1000) : 0;
    U.panel(70, 460, 740, 84); U.txt(RK.screen === 'queue' ? `Looking for a player…  ${secs}s` : 'Connecting…', 100, 502, 22, '#fff', 'left', { base: 'middle', weight: 800 });
    if (RK.screen === 'queue' && secs > 40) U.txt('Nobody around? Try the LEGEND CPU meanwhile.', 100, 562, 13, '#94a3b8', 'left', { weight: 600 });
    if (U.button('rcancel', 830, 460, 380, 84, 'CANCEL', { ghost: true, size: 18, sfx: 'back' })) { if (RK.q) RK.q.cancel(); RK.q = null; netReset(); RK.online = false; RK.screen = 'home'; }
  }
}
function openRanked() { screen = 'ranked'; RK.screen = 'home'; RK.err = ''; Ranked.load('soccer'); }
const NET = { role: null, code: '', screen: 'menu', error: '', input: { value: '', max: 6, upper: true, allow: /[a-zA-Z0-9]/ }, names: ['', ''], own: [false, false], snaps: [], guest: null, size: 1, cpu: 1 };
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const netSend = m => NET.tr && NET.tr.broadcast(m);
function netReset() { NetTransport.announce('soccer', null); if (NET.tr) try { NET.tr.close(); } catch (e) {} NET.tr = null; NET.role = null; NET.guest = null; NET.snaps = []; }
function netLost(why) {
  if (RK.online) { if (screen === 'play' && match && match.ranked && !RK.result) { const me = cars.find(c => c.ctrl === 'p1' || c.ctrl === 'net-me' || c.ctrl === 'p1both'); winner = me ? me.team : 0; rankedFinish(); screen = 'over'; netReset(); return; } netReset(); RK.online = false; RK.screen = 'home'; RK.err = why; screen = 'ranked'; Sound.playSong(SONGS.soccerMenu); return; }
  netReset(); NET.error = why; NET.screen = 'menu'; screen = 'online'; Sound.playSong(SONGS.soccerMenu);
}
function hostRoom(code) {
  netReset(); NET.error = ''; NET.role = 'host'; NET.screen = 'connecting';
  NET.code = code || Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  NET.names = [myName(), '']; NET.own = [OWN(), false];
  NET.tr = NetTransport.host(NET.code, {
    ready: () => { NET.screen = 'lobby'; if (!RK.online) NetTransport.announce('soccer', NET.code); },
    join: id => { if (NET.guest && NET.guest !== id) { NET.tr.send(id, { t: 'full' }); return; } NET.guest = id; },
    leave: id => { if (id !== NET.guest) return; NET.guest = null; NET.names[1] = ''; if (screen === 'play') netLost('The other player left.'); else lobbySync(); },
    msg: (id, d) => {
      if (id !== NET.guest) return;
      if (d.t === 'hello') { NET.names[1] = String(d.name || 'Guest').slice(0, 16); NET.own[1] = !!d.own; lobbySync(); if (RK.online && screen !== 'play' && !RK.started) { RK.started = true; setTimeout(() => hostStart(), 800); } }
      else if (d.t === 'in') { const c = cars.find(x => x.ctrl === 'net'); if (c) { c.in.th = clamp(+d.th || 0, -1, 1); c.in.st = clamp(+d.st || 0, -1, 1); c.in.bo = !!d.bo; if (d.fn !== NET.lastFn) { NET.lastFn = d.fn; c.in.fl = true; } } }
      else if (d.t === 'bye') netLost('The other player left.');
    },
    error: e => netLost(e === 'taken' ? 'Room code clash, try again.' : String(e)),
  });
}
function joinRoom(code) {
  netReset(); NET.error = ''; NET.role = 'client'; NET.code = code.toUpperCase(); NET.screen = 'connecting'; screen = 'online';
  NET.tr = NetTransport.join(NET.code, {
    ready: () => {
      if (!RK.online) NetTransport.announce('soccer', NET.code);
      const hello = () => netSend({ t: 'hello', name: myName(), own: OWN() }); hello();
      let n = 0; const tr = NET.tr; const iv = setInterval(() => { if (NET.tr !== tr || NET.screen === 'lobby' || screen === 'play' || ++n > 10) { clearInterval(iv); if (NET.tr === tr && NET.screen !== 'lobby' && screen !== 'play') netLost('The room did not answer.'); return; } hello(); }, 1500);
    },
    leave: () => netLost('Lost connection to the host.'),
    msg: (id, d) => {
      if (d.t === 'lobby') { NET.screen = 'lobby'; NET.names = d.names; NET.own = d.own; NET.size = d.size; NET.cpu = d.cpu; }
      else if (d.t === 'start') { if (d.ranked) { RK.matchId = d.matchId; RK.result = null; RK.started = true; } startMatch({ mode: 'online', ranked: d.ranked ? 'online' : null, size: d.size, cpu: d.cpu, time: d.time, humans: d.humans.map(h => Object.assign({}, h, { ctrl: h.team === 1 && h.slot === 0 ? 'net-me' : 'remote' })) }); NET.snaps = []; }
      else if (d.t === 'S') applySnap(d);
      else if (d.t === 'closed' || d.t === 'bye') netLost('The host left.');
      else if (d.t === 'full') netLost('That room is full.');
    },
    error: e => netLost(String(e)),
  });
}
function lobbySync() { if (NET.role === 'host') netSend({ t: 'lobby', names: NET.names, own: NET.own, size: save.set.size, cpu: save.set.cpu }); }
function hostStart() {
  const humans = [{ team: 0, slot: 0, ctrl: 'p1both', name: NET.names[0], own: NET.own[0] }, { team: 1, slot: 0, ctrl: 'net', name: NET.names[1], own: NET.own[1] }];
  const m = { mode: 'online', size: RK.online ? 1 : save.set.size, cpu: save.set.cpu, time: RK.online ? 180 : save.set.time, humans, ranked: RK.online ? 'online' : null };
  if (RK.online) { RK.matchId = NET.code + '-' + Date.now().toString(36); RK.result = null; }
  netSend({ t: 'start', ranked: !!RK.online, matchId: RK.matchId, size: m.size, cpu: m.cpu, time: m.time, humans: humans.map(h => ({ team: h.team, slot: h.slot, name: h.name, own: h.own })) });
  startMatch(m);
}
let sendT = 0;
function netSendState(force) {
  sendT += 1 / 60;
  if (!force && sendT < 1 / 30) return; sendT = 0;
  const R = v => Math.round(v * 10) / 10;
  netSend({ t: 'S', c: cars.map(c => [R(c.x), R(c.y), Math.round(c.a * 1000) / 1000, R(c.vx), R(c.vy), Math.round(c.boost), c.boosting ? 1 : 0, Math.round(c.flipT * 100) / 100, c.goals]),
    b: [R(ball.x), R(ball.y), R(ball.vx), R(ball.vy)], s: score, tl: Math.round(timeLeft * 10) / 10, ot: overtime, ph: phase, pt: Math.round(phaseT * 100) / 100, p: pads.map(p => p.t > 0 ? 1 : 0).join(''), lt: lastTouch, sc: screen, w: winner, g: goalFx });
}
function applySnap(d) {
  const prevPhase = phase;
  score = d.s; timeLeft = d.tl; overtime = d.ot; phase = d.ph; phaseT = d.pt; lastTouch = d.lt; winner = d.w; goalFx = d.g;
  if (d.sc === 'over' && match && match.ranked) rankedFinish();
  d.c.forEach((a, i) => { const c = cars[i]; if (!c) return; c.tx = a[0]; c.ty = a[1]; c.ta = a[2]; c.vx = a[3]; c.vy = a[4]; c.boost = a[5]; c.boosting = !!a[6]; c.flipT = a[7]; c.goals = a[8]; if (c.x === 0 && c.y === 0 || Math.hypot(c.x - c.tx, c.y - c.ty) > 150) { c.x = c.tx; c.y = c.ty; c.a = c.ta; } });
  ball.tx = d.b[0]; ball.ty = d.b[1]; ball.vx = d.b[2]; ball.vy = d.b[3]; if (Math.hypot(ball.x - ball.tx, ball.y - ball.ty) > 150) { ball.x = ball.tx; ball.y = ball.ty; }
  [...d.p].forEach((ch, i) => { if (pads[i]) pads[i].t = ch === '1' ? 1 : 0; });
  if (phase === 'goal' && prevPhase !== 'goal') { sfx.goal(); shake = 0.6; for (let k = 0; k < 120; k++) { const a = rand(0, 6.28), v = rand(100, 700); parts.push({ x: ball.tx, y: ball.ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.6, 1.6), s: rand(3, 8), col: Math.random() < 0.6 ? TEAM[d.g ? d.g.team : 0].col : '#ffffff', drag: 2.2 }); } }
  if (phase === 'kickoff' && prevPhase !== 'kickoff') { cars.forEach(c => { c.x = c.tx; c.y = c.ty; c.a = c.ta; }); ball.x = ball.tx; ball.y = ball.ty; }
  if (d.sc === 'over' && screen !== 'over') { screen = 'over'; phaseT = 0; Sound.playSong(SONGS.soccerMenu); sfx.whistle(); }
}
let inT = 0, fN = 0;
function clientFrame(dt) {
  const k = Math.min(1, dt * 15);
  cars.forEach(c => { if (c.tx == null) return; c.tx += c.vx * dt; c.ty += c.vy * dt; c.x = lerp(c.x, c.tx, k); c.y = lerp(c.y, c.ty, k); c.a += angDiff(c.a, c.ta) * k;
    if (c.boosting) { const fx = Math.cos(c.a), fy = Math.sin(c.a); parts.push({ x: c.x - fx * 28, y: c.y - fy * 28, vx: -fx * 240 + rand(-30, 30), vy: -fy * 240 + rand(-30, 30), t: 0, life: 0.25, s: rand(3, 6), col: Math.random() < 0.5 ? '#fde68a' : TEAM[c.team].light, add: true }); } });
  if (ball.tx != null) { ball.tx += ball.vx * dt; ball.ty += ball.vy * dt; ball.x = lerp(ball.x, ball.tx, k); ball.y = lerp(ball.y, ball.ty, k); ball.ang += Math.hypot(ball.vx, ball.vy) * dt / ball.r * 0.6; ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 14) ball.trail.shift(); }
  const prev = Math.ceil(3 - (phaseT)); phaseT += dt; if (phase === 'kickoff') { const now = Math.ceil(3 - phaseT); if (now !== prev && now >= 0) sfx.beep(now === 0); }
  if (phase === 'live' && !overtime) timeLeft = Math.max(0, timeLeft - dt);
  inT += dt;
  const I = readHuman('p1', true); if (I.fl) fN++;
  if (inT >= 1 / 30) { inT = 0; netSend({ t: 'in', th: I.th, st: I.st, bo: I.bo, fn: fN }); }
}

// ------------------------------------------------------------ screens
let menuDemo = null;
function demoTick(dt) {
  if (!menuDemo) { match = { size: 2, cpu: 2, mode: 'demo', time: 9999 }; startMatch(Object.assign({}, match, { humans: [] })); screen = 'title'; menuDemo = true; Sound.playSong(SONGS.soccerMenu); phase = 'live'; }
  step(dt); if (phase === 'goal' && phaseT > 2.4) kickoffPositions();
  drawWorld(dt);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(8,9,13,0.55)'); g.addColorStop(1, 'rgba(8,9,13,0.85)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function drawTitle(dt) {
  demoTick(dt);
  U.txt('ROCKET', W / 2, 92, 84, '#ffffff', 'center', { head: true, weight: 800 });
  U.txt('SOCCER', W / 2, 172, 84, '#fbbf24', 'center', { head: true, weight: 800 });
  U.txt('Drive. Boost. Dodge. Score.', W / 2, 270, 18, '#cbd5e1', 'center', { weight: 600 });
  const bx = W / 2 - 200, bw = 400;
  if (U.button('cpu', bx, 320, bw, 62, 'PLAY VS COMPUTER', { color: '#fbbf24', size: 20, light: true })) { screen = 'setup'; NET.setupFor = 'cpu'; }
  if (U.button('local', bx, 396, bw, 56, '2 PLAYERS (SAME KEYBOARD)', { ghost: true, size: 16 })) { screen = 'setup'; NET.setupFor = 'local'; }
  if (U.button('online', bx, 466, 196, 56, 'PLAY ONLINE', { color: '#3b82f6', size: 15 })) { screen = 'online'; NET.screen = 'menu'; NET.error = ''; }
  if (U.button('ranked', bx + 204, 466, 196, 56, 'RANKED', { color: '#f59e0b', size: 15 })) openRanked();
  U.txt(`Wins ${save.wins}   Losses ${save.losses}   Goals ${save.goals}`, W / 2, 548, 14, '#94a3b8', 'center', { weight: 600 });
  U.txt('P1: WASD drive · L-Shift boost · Space dodge        P2: Arrows · R-Shift boost · / dodge', W / 2, H - 46, 13, '#64748b', 'center', { weight: 600 });
}
function drawSetup(dt) {
  demoTick(dt);
  U.panel(W / 2 - 330, 110, 660, 470);
  U.txt(NET.setupFor === 'cpu' ? 'VS COMPUTER' : '2 PLAYERS', W / 2, 140, 34, '#ffffff', 'center', { head: true, weight: 800 });
  const row = (label, y, opts, cur, set) => {
    U.txt(label, W / 2 - 290, y + 14, 14, '#94a3b8', 'left', { weight: 700 });
    opts.forEach(([v, n], i) => { if (U.button('o' + label + i, W / 2 - 120 + i * 140, y, 130, 44, n, { ghost: cur !== v, color: cur === v ? '#fbbf24' : undefined, light: true, size: 15, sfx: 'tab' })) set(v); });
  };
  row('TEAMS', 210, [[1, '1 v 1'], [2, '2 v 2']], save.set.size, v => { save.set.size = v; store(); });
  row('COMPUTER', 280, [[0, 'Easy'], [1, 'Normal'], [2, 'Hard']], save.set.cpu, v => { save.set.cpu = v; store(); });
  row('TIME', 350, [[120, '2 min'], [180, '3 min'], [300, '5 min']], save.set.time, v => { save.set.time = v; store(); });
  const note = NET.setupFor === 'local' ? (save.set.size === 2 ? 'Blue team: P1 + computer. Orange team: P2 + computer.' : 'P1 (blue) vs P2 (orange).') : (save.set.size === 2 ? 'You + a computer teammate vs 2 computers.' : 'You vs the computer.');
  U.txt(note, W / 2, 420, 14, '#cbd5e1', 'center', { weight: 600 });
  if (U.button('go', W / 2 - 160, 470, 320, 64, 'KICK OFF', { color: '#22c55e', size: 22 })) {
    menuDemo = null;
    const humans = NET.setupFor === 'local' ? [{ team: 0, slot: 0, ctrl: 'p1', name: 'P1', own: OWN() }, { team: 1, slot: 0, ctrl: 'p2', name: 'P2' }] : [{ team: 0, slot: 0, ctrl: 'p1both', name: myName(), own: OWN() }];
    startMatch({ mode: NET.setupFor, size: save.set.size, cpu: save.set.cpu, time: save.set.time, humans });
  }
  if (U.button('back', 40, H - 80, 140, 48, 'Back', { ghost: true, size: 15, sfx: 'back' })) screen = 'title';
}
function drawOnline(dt) {
  demoTick(dt);
  U.panel(W / 2 - 330, 100, 660, 500);
  U.txt('PLAY ONLINE', W / 2, 128, 34, '#ffffff', 'center', { head: true, weight: 800 });
  if (NET.screen === 'menu') {
    U.txt('1 v 1 against a friend anywhere. In 2 v 2, computers fill the empty seats.', W / 2, 180, 14, '#94a3b8', 'center', { weight: 600 });
    if (U.button('host', W / 2 - 220, 220, 440, 62, 'CREATE ROOM', { color: '#22c55e', size: 20 })) hostRoom();
    U.txt('OR JOIN WITH A CODE', W / 2, 314, 13, '#94a3b8', 'center', { weight: 700 });
    U.input('code', W / 2 - 220, 340, 300, 60, NET.input, 'ROOM CODE');
    NET.input.onEnter = v => { if (v.length >= 4) joinRoom(v); };
    if (U.button('join', W / 2 + 90, 340, 130, 60, 'JOIN', { color: '#3b82f6', size: 18 }) && NET.input.value.length >= 4) joinRoom(NET.input.value);
    if (NET.error) U.txt(NET.error, W / 2, 430, 15, '#f87171', 'center', { weight: 700 });
  } else if (NET.screen === 'connecting') {
    U.txt(NET.role === 'host' ? 'Creating room...' : `Joining ${NET.code}...`, W / 2, 280, 22, '#ffffff', 'center');
    U.txt(NetTransport.status.text || '', W / 2, 320, 14, '#94a3b8', 'center', { weight: 600 });
  } else {
    U.txt('ROOM CODE', W / 2, 180, 13, '#94a3b8', 'center');
    U.txt(NET.code, W / 2, 200, 56, '#fbbf24', 'center', { head: true, weight: 800 });
    [0, 1].forEach(i => {
      const x = W / 2 - 260 + i * 280;
      U.rr(x, 290, 240, 120, 16); ctx.fillStyle = rgba(TEAM[i].col, 0.18); ctx.fill(); ctx.strokeStyle = rgba(TEAM[i].col, 0.6); ctx.lineWidth = 2; ctx.stroke();
      drawCar({ team: i, flipT: 0 }, x + 120, 330, -Math.PI / 2 + Math.sin(t * 2 + i) * 0.2, 1.3);
      U.txt(NET.names[i] || 'Waiting...', x + 120, 372, 18, NET.names[i] ? '#fff' : '#64748b', 'center');
      if (NET.own[i] && window.Account && Account.ownerOK(NET.names[i], NET.own[i])) Account.drawOwnerTag(ctx, x + 120, 300, 18, 'center');
    });
    if (NET.role === 'host') {
      U.txt(`${save.set.size}v${save.set.size}  ·  ${save.set.time / 60} min  ·  ${['Easy', 'Normal', 'Hard'][save.set.cpu]} computers  (change in Play vs Computer)`, W / 2, 432, 13, '#94a3b8', 'center', { weight: 600 });
      if (U.button('start', W / 2 - 180, 470, 360, 62, NET.guest && NET.names[1] ? 'START MATCH' : 'Waiting for a player...', { color: NET.guest && NET.names[1] ? '#22c55e' : '#3f3f46', size: 18, disabled: !(NET.guest && NET.names[1]) })) hostStart();
    } else U.txt('Waiting for the host to start...', W / 2, 480, 18, '#cbd5e1', 'center');
  }
  if (U.button('oback', 40, H - 80, 140, 48, 'Back', { ghost: true, size: 15, sfx: 'back' })) { netSend({ t: 'bye' }); netReset(); screen = 'title'; }
}
function drawOver() {
  const won = winner, T = TEAM[won];
  ctx.fillStyle = 'rgba(8,9,13,0.6)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 340, 130, 680, 440);
  U.txt(`${T.name} WINS`, W / 2, 160, 56, T.col, 'center', { head: true, weight: 800 });
  U.txt(`${score[0]}  –  ${score[1]}`, W / 2, 236, 44, '#ffffff', 'center', { head: true, weight: 800 });
  cars.forEach((c, i) => {
    const y = 316 + Math.floor(i / 2) * 36, x = c.team === 0 ? W / 2 - 290 : W / 2 + 20;
    U.txt(c.name, x, y, 16, TEAM[c.team].light, 'left'); U.txt(`${c.goals} goals  ·  ${c.shots} shots`, x + 270, y, 14, '#cbd5e1', 'right', { weight: 600 });
  });
  if (match.ranked) {
    const r = RK.result;
    if (r) { if (r.pending) U.txt('Updating rank…', W / 2, 430, 16, '#94a3b8', 'center', { weight: 700 }); else { const d = r.after - r.before; U.txt(`${d >= 0 ? '+' : ''}${d} Elo  →  ${r.after}  ${Ranked.rankOf(r.after).name}`, W / 2, 426, 20, d >= 0 ? '#4ade80' : '#f87171', 'center', { weight: 800 }); if (r.err) U.txt(r.err, W / 2, 452, 12, '#f87171', 'center'); } }
    if (U.button('again', W / 2 - 320, 470, 300, 60, match.ranked === 'cpu' ? 'NEXT MATCH' : 'FIND ANOTHER', { color: '#f59e0b', size: 18 })) { const k = match.ranked; if (k === 'online') { netSend({ t: 'bye' }); netReset(); openRanked(); findRanked(); } else startRankedCpu(); }
    if (U.button('menu', W / 2 + 20, 470, 300, 60, 'RANKED MENU', { ghost: true, size: 18, sfx: 'back' })) { if (match.mode === 'online') { netSend({ t: 'bye' }); netReset(); } RK.online = false; menuDemo = null; openRanked(); }
    return;
  }
  if (match.mode === 'online' && NET.role === 'client') U.txt('Waiting for the host...', W / 2 - 165, 486, 16, '#94a3b8', 'center');
  else if (U.button('again', W / 2 - 320, 470, 300, 60, 'REMATCH', { color: '#22c55e', size: 18 })) {
    if (match.mode === 'online') hostStart(); else startMatch(match);
  }
  if (U.button('menu', W / 2 + 20, 470, 300, 60, 'MENU', { ghost: true, size: 18, sfx: 'back' })) { if (match.mode === 'online') { netSend({ t: 'bye' }); netReset(); } menuDemo = null; screen = 'title'; }
}
let paused = false;
function drawPause() {
  ctx.fillStyle = 'rgba(8,9,13,0.65)'; ctx.fillRect(0, 0, W, H);
  U.panel(W / 2 - 220, 220, 440, 260);
  U.txt(match.mode === 'online' ? 'MENU' : 'PAUSED', W / 2, 250, 36, '#ffffff', 'center', { head: true, weight: 800 });
  if (U.button('resume', W / 2 - 170, 320, 340, 56, 'RESUME', { color: '#22c55e', size: 18 })) paused = false;
  if (U.button('quit', W / 2 - 170, 392, 340, 56, match.ranked ? 'FORFEIT' : 'QUIT MATCH', { ghost: true, size: 16, sfx: 'back' })) { paused = false; if (match.ranked && !RK.result) { const me = cars.find(c => c.ctrl === 'p1' || c.ctrl === 'net-me' || c.ctrl === 'p1both'); winner = me ? 1 - me.team : 1; rankedFinish(); } if (match.mode === 'online') { netSend({ t: 'bye' }); netReset(); } menuDemo = null; screen = 'title'; }
}

// ------------------------------------------------------------ main loop
let last = 0;
function frame(now) {
  let dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
  NetTransport.frame();
  if (screen === 'title') drawTitle(dt);
  else if (screen === 'setup') drawSetup(dt);
  else if (screen === 'online') drawOnline(dt);
  else if (screen === 'ranked') drawRanked(dt);
  else {
    if (screen === 'play' && !(paused && match.mode !== 'online')) {
      if (match.mode === 'online' && NET.role === 'client') clientFrame(dt);
      else {
        cars.forEach(c => {
          if (c.ctrl === 'p1') Object.assign(c.in, readHuman('p1'));
          else if (c.ctrl === 'p2') Object.assign(c.in, readHuman('p2'));
          else if (c.ctrl === 'p1both') Object.assign(c.in, readHuman('p1', true));
        });
        step(dt);
        if (NET.role === 'host') netSendState();
      }
    }
    drawWorld(dt);
    drawHUD();
    if (screen === 'over') drawOver();
    else if (paused) drawPause();
    if (match && match.mode === 'online' && screen === 'play') { const st = NetTransport.status; U.txt(`${st.ping ? st.ping + ' ms' : 'online'}${st.mode === 'relay' ? ' · relay' : ''}`, W - 20, H - 26, 12, '#4ade80', 'right', { weight: 700 }); }
  }
  if (U.pressed.Escape) { if (screen === 'play') paused = !paused; else if (screen === 'ranked' && RK.screen === 'home') screen = 'title'; else if (screen === 'setup' || screen === 'online') { if (screen === 'online') { netSend({ t: 'bye' }); netReset(); } screen = 'title'; } }
  U.endFrame();
  requestAnimationFrame(frame);
}
NetTransport.backgroundTicker(dt => { if (screen === 'play' && NET.role === 'host') { step(dt); netSendState(); } });
const fontReady = document.fonts ? Promise.race([document.fonts.load(`800 40px 'Plus Jakarta Sans'`), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
fontReady.then(() => {
  requestAnimationFrame(n => { last = n; frame(n); });
  const jc = NetTransport.joinCode(); if (jc) joinRoom(jc);
});

// test hooks + owner cheats
window.__rs = { get match() { return match; }, endMatch, openRanked, startRankedCpu, findRanked, RK, set timeLeft(v) { timeLeft = v; }, get cars() { return cars; }, get ball() { return ball; }, get score() { return score; }, get screen() { return screen; }, get phase() { return phase; }, NET, hostRoom, joinRoom, hostStart, startMatch, step, save: () => save,
  sim(dt, n) { for (let i = 0; i < n; i++) { if (screen !== 'play') return screen; step(dt); } return screen; } };
const inMatch = () => screen === 'play' && (!NET.role || NET.role === 'host') ? '' : 'Start a match (as host) first';
window.__cheats = [
  { name: 'Score a goal for blue', icon: '⚽', need: () => inMatch() || (phase !== 'live' ? 'Wait for the kickoff' : ''), run() { ball.x = FW + 40; ball.y = 0; scoreGoal(0); } },
  { name: 'Infinite boost (blue)', icon: '🔥', need: inMatch, toggle: () => !!NET.infBoost, run() { NET.infBoost = !NET.infBoost; } },
  { name: 'Freeze the other team for 3s', icon: '🧊', need: inMatch, run() { cars.filter(c => c.team === 1).forEach(c => { c.vx = c.vy = 0; c.freeze = 3; }); } },
  { name: '+5 minutes on the clock', icon: '⏱', need: inMatch, run() { timeLeft += 300; } },
];
setInterval(() => { if (NET.infBoost) cars.filter(c => c.team === 0).forEach(c => c.boost = 100); cars.forEach(c => { if (c.freeze > 0) { c.freeze -= 0.05; c.vx = c.vy = 0; c.in.th = 0; } }); }, 50);
})();
