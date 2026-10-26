// Creator wardrobe: base bodies (woman / man), clothing layers, short hair and facial hair,
// painted with the same toolkit as the film heroine (mesh/paint/lib.js). Every texture lives in
// the space of the rig part it rides on, so the rig's existing deformers carry it:
//   torso space  - pelvis origin, neck top y=-432, shoulders x=+-118 y=-300, waist y=-96, crotch y=74
//   arm space    - shoulder origin, hangs along +y, elbow y=165, wrist y=315
//   leg space    - hip origin, knee y=210, ankle y=410
//   foot space   - ankle origin, toe toward +x
//   head space   - head centre (face outline: x=+-103, top y=-130, chin y=113)
//   mouth space  - mouth centre line y=0
// Clothes are painted in light neutral greys so the creator can tint them any colour.
import { tex, P, volume, paintPass, grain, rgba, rng, clump, wave, SHADING } from '../../mesh/paint/lib.js';

const SK = { hi: '#ffe7d8', base: '#f5c8b0', mid: '#eeb59b', sh: '#dc927e', sss: '#e47a68', deep: '#b8604f' };
const CL = { base: '#e4e2e6', hi: '#ffffff', mid: '#c9c6cc', sh: '#a29ea8', deep: '#7c7882', ao: '#58545e' };   // neutral cloth

// ---------------------------------------------------------------- shared outlines
// torso silhouette (same as the film body); grow > 0 pushes it outward for looser cloth
function torsoPath(grow = 0, y1 = 74, dl = 0) {
  const g = (x) => x + Math.sign(x) * grow;
  return P(p => {
    p.moveTo(g(-40), -432); p.lineTo(g(40), -432);
    p.bezierCurveTo(g(40), -380, g(42), -346, g(52), -330);
    p.bezierCurveTo(g(72), -322 - grow, g(100), -322 - grow, g(118), -308 - grow);
    p.bezierCurveTo(g(134 + dl), -300 + dl * 0.2, g(138 + dl * 1.2), -268, g(128 + dl * 0.7), -246);
    p.bezierCurveTo(g(122 + dl * 0.3), -234, g(112), -224, g(104), -214);
    p.bezierCurveTo(g(100), -170, g(92 + grow * 0.6), -130, g(76 + grow * 1.2), -96);
    p.bezierCurveTo(g(70 + grow * 1.4), -66, g(86), -40, g(102), -12);
    p.bezierCurveTo(g(110), 8, g(108), 32, g(96), 54);
    p.bezierCurveTo(g(50), 62, g(20), y1 - 4, 0, y1); p.bezierCurveTo(g(-20), y1 - 4, g(-50), 62, g(-96), 54);
    p.bezierCurveTo(g(-108), 32, g(-110), 8, g(-102), -12);
    p.bezierCurveTo(g(-86), -40, g(-70 - grow * 1.4), -66, g(-76 - grow * 1.2), -96);
    p.bezierCurveTo(g(-92 - grow * 0.6), -130, g(-100), -170, g(-104), -214);
    p.bezierCurveTo(g(-112), -224, g(-122 - dl * 0.3), -234, g(-128 - dl * 0.7), -246);
    p.bezierCurveTo(g(-138 - dl * 1.2), -268, g(-134 - dl), -300 + dl * 0.2, g(-118), -308 - grow);
    p.bezierCurveTo(g(-100), -322 - grow, g(-72), -322 - grow, g(-52), -330);
    p.bezierCurveTo(g(-42), -346, g(-40), -380, g(-40), -432); p.closePath();
  });
}
const clipTo = (t, path, fn) => { const g = t.g; g.save(); g.clip(path); fn(g); g.restore(); };
const stroke = (g, pts, w, col, blur = 0) => { g.save(); if (blur) g.filter = `blur(${blur * g.getTransform().a}px)`; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); if (pts.length === 4) g.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); else for (const q of pts.slice(1)) g.lineTo(...q); g.stroke(); g.restore(); };
// arm half-width (film arm) and leg half-width (film leg)
const armHW = (y) => { const u = y / 315; if (u < 0) return 32 * Math.sqrt(Math.max(0, 1 - (y / 26) ** 2)); if (u < 0.22) return 32 - u * 14; if (u < 0.52) return 28.9 - (u - 0.22) * 22; if (u < 0.6) return 22.3; if (u < 0.7) return 22.3 + (u - 0.6) * 12; return 23.5 - (u - 0.7) * 22; };
const legHW = (y) => { const u = y / 410; return u < 0.5 ? 50 - 28 * u * 2 + (u < 0.12 ? 6 * (1 - u / 0.12) : 0) : u < 0.62 ? 22 + Math.sin((u - 0.5) / 0.12 * Math.PI) * 3 : 25 - (u - 0.62) * 26; };
function tube(hw, y0, y1, k = 1, cap = true) {
  return P(p => {
    const step = 4; p.moveTo(-hw(Math.max(0, y0)) * k, y0);
    for (let y = y0; y <= y1; y += step) p.lineTo(hw(Math.max(0, y)) * k, y);
    if (cap) p.lineTo(hw(y1) * k, y1);
    for (let y = y1; y >= y0; y -= step) p.lineTo(-hw(Math.max(0, y)) * k, y);
    p.closePath();
  });
}
const clothPasses = (x0, x1, o = {}) => [
  { grad: { x0, y0: 0, x1, y1: 0, stops: [[0, rgba(CL.sh, 0.55)], [0.22, rgba(CL.hi, 0.55)], [0.45, rgba(CL.base, 0)], [0.75, rgba(CL.sh, 0.45)], [1, rgba(CL.deep, 0.7)]] } },
  { edge: { color: rgba(CL.ao, o.ao ?? 0.55), width: o.edge ?? 10, blur: 4 } },
  ...(o.rim === false ? [] : [{ edge: { color: rgba('#ffffff', 0.5), width: 3, blur: 1.2, dx: -2 } }]),
];

// ---------------------------------------------------------------- base bodies (skin)
function torsoSkin(sex) {
  const t = tex(-150, -435, 150, 90, 2), body = torsoPath();
  volume(t, body, rgba(SK.base), [
    { blob: { x: -70, y: -296, rx: 60, ry: 30, color: rgba('#fff1e8', 0.55) } },
    { grad: { x0: -130, y0: 0, x1: 130, y1: 0, stops: [[0, rgba(SK.sss, 0.5)], [0.15, rgba(SK.sss, 0)], [0.7, rgba(SK.sh, 0)], [1, rgba('#b8604f', 0.6)]] } },
    { edge: { color: rgba(SK.sss, 0.45), width: 22, blur: 9 } },
    { blob: { x: 4, y: -356, rx: 52, ry: 22, color: rgba('#9d4f43', 0.6) } },          // chin shadow on the neck
    { blob: { x: 32, y: -370, rx: 12, ry: 40, color: rgba(SK.sh, 0.45) } },
    { blob: { x: -56, y: -318, rx: 30, ry: 6, color: rgba(SK.sh, 0.35) } },           // collarbones
    { blob: { x: 56, y: -318, rx: 30, ry: 6, color: rgba(SK.sh, 0.35) } },
    ...(sex === 'male'
      ? [{ blob: { x: 0, y: -350, rx: 7, ry: 9, color: rgba(SK.sh, 0.35) } },          // adam's apple
         { blob: { x: -46, y: -232, rx: 40, ry: 14, color: rgba(SK.sh, 0.3) } }, { blob: { x: 46, y: -232, rx: 40, ry: 14, color: rgba(SK.sh, 0.35) } }]   // pec line
      : [{ blob: { x: -40, y: -170, rx: 34, ry: 10, color: rgba(SK.sh, 0.35) } }, { blob: { x: 40, y: -170, rx: 34, ry: 10, color: rgba(SK.sh, 0.4) } }]),
    { blob: { x: 0, y: -60, rx: 4, ry: 5, color: rgba(SK.deep, 0.35) } },             // navel
    { edge: { color: rgba('#ffe8dc', 0.5), width: 4, blur: 1.5, dx: -3 } },
  ]);
  grain(t, 0.02, sex === 'male' ? 19 : 17);
  t.height = { dome: 60, str: 1.0, aoR: 10 };
  return t;
}
function legSkin() {
  const t = tex(-62, -40, 62, 430, 1.8), path = tube((y) => legHW(y) * (0.5 + 0.5 * sm((y + 40) / 80)), -40, 425, 1);
  volume(t, path, rgba(SK.base), [
    { grad: { x0: -50, y0: 0, x1: 50, y1: 0, stops: [[0, rgba(SK.sh, 0.3)], [0.25, rgba('#fff1e8', 0.55)], [0.45, rgba('#ffffff', 0)], [0.75, rgba(SK.sh, 0.4)], [1, rgba(SK.sss, 0.6)]] } },
    { edge: { color: rgba(SK.sss, 0.4), width: 12, blur: 5 } },
    { blob: { x: -4, y: 208, rx: 16, ry: 12, color: rgba(SK.sh, 0.3) } },            // knee
    { blob: { x: -8, y: 300, rx: 8, ry: 50, color: rgba('#ffece2', 0.35) } },          // shin highlight
  ]);
  grain(t, 0.02, 23);
  t.height = { dome: 40, str: 1.0 };
  return t;
}

// the film's halter (kept as painted for the heroine)
// ---------------------------------------------------------------- tops (torso space)
function topTexture(kind, sex) {
  const t = tex(-150, -435, 150, 90, 2), g = t.g, F = sex === 'female';
  const bust = F ? [
    { blob: { x: -40, y: -200, rx: 34, ry: 40, color: rgba(CL.hi, 0.55) } },
    { blob: { x: 42, y: -196, rx: 30, ry: 38, color: rgba(CL.mid, 0.3) } },
    { blob: { x: -38, y: -158, rx: 32, ry: 8, color: rgba(CL.deep, 0.55) } },
    { blob: { x: 38, y: -158, rx: 32, ry: 8, color: rgba(CL.deep, 0.6) } },
  ] : [{ blob: { x: -46, y: -236, rx: 42, ry: 26, color: rgba(CL.hi, 0.35) } }, { blob: { x: 0, y: -206, rx: 70, ry: 10, color: rgba(CL.sh, 0.3) } }];
  const hemY = kind === 'crop' ? -110 : kind === 'hoodie' ? 40 : 20;
  // garment outline = body outline (optionally loosened) cut at the neckline and hem
  const loose = { halter: 0, tank: 1, tee: 4, shirt: 5, hoodie: 10 }[kind] ?? 3;
  const body = torsoPath(loose, 80);
  const cut = P(p => {
    if (kind === 'halter') {   // the film's halter: collar band, deep armholes, side cutouts
      p.moveTo(-46, -318); p.lineTo(46, -318); p.bezierCurveTo(58, -290, 76, -246, 98, -214); p.bezierCurveTo(100, -170, 94, -132, 84, -112);
      p.bezierCurveTo(64, -100, 54, -86, 54, -70); p.bezierCurveTo(54, -54, 62, -44, 74, -40); p.bezierCurveTo(90, -34, 98, -26, 104, -12);
      p.lineTo(104, hemY); p.lineTo(-104, hemY); p.lineTo(-104, -12);
      p.bezierCurveTo(-98, -26, -90, -34, -74, -40); p.bezierCurveTo(-62, -44, -54, -54, -54, -70); p.bezierCurveTo(-54, -86, -64, -100, -84, -112);
      p.bezierCurveTo(-94, -132, -100, -170, -98, -214); p.bezierCurveTo(-76, -246, -58, -290, -46, -318); p.closePath();
    } else if (kind === 'tank') {
      p.moveTo(-40, -322); p.bezierCurveTo(-30, -270, 30, -270, 40, -322); p.lineTo(62, -322); p.bezierCurveTo(70, -280, 84, -240, 108, -214);
      p.lineTo(140, hemY); p.lineTo(-140, hemY); p.lineTo(-108, -214); p.bezierCurveTo(-84, -240, -70, -280, -62, -322); p.closePath();
    } else if (kind === 'shirt') {
      p.moveTo(-34, -352); p.lineTo(-6, -300); p.lineTo(6, -300); p.lineTo(34, -352); p.lineTo(170, -352); p.lineTo(170, hemY); p.lineTo(-170, hemY); p.lineTo(-170, -352); p.closePath();
    } else {                   // tee / hoodie: round neck
      p.moveTo(-42, -334); p.bezierCurveTo(-34, -300, 34, -300, 42, -334); p.lineTo(170, -352); p.lineTo(170, hemY); p.lineTo(-170, hemY); p.lineTo(-170, -352); p.closePath();
    }
  });
  g.save(); g.clip(cut);
  const shirtBase = kind === 'halter' ? '#d8d6dc' : CL.base;
  volume(t, body, shirtBase, [
    ...clothPasses(-130, 130),
    ...bust,
    ...(kind === 'halter' ? [{ blob: { x: -56, y: -210, rx: 10, ry: 40, color: rgba('#ffffff', 0.7) } }] : []),   // satin streak
    { blob: { x: 0, y: hemY - 6, rx: 140, ry: 10, color: rgba(CL.ao, 0.4) } },
  ]);
  g.restore();
  // details
  if (kind === 'tee' || kind === 'hoodie') {
    stroke(g, [[-42, -332], [-34, -302], [34, -302], [42, -332]], 6, rgba(CL.sh, 0.9));   // ribbed neckband
    stroke(g, [[-40, -330], [-32, -304], [32, -304], [40, -330]], 1.5, rgba('#ffffff', 0.7));
    for (const s of [-1, 1]) stroke(g, [[s * 70, -250], [s * 84, -180], [s * 88, -110], [s * 90, -40]], 2.5, rgba(CL.sh, 0.5), 2); // drape folds
  }
  if (kind === 'hoodie') {
    // hood bunched behind the neck, drawstrings, kangaroo pocket, ribbed hem
    const hood = P(p => { p.moveTo(-80, -330); p.bezierCurveTo(-70, -380, 70, -380, 80, -330); p.bezierCurveTo(60, -316, 46, -330, 42, -334); p.bezierCurveTo(30, -350, -30, -350, -42, -334); p.bezierCurveTo(-46, -330, -60, -316, -80, -330); p.closePath(); });
    volume(t, hood, CL.mid, [{ edge: { color: rgba(CL.ao, 0.6), width: 8, blur: 3 } }, { blob: { x: -30, y: -352, rx: 30, ry: 10, color: rgba(CL.hi, 0.5) } }]);
    for (const s of [-1, 1]) { stroke(g, [[s * 14, -306], [s * 16, -270], [s * 13, -240], [s * 15, -214]], 2.6, rgba(CL.hi, 0.95)); g.fillStyle = rgba(CL.deep, 1); g.beginPath(); g.ellipse(s * 15, -212, 2.6, 4, 0, 0, 7); g.fill(); }
    const pocket = P(p => { p.moveTo(-62, -70); p.lineTo(62, -70); p.lineTo(78, 6); p.lineTo(-78, 6); p.closePath(); });
    volume(t, pocket, CL.base, [{ edge: { color: rgba(CL.ao, 0.55), width: 6, blur: 2 } }, { grad: { x0: 0, y0: -70, x1: 0, y1: 6, stops: [[0, rgba(CL.deep, 0.35)], [0.3, rgba(CL.base, 0)]] } }]);
    for (let i = -6; i <= 6; i++) stroke(g, [[i * 17, 22], [i * 17, 40]], 1.2, rgba(CL.sh, 0.6));
  }
  if (kind === 'shirt') {
    // placket with buttons, pointed collar, breast pocket
    stroke(g, [[0, -300], [0, hemY]], 14, rgba(CL.hi, 0.35)); stroke(g, [[-7, -300], [-7, hemY]], 1.2, rgba(CL.sh, 0.8)); stroke(g, [[7, -300], [7, hemY]], 1.2, rgba(CL.sh, 0.8));
    for (let y = -280; y < hemY - 10; y += 46) { g.fillStyle = rgba(CL.deep, 0.9); g.beginPath(); g.arc(0, y, 3.4, 0, 7); g.fill(); g.fillStyle = rgba('#ffffff', 0.8); g.beginPath(); g.arc(-0.8, y - 0.8, 1.2, 0, 7); g.fill(); }
    for (const s of [-1, 1]) {
      const col = P(p => { p.moveTo(s * 2, -304); p.lineTo(s * 36, -356); p.lineTo(s * 56, -334); p.lineTo(s * 30, -282); p.closePath(); });
      volume(t, col, CL.hi, [{ edge: { color: rgba(CL.ao, 0.6), width: 4, blur: 1.5 } }]);
    }
    const pk = P(p => p.roundRect(-74, -236, 34, 38, [2, 2, 8, 8])); volume(t, pk, CL.base, [{ edge: { color: rgba(CL.deep, 0.6), width: 3, blur: 1 } }]);
    for (const s of [-1, 1]) stroke(g, [[s * 60, -200], [s * 78, -140], [s * 70, -80], [s * 80, -20]], 2.5, rgba(CL.sh, 0.45), 2);
  }
  if (kind === 'tank') { for (const s of [-1, 1]) { stroke(g, [[s * 40, -322], [s * 30, -280], [s * 0, -272], [s * 0, -272]], 3, rgba(CL.sh, 0.8)); } stroke(g, [[-140, hemY - 2], [140, hemY - 2]], 4, rgba(CL.sh, 0.6)); }
  if (kind === 'halter') {   // collar band of the halter
    const collar = P(p => { p.moveTo(-47, -334); p.bezierCurveTo(-20, -340, 20, -340, 47, -334); p.lineTo(48, -312); p.bezierCurveTo(20, -306, -20, -306, -48, -312); p.closePath(); });
    volume(t, collar, CL.mid, [{ grad: { x0: 0, y0: -338, x1: 0, y1: -308, stops: [[0, rgba('#ffffff', 0.5)], [1, rgba(CL.ao, 0.6)]] } }]);
  }
  grain(t, 0.018, 31 + kind.length);
  t.height = { dome: kind === 'hoodie' ? 70 : 55, str: 1.0, aoR: 10, detail: kind === 'hoodie' ? 2 : 1, detailBlur: 3 };
  return t;
}

