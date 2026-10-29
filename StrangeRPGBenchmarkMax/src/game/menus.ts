// Overlay screens: the pause menu, dial posts, shops, and placeholders that later hand off to minigames.
import { box, rect, blitUI } from '../engine/gfx';
import { drawText, textWidth, wrap, LINE_H, centerX } from '../engine/font';
import { C } from '../engine/palette';
import { H, W } from '../engine/screen';
import { pressed, repeat } from '../engine/input';
import { GAME, type Screen } from './game';
import { G, SETTINGS, save, saveSettings, exportSave, importSave, formatTime, flag } from './state';
import { icon, charImgs } from './art';
import { ITEMS, SHOPS } from '../content/items';
import { MEMBERS, statsAt, xpFor, skillsAt } from '../content/party';
import { SKILLS } from '../battle/skills';
import { FOES } from '../content/foes';
import { rawLines } from './script';
import { sfx, setVolumes } from '../audio';
import { say, closeBox, showLetter } from './dialogue';
import { F, enterMap } from './field';
import { fadeTo } from './fx';
import { maxHpOf, healParty } from './runner';

function openOverlay(s: Screen & { done: Promise<void> }): Promise<void> {
  GAME.overlay = s;
  return s.done.then(() => { GAME.overlay = null; });
}

function list(x: number, y: number, items: string[], cur: number, w: number, colors?: number[]) {
  items.forEach((t, i) => {
    const yy = y + i * (LINE_H + 1);
    if (i === cur) blitUI(icon('cursor'), x, yy);
    drawText(t, x + 9, yy, colors?.[i] ?? (i === cur ? C.white : C.gray), w - 9);
  });
}

// ---- Dial post ----

export function openPost(): Promise<void> {
  G.post = { map: G.map, x: G.x, y: G.y };
  let resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });
  const opts = ['Rest', 'Save', 'Letters', 'Leave'];
  let cur = G.lastMenu.post ?? 0;
  let busy = false;
  const s: Screen & { done: Promise<void> } = {
    done,
    update() {
      if (busy) return;
      if (repeat('up')) { cur = (cur + opts.length - 1) % opts.length; sfx('menu_move'); }
      if (repeat('down')) { cur = (cur + 1) % opts.length; sfx('menu_move'); }
      if (pressed('b')) { sfx('menu_back'); resolve(); return; }
      if (pressed('a')) {
        G.lastMenu.post = cur;
        const o = opts[cur];
        if (o === 'Leave') { sfx('menu_back'); resolve(); return; }
        busy = true;
        if (o === 'Rest') { healParty(); sfx('heal'); say(null, 'The party rests. HP is full.').then(() => { closeBox(); busy = false; }); }
        else if (o === 'Save') { const ok = save(); sfx(ok ? 'save' : 'menu_bad'); say(null, ok ? `Saved to file ${G.slot}.` : 'Could not save here.').then(() => { closeBox(); busy = false; }); }
        else if (o === 'Letters') {
          const read = [1, 2, 3, 4, 5, 6, 7].filter((n) => flag(`letter${n}_read`));
          (async () => { if (!read.length) await say(null, 'No letters yet.'); for (const n of read) await showLetter('letter_' + n, n === 5); closeBox(); busy = false; })();
        }
      }
    },
    render() {
      const w = 76, h = opts.length * (LINE_H + 1) + 18;
      box(8, 8, w, h, C.ink, C.gold2);
      drawText('Dial post', 13, 11, C.gold3);
      list(12, 23, opts, cur, w - 8);
    },
  };
  return openOverlay(s);
}

// ---- Shops ----

