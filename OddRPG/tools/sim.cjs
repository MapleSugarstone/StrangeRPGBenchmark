// Plays the whole campaign headless against the real src/main.js combat code.
// Usage: node tools/sim.cjs [seeds] [--set key=value ...]  (keys are BALANCE fields, or boss stats like b4.bossHp by story order)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const seeds = Number(args.find(a => /^\d+$/.test(a)) || 40);
const overrides = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--set') overrides.push(args[++i]);

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

function makeContext() {
  const noop = () => {};
  const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'measureText' ? () => ({ width: 0 }) : noop)), set: (t, k, v) => { t[k] = v; return true; } });
  const canvas = { getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }), width: 8, height: 8, style: {} };
  const sandbox = {
    document: { getElementById: () => canvas, createElement: () => canvas, addEventListener: noop },
    requestAnimationFrame: noop,
    window: { devicePixelRatio: 1, innerWidth: 444, innerHeight: 444, addEventListener: noop },
    setTimeout: () => 0,
    clearTimeout: noop,
    location: { reload: noop },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Everything below runs inside the game's context so it sees the game's globals.
const driver = `
var SIM = {};
SIM.applyOverrides = function (list) {
  for (const o of list) {
    const [k, v] = o.split('=');
    // b3.bossHp sets the fourth boss in story order.
    const m = k.match(/^b(\\d)\\.(\\w+)$/);
    if (m) [...dungeons, ...act2Dungeons][Number(m[1])][m[2]] = Number(v);
    else if (k === 'bossHpMul') [...dungeons, ...act2Dungeons].forEach(d => { d.bossHp = Math.round(d.bossHp * Number(v)); });
    else if (k === 'bossAtkMul') [...dungeons, ...act2Dungeons].forEach(d => { d.bossAtk = Math.round(d.bossAtk * Number(v)); });
    else BALANCE[k] = Number(v);
  }
};

SIM.healers = function (m) { return m.abilities.filter(a => a.type === 'heal'); };

SIM.pick = function (profile, actor, cs, fight) {
  const living = livingParty();
  const enemies = livingEnemies();
  const frac = m => m.hp / m.maxHp;
  const low = living.filter(m => frac(m) < (profile === 'expert' ? 0.5 : 0.4));
  const fainted = party.filter(m => m.hp <= 0);
  const afford = a => canAfford(actor, a);
  const dmg = actor.abilities.filter(a => a.power > 0 && a.type !== 'heal' && afford(a));

  // The novice fires the biggest hit it can afford at the first enemy and heals only when someone is nearly down.
  if (profile === 'novice') {
    const heal = SIM.healers(actor).find(a => afford(a) && !a.self);
    if (heal && living.some(m => frac(m) < 0.3)) return { kind: 'ability', ability: heal };
    const big = dmg.slice().sort((a, b) => b.power - a.power)[0];
    if (big) return { kind: 'ability', ability: big };
    return { kind: 'attack' };
  }

  // Focus the weakest enemy.
  cs.target = cs.enemies.indexOf(enemies.reduce((a, e) => (e.hp < a.hp ? e : a)));

  if (profile === 'expert' && !SIM.placed[actor.id] && fight.boss) {
    SIM.placed[actor.id] = true;
    if (actor.id === 'myco' && actor.gx !== 0) return { kind: 'move', gx: 0 };
  }

  if (low.length || fainted.length) {
    const heals = SIM.healers(actor).filter(afford);
    const full = heals.find(a => !a.power && !a.self);
    const party = heals.filter(a => !a.self).sort((a, b) => b.power - a.power);
    const self = heals.find(a => a.self);
    if (full && (low.length + fainted.length >= 2)) return { kind: 'ability', ability: full };
    if (party.length) return { kind: 'ability', ability: party[0] };
    if (self && frac(actor) < 0.4) return { kind: 'ability', ability: self };
    if (full) return { kind: 'ability', ability: full };
  }

  if (profile === 'expert' && fight.boss) {
    const boss = enemies[0];
    const guard = actor.abilities.find(a => a.boost === 'guard' && afford(a));
    if (guard && !party.some(m => m.defBuff) && cs.turn >= 1) return { kind: 'ability', ability: guard };
    const bind = dmg.find(a => a.status === 'bind' || a.status === 'stun');
    if (bind && !boss.skip && Math.random() < 0.5) return { kind: 'ability', ability: bind };
    const poison = dmg.find(a => a.status === 'poison');
    if (poison && !boss.poison) return { kind: 'ability', ability: poison };
    const charge = actor.abilities.find(a => a.boost === 'attack' && afford(a));
    if (charge && !actor.overcharge && actor.sp >= charge.cost + 4) return { kind: 'ability', ability: charge };
  }

  if (dmg.length) {
    const best = dmg.slice().sort((a, b) => {
      const va = a.power * (a.area ? enemies.length : 1), vb = b.power * (b.area ? enemies.length : 1);
      return vb - va;
    })[0];
    // Keep a heal in reserve once the fight gets long.
    const reserve = SIM.healers(actor).some(h => !h.self) ? 4 : 0;
    if (actor.sp - best.cost >= reserve || !reserve) return { kind: 'ability', ability: best };
    const cheap = dmg.filter(a => actor.sp - a.cost >= reserve).sort((a, b) => b.power - a.power)[0];
    if (cheap) return { kind: 'ability', ability: cheap };
  }
  return { kind: 'attack' };
};

// Records each basic attack's damage as a share of the target's max HP.
SIM.hits = [];
SIM.attack = function (actor, boss) {
  const t = currentTarget();
  const before = t.hp;
  playerAttack(actor);
  SIM.hits.push({ ch: currentChapter, boss: !!boss, frac: (before - t.hp) / t.maxHp });
};

SIM.fight = function (profile, boss) {
  instantCombat = true;
  if (boss) startDungeonBoss(boss); else startCombat();
  const cs = combatState;
  const maxHp = () => party.reduce((a, m) => a + m.maxHp, 0);
  let lowest = 1;
  const used = new Set();
  let guard = 0;
  while (!cs.gameOver && guard++ < 400) {
    lowest = Math.min(lowest, party.reduce((a, m) => a + m.hp, 0) / maxHp());
    if (cs.turn > 60) break;
    const actor = actorById(cs.currentActor);
    const choice = SIM.pick(profile, actor, cs, { boss: !!boss });
    used.add(choice.kind === 'ability' ? choice.ability.name : choice.kind);
    if (choice.kind === 'ability') {
      if (!playerAbility(actor, choice.ability)) SIM.attack(actor, boss);
    } else if (choice.kind === 'move') {
      cs.action = 'move';
      cs.moveFrom = { gx: actor.gx, gy: actor.gy };
      const step = Math.sign(choice.gx - actor.gx);
      moveStep(actor, step, 0);
      moveStep(actor, step, 0);
      cs.action = 'idle';
      finishAction(0);
    } else SIM.attack(actor, boss);
  }
  lowest = Math.min(lowest, party.reduce((a, m) => a + m.hp, 0) / maxHp());
  return { win: cs.victory, rounds: cs.turn, lowest, variety: used.size, stalled: !cs.gameOver };
};

// Boss rewards are spore items; even the novice uses those, but only the others drink potions.
SIM.useItems = function (profile) {
  for (let i = inventory.length - 1; i >= 0; i--) {
    if (inventory[i].type === 'spore') useItem(i);
  }
  if (profile === 'novice') return;
  const low = party.some(m => m.hp < m.maxHp * 0.5);
  const pot = inventory.findIndex(it => it.type === 'potion');
  if (low && pot >= 0) useItem(pot);
};

SIM.campaign = function (profile) {
  const results = [];
  // Steps walked per chapter divided by the average gap between encounters (about 24 steps).
  const randomFights = { 1: 1, 2: 1, 3: 2, 4: 1, 5: 2, 6: 1, 7: 1, 8: 1 };
  SIM.placed = {};
  visitedDungeons = new Set();
  inventory = [];
  sporeLevel = 1;
  act2Started = false;
  initParty();
  for (let ch = 1; ch <= 8; ch++) {
    currentChapter = ch;
    if (ch === 5) { act2Started = true; initAct2Party(); SIM.placed = {}; }
    if (ch === 2) joinCogsworth();
    // The player rests at a crystal once a chapter.
    party.forEach(m => { m.hp = m.maxHp; });
    sporeLevel++;
    saveCheckpoint();
    const bosses = activeDungeons().filter(d => d.chapter === ch);
    const plan = [];
    for (let i = 0; i < randomFights[ch]; i++) plan.push(null);
    for (const b of bosses) plan.splice(Math.floor(plan.length / bosses.length) * (bosses.indexOf(b) + 1), 0, b);
    for (const boss of plan) {
      let tries = 0, r;
      do {
        const snapshot = JSON.stringify({ party, inventory, sporeLevel });
        r = SIM.fight(profile, boss);
        r.chapter = ch; r.boss = boss ? boss.boss : null; r.tries = tries;
        results.push(r);
        if (!r.win) {
          const s = JSON.parse(snapshot);
          party = s.party; inventory = s.inventory; sporeLevel = s.sporeLevel;
          party.forEach(m => { m.hp = m.maxHp; });
        }
        tries++;
      } while (!r.win && tries < 5);
      if (!r.win) return { results, finished: false, at: ch };
      if (boss) {
        visitedDungeons.add(boss.name);
        addItem(boss.reward, 'spore', 5);
        sporeLevel++;
        party.forEach(growMember);
      } else {
        gold += combatState.rewardGold;
        if (combatState.rewardItem) addItem(combatState.rewardItem, 'potion', 20);
      }
      SIM.useItems(profile);
    }
  }
  return { results, finished: true };
};
`;

const report = [];
const profiles = ['novice', 'competent', 'expert'];
const summary = {};
for (const profile of profiles) {
  const rows = [];
  const hits = [];
  let finished = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const c = makeContext();
    vm.runInContext('Math', c).random = rng(seed * 7919 + profiles.indexOf(profile));
    vm.runInContext(driver, c);
    c.SIM.applyOverrides(overrides);
    const out = c.SIM.campaign(profile);
    if (out.finished) finished++;
    rows.push(...out.results);
    hits.push(...c.SIM.hits);
  }
  summary[profile] = { rows, finished, hits };
}

