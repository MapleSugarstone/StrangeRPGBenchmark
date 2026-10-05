// Map engine — procedural layouts, encounters, stairs, and boss triggers.

import { RNG, hashStr } from "../core/rng.js";
import { generateSprite } from "../core/sprite.js";
import type { Sprite } from "../core/sprite.js";
import type { MapDef, SpriteStyleName } from "../game/types.js";

// ---- types ------------------------------------------------------------

/** Tile type: walkable floor, water, void, wall, or stair/door. */
export type TileType = "floor" | "water" | "void" | "wall" | "stair" | "boss-stair" | "shop" | "empty";

export interface MapTile {
  x: number;
  y: number;
  type: TileType;
  sprite: Sprite;
  encounterChance: number; // 0..1, on floor tiles
  isStair: boolean;
  isBossStair: boolean;
  isShop: boolean;
  isExit: boolean;
}

export interface MapState {
  def: MapDef;
  tiles: MapTile[][]; // [y][x]
  w: number;
  h: number;
  playerX: number;
  playerY: number;
  encountersLeft: number; // battles fought this floor; 0 = boss stair unlocked
  visited: Set<string>;   // "x,y" keys
  floor: number;          // 0-based floor index
  explored: boolean[][];   // fog of war
  steps: number;           // steps taken on this floor
  quietSteps: number;      // steps since the last encounter
}

export interface MapEvent {
  kind: "move" | "encounter" | "stair" | "boss-stair" | "shop" | "nothing";
  data?: unknown;
}

// ---- layout generators ------------------------------------------------

/** Fill a rectangular room [ox..ox+w-1][oy..oy+h-1] with walkable floor. */
function fillRoom(tiles: MapTile[][], ox: number, oy: number, w: number, h: number, type: TileType, visited: Set<string>, mapDef: MapDef): void {
  for (let y = oy; y < oy + h; y++)
    for (let x = ox; x < ox + w; x++)
      setTile(tiles, x, y, type, visited, mapDef);
}

/** Set one tile cell to the given type. */
function setTile(tiles: MapTile[][], x: number, y: number, type: TileType, visited: Set<string>, mapDef: MapDef): void {
  if (x < 0 || y < 0 || x >= tiles[0]?.length || y >= tiles.length) return;
  const key = `${x},${y}`;
  const floorStyle = (type === "wall" ? mapDef.tileWall : mapDef.tileFloor) as SpriteStyleName;
  tiles[y][x] = {
    x, y, type,
    sprite: generateSprite(visited.size, floorStyle, mapDef.palette),
    encounterChance: type === "wall" ? 0 : 0.15,
    isStair: false, isBossStair: false, isShop: false, isExit: false,
  };
  visited.add(key);
}

/** Generate rooms: place 5–8 rooms with corridors between them. */
function generateRooms(tiles: MapTile[][], mapDef: MapDef): void {
  const rng = new RNG(mapDef.seed);
  const roomCount = rng.int(5, 8);
  const placed: { x: number; y: number; w: number; h: number }[] = [];

  for (let attempt = 0; attempt < 80 && placed.length < roomCount; attempt++) {
    const rw = rng.int(3, 5);
    const rh = rng.int(3, 5);
    const rx = rng.int(1, Math.max(2, tiles[0]?.length - rw - 1));
    const ry = rng.int(1, Math.max(2, tiles.length - rh - 1));
    const room = { x: rx, y: ry, w: rw, h: rh };
    // don't overlap existing
    const overlap = placed.some(
      (r) => rx - 1 < r.x + r.w && rx + rw + 1 > r.x && ry - 1 < r.y + r.h && ry + rh + 1 > r.y,
    );
    if (overlap) continue;
    placed.push(room);
    fillRoom(tiles, rx, ry, rw, rh, "floor", new Set(), mapDef);
  }

  // connect with L-shaped corridors
  for (let i = 1; i < placed.length; i++) {
    const a = placed[i - 1];
    const b = placed[i];
    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);
    // horizontal then vertical
    const cx = Math.min(ax, bx);
    const dx = Math.max(ax, bx);
    for (let x = cx; x <= dx; x++) setTile(tiles, x, ay, "floor", new Set(), mapDef);
    const cy = Math.min(ay, by);
    const dy2 = Math.max(ay, by);
    for (let y = cy; y <= dy2; y++) setTile(tiles, bx, y, "floor", new Set(), mapDef);
  }
}

