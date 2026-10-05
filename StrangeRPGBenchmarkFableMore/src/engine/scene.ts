import type { Screen } from "./screen";
import type { Input } from "./input";

export interface Scene {
  /** Update and handle input. Only the top scene updates unless it sets updateBelow. */
  update(dt: number, input: Input): void;
  draw(s: Screen): void;
  /** When true the scene below also updates (for overlays like the Hand cursor). */
  updateBelow?: boolean;
  /** When false the scenes below are still drawn (for dialogue and menus). */
  opaque?: boolean;
  onEnter?(): void;
  onExit?(): void;
}

/** A stack of scenes. The top scene updates, scenes draw from the lowest opaque one up. */
export class SceneStack {
  private stack: Scene[] = [];

  push(s: Scene): void {
    this.stack.push(s);
    s.onEnter?.();
  }

  pop(): Scene | undefined {
    const s = this.stack.pop();
    s?.onExit?.();
    return s;
  }

  replace(s: Scene): void {
    while (this.stack.length) this.pop();
    this.push(s);
  }

  /** Remove a specific scene wherever it sits. */
  remove(s: Scene): void {
    const i = this.stack.indexOf(s);
    if (i >= 0) {
      this.stack.splice(i, 1);
      s.onExit?.();
    }
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  has(s: Scene): boolean {
    return this.stack.includes(s);
  }

  get depth(): number {
    return this.stack.length;
  }

  update(dt: number, input: Input): void {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const s = this.stack[i];
      s.update(dt, input);
      if (!s.updateBelow) break;
    }
  }

  draw(screen: Screen): void {
    let start = 0;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].opaque !== false) {
        start = i;
        break;
      }
    }
    for (let i = start; i < this.stack.length; i++) this.stack[i].draw(screen);
  }
}

/** A promise with its resolver exposed, for scenes that finish asynchronously. */
export function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
