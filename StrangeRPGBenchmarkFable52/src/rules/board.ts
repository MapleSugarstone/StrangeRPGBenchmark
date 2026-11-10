import { BLANK, FIXED, OPEN } from './types';
import type { CharId, Charter, Companion, GameEvent, Kind, Player, State, Tile } from './types';
import { HALVES, KINDS, LOCALS, PAGE_CHILD, RIVALS } from './data';
import type { Face, LocalDef, Power } from './data';
import { T } from './tuning';

export const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function cellOf(x: number, y: number): number { return y * T.W + x; }
export function cx(c: number): number { return c % T.W; }
export function cy(c: number): number { return Math.floor(c / T.W); }
export function inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < T.W && y < T.H; }
export function pcell(p: Player): number { return p.y * T.W + p.x; }
export function dist(a: number, b: number): number { return Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b)); }
export function cellName(c: number): string { return 'ABCDEFG'[cx(c)] + (cy(c) + 1); }

export function neighbors(c: number): number[] {
  const out: number[] = [];
  const x = cx(c), y = cy(c);
  for (const [dx, dy] of DIRS) if (inside(x + dx, y + dy)) out.push(cellOf(x + dx, y + dy));
  return out;
}

export function emit(s: State, e: GameEvent): void {
  if (!s.quiet) s.events.push(e);
}

export function blankTile(): Tile {
  return { st: BLANK, a: 'road', b: 'road', k: null, peg: -1, official: false, site: null, den: null, denHp: 0, offer: null, by: -1 };
}

const LOCAL_BY_ID = new Map<string, LocalDef>(LOCALS.map((l) => [l.id, l]));
export function localDef(id: string): LocalDef | undefined { return LOCAL_BY_ID.get(id); }

/** The face a companion shows for its board power and its fight stats. */
export function compFace(c: Companion): Face {
  if (c.id === 'page') return PAGE_CHILD;
  const half = HALVES.find((h) => h.id === c.id);
  if (half) return half.face;
  const def = LOCAL_BY_ID.get(c.id)!;
  const r = c.fixed || c.active;
  return r === 2 ? def.b : def.a;
}

export function compName(c: Companion): string {
  if (c.id === 'page') return 'Page';
  const half = HALVES.find((h) => h.id === c.id);
  if (half) return half.name;
  return LOCAL_BY_ID.get(c.id)!.name;
}

export function hasPower(p: Player, power: Power): boolean {
  for (const c of p.ret) if (!c.down && compFace(c).power === power) return true;
  return false;
}

export function hasRelic(p: Player, id: string, r: number): boolean {
  for (const x of p.relics) if (x.id === id && (x.r === r || id === 'bubble')) return true;
  return false;
}

export function inTruce(s: State, a: number, b: number): boolean {
  for (const pr of s.promises) {
    if (pr.type === 'truce' && pr.state === 'open' && pr.until >= s.round && ((pr.who === a && pr.to === b) || (pr.who === b && pr.to === a))) return true;
  }
  return false;
}

export function canReach(p: Player): boolean {
  return hasPower(p, 'reach') || hasRelic(p, 'glass', 1) || p.perks.includes('longsight');
}

/** Cells the player can measure or peg from where the pawn stands. */
export function actCells(s: State, p: Player): number[] {
  const here = pcell(p);
  const out = [here];
  if (canReach(p)) for (const n of neighbors(here)) out.push(n);
  const t = s.tiles[here];
  if (t.st === FIXED && t.k === 'peak' && (t.peg === -1 || t.peg === p.idx || inTruce(s, p.idx, t.peg))) {
    for (const [dx, dy] of DIRS) {
      for (let i = 1; i <= 2; i++) {
        const x = p.x + dx * i, y = p.y + dy * i;
        if (!inside(x, y)) break;
        const c = cellOf(x, y);
        if (!out.includes(c)) out.push(c);
      }
    }
  }
  return out;
}

