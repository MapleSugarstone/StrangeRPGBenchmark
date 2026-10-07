// Reeling: Wait holds a line in the ink, a catch takes it, and the catch's own rote says when it pulls and when it rests.
import { Rng } from '../core/rng';
import { sfx } from '../engine/audio';
import { CW, text, wrap } from '../engine/font';
import { down, tapped } from '../engine/input';
import { music } from '../engine/music';
import { H, W, ditherRect, rect } from '../engine/screen';
import { Def, DrawOpts, drawCopied, drawSprite, registerSprites } from '../engine/sprites';
import { Scene, app } from './app';
import { CATCHES, Catch, WHERES, WHERE_NAMES, catchById, pickCatch } from './catches';
import { colorize } from './editor';
import type { SaveData } from './state';
import { C, panel } from './ui';

// ---------------------------------------------------------------- the model

export type Verb = 'pull' | 'rest' | 'dive' | 'still' | 'wait';
export type Outcome = 'landed' | 'snapped' | 'escaped';

export const DIST_MAX = 100;
export const STRAIN_MAX = 100;

/** Per-frame rates at 60 frames a second. Distance 0 is landed. Strain is the line's load. */
export const RATE = {
  restReel: 0.17,
  restReelStrain: -0.28,
  restSlackStrain: -0.6,
  waitReel: 0.09,
  waitReelStrain: -0.1,
  waitSlackStrain: -0.45,
  pullReelStrain: 1.75,
  pullSlack: 0.11,
  diveReelStrain: 2.5,
  diveReelDist: 0.4,
  diveSlack: 0.03,
  diveSlackStrain: -0.25,
  stillSlackStrain: -0.6,
  /** A catch that is reeled while still bolts after this many frames of reeling in one beat. */
  boltGrace: 14,
  boltDist: 12,
  boltStrain: 8,
  /** Slack line lets the catch swim off. */
  drift: 0.03,
};

const START_MIN = 46;
const START_SPAN = 10;
const FIGHT_LIMIT = 60 * 70;
const MAX_STEPS = 64;

export interface Step { verb: Verb; line: number }
export interface Program { steps: Step[]; again: boolean; againLine: number }

const VERB_SET = new Set<string>(['pull', 'rest', 'dive', 'still', 'wait']);

interface Row { depth: number; code: string; line: number }

function rowsOf(rote: string[]): Row[] {
  const out: Row[] = [];
  rote.forEach((raw, line) => {
    const h = raw.indexOf('#');
    const body = h < 0 ? raw : raw.slice(0, h);
    const code = body.trim();
    if (code) out.push({ depth: Math.floor((body.length - body.trimStart().length) / 2), code, line });
  });
  return out;
}

function runBlock(rows: Row[], at: { i: number }, depth: number, out: Step[]) {
  while (at.i < rows.length && rows[at.i].depth >= depth) {
    const r = rows[at.i++];
    const m = /^repeat\s+(\d+)\s*:\s*(.*)$/.exec(r.code);
    if (m) {
      const n = Math.min(12, Number(m[1]));
      const body: Step[] = [];
      if (m[2]) { if (VERB_SET.has(m[2])) body.push({ verb: m[2] as Verb, line: r.line }); }
      else runBlock(rows, at, r.depth + 1, body);
      for (let k = 0; k < n && out.length < MAX_STEPS; k++) out.push(...body);
    } else if (VERB_SET.has(r.code)) out.push({ verb: r.code as Verb, line: r.line });
  }
}

/** Reads a catch's rote into a tape of beats. A rote without `again` ends with one empty beat. */
export function compile(rote: string[]): Program {
  let rows = rowsOf(rote);
  let againLine = -1;
  const last = rows[rows.length - 1];
  if (last && last.code === 'again' && last.depth === 0) { againLine = last.line; rows = rows.slice(0, -1); }
  const steps: Step[] = [];
  runBlock(rows, { i: 0 }, 0, steps);
  if (!steps.length) steps.push({ verb: 'wait', line: -1 });
  if (againLine < 0) steps.push({ verb: 'wait', line: -1 });
  return { steps, again: againLine >= 0, againLine };
}

const PROGRAMS = new Map<string, Program>();
function programOf(k: Catch): Program {
  let p = PROGRAMS.get(k.id);
  if (!p) { p = compile(k.rote); PROGRAMS.set(k.id, p); }
  return p;
}

export interface Fight {
  kind: Catch;
  prog: Program;
  tempo: number;
  distance: number;
  strain: number;
  /** Index into prog.steps. */
  step: number;
  /** Frames into the current beat. */
  beat: number;
  /** Frames spent reeling in the current beat. */
  reeled: number;
  bolted: boolean;
  frames: number;
  wraps: number;
  /** How hard this catch fights today, near 1. */
  temper: number;
  over: Outcome | null;
}

export const EV_BEAT = 1;
export const EV_BOLT = 2;
export const EV_WRAP = 4;

