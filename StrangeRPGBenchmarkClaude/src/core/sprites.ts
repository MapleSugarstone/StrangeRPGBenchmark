import { Rng, hash } from './rng';
import type { Pal3 } from './palette';

/** 8x8 grid of palette indices. 0 is transparent, 1..3 index the sprite's three colors. */
export type Pix = Uint8Array;

export interface SpriteSpec {
  g: string;
  seed?: string | number;
  pal: Pal3;
  o?: Record<string, string | number | boolean>;
  /** Width and height in 8x8 tiles. Bosses use 2 or 3. */
  n?: number;
}

export function specKey(s: SpriteSpec): string {
  return `${s.g}|${s.seed ?? ''}|${s.pal.join(',')}|${s.o ? JSON.stringify(s.o) : ''}|${s.n ?? 1}`;
}

const blank = (n = 8) => new Uint8Array(n * n);

function mirror(half: number[][], n = 8): Pix {
  const p = blank(n);
  const hw = n / 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < hw; x++) {
    const v = half[y][x];
    p[y * n + x] = v;
    p[y * n + (n - 1 - x)] = v;
  }
  return p;
}

function rowsToHalf(rows: string[]): number[][] {
  return rows.map(r => r.split('').map(c => +c));
}

// ---------- Monsters ----------

const PLANS: Record<string, string[]> = {
  blob: ['0013', '0268', '1599', '2799', '2799', '1599', '0368', '0123'],
  bug: ['0021', '0157', '3489', '1699', '4599', '2689', '5264', '4030'],
  flyer: ['0002', '3127', '6759', '8989', '5899', '1368', '0036', '0013'],
  tall: ['0036', '0179', '0289', '0399', '1599', '0399', '0298', '0206'],
  ghost: ['0027', '0379', '1799', '2899', '2899', '3899', '4999', '5070'],
  eye: ['0036', '0389', '2899', '3999', '3999', '2899', '0389', '0036'],
  crawler: ['0000', '0000', '0026', '1379', '4899', '6999', '4999', '6060'],
  totem: ['0288', '0299', '0599', '0299', '0399', '0299', '0599', '0288'],
  star: ['0009', '0019', '0059', '5999', '0799', '0299', '0507', '3002'],
  worm: ['0000', '0280', '2892', '8906', '6008', '0068', '0089', '0036'],
};
export const SHAPES = Object.keys(PLANS);

function neighbors(p: Pix, n: number, x: number, y: number): number {
  let c = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < n && ny < n && p[ny * n + nx]) c++;
  }
  return c;
}

function monsterOnce(r: Rng, shape: string, n: number): Pix {
  const plan = PLANS[shape] ?? PLANS.blob;
  const hw = n / 2;
  const half: number[][] = [];
  for (let y = 0; y < n; y++) {
    half.push([]);
    for (let x = 0; x < hw; x++) {
      const py = Math.floor((y * 8) / n);
      const px = Math.floor((x * 4) / hw);
      const prob = +plan[py][px] / 9;
      half[y].push(r.next() < prob * 0.95 + 0.02 ? 2 : 0);
    }
  }
  let p = mirror(half, n);
  // Drop pixels with no orthogonal neighbor.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (p[y * n + x] && neighbors(p, n, x, y) === 0) p[y * n + x] = 0;
  const swap = r.chance(0.5);
  const edge = swap ? 3 : 2;
  const core = swap ? 2 : 3;
  const q = blank(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!p[y * n + x]) continue;
    q[y * n + x] = neighbors(p, n, x, y) < 4 ? edge : core;
  }
  // Sprinkle accent stripes inside the body.
  const stripe = r.int(0, 2);
  if (stripe > 0) {
    const sy = r.int(Math.floor(n * 0.45), n - 2);
    for (let x = 0; x < n; x++) if (q[sy * n + x] === core) q[sy * n + x] = edge;
  }
  // Eyes: the first row from the top with a filled pixel near the center gets a symmetric pair.
  const eyeX = r.int(Math.max(1, hw - 3), hw - 1);
  for (let y = 1; y < n - 2; y++) {
    if (q[y * n + eyeX] && q[y * n + (n - 1 - eyeX)] && q[(y - 1) * n + eyeX]) {
      q[y * n + eyeX] = 1;
      q[y * n + (n - 1 - eyeX)] = 1;
      break;
    }
  }
  // Mouth or markings.
  if (r.chance(0.6)) {
    for (let y = n - 3; y > n / 2; y--) {
      const mx = hw - 1;
      if (q[y * n + mx] && q[y * n + mx + 1]) { q[y * n + mx] = 1; q[y * n + mx + 1] = 1; break; }
    }
  }
  return q;
}

