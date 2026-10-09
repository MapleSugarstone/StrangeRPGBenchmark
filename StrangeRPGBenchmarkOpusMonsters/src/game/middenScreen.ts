// The Midden: the team and the whorls kept at the grotto side by side, a summary of the picked whorl, and quick moves
// between the two. The team always keeps at least one whorl.
import type { Mon } from '../battle/model';
import { NOTIONS } from '../battle/registry';
import { text, textCenter, textRight, textWidth } from '../engine/font';
import { input } from '../engine/input';
import { sfx } from '../engine/audio';
import { dither, frame, mix, rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { renameMon } from './files';
import { monPage, statParts } from './menus';
import { close, run, type Mode } from './modes';
import { G, levelOf, save } from './state';
import { DIM, GOOD, NERVE, PAPER, PORTRAIT_BG, SEL, miniSigil, typeBadge } from './ui';

const BG = '#17151d', TEAM_C = '#7ab0d8', RACK_C = '#c8a060';
const ROW = 13, LIST_Y = 38, ROWS = 6, TEAM_MAX = 4;
const COL_X = [2, 98], COL_W = 92;

/** The column and rows the cursor was on, kept between visits. */
const memory = { col: 0, team: 0, rack: 0, scroll: 0 };

type Sub = { kind: 'none' } | { kind: 'acts'; acts: string[]; i: number } | { kind: 'swap'; from: number; i: number } | { kind: 'letgo'; yes: boolean };

/** A name cut to fit a width, with a stop where it was cut. */
function fit(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  while (s.length > 1 && textWidth(s + '.') > w) s = s.slice(0, -1);
  return s + '.';
}

class MiddenMode implements Mode {
  opaque = true;
  t = 0;
  sub: Sub = { kind: 'none' };
  busy = false;
  toast = '';
  toastT = 0;

  constructor(public done: () => void) { this.clamp(); }

  get list(): Mon[] { return memory.col === 0 ? G.party : G.rack; }
  get sel(): number { return memory.col === 0 ? memory.team : memory.rack; }
  set sel(v: number) { if (memory.col === 0) memory.team = v; else memory.rack = v; }
  get picked(): Mon | undefined { return this.list[this.sel]; }

  clamp(): void {
    memory.team = Math.max(0, Math.min(G.party.length - 1, memory.team));
    memory.rack = Math.max(0, Math.min(G.rack.length - 1, memory.rack));
    if (memory.col === 1 && !G.rack.length) memory.col = 0;
  }

  note(s: string): void { this.toast = s; this.toastT = 120; }

  /** Moves the picked whorl to the other side, or starts a swap when the team is full. */
  move(): void {
    const m = this.picked;
    if (!m) return;
    if (memory.col === 0) {
      if (G.party.length <= 1) { sfx('bump'); this.note('Your team needs one whorl.'); return; }
      G.party.splice(memory.team, 1);
      G.rack.push(m);
      this.note(`${m.name} goes to the Midden.`);
    } else {
      if (G.party.length >= TEAM_MAX) { sfx('ok'); this.sub = { kind: 'swap', from: memory.rack, i: 0 }; return; }
      G.rack.splice(memory.rack, 1);
      G.party.push(m);
      this.note(`${m.name} joins your team.`);
    }
    sfx('switch');
    this.clamp();
    save();
  }

  swap(teamAt: number, rackAt: number): void {
    const a = G.party[teamAt], b = G.rack[rackAt];
    if (!a || !b) return;
    G.party[teamAt] = b;
    G.rack[rackAt] = a;
    sfx('switch');
    this.note(`${b.name} in, ${a.name} to the Midden.`);
    save();
  }

  update(): void {
    this.t++;
    if (this.toastT > 0) this.toastT--;
    if (this.busy) return;
    const sub = this.sub;
    if (sub.kind === 'acts') {
      if (input.hit('up')) { sub.i = (sub.i + sub.acts.length - 1) % sub.acts.length; sfx('move'); }
      if (input.hit('down')) { sub.i = (sub.i + 1) % sub.acts.length; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
      if (input.hit('ok')) { this.sub = { kind: 'none' }; this.act(sub.acts[sub.i]); }
      return;
    }
    if (sub.kind === 'swap') {
      const n = G.party.length;
      if (input.hit('up')) { sub.i = (sub.i + n - 1) % n; sfx('move'); }
      if (input.hit('down')) { sub.i = (sub.i + 1) % n; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
      if (input.hit('ok')) { this.sub = { kind: 'none' }; this.swap(sub.i, sub.from); }
      return;
    }
    if (sub.kind === 'letgo') {
      if (input.hit('up') || input.hit('down') || input.hit('left') || input.hit('right')) { sub.yes = !sub.yes; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
      if (input.hit('ok')) {
        this.sub = { kind: 'none' };
        const m = G.rack[memory.rack];
        if (!sub.yes || !m) { sfx('back'); return; }
        G.rack.splice(memory.rack, 1);
        if (m.notion) G.notions[m.notion] = (G.notions[m.notion] || 0) + 1;
        sfx('back');
        this.note(`${m.name} walks off.`);
        this.clamp();
        save();
      }
      return;
    }
    // Up and down move in a column, left and right change column, Z opens the actions, C moves the whorl across.
    const n = this.list.length;
    if (input.hit('up') && n) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
    if (input.hit('down') && n) { this.sel = (this.sel + 1) % n; sfx('move'); }
    if (input.hit('left') || input.hit('right')) {
      const to = memory.col === 0 ? 1 : 0;
      if (to === 1 && !G.rack.length) sfx('bump');
      else { memory.col = to; sfx('move'); }
    }
    if (input.hit('back')) { sfx('back'); close(this); this.done(); return; }
    if (input.hit('wear')) { this.move(); return; }
    if (input.hit('ok') && this.picked) {
      sfx('ok');
      const acts = memory.col === 0 ? ['To the Midden', 'Look', 'Rename']
        : [G.party.length >= TEAM_MAX ? 'Swap in' : 'To the team', 'Look', 'Rename', 'Let go'];
      this.sub = { kind: 'acts', acts, i: 0 };
    }
  }

  act(a: string): void {
    const m = this.picked;
    if (!m) return;
    if (a === 'To the Midden' || a === 'To the team' || a === 'Swap in') { this.move(); return; }
    if (a === 'Let go') { sfx('ok'); this.sub = { kind: 'letgo', yes: false }; return; }
    if (a === 'Look' || a === 'Rename') {
      this.busy = true;
      void (a === 'Look' ? monPage(m) : renameMon(m)).then(() => { this.busy = false; save(); });
    }
  }

  drawColumn(col: number): void {
    const x = COL_X[col], list = col === 0 ? G.party : G.rack, on = memory.col === col, c = col === 0 ? TEAM_C : RACK_C;
    frame(x, 24, COL_W, 102, on ? mix(c, BG, 0.85) : '#1b1822', on ? c : '#3a3442');
    text(col === 0 ? 'Team' : 'Midden', x + 5, 28, on ? c : DIM);
    textRight(col === 0 ? `${list.length}/${TEAM_MAX}` : String(list.length), x + COL_W - 5, 28, DIM);
    if (col === 1) {
      memory.scroll = Math.min(memory.scroll, Math.max(0, list.length - ROWS));
      if (memory.rack < memory.scroll) memory.scroll = memory.rack;
      if (memory.rack >= memory.scroll + ROWS) memory.scroll = memory.rack - ROWS + 1;
    }
    const top = col === 1 ? memory.scroll : 0;
    if (!list.length) textCenter('Empty', x + COL_W / 2, LIST_Y + 20, DIM);
    const swapping = this.sub.kind === 'swap' && col === 0 ? this.sub.i : -1;
    for (let k = 0; k < (col === 0 ? TEAM_MAX : ROWS); k++) {
      const m = list[top + k];
      const y = LIST_Y + k * ROW;
      if (!m) { if (col === 0) frame(x + 3, y - 2, COL_W - 6, ROW - 1, '#1b1822', '#2a2632'); continue; }
      const here = (on && top + k === (col === 0 ? memory.team : memory.rack)) || swapping === k;
      if (here) frame(x + 3, y - 2, COL_W - 6, ROW - 1, swapping === k ? '#3a3346' : mix(c, BG, 0.7), swapping === k ? SEL : c);
      drawSprite(m.sprite, x + 5, y, 1);
      const lv = `L${levelOf(m)}`, lw = textWidth(lv);
      const sx = x + COL_W - 6 - lw - 2 - m.types.length * 6;
      m.types.forEach((t, j) => miniSigil(t, sx + j * 6, y + 1));
      text(fit(m.name, sx - (x + 16) - 2), x + 16, y, here ? SEL : PAPER);
      textRight(lv, x + COL_W - 6, y, here ? SEL : DIM);
    }
    if (col === 1 && top > 0) for (let k = 0; k < 3; k++) rect(x + COL_W / 2 - k, 34 + k, 1 + k * 2, 1, DIM);
    if (col === 1 && top + ROWS < list.length) for (let k = 0; k < 3; k++) rect(x + COL_W / 2 - k, 122 - k, 1 + k * 2, 1, DIM);
  }

  draw(): void {
    rect(0, 0, 192, 192, BG);
    frame(2, 2, 188, 19, '#211e2a', RACK_C);
    text('The Midden', 8, 8, RACK_C);
    // The head's right side gives the swap prompt, a note after a move, or the move key.
    const head = this.sub.kind === 'swap' ? ['Swap with which team whorl?', SEL] : this.toastT > 0 ? [this.toast, SEL] : ['C: move across', DIM];
    textRight(fit(head[0], 120), 184, 8, head[1]);
    this.drawColumn(0);
    this.drawColumn(1);
    // The summary: the picked whorl large, its level, types, held notion, and stats. The actions and the farewell take
    // its place while they are open, so nothing lies on top of the lists.
    const m = this.picked, py = 132;
    frame(2, py - 4, 188, 60, '#1e1b26', this.sub.kind === 'acts' || this.sub.kind === 'letgo' ? SEL : memory.col === 0 ? TEAM_C : RACK_C);
    if (m && (this.sub.kind === 'acts' || this.sub.kind === 'letgo')) this.drawSub(m, py);
    else if (m) {
      frame(6, py, 28, 28, PORTRAIT_BG, '#3a3442');
      drawSprite(m.sprite, 8, py + 2, 3);
      text(fit(m.name, 66), 38, py, SEL);
      text(`Level ${levelOf(m)}`, 38, py + 10, PAPER);
      let tx = 38;
      for (const t of m.types) tx += typeBadge(t, tx, py + 19);
      const n = m.notion ? NOTIONS[m.notion] : null;
      text(n ? fit(`Holds ${n.name}`, 146) : 'Holds no notion', 8, py + 34, n ? NERVE : DIM);
      const parts = statParts(m).filter(p => p.k !== 'CHA');
      parts.forEach((p, j) => {
        const cx = 117 + (j % 2) * 36, cy = py + (j >> 1) * 9;
        text(p.k, cx, cy, DIM);
        textRight(String(p.total), cx + 31, cy, p.held || p.nacre ? GOOD : PAPER);
      });
      text('Z: options', 8, py + 44, '#6a6478');
      textRight(memory.col === 0 ? 'C: to the Midden' : G.party.length >= TEAM_MAX ? 'C: swap in' : 'C: to the team', 186, py + 44, '#6a6478');
    }
    if (this.t < 10) dither(0, 0, 192, 192, INK, 1 - this.t / 10);
  }

  /** The actions or the farewell, in the summary panel beside the picked whorl's picture. */
  drawSub(m: Mon, py: number): void {
    const sub = this.sub;
    frame(6, py, 28, 28, PORTRAIT_BG, '#3a3442');
    drawSprite(m.sprite, 8, py + 2, 3);
    text(fit(m.name, 140), 40, py, SEL);
    if (sub.kind === 'acts') {
      sub.acts.forEach((a, k) => text(a, 52, py + 12 + k * 10, k === sub.i ? SEL : PAPER));
      text('\u0001', 44, py + 12 + sub.i * 10, SEL);
    } else if (sub.kind === 'letgo') {
      text('It walks off and does not', 40, py + 11, PAPER);
      text('come back.', 40, py + 20, PAPER);
      ['Let it go', 'Keep it'].forEach((o, k) => {
        const x = 40 + k * 64, on = sub.yes === (k === 0);
        if (on) frame(x - 4, py + 33, 58, 13, '#3a3346', SEL);
        textCenter(o, x + 25, py + 36, on ? SEL : PAPER);
      });
    }
  }
}

/** Opens the Midden. */
export function middenScreen(): Promise<void> {
  return new Promise(res => { void run(new MiddenMode(res)); });
}