export function startFight(kind: Catch, roll: () => number): Fight {
  return {
    kind, prog: programOf(kind), tempo: kind.tempo,
    distance: START_MIN + roll() * START_SPAN, strain: 0,
    step: 0, beat: 0, reeled: 0, bolted: false, frames: 0, wraps: 0,
    temper: 0.92 + roll() * 0.16, over: null,
  };
}

export function stepOf(f: Fight, ahead = 0): Step {
  return f.prog.steps[(f.step + ahead) % f.prog.steps.length];
}

function apply(f: Fight, verb: Verb, reel: boolean): boolean {
  const t = f.temper;
  let bolt = false;
  switch (verb) {
    case 'rest':
      if (reel) { f.distance -= RATE.restReel; f.strain += RATE.restReelStrain; }
      else { f.distance += RATE.drift; f.strain += RATE.restSlackStrain; }
      break;
    case 'wait':
      if (reel) { f.distance -= RATE.waitReel; f.strain += RATE.waitReelStrain; }
      else { f.distance += RATE.drift; f.strain += RATE.waitSlackStrain; }
      break;
    case 'pull':
      if (reel) f.strain += RATE.pullReelStrain * t;
      else f.distance += RATE.pullSlack * t;
      break;
    case 'dive':
      if (reel) { f.strain += RATE.diveReelStrain * t; f.distance += RATE.diveReelDist * t; }
      else { f.distance += RATE.diveSlack; f.strain += RATE.diveSlackStrain; }
      break;
    case 'still':
      if (reel) {
        if (!f.bolted && f.reeled >= RATE.boltGrace) {
          f.bolted = true; bolt = true;
          f.distance += RATE.boltDist * t; f.strain += RATE.boltStrain;
        }
      } else { f.distance += RATE.drift; f.strain += RATE.stillSlackStrain; }
      break;
  }
  if (f.strain < 0) f.strain = 0;
  return bolt;
}

/** Advances one frame. Returns EV_ flags for what happened. */
export function tick(f: Fight, reel: boolean): number {
  if (f.over) return 0;
  let ev = 0;
  if (reel) f.reeled++;
  if (apply(f, f.prog.steps[f.step].verb, reel)) ev |= EV_BOLT;
  f.frames++;
  f.beat++;
  if (f.strain >= STRAIN_MAX) f.over = 'snapped';
  else if (f.distance <= 0) { f.distance = 0; f.over = 'landed'; }
  else if (f.distance >= DIST_MAX || f.frames >= FIGHT_LIMIT) { f.distance = Math.min(DIST_MAX, f.distance); f.over = 'escaped'; }
  if (f.over) return ev;
  if (f.beat >= f.tempo) {
    f.beat = 0; f.reeled = 0; f.bolted = false; f.step++;
    ev |= EV_BEAT;
    if (f.step >= f.prog.steps.length) { f.step = 0; f.wraps++; ev |= EV_WRAP; }
  }
  return ev;
}

/** The verb of a step as the player sees it, or null when its line is still smudged. */
export function visibleVerb(f: Fight, s: Step, known: boolean): Verb | null {
  if (!known && s.line >= 0 && f.kind.smudge.includes(s.line)) return null;
  return s.verb;
}

export interface View { verb: Verb | null; next: Verb | null; strain: number; distance: number }
/** Takes the lit verb, or null when its line is smudged, and returns true to reel. The view adds the next verb and the numbers. */
export type Policy = (verb: Verb | null, view: View) => boolean;

export const POLICIES: Record<'hold' | 'never' | 'reads' | 'feels', Policy> = {
  hold: () => true,
  never: () => false,
  reads: (verb) => verb === 'rest' || verb === 'wait',
  /** Reads what it can. On a smudged line it reels only while the line is slack. */
  feels: (verb, view) => (verb ? verb === 'rest' || verb === 'wait' : view.strain < 35),
};

export interface SimOpts {
  /** False hides smudged lines, as for a kind that has never been landed. */
  known?: boolean;
  /** Frames the policy sees the rote, the line, and the distance late. */
  delay?: number;
  /** For a smudged line: frames into the beat before the player works out the verb from how the catch moves. */
  watch?: number;
}

function viewOf(f: Fight, known: boolean, watch: number): View {
  const now = visibleVerb(f, stepOf(f), known);
  return {
    verb: now === null && watch > 0 && f.beat >= watch ? stepOf(f).verb : now,
    next: visibleVerb(f, stepOf(f, 1), known),
    strain: f.strain, distance: f.distance,
  };
}

/** Plays one whole fight with no screen. */
export function simulate(kindId: string, policy: Policy, seed: number, opts: SimOpts = {}): Outcome {
  const kind = catchById(kindId);
  if (!kind) throw new Error(`no catch ${kindId}`);
  const rng = new Rng(seed);
  const f = startFight(kind, () => rng.next());
  const known = opts.known ?? true;
  const delay = opts.delay ?? 0;
  const watch = opts.watch ?? 0;
  const seen: View[] = [];
  while (!f.over) {
    const now = viewOf(f, known, watch);
    seen.push(now);
    if (seen.length > delay + 1) seen.shift();
    tick(f, policy(seen[0].verb, seen[0]));
  }
  return f.over;
}

