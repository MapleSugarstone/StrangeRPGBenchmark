import type { Art } from '../engine/sprites';
import { BRASS, SEA, STONE, YEAR, VOID } from './palette';

export type Area = 'brass' | 'sea' | 'year' | 'stone' | 'void';

export interface TileDef {
  art: Art | Art[];
  c1: string;
  c2: string;
  ink?: string;
  solid?: boolean;
  /** Frames advance every `rate` ticks. */
  rate?: number;
  /** Drawn as the area backdrop instead of art. */
  backdrop?: boolean;
  /** Visible only with True Sight. Walkable. */
  hidden?: boolean;
  /** A wall that is really a path. True Sight shows it. */
  lie?: boolean;
  /** Pushes the walker one tile in this direction. */
  push?: [number, number];
  /** Slides the walker until a wall, as gravity fails. */
  well?: boolean;
  /** Hurts Fragility on entry. */
  harm?: number;
  water?: boolean;
  /** Blocks light. */
  opaque?: boolean;
  /** Gives off light: radius in pixels, intensity, color. A negative light drinks light. */
  light?: { r: number; i: number; color: string; negative?: boolean };
  /** Alternative arts picked by position, so floors do not repeat. The last one is a crack, chosen more often as the world unravels. */
  variants?: Art[];
  /** Drawn instead when the tile below is open floor: the face of a wall. */
  front?: Art;
}

// Tile art. '.' clear, '0' ink, '1' first color, '2' second color. Floors read quietly so the people on them stand out.
// Brass: riveted plates and machinery. Sea: dithered wash, no smooth gradients. 1977: yellow brick and electronic green. Stone: facets in hard colors.

const FLOOR: Art = ['11111110', '12111110', '11111110', '11111110', '11111110', '11111110', '11111210', '00000000'];
const FLOOR2: Art = ['11111110', '12111110', '11111110', '11111110', '11111110', '11111110', '11111110', '00000000'];
const WALL: Art = ['22222221', '21111110', '21211210', '21111110', '21111110', '21211210', '21111110', '10000000'];
const GEAR: Art[] = [
  ['00011000', '00111100', '01122110', '11200211', '11200211', '01111110', '00111100', '00011000'],
  ['10000001', '01111110', '01122110', '01200210', '01200210', '01111110', '01111110', '10000001'],
];
const BRIDGE: Art = ['00000000', '11101110', '12101210', '11101110', '11101110', '12101210', '11101110', '00000000'];
const GRATE: Art = ['22222222', '10101010', '10101010', '11111111', '10101010', '10101010', '11111111', '22222222'];
const VENT: Art[] = [
  ['12111121', '10000001', '11111111', '10020001', '11111111', '10000201', '10000001', '11111111'],
  ['12111121', '10022001', '11111111', '10222201', '11111111', '10020001', '10000001', '11111111'],
];
const PIPE: Art = ['00000000', '22222222', '11111111', '11211211', '11111111', '11111111', '00000000', '00000000'];
const BFLOWER: Art = ['00000020', '00111000', '01121100', '00111000', '00010000', '01010100', '00110000', '20010020'];
const SHELF: Art = ['11111111', '12122121', '12122121', '11111111', '12212212', '12212212', '11111111', '00000000'];
const STAIRS: Art = ['22222222', '11111111', '00000000', '22222222', '11111111', '00000000', '22222222', '11111111'];
const CLOCK: Art = ['00111100', '01112110', '11112111', '11112111', '11122221', '11111111', '01111110', '00111100'];
const FOUNTAIN: Art[] = [
  ['02000200', '00202020', '00022200', '00012100', '01111110', '12222221', '11111111', '01111110'],
  ['00200020', '02020200', '00222000', '00012100', '01111110', '12222221', '11111111', '01111110'],
];
const RAIL: Art = ['11111111', '00000000', '11.11.11', '11.11.11', '11.11.11', '00000000', '11111111', '........'];
const WELL: Art[] = [
  ['22222222', '21111112', '21222212', '21200212', '21200212', '21222212', '21111112', '22222222'],
  ['11111111', '12222221', '12111121', '12100121', '12100121', '12111121', '12222221', '11111111'],
];
const PLANT: Art = ['00111000', '01121110', '11111211', '11211111', '01111110', '00011000', '00222200', '00022000'];
const DOOR: Art = ['11111111', '11222211', '12222221', '12222221', '12221221', '12222221', '12222221', '00000000'];
const LAMP: Art[] = [
  ['..2222..', '.222222.', '.222222.', '..0000..', '...00...', '...00...', '..0000..', '.000000.'],
  ['..2222..', '.222022.', '.222222.', '..0000..', '...00...', '...00...', '..0000..', '.000000.'],
];

