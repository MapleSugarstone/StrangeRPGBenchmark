import type { AiLevel, Mon } from '../battle/model';

export interface Warp { x: number; y: number; to: string; tx: number; ty: number; dir?: number; when?: () => boolean; locked?: string }

export interface TrainerDef {
  name: string;
  team: [string, number][] | (() => Mon[]);
  intro: string;
  defeat: string;
  ai?: AiLevel;
  sight?: number;
  speaker?: string;
  sync?: boolean;
  /** Battle track. Defaults by who is fighting. */
  music?: string;
}

export interface NpcDef {
  id: string;
  /** Stands on a solid tile on purpose: a climber on rock, a cast under ice, a face at a window. */
  onSolid?: boolean;
  x: number;
  y: number;
  sprite: string;
  dir?: number;
  name?: string;
  lines?: string[] | (() => string[]);
  talk?: string;
  trainer?: TrainerDef;
  when?: () => boolean;
  mon?: string;
  img?: () => import('../battle/model').SpriteData;
  ghost?: boolean;
  wander?: boolean;
  /** This person stands in the way on purpose, as a gate guard or a trainer placed as an obstacle. The validator lets them cut a path. */
  blocks?: boolean;
  /** A puzzle moves this one about, so the validator does not count it as a wall. */
  movable?: boolean;
  /** A big old whorl asleep across a path. The jingle wakes it, and it fights or walks off. The flag hides it for good. */
  sleeper?: { kind: string; lv: number; flag: string };
  /** A synced rematch, offered once rematches open and the scale is in hand. */
  rematch?: { scale: string; team: () => import('../battle/model').Mon[]; name: string };
  /** A loop this one walks while nothing else happens: 'd', 'r', 'u', 'l' steps and '.' for a stop. It must come back to where it starts. */
  route?: string;
  /** Frames between steps on a route. */
  pace?: number;
  /** Something this one does now and then where it stands: a small action, a bubble, or both, every so many frames. */
  idle?: { every: number; act?: import('./field').ActKind; emote?: import('./field').EmoteKind };
  /** Another person this one talks to: it faces them, and turns to Ouro while Ouro stands close. */
  pair?: string;
}

export interface Zone {
  kinds: [string, number][]; lv: [number, number]; n: number; area: string; fitted?: number;
  /** On the Strand, different kinds come out at high and low tide. Replaces kinds when set. */
  tideKinds?: { high: [string, number][]; low: [string, number][] };
}

export interface Trigger { x: number; y: number; w: number; h: number; script: string; when?: () => boolean }

export interface MapDef {
  id: string;
  name: string;
  region: number;
  rows: string[];
  warps: Warp[];
  npcs: NpcDef[];
  zone?: Zone;
  music?: string;
  enter?: string;
  dark?: boolean;
  triggers?: Trigger[];
  tannery?: boolean;
  indoor?: boolean;
  edge?: string;
  /** Tiles that change with story state. */
  mods?: { x: number; y: number; w?: number; ch: string; when: () => boolean }[];
  /** A map on the Strand: whorls from the Volute fight at their Strand level here. */
  strand?: boolean;
  /** Only tiles Vellum has been near are drawn. */
  fog?: boolean;
  /** Only tiles inside a lit star ring, or right beside Ouro, are drawn (the Flats at night). Rings live in strandFx. */
  fogRings?: boolean;
  /** Set pieces bigger than a tile, by painter name (see src/game/props.ts), at a tile position. Drawn over the tiles, under people. */
  props?: { x: number; y: number; pic: string; when?: () => boolean }[];
  /** Big empty shells lying on this map. The sweep takes them at low water unless a whorl sits in one. */
  shells?: { id: string; x: number; y: number; washed?: boolean }[];
  /** Facing one tile and pressing the button runs a script: lore objects, secrets, hidden finds. */
  spots?: { x: number; y: number; script: string | Script; when?: () => boolean }[];
  /** Talking to a tile char runs a script. */
  tileTalk?: Record<string, string>;
  /** Every house with no door is drawn as an empty shell, outgrown and left beside a lived-in one. */
  oldShells?: boolean;
  /** The tile at the middle of the Apex on a map round its foot. The moon's shadows there fall away from it. */
  apexTile?: [number, number];
  /** The ground leans toward this tile: walking away from it is slow. */
  slope?: [number, number];
  /** A puzzle basin: stones inside it go back to their starts until Ouro stands where `done` holds, and are saved after. */
  basin?: { x: number; y: number; w: number; h: number; flag: string; done: (x: number, y: number) => boolean };
}

export const MAPS: Record<string, MapDef> = {};
/** Where Ouro stands when a save points at a tile that is no longer open, by map. Maps not listed use their first warp landing. */
export const SPAWNS: Record<string, [number, number]> = {};
export function defMap(m: MapDef): void {
  const w = m.rows[0].length;
  m.rows.forEach((r, i) => { if (r.length !== w) throw new Error(`map ${m.id} row ${i} is ${r.length} wide, expected ${w}`); });
  MAPS[m.id] = m;
}

export type Script = () => Promise<void>;
export const SCRIPTS: Record<string, Script> = {};
export function defScript(id: string, s: Script): void { SCRIPTS[id] = s; }
