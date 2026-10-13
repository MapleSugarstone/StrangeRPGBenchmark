// World generation system! Tile-based maps with rooms, corridors, weird places!

export const TILE_SIZE = 8;
export const ROOMS_PER_CHAPTER = 2;

// Tile types
export const WALL = 0, FLOOR = 1, ENCOUNTER = 2, BOSS = 3;

export type Exit = { x: number; y: number; toRoom: number };

export type Room = {
  name: string;
  chapter: number;
  map: number[][];
  exits: Exit[];
  forward?: Exit;
  back?: Exit;
  bossRoom: boolean;
};

// Two rooms per chapter, in chapter order
const ROOM_NAMES = [
  'The Crack in the Wall', 'The Door',
  'Echo Chamber', 'Shattered Mirror',
  'Whispering Hall', 'The Fracture',
  'Fading Memory', 'Somewhere Else',
  'The Space Between', 'Beyond the Wall',
  'Almost Home', 'The Last Place',
];

export const ROOM_COUNT = ROOM_NAMES.length;

// Seeded PRNG for deterministic room generation
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Generate a tile map for a single room
export function generateTileMap(roomIndex: number, width: number = 12, height: number = 8): Room {
  const rng = createRng(roomIndex * 7919 + 42);
  const chapter = Math.floor(roomIndex / ROOMS_PER_CHAPTER);
  const bossRoom = roomIndex % ROOMS_PER_CHAPTER === ROOMS_PER_CHAPTER - 1;
  const last = roomIndex === ROOM_COUNT - 1;

  // The outer ring is floor, so every exit next to it is reachable
  const map: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push(FLOOR);
      } else {
        row.push(rng() > 0.3 ? FLOOR : WALL);
      }
    }
    map.push(row);
  }

  // Carve a winding path
  let cx = 1, cy = 1;
  const pathLen = Math.floor(width * height * 0.5);
  for (let i = 0; i < pathLen; i++) {
    if (cx > 0 && cx < width - 1 && cy > 0 && cy < height - 1) {
      map[cy][cx] = FLOOR;
      if (cx + 1 < width - 1) map[cy][cx + 1] = FLOOR;
      if (cy + 1 < height - 1) map[cy + 1][cx] = FLOOR;
    }
    const dir = Math.floor(rng() * 4);
    if (dir === 0 && cx < width - 2) cx++;
    else if (dir === 1 && cx > 1) cx--;
    else if (dir === 2 && cy < height - 2) cy++;
    else if (dir === 3 && cy > 1) cy--;
  }

  map[1][1] = FLOOR; map[1][2] = FLOOR; map[2][1] = FLOOR;

  if (last) {
    // The final room is an open arena
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) map[y][x] = FLOOR;
  }

  const exits: Exit[] = [];
  let forward: Exit | undefined;
  let back: Exit | undefined;
  if (!last) {
    const exitY = Math.max(2, Math.min(height - 2, cy));
    forward = { x: width - 2, y: exitY, toRoom: roomIndex + 1 };
    exits.push(forward);
    map[exitY][width - 2] = FLOOR;
    map[exitY][width - 3] = FLOOR;
  }
  if (roomIndex > 0) {
    const backY = Math.max(2, Math.min(height - 2, cy));
    back = { x: 1, y: backY, toRoom: roomIndex - 1 };
    exits.push(back);
    map[backY][1] = FLOOR;
    map[backY][2] = FLOOR;
  }

  if (bossRoom) {
    // A clear row through the middle keeps the boss reachable from both sides
    for (let x = 1; x < width - 1; x++) if (map[4][x] === WALL) map[4][x] = FLOOR;
    map[3][5] = BOSS; map[3][6] = BOSS;
    map[4][5] = BOSS; map[4][6] = BOSS;
  }

  // Place some enemy encounter markers on the map
  if (!last) {
    const numEncounters = 2 + Math.floor(roomIndex / 2);
    for (let i = 0; i < numEncounters; i++) {
      const ex = 3 + Math.floor(rng() * (width - 6));
      const ey = 1 + Math.floor(rng() * (height - 2));
      if (map[ey][ex] === FLOOR) map[ey][ex] = ENCOUNTER;
    }
  }

  return {
    name: ROOM_NAMES[roomIndex] || `Room ${roomIndex + 1}`,
    chapter,
    map,
    exits,
    forward,
    back,
    bossRoom,
  };
}

export function generateWorld(): Room[] {
  const rooms: Room[] = [];
  for (let i = 0; i < ROOM_COUNT; i++) rooms.push(generateTileMap(i, 12, 8));
  return rooms;
}
