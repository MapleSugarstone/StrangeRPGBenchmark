// Sluice, the bar card game. Five cards each on a three by three board. A placed card flips each touching
// opponent card whose facing number is lower. House rules change by opponent.
import { rect, box, blitUI, frame, hline, imgFromIdx, type Img } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { pressed, repeat, MOUSE, mouseActive, consume } from '../engine/input';
import { W, H } from '../engine/screen';
import { CARD, OPPONENT, RULE_TEXT, STARTER, type CardDef, type Opponent, type RuleId } from '../content/cards';
import { sheetFor } from '../art/cast';
import { G } from '../game/state';
import { sfx } from '../audio/sfx';
import { drawWrapped } from './widgets';

type Owner = 0 | 1;
interface Cell { card: CardDef; owner: Owner }

const CW = 30, CH = 32;

const FIT = new Map<Img, Img>();
/** The bottom middle of a portrait, at most 14 by 11, so wide looks stay clear of the card numbers. */
function fitPortrait(im: Img): Img {
  if (im.w <= 14 && im.h <= 11) return im;
  let out = FIT.get(im);
  if (!out) {
    const w = Math.min(14, im.w), h = Math.min(11, im.h), ox = Math.floor((im.w - w) / 2), oy = im.h - h;
    const idx = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) idx[y * w + x] = im.px[(oy + y) * im.w + ox + x];
    out = imgFromIdx(w, h, idx);
    FIT.set(im, out);
  }
  return out;
}
const BX = 55, BY = 46;

export function ownedCards(): string[] {
  const cards = G.cards;
  if (!cards || !Object.keys(cards).length) return [...STARTER];
  return Object.keys(cards).filter((k) => cards[k] > 0 && CARD.has(k));
}

export function giveCard(id: string) {
  if (!G.cards || !Object.keys(G.cards).length) { G.cards = {}; for (const s of STARTER) G.cards[s] = 1; }
  G.cards[id] = (G.cards[id] ?? 0) + 1;
}

function power(c: CardDef): number { return c.n + c.e + c.s + c.w; }

export class Sluice {
  phase: 'deck' | 'play' | 'done' = 'deck';
  opp: Opponent;
  rules: RuleId[];
  board: (Cell | null)[] = Array(9).fill(null);
  hands: CardDef[][] = [[], []];
  turn: Owner = 0;
  sel = 0;
  cell = 4;
  deckSel = 0;
  picked: string[] = [];
  wet = new Set<number>();
  placed = 0;
  flooded = false;
  won: boolean | null = null;
  prize: string | null = null;
  aiWait = 0;
  t = 0;
  msg = '';
  done = false;

  constructor(oppId: string) {
    this.opp = OPPONENT.get(oppId) ?? OPPONENT.get('moss')!;
    this.rules = this.opp.rules;
    const own = ownedCards().sort((a, b) => power(CARD.get(b)!) - power(CARD.get(a)!));
    this.picked = own.slice(0, 5);
    if (this.rules.includes('wet')) { while (this.wet.size < 2) this.wet.add(Math.floor(Math.random() * 9)); }
  }

  start() {
    this.hands[0] = this.picked.map((id) => CARD.get(id)!);
    this.hands[1] = this.opp.deck.map((id) => CARD.get(id)!).filter(Boolean);
    this.turn = Math.random() < 0.5 ? 0 : 1;
    this.phase = 'play';
    this.aiWait = 0.8;
    sfx('confirm');
  }

  /** The number a card shows on one side at a cell, with house rules. */
  side(cell: number, c: Cell, dir: 'n' | 'e' | 's' | 'w'): number {
    let v = c.card[dir];
    if (this.wet.has(cell)) v += 1;
    if (this.flooded && cell >= 6) v -= 1;
    if (this.rules.includes('woken') && c.card.kind === 'woken') {
      for (const [nc] of this.neighbors(cell)) { const o = this.board[nc]; if (o && o.owner === c.owner) { v += 1; break; } }
    }
    return v;
  }

