import type { Mon } from '../battle/model';
import { MOVES, NOTIONS, PASSIVES } from '../battle/registry';
import { SPECIES, WILD_KINDS, entryOf } from '../data/species';
import { NOTION_IDS } from '../data/notions';
import { statsAt, TYPE_COLOR, xpToNext, type Type } from '../data/types';
import { profileOf } from '../data/profiles';
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { ctx, frame, rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { sfx, setSfxVolume } from '../engine/audio';
import { music } from '../engine/music';
import { close, run, type Mode } from './modes';
import { box, cursor, DIM, GOOD, NERVE, PAPER, PORTRAIT_BG, SEL, sigil, statChart, typeBadge, WARN, BADC } from './ui';
import { G, HERO, HORN_NAME, HORN_PRICE, charmsUnlocked, levelOf, notionsUnlocked, save } from './state';
import { FIT_STAT, HORN_LINE, moveKinds, moveText, TAN_PER_STAT, TAN_TOTAL, tanBonus, tanPerLayer, tanText } from '../battle/engine';
import { choose, say } from './dialogue';
import { MAPS } from './world';
import { registerMenu } from './register';
import { ITEMS } from './items';
import { bagScreen } from './bag';
import { STARLIGHT } from '../data/starborn';

/** Extra start-menu entries that content adds, such as the hand bell on the Strand. Choosing one closes the menu. */
export const menuExtras: { label: string; when: () => boolean; run: () => Promise<void> }[] = [];

/** A generic vertical list. Returns the chosen index or -1. */
export function listMenu(title: string, items: string[], opts: { x?: number; y?: number; w?: number; detail?: (i: number) => void; disabled?: (i: number) => boolean; start?: number } = {}): Promise<number> {
  let i = opts.start || 0;
  let scroll = 0;
  const x = opts.x ?? 4, y = opts.y ?? 4, w = opts.w ?? 110;
  const rowsVis = Math.min(items.length, 17);
  const m: Mode = {
    update() {
      if (!items.length) { if (input.hit('back') || input.hit('ok')) close(m, -1); return; }
      if (input.hit('up')) { i = (i + items.length - 1) % items.length; sfx('move'); }
      if (input.hit('down')) { i = (i + 1) % items.length; sfx('move'); }
      if (i < scroll) scroll = i;
      if (i >= scroll + rowsVis) scroll = i - rowsVis + 1;
      if (input.hit('ok')) {
        if (opts.disabled?.(i)) { sfx('back'); return; }
        sfx('ok'); close(m, i);
      } else if (input.hit('back')) { sfx('back'); close(m, -1); }
    },
    draw() {
      const h = rowsVis * 9 + 16;
      box(x, y, w, h);
      text(title, x + 4, y + 3, SEL);
      for (let k = 0; k < rowsVis; k++) {
        const idx = k + scroll;
        if (idx >= items.length) break;
        const yy = y + 13 + k * 9;
        if (idx === i) cursor(x + 3, yy);
        text(items[idx], x + 10, yy, opts.disabled?.(idx) ? DIM : idx === i ? SEL : PAPER);
      }
      if (!items.length) text('Nothing.', x + 10, y + 13, DIM);
      opts.detail?.(i);
    },
  };
  return run(m);
}

export function monLine(m: Mon): string {
  return `${m.name} L${levelOf(m)}`;
}

/** One line of a summary tab: text at x in a color, or a type sigil before it, or text set flush right, or columns set flush right. */
interface PageRow { y: number; s: string; x: number; c: string; sig?: Type; right?: string; rx?: number; rc?: string; cols?: { s: string; rx: number; c: string }[]; ul?: [number, number] }

const STAT_KEYS = ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'] as const;

/** A small starlight star that marks a starborn whorl, its arms flickering now and then. */
export function starMark(x: number, y: number, t: number): void {
  rect(x + 2, y + 2, 1, 1, '#ffffff');
  const long = Math.floor(t / 40) % 3 === 0;
  rect(x + 1, y + 2, 3, 1, STARLIGHT); rect(x + 2, y + 1, 1, 3, STARLIGHT);
  if (long) { rect(x, y + 2, 5, 1, STARLIGHT); rect(x + 2, y, 1, 5, STARLIGHT); rect(x + 2, y + 2, 1, 1, '#ffffff'); }
}

/** Each stat as the battle builds it: the level's base, what the held notion adds, what nacre adds, and what the seam takes. */
function statParts(m: Mon): { k: string; base: number; held: number; nacre: number; seam: number; total: number }[] {
  const base = statsAt(m.level, profileOf(m)) as unknown as Record<string, number>;
  const n = m.notion ? NOTIONS[m.notion] : null;
  return STAT_KEYS.map(k => {
    let v = base[k] + ((n?.flat as Record<string, number> | undefined)?.[k] || 0);
    v = Math.round(v * (1 + ((n?.pct as Record<string, number> | undefined)?.[k] || 0)));
    const afterHeld = v;
    v += tanBonus(m.level, k, (m.tan as Record<string, number> | undefined)?.[k] || 0);
    const afterNacre = v;
    if (m.fitted) v = Math.round(v * FIT_STAT);
    // Graft Wax adds to a conjoined whorl's attack stats in battle, on top of the rest.
    const wax = n?.statBonus && m.fitted && (k === 'atk' || k === 'mgk') ? Math.round(v * 0.05) : 0;
    return { k: k.toUpperCase(), base: base[k], held: afterHeld - base[k] + wax, nacre: afterNacre - afterHeld, seam: v - afterNacre, total: v + wax };
  });
}

const TABS = ['Moves', 'Habits', 'Stats'] as const;
const TOP = 60, BOTTOM = 175;
/** Where the stat chart sits on the Stats tab's chart view, from the top of the page. */
const CHART_X = 128, CHART_Y = 49;

/**
 * Full page about one whorl: a header, then Moves, Habits, and Stats tabs that scroll when they run long.
 * The Stats tab has two views, the chart and the breakdown, and left and right step through them as if they were tabs.
 */
export function monPage(m: Mon, extra?: string): Promise<void> {
  let tab = 0, view = 0, scroll = 0, tick = 0;
  const rowsOf = (): PageRow[] => {
    const out: PageRow[] = [];
    let y = 0;
    const para = (s: string, x: number, c: string, w = 176 - x) => { for (const l of wrap(s, w)) { out.push({ y, s: l, x, c }); y += 9; } };
    if (tab === 0) {
      for (const id of m.moves) {
        const mv = MOVES[id];
        if (!mv) continue;
        const ty = (m.retune?.move === id ? m.retune.type : mv.type) as Type;
        out.push({ y, s: mv.name, x: 16, c: PAPER, sig: ty, right: mv.nerve ? `crest  ${mv.nerve} tide` : `cd ${mv.cd}`, rc: mv.nerve ? NERVE : DIM });
        y += 9;
        para([moveKinds(mv), moveText(mv, m.passives)].filter(Boolean).join(' '), 16, DIM);
        y += 4;
      }
    } else if (tab === 1) {
      for (const id of m.passives) {
        const p = PASSIVES[id];
        if (!p) continue;
        out.push({ y, s: p.name, x: 8, c: GOOD });
        y += 9;
        para(p.text, 16, DIM);
        y += 4;
      }
      if (m.notion && NOTIONS[m.notion]) {
        out.push({ y, s: `Holds ${NOTIONS[m.notion].name}`, x: 8, c: NERVE });
        y += 9;
        para(NOTIONS[m.notion].text, 16, DIM);
      }
    } else {
      const parts = statParts(m);
      const w1 = textWidth('Chart'), w2 = textWidth('Breakdown');
      out.push({ y, s: 'Chart', x: 8, c: view === 0 ? SEL : DIM, cols: [{ s: 'Breakdown', rx: 20 + w1 + w2, c: view === 1 ? SEL : DIM }], right: 'L/R', rc: '#6a6478', ul: view === 0 ? [8, w1] : [20 + w1, w2] });
      y += 12;
      if (view === 0) {
        // The totals in a column on the left, and draw() puts the stat chart beside them.
        for (const p of parts) { out.push({ y, s: p.k, x: 8, c: DIM, right: String(p.total), rx: 62, rc: p.nacre ? GOOD : p.held ? NERVE : PAPER }); y += 9; }
        // The text below starts under the chart's lowest labels.
        y = Math.max(y + 6, CHART_Y + 36);
      }
    }
    if (tab === 2 && view === 1) {
      // A table: each stat's base for the level, then what the held notion, nacre, and the seam change, then the total in battle.
      const parts = statParts(m);
      const seamCol = !!m.fitted;
      const X = seamCol ? { base: 52, held: 80, nacre: 114, seam: 147, total: 184 } : { base: 66, held: 104, nacre: 142, seam: 0, total: 184 };
      const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `${v}` : '');
      const head = [{ s: 'Base', rx: X.base, c: DIM }, { s: 'Held', rx: X.held, c: DIM }, { s: 'Nacre', rx: X.nacre, c: DIM }, { s: 'Total', rx: X.total, c: DIM }];
      if (seamCol) head.splice(3, 0, { s: 'Seam', rx: X.seam, c: DIM });
      out.push({ y, s: '', x: 8, c: DIM, cols: head });
      y += 10;
      for (const p of parts) {
        const cols = [
          { s: String(p.base), rx: X.base, c: PAPER },
          { s: signed(p.held), rx: X.held, c: NERVE },
          { s: signed(p.nacre), rx: X.nacre, c: GOOD },
          { s: String(p.total), rx: X.total, c: p.held || p.nacre ? SEL : PAPER },
        ];
        if (seamCol) cols.splice(3, 0, { s: signed(p.seam), rx: X.seam, c: BADC });
        out.push({ y, s: p.k, x: 8, c: DIM, cols });
        y += 9;
      }
      y += 6;
    }
    if (tab === 2) {
      // Both views end on the held notion, the nacre placed, and the Register entry.
      const n = m.notion ? NOTIONS[m.notion] : null;
      out.push({ y, s: n ? `Holds ${n.name}` : 'Holds no notion', x: 8, c: n ? NERVE : DIM });
      y += 9;
      if (n) { para(n.text, 16, DIM); y += 3; }
      const used = Object.values((m.tan as Record<string, number> | undefined) || {}).reduce((a, v) => a + (v || 0), 0);
      out.push({ y, s: `Nacre ${used} of ${TAN_TOTAL}`, x: 8, c: used ? GOOD : DIM });
      y += 9;
      const gains = statParts(m).filter(p => p.nacre > 0).map(p => `+${p.nacre} ${p.k}`);
      if (gains.length) { para(`It adds ${gains.join(', ')}.`, 16, DIM); y += 3; }
      const per = tanPerLayer(m.level);
      para(`Each layer adds ${tanText(per.stat)} to one stat or ${tanText(per.hp)} to HP at level ${m.level}, up to ${TAN_PER_STAT} layers in one stat.`, 16, DIM);
      if (m.fitted) { y += 3; para(`The seam takes ${Math.round((1 - FIT_STAT) * 100)}% from every stat.`, 8, DIM); }
      if (m.starborn) { y += 3; out.push({ y, s: 'Starborn', x: 8, c: STARLIGHT }); y += 9; para('About one wild whorl in four hundred comes out in night-sky colors, and glitters.', 16, DIM); }
      y += 6;
      para(entryOf(m), 8, PAPER);
      if (m.parents) { y += 3; para(`From ${m.parents[0]} and ${m.parents[1]}.`, 8, DIM); }
    }
    return out;
  };
  const mm: Mode = {
    opaque: true,
    update() {
      // Four stops: Moves, Habits, the stat chart, and the stat breakdown.
      const step = (d: number) => { const p = ((tab === 2 ? 2 + view : tab) + d + 4) % 4; tab = Math.min(2, p); view = p === 3 ? 1 : 0; scroll = 0; sfx('move'); };
      if (input.hit('left')) step(-1);
      if (input.hit('right')) step(1);
      const rows = rowsOf(), end = rows.length ? rows[rows.length - 1].y + 9 : 0;
      const maxScroll = Math.max(0, end - (BOTTOM - TOP));
      if (input.hit('down') && scroll < maxScroll) { scroll = Math.min(maxScroll, scroll + 16); sfx('move'); }
      if (input.hit('up') && scroll > 0) { scroll = Math.max(0, scroll - 16); sfx('move'); }
      if (input.hit('ok') || input.hit('back')) { sfx('back'); close(mm); }
    },
    draw() {
      rect(0, 0, 192, 192, '#17151d');
      box(2, 2, 188, 188);
      frame(6, 6, 36, 36, PORTRAIT_BG, DIM);
      drawSprite(m.sprite, 8, 8, 4);
      text(m.name, 48, 8, SEL);
      if (m.starborn) starMark(50 + textWidth(m.name), 9, tick++);
      textRight(`Lv ${m.level}`, 186, 8, PAPER);
      let tx = 48;
      for (const t of m.types) tx = typeBadge(t as Type, tx, 18);
      text(m.basic === 'P' ? 'Physical attacks' : 'Magic attacks', 48, 30, DIM);
      const need = xpToNext(m.level);
      textRight(`${m.xp}/${need} xp`, 186, 30, DIM);
      rect(48, 40, 138, 2, '#2a2632');
      rect(48, 40, Math.round(138 * Math.min(1, m.xp / Math.max(1, need))), 2, GOOD);
      // Tabs: the open one is a raised box joined to the page line, the others sit dim behind it.
      TABS.forEach((name, k) => {
        const x = 8 + k * 46, on = k === tab;
        if (on) { rect(x, 46, 44, 11, '#2a2632'); rect(x, 46, 44, 1, SEL); }
        textCenter(name, x + 22, 48, on ? SEL : DIM);
      });
      rect(4, 57, 184, 1, '#3a3442');
      const rows = rowsOf();
      for (const r of rows) {
        const y = TOP + r.y - scroll;
        if (y < TOP - 1 || y > BOTTOM - 8) continue;
        if (r.sig) sigil(r.sig, 6, y + 1);
        text(r.s, r.x, y, r.c);
        if (r.right) textRight(r.right, r.rx ?? 186, y, r.rc || DIM);
        for (const c of r.cols || []) if (c.s) textRight(c.s, c.rx, y, c.c);
        // A faint rule under the stat table's header, and a line under the open view's name.
        if (r.cols && !r.s) rect(8, y + 8, 178, 1, '#2a2632');
        if (r.ul) rect(r.ul[0], y + 9, r.ul[1], 1, SEL);
      }
      if (tab === 2 && view === 0) {
        // The chart scrolls with the page and is cut off at its top and bottom edges.
        const parts = statParts(m);
        ctx.save();
        ctx.beginPath(); ctx.rect(0, TOP - 1, 192, BOTTOM - TOP + 1); ctx.clip();
        // The chart shows the kind's shape: each stat against the even spread at this level.
        const even = statsAt(m.level) as unknown as Record<string, number>;
        statChart(CHART_X, TOP + CHART_Y - scroll, 24, parts.map(p => p.total / Math.max(1, even[p.k.toLowerCase()])), parts.map(p => p.k), TYPE_COLOR[m.types[0] as Type], parts.map(p => p.nacre > 0 || p.held > 0));
        ctx.restore();
      }
      const end = rows.length ? rows[rows.length - 1].y + 9 : 0;
      // Scroll arrows: small triangles at the right edge.
      if (scroll > 0) for (let k = 0; k < 3; k++) rect(184 - k, TOP - 3 + k, 1 + k * 2, 1, DIM);
      if (scroll < end - (BOTTOM - TOP)) for (let k = 0; k < 3; k++) rect(184 - k, BOTTOM - 1 - k, 1 + k * 2, 1, DIM);
      rect(4, 177, 184, 1, '#3a3442');
      if (extra) text(extra, 6, 166, WARN);
      const lr = tab === 2 ? 'L/R views.' : 'L/R tabs.';
      textCenter(end > BOTTOM - TOP ? `${lr} Up/down scroll. X back.` : `${lr} X back.`, 96, 179, '#6a6478');
    },
  };
  return run(mm);
}

