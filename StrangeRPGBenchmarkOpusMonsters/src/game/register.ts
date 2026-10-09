// The Register: the Strandmonger's book of every kind, drawn as an open book with a page for each kind.
import type { SpriteData } from '../battle/model';
import { SPECIES, WILD_KINDS } from '../data/species';
import { TYPE_COLOR, TYPES, type Type } from '../data/types';
import { STAT_ORDER, shapeOf } from '../data/profiles';
import { bigText, text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { ctx, dither, mix, rect } from '../engine/screen';
import { drawSprite, lightMap } from '../engine/sprites';
import { sfx } from '../engine/audio';
import { close, run, type Mode } from './modes';
import { G } from './state';
import { sigil, typeName } from './ui';
import { homesOf, listMenu, monPage, registerMon, starMark } from './menus';
import { playKindCry } from './cries';
import { GUIDE } from '../content/guide';
import { CONTENTS_LEFT, drawContents, drawSheet, layout, type Book, type Sheet } from './guide';

// Paper, ink, and binding.
const DESK = '#0b0a10', DESK2 = '#17121f';
const COVER = '#3a2232', COVER_HI = '#5c3648', COVER_LO = '#24131e', STITCH = '#b48c58';
const PAPER = '#e6dbbf', PAPER_SH = '#cdbd99', EDGE = '#b5a27e', EDGE_LO = '#8c7a5c';
const INK = '#2c2236', PENCIL = '#8c7d66', FAINT = '#b0a186';
const RED = '#a8423a', BLUE = '#3c5a92', PLATE = '#d8c9a5';

const LX = 7, RX = 97, PW = 88, PY = 14, PH = 168;
const COLS = 4, ROWS = 7, PER_PAGE = COLS * ROWS, PER_SPREAD = PER_PAGE * 2;
const CW = 20, CH = 20, GX = 4, GY = 13;

/** Every kind in the book's order. */
export function registerKinds(): string[] { return WILD_KINDS.concat(['full', 'mundane', 'knot', 'carcanet']); }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A small spiral in pencil where an unseen kind will go: points along an opening curve, every other one drawn. */
const SPIRAL: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const seen = new Set<string>();
  for (let a = 0; a < Math.PI * 5; a += 0.05) {
    const r = 0.6 + a * 0.42;
    const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * 0.9);
    const k = x + ',' + y;
    if (!seen.has(k)) { seen.add(k); pts.push([x, y]); }
  }
  return pts.filter((_, i) => i % 2 === 0);
})();

function spiral(cx: number, cy: number, c: string): void {
  ctx.fillStyle = c;
  for (const [x, y] of SPIRAL) ctx.fillRect(cx + x, cy + y, 1, 1);
}

// ---------------------------------------------------------------- the lit plate

const plates = new Map<string, HTMLCanvasElement>();
/** Light on the plate comes from the lamp at its upper left, toward the reader: x right, f toward the viewer, z up. */
const L = (() => { const v = [-0.55, 0.62, 0.56], n = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / n); })();

/**
 * A kind's sprite large and lit the way the field lights figures: each pixel takes its surface direction from the
 * sprite's light map, and an ordered dither mixes its lit and unlit hue by how much it faces the lamp. A kind only seen
 * is a dark shape with a rim where the lamp catches its edge.
 */
function plate(s: SpriteData, scale: number, sounded: boolean): HTMLCanvasElement {
  const key = s.px.join('') + s.c.join('') + scale + (sounded ? 's' : 'h');
  let cv = plates.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = 8 * scale;
  const g = cv.getContext('2d')!;
  const m = lightMap(s, false);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = y * 8 + x, ch = s.px[y]?.[x];
    if (!m.solid[i] || !ch || ch === '.') continue;
    const face = Math.max(0, m.nx[i] * L[0] + m.nf[i] * L[1] + m.nz[i] * L[2]);
    let lit: string, dim: string, level: number;
    if (sounded) {
      const base = ch === '1' ? '#1a1420' : ch === '2' ? s.c[0] : ch === '4' ? s.c[2] || s.c[1] : s.c[1];
      lit = face > 0.9 && ch !== '1' ? mix(base, '#fff6de', 0.3) : base;
      dim = mix(base, '#2a2038', ch === '1' ? 0.2 : 0.5);
      level = Math.min(1, 0.22 + face);
    } else {
      dim = '#3a3046';
      lit = '#8e8096';
      level = m.nx[i] < -0.3 || m.nz[i] > 0.55 ? Math.max(0, face - 0.45) * 1.6 : 0;
    }
    for (let v = 0; v < scale; v++) for (let u = 0; u < scale; u++) {
      const px = x * scale + u, py = y * scale + v;
      g.fillStyle = BAYER[(px & 3) + (py & 3) * 4] < level * 16 ? lit : dim;
      g.fillRect(px, py, 1, 1);
    }
  }
  if (plates.size > 60) plates.clear();
  plates.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------- the book

