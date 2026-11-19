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

  function build(R3, look, old) {
    if (old) for (const k in old) R3.free(old[k]);
    const M = {};
    const J = col4(look.jacket), P = col4(look.pants), H = col4(look.helmet), dark = [0.07, 0.07, 0.09, 0], skin = [0.93, 0.76, 0.63, 0];
    const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k, c[3] || 0];
    const lightJ = (J[0] + J[1] + J[2]) / 3 > 0.75, trim = lightJ ? [0.16, 0.18, 0.24, 0] : [0.94, 0.95, 0.97, 0];
    const mesh = fn => { const mb = new MB(); fn(mb); return R3.mesh(mb); };
    // limbs: tapered, slightly baggy tubes (unit length along y, radius ~0.5) - puffy sleeves and pants with a cuff
    M.limbJ = mesh(mb => mb.lathe(M4.ident(), [[-0.02, 0.44], [0.1, 0.5], [0.5, 0.52], [0.86, 0.47], [1.02, 0.4]], 14, 8, (u, v) => v < 0.12 ? shade(J, 0.82) : J));
    M.limbP = mesh(mb => mb.lathe(M4.ident(), [[-0.02, 0.42], [0.12, 0.5], [0.5, 0.55], [0.85, 0.52], [1.02, 0.46]], 14, 8, (u, v) => v < 0.1 ? shade(P, 0.8) : P));
    M.jointJ = mesh(mb => mb.ball(M4.ident(), 14, 10, J));
    M.jointP = mesh(mb => mb.ball(M4.ident(), 14, 10, P));
    // mittens with a thumb
    M.glove = mesh(mb => { mb.ball(M4.compose(0, 0, 0.05, 0, 0.9, 0.8, 1.15), 12, 9, dark); mb.ball(M4.compose(0.38, 0.1, 0.12, 0, 0.36, 0.36, 0.5), 8, 6, dark); mb.lathe(M4.compose(0, 0, -0.42, 0, 1, 1, 1, Math.PI / 2), [[-0.2, 0.5], [0.2, 0.52]], 12, 2, trim); });
    // ski boots: rounded shell with a cuff and buckles
    M.boot = mesh(mb => {
      mb.rbox(M4.compose(0, 0.07, 0.05, 0, 0.17, 0.12, 0.31), 16, 10, dark, 0.35);
      mb.rbox(M4.compose(0, 0.19, -0.01, 0, 0.16, 0.2, 0.19), 16, 10, [0.22, 0.23, 0.27, 0], 0.4);
      [0.13, 0.2].forEach(y => mb.rbox(M4.compose(0, y, 0.085, 0, 0.13, 0.025, 0.03), 8, 4, [0.6, 0.62, 0.68, 0], 0.4));
    });
    // torso: a puffy jacket, oval section, zip down the front, darker hem and a collar
    M.torso = mesh(mb => {
      const prof = [[-0.06, 0.15], [0.02, 0.172], [0.25, 0.17], [0.5, 0.186], [0.72, 0.2], [0.86, 0.205], [0.95, 0.18], [1.02, 0.1]];
      mb.lathe(M4.ident(), prof, 22, 14, (u, v, p) => {
        if (Math.abs(p[0]) < 0.012 && p[2] > 0) return trim;            // zip
        if (v < 0.1) return shade(J, 0.75);                               // hem
        const band = Math.abs(((v * 6) % 1) - 0.5) < 0.06 ? 0.9 : 1;     // quilted puffer lines
        return shade(J, band);
      }, 0.72);
      mb.lathe(M4.compose(0, 0.95, -0.005, 0, 1, 1, 0.85), [[-0.02, 0.105], [0.08, 0.1], [0.14, 0.085]], 16, 3, shade(J, 0.7));   // collar
      mb.ball(M4.compose(0, 0.86, -0.12, 0, 0.26, 0.17, 0.13), 12, 8, shade(J, 0.85));                                            // hood bunched at the back
      mb.rbox(M4.compose(0.1, 0.62, 0.115, 0, 0.07, 0.07, 0.02), 8, 4, shade(trim, 0.8), 0.5);                                     // chest pocket / pass
    });
    // pelvis: rounded, with a belt line
    M.pelvis = mesh(mb => mb.ball(M4.compose(0, 0.5, 0, 0, 1, 1.05, 1), 16, 10, P));
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
    out.push(['limbP', seg(HL, KL, 0.17, 0.17)], ['limbP', seg(KL, AL2, 0.14, 0.14)], ['limbP', seg(HR, KR, 0.17, 0.17)], ['limbP', seg(KR, AR2, 0.14, 0.14)]);
    out.push(['jointP', at(KL, 0.16)], ['jointP', at(KR, 0.16)]);
    out.push(['boot', M4.trans(AL2[0], AL2[1] - 0.11, AL2[2])], ['boot', M4.trans(AR2[0], AR2[1] - 0.11, AR2[2])]);
    // pelvis + torso
    const pel = [lean, hipY + 0.02, hipZ];
    const fwdLean = 0.18 + 0.55 * c + 0.45 * st.tuck + 0.25 * g;
    const up = [st.lean * 0.18, Math.cos(fwdLean), Math.sin(fwdLean)];
    const chest = V.add(pel, V.mul(V.norm(up), 0.56));
    out.push(['pelvis', seg(V.add(pel, [0, -0.08, 0]), V.add(pel, [0, 0.1, 0]), 0.34, 0.24)]);
    out.push(['torso', seg(pel, chest, 1, 1)]);
    const head = V.add(chest, V.mul(V.norm(V.add(up, [0, 0.6, -0.15])), 0.06));
    out.push(['head', seg(head, V.add(head, V.mul(V.norm(V.add(up, [0, 0.5, -0.1])), 1)), 1, 1)]);
    // arms
    const sh = s => V.add(chest, [s * 0.22, -0.06, -0.02]);
    const SL = sh(1), SR = sh(-1);
    const a = st.arms || 0, sw = Math.sin((st.t || 0) * 2) * 0.03;
    const relaxed = s => V.add(pel, [s * (0.36 + 0.3 * a), 0.12 + 0.28 * a + sw * s, 0.32 - 0.22 * a]);
    const tuck = s => V.add(pel, [s * 0.14, 0.14, 0.5]);
    let HnL = V.lerp(relaxed(1), tuck(1), st.tuck), HnR = V.lerp(relaxed(-1), tuck(-1), st.tuck);
    if (st.grab) {
      const G = (B ? GRABS_BOARD : GRABS_SKI)[st.grab];
      if (G) { const tgt = [G.p[0], AL2[1] - 0.04 + G.p[1], G.p[2]]; if (G.hand === 'L') HnL = V.lerp(HnL, tgt, g); else HnR = V.lerp(HnR, tgt, g); }
    }
    const elbowPole = s => [s * 1, -0.6, -0.5];
    const [EL, HnL2] = ik(SL, HnL, 0.31, 0.3, elbowPole(1)), [ER, HnR2] = ik(SR, HnR, 0.31, 0.3, elbowPole(-1));
    out.push(['limbJ', seg(SL, EL, 0.13, 0.13)], ['limbJ', seg(EL, HnL2, 0.11, 0.11)], ['limbJ', seg(SR, ER, 0.13, 0.13)], ['limbJ', seg(ER, HnR2, 0.11, 0.11)]);
    out.push(['jointJ', at(SL, 0.17)], ['jointJ', at(SR, 0.17)], ['jointJ', at(EL, 0.12)], ['jointJ', at(ER, 0.12)], ['glove', at(HnL2, 0.12)], ['glove', at(HnR2, 0.12)]);
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
    for (const [k, L] of parts(st)) {
      const m = M[k]; if (!m) continue;
      // board/skis are placed in rider space, everything else in body space
      const W = (k === 'board') ? M4.mul(root, L) : M4.mul(base, L);
      if (shadow) R3.shadowDraw(m, W); else R3.draw(m, W, null, 0, false, { spec: k === 'head' || k === 'board' || k === 'ski' ? 0.7 : spec });
    }
  }
  return { build, draw, parts, GRABS_BOARD, GRABS_SKI };
})();
