import { input } from '../engine/input';
import { sfx } from '../engine/audio';
import { dither, frame, rect, INK } from '../engine/screen';
import { text, textCenter, textRight, textWidth } from '../engine/font';
import { drawSprite, PEOPLE } from '../engine/sprites';
import { close, run, type Mode } from './modes';
import type { Mon, SpriteData } from '../battle/model';
import { choose } from './dialogue';
import { HERO, SLOTS, slotInfo } from './state';
import { drawNight, nightFrame } from './title';
import { box, DIM, PAPER, PORTRAIT_BG, SEL, WARN } from './ui';

/** Both screens sit on the title's night scene, dimmed, and come up out of black over their first frames. */
const FADE = 12;
const backdrop = () => drawNight(nightFrame(), { dim: 0.45, figures: false });
const fadeIn = (t: number) => { if (t < FADE) dither(0, 0, 192, 192, INK, 1 - t / FADE); };

/** The file screen: picks a slot to continue from or to start a new game in. Closes with the slot number, or null on back. */
export class FileSelect implements Mode {
  opaque = true;
  i = 0;
  info = Array.from({ length: SLOTS }, (_, n) => slotInfo(n + 1));
  /** Set while asking whether to start over in a slot that holds a save. */
  confirm: { yes: boolean } | null = null;

  constructor(public purpose: 'load' | 'new') {
    if (purpose === 'load') this.i = Math.max(0, this.info.findIndex(s => s));
    else { const empty = this.info.findIndex(s => !s); this.i = empty >= 0 ? empty : 0; }
  }

  usable(n: number): boolean { return this.purpose === 'new' || !!this.info[n]; }

  t = 0;

  update(): void {
    this.t++;
    if (this.confirm) {
      if (input.hit('left') || input.hit('right') || input.hit('up') || input.hit('down')) { this.confirm.yes = !this.confirm.yes; sfx('move'); }
      if (input.hit('back')) { this.confirm = null; sfx('back'); return; }
      if (input.hit('ok')) {
        if (this.confirm.yes) { sfx('ok'); close(this, this.i + 1); } else { sfx('back'); this.confirm = null; }
      }
      return;
    }
    const step = (d: number) => {
      for (let k = 1; k <= SLOTS; k++) { const n = (this.i + d * k + SLOTS * 2) % SLOTS; if (this.usable(n)) { this.i = n; sfx('move'); return; } }
    };
    if (input.hit('up')) step(-1);
    if (input.hit('down')) step(1);
    if (input.hit('back')) { sfx('back'); close(this, null); return; }
    if (input.hit('ok') && this.usable(this.i)) {
      if (this.purpose === 'new' && this.info[this.i]) { this.confirm = { yes: false }; sfx('move'); return; }
      sfx('ok');
      close(this, this.i + 1);
    }
  }

  draw(): void {
    backdrop();
    textCenter(this.purpose === 'load' ? 'Continue which file?' : 'Start a new game in which file?', 96, 10, PAPER, INK);
    for (let n = 0; n < SLOTS; n++) {
      // The cards slide in from the right one after another as the screen comes up.
      const x = 8 + Math.max(0, 14 + n * 4 - this.t) ** 2;
      const y = 26 + n * 44, s = this.info[n], on = n === this.i;
      box(x, y, 176, 38, on ? SEL : this.usable(n) ? DIM : '#3a3442');
      if (on) rect(x + 1, y + 1, 2, 36, SEL);
      text(`File ${n + 1}`, x + 6, y + 5, on ? SEL : DIM);
      if (!s) { text('Empty', x + 6, y + 18, this.usable(n) ? PAPER : DIM); continue; }
      if (s.lead) drawSprite(s.lead.sprite, x + 142, y + 10 - (on && Math.floor(this.t / 20) % 2 ? 2 : 0), 2);
      text(s.name, x + 6, y + 16, PAPER);
      text(s.where, x + 6, y + 26, DIM);
      const h = Math.floor(s.time / 3600), m = Math.floor((s.time % 3600) / 60);
      textRight(`${h}:${String(m).padStart(2, '0')}`, x + 132, y + 5, DIM);
    }
    if (this.confirm) {
      box(20, 70, 152, 52, WARN);
      textCenter(`Start over in file ${this.i + 1}?`, 96, 78, PAPER);
      textCenter('Its save will be lost.', 96, 89, DIM);
      textCenter('No', 70, 104, this.confirm.yes ? DIM : SEL);
      textCenter('Yes', 122, 104, this.confirm.yes ? SEL : DIM);
      return;
    }
    textCenter('Z picks. Arrows move. X goes back.', 96, 178, DIM, INK);
    fadeIn(this.t);
  }
}

