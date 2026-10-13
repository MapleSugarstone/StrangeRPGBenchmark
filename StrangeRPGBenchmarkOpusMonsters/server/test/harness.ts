// Drives the real Worker, lobby, and rooms with fake sockets, fake storage, and a clock the test owns. A room is plain
// TypeScript once `cloudflare:workers` points at test/stub-workers.ts, so the socket, the storage, the clock, and the
// random numbers are all there is to fake. A test is a millisecond where the real thing would take minutes, and every
// frame a room sends goes through the client's own reader (Notes/online-design.md).
import { readRoom, type FromRoom } from '../../src/net/protocol';
import type { Env } from '../worker/env';
import { Lobby } from '../worker/lobby';
import { Room } from '../worker/room';

/** Milliseconds the fake clock starts at. Fixed, so a failure reads the same twice. */
export const EPOCH = 1_800_000_000_000;

// ---------------------------------------------------------------- the clock, the random numbers, and the runtime's globals

let now = EPOCH;
const realNow = Date.now.bind(Date);
Date.now = () => now;

/** Runs `f` on the real clock, for a long run's own progress file, stop file, and time limit. */
export function onRealClock<T>(f: () => T): T {
  Date.now = realNow;
  try { return f(); } finally { Date.now = () => now; }
}
/** Moves the fake clock without running anything that comes due. */
export function setNow(t: number): void { now = t; }
export function nowIs(): number { return now; }

let seed = 1;
/** Pins every random number the rooms draw, so a test that depends on which seat plays side 0 gives the same answer each run. */
export function seedRandom(s: number): void { seed = s || 1; }
/** The generator's high bits, since its low bits repeat after a few draws. */
function next(): number { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed >>> 16; }
Object.defineProperty(crypto, 'getRandomValues', {
  configurable: true,
  value: <T extends ArrayBufferView | null>(a: T): T => {
    const bytes = new Uint8Array(a!.buffer, a!.byteOffset, a!.byteLength);
    for (let i = 0; i < bytes.length; i++) bytes[i] = next() & 0xff;
    return a;
  },
});
Object.defineProperty(crypto, 'randomUUID', {
  configurable: true,
  value: () => {
    const h = Array.from({ length: 32 }, () => (next() & 15).toString(16)).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  },
});

/** Every line the rooms logged, parsed, and every error they reported. */
export const logs: Record<string, unknown>[] = [];
export const faults: string[] = [];
console.log = (...a: unknown[]) => {
  try { logs.push(JSON.parse(String(a[0])) as Record<string, unknown>); } catch { logs.push({ text: a.map(String).join(' ') }); }
};
console.error = (...a: unknown[]) => { faults.push(a.map(x => (x instanceof Error ? x.stack ?? x.message : String(x))).join(' ')); };

/** The runtime's response, which takes a status of 101 and a socket. Node's own response refuses both. */
class FakeResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly webSocket: FakeSocket | null;
  constructor(readonly body: string | null = null, init: { status?: number; headers?: Record<string, string>; webSocket?: FakeSocket | null } = {}) {
    this.status = init.status ?? 200;
    this.headers = new Headers(init.headers ?? {});
    this.webSocket = init.webSocket ?? null;
  }
  static json(v: unknown, init: { status?: number; headers?: Record<string, string> } = {}): FakeResponse {
    return new FakeResponse(JSON.stringify(v), { ...init, headers: { ...(init.headers ?? {}), 'content-type': 'application/json' } });
  }
  async json(): Promise<unknown> { return JSON.parse(this.body ?? 'null'); }
  async text(): Promise<string> { return this.body ?? ''; }
}

const g = globalThis as Record<string, unknown>;
g.Response = FakeResponse;
g.WebSocketRequestResponsePair = class { constructor(readonly request: string, readonly response: string) {} };
g.WebSocketPair = class { 0: FakeSocket; 1: FakeSocket; constructor() { this[1] = new FakeSocket(); this[0] = this[1]; } };