/** The share of fights a policy lands, from 0 to 1. */
export function winRate(kindId: string, policy: Policy, runs = 400, opts: SimOpts = {}): number {
  let won = 0;
  for (let i = 0; i < runs; i++) if (simulate(kindId, policy, 1000 + i * 7919, opts) === 'landed') won++;
  return won / runs;
}

// ---------------------------------------------------------------- sprites

const S_EEL: Def = {
  pal: [0x1a1420, 0xe6dfd0, 0xc25a3a],
  rows: ['........', '........', '..23....', '.2232..1', '22..2322', '2....22.', '........', '........'],
  alt: ['........', '........', '....23..', '2..2322.', '2222..21', '.22....2', '........', '........'],
};
const S_HORN: Def = {
  pal: [0x2a1a18, 0xc2a05a, 0x6fe3e0],
  rows: ['.....11.', '....1331', '...12221', '..12221.', '.12221..', '1221....', '121.....', '11......'],
  alt: ['....3.3.', '....1331', '...12221', '..12221.', '.12221..', '1221....', '121.....', '11......'],
};
const S_HUSK: Def = {
  pal: [0x2a1a18, 0xc2a05a, 0xf2d25a],
  rows: ['...11...', '..1221..', '.122221.', '.123321.', '.122221.', '.122221.', '..1221..', '...11...'],
  alt: ['...11...', '..1221..', '.123321.', '.123321.', '.123321.', '.122221.', '..1221..', '...11...'],
};
const S_CRAB: Def = {
  pal: [0x2a1a18, 0xc25a3a, 0xf2a070],
  rows: ['1......1', '11....11', '.122221.', '12322321', '.122221.', '.1.11.1.', '1......1', '........'],
  alt: ['.1....1.', '11....11', '.122221.', '12322321', '.122221.', '1.1..1.1', '.1....1.', '........'],
};
const S_ASIDE: Def = {
  pal: [0x000000, 0xaaa4ba, 0xffffff],
  rows: ['..2..2..', '..2..2..', '22322322', '..2..2..', '..2..2..', '22322322', '..2..2..', '..2..2..'],
  alt: ['..2..2..', '22322322', '..2..2..', '..2..2..', '22322322', '..2..2..', '..2..2..', '..2..2..'],
};
const S_PAGE: Def = {
  pal: [0x2a2833, 0xe6dfd0, 0xc25a3a],
  rows: ['.111111.', '.122221.', '.133331.', '.122221.', '.133331.', '.122221.', '.133331.', '.111111.'],
  alt: ['.111111.', '.133331.', '.122221.', '.133331.', '.122221.', '.133331.', '.122221.', '.111111.'],
};
const S_SHORT: Def = {
  pal: [0x2a2833, 0xe6dfd0, 0xc25a3a],
  rows: ['........', '........', '.11111..', '.12221..', '.13331..', '.12221..', '.11111..', '........'],
  alt: ['........', '.11111..', '.12221..', '.13331..', '.12221..', '.11111..', '........', '........'],
};
const S_BAR: Def = {
  pal: [0x000000, 0xaaa4ba, 0xff3a3a],
  rows: ['........', '22.222.2', '........', '33333333', '33333333', '........', '2.22.222', '........'],
  alt: ['........', '22.222.2', '........', '33333333', '.3.3.3.3', '........', '2.22.222', '........'],
};
const S_SECOND: Def = {
  pal: [0x2a2833, 0xe6dfd0, 0xc25a3a],
  rows: ['..1111..', '.122321.', '12223221', '12223221', '12233221', '12222221', '.122221.', '..1111..'],
  alt: ['..1111..', '.122221.', '12222221', '12222321', '12233321', '12222221', '.122221.', '..1111..'],
};
const S_HOP: Def = {
  pal: [0x1e2440, 0x9ab8ff, 0x6fe3e0],
  rows: ['..1111..', '.122221.', '..1331..', '.122221.', '..1331..', '.122221.', '..1111..', '........'],
  alt: ['........', '..1111..', '.122221.', '..1331..', '.122221.', '..1331..', '.122221.', '..1111..'],
};
const S_STAMP: Def = {
  pal: [0x5a2a4a, 0xe07aa0, 0x8fe08a],
  rows: ['...11...', '...22...', '...22...', '.111111.', '12222221', '12333321', '12222221', '.111111.'],
  alt: ['........', '...11...', '...22...', '.111111.', '12222221', '12333321', '12222221', '.111111.'],
};
const S_HANDS: Def = {
  pal: [0x5a2a4a, 0xe6dfd0, 0xe07aa0],
  rows: ['..1111..', '.122221.', '.123321.', '..1221..', '3.1221.3', '33.22.33', '3..22..3', '..1..1..'],
  alt: ['..1111..', '.122221.', '.123321.', '..1221..', '.31221.3', '3.322.33', '33.22..3', '..1..1..'],
};
const S_EAR: Def = {
  pal: [0x2e1e4a, 0xa99ad8, 0xe07aa0],
  rows: ['..1111..', '.122221.', '12233221', '12322321', '12233221', '.122221.', '..1221..', '...11...'],
  alt: ['..1111..', '.122221.', '12322321', '12233221', '12322321', '.122221.', '..1221..', '...11...'],
};
const S_REED: Def = {
  pal: [0x1e3a1e, 0x8fe08a, 0xa99ad8],
  rows: ['.....33.', '....233.', '....22..', '...22...', '...22...', '..22....', '..22....', '.22.....'],
  alt: ['....33..', '...233..', '...22...', '...22...', '...22...', '..22....', '..22....', '.22.....'],
};
const S_HEARD: Def = {
  pal: [0x2e1e4a, 0xa99ad8, 0xffffff],
  rows: ['........', '222.222.', '..2.2.2.', '222.222.', '2.2...2.', '222.222.', '........', '3.3.3.3.'],
  alt: ['........', '222.222.', '..2.2.2.', '222.222.', '2.2...2.', '222.222.', '........', '.3.3.3.3'],
};
const S_BOLT: Def = {
  pal: [0x1e2440, 0xaaa4ba, 0x6f8cff],
  rows: ['.111111.', '12222221', '12333321', '.111111.', '..1221..', '..1231..', '..1221..', '...11...'],
  alt: ['.111111.', '12222221', '12333221', '.111111.', '..1221..', '..1221..', '..1231..', '...11...'],
};
const S_NIB: Def = {
  pal: [0x1e2440, 0xe6dfd0, 0x6f8cff],
  rows: ['...11...', '..1221..', '.122221.', '.123321.', '.123321.', '..1331..', '..1331..', '...11...'],
  alt: ['...11...', '..1221..', '.122221.', '.123321.', '.123321.', '..1331..', '..1331..', '...33...'],
};

