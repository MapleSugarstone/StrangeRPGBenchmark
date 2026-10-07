// The Stet match: the screen before it, the board, and the stakes after it.
import { sfx } from '../../engine/audio';
import { CW, LH, text, textCenter, textShadow, wrap } from '../../engine/font';
import { down, pressed, tapped } from '../../engine/input';
import { H, W, ditherRect, rect } from '../../engine/screen';
import { Scene, app } from '../app';
import { C, Menu, panel } from '../ui';
import { chooseMove } from './ai';
import { BookScene } from './book';
import { CARDS, WORDS, WORD_IDS, Word } from './cards';
import { deckReady, forfeit, grant, playerStarts, take, winnable } from './collection';
import { CARD_H, CARD_W, Face, SIDE, cursorFrame, drawArt, drawBack, drawCard, drawNarrow, faceOf } from './draw';
import { OpponentDef } from './opponents';
import { Ev, HandCard, Match, Move, NB, Piece, RULES, RuleId, Side, adjacent, eff, needsTarget, newMatch, over, play, preview, score, toMove } from './rules';

export type Result = 'win' | 'lose' | 'draw';

const BX = 53;
const BY = 12;
const cellX = (i: number) => BX + (i % 3) * 29;
const cellY = (i: number) => BY + Math.floor(i / 3) * 37;
const HAND_X = [6, 158];
const handY = (i: number) => 12 + i * 24;
const BETS = [0, 5, 10, 20, 40];

function infoLines(id: string, word: Word | null, cols: number): { s: string; c: number }[] {
  const out: { s: string; c: number }[] = [];
  if (word) for (const s of wrap(WORDS[word].text, cols)) out.push({ s, c: C.text });
  const fl = CARDS[id]?.flavor;
  if (fl) wrap(`# ${fl}`, cols).forEach((s) => out.push({ s, c: C.aside }));
  return out;
}

/** Name, word, and aside of a card beside its face. */
export function drawInfo(f: Face | null, x: number, y: number, cols: number, maxLines: number, note = '', noteColor: number = C.good) {
  if (!f) return;
  const card = CARDS[f.id];
  text(card?.name ?? '?', x, y, C.text);
  if (note) text(note, x + cols * CW - note.length * CW, y, noteColor);
  else if (f.word) text(f.word, x + cols * CW - f.word.length * CW, y, WORDS[f.word].color);
  infoLines(f.id, f.word, cols).slice(0, maxLines - 1).forEach((l, i) => text(l.s, x, y + LH * (i + 1), l.c));
}

function ruleNames(rules: RuleId[], x: number, y: number) {
  let xx = x;
  for (const r of rules) { text(RULES[r].name, xx, y, RULES[r].color); xx += (RULES[r].name.length + 1) * CW; }
}

// ---------------------------------------------------------------- before the match

export class PreMatch implements Scene {
  opaque = true;
  menu = new Menu([], 4);
  bet = 0;

  constructor(private o: OpponentDef, private done: (r: Result) => void) { this.build(); }

  enter() {
    const st = app.s.stet;
    if (this.o.lesson && st.wins + st.losses + st.draws === 0) app.push(new Talk(this.o, this.o.lesson));
  }

  resume() { this.build(); }

  build() {
    this.bet = Math.min(this.bet, app.s.blanks);
    this.menu.set([
      { label: 'Play', disabled: !deckReady(app.s.stet) },
      { label: `Bet: ${this.bet} blanks`, right: '< >', rightColor: C.dim },
      { label: 'Deck' },
      { label: 'Rules' },
    ]);
  }

