// Creator hair library: hairstyle caps, back masses, spring locks, rigid extras and facial hair,
// painted with mesh/paint/lib.js. The catalogue that names them is mesh/js/hairstyles.js.
// Look: stylised 3D (soft, chunky clumps with rounded shading, 3-4 tones and a broad sheen band,
// a few fine strands), matching story-hike/ref/creator_types_*.webp. Painted near-black with a cool
// sheen; the creator recolours hair at runtime.
// Spaces (see heroine.drawLook):
//   cap / extras  head space: origin head centre, face outline x=+-103 at y=-36, chin y=113, ears x=+-99 y=10,
//                 forehead hairline ~y=-100. Drawn over the face (cap) or behind the body (z 'behind').
//   back          head space, hangs behind the body; below y=40 it follows the chest (like the film hairBack)
//   lock          root at (0,0) hanging along +y, x = across the lock; drawn as a strip on a spring chain
//   facial 'face' the face texture space (eyes y=8, nose tip y=38, mouth centre y=64, lips y 54..80, chin y=113)
//   facial 'mouth' y=0 on the lip line, upper lip top at y=-10, nose base at y=-20
import { tex, P, rgba, rng, sampleCurve, normals } from '../../mesh/paint/lib.js';

const BASE = '#0d0b10', MID = '#1f1c26', SHEEN = '#626a80', SPEC = '#b0b8cc';
const LIGHT = [-0.6, -0.8];                       // key light from the upper left (matches the rig)
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const blurOf = (t, px) => `blur(${Math.max(0, px) * t.D}px)`;
const mixHex = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), m = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return '#' + [m(16), m(8), m(0)].map(v => v.toString(16).padStart(2, '0')).join(''); };

// ---------------------------------------------------------------- the chunky clump
// spine: control points root -> tip; w(u): half width; options:
//   tip / tipStart: how pointed the end is and where the taper starts, root: taper at the root too,
//   shadow: contact shadow strength, sheen: highlight strength, band: [u...] where the sheen peaks,
//   tone: 0..1 lifts the base/mid colours (gives the 3-4 tone look between neighbouring clumps)
function chunk(t, spine, w, o = {}) {
  const g = t.g, r = rng(o.seed || 1), N = 40;
  const pts = sampleCurve(spine, N), nr = normals(pts);
  const ts = o.tipStart ?? 0.72;
  const W = (u) => w(u) * (1 - sm((u - ts) / (1 - ts)) * (o.tip ?? 0.92)) * (o.root ? Math.min(1, 0.4 + u * 5) : 1);
  const outline = new Path2D();
  for (let i = 0; i < N; i++) { const q = pts[i], n = nr[i], ww = W(i / (N - 1)); i ? outline.lineTo(q[0] + n[0] * ww, q[1] + n[1] * ww) : outline.moveTo(q[0] + n[0] * ww, q[1] + n[1] * ww); }
  for (let i = N - 1; i >= 0; i--) { const q = pts[i], n = nr[i], ww = W(i / (N - 1)); outline.lineTo(q[0] - n[0] * ww, q[1] - n[1] * ww); }
  outline.closePath();
  const avgW = w(0.4), tone = o.tone ?? r() * 0.5;
  if ((o.shadow ?? 0.5) > 0) { g.save(); g.translate(1.2, 2.4); g.filter = blurOf(t, avgW * 0.3 + 1.2); g.fillStyle = rgba('#000000', o.shadow ?? 0.5); g.fill(outline); g.restore(); }
  g.save(); g.fillStyle = mixHex(o.base || BASE, '#26222c', tone * 0.5); g.filter = blurOf(t, 0.35); g.fill(outline); g.restore();
  g.save(); g.clip(outline);
  g.save(); g.filter = blurOf(t, avgW * 0.6); g.strokeStyle = rgba(mixHex(MID, '#3a3644', tone), 0.75); g.lineWidth = avgW * 1.1; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.restore();
  g.save(); g.filter = blurOf(t, avgW * 0.28); g.strokeStyle = rgba('#000000', o.edge ?? 0.6); g.lineWidth = avgW * 0.6; g.stroke(outline); g.restore();
  const litOff = pts.map((q, i) => { const n = nr[i], d = n[0] * LIGHT[0] + n[1] * LIGHT[1]; return Math.sign(d || 1) * Math.min(1, Math.abs(d) * 1.4 + 0.2); });
  const bands = o.band || [0.3], bandAt = (u) => Math.max(...bands.map(b => Math.exp(-((u - b) ** 2) / (o.bandW ?? 0.025))));
  const sheen = o.sheen ?? 1, ph = r() * 6.28, ph2 = r() * 6.28;
  for (const [wid, col, a, bl, off] of [[1.0, SHEEN, 0.6, 0.45, 0.26], [0.3, SPEC, 0.45, 0.18, 0.38]]) {
    for (let i = 1; i < N; i++) {
      const u = i / (N - 1), brk = 0.6 + 0.4 * Math.sin(u * 11 + ph) * Math.sin(u * 5 + ph2);
      const k = bandAt(u) * sheen * a * brk; if (k < 0.02) continue;
      const q0 = pts[i - 1], q1 = pts[i], n0 = nr[i - 1], n1 = nr[i], w0 = W((i - 1) / (N - 1)), w1 = W(u);
      g.save(); g.filter = blurOf(t, avgW * bl + 0.3); g.strokeStyle = rgba(col, Math.min(1, k)); g.lineWidth = Math.max(0.6, w1 * wid); g.lineCap = 'round';
      g.beginPath(); g.moveTo(q0[0] + n0[0] * w0 * off * litOff[i - 1], q0[1] + n0[1] * w0 * off * litOff[i - 1]); g.lineTo(q1[0] + n1[0] * w1 * off * litOff[i], q1[1] + n1[1] * w1 * off * litOff[i]); g.stroke(); g.restore();
    }
  }
  for (let s = 0; s < (o.strands ?? 7); s++) {
    const off = (r() * 2 - 1) * 0.8, u0 = r() * 0.15, u1 = 0.6 + r() * 0.4, light = r() < 0.4;
    g.beginPath();
    for (let i = Math.floor(u0 * (N - 1)); i <= Math.floor(u1 * (N - 1)); i++) { const q = pts[i], n = nr[i], ww = W(i / (N - 1)) * off; i === Math.floor(u0 * (N - 1)) ? g.moveTo(q[0] + n[0] * ww, q[1] + n[1] * ww) : g.lineTo(q[0] + n[0] * ww, q[1] + n[1] * ww); }
    g.strokeStyle = light ? rgba('#6a7286', 0.25) : rgba('#000000', 0.3); g.lineWidth = 0.5 + r() * 0.5; g.stroke();
  }
  g.restore();
  return outline;
}
function mass(t, path, color = '#09080c', blur = 2, rule = 'nonzero') { const g = t.g; g.save(); g.fillStyle = color; g.filter = blurOf(t, blur); g.fill(path, rule); g.restore(); }
// base fill of caps that frame the face: the dome, then the face opening erased (before any clumps)
function massFramed(t, dome, side) {
  mass(t, dome, '#08070b', 1.5);
  const g = t.g; g.save(); g.globalCompositeOperation = 'destination-out'; g.filter = blurOf(t, 1); g.fillStyle = '#000'; g.fill(faceHole(side, -104, 1, 300)); g.restore();
}
// the forehead region (an ellipse under the hairline) that featherHairline softens
const forehead = (hl = -104) => P(p => p.ellipse(0, -48, 74, -48 - hl, 0, 0, 7));
function halo(t, path, cx, cy, rx, ry, a = 0.3, rot = 0) {
  const g = t.g; g.save(); g.clip(path); g.globalCompositeOperation = 'lighter'; g.translate(cx, cy); g.rotate(rot); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx); gr.addColorStop(0, rgba('#000000', 0)); gr.addColorStop(0.74, rgba('#3a4050', a)); gr.addColorStop(1, rgba('#000000', 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore();
}
function strays(t, n, seed, at, o = {}) {
  const g = t.g, r = rng(seed);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(r()), ang = (o.ang ?? -Math.PI / 2) + (r() - 0.5) * (o.spread ?? 1.4), L = (o.len ?? 20) * (0.6 + r() * 0.8);
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(ang) * L * 0.6 + (r() - 0.5) * 8, y0 + Math.sin(ang) * L * 0.6, x0 + Math.cos(ang) * L + (r() - 0.5) * 10, y0 + Math.sin(ang) * L);
    g.strokeStyle = rgba('#15131a', o.alpha ?? 0.55); g.lineWidth = o.w ?? (0.4 + r() * 0.3); g.stroke();
  }
}
// feathered hairline: erase a soft band inside the face opening (kills hard edges and the dark
// shadow halo on the forehead), then lay a few fine baby hairs back over it
function featherHairline(t, hole, o = {}) {
  const g = t.g;
  g.save(); g.globalCompositeOperation = 'destination-out'; g.filter = blurOf(t, o.soft ?? 3.5); g.fillStyle = '#000'; g.translate(0, o.dy ?? 1.5); g.fill(hole); g.restore();
  g.save(); g.globalCompositeOperation = 'destination-out'; g.filter = blurOf(t, 0.6); g.fillStyle = '#000'; g.translate(0, (o.dy ?? 1.5) + (o.inset ?? 5)); g.fill(hole); g.restore();
  if (o.baby !== false) {
    const r = rng(o.seed || 5);
    for (let i = 0; i < (o.n ?? 70); i++) {
      const a = Math.PI * (0.12 + 0.76 * r()), x = Math.cos(a) * -(o.rx ?? 92), y = (o.cy ?? -24) - Math.sin(a) * (o.ry ?? 82);
      const ang = Math.atan2(y - (o.cy ?? -24), x) + Math.PI + (r() - 0.5) * 0.6, L = 3 + r() * 6;
      g.beginPath(); g.moveTo(x - Math.cos(ang) * 4, y - Math.sin(ang) * 4); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L);
      g.strokeStyle = rgba('#17141b', 0.35 + r() * 0.25); g.lineWidth = 0.45; g.stroke();
    }
  }
}
// short directional hairs inside a soft mask (buzz cuts, fades, stubble, beard texture)
function furField(t, mask, dir, o = {}) {
  const g = t.g, D = t.D, [x0, y0, x1, y1] = t.box, Wc = t.c.width, Hc = t.c.height, r = rng(o.seed || 3);
  const mc = document.createElement('canvas'); mc.width = Wc; mc.height = Hc; const mg = mc.getContext('2d', { willReadFrequently: true });
  mg.setTransform(D, 0, 0, D, -x0 * D, -y0 * D); mg.filter = blurOf(t, o.soft ?? 4); mg.fillStyle = '#fff'; mg.fill(mask);
  const A = mg.getImageData(0, 0, Wc, Hc).data, at = (x, y) => { const i = (Math.floor((y - y0) * D) * Wc + Math.floor((x - x0) * D)) * 4 + 3; return (A[i] || 0) / 255; };
  if (o.under) { g.save(); g.filter = blurOf(t, (o.soft ?? 4) * 0.8); g.fillStyle = o.under; g.fill(mask); g.restore(); }
  const n = o.n || 4000, cols = o.cols || [o.base || '#141117'];
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), a = at(x, y);
    if (a < 0.03 || r() > Math.pow(a, o.falloff ?? 1)) continue;
    if (o.band && (a < o.band[0] || a > o.band[1])) continue;
    if (o.densY && r() > o.densY(y)) continue;
    const ang = dir(x, y) + (r() - 0.5) * (o.jitter ?? 0.5), L = (o.len || 6) * (0.6 + r() * 0.7) * (0.5 + 0.5 * a), bend = (r() - 0.5) * (o.curl ?? 0.3);
    const lit = Math.max(0, Math.min(1, -(x + 60) * 0.004 - (y + 60) * 0.004 + r() * 0.6));
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(ang + bend) * L * 0.5, y + Math.sin(ang + bend) * L * 0.5, x + Math.cos(ang + bend * 2) * L, y + Math.sin(ang + bend * 2) * L);
    g.strokeStyle = r() < (o.hiShare ?? 0.2) * lit + (o.hiShare === 0 ? 0 : 0.02) ? rgba(o.hi || '#5d6375', 0.55) : rgba(cols[Math.floor(r() * cols.length)], (o.alpha ?? 0.75) * (0.6 + 0.4 * a));
    g.lineWidth = (o.w || 0.6) * (0.7 + r() * 0.6); g.lineCap = 'round'; g.stroke();
  }
}
// soft-volume facial hair with a real fur edge: crisp fill, an irregular eroded rim, value from light
// tips to a dark underside, clumped tufts, body strands, then edge strands that cross the outline
function furVolume(t, mask, dir, o = {}) {
  const g = t.g, r = rng(o.seed || 11), C = o.cols || {}, core = C.core || '#0b0a0c', body = C.body || '#1a181b', edge = C.edge || '#2e2b2f', tip = C.tip || '#4a464c';
  g.save(); g.filter = blurOf(t, 0.5); g.fillStyle = rgba(body, o.fill ?? 0.95); g.fill(mask); g.restore();
  g.save(); g.globalCompositeOperation = 'destination-out'; g.filter = blurOf(t, 1.2); g.strokeStyle = rgba('#000000', 0.8); g.lineWidth = o.rim ?? 5; g.stroke(mask); g.restore();
  g.save(); g.clip(mask);
  const [y0, y1] = o.span || [-30, 140];
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, rgba(tip, 0.5)); gr.addColorStop(0.35, rgba(edge, 0.25)); gr.addColorStop(0.7, rgba(body, 0)); gr.addColorStop(1, rgba(core, 0.85));
  g.fillStyle = gr; g.fillRect(-200, y0 - 40, 400, y1 - y0 + 120);
  const side = g.createLinearGradient(-110, 0, 110, 0); side.addColorStop(0, rgba(tip, 0.3)); side.addColorStop(0.4, rgba(tip, 0)); side.addColorStop(1, rgba('#000000', 0.3));
  g.fillStyle = side; g.fillRect(-200, y0 - 40, 400, y1 - y0 + 120);
  for (let i = 0; i < (o.tufts ?? 20); i++) {
    const x = lerp(o.x0 ?? -95, o.x1 ?? 95, r()), y = lerp(y0, y1, r()), L = (o.tuftLen ?? 14) * (0.7 + r() * 0.8), a = dir(x, y);
    g.save(); g.filter = blurOf(t, 1.2); g.strokeStyle = rgba(r() < 0.55 ? tip : core, 0.45); g.lineWidth = 2.5 + r() * 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); g.restore();
  }
  g.restore();
  furField(t, mask, dir, { n: o.n || 8000, len: o.len || 3, w: 0.5, soft: 1.5, alpha: 0.7, hiShare: 0.25, hi: tip, seed: o.seed, curl: 0.5, falloff: 0.9, cols: [core, body, edge] });
  // fur edge: light-tipped strands rooted just inside the rim, crossing it
  furField(t, mask, dir, { n: (o.n || 8000) * 0.8, len: (o.len || 3) * 1.6, w: 0.5, soft: 3, alpha: 0.8, hiShare: 0.45, hi: tip, seed: (o.seed || 11) + 1, curl: 0.4, band: [0.35, 0.8], cols: [edge, tip, body] });
}
// a curl: a short spiral chunk; size and thickness vary so curl masses never look ropy
function curl(t, cx, cy, R, seed, o = {}) {
  const r = rng(seed), a0 = (o.a0 ?? r() * 6.28), sweep = (o.sweep ?? 5.2) * (0.75 + r() * 0.45), sp = [];
  for (let i = 0; i <= 8; i++) { const a = a0 + sweep * i / 8, q = R * (1 - i / 14); sp.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q * (o.squash ?? (0.75 + r() * 0.2))]); }
  chunk(t, sp, (u) => R * (o.thick ?? (0.6 + r() * 0.2)) * (1 - u * 0.28), { seed, tip: 0.6, shadow: 0.5, sheen: o.sheen ?? 0.9, band: [0.3], bandW: 0.05, strands: 2 });
}
function curlMass(t, path, o = {}) {
  const r = rng(o.seed || 7), [x0, y0, x1, y1] = o.bounds || t.box, pts = [];
  const test = document.createElement('canvas').getContext('2d');
  for (let i = 0; i < (o.tries || 8000) && pts.length < (o.n || 200) * 1.4; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    if (test.isPointInPath(path, x, y)) pts.push([x, y]);
  }
  mass(t, path, '#08070b', 3);
  pts.sort((a, b) => (a[1] - b[1]) + (Math.abs(b[0]) - Math.abs(a[0])) * 0.2);
  pts.forEach(([x, y], i) => curl(t, x, y, (o.R || 12) * (0.55 + r() * 0.9), (o.seed || 7) * 31 + i, { sheen: 0.6 + 0.5 * Math.max(0, -(x * 0.6 + (y - (o.cy ?? -60)) * 0.8) / 160) }));
}

