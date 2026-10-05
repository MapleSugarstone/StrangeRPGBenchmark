import { writeFileSync, mkdirSync } from "node:fs";
import { Rng } from "../engine/rng";
import type { MechId, PartyMember } from "../game/types";
import { ENEMIES, ENCOUNTERS } from "../game/data/enemies";
import { ITEMS, WORDS } from "../game/data/items";
import { SKILLS } from "../game/data/skills";
import { CHARACTERS } from "../game/data/classes";
import { newMember, gainXp, fullHeal, memberStats } from "../game/party";
import { createBattle, nextActor, performAction, enemyAction, rewards, type BattleState, type BattleEvent } from "../game/battle/core";
import { greedyPolicy, randomPolicy, attackOnlyPolicy, type Policy } from "./policies";

const quick = process.argv.includes("--quick");
const debug = process.argv.includes("--debug");
const only = process.argv.find((a) => a.startsWith("--chapter="))?.split("=")[1];
const N = quick ? 40 : 150;
const RUNS = quick ? 6 : 20;

interface Profile {
  n: number; name: string; party: string[]; levelStart: number; levelEnd: number; mechanics: MechId[];
  encounters: string[]; boss: string[]; inventory: Record<string, number>; memories?: Record<string, string[]>; words?: string[];
  gear?: Record<string, { weapon?: string; armor?: string; accessory?: string }>;
  /** Members present for the boss when the story has someone join after it. */
  bossParty?: string[];
  /** Extra boss fights to evaluate after the main one. */
  bosses?: string[][];
}

