import type { SpriteSpec } from "../../engine/sprites";
import type { ColorName } from "../../engine/palette";
import type { Dir } from "../types";
import { TILES, type TileDef } from "./tiles";
import { Rng } from "../../engine/rng";

export type EntityKind = "npc" | "chest" | "door" | "trigger" | "sign" | "lamp" | "shop" | "boss" | "prop";

export interface Entity {
  id: string;
  x: number;
  y: number;
  kind: EntityKind;
  sprite?: SpriteSpec;
  solid?: boolean;
  dir?: Dir;
  /** Script key run on interact (npc, chest, sign, boss, prop) or on step (door, trigger). */
  script?: string;
  /** Destination. With atEntity, the player lands one tile below that entity in the target map. */
  to?: { map: string; x: number; y: number; dir?: Dir; atEntity?: string };
  /** Hidden once this flag is truthy. */
  hideIf?: string;
  /** Shown only when this flag is truthy. */
  showIf?: string;
  items?: string[];
  gold?: number;
  wander?: boolean;
  /** Shop inventory. */
  stock?: string[];
  /** Enemy ids for a visible boss or fixed encounter. */
  enemies?: string[];
  name?: string;
  /** Home position for wandering NPCs, set at map load. */
  hx?: number;
  hy?: number;
}

export interface MapDef {
  id: string;
  name: string;
  grid: string[];
  legend: Record<string, string>;
  entities: Entity[];
  encounters?: string;
  encounterRate?: number;
  outside: ColorName;
  /** Generated maps fill grid at load time. */
  generate?: (rng: Rng) => { grid: string[]; entities: Entity[] };
  chapter: number;
}

export class GameMap {
  readonly w: number;
  readonly h: number;
  readonly tiles: TileDef[][];
  readonly entities: Entity[];
  constructor(public def: MapDef, seed: number) {
    let grid = def.grid;
    let extra: Entity[] = [];
    if (def.generate) {
      const g = def.generate(new Rng(seed ^ 0x51ed));
      grid = g.grid;
      extra = g.entities;
    }
    this.h = grid.length;
    this.w = Math.max(...grid.map((r) => r.length));
    this.tiles = grid.map((row) => {
      const out: TileDef[] = [];
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] ?? " ";
        const id = def.legend[ch] ?? def.legend[" "] ?? "void";
        out.push(TILES[id] ?? TILES.void);
      }
      return out;
    });
    this.entities = [...def.entities.map((e) => ({ ...e })), ...extra];
    for (const e of this.entities) { e.hx = e.x; e.hy = e.y; }
  }

  tileAt(x: number, y: number): TileDef {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return TILES.void;
    return this.tiles[y][x];
  }

  entityAt(x: number, y: number, flags: Record<string, unknown>): Entity | undefined {
    return this.entities.find((e) => e.x === x && e.y === y && visible(e, flags));
  }

  solidAt(x: number, y: number, flags: Record<string, unknown>): boolean {
    if (this.tileAt(x, y).solid) return true;
    const e = this.entityAt(x, y, flags);
    return !!e && (e.solid ?? (e.kind !== "door" && e.kind !== "trigger"));
  }
}

export function visible(e: Entity, flags: Record<string, unknown>): boolean {
  if (e.hideIf && flags[e.hideIf]) return false;
  if (e.showIf && !flags[e.showIf]) return false;
  return true;
}

/** Cave generator: cellular automata on a seed, carved so the entrance connects to the exit. */
export function generateCave(rng: Rng, w: number, h: number, floor: string, wall: string, fill = 0.46): string[] {
  let cells: boolean[][] = [];
  for (let y = 0; y < h; y++) {
    cells.push([]);
    for (let x = 0; x < w; x++) cells[y].push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? true : rng.chance(fill));
  }
  for (let i = 0; i < 4; i++) {
    const next = cells.map((r) => [...r]);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && cells[y + dy][x + dx]) n++;
        next[y][x] = n >= 5 || (i < 2 && n === 0);
      }
    cells = next;
  }
  // Keep the largest open region, fill the rest.
  const seen = cells.map((r) => r.map(() => false));
  let best: [number, number][] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (cells[y][x] || seen[y][x]) continue;
      const region: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || cells[ny][nx] || seen[ny][nx]) continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      if (region.length > best.length) best = region;
    }
  const keep = new Set(best.map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!cells[y][x] && !keep.has(`${x},${y}`)) cells[y][x] = true;
  return cells.map((r) => r.map((c) => (c ? wall : floor)).join(""));
}

/** Finds open cells in a generated grid, sorted by distance from a point. */
export function openCells(grid: string[], floorChar: string, fromX: number, fromY: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) if (grid[y][x] === floorChar) out.push([x, y]);
  out.sort((a, b) => Math.hypot(a[0] - fromX, a[1] - fromY) - Math.hypot(b[0] - fromX, b[1] - fromY));
  return out;
}
