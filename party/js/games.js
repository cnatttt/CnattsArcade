// =====================================================================
//  PARTY CLASH - the mini-games
//  Every game keeps all of its state in one plain object (gs) so the
//  host can send it over the network. Keys starting with _ stay local.
//  inp[i] = { x, y (-1..1), a (held), aN (press counter), react }
// =====================================================================
'use strict';
const W = 1280, H = 720;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const FONT = '"Fredoka", "Arial Rounded MT Bold", "Arial Black", sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ------------------------------------------------------------ shared helpers
function pressedA(gs, inp, i) { if (!gs._la) gs._la = [inp[0].aN, inp[1].aN]; const p = inp[i].aN !== gs._la[i]; gs._la[i] = inp[i].aN; return p; }
function ev(S, k, o = {}) { S.ev.push(Object.assign({ id: ++S.evN, k }, o)); if (S.ev.length > 40) S.ev.shift(); }
// round flow: ready -> play -> point -> (next round | done)
function roundTick(gs, dt, S, reset) {
  gs.timer -= dt;
  if (gs.phase === 'ready' && gs.timer <= 0) { gs.phase = 'play'; ev(S, 'go'); }
  else if (gs.phase === 'point' && gs.timer <= 0) {
    if (gs.score[0] >= gs.target || gs.score[1] >= gs.target) { gs.phase = 'done'; gs.winner = gs.score[0] > gs.score[1] ? 0 : 1; return; }
    gs.round++; reset(gs); gs.phase = 'ready'; gs.timer = 1.3;
  }
}
function givePoint(gs, S, who, msg) {
  if (gs.phase !== 'play') return;
  gs.phase = 'point'; gs.timer = 1.8; gs.pointTo = who; gs.msg = msg || '';
  if (who === 0 || who === 1) { gs.score[who]++; ev(S, 'point', { p: who }); } else ev(S, 'draw');
}

// ------------------------------------------------------------ drawing helpers
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function txt(s, x, y, size, col = '#fff', align = 'left', o = {}) {
  ctx.font = `${o.weight || 700} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = o.base || 'top';
  if (o.stroke !== 0) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke || Math.max(3, size / 7); ctx.strokeStyle = o.strokeCol || 'rgba(10,8,30,0.9)'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function hexRGB(h) { if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number); h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function shade(h, f) { const c = hexRGB(h); const k = v => Math.round(clamp(f < 0 ? v * (1 + f) : v + (255 - v) * f, 0, 255)); return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`; }
function rgba(h, a) { const c = hexRGB(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function glow(col, blur) { ctx.shadowColor = col; ctx.shadowBlur = blur; }
function noGlow() { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
// the players: round blobs with a face. look = { col, face }
function drawBlob(x, y, r, look, o = {}) {
  const ang = o.ang || 0, sq = o.squash || 1, col = look.col;
  ctx.save(); ctx.translate(x, y);
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, r * 0.82, r * 0.9, r * 0.28, 0, 0, 6.3); ctx.fill(); }
  ctx.scale(1 / sq, sq);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
  ctx.lineWidth = r * 0.08; ctx.strokeStyle = shade(col, -0.5); ctx.stroke();
  if (look.face === 'cat') { ctx.fillStyle = col; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.75, -r * 0.45); ctx.lineTo(s * r * 0.55, -r * 1.15); ctx.lineTo(s * r * 0.15, -r * 0.85); ctx.fill(); ctx.stroke(); } }
  if (look.face === 'crown') { ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.8); ctx.lineTo(-r * 0.5, -r * 1.25); ctx.lineTo(-r * 0.25, -r * 1.0); ctx.lineTo(0, -r * 1.35); ctx.lineTo(r * 0.25, -r * 1.0); ctx.lineTo(r * 0.5, -r * 1.25); ctx.lineTo(r * 0.5, -r * 0.8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a07a10'; ctx.lineWidth = r * 0.06; ctx.stroke(); }
  // eyes look toward ang
  const lx = Math.cos(ang) * r * 0.12, ly = Math.sin(ang) * r * 0.1;
  if (look.face === 'cool') { ctx.fillStyle = '#111'; rr(-r * 0.7 + lx, -r * 0.35 + ly, r * 0.6, r * 0.32, r * 0.12); ctx.fill(); rr(r * 0.1 + lx, -r * 0.35 + ly, r * 0.6, r * 0.32, r * 0.12); ctx.fill(); ctx.fillRect(-r * 0.15 + lx, -r * 0.3 + ly, r * 0.3, r * 0.08); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-r * 0.6 + lx, -r * 0.3 + ly, r * 0.15, r * 0.06); }
  else {
    const blink = o.blink ? 0.15 : 1;
    for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * r * 0.32 + lx, -r * 0.18 + ly, r * 0.22, r * 0.28 * blink, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#16122a'; ctx.beginPath(); ctx.arc(s * r * 0.32 + lx * 1.8, -r * 0.14 + ly * 1.8, r * 0.12 * Math.max(0.3, blink), 0, 6.3); ctx.fill(); }
    if (look.face === 'angry') { ctx.strokeStyle = '#16122a'; ctx.lineWidth = r * 0.1; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.55 + lx, -r * 0.55); ctx.lineTo(s * r * 0.12 + lx, -r * 0.4); ctx.stroke(); } }
  }
  // mouth
  ctx.strokeStyle = '#16122a'; ctx.lineWidth = r * 0.08; ctx.beginPath();
  if (o.mouth === 'o') { ctx.fillStyle = '#16122a'; ctx.ellipse(lx, r * 0.35, r * 0.13, r * 0.17, 0, 0, 6.3); ctx.fill(); }
  else if (o.mouth === 'sad') { ctx.arc(lx, r * 0.55, r * 0.25, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
  else { ctx.arc(lx, r * 0.15, r * 0.28, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); }
  ctx.restore();
}
// round status text in the middle of the screen
function drawRoundBanner(gs, S, names) {
  if (gs.phase === 'ready') { const n = gs.round + 1; txt(gs.final ? 'FINAL ROUND' : `ROUND ${n}`, W / 2, H / 2 - 60, 64, '#ffffff', 'center'); txt('GET READY', W / 2, H / 2 + 14, 28, '#ffe680', 'center'); }
  if (gs.phase === 'point') {
    const who = gs.pointTo, col = who === 0 || who === 1 ? S.players[who].look.col : '#ffffff';
    txt(who === 0 || who === 1 ? `${S.players[who].name} SCORES!` : 'DRAW!', W / 2, H / 2 - 60, 60, col, 'center', { stroke: 10 });
    if (gs.msg) txt(gs.msg, W / 2, H / 2 + 14, 26, '#ffffff', 'center');
  }
}
function drawScorePips(gs, S) {
  for (let i = 0; i < 2; i++) {
    const col = S.players[i].look.col;
    for (let k = 0; k < gs.target; k++) {
      const x = i === 0 ? 330 + k * 30 : W - 330 - k * 30, y = 52;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.3); ctx.fillStyle = k < gs.score[i] ? col : 'rgba(255,255,255,0.15)'; ctx.fill();
      if (k < gs.score[i]) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    }
  }
}

