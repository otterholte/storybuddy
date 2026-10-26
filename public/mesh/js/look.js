// Character "look" recipe: the Mii-style knobs the rig reads (body proportions, face shape,
// feature styles + placement, colours). A pose with no `look` renders the film's heroine exactly.
//   pose.look = makeLook({ eyes: { style: 'round', y: 3 } })
// derive(look) turns the recipe into the numbers heroine.js uses; it is cached per recipe revision.

import { GARMENTS, PAINTED } from './garments.js';
import { HAIRSTYLES, FACIAL_HAIR } from './hairstyles.js';
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const lin = (c) => c.map(v => Math.pow(v, 2.2));

// ---------------------------------------------------------------- styles (shape only; placement is separate)
export const STYLES = {
  face: {
    oval:   { label: 'Oval',   width: 1, jaw: 1, chin: 1, forehead: 1, cheek: 0 },
    round:  { label: 'Round',  width: 1.06, jaw: 1.12, chin: 0.86, forehead: 0.98, cheek: 0.6 },
    heart:  { label: 'Heart',  width: 1.03, jaw: 0.86, chin: 1.08, forehead: 1.04, cheek: 0.2 },
    square: { label: 'Square', width: 1.04, jaw: 1.18, chin: 0.9, forehead: 1, cheek: -0.2 },
    long:   { label: 'Long',   width: 0.94, jaw: 0.98, chin: 1.2, forehead: 1.08, cheek: -0.3 },
  },
  eyes: {
    almond:   { label: 'Almond',   w: 1, h: 1, tilt: 0 },
    round:    { label: 'Round',    w: 0.94, h: 1.22, tilt: -0.02 },
    upturned: { label: 'Upturned', w: 1.02, h: 0.96, tilt: 0.22 },
    droopy:   { label: 'Droopy',   w: 1, h: 0.96, tilt: -0.2 },
    narrow:   { label: 'Narrow',   w: 1.06, h: 0.74, tilt: 0.05 },
    doe:      { label: 'Doe',      w: 1.02, h: 1.12, tilt: -0.08 },
  },
  brows: {
    soft:     { label: 'Soft arch', arch: 1, thick: 1, len: 1, peak: 0.8 },
    straight: { label: 'Straight',  arch: 0.25, thick: 1, len: 1.02, peak: 0.8 },
    high:     { label: 'High arch', arch: 1.7, thick: 0.9, len: 0.98, peak: 0.7 },
    angled:   { label: 'Angled',    arch: 1.3, thick: 1, len: 1, peak: 1.6 },
    bold:     { label: 'Bold',      arch: 0.8, thick: 1.45, len: 1.05, peak: 0.8 },
    thin:     { label: 'Thin',      arch: 1.1, thick: 0.6, len: 0.95, peak: 0.8 },
  },
  nose: {
    button:  { label: 'Button',  w: 1, h: 1, tip: 1 },
    petite:  { label: 'Petite',  w: 0.8, h: 0.85, tip: 0.85 },
    rounded: { label: 'Rounded', w: 1.2, h: 0.95, tip: 1.25 },
    long:    { label: 'Long',    w: 0.92, h: 1.3, tip: 1 },
    wide:    { label: 'Wide',    w: 1.4, h: 1, tip: 1.15 },
  },
  mouth: {
    full:  { label: 'Full',  w: 1, full: 1, bow: 1 },
    thin:  { label: 'Thin',  w: 1.04, full: 0.7, bow: 0.6 },
    heart: { label: 'Heart', w: 0.9, full: 1.15, bow: 1.8 },
    wide:  { label: 'Wide',  w: 1.22, full: 0.95, bow: 0.9 },
    small: { label: 'Small', w: 0.78, full: 1, bow: 1.2 },
  },
  hair: HAIRSTYLES, facial: FACIAL_HAIR,
  glasses: { none: { label: 'None' }, round: { label: 'Round', tex: 'glasses_round' }, rect: { label: 'Rectangle', tex: 'glasses_rect' }, cateye: { label: 'Cat-eye', tex: 'glasses_cateye' } },
  top: GARMENTS.top, bottom: GARMENTS.bottom, shoes: GARMENTS.shoes, accessory: GARMENTS.accessory || {},
};

