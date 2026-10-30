// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { Audio, SONGS } from './core/audio';

interface Track { id: string; title: string; length?: number }

/** Every song is 4 bars of 8 eighth-note steps. */
const loop = (id: string) => (32 * 30) / SONGS[id].bpm;

const tracks: Track[] = [
  ['title', 'Duotone'],
  ['village', 'Edgewick'],
  ['wood', 'The Hollow Wood'],
  ['sad', 'The Grey'],
  ['marsh', 'The Fizz'],
  ['town', 'Prismouth'],
  ['church', 'Carillon'],
  ['loom', 'The Loom'],
  ['desert', 'The Hourglass Waste'],
  ['market', 'The Undermarket'],
  ['sky', 'The Cloud Sea'],
  ['battle', 'Battle'],
  ['boss', 'Boss'],
  ['final', 'The Grey Bishop'],
  ['victory', 'Victory'],
].map(([id, title]) => ({ id, title, length: loop(id) }));

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    const audio = new Audio();
    audio.muted = false;
    audio.unlock(ctx, out);
    audio.play(id);
  },
};
