// The 2.5D stage: painted parallax sets (sky gradient + SVG layers rasterised into textures) with the
// rigged cast standing on the ground line, all drawn by the same WebGL renderer as the creator.
// Each character acts on its own clock: idle, talk (gestures + lip sync), walk, or a named move.
import { Renderer } from '../mesh/js/gl.js';
import { Painter, M, clamp, lerp, smooth } from '../mesh/js/draw.js';
import { Heroine, HairSim, solve, basePose, PELVIS_Y } from '../mesh/js/heroine.js';
import { talkPose } from '../mesh/js/acting.js';
import { makeLook, derive, STYLES } from '../mesh/js/look.js';
import { poseMove, MOVE_BY_KEY } from '../creator/js/moves.js';
import { standLegs, stanceArms, fitArms, relaxArms, REST, walkPose, blinkAt, QUIET } from '../creator/js/pose.js';

const NEED = ['arm', 'backpack', 'blush', 'boot', 'brow', 'catch', 'cup', 'dot', 'ear', 'eyeshadow', 'face', 'granola', 'hairBack', 'hairCap',
  'handFist', 'handHold', 'handOpen', 'handPoint', 'handRelax', 'iris', 'lashLow', 'lashUp', 'leg', 'lipLow', 'lipUp', 'lockA', 'lockB', 'lockC', 'lockD',
  'map', 'mouthIn', 'nose', 'phone', 'sclera', 'straps', 'studio', 'teeth', 'torso', 'drop'];
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });

// light rigs per set mood (screen space; see gl.js setLights) and the matching colour grade
const LIGHT = {
  day: { key: [-0.55, -0.62, 0.62], keyCol: [1.1, 1.0, 0.9], fill: [0.75, 0.05, 0.7], fillCol: [0.24, 0.28, 0.36], rimDir: [1, -0.35], rimCol: [0.5, 0.45, 0.35], amb: [0.11, 0.1, 0.1], sssCol: [0.95, 0.3, 0.16] },
  golden: { key: [-0.7, -0.4, 0.55], keyCol: [1.2, 0.92, 0.7], fill: [0.75, 0.05, 0.7], fillCol: [0.24, 0.2, 0.36], rimDir: [1, -0.2], rimCol: [0.95, 0.55, 0.3], amb: [0.1, 0.07, 0.08], sssCol: [1, 0.3, 0.12] },
  night: { key: [-0.4, -0.7, 0.6], keyCol: [0.75, 0.82, 1.05], fill: [0.75, 0.05, 0.7], fillCol: [0.12, 0.14, 0.28], rimDir: [1, -0.4], rimCol: [0.45, 0.55, 0.95], amb: [0.07, 0.07, 0.11], sssCol: [0.8, 0.28, 0.2] },
  indoor: { key: [-0.5, -0.6, 0.65], keyCol: [1.12, 0.98, 0.82], fill: [0.75, 0.05, 0.7], fillCol: [0.26, 0.22, 0.2], rimDir: [1, -0.35], rimCol: [0.6, 0.45, 0.3], amb: [0.12, 0.1, 0.09], sssCol: [0.95, 0.3, 0.16] },
};
const GRADE = {
  day: { exposure: 0.98, contrast: 1.06, sat: 1.08, vignette: 0.28, gain: [1.01, 1, 0.98], lift: [0.01, 0.01, 0.01], bloom: 0.08, bloomThresh: 0.97 },
  golden: { exposure: 0.98, contrast: 1.08, sat: 1.12, vignette: 0.38, gain: [1.05, 0.98, 0.9], lift: [0.02, 0.01, 0.02], bloom: 0.14, bloomThresh: 0.94 },
  night: { exposure: 0.92, contrast: 1.1, sat: 1.0, vignette: 0.45, gain: [0.94, 0.97, 1.06], lift: [0.01, 0.01, 0.03], bloom: 0.16, bloomThresh: 0.9 },
  indoor: { exposure: 0.97, contrast: 1.07, sat: 1.06, vignette: 0.35, gain: [1.03, 0.99, 0.94], lift: [0.015, 0.01, 0.005], bloom: 0.1, bloomThresh: 0.96 },
};
const TALK_GESTURES = ['handsOut', 'point', 'pointSelf', 'shrug', 'fist', 'countOne', 'none', 'handsOut'];
export const WORLD_X = 1050;      // stage x of ±1 in world units (characters' feet)
const VIEW_H = 1950;              // world units visible top to bottom at zoom 1