/** Generate a labyrinth: grid with walls at regular intervals and some passages. */
function generateLabyrinth(tiles: MapTile[][], mapDef: MapDef): void {
  const rng = new RNG(mapDef.seed);
  const stepX = rng.int(3, 4);
  const stepY = rng.int(3, 4);

  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < tiles[0]?.length; x++) {
      // floor tiles form corridors: rows at multiples of stepY and columns at multiples of stepX
      const onRowLine = y % stepY === 0;
      const onColLine = x % stepX === 0;
      const isFloor = onRowLine || onColLine;
      setTile(tiles, x, y, isFloor ? "floor" : "wall", new Set(), mapDef);
    }

  // carve some extra openings
  for (let i = 0; i < tiles.length * 2; i++) {
    const x = rng.int(1, tiles[0]?.length - 2);
    const y = rng.int(1, tiles.length - 2);
    if (tiles[y][x]?.type === "wall") setTile(tiles, x, y, "floor", new Set(), mapDef);
  }
}

/** Generate a spiral: one corridor winding inward from the top-left corner, with a few shortcuts. */
function generateSpiral(tiles: MapTile[][], mapDef: MapDef): void {
  const rng = new RNG(mapDef.seed);
  const w = tiles[0].length;
  const h = tiles.length;
  const set = (x: number, y: number) => setTile(tiles, x, y, "floor", new Set(), mapDef);
  let x0 = 1, y0 = 1, x1 = w - 2, y1 = h - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) set(x, y0);
    for (let y = y0; y <= y1; y++) set(x1, y);
    for (let x = x1; x >= x0; x--) set(x, y1);
    // the left side stops two short so a wall separates this lap from the next
    for (let y = y1; y >= y0 + 2; y--) set(x0, y);
    if (x0 + 2 <= x1 - 2 && y0 + 2 <= y1 - 2) set(x0 + 1, y0 + 2);
    x0 += 2; y0 += 2; x1 -= 2; y1 -= 2;
  }
  // shortcuts: open walls that sit between two corridor tiles
  for (let i = 0, opened = 0; i < 400 && opened < 3; i++) {
    const x = rng.int(2, w - 3);
    const y = rng.int(2, h - 3);
    if (tiles[y][x].type !== "wall") continue;
    const across = (tiles[y - 1][x].type === "floor" && tiles[y + 1][x].type === "floor") ||
                   (tiles[y][x - 1].type === "floor" && tiles[y][x + 1].type === "floor");
    if (across) { set(x, y); opened++; }
  }
}

/** Generate a hollow: concentric rings of wall with an inner open area. */
function generateHollow(tiles: MapTile[][], mapDef: MapDef): void {
  const rng = new RNG(mapDef.seed);
  const cx = Math.floor(tiles[0]?.length / 2);
  const cy = Math.floor(tiles.length / 2);
  const rings = rng.int(3, 5);

  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < tiles[0]?.length; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const dist = Math.max(dx, dy);
      const ring = dist % rings;
      setTile(tiles, x, y, ring === 0 ? "wall" : "floor", new Set(), mapDef);
    }

  // two doors per ring, on tiles with floor on both sides
  const radii = new Set<number>();
  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < tiles[0].length; x++)
      if (tiles[y][x].type === "wall") radii.add(Math.max(Math.abs(x - cx), Math.abs(y - cy)));
  for (const r of radii) {
    const ring: { x: number; y: number }[] = [];
    for (let y = 0; y < tiles.length; y++)
      for (let x = 0; x < tiles[0].length; x++) {
        if (tiles[y][x].type !== "wall" || Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        const across = (tiles[y - 1]?.[x]?.type === "floor" && tiles[y + 1]?.[x]?.type === "floor") ||
                       (tiles[y]?.[x - 1]?.type === "floor" && tiles[y]?.[x + 1]?.type === "floor");
        if (across) ring.push({ x, y });
      }
    rng.shuffle(ring);
    for (const d of ring.slice(0, 2)) setTile(tiles, d.x, d.y, "floor", new Set(), mapDef);
  }
}

/** Generate a needle: narrow corridors leading to a large center. */
function generateNeedle(tiles: MapTile[][], mapDef: MapDef): void {
  const rng = new RNG(mapDef.seed);
  const cx = Math.floor(tiles[0]?.length / 2);
  const cy = Math.floor(tiles.length / 2);

  // draw a vertical corridor through center
  for (let y = 0; y < tiles.length; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      if (x >= 0 && x < tiles[0]?.length) setTile(tiles, x, y, "floor", new Set(), mapDef);
    }
  }

  // draw a horizontal corridor through center
  for (let x = 0; x < tiles[0]?.length; x++) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = cy + dy;
      if (y >= 0 && y < tiles.length) setTile(tiles, x, y, "floor", new Set(), mapDef);
    }
  }

  // carve a large center area
  const centerSize = Math.max(3, Math.floor(Math.min(tiles[0]?.length, tiles.length) / 4));
  for (let dy = -Math.floor(centerSize / 2); dy <= Math.ceil(centerSize / 2); dy++) {
    for (let dx = -Math.floor(centerSize / 2); dx <= Math.ceil(centerSize / 2); dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < tiles[0]?.length && y >= 0 && y < tiles.length) {
        setTile(tiles, x, y, "floor", new Set(), mapDef);
      }
    }
  }

  // carve some additional random passages for connectivity
  for (let i = 0; i < tiles.length; i++) {
    const x = rng.int(1, tiles[0]?.length - 2);
    const y = rng.int(1, tiles.length - 2);
    if (tiles[y][x]?.type === "wall") setTile(tiles, x, y, "floor", new Set(), mapDef);
  }
}

