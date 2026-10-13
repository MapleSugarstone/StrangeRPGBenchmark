// An online match in one browser with no network: a room that follows the Byssus protocol, and an AI that plays side 0
// through it with its own lockstep copy, so a person picks and plays side 1 the way a real match runs (Notes/online-design.md).
import { answer, choose, chooseReplacement, chooseVisit, matchup } from '../battle/ai';
import { clone, newBattle } from '../battle/engine';
import type { Action, Mon } from '../battle/model';
import { NOTION_IDS } from '../data/notions';
import { makeMon, SPECIES, WILD_KINDS } from '../data/species';
import { PLANNED_NOTIONS, plannedKit, randomFit } from '../game/wildfit';
import { BUILD, chooses, Lockstep, onlineRules, passiveAction, stateHash, teamsFromPicks, type Choice, type Need, type Release } from './lockstep';
import { readClient, readRoom, reasonText, type FromRoom, type Link, type MatchMsg, type PeekMsg, type ToRoom } from './protocol';
import { newRoom, RoomRules, type Out, type RoomData } from './room';
import { monFromWire, ROSTER_SIZE, TEAM_SIZE, teamProblems, wireFromMon, type WireMon } from './wire';

/** Steps a second, as the game loop runs them. */
const FPS = 60;
/** A message as JSON carries it, so neither end shares an object with the other. */
const wire = <T>(m: T): T => JSON.parse(JSON.stringify(m)) as T;
/** Messages either reader refused in a loopback room. The real room would refuse them too, so the tools report them. */
export const loopFaults: string[] = [];

/** Picks the AI's four from its six by their matchups against the whole other roster. The best one leads. */
export function aiPick(mine: WireMon[], theirs: WireMon[]): number[] {
  const b = newBattle(
    { mons: mine.map((w, i) => monFromWire(w, 0, i)), name: 'a', ai: 'keeper', charm: null },
    { mons: theirs.map((w, i) => monFromWire(w, 1, i)), name: 'b', ai: 'keeper', charm: null },
    onlineRules(),
  );
  const score = b.s[0].f.map((f, i) => ({ i, v: b.s[1].f.reduce((n, d) => n + matchup(f, d), 0) }));
  return score.sort((x, y) => y.v - x.v || x.i - y.i).slice(0, TEAM_SIZE).map(x => x.i);
}

/** A roster of six as a player plans one: kinds and fits with no legendary, each kind once, and a different notion on each. */
export function aiRoster(rnd: () => number): WireMon[] {
  const kinds = WILD_KINDS.filter(k => SPECIES[k] && !SPECIES[k].person && !SPECIES[k].legendary);
  const any = () => kinds[Math.floor(rnd() * kinds.length)];
  const used = new Set<string>(), out: Mon[] = [];
  while (out.length < ROSTER_SIZE) {
    const k = any();
    if (used.has(k)) continue;
    if (rnd() < 0.4) {
      const k2 = any();
      if (k2 === k || used.has(k2)) continue;
      used.add(k).add(k2);
      out.push(plannedKit(rnd, randomFit(rnd, k, k2, 25)));
    } else {
      used.add(k);
      out.push(plannedKit(rnd, makeMon(k, 25)));
    }
  }
  // A notion already on the roster gives way to the next one planned for the whorl's attack or to any notion left.
  const held = new Set<string>();
  for (const m of out) {
    if (!m.notion || held.has(m.notion)) m.notion = [...PLANNED_NOTIONS[m.basic], ...NOTION_IDS].find(id => !held.has(id)) ?? null;
    if (m.notion) held.add(m.notion);
  }
  return out.map(wireFromMon);
}

/** The AI's seat: it reads the room's messages, keeps its own copy of the battle, and answers after a short think. */
class AiSeat {
  match: MatchMsg | null = null;
  ls: Lockstep | null = null;
  peek: PeekMsg | null = null;
  /** What the AI does when its think runs out, and the frames left until then. */
  plan: (() => void) | null = null;
  wait = 0;
  reported = -1;
  done = false;

  constructor(readonly room: Room, readonly roster: WireMon[], readonly name: string, readonly think: [number, number], readonly idle: boolean, readonly rnd: () => number) {}

  send(m: ToRoom): void { this.room.receive(0, wire(m.type === 'foul' ? { ...m, why: reasonText(m.why) } : m)); }

  later(f: () => void): void {
    const [lo, hi] = this.think;
    this.wait = lo + Math.floor(this.rnd() * (hi - lo + 1));
    this.plan = f;
  }

  tick(): void {
    if (!this.plan || --this.wait > 0) return;
    const f = this.plan;
    this.plan = null;
    f();
  }

  deliver(m: FromRoom): void {
    if (this.done) return;
    if (m.type === 'match') {
      this.match = m;
      const bad = teamProblems(m.rosters[1]);
      if (bad.length) { this.send({ type: 'foul', n: -1, why: bad.join(' ') }); return; }
      this.later(() => this.send({ type: 'pick', order: aiPick(m.rosters[0], m.rosters[1]) }));
    } else if (m.type === 'picked' && this.match) {
      this.plan = null;
      try { this.ls = new Lockstep(teamsFromPicks(this.match.rosters, m), this.match.names, 0); } catch (e) { this.send({ type: 'foul', n: -1, why: (e as Error).message }); return; }
      this.step();
    } else if (m.type === 'release' && this.ls && m.n === this.ls.n) {
      this.plan = null;
      this.peek = null;
      try { this.ls.apply(m); } catch (e) { this.send({ type: 'foul', n: m.n, why: (e as Error).message }); return; }
      this.ls.b.ev.length = 0;
      this.step();
    } else if (m.type === 'peek' && this.ls && m.n === this.ls.n) {
      this.peek = m;
      this.step();
    } else if (m.type === 'end') { this.done = true; this.plan = null; }
  }