const MAX = 8;
const PAGES: { label: string; rows: string[] }[] = [
  { label: 'ABC', rows: ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ '] },
  { label: 'abc', rows: ['abcdefghi', 'jklmnopqr', 'stuvwxyz '] },
  { label: '123', rows: ['123456789', "0.'-!?&~ ", '()+=*/#% '] },
];
const COLS = 9, CELL_W = 18, CELL_H = 15, GX = 15, GY = 82;
const BUTTONS = ['page', 'Del', 'Done'] as const;

/** The name screen's letter grid: three pages of keys over a row of page, Del, and Done buttons. */
export class LetterGrid {
  page = 0;
  /** Cursor column and row. Row 3 is the button row, where columns 0-2, 3-5, and 6-8 are its three buttons. */
  cx = 0;
  cy = 0;
  constructor(readonly gy = GY, readonly doneLabel = 'Done') {}

  move(): void {
    if (input.hit('left')) { this.cx = this.cy === 3 ? (Math.floor(this.cx / 3) + 2) % 3 * 3 + 1 : (this.cx + COLS - 1) % COLS; sfx('move'); }
    if (input.hit('right')) { this.cx = this.cy === 3 ? (Math.floor(this.cx / 3) + 1) % 3 * 3 + 1 : (this.cx + 1) % COLS; sfx('move'); }
    if (input.hit('up')) { this.cy = (this.cy + 3) % 4; sfx('move'); }
    if (input.hit('down')) { this.cy = (this.cy + 1) % 4; sfx('move'); }
  }

  toDone(): void { this.cy = 3; this.cx = 7; }

  /** The key under the cursor when ok is pressed: a character, 'del', or 'done'. The page button turns the page and gives null. */
  press(): string | null {
    if (this.cy !== 3) return PAGES[this.page].rows[this.cy][this.cx];
    const b = BUTTONS[Math.floor(this.cx / 3)];
    if (b === 'page') { this.page = (this.page + 1) % PAGES.length; sfx('switch'); return null; }
    return b === 'Del' ? 'del' : 'done';
  }

  draw(): void {
    const gy = this.gy, by = gy + 3 * CELL_H + 8;
    box(GX - 6, gy - 6, COLS * CELL_W + 12, 3 * CELL_H + 30, DIM);
    const rows = PAGES[this.page].rows;
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
      const x = GX + c * CELL_W, y = gy + r * CELL_H, on = this.cy === r && this.cx === c;
      if (on) rect(x - 2, y - 3, CELL_W - 2, CELL_H - 1, '#2e2a3a');
      if (ch === ' ') rect(x + 3, y + 6, 6, 1, on ? SEL : DIM);
      else text(ch, x + Math.round((CELL_W - 4 - textWidth(ch)) / 2), y, on ? SEL : PAPER);
    }));
    BUTTONS.forEach((b, k) => {
      const x = GX + k * 3 * CELL_W, on = this.cy === 3 && Math.floor(this.cx / 3) === k;
      const label = b === 'page' ? PAGES[(this.page + 1) % PAGES.length].label : b === 'Done' ? this.doneLabel : b;
      if (on) rect(x - 2, by - 3, 3 * CELL_W - 4, CELL_H - 1, '#2e2a3a');
      textCenter(label, x + 3 * CELL_W / 2 - 3, by, on ? SEL : b === 'Done' ? PAPER : DIM);
    });
  }
}

