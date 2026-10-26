// The cartoon player: asks the server for a staged script, voices every line, then performs it on the stage
// with lip sync, camera moves, scene changes and subtitles.
import { Stage } from './stage.js';
import { PLACES } from './presets.js';
import { store, esc } from './common.js';

const $ = (s) => document.querySelector(s);
const order = store.get('storybuddy.order');
const canvas = $('#c'), stage = new Stage(canvas);
const status = (msg, pct) => { $('#status').textContent = msg; if (pct != null) $('#bar i').style.width = Math.round(pct * 100) + '%'; };
const WRITING = ['Sharpening the pencils', 'Painting the sky', 'Teaching everyone their lines', 'Planting the trees', 'Hanging the string lights', 'Warming up the voices', 'Choosing the best camera angles'];

let script = null, beats = [], voices = new Map(), audioCtx = null, analyser = null, level = 0;

// ---------------------------------------------------------------- 1. write
async function write() {
  if (!order) { location.href = './'; return null; }
  let i = 0; const tick = setInterval(() => status(WRITING[i++ % WRITING.length] + '…'), 2400);
  status(order.place.preset ? 'Writing your story…' : 'Writing your story and painting your place…');
  try {
    const r = await fetch('/api/story', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cast: order.cast.map(c => ({ id: c.id, name: c.name, description: c.describe })), place: order.place, story: order.story }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'The story could not be written.');
    return j;
  } finally { clearInterval(tick); }
}

// painted presets fill in their own layers; unknown or empty locations fall back to the chosen (or first) preset
function resolveLocations(s) {
  const chosen = PLACES.find(p => p.id === order.place.id) || PLACES[0];
  for (const loc of s.locations || []) {
    const preset = PLACES.find(p => p.id === loc.id);
    if (preset) Object.assign(loc, { ...preset, ...loc, layers: preset.layers, skyTop: preset.skyTop, skyBottom: preset.skyBottom, groundY: preset.groundY, light: preset.light });
    else if (!loc.layers?.length) Object.assign(loc, { layers: chosen.layers, skyTop: chosen.skyTop, skyBottom: chosen.skyBottom, groundY: chosen.groundY, light: chosen.light });
  }
}

