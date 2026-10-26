// Mii-style creator on top of the mesh heroine: pick styles, nudge features with the arrow keys,
// resize them, choose a body preset, and watch the same rig talk / emote / walk live.
import { Renderer } from '../../mesh/js/gl.js';
import { Painter, M, clamp, lerp, smooth, ease } from '../../mesh/js/draw.js';
import { Heroine, HairSim, solve, basePose, PELVIS_Y, shoulderDrop } from '../../mesh/js/heroine.js';
import { applyMove, moveAt } from './moves.js';
import { talkPose, applyExpr } from '../../mesh/js/acting.js';
import { makeLook, derive, torsoWidth, STYLES, BODIES, SKIN_SWATCH, HAIR_COLORS, EYE_COLORS, LIP_COLORS, SHADOW_COLORS, CLOTH_COLORS, SEX_DEFAULTS, RANGE, GLASS_COLORS } from '../../mesh/js/look.js';
import { glyph, ICONS } from './glyphs.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#c'), R = new Renderer(canvas, { ssaa: 2 });
const TL = window.TIMELINE, Perf = window.Perf(TL);
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

// ---------------------------------------------------------------- state
let look = upgrade(store.get('creator.look')) || makeLook();
let mode = store.get('creator.mode') || 'talk', view = store.get('creator.view') || 'portrait', cat = 'eyes', sound = false;
function upgrade(saved) { if (!saved) return null; const L = makeLook(); for (const k of Object.keys(L)) if (saved[k] && typeof L[k] === 'object') Object.assign(L[k], saved[k]); if (saved.sex) L.sex = saved.sex; if (saved.name) L.name = saved.name; if (saved.pose) L.pose = saved.pose; return L; }
function changed() { look.rev++; store.set('creator.look', look); renderPanel(); renderChrome(); }
// undo / redo: every edit snapshots the recipe first (a slider drag counts as one edit)
const hist = [], fut = [];
const ser = (L) => { const { rev, ...j } = L; return JSON.stringify(j); };
function snap() { hist.push(ser(look)); if (hist.length > 200) hist.shift(); fut.length = 0; }
function edit(fn) { snap(); fn(); changed(); }
function undo() { if (!hist.length) return toast('Nothing to undo'); fut.push(ser(look)); look = upgrade(JSON.parse(hist.pop())); changed(); toast(`Undo (${hist.length} more)`); }
function redo() { if (!fut.length) return toast('Nothing to redo'); hist.push(ser(look)); look = upgrade(JSON.parse(fut.pop())); changed(); toast('Redo'); }

// ---------------------------------------------------------------- textures
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });
// only the heroine's parts (+ backdrop): the film's set plates and goat aren't needed here
const NEED = new Set(['arm', 'backpack', 'blush', 'boot', 'brow', 'catch', 'cup', 'dot', 'ear', 'eyeshadow', 'face', 'granola', 'hairBack', 'hairCap',
  'handFist', 'handHold', 'handOpen', 'handPoint', 'handRelax', 'iris', 'lashLow', 'lashUp', 'leg', 'lipLow', 'lipUp', 'lockA', 'lockB', 'lockC', 'lockD',
  'map', 'mouthIn', 'nose', 'phone', 'sclera', 'straps', 'studio', 'teeth', 'torso', 'drop']);
async function loadSet(base, keep, T) {
  const meta = await (await fetch(base + 'meta.json')).json();
  await Promise.all(Object.entries(meta).filter(([k]) => keep(k)).map(async ([k, m]) => {
    const img = await loadImg(base + k + '.png');
    T[k] = { ...R.texture(img), box: m.box, D: m.D };
    if (m.nrm) T[k].nrm = R.normalTex(await loadImg(base + k + '_n.png'));
  }));
}
async function loadTextures() {
  const T = {};
  await Promise.all([loadSet(new URL('../../mesh/tex/', import.meta.url).href, k => NEED.has(k), T),     // the film heroine's parts
                     loadSet(new URL('../tex/', import.meta.url).href, () => true, T)]);                    // wardrobe, short hair, beards
  return T;
}

// ---------------------------------------------------------------- performance
const TALK = [TL.lines[0].start - 0.4, TL.lines[1].end + 0.8];      // "Okay. So you are not going to believe..."
const EXPRS = [['happy', 'none'], ['excited', 'handsUp'], ['wink', 'point'], ['surprised', 'handsOut'], ['sad', 'hug'],
  ['laugh', 'none'], ['smirk', 'shrug'], ['cringe', 'facepalm'], ['awe', 'none'], ['determined', 'fist'], ['suspicious', 'none'], ['proud', 'countOne'],
  ['bigGrin', 'handsUp'], ['angry', 'fist'], ['thinking', 'none'], ['confused', 'shrug'], ['dreamy', 'none'], ['nervous', 'none'], ['pout', 'none'], ['curious', 'lean'], ['sleepy', 'none'], ['worried', 'none'], ['shocked', 'handsOut'], ['sheepish', 'none']];
