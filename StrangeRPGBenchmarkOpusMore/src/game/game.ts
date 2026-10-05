import { Audio } from '../core/audio';
import { Gfx } from '../core/gfx';
import { Input } from '../core/input';
import { GameState, Meta, loadMeta } from './state';

export interface Scene {
  overlay?: boolean;
  update(): void;
  draw(g: Gfx): void;
}

export class Game {
  stack: Scene[] = [];
  state: GameState | null = null;
  meta: Meta = loadMeta();
  frame = 0;
  paused = false;
  private acc = 0;
  private last = 0;
  private hooks = new Set<() => void>();
  loadFromSave: () => void = () => {};
  toTitle: () => void = () => {};

  constructor(public gfx: Gfx, public input: Input, public audio: Audio) {}

  onFrameAdd(fn: () => void) { this.hooks.add(fn); }
  onFrameRemove(fn: () => void) { this.hooks.delete(fn); }

  push(s: Scene) { this.stack.push(s); }
  pop(s?: Scene) {
    if (s) { const i = this.stack.lastIndexOf(s); if (i >= 0) this.stack.splice(i, 1); return; }
    this.stack.pop();
  }
  replace(s: Scene) { this.stack = [s]; }
  top(): Scene | undefined { return this.stack[this.stack.length - 1]; }

  step() {
    this.frame++;
    this.gfx.t = this.frame;
    this.input.pollPads();
    const top = this.top();
    if (top) top.update();
    for (const h of [...this.hooks]) h();
    this.input.endFrame();
    if (this.state) this.state.playtime += 1 / 60;
  }

  draw() {
    let base = this.stack.length - 1;
    while (base > 0 && this.stack[base].overlay) base--;
    if (base < 0) { this.gfx.clear(); return; }
    for (let i = base; i < this.stack.length; i++) this.stack[i].draw(this.gfx);
  }

  start() {
    const tick = (t: number) => {
      if (!this.last) this.last = t;
      this.acc += Math.min(100, t - this.last);
      this.last = t;
      let n = 0;
      while (this.acc >= 1000 / 60 && n < 4) {
        if (!this.paused) this.step();
        this.acc -= 1000 / 60;
        n++;
      }
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Steps the game by hand. Used by debug tools when the page is hidden.
  run(frames: number) {
    for (let i = 0; i < frames; i++) this.step();
    this.draw();
  }
}
