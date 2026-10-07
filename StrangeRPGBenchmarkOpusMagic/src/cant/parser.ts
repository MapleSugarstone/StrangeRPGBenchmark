// Line-based parser for the Cant. It never throws. Every problem becomes a diagnostic on its line.
import { Diag, Expr, Program, Stmt } from './ast';
import { FUNCTIONS, KEYWORDS, NAMES, VERBS, allWords, suggest } from './vocab';

export const MAX_LINE = 34;

type TokT = 'word' | 'num' | 'str' | 'op' | 'colon' | 'comma' | 'lp' | 'rp' | 'dot';
interface Tok { t: TokT; v: string; col: number }

class LineError extends Error {
  constructor(public col: number, public len: number, msg: string) { super(msg); }
}

interface RawLine { no: number; indent: number; toks: Tok[]; text: string }

const EVENT_FIRST = new Set(['hurt', 'written', 'ally', 'foe', 'round']);
const BLOCK_HEADS = new Set(['repeat', 'if', 'else', 'each', 'when']);

function tokenize(text: string, offset: number): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ') { i++; continue; }
    if (c === '#') break;
    const col = i + offset;
    if (/[a-z_]/.test(c)) {
      let j = i;
      while (j < text.length && /[a-z0-9_]/.test(text[j])) j++;
      toks.push({ t: 'word', v: text.slice(i, j), col });
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i;
      while (j < text.length && /[0-9]/.test(text[j])) j++;
      if (j < text.length && /[a-z_]/.test(text[j])) throw new LineError(col, j - i + 1, 'a number cannot run into a word');
      toks.push({ t: 'num', v: text.slice(i, j), col });
      i = j;
    } else if (c === '"') {
      const j = text.indexOf('"', i + 1);
      if (j < 0) throw new LineError(col, text.length - i, 'this quote is never closed');
      toks.push({ t: 'str', v: text.slice(i + 1, j), col });
      i = j + 1;
    } else if (c === ':') { toks.push({ t: 'colon', v: ':', col }); i++; }
    else if (c === ',') { toks.push({ t: 'comma', v: ',', col }); i++; }
    else if (c === '(') { toks.push({ t: 'lp', v: '(', col }); i++; }
    else if (c === ')') { toks.push({ t: 'rp', v: ')', col }); i++; }
    else if (c === '.') { toks.push({ t: 'dot', v: '.', col }); i++; }
    else {
      const two = text.slice(i, i + 2);
      if (['==', '!=', '<=', '>='].includes(two)) { toks.push({ t: 'op', v: two, col }); i += 2; }
      else if ('<>+-*/='.includes(c)) { toks.push({ t: 'op', v: c, col }); i++; }
      else throw new LineError(col, 1, `the Cant has no "${c}"`);
    }
  }
  return toks;
}

class TokStream {
  i = 0;
  constructor(public toks: Tok[], public endCol: number) {}
  peek(o = 0): Tok | undefined { return this.toks[this.i + o]; }
  next(): Tok | undefined { return this.toks[this.i++]; }
  done(): boolean { return this.i >= this.toks.length; }
  isWord(v: string, o = 0): boolean { const t = this.peek(o); return !!t && t.t === 'word' && t.v === v; }
  isOp(v: string): boolean { const t = this.peek(); return !!t && t.t === 'op' && t.v === v; }
  here(): number { return this.peek()?.col ?? this.endCol; }
  fail(msg: string, len = 1): never { throw new LineError(this.here(), len, msg); }
  expect(t: TokT, what: string): Tok {
    const k = this.peek();
    if (!k || k.t !== t) this.fail(`expected ${what} here`);
    return this.next()!;
  }
  word(what: string): Tok {
    const k = this.peek();
    if (!k || k.t !== 'word') this.fail(`expected ${what} here`);
    return this.next()!;
  }
}

const RESERVED = new Set([...Object.keys(KEYWORDS)].filter((w) => w !== 'again'));

