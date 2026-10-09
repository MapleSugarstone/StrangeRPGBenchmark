// Practice's debug menu: each fighter's kit and state, the foe's last decision with its scores, the battle's messages,
// and edits to HP, tide, statuses, and knockouts. Only a practice battle opens it.
import { addNerve, applyStatus, handleKO, label, moveDef, msg, nameOf, NERVE_MAX, passivesOf, sk, spriteOf, stat, STATUS_NAME, typesOf } from '../battle/engine';
import { lastChoice } from '../battle/ai';
import type { Fighter } from '../battle/model';
import { MARKS, NOTIONS, PASSIVES } from '../battle/registry';
import type { Type } from '../data/types';
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { sfx } from '../engine/audio';
import { frame, mix, rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import type { PracticeView } from './battleView';
import { close, run, type Mode } from './modes';
import { BADC, DIM, GOOD, hpBar, MINE, NERVE, PAPER, SEL, sigil, statusIcon, THEIRS, tideGauge, typeBadge, WARN } from './ui';

const BG = '#17151d', PANEL = '#1e1b26', EDGE = '#3a3442';
const TABS = ['Fighters', 'Foe AI', 'Log'];
const ACTS = ['Set HP', 'Add 1 tide', 'Fill tide', 'Clear tide', 'Add a status', 'Clear statuses', 'Knock out'];
const STATUSES = Object.keys(STATUS_NAME).filter(id => id !== 'guard');
const STAT_KEYS = ['atk', 'def', 'res', 'mgk', 'agi', 'cha'] as const;
/** The page's scrolling rows run from here to PAGE_END, one text line apart. */
const PAGE_TOP = 52, PAGE_END = 172, LOG_ROWS = 16;

interface Row { s: string; c: string; x?: number; right?: string; rc?: string; sig?: Type }

type Sub = { kind: 'none' } | { kind: 'acts'; i: number } | { kind: 'hp'; v: number } | { kind: 'status'; i: number };

/** Cuts a string to fit a width, ending it with a period when cut. */
function fit(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  while (s.length > 1 && textWidth(s + '.') > w) s = s.slice(0, -1);
  return s + '.';
}

const num = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2));

class DebugMode implements Mode {
  t = 0;
  tab = 0;
  sel = 0;
  /** The fighter whose page is open, or null on the tab's list. */
  page: Fighter | null = null;
  scroll = 0;
  logBack = 0;
  sub: Sub = { kind: 'none' };
  note = '';
  noteT = 0;

  constructor(readonly v: PracticeView) {}

  fighters(): Fighter[] { return [...this.v.b.s[0].f, ...this.v.b.s[1].f]; }

  say(s: string): void { this.note = s; this.noteT = 100; }

  update(): void {
    this.t++;
    if (this.noteT > 0) this.noteT--;
    const sub = this.sub;
    if (sub.kind === 'acts') return this.updateActs(sub);
    if (sub.kind === 'hp') return this.updateHp(sub);
    if (sub.kind === 'status') return this.updateStatus(sub);
    if (input.hit('menu')) { sfx('back'); close(this); return; }
    if (this.page) return this.updatePage(this.page);
    if (input.hit('back')) { sfx('back'); close(this); return; }
    if (input.hit('left') || input.hit('right')) { this.tab = (this.tab + (input.hit('left') ? 2 : 1)) % 3; this.logBack = 0; sfx('move'); }
    const all = this.fighters();
    if (this.tab === 0) {
      if (input.hit('up')) { this.sel = (this.sel + all.length - 1) % all.length; sfx('move'); }
      if (input.hit('down')) { this.sel = (this.sel + 1) % all.length; sfx('move'); }
      if (input.hit('ok')) { this.page = all[this.sel]; this.scroll = 0; sfx('ok'); }
    } else if (this.tab === 2) {
      const n = this.logLines().length;
      if (input.hit('up') && this.logBack < n - LOG_ROWS) { this.logBack++; sfx('move'); }
      if (input.hit('down') && this.logBack > 0) { this.logBack--; sfx('move'); }
    }
  }

