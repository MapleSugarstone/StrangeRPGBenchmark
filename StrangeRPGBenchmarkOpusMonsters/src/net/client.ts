// The client end of a Byssus room over the network: the queue requests, the socket, the pings, the watchdog, and the
// reconnect that takes a dropped seat back. It serves the pick screen and the battle through the same `Link` the loopback
// room does, and every message from the room goes through `readRoom` first (Notes/online-design.md).
import { BUILD } from './lockstep';
import { FORMAT, HOLD_SECONDS, PLAYER_NAME_MAX, readQueueReply, readRoom, type FromRoom, type Link, type QueueReply, type ToRoom } from './protocol';

declare const __BYSSUS_URL__: string;

/** How often the client pings, how long the room may say nothing before the link counts as lost, and how often that is checked. */
const PING_MS = 10_000, SILENCE_MS = 25_000, WATCH_MS = 2_500;
/** A check this late means the machine slept, and the silence it finds says nothing about the room. */
const SLEEP_SLACK_MS = 5_000;
/** How long the room holds a dropped seat, which is as long as this client tries to come back. */
const HOLD_MS = HOLD_SECONDS * 1000;
/** The first wait before another try at a dropped link, the longest wait between tries, and how long an open try may go unanswered. */
const RETRY_FIRST_MS = 1_200, RETRY_MAX_MS = 5_000, ANSWER_MS = 10_000;
/** How often the held seat's record is brought up to date while the room keeps talking. */
const KEEP_MS = 5_000;
/** Where a held seat waits in sessionStorage, so a page reloaded during a match can come back to it. */
const SEAT_KEY = 'byssus-seat';
/** The close code the room sends a socket when another socket took its seat with the same token. */
const CLOSE_REPLACED = 4000;

/** Where the rooms are: the local server on port 8787 while the game runs from this machine, and the deployed Worker otherwise. */
export function byssusBase(): string {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return `http://${host}:8787`;
  return typeof __BYSSUS_URL__ === 'string' ? __BYSSUS_URL__ : '';
}

/** Whether this copy of the game has rooms to reach. */
export function byssusReachable(): boolean { return !!byssusBase(); }

/** Raised by every exit from online play, so a reply or a socket event from before the exit is dropped. */
let generation = 0;

/** Ends whatever online exchange is under way. A queue reply that arrives later is dropped, and a link opened before now stops. */
export function leaveByssus(): void { generation++; }

/** What a queue request answers when the player left before the lobby replied. */
export const CANCELED = 'The wait was canceled.';

export type QueueKind = 'public' | 'host' | 'join';

/** Asks the lobby for a room: any waiting player, a new private room with a code, or the room a code names. */
export async function queue(kind: QueueKind, code?: string): Promise<QueueReply> {
  const gen = generation;
  const reply = await post(kind, { build: BUILD, format: FORMAT, ...(code ? { code } : {}) });
  if (gen === generation) return reply;
  // The player left while the lobby answered. A guest's code belongs to its host, so only a place this client opened goes back.
  if (reply.ok && kind !== 'join') void cancelQueue(reply.room, reply.code);
  return { ok: false, reason: CANCELED };
}

/** Keeps a waiting place in the public queue. */
export function renewQueue(room: string): Promise<QueueReply> { return post('renew', { room }); }

/** Takes a waiting place out of the queue and drops a private code. Only the player who opened the place sends this. */
export function cancelQueue(room: string, code?: string): Promise<QueueReply> { return post('cancel', { room, ...(code ? { code } : {}) }); }