// ======================================================================
//  1. LIGHT CYCLES
// ======================================================================
const LC = { CELL: 12, COLS: 100, ROWS: 49, X0: 40, Y0: 98 };
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const cycles = {
  id: 'cycles', name: 'LIGHT CYCLES', col: '#3ae8ff', target: 3,
  desc: 'Leave a light trail. Make the other player crash!',
  how: ['MOVE: turn', 'ACTION: speed boost (3 per round)'],
  init(S) { const gs = { phase: 'ready', timer: 1.3, round: 0, score: [0, 0], target: 3 }; this.reset(gs); return gs; },
  reset(gs) {
    gs.p = [{ x: 20, y: 24, d: 0, nd: 0, trail: [[20, 24]], boost: 0, charges: 3, dead: false }, { x: 79, y: 24, d: 2, nd: 2, trail: [[79, 24]], boost: 0, charges: 3, dead: false }];
    gs._occ = new Uint8Array(LC.COLS * LC.ROWS); gs.acc = [0, 0]; gs.t = 0;
    gs.p.forEach((p, i) => gs._occ[p.y * LC.COLS + p.x] = i + 1);
  },
  step(gs, inp, dt, S) {
    roundTick(gs, dt, S, g => this.reset(g));
    if (gs.phase !== 'play') return;
    gs.t += dt;
    for (let i = 0; i < 2; i++) {
      const p = gs.p[i], c = inp[i];
      // turn: prefer the axis perpendicular to where we're going
      const horiz = p.d % 2 === 0;
      if (horiz && c.y) p.nd = c.y > 0 ? 1 : 3; else if (!horiz && c.x) p.nd = c.x > 0 ? 0 : 2;
      if (pressedA(gs, inp, i) && p.charges > 0 && p.boost <= 0) { p.charges--; p.boost = 0.7; ev(S, 'boost', { p: i }); }
      p.boost -= dt;
    }
    // move in lock-step so head-on crashes are fair
    const speed = 15 + gs.t * 0.35;
    for (let i = 0; i < 2; i++) gs.acc[i] += dt * speed * (gs.p[i].boost > 0 ? 1.8 : 1);
    while (gs.acc[0] >= 1 || gs.acc[1] >= 1) {
      const movers = [0, 1].filter(i => gs.acc[i] >= 1);
      const next = movers.map(i => { const p = gs.p[i]; if ((p.nd + 2) % 4 !== p.d) { if (p.nd !== p.d) p.trail.push([p.x, p.y]); p.d = p.nd; } return [i, p.x + DIRS[p.d][0], p.y + DIRS[p.d][1]]; });
      for (const [i, nx, ny] of next) {
        gs.acc[i] -= 1;
        const p = gs.p[i];
        if (nx < 0 || ny < 0 || nx >= LC.COLS || ny >= LC.ROWS || gs._occ[ny * LC.COLS + nx]) p.dead = true;
        else { p.x = nx; p.y = ny; }
      }
      if (next.length === 2 && next[0][1] === next[1][1] && next[0][2] === next[1][2]) { gs.p[0].dead = gs.p[1].dead = true; }
      for (const [i] of next) { const p = gs.p[i]; if (!p.dead) gs._occ[p.y * LC.COLS + p.x] = i + 1; }
      if (gs.p[0].dead || gs.p[1].dead) {
        gs.p.forEach((p, i) => { if (p.dead) ev(S, 'boom', { x: LC.X0 + p.x * LC.CELL + 6, y: LC.Y0 + p.y * LC.CELL + 6, c: S.players[i].look.col }); });
        givePoint(gs, S, gs.p[0].dead && gs.p[1].dead ? -1 : gs.p[0].dead ? 1 : 0, gs.p[0].dead && gs.p[1].dead ? 'Both crashed' : 'CRASH!');
        return;
      }
    }
  },
  ai(gs, i, lvl) {
    const p = gs.p[i], occ = gs._occ; if (!occ || gs.phase !== 'play') return { x: 0, y: 0, a: false };
    const free = (x, y) => x >= 0 && y >= 0 && x < LC.COLS && y < LC.ROWS && !occ[y * LC.COLS + x];
    const cap = [60, 300, 900][lvl];
    // easy reacts slowly: often keeps going straight unless the wall is right there
    if (lvl === 0 && Math.random() < 0.85 && free(p.x + DIRS[p.d][0] * 2, p.y + DIRS[p.d][1] * 2)) return { x: 0, y: 0, a: false };
    const space = (x, y) => { // flood fill size (capped)
      if (!free(x, y)) return -1; const seen = new Uint8Array(LC.COLS * LC.ROWS), q = [x, y]; seen[y * LC.COLS + x] = 1; let n = 0, h = 0;
      while (h < q.length && n < cap) { const cx = q[h++], cy = q[h++]; n++; for (const [dx, dy] of DIRS) { const ax = cx + dx, ay = cy + dy; if (free(ax, ay) && !seen[ay * LC.COLS + ax]) { seen[ay * LC.COLS + ax] = 1; q.push(ax, ay); } } }
      return n;
    };
    // hard: count the cells I can reach before the opponent can (territory)
    const dist = (sx, sy) => { const D = new Int16Array(LC.COLS * LC.ROWS).fill(-1); if (!free(sx, sy)) return D; const q = [sx, sy]; let h = 0; D[sy * LC.COLS + sx] = 0;
      while (h < q.length) { const cx = q[h++], cy = q[h++], dd = D[cy * LC.COLS + cx]; for (const [dx, dy] of DIRS) { const ax = cx + dx, ay = cy + dy; if (free(ax, ay) && D[ay * LC.COLS + ax] < 0) { D[ay * LC.COLS + ax] = dd + 1; q.push(ax, ay); } } }
      return D; };
    const o = gs.p[1 - i];
    let oD = null; if (lvl >= 2) oD = dist(o.x + DIRS[o.d][0], o.y + DIRS[o.d][1]);
    let best = p.d, bs = -1e9;
    for (const d of [p.d, (p.d + 1) % 4, (p.d + 3) % 4]) {
      const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1];
      let s = space(nx, ny); if (s < 0) continue;
      let run = 0; for (let k = 1; k < 8 && free(p.x + DIRS[d][0] * k, p.y + DIRS[d][1] * k); k++) run++;
      if (lvl >= 2) {
        const mD = dist(nx, ny); let mine = 0;
        for (let k = 0; k < mD.length; k++) if (mD[k] >= 0 && (oD[k] < 0 || mD[k] < oD[k])) mine++;
        s = Math.min(s, 900) * 0.3 + mine + run * 0.5;
        if (run < 2 && s > 40) s -= 20;   // don't hug walls when there's room
      } else s += run * 3 + (d === p.d ? 4 : 0);
      s += Math.random() * (lvl === 0 ? 30 : lvl === 1 ? 6 : 1);
      if (s > bs) { bs = s; best = d; }
    }
    const c = { x: 0, y: 0, a: false };
    if (best !== p.d) { c.x = DIRS[best][0]; c.y = DIRS[best][1]; }
    if (lvl >= 1 && p.charges && Math.random() < 0.004 * lvl) c.a = true;
    return c;
  },
  draw(gs, S, t) {
    const { CELL, COLS, ROWS, X0, Y0 } = LC;
    ctx.fillStyle = '#070a1c'; ctx.fillRect(X0 - 6, Y0 - 6, COLS * CELL + 12, ROWS * CELL + 12);
    ctx.strokeStyle = 'rgba(80,120,255,0.09)'; ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 2) { ctx.beginPath(); ctx.moveTo(X0 + x * CELL, Y0); ctx.lineTo(X0 + x * CELL, Y0 + ROWS * CELL); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y += 2) { ctx.beginPath(); ctx.moveTo(X0, Y0 + y * CELL); ctx.lineTo(X0 + COLS * CELL, Y0 + y * CELL); ctx.stroke(); }
    glow('#3a6aff', 18); ctx.strokeStyle = '#4a7aff'; ctx.lineWidth = 3; ctx.strokeRect(X0 - 4, Y0 - 4, COLS * CELL + 8, ROWS * CELL + 8); noGlow();
    gs.p.forEach((p, i) => {
      const col = S.players[i].look.col, pts = [...p.trail, [p.x, p.y]];
      const P = q => [X0 + q[0] * CELL + CELL / 2, Y0 + q[1] * CELL + CELL / 2];
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      glow(col, 16); ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.beginPath(); pts.forEach((q, k) => { const [x, y] = P(q); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      noGlow(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      const [hx, hy] = P([p.x, p.y]), a = Math.atan2(DIRS[p.d][1], DIRS[p.d][0]);
      if (!p.dead) { ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); glow(col, 24); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); if (p.boost > 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-20 - Math.random() * 10, 0); ctx.lineTo(-6, 4); ctx.fill(); } noGlow(); ctx.restore(); }
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(i === 0 ? 140 + k * 22 : W - 140 - k * 22, 703, 6, 0, 6.3); ctx.fillStyle = k < p.charges ? col : 'rgba(255,255,255,0.12)'; ctx.fill(); }
    });
    txt('BOOSTS', 50, 694, 15, '#9aa2c0', 'left', { stroke: 0 }); txt('BOOSTS', W - 50, 694, 15, '#9aa2c0', 'right', { stroke: 0 });
    drawRoundBanner(gs, S);
  },
};

