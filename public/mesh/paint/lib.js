// Painting toolkit for the raster pipeline: soft volumes, strand hair, noise.
// All painting happens in "character units" (cu) through a texel density D.
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// A texture canvas covering local box [x0,x1]x[y0,y1] (cu) at density D (px/cu).
export function tex(x0, y0, x1, y1, D) {
  const w = Math.ceil((x1 - x0) * D), h = Math.ceil((y1 - y0) * D);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.setTransform(D, 0, 0, D, -x0 * D, -y0 * D);
  g.lineCap = 'round'; g.lineJoin = 'round';
  return { c, g, D, box: [x0, y0, x1, y1] };
}
export function P(fn) { const p = new Path2D(); fn(p); return p; }
// mirror a half path (drawn for x>=0) into a full symmetric closed path; pts: [[x,y] or bezier triples]
export function symPath(segs) {
  // segs: list of cubic segments [[c1x,c1y,c2x,c2y,x,y],...] starting at top center (0,y0) going right
  return (p, y0) => {
    p.moveTo(0, y0);
    for (const s of segs) p.bezierCurveTo(...s);
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i], prev = i > 0 ? segs[i - 1].slice(4, 6) : [0, y0];
      p.bezierCurveTo(-s[2], s[3], -s[0], s[1], -prev[0], prev[1]);
    }
    p.closePath();
  };
}
export const rgba = (hex, a = 1) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// Soft-shaded volume: base fill + clipped painterly passes.
// passes: {edge:{color,width,blur,dx,dy,alpha}} | {blob:{x,y,rx,ry,color,alpha,rot}} | {grad:{x0,y0,x1,y1,stops}} | {rim:{...edge}}
export function volume(t, path, base, passes = []) {
  const g = t.g; g.save();
  g.fillStyle = base; g.fill(path); g.clip(path);
  for (const ps of passes) paintPass(t, path, ps);
  g.restore();
}
export function paintPass(t, path, ps) {
  const g = t.g, D = t.D;
  g.save();
  const k = Object.keys(ps)[0], o = ps[k];
  g.globalAlpha = (o.alpha ?? 1) * ((k === 'blob' || k === 'grad' || k === 'edge') && !o.keep ? SHADING.k : 1); if (o.op) g.globalCompositeOperation = o.op;
  if (o.blur) g.filter = `blur(${o.blur * D}px)`;
  if (k === 'edge') {
    g.translate(o.dx || 0, o.dy || 0); g.strokeStyle = o.color; g.lineWidth = o.width; g.stroke(path);
  } else if (k === 'blob') {
    g.translate(o.x, o.y); g.rotate(o.rot || 0); g.scale(1, (o.ry ?? o.rx) / o.rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, o.rx);
    gr.addColorStop(0, o.color); gr.addColorStop(o.core ?? 0, o.color); gr.addColorStop(1, o.color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, o.rx, 0, 7); g.fill();
  } else if (k === 'grad') {
    const gr = g.createLinearGradient(o.x0, o.y0, o.x1, o.y1);
    for (const [s, c] of o.stops) gr.addColorStop(s, c);
    g.fillStyle = gr; g.fillRect(-5000, -5000, 10000, 10000);
  } else if (k === 'shape') {
    g.translate(o.dx || 0, o.dy || 0); g.fillStyle = o.color; g.fill(o.path);
  } else if (k === 'inner') {
    // inner shadow: fill everything outside path (offset), blurred, clipped by path
    g.translate(o.dx || 0, o.dy || 0); g.fillStyle = o.color;
    const big = new Path2D(); big.rect(-5000, -5000, 10000, 10000); big.addPath(path);
    g.fill(big, 'evenodd');
  } else if (k === 'fn') o.fn(g);
  g.restore();
}
// film grain / pores
export function grain(t, amt = 0.04, seed = 7) {
  const { c } = t, g = c.getContext('2d'), w = c.width, h = c.height;
  const id = g.getImageData(0, 0, w, h), d = id.data, r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const n = (r() - 0.5) * 255 * amt;
    d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(id, 0, 0);
}
// blur whole texture (depth of field)
export function blurTex(t, px) {
  const c2 = document.createElement('canvas'); c2.width = t.c.width; c2.height = t.c.height;
  const g = c2.getContext('2d'); g.filter = `blur(${px}px)`; g.drawImage(t.c, 0, 0);
  const g0 = t.c.getContext('2d'); g0.save(); g0.setTransform(1, 0, 0, 1, 0, 0); g0.clearRect(0, 0, t.c.width, t.c.height); g0.drawImage(c2, 0, 0); g0.restore();
}

