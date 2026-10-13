// Music engine: a lookahead scheduler over the generators in score/, voiced like a small sound chip.
// Safe to import in Node: nothing touches Web Audio until audio.ts attaches a live context.
import type { AreaTint, BattleCue, BattleCueOpts, TrackId } from './audio';
import { MODE, Rng, VOICE_RANGE, fold, hash, nudge, sectionSig, slipSec, snap, swingSec, timeMap, vary, wrong } from './score/lib';
import type { Ctx, Ev, Key, MemLine, MotifName, TrackDef, Voice } from './score/lib';
import { memoryOf } from './score/motifs';
import { TRACKS } from './score';
import { HANDOVER, bassWalk, commonChord, droneDef, pcsOf, pivotSet, snapPc, tonicTriad } from './score/melt';
import type { MeltMode } from './score/melt';
import { FIGHT_TRACKS, Fight, phaseSection, strength } from './score/fight';
import type { FightGrid, Shaped } from './score/fight';

/** A scheduled note: the score event plus absolute start and length in seconds. */
export interface Note extends Ev {
  at: number;
  dur: number;
  /** Pulse width that replaces the palette's. */
  dw?: number;
  /** Multiplier on the pulse low-pass cutoff. */
  cm?: number;
  /** A vibrato of the note's own, in Hz and cents, in place of the shared one. */
  vibr?: [number, number];
  /** 1 for a note a transition added, 2 for one a fight added. */
  inj?: 1 | 2;
}

export interface Rendered {
  name: string; start: number; secs: number; bpm: number; tag?: string; motifs: MotifName[]; notes: Note[]; sig: string;
  beats: number; bar: number; tempo?: Array<[number, number]>;
}

/** Voices that sound one note at a time. The extra voice may let two notes ring. */
const MONO: ReadonlySet<Voice> = new Set<Voice>(['p1', 'p2', 'tri', 'nz']);
export const X_POLY = 2;
const VOICES: Voice[] = ['p1', 'p2', 'tri', 'nz', 'x'];

function bandsOverlap(a: Ev, b: Ev): boolean {
  return Math.max(a.lay ?? 0, b.lay ?? 0) < Math.min(a.top ?? 2, b.top ?? 2);
}

/** Counts of events before and after normalization per voice, filled in while a tool sets it. */
export const normStats: { on: boolean; in: Record<Voice, number>; out: Record<Voice, number>; cut: Record<Voice, number> } = {
  on: false, in: { p1: 0, p2: 0, tri: 0, nz: 0, x: 0 }, out: { p1: 0, p2: 0, tri: 0, nz: 0, x: 0 }, cut: { p1: 0, p2: 0, tri: 0, nz: 0, x: 0 },
};

/** Enforces the chip's limits: one note at a time on each mono voice, two on the extra voice, nothing past the section end. */
export function normalize(sec: { beats: number; ev: Ev[] }): Ev[] {
  const ev = sec.ev
    .filter((e) => e.t >= -1e-6 && e.t < sec.beats - 1e-6 && e.d > 0 && e.g > 0 && Number.isFinite(e.n) && Number.isFinite(e.t))
    .map((e) => ({ ...e, t: Math.max(0, e.t) }))
    .sort((a, b) => a.t - b.t);
  const byVoice = new Map<Voice, Ev[]>();
  for (const e of ev) { const l = byVoice.get(e.v); if (l) l.push(e); else byVoice.set(e.v, [e]); }
  const dead = new Set<Ev>();
  const d0 = new Map<Ev, number>();
  if (normStats.on) for (const e of ev) d0.set(e, e.d);
  for (const [v, list] of byVoice) {
    if (MONO.has(v)) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (dead.has(a)) continue;
        a.d = Math.min(a.d, sec.beats - a.t);
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (dead.has(b)) continue;
          if (b.t >= a.t + a.d) break;
          if (!bandsOverlap(a, b)) continue;
          // Two notes on one instant: the louder wins, so a kick beats a hat.
          if (b.t - a.t < 0.03) { if (b.g > a.g) { dead.add(a); break; } dead.add(b); continue; }
          a.d = Math.min(a.d, b.t - a.t - 0.01);
          break;
        }
      }
    } else {
      // The extra voice has two channels. A new note takes a free one, or cuts a ringing bell before it cuts a held pad.
      const ringing: Ev[] = [];
      for (const e of list) {
        for (let k = ringing.length - 1; k >= 0; k--) if (ringing[k].t + ringing[k].d <= e.t) ringing.splice(k, 1);
        e.d = Math.min(e.d, sec.beats - e.t);
        const live = ringing.filter((r) => bandsOverlap(r, e));
        if (live.length >= X_POLY) {
          const bells = live.filter((r) => !r.sus);
          const pool = bells.length ? bells : live;
          pool.sort((x, y) => x.t + x.d - (y.t + y.d));
          const old = pool[0];
          ringing.splice(ringing.indexOf(old), 1);
          // A note that has barely started is dropped. Cutting it to a few milliseconds would leave a click.
          if (e.t - old.t < 0.06) dead.add(old);
          else old.d = e.t - old.t - 0.005;
        }
        ringing.push(e);
      }
    }
  }
  const kept = ev.filter((e) => !dead.has(e) && e.d > 0.005);
  if (normStats.on) {
    for (const e of sec.ev) normStats.in[e.v]++;
    for (const e of kept) { normStats.out[e.v]++; if (e.d < (d0.get(e) ?? 0) * 0.6 && e.nz === undefined) normStats.cut[e.v]++; }
  }
  return kept;
}

/** Events the engine asks a section to carry, kept only where their voice has room. */
function fitIn(beats: number, ev: Ev[], add: Ev[]): Ev[] {
  const out: Ev[] = [];
  for (const e of add) {
    if (e.t < 0 || e.t >= beats - 0.5) continue;
    const end = Math.min(beats, e.t + e.d);
    const over = [...ev, ...out].filter((o) => o.v === e.v && o.t < end && o.t + o.d > e.t).length;
    if (over < (e.v === 'x' ? X_POLY : 1)) out.push({ ...e, d: end - e.t });
  }
  return out;
}

export interface SeqEnv { int(): number; prog(): number; recall(): MemLine[] }

/** Walks one track's section graph and renders each section to timed notes. */
export class Seq {
  readonly def: TrackDef;
  private cur: string | null;
  private pass = 0;
  private visits: Record<string, number> = {};
  private st: Record<string, number> = {};
  private mem: Record<string, number[]> = {};
  private seen = new Map<string, Map<string, number>>();
  /** Events to merge into the next section after variation, for the chimes a transition leaves behind. */
  pending: Ev[] = [];

  constructor(readonly id: string, private seed: number, readonly tint: AreaTint, private env: SeqEnv, def?: TrackDef) {
    this.def = def ?? TRACKS[id as TrackId];
    this.cur = this.def.start;
  }

  /** Makes a named section play next. */
  force(name: string): void { if (this.def.secs[name]) this.cur = name; }

  next(start: number): Rendered | null {
    const name = this.cur;
    const def = this.def;
    if (name === null || !def.secs[name]) return null;
    const r = new Rng(this.seed ^ hash(this.id) ^ Math.imul(this.pass + 1, 0x9e3779b1));
    const c: Ctx = { r, pass: this.pass, visit: this.visits[name] ?? 0, int: this.env.int(), prog: this.env.prog(), tint: this.tint, bpm: def.bpm, st: this.st, mem: this.mem, recall: this.env.recall() };
    let sec = def.secs[name](c);
    if (!sec.still) {
      sec = vary(sec, r, def.vary ?? 0.5, def.bendy ?? 0);
      if (r.chance(def.wrong ?? 0.04)) sec = wrong(sec, r, !!def.tame);
      if (r.chance(def.slip ?? 0)) sec = slipSec(sec, r);
      if (def.swing) sec = swingSec(sec, r, def.swing, def.stumble ?? 0);
    }
    if (this.pending.length) {
      sec = { ...sec, ev: [...sec.ev, ...fitIn(sec.beats, sec.ev, this.pending)] };
      this.pending = [];
    }
    // A section that has already played twice in the same form changes a little, so no loop repeats exactly.
    let seen = this.seen.get(name);
    if (!seen) this.seen.set(name, (seen = new Map()));
    if (seen.size > 64) seen.clear();
    let kept: Ev[] = [];
    for (let tries = 0; tries < 4; tries++) {
      if (def.post) sec = def.post(sec);
      kept = normalize(sec);
      const sig = sectionSig({ ...sec, ev: kept });
      const n = seen.get(sig) ?? 0;
      seen.set(sig, n + 1);
      if (n < 1 || !sec.ev.length || tries === 3) break;
      sec = nudge(sec, r);
    }
    const tm = timeMap(sec);
    const notes: Note[] = kept.map((e) => { const a = tm(e.t); return { ...e, at: start + a, dur: Math.max(0.005, tm(e.t + e.d) - a) }; });
    this.visits[name] = c.visit + 1;
    this.pass++;
    let nxt: string | null = null;
    if (def.next) nxt = def.next(name, c);
    else { const opts = def.graph?.[name]; if (opts && opts.length) nxt = r.weighted(opts); }
    this.cur = nxt !== null && def.secs[nxt] ? nxt : null;
    return {
      name, start, secs: Math.max(0.05, tm(sec.beats)), bpm: sec.bpm, tag: sec.tag, motifs: sec.motifs ?? [], notes, sig: sectionSig({ ...sec, ev: kept }),
      beats: sec.beats, bar: sec.bar, tempo: sec.tempo,
    };
  }
}

/** The phrases a fresh session remembers before any track has played. */
export function seedMemory(): MemLine[] {
  return [memoryOf('pilgrim', 'title', TRACKS.title.key, 0)];
}

/** Renders a track without audio, for tests and offline checks. */
export function renderTrack(id: TrackId, seconds: number, opts: { seed?: number; tint?: AreaTint; intensity?: (t: number) => number; prog?: number; recall?: MemLine[] } = {}): Rendered[] {
  let t = 0;
  const recall = opts.recall ?? seedMemory();
  const seq = new Seq(id, opts.seed ?? 1, opts.tint ?? TRACKS[id].tint, { int: () => opts.intensity?.(t) ?? 0, prog: () => opts.prog ?? 0.3, recall: () => recall });
  const out: Rendered[] = [];
  while (t < seconds) {
    const s = seq.next(t);
    if (!s) break;
    out.push(s);
    t += s.secs;
  }
  return out;
}

// ---------------------------------------------------------------- palettes

