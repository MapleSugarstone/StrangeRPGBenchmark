// Talking voices: every speaker reads a line aloud letter by letter in a made-up voice, in step with the dialogue box and in tune with the music.
import { isTonal, Mouth, vowelOf, type Letter, type Quirk, type Source, type TalkVoice } from '../engine/speech';
import { music, type Harmony } from '../engine/music';
import { SPECIES } from '../data/species';
import { kindNamed, speciesCry } from './cries';

export type { TalkVoice } from '../engine/speech';

const v = (f: number, size: number, src: Source, rate: number, steps: number[], quirk: Quirk = 'none', more: Partial<TalkVoice> = {}): TalkVoice =>
  ({ f, size, src, rate, steps, quirk, ...more });

// Formal speakers sit on narrow steps and speak slower. Casual ones bounce over wide steps. Weird ones get the odd intervals and quirks.
const FORMAL = [0, 2, 3, 5];
const CASUAL = [0, 2, 4, 7, 9];
const BOUNCY = [0, 2, 4, 7, 9, 12];

/** Voices for named speakers: pitch, size, source, letters a second, word steps, and quirk. Anyone missing gets a voice picked from their name. */
export const VOICES: Record<string, TalkVoice> = {
  // Main cast.
  'Tack': v(413, 1.3, 'reedy', 46, BOUNCY, 'chirp'),
  'Strandmonger': v(119, 0.76, 'buzzy', 36, [0, 1, 3, 5, 8], 'coin', { vib: [5, 34] }),
  'Purchase': v(208, 0.98, 'buzzy', 40, [0, 1, 3, 5, 8, 10], 'coin', { vib: [6, 45] }),
  'Bare': v(262, 1.1, 'breathy', 32, [0, 2, 4, 5]),
  'Gran': v(238, 1.3, 'reedy', 30, FORMAL, 'tremble'),
  'Small Gran': v(622, 1.55, 'breathy', 44, CASUAL, 'chirp'),
  'Cinch': v(131, 0.92, 'breathy', 31, [0, 2, 5, 7], 'glide', { vib: [4, 24] }),
  'Hermit': v(175, 1.05, 'buzzy', 38, [0, 2, 3, 5, 7], 'crack'),
  'Tellin': v(349, 1.25, 'reedy', 48, CASUAL),
  'Murex': v(165, 1.05, 'breathy', 32, [0, 3, 5, 7], 'glide'),
  // Staykeepers and the Hands.
  'Knuckle': v(104, 0.8, 'buzzy', 34, [0, 3, 5]),
  'Leeward': v(294, 1.05, 'breathy', 36, [0, 2, 4, 6, 8], 'gust'),
  'Verger': v(311, 1, 'breathy', 30, [0, 2, 4, 7], 'bell'),
  'Ringer': v(415, 1.2, 'buzzy', 42, [0, 2, 4]),
  'Grafton': v(156, 0.95, 'buzzy', 36, [0, 2, 4, 5, 7], 'twin'),
  'Ohm': v(175, 1, 'reedy', 34, [0, 0, 0, 7], 'hum'),
  'Old Amber': v(139, 0.95, 'breathy', 28, FORMAL, 'tremble'),
  'Young Amber': v(208, 1.08, 'breathy', 36, FORMAL),
  'Quillon': v(233, 1, 'reedy', 38, [0, 4, 7]),
  'Perihel': v(370, 1.15, 'breathy', 33, [0, 1, 6, 11, 13], 'glide', { vib: [5, 40] }),
  'Fid': v(370, 0.74, 'buzzy', 38, [0, 2, 4, 5, 7]),
  'Lug': v(117, 0.82, 'breathy', 28, [0, 1, 3, 4], 'none', { vib: [3, 50] }),
  'Hasp': v(523, 1.35, 'buzzy', 46, [0, 3, 6, 9], 'flutter'),
  // The Strand.
  'The Sifter': v(196, 1, 'breathy', 36, [0, 2, 3, 5, 7], 'sift'),
  'Gloss': v(175, 0.95, 'reedy', 36, [0, 4, 7, 12], 'echo'),
  'Turnwise': v(220, 1.05, 'breathy', 40, [0, 2, 4, 7], 'pant'),
  'Siphon': v(156, 0.9, 'buzzy', 34, [0, 2, 4, 5, 7]),
  'Tide-reader': v(208, 1.05, 'breathy', 34, [0, 2, 3, 5, 7, 8], 'drip'),
  'Mudlark': v(147, 1.25, 'reedy', 42, [0, 3, 5, 6], 'bubble'),
  'Bottle girl': v(554, 1.45, 'breathy', 38, [0, 2, 5, 7, 9], 'bottle'),
  'Eldest': v(247, 0.95, 'breathy', 28, [0, 2, 4], 'glide'),
  'The Master': v(131, 0.85, 'breathy', 30, [0, 2, 3]),
  // Shopkeepers, guides, and others with a name.
  'Shellwright': v(277, 1.05, 'reedy', 38, [0, 2, 4, 7]),
  'Conjoiner': v(233, 1, 'buzzy', 38, [0, 2, 4, 5]),
  'Counter': v(311, 1.1, 'reedy', 40, CASUAL, 'glide'),
  'Letter': v(952, 1, 'breathy', 44, [0, 2, 4, 7], 'quill'),
  'Man at the well': v(175, 0.95, 'breathy', 34, [0, 2, 4, 7], 'drip'),
  'Ice-fisher': v(131, 0.9, 'breathy', 28, [0, 2, 3]),
  'The Upright Man': v(156, 0.85, 'buzzy', 34, [0, 2, 4, 5, 9]),
  'Label-reader': v(329, 1.15, 'reedy', 40, [0, 2, 4, 7]),
  'Tooth-sitter': v(277, 1.2, 'reedy', 42, [0, 1, 3], 'chirp'),
  'The Pruner': v(247, 1, 'buzzy', 38, [0, 2, 5, 7]),
  'The Listener': v(208, 1, 'breathy', 30, [0, 2, 4]),
  'The Catcher': v(349, 1.25, 'reedy', 44, [0, 4, 7, 12], 'chirp'),
  'Stackkeeper': v(185, 0.9, 'reedy', 34, [0, 4, 7]),
  'Point-watcher': v(220, 1, 'breathy', 34, FORMAL, 'none', { vib: [5, 20] }),
  'Lunch-bringer': v(392, 1.25, 'reedy', 44, CASUAL, 'chirp'),
  'Ring polisher': v(466, 1.2, 'breathy', 38, [0, 4, 7, 12], 'bell'),
  'A goat': v(262, 0.9, 'buzzy', 30, [0, 1, 2], 'wobble'),
  // Setting: the gem setter in Rib and the geode-cracker in Hum.
  'Bezel': v(330, 1.12, 'reedy', 38, [0, 2, 3, 5, 7], 'flutter'),
  'Druse': v(139, 0.88, 'buzzy', 30, [0, 3, 5, 10], 'echo'),
};

