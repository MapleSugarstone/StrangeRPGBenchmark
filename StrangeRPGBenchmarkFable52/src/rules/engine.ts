import { BLANK, FIXED, OPEN } from './types';
import type { Action, AmendId, CharId, Charter, Companion, Deal, Draft, Flags, Kind, Law, Player, PromiseRec, RelicHeld, State, Tile } from './types';
import { CLAIM_CARDS, CREATURES, HALVES, KINDS, RIVALS, SITES } from './data';
import { T } from './tuning';
import { rint, rnd, shuffle } from './rng';
import {
  DIRS, actCells, blankTile, cellOf, charterKinds, charterRank, counts, cx, cy, dist, emit, hasPower, hasRelic, inTruce, inside,
  localDef, neighbors, pcell, pegsOf, sketchCells, standing,
} from './board';
import { batAct, foeDef, startBattle } from './battle';

export interface SeatSpec {
  char: CharId;
  human: boolean;
  ink?: number;
  doubt?: number;
  ret?: Companion[];
  relics?: RelicHeld[];
  perks?: string[];
  traits?: string[];
  hidden?: string | null;
  hiddenShown?: boolean;
  whole?: boolean;
  canBlur?: boolean;
  usedPage?: boolean;
}

export interface SeasonOpts {
  seed: number;
  season: number;
  seats: SeatSpec[];
  holder: number;
  charter: Charter;
  law: Law;
  joinRow?: Tile[] | null;
  struckPile?: Record<Kind, number> | null;
  deck: string[];
  trust?: number[][] | null;
  flags?: Partial<Flags>;
  rounds?: number;
  difficulty?: number;
  levelNorth?: boolean;
  site?: boolean;
  halvesHere?: string[];
}

export function flagsFor(season: number): Flags {
  return {
    doubt: season >= 2, locals: season >= 2, fights: season >= 2, trades: season >= 2,
    promises: season >= 3, claims: season >= 3, backing: season >= 3,
    objection: season >= 4, unmeasure: season >= 4, level: season === 5, amend: season >= 6,
  };
}

const START_X: number[][] = [[], [3], [2, 4], [1, 3, 5], [0, 2, 4, 6]];
const OFFICIAL_ROW: Kind[] = ['road', 'well', 'road', 'town', 'road', 'peak', 'road'];

function newStats() {
  return { measures: 0, sketches: 0, pegs: 0, works: 0, contests: 0, contestsWon: 0, dealsMade: 0, dealsRefused: 0, promisesKept: 0, promisesBroken: 0, objections: 0, unmeasures: 0, actions: {} as Record<string, number> };
}

function makeDraft(s: { rng: number }, struck: Record<Kind, number> | null, dens: boolean, weighted: boolean): Draft {
  const pairs: [Kind, Kind][] = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) pairs.push([KINDS[i], KINDS[j]]);
  let pair = pairs[rint(s, pairs.length)];
  if (weighted && struck) {
    const w = pairs.map(([a, b]) => 1 + struck[a] + struck[b]);
    let r = rnd(s) * w.reduce((x, y) => x + y, 0);
    for (let i = 0; i < pairs.length; i++) { r -= w[i]; if (r <= 0) { pair = pairs[i]; break; } }
  }
  const flip = rnd(s) < 0.5;
  const den = dens && rnd(s) < T.denRate ? CREATURES[rint(s, CREATURES.length)].id : null;
  return { a: flip ? pair[1] : pair[0], b: flip ? pair[0] : pair[1], den };
}

function buildPile(s: State, struck: Record<Kind, number> | null): Draft[] {
  const out: Draft[] = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) for (let n = 0; n < 3; n++) {
    const d = makeDraft(s, null, s.flags.fights, false);
    d.a = KINDS[i];
    d.b = KINDS[j];
    if (rnd(s) < 0.5) { d.a = KINDS[j]; d.b = KINDS[i]; }
    out.push(d);
  }
  for (let n = 0; n < 18; n++) out.push(makeDraft(s, struck, s.flags.fights, true));
  return shuffle(s, out);
}

function drawDraft(s: State): Draft {
  if (s.quiet) return makeDraft(s, null, false, false);
  if (!s.pile.length) s.pile = buildPile(s, s.struck);
  return s.pile.pop()!;
}

function drawLocal(s: State): string | null {
  if (!s.deck.length) return null;
  if (s.quiet) return s.deck[rint(s, s.deck.length)];
  return s.deck.pop()!;
}

