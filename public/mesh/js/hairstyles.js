// Creator hairstyle and facial-hair catalogue (textures in creator/tex/ unless noted as film textures
// from mesh/tex/). heroine.drawLook() draws them; HairSim gives the locks spring physics.
// Painted by creator/paint/hair.js (h_* hair, fh_* facial hair).
//
// hairstyle fields
//   label, icon (SVG markup, viewBox 0 0 64 64), sex: 'any' | 'female' | 'male' (randomize pools)
//   cap     head-space texture over the skull (part, hairline, crown). Film default: 'hairCap'
//   back    head-space texture hanging behind the body (long hair mass). Film: 'hairBack'. null = none
//           (painted like hairBack: head centre origin, y=40 is where it starts following the chest)
//   backLen squash factor for the part of `back` below y=40 (1 = as painted)
//   locks   spring-chain strands: 'film' (the film's 7 locks scaled by len) | [] | list of
//           { tex, layer: 'back'|'mid'|'front', root: [x,y] head space, len, w (width scale), dir: [x,y], drape: [x,y] }
//           a lock texture hangs along +y from its root (like mesh/paint lock()); ponytails and braids are locks
//   len     length scale for 'film' locks;  vol  width scale of cap/back/locks
//   extras  rigid head-space pieces: [{ tex, z: 'behind' | 'front' }] (buns, hair bows, headbands)
// facial hair fields
//   label, icon, layers: [{ tex, space: 'face' | 'mouth', z: 'under' | 'over' }]
//     face space = the face texture's space (moves with the face shape warp); 'under' draws before the lips
//     mouth space = y 0 at the lip line, follows mouth width and smile (mustaches)

// ---- icons: a face oval + a dark hair silhouette (64x64), facial hair on a face (64x52)
const SKIN = '#f2c2a8', HAIR = '#141012';
const face = '<ellipse cx="32" cy="34" rx="12.5" ry="15" fill="' + SKIN + '"/>';
const hi = (d, before = '') => before + face + '<path d="' + d + '" fill="' + HAIR + '"/>';
const behind = (d) => '<path d="' + d + '" fill="' + HAIR + '"/>';
const fIcon = (body) => '<ellipse cx="32" cy="22" rx="15" ry="18" fill="' + SKIN + '"/><path d="M26 30 Q32 33 38 30" stroke="#a5525a" stroke-width="2" fill="none"/>' + body;
const fh = (d, extra = '') => fIcon('<path d="' + d + '" fill="' + HAIR + '"/>' + extra);

// shared lock rigs
const sideLocks = (tex, len, w = 0.8) => [
  { tex, layer: 'front', root: [-92, -40], len, w, dir: [-0.1, 1], drape: [-6, 140] },
  { tex, layer: 'front', root: [94, -38], len: len * 1.06, w: w * 0.94, dir: [0.1, 1], drape: [8, 150] },
  { tex, layer: 'back', root: [-104, 8], len: len * 1.08, w: w * 1.3, dir: [-0.12, 1], drape: [-20, 120] },
  { tex, layer: 'back', root: [106, 10], len, w: w * 1.3, dir: [0.12, 1], drape: [22, 120] },
];
const shortLocks = (tex, len) => [
  { tex, layer: 'front', root: [-96, -20], len, w: 0.8, dir: [-0.08, 1], drape: [-4, 60] },
  { tex, layer: 'front', root: [98, -18], len: len * 1.05, w: 0.78, dir: [0.08, 1], drape: [4, 60] },
];

