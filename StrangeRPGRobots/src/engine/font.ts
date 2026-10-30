// A 5 by 8 pixel font: capitals and digits 6 rows tall, lowercase 5 rows tall, descenders in row 7.
import { PX } from './palette';
import { H, W, buf, alb, emi, flo } from './screen';
import { LAYOUT, beginText, textPixel, textClipped, textOffscreen } from './layout';

const SRC: Record<string, string> = {
  ' ': '... ... ... ... ... ... ... ...',
  A: '.... .##. #..# #..# #### #..# #..# ....', B: '.... ###. #..# ###. #..# #..# ###. ....',
  C: '.... .##. #..# #... #... #..# .##. ....', D: '.... ###. #..# #..# #..# #..# ###. ....',
  E: '.... #### #... ###. #... #... #### ....', F: '.... #### #... ###. #... #... #... ....',
  G: '.... .##. #..# #... #.## #..# .### ....', H: '.... #..# #..# #### #..# #..# #..# ....',
  I: '... ### .#. .#. .#. .#. ### ...', J: '.... ..## ...# ...# ...# #..# .##. ....',
  K: '.... #..# #.#. ##.. #.#. #..# #..# ....', L: '.... #... #... #... #... #... #### ....',
  M: '..... #...# ##.## #.#.# #...# #...# #...# .....', N: '.... #..# ##.# #.## #..# #..# #..# ....',
  O: '.... .##. #..# #..# #..# #..# .##. ....', P: '.... ###. #..# #..# ###. #... #... ....',
  Q: '.... .##. #..# #..# #..# #.#. .#.# ....', R: '.... ###. #..# #..# ###. #.#. #..# ....',
  S: '.... .### #... .##. ...# ...# ###. ....', T: '..... ##### ..#.. ..#.. ..#.. ..#.. ..#.. .....',
  U: '.... #..# #..# #..# #..# #..# .##. ....', V: '..... #...# #...# #...# .#.#. .#.#. ..#.. .....',
  W: '..... #...# #...# #...# #.#.# ##.## #...# .....', X: '.... #..# #..# .##. .##. #..# #..# ....',
  Y: '..... #...# #...# .#.#. ..#.. ..#.. ..#.. .....', Z: '.... #### ...# ..#. .#.. #... #### ....',
  '0': '.... .##. #..# #.## ##.# #..# .##. ....', '1': '... .#. ##. .#. .#. .#. ### ...',
  '2': '.... .##. #..# ..#. .#.. #... #### ....', '3': '.... ###. ...# .##. ...# ...# ###. ....',
  '4': '.... #..# #..# #### ...# ...# ...# ....', '5': '.... #### #... ###. ...# ...# ###. ....',
  '6': '.... .##. #... ###. #..# #..# .##. ....', '7': '.... #### ...# ..#. .#.. .#.. .#.. ....',
  '8': '.... .##. #..# .##. #..# #..# .##. ....', '9': '.... .##. #..# #..# .### ...# .##. ....',
  a: '.... .... .##. ...# .### #..# .### ....', b: '.... #... #... ###. #..# #..# ###. ....',
  c: '.... .... .##. #... #... #... .##. ....', d: '.... ...# ...# .### #..# #..# .### ....',
  e: '.... .... .##. #..# #### #... .##. ....', f: '... .## #.. ### #.. #.. #.. ...',
  g: '.... .... .### #..# #..# .### ...# .##.', h: '.... #... #... ###. #..# #..# #..# ....',
  i: '. # . # # # # .', j: '.. .# .. .# .# .# .# #.',
  k: '.... #... #... #.#. ##.. #.#. #..# ....', l: '.. #. #. #. #. #. .# ..',
  m: '..... ..... ####. #.#.# #.#.# #.#.# #.#.# .....', n: '.... .... ###. #..# #..# #..# #..# ....',
  o: '.... .... .##. #..# #..# #..# .##. ....', p: '.... .... ###. #..# #..# ###. #... #...',
  q: '.... .... .### #..# #..# .### ...# ...#', r: '.... .... #.## ##.. #... #... #... ....',
  s: '.... .... .### #... .##. ...# ###. ....', t: '... .#. ### .#. .#. .#. ..# ...',
  u: '.... .... #..# #..# #..# #..# .### ....', v: '..... ..... #...# #...# .#.#. .#.#. ..#.. .....',
  w: '..... ..... #...# #...# #.#.# #.#.# .#.#. .....', x: '.... .... #..# #..# .##. #..# #..# ....',
  y: '.... .... #..# #..# #..# .### ...# .##.', z: '.... .... #### ..#. .#.. #... #### ....',
  '.': '. . . . . . # .', ',': '.. .. .. .. .. .. .# #.', '!': '. # # # # . # .',
  '?': '.... .##. #..# ..#. .#.. .... .#.. ....', "'": '. # # . . . . .', '"': '... #.# #.# ... ... ... ... ...',
  ':': '. . . # . . # .', ';': '.. .. .. .# .. .. .# #.', '-': '... ... ... ... ### ... ... ...',
  '+': '... ... .#. ### .#. ... ... ...', '(': '.. .# #. #. #. #. .# ..', ')': '.. #. .# .# .# .# #. ..',
  '[': '.. ## #. #. #. #. ## ..', ']': '.. ## .# .# .# .# ## ..', '/': '... ..# ..# .#. .#. #.. #.. ...',
  '\\': '... #.. #.. .#. .#. ..# ..# ...', '*': '... ... #.# .#. #.# ... ... ...',
  '#': '..... .#.#. ##### .#.#. ##### .#.#. ..... .....', '%': '.... #..# ...# ..#. .#.. #... #..# ....',
  '&': '.... .#.. #.#. .#.. #.## #..# .##. ....', '=': '... ... ... ### ... ### ... ...',
  '<': '... ... ..# .#. #.. .#. ..# ...', '>': '... ... #.. .#. ..# .#. #.. ...',
  '_': '.... .... .... .... .... .... .... ####', '~': '.... .... .... .#.# #.#. .... .... ....',
  '@': '..... .###. #...# #.### #.##. #.... .###. .....', '$': '... .#. ### #.. ### ..# ### .#.',
  '^': '... .#. #.# ... ... ... ... ...', '`': '.. #. .# .. .. .. .. ..', '|': '. # # # # # # #',
  '{': '... .## .#. ##. .#. .#. .## ...', '}': '... ##. .#. .## .#. .#. ##. ...',
};