const PROFILES: Profile[] = [
  { n: 1, name: "Salt", party: ["pell"], bossParty: ["pell"], levelStart: 1, levelEnd: 4, mechanics: ["brace"], encounters: ["rim_field", "salt_cellar"], boss: ["rust_warden"], inventory: { salt_biscuit: 5, antidote: 1 } },
  { n: 2, name: "Tempo", party: ["pell", "oxbow", "vane"], levelStart: 4, levelEnd: 7, mechanics: ["brace", "tempo"], encounters: ["church_road", "church_inner"], boss: ["metronome"], inventory: { salt_biscuit: 6, brine: 2, lamp_wick: 2, antidote: 2 }, gear: { pell: { weapon: "brine_hook", armor: "salt_coat" } } },
  { n: 3, name: "Links", party: ["pell", "oxbow", "vane", "mim"], levelStart: 7, levelEnd: 10, mechanics: ["brace", "tempo", "links"], encounters: ["steppe", "steppe_deep"], boss: ["lantern_whale"], inventory: { salt_biscuit: 4, brine: 4, lamp_wick: 3, antidote: 2, oil_bomb: 2, frost_vial: 2 }, gear: { pell: { weapon: "brine_hook", armor: "rust_plate" }, oxbow: { weapon: "piston_arm", armor: "rust_plate" }, vane: { weapon: "coin_rod", armor: "habit" } } },
  { n: 4, name: "Memories", party: ["pell", "oxbow", "mim", "quill"], levelStart: 10, levelEnd: 13, mechanics: ["brace", "tempo", "links", "memories"], encounters: ["library", "library_deep"], boss: ["the_unread"], inventory: { brine: 5, lamp_wick: 4, antidote: 2, moth_dust: 1, candle: 2 }, gear: { pell: { weapon: "glass_blade", armor: "glass_mail" }, oxbow: { weapon: "piston_arm", armor: "rust_plate" }, mim: { weapon: "prism_rod" }, quill: { weapon: "coin_rod", armor: "paper_robe" } }, memories: { pell: ["mem_rat", "mem_hare"], oxbow: ["mem_golem"], mim: ["mem_hymnal"], quill: ["mem_beetle"] } },
  { n: 5, name: "Rows", party: ["pell", "oxbow", "vane", "fold"], levelStart: 13, levelEnd: 16, mechanics: ["brace", "tempo", "links", "memories", "rows"], encounters: ["fold", "fold_deep"], boss: ["blank_spot_boss"], inventory: { brine: 6, lamp_wick: 4, antidote: 2, moth_dust: 2, tonic: 1 }, gear: { pell: { weapon: "glass_blade", armor: "glass_mail" }, oxbow: { weapon: "piston_arm", armor: "rust_plate" }, vane: { weapon: "hymn_rod", armor: "paper_robe" }, fold: { weapon: "folding_knife", armor: "map_cloak" } }, memories: { pell: ["mem_rat", "mem_page"], oxbow: ["mem_golem", "mem_saltlick"], vane: ["mem_hymnal"], fold: ["mem_mite"] } },
  { n: 6, name: "Debt", party: ["pell", "vane", "mim", "uhtred"], levelStart: 16, levelEnd: 19, mechanics: ["brace", "tempo", "links", "memories", "rows", "debt"], encounters: ["bank", "bank_deep"], boss: ["the_lender"], inventory: { brine: 6, lamp_wick: 5, antidote: 2, moth_dust: 2, tonic: 2, tooth: 3 }, gear: { pell: { weapon: "glass_blade", armor: "map_cloak" }, vane: { weapon: "hymn_rod", armor: "paper_robe" }, mim: { weapon: "prism_rod", armor: "paper_robe" }, uhtred: { weapon: "issue_rifle", armor: "ledger_vest" } }, memories: { pell: ["mem_rat", "mem_page"], vane: ["mem_hymnal", "mem_beetle"], mim: ["mem_hymnal"], uhtred: ["mem_golem", "mem_teller"] } },
  { n: 7, name: "Rewind", party: ["pell", "oxbow", "vane", "dust"], levelStart: 19, levelEnd: 22, mechanics: ["brace", "tempo", "links", "memories", "rows", "debt", "rewind"], encounters: ["hour", "hour_deep"], boss: ["pells_death"], inventory: { brine: 6, lamp_wick: 5, antidote: 3, moth_dust: 2, tonic: 2 }, gear: { pell: { weapon: "tooth_saw", armor: "ledger_vest" }, oxbow: { weapon: "piston_arm", armor: "ledger_vest" }, vane: { weapon: "hymn_rod", armor: "paper_robe" }, dust: { weapon: "hour_hand", armor: "glass_mail" } }, memories: { pell: ["mem_rat", "mem_page", "mem_ghost"], oxbow: ["mem_golem", "mem_saltlick"], vane: ["mem_hymnal", "mem_beetle"], dust: ["mem_hound", "mem_wraith"] } },
  { n: 8, name: "Fusion", party: ["pell", "mim", "dust", "choir"], levelStart: 22, levelEnd: 25, mechanics: ["brace", "tempo", "links", "memories", "rows", "debt", "rewind", "fusion"], encounters: ["choir", "choir_deep"], boss: ["the_conductor"], inventory: { brine: 7, lamp_wick: 6, antidote: 3, moth_dust: 3, tonic: 2 }, gear: { pell: { weapon: "hour_hand", armor: "ledger_vest" }, mim: { weapon: "prism_rod", armor: "paper_robe" }, dust: { weapon: "tooth_saw", armor: "glass_mail" }, choir: { weapon: "hymn_rod", armor: "paper_robe" } }, memories: { pell: ["mem_rat", "mem_page", "mem_ghost"], mim: ["mem_hymnal", "mem_jelly"], dust: ["mem_hound", "mem_wraith"], choir: ["mem_beetle", "mem_golem"] } },
  { n: 9, name: "Words", party: ["pell", "oxbow", "vane", "mim"], levelStart: 25, levelEnd: 28, mechanics: ["brace", "tempo", "links", "memories", "rows", "debt", "rewind", "fusion", "words"], encounters: ["crown", "crown_deep"], boss: ["the_loom"], bosses: [["the_ember"]], inventory: { brine: 8, lamp_wick: 6, antidote: 3, moth_dust: 3, tonic: 3 }, gear: { pell: { weapon: "hour_hand", armor: "ledger_vest" }, oxbow: { weapon: "piston_arm", armor: "ledger_vest" }, vane: { weapon: "hymn_rod", armor: "paper_robe" }, mim: { weapon: "prism_rod", armor: "map_cloak" } }, memories: { pell: ["mem_rat", "mem_page", "mem_ghost"], oxbow: ["mem_golem", "mem_saltlick", "mem_monk"], vane: ["mem_hymnal", "mem_beetle"], mim: ["mem_hymnal", "mem_jelly", "mem_hound"] }, words: ["w_burn", "w_freeze", "w_shock", "w_mend", "w_shine", "w_foe", "w_foes", "w_friend", "w_friends", "w_twice", "w_loud", "w_quiet", "w_slow"] },
];

