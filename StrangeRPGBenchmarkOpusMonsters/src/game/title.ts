// The title screen's night scene over the Volute, the WHORL logo, and the menu. The file and name screens draw the same scene, dimmed.
import { SPECIES } from '../data/species';
import { text, textCenter, textWidth } from '../engine/font';
import type { SpriteData } from '../battle/model';
import { drawSprite, PEOPLE } from '../engine/sprites';
import { dither, mix, rect, INK } from '../engine/screen';
import { PAPER, SEL } from './ui';

const hash = (n: number) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

/** A frame count from the clock, for screens that draw the scene without their own counter. */
export const nightFrame = () => Math.floor(performance.now() / (1000 / 60));

// ---------------------------------------------------------------- the shapes of the scene, each a height by screen column

/** The Lip: the pale rim of the shell far off, curving up toward both edges of the screen. */
const lipTop = (x: number) => 94 - 0.0042 * (x - 96) * (x - 96);
const lipBottom = (x: number) => lipTop(x) + 5 + Math.abs(x - 96) * 0.05;
/** The far wooded land, with Turnstone's lights on it. */
const land = (x: number) => 103 + 3 * Math.sin(x / 13) + 2 * Math.sin(x / 5.3 + 1);
/** The meadow ridge in the middle distance. */
const ridge = (x: number) => 128 + 6 * Math.sin((x + 20) / 30) + Math.sin(x / 7);
/** The dune Ouro stands on. */
const dune = (x: number) => 152 - 13 * Math.exp(-(((x - 74) / 52) ** 2)) - 4 * Math.exp(-(((x - 170) / 30) ** 2));

/** Bands of color down a span of rows, joined by ordered dither so no in-between colors appear. */
function bands(y0: number, y1: number, cols: string[]): void {
  const n = cols.length - 1, h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const a = Math.round(y0 + i * h), b = Math.round(y0 + (i + 1) * h);
    rect(0, a, 192, b - a, cols[i]);
    const step = Math.max(1, Math.floor((b - a) / 4));
    for (let k = 1; k <= 3; k++) dither(0, a + k * step, 192, b - a - k * step, cols[i + 1], k / 4);
  }
}

const STARS = Array.from({ length: 150 }, (_, i) => ({ x: Math.floor(hash(i) * 192), y: Math.floor(hash(i + 500) * 92), b: hash(i + 900), ph: Math.floor(hash(i + 1300) * 97) }));
const BRIGHT = [[24, 14], [70, 46], [118, 8], [178, 22], [10, 58]];
const SPECKS = Array.from({ length: 34 }, (_, i) => ({ x: Math.floor(hash(i + 2000) * 192), d: hash(i + 2100), ph: Math.floor(hash(i + 2200) * 300) }));

