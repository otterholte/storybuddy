// Small SVG thumbnails for the style tiles, drawn from the same numbers the rig uses.
import { STYLES, BODIES } from '../../mesh/js/look.js';

const svg = (body, vb = '0 0 64 52') => `<svg viewBox="${vb}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const SKIN = '#f2c2a8', INK = '#2a1d16', HAIR = '#141012', ACC = '#f2b15a';

export function glyph(cat, key) {
  const s = (cat === 'body' ? BODIES : STYLES[cat] || {})[key];
  if (s && s.icon) return svg(s.icon, cat === 'hair' ? '0 0 64 64' : '0 0 64 52');   // catalogue entries bring their own icon
  switch (cat) {
    case 'face': {
      const w = 17 * s.width, j = w * (0.72 * s.jaw), cy = 26, top = cy - 18 * s.forehead, ch = cy + 20 * s.chin, ck = 1 + s.cheek * 0.08;
      return svg(`<path d="M32 ${top} C${32 + w * 1.15} ${top} ${32 + w * 1.05 * ck} ${cy + 2} ${32 + w * ck} ${cy + 6} C${32 + j} ${ch - 6} ${36} ${ch} 32 ${ch} C28 ${ch} ${32 - j} ${ch - 6} ${32 - w * ck} ${cy + 6} C${32 - w * 1.05 * ck} ${cy + 2} ${32 - w * 1.15} ${top} 32 ${top}Z" fill="${SKIN}" stroke="${INK}" stroke-width="1.5"/>`);
    }
    case 'eyes': {
      const w = 22 * s.w, h = 9 * s.h, t = s.tilt * 14;
      return svg(`<path d="M${32 - w} ${27 + t} Q32 ${27 - h * 2.1} ${32 + w} ${27 - t} Q32 ${27 + h * 1.5} ${32 - w} ${27 + t}Z" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="32" cy="${27 - h * 0.15}" r="${Math.min(h * 1.05, 9)}" fill="#5a3418"/><circle cx="29" cy="${24 - h * 0.2}" r="2.2" fill="#fff"/>`);
    }
    case 'brows': {
      const a = 10 * s.arch, pk = 32 - 4 + (s.peak - 0.8) * 10, th = 4.5 * s.thick, L = 20 * s.len;
      return svg(`<path d="M${32 - L} 32 Q${pk} ${32 - a * 1.6 - 4} ${32 + L} ${30}" stroke="${HAIR}" stroke-width="${th}"/>`);
    }
    case 'nose': {
      const w = 9 * s.w, h = 15 * s.h, tip = 5 * s.tip;
      return svg(`<path d="M30 ${30 - h} Q31 ${30 - h * 0.3} ${32 + 2} 30" stroke="#c98c78" stroke-width="2"/><path d="M${32 - w} 31 Q${32 - w - 2} 35 ${32 - w * 0.4} 36 M${32 + w} 31 Q${32 + w + 2} 35 ${32 + w * 0.4} 36" stroke="#b9705f" stroke-width="2"/><ellipse cx="32" cy="32" rx="${tip}" ry="${tip * 0.7}" fill="#fbe0d2"/>`);
    }
    case 'mouth': {
      const w = 18 * s.w, f = 6 * s.full, b = 2.4 * s.bow;
      return svg(`<path d="M${32 - w} 27 Q${32 - w * 0.5} ${27 - f} ${32 - 3} ${27 - f * 0.9 + b * 0} Q32 ${27 - f * 0.9 + b} ${32 + 3} ${27 - f * 0.9} Q${32 + w * 0.5} ${27 - f} ${32 + w} 27Z" fill="#d77a7f"/><path d="M${32 - w} 27 Q32 ${27 + f * 1.5} ${32 + w} 27Z" fill="#c9636a"/><path d="M${32 - w} 27 L${32 + w} 27" stroke="#7a2f36" stroke-width="1.5"/>`);
    }
    case 'hair': {
      if (s.cap) {
        const curl = key === 'curly', tall = { quiff: 12, curly: 10, buzz: -3 }[key] || 0;
        return svg(`<ellipse cx="32" cy="34" rx="13" ry="15" fill="${SKIN}"/><path d="M${key === 'buzz' ? 19 : 17} 36 C15 ${16 - tall} 49 ${16 - tall} ${key === 'buzz' ? 45 : 47} 36 C44 28 40 ${key === 'pixie' ? 30 : 24} 32 ${key === 'pixie' ? 28 : 24} C24 ${key === 'pixie' ? 30 : 24} 20 28 ${key === 'buzz' ? 19 : 17} 36Z" fill="${HAIR}" ${curl ? `stroke="#555" stroke-dasharray="2 2"` : ''}/>${key === 'sidepart' ? `<path d="M26 18 L24 27" stroke="#555"/>` : ''}`, '0 0 64 64');
      }
      const L = 8 + 34 * Math.min(1.2, s.len), v = 1 * s.vol;
      return svg(`<path d="M${32 - 20 * v} ${18 + L} C${32 - 22 * v} 26 ${32 - 22 * v} 6 32 6 C${32 + 22 * v} 6 ${32 + 22 * v} 26 ${32 + 20 * v} ${18 + L}Z" fill="${HAIR}"/><ellipse cx="32" cy="24" rx="12" ry="14" fill="${SKIN}"/><path d="M20 18 Q32 4 44 18 Q36 12 32 16 Q28 12 20 18Z" fill="${HAIR}"/>`, '0 0 64 64');
    }
    case 'top': {
      const sleeve = { tee: 'M14 16 L6 26 L12 30 L18 24', shirt: 'M14 16 L6 44 L12 46 L18 24', hoodie: 'M14 16 L5 44 L12 46 L18 24' }[key] || '';
      const neck = key === 'halter' ? 'M26 8 h12 v4 h-12Z' : key === 'shirt' ? 'M26 12 L32 20 L38 12' : '';
      const body = key === 'halter' ? 'M24 12 L40 12 L46 24 L44 46 L20 46 L18 24Z' : key === 'tank' ? 'M22 10 Q32 20 42 10 L46 22 L46 46 L18 46 L18 22Z' : 'M14 16 L26 10 Q32 16 38 10 L50 16 L46 24 L46 46 L18 46 L18 24Z';
      return svg(`<path d="${body}" fill="${ACC}" stroke="${INK}" stroke-width="1.4"/>${sleeve ? `<path d="${sleeve}" fill="${ACC}" stroke="${INK}" stroke-width="1.4"/><path d="${sleeve.replace(/(\d+) (\d+)/g, (m, x, y) => (64 - x) + ' ' + y)}" fill="${ACC}" stroke="${INK}" stroke-width="1.4"/>` : ''}${neck ? `<path d="${neck}" fill="none" stroke="${INK}" stroke-width="1.4"/>` : ''}${key === 'hoodie' ? '<path d="M24 34 h16 l2 8 h-20Z" fill="none" stroke="#2a1d16" stroke-width="1.2"/>' : ''}`);
    }
    case 'bottom': {
      const d = key === 'skirt' ? 'M22 8 L42 8 L52 40 L12 40Z' : key === 'shorts' ? 'M20 8 L44 8 L46 28 L34 28 L32 16 L30 28 L18 28Z' : `M20 8 L44 8 L${key === 'jeans' ? 44 : 42} 48 L35 48 L32 18 L29 48 L${key === 'jeans' ? 20 : 22} 48Z`;
      return svg(`<path d="${d}" fill="${key === 'jeans' ? '#4c6a96' : ACC}" stroke="${INK}" stroke-width="1.4"/>${key === 'jeans' ? '<path d="M20 12 H44" stroke="#2a1d16" stroke-width="1"/>' : ''}`);
    }
    case 'shoes': {
      return key === 'boots' ? svg(`<path d="M18 10 h14 v18 q12 2 16 8 v6 H16Z" fill="#6b4127" stroke="${INK}" stroke-width="1.4"/><path d="M16 40 H48" stroke="${INK}" stroke-width="3"/>`)
        : svg(`<path d="M14 26 h16 q12 2 20 8 v4 H12Z" fill="#f2f0ec" stroke="${INK}" stroke-width="1.4"/><path d="M12 38 H50" stroke="#8c8a90" stroke-width="3"/><path d="M20 30 q8 -2 14 4" stroke="${ACC}" stroke-width="2"/>`);
    }
    case 'facial': {
      const s2 = STYLES.facial[key], face = `<ellipse cx="32" cy="24" rx="16" ry="19" fill="${SKIN}"/><path d="M26 32 Q32 35 38 32" stroke="#a5525a" stroke-width="2"/>`;
      const beard = s2.beard === 'beard_beard' ? `<path d="M16 22 Q16 46 32 46 Q48 46 48 22 L44 22 Q44 38 32 38 Q20 38 20 22Z" fill="${HAIR}"/>` : s2.beard === 'beard_goatee' ? `<path d="M27 35 Q32 46 37 35Z" fill="${HAIR}"/>` : s2.beard === 'beard_stubble' ? `<path d="M17 24 Q17 44 32 44 Q47 44 47 24 L43 24 Q43 37 32 37 Q21 37 21 24Z" fill="#6b5a62" opacity=".5"/>` : '';
      const mus = s2.mustache ? `<path d="M24 31 Q32 26 40 31 Q32 29 24 31Z" fill="${HAIR}" stroke="${HAIR}" stroke-width="2"/>` : '';
      return svg(face + beard + mus);
    }
    case 'glasses': {
      if (key === 'none') return svg(`<ellipse cx="32" cy="26" rx="16" ry="18" fill="${SKIN}"/>`);
      const lens = key === 'round' ? (cx) => `<circle cx="${cx}" cy="26" r="8"/>` : key === 'cateye' ? (cx) => `<path d="M${cx - 9} 24 Q${cx - 6} 16 ${cx + 10} 18 Q${cx + 9} 32 ${cx} 32 Q${cx - 9} 32 ${cx - 9} 24Z"/>` : (cx) => `<rect x="${cx - 9}" y="20" width="18" height="12" rx="3"/>`;
      return svg(`<ellipse cx="32" cy="26" rx="18" ry="20" fill="${SKIN}"/><g fill="#dfe8f0" fill-opacity=".3" stroke="${INK}" stroke-width="2">${lens(22)}${lens(42)}</g><path d="M29 25 Q32 23 35 25" stroke="${INK}" stroke-width="2"/>`);
    }
    case 'body': {
      const b = BODIES[key], hs = 7 * b.head, leg = 20 * b.height, tor = 14 * b.torso, sh = 9 * b.shoulders, wa = 6 * b.waist, hp = 8 * b.hips;
      const total = hs * 2 + tor + leg, k = 50 / total, y0 = 3;
      const hy = y0 + hs * k, ty = y0 + hs * 2 * k, py = ty + tor * k, fy = py + leg * k;
      return svg(`<g transform="translate(32 0)"><path d="M${-sh * k * 1.6} ${ty + 1} L${-wa * k * 1.6} ${(ty + py) / 2} L${-hp * k * 1.6} ${py} L${-hp * k} ${fy} M${hp * k} ${fy} L${hp * k * 1.6} ${py} L${wa * k * 1.6} ${(ty + py) / 2} L${sh * k * 1.6} ${ty + 1}" stroke="${ACC}" stroke-width="${2.2 * b.thighs}"/><path d="M${-sh * k * 1.6} ${ty + 1} L${sh * k * 1.6} ${ty + 1}" stroke="${ACC}" stroke-width="2.2"/><circle cy="${hy}" r="${hs * k}" fill="${SKIN}"/></g>`, '0 0 64 56');
    }
  }
  return '';
}

export const ICONS = {
  body: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="2.6"/><path d="M7 10h10M12 10v6M12 16l-3 5M12 16l3 5M7 10l-2 5M17 10l2 5"/></svg>`,
  face: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3c4.5 0 7 3 7 7.5S16 21 12 21 5 15 5 10.5 7.5 3 12 3z"/></svg>`,
  hair: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20c-1-7 0-16 7-16s8 9 7 16M9 9c1 1 5 1 6-2"/></svg>`,
  eyes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  brows: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 13c3-4 7-5 9-4M21 13c-3-4-7-5-9-4"/></svg>`,
  nose: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 4c0 5-1 8-4 11 2 2 6 2 8 0"/></svg>`,
  mouth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 12c3-3 5-3 8-1 3-2 5-2 8 1-3 4-13 4-16 0z"/></svg>`,
  saved: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>`,
  outfit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 3l4 2 4-2 5 4-3 4-2-1v11H8V10l-2 1-3-4z"/></svg>`,
  makeup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 3l7 7-9 9H5v-7z"/><path d="M5 19l4-4"/></svg>`,
};
