// Turns one of Qwen's 16-step loops into a song: sections that each treat the loop differently, and layers that grow
// each time the song comes round. Everything is derived from Qwen's notes: the harmony is the melody a third below,
// the pad and keys play the chord of each bar's bass note, and the contrasting section moves the loop to another key.
import type { QwenTrack } from "./qwen_tracks.js";

export type Part = "lead" | "harmony" | "bass" | "pad" | "keys" | "kick" | "snare" | "hat";
export interface Ev { step: number; part: Part; midi: number; dur: number; vol: number }

type Melody = "orig" | "octave" | "retro" | "sparse" | "climb" | "none";
type Bass = "orig" | "pedal" | "walk" | "none";
type Drums = "none" | "light" | "orig" | "full" | "build";
export interface Section { name: string; bars: number; melody: Melody; bass: Bass; drums: Drums; pad?: boolean; harmony?: boolean; keys?: boolean; shift?: number }

const S = (name: string, bars: number, melody: Melody, bass: Bass, drums: Drums, extra: Partial<Section> = {}): Section => ({ name, bars, melody, bass, drums, ...extra });

/** Each loop's song form. The first section is an intro, played only the first time round. */
export const FORMS: Record<string, Section[]> = {
  title: [S("intro", 2, "none", "pedal", "none", { pad: true }), S("theme", 2, "orig", "orig", "light"), S("theme and harmony", 2, "orig", "orig", "orig", { harmony: true }),
    S("away", 2, "retro", "orig", "light", { pad: true, shift: 5 }), S("full", 2, "octave", "walk", "full", { harmony: true, keys: true })],
  town: [S("intro", 1, "none", "pedal", "none", { pad: true }), S("theme", 2, "orig", "orig", "light"), S("theme and harmony", 2, "orig", "walk", "orig", { harmony: true }),
    S("away", 2, "retro", "orig", "light", { pad: true, shift: 5 }), S("breakdown", 2, "sparse", "pedal", "none", { pad: true, keys: true }),
    S("full", 2, "octave", "walk", "full", { harmony: true, keys: true })],
  route: [S("intro", 1, "none", "orig", "light"), S("theme", 2, "orig", "orig", "light"), S("theme and harmony", 2, "orig", "walk", "orig", { harmony: true }),
    S("climb", 2, "climb", "orig", "orig", { shift: -3 }), S("build", 1, "sparse", "pedal", "build"), S("full", 4, "octave", "walk", "full", { harmony: true, keys: true })],
  battle: [S("intro", 1, "none", "pedal", "build"), S("theme", 2, "orig", "orig", "full"), S("theme and harmony", 2, "octave", "walk", "full", { harmony: true }),
    S("climb", 2, "climb", "orig", "orig", { shift: 5 }), S("build", 1, "sparse", "pedal", "build"), S("full", 2, "octave", "walk", "full", { harmony: true, keys: true })],
  keeper: [S("intro", 2, "none", "pedal", "build", { pad: true }), S("theme", 2, "orig", "orig", "full"), S("away", 4, "retro", "walk", "orig", { pad: true, shift: -2 }),
    S("breakdown", 1, "sparse", "pedal", "none", { pad: true }), S("build", 1, "climb", "pedal", "build"), S("full", 2, "octave", "walk", "full", { harmony: true, keys: true, pad: true })],
  sad: [S("intro", 2, "none", "pedal", "none", { pad: true }), S("theme", 2, "sparse", "pedal", "none", { keys: true }), S("theme and pad", 2, "orig", "orig", "none", { pad: true, harmony: true }),
    S("away", 2, "retro", "orig", "light", { pad: true, keys: true, shift: 5 }), S("return", 2, "orig", "walk", "light", { pad: true, harmony: true })],
  ending: [S("intro", 2, "none", "pedal", "none", { pad: true }), S("theme", 2, "orig", "orig", "light", { pad: true }), S("away", 2, "retro", "orig", "light", { pad: true, shift: 5 }),
    S("full", 2, "octave", "walk", "orig", { harmony: true, keys: true }), S("last", 2, "sparse", "pedal", "none", { pad: true })],
};

const SCALE = [0, 2, 4, 5, 7, 9, 11];
export const toMidi = (f: number) => Math.round(69 + 12 * Math.log2(f / 440));
/** Moves a note by scale steps in C major, the key all of Qwen's loops are written in. */
export function degree(midi: number, steps: number): number {
  const pc = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12);
  let i = SCALE.reduce((best, s, k) => (Math.abs(s - pc) < Math.abs(SCALE[best] - pc) ? k : best), 0) + steps;
  const o = oct + Math.floor(i / 7);
  i = ((i % 7) + 7) % 7;
  return o * 12 + SCALE[i];
}

