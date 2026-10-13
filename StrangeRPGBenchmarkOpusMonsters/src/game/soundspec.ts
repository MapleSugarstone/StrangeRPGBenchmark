// A move's sound in battle as a one-line spec in three parts that line up with its picture, and the sound a move without
// one gets from its picture and type. This file is plain data and parsing, so the content tests can check every spec
// without a browser. Notes/move-sounds.md is the reference for writing specs.
import type { MoveDef } from '../battle/registry';
import type { Type } from '../data/types';
import type { FxPlan } from './fxspec';
import { SOUNDS1 } from '../data/sounds1';
import { SOUNDS2 } from '../data/sounds2';
import { SOUNDS3 } from '../data/sounds3';
import { SOUNDS4 } from '../data/sounds4';
import { SOUNDS5 } from '../data/sounds5';
import { SOUNDS6 } from '../data/sounds6';
import { SOUNDS7 } from '../data/sounds7';
import { SOUNDS8 } from '../data/sounds8';

/** A move's sound: one spec for every picture it draws, or one for its plain picture and one for each of its options. */
export type SoundEntry = string | { fx?: string; opts: string[] };

/** What a sound is made of. A sound word without a material takes the move type's material. */
export const MATERIALS: Record<string, string> = {
  shell: 'a hollow shell: bright clicks and a short hollow ring',
  stone: 'stone: low, gritty, and dead, with almost no ring',
  sand: 'sand and grit: soft noise with a fine grain',
  water: 'water: round wobbling tones and bubbles',
  ice: 'ice: high and brittle, with a crisp glassy ring',
  salt: 'salt crystals: a bright crackle over a thin reedy tone',
  root: 'wood and root: a warm hollow knock and creaks',
  gear: 'clockwork metal: a ringing clang, buzz, and ticks',
  bone: 'bone and tooth: dry hard clacks with a short ring',
  fur: 'fur and down: muffled, soft, and low',
  glass: 'glass: a pure bright ring that lasts',
  star: 'star glass: a high bell that trembles, with glints',
  void: 'the void: a low hollow tone beating against its twin',
  air: 'moving air: breath, wind, and whistles',
  ember: 'embers: warm crackling noise',
};

/** The sound words. A strike plays once at its moment, and a hold fills its part. `pitched` sounds take a note. */
export const ACTIONS: Record<string, { hold: boolean; pitched: boolean; text: string }> = {
  thud: { hold: false, pitched: false, text: 'a dull heavy blow' },
  knock: { hold: false, pitched: true, text: 'a hollow rap' },
  crack: { hold: false, pitched: false, text: 'a sharp break with a rough tail' },
  snap: { hold: false, pitched: false, text: 'a tiny sharp click' },
  crunch: { hold: false, pitched: false, text: 'a quick cluster of small breaks, as teeth on a shell' },
  shatter: { hold: false, pitched: false, text: 'a break that scatters into falling bits' },
  chime: { hold: false, pitched: true, text: 'a struck note with bright partials' },
  toll: { hold: false, pitched: true, text: 'a deep bell stroke that rings on' },
  pluck: { hold: false, pitched: true, text: 'a plucked string or stem' },
  gulp: { hold: false, pitched: true, text: 'a bubble or plop that rises in pitch' },
  pop: { hold: false, pitched: true, text: 'a short round burst that falls in pitch' },
  splash: { hold: false, pitched: false, text: 'a wet burst with drops after it' },
  boom: { hold: false, pitched: false, text: 'a very low thump with a rolling tail' },
  chirp: { hold: false, pitched: true, text: 'a quick rising call' },
  zap: { hold: false, pitched: false, text: 'a fast falling buzz, as a spark jumps' },
  ring: { hold: true, pitched: true, text: 'a struck bowl that rings through its part and beats slowly' },
  hiss: { hold: true, pitched: false, text: 'steady noise, as steam or pouring sand' },
  whoosh: { hold: true, pitched: false, text: 'rushing air that swells and passes' },
  whistle: { hold: true, pitched: true, text: 'a thin tone that glides down as it passes' },
  hum: { hold: true, pitched: true, text: 'a steady tone with a slow wobble' },
  buzz: { hold: true, pitched: true, text: 'a harsh rough tone' },
  pipe: { hold: true, pitched: true, text: 'a breathy organ pipe note' },
  rattle: { hold: true, pitched: false, text: 'quick clicks, as pebbles in a shell or a ratchet' },
  scrape: { hold: true, pitched: false, text: 'rough grating noise' },
  rumble: { hold: true, pitched: false, text: 'low rolling noise' },
  crackle: { hold: true, pitched: false, text: 'scattered tiny crackles, as embers or frost' },
  fizz: { hold: true, pitched: false, text: 'many tiny high bubbles' },
  rustle: { hold: true, pitched: false, text: 'soft uneven brushing, as leaves or feathers' },
  swell: { hold: true, pitched: true, text: 'a tone that rises and grows until its part ends' },
  creak: { hold: true, pitched: true, text: 'a slow rough groan, as old wood or ice' },
  howl: { hold: true, pitched: true, text: 'a cry that rises and falls' },
  growl: { hold: true, pitched: true, text: 'a low rough snarl' },
  warble: { hold: true, pitched: true, text: 'a tone with a fast deep wobble' },
  drip: { hold: true, pitched: false, text: 'drops falling one by one' },
  gurgle: { hold: true, pitched: false, text: 'low bubbling' },
};

