import { BLANK, FIXED, OPEN } from './types';
import type { Action, Deal, Kind, Player, State } from './types';
import { RIVALS } from './data';
import { T } from './tuning';
import { rnd } from './rng';
import {
  charterKinds, claimProgress, counts, cy, dist, distances, filedClaim, hasPower, inTruce, neighbors, ownCounts, pcell, pegsPlaced, standing,
} from './board';
import { apply, clone, dealAffordable, emptyDeal, legal, objectCost } from './engine';

export interface Profile {
  name: string;
  width: number;
  depth: number;
  noise: number;
  parley: boolean;
  reacts: boolean;
}

export const PROFILES: Record<string, Profile> = {
  easy: { name: 'easy', width: 2, depth: 4, noise: 2.5, parley: true, reacts: true },
  normal: { name: 'normal', width: 4, depth: 6, noise: 0.8, parley: true, reacts: true },
  hard: { name: 'hard', width: 7, depth: 7, noise: 0, parley: true, reacts: true },
  novice: { name: 'novice', width: 1, depth: 2, noise: 2, parley: false, reacts: false },
  competent: { name: 'competent', width: 3, depth: 5, noise: 1, parley: false, reacts: true },
  expert: { name: 'expert', width: 7, depth: 7, noise: 0, parley: true, reacts: true },
};

const DIFF = ['easy', 'normal', 'hard'];

function profileOf(s: State, profiles: (Profile | null)[] | undefined, pi: number): Profile {
  return (profiles && profiles[pi]) || PROFILES[DIFF[s.difficulty] ?? 'normal'];
}

function grudge(s: State, a: number, b: number): boolean { return s.trust[a][b] <= T.grudge; }
function fond(s: State, a: number, b: number): boolean { return s.trust[a][b] >= T.fond; }

/** A pair signs one truce a sheet. */
export function hadTruce(s: State, a: number, b: number): boolean {
  for (const pr of s.promises) if (pr.type === 'truce' && ((pr.who === a && pr.to === b) || (pr.who === b && pr.to === a))) return true;
  return false;
}

function wrongedThisSeason(s: State, me: number, by: number): boolean {
  for (const e of s.ledger) if (e.season === s.season && e.a === me && e.b === by && e.d < 0) return true;
  return false;
}

function inkVal(s: State, p: Player): number {
  const left = s.rounds - s.round;
  let v = RIVALS[p.char].inkVal * (0.35 + 0.9 * Math.min(1, (left + 0.5) / 4));
  if (p.char !== 'either' && p.ink < 2) v *= 1.4;
  return v;
}

function doubtVal(s: State, p: Player): number {
  if (!s.flags.doubt) return 0;
  const left = s.rounds - s.round;
  let v = RIVALS[p.char].doubtVal * (0.3 + 0.7 * Math.min(1, (left + 0.5) / 4));
  const claim = filedClaim(p);
  if (claim === 'opencountry') v *= 1.6;
  return v;
}

function wantKind(s: State, p: Player, k: Kind): number {
  return (RIVALS[p.char].wants.includes(k) ? 1 : 0) + (charterKinds(s).includes(k) ? 1 : 0);
}

