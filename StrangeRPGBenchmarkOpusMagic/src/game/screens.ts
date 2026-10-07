// Title, chapter cards, overlays, the lectern, the end.
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { CW, glyphBits, text, textCenter, wrap } from '../engine/font';
import { pressed, tapped } from '../engine/input';
import { H, W, ditherRect, rect } from '../engine/screen';
import { LIME, drawSprite } from '../engine/sprites';
import { Scene, app } from './app';
import { colorize } from './editor';
import { PAGE_COLORS, hasSave, loadGame } from './state';
import { C, Menu, panel } from './ui';
import { markCount } from './dialogue';

export const CHAPTERS = [
  { n: 1, title: 'WAIT', place: 'Busy' },
  { n: 2, title: 'HALT', place: 'the river and Standing' },
  { n: 3, title: 'EACH', place: 'Twice' },
  { n: 4, title: 'WHEN', place: 'the Ears' },
  { n: 5, title: 'ONCE', place: 'the Tether' },
  { n: 6, title: 'AGAIN', place: 'Busy' },
  { n: 7, title: 'UNTIL', place: 'Busy, seven years on' },
  { n: 8, title: 'STET', place: 'the river and Twice' },
  { n: 9, title: 'ROOM', place: 'the Ears and the Line' },
  { n: 10, title: 'GLOSS', place: 'the Scrivener' },
];

/** Draws text at 3x by stamping each glyph pixel as a block. */
/**
 * Display text. The font's glyphs are smoothed three times larger with the Scale3x rule, then drawn one pixel at a
 * time with an outline, a lit top edge, and a shaded bottom edge, so the letters are drawn shapes rather than blown-up pixels.
 */
export function bigText(s: string, cx: number, y: number, color: number, shade = 0x000000) {
  const gw = s.length * CW, gh = 8;
  const src = new Uint8Array(gw * gh);
  for (let i = 0; i < s.length; i++) for (const [bx, by] of glyphBits(s[i])) if (by < gh) src[by * gw + i * CW + bx] = 1;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : src[y * gw + x]);
  const ow = gw * 3, oh = gh * 3;
  const out = new Uint8Array(ow * oh);
  for (let yy = 0; yy < gh; yy++) {
    for (let xx = 0; xx < gw; xx++) {
      const A = at(xx - 1, yy - 1), B = at(xx, yy - 1), Cc = at(xx + 1, yy - 1);
      const D = at(xx - 1, yy), E = at(xx, yy), F = at(xx + 1, yy);
      const G = at(xx - 1, yy + 1), Hh = at(xx, yy + 1), I = at(xx + 1, yy + 1);
      const e = [E, E, E, E, E, E, E, E, E];
      if (B !== Hh && D !== F) {
        e[0] = D === B ? D : E;
        e[1] = (D === B && E !== Cc) || (B === F && E !== A) ? B : E;
        e[2] = B === F ? F : E;
        e[3] = (D === B && E !== G) || (D === Hh && E !== A) ? D : E;
        e[5] = (B === F && E !== I) || (Hh === F && E !== Cc) ? F : E;
        e[6] = D === Hh ? D : E;
        e[7] = (D === Hh && E !== I) || (Hh === F && E !== G) ? Hh : E;
        e[8] = Hh === F ? F : E;
      }
      for (let k = 0; k < 9; k++) out[(yy * 3 + Math.floor(k / 3)) * ow + xx * 3 + (k % 3)] = e[k];
    }
  }
  const x0 = Math.round(cx - ow / 2);
  const on = (x: number, y: number) => (x < 0 || y < 0 || x >= ow || y >= oh ? 0 : out[y * ow + x]);
  const hi = lighten(color), lo = darken(color);
  for (let yy = -1; yy <= oh; yy++) {
    for (let xx = -1; xx <= ow; xx++) {
      if (on(xx, yy)) {
        const c = !on(xx, yy - 1) ? hi : !on(xx, yy + 1) || !on(xx + 1, yy + 1) ? lo : color;
        rect(x0 + xx, y + yy, 1, 1, c);
      } else if (on(xx - 1, yy) || on(xx + 1, yy) || on(xx, yy - 1) || on(xx, yy + 1) || on(xx - 1, yy - 1)) {
        rect(x0 + xx, y + yy, 1, 1, shade);
      }
    }
  }
}

function lighten(c: number) { const f = (v: number) => Math.min(255, v + 40); return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255); }
function darken(c: number) { const f = (v: number) => Math.round(v * 0.62); return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255); }

// ---------------------------------------------------------------- title

