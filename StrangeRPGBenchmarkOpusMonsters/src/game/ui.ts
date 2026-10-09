import { ctx, frame, rect, INK } from '../engine/screen';
import { text } from '../engine/font';
import { TYPE_COLOR, type Type } from '../data/types';

export const PAPER = '#e8e2d0';
export const DIM = '#8a8478';
export const BOX = '#17151d';
export const SEL = '#f0c860';
export const GOOD = '#7ac86a';
export const WARN = '#e0b040';
export const BADC = '#d05a4a';
export const SHIELD = '#b8d0e8';
export const NERVE = '#e8903a';
export const MINE = '#7ab0d8';
export const THEIRS = '#d88080';
/** Behind portraits: light enough that a sprite's black ink still shows. */
export const PORTRAIT_BG = '#4a4560';

export function box(x: number, y: number, w: number, h: number, edge = PAPER): void {
  frame(x, y, w, h, BOX, edge);
}

export function hpColor(f: number): string {
  return f > 0.5 ? GOOD : f > 0.25 ? WARN : BADC;
}

/** HP bar with optional preview of where HP will land and a shield overlay. */
export function hpBar(x: number, y: number, w: number, hp: number, max: number, shield = 0, preview: number | null = null, line: number | null = null): void {
  rect(x, y, w, 5, INK);
  rect(x + 1, y + 1, w - 2, 3, '#2e2a36');
  const inner = w - 2;
  const f = Math.max(0, Math.min(1, hp / max));
  const fw = Math.round(inner * f);
  rect(x + 1, y + 1, fw, 3, hpColor(f));
  if (preview !== null && preview < hp) {
    const pw = Math.round(inner * Math.max(0, preview / max));
    const blink = (performance.now() / 160) % 2 < 1;
    rect(x + 1 + pw, y + 1, fw - pw, 3, blink ? PAPER : BADC);
  } else if (preview !== null && preview > hp) {
    const pw = Math.round(inner * Math.min(1, preview / max));
    rect(x + 1 + fw, y + 1, pw - fw, 3, '#bff0b0');
  }
  // A notch every 10 HP and a full-height one every 50, spaced out further when they would crowd together.
  let step = 10;
  while (step < max && (inner * step) / max < 3) step *= 5;
  ctx.save();
  for (let v = step; v < max; v += step) {
    ctx.globalAlpha = v % 50 === 0 ? 0.42 : 0.24;
    rect(x + 1 + Math.round((inner * v) / max), y + 1, 1, v % 50 === 0 ? 3 : 2, INK);
  }
  ctx.restore();
  if (shield > 0) {
    const sw = Math.min(inner, Math.round(inner * shield / max));
    rect(x + 1, y, sw, 1, SHIELD);
  }
  if (line !== null) {
    const lx = x + 1 + Math.round(inner * line);
    rect(lx, y - 1, 1, 6, SEL);
  }
}

/** A cooldown: a small hourglass, 5 wide and 7 tall. */
export function cdIcon(x: number, y: number, c: string): void {
  glyph([31, 17, 10, 4, 10, 17, 31], 5, x, y, c);
}

/** A tide cost: one wave crest under a dot of foam, 5 wide and 5 tall, as in the tide gauge. */
export function tideIcon(x: number, y: number, c: string): void {
  glyph([4, 0, 14, 17, 0], 5, x, y, c);
}

/** Draws a small bitmap whose rows are bit masks, left column first, `w` columns wide. */
function glyph(rows: number[], w: number, x: number, y: number, c: string): void {
  ctx.fillStyle = c;
  rows.forEach((row, r) => { for (let k = 0; k < w; k++) if (row & (1 << (w - 1 - k))) ctx.fillRect(x + k, y + r, 1, 1); });
}

/** A side's tide: a pale crescent moon, then one small wave crest per point, lit up to the side's tide. 57 pixels wide, 5 tall. */
export function tideGauge(x: number, y: number, n: number, max: number): void {
  glyph([7, 12, 8, 12, 7], 5, x, y, '#efe6c4');
  glyph([0, 0, 8, 0, 0], 5, x, y, '#b8ae8c');
  for (let k = 0; k < max; k++) glyph([6, 9], 4, x + 7 + k * 5, y + 2, k < n ? NERVE : '#3a3442');
}

