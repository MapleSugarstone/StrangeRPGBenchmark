import { Rng } from '../core/rng';
import { CHARS } from '../data/characters';
import { wrap } from '../gfx/font';
import { C, rgb, type Screen, type Sprite } from '../gfx/screen';
import { icon, npcSprite, partySprite } from '../gfx/sprites';
import type { Game, Overlay } from './game';

export const COL = {
  panel: rgb('#0a0a18'), border: rgb('#c8c8e8'), hi: rgb('#ffe34a'), dim: rgb('#6a6a8a'), hp: rgb('#6fdc5a'), hpLow: rgb('#ff5a5a'), mp: rgb('#58a8ff'),
  nerve: rgb('#ffc83a'), good: rgb('#6fdc5a'), bad: rgb('#ff5a5a'),
};

const ALIAS: Record<string, string> = {};
for (const c of CHARS) { ALIAS[c.name.toUpperCase()] = c.id; ALIAS[c.id.toUpperCase()] = c.id; }

export function speakerSprite(who: string): Sprite | null {
  if (!who) return null;
  const id = ALIAS[who];
  return id ? partySprite(id) : npcSprite(who);
}

export function starfield(n: number, seed: number, w: number, h: number, y0 = 0): [number, number][] {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => [r.int(w), y0 + r.int(h)] as [number, number]);
}

export function hpColor(frac: number): number {
  return frac < 0.3 ? COL.hpLow : frac < 0.6 ? C.yellow : COL.hp;
}

export interface ListItem { label: string; right?: string; disabled?: boolean; color?: number }

export class ListMenu {
  cursor = 0;
  scroll = 0;
  constructor(public items: ListItem[], public visible = 5, public cols = 1) {}
  setItems(items: ListItem[]) {
    this.items = items;
    this.cursor = Math.min(this.cursor, Math.max(0, items.length - 1));
    this.clampScroll();
  }
  private clampScroll() {
    const rows = this.cols === 1 ? this.visible : this.visible;
    const row = this.cols === 1 ? this.cursor : Math.floor(this.cursor / this.cols);
    if (row < this.scroll) this.scroll = row;
    if (row >= this.scroll + rows) this.scroll = row - rows + 1;
  }
  /** Returns 'ok' | 'cancel' | null. */
  update(g: Game): 'ok' | 'cancel' | null {
    const i = g.input;
    const n = this.items.length;
    if (n) {
      const old = this.cursor;
      if (this.cols === 1) {
        if (i.was('up')) this.cursor = (this.cursor + n - 1) % n;
        if (i.was('down')) this.cursor = (this.cursor + 1) % n;
      } else {
        if (i.was('left') && this.cursor % this.cols > 0) this.cursor--;
        if (i.was('right') && this.cursor % this.cols < this.cols - 1 && this.cursor + 1 < n) this.cursor++;
        if (i.was('up') && this.cursor - this.cols >= 0) this.cursor -= this.cols;
        if (i.was('down') && this.cursor + this.cols < n) this.cursor += this.cols;
      }
      if (old !== this.cursor) { g.audio.sfx('cursor'); this.clampScroll(); }
    }
    if (i.was('a') && n && !this.items[this.cursor].disabled) { g.audio.sfx('ok'); return 'ok'; }
    if (i.was('b')) { g.audio.sfx('cancel'); return 'cancel'; }
    return null;
  }
  draw(s: Screen, x: number, y: number, w: number, active = true) {
    const colW = Math.floor(w / this.cols);
    const rows = this.visible;
    const first = this.scroll * this.cols;
    for (let k = 0; k < rows * this.cols; k++) {
      const idx = first + k;
      const it = this.items[idx];
      if (!it) break;
      const cx = x + (k % this.cols) * colW, cy = y + Math.floor(k / this.cols) * 7;
      const sel = idx === this.cursor && active;
      const col = it.disabled ? COL.dim : it.color ?? (sel ? COL.hi : C.white);
      if (sel) s.text(cx, cy, '>', COL.hi);
      s.text(cx + 5, cy, it.label, col);
      if (it.right) s.textR(cx + colW - 2, cy, it.right, it.disabled ? COL.dim : C.gray);
    }
    if (this.scroll > 0) s.text(x + w - 4, y - 1, '^', C.gray);
    const total = Math.ceil(this.items.length / this.cols);
    if (this.scroll + rows < total) s.text(x + w - 4, y + rows * 7 - 6, '=', C.gray);
  }
}

export function panel(s: Screen, x: number, y: number, w: number, h: number, title?: string) {
  s.box(x, y, w, h, COL.border, COL.panel);
  if (title) { s.rect(x + 3, y - 1, title.length * 4 + 1, 3, COL.panel); s.text(x + 4, y - 2, title, COL.hi); }
}

