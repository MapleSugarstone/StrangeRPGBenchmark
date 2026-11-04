// Ruin's music: Qwen's own seven loops (qwen_tracks.ts), arranged into songs by arranger.ts, on a home-keyboard sound.
// A detuned saw organ takes the square parts, a plucked rubber bass the triangle parts, and a sine kick, band-passed
// snare, and hats the noise parts. The playing is a little loose on purpose: timing slop, uneven velocity, and clumsy
// changes every few passes. Each island moves the loop to its own key and tempo.
import { audioContext, audioMaster, sfxOut, isMuted, MUSIC_LEVEL } from "./ctx.js";
import { QWEN_TRACKS } from "./qwen_tracks.js";
import { FORMS, barEvents, round, type Ev, type Section } from "./arranger.js";

export type TrackId = "title" | "town" | "route" | "battle" | "keeper" | "ending";
export type StingerId = "win" | "catch" | "level" | "lose";
export type SfxId = "menu_move" | "menu_confirm" | "step" | "hit" | "heavy_hit" | "status" | "ko" | "catch" | "level_up" | "door" | "type_blip";

// The last six are the Dregs, lower and slower the deeper they go.
const ISLAND_SHIFT = [0, 2, -3, 5, -2, 3, -5, 7, 1, -4, 4, -1, 6, -7, -6, -9, -4, -10, -8, -12];
const ISLAND_TEMPO = [1, 0.96, 1.04, 0.92, 1.06, 0.98, 1.08, 0.94, 1.02, 0.9, 1.05, 0.97, 1.1, 0.86, 0.9, 0.82, 0.94, 0.8, 0.88, 0.76];

interface Playing { id: TrackId; place: number; variant: number; source: string; tempo: number; shift: number }

let bus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let now: Playing | null = null;
let step = 0, pass = 0, nextTime = 0, intensity = 0, ducked = false;
let timer: ReturnType<typeof setInterval> | null = null;
let seed = 1;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };

function ready(): AudioContext | null {
  const ctx = audioContext(), master = audioMaster();
  if (!ctx || !master) return null;
  if (!bus) { bus = ctx.createGain(); bus.gain.value = MUSIC_LEVEL; bus.connect(master); }
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  }
  return ctx;
}

const semis = (f: number, s: number) => f * Math.pow(2, s / 12);

function env(ctx: AudioContext, t: number, peak: number, attack: number, hold: number, release: number, out: AudioNode): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(out);
  return g;
}

/** The lead: two detuned saws and a soft square an octave down, through a dull filter, with vibrato that comes late. */
function organ(ctx: AudioContext, f: number, t: number, dur: number, vol: number, out: AudioNode): void {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 2100; lp.Q.value = 0.8;
  const g = env(ctx, t, vol, 0.014, Math.max(0.02, dur - 0.04), 0.16, out);
  lp.connect(g);
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = 5.4;
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(7, t + Math.min(0.35, dur));
  lfo.connect(depth);
  for (const [type, ratio, cents, level] of [["sawtooth", 1, -7, 0.5], ["sawtooth", 1, 8, 0.5], ["square", 0.5, 0, 0.18]] as const) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = type; o.frequency.value = f * ratio; o.detune.value = cents;
    depth.connect(o.detune);
    og.gain.value = level;
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + dur + 0.25);
  }
  lfo.start(t); lfo.stop(t + dur + 0.25);
}

/** The bass: a sine that drops into its pitch, with a muffled square under it. */
function bass(ctx: AudioContext, f: number, t: number, dur: number, vol: number, out: AudioNode): void {
  const g = env(ctx, t, vol, 0.006, Math.max(0.03, dur * 0.6), 0.12, out);
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  o.connect(g);
  const sq = ctx.createOscillator(), lp = ctx.createBiquadFilter(), sg = ctx.createGain();
  sq.type = "square"; sq.frequency.value = f;
  lp.type = "lowpass"; lp.frequency.value = 520;
  sg.gain.value = 0.22;
  sq.connect(lp); lp.connect(sg); sg.connect(g);
  for (const x of [o, sq]) { x.start(t); x.stop(t + dur + 0.2); }
}

