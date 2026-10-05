import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { wrap, LINE_H } from '../core/font';
import { MEMBERS, MEMBER_ORDER } from '../data/members';
import { ENDINGS } from '../maps/endings';

export class EndingScene implements Scene {
  t = 0;
  page = 0;
  pages: string[];
  constructor(private g: Game, private kind: string, private done: () => void) {
    this.pages = ENDINGS[kind] ?? ['The end.'];
    g.audio.play(kind === 'keep' ? 'sad' : 'title');
  }

  update() {
    this.t++;
    if (this.t > 60 && (this.g.input.pressed('a') || this.g.input.pressed('b'))) {
      this.page++;
      this.t = 0;
      if (this.page >= this.pages.length) {
        this.g.pop(this);
        this.done();
      }
    }
  }

  draw(g: Gfx) {
    g.clear('k');
    const text = this.pages[this.page];
    if (!text) return;
    const a = Math.min(1, this.t / 30);
    const grey = this.kind === 'keep';
    g.alpha(a, () => {
      const lines = wrap(text, 140);
      const y0 = 80 - (lines.length * (LINE_H + 1)) / 2;
      lines.forEach((l, i) => g.textC(l, 80, y0 + i * (LINE_H + 1), 'w'));
      const ids = MEMBER_ORDER.filter(id => this.g.st.members[id]);
      ids.forEach((id, i) => {
        const bob = Math.round(Math.sin((this.g.frame + i * 15) / 20));
        g.sprite(MEMBERS[id].sprite, 80 - ids.length * 6 + i * 12, 136 + bob, { grey: grey && id !== 'wick' });
      });
    });
    if (this.t > 60 && Math.floor(this.t / 20) % 2 === 0) g.text('`', 150, 150, 'g1');
  }
}
