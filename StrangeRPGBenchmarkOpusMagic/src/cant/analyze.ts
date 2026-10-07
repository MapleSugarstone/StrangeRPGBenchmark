// Static checks for the editor: which lines the caster cannot say, and how much ink a page can spend.
import { Diag, Expr, Program, Stmt } from './ast';
import { VERBS } from './vocab';

/** Returns null when the word can be said, or the reason it cannot. */
export type VocabCheck = (word: string) => string | null;

export function vocabDiags(prog: Program, check: VocabCheck): Diag[] {
  const out: Diag[] = [];
  const seen = new Set<string>();
  const flag = (line: number, word: string) => {
    const why = check(word);
    const key = `${line}:${word}`;
    if (why && !seen.has(key)) {
      seen.add(key);
      out.push({ line, col: -1, len: 0, msg: why, sev: 'mute' });
    }
  };
  const visitExpr = (e: Expr | undefined, line: number) => {
    if (!e) return;
    if (e.k === 'call') { flag(line, e.fn); e.args.forEach((a) => visitExpr(a, line)); }
    else if (e.k === 'prop') visitExpr(e.obj, line);
    else if (e.k === 'un') visitExpr(e.e, line);
    else if (e.k === 'bin') { visitExpr(e.a, line); visitExpr(e.b, line); }
  };
  const walk = (list: Stmt[]) => {
    for (const s of list) {
      flag(s.line, s.head);
      if (s.k === 'if' && s.els && s.elseLine) flag(s.elseLine, 'if');
      switch (s.k) {
        case 'verb': visitExpr(s.target, s.line); break;
        case 'say': s.args.forEach((a) => visitExpr(a, s.line)); break;
        case 'halt': visitExpr(s.target, s.line); break;
        case 'let': visitExpr(s.e, s.line); break;
        case 'repeat': visitExpr(s.count, s.line); walk(s.body); break;
        case 'if': visitExpr(s.cond, s.line); walk(s.then); if (s.els) walk(s.els); break;
        case 'each': visitExpr(s.list, s.line); walk(s.body); break;
        case 'when': walk(s.body); break;
        case 'into':
          visitExpr(s.target, s.line);
          // Words only things can say may still be written into things.
          if (!VERBS[s.body.head]?.only) walk([s.body]);
          else if (s.body.k === 'verb') visitExpr(s.body.target, s.body.line);
          break;
        default: break;
      }
    }
  };
  walk(prog.stmts);
  return out;
}

export interface Cost {
  min: number;
  max: number;
  /** Turns the page can span, counting each wait. */
  turns: number;
  /** The page registers when handlers. */
  listens: boolean;
  /** The page can loop forever with again. */
  forever: boolean;
}

export type PageLookup = (name: string) => Stmt[] | null;

const MAX_EACH = 4;

/** Writing a line into another rote costs this much on top of the line's own ink. */
export const INTO_INK = 3;

/** The ink to write one line into another rote. */
export function intoInk(body: Stmt): number {
  return cost([body]).max + INTO_INK;
}

export function cost(stmts: Stmt[], lookup?: PageLookup, depth = 0): Cost {
  const c: Cost = { min: 0, max: 0, turns: 1, listens: false, forever: false };
  for (const s of stmts) {
    switch (s.k) {
      case 'verb': {
        const v = VERBS[s.verb];
        const ink = v ? v.ink : 0;
        c.min += ink; c.max += ink;
        if (s.verb === 'listen') c.turns++;
        break;
      }
      case 'halt':
        if (s.target) { c.min += 3; c.max += 3; }
        else return c;
        break;
      case 'wait': c.turns++; break;
      case 'repeat': {
        const b = cost(s.body, lookup, depth);
        const n = s.count.k === 'num' ? Math.max(0, Math.min(12, s.count.v)) : -1;
        if (n >= 0) { c.min += b.min * n; c.max += b.max * n; c.turns += (b.turns - 1) * n; }
        else { c.max += b.max * 12; c.turns += (b.turns - 1) * 12; }
        merge(c, b);
        break;
      }
      case 'if': {
        const a = cost(s.then, lookup, depth);
        const b = s.els ? cost(s.els, lookup, depth) : { min: 0, max: 0, turns: 1, listens: false, forever: false };
        c.min += Math.min(a.min, b.min);
        c.max += Math.max(a.max, b.max);
        c.turns += Math.max(a.turns, b.turns) - 1;
        merge(c, a); merge(c, b);
        break;
      }
      case 'each': {
        const b = cost(s.body, lookup, depth);
        c.max += b.max * MAX_EACH;
        c.turns += (b.turns - 1) * MAX_EACH;
        merge(c, b);
        break;
      }
      case 'when': c.listens = true; break;
      case 'cast': {
        const body = depth < 3 && lookup ? lookup(s.name) : null;
        if (body) {
          const b = cost(body, lookup, depth + 1);
          c.min += b.min; c.max += b.max; c.turns += b.turns - 1;
          merge(c, b);
        }
        break;
      }
      case 'again': c.forever = true; return c;
      case 'into': { const k = intoInk(s.body); c.min += k; c.max += k; break; }
      default: break;
    }
  }
  return c;
}

function merge(into: Cost, from: Cost) {
  into.listens ||= from.listens;
  into.forever ||= from.forever;
}

export function costLabel(c: Cost): string {
  if (c.forever) return 'ink: no end';
  const ink = c.min === c.max ? `ink ${c.min}` : `ink ${c.min}-${c.max}`;
  const turns = c.turns > 1 ? ` ${c.turns}t` : '';
  return `${ink}${turns}${c.listens ? ' +when' : ''}`;
}