// ---------------------------------------------------------------- caps (head space)
// face opening shared by caps (hairline at y~-104 centre, temples, down past the ears)
const faceHole = (side, hl = -104, face = 1, ext = 60) => P(p => {
  p.moveTo(-96 * face, side + ext); p.lineTo(-96 * face, side); p.bezierCurveTo(-104 * face, 12, -96 * face, -46, -68, -84); p.bezierCurveTo(-46, hl + 4, -14, hl, 0, hl);
  p.bezierCurveTo(14, hl, 46, hl + 4, 68, -84); p.bezierCurveTo(96 * face, -46, 104 * face, 12, 96 * face, side); p.lineTo(96 * face, side + ext); p.closePath();
});
// cap silhouette: a smooth dome (horizontal tangent at the top, so the two sides meet without a notch)
function domeShape(side, crown, out = 1.08, outer = 136) {
  const X = outer * out;
  return P(p => {
    p.moveTo(0, crown); p.bezierCurveTo(X * 0.62, crown, X, (crown - 30) * 0.62, X, -30); p.bezierCurveTo(X + 2, 12, X * 0.94, side * 0.6, X * 0.87, side);
    p.lineTo(-X * 0.87, side); p.bezierCurveTo(-X * 0.94, side * 0.6, -X - 2, 12, -X, -30); p.bezierCurveTo(-X, (crown - 30) * 0.62, -X * 0.62, crown, 0, crown); p.closePath();
  });
}
// long / medium parted hair. Rows: crown cover (closes the part and lifts the crown above the skull),
// silhouette row, face-framing row with S-waves whose ends curl outward.
function partedCap(o) {
  const part = o.part ?? -4, side = o.side ?? 74, crown = o.crown ?? -170, out = o.out ?? 1.06, wav = o.wave ?? 0.5, seed = o.seed || 101;
  const t = tex(-190, -225, 190, side + 70, o.D || 2.2), r = rng(seed);
  const shape = domeShape(side, crown, out);
  massFramed(t, shape, side);
  // silhouette row: wide clumps from the crown over the sides
  for (const s of [1, -1]) for (let k = 0; k < 5; k++) {
    const f = k / 4, X = 132 * out;
    chunk(t, [[part + s * (8 + f * 20), crown + 10], [s * (54 + f * 50), crown + 18 + f * 26], [s * X * (0.94 + f * 0.04), -66 + f * 34], [s * X * 0.97 + Math.sin(f * 4 + seed) * 6 * wav, side * 0.5], [s * X * 0.9 + s * wav * 10, side + 4]],
      (u) => 20 * (1 - u * 0.15), { seed: seed + k * 9 + (s > 0 ? 70 : 0), band: [0.2, 0.62], sheen: s < 0 ? 0.95 : 0.6, tip: 0.8, shadow: 0.35, tone: 0.1 + f * 0.3 });
  }
  // crown cover: clumps rising from the part over the top (no gap, visible lift)
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
    const f = k / 2;
    chunk(t, [[part + s * 1, crown + 30 + f * 6], [part + s * (16 + f * 10), crown + 6], [s * (60 + f * 26), crown + 16 + f * 12], [s * (102 + f * 14) * out, -96 + f * 22]],
      (u) => 17 * (1 - u * 0.2), { seed: seed + 200 + k + (s > 0 ? 20 : 0), band: [0.32], bandW: 0.04, sheen: s < 0 ? 1.15 : 0.8, tip: 0.7, root: true, shadow: 0.3, tone: 0.35 });
  }
  // face-framing row: from the part down beside the face, S-waves, ends flick outward
  for (const s of [1, -1]) {
    const span = (118 - s * part) / 118;
    for (let k = 0; k < 4; k++) {
      const f = k / 3, dip = s * part > 0 ? 0 : Math.min(30, -s * part * 0.55), wv = (i) => wav * Math.sin(f * 4 + i * 1.8 + seed) * (5 + i * 3);
      const sp = [[part + s * (3 + f * 8) * span, crown + 26], [part + s * (34 + f * 30) * span, crown + 30 + f * 14 + dip * 0.3], [s * (86 + f * 16) + wv(1), -98 + f * 18 + dip],
        [s * (106 + f * 10) + wv(2), -36 + f * 18 + dip * 0.4], [s * (110 + f * 6) + wv(3), side * 0.5 + f * 8], [s * (104 + f * 6) + s * wav * 14 * (o.tuck ? -1.3 : 1), side + 4 + r() * 6]];
      chunk(t, sp, (u) => (o.cw ?? 16) * (1 + 0.22 * Math.sin(u * 3)) * (1 - u * 0.12), { seed: seed + k * 11 + (s > 0 ? 50 : 0), band: [0.22, 0.64], sheen: s < 0 ? 1.05 : 0.72, tip: o.tuck ? 0.55 : 0.85, shadow: 0.55, tone: 0.2 + r() * 0.4 });
    }
  }
  halo(t, shape, -14, -116, 132, 70, 0.22, -0.1);
  featherHairline(t, forehead(), { seed: seed + 1, ry: 80, baby: !o.fringe });
  if (o.fringe) fringe(t, o.fringe, part, seed);   // bangs go over the feathered hairline
  t.height = { dome: 34, str: 0.8, aoR: 8, ao: 3 };
  return t;
}
function fringe(t, kind, part, seed) {
  const r = rng(seed + 50);
  if (kind === 'blunt') {
    for (let k = 0; k < 9; k++) { const x = -86 + k * 21.5 + (r() - 0.5) * 3;
      chunk(t, [[x * 0.5, -150], [x * 0.8, -118], [x * 0.98, -80], [x * 1.02, -50 + r() * 4]], () => 13.5, { seed: seed + 300 + k, tip: 0.3, tipStart: 0.86, band: [0.35], sheen: x < 0 ? 1 : 0.7, shadow: 0.45 }); }
  } else if (kind === 'curtain') {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const f = k / 2;
      chunk(t, [[part + s * (2 + f * 8), -146], [part + s * (18 + f * 14), -110], [s * (46 + f * 14), -72 + f * 8], [s * (74 + f * 12), -28 + f * 16], [s * (88 + f * 8), 6 + f * 14]],
        (u) => 13 * (1 - u * 0.25), { seed: seed + 400 + k + (s > 0 ? 40 : 0), band: [0.3, 0.7], sheen: s < 0 ? 1 : 0.7, tip: 0.9 }); }
  } else if (kind === 'side') {
    for (let k = 0; k < 4; k++) { const f = k / 3;
      chunk(t, [[part - 2 + f * 10, -150], [part + 34 + f * 22, -132 + f * 6], [42 + f * 28, -98 + f * 12], [78 + f * 16, -58 + f * 18], [96 + f * 8, -22 + f * 22]],
        (u) => 14 * (1 - u * 0.2), { seed: seed + 500 + k, band: [0.25, 0.65], tip: 0.9 }); }
  }
}
// bob: a clean rounded mass with a swept fringe; ends curve under toward the jaw (symmetric)
function bobCap(o = {}) {
  const side = o.side ?? 96, seed = o.seed || 140, t = tex(-185, -225, 185, side + 60, 2.2), r = rng(seed);
  const shape = P(p => { p.moveTo(0, -172); p.bezierCurveTo(100, -172, 142, -100, 142, -30); p.bezierCurveTo(142, 40, 132, side - 10, 108, side + 6); p.bezierCurveTo(100, side + 10, 96, side, 94, side - 8);
    p.lineTo(-94, side - 8); p.bezierCurveTo(-96, side, -100, side + 10, -108, side + 6); p.bezierCurveTo(-132, side - 10, -142, 40, -142, -30); p.bezierCurveTo(-142, -100, -100, -172, 0, -172); p.closePath(); });
  massFramed(t, shape, side);
  for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
    const f = k / 6, x0 = s * (4 + f * 30);
    chunk(t, [[x0, -166], [s * (40 + f * 60), -150 + f * 22], [s * (118 + f * 18), -70 + f * 30], [s * (134 + f * 4), 10 + f * 10], [s * (124 - f * 6), side - 8], [s * (104 - f * 8), side + 2]],
      (u) => 19 * (1 - u * 0.12), { seed: seed + k * 7 + (s > 0 ? 40 : 0), band: [0.18, 0.55], sheen: s < 0 ? 1 : 0.65, tip: 0.5, tipStart: 0.8, shadow: 0.45, tone: 0.15 + f * 0.35 });
  }
  for (let k = 0; k < 4; k++) { const f = k / 3, s = k % 2 ? 1 : -1;
    chunk(t, [[s * -10, -150], [s * (10 + f * 20), -170], [s * (60 + f * 30), -160 + f * 14], [s * (110 + f * 10), -112 + f * 20]], (u) => 17 * (1 - u * 0.2), { seed: seed + 600 + k, root: true, band: [0.35], bandW: 0.04, sheen: s < 0 ? 1.1 : 0.75, tip: 0.7, shadow: 0.3, tone: 0.35 }); }
  halo(t, shape, -16, -120, 136, 74, 0.25, -0.1);
  featherHairline(t, forehead(), { seed: seed + 3, baby: false });
  fringe(t, o.fringe || 'side', -24, seed);
  t.height = { dome: 36, str: 0.8, aoR: 8, ao: 3 };
  return t;
}
// sleek pulled-back cap (ponytails, buns, braids)
function pulledCap(o) {
  const t = tex(-160, -215, 160, 50, o.D || 2.2), g = t.g, seed = o.seed || 201, part = o.part;
  const shape = P(p => {
    p.moveTo(0, -156); p.bezierCurveTo(80, -156, 124, -104, 124, -36); p.bezierCurveTo(124, -8, 118, 8, 110, 22);
    p.lineTo(-110, 22); p.bezierCurveTo(-118, 8, -124, -8, -124, -36); p.bezierCurveTo(-124, -104, -80, -156, 0, -156); p.closePath();
  });
  mass(t, shape, '#0a090d', 1);
  g.save(); g.clip(shape);
  const G = o.gather || [10, -180];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * (0.04 + 0.92 * k / 12), x = Math.cos(a) * -104, y = -24 - Math.sin(a) * 82 + Math.abs(Math.cos(a)) * 20, s = Math.sign(x) || 1;
    const to = part != null ? [part + s * 10, -176] : [lerp(x, G[0], 0.6), G[1]];
    chunk(t, [[x, y + 10], [lerp(x, to[0], 0.3) + s * 18 * (1 - Math.abs(x) / 120), lerp(y, to[1], 0.45)], [lerp(x, to[0], 0.7) + s * 6, lerp(y, to[1], 0.8)], to],
      (u) => 16 * (1 - u * 0.4), { seed: seed + k * 7, root: true, tip: 0.4, band: [0.45], bandW: 0.05, sheen: x < 0 ? 1.1 : 0.8, shadow: 0.3, strands: 9 });
  }
  g.restore();
  if (part != null) { g.save(); g.strokeStyle = rgba('#80645c', 0.45); g.lineWidth = 1.5; g.filter = blurOf(t, 0.7); g.beginPath(); g.moveTo(part, -102); g.lineTo(part, -150); g.stroke(); g.restore(); }
  halo(t, shape, -20, -100, 116, 60, 0.32, -0.15);
  featherHairline(t, faceHole(22), { seed: seed + 2, n: 90 });
  t.height = { dome: 26, str: 0.8, aoR: 6, ao: 3 };
  return t;
}
// short cuts: a rounded volume of chunky clumps; style decides the flow
function shortCap(style, seed = 301) {
  const top = { crop: -178, side: -174, slick: -168, pomp: -212, buzz: -142, undercut: -188, wavy: -176, pixie: -172, messy: -186, mlong: -164 }[style];
  const t = tex(-170, -240, 170, 100, 2.2), g = t.g, r = rng(seed);
  const sideW = style === 'buzz' ? 106 : style === 'undercut' ? 110 : style === 'mlong' ? 120 : 122;
  const sideB = style === 'mlong' ? 4 : style === 'wavy' ? 14 : style === 'pixie' ? 12 : -2;
  const hl = style === 'buzz' ? -92 : -100;
  const shape = P(p => { p.moveTo(0, top); p.bezierCurveTo(sideW * 0.62, top, sideW + 6, (top - 30) * 0.6, sideW, -36); p.bezierCurveTo(sideW, -6, sideW - 6, sideB - 8, sideW - 14, sideB);
    p.lineTo(-sideW + 14, sideB); p.bezierCurveTo(-sideW + 6, sideB - 8, -sideW, -6, -sideW, -36); p.bezierCurveTo(-sideW - 6, (top - 30) * 0.6, -sideW * 0.62, top, 0, top); p.closePath(); });
  const hole = faceHole(sideB, hl);
  if (style === 'buzz') {
    // buzz: dense very short stubble-like hair, natural (not receding) hairline
    furField(t, shape, (x, y) => Math.atan2(y + 30, x) - Math.PI * 0.1 * Math.sign(x || 1), { n: 34000, len: 1.6, w: 0.6, soft: 2, under: rgba('#221e26', 0.82), alpha: 0.8, hiShare: 0.3, seed, cols: ['#141117', '#1f1b24', '#2a2530'] });
    halo(t, shape, -16, -98, 104, 42, 0.22, -0.1);
    featherHairline(t, hole, { seed: seed + 1, soft: 2.5, inset: 3, baby: false });
    t.height = { dome: 14, str: 0.6, aoR: 4, ao: 2 };
    return t;
  }
  mass(t, shape, '#08070b', 1.6);
  if (style === 'undercut') {   // buzzed sides following the skull; the long top overhangs them
    const sides = P(p => { for (const s of [-1, 1]) p.rect(s > 0 ? 66 : -200, -150, 134, 170); });
    g.save(); g.clip(shape); g.globalCompositeOperation = 'destination-out'; g.filter = blurOf(t, 3); g.fill(sides); g.restore();
    g.save(); g.clip(shape);
    furField(t, sides, (x) => Math.PI / 2 + Math.sign(x) * 0.4, { n: 14000, len: 1.6, w: 0.55, soft: 4, under: rgba('#2a2328', 0.75), alpha: 0.85, hiShare: 0.25, seed: seed + 2 });
    g.restore();
  }
  const flows = [];
  if (style === 'crop' || style === 'messy') {
    const n = style === 'messy' ? 14 : 11;
    for (let k = 0; k < n; k++) { const f = k / (n - 1) * 2 - 1, s = Math.sign(f) || 1, af = Math.abs(f), j = style === 'messy' ? 1.6 : 1;
      flows.push([[f * 30 + (r() - 0.5) * 10 * j, top + 18], [f * 60 + s * 6 + (r() - 0.5) * 8 * j, top + 42 + af * 14], [f * 88 + (r() - 0.5) * 14 * j, -110 + af * 42], [f * 96 + s * (4 + r() * 14 * j) - (1 - af) * s * 14, -86 + af * 54 + r() * 12 * j]]); }
    for (let k = 0; k < 4; k++) { const f = (k + r() * 0.6) / 4 * 2 - 1, a = (r() - 0.5) * 0.8; flows.push([[f * 26, top + 14 + r() * 10], [f * 52 + Math.cos(a) * 14, top + 30 + r() * 10], [f * 78 + (r() - 0.5) * 24, top + 52 + Math.abs(f) * 20 + r() * 14]]); }
  } else if (style === 'side' || style === 'undercut') {
    const px = -46;
    if (style === 'side') for (let k = 0; k < 5; k++) { const f = k / 4; flows.push([[px - 4, top + 20 + f * 10], [px - 34 - f * 20, top + 36 + f * 16], [-sideW + 22, -60 + f * 20], [-sideW + 24, sideB - 10]]); }
    for (let k = 0; k < 12; k++) { const f = k / 11; flows.push([[px + f * 10, top + 14], [px + 40 + f * 50, top + 8 + f * 10], [64 + f * 40, -110 + f * 34], [sideW - 12, -60 + f * 40]]); }
    if (style === 'undercut') for (let k = 0; k < 6; k++) { const f = k / 5; flows.push([[px + 4, top + 14], [px - 20 - f * 20, top + 20 + f * 10], [-70 - f * 20, -116 + f * 18]]); }   // short left-side top
  } else if (style === 'slick') {
    for (let k = 0; k < 14; k++) { const f = k / 13 * 2 - 1, af = Math.abs(f); flows.push([[f * 86, -98 + af * 30], [f * 78, -136 + af * 18], [f * 54, top + 12], [f * 24, top + 2]]); }
  } else if (style === 'pomp') {
    for (let k = 0; k < 13; k++) { const f = k / 12 * 2 - 1, af = Math.abs(f); flows.push([[f * 78, -98 + af * 26], [f * 84 - 4, -170 + af * 40], [f * 66 + 4, top + 4 + af * 34], [f * 34 + 14, top + 22 + af * 20]]); }
  } else if (style === 'wavy') {
    for (let k = 0; k < 6; k++) { const f = k / 5; flows.push([[-40, top + 22], [-70 - f * 20, top + 50 + f * 10], [-112 + f * 4, -60 + f * 24], [-118 + Math.sin(k) * 6, sideB - 16 + f * 10]]); }
    for (let k = 0; k < 12; k++) { const f = k / 11; flows.push([[-36 + f * 14, top + 16], [10 + f * 50, top + 22 + f * 16], [56 + f * 44, -110 + f * 40], [92 + f * 26 + Math.sin(k * 1.3) * 8, -66 + f * 70], [112 + f * 8, -30 + f * 50]]); }
  } else if (style === 'mlong') {   // masculine shoulder length: side part, swept back over the ears (the length hangs behind as a back mass)
    const px = -30;
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const f = k / 6;
      flows.push([[px + s * 2, top + 16], [px + s * (34 + f * 34), top + 20 + f * 16], [s * (100 + f * 14), -104 + f * 26], [s * (114 + f * 6) + Math.sin(k * 1.7) * 7, -44 + f * 24], [s * (112 + f * 4) + s * r() * 10, sideB - 14 + r() * 26]]); }
  } else if (style === 'pixie') {
    for (let k = 0; k < 14; k++) { const f = k / 13 * 2 - 1, af = Math.abs(f); flows.push([[f * 26 - 16, top + 12], [f * 64 - 4, top + 34], [f * 92 + 18, -86 + af * 30], [f * 96 + 30, -72 + af * 40]]); }
  }
  const shuffled = style === 'crop' || style === 'messy';
  (shuffled ? flows.map(f => [r(), f]).sort((a, b) => a[0] - b[0]).map(a => a[1]) : flows.sort((a, b) => b[0][1] - a[0][1])).forEach((sp, k) => {
    const lit = sp[sp.length - 1][0] < 0 ? 1.05 : 0.75, back = style === 'slick' || style === 'pomp';
    const wide = style === 'crop' || style === 'messy' ? 15 + r() * 10 : style === 'slick' ? 14 : 17;
    chunk(t, sp, (u) => wide * (1 + 0.2 * Math.sin(u * 3)) * (1 - u * 0.2), { seed: seed + k * 13, root: back, band: back ? [0.5] : [0.4], bandW: back ? 0.05 : 0.04, sheen: lit * (back ? 0.75 : 1), tip: back ? 0.5 : 0.75, tipStart: 0.6, shadow: 0.5, strands: back ? 10 : 7 });
  });
  // tousled silhouette pieces breaking the dome
  if (style !== 'slick' && style !== 'undercut' && style !== 'mlong') for (let k = 0; k < (style === 'pomp' ? 3 : style === 'messy' ? 9 : 6); k++) {
    const n = style === 'messy' ? 9 : 6, a = -Math.PI * (0.18 + 0.64 * (k + 0.5) / n) + (r() - 0.5) * 0.15, cy = (top - 40) * 0.42, rx = sideW + 6, ry = (cy - top) * 1.02;
    const R1 = (style === 'messy' ? 1.1 : 1.04) + r() * 0.06;
    const P0 = [Math.cos(a) * rx * 0.78, cy + Math.sin(a) * ry * 0.78], P1 = [Math.cos(a) * rx * R1 + 10 * Math.sign(Math.cos(a) || 1), cy + Math.sin(a) * ry * R1 + 6];
    chunk(t, [P0, [lerp(P0[0], P1[0], 0.6) + 6, lerp(P0[1], P1[1], 0.6) - 4], P1], (u) => 12 * (1 - u * 0.3), { seed: seed + 700 + k, tip: 0.9, band: [0.35], sheen: Math.cos(a) < 0 ? 1 : 0.7, shadow: 0.4, strands: 4 });
  }
  halo(t, shape, -16, top + 52, 104, 46, 0.3, -0.12);
  featherHairline(t, hole, { seed: seed + 3, n: style === 'slick' ? 40 : 60, ry: -hl - 24 });
  t.height = { dome: 24, str: 0.8, aoR: 6, ao: 3 };
  return t;
}
function curlyCap(o) {
  const R = o.r || 140, cy = o.cy ?? -60, bottom = o.bottom ?? 40, t = tex(-R - 40, cy - R - 40, R + 40, bottom + 30, o.D || 2), g = t.g;
  const shape = P(p => {
    p.ellipse(0, cy, R, R * (o.squash ?? 0.92), 0, Math.PI * 0.94, Math.PI * 2.06);
    p.lineTo(R * 0.86, bottom); p.lineTo(96, bottom); p.bezierCurveTo(102, -30, 88, -66, 62, -88); p.bezierCurveTo(30, (o.line ?? -106), -30, (o.line ?? -106), -62, -88);
    p.bezierCurveTo(-88, -66, -102, -30, -96, bottom); p.lineTo(-R * 0.86, bottom); p.closePath();
  });
  curlMass(t, shape, { n: o.n || 160, R: o.coil || 14, seed: o.seed || 401, cy });
  halo(t, shape, -10, cy, R * 0.95, R * 0.8, 0.18);
  featherHairline(t, faceHole(bottom, (o.line ?? -106) + 2), { seed: (o.seed || 401) + 1, soft: 3, inset: 3, baby: false });
  t.height = { dome: 30, str: 0.9, aoR: 6, ao: 3 };
  return t;
}

