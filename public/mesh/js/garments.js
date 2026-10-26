// Creator wardrobe catalogue. Each garment is a stack of painted layers (textures in creator/tex/,
// painted by creator/paint/wardrobe.js) that ride on the rig part whose space they were painted in.
// heroine.drawLook() draws them.
//
// layer fields
//   tex    texture name; '{s}' is replaced by 'f' or 'm' (body painted for a woman / man)
//   space  'torso' | 'arm' | 'leg' | 'foot'
//   z      draw order inside its space. torso space: < 0 behind the body skin (hood, cape back),
//          10 bottoms at the hips, 20 skirts, 30 tops, 40 outerwear, 50 collars/scarves.
//          arm/leg/foot space: higher z draws later (sleeve over skin, jacket sleeve over shirt sleeve)
//   dye    'top' | 'bottom' | 'shoes' | 'none' (keep painted colours) | '#rrggbb' (fixed colour)
//   mat    'cloth' | 'knit' | 'denim' | 'satin' | 'leather' | 'skin'
//   grid   optional [cols, rows] mesh density (defaults suit the space)
//   cover  arm layers: [y0, y1] arm-space span the sleeve fully covers (the rig can skip the faded
//          forearm-pass skin under it, so no skin shows through the sleeve while it fades in)
//   swing  torso layers: follow the average of both thighs (long skirts hang between the legs)
// garment fields
//   label, icon (SVG markup, viewBox 0 0 64 52), sex: 'any' | 'female' | 'male' (randomize pools)
//   full: true  -> a dress / jumpsuit: it covers the hips and legs, the bottoms choice is ignored
//   heel: n     -> shoes: the shoe is painted with an n-unit heel
//   pockets: true -> a full garment (dress / jumpsuit / overalls) with front pockets the hands can go into
// GARMENTS.accessory: belts, scarf, bags (painted colours) worn over any outfit
const A = '#f2b15a', K = '#2a1d16';
const ic = (d, fill = A, extra = '') => `<path d="${d}" fill="${fill}" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>${extra}`;
const ln = (d, w = 1.2) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w}"/>`;
// silhouettes reused by the icons
const TEE = 'M14 16 L26 10 Q32 16 38 10 L50 16 L56 26 L48 30 L46 26 L46 46 L18 46 L18 26 L16 30 L8 26Z';
const LONG = 'M14 16 L26 10 Q32 16 38 10 L50 16 L58 44 L50 46 L46 28 L46 46 L18 46 L18 28 L14 46 L6 44Z';
const PANTS = (w = 0) => `M20 6 L44 6 L${44 + w} 48 L35 48 L32 18 L29 48 L${20 - w} 48Z`;
const SKIRT = (top, hem, half) => `M${32 - (top === 6 ? 11 : 10)} ${top} L${32 + (top === 6 ? 11 : 10)} ${top} L${32 + half} ${hem} L${32 - half} ${hem}Z`;
const torso = (tex, z = 30, dye = 'top', mat = 'cloth') => ({ tex, space: 'torso', z, dye, mat });
// arm-space span each sleeve covers (start, end of the cloth)
const COVER = { sleeveShort: [-72, 92], sleeveCap: [-72, 56], sleeveLong: [-72, 300], sleeveHoodie: [-72, 300], sleeveKnit: [-72, 300], sleevePlaid: [-72, 300],
  sleeveRolled: [-72, 200], sleevePlaidRolled: [-72, 200], sleeveStripe: [-72, 230], sleevePuff: [-72, 104], sleeveBell: [-72, 312], sleeveOff: [34, 118],
  sleeveFlutter: [-72, 80], sleeveJacket: [-72, 302], sleeveDenim: [-72, 302], sleeveBomber: [-72, 302], sleeveFitted: [-72, 306], sleevePuffFloral: [-72, 104],
  sleeveFlutterFloral: [-72, 80], sleeveCoat: [-72, 304], sleeveFitShort: [-72, 82] };
