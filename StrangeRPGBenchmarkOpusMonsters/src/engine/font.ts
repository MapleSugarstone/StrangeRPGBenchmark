import { ctx } from './screen';

// Five columns by eight rows. Bit 16 is the left column. Row 7 holds descenders.
const G: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17, 0], B: [30, 17, 17, 30, 17, 17, 30, 0], C: [14, 17, 16, 16, 16, 17, 14, 0],
  D: [28, 18, 17, 17, 17, 18, 28, 0], E: [31, 16, 16, 30, 16, 16, 31, 0], F: [31, 16, 16, 30, 16, 16, 16, 0],
  G: [14, 17, 16, 23, 17, 17, 15, 0], H: [17, 17, 17, 31, 17, 17, 17, 0], I: [14, 4, 4, 4, 4, 4, 14, 0],
  J: [7, 2, 2, 2, 2, 18, 12, 0], K: [17, 18, 20, 24, 20, 18, 17, 0], L: [16, 16, 16, 16, 16, 16, 31, 0],
  M: [17, 27, 21, 21, 17, 17, 17, 0], N: [17, 25, 21, 19, 17, 17, 17, 0], O: [14, 17, 17, 17, 17, 17, 14, 0],
  P: [30, 17, 17, 30, 16, 16, 16, 0], Q: [14, 17, 17, 17, 21, 18, 13, 0], R: [30, 17, 17, 30, 20, 18, 17, 0],
  S: [15, 16, 16, 14, 1, 1, 30, 0], T: [31, 4, 4, 4, 4, 4, 4, 0], U: [17, 17, 17, 17, 17, 17, 14, 0],
  V: [17, 17, 17, 17, 17, 10, 4, 0], W: [17, 17, 17, 21, 21, 21, 10, 0], X: [17, 17, 10, 4, 10, 17, 17, 0],
  Y: [17, 17, 10, 4, 4, 4, 4, 0], Z: [31, 1, 2, 4, 8, 16, 31, 0],
  a: [0, 0, 14, 1, 15, 17, 15, 0], b: [16, 16, 22, 25, 17, 17, 30, 0], c: [0, 0, 14, 16, 16, 17, 14, 0],
  d: [1, 1, 13, 19, 17, 17, 15, 0], e: [0, 0, 14, 17, 31, 16, 14, 0], f: [6, 9, 8, 28, 8, 8, 8, 0],
  g: [0, 0, 15, 17, 17, 15, 1, 14], h: [16, 16, 22, 25, 17, 17, 17, 0], i: [4, 0, 12, 4, 4, 4, 14, 0],
  j: [2, 0, 6, 2, 2, 2, 18, 12], k: [16, 16, 18, 20, 24, 20, 18, 0], l: [12, 4, 4, 4, 4, 4, 14, 0],
  m: [0, 0, 26, 21, 21, 21, 17, 0], n: [0, 0, 22, 25, 17, 17, 17, 0], o: [0, 0, 14, 17, 17, 17, 14, 0],
  p: [0, 0, 30, 17, 17, 30, 16, 16], q: [0, 0, 15, 17, 17, 15, 1, 1], r: [0, 0, 22, 25, 16, 16, 16, 0],
  s: [0, 0, 15, 16, 14, 1, 30, 0], t: [8, 8, 28, 8, 8, 9, 6, 0], u: [0, 0, 17, 17, 17, 19, 13, 0],
  v: [0, 0, 17, 17, 17, 10, 4, 0], w: [0, 0, 17, 17, 21, 21, 10, 0], x: [0, 0, 17, 10, 4, 10, 17, 0],
  y: [0, 0, 17, 17, 17, 15, 1, 14], z: [0, 0, 31, 2, 4, 8, 31, 0],
  '0': [14, 17, 19, 21, 25, 17, 14, 0], '1': [4, 12, 4, 4, 4, 4, 14, 0], '2': [14, 17, 1, 2, 4, 8, 31, 0],
  '3': [31, 2, 4, 2, 1, 17, 14, 0], '4': [2, 6, 10, 18, 31, 2, 2, 0], '5': [31, 16, 30, 1, 1, 17, 14, 0],
  '6': [6, 8, 16, 30, 17, 17, 14, 0], '7': [31, 1, 2, 4, 8, 8, 8, 0], '8': [14, 17, 17, 14, 17, 17, 14, 0],
  '9': [14, 17, 17, 15, 1, 2, 12, 0],
  '.': [0, 0, 0, 0, 0, 0, 4, 0], ',': [0, 0, 0, 0, 0, 0, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4, 0],
  '?': [14, 17, 1, 2, 4, 0, 4, 0], "'": [4, 4, 8, 0, 0, 0, 0, 0], '"': [10, 10, 0, 0, 0, 0, 0, 0],
  ':': [0, 0, 0, 4, 0, 0, 4, 0], ';': [0, 0, 0, 4, 0, 0, 4, 8], '-': [0, 0, 0, 14, 0, 0, 0, 0],
  '+': [0, 0, 4, 4, 31, 4, 4, 0], '(': [2, 4, 8, 8, 8, 4, 2, 0], ')': [8, 4, 2, 2, 2, 4, 8, 0],
  '/': [1, 1, 2, 4, 8, 16, 16, 0], '%': [24, 25, 2, 4, 8, 19, 3, 0], '#': [10, 10, 31, 10, 31, 10, 10, 0],
  '*': [0, 4, 21, 14, 21, 4, 0, 0], '=': [0, 0, 31, 0, 31, 0, 0, 0], '<': [2, 4, 8, 16, 8, 4, 2, 0],
  '>': [8, 4, 2, 1, 2, 4, 8, 0], '_': [0, 0, 0, 0, 0, 0, 0, 31], '[': [14, 8, 8, 8, 8, 8, 14, 0],
  ']': [14, 2, 2, 2, 2, 2, 14, 0], '&': [12, 18, 20, 8, 21, 18, 13, 0], '|': [4, 4, 4, 4, 4, 4, 4, 0],
  '^': [4, 10, 17, 0, 0, 0, 0, 0], '~': [0, 0, 8, 21, 2, 0, 0, 0],
  // UI glyphs: pointer, down pointer, filled dot, empty dot, up pointer, small block, the nerve mark.
  '\u0001': [16, 24, 28, 30, 28, 24, 16, 0], '\u0002': [0, 31, 14, 4, 0, 0, 0, 0], '\u0003': [0, 14, 31, 31, 31, 14, 0, 0],
  '\u0004': [0, 14, 17, 17, 17, 14, 0, 0], '\u0005': [0, 0, 4, 14, 31, 0, 0, 0], '\u0006': [0, 31, 31, 31, 31, 31, 0, 0],
  '\u0007': [4, 4, 14, 21, 4, 4, 4, 0],
};

