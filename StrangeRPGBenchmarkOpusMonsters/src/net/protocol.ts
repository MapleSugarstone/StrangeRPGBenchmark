// The messages between a client and a Byssus room, the link a client reads them through, the numbers the room keeps, and
// the readers that check every message both ways. A reader takes the raw frame, refuses anything of the wrong shape, and
// builds a fresh message from the fields it checked, so nothing else a sender put in a frame travels on. Nothing here
// imports game code, so the Worker shares this file with the game (Notes/online-design.md).

/** Raise this with any change to the messages or the record. */
export const PROTOCOL = 4;
/** Whorls a player queues with, and whorls each side picks from them to fight. */
export const ROSTER_SIZE = 6, TEAM_SIZE = 4;
/** What a queue pairs by besides the build: the roster size, the team size, and the level. */
export const FORMAT = `${ROSTER_SIZE}v${TEAM_SIZE}@25`;
/** Seconds each player has to pick four from the six and set their order once a match is found. */
export const PICK_SECONDS = 90;
/** Seconds a side has for a choice and for a replacement. */
export const CHOICE_SECONDS = 60, REPLACE_SECONDS = 30;
/** Hidden seconds every deadline adds for network delay. */
export const NETWORK_GRACE_SECONDS = 3;
/** Timeouts in a row that lose the match. */
export const TIMEOUTS_TO_LOSE = 3;
/** Seconds the room waits for a report before it starts a side's clock anyway. */
export const REPORT_WAIT_SECONDS = 30;
/** Seconds the room holds the seat of a player whose connection dropped before the other side wins. */
export const HOLD_SECONDS = 90;
/** The longest player name and whorl name, and the most bytes a roster may take as JSON. */
export const PLAYER_NAME_MAX = 8, WHORL_NAME_MAX = 12, ROSTER_BYTES_MAX = 6000;
/** The longest frame a client may send, and the longest the room sends, which can carry a whole record. Both are checked before parsing. */
export const FRAME_MAX = 16_384, ROOM_FRAME_MAX = 524_288;
/** How deep a frame may nest arrays and objects. A rejoin's rosters reach 6. */
export const DEPTH_MAX = 8;
/** The most decisions a record may hold, the highest summon or drop uid an action may name, and the longest reason a message carries. */
export const DECISIONS_MAX = 2000, UID_MAX = 1_000_000, REASON_MAX = 300;
/** The stats nacre may sit in. */
export const TAN_KEYS = ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'] as const;

/**
 * What a decision asks for as both clients describe it to the room (`sees` names the side that foresees the other's choice).
 * A visit asks the side whose whorl went back in time which of its moves it casts there.
 */
export type Need =
  | { kind: 'joint'; sees: 0 | 1 | null }
  | { kind: 'act'; side: 0 | 1 }
  | { kind: 'replace'; side: 0 | 1 }
  | { kind: 'replace2' }
  | { kind: 'visit'; side: 0 | 1 }
  | { kind: 'over'; winner: 0 | 1 | null; stalled: boolean };

/** An action as it travels. The battle's own `Action` fits this shape. */
export interface WireAction { k: string; i?: number; target?: number; tagTo?: number; aim?: number; opt?: number; to?: number; peg?: string }

/** A side's choice: an action for a round or a turn, a whorl's index for a replacement, or null for a side that does not choose. */
export type Choice = WireAction | number | null;

/** One decision as the room released it: its number, what it asked, each side's choice, and which sides ran out of time. */
export interface Release { n: number; need: Need; c: [Choice, Choice]; timeout: [boolean, boolean] }

/** Both sides' picks as the room released them together: each a list of roster indexes with the lead first, and which sides ran out of time. */
export interface PickRelease { picks: [number[] | null, number[] | null]; timeout: [boolean, boolean] }

/** A fit as it travels: its two kinds and every choice the Conjoiner made. */
export interface WireFit {
  kinds: [string, string];
  moves: string[];
  passives: string[];
  types: string[];
  basic: 'P' | 'M';
  retune: { move: string; type: string } | null;
  look: { shape: number; palette: number };
}