const arm = (tex, z = 10, dye = 'top', mat = 'cloth') => ({ tex, space: 'arm', z, dye, mat, cover: COVER[tex] });
const leg = (tex, dye = 'bottom', mat = 'cloth') => ({ tex, space: 'leg', z: 10, dye, mat });
const foot = (tex, mat = 'leather', dye = 'shoes') => ({ tex, space: 'foot', z: 10, dye, mat });
const WHITE = '#f2f0ec', INK = '#1c1b20';

export const GARMENTS = {
  top: {
    // basics
    tee: { label: 'T-shirt', sex: 'any', icon: ic(TEE), layers: [torso('top_tee_{s}'), arm('sleeveShort')] },
    tank: { label: 'Tank top', sex: 'any', icon: ic('M22 10 Q32 22 42 10 L46 22 L46 46 L18 46 L18 22Z'), layers: [torso('top_tank_{s}')] },
    vtee: { label: 'V-neck tee', sex: 'any', icon: ic(TEE, A, ln('M26 10 L32 22 L38 10', 1.6)), layers: [torso('top_vtee_{s}'), arm('sleeveShort')] },
    stripe: { label: 'Striped tee', sex: 'any', icon: ic(TEE, A, ln('M18 30 H46 M18 36 H46 M18 42 H46', 2.5)), layers: [torso('top_stripe_{s}'), arm('sleeveStripe')] },
    shirt: { label: 'Button shirt', sex: 'any', icon: ic(LONG, A, ln('M32 18 V46') + ln('M26 10 L32 18 L38 10')), layers: [torso('top_shirt_{s}'), arm('sleeveLong')] },
    flannel: { label: 'Flannel', sex: 'any', icon: ic(LONG, A, ln('M18 24 H46 M18 34 H46 M24 14 V46 M40 14 V46', 2)), layers: [torso('top_flannel_{s}'), arm('sleevePlaidRolled')] },
    graphichoodie: { label: 'Graphic hoodie', sex: 'any', icon: ic(LONG, A, '<circle cx="32" cy="26" r="6" fill="#e8c44a" stroke="#2a1d16"/>' + `<path d="M22 12 Q32 2 42 12" fill="${A}" stroke="${K}" stroke-width="1.4"/>`),
      layers: [torso('hood_back', -10, 'top', 'knit'), torso('top_hoodie_{s}', 30, 'top', 'knit'), torso('print_smiley', 31, 'none', 'cloth'), arm('sleeveHoodie', 10, 'top', 'knit')] },
    hoodie: { label: 'Hoodie', sex: 'any', icon: ic(LONG, A, ln('M24 34 h16 l2 8 h-20Z') + `<path d="M22 12 Q32 2 42 12" fill="${A}" stroke="${K}" stroke-width="1.4"/>`),
      layers: [torso('hood_back', -10, 'top', 'knit'), torso('top_hoodie_{s}', 30, 'top', 'knit'), arm('sleeveHoodie', 10, 'top', 'knit')] },
    sweater: { label: 'Sweater', sex: 'any', icon: ic(LONG, A, ln('M18 42 H46 M24 14 Q32 20 40 14', 2)), layers: [torso('top_sweater_{s}', 30, 'top', 'knit'), arm('sleeveKnit', 10, 'top', 'knit')] },
    // women
    crop: { label: 'Crop top', sex: 'female', icon: ic('M14 16 L26 10 Q32 16 38 10 L50 16 L56 26 L48 30 L46 26 L46 34 L18 34 L18 26 L16 30 L8 26Z'), layers: [torso('top_crop_f'), arm('sleeveCap')] },
    cami: { label: 'Camisole', sex: 'female', icon: ic('M20 22 Q32 28 44 22 L46 46 L18 46Z', A, ln('M22 22 L24 8 M42 22 L40 8')), layers: [torso('top_cami_f', 30, 'top', 'satin')] },
    offshoulder: { label: 'Off-shoulder', sex: 'female', icon: ic('M8 20 Q32 26 56 20 L52 30 L46 28 L46 46 L18 46 L18 28 L12 30Z'), layers: [torso('top_offshoulder_f'), arm('sleeveOff')] },
    blouse: { label: 'Blouse', sex: 'female', icon: ic('M14 16 L26 10 L32 22 L38 10 L50 16 L60 44 L50 46 L46 28 L47 46 L17 46 L18 28 L14 46 L4 44Z'), layers: [torso('top_blouse_f'), arm('sleeveBell')] },
    puff: { label: 'Puff-sleeve top', sex: 'female', icon: ic('M14 14 Q6 16 8 28 Q14 30 18 26 L18 40 L46 40 L46 26 Q50 30 56 28 Q58 16 50 14 L38 10 Q32 18 26 10Z'), layers: [torso('top_crop_f'), arm('sleevePuff')] },
    fitted: { label: 'Fitted scoop tee', sex: 'female', icon: ic(TEE, A, ln('M24 12 Q32 24 40 12', 1.6)), layers: [torso('top_fitted_f', 30, 'top', 'knit'), arm('sleeveFitShort', 10, 'top', 'knit')] },
    turtleneck: { label: 'Turtleneck', sex: 'any', icon: ic(LONG, A, `<rect x="26" y="4" width="12" height="8" fill="${A}" stroke="${K}" stroke-width="1.4"/>`), layers: [torso('top_turtle_{s}', 30, 'top', 'knit'), arm('sleeveFitted', 10, 'top', 'knit')] },
    tube: { label: 'Tube top', sex: 'female', icon: ic('M18 18 L46 18 L46 42 L18 42Z'), layers: [torso('top_tube_f')] },
    halter: { label: 'Halter', sex: 'female', icon: ic('M24 12 L40 12 L46 24 L44 46 L20 46 L18 24Z'), layers: [torso('top_halter_{s}', 30, 'top', 'satin')] },
    // men
    polo: { label: 'Polo', sex: 'male', icon: ic(TEE, A, ln('M32 12 V24') + ln('M26 10 L30 16 M38 10 L34 16')), layers: [torso('top_polo_m'), arm('sleeveShort')] },
    henley: { label: 'Henley', sex: 'any', icon: ic(LONG, A, ln('M32 13 V26') + '<circle cx="32" cy="17" r="1.2"/><circle cx="32" cy="22" r="1.2"/>'), layers: [torso('top_henley_{s}'), arm('sleeveRolled')] },
    // layered: jacket over a fixed-colour top (jacket takes the top colour)
    flannelover: { label: 'Open flannel', sex: 'any', icon: ic(LONG, A, `<path d="M28 12 L28 46 L36 46 L36 12" fill="${WHITE}" stroke="${K}" stroke-width="1"/>` + ln('M18 24 H28 M36 24 H46 M18 34 H28 M36 34 H46', 2)),
      layers: [torso('top_tee_{s}', 30, WHITE), torso('top_flannelopen_{s}', 40), arm('sleevePlaidRolled', 20)] },
    vest: { label: 'Sweater vest', sex: 'any', icon: ic(LONG, WHITE, ic('M22 12 L32 30 L42 12 L46 22 L46 46 L18 46 L18 22Z')),
      layers: [torso('top_shirt_{s}', 30, WHITE), arm('sleeveLong', 10, WHITE), torso('top_vest_{s}', 40, 'top', 'knit')] },
    coat: { label: 'Long coat', sex: 'any', icon: ic('M14 16 L26 10 L32 26 L38 10 L50 16 L56 50 L48 50 L46 30 L48 60 L16 60 L18 30 L16 50 L8 50Z', A, ln('M32 26 V60') + ln('M18 34 H46', 3)),
      layers: [torso('top_tee_{s}', 30, '#1c1b20'), torso('top_coat_{s}', 40), { ...torso('coat_lower', 45), swing: true }, arm('sleeveCoat', 20)] },
    cardigan: { label: 'Cardigan', sex: 'female', icon: ic(LONG, A, `<path d="M28 14 L32 46 L36 14" fill="${WHITE}" stroke="${K}" stroke-width="1.2"/>`),
      layers: [torso('top_cami_f', 30, WHITE, 'satin'), torso('top_cardigan_{s}', 40, 'top', 'knit'), arm('sleeveKnit', 20, 'top', 'knit')] },
    denimjacket: { label: 'Denim jacket', sex: 'any', icon: ic(LONG, '#7d9bc4', `<path d="M30 12 L30 46 L34 46 L34 12" fill="${WHITE}" stroke="${K}" stroke-width="1"/>`),
      layers: [torso('top_tee_{s}', 30, WHITE), torso('top_denimjacket_{s}', 40, 'top', 'denim'), arm('sleeveDenim', 20, 'top', 'denim')] },
    blazer: { label: 'Blazer', sex: 'any', icon: ic(LONG, A, `<path d="M28 12 L32 28 L36 12" fill="${WHITE}" stroke="${K}" stroke-width="1.2"/>` + ln('M24 12 L32 30 L40 12', 2)),
      layers: [torso('top_shirt_{s}', 30, WHITE), torso('top_blazer_{s}', 40, 'top', 'cloth'), arm('sleeveJacket', 20, 'top', 'cloth')] },
    bomber: { label: 'Bomber jacket', sex: 'male', icon: ic(LONG, A, ln('M32 12 V46') + ln('M18 42 H46', 3)),
      layers: [torso('top_tee_m', 30, WHITE), torso('top_bomber_m', 40, 'top', 'satin'), arm('sleeveBomber', 20, 'top', 'satin')] },
    // dresses (cover the hips and legs; the bottoms choice is ignored)
    sundress: { label: 'Sundress', sex: 'female', full: true, icon: ic('M24 14 L40 14 L44 24 L54 50 L10 50 L20 24Z', A, ln('M26 14 L26 4 M38 14 L38 4')),
      layers: [torso('dress_sun'), { ...torso('dskirt_sun', 20), swing: true }] },
    bodycon: { label: 'Bodycon', sex: 'female', full: true, icon: ic('M22 8 L42 8 L44 26 L40 50 L24 50 L20 26Z'), layers: [torso('dress_bodycon'), torso('dskirt_bodycon', 20)] },
    wrapdress: { label: 'Floral wrap dress', sex: 'female', full: true, icon: ic('M16 14 L26 8 L32 22 L38 8 L48 14 L44 22 L54 46 Q32 54 10 52 L20 22Z', A, ln('M26 8 L40 28 M20 26 H44', 1.6)),
      layers: [torso('dress_wrap'), torso('dskirt_wrap', 20), arm('sleeveFlutterFloral')] },
    puffdress: { label: 'Puff-sleeve dress', sex: 'female', full: true, icon: ic('M22 14 L42 14 L44 24 L54 50 L10 50 L20 24Z', A, '<circle cx="18" cy="18" r="6" fill="#f2b15a" stroke="#2a1d16"/><circle cx="46" cy="18" r="6" fill="#f2b15a" stroke="#2a1d16"/>'),
      layers: [torso('dress_puff'), { ...torso('dskirt_puff', 20), swing: true }, arm('sleevePuffFloral')] },
    pinafore: { label: 'Pinafore dress', sex: 'female', full: true, icon: ic('M20 18 L44 18 L46 26 L54 50 L10 50 L18 26Z', A, `<path d="M14 14 Q32 8 50 14" fill="${WHITE}" stroke="${K}"/>` + ln('M24 18 L22 6 M40 18 L42 6', 2)),
      layers: [torso('top_tee_f', 30, WHITE), arm('sleevePuff', 10, WHITE), torso('dskirt_pinafore', 33), torso('bib_pinafore', 35)] },
    overalls: { label: 'Overalls & tee', sex: 'any', full: true, pockets: true, icon: ic('M20 12 L44 12 L44 48 L35 48 L32 26 L29 48 L20 48Z', '#7d9bc4', ln('M22 12 L18 2 M42 12 L46 2', 3) + `<path d="M14 8 L24 4 L40 4 L50 8 L46 14 L18 14Z" fill="#1c1b20"/>`),
      layers: [torso('top_tee_{s}', 30, '#1c1b20'), arm('sleeveShort', 10, '#1c1b20'), torso('hips_jeans', 10, 'top', 'denim'), torso('bib_overalls', 35, 'top', 'denim'), leg('legs_overalls', 'top', 'denim')] },
    jumpsuit: { label: 'Jumpsuit', sex: 'female', full: true, pockets: true, icon: ic('M22 8 Q32 20 42 8 L46 22 L48 50 L36 50 L32 30 L28 50 L16 50 L18 22Z', A, ln('M18 26 H46', 3)),
      layers: [torso('dress_jumpsuit'), torso('hips_wide', 10), leg('legs_wide', 'top')] },
    slipdress: { label: 'Slip dress', sex: 'female', full: true, icon: ic('M22 14 Q32 20 42 14 L46 52 L18 52Z', A, ln('M23 14 L25 4 M41 14 L39 4')),
      layers: [torso('dress_slip', 30, 'top', 'satin'), { ...torso('dskirt_slip', 20, 'top', 'satin'), swing: true }] },
    mididress: { label: 'Midi dress', sex: 'female', full: true, icon: ic('M14 14 L26 8 Q32 14 38 8 L50 14 L54 22 L46 24 L46 20 L56 52 L8 52 L18 20 L18 24 L10 22Z'),
      layers: [torso('dress_midi'), { ...torso('dskirt_midi', 20), swing: true }, arm('sleeveShort')] },
  },
  bottom: {
    jeans: { label: 'Jeans', sex: 'any', icon: ic(PANTS(), '#7d9bc4', ln('M20 12 H44')), layers: [torso('hips_jeans', 10, 'bottom', 'denim'), leg('legs_jeans', 'bottom', 'denim')] },
    leggings: { label: 'Leggings', sex: 'female', icon: ic('M20 6 L44 6 L42 48 L35 48 L32 18 L29 48 L22 48Z'), layers: [torso('hips_leggings', 10, 'bottom', 'satin'), leg('legs_leggings', 'bottom', 'satin')] },
    wide: { label: 'Wide-leg trousers', sex: 'female', icon: ic('M20 6 L44 6 L50 48 L35 48 L32 18 L29 48 L14 48Z'), layers: [torso('hips_wide', 10, 'bottom'), leg('legs_wide')] },
    trousers: { label: 'Trousers', sex: 'any', icon: ic(PANTS(1), A, ln('M26 10 V48 M38 10 V48', 0.8)), layers: [torso('hips_trousers', 10, 'bottom'), leg('legs_trousers')] },
    chinos: { label: 'Chinos', sex: 'male', icon: ic(PANTS(), '#d8c49a'), layers: [torso('hips_chinos', 10, 'bottom'), leg('legs_trousers')] },
    rolledjeans: { label: 'Rolled jeans', sex: 'any', icon: ic('M20 6 L44 6 L44 44 L35 44 L32 18 L29 44 L20 44Z', '#7d9bc4', ln('M20 40 H29 M35 40 H44', 3)), layers: [torso('hips_jeans', 10, 'bottom', 'denim'), leg('legs_jeansroll', 'bottom', 'denim')] },
    ripped: { label: 'Ripped jeans', sex: 'any', icon: ic(PANTS(), '#7d9bc4', ln('M22 28 h5 M37 32 h5 M23 38 h4', 1.6)), layers: [torso('hips_jeans', 10, 'bottom', 'denim'), leg('legs_ripped', 'bottom', 'denim')] },
    overalls: { label: 'Overalls', sex: 'any', icon: ic('M20 4 L44 4 L44 48 L35 48 L32 22 L29 48 L20 48Z', '#7d9bc4', ln('M22 4 L18 -6 M42 4 L46 -6', 3) + `<rect x="26" y="8" width="12" height="8" fill="none" stroke="${K}"/>`),
      layers: [torso('hips_jeans', 10, 'bottom', 'denim'), torso('bib_overalls', 35, 'bottom', 'denim'), leg('legs_overalls', 'bottom', 'denim')] },
    cargorolled: { label: 'Cargo (rolled)', sex: 'any', icon: ic('M20 6 L44 6 L46 44 L35 44 L32 18 L29 44 L18 44Z', A, ln('M18 40 H29 M35 40 H46', 3)), layers: [torso('hips_cargo', 10, 'bottom'), leg('legs_cargoroll')] },
    cargo: { label: 'Cargo pants', sex: 'any', icon: ic(PANTS(2), A, `<rect x="16" y="24" width="7" height="9" fill="none" stroke="${K}"/><rect x="41" y="24" width="7" height="9" fill="none" stroke="${K}"/>`), layers: [torso('hips_cargo', 10, 'bottom'), leg('legs_cargo')] },
    joggers: { label: 'Joggers', sex: 'any', icon: ic('M20 6 L44 6 L42 44 L35 44 L32 18 L29 44 L22 44Z', A, ln('M22 40 H29 M35 40 H42', 3)), layers: [torso('hips_joggers', 10, 'bottom', 'knit'), leg('legs_joggers', 'bottom', 'knit')] },
    shorts: { label: 'Denim shorts', sex: 'any', icon: ic('M20 8 L44 8 L46 28 L34 28 L32 16 L30 28 L18 28Z', '#7d9bc4'), layers: [torso('hips_shorts', 10, 'bottom', 'denim'), leg('legs_shorts', 'bottom', 'denim')] },
    bike: { label: 'Bike shorts', sex: 'female', icon: ic('M20 8 L44 8 L44 26 L34 26 L32 16 L30 26 L20 26Z'), layers: [torso('hips_bike', 10, 'bottom', 'satin'), leg('legs_bike', 'bottom', 'satin')] },
    cargoshorts: { label: 'Cargo shorts', sex: 'male', icon: ic('M19 8 L45 8 L48 34 L34 34 L32 16 L30 34 L16 34Z', A, `<rect x="15" y="22" width="7" height="8" fill="none" stroke="${K}"/>`), layers: [torso('hips_cargoshorts', 10, 'bottom'), leg('legs_cargoshorts')] },
    mini: { label: 'Mini skirt', sex: 'female', icon: ic(SKIRT(8, 30, 18)), layers: [torso('skirt_mini', 20, 'bottom')] },
    pleated: { label: 'Pleated skirt', sex: 'female', icon: ic(SKIRT(6, 34, 20), A, ln('M26 6 L22 34 M30 6 L28 34 M34 6 L36 34 M38 6 L42 34', 1)), layers: [torso('skirt_pleated', 20, 'bottom')] },
    pencil: { label: 'Pencil skirt', sex: 'female', icon: ic('M21 6 L43 6 L45 20 L42 46 L22 46 L19 20Z', A, ln('M36 46 V38')), layers: [torso('skirt_pencil', 20, 'bottom')] },
    midi: { label: 'Flowy midi skirt', sex: 'female', icon: ic(SKIRT(6, 50, 24), A, ln('M28 10 Q24 30 20 50 M36 10 Q40 30 44 50', 1)), layers: [{ ...torso('skirt_midi', 20, 'bottom'), swing: true }] },
    denimskirt: { label: 'Denim skirt', sex: 'female', icon: ic(SKIRT(8, 30, 14), '#7d9bc4', ln('M32 8 V30')), layers: [torso('skirt_denim', 20, 'bottom', 'denim')] },
  },
  shoes: {
    sneakers: { label: 'Sneakers', sex: 'any', icon: ic('M14 26 h16 q12 2 20 8 v4 H12Z', '#f2f0ec', ln('M12 38 H50', 3)), layers: [foot('sneaker', 'cloth'), { ...foot('sole_sneaker', 'cloth', 'none'), z: 11 }] },
    hightops: { label: 'High-tops', sex: 'any', icon: ic('M16 10 h16 v18 q12 2 18 8 v4 H14Z', '#f2f0ec', ln('M14 40 H50', 3) + '<circle cx="20" cy="22" r="3" fill="#fff" stroke="#2a1d16"/>'), layers: [foot('shoe_hightop', 'cloth'), { ...foot('sole_hightop', 'cloth', 'none'), z: 11 }] },
    boots: { label: 'Hiking boots', sex: 'any', icon: ic('M18 10 h14 v18 q12 2 16 8 v6 H16Z', '#6b4127', ln('M16 40 H48', 3)), layers: [foot('boot')] },
    ankleboots: { label: 'Ankle boots', sex: 'any', icon: ic('M18 12 h14 v16 q12 2 18 8 v4 H24 l-2 4 h-6Z', '#3a3036'), layers: [foot('shoe_ankleboot')] },
    heels: { label: 'Heels', sex: 'female', heel: 1, icon: ic('M14 24 q14 2 22 8 q8 4 14 8 v4 H38 q-12 -6 -22 -8 l-2 12 h-2 l1 -14Z', '#c42c35'), layers: [foot('shoe_pump')] },
    flats: { label: 'Ballet flats', sex: 'female', icon: ic('M12 32 q18 -2 28 2 q10 2 12 6 v2 H12Z', '#e5a3a6'), layers: [foot('shoe_flat'), { ...foot('sole_flat', 'leather', 'none'), z: 11 }] },
    sandals: { label: 'Sandals', sex: 'any', icon: ic('M12 38 H52 V42 H12Z', '#c9b494', ln('M18 30 Q24 24 30 30 M32 32 Q38 28 44 34', 3)),
      layers: [{ tex: 'sole_sandal', space: 'foot', z: 4, dye: 'none', mat: 'leather' }, { tex: 'foot_skin', space: 'foot', z: 5, dye: 'skin', mat: 'skin' }, foot('shoe_sandal')] },
    heelsandals: { label: 'Strappy heels', sex: 'female', heel: 1, icon: ic('M14 24 q14 2 22 8 q8 4 14 8 v3 H38 q-12 -6 -22 -8 l-2 12 h-2 l1 -14Z', '#f2c2a8', ln('M16 22 h8 M42 36 l8 4', 3)),
      layers: [{ tex: 'sole_heelsandal', space: 'foot', z: 4, dye: 'none', mat: 'leather' }, { tex: 'foot_skin_heel', space: 'foot', z: 5, dye: 'skin', mat: 'skin' }, foot('shoe_heelsandal')] },
    strappyflats: { label: 'Strappy flats', sex: 'female', icon: ic('M12 40 H52 V43 H12Z', A, ln('M16 34 Q14 40 18 40 M44 34 Q50 36 52 40 M20 28 Q28 30 32 34', 3)),
      layers: [{ tex: 'sole_sandal', space: 'foot', z: 4, dye: 'none', mat: 'leather' }, { tex: 'foot_skin', space: 'foot', z: 5, dye: 'skin', mat: 'skin' }, foot('shoe_strappy')] },
    hightopsconv: { label: 'Canvas high-tops', sex: 'any', icon: ic('M16 10 h16 v18 q12 2 18 8 v4 H14Z', '#1c1b20', ln('M14 40 H50', 3) + '<path d="M40 30 q8 2 10 8 h-12Z" fill="#fff"/>'), layers: [foot('shoe_hightop', 'cloth'), { ...foot('sole_hightop', 'cloth', 'none'), z: 11 }] },
    chunky: { label: 'Chunky sneakers', sex: 'any', icon: ic('M14 24 h16 q12 2 20 8 v4 H12Z', '#f2f0ec', `<rect x="10" y="36" width="44" height="8" rx="3" fill="#fff" stroke="${K}"/>`), layers: [foot('shoe_chunky', 'cloth'), { ...foot('sole_chunky', 'cloth', 'none'), z: 11 }] },
    workboots: { label: 'Work boots', sex: 'any', icon: ic('M18 8 h14 v20 q12 2 16 8 v4 H16Z', '#9a6a3a', ln('M16 42 H50', 4)), layers: [foot('shoe_workboot')] },
    combat: { label: 'Combat boots', sex: 'any', icon: ic('M18 2 h14 v26 q12 2 16 8 v4 H16Z', '#1c1b20', ln('M16 42 H50', 4) + ln('M22 8 h8 M22 14 h8 M22 20 h8', 1)), layers: [foot('shoe_combat')] },
    maryjanes: { label: 'Mary Janes', sex: 'female', icon: ic('M12 34 q18 -4 28 0 q10 2 12 6 v2 H12Z', '#1c1b20', ln('M22 30 L32 34', 3)),
      layers: [{ tex: 'foot_skin', space: 'foot', z: 5, dye: 'skin', mat: 'skin' }, foot('shoe_maryjane')] },
    loafers: { label: 'Loafers', sex: 'any', icon: ic('M12 28 h18 q12 2 20 8 v4 H12Z', '#6b4529', ln('M26 30 q6 0 10 4', 3)), layers: [foot('shoe_loafer'), { ...foot('sole_loafer', 'leather', 'none'), z: 11 }] },
  },
};
GARMENTS.accessory = {
  none: { label: 'None', sex: 'any', icon: '', layers: [] },
  belt: { label: 'Brown belt', sex: 'any', icon: `<rect x="8" y="22" width="48" height="8" fill="#6b4127" stroke="${K}"/><rect x="28" y="20" width="10" height="12" fill="none" stroke="#c9a45a" stroke-width="2.4"/>`, layers: [{ tex: 'acc_belt', space: 'torso', z: 25, dye: 'none', mat: 'leather' }] },
  beltblack: { label: 'Black belt', sex: 'any', icon: `<rect x="8" y="22" width="48" height="8" fill="#1f1c22" stroke="${K}"/><rect x="28" y="20" width="10" height="12" fill="none" stroke="#c8c4cc" stroke-width="2.4"/>`, layers: [{ tex: 'acc_beltblack', space: 'torso', z: 25, dye: 'none', mat: 'leather' }] },
  scarf: { label: 'Plaid scarf', sex: 'any', icon: `<path d="M18 10 Q32 22 46 10 L46 16 Q32 28 18 16Z M28 20 L26 46 L32 46 L34 22Z" fill="#d9c3a6" stroke="${K}"/>`, layers: [{ tex: 'acc_scarf', space: 'torso', z: 50, dye: 'none', mat: 'knit' }] },
  crossbody: { label: 'Crossbody bag', sex: 'any', icon: ln('M16 6 L44 34', 3) + `<rect x="38" y="30" width="16" height="14" rx="3" fill="#7a4a2a" stroke="${K}"/>`, layers: [{ tex: 'acc_crossbody', space: 'torso', z: 45, dye: 'none', mat: 'leather' }] },
  tote: { label: 'Tote bag', sex: 'female', icon: ln('M40 6 L42 24 M46 6 L50 24', 2) + `<path d="M38 24 h16 l2 22 h-20Z" fill="#e6dcc6" stroke="${K}"/>`, layers: [{ tex: 'acc_tote', space: 'torso', z: 45, dye: 'none', mat: 'cloth' }] },
};
// painted colour a texture keeps when that swatch is chosen (the film boots are painted brown)
export const PAINTED = { boot: 'brown' };
