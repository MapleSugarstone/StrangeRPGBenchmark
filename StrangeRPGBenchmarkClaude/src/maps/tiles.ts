import type { Pal3, Hue } from '../core/palette';

export interface TileDef {
  kind: string;
  solid?: boolean;
  enc?: boolean;
  /** Paint pool: stepping here sets the party tint. */
  paint?: Hue;
  /** Hue gate: passable only while the party tint matches. */
  gate?: Hue;
  /** Conveyor: pushes the player one tile in this direction. */
  belt?: 'up' | 'down' | 'left' | 'right';
  /** Cloud sea: passable only by skiff. */
  sea?: boolean;
  /** Grey floor: hues stop mattering in battles started here. */
  greyzone?: boolean;
}

export const LEGEND: Record<string, TileDef> = {
  '.': { kind: 'ground' },
  ',': { kind: 'tall', enc: true },
  ';': { kind: 'grass' },
  '"': { kind: 'flowers' },
  ':': { kind: 'path' },
  'T': { kind: 'tree', solid: true },
  'Y': { kind: 'pine', solid: true },
  'A': { kind: 'antenna', solid: true },
  '%': { kind: 'bush', solid: true },
  '#': { kind: 'wall', solid: true },
  'B': { kind: 'brick', solid: true },
  'R': { kind: 'rock', solid: true },
  '^': { kind: 'roof', solid: true },
  'W': { kind: 'window', solid: true },
  'D': { kind: 'door' },
  '~': { kind: 'water', solid: true },
  '≈': { kind: 'deep', solid: true },
  '=': { kind: 'bridge' },
  ' ': { kind: 'void', solid: true },
  '*': { kind: 'edge', solid: true },
  '_': { kind: 'floor' },
  '-': { kind: 'planks' },
  '+': { kind: 'carpet' },
  '|': { kind: 'fence', solid: true },
  'P': { kind: 'pillar', solid: true },
  '&': { kind: 'static', enc: true },
  'S': { kind: 'stairs' },
  'G': { kind: 'gear' },
  'M': { kind: 'machine', solid: true },
  'Q': { kind: 'circuit' },
  'O': { kind: 'grate' },
  'H': { kind: 'glass', solid: true },
  '$': { kind: 'coins' },
  '@': { kind: 'sand', enc: true },
  '!': { kind: 'sand' },
  'K': { kind: 'cloud', sea: true, solid: true },
  '/': { kind: 'thread', solid: true },
  'X': { kind: 'bone', solid: true },
};

/** Default palettes by tile kind. Maps override these with a theme. */
export const BASE_THEME: Record<string, Pal3> = {
  ground: ['k', 'e1', 'e2'],
  tall: ['k', 'e1', 'e3'],
  grass: ['k', 'e2', 'e3'],
  flowers: ['k', 'e1', 'y3'],
  path: ['k', 'n2', 'n3'],
  tree: ['k', 'e1', 'e2'],
  pine: ['k', 'e1', 'e2'],
  antenna: ['k', 'e1', 'r2'],
  bush: ['k', 'e1', 'e2'],
  wall: ['k', 'g1', 'g2'],
  brick: ['k', 'r1', 'n2'],
  rock: ['k', 'g1', 'g2'],
  roof: ['k', 'r1', 'r2'],
  window: ['k', 'n2', 'y3'],
  door: ['k', 'n1', 'n2'],
  water: ['k', 'b1', 'b2'],
  deep: ['k', 'b1', 'b2'],
  bridge: ['k', 'n2', 'n3'],
  void: ['k', 'g1', 'w'],
  edge: ['k', 'g1', 'o3'],
  floor: ['k', 'n1', 'n2'],
  planks: ['k', 'n2', 'n3'],
  carpet: ['k', 'r1', 'r2'],
  fence: ['k', 'e1', 'n2'],
  pillar: ['k', 'g2', 'g3'],
  static: ['k', 'c1', 'g2'],
  stairs: ['k', 'g2', 'g3'],
  gear: ['k', 'n1', 'y2'],
  machine: ['k', 'g1', 'c2'],
  circuit: ['k', 'e1', 'e3'],
  grate: ['k', 'g1', 'g2'],
  glass: ['k', 'c1', 'c3'],
  coins: ['k', 'y1', 'y2'],
  sand: ['k', 'y1', 'y3'],
  cloud: ['k', 'b3', 'w'],
  thread: ['k', 'm2', 'c2'],
  bone: ['k', 'g2', 'w'],
  gate: ['k', 'k', 'w'],
  belt: ['k', 'g1', 'y2'],
};
