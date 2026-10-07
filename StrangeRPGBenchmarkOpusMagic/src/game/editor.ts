// Wait's rote: the code editor. Live parsing, colors, completion, the manual under the cursor, and a test bench.
import { Diag } from '../cant/ast';
import { cost, costLabel, vocabDiags } from '../cant/analyze';
import { MAX_LINE, parse } from '../cant/parser';
import { EVENTS, FUNCTIONS, KEYWORDS, NAMES, PROPS, VERBS, docFor } from '../cant/vocab';
import { sfx } from '../engine/audio';
import { CW, text, wrap } from '../engine/font';
import { clip, setTextMode } from '../engine/input';
import { H, W, rect } from '../engine/screen';
import { Scene, app } from './app';
import { BEvent, Battle, makePage } from './battle';
import { FOES } from './enemies';
import { PAGE_COLORS, PageData, battleSetup, blankStats, canSay, lineLimit, pageLimit, pageSlots, whyNot } from './state';
import { C, panel } from './ui';

const LINE_H = 9;
const TOP = 12;
const GUT = 14;
const ROWS = 15;
const COLS = 35;

export type EditorMode = 'normal' | 'tutorial' | 'oneline' | 'battle' | 'margin';

interface Snapshot { lines: string[]; r: number; c: number }

export function colorize(line: string, onWord?: (w: string) => number | null): number[] {
  const cols = new Array(line.length).fill(C.text);
  const hash = line.indexOf('#');
  let inStr = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (!inStr && ch === '#') { for (let k = i; k < line.length; k++) cols[k] = C.aside; break; }
    if (ch === '"') {
      const end = line.indexOf('"', i + 1);
      const stop = end < 0 ? line.length : end + 1;
      for (let k = i; k < stop; k++) cols[k] = C.str;
      i = stop;
      continue;
    }
    if (/[0-9]/.test(ch)) { cols[i] = C.num; i++; continue; }
    if (/[a-z_]/.test(ch)) {
      let j = i;
      while (j < line.length && /[a-z0-9_]/.test(line[j])) j++;
      const w = line.slice(i, j);
      const afterDot = i > 0 && line[i - 1] === '.';
      const beforeParen = line[j] === '(';
      let col: number = C.text;
      if (afterDot) col = PROPS[w] ? C.prop : C.bad;
      else if (beforeParen && FUNCTIONS[w]) col = C.fn;
      else if (VERBS[w]) col = VERBS[w].color;
      else if (KEYWORDS[w]) col = C.kw;
      else if (NAMES[w]) col = 0xe6dfd0;
      else col = 0xc8c0a8;
      const o = onWord?.(w);
      if (o !== null && o !== undefined) col = o;
      for (let k = i; k < j; k++) cols[k] = col;
      i = j;
      continue;
    }
    if ('=<>!+-*/'.includes(ch)) cols[i] = 0xd8b0ff;
    else if (':(),.'.includes(ch)) cols[i] = C.dim;
    i++;
  }
  void hash;
  return cols;
}

export class Editor implements Scene {
  opaque = true;
  lines: string[] = [''];
  r = 0;
  c = 0;
  scroll = 0;
  undo: Snapshot[] = [];
  redo: Snapshot[] = [];
  diags: Diag[] = [];
  costText = '';
  codeLines = 0;
  popup: { title: string; lines: string[] } | null = null;
  completions: string[] = [];
  compIdx = 0;
  renaming: string | null = null;
  bench: Bench | null = null;
  pagePick: number | null = null;
  message = '';
  messageColor = C.dim;
  changed = false;
  blink = 0;
  private clipLine = '';
  private cycle: { r: number; start: number; list: string[]; idx: number } | null = null;

  constructor(public pageIdx: number, public mode: EditorMode = 'normal', public onClose?: (changed: boolean, result?: string) => void, public sheet?: PageData) {}

  get page(): PageData { return this.sheet ?? app.s.pages[this.pageIdx]; }

  private limit(): number { return this.mode === 'oneline' ? 1 : this.mode === 'margin' ? 12 : pageLimit(app.s, this.page); }

  enter() {
    if (this.mode === 'oneline') this.lines = [''];
    else this.loadPage();
    setTextMode((e) => this.key(e));
    clip.onPaste = (t) => this.paste(t);
    clip.onCopy = () => this.copyText();
    clip.onCut = () => { const t = this.copyText(); this.edit(() => this.deleteLine()); return t; };
    this.analyze();
  }

  leave() {
    setTextMode(null);
    clip.onPaste = clip.onCopy = clip.onCut = null;
  }

  resume() { setTextMode((e) => this.key(e)); }

