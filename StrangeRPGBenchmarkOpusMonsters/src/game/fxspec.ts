// A move's picture in battle as a one-line spec, and the picture a move without one gets from its kinds, reach, and type.
// This file is plain data and parsing, so the content tests can check every spec without a browser.
import type { MoveDef } from '../battle/registry';
import type { Type } from '../data/types';

/** How the user moves. */
export const MOTIONS: Record<string, string> = {
  lunge: 'dashes across to the target and springs back',
  hop: 'jumps up and lands',
  shake: 'shakes in place',
  spin: 'turns around twice',
  lift: 'rises off the ground and settles',
  sink: 'sinks into the ground and comes back up',
  recoil: 'jerks back away from the target',
  flare: 'lights up in its color',
  swell: 'shrinks, then swells big, then settles',
  blink: 'fades out and back in',
  sway: 'leans side to side',
  stomp: 'jumps and slams down on the spot',
};

/** What travels from the user to the target. */
export const SHAPES: Record<string, string> = {
  orb: 'a round ball of light',
  shard: 'a thin sliver pointing where it flies',
  star: 'a twinkling four-point star',
  hoop: 'a ring that turns as it flies',
  bolt: 'a jagged streak of lightning',
  drop: 'a drop of water',
  bubble: 'a hollow bubble with a shine',
  leaf: 'a leaf that flips as it flies',
  petal: 'a small petal that tumbles',
  thorn: 'a long thorn, dark at its base',
  pebble: 'a small stone',
  sand: 'a loose cloud of grains',
  feather: 'a feather that flutters',
  spark: 'a hot point with a short tail',
  rune: 'a small glyph',
  crest: 'the curl of a wave',
  card: 'a card that turns over and over',
  bone: 'a bone with a knob at each end',
  shell: 'a spiral shell',
  beam: 'a straight line that holds from the user to the target',
  pearl: 'a pearl with a pink sheen',
  fang: 'a pair of fangs',
  cog: 'a turning cog',
  comet: 'a bright head with a long tail',
  moon: 'a crescent moon',
  salt: 'a cube of salt that glints',
  fish: 'a small fish that wriggles',
  kelp: 'a waving strand of kelp',
  ember: 'a coal that trails smoke',
  bell: 'a small bell that swings',
  urchin: 'a spiked ball',
};

/** How it travels. */
export const PATHS: Record<string, string> = {
  line: 'straight across',
  arc: 'a lob that peaks over the target and drops onto it',
  wave: 'weaving up and down',
  zigzag: 'sharp turns side to side',
  spiral: 'corkscrewing around the straight line',
  rain: 'falls from above the target',
  rise: 'comes up out of the ground under the target',
  converge: 'comes in from all around the target',
  orbit: 'circles the user, then flies',
  sweep: 'swipes sideways through the target',
  return: 'flies out and comes back',
  ray: 'appears all along the line at once and holds',
};

/** What happens where it lands. */
export const IMPACTS: Record<string, string> = {
  flash: 'a bright burst',
  ring: 'a ring that spreads out',
  splash: 'drops thrown up in a crown',
  shatter: 'splinters flying apart',
  crack: 'a glowing crack opening in the ground',
  sparkle: 'small stars twinkling around the target',
  puff: 'a cloud that swells and thins away',
  slash: 'a cut across the target',
  bite: 'jaws closing on the target',
  pillar: 'a column of light from the ground up',
  sigil: 'a glyph circle drawn under the target',
  quake: 'the ground jumps under the target',
  burst: 'lines thrown out in every direction',
  claw: 'three cuts side by side',
  vortex: 'a spiral pulling inward',
  bloom: 'petals opening outward',
  drip: 'drops running down',
  smoke: 'smoke rising',
  fizz: 'bubbles rising',
  cinders: 'sparks drifting up',
  daze: 'stars circling the head',
  frost: 'crystals growing around the target',
};

/** What happens to the whole scene. */
export const SCENES: Record<string, string> = {
  jolt: 'the scene shakes for 8 frames when it lands',
  tint: 'the scene takes a dithered wash of the main color while it plays',
  dark: 'the scene darkens while it plays',
  glare: 'the scene flashes white for 4 frames when it lands',
};

/** Words that change the rest. */
export const MODS: Record<string, string> = {
  big: 'larger and longer, as a crest is',
  small: 'smaller and quicker',
  fast: 'about a third quicker',
  slow: 'about a third slower',
  all: 'lands on every foe on the field',
  self: 'lands on the user',
  ally: 'lands on the user\'s own side',
  foe: 'lands on the foe',
};

export type Scope = 'foe' | 'self' | 'ally' | 'all';

/** A parsed spec: the user's motions in order, what travels, how, how many, what happens where it lands, and the scene. */
export interface FxPlan {
  motion: string[];
  shape: string | null;
  path: string | null;
  count: number;
  impact: string[];
  scene: string[];
  /** The main color and an accent, each a '#rrggbb' color or a type's name such as 'STAR'. */
  color: string | null;
  accent: string | null;
  big: boolean;
  small: boolean;
  fast: boolean;
  slow: boolean;
  to: Scope | null;
  /** The move the plan was made for, so a legendary move can find its own picture. */
  id?: string;
}