const pct = (n) => (n * 100).toFixed(0) + '%';
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`Seeds per profile: ${seeds}${overrides.length ? '  overrides: ' + overrides.join(' ') : ''}`);
console.log('Campaign finished: ' + profiles.map(p => `${p} ${summary[p].finished}/${seeds}`).join(', '));
console.log('');
console.log('Regular fights by chapter (first try): win / lowest HP / rounds');
for (let ch = 1; ch <= 8; ch++) {
  const line = profiles.map(p => {
    const rs = summary[p].rows.filter(r => r.chapter === ch && !r.boss && r.tries === 0);
    if (!rs.length) return `${p} -`;
    return `${p} ${pct(avg(rs.map(r => r.win ? 1 : 0)))} ${pct(avg(rs.map(r => r.lowest)))} ${avg(rs.map(r => r.rounds)).toFixed(1)}`;
  });
  console.log(`  ch${ch}: ` + line.join(' | '));
}
console.log('');
console.log('Bosses (first try): win / lowest HP / rounds / distinct actions');
const bossNames = [...new Set(summary.novice.rows.concat(summary.expert.rows).filter(r => r.boss).map(r => r.boss))];
for (const b of bossNames) {
  const line = profiles.map(p => {
    const rs = summary[p].rows.filter(r => r.boss === b && r.tries === 0);
    if (!rs.length) return `${p} -`;
    return `${p} ${pct(avg(rs.map(r => r.win ? 1 : 0)))} ${pct(avg(rs.map(r => r.lowest)))} ${avg(rs.map(r => r.rounds)).toFixed(1)} ${avg(rs.map(r => r.variety)).toFixed(1)}`;
  });
  console.log(`  ${b}: ` + line.join(' | '));
}
console.log('');
console.log('Basic attack damage as a share of the target max HP (all profiles): regular / boss');
const allHits = profiles.flatMap(p => summary[p].hits);
for (let ch = 1; ch <= 8; ch++) {
  const r = allHits.filter(h => h.ch === ch && !h.boss), b = allHits.filter(h => h.ch === ch && h.boss);
  console.log('  ch' + ch + ': ' + (r.length ? pct(avg(r.map(h => h.frac))) : '-') + ' / ' + (b.length ? (avg(b.map(h => h.frac)) * 100).toFixed(1) + '%' : '-'));
}
const stalls = profiles.reduce((a, p) => a + summary[p].rows.filter(r => r.stalled).length, 0);
console.log('');
console.log('Stalemates at the round cap: ' + stalls);
