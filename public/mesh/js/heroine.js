// The heroine's rig: skeleton solve (FK + 2-bone IK), linear-blend skinning of the painted
// parts, Live2D-style face deformers, and spring-chain hair.
import { M, clamp, lerp, smooth } from './draw.js';
import { derive, torsoWidth, armWidth, legWidth } from './look.js';

const ARM_U = 165, ARM_L = 150, LEG_T = 210, LEG_S = 200;
// shader materials (sss = wrap/subsurface, spec/gloss, aniso = strand highlight along the texture's v axis)
export const MAT = {
  skin: { sss: 1, spec: 0.1, gloss: 22, rim: 1 },
  satin: { sss: 0, spec: 0.75, gloss: 20, rim: 0.8 },
  legging: { sss: 0, spec: 0.5, gloss: 16, rim: 0.7 },
  hair: { sss: 0.1, spec: 0.3, gloss: 10, rim: 1.0, nrmStr: 1.0 },
  leather: { sss: 0, spec: 0.25, gloss: 12, rim: 0.6 },
  flat: { sss: 0.4, spec: 0, rim: 0, nrm: false },
  eye: { sss: 0, spec: 0, rim: 0, nrm: false, mix: 0.5 },
  prop: { sss: 0, spec: 0.3, gloss: 24, rim: 0.6 },
};
const SHOULDER = [[-104, -278], [104, -278]];     // [near(screen-left), far(screen-right)] in pelvis-local cu
const HIP = [[-44, 12], [44, 12]];
export const PELVIS_Y = -450;

// ---------------------------------------------------------------- pose defaults
export function basePose() {
  return {
    root: { x: 0, y: 0, s: 1, flip: 1 },
    pelvis: { x: 0, y: PELVIS_Y, rot: 0 }, chestRot: 0, breath: 0, lean: 0,
    shrug: [0, 0], neckRot: 0,
    head: { rot: 0, turn: 0.12, nod: 0, scale: 1.22, sx: 1 },
    gaze: [0, 0],
    face: {
      brow: [{ y: 0, inner: 0, outer: 0 }, { y: 0, inner: 0, outer: 0 }],          // [left(screen), right]
      lid: [{ open: 1, squint: 0, happy: 0 }, { open: 1, squint: 0, happy: 0 }],
      mouth: { open: 0, wide: 0, round: 0, smile: 0.15, smirk: 0, teeth: 0, press: 0, fv: 0 },
      blush: 0.55, cheek: 0,
    },
    // arms: target = wrist position in chest space (pelvis-local coords), bend = elbow side (+1 out/down)
    arms: [
      { target: [-104, 30], bend: -1, hand: 'handRelax', handRot: 0, prop: null, front: false, handScale: 1 },
      { target: [104, 30], bend: 1, hand: 'handRelax', handRot: 0, prop: null, front: false, handScale: 1 },
    ],
    // legs: ankle target in character space (origin ground), footRot
    legs: [{ ankle: [-30, -50], footRot: 0, show: true }, { ankle: [34, -50], footRot: 0, show: true }],
    gear: { backpack: false, boots: false },
    wet: 0, tint: [1, 1, 1], add: [0, 0, 0], rim: 0,
    handOverFace: false,
  };
}

// broad frames: the shoulder line slopes down from the neck as the shoulders widen (scaling x alone
// would stretch the painted shoulder top into a flat shelf)
export const shoulderDrop = (D) => Math.max(0, (D.shoulders ?? 1) - 1.2) * 60;

// ---------------------------------------------------------------- solve
function ik2(sx, sy, tx, ty, a, b, bend) {
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
  const dm = Math.min(d, a + b - 0.01); if (d < 1e-3) { dx = 0; dy = 1; d = 1; }
  const base = Math.atan2(dy, dx);
  const cosA = clamp((a * a + dm * dm - b * b) / (2 * a * dm), -1, 1);
  const A = Math.acos(cosA) * bend;
  const a1 = base - A;
  const ex = sx + Math.cos(a1) * a, ey = sy + Math.sin(a1) * a;
  const wx = sx + Math.cos(base) * dm, wy = sy + Math.sin(base) * dm;
  const a2 = Math.atan2(wy - ey, wx - ex);
  return { a1, a2, e: [ex, ey], w: [wx, wy] };
}
export function solve(p) {
  const S = {};
  // optional creator look: bone lengths, torso height/width, head size (identity when p.look is unset)
  const D = S.D = derive(p.look);
  const armU = D ? D.armU : ARM_U, armL = D ? D.armL : ARM_L, legT = D ? D.legT : LEG_T, legS = D ? D.legS : LEG_S;
  const th = D ? D.torsoH : 1, sw = D ? D.shoulders : 1, hw = D ? D.hips : 1, hm = D ? D.head : 1;
  S.dim = { armU, armL, legT, legS, th };
  S.root = M.trs(p.root.x, p.root.y, 0, p.root.s * p.root.flip, p.root.s);
  S.pel = M.mul(S.root, M.trs(p.pelvis.x, p.pelvis.y, p.pelvis.rot));
  const br = p.breath;
  S.chest = M.mul(S.pel, M.mul(M.tr(0, -110 * th), M.mul(M.rot(p.chestRot), M.mul(M.sc(1 + br * 0.008, 1 + br * 0.012), M.tr(0, 110 * th)))));
  S.neck = M.mul(S.chest, M.mul(M.tr(0, -330 * th), M.mul(M.rot(p.neckRot + p.head.rot * 0.35), M.tr(0, 330 * th))));
  S.head = M.mul(S.chest, M.mul(M.tr(0, -398 * th - (D ? D.neckLift : 0)), M.mul(M.rot(p.head.rot), M.mul(M.tr(0, -100 * hm), M.sc(p.head.scale * hm * (p.head.sx || 1), p.head.scale * hm)))));
  // arms in chest space
  S.arms = p.arms.map((a, i) => {
    const sh = [SHOULDER[i][0] * sw, SHOULDER[i][1] * th - p.shrug[i] * 18 + (D ? shoulderDrop(D) : 0)];
    let tgt = a.target;
    if (a.world) { const inv = M.inv(S.chest); tgt = M.ap(inv, a.world[0], a.world[1]); }
    // elbow side: whichever IK solution lands nearer the pole (default: down and out)
    const pole = a.pole || [i ? 200 : -200, sh[1] + 260];
    const r1 = ik2(sh[0], sh[1], tgt[0], tgt[1], armU, armL, 1), r2 = ik2(sh[0], sh[1], tgt[0], tgt[1], armU, armL, -1);
    const d1 = Math.hypot(r1.e[0] - pole[0], r1.e[1] - pole[1]), d2 = Math.hypot(r2.e[0] - pole[0], r2.e[1] - pole[1]);
    const r = d1 < d2 ? r1 : r2;
    const up = M.mul(S.chest, M.trs(sh[0], sh[1], r.a1 - Math.PI / 2));
    const lo = M.mul(S.chest, M.trs(r.e[0], r.e[1], r.a2 - Math.PI / 2));
    const hk = a.handScale * (D ? D.hand : 1);
    const hand = M.mul(S.chest, M.trs(r.w[0], r.w[1], r.a2 - Math.PI / 2 + a.handRot, hk * (i ? -1 : 1), hk));
    return { up, lo, hand, sh, r };
  });
  // legs: targets in character space -> pelvis-local
  const pelLocal = M.trs(p.pelvis.x, p.pelvis.y, p.pelvis.rot), inv = M.inv(pelLocal);
  S.legs = p.legs.map((l, i) => {
    const t = M.ap(inv, l.ankle[0], l.ankle[1]), h = [HIP[i][0] * hw, HIP[i][1]];
    const r = ik2(h[0], h[1], t[0], t[1], legT, legS, 1); // knees forward (+x)
    const th = M.mul(S.pel, M.trs(h[0], h[1], r.a1 - Math.PI / 2));
    const sn = M.mul(S.pel, M.trs(r.e[0], r.e[1], r.a2 - Math.PI / 2));
    const foot = M.mul(S.root, M.trs(l.ankle[0], l.ankle[1], l.footRot));
    return { th, sn, foot, h };
  });
  return S;
}