// Polyline helpers
export function sampleCurve(pts, n) {
  // Catmull-Rom through pts -> n samples
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u)), f = u - k;
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}
export function normals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
}

// Hair lock painted from thousands of strands.
// spine: control points (cu) root->tip; width(u) -> half width; opts colors
const smoothT = (u) => { const k = Math.max(0, Math.min(1, (u - 0.62) / 0.38)); return k * k * (3 - 2 * k); };
export function hairLock(t, spine, width, o = {}) {
  const g = t.g, r = rng(o.seed || 1), N = 64;
  const pts = sampleCurve(spine, N), nr = normals(pts);
  const base = o.base || '#0b0a0e', hi = o.hi || '#7a7380', mid = o.mid || '#26232b';
  // mass fill so no gaps
  const mass = new Path2D();
  for (let i = 0; i < N; i++) { const w = width(i / (N - 1)) * 0.82 * (1 - smoothT(i / (N - 1))); const p = pts[i], n = nr[i]; i ? mass.lineTo(p[0] + n[0] * w, p[1] + n[1] * w) : mass.moveTo(p[0] + n[0] * w, p[1] + n[1] * w); }
  for (let i = N - 1; i >= 0; i--) { const w = width(i / (N - 1)) * 0.82 * (1 - smoothT(i / (N - 1))); const p = pts[i], n = nr[i]; mass.lineTo(p[0] - n[0] * w, p[1] - n[1] * w); }
  mass.closePath();
  if (!o.noMass) { g.save(); g.fillStyle = base; g.filter = `blur(${0.4 * t.D}px)`; g.fill(mass); g.restore(); }
  const strands = o.strands || 260;
  for (let s = 0; s < strands; s++) {
    const off = (r() * 2 - 1), ph = r() * 6.28, wav = (o.wave ?? 1) * (0.6 + r() * 0.8);
    const u0 = r() * 0.08 * (o.rootSpread ?? 1), u1 = 1 - r() * 0.45;
    const lw = (0.35 + r() * r() * 1.1) * (o.thick || 1);
    const bright = r();
    g.beginPath();
    for (let i = Math.floor(u0 * (N - 1)); i <= Math.floor(u1 * (N - 1)); i++) {
      const u = i / (N - 1), w = width(u), p = pts[i], n = nr[i];
      const o2 = off * w * (1 + 0.15 * Math.sin(u * 9 + ph)) + Math.sin(u * 14 * wav + ph) * 1.2;
      const x = p[0] + n[0] * o2, y = p[1] + n[1] * o2;
      i === Math.floor(u0 * (N - 1)) ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    // anisotropic sheen: highlight band(s) along length, stronger on the lit side
    const gr = g.createLinearGradient(pts[0][0], pts[0][1], pts[N - 1][0], pts[N - 1][1]);
    const band = (o.band || [0.22, 0.55]).map(b => Math.min(0.85, Math.max(0.12, b + (r() - 0.5) * 0.16 + Math.sin(off * 2.3 + (o.seed || 1)) * 0.05)));
    const lit = Math.max(0, 0.55 - off * 0.45 * (o.litSide ?? 1)) * (0.45 + bright * 0.7);
    gr.addColorStop(0, mid);
    for (const b of band) {
      gr.addColorStop(Math.max(0, b - 0.09), base);
      gr.addColorStop(b, mixc(base, hi, lit));
      gr.addColorStop(Math.min(1, b + 0.11), base);
    }
    gr.addColorStop(1, mid);
    g.strokeStyle = gr; g.lineWidth = lw; g.globalAlpha = 0.55 + r() * 0.45; g.stroke();
  }
  // flyaways
  g.globalAlpha = 1;
  for (let s = 0; s < (o.fly ?? 14); s++) {
    const u = 0.15 + r() * 0.8, i = Math.floor(u * (N - 1)), side = r() < 0.5 ? -1 : 1, p = pts[i], n = nr[i], w = width(u);
    const len = 12 + r() * 30;
    g.beginPath(); g.moveTo(p[0] + n[0] * w * side * 0.9, p[1] + n[1] * w * side * 0.9);
    g.quadraticCurveTo(p[0] + n[0] * side * (w + len * 0.5), p[1] + n[1] * side * (w + len * 0.4) + len * 0.4,
      p[0] + n[0] * side * (w + len * 0.6) + (r() - 0.5) * 10, p[1] + len);
    g.strokeStyle = rgba('#1c1a20', 0.7); g.lineWidth = 0.35; g.stroke();
  }
}
export function mixc(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
// fractal ridge line for mountains: returns [[x,y]...] across [0,w]
export function ridge(w, y0, amp, seed, rough = 0.55, n = 9) {
  const r = rng(seed); let pts = [[0, y0 + (r() - 0.5) * amp], [w, y0 + (r() - 0.5) * amp]];
  let a = amp;
  for (let it = 0; it < n; it++) {
    const np = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      np.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + (r() - 0.5) * a]);
    }
    np.push(pts[pts.length - 1]); pts = np; a *= rough;
  }
  return pts;
}
// make ridge tileable: blend end into start
export function tileRidge(pts, w) {
  const n = pts.length, y0 = pts[0][1];
  return pts.map((p, i) => { const f = i / (n - 1); const k = Math.max(0, (f - 0.8) / 0.2); return [p[0], p[1] * (1 - k) + y0 * k]; });
}