  neighbors(cell: number): [number, 'n' | 'e' | 's' | 'w', 'n' | 'e' | 's' | 'w'][] {
    const x = cell % 3, y = Math.floor(cell / 3);
    const out: [number, 'n' | 'e' | 's' | 'w', 'n' | 'e' | 's' | 'w'][] = [];
    if (y > 0) out.push([cell - 3, 'n', 's']);
    if (x < 2) out.push([cell + 1, 'e', 'w']);
    if (y < 2) out.push([cell + 3, 's', 'n']);
    if (x > 0) out.push([cell - 1, 'w', 'e']);
    return out;
  }

  /** Cells that would flip if card c of owner went at cell. */
  flips(cell: number, card: CardDef, owner: Owner): number[] {
    const me: Cell = { card, owner };
    const out: number[] = [];
    const prev = this.board[cell];
    this.board[cell] = me;
    const same: number[] = [];
    for (const [nc, mine, theirs] of this.neighbors(cell)) {
      const o = this.board[nc];
      if (!o || o.owner === owner) continue;
      const a = this.side(cell, me, mine), d = this.side(nc, o, theirs);
      if (a === d) same.push(nc);
      const need = this.rules.includes('board') && o.card.kind === 'board' ? d + 1 : d;
      if (a > need) out.push(nc);
    }
    if (this.rules.includes('same') && same.length >= 2) for (const nc of same) if (!out.includes(nc)) out.push(nc);
    this.board[cell] = prev;
    return out;
  }

  place(cell: number, hi: number) {
    const owner = this.turn;
    const card = this.hands[owner][hi];
    const fl = this.flips(cell, card, owner);
    this.board[cell] = { card, owner };
    this.hands[owner].splice(hi, 1);
    for (const f of fl) this.board[f]!.owner = owner;
    this.placed++;
    sfx(fl.length ? 'hit' : 'cursor');
    if (fl.length) this.msg = `${fl.length} flipped`;
    if (this.rules.includes('tide') && this.placed === 4 && !this.flooded) { this.flooded = true; this.msg = 'The bottom row floods'; sfx('splash'); }
    if (this.board.every((b) => b)) { this.finish(); return; }
    this.turn = owner === 0 ? 1 : 0;
    this.aiWait = 0.7;
    if (this.turn === 0) { this.sel = Math.min(this.sel, this.hands[0].length - 1); }
  }

  finish() {
    const mine = this.board.filter((b) => b?.owner === 0).length + this.hands[0].length;
    const theirs = this.board.filter((b) => b?.owner === 1).length + this.hands[1].length;
    this.won = mine > theirs;
    this.phase = 'done';
    if (mine === theirs) { this.won = null; this.msg = 'A draw'; sfx('cursor'); return; }
    if (this.won) {
      const owned = new Set(ownedCards());
      this.prize = this.opp.prize.find((p) => !owned.has(p)) ?? this.opp.prize[0];
      giveCard(this.prize);
      G.flags[`sluice_won_${this.opp.id}`] = (G.flags[`sluice_won_${this.opp.id}`] ?? 0) + 1;
      sfx('levelup');
    } else sfx('fail');
  }