function makeParty(p: Profile, level: number): PartyMember[] {
  return p.party.map((id) => {
    const m = newMember(id, level);
    if (p.gear?.[id]) m.equip = { ...m.equip, ...p.gear[id] };
    if (p.memories?.[id] && p.mechanics.includes("memories")) m.memories = [...p.memories[id]];
    fullHeal(m);
    return m;
  });
}

interface Outcome {
  result: "win" | "lose" | "flee" | "timeout";
  partyTurns: number;
  closeCall: boolean;
  hpFrac: number;
  actions: Record<string, number>;
  mechanic: boolean;
  stStarved: number;
  stTurns: number;
  deaths: number;
  events: number;
}

function runBattle(party: PartyMember[], enemyIds: string[], mech: MechId[], inventory: Record<string, number>, policy: Policy, seed: number, words: string[] = [], debt = 0): { out: Outcome; state: BattleState } {
  const s = createBattle({ party, enemies: enemyIds.map((id) => ENEMIES[id]), mechanics: mech, seed, inventory, gold: 100, debt, words });
  const rng = new Rng(seed ^ 0xabcdef);
  let partyTurns = 0, closeCall = false, stStarved = 0, stTurns = 0, mechanic = false, deaths = 0, events = 0;
  const actions: Record<string, number> = {};
  const check = (ev: BattleEvent[]) => {
    for (const e of ev) {
      events++;
      if (e.type === "death" && s.combatants.find((c) => c.uid === e.target)?.side === "party") deaths++;
      if (e.type === "link" || e.type === "rewind" || e.type === "fuse" || e.type === "row" || e.type === "debt") mechanic = true;
      if (e.type === "status" && e.id === "brace" && e.on && mech.includes("brace") && mech.length === 1) mechanic = true;
      if (e.type === "tempo" && mech.includes("tempo")) mechanic = true;
      if (e.type === "act" && e.skillId?.startsWith("word:")) mechanic = true;
    }
    for (const c of s.combatants) if (c.side === "party" && c.hp > 0 && c.hp < c.max.hp * 0.3) closeCall = true;
  };
  let guard = 0;
  while (!s.over && guard++ < 400) {
    const actor = nextActor(s);
    let action;
    if (actor.side === "enemy") action = enemyAction(s, actor);
    else {
      partyTurns++;
      stTurns++;
      const best = actor.skills.map((id) => SKILLS[id]).filter((k) => k && k.cost > 0 && (k.kind === "phys" || k.kind === "mag")).sort((a, b) => b.cost - a.cost)[0];
      if (best && actor.st < best.cost) stStarved++;
      action = policy(s, actor, rng);
      const key = action.type === "skill" ? action.skillId : action.type === "item" ? `item:${action.itemId}` : action.type === "word" ? "word" : "flee";
      actions[key] = (actions[key] ?? 0) + 1;
      if (mech.includes("memories") && mech[mech.length - 1] === "memories" && party.some((m) => m.memories.length)) mechanic = true;
    }
    const ev = performAction(s, action);
    check(ev);
  }
  const alive = s.combatants.filter((c) => c.side === "party");
  const hpFrac = alive.reduce((a, c) => a + Math.max(0, c.hp) / c.max.hp, 0) / alive.length;
  return { out: { result: s.over ?? "timeout", partyTurns, closeCall, hpFrac, actions, mechanic, stStarved, stTurns, deaths, events }, state: s };
}

function entropy(counts: Record<string, number>): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return 0;
  let h = 0;
  for (const v of Object.values(counts)) { const p = v / total; if (p > 0) h -= p * Math.log(p); }
  const k = Object.keys(counts).length;
  return k > 1 ? h / Math.log(k) : 0;
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function std(xs: number[]): number { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }
function band(v: number, lo: number, hi: number, soft = 0.5): number {
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? (lo - v) / Math.max(1e-6, (hi - lo) * soft + 1e-6) : (v - hi) / Math.max(1e-6, (hi - lo) * soft + 1e-6);
  return Math.max(0, 1 - d);
}

