// The pause menu and its screens: party, gear, items, journal, rest, saves, options, and shops.
import { rect, blitUI, hline, box } from '../engine/gfx';
import { drawText, textWidth, LINE_H } from '../engine/font';
import { C } from '../engine/palette';
import { pressed, repeat, consume } from '../engine/input';
import { W, H } from '../engine/screen';
import { G, SETTINGS, saveSettings, type Member } from '../game/state';
import { maxHp, defenseOf, moveOf, pool, ramOf, abilitiesOf, attrOf, edgeMax, partyMembers } from '../rules/stats';
import { ABILITY, ATTRS, ATTR_NAME, CLASSES, ITEM, PERKS, PERK_LEVELS, SKILLS, SKILL_NAME, XP_TO, type ItemDef } from '../rules/data';
import { QUEST } from '../content/quests';
import { FACTIONS, type Destination } from '../content/replay';
import { destinations, rep, tier } from '../game/replay';
import { DETAILS, LORE } from '../content/details';
import { detailsFound } from '../game/details';
import { SHOPS } from '../content/shops';
import { panel, listInput, drawList, drawWrapped, NameEntry, listRows, drawListRows, type ListItem } from './widgets';
import { SLOTS, slotInfo, writeSlot, load, exportSave, importSave, fmtTime } from '../game/save';
import { lookFor } from '../world/field';
import { sfx, setVolumes } from '../audio/sfx';
import { toast } from './dialogue';

export interface Screen { update(dt: number): void; render(): void; done?: boolean }

export const MENU = {
  stack: [] as Screen[],
  hooks: {
    rest: (_kind: 'short' | 'long') => {},
    loaded: () => {},
    title: () => {},
    campHere: () => false,
  },
};

export function menuOpen(): boolean { return MENU.stack.length > 0; }
export function pushScreen(s: Screen) { MENU.stack.push(s); }
export function openMenu() { sfx('menu'); MENU.stack = [new MainMenu()]; }
export function closeMenu() { MENU.stack = []; }

export function updateMenu(dt: number) {
  const top = MENU.stack[MENU.stack.length - 1];
  if (!top) return;
  top.update(dt);
  if (top.done) { MENU.stack.pop(); consume(); }
}

export function renderMenu() { for (const s of MENU.stack) s.render(); }

function nameOf(m: Member): string { return m.id === 'hero' ? G.heroName : m.name; }

function roster(): Member[] {
  const all = Object.values(G.roster).filter((m) => !m.dead);
  return all.sort((a, b) => (G.party.indexOf(a.id) + 99 * (G.party.includes(a.id) ? 0 : 1)) - (G.party.indexOf(b.id) + 99 * (G.party.includes(b.id) ? 0 : 1)));
}

function back(s: Screen): boolean {
  if (pressed('b')) { consume(); s.done = true; sfx('cancel'); return true; }
  return false;
}

class MainMenu implements Screen {
  done = false;
  sel = G.menu.main ?? 0;
  items = ['Party', 'Gear', 'Items', 'Journal', 'Rest', 'Save', 'Load', 'Options', 'Quit to title'];
  update() {
    if (back(this)) return;
    const r = listInput(this.sel, this.items.length, 10, 22, 60);
    this.sel = r.sel;
    G.menu.main = this.sel;
    if (!r.ok) return;
    sfx('confirm');
    const pick = this.items[this.sel];
    if (pick === 'Party') pushScreen(new PartyScreen());
    if (pick === 'Gear') pushScreen(new GearScreen());
    if (pick === 'Items') pushScreen(new ItemsScreen());
    if (pick === 'Journal') pushScreen(new JournalScreen());
    if (pick === 'Rest') pushScreen(new RestScreen());
    if (pick === 'Save') pushScreen(new SlotScreen(false));
    if (pick === 'Load') pushScreen(new SlotScreen(true));
    if (pick === 'Options') pushScreen(new OptionsScreen());
    if (pick === 'Quit to title') pushScreen(new ConfirmScreen('Quit without saving?', () => { closeMenu(); MENU.hooks.title(); }));
  }
  render() {
    panel(4, 4, W - 8, H - 8);
    drawText('FATHOM', 10, 8, C.cyan3);
    drawText(`${G.gilt} gilt`, W - 12 - textWidth(`${G.gilt} gilt`), 8, C.amb3);
    hline(6, 17, W - 12, C.night);
    const pend = Object.values(G.roster).some((m) => m.pendingPerks || m.pendingAttr);
    drawList(this.items.map((t) => ({ text: t, color: t === 'Party' && pend ? C.amb3 : undefined })), this.sel, 10, 22, 60);
    let y = 22;
    for (const m of partyMembers()) {
      const sh = lookFor(m.id).frames.down[0];
      blitUI(sh, 84, y);
      drawText(nameOf(m), 97, y, C.white);
      drawText(`Lv ${m.level}`, W - 14 - textWidth(`Lv ${m.level}`), y, C.gray);
      const mh = maxHp(m);
      rect(97, y + 10, 60, 2, C.night);
      rect(97, y + 10, Math.round(60 * Math.max(0, m.hp) / mh), 2, m.hp < mh * 0.3 ? C.mag3 : C.grn3);
      drawText(`${Math.max(0, m.hp)}/${mh}`, 160, y + 7, C.gray);
      if (m.pendingPerks || m.pendingAttr) drawText('!', 92, y, C.amb3);
      y += 22;
    }
    drawText(`${G.district}`, 84, H - 32, C.vio3);
    drawText(`Chapter ${G.chapter}`, 84, H - 22, C.gray);
    drawText(fmtTime(G.playtime), W - 12 - textWidth(fmtTime(G.playtime)), H - 22, C.gray);
    const supplies = Object.entries(G.items).reduce((s, [id, n]) => s + (ITEM.get(id)?.supplies ?? 0) * n, 0);
    drawText(`Supplies ${supplies}`, 10, H - 22, C.grn3);
  }
}

