// The splash, the title, file select, and naming the hero.
import { box, rect, blitUI, ditherRect } from '../engine/gfx';
import { drawText, textWidth, centerX, LINE_H } from '../engine/font';
import { C, PX } from '../engine/palette';
import { H, W, buf } from '../engine/screen';
import { BAYER } from '../engine/light';
import { pressed, repeat, takeTyped, clearTyped, setTextMode } from '../engine/input';
import { icon, charImgs } from './art';
import { sfx, playMusic } from '../audio';
import { slotInfo, formatTime, load, setState, newState, deleteSave, exportSave, importSave, G } from './state';

export type TitleResult = { kind: 'load'; slot: number } | { kind: 'new'; slot: number; name: string } | { kind: 'versus' };

/** Big block letters drawn at one pixel per pixel, 9 wide and 13 tall. */
const BIG: Record<string, string[]> = {
  G: ['.#######.', '##.....##', '##.......', '##.......', '##..#####', '##.....##', '.#######.'],
  N: ['##.....##', '###....##', '##.#...##', '##..#..##', '##...#.##', '##....###', '##.....##'],
  O: ['.#######.', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '.#######.'],
  M: ['##.....##', '###...###', '##.#.#.##', '##..#..##', '##.....##', '##.....##', '##.....##'],
};

function bigText(s: string, x: number, y: number, color: number, leadLen: number) {
  let cx = x;
  for (const ch of s) {
    const g = BIG[ch];
    if (!g) { cx += 6; continue; }
    // Each row is drawn twice tall, so letters are 14 pixels high from 7 rows of art.
    for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) {
      if (g[r][c] !== '#') continue;
      for (let k = 0; k < 2; k++) {
        const px = cx + c, py = y + r * 2 + k;
        // The title's own lead lies behind it first.
        for (let l = 1; l <= leadLen; l++) {
          const lx = px + l, ly = py + Math.round(l * 0.18);
          if (lx < W && ly < H && BAYER[((ly & 3) << 2) | (lx & 3)] + 0.5 < 0.9 - l / (leadLen + 4)) buf[ly * W + lx] = PX[C.plum0];
        }
      }
    }
    cx += 11;
  }
  cx = x;
  for (const ch of s) {
    const g = BIG[ch];
    if (!g) { cx += 6; continue; }
    for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === '#') { rect(cx + c, y + r * 2, 1, 2, color); }
    cx += 11;
  }
}

export class Splash {
  t = 0;
  done = false;
  update(dt: number) {
    this.t += dt;
    if (this.t > 3.2 || (this.t > 0.4 && (pressed('a') || pressed('b')))) this.done = true;
  }
  render() {
    rect(0, 0, W, H, C.black);
    const a = Math.min(1, this.t / 0.8);
    // A low sun on a horizon and a long lead running away from it.
    const hy = 104;
    rect(40, hy, 112, 1, C.slate);
    const sunX = 52;
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 25 && y <= 0) rect(sunX + x, hy + y, 1, 1, C.gold2);
    rect(96, hy - 12, 2, 12, C.pale);
    for (let l = 0; l < 52 * a; l++) for (let k = 0; k < 2; k++) {
      const x = 98 + l, y = hy + 1 + k;
      if (BAYER[((y & 3) << 2) | (x & 3)] + 0.5 < 1 - l / 60) rect(x, y, 1, 1, C.plum1);
    }
    const name = 'LOWSUN';
    drawText(name, centerX(name, W / 2), hy + 16, C.gold3);
    const sub = 'entertainment';
    drawText(sub, centerX(sub, W / 2), hy + 27, C.slate);
    const out = this.t > 2.6 ? (this.t - 2.6) / 0.6 : 0;
    fadeAll(1 - a + out);
  }
}

function fadeAll(t: number) {
  if (t <= 0) return;
  const p = PX[C.black];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (BAYER[((y & 3) << 2) | (x & 3)] + 0.5 < t) buf[y * W + x] = p;
}

type Page = 'main' | 'files' | 'slot' | 'name' | 'confirm';

export class Title {
  t = 0;
  page: Page = 'main';
  cur = 0;
  slot = 1;
  slotCur = 0;
  newGame = false;
  name = '';
  keyX = 0;
  keyY = 0;
  result: TitleResult | null = null;
  msg = '';
  private started = false;

  update(dt: number) {
    this.t += dt;
    if (!this.started) { this.started = true; playMusic('title'); }
    if (this.page === 'main') this.updateMain();
    else if (this.page === 'files') this.updateFiles();
    else if (this.page === 'slot') this.updateSlot();
    else if (this.page === 'name') this.updateName();
  }

