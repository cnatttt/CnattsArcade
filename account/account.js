// =====================================================================
//  Arcade accounts: sign in, cloud saves, leaderboards, friends.
//  Loaded by the arcade page and by every game page. Inside the arcade
//  (games run in an iframe) the games share the arcade's Account object.
// =====================================================================
'use strict';
(function () {
  try { if (window.parent !== window && window.parent.Account) { window.Account = window.parent.Account; return; } } catch (e) {}

  const CFG = window.ACCOUNT_CONFIG || {};
  const SB_URLS = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js', 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js'];
  const SYNC_RE = /^(cnatt_|mush_|nightfall-)/;   // localStorage keys that are game saves
  const isSave = k => SYNC_RE.test(k) && !/^cnatt_(music|sfx)$/.test(k);   // (sound on/off stays per computer)
  const META = 'acct_sync';                       // { owner, ts: { key: time } }
  const EMAIL = u => u.toLowerCase() + '@players.2playertag.com';
  const ls = window.localStorage, rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;

  // ------------------------------------------------------------ leaderboards (read straight from the game saves)
  const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  const TRACKS = [['meadow', 'Sunny Circuit'], ['canyon', 'Dusty Canyon'], ['frost', 'Frostbite Pass'], ['neon', 'Neon Nights']];
  const BOARDS = [
    { id: 'horde_wave', game: 'Nightfall Horde', name: 'Best wave', key: 'cnatt_horde', get: s => s.best },
    { id: 'horde_kills', game: 'Nightfall Horde', name: 'Most kills in a run', key: 'cnatt_horde', get: s => s.bestKills },
    ...TRACKS.map(([id, n]) => ({ id: 'kart_lap_' + id, game: 'Turbo Karts', name: 'Best lap: ' + n, key: 'cnatt_kart', lower: true, fmt: 'time', get: s => s.bestLap && s.bestLap[id] })),
    { id: 'kart_wins', game: 'Turbo Karts', name: 'Race wins', key: 'cnatt_kart', get: s => s.wins },
    { id: 'siege_stars', game: 'Nightfall Siege', name: 'Total stars', key: 'cnatt_siege', get: s => s.stars && Object.values(s.stars).reduce((a, b) => a + (+b || 0), 0) },
    { id: 'siege_endless', game: 'Nightfall Siege', name: 'Best endless wave', key: 'cnatt_siege', get: s => s.best && Math.max(0, ...Object.values(s.best).map(Number).filter(isFinite)) },
    { id: 'dungeon_floor', game: 'Nightfall Depths', name: 'Deepest floor', key: 'cnatt_nightfall', get: s => s.bestFloor },
    { id: 'dungeon_wins', game: 'Nightfall Depths', name: 'Dungeon clears', key: 'cnatt_nightfall', get: s => s.wins },
    { id: 'fish_caught', game: 'Fishing Simulator', name: 'Fish caught', key: 'cnatt_fishing_v2', get: s => s.caught },
    { id: 'fish_dex', game: 'Fishing Simulator', name: 'Species discovered', key: 'cnatt_fishing_v2', get: s => s.dex && Object.keys(s.dex).length },
    { id: 'mush_total', game: 'Mush', name: 'Total mushrooms earned', key: /^mush_save_\d+$/, fmt: 'big', get: s => s.totalEarned },
    { id: 'tag_wins', game: '2 Player Tag', name: 'Total rounds won', key: 'cnatt_tag_wins', get: s => Array.isArray(s) ? s[0] + s[1] : 0 },
  ];
  const sentScore = {};
  function scoresFromSave(key, data) {
    if (!A.user || data == null) return;
    const s = J(data); if (s == null) return;
    BOARDS.forEach(b => {
      if (!(b.key instanceof RegExp ? b.key.test(key) : b.key === key)) return;
      let v; try { v = b.get(s); } catch (e) { return; }
      if (typeof v !== 'number' || !isFinite(v) || v <= 0) return;
      const prev = sentScore[b.id];
      if (prev != null && (b.lower ? v >= prev : v <= prev)) return;
      sentScore[b.id] = v;
      A.sb.rpc('submit_score', { p_board: b.id, p_score: v, p_lower: !!b.lower }).then(r => { if (r.error) { delete sentScore[b.id]; console.warn('score', r.error.message); } });
    });
  }

  // ------------------------------------------------------------ state
  const listeners = new Set();
  const A = {
    configured: !!(CFG.url && CFG.anonKey), ready: false, user: null, sb: null, syncing: false, lastSync: 0, error: '',
    BOARDS, onConflict: null,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  const emit = () => listeners.forEach(f => { try { f(A); } catch (e) { console.error(e); } });
  window.Account = A;

  function loadScript() {
    if (window.supabase) return Promise.resolve();
    return new Promise((res, rej) => {
      let i = 0;
      const next = () => {
        if (i >= SB_URLS.length) return rej(new Error('Could not load the account service'));
        const s = document.createElement('script'); s.src = SB_URLS[i++]; s.onload = () => window.supabase ? res() : next(); s.onerror = next; document.head.appendChild(s);
      };
      next();
    });
  }

  // ------------------------------------------------------------ cloud saves
  const meta = () => { const m = J(ls.getItem(META)) || {}; m.ts = m.ts || {}; return m; };
  const putMeta = m => { try { rawSet.call(ls, META, JSON.stringify(m)); } catch (e) {} };
  const dirty = new Set(); let pushTimer = null;
  function markDirty(key) {
    if (!isSave(key)) return;
    const m = meta(); m.ts[key] = Date.now(); putMeta(m);
    if (!A.user) return;
    dirty.add(key); clearTimeout(pushTimer); pushTimer = setTimeout(push, 2500);
  }
  // games write saves with localStorage.setItem; watch this page and (via storage events) the game iframes
  Storage.prototype.setItem = function (k, v) { const r = rawSet.call(this, k, v); if (this === ls) markDirty(k); return r; };
  Storage.prototype.removeItem = function (k) { const r = rawRemove.call(this, k); if (this === ls) markDirty(k); return r; };
  window.addEventListener('storage', e => { if (e.storageArea === ls && e.key && e.key !== META) markDirty(e.key); });

  async function push() {
    if (!A.user || !dirty.size) return;
    const keys = [...dirty]; dirty.clear();
    const m = meta(), ups = [], dels = [];
    keys.forEach(k => { const v = ls.getItem(k); if (v == null) dels.push(k); else ups.push({ user_id: A.user.id, key: k, data: v, updated_at: m.ts[k] || Date.now() }); });
    try {
      if (ups.length) { const r = await A.sb.from('saves').upsert(ups); if (r.error) throw r.error; }
      if (dels.length) { const r = await A.sb.from('saves').delete().eq('user_id', A.user.id).in('key', dels); if (r.error) throw r.error; }
      A.lastSync = Date.now(); A.error = '';
      ups.forEach(u => scoresFromSave(u.key, u.data));
    } catch (e) { keys.forEach(k => dirty.add(k)); A.error = 'Cloud save failed: ' + (e.message || e); clearTimeout(pushTimer); pushTimer = setTimeout(push, 15000); }
    emit();
  }
  A.flush = () => { clearTimeout(pushTimer); return push(); };
  window.addEventListener('pagehide', () => { if (dirty.size) push(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dirty.size) push(); });

  // merge this device's saves with the cloud. Returns the keys that changed on this device.
  async function sync() {
    if (!A.user || A.syncing) return [];
    A.syncing = true; emit();
    const changed = [];
    try {
      const r = await A.sb.from('saves').select('key,data,updated_at').eq('user_id', A.user.id);
      if (r.error) throw r.error;
      const cloud = new Map(r.data.map(x => [x.key, x])), m = meta();
      const local = []; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (isSave(k)) local.push(k); }
      if (m.owner && m.owner !== A.user.id) {
        // this computer's saves belong to a different account: swap them for this account's saves
        local.forEach(k => { if (!cloud.has(k)) { rawRemove.call(ls, k); delete m.ts[k]; changed.push(k); } });
        cloud.forEach((C, k) => { if (ls.getItem(k) !== C.data) { rawSet.call(ls, k, C.data); changed.push(k); } m.ts[k] = C.updated_at; });
      } else {
        const mine = m.owner === A.user.id;
        // first sign-in on a computer that already has saves: if they differ from the account's, the player chooses
        let prefer = null;
        if (!mine) {
          const clash = local.filter(k => cloud.has(k) && cloud.get(k).data !== ls.getItem(k));
          if (clash.length) prefer = A.onConflict ? await A.onConflict(clash) : 'cloud';
        }
        new Set([...local, ...cloud.keys()]).forEach(k => {
          const L = ls.getItem(k), C = cloud.get(k);
          let lt = m.ts[k] || 0;
          if (!mine) lt = prefer === 'local' || (L != null && !C) ? Date.now() : 0;
          if (C && C.data !== L && (L == null || C.updated_at >= lt)) { rawSet.call(ls, k, C.data); m.ts[k] = C.updated_at; changed.push(k); }
          else if (L != null && (!C || (C.data !== L && lt > C.updated_at))) { m.ts[k] = lt || Date.now(); dirty.add(k); }
        });
      }
      local.concat([...cloud.keys()]).forEach(k => scoresFromSave(k, ls.getItem(k)));
      m.owner = A.user.id; putMeta(m);
      A.lastSync = Date.now(); A.error = '';
      if (dirty.size) await push();
    } catch (e) { A.error = 'Sync failed: ' + (e.message || e); console.warn(e); }
    A.syncing = false; emit();
    return changed;
  }
  A.sync = sync;

  // ------------------------------------------------------------ auth
  async function loadProfile(u) {
    const r = await A.sb.from('profiles').select('id,username,color').eq('id', u.id).maybeSingle();
    if (r.data) A.user = r.data;
    else A.user = { id: u.id, username: (u.user_metadata && u.user_metadata.username) || 'player', color: '#b07cff' };
  }
  A.init = async function () {
    if (A._init) return A._init;
    return (A._init = (async () => {
      if (!A.configured) { A.ready = true; emit(); return; }
      try {
        await loadScript();
        A.sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'arcade-auth' } });
        const { data } = await A.sb.auth.getSession();
        if (data.session) { await loadProfile(data.session.user); }
        A.sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_OUT') { A.user = null; emit(); } });
      } catch (e) { A.error = e.message || String(e); }
      A.ready = true; emit();
      if (A.user) { A.firstSync = sync(); await A.firstSync; startPresence(); }
    })());
  };
  const checkName = n => /^[A-Za-z0-9_]{3,16}$/.test(n) ? '' : 'Username: 3-16 letters, numbers or _';
  A.signUp = async function (username, password, color) {
    username = (username || '').trim();
    const bad = checkName(username); if (bad) throw new Error(bad);
    if ((password || '').length < 6) throw new Error('Password must be at least 6 characters');
    const taken = await A.sb.from('profiles').select('id').eq('username_lower', username.toLowerCase()).maybeSingle();
    if (taken.data) throw new Error('That username is taken');
    const r = await A.sb.auth.signUp({ email: EMAIL(username), password, options: { data: { username, color: color || '#b07cff' } } });
    if (r.error) throw new Error(/registered|exists/i.test(r.error.message) ? 'That username is taken' : r.error.message);
    if (!r.data.session) throw new Error('Account made, but sign-in is blocked: the site owner needs to turn off "Confirm email" in Supabase.');
    await loadProfile(r.data.user); emit();
    await sync(); startPresence();
  };
  A.signIn = async function (username, password) {
    username = (username || '').trim();
    if (!username || !password) throw new Error('Enter your username and password');
    const r = await A.sb.auth.signInWithPassword({ email: EMAIL(username), password });
    if (r.error) throw new Error(/invalid/i.test(r.error.message) ? 'Wrong username or password' : r.error.message);
    await loadProfile(r.data.user); emit();
    await sync(); startPresence();
  };
  A.signOut = async function () {
    await A.flush().catch(() => {});
    try { await A.sb.from('profiles').update({ playing: null, last_seen: null }).eq('id', A.user.id); } catch (e) {}
    await A.sb.auth.signOut(); A.user = null; stopPresence(); emit();
  };
  A.setColor = async function (color) {
    const r = await A.sb.from('profiles').update({ color }).eq('id', A.user.id); if (r.error) throw r.error;
    A.user.color = color; emit();
  };

  // ------------------------------------------------------------ presence ("online now / playing X")
  let presTimer = null; A.playing = null;
  function beat() { if (A.user) A.sb.from('profiles').update({ last_seen: new Date().toISOString(), playing: A.playing }).eq('id', A.user.id).then(() => {}); }
  function startPresence() { stopPresence(); beat(); presTimer = setInterval(beat, 60000); }
  function stopPresence() { clearInterval(presTimer); presTimer = null; }
  A.setPlaying = g => { A.playing = g || null; beat(); };
  A.isOnline = p => p && p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 150000;

  // ------------------------------------------------------------ leaderboards
  A.leaderboard = async function (board, limit = 50) {
    const B = BOARDS.find(b => b.id === board);
    const r = await A.sb.from('scores').select('score,user_id,profiles(username,color)').eq('board', board).order('score', { ascending: !!(B && B.lower) }).limit(limit);
    if (r.error) throw r.error;
    return r.data;
  };
  A.myScores = async function () {
    const r = await A.sb.from('scores').select('board,score').eq('user_id', A.user.id);
    if (r.error) throw r.error; return r.data;
  };
  A.fmtScore = (board, v) => {
    const B = BOARDS.find(b => b.id === board) || {};
    if (B.fmt === 'time') { const m = Math.floor(v / 60), s = v - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; }
    if (B.fmt === 'big' && v >= 1e6) { const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']; let i = 0; while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; } return v.toFixed(2) + u[i]; }
    return Math.round(v).toLocaleString();
  };

  // ------------------------------------------------------------ friends
  const PF = 'id,username,color,last_seen,playing';
  A.friends = async function () {
    const me = A.user.id;
    const r = await A.sb.from('friends').select(`requester,addressee,status,a:profiles!friends_requester_fkey(${PF}),b:profiles!friends_addressee_fkey(${PF})`).or(`requester.eq.${me},addressee.eq.${me}`);
    if (r.error) throw r.error;
    const out = { friends: [], incoming: [], outgoing: [] };
    r.data.forEach(f => {
      const other = f.requester === me ? f.b : f.a;
      if (!other) return;
      if (f.status === 'accepted') out.friends.push(other);
      else if (f.addressee === me) out.incoming.push(other);
      else out.outgoing.push(other);
    });
    out.friends.sort((x, y) => (A.isOnline(y) - A.isOnline(x)) || x.username.localeCompare(y.username));
    return out;
  };
  A.addFriend = async function (name) {
    name = (name || '').trim();
    const p = await A.sb.from('profiles').select('id,username').eq('username_lower', name.toLowerCase()).maybeSingle();
    if (!p.data) throw new Error(`No player called "${name}"`);
    if (p.data.id === A.user.id) throw new Error("That's you!");
    // they already asked me: accept instead
    const back = await A.sb.from('friends').select('status').eq('requester', p.data.id).eq('addressee', A.user.id).maybeSingle();
    if (back.data) { if (back.data.status !== 'accepted') await A.acceptFriend(p.data.id); return `You and ${p.data.username} are now friends!`; }
    const r = await A.sb.from('friends').insert({ requester: A.user.id, addressee: p.data.id });
    if (r.error) { if (/duplicate/i.test(r.error.message)) return `Request already sent to ${p.data.username}`; throw r.error; }
    return `Friend request sent to ${p.data.username}`;
  };
  A.acceptFriend = async function (id) {
    const r = await A.sb.from('friends').update({ status: 'accepted' }).eq('requester', id).eq('addressee', A.user.id);
    if (r.error) throw r.error;
  };
  A.removeFriend = async function (id) {
    const me = A.user.id;
    const r = await A.sb.from('friends').delete().or(`and(requester.eq.${me},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me})`);
    if (r.error) throw r.error;
  };

  // ------------------------------------------------------------ game pages opened on their own (not inside the arcade)
  if (!window.ACCOUNT_HUB) {
    A.init().then(async () => {
      if (!A.firstSync) return;
      const changed = await A.firstSync;
      // saves came down from the cloud after the game already loaded: reload once so it uses them
      if (changed.length && !sessionStorage.getItem('acct_reloaded')) { sessionStorage.setItem('acct_reloaded', '1'); location.reload(); }
    });
  }
})();