export const HAIRSTYLES = {
  // ---------------------------------------------------------------- long & medium
  long:     { label: 'Long waves (film)', sex: 'female', cap: 'hairCap', back: 'hairBack', backLen: 1, locks: 'film', len: 1, vol: 1,
    icon: hi('M19 30 C18 12 46 12 45 30 L48 58 L40 58 L43 32 C40 22 24 22 21 32 L24 58 L16 58Z') },
  waves:    { label: 'Layered waves', sex: 'female', cap: 'h_cap_midwave', back: 'h_back_waves', backLen: 1, locks: sideLocks('h_lock_wave', 330), vol: 1,
    icon: hi('M19 30 C18 12 46 12 45 30 C48 40 44 48 49 58 L41 58 C44 48 40 40 43 32 C40 22 24 22 21 32 C24 40 20 48 23 58 L15 58 C20 48 16 40 19 30Z') },
  xlong:    { label: 'Extra long', sex: 'female', cap: 'h_cap_midwave', back: 'h_back_waves', backLen: 1.2, locks: sideLocks('h_lock_wave', 400), vol: 1.02,
    icon: hi('M19 30 C18 12 46 12 45 30 L49 64 L41 64 L43 32 C40 22 24 22 21 32 L23 64 L15 64Z') },
  sleek:    { label: 'Long straight', sex: 'female', cap: 'h_cap_mid', back: 'h_back_straight', backLen: 1, locks: sideLocks('h_lock_straight', 360, 0.74), vol: 0.94,
    icon: hi('M20 30 C19 13 45 13 44 30 L46 60 L40 60 L42 32 C40 22 24 22 22 32 L24 60 L18 60Z') },
  bangs:    { label: 'Long with bangs', sex: 'female', cap: 'h_cap_bangs', back: 'h_back_straight', backLen: 0.95, locks: sideLocks('h_lock_straight', 340, 0.74), vol: 0.96,
    icon: hi('M20 32 C18 12 46 12 44 32 L46 60 L40 60 L42 30 L22 30 L24 60 L18 60Z') },
  curls:    { label: 'Loose curls', sex: 'female', cap: 'h_cap_curls', back: 'h_back_curls', backLen: 1, locks: [
      { tex: 'h_lock_ringlet', layer: 'front', root: [-98, -10], len: 300, w: 0.85, dir: [-0.12, 1], drape: [-6, 100] },
      { tex: 'h_lock_ringlet', layer: 'front', root: [100, -8], len: 320, w: 0.82, dir: [0.12, 1], drape: [6, 100] }], vol: 1.04,
    icon: hi('M16 32 C12 10 52 10 48 32 C52 38 46 44 50 52 C46 56 44 50 42 46 L43 32 C40 22 24 22 21 32 L22 46 C20 50 18 56 14 52 C18 44 12 38 16 32Z') },
  afro:     { label: 'Voluminous curls', sex: 'any', cap: 'h_cap_afro', back: 'h_back_afro', backLen: 1, locks: [], vol: 1,
    icon: behind('M32 4 C6 4 2 30 10 44 C14 52 22 48 22 40 L21 32 C24 22 40 22 43 32 L42 40 C42 48 50 52 54 44 C62 30 58 4 32 4Z') + face },
  shoulder: { label: 'Shoulder length', sex: 'male', cap: 'h_cap_mlong', back: 'h_back_lob', backLen: 0.85, locks: [], vol: 1,
    icon: hi('M19 30 C17 12 47 12 45 30 L46 44 L40 44 L42 32 C38 22 28 20 24 26 C22 30 22 36 22 44 L17 44Z')},
  lob:      { label: 'Wavy lob', sex: 'female', cap: 'h_cap_lob', back: 'h_back_lob', backLen: 1, locks: shortLocks('h_lock_short', 200), vol: 1.02,
    icon: hi('M19 30 C18 12 46 12 45 30 C47 38 44 44 48 50 L40 50 C43 44 40 38 43 32 C38 20 26 22 21 32 C24 38 21 44 24 50 L16 50 C20 44 17 38 19 30Z') },
  bob:      { label: 'Sleek bob', sex: 'female', cap: 'h_cap_bob', back: 'h_back_bob', backLen: 1, locks: [], vol: 1,
    icon: hi('M18 30 C17 12 47 12 46 30 L47 44 C44 46 41 46 40 44 L43 32 C38 20 26 22 21 32 L24 44 C23 46 20 46 17 44Z') },
  shag:     { label: 'Curtain-bang shag', sex: 'female', cap: 'h_cap_curtain', back: 'h_back_shag', backLen: 1, locks: shortLocks('h_lock_short', 220), vol: 1.06,
    icon: hi('M18 32 C16 10 48 10 46 32 L49 50 L44 46 L42 50 L41 34 C38 26 34 24 32 28 C30 24 26 26 23 34 L22 50 L20 46 L15 50Z') },
  halfup:   { label: 'Half up', sex: 'female', cap: 'h_cap_mid', back: 'h_back_waves', backLen: 0.92, locks: sideLocks('h_lock_wave', 320), vol: 0.98,
    extras: [{ tex: 'h_bun_half', z: 'behind' }],
    icon: hi('M20 30 C19 13 45 13 44 30 L46 58 L40 58 L42 32 C40 22 24 22 22 32 L24 58 L18 58Z', '<circle cx="32" cy="10" r="6" fill="' + HAIR + '"/>') },
  ponyHigh: { label: 'High ponytail', sex: 'female', cap: 'h_cap_pulled', back: null, vol: 1,
    locks: [{ tex: 'h_pony', layer: 'back', root: [34, -118], len: 300, w: 1.2, dir: [0.18, 1], drape: [12, 20] }],
    icon: behind('M40 10 C54 12 56 30 50 50 C48 40 46 28 40 18Z') + hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z') },
  ponyLow:  { label: 'Side ponytail', sex: 'female', cap: 'h_cap_pulledpart', back: null, vol: 1,
    locks: [{ tex: 'h_pony_long', layer: 'mid', root: [-72, 58], len: 380, w: 1.05, dir: [-0.06, 1], drape: [0, 120] }],
    icon: hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z M20 40 C14 46 14 56 18 62 C22 56 24 48 22 40Z') },
  braid:    { label: 'Side braid', sex: 'female', cap: 'h_cap_pulledpart', back: null, vol: 1,
    locks: [{ tex: 'h_braid', layer: 'mid', root: [-70, 58], len: 380, w: 1.1, dir: [-0.04, 1], drape: [0, 110] }],
    icon: hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z M19 40 l4 4 l-4 4 l4 4 l-4 4 l4 4 l-3 4 l-4 0 l-1 -4 l4 -4 l-4 -4 l4 -4 l-4 -4 l4 -4Z') },
  bun:      { label: 'Messy bun', sex: 'female', cap: 'h_cap_pulled', back: null, locks: [], vol: 1, extras: [{ tex: 'h_bun_top', z: 'behind' }],
    icon: hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z', '<circle cx="33" cy="9" r="8" fill="' + HAIR + '"/>') },
  spacebuns:{ label: 'Space buns', sex: 'female', cap: 'h_cap_pulledpart', back: null, locks: [], vol: 1, extras: [{ tex: 'h_bun_space', z: 'behind' }, { tex: 'h_bun_space2', z: 'behind' }],
    icon: hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z', '<circle cx="19" cy="14" r="7" fill="' + HAIR + '"/><circle cx="45" cy="14" r="7" fill="' + HAIR + '"/>') },
  puffs:    { label: 'Curly puffs', sex: 'female', cap: 'h_cap_pulledpart', back: null, locks: [], vol: 1, extras: [{ tex: 'h_puff_l', z: 'behind' }, { tex: 'h_puff_r', z: 'behind' }],
    icon: hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z', '<circle cx="15" cy="16" r="9" fill="' + HAIR + '" stroke="#555" stroke-dasharray="2 2"/><circle cx="49" cy="16" r="9" fill="' + HAIR + '" stroke="#555" stroke-dasharray="2 2"/>') },
  updo:     { label: 'Curly updo', sex: 'female', cap: 'h_cap_pulled', back: null, locks: [], vol: 1, extras: [{ tex: 'h_puff_top', z: 'behind' }],
    icon: hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z', '<circle cx="32" cy="9" r="10" fill="' + HAIR + '" stroke="#555" stroke-dasharray="2 2"/>') },
  lowbun:   { label: 'Low bun', sex: 'any', cap: 'h_cap_pulledpart', back: null, locks: [], vol: 1, extras: [{ tex: 'h_bun_low', z: 'behind' }],
    icon: hi('M20 30 C19 14 45 14 44 30 C40 22 24 22 20 30Z', '<circle cx="48" cy="40" r="7" fill="' + HAIR + '"/>') },
  pixie:    { label: 'Pixie', sex: 'female', cap: 'h_cap_pixie', back: null, locks: [], vol: 1,
    icon: hi('M20 34 C16 12 48 12 45 32 C40 26 34 22 26 26 C24 30 22 32 20 34Z') },
  // ---------------------------------------------------------------- short
  messy:    { label: 'Messy textured', sex: 'any', cap: 'h_cap_messy', back: null, locks: [], vol: 1,
    icon: hi('M19 32 C14 8 50 8 45 32 L42 26 L38 30 L34 24 L30 30 L26 25 L22 30Z') },
  crop:     { label: 'Textured crop', sex: 'male', cap: 'h_cap_crop', back: null, locks: [], vol: 1,
    icon: hi('M20 32 C17 12 47 12 44 32 C42 26 38 24 32 25 C26 24 22 26 20 32Z') },
  sidepart: { label: 'Side part', sex: 'male', cap: 'h_cap_side', back: null, locks: [], vol: 1,
    icon: hi('M20 32 C18 12 46 12 44 32 C44 24 36 20 26 22 C24 26 22 28 20 32Z') },
  slick:    { label: 'Slicked back', sex: 'male', cap: 'h_cap_slick', back: null, locks: [], vol: 1,
    icon: hi('M20 30 C19 14 45 14 44 30 C42 22 22 22 20 30Z') },
  quiff:    { label: 'Pompadour', sex: 'male', cap: 'h_cap_pomp', back: null, locks: [], vol: 1,
    icon: hi('M20 30 C16 10 34 2 46 12 C48 18 46 26 44 30 C40 22 24 22 20 30Z') },
  buzz:     { label: 'Buzz cut', sex: 'male', cap: 'h_cap_buzz', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 C20 17 44 17 44 30 C40 24 24 24 20 30Z" fill="#4a4048"/>' },
  curly:    { label: 'Curly top', sex: 'any', cap: 'h_cap_buzz', back: null, locks: [], vol: 1, extras: [{ tex: 'h_cap_curlytop', z: 'front' }],
    icon: face + '<path d="M20 30 C20 18 44 18 44 30" fill="#4a4048"/><path d="M20 26 C14 10 50 10 44 26 C40 20 24 20 20 26Z" fill="' + HAIR + '" stroke="#555" stroke-dasharray="2 2"/>' },
  afroShort:{ label: 'Short afro', sex: 'male', cap: 'h_cap_afro_m', back: 'h_back_afro_m', backLen: 1, locks: [], vol: 1,
    icon: behind('M32 6 C12 6 8 24 14 36 L21 34 C22 24 42 24 43 34 L50 36 C56 24 52 6 32 6Z') + face },
  undercut: { label: 'Undercut', sex: 'male', cap: 'h_cap_undercut', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 C20 20 44 20 44 30" fill="#4a4048"/><path d="M20 26 C18 8 48 8 46 24 C40 18 30 16 22 24Z" fill="' + HAIR + '"/>' },
  wavyMed:  { label: 'Wavy medium', sex: 'male', cap: 'h_cap_wavy', back: null, locks: [], vol: 1,
    icon: hi('M18 36 C14 10 50 10 46 36 L44 38 C44 30 40 22 32 24 C24 22 20 30 20 38Z') },
  manbun:   { label: 'Man bun', sex: 'male', cap: 'h_cap_slick', back: null, locks: [], vol: 1, extras: [{ tex: 'h_bun_man', z: 'behind' }],
    icon: hi('M20 30 C19 14 45 14 44 30 C42 22 22 22 20 30Z', '<circle cx="34" cy="10" r="6" fill="' + HAIR + '"/>') },
  // ---------------------------------------------------------------- men's barber & era cuts (creator/paint/hair.js menCap)
  pomp50:    { label: "50s pompadour", sex: 'male', cap: 'h_cap_pomp50', back: null, locks: [], vol: 1,
    icon: hi('M20 32 C16 8 34 -2 48 8 C50 16 46 26 44 32 C40 24 24 24 20 32Z') },
  mod:       { label: "60s mop-top", sex: 'male', cap: 'h_cap_mop', back: null, locks: [], vol: 1,
    icon: hi('M17 40 C14 10 50 10 47 40 L44 40 L44 30 L20 30 L20 40Z') },
  feathered: { label: "70s feathered", sex: 'male', cap: 'h_cap_feather', back: 'h_back_bob', backLen: 1, locks: [], vol: 1,
    icon: hi('M15 46 C10 14 54 14 49 46 L44 44 C46 32 40 26 32 22 C24 26 18 32 20 44Z') },
  bigAfro:   { label: "70s big afro", sex: 'male', cap: 'h_cap_afro', back: 'h_back_afro', backLen: 1, locks: [], vol: 1,
    icon: behind('M32 2 C4 2 0 32 10 44 L21 34 C22 24 42 24 43 34 L54 44 C64 32 60 2 32 2Z') + face },
  mullet:    { label: "80s mullet", sex: 'male', cap: 'h_cap_crop', back: 'h_back_lob', backLen: 0.95, locks: [], vol: 1,
    icon: behind('M18 36 L14 58 L22 54 L24 40Z M46 36 L50 58 L42 54 L40 40Z') + hi('M20 32 C17 12 47 12 44 32 C42 26 38 24 32 25 C26 24 22 26 20 32Z') },
  curtains:  { label: "90s curtains", sex: 'male', cap: 'h_cap_curtains', back: null, locks: [], vol: 1,
    icon: hi('M20 32 C17 12 47 12 44 32 L42 30 C40 24 34 20 32 18 C30 20 24 24 22 30Z') },
  frosted:   { label: "2000s frosted spikes", sex: 'male', cap: 'h_cap_frosted', back: null, locks: [], vol: 1,
    icon: hi('M20 30 L16 18 L24 22 L24 8 L30 18 L34 4 L37 18 L44 8 L42 22 L50 18 L44 30 C40 24 24 24 20 30Z', '') + '<path d="M24 8 L22 13 M34 4 L33 10 M44 8 L42 13" stroke="#e8e0c8" stroke-width="3" stroke-linecap="round"/>' },
  crew:      { label: "Crew cut", sex: 'male', cap: 'h_cap_crew', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 C20 16 44 16 44 30 C40 24 24 24 20 30Z" fill="#4a4048"/><path d="M22 22 C24 14 40 14 42 22Z" fill="' + HAIR + '"/>' },
  flattop:   { label: "Flat top", sex: 'male', cap: 'h_cap_flattop', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 L20 20 L44 20 L44 30" fill="#4a4048"/><path d="M21 22 L21 8 L43 8 L43 22Z" fill="' + HAIR + '"/>' },
  fauxhawk:  { label: "Faux hawk", sex: 'male', cap: 'h_cap_fauxhawk', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 C20 18 44 18 44 30" fill="#4a4048"/><path d="M24 24 L30 4 L32 10 L35 4 L40 24Z" fill="' + HAIR + '"/>' },
  frenchcrop:{ label: "French crop & fade", sex: 'male', cap: 'h_cap_frenchcrop', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 32 C20 18 44 18 44 32" fill="#8a7a7a"/><path d="M22 26 C22 12 42 12 42 26Z" fill="' + HAIR + '"/>' },
  mohawk:    { label: "Mohawk", sex: 'male', cap: 'h_cap_mohawk', back: null, locks: [], vol: 1,
    icon: face + '<path d="M28 22 L30 0 L32 6 L34 0 L36 22Z" fill="' + HAIR + '"/>' },
  locs:      { label: "Locs", sex: 'any', cap: 'h_cap_locs', back: 'h_back_locs', backLen: 0.85, vol: 1,
    locks: [{ tex: 'h_lock_loc', layer: 'front', root: [-96, -10], len: 240, w: 0.9, dir: [-0.1, 1], drape: [-4, 60] }, { tex: 'h_lock_loc', layer: 'front', root: [98, -8], len: 250, w: 0.9, dir: [0.1, 1], drape: [4, 60] }],
    icon: hi('M20 30 C18 14 46 14 44 30 L46 56 L42 56 L41 32 L23 32 L22 56 L18 56Z', '') + '<path d="M18 30 L16 56 M46 30 L48 56 M22 32 L21 54 M42 32 L43 54" stroke="' + HAIR + '" stroke-width="4" stroke-linecap="round"/>' },
  cornrows:  { label: "Cornrows", sex: 'any', cap: 'h_cap_cornrows', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 C20 16 44 16 44 30 C40 24 24 24 20 30Z" fill="#3a2e34"/><path d="M24 26 L28 14 M30 25 L31 13 M34 25 L33 13 M40 26 L36 14" stroke="' + HAIR + '" stroke-width="3" stroke-dasharray="3 1.5"/>' },
  twists:    { label: "Two-strand twists", sex: 'any', cap: 'h_cap_twists', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 C20 18 44 18 44 30 C40 24 24 24 20 30Z" fill="' + HAIR + '"/><path d="M22 22 L16 10 M28 18 L26 4 M34 18 L36 4 M40 22 L48 10 M25 20 L20 6 M38 20 L44 6" stroke="' + HAIR + '" stroke-width="4" stroke-linecap="round"/>' },
  emo:       { label: "Emo fringe", sex: 'any', cap: 'h_cap_emo', back: null, locks: [], vol: 1,
    icon: hi('M18 34 C16 10 48 10 46 34 L44 30 C40 24 34 22 30 24 C26 28 24 34 20 40Z') },
  bowl:      { label: "Bowl cut", sex: 'any', cap: 'h_cap_bowl', back: null, locks: [], vol: 1,
    icon: hi('M18 32 C16 10 48 10 46 32 L46 34 L18 34Z') },
  surfer:    { label: "Surfer long", sex: 'male', cap: 'h_cap_midwave', back: 'h_back_waves', backLen: 0.72, locks: sideLocks('h_lock_wave', 270, 0.8), vol: 1.02,
    icon: hi('M18 30 C18 12 46 12 46 30 C48 38 45 46 48 54 L41 54 C43 46 40 38 42 32 C38 22 26 22 22 32 C24 38 21 46 23 54 L16 54 C19 46 16 38 18 30Z') },
  slickLong: { label: "Slicked-back long", sex: 'male', cap: 'h_cap_pulled', back: 'h_back_straight', backLen: 0.6, locks: [], vol: 1,
    icon: behind('M18 30 L16 56 L22 56 L22 34Z M46 30 L48 56 L42 56 L42 34Z') + hi('M20 30 C19 14 45 14 44 30 C42 22 22 22 20 30Z') },
  hightop:   { label: "High-top fade", sex: 'male', cap: 'h_cap_hightop', back: null, locks: [], vol: 1,
    icon: face + '<path d="M20 30 C20 20 44 20 44 30" fill="#6a5a5c"/><path d="M22 24 L22 2 L42 2 L42 24Z" fill="' + HAIR + '" stroke="#555" stroke-dasharray="2 2"/>' },
};

export const FACIAL_HAIR = {
  none:        { label: 'None', layers: [], icon: fIcon('') },
  stubbleLight:{ label: 'Light stubble', layers: [{ tex: 'fh_stubbleLight', space: 'face', z: 'under' }], icon: fh('M18 24 Q18 42 32 42 Q46 42 46 24 L44 24 Q44 36 32 36 Q20 36 20 24Z', '').replace('fill="#141012"', 'fill="#6b5a62" opacity=".35"') },
  stubble:     { label: 'Heavy stubble', layers: [{ tex: 'fh_stubbleHeavy', space: 'face', z: 'under' }], icon: fh('M17 22 Q17 44 32 44 Q47 44 47 22 L44 22 Q44 37 32 37 Q20 37 20 22Z').replace('fill="#141012"', 'fill="#4e4048" opacity=".6"') },
  boxed:       { label: 'Short beard', layers: [{ tex: 'fh_boxed', space: 'face', z: 'under' }, { tex: 'fh_mus_natural', space: 'mouth', z: 'over' }], icon: fh('M17 22 Q17 45 32 45 Q47 45 47 22 L44 22 Q44 36 32 36 Q20 36 20 22Z M25 29 Q32 25 39 29 Q32 27 25 29Z') },
  beard:       { label: 'Full beard', layers: [{ tex: 'fh_full', space: 'face', z: 'under' }, { tex: 'fh_mus_chevron', space: 'mouth', z: 'over' }], icon: fh('M16 20 Q15 48 32 49 Q49 48 48 20 L44 20 Q44 36 32 36 Q20 36 20 20Z M24 29 Q32 24 40 29 Q32 27 24 29Z') },
  longBeard:   { label: 'Long beard', layers: [{ tex: 'fh_long', space: 'face', z: 'under' }, { tex: 'fh_mus_chevron', space: 'mouth', z: 'over' }], icon: fh('M16 20 Q14 50 32 52 Q50 50 48 20 L44 20 Q44 36 32 36 Q20 36 20 20Z M24 29 Q32 24 40 29 Q32 27 24 29Z') },
  goatee:      { label: 'Goatee', layers: [{ tex: 'fh_goatee', space: 'face', z: 'under' }, { tex: 'fh_mus_natural', space: 'mouth', z: 'over' }], icon: fh('M27 33 Q32 44 37 33Z M25 29 Q32 25 39 29 Q32 27 25 29Z') },
  vandyke:     { label: 'Van Dyke', layers: [{ tex: 'fh_vandyke', space: 'face', z: 'under' }, { tex: 'fh_mus_handlebar', space: 'mouth', z: 'over' }], icon: fh('M29 33 Q32 46 35 33Z M21 26 Q24 30 28 28 Q32 25 36 28 Q40 30 43 26 Q40 32 32 28 Q24 32 21 26Z') },
  chinstrap:   { label: 'Chin strap', layers: [{ tex: 'fh_chinstrap', space: 'face', z: 'under' }], icon: fh('M17 22 Q17 44 32 44 Q47 44 47 22 L45 22 Q45 41 32 41 Q19 41 19 22Z') },
  soulpatch:   { label: 'Soul patch', layers: [{ tex: 'fh_soulpatch', space: 'face', z: 'under' }], icon: fh('M30 33 h4 v3 h-4Z') },
  mutton:      { label: 'Mutton chops', layers: [{ tex: 'fh_mutton', space: 'face', z: 'under' }], icon: fh('M17 16 Q16 34 24 40 Q22 32 22 28 L20 16Z M47 16 Q48 34 40 40 Q42 32 42 28 L44 16Z') },
  mustache:    { label: 'Mustache', layers: [{ tex: 'fh_mus_natural', space: 'mouth', z: 'over' }], icon: fh('M24 30 Q32 24 40 30 Q32 28 24 30Z') },
  chevron:     { label: 'Chevron mustache', layers: [{ tex: 'fh_mus_chevron', space: 'mouth', z: 'over' }], icon: fh('M23 31 Q32 22 41 31 Q32 28 23 31Z') },
  handlebar:   { label: 'Handlebar', layers: [{ tex: 'fh_mus_handlebar', space: 'mouth', z: 'over' }], icon: fh('M18 26 Q20 31 25 29 Q32 25 39 29 Q44 31 46 26 Q44 33 39 31 Q32 28 25 31 Q20 33 18 26Z') },
  pencil:      { label: 'Pencil mustache', layers: [{ tex: 'fh_mus_pencil', space: 'mouth', z: 'over' }], icon: fh('M26 28 Q32 26 38 28 L38 29 Q32 27.5 26 29Z') },
  goateeOnly:  { label: 'Chin beard', layers: [{ tex: 'fh_goatee', space: 'face', z: 'under' }], icon: fh('M27 33 Q32 44 37 33Z') },
};
