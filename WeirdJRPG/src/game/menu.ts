import { rect, W, dither } from '../engine/screen';
import { text, textWidth, LINE, wrap } from '../engine/font';
import { input } from '../engine/input';
import { spr } from '../engine/sprites';
import { sfx, setMuted, isMuted } from '../engine/audio';
import { S, fmax, stateName, slotCount, flag } from './state';
import { game, goal, MAPS } from './registry';
import { panel, list, para, fragBar, bar } from './ui';
import { UI, LAYER_COLOR } from './palette';
import { SENSES, SENSE_NAME, STATES, type Layer } from '../battle/model';
import { SHELLS, CONCEPTS } from '../battle/enemies';
import { SENSE_ICON, LAYER_ICON, AVATAR } from './art';
import { F, entInFront, revealed, tileAt } from './field';
import { run } from './script';
import { toast } from './ui';
import { say } from './api';

const TABS = ['Pilgrim', 'Senses', 'Collector', 'Map', 'Quests', 'Options'];
const COL_TABS = ['Shells', 'Memories', 'Emotions', 'Names', 'Concepts'];

const M = { tab: 0, cur: 0, sub: -1, ctab: 0, top: 0, confirm: false };

export function openMenu(): void {
  M.tab = S.cursors.menuTab || 0;
  M.ctab = S.cursors.colTab || 0;
  M.cur = 0; M.sub = -1; M.top = 0; M.confirm = false;
  game.mode = 'menu';
  sfx('confirm');
}

function close(): void { game.mode = 'field'; S.cursors.menuTab = M.tab; S.cursors.colTab = M.ctab; }

export const SENSE_TEXT: Record<string, [string, string, string]> = {
  sight: ['Passive: hidden things and false intents show.', 'Active: True Sight. See the world as it truly is.', 'Ultimate: Unseeing. Nothing can perceive you.'],
  touch: ['Passive: you feel the moods of people near you.', 'Active: Handshake. Connect with an object or a being.', 'Ultimate: Embrace. Merge with an enemy for a turn.'],
  hearing: ['Passive: you hear things that sing.', "Active: Echo. Repeat the last thing anyone did.", "Ultimate: Silence. Enemies use only plain attacks."],
  taste: ['Passive: you taste the essence of things.', 'Active: Savor. Extract the flavor and gain from it.', 'Ultimate: Devour. Consume everything around you.'],
  smell: ['Passive: you smell the memories of places.', 'Active: Scent. Follow the scent of your goal (Tab).', 'Ultimate: Oblivion Scent. Make something forgettable.'],
  thought: ['Passive: untranslatable words become readable.', 'Active: Insight. See the truth of a thing.', 'Ultimate: Awakening. Show it its true nature.'],
};

interface ColItem { label: string; right: string; text: string; ok: boolean; act?: () => void; color?: string }

function colItems(): ColItem[] {
  const t = COL_TABS[M.ctab];
  if (t === 'Shells') {
    const out: ColItem[] = [{ label: 'Wear nothing', right: S.worn ? '' : 'worn', text: 'No shell. You are pure consciousness.', ok: true, act: () => { S.worn = null; sfx('cancel'); } }];
    for (const [k, n] of Object.entries(S.shells)) {
      const sh = SHELLS[k];
      if (!sh || n <= 0) continue;
      out.push({ label: sh.name, right: S.worn === k ? 'worn' : `x${n}`, text: `${sh.text} Armor ${Math.round(sh.armor * 100)}%, Void ${Math.round(sh.voidRes * 100)}%.`, ok: true, act: () => { S.worn = k; sfx('shell_get'); } });
    }
    return out;
  }
  if (t === 'Memories') {
    return Object.entries(S.memories).filter(([, n]) => n > 0).map(([k, n]) => ({
      label: k.length > 22 ? k.slice(0, 21) + '.' : k, right: `x${n}`, text: `${k}. Absorb it to restore a quarter of your Fragility.`, ok: true,
      act: () => {
        const add = Math.round(fmax() * 0.25);
        S.f = Math.min(fmax(), S.f + add);
        S.memories[k]--;
        sfx('absorb');
        toast(`+${add} Fragility${S.f > fmax() * 0.8 ? '. Too much.' : ''}`, S.f > fmax() * 0.8 ? UI.red : UI.green);
      },
    }));
  }
  if (t === 'Emotions') {
    return Object.entries(S.emotions).filter(([, n]) => n > 0).map(([k, n]) => ({
      label: k, right: `x${n}`, text: `Raw ${k}. Absorb it and you will look it for a while.`, ok: true, color: undefined,
      act: () => { S.mood = k; S.emotions[k]--; sfx('emotion_get'); },
    }));
  }
  if (t === 'Names') {
    return Object.entries(S.names).filter(([, n]) => n > 0).map(([k, n]) => ({
      label: k, right: `x${n}`, text: `A true name. Use it on whatever is in front of you to rename it.`, ok: true,
      act: () => {
        close();
        const e = entInFront();
        const fn = e?.def.rename?.[k];
        if (fn) { S.names[k]--; sfx('rename'); run(fn); } else run(function* () { yield* say(null, e ? 'It does not answer to that name.' : 'There is nothing in front of you to name.'); });
      },
    }));
  }
  const slots = slotCount();
  return S.concepts.map(c => ({
    label: c, right: S.slots.includes(c) ? 'slotted' : '', text: CONCEPTS[c]?.text || '', ok: true,
    act: () => {
      if (S.slots.includes(c)) S.slots = S.slots.filter(x => x !== c);
      else if (S.slots.length < slots) S.slots.push(c);
      else { S.slots.shift(); S.slots.push(c); }
      sfx('concept_get');
    },
  }));
}

