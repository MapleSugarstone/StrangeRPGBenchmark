import { Rng } from '../core/rng';

/** A mutable character grid for building maps with shapes instead of hand-counted rows. */
export class Grid {
  cells: string[][];
  constructor(public w: number, public h: number, fill: string) {
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }

  static from(rows: string[]): Grid {
    const w = Math.max(...rows.map(r => r.length));
    const g = new Grid(w, rows.length, ' ');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) g.cells[y][x] = r[x]; });
    return g;
  }

  in(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): string {
    return this.in(x, y) ? this.cells[y][x] : '';
  }

  put(x: number, y: number, c: string): this {
    if (this.in(x, y)) this.cells[y][x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, c);
    return this;
  }

  frame(x: number, y: number, w: number, h: number, c: string): this {
    for (let i = x; i < x + w; i++) { this.put(i, y, c); this.put(i, y + h - 1, c); }
    for (let j = y; j < y + h; j++) { this.put(x, j, c); this.put(x + w - 1, j, c); }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.put(x, y, c);
    }
    return this;
  }

  /** Draws straight Manhattan segments through each point in turn. */
  path(pts: [number, number][], c: string, width = 1): this {
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i];
      const [tx, ty] = pts[i + 1];
      for (;;) {
        for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) this.put(x + a, y + b, c);
        if (x === tx && y === ty) break;
        if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      }
    }
    return this;
  }

  /** Replaces cells of kind `on` (or any if omitted) with `c` at probability `p`. */
  scatter(x: number, y: number, w: number, h: number, c: string, p: number, seed: number, on?: string): this {
    const r = new Rng(seed);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (!this.in(i, j)) continue;
      if (on !== undefined && !on.includes(this.cells[j][i])) continue;
      if (r.next() < p) this.cells[j][i] = c;
    }
    return this;
  }

  /** Softens the border between two kinds so edges look organic. */
  roughen(a: string, b: string, p: number, seed: number): this {
    const r = new Rng(seed);
    const copy = this.cells.map(row => [...row]);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (copy[y][x] !== a) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => copy[y + dy]?.[x + dx] === b);
      if (nb && r.next() < p) this.cells[y][x] = b;
    }
    return this;
  }

  text(x: number, y: number, rows: string[]): this {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '?') this.put(x + i, y + j, r[i]); });
    return this;
  }

  rows(): string[] {
    return this.cells.map(r => r.join(''));
  }
}
