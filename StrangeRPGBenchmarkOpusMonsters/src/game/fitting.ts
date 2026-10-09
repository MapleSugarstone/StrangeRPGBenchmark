import type { Mon, SpriteData } from '../battle/model';
import { MOVES } from '../battle/registry';
import { nextUid, SPECIES } from '../data/species';
import type { Type } from '../data/types';

/** Habits a fit cannot keep: on a fitted whorl they stack or lock the foe (Notes/fusion-exploits.md). Only their own kind carries them. */
export const NO_FIT_HABITS = new Set(['atlas_turnedback', 'habit']);

export interface FitPlan {
  moves: string[];
  passives: string[];
  types: Type[];
  basic: 'P' | 'M';
  retune: { move: string; type: Type } | null;
  sprite: SpriteData;
  name: string;
}

export function rows(s: SpriteData): string[][] { return s.px.map(r => r.split('')); }

export function ensureSeam(g: string[][]): string[][] {
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < 8 && y < 8 && g[y][x] !== '.';
  for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) {
    if (g[y][x] === '.' && [filled(x - 1, y), filled(x + 1, y), filled(x, y - 1), filled(x, y + 1)].filter(Boolean).length >= 3) return g;
  }
  let best: [number, number] | null = null, bd = 99;
  for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) {
    if (g[y][x] !== '2' && g[y][x] !== '3') continue;
    const d = Math.abs(x - 3.5) + Math.abs(y - 4.5);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  if (best) g[best[1]][best[0]] = '.';
  return g;
}

export const SHAPES = ['Left and right', 'Top and bottom', 'First body, second face', 'Second body, first face'];

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const at = (g: string[][], x: number, y: number) => (x >= 0 && y >= 0 && x < 8 && y < 8 ? g[y][x] : '.');
const isFill = (c: string) => c === '2' || c === '3' || c === '4';

/** Ink with no empty neighbor: eyes, mouths, and other details drawn inside the body. */
export function interiorInk(g: string[][]): Set<number> {
  const s = new Set<number>();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (g[y][x] === '1' && N4.every(([dx, dy]) => at(g, x + dx, y + dy) !== '.')) s.add(y * 8 + x);
  return s;
}

/** The fill color most of a pixel's neighbors have, for ink that has to become body. */
export function nearFill(g: string[][], x: number, y: number): string {
  for (const ring of [N4, N8]) {
    const n = { '2': 0, '3': 0, '4': 0 } as Record<string, number>;
    for (const [dx, dy] of ring) { const c = at(g, x + dx, y + dy); if (isFill(c)) n[c]++; }
    const best = ['2', '3', '4'].reduce((p, q) => (n[q] > n[p] ? q : p));
    if (n[best]) return best;
  }
  return '2';
}

/**
 * Removes the ink clumps two outlines leave where they meet: ink inside the body becomes fill unless it is a kept detail,
 * ink touching no fill is dropped, and any 2 by 2 block of ink loses its most enclosed pixel.
 * Only pixels where `near` holds change, so dark areas the parents drew in ink away from the seam stay.
 */
export function cleanInk(g: string[][], keep: Set<number>, near: (x: number, y: number) => boolean = () => true): string[][] {
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (g[y][x] !== '1' || !near(x, y)) continue;
      const fill8 = N8.filter(([dx, dy]) => isFill(at(g, x + dx, y + dy))).length;
      const open4 = N4.filter(([dx, dy]) => at(g, x + dx, y + dy) === '.').length;
      if (!fill8) { g[y][x] = '.'; changed = true; }
      else if (!open4 && !keep.has(y * 8 + x)) { g[y][x] = nearFill(g, x, y); changed = true; }
    }
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const block = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
      if (!block.every(([bx, by]) => g[by][bx] === '1' && near(bx, by))) continue;
      const [bx, by] = block.sort((p, q) => N8.filter(([dx, dy]) => at(g, q[0] + dx, q[1] + dy) !== '.').length - N8.filter(([dx, dy]) => at(g, p[0] + dx, p[1] + dy) !== '.').length)[0];
      g[by][bx] = nearFill(g, bx, by); changed = true;
    }
    if (!changed) break;
  }
  return g;
}

