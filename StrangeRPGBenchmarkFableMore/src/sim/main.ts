import { writeFileSync, mkdirSync } from "node:fs";
import { GROUPS, groupsForChapter, ENEMIES } from "../game/data/enemies";
import { heuristicPolicy, randomPolicy, attackOnlyPolicy, type Policy } from "../game/battle/ai";
import { runBattle, makeBattle, chapterLevel, entropy, formationFor, partyFor } from "./runner";
import { createBattle, untieAll } from "../game/battle/core";
import { xpForLevel, MEMBERS } from "../game/data/members";
import { Rng } from "../engine/rng";

const quick = process.argv.includes("--quick");
const onlyChapter = (() => { const i = process.argv.indexOf("--chapter"); return i >= 0 ? Number(process.argv[i + 1]) : 0; })();
const TRIALS = quick ? 12 : 60;
const BOSS_TRIALS = quick ? 16 : 80;
const RUNS = quick ? 6 : 30;

interface PolicyStats {
  win: number;
  turnsPerMember: number;
  closeCall: number;
  leadChanges: number;
  entropy: number;
  distinct: number;
  mechShare: number;
  unwantedLifts: number;
  taken: number;
  endHp: number;
  draws: number;
}

function evalGroup(chapter: number, groupId: string, level: number, policy: Policy, trials: number, seedBase: number, items?: Record<string, number>): PolicyStats {
  const group = GROUPS.find((g) => g.id === groupId)!;
  let wins = 0, turns = 0, close = 0, lead = 0, mech = 0, basic = 0, lifts = 0, taken = 0, endHp = 0, draws = 0;
  const keys: string[] = [];
  const distinctSets = new Set<string>();
  for (let i = 0; i < trials; i++) {
    const s = makeBattle(chapter, group, level, seedBase + i * 7919, { items: items ? { ...items } : undefined });
    const r = runBattle(s, policy);
    if (r.outcome === "win") wins++;
    if (r.outcome === "draw") draws++;
    turns += r.partyTurns / Math.max(1, s.combatants.filter((c) => c.side === "party").length);
    if (r.closeCall) close++;
    lead += r.leadChanges;
    mech += r.mechanicActions;
    basic += r.basicActions;
    lifts += r.unwantedLifts;
    taken += r.taken;
    endHp += r.endHpPct;
    keys.push(...r.actionKeys);
    r.actionKeys.forEach((k) => distinctSets.add(k));
  }
  return {
    win: wins / trials,
    turnsPerMember: turns / trials,
    closeCall: close / Math.max(1, wins),
    leadChanges: lead / trials,
    entropy: entropy(keys),
    distinct: distinctSets.size,
    mechShare: mech / Math.max(1, mech + basic),
    unwantedLifts: lifts / trials,
    taken: taken / trials,
    endHp: endHp / trials,
    draws,
  };
}

/** Map a value onto a target band: 1 inside, falling off linearly outside. */
function band(v: number, lo: number, hi: number, falloff: number): number {
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  return Math.max(0, 1 - d / falloff);
}

