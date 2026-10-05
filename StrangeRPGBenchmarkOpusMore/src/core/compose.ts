import { Rng, hashStr } from './rng';
import { MUSIC, LEIT } from '../data/music';

export type Ch = 'lead' | 'harm' | 'bass' | 'drum' | 'echo';
export type Kit = 'k' | 's' | 'h' | 'o' | 't' | 'c';

// Times and lengths are sixteenth-note steps from the bar start. Pitch is midi + arp[i] for the i-th tick of `rate` steps.
export interface Ev {
  ch: Ch;
  at: number;
  len: number;
  midi: number;
  vel: number;
  det?: number;
  bend?: number;
  arp?: number[];
  rate?: number;
  kit?: Kit;
  duty?: number;
  vib?: number;
  env?: number;
}
export interface Bar { bpm: number; steps: number; evs: Ev[]; tag: string; }
// r holds [step, length] pairs, d holds scale degrees relative to the first note, s0 is the first note's degree.
export interface Motif { r: [number, number][]; d: number[]; s0: number; }
export interface Jingle { bpm: number; beats?: number; lead?: string; harm?: string; bass?: string; drum?: string; loop?: number; duty?: [number, number]; echo?: boolean; }
export interface Sparse { p: number; run: number; drone: number; fx: string; ticks?: number; }

export interface Style {
  bpm: number;
  key: string;
  scale: string;
  density: number;
  // Markov table of chord symbols: 'I>IV V, IV>I'. The first row's chord is home.
  prog: string;
  // Sections of 8 bars, as a theme letter and layer letters: l lead, h harmony, b bass, d drums, e echo.
  form: string[];
  beats?: number;
  oct?: number;
  hoct?: number;
  seed?: string;
  progA?: string;
  rate?: number;
  swing?: number;
  phrase?: string;
  // Per theme letter, separated by '/': 'walk/bounce' plays walk in A sections and bounce in B and C.
  bass?: string;
  harm?: string;
  riff?: string;
  drums?: Partial<Record<Kit, string>>;
  fill?: number;
  crash?: number;
  duty?: [number, number];
  range?: [number, number];
  gate?: number;
  pluck?: number;
  vib?: number;
  echo?: number;
  theme?: 'leit' | 'leitInv';
  // Leitmotif quote. fx letters: h head only, s slow, d drop notes, t tritone twist, l Lydian twist, b pitch drift, u detuned unison, f far, x fit to chords.
  leit?: { at: string; slot: number; p: number; fx: string };
  sparse?: Sparse;
  decay?: boolean;
  jingle?: Jingle[];
}

interface N { at: number; len: number; deg: number; semi?: number; det?: number; bend?: number; vel?: number; uni?: boolean; }
interface Chord { sym: string; root: number; tones: number[]; pcs: number[]; }

const NOTE: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  whole: [0, 2, 4, 6, 8, 10],
};
const ROMAN: Record<string, number> = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
const STEP_COST = [1.1, 0, 0.5, 1.2, 1.8, 2.4];
// Lead range in scale degrees from the tonic. The floor must reach the leitmotif's lowest note, five degrees down.
const RANGE: [number, number] = [-5, 7];
const CELLS: [string, (d: number) => number][] = [
  ['x---', (d) => 0.3 + 2.5 * (1 - d)],
  ['x-x-', () => 2],
  ['x--x', (d) => 0.5 + d],
  ['x-xx', (d) => 1.6 * d],
  ['xxx-', (d) => 1.1 * d],
  ['xxxx', (d) => 2.2 * d * d],
  ['..x-', () => 0.5],
  ['----', (d) => 1.4 * (1 - d)],
  ['....', (d) => 0.3 * (1 - d)],
];
const FIRST = CELLS.filter(([c]) => c[0] === 'x');

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const noteName = (m: number) => { const r = Math.round(m); return NAMES[mod(r, 12)] + (Math.floor(r / 12) - 1); };
export function tokMidi(tok: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(tok);
  return m ? NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12 : -1;
}

const chords = new Map<string, Chord>();
function chord(sym: string): Chord {
  let c = chords.get(sym);
  if (c) return c;
  const m = /^([b#]?)(vii|VII|iii|III|vi|VI|iv|IV|ii|II|v|V|i|I)(o|\+|sus)?(7|\^)?$/.exec(sym);
  const up = !!m && m[2] === m[2].toUpperCase();
  const root = m ? mod(ROMAN[m[2].toLowerCase()] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0), 12) : 0;
  let tones = !m ? [0, 4, 7] : m[3] === 'o' ? [0, 3, 6] : m[3] === '+' ? [0, 4, 8] : m[3] === 'sus' ? [0, 5, 7] : up ? [0, 4, 7] : [0, 3, 7];
  if (m?.[4] === '7') tones = [...tones, m[3] === 'o' ? 9 : 10];
  if (m?.[4] === '^') tones = [...tones, 11];
  c = { sym, root, tones, pcs: tones.map((t) => (root + t) % 12) };
  chords.set(sym, c);
  return c;
}

function table(s: string): Record<string, string[]> {
  const t: Record<string, string[]> = {};
  for (const row of s.split(',')) {
    const [k, v = ''] = row.split('>');
    if (k.trim()) t[k.trim()] = v.trim().split(/\s+/).filter(Boolean);
  }
  return t;
}

function wpick(rng: Rng, cells: [string, (d: number) => number][], d: number): string {
  const w = cells.map(([, f]) => Math.max(0, f(d)));
  let x = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cells.length; i++) { x -= w[i]; if (x < 0) return cells[i][0]; }
  return cells[0][0];
}