export function newSeason(o: SeasonOpts): State {
  const n = o.seats.length;
  const flags = { ...flagsFor(o.season), ...(o.flags ?? {}) };
  const s: State = {
    rng: o.seed | 0, season: o.season, round: 1, rounds: o.rounds ?? T.rounds[o.season] ?? 7, turn: 0, order: [],
    W: T.W, H: T.H, tiles: [], players: [], holder: o.holder, charter: o.charter, law: o.law, amend: [],
    pile: [], deck: [], halves: {}, trust: o.trust ? o.trust.map((r) => r.slice()) : [], ledger: [], promises: [], nextPromise: 1,
    pending: { t: 'done', p: -1 }, battle: null, events: [], quiet: false,
    struck: { road: 0, well: 0, town: 0, peak: 0 }, flags, level: null, quarry: false, fileCount: 0, dealLog: [],
    lead: -1, leadChanges: 0, over: false, result: null, difficulty: o.difficulty ?? 1, scripted: { freePeg: -1 }, lost: [],
  };
  for (let i = 0; i < T.W * T.H; i++) s.tiles.push(blankTile());
  if (!o.trust) for (let i = 0; i < n; i++) s.trust.push(new Array(n).fill(0));

  for (let x = 0; x < T.W; x++) {
    const c = cellOf(x, T.H - 1);
    if (o.joinRow && o.joinRow[x]) s.tiles[c] = { ...o.joinRow[x], offer: null, den: null, denHp: 0, site: null };
    else s.tiles[c] = { ...blankTile(), st: FIXED, a: OFFICIAL_ROW[x], b: OFFICIAL_ROW[x], k: OFFICIAL_ROW[x], official: true };
  }

  o.seats.forEach((seat, i) => {
    const x = START_X[n][i];
    const p: Player = {
      idx: i, char: seat.char, human: seat.human, x, y: T.H - 1, sx: x, sy: T.H - 1,
      ink: seat.ink ?? T.startInk, doubt: seat.doubt ?? T.startDoubt, steps: 0, hand: [], pegs: T.pegs,
      ret: (seat.ret ?? []).map((c) => ({ ...c, down: false })), cap: T.retinue, claim: null, filed: 0, filedOrder: 0, backs: -1, worked: [],
      relics: (seat.relics ?? []).slice(), perks: (seat.perks ?? []).slice(), traits: (seat.traits ?? []).slice(),
      hidden: seat.hidden ?? null, hiddenShown: seat.hiddenShown ?? false, whole: seat.whole ?? false, mark: -1, lastAct: '', proposals: 0,
      usedFreeMove: false, usedFreeSketch: false, usedFreeMeasure: false, usedDraft: false, usedPage: seat.usedPage ?? false,
      amended: false, startedContest: false, brokePromise: false, canBlur: seat.canBlur ?? false, intent: '', stats: newStats(),
    };
    if (hasRelic(p, 'glass', 2)) p.ink += 2;
    if (p.perks.includes('inkhorn')) p.ink += 3;
    if (hasRelic(p, 'table', 1)) p.cap += 1;
    if (p.ret.some((c) => c.id === 'roost')) p.cap += 1;
    for (const pl of s.players) if (pl.char === seat.char) throw new Error('duplicate seat ' + seat.char);
    s.players.push(p);
  });
  for (const p of s.players) {
    if (p.char === 'either') p.ink = 0;
    const tile = s.tiles[pcell(p)];
    if (tile.st === BLANK) { tile.st = FIXED; tile.a = tile.b = tile.k = 'road'; tile.official = true; }
  }
  const human = s.players.find((p) => p.human);
  for (const p of s.players) {
    if (p.char !== 'offset') continue;
    p.mark = human && human.idx !== p.idx ? human.idx : (p.idx + 1) % n;
  }

  s.pile = buildPile(s, o.struckPile ?? null);
  for (let x = 0; x < T.W; x++) {
    const t = s.tiles[cellOf(x, T.H - 1)];
    if (t.st === BLANK) { const d = drawDraft(s); t.st = OPEN; t.a = d.a; t.b = d.b; }
  }
  if (o.season === 1) {
    for (const p of s.players) {
      const t = s.tiles[cellOf(p.x, p.y - 1)];
      t.st = OPEN;
      if (p.human) { t.a = 'town'; t.b = 'well'; } else { t.a = 'road'; t.b = 'peak'; }
    }
  }
  const site = SITES.find((x) => x.season === o.season);
  if (site && o.site !== false) {
    let x = 1 + rint(s, 5), y = 2;
    if (site.id === 'court') y = 1;
    if (site.id === 'quarry') { x = 3; y = 2; s.quarry = true; }
    if (site.id === 'pass') y = 0;
    if (site.id === 'legend') { x = 3; y = 0; }
    const t = s.tiles[cellOf(x, y)];
    t.st = OPEN; t.a = site.a; t.b = site.b; t.site = site.id; t.den = site.guardian;
    t.denHp = foeDef(site.guardian).a.hp + (o.season - 1);
    if (site.half) s.halves[site.id] = site.half;
  }
  for (const h of o.halvesHere ?? []) if (site) s.halves[site.id + ':' + h] = h;
  if (flags.level || o.levelNorth) {
    s.flags.level = true;
    s.level = { x: 2 + rint(s, 3), y: T.H - 1, alive: true };
  }

  s.deck = shuffle(s, o.deck.slice());
  if (flags.locals) for (const p of s.players) {
    if (p.ret.some((c) => !c.half && c.id !== 'page')) continue;
    const id = s.deck.pop();
    if (id && p.ret.length < p.cap) p.ret.push({ id, fixed: 0, active: 1, down: false, half: false });
  }
  for (const p of s.players) for (let i = 0; i < T.hand; i++) p.hand.push(drawDraft(s));
  if (flags.claims) {
    const cards = shuffle(s, CLAIM_CARDS.slice());
    s.players.forEach((p, i) => { p.claim = cards[i % cards.length]; });
  }
  const order = s.players.map((p) => p.idx);
  if (o.holder >= 0) { order.splice(order.indexOf(o.holder), 1); order.unshift(o.holder); }
  s.order = order;
  s.lead = standing(s).winner;
  beginRound(s);
  return s;
}

export function clone(s: State): State {
  return {
    ...s,
    tiles: s.tiles.map((t) => ({ ...t })),
    players: s.players.map((p) => ({ ...p, hand: p.hand.slice(), ret: p.ret.map((c) => ({ ...c })), worked: p.worked.slice(), relics: p.relics.slice() })),
    pile: s.pile,
    deck: s.deck,
    trust: s.trust.map((r) => r.slice()),
    promises: s.promises.map((p) => ({ ...p })),
    amend: s.amend.slice(),
    struck: { ...s.struck },
    events: [],
    quiet: true,
    level: s.level ? { ...s.level } : null,
    halves: { ...s.halves },
    scripted: { ...s.scripted },
    pending: { ...s.pending } as State['pending'],
    battle: null,
  };
}

// ------------------------------------------------------------------ trust and promises

export function bump(s: State, a: number, b: number, d: number, why: string): void {
  if (a === b || a < 0 || b < 0) return;
  const v = Math.max(T.trustMin, Math.min(T.trustMax, s.trust[a][b] + d));
  if (v === s.trust[a][b]) return;
  s.trust[a][b] = v;
  if (!s.quiet) s.ledger.push({ season: s.season, round: s.round, a, b, d, why });
}

function markKept(s: State, pr: PromiseRec, credit: boolean): void {
  pr.state = 'kept';
  if (!credit) return;
  bump(s, pr.to, pr.who, 1, 'kept');
  if (!s.quiet) s.players[pr.who].stats.promisesKept++;
  emit(s, { t: 'promiseKept', p: pr.who, q: pr.to, s: pr.type });
}

function markBroken(s: State, pr: PromiseRec): void {
  pr.state = 'broken';
  const who = s.players[pr.who];
  who.brokePromise = true;
  if (!s.quiet) who.stats.promisesBroken++;
  bump(s, pr.to, pr.who, -3, 'broke');
  for (const w of s.players) if (w.idx !== pr.who && w.idx !== pr.to && RIVALS[w.char].honor >= 0.6) bump(s, w.idx, pr.who, -1, 'witness');
  if (s.law === 'fees' && s.holder >= 0 && s.holder !== pr.who) {
    const n = Math.min(T.feesFine, who.ink);
    who.ink -= n;
    s.players[s.holder].ink += n;
  }
  if (s.law === 'witness') {
    const n = Math.min(2, who.ink);
    who.ink -= n;
    s.players[pr.to].ink += n;
  }
  if (s.amend.some((a) => a.id === 'binding')) {
    const pegs = pegsOf(s, pr.who);
    if (pegs.length) { s.tiles[pegs[pegs.length - 1]].peg = -1; who.pegs++; }
  }
  if (pr.type === 'truce') {
    for (const o of s.promises) if (o.type === 'truce' && o.state === 'open' && o.who === pr.to && o.to === pr.who) o.state = 'kept';
  }
  emit(s, { t: 'promiseBroken', p: pr.who, q: pr.to, s: pr.type, c: pr.c });
}

