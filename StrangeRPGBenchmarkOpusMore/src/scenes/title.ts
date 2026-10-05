import { Gfx, W, H } from '../core/gfx';
import { wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { loadGame, heroSprite as heroFor } from '../game/state';

const PHONE = { t: 'object', seed: 'payphone', a: 'slate', b: 'sky' } as const;

interface Flake { x: number; y: number; v: number; w: number; }

function flakes(n: number): Flake[] {
  return Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.15 + Math.random() * 0.35, w: Math.random() < 0.5 ? 2 : 3 }));
}

function drawFlakes(g: Gfx, fs: Flake[], color = 'plea') {
  for (const f of fs) {
    f.y += f.v;
    f.x += Math.sin((f.y + f.x) / 20) * 0.2;
    if (f.y > H) { f.y = -4; f.x = Math.random() * W; }
    g.rect(f.x, f.y, f.w, 2, color);
    g.rect(f.x, f.y + 2, f.w, 1, 'siltdk');
  }
}

export class TitleScene implements Scene {
  idx = 0;
  t = 0;
  fl = flakes(40);
  constructor(private game: Game, private onNew: (again: boolean) => void, private onContinue: () => void) {
    game.audio.play('title');
  }

  options(): { label: string; ok: boolean; act: () => void }[] {
    const has = !!loadGame();
    const again = !!this.game.meta.carry;
    return [
      { label: 'New call', ok: true, act: () => this.onNew(false) },
      ...(again ? [{ label: 'Again', ok: true, act: () => this.onNew(true) }] : []),
      { label: 'Continue', ok: has, act: () => this.onContinue() },
      { label: `Players: ${this.game.input.twoPlayer ? 2 : 1}`, ok: true, act: () => { this.game.input.twoPlayer = !this.game.input.twoPlayer; } },
      { label: `Sound: ${this.game.audio.muted ? 'off' : 'on'}`, ok: true, act: () => { this.game.audio.toggleMute(); } },
    ];
  }

  update() {
    this.t++;
    const inp = this.game.input;
    const opts = this.options();
    if (inp.pressed('up')) { this.idx = (this.idx + opts.length - 1) % opts.length; this.game.audio.sfx('move'); }
    if (inp.pressed('down')) { this.idx = (this.idx + 1) % opts.length; this.game.audio.sfx('move'); }
    if (inp.pressed('ok')) {
      const o = opts[this.idx];
      if (!o.ok) { this.game.audio.sfx('buzz'); return; }
      this.game.audio.sfx('ok');
      o.act();
    }
  }

  draw(g: Gfx) {
    g.clear('abyss');
    for (let y = 0; y < 100; y++) g.dither(0, y, W, 1, 'dusk', Math.round((y / 100) * 8) / 8);
    g.rect(0, 100, W, H - 100, 'dusk');
    const hour = new Date().getHours();
    const night = hour >= 21 || hour < 5;
    drawFlakes(g, this.fl, night ? 'plea' : 'slate');
    // The logo sits on a dithered plate so the falling slips pass behind it.
    g.dither(20, 28, 152, 62, 'abyss', 0.5);
    g.textBig('PLEASE', 96, 32, 3, 'plea', 'brown', 'cream');
    g.textBig('HOLD', 96, 58, 3, 'paper', 'slate', 'white');
    // The payphone shakes while it rings.
    const ringing = Math.floor(this.t / 8) % 16 < 4;
    g.shadow(158, 112, 14, 0.5);
    g.sprite(PHONE, 150 + (ringing ? (this.t % 4 < 2 ? 1 : -1) : 0), 98, 16, 0);
    const ring = Math.floor(this.t / 8) % 16 < 4;
    if (ring) g.textC('\u0003 ring ring \u0003', 96, 94, 'grey');
    this.options().forEach((o, i) => {
      const y = 110 + i * 11;
      g.text(o.label, 70, y, !o.ok ? 'slate' : i === this.idx ? 'gold' : 'paper');
      if (i === this.idx) g.cursor(60, y);
    });
    const m = this.game.meta;
    const foot = m.endings.includes('someday') && this.t % 900 < 300 ? 'Someday picked up.' : m.delivered ? 'Hello is with you now.' : night ? 'The Asking falls tonight.' : 'Somewhere a phone is ringing.';
    g.textC(foot, 96, 168, 'slate');
    g.textC('(C) 1991 DEAD AIR SOFTWORKS', 96, 181, 'steel');
  }
}