/** One whorl as it travels: a kind by id or a fit and what the player gave it. An empty name is one the room refused. */
export interface WireMon {
  kind?: string;
  fit?: WireFit;
  name: string;
  notion: string | null;
  tan?: Partial<Record<string, number>>;
  tape?: string;
  starborn?: boolean;
}

/** The seconds each clock allows as the room sends them with a match. */
export interface ClockSpec { pick: number; choice: number; replace: number }

/** Why a match ended: a finished battle, a resignation, three timeouts in a row, a seat that left, or no result. */
export type EndWhy = 'over' | 'resign' | 'timeouts' | 'gone' | 'void';
const END_WHYS: readonly string[] = ['over', 'resign', 'timeouts', 'gone', 'void'];

/** What a client sends to queue: its build and the format, so only matching clients meet. */
export interface QueueRequest { build: string; format: string }

/** The lobby's answer: the room to open a socket to, and a private room's code, or why it could not. */
export type QueueReply = { ok: true; room: string; code?: string } | { ok: false; reason: string };

/** A hello that asks for a seat with a name and a roster, or one that proves a held seat with its token. */
export type Hello = { type: 'hello'; build: string; name: string; roster: WireMon[] } | { type: 'hello'; build: string; resume: string };

export type ToRoom =
  | Hello
  | { type: 'pick'; order: number[] }
  | { type: 'ready'; n: number; hash: string; need: Need }
  | { type: 'choose'; n: number; c: Choice }
  | { type: 'resign' }
  | { type: 'foul'; n: number; why: string }
  | { type: 'ping' };

/** The start of a match: this client's side, both names and rosters, a seed for the scene, and the time limits. */
export interface MatchMsg { type: 'match'; side: 0 | 1; token: string; names: [string, string]; rosters: [WireMon[], WireMon[]]; seed: number; clock: ClockSpec }

/** The other side's choice in a round this side foresees, or `timeout` true and `c` null when the other side ran out of time. */
export interface PeekMsg { type: 'peek'; n: number; c: Choice; timeout: boolean }

export interface EndMsg { type: 'end'; why: EndWhy; winner: 0 | 1 | null }

/**
 * A returning seat's whole match: the match itself, the released picks or null while the pick runs, every release so far,
 * and the decision in hand. `pickLeft` and `pick` are the pick clock's seconds and this side's last pick while the pick runs.
 * `chose` says whether the room holds this side's choice, `left` gives each side's seconds on a running clock, and `peek`
 * is the other side's choice in a round this side foresees once the room has shown it.
 */
export interface RejoinMsg {
  type: 'rejoin'; side: 0 | 1; names: [string, string]; rosters: [WireMon[], WireMon[]]; seed: number; clock: ClockSpec;
  picked: PickRelease | null; record: Release[]; pickLeft: number; pick: number[] | null;
  chose: boolean; left: [number | null, number | null]; peek: PeekMsg | null;
}

export type FromRoom =
  | { type: 'waiting'; code?: string }
  | MatchMsg
  | RejoinMsg
  | { type: 'picked'; picks: [number[] | null, number[] | null]; timeout: [boolean, boolean] }
  | { type: 'clock'; n: number; side: 0 | 1; left: number }
  | PeekMsg
  | { type: 'release'; n: number; need: Need; c: [Choice, Choice]; timeout: [boolean, boolean] }
  | { type: 'away'; side: 0 | 1; left: number }
  | { type: 'back'; side: 0 | 1 }
  | EndMsg
  | { type: 'refused'; reason: string }
  | { type: 'resumeFailed'; reason: string }
  | { type: 'pong' };

/** A client's connection to its room. Messages go out through `send` and come back in order through `poll`. */
export interface Link {
  send(m: ToRoom): void;
  /** The oldest message from the room that has not been read, or null. */
  poll(): FromRoom | null;
  /** Runs once a frame from whichever screen holds the match. */
  tick(): void;
  close(): void;
  /** Seconds left in the room's hold while the link is down and trying to come back, or 0 while it holds. */
  slack?(): number;
}