const TYPE_WORDS: Record<string, Type> = { stone: 'STONE', tide: 'TIDE', root: 'ROOT', gear: 'GEAR', beast: 'BEAST', star: 'STAR', salt: 'SALT', void: 'VOID' };

export const emptyPlan = (): FxPlan => ({ motion: [], shape: null, path: null, count: 1, impact: [], scene: [], color: null, accent: null, big: false, small: false, fast: false, slow: false, to: null });

/** Reads a spec. Returns the plan, or the first word it does not know and why. */
export function parseFx(spec: string): FxPlan | { bad: string; why: string } {
  const p = emptyPlan();
  for (const raw of spec.split(/[|\s]+/)) {
    const w = raw.trim().toLowerCase();
    if (!w) continue;
    if (w[0] === '@' || w[0] === '#') {
      const col = w[0] === '@' ? TYPE_WORDS[w.slice(1)] : /^#[0-9a-f]{6}$/.test(w) ? w : null;
      if (!col) return { bad: raw, why: w[0] === '@' ? 'not a type' : 'not a #rrggbb color' };
      if (p.color === null) p.color = col;
      else if (p.accent === null) p.accent = col;
      else return { bad: raw, why: 'more than two colors' };
      continue;
    }
    const m = /^([a-z]+)(?:\*(\d+))?$/.exec(w);
    if (!m) return { bad: raw, why: 'not a word' };
    const [, word, n] = m;
    if (n !== undefined && !SHAPES[word]) return { bad: raw, why: 'a count goes only on something that travels' };
    if (MOTIONS[word]) p.motion.push(word);
    else if (SHAPES[word]) {
      if (p.shape) return { bad: raw, why: 'a second thing that travels' };
      p.shape = word;
      if (n !== undefined) {
        const c = Number(n);
        if (c < 1 || c > 8) return { bad: raw, why: 'a count runs from 1 to 8' };
        p.count = c;
      }
    } else if (PATHS[word]) {
      if (p.path) return { bad: raw, why: 'a second path' };
      p.path = word;
    } else if (IMPACTS[word]) p.impact.push(word);
    else if (SCENES[word]) p.scene.push(word);
    else if (word === 'big' || word === 'small' || word === 'fast' || word === 'slow') p[word] = true;
    else if (word === 'all' || word === 'self' || word === 'ally' || word === 'foe') {
      if (p.to) return { bad: raw, why: 'a second place to land' };
      p.to = word;
    } else return { bad: raw, why: 'not in the vocabulary' };
  }
  return p;
}

/** The first problem with a spec as "word: why", or null when it reads. */
export function checkFx(spec: string): string | null {
  const r = parseFx(spec);
  return 'bad' in r ? `${r.bad}: ${r.why}` : null;
}

// ---------------------------------------------------------------- defaults

/** Each type's own shapes, paths, landings, and motions. Defaults pick among them by a hash of the move's id. */
interface TypeLook { shapes: string[]; magic: string[]; paths: string[]; impacts: string[]; motions: string[]; blessings: string[] }
const LOOKS: Record<Type, TypeLook> = {
  STONE: { shapes: ['pebble', 'shard', 'sand', 'pebble'], magic: ['rune', 'shard', 'orb'], paths: ['arc', 'line', 'rain', 'rise'], impacts: ['crack', 'quake', 'shatter', 'puff'], motions: ['stomp', 'shake', 'sink'], blessings: ['pillar', 'ring', 'quake'] },
  TIDE: { shapes: ['drop', 'bubble', 'crest', 'fish', 'pearl'], magic: ['bubble', 'pearl', 'orb'], paths: ['wave', 'arc', 'rise', 'spiral'], impacts: ['splash', 'fizz', 'ring', 'drip'], motions: ['sway', 'sink', 'hop'], blessings: ['fizz', 'ring', 'drip'] },
  ROOT: { shapes: ['leaf', 'thorn', 'petal', 'kelp'], magic: ['leaf', 'petal', 'rune'], paths: ['spiral', 'rise', 'wave', 'zigzag'], impacts: ['bloom', 'slash', 'puff', 'ring'], motions: ['sway', 'lift', 'hop'], blessings: ['bloom', 'sparkle', 'ring'] },
  GEAR: { shapes: ['bolt', 'cog', 'spark', 'card'], magic: ['spark', 'rune', 'cog'], paths: ['zigzag', 'line', 'return', 'orbit'], impacts: ['burst', 'flash', 'cinders', 'crack'], motions: ['shake', 'recoil', 'spin'], blessings: ['burst', 'cinders', 'ring'] },
  BEAST: { shapes: ['fang', 'feather', 'bone', 'urchin'], magic: ['feather', 'rune', 'orb'], paths: ['arc', 'line', 'zigzag', 'return'], impacts: ['bite', 'claw', 'slash', 'puff'], motions: ['lunge', 'hop', 'recoil'], blessings: ['puff', 'ring', 'sparkle'] },
  STAR: { shapes: ['star', 'comet', 'spark', 'moon'], magic: ['star', 'moon', 'comet'], paths: ['rain', 'arc', 'spiral', 'sweep'], impacts: ['sparkle', 'flash', 'pillar', 'daze'], motions: ['lift', 'flare', 'spin'], blessings: ['pillar', 'sparkle', 'daze'] },
  SALT: { shapes: ['salt', 'shard', 'shell', 'hoop'], magic: ['salt', 'hoop', 'bell'], paths: ['line', 'converge', 'rain', 'wave'], impacts: ['frost', 'shatter', 'ring', 'sparkle'], motions: ['swell', 'shake', 'sink'], blessings: ['frost', 'ring', 'sparkle'] },
  VOID: { shapes: ['orb', 'rune', 'moon', 'ember'], magic: ['rune', 'orb', 'moon'], paths: ['spiral', 'converge', 'wave', 'orbit'], impacts: ['vortex', 'sigil', 'smoke', 'burst'], motions: ['blink', 'sink', 'flare'], blessings: ['vortex', 'smoke', 'sigil'] },
};