function countFilled(p: Pix): number {
  let c = 0;
  for (const v of p) if (v) c++;
  return c;
}

export function genMonster(seed: string | number, shape: string, n = 1): Pix {
  const size = 8 * n;
  const r = new Rng(typeof seed === 'string' ? hash(seed + shape) : seed);
  let best = monsterOnce(r, shape, size);
  for (let i = 0; i < 12 && countFilled(best) < size * size * 0.38; i++) best = monsterOnce(r, shape, size);
  return best;
}

// ---------- Humanoids ----------

const HEADS: Record<string, string[]> = {
  bald: ['0000', '0033', '0013', '0033'],
  hair: ['0022', '0222', '0213', '0033'],
  hood: ['0022', '0222', '0213', '0233'],
  wizard: ['0002', '0022', '0222', '0013'],
  helm: ['0022', '0222', '0211', '0232'],
  antenna: ['0010', '0033', '0013', '0033'],
  horns: ['0100', '0133', '0013', '0033'],
  crown: ['0303', '0333', '0013', '0033'],
  halo: ['0333', '0033', '0013', '0033'],
  cyclops: ['0022', '0222', '0221', '0222'],
  bun: ['0003', '0033', '0313', '0033'],
  brim: ['0022', '2222', '0013', '0033'],
  bubble: ['0333', '3003', '3013', '0333'],
  mask: ['0022', '0222', '0212', '0222'],
};
const TORSOS: Record<string, string[]> = {
  plain: ['0222', '0222'],
  arms: ['2222', '3022'],
  belt: ['0222', '0211'],
  cape: ['1222', '1222'],
  armor: ['3223', '0232'],
  robe: ['0222', '0232'],
  vest: ['2322', '3022'],
  wide: ['2222', '2222'],
};
const LEGS: Record<string, string[]> = {
  legs: ['0022', '0010'],
  robe: ['0222', '2222'],
  skirt: ['0222', '0101'],
  wheels: ['0222', '0101'],
  stance: ['0202', '0101'],
  float: ['0022', '0002'],
  tail: ['0022', '0033'],
};

export const HEAD_KEYS = Object.keys(HEADS);
export const TORSO_KEYS = Object.keys(TORSOS);
export const LEG_KEYS = Object.keys(LEGS);

const HELD: Record<string, [number, number, number][]> = {
  lamp: [[7, 3, 1], [7, 4, 3], [7, 5, 3], [6, 5, 1]],
  staff: [[7, 0, 3], [7, 1, 1], [7, 2, 1], [7, 3, 1], [7, 4, 1], [7, 5, 1], [7, 6, 1]],
  sword: [[7, 1, 3], [7, 2, 3], [7, 3, 3], [7, 4, 1], [6, 4, 1]],
  brush: [[7, 0, 3], [7, 1, 3], [7, 2, 1], [7, 3, 1], [7, 4, 1], [7, 5, 1]],
  book: [[6, 4, 3], [7, 4, 3], [6, 5, 1], [7, 5, 3]],
  coin: [[7, 4, 3], [7, 5, 3]],
  flag: [[7, 0, 1], [6, 0, 3], [6, 1, 3], [7, 1, 1], [7, 2, 1], [7, 3, 1], [7, 4, 1], [7, 5, 1]],
};

