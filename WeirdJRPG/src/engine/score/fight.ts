// A fight's memory. The battle sends a cue for everything that happens, the fight keeps it, and the battle music changes because
// of it for the rest of the fight. Times are global beats of the battle track, so every change lands on a beat or a bar line.
// Every reaction stays in the track's key: tension comes from register, filter, rhythm, density, and a pedal on the dominant.
import type { BattleCue, BattleCueOpts } from '../audio';
import { Rng, VOICE_RANGE, fold, snap } from './lib';
import type { Ev, Fig, Key, MemLine, MotifName, Voice } from './lib';
import { LIGHTBOUND, MOTIF_FIG, VORN, pilgrim } from './motifs';
import { GUARDIAN_ORDER } from './combat';

/** Tracks that listen to battle cues. */
export const FIGHT_TRACKS: ReadonlySet<string> = new Set(['battle', 'miniboss', 'boss', 'keeper', 'lightbound', 'guardian', 'despair']);

/** What a fight needs from the engine: the battle track's beat grid and what it is playing. */
export interface FightGrid {
  /** The global beat the engine schedules next. Changes land on or after it. */
  beatNow(): number;
  beatAfter(gb: number): number;
  /** The first bar line at or after a beat, and that bar's length in beats. */
  barAfter(gb: number): { gb: number; len: number };
  bassAt(gb: number): number | null;
  leadAt(gb: number): number | null;
  /** True when the lead plays notes in the span that are not kept motifs. */
  leadFree(gb0: number, gb1: number): boolean;
  recall(): MemLine[];
  prog(): number;
  /** Cuts the current section at a bar line and goes on with the section for a boss phase. */
  jump(gb: number, phase: number): void;
}

/** One note the fight adds, at a global beat. until is where the span it takes ends. */
export interface OverNote { gb: number; e: Ev; until: number; id: number }

/** What the fight did to a note. A held note an overlay interrupts comes back after it as `again`, from a global beat for some beats. */
export interface Shaped { e: Ev; drop?: boolean; again?: { gb: number; d: number }; dw?: number; cm?: number; vibr?: [number, number] }

/** Where a note sits: its beat in the bar, the bar's length, whether the fight added it, and the bass note the bar starts on. */
export interface NoteInfo { bib: number; bar: number; ov: boolean; phraseEnd(): boolean; barLast(): boolean; root(): number | null }

type Counter = 'shell' | 'mem' | 'emo' | 'name' | 'down' | 'calm' | 'shift' | 'band' | 'flip';
interface Over { id: number; kind: string; g0: number; g1: number; voices: Voice[] }
/** A one-bar reaction that takes in every cue of its kind arriving before it ends, so a burst gives one response that scales. */
interface Moment { kind: 'hurt' | 'heal' | 'miss' | 'lurch'; g0: number; g1: number; amt: number; n: number; used: boolean }
interface Absorb { g0: number; g1: number; emo: string; until: number }

/** Percussion made of metal or wood, which stripped shells crack and thin. */
const METAL: ReadonlySet<string> = new Set(['tick', 'tock', 'gear', 'type', 'hat', 'drip', 'clap', 'stamp']);
const CRACKS: ReadonlySet<string> = new Set(['gear', 'tock', 'type', 'clap', 'stamp']);
const LIGHT: ReadonlySet<string> = new Set(['tick', 'hat', 'drip', 'type']);

type Layer = 'x' | 'light' | 'p2';
/** The layers a fallen foe takes with it, in order. Where the bell voice carries the tune it goes last. */
const LAYERS: Record<string, Layer[]> = { despair: ['p2', 'light', 'x'], guardian: ['light', 'p2', 'x'] };
const LAYERS_DEFAULT: Layer[] = ['x', 'light', 'p2'];

