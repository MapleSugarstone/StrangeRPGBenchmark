// Which music plays where, and the player's pages turned into melodies for the last fight.
import { VERBS } from '../cant/vocab';
import { TrackId } from '../engine/music';

const BY_MAP: Record<string, TrackId> = {
  millrace: 'millrace', river: 'river', twice: 'twice', press: 'press', ears: 'ears', relay: 'relay',
  rung1: 'tether', rung2: 'tether', rung3: 'tether', writing: 'writing', nursery: 'nursery',
};

/** Act 2 versions of places, seven years on. */
const LATER: Record<string, TrackId> = {
  busy: 'busy7', nursery: 'nursery7', river: 'river_low', twice: 'twice_one', press: 'twice_one', ears: 'ears_up', relay: 'ears_up',
  line1: 'line', line2: 'line', line3: 'line', gutter: 'line', scriv1: 'scrivener', scriv2: 'scrivener', scriv3: 'quill',
};

/** The track for a map. Busy and Standing change with the story. */
export function mapTrack(map: string, chapter: number, flags: Record<string, boolean>): TrackId {
  if (chapter >= 7 && LATER[map]) return LATER[map];
  if (map === 'busy') return chapter === 6 && !flags.c6_won ? 'busy_again' : 'busy';
  if (map === 'standing' || map === 'hall') return flags.released_standing ? 'standing_lit' : 'standing';
  return BY_MAP[map] ?? 'busy';
}

/** Each page as the pitches of its verbs, in the order they are written. */
export function spellMelodies(srcs: string[]): number[][] {
  return srcs
    .map((src) => src.split('\n').flatMap((l) => l.replace(/#.*/, '').split(/[\s:(),]+/)).filter((w) => VERBS[w]).map((w) => VERBS[w].pitch))
    .filter((m) => m.length > 0);
}
