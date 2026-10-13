// World reachability for the validator. Ledges go one way, and each key item and each worn type is a lock.
// The story check walks the whole Volute from Gran's door at the start of each chapter, with only what Ouro holds by then, and proves every story place is reachable.
import { G } from '../game/state';
import { isSolid, LEDGE } from '../game/tiles';
import { MAPS, type MapDef } from '../game/world';

/** Maps built or redrawn for the ring round the Lipwater. The validator holds them to the strict checks the newer areas get. */
export const RING_MAPS = ['fellside', 'route1', 'rib', 'knucklebones', 'undermeadow', 'cocklecove', 'brookwood', 'tackhouse', 'shellhouse', 'oldshell', 'ribhouse', 'carverhouse', 'islanderhut',
  'route2', 'mast', 'highwater', 'wrecks', 'stilthouse', 'boathouse', 'route3', 'saltings', 'spire', 'shoutwood', 'ledgerroom', 'route4', 'bole', 'kelpbeds', 'rainhouse', 'route5', 'hum', 'gantry', 'humtrader', 'route6', 'tusk', 'floes', 'tuskhouse', 'route7', 'hilt', 'moonwater', 'shingle', 'smithy',
  'route8', 'fall', 'longway', 'fallhouse', 'gatering',
  // The houses the polish pass opened (src/content/homes.ts).
  'tsweaver', 'tsbaker', 'tscradle', 'ribcarvings', 'ribtwins', 'ribfire', 'mastnets', 'mastshells', 'mastbunks', 'mastkitchen', 'spirehush', 'spirebells',
  'boleroots', 'bolerain', 'bolespoons', 'bolenote', 'bolesnail', 'humparts', 'humhome', 'humhelmet', 'tuskfire', 'tuskcombs', 'hiltbunks', 'hiltwife',
  'hiltbuttons', 'falleast', 'fallcount', 'brookhut'];

/** What opens ground: key items by id, and worn types by name. */
export type Abilities = Set<string>;
const DXY: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Whether ground of this character can be crossed with these abilities. */
export function crossable(ch: string, ab: Abilities): boolean {
  if (LEDGE[ch] !== undefined) return false;
  if (!isSolid(ch)) return true;
  switch (ch) {
    case ':': return ab.has('stilts') || ab.has('TIDE');
    case '%': return ab.has('prisingiron');
    case '@': case 'o': return ab.has('haul');
    case '~': return ab.has('TIDE');
    case 'k': return ab.has('ROOT');
    case 'm': return ab.has('GEAR');
    case 'z': case 'Z': return ab.has('STONE');
    case 'l': return ab.has('BEAST');
    case 'Y': return ab.has('SALT');
    case 'M': return ab.has('VOID');
  }
  return false;
}

/** A map's tiles as the story state shows them now: rows, story mods, crazes from pulled Stays, and prised crusts. */
export function gridOf(m: MapDef): string[][] {
  const g = m.rows.map(r => r.split('').map(ch => (ch >= '1' && ch <= '8' ? (G.pulled.length >= Number(ch) ? 'z' : '.') : ch)));
  for (const md of m.mods || []) if (md.when()) for (let k = 0; k < (md.w || 1); k++) if (g[md.y]?.[md.x + k] !== undefined) g[md.y][md.x + k] = md.ch;
  // A basin's holes are crossed by rolling stones into them with the haul. Its own solver checks that this can be done.
  const b = m.basin;
  if (b) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (g[y]?.[x] === 'O') g[y][x] = '@';
  return g;
}

/**
 * Every tile reachable from a start, across maps, by walking, hopping down ledges, sliding on ice, and taking warps whose story test passes now.
 * People who show now block their tile, except sleepers when Ouro holds the jingle. Returns a set of "map:x,y".
 */