/** How an absorbed emotion colors the lead: pulse width, cutoff multiplier, vibrato in Hz and cents, octave, and note length. No color leaves the key. */
const COLORS: Record<string, { duty: number; cut: number; vib: [number, number]; oct: number; leg: number }> = {
  rage: { duty: 0.125, cut: 2.2, vib: [7, 14], oct: 0, leg: 0.8 },
  sorrow: { duty: 0.5, cut: 0.55, vib: [4, 12], oct: 0, leg: 1 },
  fear: { duty: 0.125, cut: 1.2, vib: [8, 16], oct: 0, leg: 0.5 },
  joy: { duty: 0.25, cut: 1.6, vib: [6, 8], oct: 12, leg: 0.9 },
  pride: { duty: 0.375, cut: 1.5, vib: [5, 5], oct: 0, leg: 1 },
  longing: { duty: 0.5, cut: 0.8, vib: [5, 12], oct: 0, leg: 1 },
  confusion: { duty: 0.25, cut: 1, vib: [3, 14], oct: 0, leg: 0.9 },
  despair: { duty: 0.5, cut: 0.5, vib: [2.5, 10], oct: -12, leg: 1 },
  misery: { duty: 0.375, cut: 0.6, vib: [3, 12], oct: 0, leg: 1 },
  dread: { duty: 0.125, cut: 0.7, vib: [2, 14], oct: -12, leg: 1 },
};
const PLAIN = { duty: 0.25, cut: 1.3, vib: [5, 10] as [number, number], oct: 0, leg: 1 };

/** Each action's scale degree, and how other events move the line, so a round's events become the next phrase's contour. */
const ABS: Record<string, number> = { strip: 0, extract_memory: 4, extract_emotion: 2, extract_name: 6, absorb: 3, weave: 5, unmake: 1, sense: 7, vorn: 0, lb: 7 };
const REL: Record<string, number> = { layer: 2, hurt: -1, heal: 1, miss: 0, down: -2, calm: 2 };

/** The section a boss phase moves to. The guardian moves on to its next motif. */
const PHASE_SEC: Record<string, string[]> = {
  battle: ['c'], miniboss: ['c'], boss: ['bridge', 'c', 'b'], keeper: ['ding', 'count'], lightbound: ['tune'], despair: ['cluster', 'fall', 'low'],
};
export function phaseSection(track: string, phase: number, cur: string | null): string | null {
  if (track === 'guardian') return GUARDIAN_ORDER[(GUARDIAN_ORDER.indexOf((cur ?? 'pilgrim') as MotifName) + 1) % GUARDIAN_ORDER.length];
  const l = PHASE_SEC[track];
  return l ? l[Math.max(0, phase - 2) % l.length] : null;
}

const pc = (n: number): number => ((Math.round(n) % 12) + 12) % 12;
const octaveFor = (K: Key, target: number): number => 12 * Math.round((target - K(0)) / 12);
const near = (p: number, ref: number): number => p + 12 * Math.round((ref - p) / 12);
/** One step around the circle of fifths: up a fourth, folded so the key never wanders more than a tritone from home. */
const nextKey = (v: number): number => ((v + 5 + 6) % 12 + 12) % 12 - 6;

/** How strong a position in the bar is: 2 on the downbeat and the half bar, 1 on the other beats, 0 between beats. */
export function strength(bib: number, bar: number): 0 | 1 | 2 {
  const b = Math.round(bib * 4) / 4;
  if (Math.abs(b - Math.round(b)) > 0.01) return 0;
  const i = Math.round(b);
  return i === 0 || (bar % 2 === 0 && bar >= 4 && i === bar / 2) ? 2 : 1;
}

/** The degree of the key a pitch belongs to, or null for a pitch outside it. */
function degreeOf(K: Key, n: number): number | null {
  for (let d = 0; d < 7; d++) if (pc(K(d)) === pc(n)) return d;
  return null;
}

/** The pitch classes of the triad on a bass note's degree. A diminished fifth is left out, so the chord never holds a tritone. */
export function chordOf(K: Key, root: number | null): number[] | null {
  if (root === null) return null;
  const R = degreeOf(K, root);
  if (R === null) return null;
  const out = [pc(K(R)), pc(K(R + 2))];
  if ((K(R + 4) - K(R)) % 12 === 7) out.push(pc(K(R + 4)));
  return out;
}