// ======================================================================
//  2. SUMO SMASH
// ======================================================================
const SUMO = { cx: 640, cy: 410 };
const sumo = {
  id: 'sumo', name: 'SUMO SMASH', col: '#ff9a3a', target: 3,
  desc: 'Push the other blob off the shrinking ring!',
  how: ['MOVE: roll around', 'ACTION: dash'],
  init(S) { const gs = { phase: 'ready', timer: 1.3, round: 0, score: [0, 0], target: 3 }; this.reset(gs); return gs; },
  reset(gs) { gs.R = 290; gs.t = 0; gs.p = [{ x: SUMO.cx - 150, y: SUMO.cy, vx: 0, vy: 0, cd: 0, dash: 0, fall: 0, ang: 0 }, { x: SUMO.cx + 150, y: SUMO.cy, vx: 0, vy: 0, cd: 0, dash: 0, fall: 0, ang: Math.PI }]; },
  step(gs, inp, dt, S) {
    roundTick(gs, dt, S, g => this.reset(g));
    if (gs.phase === 'point') { gs.p.forEach(p => { if (p.fall > 0) { p.fall += dt; p.x += p.vx * dt; p.y += p.vy * dt; } }); }
    if (gs.phase !== 'play') return;
    gs.t += dt; gs.R = Math.max(150, 290 - gs.t * 4.5);
    const r = 36;
    for (let i = 0; i < 2; i++) {
      const p = gs.p[i], c = inp[i], l = Math.hypot(c.x, c.y) || 1;
      p.vx += c.x / l * Math.min(1, Math.hypot(c.x, c.y)) * 1500 * dt; p.vy += c.y / l * Math.min(1, Math.hypot(c.x, c.y)) * 1500 * dt;
      if (c.x || c.y) p.ang = Math.atan2(c.y, c.x);
      p.cd -= dt; p.dash -= dt;
      if (pressedA(gs, inp, i) && p.cd <= 0) { p.cd = 1.2; p.dash = 0.25; p.vx += Math.cos(p.ang) * 780; p.vy += Math.sin(p.ang) * 780; ev(S, 'dash', { x: p.x, y: p.y, p: i }); }
      const drag = Math.pow(0.08, dt); p.vx *= drag; p.vy *= drag;
      const sp = Math.hypot(p.vx, p.vy), max = p.dash > 0 ? 1100 : 480; if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    const a = gs.p[0], b = gs.p[1], d = dist(a, b);
    if (d < r * 2 && d > 0.01) {
      const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, ov = r * 2 - d;
      a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) {
        const k = rel * 1.25 + 160 + (a.dash > 0 ? 260 : 0) * 0 + 0;
        const ka = a.dash > 0 ? 0.55 : 1, kb = b.dash > 0 ? 0.55 : 1;   // dashing makes you heavier
        a.vx -= nx * k * ka; a.vy -= ny * k * ka; b.vx += nx * k * kb; b.vy += ny * k * kb;
        ev(S, 'bump', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, s: Math.min(1, rel / 600) });
      }
    }
    const out = gs.p.map(p => Math.hypot(p.x - SUMO.cx, p.y - SUMO.cy) > gs.R + 8);
    if (out[0] || out[1]) {
      gs.p.forEach((p, i) => { if (out[i]) { p.fall = 0.01; ev(S, 'fall', { x: p.x, y: p.y, p: i }); } });
      givePoint(gs, S, out[0] && out[1] ? -1 : out[0] ? 1 : 0, out[0] && out[1] ? 'Both fell off' : 'RING OUT!');
    }
  },
  ai(gs, i, lvl) {
    if (gs.phase !== 'play') return { x: 0, y: 0, a: false };
    const p = gs.p[i], o = gs.p[1 - i], dc = Math.hypot(p.x - SUMO.cx, p.y - SUMO.cy), od = Math.hypot(o.x - SUMO.cx, o.y - SUMO.cy);
    let tx, ty;
    if (dc > gs.R - 70) { tx = SUMO.cx; ty = SUMO.cy; }   // too close to the edge: get back in
    else { // get behind the opponent (between them and the centre) and push outward
      const ax = o.x - SUMO.cx, ay = o.y - SUMO.cy, al = Math.hypot(ax, ay) || 1;
      tx = o.x - ax / al * 60 * (lvl >= 1 ? 1 : 0.2); ty = o.y - ay / al * 60 * (lvl >= 1 ? 1 : 0.2);
      if (dist(p, { x: tx, y: ty }) < 40) { tx = o.x; ty = o.y; }
    }
    const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1;
    const jitter = [0.6, 0.25, 0.08][lvl];
    const c = { x: dx / l + rand(-jitter, jitter), y: dy / l + rand(-jitter, jitter), a: false };
    const toO = Math.atan2(o.y - p.y, o.x - p.x);
    if (dist(p, o) < 170 && Math.abs(wrapA(p.ang - toO)) < 0.35 && Math.random() < [0.02, 0.06, 0.12][lvl]) c.a = true;
    return c;
  },
  draw(gs, S, t) {
    const R = gs.R;
    ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 80, W, H - 80);
    // lava pit
    const lg = ctx.createRadialGradient(SUMO.cx, SUMO.cy, 100, SUMO.cx, SUMO.cy, 650); lg.addColorStop(0, '#ff6a1a'); lg.addColorStop(0.5, '#c83a1a'); lg.addColorStop(1, '#3a0a1a');
    ctx.fillStyle = lg; ctx.fillRect(0, 80, W, H - 80);
    for (let k = 0; k < 14; k++) { const a = k * 0.45 + t * 0.2, rr2 = 320 + (k % 4) * 60; ctx.fillStyle = 'rgba(255,220,80,0.25)'; ctx.beginPath(); ctx.arc(SUMO.cx + Math.cos(a) * rr2, SUMO.cy + Math.sin(a) * rr2 * 0.55, 10 + Math.sin(t * 3 + k) * 5, 0, 6.3); ctx.fill(); }
    // ring
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(SUMO.cx, SUMO.cy + 18, R + 6, R + 6, 0, 0, 6.3); ctx.fill();
    const g = ctx.createRadialGradient(SUMO.cx - 60, SUMO.cy - 80, 40, SUMO.cx, SUMO.cy, R); g.addColorStop(0, '#f4e2b8'); g.addColorStop(1, '#d4b47a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(SUMO.cx, SUMO.cy, R, 0, 6.3); ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = R < 200 ? `rgba(255,${80 + Math.sin(t * 10) * 60},60,1)` : '#b8862a'; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,80,30,0.5)'; ctx.beginPath(); ctx.arc(SUMO.cx, SUMO.cy, R * 0.55, 0, 6.3); ctx.stroke();
    for (const s of [-1, 1]) { ctx.fillStyle = 'rgba(120,80,30,0.55)'; ctx.fillRect(SUMO.cx + s * 60 - 4, SUMO.cy - 30, 8, 60); }
    gs.p.forEach((p, i) => {
      const f = p.fall > 0 ? Math.max(0, 1 - p.fall * 1.6) : 1;
      if (f <= 0) return;
      const look = S.players[i].look, sp = Math.hypot(p.vx, p.vy);
      if (p.dash > 0) { ctx.fillStyle = rgba(look.col, 0.35); ctx.beginPath(); ctx.arc(p.x - p.vx * 0.04, p.y - p.vy * 0.04, 34, 0, 6.3); ctx.fill(); }
      drawBlob(p.x, p.y + (1 - f) * 40, 36 * f, look, { ang: p.ang, squash: 1 + Math.min(0.06, sp / 9000), mouth: p.fall > 0 ? 'o' : p.dash > 0 ? 'o' : null, alpha: f });
      if (p.cd > 0 && gs.phase === 'play') { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, 46, -Math.PI / 2, -Math.PI / 2 + (1 - p.cd / 1.2) * 6.28); ctx.stroke(); }
    });
    drawRoundBanner(gs, S);
  },
};

