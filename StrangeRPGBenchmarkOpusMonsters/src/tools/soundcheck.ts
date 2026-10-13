// Content checks for move sounds: every spec reads with the words in Notes/move-sounds.md, fits its move's picture, and sits
// in the sound file that matches its move's kit file, and every legendary's move plays that legendary's motif. Imported by
// test.ts, which passes its `fail`.
import { MOVES } from '../battle/registry';
import { SPECIES } from '../data/species';
import { fxPlanOf, parseFx } from '../game/fxspec';
import { PLAYABLE } from '../game/movesound';
import { ACTIONS, checkSound, defaultSound, MATERIALS, MOTIFS, parseSound, type SoundEntry } from '../game/soundspec';
import { SOUNDS1 } from '../data/sounds1';
import { SOUNDS2 } from '../data/sounds2';
import { SOUNDS3 } from '../data/sounds3';
import { SOUNDS4 } from '../data/sounds4';
import { SOUNDS5 } from '../data/sounds5';
import { SOUNDS6 } from '../data/sounds6';
import { SOUNDS7 } from '../data/sounds7';
import { SOUNDS8 } from '../data/sounds8';

const FILES: Record<string, SoundEntry>[] = [SOUNDS1, SOUNDS2, SOUNDS3, SOUNDS4, SOUNDS5, SOUNDS6, SOUNDS7, SOUNDS8];

export async function checkSounds(fail: (s: string) => void): Promise<void> {
  const fs = await import('node:fs');
  // The vocabulary and the synth agree: every word plays, and every pitched word knows where its note sits.
  for (const w of Object.keys(ACTIONS)) {
    if (!PLAYABLE.acts.includes(w)) fail(`sound word ${w} has no sound in movesound.ts`);
    if (ACTIONS[w].pitched !== PLAYABLE.pitched.includes(w)) fail(`sound word ${w}: pitched in soundspec.ts but not in NOTE_AT, or the other way`);
  }
  for (const w of Object.keys(MATERIALS)) if (!PLAYABLE.mats.includes(w)) fail(`material ${w} has no sound in movesound.ts`);
  // One motif for each legendary kind, named by its id, and a tune in the synth for each.
  const legends = Object.values(SPECIES).filter(s => s.legendary).map(s => s.id);
  for (const id of legends) if (!MOTIFS[id]) fail(`${id}: a legendary with no motif in soundspec.ts`);
  for (const w of Object.keys(MOTIFS)) {
    if (!legends.includes(w)) fail(`motif ${w} is not a legendary kind's id`);
    if (!PLAYABLE.motifs.includes(w)) fail(`motif ${w} has no tune in movesound.ts`);
  }
  // Which kit file defines each move, so each spec sits in the sound file with the same number.
  const home = new Map<string, number>();
  for (let n = 1; n <= 8; n++) {
    const src = fs.readFileSync(`src/data/kits${n}.ts`, 'utf8') as string;
    for (const m of src.matchAll(/defMove\(\{\s*id: '([^']+)'/g)) home.set(m[1], n);
  }
  const bySpec = new Map<string, string>();
  let own = 0, legendOwn = 0;
  FILES.forEach((file, i) => {
    for (const [id, e] of Object.entries(file)) {
      const m = MOVES[id];
      if (!m) { fail(`${id}: sound for a move that does not exist (sounds${i + 1}.ts)`); continue; }
      if (home.get(id) !== i + 1) fail(`${id}: its sound is in sounds${i + 1}.ts, but the move is in kits${home.get(id) ?? '?'}.ts`);
      own++;
      const legend = MOTIFS[m.owner] ? m.owner : null;
      if (legend) legendOwn++;
      // Each spec is checked against the picture it plays with: the plain picture, or its option's.
      const pairs: [string, string | undefined][] = typeof e === 'string' ? [[e, m.fx]] : [...(e.fx ? [[e.fx, m.fx] as [string, string | undefined]] : []), ...e.opts.map((s, k) => [s, m.fxOpts?.[k]] as [string, string | undefined])];
      if (typeof e !== 'string' && e.opts.length !== (m.fxOpts?.length || 0)) fail(`${id}: ${e.opts.length} option sounds for ${m.fxOpts?.length || 0} option pictures`);
      for (const [spec, fx] of pairs) {
        const pic = fx ? parseFx(fx) : null;
        const bad = checkSound(spec, pic && !('bad' in pic) ? pic : fxPlanOf(m));
        if (bad) { fail(`${id}: sound "${spec}" has ${bad}`); continue; }
        const plan = parseSound(spec);
        if ('bad' in plan) continue;
        if (plan.legend && plan.legend !== legend) fail(`${id}: sound "${spec}" has ${plan.legend}: that motif belongs to ${SPECIES[plan.legend]?.name}'s moves`);
        if (legend && plan.legend !== legend) fail(`${id}: sound "${spec}" leaves out its legendary's motif, ${legend}`);
        // Two moves of one kind never share a spec word for word.
        const key = `${m.owner}:${spec.replace(/\s+/g, ' ').trim()}`;
        if (bySpec.has(key) && bySpec.get(key) !== id) fail(`${id}: sound "${spec}" is the same as ${bySpec.get(key)}'s`);
        bySpec.set(key, id);
      }
    }
  });
  // Every legendary's move has a spec of its own, so each one is written to stand out.
  for (const m of Object.values(MOVES)) if (MOTIFS[m.owner] && !FILES.some(f => f[m.id])) fail(`${m.id}: a legendary's move with no sound spec of its own`);
  // Every move's default reads, so a move without a spec of its own still sounds.
  const defaults = new Set<string>();
  for (const m of Object.values(MOVES)) {
    const d = defaultSound(m, fxPlanOf(m));
    const p = parseSound(d);
    if ('bad' in p) fail(`${m.id}: default sound "${d}" has ${p.bad}: ${p.why}`);
    defaults.add(d);
  }
  const total = Object.keys(MOVES).length;
  console.log(`move sounds: ${own} of ${total} moves have their own spec (${legendOwn} legendary), the rest play one of ${defaults.size} defaults`);
}
