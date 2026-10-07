// The battle engine. It has no drawing code: it resolves rounds instantly and records events for the view to play back.
import { BodyRef, Stmt, Val, isBody, show } from '../cant/ast';
import { CantError, Code, DryError, Proc, RunResult, World, compile, evalExpr, run, truthy } from '../cant/interp';
import { Expr } from '../cant/ast';
import { parse } from '../cant/parser';
import { VERBS } from '../cant/vocab';
import { intoInk } from '../cant/analyze';
import { Rng } from '../core/rng';
import { ALLIES, ENCOUNTERS, FOES, FoeDef } from './enemies';

export interface Body extends BodyRef {
  side: 'party' | 'foe';
  key: string;
  sprite: string;
  hp: number;
  max: number;
  armor: number;
  ward: number;
  wet: number;
  burn: number;
  marked: number;
  hushed: number;
  stamps: number;
  grinds: number;
  halted: boolean;
  copied: boolean;
  up: boolean;
  acted: number;
  ink: number;
  maxInk: number;
  regen: number;
  roteLines: string[];
  proc: Proc | null;
  smudged: Set<number>;
  guardedBy: Body | null;
  lastVerb: string | null;
  def: FoeDef | null;
  tags: string[];
  look: 'plain' | 'copied';
  phase: number;
  freed: boolean;
  isWait: boolean;
  xp: number;
  /** Lines others wrote into this rote. Each runs once, first thing on its next turn. */
  written: { text: string; code: Code; by: string }[];
  /** Nothing more can be written in until this round is over. A margin needs a turn to clear. */
  marginFull: number;
}

export interface BattlePage {
  name: string;
  src: string;
  stmts: Stmt[];
  code: Code | null;
  /** The seal set on the page, if any. */
  seal?: string;
  /** A foe wrote halt into the top of it. The next cast stops there. */
  closed?: boolean;
  /** A foe rewrote it. On the next cast its harm turns back on Wait. */
  corrected?: boolean;
}

export interface BattleSetup {
  enc: string;
  wait: { hp: number; max: number; ink: number; maxInk: number; regen: number; hands: number; ticks: number; nib?: number };
  allies: { key: string; hp: number; max: number }[];
  pages: BattlePage[];
  /** Words Wait can say without help. */
  canSay: (word: string) => boolean;
  /** Words lent by companions, keyed by word, valued by companion key. */
  lent: Record<string, string>;
  items: Record<string, number>;
  seed: number;
  /** Ends the fight with no result once this many rounds are done. */
  stopAfter?: number;
}

export type Snapshot = Pick<Body, 'hp' | 'max' | 'ward' | 'wet' | 'burn' | 'marked' | 'copied' | 'up' | 'armor' | 'halted' | 'hushed'> & { pen: number };

export type BEvent =
  | { t: 'round'; n: number }
  | { t: 'turn'; who: string }
  | { t: 'line'; who: string; page: string; line: number; text: string; mute: boolean }
  | { t: 'say'; who: string; text: string }
  | { t: 'written'; who: string; by: string; text: string }
  | { t: 'log'; text: string; tone?: 'bad' | 'good' | 'dim' | 'again' }
  | { t: 'verb'; who: string; verb: string; target: string | null }
  | { t: 'harm'; who: string; amount: number; snap: Snapshot }
  | { t: 'heal'; who: string; amount: number; snap: Snapshot }
  | { t: 'state'; who: string; snap: Snapshot }
  | { t: 'ink'; ink: number; max: number }
  | { t: 'fall'; who: string }
  | { t: 'spawn'; body: Body }
  | { t: 'reveal'; who: string }
  | { t: 'rote'; who: string }
  | { t: 'end'; page: string; reason: string; msg?: string }
  | { t: 'hint'; speaker: string; text: string };

export type Command =
  | { kind: 'cast'; page: number; target: string }
  | { kind: 'item'; item: string; target: string }
  | { kind: 'pass' }
  | { kind: 'write' }
  | { kind: 'flee' };

export interface PageStats { casts: number; harm: number; heal: number; best: number }

const HARM_SCALE = 1;

function snap(b: Body): Snapshot {
  return {
    hp: b.hp, max: b.max, ward: b.ward, wet: b.wet, burn: b.burn, marked: b.marked, copied: b.copied,
    up: b.up, armor: b.armor, halted: b.halted, hushed: b.hushed, pen: b.written.length,
  };
}

let nextId = 1;

function makeBody(p: Partial<Body> & { key: string; name: string; side: 'party' | 'foe'; hp: number; max: number }): Body {
  return {
    __body: true, id: `b${nextId++}`, sprite: p.key, armor: 0, ward: 0, wet: 0, burn: 0, marked: 0, hushed: 0,
    stamps: 0, grinds: 0, halted: false, copied: false, up: true, acted: 0, ink: 0, maxInk: 0, regen: 0,
    roteLines: [], proc: null, smudged: new Set(), guardedBy: null, lastVerb: null, def: null, tags: [],
    look: 'plain', phase: 0, freed: false, isWait: false, xp: 0, written: [], marginFull: 0, ...p,
  } as Body;
}

export class Battle implements World {
  party: Body[] = [];
  foes: Body[] = [];
  wait: Body;
  round = 0;
  rng: Rng;
  ev: BEvent[] = [];
  hands: Proc[] = [];
  phase: 'command' | 'over' | 'running' = 'running';
  result: 'win' | 'lose' | 'fled' | null = null;
  lastCast: string | null = null;
  lastTarget: Body | null = null;
  focus: Body | null = null;
  stats: Record<string, PageStats> = {};
  /** Casts whose seal has already acted, so a seal works once per cast. */
  private sealSpent = new WeakSet<Proc>();
  /** Casts of a corrected page. */
  private corrected = new WeakSet<Proc>();
  /** Lines someone else wrote in. The writer already paid for them. */
  private writtenProcs = new WeakSet<Proc>();
  private heavySpent = new WeakSet<Proc>();
  /** Set when Again halts from inside its own rote. */
  againHalted = false;
  usedAgain = false;
  hintStep = 0;
  phaseRound = 0;
  private cur: Proc[] = [];
  private handlerDepth = 0;
  private procOwner = new Map<Proc, Body>();
  private againHands: Proc[] = [];
  private playing = 0;

