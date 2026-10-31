// The Nacre screen at the grotto: the whorl being worked on, its seven stats with the layers on each and what one more
// layer makes them, the twelve layers a whorl can hold, and the nacre in hand.
import type { Mon } from '../battle/model';
import { TAN_PER_STAT, TAN_TOTAL, tanPerLayer, tanText } from '../battle/engine';
import type { Type } from '../data/types';
import { text, textCenter, textRight, textWidth } from '../engine/font';
import { input } from '../engine/input';
import { sfx } from '../engine/audio';
import { ctx, dither, frame, mix, rect, INK } from '../engine/screen';
import { statParts } from './menus';
import { close, run, type Mode } from './modes';
import { plate } from './register';
import { G, levelOf, save } from './state';
import { BADC, DIM, GOOD, PAPER, PORTRAIT_BG, SEL, typeBadge } from './ui';

const BG = '#17151d', RULE = '#2a2632', EDGE_DIM = '#3a3442', HINT = '#6a6478', HINT_OFF = '#46425a';
/** Nacre: the screen's color, a layer's edge, its pearl, its lit lip, and the colors it turns as the light moves over it. */
const NACRE = '#d8b8dc', EDGE = '#8a6a9c', PEARL = '#ece0f0', LIP = '#ffffff', SHEENS = ['#f4c4dc', '#bcecd8', '#f2e2b0'];
/** A layer past the reach of the lamp on its left. */
const PEARL_SH = '#b4a0c4', EDGE_SH = '#5e4a70';
/** An empty place for a layer. */
const SLOT = '#4a4458', SLOT_IN = '#211e2a';
/** The shell the twelve layers lie in: its wall, the edge that faces the lamp, and the edge in shade. */
const SHELL = '#2e2438', SHELL_LIT = '#6a5478', SHELL_SH = '#140f1a';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const STATS = ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'] as const;
type Stat = typeof STATS[number];

const CARD_Y = 24, TABLE_Y = 61, ROW_Y = 76, ROW = 11, PANEL_Y = 155;
const PIP_X = 31, PIP_STEP = 8, NOW_RX = 106, NEXT_RX = 140, STACK_X = 155, STACK_W = 28;

/** The whorl and the stat picked last, so the screen opens where it was left. */
const memory = { uid: -1, stat: 0 };

const layersOf = (m: Mon, k: Stat): number => m.tan?.[k] || 0;
const usedOf = (m: Mon): number => STATS.reduce((a, k) => a + layersOf(m, k), 0);

/** A string cut to a width, with a stop where it was cut. */
function fit(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  while (s.length > 1 && textWidth(s + '.') > w) s = s.slice(0, -1);
  return s + '.';
}

/** Draws rows of letters, each letter a color from `col` and '.' left clear. */
function bitmap(rows: string[], col: Record<string, string>, x: number, y: number): void {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') rect(x + i, y + j, 1, 1, col[r[i]]); });
}

/** A chip of nacre, 7 by 7, beside the nacre in hand. */
function nacreIcon(x: number, y: number): void {
  bitmap(['.11111.', '1wwppe1', '1wpppe1', '1pppse1', '1ppsse1', '1eeee1.', '.1111..'], { '1': INK, w: LIP, p: PEARL, s: SHEENS[0], e: EDGE }, x, y);
}

/** One layer's place on a stat, 6 by 6: a chip of nacre once laid, and before that a socket pressed in, shaded on the edges that face the lamp. */
function pip(x: number, y: number, laid: boolean, sheen: string, ring = '', inner = SLOT_IN): void {
  if (laid) { bitmap(['.eeee.', 'ewwppe', 'ewppse', 'eppsse', 'epssse', '.eeee.'], { e: EDGE, w: LIP, p: PEARL, s: sheen }, x, y); return; }
  rect(x + 1, y, 4, 1, ring || SHELL_SH); rect(x, y + 1, 1, 4, ring || SHELL_SH);
  rect(x + 1, y + 5, 4, 1, ring || SLOT); rect(x + 5, y + 1, 1, 4, ring || SLOT);
  rect(x + 1, y + 1, 4, 4, inner);
}

/** The shell the twelve layers lie in, lit on the edges that face the lamp at the upper left and dark on the others. */
function shell(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SHELL);
  rect(x + 1, y, w - 2, 1, SHELL_LIT); rect(x, y + 1, 1, h - 2, SHELL_LIT);
  rect(x + 1, y + h - 1, w - 2, 1, SHELL_SH); rect(x + w - 1, y + 1, 1, h - 2, SHELL_SH);
}