export function genHumanoid(seed: string | number, o: Record<string, string | number | boolean> = {}): Pix {
  const r = new Rng(typeof seed === 'string' ? hash(seed) : seed);
  const head = (o.head as string) ?? r.pick(HEAD_KEYS);
  const torso = (o.torso as string) ?? r.pick(TORSO_KEYS);
  const legs = (o.legs as string) ?? r.pick(LEG_KEYS);
  const rows = [...HEADS[head] ?? HEADS.bald, ...TORSOS[torso] ?? TORSOS.plain, ...LEGS[legs] ?? LEGS.legs];
  const p = mirror(rowsToHalf(rows));
  const held = (o.held as string) ?? (r.chance(0.3) ? r.pick(Object.keys(HELD)) : '');
  for (const [x, y, v] of HELD[held] ?? []) p[y * 8 + x] = v;
  return p;
}

// ---------- Beasts and set pieces ----------

const BEASTS: Record<string, string[]> = {
  cat: ['03000030', '03333330', '03133130', '03322330', '00333300', '03333332', '03333332', '01311312'],
  nona: ['30000003', '33333333', '31333313', '03322330', '20333302', '22333322', '22333322', '21311312'],
  frog: ['00000000', '01300310', '33333333', '32222223', '03333330', '33222233', '30333303', '11000011'],
  bird: ['00022000', '00212200', '00222330', '02222000', '22222200', '02222000', '00202000', '00101000'],
  fish: ['00000000', '00022000', '20222320', '22221230', '22222330', '20222320', '00022000', '00000000'],
  moth: ['30000003', '33300333', '32311323', '33322333', '03322330', '33322333', '30322303', '00011000'],
  slug: ['00000000', '00000000', '00100100', '00333300', '03333330', '33322333', '23333332', '22222222'],
  robo: ['00011000', '00333300', '03122130', '03333330', '11222211', '01233210', '00222200', '01100110'],
  vend: ['22222222', '23311332', '23333332', '23131312', '23333332', '21111112', '22222222', '10000001'],
  mirror: ['00222200', '02333320', '23311332', '23333332', '23333332', '02333320', '00222200', '00111100'],
  blank: ['00222200', '02333320', '23133132', '23333332', '02333320', '00333300', '02300320', '02000020'],
  monk: ['00022000', '00233200', '00213200', '02222220', '22232322', '02222220', '02222220', '01100110'],
  bishop: ['00033000', '00333300', '00222200', '00212200', '03222230', '32223223', '32222223', '33333333'],
  sheep: ['00000000', '03333330', '33333333', '13313333', '33333333', '03333330', '01100110', '01100110'],
  whale: ['00000000', '00222200', '02222220', '22122222', '22222223', '23333322', '02333220', '00000033'],
};

export function genBeast(kind: string): Pix {
  const rows = BEASTS[kind] ?? BEASTS.cat;
  const p = blank();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p[y * 8 + x] = +rows[y][x];
  return p;
}

// ---------- Props (entities with transparency) ----------

const PROPS: Record<string, string[]> = {
  lamp: ['00111100', '01322310', '01322310', '00111100', '00011000', '00011000', '00011000', '00111100'],
  lampOff: ['00111100', '01000010', '01000010', '00111100', '00011000', '00011000', '00011000', '00111100'],
  chest: ['00000000', '00000000', '01111110', '12222221', '13311331', '12233221', '12222221', '01111110'],
  chestOpen: ['00000000', '01111110', '13333331', '11111111', '12211221', '12222221', '12222221', '01111110'],
  sign: ['00000000', '11111111', '12222221', '13333331', '12222221', '11111111', '00011000', '00011000'],
  bell: ['00011000', '00122100', '01222210', '01223210', '01222210', '12222221', '11111111', '00033000'],
  crystal: ['00011000', '00132100', '01332210', '01322210', '01322210', '00132100', '00122100', '00011000'],
  orb: ['00000000', '00111100', '01332210', '01322210', '01222210', '01222210', '00111100', '00000000'],
  sundial: ['00000000', '00011000', '00013000', '01113110', '12222221', '12232221', '12222221', '01111110'],
  pool: ['00000000', '00000000', '00222200', '02333320', '23322332', '02333320', '00222200', '00000000'],
  spool: ['01111110', '00122100', '00333300', '00222200', '00333300', '00222200', '00122100', '01111110'],
  tube: ['01111110', '12333321', '12300321', '12300321', '12300321', '12300321', '12333321', '01111110'],
  star: ['00010000', '00131000', '01333100', '13323310', '01333100', '00131000', '00010000', '00000000'],
  statue: ['00111100', '01222210', '01212210', '01222210', '00122100', '01222210', '01222210', '11111111'],
  bed: ['00000000', '11111111', '13333331', '13322221', '12222221', '12222221', '11111111', '10000001'],
  pot: ['00000000', '00111100', '01222210', '12233221', '12222221', '12222221', '01222210', '00111100'],
  switch: ['00000000', '00000000', '00011100', '00013100', '00011100', '00010000', '01111110', '12222221'],
  terminal: ['11111111', '12222221', '12333221', '12232321', '12222221', '11111111', '01222210', '11111111'],
};