function breakTruce(s: State, who: number, to: number): void {
  for (const pr of s.promises) if (pr.type === 'truce' && pr.state === 'open' && pr.who === who && pr.to === to && pr.until >= s.round) markBroken(s, pr);
}

function onMeasured(s: State, who: number, c: number, k: Kind): void {
  for (const pr of s.promises) {
    if (pr.state !== 'open' || pr.c !== c) continue;
    if (pr.type === 'read') {
      if (pr.who === who) { if (pr.k === k) markKept(s, pr, true); else markBroken(s, pr); }
      else markKept(s, pr, false);
    } else if (pr.type === 'leave' && pr.who === who) markBroken(s, pr);
  }
}

function onPegged(s: State, who: number, c: number): void {
  for (const pr of s.promises) if (pr.state === 'open' && pr.type === 'leave' && pr.c === c && pr.who === who) markBroken(s, pr);
}

function expirePromises(s: State, final: boolean): void {
  for (const pr of s.promises) {
    if (pr.state !== 'open') continue;
    if (pr.type === 'back') {
      if (final) { if (s.players[pr.who].backs === pr.to) markKept(s, pr, true); else markBroken(s, pr); }
      continue;
    }
    if (pr.until >= s.round && !final) continue;
    if (pr.type === 'read') { if (s.tiles[pr.c].st === OPEN) markBroken(s, pr); else markKept(s, pr, false); }
    else markKept(s, pr, true);
  }
}

export function dealAffordable(s: State, d: Deal): boolean {
  const a = s.players[d.from], b = s.players[d.to];
  if (a.ink < d.ink[0] || b.ink < d.ink[1] || a.doubt < d.doubt[0] || b.doubt < d.doubt[1]) return false;
  if (d.draft[0] >= a.hand.length || d.draft[1] >= b.hand.length) return false;
  if (d.draft[0] >= 0 && b.hand.length >= T.handMax + 1) return false;
  if (d.draft[1] >= 0 && a.hand.length >= T.handMax + 1) return false;
  if ((d.truce || d.read || d.leave || d.back >= 0) && !s.flags.promises) return false;
  if (d.truce && s.promises.some((pr) => pr.type === 'truce' && ((pr.who === d.from && pr.to === d.to) || (pr.who === d.to && pr.to === d.from)))) return false;
  if (d.back >= 0 && (!s.flags.backing || s.round <= s.rounds - T.backFromLast)) return false;
  return true;
}

export function emptyDeal(from: number, to: number): Deal {
  return { from, to, ink: [0, 0], doubt: [0, 0], draft: [-1, -1], truce: 0, read: null, leave: null, back: -1 };
}

function addPromise(s: State, type: PromiseRec['type'], who: number, to: number, c: number, k: Kind | null, until: number): void {
  s.promises.push({ id: s.nextPromise++, type, who, to, c, k, until: Math.min(until, s.rounds), state: 'open' });
}

export function applyDeal(s: State, d: Deal): void {
  const a = s.players[d.from], b = s.players[d.to];
  a.ink -= d.ink[0]; b.ink += d.ink[0];
  b.ink -= d.ink[1]; a.ink += d.ink[1];
  a.doubt -= d.doubt[0]; b.doubt += d.doubt[0];
  b.doubt -= d.doubt[1]; a.doubt += d.doubt[1];
  const da = d.draft[0] >= 0 ? a.hand[d.draft[0]] : null;
  const db = d.draft[1] >= 0 ? b.hand[d.draft[1]] : null;
  if (da) { a.hand.splice(d.draft[0], 1); b.hand.push(da); }
  if (db) { b.hand.splice(b.hand.indexOf(db), 1); a.hand.push(db); }
  const either = a.char === 'either' || b.char === 'either';
  if (d.truce > 0) {
    let until = s.round + d.truce - 1;
    if (hasRelic(a, 'ring', 1) || hasRelic(b, 'ring', 1)) until += 1;
    if (either) until = Math.min(until, s.round + 1);
    addPromise(s, 'truce', d.from, d.to, -1, null, until);
    addPromise(s, 'truce', d.to, d.from, -1, null, until);
  }
  if (d.read) {
    const who = d.read.who === 0 ? d.from : d.to;
    addPromise(s, 'read', who, who === d.from ? d.to : d.from, d.read.c, d.read.k, s.round + (either ? 1 : 2));
  }
  if (d.leave) {
    const who = d.leave.who === 0 ? d.from : d.to;
    addPromise(s, 'leave', who, who === d.from ? d.to : d.from, d.leave.c, null, s.round + (either ? 1 : 2));
  }
  if (d.back >= 0) {
    const who = d.back === 0 ? d.from : d.to;
    const to = who === d.from ? d.to : d.from;
    addPromise(s, 'back', who, to, -1, null, s.rounds);
    s.players[who].backs = to;
    bump(s, to, who, 2, 'backed');
  }
  if (!s.quiet) { a.stats.dealsMade++; b.stats.dealsMade++; }
  emit(s, { t: 'deal', p: d.from, q: d.to, data: d });
}

// ------------------------------------------------------------------ round and turn flow

function beginRound(s: State): void {
  emit(s, { t: 'round', n: s.round });
  for (const p of s.players) {
    for (const c of p.ret) c.down = false;
    p.usedDraft = false;
  }
  expirePromises(s, false);
  if (s.round > 1) {
    if (s.law === 'parity') {
      const sorted = s.players.slice().sort((a, b) => a.pegs - b.pegs);
      const most = sorted[0], fewest = sorted[sorted.length - 1];
      if (most.pegs < fewest.pegs && most.ink > 0) { most.ink--; fewest.ink++; emit(s, { t: 'parity', p: fewest.idx, q: most.idx }); }
    }
    const either = s.players.find((p) => p.char === 'either');
    if (either && either.doubt >= 2) {
      const others = s.players.filter((p) => p !== either).sort((a, b) => b.pegs - a.pegs || a.idx - b.idx);
      if (others.length && others[0].pegs > others[others.length - 1].pegs) {
        either.doubt--;
        others[0].doubt++;
        bump(s, others[0].idx, either.idx, 1, 'gift');
        emit(s, { t: 'gift', p: either.idx, q: others[0].idx, n: 1, s: 'doubt' });
      }
    }
    if (s.quarry) moveQuarry(s);
  }
  s.turn = 0;
  if (s.flags.level && s.level && s.level.alive) { s.pending = { t: 'bid', p: s.order[0], bids: [] }; return; }
  beginTurn(s);
}

