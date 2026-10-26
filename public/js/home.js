// Home page: pick a cast, a place and a story, then hand the order to the player.
import { PLACES, STORIES } from './presets.js';
import { store, esc, allCharacters, lookOf } from './common.js';

const $ = (s) => document.querySelector(s);
const sel = store.get('storybuddy.pick', { cast: ['maya', 'leo'], place: 'park', story: 'kite', placeText: '', storyText: '' });
let config = { claude: false, gemini: false, elevenlabs: false };
const chars = allCharacters();
sel.cast = sel.cast.filter(id => chars.some(c => c.id === id));
const save = () => store.set('storybuddy.pick', sel);

// ---------------------------------------------------------------- cast
function renderCast() {
  $('#cast').innerHTML = chars.map(c => `<button class="card ${sel.cast.includes(c.id) ? 'on' : ''}" data-c="${esc(c.id)}" aria-pressed="${sel.cast.includes(c.id)}">
      <img class="pic" src="${esc(c.thumb || 'img/chars/maya.jpg')}" alt="" loading="lazy"><div class="txt"><b>${esc(c.name)}</b><span>${esc(c.blurb || '')}</span></div></button>`).join('')
    + `<a class="card make" href="creator/"><span class="plus">+</span><b>Build your own</b><span class="txt" style="padding:0"><span>Save them in the creator and come back</span></span></a>`;
  $('#cast').querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    const id = b.dataset.c, i = sel.cast.indexOf(id);
    if (i >= 0) sel.cast.splice(i, 1); else { if (sel.cast.length >= 3) sel.cast.shift(); sel.cast.push(id); }
    save(); renderCast(); summary();
  });
}

// ---------------------------------------------------------------- places (thumbnails composited from the painted layers)
const placeThumb = async (p) => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, p.skyTop); gr.addColorStop(1, p.skyBottom); g.fillStyle = gr; g.fillRect(0, 0, 640, 360);
  for (const L of [...p.layers].sort((a, b) => a.depth - b.depth)) {
    const url = URL.createObjectURL(new Blob([L.svg], { type: 'image/svg+xml' }));
    await new Promise(r => { const i = new Image(); i.onload = () => { g.drawImage(i, 0, 0, 640, 360); r(); }; i.onerror = r; i.src = url; });
    URL.revokeObjectURL(url);
  }
  return c.toDataURL('image/jpeg', 0.85);
};
async function renderPlaces() {
  const thumbs = await Promise.all(PLACES.map(placeThumb));
  $('#places').innerHTML = PLACES.map((p, i) => `<button class="card ${sel.place === p.id ? 'on' : ''}" data-p="${p.id}"><img class="pic" src="${thumbs[i]}" alt=""><div class="txt"><b>${esc(p.name)}</b><span>${esc(p.blurb)}</span></div></button>`).join('')
    + `<button class="card make ${sel.place === 'custom' ? 'on' : ''}" data-p="custom"><span class="plus">✎</span><b>Describe your own</b><span>Storybuddy paints it for you</span></button>`;
  $('#places').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { sel.place = b.dataset.p; save(); renderPlaces(); summary(); if (sel.place === 'custom') $('#placeText').focus(); });
  $('#placeCustom').classList.toggle('show', sel.place === 'custom');
}
const PLACE_IDEAS = ['A floating castle in the clouds', 'An underwater city with glowing coral', 'A busy night market with lanterns', 'A snowy cabin in the mountains', 'A dinosaur jungle', 'A candy factory'];
$('#placeIdeas').innerHTML = PLACE_IDEAS.map(t => `<button class="chip">${esc(t)}</button>`).join('');
$('#placeIdeas').onclick = (e) => { if (e.target.matches('.chip')) { $('#placeText').value = sel.placeText = e.target.textContent; save(); summary(); } };
$('#placeText').value = sel.placeText; $('#placeText').oninput = (e) => { sel.placeText = e.target.value; save(); summary(); };

