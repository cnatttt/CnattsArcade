// =====================================================================
//  Owner cheat menu - only appears for the site admin account.
//  Each game lists its cheats in window.__cheats.
//  Hide the button from the menu; bring it back by typing "cnatt"
//  anywhere in a game, or pressing Ctrl + Shift + Y.
// =====================================================================
'use strict';
(function () {
  const HIDE_KEY = 'acct_cheats_hidden';
  let A = null, built = false, open = false, btn, panel;

  // games written as plain scripts (Mush, Chess) get their cheats here
  const G = expr => (0, eval)(expr);   // reaches the page's global variables
  const page = location.pathname;
  if (/\/mush\//.test(page)) window.__cheats = [
    { name: '+1 million mushrooms', icon: '🍄', run() { G('count += 1e6; totalEarned += 1e6; runEarned += 1e6'); } },
    { name: '+1 billion mushrooms', icon: '🍄', run() { G('count += 1e9; totalEarned += 1e9; runEarned += 1e9'); } },
    { name: '+100 spores', icon: '✨', run() { G('spores += 100'); } },
    { name: 'Double click power', icon: '👆', run() { G('clickPower *= 2'); } },
    { name: 'Save now', icon: '💾', run() { G('saveGame()'); } },
  ];
  if (/\/chess\//.test(page)) window.__cheats = [
    { name: 'Take back a move', icon: '↩', need: () => G('game && game.online') ? 'Not in online games' : '', run() { G('game.undo()'); } },
  ];

  const hidden = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; } };
  const setHidden = v => { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch (e) {} if (btn) btn.style.display = v ? 'none' : ''; };

  function build() {
    if (built) return; built = true;
    const st = document.createElement('style');
    st.textContent = `
    #ownerCheatBtn { position: fixed; left: 12px; bottom: 12px; z-index: 2147483000; width: 46px; height: 46px; border-radius: 50%; border: 2px solid #5a2a00; cursor: pointer;
      background: radial-gradient(circle at 35% 30%, #fff2a0, #ffc21a 45%, #ff7a1a); box-shadow: 0 6px 20px #0008, 0 0 24px #ffb02088; font-size: 22px; line-height: 1;
      display: grid; place-items: center; opacity: .55; transition: opacity .2s, transform .2s; }
    #ownerCheatBtn:hover { opacity: 1; transform: scale(1.1) rotate(-8deg); }
    #ownerCheats { position: fixed; left: 12px; bottom: 68px; z-index: 2147483001; width: 300px; max-height: calc(100vh - 90px); overflow: auto; border-radius: 18px;
      background: linear-gradient(180deg, #221a4ef2, #120e2cf2); border: 2px solid #ffc21a; box-shadow: 0 20px 60px #000c, 0 0 40px #ffb02044; color: #f1eeff;
      font: 500 14px Rubik, system-ui, sans-serif; display: none; backdrop-filter: blur(8px); }
    #ownerCheats.open { display: block; animation: ocPop .2s cubic-bezier(.2,1.5,.4,1); }
    @keyframes ocPop { from { transform: scale(.85) translateY(10px); opacity: 0; } }
    #ownerCheats .hd { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #ffffff1a; font-weight: 800; letter-spacing: 1px; }
    #ownerCheats .hd span { flex: 1; background: linear-gradient(90deg, #fff2a0, #ff9a1a); -webkit-background-clip: text; background-clip: text; color: transparent; }
    #ownerCheats .hd button { border: 0; background: #ffffff14; color: #fff; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; }
    #ownerCheats .list { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    #ownerCheats .ch { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid #ffffff1a; background: #ffffff0d;
      color: #fff; font: 600 14px Rubik, system-ui, sans-serif; cursor: pointer; transition: background .15s, border-color .15s; }
    #ownerCheats .ch:hover { background: #ffc21a22; border-color: #ffc21a; }
    #ownerCheats .ch i { font-style: normal; width: 22px; text-align: center; }
    #ownerCheats .ch b { flex: 1; font-weight: 600; }
    #ownerCheats .ch .sw { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; background: #ffffff1a; color: #a49cd0; }
    #ownerCheats .ch .sw.on { background: #5affc8; color: #062a26; }
    #ownerCheats .msg { min-height: 18px; padding: 0 14px 6px; font-size: 13px; color: #5affc8; }
    #ownerCheats .msg.err { color: #ff8aa0; }
    #ownerCheats .ft { padding: 10px 14px 14px; border-top: 1px solid #ffffff1a; font-size: 12px; color: #a49cd0; line-height: 1.45; }
    #ownerCheats .ft button { margin-top: 8px; width: 100%; padding: 9px; border-radius: 10px; border: 1px solid #ffffff22; background: #ffffff10; color: #fff; font: 700 13px Rubik, system-ui, sans-serif; cursor: pointer; }
    #ownerCheats .ft button:hover { border-color: #ffc21a; }
    #ownerCheats .empty { padding: 14px; color: #a49cd0; }`;
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.id = 'ownerCheatBtn'; btn.title = 'Owner cheats'; btn.textContent = '👑';
    panel = document.createElement('div'); panel.id = 'ownerCheats';
    // keep clicks from reaching the game underneath
    [btn, panel].forEach(el => ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'wheel'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation())));
    btn.onclick = () => toggle();
    document.body.append(btn, panel);
    if (hidden()) btn.style.display = 'none';
  }

  function toggle(v) {
    open = v == null ? !open : v;
    panel.classList.toggle('open', open);
    if (open) render();
  }
  function render(note, err) {
    const list = window.__cheats || [];
    panel.innerHTML = `<div class="hd">👑 <span>OWNER CHEATS</span><button title="Close">✕</button></div>
      <div class="list">${list.length ? '' : '<div class="empty">No cheats for this game yet.</div>'}</div>
      <div class="msg${err ? ' err' : ''}">${note || ''}</div>
      <div class="ft">Scores from this session won't go on the leaderboards after you cheat.<br>Bring this back any time: type <b>cnatt</b> or press <b>Ctrl+Shift+Y</b>.
      <button class="hide">${hidden() ? 'Show the 👑 button' : 'Hide the 👑 button'}</button></div>`;
    panel.querySelector('.hd button').onclick = () => toggle(false);
    panel.querySelector('.hide').onclick = () => { setHidden(!hidden()); render(hidden() ? 'Button hidden. Type cnatt to open this again.' : 'Button is back.'); };
    const box = panel.querySelector('.list');
    list.forEach(c => {
      const b = document.createElement('button'); b.className = 'ch';
      const on = c.toggle ? !!c.toggle() : null;
      b.innerHTML = `<i>${c.icon || '✦'}</i><b></b>${on != null ? `<span class="sw${on ? ' on' : ''}">${on ? 'ON' : 'OFF'}</span>` : ''}`;
      b.querySelector('b').textContent = c.name;
      b.onclick = () => {
        let why = ''; try { why = c.need ? c.need() : ''; } catch (e) { why = ''; }
        if (why) { render(why, true); return; }
        try { c.run(); A.cheated = true; render(c.toggle ? `${c.name}: ${c.toggle() ? 'ON' : 'OFF'}` : `${c.name} ✓`); }
        catch (e) { console.error(e); render("That didn't work here: " + (e.message || e), true); }
      };
      box.appendChild(b);
    });
  }

  // secret ways to open it, even when the button is hidden
  let typed = '';
  window.addEventListener('keydown', e => {
    if (!A || !A.isOwnerMe || !A.isOwnerMe()) return;
    if (e.ctrlKey && e.shiftKey && (e.key === 'Y' || e.key === 'y')) { e.preventDefault(); build(); toggle(); return; }
    if (e.key && e.key.length === 1) { typed = (typed + e.key.toLowerCase()).slice(-5); if (typed === 'cnatt') { typed = ''; build(); toggle(true); } }
    if (e.key === 'Escape' && open) toggle(false);
  }, true);

  function check() {
    A = window.Account;
    if (!A || !A.isOwnerMe) return;
    if (A.isOwnerMe()) build();
    else if (built) { btn.style.display = 'none'; toggle(false); }
  }
  function start() {
    check();
    if (window.Account && Account.on) Account.on(() => { check(); if (built && A.isOwnerMe() && !hidden()) btn.style.display = ''; });
    let n = 0; const iv = setInterval(() => { check(); if (++n > 20) clearInterval(iv); }, 500);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
