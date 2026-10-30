// Pathfinding on the tile grid (four directions) and line of sight between tiles.
import { WORLD, walkable, actorAt, elevAt } from './world';
import { cellAt } from './map';

export type Pt = [number, number];

export interface PathOpts {
  /** Tiles that may not be entered even if walkable. */
  blocked?: (x: number, y: number) => boolean;
  /** Stop when this many steps are reached. */
  max?: number;
  /** Lets the path end on an occupied or blocked goal (to walk up to it). */
  adjacent?: boolean;
  /** Allows climbing more than one level at once (never). */
  climb?: boolean;
  /** Flies over walls, roofs, and water. */
  fly?: boolean;
}

/** Whether a step from a to b is allowed: one level up only where stairs or a ladder are, down any time. */
export function stepOk(ax: number, ay: number, bx: number, by: number): boolean {
  const m = WORLD.map!;
  const ea = elevAt(ax, ay), eb = elevAt(bx, by);
  if (eb === ea) return true;
  if (eb < ea) return eb >= ea - 1 || cellAt(m, bx, by).tile.climb === true || cellAt(m, ax, ay).tile.climb === true;
  if (eb - ea > 1) return false;
  return cellAt(m, bx, by).tile.climb === true || cellAt(m, ax, ay).tile.climb === true;
}

export function findPath(sx: number, sy: number, gx: number, gy: number, o: PathOpts = {}): Pt[] | null {
  const m = WORLD.map!;
  if (sx === gx && sy === gy) return [];
  const W = m.w, H = m.h;
  const idx = (x: number, y: number) => y * W + x;
  const g = new Float32Array(W * H).fill(Infinity);
  const came = new Int32Array(W * H).fill(-1);
  const open: number[] = [];
  const f = new Float32Array(W * H).fill(Infinity);
  const start = idx(sx, sy), goal = idx(gx, gy);
  g[start] = 0;
  f[start] = Math.abs(gx - sx) + Math.abs(gy - sy);
  open.push(start);
  const closed = new Uint8Array(W * H);
  let steps = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi];
    open.splice(bi, 1);
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++steps > 6000) return null;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const isGoal = ni === goal;
      if (!(isGoal && o.adjacent)) {
        if (o.fly ? !flyable(nx, ny) : !walkable(nx, ny)) continue;
        if (o.blocked?.(nx, ny)) continue;
      }
      if (!o.fly && !stepOk(cx, cy, nx, ny)) continue;
      const ng = g[cur] + 1;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        f[ni] = ng + Math.abs(gx - nx) + Math.abs(gy - ny);
        open.push(ni);
      }
    }
  }
  if (came[goal] < 0) return null;
  const out: Pt[] = [];
  let c = goal;
  while (c !== start) { out.push([c % W, (c / W) | 0]); c = came[c]; }
  out.reverse();
  if (o.adjacent && out.length) out.pop();
  if (o.max !== undefined && out.length > o.max) return out.slice(0, o.max);
  return out;
}

/** Every tile reachable within `max` steps, with its cost. Used for combat movement. */
export function reachable(sx: number, sy: number, max: number, blocked: (x: number, y: number) => boolean, fly = false): Map<number, number> {
  const m = WORLD.map!;
  const W = m.w;
  const dist = new Map<number, number>();
  dist.set(sy * W + sx, 0);
  let frontier: Pt[] = [[sx, sy]];
  for (let d = 1; d <= max; d++) {
    const next: Pt[] = [];
    for (const [cx, cy] of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        const k = ny * W + nx;
        if (dist.has(k)) continue;
        if (fly ? !flyable(nx, ny) : !walkable(nx, ny)) continue;
        if (blocked(nx, ny)) continue;
        if (!fly && !stepOk(cx, cy, nx, ny)) continue;
        dist.set(k, d);
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return dist;
}

/** Flying units cross anything on the map except the void. */
export function flyable(x: number, y: number): boolean {
  const m = WORLD.map!;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  return cellAt(m, x, y).tile.ch !== ' ';
}

/** Tiles on the line from a to b, excluding a, including b (Bresenham). */
export function lineTiles(ax: number, ay: number, bx: number, by: number): Pt[] {
  const out: Pt[] = [];
  let x = ax, y = ay;
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === bx && y === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    out.push([x, y]);
  }
  return out;
}

/** True when nothing opaque stands between two tiles. Smoke and steam count when `smoke` is given. */
export function sees(ax: number, ay: number, bx: number, by: number, smoke?: (x: number, y: number) => boolean): boolean {
  const m = WORLD.map!;
  const t = lineTiles(ax, ay, bx, by);
  for (let i = 0; i < t.length - 1; i++) {
    const [x, y] = t[i];
    const c = cellAt(m, x, y);
    if (c.tile.opaque) return false;
    if (smoke?.(x, y)) return false;
    for (const p of WORLD.props) if (!p.broken && p.def.opaque && p.x === x && p.y === y) return false;
  }
  return true;
}

export function occupied(x: number, y: number): boolean { return !!actorAt(x, y); }
