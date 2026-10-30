// The dialogue box, choices, dice checks, and toasts. Lines never advance on their own, and the box stays up
// between lines of one scene.
import { box, rect, blitUI, hline, frame } from '../engine/gfx';
import { drawText, textWidth, wrap, LINE_H } from '../engine/font';
import { C } from '../engine/palette';
import { pressed, repeat, MOUSE, consume } from '../engine/input';
import { H, W } from '../engine/screen';
import { speaker, PORT_SPEAKER, type Speaker } from '../content/speakers';
import { sheetFor } from '../art/cast';
import { SETTINGS, G } from '../game/state';
import { blip, sfx } from '../audio/sfx';
import { INDENT } from './widgets';

const BOX_H = 52;
const BOX_Y = H - BOX_H - 2;
const TEXT_W = W - 16;
const LINES = 4;

interface Line { who: string; sp: Speaker | null; pages: string[][]; page: number; shown: number; port: boolean; system: boolean }

export interface ChoiceOpt { text: string; tag?: string; tagColor?: number; enabled: boolean; note?: string }

const D = {
  open: false,
  line: null as Line | null,
  resolve: null as null | (() => void),
  choices: null as null | { prompt: string; opts: ChoiceOpt[]; sel: number; resolve: (i: number) => void },
  roll: null as null | Roll,
  toasts: [] as { text: string; color: number; t: number }[],
  t: 0,
};

interface Roll {
  label: string;
  pool: number;
  need: number;
  dice: number[];
  t: number;
  phase: 'rolling' | 'shown' | 'offer' | 'reroll' | 'done';
  helper?: string;
  edgeLeft: number;
  edgeUsed: boolean;
  resolve: (ok: boolean) => void;
  ok: boolean;
}

export function dialogueOpen(): boolean { return D.open || !!D.choices || !!D.roll; }
export function closeDialogue() { D.open = false; D.line = null; }
/** Drops every box, choice, roll, and notice without answering them. For the interface audit only. */
export function clearDialogue() { D.open = false; D.line = null; D.choices = null; D.roll = null; D.toasts = []; }

function heroText(s: string): string {
  return s.replace(/\{name\}/g, G.heroName).replace(/\{port\}/g, G.port.name);
}

/** Shows one line and resolves when the player has read it. */
export function say(who: string, text: string): Promise<void> {
  const port = who === 'PORT';
  const system = who === '';
  const sp = port ? PORT_SPEAKER : system ? null : speaker(who);
  const full = heroText(text);
  const lines = wrap(full, TEXT_W - (sp && !port ? 0 : 0));
  const pages: string[][] = [];
  const per = sp && !port ? LINES - 1 : LINES;
  for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
  D.open = true;
  D.line = { who, sp, pages, page: 0, shown: 0, port, system };
  return new Promise((r) => { D.resolve = r; });
}

export function choose(prompt: string, opts: ChoiceOpt[], start = 0): Promise<number> {
  let sel = Math.max(0, Math.min(opts.length - 1, start));
  if (!opts[sel]?.enabled) sel = Math.max(0, opts.findIndex((o) => o.enabled));
  if (prompt.trim()) {
    const lines = wrap(heroText(prompt), TEXT_W);
    D.open = true;
    D.line = { who: '', sp: null, pages: [lines.slice(0, LINES)], page: 0, shown: 9999, port: false, system: true };
  }
  return new Promise((r) => { D.choices = { prompt: heroText(prompt), opts: opts.map((o) => ({ ...o, text: heroText(o.text) })), sel, resolve: r }; });
}

/** Rolls a dice pool on screen. Each 5 or 6 is a hit. The player may spend Edge to reroll misses. */
export function rollCheck(label: string, pool: number, need: number, edgeLeft: number, helper?: string): Promise<{ ok: boolean; edgeUsed: boolean }> {
  return new Promise((r) => {
    D.roll = {
      label, pool, need, dice: Array.from({ length: pool }, () => 1 + Math.floor(Math.random() * 6)), t: 0, phase: 'rolling', helper, edgeLeft, edgeUsed: false,
      resolve: (ok) => r({ ok, edgeUsed: D.roll?.edgeUsed ?? false }), ok: false,
    };
    sfx('dice');
  });
}

export function toast(text: string, color: number = C.pale) {
  D.toasts.push({ text, color, t: 2.6 });
  if (D.toasts.length > 4) D.toasts.shift();
}

function hits(d: number[]): number { return d.filter((v) => v >= 5).length; }