// Soft volume for arbitrary unions (hands, fur clumps): drawMask(g) fills the silhouette in the
// texture's cu transform. Edge darkening comes from a blurred copy of the mask, so overlapping
// sub-shapes shade as one surface with no internal outlines.
export function maskVolume(t, drawMask, base, o = {}) {
  const W = t.c.width, H = t.c.height, D = t.D, [x0, y0] = t.box;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.setTransform(D, 0, 0, D, -x0 * D, -y0 * D); return [c, g]; };
  const [m, mg] = mk(); mg.fillStyle = '#fff'; drawMask(mg);
  const [r, rg] = mk();
  rg.fillStyle = base; rg.fillRect(x0, y0, W / D, H / D);
  for (const b of o.blobs || []) { rg.save(); rg.translate(b.x, b.y); rg.scale(1, (b.ry ?? b.rx) / b.rx); const gr = rg.createRadialGradient(0, 0, 0, 0, 0, b.rx); gr.addColorStop(0, b.color); gr.addColorStop(1, b.color.replace(/[\d.]+\)$/, '0)')); rg.fillStyle = gr; rg.beginPath(); rg.arc(0, 0, b.rx, 0, 7); rg.fill(); rg.restore(); }
  for (const e of o.edges || []) {
    const [s, sg] = mk(); sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.fillStyle = e.color; sg.fillRect(0, 0, W, H);
    sg.globalCompositeOperation = 'destination-out'; sg.filter = `blur(${e.blur * D}px)`; sg.drawImage(m, (e.dx || 0) * D, (e.dy || 0) * D);
    sg.filter = 'none'; sg.globalCompositeOperation = 'destination-in'; sg.drawImage(m, 0, 0);
    rg.save(); rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalAlpha = e.alpha ?? 1; if (e.op) rg.globalCompositeOperation = e.op; rg.drawImage(s, 0, 0); rg.restore();
  }
  if (o.after) o.after(rg);
  rg.save(); rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = 'destination-in'; rg.filter = `blur(${(o.soft ?? 0.3) * D}px)`; rg.drawImage(m, 0, 0); rg.restore();
  const g = t.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(r, 0, 0); g.restore();
}