function parseExpr(s: TokStream): Expr {
  return parseOr(s);
}
function parseOr(s: TokStream): Expr {
  let a = parseAnd(s);
  while (s.isWord('or')) { s.next(); a = { k: 'bin', op: 'or', a, b: parseAnd(s) }; }
  return a;
}
function parseAnd(s: TokStream): Expr {
  let a = parseNot(s);
  while (s.isWord('and')) { s.next(); a = { k: 'bin', op: 'and', a, b: parseNot(s) }; }
  return a;
}
function parseNot(s: TokStream): Expr {
  if (s.isWord('not')) { s.next(); return { k: 'un', op: 'not', e: parseNot(s) }; }
  return parseCmp(s);
}
function parseCmp(s: TokStream): Expr {
  const a = parseAdd(s);
  const t = s.peek();
  if (t && t.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(t.v)) {
    s.next();
    return { k: 'bin', op: t.v, a, b: parseAdd(s) };
  }
  if (t && t.t === 'op' && t.v === '=') s.fail('use == to compare. A single = is only for let');
  if (s.isWord('is')) {
    s.next();
    let op = '==';
    if (s.isWord('not')) { s.next(); op = '!='; }
    return { k: 'bin', op, a, b: parseAdd(s) };
  }
  return a;
}
function parseAdd(s: TokStream): Expr {
  let a = parseMul(s);
  while (s.isOp('+') || s.isOp('-')) { const op = s.next()!.v; a = { k: 'bin', op, a, b: parseMul(s) }; }
  return a;
}
function parseMul(s: TokStream): Expr {
  let a = parseUnary(s);
  while (s.isOp('*') || s.isOp('/')) { const op = s.next()!.v; a = { k: 'bin', op, a, b: parseUnary(s) }; }
  return a;
}
function parseUnary(s: TokStream): Expr {
  if (s.isOp('-')) { s.next(); return { k: 'un', op: '-', e: parseUnary(s) }; }
  return parsePostfix(s);
}
function parsePostfix(s: TokStream): Expr {
  let e = parsePrimary(s);
  while (s.peek()?.t === 'dot') {
    s.next();
    const w = s.peek();
    if (!w || w.t !== 'word') s.fail('expected something to look at after the dot, like hp');
    s.next();
    e = { k: 'prop', obj: e, name: w.v, col: w.col };
  }
  return e;
}
function parsePrimary(s: TokStream): Expr {
  const t = s.peek();
  if (!t) s.fail('expected something here');
  if (t.t === 'num') { s.next(); return { k: 'num', v: parseInt(t.v, 10) }; }
  if (t.t === 'str') { s.next(); return { k: 'str', v: t.v }; }
  if (t.t === 'lp') {
    s.next();
    const e = parseExpr(s);
    s.expect('rp', 'a closing )');
    return e;
  }
  if (t.t === 'word') {
    s.next();
    if (t.v === 'yes') return { k: 'bool', v: true };
    if (t.v === 'no') return { k: 'bool', v: false };
    if (s.peek()?.t === 'lp') {
      s.next();
      const args: Expr[] = [];
      if (s.peek()?.t !== 'rp') {
        args.push(parseExpr(s));
        while (s.peek()?.t === 'comma') { s.next(); args.push(parseExpr(s)); }
      }
      s.expect('rp', 'a closing )');
      return { k: 'call', fn: t.v, args, col: t.col };
    }
    if (FUNCTIONS[t.v]) throw new LineError(t.col, t.v.length, `${t.v} needs ( ) after it, like ${t.v}(foes)`);
    if (VERBS[t.v]) throw new LineError(t.col, t.v.length, `${t.v} is a verb. It goes at the start of a line`);
    if (RESERVED.has(t.v)) throw new LineError(t.col, t.v.length, `${t.v} cannot go here`);
    return { k: 'name', name: t.v, col: t.col };
  }
  s.fail(`did not expect "${t.v}" here`);
}

