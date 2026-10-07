// Movers: things with a few lines of rote that run one line each time Wait takes a step,
// or answer a verb cast at them. Lumps roll, seeds grow, walkers walk. In Act 2 Wait writes into them.

/** Facing, as an index into the field's directions: down, up, left, right. */
export const DIRS: [number, number][] = [[0, 1], [0, -1], [-1, 0], [1, 0]];
const CW = [2, 3, 1, 0];
const CCW = [3, 2, 0, 1];

export interface MoverDef {
  /** Lines run one per step, and "when EVENT: action" handlers that answer verbs. */
  rote: string;
  dir?: number;
  /** When every mover in a group stands on a plate, the group's flag is set. */
  group?: string;
  /** The group only counts it once it has been stopped on its plate. */
  needStop?: boolean;
  /** The way it falls on a fall line. Defaults to down. */
  fall?: number;
}

/** What a verb cast at a mover counts as, for its handlers. */
const EVENT_OF: Record<string, string> = {
  strike: 'struck', soak: 'wet', jolt: 'jolted', sear: 'burnt', mark: 'marked', listen: 'listened to',
  halt: 'halted', mend: 'mended', ward: 'warded', stamp: 'stamped', bite: 'struck', grind: 'struck',
};

/** The words a mover can run. Wait can write these into a mover in Act 2. */
export const MOVER_ACTIONS = ['step', 'turn', 'turn left', 'wait', 'roll', 'fall', 'grow', 'stop', 'copy'];

export interface MoverState { lines: string[]; handlers: Map<string, string>; pc: number; dir: number; stopped: boolean }

