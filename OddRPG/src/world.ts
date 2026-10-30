// === World Map ===

export type TileType = 'grass' | 'desert' | 'crystal' | 'ruin' | 'water' | 'lava' | 'metal' | 'forest';

export interface Tile {
  type: TileType;
  sprite: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface WorldMap {
  width: number;
  height: number;
  tiles: Tile[][];
  playerPos: Position;
  dungeons: MapEntry[];
  encounters: Encounter[];
}

export interface MapEntry {
  x: number;
  y: number;
  name: string;
  chapter: number;
  boss: string;
}

export interface Encounter {
  x: number;
  y: number;
  type: string;
  dialogues?: string[];
}

export function generateWorldMap(): WorldMap {
  const WIDTH = 30;
  const HEIGHT = 30;
  const tiles: Tile[][] = [];

  // Simple biome generation
  const center = { x: WIDTH / 2, y: HEIGHT / 2 };

  for (let y = 0; y < HEIGHT; y++) {
    tiles[y] = [];
    for (let x = 0; x < WIDTH; x++) {
      const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);

      let type: TileType = 'grass';
      if (dist < 5) type = 'crystal';
      else if (dist < 10) type = 'forest';
      else if (dist < 15) type = 'ruin';
      else if (dist < 20) type = 'desert';
      else type = 'metal'; // space/tech area

      // Add some water patches
      if (x < 5 && y > 20) type = 'water';
      if (x > 25 && y < 5) type = 'lava';

      tiles[y][x] = {
        type,
        sprite: type
      };
    }
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    tiles,
    playerPos: { x: Math.floor(WIDTH / 2), y: Math.floor(HEIGHT / 2) },
    dungeons: [
      { x: 5, y: 5, name: 'Crystal Cave', chapter: 1, boss: 'Crystal Guardian' },
      { x: 15, y: 10, name: 'Rusting Menagerie', chapter: 1, boss: 'Clockwork Dragon' },
      { x: 22, y: 20, name: 'Rogue Terminal', chapter: 2, boss: 'Sentient AI' },
      { x: 10, y: 25, name: 'Shadow Depths', chapter: 3, boss: 'Void Stalker' },
    ],
    encounters: [
      { x: 8, y: 8, type: 'npc', dialogues: ['greeting'] },
      { x: 12, y: 6, type: 'shop' },
      { x: 20, y: 15, type: 'npc', dialogues: ['warning'] },
      { x: 25, y: 25, type: 'chest' },
    ]
  };
}

export function movePlayer(map: WorldMap, dx: number, dy: number): { blocked: boolean } {
  const newX = map.playerPos.x + dx;
  const newY = map.playerPos.y + dy;

  // Check bounds
  if (newX < 0 || newX >= map.width || newY < 0 || newY >= map.height) {
    return { blocked: true };
  }

  const tile = map.tiles[newY][newX];

  // Block movement on water and lava
  if (tile.type === 'water' || tile.type === 'lava') {
    return { blocked: true };
  }

  map.playerPos.x = newX;
  map.playerPos.y = newY;
  return { blocked: false };
}

export function checkMapEvents(map: WorldMap): { event: string | null } {
  // Check for dungeon entry
  for (const dungeon of map.dungeons) {
    if (dungeon.x === map.playerPos.x && dungeon.y === map.playerPos.y) {
      return { event: `Entering ${dungeon.name}...` };
    }
  }

  // Check for encounters
  for (const enc of map.encounters) {
    if (enc.x === map.playerPos.x && enc.y === map.playerPos.y) {
      return { event: `Found: ${enc.type}` };
    }
  }

  return { event: null };
}
