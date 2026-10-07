import { activeMembers, autoEquip, buyGear, buyItem, buyRune, equipRune, learnedSkills, member, memberStats, nextSkill, type Member } from '../core/party';
import { CHAR, XP_NEED } from '../data/characters';
import { GEAR, ITEMS, RUNES, shopStock } from '../data/items';
import { skill } from '../data/skills';
import { ELEM_ABBR, type Stats } from '../data/types';
import { wrap } from '../gfx/font';
import { C, type Screen } from '../gfx/screen';
import { partySprite, icon } from '../gfx/sprites';
import { chapter } from '../story/chapters';
import type { Game, Scene } from './game';
import { COL, hpColor, ListMenu, panel, type ListItem } from './ui';
import type { WorldScene } from './world';

function header(s: Screen, title: string, g: Game) {
  s.rect(0, 0, 128, 9, 0xff10102a);
  s.text(3, 2, title, COL.hi);
  s.textR(125, 2, `${g.state.gold}G`, C.gold);
  s.line(0, 9, 127, 9, COL.dim);
}

// ------------------------------------------------------------------------------ main menu
export class MainMenu implements Scene {
  menu: ListMenu;
  constructor(private world: WorldScene) {
    this.menu = new ListMenu(['ITEMS', 'EQUIP', 'PARTY', 'STATUS', 'JOURNAL', 'SAVE', 'SOUND', 'CLOSE'].map((label) => ({ label })), 8);
  }
  update(g: Game) {
    const r = this.menu.update(g);
    if (r === 'cancel') { g.pop(); return; }
    if (r !== 'ok') return;
    switch (this.menu.cursor) {
      case 0: g.push(new ItemsScene()); break;
      case 1: g.push(new EquipScene()); break;
      case 2: g.push(new PartyScene()); break;
      case 3: g.push(new StatusScene()); break;
      case 4: g.push(new JournalScene()); break;
      case 5: { g.state.map = { x: this.world.x, y: this.world.y, dir: this.world.dy }; const ok = g.save(); void g.overlay<void>((r2) => ({ update: (gg) => { if (gg.input.was('a') || gg.input.was('b')) r2(); }, draw: (_g, s) => { panel(s, 20, 50, 88, 18); s.textC(64, 57, ok ? 'GAME SAVED' : 'SAVE FAILED', C.white); } })); break; }
      case 6: g.audio.muted = !g.audio.muted; break;
      case 7: g.pop(); break;
    }
  }
  draw(g: Game, s: Screen) {
    s.clear();
    header(s, 'MENU', g);
    this.menu.draw(s, 4, 14, 50);
    const ch = chapter(g.state.chapter);
    s.text(60, 14, `CHAPTER ${ch.id}`, COL.hi);
    wrap(ch.title.toUpperCase(), 16).forEach((l, i) => s.text(60, 21 + i * 6, l, C.white));
    s.text(60, 56, g.audio.muted ? 'SOUND OFF' : 'SOUND ON', C.gray);
    activeMembers(g.state).forEach((m, i) => {
      const y = 79 + i * 12;
      const st = memberStats(m);
      s.sprite(partySprite(m.id), 3, y);
      s.text(14, y, `${CHAR[m.id].name.toUpperCase()} LV${m.lvl}`, C.white);
      s.textR(125, y, `${m.hp}/${st.hp}`, hpColor(m.hp / st.hp));
      s.bar(14, y + 7, 62, m.hp / st.hp, hpColor(m.hp / st.hp));
      s.textR(125, y + 6, `MP ${m.mp}/${st.mp}`, COL.mp);
    });
  }
}

// ------------------------------------------------------------------------------ member picker
class MemberPick {
  menu: ListMenu;
  constructor(public list: Member[], visible = 5) {
    this.menu = new ListMenu(list.map((m) => ({ label: `${CHAR[m.id].name.toUpperCase()}`, right: `LV${m.lvl}` })), visible);
  }
  get current(): Member { return this.list[this.menu.cursor]; }
}

