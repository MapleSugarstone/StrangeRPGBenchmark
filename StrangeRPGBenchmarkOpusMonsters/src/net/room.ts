// The rules a Byssus room keeps, shared by the server's room and the loopback room so both run the same match: two seats,
// a match of up to three games, the blind pick, clocks with grace, blind choices, peeks, timeouts, three timeouts in a row,
// resignations, the seat hold, the rejoin, the wait between games, the end, and the rematch. The room runs no game code.
// Its state is plain data so the server can store it whole, every call takes the time in milliseconds, and every call
// returns the messages to send by seat. Every message it takes has passed `readClient` first (Notes/online-design.md).
import { nameBlocked, STRANGER } from './names';
import {
  CHOICE_SECONDS, chooses, GAMES_MAX, GAMES_TO_WIN, HOLD_SECONDS, NETWORK_GRACE_SECONDS, NEXT_SECONDS, PICK_SECONDS, REPLACE_SECONDS,
  REPORT_WAIT_SECONDS, sameNeed, TIMEOUTS_TO_LOSE, type Choice, type EndMsg, type EndWhy, type FromRoom, type Hello, type Need,
  type PeekMsg, type RejoinMsg, type Release, type ToRoom, type WireMon,
} from './protocol';

/** A seat's ready report for a decision: its state hash and how it describes the decision. */
export interface Report { hash: string; need: Need }

/** One seat: the player's build, name, and roster, the token that proves the seat on a reconnect, and when its hold ends while its player is away. */
export interface Seat { build: string; name: string; roster: WireMon[]; token: string; away: number | null }

/** Both sides' reports for one decision until both are in and compared. */
export interface Pair { n: number; r: [Report | null, Report | null] }

/** A room's whole state as plain data. Sides are the battle's sides, and seats are the order players arrived in. */
export interface RoomData {
  phase: 'open' | 'pick' | 'play' | 'between' | 'over';
  /** The side the first seat plays. The creator picks it at random, and the loopback puts the AI on side 0. */
  firstSide: 0 | 1;
  seats: [Seat | null, Seat | null];
  /** Picks the scene and the music of the game in hand, so both screens match. Each game takes the next seed. */
  seed: number;
  /** The seed a random battle's rosters come from. It stays for a match, and a rematch takes the next one. */
  deal: number;
  /** The game in hand from 1, and the games each side has won in this match. */
  game: number;
  wins: [number, number];
  /** A private room's code, sent back to the host while it waits. */
  code: string | null;
  pickDue: number;
  /** Picks by side. */
  picks: [number[] | null, number[] | null];
  record: Release[];
  /** The decision in hand and, by side, its reports, whether each side chose, the choices, the timeouts, and the deadlines with grace. */
  n: number;
  reports: [Report | null, Report | null];
  has: [boolean, boolean];
  chosen: [Choice, Choice];
  late: [boolean, boolean];
  due: [number | null, number | null];
  peeked: boolean;
  releasedAt: number;
  /** Reports until both sides' are in. A report can come after its release, and it is still compared. */
  pairs: Pair[];
  /** Timeouts in a row by side. */
  streak: [number, number];
  /** Between games: the end of the game before, and when the next game starts if both players have not said they are ready. */
  last: EndMsg | null;
  nextDue: number;
  /** By side: ready for the next game between games, and asking for a rematch after the match. */
  ready: [boolean, boolean];
  /** By side, after the match: the player left the room, so no rematch can start. */
  gone: [boolean, boolean];
  /** When the match started, and how and when it ended with a note for the logs that no client sees. */
  startedAt: number;
  ended: { why: EndWhy; winner: 0 | 1 | null; matchWinner: 0 | 1 | null; at: number; note: string } | null;
}

/** Messages to send, each to a seat. */
export type Out = { seat: 0 | 1; m: FromRoom }[];

/** The most pairs a room keeps waiting for a second report. */
const PAIRS_MAX = 16;
/**
 * Seconds a decision may stay open while both players are seated before the match ends with no result. A decision with
 * every clock run out takes under three minutes, so a decision this old means both copies have stopped.
 */
const STALL_SECONDS = 600;
const CLOCK = { pick: PICK_SECONDS, choice: CHOICE_SECONDS, replace: REPLACE_SECONDS };

