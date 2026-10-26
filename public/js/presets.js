// Ready-made characters, places and story starters for the home page.
// Characters are look recipes for the rig (see /mesh/js/look.js); places are painted parallax layers
// (depth 0 = far, 1 = near) in the same format Claude paints custom places in.

const MAN = { sex: 'male', eyes: { lashes: 0.35, size: 0.86, y: 2 }, brows: { style: 'bold', y: 3, size: 1.06 }, nose: { size: 1.16, y: 2 },
  mouth: { style: 'thin', color: 'nude', y: 3 }, makeup: { shadow: 'none', blush: 0.15 } };
const fit = (top, topColor, bottom, bottomColor, shoes, shoeColor, accessories = []) => ({ outfit: { top, topColor, bottom, bottomColor, shoes, shoeColor, accessories } });

export const CHARACTERS = [
  { id: 'maya', name: 'Maya', blurb: 'Fearless hiker, big laugh', voice: { gemini: 'Kore', elevenlabs: '21m00Tcm4TlvDq8NMMr' },
    describe: 'a cheerful young woman with long dark wavy hair, a black halter top and leggings; adventurous and quick to laugh',
    body: 'average', look: {} },
  { id: 'leo', name: 'Leo', blurb: 'Big ideas, bigger quiff', voice: { gemini: 'Puck', elevenlabs: 'ErXwobaYiN019PkySvjV' },
    describe: 'a lanky young man with a brown quiff, green bomber jacket and jeans; an inventor full of schemes',
    body: 'young', look: { ...MAN, hair: { style: 'quiff', color: 'darkbrown' }, ...fit('bomber', 'forest', 'jeans', 'navy', 'sneakers', 'white') } },
  { id: 'zara', name: 'Zara', blurb: 'Six and three-quarters', voice: { gemini: 'Leda', elevenlabs: 'MF3mGyEYCl7XYWbV9V6O' },
    describe: 'a bright little girl with two big curly puffs and a pink puff dress; endlessly curious, asks "why?" a lot',
    body: 'child', look: { hair: { style: 'puffs', color: 'black' }, skin: { tone: 'brown' }, ...fit('puffdress', 'blush', 'leggings', 'denim', 'hightopsconv', 'blush') } },
  { id: 'gus', name: 'Grandpa Gus', blurb: 'Tells the best tall tales', voice: { gemini: 'Charon', elevenlabs: 'VR6AewLTigWG4xSOukaG' },
    describe: 'a kind older man with silver hair, glasses, a grey beard and a sweater vest; warm, a little forgetful, loves stories',
    body: 'older', look: { ...MAN, hair: { style: 'sidepart', color: 'silver' }, facial: { style: 'boxed' }, glasses: { style: 'rect', color: 'black' },
      ...fit('vest', 'grey', 'trousers', 'navy', 'loafers', 'brown', ['belt']) } },
  { id: 'rocco', name: 'Rocco', blurb: 'Strong arms, soft heart', voice: { gemini: 'Fenrir', elevenlabs: 'TxGEqnHWrfWFTfGW9XjX' },
    describe: 'a big muscular man with a short crop and a beard, black tee and work boots; gentle giant who cries at movies',
    body: 'muscular', look: { ...MAN, hair: { style: 'crop', color: 'darkbrown' }, facial: { style: 'beard' }, ...fit('tee', 'black', 'jeans', 'denim', 'workboots', 'brown', ['belt']) } },
  { id: 'pip', name: 'Pip', blurb: 'Bookworm with a secret', voice: { gemini: 'Aoede', elevenlabs: 'EXAVITQu4vr4xnSDxMaL' },
    describe: 'a petite young woman with a shaggy bob, round glasses and a lavender cardigan; shy, clever, secretly brave',
    body: 'petite', look: { hair: { style: 'shag', color: 'auburn' }, glasses: { style: 'round', color: 'tortoise' }, skin: { tone: 'golden' },
      ...fit('cardigan', 'lavender', 'rolledjeans', 'denim', 'sneakers', 'white') } },
];

