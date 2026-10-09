import type { Input } from "../../engine/input";
import { type Screen, W, H, wrap, LINE_H } from "../../engine/screen";
import type { Scene } from "../../engine/scene";
import { deferred } from "../../engine/scene";
import { getSprite } from "../../engine/sprites";
import { FONT_H } from "../../engine/fontdata";
import { colorInt } from "../../engine/palette";
import { drawBox, ListCursor } from "../../engine/dialogue";
import type { Audio } from "../../engine/audio";
import { knotCells, encodeKnots } from "../knots";
import { ITEMS } from "../data/items";
import { MEMBERS } from "../data/members";
import { type GameState, addItem, maxHpOf } from "../state";
import type { CampTalk } from "../story/types";
import { addBond } from "../state";
import { drawBigLetter } from "./title";

/** A full screen card: chapter title, subtitle, and the story beat. */
export class CardScene implements Scene {
  opaque = true;
  private done = deferred<void>();
  readonly promise = this.done.promise;
  private t = 0;
  constructor(private title: string, private subtitle: string, private beat: string | undefined, private audio: Audio) {}
  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.t > 0.6 && (input.pressed("ok") || input.pressed("cancel"))) { input.consume("ok"); input.consume("cancel"); this.done.resolve(); }
    if (this.t > 4.5) this.done.resolve();
  }
  draw(s: Screen): void {
    s.clear("black");
    const k = Math.min(1, this.t / 0.5);
    const lines = wrap(this.title, W - 20);
    const big = this.title.length <= 16;
    if (big) {
      const tx = Math.floor((W - this.title.length * 12) / 2);
      for (let i = 0; i < this.title.length; i++) if (i / this.title.length < k) drawBigLetter(s, this.title[i], tx + i * 12, 80, "white", "slate");
    } else lines.forEach((l, i) => s.textCenter(l, W / 2, 84 + i * LINE_H, "white"));
    const sub = wrap(this.subtitle, W - 20);
    const subY = big ? 104 : 104 + lines.length * LINE_H;
    if (this.t > 0.5) sub.forEach((l, i) => s.textCenter(l, W / 2, subY + i * LINE_H, "bone"));
    if (this.beat && this.t > 0.9) wrap(this.beat, W - 20).forEach((l, i) => s.textCenter(l, W / 2, Math.max(124, subY + sub.length * LINE_H + 8) + i * LINE_H, "lilac"));
    // A single line down the middle of the card, as a frame
    const c = s.buf;
    void c;
    s.vline(W / 2, 0, 70, 0xff5a5560);
    if (this.t > 1.2 && Math.floor(this.t * 2) % 2 === 0) s.textCenter("▶", W / 2, H - 12, "slate");
  }
}

/** Reading a knot message: the glyphs appear one by one, then the words. */
export class KnotScene implements Scene {
  opaque = false;
  private done = deferred<void>();
  readonly promise = this.done.promise;
  private t = 0;
  private glyphs: string[];
  constructor(private text: string, private reader: string, private audio: Audio) {
    this.glyphs = encodeKnots(text);
  }
  update(dt: number, input: Input): void {
    const before = Math.floor(this.t * 6);
    this.t += dt * (input.held("run") ? 3 : 1);
    const after = Math.floor(this.t * 6);
    if (after !== before && after <= this.glyphs.length) this.audio.pluck(330 + (after % 7) * 40, 0.25, 0.25);
    if (this.t > this.glyphs.length / 6 + 0.8 && (input.pressed("ok") || input.pressed("cancel"))) { input.consume("ok"); input.consume("cancel"); this.done.resolve(); }
  }
  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.7);
    const rows = Math.ceil(this.glyphs.length / 24);
    const quote = this.glyphs.length === 0 ? wrap("The line is bare. Nothing is written here.", W - 28) : wrap(`"${this.text}"`, W - 28);
    const quoteY = 18 + Math.max(1, rows) * 12 + 4;
    const h = quoteY + quote.length * LINE_H + 12;
    const y = Math.floor((H - h) / 2);
    drawBox(s, 6, y, W - 12, h);
    s.text(`${this.reader} reads the knots:`, 12, y + 5, "gold");
    const shown = Math.floor(this.t * 6);
    this.glyphs.forEach((g, i) => {
      if (i >= shown) return;
      const r = Math.floor(i / 24), c = i % 24;
      s.sprite(knotCells(g), 14 + c * 8, y + 16 + r * 12, "bone", "teal");
    });
    if (this.glyphs.length === 0) {
      s.hline(y + 20, 14, W - 14, colorInt("teal"));
    }
    if (this.glyphs.length === 0 || shown >= this.glyphs.length) {
      quote.forEach((l, i) => s.textCenter(l, W / 2, y + quoteY + i * LINE_H, "white"));
      if (Math.floor(this.t * 3) % 2 === 0) s.text("▶", W - 18, y + h - 11, "gold");
    }
  }
}