/** A room with nobody seated yet. */
export function newRoom(seed: number, firstSide: 0 | 1, code: string | null = null): RoomData {
  return {
    phase: 'open', firstSide, seats: [null, null], seed, deal: seed, game: 1, wins: [0, 0], code, pickDue: 0, picks: [null, null], record: [],
    n: 0, reports: [null, null], has: [false, false], chosen: [null, null], late: [false, false], due: [null, null], peeked: false,
    releasedAt: 0, pairs: [], streak: [0, 0], last: null, nextDue: 0, ready: [false, false], gone: [false, false], startedAt: 0, ended: null,
  };
}

/** Fills the fields that a room stored before matches had games lacks, so a deploy during a match leaves it readable. */
export function upgradeRoom(d: RoomData): RoomData {
  const o = d as Partial<RoomData>;
  o.deal ??= d.seed;
  o.game ??= 1;
  o.wins ??= [0, 0];
  o.last ??= null;
  o.nextDue ??= 0;
  o.ready ??= [false, false];
  o.gone ??= [false, false];
  if (d.ended) d.ended.matchWinner ??= d.ended.winner;
  return d;
}

/** The seed after `s` in 31 bits. Each game takes a new scene this way, and each rematch new random rosters. */
export function reseed(s: number): number {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) & 0x7fffffff;
}

const secs = (s: number): number => s * 1000;
/** Whole seconds from `now` to `at` less the hidden grace, and never below 0. */
const secsLeft = (at: number, now: number, grace = 0): number => Math.max(0, Math.ceil((at - now) / 1000) - grace);

/** The rules over one room's data. Build one around stored data for each event, and store the data again after. */
export class RoomRules {
  private out: Out = [];

  constructor(readonly d: RoomData) {}

  sideOf(seat: 0 | 1): 0 | 1 { return (seat === 0 ? this.d.firstSide : 1 - this.d.firstSide) as 0 | 1; }
  seatOf(side: 0 | 1): 0 | 1 { return (side === this.d.firstSide ? 0 : 1) as 0 | 1; }

  private send(side: 0 | 1, m: FromRoom): void { this.out.push({ seat: this.seatOf(side), m }); }
  private both(m: FromRoom): void { this.send(0, m); this.send(1, m); }
  private flush(): Out { const o = this.out; this.out = []; return o; }

  /** The seat a resume token proves, or null. */
  tokenSeat(token: string): 0 | 1 | null {
    for (const seat of [0, 1] as const) if (this.d.seats[seat]?.token === token) return seat;
    return null;
  }

  /** Seats a player who said hello with a roster, or refuses them with a reason. The caller has already found the seat free. */
  join(seat: 0 | 1, m: Extract<Hello, { roster: WireMon[] }>, token: string, now: number): Out {
    const d = this.d, refuse = (reason: string): Out => [{ seat, m: { type: 'refused', reason } }];
    if (d.phase !== 'open') return refuse('That match has already started.');
    const other = d.seats[(1 - seat) as 0 | 1];
    if (other && other.build !== m.build) return refuse('Your copy of the game is a different version. Reload the page.');
    // A name the word filter refuses never reaches the other player. A client shows a stand-in for an empty whorl name.
    const name = nameBlocked(m.name) ? STRANGER : m.name;
    const roster = m.roster.map(w => (nameBlocked(w.name) ? { ...w, name: '' } : w));
    d.seats[seat] = { build: m.build, name, roster, token, away: null };
    if (!d.seats[0] || !d.seats[1]) return [{ seat, m: { type: 'waiting', ...(d.code ? { code: d.code } : {}) } }];
    this.start(now);
    return this.flush();
  }

  /** Starts the game in hand: each player learns their side, both rosters, the game, and the games won, and the pick clock starts. */
  private start(now: number): void {
    const d = this.d, bySide = (side: 0 | 1) => d.seats[this.seatOf(side)]!;
    d.phase = 'pick';
    if (d.game === 1) d.startedAt = now;
    d.pickDue = now + secs(PICK_SECONDS + NETWORK_GRACE_SECONDS);
    d.picks = [null, null];
    d.record = [];
    d.n = 0;
    d.pairs = [];
    d.streak = [0, 0];
    d.last = null;
    d.ready = [false, false];
    this.open(now);
    const names: [string, string] = [bySide(0).name, bySide(1).name], rosters: [WireMon[], WireMon[]] = [bySide(0).roster, bySide(1).roster];
    for (const side of [0, 1] as const) {
      this.send(side, { type: 'match', side, token: bySide(side).token, names, rosters, seed: d.seed, deal: d.deal, game: d.game, wins: [d.wins[0], d.wins[1]], clock: CLOCK });
    }
  }

