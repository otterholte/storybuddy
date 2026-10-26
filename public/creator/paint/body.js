// Body definition overlays drawn over the torso skin with an opacity from the body recipe:
//   body_muscle_f / _m  athletic tone (deltoid caps, collarbones, abs, obliques)
//   body_soft_f / _m    soft fullness (rounded belly, side rolls, fuller chest shadow)
// Painted in torso space (pelvis origin) like creator/paint/wardrobe.js torsoSkin().
import { tex, P, paintPass, rgba, SHADING } from '../../mesh/paint/lib.js';
const SH = '#c47a66', DEEP = '#a35a4a', HI = '#fff0e6';
const blob = (t, x, y, rx, ry, color, a, blur = 6, rot = 0) => paintPass(t, null, { blob: { x, y, rx, ry, color: rgba(color, a), blur, rot, keep: true } });
function muscle(sex) {
  const t = tex(-150, -435, 150, 90, 2), m = sex === 'm';
  for (const s of [-1, 1]) {
    blob(t, s * 116, -276, 26, 34, HI, 0.35); blob(t, s * 104, -244, 22, 10, SH, 0.35);                  // deltoid cap + its lower edge
    blob(t, s * 56, -324, 34, 5, SH, 0.45, 3); blob(t, s * 52, -330, 30, 4, HI, 0.4, 2);                    // collarbones
    if (m) { blob(t, s * 48, -250, 44, 22, HI, 0.25); blob(t, s * 48, -214, 44, 9, SH, 0.5, 5); }          // pecs
    for (const y of [-150, -116, -84]) { blob(t, s * 20, y, 15, 12, HI, 0.32, 4); blob(t, s * 20, y + 15, 15, 3, SH, 0.38, 2.5); }  // abs
    blob(t, s * 3, -118, 3, 60, SH, 0.3, 3);                                                                 // linea alba
    blob(t, s * 66, -60, 10, 44, SH, 0.3, 6, s * -0.4);                                                      // obliques / v-line
  }
  return t;
}
function soft(sex) {
  const t = tex(-150, -435, 150, 90, 2);
  blob(t, 0, -40, 92, 56, HI, 0.22, 12);                         // rounded belly catches light
  blob(t, 0, 10, 96, 12, DEEP, 0.35, 8);                          // fold under the belly
  for (const s of [-1, 1]) { blob(t, s * 96, -96, 18, 40, SH, 0.3, 8); blob(t, s * 90, -40, 16, 10, SH, 0.3, 5); }   // side fullness / roll
  blob(t, 0, -168, 80, 14, SH, sex === 'm' ? 0.3 : 0.2, 8);       // soft chest underline
  blob(t, 0, -360, 46, 18, SH, 0.22, 8);                          // fuller neck under the chin
  return t;
}
// age lines in face space (same box as the face texture): forehead, crow's feet, under-eye, smile lines
function faceAge() {
  const t = tex(-135, -150, 135, 140, 2.4), g = t.g;
  const line = (pts, w, a) => { g.save(); g.filter = `blur(${0.9 * t.D}px)`; g.strokeStyle = rgba(DEEP, a); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(...pts[0]); g.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); g.stroke(); g.restore(); };
  for (const y of [-86, -72]) line([[-52, y], [-20, y - 5], [20, y - 5], [52, y]], 1.6, 0.35);                 // forehead
  for (const s of [-1, 1]) {
    for (const k of [-1, 0, 1]) line([[s * 78, 6 + k * 7], [s * 84, 6 + k * 8], [s * 88, 6 + k * 10], [s * 92, 6 + k * 13]], 1.1, 0.35);   // crow's feet
    line([[s * 30, 28], [s * 42, 34], [s * 56, 34], [s * 66, 28]], 1.3, 0.3);                                 // under-eye
    line([[s * 18, 44], [s * 30, 58], [s * 34, 72], [s * 32, 84]], 2.2, 0.32);                                // smile lines
    blob(t, s * 50, 50, 22, 18, SH, 0.18, 8);                                                                  // softer cheeks
  }
  return t;
}
export function paintBody() {
  SHADING.k = 1;
  const T = { body_muscle_f: muscle('f'), body_muscle_m: muscle('m'), body_soft_f: soft('f'), body_soft_m: soft('m'), face_age: faceAge() };
  for (const t of Object.values(T)) t.height = { dome: 30, str: 0.8 };
  return T;
}

// glasses in eye space: origin midway between the eyes, eye centres at x = +-46, lens ~ 34 x 26
import { tex as tex2, P as P2, rgba as rgba2 } from '../../mesh/paint/lib.js';
function glasses(kind) {
  const t = tex2(-100, -40, 100, 34, 4), g = t.g;
  const lens = (cx) => P2(p => {
    if (kind === 'round') p.ellipse(cx, 0, 30, 28, 0, 0, 7);
    else if (kind === 'cateye') { p.moveTo(cx - 32, -6); p.bezierCurveTo(cx - 30, -24, cx + 20, -30, cx + 36, -22); p.bezierCurveTo(cx + 34, 6, cx + 20, 24, cx, 24); p.bezierCurveTo(cx - 22, 24, cx - 32, 12, cx - 32, -6); p.closePath(); }
    else p.roundRect(cx - 33, -22, 66, 44, 10);
  });
  for (const s of [-1, 1]) {
    const L = lens(s * 46);
    g.fillStyle = rgba2('#dfe8f0', 0.12); g.fill(L);                                       // faint lens tint
    g.save(); g.clip(L); g.strokeStyle = rgba2('#ffffff', 0.45); g.lineWidth = 3; g.beginPath(); g.moveTo(s * 46 - 20, -14); g.lineTo(s * 46 - 6, -24); g.stroke(); g.restore();   // glint
    g.strokeStyle = '#1d1a1c'; g.lineWidth = kind === 'round' ? 3.2 : 4.2; g.stroke(L);
    g.strokeStyle = rgba2('#6d6870', 0.8); g.lineWidth = 1; g.save(); g.translate(-0.8, -0.8); g.stroke(L); g.restore();
  }
  g.strokeStyle = '#1d1a1c'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-14, -4); g.quadraticCurveTo(0, -10, 14, -4); g.stroke();   // bridge
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 78, -10); g.lineTo(s * 96, -12); g.stroke(); }                               // temple stubs
  return t;
}
export function paintGlasses() { return { glasses_round: glasses('round'), glasses_rect: glasses('rect'), glasses_cateye: glasses('cateye') }; }
