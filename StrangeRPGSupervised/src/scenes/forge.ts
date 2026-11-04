import { fillRect, drawSprite, buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { isConfirm, isBack, updateInput, MenuCursor, menuDirection } from "../engine/input.js";
import { COLOR_VOID, COLOR_SHADOW, COLOR_ASH, COLOR_KILN_GLOW, COLOR_STONE_WHITE, COLOR_GROUND_LIGHT } from "../engine/palette.js";
import { setScene } from "../engine/scene_manager.js";
import type { GameState } from "../engine/game_state.js";
import { SPECIES } from "../battle/species.js";
import { MOVES } from "../battle/moves.js";
import { SPRITES } from "../art/sprites.js";
import type { Sprite } from "../engine/sprite.js";
import type { Type } from "../battle/types.js";
import { FORGE, FUSE_PRICE } from "../content/forge.js";
import { PASSIVE_TEXT } from "../content/passive_code.js";
import { heldRuin, canFuse, nameMixes, lookMixes, typeMixes, movePool, fuse, type Held } from "../engine/fusion.js";
import { playSfx } from "../engine/audio.js";

const cursor = new MenuCursor();
type Step = "first" | "second" | "name" | "look" | "types" | "moves" | "confirm" | "done";

/** The Forge: pick two Ruin, then the new one's name, look, types, and four moves, and pay to fuse them. */
export class ForgeScene {
  private state: GameState;
  private step: Step = "first";
  private a: Held | null = null;
  private b: Held | null = null;
  private names: string[] = [];
  private looks: Sprite[] = [];
  private types: Type[][] = [];
  private pool: string[] = [];
  private pick: { name?: string; sprite?: Sprite; types?: Type[]; moves: string[] } = { moves: [] };
  /** Seconds left on the forger's refusal, and which one. */
  private refusal = 0;
  private refused: "poor" | "young" = "poor";

  constructor(data?: any) {
    this.state = data?.save || ({} as GameState);
  }

  private options(): number {
    switch (this.step) {
      case "first": case "second": return this.candidates().length;
      case "name": return this.names.length;
      case "look": return this.looks.length;
      case "types": return this.types.length;
      case "moves": return this.pool.length;
      default: return 1;
    }
  }

  private candidates(): Held[] {
    return heldRuin(this.state).filter((r) => !(this.a && r.where === this.a.where && r.i === this.a.i));
  }

  private back(): void {
    const order: Step[] = ["first", "second", "name", "look", "types", "moves", "confirm"];
    const i = order.indexOf(this.step);
    if (this.step === "done" || i <= 0) { setScene("field", { save: this.state }); return; }
    this.step = order[i - 1];
    if (this.step === "moves") this.pick.moves = [];
  }

  update(dt: number): void {
    updateInput(dt);
    this.refusal = Math.max(0, this.refusal - dt);
    const dir = menuDirection();
    const step = dir === "up" || dir === "left" ? -1 : dir === "down" || dir === "right" ? 1 : 0;
    if (step) { playSfx("menu_move"); cursor.move(this.step, this.options(), step); }
    if (isBack()) { playSfx("menu_move"); this.back(); return; }
    if (!isConfirm()) return;
    const at = cursor.get(this.step, this.options());
    const refuse = (why: "poor" | "young") => { this.refused = why; this.refusal = 2; playSfx("ko"); };
    switch (this.step) {
      case "first": case "second": {
        const r = this.candidates()[at];
        if (!r) return;
        if (!canFuse(r)) { refuse("young"); return; }
        if (this.step === "first") { this.a = r; this.step = "second"; }
        else {
          this.b = r;
          const sa = SPECIES[this.a!.key], sb = SPECIES[r.key];
          this.names = nameMixes(sa.name, sb.name);
          this.looks = lookMixes(SPRITES[this.a!.key] ?? SPRITES.shard, SPRITES[r.key] ?? SPRITES.shard);
          this.types = typeMixes(sa.types, sb.types);
          this.pool = movePool(this.a!.key, r.key);
          this.pick = { moves: [] };
          this.step = "name";
        }
        break;
      }
      case "name": this.pick.name = this.names[at]; this.step = "look"; break;
      case "look": this.pick.sprite = this.looks[at]; this.step = "types"; break;
      case "types": this.pick.types = this.types[at]; this.step = this.pool.length > 4 ? "moves" : "confirm"; if (this.pool.length <= 4) this.pick.moves = [...this.pool]; break;
      case "moves": {
        const key = this.pool[at];
        this.pick.moves = this.pick.moves.includes(key) ? this.pick.moves.filter((m) => m !== key) : [...this.pick.moves, key];
        if (this.pick.moves.length === 4) this.step = "confirm";
        break;
      }
      case "confirm": {
        if ((this.state.bag.cinder ?? 0) < FUSE_PRICE) { refuse("poor"); return; }
        const made = fuse(this.state, this.a!, this.b!, { name: this.pick.name!, sprite: this.pick.sprite!, types: this.pick.types!, moves: this.pick.moves });
        if (made) { playSfx("level_up"); this.step = "done"; }
        break;
      }
      case "done": setScene("field", { save: this.state }); return;
    }
    playSfx("menu_confirm");
  }

  private wrap(text: string, width: number): string[] {
    const rows: string[] = [];
    for (const w of text.split(" ")) {
      const last = rows[rows.length - 1];
      if (last !== undefined && textWidth(`${last} ${w}`) <= width) rows[rows.length - 1] = `${last} ${w}`;
      else rows.push(w);
    }
    return rows;
  }

  private list(rows: string[], tags: string[] = [], dim: (i: number) => boolean = () => false, lit: (i: number) => boolean = () => false): void {
    const sel = cursor.get(this.step, rows.length);
    const top = Math.max(0, Math.min(sel - 7, rows.length - 8));
    rows.slice(top, top + 8).forEach((row, k) => {
      const i = top + k, y = 50 + k * 13;
      if (i === sel) fillRect(13, y + 1, 2, 6, COLOR_KILN_GLOW);
      drawText(buffer, row, 18, y, dim(i) ? COLOR_GROUND_LIGHT : lit(i) ? COLOR_KILN_GLOW : i === sel ? COLOR_STONE_WHITE : COLOR_ASH);
      if (tags[i]) drawText(buffer, tags[i], 176 - textWidth(tags[i]), y, dim(i) ? COLOR_GROUND_LIGHT : COLOR_ASH);
    });
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);
    fillRect(8, 8, 176, 176, COLOR_SHADOW);
    fillRect(9, 9, 174, 174, COLOR_VOID);
    drawText(buffer, FORGE.title, 16, 16, COLOR_KILN_GLOW);
    const prompt = this.refusal > 0 ? (this.refused === "poor" ? FORGE.poor : FORGE.young)
      : this.step === "done" ? FORGE.done : (FORGE as any)[this.step] as string;
    this.wrap(prompt ?? "", 160).slice(0, 2).forEach((row, i) => drawText(buffer, row, 16, 28 + i * 10, this.refusal > 0 || this.step === "done" ? COLOR_KILN_GLOW : COLOR_STONE_WHITE));
    switch (this.step) {
      case "first": case "second": {
        const c = this.candidates();
        this.list(c.map((r) => SPECIES[r.key]?.name ?? r.key), c.map((r) => `Lv${r.level}`), (i) => !canFuse(c[i]));
        break;
      }
      case "name": this.list(this.names); break;
      case "types": this.list(this.types.map((t) => t.join("/"))); break;
      case "moves": this.list(this.pool.map((k) => MOVES[k]?.name ?? k), [], () => false, (i) => this.pick.moves.includes(this.pool[i])); break;
      case "look": {
        const sel = cursor.get("look", this.looks.length);
        this.looks.forEach((s, i) => {
          const x = 20 + i * 40;
          if (i === sel) fillRect(x - 2, 96, 20, 2, COLOR_KILN_GLOW);
          drawSprite(s, x, 74, 2);
        });
        break;
      }
      case "confirm": case "done": {
        const sprite = this.pick.sprite;
        if (sprite) drawSprite(sprite, 18, 50, 2);
        drawText(buffer, (this.pick.types ?? []).join("/"), 42, 56, COLOR_ASH);
        drawText(buffer, this.pick.name ?? "", 18, 72, COLOR_STONE_WHITE);
        this.pick.moves.forEach((m, i) => drawText(buffer, MOVES[m]?.name ?? m, 18 + (i % 2) * 82, 86 + Math.floor(i / 2) * 10, COLOR_ASH));
        [this.a, this.b].forEach((p, i) => {
          const t = p ? PASSIVE_TEXT[SPECIES[p.key]?.passiveOf?.[0] ?? p.key]?.name : undefined;
          if (t) drawText(buffer, t, 18, 110 + i * 10, COLOR_KILN_GLOW);
        });
        if (this.step === "confirm") drawText(buffer, `${FUSE_PRICE}`, 176 - textWidth(`${FUSE_PRICE}`), 140, COLOR_KILN_GLOW);
        break;
      }
    }
    const purse = `Cinder ${this.state.bag.cinder ?? 0}`;
    drawText(buffer, purse, 176 - textWidth(purse), 168, COLOR_KILN_GLOW);
  }
}
