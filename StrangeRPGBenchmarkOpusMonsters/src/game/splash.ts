// The opening: a power switch, the console's boot screen, and the publisher's card.
// Everything is drawn on a 96 by 96 layer shown at double size, so it shares one pixel grid.
import { audio, sfx } from '../engine/audio';
import { textCenter } from '../engine/font';
import { input } from '../engine/input';
import { music } from '../engine/music';
import { clear, dither, layer, rect, INK } from '../engine/screen';
import type { Mode } from './modes';

const PALE = '#e8e2d0';
const DIM = '#6a6474';

/** Covers the layer with black in ordered-dither steps, 0 clear to 1 solid. */
function fadeOut(k: number): void {
  if (k > 0) dither(0, 0, 96, 96, INK, Math.min(1, k));
}

function console8(t: number): void {
  // The console's mark: an eight-sided frame that draws itself in, then the name below it.
  const cx = 48, cy = 36;
  const pts = [[-8, -18], [8, -18], [18, -8], [18, 8], [8, 18], [-8, 18], [-18, 8], [-18, -8]];
  const drawn = Math.min(8, Math.floor(t / 6));
  for (let i = 0; i < drawn; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 8];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s++) rect(cx + Math.round(x0 + (x1 - x0) * s / n), cy + Math.round(y0 + (y1 - y0) * s / n), 1, 1, PALE);
  }
  if (t > 50) {
    // The figure 8 inside, built from two stacked rings with a one-pixel gap where they meet.
    for (const [ry, r] of [[-6, 5], [6, 6]]) {
      for (let a = 0; a < 48; a++) {
        const th = (a / 48) * Math.PI * 2;
        const x = cx + Math.round(Math.cos(th) * r), y = cy + ry + Math.round(Math.sin(th) * r * 0.9);
        if (!(ry < 0 && y === cy - 1 && x === cx)) rect(x, y, 1, 1, '#c8a040');
      }
    }
  }
  if (t > 70) {
    textCenter('MARROW 8', 48, 62, PALE);
    if (t > 90) textCenter('home system', 48, 73, DIM);
  }
}

function publisher(t: number): void {
  // A peel coming off in one long spiral.
  const cx = 48, cy = 34;
  const len = Math.min(140, t * 2);
  for (let i = 0; i < len; i++) {
    const th = i / 9, r = 3 + i / 9;
    const x = cx + Math.round(Math.cos(th) * r), y = cy + Math.round(Math.sin(th) * r * 0.8);
    rect(x, y, 1, 1, i % 11 === 0 ? '#d4848a' : '#e0a030');
  }
  if (t > 40) textCenter('PELLUCID SOFT', 48, 60, PALE);
  if (t > 70) textCenter('presents', 48, 71, DIM);
}

function developer(t: number): void {
  // A millstone with a crack across it.
  const cx = 48, cy = 34;
  for (let y = -12; y <= 12; y++) for (let x = -14; x <= 14; x++) {
    const d = (x * x) / 196 + (y * y) / 144;
    if (d <= 1 && d > 0.12) rect(cx + x, cy + y, 1, 1, d > 0.8 ? '#8a8478' : '#b0a898');
  }
  for (let k = 0; k < 13; k++) rect(cx - 6 + k, cy - 8 + Math.round(k * 1.2) + (k % 3 === 0 ? 1 : 0), 1, 1, INK);
  if (t > 30) textCenter('a GRISTMILL game', 48, 60, PALE);
  if (t > 55) textCenter('1994', 48, 71, DIM);
}

/** Power switch, then three cards. Any key after the switch skips to the title. */
export class Splash implements Mode {
  opaque = true;
  t = 0;
  on = false;
  constructor(private next: () => void) {}

  update(): void {
    if (!this.on) {
      if (input.hit('ok') || input.hit('back')) {
        audio();
        this.on = true;
        this.t = 0;
        music.play('splash');
      }
      this.t++;
      return;
    }
    this.t++;
    if (this.t === 40) sfx('spot');
    if (this.t > 20 && (input.hit('ok') || input.hit('back'))) { this.done(); return; }
    if (this.t >= 560) this.done();
  }

  done(): void {
    music.stop();
    this.next();
  }

  draw(): void {
    clear(INK);
    if (!this.on) {
      // A dark screen and the power light, waiting for a hand.
      const blink = Math.floor(this.t / 40) % 2 === 0;
      rect(94, 176, 4, 2, blink ? '#c84040' : '#4a2020');
      textCenter('Z switches it on.', 96, 160, '#3a3442');
      return;
    }
    const t = this.t;
    layer('splash', 96, 96, 0, 0, 2, () => {
      rect(0, 0, 96, 96, INK);
      if (t < 200) {
        // Boot: the screen warms up in rows before the mark draws.
        const rows = Math.min(96, t * 4);
        for (let y = 0; y < rows; y += 2) rect(0, y, 96, 1, '#120f18');
        if (t > 20) console8(t - 20);
        fadeOut(t > 170 ? (t - 170) / 30 : 0);
      } else if (t < 380) {
        publisher(t - 200);
        fadeOut(t < 215 ? 1 - (t - 200) / 15 : t > 350 ? (t - 350) / 30 : 0);
      } else {
        developer(t - 380);
        fadeOut(t < 395 ? 1 - (t - 380) / 15 : t > 530 ? (t - 530) / 30 : 0);
      }
    });
  }
}
