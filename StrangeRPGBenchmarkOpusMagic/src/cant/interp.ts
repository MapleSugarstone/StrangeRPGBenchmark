// Compiles Cant statements to a flat instruction list and runs it one statement at a time.
// The same runner drives Wait's spells, companion rotes, enemy rotes, and the test bench.
import { BodyRef, Expr, Stmt, Val, isBody, show } from './ast';

type S<K extends Stmt['k']> = Extract<Stmt, { k: K }>;

export type Instr =
  | { op: 'verb'; s: S<'verb'> }
  | { op: 'say'; s: S<'say'> }
  | { op: 'wait'; s: S<'wait'> }
  | { op: 'halt'; s: S<'halt'> }
  | { op: 'let'; s: S<'let'> }
  | { op: 'cast'; s: S<'cast'> }
  | { op: 'again'; s: S<'again'> }
  | { op: 'into'; s: S<'into'> }
  | { op: 'jmp'; to: number }
  | { op: 'if'; s: S<'if'>; elseTo: number; endTo: number }
  | { op: 'rep'; s: S<'repeat'>; slot: number; endTo: number }
  | { op: 'repnext'; slot: number; endTo: number }
  | { op: 'each'; s: S<'each'>; slot: number; endTo: number }
  | { op: 'eachnext'; s: S<'each'>; slot: number; endTo: number }
  | { op: 'when'; s: S<'when'>; code: Code };

export interface Code { instrs: Instr[]; slots: number }

export function compile(stmts: Stmt[]): Code {
  const code: Code = { instrs: [], slots: 0 };
  const emit = (list: Stmt[]) => {
    for (const s of list) {
      const I = code.instrs;
      switch (s.k) {
        case 'verb': I.push({ op: 'verb', s }); break;
        case 'say': I.push({ op: 'say', s }); break;
        case 'wait': I.push({ op: 'wait', s }); break;
        case 'halt': I.push({ op: 'halt', s }); break;
        case 'let': I.push({ op: 'let', s }); break;
        case 'cast': I.push({ op: 'cast', s }); break;
        case 'again': I.push({ op: 'again', s }); break;
        case 'into': I.push({ op: 'into', s }); break;
        case 'if': {
          const ins = { op: 'if' as const, s, elseTo: 0, endTo: 0 };
          I.push(ins);
          emit(s.then);
          if (s.els) {
            const j = { op: 'jmp' as const, to: 0 };
            I.push(j);
            ins.elseTo = I.length;
            emit(s.els);
            ins.endTo = I.length;
            j.to = I.length;
          } else {
            ins.elseTo = ins.endTo = I.length;
          }
          break;
        }
        case 'repeat': {
          const slot = code.slots++;
          const ins = { op: 'rep' as const, s, slot, endTo: 0 };
          I.push(ins);
          const top = I.length;
          const nx = { op: 'repnext' as const, slot, endTo: 0 };
          I.push(nx);
          emit(s.body);
          I.push({ op: 'jmp', to: top });
          ins.endTo = nx.endTo = I.length;
          break;
        }
        case 'each': {
          const slot = code.slots++;
          const ins = { op: 'each' as const, s, slot, endTo: 0 };
          I.push(ins);
          const top = I.length;
          const nx = { op: 'eachnext' as const, s, slot, endTo: 0 };
          I.push(nx);
          emit(s.body);
          I.push({ op: 'jmp', to: top });
          ins.endTo = nx.endTo = I.length;
          break;
        }
        case 'when': I.push({ op: 'when', s, code: compile(s.body) }); break;
      }
    }
  };
  emit(stmts);
  return code;
}

export class CantError extends Error {}
/** Thrown when the caster cannot pay for a verb. */
export class DryError extends CantError {}
/** Thrown when a statement uses a word the caster cannot say right now. */
export class MuteError extends CantError {}

export type EndReason = 'done' | 'wait' | 'tangled' | 'dry' | 'error' | 'halted' | 'listening';