  updatePage(f: Fighter): void {
    if (input.hit('back')) { sfx('back'); this.page = null; return; }
    const all = this.fighters();
    if (input.hit('left') || input.hit('right')) {
      this.sel = (all.indexOf(f) + (input.hit('left') ? all.length - 1 : 1)) % all.length;
      this.page = all[this.sel]; this.scroll = 0; sfx('move');
      return;
    }
    const max = Math.max(0, this.pageRows(f).length - Math.floor((PAGE_END - PAGE_TOP) / 9));
    if (input.hit('up') && this.scroll > 0) { this.scroll--; sfx('move'); }
    if (input.hit('down') && this.scroll < max) { this.scroll++; sfx('move'); }
    if (input.hit('ok')) { this.sub = { kind: 'acts', i: 0 }; sfx('ok'); }
  }

  updateActs(sub: { kind: 'acts'; i: number }): void {
    const f = this.page!, b = this.v.b, s = b.s[f.side];
    if (input.hit('up')) { sub.i = (sub.i + ACTS.length - 1) % ACTS.length; sfx('move'); }
    if (input.hit('down')) { sub.i = (sub.i + 1) % ACTS.length; sfx('move'); }
    if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
    if (!input.hit('ok')) return;
    const a = ACTS[sub.i], down = f.ko || f.gone;
    if (down && a !== 'Add 1 tide' && a !== 'Fill tide' && a !== 'Clear tide') { sfx('bump'); this.say(`${nameOf(f)} is out of the battle.`); return; }
    sfx('ok');
    this.sub = { kind: 'none' };
    if (a === 'Set HP') this.sub = { kind: 'hp', v: f.hp };
    else if (a === 'Add a status') this.sub = { kind: 'status', i: 0 };
    else if (a === 'Add 1 tide' || a === 'Fill tide' || a === 'Clear tide') {
      const before = s.nerve;
      addNerve(b, f.side, a === 'Add 1 tide' ? 1 : a === 'Fill tide' ? NERVE_MAX : -s.nerve);
      msg(b, `Practice sets ${f.side === 0 ? 'your' : 'their'} tide to ${s.nerve}.`);
      this.say(`${f.side === 0 ? 'Your' : 'Their'} tide goes from ${before} to ${s.nerve}.`);
    } else if (a === 'Clear statuses') {
      f.s = {};
      msg(b, `Practice clears ${label(b, f)}'s statuses.`);
      this.say('Statuses cleared.');
    } else if (a === 'Knock out') {
      // A debug knockout skips the side's second chance, and leaves that chance as it found it.
      const k = sk(b, f.side), had = k.saved, from = b.ev.length;
      k.saved = 1;
      delete f.s.monument;
      f.hp = 0;
      handleKO(b, f, null, 0);
      if (had === undefined) delete k.saved; else k.saved = had;
      b.ev = [...b.ev.slice(0, from), ...b.ev.slice(from).filter(e => !(e.e === 'msg' && e.text.endsWith('has no second chance left.')))];
      this.say(`${nameOf(f)} is down.`);
    }
  }

  updateHp(sub: { kind: 'hp'; v: number }): void {
    const f = this.page!;
    const step = (d: number) => { sub.v = Math.max(1, Math.min(f.maxHp, sub.v + d)); sfx('move'); };
    if (input.hit('left')) step(-1);
    if (input.hit('right')) step(1);
    if (input.hit('down')) step(-Math.max(1, Math.round(f.maxHp / 10)));
    if (input.hit('up')) step(Math.max(1, Math.round(f.maxHp / 10)));
    if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
    if (input.hit('ok')) {
      f.hp = sub.v;
      msg(this.v.b, `Practice sets ${label(this.v.b, f)} to ${f.hp} HP.`);
      this.say(`${nameOf(f)} has ${f.hp} HP.`);
      this.sub = { kind: 'none' }; sfx('ok');
    }
  }