const QUIET = { open: 0, wide: 0, round: 0, closed: 0, fv: 0, teeth: 0 };
const blinkAt = (t) => { const k = Math.floor(t / 3.3), bt = k * 3.3 + 1.7 + Math.sin(k * 12.9) * 0.8, d = Math.abs(t - bt); return d < 0.09 ? 1 - d / 0.09 : 0; };
// a wink is a quick close-and-open (~0.35 s) at the start of the expression, then a plain smile
const winkPulse = (age) => smooth((age - 0.04) / 0.08) * (1 - smooth((age - 0.3) / 0.12));
const WINK_CUES = TL.lines.flatMap(l => l.cues.filter(c => c.k === 'e' && c.v === 'wink').map(c => c.t));
function briefWink(expr, age) {
  if (!expr.wink) return expr;
  const w = expr.wink, k = winkPulse(age), out = { ...expr, wink: w * k };
  out.happy = (out.happy || 0) + w * (1 - k) * 0.6; out.smirk = (out.smirk || 0) + w * (1 - k) * 0.4;
  return out;
}
function perfAt(t) {
  if (mode === 'talk') {
    const tt = TALK[0] + ((t % (TALK[1] - TALK[0])) + (TALK[1] - TALK[0])) % (TALK[1] - TALK[0]);
    const s = Perf.at(tt), cue = WINK_CUES.filter(c => c <= tt + 0.12).pop();
    return { s: { ...s, expr: briefWink(s.expr, cue === undefined ? 9 : tt - (cue - 0.12)) }, tt };
  }
  const base = { expr: { neutral: 0.4, happy: 0.6 }, mouth: QUIET, blink: blinkAt(t), emph: 0, talking: false, word: null,
    gesture: { name: 'none', t0: 0, age: 9, prev: 'none', prevAge: 99, blend: 1 } };
  if (mode === 'expr') {
    const D = 1.9, i = Math.floor(t / D), age = t - i * D, n = EXPRS.length, cur = EXPRS[((i % n) + n) % n], prev = EXPRS[(((i - 1) % n) + n) % n];   // negative t wraps too
    const k = smooth(age / 0.3);
    base.expr = briefWink(cur[0] === prev[0] ? { [cur[0]]: 1 } : { [cur[0]]: k, [prev[0]]: 1 - k }, age);
    base.gesture = { name: cur[1], t0: i * D, age, prev: prev[1], prevAge: age + D, blend: smooth(age / 0.45) };
    base.mouth = { ...QUIET, open: cur[0] === 'laugh' ? 0.35 + 0.25 * Math.abs(Math.sin(t * 9)) : 0 };
  }
  if (mode === 'moves') {   // full-body showreel: each move brings its own face
    const { m, prev, age } = moveAt(t), k = smooth(age / 0.35);
    const ex = {}; for (const [e, w] of Object.entries(prev.expr)) ex[e] = (ex[e] || 0) + w * (1 - k); for (const [e, w] of Object.entries(m.expr)) ex[e] = (ex[e] || 0) + w * k;
    base.expr = ex;
    base.gesture = { name: 'move', t0: t - age, age, prev: 'move', prevAge: 99, blend: 1 };   // arms come from the move, not the stance
    base.mouth = { ...QUIET, open: m.laugh ? 0.3 + 0.25 * Math.abs(Math.sin(t * 9)) : m.mouth ? m.mouth(age) : 0, round: m.mouth ? 0.4 : 0 };
  }
  return { s: base, tt: t };
}