function rhythm(s: string): [number, number][] {
  const r: [number, number][] = [];
  let open = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === 'x') { r.push([i, 1]); open = true; }
    else if (s[i] === '-' && open) r[r.length - 1][1]++;
    else if (s[i] === '.') open = false;
  }
  return r;
}

const shift = (r: [number, number][], k: number): [number, number][] => r.map(([a, l]) => [a + k, l]);
const pick = (spec: string, letter: string) => { const p = spec.split('/'); return p[Math.min(p.length - 1, letter === 'A' ? 0 : letter === 'B' ? 1 : 2)]; };

function parseJingle(j: Jingle, bs: number): { bpm: number; bs: number; bars: Ev[][]; loop?: number } {
  const all: Ev[] = [];
  let steps = 0;
  const chans: [Ch, string | undefined][] = [['lead', j.lead], ['harm', j.harm], ['bass', j.bass], ['drum', j.drum]];
  for (const [ch, src] of chans) {
    if (!src) continue;
    const t = src.trim().split(/\s+/).filter((x) => x !== '|');
    steps = Math.max(steps, t.length);
    for (let i = 0; i < t.length; i++) {
      const k = t[i];
      if (k === '.' || k === '-') continue;
      let l = 1;
      while (t[i + l] === '-') l++;
      if (ch === 'drum') { if ('ksohct'.includes(k)) all.push({ ch, kit: k as Kit, at: i, len: 1, midi: 50, vel: 0.85 }); continue; }
      const m = tokMidi(k);
      if (m < 0) continue;
      const e: Ev = { ch, at: i, len: l * 0.92, midi: m, vel: ch === 'harm' ? 0.55 : 0.85, duty: ch === 'lead' ? j.duty?.[0] ?? 1 : j.duty?.[1] ?? 0 };
      if (ch === 'lead') e.vib = 12;
      all.push(e);
      if (ch === 'lead' && j.echo) all.push({ ...e, ch: 'echo', at: i + 3, vel: 0.3, det: 7 });
    }
  }
  const nb = Math.max(1, Math.ceil(steps / bs));
  const bars: Ev[][] = Array.from({ length: nb }, () => []);
  for (const e of all) { const b = Math.min(nb - 1, Math.floor(e.at / bs)); e.at -= b * bs; bars[b].push(e); }
  return { bpm: j.bpm, bs, bars, loop: j.loop };
}

// Generates a track bar by bar. A fixed seed keeps its themes, and each pass through the form varies the rest.
export class Composer {
  private seed: string;
  private beats: number;
  private bs: number;
  private sc: number[];
  private tonic: number;
  private bassBase: number;
  private tab: Record<string, string[]> = {};
  private home = 'I';
  private base: Record<string, string[]> = {};
  private motifs: Record<string, Motif> = {};
  private pass = 0;
  private si = 0;
  private queue: Bar[] = [];
  private drift = 0;
  private li = 0;
  private cool = 0;
  private padNote: number;
  private jing: { bpm: number; bs: number; bars: Ev[][]; loop?: number } | null = null;
  private jb = 0;

  constructor(id: string, readonly st: Style, variant?: number) {
    this.seed = st.seed ?? id;
    const pc = NOTE[st.key] ?? 0;
    this.sc = SCALES[st.scale] ?? SCALES.major;
    this.tonic = pc + 12 * ((st.oct ?? (pc >= 7 ? 4 : 5)) + 1);
    this.bassBase = 36 + pc;
    this.padNote = this.tonic - 8;
    const j = st.jingle?.length ? st.jingle[mod(variant ?? Math.floor(Math.random() * st.jingle.length), st.jingle.length)] : null;
    this.beats = j?.beats ?? st.beats ?? 4;
    this.bs = this.beats * 4;
    if (j) { this.jing = parseJingle(j, this.bs); return; }
    this.tab = table(st.prog);
    this.home = Object.keys(this.tab)[0] ?? 'I';
    const rng = new Rng(hashStr(this.seed));
    const n = Math.max(1, Math.round(8 / (st.rate ?? 1)));
    const others = Object.keys(this.tab).filter((k) => k !== this.home);
    const from = () => (others.length ? rng.pick(others) : this.home);
    this.base.A = st.progA ? st.progA.split(/\s+/) : this.walk(rng, this.home, n, this.home);
    this.base.B = this.walk(rng, from(), n, this.dominant());
    this.base.C = this.walk(rng, from(), n, this.home);
    const at = (p: string[]) => (s: number) => chord(p[clamp(Math.floor(s / (this.bs * (st.rate ?? 1))), 0, p.length - 1)]);
    const A = st.theme === 'leit' ? LEIT : st.theme === 'leitInv' ? { r: LEIT.r, d: LEIT.d.map((x) => -x), s0: 4 } : this.genMotif(rng, st.density, at(this.base.A));
    this.motifs.A = A;
    this.motifs.B = rng.chance(0.5) ? this.kin(rng, A, at(this.base.B)) : this.genMotif(rng, Math.min(0.95, st.density + 0.15), at(this.base.B));
    this.motifs.C = this.genMotif(rng, Math.max(0.1, st.density - 0.2), at(this.base.C));
  }

