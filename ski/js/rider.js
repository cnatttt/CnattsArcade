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
    const J = col4(look.jacket), P = col4(look.pants), H = col4(look.helmet), dark = [0.1, 0.1, 0.13, 0], skin = [0.93, 0.76, 0.63, 0];
    const tubeM = (c, cap) => { const mb = new MB(); mb.tube(M4.compose(0, 0.5, 0), 10, c, cap || c); return R3.mesh(mb); };
    const ballM = c => { const mb = new MB(); mb.ball(M4.ident(), 10, 7, c); return R3.mesh(mb); };
    M.limbJ = tubeM(J); M.limbP = tubeM(P); M.jointJ = ballM(J); M.jointP = ballM(P); M.glove = ballM(dark);
    { const mb = new MB(); mb.box(M4.compose(0, 0.11, 0.04, 0, 0.17, 0.22, 0.3), dark); mb.box(M4.compose(0, 0.22, -0.02, 0, 0.18, 0.04, 0.2), col4(look.jacket === '#111827' ? '#f8fafc' : '#1f2937')); M.boot = R3.mesh(mb); }
    { // torso: tapered jacket with a zip stripe and a collar
      const mb = new MB();
      mb.taper(M4.compose(0, 0, 0, 0, 0.36, 1, 0.24), 1.18, 1.0, J);
      mb.box(M4.compose(0, 0.55, 0.125, 0, 0.03, 0.9, 0.01), [0.95, 0.95, 0.97, 0]);
      mb.box(M4.compose(0, 0.95, 0, 0, 0.28, 0.16, 0.24), col4(look.jacket === '#111827' ? '#334155' : '#111827'));
      M.torso = R3.mesh(mb);
    }
    { const mb = new MB(); mb.box(M4.compose(0, 0.5, 0, 0, 1, 1, 1), P); M.pelvis = R3.mesh(mb); }
    { // head: face, helmet, goggles
      const mb = new MB();
      mb.ball(M4.compose(0, 0.13, 0.01, 0, 0.21, 0.25, 0.22), 10, 8, skin);
      mb.ball(M4.compose(0, 0.18, -0.005, 0, 0.27, 0.25, 0.28), 12, 8, H);
      mb.box(M4.compose(0, 0.165, 0.115, 0, 0.25, 0.085, 0.05), [0.98, 0.55, 0.12, 0.25]);
      mb.box(M4.compose(0, 0.165, 0.09, 0, 0.28, 0.035, 0.07), dark);
      mb.ball(M4.compose(0, 0.02, 0.0, 0, 0.2, 0.08, 0.2), 8, 5, dark);
      M.head = R3.mesh(mb);
    }
    if (look.board) { // snowboard along z with a two-tone top
      const mb = new MB(), deck = col4(look.deck || '#0f172a'), accent = col4(look.jacket);
      mb.box(M4.compose(0, 0.025, 0, 0, 0.29, 0.03, 1.2), deck);
      [-1, 1].forEach(s => { mb.cyl(M4.compose(0, 0.025, s * 0.6, 0, 0.29, 0.03, 0.3), 12, deck); mb.box(M4.mul(M4.compose(0, 0.055, s * 0.77, 0), M4.mul(M4.rotX(-s * 0.35), M4.scale(0.27, 0.025, 0.14))), deck); });
      mb.box(M4.compose(0, 0.042, 0, 0, 0.2, 0.005, 1.0), [...accent.slice(0, 3), 0.1]);
      mb.box(M4.compose(0, 0.003, 0, 0, 0.3, 0.008, 1.5), [0.9, 0.92, 0.95, 0]);
      [-0.27, 0.27].forEach(z => mb.box(M4.compose(0, 0.08, z, 0, 0.22, 0.08, 0.14), dark));
      M.board = R3.mesh(mb);
    } else {
      const mb = new MB(), c = col4(look.deck || '#0f172a'), a = col4(look.jacket);
      mb.box(M4.compose(0, 0.02, 0, 0, 0.09, 0.025, 1.6), c);
      mb.box(M4.mul(M4.compose(0, 0.05, 0.86, 0), M4.mul(M4.rotX(-0.45), M4.scale(0.09, 0.025, 0.2))), c);
      mb.box(M4.mul(M4.compose(0, 0.035, -0.84, 0), M4.mul(M4.rotX(0.25), M4.scale(0.09, 0.025, 0.12))), c);
      mb.box(M4.compose(0, 0.035, 0.35, 0, 0.07, 0.005, 0.5), [...a.slice(0, 3), 0.1]);
      mb.box(M4.compose(0, 0.06, 0.02, 0, 0.1, 0.06, 0.24), [0.6, 0.62, 0.68, 0]);
      M.ski = R3.mesh(mb);
      const pm = new MB(); pm.tube(M4.compose(0, 0.5, 0, 0, 0.025, 1, 0.025), 5, [0.75, 0.77, 0.82, 0]); pm.cyl(M4.compose(0, 0.08, 0, 0, 0.12, 0.015, 0.12), 8, dark); M.pole = R3.mesh(pm);
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
    const head = V.add(chest, V.mul(V.norm(V.add(up, [0, 0.6, -0.15])), 0.1));
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
