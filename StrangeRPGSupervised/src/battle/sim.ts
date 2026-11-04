import { simulateBattle } from './engine.js';

/**
 * Simulates a full battle in which the player only attacks; the opponent answers each turn inside the engine.
 * Deterministic: the engine has no randomness.
 */
export function simulate(
  playerSpecies: string[],
  opponentSpecies: string[],
  playerLevel: number = 10,
  opponentLevel: number = 10
): { winner: 'player' | 'opponent'; turnCount: number; log: string[] } {
  return simulateBattle(playerSpecies, opponentSpecies, playerLevel, opponentLevel);
}