/** One whorl of a side's team as a small shell, 4 by 4. */
export function teamShell(x: number, y: number, c: string): void {
  glyph([6, 9, 11, 4], 4, x, y, c);
}

/** A cap laid under a side, 3 by 2. */
export function capIcon(x: number, y: number): void {
  glyph([2, 7], 3, x, y, '#a07a50');
}

// 7 by 7 type sigils. Each row is seven bits, left column is bit 64.
const SIGILS: Record<Type, number[]> = {
  STONE: [8, 28, 0, 62, 0, 127, 127], TIDE: [0, 51, 76, 0, 51, 76, 0], ROOT: [8, 42, 28, 8, 20, 34, 65], GEAR: [8, 62, 54, 119, 54, 62, 8],
  BEAST: [42, 0, 28, 62, 62, 20, 0], STAR: [8, 8, 28, 127, 28, 8, 8], SALT: [8, 54, 73, 73, 73, 54, 8], VOID: [28, 34, 65, 73, 65, 34, 28],
};

// 5 by 5 sigils for tight spots such as the battle panels. Left column is bit 16.
const MINI_SIGILS: Record<Type, number[]> = {
  STONE: [4, 0, 14, 0, 31], TIDE: [9, 22, 0, 9, 22], ROOT: [4, 21, 14, 4, 10], GEAR: [10, 31, 27, 31, 10],
  BEAST: [21, 0, 14, 31, 10], STAR: [4, 14, 31, 14, 4], SALT: [31, 17, 17, 17, 31], VOID: [14, 17, 21, 17, 14],
};

export function miniSigil(t: Type, x: number, y: number, c = TYPE_COLOR[t]): void {
  ctx.fillStyle = c;
  MINI_SIGILS[t].forEach((row, r) => { for (let k = 0; k < 5; k++) if (row & (16 >> k)) ctx.fillRect(x + k, y + r, 1, 1); });
}

export function sigil(t: Type, x: number, y: number, c = TYPE_COLOR[t]): void {
  ctx.fillStyle = c;
  SIGILS[t].forEach((row, r) => { for (let k = 0; k < 7; k++) if (row & (64 >> k)) ctx.fillRect(x + k, y + r, 1, 1); });
}

function line(x0: number, y0: number, x1: number, y1: number, c: string, every = 1): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  for (;;) {
    if (n++ % every === 0) rect(x0, y0, 1, 1, c);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Fills a polygon with a checker dither of one color, on the screen's own pixel grid. */
function ditherPoly(pts: [number, number][], c: string): void {
  const ys = pts.map(p => p[1]);
  for (let y = Math.ceil(Math.min(...ys)); y <= Math.floor(Math.max(...ys)); y++) {
    const xs: number[] = [];
    pts.forEach(([ax, ay], i) => {
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y + 0.5) !== (by <= y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
    });
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) if ((x + y) & 1) rect(x, y, 1, 1, c);
  }
}

/**
 * A stat chart with one point per stat. Each ratio is the stat against its base for the level, so a plain whorl sits on
 * the dim base ring, nacre pushes a point out, and the seam pulls every point in.
 */
export function statChart(cx: number, cy: number, r: number, ratios: number[], labels: string[], fill: string, boosted: boolean[]): void {
  const n = ratios.length;
  const at = (k: number, rad: number): [number, number] => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / n; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; };
  // Profiles run from 0.7 to 1.35 of the even spread, so that range fills most of the chart, and the even spread is the inner ring.
  const radOf = (q: number) => r * Math.max(0.2, Math.min(1.05, 0.25 + (q - 0.6) * 0.95));
  for (let k = 0; k < n; k++) { const [x, y] = at(k, r); line(cx, cy, x, y, '#2e2a3a', 2); }
  const base = ratios.map((_, k) => at(k, radOf(1)));
  base.forEach((p, k) => { const q = base[(k + 1) % n]; line(p[0], p[1], q[0], q[1], '#3a3442'); });
  const pts = ratios.map((q, k) => at(k, radOf(q)));
  ditherPoly(pts, fill);
  pts.forEach((p, k) => { const q = pts[(k + 1) % n]; line(p[0], p[1], q[0], q[1], PAPER); });
  pts.forEach((p, k) => rect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 3, 3, boosted[k] ? GOOD : PAPER));
  labels.forEach((s, k) => { const [x, y] = at(k, r + 9); text(s, Math.round(x - (s.length * 6 - 1) / 2), Math.round(y - 4), boosted[k] ? GOOD : DIM); });
}