// sneaker in foot space (same box as the film boot)
function sneaker() {
  const t = tex(-40, -40, 70, 56, 3), g = t.g;
  const sh = P(p => { p.moveTo(-22, -14); p.lineTo(18, -14); p.bezierCurveTo(24, 0, 34, 8, 52, 14); p.bezierCurveTo(66, 20, 68, 34, 64, 40); p.lineTo(-30, 42); p.bezierCurveTo(-32, 20, -30, 0, -22, -14); p.closePath(); });
  volume(t, sh, CL.base, [{ grad: { x0: 0, y0: -14, x1: 0, y1: 40, stops: [[0, rgba(CL.hi, 0.5)], [1, rgba(CL.sh, 0.5)]] } }, { edge: { color: rgba(CL.ao, 0.6), width: 5, blur: 2 } }]);
  g.fillStyle = '#f4f2ee'; g.fillRect(-32, 32, 100, 11); g.fillStyle = rgba('#8c8a90', 1); g.fillRect(-32, 41, 100, 3);   // white midsole
  g.strokeStyle = rgba(CL.deep, 0.8); g.lineWidth = 1.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(6 + i * 9, -6 + i * 6); g.lineTo(20 + i * 9, -2 + i * 6); g.stroke(); }
  stroke(g, [[-14, 24], [10, 8], [30, 18], [50, 28]], 3, rgba(CL.ao, 0.6));   // side swoosh panel
  t.height = { dome: 12, str: 1.0 };
  return t;
}

// ---------------------------------------------------------------- garment framework
// Body half-width at torso-space height y (the torsoPath silhouette, sampled) — used to fit skirts.
const BODY_HW = [[-432, 40], [-340, 46], [-330, 52], [-310, 118], [-270, 134], [-214, 104], [-150, 96], [-96, 78], [-66, 74], [-40, 86], [-12, 102], [8, 110], [32, 108], [54, 96], [80, 60]];
function bodyHW(y) {
  if (y <= BODY_HW[0][0]) return BODY_HW[0][1];
  for (let i = 1; i < BODY_HW.length; i++) if (y <= BODY_HW[i][0]) { const [y0, a] = BODY_HW[i - 1], [y1, b] = BODY_HW[i], t = (y - y0) / (y1 - y0); return a + (b - a) * t; }
  return BODY_HW[BODY_HW.length - 1][1];
}
const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const rect = (x, y, w, h) => P(p => p.rect(x, y, w, h));
const above = (y) => rect(-300, -600, 600, y + 600);
const below = (y) => rect(-300, y, 600, 600);
const mirror2 = (fn) => P(p => { fn(p, 1); fn(p, -1); });

// neck openings: the region removed above / inside the neckline (fabric never covers the neck)
const NECK = {
  crew: () => P(p => { p.moveTo(-70, -470); p.lineTo(-70, -346); p.lineTo(-46, -334); p.bezierCurveTo(-38, -300, 38, -300, 46, -334); p.lineTo(70, -346); p.lineTo(70, -470); p.closePath(); }),
  scoop: () => P(p => { p.moveTo(-80, -470); p.lineTo(-80, -340); p.lineTo(-60, -330); p.bezierCurveTo(-50, -262, 50, -262, 60, -330); p.lineTo(80, -340); p.lineTo(80, -470); p.closePath(); }),
  v: () => P(p => { p.moveTo(-70, -470); p.lineTo(-70, -346); p.lineTo(-46, -334); p.bezierCurveTo(-30, -300, -8, -262, 0, -246); p.bezierCurveTo(8, -262, 30, -300, 46, -334); p.lineTo(70, -346); p.lineTo(70, -470); p.closePath(); }),
  deepv: () => P(p => { p.moveTo(-70, -470); p.lineTo(-70, -346); p.lineTo(-50, -334); p.bezierCurveTo(-34, -280, -10, -210, 0, -190); p.bezierCurveTo(10, -210, 34, -280, 50, -334); p.lineTo(70, -346); p.lineTo(70, -470); p.closePath(); }),
  square: () => P(p => { p.moveTo(-70, -470); p.lineTo(-70, -340); p.lineTo(-54, -330); p.lineTo(-54, -264); p.quadraticCurveTo(0, -256, 54, -264); p.lineTo(54, -330); p.lineTo(70, -340); p.lineTo(70, -470); p.closePath(); }),
  boat: () => P(p => { p.moveTo(-160, -470); p.lineTo(-160, -322); p.lineTo(-96, -320); p.bezierCurveTo(-50, -304, 50, -304, 96, -320); p.lineTo(160, -322); p.lineTo(160, -470); p.closePath(); }),
  opencollar: () => P(p => { p.moveTo(-70, -470); p.lineTo(-70, -350); p.lineTo(-36, -352); p.bezierCurveTo(-22, -310, -8, -280, 0, -262); p.bezierCurveTo(8, -280, 22, -310, 36, -352); p.lineTo(70, -350); p.lineTo(70, -470); p.closePath(); }),
  collar: () => P(p => { p.moveTo(-70, -470); p.lineTo(-70, -350); p.lineTo(-34, -352); p.lineTo(-6, -300); p.lineTo(6, -300); p.lineTo(34, -352); p.lineTo(70, -350); p.lineTo(70, -470); p.closePath(); }),
  placket: () => P(p => { p.moveTo(-70, -470); p.lineTo(-70, -346); p.lineTo(-44, -336); p.bezierCurveTo(-36, -306, 36, -306, 44, -336); p.lineTo(70, -346); p.lineTo(70, -470); p.closePath(); }),
  turtle: () => above(-404),
  off: () => above(-262),       // off-shoulder: straight edge across the upper chest
  tube: () => above(-234),      // strapless: edge above the bust
  strap: () => above(-252),     // camisole: straps are drawn on afterwards
};
// sleeveless armholes (removed from the shoulder sides)
const ARMHOLE = {
  tank: () => mirror2((p, s) => { p.moveTo(s * 62, -470); p.lineTo(s * 62, -322); p.bezierCurveTo(s * 70, -280, s * 84, -240, s * 108, -214); p.lineTo(s * 200, -214); p.lineTo(s * 200, -470); p.closePath(); }),
  racer: () => mirror2((p, s) => { p.moveTo(s * 48, -470); p.lineTo(s * 48, -330); p.bezierCurveTo(s * 54, -284, s * 74, -238, s * 106, -212); p.lineTo(s * 200, -212); p.lineTo(s * 200, -470); p.closePath(); }),
};
// fabric patterns, painted in greys under the shading (the dye tints them)
const PATTERN = {
  plaid: (g) => {
    for (let x = -200; x < 200; x += 44) { g.fillStyle = rgba('#6f6b76', 0.42); g.fillRect(x, -480, 16, 700); g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(x + 22, -480, 3, 700); }
    for (let y = -480; y < 300; y += 44) { g.fillStyle = rgba('#6f6b76', 0.36); g.fillRect(-200, y, 400, 16); g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(-200, y + 22, 400, 3); }
  },
  stripes: (g) => { for (let y = -480; y < 300; y += 24) { g.fillStyle = rgba('#5e5a66', 0.6); g.fillRect(-300, y, 600, 10); } },
  knit: (g) => { for (let x = -200; x < 200; x += 7) { g.fillStyle = rgba('#8e8a96', 0.22); g.fillRect(x, -480, 2.4, 800); } },
  floral: (g) => {
    const r = rng(91);
    for (let i = 0; i < 260; i++) {
      const x = (r() - 0.5) * 420, y = -460 + r() * 760, s = 4 + r() * 3;
      g.fillStyle = rgba('#7a7682', 0.5);
      for (let k = 0; k < 5; k++) { const a = k * 1.2566 + r(); g.beginPath(); g.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.7, s * 0.45, a, 0, 7); g.fill(); }
      g.fillStyle = rgba('#ffffff', 0.55); g.beginPath(); g.arc(x, y, s * 0.35, 0, 7); g.fill();
    }
  },
  denim: (g) => { const r = rng(5); for (let i = 0; i < 2600; i++) { const x = (r() - 0.5) * 420, y = -480 + r() * 800; g.strokeStyle = rgba(r() < 0.5 ? '#ffffff' : '#7a7682', 0.18); g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y - 5); g.stroke(); } },
  rib: (g) => { for (let x = -200; x < 200; x += 5) { g.fillStyle = rgba('#8e8a96', 0.3); g.fillRect(x, -480, 2, 800); } },
};
const patternPass = (name) => name ? [{ fn: { fn: (g) => PATTERN[name](g) } }] : [];
const bustPasses = (k = 1) => [
  { blob: { x: -40, y: -200, rx: 34, ry: 40, color: rgba(CL.hi, 0.55 * k) } },
  { blob: { x: 42, y: -196, rx: 30, ry: 38, color: rgba(CL.mid, 0.3 * k) } },
  { blob: { x: -38, y: -158, rx: 32, ry: 8, color: rgba(CL.deep, 0.55 * k) } },
  { blob: { x: 38, y: -158, rx: 32, ry: 8, color: rgba(CL.deep, 0.6 * k) } },
];
const chestPasses = [{ blob: { x: -46, y: -236, rx: 42, ry: 26, color: rgba(CL.hi, 0.35) } }, { blob: { x: 0, y: -206, rx: 70, ry: 10, color: rgba(CL.sh, 0.3) } }];
const button = (g, x, y, r = 3.2) => { g.fillStyle = rgba(CL.deep, 0.95); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = rgba('#ffffff', 0.75); g.beginPath(); g.arc(x - 0.8, y - 0.8, r * 0.35, 0, 7); g.fill(); };
const fold = (g, pts, w = 2.5, a = 0.45, col = CL.sh) => stroke(g, pts, w, rgba(col, a), w * 0.8);
const band = (g, path, base = CL.mid, o = {}) => volume({ g, D: g.getTransform().a }, path, base, [{ edge: { color: rgba(CL.ao, o.edge ?? 0.55), width: 4, blur: 1.5, keep: true } }, ...(o.passes || [])]);

// Torso-space garment. o: neck (NECK key), arm (ARMHOLE key | null = covers the shoulders), hem (y), loose,
// pattern, bust (0..1 strength of the bust shading), open (front opening path fn for jackets),
// details(g, F) painted on the fabric only, over(g, F) painted on top (collars, straps, ruffles)
function torsoGarment(o, sex) {
  const F = sex === 'f', t = tex(-150, -435, 150, 90, 1.2), g = t.g;
  // sleeved tops round over the deltoid (the sleeve continues below it); sleeveless cuts keep the body's shoulder
  const sleeveless = !!o.arm || ['off', 'tube', 'strap'].includes(o.neck);
  const body = torsoPath(o.loose ?? 3, 80, o.deltoid ?? (sleeveless ? 0 : 9));
  volume(t, body, o.base || CL.base, [
    ...patternPass(o.pattern),
    ...clothPasses(-130, 130, { rim: false }),
    ...(F ? bustPasses(o.bust ?? 1) : chestPasses),
    ...(sleeveless ? [] : [-1, 1].map(sx => ({ blob: { x: sx * 120, y: -284, rx: 26, ry: 30, color: rgba(sx < 0 ? CL.hi : CL.sh, 0.35) } }))),   // round deltoid form
    { blob: { x: 0, y: (o.hem ?? 20) - 6, rx: 140, ry: 10, color: rgba(CL.ao, 0.35) } },
  ]);
  g.save(); g.globalCompositeOperation = 'destination-out';
  if (o.neck) g.fill(NECK[o.neck]());
  if (o.arm) g.fill(ARMHOLE[o.arm]());
  if (o.hem !== undefined && o.hem < 78) {
    const h = o.hem, L0 = o.loose ?? 3;
    // hem dips a little at the centre front instead of a ruler-straight line
    g.fill(P(p => { p.moveTo(-300, h + 500); p.lineTo(-300, h); for (let x = -300; x <= 300; x += 10) p.lineTo(x, h + 7 * Math.cos(Math.min(1, Math.abs(x) / 140) * Math.PI / 2)); p.lineTo(300, h + 500); p.closePath(); }));
    // loose tops narrow back to the body over the last 70 units so they don't step out over the trousers
    if (L0 > 1.5) for (let k = 1; k <= 7; k++) {
      g.save(); g.clip(below(h - 70 + k * 10)); g.fill(P(p => { p.rect(-300, -600, 600, 1400); p.addPath(torsoPath(L0 - (L0 - 1.2) * k / 7, 80)); }), 'evenodd'); g.restore();
    }
  } else if (o.hem !== undefined) g.fill(below(o.hem));
  if (o.open) g.fill(o.open());
  g.restore();
  g.save(); g.globalCompositeOperation = 'source-atop'; if (o.details) o.details(g, F, t);
  if (o.hem !== undefined && o.hem < 78) {   // the hem rolls under: a lit fold just above it, a shadowed lip at the edge
    stroke(g, [[-150, o.hem - 12], [-50, o.hem - 7], [50, o.hem - 7], [150, o.hem - 12]], 7, rgba(CL.hi, 0.35), 4);
    stroke(g, [[-150, o.hem - 1], [-50, o.hem + 5], [50, o.hem + 5], [150, o.hem - 1]], 4, rgba(CL.ao, 0.45), 2);
  }
  g.restore();
  if (o.hem !== undefined && o.hem < 70 && !o.noTuckShadow) {   // soft shadow the top casts onto the trousers / skin below it
    g.save(); g.clip(torsoPath(1, 80)); g.clip(rect(-300, o.hem - 2, 600, 22));
    const gr = g.createLinearGradient(0, o.hem, 0, o.hem + 18); gr.addColorStop(0, rgba('#000000', 0.32)); gr.addColorStop(1, rgba('#000000', 0));
    g.fillStyle = gr; g.fillRect(-300, o.hem - 2, 600, 24); g.restore();
  }
  if (o.over) o.over(g, F, t);
  grain(t, 0.007, 31 + (o.seed || 0));   // light grain: heavy noise mostly costs file size at this scale
  t.height = { dome: o.dome ?? 55, str: 1.0, aoR: 10, detail: (o.detailN ?? 1) * 0.7, detailBlur: 3 };
  return t;
}
const tightNeckband = (g, w = 6) => { stroke(g, [[-46, -334], [-38, -300], [38, -300], [46, -334]], w, rgba(CL.sh, 0.9)); stroke(g, [[-44, -332], [-36, -303], [36, -303], [44, -332]], 1.4, rgba('#ffffff', 0.6)); };
const sideFolds = (g) => { for (const s of [-1, 1]) { fold(g, [[s * 70, -250], [s * 84, -180], [s * 88, -110], [s * 90, -40]]); fold(g, [[s * 30, -120], [s * 40, -80], [s * 36, -40], [s * 42, 0]], 2, 0.3); } };
const ribHem = (g, y, w = 18) => { for (let x = -150; x <= 150; x += 6) stroke(g, [[x, y - w], [x, y]], 1.2, rgba(CL.sh, 0.55)); stroke(g, [[-150, y - w], [150, y - w]], 1.5, rgba(CL.deep, 0.5)); };
const shirtCollar = (g, spread = 1, open = false) => { for (const s of [-1, 1]) { const col = open ? P(p => { p.moveTo(s * 4, -266); p.lineTo(s * 38, -360); p.lineTo(s * (60 + 10 * spread), -340); p.lineTo(s * 40, -300); p.closePath(); }) : P(p => { p.moveTo(s * 2, -304); p.lineTo(s * 36, -358); p.lineTo(s * (56 + 10 * spread), -336); p.lineTo(s * 30, -280); p.closePath(); }); volume({ g, D: g.getTransform().a }, col, CL.hi, [{ edge: { color: rgba(CL.ao, 0.6), width: 4, blur: 1.5, keep: true } }, { blob: { x: s * 30, y: -320, rx: 14, ry: 20, color: rgba(CL.sh, 0.3), keep: true } }]); } };
const buttonPlacket = (g, y0, y1, step = 46) => { stroke(g, [[0, y0], [0, y1]], 14, rgba(CL.hi, 0.3)); stroke(g, [[-7, y0], [-7, y1]], 1.2, rgba(CL.sh, 0.8)); stroke(g, [[7, y0], [7, y1]], 1.2, rgba(CL.sh, 0.8)); for (let y = y0 + 18; y < y1 - 8; y += step) button(g, 0, y); };
const straps = (g, x0 = 48, y0 = -252, w = 6) => { for (const s of [-1, 1]) { stroke(g, [[s * x0, y0], [s * (x0 + 6), -290], [s * (x0 + 14), -316], [s * (x0 + 18), -330]], w, rgba(CL.sh, 1)); stroke(g, [[s * x0, y0], [s * (x0 + 6), -290], [s * (x0 + 14), -316], [s * (x0 + 18), -330]], w * 0.35, rgba('#ffffff', 0.6)); } };
const edgeLine = (g, pts, w = 4) => { stroke(g, pts, w, rgba(CL.sh, 0.85)); stroke(g, pts.map(([x, y]) => [x, y + w * 0.4]), 1.2, rgba('#ffffff', 0.6)); };
const ruffle = (g, y, x0, x1, h = 16) => {
  const path = P(p => { p.moveTo(x0, y - 4); for (let x = x0; x <= x1; x += 12) p.quadraticCurveTo(x + 6, y - 8, x + 12, y - 4); for (let x = x1; x >= x0; x -= 12) p.quadraticCurveTo(x - 6, y + h + 6, x - 12, y + h); p.closePath(); });
  volume({ g, D: g.getTransform().a }, path, CL.base, [{ edge: { color: rgba(CL.ao, 0.5), width: 4, blur: 1.5, keep: true } }, ...Array.from({ length: Math.ceil((x1 - x0) / 12) }, (_, i) => ({ blob: { x: x0 + i * 12 + 6, y: y + h * 0.6, rx: 3, ry: h * 0.6, color: rgba(CL.sh, 0.5), keep: true } }))]);
};

