import type { Pal3 } from '../core/palette';
import type { SpriteSpec } from '../core/sprites';
import { LEGEND, TileDef } from '../maps/tiles';
import type { GameState, Dir } from './state';
import type { Script } from './script';

export interface EntDef {
  id: string;
  at: string;
  kind: 'npc' | 'chest' | 'sign' | 'lamp' | 'warp' | 'trigger' | 'prop';
  spr?: SpriteSpec;
  name?: string;
  talk?: Script;
  step?: Script;
  to?: [string, string, Dir?];
  item?: string;
  n?: number;
  gold?: number;
  text?: string;
  when?: (st: GameState) => boolean;
  solid?: boolean;
  wander?: boolean;
  under?: string;
}

export interface MapDef {
  id: string;
  name: string;
  music: string;
  theme?: Record<string, Pal3>;
  rows: string[];
  past?: string[];
  legend?: Record<string, TileDef>;
  dark?: number;
  enc?: { rate: number; groups: [string, number][] };
  ents: EntDef[];
  enter?: Script;
  under?: string;
  grey?: boolean;
  outside?: string;
  /** Tile kind drawn behind enemies in battle. */
  bg?: string;
}

export interface Ent {
  def: EntDef;
  x: number;
  y: number;
  hx: number;
  hy: number;
  hidden: boolean;
  spr?: SpriteSpec;
  ox: number;
  oy: number;
  dir: Dir;
  wanderT: number;
}

export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function isMarker(c: string): boolean {
  return /[a-z0-9]/.test(c);
}

export class World {
  w: number;
  h: number;
  markers = new Map<string, [number, number]>();
  ents: Ent[] = [];

  constructor(public def: MapDef, st: GameState) {
    this.h = def.rows.length;
    this.w = Math.max(...def.rows.map(r => r.length));
    def.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (isMarker(row[x])) this.markers.set(row[x], [x, y]);
    });
    for (const e of def.ents) {
      const m = this.markers.get(e.at);
      if (!m) throw new Error(`Map ${def.id}: marker '${e.at}' for ${e.id} not found`);
      this.ents.push({ def: e, x: m[0], y: m[1], hx: m[0], hy: m[1], hidden: false, spr: e.spr, ox: 0, oy: 0, dir: 'down', wanderT: 60 + ((m[0] * 7 + m[1] * 13) % 120) });
    }
    this.refresh(st);
  }

  refresh(st: GameState) {
    for (const e of this.ents) {
      const f = st.flags[`hide:${this.def.id}:${e.def.id}`];
      e.hidden = f === true || (e.def.when ? !e.def.when(st) : false);
      if (f === 'show') e.hidden = false;
    }
  }

  marker(c: string): [number, number] {
    const m = this.markers.get(c);
    if (!m) throw new Error(`Map ${this.def.id}: no marker '${c}'`);
    return m;
  }

  char(x: number, y: number, st: GameState): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this.def.outside ?? ' ';
    const rows = st.past && this.def.past ? this.def.past : this.def.rows;
    const c = rows[y]?.[x] ?? ' ';
    if (isMarker(c)) {
      const e = this.ents.find(en => en.hx === x && en.hy === y);
      return e?.def.under ?? this.def.under ?? '.';
    }
    return c;
  }

  tile(x: number, y: number, st: GameState): TileDef {
    const c = this.char(x, y, st);
    return this.def.legend?.[c] ?? LEGEND[c] ?? { kind: 'void', solid: true };
  }

  entAt(x: number, y: number, solidOnly = false): Ent | undefined {
    return this.ents.find(e => !e.hidden && e.x === x && e.y === y && (!solidOnly || this.entSolid(e)));
  }

  entSolid(e: Ent): boolean {
    if (e.def.solid !== undefined) return e.def.solid;
    return e.def.kind !== 'warp' && e.def.kind !== 'trigger';
  }

  passable(x: number, y: number, st: GameState): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const t = this.tile(x, y, st);
    if (t.gate) return st.tint === t.gate;
    if (t.sea) return !!st.flags.skiff;
    if (t.solid) return false;
    return !this.entAt(x, y, true);
  }

  ent(id: string): Ent | undefined {
    return this.ents.find(e => e.def.id === id);
  }
}
