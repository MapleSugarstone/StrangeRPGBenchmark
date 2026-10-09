import type { Input } from "../../engine/input";
import { type Screen, W, H, wrap, LINE_H } from "../../engine/screen";
import type { Scene } from "../../engine/scene";
import { deferred } from "../../engine/scene";
import { getSprite } from "../../engine/sprites";
import { colorInt, mixInt, PALETTE_INT } from "../../engine/palette";
import { FONT_H, FONT_W, GLYPHS } from "../../engine/fontdata";
import { drawBox } from "../../engine/dialogue";
import type { Audio } from "../../engine/audio";
import { Rng } from "../../engine/rng";
import { hasSave, loadMeta } from "../state";
import { MEMBERS } from "../data/members";
import { knotCells, encodeKnots, KNOT_MESSAGES } from "../knots";

export type TitleChoice = { kind: "new" } | { kind: "continue" } | { kind: "code"; code: string } | { kind: "password"; word: string } | { kind: "chapter"; n: number };

/** The title: a line of held people on a hill, one of them slack, and a menu. */
export class TitleScene implements Scene {
  opaque = true;
  private done = deferred<TitleChoice>();
  readonly promise = this.done.promise;
  private items: string[] = [];
  private index = 0;
  private time = 0;
  private mode: "menu" | "code" | "password" = "menu";
  private typed = "";
  private rng = new Rng("title");
  private people: { x: number; sprite: { seed: string; a: string; b: string; variant: string }; note: string }[] = [];
  private message = "";

  constructor(private audio: Audio, private input: Input) {
    this.rebuild();
    const cols: [string, string][] = [["sand", "teal"], ["clay", "rose"], ["bone", "sea"], ["olive", "gold"], ["sand", "plum"], ["clay", "moss"], ["bone", "rust"]];
    for (let i = 0; i < 9; i++) {
      const c = cols[i % cols.length];
      this.people.push({ x: 14 + i * 24 + this.rng.int(6), sprite: { seed: `title${i}`, a: c[0], b: c[1], variant: this.rng.chance(0.4) ? "hat" : "" }, note: "ABCDEFG"[this.rng.int(7)] });
    }
  }

  private rebuild(): void {
    this.items = hasSave() ? ["Continue", "New game", "Enter a code", "Say a knot", "Knot key"] : ["New game", "Enter a code", "Say a knot", "Knot key"];
  }

  update(dt: number, input: Input): void {
    this.time += dt;
    if (this.mode === "menu") {
      if (input.pressed("up")) { this.index = (this.index + this.items.length - 1) % this.items.length; this.audio.sfx("cursor"); }
      if (input.pressed("down")) { this.index = (this.index + 1) % this.items.length; this.audio.sfx("cursor"); }
      if (input.pressed("ok")) {
        input.consume("ok");
        this.audio.sfx("ok");
        const pick = this.items[this.index];
        if (pick === "Continue") this.done.resolve({ kind: "continue" });
        else if (pick === "New game") this.done.resolve({ kind: "new" });
        else if (pick === "Enter a code") { this.mode = "code"; this.typed = ""; this.input.captureText = true; this.message = "Paste or type the code, then press Enter."; }
        else if (pick === "Say a knot") { this.mode = "password"; this.typed = ""; this.input.captureText = true; this.message = "Type the words a knot spelled."; }
        else if (pick === "Knot key") { window.open("key.html", "_blank"); }
      }
      // Debug: number keys jump to a chapter when the hash asks for it
      return;
    }
    // Text entry
    const t = input.typed;
    for (const ch of t) {
      if (ch === "\b") this.typed = this.typed.slice(0, -1);
      else if (this.typed.length < 4000) this.typed += ch;
    }
    if (input.tapped("cancel")) { input.consume("cancel"); this.mode = "menu"; this.input.captureText = false; this.message = ""; return; }
    if (input.tapped("ok") && !t.includes(" ")) {
      // Enter submits. Space is typed as text, so only Enter or Z count here.
      input.consume("ok");
      this.input.captureText = false;
      const word = this.typed.trim();
      if (this.mode === "code") {
        if (word.length < 10) { this.message = "That is not a code."; this.input.captureText = true; return; }
        this.done.resolve({ kind: "code", code: word });
      } else {
        this.done.resolve({ kind: "password", word });
      }
    }
    // Paste support
    (this as unknown as { pasteHook?: boolean }).pasteHook ??= (() => { window.addEventListener("paste", (e) => { const txt = e.clipboardData?.getData("text") ?? ""; if (this.mode !== "menu") this.typed += txt.replace(/\s+/g, ""); }); return true; })();
  }