/** The kinds' grid and pages, and at the front of the book the Guide's contents and chapters. */
type View = 'grid' | 'kind' | 'contents' | 'chapter';

/** The Guide's text column starts this far into a page, and its lines run between these heights. */
const G_IN = 6, G_TOP = PY + 5, G_BOTTOM = PY + PH - 14;
/** A chapter lies on one sheet over both pages: its column's left edge and width. */
const SHEET_X = LX + 8, SHEET_W = RX + PW - LX - 18;

class RegisterBook implements Mode {
  opaque = true;
  all = registerKinds();
  /** Each kind's number in the book. */
  no = new Map(this.all.map((k, i) => [k, i + 1]));
  list: string[] = [];
  i = 0;
  view: View = 'grid';
  type: Type | null = null;
  area: string | null = null;
  t = 0;
  /** Frames left of a page turn, which way it goes, and the screen as it was before it. */
  flip = 0;
  flipDir = 1;
  snap: HTMLCanvasElement | null = null;
  fresh: HTMLCanvasElement | null = null;
  cryT = 0;
  scroll = 0;
  /** The number slip: which digit is picked and the digits, while it is open. */
  slip: { at: number; d: number[] } | null = null;
  busy = false;
  /** The Guide: the chapter picked on the contents, the open chapter's sheet, and how far it is scrolled. */
  gSel = 0;
  gSheet: Sheet | null = null;
  gScroll = 0;
  constructor() { this.refilter(); }

  refilter(): void {
    const reg = G.register;
    this.list = this.all.filter(k => {
      if (this.type && !(reg[k] && SPECIES[k].types.includes(this.type))) return false;
      if (this.area && !homesOf(k).includes(this.area)) return false;
      return true;
    });
    this.i = Math.min(this.i, Math.max(0, this.list.length - 1));
  }

  /** Starts a page turn: the screen as it is now turns away. `dir` 1 turns forward, -1 back. */
  turn(dir: number): void {
    const cv = ctx.canvas as HTMLCanvasElement;
    if (!this.snap) { this.snap = document.createElement('canvas'); this.snap.width = cv.width; this.snap.height = cv.height; }
    const g = this.snap.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(cv, 0, 0);
    this.flip = 10;
    this.flipDir = dir;
    this.scroll = 0;
    sfx('page');
  }

  spreadOf(i: number): number { return Math.floor(i / PER_SPREAD); }

  update(): void {
    this.t++;
    if (this.cryT > 0) this.cryT--;
    if (this.flip > 0) this.flip--;
    if (this.busy) return;
    if (this.slip) { this.updateSlip(); return; }
    if (this.view === 'grid') this.updateGrid();
    else if (this.view === 'kind') this.updateKind();
    else if (this.view === 'contents') this.updateContents();
    else this.updateChapter();
  }

  updateGrid(): void {
    const n = this.list.length, i = this.i;
    const cell = i % PER_PAGE, col = cell % COLS, row = Math.floor(cell / COLS), page = Math.floor((i % PER_SPREAD) / PER_PAGE);
    // The Guide sits in front of the first page.
    if (input.hit('left') && col === 0 && page === 0 && this.spreadOf(i) === 0) { this.turn(-1); this.view = 'contents'; return; }
    let to = i;
    if (input.hit('right')) to = col < COLS - 1 ? i + 1 : page === 0 ? i + PER_PAGE - (COLS - 1) : (this.spreadOf(i) + 1) * PER_SPREAD + row * COLS;
    else if (input.hit('left')) to = col > 0 ? i - 1 : page === 1 ? i - PER_PAGE + (COLS - 1) : (this.spreadOf(i) - 1) * PER_SPREAD + PER_PAGE + row * COLS + COLS - 1;
    else if (input.hit('down') && row < ROWS - 1) to = i + COLS;
    else if (input.hit('up') && row > 0) to = i - COLS;
    if (to !== i && n) {
      // Past the last kind: turn to the last page if it is a later spread, otherwise stay put.
      if (to >= n) to = this.spreadOf(to) > this.spreadOf(i) && this.spreadOf(n - 1) > this.spreadOf(i) ? n - 1 : i;
      if (to < 0) to = i;
      if (to !== i) {
        if (this.spreadOf(to) !== this.spreadOf(i)) this.turn(to > i ? 1 : -1); else sfx('move');
        this.i = to;
      }
    }
    if (input.hit('ok') && n) {
      const k = this.list[this.i];
      if (G.register[k]) { this.turn(1); this.view = 'kind'; }
      else sfx('back');
    } else if (input.hit('back')) { sfx('back'); close(this); }
    else if (input.hit('wear')) {
      const order: (Type | null)[] = [null, ...TYPES];
      this.type = order[(order.indexOf(this.type) + 1) % order.length];
      this.i = 0; this.refilter(); this.turn(1);
    } else if (input.hit('menu')) void this.pickArea();
    else if (input.hit('goal')) { sfx('ok'); const no = String(this.all.indexOf(this.list[this.i] ?? this.all[0]) + 1).padStart(3, '0'); this.slip = { at: 2, d: no.split('').map(Number) }; }
  }

