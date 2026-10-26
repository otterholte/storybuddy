// A canned cartoon for when no Claude key is configured: same JSON shape the real writer returns,
// built from the chosen cast, a painted place and the story title, so the whole player can be tried offline.
export function demoStory(cast, place, story) {
  const ids = cast.map(c => c.id), name = (i) => cast[i % cast.length].name, who = (i) => ids[i % ids.length];
  const loc = place.preset ? place.id : 'park';
  const xs = ids.length === 1 ? [0] : ids.length === 2 ? [-0.36, 0.36] : ids.length === 3 ? [-0.62, 0, 0.62] : [-0.72, -0.24, 0.24, 0.72];
  const title = story.title || 'A brand new adventure';
  const beats = [
    { who: 'narrator', line: `${title}. It started like any other day.`, move: 'idle', expr: 'happy', goTo: null, tone: 'warmly, like a storybook' },
    { who: who(0), line: `Hi everyone! I'm ${name(0)}, and today is going to be amazing.`, move: 'wave', expr: 'happy', goTo: null, tone: 'cheerfully' },
    { who: who(1), line: ids.length > 1 ? `Amazing? Last time you said that, we ended up in a pond.` : `Okay, maybe amazing. Maybe a little bit chaotic.`, move: 'cross', expr: 'suspicious', goTo: null, tone: 'teasing' },
    { who: who(0), line: `That was one time! Besides, I have a plan.`, move: 'think', expr: 'thinking', goTo: null, tone: 'confidently' },
    { who: who(2), line: `Uh oh. Whenever there's a plan, something goes wrong.`, move: 'nervous', expr: 'nervous', goTo: null, tone: 'nervously' },
    { who: who(0), line: `Come on, follow me!`, move: 'walk', expr: 'excited', goTo: Math.min(0.6, xs[0] + 0.5), tone: 'excitedly' },
    { who: who(1), line: `Wait, what is that? Did everyone just hear that?`, move: 'look', expr: 'curious', goTo: null, tone: 'curiously' },
    { who: who(0), line: `It's... the best surprise ever! We did it!`, move: 'cheer', expr: 'bigGrin', goTo: null, tone: 'overjoyed' },
    { who: who(1), line: `Okay, okay. You were right. Today really was amazing.`, move: 'clap', expr: 'laugh', goTo: null, tone: 'laughing' },
    { who: 'narrator', line: `And that was only the beginning. The end!`, move: 'dance', expr: 'happy', goTo: null, tone: 'warmly' },
  ];
  return {
    title, logline: `A demo cartoon starring ${cast.map(c => c.name).join(' and ')}. Add a Claude API key to have Claude write and stage your real story.`,
    locations: [{ id: loc, name: place.name || 'Sunny park', skyTop: '#7ec4f2', skyBottom: '#dff2ff', groundY: 0.84, light: 'day', layers: [] }],
    scenes: [{ location: loc, cast: ids.map((id, i) => ({ who: id, x: xs[i] })), beats }],
  };
}
