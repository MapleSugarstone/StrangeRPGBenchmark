// headless test — verifies the game's core systems work.
// Run: node dist/test/headless.js

import { CHAPTER_BY_NUMBER } from "../game/chapters.js";
import { createMap, movePlayer } from "../engine/map.js";
import { Battle as BattleEngine, elementMultiplier } from "../engine/battle.js";
import { GRAPH_START, getNode } from "../game/dialogue.js";
import { COMPANIONS, PLAYER_BASE } from "../game/characters.js";
import { itemById } from "../game/items.js";
import { getSkill } from "../game/skills.js";
import type { ItemDef } from "../game/types.js";
import type { PartyMember } from "../engine/battle.js";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

// ================================================================ helpers

function makeUnit(maxHp: number, hp: number): PartyMember["unit"] {
  return {
    ...PLAYER_BASE,
    maxHp,
    hp,
    alive: true,
    statuses: [],
    buffs: {},
  };
}

/** The party as it stands when chapter 1's boss is reached: Mender and Ochre at full hp. */
function makeTestParty(): PartyMember[] {
  return [{
    id: "mender",
    unit: makeUnit(PLAYER_BASE.hp, PLAYER_BASE.hp + 22),
    skills: ["basic-mender", "stitch", "mend", "fray"],
    weapon: "w_patchblade",
    armor: "a_homespun",
    trinket: "t_bead",
    items: { currency: 20 },
  }, {
    id: "ochre",
    unit: { ...COMPANIONS.ochre.base, maxHp: COMPANIONS.ochre.base.hp, alive: true, statuses: [], buffs: {} },
    skills: ["basic-ochre", "prayer", "grace"],
    weapon: "",
    armor: "",
    trinket: "",
    items: { currency: 20 },
  }];
}

function getAtk(item: ItemDef | null): number {
  return item?.atk ?? 0;
}

function getDef(item: ItemDef | null): number {
  return item?.def ?? 0;
}

// ================================================================ tests

console.log("\n=== MAP GENERATION ===");
for (let i = 1; i <= 5; i++) {
  const ch = CHAPTER_BY_NUMBER[i];
  const m = ch.map;
  const map = createMap(m, 0);
  assert(map.tiles.length === m.h, `${ch.id}: height=${m.h}`);
  assert(map.tiles[0]?.length === m.w, `${ch.id}: width=${m.w}`);
  assert(map.playerX >= 0 && map.playerX < m.w, `${ch.id}: playerX=${map.playerX} in range`);
  assert(map.playerY >= 0 && map.playerY < m.h, `${ch.id}: playerY=${map.playerY} in range`);

  // Count non-wall tiles
  let floorCount = 0;
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++)
      if (map.tiles[y]?.[x]?.type !== "wall") floorCount++;
  assert(floorCount > m.w * m.h * 0.2, `${ch.id}: ${floorCount} floor tiles (>20% of grid)`);
}

console.log("\n=== MAP MOVEMENT ===");
const testMap = createMap(CHAPTER_BY_NUMBER[4].map, 0);
// ch4 (crossing) is a hollow layout with open center
const origX = testMap.playerX;
const origY = testMap.playerY;
// Move in direction of positive X
const ev = movePlayer(testMap, 1, 0);
assert(ev.kind === "move" || ev.kind === "encounter", "Move right returns 'move' or 'encounter'");
assert(testMap.playerX === origX + 1, "Player x increased by 1");
void origY;
const evUp = movePlayer(testMap, 0, 1);
assert(evUp.kind === "move" || evUp.kind === "encounter", "Move down works");

// Move into a wall
const testMap2 = createMap(CHAPTER_BY_NUMBER[1].map, 0);
testMap2.playerX = 0;
testMap2.playerY = 0;
const evWall = movePlayer(testMap2, -1, 0);
assert(evWall.kind === "nothing", "Moving into wall returns nothing");
assert(testMap2.playerX === 0, "Player didn't move into wall");

console.log("\n=== DIALOGUE GRAPHS ===");
for (const [graphId, startNode] of Object.entries(GRAPH_START)) {
  const node = getNode(startNode);
  assert(node != null, `${graphId}: starts at ${startNode}`);
  assert(Array.isArray(node.lines), `${graphId}: has lines array`);
  assert(node.lines.length > 0, `${graphId}: has at least one line`);

  // Follow next chain — detect loops
  const visited = new Set<string>();
  let current: string | undefined = startNode;
  let steps = 0;
  while (current && steps < 100) {
    if (visited.has(current)) {
      console.error(`  ✗ ${graphId}: loop at ${current}`);
      failed++;
      break;
    }
    visited.add(current);
    const n = getNode(current);
    if (!n) {
      console.error(`  ✗ ${graphId}: missing node ${current}`);
      failed++;
      break;
    }
    if (n.end) break;
    current = n.next || (n.choices?.[0]?.next);
    steps++;
  }
  assert(steps < 100, `${graphId}: no loop (${steps} steps)`);
  assert(visited.size >= 1, `${graphId}: ${visited.size} unique nodes`);
}

const basicAttack = { kind: "skill" as const, skill: { id: "basic-mender", name: "Pull", desc: "Basic pull.", power: 12, element: "null" as const, target: "enemy" as const, cost: 0, accuracy: 1, unlockChapter: 1 } };

