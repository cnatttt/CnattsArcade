// =====================================================================
//  Friend tournaments: a 2-8 player knockout bracket shared over a
//  Supabase Realtime channel. The player who creates it runs the
//  bracket; every match is a normal 1v1 online room in the game
//  (the first player named in a match hosts it, the other joins).
//
//  Tourney.create(game, name) / Tourney.join(game, code, name)
//  Tourney.start()                    host only, needs 2+ players
//  Tourney.myMatch() -> { r, i, opp, oppName, role: 'host'|'client', room } | null
//  Tourney.report(r, i, winnerId)     either player can report
//  Tourney.drawBracket(ctx, x, y, w, h, { font, head })
//  Tourney.state  (code, players, st, err, me, isHost)
// =====================================================================
'use strict';
window.Tourney = (() => {
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const T = { game: null, code: '', me: null, isHost: false, ch: null, players: [], st: null, err: '', gone: {}, timer: null, listeners: [] };
  const A = () => window.Account;
  const available = () => !!(A() && A().sb);
  const changed = () => T.listeners.forEach(f => { try { f(); } catch (e) {} });
  const send = (event, payload) => { try { T.ch && T.ch.send({ type: 'broadcast', event, payload }); } catch (e) {} };

  function open(game, code, host, name) {
    leave();
    const a = A();
    if (!a || !a.sb) { T.err = 'Tournaments need the arcade online service.'; return false; }
    T.game = game; T.code = code; T.isHost = host; T.err = ''; T.gone = {};
    T.me = { id: (a.user && a.user.id) || 'g' + Math.random().toString(36).slice(2, 10), name: String(name || 'Player').slice(0, 16), at: Date.now(), host };
    T.st = host ? { started: false, rounds: [], names: {}, champ: null, v: 1, host: T.me.id, game } : null;
    const ch = a.sb.channel(`${game}-tourney-${code}`, { config: { presence: { key: T.me.id }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, sync);
    ch.on('broadcast', { event: 'state' }, ({ payload }) => { if (!T.isHost && payload && (!T.st || payload.v >= T.st.v)) { T.st = payload; changed(); } });
    ch.on('broadcast', { event: 'result' }, ({ payload }) => { if (T.isHost && payload) applyResult(payload.r, payload.i, payload.w); });
    ch.on('broadcast', { event: 'hello' }, () => { if (T.isHost) push(); });
    ch.subscribe(s => { if (s === 'SUBSCRIBED') { ch.track(T.me); if (host) push(); else send('hello', {}); } });
    T.ch = ch;
    T.timer = setInterval(() => { if (T.isHost) { push(); walkovers(); } else if (!T.st) send('hello', {}); hostCheck(); }, 2500);
    changed();
    return true;
  }
  function sync() {
    if (!T.ch) return;
    T.players = Object.values(T.ch.presenceState()).map(x => x[0]).filter(p => p && p.id).sort((a, b) => a.at - b.at);
    const now = Date.now();
    T.players.forEach(p => delete T.gone[p.id]);
    if (T.st && T.st.started) Object.keys(T.st.names).forEach(id => { if (!T.players.some(p => p.id === id) && !T.gone[id]) T.gone[id] = now; });
    changed();
  }
  function hostCheck() {
    if (T.isHost || !T.st) return;
    if (!T.players.some(p => p.id === T.st.host)) { T.hostGone = T.hostGone || Date.now(); if (Date.now() - T.hostGone > 20000 && !T.st.champ) { T.err = 'The organiser left, so the tournament ended.'; changed(); } }
    else T.hostGone = 0;
  }
  function push() { if (T.isHost && T.st) send('state', T.st); changed(); }
  function create(game, name) { const code = 'T' + Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); return open(game, code, true, name); }
  function join(game, code, name) { return open(game, String(code).toUpperCase().trim(), false, name); }
  function leave() {
    clearInterval(T.timer); T.timer = null;
    if (T.ch) { try { T.ch.untrack(); A().sb.removeChannel(T.ch); } catch (e) {} }
    T.ch = null; T.st = null; T.players = []; T.code = ''; T.isHost = false; T.hostGone = 0; changed();
  }
  // ---------------------------------------------------------- bracket
  function start() {
    if (!T.isHost || !T.st || T.st.started) return;
    const list = T.players.slice(0, 8);
    if (list.length < 2) return;
    const ids = list.map(p => p.id).sort(() => Math.random() - 0.5);
    let size = 2; while (size < ids.length) size *= 2;
    while (ids.length < size) ids.push(null);
    // pair top with bottom so the byes never meet each other
    const first = [];
    for (let i = 0; i < size / 2; i++) first.push({ a: ids[i], b: ids[size - 1 - i], w: null });
    T.st.names = {}; list.forEach(p => T.st.names[p.id] = p.name);
    T.st.rounds = [first]; T.st.started = true; T.st.startedAt = Date.now();
    advance(); T.st.v++; push();
  }
  function advance() {
    const R = T.st.rounds;
    let r = R[R.length - 1];
    r.forEach((m, i) => { if (!m.w && m.a && !m.b) m.w = m.a; if (!m.w && m.b && !m.a) m.w = m.b; if (!m.room) m.room = T.code.slice(1, 4) + (R.length - 1) + i; });
    while (r.every(m => m.w)) {
      if (r.length === 1) { T.st.champ = r[0].w; return; }
      const next = [];
      for (let i = 0; i < r.length; i += 2) next.push({ a: r[i].w, b: r[i + 1].w, w: null });
      R.push(next); r = next;
      r.forEach((m, i) => { m.room = T.code.slice(1, 4) + (R.length - 1) + i; });
    }
  }
  function applyResult(r, i, w) {
    const st = T.st; if (!st || !st.rounds[r] || !st.rounds[r][i]) return;
    const m = st.rounds[r][i]; if (m.w || (w !== m.a && w !== m.b)) return;
    m.w = w; advance(); st.v++; push();
  }
  // a player who leaves for good forfeits their match
  function walkovers() {
    const st = T.st; if (!st || !st.started || st.champ) return;
    const r = st.rounds[st.rounds.length - 1], now = Date.now();
    r.forEach((m, i) => {
      if (m.w || !m.a || !m.b) return;
      const ga = T.gone[m.a] && now - T.gone[m.a] > 25000, gb = T.gone[m.b] && now - T.gone[m.b] > 25000;
      if (ga && !gb) applyResult(st.rounds.length - 1, i, m.b);
      else if (gb && !ga) applyResult(st.rounds.length - 1, i, m.a);
      else if (ga && gb) applyResult(st.rounds.length - 1, i, m.a);
    });
  }
  function report(r, i, w) {
    if (T.isHost) applyResult(r, i, w);
    else { send('result', { r, i, w }); setTimeout(() => send('result', { r, i, w }), 1200); setTimeout(() => send('result', { r, i, w }), 4000); }
  }
  function myMatch() {
    const st = T.st; if (!st || !st.started || st.champ || !T.me) return null;
    const r = st.rounds.length - 1, me = T.me.id;
    const i = st.rounds[r].findIndex(m => !m.w && m.a && m.b && (m.a === me || m.b === me));
    if (i < 0) return null;
    const m = st.rounds[r][i], opp = m.a === me ? m.b : m.a;
    return { r, i, opp, oppName: st.names[opp] || 'Player', role: m.a === me ? 'host' : 'client', room: m.room };
  }
  const name = id => (T.st && T.st.names[id]) || (T.players.find(p => p.id === id) || {}).name || '—';
  const roundName = (r, n) => { const left = n - r; return left === 1 ? 'Final' : left === 2 ? 'Semi-finals' : left === 3 ? 'Quarter-finals' : 'Round ' + (r + 1); };
  // ---------------------------------------------------------- drawing
  function drawBracket(ctx, x, y, w, h, o = {}) {
    const st = T.st; if (!st || !st.started) return;
    const F = o.font || 'Inter, sans-serif', HD = o.head || F;
    const R = st.rounds, first = R[0].length, nR = Math.log2(first * 2);
    const colW = w / nR, me = T.me && T.me.id;
    const rr = (x0, y0, w0, h0, r0) => { ctx.beginPath(); ctx.moveTo(x0 + r0, y0); ctx.arcTo(x0 + w0, y0, x0 + w0, y0 + h0, r0); ctx.arcTo(x0 + w0, y0 + h0, x0, y0 + h0, r0); ctx.arcTo(x0, y0 + h0, x0, y0, r0); ctx.arcTo(x0, y0, x0 + w0, y0, r0); ctx.closePath(); };
    const txt = (s, x0, y0, size, col, align = 'left', wt = 700, font = F) => { ctx.font = `${wt} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x0, y0); };
    const boxH = Math.min(56, (h - 40) / first - 10);
    const centers = [];
    for (let r = 0; r < nR; r++) {
      const n = first >> r, cx = x + r * colW + 8, bw = colW - 34;
      txt(roundName(r, nR), cx + bw / 2, y + 10, 12, '#94a3b8', 'center', 800);
      centers[r] = [];
      for (let i = 0; i < n; i++) {
        const cy = r === 0 ? y + 40 + (i + 0.5) * ((h - 40) / n) : (centers[r - 1][i * 2] + centers[r - 1][i * 2 + 1]) / 2;
        centers[r].push(cy);
        const m = R[r] && R[r][i], live = m && !m.w && m.a && m.b && r === R.length - 1, mine = m && (m.a === me || m.b === me);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
        rr(cx, cy - boxH / 2, bw, boxH, 10); ctx.fillStyle = mine ? 'rgba(59,130,246,0.28)' : 'rgba(15,23,42,0.85)'; ctx.fill(); ctx.restore();
        rr(cx + 0.5, cy - boxH / 2 + 0.5, bw - 1, boxH - 1, 10); ctx.strokeStyle = live ? '#facc15' : 'rgba(255,255,255,0.12)'; ctx.lineWidth = live ? 2 : 1; ctx.stroke();
        const row = (id, k) => {
          const yy = cy - boxH / 4 + k * boxH / 2, won = m && m.w && m.w === id, lost = m && m.w && id && m.w !== id;
          const label = id ? name(id) : (m ? (r === 0 ? 'bye' : '…') : '…');
          txt((label.length > 14 ? label.slice(0, 13) + '…' : label) + (id === me ? '  (you)' : ''), cx + 12, yy, Math.min(14, boxH / 3.4), !id ? 'rgba(255,255,255,0.3)' : lost ? 'rgba(255,255,255,0.35)' : won ? '#fde047' : '#fff', 'left', won ? 800 : 700);
          if (won) txt('✓', cx + bw - 12, yy, 13, '#4ade80', 'right', 800);
        };
        row(m ? m.a : null, 0); row(m ? m.b : null, 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + bw - 8, cy); ctx.stroke();
        if (live) txt('LIVE', cx + bw - 10, cy - boxH / 2 - 8, 10, '#facc15', 'right', 800);
        // connector to the next round
        if (r < nR - 1) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + bw, cy); ctx.lineTo(cx + bw + 13, cy); ctx.stroke(); }
        if (r > 0) { const a = centers[r - 1][i * 2], b = centers[r - 1][i * 2 + 1]; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 13, a); ctx.lineTo(cx - 13, b); ctx.moveTo(cx - 13, cy); ctx.lineTo(cx, cy); ctx.stroke(); }
      }
    }
    if (st.champ) {
      const cx = x + w - 6, cy = centers[nR - 1][0];
      txt('🏆', cx - 30, cy - boxH / 2 - 24, 26, '#fff', 'center', 800, 'sans-serif');
    }
  }
  return {
    get state() { return T; }, available, create, join, leave, start, report, myMatch, name, drawBracket, roundName,
    onChange(f) { T.listeners.push(f); },
    get inTourney() { return !!T.ch; },
  };
})();
