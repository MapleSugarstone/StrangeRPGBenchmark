// Splice: the breach grid. Picks alternate between a row and a column into a short buffer, and a target is cut
// when its glyphs sit in the buffer in order. One more cell frosts over after every pick.
import { rect, frame, dotFrame, box } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { W } from '../engine/screen';
import { pressed, repeat, MOUSE, mouseActive, consume } from '../engine/input';
import { sfx } from '../audio/sfx';
import { GLYPHS, SPLICE, type Glyph, type SpliceDef } from '../content/undertow_puzzles';
import { drawGlyph, hacker, hintBar, netBackdrop, resultBox, titleBar, type Minigame } from './minigame';

interface Target { seq: Glyph[]; label: string; flag?: string; state: 'open' | 'cut' | 'lost' }

const CELL = 14, GX = 6, GY = 20, PX0 = 112;

export class Splice implements Minigame {
  def: SpliceDef;
  n: number;
  bufLen: number;
  timeMax: number;
  left: number;
  who: { name: string; pool: number };
  grid: Glyph[] = [];
  used: boolean[] = [];
  frost: boolean[] = [];
  order: number[] = [];
  oi = 0;
  mode: 'row' | 'col' = 'row';
  line = 0;
  cur = 0;
  picks: number[] = [];
  targets: Target[] = [];
  started = false;
  phase: 'play' | 'done' = 'play';
  t = 0;
  done = false;
  won = false;
  bonus: string[] = [];
  count = 0;
  why = '';

  constructor(id: string) {
    this.def = SPLICE.get(id) ?? { id, difficulty: 2, targets: [{ label: 'Break in' }] };
    const d = Math.max(1, Math.min(4, this.def.difficulty));
    this.who = hacker();
    this.n = this.def.size ?? (d <= 1 ? 5 : d <= 3 ? 6 : 7);
    this.bufLen = Math.min(8, this.def.buffer ?? [5, 6, 7, 7][d - 1] + (this.who.pool >= 8 ? 1 : 0));
    this.timeMax = this.def.time ?? [45, 40, 34, 28][d - 1] + this.who.pool * 2;
    this.left = this.timeMax;
    this.build(d);
  }