/** The utility of a state for one player. Personality enters as bounded terms on shared features. */
export function evaluate(s: State, pi: number): number {
  const p = s.players[pi];
  const R = RIVALS[p.char];
  const cnt = counts(s);
  const left = s.rounds - s.round;
  const f = Math.min(1, (left + 0.5) / 4);
  let u = 0;

  let bestOther = -1;
  for (const q of s.players) if (q.idx !== pi && cnt[q.idx] > bestOther && !(q.backs >= 0 && q.backs !== q.idx)) bestOther = cnt[q.idx];
  const backing = p.backs >= 0 && p.backs !== pi;
  if (p.filed && !backing) {
    u += 2 * cnt[pi];
  } else if (backing) {
    let rival = -1;
    for (const q of s.players) if (q.idx !== p.backs && q.idx !== pi && cnt[q.idx] > rival) rival = cnt[q.idx];
    u += 6 * (cnt[p.backs] - rival) + 3;
  } else {
    u += 10 * (cnt[pi] - bestOther) + 3 * cnt[pi];
    if (s.holder === pi) u += 2;
  }

  for (const q of s.players) {
    const id = filedClaim(q);
    if (!id) continue;
    const [have, need] = claimProgress(s, q, id);
    const prog = Math.min(1, have / need);
    if (q.idx === pi) u += backing ? 0 : prog >= 1 ? 45 : 30 * prog * prog;
    else u -= prog >= 1 ? 28 : 10 * prog * prog * prog;
  }
  if (p.claim && !p.filed && s.flags.claims) {
    const a = claimProgress(s, p, p.claim.a), b = claimProgress(s, p, p.claim.b);
    const prog = Math.max(a[0] / a[1], b[0] / b[1]);
    u += 5 * prog * prog;
  }

  const inkCap = 3 + 2 * left, doubtCap = p.char === 'either' ? 4 + 2 * left : 3 + left;
  u += (Math.min(p.ink, inkCap) + 0.2 * Math.max(0, p.ink - inkCap)) * inkVal(s, p);
  u += (Math.min(p.doubt, doubtCap) + 0.2 * Math.max(0, p.doubt - doubtCap)) * doubtVal(s, p);
  if (p.hidden === 'bookkeeper' && p.ink < 2) u -= 4;
  u += (p.ret.length ? 4 + p.ret.length * 3 : 0) * (0.3 + 0.7 * f);

  const here = pcell(p);
  const d = distances(s, here);
  const kinds = charterKinds(s);
  let o1 = 0, o2 = 0;
  for (let c = 0; c < s.tiles.length; c++) {
    if (d[c] > 5) continue;
    const t = s.tiles[c];
    let v = 0;
    if (t.st === OPEN && !t.den) {
      const match = kinds.includes(t.a) || kinds.includes(t.b);
      if (p.char === 'either') v = t.peg === -1 ? 3 : 0;
      else if (t.peg === -1 || t.peg === pi) v = (match ? 5 : 1.5) * (p.ink >= 2 ? 1 : 0.5);
    } else if (t.st === FIXED && t.peg === -1 && !t.official && p.char !== 'either') {
      v = t.k && kinds.includes(t.k) ? 5 : R.wants.includes(t.k!) ? 2.5 : 1;
      if (p.ink < 1) v *= 0.4;
    } else if (t.st === FIXED && t.k === 'well' && p.ink < 3 && p.char !== 'either') v = 2;
    if (t.den && t.site && s.flags.fights) v = Math.max(v, 2.5);
    if (t.peg >= 0 && t.peg !== pi && s.flags.fights && d[c] <= 3) {
      const o = s.players[t.peg];
      const cl = filedClaim(o);
      let hot = cnt[t.peg] > cnt[pi] && cnt[t.peg] >= bestOther ? 3 : 0;
      if (cl) { const pr = claimProgress(s, o, cl); if (pr[0] / pr[1] >= 0.6) hot = 5; }
      if (grudge(s, pi, t.peg)) hot += 1.5;
      if (hot > 0 && !inTruce(s, pi, t.peg) && !fond(s, pi, t.peg) && !(p.char === 'deed' && !p.whole && !wrongedThisSeason(s, pi, t.peg) && standing(s).winner !== t.peg)) v = Math.max(v, hot);
    }
    if (v <= 0) continue;
    v *= Math.pow(0.72, d[c]);
    if (v > o1) { o2 = o1; o1 = v; } else if (v > o2) o2 = v;
  }
  let room = 0;
  for (const n of neighbors(here)) if (s.tiles[n].st === BLANK) room++;
  u += (o1 + 0.6 * o2 + Math.min(2, room) * 0.5) * Math.min(1, (left + 1) / 3);

  let wantPegs = 0, openPegs = 0;
  for (let c = 0; c < s.tiles.length; c++) {
    const t = s.tiles[c];
    if (t.peg !== pi) continue;
    if (t.st === FIXED && R.wants.includes(t.k!)) wantPegs++;
    if (t.st === OPEN) openPegs++;
  }
  u += wantPegs * 1.2;
  if (R.wants.length) {
    let coveted = 0;
    for (const t of s.tiles) if (t.st === FIXED && t.peg >= 0 && t.peg !== pi && R.wants.includes(t.k!)) coveted++;
    u -= coveted * 1.5;
  }
  if (p.char === 'deed') u += pegsPlaced(p) * 0.6;
  if (p.char === 'either') {
    let open = 0, fixed = 0;
    for (const t of s.tiles) { if (t.st === OPEN) open++; else if (t.st === FIXED && !t.official) fixed++; }
    u += open * 0.5 - fixed * 0.3 + openPegs;
  }
  if (p.char === 'offset' && !p.whole && p.mark >= 0 && !backing) u += 6 * (cnt[pi] - cnt[p.mark]);
  for (const q of s.players) {
    if (q.idx === pi) continue;
    if (grudge(s, pi, q.idx)) u -= 1.5 * cnt[q.idx] + 0.25 * q.ink;
  }
  if (p.hidden === 'homebody') u -= 1.5 * Math.max(0, dist(here, p.sy * T.W + p.sx) - 3);
  for (const pr of s.promises) {
    if (pr.who !== pi) continue;
    if (pr.state === 'open' && pr.type === 'read') u -= 2;
    if (pr.state === 'broken') u -= 6 * R.honor;
  }
  return u;
}

