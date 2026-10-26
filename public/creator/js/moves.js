// Body moves for the creator's "Moves" mode: a looping showreel of full-body actions that exercise
// the rig (shoulders, elbows, wrists, hands over the face, hips, knees, jumps, head turns).
// Each move returns arm wrist targets in pelvis-local chest space (same space as acting.js gestures,
// before fitArms widens them for the body) plus body offsets, as a function of its age in seconds.
//   n = near arm (screen-left, x < 0), f = far arm (screen-right, x > 0)
//   arm: { t: [x, y], h: hand texture, r: hand rotation, front, over (in front of the face), bend: ±1, s: hand scale }
//   body: { px, prot, chest, ry (jump, up is negative), rot (head tilt), turn, nod, shrug, squat, mouth }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const wave = (t, hz, ph = 0) => Math.sin((t * hz + ph) * Math.PI * 2);
const pulse = (t, hz) => 0.5 - 0.5 * Math.cos(t * hz * Math.PI * 2);   // 0..1..0
const REST_N = { t: [-110, 26], h: 'handRelax', r: 0.05 }, REST_F = { t: [110, 26], h: 'handRelax', r: -0.05 };

export const MOVES = [
  { key: 'wave', label: 'Wave hello', expr: { happy: 1 }, dur: 3,
    pose: (a) => ({ n: { t: [-205 + wave(a, 2.2) * 26, -392], h: 'handOpen', r: 0.25 + wave(a, 2.2) * 0.38 }, f: REST_F,
      body: { rot: -0.05, shrug: 0.15, px: -4 } }) },
  { key: 'clap', label: 'Clap', expr: { excited: 1 }, dur: 3,
    pose: (a) => { const s = 26 + 40 * pulse(a, 2.4); return {
      n: { t: [-s, -205], h: 'handOpen', r: -1.2, front: true }, f: { t: [s, -205], h: 'handOpen', r: 1.2, front: true, bend: -1 },
      body: { nod: -0.05 + pulse(a, 2.4) * 0.04, shrug: 0.2 } }; } },
  { key: 'think', label: 'Thinking', expr: { thinking: 1 }, dur: 3.4,
    pose: (a) => ({ n: { t: [-14, -352], h: 'handFist', r: -0.2, front: true, s: 1.05 }, f: { t: [-48, -152], h: 'handHold', r: 0.9, front: true, bend: -1 },
      body: { rot: 0.07 + wave(a, 0.3) * 0.03, turn: 0.12, chest: 0.02 } }) },
  { key: 'cheer', label: 'Cheer and jump', expr: { bigGrin: 1 }, dur: 3,
    pose: (a) => { const j = Math.max(0, wave(a, 1.4)) ; return {
      n: { t: [-170, -430 - j * 30], h: 'handFist', r: 0.2 }, f: { t: [170, -430 - j * 30], h: 'handFist', r: -0.2 },
      body: { ry: -j * 70, squat: Math.max(0, -wave(a, 1.4)) * 0.6, shrug: 0.5, nod: -0.08 } }; } },
  { key: 'dance', label: 'Dance', expr: { laugh: 0.6, bigGrin: 0.4 }, dur: 4, laugh: true,
    pose: (a) => { const s = wave(a, 1.1), u = wave(a, 2.2); return {
      n: { t: [-150 - s * 30, -250 + s * 120], h: s > 0 ? 'handRelax' : 'handOpen', r: 0.3 * s }, f: { t: [150 - s * 30, -250 - s * 120], h: s > 0 ? 'handOpen' : 'handRelax', r: 0.3 * s },
      body: { px: s * 22, prot: s * 0.09, chest: -s * 0.07, rot: -s * 0.08, nod: u * 0.05, ry: -Math.abs(u) * 10, squat: (1 - Math.abs(u)) * 0.25 } }; } },
  { key: 'stretch', label: 'Stretch and yawn', expr: { sleepy: 1 }, dur: 3.6, mouth: (a) => clamp(Math.sin(clamp(a / 3) * Math.PI) * 1.2) * 0.9,
    pose: (a) => { const k = Math.sin(clamp(a / 3.2) * Math.PI); return {
      n: { t: [-lerp(110, 80, k), lerp(26, -505, k)], h: k > 0.4 ? 'handOpen' : 'handRelax', r: lerp(0.05, -0.4, k) }, f: { t: [lerp(110, 80, k), lerp(26, -505, k)], h: k > 0.4 ? 'handOpen' : 'handRelax', r: lerp(-0.05, 0.4, k) },
      body: { chest: -0.04 * k, nod: -0.18 * k, ry: -8 * k, shrug: 0.6 * k } }; } },
  { key: 'heart', label: 'Hand on heart', expr: { dreamy: 1 }, dur: 3,
    pose: (a) => ({ n: { t: [32, -232], h: 'handHold', r: -0.9, front: true }, f: { t: [64, -200], h: 'handHold', r: 0.8, front: true, bend: -1 },
      body: { rot: 0.1 + wave(a, 0.4) * 0.03, px: wave(a, 0.4) * 4 } }) },
  { key: 'cross', label: 'Arms crossed', expr: { pout: 1 }, dur: 3,
    pose: (a) => ({ n: { t: [78, -176], h: 'handHold', r: -0.8, front: true }, f: { t: [-66, -158], h: 'handHold', r: 0.9, front: true, bend: -1 },
      body: { shrug: 0.45, rot: -0.07, turn: -0.15, nod: 0.03 + wave(a, 0.5) * 0.02 } }) },
  { key: 'angry', label: 'Angry stomp', expr: { angry: 1 }, dur: 2.6,
    pose: (a) => { const st = Math.max(0, wave(a, 1.6)); return {
      n: { t: [-138, -24], h: 'handFist', r: 0.1 }, f: { t: [138, -24], h: 'handFist', r: -0.1 },
      body: { shrug: 0.8, ry: st * 6, squat: st * 0.35, nod: 0.08, rot: wave(a, 6) * 0.015 } }; } },
  { key: 'shush', label: 'Shh', expr: { shush: 1 }, dur: 2.6,
    pose: (a) => ({ n: { t: [-8, -348], h: 'handPoint', r: 0.02, front: true, over: true, s: 1.05 }, f: REST_F, body: { rot: 0.05, nod: -0.04 } }) },
  { key: 'look', label: 'Look around', expr: { curious: 1 }, dur: 3.8,
    pose: (a) => { const s = wave(a, 0.35); return {
      n: { t: [-30, -446], h: 'handOpen', r: -1.25, front: true, over: true }, f: { t: [118, 10], h: 'handRelax', r: -0.05 },
      body: { turn: s * 0.5, rot: -s * 0.05, nod: -0.05, px: s * 8, prot: s * 0.03 } }; } },
  { key: 'nervous', label: 'Nervous', expr: { nervous: 1 }, dur: 3,
    pose: (a) => { const r = wave(a, 2.6); return {
      n: { t: [-26 + r * 8, -150], h: 'handHold', r: -1, front: true }, f: { t: [26 + r * 8, -144], h: 'handHold', r: 1, front: true, bend: -1 },
      body: { shrug: 0.55, nod: 0.06, rot: wave(a, 0.8) * 0.04, px: wave(a, 0.8) * 6 } }; } },
  { key: 'salute', label: 'Salute', expr: { determined: 1 }, dur: 2.6,
    pose: (a) => ({ n: { t: [-92, -436], h: 'handOpen', r: -0.95 }, f: { t: [112, 20], h: 'handFist', r: 0 }, body: { chest: -0.02, nod: -0.04 } }) },
  { key: 'beckon', label: 'Come here', expr: { smirk: 1 }, dur: 3,
    pose: (a) => { const c = pulse(a, 1.6); return {
      n: { t: [-176, -196 - c * 20], h: c > 0.5 ? 'handHold' : 'handOpen', r: -0.6 - c * 0.5 }, f: { t: [110, 22], h: 'handRelax', r: -0.05 },
      body: { rot: 0.06, nod: -0.04 + c * 0.03 } }; } },
  { key: 'stop', label: 'Stop!', expr: { determined: 0.6, surprised: 0.4 }, dur: 2.4,
    pose: (a) => ({ n: REST_N, f: { t: [150, -280], h: 'handOpen', r: 0.05, s: 1.15 }, body: { chest: 0.03, nod: 0.05, rot: -0.04 } }) },
  { key: 'confused', label: 'Confused', expr: { confused: 1 }, dur: 3,
    pose: (a) => ({ n: { t: [-70, -470], h: 'handPoint', r: -0.5, front: true, over: true }, f: { t: [180, -46], h: 'handOpen', r: 1.1 },
      body: { rot: -0.12, shrug: 0.4 + pulse(a, 0.8) * 0.2 } }) },
];