/** Moves a pitch to the nearest chord tone, upward on a tie. */
export function toChord(n: number, pcs: readonly number[]): number {
  const b = Math.round(n);
  for (let k = 0; k <= 6; k++) {
    if (pcs.includes(pc(b + k))) return b + k;
    if (pcs.includes(pc(b - k))) return b - k;
  }
  return n;
}

/** The degree of a pitch counted from the key's root, octaves included, or null outside the key. */
function absDegree(K: Key, n: number): number | null {
  const r = Math.round(n);
  if (Math.abs(n - r) > 0.2) return null;
  for (let d = -14; d <= 35; d++) if (K(d) === r) return d;
  return null;
}

function figOf(m: MotifName, prog: number): Fig {
  return m === 'pilgrim' ? pilgrim(Math.max(0.3, prog), new Rng(11)) : MOTIF_FIG[m];
}

export class Fight {
  private counters = new Map<Counter, Array<[number, number]>>();
  private overs: Over[] = [];
  private cancelled = new Set<number>();
  /** The beat before which a new reaction of a kind joins the last one: the end of the bar it played in. */
  private hold = new Map<string, number>();
  private nextId = 1;
  /** Notes the fight adds that the engine has not placed yet, in beat order. */
  pending: OverNote[] = [];
  private moments: Moment[] = [];
  private senses: Array<{ g0: number; g1: number }> = [];
  private absorbs: Absorb[] = [];
  private contour: { g0: number; g1: number; degs: number[]; i: number; last: number | null } | null = null;
  private tokens: string[] = [];
  private rounds = 0;
  foes = 1;
  /** Cues heard, for the checks. */
  heard = 0;

  constructor(readonly track: string, readonly K: Key, readonly motif: MotifName) {}

  /** The lasting changes of a fight, carried to another battle track from its first beat. */
  carry(track: string, K: Key, motif: MotifName): Fight {
    const f = new Fight(track, K, motif);
    for (const [c, l] of this.counters) if (l.length) f.counters.set(c, [[0, l[l.length - 1][1]]]);
    f.foes = this.foes; f.rounds = this.rounds;
    return f;
  }

  private val(c: Counter, gb: number): number {
    const l = this.counters.get(c);
    let v = 0;
    if (l) for (const [g, x] of l) { if (g <= gb + 1e-6) v = x; else break; }
    return v;
  }

  private bump(c: Counter, gb: number, f: (v: number) => number) {
    let l = this.counters.get(c);
    if (!l) this.counters.set(c, (l = []));
    const last = l.length ? l[l.length - 1] : null;
    l.push([last ? Math.max(gb, last[0]) : gb, f(last ? last[1] : 0)]);
  }

  /** The key the fight has moved to by a beat: its root pitch class and its scale's pitch classes. */
  keyAt(gb: number): { root: number; scale: number[] } {
    const root = pc(this.K.root + this.val('shift', gb));
    return { root, scale: [...new Set(this.K.mode.slice(0, 7).map((s) => pc(root + s)))].sort((a, b) => a - b) };
  }

  /** How hard the fight pushes the timing: overload leans on it and a reality break lurches for a bar. It never detunes. */
  pushAt(gb: number): number {
    if (this.moments.some((m) => m.kind === 'lurch' && gb >= m.g0 && gb < m.g1)) return 0.45;
    return this.val('band', gb) === 1 ? 0.3 : 0;
  }

  /** A reaction of this kind that has not finished yet, so a new cue of the same kind joins it instead of adding another. */
  private busy(kind: string, g: number): boolean {
    return this.overs.some((o) => o.kind === kind && o.g1 > g) || (this.hold.get(kind) ?? -Infinity) > g;
  }

