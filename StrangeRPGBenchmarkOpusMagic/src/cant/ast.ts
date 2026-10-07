// Syntax tree, values, and diagnostics shared by the parser, the analyzer, and the interpreter.

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'name'; name: string; col: number }
  | { k: 'prop'; obj: Expr; name: string; col: number }
  | { k: 'call'; fn: string; args: Expr[]; col: number }
  | { k: 'un'; op: '-' | 'not'; e: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr };

interface StmtBase { line: number; head: string; mute?: boolean }

export type Stmt =
  | (StmtBase & { k: 'verb'; verb: string; target?: Expr })
  | (StmtBase & { k: 'say'; args: Expr[] })
  | (StmtBase & { k: 'wait' })
  | (StmtBase & { k: 'halt'; target?: Expr })
  | (StmtBase & { k: 'let'; name: string; e: Expr })
  | (StmtBase & { k: 'repeat'; count: Expr; body: Stmt[] })
  | (StmtBase & { k: 'if'; cond: Expr; then: Stmt[]; els?: Stmt[]; elseLine?: number })
  | (StmtBase & { k: 'each'; name: string; list: Expr; body: Stmt[] })
  | (StmtBase & { k: 'when'; event: string; times: number; body: Stmt[] })
  | (StmtBase & { k: 'cast'; name: string })
  | (StmtBase & { k: 'again' })
  | (StmtBase & { k: 'into'; target: Expr; body: Stmt; text: string; col: number });

export type Severity = 'error' | 'mute' | 'note';

export interface Diag {
  line: number;
  col: number;
  len: number;
  msg: string;
  sev: Severity;
}

export interface Program {
  src: string;
  stmts: Stmt[];
  diags: Diag[];
  /** Lines that hold code, after asides and blank lines are removed. */
  codeLines: number;
  /** Words the program uses, keyed by word, valued by the first line each appears on. */
  words: Map<string, number>;
}

export interface BodyRef { readonly __body: true; id: string; name: string }

export type Val = number | string | boolean | BodyRef | Val[] | null;

export function isBody(v: Val): v is BodyRef {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as BodyRef).__body === true;
}

export function show(v: Val): string {
  if (v === null) return 'nothing';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.length ? v.map(show).join(', ') : 'none';
  return v.name;
}
