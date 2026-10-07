// The Stet book: every card found, how many, and the five-card deck. Also Weigh's stall.
import { sfx } from '../../engine/audio';
import { CW, LH, text, wrap } from '../../engine/font';
import { pressed, tapped } from '../../engine/input';
import { H, W, rect } from '../../engine/screen';
import { Scene, app } from '../app';
import { C, panel } from '../ui';
import { CARDS, CARD_IDS, WORDS, cardWorth } from './cards';
import { DECK_SIZE, autoDeck, fillDeck, grant, owned, sourceOf, status, stockFor } from './collection';
import { cursorFrame, drawBack, drawCard, faceOf } from './draw';

const ROWS = 14;

/** The card on the right of the book and the shop: face, name, word, aside, where it is found. */
function cardPage(id: string, known: boolean, x: number, y: number) {
  panel(x, y, 92, 124, C.faint);
  const c = CARDS[id];
  if (!known || !c) {
    drawBack(x + 4, y + 4, -1);
    text('Not found', x + 36, y + 5, C.dim);
    text('yet.', x + 36, y + 5 + LH, C.dim);
    return;
  }
  drawCard(faceOf(id, -1), x + 4, y + 4, app.beat());
  wrap(c.name, 10).slice(0, 2).forEach((l, i) => text(l, x + 36, y + 5 + i * LH, C.text));
  text(`tier ${c.tier}`, x + 36, y + 23, c.secret ? C.again : C.gold);
  if (c.word) text(c.word, x + 36, y + 31, WORDS[c.word].color);
  let yy = y + 44;
  const put = (s: string, col: number) => { for (const l of wrap(s, 17)) { if (yy > y + 116) return; text(l, x + 4, yy, col); yy += LH; } };
  if (c.word) put(WORDS[c.word].text, C.text);
  put(`# ${c.flavor}`, C.aside);
  put(sourceOf(id), C.dim);
}

function listed(): string[] {
  const st = app.s.stet;
  const ids = CARD_IDS.filter((id) => !CARDS[id].secret || owned(st, id) > 0);
  return ids.sort((a, b) => cardWorth(a) - cardWorth(b) || CARDS[a].name.localeCompare(CARDS[b].name));
}

export class BookScene implements Scene {
  opaque = true;
  ids = listed();
  i = 0;
  top = 0;
  zone: 'list' | 'deck' = 'list';
  di = 0;
  msg = '';
  msgT = 0;

  private say(s: string) { this.msg = s; this.msgT = 90; }

  update() {
    const st = app.s.stet;
    if (this.msgT > 0) this.msgT--;
    if (tapped('cast')) { autoDeck(st); sfx.get(); this.say('The best five.'); return; }
    if (tapped('tab')) { this.zone = this.zone === 'list' ? 'deck' : 'list'; this.di = Math.min(this.di, Math.max(0, st.deck.length - 1)); sfx.move(); return; }
    if (tapped('back')) {
      if (st.deck.length < DECK_SIZE) fillDeck(st);
      sfx.back();
      app.pop();
      return;
    }
    if (this.zone === 'deck') {
      const n = st.deck.length;
      if (n && pressed('left')) { this.di = (this.di + n - 1) % n; sfx.move(); }
      if (n && pressed('right')) { this.di = (this.di + 1) % n; sfx.move(); }
      if (pressed('up')) { this.zone = 'list'; sfx.move(); }
      if (tapped('ok') && n) {
        st.deck.splice(this.di, 1);
        this.di = Math.min(this.di, Math.max(0, st.deck.length - 1));
        sfx.back();
      }
      return;
    }
    const n = this.ids.length;
    if (pressed('up')) { this.i = (this.i + n - 1) % n; sfx.move(); }
    if (pressed('down')) { this.i = (this.i + 1) % n; sfx.move(); }
    if (pressed('left')) { this.i = Math.max(0, this.i - ROWS); sfx.move(); }
    if (pressed('right')) { this.i = Math.min(n - 1, this.i + ROWS); sfx.move(); }
    if (this.i < this.top) this.top = this.i;
    if (this.i >= this.top + ROWS) this.top = this.i - ROWS + 1;
    if (tapped('ok')) {
      const id = this.ids[this.i];
      const used = st.deck.filter((d) => d === id).length;
      if (!owned(st, id)) { sfx.error(); this.say('You have none.'); }
      else if (st.deck.length >= DECK_SIZE) { sfx.error(); this.say('Five already. Take one out.'); }
      else if (used >= owned(st, id)) { sfx.error(); this.say('Every copy is in the deck.'); }
      else { st.deck.push(id); sfx.ok(); }
    }
  }

