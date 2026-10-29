// Dialogue boxes, choices, letters, chapter cards, and typed lines. Text never advances by itself, and the box
// stays up between consecutive lines so it never flashes.
import { box, rect, ditherRect, fadeFrame, blitUI, type Img } from '../engine/gfx';
import { drawText, textWidth, wrap, LINE_H, centerX } from '../engine/font';
import { C } from '../engine/palette';
import { H, W } from '../engine/screen';
import { pressed, repeat, takeTyped, setTextMode } from '../engine/input';
import { G, SETTINGS } from './state';
import { until } from './sched';
import { voice, sfx } from '../audio';
import { rawLines } from './script';
import { icon, charImgs } from './art';
import { flag } from './state';

const BOX_X = 4, BOX_W = 184, BOX_H = 40;
const TEXT_W = BOX_W - 12;
const LINES = 3;

interface SayState { speaker: string | null; pages: string[][]; page: number; shown: number; t: number; done: boolean; voiceName: string }

export const D = {
  say: null as SayState | null,
  /** The line just read, kept on screen while a choice answers it. */
  last: null as SayState | null,
  boxUp: false,
  boxTop: true,
  choice: null as { prompt: string; options: string[]; cur: number; t: number; resolve: (i: number) => void } | null,
  letter: null as { lines: string[]; drawing: boolean; t: number; resolve: () => void } | null,
  card: null as { n: number; title: string; t: number; resolve: () => void } | null,
  typing: null as { prompt: string; text: string; max: number; resolve: (s: string) => void } | null,
  bob: 0,
};

export function fill(s: string): string {
  return s.replace(/\{name\}/g, G.name).replace(/\{entry\}/g, G.entryText);
}

function displayName(speaker: string): string {
  if (speaker === 'Nodus') return G.name;
  return speaker;
}

/** Shows one spoken or system line and resolves when the player has read it and pressed confirm. */
export function say(speaker: string | null, text: string): Promise<void> {
  const body = fill(text);
  const lines = wrap(body, TEXT_W);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES) pages.push(lines.slice(i, i + LINES));
  D.say = { speaker, pages, page: 0, shown: 0, t: 0, done: false, voiceName: speaker ?? '' };
  D.boxUp = true;
  return until(() => !!D.say && D.say.done).then(() => { D.last = D.say; D.say = null; });
}

export function closeBox() { D.boxUp = false; D.say = null; D.last = null; }

export function choose(prompt: string, options: string[], start = 0): Promise<number> {
  return new Promise((resolve) => {
    D.choice = { prompt: fill(prompt), options: options.map(fill), cur: Math.max(0, Math.min(options.length - 1, start)), t: 0, resolve };
  });
}

export function showLetter(id: string, drawing: boolean): Promise<void> {
  return new Promise((resolve) => { D.letter = { lines: rawLines(id).map(fill), drawing, t: 0, resolve }; sfx('letter_open'); });
}

export function chapterCard(n: number, title: string): Promise<void> {
  return new Promise((resolve) => { D.card = { n, title, t: 0, resolve }; sfx('chapter_card'); });
}

export function typeLine(prompt: string, max: number): Promise<string> {
  setTextMode(true);
  return new Promise((resolve) => { D.typing = { prompt, text: '', max, resolve }; });
}

export function dialogueActive(): boolean { return !!(D.say || D.choice || D.letter || D.card || D.typing); }
export function cardActive(): boolean { return !!D.card; }

const SPEED = [28, 42, 70];

