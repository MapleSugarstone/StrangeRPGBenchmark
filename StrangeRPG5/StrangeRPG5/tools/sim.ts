// Headless balance check: plays every chapter with a scripted party and prints win rates.
// Run with: npm run sim -- [thorough|direct]
import { ABILITIES, ENEMY_POOLS, LEVEL_FLOOR, Foe, enemyDamage, heroDamage, makeBoss, makeEncounter } from '../src/rules';
import { PartySystem, PartyMember } from '../src/party';

const RUNS = 400;
const PROFILES: Record<string, number[]> = { thorough: [5, 6, 7, 8, 9, 7], direct: [1, 2, 2, 2, 2, 1] };
const FIGHTS_PER_CHAPTER = PROFILES[process.argv[2] ?? 'thorough'];

function pick(m: PartyMember, boss: boolean, foes: number, turn: number): string {
  const can = (a: string) => m.mp >= ABILITIES[a].cost;
  if (m.name === 'Kira') {
    if (boss && can('Reality Tear')) return 'Reality Tear';
    if (boss && can('Starlight')) return 'Starlight';
    return 'Dream Slash';
  }
  if (m.name === 'Brass') {
    if (boss && turn % 3 === 0 && can('Iron Wall')) return 'Iron Wall';
    if (can('Shield Bash') && (boss || m.mp >= 6)) return 'Shield Bash';
    return 'Attack';
  }
  if (boss && turn % 3 === 0 && can('Gravity Well')) return 'Gravity Well';
  if (boss && can('Moonbeam')) return 'Moonbeam';
  if (can('Nova Burst') && (boss || foes > 1)) return 'Nova Burst';
  return 'Attack';
}

function fight(foes: Foe[]): { won: boolean; rounds: number } {
  let wall = 0, well = 0, counter: PartyMember | null = null, rounds = 0;
  const alive = () => foes.filter(f => f.hp > 0);
  while (rounds < 200) {
    for (const m of PartySystem.members) {
      if (m.hp <= 0) continue;
      const boss = foes[0].boss;
      const a = pick(m, boss, alive().length, rounds);
      const ab = ABILITIES[a];
      m.mp -= ab.cost;
      if (ab.effect === 'wall') wall = 3;
      if (ab.effect === 'well') well = 3;
      if (ab.effect === 'counter') counter = m;
      for (const f of ab.effect === 'all' ? alive() : alive().slice(0, 1)) f.hp -= heroDamage(a, m.attack, f.def, well > 0, Math.random);
      if (!alive().length) return { won: true, rounds: rounds + 1 };
    }
    for (const f of alive()) {
      const living = PartySystem.members.filter(m => m.hp > 0);
      if (!living.length) break;
      const pool = living.flatMap(m => (m.name === 'Brass' ? [m, m] : [m]));
      const target = pool[Math.floor(Math.random() * pool.length)];
      target.hp -= enemyDamage(f.atk, target.defense, wall > 0, Math.random);
      if (counter && counter.hp > 0) {
        f.hp -= heroDamage('Attack', counter.attack, f.def, well > 0, Math.random);
        counter = null;
      }
    }
    if (!alive().length) return { won: true, rounds: rounds + 1 };
    if (wall > 0) wall--;
    if (well > 0) well--;
    rounds++;
    if (PartySystem.members.every(m => m.hp <= 0)) return { won: false, rounds };
  }
  return { won: false, rounds };
}

function recover() {
  for (const m of PartySystem.members) {
    if (m.hp <= 0) m.hp = Math.ceil(m.maxHp * 0.25);
    else m.hp = Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * 0.2));
    m.mp = Math.min(m.maxMp, m.mp + Math.ceil(m.maxMp * 0.25));
  }
}

type Snap = { level: number; xp: number; saved: { name: string; hp: number; mp: number }[] };
const snap = (): Snap => ({ level: PartySystem.level, xp: PartySystem.xp, saved: PartySystem.members.map(m => ({ name: m.name, hp: m.hp, mp: m.mp })) });

const rows = ENEMY_POOLS.map(() => ({ normalLoss: 0, normalRounds: 0, normals: 0, hpCost: 0, bossArrive: 0, bossFull: 0, bossRounds: 0, level: 0, hpLeft: 0 }));
const hpFrac = () => PartySystem.members.reduce((s, m) => s + Math.max(0, m.hp), 0) / PartySystem.members.reduce((s, m) => s + m.maxHp, 0);
for (let run = 0; run < RUNS; run++) {
  PartySystem.reset();
  for (let ch = 0; ch < ENEMY_POOLS.length; ch++) {
    PartySystem.raiseTo(LEVEL_FLOOR[ch]);
    PartySystem.joinUpTo(ch);
    PartySystem.healAll();
    const r = rows[ch];
    for (let f = 0; f < FIGHTS_PER_CHAPTER[ch]; f++) {
      const foes = makeEncounter(ch, PartySystem.members.length, Math.random);
      const before = hpFrac();
      const res = fight(foes);
      r.normals++;
      r.normalRounds += res.rounds;
      r.hpCost += before - hpFrac();
      if (!res.won) { r.normalLoss++; PartySystem.healAll(); continue; }
      if (!PartySystem.gainXp(foes.reduce((s, x) => s + x.xp, 0))) recover();
    }
    r.level += PartySystem.level;
    r.hpLeft += hpFrac();
    const before = snap();
    const arrive = fight([makeBoss(ch, PartySystem.level)]);
    if (arrive.won) r.bossArrive++;
    PartySystem.restore(before.level, before.xp, before.saved);
    PartySystem.healAll();
    const full = fight([makeBoss(ch, PartySystem.level)]);
    if (full.won) r.bossFull++;
    r.bossRounds += full.rounds;
    PartySystem.restore(before.level, before.xp, before.saved);
    PartySystem.gainXp(makeBoss(ch, PartySystem.level).xp);
  }
}

const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`.padStart(5);
console.log('ch  lvl  hp-at-boss  hp-per-fight  normal-loss  normal-rounds  boss-win(arrive)  boss-win(full)  boss-rounds');
rows.forEach((r, i) => {
  console.log(`${i + 1}   ${(r.level / RUNS).toFixed(1).padStart(4)}  ${pct(r.hpLeft, RUNS)}       ${pct(r.hpCost, r.normals)}         ${pct(r.normalLoss, r.normals)}        ${(r.normalRounds / r.normals).toFixed(1).padStart(5)}          ${pct(r.bossArrive, RUNS)}             ${pct(r.bossFull, RUNS)}          ${(r.bossRounds / RUNS).toFixed(1)}`);
});