// ---------------------------------------------------------------- tops (torso space)
const TOPS = {
  // unisex basics
  tank: { neck: 'scoop', arm: 'tank', hem: 20, loose: 1, details: (g) => { stroke(g, [[-140, 16], [140, 16]], 4, rgba(CL.sh, 0.6)); sideFolds(g); },
    over: (g) => { for (const s of [-1, 1]) edgeLine(g, [[s * 60, -330], [s * 50, -290], [s * 20, -266], [0, -264]], 3); } },
  tee: { neck: 'crew', hem: 20, loose: 4, details: (g) => { tightNeckband(g); sideFolds(g); stroke(g, [[-140, 14], [140, 14]], 2, rgba(CL.sh, 0.6)); } },
  stripe: { neck: 'boat', hem: 20, loose: 4, pattern: 'stripes', details: (g) => { sideFolds(g); } },
  shirt: { neck: 'opencollar', hem: 26, loose: 5, details: (g) => { buttonPlacket(g, -262, 26); const pk = P(p => p.roundRect(-74, -236, 34, 38, [2, 2, 8, 8])); g.strokeStyle = rgba(CL.deep, 0.6); g.lineWidth = 2; g.stroke(pk); for (const s of [-1, 1]) fold(g, [[s * 60, -200], [s * 78, -140], [s * 70, -80], [s * 80, -20]]); }, over: (g) => shirtCollar(g, 1, true) },
  flannel: { neck: 'collar', hem: 26, loose: 7, pattern: 'plaid', details: (g) => { buttonPlacket(g, -300, 26); for (const s of [-1, 1]) { const pk = P(p => p.roundRect(s > 0 ? 34 : -74, -244, 40, 44, [2, 2, 8, 8])); g.strokeStyle = rgba(CL.deep, 0.7); g.lineWidth = 2; g.stroke(pk); button(g, s * 54, -236, 2.4); fold(g, [[s * 60, -200], [s * 80, -140], [s * 74, -80], [s * 86, -20]]); } }, over: (g) => shirtCollar(g) },
  hoodie: { neck: 'crew', hem: 40, loose: 6, dome: 70, detailN: 2,
    details: (g) => { tightNeckband(g, 7); sideFolds(g); ribHem(g, 40);
      const pocket = P(p => { p.moveTo(-62, -70); p.lineTo(62, -70); p.lineTo(80, 8); p.lineTo(-80, 8); p.closePath(); });
      g.save(); g.clip(pocket); g.fillStyle = rgba(CL.deep, 0.15); g.fillRect(-90, -72, 180, 20); g.restore(); g.strokeStyle = rgba(CL.ao, 0.7); g.lineWidth = 2.5; g.stroke(pocket);
      stroke(g, [[-62, -70], [-74, -30], [-78, 0]], 4, rgba(CL.ao, 0.35), 2); stroke(g, [[62, -70], [74, -30], [78, 0]], 4, rgba(CL.ao, 0.35), 2); },
    over: (g) => { for (const s of [-1, 1]) { stroke(g, [[s * 16, -304], [s * 18, -270], [s * 14, -238], [s * 17, -208]], 2.8, rgba(CL.hi, 0.95)); g.fillStyle = rgba(CL.deep, 1); g.beginPath(); g.ellipse(s * 17, -206, 2.8, 4.2, 0, 0, 7); g.fill(); } } },
  sweater: { neck: 'crew', hem: 34, loose: 5, pattern: 'knit', dome: 65, detailN: 1.5, details: (g) => { tightNeckband(g, 9); ribHem(g, 34, 22); sideFolds(g); } },
  polo: { neck: 'placket', hem: 22, loose: 4, details: (g) => { stroke(g, [[0, -306], [0, -236]], 12, rgba(CL.hi, 0.3)); stroke(g, [[-6, -306], [-6, -236], [6, -236], [6, -306]], 1.2, rgba(CL.sh, 0.8)); button(g, 0, -290, 2.6); button(g, 0, -260, 2.6); sideFolds(g); stroke(g, [[-140, 18], [140, 18]], 2, rgba(CL.sh, 0.6)); },
    over: (g) => { for (const s of [-1, 1]) { const col = P(p => { p.moveTo(s * 4, -306); p.lineTo(s * 40, -352); p.lineTo(s * 64, -330); p.lineTo(s * 36, -296); p.closePath(); }); volume({ g, D: g.getTransform().a }, col, CL.hi, [{ edge: { color: rgba(CL.ao, 0.6), width: 4, blur: 1.5, keep: true } }]); } } },
  henley: { neck: 'placket', hem: 24, loose: 4, pattern: 'rib', details: (g) => { tightNeckband(g, 6); stroke(g, [[0, -304], [0, -226]], 12, rgba(CL.hi, 0.35)); stroke(g, [[-6, -304], [-6, -226], [6, -226], [6, -304]], 1.2, rgba(CL.sh, 0.8)); for (const y of [-290, -266, -242]) button(g, 0, y, 2.4); sideFolds(g); } },
  // women
  crop: { neck: 'crew', hem: -112, loose: 2, bust: 1.1, details: (g) => { tightNeckband(g); stroke(g, [[-120, -116], [120, -116]], 2, rgba(CL.sh, 0.7)); } },
  cami: { neck: 'strap', arm: 'racer', hem: 14, loose: 2, bust: 1.2, base: '#dcdae0', details: (g) => { fold(g, [[-60, -160], [-50, -100], [-56, -40], [-48, 10]], 3, 0.35); fold(g, [[50, -150], [58, -90], [52, -30], [60, 10]], 3, 0.35); },
    over: (g) => { edgeLine(g, [[-60, -254], [-30, -244], [30, -244], [60, -254]], 3); straps(g, 48, -252, 5); } },
  offshoulder: { neck: 'off', hem: 18, loose: 6, bust: 1, details: (g) => { sideFolds(g); for (let x = -90; x <= 90; x += 30) fold(g, [[x, -240], [x * 1.05, -200], [x * 1.1, -160], [x * 1.1, -130]], 2, 0.3); }, over: (g) => ruffle(g, -270, -140, 140, 22) },
  blouse: { neck: 'v', hem: 26, loose: 9, bust: 0.8, details: (g) => { for (let x = -80; x <= 80; x += 26) fold(g, [[x * 0.6, -300], [x * 0.9, -220], [x, -120], [x * 1.1, 20]], 2.2, 0.32); stroke(g, [[-140, -100], [-40, -112], [40, -112], [140, -100]], 3, rgba(CL.sh, 0.5), 2); },
    over: (g) => { for (const s of [-1, 1]) edgeLine(g, [[s * 46, -334], [s * 30, -300], [s * 8, -262], [0, -246]], 3); } },
  tube: { neck: 'tube', arm: 'tank', hem: 4, loose: 1, bust: 1.3, details: (g) => { for (let y = -220; y < 0; y += 18) stroke(g, [[-130, y], [-40, y + 4], [40, y + 4], [130, y]], 1.6, rgba(CL.sh, 0.45)); }, over: (g) => edgeLine(g, [[-110, -236], [-40, -240], [40, -240], [110, -236]], 4) },
  fitted: { neck: 'scoop', hem: 22, loose: 0.5, pattern: 'rib', bust: 1.2, details: (g) => { stroke(g, [[-60, -330], [-50, -262], [50, -262], [60, -330]], 5, rgba(CL.sh, 0.8)); } },
  vtee: { neck: 'v', hem: 20, loose: 3, details: (g) => { stroke(g, [[-46, -334], [-20, -290], [-4, -252], [0, -246]], 5, rgba(CL.sh, 0.85)); stroke(g, [[46, -334], [20, -290], [4, -252], [0, -246]], 5, rgba(CL.sh, 0.85)); sideFolds(g); } },
  turtle: { neck: 'turtle', hem: 26, loose: 1, pattern: 'rib', bust: 1.1, details: (g) => { ribHem(g, 26, 14); },
    over: (g) => { const tn = P(p => { p.moveTo(-46, -408); p.lineTo(46, -408); p.lineTo(48, -330); p.bezierCurveTo(20, -322, -20, -322, -48, -330); p.closePath(); }); band(g, tn, CL.base, { passes: [{ fn: { fn: (gg) => PATTERN.rib(gg) } }, { grad: { x0: -48, y0: 0, x1: 48, y1: 0, stops: [[0, rgba(CL.sh, 0.5)], [0.3, rgba(CL.hi, 0.4)], [1, rgba(CL.deep, 0.6)]], keep: true } }] }); } },
  // outerwear (z 40): open fronts over another top
  cardigan: { neck: 'v', hem: 30, loose: 6, pattern: 'knit', dome: 60, open: () => P(p => { p.moveTo(-26, -320); p.lineTo(-10, -180); p.lineTo(-20, 60); p.lineTo(20, 60); p.lineTo(10, -180); p.lineTo(26, -320); p.closePath(); }),
    details: (g) => { ribHem(g, 30, 16); for (const s of [-1, 1]) { stroke(g, [[s * 36, -330], [s * 12, -180], [s * 18, 30]], 10, rgba(CL.mid, 0.9)); for (let y = -240; y < 20; y += 50) button(g, s < 0 ? -18 : 999, y, 3); } } },
  denimjacket: { neck: 'collar', hem: 6, loose: 6, pattern: 'denim', dome: 60, open: () => P(p => { p.moveTo(-14, -300); p.lineTo(-14, 60); p.lineTo(14, 60); p.lineTo(14, -300); p.closePath(); }),
    details: (g) => { for (const s of [-1, 1]) { stroke(g, [[s * 22, -300], [s * 22, 6]], 2, rgba('#b89a64', 0.9)); stroke(g, [[s * 20, -196], [s * 120, -206]], 2, rgba('#b89a64', 0.9));
      const flap = P(p => { p.moveTo(s * 34, -250); p.lineTo(s * 84, -250); p.lineTo(s * 84, -218); p.lineTo(s * 59, -206); p.lineTo(s * 34, -218); p.closePath(); }); g.strokeStyle = rgba('#b89a64', 0.95); g.lineWidth = 1.6; g.stroke(flap); button(g, s * 59, -216, 2.6);
      for (let y = -260; y < 0; y += 54) button(g, s * 24, y, 3); } stroke(g, [[-150, -10], [150, -10]], 22, rgba(CL.sh, 0.35)); stroke(g, [[-150, -22], [150, -22]], 1.6, rgba('#b89a64', 0.9)); },
    over: (g) => shirtCollar(g, 1.6) },
  blazer: { neck: 'deepv', hem: 46, loose: 6, dome: 60, open: () => P(p => { p.moveTo(-40, -330); p.lineTo(0, -120); p.lineTo(-30, 60); p.lineTo(30, 60); p.lineTo(0, -120); p.lineTo(40, -330); p.closePath(); }),
    details: (g) => { button(g, 0, -116, 4); stroke(g, [[-70, -70], [-30, -72]], 2, rgba(CL.deep, 0.7)); stroke(g, [[30, -72], [70, -70]], 2, rgba(CL.deep, 0.7)); stroke(g, [[-80, -230], [-46, -232]], 2, rgba(CL.deep, 0.6));
      for (const s of [-1, 1]) fold(g, [[s * 70, -200], [s * 80, -120], [s * 74, -40], [s * 84, 40]], 2.5, 0.4); },
    over: (g) => { for (const s of [-1, 1]) { const lap = P(p => { p.moveTo(s * 44, -336); p.lineTo(s * 60, -300); p.lineTo(s * 52, -292); p.lineTo(s * 70, -262); p.lineTo(s * 4, -126); p.lineTo(s * 2, -140); p.closePath(); });
      volume({ g, D: g.getTransform().a }, lap, CL.mid, [{ edge: { color: rgba(CL.ao, 0.65), width: 4, blur: 1.5, keep: true } }, { blob: { x: s * 40, y: -250, rx: 14, ry: 50, color: rgba(CL.hi, 0.35), keep: true } }]); } } },
  bomber: { neck: 'crew', hem: 30, loose: 7, dome: 70, open: () => P(p => { p.moveTo(-8, -306); p.lineTo(-8, 60); p.lineTo(8, 60); p.lineTo(8, -306); p.closePath(); }),
    details: (g) => { ribHem(g, 30, 20); for (const s of [-1, 1]) { stroke(g, [[s * 9, -306], [s * 9, 10]], 3, rgba('#c8c4cc', 0.9)); stroke(g, [[s * 60, -150], [s * 76, -60]], 3, rgba(CL.deep, 0.6)); fold(g, [[s * 50, -260], [s * 70, -190], [s * 80, -120], [s * 76, -40]], 3, 0.45); } },
    over: (g) => { const rc = P(p => { p.moveTo(-50, -342); p.bezierCurveTo(-40, -296, 40, -296, 50, -342); p.lineTo(40, -350); p.bezierCurveTo(30, -312, -30, -312, -40, -350); p.closePath(); }); band(g, rc, CL.mid, { passes: [{ fn: { fn: (gg) => PATTERN.rib(gg) } }] }); } },
};
// which tops get painted for which body: unisex pieces for both, the rest for one
// bibs drawn over the top (z 35): pinafore and overalls
function bib(kind) {
  const t = tex(-150, -435, 150, 90, 1.4), g = t.g, ov = kind === 'overalls';
  const top = ov ? -244 : -262, half = ov ? 52 : 56;
  const panel = ov
    ? P(p => {   // bib, then the overalls front: it widens into the waist and follows the body down to the crotch
        p.moveTo(-half, top); p.lineTo(half, top); p.lineTo(half + 6, -120);
        // the front panel stays inside the hips (the side openings lie flat); below the waist it is the trouser front
        for (let y = -110; y <= 74; y += 6) p.lineTo(Math.min(bodyHW(y) - 6, Math.max(half + 6, bodyHW(y) - 6)), y);
        for (let y = 74; y >= -110; y -= 6) p.lineTo(-Math.min(bodyHW(y) - 6, Math.max(half + 6, bodyHW(y) - 6)), y);
        p.lineTo(-half - 6, -120); p.closePath(); })
    : P(p => { p.moveTo(-half, top); p.lineTo(half, top); p.lineTo(half + 8, -96); p.lineTo(-half - 8, -96); p.closePath(); });
  volume(t, panel, CL.base, [...patternPass(ov ? 'denim' : null), ...clothPasses(-half - 8, half + 8, { edge: 6 })]);
  if (ov) {
    const pk = P(p => p.roundRect(-26, -214, 52, 44, [2, 2, 8, 8])); g.strokeStyle = rgba('#b89a64', 0.95); g.lineWidth = 1.6; g.stroke(pk); stroke(g, [[-half + 4, top + 4], [half - 4, top + 4]], 1.6, rgba('#b89a64', 0.9));
    g.save(); g.clip(panel);
    stroke(g, [[-120, -84], [-50, -94], [50, -94], [120, -84]], 2, rgba('#b89a64', 0.9));      // waist seam
    stroke(g, [[6, -88], [10, 30], [6, 50], [0, 62]], 1.6, rgba(CL.deep, 0.8));                  // fly
    for (const sx of [-1, 1]) pocketSlit(g, sx);   // front pockets the hands go into
    g.restore();
  }
  for (const sx of [-1, 1]) {
    const st = [[sx * (half - 10), top], [sx * (half + 4), -290], [sx * (half + 14), -316], [sx * (half + 18), -330]];
    stroke(g, st, ov ? 12 : 10, rgba(CL.mid, 1)); stroke(g, st, 1.2, rgba(CL.ao, 0.5));
    if (ov) {
      for (let k = 0; k < 2; k++) stroke(g, st.map(([x, y]) => [x + (k ? 4 : -4), y]), 0.9, rgba('#c9a45a', 0.9));
      g.fillStyle = '#e2bd6c'; g.beginPath(); g.roundRect(sx * (half - 10) - 11, top - 8, 22, 18, 4); g.fill(); g.strokeStyle = '#6a4a1a'; g.lineWidth = 2; g.stroke();
      g.fillStyle = rgba('#ffffff', 0.55); g.fillRect(sx * (half - 10) - 8, top - 6, 6, 3);
      g.fillStyle = '#7a5a26'; g.fillRect(sx * (half - 10) - 4, top - 2, 8, 5); button(g, sx * (half + 12), -96, 3.6);   // buckle + side button
    }
    else button(g, sx * (half - 10), top + 8, 3.4);
  }
  grain(t, ov ? 0.04 : 0.02, ov ? 71 : 72);
  t.height = { dome: 40, str: 1 };
  return t;
}
// a printed graphic (painted colours, not dyed) on the chest of a top
function printSmiley() {
  const t = tex(-150, -435, 150, 90, 1.4), g = t.g, cx = -6, cy = -200, R = 30;
  g.fillStyle = '#e8c44a'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = rgba('#ffffff', 0.25); g.beginPath(); g.arc(cx - 10, cy - 10, R * 0.7, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#3a2c18'; g.beginPath(); g.ellipse(cx - 10, cy - 8, 3.5, 6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 10, cy - 8, 3.5, 6, 0, 0, 7); g.fill();
  stroke(g, [[cx - 16, cy + 6], [cx - 8, cy + 18], [cx + 8, cy + 18], [cx + 16, cy + 6]], 3.5, '#3a2c18');
  return t;
}
const TOPS2 = {
  // open flannel worn over a tee (outer, z 40)
  flannelopen: { neck: 'collar', hem: 28, loose: 6, pattern: 'plaid', open: () => P(p => { p.moveTo(-30, -310); p.lineTo(-40, 60); p.lineTo(40, 60); p.lineTo(30, -310); p.closePath(); }),
    details: (g) => { for (const s of [-1, 1]) { stroke(g, [[s * 36, -306], [s * 46, 28]], 8, rgba(CL.hi, 0.25)); if (s < 0) for (let y = -280; y < 20; y += 46) button(g, -40, y, 2.8); fold(g, [[s * 60, -200], [s * 80, -140], [s * 74, -80], [s * 86, -20]]); } },
    over: (g) => shirtCollar(g, 1.2) },
  // sweater vest over a shirt (outer, z 40)
  vest: { neck: 'deepv', arm: 'tank', hem: 4, loose: 3, pattern: 'knit', dome: 50, details: (g) => { ribHem(g, 4, 18); for (let y = -220; y < -20; y += 34) for (let x = -90; x <= 90; x += 34) { g.strokeStyle = rgba(CL.deep, 0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.lineTo(x - 14, y); g.closePath(); g.stroke(); } },
    over: (g) => { for (const s of [-1, 1]) { stroke(g, [[s * 50, -334], [s * 34, -280], [s * 12, -214], [0, -190]], 9, rgba(CL.mid, 1)); for (let k = 0; k < 6; k++) stroke(g, [[s * (46 - k * 7), -326 + k * 22], [s * (40 - k * 7), -320 + k * 22]], 1, rgba(CL.sh, 0.7)); } } },
  // long coat: the body part (the skirt part is coat_lower, a swinging skirt layer)
  coat: { neck: 'deepv', hem: 80, loose: 9, dome: 60, open: () => P(p => { p.moveTo(-36, -330); p.lineTo(-4, -150); p.lineTo(-10, 90); p.lineTo(10, 90); p.lineTo(4, -150); p.lineTo(36, -330); p.closePath(); }),
    details: (g) => { stroke(g, [[-150, -100], [150, -100]], 12, rgba(CL.mid, 1)); stroke(g, [[-150, -94], [150, -94]], 1.2, rgba(CL.ao, 0.6)); for (const s of [-1, 1]) { for (const y of [-220, -160]) button(g, s * 26, y, 3.6); fold(g, [[s * 70, -220], [s * 84, -150], [s * 80, -60], [s * 90, 40]], 3, 0.45); } },
    over: (g) => { for (const s of [-1, 1]) { const lap = P(p => { p.moveTo(s * 44, -340); p.lineTo(s * 70, -310); p.lineTo(s * 60, -298); p.lineTo(s * 84, -262); p.lineTo(s * 6, -152); p.lineTo(s * 4, -170); p.closePath(); });
      volume({ g, D: g.getTransform().a }, lap, CL.mid, [{ edge: { color: rgba(CL.ao, 0.65), width: 4, blur: 1.5, keep: true } }, { blob: { x: s * 46, y: -260, rx: 16, ry: 50, color: rgba(CL.hi, 0.35), keep: true } }]); } } },
};
// accessories painted in their own colours (dye 'none'): belts, scarf, bags
const leather = (g, pts, w, col = '#6b4127') => { stroke(g, pts, w, col); stroke(g, pts, w * 0.25, rgba('#ffffff', 0.25)); stroke(g, pts.map(([x, y]) => [x, y + w * 0.42]), 1, rgba('#2a170c', 0.6)); };
const ACCESSORIES = {
  acc_belt: () => { const t = tex(-150, -60, 150, 20, 2), g = t.g;
    g.save(); g.clip(torsoPath(2.5, 80));   // the strap wraps round the body: it ends at the body outline
    leather(g, [[-120, -16], [-60, -26], [60, -26], [120, -16]], 11);
    g.fillStyle = '#c9a45a'; g.fillRect(-12, -30, 22, 15); g.fillStyle = '#6b4127'; g.fillRect(-7, -26, 12, 7); stroke(g, [[-2, -23], [8, -23]], 2, '#8a6a2e');
    for (const x of [-70, 40, 80]) stroke(g, [[x, -28], [x, -18]], 4, rgba('#3a2416', 0.9)); g.restore(); t.height = { dome: 4, str: 1 }; return t; },
  acc_beltblack: () => { const t = tex(-150, -60, 150, 20, 2), g = t.g;
    g.save(); g.clip(torsoPath(2.5, 80));
    leather(g, [[-120, -16], [-60, -26], [60, -26], [120, -16]], 10, '#1f1c22');
    g.strokeStyle = '#c8c4cc'; g.lineWidth = 2.4; g.strokeRect(-11, -30, 20, 14); g.restore(); t.height = { dome: 4, str: 1 }; return t; },
  acc_scarf: () => { const t = tex(-150, -435, 150, 90, 1.6), g = t.g;
    const loop = P(p => { p.moveTo(-60, -350); p.bezierCurveTo(-56, -296, 56, -296, 60, -350); p.lineTo(62, -322); p.bezierCurveTo(50, -270, -50, -270, -62, -322); p.closePath(); });
    const tail = (x0, d) => P(p => { p.moveTo(x0, -300); p.lineTo(x0 + 26, -296); p.bezierCurveTo(x0 + 30 + d, -220, x0 + 26 + d, -170, x0 + 30 + d, -120); p.lineTo(x0 + 2 + d, -122); p.bezierCurveTo(x0 + 2 + d, -180, x0 + 4, -230, x0, -300); p.closePath(); });
    const pass = [{ fn: { fn: (gg) => { gg.fillStyle = '#d9c3a6'; gg.fillRect(-200, -500, 400, 700); PATTERN.plaid(gg); } } }, { edge: { color: rgba('#5a4636', 0.6), width: 6, blur: 2.5, keep: true } }, { grad: { x0: -60, y0: 0, x1: 60, y1: 0, stops: [[0, rgba('#ffffff', 0.25)], [1, rgba('#3a2a1e', 0.35)]], keep: true } }];
    volume(t, tail(-22, -8), '#d9c3a6', pass); volume(t, tail(4, 6), '#d9c3a6', pass); volume(t, loop, '#d9c3a6', pass);
    for (const x0 of [-30, 2]) for (let x = 0; x < 28; x += 3) stroke(g, [[x0 + x + (x0 < 0 ? -8 : 6), -122], [x0 + x + (x0 < 0 ? -8 : 6), -110]], 1, '#bfa688');
    t.height = { dome: 20, str: 1, detail: 1 }; return t; },
  acc_crossbody: () => { const t = tex(-150, -435, 150, 90, 1.6), g = t.g;
    leather(g, [[-66, -326], [-20, -220], [40, -100], [96, -10]], 6);
    const bag = P(p => p.roundRect(76, -24, 58, 46, 8)); volume(t, bag, '#7a4a2a', [{ grad: { x0: 0, y0: -24, x1: 0, y1: 22, stops: [[0, rgba('#ffffff', 0.25)], [1, rgba('#2a170c', 0.4)]], keep: true } }, { edge: { color: rgba('#2a170c', 0.6), width: 4, blur: 1.5, keep: true } }]);
    const flap = P(p => { p.moveTo(76, -24); p.lineTo(134, -24); p.lineTo(134, 0); p.quadraticCurveTo(105, 10, 76, 0); p.closePath(); }); volume(t, flap, '#8a5634', [{ edge: { color: rgba('#2a170c', 0.6), width: 3, blur: 1, keep: true } }]);
    g.fillStyle = '#c9a45a'; g.fillRect(101, 2, 8, 6); t.height = { dome: 10, str: 1 }; return t; },
  acc_tote: () => { const t = tex(-150, -435, 170, 90, 1.6), g = t.g;
    leather(g, [[62, -324], [80, -240], [96, -140], [108, -70]], 7, '#cbb894');
    leather(g, [[78, -326], [104, -240], [128, -140], [146, -70]], 7, '#cbb894');
    const bag = P(p => { p.moveTo(96, -76); p.lineTo(162, -76); p.lineTo(166, 40); p.lineTo(92, 40); p.closePath(); });
    volume(t, bag, '#e6dcc6', [{ grad: { x0: 92, y0: 0, x1: 166, y1: 0, stops: [[0, rgba('#ffffff', 0.35)], [1, rgba('#7a6a50', 0.45)]], keep: true } }, { edge: { color: rgba('#6a5a40', 0.6), width: 4, blur: 1.5, keep: true } }]);
    for (let x = 104; x < 160; x += 18) stroke(g, [[x, -70], [x + 2, 36]], 2, rgba('#a8987a', 0.4), 2);
    t.height = { dome: 16, str: 1 }; return t; },
};
const TOP_SEX = { tank: 'fm', tee: 'fm', stripe: 'fm', shirt: 'fm', flannel: 'fm', hoodie: 'fm', sweater: 'fm', polo: 'm', henley: 'fm', crop: 'f', cami: 'f', offshoulder: 'f', blouse: 'f', tube: 'f', fitted: 'f', vtee: 'fm', turtle: 'fm',
  flannelopen: 'fm', vest: 'fm', coat: 'fm', cardigan: 'f', denimjacket: 'fm', blazer: 'fm', bomber: 'm' };

// hood: torso layer behind the body skin (z < 0) — it shows around and above the shoulders, never over the neck
function hoodBack() {
  const t = tex(-150, -435, 150, 90, 1.4), g = t.g;
  const hood = P(p => { p.moveTo(-104, -300); p.bezierCurveTo(-112, -360, -80, -410, 0, -414); p.bezierCurveTo(80, -410, 112, -360, 104, -300); p.bezierCurveTo(70, -290, -70, -290, -104, -300); p.closePath(); });
  volume(t, hood, CL.base, [
    { grad: { x0: 0, y0: -414, x1: 0, y1: -296, stops: [[0, rgba(CL.hi, 0.45)], [0.5, rgba(CL.base, 0)], [1, rgba(CL.deep, 0.5)]] } },
    { edge: { color: rgba(CL.ao, 0.6), width: 10, blur: 4 } },
    { blob: { x: 0, y: -360, rx: 60, ry: 30, color: rgba(CL.ao, 0.55) } },   // inside of the hood, shadowed
  ]);
  stroke(g, [[-96, -330], [-60, -392], [60, -392], [96, -330]], 3, rgba(CL.sh, 0.7), 1.5);
  t.height = { dome: 50, str: 1 };
  return t;
}

// ---------------------------------------------------------------- sleeves (arm space)
// o: start (top y), end (y), k (ease), puff, bell (flare below the elbow), cuff, pattern, ruffle, roll
function sleeveTex(o) {
  // sleeves start well above the shoulder line (arm y ~ -70): the rig only shows them below arm y ~2-10, so the
  // top edge (and the dome of its normal map) stays hidden instead of lighting up as a band at the shoulder
  const t = tex(-60, -80, 60, 330, 1.7), g = t.g;
  const y0 = o.start ?? -72, y1 = o.end, k = o.k ?? 1.12;
  const hug = y1 < 130 && !o.puff && !o.bell;   // plain short sleeves come back to the arm's width at the hem (hug the bicep)
  const kk = (y) => o.start > 0 ? k : 1 + (k - 1) * sm((y - 6) / (hug ? 30 : 54)) * (hug ? 1 - sm((y - (y1 - 34)) / 30) : 1);
  const hw = (y) => armHW(Math.max(0, y)) * kk(y) * (1 + (o.puff || 0) * Math.sin(Math.PI * sm((y - Math.max(y0, -10)) / (y1 - Math.max(y0, -10))))) * (1 + (o.bell || 0) * sm((y - 150) / 140));
  const curve = o.curve ?? (y1 < 130 ? 7 : 0);   // short sleeves: the hem wraps round the arm (lower at the front)
  const capY = o.start > 0 ? y0 : 22;   // the sleeve's sides begin at arm y ~22 and arch up over the shoulder ball
  const path = P(p => {
    if (o.start > 0) p.moveTo(-hw(y0), y0); else { p.moveTo(-hw(capY), capY); p.bezierCurveTo(-hw(capY), y0 + 30, -hw(0) * 0.5, y0, 0, y0); p.bezierCurveTo(hw(0) * 0.5, y0, hw(capY), y0 + 30, hw(capY), capY); }
    for (let y = capY; y <= y1; y += 4) p.lineTo(hw(y), y); p.lineTo(hw(y1), y1); p.quadraticCurveTo(0, y1 + curve * 2, -hw(y1), y1);
    for (let y = y1; y >= capY; y -= 4) p.lineTo(-hw(y), y); p.closePath(); });
  volume(t, path, CL.base, [...patternPass(o.pattern), ...clothPasses(-40 * k, 40 * k, { ao: 0.18, rim: false }), { blob: { x: 4, y: 168, rx: 20, ry: 10, color: rgba(CL.sh, y1 > 180 ? 0.5 : 0) } }, { blob: { x: 0, y: y1 - 4, rx: 30, ry: 8, color: rgba(CL.ao, 0.45) } }]);
  g.save(); g.beginPath(); g.rect(-60, y0, 120, y1 - y0); g.clip();
  if (y1 > 180) for (const y of [120, 200, 246]) if (y < y1 - 10) stroke(g, [[-hw(y) + 4, y], [0, y + 8], [0, y + 8], [hw(y) - 4, y - 2]], 2, rgba(CL.sh, 0.55), 1.5);
  if (o.puff) for (let x = -24; x <= 24; x += 8) fold(g, [[x * 0.6, y0 + 6], [x, y0 + 30], [x * 1.1, (y0 + y1) / 2], [x * 0.7, y1 - 4]], 2, 0.4);
  if (o.bell) for (let x = -30; x <= 30; x += 10) fold(g, [[x * 0.4, 170], [x * 0.7, 220], [x, 270], [x * 1.3, y1]], 2, 0.4);
  g.restore();
  if (o.cuff) { const cuff = P(p => { const c0 = y1 - o.cuff; p.moveTo(-hw(c0) * 1.03, c0); p.lineTo(hw(c0) * 1.03, c0); p.lineTo(hw(y1) * 1.03, y1); p.lineTo(-hw(y1) * 1.03, y1); p.closePath(); }); volume(t, cuff, CL.mid, [...patternPass(o.cuffPattern), { edge: { color: rgba(CL.ao, 0.6), width: 4, blur: 1.5 } }]); }
  else if (!o.bell) stroke(g, [[-hw(y1), y1 - 3], [-hw(y1) * 0.4, y1 - 3 + curve], [hw(y1) * 0.4, y1 - 3 + curve], [hw(y1), y1 - 3]], 3, rgba(CL.sh, 0.8));
  if (o.ruffle) ruffle(g, y0, -hw(y0) - 4, hw(y0) + 4, 14);
  if (o.roll) { const r0 = y1 - 22; const rl = P(p => { p.moveTo(-hw(r0) * 1.08, r0); p.lineTo(hw(r0) * 1.08, r0); p.lineTo(hw(y1) * 1.08, y1); p.lineTo(-hw(y1) * 1.08, y1); p.closePath(); }); volume(t, rl, CL.mid, [...patternPass(o.pattern), { edge: { color: rgba(CL.ao, 0.6), width: 5, blur: 2 } }]); }
  t.height = { dome: 40, str: 1.0, detail: 1, detailBlur: 3 };
  return t;
}
const SLEEVES = {
  sleeveShort: { end: 92, k: 1.05 }, sleeveCap: { end: 56, k: 1.12 }, sleeveLong: { end: 300, k: 1.1, cuff: 24 }, sleeveHoodie: { end: 300, k: 1.22, cuff: 26, cuffPattern: 'rib' },
  sleeveKnit: { end: 300, k: 1.14, cuff: 26, pattern: 'knit', cuffPattern: 'rib' }, sleevePlaid: { end: 300, k: 1.12, cuff: 24, pattern: 'plaid' }, sleeveRolled: { end: 200, k: 1.12, roll: true },
  sleevePlaidRolled: { end: 200, k: 1.12, roll: true, pattern: 'plaid' }, sleeveStripe: { end: 230, k: 1.12, pattern: 'stripes' }, sleevePuff: { end: 104, k: 1.08, puff: 0.32, cuff: 10 },
  sleeveBell: { end: 312, k: 1.1, bell: 0.75 }, sleeveOff: { start: 34, end: 118, k: 1.2, puff: 0.22, ruffle: true }, sleeveFlutter: { end: 80, k: 1.3, bell: 0, puff: 0.15 },
  sleeveJacket: { end: 302, k: 1.24, cuff: 18 }, sleeveDenim: { end: 302, k: 1.22, cuff: 22, pattern: 'denim' }, sleeveBomber: { end: 302, k: 1.3, cuff: 26, cuffPattern: 'rib', puff: 0.06 },
  sleeveFitted: { end: 306, k: 1.03, pattern: 'rib', cuff: 14 }, sleeveFitShort: { end: 82, k: 1.0, pattern: 'rib' },
  sleevePuffFloral: { end: 104, k: 1.08, puff: 0.32, cuff: 10, pattern: 'floral' }, sleeveFlutterFloral: { end: 80, k: 1.3, puff: 0.15, pattern: 'floral' }, sleeveCoat: { end: 304, k: 1.28, cuff: 22 },
};

// ---------------------------------------------------------------- bottoms
// slanted front-pocket opening: shadowed mouth, lit lip, stitching (torso space)
// mouth runs from (sx*86, -20) at the hip down to (sx*46, 38): tall and wide enough for big hands, its outer end
// inside the hip outline (the body is ~94 wide at y -20); it opens up to ~12 units around (sx*66, 9)
const POCKET = { top: [86, -20], bottom: [46, 38], depth: 12 };
function pocketSlit(g, sx) {
  const [ax, ay] = POCKET.top, [bx, by] = POCKET.bottom, d = POCKET.depth;
  const A = [sx * ax, ay], B = [sx * bx, by], C1 = [sx * (ax - 12), ay + 22], C2 = [sx * (bx + 14), by - 20];
  // the open mouth: a crescent between the garment edge and the lining behind it, in shadow
  const mouth = P(p => { p.moveTo(...A); p.bezierCurveTo(...C1, ...C2, ...B); p.bezierCurveTo(C2[0] - sx * d, C2[1] + 2, C1[0] - sx * d, C1[1] + 2, A[0], A[1]); p.closePath(); });
  g.save(); g.fillStyle = rgba(CL.ao, 0.9); g.fill(mouth);
  g.clip(mouth); const gr = g.createLinearGradient(A[0], 0, A[0] - sx * 14, 0); gr.addColorStop(0, rgba('#000000', 0.35)); gr.addColorStop(1, rgba('#000000', 0)); g.fillStyle = gr; g.fillRect(-200, -60, 400, 120); g.restore();
  stroke(g, [A, C1, C2, B], 1.8, rgba('#ffffff', 0.55));   // the lip catching light
  g.save(); g.setLineDash([2.2, 1.8]); stroke(g, [[A[0] + sx * 5, A[1] + 3], [C1[0] + sx * 5, C1[1] + 2], [C2[0] + sx * 5, C2[1] + 2], [B[0] + sx * 5, B[1] + 1]], 0.9, rgba(CL.deep, 0.75)); g.restore();   // topstitch
  for (const [x, y] of [A, B]) stroke(g, [[x - 2, y - 1], [x + 2, y + 1]], 2, rgba(CL.deep, 0.8));   // bar tacks
}
// hip part in torso space: waistband to the crotch, kept inside the body outline
function hipsTex(kind) {
  const t = tex(-150, -110, 150, 90, 1.4), g = t.g;
  const top = { leggings: -40, bike: -40, joggers: -32, trousers: -30, chinos: -24, jeans: -22, shorts: -22, cargo: -22, cargoshorts: -22, wide: -72 }[kind];
  const body = torsoPath(0, 78);
  g.save(); g.clip(below(top));
  volume(t, body, CL.base, [...patternPass(['jeans', 'shorts'].includes(kind) ? 'denim' : null), ...clothPasses(-110, 110), { blob: { x: 0, y: 70, rx: 30, ry: 16, color: rgba(CL.ao, 0.55) } }]);
  g.restore();
  g.save(); g.clip(body);
  const wb = (h, col = CL.mid) => { stroke(g, [[-120, top + h / 2 + 4], [-50, top + h / 2 - 6], [50, top + h / 2 - 6], [120, top + h / 2 + 4]], h, rgba(col, 1)); stroke(g, [[-120, top + h + 2], [-50, top + h - 8], [50, top + h - 8], [120, top + h + 2]], 1.4, rgba(CL.deep, 0.5)); };
  if (kind === 'leggings' || kind === 'bike') { wb(14, CL.base); stroke(g, [[0, top + 20], [0, 70]], 1.2, rgba(CL.sh, 0.6)); }
  else if (kind === 'joggers') { wb(18); for (let x = -110; x < 110; x += 6) stroke(g, [[x, top + 2], [x, top + 16]], 0.9, rgba(CL.sh, 0.6)); for (const s of [-1, 1]) stroke(g, [[s * 6, top + 14], [s * 9, top + 40], [s * 6, top + 56]], 2, rgba(CL.hi, 0.9)); for (const sx of [-1, 1]) pocketSlit(g, sx); }
  else {
    wb(12);
    for (const x of [-84, -34, 34, 84]) stroke(g, [[x, top - 2], [x, top + 18]], 5, rgba(CL.sh, 0.9));
    stroke(g, [[6, top + 14], [10, 30], [6, 50], [0, 62]], 1.6, rgba(CL.deep, 0.8));
    if (kind === 'jeans' || kind === 'shorts' || kind === 'cargo' || kind === 'cargoshorts') { g.fillStyle = rgba('#b8955a', 1); g.beginPath(); g.arc(4, top + 6, 4, 0, 7); g.fill(); }
    else button(g, 4, top + 6, 3);
    for (const sx of [-1, 1]) pocketSlit(g, sx);
    if (kind === 'trousers' || kind === 'chinos' || kind === 'wide') for (const s of [-1, 1]) stroke(g, [[s * 50, top + 14], [s * 52, 80]], 1.6, rgba(CL.hi, 0.7));
  }
  g.restore();
  grain(t, ['jeans', 'shorts'].includes(kind) ? 0.04 : 0.022, 41 + kind.length);
  t.height = { dome: 50, str: 1.0, detail: 1.2, detailBlur: 3 };
  return t;
}
// legs part in leg space. o: end (hem y), k (ease), minW (straight leg), flare (extra half-width at the ankle),
// cuff (gathered band height), crease, seams (denim), pocket (cargo), pattern
function legTex(o) {
  const t = tex(-86, -40, 86, 440, 1.3), g = t.g, end = o.end, k = o.k ?? 1;
  const hw = (y) => (o.straight ? Math.max(legHW(Math.min(60, Math.max(0, y))) * 1.05, o.minW) : Math.max(legHW(Math.min(410, Math.max(0, y))) * k, o.minW || 0)) + (o.flare || 0) * sm((y - 180) / 230) - (o.cuff ? 6 * sm((y - (end - o.cuff - 30)) / 30) : 0);
  const hwT = (y) => hw(y) * (0.78 + 0.22 * sm((y + 40) / 80));   // narrow at the top: the hips layer and the body own the hip curve
  const path = P(p => { p.moveTo(-hwT(-40), -40); for (let y = -40; y <= end; y += 4) p.lineTo(hwT(y), y); p.lineTo(hwT(end), end); for (let y = end; y >= -40; y -= 4) p.lineTo(-hwT(y), y); p.closePath(); });
  volume(t, path, CL.base, [...patternPass(o.pattern), ...clothPasses(-60, 60, { edge: 8 }), { blob: { x: -4, y: 206, rx: 18, ry: 12, color: rgba(CL.hi, end > 220 ? 0.4 : 0) } }, { blob: { x: 0, y: end - 6, rx: 40, ry: 8, color: rgba(CL.ao, 0.5) } }]);
  g.save(); g.clip(path);   // every detail stays on the garment (shorts don't draw seams down a bare leg)
  if (o.seams) stroke(g, [[hw(0) - 8, -30], [hw(150) - 6, 150], [hw(300) - 6, Math.min(300, end)], [hw(end) - 6, end]], 1.6, rgba(CL.deep, 0.7));
  if (o.crease) stroke(g, [[-2, -30], [-1, 150], [0, 300], [0, end]], 1.6, rgba(CL.hi, 0.75));
  if (end > 240) {
    for (const y of [212, 228, 244]) stroke(g, [[-hw(y) + 5, y], [-hw(y) * 0.3, y + 7], [hw(y) * 0.2, y + 6], [hw(y) - 5, y - 3]], 2.4, rgba(CL.sh, 0.6), 1.6);   // creases at the back of the knee
    for (const y of [214, 232]) stroke(g, [[-hw(y) + 8, y - 4], [-hw(y) * 0.2, y + 2], [hw(y) * 0.2, y + 2], [hw(y) - 8, y - 6]], 2, rgba(CL.hi, 0.35), 1.6);
    if (!o.roll && !o.cuff) for (const dy of [44, 28, 14]) { const y = end - dy; stroke(g, [[-hw(y) + 4, y], [-hw(y) * 0.4, y + 5], [hw(y) * 0.3, y - 2], [hw(y) - 4, y + 4]], 2.4, rgba(CL.sh, 0.55), 1.6); }   // fabric stacking at the hem
  }
  if (o.flow) for (let i = 0; i < 5; i++) { const x = -hw(200) * 0.8 + i * hw(200) * 0.4; fold(g, [[x * 0.5, 60], [x * 0.8, 200], [x, 320], [x * 1.05, end]], 5, i % 2 ? 0.3 : 0.2, i % 2 ? CL.sh : CL.hi); }
  if (o.flare) for (let x = -24; x <= 24; x += 12) fold(g, [[x * 0.3, 160], [x * 0.6, 260], [x, 340], [x * 1.4, end]], 2.4, 0.4);
  if (o.pocket) { const pk = P(p => p.roundRect(hw(130) - 34, 110, 30, 46, [3, 3, 6, 6])); g.fillStyle = rgba(CL.sh, 0.25); g.fill(pk); g.strokeStyle = rgba(CL.deep, 0.7); g.lineWidth = 1.6; g.stroke(pk); stroke(g, [[hw(110) - 36, 112], [hw(110) - 2, 112]], 6, rgba(CL.mid, 0.9)); }
  if (o.cuff) { for (let x = -40; x <= 40; x += 5) stroke(g, [[x, end - o.cuff], [x, end]], 1, rgba(CL.sh, 0.6)); stroke(g, [[-50, end - o.cuff], [50, end - o.cuff]], 1.6, rgba(CL.deep, 0.5)); }
  else stroke(g, [[-hw(end), end - 8], [hw(end), end - 8]], 2, rgba(CL.sh, 0.8));
  if (o.fray) for (let x = -hw(end); x < hw(end); x += 2) stroke(g, [[x, end - 4], [x + 1, end + 3]], 0.8, rgba('#ffffff', 0.6));
  if (o.whisker) for (const y of [20, 34, 48]) stroke(g, [[-hw(y) + 10, y], [-6, y + 10], [10, y + 4], [hw(y) - 14, y - 6]], 3, rgba('#ffffff', 0.35), 3);
  g.restore();
  if (o.roll) {                  // rolled cuff: a turned-up band showing the lighter inside of the fabric
    // two turns of a thick roll: each turn bulges past the leg, lit on top, shadowed underneath
    const r0 = end - o.roll, mid = r0 + o.roll / 2;
    for (const [a, b] of [[r0, mid], [mid, end]]) {
      const turn = P(p => { p.moveTo(-hw(a) - 4, a); p.quadraticCurveTo(0, a - 3, hw(a) + 4, a); p.quadraticCurveTo(hw(b) + 8, (a + b) / 2, hw(b) + 5, b); p.quadraticCurveTo(0, b + 3, -hw(b) - 5, b); p.quadraticCurveTo(-hw(b) - 8, (a + b) / 2, -hw(a) - 4, a); p.closePath(); });
      volume(t, turn, CL.hi, [...patternPass(o.pattern), { grad: { x0: 0, y0: a, x1: 0, y1: b, stops: [[0, rgba('#ffffff', 0.3)], [0.45, rgba(CL.hi, 0)], [1, rgba(CL.deep, 0.55)]], keep: true } }, { edge: { color: rgba(CL.ao, 0.6), width: 3, blur: 1.2, keep: true } }]);
    }
    stroke(g, [[-hw(r0) - 2, r0 - 1], [hw(r0) + 2, r0 - 1]], 3, rgba(CL.ao, 0.5), 1.5);   // shadow the roll casts on the leg above it
  }
  if (o.rips) {                  // ripped knees / thighs: frayed slits that show the leg beneath
    const r = rng(end + 7);
    for (const [cy, w] of o.rips) {
      for (let k = 0; k < 4; k++) {
        const y = cy + k * 7 - 10, hx = w * (0.6 + r() * 0.5);
        g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(r() * 6 - 3, y, hx, 2.2 + r() * 1.5, (r() - 0.5) * 0.15, 0, 7); g.fill(); g.restore();
        for (let x = -hx; x < hx; x += 2.2) stroke(g, [[x, y - 1.5], [x + (r() - 0.5) * 2, y + 1.5]], 0.9, rgba('#ffffff', 0.85));
      }
    }
  }
  grain(t, o.pattern === 'denim' ? 0.04 : 0.02, 51 + end);
  t.height = { dome: 36, str: 1.0, detail: o.pattern === 'denim' ? 1.5 : 0.6, detailBlur: 2 };
  return t;
}
const LEGS = {
  legs_leggings: { end: 412, k: 1.0 }, legs_bike: { end: 150, k: 1.0 }, legs_jeans: { end: 418, k: 1.1, minW: 31, seams: true, pattern: 'denim' },
  legs_shorts: { end: 120, k: 1.16, seams: true, pattern: 'denim', fray: false }, legs_wide: { end: 430, k: 1.0, minW: 60, flare: 0, flow: true, straight: true },
  legs_trousers: { end: 420, k: 1.12, minW: 33, crease: true }, legs_cargo: { end: 418, k: 1.2, minW: 36, seams: true, pocket: true },
  legs_joggers: { end: 412, k: 1.16, minW: 30, cuff: 22 }, legs_cargoshorts: { end: 205, k: 1.24, minW: 38, seams: true, pocket: true },
  legs_jeansroll: { end: 392, k: 1.08, minW: 30, seams: true, pattern: 'denim', roll: 28, whisker: true }, legs_ripped: { end: 418, k: 1.12, minW: 31, seams: true, pattern: 'denim', rips: [[215, 18], [110, 14], [300, 10]], whisker: true },
  legs_cargoroll: { end: 398, k: 1.2, minW: 36, seams: true, pocket: true, roll: 28 }, legs_overalls: { end: 396, k: 1.04, minW: 26, seams: true, pattern: 'denim', roll: 30 },
};

// ---------------------------------------------------------------- skirts (torso space, z 20; also dress skirts)
// o: top (y of the waist edge), len (hem y), flare (hem half-width), ease (extra over the hips),
// pleats, folds, pattern, waistband (h), denim, slit, wrap, satin
function skirtTex(o) {
  const top = o.top, len = o.len, t = tex(-220, top - 8, 220, len + 30 + Math.abs(o.hilo || 0) + (o.ruffle ? 24 : 0), 1.1), g = t.g;
  const ease = o.ease ?? 6, hipY = 14, hipW = bodyHW(hipY) + ease;
  const fitY = o.cling ? 70 : hipY;   // a clinging skirt follows the body down past the hips before it flares
  const xAt = (y) => {           // half-width down the skirt: follow the body to the hips, then out to the hem
    if (o.cling) return y > hipY ? hipW : bodyHW(top) + 4 + (hipW - bodyHW(top) - 4) * Math.sin(Math.PI / 2 * sm((y - top) / (hipY - top)));   // drapes waist -> hip, no hollow
    if (y <= fitY) return Math.max(bodyHW(Math.min(y, 54)) + ease * 0.6, bodyHW(top) + 2);
    const w0 = o.cling ? hipW : bodyHW(54) + ease * 0.6, u = (y - fitY) / (len - fitY);
    return w0 + (o.flare - w0) * (o.tight ? u : Math.pow(u, o.cling ? 1.6 : 0.85));
  };
  const wav = (x) => o.pleats ? 0 : Math.sin(x * 0.07) * (o.folds ? 4 : 1.5);
  const hemAt = (x) => len + (o.hilo || 0) * (x / o.flare);   // high-low hems slant across the front
  const path = P(p => {
    p.moveTo(-xAt(top), top); p.quadraticCurveTo(0, top - 6, xAt(top), top);
    for (let y = top; y <= len; y += 6) p.lineTo(xAt(y), y);
    const n = 24; for (let i = 0; i <= n; i++) { const x = o.flare - (2 * o.flare * i) / n; p.lineTo(x, hemAt(x) + 6 * Math.sin(Math.PI * i / n) + wav(x) + (o.pleats && i % 2 ? 3 : 0)); }
    for (let y = len; y >= top; y -= 6) p.lineTo(-xAt(y), y);
    p.closePath();
  });
  volume(t, path, o.base || CL.base, [
    ...patternPass(o.pattern),
    { grad: { x0: -o.flare, y0: 0, x1: o.flare, y1: 0, stops: [[0, rgba(CL.sh, 0.5)], [0.25, rgba(CL.hi, 0.45)], [0.5, rgba(CL.base, 0)], [0.8, rgba(CL.sh, 0.45)], [1, rgba(CL.deep, 0.6)]] } },
    { grad: { x0: 0, y0: top, x1: 0, y1: len, stops: [[0, rgba(CL.ao, 0.25)], [0.18, rgba(CL.base, 0)], [1, rgba(CL.sh, 0.3)]] } },
    { edge: { color: rgba(CL.ao, 0.5), width: 8, blur: 3 } },
    { edge: { color: rgba('#ffffff', 0.45), width: 3, blur: 1.2, dx: -2 } },
    ...(o.satin ? [{ blob: { x: -50, y: (top + len) / 2, rx: 16, ry: (len - top) * 0.45, color: rgba('#ffffff', 0.55) } }, { blob: { x: 40, y: (top + len) * 0.55, rx: 10, ry: (len - top) * 0.35, color: rgba('#ffffff', 0.35) } }] : []),
  ]);
  g.save(); g.clip(path);
  if (o.pleats) {                // knife pleats: crisp panels, each with a lit face and a shadowed fold
    const n = o.pleats;
    for (let i = 0; i < n; i++) {
      const f0 = i / n * 2 - 1, f1 = (i + 1) / n * 2 - 1;
      const pts = (f) => [[f * xAt(hipY + 10) * 0.98, hipY + 10], [f * o.flare, len + 8]];
      const [a0, b0] = pts(f0), [a1, b1] = pts(f1);
      const face = P(p => { p.moveTo(...a0); p.lineTo(...a1); p.lineTo(...b1); p.lineTo(...b0); p.closePath(); });
      const gr = g.createLinearGradient(a0[0], 0, a1[0], 0); gr.addColorStop(0, rgba(CL.hi, 0.35)); gr.addColorStop(0.7, rgba(CL.base, 0)); gr.addColorStop(1, rgba(CL.deep, 0.45));
      g.fillStyle = gr; g.fill(face);
      stroke(g, [a1, b1], 1.2, rgba(CL.ao, 0.75));
    }
    // stitched-down pleat tops at the hip yoke
    stroke(g, [[-xAt(hipY + 10), hipY + 10], [xAt(hipY + 10), hipY + 10]], 1.2, rgba(CL.deep, 0.5));
  }
  if (o.folds) for (let i = 0; i < o.folds; i++) { const f = (i + 0.5) / o.folds * 2 - 1; fold(g, [[f * xAt(hipY) * 0.8, hipY], [f * (hipW + o.flare) * 0.45, (hipY + len) / 2], [f * o.flare * 0.92, len - 20], [f * o.flare, len + 4]], 6, i % 2 ? 0.32 : 0.22, i % 2 ? CL.sh : CL.hi); }
  if (o.denim) {
    stroke(g, [[0, top + 12], [0, len]], 1.6, rgba(CL.deep, 0.7)); stroke(g, [[6, top + 12], [6, len]], 1.2, rgba('#b89a64', 0.9));
    for (let y = top + 26; y < len - 20; y += 26) button(g, 0, y, 2.8);
    for (const s of [-1, 1]) stroke(g, [[s * 92, top + 14], [s * 70, top + 32], [s * 52, top + 28], [s * 44, top + 14]], 1.6, rgba('#b89a64', 0.9));
    for (let x = -o.flare; x < o.flare; x += 2) stroke(g, [[x, len - 2], [x + 1, len + 5]], 0.8, rgba('#ffffff', 0.6));
  }
  if (o.slit) stroke(g, [[o.slit, hemAt(o.slit) + 2], [o.slit * 0.95, hemAt(o.slit) - 70]], 2.5, rgba(CL.ao, 0.8));
  if (o.cling) {   // round hip and thigh form under the fabric: lit front hip, shadowed far side, soft drag folds from the hip
    for (const [x, y, rx, ry, c, a] of [[-60, 20, 50, 60, CL.hi, 0.35], [70, 30, 44, 70, CL.deep, 0.3], [-30, 150, 40, 70, CL.hi, 0.2], [50, 160, 36, 70, CL.sh, 0.25]]) paintPass(t, null, { blob: { x, y, rx, ry, color: rgba(c, a), blur: 10, keep: true } });
    for (let i = 0; i < 4; i++) fold(g, [[-90 + i * 12, 10 + i * 6], [-60 + i * 14, 70], [-40 + i * 18, 130], [-50 + i * 24, hemAt(-50 + i * 24)]], 6, 0.28, CL.sh);
  }
  if (o.cling) for (let i = 0; i < 6; i++) { const x0 = -60 + i * 20; fold(g, [[x0 * 0.5, top + 40], [x0 * 0.7 + 10, 40], [x0 + 18, len - 40], [x0 * 1.3 + 30, hemAt(x0 * 1.3 + 30)]], 5, i % 2 ? 0.3 : 0.22, i % 2 ? CL.sh : CL.hi); }
  if (o.wrap) {   // the overlap reads as a soft shadowed fold, not a hard flap line
    stroke(g, [[-xAt(top + 20) * 0.5, top + 14], [-14, (top + len) * 0.45], [24, len - 50], [o.flare * 0.45, hemAt(o.flare * 0.45)]], 10, rgba(CL.ao, 0.22), 6);
    stroke(g, [[-xAt(top + 20) * 0.5 + 6, top + 14], [-8, (top + len) * 0.45], [30, len - 50], [o.flare * 0.45 + 6, hemAt(o.flare * 0.45)]], 6, rgba(CL.hi, 0.22), 4);
  }
  g.restore();
  if (o.ruffle) {                 // a gathered ruffle tier along the hem: a soft band with a wavy edge and gather folds
    const rh = o.ruffle === true ? 30 : o.ruffle, F0 = o.flare + 8;
    const band = P(p => { p.moveTo(-F0, hemAt(-F0) - 4); for (let x = -F0; x <= F0; x += 6) p.lineTo(x, hemAt(x) - 4); for (let x = F0 + 6; x >= -F0 - 6; x -= 4) p.lineTo(x, hemAt(x) + rh + 3.5 * Math.sin(x * 0.13) + 2 * Math.sin(x * 0.051)); p.closePath(); });
    volume(t, band, CL.base, [...patternPass(o.pattern), { grad: { x0: 0, y0: len - 60, x1: 0, y1: len + rh + 60, stops: [[0, rgba(CL.ao, 0.3)], [0.5, rgba(CL.hi, 0.15)], [1, rgba(CL.sh, 0.3)]], keep: true } }, { edge: { color: rgba(CL.ao, 0.4), width: 4, blur: 2, keep: true } }]);
    g.save(); g.clip(band);
    for (let x = -F0; x <= F0; x += 10) { const y = hemAt(x), lit = Math.round(x / 10) % 2; stroke(g, [[x, y], [x + 1, y + rh * 0.5], [x - 1, y + rh * 0.8], [x + 2, y + rh + 4]], 5, rgba(lit ? CL.hi : CL.ao, lit ? 0.42 : 0.4), 3); }
    stroke(g, Array.from({ length: 60 }, (_, i) => { const x = -F0 + i * (2 * F0 / 59); return [x, hemAt(x) + rh + 3.5 * Math.sin(x * 0.13) + 2 * Math.sin(x * 0.051) - 2]; }), 2.2, rgba(CL.ao, 0.55), 1);   // the ruffle's wavy bottom edge
    g.restore();
    stroke(g, [[-F0, hemAt(-F0) - 3], [0, hemAt(0) - 3], [0, hemAt(0) - 3], [F0, hemAt(F0) - 3]], 2.5, rgba(CL.ao, 0.55), 1);   // the seam joining the tier
  }
  if (o.openGap) { const [a, b] = o.openGap; g.save(); g.globalCompositeOperation = 'destination-out'; g.fill(P(p => { p.moveTo(-a, top - 10); p.lineTo(a, top - 10); p.lineTo(b, len + 60); p.lineTo(-b, len + 60); p.closePath(); })); g.restore();
    for (const sx of [-1, 1]) stroke(g, [[sx * a, top], [sx * b, len + 4]], 4, rgba(CL.ao, 0.55), 2); }
  if (o.waistband) { const h = o.waistband; band(g, P(p => { p.moveTo(-xAt(top) - 1, top); p.quadraticCurveTo(0, top - 6, xAt(top) + 1, top); p.lineTo(xAt(top + h) + 1, top + h); p.quadraticCurveTo(0, top + h - 6, -xAt(top + h) - 1, top + h); p.closePath(); }), o.denim ? CL.base : CL.mid, { passes: patternPass(o.pattern) }); }
  grain(t, o.denim ? 0.04 : 0.02, 61 + len);
  t.height = { dome: 50, str: 1.0, detail: o.pleats ? 2 : 1, detailBlur: 3 };
  return t;
}
const SKIRTS = {
  skirt_mini: { top: -30, len: 118, flare: 150, ease: 6, folds: 5, waistband: 10 },
  skirt_pleated: { top: -92, len: 150, flare: 168, ease: 10, pleats: 18, waistband: 12 },
  skirt_pencil: { top: -96, len: 228, flare: 100, ease: 3, tight: true, waistband: 12, slit: 30 },
  skirt_midi: { top: -96, len: 300, flare: 196, ease: 10, folds: 9, waistband: 10 },
  skirt_denim: { top: -24, len: 128, flare: 126, ease: 5, tight: true, denim: true, pattern: 'denim', waistband: 12 },
  // dress skirts (start under the bodice at the waist)
  dskirt_sun: { top: -98, len: 236, flare: 178, ease: 10, folds: 8, pattern: 'floral' },
  dskirt_bodycon: { top: -98, len: 150, flare: 112, ease: 2, tight: true },
  dskirt_wrap: { top: -98, len: 214, flare: 118, ease: 3, cling: true, folds: 7, wrap: true, hilo: 56, ruffle: 26, pattern: 'floral' },
  dskirt_puff: { top: -98, len: 226, flare: 176, ease: 10, folds: 8, pattern: 'floral' },
  dskirt_pinafore: { top: -98, len: 150, flare: 156, ease: 8, folds: 5 },
  coat_lower: { top: -14, len: 262, flare: 150, ease: 16, folds: 5, openGap: [6, 34] },
  dskirt_slip: { top: -98, len: 300, flare: 150, ease: 6, folds: 4, satin: true, base: '#dcdae0' },
  dskirt_midi: { top: -98, len: 304, flare: 190, ease: 10, folds: 10 },
};
// dress bodices (torso space, z 30): end at the waist where the dress skirt takes over
const BODICES = {
  dress_sun: { neck: 'strap', arm: 'racer', hem: -70, loose: 2, bust: 1.2, pattern: 'floral', over: (g) => { edgeLine(g, [[-62, -252], [-30, -238], [0, -248], [30, -238], [62, -252]], 3); straps(g, 50, -250, 6); } },
  dress_bodycon: { neck: 'square', arm: 'tank', hem: 78, loose: 0, bust: 1.3, details: (g) => { for (let y = -200; y < 70; y += 26) stroke(g, [[-110, y], [-40, y + 3], [40, y + 3], [110, y]], 1.4, rgba(CL.sh, 0.35)); } },
  dress_wrap: { neck: 'deepv', hem: -70, loose: 4, bust: 1, pattern: 'floral', details: (g) => { stroke(g, [[-50, -334], [-20, -260], [10, -190], [40, -110]], 3, rgba(CL.ao, 0.6)); }, over: (g) => { stroke(g, [[-80, -96], [0, -100], [80, -96]], 12, rgba(CL.mid, 1)); stroke(g, [[54, -94], [60, -62], [54, -30], [60, 0]], 7, rgba(CL.mid, 1)); stroke(g, [[46, -94], [44, -64], [40, -40]], 6, rgba(CL.mid, 1)); } },   // sash fits the waist; the tie hangs inside the body
  dress_slip: { neck: 'strap', arm: 'racer', hem: -70, loose: 2, bust: 1.2, base: '#dcdae0', over: (g) => { edgeLine(g, [[-58, -252], [-20, -232], [20, -232], [58, -252]], 3); straps(g, 46, -252, 4); } },
  dress_midi: { neck: 'crew', hem: -70, loose: 3, bust: 1, details: (g) => tightNeckband(g, 5) },
  dress_puff: { neck: 'square', hem: -70, loose: 3, bust: 1.1, pattern: 'floral', over: (g) => edgeLine(g, [[-54, -266], [0, -258], [54, -266]], 3) },
  dress_jumpsuit: { neck: 'deepv', arm: 'tank', hem: 80, loose: 3, bust: 1, details: (g) => { stroke(g, [[-60, -334], [-20, -260], [0, -190]], 2, rgba(CL.sh, 0.6)); stroke(g, [[60, -334], [20, -260], [0, -190]], 2, rgba(CL.sh, 0.6)); },
    over: (g) => { stroke(g, [[-96, -100], [0, -104], [96, -100]], 10, rgba(CL.mid, 1)); stroke(g, [[-20, -100], [-28, -60], [-22, -20]], 6, rgba(CL.mid, 1)); stroke(g, [[-14, -100], [-6, -56], [-12, -14]], 6, rgba(CL.mid, 1)); } },
};

// ---------------------------------------------------------------- shoes (foot space: ankle origin, toe toward +x, ground ~y 45)
function shoeTex(kind) {
  const t = tex(-44, -80, 76, 58, 2.5), g = t.g;
  const shoe = (path, base, passes = []) => volume(t, path, base, [{ grad: { x0: 0, y0: -40, x1: 0, y1: 44, stops: [[0, rgba(CL.hi, 0.45)], [1, rgba(CL.sh, 0.5)]] } }, { edge: { color: rgba(CL.ao, 0.6), width: 5, blur: 2 } }, ...passes]);
  if (kind === 'hightop') {
    shoe(P(p => { p.moveTo(-22, -40); p.lineTo(20, -40); p.bezierCurveTo(22, -10, 30, 6, 52, 14); p.bezierCurveTo(66, 20, 68, 34, 64, 40); p.lineTo(-30, 42); p.bezierCurveTo(-32, 10, -28, -20, -22, -40); p.closePath(); }), CL.base);
    g.fillStyle = '#f4f2ee'; g.fillRect(-32, 32, 100, 11); g.fillStyle = rgba('#8c8a90', 1); g.fillRect(-32, 41, 100, 3);
    g.strokeStyle = rgba(CL.deep, 0.85); g.lineWidth = 1.6; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(4 + i * 6, -30 + i * 9); g.lineTo(18 + i * 6, -26 + i * 9); g.stroke(); }
    g.fillStyle = '#f4f2ee'; g.beginPath(); g.arc(-12, -6, 7, 0, 7); g.fill(); g.strokeStyle = rgba(CL.ao, 0.6); g.lineWidth = 1; g.stroke();
    // rubber toe cap and foxing stripe (painted white / black, not dyed... the dye tints them a little; keep them bright)
    g.fillStyle = '#f6f4f0'; g.beginPath(); g.moveTo(44, 26); g.bezierCurveTo(56, 22, 68, 30, 66, 40); g.lineTo(44, 40); g.closePath(); g.fill();
    stroke(g, [[-32, 31], [66, 31]], 2.2, rgba('#1c1b20', 0.8));
  } else if (kind === 'chunky') {
    shoe(P(p => { p.moveTo(-22, -10); p.lineTo(18, -12); p.bezierCurveTo(24, 0, 34, 6, 52, 10); p.bezierCurveTo(66, 16, 70, 26, 68, 32); p.lineTo(-30, 34); p.bezierCurveTo(-32, 14, -30, 0, -22, -10); p.closePath(); }), CL.base);
    const sole = P(p => { p.moveTo(-34, 26); p.lineTo(70, 24); p.quadraticCurveTo(76, 36, 70, 48); p.lineTo(-34, 48); p.quadraticCurveTo(-40, 36, -34, 26); p.closePath(); });
    volume(t, sole, '#f6f4f0', [{ edge: { color: rgba(CL.ao, 0.5), width: 3, blur: 1, keep: true } }, { grad: { x0: 0, y0: 26, x1: 0, y1: 48, stops: [[0, rgba('#ffffff', 0)], [1, rgba('#9a98a0', 0.6)]], keep: true } }]);
    stroke(g, [[-30, 38], [-10, 34], [20, 38], [60, 36]], 1.4, rgba(CL.sh, 0.7));
    g.strokeStyle = rgba(CL.deep, 0.85); g.lineWidth = 1.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(6 + i * 8, -6 + i * 6); g.lineTo(20 + i * 8, -2 + i * 6); g.stroke(); }
    stroke(g, [[-16, 14], [8, 2], [30, 12], [46, 20]], 4, rgba(CL.sh, 0.7));
  } else if (kind === 'workboot' || kind === 'combat') {
    const tall = kind === 'combat' ? -70 : -42;
    shoe(P(p => { p.moveTo(-22, tall); p.lineTo(22, tall); p.bezierCurveTo(24, -10, 30, 6, 50, 14); p.bezierCurveTo(66, 20, 70, 32, 66, 38); p.lineTo(-30, 38); p.bezierCurveTo(-34, 10, -30, tall + 20, -22, tall); p.closePath(); }), CL.base, [{ blob: { x: 36, y: 18, rx: 18, ry: 9, color: rgba('#ffffff', 0.45) } }]);
    g.fillStyle = rgba(CL.ao, 1); g.fillRect(-34, 36, 104, 10); for (let x = -30; x < 66; x += 9) g.fillRect(x, 44, 5, 4);   // lug sole
    g.strokeStyle = rgba('#e8dcc0', 0.95); g.lineWidth = 1.6; const n = kind === 'combat' ? 8 : 5;
    for (let i = 0; i < n; i++) { const y = tall + 6 + i * ((10 - tall) / n); g.beginPath(); g.moveTo(6, y); g.lineTo(22, y + 4); g.stroke(); }
    stroke(g, [[-22, tall + 6], [22, tall + 6]], 6, rgba(CL.sh, 0.8));
    if (kind === 'workboot') stroke(g, [[-30, 20], [10, 22], [40, 26], [64, 30]], 1.6, rgba('#e8dcc0', 0.8));
    for (let x = -32; x < 68; x += 4) stroke(g, [[x, 35], [x + 2, 35]], 1, rgba('#e8dcc0', 0.75));      // welt stitching
    stroke(g, [[-34, 47], [70, 47]], 1.4, rgba('#5a5660', 0.9));                                          // tread edge
  } else if (kind === 'maryjane') {
    shoe(P(p => { p.moveTo(-26, 14); p.bezierCurveTo(-6, 18, 30, 20, 44, 22); p.bezierCurveTo(60, 26, 68, 32, 66, 38); p.bezierCurveTo(66, 44, 60, 46, 52, 46); p.lineTo(-30, 46); p.bezierCurveTo(-34, 32, -32, 20, -26, 14); p.closePath(); }), CL.base, [{ blob: { x: 48, y: 32, rx: 12, ry: 5, color: rgba('#ffffff', 0.75) } }]);
    stroke(g, [[-4, 4], [10, 8], [22, 14], [30, 20]], 6, rgba(CL.base, 1)); stroke(g, [[-4, 4], [10, 8], [22, 14], [30, 20]], 1.2, rgba(CL.ao, 0.7)); button(g, 2, 7, 2.6);
    g.fillStyle = rgba(CL.ao, 1); g.fillRect(-32, 44, 98, 3); g.fillRect(-32, 42, 14, 6);
  } else if (kind === 'ankleboot') {
    shoe(P(p => { p.moveTo(-20, -36); p.lineTo(20, -36); p.bezierCurveTo(22, -6, 34, 10, 56, 18); p.bezierCurveTo(68, 24, 70, 34, 66, 38); p.lineTo(-18, 38); p.lineTo(-24, 34); p.bezierCurveTo(-28, 8, -26, -16, -20, -36); p.closePath(); }), '#cfccd2', [{ blob: { x: 30, y: 16, rx: 20, ry: 8, color: rgba('#ffffff', 0.6) } }]);
    g.fillStyle = rgba(CL.ao, 1); g.fillRect(-26, 36, 18, 10); g.fillRect(-10, 38, 78, 4);   // stacked heel + sole
    stroke(g, [[14, -34], [14, 10]], 1.4, rgba(CL.deep, 0.8));   // side zip
  } else if (kind === 'pump') {
    // high heel: the heel lifted, the arch sloping to the toe; a closed vamp over the instep
    shoe(P(p => { p.moveTo(-22, -6); p.bezierCurveTo(-10, -2, 10, 2, 22, 6); p.bezierCurveTo(40, 14, 58, 26, 68, 36); p.bezierCurveTo(70, 42, 64, 46, 56, 46); p.lineTo(30, 44); p.bezierCurveTo(10, 32, -10, 24, -24, 22); p.bezierCurveTo(-30, 12, -28, 0, -22, -6); p.closePath(); }), '#d2cfd6', [{ blob: { x: 40, y: 26, rx: 16, ry: 6, color: rgba('#ffffff', 0.75) } }]);
    g.fillStyle = rgba(CL.ao, 1); g.beginPath(); g.moveTo(-25, 19); g.lineTo(-12, 22); g.lineTo(-16, 48); g.lineTo(-22, 48); g.closePath(); g.fill();   // tapered heel
  } else if (kind === 'loafer') {
    shoe(P(p => { p.moveTo(-24, -10); p.lineTo(16, -14); p.bezierCurveTo(26, 2, 40, 10, 58, 16); p.bezierCurveTo(70, 22, 70, 36, 64, 40); p.lineTo(-28, 42); p.bezierCurveTo(-32, 20, -30, 2, -24, -10); p.closePath(); }), '#cfccd2', [{ blob: { x: 34, y: 20, rx: 18, ry: 7, color: rgba('#ffffff', 0.6) } }]);
    stroke(g, [[10, 2], [24, 4], [40, 12]], 6, rgba(CL.mid, 1)); stroke(g, [[10, 2], [24, 4], [40, 12]], 1, rgba(CL.ao, 0.8));   // saddle strap
    g.fillStyle = rgba(CL.ao, 1); g.fillRect(-30, 38, 98, 6); g.fillRect(-30, 36, 18, 10);
  } else if (kind === 'flat') {
    shoe(P(p => { p.moveTo(-24, 6); p.bezierCurveTo(-6, 10, 14, 10, 26, 14); p.bezierCurveTo(46, 18, 62, 26, 66, 34); p.bezierCurveTo(68, 42, 62, 44, 54, 44); p.lineTo(-28, 44); p.bezierCurveTo(-32, 30, -30, 14, -24, 6); p.closePath(); }), '#d6d3da', [{ blob: { x: 44, y: 30, rx: 14, ry: 5, color: rgba('#ffffff', 0.7) } }]);
    g.fillStyle = rgba(CL.ao, 1); g.fillRect(-30, 42, 98, 3);
    g.fillStyle = rgba(CL.deep, 0.9); g.beginPath(); g.ellipse(36, 16, 5, 3, 0.3, 0, 7); g.fill();   // little bow
  }
  t.height = { dome: 12, str: 1.0 };
  return t;
}
const SHOES = { shoe_chunky: 'chunky', shoe_workboot: 'workboot', shoe_maryjane: 'maryjane', shoe_combat: 'combat', shoe_hightop: 'hightop', shoe_ankleboot: 'ankleboot', shoe_pump: 'pump', shoe_loafer: 'loafer', shoe_flat: 'flat', shoe_sandal: 'sandal', shoe_heelsandal: 'heelsandal', shoe_strappy: 'strappy' };
// undyed rubber parts drawn over a dyed sneaker (white soles and toe caps stay white in any shoe colour)
function shoeSole(kind) {
  const t = tex(-44, -80, 76, 58, 2.5), g = t.g;
  const laces = (n, x0, y0, dx, dy) => { for (let i = 0; i < n; i++) { const x = x0 + i * dx, y = y0 + i * dy; stroke(g, [[x, y], [x + 14, y + 4]], 2.6, '#f4f2ee'); stroke(g, [[x, y + 1.6], [x + 14, y + 5.6]], 0.8, rgba('#7c7882', 0.7)); } };
  if (kind === 'loafer' || kind === 'flat') {   // polished shine + a light sole edge (stays visible on dark leather)
    const sh = (x, y, rx, ry, a) => paintPass(t, null, { blob: { x, y, rx, ry, color: rgba('#ffffff', a), blur: 1.5, keep: true } });
    if (kind === 'loafer') { sh(36, 20, 14, 5, 0.55); sh(-14, 4, 6, 14, 0.3); stroke(g, [[-30, 37], [68, 37]], 2, '#a88a6a'); stroke(g, [[10, 3], [24, 5], [40, 13]], 1.2, rgba('#ffffff', 0.5)); }
    else { sh(46, 30, 12, 4, 0.6); sh(10, 14, 10, 3, 0.3); stroke(g, [[-30, 41], [68, 41]], 2, '#b0a090'); }
    t.height = { dome: 4, str: 1 }; return t;
  }
  if (kind === 'sandal' || kind === 'heelsandal') {   // light footbed under the straps
    if (kind === 'sandal') { g.fillStyle = '#d6c0a0'; g.fillRect(-30, 38, 98, 6); g.fillStyle = '#4a3a2c'; g.fillRect(-30, 44, 98, 3); }
    else { g.fillStyle = '#d6c0a0'; g.beginPath(); g.moveTo(-24, 17); g.bezierCurveTo(0, 25, 20, 35, 34, 41); g.lineTo(68, 42); g.lineTo(68, 45); g.lineTo(32, 45); g.bezierCurveTo(16, 39, 0, 29, -24, 22); g.closePath(); g.fill(); }
    t.height = { dome: 4, str: 1 }; return t;
  }
  if (kind === 'chunky') {
    const sole = P(p => { p.moveTo(-34, 26); p.lineTo(70, 24); p.quadraticCurveTo(76, 36, 70, 48); p.lineTo(-34, 48); p.quadraticCurveTo(-40, 36, -34, 26); p.closePath(); });
    volume(t, sole, '#f6f4f0', [{ edge: { color: rgba(CL.ao, 0.5), width: 3, blur: 1, keep: true } }, { grad: { x0: 0, y0: 26, x1: 0, y1: 48, stops: [[0, rgba('#ffffff', 0)], [1, rgba('#9a98a0', 0.6)]], keep: true } }]);
    stroke(g, [[-30, 38], [-10, 34], [20, 38], [60, 36]], 1.4, rgba(CL.sh, 0.7));
    laces(4, 6, -6, 7, 6);
    g.fillStyle = '#5d7fa8'; g.beginPath(); g.roundRect(-30, -10, 10, 20, 3); g.fill();
  } else {
    g.fillStyle = '#f4f2ee'; g.fillRect(-32, 32, 100, 11); g.fillStyle = rgba('#8c8a90', 1); g.fillRect(-32, 41, 100, 3);
    stroke(g, [[-32, 32], [68, 32]], 1.6, rgba('#4a4850', 0.8));                       // sole line
    if (kind === 'hightop') {
      g.fillStyle = '#f6f4f0'; g.beginPath(); g.moveTo(40, 24); g.bezierCurveTo(54, 18, 70, 28, 68, 40); g.lineTo(40, 40); g.closePath(); g.fill(); g.strokeStyle = rgba('#4a4850', 0.7); g.lineWidth = 1.2; g.stroke();   // rubber toe cap
      stroke(g, [[-32, 36], [68, 36]], 2.4, rgba('#1c1b20', 0.85));                     // foxing stripe
      laces(6, 2, -30, 5, 8);
      g.fillStyle = '#f4f2ee'; g.beginPath(); g.arc(-12, -8, 7, 0, 7); g.fill(); g.strokeStyle = rgba(CL.ao, 0.7); g.lineWidth = 1.2; g.stroke();   // ankle patch
      stroke(g, [[-24, -40], [22, -40]], 4, rgba('#f4f2ee', 0.9));                       // padded collar
    } else {
      g.fillStyle = '#f8f6f2'; g.beginPath(); g.moveTo(42, 18); g.bezierCurveTo(56, 16, 68, 26, 66, 32); g.lineTo(42, 32); g.closePath(); g.fill(); g.strokeStyle = rgba('#7c7882', 0.8); g.lineWidth = 1.2; g.stroke();   // toe cap
      laces(4, 6, -6, 7, 6);
      g.fillStyle = '#d0605a'; g.beginPath(); g.roundRect(-30, -12, 10, 20, 3); g.fill();                     // heel tab accent
      stroke(g, [[-14, 22], [6, 10], [26, 18], [44, 26]], 3, '#d0605a');                                       // side stripe accent
      stroke(g, [[-14, 22], [6, 10], [26, 18], [44, 26]], 0.8, rgba('#7a2a26', 0.8));
    }
  }
  t.height = { dome: 6, str: 1 };
  return t;
}
// pocket opening drawn over the forearm when a hand is in a front pocket (arm space, wrist ~ y 315, forearm ~ +-23)
function pocketLip() {
  const t = tex(-40, 262, 40, 300, 6), g = t.g;
  const edge = (x) => 270 + 5 * (x / 40) * (x / 40) - 2 * (x / 40);   // the slanted, slightly curved pocket mouth
  const cloth = P(p => { p.moveTo(-40, edge(-40)); for (let x = -40; x <= 40; x += 2) p.lineTo(x, edge(x)); p.lineTo(40, 300); p.lineTo(-40, 300); p.closePath(); });
  volume(t, cloth, CL.base, [
    { grad: { x0: 0, y0: 268, x1: 0, y1: 300, stops: [[0, rgba(CL.ao, 0.55)], [0.25, rgba(CL.base, 0)], [1, rgba(CL.sh, 0.25)]], keep: true } },   // shadow inside the mouth
    { grad: { x0: -40, y0: 0, x1: 40, y1: 0, stops: [[0, rgba(CL.sh, 0.3)], [0.4, rgba(CL.hi, 0.2)], [1, rgba(CL.deep, 0.35)]], keep: true } },
  ]);
  stroke(g, Array.from({ length: 21 }, (_, i) => { const x = -40 + i * 4; return [x, edge(x) - 0.6]; }), 1.6, rgba('#ffffff', 0.55));   // lit lip
  g.save(); g.setLineDash([2.2, 1.6]); stroke(g, Array.from({ length: 21 }, (_, i) => { const x = -40 + i * 4; return [x, edge(x) + 4]; }), 0.8, rgba(CL.deep, 0.8)); g.restore();   // stitch line
  t.height = { dome: 4, str: 1 };
  return t;
}
// bare feet (foot space, base skin palette; the rig tints them to the skin tone): flat, or raised on a heel
function footSkin(raised) {
  const t = tex(-44, -60, 74, 56, 2.5), g = t.g;
  const foot = raised
    ? P(p => { p.moveTo(-18, -16); p.lineTo(16, -16); p.bezierCurveTo(18, 0, 30, 12, 46, 24); p.bezierCurveTo(58, 32, 66, 38, 64, 43); p.bezierCurveTo(56, 46, 40, 45, 32, 42); p.bezierCurveTo(14, 32, -4, 24, -18, 20); p.bezierCurveTo(-26, 12, -24, -4, -18, -16); p.closePath(); })
    : P(p => { p.moveTo(-18, -16); p.lineTo(16, -16); p.bezierCurveTo(18, 4, 28, 16, 46, 24); p.bezierCurveTo(60, 30, 68, 36, 66, 41); p.bezierCurveTo(60, 45, 30, 44, -18, 43); p.bezierCurveTo(-28, 42, -30, 30, -26, 18); p.bezierCurveTo(-24, 6, -22, -6, -18, -16); p.closePath(); });
  volume(t, foot, rgba(SK.base), [
    { grad: { x0: 0, y0: -16, x1: 0, y1: 44, stops: [[0, rgba('#fff1e8', 0.4)], [1, rgba(SK.sh, 0.45)]] } },
    { edge: { color: rgba(SK.sss, 0.45), width: 8, blur: 3 } },
    { blob: { x: -4, y: 6, rx: 6, ry: 5, color: rgba(SK.sh, 0.4) } },          // ankle bone
    { blob: { x: 30, y: 16, rx: 14, ry: 6, color: rgba('#fff3ec', 0.45) } },   // top of the foot
  ]);
  // toes: a few creases at the front, a pale nail on the big toe
  for (const x of [52, 57, 61]) stroke(g, [[x, raised ? 33 : 32], [x + 2, raised ? 41 : 40]], 0.9, rgba(SK.deep, 0.45));
  g.fillStyle = rgba('#f7d9cf', 0.9); g.beginPath(); g.ellipse(raised ? 60 : 62, raised ? 37 : 35, 3.4, 2.2, 0.4, 0, 7); g.fill();
  t.height = { dome: 12, str: 1.0 };
  return t;
}
// strap shoes over a bare foot (dyed with the shoe colour)
function strapShoe(kind) {
  const t = tex(-44, -60, 74, 56, 2.5), g = t.g;
  const strap = (pts, w = 5) => { w *= 1.6; stroke(g, pts, w, rgba(CL.base, 1)); stroke(g, pts, w * 0.3, rgba('#ffffff', 0.5)); stroke(g, pts.map(([x, y]) => [x, y + w * 0.45]), 1.2, rgba(CL.ao, 0.7)); };
  if (kind === 'sandal') {

    strap([[-22, -2], [-6, 2], [10, 2], [20, -2]], 6);                          // ankle strap
    strap([[18, 4], [26, 14], [36, 22], [44, 30]], 6);                          // instep
    strap([[40, 22], [48, 26], [56, 30], [62, 36]], 6);                         // toe strap
    strap([[-22, 18], [-24, 28], [-24, 36], [-22, 42]], 5);                     // heel strap
  } else if (kind === 'heelsandal') {
    g.fillStyle = rgba(CL.ao, 1); g.beginPath(); g.moveTo(-22, 18); g.bezierCurveTo(0, 26, 20, 36, 34, 43); g.lineTo(66, 45); g.lineTo(66, 48); g.lineTo(32, 47); g.bezierCurveTo(16, 40, 0, 30, -22, 23); g.closePath(); g.fill();   // sole
    g.beginPath(); g.moveTo(-26, 19); g.lineTo(-10, 24); g.lineTo(-12, 48); g.lineTo(-24, 48); g.closePath(); g.fill();   // block heel
    g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(-23, 26, 3, 20);
    strap([[-22, -2], [-6, 2], [10, 2], [20, -2]], 5);
    strap([[44, 26], [50, 30], [58, 36], [64, 40]], 7);                          // toe band
    strap([[-22, 6], [-24, 12], [-24, 18]], 5);
  } else if (kind === 'strappy') {
    g.fillStyle = rgba(CL.base, 1); g.fillRect(-30, 41, 98, 4); g.fillStyle = rgba(CL.ao, 1); g.fillRect(-30, 44, 98, 2);
    strap([[-24, 18], [-26, 30], [-24, 40], [-10, 42]], 7);                     // heel cup
    strap([[40, 26], [50, 30], [58, 34], [66, 40]], 8);                         // toe cap
    strap([[-20, 2], [-4, 6], [10, 6], [20, 2]], 5);                            // ankle strap
    strap([[4, 6], [12, 12], [22, 20], [34, 26]], 4);                           // T-strap down the instep
  }
  t.height = { dome: 6, str: 1.0 };
  return t;
}