// arm/body config of move m at age a (seconds)
const cfgAt = (m, a) => { const c = m.pose(a); return { n: { ...REST_N, ...c.n }, f: { ...REST_F, ...c.f }, b: c.body || {} }; };

// which move is playing at time t, with the previous one for blending
export function moveAt(t) {
  const total = MOVES.reduce((s, m) => s + m.dur, 0), tt = ((t % total) + total) % total;
  let acc = 0, i = 0;
  while (i < MOVES.length - 1 && tt >= acc + MOVES[i].dur) acc += MOVES[i++].dur;
  const prev = MOVES[(i + MOVES.length - 1) % MOVES.length];
  return { m: MOVES[i], prev, age: tt - acc, prevDur: prev.dur };
}

// write the move into pose p (call after talkPose, before fitArms)
export function applyMove(p, t) {
  const { m, prev, age, prevDur } = moveAt(t);
  const k = ease(clamp(age / 0.5)), cur = cfgAt(m, age), old = cfgAt(prev, prevDur);
  const arm = (i, c, o) => {
    const A = p.arms[i];
    A.target = [lerp(o.t[0], c.t[0], k), lerp(o.t[1], c.t[1], k)];
    A.hand = k > 0.5 ? c.h : o.h; A.handRot = lerp(o.r ?? 0, c.r ?? 0, k); A.handScale = lerp(o.s ?? 1, c.s ?? 1, k);
    A.front = !!(k > 0.5 ? c.front : o.front);
    if (i === 1) A.bend = (k > 0.5 ? c.bend : o.bend) === -1 ? -1 : 1;
  };
  arm(0, cur.n, old.n); arm(1, cur.f, old.f);
  p.handOverFace = !!(k > 0.35 ? cur.n.over : old.n.over);
  const b = (key) => lerp(old.b[key] ?? 0, cur.b[key] ?? 0, k);
  p.pelvis.x += b('px'); p.pelvis.rot += b('prot'); p.chestRot += b('chest');
  p.head.rot += b('rot'); p.head.turn += b('turn'); p.head.nod += b('nod');
  const sh = b('shrug'); p.shrug = [sh, sh];
  p.root.y += b('ry');
  return { move: m, age, squat: b('squat') };
}