export class TitleScreen implements Scene {
  opaque = true;
  menu: Menu;
  t = 0;
  /** Wait's rote as the save last left it. */
  rote = ['wait  # until'];
  enter() { music.play('title'); }

  constructor(private start: (cont: boolean) => void) {
    const sv = loadGame();
    if (sv?.flags.act2_done) this.rote.push('leave the last line blank');
    else if (sv && sv.chapter >= 7) this.rote.push('halt');
    const items = [{ label: 'Begin' }];
    if (hasSave()) items.unshift({ label: 'Continue' });
    this.menu = new Menu(items, 3);
  }
  update() {
    this.t++;
    const r = this.menu.update(false);
    if (r >= 0) this.start(this.menu.items[r].label === 'Continue');
  }
  draw() {
    rect(0, 0, W, H, 0x050408);
    for (let i = 0; i < 40; i++) {
      const x = (i * 47) % W;
      const y = (H - ((this.t * (0.2 + (i % 5) * 0.05) + i * 31) % H));
      rect(x, Math.round(y), 1, 1, i % 7 ? 0x2a2440 : 0x6fe3e0);
    }
    bigText('ROTE', 96, 34, 0xe6d8bc);
    drawSprite('wait16', 88, 76);
    const x0 = 96 - (this.rote[0].length * CW) / 2;
    this.rote.forEach((line, i) => {
      const cols = colorize(line);
      const x = i ? Math.min(x0, 96 - (line.length * CW) / 2) : x0;
      for (let k = 0; k < line.length; k++) text(line[k], x + k * CW, 100 + i * 9, i ? (line === 'halt' ? C.bad : C.again) : cols[k]);
      if (i === this.rote.length - 1 && Math.floor(this.t / 30) % 2) rect(x + line.length * CW + 1, 99 + i * 9, 1, 8, C.hi);
    });
    this.menu.draw(74, 128, 50);
    text('arrows, Z, X, C. M mutes.', 32, 176, C.faint);
  }
}

// ---------------------------------------------------------------- chapter cards

export class ChapterCard implements Scene {
  opaque = true;
  t = 0;
  constructor(private n: number, private done: () => void) {}
  enter() { if (this.n === 7) music.play('act2_title', 0); else music.stinger('chapter'); }
  update() {
    this.t++;
    if (this.t > 60 && (tapped('ok') || tapped('back'))) { sfx.ok(); app.pop(); this.done(); }
  }
  draw() {
    rect(0, 0, W, H, 0);
    const ch = CHAPTERS[this.n - 1];
    const k = Math.min(1, this.t / 40);
    if (k > 0.2) textCenter(ch.n === 7 ? 'act two' : String(ch.n), 96, 60, C.dim);
    if (k > 0.5) bigText(ch.title.slice(0, Math.ceil(ch.title.length * Math.min(1, (this.t - 20) / 40))), 96, 76, ch.n === 6 ? LIME : 0xe6d8bc);
    if (this.t > 60) textCenter(ch.place, 96, 110, C.dim);
    if (this.t > 90 && Math.floor(this.t / 30) % 2) textCenter('\x03', 96, 170, C.faint);
  }
}

// ---------------------------------------------------------------- overlays

export class Overlay implements Scene {
  t = 0;
  constructor(private title: string, private lines: { s: string; code?: boolean; color?: number }[], private done?: () => void, private reveal = 0) {}
  update() {
    this.t++;
    if (this.t > 20 && (tapped('ok') || tapped('back'))) { sfx.ok(); app.pop(); this.done?.(); }
  }
  draw() {
    const h = this.lines.length * 9 + 22;
    const y = Math.max(4, 96 - h / 2);
    panel(8, y, 176, h, C.hi);
    text(this.title, 13, y + 5, C.hi);
    const shown = this.reveal ? Math.floor(this.t / this.reveal) : this.lines.length;
    this.lines.slice(0, shown).forEach((l, i) => {
      const yy = y + 16 + i * 9;
      if (l.code) {
        const cols = colorize(l.s);
        for (let k = 0; k < l.s.length; k++) text(l.s[k], 13 + k * CW, yy, l.color ?? cols[k]);
      } else text(l.s, 13, yy, l.color ?? C.text);
    });
  }
}

// ---------------------------------------------------------------- a small choice