  next(): Bar | null {
    if (this.jing) {
      const j = this.jing;
      if (this.jb >= j.bars.length) { if (j.loop === undefined) return null; this.jb = j.loop; }
      const i = this.jb++;
      return { bpm: j.bpm, steps: j.bs, evs: j.bars[i].map((e) => ({ ...e })), tag: `jingle bar ${i}` };
    }
    if (!this.queue.length) {
      if (this.si >= this.st.form.length) { this.si = 0; this.pass++; }
      this.queue = this.section();
      this.si++;
    }
    return this.queue.shift() ?? null;
  }

  private walk(rng: Rng, start: string, n: number, end: string): string[] {
    if (n < 2) return [start];
    let out = [start];
    for (let t = 0; t < 40; t++) {
      out = [start];
      while (out.length < n - 1) { const nx = this.tab[out[out.length - 1]]; out.push(nx?.length ? rng.pick(nx) : this.home); }
      if ((this.tab[out[out.length - 1]] ?? []).includes(end)) break;
    }
    out.push(end);
    return out;
  }

  private dominant(): string {
    return ['V7', 'V', 'v', 'v7', 'bVII', 'IV', 'iv', 'bII'].find((k) => k in this.tab) ?? this.home;
  }

  private dm(deg: number): number {
    const n = this.sc.length;
    return this.tonic + 12 * Math.floor(deg / n) + this.sc[mod(deg, n)];
  }

  // Bends a scale tone by a semitone onto a borrowed chord's tone that the scale lacks.
  private alt(deg: number, c: Chord): number {
    const p = this.sc[mod(deg, this.sc.length)];
    if (c.pcs.includes(p)) return 0;
    for (const k of [1, -1]) { const r = mod(p + k, 12); if (c.pcs.includes(r) && !this.sc.includes(r)) return k; }
    return 0;
  }

  private midi(deg: number, c: Chord) { return this.dm(deg) + this.alt(deg, c); }
  private tone(deg: number, c: Chord) { return c.pcs.includes(mod(this.sc[mod(deg, this.sc.length)] + this.alt(deg, c), 12)); }
  private near(deg: number, c: Chord) { for (const k of [0, 1, -1, 2, -2, 3]) if (this.tone(deg + k, c)) return deg + k; return deg; }

  private str(at: number): number {
    const p = mod(Math.round(at), this.bs);
    return p % (this.beats === 3 ? 12 : 8) === 0 ? 2 : p % 4 === 0 ? 1 : 0;
  }

  private bassMidi(iv: number): number {
    let m = this.bassBase + mod(iv, 12);
    if (m > this.bassBase + 6) m -= 12;
    while (m < 36) m += 12;
    return m;
  }

  private harmRoot(c: Chord): number {
    const m = this.tonic - 12 + 12 * (this.st.hoct ?? 0) + c.root;
    return c.root > 7 ? m - 12 : m;
  }

  private cells(rng: Rng, d: number, cad: boolean): [number, number][] {
    let s = '';
    for (let b = 0; b < this.beats; b++) {
      if (cad && b === this.beats - 2) s += 'x---';
      else if (cad && b === this.beats - 1) s += rng.chance(0.6) ? '----' : '....';
      else s += wpick(rng, b === 0 ? FIRST : CELLS, d);
    }
    return rhythm(s);
  }

  private line(r: [number, number][], chAt: (s: number) => Chord, prev: number, rng: Rng, first?: number): number[] {
    const [lo, hi] = this.st.range ?? RANGE, mid = (lo + hi) / 2, out: number[] = [];
    let p = prev, pp = prev;
    for (let i = 0; i < r.length; i++) {
      const [at, len] = r[i], c = chAt(at), s = this.str(at);
      let best = p, bc = Infinity;
      for (let d = p - 5; d <= p + 5; d++) {
        let cost = STEP_COST[Math.abs(d - p)];
        if (!this.tone(d, c)) cost += s === 2 ? 3.5 : s === 1 ? 1.2 : len >= 4 ? 1.5 : 0;
        if (Math.abs(p - pp) >= 3 && Math.sign(d - p) === Math.sign(p - pp)) cost += 1.5;
        if (Math.abs(this.dm(d) - this.dm(p)) === 6) cost += 2;
        cost += Math.max(0, lo - d, d - hi) * 2 + Math.abs(d - mid) * 0.08 + rng.next() * 1.3;
        if (cost < bc) { bc = cost; best = d; }
      }
      if (i === 0 && first !== undefined) best = first;
      out.push(best);
      pp = p;
      p = best;
    }
    return out;
  }

  private genMotif(rng: Rng, dens: number, chAt: (s: number) => Chord): Motif {
    let r: [number, number][] = [];
    for (let k = 0; k < 6 && r.length < 4; k++) r = [...this.cells(rng, dens, false), ...shift(this.cells(rng, dens, true), this.bs)];
    const start = this.near(rng.pick([0, 2, 4, 2]), chAt(0));
    const d = this.line(r, chAt, start, rng, start);
    return { r, d: d.map((x) => x - d[0]), s0: d[0] };
  }

  private kin(rng: Rng, m: Motif, chAt: (s: number) => Chord): Motif {
    const r: [number, number][] = [...m.r.filter(([a]) => a < this.bs), ...shift(this.cells(rng, this.st.density, true), this.bs)];
    const start = this.near(m.s0 + rng.pick([2, -2, 3]), chAt(0));
    const d = this.line(r, chAt, start, rng, start);
    return { r, d: d.map((x) => x - d[0]), s0: d[0] };
  }