class ConfirmScreen implements Screen {
  done = false;
  sel = 1;
  constructor(public q: string, public yes: () => void) {}
  update() {
    if (back(this)) return;
    const r = listInput(this.sel, 2, 60, 96, 80);
    this.sel = r.sel;
    if (r.ok) { this.done = true; if (this.sel === 0) this.yes(); }
  }
  render() {
    panel(40, 78, 120, 42, this.q);
    drawList([{ text: 'Yes' }, { text: 'No' }], this.sel, 60, 96, 80);
  }
}

// ---------- party ----------

class PartyScreen implements Screen {
  done = false;
  i = 0;
  scroll = 0;
  perkSel = 0;
  attrSel = 0;
  mode: 'view' | 'perk' | 'attr' = 'view';
  update() {
    const list = roster();
    const m = list[this.i % list.length];
    if (this.mode === 'perk') {
      const tier = CLASSES[m.cls].perks[PERK_LEVELS.findIndex((l) => l <= m.level && !CLASSES[m.cls].perks[PERK_LEVELS.indexOf(l)].some((p) => m.perks.includes(p)))] ?? [];
      if (pressed('b')) { consume(); this.mode = 'view'; return; }
      const r = listInput(this.perkSel, tier.length, 10, 48, 180, 32);
      this.perkSel = r.sel;
      if (r.ok && tier[this.perkSel]) { m.perks.push(tier[this.perkSel]); m.pendingPerks--; m.hp = Math.min(maxHp(m), m.hp + 8); this.mode = 'view'; sfx('levelup'); }
      return;
    }
    if (this.mode === 'attr') {
      if (pressed('b')) { consume(); this.mode = 'view'; return; }
      const r = listInput(this.attrSel, 4, 10, 60, 100);
      this.attrSel = r.sel;
      if (r.ok) { const before = maxHp(m); m.attr[ATTRS[this.attrSel]]++; m.pendingAttr--; m.hp += maxHp(m) - before; this.mode = 'view'; sfx('levelup'); }
      return;
    }
    if (back(this)) return;
    if (repeat('left')) { this.i = (this.i + list.length - 1) % list.length; this.scroll = 0; sfx('cursor'); }
    if (repeat('right')) { this.i = (this.i + 1) % list.length; this.scroll = 0; sfx('cursor'); }
    if (repeat('down')) this.scroll++;
    if (repeat('up')) this.scroll = Math.max(0, this.scroll - 1);
    if (pressed('a')) {
      if (m.pendingPerks) { this.mode = 'perk'; this.perkSel = 0; }
      else if (m.pendingAttr) { this.mode = 'attr'; this.attrSel = 0; }
    }
    if (pressed('rename')) {
      if (m.id === 'hero') pushScreen(new RenameScreen('Your name', G.heroName, (s) => { G.heroName = s; }));
    }
  }
  render() {
    const list = roster();
    const m = list[this.i % list.length];
    panel(4, 4, W - 8, H - 8);
    const sh = lookFor(m.id).frames.down[0];
    blitUI(sh, 10, 8);
    drawText(nameOf(m), 24, 8, C.white);
    drawText(`${CLASSES[m.cls].name} ${m.level}`, 24, 17, C.gray);
    drawText(`< ${this.i % list.length + 1}/${list.length} >`, W - 14 - textWidth(`< 1/1 >`), 8, C.slate);
    const nxt = XP_TO[Math.min(10, m.level + 1)];
    drawText(m.level >= 10 ? 'XP max' : `XP ${m.xp}/${nxt}`, W - 14 - textWidth(m.level >= 10 ? 'XP max' : `XP ${m.xp}/${nxt}`), 17, C.cyan3);
    hline(6, 27, W - 12, C.night);
    if (this.mode === 'perk') {
      const tierI = PERK_LEVELS.findIndex((l) => l <= m.level && !CLASSES[m.cls].perks[PERK_LEVELS.indexOf(l)].some((p) => m.perks.includes(p)));
      const tier = CLASSES[m.cls].perks[tierI] ?? [];
      drawText('Choose a perk', 10, 32, C.amb3);
      tier.forEach((p, k) => {
        const y = 48 + k * 32;
        if (k === this.perkSel) rect(8, y - 1, W - 16, 31, C.vio0);
        drawText(PERKS[p]?.name ?? p, 12, y, k === this.perkSel ? C.white : C.pale);
        drawWrapped(PERKS[p]?.desc ?? '', 12, y + 9, W - 24, C.gray, 2);
      });
      return;
    }
    if (this.mode === 'attr') {
      drawText('Raise an attribute', 10, 32, C.amb3);
      drawList(ATTRS.map((a) => ({ text: ATTR_NAME[a], right: String(m.attr[a]) })), this.attrSel, 10, 60, 100);
      return;
    }
    let y = 31;
    const hp = `HP ${Math.max(0, m.hp)}/${maxHp(m)}`;
    drawText(hp, 10, y, C.grn3);
    drawText(`Def ${defenseOf(m)}`, 80, y, C.pale);
    drawText(`Move ${moveOf(m)}`, 120, y, C.pale);
    drawText(`Edge ${m.edge}/${edgeMax(m)}`, 10, y + 9, C.amb3);
    if (m.cls === 'diver') drawText(`RAM ${ramOf(m)}`, 80, y + 9, C.grn3);
    if (m.id !== 'hero' && m.id !== 'courtesy') drawText(`Approval ${m.approval}`, 120, y + 9, m.approval >= 10 ? C.grn3 : m.approval <= -10 ? C.mag3 : C.gray);
    if (m.id === 'hero' && G.flags.port_named) drawText(`${G.port.name}: Hold ${G.port.hold}  Self ${G.port.self}`, 80, y + 9, C.cyan3, W - 92);
    if (m.id === 'courtesy') drawText(`Approval ${m.approval}`, 120, y + 9, C.gray);
    y += 21;
    ATTRS.forEach((a, k) => drawText(`${ATTR_NAME[a].slice(0, 3)} ${attrOf(m, a)}`, 10 + k * 46, y, C.white));
    y += 11;
    SKILLS.forEach((s, k) => {
      const col = k % 2, row = Math.floor(k / 2);
      drawText(`${SKILL_NAME[s]}`, 10 + col * 92, y + row * 9, C.pale);
      drawText(`${pool(m, s)}`, 70 + col * 92, y + row * 9, C.cyan3);
    });
    y += 38;
    hline(6, y, W - 12, C.night);
    y += 3;
    const lines: { t: string; c: number }[] = [];
    for (const id of abilitiesOf(m)) { const a = ABILITY.get(id)!; lines.push({ t: a.name, c: C.amb3 }, { t: a.desc, c: C.gray }); }
    for (const p of m.perks) lines.push({ t: PERKS[p]?.name ?? p, c: C.vio3 }, { t: PERKS[p]?.desc ?? '', c: C.gray });
    const flat: { t: string; c: number }[] = [];
    for (const l of lines) for (const w of wrapLines(l.t, W - 20)) flat.push({ t: w, c: l.c });
    const vis = Math.floor((H - 14 - y) / 9);
    this.scroll = Math.min(this.scroll, Math.max(0, flat.length - vis));
    flat.slice(this.scroll, this.scroll + vis).forEach((l, k) => drawText(l.t, 10, y + k * 9, l.c));
    if (m.pendingPerks || m.pendingAttr) { box(W - 86, H - 20, 78, 12, C.ink, C.amb2); drawText('Z: level up', W - 82, H - 18, C.amb3); }
  }
}