// ---------------------------------------------------------------- stories
function renderStories() {
  $('#stories').innerHTML = STORIES.map(s => `<button class="card ${sel.story === s.id ? 'on' : ''}" data-s="${s.id}"><div class="txt" style="padding:18px 18px 20px"><b>${esc(s.title)}</b><span>${esc(s.prompt)}</span></div></button>`).join('')
    + `<button class="card make ${sel.story === 'custom' ? 'on' : ''}" data-s="custom"><span class="plus">✎</span><b>Tell your own</b><span>Anything you can imagine</span></button>`;
  $('#stories').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { sel.story = b.dataset.s; save(); renderStories(); summary(); if (sel.story === 'custom') $('#storyText').focus(); });
  $('#storyCustom').classList.toggle('show', sel.story === 'custom');
}
const STORY_IDEAS = ['They accidentally swap bodies with a cat', 'A robot wants to learn to dance', 'The quest for the last slice of pizza', 'A thunderstorm cancels the picnic'];
$('#storyIdeas').innerHTML = STORY_IDEAS.map(t => `<button class="chip">${esc(t)}</button>`).join('');
$('#storyIdeas').onclick = (e) => { if (e.target.matches('.chip')) { $('#storyText').value = sel.storyText = e.target.textContent; save(); summary(); } };
$('#storyText').value = sel.storyText; $('#storyText').oninput = (e) => { sel.storyText = e.target.value; save(); summary(); };

// ---------------------------------------------------------------- summary + go
function ready() {
  return sel.cast.length > 0 && (sel.place !== 'custom' || sel.placeText.trim().length > 3) && (sel.story !== 'custom' || sel.storyText.trim().length > 3);
}
function summary() {
  const names = sel.cast.map(id => chars.find(c => c.id === id)?.name).filter(Boolean);
  const place = sel.place === 'custom' ? (sel.placeText.trim() || 'a place you describe') : PLACES.find(p => p.id === sel.place)?.name;
  const story = sel.story === 'custom' ? (sel.storyText.trim() ? 'your own story' : 'a story you tell') : STORIES.find(s => s.id === sel.story)?.title;
  $('#sum').innerHTML = names.length ? `<b>${esc(names.join(', '))}</b> · ${esc(place || '')} · ${esc(story || '')}` : 'Pick your characters to begin.';
  $('#go').disabled = !ready();
}
async function loadConfig() {
  try { config = await (await fetch('/api/config')).json(); } catch { }
  const opts = [config.gemini && ['gemini', 'Gemini voices'], config.elevenlabs && ['elevenlabs', 'ElevenLabs voices'], ['browser', 'Browser voice']].filter(Boolean);
  const pick = store.get('storybuddy.voice') || opts[0][0];
  $('#voiceSel').innerHTML = opts.map(([k, l]) => `<option value="${k}" ${k === pick ? 'selected' : ''}>${l}</option>`).join('');
  $('#voiceSel').onchange = (e) => store.set('storybuddy.voice', e.target.value);
}
$('#go').onclick = () => {
  if (!ready()) return;
  const cast = sel.cast.map(id => chars.find(c => c.id === id)).filter(Boolean).map(c => ({ id: c.id, name: c.name, describe: c.describe, voice: c.voice, look: lookOf(c) }));
  const p = PLACES.find(x => x.id === sel.place), s = STORIES.find(x => x.id === sel.story);
  const place = p ? { id: p.id, name: p.name, description: p.describe, preset: true } : { id: 'custom', name: '', description: sel.placeText.trim() };
  const story = s ? { title: s.title, prompt: s.prompt } : { title: '', prompt: sel.storyText.trim() };
  store.set('storybuddy.order', { cast, place, story, provider: $('#voiceSel').value || 'browser' });
  location.href = 'play.html';
};

renderCast(); renderPlaces(); renderStories(); summary(); loadConfig();