  /**
   * A held seat's player came back with its token. A finished match gets its end, a seat on another build voids the match,
   * and otherwise the seat gets the whole match back and the other player hears it is back.
   */
  resume(seat: 0 | 1, build: string, now: number): Out {
    const d = this.d, s = d.seats[seat];
    if (d.phase === 'over') return this.afterEnd(seat);
    if (d.phase === 'open' || !s) return [{ seat, m: { type: 'resumeFailed', reason: 'That match is no longer running.' } }];
    // The battle on the other screen came from the old build. A deploy between a drop and a reload is nobody's fault.
    if (s.build !== build) { this.end('void', null, now, 'a seat came back on another build'); return this.flush(); }
    const side = this.sideOf(seat), back = s.away !== null, other = d.seats[(1 - seat) as 0 | 1];
    s.away = null;
    // A copy rebuilt from the record reports from the decision in hand, so older reports it owes never come.
    d.pairs = d.pairs.filter(p => p.n >= d.n || p.r[side]);
    this.out.push({ seat, m: this.rejoinFor(seat, now) });
    if (back) this.send((1 - side) as 0 | 1, { type: 'back', side });
    if (other?.away != null) this.out.push({ seat, m: { type: 'away', side: (1 - side) as 0 | 1, left: secsLeft(other.away, now) } });
    return this.flush();
  }

  /** What a seat that comes back after the match hears: the end, and whether the other player left or asked for a rematch. */
  private afterEnd(seat: 0 | 1): Out {
    const d = this.d, foe = (1 - this.sideOf(seat)) as 0 | 1, out: Out = [{ seat, m: this.endMsg() }];
    if (d.gone[foe]) out.push({ seat, m: { type: 'left', side: foe } });
    else if (d.ready[foe]) out.push({ seat, m: { type: 'again', side: foe } });
    return out;
  }

  /** The whole game in hand as one seat needs it to pick up where it is. Between games it carries the end of the game before. */
  private rejoinFor(seat: 0 | 1, now: number): RejoinMsg {
    const d = this.d, side = this.sideOf(seat), foe = (1 - side) as 0 | 1, bySide = (sd: 0 | 1) => d.seats[this.seatOf(sd)]!;
    const picking = d.phase === 'pick', playing = d.phase === 'play', need = this.need();
    const left = ([0, 1] as const).map(sd => (playing && d.due[sd] !== null && !d.has[sd] && !d.late[sd] ? secsLeft(d.due[sd]!, now, NETWORK_GRACE_SECONDS) : null));
    const peek: PeekMsg | null = playing && d.peeked && need?.kind === 'joint' && need.sees === side
      ? { type: 'peek', n: d.n, c: d.late[foe] ? null : d.chosen[foe], timeout: d.late[foe] } : null;
    return {
      type: 'rejoin', side, names: [bySide(0).name, bySide(1).name], rosters: [bySide(0).roster, bySide(1).roster], seed: d.seed, deal: d.deal,
      game: d.game, wins: [d.wins[0], d.wins[1]], clock: CLOCK,
      picked: playing ? { picks: d.picks, timeout: [!d.picks[0], !d.picks[1]] } : null, record: playing ? d.record : [],
      pickLeft: picking ? secsLeft(d.pickDue, now, NETWORK_GRACE_SECONDS) : 0, pick: picking ? d.picks[side] : null,
      chose: playing && d.has[side], left: [left[0], left[1]], peek, last: d.phase === 'between' ? d.last : null,
    };
  }

  /** Handles any message but hello from a seated player. */
  receive(seat: 0 | 1, m: ToRoom, now: number): Out {
    const d = this.d, side = this.sideOf(seat), foe = (1 - side) as 0 | 1;
    if (m.type === 'ping') return [{ seat, m: { type: 'pong' } }];
    if (d.phase === 'open') return [];
    if (d.phase === 'over') {
      if (m.type === 'again') this.onAgain(side, now);
      else if (m.type === 'resign') this.depart(side);
      return this.flush();
    }
    if (m.type === 'foul') this.end('void', null, now, `side ${side} called a foul in game ${d.game} at decision ${m.n}: ${m.why}`);
    else if (d.phase === 'between') {
      if (m.type === 'next') this.onNext(side, now);
      // Giving up between games leaves the match.
      else if (m.type === 'resign') this.end('resign', foe, now, `side ${side} left after game ${d.game}`);
    } else if (m.type === 'pick') this.onPick(side, m.order, now);
    else if (m.type === 'ready') this.onReady(side, m.n, m.hash, m.need, now);
    else if (m.type === 'choose') this.onChoose(side, m.n, m.c, now);
    else if (m.type === 'resign') this.gameOver('resign', foe, now, `side ${side} gave up game ${d.game}`);
    return this.flush();
  }

