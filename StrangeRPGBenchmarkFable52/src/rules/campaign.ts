import { FIXED } from './types';
import type { CharId, Charter, Companion, Kind, Law, RelicHeld, State, Tile } from './types';
import { HIDDEN_TRAITS, KINDS, LAW_OF, LOCALS, PERCH_LAWS, PERKS, RIVALS } from './data';
import { T } from './tuning';
import { cellOf, ownCounts, pegsOf } from './board';
import { newSeason } from './engine';
import type { SeatSpec } from './engine';
import { pick, rint, shuffle } from './rng';

export type RivalId = Exclude<CharId, 'perch'>;
export const RIVAL_IDS: RivalId[] = ['deed', 'auger', 'offset', 'lot', 'either'];

export interface RivalRecord {
  traits: string[];
  hidden: string;
  hiddenShown: boolean;
  whole: boolean;
  satOut: boolean;
  met: boolean;
  wins: number;
  streak: number;
  lastRank: number;
  keep: Companion | null;
  relics: RelicHeld[];
  deputyInk: number;
}

export interface SheetTile { st: number; a: Kind; b: Kind; k: Kind | null; peg: CharId | null; site: string | null }
export interface SheetRecord {
  season: number;
  tiles: SheetTile[];
  winner: CharId;
  by: 'charter' | 'claim';
  claim: string | null;
  charter: Charter;
  law: Law;
  seats: CharId[];
  counts: number[];
  deputies: CharId[];
  smudged: boolean;
  struck: Record<Kind, number>;
}

export interface CampaignLedger { season: number; round: number; a: CharId; b: CharId; d: number; why: string }

export interface Campaign {
  version: number;
  seed: number;
  rng: number;
  season: number;
  difficulty: number;
  holder: CharId | 'office';
  charter: Charter;
  law: Law;
  rivals: Record<RivalId, RivalRecord>;
  perks: string[];
  relics: RelicHeld[];
  ret: Companion[];
  canBlur: boolean;
  smudged: boolean;
  renown: number;
  wins: number;
  deputyTimes: number;
  deputyInk: number;
  measures: number;
  doubts: number;
  trust: Record<string, number>;
  ledger: CampaignLedger[];
  struck: Record<Kind, number>;
  deck: string[];
  reserve: string[];
  joinRow: SheetTile[] | null;
  flags: Record<string, number>;
  atlas: SheetRecord[];
  halvesLoose: string[];
  levelNorth: boolean;
  seats: CharId[];
  choices: { charters: Charter[]; laws: Law[]; perks: string[] } | null;
}

function tkey(a: CharId, b: CharId): string { return a + '>' + b; }
export function trustOf(c: Campaign, a: CharId, b: CharId): number { return c.trust[tkey(a, b)] ?? 0; }

export function newCampaign(seed: number, difficulty = 1): Campaign {
  const r = { rng: seed | 0 };
  const hidden = shuffle(r, Object.keys(HIDDEN_TRAITS));
  const rivals = {} as Record<RivalId, RivalRecord>;
  RIVAL_IDS.forEach((id, i) => {
    rivals[id] = { traits: [], hidden: hidden[i % hidden.length], hiddenShown: false, whole: false, satOut: false, met: false, wins: 0, streak: 0, lastRank: 0, keep: null, relics: [], deputyInk: 0 };
  });
  const c: Campaign = {
    version: 1, seed, rng: r.rng, season: 1, difficulty, holder: 'office', charter: 'acres', law: 'none', rivals,
    perks: [], relics: [], ret: [], canBlur: false, smudged: false, renown: 0, wins: 0, deputyTimes: 0, deputyInk: 0, measures: 0, doubts: 0,
    trust: {}, ledger: [], struck: { road: 0, well: 0, town: 0, peak: 0 },
    deck: LOCALS.filter((l) => !l.reserve).map((l) => l.id), reserve: LOCALS.filter((l) => l.reserve).map((l) => l.id),
    joinRow: null, flags: {}, atlas: [], halvesLoose: [], levelNorth: false, seats: [], choices: null,
  };
  c.seats = seatsFor(c);
  return c;
}

function byTrust(c: Campaign, pool: RivalId[], low: boolean): RivalId | null {
  if (!pool.length) return null;
  const sorted = pool.slice().sort((a, b) => (trustOf(c, a, 'perch') - trustOf(c, b, 'perch')) * (low ? 1 : -1) || RIVAL_IDS.indexOf(a) - RIVAL_IDS.indexOf(b));
  return sorted[0];
}

