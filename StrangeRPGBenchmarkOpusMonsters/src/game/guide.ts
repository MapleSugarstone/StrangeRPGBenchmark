// The Guide in the Register: the contents across two pages, and each chapter on one wide sheet that scrolls, with its icons and pictures.
import { FATIGUE_ROUND, makeFighter, tanBonus } from '../battle/engine';
import { GUIDE, type Chapter } from '../content/guide';
import { LEVEL_MAX, statsAt, TYPE_COLOR, TYPES, typeMult, type Type } from '../data/types';
import { bigText, text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { ctx, mix, rect } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { CAPS, G, STRAND_CAPS } from './state';
import { markIcon, sigil, statusIcon } from './ui';

/** The Register's paper and ink, and its pencil corners for the picked line. */
export interface Book {
  INK: string; PENCIL: string; FAINT: string; RED: string; BLUE: string; PAPER: string;
  corners(x: number, y: number, w: number, h: number, c: string): void;
}

/** A contents page's column is this wide, every picture is drawn this wide, and lines sit this far apart. */
const COL = 76, LINE = 9;
/** How tall each picture is, in pixels. */
const PIC_H: Record<string, number> = { team: 30, stats: 73, armor: 28, timeline: 34, cooldown: 24, tide: 12, types: 64, horn: 26, nacre: 10, caps: 55, fatigue: 36, strandCaps: 46 };
const picHeight = (id: string): number => (PIC_H[id] || 20) + (id === 'caps' && G.flags.postgame ? 9 : 0);

/** One thing on a chapter's sheet, `y` pixels down from its top. A line's `red` letters at its start are drawn in red. */
export type Item =
  | { k: 'title'; s: string; y: number }
  | { k: 'rule'; y: number }
  | { k: 'line'; s: string; y: number; x: number; head: boolean; red: number }
  | { k: 'icon'; icon: string; y: number }
  | { k: 'pic'; pic: string; y: number };

export interface Sheet { items: Item[]; height: number; width: number }

/** Lays a chapter out in one column `width` pixels wide. A row that names a stat starts with the stat in red instead of an icon. */
export function layout(ch: Chapter, width: number): Sheet {
  const items: Item[] = [];
  let y = 0;
  for (const l of wrap(ch.title, width)) { items.push({ k: 'title', s: l, y }); y += LINE; }
  items.push({ k: 'rule', y: y + 1 });
  y += 7;
  for (const b of ch.blocks) {
    if ('p' in b) {
      for (const l of wrap(b.p, width)) { items.push({ k: 'line', s: l, y, x: 0, head: false, red: 0 }); y += LINE; }
      y += 4;
    } else if ('h' in b) {
      if (y > 0) y += 2;
      for (const l of wrap(b.h, width)) { items.push({ k: 'line', s: l, y, x: 0, head: true, red: 0 }); y += LINE; }
      y += 1;
    } else if ('pic' in b) {
      items.push({ k: 'pic', pic: b.pic, y });
      y += picHeight(b.pic) + 5;
    } else {
      if (b.when && !b.when()) continue;
      const word = b.icon.startsWith('word:'), indent = word ? 0 : 11;
      if (!word) items.push({ k: 'icon', icon: b.icon, y });
      wrap(b.s, width - indent).forEach((l, n) => { items.push({ k: 'line', s: l, y, x: indent, head: false, red: word && n === 0 ? b.icon.length - 5 : 0 }); y += LINE; });
      y += 3;
    }
  }
  return { items, height: y, width };
}

// ---------------------------------------------------------------- icons

/** 7 by 7 icons: '#' in ink, 'o' in the icon's own color. */
const BITS: Record<string, string[]> = {
  turns: ['#######', '.#...#.', '..#o#..', '...#...', '..#.#..', '.#ooo#.', '#######'],
  stats: ['.....#.', '.....#.', '...#.#.', '...#.#.', '.#.#.#.', '.#.#.#.', '#######'],
  moves: ['...#...', '.#.#.#.', '..#o#..', '##ooo##', '..#o#..', '.#.#.#.', '...#...'],
  notions: ['..#o#..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'],
  nacre: ['..###..', '.#o#o#.', '#o#o#o#', '#o#o#o#', '.#####.', '..#.#..', '...#...'],
  conjoin: ['.......', '.##.##.', '#..#..#', '#.o#o.#', '#..#..#', '.##.##.', '.......'],
  levels: ['...#...', '..#o#..', '.#ooo#.', '#######', '..#o#..', '..#o#..', '..###..'],
  fatigue: ['###....', '..#....', '.#.....', '###.###', '......#', '.....#.', '....###'],
  wear: ['.##.##.', '#######', '#.#o#.#', '..#o#..', '..#o#..', '..###..', '.......'],
  bag: ['..###..', '.#...#.', '#######', '#ooooo#', '#oo#oo#', '#ooooo#', '#######'],
  cowries: ['..###..', '.#o#o#.', '#o###o#', '#o#.#o#', '#o###o#', '.#o#o#.', '..###..'],
  charms: ['#.....#', '.#...#.', '..###..', '.#ooo#.', '.#ooo#.', '.#ooo#.', '..###..'],
  setting: ['.#####.', '#o#o#o#', '#######', '.#ooo#.', '..#o#..', '...#...', '.......'],
  practice: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '##...##', '##...##'],
  strand: ['.......', '.##..##', '#..##..', '.......', '.##..##', '#..##..', '.......'],
  team: ['.##.##.', '#oo#oo#', '#oo#oo#', '.##.##.', '..###..', '.#ooo#.', '..###..'],
  horns: ['.......', '#......', '##...#.', '###.##.', '######.', '###.##.', '##...#.'],
  key: ['.##....', '#..#...', '#..####', '.##..#.', '.....#.', '.......', '.......'],
  book: ['######.', '#....##', '#.##.##', '#....##', '#.##.##', '#....##', '######.'],
  sketch: ['#####..', '#...##.', '#.#..#.', '#..#.#.', '#...##.', '######.', '.......'],
  bottle: ['..##...', '..##...', '.####..', '#....#.', '#.oo.#.', '#....#.', '.####..'],
  pearl: ['.......', '..###..', '.#ooo#.', '.#ooo#.', '.#ooo#.', '..###..', '.......'],
  dot: ['.......', '.......', '..###..', '..###..', '..###..', '.......', '.......'],
  locked: ['..###..', '.#...#.', '.....#.', '....#..', '...#...', '.......', '...#...'],
};