// ------------------------------------------------------------------ reactions

function gainIfMeasured(s: State, k: Kind): number { return charterKinds(s).includes(k) ? 1 : 0; }

export function wantsObject(s: State, qi: number, m: number, c: number, k: Kind): boolean {
  const q = s.players[qi], mp = s.players[m];
  const t = s.tiles[c];
  const alt = k === t.a ? t.b : t.a;
  if (inTruce(s, qi, m) && (q.char === 'deed' || RIVALS[q.char].honor >= 0.5)) return false;
  if (fond(s, qi, m)) return false;
  const leader = standing(s).winner === m;
  let v = 6 * (gainIfMeasured(s, k) - gainIfMeasured(s, alt)) * (leader ? 1.3 : 0.7);
  v += wantKind(s, q, alt) - wantKind(s, q, k);
  if (grudge(s, qi, m)) v += 1.5;
  if (q.char === 'either' && leader) v += 2;
  if (mp.ink >= T.insistInk) v = Math.min(v, 1.6 + (grudge(s, qi, m) ? 1 : 0));
  const cost = objectCost(s, mp) * doubtVal(s, q) + 0.6;
  return v > cost;
}

function wantsInsist(s: State, pi: number, c: number, k: Kind): boolean {
  const p = s.players[pi];
  const t = s.tiles[c];
  const alt = k === t.a ? t.b : t.a;
  const gain = 6 * (gainIfMeasured(s, k) - gainIfMeasured(s, alt)) + wantKind(s, p, k) - wantKind(s, p, alt);
  return gain > T.insistInk * inkVal(s, p) + 0.5;
}

function relicReading(s: State, p: Player, id: string): number {
  switch (id) {
    case 'glass': return p.char === 'auger' ? 2 : 1;
    case 'spring': return 2;
    case 'match': return s.holder === p.idx ? 1 : 2;
    case 'bow': return 2;
    default: return 1;
  }
}

function steerValues(s: State, pi: number): number[] {
  const out: number[] = [];
  for (const d of [-1, 0, 1]) {
    const c = clone(s);
    c.pending = { t: 'steer', p: pi };
    apply(c, { t: 'steer', d });
    out.push(evaluate(c, pi));
  }
  return out;
}

// ------------------------------------------------------------------ deals

function reliability(s: State, pi: number, other: number): number {
  const o = s.players[other];
  let r = o.human ? 0.6 : RIVALS[o.char].honor;
  if (o.char === 'auger' && o.whole) r = 0.9;
  r += 0.08 * s.trust[pi][other];
  let broken = 0;
  for (const e of s.ledger) if (e.b === other && e.why === 'broke') broken++;
  r -= 0.25 * broken;
  const me = s.players[pi];
  if (me.char === 'auger' && !me.whole) r *= 0.4;
  if (me.traits.includes('wary')) r *= 0.3;
  return Math.max(0, Math.min(1, r));
}

function truceValue(s: State, pi: number, other: number, n: number): number {
  if (n <= 0) return 0;
  const p = s.players[pi], o = s.players[other];
  const cnt = counts(s);
  const lead = standing(s).winner;
  const near = dist(pcell(p), pcell(o)) <= 3;
  let threat = (near ? 1 : 0.35) * RIVALS[o.char].aggression * (grudge(s, other, pi) ? 1.6 : 1) * (lead === pi ? 1.5 : 1);
  if (o.char === 'deed' && !o.whole && !wrongedThisSeason(s, other, pi) && lead !== pi) threat *= 0.2;
  let opp = lead === other && lead !== pi && cnt[other] - cnt[pi] >= 1 ? 1.2 : 0.2;
  if (grudge(s, pi, other)) opp += 1.5 * RIVALS[p.char].aggression;
  if (p.char === 'offset' && !p.whole && p.mark === other) opp += 0.6;
  return n * (threat - opp) * 0.9;
}