// ---------------------------------------------------------------- backs (head space, hang behind the body)
// big clumped S-waves; ends taper and curl outward; lengths kept even so the hem reads soft, not jagged
function backMass(o) {
  const len = o.len ?? 480, spread = o.spread ?? 1, t = tex(-250, -180, 250, len + 70, o.D || 1.4), r = rng(o.seed || 501);
  const reach = Math.min(1, Math.max(0, (len - 160) / 300));
  const outline = P(p => { p.moveTo(0, -150); p.bezierCurveTo(132, -150, 138 + 30 * reach * spread, 60, 130 + 30 * reach * spread, Math.min(200, len * 0.45)); p.bezierCurveTo(118 * spread, len * 0.62, 80, len * 0.72, 0, len * 0.72);
    p.bezierCurveTo(-80, len * 0.72, -118 * spread, len * 0.62, -130 - 30 * reach * spread, Math.min(200, len * 0.45)); p.bezierCurveTo(-138 - 30 * reach * spread, 60, -132, -150, 0, -150); p.closePath(); });
  mass(t, outline, '#050407', 3);
  for (const row of [0, 1]) {
    const N = row ? 7 : 6;
    for (let k = 0; k < N; k++) {
      const f = ((k + (row ? 0.5 : 0)) / (N - (row ? 0 : 1))) * 2 - 1, s = Math.sign(f) || 1, af = Math.abs(f);
      const L = (len - 30) * (0.9 + r() * 0.1) * (1 - af * 0.1) * (o.layers ? 1 - (k % 2) * 0.18 * o.layers : 1);
      const amp = (o.wave ?? 1) * 26, ph = r() * 6.28, sp = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8, outx = f * (100 + (40 * reach * spread + 12) * sm(u * 2.2)) * (row ? 0.92 : 1.04);
        sp.push([outx + Math.sin(u * (o.freq ?? 1.25) * 6.28 + ph) * amp * (0.15 + u) + s * sm((u - 0.75) / 0.25) * 22 * (o.flick ?? 1), -136 + af * 30 + u * L]); }
      chunk(t, sp, (u) => (o.cw ?? 36) * (1 - u * 0.25), { seed: (o.seed || 501) + k + row * 50, band: [0.14, 0.46, 0.76], bandW: 0.014, sheen: (row ? 0.95 : 0.6) * (s < 0 ? 1 : 0.75), tip: 0.72, tipStart: 0.84, shadow: 0.5, strands: 9, tone: row ? 0.3 + r() * 0.4 : 0.1 });
    }
  }
  t.height = { dome: 30, str: 0.8, aoR: 8, ao: 3 };
  return t;
}
function curlBack(o) {
  const len = o.len ?? 420, t = tex(-250, -180, 250, len + 70, o.D || 1.4), r = rng(o.seed || 601);
  const outline = P(p => p.ellipse(0, len * 0.32, 160, len * 0.58, 0, 0, 7));
  mass(t, outline, '#050407', 5);
  for (let c = 0; c < 9; c++) {
    const f = c / 8 * 2 - 1, x0 = f * 132, L = len * (0.8 - Math.abs(f) * 0.2) + r() * 40;
    for (let y = -110 + Math.abs(f) * 40; y < L; y += 18 + r() * 10) curl(t, x0 + Math.sin(y * 0.02 + c) * 10 + f * y * 0.08, y, 12 + r() * 9, (o.seed || 601) + c * 97 + Math.round(y), { sheen: 0.7 });
  }
  t.height = { dome: 26, str: 0.9, aoR: 6, ao: 3 };
  return t;
}
function afroBack(o) {
  const R = o.r || 190, t = tex(-R - 30, -R - 90, R + 30, 170, o.D || 1.5), cy = -64;
  const shape = P(p => p.ellipse(0, cy, R, R * 0.92, 0, 0, 7));
  curlMass(t, shape, { n: o.n || 260, R: o.coil || 16, seed: o.seed || 701, cy });
  halo(t, shape, -20, cy - 10, R * 0.95, R * 0.86, 0.2);
  t.height = { dome: 40, str: 0.9, aoR: 6, ao: 3 };
  return t;
}