/** Name entry on a letter grid. Closes with the name, or null when backed out with an empty name. */
/** What the name screen asks, whose picture it shows, and the name an empty entry keeps. Defaults name Ouro. */
export interface NameOpts { title?: string; sprite?: SpriteData; fallback?: string; start?: string }

export class NameEntry implements Mode {
  opaque = true;
  name = '';
  grid = new LetterGrid();
  t = 0;
  title: string;
  sprite: SpriteData;
  fallback: string;

  constructor(o: NameOpts = {}) {
    this.title = o.title ?? 'What is your name?';
    this.sprite = o.sprite ?? PEOPLE.vellum;
    this.fallback = o.fallback ?? HERO;
    this.name = (o.start ?? '').slice(0, MAX);
    if (this.name) this.grid.page = 1;
  }

  update(): void {
    this.t++;
    const g = this.grid;
    g.move();
    if (input.hit('menu')) { g.toDone(); sfx('move'); }
    if (input.hit('back')) {
      if (!this.name) { sfx('back'); close(this, null); return; }
      this.name = this.name.slice(0, -1); sfx('back');
    }
    if (!input.hit('ok')) return;
    const ch = g.press();
    if (ch === null) return;
    if (ch === 'del') { if (this.name) { this.name = this.name.slice(0, -1); sfx('back'); } return; }
    if (ch === 'done') { sfx('ok'); close(this, this.name.trim() || this.fallback); return; }
    if (this.name.length >= MAX || (ch === ' ' && (!this.name || this.name.endsWith(' ')))) { sfx('bump'); return; }
    this.name += ch;
    sfx('blip');
    // A capital first letter is usual, so the grid drops to lowercase after it, as name screens often do.
    if (this.name.length === 1 && g.page === 0) g.page = 1;
    if (this.name.length >= MAX) g.toDone();
  }

  draw(): void {
    backdrop();
    textCenter(this.title, 96, 10, PAPER, INK);
    frame(26, 24, 32, 32, PORTRAIT_BG, DIM);
    drawSprite(this.sprite, 30, 28, 3);
    // The name field: one slot per letter, with the default name shown faintly while it is empty.
    const fx = 66, fy = 44;
    for (let k = 0; k < MAX; k++) rect(fx + k * 12, fy + 10, 9, 1, k < this.name.length ? PAPER : DIM);
    const slotText = (s: string, c: string) => [...s].forEach((ch, k) => text(ch, fx + k * 12 + Math.round((9 - textWidth(ch)) / 2), fy, c));
    if (this.name) slotText(this.name, PAPER);
    else if (this.fallback.length <= MAX) slotText(this.fallback, '#5a5468');
    else text(this.fallback, fx, fy, '#5a5468');
    if (this.name.length < MAX && (this.t >> 4) % 2) rect(fx + this.name.length * 12, fy - 1, 1, 9, SEL);
    this.grid.draw();
    rect(0, 168, 192, 1, INK);
    textCenter('Z types. X deletes. V jumps to Done.', 96, 172, DIM);
    textCenter(`Empty keeps the name ${this.fallback}.`, 96, 182, DIM);
    fadeIn(this.t);
  }
}

/** Opens the name screen for a whorl. An empty name gives back the name it had before it was first renamed. */
export async function renameMon(m: Mon): Promise<void> {
  const base = m.baseName ?? m.name;
  const n = await run<string | null>(new NameEntry({ title: 'What will you call it?', sprite: m.sprite, fallback: base, start: m.name === base ? '' : m.name }));
  if (n === null) return;
  if (n !== base) m.baseName = base;
  m.name = n;
}

/** Asks whether to name a whorl that just joined, and opens the name screen on a yes. */
export async function offerName(m: Mon): Promise<void> {
  if (await choose(['Yes', 'No'], true, `Give ${m.name} a name?`) === 0) await renameMon(m);
}