interface GroupStats {
  label: string; enemies: string[]; greedyWin: number; randomWin: number; attackWin: number; turns: number; closeCall: number; entropy: number;
  variety: number; mechanic: number; starved: number; hpStd: number; top: string[]; fun: number; notes: string[];
}

function evalGroup(p: Profile, label: string, enemyIds: string[], level: number, n: number, isBoss: boolean): GroupStats {
  const collect = (policy: Policy) => {
    const outs: Outcome[] = [];
    for (let i = 0; i < n; i++) {
      const party = makeParty(p, level);
      outs.push(runBattle(party, enemyIds, p.mechanics, { ...p.inventory }, policy, 1000 + i * 7 + p.n * 1000 + label.length, p.words ?? []).out);
    }
    return outs;
  };
  const g = collect(greedyPolicy);
  const r = collect(randomPolicy);
  const a = collect(attackOnlyPolicy);
  const wins = g.filter((o) => o.result === "win");
  const actions: Record<string, number> = {};
  for (const o of g) for (const [k, v] of Object.entries(o.actions)) actions[k] = (actions[k] ?? 0) + v;
  const total = Object.values(actions).reduce((x, y) => x + y, 0);
  const top = Object.entries(actions).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`);
  const st: GroupStats = {
    label, enemies: enemyIds,
    greedyWin: mean(g.map((o) => (o.result === "win" ? 1 : 0))),
    randomWin: mean(r.map((o) => (o.result === "win" ? 1 : 0))),
    attackWin: mean(a.map((o) => (o.result === "win" ? 1 : 0))),
    turns: mean(g.map((o) => o.partyTurns)),
    closeCall: wins.length ? mean(wins.map((o) => (o.closeCall ? 1 : 0))) : 0,
    entropy: entropy(actions),
    variety: Object.keys(actions).length,
    mechanic: mean(g.map((o) => (o.mechanic ? 1 : 0))),
    starved: mean(g.map((o) => (o.stTurns ? o.stStarved / o.stTurns : 0))),
    hpStd: std(wins.map((o) => o.hpFrac)),
    top, fun: 0, notes: [],
  };
  // Fun score bands. Pacing is in rounds, so it scales with party size.
  const P = (isBoss ? p.bossParty ?? p.party : p.party).length;
  const winBand = isBoss ? band(st.greedyWin, 0.55, 0.9) : band(st.greedyWin, 0.88, 1.0);
  const turnBand = isBoss ? band(st.turns, 3 * P, 8 * P) : band(st.turns, 1.5 * P, 4.5 * P);
  const closeBand = isBoss ? band(st.closeCall, 0.4, 0.95) : band(st.closeCall, 0.1, 0.5);
  const gap = st.greedyWin - Math.max(st.randomWin, st.attackWin);
  const gapBand = isBoss ? band(gap, 0.15, 1) : band(gap, 0.05, 1);
  const entBand = band(st.entropy, 0.45, 1);
  const mechBand = band(st.mechanic, 0.4, 1);
  const starveBand = band(st.starved, 0.05, 0.45);
  st.fun = Math.round(100 * (0.25 * winBand + 0.15 * turnBand + 0.15 * closeBand + 0.15 * gapBand + 0.12 * entBand + 0.1 * mechBand + 0.08 * starveBand));
  if (winBand < 1) st.notes.push(st.greedyWin < (isBoss ? 0.55 : 0.88) ? "too hard" : "too easy");
  if (turnBand < 1) st.notes.push(st.turns < (isBoss ? 3 * P : 1.5 * P) ? "too short" : "too long");
  if (closeBand < 1) st.notes.push(st.closeCall < (isBoss ? 0.4 : 0.1) ? "no tension" : "too tense");
  if (gapBand < 1) st.notes.push("decisions barely matter");
  if (entBand < 1) st.notes.push("one action dominates");
  if (mechBand < 1) st.notes.push("mechanic underused");
  if (starveBand < 1) st.notes.push(st.starved < 0.05 ? "static never scarce" : "static starved");
  return st;
}

interface RunStats { bossWin: number; battlesToLevel: number; levelReached: number; wipes: number; potionsLeft: number }

/** Plays a chapter: random encounters until the end level, with a rest every few fights, then the boss. */
function evalRun(p: Profile, runs: number): RunStats {
  let bossWins = 0, battles = 0, levels = 0, wipes = 0, potions = 0;
  for (let r = 0; r < runs; r++) {
    const rng = new Rng(500 + r * 31 + p.n);
    const party = makeParty(p, p.levelStart);
    const inv = { ...p.inventory };
    let count = 0, since = 0, dead = false;
    while (party[0].level < p.levelEnd && count < 60) {
      // Areas come in story order: the first table until the midpoint level, the deeper one after.
      const mid = (p.levelStart + p.levelEnd) / 2;
      const table = ENCOUNTERS[p.encounters[party[0].level < mid ? 0 : Math.min(1, p.encounters.length - 1)]];
      const group = rng.weighted(table, table.map((g) => g.weight));
      const before = party.map((m) => `${m.charId}:${m.hp}/${memberStats(m).hp}:${m.st}st`).join(" ");
      const { out, state } = runBattle(party, group.ids, p.mechanics, inv, greedyPolicy, rng.int(0, 1e9), p.words ?? []);
      if (debug && out.result !== "win") console.log(`  wipe in run ${r} fight ${count + 1} vs ${group.ids.join("+")} at L${party[0].level}; before: ${before}; bag: ${JSON.stringify(inv)}`);
      count++;
      since++;
      Object.assign(inv, state.inventory);
      for (const c of state.combatants) if (c.side === "party" && c.member) { c.member.hp = Math.max(1, c.hp); c.member.st = c.st; }
      if (out.result === "win") {
        const rw = rewards(state);
        for (const m of party) gainXp(m, rw.xp);
        // Shop restock from gold, roughly: one flask per fight won.
        inv.brine = (inv.brine ?? 0) + 1;
        // Field healing: a player tops up anyone under 60% from the bag before walking on.
        for (const m of party) {
          const stats = memberStats(m);
          let tries = 0;
          while (m.hp < stats.hp * 0.6 && tries++ < 3) {
            const k = ["salt_biscuit", "brine", "tonic"].find((id) => (inv[id] ?? 0) > 0);
            if (!k) break;
            inv[k]--;
            const u = ITEMS[k].use!;
            const amount = (u.heal ?? 0) + Math.round(stats.hp * (u.healPct ?? 0));
            if (u.target === "allies") for (const o of party) o.hp = Math.min(memberStats(o).hp, o.hp + amount);
            else m.hp = Math.min(stats.hp, m.hp + amount);
          }
        }
      } else { wipes++; dead = true; break; }
      if (since >= 3) { since = 0; for (const m of party) fullHeal(m); }
    }
    if (dead) continue;
    for (const m of party) fullHeal(m);
    battles += count;
    levels += party[0].level;
    const boss = runBattle(party, p.boss, p.mechanics, inv, greedyPolicy, rng.int(0, 1e9), p.words ?? []);
    if (boss.out.result === "win") bossWins++;
    potions += Object.keys(boss.state.inventory).filter((k) => ITEMS[k].use?.heal).reduce((a, k) => a + boss.state.inventory[k], 0);
  }
  const ok = Math.max(1, runs - wipes);
  return { bossWin: bossWins / runs, battlesToLevel: battles / ok, levelReached: levels / ok, wipes, potionsLeft: potions / ok };
}

function fmt(x: number, d = 2): string { return x.toFixed(d); }
function pct(x: number): string { return `${Math.round(x * 100)}%`; }

const lines: string[] = [];
const log = (s = "") => { console.log(s); lines.push(s); };

log(`# Balance report (${quick ? "quick" : "full"}, N=${N} per group, ${RUNS} chapter runs)`);
log();
log("Fun score weights: win rate 25, pacing 15, tension 15, decision gap 15, action entropy 12, mechanic use 10, static scarcity 8.");
log();

const summary: { n: number; name: string; fun: number; bossFun: number; run: RunStats }[] = [];
for (const p of PROFILES) {
  if (only && String(p.n) !== only) continue;
  const level = Math.round((p.levelStart + p.levelEnd) / 2);
  log(`## Chapter ${p.n}: ${p.name}  (party ${p.party.join(", ")} at L${level}, mechanics ${p.mechanics.join("+")})`);
  log();
  log("| group | enemies | greedy | random | attack | turns | close | ent | var | mech | starve | fun | top actions | notes |");
  log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const groupScores: number[] = [];
  for (const key of p.encounters) {
    for (const g of ENCOUNTERS[key]) {
      const st = evalGroup(p, key, g.ids, level, N, false);
      groupScores.push(st.fun);
      log(`| ${key} | ${g.ids.join("+")} | ${pct(st.greedyWin)} | ${pct(st.randomWin)} | ${pct(st.attackWin)} | ${fmt(st.turns, 1)} | ${pct(st.closeCall)} | ${fmt(st.entropy)} | ${st.variety} | ${pct(st.mechanic)} | ${pct(st.starved)} | ${st.fun} | ${st.top.join(", ")} | ${st.notes.join("; ")} |`);
    }
  }
  const boss = evalGroup(p, "boss", p.boss, p.levelEnd, Math.max(20, Math.round(N / 2)), true);
  log(`| BOSS L${p.levelEnd} | ${p.boss.join("+")} | ${pct(boss.greedyWin)} | ${pct(boss.randomWin)} | ${pct(boss.attackWin)} | ${fmt(boss.turns, 1)} | ${pct(boss.closeCall)} | ${fmt(boss.entropy)} | ${boss.variety} | ${pct(boss.mechanic)} | ${pct(boss.starved)} | ${boss.fun} | ${boss.top.join(", ")} | ${boss.notes.join("; ")} |`);
  for (const extra of p.bosses ?? []) {
    const ex = evalGroup(p, "boss2", extra, p.levelEnd, Math.max(20, Math.round(N / 2)), true);
    log(`| BOSS L${p.levelEnd} | ${extra.join("+")} | ${pct(ex.greedyWin)} | ${pct(ex.randomWin)} | ${pct(ex.attackWin)} | ${fmt(ex.turns, 1)} | ${pct(ex.closeCall)} | ${fmt(ex.entropy)} | ${ex.variety} | ${pct(ex.mechanic)} | ${pct(ex.starved)} | ${ex.fun} | ${ex.top.join(", ")} | ${ex.notes.join("; ")} |`);
  }
  const bossEarly = evalGroup(p, "boss-early", p.boss, p.levelStart + 1, Math.max(20, Math.round(N / 2)), true);
  log(`| BOSS L${p.levelStart + 1} | ${p.boss.join("+")} | ${pct(bossEarly.greedyWin)} | ${pct(bossEarly.randomWin)} | ${pct(bossEarly.attackWin)} | ${fmt(bossEarly.turns, 1)} | ${pct(bossEarly.closeCall)} | ${fmt(bossEarly.entropy)} | ${bossEarly.variety} | ${pct(bossEarly.mechanic)} | ${pct(bossEarly.starved)} | ${bossEarly.fun} | ${bossEarly.top.join(", ")} | underleveled check |`);
  const run = evalRun(p, RUNS);
  log();
  log(`Chapter run: boss win ${pct(run.bossWin)} at natural level ${fmt(run.levelReached, 1)}; ${fmt(run.battlesToLevel, 1)} battles to reach L${p.levelEnd}; wipes ${run.wipes}/${RUNS}; healing items left before boss ${fmt(run.potionsLeft, 1)}.`);
  const fun = Math.round(mean(groupScores));
  log(`Chapter fun: encounters ${fun}, boss ${boss.fun}.`);
  log();
  summary.push({ n: p.n, name: p.name, fun, bossFun: boss.fun, run });
}

log("## Summary");
log();
log("| chapter | encounter fun | boss fun | boss win (natural) | battles to level | wipes |");
log("|---|---|---|---|---|---|");
for (const s of summary) log(`| ${s.n} ${s.name} | ${s.fun} | ${s.bossFun} | ${pct(s.run.bossWin)} | ${fmt(s.run.battlesToLevel, 1)} | ${s.run.wipes} |`);
log();
log(`Overall fun: ${Math.round(mean(summary.map((s) => (s.fun + s.bossFun) / 2)))}`);

mkdirSync("Notes", { recursive: true });
writeFileSync("Notes/balance-report.md", lines.join("\n") + "\n");
console.log("\nwrote Notes/balance-report.md");