export function updateDialogue(dt: number) {
  D.t += dt;
  for (const t of D.toasts) t.t -= dt;
  D.toasts = D.toasts.filter((t) => t.t > 0);
  if (D.roll) { updateRoll(dt); return; }
  if (D.choices) {
    const c = D.choices;
    const n = c.opts.length;
    if (repeat('up')) { do { c.sel = (c.sel + n - 1) % n; } while (!c.opts[c.sel].enabled && n > 1); blip(); }
    if (repeat('down')) { do { c.sel = (c.sel + 1) % n; } while (!c.opts[c.sel].enabled && n > 1); blip(); }
    const rows = choiceRows(c.opts).rows;
    const top = choiceTop(rows.length);
    const under = (): number => rows[Math.floor((MOUSE.y - top) / LINE_H)]?.i ?? -1;
    if (MOUSE.inside && MOUSE.moved) {
      const i = under();
      if (i >= 0 && c.opts[i].enabled && i !== c.sel) c.sel = i;
    }
    let pick = pressed('a');
    if (MOUSE.left) {
      const i = under();
      if (i >= 0 && c.opts[i].enabled) { c.sel = i; pick = true; }
    }
    if (pick && c.opts[c.sel].enabled) {
      const r = c.resolve;
      const i = c.sel;
      D.choices = null;
      consume();
      sfx('confirm');
      r(i);
    }
    return;
  }
  const L = D.line;
  if (!L || !D.resolve) return;
  const page = L.pages[L.page] ?? [];
  const total = page.reduce((a, s) => a + s.length, 0);
  const speed = [30, 55, 90, 999][SETTINGS.textSpeed] ?? 55;
  if (L.shown < total) {
    const before = Math.floor(L.shown);
    L.shown = Math.min(total, L.shown + speed * dt);
    if (Math.floor(L.shown) > before && Math.floor(L.shown) % 2 === 0 && L.sp) blip(L.sp.voice);
  }
  if (pressed('a') || MOUSE.left) {
    consume();
    if (L.shown < total) { L.shown = total; return; }
    if (L.page < L.pages.length - 1) { L.page++; L.shown = 0; return; }
    const r = D.resolve;
    D.resolve = null;
    r();
  }
}

function updateRoll(dt: number) {
  const R = D.roll!;
  R.t += dt;
  if (R.phase === 'rolling' || R.phase === 'reroll') {
    if (R.t < 0.7) {
      if (Math.floor(R.t * 20) !== Math.floor((R.t - dt) * 20)) {
        R.dice = R.dice.map((v) => (R.phase === 'reroll' && v >= 5 ? v : 1 + Math.floor(Math.random() * 6)));
      }
      return;
    }
    R.ok = hits(R.dice) >= R.need;
    sfx(R.ok ? 'pass' : 'fail');
    R.phase = !R.ok && R.edgeLeft > 0 && !R.edgeUsed ? 'offer' : 'shown';
    R.t = 0;
    return;
  }
  if (R.phase === 'offer') {
    if (pressed('edge') || (pressed('a') && false)) { spendEdge(R); return; }
    if (MOUSE.left && MOUSE.y >= 128 && MOUSE.y < 140) { spendEdge(R); consume(); return; }
    if (pressed('a') || pressed('b') || MOUSE.left) { consume(); finish(R); }
    return;
  }
  if (R.phase === 'shown' && R.t > 0.25 && (pressed('a') || MOUSE.left)) { consume(); finish(R); }
}

function spendEdge(R: Roll) {
  R.edgeUsed = true;
  R.edgeLeft--;
  R.phase = 'reroll';
  R.t = 0;
  sfx('dice');
}

function finish(R: Roll) {
  D.roll = null;
  R.resolve(R.ok);
}

/** The choice box width and its rows. A long option wraps, and its later lines line up under its text. */
function choiceRows(opts: ChoiceOpt[]): { w: number; rows: { i: number; x: number; text: string; first: boolean }[] } {
  let w = 0;
  for (const o of opts) w = Math.max(w, textWidth((o.tag ? o.tag + ' ' : '') + o.text) + 14);
  w = Math.min(W - 8, Math.max(80, w));
  const rows: { i: number; x: number; text: string; first: boolean }[] = [];
  opts.forEach((o, i) => {
    const x = 9 + (o.tag ? textWidth(o.tag + ' ') + 1 : 0);
    wrap(o.text, w - (x - 4) - 4 - INDENT).forEach((text, k) => rows.push({ i, x: k ? x + INDENT : x, text, first: k === 0 }));
  });
  return { w, rows };
}

/** Above the dialogue box, or over it when the list is too tall to fit above. */
function choiceTop(n: number): number {
  return Math.max(7, BOX_Y - 6 - n * LINE_H);
}

