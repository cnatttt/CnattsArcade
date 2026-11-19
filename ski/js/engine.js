// =====================================================================
//  Tiny WebGL2 engine (fork of the Turbo Karts one) with snow shading.
// =====================================================================
'use strict';

// ------------------------------------------------------------ math (column-major 4x4)
const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  trans(x, y, z) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z) { const m = M4.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotX(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rotY(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotZ(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  // translate * rotY * rotX * rotZ * scale
  compose(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    let m = M4.trans(x, y, z);
    if (ry) m = M4.mul(m, M4.rotY(ry));
    if (rx) m = M4.mul(m, M4.rotX(rx));
    if (rz) m = M4.mul(m, M4.rotZ(rz));
    if (sx !== 1 || sy !== 1 || sz !== 1) m = M4.mul(m, M4.scale(sx, sy, sz));
    return m;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  },
  ortho(l, r, b, t, n, f) { const m = new Float32Array(16); m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n); m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1; return m; },
  lookAt(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const m = new Float32Array(16);
    m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); m[15] = 1;
    return m;
  },
  pt(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
};

// ------------------------------------------------------------ mesh builder
// colours are [r,g,b] 0..1 (or '#hex'); 4th value = glow (0..1, ignores lighting + fog)
function col4(c, glow = 0) {
  if (typeof c === 'string') { const h = c.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, glow]; }
  return [c[0], c[1], c[2], c[3] !== undefined ? c[3] : glow];
}
class MB {
  constructor() { this.d = []; }
  get count() { return this.d.length / 10; }
  tri(a, b, c, col, jitter = 0) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let k = col; if (jitter) { const j = 1 + (Math.random() - 0.5) * jitter; k = [col[0] * j, col[1] * j, col[2] * j, col[3]]; }
    for (const p of [a, b, c]) this.d.push(p[0], p[1], p[2], nx, ny, nz, k[0], k[1], k[2], k[3]);
  }
  quad(a, b, c, d, col, jitter) { this.tri(a, b, c, col, jitter); this.tri(a, c, d, col, jitter); }
  // triangle with its own normal per corner (smooth shading)
  triN(a, b, c, na, nb, nc, col) {
    // keep the winding consistent with the normals
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2]) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const [p, n] of [[a, na], [b, nb], [c, nc]]) { const l = Math.hypot(n[0], n[1], n[2]) || 1; this.d.push(p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, col[0], col[1], col[2], col[3]); }
  }
  // smooth ellipsoid (radius .5) - for helmets, glossy bits
  ball(m, segU, segV, col) {
    const c = col4(col), ctr = M4.pt(m, 0, 0, 0);
    const P = (u, v) => { const th = u / segU * Math.PI * 2, ph = v / segV * Math.PI; return M4.pt(m, Math.cos(th) * Math.sin(ph) * .5, Math.cos(ph) * .5, Math.sin(th) * Math.sin(ph) * .5); };
    const N = p => [p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2]];
    for (let v = 0; v < segV; v++) for (let u = 0; u < segU; u++) {
      const a = P(u, v), b = P(u + 1, v), cc = P(u + 1, v + 1), d = P(u, v + 1);
      if (v !== 0) this.triN(a, b, cc, N(a), N(b), N(cc), c);
      if (v !== segV - 1) this.triN(a, cc, d, N(a), N(cc), N(d), c);
    }
  }
  // smooth-sided cylinder along Y (radius .5, y -0.5..0.5) with flat caps
  tube(m, seg, col, capCol) {
    const c = col4(col), cc = capCol ? col4(capCol) : c, ctr = M4.pt(m, 0, 0, 0), top = M4.pt(m, 0, .5, 0), bot = M4.pt(m, 0, -.5, 0);
    const ax = [top[0] - bot[0], top[1] - bot[1], top[2] - bot[2]], al = Math.hypot(...ax) || 1; ax[0] /= al; ax[1] /= al; ax[2] /= al;
    const radial = p => { const d = [p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2]], k = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]; return [d[0] - ax[0] * k, d[1] - ax[1] * k, d[2] - ax[2] * k]; };
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const b0 = M4.pt(m, Math.cos(a0) * .5, -.5, Math.sin(a0) * .5), b1 = M4.pt(m, Math.cos(a1) * .5, -.5, Math.sin(a1) * .5);
      const t0 = M4.pt(m, Math.cos(a0) * .5, .5, Math.sin(a0) * .5), t1 = M4.pt(m, Math.cos(a1) * .5, .5, Math.sin(a1) * .5);
      this.triN(b0, t0, t1, radial(b0), radial(t0), radial(t1), c); this.triN(b0, t1, b1, radial(b0), radial(t1), radial(b1), c);
      this.tri(top, t1, t0, cc); this.tri(bot, b0, b1, cc);
    }
  }
  // unit cube (-0.5..0.5) through matrix m; optional different top colour
  box(m, col, jitter = 0, topCol = null) {
    const side = col4(col), top = topCol ? col4(topCol) : side, bot = side;
    const p = [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5], [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]].map(v => M4.pt(m, ...v));
    this.quad(p[3], p[7], p[6], p[2], top, jitter);   // top
    this.quad(p[0], p[1], p[5], p[4], bot, jitter);   // bottom
    this.quad(p[4], p[5], p[6], p[7], side, jitter);  // +z
    this.quad(p[1], p[0], p[3], p[2], side, jitter);  // -z
    this.quad(p[5], p[1], p[2], p[6], side, jitter);  // +x
    this.quad(p[0], p[4], p[7], p[3], side, jitter);  // -x
  }
  // cylinder along Y, radius .5, y -0.5..0.5
  cyl(m, seg, col, capCol, jitter = 0) {
    const c = col4(col), cc = capCol ? col4(capCol) : c;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const b0 = M4.pt(m, Math.cos(a0) * .5, -.5, Math.sin(a0) * .5), b1 = M4.pt(m, Math.cos(a1) * .5, -.5, Math.sin(a1) * .5);
      const t0 = M4.pt(m, Math.cos(a0) * .5, .5, Math.sin(a0) * .5), t1 = M4.pt(m, Math.cos(a1) * .5, .5, Math.sin(a1) * .5);
      this.quad(b0, t0, t1, b1, c, jitter);
      this.tri(M4.pt(m, 0, .5, 0), t1, t0, cc); this.tri(M4.pt(m, 0, -.5, 0), b0, b1, cc);
    }
  }
  // cone: base radius .5 at y=0, apex y=1
  cone(m, seg, col, jitter = 0.08) {
    const c = col4(col), ap = M4.pt(m, 0, 1, 0), ctr = M4.pt(m, 0, 0, 0);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const b0 = M4.pt(m, Math.cos(a0) * .5, 0, Math.sin(a0) * .5), b1 = M4.pt(m, Math.cos(a1) * .5, 0, Math.sin(a1) * .5);
      this.tri(b0, ap, b1, c, jitter); this.tri(ctr, b0, b1, c);
    }
  }
  // low-poly sphere radius .5
  sphere(m, segU, segV, col, jitter = 0.06) {
    const c = col4(col);
    const P = (u, v) => { const th = u / segU * Math.PI * 2, ph = v / segV * Math.PI; return M4.pt(m, Math.cos(th) * Math.sin(ph) * .5, Math.cos(ph) * .5, Math.sin(th) * Math.sin(ph) * .5); };
    for (let v = 0; v < segV; v++) for (let u = 0; u < segU; u++) {
      const a = P(u, v), b = P(u + 1, v), cc = P(u + 1, v + 1), d = P(u, v + 1);
      if (v === 0) this.tri(a, cc, d, c, jitter); else if (v === segV - 1) this.tri(a, b, cc, c, jitter); else this.quad(a, b, cc, d, c, jitter);
    }
  }
  // box with a narrower top (wedge / tapered body). w,h,d full sizes; tx,tz = top scale
  taper(m, tx, tz, col, jitter = 0, topShiftZ = 0) {
    const c = col4(col);
    const B = [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5]].map(v => M4.pt(m, ...v));
    const T = [[-.5 * tx, 1, -.5 * tz + topShiftZ], [.5 * tx, 1, -.5 * tz + topShiftZ], [.5 * tx, 1, .5 * tz + topShiftZ], [-.5 * tx, 1, .5 * tz + topShiftZ]].map(v => M4.pt(m, ...v));
    this.quad(T[0], T[3], T[2], T[1], c, jitter); this.quad(B[0], B[1], B[2], B[3], c, jitter);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(B[i], T[i], T[j], B[j], c, jitter); }
  }
  // smooth parametric surface: f(u, v) -> local [x, y, z] (u, v in 0..1), normals worked out numerically
  // and pointed away from `centre` (local, default origin). col: colour or fn(u, v, p) -> colour
  surf(m, f, nu, nv, col, centre = [0, 0, 0]) {
    const NM = (() => { const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], g0 = m[6], g = m[8], h = m[9], i = m[10];
      return [e * i - g0 * h, -(d * i - g0 * g), d * h - e * g, -(b * i - c * h), a * i - c * g, -(a * h - b * g), b * g0 - c * e, -(a * g0 - c * d), a * e - b * d]; })();
    const P = [], N = [], K = [], fixed = typeof col === 'function' ? null : col4(col);
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, p = f(u, v), e = 1e-3;
      const pu = f(Math.min(1, u + e), v), pu2 = f(Math.max(0, u - e), v), pv = f(u, Math.min(1, v + e)), pv2 = f(u, Math.max(0, v - e));
      const du = [pu[0] - pu2[0], pu[1] - pu2[1], pu[2] - pu2[2]], dv = [pv[0] - pv2[0], pv[1] - pv2[1], pv[2] - pv2[2]];
      let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
      if (Math.hypot(...n) < 1e-12) n = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
      if (n[0] * (p[0] - centre[0]) + n[1] * (p[1] - centre[1]) + n[2] * (p[2] - centre[2]) < 0) n = n.map(x => -x);
      P.push(M4.pt(m, p[0], p[1], p[2]));
      N.push([NM[0] * n[0] + NM[3] * n[1] + NM[6] * n[2], NM[1] * n[0] + NM[4] * n[1] + NM[7] * n[2], NM[2] * n[0] + NM[5] * n[1] + NM[8] * n[2]]);
      K.push(fixed || col4(col(u, v, p)));
    }
    const at = (i, j) => j * (nu + 1) + i;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if (Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]) + Math.hypot(P[a][0] - P[c][0], P[a][1] - P[c][1], P[a][2] - P[c][2]) > 1e-7) this.triN(P[a], P[b], P[c], N[a], N[b], N[c], K[a]);
      if (Math.hypot(P[a][0] - P[d][0], P[a][1] - P[d][1], P[a][2] - P[d][2]) + Math.hypot(P[c][0] - P[d][0], P[c][1] - P[d][1], P[c][2] - P[d][2]) > 1e-7) this.triN(P[a], P[c], P[d], N[a], N[c], N[d], K[a]);
    }
  }
  // lathe: prof = [[y, r], ...] revolved round Y (smoothly interpolated); ez squashes depth (z)
  lathe(m, prof, nu, nv, col, ez = 1) {
    const L = prof.length - 1;
    const at = v => { const x = v * L, i = Math.min(L - 1, Math.floor(x)), k = x - i, s = k * k * (3 - 2 * k); return [prof[i][0] + (prof[i + 1][0] - prof[i][0]) * k, prof[i][1] + (prof[i + 1][1] - prof[i][1]) * s]; };
    const cy = prof.reduce((a, p) => a + p[0], 0) / prof.length;
    this.surf(m, (u, v) => { const [y, r] = at(v), a = u * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r * ez]; }, nu, nv, col, [0, cy, 0]);
  }
  // rounded box (superellipsoid), size 1x1x1 centred; e: 0.25 = boxy .. 1 = round
  rbox(m, nu, nv, col, e = 0.35) {
    const sp = (x, k) => Math.sign(x) * Math.pow(Math.abs(x), k);
    this.surf(m, (u, v) => { const th = u * Math.PI * 2, ph = v * Math.PI; return [sp(Math.cos(th), e) * sp(Math.sin(ph), e) * 0.5, sp(Math.cos(ph), e) * 0.5, sp(Math.sin(th), e) * sp(Math.sin(ph), e) * 0.5]; }, nu, nv, col);
  }
  add(other, m) { // copy another builder through a matrix
    const d = other.d;
    for (let i = 0; i < d.length; i += 10) {
      const p = M4.pt(m, d[i], d[i + 1], d[i + 2]);
      const nx = m[0] * d[i + 3] + m[4] * d[i + 4] + m[8] * d[i + 5], ny = m[1] * d[i + 3] + m[5] * d[i + 4] + m[9] * d[i + 5], nz = m[2] * d[i + 3] + m[6] * d[i + 4] + m[10] * d[i + 5];
      const l = Math.hypot(nx, ny, nz) || 1;
      this.d.push(p[0], p[1], p[2], nx / l, ny / l, nz / l, d[i + 6], d[i + 7], d[i + 8], d[i + 9]);
    }
  }
}