/** Blank cells the player can sketch onto. */
export function sketchCells(s: State, p: Player): number[] {
  const here = pcell(p);
  const out: number[] = [];
  for (const n of neighbors(here)) if (s.tiles[n].st === BLANK) out.push(n);
  const t = s.tiles[here];
  if (t.st === FIXED && t.k === 'peak' && (t.peg === -1 || t.peg === p.idx || inTruce(s, p.idx, t.peg))) {
    for (const [dx, dy] of DIRS) {
      const x = p.x + dx * 2, y = p.y + dy * 2;
      if (inside(x, y) && s.tiles[cellOf(x, y)].st === BLANK && !out.includes(cellOf(x, y))) out.push(cellOf(x, y));
    }
  }
  return out;
}

export function charterKinds(s: State): Kind[] {
  const out: Kind[] = s.charter === 'acres' ? KINDS.slice() : [s.charter];
  for (const a of s.amend) if (a.id === 'second_kind' && a.k && !out.includes(a.k)) out.push(a.k);
  return out;
}

function pegValue(s: State, t: Tile, owner: Player, kinds: Kind[], y: number): number {
  let v = 0;
  if (t.st === FIXED) {
    if (t.k && kinds.includes(t.k)) v = 1;
    if (s.law === 'headcount' && t.k === 'town') v += 1;
  } else if (t.st === OPEN) {
    if (kinds.includes(t.a) || kinds.includes(t.b)) v = owner.char === 'either' || s.amend.some((a) => a.id === 'openfull') ? 1 : 0.5;
  }
  if (v > 0 && s.law === 'frontier' && y <= 1) v += 1;
  return v;
}

/** Each player's own Charter count, before backing. */
export function ownCounts(s: State): number[] {
  const kinds = charterKinds(s);
  const out = s.players.map(() => 0);
  for (let c = 0; c < s.tiles.length; c++) {
    const t = s.tiles[c];
    if (t.peg >= 0) out[t.peg] += pegValue(s, t, s.players[t.peg], kinds, cy(c));
  }
  for (const p of s.players) {
    if (hasPower(p, 'pegunder')) {
      const t = s.tiles[pcell(p)];
      if (t.peg !== p.idx && !t.official) out[p.idx] += pegValue(s, t, p, kinds, p.y);
    }
  }
  return out;
}

/** Counts with each backer's count added to the party it backs. A backer scores 0. */
export function counts(s: State): number[] {
  const own = ownCounts(s);
  const out = own.slice();
  for (const p of s.players) {
    if (p.backs >= 0 && p.backs !== p.idx) {
      out[p.backs] += own[p.idx];
      out[p.idx] = 0;
    }
  }
  return out;
}

export function pegsOf(s: State, p: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < s.tiles.length; c++) if (s.tiles[c].peg === p) out.push(c);
  return out;
}

function largestGroup(cells: number[]): number {
  const set = new Set(cells);
  let best = 0;
  while (set.size) {
    const first = set.values().next().value as number;
    set.delete(first);
    const stack = [first];
    let n = 0;
    while (stack.length) {
      const c = stack.pop()!;
      n++;
      for (const m of neighbors(c)) if (set.delete(m)) stack.push(m);
    }
    if (n > best) best = n;
  }
  return best;
}

