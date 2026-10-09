// The grotto shop: the stock with icons and prices, the cowries in hand, a panel that describes the picked item and how many
// are held, a quantity picker, and a confirmation before anything is paid.
import { NOTIONS } from '../battle/registry';
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { sfx } from '../engine/audio';
import { dither, frame, mix, rect, INK } from '../engine/screen';
import { drawIcon, HORN_TEXT, iconOf, type Entry } from './bag';
import { ITEMS } from './items';
import { close, run, type Mode } from './modes';
import { G, HORN_NAME, HORN_PRICE, save } from './state';
import { BADC, DIM, PAPER, SEL } from './ui';

interface Ware { id: string; name: string; price: number; text: string; kind: Entry['kind'] }

const BG = '#17151d', ACCENT = '#e8b040';
const ROW = 11, LIST_Y = 27, ROWS = 8;
const MAX_BUY = 99;

/** The item the cursor was on, kept between visits so the shop opens where it was left. */
let lastId = '';

function wareOf(id: string): Ware {
  if (id in HORN_PRICE) return { id, name: HORN_NAME[id as keyof typeof HORN_NAME], price: HORN_PRICE[id as keyof typeof HORN_PRICE], text: HORN_TEXT[id] || '', kind: 'horn' };
  if (ITEMS[id]) return { id, name: ITEMS[id].name, price: ITEMS[id].price, text: ITEMS[id].text, kind: 'item' };
  const n = NOTIONS[id];
  return { id, name: n.name, price: n.price || 0, text: n.text, kind: n.spent ? 'spent' : 'notion' };
}

function heldOf(w: Ware): number {
  if (w.kind === 'horn') return G.pegs[w.id as keyof typeof G.pegs] || 0;
  if (w.kind === 'item') return G.items[w.id] || 0;
  return G.notions[w.id] || 0;
}

function give(w: Ware, n: number): void {
  if (w.kind === 'horn') G.pegs[w.id as keyof typeof G.pegs] += n;
  else if (w.kind === 'item') G.items[w.id] = (G.items[w.id] || 0) + n;
  else G.notions[w.id] = (G.notions[w.id] || 0) + n;
}

/** A small cowrie, 5 by 5, for prices and the purse. */
function cowrie(x: number, y: number): void {
  rect(x + 1, y, 3, 1, INK); rect(x, y + 1, 5, 3, INK); rect(x + 1, y + 4, 3, 1, INK);
  rect(x + 1, y + 1, 3, 3, '#f0d8c8'); rect(x + 2, y + 1, 1, 3, '#a8786a');
}

type Sub = { kind: 'list' } | { kind: 'count'; n: number; max: number } | { kind: 'confirm'; n: number; yes: boolean };

class ShopMode implements Mode {
  opaque = true;
  t = 0;
  sel = 0;
  scroll = 0;
  curY = 0;
  sub: Sub = { kind: 'list' };
  toast = '';
  toastT = 0;
  wares: Ware[];

  constructor(stock: string[], public done: () => void) {
    this.wares = stock.map(wareOf);
    this.sel = Math.max(0, this.wares.findIndex(w => w.id === lastId));
    this.curY = this.sel;
  }

  note(s: string): void { this.toast = s; this.toastT = 120; }

