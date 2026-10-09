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