  async pickArea(): Promise<void> {
    this.busy = true;
    const areas: string[] = [];
    for (const k of this.all) if (G.register[k]) for (const h of homesOf(k)) if (!areas.includes(h)) areas.push(h);
    const items = ['Everywhere', ...areas];
    const j = await listMenu('Where it lives', items, { x: 40, y: 20, w: 112, start: this.area ? items.indexOf(this.area) : 0 });
    this.busy = false;
    input.clear();
    if (j < 0) return;
    this.area = j === 0 ? null : items[j];
    this.i = 0; this.refilter(); this.turn(1);
  }

  /** The contents: up and down pick a chapter, left and right change page, Z opens a chapter met so far, X turns to the kinds. */
  updateContents(): void {
    const n = GUIDE.length;
    if (input.hit('up')) { this.gSel = (this.gSel + n - 1) % n; sfx('move'); }
    else if (input.hit('down')) { this.gSel = (this.gSel + 1) % n; sfx('move'); }
    else if (input.hit('left') || input.hit('right')) {
      this.gSel = this.gSel < CONTENTS_LEFT ? Math.min(n - 1, this.gSel + CONTENTS_LEFT) : this.gSel - CONTENTS_LEFT;
      sfx('move');
    } else if (input.hit('ok')) {
      if (!GUIDE[this.gSel].open()) { sfx('back'); return; }
      this.turn(1);
      this.openChapter(this.gSel);
    } else if (input.hit('back')) { this.turn(1); this.view = 'grid'; this.i = 0; }
  }

  openChapter(k: number): void {
    const ch = GUIDE[k];
    G.flags['guide:' + ch.id] = 1;
    this.gSel = k;
    this.gSheet = layout(ch, SHEET_W);
    this.gScroll = 0;
    this.view = 'chapter';
  }

  /** A chapter: up and down scroll it, left and right turn to the chapter before or after that is met so far, and X goes back to the contents. */
  updateChapter(): void {
    const max = Math.max(0, (this.gSheet?.height || 0) - (G_BOTTOM - G_TOP));
    if (input.hit('down')) { if (this.gScroll < max) { this.gScroll = Math.min(max, this.gScroll + 18); sfx('move'); } }
    else if (input.hit('up')) { if (this.gScroll > 0) { this.gScroll = Math.max(0, this.gScroll - 18); sfx('move'); } }
    else if (input.hit('left') || input.hit('right')) {
      const d = input.hit('left') ? -1 : 1;
      let k = this.gSel + d;
      while (k >= 0 && k < GUIDE.length && !GUIDE[k].open()) k += d;
      if (k < 0 || k >= GUIDE.length) { sfx('bump'); return; }
      this.turn(d);
      this.openChapter(k);
    } else if (input.hit('back')) { this.turn(-1); this.view = 'contents'; }
  }

  updateSlip(): void {
    const s = this.slip!;
    if (input.hit('left')) { s.at = (s.at + 2) % 3; sfx('move'); }
    if (input.hit('right')) { s.at = (s.at + 1) % 3; sfx('move'); }
    if (input.hit('up')) { s.d[s.at] = (s.d[s.at] + 1) % 10; sfx('move'); }
    if (input.hit('down')) { s.d[s.at] = (s.d[s.at] + 9) % 10; sfx('move'); }
    if (input.hit('back')) { sfx('back'); this.slip = null; return; }
    if (input.hit('ok')) {
      const no = Math.max(1, Math.min(this.all.length, s.d[0] * 100 + s.d[1] * 10 + s.d[2]));
      this.slip = null;
      this.type = null; this.area = null; this.refilter();
      const to = no - 1;
      if (this.spreadOf(to) !== this.spreadOf(this.i) || this.view !== 'grid') this.turn(to >= this.i ? 1 : -1); else sfx('ok');
      this.i = to;
      this.view = 'grid';
    }
  }

