import type { SpriteData } from '../battle/model';
import { drawSprite, PEOPLE } from '../engine/sprites';
import { text, textWidth, wrap, LINE } from '../engine/font';
import { input } from '../engine/input';
import { rect } from '../engine/screen';
import { close, run, type Mode } from './modes';
import { box, cursor, DIM, PAPER, PORTRAIT_BG, SEL } from './ui';
import { sfx } from '../engine/audio';
import { Babble } from './voices';

export const PORTRAIT: Record<string, SpriteData | undefined> = {};
export function portraitFor(name: string | null): SpriteData | undefined {
  if (!name) return undefined;
  return PORTRAIT[name];
}

const BOX_Y = 138;
const BOX_H = 54;

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
        else close(m);
      }
    },
    draw() {
      box(0, BOX_Y, 192, BOX_H);
      const label = speaker || tab;
      if (label) {
        const w = textWidth(label) + 8;
        // Tall enough that a descender keeps a clear pixel above the box's edge.
        box(2, BOX_Y - 11, w, 12);
        text(label, 6, BOX_Y - 9, speaker ? SEL : DIM);
      }
      if (p) {
        rect(5, BOX_Y + 5, 18, 18, PORTRAIT_BG);
        drawSprite(p, 6, BOX_Y + 6, 2);
      }
      let left = shown;
      pages[page].forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, left));
        left -= ln.length;
        text(part, textX, BOX_Y + 5 + i * LINE, PAPER);
      });
      const total = pages[page].join('').length;
      if (shown >= total && Math.floor(performance.now() / 300) % 2 === 0) text('\u0002', 182, BOX_Y + BOX_H - 9, DIM);
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
        box(0, BOX_Y, 192, BOX_H);
        wrap(prompt, 180).forEach((ln, k) => text(ln, 6, BOX_Y + 5 + k * LINE, PAPER));
      }
      box(x, y, w, h);
      options.forEach((o, k) => {
        if (k === i) cursor(x + 3, y + 3 + k * LINE);
        text(o, x + 10, y + 3 + k * LINE, k === i ? SEL : PAPER);
      });
    },
  };
  return run(m);
}

/** A system notice, such as an item received, in a strip at the top of the screen. It goes after two seconds or a press. */
export function notice(line: string): Promise<void> {
  const ls = wrap(line, 176);
  let t = 0;
  const m: Mode = {
    update() { t++; if (t > 120 || (t > 10 && (input.hit('ok') || input.hit('back')))) close(m); },
    draw() {
      const h = ls.length * LINE + 7, y = t < 6 ? -h + (h + 4) * t / 6 : 4;
      box(6, y, 180, h);
      ls.forEach((ln, i) => text(ln, 96 - textWidth(ln) / 2, y + 4 + i * LINE, PAPER));
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