// ---------------------------------------------------------------- 2. voice
const voiceFor = (who) => {
  if (who === 'narrator') return order.provider === 'elevenlabs' ? 'EXAVITQu4vr4xnSDxMaL' : 'Sulafat';
  const c = order.cast.find(c => c.id === who); return c?.voice?.[order.provider];
};
async function voiceLine(b) {
  if (order.provider === 'browser') return null;
  const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: order.provider, text: b.line, voice: voiceFor(b.who), style: b.tone }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'voice failed');
  return audioCtx.decodeAudioData(await r.arrayBuffer());
}
async function voiceAll() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024; analyser.connect(audioCtx.destination);
  if (order.provider === 'browser') return;
  let done = 0, failed = 0;
  const queue = beats.map((b, i) => [b, i]);
  const worker = async () => {
    while (queue.length) {
      const [b, i] = queue.shift();
      try { voices.set(i, await voiceLine(b)); } catch (e) { failed++; console.warn(e); }
      status(`Recording the voices… ${++done} of ${beats.length}`, done / beats.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (failed === beats.length) { order.provider = 'browser'; toast('The voice service is unavailable, so your browser is reading the lines.'); }
}

// ---------------------------------------------------------------- 3. perform
let clock0 = 0, playing = false, beatIx = -1, beatEnd = 0, speaker = null, sceneIx = -1, src = null, utter = null;
const now = () => (performance.now() - clock0) / 1000;
const levelNow = () => {
  if (src && analyser) { const d = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(d); let s = 0; for (const v of d) s += (v - 128) ** 2; return Math.sqrt(s / d.length) / 40; }
  if (utter) return 0.35 + 0.35 * Math.abs(Math.sin(now() * 13)) * (0.6 + 0.4 * Math.sin(now() * 3.1));
  return 0;
};
async function startScene(ix) {
  const sc = script.scenes[ix], loc = script.locations.find(l => l.id === sc.location) || script.locations[0];
  for (let f = 0; f <= 1; f += 0.1) { stage.fade = f; await new Promise(r => setTimeout(r, 25)); }
  await stage.setLocation(loc);
  stage.setCast(sc.cast.map(c => { const m = order.cast.find(o => o.id === c.who); return m && { id: c.who, look: m.look, x: c.x }; }).filter(Boolean));
  stage.focus(null);
  for (let f = 1; f >= 0; f -= 0.1) { stage.fade = f; await new Promise(r => setTimeout(r, 25)); }
  stage.fade = 0;
}
async function startBeat(i) {
  const b = beats[i]; beatIx = i;
  if (b.scene !== sceneIx) { sceneIx = b.scene; await startScene(sceneIx); }
  const t = now();
  speaker = b.who !== 'narrator' && stage.cast.has(b.who) ? b.who : null;
  if (speaker) {
    const kind = b.move === 'idle' ? 'talk' : b.move;
    stage.act(speaker, kind, t, { expr: b.expr, to: b.move === 'walk' ? b.goTo : null });
    stage.focus(speaker);
  } else {
    stage.focus(null);
    if (b.move && b.move !== 'idle' && b.move !== 'talk' && b.move !== 'walk') for (const id of stage.cast.keys()) stage.act(id, b.move, t, { expr: b.expr });
  }
  // listeners settle back to idle once their own move has played out
  for (const [id, a] of stage.cast) if (id !== speaker && a.act.kind !== 'idle' && t - a.act.t0 > 2.2 && !(b.who === 'narrator' && b.move !== 'idle')) stage.act(id, 'idle', t, { expr: 'happy' });
  $('#sub').innerHTML = `<b>${esc(b.who === 'narrator' ? 'Narrator' : order.cast.find(c => c.id === b.who)?.name || b.who)}</b>${esc(b.line)}`;
  $('#sub').classList.add('show');
  const buf = voices.get(i);
  let dur = 0;
  if (buf) {
    src = audioCtx.createBufferSource(); src.buffer = buf; src.connect(analyser); src.start(); dur = buf.duration;
    src.onended = () => { src = null; };
  } else {
    dur = Math.max(1.6, b.line.split(/\s+/).length / 2.6);
    if ('speechSynthesis' in window) {
      utter = new SpeechSynthesisUtterance(b.line); utter.rate = 1.02; utter.pitch = b.who === 'narrator' ? 1 : 1.1;
      utter.onend = () => { utter = null; beatEnd = Math.min(beatEnd, now() + 0.3); };
      speechSynthesis.speak(utter);
    }
  }
  const moveMin = b.move === 'walk' ? 2.2 : b.move && b.move !== 'idle' && b.move !== 'talk' ? 2.4 : 0;
  beatEnd = t + Math.max(dur + 0.35, moveMin);
}
function loop() {
  const t = now();
  if (playing && beatIx >= 0 && t > beatEnd && !utter) {
    if (beatIx + 1 < beats.length) startBeat(beatIx + 1); else finish();
  }
  level = lerp(level, Math.min(1, levelNow() * 1.6), 0.45);
  const sp = speaker && stage.cast.get(speaker);
  stage.frame(t, { speaker, speakerX: sp ? sp.x : null, mouth: speaker ? level : 0 });
  requestAnimationFrame(loop);
}
const lerp = (a, b, k) => a + (b - a) * k;

function finish() {
  playing = false; speaker = null; $('#sub').classList.remove('show');
  for (const id of stage.cast.keys()) stage.act(id, 'cheer', now(), { expr: 'bigGrin' });
  $('#end').classList.add('show');
}
async function play() {
  $('#end').classList.remove('show'); $('#start').classList.remove('show');
  if (audioCtx?.state === 'suspended') await audioCtx.resume();
  sceneIx = -1; playing = true; await startBeat(0);
}

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 4200); }

// ---------------------------------------------------------------- boot
(async () => {
  try {
    const [s] = await Promise.all([write(), stage.load(p => $('#bar i').style.width = Math.round(p * 60) + '%')]);
    if (!s) return;
    script = s; resolveLocations(script);
    beats = script.scenes.flatMap((sc, si) => sc.beats.map(b => ({ ...b, scene: si })));
    $('#title').textContent = script.title; $('#logline').textContent = script.logline || '';
    document.title = `${script.title} · Storybuddy`;
    await voiceAll();
    // show the first set behind the start card
    sceneIx = 0; await startScene(0);
    clock0 = performance.now(); loop();
    $('#loading').classList.remove('show'); $('#start').classList.add('show');
    if (script.demo) toast('Demo story: add a Claude API key on the server to have Claude write and stage your idea.');
  } catch (e) {
    console.error(e); status(e.message || 'Something went wrong.'); $('#loading').classList.add('error');
  }
})();
$('#play').onclick = play;
$('#again').onclick = play;