export class WishScene implements Scene {
  t = 0;
  typed = '';
  phase = 0;
  constructor(private game: Game, private done: (wish: string) => void) {
    game.audio.play(null);
    game.input.textHandler = (e) => this.key(e);
  }

  key(e: KeyboardEvent) {
    if (this.phase === 0) { if (this.t > 60) this.phase = 1; return; }
    if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); return; }
    if (e.key === 'Enter') {
      const w = this.typed.trim();
      this.game.input.textHandler = null;
      this.game.audio.sfx('answer');
      this.done(w || 'please');
      return;
    }
    if (e.key.length === 1 && this.typed.length < 48) {
      const ch = e.key;
      if (/^[ -~]$/.test(ch)) { this.typed += ch; this.game.audio.sfx('text'); }
    }
  }

  update() {
    this.t++;
    if (this.t % 90 === 1 && this.phase === 0) this.game.audio.sfx('ring');
    if (this.phase === 0 && this.t > 200) this.phase = 1;
  }

  draw(g: Gfx) {
    g.clear('ink');
    if (this.phase === 0) {
      g.alpha(Math.min(1, this.t / 60), () => {
        wrap('Somewhere above, someone is about to ask for something.', 160).forEach((l, i) => g.textC(l, 96, 80 + i * 11, 'paper'));
      });
      if (this.t > 60) g.textC('(press any key)', 96, 150, 'slate');
      return;
    }
    g.textC('Make a wish.', 96, 50, 'gold');
    g.textC('Type anything. Press Enter.', 96, 64, 'slate');
    g.box(10, 84, 172, 40, 'plea');
    const lines = wrap(this.typed + (Math.floor(this.t / 20) % 2 ? '_' : ' '), 156);
    lines.slice(-2).forEach((l, i) => g.text(l, 18, 92 + i * 12, 'cream'));
    g.textC(`${this.typed.length}/48`, 96, 130, 'dusk');
    g.textC('It will fall for a long time.', 96, 160, 'grey');
  }
}

export class IntroScene implements Scene {
  t = 0;
  page = 0;
  fl = flakes(30);
  pages = [
    'It falls for a long time.',
    'Every prayer nobody answers falls. Past the stars, past the empty rooms of old gods, past the edge of anything with a name.',
    'It comes to rest at the bottom of everything, in a place called the Silt.',
    'Most slips just lie there and whisper. But if a prayer is heavy enough, the Silt grows an answer.',
    'Six years ago, on a night with no wind, the Silt grew one.',
    'It sat up in the Shallows, covered in slips, and said:',
  ];
  constructor(private game: Game, private wish: string, private done: () => void) {
    game.audio.play('intro');
  }
  update() {
    this.t++;
    const inp = this.game.input;
    if (this.t > 40 && (inp.pressed('ok') || inp.pressed('back'))) {
      this.page++;
      this.t = 0;
      this.game.audio.sfx('blip');
      if (this.page >= this.pages.length + 1) this.done();
    }
  }
  draw(g: Gfx) {
    g.clear('ink');
    drawFlakes(g, this.fl, 'siltdk');
    if (this.page < this.pages.length) {
      g.alpha(Math.min(1, this.t / 40), () => {
        wrap(this.pages[this.page], 160).forEach((l, i) => g.textC(l, 96, 76 + i * 12, 'paper'));
      });
      if (this.page === 0) g.alpha(Math.min(1, this.t / 60), () => g.textC(`"${this.wish.slice(0, 30)}${this.wish.length > 30 ? '...' : ''}"`, 96, 120, 'plea'));
    } else {
      g.sprite(heroFor(this.wish), 88, 70, 16, Math.floor(this.t / 30) % 2);
      g.alpha(Math.min(1, this.t / 30), () => g.textBig('Hello?', 96, 100, 2, 'cream'));
    }
  }
}
