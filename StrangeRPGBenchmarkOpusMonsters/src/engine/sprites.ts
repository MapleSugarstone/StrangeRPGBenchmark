import type { SpriteData } from '../battle/model';
import { ctx, INK } from './screen';

const cache = new Map<string, HTMLCanvasElement>();

export function spriteKey(s: SpriteData): string {
  return s.px.join('') + s.c[0] + s.c[1] + (s.c[2] || '');
}

function build(s: SpriteData, scale: number, flip: boolean, tint: string | null, ink: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 8 * scale;
  cv.height = 8 * scale;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < 8; y++) {
    const row = s.px[y] || '........';
    for (let x = 0; x < 8; x++) {
      const ch = row[x];
      if (ch === '.' || ch === undefined) continue;
      let col = ch === '1' ? ink : ch === '2' ? s.c[0] : ch === '4' ? s.c[2] || s.c[1] : s.c[1];
      if (tint) col = tint;
      g.fillStyle = col;
      const dx = flip ? 7 - x : x;
      g.fillRect(dx * scale, y * scale, scale, scale);
    }
  }
  return cv;
}

/** Draws an 8 by 8 sprite. `tint` paints every pixel one color (for hit flashes and silhouettes). */
export function drawSprite(s: SpriteData, x: number, y: number, scale = 1, flip = false, tint: string | null = null, ink = INK): void {
  const key = spriteKey(s) + scale + (flip ? 'f' : '') + (tint || '') + ink;
  let cv = cache.get(key);
  if (!cv) {
    if (cache.size > 900) cache.clear();
    cv = build(s, scale, flip, tint, ink);
    cache.set(key, cv);
  }
  ctx.drawImage(cv, Math.round(x), Math.round(y));
}

/** Per-pixel surface direction of an 8 by 8 sprite, indexed y * 8 + x: x to the right, f toward the viewer, z up. `top` and `foot` are the highest and lowest rows with color. `thin` marks lone ink pixels that stick out of the body (arms, feet, ear tips), with `next` the index of the body pixel each one joins, or -1. */
export interface LightMap { solid: Uint8Array; nx: Float32Array; nf: Float32Array; nz: Float32Array; top: number; foot: number; thin: Uint8Array; next: Int8Array }

/** Hand-made light maps keyed by the sprite's rows joined: 8 rows of keypad digits (5 faces the viewer, 8 up, 4 left, 3 down and right), '.' to keep the derived one. */
export const LIGHT_OVERRIDES = new Map<string, string[]>();

const lightMaps = new Map<string, LightMap>();
/** Edge pixels lean out this hard. */
const TILT = 4;
/** Pixels this far from the edge face the viewer. */
const ROUND = 4;

