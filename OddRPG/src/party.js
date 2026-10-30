// === Party System ===

export function createBuphila() {
  return {
    id: 'buphila', name: 'Buphila', spriteKey: 'beetle',
    hp: 45, maxHp: 45, attack: 6, defense: 4, sporePower: 12, speed: 5,
    abilities: [
      { name: 'Spore Burst', power: 15, type: 'spore', cost: 3 },
      { name: 'Spore Bind', power: 8, type: 'spore', cost: 2 },
      { name: 'Spore Bloom', power: 12, type: 'heal', cost: 4 },
      { name: 'Shell Guard', power: 0, type: 'buff', cost: 2 },
    ]
  };
}

export function createMyco() {
  return {
    id: 'myco', name: 'Myco', spriteKey: 'mushroom',
    hp: 35, maxHp: 35, attack: 4, defense: 3, sporePower: 15, speed: 4,
    abilities: [
      { name: 'Spore Heal', power: 15, type: 'heal', cost: 4 },
      { name: 'Mycelium Link', power: 5, type: 'heal', cost: 3 },
      { name: 'Fungal Cloud', power: 10, type: 'spore', cost: 3 },
      { name: 'Spore Shield', power: 0, type: 'buff', cost: 2 },
    ]
  };
}

export function createCogsworth() {
  return {
    id: 'cogsworth', name: 'Cogsworth', spriteKey: 'fox',
    hp: 40, maxHp: 40, attack: 10, defense: 6, sporePower: 5, speed: 7,
    abilities: [
      { name: 'Gear Smash', power: 18, type: 'gear', cost: 4 },
      { name: 'Spin Dash', power: 12, type: 'gear', cost: 3 },
      { name: 'Overcharge', power: 0, type: 'buff', cost: 2 },
      { name: 'Self-Repair', power: 10, type: 'heal', cost: 3 },
    ]
  };
}

export function getPartyStats(party) {
  return party.reduce((acc, m) => {
    acc.totalHp += m.hp;
    acc.totalAttack += m.attack;
    acc.totalDefense += m.defense;
    acc.totalSporePower += m.sporePower;
    return acc;
  }, { totalHp: 0, totalAttack: 0, totalDefense: 0, totalSporePower: 0 });
}