/** Draws the night over the Volute. `cam` sways the layers sideways at different speeds for depth. */
export function drawNight(t: number, opts: { dim?: number; figures?: boolean } = {}): void {
  const cam = Math.sin(t / 320) * 6;
  const off = (f: number) => Math.round(cam * f);
  bands(0, 100, ['#0b0a1c', '#120f2e', '#1a1642', '#241e5a', '#2e2670']);
  // A faint band of far stars across the sky.
  for (let y = 0; y < 92; y++) dither(Math.round(20 + y * 1.3) - off(0.05) - 16, y, 34, 1, '#221d52', 0.3);
  const so = off(0.05);
  for (const s of STARS) {
    const x = (s.x - so + 192) % 192;
    if (s.y > lipTop(x) - 3) continue;
    const tw = (Math.floor((t + s.ph * 7) / 24) + s.ph) % 9;
    if (tw === 0 && s.b > 0.5) continue;
    rect(x, s.y, 1, 1, s.b > 0.8 ? '#fffbe8' : s.b > 0.45 ? '#c8c0e8' : '#6a64a8');
  }
  BRIGHT.forEach(([bx, by], i) => {
    const x = bx - so, k = (Math.sin(t / 30 + i * 2) + 1) / 2;
    rect(x, by, 1, 1, '#fffbe8');
    if (k > 0.4) { rect(x - 1, by, 3, 1, '#c8c0e8'); rect(x, by - 1, 1, 3, '#c8c0e8'); }
    if (k > 0.85) { rect(x - 2, by, 1, 1, '#6a64a8'); rect(x + 2, by, 1, 1, '#6a64a8'); rect(x, by - 2, 1, 1, '#6a64a8'); rect(x, by + 2, 1, 1, '#6a64a8'); }
  });
  // The moon hangs over the Apex and drifts a little.
  const mx = Math.round(166 + Math.sin(t / 900) * 3) - off(0.1), my = 50;
  for (let r = 22; r >= 14; r -= 4) for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    dither(mx - w, my + y, w * 2 + 1, 1, r > 18 ? '#1e1a50' : '#2a2668', 0.35);
  }
  for (let y = -11; y <= 11; y++) {
    const w = Math.round(Math.sqrt(121 - y * y));
    rect(mx - w, my + y, w * 2 + 1, 1, '#f4ecd8');
    rect(mx + w - 2, my + y, 2, 1, '#d8cdb8');
  }
  for (const [cx, cy, r] of [[-4, -3, 2], [3, 2, 3], [-2, 5, 1], [5, -5, 1]]) dither(mx + cx - r, my + cy - r, r * 2 + 1, r * 2 + 1, '#cfc2a8', 0.5);
  rect(mx - 6, my - 10, 5, 1, '#fffbe8'); rect(mx - 8, my - 8, 2, 2, '#fffbe8');
  drawFalling(t, so);
  // The Lip, far across the water, and the Lipwater at its foot.
  const lo = off(0.15);
  for (let x = 0; x < 192; x++) {
    const sx = x + lo, a = Math.round(lipTop(sx)), b = Math.round(lipBottom(sx));
    rect(x, a, 1, b - a, '#7a70a8');
    rect(x, a, 1, 1, '#d8d0f0');
    dither(x, a + 1, 1, 2, '#b0a6d4', 0.5);
    const wTop = b, wBot = Math.round(land(x + off(0.4)));
    if (wBot > wTop) {
      rect(x, wTop, 1, wBot - wTop, '#141a44');
      dither(x, wTop, 1, 2, '#2a3270', 0.5);
    }
  }
  // Light on the water: short strokes that slide and flicker.
  for (let k = 0; k < 14; k++) {
    const y = Math.round(70 + hash(k + 40) * 32), x = Math.round((hash(k + 60) * 192 + t * (0.1 + hash(k) * 0.15)) % 192);
    if (y < lipBottom(x + lo) + 1 || y > land(x + off(0.4)) - 1 || (Math.floor(t / 16) + k) % 5 === 0) continue;
    rect(x, y, 2 + (k % 3), 1, k % 4 === 0 ? '#8a90d0' : '#3a4490');
  }
  // Holm, far out, a pale hump in the water.
  const hx = 14 - off(0.2), hy = 86 + (Math.floor(t / 50) % 2);
  rect(hx, hy + 2, 12, 2, '#c8c0b0'); rect(hx + 2, hy + 1, 7, 1, '#e8e2d0'); rect(hx + 5, hy - 1, 2, 2, '#c8906a'); rect(hx - 1, hy + 4, 14, 1, '#4a5098');
  drawApex(166 - off(0.25), t);
  // The far land and Turnstone's windows.
  const fo = off(0.4);
  for (let x = 0; x < 192; x++) { const y = Math.round(land(x + fo)); rect(x, y, 1, 192 - y, '#100d22'); if ((x + fo + 400) % 7 < 2) rect(x, y - 1, 1, 1, '#100d22'); }
  for (const [wx, i] of [[22, 0], [26, 1], [31, 2], [36, 3], [41, 4]] as const) {
    const x = wx - fo, y = Math.round(land(wx)) + 4 + (i % 2) * 2;
    if ((Math.floor(t / 40) + i * 3) % 11 !== 0) rect(x, y, 1, 1, i % 2 ? '#f0c860' : '#e8904a');
  }
  // The meadow ridge, with grass leaning in the wind.
  const ro = off(0.65);
  for (let x = 0; x < 192; x++) {
    const y = Math.round(ridge(x + ro));
    rect(x, y, 1, 192 - y, '#1a1632');
    if ((x + ro + 600) % 5 === 0) { const lean = Math.round(Math.sin(t / 40 + x / 9)); rect(x + lean, y - 2, 1, 2, '#262244'); }
  }
  dither(0, 132, 192, 20, '#141028', 0.25);
  // The dune in front, its sand, and star glitter settled on it.
  const doff = off(1);
  for (let x = 0; x < 192; x++) {
    const y = Math.round(dune(x + doff));
    rect(x, y, 1, 192 - y, '#120f1e');
    rect(x, y, 1, 1, '#2a2444');
  }
  dither(0, 160, 192, 32, '#1a1630', 0.25);
  for (const s of SPECKS) {
    const x = (s.x - doff + 384) % 192, y = Math.round(dune(x + doff) + 4 + s.d * 34);
    const ph = (t + s.ph) % 300;
    if (ph < 5) { rect(x, y, 1, 1, '#fffbe8'); rect(x - 1, y, 3, 1, '#c8c0e8'); rect(x, y - 1, 1, 3, '#c8c0e8'); }
    else if (ph < 40) rect(x, y, 1, 1, ph < 20 ? '#e8e0f8' : '#6a64a8');
  }
  // Motes of star dust rise off the dune and fade.
  for (let k = Math.floor((t - 160) / 31); k <= Math.floor(t / 31); k++) {
    const age = t - k * 31;
    if (age < 0 || age >= 160) continue;
    const x0 = 24 + hash(k + 3000) * 150, x = Math.round(x0 + Math.sin((age + k * 13) / 18) * 2) - doff;
    const y = Math.round(dune(x0) - age * 0.3);
    rect(x, y, 1, 1, age < 100 ? '#f0e8a0' : '#8a7a50');
  }
  if (opts.figures !== false) drawFigures(t, doff);
  // Grass right in front, darker than everything.
  for (let x = -4; x < 196; x += 3) {
    const h = 6 + Math.floor(hash(x + 50) * 9), lean = Math.round(Math.sin(t / 34 + x / 11) * 1.5);
    if (x > 40 && x < 150) continue;
    for (let k = 0; k < h; k++) rect(x + Math.round(lean * k / h), 191 - k, 1, 1, '#0b0a14');
  }
  if (opts.dim) dither(0, 0, 192, 192, INK, opts.dim);
}