/** Whether two descriptions name the same decision. */
export function sameNeed(x: Need, y: Need | null | undefined): boolean {
  if (!y || x.kind !== y.kind) return false;
  if (x.kind === 'joint') return x.sees === (y as typeof x).sees;
  if (x.kind === 'act' || x.kind === 'replace' || x.kind === 'visit') return x.side === (y as typeof x).side;
  if (x.kind === 'over') return x.winner === (y as typeof x).winner && x.stalled === (y as typeof x).stalled;
  return true;
}

/** Whether a decision waits on `side`'s choice. */
export function chooses(need: Need, side: 0 | 1): boolean {
  if (need.kind === 'joint' || need.kind === 'replace2') return true;
  return (need.kind === 'act' || need.kind === 'replace' || need.kind === 'visit') && need.side === side;
}

/** The characters a name may use: the name screen's letter grid. */
export const NAME_CHARS = /^[A-Za-z0-9 .'\-!?&~()+=*/#%]+$/;

/** Whether a player name has a shape the room takes: a letter or a number, at most `PLAYER_NAME_MAX` long, from the letter grid. */
export function nameShapeOk(name: unknown): name is string {
  return readName(name, PLAYER_NAME_MAX, false) !== NO;
}

/** Whether a pick has the shape the room takes: four different whole numbers that name members of a roster of six. */
export function pickShapeOk(p: unknown): p is number[] {
  return readPick(p) !== NO;
}

/** A reason in the shape a foul message takes: printable text cut to `REASON_MAX`. */
export function reasonText(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, '?').slice(0, REASON_MAX);
}

// ---------------------------------------------------------------- readers

type Obj = Record<string, unknown>;
/** What a reader returns for a value it refuses. Null is a value some fields take. */
const NO = undefined;
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const whole = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isSide = (v: unknown): v is 0 | 1 => v === 0 || v === 1;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_]{1,32}$/.test(v);
/** Type ids are the one id in capitals. */
const isType = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{1,12}$/.test(v);
const isBuild = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(v);
const isToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9-]{4,64}$/.test(v);
const isCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z0-9]{6}$/.test(v);
const isHash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}$/.test(v);

/** A plain object from JSON with no key outside `allowed` and every key in `need`. */
function obj(v: unknown, allowed: readonly string[], need: readonly string[] = allowed): Obj | null {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) return null;
  const o = v as Obj;
  for (const k of Object.keys(o)) if (!allowed.includes(k)) return null;
  for (const k of need) if (!own(o, k)) return null;
  return o;
}

/** A list of `lo` to `hi` items that each pass `item`. */
function arr<T>(v: unknown, lo: number, hi: number, item: (x: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(v) || v.length < lo || v.length > hi) return NO;
  const out: T[] = [];
  for (const x of v) {
    const r = item(x);
    if (r === NO) return NO;
    out.push(r);
  }
  return out;
}

/** Printable text of at most `max` characters. */
function text(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.length <= max && /^[\x20-\x7e]*$/.test(v) ? v : NO;
}

/** A name from the letter grid of at most `max` characters, or an empty name where the room refused one. */
function readName(v: unknown, max: number, blankOk: boolean): string | undefined {
  if (typeof v !== 'string') return NO;
  if (v === '') return blankOk ? v : NO;
  return v.length <= max && !!v.trim() && NAME_CHARS.test(v) ? v : NO;
}

/** Whether a frame nests arrays and objects no deeper than `max`, read without parsing it. */
function depthOk(raw: string, max: number): boolean {
  let depth = 0, inString = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (inString) {
      if (c === 92) i++;
      else if (c === 34) inString = false;
    } else if (c === 34) inString = true;
    else if (c === 91 || c === 123) { if (++depth > max) return false; }
    else if (c === 93 || c === 125) depth--;
  }
  return true;
}

/** A frame as an object with a type, or the reason it is not one. The length and the nesting are checked before parsing. */
function frame(raw: unknown, max: number): Obj | string {
  if (typeof raw !== 'string') return 'it is not text';
  if (raw.length > max) return 'it is too long';
  if (!depthOk(raw, DEPTH_MAX)) return 'it nests too deep';
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return 'it is not JSON'; }
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof (v as Obj).type !== 'string') return 'it has no type';
  return v as Obj;
}