  update() {
    if (this.menu.i === 1 && (pressed('left') || pressed('right'))) {
      const opts = BETS.filter((b) => b <= app.s.blanks);
      const k = Math.max(0, opts.indexOf(this.bet));
      this.bet = opts[(k + (pressed('right') ? 1 : opts.length - 1)) % opts.length];
      sfx.move();
      this.build();
    }
    const r = this.menu.update(false);
    if (tapped('back')) sfx.error();
    if (r === 0) app.replace(new MatchScene(this.o, this.bet, this.done));
    if (r === 1) {
      const opts = BETS.filter((b) => b <= app.s.blanks);
      this.bet = opts[(Math.max(0, opts.indexOf(this.bet)) + 1) % opts.length];
      this.build();
    }
    if (r === 2) app.push(new BookScene());
    if (r === 3) app.push(new HelpScene(this.o.rules));
  }

  draw() {
    const o = this.o;
    const st = app.s.stet;
    rect(0, 0, W, H, C.bg);
    text('Stet', 6, 4, C.hi);
    text(o.place, W - 6 - o.place.length * CW, 4, C.dim);
    panel(4, 14, 184, 46, C.faint);
    drawArt(o.art, 10, 19, undefined, app.beat());
    text(o.name, 24, 19, C.text);
    if (st.beaten.includes(o.id)) text('beaten', 182 - 6 * CW, 19, C.good);
    wrap(o.intro, 34).slice(0, 4).forEach((l, i) => text(l, 10, 30 + i * LH, o.id === 'scrivener' ? C.aside : C.text));

    let y = 64;
    for (const r of o.rules) {
      text(RULES[r].name, 6, y, RULES[r].color);
      const ls = wrap(RULES[r].text, 28);
      ls.forEach((l, i) => text(l, 46, y + i * LH, C.text));
      y += ls.length * LH + 2;
    }
    const open = newMatch([[], []], o.rules, 0).opening;
    text(`The first card is safe for ${open} turn${open > 1 ? 's' : ''}.`, 6, y, C.dim);

    const deck = st.deck;
    for (let k = 0; k < 5; k++) {
      const x = 22 + k * 30;
      if (deck[k]) drawCard(faceOf(deck[k], 0), x, 110);
      else drawBack(x, 110, -1);
    }
    this.menu.draw(8, 152, 100);
    text(`${app.s.blanks} blanks`, 120, 152, C.gold);
    text('The winner', 120, 168, C.dim);
    text('takes a card.', 120, 176, C.dim);
    if (!deckReady(st)) text('Your deck needs five cards.', 8, 184, C.bad);
  }
}

/** Lines an opponent says before the first match, one at a time. */
class Talk implements Scene {
  i = 0;
  constructor(private o: OpponentDef, private lines: string[]) {}
  update() {
    if (tapped('ok') || tapped('back')) {
      sfx.text();
      if (++this.i >= this.lines.length) app.pop();
    }
  }
  draw() {
    panel(4, 132, 184, 56, C.hi);
    drawArt(this.o.art, 10, 138, undefined, app.beat());
    text(this.o.name, 24, 138, C.hi);
    wrap(this.lines[this.i] ?? '', 34).slice(0, 4).forEach((l, k) => text(l, 10, 150 + k * LH, C.text));
    if (Math.floor(app.t * 2) % 2) text('\x03', 180, 180, C.dim);
  }
}