export function genProp(kind: string): Pix {
  const rows = PROPS[kind] ?? PROPS.chest;
  const p = blank();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p[y * 8 + x] = +rows[y][x];
  return p;
}

// ---------- Terrain tiles (opaque) ----------

type TileGen = (r: Rng, v: number, f: number) => Pix;

function fill(c: number): Pix {
  return new Uint8Array(64).fill(c);
}
function speck(p: Pix, r: Rng, c: number, prob: number) {
  for (let i = 0; i < 64; i++) if (r.next() < prob) p[i] = c;
}
function set(p: Pix, x: number, y: number, c: number) {
  if (x >= 0 && y >= 0 && x < 8 && y < 8) p[y * 8 + x] = c;
}

const TILES: Record<string, TileGen> = {
  ground: (r) => { const p = fill(2); speck(p, r, 3, 0.08); speck(p, r, 1, 0.02); return p; },
  grass: (r) => {
    const p = fill(2);
    for (let i = 0; i < 3; i++) { const x = r.int(0, 6), y = r.int(1, 7); set(p, x, y, 3); set(p, x + 1, y - 1, 3); }
    speck(p, r, 1, 0.015);
    return p;
  },
  tall: (r, v, f) => {
    const p = fill(2);
    const sway = f % 2;
    for (let x = 0; x < 8; x += 2) {
      const h = r.int(3, 6);
      for (let y = 7; y > 7 - h; y--) set(p, x + ((y < 4 && sway) ? 1 : 0), y, y === 8 - h ? 3 : 1);
    }
    return p;
  },
  flowers: (r) => {
    const p = fill(2);
    for (let i = 0; i < 2; i++) { const x = r.int(1, 6), y = r.int(1, 6); set(p, x, y, 3); set(p, x - 1, y, 3); set(p, x + 1, y, 3); set(p, x, y - 1, 3); set(p, x, y + 1, 3); set(p, x, y, 1); }
    return p;
  },
  path: (r) => { const p = fill(3); speck(p, r, 2, 0.12); speck(p, r, 1, 0.02); return p; },
  sand: (r, v) => {
    const p = fill(3);
    for (let x = 0; x < 8; x++) { const y = (x + v * 3) % 8; if (r.chance(0.5)) set(p, x, y, 2); }
    speck(p, r, 2, 0.05);
    return p;
  },
  floor: (r, v) => {
    const p = fill(2);
    for (let i = 0; i < 8; i++) { set(p, i, 0, 1); set(p, 0, i, 1); }
    set(p, 1, 1, 3); set(p, 2, 1, 3); set(p, 1, 2, 3);
    if (v === 1) speck(p, r, 3, 0.04);
    return p;
  },
  planks: (r) => {
    const p = fill(2);
    for (let x = 0; x < 8; x++) { set(p, x, 3, 1); set(p, x, 7, 1); }
    set(p, r.int(0, 7), 1, 3); set(p, r.int(0, 7), 5, 3);
    set(p, 2, 0, 1); set(p, 2, 1, 1); set(p, 2, 2, 1); set(p, 6, 4, 1); set(p, 6, 5, 1); set(p, 6, 6, 1);
    return p;
  },
  carpet: (r, v) => {
    const p = fill(2);
    for (let i = 0; i < 8; i++) { set(p, i, i, 3); set(p, 7 - i, i, 3); }
    set(p, 3, 3, 1); set(p, 4, 4, 1); set(p, 3, 4, 1); set(p, 4, 3, 1);
    return p;
  },
  brick: (r) => {
    const p = fill(2);
    for (let x = 0; x < 8; x++) { set(p, x, 3, 1); set(p, x, 7, 1); }
    for (let y = 0; y < 3; y++) set(p, 3, y, 1);
    for (let y = 4; y < 7; y++) set(p, 7, y, 1);
    set(p, 0, 0, 3); set(p, 1, 0, 3); set(p, 4, 4, 3); set(p, 5, 4, 3);
    return p;
  },
  wall: (r) => {
    const p = fill(2);
    for (let x = 0; x < 8; x++) { set(p, x, 0, 3); set(p, x, 7, 1); }
    speck(p, r, 1, 0.05);
    set(p, r.int(1, 6), r.int(2, 5), 3);
    return p;
  },
  rock: (r) => {
    const p = fill(2);
    const shape = ['00111100', '01333310', '13322231', '13222221', '12222221', '12222211', '01222110', '00111100'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = +shape[y][x]; if (c) p[y * 8 + x] = c; }
    speck(p, r, 2, 0);
    return p;
  },
  tree: (r, v) => {
    const p = fill(2);
    const shape = ['00333300', '03333330', '33333333', '33313333', '33333313', '03333330', '00011000', '00011000'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = +shape[y][x]; if (c) p[y * 8 + x] = c; }
    if (v % 2) { set(p, 2, 2, 1); set(p, 4, 3, 2); }
    return p;
  },
  pine: (r, v) => {
    const p = fill(2);
    const shape = ['00033000', '00333300', '00333300', '03331330', '03333330', '33133333', '00011000', '00011000'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = +shape[y][x]; if (c) p[y * 8 + x] = c; }
    return p;
  },
  antenna: (r, v, f) => {
    const p = fill(2);
    for (let y = 1; y < 8; y++) set(p, 3, y, 1), set(p, 4, y, 1);
    for (let y = 1; y < 6; y += 2) { set(p, 1, y, 1); set(p, 2, y, 1); set(p, 5, y, 1); set(p, 6, y, 1); }
    set(p, 3, 0, (f + v) % 2 ? 3 : 1); set(p, 4, 0, (f + v) % 2 ? 3 : 1);
    return p;
  },
  bush: (r) => {
    const p = fill(2);
    const shape = ['00000000', '00333300', '03333330', '33313333', '33333333', '13333331', '01111110', '00000000'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = +shape[y][x]; if (c) p[y * 8 + x] = c; }
    return p;
  },
  water: (r, v, f) => {
    const p = fill(2);
    const o = (f + v * 2) % 8;
    for (let x = 0; x < 3; x++) { set(p, (o + x) % 8, 2, 3); set(p, (o + x + 4) % 8, 6, 3); }
    return p;
  },
  deep: (r, v, f) => {
    const p = fill(1);
    const o = (f + v) % 8;
    set(p, o, 3, 2); set(p, (o + 1) % 8, 3, 2); set(p, (o + 5) % 8, 6, 2);
    if (v === 2) set(p, 2, 1, 3);
    return p;
  },
  static: (r, v, f) => {
    const q = new Rng(v * 97 + f * 13 + 5);
    const p = fill(2);
    for (let i = 0; i < 64; i++) { const n = q.next(); if (n < 0.18) p[i] = 3; else if (n < 0.3) p[i] = 1; }
    return p;
  },
  void: (r, v, f) => {
    const p = fill(1);
    if (v === 0) set(p, 3, 3, f % 3 === 0 ? 3 : 2);
    if (v === 3) set(p, 6, 1, 2);
    return p;
  },
  edge: (r, v, f) => {
    const p = fill(1);
    for (let x = 0; x < 8; x++) { if ((x + f) % 3 === 0) set(p, x, 0, 3); if (r.chance(0.3)) set(p, x, 1, 2); }
    return p;
  },
  bridge: () => {
    const p = fill(2);
    for (let y = 0; y < 8; y++) { set(p, 0, y, 1); set(p, 7, y, 1); }
    for (let x = 1; x < 7; x++) { set(p, x, 2, 1); set(p, x, 5, 1); }
    set(p, 2, 0, 3); set(p, 5, 3, 3); set(p, 3, 6, 3);
    return p;
  },
  roof: (r, v) => {
    const p = fill(2);
    for (let y = 0; y < 8; y += 2) for (let x = (y / 2) % 2; x < 8; x += 2) set(p, x, y + 1, 1);
    for (let x = 0; x < 8; x++) set(p, x, 0, 3);
    return p;
  },
  window: () => {
    const p = fill(2);
    for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) set(p, x, y, 1);
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) set(p, x, y, 3);
    set(p, 3, 2, 1); set(p, 3, 3, 1); set(p, 3, 4, 1); set(p, 3, 5, 1); set(p, 2, 3, 1); set(p, 4, 3, 1); set(p, 5, 3, 1);
    return p;
  },
  door: () => {
    const p = fill(2);
    for (let y = 1; y < 8; y++) for (let x = 1; x < 7; x++) set(p, x, y, 1);
    for (let y = 2; y < 8; y++) { set(p, 2, y, 3); set(p, 5, y, 3); }
    set(p, 4, 5, 3);
    return p;
  },
  stairs: () => {
    const p = fill(1);
    for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x++) { set(p, x, y, 2); if (x > 5 - y / 2) set(p, x, y + 1, 3); }
    return p;
  },
  fence: () => {
    const p = fill(2);
    for (let x = 0; x < 8; x++) { set(p, x, 2, 1); set(p, x, 5, 1); }
    for (let y = 1; y < 7; y++) { set(p, 1, y, 3); set(p, 6, y, 3); }
    return p;
  },
  pillar: () => {
    const p = fill(2);
    for (let y = 0; y < 8; y++) { set(p, 1, y, 1); set(p, 6, y, 1); set(p, 3, y, 3); }
    for (let x = 0; x < 8; x++) { set(p, x, 0, 1); set(p, x, 7, 1); }
    return p;
  },
  gear: (r, v, f) => {
    const p = fill(2);
    const s = ['00300300', '03333330', '33311333', '03111130', '03111130', '33311333', '03333330', '00300300'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = +s[y][x]; if (c) p[y * 8 + x] = c; }
    if ((f + v) % 2) { set(p, 3, 0, 2); set(p, 4, 7, 2); set(p, 0, 3, 3); set(p, 7, 4, 3); }
    return p;
  },
  belt: (r, v, f) => {
    const p = fill(2);
    for (let y = 0; y < 8; y++) { set(p, 0, y, 1); set(p, 7, y, 1); }
    const o = f % 4;
    for (let y = o; y < 8; y += 4) { set(p, 3, y, 3); set(p, 4, y, 3); set(p, 2, (y + 1) % 8, 3); set(p, 5, (y + 1) % 8, 3); }
    return p;
  },
  belt_up: (r, v, f) => beltTile(f, 0, -1),
  belt_down: (r, v, f) => beltTile(f, 0, 1),
  belt_left: (r, v, f) => beltTile(f, -1, 0),
  belt_right: (r, v, f) => beltTile(f, 1, 0),
  gate: (r, v, f) => {
    const p = fill(1);
    for (let x = 1; x < 8; x += 2) for (let y = 0; y < 8; y++) set(p, x, y, (y + f) % 4 === 0 ? 3 : 2);
    return p;
  },
  cloud: (r, v, f) => {
    const p = fill(2);
    const o = (f + v * 3) % 8;
    for (let x = 0; x < 4; x++) { set(p, (o + x) % 8, 3, 3); set(p, (o + x + 1) % 8, 2, 3); }
    set(p, (o + 6) % 8, 6, 3);
    return p;
  },
  thread: (r, v, f) => {
    const p = fill(1);
    for (let y = 0; y < 8; y++) { set(p, 2, y, 2); set(p, 5, y, 3); }
    set(p, 2, (f + v) % 8, 3);
    return p;
  },
  grate: () => {
    const p = fill(2);
    for (let i = 0; i < 8; i += 2) for (let j = 0; j < 8; j++) { set(p, i, j, 1); set(p, j, i, 1); }
    set(p, 1, 1, 3); set(p, 5, 5, 3);
    return p;
  },
  machine: (r, v, f) => {
    const p = fill(2);
    for (let x = 0; x < 8; x++) { set(p, x, 0, 1); set(p, x, 7, 1); }
    set(p, 2, 3, (f + v) % 3 === 0 ? 3 : 1); set(p, 5, 3, (f + v) % 3 === 1 ? 3 : 1);
    for (let x = 1; x < 7; x++) set(p, x, 5, 1);
    return p;
  },
  circuit: (r) => {
    const p = fill(2);
    let x = r.int(0, 7), y = 0;
    while (y < 8) { set(p, x, y, 3); if (r.chance(0.4)) x = Math.max(0, Math.min(7, x + (r.chance(0.5) ? 1 : -1))); else y++; }
    set(p, r.int(0, 7), r.int(0, 7), 1);
    return p;
  },
  glass: (r, v) => {
    const p = fill(2);
    for (let i = 0; i < 8; i++) set(p, (i + v) % 8, i, 3);
    set(p, 0, 0, 1); set(p, 7, 7, 1);
    return p;
  },
  coins: (r) => { const p = fill(2); for (let i = 0; i < 6; i++) { const x = r.int(0, 6), y = r.int(0, 6); set(p, x, y, 3); set(p, x + 1, y, 3); set(p, x, y + 1, 1); } return p; },
  bone: (r) => {
    const p = fill(2);
    for (let x = 0; x < 8; x++) { set(p, x, 2, 3); set(p, x, 5, 3); }
    for (let y = 0; y < 8; y++) { set(p, 1, y, 1); set(p, 6, y, 1); }
    speck(p, r, 1, 0.03);
    return p;
  },
};
function beltTile(f: number, dx: number, dy: number): Pix {
  const p = fill(2);
  const o = (f * 2) % 8;
  for (let i = 0; i < 8; i++) {
    if (dx === 0) { set(p, 0, i, 1); set(p, 7, i, 1); } else { set(p, i, 0, 1); set(p, i, 7, 1); }
  }
  for (let k = 0; k < 2; k++) {
    const t = (o + k * 4) % 8;
    for (let j = -2; j <= 2; j++) {
      const a = 4 + j, b = t - Math.abs(j) + 1;
      if (dy !== 0) set(p, a, dy > 0 ? b : 7 - b, 3);
      else set(p, dx > 0 ? b : 7 - b, a, 3);
    }
  }
  return p;
}