/** Parses the statement at the start of a token stream. Block bodies are attached by the caller. */
function parseStmt(s: TokStream, line: number): { stmt: Stmt; inline: TokStream | null; isElse: boolean } {
  const head = s.word('a word');
  const w = head.v;
  let stmt: Stmt;
  const needColon = (): TokStream | null => {
    if (s.peek()?.t !== 'colon') s.fail(`${w} needs a colon at the end`);
    s.next();
    if (s.done()) return null;
    const rest = new TokStream(s.toks.slice(s.i), s.endCol);
    s.i = s.toks.length;
    return rest;
  };
  let inline: TokStream | null = null;
  let isElse = false;
  switch (w) {
    case 'wait': stmt = { k: 'wait', line, head: w }; break;
    case 'again': stmt = { k: 'again', line, head: w }; break;
    case 'say': {
      const args = [parseExpr(s)];
      while (s.peek()?.t === 'comma') { s.next(); args.push(parseExpr(s)); }
      stmt = { k: 'say', args, line, head: w };
      break;
    }
    case 'halt': stmt = { k: 'halt', target: s.done() ? undefined : parseExpr(s), line, head: w }; break;
    case 'let': {
      const n = s.word('a name');
      if (VERBS[n.v] || KEYWORDS[n.v] || NAMES[n.v] || FUNCTIONS[n.v]) throw new LineError(n.col, n.v.length, `${n.v} is already a word of the Cant`);
      if (!s.isOp('=')) s.fail('let needs = after the name');
      s.next();
      stmt = { k: 'let', name: n.v, e: parseExpr(s), line, head: w };
      break;
    }
    case 'repeat': {
      const count = parseExpr(s);
      inline = needColon();
      stmt = { k: 'repeat', count, body: [], line, head: w };
      break;
    }
    case 'if': {
      const cond = parseExpr(s);
      inline = needColon();
      stmt = { k: 'if', cond, then: [], line, head: w };
      break;
    }
    case 'else': {
      inline = needColon();
      isElse = true;
      stmt = { k: 'if', cond: { k: 'bool', v: true }, then: [], line, head: w };
      break;
    }
    case 'each': {
      const n = s.word('a name for each one, like f');
      if (VERBS[n.v] || KEYWORDS[n.v] || NAMES[n.v] || FUNCTIONS[n.v]) throw new LineError(n.col, n.v.length, `${n.v} is already a word of the Cant`);
      if (!s.isWord('in')) s.fail('each needs "in" after the name');
      s.next();
      const list = parseExpr(s);
      inline = needColon();
      stmt = { k: 'each', name: n.v, list, body: [], line, head: w };
      break;
    }
    case 'when': {
      const a = s.word('an event, like hurt');
      if (!EVENT_FIRST.has(a.v)) throw new LineError(a.col, a.v.length, 'events are: hurt, ally hurt, written, ally written, foe acts, foe casts, foe falls, round ends');
      let event = a.v;
      if (a.v !== 'hurt' && a.v !== 'written') {
        const b = s.word('the rest of the event');
        event = `${a.v} ${b.v}`;
        const ok = ['ally hurt', 'ally written', 'foe acts', 'foe casts', 'foe falls', 'round ends'];
        if (!ok.includes(event)) throw new LineError(a.col, b.col + b.v.length - a.col, 'events are: hurt, ally hurt, written, ally written, foe acts, foe casts, foe falls, round ends');
      }
      let times = 1;
      if (s.peek()?.t === 'num') {
        times = Math.max(1, parseInt(s.next()!.v, 10));
        if (!s.isWord('times')) s.fail('a number here needs "times" after it');
        s.next();
      }
      inline = needColon();
      stmt = { k: 'when', event, times, body: [], line, head: w };
      break;
    }
    case 'into': {
      const target = parseExpr(s);
      if (s.peek()?.t !== 'colon') s.fail('into needs a colon after who it writes into');
      s.next();
      if (s.done()) s.fail('into needs the line to write, after the colon');
      const col = s.toks[s.i].col;
      const rest = new TokStream(s.toks.slice(s.i), s.endCol);
      s.i = s.toks.length;
      const inner = parseStmt(rest, line);
      if (BLOCK_HEADS.has(inner.stmt.head) || inner.stmt.k === 'into' || inner.stmt.k === 'again' || inner.stmt.k === 'cast') {
        throw new LineError(col, inner.stmt.head.length, `into writes one plain line. ${inner.stmt.head} cannot go in`);
      }
      stmt = { k: 'into', target, body: inner.stmt, text: '', col, line, head: w };
      break;
    }
    case 'cast': {
      const n = s.word('the name of a page');
      stmt = { k: 'cast', name: n.v, line, head: w };
      break;
    }
    default: {
      if (VERBS[w]) {
        let target: Expr | undefined;
        if (!s.done()) target = parseExpr(s);
        stmt = { k: 'verb', verb: w, target, line, head: w };
        break;
      }
      if (KEYWORDS[w] || NAMES[w] || FUNCTIONS[w]) throw new LineError(head.col, w.length, `a line cannot start with ${w}`);
      const sug = suggest(w, allWords());
      throw new LineError(head.col, w.length, sug ? `unknown word "${w}". did you mean ${sug}?` : `unknown word "${w}"`);
    }
  }
  if (!s.done()) s.fail('the line goes on after it should have ended');
  return { stmt, inline, isElse };
}