/** The rules of this match and every word, to scroll through. */
export class HelpScene implements Scene {
  opaque = true;
  lines: { s: string; c: number; w?: Word; r?: RuleId }[] = [];
  top = 0;
  constructor(rules: RuleId[]) {
    const L = (s: string, c: number = C.text, w?: Word, r?: RuleId) => this.lines.push({ s, c, w, r });
    L('How to play', C.hi);
    for (const s of wrap('Take turns placing one card on an empty place. Where your card\'s edge is higher than the edge it touches on the other side\'s card, that card flips to you.', 36)) L(s);
    for (const s of wrap('When the board is full, the side with more cards wins. A card left in a hand counts for its holder.', 36)) L(s);
    const open = newMatch([[], []], rules, 0).opening;
    for (const s of wrap(`The first card placed cannot be flipped for the other side's next ${open} turn${open > 1 ? 's' : ''}.`, 36)) L(s);
    L('');
    L('This table', C.hi);
    for (const r of rules) wrap(`${RULES[r].name}: ${RULES[r].text}`, 36).forEach((s, i) => L(s, C.text, undefined, i === 0 ? r : undefined));
    L('');
    L('Words', C.hi);
    for (const w of WORD_IDS) wrap(`${w}: ${WORDS[w].text}`, 36).forEach((s, i) => L(s, C.text, i === 0 ? w : undefined));
  }
  update() {
    const rows = 21;
    if (pressed('down') && this.top < this.lines.length - rows) { this.top++; sfx.move(); }
    if (pressed('up') && this.top > 0) { this.top--; sfx.move(); }
    if (tapped('back') || tapped('ok') || tapped('page')) { sfx.back(); app.pop(); }
  }
  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    this.lines.slice(this.top, this.top + 21).forEach((l, i) => {
      const y = 4 + i * LH;
      text(l.s, 6, y, l.c);
      if (l.w) text(l.w, 6, y, WORDS[l.w].color);
      if (l.r) text(RULES[l.r].name, 6, y, RULES[l.r].color);
    });
    if (this.top + 21 < this.lines.length) text('\x03', 182, 180, C.dim);
    if (this.top > 0) text('\x04', 182, 4, C.dim);
  }
}

// ---------------------------------------------------------------- the match

type Anim =
  | { k: 'slide'; cell: number; p: Piece; fx: number; fy: number; t: number; n: number }
  | { k: 'flip'; cell: number; p: Piece; t: number; n: number; label: string; color: number }
  | { k: 'set'; cell: number; p: Piece; t: number; n: number; label: string; color: number }
  | { k: 'say'; cell: number; t: number; n: number; label: string; color: number; pitch: number }
  | { k: 'fall'; board: (Piece | null)[]; side: Side; t: number; n: number };

interface Float { s: string; x: number; y: number; c: number; t: number }

type Zone = 'hand' | 'board' | 'foe';

export class MatchScene implements Scene {
  opaque = true;
  m: Match;
  shown: (Piece | null)[];
  hands: [HandCard[], HandCard[]];
  phase: 'turn' | 'target' | 'ai' | 'anim' | 'over' = 'anim';
  zone: Zone = 'hand';
  hi = 0;
  cell = 4;
  fi = 0;
  sel = -1;
  targets: number[] = [];
  ti = 0;
  queue: Anim[] = [];
  floats: Float[] = [];
  aiMove: Move | null = null;
  aiT = 0;
  last = -1;
  frames = 0;
  overT = 0;
  start = app.t;
  pv: { key: string; cells: number[] } = { key: '', cells: [] };

  constructor(public o: OpponentDef, public bet: number, public done: (r: Result) => void) {
    const first: Side = playerStarts(app.s.stet) ? 0 : 1;
    this.m = newMatch([app.s.stet.deck.slice(), o.deck.slice()], o.rules, first);
    this.shown = Array(9).fill(null);
    this.hands = [this.m.hands[0].slice(), this.m.hands[1].slice()];
    this.queue.push({ k: 'say', cell: 4, t: 0, n: 40, label: first === 0 ? 'you start' : `${o.name} starts`.slice(0, 18), color: C.text, pitch: 12 });
  }

  // ------------------------------------------------ turn flow

  private next() {
    this.shown = this.m.board.map((p) => (p ? { ...p, e: p.e.slice() } : null));
    this.hands = [this.m.hands[0].slice(), this.m.hands[1].slice()];
    if (over(this.m)) { this.phase = 'over'; this.overT = 0; return; }
    if (toMove(this.m) === 0) {
      this.phase = 'turn';
      this.zone = 'hand';
      this.sel = -1;
      this.hi = Math.min(this.hi, this.hands[0].length - 1);
    } else {
      this.phase = 'ai';
      this.aiT = 0;
      this.aiMove = chooseMove(this.m, { level: this.o.level, slip: this.o.slip, nodes: this.o.nodes });
    }
  }

