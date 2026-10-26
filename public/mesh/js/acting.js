// Acting: expression and gesture libraries, blended from the shared performance track.
import { clamp, lerp, smooth, ease } from './draw.js';
import { basePose } from './heroine.js';

export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const noise = (t, seed = 0) => { const i = Math.floor(t), f = t - i, a = hash(i + seed * 101), b = hash(i + 1 + seed * 101); const k = f * f * (3 - 2 * f); return a + (b - a) * k - 0.5; };

// ---------------------------------------------------------------- expressions -> face params
// brow: [left,right] {y, inner, outer}; lid: {open, squint, happy}; mouth: {smile, smirk, open, wide, round, teeth, press}
const E = {
  neutral: { smile: 0.12 },
  happy: { smile: 0.7, cheek: 0.45, squint: 0.3, browY: 0.2, wide: 0.25, blush: 0.75 },
  excited: { smile: 0.85, cheek: 0.35, open: 1.18, browY: 0.75, wide: 0.3, blush: 0.8, mOpen: 0.12 },
  smirk: { smile: 0.38, smirk: 0.65, browL: -0.25, browR: 0.45, open: 0.86, tilt: 0.06 },
  sheepish: { smile: 0.3, smirk: 0.25, browInner: 0.75, open: 0.82, gaze: [-0.6, 0.5], tilt: -0.08, blush: 0.9 },
  proud: { smile: 0.62, cheek: 0.3, open: 0.78, browY: 0.15, nod: -0.1, squint: 0.15 },
  wink: { smile: 0.75, smirk: 0.35, cheek: 0.55, winkL: 1, browL: -0.35, browR: 0.3, tilt: 0.08, blush: 0.85 },
  surprised: { browY: 1, open: 1.28, round: 0.45, mOpen: 0.22, smile: 0 },
  shocked: { browY: 1.25, open: 1.4, round: 0.35, mOpen: 0.5, smile: -0.1, nod: 0.05 },
  cringe: { browInner: 0.85, browY: 0.1, open: 0.55, squint: 0.6, wide: 0.9, teeth: 1, smile: -0.15, tilt: -0.1, mOpen: 0.05 },
  deadpan: { open: 0.6, browY: -0.25, smile: 0, press: 0.45 },
  sad: { browInner: 1, browOuter: -0.35, smile: -0.6, open: 0.72, gaze: [0, 0.55], blush: 0.65 },
  laugh: { smile: 1, cheek: 0.75, happy: 0.95, open: 0.15, mOpen: 0.38, wide: 0.4, browY: 0.35, nod: -0.08, blush: 0.95 },
  awe: { browY: 0.7, open: 1.18, round: 0.3, mOpen: 0.2, smile: 0.25, blush: 0.7 },
  determined: { browInner: -0.65, browY: -0.1, open: 0.86, smile: 0.1, press: 0.35 },
  strain: { browInner: -0.5, browY: 0.15, open: 0.62, squint: 0.55, wide: 0.7, teeth: 1, smile: -0.1, mOpen: 0.06 },
  worried: { browInner: 1, browY: 0.2, open: 1.08, smile: -0.3, round: 0.1 },
  scared: { browInner: 1.2, browY: 0.6, open: 1.22, smile: -0.45, wide: -0.2, mOpen: 0.15 },
  suspicious: { open: 0.55, browL: -0.6, browR: 0.45, smirk: -0.35, smile: 0.05, gaze: [0.7, 0], tilt: -0.05 },
  // creator showreel faces (the film never asks for these)
  angry: { browInner: -1.15, browY: -0.35, open: 0.82, squint: 0.35, smile: -0.5, press: 0.55, wide: 0.25, blush: 0.75 },
  thinking: { open: 0.88, browL: 0.45, browR: -0.15, smirk: 0.25, smile: 0.08, press: 0.3, gaze: [0.55, -0.6], tilt: 0.05 },
  confused: { open: 1.02, browL: 0.65, browR: -0.45, browInner: 0.35, smile: -0.12, smirk: -0.35, gaze: [-0.25, -0.15], tilt: -0.06 },
  dreamy: { smile: 0.6, cheek: 0.35, happy: 0.7, open: 0.5, browY: 0.25, gaze: [0.1, -0.55], blush: 1, tilt: 0.06 },
  sleepy: { open: 0.35, browY: -0.15, browInner: 0.3, smile: 0, mOpen: 0.04, round: 0.15 },
  pout: { open: 0.9, browInner: 0.55, smile: -0.25, round: 0.45, press: 0.35, gaze: [0.45, 0.1], blush: 0.8 },
  nervous: { open: 1.06, browInner: 0.95, browY: 0.15, smile: 0.38, teeth: 0.8, wide: 0.65, squint: 0.15, blush: 0.85 },
  bigGrin: { smile: 1, cheek: 0.75, happy: 0.45, teeth: 1, wide: 0.6, mOpen: 0.14, browY: 0.45, open: 0.9, blush: 0.9 },
  curious: { open: 1.12, browY: 0.5, browL: 0.25, smile: 0.2, gaze: [0.5, 0], tilt: 0.08 },
  shush: { open: 0.95, browY: 0.3, smile: 0.15, round: 0.55, press: 0.2, gaze: [0, 0], tilt: 0.04 },
};
export function applyExpr(p, weights, mouthTrack, extra = {}) {
  const acc = {};
  for (const [name, w] of Object.entries(weights)) {
    const e = E[name] || E.neutral;
    for (const [k, v] of Object.entries(e)) {
      if (Array.isArray(v)) { acc[k] = acc[k] || [0, 0]; acc[k][0] += v[0] * w; acc[k][1] += v[1] * w; }
      else acc[k] = (acc[k] || 0) + v * w;
    }
    for (const k of ['open', 'blush']) if (e[k] === undefined) acc[k] = (acc[k] || 0) + (k === 'open' ? 1 : 0.55) * w;
  }
  const f = p.face, g = (k, d = 0) => acc[k] ?? d;
  const by = g('browY'), bi = g('browInner'), bo = g('browOuter');
  f.brow[0] = { y: by + g('browL'), inner: bi, outer: bo };
  f.brow[1] = { y: by + g('browR'), inner: bi, outer: bo };
  const open = g('open', 1), sq = g('squint'), hp = g('happy');
  f.lid[0] = { open: lerp(open, 0, g('winkL')), squint: sq + g('winkL') * 0.5, happy: Math.max(hp, g('winkL')) };
  f.lid[1] = { open, squint: sq + g('winkL') * 0.25, happy: hp };
  const sm = Math.max(0, g('smile')); f.lid[0].squint += sm * 0.3; f.lid[1].squint += sm * 0.3;
  f.cheek = g('cheek'); f.blush = g('blush', 0.55);
  const m = f.mouth, mt = mouthTrack || { open: 0, wide: 0, round: 0, closed: 0, fv: 0, teeth: 0 };
  const talk = mt.open;
  m.smile = g('smile') * (1 - talk * 0.45);
  m.smirk = g('smirk');
  m.open = clamp(g('mOpen') * (1 - mt.closed) + talk * 0.85);
  m.wide = clamp(g('wide') * 0.6 + mt.wide * 0.7 * talk + (1 - talk) * g('wide') * 0.4, -1, 1);
  m.round = clamp(g('round') + mt.round * 0.9);
  m.teeth = clamp(g('teeth') + (mt.teeth || 0) * 0.8);
  m.press = clamp(g('press') + mt.closed * 0.6);
  m.fv = mt.fv;
  const gz = g('gaze', null);
  if (gz) { p.gaze[0] += gz[0]; p.gaze[1] += gz[1]; }
  p.head.rot += g('tilt'); p.head.nod += g('nod');
  return acc;
}