// ---------------------------------------------------------------- locks (spring chains)
// two plump clumps with a big S-wave; the end flicks outward (+x for o.out = 1)
function lockTex(len, w, seed, o = {}) {
  const t = tex(-w * 3, -8, w * 3, len + 40, o.D || 2), r = rng(seed), n = o.n || 2;
  if (o.ringlet) { for (let y = 0; y < len - 10; y += w * 0.8) curl(t, Math.sin(y * 0.05) * 3, y + w * 0.4, w * (0.62 - y / len * 0.2) * (0.85 + r() * 0.3), seed + Math.round(y), { sweep: 4.4 }); }
  else for (let k = 0; k < n; k++) {
    const f = n > 1 ? (k / (n - 1)) * 2 - 1 : 0, ph = r() * 6.28, amp = w * 0.8 * (o.curl ?? 1), sp = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; sp.push([f * w * 0.42 + Math.sin(u * (o.freq ?? 1.3) * 6.28 + ph) * amp * (0.15 + u * 0.85) + sm((u - 0.72) / 0.28) * w * 0.7 * (o.out ?? 1), u * len * (0.92 + r() * 0.08)]); }
    chunk(t, sp, (u) => w * 0.66 * (1 - u * 0.2) * Math.min(1, 0.5 + u * 4), { seed: seed * 10 + k, band: [0.18, 0.48, 0.78], bandW: 0.012, tip: 0.72, tipStart: 0.84, shadow: 0.45, strands: 8, tone: 0.2 + k * 0.25 });
  }
  t.height = { dome: 22, str: 0.8, aoR: 6, ao: 3 };
  return t;
}
function ponyTex(len, w, seed, o = {}) {
  const t = tex(-w * 2.2, -12, w * 2.2, len + 30, 2), g = t.g, r = rng(seed);
  for (let k = 0; k < 4; k++) {
    const f = k / 3 * 2 - 1, ph = r() * 6.28, sp = [];
    for (let i = 0; i <= 7; i++) { const u = i / 7; sp.push([f * w * 0.35 * Math.sin(Math.PI * Math.min(1, u * 1.3)) + Math.sin(u * 7 + ph) * w * 0.25 * (o.curl ?? 0.7) * u, 2 + u * len * (0.88 + r() * 0.12)]); }
    chunk(t, sp, (u) => w * 0.5 * Math.sin(Math.PI * Math.min(1, 0.16 + u * 0.92)) + 3, { seed: seed * 7 + k, band: [0.2, 0.55], tip: 0.95, shadow: 0.45, strands: 9, tone: 0.2 + k * 0.15 });
  }
  g.save(); g.fillStyle = '#16141a'; g.beginPath(); g.ellipse(0, 4, w * 0.32, 6, 0, 0, 7); g.fill(); g.strokeStyle = rgba('#6a6a76', 0.6); g.lineWidth = 1; g.stroke(); g.restore();
  t.height = { dome: 24, str: 0.8, aoR: 6, ao: 3 };
  return t;
}
function braidTex(len, w, seed) {
  const t = tex(-w * 1.8, -8, w * 1.8, len + 50, 2.2), g = t.g, r = rng(seed);
  const n = Math.floor(len * 0.85 / (w * 0.55));
  for (let i = 0; i < n; i++) {
    const y = i * len * 0.85 / n, s = i % 2 ? 1 : -1, ww = w * (1 - i / n * 0.4), h = len * 0.85 / n * 1.7;
    chunk(t, [[s * ww * 0.5, y], [s * ww * 0.12, y + h * 0.45], [-s * ww * 0.32, y + h * 1.1]], (u) => ww * 0.44 * Math.sin(Math.PI * (0.16 + u * 0.72)) + 2, { seed: seed + i * 3, band: [0.4], bandW: 0.05, tip: 0.6, shadow: 0.6, strands: 4 });
  }
  const yt = len * 0.85;
  g.save(); g.fillStyle = '#16141a'; g.fillRect(-w * 0.26, yt - 2, w * 0.52, 6); g.restore();
  for (let k = 0; k < 3; k++) chunk(t, [[(k - 1) * 3, yt + 2], [(k - 1) * 6, yt + 22], [(k - 1) * 9 + (r() - 0.5) * 4, yt + 40]], (u) => 6 * (1 - u * 0.3), { seed: seed + 90 + k, tip: 0.95, strands: 3 });
  t.height = { dome: 18, str: 0.9, aoR: 5, ao: 3 };
  return t;
}
function bunTex(cx, cy, R, seed, o = {}) {
  const t = tex(cx - R * 1.7, cy - R * 1.7, cx + R * 1.7, cy + R * 1.5, 2.2), r = rng(seed);
  const disc = P(p => p.ellipse(cx, cy, R, R * 0.86, 0, 0, 7));
  mass(t, disc, '#08070b', 1.5);
  for (let k = 0; k < (o.messy ? 9 : 7); k++) {
    const a0 = k / 7 * 6.28 + r() * 0.4, rr = R * (0.45 + 0.45 * r()), sweep = 2 + r() * 1.4, sp = [];
    for (let i = 0; i <= 6; i++) { const a = a0 + sweep * i / 6, q = rr * (1 - i / 12); sp.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.86]); }
    chunk(t, sp, (u) => R * 0.26 * (1 - u * 0.3), { seed: seed + k * 3, band: [0.3, 0.7], tip: 0.8, shadow: 0.55, strands: 4 });
  }
  if (o.messy) for (let k = 0; k < 4; k++) { const a = -2.4 + k * 0.6; chunk(t, [[cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.5], [cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 0.9], [cx + Math.cos(a + 0.4) * R * 1.35, cy + Math.sin(a + 0.4) * R * 1.1]], (u) => R * 0.12, { seed: seed + 50 + k, tip: 0.95, strands: 2 }); }
  halo(t, disc, cx - R * 0.25, cy - R * 0.3, R * 0.9, R * 0.6, 0.25);
  t.height = { dome: 22, str: 0.9, aoR: 5, ao: 3 };
  return t;
}
function puffTex(cx, cy, R, seed) {
  const t = tex(cx - R * 1.5, cy - R * 1.5, cx + R * 1.5, cy + R * 1.5, 2.2);
  const disc = P(p => p.ellipse(cx, cy, R, R * 0.9, 0, 0, 7));
  curlMass(t, disc, { n: 44, R: R * 0.26, seed, cy, bounds: [cx - R, cy - R, cx + R, cy + R] });
  t.height = { dome: 22, str: 0.9, aoR: 5, ao: 3 };
  return t;
}