export class Stage {
  constructor(canvas) {
    this.canvas = canvas; this.R = new Renderer(canvas, { ssaa: 2 });
    this.T = {}; this.cast = new Map(); this.layers = []; this.loc = null;
    this.cam = { x: 0, z: 1, init: false }; this.camTarget = { x: 0, z: 1 }; this.fade = 0;
  }
  // textures for the rig: the film heroine's parts + the creator's wardrobe/hair/facial-hair sets
  async load(onProgress = () => { }) {
    const sets = [['../mesh/tex/', k => NEED.includes(k)], ['../creator/tex/', () => true]];
    const jobs = [];
    for (const [rel, keep] of sets) {
      const base = new URL(rel, import.meta.url).href, meta = await (await fetch(base + 'meta.json')).json();
      for (const [k, m] of Object.entries(meta)) if (keep(k)) jobs.push([base, k, m]);
    }
    let done = 0;
    const one = async ([base, k, m]) => {
      const img = await loadImg(base + k + '.png');
      this.T[k] = { ...this.R.texture(img), box: m.box, D: m.D };
      if (m.nrm) this.T[k].nrm = this.R.normalTex(await loadImg(base + k + '_n.png'));
      onProgress(++done / jobs.length);
    };
    for (let i = 0; i < jobs.length; i += 24) await Promise.all(jobs.slice(i, i + 24).map(one));   // a few at a time keeps the page responsive
    this.P = new Painter(this.R, this.T); this.hero = new Heroine(this.P);
  }

  // ---------------------------------------------------------------- sets
  async setLocation(loc) {
    this.loc = loc; this.light = LIGHT[loc.light] || LIGHT.day; this.grade = GRADE[loc.light] || GRADE.day;
    const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
    const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, loc.skyTop || '#8ccaf0'); gr.addColorStop(1, loc.skyBottom || '#e8f5ff'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    this.T.__sky = { ...this.R.texture(sky), box: [-0.5, -0.5, 0.5, 0.5] };
    const layers = [...(loc.layers || [])].sort((a, b) => a.depth - b.depth);
    this.layers = [];
    for (let i = 0; i < layers.length; i++) {
      try {
        const blob = new Blob([layers[i].svg], { type: 'image/svg+xml' }), url = URL.createObjectURL(blob);
        const img = await loadImg(url); URL.revokeObjectURL(url);
        const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; c.getContext('2d').drawImage(img, 0, 0, 1920, 1080);
        const key = '__layer' + i; this.T[key] = { ...this.R.texture(c), box: [-0.5, -0.5, 0.5, 0.5] };
        this.layers.push({ key, depth: clamp(+layers[i].depth || 0, 0, 1) });
      } catch (e) { console.warn('layer failed to draw', e); }
    }
  }

  // ---------------------------------------------------------------- cast
  setCast(list) {   // [{ id, look, x }]
    const keep = new Set(list.map(c => c.id));
    for (const id of [...this.cast.keys()]) if (!keep.has(id)) this.cast.delete(id);
    list.forEach((c, i) => {
      let a = this.cast.get(c.id);
      if (!a) {
        const look = makeLook(c.look); look.rev = 1;
        a = { id: c.id, look, D: derive(look), seed: i * 1.37 + 0.4, x: c.x * WORLD_X, sim: null, act: { kind: 'idle', t0: 0 }, prevAct: null };
        this.cast.set(c.id, a);
      }
      a.x = c.x * WORLD_X; a.act = { kind: 'idle', t0: 0 }; a.prevAct = null; a.sim = null;
    });
  }
  // what a character is doing now; kind: idle | talk | walk | <move key>
  act(id, kind, t, opts = {}) {
    const a = this.cast.get(id); if (!a) return;
    a.prevAct = { ...a.act, endAge: t - a.act.t0 };
    let to = opts.to != null ? clamp(opts.to, -0.8, 0.8) * WORLD_X : a.x;
    for (const o of this.cast.values()) if (o !== a && Math.abs(o.x - to) < 430) to = o.x + Math.sign(to - o.x || a.x - o.x || 1) * 430;   // stop beside, not inside, someone
    to = clamp(to, -0.85 * WORLD_X, 0.85 * WORLD_X);
    a.act = { kind, t0: t, expr: opts.expr || 'happy', from: a.x, to, gesture: TALK_GESTURES[Math.floor(Math.random() * TALK_GESTURES.length)] };
  }
  focus(id) { const a = this.cast.get(id); this.camTarget = a ? { x: a.x * 0.28, z: 1.06 } : { x: 0, z: 1 }; }

