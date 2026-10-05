import { Gfx } from '../core/gfx';
import { wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { CHAPTERS } from '../data/chapters';
import { slipLevel, slipText } from '../game/state';

export class CardScene implements Scene {
  t = 0;
  constructor(private game: Game, private n: number, private resolve: () => void) {
    game.audio.play('card');
  }
  update() {
    this.t++;
    if (this.t > 70 && (this.game.input.pressed('ok') || this.game.input.pressed('back'))) {
      this.game.pop(this);
      this.game.input.clearAll();
      this.resolve();
    }
  }
  draw(g: Gfx) {
    const c = CHAPTERS[this.n - 1];
    g.clear('ink');
    const a = Math.min(1, this.t / 40);
    g.alpha(a, () => {
      g.textC(`CHAPTER ${this.n}`, 96, 44, 'grey');
      g.textC(c.title, 96, 60, 'gold');
      g.textC(c.stage, 96, 76, 'slate');
      wrap(c.line, 160).forEach((l, i) => g.textC(l, 96, 100 + i * 11, 'paper'));
    });
    if (this.t > 50) {
      const s = this.game.state!;
      g.alpha(Math.min(1, (this.t - 50) / 30), () => {
        g.textC('Your slip reads:', 96, 140, 'slate');
        wrap(slipText(s.wish, slipLevel(s)), 170).slice(0, 3).forEach((l, i) => g.textC(l, 96, 152 + i * 10, 'plea'));
      });
    }
    if (this.t > 70 && Math.floor(this.t / 20) % 2) g.text('\u0005', 180, 180, 'gold');
  }
}
