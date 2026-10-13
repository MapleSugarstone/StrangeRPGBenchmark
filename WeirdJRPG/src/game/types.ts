import type { TrackId, AreaTint, VoiceId } from '../engine/audio';
import type { Area, TileDef } from './tiles';
import type { Art } from '../engine/sprites';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Script = Generator<unknown, any, unknown>;
export type ScriptFn = () => Script;

export type SenseHook = Partial<Record<'sight' | 'touch' | 'hearing' | 'taste' | 'smell' | 'thought', ScriptFn>>;

export interface EntDef {
  id: string;
  x: number;
  y: number;
  /** Art key: an NPC, enemy, pickup, or avatar name, or a literal sprite. */
  art?: string | Art | Art[];
  c1?: string;
  c2?: string;
  /** Blocks walking. Default true when it has art. */
  solid?: boolean;
  name?: string;
  voice?: VoiceId;
  talk?: ScriptFn;
  /** Runs when the Pilgrim steps onto this tile. */
  touch?: ScriptFn;
  sense?: SenseHook;
  /** Shown only while this is true. */
  when?: () => boolean;
  /** Only True Sight shows it. */
  hidden?: boolean;
  door?: { map: string; x: number; y: number; dir?: number };
  /** A message instead of warping while this returns one. */
  locked?: () => string | null;
  /** Wanders within this many tiles of home. */
  wander?: number;
  dir?: number;
  /** Mood dot shown with the Touch passive. */
  mood?: string;
  /** Hearing passive shows notes over it. */
  sings?: boolean;
  /** Names it accepts, and what happens for each. */
  rename?: Record<string, ScriptFn>;
  /** What Insight shows. */
  truth?: string;
  /** Frames advance every `rate` ticks. */
  rate?: number;
  /** Draw this many pixels higher, for 12-row figures. */
  tall?: boolean;
  /** Pixel offset. */
  ox?: number;
  oy?: number;
  /** A pickup that disappears when taken. Its flag is set. */
  pickup?: { kind: 'shell' | 'memory' | 'emotion' | 'name' | 'book'; id: string; label: string; text?: string; flag: string };
  flip?: boolean;
  glow?: string;
  /** Gives off light. */
  light?: { r: number; i: number; color: string; negative?: boolean };
  /** Drawn unlit, at full color. */
  emissive?: boolean;
  /** A steadying point. */
  steady?: boolean;
}

export interface DrifterDef {
  id: string;
  x: number;
  y: number;
  group: string;
  art: string;
  c1: string;
  c2: string;
  wander?: number;
  when?: () => boolean;
}

export interface MapDef {
  id: string;
  name: string;
  area: Area;
  music: TrackId;
  tint?: AreaTint;
  rows: string[];
  legend?: Record<string, TileDef>;
  ents: EntDef[];
  drifters?: DrifterDef[];
  onEnter?: ScriptFn;
  /** The water forgets: revealed tiles far behind the Pilgrim become unknown again. */
  forgets?: boolean;
  /** Indoors: no sky behind the walls. */
  indoor?: boolean;
  /** The whole map starts revealed. */
  known?: boolean;
  /** Reveal radius in tiles. */
  sight?: number;
  /** Your past self walks your path a few seconds behind you. */
  ghosts?: boolean;
  /** Every so often time stops entirely for two seconds. */
  timeStops?: boolean;
  /** Ambient light: color and level. At 1.1 or more nothing goes dark. */
  ambient?: { color: string; level: number };
  /** Lights that move, in world pixels. */
  moving?: (t: number) => { x: number; y: number; r: number; i: number; color: string; negative?: boolean }[];
}

export interface Goal { text: string; map?: string; x?: number; y?: number; act?: string }
