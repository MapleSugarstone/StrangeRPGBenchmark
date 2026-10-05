import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { Menu } from './ui';
import { load } from '../game/state';

export class GameOverScene implements Scene {
  t = 0;
  menu: Menu;
  constructor(private g: Game, private done: (i: number) => void) {
    this.menu = new Menu([
      { label: 'Try the battle again', id: 'retry' },
      { label: 'Load last save', id: 'load', enabled: !!load() },
      { label: 'Return to title', id: 'title' },
    ], 3);
    g.audio.play('sad');
  }

  update() {
    this.t++;
    if (this.t < 40) return;
    const r = this.menu.update(this.g.input, this.g.audio);
    if (r !== 'ok') return;
    const id = this.menu.cur!.id;
    this.g.pop(this);
    if (id === 'retry') { this.done(0); return; }
    if (id === 'load') {
      const st = load();
      if (st) {
        this.g.st = st;
        this.g.stack = [];
        this.g.field = null;
        this.g.loadMap(st.map, [st.x, st.y]);
        this.g.push(this.g.field!);
      }
      this.done(1);
      return;
    }
    this.g.goTitle();
    this.done(2);
  }

  draw(g: Gfx) {
    g.clear('k');
    const a = Math.min(1, this.t / 40);
    g.alpha(a, () => {
      g.textC('The colors run out.', 80, 50, 'g3');
      g.textC('Every ink returns to the Loom.', 80, 60, 'g2');
    });
    if (this.t >= 40) this.menu.draw(g, 26, 84, 108, this.t);
  }
}
