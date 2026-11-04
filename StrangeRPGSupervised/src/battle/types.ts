/**
 * The six types of the Kiln, forming a closed loop.
 * Stone -> Metal -> Aether -> Wood -> Fire -> Void -> (back to Stone)
 * Each type beats the next two clockwise (1.5x), loses to the two before (0.67x).
 */
export enum Type {
  Stone = 'Stone',
  Metal = 'Metal',
  Aether = 'Aether',
  Wood = 'Wood',
  Fire = 'Fire',
  Void = 'Void',
}

/**
 * Returns the damage multiplier of attackerType against defenderType.
 */
export function getTypeMultiplier(attackerType: Type, defenderType: Type): number {
  const types = [Type.Stone, Type.Metal, Type.Aether, Type.Wood, Type.Fire, Type.Void];
  const attackerIdx = types.indexOf(attackerType);
  const defenderIdx = types.indexOf(defenderType);

  if (attackerType === defenderType) {
    return 1.0;
  }

  // Calculate distance clockwise
  let distance = (defenderIdx - attackerIdx + 6) % 6;

  // Beats next two (distance 1 or 2)
  if (distance === 1 || distance === 2) {
    return 1.5;
  }

  // Loses to previous two (distance 4 or 5, which is -2 or -1 mod 6)
  if (distance === 4 || distance === 5) {
    return 0.67;
  }

  // Neutral (distance 3, opposite)
  return 1.0;
}
