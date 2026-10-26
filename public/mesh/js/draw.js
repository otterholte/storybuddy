// Painter: turns baked textures into deformed meshes. Every textured part is a grid over its
// texture box (local cu); a deform function maps each local vertex to world space.
import { gridMesh } from './gl.js';

export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const ease = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// 2D affine [a,b,c,d,tx,ty]: x' = a x + c y + tx ; y' = b x + d y + ty
export const M = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
  tr: (x, y) => [1, 0, 0, 1, x, y],
  rot: (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; },
  sc: (x, y = x) => [x, 0, 0, y, 0, 0],
  trs: (x, y, a = 0, sx = 1, sy = sx) => { const c = Math.cos(a), s = Math.sin(a); return [c * sx, s * sx, -s * sy, c * sy, x, y]; },
  ap: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
  inv: (m) => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; },
};

export class Painter {
  constructor(R, T) { this.R = R; this.T = T; this.grids = new Map(); this.v = new Float32Array(1 << 21); this.alpha = 1; }
  grid(c, r) { const k = c * 1000 + r; if (!this.grids.has(k)) this.grids.set(k, gridMesh(c, r)); return this.grids.get(k); }
  // fn(lx, ly) -> [wx, wy] ; optional afn(lx,ly) -> per-vertex alpha
  mesh(name, cols, rows, fn, o = {}) {
    const t = this.T[name]; if (!t) throw new Error('no tex ' + name);
    const [x0, y0, x1, y1] = o.box || t.box, gm = this.grid(cols, rows), v = this.v;
    const u0 = o.uv ? o.uv[0] : 0, v0 = o.uv ? o.uv[1] : 0, u1 = o.uv ? o.uv[2] : 1, v1 = o.uv ? o.uv[3] : 1;
    const flip = o.flipU;
    let k = 0;
    for (let i = 0; i < gm.n; i++) {
      const u = gm.uv[i * 2], vv = gm.uv[i * 2 + 1];
      const lx = x0 + u * (x1 - x0), ly = y0 + vv * (y1 - y0);
      const p = fn(lx, ly);
      v[k++] = p[0]; v[k++] = p[1];
      const tu = u0 + (u1 - u0) * u;
      v[k++] = flip ? 1 - tu : tu; v[k++] = v0 + (v1 - v0) * vv; v[k++] = o.afn ? o.afn(lx, ly) : 1;
      k += 4;
    }
    // per-vertex surface frame: world directions of the texture's +u and +v (normals rotate with the mesh)
    const C = gm.cols + 1, R1 = gm.rows + 1, fs = flip ? -1 : 1;
    for (let j = 0; j < R1; j++) for (let i = 0; i < C; i++) {
      const id = j * C + i, a = j * C + Math.max(0, i - 1), b = j * C + Math.min(C - 1, i + 1), c2 = Math.max(0, j - 1) * C + i, dd = Math.min(R1 - 1, j + 1) * C + i;
      v[id * 9 + 5] = (v[b * 9] - v[a * 9]) * fs; v[id * 9 + 6] = (v[b * 9 + 1] - v[a * 9 + 1]) * fs;
      v[id * 9 + 7] = v[dd * 9] - v[c2 * 9]; v[id * 9 + 8] = v[dd * 9 + 1] - v[c2 * 9 + 1];
    }
    this.R.draw(t, v, gm.n, gm.idx, gm.idx.length, { ...o, opacity: (o.opacity ?? 1) * this.alpha });
  }
  // rigid placement with affine m (local -> world)
  quad(name, m, o = {}) { this.mesh(name, 1, 1, (x, y) => M.ap(m, x, y), o); }
  // texture laid along a polyline. axis 'x': texture x in [a0,a1] maps along; texture y -> normal offset.
  // axis 'y': texture y in [a0,a1] maps along; texture x -> normal offset.  scale = normal scale (number or fn(s))
  strip(name, pts, o = {}) {
    const t = this.T[name], axis = o.axis || 'x', [a0, a1] = o.range || (axis === 'x' ? [t.box[0], t.box[2]] : [t.box[1], t.box[3]]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1] || 1;
    const at = (s) => {
      const d = s * L; let i = 1; while (i < pts.length - 1 && cum[i] < d) i++;
      const p = pts[i - 1], q = pts[i], seg = (cum[i] - cum[i - 1]) || 1, f = (d - cum[i - 1]) / seg;
      const tx = (q[0] - p[0]) / seg, ty = (q[1] - p[1]) / seg;
      return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, -ty, tx];
    };
    const sc = o.scale ?? 1, along = o.alongScale ?? 1;
    this.mesh(name, axis === 'x' ? (o.segs || 14) : (o.cross || 3), axis === 'x' ? (o.cross || 2) : (o.segs || 20), (lx, ly) => {
      const a = axis === 'x' ? lx : ly, n = axis === 'x' ? ly : lx;
      let s = (a - a0) / (a1 - a0);
      const extra = s < 0 ? s : s > 1 ? s - 1 : 0; s = clamp(s);
      const p = at(s), k = typeof sc === 'function' ? sc(s) : sc;
      const nn = o.flipN ? -n : n;
      return [p[0] + p[2] * nn * k + extra * L * p[3] * along, p[1] + p[3] * nn * k - extra * L * p[2] * along];
    }, o);
  }
  // filled polygon into stencil (triangle fan) – used for eye and mouth openings
  maskPoly(pts, ref) {
    const v = this.v, n = pts.length; let k = 0;
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
    v[k++] = cx; v[k++] = cy; v[k++] = 0; v[k++] = 0; v[k++] = 1; v[k++] = 1; v[k++] = 0; v[k++] = 0; v[k++] = 1;
    for (const p of pts) { v[k++] = p[0]; v[k++] = p[1]; v[k++] = 0; v[k++] = 0; v[k++] = 1; v[k++] = 1; v[k++] = 0; v[k++] = 0; v[k++] = 1; }
    const idx = new Uint16Array(n * 3);
    for (let i = 0; i < n; i++) { idx[i * 3] = 0; idx[i * 3 + 1] = 1 + i; idx[i * 3 + 2] = 1 + (i + 1) % n; }
    this.R.draw(null, v, n + 1, idx, idx.length, { mask: ref });
  }
  // many small sprites in one draw (rain, motes): list of [x,y,rot,sx,sy,alpha]
  sprites(name, list, o = {}) {
    const t = this.T[name], [x0, y0, x1, y1] = t.box, v = this.v, n = list.length;
    if (!n) return;
    const idx = this._spIdx && this._spIdx.length >= n * 6 ? this._spIdx : (this._spIdx = (() => { const a = new Uint32Array(Math.max(n, 4096) * 6); for (let i = 0; i < a.length / 6; i++) { const b = i * 4; a.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6); } return a; })());
    let k = 0;
    for (const [x, y, r, sx, sy, a] of list) {
      const c = Math.cos(r), s = Math.sin(r);
      for (const [lx, ly, u, vv] of [[x0, y0, 0, 0], [x1, y0, 1, 0], [x0, y1, 0, 1], [x1, y1, 1, 1]]) {
        const px = lx * sx, py = ly * sy;
        v[k++] = x + c * px - s * py; v[k++] = y + s * px + c * py; v[k++] = u; v[k++] = vv; v[k++] = a; v[k++] = c; v[k++] = s; v[k++] = -s; v[k++] = c;
      }
    }
    this.R.draw(t, v, n * 4, idx, n * 6, { ...o, opacity: (o.opacity ?? 1) * this.alpha });
  }
}
