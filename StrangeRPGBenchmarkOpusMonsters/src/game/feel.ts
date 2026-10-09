// Small field details: footsteps by ground, footprints that fade, grass that sways, ripples when wading, dust off walls, and Ouro's idle eyes.
import type { SpriteData } from '../battle/model';
import { footstep, type Ground } from '../engine/audio';
import { ctx, INK, mix } from '../engine/screen';
import { field } from './field';
import { groundKit, REGIONS, type Pal, type Style } from './tiles';

const DX = [0, 1, 0, -1];
const DY = [1, 0, -1, 0];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---------------------------------------------------------------- ground

/** Plain ground by region. */
const STYLE_GROUND: Record<Style, Ground> = {
  fell: 'sand', rib: 'shell', mast: 'sand', spire: 'grass', bole: 'grass', hum: 'metal', tusk: 'snow', hilt: 'mud', fall: 'stone', crown: 'shell',
  slack: 'earth', den: 'wood', under: 'earth', knuckle: 'grass', wreck: 'sand', shore: 'wet', bell: 'stone', root: 'earth', skin: 'sand', ice: 'ice',
  blade: 'grass', moon: 'mud', glass: 'shell', orchard: 'grass', margin: 'blank', strand: 'sand', dollar: 'sand', cowrie: 'shell', auger: 'shell',
  nautilus: 'shell', tray: 'sand', conch: 'shell', whorl: 'shell', coast: 'sand', wood: 'earth', ringwood: 'earth', geode: 'ice',
};
/** Paths and floors by the painter that draws them. */
const PAINT_GROUND: Record<string, Ground> = {
  spiral: 'stone', board: 'wood', rings: 'wood', grate: 'metal', tracks: 'snow', plate: 'metal', star: 'stone', rind: 'earth', gravel: 'stone',
  sand: 'sand', earth: 'earth', wet: 'wet', petal: 'shell', mirror: 'shell', ledge: 'stone', nacre: 'shell', plank: 'wood', deck: 'wood',
  porcelain: 'shell', ivory: 'shell', flag: 'stone', check: 'stone', testfloor: 'shell',
};
const GRASS_GROUND: Record<string, Ground> = { frost: 'snow', crystal: 'shell', outline: 'blank' };

/** Ground that keeps a footprint. */
const SOFT = new Set<Ground>(['sand', 'wet', 'snow', 'mud']);

function nearWater(x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && field.tile(x + dx, y + dy) === '~') return true;
  return false;
}

/** What the tile at x, y is underfoot. Sand by the water is wet sand. */
export function groundAt(x: number, y: number, p: Pal): Ground {
  const ch = field.tile(x, y), st = p.style, k = groundKit(st);
  let g: Ground;
  switch (ch) {
    case '~': case 'Y': case ':': case '*': g = 'water'; break;
    case '&': case '@': case '%': case ';': case '<': case '>': case '^': g = 'stone'; break;
    case 'n': g = 'snow'; break;
    case 'I': g = st === 'rib' || st === 'knuckle' ? 'shell' : 'ice'; break;
    case 'G': g = 'shell'; break;
    case 'L': g = st === 'hum' ? 'metal' : 'shell'; break;
    case 'P': case 'q': case 'l': case 'z': case 'Z': g = 'stone'; break;
    case '=': g = PAINT_GROUND[k.path] || STYLE_GROUND[st]; break;
    case '_': g = PAINT_GROUND[k.floor] || STYLE_GROUND[st]; break;
    case 'd': g = 'wood'; break;
    case 'k': g = 'grass'; break;
    case 'm': g = 'metal'; break;
    case 'M': g = 'blank'; break;
    case ',': g = GRASS_GROUND[k.grass] || 'grass'; break;
    case 's': g = st === 'shore' ? 'wet' : 'sand'; break;
    default: g = STYLE_GROUND[st] || 'sand';
  }
  if (g === 'sand' && !field.map.indoor && nearWater(x, y)) g = 'wet';
  return g;
}

// ---------------------------------------------------------------- footprints