// ---------------------------------------------------------------- poses
// relaxed stance: feet under the hip joints, weight on one leg (that hip rises, the other knee softens)
// Both legs stay perfectly straight from the hip socket to the floor: the weight shift lives in the
// pelvis (tilted, shifted over the standing leg), and each ankle lands where a straight leg meets the
// ground, a little outward, so knees never pinch or bow.
function standLegs(p, D) {
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
const STANCES = { pockets: 'Hands in pockets', relaxed: 'Relaxed', hip: 'Hand on hip', hips: 'Hands on hips' };
function stanceArms(p, D, kind, k) {
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
function fitArms(p, D) { for (const a of p.arms) { const y = a.target[1] * D.torsoH, k = Math.max(D.shoulders, torsoWidth(D, a.target[1])); a.target = [a.target[0] + (Math.abs(a.target[0]) > 60 ? Math.sign(a.target[0]) * 104 * (D.shoulders - 1) : 0), y]; } }   // gestures move with the shoulder socket, keeping their shape on wide frames
// a relaxed arm hangs almost straight from the shoulder, the hand just clear of the hip
function hangTarget(D, i, swing = 0) {
  const side = i ? 1 : -1, shX = 104 * D.shoulders, shY = -278 * D.torsoH + shoulderDrop(D), L = (D.armU + D.armL) * 0.965;
  const hipClear = 104 * torsoWidth(D, 0) + 24 * D.body.forearm, x = Math.max(shX + 6, hipClear);
  const dx = Math.min(L * 0.9, x - shX), dy = Math.sqrt(L * L - dx * dx);
  return [side * (shX + dx) + swing, shY + dy];
}
// how much of the authored gesture to replace with the relaxed hang (idle poses only)
const REST = { none: 1, lean: 1 };
function relaxArms(p, D, g) {
  const k = lerp(REST[g.prev] || 0, REST[g.name] || 0, g.blend);
  if (k <= 0) return;
  p.arms.forEach((a, i) => { const h = hangTarget(D, i); a.target = [lerp(a.target[0], h[0], k), lerp(a.target[1], h[1], k)]; a.handRot = lerp(a.handRot, (i ? -1 : 1) * 0.08, k); });
}
// name of the move playing in Moves mode, shown over the stage
let captionText = null;
function setCaption(txt) { if (txt === captionText) return; captionText = txt; const el = document.getElementById('caption'); if (el) { el.textContent = txt; el.classList.toggle('show', !!txt); } }
function poseAt(t) {
  const D = derive(look);
  if (mode === 'walk') return walkPose(t, D);
  const { s, tt } = perfAt(t);
  const p = talkPose(s, tt);
  p.look = look;
  const mv = mode === 'moves' ? applyMove(p, t) : null;
  p.pelvis.y += D.pelvisY - PELVIS_Y;
  fitArms(p, D);
  relaxArms(p, D, s.gesture);
  const restK = lerp(REST[s.gesture.prev] || 0, REST[s.gesture.name] || 0, s.gesture.blend);
  const top = STYLES.top[look.outfit.top] || {};
  const noPocket = D.full && !top.pockets && (look.pose || 'pockets') === 'pockets';
  if (restK > 0) stanceArms(p, D, noPocket ? (D.body.height < 0.85 ? 'relaxed' : 'hip') : look.pose || 'pockets', restK);   // dresses: hand on hip (children: arms relaxed)
  if (D.age > 0) { p.head.nod += 0.07 * D.age; p.chestRot += 0.02 * D.age; }   // older: head a little forward
  if (view === 'full') standLegs(p, D);
  if (mv && view === 'full' && mv.squat > 0) p.pelvis.y += mv.squat * 46;   // knees bend under a crouch or landing
  if (mv) setCaption(mv.move.label);
  return p;
}
function walkPose(t, D) {
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

// ---------------------------------------------------------------- hair sim (real time, rebinds when proportions change)
let sim = null, simKey = '';
function hairFor(p, steps) {
  const key = JSON.stringify([look.body, look.face, look.hair, mode, view]);
  if (!sim || key !== simKey) {
    sim = new HairSim(look); simKey = key;
    const bp = basePose(); bp.look = look; bp.pelvis.y = derive(look).pelvisY;
    sim.bind(solve(bp)); sim.reset(solve(p), p); steps = 30;
  }
  const S = solve(p);
  for (let i = 0; i < steps; i++) sim.step(S, p, 1 / 60, 0);
  return sim.output();
}

// ---------------------------------------------------------------- camera + frame
const cam = { x: 0, y: -800, z: 1.2, init: false };
let T, P, hero;
const LIGHTS = { key: [-0.55, -0.62, 0.62], keyCol: [1.08, 0.96, 0.84], fill: [0.75, 0.05, 0.7], fillCol: [0.2, 0.24, 0.32], rimDir: [1, -0.35], rimCol: [0.55, 0.42, 0.28], amb: [0.1, 0.085, 0.08], sssCol: [0.95, 0.3, 0.16] };
function frame(t, steps) {
  const p = poseAt(t), S = solve(p), D = derive(look);
  const head = M.ap(S.head, 0, 0), hr = 130 * Math.hypot(S.head[0], S.head[1]);
  let tx, ty, tz;
  if (view === 'portrait') { tz = 0.42 * R.H / (2 * hr) * Math.pow(D.head, 0.25); tx = head[0] * 0.6; ty = head[1] + hr * 0.95; }
  else {   // fixed scale (a tall woman fills the frame) so heights compare; feet near the bottom edge
    tz = 0.86 * R.H / 1480; tx = 0; ty = -R.H / tz * 0.5 + 60;
    const top = head[1] - hr * 1.15; if (-top + 60 > 0.95 * R.H / tz) tz = 0.92 * R.H / (-top + 90), ty = -R.H / tz * 0.5 + 60;
  }
  const k = cam.init ? 0.12 : 1; cam.init = true;
  cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k); cam.z = lerp(cam.z, tz, k);
  R.begin([0.5, 0.35, 0.15]);
  R.setCamera(960, 540, Math.max(R.W / 1920, R.H / 1080) * 1.04);
  P.quad('studio', M.tr(0, 0));
  R.setCamera(cam.x, cam.y, cam.z);
  if (view === 'full' || mode === 'walk') P.quad('dot', M.trs(0, -8, 0, 2.6 * D.hips * Math.sqrt(D.limbW), 0.5), { tint: [0.12, 0.06, 0.02, 0.45] });
  R.setLights(LIGHTS);
  hero.hair = hairFor(p, steps);
  hero.draw(p, S, { t });
  R.finish({ exposure: 0.96, contrast: 1.08, sat: 1.08, vignette: 0.4, gain: [1.02, 0.99, 0.95], lift: [0.015, 0.008, 0], bloom: 0.1, bloomThresh: 0.97, time: t });
}

// ---------------------------------------------------------------- UI
const CATS = [['saved', 'Saved'], ['body', 'Body'], ['outfit', 'Outfit'], ['face', 'Face'], ['hair', 'Hair'], ['eyes', 'Eyes'], ['brows', 'Brows'], ['nose', 'Nose'], ['mouth', 'Mouth'], ['makeup', 'Makeup']];
const PLACE = { eyes: { x: 1, y: 1, size: 0.04, tilt: 0.04 }, brows: { x: 1, y: 1, size: 0.04, tilt: 0.06 }, nose: { y: 1, size: 0.05 }, mouth: { y: 1, size: 0.04 } };
const BODY_SLIDERS = [['height', 'Height', 0.4, 1.3], ['torso', 'Torso length', 0.55, 1.2], ['arms', 'Arm length', 0.5, 1.2], ['head', 'Head size', 0.85, 1.6],
  ['neck', 'Neck', 0.7, 1.4], ['shoulders', 'Shoulders', 0.7, 1.35], ['bust', 'Chest', 0.75, 1.5], ['waist', 'Waist', 0.8, 1.7], ['belly', 'Belly', 0.85, 1.8],
  ['hips', 'Hips', 0.8, 1.6], ['thighs', 'Thighs', 0.8, 1.7], ['calves', 'Calves', 0.8, 1.5], ['upperArm', 'Upper arms', 0.8, 1.7], ['forearm', 'Forearms', 0.8, 1.5],
  ['neckLen', 'Neck length', 0.4, 1.8], ['traps', 'Trapezius', 0.8, 1.8], ['muscle', 'Muscle tone', 0, 1], ['soft', 'Softness', 0, 1], ['age', 'Age lines', 0, 1]];

function nudge(c, key, dir) {
  const st = PLACE[c]; if (!st || !st[key]) return;
  const r = RANGE[`${c}.${key}`] || [-99, 99];
  edit(() => { look[c][key] = +clamp(look[c][key] + st[key] * dir, r[0], r[1]).toFixed(3); });
}
function swatches(map, cur, field, colorOf = (v) => v) {
  return `<div class="sw">${Object.entries(map).map(([k, v]) => `<button title="${k}" aria-label="${k}" data-field="${field}" data-pick="${k}" class="${k === cur ? 'on' : ''}" style="background:${v ? colorOf(v) : 'repeating-linear-gradient(45deg,#555 0 4px,#333 4px 8px)'}"></button>`).join('')}</div>`;
}
// tiles(category, current, field to set, optional filter)
function tiles(c, cur, field, only) {
  const src = c === 'body' ? BODIES : STYLES[c];
  return `<div class="tiles">${Object.entries(src).filter(([k, v]) => !only || only(k, v)).map(([k, v]) => `<button class="tile ${k === cur ? 'on' : ''}" data-field="${field}" data-style="${k}">${glyph(c, k)}<span>${v.label}</span></button>`).join('')}</div>`;
}
function placePad(c) {
  const st = PLACE[c]; if (!st) return '';
  const v = look[c], hasX = !!st.x, fmt = (n) => (n > 0 ? '+' : '') + Math.round(n);
  return `<h2>Position &amp; size</h2><div class="place">
    <div class="pad"><span></span><button data-n="y,-1" title="Up (↑)">▲</button><span></span>
      <button data-n="x,-1" ${hasX ? '' : 'disabled style="opacity:.3"'} title="${c === 'eyes' || c === 'brows' ? 'Closer together' : 'Left'} (←)">◀</button>
      <span class="mid">${hasX ? `↔ ${fmt(v.x)}<br>` : ''}↕ ${fmt(-v.y)}</span>
      <button data-n="x,1" ${hasX ? '' : 'disabled style="opacity:.3"'} title="Further apart (→)">▶</button>
      <span></span><button data-n="y,1" title="Down (↓)">▼</button><span></span></div>
    <div class="mini"><button data-n="size,-1" title="Smaller (−)">−</button><button data-n="size,1" title="Bigger (+)">+</button><span class="lbl">size ${Math.round(v.size * 100)}%</span>
      ${st.tilt ? `<button data-n="tilt,-1" title="Tilt ([)">⟲</button><button data-n="tilt,1" title="Tilt (])">⟳</button><span class="lbl">tilt ${fmt(v.tilt * 100)}</span>` : ''}</div></div>`;
}
function slider(path, label, min, max, step = 0.01) {
  const [a, b] = path.split('.'), v = look[a][b];
  return `<label class="row"><span style="text-align:left;color:var(--ink)">${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-slider="${path}"><span>${Math.round(v * 100)}%</span></label>`;
}
function renderPanel() {
  const el = $('#panel'); let h = '';
  const O = look.outfit;
  if (cat === 'saved') {
    const list = savedList(), esc = (x) => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    h += `<h2>Save this character</h2><form class="saveform" id="saveform"><input id="savename" maxlength="40" placeholder="Name, e.g. Maya" value="${esc(look.name || '')}" aria-label="Character name"><button class="btn primary" type="submit">Save</button></form>`
      + `<h2>Your characters</h2>` + (list.length ? `<div class="saved">${list.map((c, i) => `<div class="card"><img src="${c.thumb}" alt=""><div class="meta"><b>${esc(c.name)}</b><span>${new Date(c.at).toLocaleDateString()}</span></div>
          <button class="btn" data-load="${i}">Load</button><button class="btn ghost" data-del="${i}" aria-label="Delete ${esc(c.name)}">${pendingDelete === i ? 'Sure?' : 'Delete'}</button></div>`).join('')}</div>`
        : `<p class="hint">No saved characters yet. Give this one a name and press Save; it stays in this browser.</p>`);
  } else if (cat === 'body') {
    h += `<h2>Body type</h2>${tiles('body', look.body.preset, 'body.preset')}`
      + `<h2>Standing pose</h2><div class="chips">${Object.entries(STANCES).map(([k, l]) => `<button class="btn ${look.pose === k ? 'primary' : ''}" data-pose="${k}" aria-pressed="${look.pose === k}">${l}</button>`).join('')}</div><h2>Fine-tune</h2>` + BODY_SLIDERS.map(([k, l, a, b]) => slider('body.' + k, l, a, b)).join('');
  } else if (cat === 'outfit') {
    h += `<h2>Top</h2>${tiles('top', O.top, 'outfit.top')}${swatches(CLOTH_COLORS, O.topColor, 'outfit.topColor')}`
      + `<h2>Bottoms</h2>${(STYLES.top[O.top] || {}).full ? `<p class="hint">A dress replaces the bottoms. Pick a top to wear these again.</p>` : ''}${tiles('bottom', O.bottom, 'outfit.bottom')}${swatches(CLOTH_COLORS, O.bottomColor, 'outfit.bottomColor')}`
      + `<h2>Shoes</h2>${tiles('shoes', O.shoes, 'outfit.shoes')}${swatches({ brown: '#6b4127', ...CLOTH_COLORS }, O.shoeColor, 'outfit.shoeColor')}`
      + `<h2>Accessories</h2><p class="hint" style="margin:0 0 8px">Tap to add or remove; you can wear several.</p><div class="tiles">${Object.entries(STYLES.accessory).filter(([k]) => k !== 'none').map(([k, v]) =>
          `<button class="tile ${(O.accessories || []).includes(k) ? 'on' : ''}" data-acc="${k}" aria-pressed="${(O.accessories || []).includes(k)}">${glyph('accessory', k)}<span>${v.label}</span></button>`).join('')}</div>`;
  } else if (cat === 'face') {
    h += `<h2>Face shape</h2>${tiles('face', look.face.style, 'face.style')}<h2>Facial hair</h2>${tiles('facial', look.facial.style, 'facial.style')}`
      + `<h2>Glasses</h2>${tiles('glasses', look.glasses.style, 'glasses.style')}${swatches(GLASS_COLORS, look.glasses.color, 'glasses.color')}`
      + `<h2>Skin tone</h2>${swatches(SKIN_SWATCH, look.skin.tone, 'skin.tone')}<h2>Proportions</h2>${slider('face.size', 'Head size', 0.9, 1.12)}${slider('ears.size', 'Ears', 0.7, 1.4)}`;
  } else if (cat === 'hair') {
    h += `<h2>Long &amp; medium</h2>${tiles('hair', look.hair.style, 'hair.style', (k, v) => !v.cap)}<h2>Short</h2>${tiles('hair', look.hair.style, 'hair.style', (k, v) => !!v.cap)}`
      + `<h2>Colour</h2>${swatches(HAIR_COLORS, look.hair.color, 'hair.color')}`;
  } else if (cat === 'eyes') {
    h += `<h2>Eye shape</h2>${tiles('eyes', look.eyes.style, 'eyes.style')}${placePad('eyes')}<h2>Iris colour</h2>${swatches(EYE_COLORS, look.eyes.color, 'eyes.color')}${slider('eyes.iris', 'Iris size', 0.8, 1.2)}${slider('eyes.lashes', 'Lashes', 0.2, 1.5)}`;
  } else if (cat === 'brows') {
    h += `<h2>Brow shape</h2>${tiles('brows', look.brows.style, 'brows.style')}${placePad('brows')}`;
  } else if (cat === 'nose') {
    h += `<h2>Nose</h2>${tiles('nose', look.nose.style, 'nose.style')}${placePad('nose')}`;
  } else if (cat === 'mouth') {
    h += `<h2>Mouth</h2>${tiles('mouth', look.mouth.style, 'mouth.style')}${placePad('mouth')}<h2>Lip colour</h2>${swatches(LIP_COLORS, look.mouth.color, 'mouth.color')}`;
  } else if (cat === 'makeup') {
    h += `<h2>Eyeshadow</h2>${swatches(SHADOW_COLORS, look.makeup.shadow, 'makeup.shadow')}<h2>Blush</h2>${slider('makeup.blush', 'Blush', 0, 1.6)}`;
  }
  h += `<p class="hint"><kbd>←</kbd><kbd>→</kbd> spacing · <kbd>↑</kbd><kbd>↓</kbd> height · <kbd>+</kbd><kbd>−</kbd> size · <kbd>[</kbd><kbd>]</kbd> tilt<br><kbd>0</kbd>–<kbd>9</kbd> tabs · <kbd>R</kbd> randomize · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Space</kbd> next preview</p>`;
  el.innerHTML = h;
  const sf = el.querySelector('#saveform');
  if (sf) sf.onsubmit = (e) => { e.preventDefault(); saveAs(el.querySelector('#savename').value); };
  el.querySelectorAll('[data-load]').forEach(b => b.onclick = () => { const c = savedList()[+b.dataset.load]; edit(() => { look = upgrade(c.look); }); toast(`Loaded ${c.name}`); });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const i = +b.dataset.del; if (pendingDelete !== i) { pendingDelete = i; return renderPanel(); }
    const list = savedList(), [c] = list.splice(i, 1); store.set('creator.saved', list); pendingDelete = -1; renderPanel(); toast(`Deleted ${c.name}`);
  });
  const setField = (f, v) => { const [a, b] = f.split('.'); if (f === 'body.preset') Object.assign(look.body, BODIES[v], { preset: v }); else look[a][b] = v; };
  el.querySelectorAll('[data-style], [data-pick]').forEach(b => b.onclick = () => edit(() => setField(b.dataset.field, b.dataset.style || b.dataset.pick)));
  el.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { const [k, d] = b.dataset.n.split(','); nudge(cat, k, +d); });
  el.querySelectorAll('[data-pose]').forEach(b => b.onclick = () => edit(() => { look.pose = b.dataset.pose; }));
  el.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => edit(() => {
    const k = b.dataset.acc, list = (look.outfit.accessories || []).filter(x => x !== k);
    if (!(look.outfit.accessories || []).includes(k)) list.push(k);
    look.outfit.accessories = list;
  }));
  el.querySelectorAll('[data-slider]').forEach(inp => {
    let dragging = false;
    inp.oninput = () => {
      if (!dragging) { snap(); dragging = true; }
      const [a, b] = inp.dataset.slider.split('.'); look[a][b] = +inp.value;
      if (a === 'body') look.body.preset = 'custom';
      inp.nextElementSibling.textContent = Math.round(inp.value * 100) + '%';
      look.rev++; store.set('creator.look', look);
      if (a === 'body') el.querySelectorAll('.tile.on').forEach(t => t.classList.remove('on'));
    };
    inp.onchange = () => { dragging = false; renderChrome(); };
  });
}
function renderChrome() {
  $('#cats').innerHTML = CATS.map(([k, l], i) => `<button data-cat="${k}" class="${k === cat ? 'on' : ''}" title="${l} (${i})">${ICONS[k]}${l}</button>`).join('');
  $('#cats').querySelectorAll('button').forEach(b => b.onclick = () => { cat = b.dataset.cat; renderChrome(); renderPanel(); });
  const seg = (id, opts, cur, set) => { $(id).innerHTML = opts.map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" data-k="${k}">${l}</button>`).join(''); $(id).querySelectorAll('button').forEach(b => b.onclick = () => set(b.dataset.k)); };
  seg('#mode', [['talk', 'Talk'], ['expr', 'Expressions'], ['moves', 'Moves'], ['idle', 'Idle'], ['walk', 'Walk']], mode, (k) => { mode = k; store.set('creator.mode', k); syncAudio(); renderChrome(); setCaption(''); });
  seg('#view', [['portrait', 'Portrait'], ['full', 'Full body']], view, (k) => { view = k; store.set('creator.view', k); renderChrome(); });
  seg('#sex', [['female', 'Woman'], ['male', 'Man']], look.sex, (k) => { if (k === look.sex) return; edit(() => { look = makeLook(SEX_DEFAULTS[k]); }); toast(k === 'male' ? 'Switched to a man (Undo to go back)' : 'Switched to a woman (Undo to go back)'); });
  $('#sound').textContent = sound ? 'Sound on' : 'Sound off';
  $('#undo').disabled = !hist.length; $('#redo').disabled = !fut.length;
  $('#undo').title = `Undo (Ctrl+Z) · ${hist.length} step${hist.length === 1 ? '' : 's'} back`;
}
// ---------------------------------------------------------------- saved characters
let pendingDelete = -1;
const savedList = () => store.get('creator.saved') || [];
function thumb() {   // the current preview, shrunk to a small JPEG
  const c = document.createElement('canvas'); c.width = c.height = 112;
  c.getContext('2d').drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 112, 112);
  try { return c.toDataURL('image/jpeg', 0.8); } catch { return ''; }
}
function saveAs(name) {
  name = (name || '').trim(); if (!name) return toast('Type a name first');
  look.name = name; look.rev++; frame(lastT, 0); const { rev, ...j } = look;   // render the look being saved for its thumbnail
  const list = savedList().filter(c => c.name.toLowerCase() !== name.toLowerCase());
  list.unshift({ name, look: j, thumb: thumb(), at: Date.now() });
  store.set('creator.saved', list.slice(0, 60)); store.set('creator.look', look);
  renderPanel(); toast(`Saved ${name}. They are now in your Storybuddy cast.`);
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1600); }

