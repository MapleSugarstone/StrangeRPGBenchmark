// The launcher's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { setSfxVolume, useAudio } from './engine/audio';
import { music, renderTrack } from './engine/music';
import type { Voice } from './engine/score';
import { catchJingle, joinJingle, levelJingle, missJingle } from './game/jingles';

interface Change { id: string; label: string; toggle?: boolean; steps?: string[]; value?: boolean | number }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }

/** The Stays a player has loosened when first hearing the track, each of which lowers all the music a semitone. */
const stays = (value: number): Change => ({ id: 'stays', label: 'Seals loosened', steps: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], value });
const INTENSITY: Change = { id: 'intensity', label: 'Intensity', steps: ['Calm', 'Tense', 'Peak'] };
const LEVELS = [0, 0.5, 0.9];
const TIDE: Change = { id: 'tide', label: 'High tide', toggle: true };
const BEND: Change = { id: 'bend', label: 'Bend' };

/** The effects volume a new game starts with, which the jingles play at. */
const SFX_DEFAULT = 0.7;

/** How long each voice rings past the end of its note. */
const TAIL: Record<Voice, number> = { p1: 0.06, p2: 0.06, tri: 0.03, nz: 0.2, bell: 0.3, air: 0.3 };

/** Seconds a track that ends takes, from the call to its last ringing note, over enough seeds to catch its longest pass. */
function ends(id: string): number {
  let end = 0;
  for (let seed = 1; seed <= 24; seed++) {
    for (const s of renderTrack(id, 600, { seed })) {
      end = Math.max(end, s.start + s.secs);
      for (const n of s.notes) end = Math.max(end, n.at + n.dur + TAIL[n.v]);
    }
  }
  return Math.ceil((0.06 + end) * 10) / 10;
}

const JINGLES: Record<string, { play: () => void; length: number }> = {
  catch: { play: catchJingle, length: 2.1 },
  join: { play: joinJingle, length: 1.5 },
  level: { play: () => levelJingle(1), length: 1 },
  miss: { play: missJingle, length: 1.3 },
};

const place = (id: string, title: string, loose: number, ...more: Change[]): Track => ({ id, title, changes: [...more, stays(loose)] });
const fight = (id: string, title: string, loose: number): Track => ({ id, title, changes: [INTENSITY, stays(loose)] });
const once = (id: string, title: string, loose: number): Track => ({ id, title, length: ends(id), once: true, changes: [stays(loose)] });
const jingle = (id: string, title: string): Track => ({ id: `jingle:${id}`, title, length: JINGLES[id].length, once: true });

const tracks: Track[] = [
  place('title', 'Whorl', 0),
  place('home', 'Gran\'s kitchen', 0),
  place('fellside', 'Turnstone', 0),
  place('cove', 'Cockle Cove', 0),
  place('route', 'The Midden Road', 0),
  place('brook', 'The Brook Wood', 0),
  place('town', 'Rib', 0),
  place('gym', 'Inside the Rib', 0),
  place('gempuzzle', 'Setting', 0),
  place('minigame', 'Shellboard and Prise', 0),
  place('cave', 'The Undermeadow', 0),
  place('highwater', 'The High-water Mark', 0),
  place('drysea', 'The Dry Sea', 0),
  place('marsh', 'The salt marsh', 1),
  place('saltings', 'The Saltings', 1),
  place('spire', 'Spire', 1),
  place('shout', 'The Shouting Wood', 1),
  place('wood', 'The understory', 1),
  place('kelp', 'The Kelp Beds', 1),
  place('machine', 'The machine fields', 2),
  place('gantry', 'The Gantry Shore', 2),
  place('hum', 'Hum', 2),
  place('bare', 'Inside the Pylon', 2),
  place('gatering', 'The Gate Ring', 2),
  place('tundra', 'The tundra', 2),
  place('floes', 'The Floes', 2),
  place('tusk', 'Tusk', 2),
  place('tallow', 'Old Amber\'s hall', 2),
  place('hiltroad', 'The Hilt road', 3),
  place('shingle', 'The Shingle', 3),
  place('peel', 'The Hermitage', 3),
  place('moonwater', 'The Moonwater', 3, BEND),
  place('crater', 'The crater fields', 4),
  place('fall', 'Fall', 4),
  place('longway', 'The Long Way Round', 4),
  place('geode', 'The Geode', 4),
  place('climb', 'The Climb', 5),
  place('crown', 'The Apex', 5),
  once('credits', 'Credits, act one', 8),
  place('slack', 'The Shallows', 8),
  place('oldrind', 'The Exuvia', 8),
  place('stack', 'The Stack', 8),
  place('strand', 'The Strand', 8, TIDE),
  place('sanddollar', 'The Sand Dollar', 8),
  place('starfall', 'Starfall', 8),
  place('cowrie', 'The Cowrie', 8),
  place('auger', 'The Auger', 8),
  place('nautilus', 'The Nautilus', 8),
  place('tray', 'The Tray', 8),
  place('cinchReal', 'The old Apex', 8),
  place('conch', 'The Conch', 8),
  fight('battle', 'Battle', 0),
  fight('wild', 'Wild Whorls', 0),
  fight('rival', 'Tack', 0),
  fight('keeper', 'Keepers', 0),
  fight('battlePeel', 'The Hermits', 1),
  fight('legend', 'A legendary', 3),
  fight('battleHand', 'The Hands', 5),
  fight('battleCinch', 'Cinch', 5),
  fight('holm', 'Holm', 8),
  fight('wildStrand', 'Wild Whorls on the Strand', 8),
  fight('keeperStrand', 'Keepers on the Strand', 8),
  fight('collector', 'The Gleaner', 8),
  once('credits2', 'Credits, act two', 8),
  once('splash', 'Boot', 0),
  jingle('catch', 'Into the horn'),
  jingle('join', 'Joins your team'),
  jingle('level', 'Level up'),
  jingle('miss', 'Won\'t curl into the horn'),
];

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    useAudio(ctx, out);
    if (id.startsWith('jingle:')) { setSfxVolume(SFX_DEFAULT); JINGLES[id.slice(7)]?.play(); return; }
    const loose = tracks.find((t) => t.id === id)?.changes?.find((c) => c.id === 'stays')?.value;
    music.setDrop(typeof loose === 'number' ? loose : 0);
    music.play(id);
    // The field sets the Strand's tide layer after play(), which starts every track at intensity 0.
    if (id === 'strand') music.setIntensity(0.2);
  },
  change(id: string, value: boolean | number) {
    if (id === 'stays') music.setDrop(value as number);
    else if (id === 'intensity') music.setIntensity(LEVELS[value as number] ?? 0);
    else if (id === 'tide') music.setIntensity(value ? 1 : 0.2);
    else if (id === 'bend') music.bend();
  },
};
