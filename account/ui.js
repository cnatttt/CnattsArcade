// =====================================================================
//  Arcade accounts - the arcade page's account button and panels
//  (sign in / create account, profile, friends, leaderboards)
// =====================================================================
'use strict';
(function () {
  const A = window.Account;
  const COLORS = ['#b07cff', '#ff6a7a', '#ffcc33', '#6ae06a', '#6ad0ff', '#ff9a4a', '#ff7ad8', '#4ae0c0', '#e8e4f0', '#8a8aff'];
  const css = `
  #acctBtn { position: fixed; top: 14px; left: 14px; z-index: 20; display: flex; align-items: center; gap: 10px; font-family: var(--pixel); font-size: 10px;
    color: var(--text); background: var(--panel2); border: 3px solid var(--line); padding: 7px 12px 7px 8px; cursor: pointer; box-shadow: 0 3px 0 #000a; }
  #acctBtn:hover { border-color: var(--gold); }
  #acctBtn:active { transform: translateY(2px); box-shadow: none; }
  #acctBtn .dot { width: 8px; height: 8px; border-radius: 50%; background: #6ae06a; box-shadow: 0 0 8px #6ae06a; }
  #acctBtn .dot.busy { background: var(--gold); box-shadow: 0 0 8px var(--gold); animation: blink 0.8s steps(2) infinite; }
  #acctBtn .dot.err { background: #ff6a7a; box-shadow: 0 0 8px #ff6a7a; }
  #acctBtn .badge { background: #ff6a7a; color: #07061a; padding: 3px 5px; font-size: 8px; }
  .av { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-family: var(--pixel); font-size: 11px;
    color: #07061a; border: 2px solid #07061a; box-shadow: inset 0 -3px 0 #0004; flex: none; }
  .av.big { width: 64px; height: 64px; font-size: 26px; border-width: 3px; box-shadow: inset 0 -6px 0 #0004, 0 4px 0 #000a; }
  #acct { position: fixed; inset: 0; z-index: 50; display: none; align-items: flex-start; justify-content: center; background: #07061add; padding: 60px 14px; overflow: auto; }
  #acct.open { display: flex; }
  #acct .box { width: 100%; max-width: 620px; background: var(--panel); border: 4px solid var(--line); box-shadow: 0 8px 0 #000a, 0 0 50px #b07cff33; animation: pop .25s cubic-bezier(.2,1.5,.4,1); }
  #acct .tabs { display: flex; border-bottom: 4px solid var(--line); }
  #acct .tabs button { flex: 1; font-family: var(--pixel); font-size: 10px; padding: 14px 6px; background: var(--panel2); color: var(--muted); border: 0; border-right: 3px solid var(--line); cursor: pointer; position: relative; }
  #acct .tabs button.on { background: var(--panel); color: var(--gold); }
  #acct .tabs button .badge { background: #ff6a7a; color: #07061a; padding: 2px 5px; font-size: 8px; margin-left: 6px; }
  #acct .tabs .x { flex: none; width: 52px; border-right: 0; color: var(--text); font-size: 14px; }
  #acct .body { padding: 26px 28px 30px; min-height: 260px; }
  #acct h3 { font-family: var(--pixel); font-size: 13px; color: var(--gold); margin: 0 0 16px; letter-spacing: 1px; }
  #acct p { color: var(--muted); margin: 0 0 14px; line-height: 1.1; }
  #acct .row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
  #acct label { font-family: var(--pixel); font-size: 9px; color: var(--muted); display: block; margin: 14px 0 6px; }
  #acct input, #acct select { width: 100%; font-family: var(--body); font-size: 24px; padding: 8px 12px; background: #07061a; color: var(--text); border: 3px solid var(--line); outline: none; }
  #acct input:focus, #acct select:focus { border-color: var(--gold); }
  #acct .btn { font-family: var(--pixel); font-size: 10px; padding: 12px 16px; background: var(--gold); color: #07061a; border: 0; cursor: pointer; box-shadow: inset 0 -4px 0 #0005, 0 3px 0 #000a; white-space: nowrap; }
  #acct .btn.alt { background: var(--panel2); color: var(--text); border: 3px solid var(--line); box-shadow: 0 3px 0 #000a; padding: 9px 12px; }
  #acct .btn.red { background: #ff6a7a; }
  #acct .btn.sm { font-size: 8px; padding: 8px 10px; }
  #acct .btn:active { transform: translateY(2px); box-shadow: none; }
  #acct .btn:disabled { opacity: .5; cursor: default; }
  #acct .msg { min-height: 24px; margin-top: 12px; color: #ff9ab0; }
  #acct .msg.ok { color: #8aff9a; }
  #acct .sub { display: flex; gap: 8px; margin-bottom: 18px; }
  #acct .sub button { font-family: var(--pixel); font-size: 9px; padding: 9px 12px; background: transparent; color: var(--muted); border: 3px solid var(--line); cursor: pointer; }
  #acct .sub button.on { color: var(--gold); border-color: var(--gold); }
  #acct .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  #acct .sw { width: 34px; height: 34px; border: 3px solid #07061a; cursor: pointer; box-shadow: 0 3px 0 #000a; }
  #acct .sw.on { outline: 3px solid var(--text); outline-offset: 2px; }
  #acct .list { display: flex; flex-direction: column; gap: 8px; }
  #acct .item { display: flex; align-items: center; gap: 12px; background: var(--panel2); border: 3px solid var(--line); padding: 8px 10px; }
  #acct .item .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #acct .item .st { color: var(--muted); font-size: 18px; }
  #acct .item .st.on { color: #8aff9a; }
  #acct .item.me { border-color: var(--gold); }
  #acct .rank { font-family: var(--pixel); font-size: 11px; width: 36px; text-align: right; color: var(--muted); }
  #acct .rank.r1 { color: #ffcc33; } #acct .rank.r2 { color: #d8dce8; } #acct .rank.r3 { color: #e8a060; }
  #acct .score { font-family: var(--pixel); font-size: 11px; color: var(--gold); }
  #acct .empty { color: var(--muted); text-align: center; padding: 30px 0; }
  #acct .stat { display: grid; grid-template-columns: 1fr auto; gap: 6px 14px; margin: 6px 0 18px; }
  #acct .stat span:nth-child(odd) { color: var(--muted); } #acct .stat span:nth-child(even) { text-align: right; }
  #acct code { font-size: 18px; color: var(--gold); }
  #acctAsk { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center; background: #07061add; }
  #acctAsk.open { display: flex; }
  #acctAsk .box { max-width: 520px; background: var(--panel); border: 4px solid var(--gold); padding: 28px 30px; text-align: center; box-shadow: 0 8px 0 #000a; }
  #acctAsk h2 { font-family: var(--pixel); font-size: 14px; color: var(--gold); margin: 0 0 16px; line-height: 1.5; }
  #acctAsk p { color: var(--muted); margin: 0 0 18px; }
  #acctAsk .btn { font-family: var(--pixel); font-size: 10px; padding: 12px 14px; margin: 6px; border: 0; cursor: pointer; background: var(--gold); color: #07061a; box-shadow: inset 0 -4px 0 #0005, 0 3px 0 #000a; }
  #acctAsk .btn.alt { background: var(--panel2); color: var(--text); }
  @media (max-width: 600px) { #acct .body { padding: 18px 16px 22px; } #acctBtn .nm { display: none; } }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e[k] = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
    kids.flat().forEach(c => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  };
  const avatar = (p, big) => { const a = el('span', { class: 'av' + (big ? ' big' : '') }, (p.username || '?')[0].toUpperCase()); a.style.background = p.color || '#b07cff'; return a; };
  const snd = n => { try { Sound.play(n); } catch (e) {} };
  const ago = ts => { if (!ts) return 'never'; const s = (Date.now() - new Date(ts).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return Math.floor(s / 86400) + ' days ago'; };

  // ------------------------------------------------------------ the button
  const btn = el('button', { id: 'acctBtn', title: 'Your account' });
  document.body.appendChild(btn);
  btn.onmouseenter = () => snd('hover');
  btn.onclick = e => { e.stopPropagation(); snd('click'); open(A.user ? 'profile' : 'login'); };
  let pending = 0;
  function drawBtn() {
    btn.innerHTML = '';
    if (!A.ready) { btn.append('…'); return; }
    if (!A.user) { btn.append(el('span', {}, '👤'), el('span', {}, 'SIGN IN')); return; }
    btn.append(avatar(A.user), el('span', { class: 'nm' }, A.user.username), el('span', { class: 'dot' + (A.syncing ? ' busy' : A.error ? ' err' : ''), title: A.syncing ? 'Syncing saves...' : A.error || 'Saves synced' }));
    if (pending) btn.append(el('span', { class: 'badge', title: 'Friend requests' }, pending));
  }

  // ------------------------------------------------------------ the panel
  const root = el('div', { id: 'acct' }); document.body.appendChild(root);
  root.onclick = e => { if (e.target === root) close(); };
  let view = 'login', boardSel = A.BOARDS[0].id, loginMode = 'in', friendNote = '';
  function open(v) { view = v; root.classList.add('open'); render(); }
  function close() { root.classList.remove('open'); snd('back'); }
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('open')) { e.stopImmediatePropagation(); close(); } }, true);

  function render() {
    root.innerHTML = '';
    const tabs = A.user ? [['profile', 'PROFILE'], ['friends', 'FRIENDS'], ['boards', 'LEADERBOARDS']] : [['login', 'SIGN IN'], ['boards', 'LEADERBOARDS']];
    const tb = el('div', { class: 'tabs' }, tabs.map(([v, n]) => el('button', { class: view === v ? 'on' : '', onclick: () => { snd('tab'); open(v); } }, n, v === 'friends' && pending ? el('span', { class: 'badge' }, pending) : null)), el('button', { class: 'x', title: 'Close', onclick: close }, '✕'));
    const body = el('div', { class: 'body' });
    root.append(el('div', { class: 'box' }, tb, body));
    if (!A.configured) {
      body.append(el('h3', {}, 'ACCOUNTS COMING SOON'), el('p', {}, "Accounts aren't switched on for this arcade yet. Your saves are still kept on this device."));
      return;
    }
    if (!A.ready) { body.append(el('p', {}, 'Connecting...')); return; }
    ({ login: vLogin, profile: vProfile, friends: vFriends, boards: vBoards })[view](body);
  }

  function vLogin(body) {
    const sub = el('div', { class: 'sub' }, el('button', { class: loginMode === 'in' ? 'on' : '', onclick: () => { loginMode = 'in'; render(); } }, 'SIGN IN'), el('button', { class: loginMode === 'up' ? 'on' : '', onclick: () => { loginMode = 'up'; render(); } }, 'CREATE ACCOUNT'));
    const u = el('input', { maxlength: 16, autocomplete: 'username', placeholder: 'username', spellcheck: 'false' });
    const p = el('input', { type: 'password', autocomplete: loginMode === 'up' ? 'new-password' : 'current-password', placeholder: loginMode === 'up' ? 'at least 6 characters' : 'password' });
    let color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const msg = el('div', { class: 'msg' });
    const go = el('button', { class: 'btn' }, loginMode === 'up' ? 'CREATE ACCOUNT' : 'SIGN IN');
    const submit = async () => {
      go.disabled = true; msg.className = 'msg'; msg.textContent = loginMode === 'up' ? 'Creating your account...' : 'Signing in...';
      try { if (loginMode === 'up') await A.signUp(u.value, p.value, color); else await A.signIn(u.value, p.value); snd('coin'); open('profile'); }
      catch (e) { msg.textContent = e.message || String(e); go.disabled = false; snd('back'); }
    };
    go.onclick = submit; [u, p].forEach(i => i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') submit(); });
    body.append(sub,
      el('p', {}, loginMode === 'up' ? 'An account keeps your saves in the cloud so they follow you to any computer, puts you on the leaderboards, and lets you add friends.' : 'Welcome back! Your saves will sync to this device.'),
      el('label', {}, 'USERNAME'), u, el('label', {}, 'PASSWORD'), p);
    if (loginMode === 'up') {
      const sw = el('div', { class: 'swatches' });
      const drawSw = () => { sw.innerHTML = ''; COLORS.forEach(c => sw.append(el('div', { class: 'sw' + (c === color ? ' on' : ''), style: `background:${c}`, onclick: () => { color = c; drawSw(); } }))); };
      drawSw(); body.append(el('label', {}, 'COLOUR'), sw);
    }
    body.append(el('div', { style: 'margin-top:22px' }, go), msg);
    setTimeout(() => u.focus(), 30);
  }

  function vProfile(body) {
    const me = A.user;
    const sw = el('div', { class: 'swatches' });
    COLORS.forEach(c => sw.append(el('div', { class: 'sw' + (c === me.color ? ' on' : ''), style: `background:${c}`, onclick: async () => { snd('tab'); try { await A.setColor(c); render(); } catch (e) { alertMsg(e.message); } } })));
    const syncMsg = el('div', { class: 'msg' + (A.error ? '' : ' ok') }, A.error || (A.syncing ? 'Syncing...' : A.lastSync ? 'Saves synced ' + ago(A.lastSync) : ''));
    const alertMsg = t => { syncMsg.className = 'msg'; syncMsg.textContent = t; };
    const stats = el('div', { class: 'stat' }, el('span', {}, 'Loading your records...'));
    A.myScores().then(rows => {
      stats.innerHTML = '';
      if (!rows.length) { stats.append(el('span', {}, 'Play some games to set records!'), el('span')); return; }
      A.BOARDS.forEach(b => { const r = rows.find(x => x.board === b.id); if (r) stats.append(el('span', {}, `${b.game}: ${b.name}`), el('span', {}, A.fmtScore(b.id, r.score))); });
    }).catch(() => { stats.innerHTML = ''; });
    body.append(
      el('div', { class: 'row', style: 'gap:18px;margin-bottom:18px' }, avatar(me, true), el('div', {}, el('h3', { style: 'margin:0 0 6px;font-size:16px' }, me.username), el('p', { style: 'margin:0' }, 'Signed in. Your name is used in online games.'))),
      el('label', {}, 'COLOUR'), sw,
      el('label', {}, 'YOUR RECORDS'), stats,
      el('label', {}, 'CLOUD SAVES'),
      el('p', {}, 'Game progress saves to your account automatically and loads on any computer you sign in on.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn alt sm', onclick: async () => { snd('click'); syncMsg.className = 'msg ok'; syncMsg.textContent = 'Syncing...'; const ch = await A.sync(); render(); if (ch.length) syncMsg.textContent += ` (${ch.length} save${ch.length > 1 ? 's' : ''} updated)`; } }, 'SYNC NOW'),
        el('button', { class: 'btn red sm', onclick: async () => { snd('back'); await A.signOut(); loginMode = 'in'; open('login'); } }, 'SIGN OUT')),
      syncMsg);
  }

  async function vFriends(body) {
    const inp = el('input', { maxlength: 16, placeholder: 'friend\'s username', spellcheck: 'false' });
    const msg = el('div', { class: 'msg ok' }, friendNote); friendNote = '';
    const add = el('button', { class: 'btn' }, 'ADD');
    const doAdd = async () => { if (!inp.value.trim()) return; add.disabled = true; try { const t = await A.addFriend(inp.value); snd('coin'); refresh(t, true); } catch (e) { msg.className = 'msg'; msg.textContent = e.message || String(e); add.disabled = false; } };
    add.onclick = doAdd; inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') doAdd(); };
    const list = el('div', { class: 'list' }, el('div', { class: 'empty' }, 'Loading...'));
    body.append(el('h3', {}, 'ADD A FRIEND'), el('div', { class: 'row' }, inp, add), msg, el('label', { style: 'margin-top:18px' }, 'FRIENDS'), list);
    const refresh = note => { friendNote = note || ''; if (view === 'friends') render(); };
    let F; try { F = await A.friends(); } catch (e) { list.innerHTML = ''; list.append(el('div', { class: 'empty' }, 'Could not load friends: ' + (e.message || e))); return; }
    pending = F.incoming.length; drawBtn();
    list.innerHTML = '';
    const row = (p, extra, ...btns) => { const online = A.isOnline(p); return el('div', { class: 'item' }, avatar(p), el('span', { class: 'nm' }, p.username), el('span', { class: 'st' + (online ? ' on' : '') }, extra != null ? extra : online ? (p.playing ? '● ' + p.playing : '● Online') : 'seen ' + ago(p.last_seen)), ...btns); };
    F.incoming.forEach(p => list.append(row(p, 'wants to be friends',
      el('button', { class: 'btn sm', onclick: async () => { snd('coin'); await A.acceptFriend(p.id); refresh(); } }, 'ACCEPT'),
      el('button', { class: 'btn alt sm', onclick: async () => { snd('back'); await A.removeFriend(p.id); refresh(); } }, 'NO'))));
    F.friends.forEach(p => list.append(row(p, null, el('button', { class: 'btn alt sm', title: 'Remove friend', onclick: async () => { if (!confirm(`Remove ${p.username} from your friends?`)) return; await A.removeFriend(p.id); refresh(); } }, '✕'))));
    F.outgoing.forEach(p => list.append(row(p, 'request sent', el('button', { class: 'btn alt sm', title: 'Cancel request', onclick: async () => { await A.removeFriend(p.id); refresh(); } }, '✕'))));
    if (!list.children.length) list.append(el('div', { class: 'empty' }, 'No friends yet. Add someone by their username!'));
  }

  async function vBoards(body) {
    const sel = el('select');
    const games = [...new Set(A.BOARDS.map(b => b.game))];
    games.forEach(g => { const og = el('optgroup', { label: g }); A.BOARDS.filter(b => b.game === g).forEach(b => og.append(el('option', { value: b.id }, b.name))); sel.append(og); });
    sel.value = boardSel; sel.onchange = () => { boardSel = sel.value; snd('tab'); render(); };
    const list = el('div', { class: 'list' }, el('div', { class: 'empty' }, 'Loading...'));
    body.append(el('h3', {}, 'LEADERBOARDS'), sel, el('div', { style: 'height:16px' }), list);
    let rows; try { rows = await A.leaderboard(boardSel); } catch (e) { list.innerHTML = ''; list.append(el('div', { class: 'empty' }, 'Could not load: ' + (e.message || e))); return; }
    list.innerHTML = '';
    if (!rows.length) { list.append(el('div', { class: 'empty' }, 'No scores yet. Be the first!')); return; }
    rows.forEach((r, i) => {
      const p = r.profiles || { username: '?' };
      list.append(el('div', { class: 'item' + (A.user && r.user_id === A.user.id ? ' me' : '') }, el('span', { class: 'rank r' + (i + 1) }, '#' + (i + 1)), avatar(p), el('span', { class: 'nm' }, p.username), el('span', { class: 'score' }, A.fmtScore(boardSel, r.score))));
    });
    if (!A.user) list.append(el('p', { style: 'margin-top:14px;text-align:center' }, 'Sign in to get on the board.'));
  }

  // ------------------------------------------------------------ "this device has saves too" question
  const ask = el('div', { id: 'acctAsk' }); document.body.appendChild(ask);
  A.onConflict = keys => new Promise(res => {
    ask.innerHTML = '';
    const pick = v => { ask.classList.remove('open'); snd('click'); res(v); };
    ask.append(el('div', { class: 'box' },
      el('h2', {}, 'WHICH SAVES?'),
      el('p', {}, `This computer has game saves that are different from the ones in your account (${keys.length} game${keys.length > 1 ? 's' : ''}). Which should we keep?`),
      el('button', { class: 'btn', onclick: () => pick('cloud') }, 'MY ACCOUNT'),
      el('button', { class: 'btn alt', onclick: () => pick('local') }, 'THIS COMPUTER')));
    ask.classList.add('open');
  });

  // friend requests badge
  async function checkRequests() { if (!A.user) { pending = 0; return drawBtn(); } try { const F = await A.friends(); pending = F.incoming.length; drawBtn(); } catch (e) {} }
  setInterval(checkRequests, 90000);

  A.on(() => { drawBtn(); if (root.classList.contains('open') && (view === 'profile' || view === 'login')) { if (A.user && view === 'login') view = 'profile'; if (!A.user && view !== 'boards') view = 'login'; if (!document.activeElement || document.activeElement.tagName !== 'INPUT') render(); } });
  let wasUser = null;
  A.on(() => { const id = A.user && A.user.id; if (id !== wasUser) { wasUser = id; checkRequests(); } });
  drawBtn();
  A.openPanel = open;
})();