// ---------------------------------------------------------------- face deformer
// face-local (x,y) on a head-sized ellipsoid; turn/nod slide features by their depth
function warpFn(p) {
  const ts = Math.sin(p.head.turn), ns = Math.sin(p.head.nod);
  return (x, y, depth = 0) => {
    const zn = Math.max(0, 1 - (x / 112) ** 2 - (y / (y < 0 ? 118 : 150)) ** 2);
    const z = zn + depth;
    return [x + ts * 92 * z - ts * x * 0.05, y + ns * 70 * z];
  };
}
function sampleFn(pts) { // piecewise-linear y(x) through sorted pts
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i], f = (x - a[0]) / (b[0] - a[0]); const s = f * f * (3 - 2 * f); return a[1] + (b[1] - a[1]) * (0.5 * f + 0.5 * s); }
    return pts[pts.length - 1][1];
  };
}
const UP0 = sampleFn([[-29, 3], [-20, -10], [-8, -18.5], [6, -20.5], [18, -16], [26, -8], [30, -4]]);
const LO0 = sampleFn([[-29, 3], [-18, 11], [-2, 15], [14, 13], [24, 6], [30, -4]]);
const CLOSED = (x, happy) => { const u = x / 29.5; return lerp(5.5 * (1 - u * u) + 1.5 - 2.5 * u, -4.5 * (1 - u * u) + 2 - 2.5 * u, happy); };