  /**
   * A seat's connection closed. Before the match the seat is free again, during it the seat is held for its player to come
   * back, and after it the player has left the room.
   */
  leave(seat: 0 | 1, now: number): Out {
    const d = this.d, s = d.seats[seat];
    if (d.phase === 'open') { d.seats[seat] = null; return []; }
    if (d.phase === 'over') { this.depart(this.sideOf(seat)); return this.flush(); }
    if (!s || s.away !== null) return [];
    s.away = now + secs(HOLD_SECONDS);
    this.send((1 - this.sideOf(seat)) as 0 | 1, { type: 'away', side: this.sideOf(seat), left: HOLD_SECONDS });
    return this.flush();
  }

  /** The room closed a seat's socket for sending what it cannot read or for a flood of messages. The seat gives up the match. */
  expel(seat: 0 | 1, why: string, now: number): Out {
    const d = this.d, side = this.sideOf(seat);
    if (d.phase === 'open') { d.seats[seat] = null; return []; }
    if (d.phase === 'over') this.depart(side);
    else this.end('resign', (1 - side) as 0 | 1, now, `side ${side} was closed out: ${why}`);
    return this.flush();
  }

  /** Runs every deadline that has passed: the pick clock, the fallback clock start, each side's choice clock, a stalled decision, the wait between games, and each seat's hold. */
  tick(now: number): Out {
    const d = this.d;
    if (d.phase === 'pick' && now >= d.pickDue) this.releasePicks(now);
    if (d.phase === 'play') { this.clocks(now); this.stall(now); }
    // The next game waits for a player who is away, whose hold then decides.
    if (d.phase === 'between' && now >= d.nextDue && this.seated()) this.nextGame(now);
    if (d.phase === 'pick' || d.phase === 'play' || d.phase === 'between') this.holds(now);
    return this.flush();
  }

  /** The earliest time `tick` has work to do, or null. */
  nextDeadline(): number | null {
    const d = this.d, at: number[] = [];
    if (d.phase !== 'pick' && d.phase !== 'play' && d.phase !== 'between') return null;
    for (const s of d.seats) if (s && s.away !== null) at.push(s.away);
    if (d.phase === 'pick') at.push(d.pickDue);
    else if (d.phase === 'between') { if (this.seated()) at.push(d.nextDue); }
    else {
      const need = this.need();
      for (const side of [0, 1] as const) if (d.due[side] !== null && !d.has[side] && !d.late[side]) at.push(d.due[side]!);
      if (need && need.kind !== 'over' && (!d.reports[0] || !d.reports[1])) at.push(d.releasedAt + secs(REPORT_WAIT_SECONDS));
      // A decision nobody reports has no clock to run, so every decision gets a last deadline. While a seat is away its hold decides.
      if (this.seated()) at.push(d.releasedAt + secs(STALL_SECONDS));
    }
    return at.length ? Math.min(...at) : null;
  }

  /** Whether both players are seated and neither is away. */
  private seated(): boolean { return this.d.seats.every(s => !!s && s.away === null); }

  /** Ends a match whose decision has stayed open for `STALL_SECONDS` while both players are seated. */
  private stall(now: number): void {
    const d = this.d;
    if (d.phase !== 'play' || !this.seated() || now < d.releasedAt + secs(STALL_SECONDS)) return;
    this.end('void', null, now, `decision ${d.n} of game ${d.game} stayed open for ${STALL_SECONDS} seconds with ${d.reports.filter(Boolean).length} reports`);
  }

  /** The match's end as the message the room sends. */
  endMsg(): EndMsg {
    const d = this.d, e = d.ended!;
    return { type: 'end', why: e.why, winner: e.winner, wins: [d.wins[0], d.wins[1]], final: true, matchWinner: e.matchWinner };
  }

  /** A hold that runs out gives the other side the match, or ends the match with no winner when both players are away. */
  private holds(now: number): void {
    const d = this.d;
    for (const seat of [0, 1] as const) {
      const s = d.seats[seat], o = d.seats[(1 - seat) as 0 | 1];
      if (!s || s.away === null || now < s.away || d.phase === 'over') continue;
      const winner = o && o.away === null ? this.sideOf((1 - seat) as 0 | 1) : null;
      this.end('gone', winner, now, `side ${this.sideOf(seat)}'s hold ran out${winner === null ? ' with both players away' : ''}`);
    }
  }

