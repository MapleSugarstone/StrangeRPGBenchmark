// Experience and levels. At equal levels a Ruin needs about three wins per level; trainers pay double and a big
// fight triple, so story fights move the party forward.

/** Experience a Ruin at this level needs for the next level. */
export function expToNext(level: number): number {
  return Math.round(8 + 1.1 * level * level);
}

/** Experience each party Ruin gains for beating these opponents. */
export function expFor(opponentLevels: number[], kind: "wild" | "trainer" | "boss"): number {
  const base = opponentLevels.reduce((sum, l) => sum + 0.35 * l * l + 6, 0);
  return Math.round(base * (kind === "boss" ? 3 : kind === "trainer" ? 2 : 1));
}

/** Adds experience to one Ruin and returns its new level and leftover experience. */
export function grow(level: number, exp: number, gained: number): { level: number; exp: number } {
  exp += gained;
  while (exp >= expToNext(level) && level < 99) {
    exp -= expToNext(level);
    level++;
  }
  return { level, exp };
}
