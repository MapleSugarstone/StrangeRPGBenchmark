// Plays a scene from the script in a box at the bottom of the screen.
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { LH, text, wrap } from '../engine/font';
import { pressed, tapped } from '../engine/input';
import { drawCopied, drawSprite, hasSprite } from '../engine/sprites';
import { PORTRAIT } from '../engine/sprites16';
import { frame, rect } from '../engine/screen';
import { SCENES, SItem } from '../story/script';
import { Scene, app } from './app';
import { C, Menu, panel } from './ui';

export interface StoryHost {
  flag(name: string): boolean;
  command(cmd: string, args: string[], done: (jump?: string) => void): void;
  fill(text: string): string;
}

const SPEAKERS: Record<string, string> = {
  WAIT: 'wait', GLOSS: 'gloss', HALT: 'halt', EACH: 'each', WHEN: 'when', SWEEP: 'sweep', COUNT: 'count', STACK: 'stack',
  POUR: 'pour', MIND: 'mind', GRIND: 'grind', TALLY: 'tally', HOLD: 'hold', WEIGH: 'weigh', MANY: 'many', PRESSHAND: 'presshand',
  CUSTOMER: 'customer', TEND: 'tend', HEED: 'heed', LISTENER: 'listener', RELAY: 'relay', AGAIN: 'again', ONCE: 'once', KEEP: 'keep', REEL: 'reel',
};

const COPIED_SPEAKERS = new Set(['AGAIN', 'GRIND', 'MANY', 'PRESSHAND']);

export class Dialogue implements Scene {
  private items: SItem[] = [];
  private pos = 0;
  private who: string | null = null;
  private lines: string[] = [];
  private shown = 0;
  private total = 0;
  private mode: 'text' | 'choice' | 'busy' | 'done' = 'busy';
  private choices: { label: string; target: string }[] = [];
  private menu = new Menu([], 5);
  private visited = 0;

  constructor(private sceneId: string, private host: StoryHost, private onDone?: () => void) {}

  enter() { music.duck(true); this.load(this.sceneId); }

  leave() { music.duck(false); }

  private load(id: string) {
    const sc = SCENES[id];
    if (!sc) { console.warn('missing scene', id); this.finish(); return; }
    if (++this.visited > 50) { this.finish(); return; }
    this.items = sc.items.filter((it) => !it.cond || this.host.flag(it.cond.flag) !== it.cond.neg);
    this.pos = 0;
    this.next();
  }

  private next() {
    while (this.pos < this.items.length) {
      const it = this.items[this.pos];
      if (it.k === 'choice') {
        this.choices = [];
        while (this.pos < this.items.length && this.items[this.pos].k === 'choice') {
          const c = this.items[this.pos] as Extract<SItem, { k: 'choice' }>;
          this.choices.push({ label: this.host.fill(c.label), target: c.target });
          this.pos++;
        }
        this.menu = new Menu(this.choices.map((c) => ({ label: c.label })), 5);
        this.mode = 'choice';
        return;
      }
      this.pos++;
      if (it.k === 'cmd') {
        if (it.cmd === 'goto') { this.load(it.args[0]); return; }
        this.mode = 'busy';
        let sync = true;
        let resumed = false;
        let syncJump: string | undefined;
        this.host.command(it.cmd, it.args, (jump) => {
          if (resumed) return;
          resumed = true;
          if (sync) { syncJump = jump; return; }
          if (jump) this.load(jump);
          else this.next();
        });
        sync = false;
        if (!resumed) return;
        if (syncJump) { this.load(syncJump); return; }
        continue;
      }
      this.who = it.k === 'say' ? it.who : null;
      const cols = this.who ? 31 : 35;
      this.lines = wrap(this.host.fill(it.text), cols);
      this.total = this.lines.reduce((s, l) => s + l.length, 0);
      this.shown = 0;
      this.mode = 'text';
      return;
    }
    this.finish();
  }

  private finish() {
    if (this.mode === 'done') return;
    this.mode = 'done';
    app.remove(this);
    this.onDone?.();
  }

  update() {
    if (this.mode === 'text') {
      if (this.shown < this.total) {
        this.shown = Math.min(this.total, this.shown + 2);
        if (app.frame % 3 === 0) sfx.text();
        if (tapped('ok') || tapped('back')) this.shown = this.total;
      } else if (pressed('ok') || tapped('back')) {
        this.next();
      }
    } else if (this.mode === 'choice') {
      const r = this.menu.update(false);
      if (r >= 0) {
        const t = this.choices[r].target;
        if (t === 'none') { this.mode = 'busy'; this.finish(); }
        else this.load(t);
      }
    }
  }

  draw() {
    if (this.mode === 'text' || this.mode === 'choice') this.drawBox();
    if (this.mode === 'choice') {
      const h = this.choices.length * LH + 6;
      const w = Math.max(...this.choices.map((c) => c.label.length)) * 5 + 16;
      panel(186 - w, 124 - h, w, h, C.hi);
      this.menu.draw(186 - w + 3, 124 - h + 4, w - 6);
    }
  }

  private drawBox() {
    const y = 128;
    panel(2, y, 188, 62);
    let x = 7;
    if (this.who) {
      const key = SPEAKERS[this.who] ?? 'page';
      const big = PORTRAIT[this.who];
      rect(5, y + 5, 18, 18, 0x0b0a10);
      frame(5, y + 5, 18, 18, COPIED_SPEAKERS.has(this.who) ? 0x5a7a1a : 0x2a2440);
      const fr = Math.floor(app.frame / 30) % 2;
      if (big) {
        if (COPIED_SPEAKERS.has(this.who)) drawCopied(big, 6, y + 6, { frame: app.beat() }, app.beat());
        else drawSprite(big, 6, y + 6, { frame: fr, marks: big === 'wait16' ? markCount() : 0 });
      } else if (hasSprite(key)) {
        if (COPIED_SPEAKERS.has(this.who)) drawCopied(key, 10, y + 10, { frame: app.beat() }, app.beat());
        else drawSprite(key, 10, y + 10, { frame: fr });
      }
      text(this.who.charAt(0) + this.who.slice(1).toLowerCase(), 26, y + 4, COPIED_SPEAKERS.has(this.who) ? C.again : C.hi);
      x = 26;
    }
    let left = this.shown;
    const top = this.who ? y + 14 : y + 6;
    const col = this.who ? C.text : 0xc8c0d8;
    for (let i = 0; i < this.lines.length && left > 0; i++) {
      const s = this.lines[i].slice(0, left);
      left -= this.lines[i].length;
      text(s, x, top + i * LH, col);
    }
    if (this.mode === 'text' && this.shown >= this.total && Math.floor(app.frame / 20) % 2) text('\x03', 182, y + 54, C.dim);
  }
}

export function markCount(): number {
  return app.s.pages.reduce((n, p) => n + (p.fixed ? 0 : p.src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length), 0);
}
