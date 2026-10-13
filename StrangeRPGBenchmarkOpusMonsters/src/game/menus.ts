import type { Mon } from '../battle/model';
import { MOVES, NOTIONS, PASSIVES } from '../battle/registry';
import { SPECIES, WILD_KINDS, entryOf } from '../data/species';
import { NOTION_IDS } from '../data/notions';
import { statsAt, TYPE_COLOR, xpToNext, type Type } from '../data/types';
import { profileOf } from '../data/profiles';
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { ctx, px, rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { sfx, setSfxVolume } from '../engine/audio';
import { music } from '../engine/music';
import { close, run, type Mode } from './modes';
import { bevel, cursor, DIM, GOOD, HINT, motes, NERVE, PAPER, panel, PEARL_EDGE, PORTRAIT_BG, rowBar, SEL, sigil, statChart, typeBadge, WARN, BADC } from './ui';
import { G, HERO, HORN_NAME, HORN_PRICE, DIFFICULTY_NAMES, DIFFICULTY_TEXT, charmsUnlocked, levelOf, notionsUnlocked, save, slotNow } from './state';
import { FIT_STAT, HORN_LINE, moveKinds, moveText, TAN_PER_STAT, TAN_TOTAL, tanBonus, tanPerLayer, tanText } from '../battle/engine';
import { choose, say } from './dialogue';
import { downloadSlot } from './saveFile';
import { renameMon } from './files';
import { MAPS } from './world';
import { registerMenu } from './register';
import { ITEMS } from './items';
import { bagScreen } from './bag';
import { middenScreen } from './middenScreen';
import { nacreScreen } from './nacreScreen';
import { shopScreen } from './shopScreen';
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
      // The title sits on a band of its own over a rule, and the picked row on a bar.
      panel(x, y, w, h, PEARL_EDGE, { head: 10 });
      text(title, x + 4, y + 2, SEL);
      for (let k = 0; k < rowsVis; k++) {
        const idx = k + scroll;
        if (idx >= items.length) break;
        const yy = y + 13 + k * 9;
        if (idx === i) { rowBar(x + 2, yy, w - 4); cursor(x + 3, yy); }
        text(items[idx], x + 10, yy, opts.disabled?.(idx) ? DIM : idx === i ? SEL : PAPER);
      }
      // Small arrows at the right when the list runs past what shows.
      if (scroll > 0) { rect(x + w - 6, y + 4, 1, 1, DIM); rect(x + w - 7, y + 5, 3, 1, DIM); rect(x + w - 8, y + 6, 5, 1, DIM); }
      if (scroll + rowsVis < items.length) { rect(x + w - 8, y + h - 3, 5, 1, DIM); rect(x + w - 7, y + h - 2, 3, 1, DIM); }
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

/**
 * Each stat as the battle builds it: the level's base, what the held notion adds, what nacre adds, and what the seam takes.
 * `level` and `tan` stand in for the whorl's own level and layers.
 */
export function statParts(m: Mon, level = m.level, tan: Mon['tan'] = m.tan): { k: string; base: number; held: number; nacre: number; seam: number; total: number }[] {
  const base = statsAt(level, profileOf(m)) as unknown as Record<string, number>;
  const n = m.notion ? NOTIONS[m.notion] : null;
  return STAT_KEYS.map(k => {
    let v = base[k] + ((n?.flat as Record<string, number> | undefined)?.[k] || 0);
    v = Math.round(v * (1 + ((n?.pct as Record<string, number> | undefined)?.[k] || 0)));
    const afterHeld = v;
    v += tanBonus(level, k, (tan as Record<string, number> | undefined)?.[k] || 0);
    const afterNacre = v;
    if (m.fitted) v = Math.round(v * FIT_STAT);
    // Graft Wax adds to a conjoined whorl's attack stats in battle, on top of the rest.
    const wax = n?.statBonus && m.fitted && (k === 'atk' || k === 'mgk') ? Math.round(v * 0.05) : 0;
    return { k: k.toUpperCase(), base: base[k], held: afterHeld - base[k] + wax, nacre: afterNacre - afterHeld, seam: v - afterNacre, total: v + wax };
  });
}

const TABS = ['Moves', 'Habits', 'Stats'] as const;
/** The whorl page's card behind the header, its page under the tabs, and the dim edge they share. */
const CARD = '#1e1b26', PAGE = '#1b1822', EDGE_DIM = '#3a3442';
const TOP = 60, BOTTOM = 175;
/** Where the stat chart sits on the Stats tab's chart view, from the top of the page. */
const CHART_X = 128, CHART_Y = 49;

/**
 * Full page about one whorl: a header, then Moves, Habits, and Stats tabs that scroll when they run long.
 * The Stats tab has two views, the chart and the breakdown, and left and right step through them as if they were tabs.
 * `noXp` leaves out the experience bar, and `over` draws on top of the page each frame.
 */
export function monPage(m: Mon, opts: { noXp?: boolean; over?: () => void } = {}): Promise<void> {
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
      motes(tick);
      panel(2, 2, 188, 188);
      // The card: the whorl lit large in a frame, its name, level, types, how it attacks, and its experience.
      bevel(4, 4, 184, 40, CARD, EDGE_DIM);
      bevel(6, 6, 36, 36, PORTRAIT_BG, EDGE_DIM);
      drawSprite(m.sprite, 8, 8, 4);
      text(m.name, 48, 8, SEL);
      if (m.starborn) starMark(50 + textWidth(m.name), 9, tick);
      tick++;
      textRight(`Lv ${m.level}`, 184, 8, PAPER);
      let tx = 48;
      for (const t of m.types) tx = typeBadge(t as Type, tx, 18);
      text(m.basic === 'P' ? 'Physical attacks' : 'Magic attacks', 48, 30, DIM);
      if (!opts.noXp) {
        const need = xpToNext(m.level), fw = Math.round(136 * Math.min(1, m.xp / Math.max(1, need)));
        textRight(`${m.xp}/${need} xp`, 184, 30, DIM);
        // The experience bar as a groove pressed into the card, filled with a lit strip.
        rect(48, 39, 136, 1, '#0f0d14'); rect(48, 40, 136, 2, '#262230');
        if (fw > 0) { rect(48, 40, fw, 2, GOOD); rect(48, 40, fw, 1, '#b8f0a8'); }
      }
      // The page, and the tabs on its top edge: the open one raised and joined to the page, the others dark plates behind it.
      bevel(4, 57, 184, 120, PAGE, EDGE_DIM);
      TABS.forEach((name, k) => {
        const x = 8 + k * 46, on = k === tab;
        if (on) { bevel(x, 46, 44, 12, PAGE, SEL); rect(x + 1, 57, 42, 1, PAGE); }
        else bevel(x, 46, 44, 11, '#1b1822', '#2e2a38');
        textCenter(name, x + 22, 48, on ? SEL : DIM);
      });
      const rows = rowsOf();
      for (const r of rows) {
        const y = TOP + r.y - scroll;
        if (y < TOP - 1 || y > BOTTOM - 8) continue;
        if (r.sig) sigil(r.sig, 6, y + 1);
        text(r.s, r.x, y, r.c);
        if (r.right) textRight(r.right, r.rx ?? 184, y, r.rc || DIM);
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
      // Scroll arrows: small triangles beside the tabs and beside the hints.
      if (scroll > 0) for (let k = 0; k < 3; k++) rect(184 - k, 49 + k, 1 + k * 2, 1, SEL);
      if (scroll < end - (BOTTOM - TOP)) for (let k = 0; k < 3; k++) rect(184 - k, 181 - k, 1 + k * 2, 1, SEL);
      const lr = tab === 2 ? 'L/R views.' : 'L/R tabs.';
      textCenter(end > BOTTOM - TOP ? `${lr} Up/down scroll. X back.` : `${lr} X back.`, 96, 179, HINT);
      opts.over?.();
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
        panel(128, 4, 60, 60);
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
    acts.push('Rename');
    const a = await choose(acts, true);
    if (acts[a] === 'Rename') await renameMon(m);
    else if (a === 0) await monPage(m);
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
    detail: (j) => { panel(4, 130, 184, 30); wrap(NOTIONS[have[j]].text, 176).forEach((l, n) => text(l, 8, 134 + n * 9, PAPER)); },
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

/** One step of a setting: a small pearl, lit when the setting reaches it, or an empty socket. */
function pearl(x: number, y: number, lit: boolean, on: boolean): void {
  if (!lit) { rect(x + 1, y + 1, 2, 3, '#2a2634'); rect(x + 1, y + 1, 2, 1, '#0f0d14'); return; }
  rect(x + 1, y, 2, 1, on ? '#fff4d0' : '#f4ecf8'); rect(x, y + 1, 4, 3, on ? SEL : '#c8b4d8'); rect(x + 1, y + 4, 2, 1, on ? '#a07828' : '#7a6890'); px(x + 1, y + 1, '#ffffff');
}

/** Options stay open while they change: left and right step a value, and Z steps it up and wraps round. */
function optionsMenu(): Promise<void> {
  let i = 0;
  const x = 4, y = 4, w = 168;
  const LABELS = ['Music', 'Sounds', 'Battle speed', 'Difficulty'];
  const step = (n: number, max: number, dir: number, wrapAround: boolean) => {
    const v = n + dir;
    return wrapAround ? (v + max + 1) % (max + 1) : Math.max(0, Math.min(max, v));
  };
  const change = (dir: number, wrapAround: boolean) => {
    if (i === 0) { G.opts.music = step(Math.round(G.opts.music * 10), 10, dir, wrapAround) / 10; music.setVolume(G.opts.music); sfx('move'); }
    if (i === 1) { G.opts.sfx = step(Math.round(G.opts.sfx * 10), 10, dir, wrapAround) / 10; setSfxVolume(G.opts.sfx); sfx('ok'); }
    if (i === 2) { G.opts.speed = step(G.opts.speed - 1, 2, dir, wrapAround) + 1; sfx('move'); }
    if (i === 3) { G.opts.difficulty = step(G.opts.difficulty || 0, 2, dir, wrapAround); sfx('move'); }
  };
  const m: Mode = {
    update() {
      if (input.hit('up')) { i = (i + 3) % 4; sfx('move'); }
      if (input.hit('down')) { i = (i + 1) % 4; sfx('move'); }
      if (input.hit('left')) change(-1, false);
      if (input.hit('right')) change(1, false);
      if (input.hit('ok')) change(1, true);
      if (input.hit('back')) { sfx('back'); close(m); }
    },
    draw() {
      // Each setting's name on the left, and its level on the right as a row of pearls with the number after them.
      panel(x, y, w, LABELS.length * 9 + 16, PEARL_EDGE, { head: 10 });
      text('Options', x + 4, y + 2, SEL);
      const vals: [number, number][] = [[Math.round(G.opts.music * 10), 10], [Math.round(G.opts.sfx * 10), 10], [G.opts.speed, 3]];
      LABELS.forEach((s, k) => {
        const yy = y + 13 + k * 9, on = k === i;
        if (on) { rowBar(x + 2, yy, w - 4); cursor(x + 3, yy); }
        text(s, x + 10, yy, on ? SEL : PAPER);
        if (k < 3) {
          const [v, max] = vals[k];
          for (let n = 0; n < max; n++) pearl(x + 86 + n * 5, yy + 1, n < v, on);
          textRight(String(v), x + w - 5, yy, on ? SEL : PAPER);
        } else textRight(DIFFICULTY_NAMES[G.opts.difficulty || 0], x + w - 5, yy, on ? SEL : PAPER);
      });
      if (i === 3) { panel(4, 150, 184, 36, SEL); wrap(DIFFICULTY_TEXT[G.opts.difficulty || 0], 176).forEach((l, n) => text(l, 8, 154 + n * 9, PAPER)); }
    },
  };
  return run<void>(m);
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
    if (k === 'Save') { save(); if (await choose(['Done', 'Export to a file'], true, 'Saved.') === 1) downloadSlot(slotNow()); }
    if (k === 'Options') await optionsMenu();
    const extra = menuExtras.find(x => x.label === k);
    if (extra) { await extra.run(); return; }
  }
}

// ---------------------------------------------------------------- tannery

export const PEG_PRICE = HORN_PRICE;

/** The grotto shop screen (src/game/shopScreen.ts). */
export function shop(stock: string[]): Promise<void> {
  return shopScreen(stock);
}

/** The Midden screen (src/game/middenScreen.ts). */
export function rack(): Promise<void> {
  return middenScreen();
}

void textCenter; void textWidth; void BADC;

/** The Nacre screen (src/game/nacreScreen.ts): layers of nacre on a whorl's stats, which can be taken back off for free. */
export function tanMenu(): Promise<void> {
  return nacreScreen();
}