  updateKind(): void {
    const k = this.list[this.i];
    const step = (d: number) => {
      // Turning skips kinds not yet seen, since their pages are blank.
      let j = this.i + d;
      while (j >= 0 && j < this.list.length && !G.register[this.list[j]]) j += d;
      if (j < 0 || j >= this.list.length) return;
      this.turn(d); this.i = j;
    };
    if (input.hit('right')) step(1);
    else if (input.hit('left')) step(-1);
    else if (input.hit('down')) this.scroll += 9;
    else if (input.hit('up')) this.scroll = Math.max(0, this.scroll - 9);
    else if (input.hit('ok')) { this.cryT = 50; playKindCry(k); }
    else if (input.hit('wear') && G.register[k] === 2) {
      this.busy = true;
      sfx('ok');
      void monPage(registerMon(k), 'Shown at level 25.').then(() => { this.busy = false; input.clear(); });
    } else if (input.hit('back')) { this.turn(-1); this.view = 'grid'; }
  }

  // ------------------------------------------------------------ drawing

  draw(): void {
    rect(0, 0, 192, 192, DESK);
    dither(0, 0, 192, 192, DESK2, 0.25);
    this.drawBook();
    if (this.view === 'grid') this.drawGrid();
    else if (this.view === 'kind') this.drawKind();
    else this.drawGuide();
    if (this.view === 'grid' || this.view === 'kind') this.drawTabs();
    if (this.flip > 0) this.drawFlip();
    if (this.slip) this.drawSlip();
  }

  drawBook(): void {
    // Cover, with a lighter top edge and the spine down the middle.
    rect(3, 11, 186, 177, COVER_LO);
    rect(3, 11, 186, 175, COVER);
    rect(3, 11, 186, 1, COVER_HI);
    // The page block: stacked edges below each page, then the pages.
    for (const x of [LX, RX]) {
      rect(x + 1, PY + PH, PW - 2, 1, EDGE);
      rect(x + 2, PY + PH + 1, PW - 4, 1, EDGE_LO);
      rect(x, PY, PW, PH, PAPER);
    }
    // Shade where the pages curve into the binding.
    dither(LX + PW - 6, PY, 6, PH, PAPER_SH, 0.5);
    dither(LX + PW - 2, PY, 2, PH, PAPER_SH, 1);
    dither(RX, PY, 6, PH, PAPER_SH, 0.5);
    dither(RX, PY, 2, PH, PAPER_SH, 1);
    rect(LX + PW, PY - 1, RX - LX - PW, PH + 2, COVER_LO);
    // Stitches in the gutter.
    for (let y = PY + 6; y < PY + PH - 4; y += 12) rect(LX + PW, y, 2, 3, STITCH);
    // A ribbon from the top of the spine, hanging past the bottom edge.
    const rib = this.type ? TYPE_COLOR[this.type] : RED;
    rect(LX + PW + 4, PY, 2, PH + 4, rib);
    rect(LX + PW + 4, PY + PH + 4, 1, 1, rib);
  }

  /** The index tabs that stick out of the top edge: type, area, and the number slip, each with its key. */
  drawTabs(): void {
    // Each tab is as wide as its key and label, and the next starts just after it.
    const tab = (x: number, key: string, label: string, on: boolean, sig?: Type): number => {
      const kw = textWidth(key) + 4, w = kw + (sig ? 9 : 0) + textWidth(label) + 7;
      // The tab starts at the screen's top edge, so its text keeps a clear pixel above and below, descenders too.
      rect(x, 0, w, 12, on ? PAPER : PAPER_SH);
      rect(x, 0, w, 1, on ? '#f4ecd6' : PAPER);
      rect(x + 2, 2, kw, 8, INK);
      text(key, x + 4, 2, PAPER);
      let tx = x + kw + 4;
      if (sig) { sigil(sig, tx, 2, mix(TYPE_COLOR[sig], INK, 0.25)); tx += 9; }
      text(label, tx, 2, INK);
      return x + w + 3;
    };
    const area = this.area ? (this.area.length > 12 ? this.area.slice(0, 11).trimEnd() + '.' : this.area) : 'Everywhere';
    let x = tab(6, 'C', this.type ? typeName(this.type) : 'Any type', !!this.type, this.type || undefined);
    x = tab(x, 'V', area, !!this.area);
    tab(x, 'Tab', 'No.', !!this.slip);
  }