/** Each chapter icon's own color. */
const TINT: Record<string, string> = {
  turns: '#c8a040', moves: '#d07a3a', notions: '#3c5a92', nacre: '#c8b8d8', conjoin: '#a8423a', levels: '#5a8a4a', wear: '#5a8ad0',
  bag: '#b07a4a', cowries: '#e8d0a8', charms: '#e8e0f0', setting: '#d07a9a', team: '#7ab0d8', pearl: '#e8e0f0', bottle: '#5ab08a',
};

function bits(name: string, x: number, y: number, ink: string): void {
  const rows = BITS[name];
  if (!rows) return;
  const tint = TINT[name] || ink;
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') rect(x + i, y + j, 1, 1, r[i] === '#' ? ink : tint); });
}

/** A chapter's icon on the contents page. */
function chapterIcon(id: string, x: number, y: number, b: Book): void {
  if (id === 'tide') { waves(x, y + 1, '#e8903a', b.INK); return; }
  if (id === 'types') { sigil('STAR', x, y, mix(TYPE_COLOR.STAR, b.INK, 0.25)); return; }
  if (id === 'statuses') { statusIcon('burn', x + 1, y + 1); return; }
  if (id === 'marks') { markIcon(x + 1, y + 1, b.RED, 1); return; }
  if (id === 'starborn') { starMarkInk(x + 1, y + 1, b); return; }
  bits(id, x, y, b.INK);
}

/** A small tide wave, 6 by 5, as the battle's tide icon draws it. */
function waves(x: number, y: number, c: string, ink: string): void {
  rect(x + 1, y, 3, 1, ink); rect(x, y + 1, 1, 2, ink); rect(x + 4, y + 1, 2, 1, ink);
  rect(x + 1, y + 1, 3, 2, c); rect(x, y + 3, 6, 1, ink); rect(x + 2, y + 4, 2, 1, c);
}

/** A star in ink and gold, for the Starborn chapter. */
function starMarkInk(x: number, y: number, b: Book): void {
  rect(x + 2, y, 1, 5, '#c8a040'); rect(x, y + 2, 5, 1, '#c8a040'); rect(x + 2, y + 2, 1, 1, b.INK);
}

