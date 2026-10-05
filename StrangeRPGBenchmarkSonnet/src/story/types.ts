import type { Mech } from '../data/types';
import type { Theme } from '../gfx/sprites';

export type Circle = 'you' | 'need' | 'go' | 'search' | 'find' | 'take' | 'return' | 'change';
export const CIRCLE_ORDER: Circle[] = ['you', 'need', 'go', 'search', 'find', 'take', 'return', 'change'];

export type Cmd =
  | string
  | { battle: number }
  | { fight: string[]; boss?: boolean }
  | { join: string }
  | { give: string; n?: number }
  | { gold: number }
  | { choice: string; opts: { t: string; do: Cmd[] }[] }
  | { set: string }
  | { if: string; then: Cmd[]; else?: Cmd[] }
  | { card: string[] }
  | { shake: number }
  | { flash: boolean }
  | { wait: number }
  | { heal: boolean }
  | { unlock: boolean }
  | { end: boolean };

export interface BeatDef {
  circle: Circle;
  room: number;
  /** One-line summary shown in the chapter log and used by the story tests. */
  note: string;
  script: Cmd[];
}

export interface NpcDef {
  id: string;
  name: string;
  room: number;
  /** Lines keyed by the minimum number of completed beats. The highest key that fits is used. */
  lines: Record<number, string[]>;
}

export interface ChestDef {
  room: number;
  /** Enemies that guard the chest. They must be beaten before it opens. */
  guard?: string[];
  give?: string;
  n?: number;
  gold?: number;
}

export interface ChapterDef {
  id: number;
  title: string;
  stage: string;
  place: string;
  theme: Theme;
  seed: number;
  mech: Mech;
  mechTitle: string;
  mechText: string[];
  partymate: string;
  intro: string[];
  beats: BeatDef[];
  npcs: NpcDef[];
  chests: ChestDef[];
}