// ---------------------------------------------------------------- body presets
// Region proportions relative to the painted average woman. Lengths: height (legs), torso, arms.
// Widths: neck, shoulders, bust, waist, belly, hips, thighs, calves, upperArm, forearm.
// muscle / soft (0..1) fade in painted definition overlays (athletic tone, soft rounded belly).
const BASE = { height: 1, torso: 1, arms: 1, head: 1, neck: 1, neckLen: 1, traps: 1, shoulders: 1, bust: 1, waist: 1, belly: 1, hips: 1, thighs: 1, calves: 1, upperArm: 1, forearm: 1, feet: 1, muscle: 0, soft: 0, age: 0 };
export const BODY_KEYS = Object.keys(BASE);
// The painted film body is a slim, short-legged stylisation. Creator adults are measured against the
// reference lineup (ref/creator_types_lineup.webp): legs ~38% of height, head ~19%, fuller limbs.
const ADULT = { height: 1.24, torso: 0.94, arms: 1.06, head: 0.82, neck: 1.1, shoulders: 1.22, bust: 1.22, waist: 1.18, belly: 1.18, hips: 1.32, thighs: 1.36, calves: 1.3, upperArm: 1.3, forearm: 1.26, feet: 1.28 };
// presets are relative to that adult (age: 0 young .. 1 older, drives face details)
export const BODIES = {
  child:    { label: 'Child', ...BASE, height: 0.6, torso: 0.58, arms: 0.62, head: 1.08, neck: 0.72, neckLen: 0.5, shoulders: 0.7, bust: 0.72, waist: 0.84, belly: 0.92, hips: 0.72, thighs: 0.72, calves: 0.74, upperArm: 0.7, forearm: 0.74, feet: 0.72 },
  teen:     { label: 'Teen', ...BASE, height: 0.92, torso: 0.9, arms: 0.93, head: 1.0, neck: 0.92, shoulders: 0.9, bust: 0.88, waist: 0.9, belly: 0.92, hips: 0.9, thighs: 0.88, calves: 0.9, upperArm: 0.86, forearm: 0.88, feet: 0.95 },
  young:    { label: 'Young adult', ...BASE, height: 1.02, shoulders: 0.98, bust: 0.98, waist: 0.95, belly: 0.94, hips: 0.98, thighs: 0.97, calves: 0.98, upperArm: 0.95, forearm: 0.96 },
  average:  { label: 'Adult', ...BASE },
  older:    { label: 'Older adult', ...BASE, height: 0.97, neck: 1.04, shoulders: 0.98, bust: 1.02, waist: 1.08, belly: 1.14, hips: 1.02, thighs: 0.96, calves: 0.94, upperArm: 0.98, forearm: 0.96, soft: 0.25, age: 1 },
  plus:     { label: 'Plus size', ...BASE, head: 1.03, neck: 1.46, neckLen: 0.7, traps: 1.15, shoulders: 1.2, bust: 1.5, waist: 1.72, belly: 1.92, hips: 1.58, thighs: 1.8, calves: 1.4, upperArm: 1.8, forearm: 1.38, feet: 1.08, soft: 1 },
  curvy:    { label: 'Curvy', ...BASE, shoulders: 1.0, bust: 1.28, waist: 0.96, belly: 1.0, hips: 1.32, thighs: 1.38, calves: 1.14, upperArm: 1.1, forearm: 1.02, soft: 0.15 },
  tall:     { label: 'Tall & thin', ...BASE, height: 1.24, torso: 1.1, arms: 1.12, head: 0.95, neck: 0.86, neckLen: 1.6, traps: 0.9, shoulders: 0.84, bust: 0.8, waist: 0.8, belly: 0.8, hips: 0.82, thighs: 0.72, calves: 0.74, upperArm: 0.72, forearm: 0.74, feet: 1.02 },
  muscular: { label: 'Muscular', ...BASE, height: 1.04, neck: 2.05, neckLen: 0.6, traps: 1.9, shoulders: 1.44, bust: 1.58, waist: 0.98, belly: 0.94, hips: 1.08, thighs: 1.78, calves: 1.62, upperArm: 1.72, forearm: 1.44, feet: 1.12, muscle: 1 },
  petite:   { label: 'Short & petite', ...BASE, height: 0.84, torso: 0.9, arms: 0.88, head: 1.0, neck: 0.92, neckLen: 0.9, shoulders: 0.92, bust: 0.94, waist: 0.9, belly: 0.92, hips: 0.95, thighs: 0.92, calves: 0.9, upperArm: 0.9, forearm: 0.9, feet: 0.9 },
  chibi:    { label: 'Chibi', ...BASE, height: 0.34, torso: 0.52, arms: 0.48, head: 1.55, neck: 0.62, shoulders: 0.66, bust: 0.7, waist: 0.86, belly: 0.98, hips: 0.76, thighs: 0.86, calves: 0.88, upperArm: 0.86, forearm: 0.9, feet: 0.8, soft: 0.3 },
};
// legacy preset keys from saved characters
BODIES.athletic = BODIES.muscular;
const MALE = { height: 1.06, torso: 1.05, arms: 1.03, head: 0.96, neck: 1.2, shoulders: 1.16, bust: 1.02, waist: 1.08, belly: 1.06, hips: 0.88, thighs: 0.94, calves: 1.04, upperArm: 1.12, forearm: 1.14, feet: 1.1 };

