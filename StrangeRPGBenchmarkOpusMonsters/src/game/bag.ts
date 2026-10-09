// The Bag: pockets as tabs, a scrolling list with an icon for every item, a panel that describes the one picked, and its actions.
import { HORN_LINE } from '../battle/engine';
import type { Mon } from '../battle/model';
import { NOTIONS } from '../battle/registry';
import { NOTION_IDS } from '../data/notions';
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { sfx } from '../engine/audio';
import { dither, frame, mix, rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { say } from './dialogue';
import { FIELD_ITEMS, ITEMS } from './items';
import { KEY_NAMES, KEY_TEXT, KEY_USE } from './menus';
import { close, run, type Mode } from './modes';
import { PUZZLE_BY_ID } from './setting/puzzles';
import { G, HORN_NAME, levelOf, save } from './state';
import { DIM, PAPER, SEL } from './ui';

// ---------------------------------------------------------------- icons

/** An 8 by 8 icon: rows of '.', '1' for ink, and 'a' to 'd' for its own colors. */
export interface Icon { px: string[]; c: string[] }
const I = (px: string[], ...c: string[]): Icon => ({ px, c });

const HORN = ['...11...', '..1aa1..', '.1abba1.', '1abbcba1', '1abccba1', '.1abba1.', '..1aa11.', '...11.11'];
const ICONS: Record<string, Icon> = {
  twig: I(HORN, '#c8b090', '#a08060', '#e8d8b8'),
  brass: I(HORN, '#e0b060', '#b08030', '#f8e0a0'),
  bone: I(HORN, '#e8e0d0', '#b8a890', '#ffffff'),
  iron: I(HORN, '#d07850', '#e8d0b0', '#ffffff'),
  saltline: I(['..1111..', '...11...', '..1aa1..', '.1aaaa1.', '1aabaaa1', '1aaaaba1', '1aaaaaa1', '.111111.'], '#e8e8f0', '#b0b0c0'),
  lure: I(['b.....b.', '...11...', '..1aa1..', '.1aaaa1.', '1aacaaa1', '1aaaaca1', '.11aa11.', '...11...'], '#f0a0b0', '#fff4c4', '#ffffff'),
  whistle: I(['........', '.111111.', '1aaaaab1', '1aa11ab1', '.1111ab1', '....1ab1', '....111.', '........'], '#c8a040', '#806020'),
  seabiscuit: I(['..1111..', '.1aaaa1.', '1aabaab1', '1aaaaaa1', '1abaaba1', '1aaaaaa1', '.1aaaa1.', '..1111..'], '#d8a860', '#8a5a30'),
  smellingsalt: I(['...11...', '..1bb1..', '...11...', '..1aa1..', '.1aaaa1.', '.1acaa1.', '.1aaaa1.', '..1111..'], '#a0d8c8', '#c08040', '#ffffff'),
  tidejar: I(['.111111.', '.1bbbb1.', '1aaaaaa1', '1acaaaa1', '1aaaaca1', '1aaaaaa1', '1aaaaaa1', '.111111.'], '#3a7ac8', '#c8c0b0', '#a0e0ff'),
  cuttlebone: I(['........', '..1111..', '.1aaaa1.', '1abaaba1', '1aaaaaa1', '.1abba1.', '..1111..', '........'], '#f0ece0', '#c8c0a8'),
  pepperkelp: I(['......1.', '....11a1', '...1aaa1', '..1abaa1', '.1abaa1.', '1abaa1..', '1aa11...', '.11.....'], '#c84a3a', '#f08060'),
  beachglass: I(['........', '...111..', '..1abb1.', '.1aaab1.', '1aaaaa1.', '1aaaa1..', '.1111...', '........'], '#5ab08a', '#a8e8c8'),
  saltcake: I(['........', '.111111.', '1bbbbbb1', '1aaaaaa1', '1aaaaaa1', '1aaaaaa1', '.111111.', '........'], '#d8d8e0', '#ffffff'),
  ridertin: I(['.111111.', '1bbbbbb1', '1aaaaaa1', '1acccca1', '1acccca1', '1aaaaaa1', '1bbbbbb1', '.111111.'], '#9aa0a8', '#c8ccd0', '#c84a3a'),
  bellchip: I(['........', '...11...', '..1ab1..', '.1aaab1.', '1aaaa1..', '.1aa1...', '..11....', '........'], '#c8a040', '#fff0a0'),
  rainjar: I(['.111111.', '.1bbbb1.', '1aaacaa1', '1acaaaa1', '1aaaaca1', '1acaaaa1', '1aaaaaa1', '.111111.'], '#a8c8e8', '#c8a060', '#ffffff'),
  moonsilt: I(['...11...', '..1bb1..', '...11...', '.1aaaa1.', '1aacaaa1', '1aaaaca1', '1aaaaaa1', '.111111.'], '#a8b0d8', '#8a6a4a', '#ffffff'),
  starglass: I(['...1....', '..1a1...', '.1aba1..', '1aabaa11', '.11aab1.', '..1aa1..', '.1a11a1.', '.1....1.'], '#c8a0ff', '#ffffff'),
  ambergris: I(['........', '..1111..', '.1aaba1.', '1aaaaab1', '1abaaaa1', '.1aaaa1.', '..1111..', '........'], '#a09a8a', '#c8c2b0'),
  lore_kettle: I(['...11...', '..1aa1..', '.1aaaa11', '1aaaaa1a', '1aabaa1a', '1aaaaa11', '.1aaaa1.', '..1111..'], '#9aa0a8', '#ffffff'),
  lore_door: I(['.111111.', '1aaaaaa1', '1abaaba1', '1aaaaaa1', '1aaaaca1', '1abaaba1', '1aaaaaa1', '11111111'], '#8a5a3a', '#5a3a2a', '#f0d8c8'),
  lore_window: I(['11111111', '1aaa1aa1', '1aba1ab1', '11111111', '1aaa1aa1', '1aba1ab1', '11111111', '........'], '#3a5ab0', '#a0c0f0'),
  lore_chair: I(['.1......', '.1a1....', '.1a1....', '.1a1....', '.1aaaa1.', '.111111.', '.1a..a1.', '.11..11.'], '#b07a4a'),
  lore_vane: I(['....1...', '...1a1..', '1111a111', '1aaaaaa1', '1111a111', '...1a1..', '....1...', '....1...'], '#c8a040'),
  lore_tub: I(['........', '1......1', '1aaaaaa1', '1bbbbbb1', '1aaaaaa1', '1aaaaaa1', '.1aaaa1.', '..1111..'], '#8a5a3a', '#6ab0d0'),
  lore_step: I(['........', '........', '.111111.', '1aaaaaa1', '1abaaba1', '1aaaaaa1', '11111111', '........'], '#9a9890', '#7a7872'),
  lore_gate: I(['.1.1.1.1', '1a1a1a1a', '1a1a1a1a', '11111111', '1a1a1a1a', '11111111', '1a1a1a1a', '1.1.1.1.'], '#e8e0c8'),
  register: I(['.111111.', '1aaaaab1', '1acccab1', '1aaaaab1', '1acccab1', '1aaaaab1', '1aaaaab1', '.111111.'], '#8a3a3a', '#e8e0d0', '#c8a040'),
  letter: I(['........', '11111111', '1b1aa1b1', '1ab11ba1', '1aaa1aa1', '1aaaaaa1', '11111111', '........'], '#e8e0d0', '#c8c0a8'),
  prisingiron: I(['......11', '.....1a1', '....1a1.', '...1a1..', '..1a1...', '.1a1....', '1aa1....', '111.....'], '#9aa0a8'),
  stilts: I(['.1....1.', '1a1..1a1', '1b1..1b1', '1a1..1a1', '1a1..1a1', '1a1..1a1', '1a1..1a1', '.1....1.'], '#b07a4a', '#e8e0d0'),
  jingle: I(['...11...', '..1aa1..', '.1aaaa1.', '.1abaa1.', '.1aaaa1.', '1aaaaaa1', '11111111', '...11...'], '#e8c060', '#fff4c4'),
  haul: I(['..1111..', '.1aaba1.', '1ab11ab1', '1a1..1a1', '1ab11ba1', '.1abaa1.', '..11a1..', '....11..'], '#c8a060', '#8a6a3a'),
  chart: I(['.111111.', '1baaaab1', '.1acaa1.', '.1aaca1.', '.1caaa1.', '.1aaaa1.', '1baaaab1', '.111111.'], '#e8dcc0', '#a08060', '#3a6ab0'),
  whelk: I(['.....11.', '....1aa1', '...1aba1', '..1abaa1', '.1abaa1.', '1abaa1..', '1aa11...', '.11.....'], '#e8d8c8', '#c8a090'),
  gemboard: I(['11111111', '1aaaaaa1', '1abddba1', '1adccda1', '1adccda1', '1abddba1', '1aaaaaa1', '11111111'], '#8a5a3a', '#c8a040', '#e86a8a', '#3a2a20'),
  pearl: I(['........', '..1111..', '.1aaab1.', '1aaaaab1', '1aaaaaa1', '1caaaaa1', '.1caaa1.', '..1111..'], '#f4ecf8', '#ffffff', '#c8b8d8'),
  key: I(['.111....', '1a.a1...', '1a.a1...', '.1aa111.', '...1aaa1', '...1a1a1', '...1a1..', '....1...'], '#c8a040'),
  sketch: I(['111111..', '1aaaa11.', '1abba1c1', '1aaaaa11', '1abaab1.', '1aaaaa1.', '1aabba1.', '1111111.'], '#f0ece0', '#5a6ab0', '#d04040'),
};

/** Held notions are many, so they share icons by kind, each in its own color. */
const NOTION_SHAPES: Record<string, string[]> = {
  stone: ['........', '..1111..', '.1abaa1.', '1abaaaa1', '1aaaaca1', '1aaacaa1', '.1aaaa1.', '..1111..'],
  coat: ['.11..11.', '1ab11ba1', '1aaaaaa1', '.1aaaa1.', '.1abaa1.', '.1aaba1.', '.1aaaa1.', '.111111.'],
  blade: ['......11', '.....1b1', '....1ba1', '...1ba1.', '.11ba1..', '.1c11...', '1c1.....', '11......'],
  ring: ['...11...', '..1bb1..', '.111111.', '1a1..1a1', '1a1..1a1', '1a1..1a1', '.1aaaa1.', '..1111..'],
  vial: ['...11...', '..1cc1..', '...11...', '..1ab1..', '.1abaa1.', '.1aaaa1.', '.1aaaa1.', '..1111..'],
  plant: ['..1..1..', '.1a11a1.', '.1aaaa1.', '..1aa1..', '...11...', '..1bb1..', '..1bb1..', '...11...'],
  boots: ['.111....', '.1a1....', '.1a1....', '.1a1....', '.1aa111.', '.1aaaab1', '.1bbbbb1', '.111111.'],
  gear: ['.1.11.1.', '1a1aa1a1', '.1aaaa1.', '1aa11aa1', '1aa11aa1', '.1aaaa1.', '1a1aa1a1', '.1.11.1.'],
};
const SHAPE_OF: [RegExp, string][] = [
  [/stone|iron|pebble/, 'stone'], [/coat|vest|plate|skin|hood/, 'coat'], [/cleaver|knife|bodkin|shard|edge/, 'blade'],
  [/ring|ribbon|crown|necklace|seal/, 'ring'], [/glass|tear|cup|bead/, 'vial'], [/root|chrysalis|plug|wax/, 'plant'],
  [/boots|shin|chalk/, 'boots'],
];
const NOTION_COLORS = ['#c84a4a', '#4a7ac8', '#c8a040', '#4a9a5a', '#a05ac8', '#c87a3a', '#3ab0a8', '#d86a9a'];

export function iconOf(id: string, kind: Entry['kind']): Icon {
  if (ICONS[id]) return ICONS[id];
  if (kind === 'notion') {
    const shape = SHAPE_OF.find(([re]) => re.test(id))?.[1] ?? 'gear';
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const a = NOTION_COLORS[h % NOTION_COLORS.length];
    return I(NOTION_SHAPES[shape], a, mix(a, '#ffffff', 0.5), '#e8e0d0');
  }
  if (kind === 'lore') return ICONS.lore_gate;
  if (kind === 'sketch') return ICONS.sketch;
  if (id.startsWith('scale')) return ICONS.pearl;
  return ICONS.key;
}

export function drawIcon(ic: Icon, x: number, y: number, s = 1): void {
  ic.px.forEach((row, j) => {
    for (let i = 0; i < 8; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      rect(x + i * s, y + j * s, s, s, ch === '1' ? INK : ic.c['abcd'.indexOf(ch)] ?? ic.c[0]);
    }
  });
}

// ---------------------------------------------------------------- pockets

export interface Entry { id: string; name: string; count: number | null; text: string; kind: 'horn' | 'item' | 'spent' | 'notion' | 'key' | 'find' | 'lore' | 'sketch'; sell?: number; order: number }
interface Pocket { name: string; color: string; icon: Icon; list: () => Entry[] }

export const HORN_TEXT: Record<string, string> = {
  twig: `Its line is at ${Math.round(HORN_LINE.twig * 100)}% of the foe's HP. It always works when the foe is at or under the line.`,
  brass: `Its line is at ${Math.round(HORN_LINE.brass * 100)}% of the foe's HP. It always works when the foe is at or under the line.`,
  bone: `Its line is at ${Math.round(HORN_LINE.bone * 100)}% of the foe's HP. It always works when the foe is at or under the line.`,
  iron: 'It always works on a wild whorl.',
};

const isLore = (k: string) => k.startsWith('lore_');

const POCKETS: Pocket[] = [
  { name: 'Items', color: '#e8b040', icon: ICONS.twig, list: () => [
    ...(Object.keys(HORN_NAME) as (keyof typeof G.pegs)[]).filter(k => G.pegs[k] > 0).map((k, i) => ({ id: k, name: HORN_NAME[k], count: G.pegs[k], text: HORN_TEXT[k], kind: 'horn' as const, order: i })),
    ...FIELD_ITEMS.filter(id => (G.items[id] || 0) > 0).map((id, i) => ({ id, name: ITEMS[id].name, count: G.items[id], text: ITEMS[id].text, kind: 'item' as const, order: 10 + i })),
    ...NOTION_IDS.filter(id => NOTIONS[id]?.spent && (G.notions[id] || 0) > 0).map((id, i) => ({ id, name: NOTIONS[id].name, count: G.notions[id], text: NOTIONS[id].text, kind: 'spent' as const, order: 20 + i })),
  ] },
  { name: 'Notions', color: '#7ab0d8', icon: I(NOTION_SHAPES.ring, '#7ab0d8', '#c8e0f0'), list: () =>
    NOTION_IDS.filter(id => NOTIONS[id] && !NOTIONS[id].spent && (G.notions[id] || 0) > 0).map((id, i) => ({ id, name: NOTIONS[id].name, count: G.notions[id], text: NOTIONS[id].text, kind: 'notion' as const, order: i })) },
  { name: 'Key items', color: '#d8a0a8', icon: ICONS.key, list: () =>
    G.keys.filter(k => !isLore(k)).map((k, i) => ({ id: k, name: KEY_NAMES[k] || k, count: null, text: KEY_TEXT[k] || '', kind: 'key' as const, order: i })) },
  { name: 'Finds', color: '#7ac86a', icon: ICONS.beachglass, list: () =>
    Object.keys(ITEMS).filter(id => !FIELD_ITEMS.includes(id) && (G.items[id] || 0) > 0).map((id, i) => ({ id, name: ITEMS[id].name, count: G.items[id], text: ITEMS[id].text, kind: 'find' as const, sell: ITEMS[id].sell, order: i })) },
  { name: 'Lore', color: '#c8a0e0', icon: ICONS.lore_kettle, list: () =>
    G.keys.filter(isLore).map((k, i) => ({ id: k, name: KEY_NAMES[k] || k, count: null, text: KEY_TEXT[k] || '', kind: 'lore' as const, order: i })) },
  { name: 'Sketches', color: '#e8e0c8', icon: ICONS.sketch, list: () =>
    (G.gem?.found || []).filter(id => PUZZLE_BY_ID[id]).map((id, i) => ({ id, name: PUZZLE_BY_ID[id].name, count: null, text: PUZZLE_BY_ID[id].idea, kind: 'sketch' as const, order: i })) },
];

/** What each pocket shows first and how it sorts, kept between visits to the Bag. */
const memory = { pocket: 0, sel: POCKETS.map(() => 0), ids: POCKETS.map(() => ''), scroll: POCKETS.map(() => 0), byName: POCKETS.map(() => false) };

function entries(p: number): Entry[] {
  const list = POCKETS[p].list();
  return memory.byName[p] ? list.sort((a, b) => a.name.localeCompare(b.name)) : list.sort((a, b) => a.order - b.order);
}

/** What can be done with an entry. */
function actionsFor(e: Entry): string[] {
  switch (e.kind) {
    case 'item': return ITEMS[e.id].use ? ['Use', 'Toss'] : ['Toss'];
    case 'horn': return ['Toss'];
    case 'spent': case 'notion': return ['Give', 'Take', 'Toss'];
    case 'key': return [...(KEY_USE[e.id] ? ['Use'] : []), ...(KEY_TEXT[e.id] ? ['Read'] : [])];
    case 'find': return ['Toss'];
    case 'lore': return ['Read'];
    case 'sketch': return ['Read', ...(KEY_USE.gemboard && G.keys.includes('gemboard') ? ['Set'] : [])];
  }
}

function countOf(e: Entry): number {
  if (e.kind === 'horn') return G.pegs[e.id as keyof typeof G.pegs] || 0;
  if (e.kind === 'spent' || e.kind === 'notion') return G.notions[e.id] || 0;
  return G.items[e.id] || 0;
}

function toss(e: Entry, n: number): void {
  if (e.kind === 'horn') G.pegs[e.id as keyof typeof G.pegs] -= n;
  else if (e.kind === 'spent' || e.kind === 'notion') G.notions[e.id] -= n;
  else G.items[e.id] -= n;
}

// ---------------------------------------------------------------- the screen

const ROW = 11, LIST_Y = 38, ROWS = 8;
const BG = '#17151d';

type Sub = { kind: 'list' } | { kind: 'acts'; acts: string[]; i: number } | { kind: 'count'; n: number; max: number } | { kind: 'team'; i: number; take: boolean };

class BagMode implements Mode {
  opaque = true;
  t = 0;
  sub: Sub = { kind: 'list' };
  /** Smoothed cursor row and the sideways slide after a pocket change. */
  curY = 0;
  slide = 0;
  toast = '';
  toastT = 0;
  busy = false;

  constructor(public done: (closeMenu: boolean) => void) { this.curY = this.sel; }

  get list(): Entry[] { return entries(memory.pocket); }
  /** The remembered item's row, or the nearest row to where it was when it is gone. */
  get sel(): number {
    const list = this.list, p = memory.pocket;
    const at = memory.ids[p] ? list.findIndex(e => e.id === memory.ids[p]) : -1;
    return at >= 0 ? at : Math.max(0, Math.min(list.length - 1, memory.sel[p]));
  }
  set sel(v: number) { memory.sel[memory.pocket] = v; memory.ids[memory.pocket] = this.list[v]?.id || ''; }
  get scroll(): number { return memory.scroll[memory.pocket]; }
  set scroll(v: number) { memory.scroll[memory.pocket] = v; }

  note(s: string): void { this.toast = s; this.toastT = 120; }

  update(): void {
    this.t++;
    if (this.toastT > 0) this.toastT--;
    if (this.busy) return;
    const list = this.list, e = list[this.sel];
    const sub = this.sub;
    if (sub.kind === 'acts') {
      if (input.hit('up')) { sub.i = (sub.i + sub.acts.length - 1) % sub.acts.length; sfx('move'); }
      if (input.hit('down')) { sub.i = (sub.i + 1) % sub.acts.length; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'list' }; sfx('back'); return; }
      if (input.hit('ok') && e) { sfx('ok'); this.act(e, sub.acts[sub.i]); }
      return;
    }
    if (sub.kind === 'count') {
      if (input.hit('up') || input.hit('right')) { sub.n = sub.n >= sub.max ? 1 : sub.n + 1; sfx('move'); }
      if (input.hit('down') || input.hit('left')) { sub.n = sub.n <= 1 ? sub.max : sub.n - 1; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'list' }; sfx('back'); return; }
      if (input.hit('ok') && e) { toss(e, sub.n); sfx('back'); this.note(`Tossed ${sub.n} ${e.name}.`); this.sub = { kind: 'list' }; save(); }
      return;
    }
    if (sub.kind === 'team') {
      const team = G.party;
      if (input.hit('up')) { sub.i = (sub.i + team.length - 1) % team.length; sfx('move'); }
      if (input.hit('down')) { sub.i = (sub.i + 1) % team.length; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'list' }; sfx('back'); return; }
      if (input.hit('ok') && team[sub.i]) this.pick(team[sub.i], sub.take, e);
      return;
    }
    // The list: up and down move, left and right change pocket, V sorts, Z opens the actions, X closes the Bag.
    const n = list.length;
    if (input.hit('up') && n) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
    if (input.hit('down') && n) { this.sel = (this.sel + 1) % n; sfx('move'); }
    if (input.hit('left') || input.hit('right')) {
      const d = input.hit('left') ? -1 : 1;
      memory.pocket = (memory.pocket + POCKETS.length + d) % POCKETS.length;
      this.slide = 18 * d; this.curY = this.sel; sfx('move');
    }
    if (input.hit('menu')) { memory.byName[memory.pocket] = !memory.byName[memory.pocket]; sfx('switch'); }
    if (input.hit('back')) { sfx('back'); close(this); this.done(false); return; }
    if (input.hit('ok') && e) {
      const acts = actionsFor(e);
      if (!acts.length) { sfx('bump'); return; }
      sfx('ok');
      this.sub = { kind: 'acts', acts, i: 0 };
    }
  }

  act(e: Entry, a: string): void {
    this.sub = { kind: 'list' };
    if (a === 'Toss') { const max = countOf(e); if (max > 0) this.sub = { kind: 'count', n: 1, max }; return; }
    if (a === 'Give' || a === 'Take') {
      if (!G.party.length) { this.note('No whorls to hold it.'); return; }
      this.sub = { kind: 'team', i: 0, take: a === 'Take' };
      return;
    }
    // Using an item, reading, and setting run a scene over the Bag, so the Bag waits until it ends.
    this.busy = true;
    void (async () => {
      let closeMenu = false;
      if (a === 'Use') closeMenu = e.kind === 'key' ? await KEY_USE[e.id]() : !!(await ITEMS[e.id].use?.());
      else if (a === 'Read') await say(null, e.kind === 'sketch' ? `${e.name}. ${e.text}` : e.text);
      else if (a === 'Set') closeMenu = await KEY_USE.gemboard();
      this.busy = false;
      if (closeMenu) { close(this); this.done(true); }
    })();
  }

  /** Gives the picked notion to a whorl, swapping back what it held, or takes a whorl's notion back into the Bag. */
  pick(m: Mon, take: boolean, e: Entry | undefined): void {
    this.sub = { kind: 'list' };
    if (take) {
      if (!m.notion) { sfx('bump'); this.note(`${m.name} holds nothing.`); return; }
      G.notions[m.notion] = (G.notions[m.notion] || 0) + 1;
      this.note(`Took the ${NOTIONS[m.notion]?.name || m.notion} back.`);
      m.notion = null;
    } else if (e) {
      if (m.notion === e.id) { sfx('bump'); this.note(`${m.name} already holds one.`); return; }
      if (m.notion) G.notions[m.notion] = (G.notions[m.notion] || 0) + 1;
      G.notions[e.id]--;
      m.notion = e.id;
      this.note(`${m.name} holds the ${e.name}.`);
    }
    sfx('ok');
    save();
  }

  draw(): void {
    rect(0, 0, 192, 192, BG);
    const P = POCKETS[memory.pocket], list = this.list, sel = this.sel;
    // Pocket tabs across the top. The open one rises and takes its pocket's color.
    POCKETS.forEach((p, k) => {
      const x = 4 + k * 31, on = k === memory.pocket, y = on ? 2 : 4;
      frame(x, y, 29, 20, on ? mix(p.color, BG, 0.65) : '#211e2a', on ? p.color : '#3a3442');
      drawIcon(p.icon, x + 7, y + 3 + (on && Math.floor(this.t / 30) % 2 ? -1 : 0), 2);
    });
    rect(0, 23, 192, 1, P.color);
    textCenter(P.name, 96, 26, P.color);
    text('<', 6, 26, DIM); text('>', 182, 26, DIM);
    textRight(memory.byName[memory.pocket] ? 'V: by name' : 'V: by kind', 176, 26, '#4a4660');
    // The list, sliding in from the side after a pocket change, with a highlight that glides to the picked row.
    this.slide = Math.trunc(this.slide * 0.7);
    this.curY += (sel - this.curY) * 0.35;
    this.scroll = Math.min(this.scroll, Math.max(0, list.length - ROWS));
    if (sel < this.scroll) this.scroll = sel;
    if (sel >= this.scroll + ROWS) this.scroll = sel - ROWS + 1;
    const ox = this.slide;
    if (!list.length) textCenter('Nothing here yet.', 96 + ox, LIST_Y + 30, DIM);
    else {
      const hy = LIST_Y + (this.curY - this.scroll) * ROW;
      if (hy >= LIST_Y - 2 && hy < LIST_Y + ROWS * ROW) rect(4, Math.round(hy) - 1, 184, ROW, mix(P.color, BG, 0.75));
      for (let k = 0; k < ROWS; k++) {
        const e = list[this.scroll + k];
        if (!e) break;
        const y = LIST_Y + k * ROW, on = this.scroll + k === sel;
        drawIcon(iconOf(e.id, e.kind), 8 + ox, y, 1);
        text(e.name, 20 + ox, y, on ? SEL : PAPER);
        if (e.count !== null) textRight(`x${e.count}`, 186 + ox, y, on ? SEL : DIM);
      }
      if (this.scroll > 0) for (let k = 0; k < 3; k++) rect(184 - k, LIST_Y - 4 + k, 1 + k * 2, 1, DIM);
      if (this.scroll + ROWS < list.length) for (let k = 0; k < 3; k++) rect(184 - k, LIST_Y + ROWS * ROW - k, 1 + k * 2, 1, DIM);
    }
    textCenter(`${G.rind} cowries    ${G.tan} nacre`, 96, LIST_Y + ROWS * ROW + 2, '#6a6478');
    // The panel: the picked item's icon large, its name, its text, and what a grotto pays for it.
    const py = 140;
    frame(2, py - 4, 188, 54, '#1e1b26', P.color);
    const e = list[sel];
    if (e) {
      frame(6, py, 20, 20, mix(P.color, BG, 0.7), '#3a3442');
      drawIcon(iconOf(e.id, e.kind), 8, py + 2, 2);
      text(e.name, 30, py, P.color);
      // A price or a held count takes the last line, so the text keeps to three lines then.
      const holders = e.kind === 'notion' || e.kind === 'spent' ? G.party.filter(m => m.notion === e.id).length : 0;
      const foot = e.sell ? `Sells for ${e.sell}` : holders ? `${holders} held by your team` : '';
      wrap(e.text, 154).slice(0, foot ? 3 : 4).forEach((l, j) => text(l, 30, py + 10 + j * 9, PAPER));
      if (foot) textRight(foot, 186, py + 39, DIM);
    }
    if (this.toastT > 0) {
      const w = textWidth(this.toast) + 10;
      frame(96 - w / 2, py - 18, w, 13, '#2a2632', SEL);
      textCenter(this.toast, 96, py - 15, PAPER);
    }
    this.drawSub(e);
    // The Bag comes up out of black, as every screen does.
    if (this.t < 10) dither(0, 0, 192, 192, INK, 1 - this.t / 10);
  }

  drawSub(e: Entry | undefined): void {
    const sub = this.sub;
    if (sub.kind === 'acts') {
      const w = 56, h = sub.acts.length * 10 + 6, x = 130, y = 128 - h;
      frame(x, y, w, h, '#211e2a', SEL);
      sub.acts.forEach((a, k) => text(a, x + 12, y + 4 + k * 10, k === sub.i ? SEL : PAPER));
      text('\u0001', x + 4, y + 4 + sub.i * 10, SEL);
    } else if (sub.kind === 'count' && e) {
      frame(40, 92, 112, 34, '#211e2a', SEL);
      textCenter(`Toss how many ${e.name}?`.length > 22 ? 'Toss how many?' : `Toss how many ${e.name}?`, 96, 97, PAPER);
      textCenter(`< ${sub.n} >`, 96, 110, SEL);
    } else if (sub.kind === 'team') {
      const team = G.party, h = team.length * 14 + 18;
      frame(20, 40, 152, h, '#211e2a', SEL);
      text(sub.take ? 'Take from which whorl?' : 'Give to which whorl?', 26, 44, SEL);
      team.forEach((m, k) => {
        const y = 56 + k * 14, on = k === sub.i;
        if (on) rect(22, y - 2, 148, 12, '#2e2a3a');
        drawSprite(m.sprite, 26, y, 1);
        text(`${m.name} L${levelOf(m)}`, 38, y, on ? SEL : PAPER);
        textRight(m.notion ? NOTIONS[m.notion]?.name || m.notion : 'nothing', 168, y, m.notion ? '#7ab0d8' : DIM);
      });
    }
  }
}

/** Opens the Bag. Resolves true when something used from it should close the start menu too. */
export function bagScreen(): Promise<boolean> {
  return new Promise(res => { void run(new BagMode(res)); });
}