// ---------------------------------------------------------------- talk gestures (pelvis-local wrist targets)
const IDLE = { n: [-110, 26], f: [110, 26], nh: 'handRelax', fh: 'handRelax', nr: 0.05, fr: -0.05 };
const G = {
  none: IDLE,
  lean: { ...IDLE, lean: 1 },
  handsUp: { n: [-190, -300], f: [190, -300], nh: 'handOpen', fh: 'handOpen', nr: 0.15, fr: -0.15, shrug: 0.3, chest: -0.02 },
  pointSelf: { n: [-14, -206], f: [96, -12], nh: 'handPoint', fh: 'handRelax', nr: -0.35, fr: 0, nfront: true, fb: 1 },
  fist: { n: [-150, -258], f: [110, 26], nh: 'handFist', fh: 'handRelax', nr: 0.1, fr: 0, chest: -0.04 },
  handsOut: { n: [-224, -96], f: [224, -96], nh: 'handOpen', fh: 'handOpen', nr: -0.9, fr: 0.9, shrug: 0.25 },
  facepalm: { n: [-6, -436], f: [102, 0], nh: 'handOpen', fh: 'handRelax', nr: 0.15, fr: 0, overFace: true, nscale: 1.18, headRot: 0.12, nod: 0.18 },
  hug: { n: [86, -190], f: [-70, -168], nh: 'handHold', fh: 'handHold', nr: -0.8, fr: 0.9, nfront: true, ffront: true, shrug: 0.5, fb: 1 },
  shrug: { n: [-188, -40], f: [188, -40], nh: 'handOpen', fh: 'handOpen', nr: -1.15, fr: 1.15, shrug: 1, headRot: 0.1 },
  countOne: { n: [-148, -262], f: [110, 26], nh: 'handPoint', fh: 'handRelax', nr: 0.08, fr: 0 },
  point: { n: [-60, -188], f: [96, -12], nh: 'handPoint', fh: 'handRelax', nr: 0.2, fr: 0, nscale: 1.3, nfront: true, lean: 0.6 },
};
export function applyGesture(p, s, t) {
  const g = s.gesture, cur = G[g.name] || IDLE, prev = G[g.prev] || IDLE;
  const k = ease(clamp(g.age / 0.42));
  const pick = (key, d) => lerp(prev[key] ?? d, cur[key] ?? d, k);
  // gesture "beats": while a gesture holds, the hands pulse with stressed words
  const beat = s.emph * 0.5 + noise(t * 1.3, 3) * 0.4;
  const [n, f] = p.arms;
  n.target = [lerp(prev.n[0], cur.n[0], k) + beat * 10, lerp(prev.n[1], cur.n[1], k) - beat * 14 + noise(t * 0.7, 1) * 8];
  f.target = [lerp(prev.f[0], cur.f[0], k) - beat * 6, lerp(prev.f[1], cur.f[1], k) - beat * 8 + noise(t * 0.6, 2) * 8];
  // anticipation overshoot on a new gesture
  const ov = Math.sin(clamp(g.age / 0.55) * Math.PI) * (g.age < 0.55 ? 1 : 0) * 0.12;
  n.target[1] += (cur.n[1] - prev.n[1]) * ov; f.target[1] += (cur.f[1] - prev.f[1]) * ov;
  n.hand = k > 0.5 ? cur.nh : prev.nh; f.hand = k > 0.5 ? cur.fh : prev.fh;
  n.handRot = pick('nr', 0); f.handRot = pick('fr', 0);
  n.handScale = pick('nscale', 1); f.handScale = 1;
  n.front = (k > 0.5 ? cur.nfront : prev.nfront) || false; f.front = (k > 0.5 ? cur.ffront : prev.ffront) || false;
  f.bend = (k > 0.5 ? cur.fb : prev.fb) ? -1 : 1;
  p.handOverFace = k > 0.35 ? !!cur.overFace : !!prev.overFace;
  const sh = pick('shrug', 0); p.shrug = [sh, sh];
  p.chestRot += pick('chest', 0);
  p.lean = pick('lean', 0);
  p.head.rot += pick('headRot', 0); p.head.nod += pick('nod', 0);
}