/** The Holdfast speaks under Cinch's name in capitals: a low, large buzzing drone. */
const HOLDFAST = v(78, 0.7, 'buzzy', 30, [0, 1, 2], 'buzz', { trim: -4.5 });

/**
 * Loudness trims in decibels that bring every named voice to the same level, measured over its sample lines with
 * `FEEL.voiceLevels` on the sound test page. Voices picked from a name or a kind land within a decibel untrimmed.
 */
const TRIM: Record<string, number> = {
  'Tack': 2.5, 'Bare': -2, 'Gran': -0.5, 'Small Gran': 0.5, 'Cinch': -1.5, 'Tellin': 1.5, 'Murex': -1.5,
  'Leeward': -1, 'Verger': -1, 'Ringer': 0.5, 'Grafton': 2, 'Ohm': -1.5, 'Old Amber': -1.5, 'Fid': 1.5, 'Lug': -1,
  'Hasp': 1.5, 'The Sifter': -1, 'Gloss': -1.5, 'Siphon': -1, 'Tide-reader': -0.5, 'Bottle girl': -0.5, 'Eldest': -1.5,
  'The Master': -1, 'Counter': 0.5, 'Letter': 1, 'Man at the well': -0.5, 'Ice-fisher': -0.5, 'The Upright Man': -1,
  'Label-reader': 0.5, 'The Pruner': 0.5, 'The Listener': -1.5, 'The Catcher': 1, 'Stackkeeper': -0.5, 'Point-watcher': -0.5,
  'Lunch-bringer': 0.5, 'Ring polisher': 0.5,
};
for (const [who, t] of Object.entries(TRIM)) VOICES[who].trim = t;

