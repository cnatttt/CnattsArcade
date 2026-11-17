// =====================================================================
//  NIGHTFALL HORDE - smooth vector art
//  Every character is drawn once with canvas paths (outlined "sticker"
//  style, soft shading, glowing eyes) into a high-resolution cache, with
//  4 walk frames, mirrored and white-flash versions. Sizes are in world
//  units so the game logic and hitboxes stay exactly the same.
// =====================================================================
'use strict';
const VRES = 2;          // cache pixels per world unit (bosses and menus ask for more)
const VPAD = 2;          // world units of padding (outline + arms)
const VOL = '#0e0a14';   // outline colour

const vhex = h => { if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number); h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const vmix = (a, b, u) => { const A = vhex(a), B = vhex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * u)).join(',')})`; };
const vlit = (c, f) => f > 0 ? vmix(c, '#ffffff', f) : vmix(c, '#000000', -f);
function vrand(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// ---------------------------------------------------------------- shape helpers (all in world units)
function vshape(g, path, fill, lw = 1.1) {
  g.beginPath(); path(g);
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (lw) { g.lineWidth = lw; g.strokeStyle = VOL; g.stroke(); }
  g.fillStyle = fill; g.fill();
}
const vcirc = (x, y, r) => g => g.arc(x, y, r, 0, Math.PI * 2);
const vell = (x, y, rx, ry, a = 0) => g => g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
function vrr(x, y, w, h, r) { return g => { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }; }
// a limb: thick rounded line drawn as outline + fill
function vlimb(g, x1, y1, x2, y2, w, col) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = VOL; g.lineWidth = w + 1.1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
function vlimb3(g, x1, y1, x2, y2, x3, y3, w, col) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = VOL; g.lineWidth = w + 1.1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.stroke();
}
function vgrad(g, x0, y0, x1, y1, c) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, vlit(c, 0.22)); gr.addColorStop(1, vlit(c, -0.18)); return gr; }
function vrad(g, x, y, r, c) { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, vlit(c, 0.3)); gr.addColorStop(1, vlit(c, -0.22)); return gr; }
function vglowEye(g, x, y, r, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, vmix(col, '#ffffff', 0.2)); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill();
}
function vstains(g, R, x, y, w, h, n, col = '#5a0a12') {
  g.save(); g.globalAlpha = 0.75; g.fillStyle = col;
  for (let k = 0; k < n; k++) { g.beginPath(); g.ellipse(x + R() * w, y + R() * h, 0.4 + R() * 0.9, 0.3 + R() * 0.6, R() * 3, 0, 7); g.fill(); }
  g.restore();
}

// ---------------------------------------------------------------- humanoid body
// o: { skin, shirt, pants, hr (head radius), bw (body width), bh, leg, hunch, arms: 'reach'|'hang'|'none'|'claw', eye, extras(g, ctx) }
function vhuman(g, w, h, f, o) {
  const cx = w / 2, ph = f * Math.PI / 2, sw = Math.sin(ph), R = vrand(o.seed || 7);
  const leg = o.leg, hipY = h - leg, bw = o.bw, bh = o.bh, shY = hipY - bh + 0.6, hr = o.hr;
  const hx = cx + (o.hunch || 0) + 0.3, hy = shY - hr * 0.72;
  const skinD = vlit(o.skin, -0.28), pantsD = vlit(o.pants, -0.3), shirtD = vlit(o.shirt, -0.3);
  const stride = o.stride == null ? 1.6 : o.stride;
  // back leg + back arm (darker)
  vlimb3(g, cx - 0.6, hipY, cx - 0.6 - sw * stride * 0.5, hipY + leg * 0.55, cx - 0.6 - sw * stride, h - 0.9, 2.5, pantsD);
  vshape(g, vell(cx - 0.6 - sw * stride + 0.6, h - 0.8, 1.5, 0.75), '#1a1418', 0.8);
  const armSw = Math.sin(ph + 1) * 0.6;
  if (o.arms === 'reach') vlimb(g, cx - 0.4, shY + 1.2, cx + 5.2, shY + 1.8 + armSw, 2.1, skinD);
  else if (o.arms === 'hang' || o.arms === 'big') vlimb3(g, cx - bw * 0.35, shY + 1, cx - bw * 0.45 - 0.4, shY + bh * 0.55, cx - bw * 0.35 + sw * 0.6, shY + bh + (o.arms === 'big' ? 1.5 : 0.2), o.arms === 'big' ? 3.4 : 2.1, skinD);
  // torso
  if (o.robe) {
    vshape(g, gg => { gg.moveTo(cx - bw / 2 + 0.6, shY); gg.lineTo(cx + bw / 2 - 0.6, shY); gg.lineTo(cx + bw / 2 + 1.6, h - 0.6); for (let k = 0; k <= 6; k++) gg.lineTo(cx + bw / 2 + 1.6 - k * (bw + 3.2) / 6, h - 0.6 - (k % 2) * 1.1); gg.closePath(); }, vgrad(g, cx - bw, shY, cx + bw, h, o.shirt));
  } else {
    // front leg (behind torso hem)
    vlimb3(g, cx + 0.6, hipY, cx + 0.6 + sw * stride * 0.5, hipY + leg * 0.55, cx + 0.6 + sw * stride, h - 0.9, 2.6, o.pants);
    vshape(g, vell(cx + 0.6 + sw * stride + 0.7, h - 0.8, 1.6, 0.8), '#241c20', 0.8);
    if (o.belly) vshape(g, vell(cx + 0.4, hipY - bh * 0.42, bw * 0.62, bh * 0.62), vrad(g, cx + 0.4, hipY - bh * 0.42, bw * 0.62, o.shirt));
    else {
      vshape(g, gg => { const t0 = shY, b = hipY + 0.9; gg.moveTo(cx - bw / 2 + 0.8, t0); gg.quadraticCurveTo(cx, t0 - 0.7, cx + bw / 2 - 0.8, t0); gg.quadraticCurveTo(cx + bw / 2 + 0.3, t0 + 0.4, cx + bw / 2, t0 + 1.6); gg.lineTo(cx + bw / 2 - 0.1, b); for (let k = 0; k <= 5; k++) gg.lineTo(cx + bw / 2 - k * bw / 5, b + (k % 2 ? -0.9 : 0.2)); gg.lineTo(cx - bw / 2, t0 + 1.6); gg.quadraticCurveTo(cx - bw / 2 - 0.3, t0 + 0.4, cx - bw / 2 + 0.8, t0); gg.closePath(); }, vgrad(g, cx - bw / 2, shY, cx + bw / 2, hipY, o.shirt));
      // shading + tears
      g.save(); g.globalAlpha = 0.35; g.fillStyle = shirtD; g.fillRect(cx - bw / 2 + 0.2, hipY - 1.2, bw - 0.4, 1.4); g.restore();
    }
  }
  if (o.stains) vstains(g, R, cx - bw / 2 + 0.5, shY + 0.8, bw - 1, bh - 1, o.stains);
  if (o.extrasBody) o.extrasBody(g, { cx, shY, hipY, bw, bh, hx, hy, hr, sw, h, w });
  // head
  vshape(g, vcirc(hx, hy, hr), vrad(g, hx, hy, hr, o.skin));
  if (o.face !== false) {
    const ex = hx + hr * 0.42, ey = hy - hr * 0.08;
    if (o.eye) { vglowEye(g, ex, ey, hr * 0.17, o.eye); vglowEye(g, ex - hr * 0.5, ey + 0.1, hr * 0.14, o.eye); }
    // jaw / mouth
    if (o.mouth !== false) { g.fillStyle = '#2a0a10'; g.beginPath(); g.ellipse(hx + hr * 0.45, hy + hr * 0.45, hr * 0.32, hr * 0.17, 0.2, 0, 7); g.fill(); g.fillStyle = '#e8e0c8'; g.fillRect(hx + hr * 0.25, hy + hr * 0.36, hr * 0.12, hr * 0.12); g.fillRect(hx + hr * 0.5, hy + hr * 0.38, hr * 0.12, hr * 0.12); }
    // stitched scar
    if (o.scar) { g.strokeStyle = vlit(o.skin, -0.45); g.lineWidth = 0.3; g.beginPath(); g.moveTo(hx - hr * 0.5, hy - hr * 0.6); g.lineTo(hx + hr * 0.1, hy - hr * 0.2); g.stroke(); for (let k = 0; k < 3; k++) { const u = k / 2.5; g.beginPath(); g.moveTo(hx - hr * 0.5 + u * hr * 0.6 - 0.25, hy - hr * 0.6 + u * hr * 0.4 + 0.35); g.lineTo(hx - hr * 0.5 + u * hr * 0.6 + 0.25, hy - hr * 0.6 + u * hr * 0.4 - 0.35); g.stroke(); } }
  }
  if (o.extrasHead) o.extrasHead(g, { cx, shY, hipY, bw, bh, hx, hy, hr, sw, h, w });
  // front arm
  if (o.arms === 'reach') { vlimb(g, cx + 0.6, shY + 1.4, cx + 5.8, shY + 2.4 - armSw, 2.3, o.skin); vshape(g, vcirc(cx + 6, shY + 2.4 - armSw, 1.05), o.skin, 0.9); }
  else if (o.arms === 'hang' || o.arms === 'big') { const big = o.arms === 'big'; vlimb3(g, cx + bw * 0.35, shY + 1, cx + bw * 0.5 + 0.5, shY + bh * 0.55, cx + bw * 0.42 - sw * 0.6, shY + bh + (big ? 1.5 : 0.2), big ? 3.8 : 2.3, o.skin); if (big) vshape(g, vcirc(cx + bw * 0.42 - sw * 0.6, shY + bh + 1.8, 2), o.skin, 1); }
  else if (o.arms === 'claw') { vlimb3(g, cx + 0.6, shY + 1.4, cx + 3.5, shY + 0.4, cx + 5.3, shY - 1.6 + armSw, 2, o.skin); g.strokeStyle = '#e8e0f0'; g.lineWidth = 0.35; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + 5.3, shY - 1.6 + armSw); g.lineTo(cx + 6.6, shY - 2.2 + armSw + k * 0.7); g.stroke(); } }
}

// ---------------------------------------------------------------- designs
const VDEF = {
  walker: { w: 12, h: 16, draw: (g, w, h, f, c) => vhuman(g, w, h, f, { seed: 11, skin: c.skin || '#8fb070', shirt: c.shirt || '#6a5a8a', pants: '#3a3a52', hr: 3.4, bw: 6.2, bh: 5.6, leg: 5, hunch: 1, arms: 'reach', eye: c.eye || '#ffe14a', stains: 4, scar: true,
    extrasHead: (g, k) => { g.fillStyle = vlit(c.skin || '#8fb070', -0.5); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(k.hx - k.hr * 0.9 + i * 1.3, k.hy - k.hr * 0.7); g.lineTo(k.hx - k.hr * 0.4 + i * 1.3, k.hy - k.hr * 1.25); g.lineTo(k.hx - k.hr * 0.1 + i * 1.3, k.hy - k.hr * 0.75); g.fill(); } } }) },
  riot: { w: 12, h: 16, draw: (g, w, h, f, c) => vhuman(g, w, h, f, { seed: 21, skin: '#8aa874', shirt: '#25345a', pants: '#1c2238', hr: 3.4, bw: 6.6, bh: 5.8, leg: 5, hunch: 0.7, arms: 'reach', eye: '#ff5a3a', mouth: false, stains: 2,
    extrasBody: (g, k) => { vshape(g, vrr(k.cx - k.bw / 2 + 0.6, k.shY + 1, k.bw - 1.2, k.bh - 1.6, 0.8), '#1a2440', 0.7); g.fillStyle = '#e8d04a'; g.font = 'bold 1.6px sans-serif'; g.textAlign = 'center'; g.fillText('POLICE', k.cx, k.shY + 3.4); },
    extrasHead: (g, k) => { vshape(g, gg => { gg.arc(k.hx, k.hy, k.hr + 0.6, Math.PI * 0.95, Math.PI * 2.15); gg.closePath(); }, vrad(g, k.hx, k.hy - 1, k.hr + 0.6, '#2a3a6a')); const vg = g.createLinearGradient(k.hx, k.hy - 1, k.hx + k.hr, k.hy + 1); vg.addColorStop(0, 'rgba(120,180,255,0.75)'); vg.addColorStop(1, 'rgba(20,30,70,0.85)'); vshape(g, vrr(k.hx - 0.6, k.hy - k.hr * 0.45, k.hr + 1.1, k.hr * 0.7, 0.6), vg, 0.6); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(k.hx, k.hy - k.hr * 0.35, k.hr * 0.6, 0.35); } }) },
  witch: { w: 12, h: 16, draw: (g, w, h, f, c) => vhuman(g, w, h, f, { seed: 31, skin: c.skin || '#a8b8a0', shirt: c.shirt || '#4a2a6a', pants: '#2a1a3a', hr: 3.1, bw: 6, bh: 6.6, leg: 4.2, hunch: 0.8, arms: 'claw', eye: c.eye || '#7aff5a', robe: true, stains: 0, mouth: false,
    extrasHead: (g, k) => {
      g.fillStyle = '#1a1020'; g.beginPath(); g.moveTo(k.hx - k.hr - 0.6, k.hy - 0.5); g.quadraticCurveTo(k.hx - k.hr - 1.6, k.hy + 4, k.hx - k.hr + 0.4, k.hy + 5); g.lineTo(k.hx - 0.5, k.hy); g.fill();
      vshape(g, vell(k.hx, k.hy - k.hr * 0.55, k.hr + 2.3, 0.9), vlit(c.shirt || '#4a2a6a', -0.35), 0.8);
      vshape(g, gg => { gg.moveTo(k.hx - k.hr * 0.9, k.hy - k.hr * 0.6); gg.quadraticCurveTo(k.hx - 0.4, k.hy - k.hr * 2.4, k.hx - 2.6, k.hy - k.hr * 3.1); gg.quadraticCurveTo(k.hx + 0.6, k.hy - k.hr * 2.2, k.hx + k.hr * 0.9, k.hy - k.hr * 0.6); gg.closePath(); }, vgrad(g, k.hx - 3, k.hy - 9, k.hx + 3, k.hy, vlit(c.shirt || '#4a2a6a', -0.2)));
      g.fillStyle = '#e8c04a'; g.fillRect(k.hx - k.hr * 0.8, k.hy - k.hr * 1.05, k.hr * 1.6, 0.6);
    } }) },
  brute: { w: 18, h: 17, draw: (g, w, h, f, c) => vhuman(g, w, h, f, { seed: 41, skin: c.skin || '#7a9a68', shirt: c.skin || '#7a9a68', pants: '#4a3a2a', hr: 3, bw: 10.5, bh: 7.4, leg: 4.6, hunch: 2.4, arms: 'big', eye: c.eye || '#ff4a3a', stains: 6, stride: 1.2,
    extrasBody: (g, k) => { g.strokeStyle = vlit(c.skin || '#7a9a68', -0.4); g.lineWidth = 0.35; g.beginPath(); g.moveTo(k.cx, k.shY + 1.5); g.lineTo(k.cx, k.hipY - 1); g.moveTo(k.cx - 2.6, k.shY + 3); g.quadraticCurveTo(k.cx, k.shY + 4, k.cx + 2.6, k.shY + 3); g.stroke(); vshape(g, vrr(k.cx - k.bw / 2, k.hipY - 1, k.bw, 1.6, 0.4), '#3a2a1a', 0.6); g.fillStyle = '#c8a040'; g.fillRect(k.cx - 0.8, k.hipY - 0.8, 1.6, 1.2); } }) },
  bloater: { w: 14, h: 15, draw: (g, w, h, f, c) => vhuman(g, w, h, f, { seed: 51, skin: c.skin || '#9ab060', shirt: c.skin || '#a8b85a', pants: '#4a4a3a', hr: 2.6, bw: 11, bh: 8.4, leg: 3, hunch: 1.6, arms: 'reach', eye: c.eye || '#ffe14a', belly: true, stride: 1,
    extrasBody: (g, k) => { const R = vrand(5); for (let i = 0; i < 7; i++) { const a = R() * 6.28, r = R() * k.bw * 0.45, x = k.cx + 0.4 + Math.cos(a) * r, y = k.hipY - k.bh * 0.42 + Math.sin(a) * r * 0.8, s = 0.5 + R() * 0.8; g.fillStyle = vlit(c.skin || '#9ab060', 0.25); g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.fillStyle = '#d8e070'; g.beginPath(); g.arc(x - s * 0.25, y - s * 0.25, s * 0.4, 0, 7); g.fill(); } g.strokeStyle = 'rgba(80,30,60,0.55)'; g.lineWidth = 0.3; for (let i = 0; i < 4; i++) { g.beginPath(); let x = k.cx - 3 + i * 2, y = k.hipY - 6; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += R() * 1.4 - 0.7; y += 1.2; g.lineTo(x, y); } g.stroke(); } } }) },
  titan: { w: 18, h: 16, draw: (g, w, h, f, c) => vhuman(g, w, h, f, { seed: 61, skin: c.skin || '#8a7a9a', shirt: c.skin || '#8a7a9a', pants: '#3a2a3a', hr: 2.8, bw: 11.5, bh: 7.6, leg: 3.8, hunch: 3, arms: 'big', eye: c.eye || '#ff2a5a', stride: 1,
    extrasBody: (g, k) => { g.strokeStyle = '#e8dcc8'; g.lineWidth = 0.55; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(k.cx + 0.5, k.shY + 2.2 + i * 1.5, 3 - i * 0.3, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); } g.fillStyle = '#5a1a2a'; g.beginPath(); g.ellipse(k.cx + 2.5, k.shY + 2, 1.2, 0.8, 0, 0, 7); g.fill(); for (let i = 0; i < 4; i++) vshape(g, gg => { const x = k.cx - k.bw / 2 + 1.5 + i * 2.2; gg.moveTo(x, k.shY + 0.6); gg.lineTo(x + 0.7, k.shY - 1.8); gg.lineTo(x + 1.4, k.shY + 0.6); gg.closePath(); }, '#d8ccb8', 0.5); } }) },
  crawler: { w: 12, h: 8, draw: (g, w, h, f, c) => {
    const ph = f * Math.PI / 2, sw = Math.sin(ph), sk = c.skin || '#8fb070';
    vlimb(g, 3, h - 2, 0.4 - sw * 0.6, h - 0.8, 1.8, vlit(sk, -0.3));               // dragging leg
    vlimb3(g, 6, h - 3.4, 8.4 + sw * 0.8, h - 3.8, 10.4 + sw * 1.2, h - 0.9, 1.8, vlit(sk, -0.3));
    vshape(g, vell(5.2, h - 2.6, 4.2, 2.1, -0.08), vgrad(g, 1, h - 5, 9, h, c.shirt || '#5a4a6a'));
    vstains(g, vrand(3), 2.5, h - 3.8, 5, 2, 3);
    vshape(g, vcirc(9.2, h - 3.6, 2.3), vrad(g, 9.2, h - 3.6, 2.3, sk));
    vglowEye(g, 10.2, h - 4, 0.38, c.eye || '#ffe14a');
    g.fillStyle = '#2a0a10'; g.beginPath(); g.ellipse(10.3, h - 2.7, 0.7, 0.35, 0, 0, 7); g.fill();
    vlimb3(g, 7, h - 2.6, 9.4 - sw * 0.8, h - 1.4, 11 - sw * 1.4, h - 0.7, 1.9, sk);
  } },
  hound: { w: 16, h: 11, draw: (g, w, h, f, c) => {
    const ph = f * Math.PI / 2, s1 = Math.sin(ph), s2 = Math.sin(ph + Math.PI), body = c.skin || '#6a2a2a';
    const legs = (dx, s, col) => vlimb3(g, dx, h - 5.5, dx + s * 1.3, h - 2.8, dx + s * 2, h - 0.7, 1.5, col);
    legs(4.2, s2, vlit(body, -0.35)); legs(10.8, s1, vlit(body, -0.35));
    vlimb3(g, 2.2, h - 6.5, 0.6, h - 8.6, 0.2 + s1 * 0.4, h - 9.8, 1.1, vlit(body, -0.1));  // tail
    vshape(g, vell(7.6, h - 6, 5.6, 2.6, -0.06), vgrad(g, 2, h - 9, 13, h - 3, body));
    for (let i = 0; i < 5; i++) vshape(g, gg => { const x = 4 + i * 1.6; gg.moveTo(x, h - 8.2); gg.lineTo(x + 0.6, h - 9.9); gg.lineTo(x + 1.2, h - 8.3); gg.closePath(); }, '#2a1418', 0.4);
    g.strokeStyle = 'rgba(255,170,120,0.5)'; g.lineWidth = 0.35; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(7 + i * 1.3, h - 6.4, 1.3, 0.3, 2.6); g.stroke(); }
    legs(5.4, s1, body); legs(11.8, s2, body);
    vshape(g, gg => { gg.moveTo(11.6, h - 9.2); gg.quadraticCurveTo(14, h - 9.6, 15.6, h - 7); gg.lineTo(15.7, h - 6); gg.quadraticCurveTo(13.5, h - 5, 11.4, h - 6.2); gg.closePath(); }, vgrad(g, 11, h - 10, 16, h - 5, body));
    vshape(g, gg => { gg.moveTo(12, h - 8.8); gg.lineTo(12.3, h - 10.8); gg.lineTo(13.4, h - 9.2); gg.closePath(); }, vlit(body, -0.25), 0.5);
    g.fillStyle = '#f0e8e0'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(13.4 + i * 0.7, h - 6.1); g.lineTo(13.7 + i * 0.7, h - 5.3); g.lineTo(14 + i * 0.7, h - 6.1); g.fill(); }
    vglowEye(g, 13.6, h - 8.1, 0.4, c.eye || '#ffcc33');
  } },
  hero: { w: 12, h: 16, draw: (g, w, h, f, c) => vhuman(g, w, h, f, { seed: 71, skin: '#f0c8a0', shirt: c.j || '#2a6ad0', pants: '#2a2e44', hr: 3.3, bw: 6, bh: 5.6, leg: 5, hunch: 0.2, arms: 'none', mouth: false, stride: 1.8,
    extrasBody: (g, k) => { g.strokeStyle = vlit(c.j || '#2a6ad0', -0.4); g.lineWidth = 0.35; g.beginPath(); g.moveTo(k.cx + 0.3, k.shY + 0.6); g.lineTo(k.cx + 0.3, k.hipY + 0.6); g.stroke(); vshape(g, vrr(k.cx - k.bw / 2 + 0.2, k.hipY - 0.6, k.bw - 0.4, 1.2, 0.4), '#3a2a1a', 0.5); vshape(g, vrr(k.cx - k.bw / 2 - 0.2, k.shY + 0.3, 2, 2.6, 0.6), vlit(c.j || '#2a6ad0', 0.15), 0.5); },
    extrasHead: (g, k) => {
      const hair = c.h || '#5a3a1a';
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(k.hx + k.hr * 0.45, k.hy - 0.1, 0.7, 0.85, 0, 0, 7); g.fill();
      g.fillStyle = '#1a1424'; g.beginPath(); g.arc(k.hx + k.hr * 0.55, k.hy, 0.45, 0, 7); g.fill();
      g.fillStyle = '#c87a6a'; g.beginPath(); g.arc(k.hx + k.hr * 0.75, k.hy + k.hr * 0.5, 0.35, 0, 7); g.fill();
      vshape(g, gg => { gg.moveTo(k.hx - k.hr - 0.2, k.hy + 0.6); gg.arc(k.hx, k.hy - 0.2, k.hr + 0.25, Math.PI * 0.97, Math.PI * 1.98); gg.lineTo(k.hx + k.hr * 0.7, k.hy - k.hr * 0.45); gg.lineTo(k.hx + k.hr * 0.2, k.hy - k.hr * 0.2); gg.lineTo(k.hx - k.hr * 0.25, k.hy - k.hr * 0.5); gg.lineTo(k.hx - k.hr * 0.7, k.hy); gg.closePath(); }, vrad(g, k.hx, k.hy - 1, k.hr, hair), 0.9);
      g.fillStyle = vlit(hair, 0.35); g.beginPath(); g.ellipse(k.hx - 0.4, k.hy - k.hr * 0.9, 1.1, 0.4, -0.3, 0, 7); g.fill();
    } }) },
  // ---------------------------------------------------- pickups
  coin: { w: 6, h: 6, frames: 1, pad: 0.8, draw: (g, w, h) => { vshape(g, vcirc(3, 3, 2.7), vrad(g, 3, 3, 2.7, '#f2b833'), 0.7); vshape(g, vcirc(3, 3, 1.8), vrad(g, 3, 3, 1.8, '#ffd65a'), 0); g.strokeStyle = '#b07a14'; g.lineWidth = 0.35; g.beginPath(); g.arc(3, 3, 1.8, 0, 7); g.stroke(); g.fillStyle = '#fff8d0'; g.beginPath(); g.ellipse(2.2, 2, 0.7, 0.35, -0.6, 0, 7); g.fill(); } },
  meat: { w: 9, h: 7, frames: 1, draw: (g) => { vlimb(g, 1.6, 5.6, 4, 3.6, 1.1, '#f0e8d8'); vshape(g, vcirc(1.2, 6, 0.8), '#f0e8d8', 0.6); vshape(g, vell(5.6, 3, 3, 2.4, -0.5), vrad(g, 5.6, 3, 3, '#c8603a')); g.fillStyle = 'rgba(255,220,180,0.6)'; g.beginPath(); g.ellipse(4.8, 2, 1.2, 0.5, -0.5, 0, 7); g.fill(); } },
  magnet: { w: 8, h: 8, frames: 1, draw: (g) => { g.lineCap = 'butt'; g.strokeStyle = VOL; g.lineWidth = 3.3; g.beginPath(); g.arc(4, 3.6, 2.4, Math.PI, 0, true); g.stroke(); g.strokeStyle = '#e8303a'; g.lineWidth = 2.3; g.beginPath(); g.arc(4, 3.6, 2.4, Math.PI, 0, true); g.stroke(); vshape(g, vrr(0.5, 1.3, 2.2, 2.4, 0.3), '#d8dce8', 0.7); vshape(g, vrr(5.3, 1.3, 2.2, 2.4, 0.3), '#d8dce8', 0.7); } },
  nuke: { w: 8, h: 8, frames: 1, draw: (g) => { vshape(g, vcirc(4, 4.4, 3.2), vrad(g, 4, 4.4, 3.2, '#ffd030')); g.fillStyle = '#1a1420'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(4, 4.4); g.arc(4, 4.4, 2.6, k * 2.094 - 1.57 - 0.5, k * 2.094 - 1.57 + 0.5); g.closePath(); g.fill(); } vshape(g, vcirc(4, 4.4, 0.8), '#ffd030', 0.4); } },
  goldchest: { w: 14, h: 9, frames: 1, draw: (g) => { vshape(g, vrr(0.6, 3, 12.8, 6, 0.8), vgrad(g, 0, 3, 0, 9, '#b8862a')); vshape(g, gg => { gg.moveTo(0.6, 3.6); gg.quadraticCurveTo(7, -1.2, 13.4, 3.6); gg.closePath(); }, vgrad(g, 0, 0, 0, 4, '#e8b03a')); g.fillStyle = '#ffe9a0'; g.fillRect(0.8, 3.2, 12.4, 0.9); vshape(g, vrr(5.8, 2.6, 2.4, 3, 0.4), '#e83a4a', 0.6); g.fillStyle = '#fff3c4'; g.fillRect(2, 0.9, 3.5, 0.5); } },
};
VDEF.chest = VDEF.goldchest;

const VCACHE = {};
function vwhite(c) { const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; const x = n.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, n.width, n.height); return n; }
// tint: colour pushed into skin/clothes; opts: overrides (hero hair/jacket)
function vsprite(name, tint, opts, res) {
  res = res || VRES;
  const key = name + '|' + (tint || '') + '|' + (opts ? JSON.stringify(opts) : '') + '|' + res;
  if (VCACHE[key]) return VCACHE[key];
  const D = VDEF[name]; if (!D) return null;
  const pad = D.pad != null ? D.pad : VPAD, cw = D.w + pad * 2, ch = D.h + pad;
  const c = Object.assign({}, opts || {});
  if (tint) {
    const base = { walker: ['#8fb070', '#6a5a8a'], riot: ['#8aa874', '#25345a'], witch: ['#a8b8a0', '#4a2a6a'], brute: ['#7a9a68'], bloater: ['#9ab060'], titan: ['#8a7a9a'], crawler: ['#8fb070', '#5a4a6a'], hound: ['#6a2a2a'] }[name] || ['#8fb070'];
    c.skin = vmix(base[0], tint, 0.55); if (base[1]) c.shirt = vmix(base[1], tint, 0.45);
    if (name === 'hound') c.skin = vmix(base[0], tint, 0.6);
  }
  const frames = [];
  const N = D.frames || 4;
  for (let f = 0; f < N; f++) {
    const n = document.createElement('canvas'); n.width = Math.ceil(cw * res); n.height = Math.ceil(ch * res);
    const g = n.getContext('2d'); g.scale(res, res); g.translate(pad, pad);
    D.draw(g, D.w, D.h, f, c);
    const fl = document.createElement('canvas'); fl.width = n.width; fl.height = n.height;
    const fg = fl.getContext('2d'); fg.translate(n.width, 0); fg.scale(-1, 1); fg.drawImage(n, 0, 0);
    frames.push({ n, f: fl, w: vwhite(n), wf: vwhite(fl) });
  }
  const s = Object.assign({}, frames[0], { fr: frames, width: cw, height: ch, vec: true });
  VCACHE[key] = s;
  return s;
}
