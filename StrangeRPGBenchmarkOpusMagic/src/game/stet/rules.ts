// The rules of Stet: board, placement, flips, words, regional rules, and the score. Pure logic.
import { CARDS, Word } from './cards';

export type RuleId = 'plain' | 'still' | 'twin' | 'open' | 'fall' | 'copied';

export interface RuleDef {
  id: RuleId;
  name: string;
  home: string;
  text: string;
  color: number;
  /** The other side's turns during which the first card of the match cannot be flipped. Rules played together use the mean. */
  opening: number;
}

export const RULES: Record<RuleId, RuleDef> = {
  plain: { id: 'plain', name: 'Plain', home: 'Busy', color: 0xe6d8bc, opening: 2, text: 'A higher edge flips the card it faces. Nothing else.' },
  still: { id: 'still', name: 'Still', home: 'Standing', color: 0x6fe3e0, opening: 2, text: 'A card cannot be flipped on the turn after it is placed, unless that turn is the last.' },
  twin: { id: 'twin', name: 'Twin', home: 'Twice', color: 0xe07aa0, opening: 1, text: 'If a new card\'s edges equal the edges they face on two or more cards, those flip.' },
  open: { id: 'open', name: 'Open', home: 'the Ears', color: 0xa99ad8, opening: 3, text: 'Both hands are face up.' },
  fall: { id: 'fall', name: 'Fall', home: 'the Tether', color: 0x6f8cff, opening: 1, text: 'At the start of your turn, your cards on the board lose 1 from each edge.' },
  copied: { id: 'copied', name: 'Copied', home: 'the Press', color: 0xc8ff2e, opening: 3, text: 'A flipped card becomes a copy of the card that flipped it.' },
};

export type Side = 0 | 1;

export interface Flags { still: boolean; twin: boolean; open: boolean; fall: boolean; copied: boolean }

export interface HandCard { id: string; e: number[]; word: Word | null }

export interface Piece {
  /** The card shown, which changes when the piece becomes a copy. */
  id: string;
  /** The card that was played here, for stakes. */
  origin: string;
  side: Side;
  /** The side that played it, or the side it was copied for. */
  played: Side;
  e: number[];
  /** Edges as printed, to show raised and lowered numbers. */
  printed: number[];
  word: Word | null;
  at: number;
  /** The piece cannot be flipped while the turn number is this or lower. */
  ward: number;
  halted: boolean;
  /** again: 0 unused, 1 waiting to flip back, 2 spent. */
  again: 0 | 1 | 2;
  risen: boolean;
  copied: boolean;
}

export interface Match {
  rules: RuleId[];
  f: Flags;
  board: (Piece | null)[];
  hands: [HandCard[], HandCard[]];
  /** Card ids each side has placed, in order. */
  played: [string[], string[]];
  /** Placements made so far, 0 to 9. */
  turn: number;
  first: Side;
  /** The other side's turns during which the first card placed cannot be flipped. */
  opening: number;
}

export interface Move { h: number; cell: number; target: number }

export type Ev =
  | { k: 'place'; cell: number; side: Side; h: number; p: Piece }
  | { k: 'word'; cell: number; word: Word }
  | { k: 'copy'; cell: number; from: number; p: Piece }
  | { k: 'flip'; cell: number; by: number; how: 'edge' | 'twin' | 'each'; p: Piece }
  | { k: 'halt'; cell: number; p: Piece }
  | { k: 'mend'; cell: number; p: Piece }
  | { k: 'fall'; side: Side; board: (Piece | null)[] }
  | { k: 'back'; cell: number; p: Piece }
  | { k: 'rise'; cell: number; p: Piece };

/** Neighbors of each cell: up, right, down, left, or -1. */
export const NB: number[][] = [];
for (let i = 0; i < 9; i++) {
  const r = Math.floor(i / 3), c = i % 3;
  NB.push([r > 0 ? i - 3 : -1, c < 2 ? i + 1 : -1, r < 2 ? i + 3 : -1, c > 0 ? i - 1 : -1]);
}
const OPP = [2, 3, 0, 1];

/** Numbers the balance tool may change. wardTurns counts the other side's turns. opening below 0 uses the rules. */
export const TUNE = { wardTurns: 1, waitRise: 1, strike: 1, opening: -1 };

export function flagsOf(rules: RuleId[]): Flags {
  return { still: rules.includes('still'), twin: rules.includes('twin'), open: rules.includes('open'), fall: rules.includes('fall'), copied: rules.includes('copied') };
}

export function handCard(id: string): HandCard {
  const c = CARDS[id];
  return { id, e: c ? c.edges.slice() : [1, 1, 1, 1], word: c ? c.word : null };
}