// ---------------------------------------------------------------- draw
export class Heroine {
  constructor(painter) { this.P = painter; this.hair = null; }
  draw(p, S, o = {}) {
    if (S.D && S.D.layers) return this.drawLook(p, S, o);
    const P = this.P, tint = [p.tint[0], p.tint[1], p.tint[2], 1], add = p.add;
    this.hs = Math.hypot(S.head[0], S.head[1]); this.rs = Math.hypot(S.root[0], S.root[1]);
    const wetT = [tint[0] * (1 - p.wet * 0.25), tint[1] * (1 - p.wet * 0.22), tint[2] * (1 - p.wet * 0.15), 1];
    const opt = { tint, add, mat: MAT.skin }, clothOpt = { tint: wetT, add, mat: { ...MAT.satin, spec: MAT.satin.spec * (1 + p.wet * 0.6) } };
    const flatOpt = { tint, add, mat: MAT.flat }, eyeOpt = { tint, add, mat: MAT.eye };
    const W = warpFn(p), H = (x, y, d) => { const q = W(x, y, d); return M.ap(S.head, q[0], q[1]); };
    // creator look (null = the film heroine): skin/hair/iris/lip/eyeshadow recolours + feature placement
    const D = S.D;
    if (D && D.skin) opt.albGain = D.skin;
    const fw = D ? D.face.width : 1;
    const hairOpt = { tint: [tint[0] * (1 - p.wet * 0.3), tint[1] * (1 - p.wet * 0.3), tint[2] * (1 - p.wet * 0.25), 1], add, mat: { ...MAT.hair, spec: MAT.hair.spec * (1 + p.wet) } };
    if (D && D.hair.color) { hairOpt.albGain = D.hair.color.gain; hairOpt.albAdd = D.hair.color.add; }
    const hLen = D ? D.hair.back : 1, hVol = (D ? D.hair.vol : 1) * fw;
    const O = D && D.outfit, cap = D && D.hair.cap, longHair = !cap;
    const dyed = (o, d) => d ? { ...o, albGain: d.gain, albAdd: d.add } : o;
    const turn = Math.sin(p.head.turn);
    const backOpt = { ...hairOpt, tint: hairOpt.tint.map((v, i) => i < 3 ? v * 0.72 : v) };
    // --- back hair mass: top follows the head, bottom follows chest + spring sway
    const hb = this.hair ? this.hair.back : [0, 0];
    const headInvBind = (x, y) => [x, y];
    if (longHair) P.mesh('hairBack', 12, 18, (x, y) => {
      const wb = smooth((y - 40) / 260); // 0 at head, 1 low
      if (D) { x *= hVol; if (y > 40) y = 40 + (y - 40) * hLen; }
      const hx = x - turn * 30 * (1 - wb) - turn * 80 * wb;
      const a = M.ap(S.head, hx, y);
      const cb = M.ap(S.chest, hx * 1.22, y * 1.22 - 498); // chest-space approx of the same point at bind
      const sw = wb * wb;
      return [lerp(a[0], cb[0], wb * 0.85) + hb[0] * sw, lerp(a[1], cb[1], wb * 0.85) + hb[1] * sw];
    }, backOpt);
    if (this.hair && longHair) for (const L of this.hair.locks) if (L.layer === 'back') this.drawLock(L, backOpt);
    // --- far arm (behind torso unless front)
    const drawArm = (i) => {
      const A = S.arms[i], a = p.arms[i];
      const ku = S.dim.armU / ARM_U, kl = S.dim.armL / ARM_L, lw = D ? D.limbW : 1;
      const armFn = (x, y) => {
        const wl = smooth((y - 150) / 36);
        const u = M.ap(A.up, x * lw, y * ku), l = M.ap(A.lo, x * lw, (y - ARM_U) * kl);
        const wc = smooth((-y - 4) / 30) * 0.6;
        const c = M.ap(S.chest, A.sh[0] + x * lw, A.sh[1] + y * ku);
        const px = lerp(u[0], l[0], wl), py = lerp(u[1], l[1], wl);
        return [lerp(px, c[0], wc), lerp(py, c[1], wc)];
      };
      P.mesh('arm', 4, 24, armFn, opt);
      if (O && O.sleeve) P.mesh(O.sleeve, 4, 24, armFn, dyed({ ...clothOpt, mat: MAT.legging }, O.topDye));
      if (a.prop && a.propBehind) this.drawProp(a, A, opt);
      P.mesh(a.hand, 3, 3, (x, y) => M.ap(A.hand, x, y), opt);
      if (a.prop && !a.propBehind) this.drawProp(a, A, opt);
    };
    // --- legs (both behind the pelvis)
    const drawLeg = (i) => {
      const Lg = S.legs[i], l = p.legs[i]; if (!l.show) return;
      const kt = S.dim.legT / LEG_T, ks = S.dim.legS / LEG_S, lw = D ? D.limbW : 1;
      const legFn = (x, y) => {
        const ws = smooth((y - 192) / 36);
        const a = M.ap(Lg.th, x * lw, y * kt), b = M.ap(Lg.sn, x * lw, (y - LEG_T) * ks);
        return [lerp(a[0], b[0], ws), lerp(a[1], b[1], ws)];
      };
      if (O) { P.mesh('legSkin', 4, 26, legFn, opt); P.mesh(O.legs, 4, 26, legFn, dyed({ ...clothOpt, mat: MAT.legging }, O.legDye)); }
      else P.mesh('leg', 4, 26, legFn, { ...clothOpt, mat: MAT.legging });
      if (p.gear.boots) P.mesh(O ? O.shoe : 'boot', 3, 3, (x, y) => M.ap(Lg.foot, x, y), dyed({ ...clothOpt, mat: MAT.leather }, O && O.shoeDye));
    };
    if (p.gear.backpack) P.mesh('backpack', 2, 2, (x, y) => M.ap(S.chest, (x - 58) * (D ? D.shoulders : 1), (y - 190) * S.dim.th), { ...clothOpt, mat: MAT.leather });
    if (!p.arms[1].front) drawArm(1);
    drawLeg(1); drawLeg(0);
    // --- torso (pelvis/chest/neck/thigh skinning)
    if (O) {
      const tf = (x, y) => this.skinTorso(S, x, y);
      P.mesh(O.torso, 10, 26, tf, { ...opt, mat: { ...MAT.skin, sss: 0.8 } });
      P.mesh(O.hips, 10, 6, tf, dyed({ ...clothOpt, mat: MAT.legging }, O.skirt ? O.legDye : O.bottomDye));
      if (O.skirt) P.mesh('skirt', 10, 10, tf, dyed({ ...clothOpt, mat: { ...MAT.legging, spec: 0.25 } }, O.bottomDye));
      P.mesh(O.top, 10, 26, tf, dyed({ ...clothOpt, mat: O.top.startsWith('top_halter') ? MAT.satin : { ...MAT.legging, spec: 0.2, gloss: 10 } }, O.topDye));
    } else P.mesh('torso', 10, 26, (x, y) => this.skinTorso(S, x, y), { ...clothOpt, mat: { ...clothOpt.mat, sss: 0.6 }, albGain: D && D.skin });
    if (p.gear.backpack) P.mesh('straps', 4, 8, (x, y) => this.skinTorso(S, x, y), { ...clothOpt, mat: MAT.leather });
    if (this.hair && longHair) for (const L of this.hair.locks) if (L.layer === 'mid') this.drawLock(L, hairOpt);
    if (p.arms[1].front) drawArm(1);
    // --- head
    const f = p.face;
    for (const side of [-1, 1]) { // ears, mostly hidden
      const q = H(side * 99 * fw, 10, 0), es = D ? D.ears : 1;
      P.mesh('ear', 1, 1, (x, y) => [q[0] + x * es * (side > 0 ? 1 - turn * 0.5 : 1 + turn * 0.3) * S.head[0], q[1] + y * es * S.head[3]], opt);
    }
    const ch = Math.max(0, f.mouth.smile) * 0.7 + f.cheek * 0.6;
    const faceFn = (x, y) => {
      const k = Math.exp(-(((Math.abs(x) - 70) / 32) ** 2) - (((y - 48) / 34) ** 2)) * ch;
      if (D) { const F = D.face, y0 = y;   // face shape: width, jaw taper, chin length, forehead height, cheek fullness
        x *= F.width * lerp(1, F.jaw, smooth((y0 - 10) / 90)) * (1 + F.cheek * 0.07 * Math.exp(-(((y0 - 35) / 38) ** 2)));
        if (y0 > 55) y = 55 + (y0 - 55) * F.chin; else if (y0 < -30) y = -30 + (y0 + 30) * F.forehead; }
      return H(x + Math.sign(x) * k * 3, y - k * 6, 0);
    };
    P.mesh('face', 18, 18, faceFn, opt);
    const Fh = D && D.facial;
    if (Fh && Fh.beard) P.mesh(Fh.beard, 12, 12, faceFn, Fh.color ? { ...hairOpt, albGain: Fh.color.gain, albAdd: Fh.color.add } : { ...hairOpt, albGain: undefined, albAdd: undefined });
    // blush & eyeshadow
    const bl = f.blush;
    for (const side of [-1, 1]) {
      P.mesh('blush', 2, 2, (x, y) => H(side * 56 * fw + x, 40 - f.cheek * 8 + y, 0.02), { ...flatOpt, opacity: bl * (D ? D.blush : 1) });
      const E = D && D.eyes;
      if (!D || D.shadow !== 'none') P.mesh('eyeshadow', 4, 4, (x, y) => E ? H(side * (46 + E.dx + x * E.s * E.w), 6 + E.dy + y * E.s * E.h + (f.brow[side > 0 ? 1 : 0].y) * 2, 0.04)
        : H(side * (46 + x), 6 + y + (f.brow[side > 0 ? 1 : 0].y) * 2, 0.04), D && D.shadow ? { ...flatOpt, albGain: D.shadow.gain, albAdd: D.shadow.add, albMono: D.shadow.mono } : flatOpt);
    }
    const Nz = D && D.nose;
    P.mesh('nose', 3, 3, (x, y) => Nz ? H(x * Nz.s * Nz.w * lerp(1, Nz.tip, smooth((y + 15) / 15)), 38 + Nz.dy + y * Nz.s * Nz.h, 0.38) : H(x, 38 + y, 0.38), opt);
    // eyes
    [-1, 1].forEach((side, si) => this.drawEye(p, S, H, side, si, eyeOpt));
    // brows
    [-1, 1].forEach((side, si) => {
      const b = f.brow[si], Bw = D && D.brows;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8, x = Bw ? 20 + Bw.dx + u * 58 * Bw.len * Bw.s : 20 + u * 58;
        let y = Bw ? -38 + Bw.dy - 9 * Bw.arch * Bw.s * Math.sin(Math.PI * Math.pow(u, Bw.peak)) + 3 * u - Bw.tilt * (u - 0.35) * 16
          : -38 - 9 * Math.sin(Math.PI * Math.pow(u, 0.8)) + 3 * u;
        y -= b.y * 9 + b.inner * 9 * (1 - u) * (1 - u) + b.outer * 8 * u * u;
        pts.push(H(side * x, y, 0.06));
      }
      if (side < 0) pts.reverse();
      P.strip('brow', pts, { range: [0, 100], scale: 0.62 * this.hs * (Bw ? Bw.thick * Bw.s : 1), segs: 12, flipU: side < 0, ...flatOpt });
    });
    this.drawMouth(p, S, H, opt, eyeOpt);
    // hair cap (part shifts with turn)
    P.mesh(cap || 'hairCap', 16, 10, (x, y) => {
      const k = Math.max(0, 1 - (x / 140) ** 2);
      if (D) x *= hVol;
      return M.ap(S.head, x + turn * 52 * k * (y < -60 ? 1 : 0.6) - turn * x * 0.04, y + Math.sin(p.head.nod) * 25 * k);
    }, hairOpt);
    if (this.hair && longHair) for (const L of this.hair.locks) if (L.layer === 'front') this.drawLock(L, hairOpt);
    drawArm(0); // near arm last: in front of the body, the front locks and (when raised) the face
    if (p.wet > 0.05 && o.drops) this.drawDrops(p, S, H, o.t);
  }
  // ---------------------------------------------------------------- creator characters
  // Same rig, but every visible piece comes from the look recipe: body skin and garment layers by
  // space and z, the hairstyle (cap, back mass, spring locks, rigid extras) and facial hair.
  // Arms tuck behind the torso at the shoulder cap; the rest of the arm and the hand are drawn again
  // in front (fading in just below the shoulder) unless the gesture crosses the body or rises above
  // the shoulders, which draws the whole arm in front.
  drawLook(p, S, o = {}) {
    const P = this.P, D = S.D, Lr = D.layers, tint = [p.tint[0], p.tint[1], p.tint[2], 1], add = p.add;
    this.hs = Math.hypot(S.head[0], S.head[1]); this.rs = Math.hypot(S.root[0], S.root[1]);
    const skin = { tint, add, mat: MAT.skin, albGain: D.skin || undefined };
    const limbSkin = { ...skin, albGain: (D.skin || [1, 1, 1]).map((v, i) => v * [0.97, 0.94, 0.93][i]) };
    const MATS = { cloth: { ...MAT.legging, spec: 0.16, gloss: 10, rim: 0.7 }, knit: { ...MAT.legging, spec: 0.06, gloss: 6, rim: 0.7 }, denim: { ...MAT.legging, spec: 0.1, gloss: 8, rim: 0.6 },
      satin: MAT.satin, leather: MAT.leather, skin: MAT.skin };
    const lay = (l) => l.dye === 'skin' ? { ...skin, mat: MATS[l.mat] || MAT.skin } : ({ tint, add, mat: MATS[l.mat] || MATS.cloth, albGain: l.d ? l.d.gain : undefined, albAdd: l.d ? l.d.add : undefined });
    const has = (t) => !!P.T[t];
    const flatOpt = { tint, add, mat: MAT.flat }, eyeOpt = { tint, add, mat: MAT.eye };
    const W = warpFn(p), H = (x, y, d) => { const q = W(x, y, d); return M.ap(S.head, q[0], q[1]); };
    const fw = D.face.width, Hd = D.hair, turn = Math.sin(p.head.turn), nod = Math.sin(p.head.nod);
    const hairOpt = { tint, add, mat: MAT.hair, albGain: Hd.color ? Hd.color.gain : undefined, albAdd: Hd.color ? Hd.color.add : undefined };
    const backOpt = { ...hairOpt, tint: tint.map((v, i) => i < 3 ? v * 0.72 : v) };
    const hb = this.hair ? this.hair.back : [0, 0], hVol = Hd.vol * fw;
    const locks = (layer, opt) => { if (this.hair) for (const L of this.hair.locks) if (L.layer === layer && has(L.tex)) this.drawLock(L, opt); };
    // rigid head-space pieces (cap, buns, bows): the part and crown slide a little with head turn and nod
    const capFn = (x, y) => { const k = Math.max(0, 1 - (x / 140) ** 2); x *= hVol; return M.ap(S.head, x + turn * 52 * k * (y < -60 ? 1 : 0.6) - turn * x * 0.04, y + nod * 25 * k); };
    // 1. hair behind the body
    for (const e of Hd.extras) if (e.z === 'behind' && has(e.tex)) P.mesh(e.tex, 8, 8, capFn, backOpt);
    if (Hd.backTex && has(Hd.backTex)) P.mesh(Hd.backTex, 12, 18, (x, y) => {
      const wb = smooth((y - 40) / 260);
      x *= hVol; if (y > 40) y = 40 + (y - 40) * Hd.back;
      const hx = x - turn * 30 * (1 - wb) - turn * 80 * wb;
      const a = M.ap(S.head, hx, y), cb = M.ap(S.chest, hx * 1.22, y * 1.22 - 498), sw = wb * wb;
      return [lerp(a[0], cb[0], wb * 0.85) + hb[0] * sw, lerp(a[1], cb[1], wb * 0.85) + hb[1] * sw];
    }, backOpt);
    locks('back', backOpt);
    // 2. garment layers behind the body (hood backs, capes) and the backpack
    const tf = (x, y) => this.skinTorso(S, x, y), tfSwing = (x, y) => this.skinTorso(S, x, y, true), tfCloth = (x, y) => this.skinTorso(S, x, y, false, true);
    const belted = !D.full && Lr.torso.some(l => /^(acc_)?belt/.test(l.tex));
    const tucked = (l) => belted && l.z >= 28 && l.z < 36 && l.mat !== 'knit';   // tucked-in tops end at the waistband
    const tuckFade = { afn: (lx, ly) => 1 - smooth((ly + 26) / 6) };
    const texOf = (l) => has(l.tex) ? l.tex : l.tex.replace(/_m$/, '_f');   // tops painted only for women fall back on men
    const torsoLayers = (lo, hi, skip = () => false) => { for (const l of Lr.torso) if (l.z >= lo && l.z < hi && has(texOf(l)) && !skip(l))
      P.mesh(texOf(l), ...(l.grid || [10, 26]), l.swing ? tfSwing : l.z >= 28 && !l.fitted ? tfCloth : tf, { ...lay(l), ...(tucked(l) ? tuckFade : {}) }); };   // dresses/overalls hug the body
    torsoLayers(-1e9, 0);
    if (p.gear.backpack) P.mesh('backpack', 2, 2, (x, y) => M.ap(S.chest, (x - 58) * D.shoulders, (y - 190) * S.dim.th), { tint, add, mat: MAT.leather });
    // 3. legs: bare skin, then leg layers, then shoes
    const drawLeg = (i) => {
      const Lg = S.legs[i]; if (!p.legs[i].show) return;
      const kt = S.dim.legT / LEG_T, ks = S.dim.legS / LEG_S;
      const fn = (x, y) => {
        const ws = smooth((y - 192) / 36), w = legWidth(D, y);
        const a = M.ap(Lg.th, x * w, y * kt), b = M.ap(Lg.sn, x * w, (y - LEG_T) * ks);
        return [lerp(a[0], b[0], ws), lerp(a[1], b[1], ws)];
      };
      P.mesh('legSkin', 4, 26, fn, limbSkin);
      for (const l of Lr.leg) if (has(l.tex)) P.mesh(l.tex, ...(l.grid || [4, 26]), fn, lay(l));
      if (p.gear.boots) for (const l of Lr.foot) if (has(l.tex)) P.mesh(l.tex, ...(l.grid || [3, 3]), (x, y) => { const fs = D.body.feet; return M.ap(Lg.foot, x * fs, 44 + (y - 44) * fs); }, lay(l));   // bigger feet keep the sole on the ground
    };
    drawLeg(1); drawLeg(0);
    // 4. arms: 'behind' = whole arm without the hand, 'fore' = forearm + hand fading in below the elbow, 'full' = whole arm in front
    // arms that cross the body or rise above the shoulders are drawn whole, in front of the torso and hair
    const crossing = (i) => !!p.arms[i].front || (i === 0 && p.handOverFace) || (!p.arms[i].world && p.arms[i].target[1] < -250 * S.dim.th);
    const armFn = (i) => {
      const A = S.arms[i], ku = S.dim.armU / ARM_U, kl = S.dim.armL / ARM_L;
      // a lifted arm carries its cap along (the torso's shoulder turns with it), so the cap stops pinning to the chest
      let th = Math.atan2(A.up[1], A.up[0]) - Math.atan2(S.chest[1], S.chest[0]); th = Math.atan2(Math.sin(th), Math.cos(th));
      const pin = 0.6 * (1 - smooth(Math.max(0, -th * Math.sign(A.sh[0])) / 0.9));
      return (x, y) => {
        const wa = armWidth(D, y), wl = smooth((y - 156) / 22);   // a short blend keeps a defined elbow
        const w = lerp(Math.pow(wa, 0.8), wa, smooth((y + 10) / 110));   // the shoulder cap widens less than the arm, blending down to the bicep
        const u = M.ap(A.up, x * w, y * ku), l = M.ap(A.lo, x * w, (y - ARM_U) * kl);
        const wc = smooth((-y - 4) / 30) * pin, c = M.ap(S.chest, A.sh[0] + x * w, A.sh[1] + y * ku);
        return [lerp(lerp(u[0], l[0], wl), c[0], wc), lerp(lerp(u[1], l[1], wl), c[1], wc)];
      };
    };
    const drawArm = (i, mode) => {
      const A = S.arms[i], a = p.arms[i], fn = armFn(i);
      // the shoulder cap (y < ~0) stays tucked behind the torso; everything below it draws in front
      // (a dense mesh keeps that edge sharp, so cloth over the torso shows no half-transparent band)
      // the front pass starts along a rounded cap line: lower at the arm's outer edges, like a shoulder seam
      const capLine = (lx) => -8 + 20 * Math.min(1, (lx / 34) ** 2);
      const fade = mode !== 'behind' ? { afn: (lx, ly) => smooth((ly - capLine(lx)) / 8) } : {};
      // sleeves only draw in front, starting just below the shoulder line: the garment's own torso
      // shoulder shapes the silhouette above that
      // front-pass skin starts a little below the sleeve's edge, so no skin shows through the sleeve's fade
      const sleeved = Lr.arm.some(l => has(l.tex)), sk0 = sleeved ? 30 : 12;   // front skin starts below a sleeve's soft fade-in
      const skinIn = (lx, ly) => smooth((ly - capLine(lx) - sk0) / 8);
      const intoPocket = (lx, ly) => skinIn(lx, ly) * (1 - smooth((ly - 284) / 6));   // a crisp cut under the pocket edge
      P.mesh('arm', 4, 48, fn, { ...limbSkin, ...(mode === 'behind' ? {} : { afn: a.pocket ? intoPocket : skinIn }) });
      // behind the torso the sleeve starts at the shoulder line too, so no skin shows under the front pass's fade
      // the front sleeve fades in over a longer stretch so its top melts into the shirt's own shoulder (no seam band)
      const clothFade = mode === 'behind' ? { afn: (lx, ly) => smooth((ly - capLine(lx) + 22) / 6) } : { afn: (lx, ly) => smooth((ly - capLine(lx) - 2) / 14) };
      for (const l of Lr.arm) if (has(l.tex)) P.mesh(l.tex, ...(l.grid || [4, 48]), fn, { ...lay(l), ...clothFade });
      if (mode !== 'behind' && !a.pocket) {   // a hand in a pocket disappears at the wrist
        if (a.prop && a.propBehind) this.drawProp(a, A, skin);
        P.mesh(a.hand, 3, 3, (x, y) => M.ap(A.hand, x, y), skin);
        if (a.prop && !a.propBehind) this.drawProp(a, A, skin);
      }
    };
    for (const i of [1, 0]) drawArm(i, 'behind');   // the whole arm sits behind the torso; front passes add everything below the cap
    // 5. torso: skin, definition overlays, then garment layers by z
    P.mesh(Lr.torsoSkin || D.torsoSkin, 10, 26, tf, { ...skin, mat: { ...MAT.skin, sss: 0.8 } });
    const ov = D.sex === 'male' ? 'm' : 'f';
    if (D.muscle > 0.02 && has('body_muscle_' + ov)) P.mesh('body_muscle_' + ov, 10, 26, tf, { ...skin, opacity: D.muscle });
    if (D.soft > 0.02 && has('body_soft_' + ov)) P.mesh('body_soft_' + ov, 10, 26, tf, { ...skin, opacity: D.soft });
    // bottoms, then the pocket mouths for hands in pockets (a long top drawn next covers them), then tops
    const isBelt = (l) => /^(acc_)?belt/.test(l.tex);
    // belts go over a tucked top; an untucked top (knits) hangs over the belt and hides it
    const anyTucked = Lr.torso.some(tucked);
    torsoLayers(0, 26, (l) => anyTucked && isBelt(l));
    torsoLayers(26, 1e9, isBelt);
    if (anyTucked) torsoLayers(0, 1e9, (l) => !isBelt(l));
    if (p.gear.backpack) P.mesh('straps', 4, 8, tf, { tint, add, mat: MAT.leather });
    locks('mid', hairOpt);
    for (const i of [1, 0]) if (!crossing(i)) drawArm(i, 'fore');
    if (crossing(1)) drawArm(1, 'full');
    // 6. head
    const f = p.face;
    for (const side of [-1, 1]) {
      const q = H(side * 99 * fw, 10, 0), es = D.ears;
      P.mesh('ear', 1, 1, (x, y) => [q[0] + x * es * (side > 0 ? 1 - turn * 0.5 : 1 + turn * 0.3) * S.head[0], q[1] + y * es * S.head[3]], skin);
    }
    const ch = Math.max(0, f.mouth.smile) * 0.7 + f.cheek * 0.6, F = D.face;
    const faceFn = (x, y) => {
      const k = Math.exp(-(((Math.abs(x) - 70) / 32) ** 2) - (((y - 48) / 34) ** 2)) * ch, y0 = y;
      x *= F.width * lerp(1, F.jaw, smooth((y0 - 10) / 90)) * (1 + F.cheek * 0.07 * Math.exp(-(((y0 - 35) / 38) ** 2)));
      if (y0 > 55) y = 55 + (y0 - 55) * F.chin; else if (y0 < -30) y = -30 + (y0 + 30) * F.forehead;
      return H(x + Math.sign(x) * k * 3, y - k * 6, 0);
    };
    P.mesh('face', 18, 18, faceFn, skin);
    const fhOpt = (l) => ({ ...hairOpt, albGain: l.color ? l.color.gain : undefined, albAdd: l.color ? l.color.add : undefined });
    if (D.age > 0.02 && has('face_age')) P.mesh('face_age', 12, 12, faceFn, { ...skin, opacity: D.age });   // smile lines, crow's feet, forehead
    const E = D.eyes;
    for (const side of [-1, 1]) {   // makeup first, so beards and stubble sit on top of the blush
      P.mesh('blush', 2, 2, (x, y) => H(side * 56 * fw + x, 40 - f.cheek * 8 + y, 0.02), { ...flatOpt, opacity: f.blush * D.blush });
      if (D.shadow !== 'none') P.mesh('eyeshadow', 4, 4, (x, y) => H(side * (46 + E.dx + x * E.s * E.w), 6 + E.dy + y * E.s * E.h + (f.brow[side > 0 ? 1 : 0].y) * 2, 0.04),
        D.shadow ? { ...flatOpt, albGain: D.shadow.gain, albAdd: D.shadow.add, albMono: D.shadow.mono } : flatOpt);
    }
    for (const l of D.facial) if (l.space === 'face' && l.z !== 'over' && has(l.tex)) P.mesh(l.tex, 12, 12, faceFn, fhOpt(l));
    const Nz = D.nose;
    P.mesh('nose', 3, 3, (x, y) => H(x * Nz.s * Nz.w * lerp(1, Nz.tip, smooth((y + 15) / 15)), 38 + Nz.dy + y * Nz.s * Nz.h, 0.38), skin);
    [-1, 1].forEach((side, si) => this.drawEye(p, S, H, side, si, eyeOpt));
    [-1, 1].forEach((side, si) => {
      const b = f.brow[si], Bw = D.brows, pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8, x = 20 + Bw.dx + u * 58 * Bw.len * Bw.s;
        let y = -38 + Bw.dy - 9 * Bw.arch * Bw.s * Math.sin(Math.PI * Math.pow(u, Bw.peak)) + 3 * u - Bw.tilt * (u - 0.35) * 16;
        y -= b.y * 9 + b.inner * 9 * (1 - u) * (1 - u) + b.outer * 8 * u * u;
        pts.push(H(side * x, y, 0.06));
      }
      if (side < 0) pts.reverse();
      P.strip('brow', pts, { range: [0, 100], scale: 0.62 * this.hs * Bw.thick * Bw.s, segs: 12, flipU: side < 0, ...flatOpt, albGain: D.browColor ? D.browColor.gain : undefined, albAdd: D.browColor ? D.browColor.add : undefined });
    });
    this.drawMouth(p, S, H, skin, eyeOpt, (l) => fhOpt(l));
    if (D.glasses && has(D.glasses)) {   // glasses ride on the eyes: spacing, height and size follow the eye placement
      const sx = (46 + E.dx) / 46;
      P.mesh(D.glasses, 10, 3, (x, y) => H(x * sx * Math.sqrt(E.s), 8 + E.dy + y * E.s, 0.16),
        { tint, add, mat: { ...MAT.prop, spec: 0.5, gloss: 30 }, albGain: D.glassesDye ? D.glassesDye.gain : undefined, albAdd: D.glassesDye ? D.glassesDye.add : undefined });
    }
    for (const l of D.facial) if (l.space === 'face' && l.z === 'over' && has(l.tex)) P.mesh(l.tex, 12, 12, faceFn, fhOpt(l));
    P.mesh(Hd.cap, 16, 10, capFn, hairOpt);
    for (const e of Hd.extras) if (e.z !== 'behind' && has(e.tex)) P.mesh(e.tex, 8, 8, capFn, hairOpt);
    locks('front', hairOpt);
    if (crossing(0)) drawArm(0, 'full');
    if (p.wet > 0.05 && o.drops) this.drawDrops(p, S, H, o.t);
  }
  skinTorso(S, x, y, swing = false, cloth = false) {
    let wn = smooth((-y - 300) / 40), wc = smooth((-y - 60) / 110) * (1 - wn), wp = 1 - wn - wc;
    // hips follow the thighs a little; a swinging skirt follows both thighs equally so it hangs between them
    let wl0 = 0, wl1 = 0;
    if (y > -10) {
      const k = smooth((y + 10) / 70) * (swing ? 0.5 : 0.65);
      const sx = swing ? 0.5 : smooth((x + 20) / 40);
      wl1 = k * sx; wl0 = k * (1 - sx);
    }
    if (S.D) {   // weights above use the bind-pose height
      const tl = (S.D.body.traps ?? 1) - 1;
      if (tl > 0 && y < -290) { const ax0 = Math.abs(x); y -= tl * 34 * smooth((ax0 - 34) / 18) * (1 - smooth((ax0 - 70) / 60)) * smooth((-y - 290) / 24); }
      const drop = shoulderDrop(S.D);
      if (drop > 0 && y < -170) { const ax0 = Math.abs(x); y += drop * smooth((ax0 - 48) / 70) * smooth((-y - 170) / 110); }
      let k = torsoWidth(S.D, y); const ax = Math.abs(x);
      if (cloth && y > -200 && y < 30) {   // fabric bridges the waist hollow instead of hugging it (no notch, no peplum flare)
        // only up to the narrower of chest and hips, so an hourglass is bridged but a V-taper stays a V
        k = Math.max(k, Math.min(torsoWidth(S.D, -190), torsoWidth(S.D, 30)) * 0.95 * smooth((y + 200) / 40));
      }
      // around the shoulders only the part inside the arm socket (|x| < 100) widens with the body;
      // the shoulder cap beyond it keeps the arm's thickness, so wide shoulders do not grow 'wings'
      // (the cap matches the arm's own shoulder width, which is sqrt of its width scale, see drawLook)
      const band = smooth((-y - 200) / 40) * (1 - smooth((-y - 330) / 30)), ka = Math.min(k, Math.pow(S.D.body.upperArm, 0.8));
      x = ax <= 100 || band <= 0 ? x * k : Math.sign(x) * (100 * k + (ax - 100) * lerp(k, ka, band));
      if (y < 0) y *= S.D.torsoH;
    }
    const n = M.ap(S.neck, x, y), c = M.ap(S.chest, x, y), pp = M.ap(S.pel, x, y);
    let X = (n[0] * wn + c[0] * wc + pp[0] * wp), Y = (n[1] * wn + c[1] * wc + pp[1] * wp);
    if (S.D && S.arms) {   // the shoulder (deltoid and the garment over it) turns with the upper arm as it lifts away from the body
      const ca = Math.atan2(S.chest[1], S.chest[0]);
      for (let i = 0; i < 2; i++) {
        const A = S.arms[i], sx = A.sh[0], sy = A.sh[1], asx = Math.abs(sx) + 1;
        if (x * sx <= 0) continue;
        let th = Math.atan2(A.up[1], A.up[0]) - ca; th = Math.atan2(Math.sin(th), Math.cos(th));
        if (-th * Math.sign(sx) < 0) continue;   // only lifting the arm away from the body turns the shoulder
        // weight: near the socket, outside the neck, and not below the armpit (the side stays with the ribs)
        const d = Math.hypot((x - sx) * 0.9, y - sy), w = (1 - smooth((d - 24) / 120)) * smooth((Math.abs(x) - 0.5 * asx) / (0.35 * asx)) * (1 - smooth((y - sy + 5) / 25));
        if (w <= 0) continue;
        const r = M.ap(M.trs(sx, sy, th * w), x - sx, y - sy), a0 = M.ap(S.chest, x, y), a1 = M.ap(S.chest, r[0], r[1]);
        X += a1[0] - a0[0]; Y += a1[1] - a0[1];
      }
    }
    if (wl0 + wl1 > 0) {
      const a = M.ap(S.legs[0].th, x - S.legs[0].h[0], y - S.legs[0].h[1]), b = M.ap(S.legs[1].th, x - S.legs[1].h[0], y - S.legs[1].h[1]);
      const rest = 1 - wl0 - wl1;
      X = X * rest + a[0] * wl0 + b[0] * wl1; Y = Y * rest + a[1] * wl0 + b[1] * wl1;
    }
    return [X, Y];
  }
  drawEye(p, S, H, side, si, opt) {
    const E = S.D && S.D.eyes;
    const P = this.P, f = p.face, lid = f.lid[si], cx = side * (46 + (E ? E.dx : 0)), cy = 8 + (E ? E.dy : 0);
    const es = E ? E.s : 1, ew = E ? E.w * es : 1, eh = E ? E.h * es : 1, etl = E ? E.tilt * 0.35 * es : 0, irs = E ? E.iris * es : 1;
    const plain = opt;
    if (E && E.color) opt = { ...opt, albGain: E.color.gain, albAdd: E.color.add, albMono: E.color.mono };
    const blink = p.blink || 0;
    const open = clamp(lid.open * (1 - blink), 0, 1.4), happy = clamp(lid.happy + blink * 0.0, 0, 1), squint = lid.squint;
    const N = 12, up = [], lo = [];
    for (let k = 0; k <= N; k++) {
      const x = -29.5 + 59 * k / N;
      const cl = CLOSED(x, happy);
      let yu = lerp(cl, UP0(x) - (open > 1 ? (open - 1) * 10 * (1 - (x / 30) ** 2) : 0), Math.min(1, open));
      let yl = lerp(LO0(x), cl, squint * 0.55 + (1 - Math.min(1, open)) * 0.0);
      if (open < 1) yl = lerp(cl, yl, Math.max(Math.min(1, open), 0.0) * 0.6 + 0.4 * Math.min(1, open * 3));
      if (yu > yl - 0.2) yu = yl - 0.2;
      up.push([x, yu]); lo.push([x, yl]);
    }
    const toW = (q, d = 0.03) => H(cx + side * q[0] * ew, cy + q[1] * eh - etl * q[0], d);
    const upW = up.map(q => toW(q)), loW = lo.map(q => toW(q));
    const ref = si + 1;
    const opening = Math.max(...up.map((q, i) => lo[i][1] - q[1]));
    if (opening > 0.6) {
      P.maskPoly([...upW, ...loW.slice().reverse()], ref);
      P.mesh('sclera', 3, 3, (x, y) => toW([x * side, y], 0.02), { ...plain, clip: ref, flipU: side < 0 });
      // iris follows gaze; slight shift with head turn
      const gx = p.gaze[0] * 9 * es, gy = (p.gaze[1] * 6 + (open - 1) * 2) * eh;
      const ic = [cx + gx + 1 * side, cy + gy + 0.5];
      const turnSq = 1 - Math.abs(Math.sin(p.head.turn)) * (side * Math.sign(p.head.turn) > 0 ? 0.25 : 0.05);
      P.mesh('iris', 3, 3, (x, y) => H(ic[0] + x * turnSq * irs, ic[1] + y * irs, 0.05), { ...opt, clip: ref });
      // lid shadow along the upper lid
      P.strip('lashLow', upW, { range: [0, 100], scale: 2.6 * this.hs * eh, ...plain, tint: [0.05, 0.02, 0.02, 1], opacity: 0.55, clip: ref });
      P.mesh('catch', 2, 2, (x, y) => H(ic[0] + x * turnSq * irs, ic[1] + y * irs, 0.06), { ...plain, clip: ref, tint: [1, 1, 1, 1], add: [0, 0, 0] });
    }
    // lashes
    const loPts = side < 0 ? loW.slice().reverse() : loW, upPts = side < 0 ? upW.slice().reverse() : upW;
    const lk = E ? E.lash * es : 1;
    P.strip('lashLow', loPts, { range: [0, 100], scale: 0.9 * this.hs * lk, flipU: side < 0, ...plain, flipN: false });
    P.strip('lashUp', upPts, { range: [0, 100], scale: 1.0 * this.hs * lk, segs: 16, flipU: side < 0, ...plain });
  }
  drawMouth(p, S, H, opt, fopt, facialOpt) {
    const Mo = S.D && S.D.mouth;
    const P = this.P, m = p.face.mouth, cy = 64 + (Mo ? Mo.dy : 0);
    const open = clamp(m.open), round = clamp(m.round), smile = m.smile;
    const hw = 21 * (1 + 0.2 * m.wide - 0.34 * round + 0.12 * Math.max(0, smile) - 0.1 * m.press) * (Mo ? Mo.w * Mo.s : 1);
    const cornerY = (s) => -smile * 6.5 - m.smirk * s * 5.5 + Math.max(0, -smile) * 2;
    const N = 12, up = [], lo = [];
    const topC = -open * 5 - round * 2.5 + m.fv * 1, botC = open * 22 + round * 6 + m.teeth * 3 - m.fv * 3;
    for (let k = 0; k <= N; k++) {
      const u = k / N * 2 - 1, x = u * hw, s = u < 0 ? -1 : 1;
      const corner = lerp(cornerY(-1), cornerY(1), (u + 1) / 2);
      const prof = Math.pow(1 - u * u, round > 0.3 ? 0.55 : 0.85);
      const smileBow = smile * 3.2 * (1 - u * u);          // closed smile curve
      up.push([x, corner + (topC - smileBow * 0.6) * prof + smileBow * 0.2]);
      lo.push([x, corner + (botC * Math.pow(1 - u * u, 0.7)) + smileBow * 0.3 * prof]);
    }
    const toW = (q, d = 0.12) => H(q[0], cy + q[1], d * (1 - (q[0] / 40) ** 2));
    const upW = up.map(q => toW(q)), loW = lo.map(q => toW(q));
    const gap = Math.max(...up.map((q, i) => lo[i][1] - q[1]));
    if (gap > 1.2) {
      P.maskPoly([...upW, ...loW.slice().reverse()], 3);
      P.mesh('mouthIn', 3, 3, (x, y) => toW([x * hw / 30, y * 0.7 + (topC + botC) / 2], 0.1), { ...opt, mat: undefined, clip: 3 });
      if (open > 0.08 || m.teeth > 0.2 || m.fv > 0.2) {
        const ty = topC - 0.5 + (m.fv > 0.3 ? 2 : 0);
        const tOpt = S.D ? { ...fopt, mat: { ...MAT.eye, mix: 0.25 }, albGain: [1.16, 1.16, 1.17] } : fopt;   // creator: brighter enamel
        P.mesh('teeth', 4, 2, (x, y) => toW([x * hw / 27, ty + y * 0.9], 0.11), { ...tOpt, clip: 3 });
        if (m.teeth > 0.2) P.mesh('teeth', 4, 2, (x, y) => toW([x * hw / 30, botC - 7 - y * 0.8], 0.11), { ...tOpt, clip: 3, opacity: 0.85 });
      }
    }
    // philtrum/under-lip shading happens on the face texture; lips on top
    const th = (1.15 + round * 0.25 + m.press * -0.2) * (Mo ? Mo.full * Math.sqrt(Mo.s) : 1), bow = Mo ? Mo.bow : 1;
    const lipO = Mo && Mo.color ? { ...opt, albGain: (opt.albGain || [1, 1, 1]).map((v, i) => v * Mo.color.gain[i]), albAdd: Mo.color.add } : opt;
    P.strip('lipUp', upW, { range: [-50, 50], scale: (s) => (0.72 + 0.12 * bow * Math.sin(s * Math.PI)) * th * this.hs, segs: 14, ...lipO });
    P.strip('lipLow', loW, { range: [-50, 50], scale: (s) => 0.78 * th * (1 - m.fv * 0.3) * this.hs, segs: 14, ...lipO });
    // mouth-space facial hair (mustaches) follows the mouth width, the upper lip and the smile
    if (S.D && facialOpt) for (const l of S.D.facial) if (l.space === 'mouth' && P.T[l.tex]) {
      const mw = hw / 24, lift = topC + Math.max(0, smile) * -2;
      P.mesh(l.tex, 8, 3, (x, y) => toW([x * mw, y + lift + (Math.abs(x) / 46) * (-smile * 5)], 0.13), facialOpt(l));
    }
  }
  drawLock(L, o) {
    this.P.strip(L.tex, L.pts, { axis: 'y', range: [0, L.len], scale: L.w * this.rs, segs: 22, cross: 3, ...o, opacity: L.alpha ?? 1, afn: (lx, ly) => smooth((ly + 4) / 40) });
  }
  drawProp(a, A, opt) {
    const P = this.P, m = M.mul(A.hand, M.trs(a.propOff ? a.propOff[0] : 0, a.propOff ? a.propOff[1] : 46, a.propRot || 0, 1.35));
    P.mesh(a.prop, 2, 2, (x, y) => M.ap(m, x, y), { ...opt, mat: MAT.prop });
  }
  drawDrops(p, S, H, t) {
    const list = [];
    for (let i = 0; i < 26; i++) {
      const fx = Math.sin(i * 12.9898) * 43758.5453 % 1, fy = Math.sin(i * 78.233) * 12543.123 % 1;
      const ph = ((t * (0.3 + Math.abs(fx) * 0.4) + Math.abs(fy)) % 1);
      const q = i < 12 ? H(fx * 90, -60 + Math.abs(fy) * 150 + ph * 20, 0.05) : M.ap(S.chest, fx * 90, -280 + Math.abs(fy) * 200 + ph * 40);
      list.push([q[0], q[1], 0, 0.7 * S.root[3], 0.7 * S.root[3], p.wet * 0.8 * Math.sin(ph * Math.PI)]);
    }
    this.P.sprites('drop', list);
  }
}