export function walkWorld(starts: [string, number, number][], ab: Abilities): Set<string> {
  const grids = new Map<string, string[][]>();
  const blocked = new Map<string, Set<number>>();
  const warpsAt = new Map<string, Map<number, [string, number, number]>>();
  const setup = (id: string) => {
    if (grids.has(id)) return;
    const m = MAPS[id];
    const g = gridOf(m), W = m.rows[0].length;
    grids.set(id, g);
    const b = new Set<number>();
    for (const n of m.npcs) {
      if (n.when && !n.when()) continue;
      if (n.sleeper && (G.flags[n.sleeper.flag] || ab.has('jingle'))) continue;
      if (n.ghost) continue;
      b.add(n.y * W + n.x);
    }
    blocked.set(id, b);
    const w = new Map<number, [string, number, number]>();
    for (const wp of m.warps) if (!wp.when || wp.when()) if (!w.has(wp.y * W + wp.x)) w.set(wp.y * W + wp.x, [wp.to, wp.tx, wp.ty]);
    warpsAt.set(id, w);
  };
  const seen = new Set<string>();
  const queue: [string, number, number][] = [];
  for (const s of starts) queue.push(s);
  while (queue.length) {
    let [id, x, y] = queue.pop()!;
    if (!MAPS[id]) continue;
    setup(id);
    const W = MAPS[id].rows[0].length;
    // Arriving on a warp sends Ouro on at once.
    for (let hops = 0; hops < 4; hops++) {
      const wp = warpsAt.get(id)!.get(y * W + x);
      if (!wp || !MAPS[wp[0]]) break;
      seen.add(`${id}:${x},${y}`);
      [id, x, y] = wp;
      setup(id);
    }
    const g = grids.get(id)!, b = blocked.get(id)!, Wn = g[0].length, H = g.length;
    const key = `${id}:${x},${y}`;
    if (seen.has(key)) continue;
    const free = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < Wn && ty < H && crossable(g[ty][tx], ab) && !b.has(ty * Wn + tx);
    if (!free(x, y) && !starts.some(s => s[0] === id && s[1] === x && s[2] === y)) continue;
    seen.add(key);
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DXY[d];
      let nx = x + dx, ny = y + dy;
      const ch = g[ny]?.[nx];
      if (ch === undefined) continue;
      if (LEDGE[ch] !== undefined) {
        if (LEDGE[ch] === d && free(nx + dx, ny + dy)) queue.push([id, nx + dx, ny + dy]);
        continue;
      }
      if (!free(nx, ny)) continue;
      while (g[ny][nx] === 'I' && free(nx + dx, ny + dy)) { nx += dx; ny += dy; }
      queue.push([id, nx, ny]);
    }
  }
  return seen;
}

/** Whether a tile, or a tile next to it, was reached, so a person standing there can be talked to. */
export function reachedNear(seen: Set<string>, id: string, x: number, y: number): boolean {
  if (seen.has(`${id}:${x},${y}`)) return true;
  return DXY.some(([dx, dy]) => seen.has(`${id}:${x + dx},${y + dy}`));
}

export function reachedMap(seen: Set<string>, id: string): boolean {
  for (const k of seen) if (k.startsWith(id + ':')) return true;
  return false;
}

// ---------------------------------------------------------------- the story in chapter order

/** A story place: a whole map, or a person or tile on one (reached when Ouro can stand on it or next to it). */
type Place = string | [string, number, number] | { npc: string; map: string };

interface Chapter {
  ch: number;
  /** Pearls held when the chapter starts. */
  pearls: string[];
  /** Stays pulled by then, the most a run can have pulled. Each one adds its crazes. */
  pulled: string[];
  /** Story flags set before the chapter starts. */
  flags: string[];
  /** Key items held when the chapter starts. Worn types are never assumed: the story must not need one. */
  keys: string[];
  /** Places the chapter's story needs. */
  places: Place[];
}

