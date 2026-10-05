import fs from 'node:fs';
import { newGame, healAll, GameState } from '../game/state';
import { MAPS, CHAPTERS } from '../maps';
import { World, isMarker } from '../game/world';
import { Bot, BattleRecord } from './bot';
import { simBattle } from './battlesim';
import { GROUPS, ENEMIES } from '../data/enemies';
import { SKILLS } from '../data/skills';
import { MEMBERS } from '../data/members';
import { funScore, entropy, FunInputs, FunScore } from './fun';
import type { Policy } from '../battle/policy';
import { renderReport, ChapterRow, BossRow } from './report';

const args = process.argv.slice(2);
const memStore = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memStore.get(k) ?? null, setItem: (k: string, v: string) => { memStore.set(k, v); }, removeItem: (k: string) => { memStore.delete(k); } } });
const quick = args.includes('--quick');
const SEEDS = quick ? 2 : 6;
const TRIALS = quick ? 60 : 300;

function validateMaps(): string[] {
  const errs: string[] = [];
  const st = newGame();
  for (const def of Object.values(MAPS)) {
    const w = Math.max(...def.rows.map(r => r.length));
    def.rows.forEach((r, i) => { if (r.length !== w) errs.push(`${def.id}: row ${i} has width ${r.length}, expected ${w}`); });
    if (def.past) def.past.forEach((r, i) => { if (r.length !== w) errs.push(`${def.id}: past row ${i} has width ${r.length}`); });
    let world: World;
    try { world = new World(def, st); } catch (e) { errs.push(String(e)); continue; }
    const used = new Set(def.ents.map(e => e.at));
    for (const d of Object.values(MAPS)) for (const e of d.ents) if (e.to?.[0] === def.id) used.add(e.to[1]);
    for (const c of CHAPTERS) if (c.startMap === def.id) used.add(c.startMarker);
    for (const m of world.markers.keys()) if (!used.has(m)) errs.push(`${def.id}: marker '${m}' has no entity`);
    for (const e of def.ents) {
      if (e.to) {
        const t = MAPS[e.to[0]];
        if (!t) errs.push(`${def.id}.${e.id}: warp to unknown map ${e.to[0]}`);
        else if (!t.rows.some(r => r.includes(e.to![1]))) errs.push(`${def.id}.${e.id}: warp marker '${e.to[1]}' missing in ${e.to[0]}`);
      }
    }
    for (const [g] of def.enc?.groups ?? []) if (!GROUPS[g]) errs.push(`${def.id}: unknown encounter group ${g}`);
    for (const r of def.rows) for (const c of r) if (!isMarker(c) && !(def.legend?.[c]) && !'.,;":TYA%#BR^WD~=  *_-+|P&SGMQOH$@!K/X'.includes(c)) errs.push(`${def.id}: unknown tile '${c}'`);
  }
  for (const g of Object.values(GROUPS)) for (const e of g.enemies) if (!ENEMIES[e]) errs.push(`group uses unknown enemy ${e}`);
  for (const e of Object.values(ENEMIES)) for (const [s] of e.skills) if (!SKILLS[s]) errs.push(`${e.id} uses unknown skill ${s}`);
  for (const m of Object.values(MEMBERS)) for (const [, s] of m.learn) if (!SKILLS[s]) errs.push(`${m.id} learns unknown skill ${s}`);
  return [...new Set(errs)];
}

async function playthrough(seed: number): Promise<Bot> {
  const st = newGame();
  const bot = new Bot(st, seed);
  const ch1 = CHAPTERS[0];
  if (ch1.intro) await ch1.intro(bot);
  for (let n = 1; n <= CHAPTERS.length; n++) {
    if (!CHAPTERS[n - 1].ready || bot.st.chapter !== n) break;
    bot.log.snapshots['@start'] = JSON.stringify(bot.st);
    await bot.playChapter(n);
    if (bot.st.chapter === n) break;
  }
  return bot;
}

interface Agg { n: number; sum: number; min: number; max: number }
const agg = (): Agg => ({ n: 0, sum: 0, min: Infinity, max: -Infinity });
const add = (a: Agg, v: number) => { a.n++; a.sum += v; a.min = Math.min(a.min, v); a.max = Math.max(a.max, v); };
const mean = (a: Agg) => (a.n ? a.sum / a.n : NaN);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