/** A whorl that talks takes its source and quirk from its first type. */
const TYPE_SRC: Record<string, Source> = { TIDE: 'breathy', STAR: 'breathy', GEAR: 'reedy', ROOT: 'reedy', BEAST: 'buzzy', STONE: 'buzzy', SALT: 'reedy', VOID: 'breathy' };
const TYPE_QUIRK: Record<string, Quirk> = { TIDE: 'bubble', STAR: 'bell', GEAR: 'hum', ROOT: 'none', BEAST: 'wobble', STONE: 'none', SALT: 'sift', VOID: 'glide' };

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Words in a speaker's name that say how high or large the voice is. */
const HIGH = /\b(child|girl|boy|kid|small)\b/i, LOW = /\b(old|very old|elder|guard)\b/i, MID_HIGH = /\b(woman|wife|girl)\b/i, MID_LOW = /\b(man|smith|bosun|gunner)\b/i;
const OFFICIAL = /keeper|boardmaster|clerk|reeve|cartographer|hall|sexton/i;

/** A voice picked from a name, so the same name always sounds the same. */
function voiceFromName(name: string): TalkVoice {
  const h = hashStr(name), r = (k: number) => ((h >>> (k * 3)) & 7) / 7;
  let f = 206 * Math.pow(2, (r(0) - 0.5) * 0.6), size = 0.94 + r(1) * 0.14;
  if (HIGH.test(name)) { f *= 1.7; size = 1.45; } else if (MID_HIGH.test(name)) { f *= 1.3; size = 1.18; } else if (LOW.test(name)) { f *= 0.72; size = 0.9; } else if (MID_LOW.test(name)) { f *= 0.82; size = 0.9; }
  const formal = OFFICIAL.test(name);
  const srcs: Source[] = ['breathy', 'reedy', 'buzzy', 'breathy'];
  const quirks: Quirk[] = formal ? ['none', 'none', 'tremble', 'echo'] : ['none', 'none', 'chirp', 'glide', 'none', 'wobble', 'drip', 'none'];
  const quirk = LOW.test(name) && !formal ? 'tremble' : quirks[(h >>> 7) % quirks.length];
  const steps = formal ? FORMAL : [CASUAL, BOUNCY, [0, 2, 3, 7, 9], [0, 3, 5, 7, 10]][(h >>> 11) % 4];
  const rate = formal ? 32 : LOW.test(name) ? 29 : 34 + ((h >>> 13) % 4) * 3;
  return v(Math.round(f), Math.round(size * 100) / 100, srcs[h % 4], rate, steps, quirk);
}

/** A whorl that talks speaks four semitones under its cry's pitch, larger when its sprite is more solid. */
function whorlVoice(kind: string): TalkVoice | null {
  const c = speciesCry(kind), sp = SPECIES[kind];
  if (!c || !sp) return null;
  const t = sp.types[0];
  return v(Math.round(c.f[0] * 0.794), Math.round((1.35 - c.mass * 0.5) * 100) / 100, TYPE_SRC[t] || 'reedy', 36 - Math.round(c.mass * 6), [0, 2, 3, 7, 8], TYPE_QUIRK[t] || 'none');
}

const cache = new Map<string, TalkVoice | null>();