  private loadPage() {
    this.lines = this.page.src.split('\n');
    this.r = Math.min(this.r, this.lines.length - 1);
    this.c = Math.min(this.c, this.lines[this.r].length);
    this.undo = [];
    this.redo = [];
    this.scroll = 0;
  }

  private commit() {
    if (this.mode === 'oneline' || this.page.fixed) return;
    const src = this.lines.join('\n').replace(/\s+$/g, '');
    if (src !== this.page.src) { this.page.src = src; this.changed = true; }
  }

  // ---------------------------------------------------------------- analysis

  analyze() {
    const src = this.lines.join('\n');
    const prog = parse(src);
    const s = app.s;
    this.diags = [...prog.diags, ...vocabDiags(prog, (w) => whyNot(s, w))];
    this.codeLines = prog.codeLines;
    const limit = this.limit();
    if (prog.codeLines > limit) this.diags.push({ line: this.lines.length, col: -1, len: 0, msg: `${prog.codeLines} lines. this page holds ${limit}`, sev: 'error' });
    if (prog.diags.some((d) => d.sev === 'error')) this.costText = '';
    else {
      const lookup = (n: string) => { const p = s.pages.find((x) => x.name === n); return p ? parse(p.src).stmts : null; };
      this.costText = costLabel(cost(prog.stmts, lookup));
    }
    this.diags.sort((a, b) => a.line - b.line || (a.sev === 'error' ? -1 : 1));
  }

  ok(): boolean { return !this.diags.some((d) => d.sev === 'error'); }

  // ---------------------------------------------------------------- keys

  private snap(): Snapshot { return { lines: this.lines.slice(), r: this.r, c: this.c }; }

  private edit(fn: () => void) {
    if (this.page?.fixed && this.mode !== 'oneline') { this.flash('page 1 is the Scrivener\'s. it cannot be changed', C.bad); sfx.error(); return; }
    this.undo.push(this.snap());
    if (this.undo.length > 200) this.undo.shift();
    this.redo = [];
    fn();
    this.clampCursor();
    this.analyze();
    this.updateCompletions();
  }

  private flash(msg: string, color: number = C.dim) { this.message = msg; this.messageColor = color; }

  private clampCursor() {
    this.r = Math.max(0, Math.min(this.lines.length - 1, this.r));
    this.c = Math.max(0, Math.min(this.lines[this.r].length, this.c));
    if (this.r < this.scroll) this.scroll = this.r;
    if (this.r >= this.scroll + ROWS) this.scroll = this.r - ROWS + 1;
  }