  private section(): Bar[] {
    const st = this.st, [letter, lay0 = 'lbhd'] = st.form[this.si].split(':');
    const rng = new Rng(hashStr(`${this.seed}/${this.pass}/${this.si}`));
    const lay = this.pass ? this.layers(lay0, rng) : lay0;
    const prog = this.progression(letter, rng, lay.includes('l') ? 1 : 2);
    const span = this.bs * (st.rate ?? 1);
    const lq = st.leit && !st.sparse && st.leit.at === letter && rng.chance(st.leit.p) ? st.leit.slot : -1;
    if (lq >= 0) prog[clamp(Math.floor((lq * 2 * this.bs) / span), 0, prog.length - 1)] = this.home;
    const chAt = (s: number) => chord(prog[clamp(Math.floor(s / span), 0, prog.length - 1)]);
    const evs = st.sparse ? this.sparse(rng) : this.arrange(letter, lay, chAt, rng, lq);
    return this.split(evs, `p${this.pass} s${this.si} ${letter}:${lay}`, prog, span, rng);
  }

  private layers(l: string, rng: Rng): string {
    let s = l;
    if (rng.chance(0.3)) { const o = [...s].filter((c) => 'hde'.includes(c)); if (o.length) s = s.replace(rng.pick(o), ''); }
    if (!s.includes('e') && s.includes('l') && rng.chance(0.25)) s += 'e';
    return s;
  }

  private progression(letter: string, rng: Rng, k: number): string[] {
    const p = [...(this.base[letter] ?? this.base.A)];
    const lo = this.st.theme && letter === 'A' ? 2 : 1, mut = (this.pass ? 0.2 : 0.08) * k;
    for (let i = lo; i < p.length - 2; i++) if (rng.chance(mut)) { const nx = this.tab[p[i - 1]]; if (nx?.length) p[i] = rng.pick(nx); }
    return p;
  }

  private arrange(letter: string, lay: string, chAt: (s: number) => Chord, rng: Rng, lq: number): Ev[] {
    const st = this.st, evs: Ev[] = [];
    const lead = this.melody(letter, chAt, rng, lq);
    const duty = mod((st.duty?.[0] ?? 1) + (letter !== 'A' && rng.chance(0.4) ? 1 : 0), 3);
    if (lay.includes('l')) for (const n of lead) {
      const vel = (n.vel ?? 1) * (this.str(n.at) === 2 ? 0.95 : 0.8);
      const e: Ev = { ch: 'lead', at: n.at, len: Math.max(0.5, n.len * (st.gate ?? 0.9)), midi: this.midi(n.deg, chAt(n.at)) + (n.semi ?? 0), vel, duty, vib: st.vib ?? 12 };
      if (st.pluck) e.env = st.pluck;
      if (n.det) e.det = n.det;
      if (n.bend) e.bend = n.bend;
      evs.push(e);
      if (n.uni) evs.push({ ...e, ch: 'harm', det: (n.det ?? 0) + 22, vel: vel * 0.55, duty: 0 });
      if (lay.includes('e')) evs.push({ ...e, ch: 'echo', at: n.at + (st.echo ?? 3), vel: vel * 0.38, det: (n.det ?? 0) + 7 });
    }
    if (lay.includes('h')) {
      let m = pick(st.harm ?? 'off', letter);
      if (m === 'third' && !lay.includes('l')) m = 'pad';
      evs.push(...this.harmony(m, chAt, rng, lead));
    }
    if (lay.includes('b')) evs.push(...this.bassLine(pick(st.bass ?? 'half', letter), chAt, rng));
    if (lay.includes('d') && st.drums) evs.push(...this.drumLine(rng));
    return evs;
  }

  private melody(letter: string, chAt: (s: number) => Chord, rng: Rng, lq: number): N[] {
    const st = this.st, slot = this.bs * 2, form = st.phrase ?? 'AABA';
    const m = this.motifs[letter] ?? this.motifs.A;
    const amt = Math.min(1, 0.35 + this.pass * 0.2);
    const out: N[] = [], seen = new Set<string>();
    let skip = -1;
    for (let k = 0; k < 4; k++) {
      if (k === skip) continue;
      const off = k * slot, f = form[k] ?? 'A';
      let ns: N[], exact = false, w = 1;
      if (k === lq && st.leit) {
        ns = this.leitNotes(st.leit.fx, rng, off);
        exact = !st.leit.fx.includes('x');
        if (st.leit.fx.includes('s')) { w = 2; skip = k + 1; }
      } else if (f === 'A' && !seen.has('A')) { ns = this.place(m, off); exact = !!st.theme && letter === 'A'; }
      else if (f === 'A') ns = this.vary(this.place(m, off), rng, amt);
      else if (f === 'B') ns = this.develop(m, off, rng);
      else ns = this.free(off, chAt, rng, out.length ? out[out.length - 1].deg : m.s0);
      seen.add(f);
      const end = off + w * slot;
      ns = ns.filter((n) => n.at < end).map((n) => ({ ...n, len: Math.min(n.len, end - n.at) }));
      if (!exact) this.fit(ns, chAt);
      this.range(ns);
      out.push(...ns);
    }
    this.cadence(out, chAt, letter);
    return out;
  }

  private place(m: Motif, off: number): N[] {
    return m.r.map(([a, l], i) => ({ at: off + a, len: l, deg: m.s0 + m.d[i] }));
  }

