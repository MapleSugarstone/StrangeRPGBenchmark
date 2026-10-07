// Map types and a small builder that paints layouts with rectangles and lines.
import type { Look } from '../engine/sprites';

export type Pal = [number, number, number];

import type { MoverDef } from './movers';

export interface Region {
  name: string;
  dark: number;
  ambient: number;
  floor: Pal;
  wall: Pal;
  accent: Pal;
  drone: number[];
  /** Color of the ambient light. Its strength is ambient. */
  amb?: number;
  /** Color of lit windows. */
  windowLight?: number;
  /** Specks of ink rise, or fall when up has changed. */
  specks?: 'up' | 'down';
  /** Tile overrides for every map in the region, so each place builds its own way. */
  legend?: Record<string, string>;
}

/** What a spell did to the thing it was aimed at in the field. */
export interface FieldLog { verbs: Record<string, number>; seq: string[]; said: string[]; lines: number; written: string[] }

export interface Puzzle {
  /** The object's rote, shown when read. */
  rote: string;
  need: (log: FieldLog) => boolean;
  /** Flag set when solved. The object disappears unless it stays. */
  flag: string;
  stays?: boolean;
  scene?: string;
  /** Item, mark, or page given when solved. */
  give?: string;
  /** Sprite to show once solved, if it stays. */
  solvedSprite?: string;
  /** Tile to paint under the object once solved. */
  becomes?: string;
}

export interface ActorDef {
  id: string;
  x: number;
  y: number;
  sprite: string;
  kind: 'npc' | 'foe' | 'object' | 'lectern' | 'mark' | 'deco';
  name?: string;
  /** First matching [condition, scene] plays when talked to. */
  talk?: [string, string][];
  rote?: string;
  look?: Look;
  copied?: boolean;
  /** Pulses on the shared beat while the flag is set. */
  syncFlag?: string;
  enc?: string;
  respawn?: boolean;
  puzzle?: Puzzle;
  cond?: string;
  light?: number;
  tempo?: number;
  solid?: boolean;
  flip?: boolean;
  /** Only reachable by solving the room's mover puzzle. The tests solve the puzzle instead of walking to it. */
  behind?: boolean;
  /** A thing with a few lines of rote that runs on Wait's steps or answers verbs. */
  mover?: MoverDef;
  /** The Stet opponent this person plays as, when they are at the table this chapter. */
  stet?: string;
  /** A place to take a line into the ink: river, millrace, standing, twice, ears, or tether. */
  reel?: string;
    /** Sells Stet cards too. */
  stetShop?: boolean;
  /** For foes: how far they wander from home. */
  wander?: number;
}

export interface ExitDef { x: number; y: number; to: string; tx: number; ty: number; cond?: string; block?: string }
export interface TriggerDef { x: number; y: number; w?: number; h?: number; scene: string; cond?: string; once: string }

export interface MapDef {
  id: string;
  name: string;
  region: string;
  rows: string[];
  actors: ActorDef[];
  exits: ExitDef[];
  triggers: TriggerDef[];
  /** Scenes to play on entering, first match, each played once. */
  enter?: [string, string][];
  legend?: Record<string, string>;
  /** Mover puzzles: when every mover in the group stands on a plate, the flag is set and the tiles change. */
  groups?: { group: string; flag: string; scene?: string; opens?: [number, number, string][] }[];
  /** Uses another region while the condition holds. */
  altRegion?: [string, string];
  /** More alternate regions, checked first, in order. */
  altRegions?: [string, string][];
}

export const LEGEND: Record<string, string> = {
  ' ': 'void', '=': 'wallTop', '#': 'wall', '.': 'floor', ',': 'ground', ':': 'glyph', '*': 'spot', '~': 'water',
  b: 'bridge', f: 'fence', T: 'stalk', t: 'stalk2', o: 'well', W: 'window', H: 'tower', R: 'roof', '%': 'hush',
  g: 'gap', s: 'stairs', V: 'vat', p: 'pipe', S: 'stall', D: 'dishTile', m: 'moss', r: 'ring', x: 'grid', L: 'rail',
  '|': 'cable', '^': 'stars', P: 'pagewall', c: 'cot',
  C: 'chimney', A: 'awning', k: 'post', F: 'fountain', h: 'hut', e: 'reed', v: 'drop', I: 'inkwell', M: 'mobile',
  _: 'plate', O: 'socket', w: 'road', y: 'struck', q: 'scrivfloor',
};

export class Grid {
  cells: string[][];
  constructor(public w: number, public h: number, fill: string) {
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }
  set(x: number, y: number, ch: string) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = ch; return this; }
  fill(x: number, y: number, w: number, h: number, ch: string) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch);
    return this;
  }
  box(x: number, y: number, w: number, h: number, ch: string) {
    for (let xx = x; xx < x + w; xx++) { this.set(xx, y, ch); this.set(xx, y + h - 1, ch); }
    for (let yy = y; yy < y + h; yy++) { this.set(x, yy, ch); this.set(x + w - 1, yy, ch); }
    return this;
  }
  h_(x: number, y: number, len: number, ch: string) { return this.fill(x, y, len, 1, ch); }
  v_(x: number, y: number, len: number, ch: string) { return this.fill(x, y, 1, len, ch); }
  str(x: number, y: number, s: string) { for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i]); return this; }
  /** A building: a roof row, then walls, with optional windows and a door on the bottom row. */
  house(x: number, y: number, w: number, h: number, windows: number[] = [], door?: number) {
    this.h_(x, y, w, 'R');
    this.fill(x, y + 1, w, h - 1, 'H');
    for (const wx of windows) this.set(x + wx, y + 1, 'W');
    if (door !== undefined) this.set(x + door, y + h - 1, 'g');
    return this;
  }
  rows(): string[] { return this.cells.map((r) => r.join('')); }
}

/**
 * Evaluates a condition: comma-separated flags, each optionally negated with !, or c>=N, c<N, c=N for the chapter.
 * Alternatives separated by | pass when any of them does.
 */
export function check(cond: string | undefined, flag: (f: string) => boolean, chapter: number): boolean {
  if (!cond || cond === '*') return true;
  if (cond.includes('|')) return cond.split('|').some((c) => check(c, flag, chapter));
  return cond.split(',').every((part) => {
    const p = part.trim();
    const m = p.match(/^c(>=|<=|<|>|=)(\d+)$/);
    if (m) {
      const n = +m[2];
      switch (m[1]) {
        case '>=': return chapter >= n;
        case '<=': return chapter <= n;
        case '<': return chapter < n;
        case '>': return chapter > n;
        default: return chapter === n;
      }
    }
    if (p.startsWith('!')) return !flag(p.slice(1));
    return flag(p);
  });
}

/** A post with a line already tied on, at the edge of the ink. */
export const linePost = (id: string, x: number, y: number, where: string): ActorDef => ({
  id, x, y, sprite: 'linepost', kind: 'object', name: 'a line post', reel: where,
  rote: '# a post. someone left a line on it.\n# the line goes down into the ink.\nwait',
});

/** Carry and the cart. Carry is always one place ahead of Wait. */
export const carry = (id: string, x: number, y: number, cond?: string): ActorDef => ({
  id, x, y, sprite: 'carry', kind: 'npc', tempo: 30, cond, name: 'Carry',
  rote: '# the cart goes where you go.\n# it gets there first.\nwait',
  talk: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reverse().map((n): [string, string] => [`c=${n}`, `npc_carry_${n}`]),
});