// ======================================================================
//  3. AIR HOCKEY
// ======================================================================
const AH = { x0: 110, y0: 116, x1: 1170, y1: 690, goal: 125 };
const hockey = {
  id: 'hockey', name: 'AIR HOCKEY', col: '#5ad8ff', target: 5,
  desc: 'First to 5 goals. Smack the puck past them!',
  how: ['MOVE: slide your paddle', 'ACTION: power smash'],
  init(S) { const gs = { phase: 'ready', timer: 1.3, round: 0, score: [0, 0], target: 5 }; this.reset(gs, Math.random() < 0.5 ? 0 : 1); return gs; },
  reset(gs, toward) {
    const cy = (AH.y0 + AH.y1) / 2;
    gs.p = [{ x: AH.x0 + 120, y: cy, vx: 0, vy: 0, sm: 0, cd: 0 }, { x: AH.x1 - 120, y: cy, vx: 0, vy: 0, sm: 0, cd: 0 }];
    gs.k = { x: 640 + (toward === 0 ? -140 : toward === 1 ? 140 : 0), y: cy, vx: 0, vy: 0 };
  },
  step(gs, inp, dt, S) {
    roundTick(gs, dt, S, g => this.reset(g, g.pointTo));
    if (gs.phase !== 'play') return;
    const PR = 42, KR = 22, mid = 640;
    for (let i = 0; i < 2; i++) {
      const p = gs.p[i], c = inp[i];
      p.vx = lerp(p.vx, c.x * 720, Math.min(1, dt * 14)); p.vy = lerp(p.vy, c.y * 720, Math.min(1, dt * 14));
      p.x += p.vx * dt; p.y += p.vy * dt;
      const minX = i === 0 ? AH.x0 + PR : mid + PR, maxX = i === 0 ? mid - PR : AH.x1 - PR;
      p.x = clamp(p.x, minX, maxX); p.y = clamp(p.y, AH.y0 + PR, AH.y1 - PR);
      p.cd -= dt; p.sm -= dt;
      if (pressedA(gs, inp, i) && p.cd <= 0) { p.cd = 0.8; p.sm = 0.18; ev(S, 'smash', { x: p.x, y: p.y, p: i }); }
    }
    const k = gs.k;
    // substeps so the fast puck never tunnels through paddles
    const steps = 4, h = dt / steps;
    for (let s = 0; s < steps; s++) {
      k.x += k.vx * h; k.y += k.vy * h;
      const cy = (AH.y0 + AH.y1) / 2, inGoal = Math.abs(k.y - cy) < AH.goal - KR * 0.3;
      if (k.y < AH.y0 + KR) { k.y = AH.y0 + KR; k.vy = Math.abs(k.vy) * 0.92; ev(S, 'wall', { x: k.x, y: k.y }); }
      if (k.y > AH.y1 - KR) { k.y = AH.y1 - KR; k.vy = -Math.abs(k.vy) * 0.92; ev(S, 'wall', { x: k.x, y: k.y }); }
      if (!inGoal) {
        if (k.x < AH.x0 + KR) { k.x = AH.x0 + KR; k.vx = Math.abs(k.vx) * 0.92; ev(S, 'wall', { x: k.x, y: k.y }); }
        if (k.x > AH.x1 - KR) { k.x = AH.x1 - KR; k.vx = -Math.abs(k.vx) * 0.92; ev(S, 'wall', { x: k.x, y: k.y }); }
      } else {
        if (k.x < AH.x0 - KR) { ev(S, 'goal', { x: AH.x0, y: k.y, p: 1 }); givePoint(gs, S, 1, 'GOAL!'); return; }
        if (k.x > AH.x1 + KR) { ev(S, 'goal', { x: AH.x1, y: k.y, p: 0 }); givePoint(gs, S, 0, 'GOAL!'); return; }
      }
      for (const p of gs.p) {
        const dx = k.x - p.x, dy = k.y - p.y, d = Math.hypot(dx, dy);
        if (d < PR + KR && d > 0.01) {
          const nx = dx / d, ny = dy / d; k.x = p.x + nx * (PR + KR); k.y = p.y + ny * (PR + KR);
          const rel = (k.vx - p.vx) * nx + (k.vy - p.vy) * ny;
          if (rel < 0) { k.vx -= 1.9 * rel * nx; k.vy -= 1.9 * rel * ny + rand(-60, 60); k.vx += p.vx * 0.35; k.vy += p.vy * 0.35; if (p.sm > 0) { k.vx += nx * 650; k.vy += ny * 650; p.sm = 0; } ev(S, 'hit', { x: k.x, y: k.y, s: Math.min(1, Math.hypot(k.vx, k.vy) / 1400) }); }
        }
      }
    }
    const sp = Math.hypot(k.vx, k.vy); if (sp > 1500) { k.vx *= 1500 / sp; k.vy *= 1500 / sp; }
    // a puck resting on the centre line gets a little nudge
    if (sp < 25 && Math.abs(k.x - 640) < 40) { gs._still = (gs._still || 0) + dt; if (gs._still > 1.2) { gs._still = 0; k.vx = (Math.random() < 0.5 ? -1 : 1) * 160; k.vy = rand(-80, 80); } } else gs._still = 0;
    const fr = Math.pow(0.7, dt); k.vx *= fr; k.vy *= fr;
  },
  ai(gs, i, lvl) {
    if (gs.phase !== 'play') return { x: 0, y: 0, a: false };
    const p = gs.p[i], k = gs.k, home = i === 0 ? AH.x0 + 90 : AH.x1 - 90, myHalf = i === 0 ? k.x < 640 : k.x > 640, dir = i === 0 ? 1 : -1;
    let tx, ty;
    const react = [0.45, 0.7, 0.97][lvl];
    if (!gs._aim) gs._aim = [0, 0];
    if (!myHalf) gs._aim[i] = rand(-30, 30) * [0.5, 1, 1.2][lvl];     // pick a new angle for the next shot
    if (myHalf && (k.x - p.x) * dir > -10) { tx = k.x - dir * 30; ty = k.y + gs._aim[i]; }        // strike it (off-centre to angle the shot)
    else if (myHalf) { tx = k.x - dir * 70; ty = k.y + (k.y > p.y ? -50 : 50); }                       // get around it
    else { tx = home; ty = lerp((AH.y0 + AH.y1) / 2, k.y, 0.6 * react); }                               // defend
    const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy);
    const c = { x: l > 6 ? dx / l * Math.min(1, l / 40) * react : 0, y: l > 6 ? dy / l * Math.min(1, l / 40) * react : 0, a: false };
    if (myHalf && dist(p, k) < 90 && lvl >= 1 && Math.random() < 0.15) c.a = true;
    return c;
  },
  draw(gs, S, t) {
    const cy = (AH.y0 + AH.y1) / 2;
    ctx.fillStyle = '#0a1028'; ctx.fillRect(0, 80, W, H - 80);
    rr(AH.x0 - 14, AH.y0 - 14, AH.x1 - AH.x0 + 28, AH.y1 - AH.y0 + 28, 40); ctx.fillStyle = '#2a3a6a'; ctx.fill();
    rr(AH.x0, AH.y0, AH.x1 - AH.x0, AH.y1 - AH.y0, 30);
    const g = ctx.createLinearGradient(0, AH.y0, 0, AH.y1); g.addColorStop(0, '#e8f4ff'); g.addColorStop(1, '#c8dcf0'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(80,140,220,0.08)'; for (let x = AH.x0 + 20; x < AH.x1; x += 40) for (let y = AH.y0 + 20; y < AH.y1; y += 40) ctx.fillRect(x, y, 3, 3);
    ctx.strokeStyle = 'rgba(232,58,90,0.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(640, AH.y0); ctx.lineTo(640, AH.y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(640, cy, 90, 0, 6.3); ctx.stroke();
    ctx.strokeStyle = rgba(S.players[0].look.col, 0.5); ctx.beginPath(); ctx.arc(AH.x0, cy, AH.goal + 30, -1.6, 1.6); ctx.stroke();
    ctx.strokeStyle = rgba(S.players[1].look.col, 0.5); ctx.beginPath(); ctx.arc(AH.x1, cy, AH.goal + 30, 1.55, 4.7); ctx.stroke();
    ctx.restore();
    for (const [x, i] of [[AH.x0, 0], [AH.x1, 1]]) { glow(S.players[i].look.col, 20); ctx.fillStyle = '#05060f'; ctx.fillRect(x - 10, cy - AH.goal, 20, AH.goal * 2); noGlow(); }
    // puck
    const k = gs.k, sp = Math.hypot(k.vx, k.vy);
    if (sp > 600) { ctx.fillStyle = 'rgba(30,30,50,0.2)'; for (let n = 1; n < 4; n++) { ctx.beginPath(); ctx.arc(k.x - k.vx * 0.012 * n, k.y - k.vy * 0.012 * n, 22 - n * 3, 0, 6.3); ctx.fill(); } }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(k.x + 4, k.y + 6, 22, 18, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1a1a26'; ctx.beginPath(); ctx.arc(k.x, k.y, 22, 0, 6.3); ctx.fill(); ctx.fillStyle = '#3a3a50'; ctx.beginPath(); ctx.arc(k.x, k.y, 15, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(k.x - 7, k.y - 7, 5, 0, 6.3); ctx.fill();
    gs.p.forEach((p, i) => {
      const col = S.players[i].look.col;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 8, 42, 34, 0, 0, 6.3); ctx.fill();
      if (p.sm > 0) { glow('#ffffff', 30); }
      const g2 = ctx.createRadialGradient(p.x - 12, p.y - 14, 4, p.x, p.y, 44); g2.addColorStop(0, shade(col, 0.5)); g2.addColorStop(1, shade(col, -0.25)); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x, p.y, 42, 0, 6.3); ctx.fill(); noGlow();
      ctx.fillStyle = shade(col, -0.35); ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, 6.3); ctx.fill();
      drawBlob(p.x, p.y - 2, 20, S.players[i].look, { ang: Math.atan2(k.y - p.y, k.x - p.x), shadow: false });
    });
    drawRoundBanner(gs, S);
  },
};

