// Starborn whorls: a rare night-sky palette with starlight accents, and a faint glow and glitter in battle.
import type { Mon, SpriteData } from '../battle/model';
import { SPECIES, spriteOf } from './species';

export const STARBORN_ODDS = 400;
export const STARLIGHT = '#fff2c4';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/** The starborn look: hues pulled most of the way toward indigo, the body darkened, the second color pale, and the third color starlight. The shape stays as drawn. */
export function starbornSprite(s: SpriteData): SpriteData {
  const [c0, c1] = [toHsl(s.c[0]), toHsl(s.c[1])];
  const sky = (h: number) => h + ((((250 - h) % 360) + 540) % 360 - 180) * 0.6;
  return { px: s.px.slice(), c: [fromHsl(sky(c0[0]), Math.min(0.6, c0[1] * 0.8 + 0.2), c0[2] * 0.45 + 0.2), fromHsl(sky(c1[0]) + 20, 0.5, 0.8), STARLIGHT] };
}

/**
 * The glow and glitter round a starborn sprite drawn at (x, y). `under` draws the halo, to go before the sprite, and the twinkles
 * otherwise. `t` counts frames at 60 a second, and `seed` keeps two starborn whorls from twinkling in step.
 */
export function drawAura(g: CanvasRenderingContext2D, s: SpriteData, x: number, y: number, t: number, seed: number, under: boolean, flip = false, scale = 1): void {
  const body = (px: number, py: number) => px >= 0 && py >= 0 && px < 8 && py < 8 && (s.px[py] || '')[flip ? 7 - px : px] !== '.' && (s.px[py] || '')[flip ? 7 - px : px] !== undefined;
  const dot = (px: number, py: number, a: number) => { g.globalAlpha = a; g.fillRect(x + px * scale, y + py * scale, scale, scale); };
  g.save();
  g.fillStyle = STARLIGHT;
  if (under) {
    const a = 0.12 + 0.07 * Math.sin(t / 45 + seed);
    for (let py = -1; py <= 8; py++) for (let px = -1; px <= 8; px++) {
      if (body(px, py)) continue;
      if (N8.some(([dx, dy]) => body(px + dx, py + dy))) dot(px, py, a);
    }
  } else {
    const cells: [number, number][] = [];
    for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) if (body(px, py)) cells.push([px, py]);
    for (const [period, life, shift] of [[83, 40, 0], [127, 34, 61]]) {
      const tt = t + shift + seed * 13, slot = Math.floor(tt / period), age = tt % period;
      if (age >= life || !cells.length) continue;
      const r = seeded(`${seed}:${period}:${slot}`);
      const [bx, by] = cells[Math.floor(r() * cells.length)];
      const sx = bx + Math.round(r() * 2 - 1), sy = by + Math.round(r() * 2 - 1) - Math.floor(age / 14);
      if (age < 8) dot(sx, sy, age / 8);
      else if (age < 22) { dot(sx, sy, 1); for (const [dx, dy] of N4) dot(sx + dx, sy + dy, 0.55); }
      else dot(sx, sy, 1 - (age - 22) / (life - 22));
    }
  }
  g.restore();
}

/** Turns a freshly made whorl starborn. A fusion takes the starborn look over its own fused sprite. People never turn. */
export function makeStarborn(m: Mon): Mon {
  if (m.person) return m;
  m.starborn = true;
  m.sprite = starbornSprite(m.fitted ? m.sprite : spriteOf(SPECIES[m.kind]));
  return m;
}

/** A new wild whorl or a new fusion has a 1 in STARBORN_ODDS chance to be starborn, rolled on its own and never inherited. */
export function rollStarborn(m: Mon, rnd: () => number): Mon {
  return rnd() < 1 / STARBORN_ODDS ? makeStarborn(m) : m;
}

/** The kind's own sprite, for anything built from a whorl's body (fusions), so a starborn parent passes on nothing. */
export function baseSprite(m: Mon): SpriteData {
  return m.starborn && SPECIES[m.kind] ? spriteOf(SPECIES[m.kind]) : m.sprite;
}