async function fourMenu(): Promise<void> {
  let sel = 0;
  for (;;) {
    if (!G.party.length) { await say(null, `${HERO} has no whorls yet.`); return; }
    const i = await listMenu('Your team', G.party.map(monLine), {
      start: sel,
      w: 120,
      detail: (k) => {
        const m = G.party[k];
        if (!m) return;
        box(128, 4, 60, 60);
        drawSprite(m.sprite, 140, 12, 4);
        let y = 48;
        for (const t of m.types) { typeBadge(t as Type, 132, y); y += 9; }
      },
    });
    if (i < 0) return;
    sel = i;
    const m = G.party[i];
    const acts = ['Look', 'Make lead', 'Move down'];
    if (notionsUnlocked()) acts.push(m.notion ? 'Take notion' : 'Give notion');
    const a = await choose(acts, true);
    if (a === 0) await monPage(m);
    else if (a === 1 && i > 0) { G.party.splice(i, 1); G.party.unshift(m); sel = 0; }
    else if (a === 2 && i < G.party.length - 1) { G.party.splice(i, 1); G.party.splice(i + 1, 0, m); sel = i + 1; }
    else if (a === 3) {
      if (m.notion) { G.notions[m.notion] = (G.notions[m.notion] || 0) + 1; await say(null, `${HERO} takes the ${NOTIONS[m.notion].name}.`); m.notion = null; }
      else await giveNotion(m);
    }
  }
}