/** Falling stars: one every few seconds, streaking down toward the east with a tail that thins out. */
function drawFalling(t: number, so: number): void {
  const P = 170;
  for (let k = Math.floor(t / P) - 1; k <= Math.floor(t / P); k++) {
    const t0 = k * P + Math.floor(hash(k + 7000) * 90), age = t - t0;
    if (age < 0 || age > 30) continue;
    const x0 = 20 + hash(k + 7100) * 120 - so, y0 = 4 + hash(k + 7200) * 24, sp = 2.6;
    const hx = x0 + age * sp, hy = y0 + age * sp * 0.55;
    for (let j = 14; j >= 0; j--) {
      const x = Math.round(hx - j * sp * 0.7), y = Math.round(hy - j * sp * 0.38);
      if (y > lipTop(x) - 2) continue;
      rect(x, y, 1, 1, j < 2 ? '#fffbe8' : j < 6 ? '#f0d890' : j < 10 ? '#a07a50' : '#4a3a50');
    }
    if (age < 26) rect(Math.round(hx) + 1, Math.round(hy), 1, 1, '#fffbe8');
  }
}

/** The Apex: the spire of the shell rising out of the middle of the Volute, banded by its whorls, its top lit by the moon. */
function drawApex(ax: number, t: number): void {
  const top = 66, base = 104;
  for (let y = top; y < base; y++) {
    const f = (y - top) / (base - top), w = Math.max(1, Math.round(24 * f ** 0.85));
    rect(ax - w, y, w * 2 + 1, 1, '#17142e');
    for (let x = -w; x <= w; x++) {
      const groove = ((y - top) * 1.0 + x * 0.42 + 64) % 7;
      if (groove < 1) rect(ax + x, y, 1, 1, '#2a2650');
      else if (groove < 2 && x > -w / 2) rect(ax + x, y, 1, 1, '#211d40');
    }
    rect(ax + w, y, 1, 1, '#3a3672');
    if (f < 0.35) rect(ax - w, y, 1, 1, '#2a2650');
  }
  rect(ax, top - 1, 1, 1, '#4a4690');
  // A slow glint where the moonlight catches a ridge of the spire.
  const g = Math.floor(t / 4) % 120;
  if (g < 34) { const y = top + 2 + g, w = Math.round(24 * ((y - top) / (base - top)) ** 0.85); rect(ax + w - 1, y, 1, 1, '#8a86d0'); }
}