export function updateDialogue(dt: number) {
  D.bob += dt;
  if (D.card) {
    D.card.t += dt;
    if (D.card.t > 3.2 || (D.card.t > 0.8 && pressed('a'))) { const r = D.card.resolve; D.card = null; r(); }
    return;
  }
  if (D.typing) {
    const ty = D.typing;
    // A gamepad cannot type, so its buttons finish the entry with whatever is there.
    if (pressed('a') || pressed('b')) { const r = ty.resolve; const s = ty.text.trim() || '...'; D.typing = null; setTextMode(false); r(s); return; }
    for (const ch of takeTyped()) {
      if (ch === '\b') ty.text = ty.text.slice(0, -1);
      else if (ch === '\n') { if (ty.text.trim()) { const r = ty.resolve; const s = ty.text.trim(); D.typing = null; setTextMode(false); r(s); return; } }
      else if (ty.text.length < ty.max && /[ -~]/.test(ch) && ch !== ';') ty.text += ch;
    }
    return;
  }
  if (D.letter) {
    // A letter stays up long enough that a button pressed through the line before it cannot skip it.
    D.letter.t += dt;
    if (D.letter.t > 0.6 && (pressed('a') || pressed('b'))) { const r = D.letter.resolve; D.letter = null; sfx('menu_ok'); r(); }
    return;
  }
  if (D.choice) {
    const c = D.choice;
    c.t += dt;
    if (repeat('up')) { c.cur = (c.cur + c.options.length - 1) % c.options.length; sfx('menu_move'); }
    if (repeat('down')) { c.cur = (c.cur + 1) % c.options.length; sfx('menu_move'); }
    // The same: a press meant for the line before must not pick an answer.
    if (c.t > 0.3 && pressed('a')) { const r = c.resolve; const i = c.cur; D.choice = null; sfx('menu_ok'); r(i); }
    return;
  }
  const s = D.say;
  if (!s || s.done) return;
  const page = s.pages[s.page];
  const total = page.reduce((n, l) => n + l.length, 0);
  if (s.shown < total) {
    const cps = SPEED[SETTINGS.textSpeed] * (s.speaker ? 1 : 1.6);
    s.t += dt * cps;
    while (s.t >= 1 && s.shown < total) {
      s.t -= 1;
      const ch = charAt(page, s.shown);
      s.shown++;
      if (ch && /[A-Za-z0-9]/.test(ch) && s.shown % 2 === 1) voice(s.speaker ?? '_system', ch);
    }
    if (pressed('a')) s.shown = total;
  } else if (pressed('a')) {
    if (s.page + 1 < s.pages.length) { s.page++; s.shown = 0; s.t = 0; }
    else s.done = true;
  }
}

function charAt(page: string[], n: number): string {
  for (const l of page) { if (n < l.length) return l[n]; n -= l.length; }
  return '';
}

export function renderDialogue() {
  if (D.card) { renderCard(); return; }
  if (D.letter) { renderLetter(); return; }
  if (D.boxUp || D.say) {
    const y = H - BOX_H - 4;
    box(BOX_X, y, BOX_W, BOX_H, C.ink, C.pale);
    const s = D.say ?? (D.choice ? D.last : null);
    if (s) {
      if (s.speaker) {
        const nm = displayName(s.speaker);
        const nw = textWidth(nm) + 8;
        box(BOX_X + 4, y - 11, nw, 11, C.ink, C.gold2);
        drawText(nm, BOX_X + 8, y - 9, C.gold3);
      }
      const page = s.pages[s.page] ?? [];
      let left = s.shown;
      page.forEach((line, i) => {
        const part = line.slice(0, Math.max(0, left));
        left -= line.length;
        drawText(part, BOX_X + 6, y + 4 + i * (LINE_H + 1), s.speaker ? C.white : C.pale);
      });
      const total = page.reduce((n, l) => n + l.length, 0);
      if (s.shown >= total && !D.choice) {
        const by = y + BOX_H - 7 + (Math.floor(D.bob * 2) % 2);
        rect(BOX_X + BOX_W - 10, by, 5, 1, C.gold3);
        rect(BOX_X + BOX_W - 9, by + 1, 3, 1, C.gold3);
        rect(BOX_X + BOX_W - 8, by + 2, 1, 1, C.gold3);
      }
    }
  }
  if (D.choice) renderChoice();
  if (D.typing) renderTyping();
}