  private commit(mv: Move) {
    const s = toMove(this.m);
    const fx = HAND_X[s];
    const fy = handY(mv.h);
    const ev: Ev[] = [];
    play(this.m, mv, ev);
    this.hands = [this.m.hands[0].slice(), this.m.hands[1].slice()];
    this.last = mv.cell;
    this.pv.key = '';
    for (const e of ev) {
      switch (e.k) {
        case 'place': this.queue.push({ k: 'slide', cell: e.cell, p: e.p, fx, fy, t: 0, n: 10 }); break;
        case 'word': this.queue.push({ k: 'say', cell: e.cell, t: 0, n: 10, label: e.word, color: WORDS[e.word].color, pitch: WORDS[e.word].pitch }); break;
        case 'copy': this.queue.push({ k: 'set', cell: e.cell, p: e.p, t: 0, n: 10, label: 'copy', color: WORDS.copy.color }); break;
        case 'flip': this.queue.push({ k: 'flip', cell: e.cell, p: e.p, t: 0, n: 14, label: e.how === 'edge' ? '' : e.how, color: e.how === 'twin' ? RULES.twin.color : WORDS.each.color }); break;
        case 'halt': this.queue.push({ k: 'set', cell: e.cell, p: e.p, t: 0, n: 10, label: 'halted', color: WORDS.halt.color }); break;
        case 'mend': this.queue.push({ k: 'set', cell: e.cell, p: e.p, t: 0, n: 8, label: '+1', color: C.good }); break;
        case 'rise': this.queue.push({ k: 'set', cell: e.cell, p: e.p, t: 0, n: 8, label: '+1', color: WORDS.wait.color }); break;
        case 'back': this.queue.push({ k: 'flip', cell: e.cell, p: e.p, t: 0, n: 14, label: 'again', color: WORDS.again.color }); break;
        case 'fall': this.queue.push({ k: 'fall', board: e.board, side: e.side, t: 0, n: 12 }); break;
      }
    }
    this.phase = 'anim';
  }

  private float(s: string, cell: number, c: number) {
    if (!s) return;
    this.floats.push({ s, x: cellX(cell) + 14 - Math.floor((s.length * CW) / 2), y: cellY(cell) + 12, c, t: 0 });
  }

  private stepAnim() {
    const a = this.queue[0];
    if (!a) return;
    if (a.t === 0) {
      switch (a.k) {
        case 'slide': sfx.line(-5); break;
        case 'say': this.float(a.label, a.cell, a.color); sfx.line(a.pitch); break;
        case 'set': this.shown[a.cell] = a.p; this.float(a.label, a.cell, a.color); if (a.label === '+1') sfx.heal(); else sfx.move(); break;
        case 'flip': this.float(a.label, a.cell, a.color); if (a.label === 'again') sfx.again(); else sfx.hit(); break;
        case 'fall': sfx.fall(); break;
      }
    }
    a.t++;
    if (a.k === 'flip' && a.t === a.n >> 1) this.shown[a.cell] = a.p;
    if (a.t >= a.n) {
      if (a.k === 'slide') this.shown[a.cell] = a.p;
      if (a.k === 'fall') this.shown = a.board.map((p) => (p ? { ...p, e: p.e.slice() } : null));
      this.queue.shift();
    }
  }

  // ------------------------------------------------ input

  private defaultTarget(cell: number, word: Word | null): number {
    const t = adjacent(this.m, cell);
    if (!t.length) return -1;
    if (word === 'copy') return t.reduce((b, j) => (Math.max(...this.m.board[j]!.e) > Math.max(...this.m.board[b]!.e) ? j : b), t[0]);
    return t.find((j) => this.m.board[j]!.side === 0) ?? t[0];
  }

