// Builds images from the art data on first use, with plain stand-ins for anything not drawn yet.
import { img, recolor, type Img } from '../engine/gfx';
import { C } from '../engine/palette';
import { CHARS } from '../content/art/chars';
import { MONS } from '../content/art/mons';
import { TILES } from '../content/art/tiles';
import { PROPS } from '../content/art/props';
import { ICONS } from '../content/art/icons';
import type { Dir } from './state';

export interface CharImgs { down: [Img, Img]; up: [Img, Img]; side: [Img, Img] }

const PERSON = {
  down: [['....1...', '...121..', '..12221.', '..13331.', '..31313.', '..13331.', '.1222221', '..1...1.'], ['....1...', '...121..', '..12221.', '..13331.', '..31313.', '..13331.', '.1222221', '...1.1..']],
  up: [['....1...', '...121..', '..12221.', '..12221.', '..12221.', '..11211.', '.1222221', '..1...1.'], ['....1...', '...121..', '..12221.', '..12221.', '..12221.', '..11211.', '.1222221', '...1.1..']],
  side: [['....1...', '...121..', '..12221.', '..13331.', '..13313.', '..13331.', '..122221', '...1.1..'], ['....1...', '...121..', '..12221.', '..13331.', '..13313.', '..13331.', '..122221', '..1..1..']],
};

const charCache = new Map<string, CharImgs>();
export function charImgs(id: string, pal?: readonly number[]): CharImgs {
  const key = pal ? `${id}:${pal.join(',')}` : id;
  const hit = charCache.get(key);
  if (hit) return hit;
  const a = CHARS[id];
  const usePal = pal ?? a?.pal ?? [C.black, C.slate, C.pale];
  const src = a ?? PERSON;
  const mk = (rows: readonly string[]) => img([...rows], usePal);
  const out: CharImgs = {
    down: [mk(src.down[0]), mk(src.down[1])],
    up: [mk(src.up[0]), mk(src.up[1])],
    side: [mk(src.side[0]), mk(src.side[1])],
  };
  charCache.set(key, out);
  return out;
}

export function hasChar(id: string): boolean { return !!CHARS[id]; }

/** The frame for a facing and a walk phase, and whether to mirror it. */
export function charFrame(c: CharImgs, dir: Dir, step: number): { im: Img; flip: boolean } {
  const f = step & 1;
  if (dir === 'down') return { im: c.down[f], flip: false };
  if (dir === 'up') return { im: c.up[f], flip: false };
  return { im: c.side[f], flip: dir === 'left' };
}

const BLOB = [['..1111..', '.122221.', '12233221', '12222221', '12222221', '.122221.', '.1.11.1.', '........'], ['........', '..1111..', '.122221.', '12233221', '12222221', '12222221', '.111111.', '........']];

const monCache = new Map<string, Img[]>();
export function monImgs(id: string): Img[] {
  const hit = monCache.get(id);
  if (hit) return hit;
  const a = MONS[id];
  let out: Img[];
  if (a) out = [...a.idle, ...(a.act ? [a.act] : [])].map((r) => img([...r], a.pal));
  else if (CHARS[id] || id.startsWith('t_')) { const c = charImgs(id); out = [c.down[0], c.down[1]]; }
  else out = BLOB.map((r) => img(r, [C.black, C.rust1, C.rust3]));
  monCache.set(id, out);
  return out;
}
export function monIdleCount(id: string): number { return MONS[id]?.idle.length ?? 2; }

function fallbackTileColor(id: string): [number, number] {
  if (/water|canal/.test(id)) return [C.teal1, C.teal2];
  if (/grass|hedge|field|orchard/.test(id)) return [C.green1, C.green2];
  if (/roof/.test(id)) return [C.rust1, C.rust2];
  if (/wall|cliff|rock/.test(id)) return [C.slate, C.gray];
  if (/sand|heat|crack/.test(id)) return [C.gold2, C.gold3];
  if (/glass/.test(id)) return [C.teal2, C.teal3];
  if (/dark|burrow|root/.test(id)) return [C.blue0, C.blue1];
  if (/pale|festival/.test(id)) return [C.pink1, C.pink2];
  if (/floor|wood|rug|desk|table|counter|bed|shelf/.test(id)) return [C.umber1, C.umber2];
  if (/void/.test(id)) return [C.black, C.black];
  return [C.umber1, C.umber2];
}

const tileCache = new Map<string, Img[]>();
export function tileImgs(id: string): Img[] {
  const hit = tileCache.get(id);
  if (hit) return hit;
  const a = TILES[id];
  let out: Img[];
  if (a) out = a.frames.map((r) => img([...r], a.pal));
  else {
    const [c1, c2] = fallbackTileColor(id);
    out = [img(['22222222', '22222222', '22232222', '22222222', '22222222', '22222232', '22222222', '22222222'], [C.black, c1, c2])];
  }
  tileCache.set(id, out);
  return out;
}

const propCache = new Map<string, Img[]>();
export function propImgs(id: string): Img[] {
  const hit = propCache.get(id);
  if (hit) return hit;
  const a = PROPS[id];
  let out: Img[];
  if (a) out = (a.frames ?? [a.rows]).map((r) => img([...r], a.pal));
  else out = [img(['..1111..', '.122221.', '.123321.', '.122221.', '.122221.', '.122221.', '.111111.', '........'], [C.black, C.umber1, C.umber2])];
  propCache.set(id, out);
  return out;
}
export function propTall(id: string): boolean { return !!PROPS[id]?.tall; }

const iconCache = new Map<string, Img>();
export function icon(id: string): Img {
  const hit = iconCache.get(id);
  if (hit) return hit;
  const a = ICONS[id];
  const out = a ? img([...a.rows], a.pal) : img(['.111.', '12221', '12321', '12221', '.111.'], [C.black, C.slate, C.pale]);
  iconCache.set(id, out);
  return out;
}

export function recolorChar(c: CharImgs, pal: readonly number[]): CharImgs {
  return { down: [recolor(c.down[0], pal), recolor(c.down[1], pal)], up: [recolor(c.up[0], pal), recolor(c.up[1], pal)], side: [recolor(c.side[0], pal), recolor(c.side[1], pal)] };
}
