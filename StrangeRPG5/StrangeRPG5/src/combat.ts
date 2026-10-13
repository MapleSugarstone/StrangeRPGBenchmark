// Turn-based combat system with abilities, spells, party mechanics!
// Fun > Fairness! Every fight feels like eight rounds of "wait what" and "oh no"!

interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  spriteSeed: number;
  abilities: Ability[];
  isParty: boolean;
}

interface Ability {
  name: string;
  type: 'physical' | 'magical' | 'healing' | 'buff' | 'debuff' | 'weird';
  power: number;
  mpCost: number;
  targets: 'single' | 'all-enemies' | 'self' | 'party' | 'reality';
  description: string;
  weirdEffect?: string;
}

// Kira's abilities! Dreamweaver!
const KIRA_ABILITIES: Ability[] = [
  { name: 'Dream Slash', type: 'physical', power: 12, mpCost: 0, targets: 'single', description: 'Hurt reality with your hands' },
  { name: 'Starlight', type: 'magical', power: 15, mpCost: 8, targets: 'single', description: 'Hurt things with light. Hurts undead more.', weirdEffect: 'Stars appear behind the enemy' },
  { name: 'Reality Tear', type: 'weird', power: 20, mpCost: 15, targets: 'reality', description: 'Break the rules for one turn. Everything is possible.', weirdEffect: 'The screen glitches. Time moves wrong.' },
];

// Brass's abilities! Ironheart Knight!
const BRASS_ABILITIES: Ability[] = [
  { name: 'Shield Bash', type: 'physical', power: 18, mpCost: 0, targets: 'single', description: 'Hit them with a wall' },
  { name: 'Iron Wall', type: 'buff', power: 0, mpCost: 5, targets: 'self', description: 'Take less damage for a while', weirdEffect: 'You become a wall. Walls are strong.' },
  { name: 'Counterstrike', type: 'physical', power: 15, mpCost: 3, targets: 'single', description: 'Hit back harder when they hit you' },
];

// Luna's abilities! Starlight Weaver!
const LUNA_ABILITIES: Ability[] = [
  { name: 'Nova Burst', type: 'magical', power: 20, mpCost: 12, targets: 'all-enemies', description: 'Hurt everyone with starlight' },
  { name: 'Moonbeam', type: 'magical', power: 15, mpCost: 6, targets: 'single', description: 'Hurt one person really well' },
  { name: 'Gravity Well', type: 'weird', power: 12, mpCost: 8, targets: 'all-enemies', description: 'Pull enemies together and hurt them more', weirdEffect: 'Enemies fall toward each other. Space bends.' },
];

// Bosses! Each chapter has a boss that changes everything!
const BOSSES: Combatant[] = [
  {
    name: 'The Door',
    hp: 500, maxHp: 500, mp: 100, maxMp: 100,
    attack: 15, defense: 10, speed: 3, spriteSeed: 1,
    abilities: [
      { name: 'Watch', type: 'weird', power: 5, mpCost: 0, targets: 'single', description: 'Doors aren\'t exits. Doors are choices.' },
    ],
    isParty: false,
  },
  {
    name: 'The Silent Song',
    hp: 800, maxHp: 800, mp: 200, maxMp: 200,
    attack: 10, defense: 8, speed: 7, spriteSeed: 2,
    abilities: [
      { name: 'Listen', type: 'weird', power: 20, mpCost: 10, targets: 'party', description: 'Listen to me. Please listen.' },
    ],
    isParty: false,
  },
  {
    name: 'The Clock King',
    hp: 1200, maxHp: 1200, mp: 150, maxMp: 150,
    attack: 12, defense: 15, speed: 4, spriteSeed: 3,
    abilities: [
      { name: 'Tick', type: 'weird', power: 10, mpCost: 5, targets: 'all-enemies', description: 'I am the hour you wasted.' },
    ],
    isParty: false,
  },
  {
    name: 'The Dream Eater',
    hp: 1600, maxHp: 1600, mp: 250, maxMp: 250,
    attack: 8, defense: 5, speed: 9, spriteSeed: 4,
    abilities: [
      { name: 'Sleep', type: 'weird', power: 25, mpCost: 15, targets: 'party', description: 'Sleep. Just sleep.' },
    ],
    isParty: false,
  },
  {
    name: 'The Void',
    hp: 2000, maxHp: 2000, mp: 300, maxMp: 300,
    attack: 20, defense: 0, speed: 1, spriteSeed: 5,
    abilities: [
      { name: 'Hungry', type: 'weird', power: 30, mpCost: 20, targets: 'party', description: 'I am what\'s left.' },
    ],
    isParty: false,
  },
  {
    name: 'Yourself',
    hp: 2500, maxHp: 2500, mp: 400, maxMp: 400,
    attack: 25, defense: 20, speed: 11, spriteSeed: 6,
    abilities: [
      { name: 'Remember', type: 'weird', power: 35, mpCost: 25, targets: 'self', description: 'I\'m sorry I\'m not who you wanted me to be.' },
    ],
    isParty: false,
  },
];

// Combat system! Measures fun!
class Combat {
  party: Combatant[] = [];
  enemies: Combatant[] = [];
  turnOrder: Combatant[] = [];
  roundCount = 0;
  
  start(party: Combatant[], enemies: Combatant[]) {
    this.party = party;
    this.enemies = enemies;
    this.turnOrder = [...party, ...enemies].sort((a, b) => b.speed - a.speed);
    this.roundCount = 0;
  }
  
  resolveTurn(attacker: Combatant, target: Combatant) {
    const damage = Math.max(1, attacker.attack - target.defense);
    target.hp -= damage;
    this.roundCount++;
    return damage;
  }
  
  useAbility(attacker: Combatant, ability: Ability) {
    if (attacker.mp < ability.mpCost) return 0;
    attacker.mp -= ability.mpCost;
    this.roundCount++;
    return ability.power;
  }
  
  // Balance testing! Measure fun!
  calculateFunScore(): number {
    const idealRounds = 8;
    const deviation = Math.abs(this.roundCount - idealRounds);
    return Math.max(0, 100 - deviation * 5);
  }
  
  get isOver(): boolean {
    return this.enemies.every(e => e.hp <= 0) || this.party.every(p => p.hp <= 0);
  }
}

export const CombatSystem = new Combat();
export { BOSSES };