registerSprites({
  rl_eel: S_EEL, rl_horn: S_HORN, rl_husk: S_HUSK, rl_crab: S_CRAB, rl_aside: S_ASIDE, rl_page: S_PAGE,
  rl_page_short: S_SHORT, rl_bar: S_BAR, rl_second: S_SECOND, rl_hop: S_HOP, rl_stamp: S_STAMP,
  rl_hands: S_HANDS, rl_ear: S_EAR, rl_reed: S_REED, rl_heard: S_HEARD, rl_bolt: S_BOLT, rl_nib: S_NIB,
});

// ---------------------------------------------------------------- drawing

const SURF = 100;
const BANK = 58;
const WAIT_X = 42;
const TIP_X = 74;
const TIP_Y = 80;
const INK_TOP = 0x6fe3e0;
const INK_MID = 0x2a8a8a;
const INK_DEEP = 0x123a3c;
const FADE = [0, 1, 0, 1, 1, 2, 1, 2, 2];
const FADE_AT = SURF + 36;
/** Line colors from slack to about to snap. */
const LINE_RAMP = [0xe6dfd0, 0xf2d25a, 0xf2a070, 0xff3a3a];
const VERB_COLOR: Record<string, number> = { pull: 0xf2a070, rest: 0x8fe08a, dive: 0x6f8cff, still: 0xaaa4ba, wait: 0xe6dfd0, again: C.again };
const SMUDGE = 0x4e4a5c;
const ORBIT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const OUTLINE = ORBIT;

const catchY = (distance: number) => Math.round(SURF + 10 + distance * 0.78);
const lineColor = (strain: number) => LINE_RAMP[strain < 25 ? 0 : strain < 50 ? 1 : strain < 75 ? 2 : 3];
const dot = (x: number, y: number, c: number) => rect(Math.round(x), Math.round(y), 1, 1, c);