// Sea
const PLANK: Art = ['11111011', '11211011', '11111011', '00000000', '11011111', '12011121', '11011111', '00000000'];
const WATER: Art[] = [
  ['11111111', '12121111', '11211111', '11111111', '11111212', '11111121', '11111111', '11111111'],
  ['11111111', '11111212', '11111121', '11111111', '12121111', '11211111', '11111111', '11111111'],
];
const SAND: Art = ['11111111', '12121111', '11212111', '11111111', '11111121', '11112121', '11121211', '11111111'];
const CORAL: Art = ['02002020', '01001010', '01101110', '00111100', '01111110', '11121211', '11111111', '00000000'];
const ROCK: Art = ['00111000', '01221100', '12211111', '12111111', '11111111', '11111101', '01111100', '00000000'];
const MAST: Art = ['11022011', '11022011', '11022011', '00022000', '11022011', '11022011', '11022011', '00022000'];
const SAIL: Art = ['22222222', '21111121', '21111212', '21112121', '21121211', '21212111', '21111111', '22222222'];
const LHWALL: Art = ['22222220', '21212120', '11111110', '11111110', '11101110', '11101110', '11101110', '00000000'];
const LHFLOOR: Art = ['11112222', '11112222', '11112222', '11112222', '22221111', '22221111', '22221111', '22221111'];
const CUR_R: Art[] = [
  ['11111111', '11112111', '11111211', '12222221', '11111211', '11112111', '11111111', '11111111'],
  ['11111111', '11121111', '11112111', '12222211', '11112111', '11121111', '11111111', '11111111'],
];
const CUR_L: Art[] = CUR_R.map(f => f.map(r => [...r].reverse().join('')));
const CUR_U: Art[] = CUR_R.map(f => f.map((_, y) => f.map(r => r[7 - y]).join('')));
const CUR_D: Art[] = CUR_U.map(f => [...f].reverse());
const CABINET: Art = ['00000000', '01111110', '01122110', '01111110', '00000000', '01111110', '01122110', '01111110'];
const PAPERS: Art = ['22222222', '20000222', '20110222', '20110000', '22201110', '22201110', '22200000', '22222222'];
const KELP: Art[] = [
  ['..1...2.', '.11..21.', '..1..2..', '..11.12.', '...1.2..', '..11..2.', '..1..21.', '..1...2.'],
  ['...1..2.', '..1..21.', '.11..2..', '..1.12..', '..11.2..', '...1..2.', '..11.21.', '..1...2.'],
];

// 1977
const BRICK: Art = ['22202220', '11101110', '11101110', '00000000', '22022202', '11011101', '11011101', '00000000'];
const ASPHALT: Art = ['11111111', '11112111', '11111111', '12111111', '11111111', '11111121', '11211111', '11111111'];
const LINE: Art = ['11111111', '11111111', '11111111', '22222222', '22222222', '11111111', '11111111', '11111111'];
const WALK: Art = ['22222220', '21111110', '21111210', '21111110', '21111110', '21211110', '21111110', '00000000'];
const WINDOW: Art = ['11111111', '10000001', '10221201', '10222201', '10000001', '10222201', '10222201', '11111111'];
const TV: Art[] = [
  ['00000000', '01111110', '01222210', '01211210', '01222210', '01111110', '00000000', '.0....0.'],
  ['00000000', '01111110', '01221210', '01222210', '01212210', '01111110', '00000000', '.0....0.'],
];
const BELT: Art[] = [
  ['00000000', '02220222', '01110111', '01110111', '01110111', '01110111', '01110111', '00000000'],
  ['00000000', '22022202', '11011101', '11011101', '11011101', '11011101', '11011101', '00000000'],
];
const VAT: Art = ['00000000', '01111110', '01222210', '01212210', '01222210', '01111110', '01111110', '00000000'];
const CHASM_EDGE: Art = ['11111111', '12111211', '11111111', '00000000', '0.0.0.0.', '........', '........', '........'];
const SIGN: Art = ['00000000', '01111110', '01212210', '01111110', '00000000', '...00...', '...00...', '...00...'];
const STREETLAMP: Art = ['..1111..', '.122221.', '.122221.', '..1111..', '...11...', '...11...', '...11...', '..1111..'];

