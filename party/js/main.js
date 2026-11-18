// =====================================================================
//  PARTY CLASH - menus, party flow, players, settings, online
// =====================================================================
(() => {
'use strict';
// ------------------------------------------------------------ music
Object.assign(SONGS, {
  pmenu: { seed: 8101, bpm: 128, root: 60, scale: 'major', prog: [0, 5, 3, 4, 0, 5, 1, 4], density: 0.8, bass: 'x..x..x.x..x..x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: true, arpRate: 2, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.06, echo: 0.2 }, bass: { type: 'triangle', vol: 0.14 }, drumVol: 0.6 } },
  pplay: { seed: 8201, bpm: 150, root: 57, scale: 'dorian', prog: [0, 3, 6, 4, 0, 3, 5, 4], density: 0.9, bass: 'x.xx.xx.x.xx.xx.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', arp: true, arpRate: 1, form: ['A', 'B', 'A', 'C'], inst: { lead: { type: 'square', vol: 0.05 }, bass: { type: 'triangle', vol: 0.15 }, drumVol: 0.75 } },
  pwin: { seed: 8301, bpm: 132, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], density: 0.85, bass: 'x...x...x...x...', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: true, arpRate: 2, inst: { lead: { type: 'square', vol: 0.07 }, drumVol: 0.6 } },
});

// ------------------------------------------------------------ save
const SAVE_KEY = 'cnatt_party';
// signed-in arcade players play online under their account name
const myName = () => (window.Account && Account.user && Account.user.username) || save.players[0].name;
// the site owner gets a gold OWNER tag next to their name
const OWN = () => !!(window.Account && Account.isOwnerMe && Account.isOwnerMe());
const isOwner = p => !!(p && p.own && window.Account && (!S || !S.online || Account.ownerOK(p.name, p.own)));
const ownTag = (x, y, h, align) => (window.Account && Account.drawOwnerTag ? Account.drawOwnerTag(ctx, x, y, h, align) : 0);
const COLORS = ['#3a9aff', '#ff4a6a', '#5ad84a', '#ffcc33', '#b06aff', '#ff8a2a', '#3ae8d8', '#ff6ad8', '#e8e8f0', '#5a5a6a'];
const FACES = ['happy', 'angry', 'cool', 'cat', 'crown'];
const DEF_BINDS = [{ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyF' }, { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Enter' }];
let save = { players: [{ name: 'Player 1', look: { col: COLORS[0], face: 'happy' } }, { name: 'Player 2', look: { col: COLORS[1], face: 'angry' } }], cpu: -1, target: 5, binds: null, set: { music: 0.8, sfx: 0.9, shake: true }, stats: { matches: 0, wins: [0, 0], react: 0, played: {} } };
try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) save = Object.assign(save, d); } catch (e) {}
save.binds = [0, 1].map(i => Object.assign({}, DEF_BINDS[i], (save.binds || [])[i]));
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const applyAudio = () => Sound.setVolumes(save.set.music, save.set.sfx);

// ------------------------------------------------------------ input
const keys = {}, actN = [0, 0];
const mouse = { x: -1, y: -1 }, UI = { click: null, down: false, hover: null, lastHover: null };
function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('pointerdown', e => { e.preventDefault(); [mouse.x, mouse.y] = toCanvas(e); UI.down = true; UI.px = mouse.x; UI.py = mouse.y; });
cv.addEventListener('pointermove', e => { [mouse.x, mouse.y] = toCanvas(e); });
cv.addEventListener('pointerup', e => { const [x, y] = toCanvas(e); UI.down = false; UI.click = { x, y, px: UI.px, py: UI.py }; });
let typing = null, capture = null;     // typing: { get, set, max, re }  capture: { p, a }
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace', 'Enter'].includes(e.code)) e.preventDefault();
  if (capture) { if (e.code !== 'Escape') { const B = save.binds, old = B[capture.p][capture.a]; for (const p of [0, 1]) for (const a in B[p]) if (B[p][a] === e.code) B[p][a] = old; B[capture.p][capture.a] = e.code; store(); Sound.play('click'); } capture = null; return; }
  if (typing) {
    if (e.key === 'Backspace') typing.set(typing.get().slice(0, -1));
    else if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') { if (typing.done && e.key === 'Enter') typing.done(); typing = null; store(); }
    else if (e.key.length === 1 && typing.re.test(e.key) && typing.get().length < typing.max) typing.set(typing.get() + (typing.upper ? e.key.toUpperCase() : e.key));
    return;
  }
  if (!keys[e.code]) { for (let i = 0; i < 2; i++) if (save.binds[i].act === e.code || (i === 0 && e.code === 'Space')) actN[i]++; if (ui === 'game' && net.role) { if (e.code === save.binds[0].act || e.code === save.binds[1].act || e.code === 'Space') myPress(); } }
  keys[e.code] = true;
  if (e.code === 'Escape') { if (ui === 'game' && !net.role) paused = !paused; else if (ui === 'game' && net.role) paused = !paused; else if (ui === 'settings' || ui === 'looks' || ui === 'select') go('title'); }
  if (e.code === 'KeyM' && !typing) Sound.setMusic(!Sound.musicOn);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function localInput(i, both) {
  const sets = both ? save.binds : [save.binds[i]];
  const on = a => sets.some(B => keys[B[a]]);
  return { x: (on('right') ? 1 : 0) - (on('left') ? 1 : 0), y: (on('down') ? 1 : 0) - (on('up') ? 1 : 0), a: on('act') || (both && keys.Space), aN: both ? actN[0] + actN[1] : actN[i] };
}