  mainOpts(): string[] {
    const any = [1, 2, 3].some((s) => slotInfo(s));
    return any ? ['Continue', 'New game', 'Sticks for two'] : ['New game', 'Sticks for two'];
  }

  updateMain() {
    const opts = this.mainOpts();
    if (repeat('up')) { this.cur = (this.cur + opts.length - 1) % opts.length; sfx('menu_move'); }
    if (repeat('down')) { this.cur = (this.cur + 1) % opts.length; sfx('menu_move'); }
    if (pressed('a')) {
      const o = opts[this.cur];
      sfx('menu_ok');
      if (o === 'Sticks for two') { this.result = { kind: 'versus' }; return; }
      this.newGame = o === 'New game';
      this.page = 'files';
      this.slotCur = 0;
    }
  }

  updateFiles() {
    if (repeat('up')) { this.slotCur = (this.slotCur + 2) % 3; sfx('menu_move'); }
    if (repeat('down')) { this.slotCur = (this.slotCur + 1) % 3; sfx('menu_move'); }
    if (pressed('b')) { this.page = 'main'; sfx('menu_back'); return; }
    if (pressed('a')) {
      this.slot = this.slotCur + 1;
      const info = slotInfo(this.slot);
      sfx('menu_ok');
      if (this.newGame && !info) { this.startName(); return; }
      this.page = 'slot';
      this.cur = 0;
    }
  }

  slotOpts(): string[] {
    const info = slotInfo(this.slot);
    if (!info) return this.newGame ? ['Start here', 'Import file', 'Back'] : ['Import file', 'Back'];
    return this.newGame ? ['Start over here', 'Back'] : ['Play', 'Export file', 'Import file', 'Erase', 'Back'];
  }

  updateSlot() {
    const opts = this.slotOpts();
    if (repeat('up')) { this.cur = (this.cur + opts.length - 1) % opts.length; sfx('menu_move'); }
    if (repeat('down')) { this.cur = (this.cur + 1) % opts.length; sfx('menu_move'); }
    if (pressed('b')) { this.page = 'files'; sfx('menu_back'); return; }
    if (pressed('a')) {
      const o = opts[this.cur];
      sfx('menu_ok');
      if (o === 'Back') { this.page = 'files'; return; }
      if (o === 'Play') { this.result = { kind: 'load', slot: this.slot }; return; }
      if (o === 'Start here' || o === 'Start over here') { this.startName(); return; }
      if (o === 'Export file') { exportSave(this.slot); this.msg = 'Exported.'; return; }
      if (o === 'Import file') { importSave(this.slot, (ok) => { this.msg = ok ? 'Imported.' : 'That file did not load.'; this.page = 'files'; }); return; }
      if (o === 'Erase') { deleteSave(this.slot); this.msg = 'Erased.'; this.page = 'files'; }
    }
  }

  startName() { this.page = 'name'; this.name = 'Nodus'; this.keyX = 0; this.keyY = 0; clearTyped(); setTextMode(true); }