  private vary(ns: N[], rng: Rng, amt: number): N[] {
    const out = ns.map((n) => ({ ...n }));
    if (rng.chance(0.6 * amt)) {
      const c = out.map((n, j) => (n.len >= 4 && j < out.length - 1 ? j : -1)).filter((j) => j >= 0);
      if (c.length) {
        const i = rng.pick(c), n = out[i], h = Math.floor(n.len / 2);
        out.splice(i + 1, 0, { at: n.at + h, len: n.len - h, deg: n.deg + rng.pick([1, -1]) });
        n.len = h;
      }
    }
    if (rng.chance(0.4 * amt)) for (let i = 1; i < out.length; i++) {
      const n = out[i], p = out[i - 1];
      if (this.str(n.at) === 2 && p.at < n.at - 2) { p.len = Math.min(p.len, n.at - 2 - p.at); n.at -= 2; n.len += 2; break; }
    }
    if (rng.chance(0.5 * amt) && out.length > 2) out[out.length - 2].deg += rng.pick([-1, 1, 2]);
    return out;
  }

  private develop(m: Motif, off: number, rng: Rng): N[] {
    const bs = this.bs, head = m.r.map((r, i) => ({ a: r[0], l: r[1], d: m.d[i] })).filter((x) => x.a < bs);
    const op = rng.pick(head.length >= 3 ? ['seq', 'inv', 'retro', 'aug', 'frag', 'trans'] : ['inv', 'retro', 'trans']);
    const s0 = m.s0 + (op === 'trans' ? rng.pick([2, 3, -2, 4]) : rng.chance(0.4) ? rng.pick([-2, 2]) : 0);
    const n = (a: number, l: number, d: number): N => ({ at: off + a, len: l, deg: s0 + d });
    if (op === 'seq') { const k = rng.pick([-1, 1, -2, 2]); return [...head.map((x) => n(x.a, x.l, x.d)), ...head.map((x) => n(bs + x.a, x.l, x.d + k))]; }
    if (op === 'inv') return m.r.map((r, i) => n(r[0], r[1], -m.d[i]));
    if (op === 'retro') { const ds = [...m.d].reverse(); return m.r.map((r, i) => n(r[0], r[1], ds[i] - ds[0])); }
    if (op === 'aug') return head.map((x) => n(x.a * 2, x.l * 2, x.d));
    if (op === 'frag') {
      const q = bs / 2, f = head.filter((x) => x.a < q), out: N[] = [];
      for (let k = 0; k < 3; k++) for (const x of f) out.push(n(k * q + x.a, Math.min(x.l, q - x.a), x.d - k));
      out.push(n(3 * q, q, f[0].d - 3));
      return out;
    }
    return m.r.map((r, i) => n(r[0], r[1], m.d[i]));
  }

  private free(off: number, chAt: (s: number) => Chord, rng: Rng, prev: number): N[] {
    const d = this.st.density;
    const r = shift([...this.cells(rng, d, false), ...shift(this.cells(rng, d, true), this.bs)], off);
    const degs = this.line(r, chAt, prev, rng);
    return r.map(([a, l], i) => ({ at: a, len: l, deg: degs[i] }));
  }

  private leitNotes(fx: string, rng: Rng, off: number): N[] {
    const k = fx.includes('s') ? 2 : 1, cnt = fx.includes('h') ? 5 : LEIT.d.length, out: N[] = [];
    let drift = 0;
    for (let i = 0; i < cnt; i++) {
      if (fx.includes('d') && i > 0 && rng.chance(0.3)) continue;
      const n: N = { at: off + LEIT.r[i][0] * k, len: LEIT.r[i][1] * k, deg: LEIT.s0 + LEIT.d[i] };
      let semi = 0;
      if (fx.includes('l') && this.sc.length === 7 && mod(n.deg, 7) === 3) semi += 1;
      if (fx.includes('t') && i === 4) semi += 1;
      if (fx.includes('t') && i === 7) semi -= 1;
      if (semi) n.semi = semi;
      if (fx.includes('b')) { drift += rng.range(-14, 10); n.det = drift; if (n.len >= 4) n.bend = -0.4; }
      if (fx.includes('u')) n.uni = true;
      if (fx.includes('f')) n.vel = 0.5;
      out.push(n);
    }
    return out;
  }