export function nemesisOf(c: Campaign, among?: CharId[]): RivalId {
  const pool = RIVAL_IDS.filter((id) => c.rivals[id].met && (!among || among.includes(id)));
  return byTrust(c, pool.length ? pool : RIVAL_IDS, true)!;
}

export function friendOf(c: Campaign, among?: CharId[]): RivalId {
  const nem = nemesisOf(c, among);
  const pool = RIVAL_IDS.filter((id) => c.rivals[id].met && id !== nem && (!among || among.includes(id)));
  return byTrust(c, pool.length ? pool : RIVAL_IDS.filter((x) => x !== nem), false)!;
}

/** The seat lineup for the campaign's next season. Perch sits second so the pawn starts near the middle. */
export function seatsFor(c: Campaign): CharId[] {
  const holder = c.holder === 'office' ? 'deed' : c.holder;
  let rivals: RivalId[] = [];
  const add = (id: CharId | null) => { if (id && id !== 'perch' && !rivals.includes(id as RivalId) && rivals.length < 3) rivals.push(id as RivalId); };
  if (c.season === 1) rivals = ['offset'];
  else if (c.season === 2) rivals = ['offset', 'auger'];
  else if (c.season === 3) {
    add('deed'); add('lot');
    add(holder === 'offset' || holder === 'auger' ? holder : null);
    add(Math.abs(trustOf(c, 'offset', 'perch')) > Math.abs(trustOf(c, 'auger', 'perch')) ? 'offset' : 'auger');
  } else {
    if (c.season === 4) add('either');
    add(holder);
    const met = RIVAL_IDS.filter((id) => c.rivals[id].met || id === 'either');
    add(byTrust(c, met.filter((x) => !rivals.includes(x)), true));
    add(byTrust(c, met.filter((x) => !rivals.includes(x)), false));
    for (const id of RIVAL_IDS.slice().sort((a, b) => c.rivals[a].lastRank - c.rivals[b].lastRank)) add(id);
  }
  const out: CharId[] = rivals.slice();
  out.splice(Math.min(1, out.length), 0, 'perch');
  return out;
}

function mapRow(c: Campaign, seats: CharId[]): Tile[] | null {
  if (!c.joinRow) return null;
  return c.joinRow.map((t) => ({
    st: t.st, a: t.a, b: t.b, k: t.k, peg: t.peg ? seats.indexOf(t.peg) : -1, official: false, site: null, den: null, denHp: 0, offer: null, by: -1,
  }));
}

export function startSeason(c: Campaign, humanPerch = true): State {
  const seats = c.seats.length ? c.seats : seatsFor(c);
  c.seats = seats;
  const specs: SeatSpec[] = seats.map((char) => {
    if (char === 'perch') {
      return { char, human: humanPerch, ret: c.ret.map((x) => ({ ...x })), relics: c.relics.slice(), perks: c.perks.slice(), canBlur: c.canBlur, ink: T.startInk + c.deputyInk };
    }
    const r = c.rivals[char as RivalId];
    const traits = r.traits.slice();
    if (r.satOut && !traits.includes('hungry')) traits.push('hungry');
    return {
      char, human: false, ret: r.keep ? [{ ...r.keep }] : [], relics: r.relics.slice(), traits, hidden: r.hidden, hiddenShown: r.hiddenShown, whole: r.whole,
      ink: T.startInk + r.deputyInk + (r.satOut ? 2 : 0),
    };
  });
  const n = seats.length;
  const trust: number[][] = [];
  for (let i = 0; i < n; i++) {
    trust.push([]);
    for (let j = 0; j < n; j++) {
      let v = i === j ? 0 : trustOf(c, seats[i], seats[j]);
      if (seats[j] === 'perch' && i !== j && c.perks.includes('goodname')) v = Math.min(T.trustMax, v + 1);
      trust[i].push(v);
    }
  }
  const holderChar = c.holder === 'office' ? 'deed' : c.holder;
  const site = c.season >= 2;
  const s = newSeason({
    seed: (c.seed * 31 + c.season * 7919 + c.rng) | 0, season: c.season, seats: specs, holder: seats.indexOf(holderChar), charter: c.charter, law: c.law,
    joinRow: mapRow(c, seats), struckPile: c.season > 1 ? c.struck : null, deck: c.deck, trust, difficulty: c.difficulty,
    levelNorth: c.season === 6 && c.levelNorth, site, halvesHere: c.halvesLoose,
  });
  for (const id of seats) if (id !== 'perch') c.rivals[id as RivalId].met = true;
  return s;
}