  updateStatus(sub: { kind: 'status'; i: number }): void {
    const f = this.page!;
    if (input.hit('up')) { sub.i = (sub.i + STATUSES.length - 1) % STATUSES.length; sfx('move'); }
    if (input.hit('down')) { sub.i = (sub.i + 1) % STATUSES.length; sfx('move'); }
    if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
    if (input.hit('ok')) {
      const id = STATUSES[sub.i];
      const ok = applyStatus(this.v.b, null, f, id, 2);
      if (ok) msg(this.v.b, `Practice makes ${label(this.v.b, f)} ${STATUS_NAME[id]}.`);
      this.say(ok ? `${nameOf(f)} is ${STATUS_NAME[id]}.` : `${nameOf(f)} is not affected.`);
      sfx(ok ? 'ok' : 'bump');
      this.sub = { kind: 'none' };
    }
  }

  /** The page's rows: stats, moves, habits, held notion, statuses, marks, and the side's tide. */
  pageRows(f: Fighter): Row[] {
    const b = this.v.b, rows: Row[] = [];
    const head = (s: string) => { if (rows.length) rows.push({ s: '', c: DIM }); rows.push({ s, c: SEL }); };
    head('Stats');
    for (let r = 0; r < 2; r++) {
      const ks = STAT_KEYS.slice(r * 3, r * 3 + 3);
      rows.push({ s: ks.map(k => `${k.toUpperCase()} ${stat(b, f, k)}`).join('   '), c: PAPER, x: 10 });
    }
    head('Moves');
    f.moves.forEach((_, i) => {
      const mv = moveDef(f, i);
      if (!mv) return;
      const cd = f.cd[i] || 0;
      rows.push({ s: mv.name, c: PAPER, x: 18, sig: mv.type as Type,
        right: cd > 0 ? `${cd} turn${cd > 1 ? 's' : ''}` : mv.nerve ? `${mv.nerve} tide` : 'ready', rc: cd > 0 ? WARN : mv.nerve ? NERVE : GOOD });
    });
    head('Habits');
    for (const id of passivesOf(f)) rows.push({ s: PASSIVES[id]?.name || id, c: GOOD, x: 10 });
    const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
    rows.push({ s: n ? n.name : 'Holds nothing', c: n ? MINE : DIM, x: 10, right: n && f.k.notionUsed ? 'used' : '', rc: DIM });
    for (const id of f.items || []) rows.push({ s: `Item, ${NOTIONS[id]?.name || id}`, c: MINE, x: 10 });
    head('Statuses');
    const ss = Object.entries(f.s);
    if (!ss.length) rows.push({ s: 'None', c: DIM, x: 10 });
    for (const [id, sv] of ss) rows.push({ s: STATUS_NAME[id] || id, c: PAPER, x: 18, right: `n ${sv!.n}${sv!.v !== undefined ? `  v ${num(sv!.v)}` : ''}`, rc: DIM });
    head('Marks');
    const ms = Object.entries(f.m);
    if (!ms.length) rows.push({ s: 'None', c: DIM, x: 10 });
    for (const [id, mv] of ms) rows.push({ s: fit(MARKS[id]?.name || id, 92), c: PAPER, x: 10, right: `x${mv.n}${mv.v ? ` v ${num(mv.v)}` : ''}${mv.t >= 0 ? `  ${mv.t}t` : ''}`, rc: DIM });
    head('Side');
    rows.push({ s: `Tide ${b.s[f.side].nerve} of ${NERVE_MAX}`, c: NERVE, x: 10 });
    for (const u of b.s[f.side].sum) rows.push({ s: `Summon, ${u.def}`, c: PAPER, x: 10, right: `${u.hp}/${u.maxHp}`, rc: DIM });
    return rows;
  }

  logLines(): string[] { return this.v.log.flatMap(s => wrap(s, 178)); }

  // ------------------------------------------------------------ draw

