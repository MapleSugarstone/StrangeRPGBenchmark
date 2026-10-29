// Builders for map layouts and the shared legends. Layouts are stamped from shapes rather than typed by hand.
import type { TileSpec } from '../../game/map';

export class Grid {
  g: string[][];
  constructor(public w: number, public h: number, fill = '.') {
    this.g = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  set(x: number, y: number, ch: string) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = ch; return this; }
  get(x: number, y: number) { return this.g[y]?.[x] ?? ' '; }
  fill(x: number, y: number, w: number, h: number, ch: string) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch); return this; }
  /** Fills with a mix of two characters, deterministic by position. */
  mix(x: number, y: number, w: number, h: number, a: string, b: string, rate = 0.25) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, hash(xx, yy) < rate ? b : a);
    return this;
  }
  /** Scatters a character over cells that hold `on`. */
  scatter(x: number, y: number, w: number, h: number, on: string, ch: string, rate: number, salt = 0) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.get(xx, yy) === on && hash(xx + salt, yy - salt) < rate) this.set(xx, yy, ch);
    return this;
  }
  border(ch: string) { this.fill(0, 0, this.w, 1, ch).fill(0, this.h - 1, this.w, 1, ch).fill(0, 0, 1, this.h, ch).fill(this.w - 1, 0, 1, this.h, ch); return this; }
  hline(x: number, y: number, n: number, ch: string) { return this.fill(x, y, n, 1, ch); }
  vline(x: number, y: number, n: number, ch: string) { return this.fill(x, y, 1, n, ch); }
  /** The door tile of the last house stamped. */
  door: [number, number] = [0, 0];
  /** A house three rows tall: roof, roof with a ridge, and a front with windows and a door. */
  house(x: number, y: number, w: number, opts: { roof?: string; ridge?: string; front?: string; door?: number; windows?: number[] } = {}): this {
    const roof = opts.roof ?? 'R', ridge = opts.ridge ?? '^', front = opts.front ?? 'H';
    this.hline(x, y, w, roof);
    this.hline(x, y + 1, w, roof);
    if (w > 2) this.hline(x + 1, y + 1, w - 2, ridge);
    this.hline(x, y + 2, w, front);
    for (const wx of opts.windows ?? []) this.set(x + wx, y + 2, 'W');
    const d = opts.door ?? Math.floor(w / 2);
    if (d >= 0) this.set(x + d, y + 2, 'D');
    this.door = [x + d, y + 2];
    return this;
  }
  /** Stamps a block of rows. Spaces are left alone. */
  stamp(x: number, y: number, rows: string[]) {
    rows.forEach((r, yy) => { for (let xx = 0; xx < r.length; xx++) if (r[xx] !== ' ') this.set(x + xx, y + yy, r[xx]); });
    return this;
  }
  rows(): string[] { return this.g.map((r) => r.join('')); }
}

export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const STILE: Record<string, TileSpec> = {
  '.': { t: 'stile_grass', step: 'grass' },
  ',': { t: 'stile_grass2', step: 'grass' },
  '"': { t: 'stile_flowers', step: 'grass' },
  '_': { t: 'stile_dirt', step: 'dirt' },
  '=': { t: 'stile_road', step: 'dirt' },
  ':': { t: 'stile_cobble', step: 'stone' },
  ';': { t: 'stile_cobble2', step: 'stone' },
  f: { t: 'stile_field', step: 'grass' },
  '#': { t: 'stile_wall', solid: true, wall: 10 },
  t: { t: 'stile_wall_top', solid: true, wall: 12 },
  R: { t: 'stile_roof', solid: true, wall: 14 },
  '^': { t: 'stile_roof_ridge', solid: true, wall: 16 },
  S: { t: 'stile_roof_slate', solid: true, wall: 16 },
  H: { t: 'stile_house', solid: true, wall: 8 },
  h: { t: 'stile_house2', solid: true, wall: 8 },
  W: { t: 'stile_window', solid: true, wall: 8 },
  D: { t: 'stile_door', step: 'wood' },
  '-': { t: 'stile_fence_h', solid: true, under: 'stile_grass' },
  '|': { t: 'stile_fence_v', solid: true, under: 'stile_grass' },
  '%': { t: 'stile_hedge', solid: true, wall: 5 },
  '~': { t: 'stile_water', water: true },
  e: { t: 'stile_water_edge', water: true },
  o: { t: 'stile_rock', solid: true },
  C: { t: 'stile_cliff', solid: true, wall: 12 },
  g: { t: 'stile_gully', step: 'dirt' },
  P: { t: 'stile_dye_purple', water: true },
  Q: { t: 'stile_dye_red', water: true },
  q: { t: 'stile_quarry', step: 'stone' },
  X: { t: 'stile_pit', pit: true },
  s: { t: 'stile_stairs', step: 'stone' },
  w: { t: 'stile_floor_wood', step: 'wood' },
  r: { t: 'stile_rug', step: 'wood' },
  n: { t: 'stile_floor_stone', step: 'stone' },
  B: { t: 'stile_bookshelf', solid: true },
  K: { t: 'stile_counter', solid: true },
  b: { t: 'stile_bed_top', solid: true },
  d: { t: 'stile_bed_bottom', solid: true },
  T: { t: 'stile_table', solid: true },
  L: { t: 'stile_ledger_desk', solid: true },
  N: { t: 'stile_notice', solid: true },
  G: { t: 'stile_gate_closed', solid: true },
  O: { t: 'stile_gate_open' },
  ' ': { t: 'void', solid: true },
};

export function legend(base: Record<string, TileSpec>, extra: Record<string, TileSpec> = {}): Record<string, TileSpec> {
  return { ...base, ...extra };
}
