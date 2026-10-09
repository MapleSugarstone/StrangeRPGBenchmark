import { shapeOf, type Profile } from './profiles';

export type Type = 'STONE' | 'TIDE' | 'ROOT' | 'GEAR' | 'BEAST' | 'STAR' | 'SALT' | 'VOID';

export const TYPES: Type[] = ['STONE', 'TIDE', 'ROOT', 'GEAR', 'BEAST', 'STAR', 'SALT', 'VOID'];

// Each attacking type beats two or three defenders. The reverse edge is a resisted hit.
// SALT and VOID live on the Strand. The six Volute types keep their old edges among themselves.
const BEATS: Record<Type, Type[]> = {
  STONE: ['BEAST', 'STAR', 'VOID'],
  TIDE: ['STONE', 'GEAR', 'SALT'],
  ROOT: ['STONE', 'TIDE'],
  GEAR: ['ROOT', 'BEAST', 'VOID'],
  BEAST: ['ROOT', 'STAR'],
  STAR: ['TIDE', 'GEAR'],
  SALT: ['ROOT', 'BEAST'],
  VOID: ['STAR', 'SALT'],
};

export const TYPE_COLOR: Record<Type, string> = {
  STONE: '#a89a80',
  TIDE: '#5a8ad0',
  ROOT: '#5aa04a',
  GEAR: '#c87a3a',
  BEAST: '#d07a8a',
  STAR: '#d8c040',
  SALT: '#e4e8f0',
  VOID: '#6a4aa8',
};

export const TYPE_SHORT: Record<Type, string> = {
  STONE: 'STN', TIDE: 'TDE', ROOT: 'RT', GEAR: 'GR', BEAST: 'BST', STAR: 'STR', SALT: 'SLT', VOID: 'VD',
};

export function typeMult(attack: Type, defend: Type[]): number {
  let m = 1;
  for (const d of defend) {
    if (BEATS[attack].includes(d)) m *= 1.5;
    else if (BEATS[d].includes(attack)) m *= 0.67;
  }
  return Math.max(0.5, Math.min(2, m));
}

export interface Stats { hp: number; atk: number; def: number; res: number; mgk: number; agi: number; cha: number }

const S1: Stats = { hp: 100, atk: 40, def: 24, res: 24, mgk: 40, agi: 40, cha: 40 };
const S100: Stats = { hp: 250, atk: 100, def: 60, res: 60, mgk: 100, agi: 100, cha: 100 };

/** The highest level. Level 50 stands where level 100 stood. */
export const LEVEL_MAX = 50;
/** Content and saves before version 2 write levels on the old 1 to 100 scale. This is that level on the current scale. */
export const halveLevel = (old: number): number => Math.max(1, Math.min(LEVEL_MAX, Math.round(old / 2)));
/** Below this level stats start lower and climb faster, so a few levels decide an early fight. */
const STEEP_TO = 5;
const STEEP_LOW = 0.65;

function lineAt(level: number): Stats {
  const k = (level - 1) / (LEVEL_MAX - 1);
  const out = {} as Stats;
  for (const key of Object.keys(S1) as (keyof Stats)[]) out[key] = Math.round(S1[key] + (S100[key] - S1[key]) * k);
  return out;
}

/** The shared curve at a level, shaped by a kind's stat profile (src/data/profiles.ts) when one is given. */
export function statsAt(level: number, profile?: Profile): Stats {
  const L = Math.max(1, Math.min(LEVEL_MAX, level));
  let out: Stats;
  if (L >= STEEP_TO) out = lineAt(L);
  else {
    const top = lineAt(STEEP_TO), f = (L - 1) / (STEEP_TO - 1);
    out = {} as Stats;
    for (const key of Object.keys(S1) as (keyof Stats)[]) out[key] = Math.round(S1[key] * STEEP_LOW + (top[key] - S1[key] * STEEP_LOW) * f);
  }
  if (profile) for (const key of Object.keys(S1) as (keyof Stats)[]) out[key] = Math.max(1, Math.round(out[key] * shapeOf(profile, key)));
  return out;
}

/** Experience for the next level: two levels of the old curve, so leveling takes about as long as before. */
export function xpToNext(level: number): number {
  const old = (n: number) => 8 + 1.2 * Math.pow(n, 1.4);
  return Math.round(old(2 * level - 1) + old(2 * level));
}