export interface World {
  name(p: Proc, name: string): Val | undefined;
  prop(p: Proc, obj: Val, name: string): Val;
  hpOf(b: BodyRef): number;
  rand(n: number): number;
  canSay(p: Proc, word: string): boolean;
  /** Performs a verb. Returns true when the spell should wait afterward. */
  verb(p: Proc, verb: string, target: Val | undefined, line: number): boolean;
  say(p: Proc, text: string): void;
  halt(p: Proc, target: Val, line: number): void;
  page(p: Proc, name: string): Code | null;
  line(p: Proc, line: number, mute: boolean): void;
  /** Writes one line into another rote. Worlds without writing leave it out. */
  into?(p: Proc, target: Val, body: Stmt, text: string, line: number): void;
}

interface Frame { code: Code; pc: number; slots: unknown[]; name: string }

export interface Handler {
  event: string;
  times: number;
  seen: number;
  code: Code;
  lastRound: number;
  firedThisRound: number;
  key: Instr;
}

export class Proc {
  frames: Frame[] = [];
  env: Map<string, Val>;
  status: 'ready' | 'suspended' | 'listening' | 'done' = 'ready';
  handlers: Handler[] = [];
  ticks = 0;
  bind: { who?: Val; by?: Val } = {};
  /** Lines this process will not run, by page name. Used by erase. */
  erased: Set<string>;

  constructor(
    public owner: BodyRef,
    public foe: Val,
    public label: string,
    code: Code,
    public isHandler = false,
    env?: Map<string, Val>,
    erased?: Set<string>,
  ) {
    this.env = env ?? new Map();
    this.erased = erased ?? new Set();
    this.root = code;
    this.frames.push({ code, pc: 0, slots: new Array(code.slots), name: label });
  }

  root: Code;

  get alive(): boolean { return this.status !== 'done'; }

  /** Puts the process back at its first line, keeping its names and handlers. Rotes do this when they reach the end. */
  restart() {
    this.frames = [{ code: this.root, pc: 0, slots: new Array(this.root.slots), name: this.label }];
    this.status = 'ready';
  }

  /** Swaps in a new root program, as a boss does when its rote changes. */
  replace(code: Code) {
    this.root = code;
    this.handlers = [];
    this.restart();
  }

  /** The page name of the frame running now. */
  get frameName(): string { return this.frames[this.frames.length - 1]?.name ?? this.label; }

  /** The line the process will run next, following straight-line flow. */
  nextLine(): number | null {
    const f = this.frames[this.frames.length - 1];
    if (!f) return null;
    for (let pc = f.pc, guard = 0; pc < f.code.instrs.length && guard < 64; guard++) {
      const ins = f.code.instrs[pc];
      if (ins.op === 'jmp') { pc = ins.to; continue; }
      if (ins.op === 'repnext' || ins.op === 'eachnext') { pc++; continue; }
      return ins.s.line;
    }
    return null;
  }

  /** The next verb or halt the process will run, skipping waits, for erase and for .next. `judge` decides if conditions when it can. */
  nextAction(fromTop = true, judge?: (e: Expr) => boolean | null): Instr | null {
    const f = this.frames[this.frames.length - 1];
    if (!f) return null;
    const n = f.code.instrs.length;
    const acts = (ins: Instr) => (ins.op === 'verb' || ins.op === 'halt') && !this.erased.has(`${f.name}:${ins.s.line}`);
    let pc = f.pc;
    let wrapped = false;
    for (let guard = 0; guard < 128; guard++) {
      if (pc >= n) {
        if (!fromTop || wrapped) return null;
        pc = 0;
        wrapped = true;
      }
      const ins = f.code.instrs[pc];
      if (ins.op === 'jmp') { pc = ins.to; continue; }
      if (ins.op === 'if') {
        const v = judge ? judge(ins.s.cond) : null;
        if (v === false) { pc = ins.elseTo; continue; }
        if (v === true) { pc++; continue; }
        for (let k = pc + 1; k < ins.elseTo; k++) if (acts(f.code.instrs[k])) return f.code.instrs[k];
        pc = ins.elseTo;
        continue;
      }
      if (acts(ins)) return ins;
      pc++;
    }
    return null;
  }
}

const MAX_DEPTH = 4;