// ======================================================================
//  4. QUICK DRAW
// ======================================================================
const quickdraw = {
  id: 'quickdraw', name: 'QUICK DRAW', col: '#ffcc33', target: 3,
  desc: 'Wait for "DRAW!" then press ACTION first. Too early = you lose!',
  how: ['ACTION: shoot (only after DRAW!)'],
  init(S) { const gs = { phase: 'ready', timer: 1.3, round: 0, score: [0, 0], target: 3, best: [0, 0] }; this.reset(gs); return gs; },
  reset(gs) { gs.sub = 'wait'; gs.wait = rand(1.8, 4.6); gs.since = 0; gs.react = [null, null]; gs.drawId = (gs.drawId || 0) + 1; gs.loser = -1; gs.fake = Math.random() < 0.3 ? rand(0.6, gs.wait - 0.4) : -1; },
  step(gs, inp, dt, S) {
    roundTick(gs, dt, S, g => this.reset(g));
    if (gs.phase !== 'play') return;
    if (gs.sub === 'wait') {
      gs.wait -= dt;
      for (let i = 0; i < 2; i++) if (pressedA(gs, inp, i)) { gs.loser = i; ev(S, 'shot', { p: i }); givePoint(gs, S, 1 - i, 'TOO EARLY!'); return; }
      if (gs.wait <= 0) { gs.sub = 'draw'; gs.since = 0; ev(S, 'drawcall'); }
    } else {
      gs.since += dt;
      for (let i = 0; i < 2; i++) {
        if (gs.react[i] !== null) continue;
        const rm = inp[i].react;
        if (rm && rm.id === gs.drawId) { gs.react[i] = rm.ms; continue; }   // measured on the player's own computer (fair online)
        if (pressedA(gs, inp, i) && !inp[i].remote) gs.react[i] = Math.round(gs.since * 1000);
      }
      const has = gs.react.filter(r => r !== null).length;
      if (has && (has === 2 || gs.since > (S.online ? 0.9 : 0.05) + Math.min(...gs.react.filter(r => r !== null)) / 1000)) {
        const w = gs.react[1] === null || (gs.react[0] !== null && gs.react[0] <= gs.react[1]) ? 0 : 1;
        gs.loser = 1 - w; gs.best[w] = gs.best[w] ? Math.min(gs.best[w], gs.react[w]) : gs.react[w];
        ev(S, 'shot', { p: w }); givePoint(gs, S, w, `${gs.react[w]} ms`);
      } else if (gs.since > 2.5) givePoint(gs, S, -1, 'Too slow...');
    }
  },
  ai(gs, i, lvl) {
    const c = { x: 0, y: 0, a: false };
    if (gs.phase !== 'play' || gs.sub !== 'draw') { if (gs.sub === 'wait' && lvl === 0 && Math.random() < 0.0008) c.a = true; return c; }
    if (!gs._aiT) gs._aiT = {};
    const key = gs.drawId + '_' + i;
    if (gs._aiT[key] === undefined) gs._aiT[key] = [rand(0.3, 0.55), rand(0.22, 0.4), rand(0.18, 0.3)][lvl];
    if (gs.since >= gs._aiT[key]) c.a = true;
    return c;
  },
  draw(gs, S, t) {
    // sunset desert
    const sky = ctx.createLinearGradient(0, 80, 0, 520); sky.addColorStop(0, '#3a1a5a'); sky.addColorStop(0.5, '#e8603a'); sky.addColorStop(1, '#ffcc66');
    ctx.fillStyle = sky; ctx.fillRect(0, 80, W, 440);
    ctx.fillStyle = '#ffe8a0'; ctx.beginPath(); ctx.arc(640, 470, 110, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#7a3a4a'; ctx.beginPath(); ctx.moveTo(0, 520); [[100, 430], [240, 470], [380, 400], [520, 480], [700, 430], [880, 470], [1050, 390], [1180, 460], [1280, 430], [1280, 520]].forEach(([x, y]) => ctx.lineTo(x, y)); ctx.fill();
    const gr = ctx.createLinearGradient(0, 510, 0, H); gr.addColorStop(0, '#d8904a'); gr.addColorStop(1, '#8a4a2a'); ctx.fillStyle = gr; ctx.fillRect(0, 510, W, H - 510);
    // cacti
    for (const x of [150, 1120]) { ctx.fillStyle = '#2a6a3a'; rr(x - 14, 420, 28, 110, 14); ctx.fill(); rr(x - 44, 450, 18, 50, 9); ctx.fill(); rr(x + 26, 440, 18, 44, 9); ctx.fill(); ctx.fillRect(x - 30, 486, 20, 12); ctx.fillRect(x + 12, 474, 20, 12); }
    // tumbleweed
    const tx = ((t * 120) % 1600) - 160; ctx.strokeStyle = '#a8784a'; ctx.lineWidth = 3; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(tx, 600 - Math.abs(Math.sin(t * 5)) * 30, 18 - k * 2, k, k + 4); ctx.stroke(); }
    // gunslingers
    gs.p = gs.p || 0;
    [0, 1].forEach(i => {
      const x = i === 0 ? 360 : 920, y = 560, look = S.players[i].look, dead = gs.phase === 'point' && gs.loser === i, shot = gs.phase === 'point' && gs.pointTo === i;
      ctx.save(); if (dead) { ctx.translate(x, y + 40); ctx.rotate((i === 0 ? -1 : 1) * Math.min(1.4, (1.8 - gs.timer) * 6)); ctx.translate(-x, -y - 40); }
      drawBlob(x, y, 52, look, { ang: i === 0 ? 0 : Math.PI, mouth: dead ? 'o' : gs.sub === 'draw' ? 'o' : null, blink: dead });
      // cowboy hat
      ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(x, y - 46, 62, 13, 0, 0, 6.3); ctx.fill(); rr(x - 32, y - 92, 64, 48, 14); ctx.fill(); ctx.fillStyle = '#c83a3a'; ctx.fillRect(x - 32, y - 58, 64, 8);
      // gun
      const gx = x + (i === 0 ? 58 : -58), up = shot || (gs.sub === 'draw' && gs.react[i] !== null);
      ctx.save(); ctx.translate(gx, y + 10); ctx.scale(i === 0 ? 1 : -1, 1); ctx.rotate(up ? -0.15 : 0.9);
      ctx.fillStyle = '#3a3a4a'; ctx.fillRect(0, -6, 44, 12); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-4, -4, 14, 26);
      if (shot && gs.timer > 1.55) { ctx.fillStyle = '#ffe650'; ctx.beginPath(); ctx.arc(54, 0, 18, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(54, 0, 8, 0, 6.3); ctx.fill(); }
      ctx.restore(); ctx.restore();
      if (gs.react[i] !== null && gs.react[i] !== undefined) txt(`${gs.react[i]} ms`, x, y - 150, 30, '#ffffff', 'center');
      if (gs.best[i]) txt(`best ${gs.best[i]} ms`, i === 0 ? 60 : W - 60, 100, 18, '#ffe8c8', i === 0 ? 'left' : 'right');
    });
    if (gs.phase === 'play' && gs.sub === 'wait') { const fake = gs.fake > 0 && gs.wait < gs.fake && gs.wait > gs.fake - 0.5; txt(fake ? 'DRA...' : 'WAIT FOR IT...', W / 2, 220, fake ? 70 : 44, fake ? '#ff8a6a' : '#ffffff', 'center', { stroke: 9 }); }
    if (gs.phase === 'play' && gs.sub === 'draw') { const s = 1 + Math.max(0, 0.25 - gs.since) * 2; ctx.save(); ctx.translate(W / 2, 250); ctx.scale(s, s); txt('DRAW!', 0, -60, 130, '#ff3a3a', 'center', { stroke: 16 }); ctx.restore(); }
    drawRoundBanner(gs, S);
  },
};