  private placeSelected() {
    const card = this.hands[0][this.sel];
    if (!card) return;
    if (this.m.board[this.cell]) { sfx.error(); return; }
    if (needsTarget(card.word) && adjacent(this.m, this.cell).length) {
      this.targets = adjacent(this.m, this.cell);
      this.ti = Math.max(0, this.targets.indexOf(this.defaultTarget(this.cell, card.word)));
      this.phase = 'target';
      sfx.ok();
      return;
    }
    sfx.ok();
    this.commit({ h: this.sel, cell: this.cell, target: -1 });
  }

  private updateTurn() {
    const n = this.hands[0].length;
    if (tapped('page') || tapped('tab')) { app.push(new HelpScene(this.m.rules)); return; }
    if (this.zone === 'hand') {
      if (pressed('up')) { this.hi = (this.hi + n - 1) % n; sfx.move(); }
      if (pressed('down')) { this.hi = (this.hi + 1) % n; sfx.move(); }
      if (tapped('ok') || pressed('right')) {
        this.sel = this.hi;
        this.zone = 'board';
        if (this.m.board[this.cell]) this.cell = this.m.board.findIndex((p) => !p);
        sfx.ok();
      }
      return;
    }
    if (this.zone === 'board') {
      const r = Math.floor(this.cell / 3), c = this.cell % 3;
      if (pressed('up') && r > 0) { this.cell -= 3; sfx.move(); }
      if (pressed('down') && r < 2) { this.cell += 3; sfx.move(); }
      if (pressed('right')) {
        if (c < 2) this.cell++;
        else { this.zone = 'foe'; this.fi = Math.min(this.fi, this.hands[1].length - 1); }
        sfx.move();
      }
      if (pressed('left')) {
        if (c > 0) this.cell--;
        else { this.zone = 'hand'; this.hi = Math.max(0, this.sel); }
        sfx.move();
      }
      if (tapped('back')) { this.zone = 'hand'; this.hi = Math.max(0, this.sel); sfx.back(); return; }
      if (tapped('ok')) this.placeSelected();
      return;
    }
    const k = this.hands[1].length;
    if (k && pressed('up')) { this.fi = (this.fi + k - 1) % k; sfx.move(); }
    if (k && pressed('down')) { this.fi = (this.fi + 1) % k; sfx.move(); }
    if (pressed('left') || tapped('back')) { this.zone = 'board'; this.cell = Math.floor(this.cell / 3) * 3 + 2; sfx.move(); }
    if (tapped('ok')) sfx.error();
  }

  private updateTarget() {
    for (const [a, d] of [['up', 0], ['right', 1], ['down', 2], ['left', 3]] as const) {
      if (!pressed(a)) continue;
      const j = NB[this.cell][d];
      const k = this.targets.indexOf(j);
      if (k >= 0) { this.ti = k; sfx.move(); }
    }
    if (tapped('back')) { this.phase = 'turn'; sfx.back(); return; }
    if (tapped('ok')) { sfx.ok(); this.commit({ h: this.sel, cell: this.cell, target: this.targets[this.ti] }); }
  }

  update() {
    this.frames++;
    for (const f of this.floats) { f.t++; if (f.t % 3 === 0) f.y--; }
    this.floats = this.floats.filter((f) => f.t < 40);
    const fast = down('run');
    switch (this.phase) {
      case 'anim':
        for (let k = 0; k < (fast ? 3 : 1); k++) this.stepAnim();
        if (!this.queue.length) this.next();
        break;
      case 'turn': this.updateTurn(); break;
      case 'target': this.updateTarget(); break;
      case 'ai': {
        this.aiT += fast ? 4 : 1;
        if (this.aiT >= 40 && this.aiMove) this.commit(this.aiMove);
        break;
      }
      case 'over':
        this.overT++;
        if (this.overT > 30 || (this.overT > 6 && fast)) { this.phase = 'anim'; app.push(new ResultScene(this)); }
        break;
    }
  }

  // ------------------------------------------------ drawing

