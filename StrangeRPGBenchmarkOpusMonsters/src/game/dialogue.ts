import type { SpriteData } from '../battle/model';
import { drawSprite, PEOPLE } from '../engine/sprites';
import { text, textWidth, wrap, LINE } from '../engine/font';
import { input } from '../engine/input';
import { rect } from '../engine/screen';
import { close, push, run, top, type Mode } from './modes';
import { bevel, BOX, cursor, DIM, edgeTones, PAPER, panel, PEARL_EDGE, PORTRAIT_BG, rowBar, SEL } from './ui';
import { sfx } from '../engine/audio';
import { Babble } from './voices';

export const PORTRAIT: Record<string, SpriteData | undefined> = {};
export function portraitFor(name: string | null): SpriteData | undefined {
  if (!name) return undefined;
  return PORTRAIT[name];
}

const BOX_Y = 138;
const BOX_H = 54;

/**
 * Keeps a finished line's box on screen until the next mode opens above it, or for one drawn frame when none does. A
 * closed line resumes its script only after the frame is drawn, so back to back lines would otherwise leave a frame with
 * no box.
 */
function linger(draw: () => void): void {
  let drawn = false;
  const ghost: Mode = {
    update() { if (drawn) close(ghost); },
    tick() { if (top() !== ghost) close(ghost); },
    draw() { drawn = true; draw(); },
  };
  push(ghost);
}

/** Shows one line of dialogue in the box at the bottom of the screen. */
export function say(speaker: string | null, line: string, portrait?: SpriteData, tab?: string): Promise<void> {
  const p = portrait || portraitFor(speaker);
  const textX = p ? 26 : 6;
  // Lines stop short of the continue arrow in the bottom right corner.
  const width = 192 - textX - 12;
  const lines = wrap(line, width);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 5) pages.push(lines.slice(i, i + 5));
  let page = 0;
  let shown = 0;
  let t = 0;
  // Narration, written text, and whorls have no speaker. They type fast with a plain blip instead of a voice.
  const narrated = !speaker;
  let voice = narrated ? null : new Babble(speaker, pages[0]);
  const m: Mode = {
    update() {
      t++;
      const total = pages[page].join('').length;
      const hurry = input.held('fast');
      if (shown < total) {
        if (!voice) {
          shown = Math.min(total, shown + (hurry ? 99 : 2));
          if (t % 3 === 0) sfx('blip');
          if (input.hit('ok') || input.hit('back')) shown = total;
          return;
        }
        // A speaker's text types at their voice's pace, one spoken letter at a time.
        shown = voice.step(hurry);
        if (input.hit('ok') || input.hit('back')) { shown = total; voice.stop(); }
        return;
      }
      if (input.hit('ok') || input.hit('back') || (input.held('fast') && t % 4 === 0)) {
        if (page < pages.length - 1) { page++; shown = 0; voice = narrated ? null : new Babble(speaker, pages[page]); }
        else { close(m); linger(m.draw); }
      }
    },
    draw() {
      panel(0, BOX_Y, 192, BOX_H, PEARL_EDGE, { shadow: false });
      const label = speaker || tab;
      if (label) nameTab(label, speaker ? SEL : DIM);
      if (p) {
        bevel(4, BOX_Y + 4, 20, 20, PORTRAIT_BG, '#5a5070');
        drawSprite(p, 6, BOX_Y + 6, 2);
      }
      let left = shown;
      pages[page].forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, left));
        left -= ln.length;
        text(part, textX, BOX_Y + 5 + i * LINE, PAPER);
      });
      const total = pages[page].join('').length;
      // The continue mark bobs a pixel and brightens on the way up.
      if (shown >= total) { const up = Math.floor(performance.now() / 300) % 2 === 0; text('\u0002', 182, BOX_Y + BOX_H - 9 - (up ? 1 : 0), up ? SEL : DIM); }
    },
  };
  return run(m);
}

