// Shared bits for the home page and the player: storage, the user's saved characters, describing a look in words.
import { STYLES, BODIES, HAIR_COLORS } from '../mesh/js/look.js';
import { CHARACTERS } from './presets.js';

export const store = {
  get(k, d = null) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (cat, k) => (STYLES[cat]?.[k]?.label || k || '').toLowerCase();

// a preset's rig recipe, with its body proportions filled in
export const presetLook = (c) => ({ ...c.look, body: { preset: c.body, ...BODIES[c.body] } });

// characters made in the creator (saved by name there, same browser)
export function savedCharacters() {
  return (store.get('creator.saved', []) || []).map((s, i) => ({
    id: 'my' + i + '-' + String(s.name || 'friend').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12),
    name: s.name || 'My character', blurb: 'Made by you', thumb: s.thumb, look: s.look, mine: true,
    describe: describeLook(s.look),
    voice: s.look?.sex === 'male' ? { gemini: 'Puck', elevenlabs: 'pNInz6obpgDQGcFmaJgB' } : { gemini: 'Kore', elevenlabs: '21m00Tcm4TlvDq8NMMr' },
  }));
}
export function describeLook(L = {}) {
  const who = L.sex === 'male' ? 'man' : 'woman', b = L.body?.preset || 'average';
  const age = b === 'child' ? (L.sex === 'male' ? 'a young boy' : 'a young girl') : b === 'teen' ? `a teenage ${L.sex === 'male' ? 'boy' : 'girl'}` : b === 'older' ? `an older ${who}` : `a ${(BODIES[b]?.label || '').toLowerCase().replace('adult', '').trim()} ${who}`.replace(/\s+/g, ' ');
  const hair = L.hair ? `${L.hair.color || ''} ${label('hair', L.hair.style)} hair`.trim() : '';
  const o = L.outfit || {}, wear = [o.topColor && `${o.topColor} ${label('top', o.top)}`, o.bottom && label('bottom', o.bottom), o.shoes && label('shoes', o.shoes)].filter(Boolean).join(', ');
  return `${age}${hair ? ' with ' + hair : ''}${wear ? ', wearing ' + wear : ''}`;
}
export const allCharacters = () => [...savedCharacters(), ...CHARACTERS.map(c => ({ ...c, thumb: `img/chars/${c.id}.jpg` }))];
export const lookOf = (c) => c.mine ? c.look : presetLook(c);