// ---- floor builder ----------------------------------------------------

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Breadth-first distances from (sx, sy) over non-wall tiles; -1 = unreachable. */
export function distancesFrom(tiles: MapTile[][], sx: number, sy: number): number[][] {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const dist = Array.from({ length: h }, () => new Array<number>(w).fill(-1));
  if (!tiles[sy]?.[sx] || tiles[sy][sx].type === "wall") return dist;
  dist[sy][sx] = 0;
  const queue: [number, number][] = [[sx, sy]];
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (dist[ny][nx] >= 0 || tiles[ny][nx].type === "wall") continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** Carve L-shaped corridors until every walkable tile is reachable from the spawn. */
function connectRegions(tiles: MapTile[][], mapDef: MapDef, sx: number, sy: number): void {
  for (let guard = 0; guard < 200; guard++) {
    const dist = distancesFrom(tiles, sx, sy);
    let orphan: { x: number; y: number } | null = null;
    for (let y = 0; y < tiles.length && !orphan; y++)
      for (let x = 0; x < tiles[0].length; x++)
        if (tiles[y][x].type !== "wall" && dist[y][x] < 0) { orphan = { x, y }; break; }
    if (!orphan) return;
    // nearest reachable tile by Manhattan distance
    let best = { x: sx, y: sy, d: Infinity };
    for (let y = 0; y < tiles.length; y++)
      for (let x = 0; x < tiles[0].length; x++)
        if (dist[y][x] >= 0) {
          const d = Math.abs(x - orphan.x) + Math.abs(y - orphan.y);
          if (d < best.d) best = { x, y, d };
        }
    const stepX = Math.sign(best.x - orphan.x);
    for (let x = orphan.x; x !== best.x; x += stepX)
      if (tiles[orphan.y][x].type === "wall") setTile(tiles, x, orphan.y, "floor", new Set(), mapDef);
    const stepY = Math.sign(best.y - orphan.y);
    for (let y = orphan.y; y !== best.y; y += stepY)
      if (tiles[y][best.x].type === "wall") setTile(tiles, best.x, y, "floor", new Set(), mapDef);
  }
}

/** Place a boss stair at the tile farthest from the spawn and a shop halfway there. */
function decorateFloor(
  tiles: MapTile[][],
  mapDef: MapDef,
  floorIndex: number,
  spawn: { x: number; y: number },
  visited: Set<string>,
): void {
  const dist = distancesFrom(tiles, spawn.x, spawn.y);
  const walkable: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < tiles[0].length; x++)
      if (dist[y][x] > 0) walkable.push({ x, y, d: dist[y][x] });

  const rng = new RNG(mapDef.seed + floorIndex * 1000);
  rng.shuffle(walkable);
  walkable.sort((a, b) => b.d - a.d);

  const bossStair = walkable[0];
  if (bossStair) {
    setTile(tiles, bossStair.x, bossStair.y, "boss-stair", visited, mapDef);
    tiles[bossStair.y][bossStair.x].isBossStair = true;
  }

  const shop = walkable[Math.floor(walkable.length * 0.5)];
  if (shop && shop !== bossStair) {
    setTile(tiles, shop.x, shop.y, "shop", visited, mapDef);
    tiles[shop.y][shop.x].isShop = true;
    tiles[shop.y][shop.x].encounterChance = 0;
  }
  tiles[spawn.y][spawn.x].encounterChance = 0;
}

/** Find the first walkable tile for player spawn. */
function findSpawn(tiles: MapTile[][], visited: Set<string>): { x: number; y: number } {
  // Try the top-left area first
  for (let y = 0; y < Math.min(5, tiles.length); y++) {
    for (let x = 0; x < Math.min(5, tiles[0]?.length); x++) {
      if (tiles[y][x] && tiles[y][x].type !== "wall") {
        return { x, y };
      }
    }
  }
  // Fallback: any walkable tile
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[0]?.length; x++) {
      if (tiles[y][x] && tiles[y][x].type !== "wall") {
        return { x, y };
      }
    }
  }
  return { x: 1, y: 1 };
}

// ---- public API -------------------------------------------------------