  /**
   * Takes a share of the voices for a span and plays notes there. It waits up to a bar for the voices to be free, or with
   * `force` takes them at once and cancels what held them.
   */
  private overlay(G: FightGrid, kind: string, g0: number, len: number, voices: Voice[], notes: Array<[number, Ev]>, force = false): number | null {
    let start = g0;
    const clash = (o: Over) => o.g1 > start + 1e-6 && o.g0 < start + len - 1e-6 && o.voices.some((v) => voices.includes(v));
    if (force) {
      for (const o of this.overs.filter(clash)) this.cancelled.add(o.id);
      this.overs = this.overs.filter((o) => !this.cancelled.has(o.id));
      this.pending = this.pending.filter((n) => !this.cancelled.has(n.id));
    }
    for (let tries = 0; tries < 2; tries++) {
      if (!this.overs.some(clash)) {
        const id = this.nextId++;
        this.overs.push({ id, kind, g0: start, g1: start + len, voices });
        this.hold.set(kind, Math.max(start + len, G.barAfter(start + 0.01).gb));
        for (const [off, e] of notes) this.pending.push({ gb: start + off, e: { ...e, k: 1 }, until: start + len, id });
        this.pending.sort((a, b) => a.gb - b.gb);
        return start;
      }
      start = G.barAfter(start + 0.01).gb;
    }
    return null;
  }

  /** True for a note of an overlay a later one took the place of. */
  isCancelled(id: number | undefined): boolean {
    return id !== undefined && this.cancelled.has(id);
  }

  /** Starts or joins the one-bar reaction of a kind. */
  private moment(kind: Moment['kind'], g0: number, len: number, amt: number) {
    const m = this.moments.find((x) => x.kind === kind && x.g1 > g0 - 1e-6);
    if (m) { m.amt += amt; m.n++; return; }
    this.moments.push({ kind, g0, g1: g0 + len, amt, n: 1, used: false });
    if (this.moments.length > 24) this.moments.shift();
  }

  /** Ends a phrase the fight adds on a tone of the chord the bar starts on. */
  private cadence(G: FightGrid, notes: Array<[number, Ev]>, g0: number) {
    const last = notes[notes.length - 1];
    if (!last) return;
    const ch = chordOf(this.K, G.bassAt(g0 + last[0]) ?? G.bassAt(g0));
    if (ch) last[1] = { ...last[1], n: toChord(last[1].n, ch.slice(0, 2)) };
  }

