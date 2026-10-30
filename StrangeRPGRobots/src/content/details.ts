// Small things to look at: a detail is a spot on a map the player can inspect for a line or two, a comment
// from the port or a companion, a passive skill line when the party is good enough, and sometimes a small
// reward or a lore entry. Lore entries collect in the journal. Writers add details with addDetails.
import type { Skill } from '../rules/data';

export interface Detail {
  id: string;
  map: string;
  at: [number, number];
  /** What the player sees. Separate lines with '|'. */
  text: string;
  /** The port's comment, or comments by the chapter they start in, so the port keeps its chapter voice. */
  port?: string | Record<number, string>;
  /** Lines from companions, by id. The first companion in the party who has a line speaks. */
  party?: Record<string, string>;
  /**
   * A passive check: when the best dice pool in the party for the skill reaches `need`, the skill speaks the
   * line and gives its reward. Pools run about 3 for untrained, 5 for good, 7 for expert.
   */
  check?: { skill: Skill; need: number; text: string; reward?: Reward };
  /** Given once, on the first look. */
  reward?: Reward;
  /** A lore entry unlocked on the first look. */
  lore?: string;
  /** Runs a full scene instead, for details that open a small quest. The detail still counts as found. */
  scene?: string;
  when?: string;
  hideIf?: string;
}

export interface Reward { gilt?: number; item?: string; xp?: number; flag?: string }

export interface Lore { id: string; title: string; text: string }

export const DETAILS: Detail[] = [];
const BY_MAP = new Map<string, Detail[]>();
export function addDetails(list: Detail[]) {
  for (const d of list) {
    DETAILS.push(d);
    if (!BY_MAP.has(d.map)) BY_MAP.set(d.map, []);
    BY_MAP.get(d.map)!.push(d);
  }
}
export function detailsOn(map: string): Detail[] { return BY_MAP.get(map) ?? []; }

export const LORE = new Map<string, Lore>();
export function addLore(list: Lore[]) { for (const l of list) LORE.set(l.id, l); }
