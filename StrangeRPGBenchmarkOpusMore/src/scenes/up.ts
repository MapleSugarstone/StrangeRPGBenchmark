import { Gfx, W, H } from '../core/gfx';
import { wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { heroSprite } from '../game/speakers';

// Hello is Returned and rises into the Up, where the player can type to them.
export class UpScene implements Scene {
  t = 0;
  phase = 0;
  typed = '';
  shownWish = 0;
  lines = [
    'You fall upward for a long time.',
    'Past the Catch. Past the haze. Past the top of everything.',
    'It is blank up here. Like a page nobody has written on yet.',
  ];
  page = 0;

  constructor(private game: Game, private done: () => void) {
    game.audio.play(null);
  }

  key(e: KeyboardEvent) {
    if (this.phase !== 2) return;
    if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); return; }
    if (e.key === 'Enter') {
      const s = this.game.state!;
      s.flags.reply = this.typed.trim() || '...';
      this.game.input.textHandler = null;
      this.phase = 3;
      this.t = 0;
      this.game.audio.sfx('answer');
      return;
    }
    if (e.key.length === 1 && /^[ -~]$/.test(e.key) && this.typed.length < 60) { this.typed += e.key; this.game.audio.sfx('text'); }
  }

  update() {
    this.t++;
    const inp = this.game.input;
    const wish = this.game.state!.wish;
    if (this.phase === 0) {
      if (this.t > 50 && inp.pressed('ok')) { this.page++; this.t = 0; if (this.page >= this.lines.length) { this.phase = 1; this.t = 0; this.game.audio.sfx('ring'); } }
    } else if (this.phase === 1) {
      if (this.t % 5 === 0 && this.shownWish < wish.length) { this.shownWish++; this.game.audio.sfx('text'); }
      if (this.shownWish >= wish.length && this.t > wish.length * 5 + 90 && inp.pressed('ok')) {
        this.phase = 2;
        this.t = 0;
        this.game.input.textHandler = (e) => this.key(e);
      }
    } else if (this.phase === 3) {
      if (this.t > 60 && inp.pressed('ok')) { this.page++; this.t = 0; }
      if (this.page >= this.lines.length + 4) {
        this.game.pop(this);
        this.game.input.clearAll();
        this.done();
      }
    }
  }

  draw(g: Gfx) {
    g.clear('paper');
    const s = this.game.state!;
    if (this.phase === 0) {
      g.alpha(Math.min(1, this.t / 40), () => wrap(this.lines[this.page] ?? '', 160).forEach((l, i) => g.textC(l, 96, 86 + i * 11, 'slate')));
      g.sprite(heroSprite(), 88, Math.round(140 - Math.min(40, this.t / 3)), 16, 0);
      return;
    }
    if (this.phase === 1 || this.phase === 2) {
      g.textC('Make a wish.', 96, 40, 'siltdk');
      g.box(10, 56, 172, 40, 'siltdk', 'cream');
      const w = s.wish.slice(0, this.shownWish);
      wrap(w + (this.phase === 1 && Math.floor(this.t / 15) % 2 ? '_' : ''), 156).slice(-2).forEach((l, i) => g.text(l, 18, 64 + i * 12, 'ink'));
      if (this.phase === 1 && this.shownWish >= s.wish.length && this.t > s.wish.length * 5 + 40) {
        g.textC('Somebody typed this, a long time ago.', 96, 108, 'slate');
        g.textC('It was you.', 96, 120, 'rust');
      }
      if (this.phase === 2) {
        g.textC('Hello can hear you.', 96, 110, 'slate');
        g.textC('Say something to Hello. Press Enter.', 96, 122, 'slate');
        g.box(10, 136, 172, 34, 'rust', 'cream');
        wrap(this.typed + (Math.floor(this.t / 20) % 2 ? '_' : ' '), 156).slice(-2).forEach((l, i) => g.text(l, 18, 143 + i * 12, 'ink'));
      }
      return;
    }
    const reply = String(s.flags.reply ?? '...');
    const after = [
      `A slip falls past Hello, going the wrong way, downward. It says: "${reply}"`,
      'Hello catches it.',
      'Hello: "...I hear you. I hear you."',
      'Hello: "You are still asking. So I am not finished."',
    ];
    const idx = this.page - this.lines.length;
    const text = after[Math.max(0, Math.min(after.length - 1, idx))];
    g.alpha(Math.min(1, this.t / 30), () => wrap(text, 160).forEach((l, i) => g.textC(l, 96, 76 + i * 11, 'ink')));
    g.sprite(heroSprite(), 88, 40, 16, Math.floor(this.t / 30) % 2);
    if (idx >= 3) g.alpha(Math.min(1, this.t / 60), () => g.rect(0, 0, W, H * Math.min(1, this.t / 120), 'ink'));
  }
}
