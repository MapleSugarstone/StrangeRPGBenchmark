import type { SpriteSpec } from '../core/sprites';
import type { Ctx } from '../game/ctx';

export interface TileDef { k: string; a: string; b: string; solid?: boolean; water?: boolean; dig?: boolean; needs?: string; }

export type Script = (c: Ctx) => Promise<void>;
export type Cond = (c: Ctx) => boolean;

export interface NpcDef {
  id: string;
  x: number; y: number;
  sprite: SpriteSpec;
  name?: string;
  dir?: number;
  talk?: Script;
  show?: Cond;
  wander?: boolean;
  ghost?: boolean;
  scale?: number;
  prayer?: string;
}

export interface FeralDef {
  x: number; y: number;
  group: string;
  sprite?: SpriteSpec;
  chase?: number;
  show?: Cond;
  still?: boolean;
}

export interface TriggerDef {
  x: number; y: number; w?: number; h?: number;
  run: Script;
  once?: string;
  show?: Cond;
  touch?: boolean;
}

export interface ExitDef {
  x: number; y: number; w?: number; h?: number;
  to: string; tx: number; ty: number; dir?: number;
  show?: Cond;
  blocked?: Script;
}

export interface DigDef { x: number; y: number; id: string; item?: string; n?: number; slip?: string; pleas?: number; page?: number; }

export interface MapDef {
  id: string;
  name: string;
  chapter: number;
  music?: string;
  rows: string[];
  legend: Record<string, TileDef>;
  npcs?: NpcDef[];
  ferals?: FeralDef[];
  triggers?: TriggerDef[];
  exits?: ExitDef[];
  digs?: DigDef[];
  enter?: Script;
  bg?: string;
  dark?: boolean;
  battleBg?: [string, string];
  hush?: string;
  noListen?: boolean;
  draw?: (g: import('../core/gfx').Gfx, cx: number, cy: number, c: Ctx) => void;
  tick?: (c: Ctx) => Script | null;
  tint?: (c: Ctx) => string | null;
  // Palette mode for the whole map, swapped instead of tinted.
  mode?: (c: Ctx) => import('../core/palette').Mode | null;
  // Ambient light from 0 (pitch dark) to 1 (no darkness), plus light sources in tile coordinates.
  light?: (c: Ctx) => { ambient: number; lights?: [number, number, number][] } | null;
  weather?: import('../scenes/fx').WeatherKind | ((c: Ctx) => import('../scenes/fx').WeatherKind | null);
  battleScene?: string;
  // Tiles that glow at night or in the dark, with their light radius in pixels.
  glow?: Record<string, number>;
}

// Tile helpers keep map legends short.
export const t = {
  floor: (a: string, b: string, k = 'floor'): TileDef => ({ k, a, b }),
  wall: (a: string, b: string, k = 'wall'): TileDef => ({ k, a, b, solid: true }),
  water: (a: string, b: string): TileDef => ({ k: 'water', a, b, solid: true, water: true }),
  solid: (k: string, a: string, b: string): TileDef => ({ k, a, b, solid: true }),
  deco: (k: string, a: string, b: string): TileDef => ({ k, a, b }),
};