// natural skin tones as target colours for the painted base skin (#f5c8b0), light to deep
export const SKIN_SWATCH = {
  porcelain: '#f9dfd4', ivory: '#f6d5c2', fair: '#f5c8b0', light: '#efbf9f', warm: '#ecb894', beige: '#e2ad88', sand: '#d8a27c',
  olive: '#c9a074', golden: '#d0975f', tan: '#be8a62', caramel: '#a8724a', bronze: '#94613d', brown: '#7c4f33', chestnut: '#683f29',
  espresso: '#4f3022', deep: '#3b241a',
};
export const SKIN = Object.fromEntries(Object.entries(SKIN_SWATCH).map(([k, h]) => [k, hex(h).map((v, i) => v / hex('#f5c8b0')[i])]));
export const HAIR_COLORS = { black: '#0d0b0c', espresso: '#3a2219', darkbrown: '#4a2c1c', brown: '#6e452b', chestnut: '#6b3a22', lightbrown: '#9a6a42', auburn: '#8e3b1f', ginger: '#c0622a', strawberry: '#d79a6a', blonde: '#d8b06a', ash: '#b9a88a', platinum: '#e8e0cf', grey: '#9a9894', silver: '#cfcfcf', white: '#eeece8', rose: '#d77a8c', blue: '#3c5fa8' };
export const EYE_COLORS = { brown: '#5a3418', hazel: '#6b6a30', green: '#3f7a43', blue: '#3d6fb0', grey: '#7d8a96', amber: '#a8661c' };
export const LIP_COLORS = { rose: '#d77a7f', berry: '#a8434f', coral: '#ef7b62', nude: '#c98c7c', red: '#c42c35' };
export const CLOTH_COLORS = { black: '#1c1b20', white: '#f2f0ec', grey: '#8d8c92', navy: '#26304f', denim: '#4c6a96', red: '#b8322f',
  forest: '#2f5a3e', mustard: '#d49b2c', blush: '#e5a3a6', lavender: '#a596c8', tan: '#c4a27a', brown: '#6b4529' };
export const SHADOW_COLORS = { peach: '#f26a3e', rose: '#e2788c', plum: '#9a6390', bronze: '#a86a3a', none: null };

// ---------------------------------------------------------------- the recipe
// sex-specific starting looks (the creator switches to these when you pick Woman / Man)
export const SEX_DEFAULTS = {
  female: {},
  male: { sex: 'male', hair: { style: 'crop', color: 'black' }, eyes: { lashes: 0.35, size: 0.86, y: 2 }, brows: { style: 'bold', y: 3, size: 1.06 }, nose: { size: 1.16, y: 2 },
    mouth: { style: 'thin', color: 'nude', y: 3 }, makeup: { shadow: 'none', blush: 0.15 }, outfit: { top: 'tee', topColor: 'navy', bottom: 'jeans', bottomColor: 'denim', shoes: 'sneakers', shoeColor: 'white' } },
};
export function makeLook(over = {}) {
  const L = {
    sex: 'female', pose: 'pockets',
    body: { preset: 'average', ...BODIES.average },
    face: { style: 'oval', size: 1 },
    eyes: { style: 'almond', x: 0, y: 0, size: 1, tilt: 0, iris: 1, color: 'brown', lashes: 1 },
    brows: { style: 'soft', x: 0, y: 0, size: 1, tilt: 0 },
    nose: { style: 'button', y: 0, size: 1 },
    mouth: { style: 'full', y: 0, size: 1, color: 'rose' },
    ears: { size: 1 },
    hair: { style: 'long', color: 'black' },
    skin: { tone: 'fair' },
    makeup: { shadow: 'peach', blush: 1 },
    outfit: { top: 'halter', topColor: 'black', bottom: 'leggings', bottomColor: 'black', shoes: 'boots', shoeColor: 'brown', accessories: [] },
    facial: { style: 'none', color: 'match' },
    glasses: { style: 'none', color: 'black' },
  };
  for (const [k, v] of Object.entries(over)) L[k] = typeof v === 'object' ? { ...L[k], ...v } : v;
  L.rev = 0;
  return L;
}