  private key(e: KeyboardEvent): boolean {
    this.blink = 0;
    if (!(e.key === 'Tab' && !e.shiftKey)) this.cycle = null;
    if (this.bench) return this.bench.key(e);
    if (this.popup) { if (['Escape', 'Enter', 'F1', ' '].includes(e.key) || e.key.length === 1) { this.popup = null; sfx.back(); } return true; }
    if (this.renaming !== null) return this.renameKey(e);
    if (this.pagePick !== null) return this.pickKey(e);
    const ctrl = e.ctrlKey || e.metaKey;
    const line = this.lines[this.r];
    if (ctrl && (e.key === 'v' || e.key === 'c' || e.key === 'x')) return false;
    switch (e.key) {
      case 'Escape': this.close(); return true;
      case 'F1': this.help(); return true;
      case 'F2': if ((this.mode === 'normal' || this.mode === 'battle') && !this.page.fixed) { this.renaming = this.page.name; sfx.ok(); } return true;
      case 'F5': this.test(); return true;
      case 'PageUp': this.completions = []; this.switchPage(-1); return true;
      case 'PageDown': this.completions = []; this.switchPage(1); return true;
      case 'ArrowUp':
        if (e.altKey) { this.edit(() => this.moveLine(-1)); return true; }
        if (this.completions.length > 1 && false) return true;
        this.r--; this.clampCursor(); this.completions = []; return true;
      case 'ArrowDown':
        if (e.altKey) { this.edit(() => this.moveLine(1)); return true; }
        this.r++; this.clampCursor(); this.completions = []; return true;
      case 'ArrowLeft':
        if (this.c > 0) this.c--; else if (this.r > 0) { this.r--; this.c = this.lines[this.r].length; }
        this.clampCursor(); this.completions = []; return true;
      case 'ArrowRight':
        if (this.c < line.length) this.c++; else if (this.r < this.lines.length - 1) { this.r++; this.c = 0; }
        this.clampCursor(); this.completions = []; return true;
      case 'Home': this.c = line.length - line.trimStart().length === this.c ? 0 : line.length - line.trimStart().length; this.completions = []; return true;
      case 'End': this.c = line.length; this.completions = []; return true;
      case 'Tab': {
        if (e.shiftKey) { this.edit(() => this.dedent()); return true; }
        const cy = this.cycle;
        if (cy && cy.r === this.r && this.c === cy.start + cy.list[cy.idx].length) {
          const next = (cy.idx + 1) % cy.list.length;
          const nl = line.slice(0, cy.start) + cy.list[next] + line.slice(this.c);
          if (nl.length <= MAX_LINE) {
            this.edit(() => { this.lines[this.r] = nl; this.c = cy.start + cy.list[next].length; });
            cy.idx = next;
          }
          this.completions = cy.list;
          this.compIdx = cy.idx;
          sfx.type();
          return true;
        }
        if (this.completions.length) {
          const list = this.completions.slice();
          const start = this.wordAtCursor().start;
          this.edit(() => this.complete());
          this.cycle = { r: this.r, start, list, idx: 0 };
          this.completions = list;
          this.compIdx = 0;
          sfx.type();
          return true;
        }
        if (this.lines[this.r].length + 2 <= MAX_LINE) this.edit(() => { this.lines[this.r] = line.slice(0, this.c) + '  ' + line.slice(this.c); this.c += 2; });
        return true;
      }
      case 'Enter':
        if (this.mode === 'oneline') { this.close(); return true; }
        this.edit(() => this.newline());
        sfx.type();
        return true;
      case 'Backspace':
        if (ctrl) { this.edit(() => this.deleteWordBack()); return true; }
        this.edit(() => this.backspace());
        return true;
      case 'Delete':
        this.edit(() => {
          if (this.c < line.length) this.lines[this.r] = line.slice(0, this.c) + line.slice(this.c + 1);
          else if (this.r < this.lines.length - 1 && line.length + this.lines[this.r + 1].length <= MAX_LINE) {
            this.lines[this.r] = line + this.lines[this.r + 1];
            this.lines.splice(this.r + 1, 1);
          }
        });
        return true;
    }
    if (ctrl) {
      switch (e.key.toLowerCase()) {
        case 'z': if (e.shiftKey) this.doRedo(); else this.doUndo(); return true;
        case 'y': this.doRedo(); return true;
        case 'd': this.edit(() => { if (this.mode !== 'oneline') { this.lines.splice(this.r, 0, this.lines[this.r]); this.r++; } }); return true;
        case 'h': this.help(); return true;
        case 't': this.test(); return true;
        case 'g': this.cycleColor(); return true;
        case 'k': this.edit(() => this.deleteLine()); return true;
        case 'l': this.openLibrary(); return true;
        case 'e': this.exportPage(); return true;
        case 'arrowleft': this.switchPage(-1); return true;
        case 'arrowright': this.switchPage(1); return true;
      }
      return true;
    }
    if (e.key.length === 1) {
      const ch = e.key.toLowerCase();
      if (!/^[ -~]$/.test(ch)) return true;
      if (line.length >= MAX_LINE) { this.flash(`a line holds ${MAX_LINE}`, C.bad); sfx.error(); return true; }
      this.edit(() => {
        this.lines[this.r] = line.slice(0, this.c) + ch + line.slice(this.c);
        this.c++;
      });
      sfx.type();
      return true;
    }
    return false;
  }