/** The first parent's body with the second's face and the parts that stick out past the first's outline. */
export function wearing(A: string[][], B: string[][], limit = 64): { g: string[][]; keep: Set<number> } {
  const g = A.map(r => r.slice());
  const faceA = interiorInk(A), faceB = interiorInk(B);
  const landed = [...faceB].filter(i => isFill(A[i >> 3][i & 7]) || faceA.has(i));
  const keep = new Set<number>();
  if (landed.length >= 2) {
    for (const i of faceA) g[i >> 3][i & 7] = nearFill(A, i & 7, i >> 3);
    for (const i of landed) { g[i >> 3][i & 7] = '1'; keep.add(i); }
  } else for (const i of faceA) keep.add(i);
  // Pieces of the second parent outside the first's outline come along when they are no bigger than `limit` pixels.
  const seen = new Set<number>();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (seen.has(y * 8 + x) || A[y][x] !== '.' || B[y][x] === '.') continue;
    const part: number[] = [], stack = [y * 8 + x];
    seen.add(y * 8 + x);
    while (stack.length) {
      const i = stack.pop()!, px = i & 7, py = i >> 3;
      part.push(i);
      for (const [dx, dy] of N4) {
        const nx = px + dx, ny = py + dy, j = ny * 8 + nx;
        if (nx < 0 || ny < 0 || nx > 7 || ny > 7 || seen.has(j) || A[ny][nx] !== '.' || B[ny][nx] === '.') continue;
        seen.add(j); stack.push(j);
      }
    }
    if (part.length <= limit) for (const i of part) g[i >> 3][i & 7] = B[i >> 3][i & 7];
  }
  return { g, keep };
}

/** The row to split a head from a body: just under the first parent's narrowest row between rows 2 and 5. */
export function neckRow(A: string[][]): number {
  let best = 4, bw = 99;
  for (let y = 2; y <= 5; y++) { const w = A[y].filter(c => c !== '.').length; if (w > 0 && w < bw) { bw = w; best = y + 1; } }
  return Math.max(3, Math.min(5, best));
}