function seg(x0: number, y0: number, x1: number, y1: number, c: number) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    dot(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function drawInk(t: number, falling: boolean) {
  const w = W - BANK;
  rect(BANK, SURF - 3, w, 3, INK_DEEP);
  ditherRect(BANK, SURF - 6, w, 3, INK_DEEP, 0);
  for (let k = 0; k < 7; k++) {
    const cx = BANK + ((k * 27 + (t >> 2)) % (w - 3));
    rect(cx, SURF - 1, 3, 1, INK_MID);
    dot(cx + 1, SURF - 2, INK_TOP);
  }
  rect(0, SURF, W, 1, INK_TOP);
  rect(0, SURF + 1, W, FADE_AT - SURF - 1, INK_MID);
  FADE.forEach((m, i) => {
    const y = FADE_AT + i;
    if (m === 2) rect(0, y, W, 1, INK_DEEP);
    else { rect(0, y, W, 1, INK_MID); if (m === 1) ditherRect(0, y, W, 1, INK_DEEP, 0); }
  });
  const deepAt = FADE_AT + FADE.length;
  rect(0, deepAt, W, H - deepAt, INK_DEEP);
  for (let k = 0; k < 6; k++) {
    const y = SURF + 9 + k * 14;
    const x = (((t * (k % 2 ? 0.3 : -0.25) + k * 47) % W) + W) % W;
    ditherRect(Math.round(x), y, 6 + (k % 3) * 3, 1, y < FADE_AT ? INK_TOP : INK_MID, k);
  }
  for (let i = 0; i < 26; i++) {
    const sp = 0.12 + (i % 5) * 0.07;
    const x = ((i * 71 + 13) % (W - 12)) + 6;
    const span = H - SURF - 6;
    const d = (t * sp + ((i * 37) % span)) % span;
    const y = Math.round(falling ? SURF + 3 + d : H - 3 - d);
    if (x < BANK && y < SURF + 14) continue;
    dot(x, y, y < FADE_AT ? INK_TOP : INK_MID);
  }
}

function drawBank() {
  rect(0, SURF, BANK, 1, 0x4e4a5c);
  rect(0, SURF + 1, BANK, 11, 0x2a2833);
  rect(BANK - 1, SURF + 1, 1, 11, 0x4e4a5c);
  ditherRect(0, SURF + 12, BANK, 2, 0x2a2833, 0);
  ditherRect(2, SURF + 3, 6, 1, 0x4e4a5c, 0);
  ditherRect(20, SURF + 6, 9, 1, 0x4e4a5c, 1);
}

function drawRipples(rings: number[], t: number) {
  for (const born of rings) {
    const age = t - born;
    if (age < 0 || age > 34) continue;
    const r = age >> 1;
    const c = age < 12 ? 0xffffff : INK_TOP;
    const draw = age < 22 ? rect : ditherRect;
    draw(TIP_X - r - 4, SURF, 3, 1, c);
    draw(TIP_X + r + 2, SURF, 3, 1, c);
    if (age < 16) { rect(TIP_X - (r >> 1) - 2, SURF - 1, 2, 1, c); rect(TIP_X + (r >> 1) + 1, SURF - 1, 2, 1, c); }
  }
}

/** A dithered glow in the shape of an octagon around an 8 by 8 sprite. */
function glow(x: number, y: number, rgb: number, phase: number) {
  ditherRect(x - 1, y - 3, 10, 14, rgb, phase);
  ditherRect(x - 3, y - 1, 14, 10, rgb, phase);
}

function drawRuler(distance: number | null) {
  for (let k = 0; k <= 10; k++) {
    const y = catchY(k * 10);
    const long = k % 5 === 0;
    rect(W - (long ? 8 : 6), y, long ? 5 : 3, 1, INK_TOP);
  }
  if (distance !== null) rect(W - 12, catchY(distance), 3, 1, 0xffffff);
}

// ---------------------------------------------------------------- the scene

type Phase = 'cast' | 'bite' | 'fight' | 'end' | 'card';

const BITE_FRAMES = 44;
const END_FRAMES = 50;

export class Reeling implements Scene {
  opaque = true;
  private phase: Phase = 'cast';
  private t = 0;
  private pt = 0;
  private wait = 90;
  private kind: Catch | null = null;
  private fight: Fight | null = null;
  private cols: number[][] = [];
  private known = false;
  private first = false;
  private outcome: Outcome | null = null;
  private rings: number[] = [];
  private reeling = false;
  private warned = false;
  private flash = 0;
  private wrapAt = -99;
  private offY = 0;
  private closed = false;
  private rng: Rng;

  /** `kindId` fixes the catch, for a scripted first bite. */
  constructor(private where: string, private done?: () => void, seed?: number, private kindId?: string) {
    this.rng = new Rng(seed ?? Math.floor(Math.random() * 0x7fffffff));
    this.cast();
  }

  enter() { music.play('reel'); }

  private cast() {
    this.phase = 'cast';
    this.pt = 0;
    this.wait = 60 + Math.floor(this.rng.next() * 181);
    this.kind = null;
    this.fight = null;
    this.outcome = null;
    this.reeling = false;
    this.warned = false;
    this.offY = 0;
    this.rings = [this.t];
  }

  private exit() {
    if (this.closed) return;
    this.closed = true;
    app.remove(this);
    this.done?.();
  }

  private bite() {
    const chapter = Math.max(1, app.s.chapter);
    const roll = () => this.rng.next();
    const k = (this.kindId ? catchById(this.kindId) : undefined) ?? pickCatch(this.where, chapter, roll) ?? pickCatch('river', chapter, roll) ?? CATCHES[0];
    this.kind = k;
    this.known = (app.s.fish?.[k.id] ?? 0) > 0;
    this.cols = k.rote.map((l) => colorize(l, (w) => VERB_COLOR[w] ?? null));
    this.fight = startFight(k, roll);
    this.phase = 'bite';
    this.pt = 0;
    this.rings.push(this.t, this.t + 8, this.t + 16);
    sfx.ok();
  }

  private finish(o: Outcome) {
    const k = this.kind!;
    this.outcome = o;
    this.phase = 'end';
    this.pt = 0;
    if (o === 'landed') {
      app.s.fish = app.s.fish ?? {};
      const n = app.s.fish[k.id] ?? 0;
      this.first = n === 0;
      app.s.fish[k.id] = n + 1;
      app.s.blanks += k.blanks;
      sfx.get();
      music.stinger('catch');
    } else {
      sfx.error();
      sfx.hit();
    }
  }

  update() {
    this.t++;
    this.pt++;
    if (this.flash > 0) this.flash--;
    switch (this.phase) {
      case 'cast':
        if (tapped('back')) { sfx.back(); this.exit(); return; }
        if (this.pt % 45 === 30) this.rings.push(this.t);
        if (this.pt >= this.wait) this.bite();
        break;
      case 'bite':
        if (this.pt >= BITE_FRAMES) { this.phase = 'fight'; this.pt = 0; this.flash = 6; sfx.text(); }
        break;
      case 'fight': {
        const f = this.fight!;
        this.reeling = down('ok');
        const ev = tick(f, this.reeling);
        if (ev & EV_BEAT) { sfx.text(); this.flash = 6; }
        if (ev & EV_WRAP) this.wrapAt = this.t;
        if (ev & EV_BOLT) { sfx.hit(); this.rings.push(this.t, this.t + 6); }
        if (this.reeling && this.t % 10 === 0) this.rings.push(this.t);
        if (f.strain >= 80 && !this.warned) { sfx.error(); this.warned = true; }
        else if (f.strain < 55) this.warned = false;
        if (this.rings.length > 24) this.rings = this.rings.filter((b) => this.t - b < 36);
        if (f.over) this.finish(f.over);
        break;
      }
      case 'end':
        if (this.pt >= END_FRAMES) { this.phase = 'card'; this.pt = 0; }
        break;
      case 'card':
        if (this.pt > 10 && tapped('ok')) { sfx.ok(); this.cast(); }
        else if (this.pt > 10 && tapped('back')) { sfx.back(); this.exit(); }
        break;
    }
  }

  // ------------------------------------------------------------ drawing

  draw() {
    const t = this.t;
    const f = this.fight;
    const strain = f && this.phase !== 'cast' ? f.strain : 0;
    rect(0, 0, W, H, 0x000000);
    drawInk(t, this.where === 'tether');
    drawBank();
    drawRipples(this.rings, t);
    drawRuler(f && this.phase !== 'cast' ? f.distance : null);
    if (this.phase === 'cast') this.drawCastLine();
    else if (f) this.drawCatch(f);
    this.drawFisher(strain);
    if (this.phase === 'card') this.drawCard();
    else this.drawTop();
  }

  private drawFisher(strain: number) {
    const t = this.t;
    let sx = 0, sy = 0;
    if (strain > 55) sx = (t >> 1) & 1;
    if (strain > 80) sy = (t >> 2) & 1;
    const bend = strain > 75 ? 2 : strain > 45 ? 1 : 0;
    if (this.where === 'river') drawSprite('reel', 6, SURF - 8);
    drawSprite('wait', WAIT_X + sx, SURF - 8 + sy, { frame: this.reeling && ((t >> 3) & 1) ? 1 : 0 });
    seg(WAIT_X + 8 + sx, SURF - 6 + sy, TIP_X, TIP_Y + bend, 0xaaa4ba);
    const o = ORBIT[this.reeling ? (t >> 1) & 3 : 0];
    dot(WAIT_X + 9 + sx + o[0], SURF - 3 + sy + o[1], 0xf2d25a);
  }

  private drawCastLine() {
    const dip = SURF + 14 + (((this.t >> 5) & 1) ? 1 : 0);
    for (let y = TIP_Y; y < dip; y++) {
      const off = y < SURF ? Math.round(Math.sin(((y - TIP_Y) / (SURF - TIP_Y)) * Math.PI + this.t * 0.08) * 2) : 0;
      dot(TIP_X + off, y, 0xe6dfd0);
    }
    rect(TIP_X - 1, dip, 3, 2, 0xe6dfd0);
  }

  private drawCatch(f: Fight) {
    const k = f.kind;
    const t = this.t;
    const s = stepOf(f);
    const ending = this.phase === 'end' || this.phase === 'card';
    const outcome = this.outcome;
    const verb = ending ? 'wait' : s.verb;
    const base = catchY(f.distance);
    let jx = 0;
    let target = 0;
    if (verb === 'pull') jx = (t >> 1) & 1 ? 1 : -1;
    if (verb === 'dive') target = 6;
    if (verb === 'rest') target = (t >> 4) & 1;
    this.offY += (target - this.offY) * 0.25;
    let cy = base + Math.round(this.offY);
    let cx = TIP_X + jx;
    let ghost: number | undefined;
    if (this.phase === 'bite' && this.pt < 20) ghost = 0;
    if (verb === 'still' && !ending) ghost = 0;
    if (ending && outcome === 'landed') {
      const k2 = Math.min(1, this.pt / 28);
      cy = Math.round(base + (SURF - 14 - base) * k2);
    } else if (ending) {
      cy = Math.min(H - 6, cy + (this.pt >> 2));
      ghost = (this.pt >> 2) & 1 ? 0 : 1;
    }
    const lineEnd = outcome === 'snapped' && ending ? SURF + 4 : cy - 4;
    const taut = (this.reeling && this.phase === 'fight') || f.strain > 25 || (ending && outcome === 'landed');
    const amp = outcome === 'snapped' && ending ? 3 : taut ? 0 : 2;
    const col = lineColor(f.strain);
    for (let y = TIP_Y; y < lineEnd; y++) {
      const off = y < SURF && amp ? Math.round(Math.sin(((y - TIP_Y) / (SURF - TIP_Y)) * Math.PI + t * 0.08) * amp) : 0;
      let c = col;
      if (f.strain > 85 && ((y + t) & 3) === 0) c = 0xffffff;
      dot(TIP_X + off, y, c);
    }
    if (outcome === 'snapped' && ending) {
      for (let i = 0; i < 6; i++) dot(TIP_X + ((i * 5) % 11) - 5, SURF + 6 + ((this.pt * (1 + (i % 3))) >> 2) % 30, 0xff3a3a);
    }
    const x = cx - 4;
    const y = cy - 4;
    const frame = ((t >> (verb === 'pull' ? 2 : 4)) & 1) ? 1 : 0;
    const opts: DrawOpts = ghost === undefined ? { frame } : { frame, dither: ghost };
    if (ghost === undefined && (this.flash > 0 || k.copied)) glow(x, y, k.copied ? C.again : INK_TOP, k.copied ? app.beat() : 0);
    const shade: DrawOpts = { ...opts, look: 'dark', flat: true };
    for (const [dx, dy] of OUTLINE) drawSprite(k.sprite, x + dx, y + dy, shade);
    if (k.copied) drawCopied(k.sprite, x, y, opts, app.beat());
    else drawSprite(k.sprite, x, y, opts);
  }

  private drawTop() {
    const k = this.kind;
    const f = this.fight;
    if (this.phase === 'cast' || !k || !f) {
      const tips = this.tutorial() ? wrap('Hold Z to reel. Let go to let out line. The rote says when the catch rests.', 33) : [];
      panel(4, 4, 184, 30 + tips.length * 8, C.faint);
      text('The line is in the ink.', 10, 10, C.text);
      tips.forEach((l, i) => text(l, 10, 20 + i * 8, C.hi));
      text('X pulls the line out.', 10, 20 + tips.length * 8, C.dim);
      return;
    }
    const n = k.rote.length;
    const h = 18 + n * 8;
    const live = this.phase === 'fight';
    const edge = k.copied ? C.again : this.phase === 'bite' && (this.pt >> 2) & 1 ? C.hi : C.faint;
    panel(4, 4, 184, h, edge);
    const open = this.known || this.outcome === 'landed';
    text(open ? k.name : '???', 10, 8, k.copied ? C.again : open ? C.hi : C.dim);
    const reveal = this.phase === 'bite' ? Math.min(n, this.pt >> 2) : n;
    const cur = live || this.phase === 'end' ? stepOf(f) : null;
    for (let i = 0; i < reveal; i++) {
      const y = 18 + i * 8;
      const smudged = !open && k.smudge.includes(i);
      const lit = cur !== null && cur.line === i;
      const wrapLit = k.rote[i].trim() === 'again' && this.t - this.wrapAt < 8;
      if (lit || wrapLit) rect(6, y - 1, 180, 9, C.sel);
      if (lit) text('\x01', 8, y, this.flash > 0 ? 0xffffff : C.hi);
      if (smudged) {
        const raw = k.rote[i];
        const pad = raw.length - raw.trimStart().length;
        text('~'.repeat(Math.max(3, Math.min(12, raw.trim().length))), 16 + pad * CW, y, SMUDGE);
        continue;
      }
      const row = k.rote[i];
      const cols = this.cols[i];
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== ' ') text(row[c], 16 + c * CW, y, lit && this.flash > 3 ? 0xffffff : wrapLit ? C.again : cols[c]);
      }
    }
    if (live) {
      rect(6, 4 + h - 3, Math.round((180 * f.beat) / f.tempo), 1, C.dim);
      if (stepOf(f).line < 0) rect(16, 18 + n * 8 - 1, 150, 1, this.flash > 0 ? 0xffffff : C.hi);
    }
  }

  private tutorial(): boolean {
    return Object.keys(app.s.fish ?? {}).length === 0;
  }

  private drawCard() {
    const k = this.kind;
    if (!k) return;
    const lime = k.copied ? C.again : C.hi;
    if (this.outcome !== 'landed') {
      panel(22, 76, 148, 38, C.faint);
      text(this.outcome === 'snapped' ? 'The line snaps.' : 'The line runs out.', 30, 84, this.outcome === 'snapped' ? C.bad : C.text);
      text('Z drops the line. X leaves.', 30, 98, C.dim);
      return;
    }
    const lines = wrap(k.note, 31);
    const h = 60 + lines.length * 8;
    const y = Math.max(6, Math.round((H - h) / 2));
    panel(10, y, 172, h, lime);
    rect(16, y + 6, 14, 14, INK_MID);
    for (const [dx, dy] of OUTLINE) drawSprite(k.sprite, 19 + dx, y + 9 + dy, { look: 'dark', flat: true });
    if (k.copied) drawCopied(k.sprite, 19, y + 9, {}, app.beat());
    else drawSprite(k.sprite, 19, y + 9);
    text(k.name, 36, y + 8, k.copied ? C.again : C.text);
    const n = app.s.fish?.[k.id] ?? 1;
    if (this.first) {
      text('\x05', 36, y + 18, C.gold);
      text('new in the log', 44, y + 18, C.gold);
    } else text(`${n} in the log`, 36, y + 18, C.dim);
    lines.forEach((l, i) => text(l, 16, y + 30 + i * 8, C.text));
    text(`+${k.blanks} blanks`, 16, y + 34 + lines.length * 8, C.gold);
    text('Z drops the line. X leaves.', 16, y + h - 12, C.dim);
  }
}