export function parse(src: string): Program {
  const diags: Diag[] = [];
  const raw: RawLine[] = [];
  const words = new Map<string, number>();
  const lines = src.split('\n');
  let codeLines = 0;
  lines.forEach((text, idx) => {
    const no = idx + 1;
    if (/\t/.test(text)) text = text.replace(/\t/g, '  ');
    const indent = text.length - text.trimStart().length;
    const body = text.slice(indent);
    if (!body || body.startsWith('#')) return;
    try {
      const toks = tokenize(body, indent);
      if (!toks.length) return;
      codeLines++;
      for (const t of toks) if (t.t === 'word' && !words.has(t.v)) words.set(t.v, no);
      raw.push({ no, indent, toks, text });
    } catch (e) {
      codeLines++;
      if (e instanceof LineError) diags.push({ line: no, col: e.col, len: e.len, msg: e.message, sev: 'error' });
      else throw e;
    }
  });

  let pos = 0;
  function block(indent: number): Stmt[] {
    const out: Stmt[] = [];
    while (pos < raw.length) {
      const L = raw[pos];
      if (L.indent < indent) break;
      if (L.indent > indent) {
        diags.push({ line: L.no, col: 0, len: L.indent, msg: 'this line is pushed in too far', sev: 'error' });
        pos++;
        continue;
      }
      pos++;
      const s = new TokStream(L.toks, L.text.length);
      try {
        const { stmt, inline, isElse } = parseStmt(s, L.no);
        if (stmt.k === 'into') stmt.text = L.text.slice(stmt.col).trim();
        if (BLOCK_HEADS.has(stmt.head)) attachBody(stmt, inline, L, isElse ? 'else' : stmt.head);
        if (isElse) {
          const prev = out[out.length - 1];
          if (!prev || prev.k !== 'if' || prev.head !== 'if' || prev.els) {
            diags.push({ line: L.no, col: L.indent, len: 4, msg: 'else must come right after an if block, at the same depth', sev: 'error' });
          } else {
            prev.els = (stmt as Extract<Stmt, { k: 'if' }>).then;
            prev.elseLine = L.no;
          }
        } else {
          out.push(stmt);
        }
      } catch (e) {
        if (!(e instanceof LineError)) throw e;
        diags.push({ line: L.no, col: e.col, len: e.len, msg: e.message, sev: 'error' });
        while (pos < raw.length && raw[pos].indent > indent) pos++;
      }
    }
    return out;
  }

  function attachBody(stmt: Stmt, inline: TokStream | null, L: RawLine, what: string) {
    const target: Stmt[] = stmt.k === 'if' ? stmt.then : (stmt as { body: Stmt[] }).body;
    if (inline) {
      const r = parseStmt(inline, L.no);
      if (r.isElse) throw new LineError(L.indent, 4, 'else cannot sit after a colon');
      if (BLOCK_HEADS.has(r.stmt.head)) {
        if (!r.inline) throw new LineError(L.indent, L.text.length - L.indent, 'a block after a colon needs its own line after its own colon');
        attachBody(r.stmt, r.inline, L, r.stmt.head);
      }
      target.push(r.stmt);
      if (pos < raw.length && raw[pos].indent > L.indent) {
        diags.push({ line: raw[pos].no, col: 0, len: raw[pos].indent, msg: 'the line above already has its one line after the colon', sev: 'error' });
        while (pos < raw.length && raw[pos].indent > L.indent) pos++;
      }
      return;
    }
    if (pos >= raw.length || raw[pos].indent <= L.indent) {
      throw new LineError(L.indent, what.length, `${what} needs lines pushed in under it`);
    }
    target.push(...block(raw[pos].indent));
  }

  const stmts = block(raw.length ? raw[0].indent : 0);
  if (raw.length && raw[0].indent > 0) diags.push({ line: raw[0].no, col: 0, len: raw[0].indent, msg: 'the first line should not be pushed in', sev: 'error' });
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > MAX_LINE) diags.push({ line: i + 1, col: MAX_LINE, len: lines[i].length - MAX_LINE, msg: `this line is ${lines[i].length} long. the most is ${MAX_LINE}`, sev: 'error' });
  }
  checkNames(stmts, diags);
  diags.sort((a, b) => a.line - b.line || a.col - b.col);
  return { src, stmts, diags, codeLines, words };
}