/** What an area's instruments sound like. A tint swaps the whole palette without changing the notes. */
export interface Palette {
  /** Pulse widths for duty slots 0 to 3. */
  duty: [number, number, number, number];
  /** Pulse low-pass cutoff in Hz. */
  cut: number;
  /** Cutoff multiplier at the start of a pulse note, falling to 1 over 120 ms. Above 1 gives a brass blat. */
  sweep: number;
  att: number;
  dec: number;
  sus: number;
  /** Semitones a pulse note starts below its pitch. */
  scoop: number;
  /** Vibrato rate in Hz and depth in cents. */
  vib: [number, number];
  /** Default FM ratio of the extra voice and its modulation depth. */
  xr: number;
  xi: number;
  echo: number;
  /** Echo delay in seconds. */
  dly: number;
  wob: number;
  /** Kick start Hz, end Hz, and length. */
  kick: [number, number, number];
  /** Hat high-pass cutoff in Hz. */
  hat: number;
}

export const PALETTES: Record<AreaTint, Palette> = {
  brass: { duty: [0.125, 0.25, 0.375, 0.5], cut: 3400, sweep: 2.8, att: 0.012, dec: 0.22, sus: 0.7, scoop: -0.35, vib: [5, 8], xr: 1, xi: 1.5, echo: 0.22, dly: 0.28, wob: 6, kick: [140, 48, 0.2], hat: 6500 },
  sea: { duty: [0.25, 0.375, 0.5, 0.5], cut: 2100, sweep: 0, att: 0.05, dec: 0.35, sus: 0.6, scoop: 0, vib: [3.5, 14], xr: 2, xi: 0.9, echo: 0.58, dly: 0.46, wob: 9, kick: [100, 40, 0.28], hat: 4200 },
  year: { duty: [0.125, 0.25, 0.375, 0.5], cut: 3000, sweep: 1.5, att: 0.006, dec: 0.12, sus: 0.55, scoop: 0, vib: [5.6, 20], xr: 1, xi: 0.55, echo: 0.28, dly: 0.19, wob: 11, kick: [160, 42, 0.2], hat: 8000 },
  stone: { duty: [0.125, 0.125, 0.25, 0.375], cut: 7000, sweep: 0, att: 0.004, dec: 0.18, sus: 0.45, scoop: 0, vib: [0, 0], xr: 5.19, xi: 2.2, echo: 0.62, dly: 0.5, wob: 3, kick: [200, 60, 0.14], hat: 9500 },
  void: { duty: [0.375, 0.5, 0.5, 0.5], cut: 900, sweep: 0, att: 0.25, dec: 0.5, sus: 0.8, scoop: 0, vib: [0.4, 16], xr: 0.5, xi: 0.4, echo: 0.8, dly: 0.7, wob: 14, kick: [70, 30, 0.4], hat: 3000 },
};

/** A palette part of the way from one to another. Pulse widths move in 64ths so the wave cache stays small. */
export function lerpPal(a: Palette, b: Palette, u: number): Palette {
  if (u <= 0 || a === b) return a;
  if (u >= 1) return b;
  const l = (x: number, y: number) => x + (y - x) * u;
  const gm = (x: number, y: number) => x * Math.pow(y / x, u);
  const q = (x: number) => Math.round(x * 64) / 64;
  return {
    duty: [q(l(a.duty[0], b.duty[0])), q(l(a.duty[1], b.duty[1])), q(l(a.duty[2], b.duty[2])), q(l(a.duty[3], b.duty[3]))],
    cut: gm(a.cut, b.cut), sweep: l(a.sweep, b.sweep), att: l(a.att, b.att), dec: l(a.dec, b.dec), sus: l(a.sus, b.sus), scoop: l(a.scoop, b.scoop),
    vib: [l(a.vib[0], b.vib[0]), l(a.vib[1], b.vib[1])], xr: l(a.xr, b.xr), xi: l(a.xi, b.xi), echo: l(a.echo, b.echo), dly: l(a.dly, b.dly), wob: l(a.wob, b.wob),
    kick: [l(a.kick[0], b.kick[0]), l(a.kick[1], b.kick[1]), l(a.kick[2], b.kick[2])], hat: gm(a.hat, b.hat),
  };
}

export const VOICE_BASE: Record<Voice, number> = { p1: 0.3, p2: 0.27, tri: 0.55, nz: 0.4, x: 0.34 };

// ---------------------------------------------------------------- the conductor

/** One rendered section on a player's clock. Beats are the player's global beats, times are real seconds. */
interface Rec { b0: number; beats: number; bar: number; bpm: number; tempo?: Array<[number, number]>; start: number; tab: Float64Array; secs: number; name: string }
/** A queued event. inj is 1 for notes a transition adds and 2 for notes a fight adds. */
interface QN { e: Ev; rec: Rec; gb: number; inj?: 1 | 2; dead?: boolean; until?: number; ov?: number }
/** A tempo glide over a span of a player's beats. hold keeps the last tempo after the span. */
interface Glide { g0: number; g1: number; a: number; b: number; hold: boolean }

/** One track playing on the chip. Several play at once while one melts into the next. */
export interface Player {
  readonly uid: number;
  /** Null for a drone. */
  readonly id: TrackId | null;
  readonly name: string;
  readonly def: TrackDef;
  readonly tint: AreaTint;
  readonly pal: Palette;
  readonly level: number;
  readonly seq: Seq;
  readonly root: number;
  readonly pcs: number[];
  recs: Rec[];
  queue: QN[];
  qi: number;
  gbEnd: number;
  tEnd: number;
  ended: boolean;
  glides: Glide[];
  fight: Fight | null;
  /** After this time the player owns no voice. */
  until: number;
}

/** A transition: when each voice changes hands, how each voice's timbre moves, and the pitch set both keys share. */
export interface Melt {
  t0: number;
  t1: number;
  mode: MeltMode;
  from: Player;
  to: Player;
  h: Record<Voice, number>;
  te: Record<Voice, number>;
  palA: Record<Voice, Palette>;
  pivot: number[] | null;
  /** A chord both keys share. Strong beats inside the transition sound it. */
  chord: number[] | null;
  /** Beats of the outgoing track the transition spans, and the new track's beats per old beat. */
  beats: number;
  k: number;
}

/** Where notes go: Web Audio when live, a list in the checks. */
export interface Sink {
  open(p: Player): void;
  close(p: Player): void;
  /** Voices a note and returns a way to release it early. */
  play(p: Player, n: Note, pal: Palette): ((t: number) => void) | null;
  /** The shared echo and vibrato move from one track's to the next over a transition. from is null when nothing played before. */
  glide(t0: number, t1: number, from: Player | null, to: Player): void;
  wobble(cents: number, now: number): void;
}

/** A voiced note. ge is the global beat where it ends, so a tempo change can shorten it. */
interface Held { p: Player; at: number; end: number; ge: number; n: number; inj: number; rel: ((t: number) => void) | null; src: QN }
interface Own { t: number; p: Player }

const STEP = 1 / 32;
const EMPTY = new Float64Array(2);

function naturalBpm(r: Rec, b: number): number {
  const pts = r.tempo;
  if (!pts || !pts.length) return Math.max(8, r.bpm || 90);
  if (b <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (b <= pts[i][0]) {
      const u = (b - pts[i - 1][0]) / Math.max(1e-6, pts[i][0] - pts[i - 1][0]);
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u;
    }
  }
  return pts[pts.length - 1][1];
}

function bpmEff(p: Player, gb: number, r: Rec | null): number {
  for (let i = p.glides.length - 1; i >= 0; i--) {
    const g = p.glides[i];
    if (gb < g.g0) continue;
    if (gb < g.g1) return g.a + ((g.b - g.a) * (gb - g.g0)) / Math.max(1e-6, g.g1 - g.g0);
    if (g.hold) return g.b;
    break;
  }
  return r ? naturalBpm(r, gb - r.b0) : 120;
}

function tabRec(p: Player, r: Rec) {
  const n = Math.ceil(r.beats / STEP) + 2;
  const tab = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) tab[i + 1] = tab[i] + (STEP * 60) / Math.max(8, bpmEff(p, r.b0 + (i + 0.5) * STEP, r));
  r.tab = tab;
  r.secs = Math.max(0.05, timeIn(r, r.beats));
}

function timeIn(r: Rec, beat: number): number {
  const x = Math.max(0, beat) / STEP;
  const i = Math.min(r.tab.length - 2, Math.floor(x));
  return r.tab[i] + (r.tab[i + 1] - r.tab[i]) * (x - i);
}

function active(e: Ev, level: number): boolean {
  return (e.lay ?? 0) <= level && !(e.top !== undefined && level >= e.top);
}

/** Notes long enough to enter partway through when their voice changes hands. */
function sustained(e: Ev): boolean {
  if (e.v === 'x') return !!e.sus && e.d >= 1.5;
  if (e.v === 'nz') return e.d >= 2 && (e.nz === 'rumble' || e.nz === 'hush' || e.nz === 'steam');
  return e.d >= 1.5;
}

const keyOf = (def: TrackDef, tint: AreaTint): Key => (def.keyFor ? def.keyFor(tint) : def.key);
const pcOf = (n: number): number => ((Math.round(n) % 12) + 12) % 12;
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** Reality breaking: notes drop out, drift in time, and go out of tune. The drift moves a note's end with its start, so notes on one voice never overlap. */
function warpNote(n: Note, w: number, push: number, rand: () => number): Note | null {
  // The bass never drops and a long note rarely does, so reality breaking leaves gaps between notes and not holes in the floor.
  if (n.v !== 'tri' && rand() < w * (n.v === 'nz' ? 0.3 : 0.25) * Math.min(1, 0.5 / Math.max(0.05, n.dur))) return null;
  const k = Math.max(w, push);
  const drift = (t: number) => k * (0.11 * Math.sin(t * 1.3) + 0.07 * Math.sin(t * 0.41 + 1));
  const at = n.at + drift(n.at);
  // The voices drift out of tune almost together, so the chord bends as one and never splits into two keys.
  return { ...n, at, dur: Math.max(0.02, n.at + n.dur + drift(n.at + n.dur) - at), det: (n.det ?? 0) + Math.sin(n.at * 0.8) * w * 18 + (rand() * 2 - 1) * w * 6 };
}

export interface ConductorOpts {
  clock: () => number;
  ahead: () => number;
  sink: Sink;
  muted?: () => boolean;
  rand?: () => number;
  /** Mixed into each track's seed, so two sessions differ. */
  salt?: () => number;
  seed?: number;
}

/**
 * Plays the tracks. A track never fades: a new one takes the chip's voices over one at a time on the beat grid of the old one,
 * while the tempo glides between them and the pitches of both keep to the notes the two keys share.
 */