/** The sprite's light map: its silhouette raised like a pillow, so each pixel faces away from the nearest edge. Cached by shape. */
export function lightMap(s: SpriteData, flip: boolean): LightMap {
  const key = s.px.join('') + (flip ? 'f' : '');
  let m = lightMaps.get(key);
  if (m) return m;
  if (lightMaps.size > 900) lightMaps.clear();
  const solid = new Uint8Array(64), ink = new Uint8Array(64), thin = new Uint8Array(64), next = new Int8Array(64).fill(-1);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const ch = (s.px[y] || '')[flip ? 7 - x : x];
    if (ch && ch !== '.') solid[y * 8 + x] = 1;
    if (ch === '1') ink[y * 8 + x] = 1;
  }
  // An ink pixel with at most one colored neighbor sticks out of the body, so it stays out of the height and keeps the body's normals as they would be without it.
  const colored = (x: number, y: number) => x >= 0 && y >= 0 && x < 8 && y < 8 && solid[y * 8 + x] && !ink[y * 8 + x];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (!ink[y * 8 + x]) continue;
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([u, v]) => colored(u, v));
    if (nb.length > 1) continue;
    thin[y * 8 + x] = 1;
    if (nb.length) next[y * 8 + x] = nb[0][1] * 8 + nb[0][0];
  }
  const body = (i: number) => solid[i] && !thin[i];
  // Height on a 10 by 10 grid with a clear border: distance to the nearest clear pixel, rounded off like a pillow.
  const h = new Float32Array(100);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (!body(y * 8 + x)) continue;
    let d = ROUND;
    for (let v = -1; v <= 8; v++) for (let u = -1; u <= 8; u++) {
      if (u >= 0 && v >= 0 && u < 8 && v < 8 && body(v * 8 + u)) continue;
      d = Math.min(d, Math.hypot(u - x, v - y));
    }
    const k = 1 - d / ROUND;
    h[(y + 1) * 10 + x + 1] = Math.sqrt(1 - k * k);
  }
  const nx = new Float32Array(64), nf = new Float32Array(64), nz = new Float32Array(64);
  const H = (x: number, y: number) => h[(y + 1) * 10 + x + 1];
  const over = LIGHT_OVERRIDES.get(s.px.join(''));
  const rowSolid = (y: number) => solid.subarray(y * 8, y * 8 + 8).some(v => v);
  let foot = 7, top = 0;
  while (foot > 0 && !rowSolid(foot)) foot--;
  while (top < foot && !rowSolid(top)) top++;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = y * 8 + x;
    if (!solid[i]) continue;
    // Sobel slopes: gx rises to the right, gy rises downward.
    const gx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) / 8;
    const gy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) / 8;
    let a = -TILT * gx, b = TILT * gy, c = 1;
    // A protruding pixel faces straight out from the body pixel it joins.
    if (thin[i] && next[i] >= 0) { a = (x - (next[i] & 7)) * 2; b = ((next[i] >> 3) - y) * 2; c = 0.6; }
    const o = over?.[y]?.[flip ? 7 - x : x];
    if (o && o >= '1' && o <= '9') {
      const d = o.charCodeAt(0) - 49;
      a = (d % 3 - 1) * (flip ? -1 : 1); b = Math.floor(d / 3) - 1; c = 1.2;
    }
    const n = Math.hypot(a, b, c);
    nx[i] = a / n; nz[i] = b / n; nf[i] = c / n;
  }
  m = { solid, nx, nf, nz, top, foot, thin, next };
  lightMaps.set(key, m);
  return m;
}

/** People and props in the field, keyed by name. */
export const PEOPLE: Record<string, SpriteData> = {};
function person(id: string, px: string[], a: string, b: string, hair?: string): void { PEOPLE[id] = { px, c: hair ? [a, b, hair] : [a, b] }; }

