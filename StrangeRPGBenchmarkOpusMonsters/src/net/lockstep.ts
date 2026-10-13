// Lockstep online play: both clients run the same battle from the same released choices, and a hash at every decision
// shows that they still agree. The room relays and times choices and never runs the engine (Notes/online-design.md).
import { act, actJoint, advance, foresees, legal, legalMatch, newBattle, passiveVisit, replace, replaceChoices, standing, visit, visitMatch } from '../battle/engine';
import { resetAiCaches } from '../battle/ai';
import type { Action, Battle, Decision, Rules } from '../battle/model';
import { DEFAULT_PICK, monFromWire, pickedTeam, pickProblems, type WireMon } from './wire';
import { shownPlayerName } from './names';
import { sameNeed, type Need, type PickRelease, type Release } from './protocol';

export {
  CHOICE_SECONDS, chooses, HOLD_SECONDS, NETWORK_GRACE_SECONDS, PICK_SECONDS, PROTOCOL, REPLACE_SECONDS, sameNeed, TIMEOUTS_TO_LOSE,
  type Choice, type Need, type PickRelease, type Release,
} from './protocol';

declare const __WHORL_BUILD__: string;

/** This build's fingerprint from scripts/build.mjs: a hash of src/battle, src/data, src/net, and the fit code. */
export const BUILD = typeof __WHORL_BUILD__ === 'string' ? __WHORL_BUILD__ : 'dev';

/** The rules every online battle uses with nothing from either player's save or options. */
export function onlineRules(): Rules {
  return { nerve: true, wild: false, sync: true, canRun: false };
}

/** A release this copy refused because `side` chose something it could not or because the release does not fit the battle (`side` null). */
export class Foul extends Error {
  constructor(readonly side: 0 | 1 | null, message: string) { super(message); }
}

/** The two fours a pick release names after checking each pick against its own roster, with a timed-out side on its first four. */
export function teamsFromPicks(rosters: [WireMon[], WireMon[]], rel: PickRelease): [WireMon[], WireMon[]] {
  const team = (side: 0 | 1): WireMon[] => {
    const pick = rel?.timeout?.[side] ? DEFAULT_PICK : rel?.picks?.[side];
    const bad = pickProblems(pick, rosters[side].length);
    if (bad.length) throw new Foul(side, `side ${side} picked ${JSON.stringify(pick)}: ${bad.join(' ')}`);
    return pickedTeam(rosters[side], pick as number[]);
  };
  return [team(0), team(1)];
}

const SKIP = new Set(['ev', 'past', 'lanes', 'quiet', 'view', 'sprite']);