  /** Runs the copy to its next decision, reports it, and plans a choice when the decision waits on this side. */
  step(): void {
    const ls = this.ls!, need = ls.next();
    ls.b.ev.length = 0;
    if (this.reported < ls.n) { this.reported = ls.n; this.send({ type: 'ready', n: ls.n, hash: stateHash(ls.b), need }); }
    if (this.idle || !chooses(need, 0)) return;
    // A side that foresees chooses once the room shows it the other side's choice.
    if (need.kind === 'joint' && need.sees === 0 && !this.peek) return;
    const n = ls.n;
    this.later(() => { if (this.ls?.n === n) this.send({ type: 'choose', n, c: this.choice(need) }); });
  }

  /** The AI's choice for the decision in hand. It works on copies so that only the release touches the battle. */
  choice(need: Need): Choice {
    const b = this.ls!.b;
    if (need.kind === 'replace' || need.kind === 'replace2') return chooseReplacement(clone(b), 0);
    if (need.kind === 'visit') return chooseVisit(clone(b), 0);
    if (need.kind === 'joint' && need.sees === 0 && this.peek) {
      const theirs = this.peek.timeout ? passiveAction(b, 1) : (this.peek.c as Action);
      return answer(clone(b), 0, theirs);
    }
    return choose(clone(b), 0);
  }
}

/** A loopback room: the shared room rules with the AI in the first seat on side 0 and the person in the second, counting time in frames. */
export class Room {
  frame = 0;
  ai!: AiSeat;
  readonly rules: RoomRules;
  /** Messages on their way to each seat and the frame each one arrives on. */
  out: [{ at: number; m: FromRoom }[], { at: number; m: FromRoom }[]] = [[], []];

  constructor(readonly lag: [number, number], seed: number) {
    this.rules = new RoomRules(newRoom(seed, 0));
  }

  /** Every release so far in order. */
  get record(): Release[] { return this.rules.d.record; }
  get ended(): RoomData['ended'] { return this.rules.d.ended; }
  now(): number { return this.frame * 1000 / FPS; }

  post(o: Out): void {
    for (const { seat, m } of o) {
      // Each message goes through the reader a client uses on the real room's messages.
      const raw = JSON.stringify(m), read = readRoom(raw);
      if (!read) loopFaults.push(`the room sent seat ${seat} a message its reader refused: ${raw.slice(0, 200)}`);
      this.out[seat].push({ at: this.frame + this.lag[seat], m: read ?? wire(m) });
    }
  }

  take(seat: 0 | 1): FromRoom | null {
    const q = this.out[seat];
    return q.length && q[0].at <= this.frame ? q.shift()!.m : null;
  }

  tick(): void {
    this.frame++;
    for (let m = this.take(0); m; m = this.take(0)) this.ai.deliver(m);
    this.ai.tick();
    this.post(this.rules.tick(this.now()));
  }

  /** Takes a message the way the real room does: through the reader, which rebuilds it from the fields it checks. */
  receive(seat: 0 | 1, sent: ToRoom): void {
    const raw = JSON.stringify(sent), read = readClient(raw);
    if ('why' in read) { loopFaults.push(`seat ${seat} sent a message the room's reader refused because ${read.why}: ${raw.slice(0, 200)}`); return; }
    const m = read.m;
    if (m.type !== 'hello') { this.post(this.rules.receive(seat, m, this.now())); return; }
    if (!this.rules.d.seats[seat] && 'roster' in m) this.post(this.rules.join(seat, m, `loop${seat}`, this.now()));
  }

  /** A seat whose link closes is held for its player to come back, as in the real room. */
  leave(seat: 0 | 1): void { this.post(this.rules.leave(seat, this.now())); }
}

/** The person's end of a loopback room. Each tick moves the room, the AI, and every clock on by one frame. */
class SeatLink implements Link {
  constructor(readonly room: Room, readonly side: 0 | 1) {}
  send(m: ToRoom): void { this.room.receive(this.side, wire(m)); }
  poll(): FromRoom | null { return this.room.take(this.side); }
  tick(): void { this.room.tick(); }
  close(): void { this.room.leave(this.side); }
}

export interface LoopOptions {
  /** Frames each message from the room takes to reach the person. */
  lag?: number;
  /** The fewest and most frames the AI thinks before it picks or chooses. */
  think?: [number, number];
  /** Seeds the AI's roster and its thinking times. */
  seed?: number;
  /** The AI's roster in place of a random one. */
  roster?: WireMon[];
  name?: string;
  /** True for an AI that picks and then lets its clock run out at every decision. */
  idle?: boolean;
}

/** Opens a loopback room with the AI seated on side 0 and returns side 1's link. Sending `hello` starts the match. */
export function loopback(o: LoopOptions = {}): Link & { room: Room } {
  const seed = o.seed ?? Math.floor(Math.random() * 0x7fffffff);
  let s = seed || 1;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const room = new Room([0, o.lag ?? 4], seed);
  const roster = o.roster ?? aiRoster(rnd);
  room.ai = new AiSeat(room, roster, o.name ?? 'Echo', o.think ?? [40, 120], !!o.idle, rnd);
  room.receive(0, { type: 'hello', build: BUILD, name: room.ai.name, roster: wire(roster) });
  return new SeatLink(room, 1);
}