export function openShop(id: string): Promise<void> {
  let resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });
  const stock = SHOPS[id] ?? [];
  let cur = 0;
  let msg = '';
  const s: Screen & { done: Promise<void> } = {
    done,
    update() {
      if (repeat('up')) { cur = (cur + stock.length) % (stock.length + 1); sfx('menu_move'); }
      if (repeat('down')) { cur = (cur + 1) % (stock.length + 1); sfx('menu_move'); }
      if (pressed('b') || (pressed('a') && cur === stock.length)) { sfx('menu_back'); resolve(); return; }
      if (pressed('a')) {
        const it = ITEMS[stock[cur]];
        const price = it.price ?? 0;
        if (G.mites < price) { sfx('menu_bad'); msg = 'Not enough mites.'; return; }
        if (it.kind === 'key' && (G.items[it.id] ?? 0) > 0) { sfx('menu_bad'); msg = 'You have one.'; return; }
        G.mites -= price;
        G.items[it.id] = (G.items[it.id] ?? 0) + 1;
        sfx('coin');
        msg = `Bought ${it.name.toLowerCase()}.`;
      }
    },
    render() {
      box(6, 6, W - 12, 120, C.ink, C.gold2);
      drawText('Shop', 11, 9, C.gold3);
      drawText(`${G.mites} mites`, W - 12 - textWidth(`${G.mites} mites`), 9, C.gold3);
      const names = stock.map((k) => ITEMS[k].name);
      names.push('Leave');
      list(10, 22, names, cur, 110);
      stock.forEach((k, i) => { const p = String(ITEMS[k].price ?? 0); drawText(p, W - 14 - textWidth(p), 22 + i * (LINE_H + 1), C.pale); });
      const it = cur < stock.length ? ITEMS[stock[cur]] : null;
      if (it) {
        wrap(it.desc, W - 28).forEach((l, i) => drawText(l, 11, 92 + i * (LINE_H + 1), C.pale));
        const own = G.items[it.id] ?? 0;
        drawText(`Have ${own}`, 11, 114, C.slate);
      }
      if (msg) drawText(msg, W - 12 - textWidth(msg), 114, C.gold3);
    },
  };
  return openOverlay(s);
}

// ---- Sticks and credits hand off to their own modules ----

let sticksImpl: ((opp: string) => Promise<void>) | null = null;
let creditsImpl: (() => Promise<void>) | null = null;
export function registerSticks(f: (opp: string) => Promise<void>) { sticksImpl = f; }
export function registerCredits(f: () => Promise<void>) { creditsImpl = f; }
export async function openSticks(opp: string) { if (sticksImpl) await sticksImpl(opp); else { await say(null, 'The board is missing a stick.'); closeBox(); } }
export async function openCredits() { if (creditsImpl) await creditsImpl(); }

// ---- The pause menu ----

type Tab = 'Party' | 'Ledger' | 'Items' | 'Settings' | 'Save';
const TABS: Tab[] = ['Party', 'Ledger', 'Items', 'Settings', 'Save'];