  private fit(ns: N[], chAt: (s: number) => Chord) {
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i];
      if (n.semi || (this.str(n.at) < 2 && n.len < 6)) continue;
      const c = chAt(n.at);
      if (this.tone(n.deg, c)) continue;
      const prev = i > 0 ? ns[i - 1].deg : n.deg;
      const opts = [1, -1, 2, -2].map((k) => n.deg + k).filter((d) => this.tone(d, c));
      if (opts.length) n.deg = opts.sort((a, b) => Math.abs(a - n.deg) * 2 + Math.abs(a - prev) * 0.5 - (Math.abs(b - n.deg) * 2 + Math.abs(b - prev) * 0.5))[0];
    }
  }

  private range(ns: N[]) {
    if (!ns.length) return;
    const [lo, hi] = this.st.range ?? RANGE, n = this.sc.length;
    const out = (k: number) => ns.reduce((a, x) => a + Math.max(0, lo - 1 - x.deg - k, x.deg + k - hi - 1), 0);
    const sh = [0, -n, n].reduce((b, k) => (out(k) < out(b) ? k : b), 0);
    for (const x of ns) {
      x.deg += sh;
      if (x.deg > hi + 2) x.deg -= n;
      else if (x.deg < lo - 2) x.deg += n;
    }
  }

  private cadence(ns: N[], chAt: (s: number) => Chord, letter: string) {
    const last = ns[ns.length - 1];
    if (!last || last.semi) return;
    const end = 8 * this.bs, c = chAt(end - 1), want = letter === 'B' ? c.pcs.slice(0, 3) : [c.pcs[0]];
    for (const k of [0, -1, 1, -2, 2, -3, 3]) {
      const d = last.deg + k;
      if (want.includes(mod(this.sc[mod(d, this.sc.length)] + this.alt(d, c), 12))) { last.deg = d; break; }
    }
    last.len = Math.max(last.len, Math.min(8, end - 2 - last.at));
  }

  private harmony(mode: string, chAt: (s: number) => Chord, rng: Rng, lead: N[]): Ev[] {
    const ev: Ev[] = [], bs = this.bs, total = 8 * bs, duty = this.st.duty?.[1] ?? 0, env = this.st.pluck;
    const push = (e: Ev) => { if (env) e.env = env; ev.push(e); };
    if (mode === 'arp16' || mode === 'arp32') {
      const rate = mode === 'arp32' ? 0.5 : 1, rot = rng.int(3);
      let shape = rng.int(3);
      for (let s = 0; s < total; s += 4) {
        if (s % bs === 0 && rng.chance(0.2)) shape = rng.int(3);
        const c = chAt(s), k = rot % c.tones.length, r = [...c.tones.slice(k), ...c.tones.slice(0, k).map((x) => x + 12)];
        const t = r.length > 3 ? r : [...r, r[0] + 12];
        const arp = shape === 0 ? t : shape === 1 ? [...t].reverse() : [...t, ...t.slice(1, -1).reverse()];
        push({ ch: 'harm', at: s, len: 4, midi: this.harmRoot(c), arp, rate, vel: s % bs === 0 ? 0.6 : 0.5, duty });
      }
    } else if (mode === 'stab') {
      const pos = this.beats === 3 ? [4, 8] : [2, 6, 10, 14];
      for (let b = 0; b < 8; b++) for (const p of pos) {
        const s = b * bs + p, c = chAt(s);
        push({ ch: 'harm', at: s, len: 1.5, midi: this.harmRoot(c), arp: [c.tones[1], c.tones[2], c.tones[3] ?? 12], rate: 0.5, vel: 0.5, duty });
      }
    } else if (mode === 'pad') {
      const span = Math.min(bs * (this.st.rate ?? 1), bs * 2);
      for (let s = 0; s < total; s += span) {
        const c = chAt(s);
        let best = this.padNote, bc = Infinity;
        c.tones.forEach((t, i) => {
          for (const o of [-12, 0, 12]) {
            const m = this.harmRoot(c) + t + o;
            const cost = Math.abs(m - this.padNote) + (i === 1 || i === 3 ? 0 : 2.5) + (m < this.tonic - 15 || m > this.tonic + 2 ? 6 : 0);
            if (cost < bc) { bc = cost; best = m; }
          }
        });
        this.padNote = best;
        push({ ch: 'harm', at: s, len: span - 0.5, midi: best, vel: 0.42, duty, vib: 8 });
      }
    } else if (mode === 'third') {
      for (const n of lead) {
        if (n.len < 2) continue;
        const c = chAt(n.at);
        let h = n.deg - 2;
        for (const k of [2, 3, 4, 5]) if (this.tone(n.deg - k, c)) { h = n.deg - k; break; }
        push({ ch: 'harm', at: n.at, len: n.len * 0.9, midi: this.midi(h, c), vel: 0.5, duty });
      }
    }
    return ev;
  }

  private bassLine(mode: string, chAt: (s: number) => Chord, rng: Rng): Ev[] {
    const ev: Ev[] = [], bs = this.bs;
    const put = (at: number, len: number, midi: number, vel = 0.85) => ev.push({ ch: 'bass', at, len, midi, vel });
    const R = (c: Chord, add = 0) => this.bassMidi(c.root) + add;
    const low5 = (c: Chord) => { const m = R(c, c.tones[2] - 12); return m < 36 ? m + 12 : m; };
    for (let b = 0; b < 8; b++) {
      const o = b * bs, c = chAt(o), nx = chAt(Math.min(8 * bs - 1, o + bs));
      if (mode === 'half') {
        if (this.beats === 3) put(o, bs - 1, R(c));
        else { const c2 = chAt(o + 8); put(o, 7, R(c)); put(o + 8, 7, c2 === c ? R(c, c.tones[2]) : R(c2), 0.75); }
      } else if (mode === 'pump') {
        for (let s = 0; s < bs; s += 2) put(o + s, 1.6, R(chAt(o + s), s % 4 === 2 ? 12 : 0), s % 4 ? 0.7 : 0.9);
      } else if (mode === 'gallop') {
        for (let s = 0; s < bs; s += 4) { const cc = chAt(o + s); put(o + s, 1.8, R(cc), 0.95); put(o + s + 2, 0.9, R(cc), 0.7); put(o + s + 3, 0.9, R(cc, 12), 0.75); }
      } else if (mode === 'drive') {
        for (let s = 0; s < bs; s += 2) { const cc = chAt(o + s); put(o + s, 1.7, s === bs - 2 && rng.chance(0.5) ? R(cc, cc.tones[2]) : R(cc), s % 4 ? 0.7 : 0.9); }
      } else if (mode === 'walk') {
        for (let q = 0; q < this.beats; q++) {
          const s = o + q * 4, cc = chAt(s);
          const m = q === 0 ? R(cc) : q === this.beats - 1 ? R(nx) + rng.pick([-1, 1, -2]) : R(cc, rng.pick([cc.tones[1], cc.tones[2], cc.tones[2], 12]));
          put(s, 3.4, m, q ? 0.75 : 0.9);
        }
      } else if (mode === 'bounce' && this.beats === 4) {
        put(o, 3, R(c));
        if (rng.chance(0.5)) put(o + 6, 1, R(c, 12), 0.6);
        const c2 = chAt(o + 8);
        put(o + 8, 3, c2 === c ? low5(c) : R(c2), 0.8);
        if (rng.chance(0.4)) put(o + 14, 1, R(nx) - 1, 0.6);
      } else if (mode === 'arp') {
        for (let k = 0; k < bs / 2; k++) {
          const cc = chAt(o + k * 2), t = cc.tones, P = [0, t[2], 12, t[1] + 12, 12, t[2], 0, t[2]];
          put(o + k * 2, 1.8, R(cc, P[k % P.length]), k ? 0.7 : 0.9);
        }
      } else if (mode === 'pedal') {
        if (b % 2 === 0) put(o, bs * 2 - 1, this.bassMidi(rng.chance(0.25) ? 7 : 0), 0.8);
      } else if (mode === 'riff') {
        const t = (this.st.riff ?? '0').trim().split(/\s+/);
        for (let s = 0; s < bs; s++) {
          const v = Number(t[s % t.length]);
          if (!Number.isFinite(v) || t[s % t.length] === '.' || t[s % t.length] === '-') continue;
          let l = 1;
          while (s + l < bs && t[(s + l) % t.length] === '-') l++;
          put(o + s, l * 0.9, R(chAt(o + s), v + (s % 4 && v < 12 && rng.chance(0.12) ? 12 : 0)), s % 4 ? 0.7 : 0.9);
        }
      } else if (mode === 'waltz' || mode === 'bounce') {
        put(o, 3.5, b % 2 ? R(c, c.tones[2]) : R(c));
      } else put(o, bs - 1, R(c));
    }
    return ev;
  }

  private drumLine(rng: Rng): Ev[] {
    const st = this.st, d = st.drums ?? {}, bs = this.bs;
    let ev: Ev[] = [];
    if ((this.si > 0 || this.pass > 0) && rng.chance(st.crash ?? 0.25)) ev.push({ ch: 'drum', kit: 'c', at: 0, len: 1, midi: 0, vel: 0.8 });
    for (let b = 0; b < 8; b++) {
      const o = b * bs;
      for (const k of Object.keys(d) as Kit[]) {
        const pat = d[k] ?? '';
        for (let s = 0; s < bs && pat.length; s++) {
          const c = pat[s % pat.length], p = c === '.' ? 0 : Number(c) / 9;
          if (p > 0 && rng.chance(p)) ev.push({ ch: 'drum', kit: k, at: o + s, len: 1, midi: 0, vel: (s % 4 === 0 ? 1 : 0.78) * (0.75 + 0.25 * p) });
        }
      }
      if (b === 7 && rng.chance(st.fill ?? 0.75)) ev = this.fill(ev, o, rng.int(4));
      else if (b === 3 && rng.chance(0.3)) ev = this.fill(ev, o, 0);
    }
    return ev;
  }

  private fill(ev: Ev[], o: number, kind: number): Ev[] {
    const from = o + this.bs - (kind === 0 ? 4 : 8);
    const out = ev.filter((e) => e.at < from || e.at >= o + this.bs);
    const hit = (kit: Kit, at: number, vel: number, midi = 0) => out.push({ ch: 'drum', kit, at, len: 1, midi, vel });
    if (kind === 0) for (let i = 0; i < 4; i++) hit('s', from + i, 0.55 + 0.12 * i);
    else if (kind === 1) { hit('k', from, 0.9); for (let i = 0; i < 4; i++) hit('s', from + i * 2, 0.6 + 0.1 * i); }
    else if (kind === 2) [57, 57, 53, 53, 50, 50, 45, 45].forEach((m, i) => hit('t', from + i, 0.85, m));
    else { for (const k of [0, 3, 6]) hit('s', from + k, 0.9); hit('k', from, 0.9); hit('k', from + 3, 0.8); }
    return out;
  }

  private sparse(rng: Rng): Ev[] {
    const sp = this.st.sparse!, bs = this.bs, ev: Ev[] = [], fx = sp.fx, duty = this.st.duty?.[0] ?? 0;
    for (let b = 0; b < 8; b++) {
      const o = b * bs;
      if (this.cool > 0) this.cool--;
      else if (rng.chance(sp.p)) {
        let at = o + rng.int(this.beats * 2) * 2;
        const n = 1 + rng.int(sp.run);
        for (let j = 0; j < n; j++) {
          const i = this.li++ % LEIT.d.length;
          if (fx.includes('d') && rng.chance(0.3)) continue;
          const deg = LEIT.s0 + LEIT.d[i];
          let semi = 0;
          if (fx.includes('l') && this.sc.length === 7 && mod(deg, 7) === 3) semi += 1;
          if (fx.includes('t') && i === 4) semi += 1;
          this.drift = clamp(this.drift + rng.range(-12, 12), -45, 45);
          const len = rng.pick([6, 8, 12, 16]), vel = fx.includes('f') ? 0.4 : 0.6;
          const e: Ev = { ch: 'lead', at, len, midi: this.dm(deg) + semi, vel, duty, vib: this.st.vib ?? 6, env: 0.9 };
          if (fx.includes('b')) { e.det = this.drift; if (len >= 12) e.bend = -0.25; }
          ev.push(e, { ...e, ch: 'echo', at: at + 3, vel: vel * 0.35, det: (e.det ?? 0) + 7 }, { ...e, ch: 'echo', at: at + 6, vel: vel * 0.15, det: (e.det ?? 0) - 5 });
          if (fx.includes('u')) ev.push({ ...e, ch: 'harm', at: at + 0.2, vel: vel * 0.6, det: (e.det ?? 0) + 24, duty: 0 });
          at += rng.pick([2, 3, 4, 6]);
        }
        this.cool = sp.run > 1 ? rng.int(2) : 1 + rng.int(2);
      }
      if (rng.chance(sp.drone)) ev.push({ ch: 'bass', at: o, len: bs * 2 - 1, midi: this.bassMidi(rng.chance(0.7) ? 0 : fx.includes('t') ? 6 : 7), vel: 0.5, env: 1.5 });
      if (sp.ticks && rng.chance(sp.ticks)) ev.push({ ch: 'drum', kit: 'h', at: o + rng.int(bs), len: 1, midi: 0, vel: 0.3 });
    }
    return ev;
  }

  private split(evs: Ev[], tag: string, prog: string[], span: number, rng: Rng): Bar[] {
    const st = this.st, bs = this.bs, sw = st.swing ?? 0, bars: Bar[] = [];
    for (let b = 0; b < 8; b++) {
      const syms: string[] = [];
      for (let s = b * bs; s < (b + 1) * bs; s += Math.min(span, bs)) syms.push(prog[clamp(Math.floor(s / span), 0, prog.length - 1)]);
      bars.push({ bpm: st.bpm, steps: bs, evs: [], tag: `${tag} b${b} | ${st.sparse ? '-' : syms.join(' ')}` });
    }
    for (const e of evs) {
      const b = clamp(Math.floor(e.at / bs), 0, 7), i = Math.round(e.at - b * bs);
      e.at -= b * bs;
      if (sw && Math.abs(e.at - i) < 1e-6) e.at += i % 4 === 2 ? sw : i % 2 ? sw / 2 : 0;
      e.at = Math.max(0, e.at + rng.range(-0.03, 0.03));
      e.vel *= rng.range(0.93, 1.04);
      bars[b].evs.push(e);
    }
    if (st.decay) this.decay(bars, rng);
    return bars;
  }

  // The hold line wears down over several passes, then recovers.
  private decay(bars: Bar[], rng: Rng) {
    const cyc = [0, 0, 0.25, 0.5, 0.75, 1], p = this.pass % cyc.length, total = this.st.form.length * 8;
    bars.forEach((bar, b) => {
      const f = (this.si * 8 + b) / total;
      const L = p === cyc.length - 1 ? 1 : cyc[p] + (cyc[p + 1] - cyc[p]) * f;
      if (L <= 0) return;
      this.drift = clamp(this.drift * 0.85 + rng.range(-1, 1) * 14 * L, -40 * L, 40 * L);
      bar.bpm = this.st.bpm * (1 - 0.1 * L - rng.range(0, 0.03) * L);
      bar.tag += ` decay ${L.toFixed(2)}`;
      if (L > 0.45 && rng.chance(0.12 * L)) { bar.evs = []; bar.tag += ' silent'; return; }
      bar.evs = bar.evs.filter((e) => e.ch === 'bass' || e.ch === 'drum' || !rng.chance(0.25 * L));
      for (const e of bar.evs) {
        if (e.ch === 'drum') continue;
        e.det = (e.det ?? 0) + this.drift * (e.ch === 'bass' ? 0.5 : 1) + rng.range(-6, 6) * L;
        if (e.ch === 'lead' && e.len >= 4) e.bend = -0.3 * L;
      }
    });
  }
}

