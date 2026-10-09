// Setting: the machine puzzle's rules. Arms on a small board carry stones between stations on looping tapes.
// This file has no drawing in it, so the content test can run every puzzle's reference machine in Node.

/** Rough stones come out of inputs. The polisher turns each into its polished stone. */
export type Stone = 'nacre' | 'pearl' | 'resin' | 'amber' | 'pebble' | 'glass' | 'chip' | 'star';
export const POLISH: Partial<Record<Stone, Stone>> = { nacre: 'pearl', resin: 'amber', pebble: 'glass', chip: 'star' };
export const STONE_NAME: Record<Stone, string> = {
  nacre: 'Rough nacre', pearl: 'Pearl', resin: 'Resin', amber: 'Amber', pebble: 'Sea pebble', glass: 'Beach glass', chip: 'Star chip', star: 'Star glass',
};

/** Directions: 0 east, 1 south, 2 west, 3 north. Turning right goes clockwise on the screen. */
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

/** Tape steps: grab, drop, turn left, turn right, reach out, pull in, and wait. */
export type Step = 'G' | 'D' | 'L' | 'R' | 'O' | 'I' | '.';
export const STEPS: Step[] = ['G', 'D', 'L', 'R', 'O', 'I', '.'];
export const STEP_NAME: Record<Step, string> = { G: 'Grab', D: 'Drop', L: 'Turn left', R: 'Turn right', O: 'Reach out', I: 'Pull in', '.': 'Wait' };
export const TAPE_LEN = 16;

export type StationKind = 'polish' | 'set' | 'split';
export interface ArmPart { kind: 'arm'; x: number; y: number; dir: number; tape: string }
/** A setter or splitter covers its own cell and the next one in its direction. A polisher covers one cell. */
export interface StationPart { kind: StationKind; x: number; y: number; dir: number }
export type Part = ArmPart | StationPart;
export interface Machine { parts: Part[] }

/** A shape of stones relative to a cell, with bonds between atom indices. */
export interface Shape { atoms: [number, number, Stone][]; bonds: [number, number][] }
export interface Io { x: number; y: number; shape: Shape }

export interface Puzzle {
  id: string;
  name: string;
  /** One line on what the puzzle teaches, shown under its name. */
  idea: string;
  w: number;
  h: number;
  inputs: Io[];
  outputs: Io[];
  /** Pieces each output must take. */
  need: number;
  /** The most of each part the player may place. */
  limit: { arm: number; polish: number; set: number; split: number };
  /** The machine the test runs to prove the puzzle can be solved. */
  ref: Machine;
}

export const COST: Record<Part['kind'], number> = { arm: 20, polish: 10, set: 10, split: 10 };

export interface Atom { x: number; y: number; s: Stone }
export interface Piece { id: number; atoms: Atom[]; bonds: [number, number][] }
export interface ArmState { x: number; y: number; dir: number; len: number; hold: number | null }
export interface Sim {
  cycle: number;
  pieces: Piece[];
  arms: ArmState[];
  /** Pieces each output has taken. */
  got: number[];
  err: string | null;
  errAt: [number, number] | null;
  done: boolean;
  seen: Set<number>;
  nextId: number;
}

export const cellsOf = (p: StationPart): [number, number][] =>
  p.kind === 'polish' ? [[p.x, p.y]] : [[p.x, p.y], [p.x + DX[p.dir], p.y + DY[p.dir]]];

/** The tapes' shared loop length: the last step any tape uses. Blank steps before it are waits. */
export function period(m: Machine): number {
  let n = 1;
  for (const p of m.parts) if (p.kind === 'arm') { const t = p.tape.replace(/\.+$/, ''); n = Math.max(n, t.length); }
  return n;
}

export function cost(m: Machine): number { return m.parts.reduce((n, p) => n + COST[p.kind], 0); }

/** Problems that stop a machine from being run at all, such as two parts on one cell. */
export function checkMachine(pz: Puzzle, m: Machine): string | null {
  const used = new Map<number, string>();
  const key = (x: number, y: number) => y * 64 + x;
  for (const io of [...pz.inputs, ...pz.outputs]) for (const [dx, dy] of io.shape.atoms) used.set(key(io.x + dx, io.y + dy), 'io');
  const n = { arm: 0, polish: 0, set: 0, split: 0 };
  for (const p of m.parts) {
    n[p.kind]++;
    const cells: [number, number][] = p.kind === 'arm' ? [[p.x, p.y]] : cellsOf(p);
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x >= pz.w || y >= pz.h) return 'A part is off the board.';
      const k = key(x, y), was = used.get(k);
      if (p.kind === 'arm' && was) return 'An arm stands on another part.';
      if (p.kind !== 'arm' && was && was !== 'io') return 'Two parts share a cell.';
      used.set(k, p.kind);
    }
    if (p.kind === 'arm' && p.tape.length > TAPE_LEN) return 'A tape is too long.';
  }
  for (const k of Object.keys(n) as (keyof typeof n)[]) if (n[k] > pz.limit[k]) return `Too many parts of one kind.`;
  return null;
}