  draw(): void {
    rect(0, 0, 192, 192, BG);
    if (this.page) this.drawPage(this.page);
    else {
      TABS.forEach((s, k) => {
        const x = 4 + k * 62, on = k === this.tab;
        frame(x, on ? 2 : 3, 60, 13, on ? '#2a2632' : '#211e2a', on ? SEL : EDGE);
        textCenter(s, x + 30, on ? 5 : 6, on ? SEL : DIM);
      });
      rect(0, 16, 192, 1, EDGE);
      if (this.tab === 0) this.drawList();
      else if (this.tab === 1) this.drawAi();
      else this.drawLog();
    }
    this.drawSub();
    if (this.noteT > 0) {
      const w = textWidth(this.note) + 10;
      frame(96 - w / 2, 160, w, 13, '#2a2632', SEL);
      textCenter(this.note, 96, 163, PAPER);
    }
  }

  drawList(): void {
    const b = this.v.b;
    let k = 0;
    ([0, 1] as const).forEach(side => {
      const y0 = 20 + side * 74;
      text(side === 0 ? 'You' : 'Foe', 6, y0, side === 0 ? MINE : THEIRS);
      tideGauge(130, y0 + 1, b.s[side].nerve, NERVE_MAX);
      b.s[side].f.forEach((f, i) => {
        const y = y0 + 11 + i * 20, on = k === this.sel, down = f.ko || f.gone;
        frame(4, y - 1, 184, 19, on ? '#2a2632' : PANEL, on ? SEL : EDGE);
        rect(6, y + 1, 16, 16, INK);
        drawSprite(spriteOf(f), 6, y + 1, 2, false);
        text(fit(nameOf(f), 64), 26, y + 1, down ? DIM : on ? SEL : PAPER);
        if (b.s[side].out === i && !down) text('out', 94, y + 1, side === 0 ? MINE : THEIRS);
        textRight(down ? 'down' : `${f.hp}/${f.maxHp}`, 186, y + 1, down ? BADC : DIM);
        hpBar(26, y + 11, 74, f.hp, f.maxHp, f.shield);
        let ix = 106;
        for (const id of Object.keys(f.s)) { if (ix > 180) break; if (statusIcon(id, ix, y + 11)) ix += 6; }
        k++;
      });
    });
    textCenter('Z opens. Arrows change tab.', 96, 172, DIM);
    textCenter('V closes.', 96, 182, DIM);
  }

  drawAi(): void {
    const c = lastChoice;
    if (!c.top.length) { textCenter('The foe has not chosen yet.', 96, 40, DIM); return; }
    text(fit(`${c.who}, round ${c.round}`, 180), 6, 21, PAPER);
    const hi = c.top[0].v, lo = c.top[c.top.length - 1].v;
    let marked = false;
    c.top.forEach((o, k) => {
      const y = 35 + k * 15, took = !marked && o.label === this.v.aiTook;
      if (took) marked = true;
      frame(4, y - 2, 184, 13, took ? '#2a2632' : PANEL, took ? SEL : EDGE);
      text(`${k + 1}`, 9, y + 1, DIM);
      text(fit(o.label, 96), 20, y + 1, took ? SEL : PAPER);
      const w = hi > lo ? Math.round(36 * (o.v - lo) / (hi - lo)) : 36;
      rect(122, y + 3, 36, 3, '#2e2a3a');
      rect(122, y + 3, Math.max(1, w), 3, took ? SEL : DIM);
      textRight(o.v.toFixed(3), 186, y + 1, took ? SEL : DIM);
    });
    const y = 40 + c.top.length * 15;
    wrap('Higher scores are better. The highlighted action is the one the foe took. Below keeper level the AI sometimes takes another.', 180)
      .forEach((l, n) => text(l, 6, y + n * 9, DIM));
  }

