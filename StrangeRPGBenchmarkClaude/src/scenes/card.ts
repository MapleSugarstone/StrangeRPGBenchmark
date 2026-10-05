import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { CHAPTERS } from '../maps';
import { MEMBERS } from '../data/members';
import { wrap, LINE_H } from '../core/font';
import { WHEEL, HUE_COLOR } from '../core/palette';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export class CardScene implements Scene {
  t = 0;
  constructor(private g: Game, private n: number, private done: () => void) {
    g.audio.play('title');
  }

  update() {
    this.t++;
    if (this.t > 70 && (this.g.input.pressed('a') || this.g.input.pressed('b'))) {
      this.g.pop(this);
      this.done();
    }
    if (this.t > 420) { this.g.pop(this); this.done(); }
  }

  draw(g: Gfx) {
    g.clear('k');
    const ch = CHAPTERS[this.n - 1];
    if (!ch) return;
    const a = Math.min(1, this.t / 40);
    g.alpha(a, () => {
      g.textC(`CHAPTER ${ROMAN[this.n - 1]}`, 80, 40, 'g2');
      g.textC(ch.title, 80, 52, 'y3');
      g.textC(ch.stage, 80, 62, 'g2');
      WHEEL.forEach((h, i) => g.rect(56 + i * 8, 74, 6, 2, i < this.n - 1 ? HUE_COLOR[h] : 'ink'));
      const who = ch.recruit ? MEMBERS[ch.recruit] : null;
      if (who) {
        g.sprite(who.sprite, 72, 86, { scale: 2 });
      }
      wrap(ch.blurb, 130).forEach((l, i) => g.textC(l, 80, 110 + i * LINE_H, 'w'));
    });
    if (this.t > 70 && Math.floor(this.t / 20) % 2 === 0) g.textC('Z', 80, 150, 'g1');
  }
}