export function menuUpdate(): void {
  if (M.sub < 0) {
    if (input.hit('back')) { close(); sfx('cancel'); return; }
    if (input.hit('left')) { M.tab = (M.tab + TABS.length - 1) % TABS.length; sfx('move'); M.cur = 0; }
    if (input.hit('right')) { M.tab = (M.tab + 1) % TABS.length; sfx('move'); M.cur = 0; }
    if (input.hit('ok') || input.hit('down')) {
      if (TABS[M.tab] === 'Collector' || TABS[M.tab] === 'Options' || TABS[M.tab] === 'Senses') { M.sub = 0; M.cur = 0; M.top = 0; sfx('confirm'); }
    }
    return;
  }
  const tab = TABS[M.tab];
  if (input.hit('back')) { M.sub = -1; sfx('cancel'); return; }
  if (tab === 'Senses') {
    if (input.hit('up')) M.cur = (M.cur + 5) % 6;
    if (input.hit('down')) M.cur = (M.cur + 1) % 6;
    return;
  }
  if (tab === 'Collector') {
    if (input.hit('left')) { M.ctab = (M.ctab + COL_TABS.length - 1) % COL_TABS.length; M.cur = 0; M.top = 0; sfx('move'); }
    if (input.hit('right')) { M.ctab = (M.ctab + 1) % COL_TABS.length; M.cur = 0; M.top = 0; sfx('move'); }
    const items = colItems();
    if (items.length) {
      if (input.hit('up')) { M.cur = (M.cur + items.length - 1) % items.length; sfx('move'); }
      if (input.hit('down')) { M.cur = (M.cur + 1) % items.length; sfx('move'); }
      M.cur = Math.min(M.cur, items.length - 1);
      if (M.cur < M.top) M.top = M.cur;
      if (M.cur >= M.top + 7) M.top = M.cur - 6;
      if (input.hit('ok')) items[M.cur].act?.();
    }
    return;
  }
  if (tab === 'Options') {
    const n = 2;
    if (input.hit('up')) M.cur = (M.cur + n - 1) % n;
    if (input.hit('down')) M.cur = (M.cur + 1) % n;
    if (input.hit('ok')) {
      if (M.cur === 0) { setMuted(!isMuted()); sfx('confirm'); }
      else if (M.cur === 1) { if (!M.confirm) { M.confirm = true; sfx('buzz'); } else location.reload(); }
    }
  }
}