  drawLog(): void {
    const lines = this.logLines();
    if (!lines.length) { textCenter('Nothing has happened yet.', 96, 40, DIM); return; }
    const end = lines.length - this.logBack, start = Math.max(0, end - LOG_ROWS);
    lines.slice(start, end).forEach((l, n) => text(l, 6, 21 + n * 9, n === end - start - 1 && this.logBack === 0 ? PAPER : mix(PAPER, BG, 0.25)));
    if (start > 0) textRight('up for older', 186, 172, DIM);
    if (this.logBack > 0) text('down for newer', 6, 172, DIM);
    textCenter('V closes.', 96, 182, DIM);
  }

  drawPage(f: Fighter): void {
    const b = this.v.b, side = f.side;
    frame(4, 4, 30, 30, INK, side === 0 ? MINE : THEIRS);
    drawSprite(spriteOf(f), 7, 7, 3, false);
    text(fit(nameOf(f), 96), 40, 5, SEL);
    textRight(`L${f.mon.level}`, 188, 5, DIM);
    let tx = 40;
    for (const t of typesOf(f)) tx = typeBadge(t, tx, 14);
    const where = f.ko ? 'down' : f.gone ? 'gone' : b.s[side].out === f.idx ? 'out' : 'reserve';
    textRight(`${side === 0 ? 'You' : 'Foe'}, ${where}`, 188, 15, side === 0 ? MINE : THEIRS);
    hpBar(40, 27, 92, f.hp, f.maxHp, f.shield);
    textRight(`${f.hp}/${f.maxHp}${f.shield ? ` +${f.shield}` : ''}`, 188, 26, PAPER);
    rect(4, 39, 184, 1, EDGE);
    const rows = this.pageRows(f), vis = Math.floor((PAGE_END - PAGE_TOP) / 9);
    text('Up and down scroll.', 6, 42, DIM);
    rows.slice(this.scroll, this.scroll + vis).forEach((r, n) => {
      const y = PAGE_TOP + n * 9;
      if (r.sig) sigil(r.sig, 8, y);
      text(r.s, r.x ?? 6, y, r.c);
      if (r.right) textRight(r.right, 186, y, r.rc || DIM);
    });
    if (this.scroll > 0) textRight('more above', 186, 42, DIM);
    if (this.scroll + vis < rows.length) textRight('more below', 186, PAGE_END + 1, DIM);
    textCenter('Z changes it. Left and right page.', 96, 182, DIM);
  }

  drawSub(): void {
    const sub = this.sub, f = this.page;
    if (!f || sub.kind === 'none') return;
    if (sub.kind === 'acts') {
      const w = 84, h = ACTS.length * 10 + 8, x = 100, y = 46;
      frame(x, y, w, h, '#211e2a', SEL);
      ACTS.forEach((a, k) => text(a, x + 12, y + 5 + k * 10, k === sub.i ? SEL : PAPER));
      text('\u0001', x + 4, y + 5 + sub.i * 10, SEL);
    } else if (sub.kind === 'hp') {
      frame(26, 72, 140, 54, '#211e2a', SEL);
      textCenter(fit(`${nameOf(f)}'s HP`, 130), 96, 77, PAPER);
      textCenter(`< ${sub.v} of ${f.maxHp} >`, 96, 89, SEL);
      hpBar(56, 100, 80, sub.v, f.maxHp);
      textCenter('Up and down step 10%.', 96, 111, DIM);
    } else if (sub.kind === 'status') {
      const vis = 10, top = Math.max(0, Math.min(sub.i - 4, STATUSES.length - vis));
      frame(52, 30, 88, vis * 10 + 22, '#211e2a', SEL);
      text('Add for 2 turns', 58, 34, DIM);
      STATUSES.slice(top, top + vis).forEach((id, n) => {
        const k = top + n, y = 46 + n * 10;
        statusIcon(id, 60, y + 1);
        text(STATUS_NAME[id], 70, y, k === sub.i ? SEL : PAPER);
      });
    }
  }
}

/** Opens the debug menu over a practice battle and resolves when it closes. */
export function debugMenu(v: PracticeView): Promise<void> {
  return run(new DebugMode(v));
}
