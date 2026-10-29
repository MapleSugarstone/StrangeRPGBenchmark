// Map definitions and their runtime form: tiles from text rows, a legend, markers, people, exits, and triggers.
import type { Dir } from './state';

export interface TileSpec {
  /** Art id in TILES. */
  t: string;
  solid?: boolean;
  /** Height in pixels of a wall or roof. Walls cast leads in the sun. */
  wall?: number;
  water?: boolean;
  heat?: boolean;
  pit?: boolean;
  /** Footstep material. */
  step?: string;
  /** Drawn over the tile below it (for example a fence on grass). Uses the base tile from `under`. */
  under?: string;
}

export interface NpcDef {
  id: string;
  /** Character art id, or a template id with a palette. */
  art: string;
  pal?: [number, number, number];
  x: number;
  y: number;
  dir?: Dir;
  talk?: string;
  /** Shown only while this flag expression holds: "flag", "!flag", or "a&!b". */
  cond?: string;
  wander?: number;
  /** Drawn and talked to, but never blocks movement. */
  ghost?: boolean;
}

export interface PropDef { art: string; x: number; y: number; solid?: boolean; talk?: string; cond?: string; lead?: boolean }

export interface ExitDef { x: number; y: number; w?: number; h?: number; to: string; at: string; cond?: string; blocked?: string }

export interface TriggerDef { x: number; y: number; w?: number; h?: number; scene: string; cond?: string }

export interface TalkDef { x: number; y: number; scene: string; cond?: string }

export interface EncounterDef { id: string; group: string; art: string; x: number; y: number; wander?: number; cond?: string }

export interface LightDef { x: number; y: number; r: number; i: number; color: number; cond?: string }

export interface PlateDef { id: string; x: number; y: number; flag: string }

export interface MapDef {
  id: string;
  name: string;
  region: string;
  music: string;
  rows: string[];
  legend: Record<string, TileSpec>;
  markers?: Record<string, [number, number]>;
  npcs?: NpcDef[];
  props?: PropDef[];
  exits?: ExitDef[];
  triggers?: TriggerDef[];
  talks?: TalkDef[];
  encounters?: EncounterDef[];
  lights?: LightDef[];
  plates?: PlateDef[];
  /** Sun through windows for interiors: window rects in tiles. */
  shafts?: { x: number; y: number; w: number; h: number }[];
  /** Tiles that block until a flag is set, then draw as `open`. */
  gates?: { x: number; y: number; flag: string; open: string }[];
  /** Painted leads: hard-edged shade that ignores every light. */
  painted?: { x: number; y: number; w: number; h: number; cond?: string }[];
  /** Tiles that look like floor but are pits. A thrown pebble shows them. */
  hiddenPits?: [number, number][];
  /** Battle light for maps whose region has no sun. */
  battleLight?: { dir8: [number, number]; lowness: number };
  /** The big lead lies across this map: its base tile and its length in tiles. */
  bigLead?: { x: number; y: number; len: number };
  enterScene?: string;
}

export interface MapRT {
  def: MapDef;
  w: number;
  h: number;
  tiles: TileSpec[];
  solid: Uint8Array;
  markers: Map<string, [number, number]>;
}

export const MAPS = new Map<string, MapDef>();
export function defineMaps(defs: MapDef[]) { for (const d of defs) MAPS.set(d.id, d); }

export function buildMap(def: MapDef): MapRT {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const tiles: TileSpec[] = [];
  const solid = new Uint8Array(w * h);
  const fallback = def.legend['.'] ?? { t: 'void' };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = def.rows[y][x] ?? ' ';
      const spec = def.legend[ch] ?? (ch === ' ' ? { t: 'void', solid: true } : fallback);
      tiles.push(spec);
      if (spec.solid || spec.water || spec.pit) solid[y * w + x] = 1;
    }
  }
  const markers = new Map<string, [number, number]>(Object.entries(def.markers ?? {}));
  return { def, w, h, tiles, solid, markers };
}

/** Evaluates a condition like "a", "!a", or "a&!b|c" against a flag lookup. */
export function condOk(cond: string | undefined, has: (f: string) => boolean): boolean {
  if (!cond) return true;
  return cond.split('|').some((alt) => alt.split('&').every((term) => {
    const t = term.trim();
    return t.startsWith('!') ? !has(t.slice(1)) : has(t);
  }));
}