function spawn(s: Sim, io: Io): Piece {
  return { id: s.nextId++, atoms: io.shape.atoms.map(([dx, dy, st]) => ({ x: io.x + dx, y: io.y + dy, s: st })), bonds: io.shape.bonds.map(b => [b[0], b[1]]) };
}

export function start(pz: Puzzle, m: Machine): Sim {
  const arms = m.parts.filter((p): p is ArmPart => p.kind === 'arm').map(a => ({ x: a.x, y: a.y, dir: a.dir, len: 1, hold: null }));
  const s: Sim = { cycle: 0, pieces: [], arms, got: pz.outputs.map(() => 0), err: null, errAt: null, done: false, seen: new Set(), nextId: 1 };
  for (const p of m.parts) {
    const cells: [number, number][] = p.kind === 'arm' ? [[p.x, p.y]] : cellsOf(p);
    for (const [x, y] of cells) s.seen.add(y * 64 + x);
  }
  return s;
}

const atomAt = (s: Sim, x: number, y: number): Piece | undefined => s.pieces.find(p => p.atoms.some(a => a.x === x && a.y === y));
const held = (s: Sim, id: number) => s.arms.some(a => a.hold === id);
export const gripOf = (a: ArmState): [number, number] => [a.x + DX[a.dir] * a.len, a.y + DY[a.dir] * a.len];

/** Splits a piece into its bonded parts. */
function components(p: Piece, nextId: () => number): Piece[] {
  const n = p.atoms.length, seen = new Array(n).fill(-1);
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i] >= 0) continue;
    const q = [i]; seen[i] = c;
    while (q.length) { const k = q.pop()!; for (const [a, b] of p.bonds) { const o = a === k ? b : b === k ? a : -1; if (o >= 0 && seen[o] < 0) { seen[o] = c; q.push(o); } } }
    c++;
  }
  if (c === 1) return [p];
  const out: Piece[] = [];
  for (let k = 0; k < c; k++) {
    const idx = [...Array(n).keys()].filter(i => seen[i] === k);
    const map = new Map(idx.map((i, j) => [i, j]));
    out.push({ id: k === 0 ? p.id : nextId(), atoms: idx.map(i => p.atoms[i]), bonds: p.bonds.filter(([a]) => map.has(a)).map(([a, b]) => [map.get(a)!, map.get(b)!]) });
  }
  return out;
}

const fail = (s: Sim, why: string, at: [number, number] | null): void => { s.err = why; s.errAt = at; };

/** Whether a resting piece is exactly the output's shape at the output's cell. */
function matches(p: Piece, io: Io): boolean {
  const t = io.shape;
  if (p.atoms.length !== t.atoms.length || p.bonds.length !== t.bonds.length) return false;
  const idx: number[] = [];
  for (const [dx, dy, st] of t.atoms) {
    const i = p.atoms.findIndex(a => a.x === io.x + dx && a.y === io.y + dy && a.s === st);
    if (i < 0) return false;
    idx.push(i);
  }
  const has = (a: number, b: number) => p.bonds.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return t.bonds.every(([a, b]) => has(idx[a], idx[b]));
}

