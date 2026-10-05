import { Rng } from './rng';
import type { ChapterDef } from '../story/types';

export interface Tile {
  k: string;
  solid: boolean;
}

export interface Gate { x: number; y: number; beat: number }
export interface Spot { x: number; y: number }
export interface MapNpc { id: string; x: number; y: number }
export interface MapChest { x: number; y: number; idx: number }

export interface MapData {
  w: number;
  h: number;
  grid: Tile[][];
  start: Spot;
  roomCenter: Spot[];
  beatSpot: Spot[];
  gates: Gate[];
  npcs: MapNpc[];
  chests: MapChest[];
  saves: Spot[];
  shop: Spot;
  inn: Spot;
  exit: Spot;
  roomOf: (x: number, y: number) => number;
}

const CW = 10;
const CH = 8;
const ORDER: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
const NONSOLID = new Set(['flower', 'mark', 'web', 'pool2']);

export function generateMap(ch: ChapterDef, seed = ch.seed): MapData {
  for (let attempt = 0; attempt < 40; attempt++) {
    const m = tryGenerate(ch, seed + attempt * 101);
    if (m) return m;
  }
  throw new Error(`mapgen failed for chapter ${ch.id}`);
}

function tryGenerate(ch: ChapterDef, seed: number): MapData | null {
  const rng = new Rng(seed);
  const w = CW * 3, h = CH * 3;
  const grid: Tile[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ k: 'wall', solid: true })));
  const rooms = ORDER.map(([cx, cy]) => ({ cx, cy, x0: cx * CW + 1, y0: cy * CH + 1, x1: cx * CW + CW - 2, y1: cy * CH + CH - 2 }));
  const center = rooms.map((r) => ({ x: Math.floor((r.x0 + r.x1) / 2), y: Math.floor((r.y0 + r.y1) / 2) }));
  for (const r of rooms) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) grid[y][x] = { k: 'floor', solid: false };

  // Vault in the middle cell, reachable from room 8.
  const vault = { x0: CW + 1, y0: CH + 1, x1: CW + CW - 2, y1: CH + CH - 2 };
  for (let y = vault.y0; y <= vault.y1; y++) for (let x = vault.x0; x <= vault.x1; x++) grid[y][x] = { k: 'floor', solid: false };

  const gates: Gate[] = [];
  const carve = (x: number, y: number) => { grid[y][x] = { k: 'floor', solid: false }; };
  const link = (a: [number, number], b: [number, number], beat: number) => {
    const horiz = a[1] === b[1];
    if (horiz) {
      const lo = Math.min(a[0], b[0]);
      const xe = lo * CW + CW - 1;
      for (const y of [a[1] * CH + 3, a[1] * CH + 4]) {
        carve(xe, y); carve(xe + 1, y);
        if (beat > 0) { const gx = b[0] > a[0] ? xe + 1 : xe; grid[y][gx] = { k: 'gate', solid: true }; gates.push({ x: gx, y, beat }); }
      }
    } else {
      const lo = Math.min(a[1], b[1]);
      const ye = lo * CH + CH - 1;
      for (const x of [a[0] * CW + 4, a[0] * CW + 5]) {
        carve(x, ye); carve(x, ye + 1);
        if (beat > 0) { const gy = b[1] > a[1] ? ye + 1 : ye; grid[gy][x] = { k: 'gate', solid: true }; gates.push({ x, y: gy, beat }); }
      }
    }
  };
  // Room k opens once beat k-1... gate into room i+1 opens after beat i completes.
  for (let i = 0; i < 7; i++) link(ORDER[i], ORDER[i + 1], i + 1);
  link(ORDER[7], ORDER[0], 7); // return path to the start room
  // Vault link from room 8 (left cell column, middle row) to the center cell.
  for (const y of [CH + 3, CH + 4]) { carve(CW - 1, y); carve(CW, y); }

  const free = (x: number, y: number) => grid[y][x].k === 'floor';
  const reserved = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const reserve = (x: number, y: number, r = 0) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) reserved.add(key(x + i, y + j)); };
  for (const c of center) reserve(c.x, c.y, 1);
  // Keep door approaches clear.
  for (const r of rooms) {
    for (const [dx, dy] of [[r.x0, (r.y0 + r.y1) >> 1], [r.x1, (r.y0 + r.y1) >> 1], [(r.x0 + r.x1) >> 1, r.y0], [(r.x0 + r.x1) >> 1, r.y1]]) reserve(dx, dy, 1);
  }
  for (let y = vault.y0; y <= vault.y1; y++) for (let x = vault.x0; x <= vault.x0 + 1; x++) reserve(x, y);

  const solidDeco = ch.theme.deco.filter((d) => !NONSOLID.has(d));
  const soft = ch.theme.deco.filter((d) => NONSOLID.has(d));
  const put = (x: number, y: number, kind: string) => {
    if (!free(x, y) || reserved.has(key(x, y))) return false;
    grid[y][x] = { k: kind, solid: !NONSOLID.has(kind) };
    return true;
  };
  const allRooms = [...rooms, { cx: 1, cy: 1, ...vault }];
  allRooms.forEach((r, idx) => {
    if (idx === 0) { /* home stays open for shop and inn */ }
    const style = rng.int(4);
    const kind = rng.pick(solidDeco.length ? solidDeco : ['rock']);
    if (style === 0) for (let i = 0; i < 7; i++) put(rng.int(r.x1 - r.x0 + 1) + r.x0, rng.int(r.y1 - r.y0 + 1) + r.y0, kind);
    else if (style === 1) { for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1], [r.x0 + 2, r.y0 + 1], [r.x1 - 2, r.y1 - 1]]) put(x, y, kind); }
    else if (style === 2) for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) { put(x, r.y0 + 1, kind); put(x, r.y1 - 1, kind); }
    else { const px = r.x0 + 1 + rng.int(2), py = r.y0 + 1 + rng.int(2); for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) put(px + i, py + j, 'pool'); }
    for (let i = 0; i < 4 && soft.length; i++) put(rng.int(r.x1 - r.x0 + 1) + r.x0, rng.int(r.y1 - r.y0 + 1) + r.y0, rng.pick(soft));
  });

  // Specials.
  const home = rooms[0];
  const shop = { x: home.x0 + 1, y: home.y0 };
  const inn = { x: home.x1 - 1, y: home.y0 };
  grid[shop.y][shop.x] = { k: 'shop', solid: true };
  grid[inn.y][inn.x] = { k: 'inn', solid: true };
  const saves: Spot[] = [];
  const saveAt = (ri: number, dx: number, dy: number) => { const r = rooms[ri]; const s = { x: r.x0 + dx, y: r.y0 + dy }; grid[s.y][s.x] = { k: 'save', solid: true }; saves.push(s); return s; };
  saveAt(0, 4, 0);
  saveAt(4, 0, 0);
  saveAt(3, 6, 5);
  const exit = { x: home.x0 + 3, y: home.y1 };
  grid[exit.y][exit.x] = { k: 'floor', solid: false };

  // Beat triggers (beat 1 fires automatically on arrival).
  const beatSpot: Spot[] = ch.beats.map((b) => {
    const c = center[b.room - 1];
    return { x: c.x, y: c.y };
  });
  // Beats that share a room are offset.
  const used = new Set<string>();
  beatSpot.forEach((s, i) => {
    while (used.has(key(s.x, s.y))) s.x += 1;
    used.add(key(s.x, s.y));
    grid[s.y][s.x] = { k: 'floor', solid: false };
    reserved.add(key(s.x, s.y));
    void i;
  });

  // NPCs and chests.
  const spotIn = (roomNo: number, salt: number): Spot => {
    const r = roomNo === 9 ? { ...vault } : rooms[roomNo - 1];
    for (let t = 0; t < 60; t++) {
      const x = r.x0 + 1 + ((salt * 3 + t * 5) % Math.max(1, r.x1 - r.x0 - 1));
      const y = r.y0 + 1 + ((salt * 7 + t * 3) % Math.max(1, r.y1 - r.y0 - 1));
      if (free(x, y) && !reserved.has(key(x, y)) && !used.has(key(x, y))) { used.add(key(x, y)); return { x, y }; }
    }
    return { x: r.x0 + 1, y: r.y0 + 1 };
  };
  const npcs = ch.npcs.map((n, i) => ({ id: n.id, ...spotIn(n.room, i + 1) }));
  const chests = ch.chests.map((c, i) => {
    const s = spotIn(c.room, i + 11);
    grid[s.y][s.x] = { k: 'chest', solid: true };
    return { ...s, idx: i };
  });
  // Signs are implicit: NPC ids beginning with "sign" render as sign tiles.

  const start = { x: exit.x, y: exit.y - 1 };

  const roomOf = (x: number, y: number): number => {
    const cx = Math.floor(x / CW), cy = Math.floor(y / CH);
    if (cx === 1 && cy === 1) return 9;
    const i = ORDER.findIndex(([a, b]) => a === cx && b === cy);
    return i < 0 ? 0 : i + 1;
  };

  const map: MapData = { w, h, grid, start, roomCenter: center, beatSpot, gates, npcs, chests, saves, shop, inn, exit, roomOf };
  return verify(map, ch) ? map : null;
}

/** Every beat trigger, NPC, chest, and special must be reachable in order once gates open. */
export function verify(map: MapData, ch: ChapterDef): boolean {
  const reach = (beatsDone: number): Set<string> => {
    const open = new Set(map.gates.filter((g) => g.beat <= beatsDone).map((g) => `${g.x},${g.y}`));
    const seen = new Set<string>();
    const q: [number, number][] = [[map.start.x, map.start.y]];
    seen.add(`${map.start.x},${map.start.y}`);
    while (q.length) {
      const [x, y] = q.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const k = `${nx},${ny}`;
        if (seen.has(k)) continue;
        const t = map.grid[ny][nx];
        if (t.solid && !(t.k === 'gate' && open.has(k))) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    return seen;
  };
  const adjacentOk = (set: Set<string>, s: Spot) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(`${s.x + dx},${s.y + dy}`));
  for (let b = 0; b < ch.beats.length; b++) {
    const set = reach(b);
    if (!set.has(`${map.beatSpot[b].x},${map.beatSpot[b].y}`) && b > 0) return false;
  }
  const all = reach(8);
  for (const s of [...map.npcs, ...map.chests, ...map.saves, map.shop, map.inn]) if (!adjacentOk(all, s)) return false;
  return true;
}
