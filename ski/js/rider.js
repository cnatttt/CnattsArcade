// =====================================================================
//  POWDER PEAK - the rider: a small jointed figure posed every frame.
//  Rider space: origin at the feet, +z = the way the board/skis point,
//  +y = up, +x = rider's left. Snowboarders stand sideways (regular).
// =====================================================================
'use strict';
const Rider = (() => {
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  // matrix with columns X, Y, Z and origin O
  function basis(X, Y, Z, O) { const m = new Float32Array(16); m[0] = X[0]; m[1] = X[1]; m[2] = X[2]; m[4] = Y[0]; m[5] = Y[1]; m[6] = Y[2]; m[8] = Z[0]; m[9] = Z[1]; m[10] = Z[2]; m[12] = O[0]; m[13] = O[1]; m[14] = O[2]; m[15] = 1; return m; }
  // unit meshes span y 0..1; seg() stretches one from A to B
  function seg(A, B, rx, rz, side = [1, 0, 0]) {
    const d = V.sub(B, A), L = V.len(d) || 0.001, Y = V.mul(d, 1 / L);
    let X = V.sub(side, V.mul(Y, V.dot(side, Y))); if (V.len(X) < 0.05) X = V.sub([0, 0, 1], V.mul(Y, Y[2])); X = V.norm(X);
    const Z = V.cross(X, Y);
    return basis(V.mul(X, rx), V.mul(Y, L), V.mul(Z, rz), A);
  }
  const at = (p, s) => M4.compose(p[0], p[1], p[2], 0, s, s, s);
  // two-bone IK: joint between A and C, bending toward `pole`
  function ik(A, C, l1, l2, pole) {
    let d = V.sub(C, A), dl = V.len(d); const maxL = (l1 + l2) * 0.999;
    if (dl > maxL) { C = V.add(A, V.mul(d, maxL / dl)); d = V.sub(C, A); dl = maxL; }
    const dir = V.mul(d, 1 / (dl || 1)), a = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl || 1), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    let pp = V.sub(pole, V.mul(dir, V.dot(pole, dir))); pp = V.norm(pp);
    return [V.add(V.add(A, V.mul(dir, a)), V.mul(pp, h)), C];
  }

  // ------------------------------------------------------------ skinned body
  // One continuous mesh for torso, arms and legs, bent by 10 bones every frame (CPU skinning, 2 bones per vertex),
  // so knees, elbows, hips and shoulders fold smoothly instead of being separate tubes and balls.
  const BONES = ['pelvis', 'chest', 'thighL', 'shinL', 'thighR', 'shinR', 'uarmL', 'farmL', 'uarmR', 'farmR'];
  const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));
  const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  function frame(O, Yd, ref) {   // orthonormal frame: Y along the bone, X as close to ref as possible
    const Y = V.norm(Yd); let X = V.sub(ref, V.mul(Y, V.dot(ref, Y)));
    if (V.len(X) < 0.08) { const r2 = Math.abs(Y[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]; X = V.sub(r2, V.mul(Y, V.dot(r2, Y))); }
    X = V.norm(X); return { O, X, Y, Z: V.cross(X, Y) };
  }
  function boneFrames(J) {
    const F = [];
    const pv = V.norm(V.lerp([0, 1, 0], J.up, 0.4));
    F[BI.pelvis] = frame(J.pel, pv, [1, 0, 0]);
    F[BI.chest] = frame(J.pel, J.up, J.tw || [1, 0, 0]);
    F[BI.thighL] = frame(J.HL, V.sub(J.KL, J.HL), [1, 0, 0]); F[BI.shinL] = frame(J.KL, V.sub(J.AL, J.KL), [1, 0, 0]);
    F[BI.thighR] = frame(J.HR, V.sub(J.KR, J.HR), [1, 0, 0]); F[BI.shinR] = frame(J.KR, V.sub(J.AR, J.KR), [1, 0, 0]);
    // arms: twist reference is the plane the elbow bends in, so sleeves don't corkscrew
    const arm = (S, E, Hn, s) => { const n = V.cross(V.sub(E, S), V.sub(Hn, E)); const ref = V.len(n) > 1e-4 ? V.mul(V.norm(n), s) : [0, 0, 1]; return [frame(S, V.sub(E, S), ref), frame(E, V.sub(Hn, E), ref)]; };
    [F[BI.uarmL], F[BI.farmL]] = arm(J.SL, J.EL, J.HnL, 1); [F[BI.uarmR], F[BI.farmR]] = arm(J.SR, J.ER, J.HnR, -1);
    return F;
  }
  // world <- local for a frame, and local coords of a point
  const toLocal = (F, p) => { const d = V.sub(p, F.O); return [V.dot(d, F.X), V.dot(d, F.Y), V.dot(d, F.Z)]; };
  const toLocalN = (F, n) => [V.dot(n, F.X), V.dot(n, F.Y), V.dot(n, F.Z)];

  class SkinB {
    constructor() { this.p = []; this.n = []; this.c = []; this.b = []; this.w = []; this.idx = []; }
    v(p, n, c, b0, b1, w1) { this.p.push(p); this.n.push(n); this.c.push(c); this.b.push([b0, b1]); this.w.push(w1); return this.p.length - 1; }
    // rings: [{ c, X, Z, a, b, wt: [b0, b1, w1], col: (ang, ring) => rgba }]; closed loop of nu around each ring
    sweep(rings, nu) {
      const G = rings.map(r => { const row = []; for (let i = 0; i < nu; i++) { const t = i / nu * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t);
        const k = r.sq ? Math.pow(Math.abs(ca), r.sq) * Math.sign(ca) : ca, l = r.sq ? Math.pow(Math.abs(sa), r.sq) * Math.sign(sa) : sa;
        row.push(V.add(V.add(r.c, V.mul(r.X, k * r.a)), V.mul(r.Z, l * r.b + (r.zo || 0)))); } return row; });
      const base = this.p.length;
      rings.forEach((r, j) => { for (let i = 0; i < nu; i++) {
        const p = G[j][i], du = V.sub(G[j][(i + 1) % nu], G[j][(i + nu - 1) % nu]), dv = V.sub(G[Math.min(rings.length - 1, j + 1)][i], G[Math.max(0, j - 1)][i]);
        let n = V.norm(V.cross(du, dv)); if (V.dot(n, V.sub(p, r.c)) < 0) n = V.mul(n, -1);
        if (V.len(V.cross(du, dv)) < 1e-9) n = V.norm(V.sub(p, r.c));
        this.v(p, n, r.col(i / nu * Math.PI * 2, j), r.wt[0], r.wt[1], r.wt[2]);
      } });
      for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < nu; i++) {
        const a = base + j * nu + i, b = base + j * nu + (i + 1) % nu, c = base + (j + 1) * nu + (i + 1) % nu, d = base + (j + 1) * nu + i;
        this.idx.push(a, b, c, a, c, d);
      }
    }
    // copy a rigid MB piece (bind pose, body space) onto one or two bones
    piece(mb, b0, b1 = b0, w1 = 0) { const d = mb.d; for (let i = 0; i < d.length; i += 10) this.idx.push(this.v([d[i], d[i + 1], d[i + 2]], [d[i + 3], d[i + 4], d[i + 5]], [d[i + 6], d[i + 7], d[i + 8], d[i + 9]], b0, b1, w1)); }
  }

  const BIND = { crouch: 0.2, lean: 0, tuck: 0, arms: 0.35, grab: null, grabK: 0, tweak: 0, tuckLegs: 0, plant: 0, t: 0 };
  function buildSkin(R3, look, J0, Jc, Pc, trim) {
    const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k, c[3] || 0];
    const sk = new SkinB(), J = parts(Object.assign({ board: look.board }, BIND)).J, F = boneFrames(J);
    // --- torso: one sweep from the crotch to the collar; pants below the jacket hem
    const up = J.up, side = V.norm(V.sub([1, 0, 0], V.mul(up, up[0]))), fwd = V.cross(side, up);
    const T = [ // [t along spine, half-width, half-depth, front/back offset, jacket?]
      [-0.175, 0.02, 0.02, 0, 0], [-0.165, 0.09, 0.075, 0, 0], [-0.14, 0.145, 0.11, 0, 0], [-0.1, 0.178, 0.13, 0, 0], [-0.075, 0.183, 0.135, 0, 0],
      [-0.07, 0.212, 0.158, 0.004, 1], [-0.05, 0.214, 0.158, 0.004, 1], [0.03, 0.208, 0.15, 0.006, 1], [0.14, 0.2, 0.142, 0.01, 1], [0.26, 0.205, 0.145, 0.012, 1],
      [0.37, 0.218, 0.15, 0.008, 1], [0.45, 0.222, 0.148, 0.0, 1], [0.51, 0.205, 0.138, -0.008, 1], [0.555, 0.16, 0.12, -0.012, 1], [0.59, 0.105, 0.095, -0.012, 1],
      [0.615, 0.08, 0.078, -0.008, 1], [0.66, 0.072, 0.07, 0, 1]];
    const yoke = [Jc[0] * 0.72 + trim[0] * 0.28, Jc[1] * 0.72 + trim[1] * 0.28, Jc[2] * 0.72 + trim[2] * 0.28, 0];
    const rings = T.map(([t, a, b, zo, jk], j) => ({ c: V.add(J.pel, V.mul(up, t)), X: side, Z: fwd, a, b, zo, sq: 0.85,
      wt: t < 0.5 ? [BI.pelvis, BI.chest, ss(0.06, 0.32, t)] : [BI.chest, BI.chest, 0],
      col: (ang, ring) => {
        if (!jk) return Pc;
        const front = Math.sin(ang), x = Math.cos(ang);
        if (t < -0.04) return shade(Jc, 0.78);                                                             // hem band
        if (t > 0.4 && t < 0.6) return yoke;                                                                // shoulder yoke
        const q = Math.abs(((t + 0.08) * 7.5) % 1 - 0.5) < 0.07 ? 0.9 : 1;                                 // quilting
        return shade(Jc, q * (t > 0.6 ? 0.82 : 1));
      } }));
    sk.sweep(rings, 24);
    // hood rolled up behind the collar, collar ring
    { const mb = new MB(); const hp = V.add(V.add(J.pel, V.mul(up, 0.6)), V.mul(fwd, -0.11));
      mb.ball(M4.compose(hp[0], hp[1], hp[2], 0, 0.27, 0.15, 0.14), 14, 8, shade(Jc, 0.8)); sk.piece(mb, BI.chest); }
    // --- legs: hip -> knee -> ankle, baggy with a cuff over the boot
    const leg = (H, K, A, s, bt, bs) => {
      const d1 = V.sub(K, H), L1 = V.len(d1), d2 = V.sub(A, K), L2 = V.len(d2), Y1 = V.norm(d1), Y2 = V.norm(d2);
      const fr1 = frame(H, Y1, [1, 0, 0]), fr2 = frame(K, Y2, [1, 0, 0]), frK = frame(K, V.norm(V.add(Y1, Y2)), [1, 0, 0]);
      const R = []; const S = [[-0.05, 0.085], [0.0, 0.106], [0.05, 0.115], [0.2, 0.112], [0.36, 0.104], [0.43, 0.1], [0.47, 0.098], [0.51, 0.097], [0.56, 0.096], [0.7, 0.094], [0.8, 0.098], [0.88, 0.108], [0.92, 0.118], [0.97, 0.122], [1.0, 0.12], [1.005, 0.08]];
      for (const [u, r] of S) {   // u: distance along the leg (thigh 0..0.47, shin 0.47..0.94)
        let c, f, wt;
        if (u < L1 - 0.03) { c = V.add(H, V.mul(Y1, u)); f = fr1; wt = u < 0.06 ? [BI.pelvis, bt, ss(-0.12, 0.06, u)] : [bt, bs, ss(L1 - 0.08, L1 + 0.06, u)]; }
        else if (u <= L1 + 0.03) { c = V.add(K, V.mul(frK.Y, u - L1)); f = frK; wt = [bt, bs, ss(L1 - 0.08, L1 + 0.06, u)]; }
        else { c = V.add(K, V.mul(Y2, u - L1)); f = fr2; wt = [bt, bs, ss(L1 - 0.08, L1 + 0.06, u)]; }
        const cuff = u > 0.86, knee = Math.abs(u - L1) < 0.07;
        R.push({ c, X: f.X, Z: f.Z, a: r, b: r * 1.04, zo: knee ? 0.008 : 0, wt, col: ang => cuff ? shade(Pc, 0.72) : knee && Math.sin(ang) > 0.5 ? shade(Pc, 0.88) : (Math.abs(Math.cos(ang) * s + 1) < 0.08 ? shade(Pc, 0.86) : Pc) });
      }
      sk.sweep(R, 18);
    };
    leg(J.HL, J.KL, J.AL, 1, BI.thighL, BI.shinL); leg(J.HR, J.KR, J.AR, -1, BI.thighR, BI.shinR);
    // --- arms: shoulder -> elbow -> wrist, with a round deltoid and a cuff
    const arm = (Sh, E, Hn, s, bu, bf) => {
      const Y1 = V.norm(V.sub(E, Sh)), Y2 = V.norm(V.sub(Hn, E)), L1 = V.len(V.sub(E, Sh)), L2 = V.len(V.sub(Hn, E));
      const fr1 = frame(Sh, Y1, [0, 0, 1]), fr2 = frame(E, Y2, [0, 0, 1]), frE = frame(E, V.norm(V.add(Y1, Y2)), [0, 0, 1]);
      const S = [[-0.07, 0.07], [-0.03, 0.088], [0.02, 0.09], [0.12, 0.084], [0.24, 0.078], [0.29, 0.074], [0.31, 0.072], [0.34, 0.07], [0.45, 0.068], [0.53, 0.07], [0.565, 0.075], [0.585, 0.074], [0.6, 0.05]];
      const R = [];
      for (const [u, r] of S) {
        let c, f;
        if (u < L1 - 0.025) { c = V.add(Sh, V.mul(Y1, u)); f = fr1; } else if (u <= L1 + 0.025) { c = V.add(E, V.mul(frE.Y, u - L1)); f = frE; } else { c = V.add(E, V.mul(Y2, u - L1)); f = fr2; }
        const wt = u < 0.1 ? [BI.chest, bu, ss(-0.07, 0.07, u)] : [bu, bf, ss(L1 - 0.06, L1 + 0.05, u)];
        R.push({ c, X: f.X, Z: f.Z, a: r, b: r, wt, col: () => u > 0.55 ? shade(Jc, 0.7) : u > 0.52 ? trim : u < 0.12 ? yoke : Jc });
      }
      sk.sweep(R, 16);
    };
    arm(J.SL, J.EL, J.HnL, 1, BI.uarmL, BI.farmL); arm(J.SR, J.ER, J.HnR, -1, BI.uarmR, BI.farmR);
    // bake: positions/normals in each bone's local bind space
    const N = sk.p.length, Lp = new Float32Array(N * 6), Ln = new Float32Array(N * 6), Bi = new Uint8Array(N * 2), Wt = new Float32Array(N), out = new Float32Array(N * 10);
    for (let i = 0; i < N; i++) {
      const [b0, b1] = sk.b[i];
      const p0 = toLocal(F[b0], sk.p[i]), p1 = toLocal(F[b1], sk.p[i]), n0 = toLocalN(F[b0], sk.n[i]), n1 = toLocalN(F[b1], sk.n[i]);
      Lp.set(p0, i * 6); Lp.set(p1, i * 6 + 3); Ln.set(n0, i * 6); Ln.set(n1, i * 6 + 3); Bi[i * 2] = b0; Bi[i * 2 + 1] = b1; Wt[i] = sk.w[i];
      const c = sk.c[i]; out[i * 10 + 6] = c[0]; out[i * 10 + 7] = c[1]; out[i * 10 + 8] = c[2]; out[i * 10 + 9] = c[3] || 0;
    }
    const m = R3.dynMesh(N, sk.idx);
    return { m, N, Lp, Ln, Bi, Wt, out, key: '' };
  }
  function skinPose(R3, S, J) {
    const F = boneFrames(J), o = S.out, Lp = S.Lp, Ln = S.Ln;
    for (let i = 0; i < S.N; i++) {
      const w1 = S.Wt[i], w0 = 1 - w1, A = F[S.Bi[i * 2]], B = F[S.Bi[i * 2 + 1]], k = i * 6;
      const ax = Lp[k], ay = Lp[k + 1], az = Lp[k + 2], bx = Lp[k + 3], by = Lp[k + 4], bz = Lp[k + 5];
      const px = (A.O[0] + A.X[0] * ax + A.Y[0] * ay + A.Z[0] * az) * w0 + (B.O[0] + B.X[0] * bx + B.Y[0] * by + B.Z[0] * bz) * w1;
      const py = (A.O[1] + A.X[1] * ax + A.Y[1] * ay + A.Z[1] * az) * w0 + (B.O[1] + B.X[1] * bx + B.Y[1] * by + B.Z[1] * bz) * w1;
      const pz = (A.O[2] + A.X[2] * ax + A.Y[2] * ay + A.Z[2] * az) * w0 + (B.O[2] + B.X[2] * bx + B.Y[2] * by + B.Z[2] * bz) * w1;
      const nax = Ln[k], nay = Ln[k + 1], naz = Ln[k + 2], nbx = Ln[k + 3], nby = Ln[k + 4], nbz = Ln[k + 5];
      let nx = (A.X[0] * nax + A.Y[0] * nay + A.Z[0] * naz) * w0 + (B.X[0] * nbx + B.Y[0] * nby + B.Z[0] * nbz) * w1;
      let ny = (A.X[1] * nax + A.Y[1] * nay + A.Z[1] * naz) * w0 + (B.X[1] * nbx + B.Y[1] * nby + B.Z[1] * nbz) * w1;
      let nz = (A.X[2] * nax + A.Y[2] * nay + A.Z[2] * naz) * w0 + (B.X[2] * nbx + B.Y[2] * nby + B.Z[2] * nbz) * w1;
      const l = Math.hypot(nx, ny, nz) || 1, q = i * 10;
      o[q] = px; o[q + 1] = py; o[q + 2] = pz; o[q + 3] = nx / l; o[q + 4] = ny / l; o[q + 5] = nz / l;
    }
    R3.updateDyn(S.m, o);
  }

  function build(R3, look, old) {
    if (old) for (const k in old) { if (k === 'skin') R3.free(old.skin.m); else R3.free(old[k]); }
    const M = {};
    const J = col4(look.jacket), P = col4(look.pants), H = col4(look.helmet), dark = [0.07, 0.07, 0.09, 0], skin = [0.93, 0.76, 0.63, 0];
    const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k, c[3] || 0];
    const lightJ = (J[0] + J[1] + J[2]) / 3 > 0.75, trim = lightJ ? [0.16, 0.18, 0.24, 0] : [0.94, 0.95, 0.97, 0];
    const mesh = fn => { const mb = new MB(); fn(mb); return R3.mesh(mb); };
    // mittens with a thumb
    M.glove = mesh(mb => { mb.ball(M4.compose(0, 0, 0.05, 0, 0.9, 0.8, 1.15), 12, 9, dark); mb.ball(M4.compose(0.38, 0.1, 0.12, 0, 0.36, 0.36, 0.5), 8, 6, dark); mb.lathe(M4.compose(0, 0, -0.42, 0, 1, 1, 1, Math.PI / 2), [[-0.2, 0.5], [0.2, 0.52]], 12, 2, trim); });
    // ski boots: rounded shell with a cuff and buckles
    M.boot = mesh(mb => {
      mb.rbox(M4.compose(0, 0.07, 0.05, 0, 0.17, 0.12, 0.31), 16, 10, dark, 0.35);
      mb.rbox(M4.compose(0, 0.19, -0.01, 0, 0.16, 0.2, 0.19), 16, 10, [0.22, 0.23, 0.27, 0], 0.4);
      [0.13, 0.2].forEach(y => mb.rbox(M4.compose(0, y, 0.085, 0, 0.13, 0.025, 0.03), 8, 4, [0.6, 0.62, 0.68, 0], 0.4));
    });
    M.skin = buildSkin(R3, look, null, J, P, trim);
    // head: face, smooth helmet with a ridge, wrap-round goggles and strap
    M.head = mesh(mb => {
      mb.ball(M4.compose(0, 0.12, 0.015, 0, 0.19, 0.23, 0.2), 14, 10, skin);
      mb.ball(M4.compose(0, 0.18, -0.008, 0, 0.27, 0.255, 0.29), 18, 12, H);
      // goggles: a curved band hugging the face
      const R = 0.135, a0 = -1.15, a1 = 1.15;
      mb.surf(M4.ident(), (u, v) => { const a = a0 + (a1 - a0) * u, y = 0.135 + (v - 0.5) * 0.085, r = R + 0.012 * Math.cos(v * Math.PI); return [Math.sin(a) * r * 1.05, y, Math.cos(a) * r + 0.018]; }, 16, 4,
        (u, v) => { const g = 0.25 + 0.75 * v; return [0.98 * g + 0.2, 0.45 * g + 0.15, 0.85 - 0.5 * g, 0.3]; }, [0, 0.135, 0]);
      mb.surf(M4.ident(), (u, v) => { const a = -Math.PI + 2 * Math.PI * u, y = 0.135 + (v - 0.5) * 0.04, r = 0.147; return [Math.sin(a) * r * 1.03, y, Math.cos(a) * r]; }, 22, 2, dark, [0, 0.135, 0]);
      mb.lathe(M4.compose(0, -0.04, 0.0), [[0, 0.085], [0.05, 0.08], [0.1, 0.075]], 14, 3, shade(J, 0.7));   // neck gaiter
    });
    // a snowboard: rounded outline with sidecut, kicked-up nose and tail, two-tone top sheet
    if (look.board) {
      const deck = col4(look.deck || '#0f172a'), accent = [J[0], J[1], J[2], 0.08];
      // build board + bindings into one mesh
      M.board = (() => {
        const mb = new MB();
        mb.surf(M4.ident(), (u, v) => {
          const zn = u * 2 - 1, z = zn * 0.78, end = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(zn), 9)), 1 / 9);
          const w = (0.155 - 0.012 * Math.cos(zn * Math.PI / 2)) * end, rise = 0.07 * Math.pow(clamp((Math.abs(zn) - 0.74) / 0.26, 0, 1), 2);
          const a = v * Math.PI * 2; return [Math.cos(a) * w, 0.016 + rise + Math.sin(a) * 0.012, z];
        }, 44, 12, (u, v, p) => { const zn = u * 2 - 1; if (Math.sin(v * Math.PI * 2) < 0) return [0.92, 0.93, 0.96, 0]; if (Math.abs(Math.abs(zn) - 0.56) < 0.05 || Math.abs(p[0]) < 0.025 && Math.abs(zn) < 0.5) return accent; return deck; }, [0, 0.016, 0]);
        [-0.27, 0.27].forEach(z => {
          mb.rbox(M4.compose(0, 0.04, z, 0, 0.27, 0.02, 0.14), 12, 4, dark, 0.3);                        // base plate
          mb.surf(M4.compose(0, 0.04, z), (u, v) => { const a = (u - 0.5) * 2.4; return [-0.08 - 0.02 * v + Math.cos(a) * 0.02, v * 0.17, Math.sin(a) * 0.07]; }, 10, 5, dark, [0.05, 0.08, 0]);   // highback
          mb.rbox(M4.compose(0.02, 0.11, z, 0, 0.12, 0.035, 0.16), 10, 4, shade(trim, 0.85), 0.45);        // strap
        });
        return R3.mesh(mb);
      })();
    } else {
      const c = col4(look.deck || '#0f172a'), a = [J[0], J[1], J[2], 0.08];
      M.ski = mesh(mb => {
        mb.surf(M4.ident(), (u, v) => {
          const zn = u * 2 - 1, z = zn * 0.86, end = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(zn), 6)), 1 / 6);
          const w = (0.046 - 0.006 * Math.cos(zn * Math.PI / 2)) * end, rise = (zn > 0 ? 0.12 : 0.085) * Math.pow(clamp((Math.abs(zn) - 0.8) / 0.2, 0, 1), 2);
          const an = v * Math.PI * 2; return [Math.cos(an) * w, 0.012 + rise + Math.sin(an) * 0.009, z];
        }, 40, 10, (u, v, p) => { const zn = u * 2 - 1; if (Math.sin(v * Math.PI * 2) < 0) return [0.9, 0.91, 0.95, 0]; return zn > 0.25 && zn < 0.65 ? a : c; }, [0, 0.012, 0]);
        mb.rbox(M4.compose(0, 0.04, 0.12, 0, 0.07, 0.04, 0.12), 10, 4, [0.6, 0.62, 0.68, 0], 0.4);     // toe piece
        mb.rbox(M4.compose(0, 0.045, -0.16, 0, 0.07, 0.05, 0.1), 10, 4, [0.6, 0.62, 0.68, 0], 0.4);    // heel piece
      });
      M.pole = mesh(pm => {
        pm.tube(M4.compose(0, 0.5, 0, 0, 0.022, 1, 0.022), 8, [0.78, 0.8, 0.85, 0]);
        pm.lathe(M4.compose(0, -0.02, 0), [[0.0, 0.016], [0.1, 0.03], [0.18, 0.028], [0.2, 0.0]], 10, 4, dark);                     // grip
        pm.lathe(M4.compose(0, 0.92, 0), [[-0.01, 0.06], [0.01, 0.065], [0.02, 0.0]], 14, 2, dark);                                 // basket
      });
    }
    return M;
  }

  // grab targets (in body space, relative to the ankle height)
  const GRABS_BOARD = { indy: { hand: 'R', p: [0, 0, 0.14] }, melon: { hand: 'L', p: [0.05, 0, -0.15] }, nose: { hand: 'L', p: [0.7, 0, 0] }, tail: { hand: 'R', p: [-0.7, 0, 0] } };
  const GRABS_SKI = { mute: { hand: 'L', p: [-0.13, 0, 0.42] }, safety: { hand: 'R', p: [-0.2, 0, 0] }, tail: { hand: 'R', p: [-0.13, 0, -0.6] }, japan: { hand: 'L', p: [0.16, 0, -0.32] } };

  // st: { board, crouch 0..1, lean (-1..1 sideways), tuck 0..1, arms 0 (relaxed) .. 1 (out), grab name|null, grabK 0..1, plant (pole plant 0..1), t }
  function parts(st) {
    const out = [], c = st.crouch, g = st.grabK || 0;
    const B = st.board;
    const lift = g * 0.34 + (st.tuckLegs || 0) * 0.2;
    // ankles
    const fw = B ? 0.27 : 0.12;
    const AL = [fw, 0.11 + lift, 0], AR = [-fw, 0.11 + lift, 0];
    // hips
    const hipY = 0.98 - 0.36 * c - 0.1 * st.tuck - 0.12 * g, hipZ = -0.06 - 0.12 * c - 0.05 * st.tuck;
    const lean = st.lean * 0.12;
    const HL = [0.11 + lean, hipY, hipZ], HR = [-0.11 + lean, hipY, hipZ];
    const pole = [0, 0.2, 1];
    const [KL] = ik(HL, AL, 0.47, 0.47, pole), [KR] = ik(HR, AR, 0.47, 0.47, pole);
    const AL2 = ik(HL, AL, 0.47, 0.47, pole)[1], AR2 = ik(HR, AR, 0.47, 0.47, pole)[1];
    out.push(['boot', M4.trans(AL2[0], AL2[1] - 0.11, AL2[2])], ['boot', M4.trans(AR2[0], AR2[1] - 0.11, AR2[2])]);
    // pelvis + torso
    const pel = [lean, hipY + 0.02, hipZ];
    const fwdLean = 0.18 + 0.55 * c + 0.45 * st.tuck + 0.25 * g;
    const up = [st.lean * 0.18, Math.cos(fwdLean), Math.sin(fwdLean)];
    const chest = V.add(pel, V.mul(V.norm(up), 0.56));
    // upper-body twist (wind-up before spins, leading into the rotation, counter-rotating in carves)
    const tw = st.twist || 0, ct = Math.cos(tw), stw = Math.sin(tw), rot = v => [v[0] * ct + v[2] * stw, v[1], -v[0] * stw + v[2] * ct], sideT = rot([1, 0, 0]);
    const head = V.add(chest, V.mul(V.norm(V.add(up, [0, 0.6, -0.15])), 0.06));
    out.push(['head', seg(head, V.add(head, V.mul(V.norm(V.add(up, [0, 0.5, -0.1])), 1)), 1, 1, sideT)]);
    // arms
    const sh = s => V.add(chest, rot([s * 0.22, -0.06, -0.02]));
    const SL = sh(1), SR = sh(-1);
    const a = st.arms || 0, sw = Math.sin((st.t || 0) * 2) * 0.03;
    const relaxed = s => V.add(pel, rot([s * (0.36 + 0.3 * a), 0.12 + 0.28 * a + sw * s, 0.32 - 0.22 * a]));
    const tuck = s => V.add(pel, rot([s * 0.14, 0.14, 0.5]));
    let HnL = V.lerp(relaxed(1), tuck(1), st.tuck), HnR = V.lerp(relaxed(-1), tuck(-1), st.tuck);
    if (st.grab) {
      const G = (B ? GRABS_BOARD : GRABS_SKI)[st.grab];
      if (G) { const tgt = [G.p[0], AL2[1] - 0.04 + G.p[1], G.p[2]]; if (G.hand === 'L') HnL = V.lerp(HnL, tgt, g); else HnR = V.lerp(HnR, tgt, g); }
    }
    const elbowPole = s => rot([s * 1, -0.6, -0.5]);
    const [EL, HnL2] = ik(SL, HnL, 0.31, 0.3, elbowPole(1)), [ER, HnR2] = ik(SR, HnR, 0.31, 0.3, elbowPole(-1));
    // mittens point along the forearm
    const glove = (E, Hn, s) => { const Z = V.norm(V.sub(Hn, E)); let X = V.sub([s, 0, 0], V.mul(Z, Z[0] * s)); if (V.len(X) < 0.1) X = [0, 1, 0]; X = V.norm(X); const Y = V.cross(Z, X); return basis(V.mul(X, 0.12 * s), V.mul(Y, 0.12), V.mul(Z, 0.12), V.add(Hn, V.mul(Z, 0.02))); };
    out.push(['glove', glove(EL, HnL2, 1)], ['glove', glove(ER, HnR2, -1)]);
    out.J = { tw: sideT, pel, chest, up: V.norm(up), HL, KL, AL: AL2, HR, KR, AR: AR2, SL, EL, HnL: HnL2, SR, ER, HnR: HnR2 };
    // board / skis + poles
    if (B) {
      const tw = st.tweak || 0;
      out.push(['board', M4.mul(M4.trans(0, lift, 0), M4.rotZ(tw * 0.35))]);
    } else {
      const cross = st.grab === 'japan' || st.grab === 'mute' ? 0.32 * g : 0;
      out.push(['ski', M4.mul(M4.trans(AL2[0], lift, 0), M4.rotY(cross))], ['ski', M4.mul(M4.trans(AR2[0], lift, 0), M4.rotY(-cross))]);
      const pl = st.plant || 0;
      [[HnL2, 1], [HnR2, -1]].forEach(([h, s]) => {
        if (st.grab && (st.grab && ((GRABS_SKI[st.grab] || {}).hand === (s > 0 ? 'L' : 'R')))) { out.push(['pole', seg(h, V.add(h, [s * 0.15, -0.3, -1.0]), 1, 1)]); return; }
        const tip = V.add(h, [s * (0.12 + 0.15 * a), -1.05 + 0.25 * a, -0.25 - 0.45 * st.tuck + 0.35 * pl]);
        out.push(['pole', seg(h, tip, 1, 1)]);
      });
    }
    return out;
  }
  function draw(R3, M, root, st, shadow, spec) {
    const body = st.board ? M4.rotY(-Math.PI / 2) : null;
    const base = body ? M4.mul(root, body) : root;
    const list = parts(st);
    if (M.skin) {
      const key = [st.twist, st.crouch, st.lean, st.tuck, st.arms, st.grab, st.grabK, st.tweak, st.tuckLegs, st.plant, st.t].join();
      if (key !== M.skin.key) { skinPose(R3, M.skin, list.J); M.skin.key = key; }
      if (shadow) R3.shadowDraw(M.skin.m, base); else R3.draw(M.skin.m, base, null, 0, false, { spec: (spec || 0) * 0.6 });
    }
    for (const [k, L] of list) {
      const m = M[k]; if (!m) continue;
      // board/skis are placed in rider space, everything else in body space
      const W = (k === 'board') ? M4.mul(root, L) : M4.mul(base, L);
      if (shadow) R3.shadowDraw(m, W); else R3.draw(m, W, null, 0, false, { spec: k === 'head' || k === 'board' || k === 'ski' ? 0.7 : spec });
    }
  }
  return { build, draw, parts, GRABS_BOARD, GRABS_SKI };
})();