/** The fields each kind of action may carry and the ones it must. */
const ACTIONS = new Map<string, { may: readonly string[]; must: readonly string[] }>([
  ['attack', { may: ['aim'], must: [] }],
  ['move', { may: ['i', 'target', 'tagTo', 'aim', 'opt'], must: ['i'] }],
  ['guard', { may: [], must: [] }],
  ['switch', { may: ['to'], must: ['to'] }],
  ['notion', { may: [], must: [] }],
  ['take', { may: ['i'], must: ['i'] }],
  ['wait', { may: [], must: [] }],
]);
/** The highest value each action field takes: a slot or a whorl's index, a summon's uid, or an option. */
const ACTION_MAX = new Map<string, number>([['i', 15], ['target', 15], ['tagTo', 15], ['aim', UID_MAX], ['opt', 31], ['to', 15]]);

/** An action any online battle can hold, rebuilt from its checked fields. */
export function readAction(v: unknown): WireAction | undefined {
  const k = v && typeof v === 'object' ? (v as Obj).k : NO, spec = typeof k === 'string' ? ACTIONS.get(k) : NO;
  if (!spec) return NO;
  const o = obj(v, ['k', ...spec.may], ['k', ...spec.must]);
  if (!o) return NO;
  const a: Record<string, unknown> = { k };
  for (const f of spec.may) {
    if (!own(o, f)) continue;
    // A drop's uid rides in `i` when the action takes a drop.
    if (!whole(o[f], 0, k === 'take' ? UID_MAX : ACTION_MAX.get(f)!)) return NO;
    a[f] = o[f];
  }
  return a as unknown as WireAction;
}

/** A choice: null, a whorl's index for a replacement, or an action. */
export function readChoice(v: unknown): Choice | undefined {
  if (v === null) return null;
  if (typeof v === 'number') return whole(v, 0, 15) ? v : NO;
  return readAction(v);
}

/** A decision's description. */
export function readNeed(v: unknown): Need | undefined {
  const kind = v && typeof v === 'object' ? (v as Obj).kind : NO;
  if (kind === 'joint') {
    const o = obj(v, ['kind', 'sees']);
    return o && (o.sees === null || isSide(o.sees)) ? { kind: 'joint', sees: o.sees } : NO;
  }
  if (kind === 'act' || kind === 'replace' || kind === 'visit') {
    const o = obj(v, ['kind', 'side']);
    return o && isSide(o.side) ? { kind, side: o.side } : NO;
  }
  if (kind === 'replace2') return obj(v, ['kind']) ? { kind: 'replace2' } : NO;
  if (kind === 'over') {
    const o = obj(v, ['kind', 'winner', 'stalled']);
    return o && (o.winner === null || isSide(o.winner)) && typeof o.stalled === 'boolean' ? { kind: 'over', winner: o.winner, stalled: o.stalled } : NO;
  }
  return NO;
}

/** A pick: four different members of a roster of six, lead first. */
export function readPick(v: unknown): number[] | undefined {
  const p = arr(v, TEAM_SIZE, TEAM_SIZE, x => (whole(x, 0, ROSTER_SIZE - 1) ? x : NO));
  return p && new Set(p).size === TEAM_SIZE ? p : NO;
}

function readFit(v: unknown): WireFit | undefined {
  const o = obj(v, ['kinds', 'moves', 'passives', 'types', 'basic', 'retune', 'look']);
  if (!o || (o.basic !== 'P' && o.basic !== 'M')) return NO;
  const id = (x: unknown) => (isId(x) ? x : NO);
  const kinds = arr(o.kinds, 2, 2, id), moves = arr(o.moves, 1, 8, id), passives = arr(o.passives, 0, 4, id), types = arr(o.types, 1, 2, x => (isType(x) ? x : NO));
  if (!kinds || !moves || !passives || !types) return NO;
  let retune: WireFit['retune'] = null;
  if (o.retune !== null) {
    const r = obj(o.retune, ['move', 'type']);
    if (!r || !isId(r.move) || !isType(r.type)) return NO;
    retune = { move: r.move, type: r.type };
  }
  const look = obj(o.look, ['shape', 'palette']);
  if (!look || !whole(look.shape, 0, 255) || !whole(look.palette, 0, 255)) return NO;
  return { kinds: [kinds[0], kinds[1]], moves, passives, types, basic: o.basic, retune, look: { shape: look.shape, palette: look.palette } };
}