/** Print shapes as pixels of (forward, sideways, color), color 0 the dent, 1 the raised rim, 2 the region's accent, 3 its highlight. */
const SHAPES: [number, number, number][][] = [
  [[0, 0, 0], [-1, 0, 0], [1, 0, 1]],
  [[1, -1, 0], [1, 1, 0], [0, 0, 0]],
  [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]],
  [[0, -1, 0], [1, -1, 0], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 0], [2, 1, 0]],
  [[0, 0, 2]],
  [[0, 0, 3], [1, 1, 3]],
];
const FOOT = 0, DRAG = 2, TREAD = 3;
/** A whorl's print by its first type. A VOID whorl leaves none. */
const TYPE_SHAPE: Record<string, number> = { BEAST: 1, ROOT: 2, GEAR: 3, STONE: 4, TIDE: 5, STAR: 6, SALT: 7, VOID: -1 };

/** `fleck` is set on the odd print in sand that caught a fleck of star glitter: its twinkle phase. */
interface Print { map: string; wx: number; wy: number; dir: number; shape: number; t0: number; life: number; fleck?: number }

const dents = new WeakMap<Pal, string[]>();
function dentCols(p: Pal): string[] {
  let c = dents.get(p);
  if (!c) { c = [mix(p.g2, INK, 0.5), mix(p.g3, p.hi, 0.5), p.a, p.hi]; dents.set(p, c); }
  return c;
}
const prints: Print[] = [];
/** Most prints alive at once. The oldest go first. */
export const PRINT_CAP = 240;
/** Frames a print lasts, and on wet sand, where the water takes it sooner. */
export const PRINT_LIFE = 1800, WET_LIFE = 480;

/** Whatever walks: a person (null) or anything with types. */
type Walker = { types: readonly string[] } | null | undefined;

export function shapeOf(mon: Walker): number {
  if (!mon) return FOOT;
  return TYPE_SHAPE[mon.types[0]] ?? FOOT;
}

function addPrint(x: number, y: number, dir: number, shape: number, side: number, wet: boolean, t: number, sandy = false): void {
  if (shape < 0) return;
  const map = field.map.id, life = wet ? WET_LIFE : PRINT_LIFE;
  // Now and then a print in sand turns up a fleck of glitter a star left there.
  let fleck = sandy && ((x * 73856093) ^ (y * 19349663) ^ (t * 83492791)) % 11 === 0 ? 1 + (t % 97) : 0;
  const put = (wx: number, wy: number) => { prints.push({ map, wx, wy, dir, shape, t0: t, life, fleck: fleck || undefined }); fleck = 0; };
  if (shape === FOOT) {
    // Both feet a half tile apart, under the columns where a person's feet are drawn.
    if (dir === 0 || dir === 2) { put(x * 8 + 2, y * 8 + 2 + (side ? 4 : 0)); put(x * 8 + 5, y * 8 + 6 - (side ? 4 : 0)); }
    else { put(x * 8 + 1 + (side ? 4 : 0), y * 8 + 6); put(x * 8 + 5 - (side ? 4 : 0), y * 8 + 7); }
  } else {
    const lat = shape === DRAG || shape === TREAD ? 0 : side ? 1 : -1;
    const lx = -DY[dir], ly = DX[dir];
    put(x * 8 + 4 + lx * lat, y * 8 + 6 + ly * lat - (dir === 1 || dir === 3 ? side : 0));
  }
  if (prints.length > PRINT_CAP) prints.splice(0, prints.length - PRINT_CAP);
}

/** Draws the prints on this map, fading out through the ordered dither. Called after the ground, before props and figures. */
/** Glitter flecks caught in prints on this map: where each lies, how much of its print's life is left, and its twinkle phase. */
export function printFlecks(map: string, t: number): { wx: number; wy: number; left: number; ph: number }[] {
  const out: { wx: number; wy: number; left: number; ph: number }[] = [];
  for (const pr of prints) if (pr.fleck && pr.map === map) { const age = t - pr.t0; if (age >= 0 && age < pr.life) out.push({ wx: pr.wx, wy: pr.wy, left: 1 - age / pr.life, ph: pr.fleck }); }
  return out;
}