function renderChoice() {
  const c = D.choice!;
  const w = Math.max(60, ...c.options.map((o) => textWidth(o) + 18), c.prompt ? textWidth(c.prompt) + 12 : 0);
  const h = c.options.length * (LINE_H + 2) + 6 + (c.prompt ? LINE_H + 3 : 0);
  const x = W - w - 6;
  const y = H - BOX_H - 10 - h - (D.boxUp ? 6 : 0);
  box(x, y, w, h, C.ink, C.gold2);
  let yy = y + 4;
  if (c.prompt) { drawText(c.prompt, x + 6, yy, C.gold3); yy += LINE_H + 3; }
  c.options.forEach((o, i) => {
    if (i === c.cur) blitUI(icon('cursor'), x + 3, yy);
    drawText(o, x + 12, yy, i === c.cur ? C.white : C.gray);
    yy += LINE_H + 2;
  });
}

function renderCard() {
  const c = D.card!;
  rect(0, 0, W, H, C.black);
  const a = Math.min(1, c.t / 0.6), b = c.t > 2.6 ? Math.min(1, (c.t - 2.6) / 0.6) : 0;
  const head = `CHAPTER ${c.n}`;
  drawText(head, centerX(head, W / 2), 80, C.gold2);
  drawText(c.title, centerX(c.title, W / 2), 96, C.white);
  // A sundial under the title. Its lead arrives first and the pole follows, as everything does here.
  const cx = W / 2, gy = 132;
  rect(cx - 30, gy + 1, 60, 1, C.umber1);
  const lead = Math.round(28 * Math.min(1, c.t / 1.1));
  if (lead > 0) rect(cx + 1, gy - 1, lead, 2, C.plum2);
  const pole = Math.round(14 * Math.max(0, Math.min(1, (c.t - 1.0) / 0.7)));
  if (pole > 0) { rect(cx, gy + 1 - pole, 1, pole, C.gold3); if (pole === 14) rect(cx - 1, gy - 13, 3, 1, C.gold3); }
  fadeFrame(1 - a + b);
}

/** Tib's drawing of the big lead: the party's outlines side by side, as one dark shape. */
function leadDrawing(x: number, y: number) {
  const ids = ['nodus', 'parhelia'];
  if (flag('ch2_lot_joined') && !flag('lot_rejoined')) ids.push('lot');
  if (flag('ch3_umbra_joined')) ids.push('umbraculum');
  if (flag('ch4_minim_joined')) ids.push('minim');
  if (flag('ch6_tik_joined')) ids.push('tik');
  let cx = x - ids.length * 5;
  for (const id of ids) {
    const im: Img = charImgs(id).side[0];
    if (id === 'tik' && !flag('lot_rejoined')) { cx += 10; continue; }
    blitUI(im, cx, y, false, C.umber0);
    cx += 10;
  }
}

function renderLetter() {
  const L = D.letter!;
  const w = 168, h = 150, x = (W - w) / 2, y = (H - h) / 2;
  rect(x - 1, y - 1, w + 2, h + 2, C.black);
  rect(x, y, w, h, C.pale);
  ditherRect(x + 1, y + 1, w - 2, h - 2, C.pale, C.white, 0.5);
  let yy = y + 6;
  for (const line of L.lines) {
    for (const l of wrap(line, w - 14)) { drawText(l, x + 7, yy, C.umber0); yy += LINE_H + 1; }
  }
  if (L.drawing) {
    rect(x + 20, y + h - 30, w - 40, 1, C.umber2);
    leadDrawing(x + w / 2, y + h - 24);
  }
  // The same marker as the dialogue box: the page is read, press to go on.
  const by = y + h - 7 + (Math.floor(D.bob * 2) % 2);
  rect(x + w - 10, by, 5, 1, C.umber0);
  rect(x + w - 9, by + 1, 3, 1, C.umber0);
  rect(x + w - 8, by + 2, 1, 1, C.umber0);
}

function renderTyping() {
  const t = D.typing!;
  const w = 176, h = 40, x = (W - w) / 2, y = 60;
  box(x, y, w, h, C.ink, C.gold2);
  drawText(t.prompt, x + 6, y + 4, C.gold3);
  rect(x + 6, y + 26, w - 12, 1, C.gray);
  drawText(t.text, x + 6, y + 16, C.white);
  if (Math.floor(D.bob * 2) % 2 === 0) rect(x + 6 + textWidth(t.text) + 1, y + 16, 1, 8, C.white);
  drawText('Enter: done', x + w - 6 - textWidth('Enter: done'), y + 30, C.gray);
}