/** Ouro on the dune with the three strays the Strandmonger offers, looking out at the Apex. */
function drawFigures(t: number, doff: number): void {
  const breathe = (n: number) => (Math.floor((t + n * 37) / 60) % 2) * 2;
  const at = (x: number) => Math.round(dune(x + 8)) - 15;
  const look = (id: string): SpriteData | null => (SPECIES[id] ? { px: SPECIES[id].sprite, c: SPECIES[id].c } as SpriteData : null);
  const kinds = [['bramble', 38, 0], ['dynamo', 104, 1]] as const;
  for (const [id, x, n] of kinds) {
    const s = look(id);
    if (s) drawSprite(s, x - doff, at(x) - breathe(n), 2, n === 0);
  }
  const sq = look('squall');
  if (sq) drawSprite(sq, 90 - doff, at(90) - 18 + Math.round(Math.sin(t / 26) * 2) * 2, 2, true);
  drawSprite(PEOPLE.vellum, 64 - doff, at(64) - breathe(2), 2);
}

// ---------------------------------------------------------------- the logo

/** The letters as 20 by 28 shapes with strokes six pixels thick. */
const LOGO: Record<string, (x: number, y: number) => boolean> = {
  W: (x, y) => (x < 6 || x >= 14 || (x >= 7 && x < 13 && y >= 9) || y >= 22) && !(y >= 25 && (x < 2 || x > 17)) && !(y >= 26 && x >= 6 && x < 14),
  H: (x, y) => x < 6 || x >= 14 || (y >= 11 && y < 17),
  R: (x, y) => x < 6 || (y < 6 && x < 17) || (x >= 13 && x < 19 && y < 16 && !(x >= 17 && (y < 2 || y >= 14))) || (y >= 10 && y < 16 && x < 17)
    || (y >= 16 && x >= 7 + (y - 16) * 0.75 && x < 13.5 + (y - 16) * 0.6),
  L: (x, y) => x < 6 || y >= 22,
};
/** Nacre down the height of the logo: pale at the top, pink, then blue, then deep violet. */
const nacre = (f: number) => f < 0.3 ? mix('#fffaf0', '#f4dcea', f / 0.3) : f < 0.65 ? mix('#f4dcea', '#c8d6f2', (f - 0.3) / 0.35) : mix('#c8d6f2', '#8070c8', (f - 0.65) / 0.35);

/** The WHORL logo, 116 by 28, with its letters landing one by one in the first frames. The O is a shell with a seam. */
export function drawLogo(x0: number, y0: number, t: number): void {
  const shine = (t % 260) * 1.2 - 40;
  const letters = ['W', 'H', 'O', 'R', 'L'];
  letters.forEach((ch, i) => {
    const land = 18 + i * 9, age = t - land;
    if (age < 0) return;
    const drop = age < 8 ? Math.round((8 - age) * (8 - age) / 8) : 0;
    const lx = x0 + i * 24, ly = y0 - drop;
    if (ch === 'O') shell(lx, ly, shine, x0);
    else letter(LOGO[ch], lx, ly, shine, x0);
    if (age >= 8 && age < 20) {
      const k = age - 8, sx = lx + 19, sy = ly - 1;
      rect(sx - (k < 6 ? 2 : 1), sy, k < 6 ? 5 : 3, 1, '#fffbe8'); rect(sx, sy - (k < 6 ? 2 : 1), 1, k < 6 ? 5 : 3, '#fffbe8');
    }
  });
}

function letter(shape: (x: number, y: number) => boolean, x0: number, y0: number, shine: number, lx0: number): void {
  const on = (x: number, y: number) => x >= 0 && x < 20 && y >= 0 && y < 28 && shape(x, y);
  for (let y = 0; y < 28; y++) for (let x = 0; x < 20; x++) if (on(x, y)) rect(x0 + x + 2, y0 + y + 3, 1, 1, '#2a1850');
  for (let y = -1; y < 29; y++) for (let x = -1; x < 21; x++) {
    if (on(x, y)) continue;
    if (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1)) rect(x0 + x, y0 + y, 1, 1, INK);
  }
  for (let y = 0; y < 28; y++) for (let x = 0; x < 20; x++) {
    if (!on(x, y)) continue;
    let col = nacre(y / 28);
    if (!on(x, y - 1)) col = '#fffbf4';
    else if (!on(x - 1, y)) col = mix(col, '#ffffff', 0.45);
    else if (!on(x, y + 1) || !on(x, y + 2)) col = mix(col, '#3a2a70', !on(x, y + 1) ? 0.6 : 0.3);
    else if (!on(x + 1, y)) col = mix(col, '#3a2a70', 0.4);
    else if (!on(x - 2, y) || !on(x, y - 2)) col = mix(col, '#ffffff', 0.2);
    const d = x0 + x - lx0 + y * 0.6 - shine;
    if (d >= 0 && d < 3) col = '#ffffff';
    rect(x0 + x, y0 + y, 1, 1, col);
  }
}

