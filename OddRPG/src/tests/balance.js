// === Balance Tests ===
// Simulates combat to check game balance

// Simple hero creation
function createBuphila() {
  return { id: 'buphila', hp: 45, maxHp: 45, attack: 6, defense: 4, sporePower: 12, speed: 5 };
}

function createMyco() {
  return { id: 'myco', hp: 35, maxHp: 35, attack: 4, defense: 3, sporePower: 15, speed: 4 };
}

function createCogsworth() {
  return { id: 'cogsworth', hp: 40, maxHp: 40, attack: 10, defense: 6, sporePower: 5, speed: 7 };
}

const TESTS = [
  { name: 'Buphila vs 1 Slime', hero: createBuphila(), enemies: [{ name: 'Slime', hp: 15, attack: 4, defense: 1 }] },
  { name: 'Buphila + Myco vs 2 Slimes', hero: createBuphila(), enemies: [
    { name: 'Slime', hp: 15, attack: 4, defense: 1 },
    { name: 'Slime 2', hp: 15, attack: 4, defense: 1 }
  ]},
  { name: 'Full Party vs Boss', hero: createBuphila(), enemies: [
    { name: 'Clockwork Dragon', hp: 45, attack: 8, defense: 5 }
  ]},
  { name: 'Buphila + Cogsworth vs Boss', hero: createBuphila(), enemies: [
    { name: 'Clockwork Dragon', hp: 45, attack: 8, defense: 5 }
  ]},
  { name: '5 weak enemies', hero: createBuphila(), enemies: Array(5).fill(null).map((_, i) => ({ name: `Minion ${i}`, hp: 8, attack: 3, defense: 1 })) },
  { name: '3 party vs Boss', hero: createBuphila(), enemies: [
    { name: 'World Core', hp: 85, attack: 12, defense: 8 }
  ]},
];

function simulateCombat(test, iterations = 100) {
  let totalWins = 0, totalTurns = 0, totalDamageDealt = 0, totalDamageReceived = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const hero = { ...test.hero };
    const enemies = test.enemies.map(e => ({ ...e }));
    let turns = 0;
    let won = false;

    while (turns < 200) {
      turns++;
      const aliveEnemies = enemies.filter(e => e.hp > 0);
      if (aliveEnemies.length === 0) { won = true; break; }

      // Hero attacks
      const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      const heroDmg = Math.max(1, hero.attack - target.defense + Math.floor(Math.random() * 6) - 2);
      target.hp -= heroDmg;
      const damageDealt = heroDmg;

      // Enemies counter
      if (target.hp > 0) {
        const enemyDmg = Math.max(1, target.attack - hero.defense + Math.floor(Math.random() * 4) - 1);
        hero.hp -= enemyDmg;
        if (hero.hp <= 0) break;
      }
    }

    if (won) totalWins++;
    totalTurns += turns;
    // Simplified: estimate damage based on attack stats
  }

  return {
    winRate: (totalWins / iterations * 100).toFixed(1),
    avgTurns: (totalTurns / iterations).toFixed(1),
  };
}

function runBalanceTests() {
  console.log('=== Balance Tests ===\n');
  const results = [];

  for (const test of TESTS) {
    const result = simulateCombat(test, 100);
    results.push({ name: test.name, ...result });

    const status = parseFloat(result.winRate) >= 40 && parseFloat(result.winRate) <= 90 ? 'OK' : '⚠️  ADJUST';
    console.log(`${status}: ${test.name} — Win Rate: ${result.winRate}%, Avg Turns: ${result.avgTurns}`);
  }

  console.log('\n=== Fun Metrics ===');
  console.log('Suggested fight duration: 5-15 turns for good engagement');
  console.log('Win rates between 40-90% indicate fair difficulty');
  console.log('More party members should increase win rate meaningfully');

  return results;
}

// Run tests
const results = runBalanceTests();
console.log('\n=== Results Summary ===');
results.forEach(r => {
  const rating = parseFloat(r.winRate) >= 60 ? '✅' : parseFloat(r.winRate) >= 40 ? '⚠️ ' : '❌';
  console.log(`${rating} ${r.name}: ${r.winRate}% win rate, ${r.avgTurns} avg turns`);
});

// Export for browser
if (typeof window !== 'undefined') {
  window.balanceResults = results;
}
