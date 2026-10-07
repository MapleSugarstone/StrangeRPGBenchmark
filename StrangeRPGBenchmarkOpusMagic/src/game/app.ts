// The scene stack and the shared game state.
import { SaveData, newGame } from './state';

export interface Scene {
  update(): void;
  draw(): void;
  /** Scenes under an opaque scene are not drawn. */
  opaque?: boolean;
  enter?(): void;
  leave?(): void;
  /** Called when the scene above this one is popped. */
  resume?(): void;
  /** Called every frame while another scene is on top. */
  background?(): void;
}

class App {
  stack: Scene[] = [];
  s: SaveData = newGame();
  frame = 0;
  /** Seconds since the page loaded, for the shared beat. */
  t = 0;

  push(sc: Scene) { this.stack.push(sc); sc.enter?.(); }
  pop(): Scene | undefined {
    const sc = this.stack.pop();
    sc?.leave?.();
    this.top()?.resume?.();
    return sc;
  }
  replace(sc: Scene) { const old = this.stack.pop(); old?.leave?.(); this.push(sc); }
  reset(sc: Scene) { while (this.stack.length) this.stack.pop()?.leave?.(); this.push(sc); }
  top(): Scene | undefined { return this.stack[this.stack.length - 1]; }
  remove(sc: Scene) {
    const i = this.stack.indexOf(sc);
    if (i < 0) return;
    if (i === this.stack.length - 1) { this.pop(); return; }
    this.stack.splice(i, 1);
    sc.leave?.();
  }

  update() {
    const top = this.top();
    for (const sc of this.stack) if (sc !== top) sc.background?.();
    top?.update();
  }
  draw() {
    let from = this.stack.length - 1;
    while (from > 0 && !this.stack[from].opaque) from--;
    for (let i = Math.max(0, from); i < this.stack.length; i++) this.stack[i].draw();
  }

  /** The shared beat that every copied thing pulses on. */
  beat(): number { return Math.floor(this.t * 1.6) % 2; }
  beatPhase(): number { return (this.t * 1.6) % 1; }
}

export const app = new App();
