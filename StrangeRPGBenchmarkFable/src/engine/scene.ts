import type { Screen } from "./screen";
import type { Input, Key } from "./input";

export interface Scene {
  /** True when the scene below should still be drawn under this one. */
  overlay?: boolean;
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  draw(s: Screen): void;
  key(k: Key): void;
}

export class SceneStack {
  private stack: Scene[] = [];
  constructor(public input: Input) {}

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    this.input.flush();
    scene.enter?.();
  }

  pop(): Scene | undefined {
    const s = this.stack.pop();
    s?.exit?.();
    this.input.flush();
    return s;
  }

  replace(scene: Scene): void {
    this.pop();
    this.push(scene);
  }

  /** Pops until the given scene is on top. */
  popTo(scene: Scene): void {
    while (this.top && this.top !== scene) this.pop();
  }

  clear(): void {
    while (this.stack.length) this.pop();
  }

  has(scene: Scene): boolean {
    return this.stack.includes(scene);
  }

  update(dt: number): void {
    const top = this.top;
    if (!top) return;
    let k: Key | undefined;
    while ((k = this.input.poll()) !== undefined) {
      if (this.top !== top) { this.input.flush(); break; }
      top.key(k);
    }
    this.top?.update(dt);
  }

  draw(s: Screen): void {
    if (this.stack.length === 0) return;
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].overlay) start--;
    for (let i = start; i < this.stack.length; i++) this.stack[i].draw(s);
  }
}