// randomize: a style per feature, small placement offsets, colours, mostly-average bodies
const pick = (o) => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
const rnd = (a, b) => +(a + Math.random() * (b - a)).toFixed(2);
// randomize within the current sex: each list is what that sex picks from (weights by repetition)
const one = (a) => a[Math.floor(Math.random() * a.length)];
// catalogue entries tagged for this sex ('any' or untagged suits both)
const bySex = (cat, sex, keep = () => true) => Object.entries(STYLES[cat]).filter(([k, v]) => (!v.sex || v.sex === 'any' || v.sex === sex) && keep(v)).map(([k]) => k);
const POOLS = {
  female: { body: ['average', 'average', 'petite', 'tall', 'curvy', 'curvy', 'athletic', 'plus', 'child', 'chibi'],
    brows: Object.keys(STYLES.brows), mouth: Object.keys(STYLES.mouth), lips: Object.keys(LIP_COLORS), shadow: Object.keys(SHADOW_COLORS), lashes: [0.85, 1.25], blush: [0.5, 1.3], dress: 0.22, beard: 0 },
  male: { body: ['average', 'average', 'tall', 'athletic', 'athletic', 'plus', 'petite', 'child', 'chibi'],
    brows: ['bold', 'bold', 'straight', 'soft', 'angled'], mouth: ['thin', 'full', 'wide', 'small'], lips: ['nude'], shadow: ['none'], lashes: [0.25, 0.5], blush: [0.1, 0.4], dress: 0, beard: 0.6 },
};
function randomize() {
  const sex = look.sex, Pl = POOLS[sex], bodyKey = one(Pl.body), dark = ['black', 'white', 'grey', 'navy', 'denim', 'brown', 'tan'];
  Pl.hair = bySex('hair', sex); Pl.bottom = bySex('bottom', sex); Pl.shoes = bySex('shoes', sex);
  Pl.top = Math.random() < Pl.dress ? bySex('top', sex, v => v.full) : bySex('top', sex, v => !v.full);
  Pl.facial = Math.random() < Pl.beard ? Object.keys(STYLES.facial).filter(k => k !== 'none') : ['none'];
  edit(() => { look = makeLook({
    sex, body: { preset: bodyKey, ...BODIES[bodyKey] }, face: { style: pick(STYLES.face), size: rnd(0.96, 1.05) },
    eyes: { style: pick(STYLES.eyes), x: Math.round(rnd(-4, 5)), y: Math.round(rnd(-3, 3)), size: sex === 'male' ? rnd(0.84, 1) : rnd(0.9, 1.12), tilt: rnd(-0.08, 0.08), iris: rnd(0.92, 1.08), color: pick(EYE_COLORS), lashes: rnd(...Pl.lashes) },
    brows: { style: one(Pl.brows), x: Math.round(rnd(-3, 3)), y: Math.round(rnd(-3, 3)), size: rnd(0.9, 1.1), tilt: rnd(-0.15, 0.15) },
    nose: { style: pick(STYLES.nose), y: Math.round(rnd(-3, 3)), size: rnd(0.9, 1.15) },
    mouth: { style: one(Pl.mouth), y: Math.round(rnd(-3, 4)), size: rnd(0.9, 1.1), color: one(Pl.lips) },
    hair: { style: one(Pl.hair), color: Math.random() < 0.4 ? 'black' : pick(HAIR_COLORS) }, skin: { tone: pick(SKIN_SWATCH) },
    makeup: { shadow: one(Pl.shadow), blush: rnd(...Pl.blush) }, ears: { size: rnd(0.9, 1.1) }, facial: { style: one(Pl.facial) },
    glasses: { style: Math.random() < 0.18 ? one(['round', 'rect', 'cateye']) : 'none', color: pick(GLASS_COLORS) },
    pose: one(['pockets', 'pockets', 'relaxed', 'hip', 'hips']),
    outfit: { top: one(Pl.top), topColor: pick(CLOTH_COLORS), bottom: one(Pl.bottom), bottomColor: one(dark.concat(Object.keys(CLOTH_COLORS))), shoes: one(Pl.shoes), shoeColor: one(['brown', 'white', 'black', 'grey', 'tan', 'red', 'navy']),
      accessories: Object.keys(STYLES.accessory).filter(k => k !== 'none' && !k.startsWith('belt') && Math.random() < 0.18).slice(0, 2).concat(Math.random() < 0.55 ? [one(['belt', 'belt', 'beltblack'])] : []) },
  }); });
  toast(sex === 'male' ? 'Random man' : 'Random woman');
}