// ------------------------------------------------------------------------------ items
export class ItemsScene implements Scene {
  menu = new ListMenu([], 6);
  keys: string[] = [];
  pick: MemberPick | null = null;
  constructor() { this.rebuild(); }
  rebuild(g?: Game) {
    const s = g?.state;
    void s;
  }
  private refresh(g: Game) {
    this.keys = Object.keys(g.state.inv).filter((k) => g.state.inv[k] > 0 && ITEMS[k]);
    this.menu.setItems(this.keys.map((k) => ({ label: ITEMS[k].name.toUpperCase(), right: 'x' + g.state.inv[k], disabled: ITEMS[k].tgt === 'foes' })));
  }
  update(g: Game) {
    this.refresh(g);
    if (this.pick) {
      const r = this.pick.menu.update(g);
      if (r === 'cancel') this.pick = null;
      else if (r === 'ok') {
        const id = this.keys[this.menu.cursor];
        const it = ITEMS[id];
        const m = this.pick.current;
        const st = memberStats(m);
        let used = false;
        for (const f of it.fx) {
          if (f.k === 'healFlat' && m.hp < st.hp) { m.hp = Math.min(st.hp, m.hp + f.n); used = true; }
          if (f.k === 'mpFlat' && m.mp < st.mp) { m.mp = Math.min(st.mp, m.mp + f.n); used = true; }
        }
        if (used) { g.state.inv[id]--; g.audio.sfx('heal'); }
        else g.audio.sfx('cancel');
      }
      return;
    }
    const r = this.menu.update(g);
    if (r === 'cancel') g.pop();
    else if (r === 'ok') this.pick = new MemberPick(g.state.roster);
  }
  draw(g: Game, s: Screen) {
    s.clear();
    header(s, 'ITEMS', g);
    this.menu.draw(s, 3, 13, 122);
    const k = this.keys[this.menu.cursor];
    if (k) s.text(3, 50, ITEMS[k].desc.toUpperCase(), C.gray);
    else s.text(3, 13, 'NO ITEMS', COL.dim);
    if (this.pick) {
      panel(s, 50, 56, 76, 70);
      this.pick.list.forEach((m, i) => {
        const st = memberStats(m);
        const y = 60 + i * 11;
        s.text(56, y, (i === this.pick!.menu.cursor ? '>' : ' ') + CHAR[m.id].name.toUpperCase().slice(0, 7), i === this.pick!.menu.cursor ? COL.hi : C.white);
        s.text(56, y + 5, `${m.hp}/${st.hp}`, hpColor(m.hp / st.hp));
        s.textR(122, y + 5, `${m.mp}`, COL.mp);
      });
    }
  }
}

// ------------------------------------------------------------------------------ equip
type Slot = 'weapon' | 'armor' | 'charm' | 'runeW' | 'runeA';
const SLOT_NAME: Record<Slot, string> = { weapon: 'WEAPON', armor: 'ARMOR', charm: 'CHARM', runeW: 'WEAPON RUNE', runeA: 'ARMOR RUNE' };