/** The icon at the start of a row. */
function rowIcon(icon: string, x: number, y: number, b: Book): void {
  const [kind, arg] = icon.split(':');
  if (kind === 'word') { text(arg, x, y, b.RED); return; }
  if (kind === 'status') { statusIcon(arg, x + 1, y + 1); return; }
  if (kind === 'type') { sigil(arg as Type, x, y, mix(TYPE_COLOR[arg as Type], b.INK, 0.3)); return; }
  if (kind === 'mark') { markIcon(x + 1, y + 1, b.RED, 1); return; }
  if (kind === 'horn') { hornIn(x, y + 1, ({ twig: '#a08060', brass: '#b08030', bone: '#8c7d66', iron: '#a8423a' } as Record<string, string>)[arg] || b.INK); return; }
  if (kind === 'pocket') { bits(['horns', 'notions', 'key', 'bottle', 'book', 'sketch'][Number(arg)] || 'dot', x, y, b.INK); return; }
  bits(kind, x, y, b.INK);
}

/** A conch horn, 7 by 5, in one color. */
function hornIn(x: number, y: number, c: string): void {
  rect(x, y + 2, 2, 1, c); rect(x + 2, y + 1, 2, 3, c); rect(x + 4, y, 2, 5, c); rect(x + 6, y, 1, 5, c);
}

// ---------------------------------------------------------------- pictures

const GOODINK = '#3c7a3a';

/** A bar in a frame on paper: `f` of it filled. */
function bar(x: number, y: number, w: number, f: number, c: string, b: Book): void {
  rect(x, y, w, 5, b.INK);
  rect(x + 1, y + 1, w - 2, 3, b.PAPER);
  rect(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, f))), 3, c);
}

