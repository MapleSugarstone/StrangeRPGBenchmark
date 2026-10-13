// Spells! Weird magical effects!

interface Spell {
  name: string;
  caster?: string;
  power: number;
  cost: number;
  weirdness: number;
  description: string;
}

export class SpellManager {
  spells: Spell[] = [];

  constructor() {
    // Luna's spells!
    this.spells.push({ name: 'Starfire', caster: 'Luna', power: 20, cost: 10, weirdness: 5, description: 'Hurts things with starlight. Hurts undead more.' });
    this.spells.push({ name: 'Nova Burst', caster: 'Luna', power: 25, cost: 15, weirdness: 8, description: 'Hurt everyone with starlight.' });
    this.spells.push({ name: 'Moonbeam', caster: 'Luna', power: 18, cost: 8, weirdness: 4, description: 'Hurt one person really well.' });
    this.spells.push({ name: 'Gravity Well', caster: 'Luna', power: 15, cost: 8, weirdness: 7, description: 'Pull enemies together. Hurt them more when they\'re close.' });

    // Kira's spells!
    this.spells.push({ name: 'Starlight', caster: 'Kira', power: 15, cost: 10, weirdness: 6, description: 'Hurt things with light.' });
    this.spells.push({ name: 'Void Walk', caster: 'Kira', power: 0, cost: 15, weirdness: 10, description: 'Teleport through walls. Teleport through time. Teleport through yourself.' });
    this.spells.push({ name: 'Reality Tear', caster: 'Kira', power: 20, cost: 20, weirdness: 15, description: 'Breaks rules for one turn. Everything is possible.' });

    // Chapter spells!
    this.spells.push({ name: 'Dream Eater', power: 30, cost: 20, weirdness: 8, description: 'Make enemies dream. Hurt them while they sleep. Wake them up wrong.' });
    this.spells.push({ name: 'Time Slow', power: 0, cost: 12, weirdness: 9, description: 'Slow everything down. Slow yourself more. Run through slow time.' });
    this.spells.push({ name: 'Gravity Punch', power: 25, cost: 18, weirdness: 6, description: 'Punch them with gravity. Fall on enemies. Fall up.' });
  }
}

export const SPELLS = {
  starfire: { power: 20, cost: 10, weirdness: 5 },
  novaBurst: { power: 25, cost: 15, weirdness: 8 },
  moonbeam: { power: 18, cost: 8, weirdness: 4 },
  gravityWell: { power: 15, cost: 8, weirdness: 7 },
  starlight: { power: 15, cost: 10, weirdness: 6 },
  voidWalk: { power: 0, cost: 15, weirdness: 10 },
  realityTear: { power: 20, cost: 20, weirdness: 15 },
  dreamEater: { power: 30, cost: 20, weirdness: 8 },
  timeSlow: { power: 0, cost: 12, weirdness: 9 },
};