// ======================================================================
//  5. COIN RUSH
// ======================================================================
const CR = { x0: 70, y0: 110, x1: 1210, y1: 690, TIME: 30 };
const coinrush = {
  id: 'coinrush', name: 'COIN RUSH', col: '#ffd84a', target: 1,
  desc: 'Grab the most coins in 30 seconds. Watch out for bombs!',
  how: ['MOVE: run', 'ACTION: dash'],
  init(S) { const gs = { phase: 'ready', timer: 1.3, round: 0, score: [0, 0], target: 1, final: true }; this.reset(gs); return gs; },
  reset(gs) { gs.time = CR.TIME; gs.c = [0, 0]; gs.coins = []; gs.bombs = []; gs.spawn = 0; gs.bombT = 2; gs.p = [{ x: 400, y: 400, vx: 0, vy: 0, cd: 0, dash: 0, stun: 0, ang: 0 }, { x: 880, y: 400, vx: 0, vy: 0, cd: 0, dash: 0, stun: 0, ang: Math.PI }]; gs.ot = false; gs.nid = 0; },
  step(gs, inp, dt, S) {
    roundTick(gs, dt, S, g => this.reset(g));
    if (gs.phase !== 'play') return;
    gs.time -= dt;
    // spawn coins + bombs
    gs.spawn -= dt;
    if (gs.spawn <= 0 && gs.coins.length < 16) { gs.spawn = 0.32; const gem = Math.random() < 0.08; gs.coins.push({ id: ++gs.nid, x: rand(CR.x0 + 30, CR.x1 - 30), y: rand(CR.y0 + 30, CR.y1 - 30), v: gem ? 5 : 1, t: 0 }); }
    gs.bombT -= dt;
    if (gs.bombT <= 0) { gs.bombT = Math.max(0.6, 1.6 - (CR.TIME - gs.time) * 0.03); const tgt = Math.random() < 0.6 ? gs.p[Math.floor(Math.random() * 2)] : null; gs.bombs.push({ x: tgt ? tgt.x + rand(-60, 60) : rand(CR.x0 + 60, CR.x1 - 60), y: tgt ? tgt.y + rand(-60, 60) : rand(CR.y0 + 60, CR.y1 - 60), t: 1.3 }); }
    for (const b of gs.bombs) {
      b.t -= dt;
      if (b.t <= 0 && !b.done) {
        b.done = true; ev(S, 'bomb', { x: b.x, y: b.y });
        gs.p.forEach((p, i) => { if (Math.hypot(p.x - b.x, p.y - b.y) < 80 && p.stun <= 0) { p.stun = 1.1; const lose = Math.min(gs.c[i], 3); gs.c[i] -= lose; for (let n = 0; n < lose; n++) { const a = rand(0, 6.28); gs.coins.push({ id: ++gs.nid, x: clamp(p.x + Math.cos(a) * rand(60, 130), CR.x0 + 20, CR.x1 - 20), y: clamp(p.y + Math.sin(a) * rand(60, 130), CR.y0 + 20, CR.y1 - 20), v: 1, t: 0 }); } ev(S, 'stun', { p: i, x: p.x, y: p.y }); } });
      }
    }
    gs.bombs = gs.bombs.filter(b => b.t > -0.4);
    for (let i = 0; i < 2; i++) {
      const p = gs.p[i], c = inp[i];
      p.stun -= dt; p.cd -= dt; p.dash -= dt;
      const can = p.stun <= 0, l = Math.hypot(c.x, c.y);
      if (can && l > 0.1) { p.ang = Math.atan2(c.y, c.x); }
      const sp = p.dash > 0 ? 900 : 330;
      const tx = can && l > 0.1 ? c.x / Math.max(1, l) * sp : 0, ty = can && l > 0.1 ? c.y / Math.max(1, l) * sp : 0;
      p.vx = lerp(p.vx, p.dash > 0 ? Math.cos(p.ang) * sp : tx, Math.min(1, dt * 12)); p.vy = lerp(p.vy, p.dash > 0 ? Math.sin(p.ang) * sp : ty, Math.min(1, dt * 12));
      if (pressedA(gs, inp, i) && can && p.cd <= 0) { p.cd = 1; p.dash = 0.18; ev(S, 'dash', { x: p.x, y: p.y, p: i }); }
      p.x = clamp(p.x + p.vx * dt, CR.x0 + 28, CR.x1 - 28); p.y = clamp(p.y + p.vy * dt, CR.y0 + 28, CR.y1 - 28);
      for (const co of gs.coins) if (!co.got && Math.hypot(co.x - p.x, co.y - p.y) < 40) { co.got = true; gs.c[i] += co.v; ev(S, co.v > 1 ? 'gem' : 'coin', { x: co.x, y: co.y, p: i }); }
    }
    gs.coins = gs.coins.filter(c => !c.got); gs.coins.forEach(c => c.t += dt);
    // players bump
    const a = gs.p[0], b = gs.p[1], d = dist(a, b);
    if (d < 56 && d > 0.1) { const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, o = (56 - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; if (a.dash > 0 && b.stun <= 0) { b.stun = 0.5; ev(S, 'stun', { p: 1, x: b.x, y: b.y }); } if (b.dash > 0 && a.stun <= 0) { a.stun = 0.5; ev(S, 'stun', { p: 0, x: a.x, y: a.y }); } }
    if (gs.time <= 0) {
      if (gs.c[0] === gs.c[1]) { gs.time = 5; gs.ot = true; ev(S, 'overtime'); return; }
      givePoint(gs, S, gs.c[0] > gs.c[1] ? 0 : 1, `${Math.max(...gs.c)} to ${Math.min(...gs.c)}`);
    }
  },
  ai(gs, i, lvl) {
    if (gs.phase !== 'play') return { x: 0, y: 0, a: false };
    const p = gs.p[i];
    let best = null, bs = -1e9;
    for (const c of gs.coins) { let s = c.v * 140 - Math.hypot(c.x - p.x, c.y - p.y) + (Math.random() * [200, 60, 10][lvl]); for (const b of gs.bombs) if (!b.done && Math.hypot(c.x - b.x, c.y - b.y) < 95) s -= 400; if (s > bs) { bs = s; best = c; } }
    let tx = best ? best.x : 640, ty = best ? best.y : 400;
    let dx = tx - p.x, dy = ty - p.y;
    for (const b of gs.bombs) if (!b.done) { const bx = p.x - b.x, by = p.y - b.y, bd = Math.hypot(bx, by); if (bd < 110 && lvl > 0) { dx += bx / bd * 300; dy += by / bd * 300; } }
    const l = Math.hypot(dx, dy) || 1, c = { x: dx / l, y: dy / l, a: false };
    if (lvl >= 1 && best && Math.hypot(tx - p.x, ty - p.y) > 220 && Math.random() < 0.05) c.a = true;
    return c;
  },
  draw(gs, S, t) {
    ctx.fillStyle = '#123a24'; ctx.fillRect(0, 80, W, H - 80);
    rr(CR.x0, CR.y0, CR.x1 - CR.x0, CR.y1 - CR.y0, 24); const g = ctx.createLinearGradient(0, CR.y0, 0, CR.y1); g.addColorStop(0, '#5ab84a'); g.addColorStop(1, '#3a9a3a'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = CR.x0; x < CR.x1; x += 80) ctx.fillRect(x, CR.y0, 40, CR.y1 - CR.y0); ctx.restore();
    ctx.lineWidth = 8; ctx.strokeStyle = '#2a6a2a'; rr(CR.x0, CR.y0, CR.x1 - CR.x0, CR.y1 - CR.y0, 24); ctx.stroke();
    for (const b of gs.bombs) {
      if (!b.done) { const u = 1 - b.t / 1.3; ctx.fillStyle = `rgba(255,40,40,${0.15 + u * 0.25})`; ctx.beginPath(); ctx.arc(b.x, b.y, 80, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, 80 * u, 0, 6.3); ctx.stroke();
        const by = b.y - 400 * (1 - u); ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(b.x, by, 18, 0, 6.3); ctx.fill(); ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(b.x + 8, by - 18, 5 + Math.sin(t * 30) * 2, 0, 6.3); ctx.fill(); }
    }
    for (const c of gs.coins) {
      const s = Math.min(1, c.t * 5), w = Math.abs(Math.cos(t * 4 + c.id)) * 14 + 2;
      if (c.v > 1) { glow('#8af0ff', 18); ctx.fillStyle = '#5ae8ff'; ctx.beginPath(); ctx.moveTo(c.x, c.y - 20 * s); ctx.lineTo(c.x + 16 * s, c.y); ctx.lineTo(c.x, c.y + 20 * s); ctx.lineTo(c.x - 16 * s, c.y); ctx.fill(); noGlow(); ctx.fillStyle = '#ffffff'; ctx.fillRect(c.x - 4, c.y - 10, 4, 8); }
      else { ctx.fillStyle = '#c8901a'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 3, w * s, 16 * s, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, w * s, 16 * s, 0, 0, 6.3); ctx.fill(); }
    }
    gs.p.forEach((p, i) => { const look = S.players[i].look; drawBlob(p.x, p.y, 30, look, { ang: p.ang, mouth: p.stun > 0 ? 'o' : null, blink: p.stun > 0 }); if (p.stun > 0) for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; txt('*', p.x + Math.cos(a) * 26, p.y - 44 + Math.sin(a) * 6, 22, '#ffe650', 'center', { stroke: 3 }); } });
    // coin counters + timer
    for (let i = 0; i < 2; i++) { const x = i === 0 ? 180 : W - 180; ctx.fillStyle = '#c8901a'; ctx.beginPath(); ctx.arc(x + (i === 0 ? -50 : 50), 99, 15, 0, 6.3); ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x + (i === 0 ? -50 : 50), 96, 15, 0, 6.3); ctx.fill(); txt(String(gs.c[i]), x, 80, 34, S.players[i].look.col, 'center'); }
    if (gs.phase === 'play') txt(gs.ot ? `OVERTIME ${Math.ceil(gs.time)}` : String(Math.ceil(Math.max(0, gs.time))), W / 2, 96, 44, gs.time < 6 ? '#ff6a6a' : '#ffffff', 'center');
    drawRoundBanner(gs, S);
  },
};

