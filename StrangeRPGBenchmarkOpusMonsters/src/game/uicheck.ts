// The breathing-room check (Notes/ui.md): every piece of text keeps a clear pixel on all four sides from lines, box
// edges, bars, icons, cursors, and other text. It redraws the current frame with the font's probe on, records every
// rectangle and image drawn to the screen, and reports each string whose one-pixel ring something else touches.
// Three kinds of drawing do not count: anything that covers the whole ring (a background), anything drawn earlier that
// runs under the text itself (scenery or a highlight behind it), and dithers and scenery within a hair of the color
// the text sits on, which read as one surface.
import { textProbe } from '../engine/font';
import { canvas } from '../engine/screen';
import { drawAll } from './modes';

interface Box { x: number; y: number; w: number; h: number }
interface Drawn extends Box { what: string; color: string | null; seq: number }
export interface Breach { text: string; box: Box; by: string; at: Box }

const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const covers = (a: Box, b: Box) => a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
function lum(c: string | null): number | null {
  if (!c || !/^#[0-9a-f]{6}$/i.test(c)) return null;
  const v = parseInt(c.slice(1), 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}

/** Redraws the frame and lists text that something touches within one pixel. */
export function uiCheck(): Breach[] {
  const main = canvas.getContext('2d')!;
  const drawn: Drawn[] = [];
  const proto = CanvasRenderingContext2D.prototype;
  const fill = proto.fillRect, image = proto.drawImage;
  proto.fillRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    if (this === main && !textProbe.inText && w > 0 && h > 0) {
      const color = typeof this.fillStyle === 'string' ? this.fillStyle : null;
      drawn.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), what: `rect ${color || 'pattern'}`, color, seq: drawn.length });
      textProbe.seq = drawn.length;
    }
    return fill.call(this, x, y, w, h);
  };
  proto.drawImage = function (this: CanvasRenderingContext2D, ...a: any[]) {
    if (this === main) {
      const [dx, dy, dw, dh] = a.length >= 9 ? [a[5], a[6], a[7], a[8]] : a.length >= 5 ? [a[1], a[2], a[3], a[4]] : [a[1], a[2], a[0].width, a[0].height];
      drawn.push({ x: Math.round(dx), y: Math.round(dy), w: Math.round(dw), h: Math.round(dh), what: 'image', color: null, seq: drawn.length });
      textProbe.seq = drawn.length;
    }
    return (image as any).apply(this, a);
  } as any;
  textProbe.on = true; textProbe.boxes = []; textProbe.call = 0; textProbe.seq = 0; textProbe.inText = false;
  try { drawAll(); } finally { proto.fillRect = fill; proto.drawImage = image; textProbe.on = false; textProbe.inText = false; }
  // A shadowed string draws twice: its two boxes are one piece of text.
  const texts = new Map<number, Box & { s: string; seq: number }>();
  for (const b of textProbe.boxes) {
    const t = texts.get(b.call);
    if (!t) { texts.set(b.call, { x: b.x, y: b.y, w: b.w, h: b.h, s: b.s, seq: b.seq }); continue; }
    const x0 = Math.min(t.x, b.x), y0 = Math.min(t.y, b.y);
    t.w = Math.max(t.x + t.w, b.x + b.w) - x0; t.h = Math.max(t.y + t.h, b.y + b.h) - y0; t.x = x0; t.y = y0;
  }
  const out: Breach[] = [];
  const list = [...texts.entries()];
  for (const [call, t] of list) {
    if (t.x >= 192 || t.y >= 192 || t.x + t.w <= 0 || t.y + t.h <= 0) continue;
    const ring: Box = { x: t.x - 1, y: t.y - 1, w: t.w + 2, h: t.h + 2 };
    // The surface the text sits on: the last thing drawn before it that covers the whole string.
    // Dithers and images have no one color, so the bed is the last solid color under the text. Scenery drawn in thin
    // strips has no one piece under the whole string: then the last strip under it stands in.
    let bed: Drawn | undefined;
    for (let i = Math.min(t.seq, drawn.length) - 1; i >= 0; i--) if (drawn[i].color && covers(drawn[i], t)) { bed = drawn[i]; break; }
    if (!bed) for (let i = Math.min(t.seq, drawn.length) - 1; i >= 0; i--) if (drawn[i].color && meets(drawn[i], t)) { bed = drawn[i]; break; }
    const bedLum = lum(bed?.color ?? null);
    // A box drawn over the text hides it, and a box under the whole ring hides what was drawn before it.
    if (drawn.some(d => d.seq >= t.seq && covers(d, t))) continue;
    let floor = -1;
    for (let i = Math.min(t.seq, drawn.length) - 1; i >= 0; i--) if (covers(drawn[i], ring)) { floor = i; break; }
    const hit = drawn.find(d => {
      if (d.seq <= floor || !meets(d, ring) || covers(d, ring)) return false;
      if (meets(d, t)) return false;
      if (!d.color) return d.what === 'image';
      const l = lum(d.color);
      return !(bedLum !== null && l !== null && Math.abs(l - bedLum) < 0.06);
    });
    if (hit) { out.push({ text: t.s, box: t, by: hit.what, at: hit }); continue; }
    const other = list.find(([c2, u]) => c2 !== call && meets(u, ring) && u.seq > floor && !drawn.some(d => d.seq >= u.seq && covers(d, u)));
    if (other) out.push({ text: t.s, box: t, by: `text "${other[1].s}"`, at: other[1] });
  }
  return out;
}

(window as any).__ui = { check: uiCheck };