export class Conductor {
  intensity = 0;
  progress = 0;
  warpTarget = 0;
  memory: MemLine[] = seedMemory();
  readonly players: Player[] = [];
  readonly melts: Melt[] = [];
  cur: Player | null = null;
  /** The fight in progress, if any. */
  fight: Fight | null = null;
  private fightOpen = false;
  private desired: { id: TrackId; tint: AreaTint } | null = null;
  private warpNow = 0;
  private pushNow = 0;
  private own: Record<Voice, Own[]> = { p1: [], p2: [], tri: [], nz: [], x: [] };
  private held: Record<Voice, Held[]> = { p1: [], p2: [], tri: [], nz: [], x: [] };
  private heard: Array<{ at: number; end: number; n: number; bass: boolean; w: number }> = [];
  private seed: number;
  private uid = 0;
  private readonly clock: () => number;
  private readonly ahead: () => number;
  private readonly sink: Sink;
  private readonly muted: () => boolean;
  private readonly rand: () => number;
  private readonly salt: () => number;

  constructor(o: ConductorOpts) {
    this.clock = o.clock; this.ahead = o.ahead; this.sink = o.sink;
    this.muted = o.muted ?? (() => false);
    this.rand = o.rand ?? Math.random;
    this.salt = o.salt ?? (() => 0);
    this.seed = o.seed ?? 1;
  }

  // ------------------------------------------------ clock

