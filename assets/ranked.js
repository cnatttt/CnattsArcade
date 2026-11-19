// =====================================================================
//  Shared ranked helper: Elo ladders per game (ranked_game table),
//  matches vs CPU, online matchmaking queue and rank badges.
//  Used by Rocket Soccer and Turbo Karts (Tag and Powder Peak have
//  their own older copies of the same ideas).
// =====================================================================
window.Ranked = (() => {
  const RANKS = [[0, 'Bronze', '#cd7f32'], [900, 'Silver', '#cbd5e1'], [1100, 'Gold', '#facc15'], [1300, 'Platinum', '#5eead4'], [1500, 'Diamond', '#60a5fa'], [1700, 'Master', '#c084fc'], [1900, 'Champion', '#f87171']];
  function rankOf(elo) {
    let k = 0; for (let i = 0; i < RANKS.length; i++) if (elo >= RANKS[i][0]) k = i;
    const [lo, name, col] = RANKS[k], hi = RANKS[k + 1] ? RANKS[k + 1][0] : lo + 300;
    const div = k === RANKS.length - 1 ? '' : [' III', ' II', ' I'][Math.min(2, Math.floor((elo - lo) / ((hi - lo) / 3)))];
    return { name: name + div, col, tier: k, lo, hi };
  }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))); return `rgb(${c})`; }
  function drawBadge(ctx, x, y, s, elo) {
    const r = rankOf(elo);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); } ctx.closePath();
    const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, shade(r.col, 0.35)); g.addColorStop(1, shade(r.col, -0.35)); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(15,23,42,0.75)'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(14, 8); ctx.lineTo(-14, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(5, -8); ctx.lineTo(-5, -8); ctx.closePath(); ctx.fill();
    for (let i = 0; i < Math.min(3, r.tier); i++) { ctx.beginPath(); ctx.arc(-8 + i * 8, 17, 2.5, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  const A = () => window.Account;
  const signedIn = () => { const a = A(); return !!(a && a.configured && a.user && a.sb); };
  const localKey = g => 'cnatt_rank_' + g;
  function localGet(g) { try { return Object.assign({ elo: 1000, wins: 0, losses: 0, peak: 1000 }, JSON.parse(localStorage.getItem(localKey(g)))); } catch (e) { return { elo: 1000, wins: 0, losses: 0, peak: 1000 }; } }

  const state = {};   // per game: { me, top, loading, err }
  async function load(game) {
    const st = state[game] = state[game] || { me: null, top: [], loading: false, err: '' };
    st.loading = true;
    try {
      const a = A(); if (a && a.configured) await a.init();
      if (!signedIn()) { st.me = localGet(game); st.top = []; return st; }
      const me = await a.sb.from('ranked_game').select('elo,wins,losses,streak,peak').eq('user_id', a.user.id).eq('game', game).maybeSingle();
      if (me.error) throw me.error;
      st.me = me.data || { elo: 1000, wins: 0, losses: 0, streak: 0, peak: 1000 };
      const top = await a.sb.from('ranked_game').select('elo,wins,losses,user_id,profiles(username)').eq('game', game).order('elo', { ascending: false }).limit(8);
      st.top = top.data || []; st.err = '';
    } catch (e) { st.err = 'Online ranks need the latest database setup.'; st.me = st.me || localGet(game); }
    finally { st.loading = false; }
    return st;
  }
  const elo = game => (state[game] && state[game].me ? state[game].me.elo : signedIn() ? 1000 : localGet(game).elo);
  // result of a match vs CPU (score: 0 = lost .. 1 = won). Resolves to { before, after, delta }
  async function cpu(game, cpuElo, score) {
    const before = elo(game);
    const E = 1 / (1 + Math.pow(10, (cpuElo - before) / 400)), d = Math.round(32 * (score - E));
    if (!signedIn()) {
      const L = localGet(game); L.elo = Math.max(0, L.elo + d); L.peak = Math.max(L.peak, L.elo); if (score >= 0.5) L.wins++; else L.losses++;
      try { localStorage.setItem(localKey(game), JSON.stringify(L)); } catch (e) {}
      if (state[game]) state[game].me = L;
      return { before, after: L.elo, delta: d };
    }
    try {
      const r = await A().sb.rpc('ranked_game_cpu', { p_game: game, p_cpu_elo: cpuElo, p_score: score });
      if (r.error || !r.data || r.data.elo == null) return { before, after: before, delta: 0, err: r.error ? 'Rank not saved (database needs the latest setup).' : (r.data && r.data.reason === 'too soon' ? 'Too soon after your last ranked match.' : '') };
      if (state[game] && state[game].me) state[game].me.elo = r.data.elo;
      return { before, after: r.data.elo, delta: r.data.elo - before };
    } catch (e) { return { before, after: before, delta: 0 }; }
  }
  // result of an online match; both players report, the server applies Elo when they agree
  async function report(game, matchId, oppUid, won) {
    const before = elo(game), a = A();
    if (!signedIn() || !oppUid || !matchId) return { before, after: before, delta: 0 };
    try {
      const r = await a.sb.rpc('ranked_game_report', { p_game: game, p_match: matchId, p_opp: oppUid, p_won: won });
      if (r.error) return { before, after: before, delta: 0, err: 'Rank not saved (database needs the latest setup).' };
      for (let k = 0; k < 8; k++) {
        await new Promise(res => setTimeout(res, 1500));
        const me = await a.sb.from('ranked_game').select('elo').eq('user_id', a.user.id).eq('game', game).maybeSingle();
        if (me.data && me.data.elo !== before) { if (state[game] && state[game].me) state[game].me.elo = me.data.elo; return { before, after: me.data.elo, delta: me.data.elo - before }; }
      }
      return { before, after: before, delta: 0, pending: true };
    } catch (e) { return { before, after: before, delta: 0 }; }
  }
  // matchmaking: calls onMatch({ role: 'host'|'client', code, opp: {id, name, elo} })
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function queue(game, onMatch) {
    if (!signedIn()) return null;
    const a = A(), me = { id: a.user.id, name: a.name(), elo: elo(game), at: Date.now() };
    const ch = a.sb.channel(game + '-ranked-queue', { config: { presence: { key: me.id }, broadcast: { self: false } } });
    let matched = false, timer = null;
    const leave = () => { clearInterval(timer); try { ch.untrack(); a.sb.removeChannel(ch); } catch (e) {} };
    const tryPair = () => {
      if (matched) return;
      const list = Object.values(ch.presenceState()).map(x => x[0]).filter(p => p && p.id).sort((x, y) => x.at - y.at);
      if (list.length < 2 || list[0].id !== me.id) return;
      const rest = list.slice(1), opp = rest.reduce((b, p) => Math.abs(p.elo - me.elo) < Math.abs(b.elo - me.elo) ? p : b, rest[0]);
      matched = true; const code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      ch.send({ type: 'broadcast', event: 'match', payload: { to: opp.id, code, from: me.id, name: me.name, elo: me.elo } });
      leave(); onMatch({ role: 'host', code, opp: { id: opp.id, name: opp.name, elo: opp.elo } });
    };
    ch.on('presence', { event: 'sync' }, tryPair);
    ch.on('broadcast', { event: 'match' }, ({ payload }) => {
      if (matched || !payload || payload.to !== me.id) return;
      matched = true; leave(); setTimeout(() => onMatch({ role: 'client', code: payload.code, opp: { id: payload.from, name: payload.name, elo: payload.elo } }), 900);
    });
    ch.subscribe(s => { if (s === 'SUBSCRIBED') ch.track(me); });
    timer = setInterval(tryPair, 2000);
    const q = { started: Date.now(), cancel() { matched = true; leave(); }, count: () => Object.keys(ch.presenceState()).length };
    return q;
  }
  return { RANKS, rankOf, drawBadge, load, state, elo, cpu, report, queue, signedIn };
})();