function drawPic(id: string, x: number, y: number, b: Book): void {
  if (id === 'team') {
    // Four slots: the lead, then three in reserve, with the player's own whorls in them.
    for (let k = 0; k < 4; k++) {
      const sx = x + k * 19;
      rect(sx, y, 18, 18, k === 0 ? b.RED : b.PENCIL);
      rect(sx + 1, y + 1, 16, 16, b.PAPER);
      const m = G.party[k];
      if (m) drawSprite(m.sprite, sx + 1, y + 1, 2);
    }
    textCenter('lead', x + 9, y + 20, b.RED);
    // "reserve" sits under the other three slots, with a rule out to each side of it.
    const w = textWidth('reserve'), mid = x + 19 + 28, l = mid - Math.ceil(w / 2);
    text('reserve', l, y + 20, b.PENCIL);
    rect(x + 20, y + 24, l - 3 - (x + 20), 1, b.PENCIL);
    rect(l + w + 3, y + 24, x + 75 - (l + w + 3), 1, b.PENCIL);
    return;
  }
  if (id === 'stats') {
    // The lead's stats as a battle builds them, against the most a plain whorl reaches at the top level.
    const lead = G.party[0];
    const top = statsAt(LEVEL_MAX) as unknown as Record<string, number>;
    const s = (lead ? makeFighter(lead, 0, 0, false).st : statsAt(25)) as unknown as Record<string, number>;
    const head = lead ? `${lead.name}, level ${lead.level}` : 'Level 25';
    text(textWidth(head) <= COL ? head : lead!.name, x, y, b.PENCIL);
    ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'].forEach((k, n) => {
      const ry = y + 10 + n * 9;
      text(k.toUpperCase(), x, ry, b.RED);
      bar(x + 21, ry + 1, 36, s[k] / top[k], b.BLUE, b);
      textRight(String(s[k]), x + COL, ry, b.INK);
    });
    return;
  }
  if (id === 'armor') {
    // One hit of 100 power against three amounts of DEF.
    [0, 42, 100].forEach((d, n) => {
      const ry = y + n * 9, dmg = Math.round(100 * 100 / (100 + d));
      text(`${d} DEF`, x, ry, b.RED);
      bar(x + 33, ry + 1, 27, dmg / 100, b.BLUE, b);
      textRight(String(dmg), x + COL, ry, b.INK);
    });
    return;
  }
  if (id === 'timeline') {
    // Turn marks for Squall and a slower foe over the same stretch of time, as the battle's clock spaces them.
    const span = 560, x0 = x + 24, w = COL - 24;
    const row = (label: string, agi: number, ry: number, c: string) => {
      text(label, x, ry, c);
      rect(x0, ry + 4, w, 1, b.FAINT);
      for (let t = 50 * 200 / (agi + 100); t < span; t += 100 * 200 / (agi + 100)) rect(x0 + Math.round(t / span * (w - 2)), ry + 1, 2, 7, c);
    };
    row('You', 69, y, b.BLUE);
    row('Foe', 51, y + 11, b.RED);
    rect(x0, y + 25, w - 3, 1, b.PENCIL);
    rect(x0 + w - 4, y + 24, 1, 3, b.PENCIL); rect(x0 + w - 3, y + 25, 1, 1, b.PENCIL);
    text('time', x, y + 22, b.PENCIL);
    return;
  }
  if (id === 'cooldown') {
    // Five of Squall's turns: Flatten used, three turns of rest, then ready.
    for (let k = 0; k < 5; k++) {
      const cx = x + k * 15;
      rect(cx, y, 14, 12, k === 0 ? b.INK : k === 4 ? b.BLUE : b.PENCIL);
      rect(cx + 1, y + 1, 12, 10, k === 0 ? b.INK : b.PAPER);
      if (k === 0) { rect(cx + 6, y + 3, 2, 6, b.PAPER); rect(cx + 4, y + 5, 6, 2, b.PAPER); }
      else if (k === 4) { rect(cx + 3, y + 6, 2, 2, b.BLUE); rect(cx + 5, y + 7, 2, 2, b.BLUE); rect(cx + 7, y + 5, 2, 2, b.BLUE); rect(cx + 9, y + 3, 2, 2, b.BLUE); }
      else textCenter(String(4 - k), cx + 7, y + 2, b.PENCIL);
      textCenter(String(k + 1), cx + 7, y + 14, b.INK);
    }
    return;
  }
  if (id === 'tide') {
    // The pool with 5 of 10 tide.
    for (let k = 0; k < 10; k++) waves(x + k * 7, y + 1, k < 5 ? '#e8903a' : b.PAPER, k < 5 ? b.INK : b.FAINT);
    return;
  }
  if (id === 'types' || id === 'typesAll') {
    // Rows are the move's type and columns the foe's: a plus where the move is strong, a bar where it is weak.
    const ts = TYPES.slice(0, 6), cw = 10;
    ts.forEach((t, n) => sigil(t, x + 11 + n * cw, y, mix(TYPE_COLOR[t], b.INK, 0.3)));
    ts.forEach((a, r) => {
      const ry = y + 10 + r * 9;
      sigil(a, x, ry, mix(TYPE_COLOR[a], b.INK, 0.3));
      ts.forEach((d, c) => {
        const cx = x + 11 + c * cw, m = typeMult(a, [d]);
        if ((r + c) % 2 === 0) rect(cx - 1, ry - 1, cw, 9, mix(b.PAPER, b.FAINT, 0.35));
        if (m > 1) { rect(cx + 3, ry + 1, 1, 5, GOODINK); rect(cx + 1, ry + 3, 5, 1, GOODINK); }
        else if (m < 1) rect(cx + 1, ry + 3, 5, 1, b.RED);
      });
    });
    return;
  }
  if (id === 'horn') {
    // An HP bar with a Periwinkle horn's line at 25%, and the foe's HP under it.
    text('HP', x, y + 9, b.RED);
    bar(x + 14, y + 10, 60, 0.2, b.RED, b);
    const lx = x + 15 + Math.round(58 * 0.25);
    rect(lx, y + 8, 1, 9, b.INK);
    textCenter('line', lx, y, b.INK);
    text('under the line', x, y + 17, b.PENCIL);
    return;
  }
  if (id === 'nacre') {
    text('ATK', x, y, b.RED);
    for (let k = 0; k < 6; k++) rect(x + 21 + k * 6, y + 2, 4, 4, '#c8b8d8');
    for (let k = 0; k < 6; k++) { rect(x + 21 + k * 6, y + 2, 4, 1, b.INK); rect(x + 21 + k * 6, y + 5, 4, 1, b.INK); }
    textRight(`+${tanBonus(LEVEL_MAX, 'atk', 6)}`, x + COL, y, b.INK);
    return;
  }
  if (id === 'caps' || id === 'strandCaps') {
    // How far whorls can grow for each pearl, or on the Strand for each star grain.
    const caps = id === 'caps' ? CAPS : STRAND_CAPS, unit = id === 'caps' ? 'Pearls' : 'Grains';
    const per = Math.ceil(caps.length / 2);
    for (const col of [0, 1]) {
      const cx = x + col * 40;
      text(unit, cx, y, b.PENCIL);
      textRight('Cap', cx + 36, y, b.PENCIL);
      caps.slice(col * per, col * per + per).forEach((c, n) => {
        const i = col * per + n, ry = y + 10 + n * 9;
        text(i === caps.length - 1 ? `${i}+` : String(i), cx, ry, b.INK);
        textRight(String(c), cx + 36, ry, b.RED);
      });
    }
    if (id === 'caps' && G.flags.postgame) text(`After the story, ${LEVEL_MAX}`, x, y + 10 + per * 9, b.INK);
    return;
  }
  if (id === 'fatigue') {
    // HP lost in the first four rounds of fatigue.
    [1, 2, 3, 4].forEach((n, r) => {
      const ry = y + r * 9;
      text(String(FATIGUE_ROUND + n), x, ry, b.INK);
      rect(x + 14, ry + 2, n * 10, 4, b.RED);
      text(`${n * 5}%`, x + 18 + n * 10, ry, b.PENCIL);
    });
  }
}

