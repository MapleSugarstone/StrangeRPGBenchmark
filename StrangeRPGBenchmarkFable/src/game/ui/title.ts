import type { Scene } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import { getSprite } from "../../engine/sprites";
import type { Game } from "../game";
import { Rng } from "../../engine/rng";
import { audio } from "../../engine/audio";

/** Title screen with drifting generated moths. */
export class TitleScene implements Scene {
  private cursor = 0;
  private t = 0;
  private moths: { x: number; y: number; vx: number; vy: number; seed: string }[] = [];
  private busy = false;

  constructor(private game: Game) {
    const rng = new Rng("title");
    for (let i = 0; i < 9; i++) this.moths.push({ x: rng.int(0, 184), y: rng.int(0, 120), vx: (rng.next() - 0.5) * 14, vy: (rng.next() - 0.5) * 8, seed: `moth${i}` });
  }

  private options(): string[] {
    return this.game.hasSave() ? ["Continue", "New game"] : ["New game"];
  }

  update(dt: number): void {
    this.t += dt;
    for (const m of this.moths) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.vx += (96 - m.x) * 0.02 * dt + Math.sin(this.t + m.x) * 2 * dt;
      m.vy += (70 - m.y) * 0.02 * dt;
      if (m.x < -8) m.x = 192; if (m.x > 192) m.x = -8;
      if (m.y < -8) m.y = 130; if (m.y > 130) m.y = -8;
    }
  }

  enter(): void {
    audio.music("title", 7);
  }

  key(k: Key): void {
    if (this.busy) return;
    const opts = this.options();
    audio.music("title", 7);
    if (k === "up") { this.cursor = (this.cursor + opts.length - 1) % opts.length; audio.sfx("cursor"); }
    else if (k === "down") { this.cursor = (this.cursor + 1) % opts.length; audio.sfx("cursor"); }
    else if (k === "ok") {
      this.busy = true;
      audio.sfx("confirm");
      const choice = opts[this.cursor];
      if (choice === "Continue" && this.game.load()) void this.game.continueGame();
      else void this.game.newGame();
    }
  }

  draw(s: Screen): void {
    s.clear("black");
    // A dim ember at the horizon.
    for (let i = 0; i < 6; i++) s.rect(96 - 30 + i * 2, 100 + i, 60 - i * 4, 1, i < 2 ? "red" : "dark");
    for (const m of this.moths) {
      const spec = { kind: "shape" as const, seed: m.seed, a: "salt" as const, b: "pink" as const, variant: "moth" };
      const flap = Math.floor(this.t * 6 + m.x) % 2 === 0;
      s.sprite(getSprite(spec), Math.round(m.x), Math.round(m.y), flap ? "salt" : "gray", "pink", { black: "dark" });
    }
    s.textCenter("THE", 96, 40, "gray");
    s.textCenter("MOTH CROWN", 96, 50, "yellow", "red");
    s.textCenter("a tile adventure", 96, 62, "salt");
    const opts = this.options();
    opts.forEach((o, i) => {
      s.textCenter(o, 96, 120 + i * 10, i === this.cursor ? "yellow" : "white");
      if (i === this.cursor) s.text(">", 96 - o.length * 2 - 8, 120 + i * 10, "yellow");
    });
    s.textCenter("arrows move  Z ok  X back  C menu", 96, 170, "gray");
    s.textCenter("hold shift to hurry", 96, 178, "dark");
  }
}
