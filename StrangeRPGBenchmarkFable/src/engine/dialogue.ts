import type { Scene, SceneStack } from "./scene";
import type { Screen } from "./screen";
import type { Key } from "./input";
import { getSprite, type SpriteSpec } from "./sprites";
import { wrap, FONT_W, LINE_H } from "./font";
import type { ColorName } from "./palette";
import { audio } from "./audio";

export interface Page {
  speaker?: string;
  portrait?: SpriteSpec;
  text: string;
  choices?: string[];
  color?: ColorName;
}

export const BOX_Y = 128;
export const BOX_H = 64;
const TEXT_X = 6;
const PORTRAIT_TEXT_X = 26;
/** Rightmost lit column a line may reach, leaving room for the page arrow at INDICATOR_X. */
const TEXT_RIGHT = 180;
const INDICATOR_X = 182;
const PLAIN_TEXT_Y = 5;
const SPEAKER_TEXT_Y = 14;

function colsFrom(x: number): number {
  return Math.floor((TEXT_RIGHT - x - (FONT_W - 2)) / FONT_W) + 1;
}

/**
 * Dialogue box pinned to the bottom of the square. Pages advance on confirm.
 * Resolves with the chosen index of the last page's choices, or 0.
 */
export class DialogueScene implements Scene {
  overlay = true;
  private pages: { speaker?: string; portrait?: SpriteSpec; lines: string[]; choices?: string[]; color?: ColorName }[] = [];
  private page = 0;
  private shown = 0;
  private timer = 0;
  private cursor = 0;
  private done = false;
  private resolve: (choice: number) => void;
  private blink = 0;

  private boxH: number;

  /** boxY moves the top of the box down, for screens that keep a strip above it in view. */
  constructor(private stack: SceneStack, pages: Page[], resolve: (choice: number) => void, private fastHeld: () => boolean, private boxY = BOX_Y) {
    this.resolve = resolve;
    this.boxH = 192 - boxY;
    for (const p of pages) {
      const cols = colsFrom(p.portrait ? PORTRAIT_TEXT_X : TEXT_X);
      // The last line's descender row keeps 1 px clear of the inner frame, 2 px above the bottom.
      const maxLines = Math.floor((this.boxH - 11 - (p.speaker ? SPEAKER_TEXT_Y : PLAIN_TEXT_Y)) / LINE_H) + 1;
      const lines = wrap(p.text, cols);
      for (let i = 0; i < lines.length; i += maxLines) {
        const last = i + maxLines >= lines.length;
        this.pages.push({
          speaker: p.speaker,
          portrait: p.portrait,
          lines: lines.slice(i, i + maxLines),
          choices: last ? p.choices : undefined,
          color: p.color,
        });
      }
    }
    if (this.pages.length === 0) this.pages.push({ lines: [""] });
  }

  private get total(): number {
    return this.pages[this.page].lines.join("\n").length;
  }

  update(dt: number): void {
    this.blink += dt;
    if (this.shown < this.total) {
      const speed = this.fastHeld() ? 400 : 70;
      this.timer += dt * speed;
      let advanced = 0;
      while (this.timer >= 1 && this.shown < this.total) { this.timer -= 1; this.shown++; advanced++; }
      if (advanced > 0 && !this.fastHeld()) audio.sfx("blip");
    }
  }

  key(k: Key): void {
    if (this.done) return;
    const p = this.pages[this.page];
    if (this.shown < this.total) {
      if (k === "ok" || k === "cancel") this.shown = this.total;
      return;
    }
    if (p.choices) {
      if (k === "up") { this.cursor = (this.cursor + p.choices.length - 1) % p.choices.length; audio.sfx("cursor"); }
      else if (k === "down") { this.cursor = (this.cursor + 1) % p.choices.length; audio.sfx("cursor"); }
      else if (k === "ok") { audio.sfx("confirm"); this.finish(this.cursor); }
      else if (k === "cancel") { audio.sfx("cancel"); this.finish(p.choices.length - 1); }
      return;
    }
    if (k === "ok" || k === "cancel") {
      audio.sfx("cursor");
      if (this.page < this.pages.length - 1) { this.page++; this.shown = 0; this.timer = 0; }
      else this.finish(0);
    }
  }

  private finish(choice: number): void {
    this.done = true;
    this.stack.pop();
    this.resolve(choice);
  }

  draw(s: Screen): void {
    const p = this.pages[this.page];
    s.panel(0, this.boxY, 192, this.boxH, "dark", "white");
    s.frame(1, this.boxY + 1, 190, this.boxH - 2, "black");
    let tx = TEXT_X, ty = this.boxY + PLAIN_TEXT_Y;
    if (p.portrait) {
      s.rect(4, this.boxY + 4, 18, 18, "black");
      s.sprite(getSprite(p.portrait), 5, this.boxY + 5, p.portrait.a, p.portrait.b, { scale: 2 });
      tx = PORTRAIT_TEXT_X;
    }
    if (p.speaker) {
      s.text(p.speaker, tx, this.boxY + 4, "yellow");
      ty = this.boxY + SPEAKER_TEXT_Y;
    }
    let remaining = this.shown;
    for (let i = 0; i < p.lines.length && remaining > 0; i++) {
      const line = p.lines[i].slice(0, remaining);
      s.text(line, tx, ty + i * LINE_H, p.color ?? "white");
      remaining -= p.lines[i].length + 1;
    }
    const complete = this.shown >= this.total;
    if (complete && p.choices) {
      const w = Math.max(...p.choices.map((c) => c.length)) * FONT_W + 14;
      const h = p.choices.length * LINE_H + 6;
      const x = 192 - w - 4, y = this.boxY - h - 2;
      s.panel(x, y, w, h, "dark", "white");
      p.choices.forEach((c, i) => {
        s.text(c, x + 10, y + 3 + i * LINE_H, i === this.cursor ? "yellow" : "white");
        if (i === this.cursor) s.text(">", x + 4, y + 3 + i * LINE_H, "yellow");
      });
    } else if (complete && Math.floor(this.blink * 3) % 2 === 0) {
      s.text("v", INDICATOR_X, this.boxY + this.boxH - 10, "yellow");
    }
  }
}

export function say(stack: SceneStack, fastHeld: () => boolean, pages: Page[], boxY = BOX_Y): Promise<number> {
  return new Promise((resolve) => stack.push(new DialogueScene(stack, pages, resolve, fastHeld, boxY)));
}
