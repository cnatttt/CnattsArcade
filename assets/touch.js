// =====================================================================
//  Shared on-screen touch controls for phones and tablets.
//  A thumb stick on the left and round buttons on the right. They press
//  the game's normal keys (real KeyboardEvents), so every game keeps one
//  input path. Shown only on touch screens, and only while active() says
//  the player is in a match.
//
//  TouchPad.setup({
//    active: () => bool,                       // show the pad right now?
//    stick: { up, down, left, right } | 'analog',   // key codes (or functions returning one)
//    buttons: [{ label, code, hold, color }],   // bottom-right, first = biggest
//    pause: 'Escape',                           // small pause button, top-right
//  });
//  TouchPad.stick -> { on, x, y } (-1..1) for analog games.
// =====================================================================
'use strict';
window.TouchPad = (() => {
  let cfg = null, root = null, base = null, knob = null, turn = null, pauseEl = null;
  const btnEls = [], held = new Set();
  const stick = { on: false, x: 0, y: 0, id: null, ox: 0, oy: 0 };
  let isTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || /[?&]touch=1/.test(location.search);
  window.addEventListener('touchstart', () => { if (!isTouch) { isTouch = true; tick(); } }, { passive: true, capture: true });

  const val = c => typeof c === 'function' ? c() : c;
  const keyOf = code => code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;
  const fire = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: keyOf(code), bubbles: true, cancelable: true }));
  const press = code => { if (!code || held.has(code)) return; held.add(code); fire('keydown', code); };
  const release = code => { if (!code || !held.has(code)) return; held.delete(code); fire('keyup', code); };
  const releaseAll = () => { [...held].forEach(release); stick.on = false; stick.x = stick.y = 0; stick.id = null; };

  function el(tag, css, parent) { const e = document.createElement(tag); e.style.cssText = css; (parent || root).appendChild(e); return e; }
  const PAD = 'position:fixed;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;';

  function build() {
    root = el('div', PAD + 'inset:0;pointer-events:none;z-index:50;display:none;font-family:Inter,system-ui,sans-serif;', document.body);
    // stick zone: the lower-left part of the screen, the stick appears under the thumb
    const zone = el('div', PAD + 'left:0;bottom:0;width:42vw;height:62vh;pointer-events:auto;');
    base = el('div', PAD + 'left:0;top:0;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;background:rgba(10,14,24,0.22);border:2px solid rgba(255,255,255,0.4);box-shadow:0 8px 30px rgba(0,0,0,0.35);pointer-events:none;transition:opacity .15s;');
    knob = el('div', PAD + 'left:0;top:0;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(255,255,255,0.45);border:2px solid rgba(255,255,255,0.6);pointer-events:none;');
    const restPos = () => { const r = zone.getBoundingClientRect(); return [r.left + 110, r.bottom - 110]; };
    const place = (x, y, kx, ky) => { base.style.transform = `translate(${x}px,${y}px)`; knob.style.transform = `translate(${kx}px,${ky}px)`; };
    const rest = () => { const [x, y] = restPos(); place(x, y, x, y); base.style.opacity = knob.style.opacity = '0.55'; };
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); if (stick.id !== null) return;
      zone.setPointerCapture(e.pointerId); stick.id = e.pointerId; stick.on = true; stick.ox = e.clientX; stick.oy = e.clientY;
      base.style.opacity = knob.style.opacity = '1'; move(e);
    });
    const move = e => {
      if (e.pointerId !== stick.id) return;
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy), R = 56;
      if (d > R) { // drag the base along so the stick never "runs out"
        stick.ox += dx * (1 - R / d); stick.oy += dy * (1 - R / d); dx = e.clientX - stick.ox; dy = e.clientY - stick.oy;
      }
      stick.x = dx / R; stick.y = dy / R;
      place(stick.ox, stick.oy, stick.ox + dx, stick.oy + dy);
      applyStick();
    };
    zone.addEventListener('pointermove', move);
    const up = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.on = false; stick.x = stick.y = 0; applyStick(); rest(); };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    window.addEventListener('resize', rest); rest();
    // buttons
    const B = cfg.buttons || [];
    B.forEach((b, i) => {
      const big = i === 0, s = big ? 96 : 74;
      // first button bottom-right, others in an arc above / left of it
      const pos = [[24, 34], [136, 22], [30, 150], [146, 128], [244, 40]][i] || [24 + i * 90, 260];
      const e = el('div', PAD + `right:${pos[0]}px;bottom:${pos[1]}px;width:${s}px;height:${s}px;border-radius:50%;pointer-events:auto;display:flex;align-items:center;justify-content:center;` +
        `font-weight:800;font-size:${big ? 15 : 12}px;letter-spacing:.04em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);` +
        `background:${b.color || 'rgba(255,255,255,0.14)'};border:2px solid rgba(255,255,255,0.45);box-shadow:0 6px 20px rgba(0,0,0,.35);transition:transform .06s, filter .06s;`);
      e.textContent = b.label;
      const down = ev => { ev.preventDefault(); e.setPointerCapture(ev.pointerId); e.style.transform = 'scale(0.9)'; e.style.filter = 'brightness(1.4)'; press(val(b.code)); if (!b.hold) setTimeout(() => release(val(b.code)), 90); if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {} };
      const lift = ev => { e.style.transform = ''; e.style.filter = ''; if (b.hold) release(val(b.code)); };
      e.addEventListener('pointerdown', down); e.addEventListener('pointerup', lift); e.addEventListener('pointercancel', lift);
      e._b = b; btnEls.push(e);
    });
    if (cfg.pause) {
      pauseEl = el('div', PAD + 'right:16px;top:16px;width:46px;height:46px;border-radius:14px;pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:5px;background:rgba(0,0,0,0.35);border:2px solid rgba(255,255,255,0.35);');
      pauseEl.innerHTML = '<i style="width:5px;height:18px;background:#fff;border-radius:2px"></i><i style="width:5px;height:18px;background:#fff;border-radius:2px"></i>';
      pauseEl.addEventListener('pointerdown', e => { e.preventDefault(); const c = val(cfg.pause); press(c); setTimeout(() => release(c), 90); });
    }
    turn = el('div', PAD + 'inset:0;pointer-events:auto;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(6,8,14,0.92);color:#fff;font-family:Inter,system-ui,-apple-system,sans-serif;font-weight:800;font-size:20px;text-align:center;', document.body);
    turn.style.zIndex = 60;
    turn.innerHTML = '<div style="width:64px;height:100px;border:4px solid #fff;border-radius:12px;animation:tpRot 1.6s ease-in-out infinite"></div><div>Turn your phone sideways</div><div style="font-size:14px;font-weight:600;opacity:.7">This game plays in landscape</div>';
    const st = document.createElement('style'); st.textContent = '@keyframes tpRot{0%,20%{transform:rotate(0)}50%,70%{transform:rotate(-90deg)}100%{transform:rotate(0)}}'; document.head.appendChild(st);
    document.querySelectorAll('canvas').forEach(c => { c.style.touchAction = 'none'; });
  }
  function applyStick() {
    const S = cfg && cfg.stick; if (!S || S === 'analog') return;
    const T = 0.38, set = (code, on) => on ? press(code) : release(code);
    set(val(S.left), stick.x < -T); set(val(S.right), stick.x > T);
    set(val(S.up), stick.y < -T); set(val(S.down), stick.y > T);
  }

  let shown = false, raf = 0;
  function tick() {
    cancelAnimationFrame(raf);
    if (!cfg || !root) return;
    let on = false; try { on = isTouch && !!cfg.active(); } catch (e) {}
    if (on !== shown) { shown = on; root.style.display = on ? 'block' : 'none'; if (!on) releaseAll(); }
    if (on) btnEls.forEach(e => { const v = !e._b.show || e._b.show(); e.style.display = v ? 'flex' : 'none'; });
    const portrait = isTouch && innerHeight > innerWidth * 1.05 && !cfg.portraitOK;
    turn.style.display = portrait ? 'flex' : 'none';
    raf = requestAnimationFrame(tick);
  }
  function setup(c) {
    cfg = c;
    const go = () => { build(); tick(); };
    if (document.body) go(); else addEventListener('DOMContentLoaded', go);
  }
  return { setup, stick, get isTouch() { return isTouch; }, releaseAll };
})();