// ======================================================================
//  6. TANK DUEL
// ======================================================================
const TD = { x0: 60, y0: 104, x1: 1220, y1: 690 };
const TANK_MAPS = [
  [[300, 220, 40, 220], [940, 260, 40, 220], [560, 300, 160, 40], [560, 470, 160, 40], [180, 560, 200, 30], [900, 200, 200, 30]],
  [[620, 104, 40, 180], [620, 510, 40, 180], [250, 330, 180, 40], [850, 330, 180, 40], [420, 200, 40, 120], [820, 400, 40, 120]],
  [[200, 250, 60, 60], [400, 450, 60, 60], [600, 250, 80, 80], [820, 450, 60, 60], [1020, 250, 60, 60], [600, 520, 80, 40], [600, 120, 80, 40]],
  [[340, 104, 30, 300], [910, 390, 30, 300], [520, 380, 240, 30], [620, 180, 30, 120]],
];
function circleRect(x, y, r, R) { const cx = clamp(x, R[0], R[0] + R[2]), cy = clamp(y, R[1], R[1] + R[3]), dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); return d < r ? { nx: d ? dx / d : 0, ny: d ? dy / d : -1, o: r - d } : null; }
const tanks = {
  id: 'tanks', name: 'TANK DUEL', col: '#8aff6a', target: 3,
  desc: 'Bouncing shells! One hit wins the round. Careful, yours can hit you too.',
  how: ['UP/DOWN: drive   LEFT/RIGHT: turn', 'ACTION: fire'],
  init(S) { const gs = { phase: 'ready', timer: 1.3, round: 0, score: [0, 0], target: 3 }; this.reset(gs); return gs; },
  reset(gs) { gs.map = Math.floor(Math.random() * TANK_MAPS.length); gs.p = [{ x: 120, y: 400, a: 0, dead: false, cd: 0 }, { x: 1160, y: 400, a: Math.PI, dead: false, cd: 0 }]; gs.b = []; gs.nid = 0; },
  walls(gs) { return TANK_MAPS[gs.map]; },
  step(gs, inp, dt, S) {
    roundTick(gs, dt, S, g => this.reset(g));
    if (gs.phase !== 'play') return;
    const walls = this.walls(gs);
    for (let i = 0; i < 2; i++) {
      const p = gs.p[i], c = inp[i]; if (p.dead) continue;
      p.a += c.x * 3.1 * dt;
      const sp = c.y < 0 ? 210 : c.y > 0 ? -140 : 0;
      p.x += Math.cos(p.a) * sp * dt; p.y += Math.sin(p.a) * sp * dt;
      p.x = clamp(p.x, TD.x0 + 24, TD.x1 - 24); p.y = clamp(p.y, TD.y0 + 24, TD.y1 - 24);
      for (const R of walls) { const h = circleRect(p.x, p.y, 24, R); if (h) { p.x += h.nx * h.o; p.y += h.ny * h.o; } }
      p.cd -= dt;
      if (pressedA(gs, inp, i) && p.cd <= 0 && gs.b.filter(b => b.o === i).length < 4) { p.cd = 0.3; gs.b.push({ id: ++gs.nid, x: p.x + Math.cos(p.a) * 34, y: p.y + Math.sin(p.a) * 34, vx: Math.cos(p.a) * 430, vy: Math.sin(p.a) * 430, o: i, life: 6, age: 0 }); ev(S, 'fire', { x: p.x + Math.cos(p.a) * 34, y: p.y + Math.sin(p.a) * 34, p: i }); }
    }
    for (const b of gs.b) {
      b.life -= dt; b.age += dt;
      const steps = 3, h = dt / steps;
      for (let s = 0; s < steps; s++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < TD.x0 + 6 || b.x > TD.x1 - 6) { b.vx *= -1; b.x = clamp(b.x, TD.x0 + 6, TD.x1 - 6); }
        if (b.y < TD.y0 + 6 || b.y > TD.y1 - 6) { b.vy *= -1; b.y = clamp(b.y, TD.y0 + 6, TD.y1 - 6); }
        for (const R of walls) { const hit = circleRect(b.x, b.y, 6, R); if (hit) { if (Math.abs(hit.nx) > Math.abs(hit.ny)) b.vx = Math.abs(b.vx) * Math.sign(hit.nx); else b.vy = Math.abs(b.vy) * Math.sign(hit.ny || -1); b.x += hit.nx * hit.o; b.y += hit.ny * hit.o; } }
      }
      for (let i = 0; i < 2; i++) { const p = gs.p[i]; if (p.dead || (b.o === i && b.age < 0.25)) continue; if (Math.hypot(b.x - p.x, b.y - p.y) < 26) { p.dead = true; b.life = 0; ev(S, 'boom', { x: p.x, y: p.y, c: S.players[i].look.col, big: 1 }); } }
    }
    gs.b = gs.b.filter(b => b.life > 0);
    const d0 = gs.p[0].dead, d1 = gs.p[1].dead;
    if (d0 || d1) givePoint(gs, S, d0 && d1 ? -1 : d0 ? 1 : 0, d0 && d1 ? 'Both destroyed' : 'DIRECT HIT!');
  },
  ai(gs, i, lvl) {
    const c = { x: 0, y: 0, a: false }; if (gs.phase !== 'play') return c;
    const p = gs.p[i], o = gs.p[1 - i], walls = this.walls(gs); if (p.dead) return c;
    const clear = (ax, ay, bx, by) => { for (let k = 1; k < 20; k++) { const x = lerp(ax, bx, k / 20), y = lerp(ay, by, k / 20); if (walls.some(R => x > R[0] - 6 && x < R[0] + R[2] + 6 && y > R[1] - 6 && y < R[1] + R[3] + 6)) return false; } return true; };
    // dodge incoming shells
    for (const b of gs.b) { const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy); if (d < 140 && (b.vx * dx + b.vy * dy) > 0 && lvl > 0) { const side = Math.sign(b.vx * dy - b.vy * dx) || 1; const want = Math.atan2(b.vy, b.vx) + side * Math.PI / 2; c.x = Math.sign(wrapA(want - p.a)); c.y = -1; return c; } }
    let target = Math.atan2(o.y - p.y, o.x - p.x);
    const sees = clear(p.x, p.y, o.x, o.y);
    if (!sees) {   // go around: head to a waypoint that has a clear path to the enemy
      if (!gs._wp) gs._wp = {}; let wp = gs._wp[i];
      if (!wp || dist(p, wp) < 40 || Math.random() < 0.005) { let best = null, bs = 1e9; for (let k = 0; k < 30; k++) { const q = { x: rand(TD.x0 + 40, TD.x1 - 40), y: rand(TD.y0 + 40, TD.y1 - 40) }; if (walls.some(R => circleRect(q.x, q.y, 30, R))) continue; const s = dist(p, q) * 0.6 + (clear(q.x, q.y, o.x, o.y) ? 0 : 400) + (clear(p.x, p.y, q.x, q.y) ? 0 : 600); if (s < bs) { bs = s; best = q; } } gs._wp[i] = wp = best; }
      if (wp) target = Math.atan2(wp.y - p.y, wp.x - p.x);
    }
    const da = wrapA(target - p.a);
    c.x = Math.abs(da) > 0.08 ? Math.sign(da) : 0;
    c.y = Math.abs(da) < 0.9 && (!sees || dist(p, o) > 260) ? -1 : 0;
    if (sees && Math.abs(da) < [0.3, 0.15, 0.08][lvl] && Math.random() < [0.03, 0.08, 0.22][lvl]) c.a = true;
    return c;
  },
  draw(gs, S, t) {
    ctx.fillStyle = '#16202a'; ctx.fillRect(0, 80, W, H - 80);
    ctx.fillStyle = '#26323e'; ctx.fillRect(TD.x0, TD.y0, TD.x1 - TD.x0, TD.y1 - TD.y0);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; for (let x = TD.x0; x < TD.x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, TD.y0); ctx.lineTo(x, TD.y1); ctx.stroke(); } for (let y = TD.y0; y < TD.y1; y += 40) { ctx.beginPath(); ctx.moveTo(TD.x0, y); ctx.lineTo(TD.x1, y); ctx.stroke(); }
    ctx.lineWidth = 6; ctx.strokeStyle = '#4a5a6a'; ctx.strokeRect(TD.x0, TD.y0, TD.x1 - TD.x0, TD.y1 - TD.y0);
    for (const R of this.walls(gs)) { ctx.fillStyle = '#0e141a'; ctx.fillRect(R[0] + 5, R[1] + 6, R[2], R[3]); ctx.fillStyle = '#5a6a7a'; ctx.fillRect(R[0], R[1], R[2], R[3]); ctx.fillStyle = '#7a8a9a'; ctx.fillRect(R[0], R[1], R[2], 5); }
    for (const b of gs.b) { const col = S.players[b.o].look.col; glow(col, 14); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 6.3); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 6.3); ctx.fill(); noGlow(); }
    gs.p.forEach((p, i) => {
      if (p.dead) return;
      const col = S.players[i].look.col;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(4, 6, 30, 26, 0, 0, 6.3); ctx.fill();
      ctx.rotate(p.a);
      ctx.fillStyle = '#2a2a32'; rr(-26, -26, 52, 12, 4); ctx.fill(); rr(-26, 14, 52, 12, 4); ctx.fill();
      ctx.fillStyle = '#4a4a56'; for (let k = 0; k < 6; k++) { ctx.fillRect(-24 + k * 9 + ((t * 30) % 9), -25, 3, 10); ctx.fillRect(-24 + k * 9 + ((t * 30) % 9), 15, 3, 10); }
      ctx.fillStyle = shade(col, -0.2); rr(-22, -16, 44, 32, 8); ctx.fill(); ctx.fillStyle = col; rr(-18, -12, 36, 24, 6); ctx.fill();
      ctx.fillStyle = shade(col, -0.45); ctx.fillRect(4, -5, 32, 10); ctx.fillStyle = '#16161e'; ctx.fillRect(32, -6, 6, 12);
      ctx.restore();
      drawBlob(p.x, p.y, 13, S.players[i].look, { ang: p.a, shadow: false });
    });
    drawRoundBanner(gs, S);
  },
};