import { wrap as wrapLines } from '../engine/font';

class RenameScreen implements Screen {
  done = false;
  e: NameEntry;
  constructor(title: string, init: string, public set: (s: string) => void) { this.e = new NameEntry(title, init); }
  update(dt: number) { this.e.update(dt); if (this.e.done) { this.set(this.e.done); this.done = true; } }
  render() { this.e.render(); }
}

// ---------- gear ----------

const SLOT_NAMES = ['Melee', 'Ranged', 'Armor', 'Chrome', 'Chrome'] as const;

/** Rows the gear pick list shows above the item description. */
const GEAR_ROWS = 6;

class GearScreen implements Screen {
  done = false;
  i = 0;
  slot = 0;
  picking = false;
  pick = 0;
  update() {
    const list = roster();
    const m = list[this.i % list.length];
    if (this.picking) {
      const opts = this.options(m);
      if (pressed('b')) { consume(); this.picking = false; return; }
      const rows = listRows(this.optionItems(opts), this.pick, 180, GEAR_ROWS);
      const r = listInput(this.pick, opts.length, 10, 96, 180, LINE_H, (k) => rows[k]?.i ?? -1);
      this.pick = r.sel;
      if (r.ok) { this.equip(m, opts[this.pick]?.id ?? null); this.picking = false; sfx('confirm'); }
      return;
    }
    if (back(this)) return;
    if (repeat('left')) { this.i = (this.i + list.length - 1) % list.length; sfx('cursor'); }
    if (repeat('right')) { this.i = (this.i + 1) % list.length; sfx('cursor'); }
    const r = listInput(this.slot, 5, 10, 30, 180);
    this.slot = r.sel;
    if (r.ok) {
      if (m.cls === 'witch' && this.slot >= 3) { toast("Witches can't carry chrome", C.mag3); sfx('error'); return; }
      if (m.cls === 'unit' && this.slot !== 0) { toast('Courtesy keeps its own shell', C.gray); sfx('error'); return; }
      this.picking = true; this.pick = 0;
    }
  }
  current(m: Member, s: number): string | undefined {
    if (s === 0) return m.gear.melee;
    if (s === 1) return m.gear.ranged;
    if (s === 2) return m.gear.armor;
    return m.gear.chrome[s - 3];
  }
  optionItems(opts: { id: string | null; it: ItemDef | null }[]): ListItem[] {
    return opts.map((o) => ({ text: o.it ? `${o.it.name}${(G.items[o.id!] ?? 0) > 1 ? ' x' + G.items[o.id!] : ''}` : '(nothing)' }));
  }
  options(m: Member): { id: string | null; it: ItemDef | null }[] {
    const kind = (['melee', 'ranged', 'armor', 'chrome', 'chrome'] as const)[this.slot];
    const out: { id: string | null; it: ItemDef | null }[] = [{ id: null, it: null }];
    for (const [id, n] of Object.entries(G.items)) { const it = ITEM.get(id); if (it && it.kind === kind && n > 0) out.push({ id, it }); }
    return out;
  }
  equip(m: Member, id: string | null) {
    const cur = this.current(m, this.slot);
    if (cur) G.items[cur] = (G.items[cur] ?? 0) + 1;
    if (id) { G.items[id]--; if (G.items[id] <= 0) delete G.items[id]; }
    const v = id ?? undefined;
    if (this.slot === 0) m.gear.melee = v;
    else if (this.slot === 1) m.gear.ranged = v;
    else if (this.slot === 2) m.gear.armor = v;
    else { const c = [...m.gear.chrome]; c[this.slot - 3] = v as string; m.gear.chrome = c.filter(Boolean); }
    m.hp = Math.min(m.hp, maxHp(m));
  }
  render() {
    const list = roster();
    const m = list[this.i % list.length];
    panel(4, 4, W - 8, H - 8);
    blitUI(lookFor(m.id).frames.down[0], 10, 8);
    drawText(nameOf(m), 24, 9, C.white);
    drawText('< >', W - 14 - textWidth('< >'), 9, C.slate);
    hline(6, 21, W - 12, C.night);
    const rows = SLOT_NAMES.map((n, s) => {
      const id = this.current(m, s);
      return { text: n, right: id ? ITEM.get(id)?.name ?? id : '-' };
    });
    drawList(rows, this.slot, 10, 30, 180);
    const id = this.picking ? this.options(m)[this.pick]?.id : this.current(m, this.slot);
    const it = id ? ITEM.get(id) : null;
    if (this.picking) {
      const items = this.optionItems(this.options(m));
      const rows = listRows(items, this.pick, 180, GEAR_ROWS);
      panel(6, 86, W - 12, 14 + rows.length * LINE_H);
      drawListRows(rows, items, this.pick, 10, 96, 180);
    }
    if (it) {
      const y = this.picking ? H - 43 : 80;
      const stats: string[] = [];
      if (it.dmg) stats.push(`Dmg ${it.dmg[0]}-${it.dmg[1]}${it.shots ? ' x' + it.shots : ''}`);
      if (it.range) stats.push(`Range ${it.range}`);
      if (it.acc) stats.push(`Acc ${it.acc > 0 ? '+' : ''}${it.acc}`);
      if (it.def) stats.push(`Def +${it.def}`);
      drawText(stats.join('  '), 10, y, C.cyan3);
      drawWrapped(it.desc, 10, y + 10, W - 20, C.gray, 3);
    }
  }
}

