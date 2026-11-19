// =====================================================================
//  CNATT'S ARCADE - coins, cosmetics and daily challenges, shared by
//  every game. Stored in localStorage under cnatt_arcade, so it syncs
//  to the player's account with the rest of their saves.
//
//  Games call:  Arcade.event(game, type, data)   at the end of a match/run
//               Arcade.equipped(game, slot)      to get the equipped item
// =====================================================================
(function () {
  'use strict';
  if (window.Arcade) return;
  const KEY = 'cnatt_arcade';
  const fresh = () => ({ coins: 0, earned: 0, owned: {}, eq: {}, daily: { day: '', prog: 0, done: false, streak: 0, best: 0, last: '' } });
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return Object.assign(fresh(), d, { daily: Object.assign(fresh().daily, d.daily || {}) }); } catch (e) {} return fresh(); }
  function store(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} listeners.forEach(f => { try { f(d); } catch (e) {} }); }
  const listeners = [];
  const isOwner = () => !!(window.Account && Account.isOwnerMe && Account.isOwnerMe());

  // ---------------------------------------------------------------- cosmetics
  // fx: special looks the games know how to draw. admin: owner only, free.
  const CATALOG = [
    // 2 Player Tag - player skins
    { id: 'tag_gold', game: 'tag', slot: 'skin', name: 'Solid Gold', price: 400, col: '#ffcc1a', fx: 'shine' },
    { id: 'tag_galaxy', game: 'tag', slot: 'skin', name: 'Galaxy', price: 650, col: '#4338ca', fx: 'stars' },
    { id: 'tag_lava', game: 'tag', slot: 'skin', name: 'Lava', price: 650, col: '#f97316', fx: 'lava' },
    { id: 'tag_rainbow', game: 'tag', slot: 'skin', name: 'Rainbow', price: 1200, col: '#ff4d6d', fx: 'rainbow' },
    { id: 'tag_owner', game: 'tag', slot: 'skin', name: 'Owner Crown', admin: true, col: '#111827', fx: 'crown' },
    // Turbo Karts - paint jobs for your kart
    { id: 'kart_gold', game: 'kart', slot: 'paint', name: 'Gold Paint', price: 450, body: '#f5c518', trim: '#1a1a1a' },
    { id: 'kart_chrome', game: 'kart', slot: 'paint', name: 'Chrome', price: 600, body: '#d6dbe4', trim: '#2563eb' },
    { id: 'kart_neon', game: 'kart', slot: 'paint', name: 'Neon Rush', price: 750, body: '#22ff88', trim: '#ff2bd6' },
    { id: 'kart_midnight', game: 'kart', slot: 'paint', name: 'Midnight', price: 750, body: '#1e1b4b', trim: '#38bdf8' },
    { id: 'kart_inferno', game: 'kart', slot: 'paint', name: 'Owner Inferno', admin: true, body: '#0b0b0f', trim: '#ff5a1f' },
    // Powder Peak - outfits (jacket, pants, helmet, board/skis)
    { id: 'ski_gold', game: 'ski', slot: 'outfit', name: 'Gold Medal', price: 500, jacket: '#facc15', pants: '#1f2937', helmet: '#facc15', deck: '#111827' },
    { id: 'ski_neon', game: 'ski', slot: 'outfit', name: 'Neon 90s', price: 600, jacket: '#22d3ee', pants: '#d946ef', helmet: '#a3e635', deck: '#f43f5e' },
    { id: 'ski_arctic', game: 'ski', slot: 'outfit', name: 'Arctic', price: 600, jacket: '#e0f2fe', pants: '#94a3b8', helmet: '#f8fafc', deck: '#0ea5e9' },
    { id: 'ski_owner', game: 'ski', slot: 'outfit', name: 'Owner Suit', admin: true, jacket: '#0b0b0f', pants: '#0b0b0f', helmet: '#ffd400', deck: '#ffd400' },
    // Snake Arena - skins
    { id: 'snake_gold', game: 'snake', slot: 'skin', name: 'Golden', price: 400, c1: '#fde047', c2: '#a16207' },
    { id: 'snake_lava', game: 'snake', slot: 'skin', name: 'Lava', price: 550, c1: '#fb923c', c2: '#7f1d1d' },
    { id: 'snake_galaxy', game: 'snake', slot: 'skin', name: 'Galaxy', price: 650, c1: '#818cf8', c2: '#1e1b4b' },
    { id: 'snake_mint', game: 'snake', slot: 'skin', name: 'Mint Choc', price: 450, c1: '#6ee7b7', c2: '#3f2a1d' },
    { id: 'snake_owner', game: 'snake', slot: 'skin', name: 'Royal Serpent', admin: true, c1: '#ffd400', c2: '#111827', fx: 'crown' },
    // Rocket Soccer - car paint
    { id: 'soccer_gold', game: 'soccer', slot: 'car', name: 'Gold Car', price: 450, col: '#facc15' },
    { id: 'soccer_carbon', game: 'soccer', slot: 'car', name: 'Carbon', price: 550, col: '#27272a' },
    { id: 'soccer_toxic', game: 'soccer', slot: 'car', name: 'Toxic', price: 550, col: '#84cc16' },
    { id: 'soccer_owner', game: 'soccer', slot: 'car', name: 'Owner Royale', admin: true, col: '#7c3aed', fx: 'crown' },
    // Putt Park - golf balls (and their trails)
    { id: 'golf_gold', game: 'golf', slot: 'ball', name: 'Gold Ball', price: 350, col: '#facc15', fx: 'shine' },
    { id: 'golf_fire', game: 'golf', slot: 'ball', name: 'Fireball', price: 550, col: '#f97316', fx: 'fire' },
    { id: 'golf_galaxy', game: 'golf', slot: 'ball', name: 'Galaxy', price: 600, col: '#6366f1', fx: 'stars' },
    { id: 'golf_rainbow', game: 'golf', slot: 'ball', name: 'Rainbow Trail', price: 900, col: '#f472b6', fx: 'rainbow' },
    { id: 'golf_owner', game: 'golf', slot: 'ball', name: 'Owner Crown Ball', admin: true, col: '#fde047', fx: 'crown' },
  ];
  const GAME_NAMES = { tag: '2 Player Tag', kart: 'Turbo Karts', ski: 'Powder Peak', snake: 'Snake Arena', soccer: 'Rocket Soccer', party: 'Party Clash', horde: 'Nightfall Horde', siege: 'Nightfall Siege', dungeon: 'Nightfall Depths', fishing: 'Fishing Simulator', chess: 'Nightfall Chess', golf: 'Putt Park' };

  // ---------------------------------------------------------------- coins per game event
  const REWARD = {
    tag: { match: v => v.won ? (v.pro ? 60 : v.ranked ? 45 : 30) : 10, tourney: v => v.won ? 50 + 25 * (v.players || 2) : 20 },
    soccer: { match: v => (v.won ? 35 : 10) + Math.min(5, v.goals || 0) * 3, tourney: v => v.won ? 50 + 25 * (v.players || 2) : 20 },
    snake: { death: v => Math.min(90, Math.floor((v.len || 0) / 40) + (v.kills || 0) * 5) },
    ski: { run: v => Math.min(120, Math.floor((v.score || 0) / 400)), heat: v => [0, 60, 35, 20, 10][v.place] || 10, race: v => [0, 50, 30, 20, 10][v.place] || 10 },
    kart: { race: v => Math.max(5, 50 - ((v.place || 8) - 1) * 6) },
    party: { match: v => v.won ? 35 : 10 },
    horde: { run: v => Math.min(100, (v.wave || 0) * 4) },
    siege: { run: v => Math.min(100, (v.wave || 0) * 4) },
    dungeon: { run: v => Math.min(100, (v.floor || 0) * 8) },
    fishing: { catch: v => [1, 2, 4, 8, 15][v.rarity || 0] || 1 },
    chess: { game: v => v.won ? 40 : 10 },
    golf: { round: v => v.won ? 40 : 15, ace: () => 25 },
  };

  // ---------------------------------------------------------------- daily challenge
  const DAILY = [
    { game: 'tag', type: 'match', text: 'Beat the PRO CPU in 2 Player Tag', ok: v => v.won && v.pro },
    { game: 'tag', type: 'match', text: 'Win 3 matches of 2 Player Tag', ok: v => v.won, count: 3 },
    { game: 'ski', type: 'run', text: 'Score 10,000 in one Powder Peak run', ok: v => v.score >= 10000 },
    { game: 'ski', type: 'heat', text: 'Finish top 2 in a Powder Peak ranked heat', ok: v => v.place <= 2 },
    { game: 'kart', type: 'race', text: 'Finish on the podium in Turbo Karts', ok: v => v.place <= 3 },
    { game: 'kart', type: 'race', text: 'Win a Turbo Karts race', ok: v => v.place === 1 },
    { game: 'soccer', type: 'match', text: 'Win a Rocket Soccer match', ok: v => v.won },
    { game: 'soccer', type: 'match', text: 'Score 4 goals in one Rocket Soccer match', ok: v => v.goals >= 4 },
    { game: 'snake', type: 'death', text: 'Grow to length 300 in Snake Arena', ok: v => v.len >= 300 },
    { game: 'snake', type: 'death', text: 'Get 3 kills in one Snake Arena game', ok: v => v.kills >= 3 },
    { game: 'party', type: 'match', text: 'Win a Party Clash match', ok: v => v.won },
    { game: 'golf', type: 'round', text: 'Finish Putt Park at par or better', ok: v => v.toPar <= 0 },
    { game: 'golf', type: 'ace', text: 'Get a hole in one in Putt Park', ok: () => true },
    { game: 'horde', type: 'run', text: 'Reach wave 8 in Nightfall Horde', ok: v => v.wave >= 8 },
    { game: 'siege', type: 'run', text: 'Hold out for 6 waves in Nightfall Siege', ok: v => v.wave >= 6 },
    { game: 'dungeon', type: 'run', text: 'Reach floor 4 in Nightfall Depths', ok: v => v.floor >= 4 },
    { game: 'fishing', type: 'catch', text: 'Catch 15 fish in Fishing Simulator', ok: () => true, count: 15 },
    { game: 'chess', type: 'game', text: 'Win a game of Nightfall Chess', ok: v => v.won },
  ];
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const prevDay = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function today() {
    const day = dayKey(), pool = DAILY.filter(c => !window.ARCADE_GAMES || window.ARCADE_GAMES.includes(c.game));
    const c = pool[hashStr('daily' + day) % pool.length];
    return Object.assign({ day, reward: 150 }, c);
  }
  function dailyState() {
    const d = load(), c = today();
    if (d.daily.day !== c.day) { d.daily.day = c.day; d.daily.prog = 0; d.daily.done = false; store(d); }
    // a streak survives until the end of the day after the last completion
    const alive = d.daily.last === c.day || d.daily.last === prevDay();
    return { challenge: c, prog: d.daily.prog, done: d.daily.done, streak: alive ? d.daily.streak : 0, best: d.daily.best, count: c.count || 1 };
  }

  // ---------------------------------------------------------------- toasts (shown inside whatever page is open)
  function toast(title, sub, col) {
    if (!document.body) return;
    let box = document.getElementById('arcade-toasts');
    if (!box) {
      box = document.createElement('div'); box.id = 'arcade-toasts';
      box.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;font-family:Inter,system-ui,sans-serif';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.style.cssText = `background:rgba(12,14,24,0.92);border:1px solid ${col || 'rgba(250,204,21,0.6)'};color:#fff;padding:9px 16px;border-radius:999px;font-weight:800;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,0.4);opacity:0;transform:translateY(-8px);transition:all .25s ease;white-space:nowrap`;
    el.innerHTML = `<span>${title}</span>${sub ? `<span style="font-weight:600;color:#cbd5e1;margin-left:8px">${sub}</span>` : ''}`;
    box.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'none'; });
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(() => el.remove(), 300); }, 3200);
  }
  const coinSvg = '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff3b0,#facc15 45%,#b45309);vertical-align:-2px;margin-right:6px;box-shadow:0 0 0 1px rgba(0,0,0,0.25)"></span>';

  // ---------------------------------------------------------------- API
  const A = {
    CATALOG, GAME_NAMES, DAILY,
    coins: () => load().coins,
    data: load,
    isOwner,
    onChange(f) { listeners.push(f); },
    earn(n, why) {
      n = Math.max(0, Math.round(n)); if (!n) return;
      const d = load(); d.coins += n; d.earned += n; store(d);
      toast(`${coinSvg}+${n}`, why || '');
    },
    items(game) { return CATALOG.filter(i => (!game || i.game === game) && (!i.admin || isOwner())); },
    owned(id) { const it = CATALOG.find(i => i.id === id); if (!it) return false; if (it.admin) return isOwner(); return !!load().owned[id]; },
    buy(id) {
      const it = CATALOG.find(i => i.id === id), d = load();
      if (!it || it.admin || d.owned[id]) return false;
      if (d.coins < it.price) return false;
      d.coins -= it.price; d.owned[id] = Date.now(); d.eq[it.game + ':' + it.slot] = id; store(d);
      return true;
    },
    equip(id) {
      const it = CATALOG.find(i => i.id === id); if (!it || !A.owned(id)) return false;
      const d = load(), k = it.game + ':' + it.slot; d.eq[k] = d.eq[k] === id ? null : id; store(d); return true;
    },
    equipped(game, slot) {
      const id = load().eq[game + ':' + slot]; if (!id) return null;
      const it = CATALOG.find(i => i.id === id); return it && A.owned(id) ? it : null;
    },
    daily: dailyState,
    // a game finished something: pay out coins and check the daily challenge
    event(game, type, data) {
      data = data || {};
      try {
        const f = REWARD[game] && REWARD[game][type]; if (f) A.earn(f(data), GAME_NAMES[game] || '');
        const st = dailyState(), c = st.challenge;
        if (!st.done && c.game === game && c.type === type && c.ok(data)) {
          const d = load(); d.daily.prog = (d.daily.prog || 0) + 1;
          if (d.daily.prog >= (c.count || 1)) {
            d.daily.done = true;
            d.daily.streak = (d.daily.last === prevDay() ? d.daily.streak : 0) + 1;
            d.daily.last = c.day; d.daily.best = Math.max(d.daily.best || 0, d.daily.streak);
            const bonus = c.reward + Math.min(7, d.daily.streak - 1) * 25;
            d.coins += bonus; d.earned += bonus; store(d);
            setTimeout(() => toast('🔥 Daily challenge complete!', `${coinSvg}+${bonus}  ·  ${d.daily.streak} day streak`, 'rgba(251,146,60,0.8)'), 600);
          } else { store(d); toast('Daily challenge', `${d.daily.prog} / ${c.count}`, 'rgba(251,146,60,0.6)'); }
        }
      } catch (e) { console.warn('Arcade.event', e); }
    },
    toast,
  };
  window.Arcade = A;
})();