/** A small hash of a move's id, so two moves of one type and kind still look different. */
export function fxHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The picture a move gets from its kinds, reach, wind-up, crest, and type when it has no spec of its own. */
export function defaultFx(m: MoveDef): FxPlan {
  const p = emptyPlan(), h = fxHash(m.id), look = LOOKS[m.type] || LOOKS.STONE;
  const pick = <T>(a: T[], k: number): T => a[(h >>> (k * 4)) % a.length];
  const tags = m.tags || [];
  const reach = m.reach;
  if (reach === 'self' || reach === 'ally' || reach === 'team' || reach === 'reserveAlly') {
    p.motion = [pick(['flare', 'lift', 'swell', 'spin', ...look.motions], 0)];
    p.impact = [pick(look.blessings, 1)];
    if ((h >>> 9) % 3 === 0) { p.shape = pick(look.magic, 2); p.path = 'orbit'; p.count = 2 + (h >>> 12) % 3; }
    p.to = reach === 'self' ? 'self' : 'ally';
  } else if (tags.includes('channel')) {
    p.motion = ['flare'];
    p.shape = 'beam';
    p.impact = [pick(look.impacts, 1)];
  } else if (tags.includes('dash')) {
    p.motion = [pick(['lunge', 'lunge', 'stomp', 'blink', 'lunge'], 0)];
    p.impact = [pick(look.impacts, 1)];
    if (tags.includes('spell')) p.impact.push('sigil');
    if (tags.includes('projectile')) { p.shape = pick(look.shapes, 2); p.path = 'line'; }
  } else if (tags.includes('projectile')) {
    const magic = tags.includes('spell');
    p.shape = pick(magic ? look.magic : look.shapes, 2);
    p.path = pick(look.paths, 3);
    p.count = [1, 1, 2, 3][(h >>> 6) % 4];
    p.impact = [pick(look.impacts, 1)];
    if ((h >>> 14) % 3 === 0) p.motion = [pick(look.motions, 0)];
  } else if (tags.includes('spell')) {
    // A spell always draws its glyph under the target, and the glyph itself varies by the same hash.
    p.motion = [pick(['flare', 'flare', ...look.motions], 0)];
    p.impact = ['sigil', pick(look.impacts.filter(w => w !== 'sigil'), 1)];
    if ((h >>> 10) % 3 === 0) { p.shape = pick(look.magic, 2); p.path = 'converge'; p.count = 3 + (h >>> 13) % 3; }
  } else {
    p.motion = [pick([...look.motions, 'lunge', 'hop'], 0)];
    p.impact = [pick(look.impacts, 1)];
  }
  if (reach === 'spread') { p.to = 'all'; if (p.shape && p.shape !== 'beam' && (h >>> 17) % 2) p.path = 'sweep'; }
  if (reach === 'side' && !p.impact.includes('crack')) p.impact.push('crack');
  if (m.nerve) { p.big = true; p.scene = ['tint', 'jolt']; if (p.shape && p.shape !== 'beam') p.count = Math.min(8, p.count + 2); }
  if (m.quick) p.fast = true;
  if (m.late) p.slow = true;
  return p;
}

/** The plan a move plays: its own spec when it reads, or its default. */
export function fxPlanOf(m: MoveDef): FxPlan {
  if (m.fx) {
    const r = parseFx(m.fx);
    if (!('bad' in r)) {
      // A spec that leaves out where it lands takes it from the move's reach.
      if (!r.to) r.to = m.reach === 'spread' ? 'all' : m.reach === 'self' ? 'self' : m.reach === 'ally' || m.reach === 'team' || m.reach === 'reserveAlly' ? 'ally' : 'foe';
      r.id = m.id;
      return r;
    }
  }
  const d = defaultFx(m);
  d.id = m.id;
  return d;
}