function draftValue(s: State, p: Player, a: Kind, b: Kind): number {
  return 0.6 + 0.35 * Math.max(wantKind(s, p, a), wantKind(s, p, b)) + (p.hidden === 'collector' && (RIVALS[p.char].wants.includes(a) || RIVALS[p.char].wants.includes(b)) ? 1 : 0);
}

function hopeless(s: State, pi: number): boolean {
  const cnt = counts(s);
  const left = s.rounds - s.round;
  let best = 0;
  for (const q of s.players) if (q.idx !== pi) best = Math.max(best, cnt[q.idx]);
  const gap = best - cnt[pi];
  const p = s.players[pi];
  const id = filedClaim(p);
  if (id) { const [h, n] = claimProgress(s, p, id); if (h / n >= 0.75) return false; }
  return gap >= 2 && left <= 0;
}

/** What a deal is worth to one of its two parties, in the same units as `evaluate`. */
export function dealValue(s: State, pi: number, d: Deal): number {
  const p = s.players[pi];
  const meFrom = d.from === pi;
  const other = meFrom ? d.to : d.from;
  const g = meFrom ? 0 : 1, r = 1 - g;
  const iv = inkVal(s, p) * (p.char === 'auger' && !p.whole ? 1.25 : 1), dv = doubtVal(s, p);
  let v = (d.ink[r] - d.ink[g]) * iv + (d.doubt[r] - d.doubt[g]) * dv;
  const giver = meFrom ? p : s.players[other], taker = meFrom ? s.players[other] : p;
  if (d.draft[0] >= 0 && giver.hand[d.draft[0]]) { const dr = giver.hand[d.draft[0]]; v += (meFrom ? -1 : 1) * draftValue(s, p, dr.a, dr.b) - (meFrom ? 0.3 : 0); }
  if (d.draft[1] >= 0 && taker.hand[d.draft[1]]) { const dr = taker.hand[d.draft[1]]; v += (meFrom ? 1 : -1) * draftValue(s, p, dr.a, dr.b) - (meFrom ? 0 : 0.3); }
  if (d.truce > 0) v += truceValue(s, pi, other, p.char === 'either' || s.players[other].char === 'either' ? Math.min(d.truce, 2) : d.truce);
  if (d.read) {
    const promiser = d.read.who === 0 ? d.from : d.to;
    const t = s.tiles[d.read.c];
    const alt = d.read.k === t.a ? t.b : t.a;
    if (promiser === pi) {
      v -= Math.max(0, 6 * (gainIfMeasured(s, alt) - gainIfMeasured(s, d.read.k))) + 0.5 + (dist(pcell(p), d.read.c) > 3 ? 2.5 : 0);
      if (p.char === 'either') v -= 50;
    } else {
      v += (6 * (gainIfMeasured(s, alt) - gainIfMeasured(s, d.read.k)) + wantKind(s, p, d.read.k) - wantKind(s, p, alt)) * reliability(s, pi, other);
    }
  }
  if (d.leave) {
    const promiser = d.leave.who === 0 ? d.from : d.to;
    const t = s.tiles[d.leave.c];
    const match = t.st === OPEN && (charterKinds(s).includes(t.a) || charterKinds(s).includes(t.b));
    if (promiser === pi) v -= dist(pcell(p), d.leave.c) <= 2 && match && p.char !== 'either' ? 4 : 0.5;
    else v += (p.char === 'either' ? (t.st === OPEN ? 3 : 0) + (t.peg === pi ? 2 : 0) : match ? 3 : 0.6) * reliability(s, pi, other);
  }
  if (d.back >= 0) {
    const backer = d.back === 0 ? d.from : d.to;
    const own = ownCounts(s);
    if (backer === pi) v += hopeless(s, pi) ? 3 + 0.4 * s.trust[pi][other] : -40;
    else v += 10 * own[other] * reliability(s, pi, other);
  }
  return v;
}

export function dealMargin(s: State, pi: number, other: number, d: Deal): number {
  const p = s.players[pi];
  let m = RIVALS[p.char].margin - 0.25 * s.trust[pi][other];
  const lead = standing(s).winner;
  if (lead === other && p.backs !== other && d.back < 0) m += 1.2;
  if (grudge(s, pi, other)) m += p.char === 'auger' && !p.whole ? 1.5 : 3;
  if (p.traits.includes('proud') && pegsPlaced(s.players[other]) < pegsPlaced(p)) m += 2;
  if (p.hidden === 'soft') {
    const cnt = counts(s);
    if (cnt[other] <= Math.min(...cnt)) { m -= 1.2; p.hiddenShown = true; }
  }
  return m;
}

