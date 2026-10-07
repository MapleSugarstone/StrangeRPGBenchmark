// Stet opponents' play: easy is greedy and slips, medium looks one reply ahead, hard searches the tree.
import { CARDS } from './cards';
import { HandCard, Match, Move, NB, Side, clone, eff, legalMoves, other, over, play, score, toMove } from './rules';

export type Level = 'easy' | 'medium' | 'hard';

export interface AiOpts {
  level: Level;
  /** Chance of picking a lesser move. */
  slip?: number;
  /** Placements the hard search may try before it settles. */
  nodes?: number;
  rand?: () => number;
}

export const HARD_NODES = 6000;

/** The match as one side sees it: unless hands are open, the other hand holds average cards. */
export function view(m: Match, side: Side): Match {
  if (m.f.open) return m;
  const o = other(side);
  let sum = 0, n = 0;
  for (const id of m.played[o]) { const c = CARDS[id]; if (c) { sum += c.edges[0] + c.edges[1] + c.edges[2] + c.edges[3]; n += 4; } }
  const v = n ? Math.round(sum / n) : 5;
  const c = clone(m);
  c.hands[o] = m.hands[o].map((): HandCard => ({ id: '?', e: [v, v, v, v], word: null }));
  return c;
}

/** Worth of a position for one side: cards held, plus a little for strong edges facing open cells. */
export function evaluate(m: Match, me: Side): number {
  const [a, b] = score(m);
  const diff = me === 0 ? a - b : b - a;
  if (over(m)) return (diff > 0 ? 1000 : diff < 0 ? -1000 : 0) + diff * 10;
  let pos = 0;
  for (let i = 0; i < 9; i++) {
    const p = m.board[i];
    if (!p) continue;
    const sign = p.side === me ? 1 : -1;
    if (p.halted) { pos += sign; continue; }
    for (let d = 0; d < 4; d++) {
      const j = NB[i][d];
      if (j < 0 || m.board[j]) continue;
      pos += sign * (eff(m, i, d) - 5) * 0.3;
    }
  }
  return diff * 10 + pos;
}

const ABORT = { abort: true };
let nodes = 0;
let budget = Infinity;

function children(m: Match, moves: Move[]): Match[] {
  return moves.map((mv) => {
    if (++nodes > budget) throw ABORT;
    const c = clone(m);
    play(c, mv);
    return c;
  });
}

function negamax(m: Match, depth: number, alpha: number, beta: number): number {
  const s = toMove(m);
  if (over(m) || depth === 0) return evaluate(m, s);
  const moves = legalMoves(m);
  const kids = children(m, moves);
  const keys = kids.map((k) => evaluate(k, s));
  const order = kids.map((_, i) => i).sort((x, y) => keys[y] - keys[x]);
  let best = -Infinity;
  for (const i of order) {
    const v = -negamax(kids[i], depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

function pickTop(moves: Move[], vals: number[], rand: () => number, eps = 0.001): Move {
  let best = -Infinity;
  for (const v of vals) if (v > best) best = v;
  const tied = moves.filter((_, i) => vals[i] >= best - eps);
  return tied[Math.floor(rand() * tied.length)];
}

function greedy(m: Match, me: Side, moves: Move[]): number[] {
  return children(m, moves).map((k) => evaluate(k, me));
}

/** Searches deeper until the node budget runs out or the game tree ends. */
function deep(m: Match, moves: Move[], rand: () => number, maxNodes: number): Move {
  nodes = 0;
  budget = maxNodes;
  const me = toMove(m);
  let kids: Match[];
  try { kids = children(m, moves); } catch { budget = Infinity; return moves[0]; }
  let order = kids.map((_, i) => i).sort((x, y) => evaluate(kids[y], me) - evaluate(kids[x], me));
  let choice = moves[order[0]];
  const left = 9 - m.turn;
  for (let depth = 2; depth <= left; depth++) {
    const vals = new Array<number>(moves.length).fill(-Infinity);
    try {
      let alpha = -Infinity;
      for (const i of order) {
        const v = -negamax(kids[i], depth - 1, -Infinity, -(alpha - 0.001));
        vals[i] = v;
        if (v > alpha) alpha = v;
      }
    } catch { break; }
    choice = pickTop(moves, vals, rand);
    order = order.slice().sort((x, y) => vals[y] - vals[x]);
  }
  budget = Infinity;
  return choice;
}

export function chooseMove(real: Match, o: AiOpts): Move {
  const rand = o.rand ?? Math.random;
  const me = toMove(real);
  const m = view(real, me);
  const moves = legalMoves(m);
  if (moves.length === 1) return moves[0];
  if (o.level === 'easy') {
    nodes = 0;
    const vals = greedy(m, me, moves);
    if (rand() < (o.slip ?? 0.3)) {
      const order = moves.map((_, i) => i).sort((x, y) => vals[y] - vals[x]);
      const k = Math.max(3, Math.ceil(order.length / 3));
      return moves[order[Math.floor(rand() * Math.min(k, order.length))]];
    }
    return pickTop(moves, vals, rand);
  }
  if (o.level === 'medium') {
    nodes = 0;
    budget = Infinity;
    const kids = children(m, moves);
    const vals = kids.map((k) => -negamax(k, 1, -Infinity, Infinity));
    if (o.slip && rand() < o.slip) {
      const order = moves.map((_, i) => i).sort((x, y) => vals[y] - vals[x]);
      return moves[order[Math.floor(rand() * Math.min(3, order.length))]];
    }
    return pickTop(moves, vals, rand);
  }
  return deep(m, moves, rand, o.nodes ?? HARD_NODES);
}