function monteCarlo(st: GameState, group: string, policy: Policy, n: number, survive?: number) {
  const res = { win: 0, turns: [] as number[], minFrac: [] as number[], hpLost: [] as number[], actions: [] as string[], clashes: 0, damaging: 0, breaks: 0 };
  for (let i = 0; i < n; i++) {
    const copy: GameState = JSON.parse(JSON.stringify(st));
    const o = simBattle(copy, group, policy, 1000 + i * 7919, { survive });
    if (o.result === 'win') { res.win++; res.minFrac.push(o.minFrac); }
    res.turns.push(o.partyTurns);
    res.hpLost.push(o.hpLost);
    res.actions.push(...o.actions);
    res.clashes += o.clashes;
    res.damaging += o.damaging;
    res.breaks += o.breaks;
  }
  return { winRate: res.win / n, turns: avg(res.turns), minFrac: median(res.minFrac), hpLost: avg(res.hpLost), actions: res.actions, clashRate: res.damaging ? res.clashes / res.damaging : 0, breaks: res.breaks / n };
}

function chapterEnemies(ch: number, records: BattleRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const r of records) if (r.ch === ch) for (const e of GROUPS[r.group]?.enemies ?? []) ids.add(e);
  return ids;
}

/** Grid-searches HP and damage scales for each boss so the smart player lands in the target bands. */
function tune(bots: Bot[]) {
  for (const [ch, log] of Object.entries(bots[0].chapters)) {
    for (const [g, snap] of Object.entries(log.snapshots)) {
      if (g.startsWith('@') || GROUPS[g]?.flee !== false || g === 'ordeal') continue;
      const boss = GROUPS[g].enemies.map(id => ENEMIES[id]).find(e => e.boss) ?? ENEMIES[GROUPS[g].enemies[0]];
      const base = { hp: boss.hp, str: boss.str, mnd: boss.mnd };
      let best = { loss: Infinity, hp: 1, atk: 1, win: 0, turns: 0, minFrac: 0, casual: 0 };
      for (const hp of [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5]) {
        for (const atk of [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4]) {
          boss.hp = Math.round(base.hp * hp); boss.str = Math.round(base.str * atk); boss.mnd = Math.round(base.mnd * atk);
          const r = monteCarlo(JSON.parse(snap), g, 'smart', 60);
          const cz = monteCarlo(JSON.parse(snap), g, 'casual', 60);
          const loss = ((r.winRate - 0.9) / 0.07) ** 2 + ((cz.winRate - 0.55) / 0.12) ** 2 + ((r.minFrac - 0.24) / 0.12) ** 2 + ((r.turns - 16) / 6) ** 2;
          if (loss < best.loss) best = { loss, hp, atk, win: r.winRate, turns: r.turns, minFrac: r.minFrac, casual: cz.winRate };
        }
      }
      Object.assign(boss, base);
      console.log(`ch${ch} ${g} (${boss.id}): hp x${best.hp}, attack x${best.atk} -> win ${(best.win * 100).toFixed(0)}%, casual ${(best.casual * 100).toFixed(0)}%, turns ${best.turns.toFixed(1)}, lowest HP ${(best.minFrac * 100).toFixed(0)}%`);
    }
  }
}