// ---------------------------------------------------------------- men's barber & era cuts (head space)
// skull silhouette with the face opening built in (top = crown height, sideW = half width, sideB = how low the sides go)
function skullShape(top, sideW = 116, sideB = -4, hl = -100) {
  return P(p => { p.moveTo(0, top); p.bezierCurveTo(sideW * 0.62, top, sideW + 6, (top - 30) * 0.6, sideW, -36); p.bezierCurveTo(sideW, -6, sideW - 6, sideB - 8, sideW - 14, sideB);
    p.lineTo(sideW - 24, sideB); p.bezierCurveTo(sideW - 26, -40, sideW - 40, -80, 66, hl + 4); p.bezierCurveTo(40, hl - 10, -40, hl - 10, -66, hl + 4);
    p.bezierCurveTo(-sideW + 40, -80, -sideW + 26, -40, -sideW + 24, sideB); p.lineTo(-sideW + 14, sideB);
    p.bezierCurveTo(-sideW + 6, sideB - 8, -sideW, -6, -sideW, -36); p.bezierCurveTo(-sideW - 6, (top - 30) * 0.6, -sideW * 0.62, top, 0, top); p.closePath(); });
}
// clipper-cut sides: short bristles, densest high up and fading toward the ear (skin fade when fadeTo ~ 0)
function fadeSides(t, top, o = {}) {
  const sideW = o.sideW ?? 108, y0 = o.from ?? -96, y1 = o.to ?? 4, g = t.g;
  const sides = P(p => { for (const s of [-1, 1]) p.rect(s > 0 ? (o.inner ?? 60) : -sideW - 20, y0 - 60, sideW + 20 - (o.inner ?? 60), y1 - y0 + 60); });
  g.save(); g.clip(skullShape(top, sideW, y1));
  furField(t, sides, (x) => Math.PI / 2 + Math.sign(x) * 0.35, { n: o.n ?? 16000, len: o.len ?? 1.5, w: 0.5, soft: 3, under: rgba('#28232a', o.shade ?? 0.6), alpha: 0.85, hiShare: 0.25, seed: o.seed || 31,
    densY: (y) => (o.fadeTo ?? 0.6) + (1 - (o.fadeTo ?? 0.6)) * (1 - sm((y - y0) / (y1 - y0))) });
  g.restore();
}
// a spike: a wide clump tapering to a sharp tip; tipLight paints a clearly bleached (frosted) end over the outer half
function spike(t, root, tip, w, seed, o = {}) {
  const mid = [lerp(root[0], tip[0], 0.55) + (o.bend ?? 0), lerp(root[1], tip[1], 0.55)];
  chunk(t, [root, mid, tip], (u) => w * (1 - u * 0.45), { seed, tip: 1, tipStart: 0.35, band: [0.4], bandW: 0.05, sheen: o.sheen ?? 0.9, shadow: 0.55, strands: 4, tone: 0.2 });
  if (o.tipLight) {   // bleached ends: painted near white (no dark shading inside) so any hair recolour clips them to pale, not tinted
    const g = t.g, pts = sampleCurve([[lerp(root[0], tip[0], 0.42), lerp(root[1], tip[1], 0.42)], [lerp(mid[0], tip[0], 0.5), lerp(mid[1], tip[1], 0.5)], tip], 20), nr = normals(pts);
    const W = (u) => w * 0.5 * (1 - u) * Math.min(1, 0.35 + u * 4), path = new Path2D();
    pts.forEach((q, i) => { const ww = W(i / 19); i ? path.lineTo(q[0] + nr[i][0] * ww, q[1] + nr[i][1] * ww) : path.moveTo(q[0] + nr[i][0] * ww, q[1] + nr[i][1] * ww); });
    for (let i = 19; i >= 0; i--) { const q = pts[i], ww = W(i / 19); path.lineTo(q[0] - nr[i][0] * ww, q[1] - nr[i][1] * ww); }
    path.closePath();
    g.save(); g.filter = blurOf(t, 0.8); g.fillStyle = '#fff8ea'; g.fill(path); g.restore();
    g.save(); g.clip(path); g.filter = blurOf(t, 1.2); g.strokeStyle = rgba('#ffffff', 0.9); g.lineWidth = w * 0.18; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0] - nr[i][0] * W(i / 19) * 0.3, q[1] - nr[i][1] * W(i / 19) * 0.3) : g.moveTo(q[0], q[1])); g.stroke(); g.restore();
  }
}
// a rope (loc / twist): a thick matte cylinder with soft segment bumps along it
function rope(t, spine, w, seed, o = {}) {
  const out = chunk(t, spine, (u) => w * (1 - u * (o.taper ?? 0.15)), { seed, tip: 0.55, tipStart: 0.88, band: [0.3, 0.7], bandW: 0.08, sheen: 0.55, shadow: 0.6, strands: 0, tone: 0.2 + (seed % 5) * 0.06 });
  const g = t.g, N = 60, pts = sampleCurve(spine, N), nr = normals(pts);
  let len = 0; for (let i = 1; i < N; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const every = Math.max(2, Math.round((N - 1) * w * (o.seg ?? 1.25) / len));
  g.save(); g.clip(out); g.filter = blurOf(t, w * 0.18); g.lineCap = 'round';
  for (let i = every; i < N - 2; i += every) { const q = pts[i], n = nr[i], ww = w * 1.05, d = [-n[1], n[0]];
    g.beginPath(); g.moveTo(q[0] - n[0] * ww, q[1] - n[1] * ww); g.quadraticCurveTo(q[0] + d[0] * w * 0.35, q[1] + d[1] * w * 0.35, q[0] + n[0] * ww, q[1] + n[1] * ww);
    g.strokeStyle = rgba('#000000', 0.5); g.lineWidth = w * 0.22; g.stroke(); }
  g.restore();
}
function menCap(style, seed = 900) {
  const g0 = { pomp50: -228, mop: -170, feather: -184, curtains: -178, frosted: -206, crew: -156, flattop: -196, fauxhawk: -214, frenchcrop: -166, mohawk: -244, locs: -170, cornrows: -164, twists: -186, emo: -184, bowl: -168, hightop: -186 };
  const top = g0[style], t = tex(-175, Math.min(-240, top - 30), 175, 120, 2.2), g = t.g, r = rng(seed);
  const done = (dome = 24) => { t.height = { dome, str: 0.8, aoR: 6, ao: 3 }; return t; };
  const feather = (hl = -100, n = 50) => featherHairline(t, forehead(hl), { seed: seed + 3, n, ry: -hl - 24 });
  if (style === 'mop' || style === 'bowl') return bobCap({ side: style === 'mop' ? 30 : -16, seed, fringe: 'blunt' });
  if (style === 'pomp50') {          // 50s: a tall, rounded, glossy roll over the forehead (symmetric, no lean); sides combed back flat
    const shape = skullShape(-150, 116, -6); mass(t, shape, '#08070b', 1.5);
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const f = k / 4; chunk(t, [[s * (66 + f * 16), -92 + f * 40], [s * (98 + f * 8), -112 + f * 30], [s * (112 + f * 2), -136 + f * 30], [s * (90 - f * 10), -160 + f * 14]], (u) => 14, { seed: seed + k + (s > 0 ? 9 : 0), root: true, band: [0.5], bandW: 0.06, sheen: s < 0 ? 1 : 0.7, tip: 0.6, strands: 8 }); }
    const roll = P(p => p.ellipse(0, -164, 90, 66, 0, 0, 7)); mass(t, roll, '#09080c', 1.5);
    for (const k of [0, 10, 1, 9, 2, 8, 3, 7, 4, 6, 5]) { const f = k / 10 * 2 - 1, af = Math.abs(f);   // up off the hairline, arching over the roll and back
      chunk(t, [[f * 72, -98 + af * 8], [f * 88, -150 + af * 8], [f * 66, top + 22 + af * 30], [f * 26, top + 4 + af * 22], [f * 4, top + 28]], (u) => 15 * (1 - u * 0.25),
        { seed: seed + 40 + k, root: true, band: [0.42, 0.62], bandW: 0.03, sheen: f < 0.2 ? 1.2 : 0.8, tip: 0.6, strands: 9 }); }
    halo(t, roll, -16, -190, 70, 42, 0.35, -0.2); feather(-100, 30); return done(30);
  }
  if (style === 'feather') {          // 70s: centre part, feathered wings swept back over the ears, collar length
    const shape = skullShape(top, 128, 30); mass(t, shape, '#08070b', 1.5);
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const f = k / 6;
      chunk(t, [[s * 2, top + 16], [s * (40 + f * 30), top + 20 + f * 20], [s * (94 + f * 16), -98 + f * 22], [s * (120 + f * 8), -52 + f * 30], [s * (124 + f * 8) + s * r() * 8, 24 + r() * 14]], (u) => 16 * (1 - u * 0.15), { seed: seed + k + (s > 0 ? 20 : 0), band: [0.25, 0.6], sheen: s < 0 ? 1 : 0.7, tip: 0.85 }); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const f = k / 2;   // the feathered wings from the temples, flicked back
      chunk(t, [[s * (62 + f * 6), -98 + f * 10], [s * (90 + f * 6), -112 + f * 12], [s * (118 + f * 6), -96 + f * 16], [s * (134 + f * 4), -60 + f * 24]], (u) => 13 * (1 - u * 0.3), { seed: seed + 60 + k + (s > 0 ? 5 : 0), band: [0.4], sheen: s < 0 ? 1.2 : 0.8, tip: 0.9 }); }
    halo(t, shape, -14, top + 50, 110, 46, 0.3, -0.12); feather(-104, 50); return done(28);
  }
  if (style === 'curtains') {         // 90s: centre part, two curtains falling to the cheekbones, short sides
    const shape = skullShape(top, 118, -4); mass(t, shape, '#08070b', 1.5);
    fadeSides(t, top, { sideW: 116, from: -90, to: -4, fadeTo: 0.7, seed: seed + 2 });
    for (const s of [-1, 1]) for (let k = 0; k < 8; k++) { const f = k / 7;
      chunk(t, [[s * 2, top + 18], [s * (28 + f * 34), top + 26 + f * 14], [s * (52 + f * 34), -102 + f * 20], [s * (70 + f * 30), -56 + f * 22], [s * (78 + f * 30), -24 + f * 22]], (u) => 14 * (1 - u * 0.2), { seed: seed + k + (s > 0 ? 30 : 0), band: [0.3, 0.65], sheen: s < 0 ? 1.05 : 0.7, tip: 0.85 }); }
    halo(t, shape, -14, top + 50, 100, 44, 0.28, -0.12); return done();
  }
  if (style === 'frosted' || style === 'fauxhawk' || style === 'mohawk') {
    const sideW = style === 'frosted' ? 112 : 106, shape = skullShape(style === 'frosted' ? -168 : -146, sideW, -4);
    if (style === 'frosted') mass(t, shape, '#08070b', 1.5);
    else fadeSides(t, -146, { sideW, from: -150, to: -4, fadeTo: style === 'mohawk' ? 0.12 : 0.5, n: style === 'mohawk' ? 9000 : 18000, inner: 0, seed: seed + 2 });
    const spikes = [];   // [root, tip, width]
    if (style === 'frosted') {
      for (let k = 0; k < 9; k++) { const a = -Math.PI * (0.08 + 0.84 * k / 8) + (r() - 0.5) * 0.12; spikes.push([[Math.cos(a) * sideW * 0.62, -64 + Math.sin(a) * 60], [Math.cos(a) * sideW * (1.12 + r() * 0.1), -70 + Math.sin(a) * (-top - 70) * (0.98 + r() * 0.1)], 20]); }
      for (let k = 0; k < 5; k++) { const x = (k / 4 - 0.5) * 120; spikes.push([[x * 0.7, -116], [x * 1.05 + (r() - 0.5) * 14, top + r() * 14], 20]); }
    } else if (style === 'fauxhawk') for (const k of [0, 6, 1, 5, 2, 4, 3]) { const f = k / 6 * 2 - 1, af = Math.abs(f);   // a ridge of separate spikes leaning in to the centre
      spikes.push([[f * 62, -104 - (1 - af) * 30], [f * 36 + (r() - 0.5) * 6, top + af * 44 + r() * 8], 21]); }
    else for (const k of [0, 6, 1, 5, 2, 4, 3]) { const f = k / 6 * 2 - 1, af = Math.abs(f);   // mohawk: a narrow strip of tall spikes fanning out
      spikes.push([[f * 28, -112 - (1 - af) * 26], [f * 82 + (r() - 0.5) * 8, top + 16 + af * 70 + r() * 8], 22]); }
    if (style === 'mohawk') { const strip = P(p => p.roundRect(-34, -168, 68, 80, 26)); mass(t, strip, '#09080c', 1.5); }
    spikes.forEach(([a, b, w], k) => spike(t, a, b, w, seed + 100 + k, { tipLight: style === 'frosted', bend: (r() - 0.5) * 10, sheen: b[0] < 0 ? 1.1 : 0.8 }));
    if (style === 'frosted') feather(-100, 30); return done(26);
  }
  if (style === 'crew' || style === 'frenchcrop' || style === 'flattop') {
    const sideW = 108;
    if (style === 'flattop') {        // a brushed-up block: faded sides, slightly crowned top with soft rounded corners, bristles standing up
      const box = P(p => { p.moveTo(-96, -96); p.bezierCurveTo(-102, -130, -104, -170, -100, top + 30); p.bezierCurveTo(-100, top + 6, -92, top, -66, top); p.quadraticCurveTo(0, top - 7, 66, top);
        p.bezierCurveTo(92, top, 100, top + 6, 100, top + 30); p.bezierCurveTo(104, -170, 102, -130, 96, -96); p.bezierCurveTo(50, -108, -50, -108, -96, -96); p.closePath(); });
      fadeSides(t, -150, { sideW, from: -110, to: -4, fadeTo: 0.45, seed: seed + 2 });
      g.save(); g.filter = blurOf(t, 1.8); g.fillStyle = rgba('#100e12', 0.95); g.fill(box); g.restore();
      furField(t, box, () => -Math.PI / 2, { n: 30000, len: 5, w: 0.55, soft: 1.5, alpha: 0.7, hiShare: 0.45, hi: '#6e6a74', seed: seed + 4, cols: ['#0b0a0d', '#1e1c21', '#34313a'] });
      g.save(); g.clip(box);
      const gr = g.createLinearGradient(0, top, 0, top + 40); gr.addColorStop(0, rgba('#8a8690', 0.65)); gr.addColorStop(0.5, rgba('#4a4750', 0.25)); gr.addColorStop(1, rgba('#000000', 0)); g.fillStyle = gr; g.fillRect(-110, top - 10, 220, 60);
      const sd = g.createLinearGradient(-100, 0, 100, 0); sd.addColorStop(0, rgba('#5a5760', 0.4)); sd.addColorStop(0.3, rgba('#000000', 0)); sd.addColorStop(0.75, rgba('#000000', 0)); sd.addColorStop(1, rgba('#000000', 0.5)); g.fillStyle = sd; g.fillRect(-110, top - 10, 220, 130);
      const bt = g.createLinearGradient(0, -130, 0, -96); bt.addColorStop(0, rgba('#000000', 0)); bt.addColorStop(1, rgba('#000000', 0.45)); g.fillStyle = bt; g.fillRect(-110, -130, 220, 40);
      g.restore();
      const r2 = rng(seed + 9);   // bristle tips breaking the top edge
      for (let i = 0; i < 240; i++) { const x = -88 + r2() * 176, y = top + 1 - Math.cos(x / 100 * 1.4) * 4 + r2() * 3;
        g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + (r2() - 0.5) * 2, y - 2 - r2() * 4); g.strokeStyle = rgba(r2() < 0.5 ? '#1a181d' : '#5e5a66', 0.7); g.lineWidth = 0.8; g.stroke(); }
      return done(20);
    }
    const shape = skullShape(top, sideW, -4);
    fadeSides(t, top, { sideW, from: style === 'frenchcrop' ? -110 : -100, to: -4, fadeTo: style === 'frenchcrop' ? 0 : 0.5, n: 20000, seed: seed + 2 });
    const topArea = P(p => p.ellipse(0, -112, 92, top < -160 ? 58 : 44, 0, 0, 7));
    mass(t, topArea, '#09080c', 2);
    if (style === 'crew') {
      furField(t, topArea, (x, y) => -Math.PI / 2 + x * 0.004, { n: 14000, len: 4, w: 0.55, soft: 3, alpha: 0.8, hiShare: 0.35, seed: seed + 4, cols: ['#0b0a0d', '#1a181c', '#2a272d'] });
      for (let k = 0; k < 9; k++) { const f = k / 8 * 2 - 1; chunk(t, [[f * 60, -100], [f * 62 + 2, -122], [f * 60 + 4, -136 - r() * 6]], (u) => 9, { seed: seed + 50 + k, tip: 0.9, band: [0.4], strands: 2 }); }
    } else {                          // French crop: short textured top pushed forward to a blunt, straight fringe
      for (let k = 0; k < 16; k++) { const f = k / 15 * 2 - 1, j = (r() - 0.5) * 10;
        chunk(t, [[f * 50 + j, top + 18 + r() * 10], [f * 64 + j, -132], [f * 74, -110], [f * 76, -98 + r() * 3]], (u) => 11 + r() * 4, { seed: seed + 50 + k, tip: 0.3, tipStart: 0.85, band: [0.35], sheen: f < 0 ? 1 : 0.7, strands: 4 }); }

    }
    halo(t, topArea, -14, -130, 90, 40, 0.28, -0.1); return done(20);
  }
  if (style === 'locs' || style === 'twists') {
    const shape = skullShape(style === 'locs' ? -158 : -140, 112, -4); mass(t, shape, '#0a090c', 1.5);
    if (style === 'locs') {           // rope-thick locs from a parted crown, over the top and down past the ears
      for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const f = k / 4;
        rope(t, [[s * (6 + f * 30), -160 + f * 8], [s * (48 + f * 40), -150 + f * 24], [s * (96 + f * 16), -100 + f * 34], [s * (114 + f * 10) + (r() - 0.5) * 6, -20 + f * 30], [s * (118 + f * 12) + (r() - 0.5) * 10, 80 + r() * 40]], 14 + r() * 2, seed + k * 7 + (s > 0 ? 50 : 0)); }
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++)   // two falling forward over the temples
        rope(t, [[s * (14 + k * 14), -158], [s * (40 + k * 18), -134], [s * (70 + k * 14), -96], [s * (86 + k * 10), -40], [s * (92 + k * 8), 30 + r() * 20]], 14, seed + 300 + k + (s > 0 ? 9 : 0));
    } else {                          // two-strand twists standing out all over the top
      const pts = []; for (let k = 0; k < 46; k++) { const a = -Math.PI * (0.06 + 0.88 * r()), R = 0.5 + r() * 0.45; pts.push([Math.cos(a) * 100 * R, -66 + Math.sin(a) * 84 * R, a]); }
      pts.sort((a, b) => a[1] - b[1]).forEach(([x, y, a], k) => { const L = 34 + r() * 16; rope(t, [[x, y], [x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * L * 0.5], [x + Math.cos(a) * L, y + Math.sin(a) * L]], 6 + r() * 2, seed + k * 5, { seg: 1, taper: 0.4 }); });
    }
    feather(-100, 20); return done(28);
  }
  if (style === 'cornrows') {         // braided rows from the hairline back over the skull, scalp partings between them
    const shape = skullShape(top, 106, -6), braid = (pts, w, sd) => {
      g.save(); g.filter = blurOf(t, 1.5); g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = w * 2.3; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0] + 1, q[1] + 2) : g.moveTo(q[0] + 1, q[1] + 2)); g.stroke(); g.restore();
      const S = sampleCurve(pts, 40), nr = normals(S);
      for (let i = 0; i < 39; i += 3) { const q = S[i], q2 = S[Math.min(39, i + 4)], n = nr[i], side = (i / 3) % 2 ? 1 : -1;   // alternating stitches: the V pattern of a braid
        chunk(t, [[q[0] + n[0] * w * 0.8 * side, q[1] + n[1] * w * 0.8 * side], [lerp(q[0], q2[0], 0.5), lerp(q[1], q2[1], 0.5)], [q2[0] - n[0] * w * 0.5 * side, q2[1] - n[1] * w * 0.5 * side]],
          (u) => w * 0.62 * Math.sin(Math.PI * (0.12 + u * 0.76)) + 0.6, { seed: sd + i, tip: 0.4, band: [0.4], bandW: 0.06, sheen: 0.9, shadow: 0.4, strands: 1 }); }
    };
    g.save(); g.clip(shape);
    for (let row = 0; row < 8; row++) { const f = row / 7 * 2 - 1, x0 = f * 86;   // over the top: up from the hairline, converging toward the crown
      braid([[x0, -98 + Math.abs(f) * 16], [x0 * 0.94, -124], [x0 * 0.74, top + 12], [x0 * 0.5, top - 6]], 9.5, seed + row * 50); }
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++)   // around the sides above the ears
      braid([[s * (100 - k * 2), -50 + k * 30], [s * (104 - k * 4), -90 + k * 24], [s * (98 - k * 6), -130 + k * 14], [s * (90 - k * 8), top + 6 + k * 8]], 8, seed + 600 + k + (s > 0 ? 30 : 0));
    g.restore(); return done(16);
  }
  if (style === 'emo') {              // heavy side-swept fringe across the forehead over one eye, choppy layers
    const shape = skullShape(top, 120, 6); mass(t, shape, '#08070b', 1.5);
    for (let k = 0; k < 9; k++) { const f = k / 8; chunk(t, [[30 + f * 30, top + 16], [90 + f * 20, top + 40 + f * 20], [114, -60 + f * 30], [112 - f * 6, -6 + f * 10]], (u) => 14, { seed: seed + k, band: [0.3], sheen: 0.7, tip: 0.95 }); }
    for (let k = 0; k < 6; k++) { const f = k / 5; chunk(t, [[-10 - f * 20, top + 18], [-70 - f * 20, top + 40 + f * 10], [-114, -70 + f * 30], [-110 + f * 4, -10 + f * 10]], (u) => 13, { seed: seed + 20 + k, band: [0.3], sheen: 1, tip: 0.95 }); }
    for (let k = 0; k < 11; k++) { const f = k / 10;   // the fringe: from the crown on the right, across the forehead, down past the left eye
      chunk(t, [[40 + f * 30, top + 24], [10 - f * 20, -136 + f * 10], [-40 - f * 30, -96 + f * 30], [-62 - f * 30, -40 + f * 36], [-60 - f * 34, 6 + f * 24 + r() * 10]], (u) => 13 * (1 - u * 0.25), { seed: seed + 40 + k, band: [0.25, 0.55], sheen: 1.1, tip: 0.95, shadow: 0.6 }); }
    halo(t, shape, -20, top + 50, 110, 46, 0.3, -0.12); return done(26);
  }
  if (style === 'hightop') {          // high-top fade: a flat-topped cylinder of tight coils (about 0.6x head height) on faded sides
    fadeSides(t, -150, { sideW: 106, from: -110, to: -4, fadeTo: 0.2, seed: seed + 2 });
    const box = P(p => { p.moveTo(-90, -96); p.bezierCurveTo(-94, -130, -96, -160, -94, top + 14); p.quadraticCurveTo(-92, top, -70, top); p.lineTo(70, top); p.quadraticCurveTo(92, top, 94, top + 14);
      p.bezierCurveTo(96, -160, 94, -130, 90, -96); p.bezierCurveTo(44, -108, -44, -108, -90, -96); p.closePath(); });
    mass(t, box, '#0c0b0e', 1);
    furField(t, box, (x, y) => (x * 7.3 + y * 3.1) % 6.28, { n: 30000, len: 3.5, curl: 2.4, jitter: 6.28, w: 1, soft: 1, alpha: 0.85, hiShare: 0.4, hi: '#5e5a66', seed: seed + 4, cols: ['#050406', '#18161b', '#26242a'] });
    g.save(); g.clip(box);   // cylinder shading: lit left, dark right, a lit flat top, darker under the top edge
    const sd = g.createLinearGradient(-94, 0, 94, 0); sd.addColorStop(0, rgba('#000000', 0.35)); sd.addColorStop(0.2, rgba('#5a5662', 0.3)); sd.addColorStop(0.45, rgba('#000000', 0)); sd.addColorStop(0.8, rgba('#000000', 0.35)); sd.addColorStop(1, rgba('#000000', 0.7));
    g.fillStyle = sd; g.fillRect(-100, top - 4, 200, 190);
    const tp = g.createLinearGradient(0, top, 0, top + 30); tp.addColorStop(0, rgba('#7a7682', 0.55)); tp.addColorStop(0.4, rgba('#3e3c44', 0.25)); tp.addColorStop(1, rgba('#000000', 0)); g.fillStyle = tp; g.fillRect(-100, top - 4, 200, 40);
    g.restore(); return done(30);
  }
  return done();
}
// loc lock (spring chain): one thick rope
function locLock(len, w, seed) {
  const t = tex(-w * 2, -8, w * 2, len + 30, 2), r = rng(seed), sp = [];
  for (let i = 0; i <= 6; i++) { const u = i / 6; sp.push([Math.sin(u * 4 + 1) * 4, u * len * (0.92 + r() * 0.08)]); }
  rope(t, sp, w * 0.5, seed, { taper: 0.2 });
  t.height = { dome: 18, str: 0.9, aoR: 5, ao: 3 }; return t;
}
// locs hanging behind the body: a dozen thick ropes
function backLocs(len, seed) {
  const t = tex(-260, -180, 260, len + 70, 1.4), r = rng(seed);
  mass(t, P(p => p.ellipse(0, len * 0.2, 140, len * 0.5, 0, 0, 7)), '#050407', 8);
  for (const k of [0, 11, 1, 10, 2, 9, 3, 8, 4, 7, 5, 6]) { const f = k / 11 * 2 - 1, x0 = f * 118; rope(t, [[x0 * 0.6, -130 + Math.abs(f) * 30], [x0, 0], [x0 * 1.08 + (r() - 0.5) * 16, len * 0.5], [x0 * 1.12 + (r() - 0.5) * 20, len * (0.85 + r() * 0.15)]], 17 + r() * 3, seed + k * 11); }
  t.height = { dome: 24, str: 0.9, aoR: 6, ao: 3 }; return t;
}

