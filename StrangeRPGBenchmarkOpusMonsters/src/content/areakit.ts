// Helpers for the optional areas: padded map rows, lore spots, hidden finds, and links into existing maps.
import { sfx } from '../engine/audio';
import { SPECIES } from '../data/species';
import { NOTIONS } from '../battle/registry';
import { giveNotion, givePegs, narr, notice } from '../game/api';
import { G, HORN_NAME, flag, save, setFlag } from '../game/state';
import { MAPS, type MapDef, type Warp } from '../game/world';
import { giveItem, ITEMS } from '../game/items';

/** Rows that came out wider than their map said. The validator reports them. */
export const ROW_WARNINGS: string[] = [];

/** Pads every row to width w with wall characters. A longer row is cut to w and reported, so the game still loads. */
export function rows(w: number, fill: string, list: string[]): string[] {
  return list.map((r, i) => {
    if (r.length > w) { ROW_WARNINGS.push(`row ${i} is ${r.length} wide, more than ${w}: ${r}`); return r.slice(0, w); }
    return r + fill.repeat(w - r.length);
  });
}

/** Paints a map from shapes, so widths always match. */
export class Canvas {
  g: string[][];
  constructor(public w: number, public h: number, fill: string) { this.g = Array.from({ length: h }, () => Array(w).fill(fill)); }
  put(x: number, y: number, ch: string): this { if (y >= 0 && y < this.h && x >= 0 && x < this.w) this.g[y][x] = ch; return this; }
  /** Writes a string starting at x, y. Spaces leave the tile alone. */
  text(x: number, y: number, s: string): this { [...s].forEach((c, i) => { if (c !== ' ') this.put(x + i, y, c); }); return this; }
  rect(x: number, y: number, w: number, h: number, ch: string): this { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, ch); return this; }
  frame(x: number, y: number, w: number, h: number, ch: string): this {
    for (let i = 0; i < w; i++) { this.put(x + i, y, ch); this.put(x + i, y + h - 1, ch); }
    for (let j = 0; j < h; j++) { this.put(x, y + j, ch); this.put(x + w - 1, y + j, ch); }
    return this;
  }
  border(ch: string): this { return this.frame(0, 0, this.w, this.h, ch); }
  /** Copies a block of rows in at x, y. Spaces leave the tile alone. */
  block(x: number, y: number, list: string[]): this { list.forEach((r, j) => this.text(x, y + j, r)); return this; }
  at(x: number, y: number): string { return this.g[y]?.[x] ?? ''; }
  rows(): string[] { return this.g.map(r => r.join('')); }
}

/** A thing to look at. Each press reads the next line, then starts again. */
export function look(x: number, y: number, ...lines: string[]): NonNullable<MapDef['spots']>[number] {
  return { x, y, script: async () => { for (const l of lines) await narr(l); } };
}

export type Reward = { pegs?: [Parameters<typeof givePegs>[0], number]; notion?: string; notions?: [string, number][]; items?: [string, number][]; rind?: number; tan?: number };

/** Gives a reward and says what it was. */
export async function reward(r: Reward): Promise<void> {
  sfx('level');
  if (r.pegs) { givePegs(r.pegs[0], r.pegs[1]); await notice(`${r.pegs[1]} ${HORN_NAME[r.pegs[0]]}${r.pegs[1] > 1 ? 's' : ''}.`); }
  if (r.notion) { giveNotion(r.notion); await notice(`A notion: ${NOTIONS[r.notion]?.name || r.notion}.`); }
  for (const [id, n] of r.notions || []) { giveNotion(id, n); await notice(`${n > 1 ? n + ' x ' : 'A notion: '}${NOTIONS[id]?.name || id}.`); }
  for (const [id, n] of r.items || []) { giveItem(id, n); await notice(`${n > 1 ? n + ' x ' : ''}${ITEMS[id]?.name || id}.`); }
  if (r.rind) { G.rind += r.rind; await notice(`${r.rind} cowries.`); }
  if (r.tan) { G.tan += r.tan; await notice(`${r.tan} nacre. Any grotto will layer it on.`); }
  save();
}

/** Something hidden. It can be found once, and the spot goes quiet afterwards. */
export function stash(key: string, x: number, y: number, line: string, r: Reward): NonNullable<MapDef['spots']>[number] {
  return {
    x, y, when: () => !flag('found_' + key),
    script: async () => { setFlag('found_' + key); await narr(line); await reward(r); },
  };
}

/** Opens a way from an existing map into a new one: changes the tile and adds the warp. */
export function link(mapId: string, x: number, y: number, ch: string, warp: Omit<Warp, 'x' | 'y'>, when?: () => boolean): void {
  const m = MAPS[mapId];
  if (!m) throw new Error(`no map ${mapId} to link from`);
  (m.mods ||= []).push({ x, y, ch, when: when || (() => true) });
  m.warps.push({ x, y, ...warp, when });
}

/** Adds wild kinds to an existing map's zone. Kinds not defined yet are skipped. */
export function addKinds(mapId: string, kinds: [string, number][]): void {
  const z = MAPS[mapId]?.zone;
  if (!z) throw new Error(`map ${mapId} has no zone`);
  for (const [k, w] of kinds) {
    if (!SPECIES[k]) continue;
    const have = z.kinds.find(e => e[0] === k);
    if (have) have[1] = Math.max(have[1], w);
    else z.kinds.push([k, w]);
  }
}

/** Zone kinds filtered to those that exist. */
export function kinds(list: [string, number][]): [string, number][] {
  return list.filter(([k]) => !!SPECIES[k]);
}

// ---------------------------------------------------------------- the tide (Act 2)

type Mod = NonNullable<MapDef['mods']>[number];

export const highTide = (): boolean => !!flag('tide');

/**
 * Tide tiles from a layout: 'A' cells are water at high tide and dry at low, 'B' cells are water at low tide and dry at high.
 * Other characters are ignored, so the layout can be the map's own rows.
 */
export function tideMods(layout: string[], x0: number, y0: number): Mod[] {
  const mods: Mod[] = [];
  layout.forEach((r, j) => [...r].forEach((c, i) => {
    if (c === 'A') mods.push({ x: x0 + i, y: y0 + j, ch: '~', when: highTide });
    if (c === 'B') mods.push({ x: x0 + i, y: y0 + j, ch: '~', when: () => !highTide() });
  }));
  return mods;
}