export function truthy(v: Val): boolean {
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function num(v: Val, what: string): number {
  if (typeof v !== 'number') throw new CantError(`${what} needs a number, and ${show(v)} is not one`);
  return v;
}

function list(v: Val, what: string): Val[] {
  if (!Array.isArray(v)) throw new CantError(`${what} needs a list, like foes`);
  return v;
}

function same(a: Val, b: Val): boolean {
  if (isBody(a) && isBody(b)) return a.id === b.id;
  return a === b;
}

export function evalExpr(e: Expr, p: Proc, w: World): Val {
  switch (e.k) {
    case 'num': return e.v;
    case 'str': return e.v;
    case 'bool': return e.v;
    case 'name': {
      if (p.env.has(e.name)) return p.env.get(e.name)!;
      const v = w.name(p, e.name);
      if (v === undefined) throw new CantError(`${e.name} has no value yet`);
      return v;
    }
    case 'prop': return w.prop(p, evalExpr(e.obj, p, w), e.name);
    case 'un': {
      const v = evalExpr(e.e, p, w);
      return e.op === '-' ? -num(v, '-') : !truthy(v);
    }
    case 'bin': {
      if (e.op === 'and') return truthy(evalExpr(e.a, p, w)) && truthy(evalExpr(e.b, p, w));
      if (e.op === 'or') return truthy(evalExpr(e.a, p, w)) || truthy(evalExpr(e.b, p, w));
      const a = evalExpr(e.a, p, w);
      const b = evalExpr(e.b, p, w);
      switch (e.op) {
        case '==': return same(a, b);
        case '!=': return !same(a, b);
        case '<': return num(a, '<') < num(b, '<');
        case '>': return num(a, '>') > num(b, '>');
        case '<=': return num(a, '<=') <= num(b, '<=');
        case '>=': return num(a, '>=') >= num(b, '>=');
        case '+':
          if (typeof a === 'string' || typeof b === 'string') return show(a) + show(b);
          return num(a, '+') + num(b, '+');
        case '-': return num(a, '-') - num(b, '-');
        case '*': return num(a, '*') * num(b, '*');
        case '/': {
          const d = num(b, '/');
          if (d === 0) throw new CantError('nothing can be divided by 0');
          return Math.trunc(num(a, '/') / d);
        }
      }
      throw new CantError(`unknown sign ${e.op}`);
    }
    case 'call': {
      if (!w.canSay(p, e.fn)) throw new MuteError(e.fn);
      const args = e.args.map((a) => evalExpr(a, p, w));
      const L = () => list(args[0] ?? null, e.fn);
      switch (e.fn) {
        case 'count': return L().length;
        case 'first': return L()[0] ?? null;
        case 'last': { const l = L(); return l[l.length - 1] ?? null; }
        case 'random': { const l = L(); return l.length ? l[w.rand(l.length)] : null; }
        case 'weakest':
        case 'strongest': {
          let best: Val = null;
          let bestHp = 0;
          for (const v of L()) {
            if (!isBody(v)) continue;
            const hp = w.hpOf(v);
            if (best === null || (e.fn === 'weakest' ? hp < bestHp : hp > bestHp)) { best = v; bestHp = hp; }
          }
          return best;
        }
        case 'min': return Math.min(num(args[0] ?? null, 'min'), num(args[1] ?? null, 'min'));
        case 'max': return Math.max(num(args[0] ?? null, 'max'), num(args[1] ?? null, 'max'));
      }
      throw new CantError(`unknown function ${e.fn}`);
    }
  }
}

export interface RunResult { reason: EndReason; msg?: string; line?: number }

/** Runs a process until it waits, ends, or breaks. Handlers registered on the way are left on the process. */
export function run(p: Proc, w: World, maxTicks: number, round: number): RunResult {
  p.ticks = 0;
  p.status = 'ready';
  let lastLine = 0;
  try {
    while (p.frames.length) {
      const f = p.frames[p.frames.length - 1];
      if (f.pc >= f.code.instrs.length) {
        p.frames.pop();
        continue;
      }
      const ins = f.code.instrs[f.pc];
      if (ins.op === 'jmp') { f.pc = ins.to; continue; }
      if (ins.op === 'repnext') {
        const left = f.slots[ins.slot] as number;
        if (left > 0) { f.slots[ins.slot] = left - 1; f.pc++; } else f.pc = ins.endTo;
        continue;
      }
      if (ins.op === 'eachnext') {
        const st = f.slots[ins.slot] as { items: Val[]; i: number };
        if (st.i < st.items.length) { p.env.set(ins.s.name, st.items[st.i++]); f.pc++; } else f.pc = ins.endTo;
        continue;
      }
      const s = ins.s;
      lastLine = s.line;
      if (++p.ticks > maxTicks) {
        p.status = 'done';
        return { reason: 'tangled', line: s.line, msg: `tangled: more than ${maxTicks} steps in one turn` };
      }
      const erased = p.erased.has(`${f.name}:${s.line}`);
      const muted = erased || !w.canSay(p, s.head);
      w.line(p, s.line, muted);
      if (muted) {
        f.pc = 'endTo' in ins ? ins.endTo : f.pc + 1;
        continue;
      }
      try {
        switch (ins.op) {
          case 'verb': {
            const target = ins.s.target ? evalExpr(ins.s.target, p, w) : undefined;
            f.pc++;
            if (w.verb(p, ins.s.verb, target, s.line)) {
              if (p.isHandler) { p.frames = []; p.status = 'done'; return { reason: 'done' }; }
              p.status = 'suspended';
              return { reason: 'wait' };
            }
            break;
          }
          case 'say':
            w.say(p, ins.s.args.map((a) => show(evalExpr(a, p, w))).join(' '));
            f.pc++;
            break;
          case 'wait':
            f.pc++;
            if (p.isHandler) { p.frames = []; p.status = 'done'; return { reason: 'done' }; }
            p.status = 'suspended';
            return { reason: 'wait' };
          case 'halt':
            if (ins.s.target) {
              const t = evalExpr(ins.s.target, p, w);
              f.pc++;
              w.halt(p, t, s.line);
              if (!p.alive) return { reason: 'halted', line: s.line };
            } else {
              p.frames = [];
              p.handlers = [];
              p.status = 'done';
              return { reason: 'halted', line: s.line };
            }
            break;
          case 'let':
            p.env.set(ins.s.name, evalExpr(ins.s.e, p, w));
            f.pc++;
            break;
          case 'into': {
            const t = evalExpr(ins.s.target, p, w);
            f.pc++;
            if (!w.into) throw new CantError('there is nothing here to write into');
            w.into(p, t, ins.s.body, ins.s.text, s.line);
            break;
          }
          case 'cast': {
            const bound = p.env.get(ins.s.name);
            const name = typeof bound === 'string' ? bound : ins.s.name;
            const code = w.page(p, name);
            f.pc++;
            if (!code) throw new CantError(`there is no page called ${name}`);
            if (p.frames.length >= MAX_DEPTH) throw new CantError('pages cast inside pages, too deep');
            p.frames.push({ code, pc: 0, slots: new Array(code.slots), name });
            break;
          }
          case 'again':
            f.pc = 0;
            break;
          case 'if':
            f.pc = truthy(evalExpr(ins.s.cond, p, w)) ? f.pc + 1 : ins.elseTo;
            break;
          case 'rep': {
            const n = num(evalExpr(ins.s.count, p, w), 'repeat');
            f.slots[ins.slot] = Math.max(0, Math.min(12, n));
            f.pc++;
            break;
          }
          case 'each': {
            const items = list(evalExpr(ins.s.list, p, w), 'each').slice();
            f.slots[ins.slot] = { items, i: 0 };
            f.pc++;
            break;
          }
          case 'when': {
            if (!p.handlers.some((h) => h.key === ins)) {
              p.handlers.push({ event: ins.s.event, times: ins.s.times, seen: 0, code: ins.code, lastRound: -1, firedThisRound: 0, key: ins });
            }
            f.pc++;
            break;
          }
        }
      } catch (e) {
        if (e instanceof MuteError) {
          f.pc = 'endTo' in ins ? ins.endTo : f.pc + (f.code.instrs[f.pc] === ins ? 1 : 0);
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    p.frames = [];
    p.status = 'done';
    if (e instanceof DryError) return { reason: 'dry', line: lastLine, msg: e.message };
    if (e instanceof CantError) return { reason: 'error', line: lastLine, msg: e.message };
    throw e;
  }
  if (p.handlers.length && !p.isHandler) {
    p.status = 'listening';
    return { reason: 'listening' };
  }
  p.status = 'done';
  void round;
  return { reason: 'done' };
}