// Stone-Deep
const CFLOOR: Art = ['10000001', '01000010', '00100100', '00022000', '00022000', '00100100', '01000010', '10000001'];
const CWALL: Art = ['02222220', '20222201', '22022011', '22200111', '22200111', '22011011', '20111101', '01111110'];
const PILLAR: Art = ['00111100', '01222110', '01221110', '01221110', '01221110', '01221110', '01221110', '00111100'];
const VOIDP: Art[] = [
  ['00000000', '00000000', '00010000', '00000000', '00000000', '00000100', '00000000', '00000000'],
  ['00000000', '00100000', '00000000', '00000000', '00000010', '00000000', '00000000', '00000000'],
];
const CODE: Art = ['10110100', '00000000', '11010110', '00000000', '01101011', '00000000', '10010110', '00000000'];
const MSHELF: Art = ['11111111', '12122121', '12122121', '11111111', '12212212', '12212212', '11111111', '00000000'];
// Crystal mass: diagonal seams meet across tiles, so any block of these reads as one faceted crystal.
const HEART: Art[] = [
  ['01111110', '10111102', '11011021', '11100211', '11100211', '11022021', '10211202', '02111120'],
  ['01111110', '10111102', '11011021', '11100211', '11100221', '11022021', '10212202', '02111120'],
];

const BRASS_V: Art[] = [
  ['11111110', '12111110', '11111110', '11122110', '11122110', '11111110', '11111210', '00000000'],
  ['11111110', '12111110', '11111210', '11112110', '11121110', '11211110', '11111110', '00000000'],
  ['11111110', '11111110', '12222210', '12111210', '12111210', '12222210', '11111110', '00000000'],
  ['11011110', '11011110', '11101110', '11100110', '11110110', '11110010', '11111010', '00000000'],
];
const WALL_FRONT: Art = ['22222222', '11111110', '12111210', '11111110', '11111110', '12111210', '11111110', '00000000'];
const PLANK_V: Art[] = [
  ['11111111', '12121111', '11111111', '00000000', '11111111', '11112121', '11111111', '00000000'],
  ['11111011', '11011011', '11111011', '00000000', '12111121', '11111111', '12111121', '00000000'],
  ['11101111', '11100111', '11110011', '00001000', '11110111', '11101111', '11011111', '00000000'],
];
const SAND_V: Art[] = [
  ['11111111', '11121111', '11111111', '11111111', '11122111', '11100111', '11111111', '11111111'],
  ['11111111', '11111111', '11111111', '11112111', '11122211', '11112111', '11111111', '11111111'],
  ['11111111', '11101111', '11110111', '11110011', '11111011', '11111101', '11111111', '11111111'],
];
const LH_FRONT: Art = ['22222222', '11111110', '12111210', '11111110', '00000000', '11111110', '12111210', '00000000'];
const WALK_V: Art[] = [
  ['22222220', '21111110', '21101110', '21111110', '21111110', '21111110', '21111110', '00000000'],
  ['22222220', '21111110', '21111110', '21212110', '21121110', '21111110', '21111110', '00000000'],
  ['22222220', '21110110', '21101110', '21011110', '21101110', '21110010', '21111110', '00000000'],
];
const BRICK_FRONT: Art = ['22222222', '11101110', '11101110', '00000000', '22022202', '11011101', '11011101', '00000000'];
const CFLOOR_V: Art[] = [
  ['00010000', '00010000', '00010000', '11121111', '00010000', '00010000', '00010000', '00000000'],
  ['10010010', '01010100', '00111000', '11121111', '00111000', '01010100', '10010010', '00000000'],
  ['10000000', '01000000', '00100000', '00020000', '00001000', '00000100', '00000010', '00000001'],
  ['00002000', '00020000', '00022000', '00002000', '00020000', '00220000', '00200000', '00000000'],
];
const CWALL_FRONT: Art = ['22222222', '12201220', '12201220', '12201220', '12201220', '12201220', '12201220', '00000000'];