/** Each chapter's state builds on the one before. */
export const STORY: Chapter[] = [
  { ch: 1, pearls: [], pulled: [], flags: ['morning', 'slipday', 'night', 'starter', 'crowdGone', 'visited_fellside'], keys: ['register'],
    places: ['route1', 'rib', 'ribgym', 'fellmonger', { npc: 'tanner', map: 'rib' }] },
  { ch: 2, pearls: ['rib'], pulled: [], flags: ['tack1', 'peelers', 'wellingGone', 'notions'], keys: ['prisingiron'],
    places: ['route2', 'mast', 'mastgym', 'highwater', { npc: 'master', map: 'wrecks' }] },
  { ch: 3, pearls: ['mast'], pulled: ['mast'], flags: ['mastFell', 'mastDug', 'mastDusk', 'nerve', 'tack2'], keys: [],
    places: [{ npc: 'stiltmaker', map: 'stilthouse' }, 'route3', 'spire', 'spiregym'] },
  { ch: 4, pearls: ['spire'], pulled: [], flags: ['fitting'], keys: ['stilts'],
    places: ['saltings', 'shoutwood', 'route4', 'bole', 'bolegym'] },
  { ch: 5, pearls: ['bole'], pulled: ['bole'], flags: ['bolePulled'], keys: ['jingle'],
    places: ['kelpbeds', 'route5', 'hum', 'humgym'] },
  { ch: 6, pearls: ['pylon'], pulled: ['pylon'], flags: ['wearing', 'bareBeaten', 'ch5done', 'charms'], keys: ['letter'],
    places: ['gantry', 'route6', 'tusk', 'tuskgym'] },
  { ch: 7, pearls: ['tusk'], pulled: ['tusk'], flags: ['chose_tusk'], keys: [],
    places: ['floes', { npc: 'rememberer', map: 'tuskhouse' }, 'route7', 'hilt', 'hiltgym', 'peelhouse'] },
  { ch: 8, pearls: ['hilt'], pulled: ['hilt'], flags: ['pithBeaten', 'chose_hilt', 'fullCaught', 'fullDone'], keys: ['haul'],
    places: ['shingle', 'moonwater', 'route8', 'fall', 'fallgym', 'glassdesert', 'longway', { npc: 'keywoman', map: 'fallhouse' }] },
  { ch: 9, pearls: ['fall'], pulled: [], flags: ['chose_fall'], keys: [],
    places: ['climb'] },
];

// ---------------------------------------------------------------- field puzzles

/** Solvers for the field puzzles. Each proves its layout can be solved, and where the design asks, that only one way works. Returns how many it checked. */
export function checkPuzzles(fail: (s: string) => void): number {
  let n = 0;
  // Puzzle 2, the counting stones: exactly one chain of neighboring stones runs from one to seven, bank to bank.
  {
    n++;
    const stones = PUZZLE_DATA.countingStones;
    const m = MAPS.brookwood;
    const at = (x: number, y: number) => stones[`${x},${y}`] || 0;
    const ground = (x: number, y: number) => { const ch = m.rows[y]?.[x]; return !!ch && !isSolid(ch) && !at(x, y); };
    let chains = 0;
    const walk = (x: number, y: number, v: number, from: string): void => {
      if (v === 7) { if (DXY.some(([dx, dy]) => ground(x + dx, y + dy) && x + dx > 31)) chains++; return; }
      for (const [dx, dy] of DXY) if (at(x + dx, y + dy) === v + 1) walk(x + dx, y + dy, v + 1, from);
    };
    for (const k of Object.keys(stones)) {
      const [x, y] = k.split(',').map(Number);
      if (stones[k] === 1 && DXY.some(([dx, dy]) => ground(x + dx, y + dy) && x + dx < 27)) walk(x, y, 1, k);
    }
    if (chains !== 1) fail(`puzzle 2: ${chains} chains of counting stones cross the brook, expected 1`);
  }
  for (const p of PUZZLE_DATA.extra) { n++; const why = p(); if (why) fail(why); }
  for (const p of WALK_PUZZLES) { n++; for (const why of checkGraph(walkGraph(p))) fail(why); }
  for (const p of GRAPH_PUZZLES) { n++; for (const why of checkGraph(p)) fail(why); }
  return n;
}

/** Puzzle layouts that content registers for the solvers. */
export const PUZZLE_DATA: { countingStones: Record<string, number>; extra: (() => string | null)[] } = { countingStones: {}, extra: [] };

/** Walks the Volute at the start of each chapter with what Ouro holds by then, and reports each story place it cannot reach. */
/** Each gate of the Gate Ring by its flag, and the gatekeeper on its outer side who opens it. */
const GATE_KEEPERS: [string, string, string][] = [['gate_s', 'brookwood', 'gatekeeper_s'], ['gate_w', 'shoutwood', 'gatekeeper_w'], ['gate_n', 'route5', 'gatekeeper_n'], ['gate_e', 'moonwater', 'gatekeeper_e']];

