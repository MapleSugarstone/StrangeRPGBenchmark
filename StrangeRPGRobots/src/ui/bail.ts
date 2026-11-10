// Bail: route the current from the source to every drain by turning pipe tiles. Frost spreads from the far corner
// one tile at a time and locks each tile it reaches the way it is turned.
import { rect, frame, box, dotFrame } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { W, H } from '../engine/screen';
import { pressed, repeat, MOUSE, mouseActive, consume } from '../engine/input';
import { sfx } from '../audio/sfx';
import { BAIL, type BailDef } from '../content/undertow_puzzles';
import { hacker, hintBar, netBackdrop, resultBox, titleBar, type Minigame } from './minigame';

const N = 1, E = 2, S = 4, Wd = 8;
const DIRS: [number, number, number, number][] = [[0, -1, N, S], [1, 0, E, Wd], [0, 1, S, N], [-1, 0, Wd, E]];
const CELL = 20;

function rot(m: number, r: number): number { let x = m; for (let i = 0; i < (r & 3); i++) x = ((x << 1) | (x >> 3)) & 15; return x; }

interface Tile { mask: number; fixed: boolean; frozen: boolean; kind: 'pipe' | 'source' | 'drain' | 'empty' }

export class Bail implements Minigame {
  def: BailDef;
  w: number;
  h: number;
  tiles: Tile[] = [];
  src = 0;
  drains: number[] = [];
  order: number[] = [];
  oi = 0;
  cur = 0;
  step: number;
  clock: number;
  t = 0;
  phase: 'play' | 'done' = 'play';
  done = false;
  won = false;
  bonus: string[] = [];
  count = 0;
  lit = new Set<number>();
  who: { name: string; pool: number };
  why = '';
  gx: number;
  gy: number;

  constructor(id: string) {
    this.def = BAIL.get(id) ?? { id, difficulty: 2 };
    const d = Math.max(1, Math.min(4, this.def.difficulty));
    this.who = hacker();
    this.w = this.def.w ?? [5, 5, 6, 7][d - 1];
    this.h = this.def.h ?? [4, 5, 5, 6][d - 1];
    this.step = (this.def.step ?? [3.4, 2.8, 2.3, 1.9][d - 1]) + this.who.pool * 0.08;
    this.clock = 7 - d + this.who.pool * 0.3;
    this.gx = Math.round((W - this.w * CELL) / 2);
    this.gy = 22 + Math.round((H - 22 - 30 - this.h * CELL) / 2);
    this.build(this.def.drains ?? (d >= 3 ? 3 : 2));
  }

