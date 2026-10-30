// The launcher's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { useAudio } from './engine/audio';
import { music, normalize, renderTrack } from './engine/music';
import type { StingerId, TrackId } from './engine/music';
import { STINGERS } from './engine/score';
import type { Voice } from './engine/score';
import { FOES } from './game/enemies';
import { spellMelodies } from './game/tunes';

interface Change { id: string; label: string; toggle?: boolean; steps?: string[]; value?: boolean | number }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }

const DIALOGUE: Change = { id: 'dialogue', label: 'Dialogue', toggle: true };
const INTENSITY: Change = { id: 'intensity', label: 'Intensity', steps: ['Calm', 'Tense', 'Peak'] };
const LEVELS = [0, 0.5, 0.95];
const PAGES: Change = { id: 'pages', label: 'Pages', steps: ['Wait only', 'Copied pages'], value: 1 };
// Wait's own page has no verbs, so on its own the engine falls back to Wait's figure.
const PAGE_SETS = [['wait  # until'], ['wait  # until', FOES.hold.page!.src, FOES.many.page!.src, FOES.arm.page!.src]];

/** How long each voice rings past the end of its note. */
const TAIL: Record<Voice, number> = { p1: 0.06, p2: 0.06, tri: 0.03, nz: 0.2, bell: 0.3, air: 0.3 };

/** Seconds a track that ends takes, from the call to its last ringing note, over enough seeds to catch its longest pass. */
function ends(id: TrackId): number {
  let end = 0;
  for (let seed = 1; seed <= 24; seed++) {
    for (const s of renderTrack(id, 600, { seed })) {
      end = Math.max(end, s.start + s.secs);
      for (const n of s.notes) end = Math.max(end, n.at + n.dur + TAIL[n.v]);
    }
  }
  return Math.ceil((0.06 + end) * 10) / 10;
}

function stingLength(id: StingerId): number {
  const sec = STINGERS[id](), spb = 60 / sec.bpm;
  let end = 0;
  for (const e of normalize(sec)) end = Math.max(end, (e.t + e.d) * spb + TAIL[e.v]);
  return Math.ceil((0.03 + end) * 10) / 10;
}

const area = (id: TrackId, title: string): Track => ({ id, title, changes: [DIALOGUE] });
const fight = (id: TrackId, title: string): Track => ({ id, title, changes: [INTENSITY] });
const once = (id: TrackId, title: string, changes?: Change[]): Track => ({ id, title, length: ends(id), once: true, changes });
const sting = (id: StingerId, title: string): Track => ({ id: `sting:${id}`, title, length: stingLength(id), once: true });

const tracks: Track[] = [
  { id: 'title', title: 'Rote' },
  area('busy', 'Busy'),
  { id: 'margin', title: 'The Margin' },
  area('millrace', 'The Millrace'),
  area('river', 'The river'),
  { id: 'reel', title: 'Take a line' },
  area('standing', 'Standing'),
  area('standing_lit', 'Standing, lit'),
  area('twice', 'Twice'),
  area('press', 'The Press'),
  area('ears', 'The Ears'),
  area('relay', 'The Relay'),
  area('tether', 'The Tether'),
  area('writing', 'The Writing Room'),
  area('busy_again', 'Busy, again'),
  area('nursery', 'The Nursery'),
  once('credits', 'Credits, act one'),
  once('act2_title', 'Act two'),
  area('prologue_night', 'That night'),
  area('busy7', 'Busy, seven years on'),
  area('nursery7', 'The Nursery, seven years on'),
  area('theme_room', 'Room\'s question'),
  area('river_low', 'The river, low'),
  area('twice_one', 'Twice, seven years on'),
  area('theme_stet', 'Stet'),
  area('theme_every', 'Every'),
  area('ears_up', 'The Ears, seven years on'),
  area('line', 'The Line'),
  area('theme_room_answer', 'Room\'s answer'),
  area('scrivener', 'The Scrivener'),
  area('quill', 'The top room'),
  fight('battle', 'Battle'),
  fight('battle_copied', 'Battle, copied'),
  fight('battle2', 'Battle, seven years on'),
  fight('boss_grind', 'Grind'),
  fight('boss_erratum', 'The Erratum'),
  fight('boss_hold', 'Hold'),
  fight('boss_many', 'Many'),
  fight('boss_relay', 'Fighting the Relay'),
  fight('boss_arm', 'The Arm'),
  { id: 'boss_again', title: 'Again', changes: [INTENSITY, PAGES] },
  fight('boss_closer', 'The Closer'),
  fight('boss_corrector', 'The Corrector'),
  fight('boss_over', 'Over'),
  fight('boss_gloss', 'Gloss'),
  once('coda', 'Coda', [DIALOGUE]),
  once('credits2', 'Credits, act two'),
  once('splash', 'Boot'),
  sting('chapter', 'Chapter'),
  sting('write', 'Write'),
  sting('win', 'Win'),
  sting('level', 'Level up'),
  sting('secret', 'Secret'),
  sting('catch', 'Catch'),
  sting('ending', 'A last line'),
  once('gameover', 'Game over'),
];

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    useAudio(ctx, out);
    if (id.startsWith('sting:')) { music.stinger(id.slice(6) as StingerId); return; }
    const track = tracks.find((t) => t.id === id);
    if (id === 'boss_again') music.setSpellMelodies(spellMelodies(PAGE_SETS[PAGES.value as number]));
    music.play(id as TrackId, track?.once ? 0 : 1);
  },
  change(id: string, value: boolean | number) {
    if (id === 'dialogue') music.duck(!!value);
    else if (id === 'intensity') music.setIntensity(LEVELS[value as number] ?? 0);
    else if (id === 'pages') music.setSpellMelodies(spellMelodies(PAGE_SETS[value as number] ?? PAGE_SETS[0]));
  },
};