  private recAt(p: Player, gb: number): Rec | null {
    const R = p.recs;
    let lo = 0, hi = R.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, r = R[m];
      if (gb < r.b0 - 1e-9) hi = m - 1;
      else if (gb >= r.b0 + r.beats - 1e-9) lo = m + 1;
      else return r;
    }
    return null;
  }

  /** Real seconds at a global beat of a player. */
  realAt(p: Player, gb: number): number {
    const r = this.recAt(p, gb);
    if (r) return r.start + timeIn(r, gb - r.b0);
    const R = p.recs;
    if (!R.length) return p.tEnd + gb * 0.5;
    if (gb < R[0].b0) return R[0].start - ((R[0].b0 - gb) * 60) / bpmEff(p, R[0].b0, R[0]);
    return p.tEnd + ((gb - p.gbEnd) * 60) / bpmEff(p, p.gbEnd, R[R.length - 1]);
  }

  /** The global beat of a player at a real time. */
  beatAt(p: Player, t: number): number {
    const R = p.recs;
    if (!R.length) return 0;
    if (t < R[0].start) return R[0].b0 - ((R[0].start - t) * bpmEff(p, R[0].b0, R[0])) / 60;
    const last = R[R.length - 1];
    if (t >= last.start + last.secs) return p.gbEnd + ((t - last.start - last.secs) * bpmEff(p, p.gbEnd, last)) / 60;
    let lo = 0, hi = R.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R[m].start <= t) lo = m; else hi = m - 1; }
    const r = R[lo], x = t - r.start, tab = r.tab;
    let a = 0, b = tab.length - 2;
    while (a < b) { const m = (a + b + 1) >> 1; if (tab[m] <= x) a = m; else b = m - 1; }
    const u = (x - tab[a]) / Math.max(1e-9, tab[a + 1] - tab[a]);
    return r.b0 + Math.min(r.beats, (a + Math.max(0, Math.min(1, u))) * STEP);
  }

  private bpmAt(p: Player, gb: number): number {
    return bpmEff(p, gb, this.recAt(p, gb) ?? p.recs[p.recs.length - 1] ?? null);
  }

  private beatAfter(p: Player, gb: number): number {
    const r = this.recAt(p, gb);
    if (!r) return p.recs.length && gb < p.recs[0].b0 ? p.recs[0].b0 : Math.ceil(gb - 1e-6);
    const nb = Math.ceil(gb - r.b0 - 1e-6);
    return nb > r.beats - 1e-6 ? r.b0 + r.beats : r.b0 + nb;
  }

  private barAfter(p: Player, gb: number): { gb: number; len: number } {
    const r = this.recAt(p, gb);
    if (!r) {
      if (p.recs.length && gb < p.recs[0].b0) return { gb: p.recs[0].b0, len: p.recs[0].bar };
      return { gb: Math.max(gb, p.gbEnd), len: p.recs[p.recs.length - 1]?.bar ?? 4 };
    }
    const nb = Math.ceil((gb - r.b0) / r.bar - 1e-6) * r.bar;
    if (nb > r.beats - 1e-6) return { gb: r.b0 + r.beats, len: this.recAt(p, r.b0 + r.beats)?.bar ?? r.bar };
    return { gb: r.b0 + nb, len: r.bar };
  }

  private retab(p: Player, fromGb: number) {
    let prev: number | null = null;
    for (const r of p.recs) {
      if (r.b0 + r.beats <= fromGb) continue;
      if (prev !== null) r.start = prev;
      tabRec(p, r);
      prev = r.start + r.secs;
    }
    if (prev !== null) p.tEnd = prev;
  }

  private render(p: Player, untilT: number, untilGb = -Infinity) {
    let guard = 0;
    while (!p.ended && (p.tEnd < untilT || p.gbEnd < untilGb) && guard++ < 24) {
      const s = p.seq.next(p.tEnd);
      if (!s) { p.ended = true; break; }
      const rec: Rec = { b0: p.gbEnd, beats: s.beats, bar: s.bar, bpm: s.bpm, tempo: s.tempo ? [...s.tempo].sort((a, b) => a[0] - b[0]) : undefined, start: p.tEnd, tab: EMPTY, secs: 0, name: s.name };
      tabRec(p, rec);
      p.recs.push(rec);
      for (const n of s.notes) p.queue.push({ e: n, rec, gb: rec.b0 + n.t });
      p.gbEnd += s.beats;
      p.tEnd = rec.start + rec.secs;
    }
    if (p.fight && p.fight.pending.length) this.place(p);
    if (p.recs.length > 16) {
      const old = this.clock() - 30;
      while (p.recs.length > 8 && p.recs[0].start + p.recs[0].secs < old) p.recs.shift();
    }
  }

  private insert(p: Player, q: QN) {
    let lo = p.qi, hi = p.queue.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (p.queue[m].gb <= q.gb) lo = m + 1; else hi = m; }
    p.queue.splice(lo, 0, q);
  }

  /** Moves the notes a fight has added into the queue once their sections exist. */
  private place(p: Player) {
    const f = p.fight;
    if (!f) return;
    const keep = [];
    for (const o of f.pending) {
      if (o.gb >= p.gbEnd - 1e-9) { keep.push(o); continue; }
      const r = this.recAt(p, o.gb);
      if (r) this.insert(p, { e: { ...o.e, t: o.gb - r.b0 }, rec: r, gb: o.gb, inj: 2, until: o.until, ov: o.id });
    }
    f.pending = keep;
  }

  // ------------------------------------------------ voices changing hands

  private ownerAt(v: Voice, t: number): Player | null {
    const l = this.own[v];
    let o: Player | null = null;
    for (const e of l) { if (e.t <= t + 1e-6) o = e.p; else break; }
    return o;
  }

  private gainAt(v: Voice, p: Player, t0: number, t1: number): number | null {
    for (const e of this.own[v]) if (e.t > t0 && e.t < t1 && e.p === p) return e.t;
    return null;
  }

  private setOwner(v: Voice, t: number, p: Player) {
    const l = this.own[v];
    const i = l.findIndex((e) => Math.abs(e.t - t) < 1e-6);
    if (i >= 0) l[i] = { t, p };
    else { l.push({ t, p }); l.sort((a, b) => a.t - b.t); }
  }

  /** The palette a voice sounds with at a time, part of the way through a transition. */
  private palAt(p: Player, v: Voice, t: number): Palette {
    for (let i = this.melts.length - 1; i >= 0; i--) {
      const m = this.melts[i];
      if (t < m.t0 || (m.from !== p && m.to !== p)) continue;
      const u = (t - m.t0) / Math.max(0.01, m.te[v] - m.t0);
      return lerpPal(m.palA[v], m.to.pal, u);
    }
    return p.pal;
  }

  /** The pitch set a note keeps to during a transition. A drone keeps its own notes while the track before it resolves onto them. */
  private pivotAt(p: Player, t: number, strong: boolean): number[] | null {
    for (let i = this.melts.length - 1; i >= 0; i--) {
      const m = this.melts[i];
      if (t >= m.t0 && t < m.t1) return m.to === p && m.to.id === null ? null : strong && m.chord ? m.chord : m.pivot;
    }
    return null;
  }

  private make(id: TrackId | null, def: TrackDef, tint: AreaTint): Player {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345 + this.salt()) >>> 0;
    const K = keyOf(def, tint);
    return {
      uid: ++this.uid, id, name: id ?? 'drone', def, tint, pal: PALETTES[tint], level: def.level ?? 1,
      seq: new Seq(id ?? 'drone', this.seed, tint, { int: () => this.intensity, prog: () => this.progress, recall: () => this.memory }, def),
      root: pcOf(K.root), pcs: pcsOf(K),
      recs: [], queue: [], qi: 0, gbEnd: 0, tEnd: 0, ended: false, glides: [], fight: null, until: Infinity,
    };
  }

  /** The key a player is in at a beat. A fight may have moved it. */
  private keyNow(p: Player, gb: number): { root: number; scale: number[] } {
    return p.fight ? p.fight.keyAt(gb) : { root: p.root, scale: p.pcs };
  }

  private motifOf(p: Player): MotifName {
    return p.def.motifs[0] ?? 'vorn';
  }

  /** Starts a track. The track playing now melts into it. */
  play(id: TrackId, tint?: AreaTint, hint?: number): void {
    const def = TRACKS[id];
    if (!def) return;
    const t = tint && PALETTES[tint] ? tint : def.tint;
    if (this.desired && this.desired.id === id && this.desired.tint === t) return;
    this.desired = { id, tint: t };
    const from = this.cur;
    const intoFight = FIGHT_TRACKS.has(id) && !(from && from.id && FIGHT_TRACKS.has(from.id));
    this.begin(this.make(id, def, t), intoFight ? 'in' : 'map', hint);
  }

  /** The music dissolves into a held drone that the next track grows out of. */
  stop(hint?: number): void {
    this.desired = null;
    const p = this.cur;
    if (!p || p.id === null) return;
    const now = this.clock();
    const g = this.beatAt(p, now + this.ahead());
    const k = this.keyNow(p, g);
    const mode = k.scale.length === 7 ? k.scale.map((x) => (x - k.root + 12) % 12).sort((a, b) => a - b) : [...MODE.aeo];
    this.begin(this.make(null, droneDef(k.root, mode, this.bpmAt(p, g) * 0.75, 'stop', p.tint), p.tint), 'stop', hint, tonicTriad(k));
  }

  /** `chord` replaces the shared chord and pitch set, for a drone that the old track resolves onto. */
  private begin(to: Player, mode: MeltMode, hint?: number, chord?: number[]) {
    const now = this.clock(), lead = now + this.ahead() + 0.04;
    const from = this.cur;
    this.players.push(to);
    this.sink.open(to);
    if (this.fightOpen && to.id && FIGHT_TRACKS.has(to.id)) {
      to.fight = this.fight ? this.fight.carry(to.id, keyOf(to.def, to.tint), this.motifOf(to)) : new Fight(to.id, keyOf(to.def, to.tint), this.motifOf(to));
      this.fight = to.fight;
    }
    if (!from || now > from.until || (from.ended && from.tEnd < lead)) {
      // Nothing is sounding, so the track simply starts.
      const t0 = now + 0.06;
      to.tEnd = t0;
      for (const p of this.players) if (p !== to) p.until = Math.min(p.until, t0);
      for (const v of VOICES) { this.own[v] = this.own[v].filter((e) => e.t <= t0); this.setOwner(v, t0, to); }
      this.render(to, t0 + 1);
      this.sink.glide(t0, t0 + 0.3, null, to);
      this.cur = to;
      return;
    }
    this.render(from, lead + 16);
    const g = this.beatAt(from, lead);
    const gT = mode === 'map' ? this.barAfter(from, g).gb : this.beatAfter(from, g);
    this.render(from, -Infinity, gT + 20);
    const r0 = this.recAt(from, gT) ?? from.recs[from.recs.length - 1];
    const barLen = r0 ? r0.bar : 4;
    const bpmA = this.bpmAt(from, gT);
    const barSecs = (barLen * 60) / bpmA;
    const T0 = this.realAt(from, gT);
    to.tEnd = T0;
    this.render(to, -Infinity, 1);
    const first = to.recs[0];
    const n0 = first ? naturalBpm(first, 0) : bpmA;
    let k = 1, S: number;
    if (mode === 'map') {
      // The new track may count its beats at half or double the old track's rate, whichever keeps the tempo nearest.
      let best = Infinity;
      for (const c of [0.5, 1, 2]) { const d = Math.abs(Math.log(n0 / (bpmA * c))); if (d < best - 1e-9) { best = d; k = c; } }
      const N = hint !== undefined && Number.isFinite(hint) ? clamp(Math.round(hint / barSecs), 1, 4) : clamp(Math.ceil(5 / barSecs), 1, 4);
      S = N * barLen;
    } else if (mode === 'in') {
      // A fight only ever speeds the old track up, at the smallest step that reaches its tempo, and arrives within about two seconds.
      k = n0 / 2 >= bpmA ? 2 : 1;
      S = clamp(Math.floor((2.4 * (bpmA + n0 / k)) / 120), 1, barLen);
    } else if (mode === 'out') S = barLen;
    else S = hint !== undefined && Number.isFinite(hint) && hint < 0.5 ? 2 : barLen;
    const Ln = S * k;
    this.render(to, -Infinity, Ln + 2 * barLen * k + 8);
    const rB = this.recAt(to, Ln) ?? to.recs[to.recs.length - 1];
    const bpmB = rB ? naturalBpm(rB, Ln - rB.b0) : bpmA * k;
    from.glides.push({ g0: gT, g1: gT + S, a: bpmA, b: bpmB / k, hold: true });
    this.retab(from, gT);
    // Notes already voiced end where the new tempo puts their last beat.
    for (const v of VOICES) for (const x of this.held[v]) {
      if (x.p !== from || x.end <= T0) continue;
      const e2 = Math.max(x.at + 0.02, this.realAt(from, x.ge));
      if (e2 < x.end - 0.005) { x.rel?.(e2); x.end = e2; }
    }
    to.glides.push({ g0: 0, g1: Ln, a: bpmA * k, b: bpmB, hold: false });
    this.retab(to, 0);
    // Voices the new track plays at once take the early turns, so the old voices it has no use for yet leave last and nothing falls silent.
    const order = VOICES.slice().sort((x, y) => HANDOVER[mode][x] - HANDOVER[mode][y]);
    const slots = order.map((v) => HANDOVER[mode][v]);
    const used = new Set<Voice>();
    for (const q of to.queue) if (q.gb < Ln && !q.dead && active(q.e, this.intensity)) used.add(q.e.v);
    const grow = mode === 'map' || mode === 'in';
    // A voice the old track leaves empty goes to the new track at once.
    const oldUses = new Set<Voice>();
    for (const x of from.queue) if (x.gb >= gT - 1e-6 && x.gb < gT + S && !x.dead && active(x.e, this.intensity)) oldUses.add(x.e.v);
    for (const v of VOICES) if (this.held[v].some((x) => x.p === from && x.end > T0)) oldUses.add(v);
    const turn = (grow ? [...order.filter((v) => used.has(v)), ...order.filter((v) => !used.has(v))] : order).filter((v) => !grow || oldUses.has(v));
    // Each voice changes hands on a beat, or on a half bar in a longer transition. The old voice keeps playing until the new one has a note to play.
    const T1 = this.realAt(from, gT + S);
    // Between places, an old voice the new track has no note for yet plays on for up to two bars after the change, until the new track first uses it.
    const late = mode === 'map' ? this.realAt(from, gT + S + 2 * barLen) : T1;
    const q = S >= 8 ? (barLen % 2 ? barLen : barLen / 2) : 1;
    const h = {} as Record<Voice, number>;
    for (const v of VOICES) h[v] = T0;
    turn.forEach((v, i) => {
      const t = this.realAt(from, gT + clamp(Math.round((slots[i] * S) / q) * q, 0, S));
      const first = grow ? this.firstOn(to, v, t) : t;
      h[v] = !grow ? t : first <= T1 ? Math.max(t, first) : first <= late ? first : T1;
    });
    for (const p of this.players) if (p !== from && p !== to && p.until > T0) p.until = T0;
    for (const v of VOICES) {
      this.own[v] = this.own[v].filter((e) => e.t <= T0 + 1e-6);
      if (this.ownerAt(v, T0) !== from) this.setOwner(v, T0, from);
      this.setOwner(v, h[v], to);
    }
    const tEnd = Math.max(T1, ...VOICES.map((v) => h[v]));
    from.until = tEnd + 0.01;
    const kA = this.keyNow(from, gT);
    const pivot = chord ?? pivotSet(kA.scale, to.pcs, to.root);
    const shared = chord ?? commonChord(kA.scale, keyOf(to.def, to.tint));
    // A note still ringing outside the shared notes steps to the nearest shared one where the transition starts, so two keys never sound together.
    for (const v of VOICES) for (const x of this.held[v]) {
      if (x.p === to || x.end <= T0 || v === 'nz' || pivot.includes(pcOf(x.n))) continue;
      x.rel?.(Math.max(x.at + 0.01, T0));
      x.end = Math.max(x.at + 0.01, T0);
      const rest = x.ge - gT, r = this.recAt(from, gT);
      if (x.p === from && rest >= 0.5 && sustained(x.src.e) && r) this.insert(from, { e: { ...x.src.e, t: gT - r.b0, d: rest, a: 0.05 }, rec: r, gb: gT, inj: x.src.inj });
    }
    const palA = {} as Record<Voice, Palette>, te = {} as Record<Voice, number>;
    for (const v of VOICES) {
      palA[v] = this.palAt(from, v, T0);
      te[v] = v === 'nz' ? Math.max(h.nz, T0 + 0.05) : v === 'p1' && (mode === 'map' || mode === 'in') ? T1 + 0.5 * (T1 - T0) : Math.max(T1, h[v]);
    }
    this.melts.push({ t0: T0, t1: tEnd, mode, from, to, h, te, palA, pivot, chord: shared, beats: S, k });
    if (this.melts.length > 6) this.melts.shift();
    if (mode === 'map') {
      const gH = this.beatAt(from, h.tri), wl = Math.min(Math.floor(gH - gT + 1e-6), barLen);
      if (wl >= 2 && used.has('tri')) this.walk(from, to, gH - wl, wl, this.beatAt(to, h.tri), pivot);
      this.preview(from, to, gT + Math.ceil(S * 0.25 - 1e-6), this.beatAt(from, h.x));
      this.linger(from, to);
    }
    this.sink.glide(T0, T1, from, to);
    if (from.id) this.remember(from);
    this.cur = to;
  }

  /** When a player first plays a voice at or after a time: a note that starts then, or a long note it can enter partway through. */
  private firstOn(p: Player, v: Voice, t: number): number {
    for (const q of p.queue) {
      if (q.dead || q.e.v !== v || !active(q.e, this.intensity)) continue;
      const at = this.realAt(p, q.gb);
      if (at >= t - 1e-6) return at;
      if (sustained(q.e) && this.realAt(p, q.gb + q.e.d) > t + 0.4) return t;
    }
    return Infinity;
  }

  /** The old bass walks to the new key's first bass note through the notes both keys share. */
  private walk(from: Player, to: Player, gT: number, len: number, gNew: number, set: number[]) {
    const steps = Math.floor(len + 1e-6);
    let a: number | null = null, g = 0.45;
    for (let i = from.queue.length - 1; i >= 0; i--) { const q = from.queue[i]; if (q.e.v === 'tri' && !q.dead && q.gb <= gT + 1e-6) { a = q.e.n; g = Math.min(0.5, q.e.g); break; } }
    let z: number | null = null;
    for (const q of to.queue) if (q.e.v === 'tri' && !q.dead && q.gb + q.e.d > gNew + 0.25) { z = q.e.n; break; }
    const from0 = a ?? fold(from.root, 33), to0 = z ?? fold(to.root, 33);
    const pitches = bassWalk(from0, to0, steps, set);
    for (let i = from.qi; i < from.queue.length; i++) { const q = from.queue[i]; if (q.e.v === 'tri' && q.gb >= gT - 1e-6 && q.gb < gT + len - 1e-6) q.dead = true; }
    pitches.forEach((n, i) => {
      const gb = gT + (i * len) / steps, r = this.recAt(from, gb);
      if (r) this.insert(from, { e: { t: gb - r.b0, d: (len / steps) * 0.75, v: 'tri', n, g, k: 1 }, rec: r, gb, inj: 1 });
    });
  }

  /** The new track's motif enters early on the old track's bell voice. */
  private preview(from: Player, to: Player, ga: number, gz: number) {
    if (gz - ga < 2 || !to.id) return;
    const motif = (to.def.quotes ?? to.def.motifs)[0];
    if (!motif) return;
    const line = memoryOf(motif, to.id, keyOf(to.def, to.tint), this.progress).line;
    const notes: Array<[number, number, number]> = [];
    let t = 0;
    for (const [p, l] of line) { if (notes.length >= 4) break; if (p !== null) notes.push([p, t, l]); t += l; }
    if (!notes.length) return;
    const total = notes[notes.length - 1][1] + notes[notes.length - 1][2];
    const sc = Math.min(1.25, (gz - ga) / Math.max(0.5, total));
    const oct = 12 * Math.round((70 - notes[0][0]) / 12);
    for (let i = from.qi; i < from.queue.length; i++) { const q = from.queue[i]; if (q.e.v === 'x' && q.gb >= ga - 1e-6 && q.gb < gz - 1e-6) q.dead = true; }
    for (const [p, at, l] of notes) {
      const gb = ga + at * sc, r = this.recAt(from, gb);
      if (r && gb < gz) this.insert(from, { e: { t: gb - r.b0, d: Math.max(0.3, l * sc * 0.9), v: 'x', n: p + oct, g: 0.12, ratio: 2, k: 1 }, rec: r, gb, inj: 1 });
    }
  }

  /** The old track's motif lingers in the new one as a memory chime. */
  private linger(from: Player, to: Player) {
    if (!from.id) return;
    const motif = (from.def.quotes ?? from.def.motifs)[0];
    if (!motif) return;
    const line = memoryOf(motif, from.id, keyOf(from.def, from.tint), this.progress).line;
    const K = keyOf(to.def, to.tint), ev: Ev[] = [];
    let t = 1;
    for (const [p, l] of line) {
      if (ev.length >= 4) break;
      const len = Math.min(2.5, Math.max(0.5, l * 1.5));
      if (p !== null) ev.push({ t, d: len * 0.95, v: 'x', n: fold(snap(p, K), 62), g: 0.11, rev: 1, ratio: 2, k: 1 });
      t += len;
    }
    to.seq.pending = ev;
  }

  /** Leaves the motifs of a finished track in memory for the chime layers of later tracks. */
  private remember(old: Player) {
    const def = old.def;
    if (!old.id) return;
    for (const m of def.quotes ?? def.motifs) {
      this.memory.push(memoryOf(m, old.id, keyOf(def, old.tint), this.progress));
      if (this.memory.length > 8) this.memory.shift();
    }
  }

  // ------------------------------------------------ fights

  private grid(p: Player): FightGrid {
    const lead = () => this.clock() + this.ahead() + 0.03;
    const pitchAt = (v: Voice, gb: number): number | null => {
      this.render(p, -Infinity, gb + 1);
      let best: number | null = null;
      for (const q of p.queue) { if (q.gb > gb + 1e-6) break; if (q.e.v === v && !q.dead) best = q.e.n; }
      return best;
    };
    return {
      beatNow: () => { const g = this.beatAt(p, lead()); this.render(p, -Infinity, g + 16); return g; },
      beatAfter: (gb) => this.beatAfter(p, gb),
      barAfter: (gb) => { this.render(p, -Infinity, gb + 8); return this.barAfter(p, gb); },
      bassAt: (gb) => pitchAt('tri', gb),
      leadAt: (gb) => pitchAt('p1', gb),
      leadFree: (g0, g1) => {
        this.render(p, -Infinity, g1);
        for (let i = p.qi; i < p.queue.length; i++) { const q = p.queue[i]; if (q.gb >= g1) break; if (q.gb >= g0 && q.e.v === 'p1' && !q.e.k && !q.dead) return true; }
        return false;
      },
      recall: () => this.memory,
      prog: () => this.progress,
      jump: (gb, phase) => { const sec = phaseSection(p.name, phase, this.recAt(p, gb - 0.01)?.name ?? null); if (sec) this.cut(p, gb, sec); },
    };
  }

  /** Cuts a player's section at a bar line and goes on with a named section. */
  private cut(p: Player, gb: number, name: string) {
    this.render(p, -Infinity, gb + 0.01);
    const r = this.recAt(p, gb);
    if (!r) { p.seq.force(name); return; }
    const i = p.recs.indexOf(r);
    if (gb - r.b0 < 0.01) p.recs.splice(i);
    else { r.beats = gb - r.b0; tabRec(p, r); p.recs.splice(i + 1); }
    const last = p.recs[p.recs.length - 1];
    p.gbEnd = gb;
    p.tEnd = last ? last.start + last.secs : p.tEnd;
    const back = [];
    const keep: QN[] = [];
    for (let j = 0; j < p.queue.length; j++) {
      const q = p.queue[j];
      if (j >= p.qi && q.gb >= gb - 1e-9) { if (q.inj === 2) back.push({ gb: q.gb, e: q.e, until: q.until ?? q.gb + q.e.d, id: q.ov ?? 0 }); continue; }
      if (j >= p.qi && q.gb + q.e.d > gb) q.e = { ...q.e, d: Math.max(0.05, gb - q.gb - 0.02) };
      keep.push(q);
    }
    p.queue = keep.slice(p.qi);
    p.qi = 0;
    if (p.fight && back.length) p.fight.unplace(gb, back);
    const tc = p.tEnd;
    for (const v of VOICES) for (const h of this.held[v]) if (h.p === p && h.end > tc) { h.rel?.(Math.max(h.at + 0.01, tc - 0.006)); h.end = tc; }
    p.seq.force(name);
    p.ended = false;
  }

  /** A battle event. The fight keeps it and the battle music changes because of it. */
  cue(c: BattleCue, o: BattleCueOpts = {}): void {
    if (c === 'start') {
      this.fightOpen = true;
      this.fight = null;
      const p = this.cur;
      if (p && p.id && FIGHT_TRACKS.has(p.id)) {
        p.fight = new Fight(p.id, keyOf(p.def, p.tint), this.motifOf(p));
        this.fight = p.fight;
        this.fight.cue('start', o, this.grid(p));
      }
      return;
    }
    if (c === 'end') { this.endFight(o.won !== false); return; }
    const f = this.fight;
    if (!f) return;
    const p = this.players.find((x) => x.fight === f);
    if (!p || this.clock() > p.until) return;
    f.cue(c, o, this.grid(p));
    this.place(p);
  }

  /** The battle groove slows on the beat and resolves into a held chord, or sinks after a loss. */
  private endFight(won: boolean) {
    this.fightOpen = false;
    this.fight = null;
    const p = this.cur;
    if (!p || !p.id || !FIGHT_TRACKS.has(p.id)) return;
    const g = this.beatAt(p, this.clock() + this.ahead());
    const k = this.keyNow(p, g);
    this.desired = null;
    const def = droneDef(k.root, won ? MODE.ion : MODE.phr, this.bpmAt(p, g) * (won ? 0.5 : 0.4), won ? 'won' : 'lost', p.tint);
    this.begin(this.make(null, def, p.tint), 'out', undefined, won ? [k.root, (k.root + 4) % 12, (k.root + 7) % 12] : tonicTriad(k));
  }

  // ------------------------------------------------ scheduling

  /** The bass note a note's bar starts on, which names the bar's chord. */
  private barRoot(p: Player, i: number): number | null {
    const q = p.queue[i], r = q.rec;
    const bs = r.b0 + Math.floor((q.gb - r.b0) / r.bar + 1e-6) * r.bar;
    for (let j = i; j >= 0 && j > i - 200; j--) {
      const o = p.queue[j];
      if (o.gb < bs - 8) break;
      if (o.e.v === 'tri' && !o.dead && o.gb <= bs + 1e-6 && o.gb + o.e.d > bs - 0.05) return o.e.n;
    }
    for (let j = i; j < p.queue.length && j < i + 200; j++) {
      const o = p.queue[j];
      if (o.gb >= bs + r.bar) break;
      if (o.e.v === 'tri' && !o.dead && o.gb >= bs - 1e-6) return o.e.n;
    }
    return null;
  }

  private lastIn(p: Player, i: number, bar: boolean): boolean {
    const q = p.queue[i];
    const barOf = (x: QN) => Math.floor((x.gb - x.rec.b0) / x.rec.bar + 1e-6);
    for (let j = i + 1; j < Math.min(p.queue.length, i + 200); j++) {
      const o = p.queue[j];
      if (o.dead || o.e.v !== q.e.v || !active(o.e, this.intensity)) continue;
      if (bar) return o.rec !== q.rec || barOf(o) !== barOf(q);
      return o.gb - (q.gb + q.e.d) >= 1 - 1e-6;
    }
    return true;
  }

  /**
   * Keeps the chip honest across players: a note releases another player's note on its voice, or stops before one already placed.
   * A held note a fight's added notes interrupt comes back when they finish, at `until`.
   */
  private clear(p: Player, q: QN, n: Note): boolean {
    const inj = q.inj ?? 0, until = q.until;
    let end = n.at + n.dur;
    for (const h of this.held[n.v]) {
      if (h.end <= n.at + 0.003 || h.at >= end) continue;
      if (h.p === p && inj === h.inj && h.src.ov === q.ov) continue;
      if (h.at <= n.at + 0.003) {
        const t = Math.max(h.at + 0.01, n.at - 0.006);
        if (h.rel) h.rel(t);
        h.end = t;
        const rest = h.ge - (until ?? Infinity);
        if (h.p === p && !h.inj && until !== undefined && rest >= 1 && sustained(h.src.e)) {
          this.render(p, -Infinity, until + 1);
          const r = this.recAt(p, until);
          if (r) this.insert(p, { e: { ...h.src.e, t: until - r.b0, d: rest, a: 0.3 }, rec: r, gb: until });
        }
      } else end = Math.min(end, h.at - 0.006);
    }
    if (end - n.at < 0.02) return false;
    n.dur = end - n.at;
    return true;
  }

  private voice(p: Player, i: number, at: number, now: number) {
    const q = p.queue[i];
    let e = q.e;
    if (!active(e, this.intensity)) return;
    const v = e.v;
    let start = at, late = false;
    if (this.ownerAt(v, at) !== p) {
      // A long note may enter partway through when its voice comes to this player.
      if (!sustained(e)) return;
      const h = this.gainAt(v, p, at, this.realAt(p, q.gb + e.d) - 0.4);
      if (h === null) return;
      start = h; late = true;
    }
    let shaped: Shaped | null = null;
    if (p.fight) {
      if (q.inj === 2 && p.fight.isCancelled(q.ov)) return;
      const r = q.rec, bib = (((q.gb - r.b0) % r.bar) + r.bar) % r.bar;
      shaped = p.fight.shape(e, q.gb, { bib, bar: r.bar, ov: q.inj === 2, phraseEnd: () => this.lastIn(p, i, false), barLast: () => this.lastIn(p, i, true), root: () => this.barRoot(p, i) });
      const ag = shaped?.again;
      if (ag) {
        this.render(p, -Infinity, ag.gb + 1);
        const r2 = this.recAt(p, ag.gb);
        if (r2) this.insert(p, { e: { ...q.e, t: ag.gb - r2.b0, d: ag.d, a: 0.3 }, rec: r2, gb: ag.gb });
      }
      if (!shaped || shaped.drop) return;
      e = shaped.e;
    }
    const end = this.realAt(p, q.gb + e.d);
    if (end - start < 0.02) return;
    if (v !== 'nz') {
      const r = q.rec, pv = this.pivotAt(p, start, strength((((q.gb - r.b0) % r.bar) + r.bar) % r.bar, r.bar) === 2);
      if (pv) {
        let x = snapPc(e.n, pv);
        const [lo, hi] = VOICE_RANGE[v];
        while (x > hi) x -= 12;
        while (x < lo) x += 12;
        e = { ...e, n: x };
      }
    }
    let n: Note = { ...e, at: start, dur: end - start };
    if (q.inj) n.inj = q.inj;
    if (shaped) { if (shaped.dw !== undefined) n.dw = shaped.dw; if (shaped.cm !== undefined) n.cm = shaped.cm; if (shaped.vibr) n.vibr = shaped.vibr; }
    if (late) n.a = Math.min(0.3, (end - start) * 0.3);
    if (this.muted()) return;
    if (this.warpNow > 0.002 || this.pushNow > 0.002) { const w = warpNote(n, this.warpNow, this.pushNow, this.rand); if (!w || w.at < now) return; n = w; }
    // A few milliseconds of play off the grid, so the chip does not sound like a metronome. The bass and drums stay tighter.
    const slack = v === 'p1' || v === 'p2' || v === 'x' ? 0.012 : 0.004;
    if (n.at - now > slack) n = { ...n, at: n.at + (this.rand() - 0.5) * slack };
    if (!this.clear(p, q, n)) return;
    let rel: ((t: number) => void) | null = null;
    try { rel = this.sink.play(p, n, this.palAt(p, v, n.at)); } catch { /* one bad note must not stop the score */ }
    this.held[v].push({ p, at: n.at, end: n.at + n.dur, ge: q.gb + e.d, n: n.n, inj: q.inj ?? 0, rel, src: q });
    if (v !== 'nz') this.hear(n);
  }

  private fill(p: Player, now: number, horizon: number) {
    if (now > p.until) return;
    // A stalled timer leaves the player behind. It picks up from now instead of rushing through the backlog.
    if (!p.ended && p.recs.length && p.tEnd < now - 0.3) { p.tEnd = now + 0.05; p.queue = []; p.qi = 0; }
    this.render(p, horizon + 0.05);
    while (p.qi < p.queue.length) {
      const q = p.queue[p.qi];
      if (q.dead) { p.qi++; continue; }
      const at = q.rec.start + timeIn(q.rec, q.e.t);
      if (at >= horizon) break;
      p.qi++;
      if (at < now - 0.01 || at >= p.until) continue;
      this.voice(p, p.qi - 1, at, now);
    }
    if (p.qi > 512) { p.queue = p.queue.slice(p.qi); p.qi = 0; }
  }

  private wobbleAt(now: number): number {
    const wob = (p: Player) => p.def.wobble ?? p.pal.wob;
    const m = this.melts[this.melts.length - 1];
    if (m && now >= m.t0 && now < m.t1) return wob(m.from) + (wob(m.to) - wob(m.from)) * ((now - m.t0) / Math.max(0.01, m.t1 - m.t0));
    return this.cur ? wob(this.cur) : 6;
  }

  /** Runs every 25 ms: schedules the next stretch of every player and lets finished players go. */
  tick(): void {
    const now = this.clock(), ahead = this.ahead();
    const fp = this.fight ? this.players.find((x) => x.fight === this.fight) : undefined;
    const push = fp && this.fight ? this.fight.pushAt(this.beatAt(fp, now)) : 0;
    this.warpNow += (this.warpTarget - this.warpNow) * 0.06;
    if (Math.abs(this.warpTarget - this.warpNow) < 0.002) this.warpNow = this.warpTarget;
    this.pushNow += (push - this.pushNow) * 0.1;
    if (Math.abs(push - this.pushNow) < 0.002) this.pushNow = push;
    this.sink.wobble(this.wobbleAt(now) + this.warpNow * 25 + this.pushNow * 10, now);
    // Warp can pull a note up to 0.18 s early, so notes are scheduled that much sooner and none lands in the past.
    for (const p of this.players.slice()) this.fill(p, now, now + ahead + 0.19 * Math.max(this.warpNow, this.pushNow));
    for (let i = this.players.length - 1; i >= 0; i--) {
      const p = this.players[i];
      if (p !== this.cur && now > p.until + 4) { this.sink.close(p); this.players.splice(i, 1); }
    }
    for (const v of VOICES) {
      const h = this.held[v];
      if (h.length > 24) this.held[v] = h.filter((x) => x.end > now - 0.1);
      const o = this.own[v];
      let k = 0;
      while (k + 1 < o.length && o[k + 1].t < now - 5) k++;
      if (k) o.splice(0, k);
    }
    if (this.heard.length > 300) this.heard = this.heard.filter((x) => x.at > now - HEARD_SECS);
  }

  private hear(n: Note) {
    this.heard.push({ at: n.at, end: n.at + n.dur, n: n.n, bass: n.v === 'tri', w: Math.min(1, n.g) * Math.min(2, n.dur) });
  }

  /** The key now sounding: its root as a pitch class, the pitch classes of its scale, and the pitch classes sounding now. Null when no track plays. */
  harmony(): { root: number; scale: number[]; chord: number[] } | null {
    if (!this.cur) return null;
    const t = this.clock();
    const recent = this.heard.filter((h) => h.at > t - HEARD_SECS && h.at <= t + 0.15);
    if (!recent.length) return null;
    const all = new Array<number>(12).fill(0), low = new Array<number>(12).fill(0);
    let total = 0;
    for (const h of recent) { const w = h.w * (h.bass ? 1.5 : 1); all[pcOf(h.n)] += w; total += w; if (h.bass) low[pcOf(h.n)] += h.w; }
    const order = all.map((w, i) => [i, w] as const).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const scale: number[] = [];
    let sum = 0;
    for (const i of order) { if (scale.length >= 7 || (scale.length >= 5 && sum >= total * 0.93)) break; scale.push(i); sum += all[i]; }
    const lowMax = Math.max(...low);
    const root = lowMax > 0 ? low.indexOf(lowMax) : scale[0];
    const chord = [...new Set(recent.filter((h) => h.at <= t + 0.02 && h.end > t).map((h) => pcOf(h.n)))];
    return { root, scale, chord };
  }
}