// Hair clump v2: separated, tapered clump with an ambient-occluded core, sheen that follows the
// strand flow (lit where the wave slants toward the upper-left key light), wispy faded tips.
export function clump(t, spine, width, o = {}) {
  const g = t.g, r = rng(o.seed || 1), N = 80;
  const pts = sampleCurve(spine, N), nr = normals(pts);
  const base = o.base || '#0c0b10', hi = o.hi || '#9aa2b6', ao = o.ao || '#030205';
  const tan = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
  // AO core
  const core = new Path2D();
  for (let i = 0; i < N; i++) { const w = width(i / (N - 1)) * 0.55; core[i ? 'lineTo' : 'moveTo'](pts[i][0] + nr[i][0] * w, pts[i][1] + nr[i][1] * w); }
  for (let i = N - 1; i >= 0; i--) { const w = width(i / (N - 1)) * 0.55; core.lineTo(pts[i][0] - nr[i][0] * w, pts[i][1] - nr[i][1] * w); }
  core.closePath();
  g.save(); g.fillStyle = ao; g.filter = `blur(${(o.coreBlur ?? 1.6) * t.D}px)`; g.globalAlpha = o.coreAlpha ?? 0.95; g.fill(core); g.restore();
  // flow-lit highlight profile along the clump
  const lightAt = pts.map((p, i) => {
    const tx = tan[i][0] * (o.flip ? -1 : 1);
    const slant = Math.max(0, Math.min(1, (-tx - 0.02) / 0.3));
    const crown = o.crown ? Math.exp(-(((i / (N - 1)) - o.crown) ** 2) / 0.01) * (o.crownK ?? 1) : 0;
    return Math.min(1, slant * 0.85 + crown);
  });
  const A = pts[0], B = pts[N - 1], dx = B[0] - A[0], dy = B[1] - A[1], LL = dx * dx + dy * dy || 1;
  const proj = pts.map(p => Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / LL)));
  const strands = o.strands || 220;
  for (let s = 0; s < strands; s++) {
    const off = (r() * 2 - 1) * (0.55 + 0.45 * r()), ph = r() * 6.28;
    const u0 = r() * 0.06, u1 = 1 - Math.pow(r(), 1.6) * (o.tipVar ?? 0.4);
    const lw = (0.3 + r() * r() * 1.0) * (o.thick || 1);
    const edge = Math.abs(off);
    const litS = (0.5 + r() * 0.6) * (1 - edge * 0.45) * (o.lit ?? 1);
    const i0 = Math.floor(u0 * (N - 1)), i1 = Math.max(i0 + 2, Math.floor(u1 * (N - 1)));
    g.beginPath();
    for (let i = i0; i <= i1; i++) {
      const u = i / (N - 1), w = width(u) * (1 - Math.pow(u, 3) * 0.5);
      const o2 = off * w + Math.sin(u * 22 + ph) * 0.9 * (o.frizz ?? 1);
      const x = pts[i][0] + nr[i][0] * o2, y = pts[i][1] + nr[i][1] * o2;
      i === i0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    const gr = g.createLinearGradient(A[0], A[1], B[0], B[1]);
    let last = -1;
    for (let k = 0; k <= 20; k++) {
      const i = Math.min(N - 1, Math.round(i0 + (i1 - i0) * k / 20)), pos = proj[i];
      if (pos <= last) continue; last = pos;
      const tip = Math.max(0, (k / 20 - 0.82) / 0.18);
      const c = mixc(base, hi, Math.min(1, lightAt[i] * litS * (0.75 + 0.5 * Math.sin(k * 0.9 + ph * 3))));
      gr.addColorStop(pos, c.replace('rgb(', 'rgba(').replace(')', `,${(1 - tip * 0.95).toFixed(3)})`));
    }
    g.strokeStyle = gr; g.lineWidth = lw; g.globalAlpha = 0.6 + r() * 0.4; g.stroke();
  }
  g.globalAlpha = 1;
  for (let s = 0; s < (o.fly ?? 10); s++) { // flyaways leaving the clump
    const u = 0.1 + r() * 0.85, i = Math.floor(u * (N - 1)), side = r() < 0.5 ? -1 : 1, p = pts[i], n = nr[i], w = width(u), len = 14 + r() * 36;
    g.beginPath(); g.moveTo(p[0] + n[0] * w * side * 0.8, p[1] + n[1] * w * side * 0.8);
    g.bezierCurveTo(p[0] + n[0] * side * (w + len * 0.3), p[1] + len * 0.3, p[0] + n[0] * side * (w + len * 0.6), p[1] + len * 0.6, p[0] + n[0] * side * (w + len * 0.5) + (r() - 0.5) * 16, p[1] + len);
    g.strokeStyle = rgba('#2a2a34', 0.55); g.lineWidth = 0.3; g.stroke();
  }
}
// S-wave clump spine: root (x0,y0) hanging length L, wave grows toward the tips
export function wave(x0, y0, L, amp, waves, phase, drift = 0, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) { const u = i / n; out.push([x0 + drift * u + Math.sin(u * waves * Math.PI * 2 + phase) * amp * (0.15 + u * u * 1.1), y0 + u * L]); }
  return out;
}