// play one move by key on a character's own clock (the stage): blend from the previous move
// over the first half second. Returns the crouch amount for the legs (0 = standing).
export const MOVE_BY_KEY = Object.fromEntries(MOVES.map(m => [m.key, m]));
export function poseMove(p, key, age, fromKey = null, fromAge = 9) {
  const m = MOVE_BY_KEY[key]; if (!m) return 0;
  const prev = MOVE_BY_KEY[fromKey];
  const k = prev ? ease(clamp(age / 0.5)) : 1, cur = cfgAt(m, age), old = prev ? cfgAt(prev, fromAge) : cur;
  const arm = (i, c, o) => {
    const A = p.arms[i];
    A.target = [lerp(o.t[0], c.t[0], k), lerp(o.t[1], c.t[1], k)];
    A.hand = k > 0.5 ? c.h : o.h; A.handRot = lerp(o.r ?? 0, c.r ?? 0, k); A.handScale = lerp(o.s ?? 1, c.s ?? 1, k);
    A.front = !!(k > 0.5 ? c.front : o.front);
    if (i === 1) A.bend = (k > 0.5 ? c.bend : o.bend) === -1 ? -1 : 1;
  };
  arm(0, cur.n, old.n); arm(1, cur.f, old.f);
  p.handOverFace = !!(k > 0.35 ? cur.n.over : old.n.over);
  const b = (q) => lerp(old.b[q] ?? 0, cur.b[q] ?? 0, k);
  p.pelvis.x += b('px'); p.pelvis.rot += b('prot'); p.chestRot += b('chest');
  p.head.rot += b('rot'); p.head.turn += b('turn'); p.head.nod += b('nod');
  const sh = b('shrug'); p.shrug = [sh, sh];
  p.root.y += b('ry');
  return b('squat');
}