export function checkStory(fail: (s: string) => void): number {
  const save = { scales: G.scales, pulled: G.pulled, flags: G.flags, keys: G.keys };
  const pearls: string[] = [], pulled: string[] = [], keys: string[] = [];
  const flags: Record<string, number> = {};
  let checked = 0;
  try {
    for (const c of STORY) {
      pearls.push(...c.pearls); pulled.push(...c.pulled); keys.push(...c.keys);
      for (const f of c.flags) flags[f] = 1;
      G.scales = pearls.slice(); G.pulled = pulled.slice(); G.keys = keys.slice(); G.flags = { ...flags };
      const seen = walkWorld([['home', 4, 6]], new Set(keys));
      for (const p of c.places) {
        checked++;
        const ok = typeof p === 'string' ? reachedMap(seen, p)
          : Array.isArray(p) ? reachedNear(seen, p[0], p[1], p[2])
            : (() => { const n = MAPS[p.map]?.npcs.find(q => q.id === p.npc); return !!n && reachedNear(seen, p.map, n.x, n.y); })();
        if (!ok) fail(`story: chapter ${c.ch} cannot reach ${typeof p === 'string' ? p : Array.isArray(p) ? p.join(' ') : p.map + ' ' + p.npc} with ${keys.join(', ') || 'no key items'}`);
      }
      // Every gate whose gatekeeper Ouro can reach with the letter is opened, and the Gate Ring must then lead nowhere new.
      if (!keys.includes('letter')) continue;
      const opened = GATE_KEEPERS.filter(([, map, id]) => { const n = MAPS[map]?.npcs.find(q => q.id === id); return !!n && reachedNear(seen, map, n.x, n.y); });
      if (!opened.length) continue;
      for (const [f] of opened) G.flags[f] = 1;
      checked++;
      const wide = walkWorld([['home', 4, 6]], new Set(keys));
      if (!reachedMap(wide, 'gatering')) fail(`story: chapter ${c.ch} opens ${opened.map(g => g[0]).join(', ')} but cannot reach the Gate Ring`);
      const before = new Set([...seen].map(k => k.split(':')[0]));
      for (const id of new Set([...wide].map(k => k.split(':')[0]))) if (id !== 'gatering' && !before.has(id)) fail(`story: chapter ${c.ch} reaches ${id} early through the Gate Ring`);
    }
  } finally {
    G.scales = save.scales; G.pulled = save.pulled; G.flags = save.flags; G.keys = save.keys;
  }
  return checked;
}

// ---------------------------------------------------------------- puzzle checks

/** One move in a puzzle's graph of states. Walking plain ground costs 0, and a move that changes the puzzle costs 1. */
export interface Move<S> {
  to: S;
  cost: number;
  /** The walk out of the door and back in, which puts the puzzle back as it started. */
  reset?: boolean;
  /** A free move that cannot be walked back, such as a ring that counts. It joins no places. */
  oneWay?: boolean;
}

/** A puzzle as a graph of states. checkGraph holds it to the checks in Notes/puzzle-design.md. */
export interface GraphPuzzle<S> {
  name: string;
  /** The fewest moves the chapter asks for. */
  floor: number;
  start: S;
  key: (s: S) => string | number;
  moves: (s: S) => Move<S>[];
  goal: (s: S) => boolean;
  /** States the player leaves the puzzle from. Every state must be able to reach one. */
  exit?: (s: S) => boolean;
  /** Move sets that must not reach the goal: the puzzle's own mechanic taken away, or an ability that would go round it. */
  without?: [string, (s: S) => Move<S>[]][];
  /** How a state reads in a failure message. */
  show?: (s: S) => string;
  maxPlaces?: number;
  /** The reward the puzzle is for, where the player stands when the puzzle starts, and who names the reward if it is out of sight. */
  prize: Prize;
}

/** A puzzle's reward: its tile and map, the tile the player sees it from, and the person or sign that names it when it is out of sight. */
export interface Prize { map?: string; at: [number, number]; view: [number, number]; named?: string }

