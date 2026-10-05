import type { MapDef } from '../game/world';
import type { Script } from '../game/script';
import type { GameState } from '../game/state';
import * as ch1 from './ch1';
import * as ch2 from './ch2';
import * as ch3 from './ch3';
import * as ch4 from './ch4';
import * as ch5 from './ch5';
import * as ch6 from './ch6';
import * as ch7 from './ch7';
import * as ch8 from './ch8';

export interface ChapterDef {
  title: string;
  stage: string;
  blurb: string;
  recruit?: string;
  ready: boolean;
  startMap: string;
  startMarker: string;
  intro?: Script;
  objective: (st: GameState) => string;
  presetFlags?: Record<string, number | string | boolean>;
  /** Ordered story waypoints the playthrough bot walks to. */
  route?: RouteStep[];
}

export type RouteStep =
  | { map: string; ent: string; note?: string }
  | { map: string; warp: string; note?: string };

const MODULES: { maps: MapDef[]; chapter: ChapterDef }[] = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8];

export const MAPS: Record<string, MapDef> = {};
for (const m of MODULES) for (const d of m.maps) MAPS[d.id] = d;

const PLACEHOLDER = (n: number, title: string, stage: string): ChapterDef => ({
  title, stage, blurb: 'Not written yet.', ready: false, startMap: 'edgewick', startMarker: 'a',
  objective: () => `Chapter ${n} is still being printed.`,
});

export const CHAPTERS: ChapterDef[] = [
  ch1.chapter,
  ch2.chapter,
  ch3.chapter,
  ch4.chapter,
  ch5.chapter,
  ch6.chapter,
  ch7.chapter,
  ch8.chapter,
];

export function registerChapter(n: number, mod: { maps: MapDef[]; chapter: ChapterDef }) {
  for (const d of mod.maps) MAPS[d.id] = d;
  CHAPTERS[n - 1] = mod.chapter;
}