// ---------------------------------------------------------------- audio (talk preview)
const audio = new Audio(new URL('../talk.mp3', import.meta.url).href);   // first ~13 s of the narration
function syncAudio() {
  if (sound && mode === 'talk') { audio.currentTime = TALK[0] + 0.4; audio.play().catch(() => { }); talkStart = performance.now() / 1000 - 0.4; }
  else audio.pause();
}
let talkStart = performance.now() / 1000;
audio.addEventListener('timeupdate', () => { if (audio.currentTime > TALK[1]) { audio.currentTime = TALK[0]; talkStart = performance.now() / 1000; } });

// ---------------------------------------------------------------- wiring
$('#sound').onclick = () => { sound = !sound; syncAudio(); renderChrome(); };
$('#random').onclick = randomize;
$('#reset').onclick = () => { edit(() => { look = makeLook(SEX_DEFAULTS[look.sex]); }); toast('Reset'); };
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#copy').onclick = async () => { const { rev, ...j } = look; try { await navigator.clipboard.writeText(JSON.stringify(j, null, 1)); toast('Recipe copied'); } catch { toast('Clipboard blocked'); } };
$('#save').onclick = () => { cat = 'saved'; renderChrome(); renderPanel(); setTimeout(() => { const i = $('#savename'); if (i) { i.focus(); i.select(); } }, 0); };
if ($('#export')) $('#export').onclick = () => { const { rev, ...j } = look; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 1)], { type: 'application/json' })); a.download = 'character.json'; a.click(); };
$('#load').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = async () => { try { const L = upgrade(JSON.parse(await i.files[0].text())); edit(() => { look = L; }); toast('Loaded'); } catch { toast('Not a character file'); } }; i.click(); };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) { e.preventDefault(); return redo(); }
  const map = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', -1], ArrowDown: ['y', 1], '-': ['size', -1], '_': ['size', -1], '=': ['size', 1], '+': ['size', 1], '[': ['tilt', -1], ']': ['tilt', 1] };
  if (map[k] && PLACE[cat]) { e.preventDefault(); nudge(cat, ...map[k]); return; }
  if (/^[0-9]$/.test(k) && !e.ctrlKey && !e.metaKey) { cat = CATS[+k][0]; renderChrome(); renderPanel(); }
  else if ((k === 'r' || k === 'R') && !e.ctrlKey && !e.metaKey) randomize();
  else if (k === ' ') { e.preventDefault(); const m = ['talk', 'expr', 'idle', 'walk']; mode = m[(m.indexOf(mode) + 1) % 4]; store.set('creator.mode', mode); syncAudio(); renderChrome(); }
});

renderChrome(); renderPanel();
T = await loadTextures();
P = new Painter(R, T); hero = new Heroine(P);
$('#loading').remove();
let last = performance.now() / 1000, acc = 0, lastT = 0;
window.creator = { get look() { return look; }, frame: (t) => frame(t, 4), set: (o) => { look = upgrade({ ...look, ...o }); changed(); } };
function loop() {
  const now = performance.now() / 1000, dt = Math.min(0.1, now - last); last = now;
  acc += dt * 60; const steps = Math.min(6, Math.floor(acc)); acc -= steps;
  const t = lastT = mode === 'talk' && sound && !audio.paused ? audio.currentTime - TALK[0] : now - talkStart;
  if (!window.creator.paused) frame(t, steps);
  requestAnimationFrame(loop);
}
loop();
