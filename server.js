// Storybuddy server: static site + three APIs
//   POST /api/story  cast + place + story idea -> a scripted 2.5D cartoon (Claude writes the script and paints the sets as SVG)
//   POST /api/tts    one line of dialogue -> audio (Gemini TTS or ElevenLabs)
//   GET  /api/config which providers have keys, and their voices
// Keys come from the environment: ANTHROPIC_API_KEY, GEMINI_API_KEY, ELEVENLABS_API_KEY.
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOVE_KEYS, EXPR_KEYS, storySchema, SYSTEM_PROMPT, storyRequest } from './lib/story.js';
import { demoStory } from './lib/demo.js';
import { sanitizeSvg } from './lib/svg.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '1mb' }));

const env = (k) => (process.env[k] || '').trim();
const MODEL = env('CLAUDE_MODEL') || 'claude-opus-5-5';
const GEMINI_TTS_MODEL = env('GEMINI_TTS_MODEL') || 'gemini-2.5-flash-preview-tts';
const ELEVEN_MODEL = env('ELEVENLABS_MODEL') || 'eleven_v4_turbo';
const ELEVEN_FALLBACK = 'eleven_flash_v2_5';   // used if the account or endpoint rejects the main model

// voices offered per provider (ids are each provider's own names)
const VOICES = {
  gemini: [['Kore', 'Kore (bright, firm)'], ['Puck', 'Puck (upbeat)'], ['Charon', 'Charon (deep, calm)'], ['Aoede', 'Aoede (breezy)'], ['Fenrir', 'Fenrir (excited)'],
    ['Leda', 'Leda (youthful)'], ['Orus', 'Orus (firm)'], ['Zephyr', 'Zephyr (light)'], ['Sulafat', 'Sulafat (warm)'], ['Achird', 'Achird (friendly)']],
  elevenlabs: [['cgSgspJ2msm6clMCkdW9', 'Jessica (playful, bright)'], ['FGY2WhTYpPnrIDTdsKH5', 'Laura (upbeat, quirky)'], ['pFZP5JQG7iQjIQuC4Bku', 'Lily (warm, British)'],
    ['IKne3meq5aSn9XLyUdCD', 'Charlie (casual, Australian)'], ['JBFqnCBsd6RMkjVDRZzb', 'George (warm storyteller)'], ['bIHbv24MWmeRgasZH58o', 'Will (friendly, laid-back)'], ['nPczCjzI2devNBz1zQrb', 'Brian (deep narrator)']],
};

app.get('/api/config', (req, res) => {
  res.json({
    claude: !!env('ANTHROPIC_API_KEY'), gemini: !!env('GEMINI_API_KEY'),
    elevenlabs: !!env('ELEVENLABS_API_KEY'),
    voices: VOICES, moves: MOVE_KEYS, expressions: EXPR_KEYS,
  });
});

// a small per-visitor budget so a public deploy can't burn through the keys
const hits = new Map();
function allow(req, kind, max, windowMs) {
  const key = kind + ':' + (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now); hits.set(key, list); return true;
}

// ---------------------------------------------------------------- story
let claude = null;
const client = () => (claude ||= new Anthropic());

app.post('/api/story', async (req, res) => {
  const { cast, place, story } = req.body || {};
  if (!Array.isArray(cast) || !cast.length || cast.length > 4) return res.status(400).json({ error: 'Pick 1 to 4 characters.' });
  if (!place?.description || !story?.prompt) return res.status(400).json({ error: 'Pick a place and a story.' });
  if (!env('ANTHROPIC_API_KEY')) return res.json({ ...demoStory(cast, place, story), demo: true });
  if (!allow(req, 'story', Number(env('STORY_LIMIT_PER_HOUR')) || 20, 3600e3)) return res.status(429).json({ error: 'That is a lot of stories! Try again in a little while.' });
  try {
    const stream = client().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: env('CLAUDE_EFFORT') || 'medium', format: { type: 'json_schema', schema: storySchema } },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: storyRequest(cast, place, story) }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'Claude could not write that story. Try a different idea.' });
    if (msg.stop_reason === 'max_tokens') return res.status(502).json({ error: 'The story came out too long. Try a simpler idea.' });
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const out = JSON.parse(text);
    for (const loc of out.locations || []) for (const l of loc.layers || []) l.svg = sanitizeSvg(l.svg);
    res.json(out);
  } catch (err) {
    console.error('story failed:', err);
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Claude is busy. Try again in a minute.' });
    if (err instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: 'The Claude API key is not valid.' });
    if (err instanceof SyntaxError) return res.status(502).json({ error: 'The story came back garbled. Please try again.' });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: `Claude error (${err.status}). Please try again.` });
    res.status(500).json({ error: 'Something went wrong writing the story.' });
  }
});