/** The O: a spiral shell the size of a letter, with a groove winding in to the middle and a seam down from the top. */
function shell(x0: number, y0: number, shine: number, lx0: number): void {
  const cx = x0 + 9.5, cy = y0 + 13.5, rx = 10, ry = 14;
  const inside = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = y0 - 1; y < y0 + 29; y++) for (let x = x0 - 1; x < x0 + 21; x++) if (inside(x - 2, y - 3)) rect(x, y, 1, 1, '#2a1850');
  for (let y = y0 - 2; y < y0 + 30; y++) for (let x = x0 - 2; x < x0 + 22; x++) {
    if (inside(x, y)) continue;
    if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) rect(x, y, 1, 1, INK);
  }
  for (let y = y0; y < y0 + 28; y++) for (let x = x0; x < x0 + 20; x++) {
    if (!inside(x, y)) continue;
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, r = Math.sqrt(u * u + v * v), th = Math.atan2(v, u);
    let col = nacre((y - y0) / 28);
    if (!inside(x, y - 1)) col = '#fffbf4';
    else if (!inside(x + 1, y) || !inside(x, y + 1)) col = mix(col, '#3a2a70', 0.5);
    const turn = (th + Math.PI) / (Math.PI * 2);
    const g = ((r - turn * 0.3) % 0.3 + 0.3) % 0.3;
    if (g < 0.055 && r > 0.08) col = '#6a50a8';
    else if (g < 0.1 && r > 0.08) col = mix(col, '#6a50a8', 0.4);
    // The seam: one clear line from the top of the shell down to the middle, as the old logo had.
    if (Math.abs(x + 0.5 - cx) < 0.6 && v < -0.1) col = INK;
    const d = x - lx0 + (y - y0) * 0.6 - shine;
    if (d >= 0 && d < 3 && col !== INK) col = '#ffffff';
    rect(x, y, 1, 1, col);
  }
}

// ---------------------------------------------------------------- the menu

/** A small spiral shell for the menu's cursor, turning a quarter every few frames. */
function cursorShell(x: number, y: number, t: number, flip: boolean): void {
  const f = Math.floor(t / 10) % 4;
  const pts = [[2, 0], [3, 0], [4, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 4], [0, 3], [0, 2], [1, 1], [2, 2]];
  rect(x, y, 5, 5, INK);
  pts.forEach(([px, py], i) => {
    const qx = flip ? 4 - px : px;
    rect(x + qx, y + py, 1, 1, i === (f * 3) % 12 ? '#ffffff' : i > 9 ? '#c8a040' : SEL);
  });
}

/** The menu items under the scene. `show` fades them in from 0 to 1. `flash` blinks the chosen item while it is picked. */
export function drawMenu(opts: string[], sel: number, t: number, show: number, flash: boolean): void {
  if (show <= 0) return;
  const top = 160 - (opts.length - 1) * 6;
  dither(40, top - 5, 112, opts.length * 12 + 8, INK, 0.5 * show);
  opts.forEach((o, n) => {
    const y = top + n * 12, on = n === sel;
    if (on && flash && Math.floor(t / 3) % 2) return;
    const w = textWidth(o);
    if (show < 0.4 + n * 0.3) return;
    textCenter(o, 96, y, on ? SEL : mix(PAPER, '#6a6490', 0.35), INK);
    if (on) {
      const bob = Math.floor(t / 20) % 2;
      cursorShell(96 - w / 2 - 11 - bob, y + 1, t, false);
      cursorShell(96 + w / 2 + 6 + bob, y + 1, t, true);
      rect(96 - w / 2, y + 10, w, 1, '#6a5020');
    }
  });
  if (show >= 1) text('Z picks. Arrows move.', 96 - textWidth('Z picks. Arrows move.') / 2, 184, '#4a4660');
}
