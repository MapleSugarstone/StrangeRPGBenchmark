import { addLoot } from './loot';

// Hacking puzzles for `> splice`, `> surf`, and `> bail`. Each takes a difficulty from 1 to 4. Unset fields come
// from the difficulty, and the party's best Hack pool adds time, buffer, or integrity on top.

export type Glyph = 'anger' | 'fear' | 'calm' | 'joy' | 'grief' | 'hush';
export const GLYPHS: Glyph[] = ['anger', 'fear', 'calm', 'joy', 'grief', 'hush'];

export interface SpliceTarget {
  /** Short text for the target, at most 16 characters. */
  label: string;
  /** Glyph length when the sequence is generated. */
  len?: number;
  /** Flag set when this target is cut. The first target is the job and needs no flag. */
  flag?: string;
}
export interface SpliceDef { id: string; difficulty: number; title?: string; size?: number; buffer?: number; time?: number; targets: SpliceTarget[] }

export interface SurfDef {
  id: string;
  difficulty: number;
  title?: string;
  /** Seconds to the end of the run. */
  length?: number;
  lanes?: number;
  /** Integrity: hits before the run ends. */
  hits?: number;
}

export interface BailDef { id: string; difficulty: number; title?: string; w?: number; h?: number; drains?: number; /** Seconds between frost steps. */ step?: number }

export const SPLICE = new Map<string, SpliceDef>();
export const SURF = new Map<string, SurfDef>();
export const BAIL = new Map<string, BailDef>();

export function addSplice(list: SpliceDef[]) { for (const d of list) SPLICE.set(d.id, d); }
export function addSurf(list: SurfDef[]) { for (const d of list) SURF.set(d.id, d); }
export function addBail(list: BailDef[]) { for (const d of list) BAIL.set(d.id, d); }

// Practice puzzles for the test scene. Story puzzles are registered in src/content/undertow.ts.
addSplice([
  { id: 'test_splice', difficulty: 2, title: 'Test splice', targets: [{ label: 'Open the gate' }, { label: 'Wipe the log', flag: 'test_wiped' }] },
]);
addSurf([{ id: 'test_surf', difficulty: 2, title: 'Test current' }]);
addBail([{ id: 'test_bail', difficulty: 2, title: 'Test routing' }]);

// Packets in the net.
addLoot({
  net_small: { items: [['chip', 1, 0.6], ['stim', 1, 0.3]], gilt: [15, 40] },
  net_big: { items: [['chip', 2, 0.8], ['bigstim', 1, 0.4], ['ramcore', 1, 0.05]], gilt: [40, 110] },
  desk: { items: [['hush', 1, 0.5], ['stim', 1, 0.6], ['shockgren', 1, 0.3], ['ration', 1, 0.4]], gilt: [25, 70] },
});