export function openMenu(): Promise<void> {
  let resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });
  let tab = G.lastMenu.tab ?? 0;
  let inTab = false;
  let cur = 0;
  let sub = 0;
  let swapFrom = -1;
  let gearPick: string | null = null;
  let ledgerPage: 'entries' | 'foes' = 'entries';
  let msg = '';
  sfx('menu_ok');

  const gearItems = () => Object.keys(G.items).filter((k) => ITEMS[k]?.kind === 'gear' && (G.items[k] ?? 0) > 0);

  const s: Screen & { done: Promise<void> } = {
    done,
    update() {
      if (!inTab) {
        if (repeat('up')) { tab = (tab + TABS.length - 1) % TABS.length; sfx('menu_move'); }
        if (repeat('down')) { tab = (tab + 1) % TABS.length; sfx('menu_move'); }
        if (pressed('b')) { sfx('menu_back'); G.lastMenu.tab = tab; resolve(); return; }
        if (pressed('a')) { inTab = true; cur = 0; sub = 0; msg = ''; sfx('menu_ok'); G.lastMenu.tab = tab; }
        return;
      }
      const t = TABS[tab];
      if (t === 'Party') {
        const n = G.party.length;
        if (gearPick !== null) {
          const opts = ['(none)', ...gearItems()];
          if (repeat('up')) { sub = (sub + opts.length - 1) % opts.length; sfx('menu_move'); }
          if (repeat('down')) { sub = (sub + 1) % opts.length; sfx('menu_move'); }
          if (pressed('b')) { gearPick = null; sfx('menu_back'); return; }
          if (pressed('a')) {
            const m = G.members[gearPick];
            if (m.gear) G.items[m.gear] = (G.items[m.gear] ?? 0) + 1;
            const pick = opts[sub];
            m.gear = pick === '(none)' ? null : pick;
            if (m.gear) { G.items[m.gear]--; if (!G.items[m.gear]) delete G.items[m.gear]; }
            m.hp = Math.min(m.hp, maxHpOf(gearPick));
            gearPick = null;
            sfx('menu_ok');
          }
          return;
        }
        if (repeat('up')) { cur = (cur + n - 1) % n; sfx('menu_move'); }
        if (repeat('down')) { cur = (cur + 1) % n; sfx('menu_move'); }
        if (pressed('b')) { if (swapFrom >= 0) swapFrom = -1; else inTab = false; sfx('menu_back'); return; }
        if (pressed('c')) { gearPick = G.party[cur]; sub = 0; sfx('menu_ok'); return; }
        if (pressed('a')) {
          if (swapFrom < 0) { if (cur > 0) swapFrom = cur; else sfx('menu_bad'); }
          else {
            if (cur > 0) { const a = G.party[swapFrom]; G.party[swapFrom] = G.party[cur]; G.party[cur] = a; sfx('menu_ok'); }
            swapFrom = -1;
          }
        }
        return;
      }
      if (t === 'Ledger') {
        const items = ledgerPage === 'entries' ? G.entries : G.seen;
        if (repeat('left') || repeat('right')) { ledgerPage = ledgerPage === 'entries' ? 'foes' : 'entries'; cur = 0; sfx('menu_move'); }
        if (repeat('up') && items.length) { cur = (cur + items.length - 1) % items.length; sfx('menu_move'); }
        if (repeat('down') && items.length) { cur = (cur + 1) % items.length; sfx('menu_move'); }
        if (pressed('b')) { inTab = false; sfx('menu_back'); return; }
        if (pressed('a') && ledgerPage === 'entries' && items.length) {
          const id = items[cur];
          if (G.equipped.includes(id)) G.equipped = G.equipped.filter((e) => e !== id);
          else if (G.equipped.length < 4) G.equipped.push(id);
          else { sfx('menu_bad'); msg = 'Four at most. Take one off first.'; return; }
          sfx('menu_ok');
        }
        return;
      }
      if (t === 'Items') {
        const items = Object.keys(G.items).filter((k) => (G.items[k] ?? 0) > 0 && ITEMS[k]);
        if (repeat('up') && items.length) { cur = (cur + items.length - 1) % items.length; sfx('menu_move'); }
        if (repeat('down') && items.length) { cur = (cur + 1) % items.length; sfx('menu_move'); }
        if (pressed('b')) { inTab = false; sfx('menu_back'); return; }
        if (pressed('a') && items.length) {
          const it = ITEMS[items[cur]];
          if (it.use?.heal) {
            for (const id of G.party) { const m = G.members[id]; m.hp = Math.min(maxHpOf(id), m.hp + (it.use.heal ?? 0)); if (it.use.target !== 'party') break; }
            G.items[it.id]--; if (!G.items[it.id]) delete G.items[it.id];
            sfx('heal'); msg = `Used ${it.name.toLowerCase()}.`;
          } else { sfx('menu_bad'); msg = 'Not here.'; }
        }
        return;
      }
      if (t === 'Settings') {
        const rows = 7;
        if (repeat('up')) { cur = (cur + rows - 1) % rows; sfx('menu_move'); }
        if (repeat('down')) { cur = (cur + 1) % rows; sfx('menu_move'); }
        if (pressed('b')) { inTab = false; saveSettings(); sfx('menu_back'); return; }
        const d = repeat('left') ? -1 : repeat('right') ? 1 : 0;
        if (d) {
          if (cur === 0) SETTINGS.music = Math.max(0, Math.min(10, SETTINGS.music + d));
          if (cur === 1) SETTINGS.sfx = Math.max(0, Math.min(10, SETTINGS.sfx + d));
          if (cur === 2) SETTINGS.voice = Math.max(0, Math.min(10, SETTINGS.voice + d));
          if (cur === 3) SETTINGS.textSpeed = Math.max(0, Math.min(2, SETTINGS.textSpeed + d));
          if (cur === 4) { const v = ((G.vars.difficulty as number ?? 0) + 3 + d) % 3; G.vars.difficulty = v; }
          setVolumes(SETTINGS.music, SETTINGS.sfx, SETTINGS.voice);
          sfx('menu_move');
        }
        if (pressed('a') && cur === 5) { save(); exportSave(G.slot); msg = 'Saved and exported.'; }
        // A way out of any spot the hero cannot walk out of, such as crates pushed into a doorway. It resets the map's crates too.
        if (pressed('a') && cur === 6) { sfx('menu_ok'); inTab = false; resolve(); void (async () => { await fadeTo(1, 0.3); enterMap(G.map, F.entry); await fadeTo(0, 0.3); })(); return; }
        return;
      }
      if (t === 'Save') {
        if (pressed('b')) { inTab = false; sfx('menu_back'); return; }
        if (pressed('a')) { const ok = save(); sfx(ok ? 'save' : 'menu_bad'); msg = ok ? `Saved to file ${G.slot}.` : 'Could not save.'; }
      }
    },
    render() {
      box(4, 4, 52, TABS.length * (LINE_H + 1) + 8, C.ink, C.gold2);
      list(7, 8, TABS, tab, 46, TABS.map((_, i) => (i === tab ? C.white : C.gray)));
      box(4, 70, 52, 30, C.ink, C.slate);
      drawText(`${G.mites}`, 9, 74, C.gold3);
      blitUI(icon('mites'), 44, 74);
      drawText(formatTime(G.playtime), 9, 86, C.pale);
      const x = 62, y = 4, w = W - 66, h = H - 8;
      box(x, y, w, h, C.ink, C.slate);
      const t = TABS[tab];
      if (t === 'Party') renderParty(x + 4, y + 4, w - 8);
      if (t === 'Ledger') renderLedger(x + 4, y + 4, w - 8);
      if (t === 'Items') renderItems(x + 4, y + 4, w - 8);
      if (t === 'Settings') renderSettings(x + 4, y + 4, w - 8);
      if (t === 'Save') { drawText(`File ${G.slot}: ${G.name}`, x + 6, y + 6, C.white); drawText(`Chapter ${G.chapter}  ${formatTime(G.playtime)}`, x + 6, y + 18, C.pale); drawText('Z: save now', x + 6, y + 34, inTab ? C.gold3 : C.slate); }
      if (msg) drawText(msg, x + 6, y + h - 12, C.gold3);
    },
  };

  function renderParty(x: number, y: number, w: number) {
    G.party.forEach((id, i) => {
      const m = G.members[id];
      if (!m) return;
      const yy = y + i * 28;
      const st = statsAt(id, m.level);
      const g = m.gear ? ITEMS[m.gear] : null;
      if (inTab && i === cur) blitUI(icon('cursor'), x, yy + 2);
      if (swapFrom === i) rect(x + 9, yy, w - 9, 26, C.plum1);
      blitUI(charImgs(id).down[0], x + 10, yy + 2);
      drawText(`${id === 'nodus' ? G.name : MEMBERS[id]?.name ?? id}  Lv ${m.level}`, x + 22, yy + 1, i < 3 ? C.white : C.gray);
      const max = maxHpOf(id);
      drawText(`HP ${Math.max(0, Math.min(m.hp, max))}/${max}`, x + 22, yy + 10, C.pale);
      drawText(`Pow ${st.pow + (g?.gear?.pow ?? 0)}`, x + 68, yy + 10, C.pale);
      drawText(`Guard ${st.guard + (g?.gear?.guard ?? 0)}`, x + 22, yy + 19, C.pale);
      drawText(g ? g.name : 'No gear', x + 64, yy + 19, C.slate, w - 64);
      // Progress to the next level as a bar under the row.
      const lo = xpFor(m.level), hi = xpFor(m.level + 1);
      rect(x + 22, yy + 27, w - 22, 1, C.black);
      rect(x + 22, yy + 27, Math.round(((w - 22) * Math.max(0, Math.min(1, (m.xp - lo) / Math.max(1, hi - lo))))), 1, C.teal2);
    });
    if (gearPick) {
      const opts = ['(none)', ...gearItems().map((k) => ITEMS[k].name)];
      box(x + 20, y + 40, 100, opts.length * (LINE_H + 1) + 6, C.ink, C.gold2);
      list(x + 24, y + 43, opts, sub, 92);
    }
    drawText(inTab ? 'Z: swap order  C: gear' : 'The first three fight.', x, H - 22, C.slate);
  }

  function renderLedger(x: number, y: number, w: number) {
    drawText(ledgerPage === 'entries' ? '< Entries >' : '< Foes >', x, y, C.gold3);
    const items = ledgerPage === 'entries' ? G.entries : G.seen;
    if (!items.length) { drawText(ledgerPage === 'entries' ? 'No entries yet.' : 'No foes written.', x, y + 14, C.slate); return; }
    const top = Math.max(0, Math.min(cur - 3, items.length - 8));
    items.slice(top, top + 8).forEach((id, i) => {
      const yy = y + 12 + i * (LINE_H + 1);
      const name = ledgerPage === 'entries' ? SKILLS[id]?.name ?? id : FOES[id]?.name ?? id;
      if (inTab && top + i === cur) blitUI(icon('cursor'), x, yy);
      const on = ledgerPage === 'entries' && G.equipped.includes(id);
      drawText(name + (on ? ' *' : ''), x + 9, yy, on ? C.gold3 : top + i === cur ? C.white : C.gray);
    });
    const id = items[cur];
    const text = ledgerPage === 'entries' ? SKILLS[id]?.desc ?? '' : rawLines('note_' + id).join(' ');
    wrap(text, w).slice(0, 5).forEach((l, i) => drawText(l, x, y + 98 + i * (LINE_H + 1), C.pale));
    if (ledgerPage === 'entries') drawText(`${G.equipped.length}/4 carried  Z: carry`, x, H - 22, C.slate);
  }

  function renderItems(x: number, y: number, w: number) {
    const items = Object.keys(G.items).filter((k) => (G.items[k] ?? 0) > 0 && ITEMS[k]);
    if (!items.length) { drawText('Nothing.', x, y, C.slate); return; }
    const top = Math.max(0, Math.min(cur - 4, items.length - 9));
    items.slice(top, top + 9).forEach((k, i) => {
      const yy = y + i * (LINE_H + 1);
      if (inTab && top + i === cur) blitUI(icon('cursor'), x, yy);
      blitUI(icon(ITEMS[k].icon), x + 9, yy);
      drawText(ITEMS[k].name, x + 19, yy, top + i === cur ? C.white : C.gray);
      const n = `x${G.items[k]}`;
      drawText(n, x + w - textWidth(n), yy, C.pale);
    });
    const it = ITEMS[items[cur]];
    if (it) wrap(it.desc, w).slice(0, 4).forEach((l, i) => drawText(l, x, y + 100 + i * (LINE_H + 1), C.pale));
  }

  function renderSettings(x: number, y: number, w: number) {
    const diff = ['Normal', 'Hard', 'Gentle'][(G.vars.difficulty as number) ?? 0];
    const rows = [`Music  ${SETTINGS.music}`, `Sounds  ${SETTINGS.sfx}`, `Voices  ${SETTINGS.voice}`, `Text  ${['slow', 'normal', 'fast'][SETTINGS.textSpeed]}`, `Foes  ${diff}`, 'Export save file', 'Back to entrance'];
    list(x, y, rows, inTab ? cur : -1, w);
    drawText('Left and right: change', x, H - 22, C.slate);
  }

  return openOverlay(s);
}

export { centerX };
void skillsAt;
void F;