/** Create a new MapState for a given chapter map and floor. */
export function createMap(mapDef: MapDef, floorIndex: number): MapState {
  const w = mapDef.w;
  const h = mapDef.h;
  const tiles: MapTile[][] = [];
  for (let y = 0; y < h; y++) {
    tiles[y] = [];
    for (let x = 0; x < w; x++) {
      tiles[y][x] = {
        x, y, type: "wall",
        sprite: generateSprite(x + y * w, mapDef.tileWall, mapDef.palette),
        encounterChance: 0,
        isStair: false, isBossStair: false, isShop: false, isExit: false,
      };
    }
  }

  const visited = new Set<string>();

  // each floor gets its own layout from the chapter seed
  const floorDef: MapDef = { ...mapDef, seed: mapDef.seed + floorIndex * 7919 };
  switch (mapDef.layout) {
    case "rooms":
      generateRooms(tiles, floorDef);
      break;
    case "labyrinth":
      generateLabyrinth(tiles, floorDef);
      break;
    case "spiral":
      generateSpiral(tiles, floorDef);
      break;
    case "hollow":
      generateHollow(tiles, floorDef);
      break;
    case "needle":
      generateNeedle(tiles, floorDef);
      break;
    default:
      generateRooms(tiles, floorDef);
      break;
  }

  const spawn = findSpawn(tiles, visited);
  connectRegions(tiles, mapDef, spawn.x, spawn.y);
  decorateFloor(tiles, mapDef, floorIndex, spawn, visited);

  const explored = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
  revealAround(explored, spawn.x, spawn.y, 3);

  return {
    def: mapDef,
    tiles,
    w,
    h,
    playerX: spawn.x,
    playerY: spawn.y,
    encountersLeft: mapDef.encounters,
    visited,
    floor: floorIndex,
    explored,
    steps: 0,
    quietSteps: 0,
  };
}

/** Mark the square of tiles within `radius` of the player as explored. */
function revealAround(explored: boolean[][], px: number, py: number, radius: number): void {
  for (let y = py - radius; y <= py + radius; y++)
    for (let x = px - radius; x <= px + radius; x++)
      if (explored[y] && x >= 0 && x < explored[y].length) explored[y][x] = true;
}

/** Place the player on a tile without triggering its event. */
export function movePlayerTo(state: MapState, x: number, y: number): void {
  state.playerX = x;
  state.playerY = y;
  revealAround(state.explored, x, y, 3);
}

/** Move the player one step and return the event triggered. */
export function movePlayer(state: MapState, dx: number, dy: number): MapEvent {
  const nx = state.playerX + dx;
  const ny = state.playerY + dy;

  // Bounds check
  if (nx < 0 || ny < 0 || nx >= state.w || ny >= state.h) {
    return { kind: "nothing" };
  }

  const tile = state.tiles[ny]?.[nx];
  if (!tile || tile.type === "wall") {
    return { kind: "nothing" };
  }

  // Update player position
  state.playerX = nx;
  state.playerY = ny;

  // Update explored tiles around player
  revealAround(state.explored, nx, ny, 3);

  // Update visited set
  const key = `${nx},${ny}`;
  state.visited.add(key);

  if (tile.isBossStair) {
    return {
      kind: "boss-stair",
      data: {
        boss: state.def.bosses[Math.min(state.floor, state.def.bosses.length - 1)],
        locked: state.encountersLeft > 0,
      },
    };
  }

  if (tile.isShop) {
    return { kind: "shop", data: { floor: state.floor } };
  }

  const isWalkable = tile.type === "floor" || tile.type === "water" || tile.type === "void";
  if (isWalkable) {
    // Random encounter check
    state.steps++;
    state.quietSteps++;
    if (state.encountersLeft > 0 && tile.encounterChance > 0) {
      const rng = new RNG(hashStr(`${state.def.id},${state.floor},${nx},${ny},${state.steps}`));
      // no fight in the first 3 steps after one, and always one by the 20th
      if (state.quietSteps > 3 && (rng.next() < tile.encounterChance || state.quietSteps >= 20)) {
        state.encountersLeft--;
        state.quietSteps = 0;
        return { kind: "encounter", data: { floor: state.floor } };
      }
    }
  }

  return { kind: "move" };
}

/** Get the tile at the player's current position. */
export function getPlayerTile(state: MapState): MapTile | undefined {
  return state.tiles[state.playerY]?.[state.playerX];
}

/** Get all tiles the player has explored. */
export function getExploredTiles(state: MapState): { x: number; y: number; tile: MapTile }[] {
  const result: { x: number; y: number; tile: MapTile }[] = [];
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (state.explored[y]?.[x]) {
        const tile = state.tiles[y]?.[x];
        if (tile) {
          result.push({ x, y, tile });
        }
      }
    }
  }
  return result;
}