/** Words that change the sound word before them. A note such as `e5`, `f#4`, or `bb3` sets a pitched sound to that note. */
export const MODIFIERS: Record<string, string> = {
  high: 'seven semitones higher',
  low: 'seven semitones lower',
  short: 'shorter',
  long: 'longer',
  soft: 'quieter and gentler',
  hard: 'louder and sharper',
  rise: 'glides up',
  fall: 'glides down',
  wide: 'doubled and spread left and right',
  x2: 'plays twice across its part',
  x3: 'plays three times across its part',
  x4: 'plays four times across its part',
};

/**
 * Each legendary kind's motif, named by the kind's id: a short tune in its own sound that every one of its moves plays.
 * A spec with a motif is a legendary's: it plays above the music and ducks it briefly, rings on through an echo, runs
 * longer, and may hold five sounds in a part.
 */
export const MOTIFS: Record<string, string> = {
  full: 'four star-glass bells climbing, as a tide the moon draws up',
  mundane: 'two low heartbeats and a shell ringing over them',
  knot: 'three ratchet clicks tightening, then a key turning home',
  holm: 'two long low horn notes falling a fourth, over the sea',
  carcanet: 'four gems chiming up a chord: pearl, amber, beach glass, star glass',
  gleaner: 'a low hollow hum that leans up a third, and a far thin whistle',
};

/** The material a sound takes from the move's type when it names none. */
export const TYPE_MATERIAL: Record<Type, string> = { STONE: 'stone', TIDE: 'water', ROOT: 'root', GEAR: 'gear', BEAST: 'bone', STAR: 'star', SALT: 'salt', VOID: 'void' };

/** One sound word as read: its material (null takes the type's), what it does, and how its modifiers change it. */
export interface SoundLayer {
  mat: string | null;
  /** The sound word, or 'motif' for a legendary's motif. */
  act: string;
  /** The legendary whose motif this word plays, or null. */
  motif: string | null;
  /** Semitones up or down from `high` and `low`. */
  shift: number;
  /** A note's pitch in Hz, or null. */
  note: number | null;
  len: number;
  vol: number;
  /** 1 glides up, -1 glides down. */
  bend: number;
  wide: boolean;
  /** How many times it plays across its part. */
  n: number;
}

/** A spec as read: the sounds of each part, and the legendary whose motif it plays, or null. An empty part is silent. */
export interface SoundPlan { cast: SoundLayer[]; travel: SoundLayer[]; impact: SoundLayer[]; legend: string | null }

export const PARTS = ['cast', 'travel', 'impact'] as const;