export async function giveNotion(m: Mon): Promise<void> {
  const have = NOTION_IDS.filter(id => (G.notions[id] || 0) > 0);
  if (!have.length) { await say(null, `${HERO} has no notions.`); return; }
  const k = await listMenu('Give which?', have.map(id => `${NOTIONS[id].name} x${G.notions[id]}`), {
    w: 120,
    detail: (j) => { box(4, 130, 184, 30); wrap(NOTIONS[have[j]].text, 176).forEach((l, n) => text(l, 8, 134 + n * 9, PAPER)); },
  });
  if (k < 0) return;
  G.notions[have[k]]--;
  m.notion = have[k];
  await say(null, `${m.name} holds the ${NOTIONS[have[k]].name}.`);
}

/** The places a kind lives in the wild, by map name. The postgame catch-all counts only for its own natives. */
export function homesOf(kind: string): string[] {
  return Object.values(MAPS).filter(m => m.zone?.kinds.some(([k, w]) => k === kind && (m.zone!.kinds.length < 40 || w >= 3))).map(m => m.name);
}

/** A kind shown at level 25, as the Register's move pages show it. */
export function registerMon(k: string): Mon {
  const sp = SPECIES[k];
  return { uid: 0, kind: k, name: sp.name, types: sp.types, basic: sp.basic, moves: sp.moves.slice(), passives: sp.passives.slice(), level: 25, xp: 0, sprite: { px: sp.sprite, c: sp.c } };
}