// ---------------------------------------------------------------- pages

/** Draws the part of a sheet scrolled into the window from `top` to `bottom`, with its column at x. Nothing draws outside the window. */
export function drawSheet(sh: Sheet, x: number, top: number, bottom: number, scroll: number, b: Book): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2, top - 1, sh.width + 4, bottom - top + 1);
  ctx.clip();
  const px = x + Math.floor((sh.width - COL) / 2);
  for (const it of sh.items) {
    const y = top + it.y - scroll, h = it.k === 'pic' ? picHeight(it.pic) : LINE;
    if (y > bottom || y + h < top) continue;
    // A line of text shows only whole, so scrolling never cuts letters in half. Pictures are cut at the window's edge.
    if (it.k !== 'pic' && (y < top || y + LINE - 1 > bottom)) continue;
    if (it.k === 'title') text(it.s, x, y, b.INK);
    else if (it.k === 'rule') { for (let k = 0; k < sh.width; k += 3) rect(x + k, y + ((k >> 2) & 1), 1, 1, b.PENCIL); }
    else if (it.k === 'line') {
      if (it.red) text(it.s.slice(it.red), text(it.s.slice(0, it.red), x + it.x, y, b.RED), y, b.INK);
      else text(it.s, x + it.x, y, it.head ? b.RED : b.INK);
    } else if (it.k === 'icon') rowIcon(it.icon, x, y, b);
    else drawPic(it.pic, px, y, b);
  }
  ctx.restore();
}

/** Chapters on the left page of the contents, under its heading. The rest go on the right page. */
export const CONTENTS_LEFT = 10;
const ROW_H = 12;

/** The contents: every chapter, with ??? for any not met yet and a dot by any not read yet. */
export function drawContents(sel: number, lx: number, rx: number, top: number, b: Book): void {
  bigText('Guide', lx, top - 1, 2, b.INK);
  for (let k = 0; k < COL; k += 3) rect(lx + k, top + 16 + ((k >> 2) & 1), 1, 1, b.PENCIL);
  GUIDE.forEach((ch, i) => {
    const left = i < CONTENTS_LEFT;
    const x = left ? lx : rx, y = left ? top + 22 + i * ROW_H : top + (i - CONTENTS_LEFT) * ROW_H;
    const open = ch.open();
    if (open) chapterIcon(ch.icon, x, y + 1, b); else bits('locked', x, y + 1, b.FAINT);
    const name = !open ? '???' : textWidth(ch.title) <= COL - 17 ? ch.title : ch.short || ch.title;
    text(name, x + 11, y + 1, open ? b.INK : b.PENCIL);
    if (open && !G.flags['guide:' + ch.id]) rect(x + 12 + textWidth(name) + 2, y + 4, 2, 2, b.RED);
    if (i === sel) b.corners(x - 2, y - 1, COL + 3, ROW_H, b.INK);
  });
}