export function drawPrints(cam: [number, number], p: Pal, t: number): void {
  // The dent sits darker than the ground's own shade lines, so a trail reads through textured sand.
  const cols = dentCols(p);
  const id = field.map.id;
  for (let i = prints.length - 1; i >= 0; i--) {
    const pr = prints[i], age = t - pr.t0;
    if (age >= pr.life || age < 0) { prints.splice(i, 1); continue; }
    if (pr.map !== id) continue;
    const left = 1 - Math.pow(age / pr.life, 1.6);
    const fx = DX[pr.dir], fy = DY[pr.dir], lx = -fy, ly = fx;
    for (const [f, l, c] of SHAPES[pr.shape]) {
      const wx = pr.wx + f * fx + l * lx, wy = pr.wy + f * fy + l * ly;
      // The rim crumbles first.
      if (BAYER[(wx & 3) + (wy & 3) * 4] >= (c === 1 ? left * left : left) * 16) continue;
      const sx = wx - cam[0], sy = wy - cam[1];
      if (sx < 0 || sy < 0 || sx >= 192 || sy >= 192) continue;
      ctx.fillStyle = cols[c];
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- grass, ripples, dust

interface Sway { map: string; tx: number; ty: number; dir: number; t0: number }
const sways: Sway[] = [];
interface Ring { map: string; wx: number; wy: number; t0: number }
const rings: Ring[] = [];
interface Mote { map: string; wx: number; wy: number; vx: number; vy: number; t0: number; life: number }
const motes: Mote[] = [];

/** Grass on a tile bends after something walks through it. */
export function bend(tx: number, ty: number, dir: number, t: number): void {
  if (field.tile(tx, ty) !== ',') return;
  if (sways.length > 40) sways.shift();
  sways.push({ map: field.map.id, tx, ty, dir, t0: t });
}

/** A ring spreads on the water from someone wading. */
export function ripple(wx: number, wy: number, t: number): void {
  if (rings.length > 12) rings.shift();
  rings.push({ map: field.map.id, wx, wy, t0: t });
}

/** A puff of dust where Ouro walks into something solid. */
export function puff(x: number, y: number, dir: number, t: number): void {
  const wx = x * 8 + 4 + DX[dir] * 4, wy = y * 8 + 6 + DY[dir] * 2;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4 - 0.375) * 1.6 + (dir === 1 ? 0 : dir === 3 ? Math.PI : dir === 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI;
    motes.push({ map: field.map.id, wx: wx + (k - 1.5), wy, vx: Math.cos(a) * 0.25, vy: Math.sin(a) * 0.12 - 0.12, t0: t, life: 16 + k * 3 });
  }
  if (motes.length > 24) motes.splice(0, motes.length - 24);
}

/** Sways bent grass by shifting its top rows a pixel, and draws ripples. After the ground, before figures. */
export function drawUnder(cam: [number, number], p: Pal, t: number): void {
  const id = field.map.id;
  const cv = ctx.canvas as HTMLCanvasElement;
  for (let i = sways.length - 1; i >= 0; i--) {
    const s = sways[i], age = t - s.t0;
    if (age > 30 || age < 0) { sways.splice(i, 1); continue; }
    if (s.map !== id) continue;
    // Bent the way the walker went, back past upright, then still.
    const side = s.dir === 1 ? 1 : s.dir === 3 ? -1 : (s.tx + s.ty) & 1 ? 1 : -1;
    const dx = age < 10 ? side : age < 20 ? -side : 0;
    if (!dx) continue;
    const x = s.tx * 8 - cam[0], y = s.ty * 8 - cam[1];
    if (x < 0 || y < 0 || x > 184 || y > 184) continue;
    ctx.drawImage(cv, x, y, 8, 4, x + dx, y, 8, 4);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i], age = t - r.t0;
    if (age > 54 || age < 0) { rings.splice(i, 1); continue; }
    if (r.map !== id) continue;
    const rad = 2 + age * 0.13, left = 1 - age / 54;
    ctx.fillStyle = p.hi;
    for (let a = 0; a < 20; a++) {
      const x = Math.round(r.wx - cam[0] + Math.cos(a / 10 * Math.PI) * rad), y = Math.round(r.wy - cam[1] + Math.sin(a / 10 * Math.PI) * rad * 0.45);
      if (BAYER[(x & 3) + (y & 3) * 4] < left * 12) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Draws dust motes in front of the figures. */
export function drawOver(cam: [number, number], p: Pal, t: number): void {
  const id = field.map.id;
  ctx.fillStyle = p.g3;
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i], age = t - m.t0;
    if (age > m.life || age < 0) { motes.splice(i, 1); continue; }
    if (m.map !== id) continue;
    const x = Math.round(m.wx + m.vx * age - cam[0]), y = Math.round(m.wy + m.vy * age + age * age * 0.006 - cam[1]);
    if (BAYER[(x & 3) + (y & 3) * 4] < (1 - age / m.life) * 16) ctx.fillRect(x, y, 1, 1);
  }
}

// ---------------------------------------------------------------- walking

/** Each walker's step count, so feet alternate and steps sound every other tile. */
const strides = new Map<string, number>();

/**
 * Something walked off tile x, y heading `dir`. It leaves a print on soft ground, bends grass, ripples water, and
 * makes a footstep: full for Ouro, fainter and placed for anyone else nearby. `id` names the walker for its stride.
 */
export function walked(id: string, x: number, y: number, dir: number, opts: { mon?: Walker; vol: number; sound: boolean; wading?: boolean }): void {
  const p = REGIONS[field.map.region] || REGIONS[0];
  const t = field.t;
  const n = (strides.get(id) || 0) + 1;
  strides.set(id, n);
  const g = opts.wading ? 'water' : groundAt(x, y, p);
  const shape = shapeOf(opts.mon);
  if (SOFT.has(g)) addPrint(x, y, dir, shape, n & 1, g === 'wet', t, g === 'sand' || g === 'wet');
  bend(x, y, dir, t);
  if (g === 'water') ripple(x * 8 + 4, y * 8 + 7, t);
  // A VOID whorl floats, so it makes no sound underfoot either.
  if (!opts.sound || shape < 0) return;
  const ox = field.x, oy = field.y;
  const far = id === 'ouro' ? 0 : Math.hypot(x - ox, y - oy);
  const vol = opts.vol * Math.max(0, 1 - far / 8);
  // Ouro steps on odd strides and everyone else on even ones, so two walkers side by side alternate rather than double up.
  if (vol <= 0.02 || (n & 1) !== (id === 'ouro' ? 1 : 0)) return;
  footstep(g, { vol, foot: (n >> 1) & 1, pan: Math.max(-0.7, Math.min(0.7, (x - ox) / 8)) });
}

// ---------------------------------------------------------------- Ouro's eyes

/** What Ouro's eyes do after standing still `idle` frames: blink now and then, and after a while look one way, then the other. */
export function idleLook(idle: number, t: number): 'blink' | 'left' | 'right' | null {
  if (idle < 50) return null;
  const b = (t + 37) % 233;
  if (b < 6 || (b > 14 && b < 19 && (t / 233 | 0) % 3 === 1)) return 'blink';
  if (idle < 420) return null;
  const c = (idle - 420) % 720;
  return c < 70 ? 'left' : c > 150 && c < 220 ? 'right' : null;
}

const eyeCache = new Map<string, SpriteData>();
/** Ouro's sprite with the eyes closed or turned. Eyes are the ink pixels at columns 2 and 5 of rows 3 and 4. */
export function withEyes(s: SpriteData, look: 'blink' | 'left' | 'right' | null): SpriteData {
  if (!look) return s;
  const key = s.px.join('') + look;
  let out = eyeCache.get(key);
  if (out) return out;
  const rows = s.px.map(r => r.split(''));
  const eyes = [2, 5];
  if (eyes.some(x => rows[3][x] !== '1' || rows[4][x] !== '1')) return s;
  if (look === 'blink') for (const x of eyes) rows[3][x] = '2';
  else {
    const d = look === 'left' ? -1 : 1;
    if (eyes.some(x => rows[3][x + d] !== '2' || rows[4][x + d] !== '2')) return s;
    for (const x of eyes) for (const y of [3, 4]) { rows[y][x] = '2'; rows[y][x + d] = '1'; }
  }
  out = { px: rows.map(r => r.join('')), c: s.c };
  if (eyeCache.size > 40) eyeCache.clear();
  eyeCache.set(key, out);
  return out;
}

/** For the debug handle: prints alive, and the cap. */
export const feelStats = () => ({ prints: prints.length, cap: PRINT_CAP, sways: sways.length, rings: rings.length, motes: motes.length, last: prints[prints.length - 1] });