  constructor(public setup: BattleSetup) {
    this.rng = new Rng(setup.seed);
    const w = setup.wait;
    this.wait = makeBody({
      key: 'wait', name: 'Wait', side: 'party', hp: w.hp, max: w.max, ink: w.ink, maxInk: w.maxInk, regen: w.regen, isWait: true,
    });
    this.party.push(this.wait);
    for (const a of setup.allies) {
      const def = ALLIES[a.key];
      const b = makeBody({ key: a.key, name: def.name, side: 'party', hp: a.hp, max: a.max, armor: def.armor, sprite: def.sprite });
      this.giveRote(b, def.rote);
      this.party.push(b);
    }
    const enc = encounterOf(setup.enc);
    if (!enc) throw new Error(`unknown encounter ${setup.enc}`);
    for (const key of enc.foes) this.foes.push(this.makeFoe(key));
    for (const p of setup.pages) this.stats[p.name] = { casts: 0, harm: 0, heal: 0, best: 0 };
  }

  get enc() { return encounterOf(this.setup.enc)!; }

  makeFoe(key: string): Body {
    const def = FOES[key];
    if (!def) throw new Error(`unknown foe ${key}`);
    const b = makeBody({
      key, name: def.name, side: 'foe', hp: def.hp, max: def.hp, armor: def.armor, sprite: def.sprite, def,
      tags: def.tags ?? [], look: def.copied ? 'copied' : 'plain', xp: def.xp,
    });
    if (key === 'again') { b.maxInk = this.setup.wait.maxInk; b.ink = b.maxInk; b.regen = this.setup.wait.regen; }
    this.giveRote(b, def.rote);
    for (const n of def.smudge ?? []) b.smudged.add(n);
    return b;
  }

  giveRote(b: Body, src: string) {
    const prog = parse(src);
    if (prog.diags.some((d) => d.sev === 'error')) throw new Error(`bad rote for ${b.key}: ${prog.diags.map((d) => `${d.line}: ${d.msg}`).join('; ')}`);
    b.roteLines = src.split('\n');
    const code = compile(prog.stmts);
    if (b.proc) b.proc.replace(code);
    else b.proc = new Proc(b, null, b.key, code);
    this.procOwner.set(b.proc, b);
  }

  // ---------------------------------------------------------------- flow

  start(): BEvent[] {
    this.ev = [];
    this.beginRound();
    return this.flush();
  }

  act(cmd: Command): BEvent[] {
    this.ev = [];
    if (this.phase !== 'command') return this.flush();
    this.phase = 'running';
    switch (cmd.kind) {
      case 'cast': {
        const page = this.setup.pages[cmd.page];
        const target = this.byId(cmd.target) ?? this.livingFoes()[0] ?? null;
        if (page && page.code) this.castPage(page, target);
        else this.log('That page will not run. Fix it in your rote.', 'bad');
        break;
      }
      case 'item': this.useItem(cmd.item, this.byId(cmd.target)); break;
      case 'pass': this.log('Wait waits.', 'dim'); break;
      case 'write': this.log('Wait writes in the rote.', 'dim'); break;
      case 'flee':
        if (this.enc.noFlee) { this.log('There is no leaving this.', 'bad'); break; }
        this.log('Wait and the others get away.', 'dim');
        this.result = 'fled';
        this.phase = 'over';
        return this.flush();
    }
    this.restOfRound();
    return this.flush();
  }

  /** Replaces Wait's pages mid-fight, after writing. */
  setPages(pages: BattlePage[]) {
    this.setup.pages = pages;
    for (const p of pages) this.stats[p.name] ??= { casts: 0, harm: 0, heal: 0, best: 0 };
  }

  private flush(): BEvent[] {
    const out = this.ev;
    this.ev = [];
    return out;
  }

  private beginRound() {
    while (true) {
      if (this.checkOver()) return;
      if (this.setup.stopAfter && this.round >= this.setup.stopAfter) { this.phase = 'over'; return; }
      this.round++;
      this.emit({ t: 'round', n: this.round });
      for (const b of this.all()) b.acted = 0;
      this.giveHints();
      if (this.waitTurn()) return;
      if (this.checkOver()) return;
      this.restOfRoundInner();
    }
  }

  private restOfRound() {
    this.restOfRoundInner();
    this.beginRound();
  }

  private restOfRoundInner() {
    for (const a of this.party) {
      if (a.isWait || !a.up || this.result) continue;
      this.allyTurn(a);
      if (this.checkOver()) return;
    }
    for (const f of this.foes.slice()) {
      if (!f.up || this.result) continue;
      this.foeTurn(f);
      if (this.checkOver()) return;
    }
    this.endRound();
  }

  /** Runs the start of Wait's turn. Returns true when the player must choose. */
  private waitTurn(): boolean {
    const w = this.wait;
    if (!w.up) return false;
    this.emit({ t: 'turn', who: w.id });
    w.ward = 0;
    this.emitState(w);
    this.fire('foe acts', 'foe', w, null);
    w.ink = Math.min(w.maxInk, w.ink + w.regen);
    this.emit({ t: 'ink', ink: w.ink, max: w.maxInk });
    if (w.halted) {
      w.halted = false;
      this.log('Wait is halted and does nothing this turn.', 'bad');
      this.emitState(w);
      return false;
    }
    if (this.runWritten(w, this.lastTarget && this.lastTarget.up ? this.lastTarget : this.livingFoes()[0] ?? null)) return false;
    for (const p of this.hands.slice()) {
      if (p.status !== 'suspended') continue;
      this.runWaitProc(p);
      if (this.checkOver()) return false;
    }
    if (w.copied) {
      w.copied = false;
      this.emitState(w);
      const page = this.setup.pages.find((p) => p.name === this.lastCast);
      if (page && page.code) {
        this.log(`Copied. Wait casts ${page.name} again.`, 'again');
        const t = this.lastTarget && this.lastTarget.up ? this.lastTarget : this.livingFoes()[0] ?? null;
        this.castPage(page, t);
        return false;
      }
    }
    if (!w.up) return false;
    this.phase = 'command';
    return true;
  }