function drum(ctx: AudioContext, kind: "kick" | "snare" | "hat", t: number, vol: number, out: AudioNode): void {
  if (kind === "kick") {
    const o = ctx.createOscillator(), g = env(ctx, t, vol * 1.4, 0.002, 0.02, 0.16, out);
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(g); o.start(t); o.stop(t + 0.22);
    return;
  }
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
  src.buffer = noise;
  f.type = kind === "hat" ? "highpass" : "bandpass";
  f.frequency.value = kind === "hat" ? 7000 : 1900; f.Q.value = 0.8;
  const g = env(ctx, t, kind === "hat" ? vol * 0.35 : vol, 0.002, 0.01, kind === "hat" ? 0.035 : 0.11, out);
  src.connect(f); f.connect(g);
  src.start(t, rnd() * 0.5); src.stop(t + 0.2);
}

function sourceFor(id: TrackId, variant: number): string {
  if (id === "ending") return variant <= 1 ? "sad" : "ending";
  return id;
}

/** A string pad: three detuned saws through a soft filter, swelling in and fading slowly. */
function pad(ctx: AudioContext, f: number, t: number, dur: number, vol: number, out: AudioNode): void {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1300;
  const g = env(ctx, t, vol, 0.35, Math.max(0.1, dur - 0.35), 0.7, out);
  lp.connect(g);
  for (const cents of [-12, 0, 11]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth"; o.frequency.value = f; o.detune.value = cents;
    o.connect(lp); o.start(t); o.stop(t + dur + 0.8);
  }
}

/** An electric piano: a sine and a faint second partial that die away quickly. */
function piano(ctx: AudioContext, f: number, t: number, dur: number, vol: number, out: AudioNode): void {
  for (const [ratio, level, decay] of [[1, 1, 0.55], [2.003, 0.3, 0.2]] as const) {
    const o = ctx.createOscillator(), g = env(ctx, t, vol * level, 0.003, 0.01, decay + dur * 0.5, out);
    o.type = "sine"; o.frequency.value = f * ratio;
    o.connect(g); o.start(t); o.stop(t + decay + dur + 0.1);
  }
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
let form: Section[] = [], sectionIdx = 0, bar = 0, cycle = 0, barEv: Ev[] = [];

/** The section playing now, for tests and the song's own bookkeeping. */
function section(): Section | undefined {
  return round(form, cycle)[sectionIdx];
}

function playStep(ctx: AudioContext, i: number, t: number): void {
  if (!now || !bus) return;
  const track = QWEN_TRACKS[now.source];
  const sec = section();
  if (!track || !sec) return;
  if (i === 0) barEv = barEvents(track, sec, bar, cycle);
  for (const e of barEv) {
    if (e.step !== i) continue;
    const jitter = (rnd() - 0.5) * 0.018, vel = 0.85 + rnd() * 0.3;
    const at = Math.max(t, t + jitter), vol = e.vol * vel, f = hz(e.midi + now.shift);
    if (e.part === "kick" || e.part === "snare" || e.part === "hat") drum(ctx, e.part, at, vol * 3, bus);
    else if (e.part === "bass") bass(ctx, f, at, e.dur, vol * 2.2, bus);
    else if (e.part === "pad") pad(ctx, f, at, e.dur, vol, bus);
    else if (e.part === "keys") piano(ctx, f, at, e.dur, vol * 2, bus);
    else {
      organ(ctx, f, at, e.dur, vol * (e.part === "harmony" ? 1.2 : 1.7), bus);
      if (e.part === "lead" && intensity >= 0.75) organ(ctx, f * 2, at + 0.01, e.dur, vol * 0.5, bus);
    }
  }
  if (intensity >= 0.4 && i % 2 === 1) drum(ctx, "hat", t, 0.08, bus);
}

/** Moves to the next bar, the next section, and the next time round the song. */
function nextBar(): void {
  const sec = section();
  if (!sec) return;
  if (++bar < sec.bars) return;
  bar = 0;
  if (++sectionIdx < round(form, cycle).length) return;
  sectionIdx = 0;
  cycle++;
}

function stepLen(): number {
  const track = now ? QWEN_TRACKS[now.source] : null;
  return 60 / ((track?.tempo ?? 100) * (now?.tempo ?? 1)) / 4;
}

function tick(): void {
  const ctx = ready();
  if (!ctx || !now) return;
  const ahead = typeof document !== "undefined" && document.hidden ? 1.5 : 0.15;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + ahead) {
    playStep(ctx, step, nextTime);
    // A slight drag on every bar's first beat, as a person counting in would.
    nextTime += stepLen() * (step === 15 ? 1.04 : 1);
    step = (step + 1) % 16;
    if (step === 0) { pass++; nextBar(); }
  }
}