export function newMatch(decks: [string[], string[]], rules: RuleId[], first: Side): Match {
  const rs = rules.filter((r) => r !== 'plain');
  const list: RuleId[] = rs.length ? rs : ['plain'];
  return {
    rules: list,
    opening: TUNE.opening >= 0 ? TUNE.opening : Math.round(list.reduce((a, r) => a + RULES[r].opening, 0) / list.length),
    f: flagsOf(rules),
    board: Array(9).fill(null),
    hands: [decks[0].map(handCard), decks[1].map(handCard)],
    played: [[], []],
    turn: 0,
    first,
  };
}

export function other(s: Side): Side { return (1 - s) as Side; }
export function toMove(m: Match): Side { return m.turn % 2 === 0 ? m.first : other(m.first); }
export function over(m: Match): boolean { return m.turn >= 9; }

function copyPiece(p: Piece): Piece { return { ...p, e: p.e.slice(), printed: p.printed }; }

export function clone(m: Match): Match {
  return {
    rules: m.rules,
    f: m.f,
    board: m.board.map((p) => (p ? copyPiece(p) : null)),
    hands: [m.hands[0].slice(), m.hands[1].slice()],
    played: [m.played[0].slice(), m.played[1].slice()],
    turn: m.turn,
    first: m.first,
    opening: m.opening,
  };
}

/** The edge a piece shows in direction d, after soak from the card it faces. */
export function eff(m: Match, cell: number, d: number): number {
  const p = m.board[cell]!;
  let v = p.e[d];
  const j = NB[cell][d];
  if (j >= 0) {
    const q = m.board[j];
    if (q && q.word === 'soak' && q.side !== p.side) v--;
  }
  return v < 1 ? 1 : v;
}

export function canFlip(m: Match, cell: number): boolean {
  const p = m.board[cell];
  return !!p && !p.halted && m.turn > p.ward;
}

/** Occupied cells next to a cell. */
export function adjacent(m: Match, cell: number): number[] {
  const out: number[] = [];
  for (const j of NB[cell]) if (j >= 0 && m.board[j]) out.push(j);
  return out;
}

export function needsTarget(word: Word | null): boolean { return word === 'copy' || word === 'halt'; }