/** Recently voiced notes are kept this long to read the key. */
const HEARD_SECS = 8;

// ---------------------------------------------------------------- offline

/** A note the offline sink recorded, with the level it reaches before the master gain. */
export interface SimNote extends Note { pid: number; track: string; w: number; hold: number }

/** Records notes instead of playing them, for the checks. */
export class RecordSink implements Sink {
  notes: SimNote[] = [];
  open(): void { /* nothing to build */ }
  close(): void { /* nothing to free */ }
  play(p: Player, n: Note, pal: Palette): (t: number) => void {
    const s: SimNote = { ...n, pid: p.uid, track: p.name, w: Math.min(1, n.g) * VOICE_BASE[n.v] * (p.def.mix?.[n.v] ?? 1) * p.level, hold: pal.sus };
    this.notes.push(s);
    return (t: number) => { s.dur = Math.max(0.005, Math.min(s.dur, t - s.at)); };
  }
  glide(): void { /* no shared effects offline */ }
  wobble(): void { /* no shared effects offline */ }
}

/** A conductor on a simulated clock that ticks every 25 ms, as the live timer does. */
export function offline(seed = 1): { c: Conductor; sink: RecordSink; now: () => number; run: (until: number) => void } {
  let t = 0;
  const sink = new RecordSink();
  const r = new Rng(seed * 7919 + 13);
  const c = new Conductor({ clock: () => t, ahead: () => 0.12, sink, rand: () => r.next(), seed });
  return { c, sink, now: () => t, run: (until: number) => { while (t < until) { c.tick(); t += 0.025; } } };
}

