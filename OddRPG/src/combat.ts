// === Turn-Based Combat Engine ===

import { PartyMember } from './party';

export type CombatState =
  | { phase: 'explore' }
  | {
      phase: 'combat';
      turn: number;
      turnOrder: string[]; // member ids
      currentActor: string | null;
      playerAction: 'move' | 'attack' | 'ability' | 'flee';
      grid: CombatCell[][];
      enemies: Enemy[];
      message: string;
      gameOver: boolean;
      victory: boolean;
    };

export interface CombatCell {
  x: number;
  y: number;
  occupiedBy: string | null;
  isTerrain: string;
}

export interface Enemy {
  id: string;
  name: string;
  spriteKey: string;
  type: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
}

export interface CombatResult {
  won: boolean;
  experience: number;
  gold: number;
}

const GRID_W = 10;
const GRID_H = 8;

export function createCombat(state: CombatState): CombatState {
  if (state.phase !== 'explore') return state;

  // Generate random encounter
  const enemyCount = 1 + Math.floor(Math.random() * 2);
  const enemies: Enemy[] = [];
  const types = ['slime', 'ghost', 'vine'];

  for (let i = 0; i < enemyCount; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    enemies.push({
      id: `enemy_${i}`,
      name: `Wild ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      spriteKey: type,
      type,
      hp: 15 + Math.floor(Math.random() * 10),
      maxHp: 15 + Math.floor(Math.random() * 10),
      attack: 3 + Math.floor(Math.random() * 5),
      defense: 1 + Math.floor(Math.random() * 3),
      speed: 2 + Math.floor(Math.random() * 4),
      x: 0, y: 0, gridX: 1 + i, gridY: 2 + Math.floor(Math.random() * 3),
    });
  }

  return {
    phase: 'combat',
    turn: 1,
    turnOrder: [], // will be set by computeTurnOrder
    currentActor: null,
    playerAction: 'move',
    grid: createGrid(),
    enemies,
    message: `A wild ${enemies[0]?.name || 'enemy'} appears!`,
    gameOver: false,
    victory: false,
  };
}

function createGrid(): CombatCell[][] {
  const grid: CombatCell[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      grid[y][x] = {
        x, y,
        occupiedBy: null,
        isTerrain: Math.random() < 0.15 ? 'crystal' : 'floor'
      };
    }
  }
  return grid;
}

export function startCombat(party: PartyMember[], state: CombatState): CombatState {
  const combat = createCombat(state);
  if (combat.phase !== 'combat') return combat;

  // Place party on grid
  party.forEach((m, i) => {
    combat.grid[1][i].occupiedBy = m.id;
  });

  // Place enemies
  combat.enemies.forEach((e, i) => {
    combat.grid[e.gridY][e.gridX].occupiedBy = e.id;
  });

  // Compute turn order (speed-based)
  const all: { id: string; speed: number; isPlayer: boolean }[] = [];
  party.forEach(m => all.push({ id: m.id, speed: m.speed, isPlayer: true }));
  combat.enemies.forEach(e => all.push({ id: e.id, speed: e.speed, isPlayer: false }));

  all.sort((a, b) => b.speed - a.speed);
  combat.turnOrder = all.map(a => a.id);
  combat.currentActor = combat.turnOrder[0];

  return combat;
}

export function selectAction(state: CombatState, action: string): CombatState {
  if (state.phase !== 'combat' || state.gameOver) return state;

  const newState = { ...state };
  const actorId = state.currentActor!;

  if (action === 'move') {
    newState.playerAction = 'move';
    newState.message = 'Select a tile to move to.';
    return newState;
  }

  if (action === 'attack') {
    newState.playerAction = 'attack';
    newState.message = 'Select an enemy to attack.';
    return newState;
  }

  if (action === 'ability') {
    newState.playerAction = 'ability';
    newState.message = 'Select an ability.';
    return newState;
  }

  if (action === 'flee') {
    // 40% chance to flee
    if (Math.random() < 0.4) {
      newState.message = 'You fled successfully!';
      newState.phase = 'explore';
      return newState;
    }
    newState.message = 'Failed to flee!';
    // Skip to enemy turn
    return advanceTurn(newState);
  }

  return state;
}

function advanceTurn(state: CombatState): CombatState {
  const combat = { ...state };
  const idx = combat.turnOrder.indexOf(combat.currentActor!);
  let nextIdx = (idx + 1) % combat.turnOrder.length;

  // Skip dead actors
  let attempts = 0;
  while (attempts < combat.turnOrder.length) {
    const actorId = combat.turnOrder[nextIdx];
    const alive = isActorAlive(combat, actorId);
    if (alive) break;
    nextIdx = (nextIdx + 1) % combat.turnOrder.length;
    attempts++;
  }

  if (attempts >= combat.turnOrder.length) {
    combat.gameOver = true;
    combat.victory = false;
    combat.message = 'All actors have fallen...';
    return combat;
  }

  combat.currentActor = combat.turnOrder[nextIdx];
  combat.playerAction = 'move';

  // If it's an enemy's turn, auto-attack
  if (!isPartyMember(combat.currentActor!)) {
    combat.message = `Enemy ${combat.currentActor} attacks!`;
    // Simple AI: attack nearest party member
    const enemy = combat.enemies.find(e => e.id === combat.currentActor);
    if (enemy) {
      const targetId = combat.turnOrder.find(id => isPartyMember(id) && isActorAlive(combat, id)) ?? null;
      if (targetId) {
        const targetParty = combat.turnOrder.filter(id => isPartyMember(id) && isActorAlive(combat, id));
        if (targetParty.length > 0) {
          // Deal damage to a random party member
          const targetName = targetParty[Math.floor(Math.random() * targetParty.length)];
          const dmg = Math.max(1, enemy.attack - Math.floor(Math.random() * 4));
          combat.message = `Enemy attacks ${targetName} for ${dmg} damage!`;
        }
      }
    }
    return advanceTurn(combat); // advance again
  }

  return combat;
}

export function performAttack(state: CombatState, targetId: string): CombatState {
  if (state.phase !== 'combat' || state.gameOver) return state;

  const combat = { ...state };
  const actorId = combat.currentActor!;

  // Find actor
  const actor = findActor(combat, actorId);
  const target = findActor(combat, targetId);

  if (!actor || !target) return combat;

  // Calculate damage
  const baseDmg = actor.attack;
  const targetDef = target.defense;
  const variance = Math.floor(Math.random() * 4) - 2;
  const damage = Math.max(1, baseDmg - targetDef + variance);

  target.hp = Math.max(0, target.hp - damage);

  const isEnemy = !isPartyMember(actorId);
  combat.message = `${actor.name} attacks ${target.name} for ${damage} damage!`;

  // Check death
  if (target.hp <= 0) {
    combat.message += `${target.name} is defeated!`;
  }

  // Check victory
  const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
  if (aliveEnemies.length === 0) {
    combat.victory = true;
    combat.gameOver = true;
    combat.message = 'Victory! All enemies defeated!';
  }

  // Check party wipe
  const aliveParty = combat.turnOrder.filter(id => isPartyMember(id) && isActorAlive(combat, id));
  if (aliveParty.length === 0) {
    combat.gameOver = true;
    combat.victory = false;
    combat.message = 'Your party has fallen...';
  }

  return advanceTurn(combat);
}

// Helper functions
function findActor(combat: CombatState, id: string): { name: string; attack: number; defense: number; hp: number; maxHp: number } | null {
  const enemy = combat.enemies.find(e => e.id === id);
  if (enemy) return { name: enemy.name, attack: enemy.attack, defense: enemy.defense, hp: enemy.hp, maxHp: enemy.maxHp };

  // Search party — we need access to party from state
  // For now, use a simple approach
  const partyData = (window as any).__gameParty;
  if (partyData) {
    const member = partyData.find((m: any) => m.id === id);
    if (member) return { name: member.name, attack: member.attack, defense: member.defense, hp: member.hp, maxHp: member.maxHp };
  }
  return null;
}

function isPartyMember(id: string): boolean {
  return !id.startsWith('enemy_');
}

function isActorAlive(combat: CombatState, id: string): boolean {
  const enemy = combat.enemies.find(e => e.id === id);
  if (enemy) return enemy.hp > 0;

  const partyData = (window as any).__gameParty;
  if (partyData) {
    const member = partyData.find((m: any) => m.id === id);
    return member && member.hp > 0;
  }
  return false;
}

export function getGridForCombat(state: CombatState): CombatCell[][] | null {
  return state.phase === 'combat' ? state.grid : null;
}

export function getEnemies(state: CombatState): Enemy[] | null {
  return state.phase === 'combat' ? state.enemies : null;
}

export function getCombatMessage(state: CombatState): string {
  return state.phase === 'combat' ? state.message : '';
}

export function isCombatActive(state: CombatState): boolean {
  return state.phase === 'combat' && !state.gameOver;
}

export function getTurnOrder(state: CombatState): string[] {
  return state.phase === 'combat' ? state.turnOrder : [];
}

export function getCurrentActor(state: CombatState): string | null {
  return state.phase === 'combat' ? state.currentActor : null;
}

export function advanceGameState(state: CombatState): CombatState {
  if (state.phase !== 'combat') return state;
  if (state.gameOver) return state;
  return advanceTurn(state);
}

export function getPartyHp(state: CombatState): { id: string; hp: number; maxHp: number }[] | null {
  if (state.phase !== 'combat') return null;
  const partyData = (window as any).__gameParty as any[];
  if (!partyData) return null;
  return partyData.map(m => ({ id: m.id, hp: m.hp, maxHp: m.maxHp }));
}