export function legalMoves(m: Match): Move[] {
  const s = toMove(m);
  const hand = m.hands[s];
  const seen = new Set<string>();
  const out: Move[] = [];
  for (let h = 0; h < hand.length; h++) {
    const c = hand[h];
    const key = `${c.id}:${c.e.join(',')}:${c.word}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (let cell = 0; cell < 9; cell++) {
      if (m.board[cell]) continue;
      if (needsTarget(c.word)) {
        const t = adjacent(m, cell);
        if (!t.length) out.push({ h, cell, target: -1 });
        else for (const j of t) out.push({ h, cell, target: j });
      } else out.push({ h, cell, target: -1 });
    }
  }
  return out;
}

function snap(p: Piece): Piece { return copyPiece(p); }

function flip(m: Match, j: number, s: Side, by: Piece, ev: Ev[] | null, byCell: number, how: 'edge' | 'twin' | 'each') {
  const q = m.board[j]!;
  q.side = s;
  if (m.f.copied) {
    q.id = by.id;
    q.e = by.e.slice();
    q.printed = by.printed;
    q.word = by.word;
    q.copied = true;
    q.played = s;
    q.again = 0;
    q.risen = true;
  } else if (q.word === 'again') {
    if (q.played !== s && q.again === 0) q.again = 1;
    else if (q.played === s && q.again === 1) q.again = 0;
  }
  if (ev) ev.push({ k: 'flip', cell: j, by: byCell, how, p: snap(q) });
}

/** Places a card. Also runs the end of the turn and the start of the next one. */
export function play(m: Match, mv: Move, ev: Ev[] | null = null) {
  const s = toMove(m);
  const hc = m.hands[s][mv.h];
  m.hands[s].splice(mv.h, 1);
  m.played[s].push(hc.id);
  const cell = mv.cell;
  const p: Piece = {
    id: hc.id, origin: hc.id, side: s, played: s, e: hc.e.slice(), printed: hc.e, word: hc.word,
    at: m.turn, ward: m.f.still && m.turn < 7 ? m.turn + 1 : -1, halted: false, again: 0, risen: false, copied: false,
  };
  if (p.word === 'ward') p.ward = m.turn + 2 * TUNE.wardTurns - 1;
  if (m.turn === 0 && m.opening > 0) p.ward = Math.max(p.ward, 2 * m.opening - 1);
  m.board[cell] = p;
  if (ev) {
    ev.push({ k: 'place', cell, side: s, h: mv.h, p: snap(p) });
    if (p.word) ev.push({ k: 'word', cell, word: p.word });
  }

  const tgt = mv.target >= 0 && NB[cell].includes(mv.target) && m.board[mv.target] ? mv.target : -1;
  if (p.word === 'copy' && tgt >= 0) {
    const hi = Math.max(...m.board[tgt]!.e);
    let lo = 0;
    for (let d = 1; d < 4; d++) if (p.e[d] < p.e[lo]) lo = d;
    if (hi > p.e[lo]) {
      p.e[lo] = hi;
      if (ev) ev.push({ k: 'copy', cell, from: tgt, p: snap(p) });
    }
  }

  const caps: number[] = [];
  const how: ('edge' | 'twin' | 'each')[] = [];
  const bonus = p.word === 'strike' ? TUNE.strike : 0;
  for (let d = 0; d < 4; d++) {
    const j = NB[cell][d];
    if (j < 0) continue;
    const q = m.board[j];
    if (!q || q.side === s || !canFlip(m, j)) continue;
    if (eff(m, cell, d) + bonus > eff(m, j, OPP[d])) { caps.push(j); how.push('edge'); }
  }
  if (m.f.twin) {
    const same: number[] = [];
    for (let d = 0; d < 4; d++) {
      const j = NB[cell][d];
      if (j >= 0 && m.board[j] && eff(m, cell, d) === eff(m, j, OPP[d])) same.push(j);
    }
    if (same.length >= 2) {
      for (const j of same) {
        if (m.board[j]!.side !== s && canFlip(m, j) && !caps.includes(j)) { caps.push(j); how.push('twin'); }
      }
    }
  }
  if (p.word === 'each' && caps.length >= 2) {
    let best = -1, bestV = -1;
    for (const j of NB[cell]) {
      if (j < 0 || caps.includes(j)) continue;
      const q = m.board[j];
      if (!q || q.side === s || !canFlip(m, j)) continue;
      const v = q.e[0] + q.e[1] + q.e[2] + q.e[3];
      if (v > bestV) { best = j; bestV = v; }
    }
    if (best >= 0) { caps.push(best); how.push('each'); }
  }
  for (let i = 0; i < caps.length; i++) flip(m, caps[i], s, p, ev, cell, how[i]);

  if (p.word === 'halt' && tgt >= 0) {
    m.board[tgt]!.halted = true;
    if (ev) ev.push({ k: 'halt', cell: tgt, p: snap(m.board[tgt]!) });
  }
  if (p.word === 'mend') {
    for (const j of NB[cell]) {
      const q = j >= 0 ? m.board[j] : null;
      if (!q || q.side !== s) continue;
      for (let d = 0; d < 4; d++) if (q.e[d] < 9) q.e[d]++;
      if (ev) ev.push({ k: 'mend', cell: j, p: snap(q) });
    }
  }

  m.turn++;
  if (m.turn < 9) startTurn(m, ev);
}

function startTurn(m: Match, ev: Ev[] | null) {
  const s = toMove(m);
  if (m.f.fall && m.board.some((q) => q && q.side === s)) {
    for (const q of m.board) if (q && q.side === s) for (let d = 0; d < 4; d++) if (q.e[d] > 1) q.e[d]--;
    if (ev) ev.push({ k: 'fall', side: s, board: m.board.map((q) => (q ? snap(q) : null)) });
  }
  for (let i = 0; i < 9; i++) {
    const q = m.board[i];
    if (!q) continue;
    if (q.again === 1 && q.played === s && q.side !== s && !q.halted) {
      q.side = s;
      q.again = 2;
      if (ev) ev.push({ k: 'back', cell: i, p: snap(q) });
    }
    if (q.word === 'wait' && !q.risen && m.turn >= q.at + 2) {
      q.risen = true;
      for (let d = 0; d < 4; d++) q.e[d] = Math.min(9, q.e[d] + TUNE.waitRise);
      if (ev) ev.push({ k: 'rise', cell: i, p: snap(q) });
    }
  }
}

/** Cards each side holds: pieces on the board (a when piece counts twice) plus cards in hand. */
export function score(m: Match): [number, number] {
  const sc: [number, number] = [m.hands[0].length, m.hands[1].length];
  for (const q of m.board) {
    if (!q) continue;
    sc[q.side] += q.word === 'when' ? 2 : 1;
  }
  return sc;
}

/** 1 if side 0 wins, -1 if side 1 wins, 0 for a draw. */
export function outcome(m: Match): number {
  const [a, b] = score(m);
  return a > b ? 1 : a < b ? -1 : 0;
}

/** The cells a move would flip, for the preview. */
export function preview(m: Match, mv: Move): number[] {
  const c = clone(m);
  const ev: Ev[] = [];
  play(c, mv, ev);
  const out: number[] = [];
  for (const e of ev) if (e.k === 'flip' && !out.includes(e.cell)) out.push(e.cell);
  return out;
}

/** A small seeded random source, so simulations repeat. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