/** One whorl's shape. The other client checks it against the game's rules with `teamProblems`. */
export function readWhorl(v: unknown, blankOk = false): WireMon | undefined {
  const o = obj(v, ['kind', 'fit', 'name', 'notion', 'tan', 'tape', 'starborn'], ['name', 'notion']);
  if (!o || own(o, 'kind') === own(o, 'fit')) return NO;
  const name = readName(o.name, WHORL_NAME_MAX, blankOk);
  if (name === NO || (o.notion !== null && !isId(o.notion))) return NO;
  const notion = o.notion as string | null;
  let w: WireMon;
  if (own(o, 'kind')) {
    if (!isId(o.kind)) return NO;
    w = { kind: o.kind, name, notion };
  } else {
    const fit = readFit(o.fit);
    if (!fit) return NO;
    w = { fit, name, notion };
  }
  if (own(o, 'tan')) {
    const t = obj(o.tan, TAN_KEYS, []);
    if (!t) return NO;
    const tan: Record<string, number> = {};
    for (const k of TAN_KEYS) if (own(t, k)) { if (!whole(t[k], 0, 99)) return NO; tan[k] = t[k] as number; }
    w.tan = tan;
  }
  if (own(o, 'tape')) {
    if (typeof o.tape !== 'string' || !/^[pags]{4}$/.test(o.tape)) return NO;
    w.tape = o.tape;
  }
  if (own(o, 'starborn')) {
    if (typeof o.starborn !== 'boolean') return NO;
    if (o.starborn) w.starborn = true;
  }
  return w;
}

/** A roster of six whorls in at most `ROSTER_BYTES_MAX` bytes of JSON. */
export function readRoster(v: unknown, blankOk = false): WireMon[] | undefined {
  const r = arr(v, ROSTER_SIZE, ROSTER_SIZE, x => readWhorl(x, blankOk));
  return r && JSON.stringify(r).length <= ROSTER_BYTES_MAX ? r : NO;
}

/** Every message a room takes, rebuilt from its checked fields, or why the frame was refused. */
export function readClient(raw: unknown): { m: ToRoom } | { why: string } {
  const o = frame(raw, FRAME_MAX);
  if (typeof o === 'string') return { why: o };
  const m = clientMessage(o);
  return m ? { m } : { why: `a message of type ${JSON.stringify(String(o.type).slice(0, 16))} has the wrong shape` };
}

function clientMessage(o: Obj): ToRoom | undefined {
  switch (o.type) {
    case 'hello': {
      if (own(o, 'resume')) {
        const h = obj(o, ['type', 'build', 'resume']);
        return h && isBuild(h.build) && isToken(h.resume) ? { type: 'hello', build: h.build, resume: h.resume } : NO;
      }
      const h = obj(o, ['type', 'build', 'name', 'roster']);
      if (!h || !isBuild(h.build)) return NO;
      const name = readName(h.name, PLAYER_NAME_MAX, false), roster = readRoster(h.roster);
      return name !== NO && roster ? { type: 'hello', build: h.build, name, roster } : NO;
    }
    case 'pick': {
      const p = obj(o, ['type', 'order']), order = p ? readPick(p.order) : NO;
      return order ? { type: 'pick', order } : NO;
    }
    case 'ready': {
      const r = obj(o, ['type', 'n', 'hash', 'need']);
      if (!r || !whole(r.n, 0, DECISIONS_MAX) || !isHash(r.hash)) return NO;
      const need = readNeed(r.need);
      return need ? { type: 'ready', n: r.n, hash: r.hash, need } : NO;
    }
    case 'choose': {
      const c = obj(o, ['type', 'n', 'c']);
      if (!c || !whole(c.n, 0, DECISIONS_MAX)) return NO;
      const choice = readChoice(c.c);
      return choice === NO ? NO : { type: 'choose', n: c.n, c: choice };
    }
    case 'resign': return obj(o, ['type']) ? { type: 'resign' } : NO;
    case 'foul': {
      const f = obj(o, ['type', 'n', 'why']), why = f ? text(f.why, REASON_MAX) : NO;
      return f && whole(f.n, -1, DECISIONS_MAX) && why !== NO ? { type: 'foul', n: f.n, why } : NO;
    }
    case 'ping': return obj(o, ['type']) ? { type: 'ping' } : NO;
  }
  return NO;
}