async function main() {
  const pi = args.indexOf('--print');
  if (pi >= 0) {
    const def = MAPS[args[pi + 1]];
    def.rows.forEach((r, y) => console.log(String(y).padStart(2) + ' ' + r));
    return;
  }
  if (args.includes('--tune')) {
    const bots = [await playthrough(101)];
    tune(bots);
    return;
  }
  const t0 = Date.now();
  const lines: string[] = [];
  const out: Record<string, unknown> = {};
  const errs = validateMaps();
  lines.push('# Duotone balance and fun report', '');
  lines.push(`Generated by \`npm run sim\`. Seeds: ${SEEDS}. Monte Carlo trials per test: ${TRIALS}.`, '');
  lines.push('## Content checks', '');
  lines.push(errs.length ? errs.map(e => `- ${e}`).join('\n') : 'All maps, warps, encounter groups, enemies, and skills resolve.', '');
  out.errors = errs;

  const bots: Bot[] = [];
  for (let s = 0; s < SEEDS; s++) bots.push(await playthrough(101 + s * 17));

  const chapters = [...new Set(bots.flatMap(b => Object.keys(b.chapters).map(Number)))].sort((a, b) => a - b);
  const seenEnemies = new Set<string>();
  const chapterOut: Record<number, unknown> = {};
  lines.push('## Playthrough bot', '');
  lines.push('The bot plays each chapter along its story route. It opens every reachable chest, lights every lamp, fights every random encounter it walks into with the smart policy, heals between fights, and shops for the best weapon it can afford. A loss restores the pre-battle state, as the game over screen does, and after two losses the bot grinds until it gains a level.', '');
  lines.push('| Ch | Levels (start, boss, end) | Battles | Losses | Grind fights | Steps | Dialogue words | Gold earned | Est. minutes | Route errors |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  const funRows: string[] = [];
  const reportRows: ChapterRow[] = [];
  const allScores: Record<number, FunScore & { inputs: FunInputs }> = {};
  for (const ch of chapters) {
    const logs = bots.map(b => b.chapters[ch]).filter(Boolean);
    const recs = bots.flatMap(b => b.battles.filter(r => r.ch === ch));
    const a = { start: agg(), boss: agg(), end: agg(), battles: agg(), losses: agg(), grind: agg(), steps: agg(), words: agg(), gold: agg(), minutes: agg() };
    for (const l of logs) {
      add(a.start, l.startLvl); add(a.boss, l.bossLvl); add(a.end, l.endLvl); add(a.battles, l.battles); add(a.losses, l.losses);
      add(a.grind, l.grind); add(a.steps, l.steps); add(a.words, l.words); add(a.gold, l.goldEarned);
    }
    for (const b of bots) {
      const l = b.chapters[ch];
      if (!l) continue;
      const rs = b.battles.filter(r => r.ch === ch);
      const battleSec = rs.reduce((s, r) => s + r.partyTurns * 4 + r.partyTurns * 1.6 + 8, 0);
      const minutes = (l.steps * 9 / 60 + battleSec + l.words / 3.2 + l.choices * 3 + l.shopVisits * 40) / 60;
      add(a.minutes, minutes);
    }
    const errors = [...new Set(logs.flatMap(l => l.errors))];
    lines.push(`| ${ch} | ${mean(a.start).toFixed(1)}, ${mean(a.boss).toFixed(1)}, ${mean(a.end).toFixed(1)} | ${mean(a.battles).toFixed(1)} | ${mean(a.losses).toFixed(1)} | ${mean(a.grind).toFixed(1)} | ${mean(a.steps).toFixed(0)} | ${mean(a.words).toFixed(0)} | ${mean(a.gold).toFixed(0)} | ${mean(a.minutes).toFixed(1)} | ${errors.length ? errors.join('; ') : 'none'} |`);

    // Boss and trash Monte Carlo from the first bot's snapshots.
    const snaps = bots[0].chapters[ch]?.snapshots ?? {};
    const bossGroups = Object.keys(snaps).filter(g => !g.startsWith('@') && GROUPS[g]?.flee === false);
    const bossRows: string[] = [];
    const bossData: BossRow[] = [];
    let enemyBossLvl = 0;
    let mainBoss: ReturnType<typeof monteCarlo> | null = null;
    let mainMash: ReturnType<typeof monteCarlo> | null = null;
    let mainRand: ReturnType<typeof monteCarlo> | null = null;
    let mainCasual: ReturnType<typeof monteCarlo> | null = null;
    for (const g of bossGroups) {
      const st: GameState = JSON.parse(snaps[g]);
      const sv = g === 'ordeal' ? 5 : undefined;
      const smart = monteCarlo(st, g, 'smart', TRIALS, sv);
      const mash = monteCarlo(st, g, 'mash', TRIALS, sv);
      const rand = monteCarlo(st, g, 'random', Math.round(TRIALS / 2), sv);
      const casual = monteCarlo(st, g, 'casual', Math.round(TRIALS / 2), sv);
      const lvl = Math.round(st.party.reduce((s, id) => s + st.members[id].lvl, 0) / st.party.length);
      const hpStart = st.party.reduce((s, id) => s + st.members[id].hp, 0);
      bossRows.push(`| ${g} | ${lvl} | ${hpStart} | ${(smart.winRate * 100).toFixed(0)}% | ${(casual.winRate * 100).toFixed(0)}% | ${(mash.winRate * 100).toFixed(0)}% | ${(rand.winRate * 100).toFixed(0)}% | ${smart.turns.toFixed(1)} | ${(smart.minFrac * 100).toFixed(0)}% | ${(smart.clashRate * 100).toFixed(0)}% | ${smart.breaks.toFixed(1)} |`);
      const bossDef = GROUPS[g].enemies.map(id => ENEMIES[id]).find(e => e.boss) ?? ENEMIES[GROUPS[g].enemies[0]];
      if (g !== 'ordeal') bossData.push({ group: g, name: bossDef.name, lvl, smart: smart.winRate, casual: casual.winRate, mash: mash.winRate, random: rand.winRate, turns: smart.turns, minFrac: smart.minFrac });
      if (!mainBoss || g.startsWith('boss') || g.startsWith('final')) { mainBoss = smart; mainMash = mash; mainRand = rand; mainCasual = casual; enemyBossLvl = bossDef.lvl; }
    }
    const mid: GameState | null = snaps['@start'] ? JSON.parse(snaps['@start']) : null;
    const encGroups = new Set<string>();
    for (const r of recs) if (!r.scripted) encGroups.add(r.group);
    const trash: { g: string; smart: ReturnType<typeof monteCarlo>; mash: ReturnType<typeof monteCarlo> }[] = [];
    const trashState = bossGroups.length ? JSON.parse(snaps[bossGroups[0]]) as GameState : mid;
    if (trashState) {
      healAll(trashState);
      const midLvlState: GameState = JSON.parse(JSON.stringify(trashState));
      for (const g of encGroups) trash.push({ g, smart: monteCarlo(midLvlState, g, 'smart', Math.round(TRIALS / 3)), mash: monteCarlo(midLvlState, g, 'mash', Math.round(TRIALS / 3)) });
    }
    const trashRows = trash.map(t => `| ${t.g} | ${(t.smart.winRate * 100).toFixed(0)}% | ${(t.mash.winRate * 100).toFixed(0)}% | ${t.smart.turns.toFixed(1)} | ${(t.smart.hpLost * 100).toFixed(0)}% | ${(t.mash.hpLost * 100).toFixed(0)}% |`);

    const smartActions = recs.flatMap(r => r.actions.map(x => x.split(':').slice(0, 2).join(':')));
    const ent = entropy(smartActions);
    const enemies = chapterEnemies(ch, recs);
    const newEnemies = [...enemies].filter(e => !seenEnemies.has(e));
    for (const e of enemies) seenEnemies.add(e);
    const b0 = bots[0];
    const startSt: GameState | null = snaps['@start'] ? JSON.parse(snaps['@start']) : null;
    const nextStart = b0.chapters[ch + 1]?.snapshots['@start'];
    const endSt: GameState = nextStart ? JSON.parse(nextStart) : b0.st;
    const members0 = new Set([...(startSt?.party ?? []), ...(startSt?.reserve ?? [])]);
    const newMembers = [...endSt.party, ...endSt.reserve].filter(m => !members0.has(m));
    const newMech = endSt.mech.filter(m => !(startSt?.mech ?? []).includes(m));
    const lv0 = startSt ? startSt.members.wick?.lvl ?? 1 : 1;
    const lv1 = endSt.members.wick?.lvl ?? lv0;
    const newSkills = [...endSt.party, ...endSt.reserve].flatMap(id => MEMBERS[id].learn.filter(([l]) => (members0.has(id) ? l > lv0 && l <= lv1 : l <= lv1)).map(([, s]) => s));
    const novelty = newEnemies.length * 0.5 + newMembers.length * 2 + newMech.length * 2 + newSkills.length * 0.5;
    const trashTurns = avg(trash.map(t => t.smart.turns));
    const inputs: FunInputs = {
      bossWinSmart: mainBoss?.winRate ?? NaN, bossWinMash: mainMash?.winRate ?? NaN, bossWinRandom: mainRand?.winRate ?? NaN, bossWinCasual: mainCasual?.winRate ?? NaN,
      bossTurns: mainBoss?.turns ?? NaN, bossMinFrac: mainBoss?.minFrac ?? NaN,
      trashTurns, trashDrainSmart: avg(trash.map(t => t.smart.hpLost)), trashDrainMash: avg(trash.map(t => t.mash.hpLost)),
      entropyNorm: ent.norm, topShare: ent.topShare, losses: mean(a.losses), grind: mean(a.grind), novelty,
      clashRate: recs.reduce((s, r) => s + r.clashes, 0) / Math.max(1, recs.reduce((s, r) => s + r.damaging, 0)),
      minutes: mean(a.minutes),
    };
    const score = funScore(inputs, ch);
    allScores[ch] = { ...score, inputs };
    funRows.push(`| ${ch} | **${score.total}** | ${Object.entries(score.parts).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}`).join(', ')} |`);
    const lost = recs.filter(r => r.result !== 'win').map(r => `${r.group} at level ${r.lvl}`);
    reportRows.push({ ch, title: CHAPTERS[ch - 1].title, fun: score.total, parts: score.parts, start: mean(a.start), boss: mean(a.boss), end: mean(a.end), enemyBossLvl, battles: mean(a.battles), losses: mean(a.losses), minutes: mean(a.minutes), words: mean(a.words), errors, bosses: bossData });
    chapterOut[ch] = {
      lost, bossRows, trashRows, entropy: ent, newEnemies, newMembers, newMech, newSkills, inputs, score, errors,
    };
  }

  lines.push('');
  for (const ch of chapters) {
    const c = chapterOut[ch] as { lost: string[]; bossRows: string[]; trashRows: string[]; entropy: ReturnType<typeof entropy>; newEnemies: string[]; newMembers: string[]; newMech: string[]; newSkills: string[]; inputs: FunInputs };
    lines.push(`## Chapter ${ch}: ${CHAPTERS[ch - 1].title}`, '');
    lines.push('### Scripted and boss battles', '');
    lines.push('Party state is the bot\'s state right before the fight. Win rates compare four players: smart (a heuristic that reads hues, heals, guards against telegraphs, and spends ink carefully), casual (plays smart two thirds of the time and picks a random legal action otherwise), mash (attacks the weakest foe every turn), and random (a random legal action).', '');
    lines.push('| Group | Level | Party HP | Smart win | Casual win | Mash win | Random win | Smart turns | Median lowest HP | Clash rate | Breaks per fight |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
    lines.push(...(c.bossRows.length ? c.bossRows : ['| none | | | | | | | | | | |']), '');
    lines.push('### Random encounters at boss level, full health', '');
    lines.push('| Group | Smart win | Mash win | Smart turns | Smart HP lost | Mash HP lost |');
    lines.push('|---|---|---|---|---|---|');
    lines.push(...(c.trashRows.length ? c.trashRows : ['| none | | | | | |']), '');
    lines.push('### Variety and novelty', '');
    lines.push(`Action entropy across the bot's battles: ${c.entropy.h.toFixed(2)} bits over ${c.entropy.distinct} distinct actions (normalized ${c.entropy.norm.toFixed(2)}). Most used: \`${c.entropy.top}\` at ${(c.entropy.topShare * 100).toFixed(0)}%.`, '');
    if (c.lost.length) lines.push(`Losses: ${c.lost.join(', ')}.`, '');
    lines.push(`New enemies: ${c.newEnemies.map(e => ENEMIES[e]?.name ?? e).join(', ') || 'none'}. New party members: ${c.newMembers.map(m => MEMBERS[m].name).join(', ') || 'none'}. New mechanics: ${c.newMech.join(', ') || 'none'}. New skills: ${c.newSkills.map(s => SKILLS[s]?.name ?? s).join(', ') || 'none'}.`, '');
  }

  lines.push('## Fun index', '');
  lines.push('Each part scores 0 to 100 against a target band. Challenge wants the smart player to beat the boss 60 to 92 percent of the time. Agency wants the smart player to beat the masher by at least 25 points. Access wants the casual player to win 45 to 95 percent of the time. Tension wants the smart player\'s lowest party HP to land between 8 and 40 percent. Pacing wants 9 to 26 party turns per boss and 2.5 to 7 per random fight. Attrition wants a random fight to cost 8 to 30 percent of party HP. Skill-matters wants mashing to cost at least 3 points more HP than playing well. Variety wants a normalized action entropy of 0.6 or more with no action above 45 percent. No-grind wants zero losses and zero grinding. Novelty wants at least four points of new content, where a new member or mechanic counts 2 and a new enemy or skill counts 0.5. Hue-use wants 30 to 90 percent of damaging actions to hit a weakness from chapter 2 on. Length wants 12 to 45 minutes per chapter.', '');
  lines.push('| Ch | Fun | Parts |');
  lines.push('|---|---|---|');
  lines.push(...funRows, '');
  lines.push(`Run time: ${((Date.now() - t0) / 1000).toFixed(1)} s.`);

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/balance.md', lines.join('\n'));
  out.chapters = chapterOut;
  out.scores = allScores;
  fs.writeFileSync('reports/metrics.json', JSON.stringify(out, null, 1));
  fs.writeFileSync('reports/report.html', renderReport({ generated: new Date().toISOString().slice(0, 16).replace('T', ' '), seeds: SEEDS, trials: TRIALS, chapters: reportRows, checks: errs }));
  console.log(lines.join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });
