import { Gfx, W, H } from '../core/gfx';
import { textWidth } from '../core/font';
import type { Game, Scene } from '../game/game';

// The console boot and the developer logo. Shown once per page load.
export class SplashScene implements Scene {
  phase: 'power' | 'boot' | 'studio' = 'power';
  t = 0;
  // About one boot in thirteen comes up wrong.
  wrong = Math.random() < 1 / 13 || new Date().getHours() === 3;
  noise: number[] = Array.from({ length: 64 }, () => Math.random());

  constructor(private game: Game, private done: () => void) {
    game.audio.play(null);
    if (game.audio.ctx) this.phase = 'boot';
  }

  update() {
    this.t++;
    const inp = this.game.input;
    if (this.phase === 'power') {
      if (inp.anyKey && this.t > 10) { this.game.audio.unlock(); this.phase = 'boot'; this.t = 0; }
      return;
    }
    if (this.phase === 'boot') {
      if (this.t === 62) this.game.audio.sfx(this.wrong ? 'bootwrong' : 'boot');
      if (this.t > 170 || (this.t > 30 && inp.pressed('ok'))) { this.phase = 'studio'; this.t = 0; }
      return;
    }
    if (this.t === 4) this.game.audio.sfx('deadair');
    if (this.t > 150 || (this.t > 20 && inp.pressed('ok'))) { this.game.input.clearAll(); this.done(); }
  }

  draw(g: Gfx) {
    g.clear('ink');
    if (this.phase === 'power') this.drawPower(g);
    else if (this.phase === 'boot') this.drawBoot(g);
    else this.drawStudio(g);
  }

  private drawPower(g: Gfx) {
    // The front of the console, with its power light off.
    g.rect(46, 70, 100, 40, 'steel');
    g.rect(46, 70, 100, 1, 'slate');
    g.rect(46, 109, 100, 1, 'abyss');
    g.rect(70, 74, 52, 6, 'abyss');
    g.rect(72, 76, 48, 2, 'ink');
    g.rect(56, 96, 14, 5, 'ink');
    g.rect(57, 97, 6, 3, 'grey');
    g.text('POWER', 54, 88, 'grey');
    g.rect(132, 98, 3, 2, Math.floor(this.t / 50) % 7 === 0 ? 'maroon' : 'abyss');
    g.text('AUGUR 8', 108, 101, 'slate');
    if (Math.floor(this.t / 30) % 2) g.textC('Press any button', 96, 130, 'grey');
  }

  private drawBoot(g: Gfx) {
    const t = this.t;
    // The tube warms up: a line, then the picture opens.
    if (t < 16) {
      const w = Math.min(W, (t / 8) * W);
      if (t < 8) g.rect(96 - w / 2, 95, w, 2, 'white');
      else {
        const h = ((t - 8) / 8) * H;
        g.rect(0, 96 - h / 2, W, h, 'white');
        g.fade((t - 8) / 8);
      }
      return;
    }
    const y = Math.min(66, -30 + (t - 16) * 2.4);
    this.logo(g, y);
    if (t >= 62 && t < 70) g.alpha((70 - t) / 8, () => g.rect(0, 0, W, H, 'white'));
    if (t > 76) {
      const line = this.wrong && t > 110 && t < 118 ? 'IS ANYONE THERE' : 'LICENSED BY TESSALY ELECTRIC';
      g.textC(line, 96, 112, this.wrong ? 'rose' : 'grey');
    }
    if (t > 92) g.textC('CART PH-412', 96, 168, 'slate');
    if (t > 150) g.fade((t - 150) / 20);
  }

  private logo(g: Gfx, y: number) {
    const top = this.wrong ? 'grey' : 'white';
    const bottom = this.wrong ? 'slate' : 'sky';
    const word = 'AUGUR';
    const block = 4;
    const cx = 86;
    for (const [c, y0, y1] of [[top, y, y + 14], [bottom, y + 14, y + 40]] as const) {
      g.ctx.save();
      g.ctx.beginPath();
      g.ctx.rect(0, y0, W, y1 - y0);
      g.ctx.clip();
      g.textBig(word, cx, y, block, c, 'navy', this.wrong ? 'ash' : 'white');
      g.ctx.restore();
    }
    // The model number in a badge.
    const bx = cx + (textWidth(word) * block) / 2 + 4;
    g.rect(bx, y + 8, 16, 20, this.wrong ? 'maroon' : 'gold');
    g.rect(bx, y + 8, 16, 1, 'cream');
    g.textBig('8', bx + 8, y + 11, 2, 'ink');
    // On a wrong boot a band of the logo slips sideways.
    if (this.wrong && Math.floor(this.t / 6) % 5 === 0) {
      const by = Math.round(y + 6 + this.noise[this.t % 64] * 20);
      g.ctx.drawImage(g.canvas, 0, by, W, 3, 4, by, W, 3);
    }
  }

  private drawStudio(g: Gfx) {
    const t = this.t;
    // A broadcast trace: static, one pulse, then a flat line.
    const cy = 74;
    for (let x = 16; x < 176; x++) {
      let dy = 0;
      if (t < 30) dy = Math.round((this.noise[(x * 7 + t) % 64] - 0.5) * (30 - t) * 0.6);
      else if (x > 84 && x < 108 && t < 70) {
        const u = (x - 84) / 24;
        dy = Math.round(Math.sin(u * Math.PI * 3) * 12 * Math.sin(u * Math.PI) * Math.max(0, (70 - t) / 40));
      }
      g.rect(x, cy + dy, 1, 1, x < 16 + (t - 10) * 6 || t > 30 ? 'mint' : 'pine');
    }
    if (t < 30) for (let i = 0; i < 40; i++) g.rect(Math.floor(this.noise[(i * 13 + t * 5) % 64] * W), Math.floor(this.noise[(i * 29 + t * 3) % 64] * H), 1, 1, 'grey');
    if (t > 36) g.alpha(Math.min(1, (t - 36) / 16), () => {
      g.textBig('DEAD AIR', 96, 92, 3, 'paper', 'dusk', 'white');
      g.textC('S O F T W O R K S', 96, 120, 'grey');
    });
    if (t > 80) g.alpha(Math.min(1, (t - 80) / 20), () => g.textC('presents', 96, 146, 'slate'));
    if (t > 130) g.fade((t - 130) / 20);
  }
}
