import type { Input } from "./input";
import { type Screen, W, H, wrap } from "./screen";
import { FONT_H } from "./fontdata";
import type { Scene } from "./scene";
import { deferred } from "./scene";
import type { Cells } from "./sprites";
import type { ColorName } from "./palette";
import type { Audio } from "./audio";

export interface Portrait {
  cells: Cells;
  a: ColorName;
  b: ColorName;
}

export interface SayOptions {
  speaker?: string;
  portrait?: Portrait;
  color?: ColorName;
  /** Put the box at the top of the screen. */
  top?: boolean;
  /** Characters per second. */
  speed?: number;
  /** Do not wait for a key, auto advance after a short while. */
  auto?: boolean;
}

export const BOX_H = 44;
const PAD = 5;
const LINES = 3;

/**
 * A dialogue box inside the square. Text types out, pages on confirm,
 * and resolves its promise when the last page is dismissed.
 */
export class DialogueScene implements Scene {
  opaque = false;
  private pages: string[][];
  private page = 0;
  private shown = 0;
  private timer = 0;
  private done: ReturnType<typeof deferred<void>>;
  private autoTimer = 0;
  readonly promise: Promise<void>;
  private speed: number;
  private blink = 0;
  private age = 0;

  constructor(private text: string, private opts: SayOptions, private audio: Audio, private hurry: () => boolean) {
    const textW = W - PAD * 2 - (opts.portrait ? 20 : 0) - 2;
    // Try a slightly narrower column rather than leave one word alone on the last page
    let lines = wrap(text, textW);
    for (const narrower of [textW - 8, textW - 16]) {
      if (lines.length <= LINES || lines.length % LINES !== 1) break;
      const alt = wrap(text, narrower);
      if (alt.length % LINES !== 1) { lines = alt; break; }
    }
    this.pages = [];
    for (let i = 0; i < lines.length; i += LINES) this.pages.push(lines.slice(i, i + LINES));
    if (this.pages.length === 0) this.pages.push([""]);
    this.done = deferred<void>();
    this.promise = this.done.promise;
    this.speed = opts.speed ?? 55;
  }

  private pageChars(): number {
    return this.pages[this.page].reduce((n, l) => n + l.length, 0);
  }

  update(dt: number, input: Input): void {
    this.blink += dt;
    this.age += dt;
    // A press that closed the scene before this one must not also skip this text
    if (this.age < 0.2) { input.consume("ok"); input.consume("cancel"); }
    const total = this.pageChars();
    const fast = this.hurry() || input.held("run");
    if (this.shown < total) {
      this.timer += dt * this.speed * (fast ? 4 : 1);
      const before = Math.floor(this.shown);
      this.shown = Math.min(total, this.timer);
      if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 3 === 0) this.audio.sfx("text");
      if (input.pressed("ok") || input.pressed("cancel")) {
        input.consume("ok");
        input.consume("cancel");
        this.shown = total;
        this.timer = total;
      }
      return;
    }
    if (this.opts.auto) {
      this.autoTimer += dt;
      if (this.autoTimer > 0.9 + total * 0.02) this.advance();
      return;
    }
    if (input.pressed("ok") || input.pressed("cancel")) {
      input.consume("ok");
      input.consume("cancel");
      this.advance();
    }
  }

  private advance(): void {
    this.page++;
    this.shown = 0;
    this.timer = 0;
    this.autoTimer = 0;
    if (this.page >= this.pages.length) {
      this.page = this.pages.length - 1;
      this.done.resolve();
    } else this.audio.sfx("cursor");
  }

  draw(s: Screen): void {
    const y = this.opts.top ? 2 : H - BOX_H - 2;
    drawBox(s, 2, y, W - 4, BOX_H);
    let tx = PAD + 1;
    if (this.opts.portrait) {
      const p = this.opts.portrait;
      s.frame(PAD, y + PAD, 18, 18, "slate");
      s.sprite(p.cells, PAD + 1, y + PAD + 1, p.a, p.b, { scale: 2 });
      tx += 20;
    }
    let ty = y + PAD;
    if (this.opts.speaker) {
      s.text(this.opts.speaker, tx, ty, this.opts.color ?? "gold");
      ty += FONT_H + 1;
    }
    const lines = this.pages[this.page];
    let remaining = Math.floor(this.shown);
    for (const line of lines) {
      const n = Math.min(line.length, remaining);
      s.text(line.slice(0, n), tx, ty, "white");
      remaining -= n;
      ty += FONT_H + 1;
    }
    if (this.shown >= this.pageChars() && !this.opts.auto && Math.floor(this.blink * 3) % 2 === 0) {
      const more = this.page < this.pages.length - 1;
      s.text(more ? "↓" : "▶", W - 10, y + BOX_H - 8, "gold");
    }
  }
}