export const TILE_KINDS = Object.keys(TILES);

export function genTile(kind: string, v: number, f: number): Pix {
  const g = TILES[kind] ?? TILES.ground;
  return g(new Rng(hash(kind) + v * 7919), v, f);
}

/** Produces the pixel grids for a sprite spec. Multi-tile sprites return n*n grids of 8x8 in row order. */
export function genSprite(s: SpriteSpec, frame = 0): Pix[] {
  const n = s.n ?? 1;
  let big: Pix;
  switch (s.g) {
    case 'monster': big = genMonster(s.seed ?? 'x', (s.o?.shape as string) ?? 'blob', n); break;
    case 'human': big = genHumanoid(s.seed ?? 'x', s.o ?? {}); break;
    case 'beast': big = genBeast((s.o?.kind as string) ?? 'cat'); break;
    case 'prop': big = genProp((s.o?.kind as string) ?? 'chest'); break;
    case 'tile': big = genTile((s.o?.kind as string) ?? 'ground', +(s.o?.v ?? 0), frame); break;
    default: big = genMonster(s.seed ?? 'x', 'blob', n);
  }
  if (n === 1) return [big];
  const out: Pix[] = [];
  const size = 8 * n;
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    const p = blank();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p[y * 8 + x] = big[(ty * 8 + y) * size + tx * 8 + x];
    out.push(p);
  }
  return out;
}