// ------------------------------------------------------------ state shared with the network
let S = null, ui = 'title', paused = false, t = 0;
const cpuIn = [{ x: 0, y: 0, a: false, aN: 0 }, { x: 0, y: 0, a: false, aN: 0 }];
function newS(mode, players) {
  return { scr: 'card', mode, game: null, gs: null, crowns: [0, 0], target: save.target, order: [], played: [], players, timer: 0, ev: [], evN: 0, online: !!net.role, winner: -1, spin: null, cpu: net.role ? -1 : save.cpu };
}
function startMatch(mode, gameId) {
  const players = net.role ? [{ name: myName(), look: save.players[0].look, own: OWN() }, net.guest || { name: 'Guest', look: { col: COLORS[1], face: 'happy' } }] : [Object.assign({}, save.players[0], { own: OWN() }), save.cpu >= 0 ? { name: ['CPU (EASY)', 'CPU (NORMAL)', 'CPU (HARD)'][save.cpu], look: { col: save.players[1].look.col === save.players[0].look.col ? COLORS[5] : save.players[1].look.col, face: 'angry' } } : save.players[1]];
  const pl = JSON.parse(JSON.stringify(players));
  if (net.role) { // online: both players may still have the default look, so make sure they differ
    if (pl[1].look.col === pl[0].look.col) pl[1].look.col = COLORS.find(c => c !== pl[0].look.col && c !== COLORS[0]);
    if (pl[1].name === pl[0].name) pl[1].name = pl[1].name === 'Player 1' ? 'Player 2' : pl[1].name.slice(0, 10) + ' 2';
  }
  S = newS(mode, pl);
  if (mode === 'party') { S.order = GAME_IDS.slice().sort(() => Math.random() - 0.5); S.target = net.role ? net.cfg.target : save.target; }
  S.freeGame = gameId || null;
  lastEv = 0; fx = []; floats = [];
  beginGame(mode === 'free' ? gameId : S.order[0]);
  ui = 'game'; paused = false;
  Sound.playSong(SONGS.pplay);
}
function beginGame(id) {
  S.game = id; S.gs = GAMES[id].init(S); S.scr = 'card'; S.timer = 5; S.played.push(id);
  for (const k of [0, 1]) cpuIn[k].aN = 0;
}
// advance the match (host / offline only)
function stepMatch(dt, inp) {
  if (S.scr === 'card') { S.timer -= dt; if (S.timer > 3.2 && (inp[0].aN !== S._a0 || inp[1].aN !== S._a1) && S._a0 !== undefined) S.timer = 3.2; S._a0 = inp[0].aN; S._a1 = inp[1].aN; if (S.timer <= 0) { S.scr = 'play'; ev(S, 'start'); } return; }
  if (S.scr === 'play') {
    GAMES[S.game].step(S.gs, inp, dt, S);
    if (S.gs.phase === 'done') {
      S.winner = S.gs.winner; S.scr = 'result'; S.timer = 3.4;
      if (S.mode === 'party') S.crowns[S.winner]++;
      ev(S, 'gamewin', { p: S.winner });
      if (S.game === 'quickdraw') { const b = Math.min(...S.gs.best.filter(x => x)); if (b && (!save.stats.react || b < save.stats.react) && !net.role) { save.stats.react = b; store(); } }
    }
    return;
  }
  if (S.scr === 'result') {
    S.timer -= dt;
    if (S.timer <= 0) {
      if (S.mode === 'party' && Math.max(...S.crowns) < S.target) {
        // spin the wheel for the next game
        let left = S.order.filter(id => !S.played.includes(id)); if (!left.length) { S.played = [S.game]; left = GAME_IDS.filter(id => id !== S.game); }
        S.spin = { pick: pick(left), t: 0 }; S.scr = 'spin'; S.timer = 3; ev(S, 'spin');
      } else { S.scr = 'final'; S.timer = 0; S.matchWinner = S.mode === 'party' ? (S.crowns[0] > S.crowns[1] ? 0 : 1) : S.winner; ev(S, 'final', { p: S.matchWinner }); if (window.Arcade && (net.role || S.cpu >= 0)) Arcade.event('party', 'match', { won: S.matchWinner === (net.role === 'client' ? 1 : 0) }); if (!net.role) { save.stats.matches++; save.stats.wins[S.matchWinner]++; store(); } }
    }
    return;
  }
  if (S.scr === 'spin') { S.timer -= dt; S.spin.t += dt; if (S.timer <= 0) beginGame(S.spin.pick); return; }
  if (S.scr === 'final') S.timer += dt;
}

// ------------------------------------------------------------ effects (from events)
let fx = [], floats = [], lastEv = 0, shake = 0;
function burst(x, y, n, col, sp = 300, size = 5) { for (let k = 0; k < n; k++) { const a = rand(0, 6.28), v = rand(0.2, 1) * sp; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.3, 0.7), col, s: rand(size * 0.5, size) }); } }
function handleEvents() {
  if (!S) return;
  for (const e of S.ev) {
    if (e.id <= lastEv) continue; lastEv = e.id;
    const pc = e.p !== undefined && S.players[e.p] ? S.players[e.p].look.col : '#ffffff';
    switch (e.k) {
      case 'start': case 'go': Sound.blip(880, 0.25, { type: 'square', vol: 0.1 }); break;
      case 'point': Sound.play('catch', 2); [523, 659, 784].forEach((f, i) => Sound.blip(f, 0.1, { type: 'square', vol: 0.08, delay: i * 0.06 })); break;
      case 'draw': Sound.blip(300, 0.3, { type: 'triangle', vol: 0.1 }); break;
      case 'boom': burst(e.x, e.y, e.big ? 50 : 34, e.c || '#ffaa33', e.big ? 420 : 320, 7); burst(e.x, e.y, 16, '#ffffff', 200, 4); doShake(e.big ? 0.6 : 0.45); Sound.hiss(0.5, { filter: 'lowpass', freq: 900, sweep: 120, vol: 0.25 }); Sound.blip(70, 0.3, { type: 'sine', vol: 0.15, slide: 35 }); break;
      case 'boost': Sound.hiss(0.4, { filter: 'bandpass', freq: 900, sweep: 3000, q: 1, vol: 0.15 }); break;
      case 'dash': burst(e.x, e.y, 10, pc, 160, 5); Sound.hiss(0.15, { filter: 'bandpass', freq: 1500, q: 2, vol: 0.1 }); break;
      case 'bump': burst(e.x, e.y, 8 + e.s * 14, '#ffffff', 220, 5); doShake(0.15 + e.s * 0.35); Sound.blip(120 + e.s * 80, 0.12, { type: 'square', vol: 0.12, slide: 60 }); break;
      case 'fall': burst(e.x, e.y, 30, '#ffb03a', 260, 7); Sound.blip(500, 0.6, { type: 'triangle', vol: 0.12, slide: 120 }); break;
      case 'smash': burst(e.x, e.y, 12, '#ffffff', 200, 4); Sound.blip(200, 0.08, { type: 'square', vol: 0.08, slide: 400 }); break;
      case 'wall': Sound.blip(260, 0.04, { type: 'triangle', vol: 0.06 }); break;
      case 'hit': burst(e.x, e.y, 4 + e.s * 10, '#ffffff', 200, 3); Sound.blip(520 + e.s * 300, 0.05, { type: 'square', vol: 0.08 }); if (e.s > 0.6) doShake(0.15); break;
      case 'goal': burst(e.x, e.y, 60, pc, 420, 7); doShake(0.5); floats.push({ x: W / 2, y: 200, s: 'GOAL!', col: pc, t: 0, big: 1 }); Sound.hiss(0.8, { filter: 'bandpass', freq: 1800, q: 1, vol: 0.2 }); break;
      case 'shot': Sound.hiss(0.25, { filter: 'lowpass', freq: 3000, vol: 0.3 }); Sound.blip(90, 0.2, { type: 'square', vol: 0.15, slide: 40 }); doShake(0.3); break;
      case 'drawcall': Sound.blip(1200, 0.12, { type: 'square', vol: 0.12 }); break;
      case 'bomb': burst(e.x, e.y, 36, '#ff8a3a', 340, 7); burst(e.x, e.y, 12, '#3a3a3a', 160, 9); doShake(0.35); Sound.hiss(0.4, { filter: 'lowpass', freq: 800, vol: 0.22 }); break;
      case 'stun': floats.push({ x: e.x, y: e.y - 40, s: 'OUCH!', col: '#ff6a6a', t: 0 }); break;
      case 'coin': burst(e.x, e.y, 6, '#ffd84a', 140, 4); floats.push({ x: e.x, y: e.y - 20, s: '+1', col: pc, t: 0 }); Sound.blip(988 + Math.random() * 200, 0.06, { type: 'square', vol: 0.05 }); break;
      case 'gem': burst(e.x, e.y, 14, '#8af0ff', 200, 5); floats.push({ x: e.x, y: e.y - 20, s: '+5', col: '#8af0ff', t: 0, big: 1 }); [1319, 1568, 2093].forEach((f, i) => Sound.blip(f, 0.06, { type: 'square', vol: 0.06, delay: i * 0.04 })); break;
      case 'overtime': floats.push({ x: W / 2, y: 300, s: 'TIE! OVERTIME', col: '#ffe650', t: 0, big: 1 }); break;
      case 'fire': burst(e.x, e.y, 5, '#ffe08a', 120, 4); Sound.blip(160, 0.08, { type: 'square', vol: 0.08, slide: 60 }); break;
      case 'pull': Sound.blip(e.p ? 330 : 262, 0.05, { type: 'triangle', vol: 0.07 }); break;
      case 'splash': burst(e.x, e.y, 50, '#6a4a2a', 300, 8); doShake(0.4); break;
      case 'gamewin': floats.push({ x: W / 2, y: 260, s: '', col: pc, t: 0 }); [523, 659, 784, 1047].forEach((f, i) => Sound.blip(f, 0.12, { type: 'square', vol: 0.09, delay: i * 0.09 })); break;
      case 'spin': Sound.play('tab'); break;
      case 'final': Sound.playSong(SONGS.pwin); for (let k = 0; k < 6; k++) burst(rand(200, 1080), rand(200, 500), 30, pick(COLORS), 380, 7); break;
    }
  }
}
function doShake(a) { if (save.set.shake) shake = Math.max(shake, a); }

