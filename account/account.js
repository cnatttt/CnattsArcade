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
    { id: 'soccer_wins', game: 'Rocket Soccer', name: 'Match wins', key: 'cnatt_soccer', get: s => s.wins },
    { id: 'soccer_goals', game: 'Rocket Soccer', name: 'Goals scored', key: 'cnatt_soccer', get: s => s.goals },
    { id: 'snake_best', game: 'Snake Arena', name: 'Longest snake', key: 'cnatt_snake', get: s => s.best },
    { id: 'snake_kills', game: 'Snake Arena', name: 'Total kills', key: 'cnatt_snake', get: s => s.kills },
    { id: 'ski_best', game: 'Powder Peak', name: 'Best run score', key: 'cnatt_ski', get: s => s.best },
    { id: 'ski_elo', game: 'Powder Peak', name: 'Ranked Elo', key: null },
    { id: 'tag_elo', game: '2 Player Tag', name: 'Ranked Elo', key: null },
    { id: 'soccer_elo', game: 'Rocket Soccer', name: 'Ranked Elo', key: null },
    { id: 'kart_elo', game: 'Turbo Karts', name: 'Ranked Elo', key: null },
    { id: 'golf_best', game: 'Putt Park', name: 'Best round (strokes)', key: 'cnatt_golf', lower: true, get: s => s.best || null },
    { id: 'golf_aces', game: 'Putt Park', name: 'Holes in one', key: 'cnatt_golf', get: s => s.aces },
  ];
  const sentScore = {};
  function scoresFromSave(key, data) {
    if (!A.user || A.user.banned || A.cheated || data == null) return;
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
    let r = await A.sb.from('profiles').select('id,username,color,banned,display_name,avatar_url,banner_url,bio,showcase,created_at').eq('id', u.id).maybeSingle();
    A.v2 = !r.error;   // false = the database hasn't had the PROFILES 2 part of setup.sql yet
    if (r.error) r = await A.sb.from('profiles').select('id,username,color,banned').eq('id', u.id).maybeSingle();
    if (r.error) r = await A.sb.from('profiles').select('id,username,color').eq('id', u.id).maybeSingle();   // older database without the admin columns
    if (r.data) A.user = r.data;
    else A.user = { id: u.id, username: (u.user_metadata && u.user_metadata.username) || 'player', color: '#b07cff' };
    try { const ad = await A.sb.from('admins').select('user_id').eq('user_id', u.id).maybeSingle(); A.user.admin = !!ad.data; } catch (e) { A.user.admin = false; }
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
        A.loadAdmins();
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
    try { await A.sb.from('profiles').update({ playing: null, last_seen: null }).eq('id', A.user.id); await A.sb.from('profiles').update({ room: null }).eq('id', A.user.id); } catch (e) {}
    await A.sb.auth.signOut(); A.user = null; stopPresence(); emit();
  };
  A.setColor = async function (color) {
    const r = await A.sb.from('profiles').update({ color }).eq('id', A.user.id); if (r.error) throw r.error;
    A.user.color = color; emit();
  };

  // ------------------------------------------------------------ presence ("online now / playing X")
  let presTimer = null; A.playing = null;
  A.room = null;
  function beat() {
    if (!A.user) return;
    A.sb.from('profiles').update({ last_seen: new Date().toISOString(), playing: A.playing }).eq('id', A.user.id).then(() => {});
    A.sb.from('profiles').update({ room: A.room }).eq('id', A.user.id).then(() => {});   // separate: older databases have no room column
  }
  // the online room I'm in, so friends can join me ("party:ABCDE")
  A.setRoom = r => { const v = r && r.code ? r.game + ':' + r.code : null; if (v === A.room) return; A.room = v; beat(); };
  function startPresence() { stopPresence(); beat(); presTimer = setInterval(beat, 60000); }
  function stopPresence() { clearInterval(presTimer); presTimer = null; }
  A.setPlaying = g => { A.playing = g || null; beat(); };
  A.isOnline = p => p && p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 150000;

  // ------------------------------------------------------------ the owner tag (shown next to admin names in multiplayer)
  A.adminNames = null;
  A.loadAdmins = async function () {
    try {
      let r = await A.sb.from('admins').select('profiles(username,display_name)');
      if (r.error) r = await A.sb.from('admins').select('profiles(username)');
      if (!r.error) A.adminNames = new Set(r.data.flatMap(x => x.profiles ? [x.profiles.username, x.profiles.display_name] : []).filter(Boolean).map(n => n.toLowerCase()));
    } catch (e) {}
  };
  A.isOwnerMe = () => !!(A.user && A.user.admin);
  // a player shows the tag if their game says they're the owner AND the name really is an admin account
  A.ownerOK = (name, flag) => !!flag && (!A.adminNames || A.adminNames.has(String(name || '').toLowerCase()));
  // draws the tag on a game's canvas; returns its width
  A.drawOwnerTag = function (ctx, x, y, h, align) {
    const t = performance.now() / 1000, fs = h * 0.56, label = 'OWNER';
    ctx.save(); ctx.font = `800 ${fs}px Rubik, Fredoka, 'Russo One', sans-serif`;
    const cw = h * 0.95, w = cw + ctx.measureText(label).width + h * 0.55;
    if (align === 'right') x -= w; else if (align === 'center') x -= w / 2;
    const r = h / 2;
    ctx.shadowColor = '#ffb020'; ctx.shadowBlur = h * 0.5 + Math.sin(t * 4) * h * 0.2;
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.45, '#ffc21a'); g.addColorStop(1, '#ff7a1a');
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.5, h * 0.09); ctx.strokeStyle = '#5a2a00'; ctx.stroke();
    // shine sweeping across
    ctx.save(); ctx.clip(); const sx = x + ((t * 0.6) % 1.6 - 0.3) * w; const sg = ctx.createLinearGradient(sx - h, 0, sx + h, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.7)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(x, y, w, h); ctx.restore();
    // crown
    const cx = x + h * 0.22, cy = y + h * 0.26, s = h * 0.5;
    ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.85); ctx.lineTo(cx, cy + s * 0.15); ctx.lineTo(cx + s * 0.3, cy + s * 0.45); ctx.lineTo(cx + s * 0.55, cy); ctx.lineTo(cx + s * 0.8, cy + s * 0.45); ctx.lineTo(cx + s * 1.1, cy + s * 0.15); ctx.lineTo(cx + s * 1.1, cy + s * 0.85); ctx.closePath();
    ctx.fillStyle = '#5a2a00'; ctx.fill();
    ctx.fillStyle = '#5a2a00'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + cw, y + h * 0.53);
    ctx.restore();
    return w;
  };

  // ------------------------------------------------------------ site settings (set by admins) + public numbers
  const SITE_CACHE = 'arcade_site';
  A.siteCached = () => J(ls.getItem(SITE_CACHE)) || {};
  A.site = async function () {
    if (!A.sb) return A.siteCached();
    const r = await A.sb.from('site_settings').select('key,value');
    if (r.error) return A.siteCached();
    const o = {}; r.data.forEach(x => { o[x.key] = x.value; });
    try { rawSet.call(ls, SITE_CACHE, JSON.stringify(o)); } catch (e) {}
    return o;
  };
  A.setSite = async function (key, value) {
    const r = await A.sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() });
    if (r.error) throw r.error;
  };
  A.publicStats = async function () {
    const since = new Date(Date.now() - 150000).toISOString();
    const [a, b] = await Promise.all([
      A.sb.from('profiles').select('id', { count: 'exact', head: true }),
      A.sb.from('profiles').select('id', { count: 'exact', head: true }).gt('last_seen', since)]);
    return { players: a.count || 0, online: b.count || 0 };
  };

  // ------------------------------------------------------------ leaderboards
  A.leaderboard = async function (board, limit = 50) {
    const B = BOARDS.find(b => b.id === board);
    const q = f => A.sb.from('scores').select(`score,user_id,profiles(${f})`).eq('board', board).order('score', { ascending: !!(B && B.lower) }).limit(limit);
    let r = await q(A.v2 !== false ? 'username,color,display_name,avatar_url' : 'username,color');
    if (r.error) r = await q('username,color');
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
  let PF = 'id,username,color,last_seen,playing,room';
  A.friends = async function () {
    const me = A.user.id;
    if (A.v2 && !PF.includes('display_name')) PF += ',display_name,avatar_url';
    const q = () => A.sb.from('friends').select(`requester,addressee,status,a:profiles!friends_requester_fkey(${PF}),b:profiles!friends_addressee_fkey(${PF})`).or(`requester.eq.${me},addressee.eq.${me}`);
    let r = await q();
    if (r.error && PF.includes('display_name')) { PF = 'id,username,color,last_seen,playing,room'; A.v2 = false; r = await q(); }
    if (r.error && PF.includes('room')) { PF = 'id,username,color,last_seen,playing'; r = await q(); }
    if (r.error) throw r.error;
    const out = { friends: [], incoming: [], outgoing: [] };
    r.data.forEach(f => {
      const other = f.requester === me ? f.b : f.a;
      if (!other) return;
      if (f.status === 'accepted') out.friends.push(other);
      else if (f.addressee === me) out.incoming.push(other);
      else out.outgoing.push(other);
    });
    out.friends.sort((x, y) => (A.isOnline(y) - A.isOnline(x)) || A.nameOf(x).localeCompare(A.nameOf(y)));
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

  // ------------------------------------------------------------ profiles: display name, pictures, bio, badges
  A.nameOf = p => (p && (p.display_name || p.username)) || 'Player';
  A.name = () => A.user ? A.nameOf(A.user) : null;
  A.checkDisplay = n => !n ? '' : /^[A-Za-z0-9_.'!-]([A-Za-z0-9 _.'!-]{0,14}[A-Za-z0-9_.'!-])?$/.test(n) ? '' : "Name: 1-16 letters, numbers, spaces or _ . ' ! - (no space at the ends)";
  const needV2 = () => { if (!A.v2) throw new Error('The site owner needs to run the latest setup.sql in Supabase first.'); };
  A.updateProfile = async function (fields) {
    needV2();
    const f = {};
    if ('display_name' in fields) { let n = (fields.display_name || '').trim().replace(/\s+/g, ' '); if (n.toLowerCase() === A.user.username.toLowerCase()) n = ''; const bad = A.checkDisplay(n); if (bad) throw new Error(bad); f.display_name = n || null; }
    if ('bio' in fields) f.bio = String(fields.bio || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 160) || null;
    if ('showcase' in fields) f.showcase = fields.showcase;
    const r = await A.sb.from('profiles').update(f).eq('id', A.user.id);
    if (r.error) throw new Error(/taken|duplicate|unique/i.test(r.error.message) ? 'That name is already taken' : r.error.message);
    Object.assign(A.user, f); emit();
  };
  // shrink/crop an image file in the browser so uploads stay small (avatar 256x256, banner 1200x400)
  function crop(file, w, h) {
    return new Promise((res, rej) => {
      if (!/^image\//.test(file.type)) return rej(new Error('Pick an image file (PNG, JPG, GIF or WebP)'));
      if (file.size > 15e6) return rej(new Error('That image is too big (15 MB max)'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
        const k = Math.max(w / img.width, h / img.height), dw = img.width * k, dh = img.height * k;
        x.imageSmoothingQuality = 'high'; x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error('Could not read that image')), 'image/webp', 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image')); };
      img.src = url;
    });
  }
  const mediaPath = u => { const m = /\/profile-media\/(.+)$/.exec(u || ''); return m ? decodeURIComponent(m[1].split('?')[0]) : null; };
  A.uploadImage = async function (kind, file) {
    needV2();
    const [w, h] = kind === 'banner' ? [1200, 400] : [256, 256];
    let blob = await crop(file, w, h);
    const webp = blob.type === 'image/webp';
    if (!webp) blob = await new Promise(r => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(i, 0, 0); c.toBlob(r, 'image/jpeg', 0.88); }; i.src = URL.createObjectURL(blob); });
    const path = `${A.user.id}/${kind}-${Date.now().toString(36)}.${webp ? 'webp' : 'jpg'}`;
    const up = await A.sb.storage.from('profile-media').upload(path, blob, { contentType: webp ? 'image/webp' : 'image/jpeg', cacheControl: '31536000' });
    if (up.error) throw new Error(/bucket/i.test(up.error.message) ? 'Picture storage is not set up yet (run setup.sql).' : up.error.message);
    const pub = A.sb.storage.from('profile-media').getPublicUrl(path).data.publicUrl;
    const col = kind === 'banner' ? 'banner_url' : 'avatar_url', old = A.user[col];
    const r = await A.sb.from('profiles').update({ [col]: pub }).eq('id', A.user.id);
    if (r.error) { A.sb.storage.from('profile-media').remove([path]); throw r.error; }
    A.user[col] = pub; emit();
    if (mediaPath(old)) A.sb.storage.from('profile-media').remove([mediaPath(old)]).then(() => {}, () => {});
  };
  A.removeImage = async function (kind) {
    needV2();
    const col = kind === 'banner' ? 'banner_url' : 'avatar_url', old = A.user[col];
    const r = await A.sb.from('profiles').update({ [col]: null }).eq('id', A.user.id); if (r.error) throw r.error;
    A.user[col] = null; emit();
    if (mediaPath(old)) A.sb.storage.from('profile-media').remove([mediaPath(old)]).then(() => {}, () => {});
  };
  // someone's public profile (by id or username)
  A.getProfile = async function (who) {
    const f = A.v2 !== false ? 'id,username,color,display_name,avatar_url,banner_url,bio,showcase,last_seen,playing,room,created_at,banned' : 'id,username,color,last_seen,playing,created_at';
    const q = A.sb.from('profiles').select(f);
    let r = await (/^[0-9a-f-]{36}$/.test(who) ? q.eq('id', who) : q.eq('username_lower', String(who).toLowerCase())).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) throw new Error('No player with that name');
    const p = r.data;
    const sc = await A.sb.from('scores').select('board,score').eq('user_id', p.id);
    p.scores = sc.data || [];
    try { const ad = await A.sb.from('admins').select('user_id').eq('user_id', p.id).maybeSingle(); p.admin = !!ad.data; } catch (e) {}
    if (A.user && A.user.id !== p.id) {
      const me = A.user.id, fr = await A.sb.from('friends').select('requester,status').or(`and(requester.eq.${me},addressee.eq.${p.id}),and(requester.eq.${p.id},addressee.eq.${me})`);
      const f0 = fr.data && fr.data[0]; p.friend = !f0 ? 'none' : f0.status === 'accepted' ? 'friends' : f0.requester === me ? 'sent' : 'incoming';
    }
    return p;
  };
  A.adminClearProfile = async id => { const r = await A.sb.rpc('admin_clear_profile', { p_user: id }); if (r.error) throw r.error; };

  // badges are worked out from this player's saves, then published on their profile
  const RANKS = [[1100, 'Gold'], [1300, 'Platinum'], [1500, 'Diamond']];
  A.BADGES = [
    { id: 'owner', icon: '👑', name: 'Arcade Owner', desc: 'Runs the place', test: c => c.admin },
    { id: 'ace', icon: '⛳', name: 'Hole in One', desc: 'Sink a hole in one in Putt Park', test: c => (c.golf.aces || 0) > 0 || c.st('golf:ace') > 0 },
    { id: 'underpar', icon: '🏌️', name: 'Under Par', desc: 'Finish a Putt Park round under par', test: c => c.golf.bestPar != null && c.golf.bestPar < 0 },
    { id: 'champ', icon: '🏆', name: 'Tournament Champion', desc: 'Win a friend tournament', test: c => c.st('tag:tourney:won') + c.st('soccer:tourney:won') > 0 },
    { id: 'gold', icon: '🥇', name: 'Gold League', desc: 'Reach Gold in any ranked ladder', test: c => c.elo >= 1100 },
    { id: 'diamond', icon: '💎', name: 'Diamond League', desc: 'Reach Diamond in any ranked ladder', test: c => c.elo >= 1500 },
    { id: 'streak7', icon: '🔥', name: 'On Fire', desc: '7-day daily challenge streak', test: c => c.best >= 7 },
    { id: 'streak30', icon: '☄️', name: 'Unstoppable', desc: '30-day daily challenge streak', test: c => c.best >= 30 },
    { id: 'kartwin', icon: '🏁', name: 'Checkered Flag', desc: 'Win a Turbo Karts race', test: c => c.st('kart:race:won') > 0 || (c.kart.wins || 0) > 0 },
    { id: 'skirace', icon: '🎿', name: 'Downhill King', desc: 'Win a Powder Peak race on Hard', test: c => Object.values(c.ski.rwins || {}).some(v => v >= 3) },
    { id: 'collector', icon: '🛍️', name: 'Collector', desc: 'Own 10 shop items', test: c => c.owned >= 10 },
    { id: 'rich', icon: '💰', name: 'Big Earner', desc: 'Earn 10,000 coins in total', test: c => c.earned >= 10000 },
    { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Finish a game in 8 different arcade games', test: c => c.games >= 8 },
  ];
  A.badgeContext = function (elo) {
    const ar = window.Arcade ? Arcade.data() : { stats: {}, owned: {}, daily: {} }, st = ar.stats || {};
    return {
      admin: !!(A.user && A.user.admin), st: k => st[k] || 0, golf: J(ls.getItem('cnatt_golf')) || {}, kart: J(ls.getItem('cnatt_kart')) || {}, ski: J(ls.getItem('cnatt_ski')) || {},
      elo: elo || 0, best: Math.max(ar.daily.best || 0, ar.daily.streak || 0), owned: Object.keys(ar.owned || {}).length, earned: ar.earned || 0,
      games: new Set(Object.keys(st).map(k => k.split(':')[0])).size,
    };
  };
  A.myBadges = elo => { const c = A.badgeContext(elo); return A.BADGES.filter(b => { try { return b.test(c); } catch (e) { return false; } }).map(b => b.id); };
  // keep the public showcase (badges + equipped cosmetics) up to date
  let showT = null;
  A.publishShowcase = function () {
    clearTimeout(showT);
    showT = setTimeout(async () => {
      if (!A.user || !A.v2) return;
      try {
        const sc = await A.myScores().catch(() => []);
        const elo = Math.max(0, ...sc.filter(r => /_elo$/.test(r.board)).map(r => r.score));
        const ar = window.Arcade, eq = ar ? Object.entries(ar.data().eq || {}).filter(([, id]) => id && ar.owned(id)).map(([, id]) => { const it = ar.CATALOG.find(i => i.id === id); return it && { g: it.game, n: it.name, c: it.col || it.body || it.jacket || it.c1 || '#888' }; }).filter(Boolean) : [];
        const show = { badges: A.myBadges(elo), eq };
        if (JSON.stringify(show) !== JSON.stringify(A.user.showcase || {})) await A.updateProfile({ showcase: show });
      } catch (e) {}
    }, 3000);
  };
  A.on(() => { if (A.user && A.v2 && !A._showOnce) { A._showOnce = true; A.publishShowcase(); } if (!A.user) A._showOnce = false; });

  // ------------------------------------------------------------ invites ("come play with me")
  A.invite = async function (friendId, game, code, kind) {
    const row = { sender: A.user.id, recipient: friendId, game, code: String(code).toUpperCase(), kind: kind || 'room', created_at: new Date().toISOString() };
    const r = await A.sb.from('invites').upsert(row, { onConflict: 'sender,recipient' });
    if (r.error) throw new Error(/relation|does not exist/i.test(r.error.message) ? 'Invites are not set up yet (run setup.sql).' : r.error.message);
  };
  A.myInvites = async function () {
    if (!A.user) return [];
    const since = new Date(Date.now() - 3 * 60000).toISOString();
    const f = A.v2 ? 'username,color,display_name,avatar_url' : 'username,color';
    const r = await A.sb.from('invites').select(`sender,game,code,kind,created_at,p:profiles!invites_sender_fkey(${f})`).eq('recipient', A.user.id).gte('created_at', since).order('created_at', { ascending: false });
    return r.error ? [] : r.data;
  };
  A.dismissInvite = async sender => { try { await A.sb.from('invites').delete().eq('sender', sender).eq('recipient', A.user.id); } catch (e) {} };

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