  build(d: number) {
    const n = this.n, N = n * n;
    const lens = this.def.targets.map((t, i) => t.len ?? (i === 0 ? (d <= 2 ? 2 : 3) : d >= 4 && i === this.def.targets.length - 1 ? 4 : 3));
    while (lens.reduce((a, b) => a + b, 0) > this.bufLen) { const i = lens.indexOf(Math.max(...lens)); lens[i]--; }
    const total = lens.reduce((a, b) => a + b, 0);
    for (let tries = 0; tries < 200; tries++) {
      this.grid = Array.from({ length: N }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
      this.order = shuffle([...Array(N).keys()]);
      const walk = this.solve(total);
      if (!walk) continue;
      let k = 0;
      this.targets = this.def.targets.map((t, i) => {
        const seq = walk.slice(k, k + lens[i]).map((c) => this.grid[c]);
        k += lens[i];
        return { seq, label: t.label, flag: t.flag, state: 'open' as const };
      });
      if (this.targets.some((a, i) => this.targets.some((b, j) => i !== j && `,${b.seq.join()},`.includes(`,${a.seq.join()},`)))) continue;
      break;
    }
    this.used = Array(N).fill(false);
    this.frost = Array(N).fill(false);
    this.oi = 0;
  }

  /** A path of picks that obeys the alternation and the frost order, so the puzzle can always be solved. */
  solve(len: number): number[] | null {
    const n = this.n;
    const used = new Set<number>(), frost = new Set<number>();
    const path: number[] = [];
    const frostStep = (oi: number): [number, number | null] => {
      while (oi < this.order.length && (used.has(this.order[oi]) || frost.has(this.order[oi]))) oi++;
      return oi < this.order.length ? [oi + 1, this.order[oi]] : [oi, null];
    };
    const go = (k: number, mode: 'row' | 'col', line: number, oi: number): boolean => {
      if (k === len) return true;
      const cands = shuffle([...Array(n).keys()]).map((i) => (mode === 'row' ? line * n + i : i * n + line));
      for (const c of cands) {
        if (used.has(c) || frost.has(c)) continue;
        used.add(c); path.push(c);
        const [noi, f] = frostStep(oi);
        if (f !== null) frost.add(f);
        const nextLine = mode === 'row' ? c % n : Math.floor(c / n);
        if (go(k + 1, mode === 'row' ? 'col' : 'row', nextLine, noi)) return true;
        if (f !== null) frost.delete(f);
        used.delete(c); path.pop();
      }
      return false;
    };
    return go(0, 'row', 0, 0) ? path : null;
  }

  cellOf(i: number): number { return this.mode === 'row' ? this.line * this.n + i : i * this.n + this.line; }
  canPick(c: number): boolean { return !this.used[c] && !this.frost[c]; }
  nextFrost(): number | null {
    for (let i = this.oi; i < this.order.length; i++) { const c = this.order[i]; if (!this.used[c] && !this.frost[c]) return c; }
    return null;
  }

  pick(c: number) {
    if (!this.canPick(c)) { sfx('error'); return; }
    this.started = true;
    this.used[c] = true;
    this.picks.push(c);
    sfx('hack', { vol: 0.5 });
    const f = this.nextFrost();
    if (f !== null) { this.frost[f] = true; this.oi = this.order.indexOf(f) + 1; }
    this.mode = this.mode === 'row' ? 'col' : 'row';
    this.line = this.mode === 'col' ? c % this.n : Math.floor(c / this.n);
    this.cur = this.mode === 'col' ? Math.floor(c / this.n) : c % this.n;
    this.score();
    const room = this.bufLen - this.picks.length;
    const any = [...Array(this.n).keys()].some((i) => this.canPick(this.cellOf(i)));
    if (room <= 0) this.finish('Buffer full');
    else if (!any) this.finish('No way on');
    else if (this.targets.every((t) => t.state !== 'open')) this.finish('All cut');
  }

  score() {
    const seq = this.picks.map((c) => this.grid[c]).join(',');
    const room = this.bufLen - this.picks.length;
    for (const t of this.targets) {
      if (t.state !== 'open') continue;
      if (`,${seq},`.includes(`,${t.seq.join(',')},`)) { t.state = 'cut'; sfx('pass'); continue; }
      let overlap = 0;
      const buf = this.picks.map((c) => this.grid[c]);
      for (let k = Math.min(t.seq.length - 1, buf.length); k > 0; k--) {
        if (buf.slice(buf.length - k).join() === t.seq.slice(0, k).join()) { overlap = k; break; }
      }
      if (t.seq.length - overlap > room) { t.state = 'lost'; sfx('fail', { vol: 0.4 }); }
    }
  }

  finish(why: string) {
    this.phase = 'done';
    this.why = why;
    for (const t of this.targets) if (t.state === 'open') t.state = 'lost';
    this.won = this.targets[0]?.state === 'cut';
    this.bonus = this.targets.slice(1).filter((t) => t.state === 'cut' && t.flag).map((t) => t.flag!);
    sfx(this.won ? 'quest' : 'fail');
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === 'done') {
      if (pressed('a') || pressed('b') || MOUSE.left) { consume(); this.done = true; }
      return;
    }
    if (this.started) {
      this.left -= dt;
      if (this.left <= 0) { this.left = 0; this.finish('Traced'); return; }
    }
    const n = this.n;
    const back = this.mode === 'row' ? 'left' : 'up', fwd = this.mode === 'row' ? 'right' : 'down';
    if (repeat(back)) { this.cur = (this.cur + n - 1) % n; sfx('cursor', { vol: 0.3 }); }
    if (repeat(fwd)) { this.cur = (this.cur + 1) % n; sfx('cursor', { vol: 0.3 }); }
    if (mouseActive()) {
      const cx = Math.floor((MOUSE.x - GX) / CELL), cy = Math.floor((MOUSE.y - GY) / CELL);
      if (cx >= 0 && cy >= 0 && cx < n && cy < n) {
        const onLine = this.mode === 'row' ? cy === this.line : cx === this.line;
        if (onLine) {
          this.cur = this.mode === 'row' ? cx : cy;
          if (MOUSE.left) { consume(); this.pick(this.cellOf(this.cur)); return; }
        }
      }
    }
    if (pressed('a')) { consume(); this.pick(this.cellOf(this.cur)); return; }
    if (pressed('b') || MOUSE.right) { consume(); this.finish(this.started ? 'Stopped' : 'Left'); }
  }