/** One of the twelve layers a whorl holds: a band of pearl lit from the lamp on its left that falls into shade through an ordered dither, or an empty groove. */
function strip(x: number, y: number, laid: boolean, sheen: string, glint: boolean): void {
  const W = STACK_W, L0 = 15, L1 = 21;
  if (!laid) {
    rect(x + 1, y, W - 2, 1, SHELL_SH); rect(x, y + 1, W, 2, SLOT_IN); rect(x + 1, y + 3, W - 2, 1, SLOT);
    return;
  }
  const colOf = (j: number, lit: boolean) => j === 0 ? (lit ? LIP : PEARL) : j === 3 ? (lit ? EDGE : EDGE_SH) : (lit ? PEARL : PEARL_SH);
  for (let j = 0; j < 4; j++) {
    const x0 = j === 0 || j === 3 ? 1 : 0, x1 = j === 0 || j === 3 ? W - 1 : W;
    rect(x + x0, y + j, L0 - x0, 1, colOf(j, true));
    for (let i = L0; i < L1; i++) rect(x + i, y + j, 1, 1, colOf(j, (L1 - i) * 16 / (L1 - L0) > BAYER[((y + j) & 3) * 4 + ((x + i) & 3)]));
    rect(x + L1, y + j, x1 - L1, 1, colOf(j, false));
  }
  rect(x + 3, y + 1, 9, 1, sheen);
  if (glint) rect(x + 2, y + 1, 5, 1, LIP);
}

/** A small arrow pointing right, 3 by 5. */
function arrow(x: number, y: number, c: string): void {
  rect(x, y, 1, 5, c); rect(x + 1, y + 1, 1, 3, c); rect(x + 2, y + 2, 1, 1, c);
}

type Sub = { kind: 'none' } | { kind: 'clear'; yes: boolean };

class NacreMode implements Mode {
  opaque = true;
  t = 0;
  i = 0;
  stat = memory.stat;
  sub: Sub = { kind: 'none' };
  toast = '';
  toastT = 0;
  /** The layer that just changed, which flashes for a moment: the whorl, the stat, which layer, and whether it went on. */
  flash: { uid: number; stat: number; layer: number; on: boolean; t: number } | null = null;

  constructor(public done: () => void) {
    this.i = Math.max(0, this.all.findIndex(m => m.uid === memory.uid));
  }

  get all(): Mon[] { return [...G.party, ...G.rack]; }

  /** A stat's total in battle for the whorl as it is, or with one more layer on it, or with one fewer. */
  total(m: Mon, k: Stat, change = 0): number {
    const tan = change ? { ...m.tan, [k]: layersOf(m, k) + change } : m.tan;
    return statParts(m, levelOf(m), tan)[STATS.indexOf(k)].total;
  }

  note(s: string): void { this.toast = s; this.toastT = 120; }
  refuse(s: string): void { sfx('bump'); this.note(s); }

  lay(m: Mon): void {
    const k = STATS[this.stat], n = layersOf(m, k), name = k.toUpperCase();
    if (usedOf(m) >= TAN_TOTAL) { this.refuse(`All ${TAN_TOTAL} layers are active.`); return; }
    if (n >= TAN_PER_STAT) { this.refuse(`${name} has all ${TAN_PER_STAT}.`); return; }
    if (G.tan <= 0) { this.refuse('No nacre remaining.'); return; }
    const before = this.total(m, k);
    (m.tan ||= {})[k] = n + 1;
    G.tan--;
    this.flash = { uid: m.uid, stat: this.stat, layer: n, on: true, t: this.t };
    sfx('heal');
    this.note(`${name} ${before} to ${this.total(m, k)}.`);
  }

  takeOne(m: Mon): void {
    const k = STATS[this.stat], n = layersOf(m, k), name = k.toUpperCase();
    if (!n) { this.refuse(`No layers on ${name}.`); return; }
    const before = this.total(m, k);
    if (n > 1) m.tan![k] = n - 1; else delete m.tan![k];
    G.tan++;
    this.flash = { uid: m.uid, stat: this.stat, layer: n - 1, on: false, t: this.t };
    sfx('back');
    this.note(`${name} ${before} to ${this.total(m, k)}.`);
  }

  takeAll(m: Mon): void {
    const n = usedOf(m);
    G.tan += n;
    m.tan = {};
    sfx('back');
    this.note(`${n} nacre restored.`);
  }