  private allyTurn(a: Body) {
    this.emit({ t: 'turn', who: a.id });
    this.fire('foe acts', 'foe', a, null);
    if (!a.up) return;
    for (const b of this.all()) if (b.guardedBy === a) { b.guardedBy = null; this.emitState(b); }
    a.ward = 0;
    if (a.halted) { a.halted = false; this.log(`${a.name} is halted.`, 'dim'); this.emitState(a); return; }
    const f = this.focus && this.focus.up ? this.focus : this.livingFoes()[0] ?? null;
    if (!f) return;
    a.proc!.foe = f;
    if (this.runWritten(a, f)) return;
    this.runRote(a);
  }

  private foeTurn(f: Body) {
    this.emit({ t: 'turn', who: f.id });
    this.fire('foe acts', 'party', f, null);
    if (!f.up) return;
    for (const b of this.all()) if (b.guardedBy === f) { b.guardedBy = null; this.emitState(b); }
    f.ward = 0;
    if (f.halted) {
      f.halted = false;
      this.log(f.key === 'again' && f.phase > 0 ? 'Again is halted. Again starts again.' : `${f.name} is halted.`, 'good');
      this.emitState(f);
      return;
    }
    this.emitState(f);
    const living = this.party.filter((b) => b.up);
    if (!living.length) return;
    const target = f.def?.target === 'wait' && this.wait.up ? this.wait : this.rng.pick(living);
    f.proc!.foe = target;
    if (this.runWritten(f, target)) return;
    if (f.key === 'again') {
      f.ink = Math.min(f.maxInk, f.ink + f.regen);
      for (const p of this.againHands.slice()) {
        if (p.status === 'suspended') { p.foe = target; this.runProc(p, f); }
      }
    }
    this.runRote(f);
  }

  private endRound() {
    for (const b of this.all()) {
      if (!b.up) continue;
      if (b.burn > 0) {
        this.log(`${b.name} burns.`, 'dim');
        this.harm(null, b, b.burn, false, true);
        b.burn = Math.max(0, b.burn - 1);
        this.emitState(b);
      }
      if (b.wet > 0) { b.wet--; this.emitState(b); }
    }
    this.fire('round ends', 'party', null, null);
    this.fire('round ends', 'foe', null, null);
  }

  private checkOver(): boolean {
    if (this.result) { this.phase = 'over'; return true; }
    if (this.round > 300) { this.result = 'lose'; this.phase = 'over'; return true; }
    if (this.againHalted) { this.result = 'win'; this.phase = 'over'; return true; }
    if (!this.foes.some((f) => f.up)) { this.result = 'win'; this.phase = 'over'; return true; }
    if (!this.party.some((p) => p.up)) { this.result = 'lose'; this.phase = 'over'; return true; }
    if (!this.wait.up && this.foes.some((f) => f.key === 'again')) { this.result = 'lose'; this.phase = 'over'; return true; }
    return false;
  }

  private giveHints() {
    const a = this.foes.find((f) => f.key === 'again');
    if (!a || a.phase === 0) return;
    const since = this.round - this.phaseRound;
    const hints: [number, string, string][] = [
      [1, 'GLOSS', 'It casts whatever you cast last. (All of it.)'],
      [2, 'WHEN', 'When it runs your page, it runs every line of your page.'],
      [3, 'EACH', 'Put the end in it.'],
      [4, 'EACH', 'Put halt in it. Five of us say halt.'],
    ];
    for (const [n, who, text] of hints) {
      if (since === n && this.hintStep < n) { this.hintStep = n; this.emit({ t: 'hint', speaker: who, text }); }
    }
  }

  // ---------------------------------------------------------------- casting