// ---------------------------------------------------------------- sockets, storage, and the object's state

/** The room's end of one socket. The test reads what the room sent from `raw` and plays the client through the harness. */
export class FakeSocket {
  readyState = 1;
  closedWith: number | null = null;
  /** Every frame the room sent this socket, oldest first. */
  readonly raw: string[] = [];
  /** When the runtime last answered a ping on this socket by itself, or null. */
  pingAt: number | null = null;
  private attached: unknown = null;

  send(s: string): void {
    if (this.readyState !== 1) throw new Error('send on a socket that is not open');
    this.raw.push(s);
  }
  close(code = 1000): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.closedWith = code;
  }
  serializeAttachment(v: unknown): void {
    if (JSON.stringify(v ?? null).length > 16_384) throw new Error('an attachment over 16 KB');
    this.attached = structuredClone(v);
  }
  deserializeAttachment(): unknown { return structuredClone(this.attached); }
}

/** Storage that counts rows written the way the plan bills them: one a key put or deleted, and one an alarm set or deleted. */
export class FakeStorage {
  readonly data = new Map<string, unknown>();
  alarm: number | null = null;
  rowsWritten = 0;
  async get<T>(k: string): Promise<T | undefined> { return structuredClone(this.data.get(k)) as T | undefined; }
  async put(k: string | Record<string, unknown>, v?: unknown): Promise<void> {
    const entries = typeof k === 'string' ? [[k, v] as const] : Object.entries(k);
    for (const [key, value] of entries) { this.data.set(key, structuredClone(value)); this.rowsWritten++; }
  }
  async delete(k: string): Promise<boolean> { this.rowsWritten++; return this.data.delete(k); }
  async deleteAll(): Promise<void> { this.rowsWritten += this.data.size; this.data.clear(); }
  async getAlarm(): Promise<number | null> { return this.alarm; }
  async setAlarm(t: number): Promise<void> {
    if (!Number.isFinite(t)) throw new Error(`an alarm set to ${t}`);
    this.alarm = t;
    this.rowsWritten++;
  }
  async deleteAlarm(): Promise<void> { this.alarm = null; this.rowsWritten++; }
}

/** The object's state: its name, its storage, and the sockets it accepted for hibernation. */
export class FakeState {
  readonly id: { name: string; toString(): string };
  sockets: FakeSocket[] = [];
  constructor(name: string, readonly storage = new FakeStorage()) { this.id = { name, toString: () => name }; }
  acceptWebSocket(ws: FakeSocket): void { this.sockets.push(ws); }
  getWebSockets(): FakeSocket[] { return this.sockets.filter(s => s.readyState !== 3); }
  setWebSocketAutoResponse(): void {}
  getWebSocketAutoResponseTimestamp(ws: FakeSocket): Date | null { return ws.pingAt === null ? null : new Date(ws.pingAt); }
}

/** Sorts keys at every level, so two objects compare by content whatever order their keys came in. */
const canon = (v: unknown): string => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));

/** One client as the test plays it: the socket, and what the room told it, each frame read with the client's own reader. */
export class Client {
  constructor(readonly ws: FakeSocket, readonly h: RoomHarness) {}
  /** Every message so far as the client reads it. A frame the reader refuses or trims is a fault in the room. */
  get got(): FromRoom[] {
    return this.ws.raw.map(raw => {
      const m = readRoom(raw);
      if (!m) this.h.badFrames.push(`refused by the reader: ${raw.slice(0, 160)}`);
      else if (canon(m) !== canon(JSON.parse(raw))) this.h.badFrames.push(`fields the reader drops: ${raw.slice(0, 160)}`);
      return m ?? ({ type: 'pong' } as FromRoom);
    });
  }
  all<K extends FromRoom['type']>(type: K): Extract<FromRoom, { type: K }>[] { return this.got.filter((m): m is Extract<FromRoom, { type: K }> => m.type === type); }
  last<K extends FromRoom['type']>(type: K): Extract<FromRoom, { type: K }> | undefined { const a = this.all(type); return a[a.length - 1]; }
  forget(): void { this.ws.raw.length = 0; }
  get open(): boolean { return this.ws.readyState === 1; }
}