export interface Verdict { yes: boolean; value: number; margin: number; reason: string; yesVotes: number; short: number }

export function dealVerdict(s: State, pi: number, d: Deal): Verdict {
  const p = s.players[pi];
  const other = d.from === pi ? d.to : d.from;
  const value = dealValue(s, pi, d);
  const margin = dealMargin(s, pi, other, d);
  let yes = value >= margin && dealAffordable(s, d);
  if (p.char === 'deed' && d.read && (d.read.who === 0 ? d.from : d.to) === pi && dist(pcell(p), d.read.c) > 4) yes = false;
  let reason = yes ? 'accept' : 'refuse';
  const g = d.from === pi ? 1 : 0;
  if (!yes) {
    if (p.char === 'either' && d.ink[g] > 0 && d.doubt[g] === 0 && d.draft[g] < 0 && !d.truce && !d.leave && !d.read && d.back < 0) reason = 'noink';
    else if (grudge(s, pi, other)) reason = 'grudge';
    else if (standing(s).winner === other && value >= margin - 1.2) reason = 'leader';
  }
  let votes = Math.max(0, Math.min(9, Math.round(4.5 + (value - margin) * 1.5)));
  if (yes && votes < 5) votes = 5;
  if (!yes && votes > 4) votes = 4;
  if (p.char === 'lot' && p.whole) votes = yes ? 9 : 0;
  const short = Math.max(1, Math.ceil((margin - value) / Math.max(0.4, inkVal(s, p))));
  return { yes, value, margin, reason, yesVotes: votes, short };
}

/** Deals that `pi` would put to `to`, best first. Used on the rival's own turn and when a human asks what it wants. */
export function offersFrom(s: State, pi: number, to: number): Deal[] {
  const p = s.players[pi], o = s.players[to];
  const out: { d: Deal; v: number }[] = [];
  const consider = (d: Deal) => {
    if (!dealAffordable(s, d)) return;
    const mine = dealValue(s, pi, d);
    let theirs = dealValue(s, to, d);
    const need = o.human ? 0.2 : dealMargin(s, to, pi, d);
    if (theirs < need && p.char !== 'either') {
      const add = Math.ceil((need - theirs) / Math.max(0.4, inkVal(s, o)));
      if (add <= 3 && p.ink - d.ink[0] >= add) { d.ink[0] += add; theirs = dealValue(s, to, d); }
    }
    const v = dealValue(s, pi, d);
    if (v >= 0.3 && theirs >= need && mine >= 0.3) out.push({ d, v });
  };
  if (s.flags.promises && !hadTruce(s, pi, to) && truceValue(s, pi, to, 1) > 0.5 && !(p.char === 'offset' && !p.whole && p.mark === to)) {
    const d = emptyDeal(pi, to);
    d.truce = p.char === 'either' ? 1 : 2;
    consider(d);
  }
  if (s.flags.trades && s.flags.doubt) {
    if (p.doubt >= 2 && doubtVal(s, p) < doubtVal(s, o) && p.char !== 'either') {
      const d = emptyDeal(pi, to);
      d.doubt[0] = 2;
      d.ink[1] = o.char === 'either' ? 0 : 1;
      if (o.char === 'either' && o.hand.length) d.draft[1] = 0;
      consider(d);
    }
    if (p.ink >= 2 && o.doubt >= 2 && doubtVal(s, p) > doubtVal(s, o) + 0.2) {
      const d = emptyDeal(pi, to);
      d.ink[0] = 1;
      d.doubt[1] = 2;
      consider(d);
    }
  }
  if (s.flags.promises) {
    const kinds = charterKinds(s);
    for (const c of [pcell(o), ...neighbors(pcell(o))]) {
      const t = s.tiles[c];
      if (t.st !== OPEN || t.den || t.site) continue;
      if (p.char === 'either') {
        if (p.doubt >= 1) { const d = emptyDeal(pi, to); d.leave = { who: 1, c }; d.doubt[0] = 1; consider(d); }
        continue;
      }
      const ma = kinds.includes(t.a), mb = kinds.includes(t.b);
      if (ma !== mb && o.char !== 'either' && p.ink >= 1) {
        const d = emptyDeal(pi, to);
        d.read = { who: 1, c, k: ma ? t.b : t.a };
        d.ink[0] = 1;
        consider(d);
      }
      break;
    }
  }
  if (s.flags.backing && s.round > s.rounds - T.backFromLast && p.backs < 0 && o.backs < 0) {
    const st = standing(s);
    const cnt = counts(s);
    const sorted = cnt.slice().sort((a, b) => b - a);
    if (hopeless(s, to) && cnt[pi] >= sorted[1] && st.winner !== to) {
      const d = emptyDeal(pi, to);
      d.back = 1;
      d.ink[0] = Math.min(p.ink, p.char === 'either' ? 0 : 2);
      if (p.char === 'either') d.doubt[0] = Math.min(p.doubt, 2);
      consider(d);
    }
    if (hopeless(s, pi) && cnt[to] >= sorted[1] && !grudge(s, pi, to)) {
      const d = emptyDeal(pi, to);
      d.back = 0;
      if (p.char === 'auger' && !p.whole) d.ink[1] = Math.min(o.ink, 2);
      consider(d);
    }
  }
  out.sort((a, b) => b.v - a.v);
  return out.map((x) => x.d);
}

