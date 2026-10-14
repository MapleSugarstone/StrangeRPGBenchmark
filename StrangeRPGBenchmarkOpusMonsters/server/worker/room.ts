// One match's room. It reads every frame through `readClient`, seats two sockets, keeps the shared room rules' state in
// storage after every event that changes it, and holds one alarm for every deadline. Sockets use the hibernation API, so
// an idle room costs nothing and keeps its sockets when the runtime evicts it. A seat whose socket drops is held for its
// player to come back with the seat's token (Notes/online-design.md).
import { DurableObject } from 'cloudflare:workers';
import { readClient, REMATCH_SECONDS, type FromRoom, type Hello, type ToRoom } from '../../src/net/protocol';
import { newRoom, RoomRules, upgradeRoom, type Out, type RoomData } from '../../src/net/room';
import { lobbyOf, type Env } from './env';

/** What each socket carries through hibernation: its seat once a hello is accepted, when it last sent a frame, its strikes, and its frames in the current window. */
interface Tag { seat?: 0 | 1; heard: number; strikes: number; since: number; count: number }

/** How long a finished match's state stays for a rematch before the room clears its storage. */
const KEEP_AFTER_END_MS = REMATCH_SECONDS * 1000;
/** Frames the reader refuses before the room closes the socket, and the most frames a socket may send in one window. */
const STRIKES_MAX = 5, FLOOD_MAX = 40, FLOOD_WINDOW_MS = 10_000;
/** A socket that sends nothing and answers no ping for this long counts as dropped. A hidden tab still pings about once a minute. */
const SILENT_MS = 90_000;
/** The most sockets a room keeps open: two seats, and room for each to overlap with a socket coming back. */
const SOCKETS_MAX = 6;
/** Close codes the room sends: a socket another socket replaced on the same seat, a silent socket, and a socket closed out. */
export const CLOSE_REPLACED = 4000, CLOSE_SILENT = 4001, CLOSE_OUT = 1008;

