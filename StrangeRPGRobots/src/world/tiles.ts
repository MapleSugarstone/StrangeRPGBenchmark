// Tile types and their procedural textures. Every texture is a pure function of the pixel's place, so the
// same tile always looks the same. Walls draw a facade where a floor lies south of them and a roof elsewhere.
import { C } from '../engine/palette';

export const T = 10;

export type Water = 'none' | 'shallow' | 'deep';

export interface TileDef {
  ch: string;
  name: string;
  walk: boolean;
  /** Blocks sight and light. */
  opaque: boolean;
  /** Cover this tile gives to a unit next to it: 0 none, 1 half, 2 full. */
  cover: 0 | 1 | 2;
  /** Draws as a building block with a facade and a roof. */
  wall: boolean;
  /** Facade height in tiles for walls. */
  faceRows?: number;
  /** Floor class written under the texture: 1 dry, 2 wet, 3 puddle, 4 water. */
  floor: number;
  water: Water;
  /** Texture for the floor or roof. */
  tex: (lx: number, ly: number, tx: number, ty: number, t: number) => number;
  /** Facade texture. `row` is 0 for the bottom face row, 1 for the one above. */
  face?: (lx: number, ly: number, tx: number, ty: number, row: number) => number;
  /** Facade pixels that glow (lit windows): returns true for an emissive pixel. */
  faceGlow?: (lx: number, ly: number, tx: number, ty: number, row: number) => boolean;
  /** Stairs and ladders let units change elevation. */
  climb?: boolean;
}

export function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const pick = (v: number, arr: number[]) => arr[Math.floor(v * arr.length) % arr.length];

function concrete(lx: number, ly: number, tx: number, ty: number): number {
  const gx = tx * T + lx, gy = ty * T + ly;
  const n = hash(gx, gy, 1);
  if (lx === 0 && hash(tx, ty, 2) < 0.5) return C.night;
  if (ly === 0 && hash(tx, ty, 3) < 0.4) return C.night;
  if (n < 0.025) return C.night;
  if (n > 0.985) return C.gray;
  return C.slate;
}

function crackedConcrete(lx: number, ly: number, tx: number, ty: number): number {
  const c = concrete(lx, ly, tx, ty);
  const h = hash(tx, ty, 9);
  if (h < 0.25 && Math.abs(lx - Math.floor(h * 40) % T + (ly >> 1) - 3) < 1 && ly > 2) return C.black;
  return c;
}

function planks(lx: number, ly: number, tx: number, ty: number): number {
  const gy = ty * T + ly;
  if (gy % 5 === 4) return C.black;
  const plank = Math.floor(gy / 5);
  const seam = (Math.floor(hash(plank, tx, 4) * 10) + tx * 3) % T;
  if (lx === seam) return C.mud0;
  const n = hash(tx * T + lx, gy, 5);
  if (n < 0.08) return C.mud1;
  return hash(plank, tx >> 1, 6) < 0.5 ? C.mud2 : C.mud1;
}

function grate(lx: number, ly: number): number {
  if (lx % 3 === 0 || ly % 3 === 0) return C.slate;
  return C.black;
}

function asphalt(lx: number, ly: number, tx: number, ty: number): number {
  const n = hash(tx * T + lx, ty * T + ly, 7);
  if (n < 0.05) return C.gray;
  return n < 0.5 ? C.night : C.slate;
}

function tiles(lx: number, ly: number, tx: number, ty: number, a: number, b: number): number {
  if (lx === 0 || ly === 0) return C.black;
  return ((tx + ty) & 1) ? a : b;
}

function roof(lx: number, ly: number, tx: number, ty: number): number {
  const n = hash(tx * T + lx, ty * T + ly, 11);
  const h = hash(tx, ty, 12);
  if (h < 0.12 && lx > 2 && lx < 7 && ly > 2 && ly < 7) return lx === 3 || ly === 3 ? C.slate : C.night;
  if (h > 0.9 && lx === 5) return C.slate;
  if (n < 0.04) return C.night;
  return C.ink;
}

function megaFace(lx: number, ly: number, tx: number, ty: number, row: number): number {
  if (row === 0 && ly >= 8) return ly === 9 ? C.black : C.ink;
  const winRow = ly >= 2 && ly <= 5;
  const winCol = (lx >= 1 && lx <= 3) || (lx >= 6 && lx <= 8);
  if (winRow && winCol) return C.black;
  if (ly === 0) return C.slate;
  return hash(tx, ty, 13 + row) < 0.5 ? C.night : C.ink;
}