  static KEYS = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', '-\' .!?      '];

  updateName() {
    for (const ch of takeTyped()) {
      if (ch === '\b') this.name = this.name.slice(0, -1);
      else if (ch === '\n') { this.finishName(); return; }
      else if (/[A-Za-z0-9 '\-.]/.test(ch) && this.name.length < 8) this.name += ch;
    }
    const rows = Title.KEYS.length + 1;
    if (repeat('up')) { this.keyY = (this.keyY + rows - 1) % rows; sfx('menu_move'); }
    if (repeat('down')) { this.keyY = (this.keyY + 1) % rows; sfx('menu_move'); }
    if (repeat('left')) { this.keyX = (this.keyX + 12) % 13; sfx('menu_move'); }
    if (repeat('right')) { this.keyX = (this.keyX + 1) % 13; sfx('menu_move'); }
    if (pressed('b')) { if (this.name.length) this.name = this.name.slice(0, -1); else { this.page = 'files'; setTextMode(false); } sfx('menu_back'); return; }
    if (pressed('a')) {
      if (this.keyY === Title.KEYS.length) {
        if (this.keyX < 4) this.name = this.name.slice(0, -1);
        else this.finishName();
        return;
      }
      const ch = Title.KEYS[this.keyY][this.keyX];
      if (ch && ch !== ' ' || (ch === ' ' && this.keyX === 2)) { if (this.name.length < 8) { this.name += ch; sfx('menu_ok'); } }
    }
  }

  finishName() {
    const n = this.name.trim();
    if (!n) { sfx('menu_bad'); return; }
    sfx('menu_ok');
    setTextMode(false);
    this.result = { kind: 'new', slot: this.slot, name: n };
  }

  render() {
    rect(0, 0, W, H, C.black);
    // A low sun, a horizon, and a gnomon pin whose lead runs across the screen.
    const hy = 120;
    for (let y = hy; y < H; y++) ditherRect(0, y, W, 1, C.plum0, C.umber0, Math.min(1, (y - hy) / 70));
    for (let y = -14; y <= 0; y++) for (let x = -14; x <= 14; x++) if (x * x + y * y <= 196) rect(22 + x, hy + y, 1, 1, y > -5 ? C.gold3 : C.gold2);
    rect(0, hy, W, 1, C.gold1);
    rect(70, hy - 30, 2, 30, C.pale);
    for (let l = 0; l < 120; l++) for (let k = 0; k < 2; k++) {
      const x = 72 + l, y = hy + 1 + k + Math.round(l * 0.1);
      if (y < H && BAYER[((y & 3) << 2) | (x & 3)] + 0.5 < 1 - l / 140) rect(x, y, 1, 1, C.black);
    }
    bigText('GNOMON', 30, 40, C.gold3, 10);
    if (this.page === 'main') {
      const opts = this.mainOpts();
      opts.forEach((o, i) => {
        const y = 134 + i * (LINE_H + 2);
        if (i === this.cur) blitUI(icon('cursor'), 70, y);
        drawText(o, 80, y, i === this.cur ? C.white : C.gray);
      });
      drawText('Arrows, Z, X', 4, H - 10, C.slate);
    } else if (this.page === 'files' || this.page === 'slot') this.renderFiles();
    else if (this.page === 'name') this.renderName();
    if (this.msg) drawText(this.msg, W - 4 - textWidth(this.msg), H - 10, C.gold3);
    if (this.t < 0.6) fadeAll(1 - this.t / 0.6);
  }

  renderFiles() {
    box(20, 70, W - 40, 3 * 22 + 6, C.ink, C.gold2);
    for (let s = 1; s <= 3; s++) {
      const y = 74 + (s - 1) * 22;
      const info = slotInfo(s);
      if (s - 1 === this.slotCur) blitUI(icon('cursor'), 24, y + 5);
      if (info) {
        blitUI(charImgs('nodus').down[0], 34, y + 2);
        drawText(`File ${s}  ${info.name}`, 46, y + 1, s - 1 === this.slotCur ? C.white : C.gray);
        drawText(`Chapter ${info.chapter}  ${formatTime(info.playtime)}`, 46, y + 11, C.pale);
      } else drawText(`File ${s}  empty`, 46, y + 5, s - 1 === this.slotCur ? C.white : C.slate);
    }
    if (this.page === 'slot') {
      const opts = this.slotOpts();
      const w = 96, h = opts.length * (LINE_H + 1) + 6;
      box(W - w - 10, 146 - h / 2, w, h, C.ink, C.gold2);
      opts.forEach((o, i) => {
        const y = 146 - h / 2 + 3 + i * (LINE_H + 1);
        if (i === this.cur) blitUI(icon('cursor'), W - w - 7, y);
        drawText(o, W - w + 2, y, i === this.cur ? C.white : C.gray);
      });
    }
  }

  renderName() {
    box(14, 50, W - 28, 128, C.ink, C.gold2);
    drawText('What is your name?', 20, 54, C.gold3);
    rect(20, 76, 60, 1, C.gray);
    drawText(this.name, 20, 66, C.white);
    if (Math.floor(this.t * 2) % 2 === 0) rect(20 + textWidth(this.name) + 1, 66, 1, 8, C.white);
    blitUI(charImgs('nodus').down[0], W - 34, 64);
    Title.KEYS.forEach((row, ry) => {
      for (let cx = 0; cx < row.length; cx++) {
        const ch = row[cx];
        const x = 22 + cx * 11, y = 86 + ry * 12;
        const on = ry === this.keyY && cx === this.keyX;
        if (on) rect(x - 2, y - 2, 9, 11, C.plum1);
        drawText(ch === ' ' && cx === 2 ? '_' : ch, x, y, on ? C.white : C.pale);
      }
    });
    const by = 86 + Title.KEYS.length * 12;
    const delOn = this.keyY === Title.KEYS.length && this.keyX < 4;
    const okOn = this.keyY === Title.KEYS.length && this.keyX >= 4;
    if (delOn) rect(20, by - 2, 30, 11, C.plum1);
    if (okOn) rect(118, by - 2, 30, 11, C.plum1);
    drawText('Back', 22, by, C.pale);
    drawText('Done', 120, by, C.gold3);
  }
}

export function beginGame(r: TitleResult) {
  if (r.kind === 'load') { const g = load(r.slot); if (g) setState(g); }
  else if (r.kind === 'new') setState(newState(r.slot, r.name));
  return G;
}