function parley(s: State, p: Player, prof: Profile): Action | null {
  if (!prof.parley || !s.flags.trades) return null;
  const key = 'par' + p.idx;
  const used = s.scripted[key] === s.round * 100 + s.turn ? s.scripted[key + 'n'] ?? 0 : 0;
  const cap = p.char === 'auger' ? 2 : 1;
  if (s.flags.backing && s.round > s.rounds - T.backFromLast && p.backs < 0 && hopeless(s, p.idx) && !s.scripted['bk' + p.idx]) {
    s.scripted['bk' + p.idx] = 1;
    const cnt = counts(s);
    let best = -1, bv = -1e9;
    for (const q of s.players) {
      if (q.idx === p.idx || q.backs >= 0) continue;
      if (p.char === 'offset' && !p.whole && q.idx === p.mark && !fond(s, p.idx, q.idx)) continue;
      const lead = standing(s).winner;
      let v = s.trust[p.idx][q.idx] * 1.5 - 4 - (grudge(s, p.idx, q.idx) ? 20 : 0);
      if (lead !== q.idx && lead !== p.idx && grudge(s, p.idx, lead)) v += 4 + cnt[q.idx] * 0.5;
      if (v > bv) { bv = v; best = q.idx; }
    }
    if (best >= 0 && bv > 0.5) return { t: 'back', who: best };
  }
  if (p.char === 'deed' && p.whole && p.ink >= 5 && !s.scripted['dg' + s.round]) {
    const friend = s.players.find((q) => q.idx !== p.idx && fond(s, p.idx, q.idx) && q.ink < 3);
    if (friend) { s.scripted['dg' + s.round] = 1; return { t: 'gift', to: friend.idx, ink: 2, doubt: 0 }; }
  }
  if (used >= cap || p.proposals <= 0) return null;
  let best: Deal | null = null, bv = 0.3;
  for (const q of s.players) {
    if (q.idx === p.idx) continue;
    const tag = 'pr' + p.idx + '_' + q.idx;
    if (s.scripted[tag] === s.round) continue;
    const offers = offersFrom(s, p.idx, q.idx);
    if (!offers.length) continue;
    const v = dealValue(s, p.idx, offers[0]);
    if (v > bv) { bv = v; best = offers[0]; }
  }
  if (!best) return null;
  s.scripted['pr' + p.idx + '_' + best.to] = s.round;
  s.scripted[key] = s.round * 100 + s.turn;
  s.scripted[key + 'n'] = used + 1;
  return { t: 'propose', deal: best };
}

// ------------------------------------------------------------------ turn planning

function allowed(s: State, p: Player, a: Action): boolean {
  switch (a.t) {
    case 'back': case 'blur': case 'end': case 'file': return false;
    case 'measure': {
      if (p.char === 'either') return false;
      for (const pr of s.promises) {
        if (pr.state !== 'open' || pr.who !== p.idx || pr.c !== a.c) continue;
        if (pr.type === 'leave' && RIVALS[p.char].honor >= 0.5) return false;
        if (pr.type === 'read' && pr.k !== a.k && RIVALS[p.char].honor >= 0.5) return false;
      }
      return true;
    }
    case 'peg': {
      if (p.char === 'either' && s.tiles[a.c].st !== OPEN) return false;
      for (const pr of s.promises) if (pr.state === 'open' && pr.who === p.idx && pr.c === a.c && pr.type === 'leave' && RIVALS[p.char].honor >= 0.5) return false;
      return true;
    }
    case 'contest': {
      if (a.target === 'den') return true;
      const lead = standing(s).winner;
      if (inTruce(s, p.idx, a.who)) {
        if (p.char === 'auger' && !p.whole) return true;
        if (p.char === 'offset' && !p.whole) return a.who === p.mark || lead === a.who;
        return false;
      }
      if (fond(s, p.idx, a.who) && !wrongedThisSeason(s, p.idx, a.who)) return false;
      if (p.traits.includes('fond') && s.players[a.who].human && !wrongedThisSeason(s, p.idx, a.who)) return false;
      if (p.char === 'deed' && !p.whole) return lead === a.who || wrongedThisSeason(s, p.idx, a.who);
      return true;
    }
    case 'unmeasure': {
      const t = s.tiles[a.c];
      if (p.char === 'either') return t.peg !== p.idx;
      return t.peg >= 0 && t.peg !== p.idx && !inTruce(s, p.idx, t.peg);
    }
    default: return true;
  }
}