/** FNV-1a over the battle as JSON without its events, rewind history, screen fields, and sprites. */
export function stateHash(b: Battle): string {
  const s = JSON.stringify(b, (k, v) => (SKIP.has(k) ? undefined : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The action a side takes when its time runs out: the first legal one of Guard, the plain Attack, and anything but Measure. */
export function passiveAction(b: Battle, side: 0 | 1): Action {
  const ls = legal(b, side);
  return ls.find(a => a.k === 'guard') ?? ls.find(a => a.k === 'attack' && !a.aim) ?? ls.find(a => a.k !== 'wait') ?? { k: 'attack' };
}

/** The whorl a side sends out when its time runs out: the called one or else the first that may come out. */
export function passiveReplace(b: Battle, side: 0 | 1): number {
  return replaceChoices(b, side)[0] ?? -1;
}

const down = (b: Battle, side: 0 | 1): boolean => {
  const s = b.s[side], o = s.f[s.out];
  return (o.ko || o.gone) && standing(s).length > 0;
};

/** One client's copy of an online battle that both clients build from the same teams and names. */
export class Lockstep {
  readonly b: Battle;
  /** Decisions applied so far and so the number of the next one. */
  n = 0;
  /** Side 1's blind pick from a double replacement until the engine asks side 1 for it. */
  private held: number | null = null;

  constructor(teams: [WireMon[], WireMon[]], names: [string, string], view: 0 | 1) {
    resetAiCaches();
    // Both copies show the same stand-in for a name the word filter refuses, so the two battles stay the same.
    this.b = newBattle(
      { mons: teams[0].map((w, i) => monFromWire(w, 0, i)), name: shownPlayerName(names[0]), ai: 'keeper', charm: null },
      { mons: teams[1].map((w, i) => monFromWire(w, 1, i)), name: shownPlayerName(names[1]), ai: 'keeper', charm: null },
      onlineRules(),
    );
    this.b.view = view;
  }

  /** Runs the battle to its next decision and describes it without changing a battle already at one. */
  next(): Need {
    const d = advance(this.b, (_, side) => this.takeHeld(side));
    // A pick the engine did not ask for before this decision belongs to a knockout that is over.
    if (this.held !== null && !(d.kind === 'replace' && d.side === 0)) this.held = null;
    return this.needOf(d);
  }

  /** Applies a release after checking it against this copy and throws a Foul when the release does not fit or a choice is not legal. */
  apply(rel: Release): void {
    const need = this.next(), b = this.b;
    if (!rel || rel.n !== this.n || !sameNeed(need, rel.need)) throw new Foul(null, `release ${rel?.n} does not match decision ${this.n} (${JSON.stringify(need)})`);
    if (need.kind === 'joint') {
      const a0 = this.action(0, rel), a1 = this.action(1, rel);
      actJoint(b, a0, a1);
    } else if (need.kind === 'act') act(b, this.action(need.side, rel));
    else if (need.kind === 'visit') visit(b, this.visitChoice(need.side, rel));
    else if (need.kind === 'replace') replace(b, need.side, this.index(need.side, rel));
    else if (need.kind === 'replace2') {
      const i0 = this.index(0, rel), i1 = this.index(1, rel);
      replace(b, 0, i0);
      this.held = i1;
    } else throw new Foul(null, 'the battle is over');
    this.n++;
  }

  private needOf(d: Decision): Need {
    const b = this.b;
    if (d.kind === 'over') return { kind: 'over', winner: d.winner === 0 || d.winner === 1 ? d.winner : null, stalled: !!b.stalled };
    if (d.kind === 'joint') return { kind: 'joint', sees: foresees(b, 0) ? 0 : foresees(b, 1) ? 1 : null };
    if (d.kind === 'act') return { kind: 'act', side: d.side };
    if (d.kind === 'visit') return { kind: 'visit', side: d.side };
    // advance asks side 0 to replace first, so both pick blind when both are down, or side 1 would see side 0's pick.
    if (d.side === 0 && this.held === null && down(b, 1)) return { kind: 'replace2' };
    return { kind: 'replace', side: d.side };
  }

  private takeHeld(side: 0 | 1): number {
    if (side !== 1 || this.held === null) return -1;
    const pick = this.held;
    this.held = null;
    // advance calls back until it gets a pick replace() takes, so an unusable pick must become a fresh decision.
    return replaceChoices(this.b, 1).includes(pick) ? pick : -1;
  }

  private action(side: 0 | 1, rel: Release): Action {
    if (rel.timeout?.[side]) return passiveAction(this.b, side);
    const a = legalMatch(this.b, side, rel.c?.[side] as Action);
    if (!a) throw new Foul(side, `side ${side} cannot choose ${JSON.stringify(rel.c?.[side])} at decision ${this.n}`);
    return a;
  }

  /** The move a whorl back in time casts there: its side's choice, or its first one when its time ran out. */
  private visitChoice(side: 0 | 1, rel: Release): Action {
    if (rel.timeout?.[side]) return passiveVisit(this.b);
    const a = visitMatch(this.b, rel.c?.[side] as Action);
    if (!a) throw new Foul(side, `side ${side} cannot cast ${JSON.stringify(rel.c?.[side])} in the past at decision ${this.n}`);
    return a;
  }

  private index(side: 0 | 1, rel: Release): number {
    if (rel.timeout?.[side]) return passiveReplace(this.b, side);
    const i = rel.c?.[side];
    if (typeof i !== 'number' || !replaceChoices(this.b, side).includes(i)) throw new Foul(side, `side ${side} cannot send out ${JSON.stringify(i)} at decision ${this.n}`);
    return i;
  }
}

/** Builds a copy from both rosters and the released picks and replays every release in the record the way a page does after a reload. */
export function rebuild(rosters: [WireMon[], WireMon[]], names: [string, string], view: 0 | 1, picks: PickRelease, record: Release[]): Lockstep {
  const ls = new Lockstep(teamsFromPicks(rosters, picks), names, view);
  for (const rel of record) { ls.apply(rel); ls.b.ev.length = 0; }
  ls.next();
  return ls;
}
