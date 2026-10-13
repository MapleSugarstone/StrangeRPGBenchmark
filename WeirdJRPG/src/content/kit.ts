// Map building: marker characters in the rows place people, doors, drifters, and named spots.
import type { EntDef, DrifterDef, MapDef, Script } from '../game/types';
import { TILESETS } from '../game/tiles';
import { S, fmax } from '../game/state';
import { say, steadyHere, play, flash } from '../game/api';

export interface Mark extends Partial<EntDef> {
  /** The tile left under the marker. Defaults to the area floor. */
  tile?: string;
  /** Makes a drifter instead of an entity. */
  drifter?: { group: string; art: string; c1: string; c2: string; wander?: number; when?: () => boolean };
  /** 'map:mark' of the arrival spot. Bumping or stepping here warps. */
  to?: string;
  /** Only records the spot. */
  spot?: boolean;
}

export const SPOTS: Record<string, Record<string, { x: number; y: number }>> = {};
const pendingDoors: { e: EntDef; to: string }[] = [];

export interface MapIn extends Omit<MapDef, 'ents' | 'drifters'> { marks: Record<string, Mark>; ents?: EntDef[] }

export function makeMap(m: MapIn): MapDef {
  const ents: EntDef[] = [...(m.ents || [])];
  const drifters: DrifterDef[] = [];
  const spots: Record<string, { x: number; y: number }> = {};
  const counts: Record<string, number> = {};
  const floor = '.';
  const rows = m.rows.map((r, y) => [...r].map((ch, x) => {
    const mk = m.marks[ch];
    if (!mk) return ch;
    if (!spots[ch]) spots[ch] = { x, y };
    const n = (counts[ch] = (counts[ch] || 0) + 1);
    const id = (mk.id || `${m.id}_${ch.charCodeAt(0)}`) + (n > 1 ? `_${n}` : '');
    if (mk.drifter) {
      drifters.push({ id, x, y, ...mk.drifter });
    } else if (!mk.spot) {
      const { tile: _t, drifter: _d, to, spot: _s, ...rest } = mk;
      const e: EntDef = { ...rest, id, x, y };
      if (to) { pendingDoors.push({ e, to }); if (e.solid === undefined && !e.art) e.solid = !!TILESETS[m.area][mk.tile || floor]?.solid; }
      ents.push(e);
    }
    return mk.tile ?? floor;
  }).join(''));
  for (const ch of Object.keys(m.marks)) if (!spots[ch] && !m.marks[ch].drifter) console.warn(`map ${m.id}: marker ${ch} not placed`);
  SPOTS[m.id] = spots;
  const { marks: _m, ...rest } = m;
  return { ...rest, rows, ents, drifters };
}

export function spot(map: string, ch: string): { x: number; y: number } {
  const s = SPOTS[map]?.[ch];
  if (!s) throw new Error(`no spot ${map}:${ch}`);
  return s;
}

export function resolveDoors(): void {
  for (const { e, to } of pendingDoors) {
    const [map, ch] = to.split(':');
    const s = SPOTS[map]?.[ch];
    if (!s) { console.warn('door to missing spot ' + to); e.locked = () => 'It does not open yet.'; continue; }
    e.door = { map, x: s.x, y: s.y };
  }
}

/** People cannot see a Faded Pilgrim. */
export function faded(): boolean { return S.f < fmax() * 0.2; }

const FADED_LINES = [
  'Hello?? Who said that. Nobody said that.',
  'There is a sort of: Somebody. Right there. Isnt there?',
  'I can feel you standing there. I can\'t see you. Stand somewhere else, it\'s spooky.',
];

/** Wraps an NPC's talk so a Faded Pilgrim goes unseen. */
export function npc(fn: () => Script): () => Script {
  return function* () {
    if (faded()) { const n = (S.cursors.fadedTalk = (S.cursors.fadedTalk || 0) + 1); yield* say(null, FADED_LINES[n % FADED_LINES.length]); return; }
    yield* fn();
  };
}

/** A talk script that cycles through lines, one per visit. */
export function cycle(speaker: string, key: string, list: string[]): () => Script {
  return npc(function* () {
    const i = (S.cursors['talk:' + key] || 0) % list.length;
    S.cursors['talk:' + key] = i + 1;
    yield* say(speaker, list[i]);
  });
}

export const INSCRIPTIONS = ['plaza_door', 'library_plaque', 'tower_top', 'ship_wheel', 'spire_floor'];

/** Untranslatable letters. They read plainly once the Pilgrim has Thought, and reading all of them is a secret. */
export function inscription(id: string, before: string, letters: string): () => Script {
  return function* () {
    yield* say(null, `${before} {${letters}}`);
    if (!(S.senses.thought || 0) || S.flags['insc:' + id]) return;
    S.flags['insc:' + id] = 1;
    const n = INSCRIPTIONS.filter(k => S.flags['insc:' + k]).length;
    play('insight');
    if (n < INSCRIPTIONS.length) { yield* say(null, `(${n} of ${INSCRIPTIONS.length} untranslatable things read.)`); return; }
    flash('#a070e0', 8);
    play('state_up');
    yield* say(null, 'Every untranslatable thing says the same thing in the end, in a different hand. You can read the hand now. It is yours.');
    if (!S.concepts.includes('Untranslatable')) S.concepts.push('Untranslatable');
    yield* say(null, '(Concept: Untranslatable.)');
  };
}

/** A steadying point: sets Fragility to the safe middle and saves. */
export function steadyAt(label: string, c1: string, c2: string, art = 'steady'): Mark {
  return {
    art, c1, c2, rate: 30, light: { r: 30, i: 0.6, color: c2 }, steady: true,
    talk: function* () {
      steadyHere();
      play('steady');
      flash(c2, 6);
      yield* say(null, `${label}. You steady yourself. Your Fragility settles in the middle, where it is safe. (Saved.)`);
    },
  };
}