/** The voice for a speaker and line, or null for narration. A line in capitals from Cinch is the Holdfast. */
export function voiceFor(speaker: string | null, line = ''): TalkVoice | null {
  if (!speaker) return null;
  if (speaker === 'Cinch' && /[A-Z]{4}/.test(line) && line === line.toUpperCase()) return HOLDFAST;
  let vo = cache.get(speaker);
  if (vo === undefined) {
    const k = kindNamed(speaker);
    vo = VOICES[speaker] || (k ? whorlVoice(k) : null) || voiceFromName(speaker);
    cache.set(speaker, vo);
  }
  return vo;
}

// ---------------------------------------------------------------- tuning

/** The notes speech may land on: every pitch class of the scale, and the ones a stressed word prefers. */
export interface Tuning { scale: number[]; tones: number[]; root: number }

/** With no music playing, speech sings in C major pentatonic, which has no clashing pair of notes. */
const DEFAULT_TUNING: Tuning = { scale: [0, 2, 4, 7, 9], tones: [0, 4, 7], root: 0 };

/** The tuning of the music playing now. Stressed words prefer the notes sounding now, filled out with the root, its fifth, and its third. */
export function tuningOf(h: Harmony | null): Tuning {
  if (!h || !h.scale.length) return DEFAULT_TUNING;
  const tones = h.chord.slice();
  for (const iv of [0, 7, 4, 3]) {
    const p = (h.root + iv) % 12;
    if (tones.length >= 3) break;
    if (h.scale.includes(p) && !tones.includes(p)) tones.push(p);
  }
  return { scale: h.scale, tones: tones.length ? tones : [h.root], root: h.root };
}

const pcOf = (m: number): number => ((Math.round(m) % 12) + 12) % 12;

