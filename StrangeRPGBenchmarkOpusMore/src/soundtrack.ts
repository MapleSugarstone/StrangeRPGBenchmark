// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { Audio } from './core/audio';
import { MUSIC } from './data/music';

interface Change { id: string; label: string; steps: string[] }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }

/** One jingle's bar count and bar length, with bars split the way compose.ts splits them. */
function bars(id: string, variant = 0) {
  const st = MUSIC[id], j = st.jingle![variant];
  const bs = (j.beats ?? st.beats ?? 4) * 4;
  const steps = Math.max(...[j.lead, j.harm, j.bass, j.drum].map((s) => (s ? s.trim().split(/\s+/).filter((x) => x !== '|').length : 0)));
  return { n: Math.ceil(steps / bs), sec: (bs * 15) / j.bpm, loop: j.loop };
}

/** Seconds in the part of a jingle that repeats, or in the whole jingle when it ends. */
function jingle(id: string): Pick<Track, 'length' | 'once'> {
  const b = bars(id);
  return b.loop === undefined ? { length: b.n * b.sec, once: true } : { length: (b.n - b.loop) * b.sec };
}

const FANFARE: Change = { id: 'fanfare', label: 'Fanfare', steps: MUSIC.victory.jingle!.map((_, i) => String(i + 1)) };

const tracks: Track[] = [
  { id: 'title', title: 'Please Hold' },
  { id: 'intro', title: 'Intro', ...jingle('intro') },
  { id: 'town', title: 'Lowmost' },
  { id: 'field', title: 'The Shallows' },
  { id: 'minigame', title: 'Minigame' },
  { id: 'dungeon', title: 'The Old Shaft' },
  { id: 'tense', title: 'The Linemen' },
  { id: 'sad', title: 'Someday' },
  { id: 'hold', title: 'The Waiting Room' },
  { id: 'secret', title: 'Overstock' },
  { id: 'docket', title: 'The Docket' },
  { id: 'encore', title: 'Encore' },
  { id: 'jackpot', title: 'Jackpot' },
  { id: 'climb', title: 'The Line' },
  { id: 'sea', title: 'The Lonesome Sea' },
  { id: 'ark', title: 'The Patient Ark' },
  { id: 'lullaby', title: 'Lullaby' },
  { id: 'battle', title: 'Battle' },
  { id: 'boss', title: 'Boss' },
  { id: 'quiet', title: 'The Hush' },
  { id: 'final', title: 'Amen' },
  { id: 'victory', title: 'Victory', ...jingle('victory'), changes: [FANFARE] },
  { id: 'credits', title: 'Credits' },
  { id: 'card', title: 'Chapter', ...jingle('card') },
];

let audio: Audio | null = null;

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    audio = new Audio();
    audio.tracks = MUSIC;
    audio.unlock(ctx, out);
    audio.play(id, 0, MUSIC[id].sparse ? 16 : 0);
  },
  change(id: string, value: number) {
    if (id !== 'fanfare' || !audio) return;
    audio.play(null);
    audio.play('victory', value);
  },
};