  private newline() {
    const line = this.lines[this.r];
    if (this.lines.length >= 40) return;
    const before = line.slice(0, this.c);
    const after = line.slice(this.c);
    let indent = line.length - line.trimStart().length;
    if (/:\s*(#.*)?$/.test(before) && !/:\s*\S/.test(before.replace(/#.*$/, '').replace(/^[^:]*:/, ''))) indent += 2;
    const pad = ' '.repeat(Math.min(indent, 12));
    this.lines[this.r] = before.replace(/\s+$/, '');
    this.lines.splice(this.r + 1, 0, pad + after.trimStart());
    this.r++;
    this.c = pad.length;
  }

  private backspace() {
    const line = this.lines[this.r];
    if (this.c > 0) {
      const lead = line.length - line.trimStart().length;
      if (this.c <= lead && this.c >= 2 && line.slice(this.c - 2, this.c) === '  ') {
        this.lines[this.r] = line.slice(0, this.c - 2) + line.slice(this.c);
        this.c -= 2;
      } else {
        this.lines[this.r] = line.slice(0, this.c - 1) + line.slice(this.c);
        this.c--;
      }
    } else if (this.r > 0) {
      const prev = this.lines[this.r - 1];
      if (prev.length + line.length > MAX_LINE) return;
      this.c = prev.length;
      this.lines[this.r - 1] = prev + line;
      this.lines.splice(this.r, 1);
      this.r--;
    }
  }

  private deleteWordBack() {
    const line = this.lines[this.r];
    let k = this.c;
    while (k > 0 && line[k - 1] === ' ') k--;
    while (k > 0 && /[a-z0-9_]/.test(line[k - 1])) k--;
    if (k === this.c && k > 0) k--;
    this.lines[this.r] = line.slice(0, k) + line.slice(this.c);
    this.c = k;
  }

  private dedent() {
    const line = this.lines[this.r];
    if (line.startsWith('  ')) { this.lines[this.r] = line.slice(2); this.c = Math.max(0, this.c - 2); }
  }

  private deleteLine() {
    if (this.lines.length === 1) { this.lines[0] = ''; this.c = 0; return; }
    this.lines.splice(this.r, 1);
  }

  private moveLine(d: number) {
    const j = this.r + d;
    if (j < 0 || j >= this.lines.length) return;
    [this.lines[this.r], this.lines[j]] = [this.lines[j], this.lines[this.r]];
    this.r = j;
  }

  private doUndo() {
    this.completions = [];
    const s = this.undo.pop();
    if (!s) return;
    this.redo.push(this.snap());
    this.lines = s.lines; this.r = s.r; this.c = s.c;
    this.analyze();
  }

  private doRedo() {
    this.completions = [];
    const s = this.redo.pop();
    if (!s) return;
    this.undo.push(this.snap());
    this.lines = s.lines; this.r = s.r; this.c = s.c;
    this.analyze();
  }

  private copyText(): string {
    this.clipLine = this.lines[this.r];
    this.flash('copied the line', C.dim);
    return this.lines[this.r];
  }

  private paste(t: string) {
    if (this.bench || this.renaming !== null || this.popup) return;
    const incoming = t.replace(/\r/g, '').toLowerCase().split('\n').map((l) => l.replace(/\t/g, '  ').slice(0, MAX_LINE));
    if (!incoming.length) return;
    this.edit(() => {
      if (this.mode === 'oneline') { this.lines[0] = (this.lines[0].slice(0, this.c) + incoming[0]).slice(0, MAX_LINE); this.c = this.lines[0].length; return; }
      if (incoming.length === 1) {
        const line = this.lines[this.r];
        this.lines[this.r] = (line.slice(0, this.c) + incoming[0] + line.slice(this.c)).slice(0, MAX_LINE);
        this.c = Math.min(MAX_LINE, this.c + incoming[0].length);
      } else {
        this.lines.splice(this.r + 1, 0, ...incoming);
        this.r += incoming.length;
        this.c = this.lines[this.r].length;
      }
    });
    this.flash('pasted', C.dim);
  }

  private exportPage() {
    const t = this.lines.join('\n');
    try { void navigator.clipboard?.writeText(t); this.flash('the whole page is on your clipboard', C.good); } catch { this.flash('the clipboard said no', C.bad); }
  }

  private cycleColor() {
    if (this.page.fixed || this.mode === 'oneline') return;
    this.page.color = (this.page.color + 1) % PAGE_COLORS.length;
    this.changed = true;
    sfx.move();
  }

  // ---------------------------------------------------------------- completion

  private wordAtCursor(): { start: number; word: string; afterDot: boolean } {
    const line = this.lines[this.r];
    let k = this.c;
    while (k > 0 && /[a-z0-9_]/.test(line[k - 1])) k--;
    return { start: k, word: line.slice(k, this.c), afterDot: k > 0 && line[k - 1] === '.' };
  }

  private vocabulary(afterDot: boolean): string[] {
    if (afterDot) return Object.keys(PROPS);
    const s = app.s;
    const words = new Set<string>();
    for (const w of [...Object.keys(VERBS), ...Object.keys(KEYWORDS), ...Object.keys(FUNCTIONS)]) if (canSay(s, w) && w !== 'again') words.add(w);
    for (const n of Object.keys(NAMES)) words.add(n);
    for (const w of ['in', 'and', 'or', 'not', 'is', 'yes', 'no', 'else']) if (KEYWORDS[w] && (w !== 'else' || canSay(s, 'if'))) words.add(w);
    for (const e of Object.keys(EVENTS)) for (const p of e.split(' ')) words.add(p);
    for (const l of this.lines) for (const m of l.matchAll(/\b(?:let|each)\s+([a-z_][a-z0-9_]*)/g)) words.add(m[1]);
    if (canSay(s, 'cast')) for (const p of s.pages) words.add(p.name);
    return [...words];
  }

  private updateCompletions() {
    const { word, afterDot } = this.wordAtCursor();
    if (!word.length && !afterDot) { this.completions = []; return; }
    const pool = this.vocabulary(afterDot);
    this.completions = pool.filter((w) => w.startsWith(word) && w !== word).sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 5);
    this.compIdx = 0;
  }

  private complete() {
    const { start } = this.wordAtCursor();
    const w = this.completions[this.compIdx % this.completions.length];
    const line = this.lines[this.r];
    const next = line.slice(0, start) + w + line.slice(this.c);
    if (next.length > MAX_LINE) return;
    this.lines[this.r] = next;
    this.c = start + w.length;
    this.completions = [];
  }

  // ---------------------------------------------------------------- help, pages, test

  private help() {
    const line = this.lines[this.r];
    let a = this.c, b = this.c;
    while (a > 0 && /[a-z0-9_]/.test(line[a - 1])) a--;
    while (b < line.length && /[a-z0-9_]/.test(line[b])) b++;
    const w = line.slice(a, b);
    const doc = w ? docFor(w) : null;
    const why = w ? whyNot(app.s, w) : null;
    const diag = this.diags.find((d) => d.line === this.r + 1);
    const body: string[] = [];
    if (doc) body.push(...wrap(doc, 33));
    if (why && (VERBS[w] || KEYWORDS[w] || FUNCTIONS[w])) body.push('', ...wrap(why, 33));
    if (diag) body.push('', ...wrap(`line ${diag.line}: ${diag.msg}`, 33));
    if (!body.length) body.push(...wrap('Put the cursor on a word and press F1 to read about it. Open the Primers from the menu for more.', 33));
    this.popup = { title: w || 'help', lines: body };
    sfx.ok();
  }

  private switchPage(d: number) {
    if (this.mode !== 'normal') return;
    this.commit();
    const s = app.s;
    const slots = pageSlots(s) + 1;
    let i = this.pageIdx + d;
    if (i < 0) i = Math.min(slots, s.pages.length + 1) - 1;
    if (i >= slots) i = 0;
    if (i >= s.pages.length) {
      if (i > s.pages.length) i = 0;
      else s.pages.push({ id: `p${Date.now()}`, name: freshName(), src: '', color: s.pages.length % PAGE_COLORS.length, stats: blankStats() });
    }
    this.pageIdx = i;
    this.loadPage();
    this.analyze();
    sfx.move();
  }

  private openLibrary() {
    const lib = app.s.library;
    if (!lib.length) { this.flash('no pages in the Library yet', C.dim); return; }
    this.pagePick = 0;
    sfx.ok();
  }

  private pickKey(e: KeyboardEvent): boolean {
    const lib = app.s.library;
    if (e.key === 'Escape') { this.pagePick = null; sfx.back(); return true; }
    if (e.key === 'ArrowUp') { this.pagePick = (this.pagePick! + lib.length - 1) % lib.length; sfx.move(); return true; }
    if (e.key === 'ArrowDown') { this.pagePick = (this.pagePick! + 1) % lib.length; sfx.move(); return true; }
    if (e.key === 'Enter' || e.key === 'z' || e.key === ' ') {
      const entry = lib[this.pagePick!];
      this.pagePick = null;
      this.edit(() => {
        const add = entry.src.split('\n');
        if (this.lines.length === 1 && !this.lines[0].trim()) this.lines = add;
        else this.lines.splice(this.r + 1, 0, ...add);
      });
      this.flash(`copied the page from ${entry.from}`, C.good);
      return true;
    }
    return true;
  }

  private renameKey(e: KeyboardEvent): boolean {
    const n = this.renaming!;
    if (e.key === 'Escape') { this.renaming = null; return true; }
    if (e.key === 'Enter') {
      const ok = /^[a-z][a-z0-9_]*$/.test(n) && !VERBS[n] && !KEYWORDS[n] && !NAMES[n] && !FUNCTIONS[n];
      const taken = app.s.pages.some((p, i) => i !== this.pageIdx && p.name === n);
      if (!ok || taken) { sfx.error(); this.flash(taken ? 'another page has that name' : 'a name is lowercase letters and digits, and not a word of the Cant', C.bad); return true; }
      const old = this.page.name;
      this.page.name = n;
      for (const k of Object.keys(app.s.flags)) void k;
      if (old !== n) this.changed = true;
      this.renaming = null;
      sfx.ok();
      return true;
    }
    if (e.key === 'Backspace') { this.renaming = n.slice(0, -1); return true; }
    if (e.key.length === 1 && /[a-z0-9_]/i.test(e.key) && n.length < 10) this.renaming = n + e.key.toLowerCase();
    return true;
  }

  private test() {
    if (this.mode === 'oneline') return;
    if (!this.ok()) { sfx.error(); this.flash('fix the red lines before testing', C.bad); return; }
    this.commit();
    if (this.mode === 'margin') { sfx.ok(); app.pop(); this.onClose?.(true, 'run'); return; }
    const seen = ['straw', ...app.s.seen.filter((k) => k !== 'straw' && FOES[k] && !FOES[k].boss)];
    this.bench = new Bench(this, seen);
    sfx.ok();
  }

  private close() {
    if (this.mode === 'tutorial') {
      if (!this.ok() || this.diags.some((d) => d.sev === 'mute') || !this.lines.join('\n').includes('strike')) {
        sfx.error();
        this.flash('write strike on a line of its own, then press Esc', C.bad);
        return;
      }
    }
    if (this.mode === 'oneline') {
      sfx.ok();
      app.pop();
      this.onClose?.(true, this.lines[0]);
      return;
    }
    this.commit();
    sfx.back();
    app.pop();
    this.onClose?.(this.changed);
  }

  // ---------------------------------------------------------------- drawing

  update() {
    this.blink++;
    this.bench?.update();
  }

  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    if (this.mode === 'oneline') { this.drawOneLine(); return; }
    const s = app.s;
    const pg = this.page;
    rect(0, 0, W, 10, 0x15121c);
    rect(2, 2, 5, 5, PAGE_COLORS[pg.color] ?? C.text);
    const title = this.renaming !== null ? `name: ${this.renaming}${this.blink % 40 < 20 ? '_' : ' '}` : this.mode === 'margin' ? `margin: ${pg.name}` : `${this.pageIdx + 1}. ${pg.name}`;
    text(title, 10, 2, this.renaming !== null ? C.hi : C.text);
    const limit = this.limit();
    const lc = `${this.codeLines}/${limit}`;
    text(lc, W - 2 - lc.length * CW, 2, this.codeLines > limit ? C.bad : C.dim);
    if (this.costText) text(this.costText, W - 8 - (lc.length + this.costText.length) * CW, 2, C.hi);
    const diagByLine = new Map<number, Diag>();
    for (const d of this.diags) if (!diagByLine.has(d.line) || d.sev === 'error') diagByLine.set(d.line, d);
    for (let row = 0; row < ROWS; row++) {
      const i = this.scroll + row;
      const y = TOP + row * LINE_H;
      if (i >= this.lines.length) { text('~', 4, y, C.faint); continue; }
      const d = diagByLine.get(i + 1);
      if (i === this.r) rect(GUT - 2, y - 1, W - GUT + 2, LINE_H, 0x17141f);
      text(String(i + 1).padStart(2, ' '), 0, y, d ? (d.sev === 'error' ? C.bad : C.faint) : i === this.r ? C.dim : C.faint);
      const line = this.lines[i];
      const muted = d && d.sev === 'mute';
      const cols = colorize(line);
      for (let k = 0; k < line.length && k < COLS; k++) text(line[k], GUT + k * CW, y, muted && line[k] !== ' ' ? C.faint : cols[k]);
      if (d && d.sev === 'error') {
        const from = d.col < 0 ? line.length - line.trimStart().length : d.col;
        const len = d.col < 0 ? Math.max(1, line.trim().length) : Math.max(1, d.len);
        for (let k = from; k < Math.min(COLS, from + len); k++) if ((k + app.frame / 8) % 2 < 1.5) rect(GUT + k * CW, y + 7, 4, 1, C.bad);
      }
    }
    const cy = TOP + (this.r - this.scroll) * LINE_H;
    if (this.blink % 40 < 24 && this.renaming === null) rect(GUT + this.c * CW - 1, cy - 1, 1, 8, C.hi);
    if (this.completions.length && this.renaming === null) {
      const w = Math.max(...this.completions.map((c) => c.length)) * CW + 6;
      const x = Math.min(W - w - 2, GUT + this.c * CW);
      const yy = cy + 9 + this.completions.length * 8 + 4 > 160 ? cy - this.completions.length * 8 - 5 : cy + 9;
      panel(x, yy, w, this.completions.length * 8 + 3, C.faint);
      this.completions.forEach((c, k) => {
        const v = VERBS[c];
        text(c, x + 3, yy + 2 + k * 8, k === this.compIdx ? C.hi : v ? v.color : KEYWORDS[c] ? C.kw : C.text);
      });
    }
    this.drawStatus();
    if (this.pagePick !== null) this.drawLibrary();
    if (this.popup) this.drawPopup();
    this.bench?.draw();
  }