  castPage(page: BattlePage, target: Body | null) {
    const w = this.wait;
    if (!page.code) return;
    if (page.closed) {
      page.closed = false;
      this.log(`${page.name} opens to halt, written at the top in someone else's hand. It stops there.`, 'bad');
      this.emit({ t: 'end', page: page.name, reason: 'halted' });
      return;
    }
    this.lastCast = page.name;
    this.lastTarget = target;
    if (target && target.side === 'foe') this.focus = target;
    if (page.src.split('\n').some((l) => /^\s*again\s*(#.*)?$/.test(l))) {
      const room = this.party.some((b) => b.key === 'room');
      if (!this.usedAgain) this.log(room ? 'Far up, under the page of last lines, someone says the word back. Once.' : 'Somewhere up the river, something says the word back.', 'again');
      if (!this.usedAgain && room) this.emit({ t: 'hint', speaker: 'ROOM', text: 'Who was that? She sounded glad.' });
      this.usedAgain = true;
    }
    const live = this.hands.filter((p) => p.alive);
    if (live.length >= this.setup.wait.hands) {
      const old = live.find((p) => p.status !== 'listening') ?? live[0];
      old.status = 'done';
      old.frames = [];
      this.log(`Wait lets go of ${old.label}.`, 'dim');
    }
    this.hands = this.hands.filter((p) => p.alive);
    const p = new Proc(w, target, page.name, page.code);
    this.procOwner.set(p, w);
    if (page.corrected) {
      page.corrected = false;
      this.corrected.add(p);
      this.log(`${page.name} has been corrected. Its harm is aimed back at Wait.`, 'bad');
    }
    this.hands.push(p);
    this.stats[page.name] ??= { casts: 0, harm: 0, heal: 0, best: 0 };
    this.stats[page.name].casts++;
    this.log(`Wait casts ${page.name}.`);
    const before = this.stats[page.name].harm;
    this.runWaitProc(p);
    const dealt = this.stats[page.name].harm - before;
    if (dealt > this.stats[page.name].best) this.stats[page.name].best = dealt;
    this.fire('foe casts', 'foe', w, null);
  }

  private runWaitProc(p: Proc) {
    const r = this.runProc(p, this.wait);
    this.reportEnd(p, r);
  }

  private reportEnd(p: Proc, r: RunResult) {
    switch (r.reason) {
      case 'dry': this.log(`${p.label} runs dry on line ${r.line}.`, 'bad'); break;
      case 'tangled': this.log(`${p.label} is tangled on line ${r.line}.`, 'bad'); break;
      case 'error': this.log(`${p.label}, line ${r.line}: ${r.msg}`, 'bad'); break;
      case 'listening': this.log(`${p.label} is listening.`, 'dim'); break;
      default: break;
    }
    this.emit({ t: 'end', page: p.label, reason: r.reason, msg: r.msg });
  }

  private runProc(p: Proc, owner: Body): RunResult {
    this.cur.push(p);
    try {
      return run(p, this, owner.isWait ? this.setup.wait.ticks : 40, this.round);
    } finally {
      this.cur.pop();
    }
  }

  private runRote(b: Body) {
    const p = b.proc!;
    let wrapped = false;
    for (;;) {
      const r = this.runProc(p, b);
      if (b.key === 'again' && p.frames.length === 0 && r.reason === 'halted') {
        this.againHalted = true;
        return;
      }
      if (r.reason === 'wait') return;
      if (r.reason === 'error' || r.reason === 'dry' || r.reason === 'tangled') {
        this.log(`${b.name}'s rote stumbles: ${r.msg ?? r.reason}.`, 'dim');
        p.restart();
        return;
      }
      p.restart();
      if (wrapped || !b.up || this.result) return;
      wrapped = true;
    }
  }

  // ---------------------------------------------------------------- the World interface

  name(p: Proc, name: string): Val | undefined {
    const me = this.procOwner.get(p) ?? this.wait;
    switch (name) {
      case 'me': return me;
      case 'foe': return p.foe ?? this.opponents(me).find((b) => b.up) ?? null;
      case 'foes': return this.opponents(me).filter((b) => b.up);
      case 'allies': return this.side(me).filter((b) => b.up);
      case 'round': return this.round;
      case 'who': return p.bind.who ?? null;
      case 'by': return p.bind.by ?? null;
      case 'again': return this.foes.find((f) => f.key === 'again') ?? undefined;
    }
    return undefined;
  }

  prop(_p: Proc, obj: Val, name: string): Val {
    if (!isBody(obj)) throw new CantError(`${show(obj)} has no ${name}`);
    const b = obj as Body;
    switch (name) {
      case 'hp': return b.hp;
      case 'max': return b.max;
      case 'ward': return b.ward;
      case 'wet': return b.wet;
      case 'burn': return b.burn;
      case 'armor': return b.armor;
      case 'acted': return b.acted;
      case 'ink': return b.ink;
      case 'name': return b.name.toLowerCase();
      case 'up': return b.up;
      case 'copied': return b.copied;
      case 'written': return b.written.length;
      case 'next': {
        if (!b.proc) return 'nothing';
        const ins = b.proc.nextAction(true, this.judge(b));
        return !ins ? 'nothing' : ins.op === 'verb' ? ins.s.verb : 'halt';
      }
      case 'last': return b.isWait ? this.lastCast ?? 'nothing' : 'nothing';
      case 'pages': return (b.isWait || b.key === 'again') ? this.setup.pages.slice(1).filter((pg) => pg.code).map((pg) => pg.name) : [];
    }
    throw new CantError(`nothing has a ${name}`);
  }

  /** Evaluates a condition in a body's own rote, or gives up. */
  private judge(b: Body): (e: Expr) => boolean | null {
    return (e) => {
      try { return truthy(evalExpr(e, b.proc!, this)); } catch { return null; }
    };
  }

  hpOf(b: BodyRef): number { return (b as Body).hp; }
  rand(n: number): number { return this.rng.int(n); }

  canSay(p: Proc, word: string): boolean {
    const owner = this.procOwner.get(p);
    if (owner && !owner.isWait) return true;
    const lender = this.setup.lent[word];
    if (lender) {
      const a = this.party.find((b) => b.key === lender);
      if (a && a.up) return true;
      if (!this.setup.canSay(word)) return false;
    }
    return this.setup.canSay(word);
  }

  line(p: Proc, line: number, mute: boolean): void {
    const owner = this.procOwner.get(p) ?? this.wait;
    const frame = p.frameName;
    let text = '';
    if (owner.isWait || (owner.key === 'again' && frame !== owner.key)) {
      const pg = this.setup.pages.find((x) => x.name === frame);
      text = pg ? pg.src.split('\n')[line - 1] ?? '' : '';
    } else {
      text = owner.roteLines[line - 1] ?? '';
      if (owner.smudged.delete(line)) this.emit({ t: 'reveal', who: owner.id });
    }
    this.emit({ t: 'line', who: owner.id, page: frame, line, text, mute });
  }

  say(p: Proc, text: string): void {
    const owner = this.procOwner.get(p) ?? this.wait;
    this.emit({ t: 'say', who: owner.id, text });
  }

  page(p: Proc, name: string): Code | null {
    const owner = this.procOwner.get(p);
    if (owner && !owner.isWait && owner.key !== 'again') return null;
    return this.setup.pages.find((pg) => pg.name === name)?.code ?? null;
  }

  halt(p: Proc, target: Val, _line: number): void {
    const caster = this.procOwner.get(p) ?? this.wait;
    if (!caster.up) { p.frames = []; p.handlers = []; p.status = 'done'; return; }
    if (!isBody(target)) throw new CantError('halt needs one body, like foe');
    this.pay(caster, 3, 'halt');
    const t = target as Body;
    caster.acted++;
    if (t === caster) {
      p.frames = [];
      p.handlers = [];
      p.status = 'done';
      this.log(`${caster.name} halts itself.`, 'dim');
      return;
    }
    if (!t.up) { this.log(`${t.name} is already down.`, 'dim'); return; }
    t.halted = true;
    this.log(`${t.name} is halted.`, t.side === 'foe' ? 'good' : 'bad');
    if (t.isWait) {
      for (const h of this.hands) { h.status = 'done'; h.frames = []; }
      this.hands = [];
      this.log('Every spell in Wait\'s hands lets go.', 'bad');
    }
    this.emitState(t);
  }

  verb(p: Proc, verb: string, target: Val | undefined, _line: number): boolean {
    const c = this.procOwner.get(p) ?? this.wait;
    if (!c.up) { p.frames = []; p.handlers = []; p.status = 'done'; return false; }
    const def = VERBS[verb];
    if (!def) throw new CantError(`unknown verb ${verb}`);
    let t: Val;
    if (target === undefined) {
      if (verb === 'shout') t = this.opponents(c).filter((b) => b.up);
      else t = def.kind === 'harm' ? (p.foe ?? this.opponents(c).find((b) => b.up) ?? null) : c;
    } else t = target;
    if (this.corrected.has(p) && def.kind === 'harm') t = c;
    if (Array.isArray(t) && c.side === 'party' && verb !== 'shout') {
      throw new CantError(`${verb} needs one, not a list. use each`);
    }
    if (t === null) { this.log(`${c.name}: ${verb}, but nobody is there.`, 'dim'); return false; }
    if (!Array.isArray(t) && !isBody(t) && !(verb === 'play')) throw new CantError(`${verb} needs a body, not ${show(t)}`);
    const seal = c.isWait ? this.setup.pages.find((pg) => pg.name === p.label)?.seal : undefined;
    const firstVerb = !!seal && !this.sealSpent.has(p);
    if (firstVerb) this.sealSpent.add(p);
    if (!this.writtenProcs.has(p)) this.pay(c, seal === 'thrift' && firstVerb ? Math.max(0, def.ink - 1) : def.ink, verb);
    if (seal === 'heavy' && def.kind === 'harm' && !this.heavySpent.has(p) && isBody(t)) {
      this.heavySpent.add(p);
      (t as Body).marked += 3;
    }
    c.acted++;
    if (c.hushed > 0) {
      c.hushed--;
      this.log(`${c.name} is hushed. ${verb} does nothing.`, 'dim');
      this.emitState(c);
      return false;
    }
    c.lastVerb = verb;
    const tb = isBody(t) ? t as Body : null;
    this.emit({ t: 'verb', who: c.id, verb, target: tb ? tb.id : null });
    if (tb && !tb.up && verb !== 'press') {
      this.log(`${verb}: ${tb.name} is already down.`, 'dim');
      return false;
    }
    return this.effect(p, c, verb, t);
  }

  private effect(p: Proc, c: Body, verb: string, t: Val): boolean {
    const tb = (isBody(t) ? t : null) as Body | null;
    const each = (fn: (b: Body) => void) => {
      if (Array.isArray(t)) for (const x of t) { if (isBody(x) && (x as Body).up) fn(x as Body); }
      else if (tb) fn(tb);
    };
    switch (verb) {
      case 'strike': each((b) => this.harm(c, b, 3, true)); break;
      case 'mend': each((b) => this.heal(c, b, 4)); break;
      case 'ward': each((b) => { b.ward += 4; this.emitState(b); }); break;
      case 'soak': each((b) => { b.wet = Math.max(b.wet, 2); b.burn = 0; this.emitState(b); }); break;
      case 'jolt': each((b) => {
        if (b.wet > 0) { b.wet = 0; this.harm(c, b, 6, false); } else this.harm(c, b, 2, false);
      }); break;
      case 'sear': each((b) => {
        if (b.wet > 0) { b.wet = 0; this.log(`${b.name} hisses and dries.`, 'dim'); this.emitState(b); return; }
        this.harm(c, b, 1, false);
        if (b.up) { b.burn += 3; this.emitState(b); }
      }); break;
      case 'mark': each((b) => { b.marked += 3; this.emitState(b); }); break;
      case 'read': each((b) => { b.smudged.clear(); this.emit({ t: 'reveal', who: b.id }); }); break;
      case 'drain': each((b) => { const d = this.harm(c, b, 2, true); this.heal(c, c, d); }); break;
      case 'rust': each((b) => { b.armor = Math.max(0, b.armor - 1); this.emitState(b); }); break;
      case 'hush': each((b) => { b.hushed++; this.emitState(b); }); break;
      case 'erase': each((b) => this.erase(c, b)); break;
      case 'stet': each((b) => this.stet(b)); break;
      case 'close': each((b) => this.closePage(c, b)); break;
      case 'correct': each((b) => this.correctPage(c, b)); break;
      case 'bite': each((b) => this.harm(c, b, b.hp * 2 <= b.max ? 4 : 2, true)); break;
      case 'grind': each((b) => { this.harm(c, b, 2 + Math.min(6, c.grinds), true); }); c.grinds++; break;
      case 'drink': each((b) => {
        this.harm(c, b, 1, false);
        if (c.maxInk > 0) { c.ink = Math.min(c.maxInk, c.ink + 2); if (c.isWait) this.emit({ t: 'ink', ink: c.ink, max: c.maxInk }); }
        else {
          if (b.maxInk > 0) { b.ink = Math.max(0, b.ink - 2); if (b.isWait) this.emit({ t: 'ink', ink: b.ink, max: b.maxInk }); this.log(`${b.name} loses 2 ink.`, 'bad'); }
          this.heal(c, c, 2);
        }
      }); break;
      case 'burst':
        if (c.side === 'foe' && p === c.proc && p.frameName === c.key && Array.isArray(t)) {
          each((b) => this.harm(c, b, 5, false));
          this.log(`${c.name} bursts.`, 'dim');
          this.harm(null, c, c.hp + c.ward, false, true);
        } else {
          each((b) => this.harm(c, b, 6, false));
          this.harm(c, c, 2, false, true);
        }
        break;
      case 'stamp': each((b) => { this.harm(c, b, 1 + b.stamps, true); b.stamps++; }); break;
      case 'listen':
        if (c.maxInk > 0) {
          c.ink = Math.min(c.maxInk, c.ink + 2);
          if (c.isWait) this.emit({ t: 'ink', ink: c.ink, max: c.maxInk });
          return true;
        }
        c.ward += 2;
        this.emitState(c);
        break;
      case 'shout': each((b) => this.harm(c, b, 2, false)); break;
      case 'rest': c.grinds = 0; this.log(`${c.name} rests.`, 'good'); break;
      case 'stand': this.log(`${c.name} stands.`, 'dim'); break;
      case 'tick': this.log('Tick.', 'dim'); break;
      case 'spread': each((b) => { b.copied = true; this.log(`${b.name} is copied.`, 'again'); this.emitState(b); }); break;
      case 'write': each((b) => { b.copied = true; this.log(`${b.name} is written over.`, 'again'); this.harm(c, b, 2, false); }); break;
      case 'press':
        if (Array.isArray(t)) {
          const down = this.foes.find((f) => !f.up && f.tags.includes('copy') && !f.freed);
          if (down) {
            down.up = true; down.hp = down.max; down.ward = 0; down.burn = 0; down.wet = 0;
            down.proc!.restart();
            this.log(`${c.name} presses a copy back up.`, 'bad');
            this.emit({ t: 'spawn', body: down });
          } else this.log(`${c.name} has nothing to press.`, 'dim');
        } else each((b) => this.harm(c, b, 5, true));
        break;
      case 'split':
        if (c.hp >= 4 && this.foes.filter((f) => f.up).length < 6) {
          const half = Math.floor(c.hp / 2);
          c.hp -= half;
          const child = this.makeFoe(c.key);
          child.hp = half;
          child.max = c.max;
          child.xp = 2;
          this.foes.push(child);
          this.emitState(c);
          this.log(`${c.name} splits.`, 'bad');
          this.emit({ t: 'spawn', body: child });
        }
        break;
      case 'guard': each((b) => { if (b !== c) { b.guardedBy = c; this.log(`${c.name} stands in front of ${b.name}.`, 'dim'); this.emitState(b); } }); break;
      case 'bash': each((b) => this.harm(c, b, 4, true)); break;
      case 'peck': each((b) => this.harm(c, b, 1, false)); break;
      case 'note': each((b) => { b.marked += 3; b.smudged.clear(); this.emit({ t: 'reveal', who: b.id }); this.emitState(b); }); break;
      case 'copy': each((b) => {
        const v = b.lastVerb;
        if (!v || v === 'copy' || !VERBS[v]) return;
        this.log(`${c.name} copies ${v} back at ${b.name}.`, 'again');
        this.effect(p, c, v, b);
      }); break;
      case 'play': {
        if (p !== c.proc || this.playing > 0) { this.log('Again finds nothing to play.', 'again'); break; }
        const book = this.setup.pages.slice(1).filter((pg) => pg.code);
        let pg = typeof t === 'string' ? book.find((x) => x.name === t) : undefined;
        if (!pg) pg = book.length ? book[this.rng.int(book.length)] : undefined;
        if (!pg || !pg.code) { this.log('Again finds nothing to play.', 'again'); break; }
        this.log(`Again casts ${pg.name}.`, 'again');
        const q = new Proc(c, p.foe, pg.name, pg.code);
        this.procOwner.set(q, c);
        this.againHands = this.againHands.filter((h) => h.alive).slice(-1);
        this.againHands.push(q);
        this.playing++;
        try { this.runProc(q, c); } finally { this.playing--; }
        break;
      }
      default: throw new CantError(`${verb} does nothing yet`);
    }
    return false;
  }

  private erase(c: Body, b: Body) {
    if (b.def?.noErase || !b.proc) { this.log(`${b.name} writes the line back.`, 'again'); return; }
    const p = b.proc;
    const ins = p.nextAction(true, this.judge(b));
    if (!ins || (ins.op !== 'verb' && ins.op !== 'halt')) { this.log(`${b.name} has nothing left to erase.`, 'dim'); return; }
    p.erased.add(`${b.key}:${ins.s.line}`);
    this.log(`Erased from ${b.name}: ${b.roteLines[ins.s.line - 1]?.trim() ?? ''}`, 'good');
    this.emit({ t: 'reveal', who: b.id });
    if (!p.nextAction(true)) {
      if (b.def?.freeScene) {
        b.freed = true;
        b.up = false;
        this.log(`${b.name} is empty of it.`, 'good');
        this.emit({ t: 'fall', who: b.id });
      } else {
        this.log(`${b.name} has nothing left to do. It stops.`, 'good');
        this.fall(b, c);
      }
    }
    void c;
  }

  into(p: Proc, target: Val, body: Stmt, text: string, _line: number): void {
    const c = this.procOwner.get(p) ?? this.wait;
    if (Array.isArray(target)) throw new CantError('into needs one, not a list. use each');
    if (!isBody(target)) throw new CantError(`into needs a body, not ${show(target)}`);
    const t = target as Body;
    if (t.marginFull >= this.round && t !== c) { this.log(`${t.name}'s margin is still full from the last line. It clears after its next turn.`, 'dim'); return; }
    this.pay(c, intoInk(body), 'into');
    if (!t.up) { this.log(`${c.name} writes into ${t.name}, but nothing in it is running.`, 'dim'); return; }
    if (t.def?.noWrite) { this.log(`${t.name}'s rote has no room in it to write.`, 'dim'); return; }
    const nib = c.isWait ? this.setup.wait.nib ?? 2 : 1;
    const mine = this.all().flatMap((b) => b.written.filter((x) => x.by === c.id).map((x) => ({ b, x })));
    while (mine.length >= nib) {
      const old = mine.shift()!;
      old.b.written = old.b.written.filter((x) => x !== old.x);
      this.log(`${c.name} takes back the line in ${old.b.name}.`, 'dim');
      this.emitState(old.b);
    }
    t.written.push({ text, code: compile([body]), by: c.id });
    this.log(`${c.name} writes into ${t.name}: ${text}`, 'again');
    this.emit({ t: 'written', who: t.id, by: c.id, text });
    this.emitState(t);
    if (t.side !== c.side) this.fire('written', t.side, t, c, t);
  }

  /** Runs what others wrote into b, first thing on its turn. True when b's turn ends there. */
  private runWritten(b: Body, foe: Body | null): boolean {
    if (!b.written.length) return false;
    const lines = b.written;
    b.written = [];
    this.emitState(b);
    if (!b.isWait) b.marginFull = this.round + 1;
    let stop = false;
    for (const wl of lines) {
      const p = new Proc(b, foe, b.isWait ? 'written' : b.key, wl.code);
      this.procOwner.set(p, b);
      this.writtenProcs.add(p);
      this.log(`${b.name} runs a line someone wrote in: ${wl.text}`, 'again');
      const r = this.runProc(p, b);
      if (r.reason === 'wait' || r.reason === 'halted') stop = true;
      if (this.checkOver() || !b.up) return true;
    }
    if (stop) this.log(`${b.name}'s turn stops on the written line.`, 'good');
    return stop;
  }

  /** Crosses out what others wrote into b. On Wait it also clears closed and corrected pages. */
  private stet(b: Body) {
    let n = b.written.length;
    b.written = [];
    this.emitState(b);
    if (b.isWait) {
      for (const pg of this.setup.pages) { if (pg.closed || pg.corrected) n++; pg.closed = false; pg.corrected = false; }
    }
    this.log(n ? `Stet. ${n} written line${n > 1 ? 's' : ''} in ${b.name} crossed out.` : `Stet. Nothing was written into ${b.name}.`, n ? 'good' : 'dim');
  }

  /** A foe writes halt into the top of one of Wait's pages. */
  private closePage(c: Body, b: Body) {
    if (!b.isWait) return;
    for (const x of this.setup.pages) x.closed = false;
    const open = this.setup.pages.filter((pg) => pg.code && pg.name !== 'wait');
    if (!open.length) return;
    const pg = open[this.rng.int(open.length)];
    pg.closed = true;
    this.log(`${c.name} writes halt into the top of ${pg.name}.`, 'bad');
  }

  /** A foe rewrites one of Wait's pages so its next cast harms Wait. */
  private correctPage(c: Body, b: Body) {
    if (!b.isWait) return;
    for (const x of this.setup.pages) x.corrected = false;
    const open = this.setup.pages.filter((pg) => pg.code && pg.name !== 'wait');
    if (!open.length) return;
    const pg = open[this.rng.int(open.length)];
    pg.corrected = true;
    this.log(`${c.name} corrects ${pg.name}. Its foe now reads me.`, 'bad');
  }

  private pay(c: Body, ink: number, what: string) {
    if (c.maxInk <= 0 || ink <= 0) return;
    if (c.ink < ink) throw new DryError(`not enough ink for ${what}`);
    c.ink -= ink;
    if (c.isWait) this.emit({ t: 'ink', ink: c.ink, max: c.maxInk });
  }

  // ---------------------------------------------------------------- harm and healing

  harm(src: Body | null, t: Body, amount: number, physical: boolean, direct = false): number {
    if (!t.up) return 0;
    let target = t;
    if (!direct && t.guardedBy && t.guardedBy.up && t.guardedBy !== t) {
      target = t.guardedBy;
      this.log(`${target.name} takes it for ${t.name}.`, 'dim');
    }
    let amt = Math.round(amount * HARM_SCALE) + target.marked + (src && src.side === 'foe' && !(direct && src === target) ? src.def?.power ?? 0 : 0);
    if (target.marked) target.marked = 0;
    if (physical) amt = Math.max(0, amt - target.armor);
    const absorbed = Math.min(target.ward, amt);
    target.ward -= absorbed;
    amt -= absorbed;
    if (target.key === 'again' && target.phase > 0 && target.hp - amt < 1) {
      amt = Math.max(0, target.hp - 1);
      this.log('Again copies itself back.', 'again');
    }
    target.hp = Math.max(0, target.hp - amt);
    this.emit({ t: 'harm', who: target.id, amount: amt, snap: snap(target) });
    const cp = this.cur[this.cur.length - 1];
    if (src && src.isWait && cp && this.procOwner.get(cp) === this.wait) {
      const st = this.stats[cp.label];
      if (st) st.harm += amt;
    }
    if (target.hp <= 0) this.fall(target, src);
    else {
      if (amt > 0) this.fire('hurt', target.side, target, src, target);
      this.checkPhase(target);
    }
    return amt;
  }

  heal(src: Body | null, t: Body, n: number) {
    if (!t.up || n <= 0) return;
    const before = t.hp;
    t.hp = Math.min(t.max, t.hp + n);
    this.emit({ t: 'heal', who: t.id, amount: t.hp - before, snap: snap(t) });
    const cp = this.cur[this.cur.length - 1];
    if (src && src.isWait && cp && this.procOwner.get(cp) === this.wait) {
      const st = this.stats[cp.label];
      if (st) st.heal += t.hp - before;
    }
  }

  private fall(t: Body, by: Body | null) {
    if (!t.up) return;
    t.up = false;
    t.hp = 0;
    t.ward = 0;
    t.guardedBy = null;
    this.emit({ t: 'fall', who: t.id });
    this.log(`${t.name} goes down.`, t.side === 'foe' ? 'good' : 'bad');
    if (t.isWait) {
      for (const h of this.hands) { h.status = 'done'; h.frames = []; }
      this.hands = [];
    }
    for (const b of this.all()) if (b.guardedBy === t) b.guardedBy = null;
    if (t.tags.includes('original')) {
      for (const f of this.foes) {
        if (f.up && f.tags.includes('copy')) {
          f.up = false; f.hp = 0;
          this.emit({ t: 'fall', who: f.id });
        }
      }
      this.log('Every copy of Many sits down.', 'good');
    }
    this.fire('foe falls', t.side === 'foe' ? 'party' : 'foe', t, by);
  }

  private checkPhase(b: Body) {
    const phases = b.def?.phases;
    if (!phases || b.phase >= phases.length) return;
    const ph = phases[b.phase];
    if (b.hp <= b.max * ph.at) {
      b.phase++;
      this.giveRote(b, ph.rote);
      this.phaseRound = this.round;
      this.log(ph.log, 'again');
      this.emit({ t: 'rote', who: b.id });
    }
  }

  // ---------------------------------------------------------------- handlers

  private fire(event: string, side: 'party' | 'foe', who: Body | null, by: Body | null, hurtBody?: Body) {
    if (this.handlerDepth > 3 || this.result) return;
    const procs: Proc[] = [];
    if (side === 'party') {
      procs.push(...this.hands.filter((p) => p.alive));
      for (const a of this.party) if (!a.isWait && a.up && a.proc) procs.push(a.proc);
    } else {
      for (const f of this.foes) if (f.up && f.proc) procs.push(f.proc);
      procs.push(...this.againHands.filter((p) => p.alive));
    }
    for (const p of procs) {
      const owner = this.procOwner.get(p)!;
      if (!owner || !owner.up) continue;
      for (const h of p.handlers.slice()) {
        let match = h.event === event;
        if (event === 'hurt' || event === 'written') {
          match = (h.event === event && owner === hurtBody) || h.event === `ally ${event}`;
        }
        if (!match) continue;
        h.seen++;
        if (h.seen % h.times !== 0) continue;
        if (h.lastRound !== this.round) { h.lastRound = this.round; h.firedThisRound = 0; }
        const limit = 1;
        if (h.firedThisRound >= limit) continue;
        h.firedThisRound++;
        const q = new Proc(owner, p.foe, p.label, h.code, true, p.env, p.erased);
        q.bind = { who: who ?? null, by: by ?? null };
        this.procOwner.set(q, owner);
        this.handlerDepth++;
        try {
          const r = this.runProc(q, owner);
          if (owner.isWait && r.reason !== 'done') this.reportEnd(q, r);
          if (owner.key === 'again' && r.reason === 'halted' && q.frames.length === 0 && p === owner.proc) this.againHalted = true;
        } finally {
          this.handlerDepth--;
        }
        if (this.result) return;
      }
    }
  }

  // ---------------------------------------------------------------- items

  private useItem(item: string, target: Body | null) {
    const have = this.setup.items[item] ?? 0;
    if (have <= 0) { this.log('There are none left.', 'dim'); return; }
    if (target && target.side !== 'party') { this.log('That is for your own side.', 'dim'); return; }
    this.setup.items[item] = have - 1;
    const t = target ?? this.wait;
    switch (item) {
      case 'inkpot':
        this.wait.ink = Math.min(this.wait.maxInk, this.wait.ink + 6);
        this.emit({ t: 'ink', ink: this.wait.ink, max: this.wait.maxInk });
        this.log('Wait drinks an inkpot. +6 ink.', 'good');
        break;
      case 'salve':
        this.log(`A salve for ${t.name}.`, 'good');
        this.heal(null, t, 12);
        break;
      case 'bell':
        if (!t.up) {
          t.up = true; t.hp = Math.ceil(t.max / 2);
          if (t.proc) t.proc.restart();
          this.log(`${t.name} gets back up.`, 'good');
          this.emitState(t);
        } else this.log(`${t.name} is already up. The bell rings for nothing.`, 'dim');
        break;
    }
  }

  // ---------------------------------------------------------------- helpers

  all(): Body[] { return [...this.party, ...this.foes]; }
  side(b: Body): Body[] { return b.side === 'party' ? this.party : this.foes; }
  opponents(b: Body): Body[] { return b.side === 'party' ? this.foes : this.party; }
  livingFoes(): Body[] { return this.foes.filter((f) => f.up); }
  byId(id: string | undefined): Body | null { return this.all().find((b) => b.id === id) ?? null; }

  log(text: string, tone?: 'bad' | 'good' | 'dim' | 'again') { this.emit({ t: 'log', text, tone }); }
  private emit(e: BEvent) { this.ev.push(e); }
  private emitState(b: Body) { this.emit({ t: 'state', who: b.id, snap: snap(b) }); }

  xpEarned(): number {
    return this.foes.filter((f) => !f.up).reduce((s, f) => s + f.xp, 0);
  }
}

export function makePage(name: string, src: string): BattlePage {
  const prog = parse(src);
  const ok = !prog.diags.some((d) => d.sev === 'error');
  return { name, src, stmts: prog.stmts, code: ok ? compile(prog.stmts) : null };
}

export function encounterOf(id: string) {
  if (id.startsWith('foe:')) return { foes: id.slice(4).split(',') } as (typeof ENCOUNTERS)[string];
  return ENCOUNTERS[id];
}