// ---------------------------------------------------------------- voices

const PAN: Record<Voice, number> = { p1: -0.25, p2: 0.25, tri: 0, nz: 0.06, x: 0.12 };
const SEND: Record<Voice, number> = { p1: 0.5, p2: 0.5, tri: 0.1, nz: 0.22, x: 1 };

interface Kit {
  waves: Map<number, PeriodicWave>;
  tri: PeriodicWave;
  /** The triangle with a stronger second and third harmonic, for bass notes that a small speaker cannot play. */
  triLow: PeriodicWave;
  white: AudioBuffer;
  metal: AudioBuffer;
  /** Every pitched node's detune listens here: tape wobble and the one-shot pitch bend. */
  pitch: GainNode;
  wob: GainNode;
  bend: ConstantSourceNode | null;
  vibLfo: OscillatorNode;
  vib: GainNode;
  bus: GainNode;
  /** Ducks the music under stingers, important effects, and speech. */
  duck: GainNode;
  echoIn: GainNode;
  delays: DelayNode[];
}

/** A player's share of the audio graph. */
interface Nodes { out: GainNode; chans: Record<Voice, GainNode>; sends: Record<Voice, GainNode>; all: AudioNode[]; live: Set<AudioScheduledSourceNode> }

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let ac: AudioContext | null = null;
let kit: Kit | null = null;
let muted: () => boolean = () => false;
let live: Conductor | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let wanted: { id: TrackId; tint?: AreaTint; hint?: number } | null = null;
let intensity0 = 0;
let progress0 = 0;
let warp0 = 0;
/** The music's overall level before the master gain. Whorl's user found its music a little loud at about -30 dB and wanted it near -32, and this game has no volume setting, so its music sits near -31 dB. */
export const MUSIC_LEVEL = 0.2;
/** Notes below this MIDI pitch use the triangle with extra harmonics. */
const LOW_BASS = 38;

function pulseWave(k: Kit, a: BaseAudioContext, duty: number): PeriodicWave {
  const key = Math.round(duty * 1000);
  let w = k.waves.get(key);
  if (!w) {
    const H = 28, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let h = 1; h <= H; h++) re[h] = Math.sin(Math.PI * h * duty) / h;
    w = a.createPeriodicWave(re, im);
    k.waves.set(key, w);
  }
  return w;
}

