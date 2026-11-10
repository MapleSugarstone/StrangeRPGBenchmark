import type { State } from './types';

/** Returns a float in [0, 1) and advances the state's seed (mulberry32). */
export function rnd(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rint(s: { rng: number }, n: number): number {
  return Math.floor(rnd(s) * n);
}

export function pick<X>(s: { rng: number }, list: readonly X[]): X {
  return list[rint(s, list.length)];
}

export function shuffle<X>(s: { rng: number }, list: X[]): X[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rint(s, i + 1);
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h | 0;
}

export type Rng = Pick<State, 'rng'>;
