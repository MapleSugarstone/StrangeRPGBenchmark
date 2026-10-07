// Drawing Stet cards on the pixel grid. Everything is drawn at 1x.
import { text } from '../../engine/font';
import { H, W, buf, frame, px, rect } from '../../engine/screen';
import { LIME, Look, drawSprite } from '../../engine/sprites';
import { C } from '../ui';
import { CARDS, WORDS, Word } from './cards';

export const CARD_W = 28;
export const CARD_H = 36;

/** Colors for each side: frame, fill. Side -1 is nobody's (the book and the shop). */
export const SIDE = {
  0: { edge: 0x6fe3e0, fill: 0x0f2630 },
  1: { edge: 0xe0705a, fill: 0x2c1216 },
  [-1]: { edge: 0x6a6478, fill: 0x15121c },
} as Record<number, { edge: number; fill: number }>;

// A 3x5 capital font for the word printed on each card.
const MINI: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
};

function plot(x: number, y: number, p: number) {
  if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = p;
}

export function mini(s: string, x: number, y: number, rgb: number) {
  const p = px(rgb);
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = MINI[up[i]];
    if (!g) continue;
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (g[gy][gx] === '#') plot(x + i * 4 + gx, y + gy, p);
  }
}

export function miniWidth(s: string) { return s.length * 4 - 1; }

// Sprites the shared sheet does not have.
const LOCAL: Record<string, { rows: string[]; pal: [number, number, number] }> = {
  scrivener: {
    pal: [0x2a2a4a, 0xf2f2f2, 0x6f8cff],
    rows: ['...33...', '..3223..', '..2222..', '..2122..', '...22...', '...21...', '....1...', '....1...'],
  },
};

export function drawArt(key: string, x: number, y: number, look?: Look, anim = 0) {
  const loc = LOCAL[key];
  if (!loc) { drawSprite(key, x, y, { look, frame: anim }); return; }
  let pal = loc.pal;
  if (look === 'copied') pal = [0x000000, LIME, LIME];
  else if (look === 'halted') pal = [0x1a2030, 0x3a4458, 0x5a6478];
  const P = [0, px(pal[0]), px(pal[1]), px(pal[2])];
  for (let yy = 0; yy < 8; yy++) {
    for (let xx = 0; xx < 8; xx++) {
      const c = loc.rows[yy].charCodeAt(xx) - 48;
      if (c >= 1 && c <= 3) plot(x + xx, y + yy, P[c]);
    }
  }
}

export interface Face {
  id: string;
  e: number[];
  printed?: number[];
  word: Word | null;
  side: number;
  copied?: boolean;
  halted?: boolean;
  warded?: boolean;
  again?: boolean;
}

export function faceOf(id: string, side = -1): Face {
  const c = CARDS[id];
  return { id, e: c ? c.edges : [1, 1, 1, 1], printed: c?.edges, word: c?.word ?? null, side, copied: c?.copied };
}

function numColor(f: Face, d: number): number {
  const p = f.printed?.[d];
  if (p === undefined || p === f.e[d]) return C.text;
  return f.e[d] > p ? C.good : C.bad;
}

export function drawCard(f: Face, x: number, y: number, anim = 0) {
  const s = SIDE[f.side] ?? SIDE[-1];
  rect(x, y, CARD_W, CARD_H, s.fill);
  frame(x, y, CARD_W, CARD_H, s.edge);
  if (f.warded) {
    const p = px(WORDS.ward.color);
    for (let k = 2; k < CARD_W - 2; k += 2) { plot(x + k, y + 1, p); plot(x + k, y + CARD_H - 2, p); }
    for (let k = 2; k < CARD_H - 2; k += 2) { plot(x + 1, y + k, p); plot(x + CARD_W - 2, y + k, p); }
  }
  text(String(f.e[0]), x + 12, y + 2, numColor(f, 0));
  text(String(f.e[3]), x + 2, y + 10, numColor(f, 3));
  text(String(f.e[1]), x + 22, y + 10, numColor(f, 1));
  text(String(f.e[2]), x + 12, y + 26, numColor(f, 2));
  const card = CARDS[f.id];
  drawArt(card?.art ?? 'page', x + 10, y + 9, f.halted ? 'halted' : f.copied ? 'copied' : undefined, anim);
  if (f.halted) rect(x + 2, y + 17, CARD_W - 4, 1, 0xff3a3a);
  if (f.word) mini(f.word, x + 14 - (miniWidth(f.word) >> 1), y + 19, WORDS[f.word].color);
  const tier = card?.tier ?? 0;
  const p = px(card?.secret ? LIME : C.gold);
  for (let k = 0; k < tier; k++) plot(x + 14 - tier + 1 + k * 2 - 1, y + 33, p);
  if (f.again) {
    const g = px(LIME);
    plot(x + 2, y + 2, g); plot(x + 25, y + 2, g); plot(x + 2, y + 33, g); plot(x + 25, y + 33, g);
  }
}

/** The back of a card: a ruled page with a margin line. */
export function drawBack(x: number, y: number, side = 1) {
  const s = SIDE[side] ?? SIDE[-1];
  rect(x, y, CARD_W, CARD_H, 0x1a1420);
  frame(x, y, CARD_W, CARD_H, s.edge);
  for (let yy = y + 5; yy < y + CARD_H - 3; yy += 3) rect(x + 3, yy, CARD_W - 6, 1, 0x2a2440);
  rect(x + 7, y + 3, 1, CARD_H - 6, 0x5a2a2a);
}

/** Draws a card into its 28 column slot using only `cols` of its columns, centered, for a flip. */
export function drawNarrow(draw: () => void, x: number, y: number, cols: number) {
  if (cols >= CARD_W) { draw(); return; }
  const save = new Uint32Array(CARD_W * CARD_H);
  const card = new Uint32Array(CARD_W * CARD_H);
  const inside = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H;
  for (let yy = 0; yy < CARD_H; yy++) for (let xx = 0; xx < CARD_W; xx++) if (inside(x + xx, y + yy)) save[yy * CARD_W + xx] = buf[(y + yy) * W + x + xx];
  draw();
  for (let yy = 0; yy < CARD_H; yy++) {
    for (let xx = 0; xx < CARD_W; xx++) {
      if (!inside(x + xx, y + yy)) continue;
      card[yy * CARD_W + xx] = buf[(y + yy) * W + x + xx];
      buf[(y + yy) * W + x + xx] = save[yy * CARD_W + xx];
    }
  }
  if (cols <= 0) return;
  const x0 = x + ((CARD_W - cols) >> 1);
  for (let k = 0; k < cols; k++) {
    const src = Math.min(CARD_W - 1, Math.floor(((k + 0.5) * CARD_W) / cols));
    for (let yy = 0; yy < CARD_H; yy++) if (inside(x0 + k, y + yy)) buf[(y + yy) * W + x0 + k] = card[yy * CARD_W + src];
  }
}

/** A frame one pixel outside a card, for the cursor. */
export function cursorFrame(x: number, y: number, rgb: number) {
  frame(x - 1, y - 1, CARD_W + 2, CARD_H + 2, rgb);
}
