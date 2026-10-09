// Stat profiles (Notes/stat-profiles.md). Every kind spends the same budget of points across its seven stats on top of a
// shared floor, so whorls at one level differ in shape but not in total. 100 points in a stat gives the old shared
// curve's value there, and 0 points gives the floor, half of it.
import type { Mon } from '../battle/model';
import { MOVES } from '../battle/registry';
import { SPECIES } from './speciesdb';
import type { Stats } from './types';

export type StatKey = keyof Stats;
export const STAT_ORDER: StatKey[] = ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'];
export type Profile = Record<StatKey, number>;

/** Points every kind spends. An even spread is 100 in each of the seven stats. */
export const BUDGET = 700;
/** The share of the old curve every whorl has in every stat before its points, so no stat is ever dead. */
export const FLOOR = 0.5;
/** The fewest and most points one stat may take. */
export const MIN_POINTS = 40;
export const CAP: Profile = { hp: 170, atk: 170, def: 170, res: 170, mgk: 170, agi: 150, cha: 170 };

export const EVEN: Profile = { hp: 100, atk: 100, def: 100, res: 100, mgk: 100, agi: 100, cha: 100 };

/** The balance tools set EVEN_STATS=1 to measure the game as it was before profiles, with every whorl on the even spread. */
const EVEN_ALL = typeof process !== 'undefined' && (process as any).env?.EVEN_STATS === '1';
declare const process: unknown;

/** A profile from points in the order HP, ATK, DEF, RES, MGK, AGI, CHA. */
export function profileFrom(p: readonly number[]): Profile {
  const out = {} as Profile;
  STAT_ORDER.forEach((k, i) => { out[k] = p[i]; });
  return out;
}

/** A kind's profile, from its species entry. Kinds with none take the even spread. */
export function kindProfile(kind: string): Profile {
  return SPECIES[kind]?.profile || EVEN;
}

/**
 * A whorl's profile. A conjoined whorl takes the average of its parents, found through the owners of the moves it kept,
 * so whorls from saves before profiles get theirs too.
 */
export function profileOf(m: Mon): Profile {
  if (EVEN_ALL) return EVEN;
  if (!m.fitted && SPECIES[m.kind]) return kindProfile(m.kind);
  const owners = [...new Set(m.moves.map(id => MOVES[id]?.owner).filter((o): o is string => !!o && !!SPECIES[o]))];
  if (!owners.length) return EVEN;
  const out = {} as Profile;
  for (const k of STAT_ORDER) out[k] = Math.round(owners.reduce((n, o) => n + kindProfile(o)[k], 0) / owners.length);
  return out;
}

/** The multiplier a profile puts on the shared curve for one stat. */
export const shapeOf = (p: Profile, k: StatKey): number => FLOOR + (1 - FLOOR) * p[k] / 100;
