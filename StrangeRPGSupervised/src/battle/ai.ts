import { BattleState, RuinState } from './engine.js';
import { MoveData, MOVES } from './moves.js';
import { getTypeMultiplier, Type } from './types.js';
import { SPECIES } from './species.js';

/**
 * Represents a possible action for the AI.
 */
interface AiAction {
  type: 'attack' | 'move' | 'guard' | 'switch' | 'link' | 'breakLink' | 'run';
  moveKey?: string;
  switchIndex?: number;
}

/**
 * Scores a potential action by simulating it on a copy of the state.
 */
function scoreAction(state: BattleState, action: AiAction): number {
  // Deep copy state for simulation
  const simState = JSON.parse(JSON.stringify(state)) as BattleState;
  
  // Apply action
  if (action.type === 'move' && action.moveKey) {
    const move = MOVES[action.moveKey];
    if (move) {
      // Simplified damage calc for scoring
      const attacker = simState.playerTeam[0];
      const defender = simState.opponentTeam[0];
      const atk = attacker.currentStats.atk;
      const def = defender.currentStats.def;
      const attackerType = SPECIES[attacker.speciesKey]?.types[0] || Type.Stone;
      const defenderType = SPECIES[defender.speciesKey]?.types[0] || Type.Stone;
      const typeMult = getTypeMultiplier(attackerType, defenderType);
      // Rough damage estimate
      const dmg = Math.max(1, Math.floor((atk * move.power) / def * typeMult * 1.5));
      defender.hp -= dmg;
      if (defender.hp <= 0) return 100; // KO is best
    }
  } else if (action.type === 'attack') {
    const attacker = simState.playerTeam[0];
    const defender = simState.opponentTeam[0];
    const dmg = Math.max(1, Math.floor(attacker.currentStats.atk / defender.currentStats.def * 1.5));
    defender.hp -= dmg;
    if (defender.hp <= 0) return 100;
  } else if (action.type === 'guard') {
    return 10; // Small positive score for survival
  } else if (action.type === 'switch' && action.switchIndex !== undefined) {
    return 20; // Switching is okay if current is weak
  } else if (action.type === 'link') {
    return 50; // Link is strong
  } else if (action.type === 'breakLink') {
    return 5;
  } else if (action.type === 'run') {
    return -100; // Running is bad in training battles
  }

  // Default score based on remaining HP advantage
  const playerHp = simState.playerTeam.reduce((sum, r) => sum + r.hp, 0);
  const oppHp = simState.opponentTeam.reduce((sum, r) => sum + r.hp, 0);
  return playerHp - oppHp;
}

/**
 * Gets the best action for the current player.
 */
export function getBestAction(state: BattleState): AiAction {
  const actions: AiAction[] = [
    { type: 'attack' },
    { type: 'guard' },
    { type: 'link' },
    { type: 'breakLink' },
  ];

  // Add move actions
  const activeRuin = state.playerTeam[0];
  for (const move of activeRuin.moves) {
    if (move.cooldownLeft === 0) {
      actions.push({ type: 'move', moveKey: move.data.name });
    }
  }

  // Add switch actions
  for (let i = 1; i < state.playerTeam.length; i++) {
    if (!state.playerTeam[i].isFainted) {
      actions.push({ type: 'switch', switchIndex: i });
    }
  }

  // Score all actions
  let bestAction = actions[0];
  let bestScore = -Infinity;

  for (const action of actions) {
    const score = scoreAction(state, action);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return bestAction;
}