export class EquipScene implements Scene {
  stage: 'member' | 'slot' | 'item' = 'member';
  pick: MemberPick | null = null;
  slots: Slot[] = [];
  slotMenu = new ListMenu([], 5);
  itemMenu = new ListMenu([], 5);
  itemKeys: (string | undefined)[] = [];
  update(g: Game) {
    this.pick = this.pick ?? new MemberPick(g.state.roster, 6);
    const m = this.pick.current;
    if (this.stage === 'member') {
      const r = this.pick.menu.update(g);
      if (r === 'cancel') g.pop();
      else if (r === 'ok') {
        this.slots = ['weapon', 'armor', 'charm', ...(g.state.chapter >= 9 ? (['runeW', 'runeA'] as Slot[]) : [])];
        this.slotMenu = new ListMenu(this.slots.map((sl) => ({ label: SLOT_NAME[sl], right: this.nameOf(m, sl) })), 5);
        this.stage = 'slot';
      }
    } else if (this.stage === 'slot') {
      this.slotMenu.setItems(this.slots.map((sl) => ({ label: SLOT_NAME[sl], right: this.nameOf(m, sl) })));
      const r = this.slotMenu.update(g);
      if (r === 'cancel') this.stage = 'member';
      else if (r === 'ok') {
        const sl = this.slots[this.slotMenu.cursor];
        const items: ListItem[] = [];
        this.itemKeys = [];
        if (sl === 'runeW' || sl === 'runeA') {
          items.push({ label: '(NONE)' }); this.itemKeys.push(undefined);
          for (const id of Object.keys(g.state.runes)) if (g.state.runes[id] > 0) { items.push({ label: RUNES[id].name.toUpperCase().replace('RUNE OF ', ''), right: 'x' + g.state.runes[id] }); this.itemKeys.push(id); }
        } else {
          for (const id of g.state.owned) if (GEAR[id].slot === sl) { items.push({ label: GEAR[id].name.toUpperCase(), right: 'T' + GEAR[id].tier }); this.itemKeys.push(id); }
        }
        this.itemMenu = new ListMenu(items, 4);
        this.stage = 'item';
      }
    } else {
      const r = this.itemMenu.update(g);
      if (r === 'cancel') this.stage = 'slot';
      else if (r === 'ok') {
        const sl = this.slots[this.slotMenu.cursor];
        const id = this.itemKeys[this.itemMenu.cursor];
        if (sl === 'runeW' || sl === 'runeA') equipRune(g.state, m, sl, id);
        else m[sl] = id;
        this.stage = 'slot';
      }
    }
  }
  private nameOf(m: Member, sl: Slot): string {
    const id = m[sl];
    if (!id) return '-';
    return (sl === 'runeW' || sl === 'runeA' ? RUNES[id].name.replace('Rune of ', '') : GEAR[id].name).toUpperCase().slice(0, 12);
  }
  draw(g: Game, s: Screen) {
    s.clear();
    header(s, 'EQUIP', g);
    this.pick = this.pick ?? new MemberPick(g.state.roster, 6);
    const m = this.pick.current;
    if (this.stage === 'member') this.pick.menu.draw(s, 3, 13, 122);
    else {
      s.text(3, 13, CHAR[m.id].name.toUpperCase(), COL.hi);
      const st = memberStats(m);
      s.text(3, 20, `HP ${st.hp} MP ${st.mp}`, C.white);
      s.text(3, 26, `ATK ${Math.round(st.atk)} MAG ${Math.round(st.mag)}`, C.white);
      s.text(3, 32, `DEF ${Math.round(st.def)} RES ${Math.round(st.res)} SPD ${Math.round(st.spd)}`, C.white);
      this.slotMenu.draw(s, 3, 42, 122, this.stage === 'slot');
      if (this.stage === 'item') {
        panel(s, 4, 78, 120, 48);
        this.itemMenu.draw(s, 8, 83, 112);
        const id = this.itemKeys[this.itemMenu.cursor];
        const sl = this.slots[this.slotMenu.cursor];
        if (id) s.text(8, 114, ((sl === 'runeW' || sl === 'runeA' ? RUNES[id].desc : GEAR[id].desc) ?? '').toUpperCase().slice(0, 28), C.gray);
      }
    }
    void autoEquip;
  }
}