/** Whether a tile is on the screen while Ouro stands at `view`, with the camera the field uses. */
export function inView(mapId: string, view: [number, number], at: [number, number]): boolean {
  const m = MAPS[mapId];
  const W = m.rows[0].length, H = m.rows.length;
  const cam = (v: number, size: number, off: number) => (size * 8 <= 192 ? (size * 8 - 192) / 2 : Math.max(-8, Math.min(size * 8 - 192 + 8, v * 8 + 4 - off)));
  const cx = cam(view[0], W, 96), cy = cam(view[1], H, 92);
  return at[0] * 8 >= cx && at[0] * 8 + 8 <= cx + 192 && at[1] * 8 >= cy && at[1] * 8 + 8 <= cy + 192;
}

/** Content registers its puzzles here. Puzzles solved only by walking Ouro use WALK_PUZZLES, which builds the graph. */
export const GRAPH_PUZZLES: GraphPuzzle<any>[] = [];

export interface GraphResult {
  /** Fewest moves to the goal, or -1. */
  best: number;
  /** Every state reached, and the places they make once free walking joins them. */
  states: number;
  places: number;
  /** States that cannot reach the goal, and states that cannot reach the way out. */
  dead: string[];
  stuck: string[];
  /** The median moves a random player makes before the goal, over a fixed set of runs. */
  random: number;
  /** The states along one shortest solution. */
  path: unknown[];
}

/** Searches a puzzle's graph with every move from every reachable state. Walking is free and every other move costs one. */
export function solveGraph<S>(p: GraphPuzzle<S>, moves: (s: S) => Move<S>[] = p.moves, runs = 101): GraphResult {
  const ids = new Map<string | number, number>();
  const states: S[] = [];
  const edges: [number, number, boolean][][] = [];
  const id = (s: S) => { const k = p.key(s); let i = ids.get(k); if (i === undefined) { i = states.length; ids.set(k, i); states.push(s); } return i; };
  const s0 = id(p.start);
  const cost: number[] = [0];
  const prev: number[] = [-1];
  // Buckets by cost: every move costs 0 or 1, so the buckets are processed in order.
  const buckets: number[][] = [[s0]];
  for (let c = 0; c < buckets.length; c++) {
    const b = buckets[c];
    for (let j = 0; j < b.length; j++) {
      const i = b[j];
      if (cost[i] !== c || edges[i]) continue;
      edges[i] = [];
      for (const m of moves(states[i])) {
        const t = id(m.to), nc = c + m.cost;
        edges[i].push([t, m.cost, !!m.reset || !!m.oneWay]);
        if (cost[t] !== undefined && cost[t] <= nc) continue;
        cost[t] = nc; prev[t] = i;
        (buckets[nc] ||= []).push(t);
      }
    }
  }
  const n = states.length;
  let best = Infinity, bestI = -1;
  for (let i = 0; i < n; i++) if (p.goal(states[i]) && cost[i] < best) { best = cost[i]; bestI = i; }
  const back: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) for (const [t] of edges[i] || []) back[t].push(i);
  const reaching = (target: (s: S) => boolean) => {
    const ok = new Uint8Array(n);
    const q: number[] = [];
    for (let i = 0; i < n; i++) if (target(states[i])) { ok[i] = 1; q.push(i); }
    while (q.length) for (const pi of back[q.pop()!]) if (!ok[pi]) { ok[pi] = 1; q.push(pi); }
    return ok;
  };
  const show = (i: number) => (p.show ? p.show(states[i]) : String(p.key(states[i])));
  const win = reaching(p.goal);
  const dead: string[] = [];
  for (let i = 0; i < n; i++) if (!win[i]) dead.push(show(i));
  const stuck: string[] = [];
  if (p.exit) { const out = reaching(p.exit); for (let i = 0; i < n; i++) if (!out[i]) stuck.push(show(i)); }
  // Places: states joined by free walking. A random player moves to one of the places a single move reaches.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < n; i++) for (const [t, c, reset] of edges[i] || []) if (!c && !reset) parent[find(i)] = find(t);
  const next = new Map<number, Set<number>>();
  const goalPlace = new Set<number>();
  for (let i = 0; i < n; i++) {
    const pl = find(i);
    if (!next.has(pl)) next.set(pl, new Set());
    if (p.goal(states[i])) goalPlace.add(pl);
    for (const [t] of edges[i] || []) { const tp = find(t); if (tp !== pl) next.get(pl)!.add(tp); }
  }
  const lists = new Map([...next].map(([k, v]) => [k, [...v]]));
  let seed = 20261010;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) / 16777216; };
  const cap = Math.max(2000, (best === Infinity ? 20 : best) * 100);
  const tries: number[] = [];
  for (let t = 0; t < runs && best !== Infinity; t++) {
    let pl = find(s0), k = 0;
    while (!goalPlace.has(pl) && k < cap) { const o = lists.get(pl) || []; if (!o.length) { k = cap; break; } pl = o[Math.floor(rnd() * o.length)]; k++; }
    tries.push(k);
  }
  tries.sort((a, b) => a - b);
  const path: unknown[] = [];
  for (let i = bestI; i >= 0; i = prev[i]) path.unshift(states[i]);
  return { best: best === Infinity ? -1 : best, states: n, places: next.size, dead, stuck, random: tries.length ? tries[Math.floor(tries.length / 2)] : 0, path };
}

