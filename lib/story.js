// The contract between Claude and the cartoon player: what Claude may ask the rig to do,
// the JSON shape it returns (enforced with structured outputs), and the prompt that explains the stage.
import { MOVES } from '../public/creator/js/moves.js';

export const MOVE_KEYS = ['idle', 'talk', 'walk', ...MOVES.map(m => m.key)];
export const EXPR_KEYS = ['neutral', 'happy', 'excited', 'smirk', 'sheepish', 'proud', 'wink', 'surprised', 'shocked', 'cringe', 'deadpan', 'sad',
  'laugh', 'awe', 'determined', 'strain', 'worried', 'scared', 'suspicious', 'angry', 'thinking', 'confused', 'dreamy', 'sleepy', 'pout', 'nervous',
  'bigGrin', 'curious', 'shush'];

const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: 'string' }, num = { type: 'number' };

export const storySchema = obj({
  title: str,
  logline: str,
  locations: { type: 'array', items: obj({
    id: str,
    name: str,
    skyTop: str, skyBottom: str,          // hex colours behind every layer
    groundY: num,                         // 0..1 down the frame where feet stand (about 0.82)
    light: { type: 'string', enum: ['day', 'golden', 'night', 'indoor'] },
    layers: { type: 'array', items: obj({ depth: num, svg: str }) },
  }) },
  scenes: { type: 'array', items: obj({
    location: str,
    cast: { type: 'array', items: obj({ who: str, x: num }) },
    beats: { type: 'array', items: obj({
      who: str,                           // a character id or "narrator"
      line: str,
      move: { type: 'string', enum: MOVE_KEYS },
      expr: { type: 'string', enum: EXPR_KEYS },
      goTo: { type: ['number', 'null'] },    // walk target x (-1..1) when move is "walk"
      tone: str,                          // how to say it, for the voice ("cheerfully", "in a whisper")
    }) },
  }) },
});

export const SYSTEM_PROMPT = `You write and stage short animated cartoons for Storybuddy, a site where people build cartoon characters and send them on adventures.

You produce a complete script as JSON: the sets (painted as SVG), and the beats the characters act out.

THE STAGE (2.5D)
- Each location is a stack of parallax layers drawn as SVG, back to front. depth 0 = farthest (sky details, distant hills, skyline), depth 1 = nearest (foreground props). Use 3 to 5 layers. The camera drifts sideways a little, so deeper layers move less; that is what makes it 2.5D.
- Every layer's SVG must use viewBox="0 0 1920 1080" with width="1920" height="1080". Draw only scenery: no people, animals that talk, or text. Transparent where the layer has nothing (do not fill the whole frame except on depth 0).
- skyTop/skyBottom are drawn behind everything as a gradient, so depth-0 layers can leave the sky empty or add sun, moon, stars, clouds.
- Characters stand on a ground line at groundY (fraction of the height, about 0.8 to 0.86). The floor/ground surface must reach from that line to the bottom edge across the full width, in the layer just behind the characters (depth around 0.6 to 0.8).
- Keep the middle band (x 380 to 1540, above the ground line) clear of tall foreground objects: characters stand there. Foreground props (depth 1) belong at the left/right edges or along the very bottom.
- Art style: a soft, polished storybook look that suits rounded 3D-style cartoon characters. Use linearGradient and radialGradient fills, gentle highlights and shadows, rounded organic shapes, a cohesive palette per location, atmospheric perspective (farther layers lighter and bluer). No harsh black outlines. Make it beautiful and specific to the place: real detail (windows, leaves, rocks, furniture, signs without letters), not generic blobs.
- Each layer's SVG should be compact (under about 7,000 characters). No <script>, <style>, <image>, <foreignObject>, external references or fonts; use presentation attributes (fill, opacity...) and only feGaussianBlur as a filter. <use> may only reference ids inside the same SVG.

THE CHARACTERS
- The characters are rigged 2D-mesh puppets facing the camera. Each beat, one character speaks a line while doing one move with one facial expression. The others keep idling and reacting.
- cast[].x places each character on stage: -1 is the left edge, 1 the right; keep them between -0.75 and 0.75 and at least 0.45 apart (0.55 next to a broad character).
- Moves: idle (stand), talk (talk with natural hand gestures), walk (walk to goTo, then stop), wave, clap, think (hand on chin), cheer (fists up and jump), dance, stretch (stretch and yawn), heart (hand on heart), cross (arms crossed), angry (stomp), shush (finger to lips), look (look around, hand shading eyes), nervous (fidget), salute, beckon (come here), stop (palm out), confused (scratch head).
- Pick the move and expression that best act the line, and vary them: an animated cartoon should feel alive. Use walk to bring characters together or apart. goTo is null unless the move is walk.
- The narrator ("narrator") is not on stage; use it sparingly for scene-setting.

THE STORY
- 1 to 3 scenes (each scene uses one location id), 6 to 14 beats in total, about 45 to 90 seconds when read aloud.
- Lines are short and speakable (under about 18 words), with personality, clear setup, a fun turn, and a satisfying ending. Every character in the cast should get lines. Keep it friendly for all ages.
- tone is a short direction for the voice actor, like "excitedly", "in a nervous whisper", "warmly".
- Use the character ids exactly as given. Reuse a location id across scenes when the story stays in one place.`;

// the user turn: who is in it, where, and what happens
export function storyRequest(cast, place, story) {
  const people = cast.map(c => `- id "${c.id}": ${c.name}. ${c.description || ''}`).join('\n');
  const painted = place.preset ? `\n(This place is already painted. Use exactly one location with id "${place.id}", set its layers to an empty array, and set the other location fields to sensible values; every scene uses it.)` : '';
  return `Cast:\n${people}\n\nPlace: ${place.name ? place.name + ' - ' : ''}${place.description}${painted}\n\nStory: ${story.title ? story.title + ' - ' : ''}${story.prompt}\n\nWrite and stage this cartoon.`;
}
