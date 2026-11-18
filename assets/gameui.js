// =====================================================================
//  Shared clean UI kit for canvas games (menus, buttons, text, input).
//  Usage: const U = GameUI(canvas, { font: 'Inter' });
// =====================================================================
'use strict';
function GameUI(cv, opts = {}) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const FONT = opts.font || "'Inter', system-ui, sans-serif";
  const HEAD = opts.head || "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
  const U = { ctx, W, H, FONT, HEAD, mx: -1, my: -1, down: false, click: null, hover: null, lastHover: null, keys: {}, pressed: {}, typing: null };

  // ---------------------------------------------------------- input
  const toCanvas = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  cv.addEventListener('pointermove', e => { [U.mx, U.my] = toCanvas(e); });
  cv.addEventListener('pointerdown', e => { [U.mx, U.my] = toCanvas(e); U.down = true; U.px = U.mx; U.py = U.my; if (window.Sound) Sound.init(); });
  window.addEventListener('pointerup', e => { if (!U.down) return; U.down = false; const [x, y] = toCanvas(e); U.click = { x, y, px: U.px, py: U.py }; });
  window.addEventListener('keydown', e => {
    if (U.typing) {
      const T = U.typing;
      if (e.key === 'Backspace') T.value = T.value.slice(0, -1);
      else if (e.key === 'Enter') { const f = T.onEnter; U.typing = null; f && f(T.value); }
      else if (e.key === 'Escape') U.typing = null;
      else if (e.key.length === 1 && T.value.length < (T.max || 16) && (!T.allow || T.allow.test(e.key))) T.value += T.upper ? e.key.toUpperCase() : e.key;
      e.preventDefault(); return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!U.keys[e.code]) U.pressed[e.code] = true;
    U.keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { U.keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in U.keys) U.keys[k] = false; });
  U.endFrame = () => {
    if (U.hover && U.hover !== U.lastHover && window.Sound) Sound.play('hover');
    U.lastHover = U.hover; U.hover = null; U.click = null;
    for (const k in U.pressed) delete U.pressed[k];
  };

  // ---------------------------------------------------------- drawing
  U.rr = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  U.txt = (s, x, y, size, col = '#fff', align = 'left', o = {}) => {
    ctx.font = `${o.weight || 700} ${size}px ${o.head ? HEAD : FONT}`; ctx.textAlign = align; ctx.textBaseline = o.base || 'top';
    if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(s, x, y + Math.max(1, size * 0.06)); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  };
  U.shade = (h, f) => { const c = h.replace('#', ''); const v = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); return '#' + v.map(n => Math.max(0, Math.min(255, Math.round(f > 0 ? n + (255 - n) * f : n * (1 + f)))).toString(16).padStart(2, '0')).join(''); };
  U.rgba = (h, a) => { const c = h.replace('#', ''); return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a})`; };
  U.panel = (x, y, w, h, o = {}) => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    U.rr(x, y, w, h, o.r || 20); ctx.fillStyle = o.fill || 'rgba(14,15,22,0.86)'; ctx.fill(); ctx.restore();
    U.rr(x + 0.5, y + 0.5, w - 1, h - 1, o.r || 20); ctx.strokeStyle = o.stroke || 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
  };
  // returns true when clicked
  U.button = (id, x, y, w, h, label, o = {}) => {
    const over = !o.disabled && U.mx >= x && U.mx < x + w && U.my >= y && U.my < y + h;
    if (over) U.hover = id;
    const base = o.disabled ? '#2a2c38' : (o.color || '#ffffff');
    const light = !o.color || o.light;
    const lift = over && U.down ? 1 : over ? -2 : 0;
    ctx.save();
    if (!o.flat) { ctx.shadowColor = o.color ? U.rgba(base, over ? 0.5 : 0.25) : 'rgba(0,0,0,0.35)'; ctx.shadowBlur = over ? 24 : 12; ctx.shadowOffsetY = 6; }
    U.rr(x, y + lift, w, h, o.r || Math.min(14, h / 2));
    if (o.ghost) { ctx.fillStyle = over ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.restore(); U.rr(x + 0.5, y + lift + 0.5, w - 1, h - 1, o.r || Math.min(14, h / 2)); ctx.strokeStyle = o.selected ? '#fff' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = o.selected ? 2 : 1; ctx.stroke(); }
    else {
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, U.shade(base, over ? 0.12 : 0.04)); g.addColorStop(1, U.shade(base, over ? -0.02 : -0.1));
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
      if (o.selected) { U.rr(x - 3, y + lift - 3, w + 6, h + 6, (o.r || Math.min(14, h / 2)) + 3); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    if (o.icon) o.icon(x, y + lift, w, h);
    if (label) U.txt(label, x + w / 2, y + lift + h / 2, o.size || 18, o.ghost ? '#fff' : (light ? '#0c0d12' : '#ffffff'), 'center', { base: 'middle', shadow: false, weight: o.weight || 700 });
    const c = U.click;
    if (c && !o.disabled && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.px >= x && c.px < x + w && c.py >= y && c.py < y + h) { U.click = null; if (window.Sound) Sound.play(o.sfx || 'click'); return true; }
    return false;
  };
  // text box (click to type)
  U.input = (id, x, y, w, h, state, placeholder) => {
    const on = U.typing === state;
    U.rr(x, y, w, h, 12); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.strokeStyle = on ? '#ffffff' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    const v = state.value || '';
    U.txt(v || placeholder, x + 16, y + h / 2, 22, v ? '#fff' : 'rgba(255,255,255,0.35)', 'left', { base: 'middle', shadow: false, weight: 600 });
    if (on && Math.floor(performance.now() / 500) % 2) { ctx.font = `600 22px ${FONT}`; const tw = v ? ctx.measureText(v).width : 0; ctx.fillStyle = '#fff'; ctx.fillRect(x + 18 + tw, y + h / 2 - 12, 2, 24); }
    const c = U.click; if (c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h) { U.click = null; U.typing = state; }
  };
  return U;
}