// ---------- items ----------

class ItemsScreen implements Screen {
  done = false;
  sel = G.menu.items ?? 0;
  target = -1;
  listItems(ids: string[]): ListItem[] {
    return ids.map((id) => ({ text: ITEM.get(id)!.name, right: G.items[id] > 1 ? `${G.items[id]}` : '' }));
  }
  ids(): string[] {
    const order = ['stim', 'grenade', 'vial', 'food', 'melee', 'ranged', 'armor', 'chrome', 'shard', 'key', 'junk'];
    return Object.keys(G.items).filter((id) => G.items[id] > 0 && ITEM.has(id)).sort((a, b) => order.indexOf(ITEM.get(a)!.kind) - order.indexOf(ITEM.get(b)!.kind) || a.localeCompare(b));
  }
  update() {
    const ids = this.ids();
    if (this.target >= 0) {
      const ms = partyMembers();
      if (pressed('b')) { consume(); this.target = -1; return; }
      const r = listInput(this.target, ms.length, 110, 40, 80);
      this.target = r.sel;
      if (r.ok) {
        const it = ITEM.get(ids[this.sel])!;
        const m = ms[this.target];
        if (m.hp >= maxHp(m)) { sfx('error'); return; }
        m.hp = Math.min(maxHp(m), m.hp + it.heal![0] + Math.floor(Math.random() * (it.heal![1] - it.heal![0] + 1)));
        G.items[it.id]--;
        if (G.items[it.id] <= 0) delete G.items[it.id];
        sfx('heal');
        this.target = -1;
      }
      return;
    }
    if (back(this)) return;
    const rows = listRows(this.listItems(ids), this.sel, 100, 16);
    const r = listInput(this.sel, ids.length, 10, 22, 100, LINE_H, (k) => rows[k]?.i ?? -1);
    this.sel = r.sel;
    G.menu.items = this.sel;
    if (r.ok && ids[this.sel]) {
      const it = ITEM.get(ids[this.sel])!;
      if (it.kind === 'stim') this.target = 0;
      else if (it.read) pushScreen(new ReadScreen(it.name, it.read));
    }
  }
  render() {
    panel(4, 4, W - 8, H - 8, 'Items');
    const ids = this.ids();
    const items = this.listItems(ids);
    drawListRows(listRows(items, this.sel, 100, 16), items, this.sel, 10, 22, 100);
    const it = ITEM.get(ids[this.sel]);
    if (it) {
      drawWrapped(it.desc, 116, 22, W - 126, C.pale, 10);
      drawText(`${it.price} gilt`, 116, H - 22, C.amb3);
    }
    if (!ids.length) drawText('Empty.', 10, 22, C.gray);
    if (this.target >= 0) {
      const ms = partyMembers();
      panel(104, 30, 92, 14 + ms.length * 9);
      drawList(ms.map((m) => ({ text: nameOf(m), right: `${m.hp}` })), this.target, 110, 40, 80);
    }
  }
}

