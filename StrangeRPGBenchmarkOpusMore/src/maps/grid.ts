import { Rng } from '../core/rng';

// Paints a tile map with shapes instead of hand-typed rows.
export class Grid {
  cells: string[][];
  constructor(public w: number, public h: number, ch = '.') {
    this.cells = Array.from({ length: h }, () => Array(w).fill(ch));
  }
  put(x: number, y: number, ch: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = ch;
    return this;
  }
  get(x: number, y: number): string { return this.cells[y]?.[x] ?? ' '; }
  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.put(xx, yy, ch);
    return this;
  }
  frame(x: number, y: number, w: number, h: number, ch: string): this {
    for (let xx = x; xx < x + w; xx++) { this.put(xx, y, ch); this.put(xx, y + h - 1, ch); }
    for (let yy = y; yy < y + h; yy++) { this.put(x, yy, ch); this.put(x + w - 1, yy, ch); }
    return this;
  }
  text(x: number, y: number, s: string): this {
    for (let i = 0; i < s.length; i++) if (s[i] !== ' ') this.put(x + i, y, s[i]);
    return this;
  }
  // Writes several rows at once. Spaces leave the existing tile alone.
  stamp(x: number, y: number, rows: string[]): this {
    rows.forEach((r, i) => this.text(x, y + i, r));
    return this;
  }
  // A building: two rows of roof, then wall rows with windows, and a door on the bottom row.
  house(x: number, y: number, w: number, h: number, door: number, o: { roof?: string; wall?: string; win?: string; doorCh?: string } = {}): this {
    const roof = o.roof ?? '^', wall = o.wall ?? '#', win = o.win ?? 'w';
    this.rect(x, y, w, 2, roof);
    this.rect(x, y + 2, w, h - 2, wall);
    if (h > 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) this.put(xx, y + 2, win);
    this.put(door, y + h - 1, o.doorCh ?? '+');
    return this;
  }
  // Scatters a tile onto cells that currently hold `on`, avoiding a margin.
  scatter(ch: string, n: number, seed: number, on = '.', margin = 1): this {
    const r = new Rng(seed);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 50) {
      tries++;
      const x = margin + r.int(this.w - margin * 2), y = margin + r.int(this.h - margin * 2);
      if (this.get(x, y) !== on) continue;
      this.put(x, y, ch);
      placed++;
    }
    return this;
  }
  // Carves a winding path of `ch` between two points.
  path(x0: number, y0: number, x1: number, y1: number, ch: string, width = 1): this {
    let x = x0, y = y0;
    const step = () => this.rect(x, y, width, width, ch);
    step();
    while (x !== x1 || y !== y1) {
      if (x !== x1 && (y === y1 || (x + y) % 3 !== 0)) x += Math.sign(x1 - x);
      else y += Math.sign(y1 - y);
      step();
    }
    return this;
  }
  rows(): string[] { return this.cells.map((r) => r.join('')); }
}