/** The Bag. Field items are used from it, and a key item with a line or a use shows it. Returns true when the start menu should close. */
/** The Bag lives in its own screen (src/game/bag.ts). Returns true when something used from it should close the start menu. */
async function bagMenu(): Promise<boolean> {
  return bagScreen();
}

export const KEY_NAMES: Record<string, string> = {
  register: 'The Register', letter: 'Letter from the Apex', riderslip: 'A Rider\'s cast', scaleRib: 'Rib pearl',
};
/** What a key item says when Ouro picks it in the Bag. */
export const KEY_TEXT: Record<string, string> = {};
/** Key items that do something when picked in the Bag. Returns true when the start menu should close. */
export const KEY_USE: Record<string, () => Promise<boolean>> = {};

async function charmMenu(): Promise<void> {
  const NAMES: Record<string, string> = {
    rib: 'Rib: lead takes 15% less damage', mast: 'Mast: tide starts at 4', spire: 'Spire: wind-ups land 25% sooner',
    bole: 'Bole: conjoined whorls +8% damage', pylon: 'Pylon: notion actions twice', tusk: 'Tusk: 20% less wait after Switch',
    hilt: 'Hilt: a KO cuts cooldowns by 1', fall: 'Fall: first turn 25% sooner',
  };
  const opts = ['none', ...G.scales];
  const i = await listMenu('Wear a pearl', opts.map(s => (s === 'none' ? 'No charm' : NAMES[s] || s) + (G.charm === s || (s === 'none' && !G.charm) ? ' *' : '')), { w: 184 });
  if (i < 0) return;
  G.charm = i === 0 ? null : opts[i];
}

