// Items system! Equipment, consumables, weird key items!

export class ItemManager {
  items: { name: string; type: string; power: number; weirdness: number; description: string }[] = [];

  constructor() {
    // Weapons!
    this.items.push({ name: 'Quantum Dagger', type: 'weapon', power: 12, weirdness: 5, description: 'Cuts reality itself' });
    this.items.push({ name: 'Starfire Wand', type: 'weapon', power: 15, weirdness: 8, description: 'Hurts things with light' });
    this.items.push({ name: 'Clock Hammer', type: 'weapon', power: 10, weirdness: 6, description: 'Time moves slow when you swing it' });

    // Armor!
    this.items.push({ name: 'Moonstone Ring', type: 'armor', power: 3, weirdness: 7, description: 'Nightmares can\'t touch you' });
    this.items.push({ name: 'Void Cloak', type: 'armor', power: 5, weirdness: 10, description: 'You\'re not here, really' });
    this.items.push({ name: 'Star Crown', type: 'armor', power: 2, weirdness: 9, description: 'See the truth behind everything' });

    // Consumables!
    this.items.push({ name: 'Reality Pill', type: 'consumable', power: 5, weirdness: 10, description: 'Remember who you are for one minute' });
    this.items.push({ name: 'Dream Candy', type: 'consumable', power: 4, weirdness: 8, description: 'Sleep but dream happy dreams' });
    this.items.push({ name: 'Time Tea', type: 'consumable', power: 0, weirdness: 12, description: 'Drink it and go back five seconds' });

    // Key Items!
    this.items.push({ name: 'Void Key', type: 'key', power: 0, weirdness: 20, description: 'Opens doors that shouldn\'t exist' });
    this.items.push({ name: 'Door Key', type: 'key', power: 0, weirdness: 15, description: 'Opens the door in your room' });
    this.items.push({ name: 'Your Heart', type: 'key', power: 999, weirdness: 30, description: 'Be whole again' });
  }
}