// ---------------------------------------------------------------- the log

interface LogLine { s: string; c: number; x?: number; right?: string; rc?: number }

const LOG_ROWS = 19;
const LOG_TOP = 18;

export function catchCount(s: SaveData): { known: number; total: number } {
  let known = 0;
  for (const c of CATCHES) if ((s.fish?.[c.id] ?? 0) > 0) known++;
  return { known, total: CATCHES.length };
}

export class CatchLog implements Scene {
  opaque = true;
  private lines: LogLine[] = [];
  private top = 0;
  private hold = 0;
  private t = 0;

  enter() { this.build(); }
  resume() { this.build(); }

  private build() {
    const s = app.s;
    const out: LogLine[] = [];
    for (const w of WHERES) {
      const ks = CATCHES.filter((c) => c.where === w);
      const got = ks.filter((c) => (s.fish?.[c.id] ?? 0) > 0).length;
      const name = WHERE_NAMES[w];
      out.push({ s: name.charAt(0).toUpperCase() + name.slice(1), c: C.hi, right: `${got}/${ks.length}`, rc: C.dim });
      for (const k of ks) {
        const n = s.fish?.[k.id] ?? 0;
        if (n > 0) {
          out.push({ s: k.name, c: k.copied ? C.again : C.text, x: 6, right: `x${n}`, rc: C.dim });
          for (const l of wrap(k.note, 31)) out.push({ s: l, c: C.dim, x: 12 });
        } else out.push({ s: '???', c: C.dim, x: 6 });
      }
      out.push({ s: '', c: 0 });
    }
    this.lines = out;
    this.top = Math.min(this.top, Math.max(0, out.length - LOG_ROWS));
  }

