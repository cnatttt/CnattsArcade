// =====================================================================
//  Tiny WebGL2 engine for Turbo Karts: low-poly, flat-shaded, no deps.
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
    uniform mat4 uVP, uM; uniform vec3 uTint; uniform float uEmi;
    out vec3 vN; out vec4 vC; out vec3 vW;
    void main() { vec4 w = uM * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uM) * aNor; vC = vec4(aCol.rgb * uTint, max(aCol.a, uEmi)); gl_Position = uVP * w; }`,
  `#version 300 es
    precision highp float;
    in vec3 vN; in vec4 vC; in vec3 vW; out vec4 o;
    uniform vec3 uSun, uSunCol, uSky, uGround; ${FOG}
    void main() {
      vec3 n = normalize(vN); float d = max(dot(n, uSun), 0.0);
      vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
      vec3 lit = vC.rgb * (amb + uSunCol * d);
      vec3 c = mix(lit, vC.rgb * 1.25, vC.a);
      o = vec4(fog(c, vW, vC.a * 0.7), 1.0);
    }`);
  const FLAT = prog(`#version 300 es
    in vec3 aPos; in vec4 aCol; uniform mat4 uVP; out vec4 vC; out vec3 vW;
    void main() { vC = aCol; vW = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`,
  `#version 300 es
    precision highp float; in vec4 vC; in vec3 vW; out vec4 o; ${FOG}
    void main() { o = vec4(fog(vC.rgb, vW, 0.3), vC.a); }`);
  const PTS = prog(`#version 300 es
    in vec3 aPos; in vec4 aCol; in float aSize; uniform mat4 uVP; uniform float uScale; out vec4 vC;
    void main() { vC = aCol; gl_Position = uVP * vec4(aPos, 1.0); gl_PointSize = clamp(aSize * uScale / gl_Position.w, 1.0, 96.0); }`,
  `#version 300 es
    precision highp float; in vec4 vC; out vec4 o;
    void main() { vec2 p = gl_PointCoord - 0.5; float r = length(p); if (r > 0.5) discard; o = vec4(vC.rgb, vC.a * smoothstep(0.5, 0.2, r)); }`);

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
  function free(m) { if (!m) return; gl.deleteBuffer(m.buf); gl.deleteVertexArray(m.vao); }
  // dynamic buffers
  const flatVao = gl.createVertexArray(), flatBuf = gl.createBuffer();
  gl.bindVertexArray(flatVao); gl.bindBuffer(gl.ARRAY_BUFFER, flatBuf);
  { const a = gl.getAttribLocation(FLAT.p, 'aPos'), c = gl.getAttribLocation(FLAT.p, 'aCol'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(c); gl.vertexAttribPointer(c, 4, gl.FLOAT, false, 28, 12); }
  const ptVao = gl.createVertexArray(), ptBuf = gl.createBuffer();
  gl.bindVertexArray(ptVao); gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
  { const a = gl.getAttribLocation(PTS.p, 'aPos'), c = gl.getAttribLocation(PTS.p, 'aCol'), s = gl.getAttribLocation(PTS.p, 'aSize'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(c); gl.vertexAttribPointer(c, 4, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(s); gl.vertexAttribPointer(s, 1, gl.FLOAT, false, 32, 28); }
  gl.bindVertexArray(null);

  let VP = null, env = null, cam = [0, 0, 0], vpH = 720;
  function setCommon(P) {
    gl.uniformMatrix4fv(P.u.uVP, false, VP);
    gl.uniform3fv(P.u.uFog, env.fog); gl.uniform1f(P.u.uFogD, env.fogD); gl.uniform3fv(P.u.uCam, cam);
  }
  return {
    gl, mesh, free,
    begin(view, camera, e) {
      // view: {x, y, w, h} in canvas pixels (y from top)
      const H = canvas.height;
      gl.viewport(view.x, H - view.y - view.h, view.w, view.h);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(view.x, H - view.y - view.h, view.w, view.h);
      gl.clearColor(e.fog[0], e.fog[1], e.fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.CULL_FACE);
      const P = M4.persp(camera.fov, view.w / view.h, 0.3, 2400);
      VP = M4.mul(P, M4.lookAt(camera.eye, camera.at, [0, 1, 0]));
      env = e; cam = camera.eye; vpH = view.h;
      gl.useProgram(LIT.p); setCommon(LIT);
      gl.uniform3fv(LIT.u.uSun, e.sun); gl.uniform3fv(LIT.u.uSunCol, e.sunCol); gl.uniform3fv(LIT.u.uSky, e.sky); gl.uniform3fv(LIT.u.uGround, e.ground);
      gl.uniform3fv(LIT.u.uTint, [1, 1, 1]); gl.uniform1f(LIT.u.uEmi, 0);
      return VP;
    },
    draw(m, M, tint, emi, noFog) {
      if (!m) return;
      gl.useProgram(LIT.p);
      gl.uniformMatrix4fv(LIT.u.uM, false, M || M4.ident());
      gl.uniform3fv(LIT.u.uTint, tint || [1, 1, 1]); gl.uniform1f(LIT.u.uEmi, emi || 0);
      if (noFog) gl.uniform1f(LIT.u.uFogD, 0);
      gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n);
      if (noFog) gl.uniform1f(LIT.u.uFogD, env.fogD);
    },
    sky(m) { gl.depthMask(false); this.draw(m, M4.trans(cam[0], cam[1] - 40, cam[2]), null, 1, true); gl.depthMask(true); },
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
    end() { gl.disable(gl.SCISSOR_TEST); },
  };
}
