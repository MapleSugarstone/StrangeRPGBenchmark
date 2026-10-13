// Enemy AI! Behaviors, aggression, patrol patterns!

export class EnemyManager {
  enemies: { type: string; hp: number; damage: number; speed: number; behavior: string; quote: string }[] = [];

  constructor() {
    // Chapter 1 enemies! The Glitch in Your Room!
    this.enemies.push({ type: 'shadow_wolf', hp: 30, damage: 8, speed: 5, behavior: 'patrol', quote: 'You smell like home.' });
    this.enemies.push({ type: 'void_spider', hp: 25, damage: 12, speed: 3, behavior: 'ambush', quote: 'Tick tick tick.' });
    
    // Chapter 2 enemies! Crystal Forest!
    this.enemies.push({ type: 'crystal_golem', hp: 50, damage: 6, speed: 2, behavior: 'guard', quote: 'The forest remembers you.' });
    
    // Chapter 3 enemies! Mech City!
    this.enemies.push({ type: 'steam_rat', hp: 20, damage: 10, speed: 8, behavior: 'run', quote: 'Tick tock tick tock.' });
    
    // Chapter 4 enemies! Dream Sea!
    this.enemies.push({ type: 'nightmare_fish', hp: 35, damage: 7, speed: 4, behavior: 'sleep', quote: 'Dream me a better dream.' });
    
    // Chapter 5 enemies! Void Between Stars!
    this.enemies.push({ type: 'star_vampire', hp: 40, damage: 15, speed: 6, behavior: 'hunt', quote: 'You taste like home.' });
  }
}
