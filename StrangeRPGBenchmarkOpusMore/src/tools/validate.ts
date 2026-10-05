// Checks every map: row widths, legend coverage, links between maps, and reachability of points of interest.
import { MAPS } from '../maps';
import { GROUPS, ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SLIPS } from '../data/slips';
import { SKILLS } from '../data/skills';
import { MEMBERS } from '../data/members';
import type { MapDef } from '../maps/types';

const problems: string[] = [];
const warn = (m: string) => problems.push(m);

function grid(m: MapDef) {
  const h = m.rows.length, w = Math.max(...m.rows.map((r) => r.length));
  const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : m.legend[m.rows[y][x] ?? ' '] ?? null);
  return { w, h, tile };
}

// Walkable ignoring flags and NPCs: anything not solid. Flag-gated water counts as walkable.
function reach(m: MapDef, sx: number, sy: number): Set<string> {
  const { tile } = grid(m);
  const seen = new Set<string>([sx + ',' + sy]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k)) continue;
      const t = tile(nx, ny);
      if (!t || t.solid) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

const adjacent = (r: Set<string>, x: number, y: number) =>
  r.has(x + ',' + y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.has(x + dx + ',' + (y + dy)));

const arrivals = new Map<string, [number, number][]>();
for (const m of Object.values(MAPS)) {
  for (const e of m.exits ?? []) {
    if (!MAPS[e.to]) { warn(`${m.id}: exit to missing map ${e.to}`); continue; }
    const list = arrivals.get(e.to) ?? [];
    list.push([e.tx, e.ty]);
    arrivals.set(e.to, list);
  }
}

for (const m of Object.values(MAPS)) {
  const { w, h, tile } = grid(m);
  m.rows.forEach((r, i) => { if (r.length !== w) warn(`${m.id}: row ${i} has width ${r.length}, expected ${w}`); });
  for (const r of m.rows) for (const ch of r) if (!m.legend[ch]) { warn(`${m.id}: no legend entry for '${ch}'`); break; }
  const arr = arrivals.get(m.id) ?? [];
  for (const [x, y] of arr) {
    const t = tile(x, y);
    if (!t) warn(`${m.id}: arrival ${x},${y} is out of bounds`);
    else if (t.solid) warn(`${m.id}: arrival ${x},${y} is on a solid tile '${m.rows[y][x]}'`);
  }
  const start = arr.find(([x, y]) => tile(x, y) && !tile(x, y)!.solid);
  if (!start) { if (arr.length) warn(`${m.id}: no usable arrival`); continue; }
  const r = reach(m, start[0], start[1]);
  for (const e of m.exits ?? []) {
    let ok = false;
    for (let dx = 0; dx < (e.w ?? 1); dx++) for (let dy = 0; dy < (e.h ?? 1); dy++) if (r.has(e.x + dx + ',' + (e.y + dy))) ok = true;
    if (!ok) warn(`${m.id}: exit to ${e.to} at ${e.x},${e.y} is unreachable from ${start}`);
  }
  for (const n of m.npcs ?? []) {
    if (n.x < 0 || n.y < 0 || n.x >= w || n.y >= h) warn(`${m.id}: npc ${n.id} out of bounds`);
    if (n.talk && !adjacent(r, n.x, n.y)) warn(`${m.id}: npc ${n.id} at ${n.x},${n.y} cannot be reached to talk`);
  }
  for (const tr of m.triggers ?? []) {
    let ok = false;
    for (let dx = 0; dx < (tr.w ?? 1); dx++) for (let dy = 0; dy < (tr.h ?? 1); dy++) if ((tr.touch ? adjacent(r, tr.x + dx, tr.y + dy) : r.has(tr.x + dx + ',' + (tr.y + dy)))) ok = true;
    if (!ok) warn(`${m.id}: trigger at ${tr.x},${tr.y} is unreachable`);
  }
  for (const f of m.ferals ?? []) {
    if (!GROUPS[f.group]) warn(`${m.id}: feral group ${f.group} is missing`);
    else for (const id of GROUPS[f.group]) if (!ENEMIES[id]) warn(`group ${f.group}: enemy ${id} missing`);
    const t = tile(f.x, f.y);
    if (!t || t.solid) warn(`${m.id}: feral at ${f.x},${f.y} stands on a solid tile`);
  }
  for (const d of m.digs ?? []) {
    const t = tile(d.x, d.y);
    if (!t || t.solid) warn(`${m.id}: dig ${d.id} at ${d.x},${d.y} is on a solid tile`);
    else if (!r.has(d.x + ',' + d.y)) warn(`${m.id}: dig ${d.id} is unreachable`);
    if (d.slip && !SLIPS[d.slip]) warn(`${m.id}: dig ${d.id} uses missing slip ${d.slip}`);
    if (d.item && !ITEMS[d.item]) warn(`${m.id}: dig ${d.id} uses missing item ${d.item}`);
  }
}

for (const e of Object.values(ENEMIES)) {
  for (const mv of e.moves) if (!SKILLS[mv.skill]) warn(`enemy ${e.id}: missing skill ${mv.skill}`);
  if (e.kept?.skill && !SKILLS[e.kept.skill]) warn(`enemy ${e.id}: kept skill ${e.kept.skill} missing`);
  if (e.lastWord && !SKILLS[e.lastWord]) warn(`enemy ${e.id}: last word ${e.lastWord} missing`);
}
for (const m of Object.values(MEMBERS)) for (const [, s] of [...m.learn, ...(m.learn2 ?? [])]) if (!SKILLS[s]) warn(`member ${m.id}: missing skill ${s}`);

console.log(problems.length ? problems.join('\n') : 'All maps look connected.');
console.log(`${Object.keys(MAPS).length} maps, ${Object.keys(ENEMIES).length} enemies, ${Object.keys(SLIPS).length} slips.`);
