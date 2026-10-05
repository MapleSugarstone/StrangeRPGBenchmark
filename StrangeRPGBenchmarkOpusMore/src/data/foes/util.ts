import type { EnemyDef, Stats } from '../../battle/types';

type Mods = Partial<Record<keyof Stats, number>>;

// Baseline enemy stats for a level. Mods scale each stat.
export function st(lvl: number, m: Mods = {}): Stats {
  const L = lvl - 1;
  return {
    hp: Math.round((20 + 6.5 * L + 0.06 * L * L) * (m.hp ?? 1)),
    vp: Math.round((12 + 2 * L) * (m.vp ?? 1)),
    pow: Math.round((8 + 1.6 * L) * 1.3 * (m.pow ?? 1)),
    wit: Math.round((7 + 1.55 * L) * 1.3 * (m.wit ?? 1)),
    grd: Math.round((4 + 0.85 * L) * (m.grd ?? 1)),
    spd: Math.round((9 + 0.55 * L) * (m.spd ?? 1)),
  };
}

export function xp(lvl: number, m = 1): number { return Math.round(4.5 * Math.pow(lvl, 1.45) * m); }
export function pl(lvl: number, m = 1): number { return Math.round(3 * Math.pow(lvl, 1.2) * m); }

export type Foe = EnemyDef;
