# Storybuddy

**Make a cartoon in three picks.** Build a character, choose a place and a story, and Storybuddy writes the script, paints the set, voices every line and animates it as a 2.5D cartoon in your browser.

- **Characters**: a Mii-style character builder (`/creator/`) on a rigged 2D-mesh puppet: faces, bodies, hair, outfits, shoes, facial hair. Characters you save there appear on the home page, next to six ready-made ones.
- **Places**: four hand-painted parallax sets, or describe any place and Claude paints it as layered SVG.
- **Stories**: six story starters, or tell your own.
- **Voices**: Gemini text-to-speech or ElevenLabs (Turbo v2.5), with lip sync driven by the audio. Without a voice key, the browser's built-in voice reads the lines.

This is its own project. It isn't the Explainerly explainer site, toonscript or same-movie-studio.

## How it works

```
home page ──► POST /api/story ──► Claude (claude-opus-5-5, structured JSON output)
   │             returns { locations: [painted SVG layers], scenes: [cast, beats] }
   ▼
player ──► POST /api/tts per line ──► Gemini TTS or ElevenLabs
   │
   ▼
stage (WebGL): sky + parallax layers, rigged cast acting each beat (move + expression + lip sync), camera follows the speaker
```

- `server.js`: Express server, static site plus the three APIs.
- `lib/story.js`: the contract with Claude: the JSON schema, the moves and expressions the rig can perform, and the staging prompt.
- `lib/demo.js`: a canned cartoon used when no Claude key is set, so everything can be tried offline.
- `public/js/stage.js`: renders sets and characters, and poses each character per beat (idle, talk, walk, or a named move).
- `public/js/player.js`: fetches the script, records the voices, plays the cartoon.
- `public/mesh/js/`: the character rig (renderer, painter, puppet, acting, look recipes, garment and hair catalogues).
- `public/creator/`: the character builder; `public/creator/paint/` holds the texture painters.

## Run it

```bash
npm install
cp .env.example .env   # add your keys, or export them in your shell
npm run dev            # http://localhost:8080 (reads .env)
```

Environment variables:

| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | Claude writes and stages stories (without it: demo story) |
| `GEMINI_API_KEY` | Gemini voices |
| `ELEVENLABS_API_KEY` | ElevenLabs voices |
| `CLAUDE_MODEL` | optional, default `claude-opus-5-5` |
| `CLAUDE_EFFORT` | optional, default `medium` |
| `GEMINI_TTS_MODEL` | optional, default `gemini-2.5-flash-preview-tts` |
| `ELEVENLABS_MODEL` | optional, default `eleven_turbo_v2_5` |
| `STORY_LIMIT_PER_HOUR`, `TTS_LIMIT_PER_HOUR` | optional per-visitor limits (20 / 400) |

Claude requests opt into server-side refusal fallbacks (`fallbacks: "default"`), so a declined request is retried on Anthropic's recommended fallback model.

## Deploy (Railway)

The repo deploys as-is: Railway detects Node, runs `npm start`, and the server listens on `$PORT`. Set the API keys as service variables.

## Dev tools

- `node tools/render-images.mjs` re-renders the home page character thumbnails and hero image from the rig.
- `node tools/smoke.mjs` runs home → make → play headlessly and saves frames to `out/smoke/`.

Both need Chrome installed (`CHROME` overrides the path).