function megaGlow(lx: number, ly: number, tx: number, ty: number, row: number): boolean {
  const winRow = ly >= 2 && ly <= 5;
  const left = lx >= 1 && lx <= 3, right = lx >= 6 && lx <= 8;
  if (!winRow || !(left || right)) return false;
  const h = hash(tx * 2 + (right ? 1 : 0), ty * 3 + row, 14);
  return h < 0.32;
}

/** Window colors, chosen per window by hash: warm amber, cold cyan, violet screens. */
export function windowColor(tx: number, ty: number, lx: number, row: number): number {
  const h = hash(tx * 2 + (lx >= 5 ? 1 : 0), ty * 3 + row, 15);
  return h < 0.5 ? C.amb3 : h < 0.75 ? C.cyan3 : h < 0.9 ? C.vio3 : C.mag3;
}

function containerFace(lx: number, ly: number, tx: number, ty: number): number {
  const hue = Math.floor(hash(tx >> 1, ty, 16) * 4);
  const ramp = [[C.cyan0, C.cyan1], [C.mag0, C.mag1], [C.mud0, C.mud1], [C.vio0, C.vio1]][hue];
  if (ly === 0 || ly === 9) return C.black;
  if (lx % 2 === 0) return ramp[0];
  return ramp[1];
}

function shackFace(lx: number, ly: number, tx: number, ty: number): number {
  if (ly === 9) return C.black;
  if (ly === 0) return C.mud0;
  const door = hash(tx, ty, 17) < 0.25 && lx >= 3 && lx <= 6 && ly >= 3;
  if (door) return C.black;
  return lx % 3 === 0 ? C.slate : C.night;
}

function shopFace(lx: number, ly: number): number {
  if (ly === 9) return C.black;
  if (ly <= 1) return C.slate;
  if (lx === 0 || lx === 9) return C.night;
  return C.black;
}

function seawallFace(lx: number, ly: number, tx: number, ty: number, row: number): number {
  if (ly === 0 && row === 1) return C.steel3;
  if ((ty * T + ly) % 5 === 0) return C.steel0;
  if (lx === 0 && hash(tx, ty, 18) < 0.5) return C.steel0;
  return row === 0 ? C.steel1 : C.steel2;
}

const water = (deep: boolean) => (lx: number, ly: number, tx: number, ty: number, t: number): number => {
  const gx = tx * T + lx, gy = ty * T + ly;
  const wave = Math.sin(gx * 0.45 + gy * 0.9 + t * 1.6) + Math.sin(gx * 0.17 - t * 0.9 + gy * 0.31);
  if (wave > 1.55) return deep ? C.cyan1 : C.slate;
  if (wave > 1.1 && (gx + gy) % 2 === 0) return deep ? C.cyan0 : C.night;
  if (!deep) return hash(gx, gy, 19) < 0.04 ? C.slate : C.ink;
  return C.black;
};

function puddle(lx: number, ly: number, tx: number, ty: number): number {
  return concrete(lx, ly, tx, ty);
}

/** Pixels of a puddle tile that hold water, by an oval per tile. */
export function puddleMask(lx: number, ly: number, tx: number, ty: number): boolean {
  const cx = 3 + hash(tx, ty, 20) * 4, cy = 3 + hash(tx, ty, 21) * 4;
  const rx = 3 + hash(tx, ty, 22) * 2, ry = 2 + hash(tx, ty, 23) * 2;
  const dx = (lx - cx) / rx, dy = (ly - cy) / ry;
  return dx * dx + dy * dy < 1;
}

function lowWallTex(lx: number, ly: number): number {
  if (ly < 3) return ly === 0 ? C.gray : C.slate;
  if (ly === 9) return C.black;
  return lx % 5 === 0 ? C.ink : C.night;
}

function railTex(lx: number, ly: number, tx: number, ty: number): number {
  if (ly === 3) return C.gray;
  if (ly > 3 && lx % 5 === 2) return C.slate;
  return water(true)(lx, ly, tx, ty, 0);
}

function stairsTex(lx: number, ly: number): number {
  if (ly % 3 === 2) return C.black;
  return ly % 3 === 0 ? C.slate : C.night;
}

function ladderTex(lx: number, ly: number, tx: number, ty: number): number {
  if (lx === 2 || lx === 7) return C.gray;
  if (ly % 3 === 1 && lx > 2 && lx < 7) return C.slate;
  return concrete(lx, ly, tx, ty);
}

function carpet(lx: number, ly: number, tx: number, ty: number): number {
  const n = hash(tx * T + lx, ty * T + ly, 24);
  return n < 0.1 ? C.vio0 : C.mag0;
}

function lino(lx: number, ly: number, tx: number, ty: number): number {
  return tiles(lx, ly, tx, ty, C.night, C.slate);
}