/** A lobby stub that records what the rooms ask of it. */
export class LobbyCalls {
  readonly cancels: (string | null)[] = [];
  async cancel(room: string | null): Promise<void> { this.cancels.push(room); }
}

/** A real room over fake sockets, storage, and time. */
export class RoomHarness {
  readonly state: FakeState;
  readonly lobby = new LobbyCalls();
  readonly env: Env;
  room: Room;
  /** Frames the room sent that the client's reader refused or trimmed. Each one is a fault. */
  readonly badFrames: string[] = [];

  constructor(readonly name = `pub-${crypto.randomUUID()}`) {
    this.state = new FakeState(name);
    const lobby = this.lobby;
    this.env = { LOBBY: { idFromName: () => 'lobby', get: () => lobby }, ROOM: {} } as unknown as Env;
    this.room = new Room(this.state as never, this.env);
  }

  get storage(): FakeStorage { return this.state.storage; }

  /** Opens a socket the way the Worker hands an upgrade to the room. Null when the room turns the socket away. */
  async open(): Promise<Client | null> {
    const res = (await this.room.fetch(new Request(`http://room/api/room/${this.name}`, { headers: { Upgrade: 'websocket' } }))) as unknown as FakeResponse;
    return res.status === 101 && res.webSocket ? new Client(res.webSocket, this) : null;
  }

  /** A client's frame: text the way a socket carries it, or binary as it arrives. */
  async say(c: Client, m: unknown): Promise<void> {
    if (!c.open) return;
    await this.room.webSocketMessage(c.ws as unknown as WebSocket, typeof m === 'string' || m instanceof ArrayBuffer ? m : JSON.stringify(m));
  }

  /** The runtime answers a ping itself, which marks the socket's last answer and never wakes the room. */
  ping(c: Client): void { if (c.open) { c.ws.pingAt = now; c.ws.raw.push('{"type":"pong"}'); } }

  /** A connection that died with nothing said, or one that closed with a code. */
  async drop(c: Client, code = 1006): Promise<void> {
    if (!c.open) return;
    c.ws.readyState = 3;
    await this.room.webSocketClose(c.ws as unknown as WebSocket, code, '', code !== 1006);
  }

  /** Moves the clock and runs each alarm that comes due on the way, one at a time as the runtime does. */
  async advance(ms: number): Promise<void> {
    const target = now + ms;
    for (let guard = 0; ; guard++) {
      if (guard >= 600) throw new Error('the alarm kept coming due: a clock is re-arming in the past');
      const due = this.storage.alarm;
      if (due === null || due > target) break;
      now = Math.max(now, due);
      this.storage.alarm = null;
      await this.room.alarm();
    }
    now = target;
  }

  /** The runtime evicts an idle room: the object goes, and its storage and its hibernating sockets stay. */
  evict(): void { this.room = new Room(this.state as never, this.env); }

  /** A deploy: every socket drops with no close event, and a new object starts over the same storage. */
  restart(): void {
    for (const s of this.state.sockets) s.readyState = 3;
    this.state.sockets = [];
    this.room = new Room(this.state as never, this.env);
  }

  /** The room's state as stored, for checks no message carries. */
  async stored(): Promise<import('../../src/net/room').RoomData | undefined> { return this.storage.get('room'); }
}

/** A real lobby over fake storage. */
export function lobbyHarness(env: Partial<Env> = {}): { lobby: Lobby; storage: FakeStorage } {
  const state = new FakeState('lobby');
  return { lobby: new Lobby(state as never, env as Env), storage: state.storage };
}