  private drawStatus() {
    rect(0, 150, W, 42, 0x15121c);
    rect(0, 150, W, 1, 0x2a2440);
    const here = this.diags.find((d) => d.line === this.r + 1) ?? this.diags.find((d) => d.sev === 'error');
    let msgLines: string[] = [];
    let col: number = C.dim;
    if (this.mode === 'tutorial') {
      msgLines = wrap('Type strike, then press Esc. Gloss is waiting.', 37);
      col = C.hi;
      if (here && here.sev === 'error') { msgLines = wrap(`line ${here.line}: ${here.msg}`, 37); col = C.bad; }
    } else if (here) {
      msgLines = wrap(`line ${here.line}: ${here.msg}`, 37);
      col = here.sev === 'error' ? C.bad : C.dim;
    } else if (this.message) {
      msgLines = wrap(this.message, 37);
      col = this.messageColor;
    } else {
      msgLines = this.page.fixed ? wrap('The first page is the Scrivener\'s. PgDn for your own pages.', 37) : ['ok'];
      col = this.page.fixed ? C.dim : C.good;
    }
    msgLines.slice(0, 2).forEach((l, i) => text(l, 3, 154 + i * 8, col));
    const st = this.page.stats;
    if (!this.page.fixed && st.casts) text(`cast ${st.casts}  harm ${st.harm}  best ${st.best}`, 3, 172, C.faint);
    text(this.mode === 'tutorial' ? 'Tab completes a word' : this.mode === 'margin' ? 'Tab word F1 help F5 run Esc back' : 'Tab word F1 help F5 test PgDn page', 3, 182, C.faint);
  }

