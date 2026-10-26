// Standing, stance and walking poses shared by the creator preview and the Storybuddy stage.
import { lerp, ease } from '../../mesh/js/draw.js';
import { basePose, shoulderDrop } from '../../mesh/js/heroine.js';
import { applyExpr } from '../../mesh/js/acting.js';
import { torsoWidth } from '../../mesh/js/look.js';
export const QUIET = { open: 0, wide: 0, round: 0, closed: 0, fv: 0, teeth: 0 };
export const blinkAt = (t, seed = 0) => { const k = Math.floor((t + seed) / 3.3), bt = k * 3.3 + 1.7 + Math.sin(k * 12.9 + seed) * 0.8 - seed, d = Math.abs(t - bt); return d < 0.09 ? 1 - d / 0.09 : 0; };

// ---------------------------------------------------------------- poses
// relaxed stance: feet under the hip joints, weight on one leg (that hip rises, the other knee softens)
// Both legs stay perfectly straight from the hip socket to the floor: the weight shift lives in the
// pelvis (tilted, shifted over the standing leg), and each ankle lands where a straight leg meets the
// ground, a little outward, so knees never pinch or bow.
export function standLegs(p, D) {
  p.pelvis.x += 10; p.pelvis.rot += 0.055; p.chestRot -= 0.05; p.head.rot -= 0.02;
  const L = (D.legT + D.legS) * 0.997, hx = 44 * D.hips * 0.8, r = p.pelvis.rot, c = Math.cos(r), s = Math.sin(r);   // feet at hip width
  const hips = [-1, 1].map(side => [p.pelvis.x + c * side * hx - s * 12, p.pelvis.y + s * side * hx + c * 12]);
  const drop = Math.max(...hips.map(h => -50 - h[1])) - L * Math.cos(0.012);     // lower the pelvis until the longer reach fits
  if (drop > 0) { p.pelvis.y += drop; hips.forEach(h => h[1] += drop); }
  hips.forEach((h, i) => {
    const dy = -50 - h[1], dx = Math.sqrt(Math.max(0, L * L - dy * dy));
    p.legs[i].ankle = [h[0] + (i ? 1 : -1) * dx, -50]; p.legs[i].footRot = 0; p.legs[i].show = true;
  });
  p.gear.boots = true;
}
// idle stances: wrist targets in chest space relative to the body's own widths
// idle stances: wrist targets in chest space relative to the body's own widths
export const STANCES = { pockets: 'Hands in pockets', relaxed: 'Relaxed', hip: 'Hand on hip', hips: 'Hands on hips' };
export function stanceArms(p, D, kind, k) {
  const hip = 104 * torsoWidth(D, 10), waist = 104 * torsoWidth(D, -90);
  p.arms.forEach((a, i) => {
    const side = i ? 1 : -1, hang = hangTarget(D, i);
    let t = hang, rot = side * 0.08, hand = 'handRelax', pocket = false, pole = null;
    if (kind === 'pockets') { t = [side * hip * 0.66, 32]; rot = side * -0.35; pocket = true; pole = [side * (hip + 60), -60]; }   // wrist into the front pocket; elbow close to the body
    else if ((kind === 'hip' && i === 1) || kind === 'hips') {   // hand planted on the hip, elbow out and back; sizes follow the body
      const L = D.armU + D.armL;
      t = [side * (waist * 1.04 + 10 * D.body.forearm), -70 * D.torsoH]; rot = side * -0.7; hand = 'handFist'; pole = [side * (waist + L * 0.9), -278 * D.torsoH + L * 0.2];
    }
    else hand = 'handRelax';   // a hanging hand stays softly curled
    a.target = [lerp(a.target[0], t[0], k), lerp(a.target[1], t[1], k)]; a.handRot = lerp(a.handRot, rot, k);
    if (k > 0.5) { a.hand = hand; a.pocket = pocket; if (pole) a.pole = pole; }
  });
}
// gesture wrist targets were authored for the film body: push them out with a wider torso
// gesture wrist targets were authored for the film body: push them out with a wider torso
export function fitArms(p, D) { for (const a of p.arms) { const y = a.target[1] * D.torsoH, k = Math.max(D.shoulders, torsoWidth(D, a.target[1])); a.target = [a.target[0] + (Math.abs(a.target[0]) > 60 ? Math.sign(a.target[0]) * 104 * (D.shoulders - 1) : 0), y]; } }   // gestures move with the shoulder socket, keeping their shape on wide frames
// a relaxed arm hangs almost straight from the shoulder, the hand just clear of the hip
// a relaxed arm hangs almost straight from the shoulder, the hand just clear of the hip
export function hangTarget(D, i, swing = 0) {
  const side = i ? 1 : -1, shX = 104 * D.shoulders, shY = -278 * D.torsoH + shoulderDrop(D), L = (D.armU + D.armL) * 0.965;
  const hipClear = 104 * torsoWidth(D, 0) + 24 * D.body.forearm, x = Math.max(shX + 6, hipClear);
  const dx = Math.min(L * 0.9, x - shX), dy = Math.sqrt(L * L - dx * dx);
  return [side * (shX + dx) + swing, shY + dy];
}
// how much of the authored gesture to replace with the relaxed hang (idle poses only)
// how much of the authored gesture to replace with the relaxed hang (idle poses only)
export const REST = { none: 1, lean: 1 };
export function relaxArms(p, D, g) {
  const k = lerp(REST[g.prev] || 0, REST[g.name] || 0, g.blend);
  if (k <= 0) return;
  p.arms.forEach((a, i) => { const h = hangTarget(D, i); a.target = [lerp(a.target[0], h[0], k), lerp(a.target[1], h[1], k)]; a.handRot = lerp(a.handRot, (i ? -1 : 1) * 0.08, k); });
}
// name of the move playing in Moves mode, shown over the stage
export function walkPose(t, D, look) {
  const p = basePose(); p.look = look;
  const ph = t / 1.05, w = 2 * Math.PI * ph, stride = 150 * D.legT / 210;
  p.breath = Math.sin(t * 2 * Math.PI / 3.6);
  p.pelvis.y = D.pelvisY + 9 * D.legT / 210 * Math.cos(2 * w) - 6; p.pelvis.rot = 0.025 * Math.sin(w);
  p.chestRot = -0.03 * Math.sin(w) + 0.04;
  for (let i = 0; i < 2; i++) {
    const f = ((ph + i * 0.5) % 1 + 1) % 1, side = i ? 22 : -18;
    let x, y = -50, rot = 0;
    if (f < 0.6) { x = stride * (0.5 - f / 0.6); rot = f > 0.45 ? -(f - 0.45) / 0.15 * 0.3 : 0; }
    else { const e = (f - 0.6) / 0.4; x = lerp(-stride / 2, stride / 2, ease(e)); y = -50 - Math.sin(Math.PI * e) * 46 * D.legT / 210; rot = lerp(-0.3, 0.1, e); }
    p.legs[i].ankle = [x + side * D.hips, y]; p.legs[i].footRot = rot; p.legs[i].show = true;
  }
  const sw = Math.cos(w);
  const h0 = hangTarget(D, 0), h1 = hangTarget(D, 1), sl = (D.armU + D.armL) * 0.22;   // swing forward/back about a relaxed hang
  p.arms[0].target = [h0[0] - sl * sw, h0[1] - Math.abs(sw) * sl * 0.18];
  p.arms[1].target = [h1[0] + sl * sw, h1[1] - Math.abs(sw) * sl * 0.18];
  p.head.turn = 0.22 + Math.sin(t * 0.4) * 0.06; p.head.nod = 0.04 * Math.cos(2 * w); p.head.rot = 0.02 * Math.sin(w);
  p.gaze = [0.3, 0]; p.blink = blinkAt(t);
  p.gear.boots = true;
  applyExpr(p, { happy: 0.8, proud: 0.2 }, QUIET);
  return p;
}