  drawGrid(): void {
    const reg = G.register;
    const got = this.all.filter(k => reg[k] === 2).length, seenN = this.all.filter(k => reg[k]).length;
    const sp = this.spreadOf(this.i);
    // Headers: the count of kinds sounded and seen, each with its stamp.
    stampDot(LX + 6, PY + 6, RED);
    text(`Sounded ${got}`, LX + 11, PY + 3, INK);
    stampDot(RX + 10, PY + 6, BLUE);
    text(`Seen ${seenN}`, RX + 15, PY + 3, INK);
    textRight(`/${this.all.length}`, RX + PW - 4, PY + 3, PENCIL);
    if (!this.list.length) {
      text('Nothing here', LX + 8, PY + 30, PENCIL);
      text('yet.', LX + 8, PY + 39, PENCIL);
    }
    for (let k = 0; k < PER_SPREAD; k++) {
      const idx = sp * PER_SPREAD + k;
      if (idx >= this.list.length) break;
      const kind = this.list[idx];
      const page = Math.floor(k / PER_PAGE), cell = k % PER_PAGE;
      const x = (page ? RX : LX) + GX + (cell % COLS) * CW, y = PY + GY + Math.floor(cell / COLS) * CH;
      // A dotted ruled line under each row, as in a ledger.
      if (cell % COLS === 0) for (let dx = 0; dx < COLS * CW; dx += 3) rect(x + dx, y + CH - 2, 1, 1, FAINT);
      const s = SPECIES[kind];
      if (reg[kind] === 2) drawSprite({ px: s.sprite, c: s.c }, x + 2, y + 1, 2);
      else if (reg[kind]) drawSprite({ px: s.sprite, c: s.c }, x + 2, y + 1, 2, false, '#4a3e52');
      else spiral(x + 9, y + 8, FAINT);
      if (idx === this.i) corners(x, y - 1, CW, CH, INK);
    }
    // Footer: the picked kind's number and name on its page, the page number on the other.
    const cur = this.list[this.i];
    const curPage = Math.floor((this.i % PER_SPREAD) / PER_PAGE);
    for (const page of [0, 1]) {
      const x0 = page ? RX : LX, fy = PY + PH - 10;
      let label = '';
      if (page === curPage && cur) {
        const name = reg[cur] ? SPECIES[cur].name : '?';
        label = `${String(this.no.get(cur)).padStart(3, '0')} ${name}`;
        textCenter(label, x0 + PW / 2, fy, reg[cur] ? INK : PENCIL);
      } else if (!(sp === 0 && page === 0)) textCenter(String(sp * 2 + page + 1), x0 + PW / 2, fy, PENCIL);
      // The first page points back to the Guide in front of it, when the picked kind's name leaves room.
      if (sp === 0 && page === 0) {
        if (!label) text('< Guide', x0 + 6, fy, PENCIL);
        else if (x0 + PW / 2 - textWidth(label) / 2 >= x0 + 17) { text('<', x0 + 3, fy, PENCIL); guideMark(x0 + 8, fy + 1); }
      }
    }
  }