export function shapeOf(a: SpriteData, b: SpriteData, shape: number): string[] {
  const A = rows(a), B = rows(b);
  let g: string[][], keep: Set<number>;
  if (shape === 2 || shape === 3) ({ g, keep } = shape === 2 ? wearing(A, B) : wearing(B, A));
  else {
    const neck = neckRow(A);
    const fromA = (x: number, y: number) => (shape === 0 ? x < 4 : y < neck);
    g = A.map((r, y) => r.map((c, x) => (fromA(x, y) ? c : B[y][x])));
    const iA = interiorInk(A), iB = interiorInk(B);
    keep = new Set([...iA].filter(i => fromA(i & 7, i >> 3)).concat([...iB].filter(i => !fromA(i & 7, i >> 3))));
    const seam = shape === 0 ? (x: number) => x >= 3 && x <= 4 : (_x: number, y: number) => y >= neck - 1 && y <= neck;
    return ensureSeam(cleanInk(g, keep, seam)).map(r => r.join(''));
  }
  return ensureSeam(cleanInk(g, keep)).map(r => r.join(''));
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function hueGap(p: string, q: string): number {
  const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const [a, b] = [rgb(p), rgb(q)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 441;
}

const three = (s: SpriteData): [string, string, string] => [s.c[0], s.c[1], s.c[2] || s.c[1]];

/**
 * Palettes 0 and 1 are one parent's own three colors. Palette 2 takes its first two colors one from each parent, the pair that differs most
 * while both stay clear of the ink, and its third from the four left over, the one that stands furthest from both.
 */
export function paletteOf(a: SpriteData, b: SpriteData, p: number): [string, string, string] {
  if (p === 0) return three(a);
  if (p === 1) return three(b);
  const pairs: [string, string][] = [[a.c[0], b.c[1]], [b.c[0], a.c[1]], [a.c[0], b.c[0]], [b.c[0], a.c[0]]];
  const score = ([m, s]: [string, string]) => Math.abs(lum(m) - lum(s)) + hueGap(m, s) - (lum(m) < 0.25 ? 1 : 0) - (lum(s) < 0.2 ? 0.5 : 0);
  const [m, s] = pairs.reduce((best, q) => (score(q) > score(best) ? q : best));
  const apart = (c: string) => Math.min(hueGap(m, c) + Math.abs(lum(m) - lum(c)), hueGap(s, c) + Math.abs(lum(s) - lum(c))) - (lum(c) < 0.2 ? 0.5 : 0);
  const rest = [...three(a), ...three(b)].filter(c => c !== m && c !== s);
  return [m, s, rest.length ? rest.reduce((best, c) => (apart(c) > apart(best) ? c : best)) : s];
}

const VOWELS = 'aeiouy';
function firstSyllable(n: string): string {
  const s = n.toLowerCase();
  let i = 0;
  while (i < s.length && !VOWELS.includes(s[i])) i++;
  while (i < s.length && VOWELS.includes(s[i])) i++;
  if (i < s.length && !VOWELS.includes(s[i])) i++;
  return s.slice(0, Math.max(2, i));
}
function lastSyllable(n: string): string {
  const s = n.toLowerCase();
  let i = s.length - 1;
  while (i > 0 && !VOWELS.includes(s[i])) i--;
  while (i > 0 && VOWELS.includes(s[i - 1])) i--;
  if (i > 0) i--;
  return s.slice(i);
}
function tidy(s: string): string {
  let t = s.replace(/(.)\1\1+/g, '$1$1').slice(0, 9);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function nameOptions(a: string, b: string): string[] {
  const A = a.toLowerCase(), B = b.toLowerCase();
  const opts = [
    tidy(A.slice(0, Math.ceil(A.length / 2)) + B.slice(Math.floor(B.length / 2))),
    tidy(B.slice(0, Math.ceil(B.length / 2)) + A.slice(Math.floor(A.length / 2))),
    tidy(firstSyllable(A) + lastSyllable(B)),
    tidy(firstSyllable(B) + lastSyllable(A)),
    tidy(A + B.slice(-2)),
    tidy(B.slice(0, 2) + A),
  ];
  const out: string[] = [];
  for (const o of opts) if (o.length >= 3 && !out.includes(o) && o.toLowerCase() !== A && o.toLowerCase() !== B) out.push(o);
  return out.slice(0, 4);
}

export function typeOptions(a: Mon, b: Mon): Type[][] {
  const all = [...new Set([...a.types, ...b.types])];
  const out: Type[][] = [];
  for (const t of all) out.push([t]);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) out.push([all[i], all[j]]);
  return out;
}

export function phraseOf(m: Mon): string {
  if ((m as any).phrase) return (m as any).phrase;
  return SPECIES[m.kind]?.fit || 'walks';
}
export function pegsOf(m: Mon): number {
  if ((m as any).pegs !== undefined) return (m as any).pegs;
  return SPECIES[m.kind]?.pegs || 1;
}

export function fitCost(a: Mon, b: Mon): number {
  return Math.max(a.level, b.level) * 10;
}

export function canFit(m: Mon): string | null {
  if (m.person) return 'A person\'s cast conjoins with nothing.';
  if (m.fitted) return 'That one\'s conjoined already. Once is all a cast takes.';
  return null;
}

export function bigCount(moves: string[]): number {
  return moves.filter(id => (MOVES[id]?.nerve || 0) > 0).length;
}

export function makeFit(a: Mon, b: Mon, plan: FitPlan, order: number): Mon {
  const pegs = pegsOf(a) + pegsOf(b);
  const entry = `Half ${a.name} and half ${b.name}. It ${phraseOf(a)} and ${phraseOf(b)}. ${pegs === 1 ? 'One cowrie' : pegs + ' cowries'}.`;
  const m: Mon = {
    uid: nextUid(), kind: 'fit', name: plan.name, types: plan.types, basic: plan.basic, moves: plan.moves, passives: plan.passives,
    retune: plan.retune, level: Math.max(a.level, b.level), xp: a.level >= b.level ? a.xp : b.xp, notion: null, sprite: plan.sprite,
    fitted: true, parents: [a.name, b.name], entry, legendary: a.legendary || b.legendary, fitOrder: order,
  };
  (m as any).phrase = phraseOf(a);
  (m as any).pegs = pegs;
  return m;
}
