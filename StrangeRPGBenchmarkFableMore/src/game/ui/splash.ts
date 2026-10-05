import type { Input } from "../../engine/input";
import { type Screen, W, H } from "../../engine/screen";
import type { Scene } from "../../engine/scene";
import { deferred } from "../../engine/scene";
import { getSprite, fromRows } from "../../engine/sprites";
import { colorInt, mixInt, PALETTE_INT } from "../../engine/palette";
import type { Audio } from "../../engine/audio";
import { drawBigLetter } from "./title";

/**
 * The boot sequence of a console that never existed: the hardware maker's
 * chime, then the studio card. Any key skips.
 */
export class SplashScene implements Scene {
  opaque = true;
  private done = deferred<void>();
  readonly promise = this.done.promise;
  private t = 0;
  private chimed = false;
  private logo = fromRows(["..aaaa..", ".a....a.", "a..bb..a", "a.b..b.a", "a..bb..a", ".a....a.", "..aaaa..", "...a...."]);

  constructor(private audio: Audio) {}

  update(dt: number, input: Input): void {
    this.t += dt;
    if (!this.chimed && this.t > 0.4 && this.audio.ready) {
      this.chimed = true;
      // Four plucked notes going up, then one falling: the Rimward Electric chime
      [330, 440, 554, 660].forEach((f, i) => this.audio.pluck(f, 0.5, 0.35, 0, undefined, 0.6 + i * 0.1));
      setTimeout(() => this.audio.pluck(220, 1.2, 0.4, 0, undefined, 0.3), 700);
    }
    if (this.t > 0.5 && (input.pressed("ok") || input.pressed("cancel"))) { input.consume("ok"); input.consume("cancel"); this.done.resolve(); }
    if (this.t > 6.2) this.done.resolve();
  }

  draw(s: Screen): void {
    s.clear("black");
    const t = this.t;
    if (t < 3.2) {
      // Rimward Electric: a bob on a line swings into the frame
      const k = Math.min(1, t / 0.8);
      const fade = t > 2.6 ? Math.max(0, 1 - (t - 2.6) / 0.6) : 1;
      const col = mixInt(colorInt("gold"), PALETTE_INT.black, 1 - k * fade);
      const col2 = mixInt(colorInt("bone"), PALETTE_INT.black, 1 - k * fade);
      const sway = Math.sin(t * 2.2) * (1 - k) * 20;
      const bx = Math.round(W / 2 + sway), by = 84;
      s.vline(bx, 0, by - 1, col2);
      s.spriteN(this.logo, 8, bx - 4, by, col, col2);
      if (k >= 1) {
        const name = "RIMWARD ELECTRIC";
        s.textCenter(name, W / 2, 104, col2);
        s.textCenter("SLATBOY  8", W / 2, 116, col);
        s.textCenter("licensed cartridge", W / 2, 134, mixInt(colorInt("slate"), PALETTE_INT.black, 1 - fade));
      }
    } else {
      // Kite and Spindle: a kite on a string, drawn from the small font
      const u = Math.min(1, (t - 3.2) / 0.6);
      const fade = t > 5.6 ? Math.max(0, 1 - (t - 5.6) / 0.6) : 1;
      const col = mixInt(colorInt("teal"), PALETTE_INT.black, 1 - u * fade);
      const col2 = mixInt(colorInt("salt"), PALETTE_INT.black, 1 - u * fade);
      const kite = getSprite("wind", "splashkite");
      const kx = Math.round(W / 2 + Math.sin(t * 1.7) * 6), ky = 60;
      s.spriteN(kite, 8, kx - 4, ky, col2, col);
      s.line(kx, ky + 8, W / 2, 110, col);
      const word = "KITE & SPINDLE";
      const tx = Math.floor((W - word.length * 12) / 2);
      for (let i = 0; i < word.length; i++) if (word[i] !== " ") drawBigLetter(s, word[i], tx + i * 12, 112, u * fade > 0.5 ? "salt" : "slate", "black");
      s.textCenter("presents", W / 2, 136, col2);
    }
    s.textCenter("press a key", W / 2, H - 10, mixInt(colorInt("slate"), PALETTE_INT.black, 0.3));
  }
}
