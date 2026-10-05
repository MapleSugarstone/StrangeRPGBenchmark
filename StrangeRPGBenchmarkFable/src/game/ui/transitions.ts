import type { Scene, SceneStack } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";

/** Fades the screen to black (out) or from black (in), then pops itself. */
export class FadeScene implements Scene {
  overlay = true;
  private t = 0;
  constructor(private stack: SceneStack, private out: boolean, private done: () => void) {}
  update(dt: number): void {
    this.t += dt * 4;
    if (this.t >= 1) { this.stack.pop(); this.done(); }
  }
  key(_k: Key): void {}
  draw(s: Screen): void {
    const a = this.out ? Math.min(1, this.t) : 1 - Math.min(1, this.t);
    s.dim(a);
  }
}

/** Chapter title card. Dismisses on confirm or after a few seconds. */
export class TitleCardScene implements Scene {
  overlay = false;
  private t = 0;
  constructor(private stack: SceneStack, private text: string, private sub: string, private done: () => void) {}
  update(dt: number): void {
    this.t += dt;
    if (this.t > 3.5) this.finish();
  }
  private finish(): void {
    this.stack.pop();
    this.done();
  }
  key(k: Key): void {
    if (this.t > 0.4 && (k === "ok" || k === "cancel")) this.finish();
  }
  draw(s: Screen): void {
    s.clear("black");
    const a = Math.min(1, this.t * 2);
    s.textCenter(this.text, 96, 80, a > 0.5 ? "yellow" : "gray");
    s.rect(48, 90, 96, 1, a > 0.7 ? "white" : "dark");
    if (this.t > 0.6) s.textCenter(this.sub, 96, 96, "white");
  }
}
