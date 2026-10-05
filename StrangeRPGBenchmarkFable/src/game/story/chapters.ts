import type { MechId, Dir } from "../types";
import type { MapDef } from "../world/map";
import type { ScriptCtx } from "../game";

export type Script = (c: ScriptCtx) => Promise<void>;

export interface ChapterDef {
  n: number;
  title: string;
  /** Hero's journey stage this chapter covers. */
  journey: string;
  mechanic: MechId;
  maps: MapDef[];
  scripts: Record<string, Script>;
  start: { map: string; x: number; y: number; dir?: Dir };
  intro: Script;
  /** Names of the eight story circle beats, for the menu readout. */
  circle: [string, string, string, string, string, string, string, string];
}

import { chapter1 } from "./ch1";
import { chapter2 } from "./ch2";
import { chapter3 } from "./ch3";
import { chapter4 } from "./ch4";
import { chapter5 } from "./ch5";
import { chapter6 } from "./ch6";
import { chapter7 } from "./ch7";
import { chapter8 } from "./ch8";
import { chapter9 } from "./ch9";

export const CHAPTERS: ChapterDef[] = [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6, chapter7, chapter8, chapter9];