  build(nd: number) {
    const { w, h } = this;
    const n = w * h;
    this.src = Math.floor(h / 2) * w;
    const links = new Array(n).fill(0);
    const seen = new Set([this.src]);
    const stack = [this.src];
    while (stack.length) {
      const c = stack[stack.length - 1];
      const x = c % w, y = Math.floor(c / w);
      const opts = DIRS.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen.has(ny * w + nx); });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy, b, ob] = opts[Math.floor(Math.random() * opts.length)];
      const nc = (y + dy) * w + x + dx;
      links[c] |= b; links[nc] |= ob;
      seen.add(nc); stack.push(nc);
    }
    const parent = new Map<number, number>();
    const depth = new Map<number, number>([[this.src, 0]]);
    const q = [this.src];
    while (q.length) {
      const c = q.shift()!;
      const x = c % w, y = Math.floor(c / w);
      for (const [dx, dy, b] of DIRS) {
        if (!(links[c] & b)) continue;
        const nc = (y + dy) * w + x + dx;
        if (depth.has(nc)) continue;
        depth.set(nc, depth.get(c)! + 1); parent.set(nc, c); q.push(nc);
      }
    }
    const leaves = [...depth.keys()].filter((c) => c !== this.src && [1, 2, 4, 8].includes(links[c])).sort((a, b) => depth.get(b)! - depth.get(a)!);
    const far = leaves.filter((c) => c % w >= Math.floor(w / 2));
    this.drains = (far.length >= nd ? far : leaves).slice(0, nd);
    const keep = new Set<number>([this.src]);
    for (const dr of this.drains) { let c: number | undefined = dr; while (c !== undefined && !keep.has(c)) { keep.add(c); c = parent.get(c); } }
    const mask = new Array(n).fill(0);
    for (const c of keep) {
      const x = c % w, y = Math.floor(c / w);
      for (const [dx, dy, b] of DIRS) {
        const nc = (y + dy) * w + x + dx;
        if ((links[c] & b) && keep.has(nc)) mask[c] |= b;
      }
    }
    const SHAPES = [N | S, N | E, N | E | S, N | S, N | E];
    this.tiles = [...Array(n).keys()].map((c) => {
      if (c === this.src) return { mask: mask[c], fixed: true, frozen: false, kind: 'source' as const };
      if (this.drains.includes(c)) return { mask: mask[c], fixed: true, frozen: false, kind: 'drain' as const };
      if (keep.has(c)) return { mask: rot(mask[c], Math.floor(Math.random() * 4)), fixed: false, frozen: false, kind: 'pipe' as const };
      if (Math.random() < 0.7) return { mask: rot(SHAPES[Math.floor(Math.random() * SHAPES.length)], Math.floor(Math.random() * 4)), fixed: false, frozen: false, kind: 'pipe' as const };
      return { mask: 0, fixed: true, frozen: false, kind: 'empty' as const };
    });
    for (const c of keep) if (!this.tiles[c].fixed && this.tiles[c].mask === mask[c] && Math.random() < 0.8) this.tiles[c].mask = rot(mask[c], 1 + Math.floor(Math.random() * 3));
    const corner = (h - 1) * w + (w - 1);
    const corner2 = w - 1;
    const start = Math.random() < 0.5 ? corner : corner2;
    const sx = start % w, sy = Math.floor(start / w);
    this.order = [...Array(n).keys()].sort((a, b) => (Math.abs(a % w - sx) + Math.abs(Math.floor(a / w) - sy)) - (Math.abs(b % w - sx) + Math.abs(Math.floor(b / w) - sy)) || Math.random() - 0.5);
    this.cur = this.src + 1;
    this.flow();
  }

  /** Lights every tile the current reaches from the source. */
  flow() {
    const { w, h } = this;
    this.lit = new Set([this.src]);
    const q = [this.src];
    while (q.length) {
      const c = q.shift()!;
      const x = c % w, y = Math.floor(c / w);
      for (const [dx, dy, b, ob] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nc = ny * w + nx;
        if (this.lit.has(nc) || !(this.tiles[c].mask & b) || !(this.tiles[nc].mask & ob)) continue;
        this.lit.add(nc); q.push(nc);
      }
    }
  }

  /** False once no turning of the unfrozen tiles could reach every drain. */
  possible(): boolean {
    const { w, h } = this;
    const any = (t: Tile, b: number) => (t.fixed || t.frozen ? (t.mask & b) !== 0 : t.mask !== 0 && [0, 1, 2, 3].some((r) => rot(t.mask, r) & b));
    const seen = new Set([this.src]);
    const q = [this.src];
    while (q.length) {
      const c = q.shift()!;
      const x = c % w, y = Math.floor(c / w);
      for (const [dx, dy, b, ob] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nc = ny * w + nx;
        if (seen.has(nc) || !any(this.tiles[c], b) || !any(this.tiles[nc], ob)) continue;
        seen.add(nc); q.push(nc);
      }
    }
    return this.drains.every((d) => seen.has(d));
  }

  turn(c: number, dir: number) {
    const t = this.tiles[c];
    if (t.fixed || t.frozen) { sfx('error'); return; }
    t.mask = rot(t.mask, dir > 0 ? 1 : 3);
    sfx('cursor', { vol: 0.5 });
    this.flow();
    if (this.drains.every((d) => this.lit.has(d))) this.finish(true, 'Every drain runs');
  }

  finish(won: boolean, why: string) {
    this.phase = 'done';
    this.won = won;
    this.why = why;
    sfx(won ? 'quest' : 'fail');
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === 'done') {
      if (pressed('a') || pressed('b') || MOUSE.left) { consume(); this.done = true; }
      return;
    }
    this.clock -= dt;
    if (this.clock <= 0) {
      this.clock += this.step;
      while (this.oi < this.order.length) {
        const c = this.order[this.oi++];
        const t = this.tiles[c];
        if (t.fixed || t.frozen) continue;
        t.frozen = true;
        sfx('hush', { vol: 0.35 });
        break;
      }
      if (!this.possible()) { this.finish(false, 'Frozen shut'); return; }
      if (this.oi >= this.order.length) { this.finish(false, 'Frozen shut'); return; }
    }
    const { w, h } = this;
    let x = this.cur % w, y = Math.floor(this.cur / w);
    if (repeat('left')) x = (x + w - 1) % w;
    if (repeat('right')) x = (x + 1) % w;
    if (repeat('up')) y = (y + h - 1) % h;
    if (repeat('down')) y = (y + 1) % h;
    this.cur = y * w + x;
    if (mouseActive()) {
      const cx = Math.floor((MOUSE.x - this.gx) / CELL), cy = Math.floor((MOUSE.y - this.gy) / CELL);
      if (cx >= 0 && cy >= 0 && cx < w && cy < h) {
        this.cur = cy * w + cx;
        if (MOUSE.left) { consume(); this.turn(this.cur, 1); return; }
        if (MOUSE.right) { consume(); this.turn(this.cur, -1); return; }
      }
    }
    if (pressed('a')) { consume(); this.turn(this.cur, 1); return; }
    if (pressed('b')) { consume(); this.finish(false, 'Stopped'); }
  }

  render() {
    netBackdrop(this.t);
    titleBar(this.def.title ?? 'Bail', `${this.who.name}  Hack ${this.who.pool}`);
    const { w, h, gx, gy } = this;
    box(gx - 3, gy - 3, w * CELL + 5, h * CELL + 5, C.ink, C.cyan1);
    const flowPhase = Math.floor(this.t * 8);
    for (let c = 0; c < w * h; c++) {
      const t = this.tiles[c];
      const x = gx + (c % w) * CELL, y = gy + Math.floor(c / w) * CELL;
      rect(x, y, CELL - 2, CELL - 2, t.frozen ? C.steel2 : t.kind === 'empty' ? C.black : C.ink);
      if (t.frozen) frame(x, y, CELL - 2, CELL - 2, C.steel3);
      const on = this.lit.has(c);
      const col = t.frozen ? (on ? C.pale : C.steel4) : on ? C.cyan3 : C.slate;
      const m = (CELL - 2) / 2;
      const cx = x + m - 2, cy = y + m - 2;
      if (t.mask) rect(cx, cy, 4, 4, col);
      if (t.mask & N) rect(cx, y, 4, m - 2, col);
      if (t.mask & S) rect(cx, cy + 4, 4, m - 2, col);
      if (t.mask & Wd) rect(x, cy, m - 2, 4, col);
      if (t.mask & E) rect(cx + 4, cy, m - 2, 4, col);
      if (on && !t.frozen && t.mask) rect(cx + 1 + (flowPhase % 2), cy + 1, 1, 1, C.cyan4);
      if (t.kind === 'source') { rect(cx - 2, cy - 2, 8, 8, C.cyan4); rect(cx, cy, 4, 4, C.white); }
      if (t.kind === 'drain') { frame(cx - 3, cy - 3, 10, 10, on ? C.cyan4 : C.amb3); rect(cx, cy, 4, 4, on ? C.cyan4 : C.black); }
    }
    if (this.phase === 'play') {
      const x = gx + (this.cur % w) * CELL, y = gy + Math.floor(this.cur / w) * CELL;
      frame(x - 1, y - 1, CELL, CELL, C.white);
    }
    const reached = this.drains.filter((d) => this.lit.has(d)).length;
    const s = `Drains ${reached}/${this.drains.length}`;
    drawText(s, gx - 2, gy + h * CELL + 4, C.cyan3);
    const nf = this.order.slice(this.oi).find((c) => !this.tiles[c].fixed && !this.tiles[c].frozen);
    if (nf !== undefined && this.phase === 'play') {
      const fx = gx + (nf % w) * CELL, fy = gy + Math.floor(nf / w) * CELL;
      const k = Math.max(0, Math.min(1, this.clock / this.step));
      dotFrame(fx, fy, CELL - 2, CELL - 2, C.steel4, Math.floor(this.t * 4));
      rect(fx + 2, fy + CELL - 5, Math.round((CELL - 6) * (1 - k)), 1, C.steel4);
      const tag = 'Frost next';
      drawText(tag, gx + w * CELL - textWidth(tag) + 1, gy + h * CELL + 4, C.gray);
    }
    hintBar('Arrows: move  Z: turn  X: stop');
    if (this.phase === 'done') resultBox(this.won ? 'Bailed' : 'Frozen', this.won, [{ t: this.why, c: this.won ? C.cyan4 : C.gray }]);
  }
}
