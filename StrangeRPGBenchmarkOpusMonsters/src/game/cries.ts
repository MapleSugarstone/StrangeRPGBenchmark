// Every kind's cry, built from the kind itself: its types pick the timbre, its name the tune, its sprite's bulk the pitch and length.
import type { SpriteData } from '../battle/model';
import { SPECIES } from '../data/species';
import { cry, type CryDef } from '../engine/audio';

/** Scale steps a name's syllables land on, in semitones. */
const STEPS = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A name split into syllables: each one is its vowel group with the consonants before it. */
function syllables(name: string): string[] {
  const out = name.toLowerCase().replace(/[^a-z]/g, '').match(/[^aeiouy]*[aeiouy]+/g) || [name.toLowerCase()];
  return out.length ? out : ['a'];
}

/** The cry of a whorl with this name, these types, and this sprite. */
export function cryFor(name: string, types: readonly string[], sprite: readonly string[]): CryDef {
  const solid = sprite.join('').replace(/\./g, '').length;
  const mass = Math.min(1, solid / 64);
  const syl = syllables(name);
  const seed = hashStr(name);
  const f0 = 520 * Math.pow(2, -mass * 1.6) * (1 + ((seed & 255) / 255 - 0.5) * 0.08);
  // The first letter sets where the call starts, and each syllable after it sets the next point of the tune.
  const pts = [STEPS[name.toLowerCase().charCodeAt(0) % 5]];
  for (const s of syl.slice(0, 4)) pts.push(STEPS[hashStr(s) % STEPS.length]);
  const f = pts.map(st => Math.round(f0 * Math.pow(2, st / 12) * 10) / 10);
  const dur = Math.min(0.9, 0.28 + 0.36 * mass + 0.05 * syl.length);
  return { f, dur: Math.round(dur * 1000) / 1000, types: types.slice(), seed: seed % 100000, mass: Math.round(mass * 100) / 100 };
}

export function speciesCry(kind: string): CryDef | null {
  const sp = SPECIES[kind];
  return sp ? cryFor(sp.name, sp.types, sp.sprite) : null;
}

let byName: Map<string, string> | null = null;
/** The kind whose name this is, if any. Conjoined whorls carry their parents by name. */
export function kindNamed(name: string): string | undefined {
  if (!byName) { byName = new Map(); for (const sp of Object.values(SPECIES)) if (!byName.has(sp.name)) byName.set(sp.name, sp.id); }
  return byName.get(name);
}

/** Anything that can cry: a whorl as it looks right now. */
export interface Crier { name: string; types: readonly string[]; sprite: SpriteData; fitted?: boolean; parents?: [string, string] }

/** The cries a whorl makes at once: its own, or both parents' for a conjoined whorl. */
export function criesOf(w: Crier): CryDef[] {
  if (w.fitted && w.parents) {
    const defs = w.parents.map(p => {
      const k = kindNamed(p);
      return k ? speciesCry(k)! : cryFor(p, w.types, w.sprite.px);
    });
    return defs;
  }
  return [cryFor(w.name, w.types, w.sprite.px)];
}

/** Plays a whorl's cry. A conjoined whorl sounds both parents a breath apart, the second pulled toward the first's pitch. */
export function playCry(w: Crier, mode: 'out' | 'crest' | 'ko' = 'out', opts: { vol?: number; pan?: number; at?: number } = {}): void {
  const defs = criesOf(w);
  if (defs.length === 1) { cry(defs[0], mode, opts); return; }
  const [a, b] = defs;
  const pull = Math.sqrt(a.f[0] / b.f[0]);
  cry(a, mode, { ...opts, vol: (opts.vol ?? 1) * 0.75 });
  cry({ ...b, f: b.f.map(x => x * pull) }, mode, { ...opts, vol: (opts.vol ?? 1) * 0.65, at: (opts.at || 0) + 0.07 });
}

/** Plays a kind's cry, as the Register does. */
export function playKindCry(kind: string, mode: 'out' | 'crest' | 'ko' = 'out', opts: { vol?: number; pan?: number; at?: number } = {}): void {
  const c = speciesCry(kind);
  if (c) cry(c, mode, opts);
}
