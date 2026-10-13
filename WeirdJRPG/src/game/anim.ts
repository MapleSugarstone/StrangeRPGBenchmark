// Extra animation frames made from a sprite's own rows, for idle and walk cycles in the field and in battle.
import type { Art } from '../engine/sprites';

const breatheCache = new Map<Art, Art>();
const swayCache = new Map<Art, Art | null>();
const strideCache = new Map<Art, Art | null>();

export function idHash(s: string): number { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

/** The body sinks one pixel onto its base row. */
export function breathe(art: Art): Art {
  const hit = breatheCache.get(art);
  if (hit) return hit;
  const h = art.length, w = art[0].length;
  const base = [...art[h - 1]].map((c, x) => (art[h - 2][x] !== '.' ? art[h - 2][x] : c)).join('');
  const out = ['.'.repeat(w), ...art.slice(0, h - 2), base];
  breatheCache.set(art, out);
  return out;
}

/** The top half leans one pixel toward a free edge, or null when both edges are taken. */
export function sway(art: Art): Art | null {
  if (swayCache.has(art)) return swayCache.get(art)!;
  const h = art.length, w = art[0].length;
  const top = art.slice(0, Math.ceil(h / 2));
  const rightFree = top.every(r => r[w - 1] === '.'), leftFree = top.every(r => r[0] === '.');
  const out = rightFree || leftFree ? art.map((r, y) => (y >= top.length ? r : rightFree ? '.' + r.slice(0, w - 1) : r.slice(1) + '.')) : null;
  swayCache.set(art, out);
  return out;
}

/** Feet apart: each foot on the bottom row steps one pixel outward. Null when the bottom row is one solid base with no feet. */
export function stride(art: Art): Art | null {
  if (strideCache.has(art)) return strideCache.get(art)!;
  const h = art.length, w = art[0].length;
  const row = art[h - 1];
  const runs = row.split(/\.+/).filter(Boolean).length;
  let out: Art | null = null;
  if (runs >= 2) {
    const next = Array<string>(w).fill('.');
    for (let x = 0; x < w; x++) {
      if (row[x] === '.') continue;
      const nx = x < w / 2 ? x - 1 : x + 1;
      if (nx >= 0 && nx < w && next[nx] === '.') next[nx] = row[x];
      else next[x] = row[x];
    }
    out = [...art.slice(0, h - 1), next.join('')];
  }
  strideCache.set(art, out);
  return out;
}