  private drawPopup() {
    const p = this.popup!;
    const h = p.lines.length * 8 + 16;
    panel(6, 20, 180, h, C.hi);
    text(p.title, 11, 24, C.hi);
    p.lines.forEach((l, i) => text(l, 11, 34 + i * 8, C.text));
  }

  private drawLibrary() {
    const lib = app.s.library;
    panel(6, 14, 180, 136, C.kw);
    text('Library: Enter copies the page in', 10, 17, C.kw);
    const sel = lib[this.pagePick!];
    const top = Math.max(0, Math.min(this.pagePick! - 3, lib.length - 7));
    for (let k = top; k < Math.min(lib.length, top + 7); k++) {
      const yy = 27 + (k - top) * 8;
      if (k === this.pagePick) rect(9, yy - 1, 174, 8, C.sel);
      text(`${lib[k].name}`, 12, yy, k === this.pagePick ? C.hi : C.text);
      text(`from ${lib[k].from}`, 80, yy, C.dim);
    }
    rect(9, 85, 174, 1, C.faint);
    sel.src.split('\n').slice(0, 7).forEach((l, i) => {
      const cols = colorize(l);
      for (let k = 0; k < Math.min(34, l.length); k++) text(l[k], 12 + k * CW, 89 + i * 8, cols[k]);
    });
  }