// ---------------------------------------------------------------- short hair (head space, like the film hair cap)
function shortHair(style) {
  const t = tex(-170, -215, 170, 60, 2.4), g = t.g, r = rng(style.length * 13 + 7);
  const top = { crop: -146, sidepart: -152, buzz: -136, curly: -176, quiff: -178, pixie: -150 }[style];
  // sides hug the skull (face outline is x=+-103): short hair adds only a few units of volume there
  const side = { buzz: 104, crop: 107, sidepart: 108, quiff: 106, curly: 116, pixie: 110 }[style], hairY = style === 'pixie' ? 10 : -6;
  // silhouette: dome over the skull down to the sideburns, hairline across the forehead
  const shape = P(p => {
    p.moveTo(0, top); p.bezierCurveTo(side * 0.8, top, side + 12, top * 0.6, side + 8, -40); p.bezierCurveTo(side + 6, -14, side, hairY - 10, side - 6, hairY);
    p.lineTo(side - 16, hairY); p.bezierCurveTo(side - 18, -40, side - 30, -78, 70, -96);
    p.bezierCurveTo(40, -110, -40, -110, -70, -96); p.bezierCurveTo(-side + 30, -78, -side + 18, -40, -side + 16, hairY); p.lineTo(-side + 6, hairY);
    p.bezierCurveTo(-side, hairY - 10, -side - 6, -14, -side - 8, -40); p.bezierCurveTo(-side - 12, top * 0.6, -side * 0.8, top, 0, top); p.closePath();
  });
  g.save(); g.fillStyle = '#060508'; g.filter = `blur(${0.8 * t.D}px)`; g.fill(shape); g.restore();
  g.save(); g.clip(shape);
  if (style === 'buzz') {
    for (let i = 0; i < 9000; i++) { const x = (r() - 0.5) * 2 * (side + 10), y = top + r() * (hairY - top); g.fillStyle = rgba(r() < 0.35 ? '#5a5f6e' : '#1c1a22', 0.5); g.fillRect(x, y, 0.5, 1.4); }
  } else if (style === 'curly') {
    for (let i = 0; i < 520; i++) {
      const a = r() * Math.PI, rr = Math.sqrt(r()), x = Math.cos(a) * (side + 4) * rr * (r() < 0.5 ? -1 : 1), y = top + 10 + (1 - Math.sin(a) * rr) * (hairY - top - 10) * r();
      const R = 5 + r() * 6, lit = Math.max(0, (-x - y * 0.6) / 240);
      g.strokeStyle = rgba(lit > 0.3 ? '#7f8698' : '#24212b', 0.8); g.lineWidth = 1.2 + r(); g.beginPath(); g.arc(x, y, R, r() * 6, r() * 6 + 4.2); g.stroke();
    }
  } else {
    // clumps combed from a part (or the crown) toward the sides / forward
    const part = style === 'sidepart' ? -44 : style === 'quiff' ? 0 : -6;
    const N = style === 'quiff' ? 26 : 30;
    for (let k = 0; k < N; k++) {
      const f = k / (N - 1) * 2 - 1, sx = Math.sign(f) || 1, af = Math.abs(f);
      let spine;
      if (style === 'quiff') spine = [[f * 50, -100], [f * 54, top + 18], [f * 70, top + 6], [f * 104, top + 60]];       // swept up and back
      else if (style === 'pixie') spine = [[part + f * 10, top + 6], [f * 70, top + 20], [f * 100, -70], [f * 70 + 20, -82]]; // forward fringe
      else spine = [[part + f * 8, top + 4], [part + f * (40 + af * 40), top + 16 + af * 20], [sx * (side - 4) * (0.6 + af * 0.4), -60 + af * 20], [sx * (side - 8), hairY - 6]];
      clump(t, spine, u => (style === 'crop' ? 9 : 11) * (1 - u * 0.4), { seed: k * 11 + style.length, strands: 90, fly: 1, frizz: 0.3, tipVar: 0.2, coreAlpha: 0.6, lit: sx < 0 ? 0.65 : 0.45, hi: '#8e97ab', crown: 0.2, crownK: 0.2 });
    }
  }
  g.restore();
  t.height = { dome: 26, str: 0.9, detail: 5, detailBlur: 3, aoR: 6, ao: 4 };
  return t;
}