interface Glyph { rows: number[]; x0: number; w: number }
const GLYPHS: Record<string, Glyph> = {};
for (const [ch, rows] of Object.entries(G)) {
  let lo = 5, hi = -1;
  for (const r of rows) for (let c = 0; c < 5; c++) if (r & (16 >> c)) { lo = Math.min(lo, c); hi = Math.max(hi, c); }
  if (hi < 0) { lo = 0; hi = 2; }
  GLYPHS[ch] = { rows, x0: lo, w: hi - lo + 1 };
}
GLYPHS[' '] = { rows: [0, 0, 0, 0, 0, 0, 0, 0], x0: 0, w: 2 };

export const LINE = 9;

/** Rewrites text as it is measured and drawn, so the hero's chosen name replaces the default one in every line. */
let filter: (s: string) => string = s => s;
export function setTextFilter(f: (s: string) => string): void { filter = f; }

export function charWidth(ch: string): number {
  const g = GLYPHS[ch] || GLYPHS['?'];
  return g.w + 1;
}

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of filter(s)) w += charWidth(ch);
  return Math.max(0, w - 1);
}

/**
 * A debug probe for the breathing-room check (src/game/uicheck.ts). While `on`, every string drawn records its ink box,
 * and `inText` is true while its pixels are drawn, so the check can tell text from lines and boxes.
 */
export const textProbe = { on: false, inText: false, call: 0, seq: 0, boxes: [] as { s: string; x: number; y: number; w: number; h: number; call: number; seq: number }[] };

/** The ink box of a string drawn at x, y: rows and columns that hold a lit pixel. */
function inkBox(s: string, x: number, y: number, scale: number): { x: number; y: number; w: number; h: number } | null {
  let top = 8, bot = -1, left = Infinity, right = -1, cx = 0;
  for (const ch of filter(s)) {
    const g = GLYPHS[ch] || GLYPHS['?'];
    let inked = false;
    for (let r = 0; r < 8; r++) if (g.rows[r]) { top = Math.min(top, r); bot = Math.max(bot, r); inked = true; }
    if (inked) { left = Math.min(left, cx); right = Math.max(right, cx + g.w - 1); }
    cx += g.w + 1;
  }
  if (bot < 0) return null;
  return { x: Math.round(x) + left * scale, y: Math.round(y) + top * scale, w: (right - left + 1) * scale, h: (bot - top + 1) * scale };
}

export function text(s: string, x: number, y: number, color: string, shadow?: string): number {
  if (textProbe.on) textProbe.call++;
  if (shadow) drawRaw(s, x + 1, y + 1, shadow);
  return drawRaw(s, x, y, color);
}

function drawRaw(s: string, x: number, y: number, color: string): number {
  if (textProbe.on) { const b = inkBox(s, x, y, 1); if (b) textProbe.boxes.push({ s: filter(s), ...b, call: textProbe.call, seq: textProbe.seq }); textProbe.inText = true; }
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of filter(s)) {
    const g = GLYPHS[ch] || GLYPHS['?'];
    for (let r = 0; r < 8; r++) {
      const row = g.rows[r];
      if (!row) continue;
      for (let c = g.x0; c < g.x0 + g.w; c++) if (row & (16 >> c)) ctx.fillRect(cx + c - g.x0, cy + r, 1, 1);
    }
    cx += g.w + 1;
  }
  textProbe.inText = false;
  return cx;
}

/** Draws text scaled up by an integer factor. */
export function bigText(s: string, x: number, y: number, scale: number, color: string): void {
  if (textProbe.on) { textProbe.call++; const b = inkBox(s, x, y, scale); if (b) textProbe.boxes.push({ s, ...b, call: textProbe.call, seq: textProbe.seq }); textProbe.inText = true; }
  ctx.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of s) {
    const g = GLYPHS[ch] || GLYPHS['?'];
    for (let r = 0; r < 8; r++) {
      const row = g.rows[r];
      for (let c = g.x0; c < g.x0 + g.w; c++) if (row & (16 >> c)) ctx.fillRect(cx + (c - g.x0) * scale, y + r * scale, scale, scale);
    }
    cx += (g.w + 1) * scale;
  }
  textProbe.inText = false;
}

export function bigWidth(s: string, scale: number): number {
  return textWidth(s) * scale;
}

export function textCenter(s: string, cx: number, y: number, color: string, shadow?: string): void {
  text(s, Math.round(cx - textWidth(s) / 2), y, color, shadow);
}

export function textRight(s: string, rx: number, y: number, color: string, shadow?: string): void {
  text(s, rx - textWidth(s), y, color, shadow);
}

/** Wraps text to a pixel width. Keeps explicit newlines. */
export function wrap(s: string, width: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (textWidth(t) <= width) line = t;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}