/** The nearest MIDI note to `m` within `reach` semitones whose pitch class is in `pcs`, or null. `dir` keeps it above (1) or below (-1) `from`. */
function nearest(m: number, pcs: number[], reach: number, dir = 0, from = m): number | null {
  let best: number | null = null, bd = Infinity;
  for (let c = Math.floor(m - reach); c <= Math.ceil(m + reach); c++) {
    if (!pcs.includes(pcOf(c))) continue;
    if (dir > 0 && c <= from) continue;
    if (dir < 0 && c >= from) continue;
    const d = Math.abs(c - m);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** The note a word lands on: a chord tone for a stressed word when one is near, otherwise the nearest note of the scale. */
function landOn(m: number, tune: Tuning, stress: boolean): number {
  return (stress ? nearest(m, tune.tones, 3) : null) ?? nearest(m, tune.scale, 3) ?? Math.round(m);
}

/** The note a sentence's last word moves to: a rise to a chord tone above, or a fall that comes home to the root when it can. */
function moveTo(from: number, lift: number, tune: Tuning): number {
  const dir = Math.sign(lift), m = from + lift;
  if (dir < 0) {
    const home = nearest(m, [tune.root], 5, -1, from);
    if (home !== null && from - home <= 7) return home;
  }
  return nearest(m, tune.tones, 3, dir, from) ?? nearest(m, tune.scale, 3, dir, from) ?? Math.round(m);
}

// ---------------------------------------------------------------- reading a page aloud

/**
 * A letter as planned, before it is tuned. `semi` is where its word aims, `lift` is how far the word moves by its end,
 * `u` is the letter's place among the word's voiced letters (0 to 1), and `solo` marks a word with one voiced letter.
 */
export interface Planned extends Letter { word: number; lift: number; u: number; solo: boolean; stress: boolean }

/** One character of a page as the box shows it: when it appears, in seconds from the start of the page, and the letter it speaks. */
export interface Beat { at: number; say: Planned | null }

const WORD_CH = /[A-Za-z0-9']/;

/**
 * Times every character of a page at the voice's pace and plans each word's pitch. A word aims at one of the voice's
 * steps and later lands on a note of the scale. A question's last word rises to a higher note, a statement's falls toward
 * the root, an exclamation's jumps up, and a trailing "..." sinks and fades. Spaces leave a short gap, and commas and
 * sentence ends a longer one.
 */
export function planPage(vo: TalkVoice, lines: string[]): Beat[] {
  const full = lines.join(' ');
  // The box counts characters with the line breaks left out, so the space that joins two lines here is never shown.
  const joint = new Set<number>();
  let n = 0;
  for (let k = 0; k < lines.length - 1; k++) { n += lines[k].length; joint.add(n); n++; }
  const say: (Planned | null)[] = new Array(full.length).fill(null);
  const words = [...full.matchAll(/[A-Za-z0-9']+/g)];
  let sentenceStart = 0, count = 0, prevStep = NaN;
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi][0], start = words[wi].index!;
    const gap = full.slice(start + word.length, words[wi + 1]?.index ?? full.length);
    const m = gap.match(/\.\.\.|[.?!]/);
    const end = (m ? m[0] : wi === words.length - 1 ? '.' : '') as Letter['end'];
    const comma = !end && /[,;:]/.test(gap);
    const caps = /[A-Z]{2}/.test(word) && word === word.toUpperCase();
    const proper = !caps && /^[A-Z]/.test(word) && wi !== sentenceStart;
    const bang = /^[^.?!]*!/.test(full.slice(start));
    let si = hashStr(word.toLowerCase()) % vo.steps.length;
    if (vo.steps.length > 1 && vo.steps[si] === prevStep) si = (si + 1) % vo.steps.length;
    prevStep = vo.steps[si];
    let base = vo.steps[si] - Math.min(2, (wi - sentenceStart) * 0.18), lift = 0, vol = 1, stretch = 1;
    if (caps) { base += 2; vol = 1.2; stretch = 1.25; }
    if (proper) base += 1;
    if (bang && wi === sentenceStart) base += 2;
    if (end === '?') lift = 5;
    else if (end === '!') { base += 4; vol *= 1.2; }
    else if (end === '...') { lift = -4; vol *= 0.75; stretch *= 1.25; }
    else if (end === '.') lift = -3;
    else if (comma) lift = 2;
    const stress = caps || proper || !!end || wi === sentenceStart || word.length >= 6;
    const idx: number[] = [];
    for (let i = 0; i < word.length; i++) if (word[i] !== "'") idx.push(i);
    const tones = idx.filter(i => isTonal(word[i].toLowerCase()));
    const tailI = tones.length ? tones[tones.length - 1] : idx[idx.length - 1];
    let seen = -1;
    for (const i of idx) {
      const ch = word[i].toLowerCase(), tonal = isTonal(ch);
      if (tonal) seen++;
      const u = tones.length > 1 ? Math.max(0, seen) / (tones.length - 1) : 1;
      let next = '';
      for (let j = i + 1; j < word.length && !next; j++) next = vowelOf(word[j].toLowerCase());
      say[start + i] = {
        ch, semi: base, slide: 0, scoop: tonal && seen === 0 ? 1 : 0, legato: tonal && seen > 0, vol: end === '.' ? vol * (1 - 0.15 * u) : vol, stretch,
        next, tail: i === tailI, end: i === tailI ? end : '', n: count++, word: wi, lift, u, solo: tones.length === 1, stress,
      };
    }
    if (end) sentenceStart = wi + 1;
  }
  const gapT = 1 / vo.rate;
  /** Seconds from character k - 1 appearing to character k appearing. */
  const delay = (k: number): number => {
    const p = full[k - 1], c = full[k];
    if (WORD_CH.test(p)) return WORD_CH.test(c) ? gapT * (say[k - 1]?.stretch ?? 1) : gapT * 0.5;
    if (p === ' ') return gapT;
    if (c !== ' ' && !WORD_CH.test(c)) return p === '.' && c === '.' ? gapT * 2 : gapT * 0.4;
    let run = '';
    for (let j = k - 1; j >= 0 && full[j] !== ' ' && !WORD_CH.test(full[j]); j--) run = full[j] + run;
    if (run.includes('...')) return gapT * 6;
    if (/[.?!]/.test(run)) return gapT * 7;
    if (/[,;:]/.test(run) || (/[-—]/.test(run) && c === ' ')) return gapT * 3;
    return gapT * 0.5;
  };
  const beats: Beat[] = [];
  let t = 0;
  for (let k = 0; k < full.length; k++) {
    if (k > 0) t += delay(k);
    if (!joint.has(k)) beats.push({ at: t, say: say[k] });
  }
  return beats;
}

const FRAME = 1 / 60;
/** Most letters one frame may play. A frame that reveals more came late, and the earlier letters are dropped. */
const PER_FRAME = 2;

/** Types a page out at its speaker's pace and speaks each letter as it appears. Narration types two characters a frame in silence. */
export class Babble {
  readonly voice: TalkVoice | null;
  private beats: Beat[] = [];
  private mouth: Mouth | null = null;
  private t = 0;
  private shown = 0;
  private total: number;
  /** The word being sung, and the notes it starts on and moves to, as MIDI numbers. */
  private word = -1;
  private from = 0;
  private to = 0;
  /** The tuning to sing in. Unset, it follows the music playing now. */
  tune: Tuning | null = null;
  /** When set, every letter played is noted here with its time, for auditions and tests. */
  trace: { at: number; ch: string; semi: number }[] | null = null;

  constructor(speaker: string | null, lines: string[]) {
    this.total = lines.join('').length;
    this.voice = voiceFor(speaker, lines.join(' '));
    if (this.voice) { this.beats = planPage(this.voice, lines); this.mouth = new Mouth(this.voice); }
  }

  /** Advances one frame and returns how many characters show. Rushed text shows the whole page and speaks one vowel. `at` delays the sound, for auditions. */
  step(hurry: boolean, at = 0): number {
    if (this.shown >= this.total) return this.total;
    const from = this.shown;
    if (!this.voice) { this.shown = Math.min(this.total, this.shown + (hurry ? 99 : 2)); return this.shown; }
    if (hurry) {
      this.shown = this.total;
      const b = from === 0 ? this.beats.find(x => x.say && vowelOf(x.say.ch)) : undefined;
      if (b) this.play(b.say!, at);
      return this.shown;
    }
    const t0 = this.t;
    this.t += FRAME;
    while (this.shown < this.total && this.beats[this.shown].at <= this.t + 1e-9) this.shown++;
    const fresh = this.beats.slice(from, this.shown).filter(b => b.say).slice(-PER_FRAME);
    for (const b of fresh) this.play(b.say!, at + Math.max(0, b.at - t0));
    return this.shown;
  }

  /** Tunes a planned letter: its word lands on a note of the scale when the word starts, and moves to a second note if the word lifts or falls. */
  private play(p: Planned, at: number): void {
    const vo = this.voice!, base = 69 + 12 * Math.log2(vo.f / 440);
    if (p.word !== this.word) {
      const tune = this.tune ?? tuningOf(music.harmony());
      this.word = p.word;
      this.from = landOn(base + p.semi, tune, p.stress);
      this.to = p.lift ? moveTo(this.from, p.lift, tune) : this.from;
    }
    const moved = this.to - this.from;
    const note = p.solo || p.u < 0.5 ? this.from : this.to;
    const l: Letter = { ...p, semi: note - base, slide: p.solo && p.tail ? moved : 0 };
    if (this.mouth!.say(l, at)) this.trace?.push({ at, ch: l.ch, semi: Math.round(l.semi * 10) / 10 });
  }

  /** Shows the rest of the page and silences the voice at once, when the reader skips ahead. */
  stop(): void { this.shown = this.total; this.mouth?.hush(); }

  get done(): boolean { return this.shown >= this.total; }
}

/** Schedules a whole page the way the dialogue box types it, for auditions. Returns its length in seconds. */
export function speakPage(speaker: string | null, lines: string[], at0 = 0, trace?: { at: number; ch: string; semi: number }[], tune?: Tuning): number {
  const b = new Babble(speaker, lines);
  if (trace) b.trace = trace;
  if (tune) b.tune = tune;
  let k = 0;
  for (; !b.done && k < 3600; k++) b.step(false, at0 + k * FRAME);
  return k * FRAME + 0.1;
}

/** Splits a line into rows of about the dialogue box's width, for auditions outside the game. */
export function roughWrap(s: string, chars = 30): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    if (line && (line + ' ' + w).length > chars) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
}