function mostPegged(s: State, p: number): Kind | null {
  const tally: Record<Kind, number> = { road: 0, well: 0, town: 0, peak: 0 };
  for (const cell of pegsOf(s, p)) { const t = s.tiles[cell]; if (t.st === FIXED && t.k) tally[t.k]++; }
  let best: Kind | null = null;
  for (const k of KINDS) if (tally[k] > 0 && (!best || tally[k] > tally[best])) best = k;
  return best;
}

export interface CloseSummary { winner: CharId; perchRank: number; deputy: boolean; newTraits: { who: RivalId; trait: string }[]; added: string[]; lost: string[] }

/** Folds a finished sheet into the campaign and advances to the next season. */
export function closeSeason(c: Campaign, s: State): CloseSummary {
  const res = s.result!;
  const seats = s.players.map((p) => p.char);
  const winner = seats[res.winner];
  const r = { rng: c.rng };
  const perch = s.players.find((p) => p.char === 'perch')!;
  const perchRank = res.rank.indexOf(perch.idx) + 1;
  const deputy = res.deputies.includes(perch.idx);
  const own = ownCounts(s);

  c.atlas.push({
    season: c.season,
    tiles: s.tiles.map((t) => ({ st: t.st, a: t.a, b: t.b, k: t.k, peg: t.peg >= 0 ? seats[t.peg] : null, site: t.site })),
    winner, by: res.by, claim: res.claim, charter: c.charter, law: c.law, seats, counts: own, deputies: res.deputies.map((i) => seats[i]), smudged: c.smudged,
    struck: { ...s.struck },
  });

  for (const k of KINDS) c.struck[k] += s.struck[k];
  c.measures += perch.stats.measures;
  c.doubts += perch.stats.objections + perch.stats.unmeasures;
  if (winner === 'perch') { c.wins++; c.renown += 3; } else if (deputy) { c.deputyTimes++; c.renown += 2; } else if (perchRank === 2) c.renown += 1;

  for (let i = 0; i < seats.length; i++) {
    for (let j = 0; j < seats.length; j++) {
      if (i === j) continue;
      let v = s.trust[i][j];
      const keepsGrudge = seats[i] === 'lot' && !c.rivals.lot.whole && v < 0;
      if (!keepsGrudge) v -= Math.sign(v);
      c.trust[tkey(seats[i], seats[j])] = v;
    }
  }
  for (const e of s.ledger) c.ledger.push({ season: e.season, round: e.round, a: seats[e.a], b: seats[e.b], d: e.d, why: e.why });
  if (c.ledger.length > 400) c.ledger = c.ledger.slice(-400);

  const newTraits: { who: RivalId; trait: string }[] = [];
  for (const id of RIVAL_IDS) {
    const rec = c.rivals[id];
    const seat = seats.indexOf(id);
    if (seat < 0) { rec.satOut = rec.met; continue; }
    const p = s.players[seat];
    rec.satOut = false;
    rec.hiddenShown = rec.hiddenShown || p.hiddenShown;
    rec.whole = rec.whole || p.whole;
    rec.lastRank = res.rank.indexOf(seat) + 1;
    rec.relics = p.relics.slice();
    rec.deputyInk = res.deputies.includes(seat) ? T.deputyInk : 0;
    const locals = p.ret.filter((x) => !x.half && x.id !== 'page');
    rec.keep = locals.length ? { ...locals[0], down: false } : null;
    if (id === winner) { rec.wins++; rec.streak++; } else rec.streak = 0;
    rec.traits = rec.traits.filter((t) => t !== 'hungry');
    const add = (t: string) => { if (!rec.traits.includes(t) && rec.traits.length < 2) { rec.traits.push(t); newTraits.push({ who: id, trait: t }); } };
    const broke = c.ledger.filter((e) => e.a === id && e.b === 'perch' && e.why === 'broke').length;
    const kept = c.ledger.filter((e) => e.a === id && e.b === 'perch' && (e.why === 'kept' || e.why === 'gift' || e.why === 'backed')).length;
    if (broke >= 2) add('wary');
    if (rec.streak >= 2) add('proud');
    if (kept >= 3 && broke === 0) add('fond');
    if (broke > 0) rec.traits = rec.traits.filter((t) => t !== 'fond');
  }

  c.deputyInk = deputy ? T.deputyInk : 0;
  c.ret = perch.ret.map((x) => ({ ...x, down: false }));
  c.relics = perch.relics.slice();
  c.canBlur = perch.canBlur;
  const kept = new Set<string>(c.ret.map((x) => x.id));
  for (const id of RIVAL_IDS) if (c.rivals[id].keep) kept.add(c.rivals[id].keep!.id);
  const all = new Set<string>([...c.deck]);
  for (const p of s.players) for (const x of p.ret) if (!x.half && x.id !== 'page') all.add(x.id);
  for (const t of s.tiles) for (const id of t.offer ?? []) all.add(id);
  for (const id of s.deck) all.add(id);
  const lost = s.lost.slice();
  for (const id of lost) all.delete(id);
  const added: string[] = [];
  const kind = mostPegged(s, res.winner);
  const match = c.reserve.filter((id) => LOCALS.find((l) => l.id === id)!.kind === kind);
  const pool = shuffle(r, match).concat(shuffle(r, c.reserve.filter((id) => !match.includes(id))));
  for (const id of pool.slice(0, 2)) { added.push(id); all.add(id); c.reserve.splice(c.reserve.indexOf(id), 1); }
  c.deck = Array.from(all).filter((id) => !kept.has(id));

  c.joinRow = [];
  for (let x = 0; x < T.W; x++) {
    const t = s.tiles[cellOf(x, 0)];
    c.joinRow.push({ st: t.st, a: t.a, b: t.b, k: t.k, peg: t.peg >= 0 ? seats[t.peg] : null, site: null });
  }
  const loose = new Set(c.halvesLoose);
  for (const id of Object.values(s.halves)) loose.add(id);
  for (const p of s.players) for (const x of p.ret) loose.delete(x.id);
  for (const id of RIVAL_IDS) if (c.rivals[id].whole) loose.delete({ deed: 'act', auger: 'augur', offset: 'offshoot', lot: 'parcel', either: '' }[id]);
  if (c.flags.halfStruck_parcel) loose.delete('parcel');
  if (c.flags.halfStruck_act) loose.delete('act');
  if (c.flags.halfStruck_augur) loose.delete('augur');
  if (c.flags.halfStruck_offshoot) loose.delete('offshoot');
  if (c.flags.roost_leave || c.flags.roost_carry) loose.delete('roost');
  c.halvesLoose = Array.from(loose);
  if (s.level && s.level.alive && c.season === 5) c.levelNorth = true;

  c.holder = winner;
  const wk = mostPegged(s, res.winner);
  if (winner === 'perch') {
    const charters: Charter[] = ['acres'];
    if (wk) charters.push(wk);
    const others = KINDS.filter((k) => !charters.includes(k));
    charters.push(pick(r, others));
    const perkPool = shuffle(r, Object.keys(PERKS).filter((k) => !c.perks.includes(k)));
    c.choices = { charters, laws: ['none', ...PERCH_LAWS], perks: perkPool.slice(0, 3) };
    c.charter = charters[0];
    c.law = 'none';
  } else {
    const wants = RIVALS[winner].wants[0];
    c.charter = wants && rint(r, 3) > 0 ? wants : wk && rint(r, 2) === 0 ? wk : 'acres';
    if (winner === 'either') c.charter = 'acres';
    c.law = LAW_OF[winner];
    const perkPool = shuffle(r, Object.keys(PERKS).filter((k) => !c.perks.includes(k)));
    c.choices = { charters: [], laws: [], perks: perkPool.slice(0, 3) };
  }
  c.rng = r.rng;
  c.season++;
  c.seats = c.season <= 6 ? seatsFor(c) : [];
  return { winner, perchRank, deputy, newTraits, added, lost };
}

export function choosePerk(c: Campaign, id: string): void {
  if (c.choices && c.choices.perks.includes(id) && !c.perks.includes(id)) c.perks.push(id);
  if (c.choices) c.choices.perks = [];
}

export function chooseCharter(c: Campaign, charter: Charter, law: Law): void {
  if (c.holder !== 'perch') return;
  c.charter = charter;
  c.law = law;
}