// ---------------------------------------------------------------- facial hair (face space)
const FACE_BOX = [-135, -150, 135, 250];
// hair grows down the jaw, curving toward the chin; on the upper cheek it angles down-forward
const beardDir = (x, y) => Math.PI / 2 - x * 0.007 + (y < 50 ? x * 0.003 : 0);
// neutral greys only (a blue cast turns silver/white beards into a smudge)
const BEARD = { core: '#09080a', body: '#1a181b', edge: '#36333a', tip: '#625e66', hi: '#76727a' };
// outer outline of a beard: sideburns from the temple (joining the scalp hair) down the jaw, under the chin (+drop)
function jawOuter(p, drop) {
  p.moveTo(-103, -44); p.bezierCurveTo(-106, 0, -105, 30, -98, 54); p.bezierCurveTo(-88, 82, -64, 104 + drop * 0.4, -40, 116 + drop * 0.8);
  p.bezierCurveTo(-22, 124 + drop, 22, 124 + drop, 40, 116 + drop * 0.8); p.bezierCurveTo(64, 104 + drop * 0.4, 88, 82, 98, 54); p.bezierCurveTo(105, 30, 106, 0, 103, -44);
}
// full beard region: the upper edge is a short cheek line from the sideburn down to the nose base, then
// across the upper lip, so the beard wraps the mouth (lips and mustache draw on top) with no bald ring
function beardRegion(drop = 0, o = {}) {
  const cheekY = o.cheekY ?? 46, sbw = o.sideburn ?? 13;
  return P(p => {
    jawOuter(p, drop);
    p.lineTo(103 - sbw, -44); p.bezierCurveTo(100 - sbw, -10, 96 - sbw, cheekY - 14, 84 - sbw * 0.3, cheekY);
    p.bezierCurveTo(68, cheekY + 6, 50, 50, 36, 52); p.bezierCurveTo(22, 47, 8, 45, 0, 47);
    p.bezierCurveTo(-8, 45, -22, 47, -36, 52); p.bezierCurveTo(-50, 50, -68, cheekY + 6, -84 + sbw * 0.3, cheekY);
    p.bezierCurveTo(-96 + sbw, cheekY - 14, -100 + sbw, -10, -103 + sbw, -44); p.closePath();
  });
}
// stubble zones: a band along the jaw and chin (cheeks left clear) + the mustache zone over the upper lip
function stubbleZones(o = {}) {
  const band = o.band ?? 30;
  return P(p => {
    jawOuter(p, 2);
    p.lineTo(98, -44); p.bezierCurveTo(98, 10, 94, 40, 86, 56); p.bezierCurveTo(74, 80 - band * 0.4, 50, 96 - band * 0.6, 0, 100 - band * 0.5);
    p.bezierCurveTo(-50, 96 - band * 0.6, -74, 80 - band * 0.4, -86, 56); p.bezierCurveTo(-94, 40, -98, 10, -98, -44); p.closePath();
    // chin / under the lower lip
    p.moveTo(-30, 84); p.bezierCurveTo(-34, 98, -16, 108, 0, 108); p.bezierCurveTo(16, 108, 34, 98, 30, 84); p.bezierCurveTo(16, 88, -16, 88, -30, 84); p.closePath();
    // mustache zone
    p.moveTo(-34, 56); p.bezierCurveTo(-30, 46, -10, 44, 0, 47); p.bezierCurveTo(10, 44, 30, 46, 34, 56); p.bezierCurveTo(20, 54, -20, 54, -34, 56); p.closePath();
  });
}
function beardTex(kind, seed = 801) {
  const t = tex(...FACE_BOX, 2), g = t.g;
  const faceClip = P(p => { p.moveTo(-106, -60); p.bezierCurveTo(-108, 0, -104, 26, -95, 50); p.bezierCurveTo(-84, 74, -60, 92, -37, 104); p.bezierCurveTo(-24, 110, -11, 114, 0, 115);
    p.bezierCurveTo(11, 114, 24, 110, 37, 104); p.bezierCurveTo(60, 92, 84, 74, 95, 50); p.bezierCurveTo(104, 26, 108, 0, 106, -60); p.closePath(); });
  const chin = (w, top, bot) => P(p => { p.moveTo(-w, top); p.bezierCurveTo(-w - 4, (top + bot) / 2, -w * 0.6, bot, 0, bot); p.bezierCurveTo(w * 0.6, bot, w + 4, (top + bot) / 2, w, top); p.bezierCurveTo(w * 0.4, top - 6, -w * 0.4, top - 6, -w, top); p.closePath(); });
  // stubble: a dark cool stipple only inside the zones (no tint over the skin between)
  const stubble = (dens, len, alpha) => { g.save(); g.clip(faceClip);
    const cool = ['#18243a', '#1e2a40', '#141e32'], dense = P(p => { p.addPath(beardRegion(4, { cheekY: 70, sideburn: 8 })); });
    furField(t, stubbleZones(), beardDir, { n: dens * 0.5, len, w: 0.4, soft: 6, alpha: alpha * 0.65, hiShare: 0, seed, falloff: 2.2, cols: cool });      // sparse, fading upward
    furField(t, dense, beardDir, { n: dens * 0.7, len, w: 0.42, soft: 3, alpha, hiShare: 0, seed: seed + 1, falloff: 1.4, cols: cool });                     // jaw, chin and mustache
    g.restore(); };
  // beards: shaped volume. Core darkest under the jaw, lighter body, light tips along every edge
  // (soft fur breaking the outline), a short feathered top edge on the cheek, clumped tufts flowing down
  const beard = (mask, dens, len, o = {}) => furVolume(t, mask, beardDir, { n: dens, len, tufts: o.tufts, fill: o.fill, rim: o.rim, span: [o.y0 ?? -20, 122 + (o.drop || 0)], seed, cols: BEARD });
  if (kind === 'stubbleLight') stubble(12000, 0.7, 0.38);
  else if (kind === 'stubbleHeavy') stubble(30000, 0.9, 0.5);
  else if (kind === 'boxed') beard(beardRegion(6, { cheekY: 50, sideburn: 13 }), 11000, 3.2, { tufts: 22 });
  else if (kind === 'full') beard(beardRegion(26, { cheekY: 46, sideburn: 15 }), 14000, 4.5, { drop: 26, tufts: 30 });
  else if (kind === 'long') beard(beardRegion(110, { cheekY: 44, sideburn: 15 }), 18000, 6, { drop: 110, tufts: 44 });
  else if (kind === 'goatee') beard(P(p => { p.moveTo(-31, 82); p.bezierCurveTo(-37, 104, -22, 130, 0, 134); p.bezierCurveTo(22, 130, 37, 104, 31, 82); p.bezierCurveTo(14, 88, -14, 88, -31, 82); p.closePath(); }), 4500, 3.5, { tufts: 10, y0: 80 });
  else if (kind === 'vandyke') beard(P(p => { p.moveTo(-22, 84); p.bezierCurveTo(-26, 108, -12, 138, 0, 146); p.bezierCurveTo(12, 138, 26, 108, 22, 84); p.bezierCurveTo(10, 90, -10, 90, -22, 84); p.closePath(); }), 3600, 3.5, { tufts: 8, y0: 84 });
  else if (kind === 'chinstrap') beard(P(p => {   // a soft band along the jaw: ~22 wide under the chin, thinning to ~8 at the sideburns
    p.moveTo(-104, -40); p.bezierCurveTo(-107, 10, -103, 46, -95, 62); p.bezierCurveTo(-80, 94, -48, 118, 0, 124); p.bezierCurveTo(48, 118, 80, 94, 95, 62); p.bezierCurveTo(103, 46, 107, 10, 104, -40);
    p.lineTo(96, -40); p.bezierCurveTo(96, 6, 92, 34, 82, 50); p.bezierCurveTo(68, 74, 38, 96, 0, 101); p.bezierCurveTo(-38, 96, -68, 74, -82, 50); p.bezierCurveTo(-92, 34, -96, 6, -96, -40); p.closePath(); }), 7000, 2.8, { tufts: 18, y0: 40, rim: 4 });
  else if (kind === 'soulpatch') beard(P(p => { p.moveTo(-9, 86); p.bezierCurveTo(-10, 96, -4, 106, 0, 108); p.bezierCurveTo(4, 106, 10, 96, 9, 86); p.closePath(); }), 1500, 3, { tufts: 2, y0: 86 });
  else if (kind === 'mutton') { beard(P(p => { for (const s of [-1, 1]) {   // sideburn widening into rounded cheek chops that curve toward the mouth corner
    p.moveTo(s * 104, -64); p.bezierCurveTo(s * 108, 20, s * 104, 64, s * 86, 86); p.bezierCurveTo(s * 72, 98, s * 52, 92, s * 46, 72);
    p.bezierCurveTo(s * 48, 56, s * 66, 46, s * 80, 30); p.bezierCurveTo(s * 90, 14, s * 93, -30, s * 93, -64); p.closePath(); } }), 9000, 3.2, { tufts: 16, y0: -40 });
    // fade the top into the scalp hair: no hard start at the temple
    g.save(); g.globalCompositeOperation = 'destination-out'; const fade = g.createLinearGradient(0, -64, 0, -20); fade.addColorStop(0, rgba('#000000', 0.85)); fade.addColorStop(1, rgba('#000000', 0)); g.fillStyle = fade; g.fillRect(-140, -70, 280, 52); g.restore(); }
  t.height = { dome: 8, str: 0.6, aoR: 4, ao: 2 };
  return t;
}
// mustaches (mouth space): plump volume with top light, a dark underside and a soft shadow on the lip
function mustacheTex(kind, seed = 901) {
  const t = tex(-66, -42, 66, 20, 3), g = t.g;
  const dir = (x) => Math.PI / 2 + Math.sign(x) * (0.35 + Math.abs(x) * 0.012);
  let shape;
  if (kind === 'natural') shape = P(p => { p.moveTo(-36, -2); p.bezierCurveTo(-34, -22, -10, -27, 0, -21); p.bezierCurveTo(10, -27, 34, -22, 36, -2); p.bezierCurveTo(24, -6, 10, -6, 0, -4); p.bezierCurveTo(-10, -6, -24, -6, -36, -2); p.closePath(); });
  else if (kind === 'chevron') shape = P(p => { p.moveTo(-40, 4); p.bezierCurveTo(-38, -24, -10, -29, 0, -23); p.bezierCurveTo(10, -29, 38, -24, 40, 4); p.bezierCurveTo(26, -1, 10, -2, 0, 0); p.bezierCurveTo(-10, -2, -26, -1, -40, 4); p.closePath(); });
  else if (kind === 'pencil') shape = P(p => { p.moveTo(-30, -8); p.bezierCurveTo(-18, -17, -5, -16, 0, -14); p.bezierCurveTo(5, -16, 18, -17, 30, -8); p.bezierCurveTo(18, -10, 5, -9, 0, -8); p.bezierCurveTo(-5, -9, -18, -10, -30, -8); p.closePath(); });
  else if (kind === 'handlebar') shape = P(p => { p.moveTo(-60, -24); p.bezierCurveTo(-64, -8, -52, 2, -38, -6); p.bezierCurveTo(-28, -22, -10, -27, 0, -21); p.bezierCurveTo(10, -27, 28, -22, 38, -6); p.bezierCurveTo(52, 2, 64, -8, 60, -24);
    p.bezierCurveTo(58, -13, 46, -10, 38, -13); p.bezierCurveTo(26, -9, 10, -7, 0, -5); p.bezierCurveTo(-10, -7, -26, -9, -38, -13); p.bezierCurveTo(-46, -10, -58, -13, -60, -24); p.closePath(); });
  g.save(); g.translate(0, 3); g.filter = blurOf(t, 2.4); g.fillStyle = rgba('#3a1e1e', 0.35); g.fill(shape); g.restore();               // shadow on the upper lip
  furVolume(t, shape, dir, { n: kind === 'pencil' ? 1500 : 4000, len: kind === 'pencil' ? 1.8 : 3.4, tufts: kind === 'pencil' ? 2 : 8, tuftLen: 8, rim: 2.5, span: [-28, 4], x0: -50, x1: 50, seed, cols: BEARD });
  t.height = { dome: 7, str: 0.8 };
  return t;
}