export function parseMover(def: MoverDef): MoverState {
  const lines: string[] = [];
  const handlers = new Map<string, string>();
  for (const raw of def.rote.split('\n')) {
    const l = raw.replace(/#.*/, '').trim();
    if (!l) continue;
    const m = l.match(/^when ([a-z ]+?):\s*(.+)$/);
    if (m) handlers.set(m[1], m[2]);
    else lines.push(l);
  }
  return { lines, handlers, pc: 0, dir: def.dir ?? 0, stopped: false };
}

/** The rote as it reads now, written lines included, for showing to the player. */
export function moverRote(def: MoverDef, st: MoverState): string {
  const asides = def.rote.split('\n').filter((l) => l.trim().startsWith('#'));
  const hs = [...st.handlers].map(([e, a]) => `when ${e}:\n  ${a}`);
  const facing = `# it faces ${['down', 'up', 'left', 'right'][st.dir]}.`;
  return [...asides, facing, ...st.lines, ...hs].join('\n');
}

/** Anything that holds a mover: the field's actor shape, loosely. */
export interface MActor {
  def: { id: string; mover?: MoverDef; sprite: string };
  x: number;
  y: number;
  gone: boolean;
  move: { fx: number; fy: number; t: number } | null;
  mv?: MoverState;
}

export interface MoverWorld {
  w: number;
  h: number;
  keys: string[][];
  actors: MActor[];
  /** Wait's tile. */
  px: number;
  py: number;
  solidAt(x: number, y: number, ignore?: MActor): boolean;
  /** Tiles changed. */
  retile(): void;
  /** A socket was filled, a bridge grown, a group solved: remembered across visits. */
  remember(key: string): void;
  spawnCopy(a: MActor, x: number, y: number): void;
}

const SOCKETS = new Set(['socket']);
const WATERS = new Set(['water', 'gap', 'void', 'stars']);

function free(w: MoverWorld, a: MActor, x: number, y: number): boolean {
  if (x === w.px && y === w.py) return false;
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return false;
  if (SOCKETS.has(w.keys[y][x])) return true;
  return !w.solidAt(x, y, a);
}

function slide(a: MActor, x: number, y: number) {
  a.move = { fx: a.x, fy: a.y, t: 0 };
  a.x = x;
  a.y = y;
}

/** A lump that lands in a socket fills it and is used up. */
function landed(w: MoverWorld, a: MActor) {
  if (!SOCKETS.has(w.keys[a.y][a.x])) return;
  w.keys[a.y][a.x] = 'filled';
  a.gone = true;
  w.remember(`fill_${a.x}_${a.y}`);
  w.remember(`used_${a.def.id}`);
  w.retile();
}

/** Performs one mover word. Returns a short note when something visible happened. */
export function act(w: MoverWorld, a: MActor, word: string, push?: number): string | null {
  const st = a.mv!;
  if (st.stopped && word !== 'stop') return null;
  const dir = push ?? st.dir;
  const [dx, dy] = DIRS[dir];
  switch (word) {
    case 'step':
      if (free(w, a, a.x + dx, a.y + dy)) { slide(a, a.x + dx, a.y + dy); landed(w, a); }
      return null;
    case 'turn': st.dir = CW[st.dir]; return null;
    case 'turn left': st.dir = CCW[st.dir]; return null;
    case 'wait': return null;
    case 'stop': st.stopped = true; return 'stops';
    case 'roll': {
      let x = a.x, y = a.y, n = 0;
      while (free(w, a, x + dx, y + dy) && n < 30) {
        x += dx; y += dy; n++;
        if (SOCKETS.has(w.keys[y][x])) break;
      }
      if (n) { st.dir = dir; slide(a, x, y); landed(w, a); return 'rolls'; }
      return null;
    }
    case 'fall': {
      const [fx, fy] = DIRS[a.def.mover?.fall ?? 0];
      if (free(w, a, a.x + fx, a.y + fy)) { slide(a, a.x + fx, a.y + fy); landed(w, a); }
      return null;
    }
    case 'grow': {
      let x = a.x + dx, y = a.y + dy, n = 0;
      while (x >= 0 && y >= 0 && x < w.w && y < w.h && WATERS.has(w.keys[y][x]) && n < 12) {
        w.keys[y][x] = 'bridge';
        w.remember(`grow_${x}_${y}`);
        x += dx; y += dy; n++;
      }
      if (n) { a.gone = true; w.remember(`used_${a.def.id}`); w.retile(); return 'grows across'; }
      return null;
    }
    case 'copy': {
      const x = a.x + dx, y = a.y + dy;
      if (free(w, a, x, y) && !SOCKETS.has(w.keys[y][x])) { w.spawnCopy(a, x, y); return 'copies itself'; }
      return null;
    }
    default: return null;
  }
}

/** Runs the next line of one mover's rote. */
export function stepOne(w: MoverWorld, a: MActor): string | null {
  if (a.gone || !a.mv || a.mv.stopped || !a.mv.lines.length) return null;
  const st = a.mv;
  const word = st.lines[st.pc % st.lines.length];
  st.pc = (st.pc + 1) % st.lines.length;
  return act(w, a, word);
}

/** Runs one line of every mover's rote. Called after each of Wait's steps. */
export function stepAll(w: MoverWorld) {
  for (const a of w.actors) stepOne(w, a);
}

/** Answers a verb cast at a mover. Lumps roll the way Wait faces. */
export function answer(w: MoverWorld, a: MActor, verb: string, waitDir: number): string | null {
  const ev = EVENT_OF[verb];
  const word = ev ? a.mv?.handlers.get(ev) : undefined;
  if (!word) return null;
  return act(w, a, word, word === 'roll' || word === 'step' ? waitDir : undefined);
}

/** Writes a line into the top of a mover's rote. Returns why not, or null when it took. */
export function writeInto(a: MActor, line: string): string | null {
  const word = line.trim();
  if (!MOVER_ACTIONS.includes(word)) return `it has no way to ${word.split(' ')[0]}`;
  a.mv!.lines.unshift(word);
  a.mv!.pc = 0;
  a.mv!.stopped = false;
  return null;
}

/** True when every mover in the group stands on a plate. */
export function groupDone(w: MoverWorld, group: string): boolean {
  const ms = w.actors.filter((a) => !a.gone && a.def.mover?.group === group);
  return ms.length > 0 && ms.every((a) => w.keys[a.y][a.x] === 'plate' && (!a.def.mover?.needStop || !!a.mv?.stopped));
}