function marble(lx: number, ly: number, tx: number, ty: number): number {
  if (lx === 0 || ly === 0) return C.gray;
  const n = hash(tx * T + lx, ty * T + ly, 25);
  return n < 0.08 ? C.gray : C.pale;
}

function steelFloor(lx: number, ly: number, tx: number, ty: number): number {
  if (lx === 0 || ly === 0) return C.steel0;
  const n = hash(tx * T + lx, ty * T + ly, 26);
  if ((lx === 2 || lx === 7) && (ly === 2 || ly === 7)) return C.steel2;
  return n < 0.06 ? C.steel0 : C.steel1;
}

function rubble(lx: number, ly: number, tx: number, ty: number): number {
  const n = hash(tx * T + lx, ty * T + ly, 27);
  if (n < 0.25) return C.slate;
  if (n < 0.4) return C.gray;
  return concrete(lx, ly, tx, ty);
}

function voidTex(): number { return C.black; }

function moss(lx: number, ly: number, tx: number, ty: number): number {
  const n = hash(tx * T + lx, ty * T + ly, 28);
  if (n < 0.3) return C.grn0;
  if (n < 0.36) return C.grn1;
  return concrete(lx, ly, tx, ty);
}

const D = (o: Partial<TileDef> & Pick<TileDef, 'ch' | 'name' | 'tex'>): TileDef => ({
  walk: true, opaque: false, cover: 0, wall: false, floor: 2, water: 'none', ...o,
});

export const TILES: TileDef[] = [
  D({ ch: '.', name: 'wet concrete', tex: concrete }),
  D({ ch: ',', name: 'cracked concrete', tex: crackedConcrete }),
  D({ ch: '_', name: 'boardwalk', tex: planks }),
  D({ ch: '=', name: 'grate', tex: grate, floor: 1 }),
  D({ ch: ':', name: 'road', tex: asphalt }),
  D({ ch: 'o', name: 'puddle', tex: puddle, floor: 3 }),
  D({ ch: 'w', name: 'shallow water', tex: water(false), floor: 4, water: 'shallow' }),
  D({ ch: '~', name: 'canal', tex: water(true), floor: 4, water: 'deep', walk: false }),
  D({ ch: 'r', name: 'railing', tex: railTex, walk: false, cover: 1, floor: 4, water: 'deep' }),
  D({ ch: 'm', name: 'moss', tex: moss }),
  D({ ch: '%', name: 'rubble', tex: rubble }),
  D({ ch: 't', name: 'tile floor', tex: lino, floor: 1 }),
  D({ ch: 'p', name: 'carpet', tex: carpet, floor: 1 }),
  D({ ch: 'q', name: 'marble', tex: marble, floor: 2 }),
  D({ ch: 'n', name: 'steel floor', tex: steelFloor, floor: 2 }),
  D({ ch: 's', name: 'stairs', tex: stairsTex, climb: true, floor: 1 }),
  D({ ch: 'H', name: 'ladder', tex: ladderTex, climb: true }),
  D({ ch: '|', name: 'low wall', tex: lowWallTex, walk: false, cover: 1, floor: 0 }),
  D({ ch: ' ', name: 'void', tex: voidTex, walk: false, floor: 0 }),
  D({ ch: '#', name: 'megablock', tex: roof, wall: true, faceRows: 2, face: megaFace, faceGlow: megaGlow, walk: false, opaque: true, cover: 2, floor: 0 }),
  D({ ch: 'K', name: 'containers', tex: roof, wall: true, faceRows: 1, face: containerFace, walk: false, opaque: true, cover: 2, floor: 0 }),
  D({ ch: 'S', name: 'shack', tex: roof, wall: true, faceRows: 1, face: shackFace, walk: false, opaque: true, cover: 2, floor: 0 }),
  D({ ch: 'G', name: 'shopfront', tex: roof, wall: true, faceRows: 1, face: shopFace, walk: false, opaque: true, cover: 2, floor: 0 }),
  D({ ch: 'X', name: 'seawall', tex: roof, wall: true, faceRows: 2, face: seawallFace, walk: false, opaque: true, cover: 2, floor: 0 }),
  D({ ch: 'I', name: 'interior wall', tex: () => C.black, wall: true, faceRows: 1, face: (lx, ly) => (ly === 9 ? C.black : ly < 2 ? C.slate : C.night), walk: false, opaque: true, cover: 2, floor: 0 }),
];

export const TILE_BY_CH = new Map<string, TileDef>(TILES.map((t) => [t.ch, t]));
export const VOID = TILE_BY_CH.get(' ')!;