function moveQuarry(s: State): void {
  const from = s.tiles.findIndex((t) => t.site === 'quarry');
  if (from < 0 || !s.tiles[from].den) return;
  const near = (c: number) => Math.min(...s.players.map((p) => dist(pcell(p), c)));
  let best = from, bd = near(from);
  for (const n of neighbors(from)) {
    const t = s.tiles[n];
    if (cy(n) >= T.H - 1 || t.peg >= 0 || t.site || t.st === FIXED || s.players.some((p) => pcell(p) === n)) continue;
    const d = near(n);
    if (d > bd || (d === bd && best !== from && rnd(s) < 0.3)) { bd = d; best = n; }
  }
  if (best === from) return;
  const a = s.tiles[from], b = s.tiles[best];
  s.tiles[from] = b;
  s.tiles[best] = a;
  emit(s, { t: 'quarryMove', c: best, n: from });
}

function levelAdvance(s: State): void {
  const L = s.level!;
  if (L.y > 0) L.y--;
  const c = cellOf(L.x, L.y);
  const t = s.tiles[c];
  if (t.st === BLANK) {
    t.st = FIXED; t.a = t.b = t.k = 'road'; t.by = -2;
  } else if (t.st === OPEN) {
    const kinds = charterKinds(s);
    const k = kinds.includes(t.a) ? t.a : kinds.includes(t.b) ? t.b : t.a;
    s.struck[k === t.a ? t.b : t.a]++;
    t.st = FIXED; t.k = k; t.by = -2;
    if (!t.site) { t.den = null; t.denHp = 0; }
    onMeasured(s, -2, c, k);
  }
  for (const p of s.players) {
    if (pcell(p) !== c) continue;
    for (const comp of p.ret) {
      if (comp.fixed === 0 && !comp.half && localDef(comp.id)) {
        comp.fixed = comp.active;
        emit(s, { t: 'levelPin', p: p.idx, s: comp.id, n: comp.fixed });
      }
    }
  }
  emit(s, { t: 'level', c, x: L.x, y: L.y });
}

function beginTurn(s: State): void {
  const p = s.players[s.order[s.turn]];
  p.steps = T.steps;
  if (p.char === 'lot' && p.ret.filter((c) => !c.down).length >= 2) p.steps++;
  if (p.hidden === 'nightowl' && s.round === s.rounds) { p.steps++; p.hiddenShown = true; }
  if (p.char === 'either') p.doubt += T.stipend + 1; else p.ink += T.stipend;
  if (p.char === 'deed') p.ink += T.deedSalary;
  if (s.holder === p.idx && p.char !== 'either') p.ink += T.holderStipend;
  if (s.flags.doubt && s.tiles[pcell(p)].st === OPEN) p.doubt += T.standDoubt;
  if (hasPower(p, 'inkturn')) p.ink++;
  if (hasPower(p, 'doubtturn')) p.doubt++;
  if (hasRelic(p, 'spring', 2)) p.ink++;
  p.worked = [];
  p.usedFreeMove = p.usedFreeSketch = p.usedFreeMeasure = false;
  p.proposals = 2;
  s.scripted.freePeg = -1;
  s.pending = { t: 'turn', p: p.idx };
  emit(s, { t: 'turn', p: p.idx });
}

function endTurn(s: State): void {
  const p = s.players[s.order[s.turn]];
  const hand = T.hand + (p.perks.includes('satchel') ? 1 : 0);
  while (p.hand.length < hand) p.hand.push(drawDraft(s));
  s.turn++;
  if (s.turn < s.order.length) { beginTurn(s); return; }
  if (s.round >= s.rounds) { endSeason(s); return; }
  s.round++;
  beginRound(s);
}

function endSeason(s: State): void {
  expirePromises(s, true);
  const st = standing(s);
  const cnt = counts(s);
  const rank = charterRank(s);
  if (st.by === 'claim') { rank.splice(rank.indexOf(st.winner), 1); rank.unshift(st.winner); }
  const deputies = s.players.filter((p) => p.backs === st.winner && p.idx !== st.winner).map((p) => p.idx);
  s.result = { winner: st.winner, by: st.by, claim: st.claim, counts: cnt, rank, deputies };
  s.over = true;
  s.pending = { t: 'done', p: -1 };
  emit(s, { t: 'seasonEnd', p: st.winner, s: st.by });
}

// ------------------------------------------------------------------ costs and legality

export function moveCost(s: State, p: Player, to: number): number {
  const t = s.tiles[to];
  if (t.st === FIXED && t.k === 'road' && (t.peg === -1 || t.peg === p.idx || inTruce(s, p.idx, t.peg))) return 0;
  if (!p.usedFreeMove && (hasPower(p, 'freemove') || hasRelic(p, 'spring', 1) || p.perks.includes('chain'))) return 0;
  return 1;
}

export function sketchCost(p: Player): number {
  return !p.usedFreeSketch && (hasPower(p, 'freesketch') || p.perks.includes('quickhand')) ? 0 : 1;
}

export function measureInk(s: State, p: Player, c: number): number {
  const t = s.tiles[c];
  let n = T.measureInk + (t.peg >= 0 && t.peg !== p.idx ? T.measurePeggedExtra : 0);
  if (!p.usedFreeMeasure && hasPower(p, 'freemeasure')) n -= 1;
  else if (!p.usedPage && p.perks.includes('page')) n -= 1;
  return Math.max(0, n);
}

export function contestCost(s: State, p: Player, pegOwner: number): number {
  let n = T.contestSteps;
  if (hasPower(p, 'cheapcontest')) n -= 1;
  void s;
  if (pegOwner >= 0 && hasRelic(s.players[pegOwner], 'bow', 2)) n += 1;
  return Math.max(1, n);
}

export function objectCost(s: State, measurer: Player): number {
  return (s.law === 'second' ? T.objectDoubtSecond : T.objectDoubt) + (measurer.perks.includes('countersign') ? 1 : 0);
}

export function unmeasureCost(p: Player): number { return p.char === 'either' ? T.unsayDoubt : T.unmeasureDoubt; }

export function recruitCost(s: State, p: Player, c: number, id: string): number {
  const def = localDef(id)!;
  const t = s.tiles[c];
  let n = def.cost - (hasPower(p, 'cheaprecruit') ? 1 : 0) - (t.peg === p.idx ? 1 : 0);
  n = Math.max(0, n);
  if (t.peg >= 0 && t.peg !== p.idx) n += T.recruitRivalFee;
  return n;
}