const fmt = (e: Ev) => {
  const at = Math.round(e.at * 10) / 10;
  if (e.ch === 'drum') return `${e.kit}${at}`;
  let s = `${noteName(e.midi)}@${at}/${Math.round(e.len * 10) / 10}`;
  if (e.arp) s += `[${e.arp.join(',')}]`;
  if (e.det && Math.abs(e.det) >= 5) s += `~${Math.round(e.det)}c`;
  if (e.bend) s += `v${e.bend.toFixed(1)}`;
  return s;
};

// Plain-text listing of a track's generated notes, for inspecting output without hearing it.
export function scoreText(id: string, bars = 8, styles: Record<string, Style> = MUSIC, variant = 0): string {
  const st = styles[id];
  if (!st) return `unknown track ${id}`;
  const c = new Composer(id, st, variant);
  const lines = [`${id}: ${st.bpm} bpm, ${st.key} ${st.scale}${st.beats === 3 ? ', 3/4' : ''}`];
  for (let i = 0; i < bars; i++) {
    const b = c.next();
    if (!b) { lines.push('(end)'); break; }
    const echo = b.evs.filter((e) => e.ch === 'echo').length;
    lines.push(`#${i} ${Math.round(b.bpm)}bpm ${b.tag}${echo ? ` (+${echo} echo)` : ''}`);
    for (const ch of ['lead', 'harm', 'bass', 'drum'] as Ch[]) {
      const es = b.evs.filter((e) => e.ch === ch).sort((x, y) => x.at - y.at);
      if (es.length) lines.push(`  ${ch.padEnd(4)} ${es.map(fmt).join(' ')}`);
    }
  }
  return lines.join('\n');
}
