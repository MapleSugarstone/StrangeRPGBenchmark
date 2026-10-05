import { Gfx } from '../core/gfx';
import { textWidth, wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { speaker } from '../game/speakers';

const BOX_Y = 134;
const BOX_H = 56;
const LINES = 4;

export class DialogueScene implements Scene {
  overlay = true;
  pages: string[][] = [];
  page = 0;
  shown = 0;
  choiceIdx = 0;
  done = false;
  private wait = 0;

  constructor(
    private game: Game,
    private who: string | null,
    text: string,
    private choices: string[] | null,
    private resolve: (n: number) => void,
    private top = false,
  ) {
    const sp = who ? speaker(who) : undefined;
    const x = sp ? 30 : 8;
    const lines = wrap(text, 190 - x - 6);
    for (let i = 0; i < lines.length; i += LINES) this.pages.push(lines.slice(i, i + LINES));
    if (!this.pages.length) this.pages.push(['']);
    this.wait = 4;
  }

  private pageLen(): number {
    return this.pages[this.page].reduce((s, l) => s + l.length, 0);
  }

  update() {
    const inp = this.game.input;
    if (this.wait > 0) { this.wait--; return; }
    const speed = [0.5, 1, 2, 99][this.game.state?.textSpeed ?? 2] ?? 2;
    const len = this.pageLen();
    if (this.shown < len) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(len, this.shown + speed);
      if (Math.floor(this.shown) !== before && this.game.frame % 3 === 0) this.game.audio.sfx('text');
      if (inp.pressed('ok') || inp.pressed('back')) { this.shown = len; inp.clearAll(); }
      return;
    }
    const lastPage = this.page >= this.pages.length - 1;
    if (lastPage && this.choices) {
      if (inp.pressed('up')) { this.choiceIdx = (this.choiceIdx + this.choices.length - 1) % this.choices.length; this.game.audio.sfx('move'); }
      if (inp.pressed('down')) { this.choiceIdx = (this.choiceIdx + 1) % this.choices.length; this.game.audio.sfx('move'); }
      if (inp.pressed('ok')) { this.game.audio.sfx('ok'); this.close(this.choiceIdx); }
      return;
    }
    if (inp.pressed('ok') || inp.pressed('back')) {
      if (lastPage) this.close(0);
      else { this.page++; this.shown = 0; this.game.audio.sfx('blip'); }
    }
  }

  private close(n: number) {
    if (this.done) return;
    this.done = true;
    this.game.pop(this);
    this.game.input.clearAll();
    this.resolve(n);
  }

  draw(g: Gfx) {
    const y0 = this.top ? 2 : BOX_Y;
    const sp = this.who ? speaker(this.who) : undefined;
    g.box(2, y0, 188, BOX_H, sp?.color ?? 'paper');
    let x = 8;
    if (sp) {
      g.rect(7, y0 + 7, 18, 18, 'dusk');
      g.sprite(sp.sprite, 8, y0 + 8, 16, Math.floor(g.t / 30) % 2);
      x = 30;
      if (sp.name) {
        const w = textWidth(sp.name) + 8;
        const ty = this.top ? y0 + BOX_H - 2 : y0 - 11;
        g.box(6, ty, w, 13, sp.color ?? 'paper');
        g.text(sp.name, 10, ty + 3, sp.color ?? 'gold');
      }
    }
    let left = Math.floor(this.shown);
    const lines = this.pages[this.page];
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i].slice(0, Math.max(0, left));
      left -= lines[i].length;
      g.text(s, x, y0 + 7 + i * 11, 'paper');
    }
    const len = this.pageLen();
    if (this.shown >= len && !(this.choices && this.page >= this.pages.length - 1)) {
      if (Math.floor(g.t / 20) % 2) g.text('\u0005', 180, y0 + BOX_H - 10, 'gold');
    }
    if (this.choices && this.page >= this.pages.length - 1 && this.shown >= len) {
      const w = Math.max(...this.choices.map((c) => textWidth(c))) + 20;
      const h = this.choices.length * 11 + 8;
      const cx = 190 - w, cy = (this.top ? y0 + BOX_H + 2 : y0 - h - 2);
      g.box(cx, cy, w, h, 'gold');
      this.choices.forEach((c, i) => {
        g.text(c, cx + 13, cy + 5 + i * 11, i === this.choiceIdx ? 'gold' : 'paper');
        if (i === this.choiceIdx) g.cursor(cx + 5, cy + 5 + i * 11);
      });
    }
  }
}

export function say(game: Game, who: string | null, text: string, top = false): Promise<void> {
  return new Promise((res) => game.push(new DialogueScene(game, who, text, null, () => res(), top)));
}

export function ask(game: Game, who: string | null, text: string, choices: string[], top = false): Promise<number> {
  return new Promise((res) => game.push(new DialogueScene(game, who, text, choices, res, top)));
}