/** In season 1 the plot north of each junior is reserved for that junior until it is measured. */
export function plotOwner(s: State, c: number): number {
  if (s.season !== 1 || s.tiles[c].st !== OPEN) return -1;
  for (const q of s.players) if (cellOf(q.sx, q.sy - 1) === c) return q.idx;
  return -1;
}

export function measureCells(s: State, p: Player): number[] {
  const cells = actCells(s, p);
  if (p.char === 'auger') {
    for (const n of neighbors(pcell(p))) {
      const t = s.tiles[n];
      if (t.st === OPEN && (t.a === 'well' || t.b === 'well') && !cells.includes(n)) cells.push(n);
    }
  }
  return cells.filter((c) => {
    const t = s.tiles[c];
    if (t.st !== OPEN || t.den) return false;
    if (plotOwner(s, c) >= 0 && plotOwner(s, c) !== p.idx) return false;
    if (t.peg >= 0 && t.peg !== p.idx && s.players[t.peg].char === 'either') return false;
    return true;
  });
}

function levelAt(s: State, c: number): boolean {
  return !!s.level && s.level.alive && cellOf(s.level.x, s.level.y) === c;
}

/** Every board action the acting player may take now. Parley, gifts, and retinue upkeep are separate. */
export function legal(s: State): Action[] {
  const out: Action[] = [];
  const pd = s.pending;
  if (pd.t === 'object') return [{ t: 'object', yes: true }, { t: 'object', yes: false }];
  if (pd.t === 'insist') return [{ t: 'insist', yes: true }, { t: 'insist', yes: false }];
  if (pd.t === 'deal') return [{ t: 'answer', yes: true }, { t: 'answer', yes: false }];
  if (pd.t === 'steer') return [{ t: 'steer', d: -1 }, { t: 'steer', d: 0 }, { t: 'steer', d: 1 }];
  if (pd.t === 'relic') return [{ t: 'relic', r: 1 }, { t: 'relic', r: 2 }];
  if (pd.t === 'bid') { for (let n = 0; n <= Math.min(4, s.players[pd.p].ink); n++) out.push({ t: 'bid', n }); return out; }
  if (pd.t !== 'turn') return out;
  const p = s.players[pd.p];
  const here = pcell(p);
  const t = s.tiles[here];

  for (let d = 0; d < 4; d++) {
    const x = p.x + DIRS[d][0], y = p.y + DIRS[d][1];
    if (!inside(x, y)) continue;
    const c = cellOf(x, y);
    if (s.tiles[c].st === BLANK) continue;
    if (moveCost(s, p, c) <= p.steps) out.push({ t: 'move', d });
  }
  if (p.steps >= sketchCost(p) && p.hand.length) {
    const cells = sketchCells(s, p);
    const seen = new Set<string>();
    p.hand.forEach((d, h) => {
      const key = d.a < d.b ? d.a + d.b + d.den : d.b + d.a + d.den;
      if (seen.has(key)) return;
      seen.add(key);
      for (const c of cells) out.push({ t: 'sketch', h, c });
    });
  }
  if (p.steps >= 1) {
    for (const c of measureCells(s, p)) {
      const tc = s.tiles[c];
      const ink = measureInk(s, p, c);
      if (p.ink < ink) continue;
      const peg = tc.peg === -1 && p.pegs > 0 && !tc.official && p.ink >= ink + T.pegInk;
      out.push({ t: 'measure', c, k: tc.a, peg });
      out.push({ t: 'measure', c, k: tc.b, peg });
    }
    if (p.pegs > 0) {
      for (const c of actCells(s, p)) {
        const tc = s.tiles[c];
        if (tc.peg !== -1 || tc.official || tc.den || tc.st === BLANK) continue;
        if (plotOwner(s, c) >= 0 && plotOwner(s, c) !== p.idx) continue;
        if (tc.st === FIXED && p.ink >= T.pegInk) out.push({ t: 'peg', c });
        if (tc.st === OPEN && s.flags.doubt && p.doubt >= T.pegDoubt) out.push({ t: 'peg', c });
      }
    }
    if (!p.worked.includes(here) && !t.den) {
      if (t.st === FIXED && t.k === 'well') out.push({ t: 'work', c: here, pick: -1 });
      if (t.st === FIXED && t.k === 'peak' && p.hand.length < T.handMax) out.push({ t: 'work', c: here, pick: -1 });
      if (t.st === OPEN && s.flags.doubt) out.push({ t: 'work', c: here, pick: -1 });
      if (t.st === FIXED && t.k === 'town' && s.flags.locals) {
        if (p.ret.some((c) => c.down)) out.push({ t: 'work', c: here, pick: -1 });
        (t.offer ?? []).forEach((id, i) => {
          if (p.ret.length < p.cap && p.ink >= recruitCost(s, p, here, id) && !p.ret.some((c) => c.id === id)) out.push({ t: 'work', c: here, pick: i });
        });
      }
    }
    if (s.flags.unmeasure && t.st === FIXED && !t.official && !t.site && p.doubt >= unmeasureCost(p)) out.push({ t: 'unmeasure', c: here });
    if (s.law === 'market' && t.peg >= 0 && t.peg !== p.idx && p.pegs > 0 && p.ink >= T.marketPrice) out.push({ t: 'buypeg', c: here });
    if (s.flags.amend && t.site === 'legend' && !t.den && !p.amended && p.ink >= T.amendInk && p.doubt >= T.amendDoubt) {
      const have = new Set(s.amend.map((a) => a.id));
      for (const id of ['openfull', 'doubtties', 'binding', 'peace', 'deepwells'] as AmendId[]) if (!have.has(id)) out.push({ t: 'amend', id, k: null });
      if (!have.has('second_kind') && s.charter !== 'acres') for (const k of KINDS) if (k !== s.charter) out.push({ t: 'amend', id: 'second_kind', k });
    }
  }
  if (s.scripted.freePeg === here && t.peg === -1 && p.pegs > 0 && p.steps < 1) {
    if (t.st === FIXED && p.ink >= T.pegInk) out.push({ t: 'peg', c: here });
    if (t.st === OPEN && s.flags.doubt && p.doubt >= T.pegDoubt) out.push({ t: 'peg', c: here });
  }
  if (s.flags.fights) {
    const peace = s.amend.some((a) => a.id === 'peace') && t.st === FIXED && t.k === 'town';
    if (!peace) {
      for (const q of s.players) {
        if (q.idx !== p.idx && pcell(q) === here && p.steps >= contestCost(s, p, -1)) out.push({ t: 'contest', target: 'pawn', who: q.idx });
      }
      if (t.peg >= 0 && t.peg !== p.idx && pcell(s.players[t.peg]) !== here && p.steps >= contestCost(s, p, t.peg)) {
        if (s.players[t.peg].char !== 'deed' || p.ink >= 1) out.push({ t: 'contest', target: 'peg', who: t.peg });
      }
    }
    if (t.den && p.steps >= contestCost(s, p, -1)) out.push({ t: 'contest', target: 'den', who: -1 });
    if (levelAt(s, here) && p.steps >= contestCost(s, p, -1)) out.push({ t: 'contest', target: 'den', who: -2 });
  }
  if (s.flags.claims && p.claim && !p.filed && p.steps >= T.fileSteps && s.round <= s.rounds - T.fileBefore) { out.push({ t: 'file', r: 1 }); out.push({ t: 'file', r: 2 }); }
  if (s.flags.backing && s.round > s.rounds - T.backFromLast) {
    for (const q of s.players) if (q.idx !== p.idx && p.backs !== q.idx) out.push({ t: 'back', who: q.idx });
    if (p.backs >= 0) out.push({ t: 'back', who: -1 });
  }
  if (p.doubt >= T.blurDoubt) p.ret.forEach((c, i) => { if (c.fixed > 0 && !c.half && localDef(c.id)) out.push({ t: 'blur', i }); });
  out.push({ t: 'end' });
  return out;
}