// ---------------------------------------------------------------------------- overlays
export class SayBox implements Overlay {
  private pages: string[][];
  private page = 0;
  private shown = 0;
  private sprite: Sprite | null;
  constructor(private who: string, text: string, private done: (v: void) => void) {
    const lines = wrap(text, 30);
    this.pages = [];
    for (let i = 0; i < lines.length; i += 4) this.pages.push(lines.slice(i, i + 4));
    this.sprite = speakerSprite(who);
  }
  update(g: Game) {
    const total = this.pages[this.page].join('').length;
    if (this.shown < total) {
      this.shown += g.input.held.has('a') ? 3 : 1;
      if (g.frame % 3 === 0) g.audio.sfx('text');
      if (g.input.was('a') || g.input.was('b')) this.shown = total;
      return;
    }
    if (g.input.was('a') || g.input.was('b')) {
      g.audio.sfx('ok');
      if (this.page + 1 < this.pages.length) { this.page++; this.shown = 0; } else this.done();
    }
  }
  draw(g: Game, s: Screen) {
    panel(s, 1, 84, 126, 43);
    let ty = 88;
    if (this.who) {
      if (this.sprite) s.sprite(this.sprite, 4, 87);
      s.text(this.sprite ? 14 : 5, 89, this.who, COL.hi);
      ty = 97;
    } else ty = 90;
    let left = this.shown;
    for (let i = 0; i < this.pages[this.page].length; i++) {
      const ln = this.pages[this.page][i];
      const part = ln.slice(0, Math.max(0, left));
      left -= ln.length;
      s.text(5, ty + i * 6, part, C.white);
    }
    if (this.shown >= this.pages[this.page].join('').length && Math.floor(g.frame / 20) % 2 === 0) s.text(118, 120, '>', COL.hi);
  }
}

export class ChoiceBox implements Overlay {
  private menu: ListMenu;
  constructor(private prompt: string, opts: string[], private done: (v: number) => void) {
    this.menu = new ListMenu(opts.map((label) => ({ label })), Math.min(4, opts.length));
  }
  update(g: Game) {
    const r = this.menu.update(g);
    if (r === 'ok') this.done(this.menu.cursor);
  }
  draw(g: Game, s: Screen) {
    const lines = wrap(this.prompt, 28);
    const h = lines.length * 6 + this.menu.items.length * 7 + 8;
    panel(s, 4, 122 - h, 120, h);
    lines.forEach((l, i) => s.text(8, 122 - h + 4 + i * 6, l, C.white));
    this.menu.draw(s, 8, 122 - h + 6 + lines.length * 6, 112);
  }
}

export class CardBox implements Overlay {
  private t = 0;
  private lines: string[];
  constructor(lines: string[], private done: (v: void) => void) {
    this.lines = lines.flatMap((l) => (l.length > 30 ? wrap(l, 30) : [l]));
  }
  update(g: Game) {
    this.t++;
    if (this.t > 20 && (g.input.was('a') || g.input.was('b'))) { g.audio.sfx('ok'); this.done(); }
  }
  draw(g: Game, s: Screen) {
    s.clear();
    const n = this.lines.length;
    const y0 = 64 - Math.floor(n * 4);
    const visible = Math.min(n, Math.floor(this.t / 8) + 1);
    for (let i = 0; i < visible; i++) {
      const col = i === 0 ? COL.hi : this.lines[i].toUpperCase() === this.lines[i] && this.lines[i].length > 3 && this.lines[0] === 'NEW MECHANIC' && i === 1 ? C.cyan : C.white;
      s.textC(64, y0 + i * 8, this.lines[i], col);
    }
    if (this.t > 30 && Math.floor(g.frame / 20) % 2 === 0) s.textC(64, 118, 'PRESS Z', C.gray);
  }
}

export class Notify implements Overlay {
  private t = 0;
  constructor(private text: string, private done: (v: void) => void) {}
  update(g: Game) {
    this.t++;
    if (this.t > 10 && (g.input.was('a') || g.input.was('b') || this.t > 120)) this.done();
  }
  draw(_g: Game, s: Screen) {
    const lines = wrap(this.text, 26);
    const h = lines.length * 6 + 8;
    panel(s, 10, 50 - h / 2, 108, h);
    lines.forEach((l, i) => s.textC(64, 50 - h / 2 + 4 + i * 6, l, C.white));
  }
}

export function drawIcon(s: Screen, name: string, x: number, y: number) { s.sprite(icon(name), x, y); }