// ------------------------------------------------------------ UI widgets
function button(id, x, y, w, h, label, o = {}) {
  const over = mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h && !o.disabled;
  if (over) UI.hover = id;
  const s = over ? 1.05 : 1, cx = x + w / 2, cy = y + h / 2, base = o.disabled ? '#3a3f58' : (o.color || '#ff7a1a');
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(over ? -0.01 : 0); ctx.translate(-cx, -cy);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(x + 4, y + 7, w, h, o.r || 18); ctx.fill();
  rr(x, y, w, h, o.r || 18); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(base, 0.22)); g.addColorStop(1, shade(base, -0.18)); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = o.selected ? '#ffffff' : shade(base, -0.4); ctx.stroke();
  rr(x + 5, y + 4, w - 10, h * 0.38, (o.r || 18) - 5); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  if (o.draw) o.draw(x, y, w, h);
  if (label) txt(label, cx, cy - (o.size || 26) * 0.58, o.size || 26, o.disabled ? '#9aa0b8' : '#ffffff', 'center', { stroke: Math.max(3, (o.size || 26) / 6) });
  ctx.restore();
  const c = UI.click;
  if (c && !o.disabled && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { UI.click = null; Sound.play(o.sfx || 'click'); return true; }
  return false;
}
function panel(x, y, w, h, col = 'rgba(20,16,50,0.82)') { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(x + 6, y + 8, w, h, 26); ctx.fill(); rr(x, y, w, h, 26); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.stroke(); }
const KEYN = { Space: 'SPACE', Enter: 'ENTER', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=' };
const keyName = c => KEYN[c] || (c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? 'NUM' + c.slice(6) : c.slice(0, 6).toUpperCase());
function gameIcon(id, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const G = GAMES[id];
  ctx.fillStyle = shade(G.col, -0.55); ctx.beginPath(); ctx.arc(0, 0, 50, 0, 6.3); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = G.col; ctx.stroke();
  ctx.fillStyle = G.col; ctx.strokeStyle = G.col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (id === 'cycles') { ctx.beginPath(); ctx.moveTo(-30, 20); ctx.lineTo(-30, -10); ctx.lineTo(0, -10); ctx.lineTo(0, 15); ctx.stroke(); ctx.strokeStyle = '#ff6ab0'; ctx.beginPath(); ctx.moveTo(30, -20); ctx.lineTo(30, 10); ctx.lineTo(10, 10); ctx.stroke(); }
  else if (id === 'sumo') { ctx.fillStyle = '#e8d0a0'; ctx.beginPath(); ctx.arc(0, 4, 34, 0, 6.3); ctx.fill(); ctx.fillStyle = '#3a9aff'; ctx.beginPath(); ctx.arc(-12, 0, 13, 0, 6.3); ctx.fill(); ctx.fillStyle = '#ff4a6a'; ctx.beginPath(); ctx.arc(14, 8, 13, 0, 6.3); ctx.fill(); }
  else if (id === 'hockey') { ctx.fillStyle = '#1a1a26'; ctx.beginPath(); ctx.arc(0, 8, 14, 0, 6.3); ctx.fill(); ctx.fillStyle = G.col; ctx.beginPath(); ctx.arc(-20, -16, 16, 0, 6.3); ctx.fill(); }
  else if (id === 'quickdraw') { ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(0, 4, 38, 9, 0, 0, 6.3); ctx.fill(); rr(-20, -26, 40, 30, 10); ctx.fill(); ctx.fillStyle = '#c83a3a'; ctx.fillRect(-20, -6, 40, 6); }
  else if (id === 'coinrush') { ctx.fillStyle = '#c8901a'; ctx.beginPath(); ctx.arc(2, 4, 26, 0, 6.3); ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.fillRect(-4, -15, 8, 30); }
  else if (id === 'tanks') { ctx.fillStyle = '#2a2a32'; ctx.fillRect(-30, -22, 60, 10); ctx.fillRect(-30, 12, 60, 10); ctx.fillStyle = G.col; rr(-24, -14, 48, 28, 6); ctx.fill(); ctx.fillStyle = shade(G.col, -0.4); ctx.fillRect(0, -5, 34, 10); }
  else if (id === 'tug') { ctx.strokeStyle = '#c8a060'; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(36, 0); ctx.stroke(); ctx.fillStyle = '#e83a3a'; ctx.fillRect(-4, -20, 8, 26); }
  ctx.restore();
}
function topBar() {
  ctx.fillStyle = 'rgba(10,8,30,0.85)'; ctx.fillRect(0, 0, W, 80);
  for (let i = 0; i < 2; i++) {
    const p = S.players[i], L = i === 0;
    drawBlob(L ? 46 : W - 46, 40, 26, p.look, { ang: L ? 0 : Math.PI, shadow: false });
    txt(p.name, L ? 86 : W - 86, 12, 26, p.look.col, L ? 'left' : 'right');
    let tw = 0; if (isOwner(p)) { const nw = ctx.measureText(p.name).width; tw = ownTag(L ? 96 + nw : W - 96 - nw, 14, 24, L ? 'left' : 'right') + 8; }
    if (net.role && i === (net.role === 'client' ? 1 : 0)) { const nw = (ctx.font = `700 26px ${FONT}`, ctx.measureText(p.name).width + tw); rr(L ? 96 + nw : W - 96 - nw - 54, 14, 54, 24, 8); ctx.fillStyle = '#ffffff'; ctx.fill(); txt('YOU', L ? 123 + nw : W - 123 - nw, 16, 16, '#14102a', 'center', { stroke: 0 }); }
    if (S.mode === 'party') for (let k = 0; k < S.target; k++) { const x = L ? 96 + k * 26 : W - 96 - k * 26; crown(x, 58, 0.5, k < S.crowns[i]); }
  }
  txt(GAMES[S.game].name, W / 2, 10, 30, GAMES[S.game].col, 'center');
  if (S.gs && S.gs.target > 1) drawScorePips(S.gs, S);
  if (net.role) {
    const pg = NetTransport.status.ping, stale = net.role === 'client' && net.lastRx && performance.now() - net.lastRx > 1500;
    txt(stale ? 'WAITING FOR HOST...' : (pg ? `ONLINE  ${pg} ms` : 'ONLINE'), W / 2, 46, 14, stale ? '#ff8a8a' : pg > 150 ? '#ffcc55' : '#7aff9a', 'center', { stroke: 0 });
  }
}
function crown(x, y, s, on) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = on ? '#ffcc33' : 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(-22, -12); ctx.lineTo(-10, 0); ctx.lineTo(0, -16); ctx.lineTo(10, 0); ctx.lineTo(22, -12); ctx.lineTo(20, 12); ctx.closePath(); ctx.fill();
  if (on) { ctx.strokeStyle = '#a07a10'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#ff4a6a'; ctx.beginPath(); ctx.arc(0, 4, 4, 0, 6.3); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------ game screens (drawn from S, same on host and guest)
function drawMatch(dt) {
  const R = S;
  ctx.fillStyle = '#120a2a'; ctx.fillRect(0, 0, W, H);
  topBar();
  ctx.save();
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 14);
  if (R.scr !== 'spin' && R.scr !== 'final') GAMES[R.game].draw(R.gs, R, t);
  // particles
  for (const p of fx) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const f of floats) { if (!f.s) continue; ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1); txt(f.s, f.x, f.y - f.t * 50, f.big ? 54 : 24, f.col, 'center'); ctx.globalAlpha = 1; }
  ctx.restore();
  if (R.scr === 'card') drawCard(R);
  if (R.scr === 'result') drawResult(R);
  if (R.scr === 'spin') drawSpin(R);
  if (R.scr === 'final') drawFinal(R);
  if (paused) drawPauseMenu();
}
function controlsLine(i) { const B = save.binds[i]; return `${keyName(B.up)} ${keyName(B.left)} ${keyName(B.down)} ${keyName(B.right)}  +  ${keyName(B.act)}`; }
function drawCard(R) {
  const G = GAMES[R.game];
  ctx.fillStyle = 'rgba(10,6,30,0.78)'; ctx.fillRect(0, 80, W, H - 80);
  const u = Math.min(1, (5 - R.timer) * 3), y0 = 120 + (1 - u) * 60;
  ctx.globalAlpha = u;
  panel(190, y0, 900, 470, 'rgba(26,20,64,0.95)');
  gameIcon(R.game, 330, y0 + 120, 1.3);
  txt(G.name, 430, y0 + 60, 56, G.col, 'left');
  txt(R.mode === 'party' ? `GAME ${R.played.length}` : 'FREE PLAY', 432, y0 + 130, 22, '#c8c0ff', 'left', { stroke: 0 });
  const words = G.desc.split(' '); let line = '', ly = y0 + 210;
  ctx.font = `600 26px ${FONT}`;
  for (const w of words) { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > 780 && line) { txt(line, 250, ly, 26, '#ffffff', 'left', { weight: 600 }); line = w; ly += 36; } else line = tt; }
  if (line) txt(line, 250, ly, 26, '#ffffff', 'left', { weight: 600 });
  G.how.forEach((h, k) => txt(h, 250, ly + 56 + k * 34, 22, '#ffe680', 'left', { weight: 600 }));
  if (!R.online) {
    txt(`${R.players[0].name}: ${controlsLine(0)}`, 250, y0 + 400, 18, R.players[0].look.col, 'left', { stroke: 3 });
    txt(R.cpu >= 0 ? `${R.players[1].name}: computer` : `${R.players[1].name}: ${controlsLine(1)}`, 250, y0 + 428, 18, R.players[1].look.col, 'left', { stroke: 3 });
  } else txt('Use WASD or the arrow keys, and F / SPACE / ENTER for ACTION', 250, y0 + 410, 18, '#c8c0ff', 'left', { stroke: 3 });
  ctx.globalAlpha = 1;
  if (R.timer < 3.2) { const n = Math.ceil(R.timer), f = R.timer % 1; ctx.save(); ctx.translate(W / 2, 640); ctx.scale(1 + f * 0.4, 1 + f * 0.4); txt(String(n), 0, -50, 90, '#ffffff', 'center', { stroke: 12 }); ctx.restore(); }
  else txt('press ACTION to skip', W / 2, 628, 20, '#9a92d0', 'center', { stroke: 0 });
}
function drawResult(R) {
  const w = R.winner, p = R.players[w], u = Math.min(1, (3.4 - R.timer) * 3);
  ctx.fillStyle = `rgba(10,6,30,${0.6 * u})`; ctx.fillRect(0, 80, W, H - 80);
  ctx.save(); ctx.translate(W / 2, 330); ctx.scale(u, u);
  drawBlob(0, 40, 80, p.look, { mouth: 'o' }); crown(0, -60, 1.6 + Math.sin(t * 6) * 0.1, true);
  ctx.restore();
  txt(`${p.name} WINS!`, W / 2, 470, 64, p.look.col, 'center', { stroke: 10 });
  if (R.mode === 'party') txt(`${R.crowns[0]}  -  ${R.crowns[1]}`, W / 2, 560, 44, '#ffffff', 'center');
}
function drawSpin(R) {
  ctx.fillStyle = 'rgba(10,6,30,0.85)'; ctx.fillRect(0, 80, W, H - 80);
  txt('NEXT GAME...', W / 2, 120, 44, '#ffffff', 'center');
  const u = Math.min(1, R.spin.t / 2.4), ease = 1 - Math.pow(1 - u, 3), N = GAME_IDS.length, target = GAME_IDS.indexOf(R.spin.pick);
  const pos = ease * (N * 3 + target);   // scroll through the list a few times
  for (let k = -2; k <= 2; k++) {
    const idx = ((Math.round(pos) + k) % N + N) % N, off = (Math.round(pos) - pos + k) * 230, x = W / 2 + off, s = 1 - Math.abs(off) / 700;
    ctx.globalAlpha = Math.max(0.15, s);
    panel(x - 105 * s, 260 - 20 * s, 210 * s, 260 * s, k === 0 && u >= 1 ? 'rgba(80,60,160,0.95)' : 'rgba(30,24,70,0.9)');
    gameIcon(GAME_IDS[idx], x, 340, s);
    txt(GAMES[GAME_IDS[idx]].name, x, 410, 22 * s, GAMES[GAME_IDS[idx]].col, 'center');
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffe650'; ctx.beginPath(); ctx.moveTo(W / 2, 250); ctx.lineTo(W / 2 - 18, 222); ctx.lineTo(W / 2 + 18, 222); ctx.fill();
}
function drawFinal(R) {
  const w = R.matchWinner, p = R.players[w];
  ctx.fillStyle = 'rgba(10,6,30,0.88)'; ctx.fillRect(0, 0, W, H);
  if (Math.random() < 0.3) burst(rand(0, W), -10, 1, pick(COLORS), 60, 6);
  for (const f of fx) f.vy += 5;
  txt(R.mode === 'party' ? 'PARTY CHAMPION!' : `${GAMES[R.game].name} WINNER`, W / 2, 60, 54, '#ffe650', 'center', { stroke: 10 });
  ctx.save(); ctx.translate(W / 2, 300); const b = 1 + Math.sin(t * 5) * 0.04; ctx.scale(b, 1 / b);
  drawBlob(0, 0, 110, p.look, { mouth: 'o' }); ctx.restore(); crown(W / 2, 170 + Math.sin(t * 4) * 6, 2.2, true);
  txt(p.name, W / 2, 440, 60, p.look.col, 'center', { stroke: 10 });
  if (isOwner(p)) ownTag(W / 2, 404, 32, 'center');
  if (R.mode === 'party') txt(`${R.crowns[0]}  -  ${R.crowns[1]}`, W / 2, 514, 36, '#ffffff', 'center');
  if (net.role === 'client') { txt('Waiting for the host...', W / 2, 600, 24, '#c8c0ff', 'center'); if (button('fleave', W / 2 - 110, 640, 220, 56, 'LEAVE', { color: '#8a2a3a', size: 22, sfx: 'back' })) leaveOnline(); return; }
  if (R.timer < 1) return;
  if (button('again', W / 2 - 330, 590, 300, 70, 'PLAY AGAIN', { color: '#2ac85a', size: 30 })) { if (net.role) hostStartMatch(); else startMatch(R.mode, R.freeGame); }
  if (button('fmenu', W / 2 + 30, 590, 300, 70, net.role ? 'LOBBY' : 'MENU', { color: '#5a4ab0', size: 30, sfx: 'back' })) { if (net.role) { net.screen = 'lobby'; netBroadcast({ t: 'lobbyback' }); go('online'); } else go('title'); }
}
function drawPauseMenu() {
  ctx.fillStyle = 'rgba(10,6,30,0.7)'; ctx.fillRect(0, 0, W, H);
  panel(W / 2 - 220, 200, 440, 300);
  txt(net.role ? 'MENU' : 'PAUSED', W / 2, 226, 50, '#ffffff', 'center');
  if (net.role) txt('(the game keeps going online)', W / 2, 286, 16, '#9a92d0', 'center', { stroke: 0 });
  if (button('pres', W / 2 - 160, 318, 320, 64, 'RESUME', { color: '#2ac85a', size: 28 })) paused = false;
  if (button('pquit', W / 2 - 160, 400, 320, 64, net.role ? 'LEAVE ROOM' : 'QUIT TO MENU', { color: '#8a2a3a', size: 26, sfx: 'back' })) { paused = false; if (net.role) { if (net.role === 'host') netBroadcast({ t: 'closed' }); leaveOnline(); } else go('title'); }
}

// ------------------------------------------------------------ menus
let bgBlobs = [];
function menuBackground(dt) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a1060'); g.addColorStop(0.5, '#4a1a7a'); g.addColorStop(1, '#1a2a6a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.08; ctx.translate(W / 2, H / 2); ctx.rotate(t * 0.05); for (let k = 0; k < 16; k++) { ctx.rotate(Math.PI / 8); ctx.fillStyle = k % 2 ? '#ffffff' : '#ffcc33'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1200, -150); ctx.lineTo(1200, 150); ctx.fill(); } ctx.restore();
  if (bgBlobs.length < 9) bgBlobs.push({ x: rand(0, W), y: rand(0, H), vx: rand(-90, 90), vy: rand(-90, 90), r: rand(18, 40), look: { col: pick(COLORS), face: pick(FACES) } });
  for (const b of bgBlobs) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < b.r || b.x > W - b.r) b.vx *= -1; if (b.y < b.r || b.y > H - b.r) b.vy *= -1; ctx.globalAlpha = 0.5; drawBlob(b.x, b.y, b.r, b.look, { ang: Math.atan2(b.vy, b.vx), shadow: false }); ctx.globalAlpha = 1; }
}
function logo(y) {
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.04 + Math.sin(t * 1.5) * 0.015);
  ctx.font = `700 110px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const word = 'PARTY', cols = ['#ff4a6a', '#ffcc33', '#5ad84a', '#3a9aff', '#b06aff'];
  let x = -ctx.measureText(word).width / 2;
  [...word].forEach((ch, i) => { const w = ctx.measureText(ch).width, yy = Math.sin(t * 4 + i) * 6; ctx.lineWidth = 18; ctx.strokeStyle = '#1a0a3a'; ctx.strokeText(ch, x + w / 2, yy); ctx.fillStyle = cols[i]; ctx.fillText(ch, x + w / 2, yy); x += w; });
  ctx.font = `700 70px ${FONT}`; ctx.lineWidth = 14; ctx.strokeText('CLASH!', 40, 84); const g = ctx.createLinearGradient(0, 50, 0, 120); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffcc33'); ctx.fillStyle = g; ctx.fillText('CLASH!', 40, 84);
  ctx.restore();
}
function drawTitle() {
  logo(130);
  const bx = W / 2 - 210, bw = 420;
  if (button('party', bx, 270, bw, 76, 'PARTY MODE', { color: '#ff4a6a', size: 36 })) startMatch('party');
  txt('First to', bx + 10, 360, 20, '#ffffff', 'left', { stroke: 3 });
  [3, 5, 7].forEach((n, i) => { if (button('tg' + n, bx + 110 + i * 70, 352, 60, 38, String(n), { color: save.target === n ? '#ffcc33' : '#4a3a8a', size: 20, selected: save.target === n, sfx: 'tab' })) { save.target = n; store(); } });
  crown(bx + 340, 371, 0.7, true); txt('crowns', bx + 360, 360, 20, '#ffffff', 'left', { stroke: 3 });
  if (button('free', bx, 404, bw, 62, 'FREE PLAY', { color: '#3a9aff', size: 30 })) go('select');
  if (button('online', bx, 478, bw, 62, 'ONLINE', { color: '#1ab8a8', size: 30 })) { net.screen = net.role ? net.screen : 'menu'; go('online'); }
  if (button('looks', bx, 552, 205, 56, 'PLAYERS', { color: '#b06aff', size: 24 })) go('looks');
  if (button('sett', bx + 215, 552, 205, 56, 'SETTINGS', { color: '#5a4ab0', size: 24 })) go('settings');
  // opponent
  // opponent: a friend on the same keyboard, or the computer at 3 difficulties
  txt('PLAY AGAINST', W / 2, 618, 15, '#ffe680', 'center', { stroke: 3 });
  [['FRIEND', -1, '#2ac85a'], ['EASY CPU', 0, '#5ab8ff'], ['NORMAL CPU', 1, '#ff9a2a'], ['HARD CPU', 2, '#ff3a5a']].forEach(([lab, v, col], i) => {
    const on = save.cpu === v, x = W / 2 - 290 + i * 146;
    if (button('opp' + i, x, 640, 138, 44, lab, { color: on ? col : '#3a2a6a', size: 17, selected: on, sfx: 'tab' })) { save.cpu = v; store(); }
  });
  // player previews
  for (let i = 0; i < 2; i++) {
    const p = save.players[i], x = i === 0 ? 170 : W - 170, cpu = i === 1 && save.cpu >= 0;
    drawBlob(x, 470 + Math.sin(t * 3 + i * 2) * 8, 70, cpu ? { col: p.look.col, face: 'angry' } : p.look, { ang: i === 0 ? 0 : Math.PI });
    txt(cpu ? 'COMPUTER' : p.name, x, 570, 28, p.look.col, 'center');
    txt(cpu ? ['EASY', 'NORMAL', 'HARD'][save.cpu] : controlsLine(i), x, 610, 17, cpu ? ['#5ab8ff', '#ff9a2a', '#ff3a5a'][save.cpu] : '#ffffff', 'center', { stroke: 3 });
  }
  txt(`Matches ${save.stats.matches}   ${save.players[0].name} ${save.stats.wins[0]} - ${save.stats.wins[1]} ${save.players[1].name}${save.stats.react ? `   Fastest draw ${save.stats.react} ms` : ''}`, W / 2, 700, 14, '#c8c0ff', 'center', { stroke: 0 });
}
function drawSelect() {
  txt('FREE PLAY', W / 2, 30, 56, '#ffffff', 'center');
  txt('Pick a game', W / 2, 96, 22, '#c8c0ff', 'center', { stroke: 0 });
  GAME_IDS.forEach((id, i) => {
    const G = GAMES[id], cw = 270, ch = 220, col = i % 4, row = Math.floor(i / 4), x = 70 + col * (cw + 20) + (row === 1 ? (cw + 20) / 2 : 0), y = 150 + row * (ch + 24);
    if (button('g' + id, x, y, cw, ch, '', { color: shade(G.col, -0.45), draw: (X, Y) => { gameIcon(id, X + cw / 2, Y + 80, 0.95); txt(G.name, X + cw / 2, Y + 148, 26, G.col, 'center'); txt(G.target > 1 ? `first to ${G.target}` : 'one round', X + cw / 2, Y + 184, 16, '#ffffff', 'center', { stroke: 0, weight: 500 }); } })) startMatch('free', id);
  });
  if (button('sback', 60, 640, 200, 56, 'BACK', { color: '#5a4ab0', size: 24, sfx: 'back' })) go('title');
}
function drawLooks() {
  txt('PLAYERS', W / 2, 24, 52, '#ffffff', 'center');
  for (let i = 0; i < 2; i++) {
    const p = save.players[i], x0 = i === 0 ? 70 : 670;
    panel(x0, 100, 540, 520);
    drawBlob(x0 + 270, 250 + Math.sin(t * 3) * 6, 80, p.look, { ang: Math.sin(t) * 2 });
    const editing = typing && typing.who === i;
    if (button('nm' + i, x0 + 70, 360, 400, 56, p.name + (editing && Math.sin(t * 8) > 0 ? '_' : ''), { color: editing ? '#5a4ab0' : '#3a2a6a', size: 26, sfx: 'tab' })) typing = { who: i, get: () => p.name, set: v => p.name = v, max: 12, re: /[\w \-!?]/ };
    COLORS.forEach((c, k) => { const x = x0 + 50 + (k % 5) * 92, y = 440 + Math.floor(k / 5) * 58; if (button('c' + i + k, x, y, 76, 46, '', { color: c, selected: p.look.col === c, sfx: 'tab', r: 14 })) { p.look.col = c; store(); } });
    FACES.forEach((f, k) => { const x = x0 + 40 + k * 94, y = 556; if (button('f' + i + k, x, y, 84, 52, '', { color: p.look.face === f ? '#ffcc33' : '#3a2a6a', sfx: 'tab', r: 14, draw: (X, Y) => drawBlob(X + 42, Y + 28, 18, { col: p.look.col, face: f }, { shadow: false }) })) { p.look.face = f; store(); } });
    txt(i === 0 ? 'PLAYER 1' : 'PLAYER 2', x0 + 270, 116, 24, '#c8c0ff', 'center', { stroke: 0 });
  }
  txt('Click the name to type a new one', W / 2, 636, 18, '#c8c0ff', 'center', { stroke: 0 });
  if (button('lback', W / 2 - 140, 656, 280, 56, 'DONE', { color: '#2ac85a', size: 26, sfx: 'back' })) { typing = null; store(); go('title'); }
}
function drawSettings() {
  txt('SETTINGS', W / 2, 24, 52, '#ffffff', 'center');
  panel(90, 100, 1100, 520);
  txt('CONTROLS', 130, 120, 24, '#ffe680', 'left');
  txt(save.players[0].name, 520, 120, 22, save.players[0].look.col, 'center'); txt(save.players[1].name, 820, 120, 22, save.players[1].look.col, 'center');
  const NAMES = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', act: 'ACTION' };
  Object.keys(NAMES).forEach((a, k) => {
    const y = 160 + k * 52; txt(NAMES[a], 130, y + 8, 22, '#ffffff', 'left');
    for (let p = 0; p < 2; p++) { const on = capture && capture.p === p && capture.a === a; if (button(`kb${p}${a}`, 400 + p * 300, y, 240, 44, on ? 'PRESS A KEY' : keyName(save.binds[p][a]), { color: on ? '#ff7a1a' : '#3a2a6a', size: on ? 18 : 22, sfx: 'tab' })) capture = { p, a }; }
  });
  if (button('kreset', 1000, 160, 160, 44, 'RESET', { color: '#8a2a3a', size: 18 })) { save.binds = JSON.parse(JSON.stringify(DEF_BINDS)); store(); }
  txt('Online you can use either set of keys. SPACE also works as ACTION.', 130, 430, 17, '#c8c0ff', 'left', { stroke: 0 });
  const slider = (label, key, y) => {
    txt(label, 130, y + 4, 22, '#ffffff', 'left');
    const x0 = 400, w = 520; rr(x0, y + 12, w, 14, 7); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); rr(x0, y + 12, w * save.set[key], 14, 7); ctx.fillStyle = '#ffcc33'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + w * save.set[key], y + 19, 14, 0, 6.3); ctx.fill();
    txt(Math.round(save.set[key] * 100) + '%', 980, y + 4, 22, '#ffe680', 'left');
    if (UI.down && mouse.y > y - 6 && mouse.y < y + 40 && mouse.x > x0 - 20 && mouse.x < x0 + w + 20) { save.set[key] = clamp((mouse.x - x0) / w, 0, 1); applyAudio(); store(); }
  };
  slider('Music', 'music', 470); slider('Sound effects', 'sfx', 520);
  if (button('shk', 400, 566, 240, 44, save.set.shake ? 'SHAKE: ON' : 'SHAKE: OFF', { color: '#3a2a6a', size: 20, sfx: 'tab' })) { save.set.shake = !save.set.shake; store(); }
  if (button('mus', 660, 566, 240, 44, Sound.musicOn ? 'MUSIC: ON' : 'MUSIC: OFF', { color: '#3a2a6a', size: 20, sfx: 'tab' })) Sound.setMusic(!Sound.musicOn);
  if (button('setback', W / 2 - 140, 640, 280, 60, 'DONE', { color: '#2ac85a', size: 28, sfx: 'back' })) { capture = null; store(); go('title'); }
}
function go(s) { ui = s; typing = null; capture = null; paused = false; if (s === 'title') Sound.playSong(SONGS.pmenu); }

// ------------------------------------------------------------ online
const net = { role: null, myId: null, code: '', tr: null, screen: 'menu', error: '', codeInput: '', guest: null, guestId: null, cfg: { mode: 'party', target: 5, game: 'cycles' }, remote: { x: 0, y: 0, a: false, aN: 0 }, sendT: 0, prev: null, cur: null, curT: 0, myAN: 0, react: null, drawSeen: null };
const netSend = (to, m) => net.tr && net.tr.send(to, m), netBroadcast = m => net.tr && net.tr.broadcast(m);
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function hostRoom() {
  netReset(); net.role = 'host'; net.myId = 'host'; net.screen = 'connecting'; net.error = '';
  net.code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  net.tr = NetTransport.host(net.code, {
    ready: () => { NetTransport.announce('party', net.code); net.screen = 'lobby'; },
    join: () => {},
    leave: id => { if (id === net.guestId) { net.guest = null; net.guestId = null; if (ui === 'game') { go('online'); net.screen = 'lobby'; net.error = 'Your friend left'; } } },
    msg: (from, d) => {
      if (d.t === 'hello') { if (net.guestId && net.guestId !== from) { netSend(from, { t: 'full' }); return; } net.guestId = from; net.guest = { name: String(d.name || 'Guest').slice(0, 12), look: d.look }; lobbySync(); }
      else if (d.t === 'in' && from === net.guestId) { net.remote = Object.assign({ remote: true }, d); }
      else if (d.t === 'look' && from === net.guestId) { net.guest = { name: String(d.name || 'Guest').slice(0, 12), look: d.look }; lobbySync(); }
      else if (d.t === 'bye' && from === net.guestId) { net.guest = null; net.guestId = null; if (ui === 'game') { go('online'); net.screen = 'lobby'; } lobbySync(); }
    },
    error: e => { if (e === 'taken') { hostRoom(); return; } net.error = 'Online error: ' + e; netReset(true); net.screen = 'menu'; },
  });
}
function joinRoom(code) {
  netReset(); net.role = 'client'; net.code = code.toUpperCase(); net.screen = 'connecting'; net.error = '';
  net.tr = NetTransport.join(net.code, {
    ready: id => {
      net.myId = id; NetTransport.announce('party', net.code); net.joinedAt = performance.now();
      const hello = () => netSend('host', { t: 'hello', name: myName(), look: save.players[0].look, own: OWN() });
      hello(); let n = 0; const tr = net.tr;
      const iv = setInterval(() => { if (net.tr !== tr || net.screen === 'lobby' || ++n > 10) { clearInterval(iv); if (net.tr === tr && net.screen !== 'lobby') netLost('The room did not answer. Try again.'); return; } hello(); }, 1500);
    },
    join: () => {},
    leave: () => netLost('The host left the room'),
    msg: (from, d) => {
      if (d.t === 'lobby') { net.cfg = d.cfg; net.hostP = d.host; net.guest = d.guest; net.screen = 'lobby'; if (ui !== 'game' && ui !== 'online') go('online'); }
      else if (d.t === 'S') { net.lastRx = performance.now(); net.prev = net.cur; net.cur = d.S; net.curT = performance.now(); if (!S || ui !== 'game') { lastEv = d.S.evN; fx = []; floats = []; ui = 'game'; paused = false; Sound.playSong(SONGS.pplay); } }
      else if (d.t === 'lobbyback') { go('online'); net.screen = 'lobby'; S = null; net.cur = net.prev = null; }
      else if (d.t === 'full') netLost('That room already has 2 players');
      else if (d.t === 'closed') netLost('The host closed the room');
    },
    error: e => { net.error = e === 'Room not found' ? `Room ${net.code} was not found` : 'Online error: ' + e; netReset(true); net.screen = 'menu'; },
  });
}
function netReset(k) { NetTransport.announce('party', null); netResetBase(k); }
function netResetBase(keepErr) { if (net.tr) try { net.tr.close(); } catch (e) {} net.tr = null; net.role = null; net.guest = null; net.guestId = null; net.prev = net.cur = null; if (!keepErr) net.error = ''; }
function netLost(why) { netReset(); net.error = why; net.screen = 'menu'; S = null; go('online'); }
function leaveOnline() { if (net.role === 'client') netSend('host', { t: 'bye' }); netReset(); net.screen = 'menu'; S = null; go('title'); }
function lobbySync() { netBroadcast({ t: 'lobby', cfg: net.cfg, host: { name: myName(), look: save.players[0].look, own: OWN() }, guest: net.guest }); }
function hostStartMatch() { if (!net.guest) return; startMatch(net.cfg.mode, net.cfg.mode === 'free' ? net.cfg.game : null); }
function myPress() { // guest presses ACTION: remember the reaction time for Quick Draw (measured on this computer)
  net.myAN++;
  if (net.role === 'client' && net.cur && net.cur.game === 'quickdraw' && net.cur.gs.sub === 'draw' && net.drawSeen && net.drawSeen.id === net.cur.gs.drawId) net.react = { id: net.drawSeen.id, ms: Math.round(performance.now() - net.drawSeen.at) };
}
const serialize = s => JSON.parse(JSON.stringify(s, (k, v) => k[0] === '_' ? undefined : v));
// smooth the guest's view by blending the last two snapshots
const NOLERP = new Set(['score', 'phase', 'target', 'round', 'charges', 'c', 'n', 'id', 'evN', 'crowns', 'map', 'drawId', 'react', 'trail', 'p_dead']);
function blend(a, b, u, key) {
  if (typeof b === 'number' && typeof a === 'number' && !NOLERP.has(key)) { if (key === 'a' || key === 'ang') return a + wrapA(b - a) * u; return Math.abs(b - a) > 300 ? b : a + (b - a) * u; }
  if (Array.isArray(b) && Array.isArray(a) && a.length === b.length && !NOLERP.has(key)) return b.map((v, i) => blend(a[i], v, u, key));
  if (b && typeof b === 'object' && a && typeof a === 'object' && !Array.isArray(b) && !NOLERP.has(key)) { if (a.id !== undefined && a.id !== b.id) return b; const o = {}; for (const k in b) o[k] = k in a ? blend(a[k], b[k], u, k) : b[k]; return o; }
  return b;
}
function drawOnline() {
  txt('ONLINE', W / 2, 24, 52, '#ffffff', 'center');
  if (!net.role) {
    panel(W / 2 - 330, 100, 660, 540);
    txt('YOUR PLAYER', W / 2 - 290, 124, 18, '#c8c0ff', 'left', { stroke: 0 });
    drawBlob(W / 2 - 230, 200, 44, save.players[0].look, { ang: 0 });
    txt(myName(), W / 2 - 160, 180, 32, save.players[0].look.col, 'left'); if (OWN()) ownTag(W / 2 - 150 + ctx.measureText(myName()).width, 186, 26);
    if (button('edl', W / 2 + 140, 170, 150, 46, 'CHANGE', { color: '#b06aff', size: 20 })) go('looks');
    if (button('host', W / 2 - 290, 270, 580, 76, 'HOST A ROOM', { color: '#1ab8a8', size: 34 })) hostRoom();
    txt('OR JOIN A FRIEND\'S ROOM', W / 2 - 290, 370, 18, '#c8c0ff', 'left', { stroke: 0 });
    const ed = typing && typing.code;
    if (button('code', W / 2 - 290, 398, 340, 70, (net.codeInput || (ed ? '' : 'TYPE CODE')) + (ed && Math.sin(t * 8) > 0 ? '_' : ''), { color: ed ? '#5a4ab0' : '#3a2a6a', size: 32, sfx: 'tab' })) typing = { code: true, get: () => net.codeInput, set: v => net.codeInput = v, max: 5, re: /[a-z0-9]/i, upper: true, done: () => net.codeInput.length === 5 && joinRoom(net.codeInput) };
    if (button('join', W / 2 + 70, 398, 220, 70, 'JOIN', { color: net.codeInput.length === 5 ? '#2ac85a' : '#3a3f58', size: 32, disabled: net.codeInput.length !== 5 })) joinRoom(net.codeInput);
    if (net.error) txt(net.error, W / 2, 486, 20, '#ff8a8a', 'center', { stroke: 3 });
    txt('Share the room code with a friend so they can play from their own computer.', W / 2, 530, 16, '#ffffff', 'center', { stroke: 0, weight: 500 });
    if (button('oback', W / 2 - 100, 566, 200, 56, 'BACK', { color: '#5a4ab0', size: 24, sfx: 'back' })) { typing = null; go('title'); }
    return;
  }
  if (net.screen === 'connecting') {
    panel(W / 2 - 300, 260, 600, 200);
    txt(net.role === 'host' ? 'Creating room...' : `Joining ${net.code}...`, W / 2, 300, 34, '#ffffff', 'center');
    txt(NetTransport.status.text || 'Connecting...', W / 2, 346, 16, '#9a92d0', 'center', { stroke: 0 });
    if (button('cc', W / 2 - 100, 380, 200, 56, 'CANCEL', { color: '#8a2a3a', size: 22, sfx: 'back' })) { netReset(); net.screen = 'menu'; }
    return;
  }
  const isHost = net.role === 'host', hostP = isHost ? { name: myName(), look: save.players[0].look, own: OWN() } : net.hostP, guest = isHost ? net.guest : (net.guest || { name: save.players[0].name, look: save.players[0].look });
  panel(70, 100, 1140, 540);
  txt('ROOM CODE', 110, 124, 20, '#c8c0ff', 'left', { stroke: 0 });
  txt(net.code, 110, 150, 72, '#5affe8', 'left', { stroke: 10 });
  if (NetTransport.local) txt('(same-computer test mode)', 110, 236, 14, '#9a92d0', 'left', { stroke: 0 });
  [[hostP, 'HOST'], [guest, isHost ? 'GUEST' : 'YOU']].forEach(([p, tag], i) => {
    const x = 520 + i * 340;
    if (p) { drawBlob(x, 200, 56, p.look, { ang: i ? Math.PI : 0 }); txt(p.name, x, 270, 28, p.look.col, 'center'); if (p.own && window.Account && Account.ownerOK(p.name, p.own)) ownTag(x, 122, 26, 'center'); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, 200, 56, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); txt('waiting...', x, 270, 24, '#9a92d0', 'center', { stroke: 0 }); }
    txt(tag, x, 306, 16, '#ffe680', 'center', { stroke: 0 });
  });
  const c = net.cfg;
  txt('MODE', 110, 370, 22, '#ffffff', 'left');
  if (isHost) {
    if (button('mparty', 260, 356, 200, 50, 'PARTY', { color: c.mode === 'party' ? '#ff4a6a' : '#3a2a6a', size: 22, selected: c.mode === 'party', sfx: 'tab' })) { c.mode = 'party'; lobbySync(); }
    if (button('mfree', 470, 356, 200, 50, 'ONE GAME', { color: c.mode === 'free' ? '#3a9aff' : '#3a2a6a', size: 22, selected: c.mode === 'free', sfx: 'tab' })) { c.mode = 'free'; lobbySync(); }
    if (c.mode === 'party') [3, 5, 7].forEach((n, i) => { if (button('nt' + n, 700 + i * 80, 356, 70, 50, String(n), { color: c.target === n ? '#ffcc33' : '#3a2a6a', size: 22, sfx: 'tab' })) { c.target = n; lobbySync(); } });
    else GAME_IDS.forEach((id, i) => { if (button('ng' + id, 110 + i * 150, 430, 140, 110, '', { color: c.game === id ? shade(GAMES[id].col, -0.3) : '#3a2a6a', selected: c.game === id, sfx: 'tab', draw: (X, Y) => { gameIcon(id, X + 70, Y + 44, 0.55); txt(GAMES[id].name.split(' ')[0], X + 70, Y + 82, 15, '#fff', 'center', { stroke: 3 }); } })) { c.game = id; lobbySync(); } });
    if (button('ostart', 860, 560, 320, 66, 'START', { color: '#2ac85a', size: 32, disabled: !net.guest })) hostStartMatch();
    if (!net.guest) txt('Waiting for a friend to join...', 860, 530, 18, '#ffe680', 'left', { stroke: 0 });
  } else {
    txt(c.mode === 'party' ? `PARTY - first to ${c.target} crowns` : `ONE GAME - ${GAMES[c.game].name}`, 260, 370, 24, '#ffe680', 'left');
    txt('Waiting for the host to start...', 860, 590, 20, '#c8c0ff', 'left', { stroke: 0 });
  }
  if (button('lleave', 110, 570, 200, 56, 'LEAVE', { color: '#8a2a3a', size: 24, sfx: 'back' })) { if (isHost) netBroadcast({ t: 'closed' }); leaveOnline(); }
}

// ------------------------------------------------------------ main loop
function hostTick(dt) {
  if (!(ui === 'game' && S && net.role !== 'client')) return;
  {
    // host / offline: run the match
    const inp = [localInput(0, !!net.role), net.role ? net.remote : localInput(1, false)];
    if (!net.role && save.cpu >= 0 && S.cpu >= 0) {
      const G = GAMES[S.game], c = S.scr === 'play' ? G.ai(S.gs, 1, S.cpu) : { x: 0, y: 0, a: false };
      if (c.a && !cpuPrevA[1] || (c.a && S.game === 'tug')) cpuIn[1].aN++;
      cpuPrevA[1] = c.a; cpuIn[1].x = c.x; cpuIn[1].y = c.y; cpuIn[1].a = c.a; inp[1] = cpuIn[1];
    }
    if (window.__pcAI) for (const i of [0, 1]) { const c = S.scr === 'play' ? GAMES[S.game].ai(S.gs, i, 2) : { x: 0, y: 0, a: false }; if (c.a && (!cpuPrevA[i] || S.game === 'tug')) cpuIn[i].aN++; cpuPrevA[i] = c.a; Object.assign(cpuIn[i], { x: c.x, y: c.y, a: c.a }); inp[i] = cpuIn[i]; }
    if (!paused || net.role) stepMatch(dt, inp);
    if (net.role === 'host') { net.sendT += dt; if (net.sendT >= 1 / 30) { net.sendT = 0; netBroadcast({ t: 'S', S: serialize(S) }); } }
  }
}
// the host's game keeps running (and sending) even if its tab is in the background
NetTransport.backgroundTicker(dt => { if (net.role === 'host') { t += dt; hostTick(dt); } });
let last = 0, cpuPrevA = [false, false];
function frame(now) {
  NetTransport.frame();
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
  UI.hover = null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  hostTick(dt);
  if (ui === 'game' && net.role === 'client' && net.cur) {
    // guest: show the host's game, blended between snapshots
    const u = net.prev ? clamp((performance.now() - net.curT) / 33, 0, 1) : 1;
    S = net.prev ? blend(net.prev, net.cur, u) : net.cur;
    S.ev = net.cur.ev; S.evN = net.cur.evN;
    // quick draw: note when DRAW appeared on this screen
    if (net.cur.game === 'quickdraw' && net.cur.gs.sub === 'draw' && (!net.drawSeen || net.drawSeen.id !== net.cur.gs.drawId)) net.drawSeen = { id: net.cur.gs.drawId, at: performance.now() };
    net.sendT += dt;
    if (net.sendT >= 1 / 30) { net.sendT = 0; const li = localInput(0, true); netSend('host', { t: 'in', x: li.x, y: li.y, a: li.a, aN: net.myAN, react: net.react }); }
  }
  // effects
  if (ui === 'game' && S) handleEvents();
  for (const p of fx) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
  fx = fx.filter(p => p.t < p.life); if (fx.length > 900) fx.splice(0, fx.length - 900);
  for (const f of floats) f.t += dt; floats = floats.filter(f => f.t < 1.1);
  shake = Math.max(0, shake - dt * 2.5);
  if (ui === 'game' && S && S.game) drawMatch(dt);
  else {
    menuBackground(dt);
    if (ui === 'title') drawTitle(); else if (ui === 'select') drawSelect(); else if (ui === 'looks') drawLooks(); else if (ui === 'settings') drawSettings(); else if (ui === 'online') drawOnline();
  }
  if (UI.hover && UI.hover !== UI.lastHover) Sound.play('hover');
  UI.lastHover = UI.hover; UI.click = null;
  requestAnimationFrame(frame);
}
const fontReady = document.fonts ? Promise.race([document.fonts.load(`700 24px ${FONT}`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontReady.then(() => { applyAudio(); go('title');
  // opened from a friend's Join button: go straight into their room
  const jc = NetTransport.joinCode(); if (jc) { go('online'); joinRoom(jc); } requestAnimationFrame(n => { last = n; frame(n); }); });

window.__pc = {
  get S() { return S; }, get ui() { return ui; }, startMatch, go, save: () => save, net, hostRoom, joinRoom, hostStartMatch,
  sim(dt, n, lv = [2, 2]) { // run the match quickly with both players on autopilot (tests)
    for (let k = 0; k < n; k++) {
      if (!S || ui !== 'game') return 'menu';
      const inp = [0, 1].map(i => { const c = S.scr === 'play' ? GAMES[S.game].ai(S.gs, i, lv[i]) : { x: 0, y: 0, a: false }; if (c.a && (!cpuPrevA[i] || S.game === 'tug')) cpuIn[i].aN++; cpuPrevA[i] = c.a; return Object.assign(cpuIn[i], { x: c.x, y: c.y, a: c.a }); });
      stepMatch(dt, inp); handleEvents();
      if (S.scr === 'final') return 'final';
    }
    return S.scr;
  },
};

// ------------------------------------------------------------ owner cheats (only shown for the site admin, see account/cheats.js)
const me = () => net.role === 'client' ? 1 : 0;
const inGame = () => net.role === 'client' ? 'Only works when you are the host' : ui === 'game' && S && S.scr === 'play' && S.gs && S.gs.phase === 'play' ? '' : 'Wait until a round is being played';
window.__cheats = [
  { name: 'Win this round', icon: '🏅', need: inGame, run() { givePoint(S.gs, S, me(), 'OWNER POWER!'); } },
  { name: 'Give the other player a point', icon: '🎁', need: inGame, run() { givePoint(S.gs, S, 1 - me(), 'GIFT FROM THE OWNER'); } },
  { name: 'Win this mini-game', icon: '👑', need: inGame, run() { S.gs.score[me()] = Math.max(S.gs.score[me()], (S.gs.target || 3) - 1); givePoint(S.gs, S, me(), 'OWNER POWER!'); } },
];

})();