export class ReadScreen implements Screen {
  done = false;
  scroll = 0;
  constructor(public title: string, public text: string) {}
  update() {
    if (pressed('a') || pressed('b')) { consume(); this.done = true; }
    if (repeat('down')) this.scroll++;
    if (repeat('up')) this.scroll = Math.max(0, this.scroll - 1);
  }
  render() {
    panel(10, 16, W - 20, H - 32, this.title);
    const lines = this.text.split('\n').flatMap((p) => wrapLines(p, W - 32));
    lines.slice(this.scroll, this.scroll + 16).forEach((l, i) => drawText(l, 16, 32 + i * 9, C.pale));
  }
}

// ---------- journal ----------

const JOURNAL_TABS = ['Active', 'Finished', 'Standing', 'Lore'];

class JournalScreen implements Screen {
  done = false;
  sel = G.menu.journal ?? 0;
  tab = 0;
  get showDone() { return this.tab === 1; }
  ids(): string[] {
    return Object.keys(G.quests).filter((id) => QUEST.has(id) && !!(G.quests[id].done || G.quests[id].failed) === this.showDone)
      .sort((a, b) => ['main', 'companion', 'side', 'gig'].indexOf(QUEST.get(a)!.kind) - ['main', 'companion', 'side', 'gig'].indexOf(QUEST.get(b)!.kind));
  }
  items(): ListItem[] {
    if (this.tab === 3) return (G.lore ?? []).map((id) => ({ text: LORE.get(id)?.title ?? id }));
    return this.ids().map((id) => {
      const d = QUEST.get(id)!;
      return { text: d.title, color: d.kind === 'main' ? C.amb3 : d.kind === 'companion' ? C.cyan3 : undefined };
    });
  }
  update() {
    if (back(this)) return;
    if (pressed('left') || pressed('right')) { this.tab = (this.tab + (pressed('left') ? 3 : 1)) % 4; this.sel = 0; sfx('cursor'); }
    if (this.tab === 2) return;
    const items = this.items();
    const rows = listRows(items, this.sel, 76, JOURNAL_ROWS);
    this.sel = listInput(this.sel, items.length, 10, 32, 76, LINE_H, (k) => rows[k]?.i ?? -1).sel;
    if (this.tab === 3) return;
    G.menu.journal = this.sel;
    const q = G.quests[this.ids()[this.sel]];
    if (q) q.seen = true;
  }
  render() {
    panel(4, 4, W - 8, H - 8);
    drawText(`< ${JOURNAL_TABS[this.tab]} >`, 10, 8, C.amb3);
    hline(6, 18, W - 12, C.night);
    if (this.tab === 2) { renderStanding(); return; }
    const items = this.items();
    if (this.tab === 3) { renderLore(this.sel, items); return; }
    const ids = this.ids();
    drawListRows(listRows(items, this.sel, 76, JOURNAL_ROWS), items, this.sel, 10, 32, 76);
    const id = ids[this.sel];
    if (!id) { drawText('Nothing here yet.', 10, 32, C.gray); return; }
    const d = QUEST.get(id)!, q = G.quests[id];
    const stageText = q.failed ? d.stages.fail : q.done ? d.stages.done : d.stages[String(q.stage)];
    let y = 22;
    y += drawWrapped(d.title, 96, y, W - 104, C.white, 3) + 2;
    const room = (top: number) => Math.floor((H - 5 - top) / LINE_H);
    y += drawWrapped(stageText ?? '', 96, y, W - 104, C.pale, room(y));
    // The newest notes that fit in full, oldest of them first.
    let left = room(y + 4);
    const notes: string[] = [];
    for (const n of q.log.slice(-3).reverse()) {
      const k = wrapLines(n, W - 104).length;
      if (k > left) break;
      notes.unshift(n);
      left -= k;
    }
    y += 4;
    for (const n of notes) y += drawWrapped(n, 96, y, W - 104, C.gray, 99);
  }
}