/** Applies an action in a search clone and settles every nested decision with the same heuristics the rivals use. */
function settle(c: State, a: Action, pi: number): void {
  apply(c, a);
  for (let i = 0; i < 12; i++) {
    const pd = c.pending;
    if (c.over || (pd.t === 'turn' && pd.p === pi) || pd.t === 'done') return;
    if (pd.t === 'object') apply(c, { t: 'object', yes: wantsObject(c, pd.p, pd.m, pd.c, pd.k) });
    else if (pd.t === 'insist') apply(c, { t: 'insist', yes: wantsInsist(c, pd.p, pd.c, pd.k) });
    else if (pd.t === 'relic') apply(c, { t: 'relic', r: relicReading(c, c.players[pd.p], pd.id) });
    else return;
  }
}

interface Node { st: State; acts: Action[]; u: number; stop: boolean; last: number; prev: number }

export function planTurn(s: State, pi: number, prof: Profile): Action[] {
  const root = clone(s);
  const base = evaluate(root, pi);
  let beam: Node[] = [{ st: root, acts: [], u: base, stop: false, last: pcell(root.players[pi]), prev: -1 }];
  let best = beam[0];
  for (let depth = 0; depth < prof.depth; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      if (node.stop) continue;
      const p = node.st.players[pi];
      for (const a of legal(node.st)) {
        if (!allowed(node.st, p, a)) continue;
        const from = pcell(p);
        const c = clone(node.st);
        settle(c, a, pi);
        const np = c.players[pi];
        const to = pcell(np);
        if (a.t === 'move' && to === node.prev) continue;
        let u = evaluate(c, pi);
        if (a.t === 'contest' && a.target !== 'den') {
          if (inTruce(s, pi, a.who)) u -= np.char === 'auger' ? 1.5 : 3;
          u -= 1.5 / (RIVALS[np.char].aggression * (np.traits.includes('hungry') ? 2 : 1));
        }
        if (np.char === 'offset' && !np.whole && np.mark >= 0 && s.players[np.mark].lastAct === a.t) u += 0.8;
        if (prof.noise) u += (rnd(s) - 0.5) * prof.noise;
        next.push({ st: c, acts: node.acts.concat([a]), u, stop: a.t === 'contest' || c.over, last: to, prev: a.t === 'move' ? from : -1 });
      }
    }
    if (!next.length) break;
    next.sort((x, y) => y.u - x.u);
    beam = next.slice(0, prof.width);
    if (beam[0].u > best.u + 1e-6) best = beam[0];
  }
  return best.acts;
}

interface Cache { s: State | null; key: string; acts: Action[] }
const cache: Cache = { s: null, key: '', acts: [] };

function same(a: Action, b: Action): boolean { return JSON.stringify(a) === JSON.stringify(b); }

function wantsFile(s: State, p: Player): number {
  if (!s.flags.claims || !p.claim || p.filed || p.steps < T.fileSteps) return 0;
  const a = claimProgress(s, p, p.claim.a), b = claimProgress(s, p, p.claim.b);
  const pa = a[0] / a[1], pb = b[0] / b[1];
  const best = Math.max(pa, pb);
  const left = s.rounds - s.round;
  if (s.round > s.rounds - T.fileBefore) return 0;
  const last = s.round === s.rounds - T.fileBefore;
  const need = p.hidden === 'gambler' ? 0.45 : last ? 0.6 : 0.75;
  if (best < need) return 0;
  const cnt = counts(s);
  let top = 0;
  for (const q of s.players) if (q.idx !== p.idx) top = Math.max(top, cnt[q.idx]);
  const leading = cnt[p.idx] >= top + (s.holder === p.idx ? 0 : 0.5);
  if (leading && p.hidden !== 'gambler') return 0;
  if (p.hidden === 'gambler') p.hiddenShown = true;
  return pa >= pb ? 1 : 2;
}

