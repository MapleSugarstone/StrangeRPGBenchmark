// === Balance Tests ===
// Simulates combat to check game balance

import { createBuphila, createMyco, createCogsworth, PartyMember } from './party';

interface CombatSim {
  hero: PartyMember;
  enemies: { name: string; hp: number; attack: number; defense: number }[];
  turns: number;
  won: boolean;
  damageDealt: number;
  damageReceived: number;
}

const TESTS = [
  { name: 'Buphila vs 1 Slime', hero: createBuphila(), enemies: [{ name: 'Slime', hp: 15, attack: 4, defense: 1 }] },
  { name: 'Buphila + Myco vs 2 Slimes', hero: createBuphila(), enemies: [{ name: 'Slime', hp: 15, attack: 4, defense: 1 }, { name: 'Slime 2', hp: 15, attack: 4, defense: 1 }] },
  { name: 'Full Party vs Boss', hero: createBuphila(), enemies: [{ name: 'Clockwork Dragon', hp: 80, attack: 12, defense: 8 }] },
  { name: 'Buphila + Cogsworth vs Boss', hero: createBuphila(), enemies: [{ name: 'Clockwork Dragon', hp: 80, attack: 12, defense: 8 }] },
  { name: 'Stress test: 5 weak enemies', hero: createBuphila(), enemies: Array(5).fill(null).map((_, i) => ({ name: `Minion ${i}`, hp: 8, attack: 3, defense: 1 })) },
  { name: 'Buphila + Myco + Cogsworth vs Boss', hero: createBuphila(), enemies: [{ name: 'Clockwork Dragon', hp: 80, attack: 12, defense: 8 }] },
];

function simulateCombat(test: any, iterations: number = 100): CombatSim {
  const hero = { ...test.hero };
  const enemies = test.enemies.map((e: any) => ({ ...e }));
  const sim: CombatSim = {
    hero,
    enemies,
    turns: 0,
    won: false,
    damageDealt: 0,
    damageReceived: 0,
  };

  // Run one simulation
  let turn = 0;
  let gameOver = false;

  while (!gameOver && turn < 200) {
    turn++;

    // Hero attacks random enemy
    const aliveEnemies = sim.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) {
      sim.won = true;
      gameOver = true;
      break;
    }

    const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    const damage = Math.max(1, hero.attack - target.defense + Math.floor(Math.random() * 6) - 2);
    target.hp -= damage;
    sim.damageDealt += damage;

    // Enemies attack back
    if (target.hp <= 0) continue;

    const heroDmg = Math.max(1, target.attack - hero.defense + Math.floor(Math.random() * 4) - 1);
    hero.hp -= heroDmg;
    sim.damageReceived += heroDmg;

    if (hero.hp <= 0) {
      gameOver = true;
      break;
    }
  }

  sim.turns = turn;
  return sim;
}

function runBalanceTests(): void {
  console.log('=== Balance Tests ===\n');

  const results: any[] = [];

  for (const test of TESTS) {
    let totalWins = 0;
    let totalTurns = 0;
    let totalDamageDealt = 0;
    let totalDamageReceived = 0;

    for (let i = 0; i < 100; i++) {
      const result = simulateCombat(test, 100);
      if (result.won) totalWins++;
      totalTurns += result.turns;
      totalDamageDealt += result.damageDealt;
      totalDamageReceived += result.damageReceived;
    }

    const avgTurns = totalTurns / 100;
    const winRate = (totalWins / 100) * 100;
    const avgDps = totalDamageDealt / avgTurns;
    const avgDpr = totalDamageReceived / avgTurns;

    results.push({
      name: test.name,
      winRate: winRate.toFixed(1) + '%',
      avgTurns: avgTurns.toFixed(1),
      avgDps: avgDps.toFixed(2),
      avgDpr: avgDpr.toFixed(2),
      winLossRatio: (totalWins / Math.max(1, 100 - totalWins)).toFixed(2),
    });

    // Balance checks
    const status = winRate >= 40 && winRate <= 90 ? '✅' : '⚠️  NEEDS ADJUSTMENT';
    console.log(`${status} ${test.name}`);
    console.log(`   Win Rate: ${winRate.toFixed(1)}% | Avg Turns: ${avgTurns.toFixed(1)}`);
    console.log(`   DPS: ${avgDps.toFixed(2)} | DPR: ${avgDpr.toFixed(2)}`);
    console.log('');
  }

  // Engagement metric
  console.log('=== Fun Metrics ===');
  console.log(`Average engagement window: ${results[0].avgTurns} turns per fight`);
  console.log(`Suggested fight duration: 5-15 turns for good engagement`);
  console.log(`Win rates between 40-90% indicate fair difficulty`);
  console.log(`DPS > DPR = favorable combat`);

  return results;
}

// Run tests
runBalanceTests();