async function optionsMenu(): Promise<void> {
  for (;;) {
    const i = await listMenu('Options', [`Music ${Math.round(G.opts.music * 10)}`, `Sounds ${Math.round(G.opts.sfx * 10)}`, `Battle speed ${G.opts.speed}`], { w: 120 });
    if (i < 0) return;
    if (i === 0) { G.opts.music = (Math.round(G.opts.music * 10) + 2) % 12 / 10; music.setVolume(G.opts.music); }
    if (i === 1) { G.opts.sfx = (Math.round(G.opts.sfx * 10) + 2) % 12 / 10; setSfxVolume(G.opts.sfx); }
    if (i === 2) G.opts.speed = G.opts.speed >= 3 ? 1 : G.opts.speed + 1;
  }
}

/** The start menu entry picked last, where the cursor opens next time. */
let lastStart = 'Team';

export async function startMenu(): Promise<void> {
  for (;;) {
    const items = ['Team', 'Register', 'Bag'];
    if (charmsUnlocked()) items.push('Charm');
    for (const x of menuExtras) if (x.when()) items.push(x.label);
    items.push('Save', 'Options');
    const i = await listMenu(HERO, items, { x: 120, w: 68, start: Math.max(0, items.indexOf(lastStart)) });
    if (i < 0) return;
    const k = items[i];
    lastStart = k;
    if (k === 'Team') await fourMenu();
    if (k === 'Register') await registerMenu();
    if (k === 'Bag' && await bagMenu()) return;
    if (k === 'Charm') await charmMenu();
    if (k === 'Save') { save(); await say(null, 'Saved.'); }
    if (k === 'Options') await optionsMenu();
    const extra = menuExtras.find(x => x.label === k);
    if (extra) { await extra.run(); return; }
  }
}