  cue(c: BattleCue, o: BattleCueOpts, G: FightGrid): void {
    this.heard++;
    const g = G.beatNow();
    const beat = G.beatAfter(g), bar = G.barAfter(g);
    const K = this.K;
    const amount = Math.max(0, Number.isFinite(o.amount) ? (o.amount as number) : 5);
    switch (c) {
      case 'start':
        this.foes = Math.max(1, Math.round(o.foes ?? 1));
        return;
      case 'round':
        this.round(G, bar);
        return;
      case 'strip': case 'extract_memory': case 'extract_emotion': case 'extract_name':
        this.tokens.push(c);
        return;
      case 'absorb':
        this.tokens.push(c);
        if (o.emotion) {
          for (const a of this.absorbs) if (a.g1 > beat) a.g1 = beat;
          this.absorbs.push({ g0: beat, g1: Infinity, emo: o.emotion, until: this.rounds + 3 });
        } else if (o.layer === 'memory') this.quote(G, bar.gb);
        else if (o.layer === 'shell') this.bump('shell', bar.gb, (v) => Math.max(0, v - 1));
        return;
      case 'weave':
        this.tokens.push(c);
        if (!this.busy('weave', g)) this.weave(G, bar);
        return;
      case 'unmake': {
        this.tokens.push(c);
        const len = bar.len;
        const b0 = G.bassAt(beat), bd = b0 === null ? null : degreeOf(K, b0);
        const bass = b0 !== null && bd !== null ? fold(K(bd), 33) : fold(K(0), 33);
        const ch = chordOf(K, bass);
        const lead = G.leadAt(beat) ?? K(4) + 12;
        const at = this.overlay(G, 'unmake', beat, len, ['p1', 'p2', 'x', 'nz', 'tri'], [
          [0, { t: 0, v: 'tri', n: bass, d: len * 0.98, g: 0.42, a: 0.15 }],
          [0, { t: 0, v: 'x', n: fold(ch ? toChord(lead, ch) : lead, 64), d: len * 0.95, g: 0.14, rev: 1, ratio: 2 }],
          [0, { t: 0, v: 'nz', n: 60, d: len * 0.95, g: 0.1, nz: 'hush', a: 0.4 }],
        ], true);
        // The music comes back with its lead turned upside down in the key, until the next Unmake turns it back.
        if (at !== null) this.bump('flip', at + len, (v) => (v ? 0 : 1));
        return;
      }
      case 'sense': {
        this.tokens.push(c);
        if (this.senses.some((s) => s.g1 > g) || this.busy('sense', g)) return;
        const at = this.overlay(G, 'sense', bar.gb, bar.len, ['x'], [[0, { t: 0, v: 'x', n: fold(K(0), 64), d: bar.len * 0.95, g: 0.07, sus: 1, a: 0.5, ratio: 1 }]]);
        if (at !== null) this.senses.push({ g0: at, g1: at + bar.len });
        return;
      }
      case 'vorn': {
        this.tokens.push(c);
        if (this.busy('vorn', g)) return;
        const bp = G.bassAt(bar.gb);
        const R = bp === null ? 0 : degreeOf(K, bp) ?? 0, base = fold(K(R), 33);
        const notes: Array<[number, Ev]> = [];
        let t = 0;
        for (const [d, l] of VORN) {
          if (t >= bar.len - 1e-6) break;
          if (d !== null) notes.push([t, { t: 0, v: 'tri', n: base + (K(R + d) - K(R)), d: Math.min(l, bar.len - t) * 0.75, g: 0.55 }]);
          t += l;
        }
        this.overlay(G, 'vorn', bar.gb, bar.len, ['tri'], notes);
        return;
      }
      case 'lb': {
        this.tokens.push(c);
        if (this.busy('lb', g)) return;
        const oct = octaveFor(K, 78), notes: Array<[number, Ev]> = [];
        let t = 0;
        for (const [d, l] of LIGHTBOUND) {
          if (t >= bar.len - 1e-6) break;
          if (d !== null) notes.push([t, { t: 0, v: 'x', n: K(d) + oct, d: l * 0.6, g: 0.1, ratio: 2 }]);
          t += l;
        }
        this.cadence(G, notes, bar.gb);
        this.overlay(G, 'lb', bar.gb, bar.len, ['x'], notes);
        return;
      }
      case 'layer_off':
        this.tokens.push('layer');
        if (o.layer === 'shell') {
          this.bump('shell', beat, (v) => v + 1);
          if (!this.busy('crack', g)) this.overlay(G, 'crack', beat, 0.5, ['nz'], [[0, { t: 0, v: 'nz', n: 60, d: 0.25, g: 0.42, nz: 'crack' }]]);
        } else if (o.layer === 'memory') {
          this.bump('mem', bar.gb, (v) => v + 1);
          this.quote(G, bar.gb);
        } else if (o.layer === 'emotion') this.bump('emo', bar.gb, (v) => v + 1);
        else if (o.layer === 'name') this.bump('name', bar.gb, (v) => v + 1);
        return;
      case 'foe_down': case 'calm': {
        this.tokens.push(c === 'calm' ? 'calm' : 'down');
        this.bump('down', bar.gb, (v) => v + 1);
        if (c === 'calm') this.bump('calm', bar.gb, (v) => v + 1);
        if (this.busy('toll', g)) return;
        const root = fold(K(0), 57);
        if (c === 'calm') {
          this.overlay(G, 'toll', bar.gb, bar.len, ['x'], [
            [0, { t: 0, v: 'x', n: root, d: bar.len * 0.95, g: 0.08, sus: 1, a: 0.3, ratio: 1 }],
            [0, { t: 0, v: 'x', n: root + (K(4) - K(0)), d: bar.len * 0.95, g: 0.07, sus: 1, a: 0.45, ratio: 1 }],
          ]);
        } else this.overlay(G, 'toll', bar.gb, bar.len, ['x'], [[0, { t: 0, v: 'x', n: root, d: Math.min(3, bar.len), g: 0.15, ratio: 2 }]]);
        return;
      }
      case 'hurt':
        this.tokens.push(c);
        this.moment('hurt', bar.gb, bar.len, amount);
        return;
      case 'heal':
        this.tokens.push(c);
        this.moment('heal', bar.gb, bar.len, amount);
        return;
      case 'miss':
        this.tokens.push(c);
        this.moment('miss', beat, 1, 1);
        return;
      case 'overload':
        this.bump('band', bar.gb, () => 1);
        return;
      case 'faded':
        this.bump('band', bar.gb, () => 2);
        return;
      case 'steady':
        this.bump('band', bar.gb, () => 0);
        return;
      case 'phase': {
        // One bar standing on the old tonic, which is the dominant of the key a fourth up, and then the new section in that key.
        if (this.busy('phase', g)) return;
        const p = Math.max(2, Math.round(o.phase ?? 2));
        const at = this.pedal(G, 'phase', bar, 0);
        const turn = at === null ? bar.gb : G.barAfter(at + 0.01).gb;
        this.bump('shift', turn, nextKey);
        G.jump(turn, p);
        return;
      }
      case 'reality_break':
        // The music lurches up an octave over a pedal on the dominant for one bar, then lands back where it was.
        if (this.moments.some((m) => m.kind === 'lurch' && m.g1 > g)) return;
        this.moment('lurch', bar.gb, bar.len, 1);
        this.pedal(G, 'lurch', bar, 4);
        return;
      default:
        return;
    }
  }

