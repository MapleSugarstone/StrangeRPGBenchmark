import { CHAPTERS } from "../game/story/index";
import { GameMap } from "../game/world/map";
import { GROUP_BY_ID, ENEMIES } from "../game/data/enemies";
import { ITEMS } from "../game/data/items";
import { SKILLS } from "../game/data/skills";
import { MEMBERS } from "../game/data/members";

/** Checks every map for broken exits, unreachable people, missing scripts and bad references. */
const problems: string[] = [];
const maps = new Map<string, GameMap>();
for (const ch of CHAPTERS) for (const m of ch.maps) maps.set(m.id, new GameMap(m));
const scripts = new Set<string>();
for (const ch of CHAPTERS) for (const id of Object.keys(ch.scripts)) scripts.add(id);

for (const ch of CHAPTERS) {
  for (const def of ch.maps) {
    const map = maps.get(def.id)!;
    const widths = new Set(def.rows.map((r) => r.length));
    if (widths.size > 1) problems.push(`${def.id}: rows have different widths ${[...widths].join(",")}`);
    const walk = (x: number, y: number) => map.walkable(x, y, true);
    for (const n of def.npcs) {
      if (!walk(n.x, n.y)) problems.push(`${def.id}: npc ${n.id} stands on a wall at ${n.x},${n.y}`);
      if (n.talk && !scripts.has(n.talk)) problems.push(`${def.id}: npc ${n.id} talk script ${n.talk} missing`);
    }
    for (const t of def.triggers) {
      if (!scripts.has(t.id)) problems.push(`${def.id}: trigger ${t.id} has no script`);
      if (t.on === "enter") {
        let any = false;
        for (let y = t.y; y < t.y + (t.h ?? 1); y++) for (let x = t.x; x < t.x + (t.w ?? 1); x++) if (walk(x, y)) any = true;
        if (!any) problems.push(`${def.id}: enter trigger ${t.id} covers no walkable tile`);
      }
    }
    for (const e of def.exits) {
      if (!maps.has(e.to)) { problems.push(`${def.id}: exit to unknown map ${e.to}`); continue; }
      const target = maps.get(e.to)!;
      if (!target.walkable(e.tx, e.ty, true)) problems.push(`${def.id}: exit to ${e.to} lands on a wall at ${e.tx},${e.ty}`);
      let any = false;
      for (let y = e.y; y < e.y + (e.h ?? 1); y++) for (let x = e.x; x < e.x + (e.w ?? 1); x++) if (walk(x, y)) any = true;
      if (!any) problems.push(`${def.id}: exit to ${e.to} is on a wall at ${e.x},${e.y}`);
    }
    for (const c of def.chests ?? []) {
      if (!ITEMS[c.item]) problems.push(`${def.id}: chest ${c.id} has unknown item ${c.item}`);
      if (!walk(c.x, c.y)) problems.push(`${def.id}: chest ${c.id} is on a wall`);
    }
    for (const w of def.wander ?? []) for (const g of w.groups) if (!GROUP_BY_ID[g]) problems.push(`${def.id}: wander group ${g} unknown`);
    const isExit = (x: number, y: number) => def.exits.some((e) => x >= e.x && x < e.x + (e.w ?? 1) && y >= e.y && y < e.y + (e.h ?? 1));
    for (const n of def.npcs) if (isExit(n.x, n.y)) problems.push(`${def.id}: npc ${n.id} stands on an exit at ${n.x},${n.y}`);
    for (const c of def.chests ?? []) if (isExit(c.x, c.y)) problems.push(`${def.id}: chest ${c.id} sits on an exit at ${c.x},${c.y}`);
    // Reachability: flood from the first exit or the debug start, slack walking.
    // Doors that are not exits are walls, and an npc that never moves or hides is a wall too.
    const fixed = new Set(def.npcs.filter((n) => !n.wander && !n.hideIf && n.solid !== false).map((n) => `${n.x},${n.y}`));
    const passable = (x: number, y: number) => walk(x, y) && !(map.code(x, y) === "D" && !isExit(x, y)) && !fixed.has(`${x},${y}`);
    const start = ch.debugStart.map === def.id ? [ch.debugStart.x, ch.debugStart.y] : def.exits.length ? [def.exits[0].x, def.exits[0].y] : null;
    if (start) {
      const seen = new Set<string>();
      const stack = [start];
      while (stack.length) {
        const [x, y] = stack.pop()!;
        const k = `${x},${y}`;
        if (seen.has(k) || !passable(x, y)) continue;
        seen.add(k);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      for (const e of def.exits) {
        let any = false;
        for (let y = e.y; y < e.y + (e.h ?? 1); y++) for (let x = e.x; x < e.x + (e.w ?? 1); x++) if (seen.has(`${x},${y}`)) any = true;
        if (!any) problems.push(`${def.id}: exit to ${e.to} is unreachable from ${start.join(",")}`);
      }
      for (const n of def.npcs) {
        const adj = [[n.x + 1, n.y], [n.x - 1, n.y], [n.x, n.y + 1], [n.x, n.y - 1]].some(([x, y]) => seen.has(`${x},${y}`));
        if (!adj) problems.push(`${def.id}: npc ${n.id} cannot be reached`);
      }
      for (const c of def.chests ?? []) {
        const adj = [[c.x + 1, c.y], [c.x - 1, c.y], [c.x, c.y + 1], [c.x, c.y - 1]].some(([x, y]) => seen.has(`${x},${y}`));
        if (!adj) problems.push(`${def.id}: chest ${c.id} cannot be reached`);
      }
    }
  }
}
// Data references
for (const e of Object.values(ENEMIES)) for (const s of e.skills) if (!SKILLS[s]) problems.push(`enemy ${e.id} has unknown skill ${s}`);
for (const m of Object.values(MEMBERS)) for (const l of m.learn) if (!SKILLS[l.skill]) problems.push(`member ${m.id} learns unknown skill ${l.skill}`);
for (const g of Object.values(GROUP_BY_ID)) for (const e of g.enemies) if (!ENEMIES[e]) problems.push(`group ${g.id} has unknown enemy ${e}`);

if (problems.length) {
  console.log(`${problems.length} problems:`);
  for (const p of problems) console.log(" - " + p);
  process.exit(1);
} else console.log(`All ${maps.size} maps and data references check out.`);
