import { GLYPHS, FONT_W, FONT_H } from "./fontdata";

export { FONT_W, FONT_H };

const compiled = new Map<string, number[]>();

function compile(rows: string[]): number[] {
  return rows.map((r) => {
    let bits = 0;
    for (let i = 0; i < FONT_W; i++) if (r[i] === "#") bits |= 1 << (FONT_W - 1 - i);
    return bits;
  });
}

/** Row bitmasks for a character. Unknown characters render as a box. */
export function glyph(ch: string): number[] {
  let g = compiled.get(ch);
  if (!g) {
    const rows = GLYPHS[ch] ?? GLYPHS["?"] ?? ["####", "#..#", "#..#", "#..#", "####", "...."];
    g = compile(rows);
    compiled.set(ch, g);
  }
  return g;
}

export function textWidth(s: string): number {
  return s.length * FONT_W;
}

/** Greedy word wrap to a column count. Honors explicit newlines. */
export function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      if (line.length === 0) line = w;
      else if (line.length + 1 + w.length <= cols) line += " " + w;
      else { out.push(line); line = w; }
      while (line.length > cols) { out.push(line.slice(0, cols)); line = line.slice(cols); }
    }
    out.push(line);
  }
  return out;
}