/** Shop rows start here, under the keeper and slug count. */
const SHOP_LIST_Y = 41;

/** A shop. Buy and sell. */
export class ShopScene implements Scene {
  opaque = false;
  private done = deferred<void>();
  readonly promise = this.done.promise;
  private mode: "root" | "buy" | "sell" = "root";
  private root = new ListCursor(3, 3);
  private cur = new ListCursor(0, 6);
  private note: { text: string; t: number } | null = null;
  constructor(private g: GameState, private items: string[], private keeper: string, private audio: Audio) {}
  private sellable(): string[] {
    return Object.keys(this.g.inventory).filter((i) => this.g.inventory[i] > 0 && ITEMS[i].kind !== "key");
  }
  update(dt: number, input: Input): void {
    if (this.note) { this.note.t -= dt; if (this.note.t <= 0) this.note = null; }
    if (this.mode === "root") {
      this.root.move(input, this.audio);
      if (input.pressed("cancel")) { input.consume("cancel"); this.audio.sfx("cancel"); this.done.resolve(); return; }
      if (input.pressed("ok")) {
        input.consume("ok");
        this.audio.sfx("ok");
        if (this.root.index === 0) { this.mode = "buy"; this.cur = new ListCursor(this.items.length, 6); }
        else if (this.root.index === 1) { this.mode = "sell"; this.cur = new ListCursor(this.sellable().length, 6); }
        else this.done.resolve();
      }
      return;
    }
    const list = this.mode === "buy" ? this.items : this.sellable();
    this.cur.count = list.length;
    this.cur.move(input, this.audio);
    if (input.pressed("cancel")) { input.consume("cancel"); this.audio.sfx("cancel"); this.mode = "root"; return; }
    if (input.pressed("ok")) {
      input.consume("ok");
      const id = list[this.cur.index];
      if (!id) return;
      const it = ITEMS[id];
      if (this.mode === "buy") {
        if (this.g.slugs < it.price) { this.audio.sfx("cancel"); this.note = { text: "Not enough slugs.", t: 1.2 }; return; }
        this.g.slugs -= it.price;
        addItem(this.g, id, 1);
        this.audio.sfx("slug");
        this.note = { text: `Bought ${it.name}.`, t: 1.2 };
      } else {
        const price = Math.max(1, Math.floor(it.price / 2));
        this.g.slugs += price;
        addItem(this.g, id, -1);
        this.audio.sfx("slug");
        this.note = { text: `Sold ${it.name} for ${price}.`, t: 1.2 };
        this.cur.clamp();
      }
    }
  }
  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.5);
    drawBox(s, 6, 16, W - 12, H - 36);
    s.text(this.keeper, 12, 21, "gold");
    s.textRight(`${this.g.slugs} slugs`, W - 12, 21 + (s.textWidth(this.keeper) + s.textWidth(`${this.g.slugs} slugs`) + 12 > W - 24 ? LINE_H : 0), "bone");
    if (this.mode === "root") {
      ["Buy", "Sell", "Leave"].forEach((r, i) => {
        const y = 40 + i * 10;
        if (i === this.root.index) s.text("▶", 12, y, "gold");
        s.text(r, 22, y, i === this.root.index ? "white" : "bone");
      });
      return;
    }
    const list = this.mode === "buy" ? this.items : this.sellable();
    this.cur.clamp();
    const scrolls = list.length > 6;
    const vis = list.slice(this.cur.top, this.cur.top + 6);
    vis.forEach((id, i) => {
      const idx = this.cur.top + i;
      const it = ITEMS[id];
      const y = SHOP_LIST_Y + i * 10;
      if (idx === this.cur.index) s.text("▶", 12, y, "gold");
      s.sprite(getSprite("item", it.sprite, it.sprite), 22, y - 1, "bone", "teal");
      s.text(it.name, 33, y, idx === this.cur.index ? "white" : "bone");
      const price = this.mode === "buy" ? it.price : Math.max(1, Math.floor(it.price / 2));
      s.textRight(`${price}${this.mode === "sell" ? ` x${this.g.inventory[id]}` : ""}`, scrolls ? W - 22 : W - 12, y, this.mode === "buy" && this.g.slugs < price ? "ash" : "bone");
    });
    if (scrolls) {
      if (this.cur.top > 0) s.text("↑", W - 18, SHOP_LIST_Y, "ash");
      if (this.cur.top + 6 < list.length) s.text("↓", W - 18, SHOP_LIST_Y + 50, "ash");
    }
    if (!list.length) s.text(this.mode === "buy" ? "Nothing for sale." : "Nothing to sell.", 22, SHOP_LIST_Y, "ash");
    const it = list[this.cur.index] ? ITEMS[list[this.cur.index]] : null;
    if (it) {
      const lines = wrap(it.desc, W - 30);
      lines.forEach((l, i) => s.text(l, 12, SHOP_LIST_Y + 66 + i * LINE_H, "lilac"));
      let y = SHOP_LIST_Y + 66 + lines.length * LINE_H + 3;
      if (it.stats) { s.text(Object.entries(it.stats).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join("  "), 12, y, "mint"); y += LINE_H; }
      s.text(it.kind === "weight" ? "For held members." : it.kind === "sole" ? "For slack members." : it.kind === "glove" ? "For anyone." : "", 12, y, "ash");
    }
    if (this.note) wrap(this.note.text, W - 30).forEach((l, i, a) => s.textCenter(l, W / 2, H - 32 - (a.length - 1 - i) * LINE_H, "gold"));
  }
}