// The cast. Every head follows the grammar in Notes/people.md, and each person keeps one wrong thing (see Notes/characters.md).
person('vellum', ['.4....4.', '.44..44.', '14444441', '12122121', '12122121', '..4434..', '.144341.', '..1..1..'], '#f4f0ea', '#86e8f8', '#5a34dc');
person('gran', ['........', '........', '..44....', '.4444...', '41212222', '.1221...', '.13331..', '..1.1...'], '#f2d8c2', '#8a5ab0', '#9092b8');
person('smallgran', ['.4....4.', '.44..44.', '14444441', '14444441', '41444414', '4.1331.4', '3.13.313', '..1..1..'], '#e8dcd0', '#f4eef8', '#b890d0');
person('tack', ['4......4', '44444444', '14444441', '12122121', '12122121', '..1331..', '...33...', '...11...'], '#e3b48c', '#3a6ad0', '#20a0a8');
person('fellmonger', ['.333....', '3333.4.4', '33344444', '33321212', '33321212', '.33.444.', '...1331.', '...1..1.'], '#c98e60', '#c07a3a', '#626487');
person('purchase', ['..1331..', '..1331..', '..1331..', '11111111', '42122124', '42122124', '.133331.', '..1..1..'], '#a8693e', '#9a3a8a', '#ff77af');
person('bare', ['.1....1.', '.41..14.', '14444441', '42122124', '42122124', '41331314', '2.1331.2', '1......1'], '#8a5434', '#f0ece0', '#ed6a53');
person('peeler', ['.1....1.', '.33.133.', '13331331', '34441443', '32121213', '32121213', '.333133.', '.1...1..'], '#6e4028', '#ece8dc', '#c8642a');
person('zest', ['4.4..4.4', '.444444.', '14444441', '12122121', '12122121', '..3333..', '.1.33.1.', '1......1'], '#e8c0a0', '#f0ece0', '#e86a20');
person('pith', ['.4444...', '4....4..', '....4.4.', '14444441', '12122121', '12122121', '.133331.', '.111111.'], '#b97a4c', '#f4f0e4', '#6f29ae');
person('cinch', ['.1....1.', '.41..14.', '14444441', '2.12212.', '2.12212.', '.13331..', '2133312.', '.13331..'], '#c8c0b8', '#2a2a36', '#9092b8');
person('realcinch', ['........', '..444...', '.44444..', '4121214.', '4122214.', '4133314.', '.1333331', '.1333322'], '#5a3422', '#c8c0e0', '#9092b8');
person('knuckle', ['.1....1.', '.41..14.', '14444441', '12122121', '12122121', '11133111', '12233221', '12211221'], '#d6a070', '#d04a6a', '#1e8b5c');
person('leeward', ['....4..4', '...44.44', '44444444', '..212212', '.212212.', '.13331..', '13331...', '1.1.....'], '#94603c', '#3a8ab8', '#c69e31');
person('verger', ['...11...', '..1331..', '.133331.', '.131131.', '13333331', '41122114', '..1331..', '..1..1..'], '#4a5a9a', '#3aa08a', '#c89820');
person('grafton', ['.4....4.', '14444441', '12122121', '12122121', '.12214.4', '.1331444', '.1331212', '..1..1..'], '#f0c8a8', '#4a8a3a', '#48a858');
person('ohm', ['.3....3.', '13333331', '12442121', '12122121', '12122221', '.111111.', '..3333..', '..1..1..'], '#b8e8f0', '#e0a030', '#e05a80');
person('tallow', ['...44...', '.444444.', '41444414', '12122121', '.133331.', '13333331', '1.1..1.1', '1.1..1.1'], '#f2d8c2', '#b83a4a', '#9092b8');
person('quillon', ['.4.44.4.', '.444444.', '14444441', '12122121', '12122121', '23333332', '..1331..', '...11...'], '#e3b48c', '#c85a28', '#3a9ad8');
person('perihel', ['.4....4.', '.44..44.', '14211241', '42122124', '42122124', '4.1331.4', '.133331.', '..1..1..'], '#c98e60', '#7a4ac8', '#fffae0');
person('fid', ['.1....1.', '14444441', '12122121', '12122121', '...21...', '...21...', '..1331..', '..1..1..'], '#a8693e', '#3a7ad0', '#ff7b87');
person('lug', ['.33.333.', '33333333', '.1....1.', '14444441', '12122121', '12122121', '.133331.', '..1..1..'], '#8a5434', '#a8b8d8', '#df68ae');
person('hasp', ['2.1..1.2', '1.4444.1', '21444412', '31444413', '33444433', '..1331..', '.133331.', '..1..1..'], '#6e4028', '#5a4aa0', '#a888e0');
person('fitter', ['.44..44.', '14444441', '12122121', '12122121', '2.1331.2', '.1.33.1.', '.1.33.1.', '2..11..2'], '#e8c0a0', '#2a8a8a', '#e070a0');
person('tanner', ['4.4..4.4', '14444441', '12122121', '12122121', '.133331.', '.313313.', '.331133.', '..1..1..'], '#b97a4c', '#a8602a', '#774e00');
person('stackkeeper', ['...33...', '..1111..', '..1331..', '.111111.', '.133331.', '41111114', '42122124', '..1111..'], '#5a3422', '#d08a2a', '#3a9ad8');
person('rider', ['.2....2.', '.22..22.', '12111121', '12311321', '.122221.', '.12.2221', '.1222221', '.11..11.'], '#d8e8f8', '#78a8e0');
person('riderhand', ['.2....2.', '.22..22.', '12111121', '12311321', '.12221..', '.12.2223', '.12221..', '..1.1...'], '#d8e8f8', '#78a8e0');
// Townsfolk, spread across towns so no two towns share a crowd.
person('villager', ['3......3', '.3....3.', '.333333.', '13444431', '12122121', '12122121', '.133331.', '..1..1..'], '#d6a070', '#d04a3a', '#b86a3a');
person('villager2', ['.4....4.', '.44..44.', '.444444.', '.212212.', '44444444', '4.1331.4', '..3333..', '..1..1..'], '#94603c', '#3a8a5a', '#e9883b');
person('elder', ['........', '.333....', '33333...', '333334.4', '.3334444', '..314121', '..1.1221', '.11.11.1'], '#f0c8a8', '#7a7ab8', '#9092b8');
person('child', ['........', '.44..44.', '14444441', '12222221', '12122121', '12122121', '..3333..', '..1..1..'], '#f2d8c2', '#e8b830', '#e05a3a');
person('keeper', ['.2....2.', '.22..22.', '12222221', '12221221', '12221224', '..1331.4', '..3333..', '..1..1..'], '#d0a040', '#7a8aa8', '#d0503a');
person('stilts', ['.4.44.4.', '14444441', '12122121', '12122121', '..1331..', '..1..1..', '..1..1..', '.11..11.'], '#e3b48c', '#2a8aa0', '#d85c01');
person('hummer', ['...44...', '.444444.', '33111133', '33444433', '.212212.', '.212212.', '..3333..', '..1..1..'], '#c98e60', '#e0a030', '#007c66');
person('ringer', ['.4....4.', '.444444.', '.212212.', '.212212.', '..1331..', '.133331.', '13333331', '11111111'], '#a8693e', '#3aa08a', '#ff7eae');
person('grafter', ['...133..', '.4.1..4.', '14444441', '12122121', '12122121', '..1331..', '.133331.', '..1..1..'], '#8a5434', '#5aa040', '#d28252');
person('starwalker', ['.4..4...', '.4444444', '14444444', '212212..', '212212..', '.1331...', '.3333...', '.1..1...'], '#e8c0a0', '#8a5ad0', '#fffae0');
person('veryold', ['..4444..', '.444444.', '41444414', '12122121', '14444441', '14444441', '14444441', '.1....1.'], '#6e4028', '#f0f0f8', '#9092b8');
person('basket', ['13333331', '13333331', '.111111.', '41444414', '.412214.', '.412214.', '..1331..', '..1..1..'], '#e8c0a0', '#c89040', '#e05a4a');
person('boy', ['.....444', '.4..4414', '14444441', '12222221', '12122121', '12122121', '..3333..', '..1..1..'], '#b97a4c', '#d06a8a', '#2550a9');
person('oldwoman', ['.3....3.', '.333333.', '33111133', '31211213', '31211213', '43111134', '.133331.', '..1..1..'], '#f0e8c0', '#9a7ac8', '#9092b8');
person('sign', ['........', '.111111.', '.122221.', '.121121.', '.122221.', '.111111.', '...11...', '...11...'], '#c8a070', '#8a6a3a');
person('peg', ['...11...', '..1221..', '..1221..', '...11...', '...12...', '...12...', '...12...', '....1...'], '#c8a070', '#8a6a3a');
person('stone', ['........', '..1111..', '.122221.', '12222321', '12223221', '12222221', '.111111.', '........'], '#9a968a', '#6a665e');