// ---------------------------------------------------------------- hair physics
// Spring chains: each point is pulled toward a target that blends head-space (root) and chest-space
// (lower, resting on the shoulders) bind positions. Deterministic fixed-step simulation.
const LOCKS = [
  { tex: 'lockA', layer: 'front', root: [-90, -46], len: 330, w: 0.8, dir: [-0.12, 1], drape: [-6, 140] },
  { tex: 'lockB', layer: 'front', root: [94, -44], len: 360, w: 0.75, dir: [0.1, 1], drape: [8, 150] },
  { tex: 'lockC', layer: 'front', root: [-72, -78], len: 250, w: 0.95, dir: [-0.22, 1], drape: [-14, 90] },
  { tex: 'lockD', layer: 'front', root: [70, -82], len: 280, w: 0.9, dir: [0.25, 1], drape: [16, 100] },
  { tex: 'lockB', layer: 'back', root: [-104, 6], len: 380, w: 1.1, dir: [-0.12, 1], drape: [-20, 120] },
  { tex: 'lockA', layer: 'back', root: [106, 10], len: 340, w: 1.1, dir: [0.12, 1], drape: [22, 120] },
  { tex: 'lockC', layer: 'mid', root: [-100, 30], len: 250, w: 1.0, dir: [-0.15, 1], drape: [-14, 60] },
];
const NPT = 9;
export class HairSim {
  // look (optional): hair length/volume and face width scale the locks
  constructor(look) {
    this.state = null;
    const D = derive(look), len = D ? D.hair.len : 1, vol = D ? D.hair.vol * D.face.width : 1;
    const src = !D || D.hair.style.locks === undefined || D.hair.style.locks === 'film' ? LOCKS : D.hair.style.locks;
    this.locks = D ? src.map(L => ({ ...L, len: L.len * (src === LOCKS ? len : 1), root: [L.root[0] * vol, L.root[1]], drape: [L.drape[0] * vol, L.drape[1] * (src === LOCKS ? len : 1)] })) : LOCKS;
  }
  // bindS: solved skeleton at the bind pose; returns per lock list of [head-local, chest-local] rest points
  bind(bindS, W0) {
    this.binds = this.locks.map(L => {
      const pts = [];
      const r0 = M.ap(bindS.head, L.root[0], L.root[1]);
      const dl = Math.hypot(L.dir[0], L.dir[1]);
      for (let i = 0; i < NPT; i++) {
        const u = i / (NPT - 1);
        const x = r0[0] + L.dir[0] / dl * L.len * u + L.drape[0] * Math.sin(u * Math.PI) * 0.6 + Math.sin(u * 5 + L.root[0]) * 6;
        const y = r0[1] + L.dir[1] / dl * L.len * u - L.drape[1] * 0.0 * u;
        pts.push([M.ap(M.inv(bindS.head), x, y), M.ap(M.inv(bindS.chest), x, y)]);
      }
      return pts;
    });
  }
  targets(S, p) {
    const turn = Math.sin(p.head.turn);
    return this.binds.map((b, li) => b.map((bp, i) => {
      const u = i / (NPT - 1), w = smooth(u * 1.6 - 0.15);
      let h = M.ap(S.head, bp[0][0] + turn * (this.locks[li].layer === 'back' ? -18 : 22) * (1 - u), bp[0][1]);
      const c = M.ap(S.chest, bp[1][0], bp[1][1]);
      return [lerp(h[0], c[0], w), lerp(h[1], c[1], w)];
    }));
  }
  reset(S, p) {
    const T = this.targets(S, p);
    this.state = { x: T.map(l => l.map(q => q.slice())), v: T.map(l => l.map(() => [0, 0])), back: [0, 0], bv: [0, 0], prevChest: M.ap(S.chest, 0, -300) };
  }
  step(S, p, dt, wind = 0) {
    const T = this.targets(S, p), st = this.state;
    T.forEach((tl, li) => {
      const xs = st.x[li], vs = st.v[li], seg = this.locks[li].len / (NPT - 1) * p.root.s;
      xs[0] = tl[0].slice(); vs[0] = [0, 0];
      for (let i = 1; i < NPT; i++) {
        const u = i / (NPT - 1), k = lerp(220, 34, u), c = 2 * Math.sqrt(k) * 0.42;
        const ax = k * (tl[i][0] - xs[i][0]) - c * vs[i][0] + wind * u * 60 * p.root.s;
        const ay = k * (tl[i][1] - xs[i][1]) - c * vs[i][1] + 30 * u * p.root.s;
        vs[i][0] += ax * dt; vs[i][1] += ay * dt;
        xs[i][0] += vs[i][0] * dt; xs[i][1] += vs[i][1] * dt;
      }
      for (let it = 0; it < 2; it++) for (let i = 1; i < NPT; i++) {
        const a = xs[i - 1], b = xs[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, f = (d - seg) / d;
        b[0] -= dx * f; b[1] -= dy * f;
      }
    });
    // back hair mass: spring on chest velocity
    const ch = M.ap(S.chest, 0, -300);
    const vx = (ch[0] - st.prevChest[0]) / dt, vy = (ch[1] - st.prevChest[1]) / dt; st.prevChest = ch;
    const k = 60, c = 7;
    st.bv[0] += (-k * st.back[0] - c * st.bv[0] - vx * 0.9 + wind * 40 * p.root.s) * dt;
    st.bv[1] += (-k * st.back[1] - c * st.bv[1] - vy * 0.5) * dt;
    st.back[0] += st.bv[0] * dt; st.back[1] += st.bv[1] * dt;
    st.back[0] = clamp(st.back[0], -60 * p.root.s, 60 * p.root.s); st.back[1] = clamp(st.back[1], -30 * p.root.s, 30 * p.root.s);
  }
  output() {
    return { back: this.state.back, locks: this.locks.map((L, li) => ({ tex: L.tex, layer: L.layer, len: L.len, w: L.w, pts: this.state.x[li] })) };
  }
}
