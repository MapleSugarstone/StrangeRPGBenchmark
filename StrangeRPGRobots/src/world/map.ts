// Map definitions and the parsed form the game uses. A map is a grid of tile characters with prop characters
// mixed in. A prop character stands on whichever walkable tile surrounds it most.
import { TILE_BY_CH, VOID, type TileDef } from './tiles';
import { PROP_BY_CH } from './props';

export type District = 'deeps' | 'stair' | 'brim' | 'inside' | 'flats';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface PropPlace { kind: string; x: number; y: number; id?: string; woken?: boolean; hushed?: boolean; tapeIf?: string; dir?: Dir; text?: string; color?: number; light?: number; scene?: string; loot?: string; lock?: number; hidden?: string; showIf?: string; hideIf?: string }
export interface SignPlace { x: number; y: number; text?: string; icon?: string; color: number; light?: number; r?: number; id?: string; vertical?: boolean; holo?: boolean; showIf?: string; hideIf?: string }
export interface LightPlace { x: number; y: number; r: number; i: number; color: number; z?: number; dir?: number; spread?: number; showIf?: string; hideIf?: string }
export interface NpcPlace {
  id: string;
  at: [number, number] | string;
  look: string;
  dir?: Dir;
  talk?: string;
  wander?: number;
  path?: [number, number][];
  showIf?: string;
  hideIf?: string;
  name?: string;
  crowd?: boolean;
  bark?: string[];
  /** An item that can be pickpocketed while sneaking. */
  pocket?: string;
  /** Lies on the ground (knocked out or dead) from load. */
  down?: boolean;
}
export interface ExitPlace { x: number; y: number; w?: number; h?: number; to: string; at: string; dir?: Dir; showIf?: string; hideIf?: string; scene?: string }
export interface TriggerPlace { x: number; y: number; w?: number; h?: number; scene: string; once?: boolean; showIf?: string; hideIf?: string }
export interface UnitPlace { kind: string; at: [number, number]; dir?: Dir; id?: string; level?: number; look?: string; name?: string }
export interface EncounterDef {
  id: string;
  units: UnitPlace[];
  /** 'sight': starts when a member sees the party. 'script': only from a scene. */
  start?: 'sight' | 'script';
  showIf?: string;
  hideIf?: string;
  /** Scene to run after the fight is won. */
  win?: string;
  /** Scene to run when the group first notices the party, before the fight. */
  alert?: string;
  /** Radius around the group within which bystanders and other groups join. */
  radius?: number;
  sightRange?: number;
  /** Water rises during the fight: each round the next row up from the bottom row floods. */
  tide?: { top: number; bottom: number; perRound?: number };
  /** Units that fight on the party's side, controlled by the game (enemy kinds, with an optional look). */
  allies?: UnitPlace[];
  /** Who the party is when this fight happens in the story, for the balance simulator (hero is implied). */
  simParty?: string[];
  /** The hero's level when this fight happens in the story, for the balance simulator. */
  simLevel?: number;
  /** Wind that may push unbraced units one tile each round. */
  wind?: { dx: number; dy: number; chance?: number };
  /** Music for this fight instead of the usual combat track. */
  music?: string;
}
export interface BailerPath { name: string; path: [number, number][]; speed?: number; showIf?: string; hideIf?: string }

export interface MapDef {
  id: string;
  name: string;
  district: District;
  rows: string[];
  /** Optional elevation digits 0 to 3, one per tile. */
  elev?: string[];
  ambient: number;
  ambientLevel: number;
  /** Night color that unlit floor dithers through, a palette index. */
  shade?: number;
  rain?: number;
  music?: string;
  props?: PropPlace[];
  signs?: SignPlace[];
  lights?: LightPlace[];
  npcs?: NpcPlace[];
  markers?: Record<string, [number, number]>;
  exits?: ExitPlace[];
  triggers?: TriggerPlace[];
  encounters?: EncounterDef[];
  bailers?: BailerPath[];
  /** Scene run every time the party enters. */
  enter?: string;
  /** True for indoor maps: no rain, no sky, camp not allowed. */
  inside?: boolean;
  /** Extra prop characters for this map: char to prop kind. */
  key?: Record<string, string>;
  /** Water drifts this many pixels per second, for maps on moving boats. */
  flow?: [number, number];
  /** Turns off the automatic dim fill light in unlit stretches. */
  noFill?: boolean;
  /** Fog color for void tiles at the map edge (city far below). */
  below?: boolean;
}

export interface Cell { tile: TileDef; elev: number }

export interface GameMap {
  def: MapDef;
  w: number;
  h: number;
  cells: Cell[];
  props: PropPlace[];
}

export function parseMap(def: MapDef): GameMap {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const cells: Cell[] = new Array(w * h);
  const props: PropPlace[] = [...(def.props ?? [])];
  const raw = (x: number, y: number) => def.rows[y]?.[x] ?? ' ';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = raw(x, y);
      let tile = TILE_BY_CH.get(ch);
      const elev = Number(def.elev?.[y]?.[x] ?? '0') || 0;
      if (!tile) {
        const kind = def.key?.[ch] ?? PROP_BY_CH.get(ch);
        if (kind) props.push({ kind, x, y });
        tile = TILE_BY_CH.get(under(def, x, y)) ?? TILE_BY_CH.get('.')!;
      }
      cells[y * w + x] = { tile, elev };
    }
  }
  return { def, w, h, cells, props };
}

/** The walkable tile that surrounds a prop character most. */
function under(def: MapDef, x: number, y: number): string {
  const counts = new Map<string, number>();
  for (let r = 1; r <= 2; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const ch = def.rows[y + dy]?.[x + dx];
      if (!ch) continue;
      const t = TILE_BY_CH.get(ch);
      if (!t || !t.walk) continue;
      counts.set(ch, (counts.get(ch) ?? 0) + (r === 1 ? 2 : 1));
    }
    if (counts.size) break;
  }
  let best = '.', n = 0;
  for (const [ch, c] of counts) if (c > n) { n = c; best = ch; }
  return best;
}

export function cellAt(m: GameMap, x: number, y: number): Cell {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return { tile: VOID, elev: 0 };
  return m.cells[y * m.w + x];
}

export const MAPS = new Map<string, MapDef>();
export function registerMaps(defs: MapDef[]) { for (const d of defs) MAPS.set(d.id, d); }