// ---------------------------------------------------------------- tannery

export const PEG_PRICE = HORN_PRICE;

export async function shop(stock: string[]): Promise<void> {
  for (;;) {
    const items = stock.map(s => {
      if (s in PEG_PRICE) return `${HORN_NAME[s as keyof typeof PEG_PRICE]}  ${PEG_PRICE[s as keyof typeof PEG_PRICE]}`;
      if (ITEMS[s]) return `${ITEMS[s].name}  ${ITEMS[s].price}`;
      return `${NOTIONS[s].name}  ${NOTIONS[s].price}`;
    });
    const i = await listMenu(`Buy  (${G.rind} cowries)`, items, {
      w: 140,
      detail: (j) => {
        const s = stock[j];
        box(4, 150, 184, 38);
        const t = s in PEG_PRICE ? `Line ${Math.round(HORN_LINE[s] * 100)}%. You have ${G.pegs[s as 'twig']}.`
          : ITEMS[s] ? `${ITEMS[s].text} You have ${G.items[s] || 0}.` : `${NOTIONS[s].text} You have ${G.notions[s] || 0}.`;
        wrap(t, 176).forEach((l, n) => text(l, 8, 154 + n * 9, PAPER));
      },
    });
    if (i < 0) return;
    const s = stock[i];
    const price = s in PEG_PRICE ? PEG_PRICE[s as keyof typeof PEG_PRICE] : ITEMS[s] ? ITEMS[s].price : NOTIONS[s].price;
    if (G.rind < price) { await say(null, 'Not enough cowries.'); continue; }
    if (s in PEG_PRICE || ITEMS[s]) {
      const n = await choose(['1', '5', '10'], true, 'How many?');
      if (n < 0) continue;
      const cnt = [1, 5, 10][n];
      const can = Math.min(cnt, Math.floor(G.rind / price));
      G.rind -= can * price;
      if (ITEMS[s]) G.items[s] = (G.items[s] || 0) + can;
      else G.pegs[s as 'twig'] += can;
      sfx('ok');
      await say(null, `${HERO} buys ${can}.`);
    } else {
      G.rind -= price;
      G.notions[s] = (G.notions[s] || 0) + 1;
      sfx('ok');
      await say(null, `${HERO} buys the ${NOTIONS[s].name}.`);
    }
  }
}