/** A short menu over the field, for someone who can do more than talk. */
export class ChoiceMenu implements Scene {
  menu: Menu;
  constructor(private title: string, private options: [string, () => void][]) {
    this.menu = new Menu(options.map(([label]) => ({ label })), options.length);
  }
  update() {
    const r = this.menu.update();
    if (r === -2) { app.pop(); return; }
    if (r >= 0) { app.pop(); this.options[r][1](); }
  }
  draw() {
    const h = this.options.length * 8 + 10;
    panel(100, 154 - h, 88, h, C.hi);
    this.menu.draw(104, 158 - h, 80);
    text(this.title, 4, 146 - h, C.text);
  }
}

// ---------------------------------------------------------------- lectern

export class LecternMenu implements Scene {
  menu: Menu;
  constructor(private rest: () => void, private write: () => void, private margin?: () => void) {
    const items = [{ label: 'Rest and save' }, { label: 'Write' }];
    if (margin) items.push({ label: 'the Margin' });
    items.push({ label: 'Leave' });
    this.menu = new Menu(items, items.length);
  }
  update() {
    const r = this.menu.update();
    const label = this.menu.items[r]?.label;
    if (r === -2 || label === 'Leave') { app.pop(); return; }
    if (r === 0) { app.pop(); this.rest(); }
    if (r === 1) { app.pop(); this.write(); }
    if (label === 'the Margin') { app.pop(); this.margin?.(); }
  }
  draw() {
    const h = this.menu.items.length * 8 + 10;
    panel(100, 154 - h, 88, h, C.hi);
    this.menu.draw(104, 158 - h, 80);
    text('A lectern with a blank page.', 4, 108, C.text);
  }
}

// ---------------------------------------------------------------- the end

export class Credits implements Scene {
  opaque = true;
  enter() { music.play(this.act === 2 ? 'credits2' : 'credits'); }
  t = 0;
  scroll = 0;
  lines: { s: string; c: number; code?: boolean }[] = [];
  /** Act 1's credits lead into Act 2. Act 2's go back to the title. */
  constructor(private act: 1 | 2 = 1, private next?: () => void) {
    const s = app.s;
    const L = (str: string, c: number = C.text, code = false) => this.lines.push({ s: str, c, code });
    L('');
    L('ROTE', C.text);
    L('');
    L('Your rote', C.hi);
    L('');
    for (const p of s.pages) {
      L(`${p.name}`, PAGE_COLORS[p.color] ?? C.text);
      for (const l of p.src.split('\n')) L(`  ${l}`, C.text, true);
      if (!p.fixed) L(`  cast ${p.stats.casts}, harm ${p.stats.harm}, heal ${p.stats.heal}`, C.dim);
      L('');
    }
    L(`Wait, level ${s.level}`, C.dim);
    L(`${s.library.length} pages in the Library`, C.dim);
    L(`${Math.floor(s.time / 60)} minutes`, C.dim);
    L('');
    L('The line you gave the child:', C.hi);
    L(`  ${s.childLine ?? ''}`, C.text, true);
    if (act === 2) {
      L('');
      L('The line you gave Halt:', C.hi);
      L(`  ${s.allyLines.halt ?? ''}`, C.text, true);
      if (s.allyLines.gloss !== undefined) {
        L('');
        L('The line you gave Gloss:', C.hi);
        L(`  ${s.allyLines.gloss}`, C.text, true);
      }
      L('');
      L('The line Room wrote:', C.hi);
      L('  stay  # mine', C.text, true);
    }
    L('');
    L('');
    L('PILCROW SOFT', C.dim);
    L('');
    L('wait  # until it stops', C.text, true);
  }
  update() {
    this.t++;
    this.scroll += 0.25;
    if (this.t > 120 && tapped('ok') && this.scroll > this.lines.length * 9) {
      sfx.ok();
      if (this.next) { app.pop(); this.next(); } else location.reload();
    }
    if (pressed('down')) this.scroll += 2;
  }
  draw() {
    rect(0, 0, W, H, 0);
    const y0 = H - Math.floor(this.scroll);
    this.lines.forEach((l, i) => {
      const y = y0 + i * 9;
      if (y < -8 || y > H) return;
      if (l.code) {
        const cols = colorize(l.s);
        for (let k = 0; k < l.s.length && k < 37; k++) text(l.s[k], 6 + k * CW, y, cols[k]);
      } else textCenter(l.s, 96, y, l.c);
    });
    if (this.scroll > this.lines.length * 9 + 40) {
      drawSprite('wait16', 88, 90, { marks: markCount() });
      ditherRect(0, 0, W, 4, 0);
    }
  }
}

export function wrapLines(s: string, cols = 33) { return wrap(s, cols).map((x) => ({ s: x })); }
