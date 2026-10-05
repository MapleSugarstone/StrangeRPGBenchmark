import { Gfx } from '../core/gfx';
import type { Game, Scene } from '../game/game';

export class GameOverScene implements Scene {
  t = 0;
  idx = 0;
  constructor(private game: Game, private resolve: (n: number) => void) {
    game.audio.play(null);
    game.audio.sfx('ko');
  }
  update() {
    this.t++;
    const inp = this.game.input;
    if (this.t < 40) return;
    const n = this.opts().length;
    if (inp.pressed('up')) { this.idx = (this.idx + n - 1) % n; this.game.audio.sfx('move'); }
    if (inp.pressed('down')) { this.idx = (this.idx + 1) % n; this.game.audio.sfx('move'); }
    if (inp.pressed('ok')) {
      this.game.audio.sfx('ok');
      this.game.pop(this);
      this.game.input.clearAll();
      this.resolve(this.idx);
    }
  }
  // A third choice retries with foes set to Gentle, for players who keep losing the same fight.
  opts(): string[] {
    const o = ['Try that fight again', 'Go back to the last payphone'];
    if (!this.game.state?.flags.gentle) o.push('Try again, gently');
    return o;
  }

  draw(g: Gfx) {
    g.clear('ink');
    g.alpha(Math.min(1, this.t / 40), () => {
      g.textC('The line goes quiet.', 96, 70, 'paper');
      g.textC('Somewhere, someone is still holding.', 96, 84, 'grey');
      const opts = this.opts();
      opts.forEach((o, i) => {
        g.text(o, 40, 120 + i * 14, i === this.idx ? 'gold' : 'paper');
        if (i === this.idx) g.cursor(30, 120 + i * 14);
      });
    });
  }
}