  private drawOneLine() {
    text('One line.', 8, 40, C.dim);
    text('It will be the first thing', 8, 52, C.dim);
    text('the child does.', 8, 60, C.dim);
    panel(4, 80, 184, 16, C.hi);
    const line = this.lines[0];
    const cols = colorize(line);
    for (let k = 0; k < line.length; k++) text(line[k], 8 + k * CW, 85, cols[k]);
    if (this.blink % 40 < 24) rect(8 + this.c * CW - 1, 84, 1, 8, C.hi);
    const e = this.diags.find((d) => d.sev === 'error' && !d.msg.includes('holds'));
    if (e) wrap(e.msg, 36).slice(0, 2).forEach((l, i) => text(l, 8, 104 + i * 8, C.dim));
    text('Enter when it is written.', 8, 170, C.faint);
  }
}

function freshName(): string {
  const used = new Set(app.s.pages.map((p) => p.name));
  for (let i = 2; ; i++) if (!used.has(`page${i}`)) return `page${i}`;
}

// ---------------------------------------------------------------- the test bench

class Bench {
  pick = 0;
  events: BEvent[] = [];
  step = -1;
  running = false;
  summary: string[] = [];
  currentLine = 0;
  log: { s: string; c: number }[] = [];
  battle: Battle | null = null;

  constructor(private ed: Editor, private foes: string[]) {}

  key(e: KeyboardEvent): boolean {
    if (!this.running) {
      if (e.key === 'Escape') { this.ed.bench = null; sfx.back(); return true; }
      if (e.key === 'ArrowUp') { this.pick = (this.pick + this.foes.length - 1) % this.foes.length; sfx.move(); }
      if (e.key === 'ArrowDown') { this.pick = (this.pick + 1) % this.foes.length; sfx.move(); }
      if (e.key === 'Enter' || e.key === 'z' || e.key === ' ' || e.key === 'F5') this.start();
      return true;
    }
    if (e.key === 'Escape') { this.ed.bench = null; sfx.back(); return true; }
    if (e.key === 'Enter' || e.key === 'z' || e.key === ' ') this.advance();
    if (e.key === 'x' || e.key === 'End') { while (this.step < this.events.length - 1) this.advance(); }
    return true;
  }