/** The events of one bar of a section, given how many times the song has come round. */
export function barEvents(track: QwenTrack, sec: Section, bar: number, cycle: number): Ev[] {
  const notes = track.patterns[0]?.notes ?? [];
  const out: Ev[] = [];
  const shift = sec.shift ?? 0;
  const lead = notes.filter((n) => n.type === "square" && n.freq).sort((a, b) => a.time - b.time);
  const low = notes.filter((n) => n.type === "triangle" && n.freq).sort((a, b) => a.time - b.time);
  const hits = notes.filter((n) => n.type === "noise").map((n) => n.time);
  // The layers grow each time the song comes round.
  const keys = sec.keys || (cycle >= 1 && sec.melody !== "none" && sec.drums !== "none");
  const harmony = sec.harmony || (cycle >= 2 && sec.melody !== "none");
  const pitches = lead.map((n) => toMidi(n.freq!));
  lead.forEach((n, k) => {
    if (sec.melody === "none" || (sec.melody === "sparse" && n.time % 4 !== 0)) return;
    let m = sec.melody === "retro" ? pitches[pitches.length - 1 - k] : pitches[k];
    if (sec.melody === "octave") m += 12;
    if (sec.melody === "climb") m = degree(m, bar);
    m += shift;
    out.push({ step: n.time, part: "lead", midi: m, dur: n.dur ?? 0.2, vol: n.vol ?? 0.1 });
    if (harmony) out.push({ step: n.time, part: "harmony", midi: degree(m - shift, -2) + shift, dur: n.dur ?? 0.2, vol: (n.vol ?? 0.1) * 0.55 });
  });
  const root = (low[0]?.freq ? toMidi(low[0].freq) : 48) + shift;
  if (sec.bass === "pedal") out.push({ step: 0, part: "bass", midi: root, dur: 1.2, vol: 0.14 });
  else if (sec.bass !== "none") {
    for (const n of low) out.push({ step: n.time, part: "bass", midi: toMidi(n.freq!) + shift, dur: n.dur ?? 0.3, vol: n.vol ?? 0.15 });
    if (sec.bass === "walk") for (const s of [6, 14]) out.push({ step: s, part: "bass", midi: degree(root - shift, s === 6 ? 1 : -1) + shift, dur: 0.15, vol: 0.1 });
  }
  const chord = [0, 2, 4].map((d) => degree(root - shift, d) + shift + 12);
  if (sec.pad) for (const m of chord) out.push({ step: 0, part: "pad", midi: m, dur: 1.6, vol: 0.05 });
  if (keys) for (let s = 0; s < 16; s += 2) out.push({ step: s, part: "keys", midi: [...chord, chord[0] + 12][(s / 2) % 4] + 12, dur: 0.18, vol: 0.04 });
  const last = bar === sec.bars - 1;
  if (sec.drums === "light") out.push({ step: 0, part: "kick", midi: 0, dur: 0.2, vol: 0.2 }, { step: 8, part: "snare", midi: 0, dur: 0.1, vol: 0.12 });
  if (sec.drums === "orig" || sec.drums === "full") {
    for (const s of hits.length ? hits : [0, 8]) out.push({ step: s, part: s % 8 === 0 && s !== 8 ? "kick" : "snare", midi: 0, dur: 0.1, vol: 0.16 });
    out.push({ step: 4, part: "kick", midi: 0, dur: 0.1, vol: 0.14 });
  }
  if (sec.drums === "full") for (let s = 2; s < 16; s += 4) out.push({ step: s, part: "hat", midi: 0, dur: 0.05, vol: 0.1 });
  if (sec.drums === "build") for (let s = 0; s < 16; s += s < 8 ? 2 : 1) out.push({ step: s, part: "snare", midi: 0, dur: 0.08, vol: 0.05 + s * 0.008 });
  // A small fill closes each section with drums.
  if (last && (sec.drums === "orig" || sec.drums === "full")) out.push({ step: 14, part: "snare", midi: 0, dur: 0.08, vol: 0.12 }, { step: 15, part: "snare", midi: 0, dur: 0.08, vol: 0.15 });
  return out;
}

/** The sections in play order for one time round the song: the intro only the first time. */
export function round(form: Section[], cycle: number): Section[] {
  return cycle === 0 ? form : form.slice(1);
}