/** Runs one cycle: inputs refill, every arm does its step, stations work on resting stones, outputs take pieces. */
export function step(pz: Puzzle, m: Machine, s: Sim): void {
  if (s.err || s.done) return;
  const per = period(m);
  // Inputs refill when every cell of their shape is clear.
  for (const io of pz.inputs) if (io.shape.atoms.every(([dx, dy]) => !atomAt(s, io.x + dx, io.y + dy))) s.pieces.push(spawn(s, io));
  const tapes = m.parts.filter((p): p is ArmPart => p.kind === 'arm').map(a => a.tape);
  s.arms.forEach((a, i) => {
    if (s.err) return;
    const st = (tapes[i][s.cycle % per] || '.') as Step;
    const piece = a.hold !== null ? s.pieces.find(p => p.id === a.hold) : undefined;
    const move = (fn: (x: number, y: number) => [number, number]) => { if (piece) for (const at of piece.atoms) [at.x, at.y] = fn(at.x, at.y); };
    if (st === 'G' && a.hold === null) {
      const [gx, gy] = gripOf(a);
      const p = atomAt(s, gx, gy);
      if (p && held(s, p.id)) { fail(s, 'Two arms took hold of one piece.', [gx, gy]); return; }
      if (p) a.hold = p.id;
    } else if (st === 'D') a.hold = null;
    else if (st === 'R') { a.dir = (a.dir + 1) % 4; move((x, y) => [a.x - (y - a.y), a.y + (x - a.x)]); }
    else if (st === 'L') { a.dir = (a.dir + 3) % 4; move((x, y) => [a.x + (y - a.y), a.y - (x - a.x)]); }
    else if (st === 'O' && a.len < 2) { a.len = 2; move((x, y) => [x + DX[a.dir], y + DY[a.dir]]); }
    else if (st === 'I' && a.len > 1) { a.len = 1; move((x, y) => [x - DX[a.dir], y - DY[a.dir]]); }
    const [gx, gy] = gripOf(a);
    s.seen.add(gy * 64 + gx);
  });
  if (s.err) return;
  // Stones may not share a cell or leave the board.
  const where = new Map<number, number>();
  for (const p of s.pieces) for (const at of p.atoms) {
    if (at.x < 0 || at.y < 0 || at.x >= pz.w || at.y >= pz.h) { fail(s, 'A stone went off the board.', [Math.max(0, Math.min(pz.w - 1, at.x)), Math.max(0, Math.min(pz.h - 1, at.y))]); return; }
    const k = at.y * 64 + at.x;
    if (where.has(k)) { fail(s, 'Two stones ran into each other.', [at.x, at.y]); return; }
    where.set(k, p.id);
    s.seen.add(k);
  }
  // Stations work on stones nobody holds.
  for (const part of m.parts) {
    if (part.kind === 'arm') continue;
    const cells = cellsOf(part);
    if (part.kind === 'polish') {
      const p = atomAt(s, part.x, part.y);
      if (p && !held(s, p.id)) for (const at of p.atoms) if (at.x === part.x && at.y === part.y && POLISH[at.s]) at.s = POLISH[at.s]!;
      continue;
    }
    const [[ax, ay], [bx, by]] = cells;
    const pa = atomAt(s, ax, ay), pb = atomAt(s, bx, by);
    if (!pa || !pb || held(s, pa.id) || held(s, pb.id)) continue;
    const ia = pa.atoms.findIndex(t => t.x === ax && t.y === ay), ib = pb.atoms.findIndex(t => t.x === bx && t.y === by);
    if (part.kind === 'set') {
      if (pa === pb) { if (!pa.bonds.some(([x, y]) => (x === ia && y === ib) || (x === ib && y === ia))) pa.bonds.push([ia, ib]); continue; }
      const off = pa.atoms.length;
      pa.atoms.push(...pb.atoms);
      pa.bonds.push(...pb.bonds.map(([x, y]) => [x + off, y + off] as [number, number]), [ia, ib + off]);
      s.pieces = s.pieces.filter(p => p !== pb);
    } else if (pa === pb) {
      pa.bonds = pa.bonds.filter(([x, y]) => !((x === ia && y === ib) || (x === ib && y === ia)));
      const parts = components(pa, () => s.nextId++);
      s.pieces = s.pieces.filter(p => p !== pa).concat(parts);
    }
  }
  // Outputs take any resting piece that is exactly their shape.
  pz.outputs.forEach((io, k) => {
    const p = atomAt(s, io.x + io.shape.atoms[0][0], io.y + io.shape.atoms[0][1]);
    if (p && !held(s, p.id) && matches(p, io)) { s.pieces = s.pieces.filter(q => q !== p); s.got[k]++; }
  });
  s.cycle++;
  if (s.got.every(n => n >= pz.need)) s.done = true;
}

export interface Result { ok: boolean; cycles: number; cost: number; area: number; err: string | null }

/** Runs a machine until it delivers, fails, or reaches the cycle limit. */
export function runAll(pz: Puzzle, m: Machine, max = 4000): Result {
  const bad = checkMachine(pz, m);
  if (bad) return { ok: false, cycles: 0, cost: cost(m), area: 0, err: bad };
  const s = start(pz, m);
  while (!s.done && !s.err && s.cycle < max) step(pz, m, s);
  return { ok: s.done, cycles: s.cycle, cost: cost(m), area: s.seen.size, err: s.err || (s.done ? null : 'It never finished.') };
}
