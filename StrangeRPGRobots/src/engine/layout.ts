// Debug record of what drew each interface pixel, so the browser harness can find text that overlaps or
// touches lines, icons, or other text. Off unless the harness turns it on, and then reset after every frame.
import { W, H } from './screen';

export interface Issue { kind: 'overlap' | 'touch' | 'clip' | 'offscreen'; a: string; b?: string; x: number; y: number }

/** float marks text that moves over the battlefield, such as damage numbers, which the audit skips. */
export const LAYOUT = { on: false, float: false, last: [] as Issue[] };

const NONE = 0, TEXT = 1, LINE = 2, ICON = 3;
let kind: Uint8Array | null = null;
let owner: Int32Array = new Int32Array(0);
const els: { k: number; s: string; x: number; y: number; float?: boolean }[] = [{ k: NONE, s: '', x: 0, y: 0 }];
const found = new Map<string, Issue>();
let cur = 0;

function maps(): Uint8Array {
  if (!kind) { kind = new Uint8Array(W * H); owner = new Int32Array(W * H); }
  return kind;
}

function label(id: number): string {
  const e = els[id];
  return e.k === TEXT ? e.s : `${e.k === LINE ? 'line' : 'icon'} at ${e.x},${e.y}`;
}

function report(k: Issue['kind'], a: number, b: number | null, i: number) {
  if (els[a]?.float || (b !== null && els[b]?.float)) return;
  const la = label(a), lb = b === null ? undefined : label(b);
  const key = `${k}|${la}|${lb ?? ''}`;
  if (!found.has(key)) found.set(key, { kind: k, a: la, b: lb, x: i % W, y: Math.floor(i / W) });
}

/** Starts a text element. Copies of the same string within a pixel, as outlines draw, count as one element. */
export function beginText(s: string, x: number, y: number) {
  for (let i = els.length - 1; i > 0; i--) {
    const e = els[i];
    if (e.k === TEXT && e.s === s && Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1) { cur = i; return; }
  }
  els.push({ k: TEXT, s, x, y, float: LAYOUT.float });
  cur = els.length - 1;
}

export function textPixel(i: number) {
  const k = maps();
  if ((k[i] === TEXT && owner[i] !== cur) || k[i] === LINE || k[i] === ICON) report('overlap', cur, owner[i], i);
  k[i] = TEXT; owner[i] = cur;
}

export function textClipped(x: number, y: number) { report('clip', cur, null, y * W + x); }
export function textOffscreen(x: number, y: number) { report('offscreen', cur, null, Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))); }

/** Wrapped text that ran past its line limit, so the end never shows. */
export function wrapClipped(s: string, x: number, y: number) {
  els.push({ k: TEXT, s, x, y });
  report('clip', els.length - 1, null, Math.max(0, y) * W + Math.max(0, x));
}

/** A filled area covers whatever was under it. A line drawn over text is an overlap. */
export function area(x0: number, y0: number, x1: number, y1: number, line: boolean) {
  const k = maps();
  let id = 0;
  if (line) { els.push({ k: LINE, s: '', x: x0, y: y0 }); id = els.length - 1; }
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * W + x;
    if (line && k[i] === TEXT) report('overlap', owner[i], id, i);
    k[i] = line ? LINE : NONE; owner[i] = id;
  }
}

/** The border ring of a box, after its fill has covered the inside. */
export function ring(x: number, y: number, w: number, h: number) {
  const k = maps();
  els.push({ k: LINE, s: '', x, y });
  const id = els.length - 1;
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
    if (yy !== y && yy !== y + h - 1 && xx !== x && xx !== x + w - 1) continue;
    k[yy * W + xx] = LINE; owner[yy * W + xx] = id;
  }
}

let iconId = 0;
export function beginIcon(x: number, y: number) { els.push({ k: ICON, s: '', x, y }); iconId = els.length - 1; }
export function iconPixel(i: number) {
  const k = maps();
  if (k[i] === TEXT) report('overlap', owner[i], iconId, i);
  k[i] = ICON; owner[i] = iconId;
}

export function linePixel(x: number, y: number) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const k = maps();
  if (k[y * W + x] !== LINE) { els.push({ k: LINE, s: '', x, y }); owner[y * W + x] = els.length - 1; }
  k[y * W + x] = LINE;
}

/** Ends the frame: text with a line, icon, or other text in the next pixel has no breathing room. */
export function endFrame() {
  const k = maps();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (k[i] !== TEXT) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (k[j] === LINE || k[j] === ICON) report('touch', owner[i], owner[j], i);
      else if (k[j] === TEXT && owner[j] !== owner[i] && (!dx || !dy) && els[owner[j]].s !== els[owner[i]].s) report('touch', owner[i], owner[j], i);
    }
  }
  LAYOUT.last = [...found.values()];
  found.clear();
  k.fill(0);
  els.length = 1;
}
