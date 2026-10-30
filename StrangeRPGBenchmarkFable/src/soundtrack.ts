// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { audio, MOODS, type Mood } from "./engine/audio";
import { hash } from "./engine/rng";
import { CHAPTERS } from "./game/story/chapters";

interface Change { id: string; label: string; steps: string[] }
interface Track { id: string; title: string; length: number; changes?: Change[]; mood: Exclude<Mood, "none">; seed: (step: number) => number }

const CHAPTER: Change = { id: "chapter", label: "Chapter", steps: CHAPTERS.map((c) => c.title) };

/** Every pattern is 32 sixteenth-note steps. */
const loop = (mood: Exclude<Mood, "none">) => (32 * 15) / MOODS[mood].bpm;

const track = (id: string, title: string, mood: Exclude<Mood, "none">, seed: (step: number) => number, changes?: Change[]): Track =>
  ({ id, title, length: loop(mood), mood, seed, changes });

// Seeds and moods match Game.playMapMusic, BattleScene.enter, the title screen, and the credits.
const tracks: Track[] = [
  track("title", "The Moth Crown", "title", () => 7),
  ...CHAPTERS.flatMap((ch) => ch.maps.map((m) => track(`map:${m.id}`, m.name, m.encounters ? "dungeon" : "town", () => hash(m.id)))),
  track("battle", "Battle", "battle", (i) => CHAPTERS[i].n * 13, [CHAPTER]),
  track("boss", "Boss", "boss", (i) => CHAPTERS[i].n * 13 + 1, [CHAPTER]),
  track("victory", "Victory", "victory", () => 3),
  track("credits", "And the Small Sun", "credits", () => 11),
];

let current: Track | undefined;

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks: tracks.map(({ id, title, length, changes }) => ({ id, title, length, changes })),
  start(id: string, ctx: AudioContext, out: AudioNode) {
    current = tracks.find((t) => t.id === id);
    if (!current) return;
    audio.init(ctx, out);
    audio.music(current.mood, current.seed(0));
  },
  change(id: string, value: number) {
    if (id === "chapter" && current) audio.music(current.mood, current.seed(value));
  },
};