/** Flags names that are never bound by let or each, with a spelling suggestion. */
function checkNames(stmts: Stmt[], diags: Diag[]) {
  const bound = new Set<string>(Object.keys(NAMES));
  bound.add('again');
  const walkBind = (list: Stmt[]) => {
    for (const s of list) {
      if (s.k === 'let') bound.add(s.name);
      if (s.k === 'each') { bound.add(s.name); walkBind(s.body); }
      if (s.k === 'repeat' || s.k === 'when') walkBind(s.body);
      if (s.k === 'if') { walkBind(s.then); if (s.els) walkBind(s.els); }
    }
  };
  walkBind(stmts);
  const pool = [...bound];
  const visitExpr = (e: Expr | undefined, line: number) => {
    if (!e) return;
    switch (e.k) {
      case 'name':
        if (!bound.has(e.name)) {
          const sug = suggest(e.name, pool);
          diags.push({ line, col: e.col, len: e.name.length, msg: sug ? `"${e.name}" is not a name here. did you mean ${sug}?` : `"${e.name}" is not a name here. give it one with let`, sev: 'error' });
        }
        break;
      case 'prop':
        visitExpr(e.obj, line);
        if (!(e.name in PROPS_SET)) {
          const sug = suggest(e.name, Object.keys(PROPS_SET));
          diags.push({ line, col: e.col, len: e.name.length, msg: sug ? `nothing has a "${e.name}". did you mean ${sug}?` : `nothing has a "${e.name}"`, sev: 'error' });
        }
        break;
      case 'call':
        if (!FUNCTIONS[e.fn]) {
          const sug = suggest(e.fn, Object.keys(FUNCTIONS));
          diags.push({ line, col: e.col, len: e.fn.length, msg: sug ? `unknown function "${e.fn}". did you mean ${sug}?` : `unknown function "${e.fn}"`, sev: 'error' });
        }
        e.args.forEach((a) => visitExpr(a, line));
        break;
      case 'un': visitExpr(e.e, line); break;
      case 'bin': visitExpr(e.a, line); visitExpr(e.b, line); break;
      default: break;
    }
  };
  const walk = (list: Stmt[]) => {
    for (const s of list) {
      switch (s.k) {
        case 'verb': visitExpr(s.target, s.line); break;
        case 'say': s.args.forEach((a) => visitExpr(a, s.line)); break;
        case 'halt': visitExpr(s.target, s.line); break;
        case 'let': visitExpr(s.e, s.line); break;
        case 'repeat': visitExpr(s.count, s.line); walk(s.body); break;
        case 'if': visitExpr(s.cond, s.line); walk(s.then); if (s.els) walk(s.els); break;
        case 'each': visitExpr(s.list, s.line); walk(s.body); break;
        case 'when': walk(s.body); break;
        default: break;
      }
    }
  };
  walk(stmts);
}

const PROPS_SET: Record<string, true> = {
  hp: true, max: true, ward: true, wet: true, burn: true, armor: true, next: true, acted: true,
  ink: true, name: true, up: true, copied: true, last: true, pages: true, written: true,
};
