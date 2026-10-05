import { getSprite } from "../engine/sprites";
import { PALETTE } from "../engine/palette";
import { MEMBERS } from "./data/members";

/**
 * Things that happen outside the square: the favicon, the tab title, and the
 * lines that continue from the canvas up the page to the top of the window.
 */
export class Meta {
  private link: HTMLLinkElement;
  private fav = document.createElement("canvas");
  private lastFav = "";
  private pageLines: HTMLCanvasElement;
  private baseTitle = "Plumb";
  private titleTimer: number | null = null;
  /** Per held party member: the x position on the canvas, in canvas pixels, or null. */
  lineXs: { x: number; color: string; slack: boolean }[] = [];
  private fall = 0;
  private falling = false;
  private tight = 0;
  /** True while the page lines were made up for an ending rather than read from the field. */
  synthetic = false;
  private hidden = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.link = document.querySelector("link[rel='icon']") ?? document.createElement("link");
    this.link.rel = "icon";
    document.head.appendChild(this.link);
    this.fav.width = 16;
    this.fav.height = 16;
    this.pageLines = document.getElementById("lines") as HTMLCanvasElement;
    const fit = () => {
      this.pageLines.width = window.innerWidth;
      this.pageLines.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", () => {
      this.hidden = document.hidden;
      if (document.hidden) document.title = "The Hand is still holding.";
      else this.setTitle(this.baseTitle);
    });
  }

  /** Favicon from an 8x8 sprite. */
  favicon(spriteKey: string, a: string, b: string, kind: "humanoid" | "knot" | "thing" = "humanoid", variant = "slack"): void {
    const key = `${spriteKey}|${a}|${b}|${variant}`;
    if (key === this.lastFav) return;
    this.lastFav = key;
    const cells = getSprite(kind, spriteKey, variant);
    const ctx = this.fav.getContext("2d")!;
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = cells[y * 8 + x];
      if (!v) continue;
      ctx.fillStyle = v === 1 ? PALETTE.black : v === 2 ? a : b;
      ctx.fillRect(x * 2, y * 2, 2, 2);
    }
    this.link.href = this.fav.toDataURL();
  }

  /** Favicon as a party health bar during battle. */
  faviconBar(frac: number): void {
    const key = `bar|${Math.round(frac * 8)}`;
    if (key === this.lastFav) return;
    this.lastFav = key;
    const ctx = this.fav.getContext("2d")!;
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = PALETTE.coal;
    ctx.fillRect(0, 5, 16, 6);
    ctx.fillStyle = frac < 0.3 ? PALETTE.blood : frac < 0.6 ? PALETTE.amber : PALETTE.leaf;
    ctx.fillRect(1, 6, Math.round(14 * frac), 4);
    this.link.href = this.fav.toDataURL();
  }

  faviconHero(): void {
    const sp = MEMBERS.fathom.sprite;
    this.favicon(sp.seed, PALETTE[sp.a], PALETTE[sp.b], "humanoid", sp.variant ?? "");
  }

  setTitle(t: string): void {
    this.baseTitle = t;
    if (!this.hidden) document.title = t;
  }

  /** A title that reverts after a while. */
  flashTitle(t: string, ms = 4000): void {
    document.title = t;
    if (this.titleTimer !== null) clearTimeout(this.titleTimer);
    this.titleTimer = window.setTimeout(() => { if (!this.hidden) document.title = this.baseTitle; }, ms);
  }

  /** Begin the fall: every page line drops away over a few seconds. */
  letGo(): void {
    this.ensureLines();
    this.falling = true;
    this.fall = 0;
  }

  /** Every line pulls tight for a moment. */
  tighten(): void {
    this.ensureLines();
    this.tight = 1;
  }

  /** On a map that draws no lines, the page still needs some to fall or pull. */
  private ensureLines(): void {
    if (this.lineXs.some((l) => !l.slack)) return;
    this.lineXs = Array.from({ length: 13 }, (_, i) => ({ x: 8 + i * 17, color: PALETTE.bone, slack: false }));
    this.synthetic = true;
  }

  resetLines(): void {
    this.falling = false;
    this.fall = 0;
    this.tight = 0;
    this.synthetic = false;
  }

  /** Draw the lines from the top of the canvas to the top of the window. */
  drawLines(dt: number, scale: number): void {
    const ctx = this.pageLines.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.pageLines.width, this.pageLines.height);
    const r = this.canvas.getBoundingClientRect();
    if (this.falling) this.fall = Math.min(1, this.fall + dt / 3);
    if (this.tight > 0) this.tight = Math.max(0, this.tight - dt / 2.5);
    for (const l of this.lineXs) {
      if (l.slack) continue;
      const x = Math.round(r.left + l.x * scale) + 0.5;
      ctx.strokeStyle = l.color;
      ctx.globalAlpha = 0.55 + 0.4 * this.tight;
      ctx.lineWidth = Math.max(1, Math.floor(scale / 2)) + (this.tight > 0.3 ? 1 : 0);
      ctx.beginPath();
      if (this.falling) {
        // The line goes slack: it sags and falls toward the canvas top
        const top = r.top * this.fall + (-20) * (1 - this.fall);
        const sag = Math.sin(this.fall * Math.PI) * 60;
        ctx.moveTo(x, r.top);
        ctx.quadraticCurveTo(x + sag, (r.top + top) / 2, x + sag * 0.5, Math.max(top, 0));
      } else {
        ctx.moveTo(x, r.top);
        ctx.lineTo(x, 0);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Offer a file to save: used for the knot letter at the end. */
  download(name: string, dataUrl: string): void {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  }
}