// ---------------------------------------------------------------- places
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">${body}</svg>`;
const g = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const rg = (id, stops) => `<radialGradient id="${id}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
const cloud = (x, y, s, o = 0.9) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><ellipse cx="0" cy="0" rx="120" ry="42" fill="#fff"/><ellipse cx="-60" cy="-18" rx="70" ry="50" fill="#fff"/><ellipse cx="45" cy="-30" rx="80" ry="60" fill="#fff"/><ellipse cx="0" cy="12" rx="130" ry="30" fill="#e9eef7"/></g>`;
const tree = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 0 C-10 -60 -12 -120 -6 -170 L8 -170 C12 -120 12 -60 16 0 Z" fill="#7a5236"/><circle cx="0" cy="-210" r="90" fill="${c1}"/><circle cx="-60" cy="-170" r="62" fill="${c1}"/><circle cx="62" cy="-175" r="66" fill="${c1}"/><circle cx="-20" cy="-250" r="55" fill="${c2}" opacity=".55"/><circle cx="30" cy="-200" r="40" fill="${c2}" opacity=".35"/></g>`;

export const PLACES = [
  { id: 'park', name: 'Sunny park', blurb: 'Picnic blankets and a big oak', describe: 'a sunny city park with rolling green hills, a big oak tree, a winding path and a pond',
    skyTop: '#7ec4f2', skyBottom: '#dff2ff', groundY: 0.84, light: 'day',
    layers: [
      { depth: 0, svg: svg(`<defs>${rg('sun', [[0, '#fffbe8'], [0.4, '#fff3b8', 0.9], [1, '#fff3b8', 0]])}</defs><circle cx="1520" cy="190" r="190" fill="url(#sun)"/>${cloud(360, 190, 1.1)}${cloud(980, 130, 0.8, 0.8)}${cloud(1720, 330, 0.7, 0.7)}`) },
      { depth: 0.25, svg: svg(`<defs>${g('h1', [[0, '#a9d48c'], [1, '#8cc07a']])}</defs><path d="M0 700 C260 560 520 600 760 650 C1040 560 1340 560 1580 640 C1720 600 1840 610 1920 630 L1920 1080 L0 1080 Z" fill="url(#h1)" opacity=".85"/>${tree(240, 690, 0.55, '#7fb36a', '#bfe39a')}${tree(1630, 660, 0.6, '#79ad66', '#bfe39a')}`) },
      { depth: 0.6, svg: svg(`<defs>${g('h2', [[0, '#7cc061'], [1, '#5ea54d']])}${g('path', [[0, '#f1dfb8'], [1, '#e2c995']])}${g('pond', [[0, '#8fd3f4'], [1, '#5ab0e0']])}</defs><path d="M0 820 C300 760 640 790 960 800 C1280 780 1620 760 1920 800 L1920 1080 L0 1080 Z" fill="url(#h2)"/><path d="M900 1080 C930 980 1010 930 1180 880 C1300 850 1420 850 1520 830 L1560 840 C1440 870 1330 880 1230 920 C1090 970 1040 1020 1040 1080 Z" fill="url(#path)" opacity=".9"/><ellipse cx="330" cy="905" rx="210" ry="38" fill="url(#pond)"/><ellipse cx="300" cy="895" rx="120" ry="10" fill="#fff" opacity=".35"/>${tree(1520, 840, 1.05, '#5f9e4d', '#a9da7f')}`) },
      { depth: 1, svg: svg(`<g opacity=".95"><path d="M0 1080 C40 990 110 960 170 990 C220 940 300 950 330 1010 C360 990 400 1000 420 1080 Z" fill="#4f8f3f"/><path d="M1600 1080 C1640 1010 1720 980 1790 1010 C1840 980 1900 990 1920 1010 L1920 1080 Z" fill="#4f8f3f"/>${[60, 120, 210, 300, 1660, 1760, 1850].map((x, i) => `<circle cx="${x}" cy="${1000 + (i % 2) * 14}" r="9" fill="${['#ff8fb1', '#ffd45e', '#ffffff'][i % 3]}"/>`).join('')}</g>`) },
    ] },
  { id: 'rooftop', name: 'Rooftop at sunset', blurb: 'City lights flicker on', describe: 'a city rooftop at sunset with water towers, string lights and a glowing skyline',
    skyTop: '#3b3a78', skyBottom: '#ff9e6b', groundY: 0.83, light: 'golden',
    layers: [
      { depth: 0, svg: svg(`<defs>${rg('ss', [[0, '#ffe7a8'], [0.5, '#ffb46b', 0.8], [1, '#ff8a5c', 0]])}</defs><circle cx="980" cy="690" r="260" fill="url(#ss)"/>${[[300, 120], [620, 70], [1400, 110], [1700, 60], [140, 260]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff" opacity=".8"/>`).join('')}`) },
      { depth: 0.2, svg: svg(`<g fill="#7a5c8e" opacity=".75">${[[60, 430, 140], [210, 520, 110], [330, 380, 160], [500, 470, 120], [640, 330, 150], [1180, 400, 170], [1360, 300, 130], [1500, 450, 160], [1680, 360, 140], [1820, 480, 120]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${1080 - y}" rx="6"/>`).join('')}</g><g fill="#ffd98a" opacity=".55">${Array.from({ length: 40 }, (_, i) => `<rect x="${80 + (i * 173) % 1800}" y="${420 + (i * 97) % 300}" width="14" height="20" rx="2"/>`).join('')}</g>`) },
      { depth: 0.45, svg: svg(`<g fill="#4c3a66">${[[0, 560, 260], [240, 640, 200], [1480, 590, 220], [1680, 520, 240]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${1080 - y}"/>`).join('')}<g transform="translate(1600 420)"><rect x="-60" y="0" width="120" height="110" rx="20"/><path d="M-70 0 L0 -40 L70 0 Z"/><rect x="-50" y="110" width="8" height="70"/><rect x="42" y="110" width="8" height="70"/></g></g><g fill="#ffcf7d" opacity=".7">${Array.from({ length: 18 }, (_, i) => `<rect x="${20 + (i * 211) % 1880}" y="${600 + (i * 53) % 200}" width="16" height="22" rx="2"/>`).join('')}</g>`) },
      { depth: 0.7, svg: svg(`<defs>${g('roof', [[0, '#8a6a74'], [1, '#5e4552']])}</defs><rect x="0" y="880" width="1920" height="200" fill="url(#roof)"/><rect x="0" y="870" width="1920" height="16" fill="#a8848c"/><path d="M0 560 Q480 640 960 590 Q1440 540 1920 610" stroke="#2b2236" stroke-width="3" fill="none"/>${Array.from({ length: 16 }, (_, i) => { const x = i * 128 + 40, y = 560 + Math.sin(i / 15 * Math.PI) * 50 + (i < 8 ? i * 4 : (15 - i) * 4); return `<circle cx="${x}" cy="${y + 14}" r="9" fill="#ffe29a"/><circle cx="${x}" cy="${y + 14}" r="22" fill="#ffd27a" opacity=".25"/>`; }).join('')}`) },
      { depth: 1, svg: svg(`<g><rect x="40" y="930" width="190" height="150" rx="10" fill="#6d4f5c"/><rect x="60" y="950" width="150" height="20" rx="6" fill="#8d6b78"/><g transform="translate(1760 900)"><rect x="-70" y="0" width="140" height="180" rx="12" fill="#5d4350"/><circle cx="0" cy="-26" r="40" fill="#5b8a4e"/><circle cx="-26" cy="-8" r="28" fill="#6aa05a"/></g></g>`) },
    ] },
  { id: 'beach', name: 'Breezy beach', blurb: 'Waves, palms, sandcastles', describe: 'a tropical beach with turquoise waves, palm trees and a sandcastle',
    skyTop: '#55b8f0', skyBottom: '#d8f3ff', groundY: 0.85, light: 'day',
    layers: [
      { depth: 0, svg: svg(`${cloud(420, 210, 1)}${cloud(1380, 160, 0.9, 0.85)}<circle cx="1660" cy="220" r="70" fill="#fff6c9"/>`) },
      { depth: 0.2, svg: svg(`<defs>${g('sea', [[0, '#3fc4d8'], [1, '#1b9fc4']])}</defs><rect x="0" y="640" width="1920" height="440" fill="url(#sea)"/><path d="M0 640 L1920 640" stroke="#bff3ff" stroke-width="4" opacity=".7"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 170 + 30} ${690 + (i % 3) * 40} q40 -14 80 0" stroke="#e8fbff" stroke-width="4" fill="none" opacity=".6"/>`).join('')}<path d="M1500 640 C1560 560 1640 540 1720 600 C1760 580 1820 590 1860 640 Z" fill="#6fae7a" opacity=".7"/>`) },
      { depth: 0.6, svg: svg(`<defs>${g('sand', [[0, '#ffe4b0'], [1, '#f2c983']])}</defs><path d="M0 800 C400 770 700 790 960 800 C1300 790 1600 770 1920 790 L1920 1080 L0 1080 Z" fill="url(#sand)"/><path d="M0 790 C300 760 640 810 960 795 C1300 780 1620 760 1920 785" stroke="#fff" stroke-width="10" fill="none" opacity=".55"/><g transform="translate(1600 900)"><rect x="-90" y="-60" width="180" height="70" fill="#f0c27a"/><rect x="-60" y="-120" width="120" height="60" fill="#f4ca86"/><rect x="-30" y="-170" width="60" height="50" fill="#f6d090"/><path d="M0 -170 L0 -215 L36 -202 L0 -190" fill="#ff6b6b"/><rect x="-14" y="-36" width="28" height="46" rx="14" fill="#c89452"/></g>`) },
      { depth: 1, svg: svg(`<g transform="translate(140 1080)"><path d="M0 0 C20 -200 60 -380 130 -520 L150 -510 C90 -380 60 -200 46 0 Z" fill="#a8743f"/>${[[-160, 40], [-60, -50], [60, -60], [170, 20], [10, -90]].map(([dx, dy]) => `<path d="M140 -515 Q${140 + dx / 2} ${-560 + dy} ${140 + dx} ${-470 + dy}" stroke="#3f9a4f" stroke-width="34" fill="none" stroke-linecap="round"/>`).join('')}</g><g transform="translate(1840 1080) scale(-0.8 0.8)"><path d="M0 0 C20 -200 60 -380 130 -520 L150 -510 C90 -380 60 -200 46 0 Z" fill="#a8743f"/>${[[-160, 40], [-60, -50], [60, -60], [170, 20]].map(([dx, dy]) => `<path d="M140 -515 Q${140 + dx / 2} ${-560 + dy} ${140 + dx} ${-470 + dy}" stroke="#46a656" stroke-width="34" fill="none" stroke-linecap="round"/>`).join('')}</g>`) },
    ] },
  { id: 'kitchen', name: 'Cozy kitchen', blurb: 'Warm light, something baking', describe: 'a cozy home kitchen with a window, hanging pots, a big wooden table and an oven',
    skyTop: '#f7e2c2', skyBottom: '#f3d2a8', groundY: 0.84, light: 'indoor',
    layers: [
      { depth: 0, svg: svg(`<defs>${g('wall', [[0, '#f6dcb8'], [1, '#eec79a']])}${g('win', [[0, '#9ad6ff'], [1, '#e8f6ff']])}</defs><rect width="1920" height="1080" fill="url(#wall)"/><g opacity=".25" fill="#d9a877">${Array.from({ length: 24 }, (_, i) => `<rect x="${(i % 12) * 170 + (i < 12 ? 0 : 85)}" y="${i < 12 ? 120 : 300}" width="12" height="12" rx="6"/>`).join('')}</g><rect x="760" y="170" width="400" height="320" rx="16" fill="#fff"/><rect x="780" y="190" width="360" height="280" rx="8" fill="url(#win)"/><rect x="955" y="190" width="10" height="280" fill="#fff"/><rect x="780" y="325" width="360" height="10" fill="#fff"/>${cloud(880, 290, 0.35)}<path d="M740 160 Q960 230 1180 160 L1180 210 Q960 270 740 210 Z" fill="#e0716b"/>`) },
      { depth: 0.35, svg: svg(`<defs>${g('cab', [[0, '#c98b5a'], [1, '#a8693f']])}</defs><rect x="0" y="560" width="620" height="300" fill="url(#cab)"/><rect x="0" y="540" width="640" height="26" rx="6" fill="#efe4d6"/>${[30, 230, 430].map(x => `<rect x="${x}" y="600" width="170" height="230" rx="10" fill="#b77a4c"/><circle cx="${x + 150}" cy="715" r="7" fill="#f2d27a"/>`).join('')}<rect x="1350" y="480" width="440" height="380" rx="18" fill="#e9e3dc"/><rect x="1390" y="600" width="360" height="220" rx="14" fill="#3b3433"/><rect x="1410" y="620" width="320" height="180" rx="10" fill="#ff9e4f" opacity=".55"/>${[1420, 1520, 1620, 1720].map(x => `<circle cx="${x}" cy="530" r="20" fill="#5a524e"/>`).join('')}<path d="M220 140 L220 260 M360 140 L360 300 M500 140 L500 240" stroke="#8a6a52" stroke-width="5"/><circle cx="220" cy="290" r="40" fill="#b5654f"/><circle cx="360" cy="330" r="46" fill="#c9a24a"/><circle cx="500" cy="270" r="36" fill="#7d8f9a"/>`) },
      { depth: 0.7, svg: svg(`<defs>${g('floor', [[0, '#c68c5d'], [1, '#9d6640']])}</defs><rect x="0" y="880" width="1920" height="200" fill="url(#floor)"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 240} 880 L${i * 240 - 120} 1080" stroke="#8d5a38" stroke-width="3" opacity=".6"/>`).join('')}<rect x="0" y="872" width="1920" height="12" fill="#a87650"/>`) },
      { depth: 1, svg: svg(`<g transform="translate(150 1080)"><rect x="-140" y="-150" width="280" height="24" rx="8" fill="#8b5a36"/><rect x="-120" y="-126" width="18" height="126" fill="#74482a"/><rect x="102" y="-126" width="18" height="126" fill="#74482a"/><ellipse cx="0" cy="-168" rx="70" ry="22" fill="#f4efe6"/><path d="M-50 -170 Q0 -240 50 -170 Z" fill="#e8a65a"/></g><g transform="translate(1790 1080)"><rect x="-40" y="-140" width="80" height="140" rx="12" fill="#5f8f6a"/><path d="M-40 -140 C-90 -230 -10 -260 0 -200 C20 -270 90 -220 40 -140 Z" fill="#6bb06e"/></g>`) },
    ] },
];

export const STORIES = [
  { id: 'kite', title: 'The runaway kite', prompt: 'A kite gets loose and everyone has to work together, in silly ways, to get it back before it drifts away forever.' },
  { id: 'party', title: 'The surprise party', prompt: 'Someone plans a surprise party for a friend, but keeping the secret is much harder than it looks.' },
  { id: 'cake', title: 'The great cake disaster', prompt: 'A baking contest goes hilariously wrong, but the "disaster" cake turns out to be the best thing anyone ever tasted.' },
  { id: 'talent', title: 'Talent show jitters', prompt: 'One character is terrified of performing at the talent show; the others help them find their courage.' },
  { id: 'map', title: 'The mysterious map', prompt: 'They find an old treasure map with a riddle, and the treasure turns out to be something unexpected.' },
  { id: 'space', title: 'First day at space school', prompt: 'It is the first day at a school on the moon; everything floats, nothing goes to plan, and new friendships form.' },
];