  private move(d: number) {
    const max = Math.max(0, this.lines.length - LOG_ROWS);
    const next = Math.max(0, Math.min(max, this.top + d));
    if (next !== this.top) { this.top = next; sfx.move(); }
  }

  update() {
    this.t++;
    if (tapped('back')) { sfx.back(); app.remove(this); return; }
    for (const [dir, d] of [['up', -1], ['down', 1]] as const) {
      if (tapped(dir)) { this.move(d); this.hold = 0; }
      else if (down(dir)) { this.hold++; if (this.hold > 16 && this.hold % 3 === 0) this.move(d); }
    }
    if (!down('up') && !down('down')) this.hold = 0;
  }

  draw() {
    rect(0, 0, W, H, C.bg);
    const { known, total } = catchCount(app.s);
    text('Catch log', 6, 4, C.hi);
    const r = `${known} of ${total}`;
    text(r, W - 6 - r.length * CW, 4, C.dim);
    rect(6, 14, W - 12, 1, C.faint);
    for (let i = 0; i < LOG_ROWS; i++) {
      const l = this.lines[this.top + i];
      if (!l || !l.s) continue;
      const y = LOG_TOP + i * 8;
      text(l.s, 6 + (l.x ?? 0), y, l.c);
      if (l.right) text(l.right, W - 10 - l.right.length * CW, y, l.rc ?? C.dim);
    }
    const n = this.lines.length;
    if (n > LOG_ROWS) {
      const span = LOG_ROWS * 8;
      rect(W - 4, LOG_TOP, 1, span, C.faint);
      const thumb = Math.max(4, Math.round((span * LOG_ROWS) / n));
      rect(W - 4, LOG_TOP + Math.round(((span - thumb) * this.top) / (n - LOG_ROWS)), 1, thumb, C.dim);
    }
    text('Up and down scroll. X leaves.', 6, 180, C.faint);
  }
}