function drawPilgrim(y: number): void {
  const art = (AVATAR[S.avatar] || AVATAR.snake)[(game.tick >> 5) & 1];
  spr(art, 10, y + 2, '#dceeff', '#3a4a6a');
  text(`The Pilgrim, ${stateName()}`, 24, y + 2, UI.gold);
  const bx = 10 + Math.max(textWidth('Fragility'), textWidth('The Unraveling')) + 5;
  const nx = 214 - textWidth('000/000');
  const bw = nx - 5 - bx;
  text('Fragility', 10, y + 16, UI.dim);
  fragBar(bx, y + 18, bw, S.f, fmax(), fmax() * 0.2, fmax() * 0.8, game.tick);
  text(`${Math.round(S.f)}/${fmax()}`, nx, y + 16, UI.paper);
  const unr = Math.min(99, Math.floor(S.up / 7));
  text('The Unraveling', 10, y + 28, UI.dim);
  bar(bx, y + 31, bw, 3, unr / 100, UI.red);
  text(`${unr}%`, nx, y + 28, UI.red);
  let yy = y + 42;
  text(`Worn: ${S.worn ? SHELLS[S.worn]?.name : 'nothing'}`, 10, yy, UI.paper); yy += LINE;
  for (const l of wrap(`Concepts: ${S.slots.join(', ') || 'none'} (${S.slots.length}/${slotCount()})`, 204)) { text(l, 10, yy, UI.paper); yy += LINE; }
  yy += 4;
  if (S.vorn) { text('Vorn', 10, yy, UI.paper); bar(104, yy + 3, 40, 3, S.vorn.hp / S.vorn.max, '#9cc0d8'); text(`${S.vorn.hp}/${S.vorn.max}`, 150, yy, UI.dim); yy += LINE; }
  if (S.lb) { text('Light-Bound #123', 10, yy, UI.paper); bar(104, yy + 3, 40, 3, S.lb.hp / S.lb.max, '#f4e08c'); text(`${S.lb.hp}/${S.lb.max}`, 150, yy, UI.dim); yy += LINE; }
  yy += 4;
  text('States', 10, yy, UI.dim); yy += LINE;
  STATES.forEach((s, i) => text(s, 10 + (i % 2) * 104, yy + Math.floor(i / 2) * LINE, i <= S.state ? (i === S.state ? UI.gold : UI.paper) : UI.faint));
}

function drawSenses(y: number): void {
  SENSES.forEach((s, i) => {
    const lv = S.senses[s] || 0;
    const yy = y + 2 + i * 12;
    if (M.sub >= 0 && M.cur === i) text('\u0001', 6, yy + 2, UI.gold);
    spr(SENSE_ICON[s], 14, yy + 1, lv ? UI.paper : UI.faint, lv ? UI.gold : UI.faint);
    text(SENSE_NAME[s], 26, yy + 2, lv ? UI.paper : UI.faint);
    text(lv >= 2 ? 'whole' : lv ? 'awake' : 'asleep', 70, yy + 2, lv >= 2 ? UI.gold : lv ? UI.dim : UI.faint);
  });
  const s = SENSES[M.sub >= 0 ? M.cur : 0];
  const lv = S.senses[s] || 0;
  const tx = SENSE_TEXT[s];
  let yy = y + 78;
  const shown = [lv >= 1, lv >= 1, lv >= 2];
  for (let k = 0; k < 3; k++) yy += para(shown[k] ? tx[k] : k === 0 ? 'Not yet awake.' : '...', 10, yy, 204, shown[k] ? UI.paper : UI.faint) * LINE + 2;
}

function drawCollector(y: number): void {
  tabHeader(COL_TABS, M.ctab, y, M.sub >= 0);
  const items = colItems();
  if (!items.length) { text('Nothing yet.', 10, y + 16, UI.faint); }
  else {
    list(items.map(i => ({ label: i.label, right: i.right, color: i.color })), M.sub >= 0 ? M.cur : -1, 8, y + 16, 200, M.top, 7);
    const it = items[Math.min(M.cur, items.length - 1)];
    rect(8, y + 82, 208, 1, UI.edge);
    if (it) para(it.text, 10, y + 86, 204, UI.paper, 5);
  }
  const lay: Layer[] = ['shell', 'memory', 'emotion', 'name'];
  lay.forEach((l, i) => { spr(LAYER_ICON[l], 10 + i * 52, y + 136, LAYER_COLOR[l], UI.ink); text(String(S.totals[l]), 20 + i * 52, y + 136, UI.paper); });
}

