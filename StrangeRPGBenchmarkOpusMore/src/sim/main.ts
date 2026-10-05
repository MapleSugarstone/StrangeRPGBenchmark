import fs from 'node:fs';
import { hashStr } from '../core/rng';
import { ENEMIES } from '../data/enemies';
import { BattleRec, FUN_FORMULA, funIndex, Summary, summarize, WEIGHTS } from './metrics';
import { ChapterRun, kindsOf, trial, trialSeed, variantsFor, walk } from './run';

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const trials = Number(arg('--trials') ?? (args.includes('--quick') ? 40 : 200));
const only = arg('--chapter') ? Number(arg('--chapter')) : undefined;
const seedArg = arg('--seed') ?? '1';
const seed = /^\d+$/.test(seedArg) ? Number(seedArg) : hashStr(seedArg);

interface BossReport {
  group: string; partyLvl: number; bossLvl: number; mustAnswer: boolean; required: boolean;
  v: Record<string, Summary>; gap: number; dropMech: number; dropTiming: number; dropHp: number;
}
interface ChapterReport {
  n: number; title: string; bosses: BossReport[]; retries: number; stuck: number; fightLen: number; fightHpLost: number;
  minutes: number; novelty: number; noveltyPer10: number; fun: { index: number; parts: Record<string, number> }; problems: string[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f2 = (x: number) => x.toFixed(2);
const pm = (m: { m: number; sd: number }) => `${m.m.toFixed(1)} ± ${m.sd.toFixed(1)}`;
const pc = (x: number) => `${Math.round(x * 100)}%`;
const table = (rows: string[][]) => [rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map((r) => `| ${r.join(' | ')} |`).join('\n');

const POLICY_TEXT = [
  'smart: simulates the next 6 actions for every candidate move and takes the best one. It listens to unknown enemies once, heals allies under 35 percent, answers enemies whose ask it knows, and uses Rewind and Line when they help. It succeeds at timing 80 percent of the time.',
  'casual: attacks the weakest foe 55 percent of the time, uses a random damaging skill 25 percent of the time, heals when an ally is under 30 percent, answers a listened enemy 10 percent of the time, and otherwise acts at random. It succeeds at timing 50 percent of the time.',
  'mash: attacks the weakest foe and uses a healing item when an ally is under 25 percent. It succeeds at timing 30 percent of the time.',
  'random: picks any legal action and never times anything.',
  'attack: always attacks the weakest foe with good timing (80 percent). It exists to detect a dominant strategy.',
  'smart-noMech, casual-noMech, and smart-noTiming: the smart or casual policy without the chapter mechanic, and the smart policy without clean hits and braces.',
];
const METRIC_TEXT = [
  'Win rate: the share of trials the party wins. A fight that reaches 200 actions counts as a loss.',
  'Actions and party turns: actions by both sides, and the part of them taken by the party. Final HP: the party HP fraction at the end.',
  'Lead: the party HP fraction minus the enemy HP fraction after each action. Lead changes: how often the leader flips, divided by actions minus 1.',
  'Drama: in won fights, the mean deficit over the actions where the party trailed. Killer move: the largest swing in the lead from one action.',
  'Comeback: the share of wins where the lead fell below -0.3. Near-miss: the share of wins that ended under 15 percent party HP. Tension: the share of wins that were either.',
  'KOs: party members knocked out per fight. Decisiveness: the share of the fight that remained after the leader stopped changing.',
  'Entropy: the Shannon entropy of the smart action mix divided by the log of the number of action types the party can use (capped at 6). One action type above 60 percent of actions is flagged.',
  'Attack-only gap: the smart win rate minus the attack-only win rate. Mechanic drop: the smart win rate minus the win rate without the chapter mechanic. A mechanic that is a skill, such as Listen, is removed by taking the skill away and clearing what the player has learned about enemies.',
];
const WALK_TEXT = [
  'Joins and the shop run at the start of the chapter, and a second shop pass for unbought items runs before each boss.',
  'Regular fights are shuffled, the rests are spread evenly, and the party rests before each boss.',
  'A lost fight restores the earlier state and retries up to 5 times. After 5 failures the fight is skipped with full rewards and flagged.',
  'Enemies that need a key item find it in the inventory.',
  'Smart reads an enemy ask or weak spot only after it listened to that enemy type, when the enemy is a kept prayer, or when the casual walk listened to that type earlier.',
];

function findProblems(c: ChapterReport): string[] {
  const out: string[] = [];
  for (const b of c.bosses) {
    const t = `chapter ${c.n} boss ${b.group}`;
    const { smart: s, casual: k, mash, random, attack } = b.v;
    if (s.win < 0.7) out.push(`${t}: smart win rate ${f2(s.win)}, too hard for a skilled player.`);
    if (s.win > 0.97) out.push(`${t}: smart win rate ${f2(s.win)}, too easy for a skilled player.`);
    if (k.win < 0.4) out.push(`${t}: casual win rate ${f2(k.win)}, too hard.`);
    if (k.win > 0.8) out.push(`${t}: casual win rate ${f2(k.win)}, too easy.`);
    if (s.win - k.win > 0.35) out.push(`${t}: smart wins ${pc(s.win)} but casual wins ${pc(k.win)}, so the boss rewards skill much more than typical play.`);
    if (mash.win > 0.5) out.push(`${t}: mashing Attack and healing items wins ${pc(mash.win)} of fights, so the boss needs no tactics.`);
    if (random.win > 0.25) out.push(`${t}: random play wins ${pc(random.win)} of fights, too easy a floor.`);
    if (!b.mustAnswer && attack.win > 0.5 && b.gap < 0.1) out.push(`${t}: an attack-only strategy wins ${pc(attack.win)} against ${pc(s.win)} for smart play, so attacking dominates.`);
    if (s.maxShare > 0.6) out.push(`${t}: the smart policy spends ${pc(s.maxShare)} of its actions on ${s.topAction}, so one action dominates.`);
    if (s.entropy < 0.6) out.push(`${t}: smart action entropy is ${f2(s.entropy)}, below the 0.6 target for decision variety.`);
    if (b.dropMech * 100 < 5) out.push(`${t}: removing the chapter mechanic changes the smart or casual win rate by at most ${(b.dropMech * 100).toFixed(1)} points, so the mechanic barely matters.`);
    if (b.dropMech * 100 > 25 && !b.required) out.push(`${t}: removing the chapter mechanic drops the smart or casual win rate by ${(b.dropMech * 100).toFixed(1)} points, so the boss hinges on it.`);
    if (s.actions.m < 20 || s.actions.m > 45) out.push(`${t}: smart fights last ${s.actions.m.toFixed(1)} actions, outside the 20 to 45 range.`);
    if (b.partyLvl < b.bossLvl - 2) out.push(`${t}: the party is level ${b.partyLvl.toFixed(1)} against a level ${b.bossLvl} boss, so it is underleveled.`);
    if (b.partyLvl > b.bossLvl + 3) out.push(`${t}: the party is level ${b.partyLvl.toFixed(1)} against a level ${b.bossLvl} boss, so it is overleveled.`);
  }
  if (c.retries > 2) out.push(`chapter ${c.n}: the casual walk lost ${c.retries} fights and retried them, so regular fights are too hard.`);
  if (c.stuck) out.push(`chapter ${c.n}: the casual walk failed ${c.stuck} fights five times in a row and was granted the rewards anyway.`);
  if (c.fightLen && (c.fightLen < 6 || c.fightLen > 14)) out.push(`chapter ${c.n}: regular fights last ${c.fightLen.toFixed(1)} actions on average, outside the 6 to 14 range.`);
  if (c.fightHpLost > 0.6) out.push(`chapter ${c.n}: regular fights cost the casual party ${pc(c.fightHpLost)} of its HP on average, too punishing.`);
  if (c.fightHpLost < 0.1) out.push(`chapter ${c.n}: regular fights cost the casual party only ${pc(c.fightHpLost)} of its HP on average, too easy.`);
  return out;
}

function runChapter(run: ChapterRun): ChapterReport {
  const { plan } = run;
  const bosses: BossReport[] = run.bosses.map((bs, bi) => {
    const kinds = kindsOf(bs.saved);
    const v: Record<string, Summary> = {};
    for (const vr of variantsFor(plan)) {
      const rs: BattleRec[] = [];
      for (let i = 0; i < trials; i++) {
        const r = trial(bs.saved, bs.enemies, vr, trialSeed(seed, plan.n, bi, vr.pol.name, i));
        rs.push({ win: r.win, trace: r.trace, kos: r.kos, counts: r.counts, rewinds: r.rewinds });
      }
      v[vr.name] = summarize(rs, kinds);
    }
    return {
      group: bs.group, partyLvl: bs.lvl, bossLvl: bs.bossLvl, mustAnswer: bs.enemies.some((id) => ENEMIES[id].mustAnswer), required: plan.newMechanic === 'answer' && bs.enemies.some((id) => ENEMIES[id].mustAnswer), v,
      gap: v.smart.win - v.attack.win, dropMech: Math.max(v.smart.win - v['smart-noMech'].win, v.casual.win - v['casual-noMech'].win), dropTiming: v.smart.win - v['smart-noTiming'].win, dropHp: v.smart.hp.m - v['smart-noMech'].hp.m,
    };
  });
  const fightLen = mean(run.fights.map((r) => r.trace.length));
  const minutes = (plan.dialogueLines * 4 + run.actions * 2.5 + plan.mapTiles * 0.04) / 60;
  const novelty = run.newEnemies + 1 + run.newMembers;
  const noveltyPer10 = novelty / Math.max(0.1, minutes / 10);
  const avg = (f: (b: BossReport) => number) => mean(bosses.map(f));
  const fun = funIndex({
    smartWin: avg((b) => b.v.smart.win), casualWin: avg((b) => b.v.casual.win), tension: avg((b) => b.v.casual.tension),
    leadChanges: avg((b) => b.v.casual.leadChanges.m), entropy: avg((b) => b.v.smart.entropy), maxShare: Math.max(0, ...bosses.map((b) => b.v.smart.maxShare)),
    dropMech: avg((b) => (b.required ? 0.15 : b.dropMech)), fightLen: fightLen || 10, bossLen: avg((b) => b.v.smart.actions.m), noveltyPer10,
  });
  const rep: ChapterReport = {
    n: plan.n, title: plan.title, bosses, retries: run.retries, stuck: run.stuck, fightLen,
    fightHpLost: mean(run.fights.map((r) => 1 - (r.trace[r.trace.length - 1]?.p ?? 1))), minutes, novelty, noveltyPer10, fun, problems: [],
  };
  rep.problems = findProblems(rep);
  return rep;
}

function markdown(chs: ChapterReport[], warnings: string[]): string {
  const L: string[] = [];
  const list = (xs: string[]) => [...xs.map((x) => `- ${x}`), ''];
  L.push('# Please Hold balance report', '',
    `The headless simulator in src/sim produced this report with seed ${seedArg} and ${trials} trials per boss variant. It walks the campaign with a casual player, saves the state in front of each boss, and replays each boss many times with several play styles.`, '',
    '## What the metrics mean', '', 'Each boss is replayed by these policies.', '', ...list(POLICY_TEXT), 'The metrics are defined as follows.', '', ...list(METRIC_TEXT),
    'The campaign walk follows these rules.', '', ...list(WALK_TEXT),
    '## Fun Index formula', '', ...list(FUN_FORMULA), `Weights: ${Object.entries(WEIGHTS).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
  for (const c of chs) {
    L.push(`## Chapter ${c.n}: ${c.title}`, '', `Fun Index ${c.fun.index.toFixed(1)} of 100. Parts: ${Object.entries(c.fun.parts).map(([k, v]) => `${k} ${f2(v)}`).join(', ')}.`, '');
    L.push(table([
      ['Measure', 'Value'],
      ['Estimated play time', `${c.minutes.toFixed(1)} minutes`],
      ['Novelty', `${c.novelty} new things, ${c.noveltyPer10.toFixed(1)} per 10 minutes`],
      ['Casual walk retries', `${c.retries} (${c.stuck} stuck)`],
      ['Regular fight length', `${c.fightLen.toFixed(1)} actions, ${pc(c.fightHpLost)} party HP lost per fight`],
    ]), '');
    for (const b of c.bosses) {
      L.push(`### Boss ${b.group}`, '', `Party level ${b.partyLvl.toFixed(1)} against boss level ${b.bossLvl}. Attack-only gap ${b.mustAnswer ? 'not applicable because the boss must be answered' : f2(b.gap)}. Mechanic drop ${(b.dropMech * 100).toFixed(1)} points, or ${(b.dropHp * 100).toFixed(1)} points of final party HP. Timing drop ${(b.dropTiming * 100).toFixed(1)} points. Smart entropy ${f2(b.v.smart.entropy)}, top action ${b.v.smart.topAction} at ${pc(b.v.smart.maxShare)}. Smart Rewinds per fight ${f2(b.v.smart.rewinds)}.`, '');
      L.push(table([
        ['Variant', 'Win rate', 'Actions', 'Party turns', 'Final HP', 'Lead changes', 'Drama', 'Killer move', 'Comeback', 'Near-miss', 'Tension', 'KOs', 'Decisiveness'],
        ...Object.entries(b.v).map(([k, s]) => [k, f2(s.win), pm(s.actions), pm(s.turns), f2(s.hp.m), f2(s.leadChanges.m), f2(s.drama.m), f2(s.killer.m), pc(s.comeback), pc(s.nearMiss), pc(s.tension), f2(s.kos.m), f2(s.decisive.m)]),
      ]), '');
    }
  }
  L.push('## Flagged problems', '');
  const all = [...warnings, ...chs.flatMap((c) => c.problems)];
  L.push(...(all.length ? all.map((p) => `- ${p}`) : ['- No problems flagged.']), '');
  return L.join('\n');
}

const t0 = Date.now();
const warnings: string[] = [];
const runs = walk(seed, (w) => warnings.push(w));
const chapters = runs.filter((r) => only === undefined || r.plan.n === only).map(runChapter);
const head = ['ch', 'boss', 'smart', 'casual', 'mash', 'random', 'attack', 'dMech', 'dTime', 'lvl', 'retry', 'min', 'fun'];
const rows = chapters.flatMap((c) => c.bosses.map((b) => [String(c.n), b.group, ...['smart', 'casual', 'mash', 'random', 'attack'].map((k) => f2(b.v[k].win)),
  (b.dropMech * 100).toFixed(0), (b.dropTiming * 100).toFixed(0), `${b.partyLvl.toFixed(1)}/${b.bossLvl}`, String(c.retries), c.minutes.toFixed(0), c.fun.index.toFixed(0)]));
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
for (const r of [head, ...rows]) console.log(r.map((x, i) => x.padEnd(widths[i])).join('  '));
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/balance.md', markdown(chapters, warnings));
fs.writeFileSync('reports/metrics.json', JSON.stringify({ seed: seedArg, trials, weights: WEIGHTS, warnings, chapters }, null, 1));
for (const w of warnings) console.log('warning: ' + w);
for (const c of chapters) for (const p of c.problems) console.log('problem: ' + p);
if (!chapters.length) console.log('No chapter matched.');
console.log(`Wrote reports/balance.md and reports/metrics.json in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