const NOTE_STEP: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** A note word such as `a4`, `c#5`, or `eb3` as Hz, or null when the word is not a note. */
export function noteHz(w: string): number | null {
  const m = /^([a-g])(#|b)?([2-7])$/.exec(w);
  if (!m) return null;
  const midi = 12 * (Number(m[3]) + 1) + NOTE_STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return Math.round(440 * Math.pow(2, (midi - 69) / 12) * 100) / 100;
}

/** Reads a spec. Returns the plan, or the first word it cannot use and why. */
export function parseSound(spec: string): SoundPlan | { bad: string; why: string } {
  const groups = spec.split('|');
  if (groups.length !== 3) return { bad: spec.trim(), why: 'a spec has three parts, cast | travel | impact' };
  const plan: SoundPlan = { cast: [], travel: [], impact: [], legend: null };
  for (let g = 0; g < 3; g++) {
    const words = groups[g].trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return { bad: `part ${g + 1}`, why: 'an empty part, so write - for silence' };
    if (words[0] === '-') {
      if (words.length > 1) return { bad: words[1], why: '- stands alone in its part' };
      continue;
    }
    const out = plan[PARTS[g]];
    let mat: string | null = null, matUsed = true;
    let cur: SoundLayer | null = null;
    const seen = new Set<string>();
    for (const w of words) {
      if (MATERIALS[w]) {
        if (!matUsed) return { bad: w, why: 'two materials in a row, so give the first one a sound' };
        mat = w; matUsed = false;
        continue;
      }
      if (ACTIONS[w] || MOTIFS[w]) {
        if (MOTIFS[w]) {
          if (plan.legend && plan.legend !== w) return { bad: w, why: `a second legendary's motif in a spec that plays ${plan.legend}'s` };
          plan.legend = w;
        }
        cur = { mat, act: MOTIFS[w] ? 'motif' : w, motif: MOTIFS[w] ? w : null, shift: 0, note: null, len: 1, vol: 1, bend: 0, wide: false, n: 1 };
        out.push(cur);
        mat = null; matUsed = true;
        seen.clear();
        continue;
      }
      const hz = noteHz(w);
      if (!MODIFIERS[w] && hz === null) return { bad: w, why: w === '-' ? '- stands alone in its part' : 'not in the vocabulary' };
      if (!cur) return { bad: w, why: 'a modifier changes the sound before it, and none comes before' };
      const kind = hz !== null ? 'note' : w === 'high' || w === 'low' ? 'pitch' : w === 'short' || w === 'long' ? 'len'
        : w === 'soft' || w === 'hard' ? 'vol' : w === 'rise' || w === 'fall' ? 'bend' : w[0] === 'x' ? 'n' : w;
      if (seen.has(kind)) return { bad: w, why: `a second ${kind === 'n' ? 'count' : kind === 'wide' ? 'wide' : kind} word on one sound` };
      seen.add(kind);
      if (hz !== null) {
        if (!cur.motif && !ACTIONS[cur.act].pitched) return { bad: w, why: `${cur.act} has no pitch to set` };
        if (seen.has('pitch')) return { bad: w, why: 'a note and high or low on one sound' };
        cur.note = hz;
      } else if (kind === 'pitch') {
        if (cur.note !== null) return { bad: w, why: 'a note and high or low on one sound' };
        cur.shift = w === 'high' ? 7 : -7;
      } else if (kind === 'len') cur.len = w === 'short' ? 0.6 : 1.6;
      else if (kind === 'vol') cur.vol = w === 'soft' ? 0.55 : 1.45;
      else if (kind === 'bend') cur.bend = w === 'rise' ? 1 : -1;
      else if (kind === 'wide') cur.wide = true;
      else cur.n = Number(w.slice(1));
    }
    if (!matUsed) return { bad: mat!, why: 'a material needs a sound word after it' };
  }
  // A legendary's spec may layer five sounds in a part, and any other three.
  const most = plan.legend ? 5 : 3;
  for (const p of PARTS) {
    const over = plan[p][most];
    if (over) return { bad: over.motif || over.act, why: plan.legend ? 'at most five sounds in a part of a legendary\'s spec' : 'at most three sounds in a part' };
  }
  return plan;
}

/** The first problem with a spec as "word: why", or null when it reads. With the move's picture, it also checks that the parts fit it. */
export function checkSound(spec: string, fx?: FxPlan): string | null {
  const r = parseSound(spec);
  if ('bad' in r) return `${r.bad}: ${r.why}`;
  if (fx && !fx.shape && r.travel.length) return `${r.travel[0].act}: the picture has nothing that travels, so its travel part is -`;
  return null;
}

/** Every move's own spec, merged from the sound files, one for each kit file. */
export const SOUND_SPECS: Record<string, SoundEntry> = { ...SOUNDS1, ...SOUNDS2, ...SOUNDS3, ...SOUNDS4, ...SOUNDS5, ...SOUNDS6, ...SOUNDS7, ...SOUNDS8 };

/** The spec a move's entry gives for an option (-1 or undefined for its plain picture), or undefined. */
export function entrySpec(e: SoundEntry | undefined, opt?: number): string | undefined {
  if (!e) return undefined;
  if (typeof e === 'string') return e;
  return opt !== undefined && opt >= 0 && e.opts[opt] ? e.opts[opt] : e.fx;
}

// ---------------------------------------------------------------- defaults

/** What each picture word sounds like. `~` stands for a sound in the move type's material. */
const CAST_OF: Record<string, string> = {
  lunge: 'air whoosh', hop: '~knock soft', shake: '~rattle', spin: 'air whoosh wide', lift: '~swell soft', sink: '~swell fall soft',
  recoil: '~scrape short', flare: '~chime soft', swell: '~swell', blink: 'void warble short', sway: 'air rustle soft', stomp: 'air whoosh short',
};
const TRAVEL_OF: Record<string, string> = {
  orb: '~hum', shard: 'air whistle', star: 'star warble', hoop: '~warble', bolt: 'gear crackle', drop: 'water warble', bubble: 'water warble high',
  leaf: 'root rustle', petal: 'root rustle soft', thorn: 'air whistle', pebble: 'air whistle low', sand: 'sand hiss', feather: 'air rustle',
  spark: 'ember crackle', rune: '~hum', crest: 'water whoosh', card: 'shell rattle soft', bone: 'bone rattle', shell: 'shell whistle',
  beam: '~hum wide', pearl: 'shell warble', fang: 'air whistle', cog: 'gear rattle', comet: 'star whistle', moon: 'void whistle',
  salt: 'salt fizz', fish: 'water warble', kelp: 'water rustle', ember: 'ember crackle', bell: '~chime', urchin: '~rattle',
};
const LAND_OF: Record<string, string> = {
  flash: '~pop', ring: '~ring', splash: 'water splash', shatter: '~shatter', crack: 'stone crack', sparkle: 'star chime', puff: 'air pop',
  slash: '~scrape short hard', bite: 'bone crunch', pillar: '~ring rise', sigil: '~chime', quake: 'stone thud', burst: '~crack',
  claw: 'bone scrape short x3', vortex: 'void swell fall', bloom: 'root pluck', drip: 'water drip', smoke: 'air hiss', fizz: 'water fizz',
  cinders: 'ember crackle', daze: 'star warble', frost: 'ice crackle',
};
/** A strike in each type's material, put first when a landing's own sound is a hold, so every landing starts with a blow. */
const STRIKE: Record<Type, string> = { STONE: 'stone thud', TIDE: 'water gulp', ROOT: 'root knock', GEAR: 'gear knock', BEAST: 'fur thud', STAR: 'star chime', SALT: 'salt crack', VOID: 'void thud' };
/** Notes a sound move picks among: a pentatonic scale, so any two of them agree. */
const SOUND_NOTES = ['c5', 'd5', 'e5', 'g5', 'a5', 'c6', 'd6'];

/** A small hash of a string, the same one the pictures use, so the default sound and picture vary together. */
function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The sound a move gets from its picture, kinds, and type when it has no spec of its own, as a spec. A legendary's opens with its motif. */
export function defaultSound(m: Pick<MoveDef, 'id' | 'type' | 'tags' | 'reach' | 'owner'>, fx: FxPlan): string {
  const firstAct = (s: string) => s.replace(/~/g, '').split(' ').find(w => ACTIONS[w]) || 'thud';
  const own = fx.motion.length ? CAST_OF[fx.motion[0]] || '~swell soft' : '-';
  const cast = MOTIFS[m.owner] ? (own === '-' ? m.owner : `${m.owner} ${own}`) : own;
  const travel = fx.shape ? TRAVEL_OF[fx.shape] || '~hum' : '-';
  let lands = (fx.impact.length ? fx.impact : ['flash']).slice(0, 2).map(w => LAND_OF[w] || '~pop');
  if (ACTIONS[firstAct(lands[0])].hold) lands = [STRIKE[m.type] || 'thud', lands[0]];
  // A sound move lands on a clear note, so a bell or a chirp reads as music.
  if (m.tags?.includes('sound')) lands = [`~chime ${SOUND_NOTES[hashOf(m.id) % SOUND_NOTES.length]}`, lands[0]];
  if (m.reach === 'spread' && !/\bwide\b/.test(lands[0])) lands[0] += ' wide';
  return [cast, travel, lands.join(' ')].map(s => s.replace(/~/g, '')).join(' | ');
}

/** The spec a move plays for an option (-1 or undefined for its plain picture) with this picture: its own, or its default. */
export function soundSpecOf(m: MoveDef, fx: FxPlan, opt?: number): { spec: string; own: boolean } {
  const own = entrySpec(SOUND_SPECS[m.id], opt);
  if (own && !checkSound(own)) return { spec: own, own: true };
  return { spec: defaultSound(m, fx), own: false };
}
