// === Party System ===

export interface StatBlock {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  sporePower: number; // magic stat
  speed: number;
  abilities: Ability[];
}

export interface Ability {
  name: string;
  description: string;
  power: number;
  type: 'spore' | 'heal' | 'buff' | 'gear' | 'special';
  cost: number; // spore points cost
}

export interface PartyMember extends StatBlock {
  id: string;
  spriteKey: string;
}

export const party: PartyMember[] = [];

export function createBuphila(): PartyMember {
  return {
    id: 'buphila',
    name: 'Buphila',
    spriteKey: 'beetle',
    hp: 45,
    maxHp: 45,
    attack: 6,
    defense: 4,
    sporePower: 12,
    speed: 5,
    abilities: [
      { name: 'Spore Burst', description: 'Launch a spore explosion', power: 15, type: 'spore', cost: 3 },
      { name: 'Spore Bind', description: 'Bind enemy with sticky spores', power: 8, type: 'spore', cost: 2 },
      { name: 'Spore Bloom', description: 'Heal with spore energy', power: 12, type: 'heal', cost: 4 },
      { name: 'Shell Guard', description: 'Raise shell for defense boost', power: 0, type: 'buff', cost: 2 },
    ]
  };
}

export function createMyco(): PartyMember {
  return {
    id: 'myco',
    name: 'Myco',
    spriteKey: 'mushroom',
    hp: 35,
    maxHp: 35,
    attack: 4,
    defense: 3,
    sporePower: 15,
    speed: 4,
    abilities: [
      { name: 'Spore Heal', description: 'Restore HP with spores', power: 15, type: 'heal', cost: 4 },
      { name: 'Mycelium Link', description: 'Share damage with party', power: 5, type: 'heal', cost: 3 },
      { name: 'Fungal Cloud', description: 'Release spore cloud', power: 10, type: 'spore', cost: 3 },
      { name: 'Spore Shield', description: 'Create protective spore wall', power: 0, type: 'buff', cost: 2 },
    ]
  };
}

export function createCogsworth(): PartyMember {
  return {
    id: 'cogsworth',
    name: 'Cogsworth',
    spriteKey: 'fox',
    hp: 40,
    maxHp: 40,
    attack: 10,
    defense: 6,
    sporePower: 5,
    speed: 7,
    abilities: [
      { name: 'Gear Smash', description: 'Powerful physical strike', power: 18, type: 'gear', cost: 4 },
      { name: 'Spin Dash', description: 'Dash attack through enemies', power: 12, type: 'gear', cost: 3 },
      { name: 'Overcharge', description: 'Boost next attack', power: 0, type: 'buff', cost: 2 },
      { name: 'Self-Repair', description: 'Fix own gears', power: 10, type: 'heal', cost: 3 },
    ]
  };
}

export function joinParty(member: PartyMember): void {
  party.push(member);
}

export function removeFromParty(id: string): void {
  const idx = party.findIndex(m => m.id === id);
  if (idx >= 0) party.splice(idx, 1);
}

// Party total stats
export function getPartyStats(): { totalHp: number; totalAttack: number; totalDefense: number; totalSporePower: number } {
  return party.reduce((acc, m) => {
    acc.totalHp += m.hp;
    acc.totalAttack += m.attack;
    acc.totalDefense += m.defense;
    acc.totalSporePower += m.sporePower;
    return acc;
  }, { totalHp: 0, totalAttack: 0, totalDefense: 0, totalSporePower: 0 });
}