  draw(s: Screen): void {
    s.clear("ink");
    // Loft: a faint lattice of lights at the very top
    const lattice = mixInt(colorInt("frost"), PALETTE_INT.ink, 0.6);
    for (let x = 2; x < W; x += 12) s.px(x + (Math.floor(this.time + x) % 3), 2 + ((x / 12) % 2), lattice);
    // Lines to the top for every held person
    const lineC = mixInt(colorInt("bone"), PALETTE_INT.ink, 0.45);
    const ground = 150;
    for (const p of this.people) {
      const sway = Math.round(Math.sin(this.time * 0.8 + p.x) * 1);
      s.vline(p.x + 4 + sway, 4, ground - 1, lineC);
    }
    // Hill
    s.rect(0, ground + 8, W, H - ground - 8, "moss");
    for (let x = 0; x < W; x += 8) s.sprite(getSprite("tile", `${x % 3}`, "grass"), x, ground + 8, "moss", "leaf");
    for (const p of this.people) {
      const cells = getSprite("humanoid", p.sprite.seed, p.sprite.variant);
      s.sprite(cells, p.x, ground, p.sprite.a as never, p.sprite.b as never);
    }
    // Fathom, slack, a little apart
    const f = MEMBERS.fathom.sprite;
    s.sprite(getSprite(f.kind, f.seed, f.variant), W - 26, ground, f.a, f.b);
    // The fallen line, coiled along the hill
    const teal = colorInt("teal");
    for (let i = 0; i < 40; i++) s.px(W - 22 + Math.round(Math.sin(i * 0.7) * 6) - Math.floor(i / 3), ground + 9 + (i % 4), teal);
    // Title
    const title = "PLUMB";
    const tx = Math.floor((W - title.length * 12) / 2);
    // Plates behind the words stop the lines short of the letters
    s.rect(tx - 3, 47, title.length * 12 + 5, 20, "ink");
    for (let i = 0; i < title.length; i++) {
      drawBigLetter(s, title[i], tx + i * 12, 50, "white", "slate");
    }
    const sub = "a world on a line";
    s.rect(Math.floor(W / 2 - s.textWidth(sub) / 2) - 2, 74, s.textWidth(sub) + 4, FONT_H + 3, "ink");
    s.textCenter(sub, W / 2, 76, "bone");
    // Knot title: SLACK IS NOT FALLING as knots along a line
    const glyphs = encodeKnots(KNOT_MESSAGES.secret_title);
    const gx = Math.floor((W - glyphs.length * 8) / 2);
    glyphs.forEach((g, i) => s.sprite(knotCells(g), gx + i * 8, 88, "bone", "teal"));
    if (this.mode === "menu") {
      s.rect(W / 2 - 42, 102, 90, this.items.length * LINE_H + 3, "ink");
      this.items.forEach((it, i) => {
        const y = 104 + i * LINE_H;
        if (i === this.index) s.text("▶", W / 2 - 38, y, "gold");
        s.text(it, W / 2 - 28, y, i === this.index ? "white" : "bone");
      });
    } else {
      drawBox(s, 8, 98, W - 16, 50);
      const msg = wrap(this.message, W - 30);
      msg.forEach((l, i) => s.text(l, 14, 102 + i * LINE_H, "gold"));
      // The field shows the end of what was typed, and the cursor, in one row
      const cols = Math.floor((W - 30) / FONT_W) - 1;
      const shown = this.typed.length > cols ? "..." + this.typed.slice(-(cols - 3)) : this.typed;
      s.text(shown + (Math.floor(this.time * 2) % 2 ? "_" : " "), 14, 102 + Math.max(2, msg.length) * LINE_H + 2, "white");
      s.text("Enter confirms. Esc cancels.", 14, 137, "ash");
    }
    const meta = loadMeta();
    if (meta.endings.length) wrap(`Endings seen: ${meta.endings.join(", ")}`, W - 12).forEach((l, i, a) => s.textCenter(l, W / 2, H - 31 - (a.length - 1 - i) * LINE_H, "ash"));
    s.textCenter("Z or Enter: confirm  X or Esc: back", W / 2, H - 20, "slate");
    s.textCenter("C: menu", W / 2, H - 11, "slate");
  }
}

/** A letter from the small font scaled by two, with a shadow: 10 by 14 pixels, set 12 apart. */
export function drawBigLetter(s: Screen, ch: string, x: number, y: number, color: string, shadow: string): void {
  const g = GLYPHS[ch] ?? GLYPHS["?"];
  const c = colorInt(color as never), sh = colorInt(shadow as never);
  for (const [col, d] of [[sh, 1], [c, 0]] as const) {
    for (let r = 0; r < FONT_H; r++) {
      for (let k = 0; k < FONT_W - 1; k++) {
        if (g[r][k] === "#") s.rect(x + k * 2 + d, y + r * 2 + d, 2, 2, col);
      }
    }
  }
}

export const TITLE_FONT_H = FONT_H;