interface Glyph { w: number; rows: number[] }
const GLYPHS = new Map<string, Glyph>();
for (const [ch, s] of Object.entries(SRC)) {
  const rows = s.split(' ');
  const w = rows[0].length;
  GLYPHS.set(ch, { w, rows: rows.map((r) => { let m = 0; for (let i = 0; i < r.length; i++) if (r[i] === '#') m |= 1 << i; return m; }) });
}
const FALLBACK = GLYPHS.get('?')!;

export const LINE_H = 9;

function glyph(ch: string): Glyph { return GLYPHS.get(ch) ?? FALLBACK; }

/** Width in pixels of a string, with one pixel between glyphs. */
export function textWidth(s: string): number {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += glyph(s[i]).w + (i < s.length - 1 ? 1 : 0);
  return w;
}

/** Draws text straight into the frame after lighting, so it never dithers. */
export function drawText(s: string, x: number, y: number, color: number, maxW = 9999): number {
  const px = PX[color];
  let cx = Math.round(x);
  const cy = Math.round(y);
  const x0 = cx;
  const rec = LAYOUT.on;
  if (rec) beginText(s, cx, cy);
  for (let i = 0; i < s.length; i++) {
    const g = glyph(s[i]);
    if (cx + g.w - x0 > maxW) { if (rec) textClipped(cx, cy); break; }
    for (let r = 0; r < 8; r++) {
      const bits = g.rows[r] ?? 0;
      if (!bits) continue;
      const yy = cy + r;
      if (yy < 0 || yy >= H) { if (rec) textOffscreen(cx, yy); continue; }
      for (let c = 0; c < g.w; c++) {
        if (!(bits & (1 << c))) continue;
        const xx = cx + c;
        if (xx < 0 || xx >= W) { if (rec) textOffscreen(xx, yy); continue; }
        buf[yy * W + xx] = px;
        if (rec) textPixel(yy * W + xx);
      }
    }
    cx += g.w + 1;
  }
  return cx - x0;
}

/** Draws text with a one-pixel outline so it reads over the world. */
export function drawTextOutlined(s: string, x: number, y: number, color: number, outline: number) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(s, x + dx, y + dy, outline);
  drawText(s, x, y, color);
}

/** Splits text into lines no wider than maxW pixels, breaking at spaces. */
export function wrap(s: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (textWidth(next) <= maxW || !line) line = next;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

export function centerX(s: string, cx: number): number { return Math.round(cx - textWidth(s) / 2); }

/** Draws text into the world layer as albedo, so it can glow (neon signs) or take light. */
export function drawTextWorld(s: string, x: number, y: number, color: number, kind = 1, vertical = false): number {
  let cx = Math.round(x), cy = Math.round(y);
  const x0 = cx, y0 = cy;
  for (let i = 0; i < s.length; i++) {
    const g = glyph(s[i]);
    const gx = vertical ? cx + Math.floor((5 - g.w) / 2) : cx;
    for (let r = 0; r < 8; r++) {
      const bits = g.rows[r] ?? 0;
      if (!bits) continue;
      const yy = cy + r;
      if (yy < 0 || yy >= H) continue;
      for (let c = 0; c < g.w; c++) {
        if (!(bits & (1 << c))) continue;
        const xx = gx + c;
        if (xx < 0 || xx >= W) continue;
        const k = yy * W + xx;
        alb[k] = color; emi[k] = kind; flo[k] = 0;
      }
    }
    if (vertical) cy += 7; else cx += g.w + 1;
  }
  return vertical ? cy - y0 : cx - x0;
}