export async function rack(): Promise<void> {
  for (;;) {
    const i = await listMenu('The Midden', G.rack.map(monLine).concat(G.rack.length ? [] : []), { w: 120,
      detail: (k) => { const m = G.rack[k]; if (!m) return; box(128, 4, 60, 44); drawSprite(m.sprite, 140, 10, 4); } });
    if (i < 0) return;
    const m = G.rack[i];
    const a = await choose(['Look', 'Swap in', 'Let go'], true);
    if (a === 0) await monPage(m);
    if (a === 1) {
      if (G.party.length < 4) { G.rack.splice(i, 1); G.party.push(m); continue; }
      const j = await listMenu('Swap with', G.party.map(monLine), { w: 120 });
      if (j < 0) continue;
      const out = G.party[j];
      G.party[j] = m;
      G.rack[i] = out;
    }
    if (a === 2) {
      const sure = await choose(['Let it go', 'Keep it'], true, `${m.name} walks off and does not come back.`);
      if (sure === 0) { G.rack.splice(i, 1); if (m.notion) G.notions[m.notion] = (G.notions[m.notion] || 0) + 1; }
    }
  }
}

void textCenter; void textWidth; void BADC;

const TAN_STATS = ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'] as const;

/** Layer nacre at a grotto: one layer adds flat points to one stat of one whorl. Layers can be prised back for free. */
export async function tanMenu(): Promise<void> {
  for (;;) {
    const all = [...G.party, ...G.rack];
    const used = (m: Mon) => Object.values(m.tan || {}).reduce((a, b) => a + (b || 0), 0);
    const i = await listMenu(`Layer nacre on which? (${G.tan} nacre)`, all.map(m => `${monLine(m)}  ${used(m)}/${TAN_TOTAL}`), { w: 150 });
    if (i < 0) return;
    const m = all[i];
    for (;;) {
      const t = m.tan || (m.tan = {});
      const items = TAN_STATS.map(k => `${k.toUpperCase().padEnd(4)} ${'#'.repeat(t[k] || 0)}${'.'.repeat(TAN_PER_STAT - (t[k] || 0))}`);
      items.push('Take all layers off');
      const k = await listMenu(`${m.name}: ${used(m)}/${TAN_TOTAL}, ${G.tan} nacre left`, items, { w: 150,
        detail: () => { const per = tanPerLayer(m.level); box(4, 150, 184, 36); wrap(`Each layer adds ${tanText(per.stat)} to one stat or ${tanText(per.hp)} to HP at level ${m.level}. A whorl takes ${TAN_PER_STAT} layers in one stat and ${TAN_TOTAL} in all.`, 176).forEach((l, n) => text(l, 8, 154 + n * 9, PAPER)); } });
      if (k < 0) break;
      if (k === TAN_STATS.length) {
        G.tan += used(m);
        m.tan = {};
        sfx('back');
        continue;
      }
      const st = TAN_STATS[k];
      if (G.tan <= 0) { await say('Shellwright', 'No nacre. Win some, or find some.'); break; }
      if ((t[st] || 0) >= TAN_PER_STAT || used(m) >= TAN_TOTAL) { sfx('back'); continue; }
      t[st] = (t[st] || 0) + 1;
      G.tan--;
      sfx('heal');
    }
    save();
  }
}