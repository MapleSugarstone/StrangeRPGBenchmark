// Registries for the replay systems: backgrounds, factions, travel destinations, and world events.
// Design: Notes/replay-design.md.
import { C } from '../engine/palette';
import { addItems, type Skill } from '../rules/data';

addItems([
  { id: 'boardpass', name: 'Old Board Pass', kind: 'key', price: 0, desc: "Your old Recovery badge. It's expired, complete with the red stripe, but some doors still recognize it." },
  { id: 'choirbell', name: 'Choir Bell', kind: 'key', price: 0, desc: 'A hand bell with no clapper. The Choir gives one to every child.' },
  { id: 'chalk', name: 'Vein Chalk', kind: 'key', price: 0, desc: 'Blue chalk. A circle means safe. A circle with a line means move on.' },
]);

export interface Background { id: string; name: string; desc: string; skill: Skill; item: string }

export const BACKGROUNDS: Background[] = [
  { id: 'runner', name: 'Canal worker', desc: 'Born in the Deeps and raised on the canals. You know every boardwalk, every toll, and half the people who work them.', skill: 'athletics', item: 'stim' },
  { id: 'washout', name: 'Recovery defector', desc: 'You wore Board red for two years, fetching woken property, until you let one slip. You still know the procedures and the people.', skill: 'tech', item: 'boardpass' },
  { id: 'choir', name: 'Choir fugitive', desc: 'The Choir raised you without chrome. You ran away at sixteen and got a port the same week. They still sing your old name.', skill: 'notice', item: 'choirbell' },
  { id: 'vein', name: 'Vein-raised', desc: 'The Vein hid you as a child, moving you from cellar to cellar. You can read their chalk signs, and the Census has a file on you.', skill: 'sneak', item: 'chalk' },
];
export const BACKGROUND = new Map(BACKGROUNDS.map((b) => [b.id, b]));

export interface Faction { id: string; name: string; color: number }

export const FACTIONS: Faction[] = [
  { id: 'deeps', name: 'The Deeps', color: C.cyan3 },
  { id: 'board', name: 'The Board', color: C.red3 },
  { id: 'vein', name: 'The Vein', color: C.grn3 },
  { id: 'church', name: 'The Church', color: C.amb3 },
  { id: 'choir', name: 'The Choir', color: C.pale },
  { id: 'cutters', name: 'The Cutters', color: C.mag3 },
  { id: 'lockjaws', name: 'The Lockjaws', color: C.cyan4 },
  { id: 'woken', name: 'The Pound', color: C.amb4 },
  { id: 'bodywell', name: 'Bodywell', color: C.vio3 },
  { id: 'waders', name: 'The Waders', color: C.mud2 },
  { id: 'moles', name: 'The Moles', color: C.steel3 },
];
export const FACTION = new Map(FACTIONS.map((f) => [f.id, f]));

/** A travel destination. It shows once its map has been visited or `known` holds. */
export interface Destination {
  id: string;
  name: string;
  district: 'deeps' | 'stair' | 'brim' | 'flats';
  map: string;
  marker: string;
  /** Shown only while this holds. */
  when?: string;
  /** Shown once this holds even if the map was never visited. */
  known?: string;
  /** Another map and marker while a condition holds, first match wins (the flooded market in chapter 5). */
  variants?: { when: string; map: string; marker: string }[];
}
export const TRAVEL: Destination[] = [];
export function addTravel(list: Destination[]) { TRAVEL.push(...list); }

/** A world event: a scene that may fire on arriving at a map. */
export interface WorldEvent {
  id: string;
  scene: string;
  maps?: string[];
  district?: 'deeps' | 'stair' | 'brim' | 'flats' | 'inside';
  when?: string;
  /** Chance per eligible arrival, 0 to 1. Rolled from the save's seed, so each playthrough differs. */
  chance?: number;
  /** Plays again after this many map arrivals. Omit to play once. */
  repeat?: number;
}
export const EVENTS: WorldEvent[] = [];
export function addEvents(list: WorldEvent[]) { EVENTS.push(...list); }