  /** One bar of driving eighths on a degree of the key in the bass: a pedal that holds the harmony still while the rest moves. */
  private pedal(G: FightGrid, kind: string, bar: { gb: number; len: number }, deg: number): number | null {
    const n = fold(this.K(deg), 33), notes: Array<[number, Ev]> = [];
    for (let t = 0; t < bar.len - 1e-6; t += 0.5) notes.push([t, { t: 0, v: 'tri', n: t % 1 ? n + 12 : n, d: 0.42, g: t % 1 ? 0.42 : 0.52 }]);
    return this.overlay(G, kind, bar.gb, bar.len, ['tri'], notes, true);
  }

  private round(G: FightGrid, bar: { gb: number; len: number }) {
    this.rounds++;
    for (const a of this.absorbs) if (a.g1 === Infinity && this.rounds >= a.until) a.g1 = bar.gb;
    if (this.tokens.length >= 2) {
      let d = 2;
      const degs: number[] = [];
      for (const t of this.tokens.slice(-6)) {
        d = t in ABS ? ABS[t] : d + (REL[t] ?? 0);
        d = Math.max(-2, Math.min(9, d));
        degs.push(d);
      }
      const g0 = bar.gb, g1 = g0 + bar.len * 2;
      if (G.leadFree(g0, g1)) this.contour = { g0, g1, degs, i: 0, last: null };
      else if (!this.busy('bells', g0)) {
        const oct = octaveFor(this.K, 76);
        const notes: Array<[number, Ev]> = degs.map((x, i) => [i * 0.5, { t: 0, v: 'x', n: this.K(x) + oct, d: 0.45, g: 0.12, ratio: 2 }]);
        this.cadence(G, notes, g0);
        this.overlay(G, 'bells', g0, Math.ceil((degs.length * 0.5) / bar.len - 1e-6) * bar.len, ['x'], notes);
      }
    }
    this.tokens = [];
    const mem = this.val('mem', bar.gb);
    if (mem >= 2 || (mem === 1 && this.rounds % 2 === 0)) this.quote(G, G.barAfter(bar.gb + bar.len).gb);
  }

  /** A remembered phrase from an earlier track rings as reversed bells, set in the fight's key. */
  private quote(G: FightGrid, g0: number) {
    if (this.busy('quote', g0 - 0.01)) return;
    const mem = G.recall();
    if (!mem.length) return;
    const pick = [...mem].reverse().find((m) => m.motif !== this.motif && m.from !== this.track) ?? mem[mem.length - 1];
    const bar = G.barAfter(g0);
    const notes: Array<[number, Ev]> = [];
    let t = 0;
    for (const [p, l] of pick.line) {
      const len = Math.max(0.5, Math.min(2, l * 1.5));
      if (t + len > bar.len * 2 + 1e-6 || notes.length >= 4) break;
      if (p !== null) notes.push([t, { t: 0, v: 'x', n: fold(snap(p, this.K), 64), d: len * 0.95, g: 0.13, rev: 1, ratio: 2 }]);
      t += len;
    }
    this.cadence(G, notes, bar.gb);
    if (notes.length) this.overlay(G, 'quote', bar.gb, Math.ceil(t / bar.len - 1e-6) * bar.len, ['x'], notes);
  }