function buildKit(a: BaseAudioContext, master: AudioNode): Kit {
  // A 32-step triangle, the stepped shape of a console bass channel.
  const N = 256, H = 32, x = new Float32Array(N);
  for (let i = 0; i < N; i++) { const ph = i / N; const tri = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4; x[i] = Math.round(tri * 7.5) / 7.5; }
  const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) {
    let s = 0, c = 0;
    for (let i = 0; i < N; i++) { c += x[i] * Math.cos((2 * Math.PI * h * i) / N); s += x[i] * Math.sin((2 * Math.PI * h * i) / N); }
    re[h] = (2 * c) / N; im[h] = (2 * s) / N;
  }
  const tri = a.createPeriodicWave(re, im);
  const reL = re.slice(), imL = im.slice();
  const fund = Math.hypot(re[1], im[1]);
  imL[2] += 0.42 * fund; imL[3] += 0.3 * fund;
  const triLow = a.createPeriodicWave(reL, imL);
  const sr = a.sampleRate;
  const white = a.createBuffer(1, sr * 2, sr);
  const wd = white.getChannelData(0);
  for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
  // Short-mode shift-register noise: a buzzy metallic loop.
  const metal = a.createBuffer(1, sr, sr);
  const md = metal.getChannelData(0);
  let reg = 1, v = 1;
  const hold = Math.max(1, Math.round(sr / 9000));
  for (let i = 0; i < md.length; i++) {
    if (i % hold === 0) { const bit = (reg ^ (reg >> 6)) & 1; reg = (reg >> 1) | (bit << 14); v = reg & 1 ? 1 : -1; }
    md[i] = v;
  }
  const pitch = a.createGain();
  pitch.gain.value = 1;
  const wob = a.createGain();
  wob.gain.value = 6;
  wob.connect(pitch);
  let bend: ConstantSourceNode | null = null;
  if (typeof a.createConstantSource === 'function') {
    bend = a.createConstantSource();
    bend.offset.value = 0;
    bend.connect(pitch);
    bend.start();
  }
  for (const [f, g] of [[0.19, 1], [0.061, 0.7]] as const) {
    const o = a.createOscillator(), og = a.createGain();
    o.frequency.value = f; og.gain.value = g;
    o.connect(og); og.connect(wob); o.start();
  }
  const vibLfo = a.createOscillator(), vib = a.createGain();
  vibLfo.frequency.value = 5; vib.gain.value = 0;
  vibLfo.connect(vib); vibLfo.start();
  const bus = a.createGain();
  bus.gain.value = MUSIC_LEVEL;
  const duck = a.createGain();
  bus.connect(duck); duck.connect(master);
  // The echo bounces left and right. A low-pass in the loop darkens each repeat, as on a tape echo, so the room keeps the chip's character.
  const echoIn = a.createGain();
  const echoOut = a.createGain();
  echoOut.gain.value = 0.45;
  echoOut.connect(bus);
  const delays: DelayNode[] = [];
  const hop = (pan: number): { dl: DelayNode; tail: AudioNode } => {
    const dl = a.createDelay(1.5);
    dl.delayTime.value = 0.34;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    dl.connect(lp);
    delays.push(dl);
    let out: AudioNode = lp;
    if (typeof a.createStereoPanner === 'function') {
      const p = a.createStereoPanner();
      p.pan.value = pan;
      lp.connect(p); out = p;
    }
    out.connect(echoOut);
    return { dl, tail: lp };
  };
  const L = hop(-0.55), R = hop(0.55);
  const fbLR = a.createGain(), fbRL = a.createGain();
  fbLR.gain.value = 0.4; fbRL.gain.value = 0.4;
  echoIn.connect(L.dl);
  L.tail.connect(fbLR); fbLR.connect(R.dl);
  R.tail.connect(fbRL); fbRL.connect(L.dl);
  return { waves: new Map(), tri, triLow, white, metal, pitch, wob, bend, vibLfo, vib, bus, duck, echoIn, delays };
}

const echoOf = (p: Player): number => p.def.echo ?? p.pal.echo;

function openNodes(a: BaseAudioContext, k: Kit, p: Player): Nodes {
  const out = a.createGain();
  out.gain.value = p.level;
  out.connect(k.bus);
  const all: AudioNode[] = [out];
  const chans = {} as Record<Voice, GainNode>, sends = {} as Record<Voice, GainNode>;
  for (const v of VOICES) {
    const g = a.createGain();
    g.gain.value = VOICE_BASE[v] * (p.def.mix?.[v] ?? 1);
    let tail: AudioNode = g;
    if (typeof a.createStereoPanner === 'function') {
      const pn = a.createStereoPanner();
      pn.pan.value = PAN[v];
      tail.connect(pn); tail = pn; all.push(pn);
    }
    tail.connect(out);
    const s = a.createGain();
    s.gain.value = echoOf(p) * SEND[v];
    tail.connect(s); s.connect(k.echoIn); all.push(s);
    all.push(g);
    chans[v] = g;
    sends[v] = s;
  }
  return { out, chans, sends, all, live: new Set() };
}

function trackNode(nd: Nodes, src: AudioScheduledSourceNode, extra: AudioNode[], params: AudioParam[], k: Kit) {
  nd.live.add(src);
  src.onended = () => {
    nd.live.delete(src);
    try { src.disconnect(); } catch { /* ignore */ }
    for (const n of extra) { try { n.disconnect(); } catch { /* ignore */ } }
    for (const a of params) { try { k.pitch.disconnect(a); } catch { /* ignore */ } try { k.vib.disconnect(a); } catch { /* ignore */ } }
  };
}

/** A way to let a note go early: the envelope holds where it is and falls away in a few milliseconds. */
function releaser(g: AudioParam, srcs: AudioScheduledSourceNode[]): (t: number) => void {
  return (t: number) => {
    try {
      const p = g as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
      if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
      g.setTargetAtTime(0, t, 0.012);
      for (const s of srcs) s.stop(t + 0.1);
    } catch { /* the note may already have ended */ }
  };
}

function envelope(p: AudioParam, at: number, dur: number, peak: number, a: number, rel: number, sus: number, dec: number) {
  p.setValueAtTime(0, at);
  p.linearRampToValueAtTime(peak, at + a);
  if (dur > a + 0.01) p.setTargetAtTime(peak * sus, at + a, dec);
  p.setTargetAtTime(0, at + Math.max(dur, a), rel / 5);
}

function bendTo(p: AudioParam, f: number, at: number, dur: number, semis: number) {
  p.setValueAtTime(f, at + dur * 0.5);
  p.exponentialRampToValueAtTime(f * Math.pow(2, semis / 12), at + dur);
}

function voiceNote(a: BaseAudioContext, k: Kit, nd: Nodes, n: Note, pal: Palette, spread: number): (t: number) => void {
  const ch = nd.chans[n.v];
  const at = n.at, dur = Math.max(0.02, n.dur), g = Math.min(1, n.g);
  if (n.v === 'nz') return noiseNote(a, k, nd, n, ch, pal);
  const f = mtof(n.n);
  if (n.v === 'p1' || n.v === 'p2' || n.v === 'tri') {
    const o = a.createOscillator();
    const isTri = n.v === 'tri';
    o.setPeriodicWave(isTri ? (n.n < LOW_BASS ? k.triLow : k.tri) : pulseWave(k, a, n.dw ?? pal.duty[(n.duty ?? 1) & 3]));
    if (!isTri && pal.scoop) {
      o.frequency.setValueAtTime(f * Math.pow(2, pal.scoop / 12), at);
      o.frequency.linearRampToValueAtTime(f, at + 0.05);
    } else o.frequency.setValueAtTime(f, at);
    if (n.bend) bendTo(o.frequency, f, at, dur, n.bend);
    o.detune.value = (n.det ?? 0) + (n.v === 'p2' ? spread : 0) + (Math.random() * 6 - 3);
    k.pitch.connect(o.detune);
    const eg = a.createGain();
    const extra: AudioNode[] = [eg];
    const srcs: AudioScheduledSourceNode[] = [o];
    if (!isTri) {
      if (n.vibr) {
        const l = a.createOscillator(), lg = a.createGain();
        l.frequency.value = n.vibr[0]; lg.gain.value = n.vibr[1];
        l.connect(lg); lg.connect(o.detune);
        l.start(at); l.stop(at + dur + 0.1);
        trackNode(nd, l, [lg], [], k);
        srcs.push(l);
      } else k.vib.connect(o.detune);
    }
    let head: AudioNode = o;
    if (!isTri) {
      const fl = a.createBiquadFilter();
      const cut = Math.min(12000, pal.cut * (n.cm ?? 1));
      fl.type = 'lowpass'; fl.Q.value = 0.5;
      if (pal.sweep > 1) {
        fl.frequency.setValueAtTime(Math.min(12000, cut * pal.sweep), at);
        fl.frequency.exponentialRampToValueAtTime(cut, at + 0.12);
      } else fl.frequency.value = cut;
      o.connect(fl); head = fl; extra.push(fl);
    }
    if (isTri) envelope(eg.gain, at, dur, g, n.a ?? 0.006, 0.03, 1, 1);
    else envelope(eg.gain, at, dur, g, n.a ?? pal.att, 0.06, pal.sus, pal.dec);
    head.connect(eg); eg.connect(ch);
    o.start(at); o.stop(at + dur + 0.1);
    trackNode(nd, o, extra, [o.detune], k);
    return releaser(eg.gain, srcs);
  }
  // The extra voice: two-operator FM. It rings like a bell, or holds like a pad when marked sus.
  const ratio = n.ratio ?? pal.xr;
  const car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain(), eg = a.createGain();
  car.frequency.setValueAtTime(f, at);
  mod.frequency.setValueAtTime(f * ratio, at);
  if (n.bend) { bendTo(car.frequency, f, at, dur, n.bend); bendTo(mod.frequency, f * ratio, at, dur, n.bend); }
  car.detune.value = n.det ?? 0;
  mod.detune.value = n.det ?? 0;
  k.pitch.connect(car.detune); k.pitch.connect(mod.detune);
  k.vib.connect(car.detune);
  const idx = pal.xi;
  const ring = Math.min(dur, 1.4) + 0.01;
  let end: number;
  if (n.rev) {
    // A bell played backwards: it swells up to the strike and stops there.
    end = at + dur + 0.04;
    mg.gain.setValueAtTime(Math.max(0.01, f * 0.1), at);
    mg.gain.exponentialRampToValueAtTime(f * idx * 1.4, at + dur);
    eg.gain.setValueAtTime(0.0006, at);
    eg.gain.exponentialRampToValueAtTime(g, at + dur * 0.94);
    eg.gain.linearRampToValueAtTime(0, end);
  } else {
    mg.gain.setValueAtTime(f * idx * (n.sus ? 0.7 : 1.4), at);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * 0.1), at + ring);
    end = at + dur + (n.sus ? 0.5 : 0.35);
    if (n.sus) envelope(eg.gain, at, dur, g, n.a ?? 0.25, 0.45, 0.9, 0.5);
    else {
      eg.gain.setValueAtTime(0, at);
      eg.gain.linearRampToValueAtTime(g, at + (n.a ?? 0.004));
      eg.gain.exponentialRampToValueAtTime(0.0006, end);
    }
  }
  mod.connect(mg); mg.connect(car.frequency); car.connect(eg); eg.connect(ch);
  car.start(at); mod.start(at); car.stop(end + 0.02); mod.stop(end + 0.02);
  trackNode(nd, car, [eg, mg], [car.detune, mod.detune], k);
  trackNode(nd, mod, [], [], k);
  return releaser(eg.gain, [car, mod]);
}

