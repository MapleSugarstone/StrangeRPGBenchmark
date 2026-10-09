// Practice: two teams of three built from any kinds or fittings, fought with tide on and nothing saved.
// The teams stay as they are between battles, so a rematch is one press of Start.
import type { AiLevel, Mon } from '../battle/model';
import { NOTIONS } from '../battle/registry';
import { lastChoice } from '../battle/ai';
import { makeMon, SPECIES, spriteOf, WILD_KINDS } from '../data/species';
import { FORMER_NAMES } from '../data/formernames';
import { NOTION_IDS } from '../data/notions';
import { TYPES, type Type } from '../data/types';
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { dither, frame, rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { battle } from './battleView';
import { designFit } from './fitter';
import { makeFit } from './fitting';
import { LetterGrid } from './files';
import { listMenu, monPage } from './menus';
import { close, run, type Mode } from './modes';
import { debugMenu } from './practiceDebug';
import { drawNight, nightFrame } from './title';
import { box, DIM, MINE, miniSigil, NERVE, PAPER, SEL, THEIRS, typeName, WARN } from './ui';
import { plannedKit, randomFit } from './wildfit';

const PANEL = '#1e1b26', EDGE = '#3a3442', HILITE = '#2a2632';
const AI_LEVELS: AiLevel[] = ['wild', 'trainer', 'keeper', 'champion'];
const SCENES = ['battlefield', 'crater', 'shingle', 'longway', 'gatering', 'stack'];
const ACTS = ['Random kit', 'Pick a kind', 'Random fit', 'Fit by hand', 'Held notion', 'Level', 'Look'];
const SYNC = 25;

/** A team slot: the whorl, and the kinds it was made from. */
interface Slot { m: Mon; kinds: string[] }

const rnd = Math.random;
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const backdrop = () => drawNight(nightFrame(), { dim: 0.6, figures: false });

/** Cuts a string to fit a width, ending it with a period when cut. */
function fit(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  while (s.length > 1 && textWidth(s + '.') > w) s = s.slice(0, -1);
  return s + '.';
}

/** A random kind and kit as a player would build it: half are fittings, as in the planned test field. */
function randomSlot(avoid: string[], level: number): Slot {
  let k = pick(WILD_KINDS);
  while (avoid.includes(k)) k = pick(WILD_KINDS);
  let s: Slot;
  if (rnd() < 0.5) {
    const k2 = pick(WILD_KINDS.filter(x => x !== k));
    s = { m: randomFit(rnd, k, k2, 50), kinds: [k, k2] };
  } else s = { m: makeMon(k, 50), kinds: [k] };
  plannedKit(rnd, s.m);
  s.m.level = level;
  return s;
}

const teams: [Slot[], Slot[]] = [[], []];
let foeAi: AiLevel = 'champion';

function randomTeam(): Slot[] {
  const out: Slot[] = [];
  while (out.length < 3) out.push(randomSlot(out.map(s => s.kinds[0]), SYNC));
  return out;
}

// ---------------------------------------------------------------- kind search

interface Hit { id: string; why: string; rank: number }

/** Every allowed kind matching the query by name, former name, id, or type, best matches first. */
function search(q: string, allow: (id: string) => boolean): Hit[] {
  q = q.trim().toLowerCase();
  const hits: Hit[] = [];
  const type = q.length >= 2 ? TYPES.find(t => t.toLowerCase().startsWith(q)) : undefined;
  for (const id of Object.keys(SPECIES)) {
    if (!allow(id)) continue;
    const sp = SPECIES[id], name = sp.name.toLowerCase(), old = (FORMER_NAMES[id] || '').toLowerCase();
    let rank = -1, why = '';
    if (!q) rank = 3;
    else if (name === q || id === q) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (old.startsWith(q)) { rank = 1; why = `was ${FORMER_NAMES[id]}`; }
    else if (id.startsWith(q)) { rank = 1; why = `id ${id}`; }
    else if (name.includes(q)) rank = 2;
    else if (old && old.includes(q)) { rank = 2; why = `was ${FORMER_NAMES[id]}`; }
    else if (id.includes(q)) { rank = 2; why = `id ${id}`; }
    else if (type && sp.types.includes(type)) { rank = 3; why = typeName(type); }
    if (rank >= 0) hits.push({ id, why, rank });
  }
  return hits.sort((a, b) => a.rank - b.rank || SPECIES[a.id].name.localeCompare(SPECIES[b.id].name));
}

const ROWS = 6, ROW_H = 11, LIST_Y = 31;

/** Finds a kind by typing on the name screen's letter grid. Closes with its id, or null when backed out. */
class FindKind implements Mode {
  opaque = true;
  q = '';
  t = 0;
  grid = new LetterGrid(110, 'List');
  hits: Hit[];
  sel = 0;
  scroll = 0;
  onList = false;

  constructor(readonly title: string, readonly allow: (id: string) => boolean) {
    this.grid.page = 1;
    this.hits = search('', allow);
  }

  retype(q: string): void { this.q = q; this.hits = search(q, this.allow); this.sel = 0; this.scroll = 0; }

  update(): void {
    this.t++;
    const n = this.hits.length;
    if (this.onList) {
      if (input.hit('up') && n) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
      if (input.hit('down') && n) { this.sel = (this.sel + 1) % n; sfx('move'); }
      if (this.sel < this.scroll) this.scroll = this.sel;
      if (this.sel >= this.scroll + ROWS) this.scroll = this.sel - ROWS + 1;
      if (input.hit('back') || input.hit('menu')) { this.onList = false; sfx('back'); return; }
      if (input.hit('ok') && n) { sfx('ok'); close(this, this.hits[this.sel].id); }
      return;
    }
    const g = this.grid;
    g.move();
    if (input.hit('menu')) { if (n) { this.onList = true; sfx('ok'); } else sfx('bump'); return; }
    if (input.hit('back')) {
      if (!this.q) { sfx('back'); close(this, null); return; }
      this.retype(this.q.slice(0, -1)); sfx('back');
    }
    if (!input.hit('ok')) return;
    const ch = g.press();
    if (ch === null) return;
    if (ch === 'del') { if (this.q) { this.retype(this.q.slice(0, -1)); sfx('back'); } return; }
    if (ch === 'done') { if (n) { this.onList = true; sfx('ok'); } else sfx('bump'); return; }
    if (this.q.length >= 14 || (ch === ' ' && (!this.q || this.q.endsWith(' ')))) { sfx('bump'); return; }
    this.retype(this.q + ch);
    sfx('blip');
  }

  draw(): void {
    backdrop();
    text(this.title, 6, 4, SEL, INK);
    textRight(`${this.hits.length} found`, 186, 4, DIM, INK);
    frame(4, 14, 184, 13, PANEL, this.onList ? EDGE : SEL);
    if (this.q) text(this.q, 8, 17, PAPER);
    else text('Name, old name, id, or type', 8, 17, '#5a5468');
    if (!this.onList && (this.t >> 4) % 2) rect(8 + (this.q ? textWidth(this.q) + 1 : 0), 16, 1, 9, SEL);
    frame(4, LIST_Y - 3, 184, ROWS * ROW_H + 4, PANEL, this.onList ? SEL : EDGE);
    if (!this.hits.length) textCenter('No kind matches.', 96, LIST_Y + 25, DIM);
    this.hits.slice(this.scroll, this.scroll + ROWS).forEach((h, k) => {
      const y = LIST_Y + k * ROW_H, on = this.scroll + k === this.sel, sp = SPECIES[h.id];
      if (on) rect(6, y - 2, 180, ROW_H, this.onList ? HILITE : '#24212d');
      drawSprite(makeSprite(h.id), 8, y - 1, 1);
      text(fit(sp.name, 60), 20, y, on && this.onList ? SEL : PAPER);
      if (h.why) text(fit(h.why, 70), 84, y, DIM);
      sp.types.forEach((t, j) => miniSigil(t, 168 + j * 7, y + 1));
    });
    if (this.scroll > 0) textRight('^', 186, LIST_Y - 2, DIM);
    if (this.scroll + ROWS < this.hits.length) textRight('v', 186, LIST_Y + ROWS * ROW_H - 9, DIM);
    this.grid.draw();
    textCenter(this.onList ? 'Z picks it. X goes back to typing.' : 'V or List goes to the list.', 96, 183, DIM, INK);
    if (this.t < 10) dither(0, 0, 192, 192, INK, 1 - this.t / 10);
  }
}

const sprites = new Map<string, Mon['sprite']>();
/** A kind's sprite, made once. */
function makeSprite(id: string): Mon['sprite'] {
  let s = sprites.get(id);
  if (!s) { s = spriteOf(SPECIES[id]); sprites.set(id, s); }
  return s;
}

function findKind(title: string, allow: (id: string) => boolean = () => true): Promise<string | null> {
  return run<string | null>(new FindKind(title, allow));
}

const fittable = (id: string) => !SPECIES[id].person;

// ---------------------------------------------------------------- the builder

type Sub = { kind: 'none' } | { kind: 'acts'; i: number } | { kind: 'level'; v: number };

class Builder implements Mode {
  opaque = true;
  t = 0;
  /** The cursor: column 0 is You and 1 is Foe; rows 0 to 2 are the slots, 3 and 4 the buttons under them. */
  cx = 1;
  cy = 4;
  sub: Sub = { kind: 'none' };
  busy = false;
  note = '';
  noteT = 0;

  constructor() {
    if (!teams[0].length) teams[0] = randomTeam();
    if (!teams[1].length) teams[1] = randomTeam();
  }

  say(s: string): void { this.note = s; this.noteT = 150; }

  slot(): Slot { return teams[this.cx][this.cy]; }

  synced(): boolean { return [...teams[0], ...teams[1]].every(s => s.m.level === SYNC); }

  update(): void {
    this.t++;
    if (this.noteT > 0) this.noteT--;
    if (this.busy) return;
    const sub = this.sub;
    if (sub.kind === 'acts') {
      if (input.hit('up')) { sub.i = (sub.i + ACTS.length - 1) % ACTS.length; sfx('move'); }
      if (input.hit('down')) { sub.i = (sub.i + 1) % ACTS.length; sfx('move'); }
      if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
      if (input.hit('ok')) { sfx('ok'); this.sub = { kind: 'none' }; this.act(ACTS[sub.i]); }
      return;
    }
    if (sub.kind === 'level') {
      const step = (d: number) => { sub.v = Math.max(1, Math.min(50, sub.v + d)); sfx('move'); };
      if (input.hit('left')) step(-1);
      if (input.hit('right')) step(1);
      if (input.hit('down')) step(-5);
      if (input.hit('up')) step(5);
      if (input.hit('back')) { this.sub = { kind: 'none' }; sfx('back'); return; }
      if (input.hit('ok')) { this.slot().m.level = sub.v; this.sub = { kind: 'none' }; sfx('ok'); }
      return;
    }
    if (input.hit('up')) { this.cy = (this.cy + 4) % 5; sfx('move'); }
    if (input.hit('down')) { this.cy = (this.cy + 1) % 5; sfx('move'); }
    if (input.hit('left') || input.hit('right')) { this.cx = 1 - this.cx; sfx('move'); }
    if (input.hit('menu') && this.cy < 3) { sfx('ok'); this.wait(monPage(this.slot().m)); return; }
    if (input.hit('back')) { sfx('back'); close(this); return; }
    if (!input.hit('ok')) return;
    if (this.cy < 3) { sfx('ok'); this.sub = { kind: 'acts', i: 0 }; return; }
    const button = this.cy === 3 ? (this.cx === 0 ? 'random' : 'swap') : this.cx === 0 ? 'ai' : 'start';
    if (button === 'random') { teams[0] = randomTeam(); teams[1] = randomTeam(); sfx('switch'); this.say('Both teams are new.'); }
    else if (button === 'swap') { [teams[0], teams[1]] = [teams[1], teams[0]]; sfx('switch'); this.say('The teams change sides.'); }
    else if (button === 'ai') { foeAi = AI_LEVELS[(AI_LEVELS.indexOf(foeAi) + 1) % AI_LEVELS.length]; sfx('move'); }
    else { sfx('ok'); this.wait(this.start()); }
  }

  /** Holds the builder still and dimmed while another screen runs over it. */
  wait(p: Promise<unknown>): void {
    this.busy = true;
    void p.finally(() => { this.busy = false; });
  }

  async start(): Promise<void> {
    lastChoice.top = [];
    const copy = (side: 0 | 1) => teams[side].map(s => structuredClone(s.m));
    const r = await battle({
      enemy: copy(1), name: 'Opponent', ai: foeAi, wild: false, sync: this.synced(), scene: pick(SCENES), music: 'keeper', noXp: true,
      practice: { mine: copy(0), charm: null, debug: debugMenu },
    });
    music.play('title');
    this.say(r.result === 'win' ? 'You win.' : r.result === 'lose' ? 'The opponent wins.' : 'No winner.');
  }

  act(a: string): void {
    const side = this.cx, row = this.cy, s = this.slot(), level = s.m.level;
    const others = teams[side].filter((_, k) => k !== row).map(o => o.kinds[0]);
    const put = (n: Slot) => { n.m.level = level; teams[side][row] = n; };
    if (a === 'Random kit') { put(randomSlot(others, level)); sfx('switch'); return; }
    if (a === 'Level') { this.sub = { kind: 'level', v: level }; return; }
    if (a === 'Look') { this.wait(monPage(s.m)); return; }
    this.wait((async () => {
      if (a === 'Pick a kind') {
        const id = await findKind('Pick a kind');
        if (id) put({ m: plannedKit(rnd, makeMon(id, 50)), kinds: [id] });
      } else if (a === 'Random fit' || a === 'Fit by hand') {
        const k1 = await findKind('Fit which kind first?', fittable);
        if (!k1) return;
        const k2 = await findKind(`Fit ${SPECIES[k1].name} with?`, id => fittable(id) && id !== k1);
        if (!k2) return;
        if (a === 'Random fit') put({ m: plannedKit(rnd, randomFit(rnd, k1, k2, 50)), kinds: [k1, k2] });
        else {
          const A = makeMon(k1, 50), B = makeMon(k2, 50);
          const plan = await designFit(A, B);
          if (plan) { put({ m: plannedKit(rnd, makeFit(A, B, plan, 0)), kinds: [k1, k2] }); sfx('fit'); }
        }
      } else if (a === 'Held notion') {
        const ids = [null, ...NOTION_IDS];
        const k = await listMenu('Held notion', ids.map(id => (id ? NOTIONS[id]?.name || id : 'Nothing')), {
          w: 104, start: Math.max(0, ids.indexOf(s.m.notion ?? null)),
          detail: i => {
            const id = ids[i];
            box(112, 4, 76, 104);
            wrap(id ? NOTIONS[id]?.text || '' : 'Holds nothing.', 68).slice(0, 11).forEach((l, n) => text(l, 116, 8 + n * 9, PAPER));
          },
        });
        if (k >= 0) teams[side][row].m.notion = ids[k];
      }
    })());
  }

  draw(): void {
    backdrop();
    text('Practice', 6, 4, SEL, INK);
    if (this.noteT > 0) textRight(this.note, 186, 4, SEL, INK);
    else textRight(this.synced() ? 'Synced to level 25' : 'Own levels, no sync', 186, 4, this.synced() ? DIM : WARN, INK);
    text('You', 6, 16, MINE, INK);
    text('Foe', 102, 16, THEIRS, INK);
    for (const side of [0, 1] as const) teams[side].forEach((s, r) => this.card(s, 2 + side * 96, 26 + r * 42, !this.busy && this.cx === side && this.cy === r));
    const btn = (label: string, col: number, row: number, hot = false) => {
      const x = 2 + col * 96, y = 154 + row * 13, on = !this.busy && this.cx === col && this.cy === 3 + row;
      frame(x, y, 92, 12, on ? HILITE : PANEL, on ? SEL : hot ? NERVE : EDGE);
      textCenter(label, x + 46, y + 2, on ? SEL : hot ? NERVE : PAPER);
    };
    btn('Randomize all', 0, 0);
    btn('Swap sides', 1, 0);
    btn(`Foe AI: ${foeAi[0].toUpperCase() + foeAi.slice(1)}`, 0, 1);
    btn('Start', 1, 1, true);
    const hint = this.cy < 3 ? 'Z changes this whorl. V looks at it.' : this.cy === 4 && this.cx === 1 ? 'Z starts with these teams.' : 'Z picks. X goes back to the title.';
    textCenter(hint, 96, 183, DIM, INK);
    this.drawSub();
    if (this.busy) dither(0, 0, 192, 192, INK, 0.55);
  }

  /** One slot: the whorl's sprite, name, types, level, held notion, and whether it is fitted. */
  card(s: Slot, x: number, y: number, on: boolean): void {
    const m = s.m;
    frame(x, y, 92, 40, on ? HILITE : PANEL, on ? SEL : EDGE);
    rect(x + 3, y + 3, 26, 26, INK);
    drawSprite(m.sprite, x + 4, y + 4, 3);
    text(fit(m.name, 58), x + 32, y + 4, on ? SEL : PAPER);
    m.types.forEach((t, k) => miniSigil(t as Type, x + 32 + k * 7, y + 15));
    if (m.fitted) text('fit', x + 50, y + 13, NERVE);
    textRight(`L${m.level}`, x + 89, y + 13, m.level === SYNC ? DIM : WARN);
    const n = m.notion ? NOTIONS[m.notion] : null;
    text(fit(n ? n.name : 'Holds nothing', 58), x + 32, y + 22, n ? MINE : DIM);
    if (m.fitted) text(fit(s.kinds.map(k => SPECIES[k]?.name || k).join(' + '), 84), x + 4, y + 31, DIM);
  }

  drawSub(): void {
    const sub = this.sub;
    if (sub.kind === 'acts') {
      const w = 84, h = ACTS.length * 10 + 8, x = this.cx === 0 ? 100 : 8, y = Math.min(26 + this.cy * 42, 150 - h);
      frame(x, y, w, h, '#211e2a', SEL);
      ACTS.forEach((a, k) => text(a, x + 12, y + 5 + k * 10, k === sub.i ? SEL : PAPER));
      text('\u0001', x + 4, y + 5 + sub.i * 10, SEL);
    } else if (sub.kind === 'level') {
      frame(36, 70, 120, 44, '#211e2a', SEL);
      textCenter('Level', 96, 75, PAPER);
      textCenter(`< ${sub.v} >`, 96, 88, SEL);
      textCenter(sub.v === SYNC ? 'The synced level' : 'Up and down move 5', 96, 101, DIM);
    }
  }
}

/** Opens the practice builder from the title. Resolves when the player backs out. */
export function practice(): Promise<void> {
  inPractice = true;
  return run<void>(new Builder()).finally(() => { inPractice = false; });
}

/** True while the practice builder is open, where tide is always on and its texts always show. */
export let inPractice = false;
