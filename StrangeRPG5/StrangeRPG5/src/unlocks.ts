// Unlocks! Progression system! New abilities, areas, items unlocked!

export class UnlockManager {
  unlocks: { name: string; type: string; required: string }[] = [];

  constructor() {
    // Areas!
    this.unlocks.push({ name: 'Shadow Realm', type: 'area', required: 'Find the Void Key' });
    this.unlocks.push({ name: 'Crystal Depths', type: 'area', required: 'Sing the silent song' });
    this.unlocks.push({ name: 'Clock Tower', type: 'area', required: 'Break all the clocks' });
    this.unlocks.push({ name: 'Dream Shore', type: 'area', required: 'Wake up underwater' });
    this.unlocks.push({ name: 'Star Bridge', type: 'area', required: 'Fall up into space' });
    this.unlocks.push({ name: 'Home', type: 'area', required: 'Be yourself' });

    // Abilities!
    this.unlocks.push({ name: 'Time Slow', type: 'ability', required: 'Defeat the Clock Spider' });
    this.unlocks.push({ name: 'Gravity Punch', type: 'ability', required: 'Find the star vault' });
    this.unlocks.push({ name: 'Dream Walk', type: 'ability', required: 'Wake up in the dream sea' });
    this.unlocks.push({ name: 'Reality Tear', type: 'ability', required: 'Become what you are meant to be' });

    // Items!
    this.unlocks.push({ name: 'Star Crown', type: 'item', required: 'Reach the highest tower' });
    this.unlocks.push({ name: 'Void Stone', type: 'item', required: 'Defeat the void' });
    this.unlocks.push({ name: 'Your Heart', type: 'item', required: 'Choose yourself' });
  }

  unlock(name: string) {
    const unlocked = this.unlocks.find(u => u.name === name);
    if (unlocked) {
      console.log(`Unlocked: ${name}!`);
    }
  }
}