/** Lets the player pick one of a few short options. Returns the index, or -1 if `cancel` is allowed and used. */
export function choose(options: string[], cancel = false, prompt?: string): Promise<number> {
  let i = 0;
  const w = Math.max(...options.map(o => textWidth(o))) + 16;
  const h = options.length * LINE + 6;
  const x = 192 - w - 2;
  const y = (prompt ? BOX_Y : 190) - h - 2;
  const m: Mode & { __choice?: boolean } = {
    __choice: true,
    update() {
      if (input.hit('up')) { i = (i + options.length - 1) % options.length; sfx('move'); }
      if (input.hit('down')) { i = (i + 1) % options.length; sfx('move'); }
      if (input.hit('ok')) { sfx('ok'); close(m, i); }
      else if (cancel && input.hit('back')) { sfx('back'); close(m, -1); }
    },
    draw() {
      if (prompt) {
        panel(0, BOX_Y, 192, BOX_H, PEARL_EDGE, { shadow: false });
        wrap(prompt, 180).forEach((ln, k) => text(ln, 6, BOX_Y + 5 + k * LINE, PAPER));
      }
      panel(x, y, w, h);
      options.forEach((o, k) => {
        if (k === i) { rowBar(x + 2, y + 3 + k * LINE, w - 4); cursor(x + 3, y + 3 + k * LINE); }
        text(o, x + 10, y + 3 + k * LINE, k === i ? SEL : PAPER);
      });
    },
  };
  return run(m);
}

/** The speaker's name on a tab that stands on the text box's top edge and opens into it, tall enough that a descender keeps a clear pixel above the box. */
function nameTab(label: string, c: string): void {
  const w = textWidth(label) + 8, y = BOX_Y - 11, edge = c === SEL ? SEL : PEARL_EDGE, [lit] = edgeTones(edge);
  rect(1, y - 1, w + 2, 12, '#0b0a10');
  bevel(2, y, w, 12, BOX, edge);
  rect(3, BOX_Y, w - 3, 1, BOX);
  rect(2, y, 2, 2, lit); rect(w, y, 2, 2, lit);
  text(label, 6, BOX_Y - 9, c);
}

/** A system notice, such as an item received, in a strip at the top of the screen. It stays until a press, so nothing given goes by unread. */
export function notice(line: string): Promise<void> {
  // Lines stop short of the continue mark at the strip's right end.
  const ls = wrap(line, 160);
  let t = 0;
  const m: Mode = {
    update() { t++; if (t > 10 && (input.hit('ok') || input.hit('back') || (input.held('fast') && t % 4 === 0))) close(m); },
    draw() {
      const h = ls.length * LINE + 7, y = t < 6 ? -h + (h + 4) * t / 6 : 4;
      panel(6, y, 180, h, SEL);
      ls.forEach((ln, i) => text(ln, 96 - textWidth(ln) / 2, y + 4 + i * LINE, PAPER));
      // The continue mark bobs a pixel and brightens on the way up, as in the text box.
      if (t > 10) { const up = Math.floor(performance.now() / 300) % 2 === 0; text('\u0002', 178, y + h - 10 - (up ? 1 : 0), up ? SEL : DIM); }
    },
  };
  return run(m);
}

/** A rule or a control explained to the player, in the text box under a Tip tab. Outer parentheses are dropped. */
export function hint(line: string): Promise<void> {
  return say(null, line.replace(/^\((.*)\)$/, '$1'), undefined, 'Tip');
}

export function registerPortraits(): void {
  const named: Record<string, string> = {
    'Gran': 'gran', 'Small Gran': 'smallgran', 'Tack': 'tack', 'Fellmonger': 'fellmonger', 'Bare': 'bare',
    'Peeler': 'peeler', 'Zest': 'zest', 'Pith': 'pith', 'Cinch': 'cinch', 'Fitter': 'fitter', 'Tanner': 'tanner',
    'Knuckle': 'knuckle', 'Leeward': 'leeward', 'Verger': 'verger', 'Grafton': 'grafton', 'Ohm': 'ohm',
    'Old Tallow': 'tallow', 'Quillon': 'quillon', 'Perihel': 'perihel',
    'Fid': 'fid', 'Lug': 'lug', 'Hasp': 'hasp', 'Purchase': 'purchase', 'Stackkeeper': 'stackkeeper',
    'Man at the well': 'villager2',
    // New names from the shell theme. The old names stay mapped until every script uses the new ones.
    'Strandmonger': 'fellmonger', 'Hermit': 'peeler', 'Tellin': 'zest', 'Murex': 'pith', 'Conjoiner': 'fitter',
    'Shellwright': 'tanner', 'Old Amber': 'tallow',
  };
  for (const [speaker, id] of Object.entries(named)) PORTRAIT[speaker] = PEOPLE[id];
}