  drawKind(): void {
    const k = this.list[this.i];
    if (!k) return;
    const s = SPECIES[k], st = G.register[k] || 0, sounded = st === 2;
    const no = this.no.get(k)!;
    // Left page: the plate, lit from its upper left, with a soft shadow under the figure.
    const px0 = LX + 6, py0 = PY + 8, pw = PW - 12, ph = 64;
    rect(px0, py0, pw, ph, INK);
    rect(px0 + 1, py0 + 1, pw - 2, ph - 2, PLATE);
    dither(px0 + 1, py0 + 1, pw - 2, ph - 2, PAPER_SH, 0.25);
    rect(px0 + 3, py0 + 3, pw - 6, 1, FAINT); rect(px0 + 3, py0 + ph - 4, pw - 6, 1, FAINT);
    rect(px0 + 3, py0 + 3, 1, ph - 6, FAINT); rect(px0 + pw - 4, py0 + 3, 1, ph - 6, FAINT);
    lamp(px0 + 7, py0 + 7);
    const scale = 6, sx = px0 + Math.round((pw - 8 * scale) / 2), sy = py0 + 7;
    const m = lightMap({ px: s.sprite, c: s.c }, false);
    let lo = 8, hi = -1;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) if (m.solid[y * 8 + x]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    const shw = Math.max(2, (hi - lo + 1)) * scale;
    // The lamp is up and to the left, so the shadow falls a little to the right of the feet.
    const mid = sx + (lo + hi + 1) * scale / 2 + 4, fy = sy + (m.foot + 1) * scale - 2;
    [0.95, 0.8, 0.5].forEach((k, r) => rect(Math.round(mid - shw * k / 2), fy + r, Math.round(shw * k), 1, mix(PLATE, EDGE_LO, 0.45)));
    ctx.drawImage(plate({ px: s.sprite, c: s.c }, scale, sounded), sx, sy);
    // Sound rings beside the plate while its cry plays.
    if (this.cryT > 0) {
      const age = 50 - this.cryT;
      for (let r = 0; r < 3; r++) if (age > r * 6 && age < 34 + r * 6) arc(sx + 8 * scale + 2 + r * 3, sy + 4 * scale, 4 + r * 3, PENCIL);
    }
    let y = py0 + ph + 4;
    stampBox(`No. ${String(no).padStart(3, '0')}`, LX + 6, y, sounded ? RED : BLUE);
    // A sounded kind's stat shape beside its number: seven bars from HP to CHA, each as tall as the stat against the even
    // spread, its best stat in red.
    if (sounded && s.profile) {
      const prof = s.profile, bx = LX + PW - 30, base = y + 13;
      const best = STAT_ORDER.reduce((a, key) => (prof[key] > prof[a] ? key : a), STAT_ORDER[0]);
      STAT_ORDER.forEach((key, j) => { const h = Math.max(2, Math.round(18 * (shapeOf(prof, key) - 0.6))); rect(bx + j * 4, base - h, 3, h, key === best ? RED : INK); });
      rect(bx - 1, base + 1, 29, 1, PENCIL);
    }
    y += 18;
    for (const t of s.types) {
      sigil(t, LX + 8, y + 1, mix(TYPE_COLOR[t], INK, 0.3));
      text(typeName(t), LX + 17, y, mix(TYPE_COLOR[t], INK, 0.45));
      y += 9;
    }
    if (G.flags['sb:' + k]) { starMark(LX + 7, y + 1, Math.floor(performance.now() / 16)); text('Starborn seen', LX + 15, y, PENCIL); y += 9; }
    if (sounded && s.archetype) { text(s.archetype, LX + 8, y, PENCIL); y += 9; }
    y += 3;
    const homes = homesOf(k);
    text('Lives', LX + 6, y, PENCIL);
    y += 9;
    if (!homes.length) { text('Nowhere wild.', LX + 8, y, INK); y += 8; }
    for (const h of homes.slice(0, 3)) for (const l of wrap(h, PW - 14)) { if (y < PY + PH - 22) text(l, LX + 8, y, INK); y += 8; }
    // The cry button, pressed in while the cry plays.
    const bx = LX + 6, by = PY + PH - 16, on = this.cryT > 34;
    rect(bx, by, 32, 11, on ? INK : PENCIL);
    rect(bx + 1, by + 1, 30, 9, on ? INK : PAPER);
    hornIcon(bx + 3, by + 3, on ? PAPER : INK);
    text('Cry', bx + 12, by + 2, on ? PAPER : INK);
    text('Z', bx + 35, by + 2, PENCIL);

    // Right page: the name, the Strandmonger's entry, and his stamp.
    const name = s.name;
    const big = textWidth(name) * 2 <= PW - 10;
    if (big) bigText(name, RX + 6, PY + 6, 2, INK); else text(name, RX + 6, PY + 9, INK);
    const uy = PY + (big ? 24 : 19);
    for (let x = RX + 6; x < RX + PW - 6; x++) if ((x + this.i) % 7 !== 3) rect(x, uy + ((x >> 2) & 1), 1, 1, PENCIL);
    const top = uy + 6, bottom = PY + PH - 32;
    if (sounded) {
      const lines = wrap(s.entry, PW - 12);
      const maxScroll = Math.max(0, lines.length * 9 - (bottom - top));
      if (this.scroll > maxScroll) this.scroll = maxScroll;
      lines.forEach((l, n) => { const ly = top + n * 9 - this.scroll; if (ly >= top - 1 && ly <= bottom - 8) text(l, RX + 6, ly, INK); });
      if (maxScroll > 0) {
        if (this.scroll > 0) for (let j = 0; j < 3; j++) rect(RX + PW - 6 - j, top - 3 + j, 1 + j * 2, 1, PENCIL);
        if (this.scroll < maxScroll) for (let j = 0; j < 3; j++) rect(RX + PW - 6 - j, bottom + 1 - j, 1 + j * 2, 1, PENCIL);
      }
      stampBox('SOUNDED', RX + PW - 56, PY + PH - 29, RED, true);
      text('C moves', RX + 6, PY + PH - 10, PENCIL);
    } else {
      text('Not sounded', RX + 6, top + 2, PENCIL);
      text('yet.', RX + 6, top + 11, PENCIL);
      for (let r = 0; r < 4; r++) for (let x = RX + 6; x < RX + PW - 8; x += 3) rect(x, top + 30 + r * 12, 1, 1, FAINT);
      stampBox('SEEN', RX + PW - 40, PY + PH - 29, BLUE, true);
    }
    textRight('<  >', RX + PW - 5, PY + PH - 10, PENCIL);
  }