// ---------------------------------------------------------------- the set
export function paintHair(want = () => true) {
  const T = {}, add = (k, fn) => { if (want(k)) T[k] = fn(); };
  // caps
  add('h_cap_mid', () => partedCap({ part: -4, side: 76, wave: 0.25, seed: 111 }));
  add('h_cap_midwave', () => partedCap({ part: -4, side: 76, wave: 1, seed: 112 }));
  add('h_cap_side', () => partedCap({ part: -40, side: 66, wave: 0.6, seed: 113 }));
  add('h_cap_bob', () => bobCap({ side: 96, seed: 114 }));
  add('h_cap_bangs', () => partedCap({ part: -4, side: 76, wave: 0.2, seed: 115, fringe: 'blunt' }));
  add('h_cap_curtain', () => partedCap({ part: -4, side: 70, wave: 1, seed: 116, fringe: 'curtain', tuck: 0 }));
  add('h_cap_lob', () => partedCap({ part: -6, side: 88, wave: 1, seed: 117 }));
  add('h_cap_pulled', () => pulledCap({ gather: [12, -182], seed: 211 }));
  add('h_cap_pulledpart', () => pulledCap({ part: -2, seed: 212 }));
  add('h_cap_curls', () => curlyCap({ r: 138, cy: -62, bottom: 70, coil: 15, n: 160, seed: 411 }));
  add('h_cap_afro', () => curlyCap({ r: 176, cy: -76, bottom: 56, coil: 16, n: 240, seed: 412, line: -104 }));
  add('h_cap_afro_m', () => curlyCap({ r: 146, cy: -70, bottom: 8, coil: 13, n: 180, seed: 413, line: -102 }));
  add('h_cap_curlytop', () => curlyCap({ r: 126, cy: -84, bottom: -46, coil: 12, n: 130, seed: 414, squash: 0.82 }));
  for (const s of ['crop', 'side', 'slick', 'pomp', 'buzz', 'undercut', 'wavy', 'pixie', 'messy', 'mlong']) add('h_cap_' + s, () => shortCap(s, 300 + s.length * 7));
  for (const s of ['pomp50', 'mop', 'feather', 'curtains', 'frosted', 'crew', 'flattop', 'fauxhawk', 'frenchcrop', 'mohawk', 'locs', 'cornrows', 'twists', 'emo', 'bowl', 'hightop']) add('h_cap_' + s, () => menCap(s, 900 + s.length * 17));
  add('h_lock_loc', () => locLock(300, 30, 88));
  add('h_back_locs', () => backLocs(300, 520));
  // backs
  add('h_back_straight', () => backMass({ len: 500, wave: 0.35, freq: 0.7, seed: 511, cw: 34, flick: 0.6 }));
  add('h_back_waves', () => backMass({ len: 490, wave: 1.1, seed: 512 }));
  add('h_back_lob', () => backMass({ len: 270, wave: 0.9, seed: 513, cw: 30 }));
  add('h_back_bob', () => backMass({ len: 150, wave: 0.05, seed: 514, cw: 30, flick: -0.4 }));
  add('h_back_shag', () => backMass({ len: 330, wave: 1.2, seed: 515, layers: 1.5, cw: 28 }));
  add('h_back_curls', () => curlBack({ len: 430, seed: 611 }));
  add('h_back_afro', () => afroBack({ r: 200, seed: 711, n: 270 }));
  add('h_back_afro_m', () => afroBack({ r: 164, seed: 712, n: 190, coil: 14 }));
  // locks
  add('h_lock_straight', () => lockTex(380, 32, 81, { curl: 0.3, freq: 0.7, out: 0.6 }));
  add('h_lock_wave', () => lockTex(360, 34, 82, { curl: 1 }));
  add('h_lock_short', () => lockTex(200, 28, 83, { curl: 0.8 }));
  add('h_lock_ringlet', () => lockTex(320, 24, 84, { ringlet: true }));
  add('h_pony', () => ponyTex(330, 50, 85));
  add('h_pony_long', () => ponyTex(440, 46, 86, { curl: 1 }));
  add('h_braid', () => braidTex(400, 40, 87));
  // extras
  add('h_bun_top', () => bunTex(6, -182, 48, 91, { messy: true }));
  add('h_bun_space', () => bunTex(-78, -146, 34, 92));
  add('h_bun_space2', () => bunTex(78, -146, 34, 93));
  add('h_bun_man', () => bunTex(14, -166, 32, 94));
  add('h_bun_half', () => bunTex(4, -146, 32, 95, { messy: true }));
  add('h_bun_low', () => bunTex(100, -16, 40, 96));
  add('h_puff_l', () => puffTex(-96, -146, 52, 97));
  add('h_puff_r', () => puffTex(96, -146, 52, 98));
  add('h_puff_top', () => puffTex(4, -184, 62, 99));
  // facial hair
  for (const k of ['stubbleLight', 'stubbleHeavy', 'boxed', 'full', 'long', 'goatee', 'vandyke', 'chinstrap', 'soulpatch', 'mutton']) add('fh_' + k, () => beardTex(k, 800 + k.length * 13));
  for (const k of ['natural', 'chevron', 'pencil', 'handlebar']) add('fh_mus_' + k, () => mustacheTex(k, 900 + k.length * 11));
  return T;
}