/** Holds a puzzle to the checks in Notes/puzzle-design.md, prints its numbers, and returns what failed. */
export function checkGraph<S>(p: GraphPuzzle<S>, mapId?: string): string[] {
  const out: string[] = [];
  const pm = p.prize.map || mapId;
  if (!pm || !MAPS[pm]) out.push(`${p.name}: its prize names no map`);
  else if (p.prize.named) { if (!MAPS[pm].npcs.some(n => n.id === p.prize.named) && !Object.values(MAPS).some(m => m.npcs.some(n => n.id === p.prize.named))) out.push(`${p.name}: nobody called ${p.prize.named} names its prize`); }
  else if (!inView(pm, p.prize.view, p.prize.at)) out.push(`${p.name}: its prize at ${p.prize.at.join(',')} is out of sight from ${p.prize.view.join(',')}`);
  const r = solveGraph(p);
  // PUZZLE_ROUTE=<name> prints that puzzle's shortest route, for working on a layout.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  if (env?.PUZZLE_ROUTE === p.name && p.show) console.log(r.path.map(s => p.show!(s as S)).join('\n'));
  const max = p.maxPlaces ?? 1500;
  if (r.best < 0) out.push(`${p.name}: cannot be solved`);
  else if (r.best < p.floor) out.push(`${p.name}: solved in ${r.best} moves, under the floor of ${p.floor}`);
  if (r.dead.length) out.push(`${p.name}: ${r.dead.length} states cannot reach the goal, such as ${r.dead[0]}`);
  if (r.stuck.length) out.push(`${p.name}: ${r.stuck.length} states cannot get back out, such as ${r.stuck[0]}`);
  if (r.places > max) out.push(`${p.name}: ${r.places} places to stop, over ${max}`);
  if (r.best > 0 && r.random < r.best * 10) out.push(`${p.name}: random play solves it in ${r.random} moves, under ten times ${r.best}`);
  for (const [why, moves] of p.without || []) if (solveGraph(p, moves, 0).best >= 0) out.push(`${p.name}: still solvable ${why}`);
  console.log(`  ${p.name}: ${r.best} moves, ${r.places} places, ${r.states} states, random play ${r.random}`);
  return out;
}

// ---------------------------------------------------------------- puzzles walked the way Ouro walks

/** A puzzle solved by moving Ouro: presses that walk, slide on ice, ride gusts, and hop ledges, and switches that flip flags. */
export interface WalkPuzzle {
  name: string;
  map: string;
  /** Where Ouro comes in. */
  start: [number, number];
  /** Where Ouro must come to rest. */
  goal: (x: number, y: number) => boolean;
  /** The fewest moves the chapter asks for. */
  floor: number;
  /** Flags the switches flip between 0 and 1, and the solid tiles Ouro faces to flip each one. */
  switches?: { flag: string; at: [number, number][] }[];
  /** Flags that flip when Ouro comes to rest on one of their tiles. */
  plates?: { flag: string; at: [number, number][] }[];
  /** Key items held, and worn types Ouro may put on and take off at will. */
  keys?: string[];
  wear?: string[];
  /** Tile characters that are solid here though they are not elsewhere, such as live current. */
  solid?: string;
  /** Tiles where walking out of the door and back in puts every flag back to 0 and Ouro back at the start. */
  resets?: [number, number][];
  /** Tiles Ouro must be able to reach again from every state, so the puzzle can always be left. */
  exits?: [number, number][];
  /** Changes that must leave the puzzle unsolvable: gusts turned to walls, gusts turned to ice, ice turned to walls, or the switches fixed. */
  needs?: ('gusts' | 'gustsIce' | 'ice' | 'switches')[];
  maxPlaces?: number;
  /** The reward the puzzle is for. Its map defaults to the puzzle's own. */
  prize: Prize;
}

