// =====================================================================
//  Arcade accounts - the arcade page's account button and panels
//  (sign in / create account, profile, friends, leaderboards)
// =====================================================================
'use strict';
(function () {
  const A = window.Account;
  const COLORS = ['#b07cff', '#ff6a7a', '#ffcc33', '#6ae06a', '#6ad0ff', '#ff9a4a', '#ff7ad8', '#4ae0c0', '#e8e4f0', '#8a8aff'];
  const css = `
  #acctBtn { position: fixed; top: 14px; left: 14px; z-index: 20; display: flex; align-items: center; gap: 10px; font-family: var(--pixel); font-weight: 700; font-size: 14px;
    color: var(--text); background: var(--panel2); border: 3px solid var(--line); padding: 7px 12px 7px 8px; cursor: pointer; box-shadow: 0 3px 0 #000a; }
  #acctBtn:hover { border-color: var(--gold); }
  #acctBtn:active { transform: translateY(2px); box-shadow: none; }
  #acctBtn .dot { width: 8px; height: 8px; border-radius: 50%; background: #6ae06a; box-shadow: 0 0 8px #6ae06a; }
  #acctBtn .dot.busy { background: var(--gold); box-shadow: 0 0 8px var(--gold); animation: blink 0.8s steps(2) infinite; }
  #acctBtn .dot.err { background: #ff6a7a; box-shadow: 0 0 8px #ff6a7a; }
  #acctBtn .badge { background: #ff6a7a; color: #07061a; padding: 3px 5px; font-size: 8px; }
  .av { border-radius: 50%; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-family: var(--pixel); font-weight: 700; font-size: 15px;
    color: #07061a; border: 2px solid #07061a; box-shadow: inset 0 -3px 0 #0004; flex: none; }
  .av.big { width: 64px; height: 64px; font-size: 26px; border-width: 3px; box-shadow: inset 0 -6px 0 #0004, 0 4px 0 #000a; }
  #acct { position: fixed; inset: 0; z-index: 50; display: none; align-items: flex-start; justify-content: center; background: #09090bcc; backdrop-filter: blur(6px); padding: 60px 14px; overflow: auto; }
  #acct.open { display: flex; }
  #acct .box { width: 100%; max-width: 620px; background: var(--panel); border: 2px solid var(--line); border-radius: 22px; overflow: hidden; box-shadow: 0 30px 80px #000c; animation: pop .25s cubic-bezier(.2,1.5,.4,1); }
  #acct .tabs { display: flex; border-bottom: 4px solid var(--line); }
  #acct .tabs button { flex: 1; font-family: var(--pixel); font-weight: 700; font-size: 14px; padding: 14px 6px; background: var(--panel2); color: var(--muted); border: 0; border-right: 3px solid var(--line); cursor: pointer; position: relative; }
  #acct .tabs button.on { background: var(--panel); color: var(--text); box-shadow: inset 0 -2px 0 var(--text); }
  #acct .tabs button .badge { background: #ff6a7a; color: #07061a; padding: 2px 5px; font-size: 8px; margin-left: 6px; }
  #acct .tabs .x { flex: none; width: 52px; border-right: 0; color: var(--text); font-size: 14px; }
  #acct .body { padding: 26px 28px 30px; min-height: 260px; }
  #acct h3 { font-family: var(--pixel); font-weight: 800; font-size: 17px; color: var(--text); margin: 0 0 16px; letter-spacing: 1px; }
  #acct p { color: var(--muted); margin: 0 0 14px; line-height: 1.45; }
  #acct .row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
  #acct label { font-family: var(--pixel); font-weight: 700; font-size: 13px; color: var(--muted); display: block; margin: 14px 0 6px; }
  #acct input, #acct select { width: 100%; font-family: var(--body); font-size: 17px; padding: 11px 14px; border-radius: 12px; background: #07061a; color: var(--text); border: 3px solid var(--line); outline: none; }
  #acct input:focus, #acct select:focus { border-color: var(--line2); }
  #acct .btn { border-radius: 999px; font-family: var(--pixel); font-weight: 700; font-size: 14px; padding: 12px 16px; background: #fff; color: #09090b; border: 0; cursor: pointer; box-shadow: none; white-space: nowrap; }
  #acct .btn.alt { background: var(--panel2); color: var(--text); border: 3px solid var(--line); box-shadow: 0 3px 0 #000a; padding: 9px 12px; }
  #acct .btn.red { background: #ff6a7a; }
  #acct .btn.sm { font-size: 8px; padding: 8px 10px; }
  #acct .btn:active { transform: translateY(2px); box-shadow: none; }
  #acct .btn:disabled { opacity: .5; cursor: default; }
  #acct .msg { min-height: 24px; margin-top: 12px; color: #ff9ab0; }
  #acct .msg.ok { color: #8aff9a; }
  #acct .sub { display: flex; gap: 8px; margin-bottom: 18px; }
  #acct .sub button { border-radius: 999px; font-family: var(--pixel); font-weight: 700; font-size: 13px; padding: 9px 12px; background: transparent; color: var(--muted); border: 3px solid var(--line); cursor: pointer; }
  #acct .sub button.on { color: var(--bg); background: var(--text); border-color: var(--text); }
  #acct .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  #acct .sw { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #07061a; cursor: pointer; box-shadow: 0 3px 0 #000a; }
  #acct .sw.on { outline: 3px solid var(--text); outline-offset: 2px; }
  #acct .list { display: flex; flex-direction: column; gap: 8px; }
  #acct .item { display: flex; align-items: center; gap: 12px; background: var(--panel2); border: 2px solid var(--line); border-radius: 14px; padding: 8px 12px; }
  #acct .item .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #acct .item .st { color: var(--muted); font-size: 14px; }
  #acct .item .st.on { color: #8aff9a; }
  #acct .item.me { border-color: var(--gold); }
  #acct .rank { font-family: var(--pixel); font-weight: 700; font-size: 15px; width: 36px; text-align: right; color: var(--muted); }
  #acct .rank.r1 { color: #ffcc33; } #acct .rank.r2 { color: #d8dce8; } #acct .rank.r3 { color: #e8a060; }
  #acct .score { font-family: var(--pixel); font-weight: 700; font-size: 15px; color: var(--gold); }
  #acct .empty { color: var(--muted); text-align: center; padding: 30px 0; }
  #acct .stat { display: grid; grid-template-columns: 1fr auto; gap: 6px 14px; margin: 6px 0 18px; }
  #acct .stat span:nth-child(odd) { color: var(--muted); } #acct .stat span:nth-child(even) { text-align: right; }
  #acct code { font-size: 15px; color: var(--gold); }
  #acctAsk { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center; background: #07061add; }
  #acctAsk.open { display: flex; }
  #acctAsk .box { max-width: 520px; background: var(--panel); border: 2px solid var(--gold); border-radius: 22px; padding: 28px 30px; text-align: center; box-shadow: 0 8px 0 #000a; }
  #acctAsk h2 { font-family: var(--pixel); font-weight: 700; font-size: 18px; color: var(--gold); margin: 0 0 16px; line-height: 1.5; }
  #acctAsk p { color: var(--muted); margin: 0 0 18px; }
  #acctAsk .btn { border-radius: 999px; font-family: var(--pixel); font-weight: 700; font-size: 14px; padding: 12px 14px; margin: 6px; border: 0; cursor: pointer; background: var(--gold); color: #07061a; box-shadow: inset 0 -4px 0 #0005, 0 3px 0 #000a; }
  #acctAsk .btn.alt { background: var(--panel2); color: var(--text); }

  #acct .item.click { cursor: pointer; } #acct .item.click:hover { border-color: var(--line2); }
  #acct .item .nm small { color: var(--muted); font-size: 12px; font-weight: 500; }
  .av.huge { width: 96px; height: 96px; font-size: 40px; border: 4px solid var(--panel); box-shadow: 0 8px 24px #000a; }
  #acct .phead { position: relative; margin: -26px -28px 0; }
  #acct .pbanner { height: 170px; background-size: cover; background-position: center; }
  #acct .phead > .av.huge { position: absolute; left: 24px; bottom: -44px; }
  #acct .chip { display: inline-flex; align-items: center; gap: 6px; font: 700 12px var(--ui, sans-serif); color: #fff; background: #0009; border: 1px solid #fff3; border-radius: 999px; padding: 7px 11px; cursor: pointer; backdrop-filter: blur(6px); }
  #acct .chip:hover { background: #000c; } #acct .chip.on { background: #16a34a33; border-color: #4ade8088; cursor: default; }
  #acct .chip i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; } #acct .chip small { color: var(--muted); font-weight: 600; }
  #acct .pedit.bannerEdit { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 6px; }
  #acct .avEdit { position: absolute; left: 92px; bottom: -44px; padding: 6px 8px; }
  #acct .avDel { position: absolute; left: 24px; bottom: -44px; padding: 4px 7px; font-size: 10px; }
  #acct .pnames { margin: 52px 0 10px; }
  #acct .pnames .dn { font: 800 26px var(--head, sans-serif); color: var(--text); display: flex; align-items: center; gap: 10px; word-break: break-word; }
  #acct .pnames .un { color: var(--muted); font-size: 15px; margin-top: 2px; }
  #acct .own { font: 800 11px var(--ui, sans-serif); color: #1a1200; background: linear-gradient(90deg, #fde047, #f59e0b); padding: 3px 8px; border-radius: 6px; letter-spacing: .08em; }
  #acct .bio { color: var(--text); white-space: pre-wrap; word-break: break-word; background: var(--panel2); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
  #acct textarea { width: 100%; font-family: var(--body); font-size: 16px; padding: 11px 14px; border-radius: 12px; background: #07061a; color: var(--text); border: 3px solid var(--line); resize: vertical; box-sizing: border-box; }
  #acct .cnt { float: right; font-weight: 500; }
  #acct .back { position: absolute; top: 12px; left: 14px; z-index: 3; color: #fff; background: #0009; border: 1px solid #fff3; border-radius: 999px; font: 700 13px var(--ui, sans-serif); cursor: pointer; padding: 7px 12px; backdrop-filter: blur(6px); }
  #acct .body { position: relative; }
  #acct .st.on { color: #8aff9a; }
  #acct .badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
  #acct .bdg { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border-radius: 14px; background: linear-gradient(160deg, #ffffff12, #ffffff04); border: 1px solid #ffffff1f; text-align: center; }
  #acct .bdg .bi { font-size: 28px; line-height: 1; } #acct .bdg .bn { font: 700 12px var(--ui, sans-serif); color: var(--text); }
  #acct .bdg.locked { opacity: .35; filter: grayscale(1); }
  #acct .ranks { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
  #acct .rk { border-radius: 14px; padding: 10px 12px; background: linear-gradient(135deg, color-mix(in srgb, var(--rc) 25%, transparent), #ffffff05); border: 1px solid color-mix(in srgb, var(--rc) 55%, transparent); display: flex; flex-direction: column; }
  #acct .rk .rn { font: 800 16px var(--head, sans-serif); color: var(--rc); } #acct .rk .rg { color: var(--text); font-size: 13px; } #acct .rk .re { color: var(--muted); font-size: 12px; }
  #acct .eqs { display: flex; flex-wrap: wrap; gap: 6px; } #acct .eqs .chip { cursor: default; background: var(--panel2); }
  #inviteBox { position: fixed; right: 16px; bottom: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; font-family: Inter, system-ui, sans-serif; }
  #inviteBox .icard { display: flex; align-items: center; gap: 12px; background: rgba(14,16,26,.96); border: 1px solid #facc1588; border-radius: 16px; padding: 12px 12px 12px 14px; color: #fff; box-shadow: 0 16px 40px #000b; max-width: 360px; animation: pop .3s cubic-bezier(.2,1.4,.4,1); }
  #inviteBox .it { flex: 1; font-size: 14px; line-height: 1.35; } #inviteBox .it span { color: #cbd5e1; }
  #inviteBox .ij { background: #22c55e; color: #04130a; border: 0; border-radius: 10px; font: 800 13px Inter, sans-serif; padding: 9px 14px; cursor: pointer; }
  #inviteBox .ix { background: none; border: 0; color: #94a3b8; cursor: pointer; font-size: 14px; }
  @keyframes pop { from { transform: scale(.9); opacity: 0; } }
  @media (max-width: 600px) { #acct .body { padding: 18px 16px 22px; } #acct .phead { margin: -18px -16px 0; } #acctBtn .nm { display: none; } }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e[k] = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
    kids.flat().forEach(c => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  };
  const avatar = (p, big) => {
    const a = el('span', { class: 'av' + (big === 'huge' ? ' huge' : big ? ' big' : '') }, p.avatar_url ? '' : (A.nameOf(p) || '?')[0].toUpperCase());
    a.style.background = p.color || '#b07cff';
    if (p.avatar_url && !/["'()\s<>]/.test(p.avatar_url)) { a.style.backgroundImage = `url("${p.avatar_url}")`; a.style.backgroundSize = 'cover'; a.style.backgroundPosition = 'center'; }
    return a;
  };
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
    if (!A.user) { btn.append(el('span', { class: 'av', style: 'background:#ffffff22;color:#fff;border-color:transparent' }, '👤'), el('span', {}, 'Sign in')); return; }
    btn.append(avatar(A.user), el('span', { class: 'nm' }, A.name()), el('span', { class: 'dot' + (A.syncing ? ' busy' : A.error ? ' err' : ''), title: A.syncing ? 'Syncing saves...' : A.error || 'Saves synced' }));
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
    const tabs = A.user ? [['profile', 'PROFILE'], ['friends', 'FRIENDS'], ['boards', 'LEADERBOARDS']].concat(view === 'invite' ? [['invite', 'INVITE']] : []) : [['login', 'SIGN IN'], ['boards', 'LEADERBOARDS']];
    const tb = el('div', { class: 'tabs' }, tabs.map(([v, n]) => el('button', { class: view === v ? 'on' : '', onclick: () => { snd('tab'); open(v); } }, n, v === 'friends' && pending ? el('span', { class: 'badge' }, pending) : null)), el('button', { class: 'x', title: 'Close', onclick: close }, '✕'));
    const body = el('div', { class: 'body' });
    root.append(el('div', { class: 'box' }, tb, body));
    if (!A.configured) {
      body.append(el('h3', {}, 'ACCOUNTS COMING SOON'), el('p', {}, "Accounts aren't switched on for this arcade yet. Your saves are still kept on this device."));
      return;
    }
    if (!A.ready) { body.append(el('p', {}, 'Connecting...')); return; }
    ({ login: vLogin, profile: vProfile, friends: vFriends, boards: vBoards, user: vUser, invite: vInvite })[view](body);
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

  const joinBtn = p => { const m = A.isOnline(p) && p.room && /^([a-z0-9]+):([A-Za-z0-9]{4,6})$/.exec(p.room); return m ? el('button', { class: 'btn sm', title: 'Join their game', onclick: () => { snd('coin'); root.classList.remove('open'); if (A.joinFriend) A.joinFriend(m[1], m[2]); } }, 'JOIN') : null; };
  // ------------------------------------------------------------ own profile (edit)
  const RANKS = [[0, 'Bronze', '#cd7f32'], [900, 'Silver', '#cbd5e1'], [1100, 'Gold', '#facc15'], [1300, 'Platinum', '#5eead4'], [1500, 'Diamond', '#60a5fa'], [1700, 'Master', '#c084fc'], [1900, 'Champion', '#f87171']];
  const rankOf = e => { let k = 0; RANKS.forEach((r, i) => { if (e >= r[0]) k = i; }); return RANKS[k]; };
  const GN = { tag: '2 Player Tag', ski: 'Powder Peak', soccer: 'Rocket Soccer', kart: 'Turbo Karts' };
  const banner = (p, edit) => {
    const b = el('div', { class: 'pbanner' });
    if (p.banner_url && !/["'()\s<>]/.test(p.banner_url)) b.style.backgroundImage = `url("${p.banner_url}")`;
    else b.style.background = `radial-gradient(120% 140% at 15% 0%, ${p.color || '#b07cff'}cc, transparent 60%), linear-gradient(135deg, ${p.color || '#b07cff'}55, #0b0b12 75%)`;
    return b;
  };
  const pickFile = cb => { const f = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', style: 'display:none' }); f.onchange = () => { if (f.files[0]) cb(f.files[0]); f.remove(); }; document.body.append(f); f.click(); };
  function header(p, edit, msg) {
    const wrap = el('div', { class: 'phead' }, banner(p, edit));
    const av = avatar(p, 'huge'); wrap.append(av);
    if (edit) {
      const busy = t => { msg.className = 'msg ok'; msg.textContent = t; };
      const fail = e => { msg.className = 'msg'; msg.textContent = e.message || String(e); snd('back'); };
      const up = kind => pickFile(async f => { busy(kind === 'banner' ? 'Uploading banner...' : 'Uploading picture...'); try { await A.uploadImage(kind, f); snd('coin'); render(); } catch (e) { fail(e); } });
      wrap.append(
        el('div', { class: 'pedit bannerEdit' },
          el('button', { class: 'chip', onclick: () => up('banner') }, '🖼 Change banner'),
          p.banner_url ? el('button', { class: 'chip', title: 'Remove banner', onclick: async () => { try { await A.removeImage('banner'); render(); } catch (e) { fail(e); } } }, '✕') : null),
        el('button', { class: 'chip avEdit', title: 'Change profile picture', onclick: () => up('avatar') }, '📷'),
        p.avatar_url ? el('button', { class: 'chip avDel', title: 'Remove profile picture', onclick: async () => { try { await A.removeImage('avatar'); render(); } catch (e) { fail(e); } } }, '✕') : null);
    }
    return wrap;
  }
  function badgeGrid(ids, showLocked) {
    const g = el('div', { class: 'badges' });
    A.BADGES.forEach(b => {
      const got = ids.includes(b.id);
      if (!got && !showLocked) return;
      if (b.id === 'owner' && !got) return;
      g.append(el('div', { class: 'bdg' + (got ? '' : ' locked'), title: `${b.name}: ${b.desc}${got ? '' : ' (locked)'}` }, el('span', { class: 'bi' }, b.icon), el('span', { class: 'bn' }, b.name)));
    });
    if (!g.children.length) g.append(el('div', { class: 'empty', style: 'padding:10px 0' }, 'No badges yet.'));
    return g;
  }

  function vProfile(body) {
    const me = A.user;
    const syncMsg = el('div', { class: 'msg' + (A.error ? '' : ' ok') }, A.error || (A.syncing ? 'Syncing...' : A.lastSync ? 'Saves synced ' + ago(A.lastSync) : ''));
    const alertMsg = t => { syncMsg.className = 'msg'; syncMsg.textContent = t; };
    const pmsg = el('div', { class: 'msg' });
    const sw = el('div', { class: 'swatches' });
    COLORS.forEach(c => sw.append(el('div', { class: 'sw' + (c === me.color ? ' on' : ''), style: `background:${c}`, onclick: async () => { snd('tab'); try { await A.setColor(c); render(); } catch (e) { alertMsg(e.message); } } })));
    const stats = el('div', { class: 'stat' }, el('span', {}, 'Loading your records...'));
    let elo = 0;
    const bwrap = el('div', {}, badgeGrid(A.myBadges(0), true));
    A.myScores().then(rows => {
      stats.innerHTML = '';
      elo = Math.max(0, ...rows.filter(r => /_elo$/.test(r.board)).map(r => r.score));
      bwrap.innerHTML = ''; const mine = A.myBadges(elo); bwrap.append(el('p', { style: 'margin:0 0 10px' }, `${mine.length} of ${A.BADGES.filter(b => b.id !== 'owner' || mine.includes('owner')).length} unlocked`), badgeGrid(mine, true));
      if (!rows.length) { stats.append(el('span', {}, 'Play some games to set records!'), el('span')); return; }
      A.BOARDS.forEach(b => { const r = rows.find(x => x.board === b.id); if (r) stats.append(el('span', {}, `${b.game}: ${b.name}`), el('span', {}, A.fmtScore(b.id, r.score))); });
    }).catch(() => { stats.innerHTML = ''; });
    body.append(header(me, A.v2, pmsg));
    body.append(el('div', { class: 'pnames' }, el('div', { class: 'dn' }, A.nameOf(me), me.admin ? el('span', { class: 'own' }, 'OWNER') : null), el('div', { class: 'un' }, '@' + me.username)));
    body.append(pmsg);
    if (me.banned) body.append(el('p', { style: 'color:#ff9ab0;font-weight:700' }, 'This account is banned from the leaderboards and friends. Your saves still work.'));
    if (me.admin) body.append(el('a', { class: 'btn', href: 'admin.html', style: 'display:inline-block;text-decoration:none;margin-bottom:8px' }, '🛡 OPEN ADMIN PANEL'));
    if (A.v2) {
      const dn = el('input', { maxlength: 16, placeholder: me.username, value: me.display_name || '', spellcheck: 'false' });
      const bio = el('textarea', { maxlength: 160, rows: 3, placeholder: 'Say something about yourself (160 characters)' }); bio.value = me.bio || '';
      const cnt = el('span', { class: 'cnt' }, `${bio.value.length}/160`); bio.oninput = () => cnt.textContent = `${bio.value.length}/160`;
      [dn, bio].forEach(i => i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && i === dn) save.click(); });
      const save = el('button', { class: 'btn' }, 'SAVE');
      save.onclick = async () => { save.disabled = true; pmsg.className = 'msg ok'; pmsg.textContent = 'Saving...'; try { await A.updateProfile({ display_name: dn.value, bio: bio.value }); snd('coin'); pmsg.textContent = 'Saved! Your new name shows in every game.'; } catch (e) { pmsg.className = 'msg'; pmsg.textContent = e.message || String(e); snd('back'); } save.disabled = false; };
      body.append(el('label', {}, 'DISPLAY NAME'), el('p', { style: 'margin:-2px 0 8px;font-size:14px' }, 'What everyone sees. Change it whenever you like. You still sign in with @' + me.username + '.'), dn,
        el('label', {}, 'ABOUT ME ', cnt), bio, el('div', { class: 'row', style: 'margin-top:12px' }, save,
          el('button', { class: 'btn alt sm', onclick: () => { snd('click'); viewUser = me.id; open('user'); } }, 'VIEW PUBLIC PROFILE'),
          el('button', { class: 'btn alt sm', onclick: e => { const u = location.origin + location.pathname + '#@' + me.username; navigator.clipboard && navigator.clipboard.writeText(u); e.target.textContent = 'LINK COPIED'; snd('coin'); } }, 'COPY LINK')));
    } else body.append(el('p', { style: 'color:#ffd27a' }, 'Display names, profile pictures and banners switch on once the site owner runs the latest setup.sql in Supabase.'));
    body.append(...[
      el('label', {}, 'BADGES'), bwrap,
      window.Arcade ? (() => { const d = Arcade.daily(); return el('div', { class: 'stat', style: 'margin:14px 0' }, el('span', {}, '🔥 Daily streak'), el('span', {}, `${d.streak} day${d.streak === 1 ? '' : 's'} (best ${Math.max(d.best, d.streak)})`), el('span', {}, '🪙 Coins'), el('span', {}, Arcade.coins().toLocaleString())); })() : null,
      el('label', {}, 'COLOUR'), el('p', { style: 'margin:-2px 0 8px;font-size:14px' }, 'Used for your name in games, and as your picture if you have not uploaded one.'), sw,
      el('label', {}, 'YOUR RECORDS'), stats,
      el('label', {}, 'CLOUD SAVES'),
      el('p', {}, 'Game progress saves to your account automatically and loads on any computer you sign in on.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn alt sm', onclick: async () => { snd('click'); syncMsg.className = 'msg ok'; syncMsg.textContent = 'Syncing...'; const ch = await A.sync(); render(); if (ch.length) syncMsg.textContent += ` (${ch.length} save${ch.length > 1 ? 's' : ''} updated)`; } }, 'SYNC NOW'),
        el('button', { class: 'btn red sm', onclick: async () => { snd('back'); await A.signOut(); loginMode = 'in'; open('login'); } }, 'SIGN OUT')),
      syncMsg].filter(Boolean));
  }

  // ------------------------------------------------------------ anyone's public profile
  let viewUser = null, backView = 'friends';
  function openUser(who) { backView = view === 'user' ? backView : view; viewUser = who; snd('click'); open('user'); }
  A.openProfile = who => { backView = 'boards'; viewUser = who; root.classList.add('open'); view = 'user'; render(); };
  async function vUser(body) {
    body.append(el('div', { class: 'empty' }, 'Loading profile...'));
    let p; try { p = await A.getProfile(viewUser); } catch (e) { body.innerHTML = ''; body.append(el('div', { class: 'empty' }, e.message || String(e)), el('button', { class: 'btn alt sm', onclick: () => open(A.user ? backView : 'boards') }, '‹ BACK')); return; }
    if (view !== 'user') return;
    body.innerHTML = '';
    const isMe = A.user && A.user.id === p.id, online = A.isOnline(p), msg = el('div', { class: 'msg ok' });
    body.append(el('button', { class: 'back', onclick: () => { snd('back'); open(A.user ? (isMe ? 'profile' : backView) : 'boards'); } }, '‹ Back'));
    body.append(header(p, false));
    body.append(el('div', { class: 'pnames' },
      el('div', { class: 'dn' }, A.nameOf(p), p.admin ? el('span', { class: 'own' }, 'OWNER') : null),
      el('div', { class: 'un' }, '@' + p.username, el('span', { class: 'st' + (online ? ' on' : ''), style: 'margin-left:10px' }, online ? (p.playing ? '● playing ' + p.playing : '● online') : 'last seen ' + ago(p.last_seen)))));
    if (p.bio) body.append(el('p', { class: 'bio' }, p.bio));
    // actions
    const acts = el('div', { class: 'row', style: 'flex-wrap:wrap' });
    if (isMe) acts.append(el('button', { class: 'btn sm', onclick: () => open('profile') }, 'EDIT PROFILE'));
    else if (A.user) {
      const act = async (fn, note) => { try { await fn(); checkRequests(); snd('coin'); msg.className = 'msg ok'; msg.textContent = note || ''; render(); } catch (e) { msg.className = 'msg'; msg.textContent = e.message || String(e); } };
      if (p.friend === 'none') acts.append(el('button', { class: 'btn sm', onclick: () => act(() => A.addFriend(p.username)) }, '+ ADD FRIEND'));
      if (p.friend === 'sent') acts.append(el('button', { class: 'btn alt sm', onclick: () => act(() => A.removeFriend(p.id)) }, 'REQUEST SENT ✕'));
      if (p.friend === 'incoming') acts.append(el('button', { class: 'btn sm', onclick: () => act(() => A.acceptFriend(p.id)) }, 'ACCEPT FRIEND'));
      if (p.friend === 'friends') {
        acts.append(el('span', { class: 'chip on' }, '✓ Friends'));
        const jb = joinBtn(p); if (jb) acts.append(jb);
        const ib = inviteBtn(p); if (ib) acts.append(ib);
        acts.append(el('button', { class: 'btn alt sm', onclick: () => { if (confirm(`Remove ${A.nameOf(p)} from your friends?`)) act(() => A.removeFriend(p.id)); } }, 'REMOVE'));
      }
      if (A.user.admin && !p.admin) acts.append(el('button', { class: 'btn red sm', title: 'Clear their display name, pictures and bio', onclick: () => { if (confirm(`Reset ${p.username}'s name, pictures and bio?`)) act(() => A.adminClearProfile(p.id), 'Profile reset.'); } }, '🛡 RESET PROFILE'));
    }
    acts.append(el('button', { class: 'btn alt sm', onclick: e => { const u = location.origin + location.pathname + '#@' + p.username; navigator.clipboard && navigator.clipboard.writeText(u); e.target.textContent = 'LINK COPIED'; } }, '🔗 LINK'));
    body.append(acts, msg);
    // ranks
    const ranks = p.scores.filter(s => /_elo$/.test(s.board));
    if (ranks.length) {
      const g = el('div', { class: 'ranks' });
      ranks.sort((a, b) => b.score - a.score).forEach(s => { const r = rankOf(s.score), gid = s.board.replace(/_elo$/, ''); g.append(el('div', { class: 'rk', style: `--rc:${r[2]}` }, el('span', { class: 'rn' }, r[1]), el('span', { class: 'rg' }, GN[gid] || gid), el('span', { class: 're' }, Math.round(s.score) + ' Elo'))); });
      body.append(el('label', {}, 'RANKED'), g);
    }
    const sc = p.showcase || {};
    body.append(el('label', {}, 'BADGES'), badgeGrid(sc.badges || [], false));
    if (sc.eq && sc.eq.length) {
      const g = el('div', { class: 'eqs' });
      sc.eq.forEach(it => g.append(el('span', { class: 'chip' }, el('i', { style: `background:${it.c}` }), `${it.n}`, el('small', {}, (window.Arcade && Arcade.GAME_NAMES[it.g]) || it.g))));
      body.append(el('label', {}, 'EQUIPPED'), g);
    }
    const recs = p.scores.filter(s => !/_elo$/.test(s.board)).map(s => [A.BOARDS.find(b => b.id === s.board), s]).filter(x => x[0]);
    if (recs.length) {
      const st = el('div', { class: 'stat' });
      recs.slice(0, 10).forEach(([b, s]) => st.append(el('span', {}, `${b.game}: ${b.name}`), el('span', {}, A.fmtScore(b.id, s.score))));
      body.append(el('label', {}, 'RECORDS'), st);
    }
    if (p.created_at) body.append(el('p', { style: 'margin-top:16px;font-size:13px' }, 'Playing since ' + new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })));
  }

  // ------------------------------------------------------------ invites
  const target = () => { try { return A.inviteTarget ? A.inviteTarget() : null; } catch (e) { return null; } };
  const sentTo = {};
  function inviteBtn(p) {
    const tg = target(); if (!tg || !A.isOnline(p)) return null;
    const k = p.id + tg.code, b = el('button', { class: 'btn sm', title: 'Invite them to your game' }, sentTo[k] ? 'INVITED ✓' : 'INVITE');
    b.onclick = async e => { e.stopPropagation(); b.disabled = true; try { await A.invite(p.id, tg.game, tg.code, tg.kind); sentTo[k] = 1; b.textContent = 'INVITED ✓'; snd('coin'); } catch (er) { b.textContent = 'FAILED'; b.title = er.message; b.disabled = false; } };
    return b;
  }
  A.openInvite = () => { open('invite'); };
  async function vInvite(body) {
    const tg = target(), gname = tg && ((window.Arcade && Arcade.GAME_NAMES[tg.game]) || tg.game);
    body.append(el('h3', {}, 'INVITE FRIENDS'));
    if (!tg) { body.append(el('p', {}, 'Open an online room (or create a friend tournament) in a game first, then come back here to invite friends straight into it.')); return; }
    body.append(el('p', {}, tg.kind === 'tourney' ? `Invite friends to your ${gname} tournament (code ${tg.code}).` : `Invite friends to your ${gname} room (code ${tg.code}).`));
    const list = el('div', { class: 'list' }, el('div', { class: 'empty' }, 'Loading...')); body.append(list);
    let F; try { F = await A.friends(); } catch (e) { list.innerHTML = ''; list.append(el('div', { class: 'empty' }, e.message)); return; }
    list.innerHTML = '';
    F.friends.forEach(p => list.append(el('div', { class: 'item' }, avatar(p), el('span', { class: 'nm' }, A.nameOf(p)), el('span', { class: 'st' + (A.isOnline(p) ? ' on' : '') }, A.isOnline(p) ? (p.playing ? 'playing ' + p.playing : 'online') : 'offline'), inviteBtn(p))));
    if (!F.friends.length) list.append(el('div', { class: 'empty' }, 'No friends yet. Add some in the FRIENDS tab!'));
  }
  // incoming invites pop up over whatever page or game is open
  const inbox = el('div', { id: 'inviteBox' }); document.body.appendChild(inbox);
  const seen = new Set();
  async function pollInvites() {
    if (!A.user || document.hidden) return;
    const list = await A.myInvites().catch(() => []);
    list.forEach(iv => {
      const key = iv.sender + iv.created_at; if (seen.has(key)) return; seen.add(key);
      const p = iv.p || { username: 'A friend' }, gname = (window.Arcade && Arcade.GAME_NAMES[iv.game]) || iv.game;
      const card = el('div', { class: 'icard' }, avatar(p),
        el('div', { class: 'it' }, el('b', {}, A.nameOf(p)), el('span', {}, iv.kind === 'tourney' ? ` invited you to a ${gname} tournament` : ` invited you to play ${gname}`)),
        el('button', { class: 'ij', onclick: () => { A.dismissInvite(iv.sender); card.remove(); snd('coin'); root.classList.remove('open'); if (iv.kind === 'tourney' && A.joinTourney) A.joinTourney(iv.game, iv.code); else if (A.joinFriend) A.joinFriend(iv.game, iv.code); } }, 'JOIN'),
        el('button', { class: 'ix', title: 'Dismiss', onclick: () => { A.dismissInvite(iv.sender); card.remove(); } }, '✕'));
      inbox.append(card); snd('coin');
      setTimeout(() => card.remove(), 90000);
    });
  }
  setInterval(pollInvites, 8000);

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
    const row = (p, extra, ...btns) => { const online = A.isOnline(p); return el('div', { class: 'item click', title: 'View profile', onclick: e => { if (e.target.closest('button')) return; openUser(p.id); } }, avatar(p), el('span', { class: 'nm' }, A.nameOf(p), p.display_name ? el('small', {}, ' @' + p.username) : null), el('span', { class: 'st' + (online ? ' on' : '') }, extra != null ? extra : online ? (p.playing ? '● ' + p.playing + (p.room ? ' (online room)' : '') : '● Online') : 'seen ' + ago(p.last_seen)), ...btns.filter(Boolean)); };
    F.incoming.forEach(p => list.append(row(p, 'wants to be friends',
      el('button', { class: 'btn sm', onclick: async () => { snd('coin'); await A.acceptFriend(p.id); refresh(); } }, 'ACCEPT'),
      el('button', { class: 'btn alt sm', onclick: async () => { snd('back'); await A.removeFriend(p.id); refresh(); } }, 'NO'))));
    F.friends.forEach(p => list.append(row(p, null, joinBtn(p), inviteBtn(p), el('button', { class: 'btn alt sm', title: 'Remove friend', onclick: async () => { if (!confirm(`Remove ${A.nameOf(p)} from your friends?`)) return; await A.removeFriend(p.id); refresh(); } }, '✕'))));
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
      list.append(el('div', { class: 'item click' + (A.user && r.user_id === A.user.id ? ' me' : ''), title: 'View profile', onclick: () => openUser(r.user_id) }, el('span', { class: 'rank r' + (i + 1) }, '#' + (i + 1)), avatar(p), el('span', { class: 'nm' }, A.nameOf(p)), el('span', { class: 'score' }, A.fmtScore(boardSel, r.score))));
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

  A.on(() => { drawBtn(); if (!root.classList.contains('open')) return; if (A.user && view === 'login') { view = 'profile'; render(); } else if (!A.user && (view === 'profile' || view === 'friends' || view === 'invite')) { view = 'login'; render(); } });
  let wasUser = null;
  A.on(() => { const id = A.user && A.user.id; if (id !== wasUser) { wasUser = id; checkRequests(); } });
  drawBtn();
  A.openPanel = open;
  const hashUser = () => { const m = /^#@([A-Za-z0-9_]{3,16})$/.exec(location.hash); if (m) A.init().then(() => A.openProfile(m[1])); };
  window.addEventListener('hashchange', hashUser); hashUser();
})();
