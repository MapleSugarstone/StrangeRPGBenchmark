// Small games played inside the story. Each returns a score, and the map script decides the reward.
import { Gfx, W, H } from '../core/gfx';
import { wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import type { SpriteSpec } from '../core/sprites';
import { heroSprite } from '../game/speakers';

export type MiniKind = 'sort' | 'chairs' | 'switch' | 'echo' | 'fish';
export interface MiniResult { score: number; best: number; catches?: string[]; }

const INTRO: Record<MiniKind, { title: string; rules: string }> = {
  sort: { title: 'Morning Sort', rules: 'Slips fall from the hopper. Catch them in the tray with left and right. Gold slips are heavy and worth more. Let the plea-stone fall: catching stone costs a life.' },
  chairs: { title: 'Musical Chairs', rules: 'Walk the circle while the hold music plays. When it stops, press Z to take the nearest empty chair. Press too early and you are out.' },
  switch: { title: 'Switchboard Rush', rules: 'A lit jack is a call. Press its direction to patch it through before the lamp burns out. Red lamps are wrong numbers: press X to drop them.' },
  echo: { title: 'Echo', rules: 'Again rings the bells. Ring them back in the same order with the arrows. When Again says "backwards", ring them back in reverse.' },
  fish: { title: 'Bottle Mail', rules: 'Press Z to cast. When the float dips, press Z to hook. Then hold Z to keep the bottle inside the net bar until it is reeled in.' },
};

abstract class Mini implements Scene {
  t = 0;
  phase: 'intro' | 'play' | 'result' = 'intro';
  score = 0;
  constructor(protected game: Game, protected kind: MiniKind, protected best: number, private done: (r: MiniResult) => void) {
    game.input.clearAll();
    game.audio.play(kind === 'chairs' ? null : kind === 'fish' ? 'sea' : 'minigame');
  }

  get inp() { return this.game.input; }
  sfx(id: string) { this.game.audio.sfx(id); }

  update() {
    this.t++;
    if (this.phase === 'intro') {
      if (this.t > 20 && this.inp.pressed('ok')) { this.phase = 'play'; this.t = 0; this.start(); }
      return;
    }
    if (this.phase === 'play') { this.tick(); return; }
    if (this.t > 40 && (this.inp.pressed('ok') || this.inp.pressed('back'))) {
      this.game.pop(this);
      this.game.input.clearAll();
      this.done(this.result());
    }
  }

  finish() {
    this.phase = 'result';
    this.t = 0;
    this.sfx(this.score > this.best ? 'level' : 'ok');
  }

  result(): MiniResult { return { score: this.score, best: Math.max(this.best, this.score) }; }

  draw(g: Gfx) {
    this.paint(g);
    if (this.phase === 'intro') {
      const info = INTRO[this.kind];
      g.fade(0.5);
      g.box(12, 40, 168, 112, 'gold');
      g.textC(info.title, 96, 48, 'gold');
      wrap(info.rules, 150).forEach((l, i) => g.text(l, 21, 64 + i * 10, 'cream'));
      if (this.best > 0) g.textC(`Best: ${this.best}`, 96, 128, 'grey');
      if (Math.floor(this.t / 20) % 2) g.textC('Press Z to start', 96, 139, 'paper');
    } else if (this.phase === 'result') {
      g.fade(0.5);
      g.box(36, 64, 120, 60, 'gold');
      g.textC(this.resultLine(), 96, 74, 'gold');
      g.textC(`Score: ${this.score}`, 96, 90, 'paper');
      g.textC(this.score > this.best ? 'A new best!' : `Best: ${Math.max(this.best, this.score)}`, 96, 102, this.score > this.best ? 'mint' : 'grey');
    }
  }

  resultLine(): string { return 'Time.'; }
  abstract start(): void;
  abstract tick(): void;
  abstract paint(g: Gfx): void;
}

// ---------------------------------------------------------------- sorting slips at the Press
interface Drop { x: number; y: number; v: number; kind: 0 | 1 | 2; }

class SortGame extends Mini {
  tray = 88;
  drops: Drop[] = [];
  lives = 3;
  combo = 0;
  time = 40 * 60;
  pops: { x: number; y: number; t: number; text: string; c: string }[] = [];

  start() { this.drops = []; }

  tick() {
    this.time--;
    const sp = this.inp.held('run') ? 3.2 : 2.2;
    if (this.inp.held('left')) this.tray = Math.max(8, this.tray - sp);
    if (this.inp.held('right')) this.tray = Math.min(W - 24, this.tray + sp);
    const rate = 34 - Math.min(22, Math.floor((40 * 60 - this.time) / 110));
    if (this.t % rate === 0) {
      const r = Math.random();
      const kind = r < 0.12 ? 1 : r < 0.36 ? 2 : 0;
      this.drops.push({ x: 10 + Math.random() * (W - 28), y: 18, v: (kind === 1 ? 1.4 : 0.8) + Math.random() * 0.5 + (40 * 60 - this.time) / 4000, kind });
    }
    for (const d of this.drops) d.y += d.v;
    for (const d of this.drops) {
      if (d.y > 160 && d.y < 168 && d.x + 6 > this.tray && d.x < this.tray + 16) {
        d.y = 999;
        if (d.kind === 2) {
          this.lives--; this.combo = 0; this.sfx('hit');
          this.pops.push({ x: d.x, y: 150, t: 40, text: 'stone!', c: 'red' });
        } else {
          this.combo++;
          const pts = (d.kind === 1 ? 3 : 1) + Math.floor(this.combo / 10);
          this.score += pts;
          this.sfx(d.kind === 1 ? 'coin' : 'blip');
          this.pops.push({ x: d.x, y: 150, t: 30, text: '+' + pts, c: d.kind === 1 ? 'gold' : 'paper' });
        }
      } else if (d.y >= 176 && d.y < 999 && d.kind !== 2) {
        this.combo = 0;
        d.y = 999;
      }
    }
    this.drops = this.drops.filter((d) => d.y < 180);
    for (const p of this.pops) { p.t--; p.y -= 0.4; }
    this.pops = this.pops.filter((p) => p.t > 0);
    if (this.lives <= 0 || this.time <= 0) this.finish();
  }

  resultLine() { return this.lives <= 0 ? 'Too much stone.' : 'The hopper is empty.'; }

  paint(g: Gfx) {
    g.clear('peat');
    for (let y = 0; y < 18; y++) g.dither(0, y, W, 1, 'brown', 1 - y / 18);
    g.rect(0, 14, W, 3, 'gold');
    for (let x = 4; x < W; x += 12) g.rect(x, 12, 6, 2, 'brown');
    g.rect(0, 170, W, 22, 'brown');
    g.dither(0, 170, W, 2, 'ink', 0.5);
    for (const d of this.drops) {
      if (d.kind === 2) { g.rect(d.x, d.y, 6, 5, 'grey'); g.rect(d.x + 1, d.y, 4, 1, 'ash'); g.rect(d.x, d.y + 4, 6, 1, 'slate'); }
      else { g.rect(d.x, d.y, 6, 4, d.kind === 1 ? 'gold' : 'paper'); g.rect(d.x + 3, d.y, 1, 4, d.kind === 1 ? 'orange' : 'silt'); }
    }
    const x = Math.round(this.tray);
    g.rect(x, 164, 16, 4, 'tan');
    g.rect(x, 162, 1, 2, 'tan'); g.rect(x + 15, 162, 1, 2, 'tan');
    g.rect(x + 1, 168, 14, 1, 'ink');
    for (const p of this.pops) g.textC(p.text, p.x + 3, p.y, p.c, 'ink');
    g.text(`${this.score}`, 4, 176, 'cream');
    g.textR(`${Math.ceil(this.time / 60)}s`, 188, 176, 'cream');
    for (let i = 0; i < this.lives; i++) g.rect(80 + i * 10, 178, 6, 5, 'mint');
    if (this.combo >= 10) g.textC(`x${1 + Math.floor(this.combo / 10)}`, 96, 30, 'gold');
  }
}

// ---------------------------------------------------------------- musical chairs in the Waiting Room
interface Sitter { name: string; spec: SpriteSpec; seat: number; react: number; out: boolean; }

class ChairsGame extends Mini {
  chairs = 5;
  ang = 0;
  playing = true;
  stopAt = 0;
  stopT = 0;
  players: Sitter[] = [];
  me: Sitter = { name: 'you', spec: heroSprite(), seat: -1, react: 0, out: false };
  round = 1;
  msg = '';
  msgT = 0;
  lost = false;

  start() {
    const people: [string, SpriteSpec][] = [
      ['Seventeen', { t: 'person', seed: 'seventeen', a: 'tan', b: 'olive' }],
      ['A knitter', { t: 'person', seed: 'knit1', a: 'grey', b: 'rose' }],
      ['The other knitter', { t: 'person', seed: 'knit2', a: 'grey', b: 'teal' }],
      ['The patient', { t: 'person', seed: 'patient', a: 'ice', b: 'sky' }],
      ['A ghost', { t: 'ghost', seed: 'rightback', a: 'white', b: 'lilac' }],
    ];
    this.players = people.map(([name, spec]) => ({ name, spec, seat: -1, react: 0, out: false }));
    this.newRound();
  }

  newRound() {
    this.playing = true;
    this.stopAt = 120 + Math.floor(Math.random() * 240);
    this.stopT = 0;
    for (const p of [...this.players, this.me]) p.seat = -1;
    this.game.audio.play('hold');
  }

  tick() {
    if (this.msgT > 0) this.msgT--;
    const all = [...this.players.filter((p) => !p.out), this.me];
    if (this.playing) {
      this.ang += 0.012;
      if (this.inp.pressed('ok')) { this.lost = true; this.msg = 'You sat down while the music played.'; this.end(); return; }
      if (this.t >= this.stopAt) {
        this.playing = false;
        this.stopT = 0;
        this.game.audio.play(null);
        this.sfx('static');
        for (const p of this.players) p.react = 8 + Math.floor(Math.random() * Math.max(6, 34 - this.round * 5));
      }
      return;
    }
    this.stopT++;
    const taken = new Set(all.filter((p) => p.seat >= 0).map((p) => p.seat));
    const TAU = Math.PI * 2;
    const nearest = (i: number) => {
      const a = (i / all.length) * TAU + this.ang;
      let best = -1, bd = 99;
      for (let c = 0; c < this.chairs; c++) {
        if (taken.has(c)) continue;
        const d = Math.abs((((a - (c / this.chairs) * TAU) % TAU) + TAU * 1.5) % TAU - Math.PI);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    };
    if (this.me.seat < 0 && this.inp.pressed('ok')) {
      const c = nearest(all.length - 1);
      if (c >= 0) { this.me.seat = c; taken.add(c); this.sfx('ok'); }
    }
    this.players.filter((p) => !p.out).forEach((p, i) => {
      if (p.seat < 0 && this.stopT >= p.react) {
        const c = nearest(i);
        if (c >= 0) { p.seat = c; taken.add(c); this.sfx('step'); }
      }
    });
    if (taken.size >= this.chairs || this.stopT > 150) {
      if (this.me.seat < 0) { this.lost = true; this.msg = 'Every chair was taken.'; this.end(); return; }
      const loser = this.players.find((p) => !p.out && p.seat < 0);
      if (loser) { loser.out = true; this.msg = `${loser.name} is out.`; this.msgT = 90; }
      this.score = this.round;
      this.round++;
      this.chairs--;
      if (this.chairs <= 0 || this.players.every((p) => p.out)) { this.score = this.round; this.msg = 'You have the last chair.'; this.end(); return; }
      this.t = 0;
      this.newRound();
    }
  }

  end() { this.game.audio.play(null); this.finish(); }

  resultLine() { return this.lost ? this.msg : 'The last chair is yours.'; }

  paint(g: Gfx) {
    g.clear('violet');
    for (let y = 0; y < H; y += 8) for (let x = ((y >> 3) & 1) * 8; x < W; x += 16) g.rect(x, y, 8, 8, 'lilac');
    g.dither(0, 0, W, H, 'plum', 0.25);
    const cx = 96, cy = 100, r = 46;
    for (let c = 0; c < this.chairs; c++) {
      const a = (c / this.chairs) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * 26) - 4, y = Math.round(cy + Math.sin(a) * 22) - 4;
      g.shadow(x + 4, y + 7, 8, 0.5);
      g.rect(x, y, 8, 6, 'plum'); g.rect(x, y - 3, 8, 3, 'violet'); g.rect(x, y + 6, 1, 2, 'plum'); g.rect(x + 7, y + 6, 1, 2, 'plum');
    }
    const all = [...this.players.filter((p) => !p.out), this.me];
    all.forEach((p, i) => {
      let x: number, y: number;
      if (p.seat >= 0) {
        const a = (p.seat / this.chairs) * Math.PI * 2;
        x = cx + Math.cos(a) * 26 - 4; y = cy + Math.sin(a) * 22 - 10;
      } else {
        const a = (i / all.length) * Math.PI * 2 + this.ang;
        x = cx + Math.cos(a) * r - 4; y = cy + Math.sin(a) * (r * 0.8) - 6;
      }
      g.shadow(x + 4, y + 7, 8, 0.4);
      g.sprite(p.spec, x, y, 8, this.playing ? Math.floor(this.t / 8) % 2 : 0);
      if (p === this.me) g.text('\u0005', x + 2, y - 9, 'gold');
    });
    if (this.playing) for (let k = 0; k < 3; k++) {
      const yy = 30 - ((this.t + k * 20) % 60) / 3;
      g.text('\u0003', 70 + k * 24 + Math.round(Math.sin((this.t + k * 30) / 10) * 3), yy, 'cream');
    } else g.textC('...', 96, 24, 'paper');
    g.textC(`Round ${this.round}   Chairs ${this.chairs}`, 96, 176, 'cream');
    if (this.msgT > 0) g.textC(this.msg, 96, 40, 'gold', 'ink');
  }
}

// ---------------------------------------------------------------- switchboard rush in the Cloister
interface Call { dir: number; t: number; life: number; wrong: boolean; }
const DIRS = ['up', 'right', 'down', 'left'] as const;
const JACK: [number, number][] = [[96, 50], [140, 92], [96, 134], [52, 92]];

class SwitchGame extends Mini {
  calls: (Call | null)[] = [null, null, null, null];
  misses = 0;
  time = 45 * 60;
  flashes: { dir: number; t: number; good: boolean }[] = [];

  start() { this.calls = [null, null, null, null]; }

  tick() {
    this.time--;
    const elapsed = 45 * 60 - this.time;
    const rate = Math.max(22, 70 - Math.floor(elapsed / 60));
    if (this.t % rate === 0) {
      const free = [0, 1, 2, 3].filter((d) => !this.calls[d]);
      if (free.length) {
        const d = free[Math.floor(Math.random() * free.length)];
        const life = Math.max(55, 140 - elapsed / 30);
        this.calls[d] = { dir: d, t: 0, life, wrong: Math.random() < 0.18 };
        this.sfx('dial');
      }
    }
    for (let d = 0; d < 4; d++) {
      const c = this.calls[d];
      if (!c) continue;
      c.t++;
      if (this.inp.pressed(DIRS[d])) {
        if (c.wrong) { this.misses++; this.sfx('wrong'); this.flashes.push({ dir: d, t: 20, good: false }); }
        else { this.score += 1 + (c.t < c.life / 3 ? 1 : 0); this.sfx('link'); this.flashes.push({ dir: d, t: 20, good: true }); }
        this.calls[d] = null;
        continue;
      }
      if (c.t >= c.life) {
        if (!c.wrong) { this.misses++; this.sfx('buzz'); this.flashes.push({ dir: d, t: 20, good: false }); }
        this.calls[d] = null;
      }
    }
    if (this.inp.pressed('back')) {
      const wrong = this.calls.findIndex((c) => c?.wrong);
      if (wrong >= 0) { this.calls[wrong] = null; this.score++; this.sfx('hangup'); this.flashes.push({ dir: wrong, t: 20, good: true }); }
    }
    for (const f of this.flashes) f.t--;
    this.flashes = this.flashes.filter((f) => f.t > 0);
    if (this.misses >= 4 || this.time <= 0) this.finish();
  }

  resultLine() { return this.misses >= 4 ? 'The board went dark.' : 'Shift over.'; }

  paint(g: Gfx) {
    g.clear('peat');
    g.dither(0, 0, W, H, 'brown', 0.25);
    g.rect(28, 24, 136, 136, 'brown');
    g.border(28, 24, 136, 136, 'tan');
    for (let y = 30; y < 156; y += 7) for (let x = 34; x < 160; x += 7) g.rect(x, y, 2, 2, 'peat');
    for (let d = 0; d < 4; d++) {
      const [x, y] = JACK[d];
      const c = this.calls[d];
      g.circle(x, y, 9, 'ink');
      g.rect(x - 2, y - 2, 5, 5, 'ink');
      if (c) {
        const left = 1 - c.t / c.life;
        const lamp = c.wrong ? 'red' : left < 0.3 && Math.floor(this.t / 4) % 2 ? 'cream' : 'gold';
        for (let k = 0; k < 6; k++) g.circle(x, y, 9 + k * 0.5, lamp);
        g.bar(x - 10, y + 13, 21, 2, left, c.wrong ? 'red' : 'mint', 'ink');
      }
      const f = this.flashes.find((q) => q.dir === d);
      if (f) g.circle(x, y, 12 + (20 - f.t) / 2, f.good ? 'mint' : 'red');
    }
    g.text('\u0006', 94, 36, 'tan'); g.text('\u0005', 94, 145, 'tan');
    g.text('>', 156, 88, 'tan'); g.text('<', 33, 88, 'tan');
    g.text(`Patched ${this.score}`, 6, 4, 'cream');
    g.textR(`${Math.ceil(this.time / 60)}s`, 188, 4, 'cream');
    for (let i = 0; i < 4 - this.misses; i++) g.rect(6 + i * 8, 176, 5, 5, 'gold');
    g.textR('X drops a red line', 188, 176, 'grey');
  }
}

// ---------------------------------------------------------------- Again's echo bells
class EchoGame extends Mini {
  seq: number[] = [];
  step = 0;
  showing = true;
  showT = 0;
  backwards = false;
  lit = -1;
  litT = 0;
  over = false;

  start() { this.seq = [this.rand(), this.rand()]; this.beginShow(); }
  rand() { return Math.floor(Math.random() * 4); }

  beginShow() {
    this.showing = true;
    this.showT = 0;
    this.step = 0;
    this.backwards = this.seq.length >= 5 && Math.random() < 0.35;
  }

  bell(d: number) {
    this.lit = d;
    this.litT = 16;
    this.sfx(['blip', 'ok', 'item', 'clean'][d]);
  }

  tick() {
    if (this.litT > 0) this.litT--;
    if (this.showing) {
      this.showT++;
      const gap = Math.max(16, 30 - this.seq.length * 2);
      if (this.showT % gap === 0) {
        const i = this.showT / gap - 1;
        if (i < this.seq.length) this.bell(this.seq[i]);
        else if (i > this.seq.length) { this.showing = false; this.step = 0; }
      }
      return;
    }
    for (let d = 0; d < 4; d++) {
      if (!this.inp.pressed(DIRS[d])) continue;
      this.bell(d);
      const want = this.backwards ? this.seq[this.seq.length - 1 - this.step] : this.seq[this.step];
      if (d !== want) { this.sfx('wrong'); this.score = this.seq.length - 1; this.over = true; this.finish(); return; }
      this.step++;
      if (this.step >= this.seq.length) {
        this.score = this.seq.length;
        this.seq.push(this.rand());
        this.beginShow();
        this.showT = -30;
      }
    }
  }

  resultLine() { return this.over ? 'Again giggles. "Again?"' : 'Done.'; }

  paint(g: Gfx) {
    g.clear('dusk');
    for (let y = 0; y < 100; y++) g.dither(0, y, W, 1, 'plum', y / 100);
    g.rect(0, 100, W, 92, 'plum');
    const cols = ['pink', 'sky', 'gold', 'mint'];
    for (let d = 0; d < 4; d++) {
      const [x, y] = JACK[d];
      const on = this.lit === d && this.litT > 0;
      const swing = on ? Math.round(Math.sin(this.litT) * 2) : 0;
      g.rect(x - 1, y - 16, 2, 6, 'tan');
      g.rect(x - 7 + swing, y - 10, 14, 12, on ? 'cream' : cols[d]);
      g.rect(x - 8 + swing, y + 2, 16, 2, on ? 'white' : cols[d]);
      g.rect(x - 1 + swing, y + 4, 3, 3, 'ink');
      if (on) g.circle(x, y - 3, 14, cols[d]);
    }
    g.sprite({ t: 'child', seed: 'again', a: 'pink', b: 'sky' }, 88, 84, 16, this.showing ? Math.floor(this.t / 10) % 2 : 0);
    if (this.showing) g.textC(this.backwards ? 'Listen. Then backwards!' : 'Listen...', 96, 166, this.backwards ? 'gold' : 'cream');
    else g.textC(`Your turn: ${this.step}/${this.seq.length}`, 96, 166, 'paper');
    g.text(`Length ${this.seq.length}`, 6, 4, 'cream');
  }
}

// ---------------------------------------------------------------- bottle fishing on the Lonesome Sea
const CATCH_TABLE: [string, number][] = [['bottle', 50], ['boot', 14], ['page', 10], ['shell', 14], ['nothing', 12]];

class FishGame extends Mini {
  casts = 5;
  state: 'ready' | 'wait' | 'bite' | 'reel' | 'show' = 'ready';
  waitT = 0;
  biteT = 0;
  zone = 40;
  zoneV = 0;
  fish = 50;
  fishV = 0;
  prog = 0.3;
  catches: string[] = [];
  last = '';
  stateT = 0;
  wave = 0;

  start() { this.state = 'ready'; }

  pick(): string {
    const total = CATCH_TABLE.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of CATCH_TABLE) { r -= w; if (r <= 0) return k; }
    return 'bottle';
  }

  tick() {
    this.stateT++;
    this.wave += 0.05;
    if (this.state === 'ready') {
      if (this.casts <= 0) { this.score = this.catches.filter((c) => c !== 'nothing').length; this.finish(); return; }
      if (this.inp.pressed('ok')) { this.state = 'wait'; this.stateT = 0; this.waitT = 80 + Math.floor(Math.random() * 160); this.sfx('move'); }
    } else if (this.state === 'wait') {
      if (this.inp.pressed('ok')) { this.state = 'ready'; this.casts--; this.last = 'Too early. The float jumps.'; return; }
      if (this.stateT >= this.waitT) { this.state = 'bite'; this.stateT = 0; this.sfx('blip'); }
    } else if (this.state === 'bite') {
      if (this.inp.pressed('ok')) { this.state = 'reel'; this.stateT = 0; this.prog = 0.3; this.fish = 50; this.zone = 40; this.zoneV = 0; this.sfx('ok'); return; }
      if (this.stateT > 26) { this.state = 'ready'; this.casts--; this.last = 'It got away.'; }
    } else if (this.state === 'reel') {
      this.zoneV += this.inp.held('ok') ? 0.32 : -0.28;
      this.zoneV = Math.max(-2.4, Math.min(2.4, this.zoneV));
      this.zone = Math.max(0, Math.min(76, this.zone + this.zoneV));
      if (this.zone <= 0 || this.zone >= 76) this.zoneV *= -0.3;
      if (Math.random() < 0.03) this.fishV = (Math.random() - 0.5) * 3.2;
      this.fish = Math.max(0, Math.min(94, this.fish + this.fishV));
      if (this.fish <= 0 || this.fish >= 94) this.fishV *= -1;
      const inside = this.fish >= this.zone && this.fish <= this.zone + 24;
      this.prog += inside ? 0.006 : -0.004;
      if (this.prog >= 1) {
        const k = this.pick();
        this.catches.push(k);
        this.last = k === 'nothing' ? 'The line comes up with nothing on it.' : `You reel in ${k === 'boot' ? 'a boot' : k === 'shell' ? 'a shell that hums' : k === 'page' ? 'a soaked page' : 'a bottle with a letter in it'}.`;
        this.sfx(k === 'page' ? 'gold' : 'item');
        this.state = 'show'; this.stateT = 0; this.casts--;
      } else if (this.prog <= 0) { this.last = 'The line goes slack.'; this.state = 'ready'; this.casts--; this.sfx('miss'); }
    } else if (this.state === 'show') {
      if (this.stateT > 30 && this.inp.pressed('ok')) { this.state = 'ready'; this.stateT = 0; }
    }
  }

  result(): MiniResult { return { score: this.score, best: Math.max(this.best, this.score), catches: this.catches.filter((c) => c !== 'nothing') }; }
  resultLine() { return 'Out of bait.'; }

  paint(g: Gfx) {
    for (let y = 0; y < 80; y++) g.dither(0, y, W, 1, y < 40 ? 'sky' : 'ice', 1);
    for (let y = 0; y < 80; y++) g.dither(0, y, W, 1, 'blue', Math.max(0, 0.5 - y / 120));
    g.rect(0, 80, W, 112, 'sea');
    for (let y = 80; y < H; y++) g.dither(0, y, W, 1, 'ocean', Math.min(1, (y - 80) / 90));
    for (let i = 0; i < 24; i++) {
      const x = (i * 37 + Math.floor(this.wave * 10 * (1 + (i % 3)))) % W;
      g.rect(x, 82 + (i % 6) * 14, 4, 1, 'ice');
    }
    g.rect(10, 74, 50, 8, 'brown'); g.rect(10, 74, 50, 1, 'tan');
    g.sprite(heroSprite(), 30, 64, 8, 0);
    const fx = 130, fy = 82 + (this.state === 'bite' ? 3 : Math.round(Math.sin(this.wave * 3)));
    if (this.state !== 'ready') {
      g.rect(36, 62, 1, 1, 'tan');
      for (let k = 0; k <= 20; k++) {
        const u = k / 20;
        g.px(Math.round(37 + (fx - 37) * u), Math.round(60 + (fy - 60) * u + Math.sin(u * Math.PI) * 6), 'paper');
      }
      g.rect(fx - 1, fy - 2, 3, 3, 'red'); g.rect(fx - 1, fy - 3, 3, 1, 'white');
    }
    if (this.state === 'bite') { g.text('!', fx - 1, fy - 14, 'gold', 'ink'); g.circle(fx, fy + 1, 4 + (this.stateT % 8), 'white'); }
    if (this.state === 'reel') {
      g.box(160, 40, 18, 110, 'paper');
      const top = 44, h = 100;
      g.dither(163, top + h - ((this.zone + 24) / 100) * h, 12, (24 / 100) * h, 'mint', 0.75);
      g.rect(164, Math.round(top + h - (this.fish / 100) * h) - 2, 10, 4, 'gold');
      g.bar(150, 44, 4, 100, 0, 'ink', 'ink');
      g.rect(150, Math.round(44 + 100 * (1 - this.prog)), 4, Math.round(100 * this.prog), 'lime');
    }
    g.text(`Casts ${this.casts}`, 6, 4, 'ink');
    g.textR(`Caught ${this.catches.filter((c) => c !== 'nothing').length}`, 188, 4, 'ink');
    if (this.last && (this.state === 'ready' || this.state === 'show')) {
      g.box(8, 150, 176, 34, 'paper');
      wrap(this.last, 160).slice(0, 2).forEach((l, i) => g.text(l, 15, 156 + i * 10, 'cream'));
    } else if (this.state === 'ready') g.textC('Z to cast', 96, 166, 'paper', 'ink');
  }
}

export function makeMini(game: Game, kind: MiniKind, best: number, done: (r: MiniResult) => void): Scene {
  switch (kind) {
    case 'sort': return new SortGame(game, kind, best, done);
    case 'chairs': return new ChairsGame(game, kind, best, done);
    case 'switch': return new SwitchGame(game, kind, best, done);
    case 'echo': return new EchoGame(game, kind, best, done);
    case 'fish': return new FishGame(game, kind, best, done);
  }
}
