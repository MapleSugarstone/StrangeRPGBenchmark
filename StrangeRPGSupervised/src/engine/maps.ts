import type { Puzzle } from "./puzzles.js";
import { CH1_MAPS } from "../content/ch1/maps.js";
import { INTERIORS } from "../content/interiors.js";
import { ISLAND_SETS } from "../art/island_tiles.js";
import { CH2_MAPS } from "../content/ch2/maps.js";
import { CH3_MAPS } from "../content/ch3/maps.js";
import { CH4_MAPS } from "../content/ch4/maps.js";
import { CH5_MAPS } from "../content/ch5/maps.js";
import { CH6_MAPS } from "../content/ch6/maps.js";
import { CH7_MAPS } from "../content/ch7/maps.js";
import { CH8_MAPS } from "../content/ch8/maps.js";
import { CH9_MAPS } from "../content/ch9/maps.js";
import { CH10_MAPS } from "../content/ch10/maps.js";
import { CH11_MAPS } from "../content/ch11/maps.js";
import { CH12_MAPS } from "../content/ch12/maps.js";
import { CH13_MAPS } from "../content/ch13/maps.js";
import { CH14_MAPS } from "../content/ch14/maps.js";
// Dregs imports (tools/build_dregs.mjs)
import { CH15_MAPS } from "../content/ch15/maps.js";
import { CH16_MAPS } from "../content/ch16/maps.js";
import { CH17_MAPS } from "../content/ch17/maps.js";
import { CH18_MAPS } from "../content/ch18/maps.js";
import { CH19_MAPS } from "../content/ch19/maps.js";
import { CH20_MAPS } from "../content/ch20/maps.js";
import { DREGS_SETS } from "../art/dregs_tiles.js";
// End of Dregs imports

export const TILE_SIZE = 8;

/** A seal's line across its map: the column (axis x) or row (axis y) it fills, and which way the gate lies from it. */
export type SealLine = { axis: "x" | "y"; at: number; ahead: 1 | -1 };

export type MapData = {
  width: number;
  height: number;
  rows: string[];
  warps: Warp[];
  encounters: Encounter[];
  npcs: NPC[];
  /** This map's own letters, over TILES. */
  tiles?: Record<string, TileInfo>;
  /** The sealed wall across this map: its name, the Ruin type that opens it, and its two lines (Qwen's words). */
  seal?: { name: string; needs: string; shut: string; open: string; line?: SealLine };
  /** A field puzzle in front of the seal (src/engine/puzzles.ts). */
  puzzle?: Puzzle;
  /** Where a side map's find lies (src/content/finds.ts holds what it is). */
  find?: [number, number];
};

export type Warp = {
  x: number;
  y: number;
  destMap: string;
  destX: number;
  destY: number;
};

export type Encounter = {
  tiles: string[];
  species: string[];
  levels: number[];
  rate?: number;
  /** Wild Ruin come two at a time (the Hollow Core's wild pairs). */
  pair?: boolean;
};

export type NPC = {
  x: number;
  y: number;
  dir: "up" | "down" | "left" | "right";
  name: string;
  sprite: string;
  lines: string[];
  battle?: string;
  flag?: string;
  level?: number;
  isTrainer?: boolean;
  leaves?: boolean;
  /** A Ruin this person gives the player once, after talking or after being beaten. */
  gives?: string;
  givesLevel?: number;
  /** What the person says as they hand the Ruin over (Qwen's words). */
  giftLine?: string;
  /** A trader: after their lines, the shop opens. */
  shop?: boolean;
  /** The quencher: after their lines, the Quench Station opens. */
  quench?: boolean;
  /** The forger: after their lines, the Forge opens. */
  forge?: boolean;
  /** The Undercroft's guardian: after their lines, the board game; with leaves, they step aside once Shard wins. */
  board?: boolean;
  /** More Ruin this person fights with after `battle` falls, at the same level. */
  team?: string[];
  /** What a trainer says once beaten, in place of their lines (Qwen's words). */
  after?: string[];
};

/** A map letter's picture, whether a person can stand on it, and the light it gives off, if any. */
export type TileInfo = { sprite: string; walk: boolean; glow?: string; under?: string; seal?: boolean };