/** Progress toward a claim as [have, need]. The claim is true when have >= need. */
export function claimProgress(s: State, p: Player, id: string): [number, number] {
  const pegs = pegsOf(s, p.idx);
  const fixed = pegs.filter((c) => s.tiles[c].st === FIXED);
  const ofKind = (k: Kind) => fixed.filter((c) => s.tiles[c].k === k).length;
  switch (id) {
    case 'longline': return [largestGroup(pegs), T.claimLine];
    case 'fourkinds': {
      let kinds = 0;
      for (const k of KINDS) if (ofKind(k) > 0) kinds++;
      return [kinds + Math.min(pegs.length, T.claimKindsPegs), 4 + T.claimKindsPegs];
    }
    case 'deeppockets': return [Math.min(p.ink, T.claimPocketsInk) + Math.min(ofKind('well'), T.claimPocketsWells) * 3, T.claimPocketsInk + T.claimPocketsWells * 3];
    case 'opencountry': {
      const open = pegs.length - fixed.length;
      return [Math.min(p.doubt, T.claimOpenDoubt) + Math.min(open, T.claimOpenPegs) * 2, T.claimOpenDoubt + T.claimOpenPegs * 2];
    }
    case 'highground': return [ofKind('peak'), T.claimPeaks];
    case 'fullhouse': return [Math.min(p.ret.length, 2) + Math.min(ofKind('town'), T.claimTowns), 2 + T.claimTowns];
    case 'farfield': return [pegs.filter((c) => cy(c) <= 1).length, T.claimFarPegs];
    case 'cleanhands': return p.startedContest || p.brokePromise ? [0, T.claimCleanPegs] : [Math.min(pegs.length, T.claimCleanPegs), T.claimCleanPegs];
  }
  return [0, 1];
}

export function filedClaim(p: Player): string | null {
  if (!p.claim || !p.filed) return null;
  return p.filed === 1 ? p.claim.a : p.claim.b;
}

export function claimTrue(s: State, p: Player): boolean {
  const id = filedClaim(p);
  if (!id) return false;
  const [have, need] = claimProgress(s, p, id);
  return have >= need;
}

/** Ranks players for the Charter: count, then holder, then pegs, then ink plus doubt, then seat. */
export function charterRank(s: State): number[] {
  const cnt = counts(s);
  const doubtTies = s.amend.some((a) => a.id === 'doubtties');
  const key = (p: Player): number[] => [
    cnt[p.idx],
    doubtTies ? p.doubt : 0,
    hasRelic(p, 'match', 2) ? 1 : 0,
    p.idx === s.holder ? 1 : 0,
    p.perks.includes('roll') ? 1 : 0,
    T.pegs - p.pegs,
    p.ink + p.doubt,
    -p.idx,
  ];
  const out = (p: Player) => (p.backs >= 0 && p.backs !== p.idx) || p.filed > 0;
  const order = s.players.filter((p) => !out(p)).map((p) => p.idx);
  const backers = s.players.filter((p) => out(p)).map((p) => p.idx);
  if (!order.length) return backers;
  order.sort((a, b) => {
    const ka = key(s.players[a]), kb = key(s.players[b]);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  });
  return order.concat(backers);
}

/** Who would win if the sheet closed now, and how. */
export function standing(s: State): { winner: number; by: 'charter' | 'claim'; claim: string | null } {
  let best = -1;
  for (const p of s.players) {
    if (p.filed && claimTrue(s, p) && (best < 0 || p.filedOrder < s.players[best].filedOrder)) best = p.idx;
  }
  if (best >= 0) return { winner: best, by: 'claim', claim: filedClaim(s.players[best]) };
  return { winner: charterRank(s)[0], by: 'charter', claim: null };
}

export function wantsKinds(s: State, p: Player): Kind[] {
  const out = RIVALS[p.char as CharId].wants.slice();
  for (const k of charterKinds(s)) if (!out.includes(k)) out.push(k);
  return out;
}

/** Breadth-first distances over tiles a pawn can stand on. Unreachable cells are 99. */
export function distances(s: State, from: number): Int8Array {
  const d = new Int8Array(s.tiles.length).fill(99);
  d[from] = 0;
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const n of neighbors(c)) {
      if (d[n] === 99 && s.tiles[n].st !== BLANK) {
        d[n] = d[c] + 1;
        q.push(n);
      }
    }
  }
  return d;
}

export function pegsPlaced(p: Player): number { return T.pegs - p.pegs; }

export function charterOfTile(t: Tile, ch: Charter): boolean {
  if (ch === 'acres') return true;
  return t.st === FIXED ? t.k === ch : t.a === ch || t.b === ch;
}