  draw() {
    const st = app.s.stet;
    rect(0, 0, W, H, 0x0b0a10);
    text('Stet', 4, 2, C.hi);
    const ss = status(st);
    const head = `${ss.owned} of ${ss.total} found`;
    text(head, W - 4 - head.length * CW, 2, C.dim);
    const end = Math.min(this.ids.length, this.top + ROWS);
    for (let k = this.top; k < end; k++) {
      const id = this.ids[k];
      const y = 13 + (k - this.top) * LH;
      const have = owned(st, id);
      if (k === this.i && this.zone === 'list') { rect(3, y - 1, 90, LH, C.sel); text('\x01', 4, y, C.hi); }
      text(have ? CARDS[id].name.slice(0, 13) : '?????', 10, y, have ? C.text : C.faint);
      if (have) {
        const inDeck = st.deck.filter((d) => d === id).length;
        const r = inDeck ? `${inDeck}/${have}` : `${have}`;
        text(r, 92 - r.length * CW, y, inDeck ? C.hi : C.dim);
      }
    }
    if (this.top > 0) text('\x04', 86, 7, C.dim);
    if (end < this.ids.length) text('\x03', 86, 13 + ROWS * LH - 3, C.dim);
    const sel = this.zone === 'deck' ? st.deck[this.di] : this.ids[this.i];
    if (sel) cardPage(sel, owned(st, sel) > 0, 96, 12);

    const hint = this.msgT > 0 ? this.msg : this.zone === 'list' ? 'Z add  Tab deck  C best five' : 'Z take out  Tab list';
    text(hint, 4, 140, this.msgT > 0 ? C.gold : C.faint);
    text('Deck', 4, 160, this.zone === 'deck' ? C.hi : C.dim);
    for (let k = 0; k < DECK_SIZE; k++) {
      const x = 36 + k * 30;
      const id = st.deck[k];
      if (id) drawCard(faceOf(id, 0), x, 152, app.beat());
      else drawBack(x, 152, -1);
      if (this.zone === 'deck' && k === this.di && id) cursorFrame(x, 152, Math.floor(app.t * 4) % 2 ? C.gold : C.hi);
    }
  }
}

/** Weigh's stall: cards for blanks. */
export class ShopScene implements Scene {
  opaque = true;
  stock = stockFor(app.s.chapter);
  i = 0;
  msg = 'Pages. Pages. Cards are paper too. I weigh them the same.';

  update() {
    const n = this.stock.length;
    if (tapped('back')) { sfx.back(); app.pop(); return; }
    if (!n) return;
    if (pressed('up')) { this.i = (this.i + n - 1) % n; sfx.move(); }
    if (pressed('down')) { this.i = (this.i + 1) % n; sfx.move(); }
    if (tapped('ok')) {
      const it = this.stock[this.i];
      const s = app.s;
      if (s.blanks < it.price) { sfx.error(); this.msg = 'Light. Come back with more blanks.'; return; }
      s.blanks -= it.price;
      grant(s.stet, it.id);
      if (s.stet.deck.length < DECK_SIZE) fillDeck(s.stet);
      sfx.get();
      this.msg = 'Heavy. Good. The other two of me agree.';
    }
  }

  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    text('Weigh\'s stall', 4, 2, C.hi);
    const b = `${app.s.blanks} blanks`;
    text(b, W - 4 - b.length * CW, 2, C.gold);
    this.stock.forEach((it, k) => {
      const y = 13 + k * LH;
      if (k === this.i) { rect(3, y - 1, 90, LH, C.sel); text('\x01', 4, y, C.hi); }
      text(CARDS[it.id].name.slice(0, 10), 10, y, C.text);
      const p = String(it.price);
      text(p, 92 - p.length * CW, y, app.s.blanks >= it.price ? C.gold : C.faint);
    });
    const it = this.stock[this.i];
    if (it) {
      cardPage(it.id, true, 96, 12);
      const have = owned(app.s.stet, it.id);
      text(`you have ${have}`, 100, 140, C.dim);
    }
    panel(4, 150, 184, 36, C.faint);
    wrap(this.msg, 35).slice(0, 3).forEach((l, k) => text(l, 8, 155 + k * LH, C.text));
  }
}