  update(): void {
    this.t++;
    if (this.toastT > 0) this.toastT--;
    const w = this.wares[this.sel], sub = this.sub;
    if (sub.kind === 'count') {
      if (input.hit('up') || input.hit('right')) { sub.n = sub.n >= sub.max ? 1 : sub.n + 1; sfx('move'); }
      if (input.hit('down') || input.hit('left')) { sub.n = sub.n <= 1 ? sub.max : sub.n - 1; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'list' }; sfx('back'); return; }
      if (input.hit('ok')) { this.sub = { kind: 'confirm', n: sub.n, yes: true }; sfx('ok'); }
      return;
    }
    if (sub.kind === 'confirm') {
      if (input.hit('up') || input.hit('down') || input.hit('left') || input.hit('right')) { sub.yes = !sub.yes; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'list' }; sfx('back'); return; }
      if (input.hit('ok') && w) {
        this.sub = { kind: 'list' };
        if (!sub.yes) { sfx('back'); return; }
        G.rind -= sub.n * w.price;
        give(w, sub.n);
        save();
        sfx('spot');
        this.note(sub.n > 1 ? `Bought ${w.name} x${sub.n}.` : `Bought the ${w.name}.`);
      }
      return;
    }
    const n = this.wares.length;
    if (input.hit('up') && n) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
    if (input.hit('down') && n) { this.sel = (this.sel + 1) % n; sfx('move'); }
    lastId = this.wares[this.sel]?.id || '';
    if (input.hit('back')) { sfx('back'); close(this); this.done(); return; }
    if (input.hit('ok') && w) {
      const max = Math.min(MAX_BUY, Math.floor(G.rind / Math.max(1, w.price)));
      if (max < 1) { sfx('bump'); this.note('Not enough cowries.'); return; }
      sfx('ok');
      this.sub = { kind: 'count', n: 1, max };
    }
  }

  draw(): void {
    rect(0, 0, 192, 192, BG);
    // The counter's head: what this screen is, and the cowries in hand.
    frame(2, 2, 188, 19, '#211e2a', ACCENT);
    text('Buy', 8, 8, ACCENT);
    // A note after a purchase takes the middle of the head for two seconds.
    textCenter(this.toastT > 0 ? this.toast : 'Shellwright\'s counter', 96, 8, this.toastT > 0 ? SEL : DIM);
    const purse = String(G.rind);
    textRight(purse, 184, 8, PAPER);
    cowrie(184 - textWidth(purse) - 8, 9);
    // The stock, with a highlight that glides to the picked row.
    const list = this.wares, sel = this.sel;
    this.curY += (sel - this.curY) * 0.35;
    this.scroll = Math.min(this.scroll, Math.max(0, list.length - ROWS));
    if (sel < this.scroll) this.scroll = sel;
    if (sel >= this.scroll + ROWS) this.scroll = sel - ROWS + 1;
    const hy = LIST_Y + (this.curY - this.scroll) * ROW;
    if (hy >= LIST_Y - 2 && hy < LIST_Y + ROWS * ROW) rect(4, Math.round(hy) - 1, 184, ROW, mix(ACCENT, BG, 0.78));
    for (let k = 0; k < ROWS; k++) {
      const w = list[this.scroll + k];
      if (!w) break;
      const y = LIST_Y + k * ROW, on = this.scroll + k === sel, can = G.rind >= w.price;
      drawIcon(iconOf(w.id, w.kind), 8, y, 1);
      text(w.name, 20, y, on ? SEL : PAPER);
      const p = String(w.price);
      textRight(p, 178, y, can ? (on ? SEL : PAPER) : BADC);
      cowrie(181, y + 1);
    }
    if (this.scroll > 0) for (let k = 0; k < 3; k++) rect(96 - k, LIST_Y - 3 + k, 1 + k * 2, 1, DIM);
    if (this.scroll + ROWS < list.length) for (let k = 0; k < 3; k++) rect(96 - k, LIST_Y + ROWS * ROW + 1 - k, 1 + k * 2, 1, DIM);
    // The panel: the picked item large and its name. Below them it shows what the item does, then the quantity picker,
    // then the confirmation, so nothing ever lies on top of the list.
    const py = 130, sub = this.sub;
    frame(2, py - 4, 188, 62, '#1e1b26', sub.kind === 'list' ? ACCENT : SEL);
    const w = list[sel];
    if (w) {
      frame(6, py, 20, 20, mix(ACCENT, BG, 0.75), '#3a3442');
      drawIcon(iconOf(w.id, w.kind), 8, py + 2, 2);
      text(w.name, 30, py, ACCENT);
      if (sub.kind === 'list') {
        wrap(w.text, 154).slice(0, 4).forEach((l, j) => text(l, 30, py + 10 + j * 9, PAPER));
        const held = heldOf(w), team = w.kind === 'notion' || w.kind === 'spent' ? G.party.filter(m => m.notion === w.id).length : 0;
        text(`You have ${held}${team ? `, ${team} on your team` : ''}`, 8, py + 47, DIM);
        textRight(`${w.price} each`, 186, py + 47, G.rind >= w.price ? DIM : BADC);
      } else this.drawSub(w, py);
    }
    if (this.t < 10) dither(0, 0, 192, 192, INK, 1 - this.t / 10);
  }

  /** The quantity picker or the confirmation, in the panel under the item's name. */
  drawSub(w: Ware, py: number): void {
    const sub = this.sub, total = sub.kind === 'list' ? 0 : sub.n * w.price;
    if (sub.kind === 'count') {
      text('How many?', 30, py + 11, PAPER);
      textCenter(`<  ${sub.n}  >`, 96, py + 25, SEL);
      text('Total', 8, py + 47, DIM); textRight(String(total), 86, py + 47, PAPER); cowrie(89, py + 48);
      text('Left', 106, py + 47, DIM); textRight(String(G.rind - total), 178, py + 47, PAPER); cowrie(181, py + 48);
    } else if (sub.kind === 'confirm') {
      const what = sub.n > 1 ? `Buy ${sub.n} for ${total} cowries?` : `Buy it for ${total} cowries?`;
      text(what, 30, py + 11, PAPER);
      ['Buy', 'Cancel'].forEach((o, k) => {
        const x = 52 + k * 56, on = sub.yes === (k === 0);
        if (on) frame(x - 6, py + 25, 44, 13, '#3a3346', SEL);
        textCenter(o, x + 16, py + 28, on ? SEL : PAPER);
      });
      text('Z picks, X goes back', 8, py + 47, DIM);
    }
  }
}

/** Opens the shop on a stock of horn, item, and notion ids. */
export function shopScreen(stock: string[]): Promise<void> {
  return new Promise(res => { void run(new ShopMode(stock, res)); });
}