function setActives(s: State, p: Player): Action | null {
  for (let i = 0; i < p.ret.length; i++) {
    const c = p.ret[i];
    if (c.fixed !== 0 || c.half) continue;
    const want = s.round % 2 === 1 ? 1 : 2;
    if (c.active !== want && s.scripted['act' + p.idx + '_' + i] !== s.round) {
      s.scripted['act' + p.idx + '_' + i] = s.round;
      return { t: 'active', i, r: want };
    }
  }
  return null;
}

/** Picks the acting computer player's next action for whatever decision is pending. */
export function decide(s: State, profiles?: (Profile | null)[]): Action {
  const pd = s.pending;
  const prof = profileOf(s, profiles, pd.p);
  const p = s.players[pd.p];
  switch (pd.t) {
    case 'object': return { t: 'object', yes: prof.reacts && wantsObject(s, pd.p, pd.m, pd.c, pd.k) };
    case 'insist': return { t: 'insist', yes: prof.reacts ? wantsInsist(s, pd.p, pd.c, pd.k) : true };
    case 'deal': return { t: 'answer', yes: prof.parley ? dealVerdict(s, pd.p, pd.deal).yes : dealValue(s, pd.p, pd.deal) > 1 };
    case 'relic': return { t: 'relic', r: relicReading(s, p, pd.id) };
    case 'bid': {
      if (!prof.reacts) return { t: 'bid', n: 0 };
      const v = steerValues(s, pd.p);
      const spread = Math.max(...v) - Math.min(...v);
      const cap = p.hidden === 'bookkeeper' ? p.ink - 2 : p.ink - 1;
      return { t: 'bid', n: Math.max(0, Math.min(3, cap, Math.floor(spread / 3.5))) };
    }
    case 'steer': {
      const v = steerValues(s, pd.p);
      let d = 1;
      if (v[0] >= v[1] && v[0] >= v[2]) d = 0;
      if (v[1] > v[0] && v[1] >= v[2]) d = 1;
      if (v[2] > v[0] && v[2] > v[1]) d = 2;
      return { t: 'steer', d: d - 1 };
    }
    case 'turn': break;
    default: throw new Error('nothing to decide: ' + pd.t);
  }
  const key = s.season + ':' + s.round + ':' + s.turn + ':' + p.idx;
  const tick = s.round * 100 + s.turn;
  if (s.scripted.aiTick !== tick) { s.scripted.aiTick = tick; s.scripted.aiActs = 0; }
  s.scripted.aiActs = (s.scripted.aiActs ?? 0) + 1;
  if (s.scripted.aiActs > 18) return { t: 'end' };
  if (cache.s !== s || cache.key !== key) {
    const act = setActives(s, p);
    if (act) return act;
    const talk = parley(s, p, prof);
    if (talk) return talk;
    const r = wantsFile(s, p);
    if (r) return { t: 'file', r };
    cache.s = s;
    cache.key = key;
    cache.acts = planTurn(s, p.idx, prof);
    const first = cache.acts.find((a) => a.t !== 'move');
    p.intent = first ? first.t : cache.acts.length ? 'move' : 'end';
  }
  while (cache.acts.length) {
    const a = cache.acts.shift()!;
    if (legal(s).some((x) => same(x, a))) return a;
    cache.acts = planTurn(s, p.idx, prof);
    if (!cache.acts.length) break;
    const again = cache.acts.shift()!;
    if (legal(s).some((x) => same(x, again))) return again;
    cache.acts = [];
  }
  if (p.steps >= 1) {
    const more = planTurn(s, p.idx, prof);
    if (more.length && legal(s).some((x) => same(x, more[0]))) { cache.acts = more.slice(1); return more[0]; }
  }
  const free = legal(s).find((a) => a.t === 'peg' && s.scripted.freePeg === a.c);
  if (free) return free;
  return { t: 'end' };
}

/** Runs computer players until a human must decide or the sheet closes. */
export function runAI(s: State, profiles?: (Profile | null)[], limit = 5000): void {
  for (let i = 0; i < limit && !s.over; i++) {
    const pd = s.pending;
    if (pd.t === 'done') return;
    if (pd.p >= 0 && s.players[pd.p].human) return;
    apply(s, decide(s, profiles));
  }
}

export function cy0(c: number): number { return cy(c); }
export { hasPower };