function drawMap(y: number): void {
  if (!F.map) return;
  const scale = Math.max(1, Math.min(4, Math.floor(Math.min(200 / F.w, 136 / F.h))));
  const ox = Math.round((W - F.w * scale) / 2), oy = y + 4;
  for (let yy = 0; yy < F.h; yy++) for (let xx = 0; xx < F.w; xx++) {
    if (!revealed(xx, yy)) { if ((xx + yy + (game.tick >> 3)) % 5 === 0) rect(ox + xx * scale, oy + yy * scale, scale, scale, UI.faint); continue; }
    const t = tileAt(xx, yy);
    if (!t || t.backdrop) continue;
    rect(ox + xx * scale, oy + yy * scale, scale, scale, t.solid && !t.lie ? UI.edge : t.water ? '#24406a' : UI.dim);
  }
  if ((game.tick >> 3) & 1) rect(ox + F.p.x * scale, oy + F.p.y * scale, scale, scale, UI.gold);
  text(F.map.name, 10, y + 146, UI.gold);
  const seen = Object.keys(S.revealed).filter(k => MAPS[k] && k !== F.map!.id).map(k => MAPS[k].name.replace(/^The /, ''));
  para(seen.length ? 'Remembered: ' + seen.join(', ') + '.' : 'Nowhere else, yet.', 10, y + 156, 204, UI.dim, 3);
}

function drawQuests(y: number): void {
  const g = goal();
  text('Now', 10, y, UI.dim);
  para(g.text, 10, y + LINE, 204, UI.gold, 3);
  let yy = y + 42;
  const q = (name: string, n: number, of: number, l: Layer) => {
    spr(LAYER_ICON[l], 10, yy, LAYER_COLOR[l], UI.ink);
    text(name, 22, yy, n >= of ? UI.gold : UI.paper);
    bar(120, yy + 3, 60, 3, Math.min(1, n / of), LAYER_COLOR[l]);
    text(`${Math.min(n, of)}/${of}`, 186, yy, UI.dim);
    yy += 12;
  };
  q('The Shell Collection', S.totals.shell, 100, 'shell');
  q('The Memory Hunt', S.totals.memory, 50, 'memory');
  q('The Emotion Harvest', S.totals.emotion, 100, 'emotion');
  q('The Name Unraveling', S.totals.name, 50, 'name');
  yy += 4;
  text(flag('void_journey') ? 'The Void Journey: you came back.' : flag('void_seen') ? 'The Void Journey: touch the Void and return.' : '???', 10, yy, flag('void_journey') ? UI.gold : UI.faint);
  yy += LINE;
  text(flag('year_done') ? 'The Year 1977: you escaped.' : flag('year_seen') ? 'The Year 1977: still 1977.' : '', 10, yy, UI.paper);
}

function drawOptions(y: number): void {
  list([{ label: `Sound: ${isMuted() ? 'off' : 'on'}` }, { label: M.confirm ? 'Quit to title? Press again.' : 'Quit to title' }], M.sub >= 0 ? M.cur : -1, 10, y + 4, 200);
  para('The game saves when you steady yourself at a steam fountain, a lamp, or a heart of crystal.', 10, y + 40, 204, UI.dim);
  para('Arrows move. Z confirms. X goes back. C opens your senses. Tab follows the scent of your goal. Shift hurries. M mutes.', 10, y + 72, 204, UI.dim);
}

/** A centered tab name between arrows, with one dot per tab. */
function tabHeader(tabs: string[], cur: number, y: number, active: boolean): void {
  const name = tabs[cur];
  const w = textWidth(name);
  const cx = 112;
  text(name, Math.round(cx - w / 2), y, active ? UI.gold : UI.paper);
  if (active && (game.tick >> 4) & 1) { text('<', Math.round(cx - w / 2) - 10, y, UI.dim); text('>', Math.round(cx + w / 2) + 5, y, UI.dim); }
  const dx = 6, x0 = Math.round(cx - ((tabs.length - 1) * dx) / 2);
  tabs.forEach((_, i) => rect(x0 + i * dx - 1, y + 10, 3, 1, i === cur ? (active ? UI.gold : UI.paper) : UI.faint));
}

export function menuDraw(): void {
  dither(0, 0, W, 224, UI.ink, 0.75);
  panel(2, 2, 220, 220);
  tabHeader(TABS, M.tab, 7, M.sub < 0);
  rect(6, 19, 212, 1, UI.edge);
  const y = 26;
  switch (TABS[M.tab]) {
    case 'Pilgrim': drawPilgrim(y); break;
    case 'Senses': drawSenses(y); break;
    case 'Collector': drawCollector(y); break;
    case 'Map': drawMap(y); break;
    case 'Quests': drawQuests(y); break;
    case 'Options': drawOptions(y); break;
  }
}