function drawDie(x: number, y: number, v: number, hit: boolean, dim: boolean) {
  const face = hit ? C.grn3 : dim ? C.slate : C.pale;
  rect(x, y, 9, 9, C.black);
  rect(x + 1, y + 1, 7, 7, face);
  const pip = hit ? C.black : C.ink;
  const P: Record<number, [number, number][]> = {
    1: [[3, 3]], 2: [[1, 1], [5, 5]], 3: [[1, 1], [3, 3], [5, 5]], 4: [[1, 1], [5, 1], [1, 5], [5, 5]],
    5: [[1, 1], [5, 1], [3, 3], [1, 5], [5, 5]], 6: [[1, 1], [5, 1], [1, 3], [5, 3], [1, 5], [5, 5]],
  };
  for (const [px, py] of P[v] ?? []) rect(x + 1 + px, y + 1 + py, 1, 1, pip);
}

export function renderDialogue() {
  // Toasts at the top.
  let ty = 3;
  for (const t of D.toasts) {
    const w = textWidth(t.text) + 6;
    box(W - w - 4, ty, w, 12, C.ink, C.slate);
    drawText(t.text, W - w - 1, ty + 2, t.color);
    ty += 15;
  }
  if (D.open && D.line) {
    const L = D.line;
    const tagged = !!L.sp && !L.port;
    box(4, BOX_Y, W - 8, BOX_H, L.port ? C.cyan0 : C.ink, L.port ? C.cyan2 : C.slate);
    let y = BOX_Y + 3;
    if (tagged && L.sp) {
      const sp = L.sp;
      const sh = sp.look ? sheetFor(sp.look) : null;
      let x = 8;
      if (sh) { blitUI(sh.frames.down[0], x, y - 1); x += Math.max(12, sh.frames.down[0].w + 4); }
      drawText(sp.name, x, y, sp.color);
      hline(8, y + 10, W - 16, C.slate);
      y += 13;
    }
    const page = L.pages[L.page] ?? [];
    let budget = Math.floor(L.shown);
    const color = L.port ? C.cyan4 : L.system ? C.gray : C.white;
    for (const s of page) {
      const part = s.slice(0, Math.max(0, budget));
      budget -= s.length;
      drawText(part, 8, y, color);
      y += LINE_H;
    }
    const total = page.reduce((a, s) => a + s.length, 0);
    if (L.shown >= total && !D.choices) {
      rect(W - 12, BOX_Y + BOX_H - 6, 3, 2, C.pale);
    }
  }
  if (D.choices) {
    const c = D.choices;
    const { w, rows } = choiceRows(c.opts);
    const top = choiceTop(rows.length);
    box(4, top - 3, w, rows.length * LINE_H + 5, C.ink, C.slate);
    rows.forEach((r, k) => {
      const o = c.opts[r.i];
      const y = top + k * LINE_H;
      const selected = r.i === c.sel;
      if (selected) rect(5, y - 1, w - 2, LINE_H, C.vio0);
      if (selected && r.first) rect(6, y + 2, 2, 3, C.cyan3);
      if (r.first && o.tag) drawText(o.tag + ' ', 9, y, o.enabled ? (o.tagColor ?? C.amb3) : C.slate);
      drawText(r.text, r.x, y, o.enabled ? (selected ? C.white : C.pale) : C.slate);
    });
  }
  if (D.roll) renderRoll(D.roll);
}

function renderRoll(R: Roll) {
  const n = R.pool;
  const perRow = Math.min(n, 9);
  const rows = Math.ceil(n / 9);
  const offer = `F: spend Edge to reroll misses (${R.edgeLeft})`;
  const texts = [R.label, R.helper ?? '', R.phase === 'offer' ? offer : ''];
  const bw = Math.min(W - 8, Math.max(120, perRow * 11 + 12, ...texts.map((t) => textWidth(t) + 12)));
  const bh = 48 + rows * 11 + (R.phase === 'offer' ? 12 : 0);
  const bx = Math.floor((W - bw) / 2), by = 52;
  box(bx, by, bw, bh, C.ink, C.vio2);
  drawText(R.label, bx + 5, by + 4, C.amb3);
  const need = `Need ${R.need} hit${R.need === 1 ? '' : 's'}`;
  drawText(need, bx + 5, by + 13, C.pale);
  if (R.helper) drawText(R.helper, bx + 5, by + 22, C.gray, bw - 10);
  const settled = R.phase !== 'rolling' && R.phase !== 'reroll';
  R.dice.forEach((v, i) => {
    const x = bx + 6 + (i % 9) * 11, y = by + 33 + Math.floor(i / 9) * 11;
    drawDie(x, y, v, settled && v >= 5, settled && v < 5);
  });
  const ry = by + 35 + rows * 11;
  if (settled) {
    const h = hits(R.dice);
    const txt = `${h} hit${h === 1 ? '' : 's'}: ${R.ok ? 'PASS' : 'FAIL'}`;
    drawText(txt, bx + 5, ry, R.ok ? C.grn3 : C.mag3);
  }
  if (R.phase === 'offer') {
    drawText(offer, bx + 5, ry + 11, C.cyan3, bw - 10);
  }
  frame(bx, by, bw, bh, C.vio2);
}