function setBus(level: number, over: number, delay = 0): void {
  const ctx = ready();
  if (!ctx || !bus) return;
  const t = ctx.currentTime + delay;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(isMuted() ? 0 : level, t + Math.max(0.01, over));
}

export const toybox = {
  /** Plays a track for an island and variant; asking again for what plays already does nothing. */
  play(id: TrackId, opts: { place?: number; variant?: number; fade?: number; delay?: number } = {}): void {
    const place = Math.max(0, Math.min(ISLAND_SHIFT.length - 1, opts.place ?? 0)), variant = opts.variant ?? 0;
    if (now && now.id === id && now.place === place && now.variant === variant) return;
    const ctx = ready();
    now = { id, place, variant, source: sourceFor(id, variant), shift: ISLAND_SHIFT[place],
      tempo: ISLAND_TEMPO[place] * (id === "battle" && variant === 1 ? 1.04 : 1) * (id === "ending" && (variant === 1 || variant === 2) ? 0.9 : 1) };
    step = 0; pass = 0; seed = place * 97 + variant * 13 + id.length;
    form = FORMS[now.source] ?? FORMS.town; sectionIdx = 0; bar = 0; cycle = 0;
    if (ctx) {
      nextTime = ctx.currentTime + (opts.delay ?? 0) + 0.05;
      setBus(0, 0.01);
      setBus(ducked ? MUSIC_LEVEL * 0.45 : MUSIC_LEVEL, opts.fade ?? 0.8, opts.delay ?? 0);
    }
    if (!timer) timer = setInterval(tick, 25);
  },
  stop(fade = 1): void {
    setBus(0, fade);
    now = null;
  },
  setIntensity(x: number): void {
    intensity = Math.max(0, Math.min(1, x));
  },
  duck(on: boolean): void {
    if (on === ducked) return;
    ducked = on;
    if (now) setBus(on ? MUSIC_LEVEL * 0.45 : MUSIC_LEVEL, 0.3);
  },
  /** A short phrase on the organ, keyed to the island; returns how long it lasts in seconds. */
  stinger(id: StingerId, opts: { place?: number; delay?: number } = {}): number {
    const ctx = ready(), out = sfxOut();
    const phrase = { win: [0, 4, 7, 12], catch: [7, 12, 16, 19], level: [0, 2, 4, 5, 7, 12], lose: [7, 5, 3, 0] }[id];
    const len = id === "lose" ? 0.2 : 0.11;
    if (ctx && out && !isMuted()) {
      const t0 = ctx.currentTime + (opts.delay ?? 0);
      phrase.forEach((s, k) => organ(ctx, semis(523.25, s + ISLAND_SHIFT[opts.place ?? 0]), t0 + k * len, len * 1.6, 0.16, out));
    }
    return phrase.length * len + 0.3;
  },
  /** Qwen's original effects, played through the same sound set. */
  sfx(name: SfxId, pitch = 0): void {
    const ctx = ready(), out = sfxOut();
    if (!ctx || !out || isMuted()) return;
    const t = ctx.currentTime;
    const tone = (f: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) => {
      const o = ctx.createOscillator(), g = env(ctx, t, vol, 0.004, dur * 0.5, dur * 0.5, out);
      o.type = type;
      o.frequency.setValueAtTime(semis(f, pitch), t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(semis(slideTo, pitch), t + dur);
      o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    };
    const table: Record<SfxId, () => void> = {
      menu_move: () => tone(200, 0.05, "square", 0.1),
      menu_confirm: () => tone(400, 0.1, "square", 0.15),
      step: () => drum(ctx, "hat", t, 0.1, out),
      hit: () => tone(100, 0.1, "sawtooth", 0.2),
      heavy_hit: () => tone(60, 0.2, "triangle", 0.3),
      status: () => tone(300, 0.15, "square", 0.1, 100),
      ko: () => tone(150, 0.3, "triangle", 0.3, 60),
      catch: () => tone(500, 0.1, "square", 0.15, 800),
      level_up: () => tone(600, 0.2, "square", 0.2, 900),
      door: () => tone(150, 0.15, "triangle", 0.1),
      type_blip: () => tone(800, 0.03, "square", 0.05),
    };
    table[name]?.();
  },
  /** What plays now, for tests. */
  current(): { id: TrackId; place: number; variant: number; source: string; section: string } | null {
    return now ? { id: now.id, place: now.place, variant: now.variant, source: now.source, section: section()?.name ?? "" } : null;
  },
};
