import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import type { SpriteSpec } from '../core/sprites';
import { wrap, LINE_H, textW } from '../core/font';
import { MEMBERS } from '../data/members';
import { PORTRAITS } from '../data/portraits';
import { Menu } from './ui';

const BOX_Y = 114;
const BOX_H = 46;
const LINES = 4;

export function portraitFor(who: string): SpriteSpec | undefined {
  const key = who.toLowerCase();
  return MEMBERS[key]?.sprite ?? PORTRAITS[key];
}

export class DialogScene implements Scene {
  overlay = true;
  private pages: string[][] = [];
  private page = 0;
  private shown = 0;
  private t = 0;
  private spr?: SpriteSpec;

  constructor(private g: Game, private who: string, text: string, spr: SpriteSpec | undefined, private done: () => void) {
    this.spr = spr ?? (who ? portraitFor(who) : undefined);
    const width = this.spr ? 160 - 30 : 160 - 12;
    const lines = wrap(text, width);
    for (let i = 0; i < lines.length; i += LINES) this.pages.push(lines.slice(i, i + LINES));
    if (!this.pages.length) this.pages.push(['']);
  }

  private get total(): number {
    return this.pages[this.page].reduce((s, l) => s + l.replace(/\^./g, '').length, 0);
  }

  update() {
    this.t++;
    const inp = this.g.input;
    const fast = inp.isDown('a') || inp.isDown('b');
    if (this.shown < this.total) {
      const before = this.shown;
      this.shown = Math.min(this.total, this.shown + (fast ? 4 : 1.5));
      if (Math.floor(this.shown / 3) !== Math.floor(before / 3)) this.g.audio.sfx('blip');
      if (inp.pressed('a')) this.shown = this.total;
      return;
    }
    if (inp.pressed('a') || inp.pressed('b')) {
      if (this.page < this.pages.length - 1) {
        this.page++;
        this.shown = 0;
        this.g.audio.sfx('tick');
      } else {
        this.g.pop(this);
        this.done();
      }
    }
  }

  draw(g: Gfx) {
    g.box(0, BOX_Y, 160, BOX_H);
    let tx = 6;
    if (this.spr) {
      g.rect(4, BOX_Y + 5, 20, 20, 'ink');
      g.sprite(this.spr, 6, BOX_Y + 7, { scale: 2, grey: false });
      tx = 28;
    }
    if (this.who) {
      const w = textW(this.who) + 8;
      g.box(4, BOX_Y - 8, w, 10);
      g.text(this.who, 8, BOX_Y - 6, 'y2');
    }
    let left = this.shown;
    this.pages[this.page].forEach((line, i) => {
      if (left <= 0) return;
      g.text(line, tx, BOX_Y + 5 + i * (LINE_H + 2), 'w', Math.floor(left));
      left -= line.replace(/\^./g, '').length;
    });
    if (this.shown >= this.total && Math.floor(this.t / 16) % 2 === 0) {
      g.rect(152, BOX_Y + BOX_H - 6, 3, 1, 'w');
      g.rect(153, BOX_Y + BOX_H - 5, 1, 1, 'w');
    }
  }
}

export class ChoiceScene implements Scene {
  overlay = true;
  private menu: Menu;
  private lines: string[];
  private t = 0;

  constructor(private g: Game, q: string, opts: string[], private done: (i: number) => void) {
    this.menu = new Menu(opts.map(o => ({ label: o })), Math.min(opts.length, 5));
    this.lines = q ? wrap(q, 148) : [];
  }

  update() {
    this.t++;
    const r = this.menu.update(this.g.input, this.g.audio);
    if (r === 'ok') {
      this.g.pop(this);
      this.done(this.menu.idx);
    }
  }

  draw(g: Gfx) {
    if (this.lines.length) {
      g.box(0, BOX_Y, 160, BOX_H);
      this.lines.slice(0, LINES).forEach((l, i) => g.text(l, 6, BOX_Y + 5 + i * (LINE_H + 2)));
    }
    const w = Math.max(...this.menu.items.map(i => textW(i.label))) + 18;
    const h = this.menu.rows * LINE_H + 6;
    this.menu.draw(g, 156 - w, BOX_Y - h - 2, w, this.t);
  }
}