export class Room extends DurableObject<Env> {
  private data: RoomData | null = null;
  /** The state as last stored and the alarm as last set, so an event that changes nothing writes nothing. */
  private stored = '';
  private alarmAt: number | null | undefined = undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // The runtime answers a ping itself without waking the room, so a client's watchdog tests the connection and nothing more.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'));
  }

  private name(): string { return this.ctx.id.name ?? this.ctx.id.toString(); }

  /** One line of JSON per event, so the dashboard can filter the logs by event and room. No player names go in. */
  private log(event: string, fields: Record<string, unknown> = {}): void {
    console.log(JSON.stringify({ event, room: this.name(), ...fields }));
  }

  private async load(now: number): Promise<RoomData> {
    if (this.data) return this.data;
    const stored = await this.ctx.storage.get<RoomData>('room');
    if (!stored) {
      const r = crypto.getRandomValues(new Uint32Array(2));
      return (this.data = newRoom(r[0] & 0x7fffffff, (r[1] & 1) as 0 | 1));
    }
    this.data = upgradeRoom(stored);
    this.stored = JSON.stringify(stored);
    // A deploy restarts the room and drops every socket with no close event, so a seat with no socket left is held from now.
    const held = new Set(this.ctx.getWebSockets().map(ws => this.tagOf(ws).seat));
    const rules = new RoomRules(stored);
    for (const seat of [0, 1] as const) if (stored.seats[seat] && !held.has(seat) && stored.phase !== 'open') this.deliver(rules.leave(seat, now));
    return stored;
  }

  /** Stores the state when it changed and sets the one alarm to the earliest deadline, never less than 250 ms ahead. */
  private async save(now: number): Promise<void> {
    const d = this.data!, raw = JSON.stringify(d);
    if (raw !== this.stored) {
      await this.ctx.storage.put('room', d);
      this.stored = raw;
    }
    const due = d.phase === 'over' ? (d.ended?.at ?? now) + KEEP_AFTER_END_MS : new RoomRules(d).nextDeadline();
    // An alarm set in the past fires at once, and one that finds nothing to do would be set again in the past.
    const at = due === null ? null : Math.max(due, now + 250);
    if (this.alarmAt === undefined) this.alarmAt = await this.ctx.storage.getAlarm();
    if (at === this.alarmAt) return;
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
    this.alarmAt = at;
  }

  private tagOf(ws: WebSocket): Tag {
    const t = ws.deserializeAttachment() as Partial<Tag> | null;
    return { seat: t?.seat, heard: t?.heard ?? 0, strikes: t?.strikes ?? 0, since: t?.since ?? 0, count: t?.count ?? 0 };
  }

  private setTag(ws: WebSocket, t: Tag): void { ws.serializeAttachment(t); }

  /** Sends each message to the socket that holds its seat. A seat whose socket is gone gets nothing. */
  private deliver(out: Out): void {
    if (!out.length) return;
    const sockets = this.ctx.getWebSockets();
    for (const { seat, m } of out) for (const ws of sockets) if (this.tagOf(ws).seat === seat) this.sendTo(ws, m);
  }

  private sendTo(ws: WebSocket, m: FromRoom): void {
    try { ws.send(JSON.stringify(m)); } catch { /* the socket closed between the check and the send */ }
  }

  private shut(ws: WebSocket, code: number, reason: string): void {
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
    const now = Date.now();
    await this.sweep(now);
    if (this.ctx.getWebSockets().length >= SOCKETS_MAX) return new Response('the room is full', { status: 503 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.setTag(server, { heard: now, strikes: 0, since: now, count: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  // Every entry point is guarded on its own. A throw in one would otherwise end the connection with no word to anyone.
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    try {
      await this.handle(ws, raw);
    } catch (err) {
      console.error('room message threw', err);
      this.log('fault', { error: err instanceof Error ? err.message : String(err) });
      // The reason stays plain, so the client's reader takes it. The details are in the log.
      this.sendTo(ws, { type: 'refused', reason: 'The room hit a fault.' });
    }
  }

  private async handle(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const now = Date.now(), tag = this.tagOf(ws);
    if (now - tag.since >= FLOOD_WINDOW_MS) { tag.since = now; tag.count = 0; }
    tag.count++;
    tag.heard = now;
    const read = readClient(typeof raw === 'string' ? raw : null);
    if ('why' in read) tag.strikes++;
    this.setTag(ws, tag);
    const d = await this.load(now), rules = new RoomRules(d), was = d.phase, out: Out = this.silent(rules, now);
    if (tag.count > FLOOD_MAX || tag.strikes >= STRIKES_MAX) out.push(...this.closeOut(ws, rules, tag.count > FLOOD_MAX ? 'a flood of frames' : `${tag.strikes} frames it could not read`, now));
    else if ('why' in read) {
      this.log('refused frame', { seat: tag.seat ?? null, why: read.why, strikes: tag.strikes });
      this.sendTo(ws, { type: 'refused', reason: 'The room could not read that message.' });
    } else out.push(...this.take(ws, read.m, rules, now));
    await this.finish(rules, out, was, now);
  }

  /** Acts on one message that passed the reader. */
  private take(ws: WebSocket, m: ToRoom, rules: RoomRules, now: number): Out {
    const d = rules.d, tag = this.tagOf(ws);
    if (m.type !== 'hello') return tag.seat === undefined ? [] : rules.receive(tag.seat, m, now);
    if (tag.seat !== undefined) return [];
    if ('resume' in m) return this.resume(ws, m, rules, now);
    const free = !d.seats[0] ? 0 : !d.seats[1] ? 1 : null;
    if (free === null || d.phase !== 'open') {
      this.sendTo(ws, { type: 'refused', reason: 'That room is full.' });
      this.shut(ws, 1000, 'full');
      return [];
    }
    const out = rules.join(free, m, crypto.randomUUID(), now);
    // A refusal goes straight back to its socket. The socket holds no seat to deliver it by.
    if (!d.seats[free]) {
      for (const o of out) this.sendTo(ws, o.m);
      this.shut(ws, 1000, 'refused');
      return [];
    }
    this.setTag(ws, { ...tag, seat: free });
    if (rules.d.phase === 'pick') this.log('start', { firstSide: d.firstSide });
    return out;
  }

  /** A hello with a token: the held seat comes back, an unknown token is refused, and a seat on another build voids the match. */
  private resume(ws: WebSocket, m: Extract<Hello, { resume: string }>, rules: RoomRules, now: number): Out {
    const d = rules.d, seat = rules.tokenSeat(m.resume);
    // A token this room never issued gets no seat, so a room that lost its memory never deals a second match.
    if (seat === null) {
      this.log('resume failed', { phase: d.phase });
      this.sendTo(ws, { type: 'resumeFailed', reason: 'That match is no longer running.' });
      this.shut(ws, 1000, 'unknown seat');
      return [];
    }
    if (d.phase !== 'over' && d.seats[seat]!.build !== m.build) {
      this.log('build changed', { seat, decision: d.n });
      this.sendTo(ws, { type: 'refused', reason: 'The game was updated during the match, so it does not count. Reload the page.' });
      this.shut(ws, 1000, 'build changed');
      return rules.resume(seat, m.build, now);
    }
    // A socket that still holds the seat is one the room never saw drop. The new socket takes its place, so one player never holds two.
    for (const other of this.ctx.getWebSockets()) {
      const t = this.tagOf(other);
      if (other === ws || t.seat !== seat) continue;
      this.setTag(other, { ...t, seat: undefined });
      this.shut(other, CLOSE_REPLACED, 'replaced');
    }
    this.setTag(ws, { ...this.tagOf(ws), seat });
    this.log('back', { seat, phase: d.phase, decision: d.n });
    return rules.resume(seat, m.build, now);
  }

  /** Closes a socket that sent too many frames the reader refused, or a flood of frames. Its seat resigns. */
  private closeOut(ws: WebSocket, rules: RoomRules, why: string, now: number): Out {
    const tag = this.tagOf(ws);
    this.log('closed out', { seat: tag.seat ?? null, why });
    this.setTag(ws, { ...tag, seat: undefined });
    this.shut(ws, CLOSE_OUT, 'closed out');
    return tag.seat === undefined ? [] : rules.expel(tag.seat, why, now);
  }

  /** Closes every socket that sent nothing and answered no ping for too long, and holds the seat of each one that had a seat. */
  private silent(rules: RoomRules, now: number): Out {
    const out: Out = [];
    for (const ws of this.ctx.getWebSockets()) {
      const tag = this.tagOf(ws), pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(tag.heard, pinged) < SILENT_MS) continue;
      this.setTag(ws, { ...tag, seat: undefined });
      this.shut(ws, CLOSE_SILENT, 'silent');
      if (tag.seat === undefined) continue;
      this.log('silent', { seat: tag.seat, phase: rules.d.phase, decision: rules.d.n });
      out.push(...rules.leave(tag.seat, now));
    }
    return out;
  }

  /** The silence check on its own, for a new socket that needs room. */
  private async sweep(now: number): Promise<void> {
    if (!this.ctx.getWebSockets().length) return;
    const d = await this.load(now), rules = new RoomRules(d), was = d.phase;
    await this.finish(rules, this.silent(rules, now), was, now);
  }

  /** Stores the state, sends what the event produced, and logs the end of each game, the end of the match once, and a rematch. */
  private async finish(rules: RoomRules, out: Out, was: RoomData['phase'], now: number): Promise<void> {
    const d = rules.d;
    await this.save(now);
    this.deliver(out);
    if (d.phase === was) return;
    if (d.phase === 'between' && d.last) this.log('game', { game: d.game, why: d.last.why, winner: d.last.winner, wins: d.wins, decisions: d.record.length });
    if (was === 'over' && d.phase === 'pick') this.log('rematch');
    if (d.phase !== 'over' || !d.ended) return;
    const e = d.ended;
    this.log('end', { why: e.why, winner: e.matchWinner, game: d.game, wins: d.wins, decisions: d.record.length, seconds: Math.round((now - d.startedAt) / 1000), note: e.note });
    // A match with no result keeps what the tools need to replay it: both rosters, both picks, and the record, with no names.
    if (e.why === 'void') this.log('record', { rosters: d.seats.map(s => s?.roster ?? null), firstSide: d.firstSide, picks: d.picks, record: d.record });
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    try {
      await this.leave(ws, `code ${code}${wasClean ? ' clean' : ''}${reason ? ` ${reason}` : ''}`);
    } catch (err) {
      console.error('room close threw', err);
    }
    // Completes a close the client started, which this compatibility date leaves to the room.
    this.shut(ws, 1000, 'closed');
  }

  async webSocketError(ws: WebSocket, err: unknown): Promise<void> {
    try {
      await this.leave(ws, `error ${err instanceof Error ? err.message : String(err)}`);
    } catch (e) {
      console.error('room error handler threw', e);
    }
  }

  private async leave(ws: WebSocket, how: string): Promise<void> {
    const tag = this.tagOf(ws), seat = tag.seat;
    if (seat === undefined) return;
    this.setTag(ws, { ...tag, seat: undefined });
    const now = Date.now(), d = await this.load(now), rules = new RoomRules(d), wasOpen = d.phase === 'open', was = d.phase;
    this.log('seat closed', { seat, phase: d.phase, decision: d.n, how });
    await this.finish(rules, rules.leave(seat, now), was, now);
    // A room whose only player left before a match takes itself out of the queue and drops its code.
    if (wasOpen && !d.seats[0] && !d.seats[1]) await lobbyOf(this.env).cancel(this.name(), null);
  }

  async alarm(): Promise<void> {
    // The runtime clears an alarm before it runs it.
    this.alarmAt = null;
    try {
      const now = Date.now(), d = await this.load(now), rules = new RoomRules(d), was = d.phase;
      if (d.phase === 'over' && now >= (d.ended?.at ?? 0) + KEEP_AFTER_END_MS) {
        for (const ws of this.ctx.getWebSockets()) this.shut(ws, 1000, 'over');
        await this.ctx.storage.deleteAll();
        this.data = null;
        this.stored = '';
        this.alarmAt = undefined;
        return;
      }
      const out = this.silent(rules, now);
      out.push(...rules.tick(now));
      await this.finish(rules, out, was, now);
    } catch (err) {
      console.error('room alarm threw', err);
      // One bad tick must not stop every clock in the room.
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      this.alarmAt = undefined;
    }
  }
}