  /** Weave fuses the fight's motif with a remembered one, note by note, for one bar of the lead. */
  private weave(G: FightGrid, bar: { gb: number; len: number }) {
    const mem = G.recall();
    const other = [...mem].reverse().find((m) => m.motif !== this.motif)?.motif ?? (this.motif === 'pilgrim' ? 'vorn' : 'pilgrim');
    const a = figOf(this.motif, G.prog()).filter((x) => x[0] !== null).map((x) => x[0] as number);
    const b = figOf(other, G.prog()).filter((x) => x[0] !== null).map((x) => x[0] as number);
    if (!a.length || !b.length) return;
    const oct = octaveFor(this.K, 67), n = Math.round(bar.len * 2);
    const notes: Array<[number, Ev]> = [];
    for (let i = 0; i < n; i++) {
      const d = i % 2 ? b[Math.floor(i / 2) % b.length] : a[Math.floor(i / 2) % a.length];
      notes.push([i * 0.5, { t: 0, v: 'p1', n: this.K(d) + oct, d: 0.42, g: 0.34, duty: 2 }]);
    }
    this.cadence(G, notes, bar.gb);
    this.overlay(G, 'weave', bar.gb, bar.len, ['p1'], notes);
  }

  private at(kind: Moment['kind'], gb: number): Moment | null {
    for (const m of this.moments) if (m.kind === kind && gb >= m.g0 - 1e-6 && gb < m.g1 - 1e-6) return m;
    return null;
  }