function funScore(h: PolicyStats, r: PolicyStats, a: PolicyStats, boss: boolean): { score: number; parts: Record<string, number> } {
  const gap = h.win - Math.max(r.win, a.win);
  const parts: Record<string, number> = {
    heuristicWin: band(h.win, boss ? 0.6 : 0.85, boss ? 0.95 : 1.0, 0.4),
    decisionGap: band(gap, boss ? 0.25 : 0.1, 1, 0.3),
    pacing: band(h.turnsPerMember, boss ? 5 : 2, boss ? 14 : 6, boss ? 8 : 4),
    closeCalls: band(h.closeCall, boss ? 0.4 : 0.1, boss ? 0.95 : 0.6, 0.5),
    drama: band(h.leadChanges, boss ? 1 : 0.2, 10, 3),
    variety: band(h.entropy, 1.6, 4, 1.2),
    mechanics: band(h.mechShare, 0.35, 0.85, 0.35),
    noWaste: band(h.unwantedLifts, 0, 0.3, 1),
  };
  const weights: Record<string, number> = { heuristicWin: 2.0, decisionGap: 2.2, pacing: 1.2, closeCalls: 1.0, drama: 0.8, variety: 1.0, mechanics: 1.0, noWaste: 0.5 };
  let sum = 0, wsum = 0;
  for (const k of Object.keys(parts)) { sum += parts[k] * weights[k]; wsum += weights[k]; }
  return { score: Math.round((sum / wsum) * 100), parts };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const f1 = (v: number) => v.toFixed(1);

const lines: string[] = [];
const json: Record<string, unknown> = { generated: new Date().toISOString(), chapters: [] as unknown[] };
lines.push("# Balance report", "", `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}. ${quick ? "Quick run." : "Full run."} ${TRIALS} trials per group and policy, ${BOSS_TRIALS} per boss, ${RUNS} chapter runs.`, "");
lines.push("Policies: H is the heuristic player, R picks a legal action at random, A only uses the basic attack. The decision gap is H minus the better of R and A. Fun is a weighted sum of target bands: heuristic win rate, decision gap, pacing in party turns per member, close calls, lead changes, action entropy, share of non basic actions, and unwanted Lifts.", "");

const chapters = onlyChapter ? [onlyChapter] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
let totalFun = 0, funCount = 0;
const flags: string[] = [];

for (const ch of chapters) {
  const level = chapterLevel(ch);
  const items = { flatbread: 3, leaddrop: 1, underbread: ch >= 3 ? 2 : 0 };
  lines.push(`## Chapter ${ch} (party level ${level}, ${formationFor(ch).map((id) => MEMBERS[id].name).join(", ")})`, "");
  lines.push("| Group | H win | R win | A win | Gap | Turns/member | Close | Lead chg | Entropy | Distinct | Mech share | Lifts | Fun |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const chJson: Record<string, unknown> = { chapter: ch, level, groups: [] as unknown[] };
  for (const g of groupsForChapter(ch, false)) {
    const h = evalGroup(ch, g.id, level + 1, heuristicPolicy, TRIALS, 11, items);
    const r = evalGroup(ch, g.id, level + 1, randomPolicy, TRIALS, 23, items);
    const a = evalGroup(ch, g.id, level + 1, attackOnlyPolicy, TRIALS, 37, items);
    const fun = funScore(h, r, a, false);
    totalFun += fun.score; funCount++;
    const gap = h.win - Math.max(r.win, a.win);
    lines.push(`| ${g.id} | ${pct(h.win)} | ${pct(r.win)} | ${pct(a.win)} | ${pct(gap)} | ${f1(h.turnsPerMember)} | ${pct(h.closeCall)} | ${f1(h.leadChanges)} | ${h.entropy.toFixed(2)} | ${h.distinct} | ${pct(h.mechShare)} | ${h.unwantedLifts.toFixed(2)} | ${fun.score} |`);
    (chJson.groups as unknown[]).push({ id: g.id, h, r, a, fun });
    if (h.win < 0.75) flags.push(`Chapter ${ch} ${g.id}: heuristic wins only ${pct(h.win)} at level ${level + 1}.`);
    if (gap < 0.05 && h.win > 0.5) flags.push(`Chapter ${ch} ${g.id}: decisions barely matter (gap ${pct(gap)}).`);
    if (h.turnsPerMember > 7) flags.push(`Chapter ${ch} ${g.id}: slow, ${f1(h.turnsPerMember)} turns per member.`);
    if (h.draws > 0) flags.push(`Chapter ${ch} ${g.id}: ${h.draws} draws (stalemates) for the heuristic.`);
  }
  lines.push("");
  // Boss at expected level and one under
  for (const g of groupsForChapter(ch, true)) {
    const bossLevel = level + 3;
    const rows: string[] = [];
    for (const L of [bossLevel, bossLevel - 1, bossLevel - 2]) {
      const h = evalGroup(ch, g.id, L, heuristicPolicy, BOSS_TRIALS, 101, items);
      const r = evalGroup(ch, g.id, L, randomPolicy, BOSS_TRIALS, 211, items);
      const a = evalGroup(ch, g.id, L, attackOnlyPolicy, BOSS_TRIALS, 307, items);
      const fun = funScore(h, r, a, true);
      if (L === bossLevel) { totalFun += fun.score * 2; funCount += 2; }
      rows.push(`| ${g.id} at L${L} | ${pct(h.win)} | ${pct(r.win)} | ${pct(a.win)} | ${pct(h.win - Math.max(r.win, a.win))} | ${f1(h.turnsPerMember)} | ${pct(h.closeCall)} | ${f1(h.leadChanges)} | ${h.entropy.toFixed(2)} | ${h.distinct} | ${pct(h.mechShare)} | ${h.unwantedLifts.toFixed(2)} | ${fun.score} |`);
      (chJson.groups as unknown[]).push({ id: g.id, level: L, h, r, a, fun, boss: true });
      if (L === bossLevel && h.win < 0.55) flags.push(`Chapter ${ch} boss ${g.id}: heuristic wins only ${pct(h.win)} at level ${L}.`);
      if (L === bossLevel && r.win > 0.6) flags.push(`Chapter ${ch} boss ${g.id}: random play wins ${pct(r.win)}, the boss is a pushover.`);
      if (L === bossLevel && h.draws > 0) flags.push(`Chapter ${ch} boss ${g.id}: ${h.draws} stalemates.`);
    }
    lines.push("| Boss | H win | R win | A win | Gap | Turns/member | Close | Lead chg | Entropy | Distinct | Mech share | Lifts | Fun |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|", ...rows, "");
  }
  // Chapter run: level up through random fights to the boss
  const run = chapterRun(ch, RUNS);
  lines.push(`Chapter run: ${RUNS} runs starting at level ${level}. Average ${f1(run.fights)} fights to reach the boss at average level ${f1(run.levelAtBoss)}. Boss win rate ${pct(run.bossWin)}. Deaths in random fights per run ${f1(run.losses)}. Average fight length ${f1(run.avgTurns)} party turns.`, "");
  if (run.bossWin < 0.6) flags.push(`Chapter ${ch} run: boss win rate only ${pct(run.bossWin)} after the chapter's fights.`);
  chJson.run = run;
  (json.chapters as unknown[]).push(chJson);
}

const overall = Math.round(totalFun / Math.max(1, funCount));
lines.splice(3, 0, `Overall fun score: **${overall}** out of 100.`, "");
lines.push("## Flags", "");
if (flags.length === 0) lines.push("No flags. Every group and boss landed inside its target bands.");
else for (const f of flags) lines.push(`- ${f}`);
lines.push("");
json.overall = overall;
json.flags = flags;

mkdirSync("Notes", { recursive: true });
writeFileSync("Notes/balance-report.md", lines.join("\n"));
writeFileSync("Notes/balance.json", JSON.stringify(json, null, 1));
console.log(lines.join("\n"));

/** Play a chapter: random fights until the party has gained about three levels, then the boss. */
function chapterRun(ch: number, runs: number): { fights: number; levelAtBoss: number; bossWin: number; losses: number; avgTurns: number } {
  const rng = new Rng(`run${ch}`);
  const groups = groupsForChapter(ch, false);
  const boss = groupsForChapter(ch, true)[0];
  let fights = 0, levelSum = 0, bossWins = 0, losses = 0, turns = 0, turnFights = 0;
  for (let r = 0; r < runs; r++) {
    let level = chapterLevel(ch);
    let xp = 0;
    const ids = formationFor(ch);
    const hp: Record<string, number | undefined> = {};
    const items: Record<string, number> = { flatbread: 4, leaddrop: 1, underbread: ch >= 3 ? 2 : 0, slattea: ch >= 4 ? 1 : 0 };
    const target = level + 3;
    let n = 0;
    while (level < target && n < 40) {
      const g = rng.pick(groups);
      const partyIn = partyFor(ch, level, ids).map((p) => ({ ...p, hp: hp[p.def.id] }));
      const s = createBattle({ chapter: ch, party: partyIn, group: g, seed: rng.int(1e9), bonds: ch >= 7 ? [["fathom", "burl"], ["dulcet", "lissom"], ["lissom", "gust"], ["gust", "hale"], ["hale", "sump"], ["sump", "bob"], ["bob", "fathom"], ["fathom", "dulcet"], ["marrow", "fathom"]] : [], items });
      const res = runBattle(s, heuristicPolicy);
      n++;
      fights++;
      turns += res.partyTurns;
      turnFights++;
      if (res.outcome !== "win") {
        losses++;
        // A loss sends the party back to the last rest at full HP, no XP
        for (const id of ids) hp[id] = undefined;
        continue;
      }
      untieAll(s);
      const gained = s.combatants.filter((c) => c.side === "enemy" && !c.alive && !c.taken).reduce((a, c) => a + c.xp, 0);
      xp += gained;
      while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level++; }
      // Rest only when someone is under 60 percent, which is a conservative stand in for a real player
      const partyEnd = s.combatants.filter((c) => c.side === "party");
      const needRest = partyEnd.some((c) => !c.alive || c.hp < c.maxHp * 0.6);
      for (const c of partyEnd) hp[c.id] = needRest ? undefined : Math.min(c.hp + Math.round(c.maxHp * 0.15), c.maxHp);
      if (needRest) { items.flatbread = 4; items.leaddrop = 1; }
    }
    levelSum += level;
    const partyIn = partyFor(ch, level, ids);
    const s = createBattle({ chapter: ch, party: partyIn, group: boss, seed: rng.int(1e9), bonds: ch >= 7 ? [["fathom", "burl"], ["dulcet", "lissom"], ["lissom", "gust"], ["gust", "hale"], ["hale", "sump"], ["sump", "bob"], ["bob", "fathom"], ["fathom", "dulcet"], ["marrow", "fathom"]] : [], items: { flatbread: 4, leaddrop: 1, underbread: 2, slattea: 1 } });
    const res = runBattle(s, heuristicPolicy);
    if (res.outcome === "win") bossWins++;
  }
  return { fights: fights / runs, levelAtBoss: levelSum / runs, bossWin: bossWins / runs, losses: losses / runs, avgTurns: turns / Math.max(1, turnFights) };
}

void ENEMIES;
