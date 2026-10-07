// The power-on prompt, the console's boot logo, and the developer's mark, before the title.
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { CW, text, textCenter } from '../engine/font';
import { tapped } from '../engine/input';
import { H, W, rect } from '../engine/screen';
import { Scene } from './app';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DIRS: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const GOLD = [0x7a5a1a, 0xc2a05a, 0xf2d25a, 0xffffff];

/** The pilcrow mark as pixels in the order a pen would lay them: bowl, then the two stems. */
function pilcrow(): [number, number][] {
  const bowl: [number, number][] = [];
  const stems: [number, number][] = [];
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 16; x++) {
      const inBowl = y <= 12 && x <= 9 && ((x - 7) / 7) ** 2 + ((y - 6) / 6.5) ** 2 <= 1;
      const bar = y <= 1 && x >= 5;
      if (inBowl || bar) bowl.push([x, y]);
      else if (x === 9 || x === 10 || x === 14 || x === 15) stems.push([x, y]);
    }
  }
  bowl.sort((a, b) => Math.atan2(a[1] - 6, a[0] - 7) - Math.atan2(b[1] - 6, b[0] - 7) || a[1] - b[1]);
  stems.sort((a, b) => (a[0] > 12 ? 1 : 0) - (b[0] > 12 ? 1 : 0) || a[1] - b[1] || a[0] - b[0]);
  return [...bowl, ...stems];
}

export class Splash implements Scene {
  opaque = true;
  private phase: 'off' | 'boot' | 'mark' = 'off';
  private t = 0;
  private readonly pen = pilcrow();

  constructor(private done: () => void) {}

  update() {
    this.t++;
    const key = tapped('ok') || tapped('back');
    if (this.phase === 'off') {
      if (key) { this.phase = 'boot'; this.t = 0; music.play('splash', 0); }
      return;
    }
    if (key && this.t > 4) { this.done(); return; }
    if (this.phase === 'boot') {
      if (this.t >= 170) { this.phase = 'mark'; this.t = 0; }
    } else {
      if (this.t < 70 && this.t % 3 === 0) sfx.type();
      if (this.t === 96) sfx.text();
      if (this.t >= 200) this.done();
    }
  }

  /** Blacks out pixels through an ordered dither; k runs from 0 (clear) to 1 (black). */
  private fade(k: number) {
    if (k <= 0) return;
    const n = Math.floor(k * 16);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < n) rect(x, y, 1, 1, 0);
  }

  draw() {
    rect(0, 0, W, H, 0x000000);
    if (this.phase === 'off') {
      if (Math.floor(this.t / 40) % 2) rect(176, 180, 2, 1, 0x8a1a1a);
      textCenter('press Z', 96, 92, 0x2a2833);
      return;
    }
    if (this.phase === 'boot') this.drawBoot();
    else this.drawMark();
  }

  private drawBoot() {
    const t = this.t;
    const cx = 96, cy = 72;
    const spokes = Math.min(8, Math.floor(t / 7));
    const grow = (i: number) => Math.min(18, (t - (i + 1) * 7) * 3);
    for (let i = 0; i < spokes; i++) {
      const [dx, dy] = DIRS[i];
      const lit = t > 70 ? Math.floor((t - 70) / 3) % 8 : -1;
      const len = grow(i);
      for (let s = 2; s <= len; s++) {
        const shade = s > len - 3 ? 3 : i === lit ? 3 : s < 6 ? 1 : 2;
        const c = GOLD[shade];
        if (dx === 0 || dy === 0) rect(cx + dx * s - (dy ? 1 : 0), cy + dy * s - (dx ? 1 : 0), dy ? 3 : 1, dx ? 3 : 1, c);
        else { rect(cx + dx * s, cy + dy * s, 1, 1, c); rect(cx + dx * s + (dx > 0 ? -1 : 1), cy + dy * s, 1, 1, c); }
      }
    }
    if (spokes > 0) rect(cx - 1, cy - 1, 3, 3, 0xffffff);
    if (t > 76) {
      const name = 'ASTERISK-8';
      const shown = name.slice(0, Math.min(name.length, Math.floor((t - 76) / 3)));
      const x0 = cx - Math.round((name.length * (CW + 2)) / 2);
      for (let k = 0; k < shown.length; k++) text(shown[k], x0 + k * (CW + 2), 104, k === 9 ? GOLD[2] : 0xe6dfd0);
    }
    if (t > 112) textCenter('licensed by asterisk', cx, 120, 0x4e4a5c);
    this.fade(t > 150 ? (t - 150) / 20 : 0);
  }

  private drawMark() {
    const t = this.t;
    const ox = 88, oy = 56;
    const n = Math.min(this.pen.length, t * 5);
    for (let i = 0; i < n; i++) {
      const [x, y] = this.pen[i];
      rect(ox + x, oy + y, 1, 1, i >= n - 5 && n < this.pen.length ? 0x6fe3e0 : 0xe6dfd0);
    }
    // A drop of ink leaves the second stem and lands on the name.
    if (t > 70 && t < 96) {
      const dy = Math.floor(((t - 70) / 26) ** 2 * 18);
      rect(ox + 14, oy + 27 + dy, 2, 2, 0x6fe3e0);
    }
    if (t >= 96) {
      textCenter('PILCROW SOFT', 96, 100, 0xe6dfd0);
      if (t < 104) rect(ox + 12, 99, 6, 1, 0x6fe3e0);
      else rect(ox + 14, 108, 2, 1, 0x2a8a8a);
    }
    if (t > 120) textCenter('presents', 96, 122, 0x4e4a5c);
    this.fade(t > 170 ? (t - 170) / 26 : 0);
  }
}
