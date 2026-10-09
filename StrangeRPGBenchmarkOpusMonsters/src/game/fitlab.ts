// Candidate conjoining looks side by side, for choosing the algorithm. Debug only: nothing in play calls it.
import type { SpriteData } from '../battle/model';
import { cleanInk, ensureSeam, interiorInk, neckRow, paletteOf, rows, shapeOf, wearing } from './fitting';

type Grid = string[][];
export interface Look { group: string; label: string; px: string[]; c: SpriteData['c'] }

const at = (g: Grid, x: number, y: number) => (x >= 0 && y >= 0 && x < 8 && y < 8 ? g[y][x] : '.');
const shift = (g: Grid, dx: number, dy: number): Grid => g.map((r, y) => r.map((_, x) => at(g, x - dx, y - dy)));
const done = (g: Grid, keep: Set<number>) => ensureSeam(cleanInk(g, keep)).map(r => r.join(''));

function box(g: Grid): [number, number] {
  let x0 = 8, x1 = -1, y0 = 8, y1 = -1;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (g[y][x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? [3.5, 3.5] : [(x0 + x1) / 2, (y0 + y1) / 2];
}

/** Where a sprite's face is: the middle of its interior ink, or the middle of its body when it has no face. */
function anchor(g: Grid): [number, number] {
  const f = [...interiorInk(g)];
  if (f.length < 2) return box(g);
  return [f.reduce((s, i) => s + (i & 7), 0) / f.length, f.reduce((s, i) => s + (i >> 3), 0) / f.length];
}

/** The second sprite moved so its face sits where the first one's face is. */
function lineUp(A: Grid, B: Grid): Grid {
  const [ax, ay] = anchor(A), [bx, by] = anchor(B);
  return shift(B, Math.round(ax - bx), Math.round(ay - by));
}

/** The original algorithm, before the cleanup, kept for comparison. */
function original(A: Grid, B: Grid, s: number): string[] {
  const g = A.map((r, y) => r.map((c, x) => {
    if (s === 0) return x < 4 ? c : B[y][x];
    if (s === 1) return y < 4 ? c : B[y][x];
    if (s === 2) return c !== '.' ? c : B[y][x];
    return (x + y) % 2 === 0 ? (c !== '.' ? c : B[y][x]) : (B[y][x] !== '.' ? B[y][x] : c);
  }));
  return ensureSeam(g).map(r => r.join(''));
}

function halves(A: Grid, B: Grid, leftRight: boolean, neck: number): string[] {
  const fromA = (x: number, y: number) => (leftRight ? x < 4 : y < neck);
  const g = A.map((r, y) => r.map((c, x) => (fromA(x, y) ? c : B[y][x])));
  const keep = new Set([...interiorInk(A)].filter(i => fromA(i & 7, i >> 3)).concat([...interiorInk(B)].filter(i => !fromA(i & 7, i >> 3))));
  return done(g, keep);
}

function wear(A: Grid, B: Grid, limit: number): string[] {
  const { g, keep } = wearing(A, B, limit);
  return done(g, keep);
}

/** Both silhouettes together, the first on top, with the first's face only. */
function union(A: Grid, B: Grid): string[] {
  const g = A.map((r, y) => r.map((c, x) => (c !== '.' ? c : B[y][x])));
  return done(g, interiorInk(A));
}

export function variants(a: SpriteData, b: SpriteData): Look[] {
  const A = rows(a), B = rows(b);
  const oldMix: [string, string] = [a.c[0], b.c[1]], mix = paletteOf(a, b, 2);
  const out: Look[] = [];
  const add = (group: string, label: string, px: string[], c: SpriteData['c'] = mix) => out.push({ group, label, px, c });
  ['left/right', 'top/bottom', 'one over', 'woven'].forEach((l, s) => add('Original', l, original(A, B, s), oldMix));
  add('Fix 1 (live): all of B comes along', 'left/right', halves(A, B, true, 4));
  add('Fix 1 (live): all of B comes along', 'top/bottom', halves(A, B, false, neckRow(A)));
  add('Fix 1 (live): all of B comes along', 'A body', wear(A, B, 64));
  add('Fix 1 (live): all of B comes along', 'B body', wear(B, A, 64));
  for (let s = 0; s < 2; s++) add('Fix 2: small parts only', ['left/right', 'top/bottom'][s], shapeOf(a, b, s));
  add('Fix 2: small parts only', 'A body', wear(A, B, 7));
  add('Fix 2: small parts only', 'B body', wear(B, A, 7));
  const Bv = shift(B, 0, Math.round(box(A)[1] - box(B)[1]));
  const Bn = shift(B, Math.round(box(A)[0] - box(B)[0]), neckRow(A) - neckRow(B));
  add('Fix 3: lined up first', 'left/right', halves(A, Bv, true, 4));
  add('Fix 3: lined up first', 'top/bottom', halves(A, Bn, false, neckRow(A)));
  add('Fix 3: lined up first', 'A body', wear(A, lineUp(A, B), 9));
  add('Fix 3: lined up first', 'B body', wear(B, lineUp(B, A), 9));
  add('Fix 4: both outlines, lined up', 'A face', union(A, lineUp(A, B)));
  add('Fix 4: both outlines, lined up', 'B face', wear(A, lineUp(A, B), 64));
  return out;
}