export const typeName = (t: Type): string => t[0] + t.slice(1).toLowerCase();

/** A type's sigil with its name beside it, in the type's color. Returns the x after it. */
export function typeBadge(t: Type, x: number, y: number): number {
  sigil(t, x, y + 1);
  return text(typeName(t), x + 9, y + 1, TYPE_COLOR[t]) + 5;
}

export function typeWord(t: Type, x: number, y: number): number {
  return text(t, x, y, TYPE_COLOR[t]);
}

// 5 by 5 status icons. Each row is five bits, left column is bit 16.
const ICONS: Record<string, [number[], string]> = {
  stun: [[21, 14, 31, 14, 21], '#f0e060'], silence: [[17, 10, 4, 10, 17], '#a0a0c0'], sleep: [[30, 2, 4, 8, 30], '#8aa0e0'],
  root: [[4, 4, 21, 14, 4], '#8a6a3a'], taunt: [[4, 4, 4, 0, 4], '#e07040'], slow: [[4, 4, 21, 14, 4], '#7aa0c8'],
  haste: [[4, 14, 21, 4, 4], '#a0e0a0'], burn: [[4, 10, 21, 17, 14], '#f08a30'], bleed: [[4, 14, 31, 31, 14], '#c83a3a'],
  poison: [[14, 21, 31, 14, 10], '#9a5ab0'], rot: [[0, 9, 22, 0, 0], '#7a8a4a'], expose: [[14, 17, 21, 17, 14], '#e8a0a0'],
  weaken: [[17, 10, 4, 4, 4], '#a08070'], fortify: [[31, 17, 17, 10, 4], '#c8c8d8'], empower: [[4, 14, 4, 14, 31], '#f0a040'],
  stasis: [[31, 17, 17, 17, 31], '#d0d0e0'], hidden: [[21, 0, 17, 0, 21], '#8a84b0'], revealed: [[0, 14, 27, 14, 0], '#e0d8a0'],unstop: [[8, 12, 31, 12, 8], '#e0c080'], ward: [[4, 10, 17, 10, 4], '#a0d0f0'],
  thorns: [[21, 14, 31, 14, 21], '#6aa04a'], regen: [[4, 4, 31, 4, 4], '#7ad07a'], invuln: [[14, 17, 0, 4, 14], '#f8e8a0'],
  doom: [[14, 31, 21, 14, 10], '#b03a5a'], monument: [[31, 14, 14, 14, 31], '#d8d4c8'], guard: [[31, 31, 17, 10, 4], '#e8e2d0'],
};

export function statusIcon(id: string, x: number, y: number): boolean {
  const ic = ICONS[id];
  if (!ic) return false;
  ctx.fillStyle = ic[1];
  ic[0].forEach((row, r) => { for (let c = 0; c < 5; c++) if (row & (16 >> c)) ctx.fillRect(x + c, y + r, 1, 1); });
  return true;
}

/** A kit mark: a small diamond, with its stack count beside it when above one. */
export function markIcon(x: number, y: number, c: string, n: number): void {
  rect(x + 2, y, 1, 1, c); rect(x + 1, y + 1, 3, 1, c); rect(x, y + 2, 5, 1, c); rect(x + 1, y + 3, 3, 1, c); rect(x + 2, y + 4, 1, 1, c);
  if (n > 1) text(String(Math.min(9, n)), x + 6, y - 1, c);
}

export function pips(x: number, y: number, n: number, max: number, on: string, off = '#3a3442', size = 3): void {
  for (let i = 0; i < max; i++) rect(x + i * (size + 1), y, size, size, i < n ? on : off);
}

export function cursor(x: number, y: number, c = SEL): void {
  text('\u0001', x, y, c);
}

export function label(s: string, x: number, y: number, c = PAPER): number {
  return text(s, x, y, c);
}