  /** Applies the fight's memory to one note at a global beat. Null drops the note. Notes the fight added only follow the key and the chord. */
  shape(e0: Ev, gb: number, I: NoteInfo): Shaped | null {
    const v = e0.v, K = this.K;
    const e: Ev = { ...e0 };
    let cm = 1;
    let dw: number | undefined, vibr: [number, number] | undefined, again: Shaped['again'];
    // A pitch the fight chose keeps to the bar's chord on strong beats, as a melody over changing chords does.
    let chosen = I.ov && v !== 'tri' && v !== 'nz';
    const off = Math.abs(I.bib - Math.round(I.bib)) > 0.01;
    if (!I.ov) {
      for (const o of this.overs) {
        if (!o.voices.includes(v)) continue;
        const rest = gb + e0.d - o.g1;
        if (gb >= o.g0 - 1e-6 && gb < o.g1 - 1e-6) return rest >= 1 && held(e0) ? { e, drop: true, again: { gb: o.g1, d: rest } } : null;
        if (gb < o.g0 && gb + e.d > o.g0) {
          e.d = Math.max(0.05, o.g0 - gb - 0.02);
          if (rest >= 1 && held(e0)) again = { gb: o.g1, d: rest };
        }
      }
      if (v === 'nz' && e.nz !== 'kick' && this.senses.some((s) => gb >= s.g0 && gb < s.g1)) return null;
      const band = this.val('band', gb);
      if (band === 2 && ((v === 'x' && !e.k && !e.sus && Math.floor(gb + 1e-6) % 2 === 1) || (v === 'p2' && off))) return null;
      if (v === 'nz' && METAL.has(e.nz ?? 'hat')) {
        const s = this.val('shell', gb), bi = Math.floor(I.bib + 1e-6);
        if (s >= 2 && off) return null;
        if (s >= 1 && off && bi % 2 === 1) return null;
        if (s >= 3 && !off && bi % 2 === 0) return null;
        if (s >= 2 && !off && CRACKS.has(e.nz ?? '')) { e.nz = 'crack'; e.g *= 0.7; }
      }
      const nm = this.val('name', gb);
      if (nm >= 1 && v === 'p1' && I.phraseEnd()) return null;
      if (nm >= 2 && v === 'p2' && I.barLast()) return null;
      if (nm >= 3 && v === 'tri' && I.barLast()) return null;
      const gone = (LAYERS[this.track] ?? LAYERS_DEFAULT).slice(0, this.val('down', gb));
      if (gone.includes('x') && v === 'x' && !e.k && !e.sus) return null;
      if (gone.includes('light') && v === 'nz' && off && LIGHT.has(e.nz ?? '')) return null;
      if (gone.includes('p2') && v === 'p2' && off) return null;
      if (v === 'nz') {
        const miss = this.at('miss', gb);
        if (miss && !off && !miss.used) { miss.used = true; return null; }
        if (off && this.at('lurch', gb)) return null;
      }
      const ct = this.contour;
      if (v === 'p1' && !e.k && ct && gb >= ct.g0 && gb < ct.g1 && ct.i < ct.degs.length) {
        e.n = near(K(ct.degs[ct.i++]), ct.last ?? e.n);
        ct.last = e.n;
        chosen = true;
      }
      if (v === 'p1' && this.val('flip', gb)) {
        const d = absDegree(K, e.n);
        if (d !== null) { e.n = K(22 - d) + (e.n - Math.round(e.n)); chosen = true; }
      }
    }
    if (v === 'nz') return { e, again };
    if (chosen) {
      const st = strength(I.bib, I.bar);
      if (st === 2 || (st === 1 && e.d >= 1)) { const ch = chordOf(K, I.root()); if (ch) e.n = toChord(e.n, ch); }
    }
    const calm = this.val('calm', gb);
    if (calm) {
      if (Math.abs(e.n - Math.round(e.n)) > 0.2) e.n = Math.round(e.n);
      if (e.det) e.det *= Math.pow(0.5, calm);
    }
    e.n += this.val('shift', gb);
    const pulse = v === 'p1' || v === 'p2';
    if (pulse) {
      // Taken emotions brighten the pulses: an open filter, and after two the accompaniment moves up an octave.
      const emo = Math.min(3, this.val('emo', gb));
      if (emo) cm *= 1 + 0.2 * emo;
      if (emo >= 2 && v === 'p2' && e.n + 12 <= 84) e.n += 12;
      const band = this.val('band', gb);
      if (band === 1) { cm *= 1.5; if (v === 'p1') dw = 0.125; }
      if (band === 2) { cm *= 0.6; if (e.n - 12 >= 50) e.n -= 12; }
      if (this.at('lurch', gb)) { cm *= 1.6; if (e.n + 12 <= (v === 'p1' ? 88 : 84)) e.n += 12; }
      const hurt = this.at('hurt', gb);
      if (hurt) { const k = Math.min(1, hurt.amt / 40); e.d *= 1 - 0.5 * k; cm *= 1 - 0.45 * k; }
    }
    if (v === 'p1') {
      const ab = this.absorbs.find((a) => gb >= a.g0 && gb < a.g1);
      if (ab) {
        const col = COLORS[ab.emo] ?? PLAIN;
        dw = ab.emo === 'confusion' ? (Math.floor(gb * 2) % 2 ? 0.5 : 0.125) : col.duty;
        cm *= col.cut; vibr = col.vib;
        e.n += col.oct;
        e.d *= col.leg;
      }
      const heal = this.at('heal', gb);
      if (heal && (!heal.used || heal.amt >= 20 || heal.n >= 2) && e.n + 12 <= 88) { heal.used = true; e.n += 12; }
    }
    const [lo, hi] = VOICE_RANGE[v];
    while (e.n > hi) e.n -= 12;
    while (e.n < lo) e.n += 12;
    return { e, again, dw, cm: cm !== 1 ? cm : undefined, vibr };
  }

  /** Drops notes the fight added after a beat, so a section cut can place them again. */
  unplace(gb: number, notes: OverNote[]): void {
    notes = notes.filter((n) => !this.cancelled.has(n.id));
    this.pending.push(...notes.filter((n) => n.gb >= gb));
    this.pending.sort((a, b) => a.gb - b.gb);
  }
}

/** Notes long enough to come back after an overlay that interrupts them. */
function held(e: Ev): boolean {
  if (e.v === 'x') return !!e.sus;
  if (e.v === 'nz') return e.nz === 'rumble' || e.nz === 'hush' || e.nz === 'steam';
  return true;
}