// ---------------------------------------------------------------- facial hair
function beard(kind) {
  // face space (same box as the face texture); mouth sits at y~64, width ~+-24
  const t = tex(-135, -150, 135, 140, 2.4), g = t.g, r = rng(kind.length * 31);
  const area = P(p => {
    if (kind === 'goatee') { p.moveTo(-26, 82); p.bezierCurveTo(-30, 110, -14, 126, 0, 128); p.bezierCurveTo(14, 126, 30, 110, 26, 82); p.bezierCurveTo(10, 78, -10, 78, -26, 82); }
    else { // full beard / stubble: sideburns down the jaw, around the chin, under the lower lip
      p.moveTo(-100, -4); p.bezierCurveTo(-104, 40, -88, 86, -50, 112); p.bezierCurveTo(-30, 124, 30, 124, 50, 112); p.bezierCurveTo(88, 86, 104, 40, 100, -4);
      p.lineTo(88, -4); p.bezierCurveTo(88, 30, 76, 54, 56, 66); p.bezierCurveTo(40, 74, 30, 84, 22, 82); p.bezierCurveTo(10, 78, -10, 78, -22, 82);
      p.bezierCurveTo(-30, 84, -40, 74, -56, 66); p.bezierCurveTo(-76, 54, -88, 30, -88, -4); }
    p.closePath();
  });
  g.save(); g.clip(area);
  if (kind === 'stubble') {
    g.filter = `blur(${0.25 * t.D}px)`;
    for (let i = 0; i < 7000; i++) { const x = (r() - 0.5) * 210, y = -10 + r() * 140; g.fillStyle = rgba('#2a2026', 0.28 + r() * 0.2); g.fillRect(x, y, 0.6, 0.9); }
    g.filter = `blur(${3 * t.D}px)`; g.fillStyle = rgba('#5a4a50', 0.18); g.fill(area);
  } else {
    g.fillStyle = rgba('#100c10', 0.85); g.filter = `blur(${1 * t.D}px)`; g.fill(area); g.filter = 'none';
    for (let i = 0; i < 2200; i++) { const x = (r() - 0.5) * 210, y = -10 + r() * 140, a = Math.atan2(y - 20, x) * 0.2 + Math.PI / 2; const L = 4 + r() * 6;
      g.strokeStyle = rgba(r() < 0.3 ? '#6e7282' : '#221e26', 0.7); g.lineWidth = 0.5 + r() * 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  }
  g.restore();
  t.height = { dome: 8, str: 0.8, detail: 4, detailBlur: 2 };
  return t;
}
function mustache() {
  // mouth space: y=0 is where the lips meet; the mustache sits on the upper lip
  const t = tex(-46, -34, 46, 6, 4), g = t.g, r = rng(77);
  const area = P(p => { p.moveTo(-36, -6); p.bezierCurveTo(-30, -24, -8, -26, 0, -20); p.bezierCurveTo(8, -26, 30, -24, 36, -6); p.bezierCurveTo(24, -12, 10, -12, 0, -10); p.bezierCurveTo(-10, -12, -24, -12, -36, -6); p.closePath(); });
  g.save(); g.clip(area); g.fillStyle = rgba('#120e12', 0.9); g.fill(area);
  for (let i = 0; i < 900; i++) { const x = (r() - 0.5) * 72, y = -24 + r() * 18, a = Math.PI / 2 + Math.sign(x) * 0.5; g.strokeStyle = rgba(r() < 0.3 ? '#737788' : '#231e26', 0.7); g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); }
  g.restore();
  t.height = { dome: 6, str: 0.8, detail: 3, detailBlur: 2 };
  return t;
}