// ------------------------------------------------------------------------------ party
export class PartyScene implements Scene {
  menu = new ListMenu([], 6);
  update(g: Game) {
    const st = g.state;
    this.menu.setItems(st.roster.map((m) => ({
      label: CHAR[m.id].name.toUpperCase().slice(0, 9),
      right: `${st.active.includes(m.id) ? 'ACTIVE' : 'RESERVE'} ${m.row === 0 ? 'FRONT' : 'BACK'}`,
      color: st.active.includes(m.id) ? C.white : COL.dim,
    })));
    const r = this.menu.update(g);
    if (r === 'cancel') { g.pop(); return; }
    const m = st.roster[this.menu.cursor];
    if (g.input.was('left') || g.input.was('right')) { m.row = m.row === 0 ? 1 : 0; g.audio.sfx('cursor'); }
    if (r === 'ok') {
      if (st.active.includes(m.id)) { if (st.active.length > 1) st.active = st.active.filter((x) => x !== m.id); }
      else if (st.active.length < 4) st.active.push(m.id);
    }
  }
  draw(g: Game, s: Screen) {
    s.clear();
    header(s, 'PARTY', g);
    this.menu.draw(s, 3, 13, 122);
    s.text(3, 100, 'Z TOGGLE ACTIVE (MAX 4)', C.gray);
    s.text(3, 107, g.state.chapter >= 5 ? 'LEFT/RIGHT: FRONT OR BACK ROW' : 'ROWS UNLOCK IN CHAPTER 5', C.gray);
    const m = g.state.roster[this.menu.cursor];
    if (m) s.text(3, 116, CHAR[m.id].blurb.toUpperCase().slice(0, 30), COL.dim);
  }
}

// ------------------------------------------------------------------------------ status
export class StatusScene implements Scene {
  pick: MemberPick | null = null;
  view = false;
  update(g: Game) {
    this.pick = this.pick ?? new MemberPick(g.state.roster, 6);
    if (!this.view) {
      const r = this.pick.menu.update(g);
      if (r === 'cancel') g.pop();
      else if (r === 'ok') this.view = true;
    } else if (g.input.was('b') || g.input.was('a')) this.view = false;
    else if (g.input.was('left') || g.input.was('right')) {
      const n = this.pick.list.length;
      this.pick.menu.cursor = (this.pick.menu.cursor + (g.input.was('left') ? n - 1 : 1)) % n;
    }
  }
  draw(g: Game, s: Screen) {
    s.clear();
    header(s, 'STATUS', g);
    this.pick = this.pick ?? new MemberPick(g.state.roster, 6);
    if (!this.view) { this.pick.menu.draw(s, 3, 13, 122); return; }
    const m = this.pick.current;
    const d = CHAR[m.id];
    const st = memberStats(m);
    s.sprite(partySprite(m.id), 4, 12);
    s.text(15, 12, `${d.name.toUpperCase()} LV${m.lvl}`, COL.hi);
    s.text(15, 18, d.cls.toUpperCase(), C.gray);
    s.text(4, 26, `HP ${m.hp}/${st.hp}  MP ${m.mp}/${st.mp}`, C.white);
    s.text(4, 32, `ATK ${Math.round(st.atk)} MAG ${Math.round(st.mag)} SPD ${Math.round(st.spd)}`, C.white);
    s.text(4, 38, `DEF ${Math.round(st.def)} RES ${Math.round(st.res)}`, C.white);
    s.text(4, 44, `WEAK ${ELEM_ABBR[d.weak]}  RESIST ${ELEM_ABBR[d.resist]}`, C.orange);
    const nx = nextSkill(m);
    s.text(4, 50, `XP ${m.xp}/${XP_NEED(m.lvl)}`, C.gray);
    s.text(4, 57, 'SKILLS', COL.hi);
    learnedSkills(m).forEach((id, i) => s.text(4 + (i % 2) * 62, 64 + Math.floor(i / 2) * 6, skill(id).name.toUpperCase().slice(0, 14), C.white));
    if (nx) s.text(4, 88, `NEXT: ${skill(nx.id).name.toUpperCase().slice(0, 14)} AT LV${nx.lvl}`, COL.dim);
    wrap(d.blurb.toUpperCase(), 30).forEach((l, i) => s.text(4, 98 + i * 6, l, C.gray));
    s.text(4, 120, `LIMIT: ${skill(d.limit).name.toUpperCase()}`, C.gold);
  }
}