function readPickRelease(v: unknown): PickRelease | undefined {
  const o = obj(v, ['picks', 'timeout']);
  const picks = o ? arr(o.picks, 2, 2, x => (x === null ? null : readPick(x))) : NO;
  const timeout = o ? arr(o.timeout, 2, 2, x => (typeof x === 'boolean' ? x : NO)) : NO;
  return picks && timeout ? { picks: [picks[0], picks[1]], timeout: [timeout[0], timeout[1]] } : NO;
}

function readRelease(v: unknown): Release | undefined {
  const o = obj(v, ['n', 'need', 'c', 'timeout']);
  if (!o || !whole(o.n, 0, DECISIONS_MAX)) return NO;
  const need = readNeed(o.need), c = arr(o.c, 2, 2, readChoice), timeout = arr(o.timeout, 2, 2, x => (typeof x === 'boolean' ? x : NO));
  return need && c && timeout ? { n: o.n, need, c: [c[0], c[1]], timeout: [timeout[0], timeout[1]] } : NO;
}

function readPeek(v: unknown): PeekMsg | undefined {
  const o = obj(v, ['type', 'n', 'c', 'timeout']);
  if (!o || o.type !== 'peek' || !whole(o.n, 0, DECISIONS_MAX) || typeof o.timeout !== 'boolean') return NO;
  const c = readChoice(o.c);
  return c === NO ? NO : { type: 'peek', n: o.n, c, timeout: o.timeout };
}

/** The parts a match and a rejoin share: both names and rosters, the seed, and the clock. */
function readMatchParts(o: Obj): Pick<MatchMsg, 'side' | 'names' | 'rosters' | 'seed' | 'clock'> | undefined {
  const names = arr(o.names, 2, 2, x => readName(x, PLAYER_NAME_MAX, false)), rosters = arr(o.rosters, 2, 2, x => readRoster(x, true));
  const clock = obj(o.clock, ['pick', 'choice', 'replace']);
  if (!isSide(o.side) || !names || !rosters || !whole(o.seed, 0, 0x7fffffff) || !clock) return NO;
  if (!whole(clock.pick, 1, 600) || !whole(clock.choice, 1, 600) || !whole(clock.replace, 1, 600)) return NO;
  return { side: o.side, names: [names[0], names[1]], rosters: [rosters[0], rosters[1]], seed: o.seed, clock: { pick: clock.pick, choice: clock.choice, replace: clock.replace } };
}

/** A lobby's answer to a queue request, rebuilt from its checked fields, or null for any other shape. */
export function readQueueReply(v: unknown): QueueReply | null {
  const ok = v && typeof v === 'object' ? (v as Obj).ok : NO;
  if (ok === true) {
    const o = obj(v, ['ok', 'room', 'code'], ['ok', 'room']);
    if (!o || typeof o.room !== 'string' || !/^[A-Za-z0-9_-]{0,64}$/.test(o.room) || (own(o, 'code') && !isCode(o.code))) return null;
    return own(o, 'code') ? { ok: true, room: o.room, code: o.code as string } : { ok: true, room: o.room };
  }
  const o = ok === false ? obj(v, ['ok', 'reason']) : null, reason = o ? text(o.reason, REASON_MAX) : NO;
  return reason === NO ? null : { ok: false, reason };
}