  private start() {
    const s = app.s;
    const key = this.foes[this.pick];
    const setup = battleSetup(s, `foe:${key}`, 7);
    setup.wait.hp = setup.wait.max;
    setup.wait.ink = setup.wait.maxInk;
    setup.items = {};
    const b = new Battle(setup);
    this.battle = b;
    const ev: BEvent[] = [...b.start()];
    const target = b.livingFoes()[0];
    ev.push(...b.act({ kind: 'cast', page: this.ed.pageIdx, target: target.id }));
    let rounds = 1;
    while (b.phase === 'command' && rounds < 4 && b.hands.some((h) => h.alive && h.status !== 'listening')) {
      ev.push(...b.act({ kind: 'pass' }));
      rounds++;
    }
    this.events = ev.filter((e) => e.t === 'line' && e.who === b.wait.id || e.t === 'harm' || e.t === 'heal' || e.t === 'say' || e.t === 'log' || e.t === 'end' || e.t === 'round' || (e.t === 'line' && e.who !== b.wait.id));
    const st = b.stats[this.ed.page.name];
    const spent = setup.wait.maxInk - b.wait.ink;
    this.summary = [
      `harm ${st?.harm ?? 0}, healing ${st?.heal ?? 0}`,
      `rounds ${b.round}${b.result === 'win' ? `, ${FOES[key].name} fell` : ''}`,
      `wait's hp ${b.wait.hp}/${b.wait.max}, ink left ${b.wait.ink}`,
    ];
    void spent;
    this.step = -1;
    this.log = [];
    this.running = true;
    sfx.ok();
    this.advance();
  }

  private advance() {
    if (this.step >= this.events.length - 1) return;
    this.step++;
    const e = this.events[this.step];
    const b = this.battle!;
    const name = (id: string) => b.byId(id)?.name ?? '?';
    switch (e.t) {
      case 'line':
        if (e.who === b.wait.id) { this.currentLine = e.line; this.log.push({ s: `${e.line}: ${e.text.trim()}`, c: e.mute ? C.faint : C.hi }); sfx.line(0); }
        else this.log.push({ s: `${name(e.who)}: ${e.text.trim()}`, c: C.dim });
        break;
      case 'harm': this.log.push({ s: `  ${name(e.who)} -${e.amount}`, c: C.bad }); break;
      case 'heal': this.log.push({ s: `  ${name(e.who)} +${e.amount}`, c: C.good }); break;
      case 'say': this.log.push({ s: `  says: ${e.text}`, c: C.str }); break;
      case 'log': this.log.push({ s: `  ${e.text}`, c: e.tone === 'bad' ? C.bad : C.dim }); break;
      case 'round': this.log.push({ s: `round ${e.n}`, c: C.kw }); break;
      case 'end': if (e.reason !== 'done') this.log.push({ s: `  (${e.reason})`, c: C.dim }); break;
      default: break;
    }
    if (this.log.length > 13) this.log.splice(0, this.log.length - 13);
  }

  update() { /* stepping is driven by keys */ }

  draw() {
    panel(4, 12, 184, 176, C.hi);
    if (!this.running) {
      text('Test bench: pick a target', 9, 16, C.hi);
      this.foes.forEach((k, i) => {
        const y = 28 + i * 8;
        if (y > 170) return;
        if (i === this.pick) rect(8, y - 1, 176, 8, C.sel);
        text(FOES[k].name, 12, y, i === this.pick ? C.hi : C.text);
        text(`hp ${FOES[k].hp}  armor ${FOES[k].armor}`, 90, y, C.dim);
      });
      text('Enter runs it. Esc goes back.', 9, 178, C.faint);
      return;
    }
    text(`vs ${FOES[this.foes[this.pick]].name}`, 9, 16, C.hi);
    text(`line ${this.currentLine || '-'}`, 140, 16, C.dim);
    this.log.forEach((l, i) => text(l.s.slice(0, 35), 9, 27 + i * 8, l.c));
    if (this.step >= this.events.length - 1) {
      rect(8, 134, 176, 1, C.faint);
      this.summary.forEach((l, i) => text(l, 9, 138 + i * 8, C.text));
      text('Esc goes back.', 9, 178, C.faint);
    } else {
      text('Z steps. X runs to the end.', 9, 178, C.faint);
    }
  }
}