// ---------------------------------------------------------------- talk shot pose
export function talkPose(s, t) {
  const p = basePose();
  const brth = Math.sin(t * 2 * Math.PI / 3.6);
  p.breath = brth;
  // weight shift + idle sway
  const sway = noise(t * 0.35, 7) * 2;
  p.pelvis.x = sway * 6; p.pelvis.rot = sway * 0.025;
  p.chestRot = -sway * 0.03 + noise(t * 0.5, 8) * 0.02;
  // head: talking bob, emphasis nods, slow drift, saccade-like gaze shifts
  const talk = s.mouth.open;
  p.head.rot = noise(t * 0.45, 9) * 0.09 + s.emph * 0.03;
  p.head.nod = noise(t * 0.6, 10) * 0.12 + s.emph * 0.12 + talk * 0.03;
  p.head.turn = 0.1 + noise(t * 0.3, 11) * 0.22;
  const sac = Math.floor(t * 0.9 + hash(Math.floor(t * 0.9)) * 0.6);
  p.gaze = [(hash(sac * 3.1) - 0.5) * 0.35, (hash(sac * 5.7) - 0.5) * 0.2];
  p.blink = s.blink;
  applyGesture(p, s, t);
  applyExpr(p, s.expr, s.mouth);
  // lean toward camera: grow + drop a little
  p.root.s = 1 + p.lean * 0.06; p.pelvis.y += p.lean * 12; p.head.nod += p.lean * 0.06;
  p.legs.forEach(l => l.show = false);
  return p;
}