  private onPick(side: 0 | 1, order: number[], now: number): void {
    if (this.d.phase !== 'pick') return;
    this.d.picks[side] = order.slice();
    if (this.d.picks[0] && this.d.picks[1]) this.releasePicks(now);
  }

  private releasePicks(now: number): void {
    const d = this.d;
    this.both({ type: 'picked', picks: d.picks, timeout: [!d.picks[0], !d.picks[1]] });
    d.phase = 'play';
    d.n = 0;
    this.open(now);
  }

  /** Starts decision `n` with nothing reported or chosen. */
  private open(now: number): void {
    const d = this.d;
    d.reports = [null, null];
    d.has = [false, false];
    d.chosen = [null, null];
    d.late = [false, false];
    d.due = [null, null];
    d.peeked = false;
    d.releasedAt = now;
  }

  private need(): Need | null { return (this.d.reports[0] ?? this.d.reports[1])?.need ?? null; }

  /** Whether `side` foresees this decision and so waits for the peek before its clock starts. */
  private waitsForPeek(need: Need, side: 0 | 1): boolean { return need.kind === 'joint' && need.sees === side && !this.d.peeked; }

  private startClock(side: 0 | 1, need: Need, now: number): void {
    const d = this.d;
    if (d.due[side] !== null || !chooses(need, side)) return;
    const s = need.kind === 'replace' || need.kind === 'replace2' ? REPLACE_SECONDS : CHOICE_SECONDS;
    d.due[side] = now + secs(s + NETWORK_GRACE_SECONDS);
    this.both({ type: 'clock', n: d.n, side, left: s });
  }

  private onReady(side: 0 | 1, n: number, hash: string, need: Need, now: number): void {
    const d = this.d;
    if (d.phase !== 'play' || n > d.n) return;
    let pair = d.pairs.find(p => p.n === n);
    if (!pair) {
      // An older decision with no pair left was compared already, so this report is a repeat.
      if (n < d.n) return;
      pair = { n, r: [null, null] };
      d.pairs.push(pair);
      if (d.pairs.length > PAIRS_MAX) d.pairs.shift();
    }
    if (pair.r[side]) return;
    const r: Report = { hash, need };
    pair.r[side] = r;
    const [a, b] = pair.r;
    if (a && b) {
      d.pairs = d.pairs.filter(p => p !== pair);
      if (a.hash !== b.hash || !sameNeed(a.need, b.need)) {
        this.end('void', null, now, `the copies differ in game ${d.game} at decision ${n}: side 0 ${a.hash} ${JSON.stringify(a.need)}, side 1 ${b.hash} ${JSON.stringify(b.need)}`);
        return;
      }
      if (a.need.kind === 'over') {
        if (a.need.stalled) this.end('void', null, now, `game ${d.game} stalled at decision ${n}`);
        else this.gameOver('over', a.need.winner, now, `game ${d.game} ended at decision ${n}`);
        return;
      }
    }
    if (n !== d.n) return;
    d.reports[side] = r;
    if (!this.waitsForPeek(need, side)) this.startClock(side, need, now);
  }

  private onChoose(side: 0 | 1, n: number, c: Choice, now: number): void {
    const d = this.d, need = d.reports[side]?.need;
    if (d.phase !== 'play' || n !== d.n || !need || !chooses(need, side) || d.has[side] || d.late[side]) return;
    d.has[side] = true;
    d.chosen[side] = c;
    this.peekFor(need, side, c, false, now);
    this.tryRelease(now);
  }

  /** Shows the foreseeing side the other side's choice or its timeout and starts the foreseeing side's clock. */
  private peekFor(need: Need, side: 0 | 1, c: Choice, timeout: boolean, now: number): void {
    const d = this.d;
    if (need.kind !== 'joint' || need.sees !== 1 - side || d.peeked) return;
    d.peeked = true;
    const seer = (1 - side) as 0 | 1;
    this.send(seer, { type: 'peek', n: d.n, c, timeout });
    this.startClock(seer, need, now);
  }