/** Camp: pick who talks to whom. Each talk is a short exchange and makes a bond. */
export class CampScene implements Scene {
  opaque = false;
  private done = deferred<CampTalk | null>();
  readonly promise = this.done.promise;
  private cur: ListCursor;
  private options: CampTalk[];
  constructor(private g: GameState, talks: CampTalk[], private audio: Audio) {
    this.options = talks.filter((t) => g.roster.includes(t.a) && g.roster.includes(t.b));
    this.cur = new ListCursor(this.options.length + 1, 8);
  }
  update(dt: number, input: Input): void {
    this.cur.count = this.options.length + 1;
    this.cur.move(input, this.audio);
    if (input.pressed("cancel")) { input.consume("cancel"); this.audio.sfx("cancel"); this.done.resolve(null); }
    if (input.pressed("ok")) {
      input.consume("ok");
      this.audio.sfx("ok");
      const t = this.options[this.cur.index];
      if (!t) { this.done.resolve(null); return; }
      this.g.members[t.a].talks++;
      this.g.members[t.b].talks++;
      addBond(this.g, t.a, t.b);
      this.done.resolve(t);
    }
  }
  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.5);
    const h = 30 + (this.options.length + 1) * 12;
    const y = Math.floor((H - h) / 2);
    drawBox(s, 10, y, W - 20, h);
    s.text("Who sits together by the fire?", 16, y + 4, "gold");
    this.options.forEach((t, i) => {
      const yy = y + 16 + i * 12;
      if (i === this.cur.index) s.text("▶", 16, yy + 1, "gold");
      const a = MEMBERS[t.a], b = MEMBERS[t.b];
      s.sprite(getSprite(a.sprite.kind, a.sprite.seed, a.sprite.variant), 26, yy, a.sprite.a, a.sprite.b);
      s.sprite(getSprite(b.sprite.kind, b.sprite.seed, b.sprite.variant), 36, yy, b.sprite.a, b.sprite.b);
      const bonded = this.g.bonds.some(([x, z]) => (x === t.a && z === t.b) || (x === t.b && z === t.a));
      s.text(`${a.name} and ${b.name}${bonded ? " (again)" : ""}`, 48, yy + 1, i === this.cur.index ? "white" : "bone");
    });
    const yy = y + 16 + this.options.length * 12;
    if (this.cur.index === this.options.length) s.text("▶", 16, yy + 1, "gold");
    s.text("Nobody. Sleep.", 48, yy + 1, this.cur.index === this.options.length ? "white" : "bone");
  }
}

/** The ending letter: a knot message the player can download as a PNG. */
export function knotLetterPng(lines: string[]): string {
  const c = document.createElement("canvas");
  const scale = 4;
  const cols = 28;
  const rowsN = lines.reduce((a, l) => a + Math.ceil(Math.max(1, l.length) / cols), 0);
  c.width = (cols * 8 + 16) * scale;
  c.height = (rowsN * 12 + 16) * scale;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#23263a";
  ctx.fillRect(0, 0, c.width, c.height);
  let row = 0;
  for (const line of lines) {
    const glyphs = encodeKnots(line);
    glyphs.forEach((g, i) => {
      const r = row + Math.floor(i / cols), col = i % cols;
      const cells = knotCells(g);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = cells[y * 8 + x];
        if (!v) continue;
        ctx.fillStyle = v === 1 ? "#0b0a10" : v === 2 ? "#d8cfb8" : "#2fa39a";
        ctx.fillRect((8 + col * 8 + x) * scale, (8 + r * 12 + y) * scale, scale, scale);
      }
    });
    row += Math.max(1, Math.ceil(glyphs.length / cols));
  }
  return c.toDataURL("image/png");
}

export function healAll(g: GameState): void {
  for (const id of g.roster) g.members[id].hp = maxHpOf(g.members[id]);
}

export const CARD_FONT_H = FONT_H;
