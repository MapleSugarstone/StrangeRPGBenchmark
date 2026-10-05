import { GROUPS } from "../game/data/enemies";
import { randomPolicy, heuristicPolicy } from "../game/battle/ai";
import { runBattle, makeBattle } from "./runner";

/** Trace one battle: who did what and how much. `node dist/debug.js c6_boss 19 random` */
const groupId = process.argv[2] ?? "c6_boss";
const level = Number(process.argv[3] ?? 19);
const policy = (process.argv[4] ?? "random") === "random" ? randomPolicy : heuristicPolicy;
const group = GROUPS.find((g) => g.id === groupId)!;
const chapter = group.chapter;
const s = makeBattle(chapter, group, level, 12345, { items: { flatbread: 3, leaddrop: 1, underbread: 2 } });
const r = runBattle(s, policy, { keepEvents: true });
const dealt: Record<string, number> = {};
const used: Record<string, number> = {};
let bites = 0, cancels = 0, charges = 0;
for (const e of r.events) {
  if (e.t === "damage") dealt[e.who] = (dealt[e.who] ?? 0) + e.amount;
  if (e.t === "use") used[`${e.who}:${e.skill}`] = (used[`${e.who}:${e.skill}`] ?? 0) + 1;
  if (e.t === "bite") bites++;
  if (e.t === "cancel") cancels++;
  if (e.t === "charge") charges++;
}
console.log(`outcome ${r.outcome} actions ${r.actions} partyTurns ${r.partyTurns} bites ${bites} charges ${charges} cancels ${cancels}`);
console.log("damage dealt:", dealt);
console.log("skills used:", used);
for (const c of s.combatants) console.log(`${c.name} ${c.side} hp ${c.hp}/${c.maxHp} atk ${c.atk} def ${c.def} spd ${c.spd} pool ${c.pool} tension ${c.tension}`);