// ------------------------------------------------------------------------------ journal
export class JournalScene implements Scene {
  menu = new ListMenu([], 8);
  update(g: Game) {
    const ch = chapter(g.state.chapter);
    this.menu.setItems(ch.beats.map((b, i) => ({
      label: `PART ${i + 1}`,
      right: i < g.state.beat ? 'DONE' : i === g.state.beat ? 'NEXT' : '',
      color: i < g.state.beat ? COL.good : i === g.state.beat ? COL.hi : COL.dim,
    })));
    if (this.menu.update(g) === 'cancel') g.pop();
  }
  draw(g: Game, s: Screen) {
    s.clear();
    header(s, `CHAPTER ${g.state.chapter}`, g);
    const ch = chapter(g.state.chapter);
    s.text(3, 12, ch.title.toUpperCase().slice(0, 30), C.white);
    s.text(3, 18, ch.place.toUpperCase().slice(0, 30), C.gray);
    this.menu.draw(s, 3, 28, 122);
    const i = this.menu.cursor;
    const known = i <= g.state.beat;
    const text = known ? ch.beats[i].note : 'NOT YET SEEN.';
    panel(s, 2, 88, 124, 38);
    wrap(text.toUpperCase(), 29).slice(0, 5).forEach((l, k) => s.text(5, 92 + k * 6, l, C.white));
  }
}

// ------------------------------------------------------------------------------ shop
export class ShopScene implements Scene {
  tab = 0;
  menu = new ListMenu([], 6);
  keys: string[] = [];
  tabs: string[] = [];
  msg = '';
  update(g: Game) {
    const ch = g.state.chapter;
    this.tabs = ch >= 9 ? ['SUPPLIES', 'GEAR', 'RUNES'] : ['SUPPLIES', 'GEAR'];
    const stock = shopStock(ch);
    const list = this.tab === 0 ? stock.items : this.tab === 1 ? stock.gear : stock.runes;
    this.keys = list;
    this.menu.setItems(list.map((id) => {
      if (this.tab === 0) return { label: ITEMS[id].name.toUpperCase(), right: `${ITEMS[id].price}G`, disabled: g.state.gold < ITEMS[id].price };
      if (this.tab === 1) return { label: GEAR[id].name.toUpperCase(), right: g.state.owned.includes(id) ? 'OWNED' : `${GEAR[id].price}G`, disabled: g.state.owned.includes(id) || g.state.gold < GEAR[id].price };
      return { label: RUNES[id].name.toUpperCase().replace('RUNE OF ', ''), right: `${RUNES[id].price}G`, disabled: g.state.gold < RUNES[id].price };
    }));
    if (g.input.was('left')) { this.tab = (this.tab + this.tabs.length - 1) % this.tabs.length; this.menu.cursor = 0; this.menu.scroll = 0; }
    if (g.input.was('right')) { this.tab = (this.tab + 1) % this.tabs.length; this.menu.cursor = 0; this.menu.scroll = 0; }
    const r = this.menu.update(g);
    if (r === 'cancel') { g.pop(); return; }
    if (r === 'ok') {
      const id = this.keys[this.menu.cursor];
      const ok = this.tab === 0 ? buyItem(g.state, id) : this.tab === 1 ? buyGear(g.state, id) : buyRune(g.state, id);
      if (ok) { g.audio.sfx('chest'); if (this.tab === 1) autoEquip(g.state); this.msg = 'BOUGHT!'; } else this.msg = this.tab === 0 && (g.state.inv[id] ?? 0) >= 9 ? 'CARRYING 9 ALREADY.' : 'NOT ENOUGH GOLD.';
    }
  }
  draw(g: Game, s: Screen) {
    s.clear();
    header(s, 'SHOP', g);
    this.tabs.forEach((t, i) => s.text(3 + i * 40, 12, t, i === this.tab ? COL.hi : COL.dim));
    this.menu.draw(s, 3, 22, 122);
    const id = this.keys[this.menu.cursor];
    const desc = this.tab === 0 ? ITEMS[id]?.desc : this.tab === 1 ? GEAR[id]?.desc : RUNES[id]?.desc;
    panel(s, 2, 94, 124, 32);
    s.text(5, 98, (desc ?? '').toUpperCase().slice(0, 29), C.white);
    s.text(5, 106, this.msg, COL.hi);
    s.text(5, 116, 'LEFT/RIGHT TABS  Z BUY  X EXIT', C.gray);
    s.sprite(icon('coin'), 116, 98);
  }
}
