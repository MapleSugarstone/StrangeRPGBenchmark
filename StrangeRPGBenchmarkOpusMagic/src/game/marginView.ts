// The Margin screen: pick a problem, read the figures, write the sheet, run it, and see the score against Gloss's own.
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { CW, text, wrap } from '../engine/font';
import { tapped } from '../engine/input';
import { H, W, rect } from '../engine/screen';
import { Scene, app } from './app';
import { Editor, colorize } from './editor';
import { FOES } from './enemies';
import { PROBLEMS, Problem, Run, meetsGloss, runSheet, visible } from './margin';
import { blankStats, canSay } from './state';
import { C, panel } from './ui';

const ROWS = 7;

/** What Gloss says the first time a result happens. Short. Gloss does not praise. */
const GLOSS = {
  pass: ['That works.', 'It does the job.', 'Fine. It stands down.', 'Yes.'],
  same: ['That is how I would write it.', 'Mine is no shorter.', 'Same as mine.'],
  under: 'Shorter than mine. I will have to rewrite the Primer.',
  again: 'You used a word I did not write down. Where did you find it?',
};

/** Room's voice, on the problems Room left. Room asks. */
const ROOM = {
  pass: ['It worked. Did it want to?', 'Is that the way?', 'Did it hurt it?'],
  same: ['That is how I did it. Is it how you did it?', 'Same as mine. Is that good?'],
  under: 'Shorter than mine. How?',
  again: GLOSS.again,
};

export class MarginBook implements Scene {
  opaque = true;
  i = 0;
  top = 0;
  result: { p: Problem; r: Run; notes: { s: string; c: number }[]; trace: { s: string; c: number }[] } | null = null;

  enter() { music.play('margin'); }

  private list(): Problem[] { return PROBLEMS.filter((p) => visible(p, (w) => canSay(app.s, w))); }

  update() {
    if (this.result) {
      if (tapped('ok') || tapped('back')) { this.result = null; sfx.back(); }
      return;
    }
    const list = this.list();
    if (!list.length) { if (tapped('back') || tapped('ok')) { app.pop(); sfx.back(); } return; }
    if (tapped('up')) { this.i = (this.i + list.length - 1) % list.length; sfx.move(); }
    if (tapped('down')) { this.i = (this.i + 1) % list.length; sfx.move(); }
    if (this.i < this.top) this.top = this.i;
    if (this.i >= this.top + ROWS) this.top = this.i - ROWS + 1;
    const p = list[this.i];
    if (tapped('back')) { app.pop(); sfx.back(); return; }
    if (tapped('ok')) this.write(p);
    if (tapped('cast')) this.run(p);
  }

  private write(p: Problem) {
    const s = app.s;
    const sheet = { id: `margin_${p.id}`, name: p.title, src: s.drafts[p.id] ?? '', color: 0, stats: blankStats() };
    sfx.ok();
    app.push(new Editor(-1, 'margin', (_changed, res) => {
      s.drafts[p.id] = sheet.src;
      if (res === 'run') this.run(p);
    }, sheet));
  }

  private run(p: Problem) {
    const s = app.s;
    const src = s.drafts[p.id] ?? '';
    if (!src.trim()) { sfx.error(); this.result = { p, r: { ok: false, why: 'the sheet is blank. Z to write', lines: 0, ink: 0, steps: 0, rounds: 0, events: [], says: [] }, notes: [], trace: [] }; return; }
    const r = runSheet(p, src, (w) => canSay(s, w));
    const notes: { s: string; c: number }[] = [];
    if (r.ok) {
      const prev = s.margin[p.id];
      const first = !prev;
      const best = prev
        ? { lines: Math.min(prev.lines, r.lines), ink: Math.min(prev.ink, r.ink), steps: Math.min(prev.steps, r.steps), rounds: Math.min(prev.rounds, r.rounds) }
        : { lines: r.lines, ink: r.ink, steps: r.steps, rounds: r.rounds };
      s.margin[p.id] = best;
      if (first) { s.blanks += p.blanks; notes.push({ s: `+${p.blanks} blanks`, c: C.gold }); }
      const met = meetsGloss(p, best);
      if (met.every(Boolean) && !s.flags[`margin_same_${p.id}`]) {
        s.flags[`margin_same_${p.id}`] = true;
        if (p.mark) { s.marks++; notes.push({ s: 'as short as Gloss: a mark', c: C.gold }); }
        else { s.blanks += 5; notes.push({ s: 'as short as Gloss: +5 blanks', c: C.gold }); }
      }
      const under = r.lines < p.gloss.lines || r.steps < p.gloss.steps || r.ink < p.gloss.ink;
      const usedAgain = /(^|\n)\s*again\b/.test(src);
      const V = p.by === 'room' ? ROOM : GLOSS;
      let gloss = V.pass[PROBLEMS.indexOf(p) % V.pass.length];
      if (met.every(Boolean)) gloss = V.same[PROBLEMS.indexOf(p) % V.same.length];
      if (under && !s.flags[`margin_under_${p.id}`]) { s.flags[`margin_under_${p.id}`] = true; gloss = V.under; }
      if (usedAgain && !s.flags.margin_again) { s.flags.margin_again = true; gloss = V.again; }
      if (p.id === 'aside') gloss = '(Until. I never finished it. You did.)';
      notes.push({ s: `${p.by === 'room' ? 'ROOM' : 'GLOSS'}: ${gloss}`, c: C.kw });
      music.stinger('win');
    } else sfx.error();
    this.result = { p, r, notes, trace: this.trace(r) };
  }