// ---------------------------------------------------------------- catalogue of textures
// paintWardrobe(want) paints only the textures `want(name)` accepts (bake.mjs passes the requested list)
export function paintWardrobe(want = () => true) {
  const R = {};
  const add = (k, fn) => { if (want(k)) R[k] = fn; };
  add('torsoF', () => torsoSkin('female')); add('torsoM', () => torsoSkin('male')); add('legSkin', legSkin);
  for (const s of ['f', 'm']) add(`top_halter_${s}`, () => topTexture('halter', s === 'f' ? 'female' : 'male'));
  for (const [k, spec] of Object.entries({ ...TOPS, ...TOPS2 })) for (const s of TOP_SEX[k]) add(`top_${k}_${s}`, () => torsoGarment({ ...spec, seed: k.length }, s));
  add('bib_overalls', () => bib('overalls')); add('bib_pinafore', () => bib('pinafore')); add('print_smiley', printSmiley);
  for (const [k, fn] of Object.entries(ACCESSORIES)) add(k, fn);
  add('hood_back', hoodBack);
  for (const [k, o] of Object.entries(SLEEVES)) add(k, () => sleeveTex(o));
  for (const k of ['leggings', 'bike', 'joggers', 'trousers', 'chinos', 'jeans', 'shorts', 'cargo', 'cargoshorts', 'wide']) add(`hips_${k}`, () => hipsTex(k));
  for (const [k, o] of Object.entries(LEGS)) add(k, () => legTex(o));
  for (const [k, o] of Object.entries(SKIRTS)) add(k, () => skirtTex(o));
  for (const [k, o] of Object.entries(BODICES)) add(k, () => torsoGarment({ ...o, seed: k.length }, 'f'));
  add('sneaker', sneaker);
  for (const [k, kind] of Object.entries(SHOES)) add(k, () => ['sandal', 'heelsandal', 'strappy'].includes(kind) ? strapShoe(kind) : shoeTex(kind));
  for (const k of ['sneaker', 'hightop', 'chunky', 'sandal', 'heelsandal', 'loafer', 'flat']) add(`sole_${k}`, () => shoeSole(k));
  add('pocket_lip', pocketLip);
  add('foot_skin', () => footSkin(false)); add('foot_skin_heel', () => footSkin(true));
  add('mustache', mustache);
  for (const k of ['crop', 'sidepart', 'buzz', 'curly', 'quiff', 'pixie']) add(`hair_${k}`, () => shortHair(k));
  for (const k of ['stubble', 'beard', 'goatee']) add(`beard_${k}`, () => beard(k));
  SHADING.k = 0.55;
  const T = {};
  for (const [k, fn] of Object.entries(R)) T[k] = fn();
  SHADING.k = 1;
  return T;
}