  update(): void {
    this.t++;
    if (this.toastT > 0) this.toastT--;
    const all = this.all, m = all[Math.min(this.i, all.length - 1)];
    const sub = this.sub;
    if (sub.kind === 'clear') {
      if (input.hit('left') || input.hit('right') || input.hit('up') || input.hit('down')) { sub.yes = !sub.yes; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
      if (input.hit('ok')) {
        this.sub = { kind: 'none' };
        if (sub.yes && m) this.takeAll(m); else sfx('back');
      }
      return;
    }
    if (input.hit('back')) { sfx('back'); save(); close(this); this.done(); return; }
    if (!m) return;
    // Up and down pick a stat, left and right another whorl, Z lays a layer on, C takes one off, and V takes them all off.
    if (input.hit('up')) { this.stat = (this.stat + STATS.length - 1) % STATS.length; sfx('move'); }
    if (input.hit('down')) { this.stat = (this.stat + 1) % STATS.length; sfx('move'); }
    const l = input.hit('left'), r = input.hit('right');
    if ((l || r) && all.length > 1) { this.i = (this.i + all.length + (l ? -1 : 1)) % all.length; sfx('move'); }
    const now = all[this.i];
    if (input.hit('ok')) this.lay(now);
    else if (input.hit('wear')) this.takeOne(now);
    else if (input.hit('menu')) {
      if (usedOf(now)) { this.sub = { kind: 'clear', yes: false }; sfx('ok'); }
      else this.refuse(`${now.name} has no layers.`);
    }
    memory.uid = now.uid;
    memory.stat = this.stat;
  }

  draw(): void {
    rect(0, 0, 192, 192, BG);
    const all = this.all, m = all[Math.min(this.i, all.length - 1)];
    this.drawHead();
    if (m) {
      this.drawCard(m, all.length);
      this.drawTable(m);
    } else textCenter('No whorls.', 96, 90, DIM);
    this.drawPanel(m);
    if (this.t < 10) dither(0, 0, 192, 192, INK, 1 - this.t / 10);
  }

  /** The head: what the screen is, the price of a layer or a note after a change, and the nacre in hand. */
  drawHead(): void {
    frame(2, 2, 188, 19, '#211e2a', NACRE);
    text('Nacre', 8, 8, NACRE);
    const purse = String(G.tan), pw = textWidth(purse);
    textRight(purse, 184, 8, G.tan > 0 ? PAPER : BADC);
    nacreIcon(184 - pw - 10, 9);
    textCenter(fit(this.toastT > 0 ? this.toast : '1 nacre a layer', 108), 94, 8, this.toastT > 0 ? SEL : DIM);
  }

  /** The whorl being worked on: lit large, its name, level, and types, where it stands in the list, and what a layer adds at its level. */
  drawCard(m: Mon, count: number): void {
    frame(2, CARD_Y, 188, 34, '#1e1b26', EDGE_DIM);
    frame(6, CARD_Y + 3, 28, 28, PORTRAIT_BG, EDGE_DIM);
    ctx.drawImage(plate(m.sprite, 3, true), 8, CARD_Y + 5);
    const lv = `Lv ${levelOf(m)}`;
    textRight(lv, 184, CARD_Y + 4, PAPER);
    text(fit(m.name, 184 - textWidth(lv) - 4 - 38), 38, CARD_Y + 4, SEL);
    let tx = 38;
    for (const t of m.types) tx = typeBadge(t as Type, tx, CARD_Y + 13);
    const team = this.i < G.party.length, at = team ? this.i + 1 : this.i - G.party.length + 1;
    const of = team ? G.party.length : G.rack.length, room = 184 - tx;
    const long = `${team ? 'Team' : 'Midden'} ${at} of ${of}`, where = textWidth(`< ${long} >`) <= room ? long : `${at}/${of}`;
    if (count > 1) textRight(`< ${where} >`, 184, CARD_Y + 14, DIM);
    else textRight(where, 184, CARD_Y + 14, DIM);
    const per = tanPerLayer(levelOf(m));
    text(fit(`A layer adds ${tanText(per.stat)}, or ${tanText(per.hp)} to HP`, 146), 38, CARD_Y + 23, DIM);
  }

  /** Each stat with its six places for layers, its total now, and its total with one more layer on it. The twelve layers stand on the right. */
  drawTable(m: Mon): void {
    frame(2, TABLE_Y, 188, 92, '#1b1822', EDGE_DIM);
    text('Layers', PIP_X, TABLE_Y + 3, DIM);
    textRight('Now', NOW_RX, TABLE_Y + 3, DIM);
    textRight('Next', NEXT_RX, TABLE_Y + 3, DIM);
    rect(6, TABLE_Y + 12, 140, 1, RULE);
    rect(149, TABLE_Y + 3, 1, 85, RULE);
    const used = usedOf(m), lit = (this.t >> 4) & 1, f = this.flash && this.flash.uid === m.uid && this.t - this.flash.t < 14 ? this.flash : null;
    STATS.forEach((k, si) => {
      const y = ROW_Y + si * ROW, on = si === this.stat, n = layersOf(m, k);
      const room = n < TAN_PER_STAT && used < TAN_TOTAL;
      if (on) rect(4, y - 2, 144, ROW, mix(NACRE, BG, 0.82));
      text(k.toUpperCase(), 8, y, on ? SEL : DIM);
      for (let j = 0; j < TAN_PER_STAT; j++) {
        const x = PIP_X + j * PIP_STEP, sheen = SHEENS[j % 3];
        if (f && f.stat === si && f.layer === j) {
          // A layer laid on shows white for a moment, and one taken off leaves its socket lit.
          if (f.on) { pip(x, y + 1, false, sheen, LIP, LIP); continue; }
          pip(x, y + 1, false, sheen, NACRE);
          continue;
        }
        // On the picked stat, the socket the next layer goes into slowly pulses.
        const next = on && room && j === n && G.tan > 0;
        pip(x, y + 1, j < n, sheen, next && lit ? NACRE : '');
      }
      const now = this.total(m, k);
      textRight(String(now), NOW_RX, y, n ? GOOD : PAPER);
      if (room) {
        const c = G.tan > 0 ? (on ? SEL : GOOD) : DIM;
        arrow(NOW_RX + 5, y + 1, on ? c : DIM);
        textRight(String(this.total(m, k, 1)), NEXT_RX, y, c);
      }
    });
    // The whorl's twelve layers, laid from the bottom up, with a glint that climbs them now and then.
    textRight(`${used}/${TAN_TOTAL}`, 184, TABLE_Y + 3, used >= TAN_TOTAL ? SEL : PAPER);
    const g = this.t % 260, climb = g < 36 ? Math.floor(g / 3) : -1;
    shell(STACK_X - 3, ROW_Y - 3, STACK_W + 6, TAN_TOTAL * 6 + 4);
    for (let k = 0; k < TAN_TOTAL; k++) {
      const y = ROW_Y + (TAN_TOTAL - 1 - k) * 6;
      const fresh = f && f.on && k === used - 1;
      strip(STACK_X, y, k < used, SHEENS[k % 3], climb === k || !!fresh);
    }
  }

  /** What Z does to the picked stat, or why it cannot, and the keys. The question before taking every layer off takes its place. */
  drawPanel(m: Mon | undefined): void {
    const sub = this.sub;
    frame(2, PANEL_Y, 188, 35, '#1e1b26', sub.kind === 'clear' ? SEL : NACRE);
    if (!m) { text('X: back', 8, PANEL_Y + 21, HINT); return; }
    if (sub.kind === 'clear') {
      text(fit(`Remove all ${usedOf(m)} layers from ${m.name}?`, 176), 8, PANEL_Y + 3, PAPER);
      ['Take off', 'Keep'].forEach((o, k) => {
        const x = 40 + k * 64, on = sub.yes === (k === 0);
        if (on) frame(x - 4, PANEL_Y + 14, 58, 13, '#3a3346', SEL);
        textCenter(o, x + 25, PANEL_Y + 17, on ? SEL : PAPER);
      });
      return;
    }
    const k = STATS[this.stat], n = layersOf(m, k), used = usedOf(m), name = k.toUpperCase();
    let line: string, c = PAPER;
    if (used >= TAN_TOTAL) { line = `A whorl can hold up to ${TAN_TOTAL} layers.`; c = DIM; }
    else if (n >= TAN_PER_STAT) { line = `A stat can hold up to ${TAN_PER_STAT} layers.`; c = DIM; }
    else if (G.tan <= 0) { line = 'You are out of nacre to apply.'; c = BADC; }
    else line = `A layer grants ${name} ${this.total(m, k, 1)} for 1 nacre.`;
    text(fit(line, 176), 8, PANEL_Y + 3, c);
    const canLay = used < TAN_TOTAL && n < TAN_PER_STAT && G.tan > 0;
    text('Z: lay one on', 8, PANEL_Y + 12, canLay ? HINT : HINT_OFF);
    textRight('C: take one off', 184, PANEL_Y + 12, n ? HINT : HINT_OFF);
    text('V: take all off', 8, PANEL_Y + 21, used ? HINT : HINT_OFF);
    textRight(this.all.length > 1 ? 'L/R: whorl   X: back' : 'X: back', 184, PANEL_Y + 21, HINT);
  }
}

/** Opens the Nacre screen on the whorl and the stat picked last. */
export function nacreScreen(): Promise<void> {
  return new Promise(res => { void run(new NacreMode(res)); });
}