  private face(board: (Piece | null)[], i: number): Face {
    const p = board[i]!;
    const view = { ...this.m, board };
    const e = [0, 1, 2, 3].map((d) => eff(view, i, d));
    return { id: p.id, e, printed: p.printed, word: p.word, side: p.side, copied: p.copied, halted: p.halted, warded: !p.halted && this.m.turn <= p.ward && !over(this.m), again: p.again === 1 };
  }

  private handFace(c: HandCard, side: number): Face {
    return { id: c.id, e: c.e, printed: c.e, word: c.word, side, copied: CARDS[c.id]?.copied };
  }

  private previewCells(): number[] {
    if (this.phase !== 'turn' || this.zone !== 'board' || this.m.board[this.cell] || this.sel < 0) return [];
    const card = this.hands[0][this.sel];
    if (!card) return [];
    const key = `${this.sel}:${this.cell}:${this.m.turn}`;
    if (this.pv.key !== key) {
      const target = needsTarget(card.word) ? this.defaultTarget(this.cell, card.word) : -1;
      this.pv = { key, cells: preview(this.m, { h: this.sel, cell: this.cell, target }) };
    }
    return this.pv.cells;
  }

  draw() {
    const m = this.m;
    const blink = Math.floor(this.frames / 15) % 2 === 0;
    rect(0, 0, W, H, C.bg);
    ruleNames(m.rules, 4, 2);
    const name = this.o.counter ? `${this.o.name} ${this.o.counter + Math.floor(app.t - this.start)}` : this.o.name;
    text(name, W - 4 - name.length * CW, 2, SIDE[1].edge);

    const cur = this.queue[0];
    for (let i = 0; i < 9; i++) {
      const x = cellX(i), y = cellY(i);
      rect(x, y, CARD_W, CARD_H, 0x15121c);
      rect(x + 1, y + 1, CARD_W - 2, CARD_H - 2, 0x1b1724);
      if (!this.shown[i]) continue;
      if (cur && cur.k === 'flip' && cur.cell === i) {
        const half = cur.n >> 1;
        const k = cur.t < half ? 1 - cur.t / half : (cur.t - half) / half;
        drawNarrow(() => drawCard(this.face(this.shown, i), x, y, app.beat()), x, y, Math.round(CARD_W * k));
      } else drawCard(this.face(this.shown, i), x, y, app.beat());
      if (cur && cur.k === 'fall' && this.shown[i]!.side === cur.side) ditherRect(x, y, CARD_W, CARD_H, RULES.fall.color, cur.t % 2);
    }

    // Hands: the raised card is drawn last so it shows whole.
    for (const side of [0, 1] as Side[]) {
      const hand = this.hands[side];
      let raised = -1;
      if (side === 0 && this.phase !== 'ai' && this.phase !== 'anim') raised = this.zone === 'hand' ? this.hi : this.sel;
      if (side === 1 && this.phase === 'turn' && this.zone === 'foe') raised = this.fi;
      if (side === 1 && this.phase === 'ai' && this.aiT > 20 && this.aiMove) raised = this.aiMove.h;
      const order = hand.map((_, i) => i).filter((i) => i !== raised);
      if (raised >= 0 && raised < hand.length) order.push(raised);
      for (const i of order) {
        const dx = i === raised ? (side === 0 ? 6 : -6) : 0;
        const x = HAND_X[side] + dx, y = handY(i);
        if (side === 1 && !m.f.open) drawBack(x, y, 1);
        else drawCard(this.handFace(hand[i], side), x, y, app.beat());
        if (i === raised && side === 0 && this.zone === 'hand' && this.phase === 'turn') cursorFrame(x, y, blink ? C.hi : C.gold);
        if (i === raised && side === 1 && this.zone === 'foe') cursorFrame(x, y, C.dim);
      }
    }

    if (cur && cur.k === 'slide') {
      const k = cur.t / cur.n;
      const x = Math.round(cur.fx + (cellX(cur.cell) - cur.fx) * k), y = Math.round(cur.fy + (cellY(cur.cell) - cur.fy) * k);
      const p = cur.p;
      drawCard({ id: p.id, e: p.e, printed: p.printed, word: p.word, side: p.side }, x, y, app.beat());
    }

    if (this.phase === 'turn' && this.zone === 'board') {
      const x = cellX(this.cell), y = cellY(this.cell);
      const card = this.hands[0][this.sel];
      if (!m.board[this.cell] && card) {
        drawCard(this.handFace(card, 0), x, y, app.beat());
        ditherRect(x, y, CARD_W, CARD_H, C.bg, this.frames >> 4);
      }
      cursorFrame(x, y, blink ? C.hi : C.gold);
      if (blink) for (const j of this.previewCells()) cursorFrame(cellX(j), cellY(j), C.good);
    }
    if (this.phase === 'target') {
      const x = cellX(this.cell), y = cellY(this.cell);
      drawCard(this.handFace(this.hands[0][this.sel], 0), x, y, app.beat());
      ditherRect(x, y, CARD_W, CARD_H, C.bg, this.frames >> 4);
      this.targets.forEach((j, k) => cursorFrame(cellX(j), cellY(j), k === this.ti ? (blink ? C.gold : C.text) : C.faint));
    }

    const [a, b] = score(m);
    textCenter(String(a), 84, 126, SIDE[0].edge);
    textCenter('-', 96, 126, C.dim);
    textCenter(String(b), 108, 126, SIDE[1].edge);
    if (!over(m) && blink) rect(toMove(m) === 0 ? 81 : 105, 134, 7, 1, toMove(m) === 0 ? SIDE[0].edge : SIDE[1].edge);
    textCenter(this.prompt(), 96, 138, C.dim);

    this.drawPanel();
    for (const f of this.floats) textShadow(f.s, f.x, f.y, f.c);
  }