/** Rows the journal lists show before they scroll. */
const JOURNAL_ROWS = 17;

/** Faction standing as bars from -10 to 10, then each companion's approval tier. */
function renderStanding() {
  let y = 24;
  for (const f of FACTIONS) {
    const v = Math.max(-10, Math.min(10, rep(f.id)));
    if (!v && !G.flags['met_' + f.id]) continue;
    drawText(f.name, 10, y, f.color);
    const cx = 130;
    rect(cx - 41, y + 3, 83, 3, C.night);
    rect(cx, y + 2, 1, 5, C.gray);
    if (v > 0) rect(cx + 1, y + 3, v * 4, 3, f.color);
    if (v < 0) rect(cx + v * 4, y + 3, -v * 4, 3, C.red2);
    y += 11;
  }
  if (y === 24) { drawText('No one knows you yet.', 10, y, C.gray); y += 11; }
  y += 4;
  for (const m of Object.values(G.roster)) {
    if (m.id === 'hero' || m.dead) continue;
    drawText(m.name, 10, y, C.pale);
    drawText(tier(m.id), 100, y, C.cyan3);
    y += 10;
  }
}

/** Lore entries found, with the count of details looked at. */
function renderLore(sel: number, items: ListItem[]) {
  const found = G.lore ?? [];
  drawText(`${detailsFound()} of ${DETAILS.length} details`, W - 10 - textWidth(`${detailsFound()} of ${DETAILS.length} details`), 8, C.gray);
  if (!found.length) { drawText('Nothing here yet.', 10, 32, C.gray); return; }
  drawListRows(listRows(items, sel, 76, JOURNAL_ROWS), items, sel, 10, 32, 76);
  const l = LORE.get(found[sel]);
  if (!l) return;
  const y = 24 + drawWrapped(l.title, 96, 22, W - 104, C.white, 3);
  drawWrapped(l.text, 96, y, W - 104, C.pale, Math.floor((H - 12 - y) / LINE_H));
}

// ---------- travel ----------

const DISTRICT_NAME: Record<string, string> = { deeps: 'The Deeps', stair: 'The Stair', brim: 'The Brim', flats: 'The Flats' };

/** Rows the travel list shows before it scrolls. */
const TRAVEL_ROWS = 17;

/** Lists every place the party can travel to, grouped by district. */
export class TravelScreen implements Screen {
  done = false;
  sel = G.menu.travel ?? 0;
  list: Destination[];
  items(): ListItem[] { return this.list.map((d) => ({ text: d.name, right: DISTRICT_NAME[d.district] })); }
  constructor(private onPick: (d: Destination) => void, private onClose: () => void) {
    const order = ['deeps', 'flats', 'stair', 'brim'];
    this.list = destinations().sort((a, b) => order.indexOf(a.district) - order.indexOf(b.district));
  }
  update() {
    if (pressed('b') || !this.list.length && pressed('a')) { consume(); sfx('cancel'); this.done = true; this.onClose(); return; }
    const rows = listRows(this.items(), this.sel, W - 20, TRAVEL_ROWS);
    const r = listInput(this.sel, this.list.length, 10, 30, W - 20, LINE_H, (k) => rows[k]?.i ?? -1);
    this.sel = r.sel;
    G.menu.travel = this.sel;
    if (r.ok && this.list[this.sel]) { sfx('confirm'); this.onPick(this.list[this.sel]); this.done = true; this.onClose(); }
  }
  render() {
    panel(4, 4, W - 8, H - 8, 'Where?');
    if (!this.list.length) { drawText('Nowhere you know.', 10, 30, C.gray); return; }
    const items = this.items();
    drawListRows(listRows(items, this.sel, W - 20, TRAVEL_ROWS), items, this.sel, 10, 30, W - 20);
  }
}