// ---------------------------------------------------------------- normal maps
// Shading baked into albedo is scaled by SHADE (the shader relights with normals instead).
export const SHADING = { k: 1 };
// Height -> normal map (+AO). spec: { dome: blur px of alpha for the pillow height, str: normal strength,
// extra(g): paint +/- height (draw on a 50% grey canvas, white up, black down) in cu coords, detail: strand high-pass }
export function normalMap(t, spec) {
  const W = t.c.width, H = t.c.height, D = t.D, [x0, y0] = t.box;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const [ac, ag] = mk(); ag.filter = `blur(${spec.dome || 12}px)`; ag.drawImage(t.c, 0, 0);
  const A = ag.getImageData(0, 0, W, H).data, src = t.c.getContext('2d').getImageData(0, 0, W, H).data;
  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const a = A[i * 4 + 3] / 255; h[i] = Math.sqrt(a) * (spec.domeAmt ?? 1); }
  if (spec.extra) {
    const [ec, eg] = mk(); eg.fillStyle = 'rgb(128,128,128)'; eg.fillRect(0, 0, W, H);
    eg.setTransform(D, 0, 0, D, -x0 * D, -y0 * D); eg.filter = `blur(${(spec.extraBlur ?? 2) * D}px)`; spec.extra(eg);
    const E = eg.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) h[i] += (E[i * 4] - 128) / 127 * (spec.extraAmt ?? 1);
  }
  if (spec.detail) {
    const [bc, bg] = mk(); bg.filter = `blur(${spec.detailBlur || 2}px)`; bg.drawImage(t.c, 0, 0);
    const B = bg.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) { const l = (src[i * 4] + src[i * 4 + 1] + src[i * 4 + 2]) / 765, lb = (B[i * 4] + B[i * 4 + 1] + B[i * 4 + 2]) / 765; h[i] += (l - lb) * spec.detail; }
  }
  // float box blur (separable) used to de-quantize the height and for cavity AO
  const boxBlur = (src, R) => {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let s = 0; for (let x = -R; x <= R; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * R + 1); s += src[y * W + Math.min(W - 1, x + R + 1)] - src[y * W + Math.max(0, x - R)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -R; y <= R; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { out[y * W + x] = s / (2 * R + 1); s += tmp[Math.min(H - 1, y + R + 1) * W + x] - tmp[Math.max(0, y - R) * W + x]; } }
    return out;
  };
  { const sm = spec.detail ? 1 : 3; const b1 = boxBlur(h, sm), b2 = boxBlur(b1, sm); h.set(b2); }
  const hb = new Float32Array(W * H), R = Math.max(2, Math.round((spec.aoR || 8)));
  { // box blur separable
    const tmp = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let s = 0; for (let x = -R; x <= R; x++) s += h[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * R + 1); s += h[y * W + Math.min(W - 1, x + R + 1)] - h[y * W + Math.max(0, x - R)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -R; y <= R; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { hb[y * W + x] = s / (2 * R + 1); s += tmp[Math.min(H - 1, y + R + 1) * W + x] - tmp[Math.max(0, y - R) * W + x]; } }
  }
  const [oc, og] = mk(), out = og.createImageData(W, H), O = out.data, str = (spec.str || 1) * D * 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, l = h[y * W + Math.max(0, x - 1)], r = h[y * W + Math.min(W - 1, x + 1)], u = h[Math.max(0, y - 1) * W + x], d = h[Math.min(H - 1, y + 1) * W + x];
    let nx = -(r - l) * str, ny = -(d - u) * str, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len;
    const ao = Math.max(0, Math.min(1, 1 - Math.max(0, hb[i] - h[i]) * (spec.ao ?? 2.5)));
    let sm = 1; if (spec.darkSpec) { const lum = (src[i * 4] + src[i * 4 + 1] + src[i * 4 + 2]) / 765; sm = lum < 0.22 ? 1 : 0.12; }
    // blue packs AO (low 7 bits of range) and the specular mask (high half)
    O[i * 4] = (nx * 0.5 + 0.5) * 255; O[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; O[i * 4 + 2] = (sm > 0.5 ? 128 : 0) + ao * 127; O[i * 4 + 3] = 255;
  }
  og.putImageData(out, 0, 0);
  return oc;
}