  render() {
    netBackdrop(this.t);
    titleBar(this.def.title ?? 'Splice', `${this.who.name}  Hack ${this.who.pool}`);
    const n = this.n;
    const gw = n * CELL;
    box(GX - 3, GY - 3, gw + 5, gw + 5, C.ink, C.cyan1);
    for (let i = 0; i < n; i++) {
      const c = this.cellOf(i);
      const x = GX + (c % n) * CELL, y = GY + Math.floor(c / n) * CELL;
      rect(x - 1, y - 1, CELL, CELL, C.vio0);
    }
    const nf = this.phase === 'play' ? this.nextFrost() : null;
    for (let c = 0; c < n * n; c++) {
      const x = GX + (c % n) * CELL, y = GY + Math.floor(c / n) * CELL;
      if (this.frost[c]) { rect(x, y, CELL - 2, CELL - 2, C.steel3); frame(x, y, CELL - 2, CELL - 2, C.pale); continue; }
      if (this.used[c]) { rect(x, y, CELL - 2, CELL - 2, C.black); drawGlyph(this.grid[c], x + 2, y + 2, C.slate); continue; }
      drawGlyph(this.grid[c], x + 2, y + 2);
      if (c === nf) dotFrame(x, y, CELL - 2, CELL - 2, C.steel3, Math.floor(this.t * 4));
    }
    if (this.phase === 'play') {
      const c = this.cellOf(this.cur);
      frame(GX + (c % n) * CELL - 1, GY + Math.floor(c / n) * CELL - 1, CELL, CELL, this.canPick(c) ? C.white : C.mag2);
    }
    const ly = GY + gw + 6;
    const what = this.mode === 'row' ? `Pick in row ${this.line + 1}` : `Pick in column ${this.line + 1}`;
    drawText(this.phase === 'play' ? what : this.why, GX, ly, C.pale);
    drawText('Frost next', GX + 10, ly + 10, C.gray);
    dotFrame(GX, ly + 11, 7, 7, C.steel3, 0);

    let y = GY;
    drawText('Buffer', PX0, y, C.cyan3);
    y += 10;
    for (let i = 0; i < this.bufLen; i++) {
      const x = PX0 + i * 10;
      frame(x, y, 9, 9, C.cyan1);
      const c = this.picks[i];
      if (c !== undefined) drawGlyph(this.grid[c], x + 1, y + 1);
    }
    y += 14;
    drawText('Trace', PX0, y, C.cyan3);
    const bw = W - 6 - PX0;
    const k = this.left / this.timeMax;
    frame(PX0, y + 10, bw, 5, C.cyan1);
    rect(PX0 + 1, y + 11, Math.max(0, Math.round((bw - 2) * k)), 3, k < 0.25 ? C.mag3 : this.started ? C.cyan3 : C.slate);
    y += 22;
    this.targets.forEach((t, i) => {
      const col = t.state === 'cut' ? C.cyan4 : t.state === 'lost' ? C.slate : C.pale;
      t.seq.forEach((g, j) => drawGlyph(g, PX0 + j * 9, y, t.state === 'lost' ? C.slate : undefined));
      const tag = t.state === 'cut' ? 'CUT' : t.state === 'lost' ? 'LOST' : i === 0 ? 'JOB' : '';
      if (tag) drawText(tag, W - 6 - textWidth(tag), y, t.state === 'cut' ? C.cyan4 : t.state === 'lost' ? C.slate : C.amb3);
      drawText(t.label, PX0, y + 9, col, bw);
      y += 22;
    });
    hintBar(this.mode === 'row' ? 'Left, right: move  Z: pick  X: stop' : 'Up, down: move  Z: pick  X: stop');
    if (this.phase === 'done') {
      resultBox(this.won ? 'Spliced' : 'Cut off', this.won, this.targets.map((t) => ({ t: `${t.state === 'cut' ? 'Cut' : 'Lost'}: ${t.label}`, c: t.state === 'cut' ? C.cyan4 : C.gray })));
    }
  }
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