/** Content registers its walk puzzles here, and checkPuzzles holds each to the checks in Notes/puzzle-design.md. */
export const WALK_PUZZLES: WalkPuzzle[] = [];

const GUSTS = 'SENW';
const slick = (ch: string | undefined) => ch === 'I' || (!!ch && GUSTS.includes(ch));
type Variant = 'gusts' | 'gustsIce' | 'ice' | 'switches' | null;

/**
 * One press as Field.update and Field.arrive play it on a grid of tiles: a ledge hop, then ice slides and gust pushes until
 * Ouro comes to rest. Returns the resting tile and how many tiles Ouro covered, or null for a bump or a push that loops.
 */
export function fieldPress(g: string[][], x: number, y: number, d: number, pass: (x: number, y: number) => boolean, beast = false): [number, number, number] | null {
  let nx = x + DXY[d][0], ny = y + DXY[d][1];
  const ch = g[ny]?.[nx];
  if (ch === undefined) return null;
  const drop = LEDGE[ch];
  if (drop !== undefined) {
    if (drop !== d && !((drop + 2) % 4 === d && beast)) return null;
    nx += DXY[d][0]; ny += DXY[d][1];
  }
  if (!pass(nx, ny)) return null;
  let moved = Math.abs(nx - x) + Math.abs(ny - y), dir = d;
  const seen = new Set<number>();
  for (;;) {
    const k = (ny * 4096 + nx) * 4 + dir;
    if (seen.has(k)) return null;
    seen.add(k);
    const c = g[ny][nx];
    const step = c === 'I' ? dir : GUSTS.indexOf(c);
    if (step < 0) break;
    const tx = nx + DXY[step][0], ty = ny + DXY[step][1];
    if (!pass(tx, ty)) break;
    dir = step; nx = tx; ny = ty; moved++;
  }
  return [nx, ny, moved];
}