  private prompt(): string {
    if (this.phase === 'target') return this.hands[0][this.sel]?.word === 'copy' ? 'copy which card?' : 'halt which card?';
    if (this.phase === 'ai') return `${this.o.name} plays`.slice(0, 20);
    if (this.phase === 'turn') return this.zone === 'board' ? 'Z places it' : this.zone === 'foe' ? (this.m.f.open ? 'their hand' : 'face down') : 'your turn';
    return '';
  }

  private drawPanel() {
    rect(0, 148, W, H - 148, C.panel);
    rect(0, 148, W, 1, C.faint);
    let f: Face | null = null;
    let note = '';
    let back = false;
    if (this.phase === 'turn' && this.zone === 'hand') { const c = this.hands[0][this.hi]; if (c) f = this.handFace(c, 0); }
    else if (this.phase === 'turn' && this.zone === 'board') {
      if (this.shown[this.cell]) f = this.face(this.shown, this.cell);
      else if (this.hands[0][this.sel]) {
        f = this.handFace(this.hands[0][this.sel], 0);
        const n = this.previewCells().length;
        note = n ? `flips ${n}` : '';
      }
    } else if (this.phase === 'turn' && this.zone === 'foe') {
      const c = this.hands[1][this.fi];
      if (c && this.m.f.open) f = this.handFace(c, 1);
      else back = !!c;
    } else if (this.phase === 'target') f = this.face(this.m.board, this.targets[this.ti]);
    else if (this.last >= 0 && this.shown[this.last]) f = this.face(this.shown, this.last);
    if (back) { drawBack(4, 152, 1); text('Face down.', 36, 152, C.dim); return; }
    if (!f) return;
    drawCard(f, 4, 152, app.beat());
    drawInfo(f, 36, 152, 30, 5, note);
  }
}

// ---------------------------------------------------------------- after the match

class ResultScene implements Scene {
  result: Result;
  picks: string[] = [];
  pi = 0;
  picking = false;
  lines: { s: string; c: number }[] = [];
  t = 0;

  constructor(private ms: MatchScene) {
    const [a, b] = score(ms.m);
    this.result = a > b ? 'win' : a < b ? 'lose' : 'draw';
  }

