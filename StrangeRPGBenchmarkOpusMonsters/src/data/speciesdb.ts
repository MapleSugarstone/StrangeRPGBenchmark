import type { Type } from './types';

export interface Species {
  id: string;
  name: string;
  types: Type[];
  basic: 'P' | 'M';
  /** Four moves. Small Gran alone has five, her five lines. */
  moves: string[];
  passives: [string, string];
  sprite: string[];
  /** First, second, and an optional third color, drawn for '2', '3', and '4'. */
  c: [string, string, string?];
  fit: string;
  entry: string;
  pegs: number;
  /** The area id where it lives in the wild, for the Register and the area rosters. */
  area?: string;
  legendary?: boolean;
  person?: boolean;
  wild?: boolean;
  /** Its stat profile (src/data/profiles.ts): the points it spends on each stat. Set from src/data/profileTable.ts. */
  profile?: import('./profiles').Profile;
  /** The archetype its profile started from, for the notes and the Register. */
  archetype?: string;
}

export const SPECIES: Record<string, Species> = {};
export const WILD_KINDS: string[] = [];

export function sp(s: Omit<Species, 'wild'> & { wild?: boolean }): void {
  if (s.sprite.length !== 8 || s.sprite.some(r => r.length !== 8)) throw new Error(`bad sprite ${s.id}`);
  if (s.sprite.some(r => /[^.1234]/.test(r))) throw new Error(`bad sprite chars ${s.id}`);
  if (SPECIES[s.id]) throw new Error(`duplicate species ${s.id}`);
  const full: Species = { wild: true, ...s };
  SPECIES[s.id] = full;
  if (full.wild) WILD_KINDS.push(s.id);
}
