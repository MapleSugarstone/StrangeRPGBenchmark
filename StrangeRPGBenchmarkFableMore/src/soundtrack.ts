// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { Audio, type Mood } from "./engine/audio";
import { CHAPTERS } from "./game/story/index";
import { ENEMIES, GROUPS } from "./game/data/enemies";

interface Change { id: string; label: string; toggle?: boolean; steps?: string[] }
interface Track { id: string; title: string; changes?: Change[] }
type Tune = [Mood, string];

const ENDING = "hem_night";
const VARIANTS: Record<string, string> = { c3_boss_tight: "Stumbled", c7_boss_alone: "Alone" };

const tunes = new Map<string, (values: Record<string, number | boolean>) => Tune>();
const tracks: Track[] = [];
const add = (id: string, title: string, tune: (values: Record<string, number | boolean>) => Tune, changes?: Change[]) => {
  tunes.set(id, tune);
  tracks.push({ id, title, changes });
};

const ending = CHAPTERS.flatMap((c) => c.maps).find((m) => m.id === ENDING)!;
// The chapters whose story calls ctx.camp, which plays the sad mood seeded by the chapter number.
const camps = CHAPTERS.filter((c) => c.n >= 2 && c.n <= 8);
const fights = CHAPTERS.map((c) => GROUPS.filter((g) => g.chapter === c.n && !g.boss));

add("title", "Plumb", () => ["title", "plumb"]);
for (const ch of CHAPTERS) {
  for (const m of ch.maps) {
    if (m.id === ENDING) continue;
    const seed = m.musicSeed ?? m.id;
    const id = `map:${m.music}:${seed}`;
    if (!tunes.has(id)) add(id, m.name, () => [m.music, seed]);
    else if (m.id === seed) tracks.find((t) => t.id === id)!.title = m.name;
    if (m.id === "hem") add("fall", "Fathom's line comes down", () => ["sad", "fall"]);
  }
  if (ch === camps[0]) {
    add("camp", "Camp", (v) => ["sad", `camp${camps[v.chapter as number].n}`], [{ id: "chapter", label: "Chapter", steps: camps.map((c) => c.title) }]);
  }
}
add("battle", "Battle", (v) => {
  const list = fights[v.chapter as number];
  return ["battle", list[(v.fight as number) % list.length].id];
}, [
  { id: "chapter", label: "Chapter", steps: CHAPTERS.map((c) => c.title) },
  { id: "fight", label: "Fight", steps: Array.from({ length: Math.max(...fights.map((f) => f.length)) }, (_, i) => String(i + 1)) },
]);
for (const g of GROUPS.filter((g) => g.boss && !VARIANTS[g.id]).sort((a, b) => a.chapter - b.chapter)) {
  const alt = GROUPS.find((v) => VARIANTS[v.id] && v.chapter === g.chapter);
  const title = ENEMIES[g.enemies[0]].name;
  if (!alt) add(`boss:${g.id}`, title, () => ["boss", g.id]);
  else add(`boss:${g.id}`, title, (v) => ["boss", v.variant ? alt.id : g.id], [{ id: "variant", label: VARIANTS[alt.id], toggle: true }]);
}
add("ending", ending.name, () => [ending.music, ending.musicSeed ?? ending.id]);
add("burl", "Burl's memory", () => ["sad", "burl-memory"]);
add("bait", "Bait", () => ["loft", "bait"]);

let audio: Audio | null = null;
let tune: ((values: Record<string, number | boolean>) => Tune) | undefined;
const values: Record<string, number | boolean> = { chapter: 0, fight: 0, variant: false };

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    tune = tunes.get(id);
    if (!tune) return;
    audio = new Audio();
    audio.unlock(ctx, out);
    audio.play(...tune(values));
  },
  change(id: string, value: number | boolean) {
    values[id] = value;
    if (audio && tune) audio.play(...tune(values));
  },
};