async function post(path: string, body: object): Promise<QueueReply> {
  try {
    const res = await fetch(`${byssusBase()}/api/queue/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return readQueueReply(await res.json()) ?? { ok: false, reason: 'The lobby sent an answer this version cannot read.' };
  } catch {
    return { ok: false, reason: 'The rooms could not be reached.' };
  }
}

/**
 * A seat this tab holds in a match: the room, the token that proves the seat, the build that took it, the save slot, and when the
 * room last spoke. `side` and `foe` (the other player's name) let a rejoin that finds the match already over say who won.
 */
export interface HeldSeat { room: string; token: string; build: string; slot: number; heard: number; side?: 0 | 1; foe?: string }

/** The seat this tab holds while the room may still be holding it, or null. */
export function heldSeat(now = Date.now()): HeldSeat | null {
  try {
    const raw = sessionStorage.getItem(SEAT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<HeldSeat> | null;
    const ok = !!v && typeof v.room === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v.room) && typeof v.token === 'string' && /^[A-Za-z0-9-]{4,64}$/.test(v.token)
      && typeof v.build === 'string' && Number.isInteger(v.slot) && typeof v.heard === 'number'
      && (v.side === undefined || v.side === 0 || v.side === 1) && (v.foe === undefined || (typeof v.foe === 'string' && v.foe.length <= PLAYER_NAME_MAX));
    if (ok && now - v!.heard! < HOLD_MS) return v as HeldSeat;
    sessionStorage.removeItem(SEAT_KEY);
  } catch { /* storage may be blocked */ }
  return null;
}

function keepSeat(s: HeldSeat | null): void {
  try {
    if (s) sessionStorage.setItem(SEAT_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SEAT_KEY);
  } catch { /* storage may be blocked */ }
}

/** Drops the held seat, so nothing offers to rejoin it. */
export function forgetSeat(): void { keepSeat(null); }

export interface LinkOptions {
  /** The token of a held seat, for a link that takes the seat back rather than asking for one. */
  resume?: string;
  /** The save slot the match was played from, kept with the held seat for a reloaded page. */
  slot?: number;
  /** The side and the other player's name the held seat recorded, kept until the room's `match` or `rejoin` says them again. */
  side?: 0 | 1;
  foe?: string;
}

/**
 * A socket to one room. Messages sent before the first socket opens wait and go out in order once it does. A socket that
 * drops during a match opens again with the seat's token until the room's hold runs out, and the room answers with a rejoin.
 */
export class NetLink implements Link {
  private ws: WebSocket | null = null;
  private inbox: FromRoom[] = [];
  private outbox: string[] = [];
  /** Aborted when a socket is let go, to take back every listener added for it. */
  private live: AbortController | null = null;
  private readonly gen = generation;
  private lastHeard = Date.now();
  private lastPing = 0;
  private lastCheck = Date.now();
  private opened = false;
  private everOpened = false;
  private ended = false;
  private closed = false;
  private token: string | null;
  private readonly slot: number;
  private side: 0 | 1 | undefined;
  private foe: string | undefined;
  /** True while the link comes back to its seat: from a drop, or from the start for a link made to resume. */
  private back: boolean;
  /** When the room's hold ends as this client counts it, the next try and the wait after it, when the open try started, and why the link dropped. */
  private holdUntil = 0;
  private retryAt = 0;
  private retryWait = RETRY_FIRST_MS;
  private triedAt = 0;
  private slackWhy = '';
  private keptAt = 0;
  /** Why the link ended on this side, for the screen that reports it. */
  problem = '';
  /** The last 40 messages each way by type and decision, newest last, for a report after a fault. */
  readonly trace: string[] = [];

  private note(s: string): void {
    this.trace.push(`${(performance.now() / 1000).toFixed(1)} ${s}`);
    if (this.trace.length > 40) this.trace.shift();
  }

  constructor(readonly room: string, opts: LinkOptions = {}) {
    this.token = opts.resume ?? null;
    this.slot = opts.slot ?? 0;
    this.side = opts.side;
    this.foe = opts.foe;
    this.back = !!this.token;
    if (this.back) this.holdUntil = Date.now() + HOLD_MS;
    this.connect();
  }

  private connect(): void {
    const ws = new WebSocket(`${byssusBase().replace(/^http/, 'ws')}/api/room/${this.room}`);
    const live = new AbortController(), on = { signal: live.signal };
    this.ws = ws;
    this.live = live;
    this.opened = false;
    ws.addEventListener('open', () => {
      this.opened = this.everOpened = true;
      this.lastHeard = this.lastCheck = this.triedAt = Date.now();
      if (this.back) ws.send(JSON.stringify({ type: 'hello', build: BUILD, resume: this.token! } satisfies ToRoom));
      for (const s of this.outbox) ws.send(s);
      this.outbox = [];
    }, on);
    ws.addEventListener('message', ev => this.receive(ev.data), on);
    // A close says which way the link ended: 1006 is a connection that died with nothing said. A page that took this seat
    // over, such as a copy of this tab, keeps it, so this page stops rather than taking it back and forth.
    ws.addEventListener('close', ev => {
      if (ev.code === CLOSE_REPLACED) { this.lost('Another page took this seat.'); return; }
      this.dropped(!this.opened ? 'The room could not be reached.' : ev.code === 1006 ? 'The link died without closing.' : 'The room closed the link.');
    }, on);
    // A hidden tab's timers slow to about once a minute, so the silence it comes back to says nothing about the room.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.lastHeard = Date.now(); }, on);
  }

  send(m: ToRoom): void {
    if (this.closed) return;
    const s = JSON.stringify(m), open = !this.back && this.ws?.readyState === WebSocket.OPEN;
    if (m.type !== 'ping') this.note(`out ${m.type}${'n' in m ? ` ${m.n}` : ''}${open ? '' : this.everOpened ? ' (dropped)' : ' (held)'}`);
    if (open) this.ws!.send(s);
    // A message sent while the link comes back is dropped. The screen sends its report and its choice again after the rejoin.
    else if (!this.everOpened) this.outbox.push(s);
  }

  poll(): FromRoom | null { return this.inbox.shift() ?? null; }

  slack(): number { return this.back && !this.closed ? Math.max(0, Math.ceil((this.holdUntil - Date.now()) / 1000)) : 0; }

  /** Pings every 10 seconds, gives the link up after 25 seconds of silence in a visible tab that did not just wake, and tries again while it comes back. */
  tick(): void {
    if (this.closed) return;
    if (this.gen !== generation) { this.shut(); return; }
    const now = Date.now();
    if (this.back) {
      if (now >= this.holdUntil) { forgetSeat(); this.lost(`The byssus went slack, and the room's hold ran out. ${this.slackWhy}`.trim()); return; }
      if (this.ws && this.opened && now - this.triedAt >= ANSWER_MS) this.dropped('The room did not answer.');
      if (!this.ws && now >= this.retryAt) this.connect();
      return;
    }
    if (!this.opened) return;
    if (now - this.lastPing >= PING_MS) { this.lastPing = now; this.send({ type: 'ping' }); }
    if (now - this.lastCheck < WATCH_MS) return;
    const late = now - this.lastCheck - WATCH_MS;
    this.lastCheck = now;
    if (late >= SLEEP_SLACK_MS) { this.lastHeard = now; return; }
    if (document.visibilityState === 'visible' && now - this.lastHeard >= SILENCE_MS) this.dropped('The room stopped answering.');
  }

  close(): void { this.shut(); }

  /** Ends this link for good and raises the generation, since closing a link is an exit from online play. */
  private shut(): void {
    if (this.closed) return;
    this.closed = true;
    this.back = false;
    leaveByssus();
    this.letGo();
  }

  /** Lets the socket go without a word to the screen: its listeners come off first, so its close reaches nobody. */
  private letGo(): void {
    this.live?.abort();
    this.live = null;
    try { this.ws?.close(1000, 'done'); } catch { /* already closed */ }
    this.ws = null;
    this.opened = false;
  }

  /** The socket is gone. During a match the link comes back to its seat, and before one the wait ends with the reason. */
  private dropped(why: string): void {
    if (this.closed) return;
    this.letGo();
    if (!this.token || this.ended) { this.lost(why); return; }
    if (!this.back) {
      this.back = true;
      this.slackWhy = why;
      this.holdUntil = Date.now() + HOLD_MS;
      this.retryWait = RETRY_FIRST_MS;
      this.note(`slack: ${why}`);
      // The room starts its hold at the drop, so the held seat's clock starts here too.
      this.keep(true);
    }
    this.retryAt = Date.now() + this.retryWait;
    this.retryWait = Math.min(RETRY_MAX_MS, this.retryWait * 2);
  }

  private receive(raw: unknown): void {
    if (this.closed) return;
    this.lastHeard = Date.now();
    const m = readRoom(raw);
    if (!m) { this.lost('The room sent a message this version cannot read. Reload the page.'); return; }
    if (m.type === 'pong') { this.keep(); return; }
    this.note(`in ${m.type}${'n' in m ? ` ${m.n}` : ''}`);
    if (m.type === 'resumeFailed') { forgetSeat(); this.lost(m.reason); return; }
    if (m.type === 'refused') {
      this.problem = m.reason;
      if (this.back) { forgetSeat(); this.lost(m.reason); return; }
    }
    if (m.type === 'match') this.token = m.token;
    if (m.type === 'match' || m.type === 'rejoin') { this.side = m.side; this.foe = m.names[1 - m.side]; }
    if (m.type === 'rejoin' || m.type === 'end') { this.back = false; this.retryWait = RETRY_FIRST_MS; }
    if (m.type === 'end') { this.ended = true; forgetSeat(); }
    else this.keep(m.type === 'match' || m.type === 'rejoin');
    this.inbox.push(m);
  }

  /** Brings the held seat's record up to date: the room spoke, so its hold starts no earlier than now. */
  private keep(force = false): void {
    if (!this.token || this.ended) return;
    const now = Date.now();
    if (!force && now - this.keptAt < KEEP_MS) return;
    this.keptAt = now;
    keepSeat({ room: this.room, token: this.token, build: BUILD, slot: this.slot, heard: now, ...(this.side === undefined ? {} : { side: this.side }), ...(this.foe === undefined ? {} : { foe: this.foe }) });
  }

  /** The link is gone on this side. A match still running ends here with no result, and the reason waits in `problem`. */
  private lost(reason: string): void {
    if (this.closed) return;
    if (!this.ended) {
      if (!this.problem) this.problem = reason;
      this.ended = true;
      this.inbox.push({ type: 'end', why: 'gone', winner: null });
    }
    this.shut();
  }
}