// ------------------------------------------------------------------ applying actions

function count(s: State, p: Player, key: string): void {
  p.lastAct = key;
  if (s.quiet) return;
  p.stats.actions[key] = (p.stats.actions[key] ?? 0) + 1;
}

function placePeg(s: State, p: Player, c: number): void {
  const t = s.tiles[c];
  t.peg = p.idx;
  p.pegs--;
  if (!s.quiet) p.stats.pegs++;
  onPegged(s, p.idx, c);
  emit(s, { t: 'peg', p: p.idx, c });
}

function resolveMeasure(s: State, m: number, c: number, k: Kind, chosen: boolean, peg: boolean): void {
  const p = s.players[m];
  const t = s.tiles[c];
  const other = k === t.a ? t.b : t.a;
  t.st = FIXED;
  t.k = k;
  t.by = m;
  s.struck[other]++;
  if (!s.quiet) p.stats.measures++;
  emit(s, { t: 'measure', p: m, c, k, s: other });
  if (chosen) {
    if (k === 'road') p.steps += 1;
    if (k === 'well') p.ink += 1;
    if (k === 'peak' && p.hand.length < T.handMax) p.hand.push(drawDraft(s));
  }
  if (k === 'town' && s.flags.locals && !t.offer) {
    const offer: string[] = [];
    for (let i = 0; i < 2; i++) { const id = drawLocal(s); if (id && !offer.includes(id)) offer.push(id); }
    t.offer = offer;
  }
  onMeasured(s, m, c, k);
  const entry = T.pegInk;
  if (chosen && peg && t.peg === -1 && p.pegs > 0 && p.ink >= entry && !t.official) {
    p.ink -= entry;
    placePeg(s, p, c);
  }
  s.pending = { t: 'turn', p: m };
}

function nextObjector(s: State, m: number, c: number, k: Kind, queue: number[], peg: boolean, free: boolean): void {
  if (!queue.length) { resolveMeasure(s, m, c, k, true, peg); return; }
  s.pending = { t: 'object', p: queue[0], m, c, k, queue: queue.slice(1), peg, free };
}

export function grantHalf(s: State, p: Player, id: string): boolean {
  if (p.ret.length >= p.cap + (id === 'roost' ? 1 : 0)) return false;
  if (id === 'roost') { p.cap += 1; p.canBlur = true; }
  p.ret.push({ id, fixed: 1, active: 1, down: false, half: true });
  for (const key of Object.keys(s.halves)) if (s.halves[key] === id) delete s.halves[key];
  return true;
}

export function apply(s: State, a: Action): void {
  const pd = s.pending;
  switch (pd.t) {
    case 'battle': batAct(s, a); if (!s.battle) afterFight(s); break;
    case 'object': {
      if (a.t !== 'object') throw new Error('expected object');
      const q = s.players[pd.p], m = s.players[pd.m];
      if (!a.yes) { nextObjector(s, pd.m, pd.c, pd.k, pd.queue, pd.peg, pd.free); break; }
      q.doubt -= objectCost(s, m);
      if (!s.quiet) q.stats.objections++;
      bump(s, pd.m, pd.p, -1, 'objected');
      breakTruce(s, pd.p, pd.m);
      emit(s, { t: 'object', p: pd.p, q: pd.m, c: pd.c, k: pd.k });
      if (m.ink >= T.insistInk) s.pending = { t: 'insist', p: pd.m, o: pd.p, c: pd.c, k: pd.k, peg: pd.peg, free: pd.free };
      else { const tc = s.tiles[pd.c]; resolveMeasure(s, pd.m, pd.c, pd.k === tc.a ? tc.b : tc.a, false, false); }
      break;
    }
    case 'insist': {
      if (a.t !== 'insist') throw new Error('expected insist');
      const m = s.players[pd.p];
      const tc = s.tiles[pd.c];
      if (a.yes) { m.ink -= T.insistInk; emit(s, { t: 'insist', p: pd.p, c: pd.c }); resolveMeasure(s, pd.p, pd.c, pd.k, true, pd.peg); }
      else { emit(s, { t: 'flip', p: pd.o, c: pd.c }); resolveMeasure(s, pd.p, pd.c, pd.k === tc.a ? tc.b : tc.a, false, false); }
      break;
    }
    case 'deal': {
      if (a.t !== 'answer') throw new Error('expected answer');
      const d = pd.deal;
      if (a.yes && dealAffordable(s, d)) applyDeal(s, d);
      else { if (!s.quiet) s.players[d.from].stats.dealsRefused++; emit(s, { t: 'dealRefused', p: d.to, q: d.from }); }
      s.pending = { t: 'turn', p: d.from };
      break;
    }
    case 'bid': {
      if (a.t !== 'bid') throw new Error('expected bid');
      const bids = pd.bids.concat([Math.max(0, Math.min(a.n, s.players[pd.p].ink))]);
      if (bids.length < s.order.length) { s.pending = { t: 'bid', p: s.order[bids.length], bids }; break; }
      let best = -1, top = 0, tie = false;
      bids.forEach((n, i) => { if (n > top) { top = n; best = i; tie = false; } else if (n === top && n > 0) tie = true; });
      emit(s, { t: 'bids', data: bids.map((n, i) => ({ p: s.order[i], n })) });
      if (best >= 0 && !tie) {
        s.players[s.order[best]].ink -= top;
        s.pending = { t: 'steer', p: s.order[best] };
      } else { levelAdvance(s); beginTurn(s); }
      break;
    }
    case 'steer': {
      if (a.t !== 'steer') throw new Error('expected steer');
      const L = s.level!;
      const x = L.x + a.d;
      if (x >= 0 && x < T.W) L.x = x;
      emit(s, { t: 'steer', p: pd.p, n: a.d });
      levelAdvance(s);
      beginTurn(s);
      break;
    }
    case 'relic': {
      if (a.t !== 'relic') throw new Error('expected relic');
      const p = s.players[pd.p];
      p.relics.push({ id: pd.id, r: a.r });
      if (pd.id === 'table' && a.r === 1) p.cap += 1;
      emit(s, { t: 'relic', p: p.idx, s: pd.id, n: a.r });
      s.pending = { t: 'turn', p: s.order[s.turn] };
      break;
    }
    case 'turn': applyTurn(s, s.players[pd.p], a); break;
    default: throw new Error('no decision pending');
  }
  if (!s.over && !s.battle) {
    const lead = standing(s).winner;
    if (lead !== s.lead) { s.lead = lead; s.leadChanges++; }
  }
}