const T = (art: Art | Art[], c1: string, c2: string, more: Partial<TileDef> = {}): TileDef => ({ art, c1, c2, ...more });

export const TILESETS: Record<Area, Record<string, TileDef>> = {
  brass: {
    '.': T(FLOOR, BRASS.brass, BRASS.gold, { ink: BRASS.dark, variants: BRASS_V }),
    ',': T(FLOOR2, BRASS.brass, BRASS.gold, { ink: BRASS.dark, variants: [FLOOR2, BRASS_V[3]] }),
    '#': T(WALL, BRASS.brown, BRASS.brass, { ink: BRASS.dark, solid: true, front: WALL_FRONT }),
    '~': T(FLOOR, '', '', { backdrop: true, solid: true }),
    ' ': T(FLOOR, '', '', { backdrop: true, solid: true }),
    'g': T(GEAR, BRASS.brass, BRASS.gold, { ink: BRASS.dark, solid: true, rate: 20 }),
    '=': T(BRIDGE, BRASS.brass, BRASS.gold, { ink: BRASS.dark }),
    '+': T(GRATE, BRASS.brown, BRASS.brass, { ink: BRASS.dark }),
    's': T(VENT, BRASS.brass, BRASS.steam, { ink: BRASS.dark, rate: 18 }),
    'p': T(PIPE, BRASS.verdigris, BRASS.steam, { ink: BRASS.dark, solid: true }),
    'f': T(BFLOWER, BRASS.gold, BRASS.rust, { ink: BRASS.dark }),
    'b': T(SHELF, BRASS.rust, BRASS.paper, { ink: BRASS.dark, solid: true }),
    '^': T(STAIRS, BRASS.gold, BRASS.brass, { ink: BRASS.dark }),
    'c': T(CLOCK, BRASS.paper, BRASS.dark, { ink: BRASS.dark, solid: true }),
    'F': T(FOUNTAIN, BRASS.gold, BRASS.steam, { ink: BRASS.dark, solid: true, rate: 22 }),
    'r': T(RAIL, BRASS.gold, BRASS.gold, { ink: BRASS.dark, solid: true }),
    'w': T(WELL, BRASS.verdigris, BRASS.shine, { ink: BRASS.dark, well: true, rate: 16 }),
    'P': T(PLANT, BRASS.leaf, BRASS.gold, { ink: BRASS.dark, solid: true }),
    'd': T(DOOR, BRASS.brass, BRASS.dark, { ink: BRASS.dark, solid: true }),
    'L': T(LAMP, BRASS.dark, BRASS.shine, { ink: BRASS.dark, solid: true, rate: 30 }),
    'h': T(WALL, BRASS.brass, BRASS.gold, { ink: BRASS.dark, lie: true }),
    'o': T(FLOOR2, BRASS.steam, BRASS.paper, { ink: BRASS.gold }),
  },
  sea: {
    '.': T(PLANK, '#a07a50', SEA.sand, { ink: '#3a2a1a', variants: PLANK_V }),
    ',': T(SAND, SEA.sand, SEA.paper, { ink: '#6a5a40', variants: SAND_V }),
    '#': T(LHWALL, SEA.mist, SEA.paper, { ink: SEA.ink, solid: true, front: LH_FRONT }),
    '~': T(WATER, SEA.blue, SEA.teal, { ink: SEA.night, solid: true, rate: 26, water: true }),
    ' ': T(WATER, SEA.night, SEA.blue, { ink: SEA.deep, solid: true, rate: 30, water: true }),
    'o': T(WATER, SEA.teal, SEA.seafoam, { ink: SEA.blue, rate: 26 }),
    'c': T(CORAL, SEA.coral, SEA.lilac, { ink: SEA.ink, solid: true }),
    'R': T(ROCK, SEA.purple, SEA.lilac, { ink: SEA.ink, solid: true }),
    '|': T(MAST, '#7a5a3a', '#a07a50', { ink: SEA.ink, solid: true }),
    'S': T(SAIL, SEA.paper, SEA.lilac, { ink: SEA.ink, solid: true }),
    'l': T(LHFLOOR, SEA.mist, SEA.paper, { ink: SEA.ink }),
    '>': T(CUR_R, SEA.teal, SEA.seafoam, { ink: SEA.blue, push: [1, 0], rate: 10 }),
    '<': T(CUR_L, SEA.teal, SEA.seafoam, { ink: SEA.blue, push: [-1, 0], rate: 10 }),
    'u': T(CUR_U, SEA.teal, SEA.seafoam, { ink: SEA.blue, push: [0, -1], rate: 10 }),
    'n': T(CUR_D, SEA.teal, SEA.seafoam, { ink: SEA.blue, push: [0, 1], rate: 10 }),
    'C': T(CABINET, SEA.paper, SEA.ink, { ink: SEA.ink, solid: true }),
    'p': T(PAPERS, SEA.paper, SEA.mist, { ink: SEA.ink }),
    'k': T(KELP, SEA.seafoam, SEA.teal, { ink: SEA.ink, rate: 30 }),
    '^': T(STAIRS, SEA.mist, SEA.paper, { ink: SEA.ink }),
    'L': T(LAMP, SEA.ink, SEA.lamp, { ink: SEA.ink, solid: true, rate: 30 }),
    '=': T(BRIDGE, '#7a5a3a', SEA.sand, { ink: SEA.ink }),
    'b': T(SHELF, SEA.purple, SEA.paper, { ink: SEA.ink, solid: true }),
    'h': T(LHWALL, SEA.mist, SEA.paper, { ink: SEA.ink, lie: true }),
    'r': T(RAIL, '#a07a50', '#a07a50', { ink: SEA.ink, solid: true }),
  },
  year: {
    '.': T(WALK, YEAR.yellow, YEAR.pale, { ink: YEAR.mustard, variants: WALK_V }),
    ',': T(ASPHALT, YEAR.mustard, YEAR.yellow, { ink: YEAR.brown }),
    '-': T(LINE, YEAR.mustard, YEAR.pale, { ink: YEAR.brown }),
    '#': T(BRICK, YEAR.mustard, YEAR.yellow, { ink: YEAR.brown, solid: true, front: BRICK_FRONT }),
    'W': T(WINDOW, YEAR.yellow, YEAR.green, { ink: YEAR.brown, solid: true }),
    '~': T(FLOOR, '', '', { backdrop: true, solid: true }),
    ' ': T(VOIDP, YEAR.dark, YEAR.dark, { ink: YEAR.dark, solid: true, rate: 40 }),
    't': T(TV, YEAR.gray, YEAR.green, { ink: YEAR.dark, solid: true, rate: 14 }),
    '>': T(BELT, YEAR.gray, YEAR.mustard, { ink: YEAR.dark, push: [1, 0], rate: 8 }),
    '<': T(BELT, YEAR.gray, YEAR.mustard, { ink: YEAR.dark, push: [-1, 0], rate: 8 }),
    'v': T(VAT, YEAR.meat, YEAR.green, { ink: YEAR.dark, solid: true }),
    'e': T(CHASM_EDGE, YEAR.orange, YEAR.yellow, { ink: YEAR.dark }),
    'S': T(SIGN, YEAR.orange, YEAR.pale, { ink: YEAR.dark, solid: true }),
    'L': T(STREETLAMP, YEAR.gray, YEAR.yellow, { ink: YEAR.dark, solid: true }),
    'P': T(PLANT, YEAR.dkgreen, YEAR.green, { ink: YEAR.dark, solid: true }),
    '+': T(GRATE, YEAR.gray, YEAR.mustard, { ink: YEAR.dark }),
    '^': T(STAIRS, YEAR.orange, YEAR.yellow, { ink: YEAR.dark }),
    'd': T(DOOR, YEAR.orange, YEAR.dark, { ink: YEAR.dark, solid: true }),
    'b': T(SHELF, YEAR.orange, YEAR.pale, { ink: YEAR.dark, solid: true }),
    'h': T(BRICK, YEAR.yellow, YEAR.orange, { ink: YEAR.brown, lie: true }),
    'o': T(FLOOR2, YEAR.pale, YEAR.teeth, { ink: YEAR.mustard }),
  },
  stone: {
    '.': T(CFLOOR, STONE.blue, STONE.cyan, { ink: STONE.deep, variants: CFLOOR_V }),
    ',': T(CFLOOR, STONE.violet, STONE.magenta, { ink: STONE.deep }),
    '#': T(CWALL, STONE.cyan, STONE.white, { ink: STONE.deep, solid: true, front: CWALL_FRONT }),
    'I': T(PILLAR, STONE.magenta, STONE.pink, { ink: STONE.deep, solid: true }),
    '~': T(VOIDP, STONE.white, STONE.white, { ink: STONE.void, solid: true, rate: 40 }),
    ' ': T(VOIDP, STONE.white, STONE.white, { ink: STONE.void, solid: true, rate: 40 }),
    'v': T(VOIDP, STONE.violet, STONE.violet, { ink: STONE.void, rate: 40, harm: 3 }),
    'x': T(CODE, STONE.acid, STONE.acid, { ink: STONE.void, hidden: true }),
    'b': T(MSHELF, STONE.cyan, STONE.pink, { ink: STONE.deep, solid: true }),
    'H': T(HEART, STONE.magenta, STONE.white, { ink: STONE.deep, solid: true, rate: 20 }),
    'K': T(CFLOOR, STONE.violet, STONE.magenta, { ink: STONE.deep, solid: true }),
    '^': T(STAIRS, STONE.cyan, STONE.white, { ink: STONE.deep }),
    'h': T(CWALL, STONE.cyan, STONE.white, { ink: STONE.deep, lie: true }),
    'k': T(CWALL, STONE.acid, STONE.white, { ink: STONE.deep, solid: true }),
    'o': T(CFLOOR, STONE.acid, STONE.white, { ink: STONE.deep }),
  },
  void: {
    '.': T(CFLOOR, VOID.dim, VOID.mid, { ink: VOID.black }),
    ',': T(CFLOOR, VOID.mid, VOID.white, { ink: VOID.black }),
    '#': T(CWALL, VOID.mid, VOID.white, { ink: VOID.black, solid: true }),
    '~': T(VOIDP, VOID.dim, VOID.dim, { ink: VOID.black, solid: true, rate: 40 }),
    ' ': T(VOIDP, VOID.dim, VOID.dim, { ink: VOID.black, solid: true, rate: 40 }),
    'v': T(VOIDP, VOID.mid, VOID.mid, { ink: VOID.black, rate: 40 }),
    'H': T(HEART, VOID.white, VOID.mid, { ink: VOID.black, solid: true, rate: 20 }),
    'o': T(CFLOOR, VOID.white, VOID.white, { ink: VOID.black }),
  },
};