/** Every message a client takes from its room, rebuilt from its checked fields, or null for a frame of any other shape. */
export function readRoom(raw: unknown): FromRoom | null {
  const o = frame(raw, ROOM_FRAME_MAX);
  return typeof o === 'string' ? null : roomMessage(o) ?? null;
}

function roomMessage(o: Obj): FromRoom | undefined {
  const side = (x: unknown) => (isSide(x) ? x : NO);
  switch (o.type) {
    case 'waiting': {
      const w = obj(o, ['type', 'code'], ['type']);
      if (!w) return NO;
      if (!own(w, 'code')) return { type: 'waiting' };
      return isCode(w.code) ? { type: 'waiting', code: w.code } : NO;
    }
    case 'match': {
      const m = obj(o, ['type', 'side', 'token', 'names', 'rosters', 'seed', 'clock']), parts = m && readMatchParts(m);
      return parts && isToken(m.token) ? { type: 'match', ...parts, token: m.token } : NO;
    }
    case 'rejoin': {
      const r = obj(o, ['type', 'side', 'names', 'rosters', 'seed', 'clock', 'picked', 'record', 'pickLeft', 'pick', 'chose', 'left', 'peek']);
      const parts = r && readMatchParts(r);
      if (!r || !parts || !whole(r.pickLeft, 0, PICK_SECONDS + NETWORK_GRACE_SECONDS) || typeof r.chose !== 'boolean') return NO;
      const picked = r.picked === null ? null : readPickRelease(r.picked), record = arr(r.record, 0, DECISIONS_MAX, readRelease);
      const pick = r.pick === null ? null : readPick(r.pick), peek = r.peek === null ? null : readPeek(r.peek);
      const left = arr(r.left, 2, 2, x => (x === null || whole(x, 0, 600) ? (x as number | null) : NO));
      if (picked === NO || !record || pick === NO || peek === NO || !left) return NO;
      return { type: 'rejoin', ...parts, picked, record, pickLeft: r.pickLeft, pick, chose: r.chose, left: [left[0], left[1]], peek };
    }
    case 'picked': {
      const p = obj(o, ['type', 'picks', 'timeout']), rel = p ? readPickRelease({ picks: p.picks, timeout: p.timeout }) : NO;
      return rel ? { type: 'picked', ...rel } : NO;
    }
    case 'clock': {
      const c = obj(o, ['type', 'n', 'side', 'left']);
      return c && whole(c.n, 0, DECISIONS_MAX) && isSide(c.side) && whole(c.left, 0, 600) ? { type: 'clock', n: c.n, side: c.side, left: c.left } : NO;
    }
    case 'peek': return readPeek(o);
    case 'release': {
      const r = obj(o, ['type', 'n', 'need', 'c', 'timeout']), rel = r ? readRelease({ n: r.n, need: r.need, c: r.c, timeout: r.timeout }) : NO;
      return rel ? { type: 'release', ...rel } : NO;
    }
    case 'away': {
      const a = obj(o, ['type', 'side', 'left']);
      return a && side(a.side) !== NO && whole(a.left, 0, HOLD_SECONDS) ? { type: 'away', side: a.side as 0 | 1, left: a.left } : NO;
    }
    case 'back': {
      const b = obj(o, ['type', 'side']);
      return b && side(b.side) !== NO ? { type: 'back', side: b.side as 0 | 1 } : NO;
    }
    case 'end': {
      const e = obj(o, ['type', 'why', 'winner']);
      return e && typeof e.why === 'string' && END_WHYS.includes(e.why) && (e.winner === null || isSide(e.winner)) ? { type: 'end', why: e.why as EndWhy, winner: e.winner } : NO;
    }
    case 'refused': case 'resumeFailed': {
      const r = obj(o, ['type', 'reason']), reason = r ? text(r.reason, REASON_MAX) : NO;
      return reason === NO ? NO : { type: o.type, reason };
    }
    case 'pong': return obj(o, ['type']) ? { type: 'pong' } : NO;
  }
  return NO;
}