// ------------------------------------------------------------ renderer
function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; };
  const FOG = `
    uniform vec3 uFog; uniform float uFogD; uniform vec3 uCam;
    vec3 fog(vec3 c, vec3 w, float keep) { float d = length(w - uCam) * uFogD; float f = 1.0 - exp(-d * d); return mix(c, uFog, clamp(f * (1.0 - keep), 0.0, 1.0)); }`;
  const LIT = prog(`#version 300 es
    in vec3 aPos; in vec3 aNor; in vec4 aCol;
    uniform mat4 uVP, uM, uLVP; uniform mat3 uNM; uniform vec3 uTint; uniform float uEmi;
    out vec3 vN; out vec4 vC; out vec3 vW; out vec4 vL; out float vG;
    // colour alpha < -0.5 marks groomed piste (alpha - 2 carries the usual glow value)
    void main() { vec4 w = uM * vec4(aPos, 1.0); vW = w.xyz; vN = uNM * aNor; vG = aCol.a < -0.5 ? 1.0 : 0.0; float a = aCol.a < -0.5 ? aCol.a + 2.0 : aCol.a;
      vC = vec4(aCol.rgb * uTint, max(a, uEmi)); vL = uLVP * w; gl_Position = uVP * w; }`,
  `#version 300 es
    precision highp float; precision highp sampler2DShadow;
    in vec3 vN; in vec4 vC; in vec3 vW; in vec4 vL; in float vG; out vec4 o;
    uniform vec3 uSun, uSunCol, uSky, uGround, uOrigin; uniform float uSpec, uAlpha, uShadowOn, uSnow, uExpo, uPost, uMtn; uniform sampler2DShadow uShadow; ${FOG}
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
    float fbm(vec2 p) { return vn(p) * 0.6 + vn(p * 2.3 + 7.1) * 0.28 + vn(p * 5.1 + 3.7) * 0.12; }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float shadow() {
      if (uShadowOn < 0.5) return 1.0;
      vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      float b = 0.0014, s = 0.0, k = 1.0 / 2048.0;
      for (int x = -2; x <= 1; x++) for (int y = -2; y <= 1; y++) s += texture(uShadow, vec3(p.xy + (vec2(x, y) + 0.5) * k * 1.4, p.z - b));
      s /= 16.0;
      vec2 e = abs(p.xy - 0.5) * 2.0; float edge = smoothstep(0.85, 1.0, max(e.x, e.y));
      return mix(s, 1.0, edge);
    }
    void main() {
      vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
      vec3 v = normalize(uCam - vW);
      if (dot(n, v) < 0.0 && uSpec > 0.0) n = -n;
      float dist = length(uCam - vW);
      vec3 base = vC.rgb;
      float rough = 0.0;
      if (uMtn > 0.0) {
        // distant peaks: snow vs rock worked out per pixel (no vertex-colour banding), strata streaks in the rock
        vec3 p = vW - uOrigin;
        vec2 e = vec2(4.0, 0.0);
        float b0 = fbm(p.xz * 0.012), bx = fbm((p.xz + e.xy) * 0.012), bz = fbm((p.xz + e.yx) * 0.012);
        n = normalize(n + vec3(b0 - bx, 0.0, b0 - bz) * 9.0);
        float strata = fbm(vec2(dot(p.xz, vec2(0.006, 0.004)), p.y * 0.05)) * 0.7 + vn(p.xz * 0.05) * 0.3;
        vec3 rock = mix(uMtn > 1.5 ? vec3(0.11, 0.12, 0.17) : vec3(0.2, 0.2, 0.235), uMtn > 1.5 ? vec3(0.19, 0.2, 0.26) : vec3(0.42, 0.41, 0.44), strata);
        float line = -290.0 + (fbm(p.xz * 0.004) - 0.5) * 120.0;
        float snowy = smoothstep(0.34, 0.5, n.y + (fbm(p.xz * vec2(0.05, 0.012)) - 0.5) * 0.18) * smoothstep(line - 30.0, line + 40.0, p.y);
        base = mix(rock, vec3(0.93, 0.95, 1.0), snowy);
        rough = 1.0 - snowy;
      } else if (uSnow > 0.0) {
        float fade = smoothstep(90.0, 6.0, dist) * uSnow;
        vec2 q = vW.xz;
        if (vG > 0.5) {
          // groomed piste: corduroy ridges running down the fall line, cat-track passes a few metres wide
          float k = q.x * 34.0, aa = clamp(1.0 - fwidth(k) * 0.5, 0.0, 1.0);
          n = normalize(n + vec3(cos(k) * 0.02 * aa * smoothstep(28.0, 4.0, dist), 0.0, 0.0));
          float pass = fract(q.x / 4.3 + vn(vec2(q.y * 0.02, 0.0)) * 0.3);
          base *= 1.0 - smoothstep(0.0, 0.06, pass) * smoothstep(0.12, 0.06, pass) * 0.035 - 0.012;
          vec2 e = vec2(0.08, 0.0); float h0 = vn(q * 3.0), hx = vn((q + e.xy) * 3.0), hz = vn((q + e.yx) * 3.0);
          n = normalize(n + vec3(h0 - hx, 0.0, h0 - hz) * 0.5 * fade);
        } else {
          // wind-blown powder: stretched sastrugi ripples + soft lumps
          vec2 w = vec2(q.x * 0.28 + q.y * 0.08, q.y * 1.1 - q.x * 0.3);
          vec2 e = vec2(0.06, 0.0);
          float h0 = fbm(w * 1.4) + vn(q * 0.35) * 0.6, hx = fbm((w + e.xy) * 1.4) + vn((q + e.xy) * 0.35) * 0.6, hz = fbm((w + e.yx) * 1.4) + vn((q + e.yx) * 0.35) * 0.6;
          n = normalize(n + vec3(h0 - hx, 0.0, h0 - hz) * 1.6 * fade);
        }
        base *= mix(0.97, 1.01, fbm(vW.xz * 0.02));
      }
      float d = max(dot(n, uSun), 0.0), sh = shadow();
      vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
      vec3 lit = base * (amb + uSunCol * d * sh);
      if (uSnow > 0.0 && uMtn == 0.0) {
        // snow: subsurface-ish wrap, cool blue in shadow, glossy sheen, tiny sparkles that twinkle as you move
        float wrap = max(dot(n, uSun) + 0.35, 0.0) / 1.35;
        lit += base * uSunCol * (wrap - d) * 0.18 * sh;
        lit = mix(lit, lit * vec3(0.8, 0.89, 1.14), (1.0 - sh * d) * 0.6 * uSnow);
        vec3 h = normalize(uSun + v);
        lit += uSunCol * pow(max(dot(n, h), 0.0), 80.0) * 0.12 * sh * uSnow;
        lit += uSky * pow(1.0 - max(dot(n, v), 0.0), 5.0) * 0.2 * uSnow;
        vec3 cell = floor(vW * 70.0);
        float hsh = fract(sin(dot(cell + floor(v * 6.0) * 17.0, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float glint = step(0.9965, hsh) * sh * d * smoothstep(14.0, 2.0, dist);
        lit += vec3(1.0, 0.98, 0.92) * glint * 3.0 * uSnow;
      }
      if (uMtn > 0.0) {
        float snowy = 1.0 - rough; vec3 h = normalize(uSun + v);
        lit += uSunCol * pow(max(dot(n, h), 0.0), 30.0) * 0.08 * snowy;
        lit = mix(lit, lit * vec3(0.78, 0.87, 1.15), (1.0 - d) * 0.5 * snowy);
      }
      if (uSpec > 0.0) {
        vec3 h = normalize(uSun + v);
        lit += uSunCol * pow(max(dot(n, h), 0.0), 40.0) * uSpec * sh;
        lit += amb * pow(1.0 - max(dot(n, v), 0.0), 3.0) * uSpec * 0.45;
      }
      vec3 c = mix(lit, vC.rgb * 1.25, vC.a);
      c = fog(c, vW, vC.a * 0.7);
      o = vec4(uPost > 0.5 ? c * uExpo : aces(c * uExpo), uAlpha);
    }`);
  const DEPTH = prog(`#version 300 es
    in vec3 aPos; uniform mat4 uLVP, uM; void main() { gl_Position = uLVP * uM * vec4(aPos, 1.0); }`,
  `#version 300 es
    precision mediump float; out vec4 o; void main() { o = vec4(1.0); }`);
  // shadow map
  const SM = 2048, smTex = gl.createTexture(), smFbo = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, smTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SM, SM, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, smFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, smTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let LVP = M4.ident(), shadowOn = 0;
  const FLAT = prog(`#version 300 es
    in vec3 aPos; in vec4 aCol; uniform mat4 uVP; out vec4 vC; out vec3 vW;
    void main() { vC = aCol; vW = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`,
  `#version 300 es
    precision highp float; in vec4 vC; in vec3 vW; out vec4 o; ${FOG}
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    uniform float uExpo, uPost;
    void main() { vec3 c = fog(vC.rgb, vW, 0.3) * uExpo; o = vec4(uPost > 0.5 ? c : aces(c), vC.a); }`);
  const PTS = prog(`#version 300 es
    in vec3 aPos; in vec4 aCol; in float aSize; uniform mat4 uVP; uniform float uScale; out vec4 vC;
    void main() { vC = aCol; gl_Position = uVP * vec4(aPos, 1.0); gl_PointSize = clamp(aSize * uScale / gl_Position.w, 1.0, 96.0); }`,
  `#version 300 es
    precision highp float; in vec4 vC; out vec4 o; uniform float uBoost;
    void main() { vec2 p = gl_PointCoord - 0.5; float r = length(p); if (r > 0.5) discard; o = vec4(vC.rgb * uBoost, vC.a * smoothstep(0.5, 0.2, r)); }`);

  // sky: gradient + sun glow worked out per pixel from the view direction
  const SKY = prog(`#version 300 es
    in vec3 aPos; uniform mat4 uVP; uniform vec3 uCam; out vec3 vD;
    void main() { vD = aPos; vec4 p = uVP * vec4(aPos + uCam, 1.0); gl_Position = p.xyww; }`,
  `#version 300 es
    precision highp float; in vec3 vD; out vec4 o;
    uniform vec3 uTop, uHor, uSunD, uSunC, uFog, uCloudC; uniform float uExpo, uNight, uPost, uTime, uCloud;
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; mat2 r = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { s += vn(p) * a; p = r * p; a *= 0.5; } return s / 0.97; }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void main() {
      vec3 d = normalize(vD); float y = d.y;
      vec3 c = mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.55));
      c = mix(c, uFog, smoothstep(0.12, -0.05, y));                     // haze at the horizon
      float s = max(dot(d, uSunD), 0.0);
      c += uSunC * (pow(s, 900.0) * 30.0 + pow(s, 60.0) * 0.45 + pow(s, 6.0) * 0.18) * (1.0 - uNight * 0.6);
      if (uCloud > 0.0 && y > -0.03) {
        // a layer of soft cumulus: projected onto a plane, lit from the sun side, fading into the haze
        vec2 uv = d.xz / (max(y, 0.0) + 0.1) * 0.55 + vec2(uTime * 0.006, uTime * 0.0025);
        vec2 wp = uv + vec2(fbm(uv * 0.7 + 3.1), fbm(uv * 0.7 - 1.7)) * 0.6;
        float n = fbm(wp), lo = 1.0 - uCloud;
        float cov = smoothstep(lo, lo + 0.22, n), thick = smoothstep(lo, lo + 0.5, n);
        float n2 = fbm(wp + normalize(uSunD.xz + 1e-4) * 0.09);
        float lit = clamp(0.62 + (n - n2) * 3.2, 0.2, 1.0);
        vec3 cc = mix(uCloudC * 0.62 + uHor * 0.2, uCloudC, lit);
        cc += uSunC * (pow(s, 6.0) * 0.7 + pow(s, 40.0) * 1.5) * (1.0 - thick * 0.8);
        float edge = smoothstep(-0.03, 0.16, y);
        c = mix(c, cc, cov * edge * 0.96);
      }
      if (uNight > 0.5 && y > 0.0) { vec3 q = floor(d * 380.0); float st = step(0.9985, h31(q)); c += vec3(st) * 0.9 * smoothstep(0.0, 0.3, y); }
      o = vec4(uPost > 0.5 ? c * uExpo * 1.05 : aces(c * uExpo * 1.05), 1.0);
    }`);
  const skyVao = gl.createVertexArray(), skyBuf = gl.createBuffer(); let skyN = 0;
  {
    const v = [], R = 1000, SU = 32, SV = 16, P = (u, w) => { const th = u / SU * Math.PI * 2, ph = w / SV * Math.PI; return [Math.cos(th) * Math.sin(ph) * R, Math.cos(ph) * R, Math.sin(th) * Math.sin(ph) * R]; };
    for (let w = 0; w < SV; w++) for (let u = 0; u < SU; u++) { const a = P(u, w), b = P(u + 1, w), c = P(u + 1, w + 1), d = P(u, w + 1); v.push(...a, ...b, ...c, ...a, ...c, ...d); }
    skyN = v.length / 3;
    gl.bindVertexArray(skyVao); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(SKY.p, 'aPos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 12, 0); gl.bindVertexArray(null);
  }
  // inverse-transpose of the upper 3x3, so normals stay right on stretched meshes
  function nm3(M) {
    const a = M[0], b = M[1], c = M[2], d = M[4], e = M[5], f = M[6], g = M[8], h = M[9], i = M[10];
    const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc || 1e-9, k = 1 / det;
    return new Float32Array([A * k, B * k, Cc * k, -(b * i - c * h) * k, (a * i - c * g) * k, -(a * h - b * g) * k, (b * f - c * e) * k, -(a * f - c * d) * k, (a * e - b * d) * k]);
  }
  const ID3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  let expo = 1.0;
  function mesh(mb) {
    const data = new Float32Array(mb.d);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = n => gl.getAttribLocation(LIT.p, n);
    gl.enableVertexAttribArray(loc('aPos')); gl.vertexAttribPointer(loc('aPos'), 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(loc('aNor')); gl.vertexAttribPointer(loc('aNor'), 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(loc('aCol')); gl.vertexAttribPointer(loc('aCol'), 4, gl.FLOAT, false, 40, 24);
    gl.bindVertexArray(null);
    return { vao, buf, n: data.length / 10 };
  }
  function free(m) { if (!m) return; gl.deleteBuffer(m.buf); if (m.ib) gl.deleteBuffer(m.ib); gl.deleteVertexArray(m.vao); }
  // indexed mesh whose vertices are rewritten every frame (CPU-skinned characters)
  function dynMesh(nv, idx) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, nv * 40, gl.DYNAMIC_DRAW);
    const loc = n => gl.getAttribLocation(LIT.p, n);
    gl.enableVertexAttribArray(loc('aPos')); gl.vertexAttribPointer(loc('aPos'), 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(loc('aNor')); gl.vertexAttribPointer(loc('aNor'), 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(loc('aCol')); gl.vertexAttribPointer(loc('aCol'), 4, gl.FLOAT, false, 40, 24);
    const big = nv > 65535, ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(idx) : new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, buf, ib, it: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, n: idx.length };
  }
  function updateDyn(m, data) { gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data); }
  const drawM = m => { gl.bindVertexArray(m.vao); if (m.ib) gl.drawElements(gl.TRIANGLES, m.n, m.it, 0); else gl.drawArrays(gl.TRIANGLES, 0, m.n); };
  // dynamic buffers
  const flatVao = gl.createVertexArray(), flatBuf = gl.createBuffer();
  gl.bindVertexArray(flatVao); gl.bindBuffer(gl.ARRAY_BUFFER, flatBuf);
  { const a = gl.getAttribLocation(FLAT.p, 'aPos'), c = gl.getAttribLocation(FLAT.p, 'aCol'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(c); gl.vertexAttribPointer(c, 4, gl.FLOAT, false, 28, 12); }
  const ptVao = gl.createVertexArray(), ptBuf = gl.createBuffer();
  gl.bindVertexArray(ptVao); gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
  { const a = gl.getAttribLocation(PTS.p, 'aPos'), c = gl.getAttribLocation(PTS.p, 'aCol'), s = gl.getAttribLocation(PTS.p, 'aSize'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(c); gl.vertexAttribPointer(c, 4, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(s); gl.vertexAttribPointer(s, 1, gl.FLOAT, false, 32, 28); }
  gl.bindVertexArray(null);

  // ---------------------------------------------------------- post-processing
  // HDR scene (MSAA) -> resolve -> bloom (dual-filter) + sun shafts -> tonemap, grade, speed blur, vignette, grain
  const QV = `#version 300 es
    out vec2 vUv; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const post = (() => {
    if (!gl.getExtension('EXT_color_buffer_float')) return null;
    try {
      const PRE = prog(QV, `#version 300 es
        precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform vec2 uPx; uniform float uThr;
        vec3 tap(vec2 d) { return texture(uT, vUv + d * uPx).rgb; }
        float lu(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        vec3 kar(vec3 c) { return c / (1.0 + lu(c)); }   // Karis weighting kills single-pixel fireflies (snow glints)
        void main() {
          vec3 a = tap(vec2(-1, -1)), b = tap(vec2(1, -1)), c = tap(vec2(-1, 1)), d = tap(vec2(1, 1));
          vec3 s = (kar(a) + kar(b) + kar(c) + kar(d)) * 0.25; s = s / max(1.0 - lu(s), 1e-3);
          float l = lu(s), k = uThr * 0.5, r = clamp(l - uThr + k, 0.0, 2.0 * k); r = r * r / (4.0 * k + 1e-4);
          o = vec4(s * max(r, l - uThr) / max(l, 1e-4), 1.0);
        }`);
      const DOWN = prog(QV, `#version 300 es
        precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform vec2 uPx;
        void main() { vec2 h = uPx * 0.5; vec3 s = texture(uT, vUv).rgb * 4.0 + texture(uT, vUv - h).rgb + texture(uT, vUv + h).rgb + texture(uT, vUv + vec2(h.x, -h.y)).rgb + texture(uT, vUv - vec2(h.x, -h.y)).rgb; o = vec4(s / 8.0, 1.0); }`);
      const UP = prog(QV, `#version 300 es
        precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform vec2 uPx; uniform float uW;
        void main() { vec2 h = uPx * 0.5; vec3 s = vec3(0.0);
          s += texture(uT, vUv + vec2(-h.x * 2.0, 0.0)).rgb + texture(uT, vUv + vec2(h.x * 2.0, 0.0)).rgb + texture(uT, vUv + vec2(0.0, -h.y * 2.0)).rgb + texture(uT, vUv + vec2(0.0, h.y * 2.0)).rgb;
          s += (texture(uT, vUv + vec2(-h.x, h.y)).rgb + texture(uT, vUv + vec2(h.x, h.y)).rgb + texture(uT, vUv + vec2(h.x, -h.y)).rgb + texture(uT, vUv + vec2(-h.x, -h.y)).rgb) * 2.0;
          o = vec4(s / 12.0 * uW, 1.0); }`);
      // god rays: march toward the sun through the scene, keeping only the sun disk / sky glow (occluders stay dark)
      const SHAFT = prog(QV, `#version 300 es
        precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform vec2 uSun; uniform float uThr;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec2 d = (uSun - vUv) / 28.0; vec2 p = vUv + d * h(vUv * 991.0); float w = 1.0, acc = 0.0;
          for (int i = 0; i < 28; i++) { vec3 c = texture(uT, p).rgb; float l = max(dot(c, vec3(0.3, 0.55, 0.15)) - uThr, 0.0); acc += min(l, 6.0) * w; w *= 0.955; p += d; }
          o = vec4(vec3(acc / 28.0), 1.0);
        }`);
      const COMP = prog(QV, `#version 300 es
        precision highp float; in vec2 vUv; out vec4 o;
        uniform sampler2D uT, uB, uS; uniform vec2 uPx, uSun; uniform float uBloom, uSpeed, uVig, uSat, uCon, uTime, uShaft, uFlash;
        uniform vec3 uLift, uGain, uSunC, uFlashC;
        // ACES fitted (Stephen Hill) - keeps colour in the highlights instead of clipping them to white
        vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 aces(vec3 c) {
          const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
          const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
          return clamp(O * rrt(I * c), 0.0, 1.0);
        }
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec2 uv = vUv, cd = uv - vec2(0.5, 0.52); float r = length(cd * vec2(1.6, 1.0));
          vec3 c = texture(uT, uv).rgb;
          // speed: radial streaks that grow toward the edges + a hint of chromatic split
          float sb = uSpeed * smoothstep(0.18, 0.75, r);
          if (sb > 0.002) {
            vec3 acc = c; float wt = 1.0; float j = h(uv * 517.0 + uTime);
            for (int i = 1; i <= 8; i++) { float k = (float(i) + j) / 8.0; vec2 q = uv - cd * k * sb * 0.09; acc += texture(uT, q).rgb; wt += 1.0; }
            c = acc / wt;
            vec2 ca = cd * sb * 0.0025; c.r = mix(c.r, texture(uT, uv + ca).r, 0.7); c.b = mix(c.b, texture(uT, uv - ca).b, 0.7);
          }
          c += texture(uB, uv).rgb * uBloom;
          c += texture(uS, uv).rgb * uSunC * uShaft;
          c += uFlashC * uFlash;
          c = aces(c);
          // grade: lift / gain, contrast round mid grey, saturation
          c = c * uGain + uLift * (1.0 - c);
          c = clamp((c - 0.5) * uCon + 0.5, 0.0, 1.0);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat);
          c *= mix(1.0, smoothstep(1.15, 0.35, r), uVig);
          c += (h(uv * vec2(1931.0, 1373.0) + fract(uTime * 7.0)) - 0.5) * 0.018;
          o = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`);
      const vao = gl.createVertexArray();
      const ms = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
      const tex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      const fbo = t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };
      let W = 0, H = 0, msF = null, msC = null, msD = null, rT = null, rF = null, rD = null, lv = [], sh = null, samples = ms;
      const kill = () => {
        [msC, msD, rD].forEach(r => r && gl.deleteRenderbuffer(r)); [msF, rF].forEach(f => f && gl.deleteFramebuffer(f)); if (rT) gl.deleteTexture(rT);
        lv.forEach(l => { gl.deleteTexture(l.t); gl.deleteFramebuffer(l.f); }); if (sh) { gl.deleteTexture(sh.t); gl.deleteFramebuffer(sh.f); } lv = []; sh = null;
      };
      function alloc(w, h, s) {
        kill(); W = w; H = h; samples = s;
        rT = tex(w, h); rF = fbo(rT);
        if (s > 1) {
          msF = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, msF);
          msC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, msC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, gl.RGBA16F, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msC);
          msD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, msD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msD);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.deleteFramebuffer(msF); msF = null; samples = 0; }
        } else msF = null;
        if (!msF) { gl.bindFramebuffer(gl.FRAMEBUFFER, rF); rD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rD); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rD); }
        let bw = w >> 1, bh = h >> 1;
        for (let i = 0; i < 6 && bw > 4 && bh > 4; i++) { const t = tex(bw, bh); lv.push({ t, f: fbo(t), w: bw, h: bh }); bw >>= 1; bh >>= 1; }
        { const t = tex(w >> 2, h >> 2); sh = { t, f: fbo(t), w: w >> 2, h: h >> 2 }; }
        const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        return ok;
      }
      const pass = (P, f, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.viewport(0, 0, w, h); gl.useProgram(P.p); gl.bindVertexArray(vao); };
      const bindT = (P, name, t, unit) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(P.u[name], unit); };
      return {
        get samples() { return samples; },
        bind(msaa) {
          const w = canvas.width, h = canvas.height, s = msaa ? ms : 0;
          if (w !== W || h !== H || s !== samples) { if (!alloc(w, h, s)) return false; }
          gl.bindFramebuffer(gl.FRAMEBUFFER, msF || rF); return true;
        },
        finish(fx) {
          gl.disable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
          if (msF) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msF); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rF); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST); }
          // bloom chain
          pass(PRE, lv[0].f, lv[0].w, lv[0].h); bindT(PRE, 'uT', rT, 0); gl.uniform2f(PRE.u.uPx, 1 / W, 1 / H); gl.uniform1f(PRE.u.uThr, fx.thr); gl.drawArrays(gl.TRIANGLES, 0, 3);
          for (let i = 1; i < lv.length; i++) { pass(DOWN, lv[i].f, lv[i].w, lv[i].h); bindT(DOWN, 'uT', lv[i - 1].t, 0); gl.uniform2f(DOWN.u.uPx, 1 / lv[i - 1].w, 1 / lv[i - 1].h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
          gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
          for (let i = lv.length - 1; i > 0; i--) { pass(UP, lv[i - 1].f, lv[i - 1].w, lv[i - 1].h); bindT(UP, 'uT', lv[i].t, 0); gl.uniform2f(UP.u.uPx, 1 / lv[i].w, 1 / lv[i].h); gl.uniform1f(UP.u.uW, 0.85); gl.drawArrays(gl.TRIANGLES, 0, 3); }
          gl.disable(gl.BLEND);
          // shafts
          let shaft = 0;
          if (fx.sunUV && fx.shaft > 0) {
            pass(SHAFT, sh.f, sh.w, sh.h); bindT(SHAFT, 'uT', rT, 0); gl.uniform2f(SHAFT.u.uSun, fx.sunUV[0], fx.sunUV[1]); gl.uniform1f(SHAFT.u.uThr, fx.shaftThr); gl.drawArrays(gl.TRIANGLES, 0, 3);
            shaft = fx.shaft;
          } else { gl.bindFramebuffer(gl.FRAMEBUFFER, sh.f); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
          pass(COMP, null, canvas.width, canvas.height);
          bindT(COMP, 'uT', rT, 0); bindT(COMP, 'uB', lv[0].t, 1); bindT(COMP, 'uS', sh.t, 2);
          const u = COMP.u;
          gl.uniform2f(u.uPx, 1 / W, 1 / H); gl.uniform1f(u.uBloom, fx.bloom); gl.uniform1f(u.uSpeed, fx.speed); gl.uniform1f(u.uVig, fx.vig);
          gl.uniform1f(u.uSat, fx.sat); gl.uniform1f(u.uCon, fx.con); gl.uniform1f(u.uTime, fx.time % 100); gl.uniform1f(u.uShaft, shaft);
          gl.uniform3fv(u.uLift, fx.lift); gl.uniform3fv(u.uGain, fx.gain); gl.uniform3fv(u.uSunC, fx.sunC); gl.uniform1f(u.uFlash, fx.flash); gl.uniform3fv(u.uFlashC, fx.flashC);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.activeTexture(gl.TEXTURE0); gl.enable(gl.DEPTH_TEST);
        },
      };
    } catch (e) { console.warn('post-processing off:', e); return null; }
  })();
  // graphics: 0 low (direct, no post), 1 high (post), 2 ultra (post + MSAA + higher res)
  let quality = post ? 1 : 0, postOn = false;
  const FX = { thr: 1.05, bloom: 0.55, speed: 0, vig: 0.55, sat: 1.08, con: 1.04, time: 0, lift: [0, 0, 0], gain: [1, 1, 1], sunUV: null, shaft: 0, shaftThr: 2.2, sunC: [1, 0.9, 0.7], flash: 0, flashC: [1, 1, 1] };
  let VP = null, env = null, cam = [0, 0, 0], vpH = 720;
  function setCommon(P) {
    gl.uniformMatrix4fv(P.u.uVP, false, VP);
    gl.uniform3fv(P.u.uFog, env.fog); gl.uniform1f(P.u.uFogD, env.fogD); gl.uniform3fv(P.u.uCam, cam);
  }
  return {
    gl, mesh, free, dynMesh, updateDyn,
    begin(view, camera, e) {
      // view: {x, y, w, h} in canvas pixels (y from top)
      const H = canvas.height, k = canvas.width / 1280;
      const vx = Math.round(view.x * k), vy = Math.round(view.y * k), vw = Math.round(view.w * k), vh = Math.round(view.h * k);
      postOn = !!(quality > 0 && post && post.bind(quality >= 2));
      if (!postOn) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(vx, H - vy - vh, vw, vh);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(vx, H - vy - vh, vw, vh);
      gl.clearColor(e.fog[0], e.fog[1], e.fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.CULL_FACE);
      const P = M4.persp(camera.fov, view.w / view.h, 0.3, 3200);
      VP = M4.mul(P, M4.lookAt(camera.eye, camera.at, [0, 1, 0]));
      env = e; cam = camera.eye; vpH = view.h * k;
      gl.useProgram(LIT.p); setCommon(LIT);
      gl.uniform3fv(LIT.u.uSun, e.sun); gl.uniform3fv(LIT.u.uSunCol, e.sunCol); gl.uniform3fv(LIT.u.uSky, e.sky); gl.uniform3fv(LIT.u.uGround, e.ground);
      gl.uniform3fv(LIT.u.uTint, [1, 1, 1]); gl.uniform1f(LIT.u.uEmi, 0);
      gl.uniformMatrix4fv(LIT.u.uLVP, false, LVP); gl.uniform1f(LIT.u.uShadowOn, shadowOn);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, smTex); gl.uniform1i(LIT.u.uShadow, 1); gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(LIT.u.uSpec, 0); gl.uniform1f(LIT.u.uAlpha, 1); gl.uniform1f(LIT.u.uSnow, 0);
      expo = e.expo || 1.0; gl.uniform1f(LIT.u.uExpo, expo);
      const pf = postOn ? 1 : 0;
      gl.uniform1f(LIT.u.uPost, pf);
      gl.useProgram(FLAT.p); gl.uniform1f(FLAT.u.uExpo, expo); gl.uniform1f(FLAT.u.uPost, pf);
      gl.useProgram(SKY.p); gl.uniform1f(SKY.u.uPost, pf);
      gl.useProgram(PTS.p); gl.uniform1f(PTS.u.uBoost, postOn ? 1.5 : 1);
      gl.useProgram(LIT.p);
      return VP;
    },
    // o: { spec, alpha }
    draw(m, M, tint, emi, noFog, o) {
      if (!m) return;
      gl.useProgram(LIT.p);
      gl.uniformMatrix4fv(LIT.u.uM, false, M || M4.ident()); gl.uniformMatrix3fv(LIT.u.uNM, false, M ? nm3(M) : ID3);
      gl.uniform3fv(LIT.u.uTint, tint || [1, 1, 1]); gl.uniform1f(LIT.u.uEmi, emi || 0);
      const spec = o && o.spec || 0, alpha = o && o.alpha !== undefined ? o.alpha : 1;
      gl.uniform1f(LIT.u.uSpec, spec); gl.uniform1f(LIT.u.uAlpha, alpha); gl.uniform1f(LIT.u.uSnow, o && o.snow || 0); gl.uniform1f(LIT.u.uMtn, o && o.mtn || 0);
      if (o && o.mtn && M) gl.uniform3f(LIT.u.uOrigin, M[12], M[13], M[14]);
      if (alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      if (noFog) gl.uniform1f(LIT.u.uFogD, o && o.fogD !== undefined ? o.fogD : 0);
      drawM(m);
      if (noFog) gl.uniform1f(LIT.u.uFogD, env.fogD);
      if (alpha < 1) { gl.disable(gl.BLEND); gl.depthMask(true); }
      if (spec) gl.uniform1f(LIT.u.uSpec, 0);
    },
    // ---- shadow map pass: call shadowBegin, shadowDraw for every caster, then shadowEnd (before begin)
    shadowBegin(focus, sun, extent = 70) {
      const back = 220, e = [focus[0] + sun[0] * back, focus[1] + sun[1] * back, focus[2] + sun[2] * back];
      const V = M4.lookAt(e, focus, Math.abs(sun[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
      // snap to texels so shadows don't shimmer when moving
      const tex = extent * 2 / SM, fx = V[0] * focus[0] + V[4] * focus[1] + V[8] * focus[2] + V[12], fy = V[1] * focus[0] + V[5] * focus[1] + V[9] * focus[2] + V[13];
      const ox = fx - Math.round(fx / tex) * tex, oy = fy - Math.round(fy / tex) * tex;
      LVP = M4.mul(M4.ortho(-extent - ox, extent - ox, -extent - oy, extent - oy, 1, back * 2), V);
      gl.bindFramebuffer(gl.FRAMEBUFFER, smFbo); gl.viewport(0, 0, SM, SM); gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.colorMask(false, false, false, false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2.0);
      gl.useProgram(DEPTH.p); gl.uniformMatrix4fv(DEPTH.u.uLVP, false, LVP);
      shadowOn = 1;
    },
    shadowDraw(m, M) { if (!m) return; gl.uniformMatrix4fv(DEPTH.u.uM, false, M || M4.ident()); drawM(m); },
    shadowEnd() { gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true); gl.bindFramebuffer(gl.FRAMEBUFFER, null); },
    shadowsOff() { shadowOn = 0; },
    setScale(s) { const w = Math.round(1280 * s), h = Math.round(720 * s); if (canvas.width !== w) { canvas.width = w; canvas.height = h; } },
    sky(m) { gl.depthMask(false); this.draw(m, M4.trans(cam[0], cam[1] - 40, cam[2]), null, 1, true); gl.depthMask(true); },
    // per-pixel sky dome: s = { top, hor, sun (dir), sunCol, fog, night }
    skyDome(s) {
      gl.useProgram(SKY.p); gl.uniformMatrix4fv(SKY.u.uVP, false, VP); gl.uniform3fv(SKY.u.uCam, cam);
      gl.uniform3fv(SKY.u.uTop, s.top); gl.uniform3fv(SKY.u.uHor, s.hor); gl.uniform3fv(SKY.u.uSunD, s.sun); gl.uniform3fv(SKY.u.uSunC, s.sunCol); gl.uniform3fv(SKY.u.uFog, s.fog);
      gl.uniform1f(SKY.u.uExpo, expo); gl.uniform1f(SKY.u.uNight, s.night ? 1 : 0);
      gl.uniform1f(SKY.u.uTime, s.time || 0); gl.uniform1f(SKY.u.uCloud, s.cloud || 0); gl.uniform3fv(SKY.u.uCloudC, s.cloudCol || [1, 1, 1]);
      gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.bindVertexArray(skyVao); gl.drawArrays(gl.TRIANGLES, 0, skyN); gl.depthMask(true); gl.depthFunc(gl.LESS);
      gl.useProgram(LIT.p);
    },
    // tris: flat array of x,y,z,r,g,b,a per vertex
    flat(arr, additive) {
      if (!arr.length) return;
      gl.useProgram(FLAT.p); setCommon(FLAT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
      gl.bindVertexArray(flatVao); gl.bindBuffer(gl.ARRAY_BUFFER, flatBuf); gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, arr.length / 7);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND);
    },
    // pts: x,y,z,r,g,b,a,size per point
    points(arr, additive) {
      if (!arr.length) return;
      gl.useProgram(PTS.p); gl.uniformMatrix4fv(PTS.u.uVP, false, VP); gl.uniform1f(PTS.u.uScale, vpH * 0.9);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.bindVertexArray(ptVao); gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, arr.length / 8);
      gl.depthMask(true); gl.disable(gl.BLEND);
    },
    // world point -> screen pixel inside the current view (or null if behind)
    project(p, view) { const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15]; if (w <= 0.1) return null; return [view.x + (x / w * 0.5 + 0.5) * view.w, view.y + (0.5 - y / w * 0.5) * view.h]; },
    end() {
      gl.disable(gl.SCISSOR_TEST);
      if (!postOn) return;
      // sun position on screen for the light shafts
      FX.sunUV = null;
      if (env && FX.shaft > 0) {
        const p = [cam[0] + env.sun[0] * 1000, cam[1] + env.sun[1] * 1000, cam[2] + env.sun[2] * 1000];
        const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
        if (w > 0) { const u = x / w * 0.5 + 0.5, v = y / w * 0.5 + 0.5; if (u > -0.6 && u < 1.6 && v > -0.6 && v < 1.6) FX.sunUV = [u, v]; }
      }
      post.finish(FX);
      postOn = false;
    },
    fx: FX,
    get hasPost() { return !!post; },
    get quality() { return quality; },
    setQuality(q) { quality = post ? Math.max(0, Math.min(2, q | 0)) : 0; },
  };
}