// Walls block light. Lamps, vents, crystals, and screens give it off. Void drinks it.
const OPAQUE = new Set(['#', 'b', 'W', 'C', 'd', 'S', 'I', 'k', 'h']);
const LIGHTS: Partial<Record<Area, Record<string, NonNullable<TileDef['light']>>>> = {
  brass: { L: { r: 40, i: 0.9, color: '#f0cc6c' }, s: { r: 22, i: 0.45, color: '#e8e4dc' }, F: { r: 34, i: 0.6, color: '#e8e4dc' }, w: { r: 18, i: 0.4, color: '#4a8a74' } },
  sea: { L: { r: 48, i: 1.0, color: '#f8e090' }, c: { r: 14, i: 0.35, color: '#e07088' }, k: { r: 12, i: 0.3, color: '#64c8b0' }, o: { r: 10, i: 0.25, color: '#64c8b0' } },
  year: { L: { r: 38, i: 0.9, color: '#e8c838' }, t: { r: 26, i: 0.6, color: '#40d868' }, v: { r: 24, i: 0.6, color: '#40d868' } },
  stone: {
    H: { r: 44, i: 1.0, color: '#f03cc4' }, I: { r: 18, i: 0.35, color: '#ff98e0' }, k: { r: 20, i: 0.5, color: '#a8f040' },
    v: { r: 20, i: 0.6, color: '#000000', negative: true }, x: { r: 10, i: 0.3, color: '#a8f040' }, '#': { r: 10, i: 0.18, color: '#48f0e4' },
  },
  void: { H: { r: 50, i: 1.1, color: '#f4f0ff' }, v: { r: 22, i: 0.7, color: '#000000', negative: true } },
};
for (const [area, set] of Object.entries(TILESETS) as [Area, Record<string, TileDef>][]) {
  for (const [ch, t] of Object.entries(set)) {
    if (OPAQUE.has(ch) && (t.solid || t.lie)) t.opaque = true;
    const l = LIGHTS[area]?.[ch];
    if (l) t.light = l;
  }
}
