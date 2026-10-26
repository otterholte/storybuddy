// Shared performance track for both renderers. Reads window.TIMELINE (shared/timeline.js)
// and answers "what is she doing at time t?" so the SVG and mesh versions act identically.
//
//   const P = Perf(window.TIMELINE);
//   const s = P.at(t);
//   s.scene      -> {id, kind:'talk'|'story', set, start, end}
//   s.local      -> seconds since scene start;  s.sceneT -> 0..1 through the scene
//   s.expr       -> {name: weight} blended facial expressions (weights sum to 1)
//   s.gesture    -> {name, t0, age, prev, prevAge, blend}  current gesture/action (blend 0..1 from prev)
//   s.mouth      -> {open 0..1, wide -1..1 (narrow..wide), round 0..1, closed 0..1 (m/b/p), fv 0..1}
//   s.blink      -> 0..1 eyelid closure
//   s.talking    -> true while a line is being spoken;  s.word -> current word or null
//   s.emph       -> 0..1 pulse on stressed words (use for small head nods / brow raises)
//   s.walkPhase  -> walk cycle phase in cycles (1 cycle = 2 steps = WALK_PERIOD s), only advances while walking
//   s.walking    -> 0..1 how much she is walking (eases in/out)
(function () {
  const WALK_PERIOD = 1.05;               // seconds per full stride (left+right)
  const WALK_ACTIONS = new Set(['walk', 'arrive', 'climb', 'follow', 'sip']);
  const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  function Perf(TL) {
    const lines = TL.lines, scenes = TL.scenes, fps = TL.fps;
    // flatten cues
    const expr = [], gest = [];
    for (const l of lines) for (const c of l.cues) (c.k === 'e' ? expr : gest).push({ t: c.t, v: c.v, line: l.id });
    expr.sort((a, b) => a.t - b.t); gest.sort((a, b) => a.t - b.t);
    const sceneOf = t => scenes.find(s => t >= s.start && t < s.end) || scenes[scenes.length - 1];
    // a gesture never carries across scenes: each scene starts at its first cue (or idle)
    function gestureAt(t, sc) {
      let cur = null, prev = null;
      for (const g of gest) { if (g.t > t) break; if (g.t >= sc.start - 0.01) { prev = cur; cur = g; } }
      if (!cur) {
        // before the first cue in a story scene, she is already doing the scene's first action (lead-in)
        const first = gest.find(g => g.t >= sc.start - 0.01 && g.t < sc.end);
        if (first && sc.kind === 'story') cur = { t: sc.start, v: first.v };
        else cur = { t: sc.start, v: 'none' };
      }
      const age = t - cur.t;
      return { name: cur.v, t0: cur.t, age, prev: prev ? prev.v : 'none', prevAge: prev ? t - prev.t : 99, blend: smooth(age / 0.45) };
    }
    function exprAt(t, sc) {
      let cur = null, prev = null;
      for (const e of expr) { if (e.t - 0.12 > t) break; if (e.t >= sc.start - 0.01) { prev = cur; cur = e; } }
      if (!cur) { const first = expr.find(e => e.t >= sc.start - 0.01 && e.t < sc.end); return { [first ? first.v : 'neutral']: 1 }; }
      const k = smooth((t - (cur.t - 0.12)) / 0.3), o = {};
      o[cur.v] = k; const pv = prev ? prev.v : 'neutral'; o[pv] = (o[pv] || 0) + 1 - k;
      return o;
    }
    // phoneme-ish shape from the letters of the current word
    function shapeOf(word, u) {
      const w = word.toLowerCase().replace(/[^a-z']/g, '') || 'a';
      const groups = w.match(/th|sh|ch|oo|ee|ea|ou|ow|[aeiouy]+|[^aeiouy]/g) || ['a'];
      const g = groups[Math.min(groups.length - 1, Math.floor(u * groups.length))];
      if (/^[mbp]$/.test(g)) return { closed: 1 };
      if (/^[fv]$/.test(g)) return { fv: 1 };
      if (/oo|ou|ow|^o|^u|^w$/.test(g)) return { round: 1, wide: -0.6 };
      if (/ee|ea|^e|^i|^y/.test(g)) return { wide: 0.8 };
      if (/^a/.test(g)) return { wide: 0.3 };
      if (/th|sh|ch|^[sz]$/.test(g)) return { wide: 0.5, teeth: 1 };
      return { wide: 0.1 };
    }
    function mouthAt(t) {
      const fi = Math.max(0, Math.min(TL.mouth.length - 1, t * fps));
      const i0 = Math.floor(fi), f = fi - i0;
      const env = TL.mouth[i0] * (1 - f) + (TL.mouth[i0 + 1] || 0) * f;
      let word = null, u = 0;
      for (const l of lines) {
        if (t < l.start - 0.05 || t > l.end + 0.05) continue;
        for (const w of l.words) if (t >= w.t && t < w.t + w.d) { word = w; u = (t - w.t) / w.d; }
      }
      const m = { open: 0, wide: 0, round: 0, closed: 0, fv: 0, teeth: 0 };
      // smooth shape over ~60ms by sampling around t
      if (word) {
        let n = 0;
        for (const du of [-0.05, 0, 0.05]) {
          const uu = Math.max(0, Math.min(0.999, u + du / word.d)), s = shapeOf(word.w, uu);
          m.wide += s.wide || 0; m.round += s.round || 0; m.closed += s.closed || 0; m.fv += s.fv || 0; m.teeth += s.teeth || 0; n++;
        }
        for (const k of ['wide', 'round', 'closed', 'fv', 'teeth']) m[k] /= n;
      }
      m.open = Math.min(1, Math.pow(env, 0.8)) * (1 - 0.85 * m.closed) * (1 - 0.6 * m.fv);
      return { m, word };
    }
    function blinkAt(t) {
      // blinks every 2.5-5.5s, plus one on each scene start; 0.16s long
      let b = 0;
      for (let k = 0; k < 80; k++) {
        const bt = k * 3.9 + hash(k) * 2.6;
        const d = t - bt; if (d > -0.2 && d < 0.2) b = Math.max(b, 1 - Math.abs(d) / 0.09);
      }
      return Math.max(0, Math.min(1, b));
    }
    // walk phase tables, one per story scene, sampled at 1/120 s
    const walkTab = new Map();
    function walkTable(sc) {
      if (walkTab.has(sc.id)) return walkTab.get(sc.id);
      const dt = 1 / 120, ph = [0], am = [0];
      let phase = 0;
      for (let x = sc.start; x < sc.end + 0.1; x += dt) {
        const g = gestureAt(x, sc), on = WALK_ACTIONS.has(g.name), was = WALK_ACTIONS.has(g.prev) && g.prevAge < 99;
        const k = smooth(g.age / 0.4);
        const amt = on ? (was ? 1 : k) : (was ? 1 - k : 0);
        phase += amt * dt / (g.name === 'climb' ? WALK_PERIOD * 1.5 : WALK_PERIOD);
        ph.push(phase); am.push(amt);
      }
      const tab = { dt, ph, am }; walkTab.set(sc.id, tab); return tab;
    }
    function walkAt(t, sc) {
      if (sc.kind !== 'story') return { phase: 0, amt: 0 };
      const tab = walkTable(sc), i = Math.max(0, Math.min(tab.ph.length - 1, Math.round((t - sc.start) / tab.dt)));
      return { phase: tab.ph[i], amt: tab.am[i] };
    }
    function emphAt(t, word) {
      if (!word) return 0;
      const long = word.w.replace(/[^a-z]/gi, '').length >= 5 || /!|\?/.test(word.w);
      const a = (t - word.t) / Math.max(0.12, word.d);
      return long ? Math.sin(Math.PI * Math.max(0, Math.min(1, a))) : 0;
    }
    return {
      duration: TL.duration, fps, WALK_PERIOD, scenes, lines,
      at(t) {
        const sc = sceneOf(t), g = gestureAt(t, sc), { m, word } = mouthAt(t), w = walkAt(t, sc);
        return {
          t, scene: sc, local: t - sc.start, sceneT: (t - sc.start) / (sc.end - sc.start),
          expr: exprAt(t, sc), gesture: g, mouth: m, blink: blinkAt(t), word: word ? word.w : null,
          talking: lines.some(l => t >= l.start && t <= l.end), emph: emphAt(t, word),
          walkPhase: w.phase, walking: w.amt
        };
      },
      // footstep times (for the sound mix): contacts at phase k*0.5 while walking
      footsteps() {
        const out = [];
        for (const sc of scenes) {
          if (sc.kind !== 'story') continue;
          let last = 0;
          for (let x = sc.start; x < sc.end; x += 1 / 60) {
            const w = walkAt(x, sc), k = Math.floor(w.phase * 2);
            if (k > last && w.amt > 0.3) { out.push({ t: +x.toFixed(3), set: sc.set, amt: w.amt }); }
            last = Math.max(last, k);
          }
        }
        return out;
      }
    };
  }
  window.Perf = Perf;
})();