function applyTurn(s: State, p: Player, a: Action): void {
  const here = pcell(p);
  switch (a.t) {
    case 'move': {
      const x = p.x + DIRS[a.d][0], y = p.y + DIRS[a.d][1];
      const c = cellOf(x, y);
      const cost = moveCost(s, p, c);
      const road = s.tiles[c].st === FIXED && s.tiles[c].k === 'road';
      if (cost === 0 && !(road && (s.tiles[c].peg === -1 || s.tiles[c].peg === p.idx || inTruce(s, p.idx, s.tiles[c].peg)))) p.usedFreeMove = true;
      p.steps -= cost;
      p.x = x; p.y = y;
      count(s, p, 'move');
      emit(s, { t: 'move', p: p.idx, c });
      break;
    }
    case 'sketch': {
      const d = p.hand[a.h];
      const cost = sketchCost(p);
      if (cost === 0) p.usedFreeSketch = true;
      p.steps -= cost;
      p.hand.splice(a.h, 1);
      const t = s.tiles[a.c];
      t.st = OPEN; t.a = d.a; t.b = d.b; t.k = null;
      if (d.den && s.flags.fights) { t.den = d.den; t.denHp = foeDef(d.den).a.hp + (s.season - 1); }
      if (s.flags.doubt) p.doubt += T.sketchDoubt;
      if (!s.quiet) p.stats.sketches++;
      count(s, p, 'sketch');
      emit(s, { t: 'sketch', p: p.idx, c: a.c });
      break;
    }
    case 'measure': {
      const ink = measureInk(s, p, a.c);
      if (ink < T.measureInk + (s.tiles[a.c].peg >= 0 && s.tiles[a.c].peg !== p.idx ? T.measurePeggedExtra : 0)) {
        if (!p.usedFreeMeasure && hasPower(p, 'freemeasure')) p.usedFreeMeasure = true; else p.usedPage = true;
      }
      p.steps -= 1;
      p.ink -= ink;
      count(s, p, 'measure');
      const queue: number[] = [];
      if (s.flags.objection) {
        const cost = objectCost(s, p);
        for (const qi of s.order) {
          const q = s.players[qi];
          if (qi !== p.idx && q.doubt >= cost && dist(pcell(q), a.c) <= T.objectRange) queue.push(qi);
        }
      }
      nextObjector(s, p.idx, a.c, a.k, queue, a.peg, false);
      break;
    }
    case 'peg': {
      const t = s.tiles[a.c];
      if (s.scripted.freePeg === a.c) s.scripted.freePeg = -1; else p.steps -= 1;
      if (t.st === FIXED) p.ink -= T.pegInk; else p.doubt -= T.pegDoubt;
      placePeg(s, p, a.c);
      count(s, p, 'peg');
      break;
    }
    case 'work': {
      const t = s.tiles[here];
      p.steps -= 1;
      p.worked.push(here);
      if (!s.quiet) p.stats.works++;
      count(s, p, 'work');
      if (t.st === OPEN) { p.doubt += T.openDoubt; emit(s, { t: 'work', p: p.idx, c: here, n: T.openDoubt, s: 'doubt' }); }
      else if (t.k === 'well') {
        let n = T.wellInk + (hasPower(p, 'wellplus') ? 1 : 0) + (p.char === 'auger' && t.peg === p.idx ? 1 : 0) + (s.amend.some((x) => x.id === 'deepwells') ? 1 : 0);
        if (t.peg >= 0 && t.peg !== p.idx) { n -= T.wellShare; s.players[t.peg].ink += T.wellShare; }
        p.ink += n;
        emit(s, { t: 'work', p: p.idx, c: here, n, s: 'ink' });
      } else if (t.k === 'peak') { p.hand.push(drawDraft(s)); emit(s, { t: 'work', p: p.idx, c: here, n: 1, s: 'draft' }); }
      else if (t.k === 'town') {
        if (a.pick < 0) { for (const c of p.ret) c.down = false; emit(s, { t: 'work', p: p.idx, c: here, n: 0, s: 'rest' }); }
        else {
          const id = t.offer![a.pick];
          const cost = recruitCost(s, p, here, id);
          p.ink -= cost;
          if (t.peg >= 0 && t.peg !== p.idx) s.players[t.peg].ink += T.recruitRivalFee;
          p.ret.push({ id, fixed: 0, active: 1, down: false, half: false });
          const offer = t.offer!.slice();
          const next = drawLocal(s);
          if (next && !offer.includes(next)) offer[a.pick] = next; else offer.splice(a.pick, 1);
          t.offer = offer;
          emit(s, { t: 'recruit', p: p.idx, c: here, s: id });
        }
      }
      if (hasPower(p, 'draft') && !p.usedDraft && p.hand.length < T.handMax) { p.usedDraft = true; p.hand.push(drawDraft(s)); }
      break;
    }
    case 'contest': {
      const t = s.tiles[here];
      const owner = a.target === 'peg' ? t.peg : -1;
      p.steps -= contestCost(s, p, owner);
      if (a.target === 'peg' && s.players[owner].char === 'deed') p.ink -= 1;
      count(s, p, 'contest');
      if (!s.quiet) p.stats.actions['fight_' + a.target] = (p.stats.actions['fight_' + a.target] ?? 0) + 1;
      if (a.target !== 'den') {
        p.startedContest = true;
        bump(s, a.who, p.idx, -2, 'contested');
        breakTruce(s, p.idx, a.who);
      }
      startBattle(s, p.idx, a.target, a.who);
      const won = s.scripted.lastFightWon === 1;
      if (!s.battle && won && a.target === 'den' && a.who !== -2) siteRelic(s, p, here);
      break;
    }
    case 'file': {
      p.steps -= T.fileSteps;
      p.filed = a.r;
      p.filedOrder = ++s.fileCount;
      count(s, p, 'file');
      emit(s, { t: 'file', p: p.idx, n: a.r });
      break;
    }
    case 'unmeasure': {
      const t = s.tiles[a.c];
      p.steps -= 1;
      p.doubt -= unmeasureCost(p);
      const other = t.k === t.a ? t.b : t.a;
      s.struck[other] = Math.max(0, s.struck[other] - 1);
      t.st = OPEN; t.k = null; t.offer = null;
      if (t.peg >= 0 && t.peg !== p.idx) bump(s, t.peg, p.idx, -2, 'unmeasured');
      if (!s.quiet) p.stats.unmeasures++;
      count(s, p, 'unmeasure');
      emit(s, { t: 'unmeasure', p: p.idx, c: a.c });
      break;
    }
    case 'buypeg': {
      const t = s.tiles[a.c];
      const owner = s.players[t.peg];
      p.steps -= 1;
      p.ink -= T.marketPrice;
      owner.ink += T.marketPrice;
      owner.pegs++;
      bump(s, owner.idx, p.idx, -1, 'bought');
      t.peg = -1;
      placePeg(s, p, a.c);
      count(s, p, 'buypeg');
      break;
    }
    case 'amend': {
      p.steps -= 1;
      p.ink -= T.amendInk;
      p.doubt -= T.amendDoubt;
      p.amended = true;
      s.amend.push({ id: a.id, k: a.k, by: p.idx });
      count(s, p, 'amend');
      emit(s, { t: 'amend', p: p.idx, s: a.id, k: a.k });
      break;
    }
    case 'back': {
      if (a.who < 0) {
        const was = p.backs;
        p.backs = -1;
        for (const pr of s.promises) if (pr.type === 'back' && pr.state === 'open' && pr.who === p.idx && pr.to === was) markBroken(s, pr);
        emit(s, { t: 'unback', p: p.idx, q: was });
      } else {
        const was = p.backs;
        if (was >= 0) for (const pr of s.promises) if (pr.type === 'back' && pr.state === 'open' && pr.who === p.idx && pr.to === was) markBroken(s, pr);
        p.backs = a.who;
        bump(s, a.who, p.idx, 2, 'backed');
        emit(s, { t: 'back', p: p.idx, q: a.who });
      }
      count(s, p, 'back');
      break;
    }
    case 'blur': {
      p.doubt -= T.blurDoubt;
      p.ret[a.i].fixed = 0;
      emit(s, { t: 'blurComp', p: p.idx, s: p.ret[a.i].id });
      break;
    }
    case 'active': {
      if (p.ret[a.i] && p.ret[a.i].fixed === 0) p.ret[a.i].active = a.r === 2 ? 2 : 1;
      break;
    }
    case 'dismiss': {
      const c = p.ret[a.i];
      if (c) {
        if (c.id === 'roost') { p.cap -= 1; p.canBlur = false; }
        p.ret.splice(a.i, 1);
        if (localDef(c.id) && !s.quiet) s.deck.unshift(c.id);
      }
      break;
    }
    case 'gift': {
      const to = s.players[a.to];
      const ink = Math.min(a.ink, p.ink), doubt = Math.min(a.doubt, p.doubt);
      p.ink -= ink; to.ink += ink;
      p.doubt -= doubt; to.doubt += doubt;
      const key = 'gift' + p.idx + '_' + a.to;
      if (to.char === 'auger' && !to.whole) bump(s, a.to, p.idx, Math.floor(ink / 2), 'paid');
      else if (ink + doubt >= 2 && s.scripted[key] !== s.round && !(to.char === 'either' && doubt === 0)) { s.scripted[key] = s.round; bump(s, a.to, p.idx, 1, 'gift'); }
      emit(s, { t: 'gift', p: p.idx, q: a.to, n: ink + doubt, s: ink ? 'ink' : 'doubt' });
      break;
    }
    case 'propose': {
      if (p.proposals <= 0) break;
      p.proposals--;
      if (!dealAffordable(s, a.deal)) { emit(s, { t: 'dealRefused', p: a.deal.to, q: p.idx }); break; }
      s.pending = { t: 'deal', p: a.deal.to, deal: a.deal };
      emit(s, { t: 'propose', p: p.idx, q: a.deal.to, data: a.deal });
      break;
    }
    case 'sendhalf': {
      const c = p.ret[a.i];
      const to = s.players[a.to];
      if (!c || !c.half || dist(pcell(p), pcell(to)) > 1) break;
      const def = HALVES.find((h) => h.id === c.id);
      if (!def) break;
      if (def.of === to.char) {
        p.ret.splice(a.i, 1);
        to.whole = true;
        bump(s, a.to, p.idx, 4, 'reunion');
        emit(s, { t: 'reunion', p: p.idx, q: a.to, s: c.id });
      } else if (to.char === 'deed' && c.id !== 'roost') {
        p.ret.splice(a.i, 1);
        bump(s, a.to, p.idx, 2, 'struckhalf');
        emit(s, { t: 'strikeHalf', p: p.idx, q: a.to, s: c.id });
      }
      break;
    }
    case 'end':
      endTurn(s);
      break;
    default:
      throw new Error('bad action ' + a.t);
  }
}

function siteRelic(s: State, p: Player, c: number): void {
  const t = s.tiles[c];
  if (!t.site || t.den) return;
  const site = SITES.find((x) => x.id === t.site);
  if (!site || !site.relic || s.scripted['relic_' + site.id]) return;
  s.scripted['relic_' + site.id] = 1;
  s.pending = { t: 'relic', p: p.idx, id: site.relic };
}

/** Called by the fight UI path when a human's den fight ends after the contest action returned. */
export function afterFight(s: State): void {
  if (s.battle || s.pending.t !== 'turn') return;
  const p = s.players[s.pending.p];
  if (s.scripted.lastFightWon === 1) siteRelic(s, p, pcell(p));
}

export function tileAt(s: State, x: number, y: number): Tile { return s.tiles[cellOf(x, y)]; }
export { cx, cy };