// ---------- rest ----------

class RestScreen implements Screen {
  done = false;
  sel = 0;
  update() {
    if (back(this)) return;
    const r = listInput(this.sel, 2, 50, 90, 100);
    this.sel = r.sel;
    if (!r.ok) return;
    if (this.sel === 0) {
      if (G.shortRests <= 0) { toast('No short rests remaining', C.gray); sfx('error'); return; }
      MENU.hooks.rest('short');
      closeMenu();
    } else {
      MENU.hooks.rest('long');
      closeMenu();
    }
  }
  render() {
    panel(40, 70, 120, 66, 'Rest');
    drawList([{ text: 'Short rest', right: `${G.shortRests} left` }, { text: 'Long rest', right: 'camp' }], this.sel, 50, 90, 100);
    drawWrapped(this.sel === 0 ? 'Heal half of what you lost.' : 'Go to camp. Uses 40 supplies.', 46, 112, 108, C.gray, 2);
  }
}

// ---------- saves ----------

class SlotScreen implements Screen {
  done = false;
  sel = (SETTINGS.slot || 1) - 1;
  constructor(public loading: boolean) {}
  slots(): (number | 'auto')[] { return this.loading ? ['auto', ...Array.from({ length: SLOTS }, (_, i) => i + 1)] : Array.from({ length: SLOTS }, (_, i) => i + 1); }
  update() {
    if (back(this)) return;
    const s = this.slots();
    const r = listInput(this.sel, s.length, 10, 22, 180, 18);
    this.sel = r.sel;
    const slot = s[this.sel];
    if (pressed('edge') && typeof slot === 'number') { void importSave(slot).then((ok) => toast(ok ? 'Imported' : 'Import failed', ok ? C.grn3 : C.mag3)); return; }
    if (!r.ok) return;
    if (this.loading) {
      if (!slotInfo(slot)) { sfx('error'); return; }
      if (load(slot)) { closeMenu(); MENU.hooks.loaded(); sfx('save'); }
    } else {
      const write = () => { writeSlot(slot as number); toast('Saved', C.grn3); sfx('save'); this.done = true; };
      if (slotInfo(slot)) pushScreen(new ConfirmScreen('Overwrite this save?', write)); else write();
    }
  }
  render() {
    panel(4, 4, W - 8, H - 8, this.loading ? 'Load' : 'Save');
    const s = this.slots();
    s.forEach((slot, i) => {
      const y = 22 + i * 18;
      const inf = slotInfo(slot);
      if (i === this.sel) rect(8, y - 1, W - 16, 17, C.vio0);
      const label = slot === 'auto' ? 'Auto' : `File ${slot}`;
      drawText(label, 12, y, i === this.sel ? C.white : C.pale);
      if (inf) {
        drawText(`${inf.name}  Lv ${inf.level}`, 54, y, C.cyan3);
        drawText(fmtTime(inf.playtime), W - 14 - textWidth(fmtTime(inf.playtime)), y, C.gray);
        drawText(`Ch ${inf.chapter}  ${inf.district}`, 54, y + 8, C.gray, W - 70);
      } else drawText('empty', 54, y, C.slate);
    });
    if (!this.loading) drawText('F: import a file here', 12, H - 14, C.slate);
  }
}

// ---------- options ----------

class OptionsScreen implements Screen {
  done = false;
  sel = 0;
  rows(): { text: string; right: string }[] {
    return [
      { text: 'Music', right: `${SETTINGS.music}` },
      { text: 'Effects', right: `${SETTINGS.sfx}` },
      { text: 'Voice', right: `${SETTINGS.voice}` },
      { text: 'Text speed', right: ['slow', 'normal', 'fast', 'instant'][SETTINGS.textSpeed] },
      { text: 'Difficulty', right: { story: 'Story', runner: 'Runner', flatline: 'Flatline' }[G.difficulty] },
      { text: `Rename ${G.port.name}`, right: '' },
      { text: 'Export save', right: '' },
    ];
  }
  update() {
    if (back(this)) { saveSettings(); return; }
    const r = listInput(this.sel, this.rows().length, 10, 22, 180);
    this.sel = r.sel;
    const d = pressed('right') || r.ok ? 1 : pressed('left') ? -1 : 0;
    if (!d) return;
    const clamp = (v: number) => Math.max(0, Math.min(10, v));
    if (this.sel === 0) SETTINGS.music = clamp(SETTINGS.music + d);
    if (this.sel === 1) SETTINGS.sfx = clamp(SETTINGS.sfx + d);
    if (this.sel === 2) SETTINGS.voice = clamp(SETTINGS.voice + d);
    if (this.sel === 3) SETTINGS.textSpeed = (SETTINGS.textSpeed + d + 4) % 4;
    if (this.sel === 4) { const ds = ['story', 'runner', 'flatline'] as const; G.difficulty = ds[(ds.indexOf(G.difficulty) + d + 3) % 3]; }
    if (this.sel === 5 && r.ok) pushScreen(new RenameScreen('Name it', G.port.name, (s) => { G.port.name = s; }));
    if (this.sel === 6 && r.ok) exportSave();
    setVolumes(SETTINGS.music, SETTINGS.sfx, SETTINGS.voice);
    sfx('cursor');
  }
  render() {
    panel(4, 4, W - 8, H - 8, 'Options');
    drawList(this.rows(), this.sel, 10, 22, 180);
    const tip = ['', '', '', '', 'Story: weaker enemies. Flatline: stronger and smarter.', '', 'Saves a file you can import later.'][this.sel];
    if (tip) drawWrapped(tip, 10, H - 30, W - 20, C.gray, 2);
  }
}