export const TILES: Record<string, TileInfo> = {
  "#": { sprite: "tile_wall", walk: false },
  ".": { sprite: "tile_ash_ground", walk: true },
  ",": { sprite: "tile_grass", walk: true },
  "~": { sprite: "tile_dregs", walk: false, glow: "dregs" },
  "C": { sprite: "tile_cracked_ground", walk: true, glow: "crack" },
  "P": { sprite: "tile_pillar", walk: false },
  "L": { sprite: "tile_lamp_post", walk: false, glow: "lamp" },
  "D": { sprite: "tile_ash_ground_dark", walk: true },
  // A seal blocks until opened, but counts as open ground for the map checks.
  "S": { sprite: "tile_pillar", walk: true, glow: "void", seal: true },
  // Puzzle ground: a plate for a weight, and a wire with a node at each end.
  "O": { sprite: "tile_cracked_ground", walk: true, glow: "crack" },
  "W": { sprite: "tile_cracked_ground", walk: true },
  // Town huts: roof and wall block, the door is walked into; inside, a floor ringed by walls.
  "R": { sprite: "tile_hut_roof", walk: false },
  "H": { sprite: "tile_hut_wall", walk: false },
  "E": { sprite: "tile_hut_door", walk: true },
  "F": { sprite: "tile_room_floor", walk: true },
  "Q": { sprite: "tile_room_wall", walk: false },
  "N": { sprite: "tile_ash_ground_dark", walk: true, glow: "lamp" },
};

/** The letter at x, y, ignoring a row-number comment; outside the map counts as wall. */
export function tileAt(map: MapData, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "#";
  return map.rows[y].replace(/\/\/.*$/, "").trim()[x] ?? "#";
}

/** The tile info at x, y: the map's own set first, then TILES. */
export function tileInfo(map: MapData, x: number, y: number): TileInfo | undefined {
  const letter = tileAt(map, x, y);
  return map.tiles?.[letter] ?? TILES[letter];
}

export const MAPS: Record<string, MapData> = {
  ...CH1_MAPS,
  ...CH2_MAPS,
  ...CH3_MAPS,
  ...CH4_MAPS,
  ...CH5_MAPS,
  ...CH6_MAPS,
  ...CH7_MAPS,
  ...CH8_MAPS,
  ...CH9_MAPS,
  ...CH10_MAPS,
  ...CH11_MAPS,
  ...CH12_MAPS,
  ...CH13_MAPS,
  ...CH14_MAPS,
  // Dregs maps (tools/build_dregs.mjs)
  ...CH15_MAPS,
  ...CH16_MAPS,
  ...CH17_MAPS,
  ...CH18_MAPS,
  ...CH19_MAPS,
  ...CH20_MAPS,
  // End of Dregs maps
  // Hut rooms come after the islands, so the islands keep their order.
  ...INTERIORS,
};

// Each later island draws its letters with its own tiles; a side map uses its island's.
for (const [id, map] of Object.entries(MAPS)) {
  const prefix = id.replace(/_(\d+|side)$/, "");
  const set = ISLAND_SETS[prefix] ?? DREGS_SETS[prefix];
  if (set) map.tiles = { ...set, ...(set.P ? { S: { ...set.P, walk: true, glow: "void", seal: true } } : {}), ...map.tiles };
}

/** How many steps past the map's seal line a tile is, toward its gate (negative before the line); null with no line. */
export function pastSeal(map: MapData, x: number, y: number): number | null {
  const l = map.seal?.line;
  return l ? ((l.axis === "x" ? x : y) - l.at) * l.ahead : null;
}

/** The island maps in walking order, without hut rooms and side maps. */
export const MAIN_ORDER = Object.keys(MAPS).filter((id) => !/_(hut|side)$/.test(id));

/** The open tile just inside the door on `mapId` that leads to `destMap`, which is where a warp into that door lands. */
export function landingBeside(mapId: string, destMap: string): [number, number] | null {
  const map = MAPS[mapId], w = map?.warps.find((x) => x.destMap === destMap);
  if (!map || !w) return null;
  const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [w.x + dx, w.y + dy] as [number, number])
    .filter(([x, y]) => tileInfo(map, x, y)?.walk && !map.warps.some((o) => o.x === x && o.y === y));
  // Inward is away from the nearest edge.
  const depth = ([x, y]: [number, number]) => Math.min(x, y, map.width - 1 - x, map.height - 1 - y);
  return open.sort((a, b) => depth(b) - depth(a))[0] ?? null;
}

/** Where Shard arrives on a map: beside the door back to where Shard came from (the start of the game on the first). */
export function arrivalOf(mapId: string): [number, number] {
  const map = MAPS[mapId];
  if (mapId === MAIN_ORDER[0]) return [15, 10];
  if (/_hut$/.test(mapId)) return [map.warps[0].x, map.warps[0].y - 1];
  const i = MAIN_ORDER.indexOf(mapId);
  const from = i > 0 ? MAIN_ORDER[i - 1] : map.warps[0]?.destMap;
  return landingBeside(mapId, from) ?? landingBeside(mapId, map.warps[0]?.destMap) ?? [2, 12];
}