// ranges for nudges / size controls (shared by the UI and derive)
export const RANGE = {
  'eyes.x': [-10, 12], 'eyes.y': [-12, 12], 'eyes.size': [0.75, 1.3], 'eyes.tilt': [-0.3, 0.3], 'eyes.iris': [0.8, 1.2],
  'brows.x': [-10, 10], 'brows.y': [-12, 10], 'brows.size': [0.75, 1.3], 'brows.tilt': [-0.5, 0.5],
  'nose.y': [-10, 12], 'nose.size': [0.7, 1.4],
  'mouth.y': [-10, 14], 'mouth.size': [0.7, 1.35],
  'face.size': [0.9, 1.12], 'ears.size': [0.7, 1.4],
};

// colour remap of a painted albedo: alb' = alb * gain + add (applied before lighting)
function recolor(base, target, keep = 0.55, maxGain = 6) {
  const b = lin(hex(base)), t = lin(hex(target));
  return { gain: b.map((v, i) => Math.min(maxGain, (t[i] / Math.max(v, 0.02)) * keep + (1 - keep))), add: t.map((v, i) => Math.max(0, v - b[i]) * (1 - keep) * 0.6) };
}

// hue-true recolour: the shader greys the albedo (albMono = 1), then multiplies by target / grey(base)
function tintTo(base, target, strength = 1) {
  const b = lin(hex(base)), t = lin(hex(target)), lb = 0.3 * b[0] + 0.59 * b[1] + 0.11 * b[2];
  const lt = 0.3 * t[0] + 0.59 * t[1] + 0.11 * t[2], k = Math.pow(lb / Math.max(lt, 1e-3), 0.35);   // keep the painted value range
  return { gain: t.map(v => Math.min(8, v / Math.max(lb, 1e-3) * k * strength)), add: [0, 0, 0], mono: 1 };
}
// facial hair reads darker than head hair
const darken = (h, k) => '#' + hex(h).map(v => Math.round(v * k * 255).toString(16).padStart(2, '0')).join('');
const cache = new WeakMap();
export function derive(L) {
  if (!L) return null;
  const c = cache.get(L); if (c && c.rev === L.rev) return c.d;
  const B = L.body, F = STYLES.face[L.face.style] || STYLES.face.oval, E = STYLES.eyes[L.eyes.style] || STYLES.eyes.almond;
  const W = STYLES.brows[L.brows.style] || STYLES.brows.soft, N = STYLES.nose[L.nose.style] || STYLES.nose.button;
  const Mo = STYLES.mouth[L.mouth.style] || STYLES.mouth.full, Hs = STYLES.hair[L.hair.style] || STYLES.hair.long;
  const male = L.sex === 'male';
  const Bm = {}; for (const k of BODY_KEYS) Bm[k] = (B[k] ?? BASE[k]) * (male && MALE[k] ? MALE[k] : 1) * (ADULT[k] ?? 1);
  Bm.neck = Math.min(Bm.neck, 1.9 * Bm.head);   // a thick neck still stays inside the jaw
  // older recipes stored one 'limbs' width
  if (B.limbs !== undefined && B.upperArm === undefined) for (const k of ['upperArm', 'forearm', 'thighs', 'calves']) Bm[k] *= B.limbs;
  if (male) { Bm.hips = Math.min(Bm.hips, Math.max(Bm.waist, Bm.belly) * 1.03); Bm.lats = true; }
  const legs = 410 * Bm.height;   // standing pelvis height keeps the legs almost straight with the ankles at y=-50
  const d = {
    // body
    sex: L.sex,
    armU: 165 * Bm.arms, armL: 150 * Bm.arms, legT: 210 * Bm.height, legS: 200 * Bm.height,
    pelvisY: -62 - 0.985 * legs, torsoH: Bm.torso, shoulders: Bm.shoulders, waist: Bm.waist, hips: Bm.hips, limbW: 1,
    neckLift: 26 * (Bm.neckLen ?? 1) * Math.min(1.2, Bm.torso), body: Bm, hand: Math.pow(Bm.arms, 0.5) * Math.pow(Bm.forearm, 0.3) * (male ? 1.06 : 1), muscle: Bm.muscle, soft: Bm.soft, age: Bm.age,
    head: Bm.head * L.face.size,
    // face shape
    face: { width: F.width * (male ? 1.04 : 1) * (1 + 0.07 * Bm.soft), jaw: F.jaw * (male ? 1.2 : 1) * (1 + 0.12 * Bm.soft), chin: F.chin * (male ? 1.06 : 1) * (1 - 0.05 * Bm.soft),
            forehead: F.forehead, cheek: F.cheek + 0.8 * Bm.soft },
    eyes: { dx: L.eyes.x, dy: L.eyes.y, s: L.eyes.size, w: E.w, h: E.h, tilt: E.tilt + L.eyes.tilt, iris: L.eyes.iris, lash: L.eyes.lashes,
            color: L.eyes.color === 'brown' ? null : tintTo(EYE_COLORS.brown, EYE_COLORS[L.eyes.color] || EYE_COLORS.brown) },
    brows: { dx: L.brows.x, dy: L.brows.y, s: L.brows.size, arch: W.arch, thick: W.thick, len: W.len, peak: W.peak, tilt: L.brows.tilt },
    nose: { dy: L.nose.y, s: L.nose.size, w: N.w, h: N.h, tip: N.tip },
    mouth: { dy: L.mouth.y, s: L.mouth.size, w: Mo.w, full: Mo.full, bow: Mo.bow,
             color: L.mouth.color === 'rose' ? null : recolor(LIP_COLORS.rose, LIP_COLORS[L.mouth.color] || LIP_COLORS.rose, 0.8) },
    ears: L.ears.size,
    hair: { style: Hs, len: Hs.len ?? 1, back: Hs.backLen ?? 1, vol: Hs.vol ?? 1, cap: Hs.cap || 'hairCap', backTex: Hs.back === undefined ? 'hairBack' : Hs.back,
            extras: Hs.extras || [], color: L.hair.color === 'black' ? null : recolor(HAIR_COLORS.black, HAIR_COLORS[L.hair.color] || HAIR_COLORS.black, 0.25) },
    skin: SKIN[L.skin.tone] && L.skin.tone !== 'fair' ? SKIN[L.skin.tone] : null,
    shadow: L.makeup.shadow === 'peach' ? null : L.makeup.shadow === 'none' ? 'none' : tintTo(SHADOW_COLORS.peach, SHADOW_COLORS[L.makeup.shadow]),
    blush: L.makeup.blush,
    // brows read darker than the hair, so light hair does not give orange brows
    browColor: L.hair.color === 'black' ? null : recolor(HAIR_COLORS.black, darken(HAIR_COLORS[L.hair.color] || HAIR_COLORS.black, 0.55), 0.2),
    ...outfitOf(L),
    glasses: (STYLES.glasses[(L.glasses || {}).style] || {}).tex || null, glassesDye: (L.glasses || {}).color && L.glasses.color !== 'black' ? dyeHex(GLASS_COLORS[L.glasses.color] || '#1d1a1c', '#1d1a1c') : null,
    facial: (() => { const f = STYLES.facial[L.facial.style] || STYLES.facial.none, light = L.hair.color !== 'black';
      const stubbleTone = (c) => { const m = (c.gain[0] + c.gain[1] + c.gain[2]) / 3; return { gain: c.gain.map(v => m + (v - m) * 0.3), add: [0, 0, 0] }; };   // stubble stays a cool, near-neutral grey
      return (f.layers || []).map(l => { const st = /stubble/i.test(l.tex), c = light ? recolor(HAIR_COLORS.black, darken(HAIR_COLORS[L.hair.color] || HAIR_COLORS.black, st ? 0.45 : 0.75), 0.25) : null;
        return { ...l, color: c && st ? stubbleTone(c) : c }; }); })(),
  };
  cache.set(L, { rev: L.rev, d });
  return d;
}
// clothing layers: texture names (creator/tex) + colour remaps of the neutral painted cloth
const CLOTH_BASE = '#e4e2e6';
// the shader's albedo is sRGB, so the dye ratio is taken in sRGB too
const dye = (name) => { const b = hex(CLOTH_BASE), t = hex(CLOTH_COLORS[name] || CLOTH_COLORS.black); return { gain: t.map((v, i) => v / b[i]), add: [0, 0, 0] }; };
// garment layers -> per-space draw lists for heroine.drawLook()
function outfitOf(L) {
  const O = L.outfit, sx = L.sex === 'male' ? 'm' : 'f';
  const top = STYLES.top[O.top] || STYLES.top.tee, bottom = STYLES.bottom[O.bottom] || STYLES.bottom.jeans, shoes = STYLES.shoes[O.shoes] || STYLES.shoes.sneakers;
  const dyes = { top: O.topColor, bottom: O.bottomColor, shoes: O.shoeColor };
  const layers = { torso: [], arm: [], leg: [], foot: [] };
  const acc = (O.accessories || []).map(k => (GARMENTS.accessory || {})[k]).filter(Boolean);
  for (const g of [top, top.full ? null : bottom, shoes, ...acc]) for (const l of (g && g.layers) || []) {
    const tex = l.tex.replace('{s}', sx), name = dyes[l.dye];
    const d = l.dye === 'none' || l.dye === 'skin' || (name && PAINTED[tex] === name) ? null : l.dye && l.dye[0] === '#' ? dyeHex(l.dye) : dye(name || 'black');
    layers[l.space].push({ ...l, tex, d, fitted: !!g.full });
  }
  for (const k in layers) layers[k].sort((a, b) => a.z - b.z);
  return { torsoSkin: sx === 'm' ? 'torsoM' : 'torsoF', layers, heel: shoes.heel || 0, full: !!top.full };
}
const dyeHex = (h, base = CLOTH_BASE) => { const b = hex(base), t = hex(h); return { gain: t.map((v, i) => Math.min(8, v / Math.max(b[i], 0.05))), add: base === CLOTH_BASE ? [0, 0, 0] : t.map(v => v * 0.6) }; };
export const GLASS_COLORS = { black: '#1d1a1c', tortoise: '#6b4026', gold: '#c9a24a', clear: '#c8c4bc', red: '#a8323a' };
// torso width multiplier at pelvis-local height y: a smooth curve through the body landmarks
// (painted body: neck -400, shoulders -290, bust -190, waist -105, belly -55, hips 5, crotch 60)
export function torsoWidth(d, y) {
  const b = d.body;
  const tr = b.neck + (b.shoulders - b.neck) * 0.55, hh = b.waist + (b.hips - b.waist) * 0.5;
  // a man's lats carry the chest width down from the armpit, so the taper runs long and straight
  const K = [[-440, b.neck], [-366, b.neck], [-326, tr], [-290, b.shoulders], [-190, b.bust], ...(b.lats ? [[-150, b.bust * 0.62 + b.waist * 0.38]] : []), [-108, b.waist], [-62, Math.max(b.belly, b.waist)], [-26, Math.max(hh, b.belly * 0.92)], [30, b.hips], [70, Math.min(b.hips, (44 * b.hips + 39 * b.thighs) / 96)]];   // at the crotch the body narrows into the thighs' outer edge
  if (y <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (y <= K[i][0]) {
    const [y0, v0] = K[i - 1], [y1, v1] = K[i], t = (y - y0) / (y1 - y0), sm = t * t * (3 - 2 * t);
    return v0 + (v1 - v0) * sm;
  }
  return K[K.length - 1][1];
}
// limb width at local y: arm (elbow at 165) and leg (knee at 210)
const sstep = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
export const armWidth = (d, y) => d.body.upperArm + (d.body.forearm - d.body.upperArm) * sstep((y - 120) / 90);
export const legWidth = (d, y) => d.body.thighs + (d.body.calves - d.body.thighs) * sstep((y - 150) / 120);
