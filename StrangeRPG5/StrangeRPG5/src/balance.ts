// Balance testing systems! Measuring fun and game balance!

import { ParticleEffects } from './particles';

export class BalanceTester {
  private stats: { [key: string]: number } = {};
  private playerStats: { hp: number; damage: number; speed: number; spells: number; } = {
    hp: 100,
    damage: 15,
    speed: 10,
    spells: 8,
  };

  constructor(private particleEffects: ParticleEffects) {}

  simulateCombat(enemyHP: number, enemyDamage: number, enemySpeed: number) {
    const rounds = this.runSimulation(enemyHP, enemyDamage, enemySpeed);
    const funScore = this.calculateFunScore(rounds);
    return { rounds, funScore };
  }

  private runSimulation(enemyHP: number, enemyDamage: number, enemySpeed: number): number {
    let rounds = 0;
    let playerHP = this.playerStats.hp;
    let enemyHealth = enemyHP;

    while (playerHP > 0 && enemyHealth > 0) {
      rounds++;
      if (this.playerStats.speed > enemySpeed) {
        enemyHealth -= this.playerStats.damage;
      }
      if (enemyHealth > 0) {
        playerHP -= enemyDamage;
      }
    }

    return rounds;
  }

  private calculateFunScore(rounds: number): number {
    const idealRounds = 8;
    const deviation = Math.abs(rounds - idealRounds);
    return Math.max(0, 100 - deviation * 5);
  }

  logStats(key: string, value: number) {
    this.stats[key] = value;
  }

  getStats() {
    return { ...this.stats };
  }
}
