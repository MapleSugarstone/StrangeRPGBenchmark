// Pure helpers for transitions: the handover order of the chip's voices, the pitch set two keys share, the bass walk between
// them, and the drones that hold after a stop or a fight.
import type { AreaTint } from '../audio';
import { B, fold, key } from './lib';
import type { Key, Section, TrackDef, Voice } from './lib';

/** map: walking between places. in: into a fight. out: a fight winding down. stop: the music dissolving into a drone. */
export type MeltMode = 'map' | 'in' | 'out' | 'stop';

/** When each voice changes hands, as a share of the transition. */
export const HANDOVER: Record<MeltMode, Record<Voice, number>> = {
  map: { tri: 0.25, p2: 0.5, x: 0.625, p1: 0.75, nz: 1 },
  in: { nz: 0, p2: 0.5, x: 0.5, p1: 0.75, tri: 1 },
  out: { nz: 0, x: 0.25, p1: 0.5, p2: 0.75, tri: 1 },
  stop: { nz: 0, x: 0.25, p1: 0.5, p2: 0.75, tri: 1 },
};

const pc = (n: number): number => ((Math.round(n) % 12) + 12) % 12;

/** The pitch classes of a key. */
export function pcsOf(K: Key): number[] {
  return [...new Set(K.mode.map((s) => pc(K.root + s)))].sort((a, b) => a - b);
}

/** The pitch classes two keys share. With fewer than four, the new key's root and fifth join them. */
export function pivotSet(a: readonly number[], b: readonly number[], bRoot: number): number[] {
  const out = new Set(a.filter((x) => b.includes(x)));
  if (out.size < 4) { out.add(pc(bRoot)); out.add(pc(bRoot + 7)); }
  return [...out].sort((x, y) => x - y);
}

/**
 * A triad of the new key whose three notes the old key also has: the pivot chord of a common-chord modulation. The tonic,
 * subdominant, and relative chords come before the dominant, and a chord with a diminished fifth never counts. Null when the keys share none.
 */
export function commonChord(a: readonly number[], K: Key): number[] | null {
  for (const d of [0, 3, 5, 1, 2, 6, 4]) {
    if (K(d + 4) - K(d) !== 7) continue;
    const t = [pc(K(d)), pc(K(d + 2)), pc(K(d + 4))];
    if (t.every((x) => a.includes(x))) return t;
  }
  return null;
}

/** The tonic triad of a key given as a root and a scale, without its fifth when the scale has no perfect fifth. */
export function tonicTriad(k: { root: number; scale: readonly number[] }): number[] {
  const r = pc(k.root), out = [r, pc(r + (k.scale.includes(pc(r + 3)) ? 3 : 4))];
  if (k.scale.includes(pc(r + 7))) out.push(pc(r + 7));
  return out;
}

/** Moves a pitch to the nearest pitch class of a set. A quarter-tone offset survives the move. */
export function snapPc(n: number, set: readonly number[]): number {
  if (!set.length) return n;
  const base = Math.round(n), frac = n - base;
  for (let k = 0; k <= 6; k++) {
    if (set.includes(pc(base - k))) return base - k + frac;
    if (set.includes(pc(base + k))) return base + k + frac;
  }
  return n;
}

/**
 * A walking bass of `steps` notes from one pitch toward another through a pitch set. It stops one step short of the target,
 * so the new track's own bass note completes it.
 */
export function bassWalk(from: number, to: number, steps: number, set: readonly number[], lo = 28, hi = 56): number[] {
  let f = from;
  while (f - to > 6 && f - 12 >= lo) f -= 12;
  while (to - f > 6 && f + 12 <= hi) f += 12;
  const cand: number[] = [];
  for (let n = lo; n <= hi; n++) if (set.includes(pc(n)) || pc(n) === pc(to)) cand.push(n);
  const near = (x: number) => cand.reduce((b, c) => (Math.abs(c - x) < Math.abs(b - x) ? c : b), cand[0]);
  const a = cand.indexOf(near(f)), z = cand.indexOf(near(to));
  const at = (i: number) => cand[Math.max(0, Math.min(cand.length - 1, i))];
  const out: number[] = [];
  if (a === z) {
    // Already there: an upper neighbor that falls back onto the new bass.
    for (let i = 0; i < steps; i++) out.push(at(a + ((steps - 1 - i) % 2 ? 0 : 1)));
    return out;
  }
  // The walk ends one step from the target. A short distance holds the first note before it walks.
  const dir = Math.sign(z - a), zz = z - dir, dist = Math.abs(zz - a);
  for (let i = 0; i < steps; i++) {
    if (steps < 2) { out.push(at(zz)); continue; }
    if (dist >= steps - 1) out.push(at(a + dir * Math.round((dist * i) / (steps - 1))));
    else { const hold = steps - 1 - dist; out.push(at(i < hold ? a : a + dir * (i - hold))); }
  }
  return out;
}

/**
 * A drone that holds after the music stops or a fight ends. It thins over three long sections and then ends, and the next track
 * grows out of it. won holds a major third and a fifth over the root, lost sinks an octave lower, stop holds the fifth.
 */
export function droneDef(rootPc: number, mode: readonly number[], bpm: number, kind: 'stop' | 'won' | 'lost', tint: AreaTint): TrackDef {
  const r = pc(rootPc);
  const K = key(45 + ((r - 45 + 120) % 12), mode);
  const low = fold(r, kind === 'lost' ? 28 : 33);
  const make = (stage: number) => (): Section => {
    const b = new B(16, 4, bpm);
    b.n('tri', 0, low, 15.9, stage === 2 ? 0.4 : 0.48, { a: 0.3 });
    if (stage === 0) {
      if (kind === 'won') {
        b.n('x', 0, fold(r + 4, 55), 15.8, 0.07, { sus: 1, a: 1, ratio: 1 });
        b.n('x', 0, fold(r + 7, 55), 15.8, 0.07, { sus: 1, a: 1.4, ratio: 1 });
      } else if (kind === 'stop') {
        b.n('x', 0, fold(r + 7, 55), 15.8, 0.08, { sus: 1, a: 1, ratio: 1 });
      } else {
        b.n('x', 0, fold(r, 50), 15.8, 0.07, { sus: 1, a: 1.5, ratio: 1 });
      }
    } else if (stage === 1 && kind !== 'lost') {
      b.n('x', 0, fold(r, 57) + 12, 15.8, 0.06, { sus: 1, a: 1.5, ratio: 1 });
    }
    return b.out({ still: true, tag: 'drone' + stage });
  };
  return {
    bpm, start: 's0', vary: 0, wrong: 0, tint, key: K, motifs: [],
    next: (cur) => (cur === 's0' ? 's1' : cur === 's1' ? 's2' : null),
    secs: { s0: make(0), s1: make(1), s2: make(2) },
  };
}
