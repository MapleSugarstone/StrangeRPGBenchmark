// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { Music, trackFor } from './game/music';

interface Change { id: string; label: string; toggle?: boolean; steps?: string[]; value?: boolean | number }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }

const PLACES = ['Tuck and the Belfry', 'The Dead Letter Office', 'Comfort Hollow', 'The Firm', 'The Transit Yard', 'A Casino in the Sky',
  'The Foundry Star', 'The Library of Unreturned Hours', 'The Null Garden', 'The Seams', 'The Margin', 'Tuck, at Last'];
const CHAPTER: Change = { id: 'chapter', label: 'Chapter', steps: PLACES.map((_, i) => String(i + 1)) };

type Kind = 'title' | 'world' | 'battle' | 'boss';

/** Every track is 4 bars of 16 sixteenth notes. */
const loop = (kind: Kind, chapter: number) => (16 * 60) / trackFor(kind, chapter).bpm;

const tracks: Track[] = [
  { id: 'title', title: 'The Long Noon', length: loop('title', 1) },
  ...PLACES.map((place, i) => ({ id: `world:${i + 1}`, title: place, length: loop('world', i + 1) })),
  { id: 'battle', title: 'Battle', length: loop('battle', 1), changes: [CHAPTER] },
  { id: 'boss', title: 'Boss', length: loop('boss', 1), changes: [CHAPTER] },
];

let music: Music | null = null;
let kind: Kind = 'title';

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    const [k, ch] = id.split(':');
    kind = k as Kind;
    music = new Music(() => ctx, () => false, () => out);
    music.set(trackFor(kind, Number(ch) || 1));
  },
  change(id: string, value: number) {
    if (id === 'chapter' && music) music.set(trackFor(kind, value + 1));
  },
};