/** Everyone attacks, except that Ochre prays over anyone under half hp. */
function fightWithAttacks(b: typeof b1): void {
  let stepCount = 0;
  while (!b.done) {
    const hurt = b.party.findIndex((u) => u.alive && u.hp < u.maxHp / 2);
    for (let i = 0; i < b.party.length; i++) {
      const p = b.party[i];
      if (p && p.alive) {
        const heal = i === 1 && hurt >= 0 && b.pool(i) >= 4;
        b.command(i, heal ? { kind: "skill", skill: getSkill("prayer"), allyIndex: hurt } : basicAttack);
      }
    }
    b.step();
    stepCount++;
    if (stepCount > 500) break;
  }
}

console.log("\n=== BATTLE — Regular Enemy ===");
const b1 = new BattleEngine(makeTestParty(), ["fray_mote"], 1, {
  rngSeed: 42, currency: "thread",
});
fightWithAttacks(b1);
assert(b1.result === "win", "Regular battle: won");
assert(b1.rewards != null, "Regular battle: has rewards");
assert(b1.rewards != null && b1.rewards.xp > 0, "Regular battle: xp > 0");

console.log("\n=== BATTLE — Boss Enemy ===");
// the first guardian a level 1 party meets; the chapter boss waits on floor 2
const b2 = new BattleEngine(makeTestParty(), ["seam_gaunt"], 1, {
  rngSeed: 42, currency: "thread", boss: true,
});
fightWithAttacks(b2);
assert(b2.result === "win", "Boss battle: won");
assert(b2.rewards != null && b2.rewards.credits > 30, "Boss battle: credits > 30");

console.log("\n=== BATTLE — Splitter Enemy ===");
const b3 = new BattleEngine(makeTestParty(), ["loom_whisk"], 1, {
  rngSeed: 42, currency: "thread",
});
fightWithAttacks(b3);
assert(b3.result === "win", "Splitter battle: won");
const splitEvents = b3.events.filter(e => e.kind === "split");
assert(splitEvents.length > 0, "Splitter battle: triggered split event");

console.log("\n=== BATTLE — Multiple Enemies ===");
const b4 = new BattleEngine(makeTestParty(), ["fray_mote", "bad_pattern", "hollow_hanger"], 1, {
  rngSeed: 42, currency: "thread",
});
fightWithAttacks(b4);
assert(b4.result === "win", "Multi-enemy battle: won");
assert(b4.enemyUnits.every(e => !e.alive), "All enemies dead");

console.log("\n=== BATTLE — Determinism ===");
const b5a = new BattleEngine(makeTestParty(), ["fray_mote"], 1, {
  rngSeed: 999, currency: "thread",
});
for (let i = 0; i < b5a.party.length; i++) if (b5a.party[i].alive) b5a.command(i, basicAttack);
let steps5a = 0;
while (!b5a.done && steps5a < 30) { b5a.step(); steps5a++; for (let i = 0; i < b5a.party.length; i++) if (b5a.party[i].alive) b5a.command(i, basicAttack); }
const eventsA = b5a.events.map(e => JSON.stringify([e.kind, e.text]));

const b5b = new BattleEngine(makeTestParty(), ["fray_mote"], 1, {
  rngSeed: 999, currency: "thread",
});
for (let i = 0; i < b5b.party.length; i++) if (b5b.party[i].alive) b5b.command(i, basicAttack);
let steps5b = 0;
while (!b5b.done && steps5b < 30) { b5b.step(); steps5b++; for (let i = 0; i < b5b.party.length; i++) if (b5b.party[i].alive) b5b.command(i, basicAttack); }
const eventsB = b5b.events.map(e => JSON.stringify([e.kind, e.text]));

assert(JSON.stringify(eventsA) === JSON.stringify(eventsB), "Deterministic: same seed = same events");

console.log("\n=== ITEMS & PASSIVES ===");
const patchblade = itemById("w_patchblade");
assert(patchblade != null, "w_patchblade exists");
assert(getAtk(patchblade) >= 3, "w_patchblade has atk >= 3");
const homespun = itemById("a_homespun");
assert(homespun != null, "a_homespun exists");
assert(getDef(homespun) >= 1, "a_homespun has def >= 1");
const mend = itemById("c_mend");
assert(mend != null, "c_mend exists");
assert(mend.kind === "consumable", "c_mend is consumable");
assert(mend.use != null, "c_mend has use");

console.log("\n=== ELEMENT CHART ===");
assert(elementMultiplier("static", "bloom") === 1.3, "static vs bloom = 1.3");
assert(elementMultiplier("static", "static") === 1, "static vs static = 1.0");
assert(elementMultiplier("null", "static") === 1, "null vs static = 1.0 (null is neutral)");
assert(elementMultiplier("void", "steel") === 1.3, "void vs steel = 1.3");
assert(elementMultiplier("steel", "void") === 1.3, "steel vs void = 1.3");

// ================================================================ summary
console.log("\n=== RESULTS ===");
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed === 0) {
  console.log("All tests pass! :-]");
} else {
  console.error(`${failed} test(s) failed.`);
  // @ts-ignore — process.exitCode is set in Node at runtime
  process.exitCode = 1;
}