// ---------- shops ----------

export class ShopScreen implements Screen {
  done = false;
  sel = 0;
  sell = false;
  constructor(public id: string, public onClose: () => void) {}
  stock(): string[] {
    const s = SHOPS.get(this.id);
    if (!s) return [];
    if (this.sell) return Object.keys(G.items).filter((i) => G.items[i] > 0 && ITEM.get(i) && ITEM.get(i)!.kind !== 'key' && ITEM.get(i)!.price > 0);
    return s.items.filter((i) => ITEM.has(i));
  }
  price(id: string): number {
    const it = ITEM.get(id)!;
    const rate = SHOPS.get(this.id)?.rate ?? 1;
    const charm = partyMembers().some((m) => m.perks.includes('charmer')) ? 0.85 : 1;
    return this.sell ? Math.max(1, Math.floor(it.price / 3)) : Math.round(it.price * rate * charm);
  }
  update() {
    if (pressed('b')) { consume(); this.done = true; this.onClose(); return; }
    if (pressed('left') || pressed('right')) { this.sell = !this.sell; this.sel = 0; sfx('cursor'); }
    const list = this.stock();
    const r = listInput(this.sel, list.length, 10, 32, 110);
    this.sel = r.sel;
    if (!r.ok || !list[this.sel]) return;
    const id = list[this.sel];
    const p = this.price(id);
    if (this.sell) { G.items[id]--; if (G.items[id] <= 0) delete G.items[id]; G.gilt += p; sfx('buy'); }
    else if (G.gilt >= p) { G.gilt -= p; G.items[id] = (G.items[id] ?? 0) + 1; sfx('buy'); }
    else sfx('error');
  }
  render() {
    const s = SHOPS.get(this.id);
    panel(4, 4, W - 8, H - 8);
    drawText(s?.name ?? 'Shop', 10, 8, C.amb3);
    drawText(`${G.gilt} gilt`, W - 12 - textWidth(`${G.gilt} gilt`), 8, C.amb3);
    drawText(this.sell ? '< Sell >' : '< Buy >', 10, 19, C.cyan3);
    hline(6, 28, W - 12, C.night);
    const list = this.stock();
    const vis = 15;
    const start = Math.max(0, Math.min(this.sel - 7, list.length - vis));
    drawList(list.slice(start, start + vis).map((id) => ({ text: ITEM.get(id)!.name, right: `${this.price(id)}`, dim: !this.sell && G.gilt < this.price(id) })), this.sel - start, 10, 32, 110);
    const it = ITEM.get(list[this.sel]);
    if (it) {
      drawWrapped(it.desc, 128, 32, W - 138, C.pale, 9);
      drawText(`${G.items[it.id] ?? 0}`, 128, H - 20, C.gray);
    }
  }
}

/** The party picker at camp: up to four members, the hero always among them. */
export class PartyPick implements Screen {
  done = false;
  sel = 0;
  update() {
    if (pressed('b')) { consume(); this.done = true; return; }
    const all = Object.values(G.roster).filter((m) => !m.dead && !G.flags[m.id + '_taken']);
    const r = listInput(this.sel, all.length, 10, 32, 180);
    this.sel = r.sel;
    if (!r.ok) return;
    const m = all[this.sel];
    if (m.id === 'hero') { sfx('error'); return; }
    if (G.party.includes(m.id)) G.party = G.party.filter((x) => x !== m.id);
    else if (G.party.length < 4) G.party.push(m.id);
    else { toast('Four at most', C.gray); sfx('error'); return; }
    sfx('confirm');
  }
  render() {
    panel(4, 4, W - 8, H - 8, 'Party Members');
    const all = Object.values(G.roster).filter((m) => !m.dead && !G.flags[m.id + '_taken']);
    drawList(all.map((m) => ({ text: nameOf(m), right: G.party.includes(m.id) ? 'IN' : '', color: G.party.includes(m.id) ? C.grn3 : undefined })), this.sel, 10, 32, 180);
    drawText(`${G.party.length}/4`, W - 30, 8, C.gray);
  }
}

export { box };