function noiseNote(a: BaseAudioContext, k: Kit, nd: Nodes, n: Note, ch: AudioNode, pal: Palette): (t: number) => void {
  const at = n.at, dur = Math.max(0.02, n.dur), g = Math.min(1, n.g), kind = n.nz ?? 'hat';
  const eg = a.createGain();
  eg.connect(ch);
  if (kind === 'kick' || kind === 'tom' || kind === 'drip') {
    const o = a.createOscillator();
    o.type = 'sine';
    let f0: number, f1: number, len: number;
    if (kind === 'kick') [f0, f1, len] = pal.kick;
    else if (kind === 'tom') { f0 = mtof(n.n >= 40 ? n.n : 55) * 1.6; f1 = f0 * 0.45; len = 0.2; }
    else { f0 = 1300; f1 = 520; len = 0.07; }
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + len * 0.6);
    eg.gain.setValueAtTime(g, at);
    eg.gain.exponentialRampToValueAtTime(0.001, at + len);
    o.connect(eg); o.start(at); o.stop(at + len + 0.03);
    trackNode(nd, o, [eg], [], k);
    return releaser(eg.gain, [o]);
  }
  const src = a.createBufferSource(), f = a.createBiquadFilter();
  const metal = kind === 'tick' || kind === 'tock' || kind === 'gear' || kind === 'type' || kind === 'crack';
  src.buffer = metal ? k.metal : k.white;
  src.loop = true;
  let end = at + dur;
  let shaped = false;
  if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = pal.hat; end = at + Math.min(dur, 0.07); }
  else if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; end = at + 0.16; }
  else if (kind === 'tick') { f.type = 'highpass'; f.frequency.value = 3500; end = at + 0.03; }
  else if (kind === 'tock') { f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2; src.playbackRate.value = 0.5; end = at + 0.04; }
  else if (kind === 'stamp') { f.type = 'lowpass'; f.frequency.value = 1100; end = at + 0.2; }
  else if (kind === 'gear') { f.type = 'bandpass'; f.frequency.value = 520 + (n.n % 12) * 55; f.Q.value = 4.5; src.playbackRate.value = 0.7; end = at + 0.1; }
  else if (kind === 'type') { f.type = 'bandpass'; f.frequency.value = 2300; f.Q.value = 1.6; end = at + 0.04; }
  else if (kind === 'crack') { f.type = 'highpass'; f.frequency.value = 5200; end = at + 0.025; }
  else if (kind === 'clap') { f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9; end = at + 0.14; }
  else if (kind === 'rumble') { f.type = 'lowpass'; f.frequency.value = 170; f.Q.value = 0.5; shaped = true; }
  else if (kind === 'steam') { f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.8; shaped = true; }
  else if (kind === 'hush') { f.type = 'bandpass'; f.frequency.value = 3100; f.Q.value = 0.7; shaped = true; }
  else if (kind === 'sweep') {
    f.type = 'bandpass'; f.Q.value = 5;
    const lo = 300, hi = 3600, up = n.n < 60;
    f.frequency.setValueAtTime(up ? lo : hi, at);
    f.frequency.exponentialRampToValueAtTime(up ? hi : lo, at + dur);
    shaped = true;
  } else { f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.3; shaped = kind === 'rush'; }
  if (shaped || kind === 'rush') envelope(eg.gain, at, dur, g, n.a ?? dur * 0.4, 0.4, 1, 1);
  else if (kind === 'clap') {
    eg.gain.setValueAtTime(0, at);
    for (let i = 0; i < 3; i++) { eg.gain.setValueAtTime(g * (0.5 + 0.25 * i), at + i * 0.011); eg.gain.exponentialRampToValueAtTime(0.1 * g, at + i * 0.011 + 0.009); }
    eg.gain.setValueAtTime(g, at + 0.033);
    eg.gain.exponentialRampToValueAtTime(0.001, end);
  } else { eg.gain.setValueAtTime(g, at); eg.gain.exponentialRampToValueAtTime(0.001, end); }
  src.connect(f); f.connect(eg);
  src.start(at, Math.random() * 0.9);
  src.stop(Math.max(end, at + dur) + 0.45);
  trackNode(nd, src, [f, eg], [], k);
  return releaser(eg.gain, [src]);
}

/** Moves an audio parameter in a straight line over a span, holding where any earlier automation leaves it. */
function rampParam(p: AudioParam, v: number, t0: number, t1: number) {
  try {
    const q = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
    if (typeof q.cancelAndHoldAtTime === 'function') q.cancelAndHoldAtTime(t0);
    else { p.cancelScheduledValues(t0); p.setValueAtTime(p.value, t0); }
    p.linearRampToValueAtTime(v, Math.max(t0 + 0.01, t1));
  } catch { /* ignore */ }
}

/** Plays a conductor's notes through Web Audio on one context. */
function webSink(a: BaseAudioContext, kit: Kit): Sink {
  const nodes = new Map<number, Nodes>();
  let wobSent = -1;
  return {
    open(p) {
      try { nodes.set(p.uid, openNodes(a, kit, p)); } catch { /* the player stays silent */ }
    },
    close(p) {
      const nd = nodes.get(p.uid);
      if (!nd) return;
      for (const s of nd.live) { try { s.stop(); } catch { /* ignore */ } }
      nd.live.clear();
      for (const n of nd.all) { try { n.disconnect(); } catch { /* ignore */ } }
      nodes.delete(p.uid);
    },
    play(p, n, pal) {
      const nd = nodes.get(p.uid);
      return nd ? voiceNote(a, kit, nd, n, pal, p.def.spread ?? 7) : null;
    },
    glide(t0, t1, from, to) {
      const pb = to.pal;
      if (!from) {
        kit.vibLfo.frequency.setTargetAtTime(pb.vib[0] || 1, t0, 0.3);
        kit.vib.gain.setTargetAtTime(pb.vib[1], t0, 0.3);
        for (const d of kit.delays) d.delayTime.setTargetAtTime(pb.dly, t0, 0.4);
        return;
      }
      rampParam(kit.vibLfo.frequency, pb.vib[0] || 1, t0, t1);
      rampParam(kit.vib.gain, pb.vib[1], t0, t1);
      for (const d of kit.delays) rampParam(d.delayTime, pb.dly, t0, t1);
      const x = nodes.get(from.uid), y = nodes.get(to.uid);
      for (const v of VOICES) {
        if (x) rampParam(x.sends[v].gain, echoOf(to) * SEND[v], t0, t1);
        if (y) { y.sends[v].gain.setValueAtTime(echoOf(from) * SEND[v], a.currentTime); rampParam(y.sends[v].gain, echoOf(to) * SEND[v], t0, t1); }
      }
    },
    wobble(cents, now) {
      if (Math.abs(cents - wobSent) < 0.3) return;
      wobSent = cents;
      try { kit.wob.gain.setTargetAtTime(cents, now, 0.1); } catch { /* ignore */ }
    },
  };
}

/**
 * Runs a script of calls on a conductor that plays into any audio context on a simulated clock ticking every 25 ms. A browser
 * can render it with an offline context and measure the real sound.
 */
export function audition(a: BaseAudioContext, master: AudioNode, seconds: number, script: Array<{ t: number; run: (c: Conductor) => void }>, seed = 1): Conductor {
  const k = buildKit(a, master);
  let t = 0;
  // The simulated clock runs ahead of the render, so a finished player keeps its nodes until the render is done.
  const c = new Conductor({ clock: () => t, ahead: () => 0.12, sink: { ...webSink(a, k), close: () => undefined }, seed });
  const steps = [...script].sort((x, y) => x.t - y.t);
  let i = 0;
  for (; t < seconds; t += 0.025) {
    while (i < steps.length && steps[i].t <= t) steps[i++].run(c);
    c.tick();
  }
  return c;
}

function lookahead(): number {
  try { return typeof document !== 'undefined' && document.hidden ? 1.5 : 0.12; } catch { return 0.12; }
}

/** Called by audio.ts once the context exists. */
export function attach(context: AudioContext, master: GainNode, isMuted: () => boolean): void {
  if (ac) return;
  try {
    ac = context;
    muted = isMuted;
    kit = buildKit(context, master);
    live = new Conductor({ clock: () => (ac ? ac.currentTime : 0), ahead: lookahead, sink: webSink(context, kit), muted: () => muted(), salt: () => Date.now() >>> 0 });
    live.intensity = intensity0;
    live.progress = progress0;
    live.warpTarget = warp0;
    if (timer === null) timer = setInterval(() => { try { live?.tick(); } catch { /* never throw from the timer */ } }, 25);
    if (wanted) live.play(wanted.id, wanted.tint, wanted.hint);
  } catch { kit = null; ac = null; live = null; }
}

export function playTrack(id: TrackId, tint?: AreaTint, fade?: number): void {
  try {
    if (!TRACKS[id]) return;
    if (live) live.play(id, tint, fade);
    else wanted = { id, tint, hint: fade };
  } catch { /* never throw */ }
}

export function stopTrack(fade?: number): void {
  try {
    if (live) live.stop(fade);
    else wanted = null;
  } catch { /* never throw */ }
}

export function setTrackIntensity(x: number): void {
  intensity0 = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  if (live) live.intensity = intensity0;
}

export function setTrackWarp(x: number): void {
  warp0 = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  if (live) live.warpTarget = warp0;
}

export function setTrackProgress(x: number): void {
  progress0 = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  if (live) live.progress = progress0;
}

/** Passes a battle event to the live conductor. */
export function fightCue(c: BattleCue, o?: BattleCueOpts): void {
  try { live?.cue(c, o ?? {}); } catch { /* never throw */ }
}

// ---------------------------------------------------------------- ducking, bending, and harmony

let duckDepth = 1;
let duckEnd = 0;

/**
 * Lowers the music to `depth` (0 to 1) for `hold` seconds and lets it back over `release` seconds. A deeper duck already running
 * stays, and a longer one is kept. The attack takes 30 ms so the dip does not click.
 */
export function duckMusic(depth: number, hold: number, release: number): void {
  if (!ac || !kit) return;
  try {
    const now = ac.currentTime;
    let d = Math.max(0.02, Math.min(1, depth)), end = now + 0.05 + hold;
    if (now < duckEnd) { d = Math.min(d, duckDepth); end = Math.max(end, duckEnd); }
    duckDepth = d; duckEnd = end;
    const g = kit.duck.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(d, now, 0.03);
    g.setTargetAtTime(1, end, Math.max(0.05, release) / 3);
    duckEnd = end;
  } catch { /* ignore */ }
}

/** One downward bend of every note, in cents, that comes back to pitch. The bend takes `down` seconds, holds, and returns over `up`. */
export function bendMusic(cents: number, down: number, hold: number, up: number): void {
  if (!ac || !kit || !kit.bend) return;
  try {
    const o = kit.bend.offset, now = ac.currentTime;
    o.cancelScheduledValues(now);
    o.setValueAtTime(o.value, now);
    o.linearRampToValueAtTime(-Math.abs(cents), now + down);
    o.setValueAtTime(-Math.abs(cents), now + down + hold);
    o.linearRampToValueAtTime(0, now + down + hold + up);
  } catch { /* ignore */ }
}

/** The key now sounding: its root as a pitch class, the pitch classes of its scale, and the pitch classes sounding now. Null when no track plays. */
export function currentHarmony(): { root: number; scale: number[]; chord: number[] } | null {
  return live ? live.harmony() : null;
}