  enter() {
    const st = app.s.stet;
    const s = app.s;
    const o = this.ms.o;
    const bet = Math.min(this.ms.bet, s.blanks);
    if (this.result === 'win') {
      sfx.win();
      st.wins++;
      if (!st.beaten.includes(o.id)) st.beaten.push(o.id);
      s.blanks += o.purse + bet;
      this.lines.push({ s: `You take ${o.purse + bet} blanks.`, c: C.gold });
      this.picks = winnable(st, this.ms.m.played[1]);
      this.picking = this.picks.length > 0;
      if (!this.picking) this.lines.push({ s: 'Nothing on the table is new to you.', c: C.dim });
    } else if (this.result === 'lose') {
      sfx.lose();
      st.losses++;
      s.blanks -= bet;
      const card = forfeit(st, this.ms.m.played[0]);
      if (card) {
        take(st, card);
        this.lines.push({ s: `${o.name} takes your ${CARDS[card].name}.`, c: C.bad });
      } else {
        const n = Math.min(s.blanks, o.purse);
        s.blanks -= n;
        this.lines.push({ s: n ? `${o.name} takes ${n} blanks.` : `${o.name} takes nothing.`, c: n ? C.bad : C.dim });
      }
      if (bet) this.lines.push({ s: `The bet was ${bet} blanks.`, c: C.dim });
    } else {
      sfx.ok();
      st.draws++;
      this.lines.push({ s: 'Nobody takes anything.', c: C.dim });
    }
  }

  update() {
    this.t++;
    if (this.picking) {
      const n = this.picks.length;
      if (pressed('left')) { this.pi = (this.pi + n - 1) % n; sfx.move(); }
      if (pressed('right')) { this.pi = (this.pi + 1) % n; sfx.move(); }
      if (tapped('ok') && this.t > 20) {
        const id = this.picks[this.pi];
        grant(app.s.stet, id);
        sfx.get();
        this.lines.push({ s: `You take ${CARDS[id].name}.`, c: C.good });
        this.picking = false;
        this.t = 0;
      }
      return;
    }
    if (this.t > 20 && (tapped('ok') || tapped('back'))) {
      sfx.ok();
      app.remove(this);
      app.remove(this.ms);
      this.ms.done(this.result);
    }
  }

  draw() {
    const o = this.ms.o;
    const [a, b] = score(this.ms.m);
    panel(10, 24, 172, 140, C.hi);
    const head = this.result === 'win' ? `You win, ${a} to ${b}.` : this.result === 'lose' ? `${o.name} wins, ${b} to ${a}.` : `Even, ${a} to ${b}.`;
    text(head, 16, 30, this.result === 'win' ? C.good : this.result === 'lose' ? C.bad : C.text);
    drawArt(o.art, 16, 42, undefined, app.beat());
    const say = this.result === 'win' ? o.lose : this.result === 'lose' ? o.win : o.draw;
    wrap(say, 30).slice(0, 3).forEach((l, i) => text(l, 30, 42 + i * LH, o.id === 'scrivener' ? C.aside : C.text));
    let y = 70;
    for (const l of this.lines) { text(l.s, 16, y, l.c); y += LH; }
    if (this.picking) {
      text('Take one of their cards.', 16, y, C.text);
      const n = this.picks.length;
      const x0 = 96 - Math.floor((n * 30 - 2) / 2);
      this.picks.forEach((id, i) => {
        const x = x0 + i * 30;
        drawCard(faceOf(id, 1), x, y + 10, app.beat());
        if (i === this.pi) cursorFrame(x, y + 10, Math.floor(this.t / 15) % 2 ? C.gold : C.hi);
      });
      const pick = this.picks[this.pi];
      text(CARDS[pick].name, 96 - Math.floor((CARDS[pick].name.length * CW) / 2), y + 48, C.text);
    } else if (this.t > 20) text('Z', 172, 154, C.dim);
  }
}