  // ---------------------------------------------------------------- posing
  pose(a, t, ctx) {
    const { act } = a, age = t - act.t0, D = a.D, look = a.look;
    const speaking = ctx.speaker === a.id, other = ctx.speakerX;
    let p;
    if (act.kind === 'walk' && Math.abs(act.to - act.from) > 4) {
      const dist = Math.abs(act.to - act.from), dur = Math.max(0.6, dist / 330);
      const k = clamp(age / dur);
      a.x = lerp(act.from, act.to, smooth(k));
      if (k < 1) {
        p = walkPose(t + a.seed, D, look);
        p.root.x = a.x;
        if (speaking) Object.assign(p.face.mouth, { open: clamp(ctx.mouth * 0.9), smile: 0.5 });
        return { p, walking: true };
      }
    }
    const moveKey = MOVE_BY_KEY[act.kind] ? act.kind : null;
    const expr = { [act.expr || 'happy']: speaking || moveKey ? 1 : 0.55, neutral: speaking ? 0 : 0.45 };
    const gesture = speaking && act.kind === 'talk' ? act.gesture : 'none';
    const s = { expr, mouth: speaking ? { ...QUIET, open: ctx.mouth, wide: ctx.mouth * 0.4 } : QUIET, blink: blinkAt(t, a.seed), emph: speaking ? ctx.mouth * 0.6 : 0, talking: speaking, word: null,
      gesture: { name: moveKey ? 'move' : gesture, t0: act.t0, age, prev: 'none', prevAge: 99, blend: smooth(age / 0.45) } };
    p = talkPose(s, t + a.seed * 7);
    p.look = look;
    let squat = 0;
    if (moveKey) {
      const pk = a.prevAct && MOVE_BY_KEY[a.prevAct.kind] ? a.prevAct.kind : null;
      squat = poseMove(p, moveKey, age, pk, a.prevAct?.endAge ?? 9);
    }
    // listeners look at whoever is talking
    if (!speaking && other != null && Math.abs(other - a.x) > 10) { const d = Math.sign(other - a.x); p.head.turn += d * 0.28; p.gaze[0] += d * 0.55; }
    p.pelvis.y += D.pelvisY - PELVIS_Y;
    fitArms(p, D);
    if (!moveKey) {
      relaxArms(p, D, s.gesture);
      const restK = lerp(REST[s.gesture.prev] || 0, REST[s.gesture.name] || 0, s.gesture.blend);
      const top = STYLES.top[look.outfit.top] || {};
      const stance = D.full && !top.pockets ? (D.body.height < 0.85 ? 'relaxed' : 'hip') : look.pose || 'pockets';
      if (restK > 0) stanceArms(p, D, stance, restK);
    }
    if (D.age > 0) { p.head.nod += 0.07 * D.age; p.chestRot += 0.02 * D.age; }
    standLegs(p, D);
    if (squat > 0) p.pelvis.y += squat * 46;
    p.root.x += a.x;
    return { p };
  }
  hairFor(a, p, steps) {
    if (!a.sim) {
      a.sim = new HairSim(a.look);
      const bp = basePose(); bp.look = a.look; bp.pelvis.y = a.D.pelvisY;
      a.sim.bind(solve(bp)); a.sim.reset(solve(p), p); steps = 30;
    }
    const S = solve(p);
    for (let i = 0; i < steps; i++) a.sim.step(S, p, 1 / 60, 0);
    return a.sim.output();
  }

  // ---------------------------------------------------------------- frame
  frame(t, ctx = {}, steps = 2) {
    const R = this.R, P = this.P; if (!P || !this.loc) return;
    const k = this.cam.init ? 0.04 : 1; this.cam.init = true;
    this.cam.x = lerp(this.cam.x, this.camTarget.x, k); this.cam.z = lerp(this.cam.z, this.camTarget.z, k);
    const drift = Math.sin(t * 0.13) * 40;   // a slow handheld drift keeps the parallax alive
    const sh = this.shot;   // optional fixed camera { x, y, z } (thumbnails, close-ups)
    const zoom = R.H / VIEW_H * (sh ? sh.z : this.cam.z), visH = R.H / zoom, visW = R.W / zoom;
    const gy = this.loc.groundY || 0.84, cy = sh ? sh.y : -(gy - 0.5) * visH, cx = sh ? sh.x : this.cam.x + drift;
    R.begin([0.2, 0.2, 0.25]);
    R.setCamera(cx, cy, zoom);
    // sky, then layers back to front: deeper layers follow the camera more (move less on screen)
    const big = 1.18;
    P.quad('__sky', M.trs(cx, cy, 0, visW * big, visH * big));
    // layers live in world units, anchored so their painted ground line (groundY) sits on the feet (y = 0)
    const lh = VIEW_H * big, lw = lh * 16 / 9, ly = -(gy - 0.5) * lh;
    const layer = (L) => { const par = 0.12 + 0.88 * L.depth; P.quad(L.key, M.trs(cx * (1 - par), ly, 0, lw, lh)); };
    for (const L of this.layers) if (L.depth <= 0.86) layer(L);   // foreground props (depth > 0.86) go over the cast
    R.setLights(this.light);
    const sorted = [...this.cast.values()].sort((a, b) => (a.id === ctx.speaker) - (b.id === ctx.speaker));
    for (const a of sorted) {
      const { p } = this.pose(a, t, ctx);
      P.quad('dot', M.trs(p.root.x, -8, 0, 2.6 * a.D.hips * Math.sqrt(a.D.limbW), 0.5), { tint: [0.1, 0.06, 0.04, 0.4] });
      const S = solve(p);
      this.hero.hair = this.hairFor(a, p, steps);
      this.hero.draw(p, S, { t });
    }
    for (const L of this.layers) if (L.depth > 0.86) layer(L);
    if (this.fade > 0) P.quad('__sky', M.trs(cx, cy, 0, visW * 2, visH * 2), { tint: [0, 0, 0, this.fade] });   // scene-change dip to black
    R.finish({ ...this.grade, time: t });
  }
}