// Act 2, the Strand (see Notes/act2-art.md).
person('sifter', ['.4....4.', '14434441', '12122121', '12122121', '11111111', '13131313', '.111111.', '.3..3..3'], '#5a3422', '#e8d088', '#e8743e');
person('gloss', ['.4....4.', '14444441', '42122124', '42122124', '..3333..', '11111111', '.212212.', '.444444.'], '#f8ecd8', '#7a3a22', '#c83a50');
person('turnwise', ['2.4..4.2', '21444412', '.144441.', '.212212.', '.212212.', '..3133..', '...313..', '...11...'], '#d6a070', '#7a5a9a', '#b65900');
person('siphon', ['.4....4.', '.444444.', '44222244', '44122144', '44122144', '12333321', '12222221', '.133331.'], '#f4ece0', '#d8602a', '#e86a8a');
person('tidereader', ['.4....4.', '.44..44.', '14444441', '12333221', '12313221', '.122221.', '..1111..', '...11...'], '#94603c', '#cfe8ff', '#4eba99');
person('mudlark', ['........', '........', '.4..4...', '144441..', '412214..', '41221433', '22111333', '.3333333'], '#f0c8a8', '#6a5440', '#d86a28');
person('bottlegirl', ['...11...', '..3333..', '.34..43.', '34444443', '32122123', '32122123', '.333333.', '..1..1..'], '#f2d8c2', '#58d8a8', '#e070a0');
person('eldest', ['...44...', '.444444.', '41444414', '12122121', '.122221.', '13333331', '.322223.', '..3333..'], '#e3b48c', '#4a7ad0', '#8183a8');
person('beach1', ['...33...', '.4.33.4.', '33444433', '.212212.', '.212212.', '3.1331.3', '..1331..', '..1..1..'], '#c98e60', '#ff8a5a', '#803dc2');
person('beach2', ['..3333..', '..3.33..', '..3333..', '41111114', '42122124', '.122221.', '..1331..', '..1..1..'], '#a8693e', '#5a4a8a', '#49c5d5');
person('beach3', ['.....33.', '.4.43333', '14441333', '12223133', '21213331', '21213331', '.13331..', '..1..1..'], '#8a5434', '#f4d0e0', '#e86a20');
person('beach4', ['..4444..', '.444444.', '41444414', '12122121', '.122221.', '..3333..', '.333333.', '33333333'], '#6e4028', '#d8c090', '#9092b8');
person('cowrie1', ['.4....4.', '.444444.', '42321224', '42212324', '42321224', '.422124.', '..3333..', '..1..1..'], '#e8c0a0', '#a85a30', '#d87828');
person('cowrie2', ['.4....4.', '.444444.', '44444444', '12122121', '12122121', '..1331..', '..1..1..', '.1..1111'], '#b97a4c', '#c86a30', '#006962');
person('climber1', ['.4....44', '.44..44.', '14444441', '12122121', '12122121', '.133331.', '..1..1..', '2.2..2.2'], '#5a3422', '#4a8a6a', '#9a6ae0');
person('climber2', ['..1..1..', '.133331.', '..1331..', '12122121', '12122121', '14444441', '.444444.', '.4.44.4.'], '#d6a070', '#b0603a', '#9b6d00');
person('nautilus1', ['.4....4.', '.44..44.', '14444441', '12122121', '12122121', '2.2222.2', '.2.33.2.', '..1..1..'], '#94603c', '#e8743e', '#de8d5d');
person('nautilus2', ['.33..33.', '.31..13.', '14444441', '12222221', '12222221', '.122221.', '..1331..', '..1..1..'], '#f0c8a8', '#f4f0e8', '#e8743e');
// Casts and a conjoined whorl the story shows with a look of their own, kept here so the review page can redraw them.
person('oldcast', ['..33....', '.3333...', '333333..', '.2122.4.', '.2222.4.', '.22.2.4.', '.2222.4.', '.1..1.4.'], '#e8e2d4', '#877f96', '#c8a070');
person('pellcast', ['.44..44.', '.444444.', '.222222.', '.212212.', '.222222.', '.2.22123', '.2222223', '..4..4..'], '#f5ede1', '#f0c040', '#ae9e8f');
person('brack', ['3.3..3.3', '23222232', '.222222.', '.212212.', '.22.222.', '.244442.', '..4.44..', '..1..1..'], '#c6beae', '#f2fafd', '#68a68e');

/** Vellum's sprite with a seam that grows one pixel per loosened Stay. */
export function vellumSprite(seam: number): SpriteData {
  const base = PEOPLE.vellum.px.map(r => r.split(''));
  // [x, y] cells, all inside the body: down the smock first, then up through the chin and face.
  const cells: [number, number][] = [[4, 5], [4, 6], [4, 4], [4, 3], [4, 2], [3, 6]];
  for (let i = 0; i < Math.min(seam, cells.length); i++) base[cells[i][1]][cells[i][0]] = '.';
  return { px: base.map(r => r.join('')), c: PEOPLE.vellum.c };
}