  /** The Guide: the contents across both pages, or the open chapter on a loose sheet laid over them, scrolled. */
  drawGuide(): void {
    const book: Book = { INK, PENCIL, FAINT, RED, BLUE, PAPER, corners };
    const fy = PY + PH - 10;
    if (this.view === 'contents') {
      drawContents(this.gSel, LX + G_IN, RX + G_IN, G_TOP, book);
      text('Z opens', LX + G_IN, fy, PENCIL);
      textRight('X kinds', RX + PW - 5, fy, PENCIL);
      return;
    }
    const sh = this.gSheet;
    if (!sh) return;
    // The sheet covers the gutter, with a shadow along its right and bottom edges.
    rect(LX + 2, PY + 2, RX + PW - LX, PH, COVER_LO);
    rect(LX, PY, RX + PW - LX, PH, PAPER);
    rect(LX, PY, RX + PW - LX, 1, '#f4ecd6');
    drawSheet(sh, SHEET_X, G_TOP, G_BOTTOM, this.gScroll, book);
    const max = Math.max(0, sh.height - (G_BOTTOM - G_TOP));
    if (this.gScroll > 0) for (let j = 0; j < 3; j++) rect(RX + PW - 6 - j, G_TOP - 3 + j, 1 + j * 2, 1, PENCIL);
    if (this.gScroll < max) for (let j = 0; j < 3; j++) rect(RX + PW - 6 - j, G_BOTTOM + 3 - j, 1 + j * 2, 1, PENCIL);
    const open = GUIDE.filter(c => c.open()), at = open.indexOf(GUIDE[this.gSel]) + 1;
    text('X contents', SHEET_X, fy, PENCIL);
    textCenter(`${at} of ${open.length}`, LX + (RX + PW - LX) / 2, fy, PENCIL);
    textRight('<  >', RX + PW - 12, fy, PENCIL);
  }

  /** The page that turns: the old page folds into the spine, then the new page unfolds from it. */
  drawFlip(): void {
    const cv = ctx.canvas as HTMLCanvasElement;
    if (!this.fresh) { this.fresh = document.createElement('canvas'); this.fresh.width = cv.width; this.fresh.height = cv.height; }
    const g = this.fresh.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(cv, 0, 0);
    const old = this.snap!, u = 1 - this.flip / 10, fwd = this.flipDir > 0;
    const y = PY - 1, h = PH + 3;
    ctx.imageSmoothingEnabled = false;
    if (u < 0.5) {
      const w = Math.max(1, Math.round(PW * (1 - 2 * u)));
      // The page still on its old side lies flat, and the turning one narrows toward the spine.
      ctx.drawImage(old, fwd ? LX : RX, y, PW, h, fwd ? LX : RX, y, PW, h);
      ctx.drawImage(old, fwd ? RX : LX, y, PW, h, fwd ? RX : LX + PW - w, y, w, h);
      rect(fwd ? RX + w - 1 : LX + PW - w, PY, 1, PH, EDGE_LO);
    } else {
      const w = Math.max(1, Math.round(PW * (2 * u - 1)));
      ctx.drawImage(old, fwd ? LX : RX, y, PW, h, fwd ? LX : RX, y, PW, h);
      ctx.drawImage(this.fresh, fwd ? LX : RX, y, PW, h, fwd ? LX + PW - w : RX, y, w, h);
      rect(fwd ? LX + PW - w : RX + w - 1, PY, 1, PH, EDGE_LO);
    }
  }