export function drawBox(s: Screen, x: number, y: number, w: number, h: number): void {
  s.box(x, y, w, h, "ink", "bone");
  s.frame(x + 1, y + 1, w - 2, h - 2, "slate");
}

/** A vertical list of choices. Resolves with the chosen index, or -1 on cancel when allowed. */
export class ChoiceScene implements Scene {
  opaque = false;
  private index = 0;
  private done = deferred<number>();
  readonly promise = this.done.promise;

  constructor(private items: string[], private opts: { cancel?: boolean; title?: string; top?: boolean; right?: boolean }, private audio: Audio) {}

  update(dt: number, input: Input): void {
    if (input.pressed("up")) { this.index = (this.index + this.items.length - 1) % this.items.length; this.audio.sfx("cursor"); }
    if (input.pressed("down")) { this.index = (this.index + 1) % this.items.length; this.audio.sfx("cursor"); }
    if (input.pressed("ok")) {
      input.consume("ok");
      this.audio.sfx("ok");
      this.done.resolve(this.index);
    } else if (input.pressed("cancel") && this.opts.cancel) {
      input.consume("cancel");
      this.audio.sfx("cancel");
      this.done.resolve(-1);
    }
  }

  draw(s: Screen): void {
    const w = Math.max(...this.items.map((i) => s.textWidth(i)), this.opts.title ? s.textWidth(this.opts.title) : 0) + 20;
    const h = this.items.length * (FONT_H + 2) + 8 + (this.opts.title ? FONT_H + 2 : 0);
    const x = this.opts.right ? W - w - 4 : Math.floor((W - w) / 2);
    const y = this.opts.top ? 4 : H - BOX_H - 6 - h;
    drawBox(s, x, y, w, h);
    let ty = y + 4;
    if (this.opts.title) {
      s.text(this.opts.title, x + 6, ty, "gold");
      ty += FONT_H + 2;
    }
    this.items.forEach((it, i) => {
      if (i === this.index) s.text("▶", x + 4, ty, "gold");
      s.text(it, x + 12, ty, i === this.index ? "white" : "bone");
      ty += FONT_H + 2;
    });
  }
}

/** Reusable list cursor with scrolling, for menus that are drawn by their owner. */
export class ListCursor {
  index = 0;
  top = 0;
  constructor(public count: number, public visible: number) {}
  move(input: Input, audio?: Audio): boolean {
    if (this.count === 0) return false;
    let moved = false;
    if (input.pressed("up")) { this.index = (this.index + this.count - 1) % this.count; moved = true; }
    if (input.pressed("down")) { this.index = (this.index + 1) % this.count; moved = true; }
    if (moved) {
      audio?.sfx("cursor");
      if (this.index < this.top) this.top = this.index;
      if (this.index >= this.top + this.visible) this.top = this.index - this.visible + 1;
      if (this.index === 0) this.top = 0;
      if (this.index === this.count - 1) this.top = Math.max(0, this.count - this.visible);
    }
    return moved;
  }
  clamp(): void {
    if (this.index >= this.count) this.index = Math.max(0, this.count - 1);
    if (this.top > this.index) this.top = this.index;
    if (this.top < 0) this.top = 0;
  }
}

/** Fade overlay used by scene transitions. Resolves when the fade completes. */
export class FadeScene implements Scene {
  opaque = false;
  updateBelow = false;
  private t = 0;
  private done = deferred<void>();
  readonly promise = this.done.promise;
  constructor(private dir: "in" | "out", private dur = 0.35) {}
  update(dt: number): void {
    this.t += dt;
    if (this.t >= this.dur) this.done.resolve();
  }
  draw(s: Screen): void {
    const k = Math.min(1, this.t / this.dur);
    s.dimRect(0, 0, W, H, this.dir === "out" ? k : 1 - k);
  }
}