  private clocks(now: number): void {
    const d = this.d, need = this.need();
    if (!need) return;
    // A side that never reports gets its clock some seconds after the last release, so the other side never waits for long.
    if (now - d.releasedAt >= secs(REPORT_WAIT_SECONDS)) for (const side of [0, 1] as const) if (!this.waitsForPeek(need, side)) this.startClock(side, need, now);
    for (const side of [0, 1] as const) {
      const due = d.due[side];
      if (due === null || d.has[side] || d.late[side] || now < due) continue;
      d.late[side] = true;
      this.peekFor(need, side, null, true, now);
    }
    this.tryRelease(now);
  }

  private tryRelease(now: number): void {
    const d = this.d, need = this.need();
    if (!need || need.kind === 'over' || d.phase !== 'play') return;
    for (const side of [0, 1] as const) if (chooses(need, side) && !d.has[side] && !d.late[side]) return;
    const rel: Release = { n: d.n, need, c: [null, null], timeout: [false, false] };
    for (const side of [0, 1] as const) {
      if (!chooses(need, side)) continue;
      if (d.late[side]) rel.timeout[side] = true;
      else rel.c[side] = d.chosen[side];
      d.streak[side] = rel.timeout[side] ? d.streak[side] + 1 : 0;
    }
    d.record.push(rel);
    this.both({ type: 'release', ...rel });
    d.n++;
    this.open(now);
    const out = ([0, 1] as const).filter(side => d.streak[side] >= TIMEOUTS_TO_LOSE);
    if (out.length === 2) this.end('void', null, now, 'both sides ran out of time three times in a row');
    else if (out.length === 1) this.end('timeouts', (1 - out[0]) as 0 | 1, now, `side ${out[0]} ran out of time three times in a row`);
  }

  /** Ends the game in hand. A game that settles the match ends the match, and any other starts the wait for the next game. */
  private gameOver(why: 'over' | 'resign', winner: 0 | 1 | null, now: number, note: string): void {
    const d = this.d;
    if (d.phase !== 'pick' && d.phase !== 'play') return;
    if (winner !== null) d.wins[winner]++;
    if (d.wins[0] >= GAMES_TO_WIN || d.wins[1] >= GAMES_TO_WIN || d.game >= GAMES_MAX) {
      this.end(why, winner, now, note, d.wins[0] > d.wins[1] ? 0 : d.wins[1] > d.wins[0] ? 1 : null);
      return;
    }
    d.phase = 'between';
    d.nextDue = now + secs(NEXT_SECONDS);
    d.ready = [false, false];
    d.last = { type: 'end', why, winner, wins: [d.wins[0], d.wins[1]], final: false, matchWinner: null };
    this.both(d.last);
  }

  /** A player is ready for the next game. It starts once both are, or when the wait runs out. */
  private onNext(side: 0 | 1, now: number): void {
    const d = this.d;
    d.ready[side] = true;
    if (d.ready[0] && d.ready[1]) this.nextGame(now);
  }

  /** Starts the next game of the match on a new scene. */
  private nextGame(now: number): void {
    const d = this.d;
    d.game++;
    d.seed = reseed(d.seed);
    this.start(now);
  }

  /** A player asked for a rematch. Once both have, a new match starts in this room on the same seats. */
  private onAgain(side: 0 | 1, now: number): void {
    const d = this.d, foe = (1 - side) as 0 | 1;
    if (d.gone[foe] || d.gone[side]) { this.send(side, { type: 'left', side: d.gone[foe] ? foe : side }); return; }
    if (d.ready[side]) return;
    d.ready[side] = true;
    this.send(foe, { type: 'again', side });
    if (!d.ready[foe]) return;
    d.deal = reseed(d.deal);
    d.seed = reseed(d.seed);
    d.game = 1;
    d.wins = [0, 0];
    d.ended = null;
    this.start(now);
  }

  /** A player left after the match, and the other hears that no rematch can start. */
  private depart(side: 0 | 1): void {
    const d = this.d;
    if (d.gone[side]) return;
    d.gone[side] = true;
    d.ready = [false, false];
    this.send((1 - side) as 0 | 1, { type: 'left', side });
  }

  /** Ends the match for both players. Every clock and hold stops here whatever the result, and a seat that is away has left. */
  private end(why: EndWhy, winner: 0 | 1 | null, now: number, note: string, matchWinner = winner): void {
    const d = this.d;
    if (d.phase === 'over') return;
    d.phase = 'over';
    d.last = null;
    d.ready = [false, false];
    d.gone = [false, false];
    d.ended = { why, winner, matchWinner, at: now, note };
    this.both(this.endMsg());
    for (const side of [0, 1] as const) if (d.seats[this.seatOf(side)]?.away != null) this.depart(side);
  }
}