// ======================================================================
//  7. TUG OF WAR
// ======================================================================
const tug = {
  id: 'tug', name: 'TUG OF WAR', col: '#ff6ab0', target: 1,
  desc: 'MASH the ACTION key as fast as you can to pull the rope! 20 seconds.',
  how: ['ACTION: pull (mash it!)'],
  init(S) { const gs = { phase: 'ready', timer: 1.6, round: 0, score: [0, 0], target: 1, final: true, pos: 0, n: [0, 0], wob: 0, time: 20 }; return gs; },
  reset(gs) {},
  step(gs, inp, dt, S) {
    roundTick(gs, dt, S, g => this.reset(g));
    if (gs.phase !== 'play') return;
    for (let i = 0; i < 2; i++) if (pressedA(gs, inp, i)) { gs.n[i]++; gs.pos += i === 0 ? -0.022 : 0.022; gs.wob = 1; if (gs.n[i] % 4 === 0) ev(S, 'pull', { p: i }); }
    gs.wob = Math.max(0, gs.wob - dt * 4); gs.time -= dt;
    if (gs.time <= 0 && Math.abs(gs.pos) > 0.001) { givePoint(gs, S, gs.pos < 0 ? 0 : 1, 'Time! Closest to winning takes it'); return; }
    if (Math.abs(gs.pos) >= 1) { ev(S, 'splash', { x: gs.pos < 0 ? 860 : 420, y: 520 }); givePoint(gs, S, gs.pos < 0 ? 0 : 1, 'Into the mud!'); }
  },
  ai(gs, i, lvl) {
    const c = { x: 0, y: 0, a: false }; if (gs.phase !== 'play') return c;
    if (!gs._ai) gs._ai = [0, 0];
    gs._ai[i] -= 1 / 60; if (gs._ai[i] <= 0) { gs._ai[i] = 1 / [6.5, 8.5, 10.5][lvl] * rand(0.75, 1.25); c.a = true; }
    return c;
  },
  draw(gs, S, t) {
    const sky = ctx.createLinearGradient(0, 80, 0, 460); sky.addColorStop(0, '#5ab8ff'); sky.addColorStop(1, '#c8f0ff'); ctx.fillStyle = sky; ctx.fillRect(0, 80, W, 380);
    for (let k = 0; k < 5; k++) { const x = ((k * 300 + t * 20) % 1500) - 100; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, 160 + k % 2 * 50, 70, 24, 0, 0, 6.3); ctx.ellipse(x + 40, 150 + k % 2 * 50, 50, 26, 0, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = '#5ac84a'; ctx.fillRect(0, 460, W, H - 460);
    // mud pit
    ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(640, 540, 150, 46, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(620, 530, 90, 22, 0, 0, 6.3); ctx.fill();
    for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(60,40,20,0.7)'; ctx.beginPath(); ctx.arc(560 + k * 50, 548 + Math.sin(t * 3 + k) * 4, 6 + Math.sin(t * 2 + k) * 3, 0, 6.3); ctx.fill(); }
    const off = gs.pos * 220, wob = Math.sin(t * 40) * gs.wob * 4;
    // rope
    ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(260 + off, 500 + wob); ctx.quadraticCurveTo(640 + off, 520, 1020 + off, 500 - wob); ctx.stroke();
    ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#e83a3a'; ctx.fillRect(636 + off, 470, 8, 50); ctx.beginPath(); ctx.moveTo(644 + off, 470); ctx.lineTo(680 + off, 482); ctx.lineTo(644 + off, 494); ctx.fill();
    // markers
    for (const s of [-1, 1]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(640 + s * 220 - 3, 470, 6, 90); }
    [0, 1].forEach(i => {
      const look = S.players[i].look, x = (i === 0 ? 220 : 1060) + off, lean = (i === 0 ? -1 : 1) * (0.25 + gs.wob * 0.2);
      const lost = gs.phase === 'point' && gs.pointTo === 1 - i;
      ctx.save(); ctx.translate(x, 500); ctx.rotate(lean);
      drawBlob(0, -10, 50, look, { ang: i === 0 ? 0 : Math.PI, mouth: 'o', squash: 1 + gs.wob * 0.08 });
      ctx.restore();
      if (lost) { ctx.fillStyle = 'rgba(100,70,40,0.6)'; ctx.beginPath(); ctx.arc(x, 520, 60, 0, 6.3); ctx.fill(); }
      txt(String(gs.n[i]), i === 0 ? 120 : W - 120, 110, 44, look.col, 'center');
      txt('pulls', i === 0 ? 120 : W - 120, 160, 18, '#ffffff', 'center');
    });
    if (gs.phase === 'play') { txt('MASH!', W / 2, 110 + Math.sin(t * 20) * 4, 60, '#ffe650', 'center', { stroke: 10 }); txt(String(Math.ceil(Math.max(0, gs.time))), W / 2, 190, 34, gs.time < 5 ? '#ff6a6a' : '#ffffff', 'center'); }
    drawRoundBanner(gs, S);
  },
};

const GAMES = { cycles, sumo, hockey, quickdraw, coinrush, tanks, tug };
const GAME_IDS = Object.keys(GAMES);