  /** The last few things the sheet did, for seeing where it went wrong. */
  private trace(r: Run): { s: string; c: number }[] {
    const out: { s: string; c: number; n: number }[] = [];
    const push = (s: string, c: number) => {
      const last = out[out.length - 1];
      if (last && last.s === s) last.n++;
      else out.push({ s, c, n: 1 });
    };
    for (const e of r.events) {
      if (e.t === 'round') push(`round ${e.n}`, C.faint);
      else if (e.t === 'line' && e.text.trim() && !e.text.trim().startsWith('#')) push(`  ${e.text.trim()}`, e.mute ? C.faint : C.dim);
      else if (e.t === 'say') push(`  "${e.text}"`, C.str);
      else if (e.t === 'log' && /down|stops|harm|bites/.test(e.text)) push(e.text, C.text);
    }
    return out.slice(-6).map((o) => ({ s: o.n > 1 ? `${o.s.slice(0, 29)} x${o.n}` : o.s, c: o.c }));
  }

  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    for (let y = 12; y < H; y += 8) rect(0, y, W, 1, 0x15121c);
    rect(14, 0, 1, H, 0x2a1020);
    const list = this.list();
    const s = app.s;
    const done = PROBLEMS.filter((p) => s.margin[p.id]).length;
    text('the Margin', 18, 3, C.text);
    const tally = `${done}/${list.length}`;
    text(tally, W - 3 - tally.length * CW, 3, C.dim);
    if (!list.length) { text('Nothing written here yet.', 18, 40, C.dim); return; }
    for (let k = 0; k < ROWS && this.top + k < list.length; k++) {
      const p = list[this.top + k];
      const y = 14 + k * 9;
      const sel = this.top + k === this.i;
      const best = s.margin[p.id];
      const all = best && meetsGloss(p, best).every(Boolean);
      rect(5, y + 2, 3, 3, all ? C.gold : best ? C.hi : C.faint);
      if (sel) rect(16, y - 1, W - 18, 9, 0x2a2440);
      text(p.title, 18, y, sel ? C.hi : best ? C.text : C.dim);
      if (best) {
        const sc = `${best.lines}/${best.ink}/${best.steps}`;
        text(sc, W - 4 - sc.length * CW, y, all ? C.gold : C.dim);
      }
    }
    this.drawDetail(list[this.i]);
    if (this.result) this.drawResult();
  }

  private drawDetail(p: Problem) {
    const y0 = 14 + ROWS * 9 + 2;
    rect(16, y0 - 1, W - 16, H - y0 + 1, 0x0b0a10);
    let y = y0;
    for (const l of p.brief) { text(l, 18, y, C.text); y += 8; }
    y += 2;
    const seen = new Set<string>();
    for (const k of p.foes) {
      if (seen.has(k)) continue;
      seen.add(k);
      const f = FOES[k];
      const n = p.foes.filter((x) => x === k).length;
      text(`${n > 1 ? `${n}x ` : ''}${f.name}  hp ${f.hp}${f.armor ? ` armor ${f.armor}` : ''}`, 18, y, C.dim);
      y += 8;
      for (const line of f.rote.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))) {
        const cols = colorize(line);
        for (let c = 0; c < line.length && c < 32; c++) text(line[c], 24 + c * CW, y, cols[c]);
        y += 8;
      }
    }
    text(`wait: hp ${p.wait.hp} ink ${p.wait.ink} +${p.wait.regen}  ${p.rounds} round${p.rounds > 1 ? 's' : ''}`, 18, y + 1, C.faint);
    const glossText = `gloss  ${p.gloss.lines} line${p.gloss.lines === 1 ? '' : 's'}  ${p.gloss.ink} ink  ${p.gloss.steps} step${p.gloss.steps === 1 ? '' : 's'}`;
    text(glossText, 18, H - 18, C.gold);
    text('Z write  C run  X leave', 18, H - 9, C.faint);
  }

  private drawResult() {
    const { p, r, notes, trace } = this.result!;
    const noteRows = notes.reduce((n, x) => n + wrap(x.s, 34).length, 0);
    const h = 40 + trace.length * 8 + noteRows * 8 + (r.ok ? 24 : 0);
    const y = Math.max(4, Math.floor((H - h) / 2));
    panel(6, y, W - 12, h, r.ok ? C.good : C.bad);
    let yy = y + 5;
    text(r.ok ? 'it does the job' : 'not yet', 11, yy, r.ok ? C.good : C.bad);
    yy += 9;
    if (!r.ok) for (const l of wrap(r.why, 33).slice(0, 2)) { text(l, 11, yy, C.text); yy += 8; }
    if (r.ok) {
      const met = meetsGloss(p, r);
      const cells: [string, number, number, boolean][] = [['lines', r.lines, p.gloss.lines, met[0]], ['ink', r.ink, p.gloss.ink, met[1]], ['steps', r.steps, p.gloss.steps, met[2]]];
      cells.forEach(([k, v, best, ok], i) => {
        const x = 11 + i * 58;
        text(k, x, yy, C.dim);
        text(`${v}`, x, yy + 8, ok ? (v < best ? C.again : C.gold) : C.text);
        text(`/${best}`, x + `${v}`.length * CW, yy + 8, C.faint);
      });
      yy += 22;
    }
    for (const t of trace) { text(t.s.slice(0, 34), 11, yy, t.c); yy += 8; }
    yy += 2;
    for (const n of notes) for (const l of wrap(n.s, 34)) { text(l, 11, yy, n.c); yy += 8; }
  }
}
