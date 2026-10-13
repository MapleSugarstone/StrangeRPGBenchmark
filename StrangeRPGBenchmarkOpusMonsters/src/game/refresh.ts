// Brings a loaded save's whorls up to date with the current art, so a sprite redrawn in an update shows on old saves too.
import type { Mon, SpriteData } from '../battle/model';
import { SPECIES, spriteOf } from '../data/species';
import { starbornSprite } from '../data/starborn';
import { castOfOuro, PEOPLE } from '../engine/sprites';
import { paletteOf, parentKindsOf, shapeOf } from './fitting';
import { FIRST_SET_NACRE } from './setting/puzzles';
import type { Save } from './state';

const PALETTES = 12;
const copy = (s: SpriteData): SpriteData => ({ px: s.px.slice(), c: s.c.slice() as SpriteData['c'] });

/**
 * The look an old fit was most likely made with, for a fit saved before looks were kept: the shape whose outline matches its
 * saved sprite best, then the palette nearest its saved colors. Both are read against its parents' current art.
 */
function guessLook(saved: SpriteData, a: SpriteData, b: SpriteData): { shape: number; palette: number } {
  const agree = (px: string[]) => px.reduce((n, row, y) => n + [...row].filter((c, x) => (c === '.') === (saved.px[y]?.[x] === '.')).length, 0);
  const shape = agree(shapeOf(a, b, 1)) > agree(shapeOf(a, b, 0)) ? 1 : 0;
  const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const gap = (p: string, q: string) => { const [x, y] = [rgb(p), rgb(q)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  let palette = 0, best = Infinity;
  for (let p = 0; p < PALETTES; p++) {
    const c = paletteOf(a, b, p), d = c.reduce((s, col, i) => s + gap(col, saved.c[i] || saved.c[1] || col), 0);
    if (d < best) { best = d; palette = p; }
  }
  return { shape, palette };
}

/** Redraws one whorl from the current art: its kind's sprite, a person's sprite, or a fit's parents in its own look. */
export function refreshMon(m: Mon): void {
  let base: SpriteData | null = null;
  if (m.art && PEOPLE[m.art]) base = copy(PEOPLE[m.art]);
  else if (m.fitted) {
    const kinds = parentKindsOf(m);
    if (!kinds) return;
    m.parentKinds = kinds;
    const a = spriteOf(SPECIES[kinds[0]]), b = spriteOf(SPECIES[kinds[1]]);
    m.fitLook = m.fitLook ?? guessLook(m.sprite, a, b);
    base = { px: shapeOf(a, b, m.fitLook.shape), c: paletteOf(a, b, m.fitLook.palette) };
  } else if (m.kind === 'vellumslip') base = castOfOuro();
  else if (m.person && PEOPLE[m.kind]) base = copy(PEOPLE[m.kind]);
  else if (SPECIES[m.kind]) base = spriteOf(SPECIES[m.kind]);
  if (base) m.sprite = m.starborn && !m.person ? starbornSprite(base) : base;
}

/** Redraws every whorl a save holds (the team, the Midden, and the shells) and pays nacre for sketches set before sketches paid it. */
export function refreshSave(s: Save): void {
  for (const m of [...(s.party || []), ...(s.rack || []), ...Object.values(s.shellMons || {})]) if (m) refreshMon(m);
  if (!s.flags.setNacre) {
    s.flags.setNacre = 1;
    s.tan += (s.gem?.solved || []).reduce((n, id) => n + (FIRST_SET_NACRE[id] || 0), 0);
  }
}
