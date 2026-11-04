/**
 * The seven stats of a Ruin.
 * HP, ATK, DEF, RES, MGK, AGI, CHA.
 */
export interface Stats {
  hp: number;
  atk: number;
  def: number;
  res: number;
  mgk: number;
  agi: number;
  cha: number;
}

/**
 * Base stat curve for every species at a given level.
 * Uses a standard RPG scaling curve: Base + (Level * Growth).
 * These are the base values at Level 1 before species modifiers.
 */
const BASE_STATS_L1: Stats = {
  hp: 20,
  atk: 10,
  def: 10,
  res: 10,
  mgk: 10,
  agi: 10,
  cha: 10,
};

/**
 * Growth per level for each stat.
 */
const GROWTH_PER_LEVEL: Stats = {
  hp: 5,
  atk: 2,
  def: 2,
  res: 2,
  mgk: 2,
  agi: 2,
  cha: 1,
};

/**
 * Calculates the base stats for a Ruin at a specific level.
 * Formula: Base + (Level - 1) * Growth.
 * This ensures Level 1 uses the L1 base exactly.
 */
export function getBaseStats(level: number): Stats {
  if (level < 1) level = 1;
  const factor = level - 1;
  return {
    hp: BASE_STATS_L1.hp + factor * GROWTH_PER_LEVEL.hp,
    atk: BASE_STATS_L1.atk + factor * GROWTH_PER_LEVEL.atk,
    def: BASE_STATS_L1.def + factor * GROWTH_PER_LEVEL.def,
    res: BASE_STATS_L1.res + factor * GROWTH_PER_LEVEL.res,
    mgk: BASE_STATS_L1.mgk + factor * GROWTH_PER_LEVEL.mgk,
    agi: BASE_STATS_L1.agi + factor * GROWTH_PER_LEVEL.agi,
    cha: BASE_STATS_L1.cha + factor * GROWTH_PER_LEVEL.cha,
  };
}