// ---------------------------------------------------------------- text to speech
// Gemini returns raw 24 kHz 16-bit mono PCM; wrap it in a WAV header
function pcmToWav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const ttsCache = new Map();   // identical lines (replays) are not re-billed
app.post('/api/tts', async (req, res) => {
  const { provider, text, voice, style } = req.body || {};
  const line = String(text || '').slice(0, 600);
  if (!line.trim()) return res.status(400).json({ error: 'No text.' });
  const ck = JSON.stringify([provider, line, voice, style]);
  if (ttsCache.has(ck)) { const c = ttsCache.get(ck); res.type(c.type); return res.send(c.buf); }
  if (!allow(req, 'tts', Number(env('TTS_LIMIT_PER_HOUR')) || 400, 3600e3)) return res.status(429).json({ error: 'Too many voice lines right now.' });
  try {
    let buf, type;
    if (provider === 'elevenlabs') {
      if (!env('ELEVENLABS_API_KEY')) return res.status(400).json({ error: 'No ElevenLabs key set.' });
      // same call as the other products: Eleven v4 Turbo, raw 24 kHz PCM, retried on rate limits and server errors
      const id = voice || VOICES.elevenlabs[0][0];
      const say = async (model) => {
        for (let attempt = 0; ; attempt++) {
          const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(id)}?output_format=pcm_24000`, {
            method: 'POST', headers: { 'xi-api-key': env('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
            body: JSON.stringify({ text: line, model_id: model }),
          });
          if (r.ok || [400, 401, 403, 404, 422].includes(r.status) || attempt >= 3) return r;
          await new Promise(res => setTimeout(res, r.status === 429 ? 8000 : 2000));
        }
      };
      let r = await say(ELEVEN_MODEL);
      if (!r.ok && ELEVEN_MODEL !== ELEVEN_FALLBACK && r.status === 400) {   // an unsupported model is a 400; a bad voice or key is not
        console.warn(`ElevenLabs rejected ${ELEVEN_MODEL}: ${(await r.text()).slice(0, 200)}; using ${ELEVEN_FALLBACK}`);
        r = await say(ELEVEN_FALLBACK);
      }
      if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
      buf = pcmToWav(Buffer.from(await r.arrayBuffer())); type = 'audio/wav';
    } else {
      if (!env('GEMINI_API_KEY')) return res.status(400).json({ error: 'No Gemini key set.' });
      const prompt = style ? `Say ${style}: ${line}` : line;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } } } } }),
      });
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json(), b64 = j?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (!b64) throw new Error('Gemini returned no audio');
      buf = pcmToWav(Buffer.from(b64, 'base64')); type = 'audio/wav';
    }
    if (ttsCache.size > 500) ttsCache.delete(ttsCache.keys().next().value);
    ttsCache.set(ck, { buf, type });
    res.type(type); res.send(buf);
  } catch (err) {
    console.error('tts failed:', err.message);
    res.status(502).json({ error: 'The voice service failed for that line.' });
  }
});

// ---------------------------------------------------------------- static site
app.use(express.static(path.join(here, 'public'), { extensions: ['html'], maxAge: '1h' }));
app.get('/health', (req, res) => res.send('ok'));
const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`Storybuddy on http://localhost:${port}`));