  aiMove() {
    let best = { v: -Infinity, cell: 0, hi: 0 };
    const hand = this.hands[1];
    for (let hi = 0; hi < hand.length; hi++) for (let cell = 0; cell < 9; cell++) {
      if (this.board[cell]) continue;
      const fl = this.flips(cell, hand[hi], 1);
      let v = fl.length * 10;
      // Keep strong sides facing open squares and weak ones against walls.
      for (const [nc, mine] of this.neighbors(cell)) if (!this.board[nc]) v += (hand[hi][mine] - 5) * 0.8;
      v -= power(hand[hi]) * 0.15;
      v += (Math.random() - 0.5) * (1 - this.opp.skill) * 14;
      if (v > best.v) best = { v, cell, hi };
    }
    this.place(best.cell, best.hi);
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === 'deck') { this.updateDeck(); return; }
    if (this.phase === 'done') {
      if (pressed('a') || pressed('b') || MOUSE.left) { consume(); this.done = true; }
      return;
    }
    if (this.turn === 1) {
      this.aiWait -= dt;
      if (this.aiWait <= 0) this.aiMove();
      return;
    }
    const n = this.hands[0].length;
    if (repeat('up')) { if (this.cell >= 3) this.cell -= 3; sfx('cursor', { vol: 0.4 }); }
    if (repeat('down')) { if (this.cell < 6) this.cell += 3; sfx('cursor', { vol: 0.4 }); }
    if (repeat('left')) { if (this.cell % 3 > 0) this.cell--; else this.sel = (this.sel + n - 1) % n; sfx('cursor', { vol: 0.4 }); }
    if (repeat('right')) { if (this.cell % 3 < 2) this.cell++; sfx('cursor', { vol: 0.4 }); }
    if (pressed('tab') || pressed('n1')) this.sel = (this.sel + 1) % n;
    if (mouseActive()) {
      const hx = 8, hy = BY;
      for (let i = 0; i < n; i++) if (MOUSE.x >= hx && MOUSE.x < hx + CW && MOUSE.y >= hy + i * 22 && MOUSE.y < hy + i * 22 + (i === n - 1 ? CH : 22)) { if (MOUSE.moved || MOUSE.left) this.sel = i; }
      const cx = Math.floor((MOUSE.x - BX) / CW), cy = Math.floor((MOUSE.y - BY) / CH);
      if (cx >= 0 && cx < 3 && cy >= 0 && cy < 3) { this.cell = cy * 3 + cx; if (MOUSE.left && !this.board[this.cell]) { consume(); this.place(this.cell, this.sel); return; } }
    }
    if (pressed('a') && !this.board[this.cell]) { consume(); this.place(this.cell, this.sel); }
    else if (pressed('a')) sfx('error');
  }

  updateDeck() {
    const own = ownedCards().sort((a, b) => power(CARD.get(b)!) - power(CARD.get(a)!));
    const n = Math.min(own.length, 13);
    if (repeat('up')) this.deckSel = (this.deckSel + n - 1) % n;
    if (repeat('down')) this.deckSel = (this.deckSel + 1) % n;
    if (mouseActive() && MOUSE.moved) { const i = Math.floor((MOUSE.y - 66) / 9); if (i >= 0 && i < Math.min(n, 13)) this.deckSel = i; }
    const toggle = pressed("a") || (MOUSE.left && MOUSE.y >= 66 && MOUSE.y < 66 + Math.min(n, 13) * 9);
    if (toggle) {
      consume();
      const id = own[this.deckSel];
      if (this.picked.includes(id)) this.picked = this.picked.filter((x) => x !== id);
      else if (this.picked.length < 5) this.picked.push(id);
      sfx('cursor');
    }
    if (pressed('end') && this.picked.length === 5) { consume(); this.start(); }
    if (pressed('b')) { consume(); this.done = true; }
  }

  renderCard(c: CardDef, owner: Owner | -1, x: number, y: number, cellIdx = -1) {
    const col = owner === 0 ? C.cyan2 : owner === 1 ? C.mag2 : C.slate;
    box(x, y, CW, CH, owner === 0 ? C.cyan0 : owner === 1 ? C.mag0 : C.ink, col);
    const sh = fitPortrait(sheetFor(c.look).frames.down[0]);
    blitUI(sh, x + Math.floor((CW - sh.w) / 2), y + 11 - Math.max(0, sh.h - 10));
    const cell = cellIdx >= 0 ? this.board[cellIdx] : null;
    const v = (d: 'n' | 'e' | 's' | 'w') => (cell ? this.side(cellIdx, cell, d) : c[d]);
    const num = (s: number) => (s >= 10 ? 'A' : String(Math.max(0, s)));
    drawText(num(v('n')), x + 13, y + 2, C.white);
    drawText(num(v('s')), x + 13, y + 22, C.white);
    drawText(num(v('w')), x + 2, y + 12, C.white);
    drawText(num(v('e')), x + CW - 7, y + 12, C.white);
  }

  render() {
    rect(0, 0, W, H, C.black);
    if (this.phase === 'deck') { this.renderDeck(); return; }
    drawText(`SLUICE vs ${this.opp.name}`, 4, 3, C.amb3);
    const rules = this.rules.length ? this.rules.join(', ') : 'basic';
    drawText(rules, W - 4 - textWidth(rules), 3, C.vio3);
    hline(0, 13, W, C.night);
    // Board.
    for (let i = 0; i < 9; i++) {
      const x = BX + (i % 3) * CW, y = BY + Math.floor(i / 3) * CH;
      const b = this.board[i];
      if (b) this.renderCard(b.card, b.owner, x, y, i);
      else {
        rect(x + 1, y + 1, CW - 2, CH - 2, this.wet.has(i) ? C.cyan0 : this.flooded && i >= 6 ? C.steel0 : C.ink);
        frame(x, y, CW, CH, C.night);
      }
      if (this.turn === 0 && this.phase === 'play' && i === this.cell) frame(x, y, CW, CH, C.amb3);
    }
    // Hands.
    this.hands[0].forEach((c, i) => this.renderCard(c, 0, 8 + (i === this.sel && this.turn === 0 ? 4 : 0), BY + i * 22));
    this.hands[1].forEach((c, i) => this.renderCard(c, 1, W - 8 - CW, BY + i * 22));
    const mine = this.board.filter((b) => b?.owner === 0).length + this.hands[0].length;
    const theirs = this.board.filter((b) => b?.owner === 1).length + this.hands[1].length;
    drawText(`${mine}`, 18, 30, C.cyan3);
    drawText(`${theirs}`, W - 24, 30, C.mag3);
    const status = this.phase === 'done' ? (this.won === true ? `You win. ${CARD.get(this.prize!)?.name ?? ''} is yours.` : this.won === false ? 'You lose.' : 'A draw.') : this.turn === 0 ? 'Your move' : `${this.opp.name} thinks`;
    drawText(status, Math.round((W - textWidth(status)) / 2), H - 22, this.phase === 'done' ? (this.won ? C.grn3 : C.mag3) : C.pale);
    if (this.msg && this.phase !== 'done') drawText(this.msg, Math.round((W - textWidth(this.msg)) / 2), H - 12, C.gray);
    if (this.phase === 'done') drawText('Z: continue', Math.round((W - textWidth('Z: continue')) / 2), H - 12, C.gray);
  }

  renderDeck() {
    const own = ownedCards().sort((a, b) => power(CARD.get(b)!) - power(CARD.get(a)!));
    drawText(`SLUICE vs ${this.opp.name}: pick 5`, 4, 4, C.amb3);
    let ry = 15;
    for (const r of this.rules) ry += drawWrapped(RULE_TEXT[r], 4, ry, W - 8, C.vio3, 3);
    own.slice(0, 13).forEach((id, i) => {
      const c = CARD.get(id)!;
      const y = 66 + i * 9;
      if (i === this.deckSel) rect(2, y - 1, W - 4, 9, C.vio0);
      const on = this.picked.includes(id);
      drawText(`${on ? '+' : ' '} ${c.name}`, 6, y, on ? C.cyan3 : C.pale);
      drawText(`${c.n} ${c.e} ${c.s} ${c.w}`, W - 50, y, C.gray);
    });
    const hint = this.picked.length === 5 ? 'E: play' : `${this.picked.length}/5`;
    drawText(hint, W - 6 - textWidth(hint), H - 12, this.picked.length === 5 ? C.grn3 : C.gray);
  }
}