/** The moves of a walk puzzle as Field.update and Field.arrive play them. States are numbers: tile, flags, and what Ouro wears. */
function walkMoves(p: WalkPuzzle, variant: Variant): { moves: (k: number) => Move<number>[]; start: number; at: (k: number) => [number, number, number, number]; wears: (string | null)[] } {
  const m = MAPS[p.map];
  const W = m.rows[0].length, H = m.rows.length;
  const sw = [...(variant === 'switches' ? [] : p.switches || []), ...(p.plates || [])];
  const nSw = variant === 'switches' ? 0 : (p.switches || []).length;
  const wears: (string | null)[] = [null, ...(p.wear || [])];
  const abil = wears.map(w => new Set([...(p.keys || []), ...(w ? [w] : [])]));
  const grids: string[][][] = [], blocks: Set<number>[] = [];
  const saved = G.flags;
  try {
    for (let bits = 0; bits < 1 << sw.length; bits++) {
      G.flags = { ...saved };
      sw.forEach((s, i) => { G.flags[s.flag] = (bits >> i) & 1; });
      const g = gridOf(m);
      for (const r of g) for (let x = 0; x < W; x++) {
        if (GUSTS.includes(r[x]) && (variant === 'gusts' || variant === 'gustsIce')) r[x] = variant === 'gusts' ? '#' : 'I';
        else if (r[x] === 'I' && variant === 'ice') r[x] = '#';
        else if (p.solid?.includes(r[x])) r[x] = '#';
      }
      grids.push(g);
      const b = new Set<number>();
      for (const n of m.npcs) if ((!n.when || n.when()) && !n.ghost && !(n.sleeper && G.flags[n.sleeper.flag])) b.add(n.y * W + n.x);
      blocks.push(b);
    }
  } finally {
    G.flags = saved;
  }
  const NW = wears.length;
  const key = (x: number, y: number, bits: number, wi: number) => ((bits * NW + wi) * H + y) * W + x;
  const at = (k: number): [number, number, number, number] => { const x = k % W, r = Math.floor(k / W), y = r % H, r2 = Math.floor(r / H); return [x, y, Math.floor(r2 / NW), r2 % NW]; };
  const pass = (bits: number, wi: number, x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && crossable(grids[bits][y][x], abil[wi]) && !blocks[bits].has(y * W + x);
  const press = (x: number, y: number, d: number, bits: number, wi: number) =>
    fieldPress(grids[bits], x, y, d, (tx, ty) => pass(bits, wi, tx, ty), abil[wi].has('BEAST'));
  const isReset = (x: number, y: number) => !!p.resets?.some(([a, b]) => a === x && b === y);
  const plateFlip = (x: number, y: number) => {
    let f = 0;
    (p.plates || []).forEach((pl, i) => { if (pl.at.some(([a, b]) => a === x && b === y)) f |= 1 << (nSw + i); });
    return f;
  };
  const moves = (k: number): Move<number>[] => {
    const [x, y, bits, wi] = at(k);
    const out: Move<number>[] = [];
    for (let d = 0; d < 4; d++) {
      const r = press(x, y, d, bits, wi);
      if (!r) continue;
      const flip = plateFlip(r[0], r[1]);
      const cost = slick(grids[bits][y][x]) || slick(grids[bits][r[1]][r[0]]) || r[2] > 1 || flip ? 1 : 0;
      out.push({ to: key(r[0], r[1], bits ^ flip, wi), cost });
    }
    // A switch never closes the tile Ouro stands on, as a sapling's root will not grow through Ouro.
    if (variant !== 'switches') (p.switches || []).forEach((s, i) => { if (s.at.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1) && pass(bits ^ (1 << i), wi, x, y)) out.push({ to: key(x, y, bits ^ (1 << i), wi), cost: 1 }); });
    for (let w = 0; w < NW; w++) if (w !== wi) out.push({ to: key(x, y, bits, w), cost: 0 });
    if (isReset(x, y)) out.push({ to: key(p.start[0], p.start[1], 0, wi), cost: 0, reset: true });
    return out;
  };
  return { moves, start: key(p.start[0], p.start[1], 0, 0), at, wears };
}

/** A walk puzzle as a graph puzzle, with the changes it needs to fail as move sets that must not reach the goal. */
export function walkGraph(p: WalkPuzzle): GraphPuzzle<number> {
  const base = walkMoves(p, null);
  const label: Record<string, string> = { gusts: 'with the gusts as walls', gustsIce: 'with the gusts as ice', ice: 'without stepping on the ice', switches: 'with the switches fixed' };
  return {
    name: p.name, floor: p.floor, start: base.start, key: k => k, moves: base.moves,
    goal: k => { const [x, y] = base.at(k); return p.goal(x, y); },
    exit: p.exits ? k => { const [x, y] = base.at(k); return p.exits!.some(([a, b]) => a === x && b === y); } : undefined,
    without: (p.needs || []).map(v => [label[v], walkMoves(p, v).moves]),
    show: k => { const [x, y, bits, wi] = base.at(k); return `${x},${y}${bits ? ' flags ' + bits : ''}${wi ? ' wearing ' + base.wears[wi] : ''}`; },
    maxPlaces: p.maxPlaces,
    prize: { map: p.map, ...p.prize },
  };
}

/** The tiles where the walk puzzles on a map come to rest at their goals, so a flood that cannot play a puzzle can start there. */
export function puzzleReach(mapId: string): [number, number][] {
  const m = MAPS[mapId];
  if (!m) return [];
  const W = m.rows[0].length, H = m.rows.length;
  const out: [number, number][] = [];
  for (const p of WALK_PUZZLES) {
    if (p.map !== mapId) continue;
    const g = walkGraph(p);
    const end = solveGraph(g, g.moves, 0).path.at(-1);
    if (typeof end === 'number') out.push([end % W, Math.floor(end / W) % H]);
  }
  return out;
}