  drawSlip(): void {
    const s = this.slip!;
    const x = 66, y = 70, w = 60, h = 40;
    rect(x + 2, y + 2, w, h, COVER_LO);
    rect(x, y, w, h, PAPER);
    rect(x, y, w, 1, '#f4ecd6');
    textCenter('Turn to No.', x + w / 2, y + 4, INK);
    for (let k = 0; k < 3; k++) {
      const dx = x + 15 + k * 11, dy = y + 18;
      if (k === s.at) { rect(dx - 2, dy - 2, 9, 12, INK); text(String(s.d[k]), dx, dy, PAPER); }
      else text(String(s.d[k]), dx, dy, INK);
    }
    textCenter('Z turns', x + w / 2, y + 31, PENCIL);
  }
}

/** A small open book in pencil, 7 by 6, for the way back to the Guide. */
function guideMark(x: number, y: number): void {
  rect(x, y, 3, 1, PENCIL); rect(x + 4, y, 3, 1, PENCIL);
  rect(x, y + 1, 1, 4, PENCIL); rect(x + 6, y + 1, 1, 4, PENCIL); rect(x + 3, y + 1, 1, 5, PENCIL);
  rect(x, y + 5, 7, 1, PENCIL);
}

/** Four pencil corners around a cell. */
function corners(x: number, y: number, w: number, h: number, c: string): void {
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
    rect(Math.min(cx, cx + sx * 2), cy, 3, 1, c);
    rect(cx, Math.min(cy, cy + sy * 2), 1, 3, c);
  }
}

/** A small round stamp. */
function stampDot(cx: number, cy: number, c: string): void {
  rect(cx - 1, cy - 2, 3, 1, c); rect(cx - 2, cy - 1, 5, 3, c); rect(cx - 1, cy + 2, 3, 1, c);
  rect(cx, cy, 1, 1, PAPER);
}

/** A rubber stamp: a doubled border and capitals, with the ink a little worn. */
function stampBox(s: string, x: number, y: number, c: string, worn = false): void {
  const w = textWidth(s) + 10, h = 15;
  rect(x, y, w, h, c);
  rect(x + 1, y + 1, w - 2, h - 2, PAPER);
  rect(x + 2, y + 2, w - 4, h - 4, c);
  rect(x + 3, y + 3, w - 6, h - 6, PAPER);
  text(s, x + 5, y + 4, c);
  // Worn ink: gaps in the outer ring only, so the letters stay whole.
  if (worn) for (let k = 0; k < 7; k++) { const a = (k * 37 + s.length * 11) % (2 * (w + h)); const [px, py] = a < w ? [x + a, y] : a < w + h ? [x + w - 1, y + a - w] : a < 2 * w + h ? [x + a - w - h, y + h - 1] : [x, y + a - 2 * w - h]; rect(px, py, 1, 1, PAPER); }
}

/** The plate's lamp: a small moon in the corner the light comes from. */
function lamp(x: number, y: number): void {
  rect(x - 1, y - 2, 3, 1, '#f4e6b8'); rect(x - 2, y - 1, 5, 3, '#f4e6b8'); rect(x - 1, y + 2, 3, 1, '#f4e6b8');
  rect(x, y - 1, 2, 2, PLATE);
}

/** A right-facing arc of a circle in dots. */
function arc(cx: number, cy: number, r: number, c: string): void {
  for (let a = -0.9; a <= 0.9; a += 0.3) rect(Math.round(cx + Math.cos(a) * r - r), Math.round(cy + Math.sin(a) * r), 1, 1, c);
}

/** A conch horn, 7 by 5. */
function hornIcon(x: number, y: number, c: string): void {
  rect(x, y + 2, 2, 1, c); rect(x + 2, y + 1, 2, 3, c); rect(x + 4, y, 2, 5, c); rect(x + 6, y, 1, 5, c);
}

export function registerMenu(): Promise<void> {
  const b = new RegisterBook();
  return run(b);
}

/** For screenshots and tests: opens the book on a kind's page or the grid at an index. */
export function openRegisterAt(i: number, kindPage = false): RegisterBook {
  const b = new RegisterBook();
  b.i = Math.max(0, Math.min(b.list.length - 1, i));
  if (kindPage) b.view = 'kind';
  void run(b);
  return b;
}
