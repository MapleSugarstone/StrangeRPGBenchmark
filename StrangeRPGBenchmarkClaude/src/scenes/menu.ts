import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { Menu, MenuItem, hueChips } from './ui';
import { MEMBERS, memberHues, xpToNext, skillsAt } from '../data/members';
import { ITEMS, ItemDef } from '../data/items';
import { SKILLS } from '../data/skills';
import { fullStats, save, addItem, MemberState } from '../game/state';
import { wrap, LINE_H } from '../core/font';
import { WHEEL, HUE_COLOR, HUE_NAME, Hue } from '../core/palette';
import { CHAPTERS } from '../maps';
import { ShopScene } from './shop';

type Mode = 'main' | 'items' | 'itemTarget' | 'skillWho' | 'skills' | 'skillTarget' | 'equipWho' | 'equipSlot' | 'equipPick' | 'party' | 'swap' | 'journal' | 'hues' | 'msg';

export class MenuScene implements Scene {
  overlay = true;
  mode: Mode = 'main';
  main: Menu;
  list = new Menu([], 9);
  who = new Menu([], 4);
  t = 0;
  msg = '';
  private back: Mode = 'main';
  private memberId = '';
  private slot: 'weapon' | 'charm' = 'weapon';
  private pickId = '';
  private swapFrom = -1;

  constructor(private g: Game) {
    const items: MenuItem[] = [
      { label: 'Items', id: 'items' },
      { label: 'Skills', id: 'skills' },
      { label: 'Equip', id: 'equip' },
      { label: 'Party', id: 'party' },
      { label: 'Journal', id: 'journal' },
      { label: 'Hues', id: 'hues', enabled: g.st.mech.includes('hues') },
    ];
    if (g.st.party.includes('vend') || g.st.reserve.includes('vend')) items.push({ label: 'Vend', id: 'vend' });
    items.push({ label: 'Save', id: 'save' }, { label: 'Close', id: 'close' });
    this.main = new Menu(items, items.length);
  }

  private get st() { return this.g.st; }
  private get all(): string[] { return [...this.st.party, ...this.st.reserve]; }

  private whoMenu() {
    this.who = new Menu(this.all.map(id => ({ label: MEMBERS[id].name, id })), Math.min(8, this.all.length));
  }

  private say(text: string, back: Mode) {
    this.msg = text;
    this.back = back;
    this.mode = 'msg';
  }

  update() {
    this.t++;
    const inp = this.g.input, au = this.g.audio;
    switch (this.mode) {
      case 'main': {
        const r = this.main.update(inp, au);
        if (r === 'back') { this.g.pop(this); return; }
        if (r !== 'ok') return;
        const id = this.main.cur!.id;
        if (id === 'close') this.g.pop(this);
        else if (id === 'items') this.openItems();
        else if (id === 'skills') { this.whoMenu(); this.mode = 'skillWho'; }
        else if (id === 'equip') { this.whoMenu(); this.mode = 'equipWho'; }
        else if (id === 'party') { this.whoMenu(); this.mode = 'party'; }
        else if (id === 'journal') this.mode = 'journal';
        else if (id === 'hues') this.mode = 'hues';
        else if (id === 'vend') this.g.push(new ShopScene(this.g, 'vend', () => {}));
        else if (id === 'save') this.say(save(this.st) ? 'Saved.' : 'Saving failed in this browser.', 'main');
        return;
      }
      case 'msg':
        if (inp.pressed('a') || inp.pressed('b')) { au.sfx('ok'); this.mode = this.back; }
        return;
      case 'journal':
      case 'hues':
        if (inp.pressed('a') || inp.pressed('b')) { au.sfx('back'); this.mode = 'main'; }
        return;
      case 'items': {
        const r = this.list.update(inp, au);
        if (r === 'back') { this.mode = 'main'; return; }
        if (r === 'ok') {
          const it = ITEMS[this.list.cur!.id!];
          if (!it.use || !it.field) { this.say(it.desc, 'items'); return; }
          this.pickId = it.id;
          this.whoMenu();
          this.mode = 'itemTarget';
        }
        return;
      }
      case 'itemTarget': {
        const r = this.who.update(inp, au);
        if (r === 'back') { this.mode = 'items'; return; }
        if (r === 'ok') {
          const m = this.st.members[this.who.cur!.id!];
          const res = this.useItem(ITEMS[this.pickId], m);
          this.openItems();
          this.say(res, 'items');
        }
        return;
      }
      case 'skillWho': {
        const r = this.who.update(inp, au);
        if (r === 'back') { this.mode = 'main'; return; }
        if (r === 'ok') { this.memberId = this.who.cur!.id!; this.openSkills(); }
        return;
      }
      case 'skills': {
        const r = this.list.update(inp, au);
        if (r === 'back') { this.whoMenu(); this.mode = 'skillWho'; return; }
        if (r === 'ok') {
          const sk = SKILLS[this.list.cur!.id!];
          if (!sk.field) { this.say(sk.desc, 'skills'); return; }
          this.pickId = sk.id;
          this.whoMenu();
          this.mode = 'skillTarget';
        }
        return;
      }
      case 'skillTarget': {
        const r = this.who.update(inp, au);
        if (r === 'back') { this.openSkills(); return; }
        if (r === 'ok') {
          const res = this.castField(this.pickId, this.st.members[this.memberId], this.st.members[this.who.cur!.id!]);
          this.openSkills();
          this.say(res, 'skills');
        }
        return;
      }
      case 'equipWho': {
        const r = this.who.update(inp, au);
        if (r === 'back') { this.mode = 'main'; return; }
        if (r === 'ok') {
          this.memberId = this.who.cur!.id!;
          this.list = new Menu([{ label: 'Weapon', id: 'weapon' }, { label: 'Charm', id: 'charm' }], 2);
          this.mode = 'equipSlot';
        }
        return;
      }
      case 'equipSlot': {
        const r = this.list.update(inp, au);
        if (r === 'back') { this.whoMenu(); this.mode = 'equipWho'; return; }
        if (r === 'ok') { this.slot = this.list.cur!.id as 'weapon' | 'charm'; this.openEquip(); }
        return;
      }
      case 'equipPick': {
        const r = this.list.update(inp, au);
        if (r === 'back') { this.list = new Menu([{ label: 'Weapon', id: 'weapon' }, { label: 'Charm', id: 'charm' }], 2); this.mode = 'equipSlot'; return; }
        if (r === 'ok') {
          const m = this.st.members[this.memberId];
          const id = this.list.cur!.id!;
          const old = m[this.slot];
          if (id === '') { if (old) addItem(this.st, old); m[this.slot] = ''; }
          else {
            addItem(this.st, id, -1);
            if (old) addItem(this.st, old);
            m[this.slot] = id;
          }
          const f = fullStats(m);
          m.hp = Math.min(m.hp, f.hp);
          m.ink = Math.min(m.ink, f.ink);
          this.openEquip();
        }
        return;
      }
      case 'party': {
        const r = this.who.update(inp, au);
        if (r === 'back') { this.mode = 'main'; return; }
        if (r === 'ok' && this.all.length > 1) { this.swapFrom = this.who.idx; this.mode = 'swap'; }
        return;
      }
      case 'swap': {
        const r = this.who.update(inp, au);
        if (r === 'back') { this.mode = 'party'; return; }
        if (r === 'ok') {
          const order = this.all;
          const a = this.swapFrom, b = this.who.idx;
          [order[a], order[b]] = [order[b], order[a]];
          const n = Math.min(4, this.st.party.length);
          this.st.party = order.slice(0, n);
          this.st.reserve = order.slice(n);
          if (!this.st.party.some(id => this.st.members[id].hp > 0)) {
            [order[a], order[b]] = [order[b], order[a]];
            this.st.party = order.slice(0, n);
            this.st.reserve = order.slice(n);
          }
          this.whoMenu();
          this.who.idx = b;
          this.mode = 'party';
        }
        return;
      }
    }
  }

  private openItems() {
    const entries = Object.entries(this.st.items).filter(([, n]) => n > 0);
    const order = (it: ItemDef) => (it.key ? 2 : it.equip ? 1 : 0);
    entries.sort((a, b) => order(ITEMS[a[0]]) - order(ITEMS[b[0]]));
    this.list = new Menu(entries.map(([id, n]) => {
      const it = ITEMS[id];
      return { label: it?.name ?? id, right: it?.key ? '' : `x${n}`, id, desc: it?.desc, color: it?.key ? 'y3' : it?.equip ? 'b3' : undefined };
    }), 9);
    this.mode = 'items';
  }

  private openSkills() {
    const m = this.st.members[this.memberId];
    const ids = [...skillsAt(m.id, m.lvl).filter(s => !(m.lost ?? []).includes(s)), ...(m.id === 'nil' ? m.echo : [])];
    this.list = new Menu(ids.map(id => ({ label: SKILLS[id].name, right: SKILLS[id].ink ? `${SKILLS[id].ink}` : '', id, desc: SKILLS[id].desc || 'Echoed from a foe.', color: SKILLS[id].field ? 'e3' : undefined })), 9);
    this.mode = 'skills';
  }

  private openEquip() {
    const m = this.st.members[this.memberId];
    const type = MEMBERS[m.id].weapon;
    const opts: MenuItem[] = [{ label: '(nothing)', id: '' }];
    for (const [id, n] of Object.entries(this.st.items)) {
      const e = ITEMS[id]?.equip;
      if (!e || n <= 0 || e.slot !== this.slot) continue;
      if (e.slot === 'weapon' && e.type !== type) continue;
      opts.push({ label: ITEMS[id].name, right: `x${n}`, id, desc: ITEMS[id].desc });
    }
    this.list = new Menu(opts, 7);
    this.mode = 'equipPick';
  }

  private useItem(it: ItemDef, m: MemberState): string {
    const u = it.use!;
    const f = fullStats(m);
    if (u.revive) {
      if (m.hp > 0) return `${MEMBERS[m.id].name} is fine.`;
      m.hp = Math.round(f.hp * u.revive);
    } else if (m.hp <= 0) return `${MEMBERS[m.id].name} needs reviving first.`;
    if (u.target === 'allies' && u.heal) {
      for (const id of this.all) { const mm = this.st.members[id]; if (mm.hp > 0) mm.hp = Math.min(fullStats(mm).hp, mm.hp + u.heal); }
    } else if (u.heal) m.hp = Math.min(f.hp, m.hp + u.heal);
    if (u.ink) m.ink = Math.min(f.ink, m.ink + u.ink);
    addItem(this.st, it.id, -1);
    this.g.audio.sfx('heal');
    return `Used ${it.name}.`;
  }

  private castField(id: string, caster: MemberState, target: MemberState): string {
    const sk = SKILLS[id];
    const cf = fullStats(caster);
    const tf = fullStats(target);
    if ((sk.ink ?? 0) > caster.ink) return 'Not enough ink.';
    if ((sk.tails ?? 0) > caster.tails) return 'No tails left.';
    if (sk.fx === 'revive') {
      if (target.hp > 0) return 'They are not down.';
      target.hp = Math.round(tf.hp * (sk.power ?? 0.5));
    } else {
      if (target.hp <= 0) return 'They need reviving first.';
      const amt = Math.round(cf.mnd * (sk.power ?? 1) + 2);
      if (sk.target === 'allies') for (const mid of this.all) { const mm = this.st.members[mid]; if (mm.hp > 0) mm.hp = Math.min(fullStats(mm).hp, mm.hp + amt); }
      else target.hp = Math.min(tf.hp, target.hp + amt);
    }
    caster.ink -= sk.ink ?? 0;
    caster.tails -= sk.tails ?? 0;
    this.g.audio.sfx('heal');
    return `${MEMBERS[caster.id].name} casts ${sk.name}.`;
  }

  draw(g: Gfx) {
    g.box(0, 0, 160, 160);
    this.drawParty(g);
    const mx = 108;
    this.main.draw(g, mx, 2, 50, this.t, this.mode === 'main');
    g.text(`${this.st.gold}g`, mx + 4, this.main.rows * LINE_H + 12, 'y2');
    const mins = Math.floor(this.st.frames / 3600);
    g.text(`${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`, mx + 4, this.main.rows * LINE_H + 20, 'g2');
    switch (this.mode) {
      case 'items':
      case 'skills':
      case 'equipSlot':
      case 'equipPick':
        this.list.draw(g, 2, 2, 104, this.t, true);
        this.drawDesc(g, this.list.cur?.desc ?? '');
        if (this.mode === 'equipPick' || this.mode === 'equipSlot') this.drawEquipInfo(g);
        break;
      case 'itemTarget':
      case 'skillTarget':
      case 'skillWho':
      case 'equipWho':
        this.who.draw(g, 2, 2, 60, this.t, true);
        break;
      case 'party':
      case 'swap':
        this.drawDetail(g, this.all[this.who.idx]);
        this.who.draw(g, 2, 2, 50, this.t, true);
        if (this.mode === 'swap') g.text('Swap with?', 4, 150, 'y3');
        else g.text('Z: change order', 4, 150, 'g2');
        break;
      case 'journal': this.drawJournal(g); break;
      case 'hues': this.drawHues(g); break;
      case 'msg':
        g.box(10, 64, 140, 20);
        g.textC(wrap(this.msg, 130)[0] ?? '', 80, 71, 'w');
        break;
    }
  }

  private drawParty(g: Gfx) {
    this.all.forEach((id, i) => {
      const m = this.st.members[id];
      const f = fullStats(m);
      const y = 4 + i * 19;
      if (y > 150) return;
      const reserve = i >= this.st.party.length;
      g.sprite(MEMBERS[id].sprite, 4, y + 2, { grey: m.hp <= 0 });
      g.text(MEMBERS[id].name, 16, y, reserve ? 'g2' : 'w');
      g.text(`Lv${m.lvl}`, 48, y, 'g2');
      g.text(`${m.hp}/${f.hp}`, 16, y + 7, m.hp <= 0 ? 'r3' : 'w');
      g.text(`^c${m.ink}^0/${f.ink}`, 60, y + 7, 'g2');
      g.bar(16, y + 14, 80, 1, m.hp / f.hp, 'e2');
      if (reserve) g.text('R', 96, y, 'g1');
    });
  }

  private drawDesc(g: Gfx, d: string) {
    const lines = wrap(d, 148).slice(0, 3);
    g.box(0, 132, 160, 28);
    lines.forEach((l, i) => g.text(l, 5, 136 + i * LINE_H));
  }

  private drawEquipInfo(g: Gfx) {
    const m = this.st.members[this.memberId];
    const f = fullStats(m);
    g.box(2, 84, 104, 46);
    g.text(`${MEMBERS[m.id].name}`, 6, 87, 'y3');
    g.text(`W: ${ITEMS[m.weapon]?.name ?? '-'}`, 6, 94);
    g.text(`C: ${ITEMS[m.charm]?.name ?? '-'}`, 6, 101);
    g.text(`STR ${f.str}  MND ${f.mnd}`, 6, 110, 'g3');
    g.text(`DEF ${f.def}  SPD ${f.spd}`, 6, 117, 'g3');
    if (f.hue !== 'N') g.text(`Attack hue: ${HUE_NAME[f.hue]}`, 6, 124, 'g3');
  }

  private drawDetail(g: Gfx, id: string) {
    if (!id) return;
    const m = this.st.members[id];
    const d = MEMBERS[id];
    const f = fullStats(m);
    g.box(2, 44, 104, 114);
    g.rect(6, 48, 20, 20, 'ink');
    g.sprite(d.sprite, 8, 50, { scale: 2 });
    g.text(d.name, 30, 49, 'y3');
    g.text(d.title, 30, 56, 'g2');
    hueChips(g, memberHues(id), 30, 64);
    const rows = [
      `Lv ${m.lvl}   next ${xpToNext(m.lvl) - m.xp}`,
      `HP ${m.hp}/${f.hp}  INK ${m.ink}/${f.ink}`,
      `STR ${f.str}  DEF ${f.def}`,
      `MND ${f.mnd}  SPD ${f.spd}`,
    ];
    if (id === 'nona') rows.push(`Tails ${m.tails}/9`);
    rows.forEach((r, i) => g.text(r, 6, 72 + i * LINE_H));
    wrap(d.bio, 96).forEach((l, i) => g.text(l, 6, 72 + (rows.length + 1) * LINE_H + i * LINE_H, 'g3'));
  }

  private drawJournal(g: Gfx) {
    const ch = CHAPTERS[this.st.chapter - 1];
    g.box(2, 2, 104, 156);
    if (!ch) return;
    g.text(`Chapter ${this.st.chapter}`, 6, 6, 'g2');
    g.text(ch.title, 6, 13, 'y3');
    g.text(ch.stage, 6, 20, 'g2');
    const lines = wrap(ch.objective(this.st), 96).slice(0, 6);
    lines.forEach((l, i) => g.text(l, 6, 32 + i * LINE_H));
    const log = this.st.log.filter(r => r.ch === this.st.chapter);
    if (log.length) {
      const won = log.filter(r => r.result === 'win').length;
      const closest = Math.min(...log.filter(r => r.result === 'win').map(r => r.minFrac), 1);
      const turns = log.reduce((s, r) => s + r.turns, 0) / log.length;
      g.text('Your record here', 6, 80, 'g2');
      g.text(`Won ${won} of ${log.length}`, 6, 87);
      g.text(`Closest call ${Math.round(closest * 100)}% HP`, 6, 94, closest < 0.15 ? 'r3' : 'w');
      g.text(`${turns.toFixed(1)} turns a fight`, 6, 101);
    }
    const mech = this.st.mech;
    if (mech.length) {
      g.text('Mechanics', 6, 112, 'g2');
      wrap(mech.map(m => MECH_NAME[m] ?? m).join(', '), 96).forEach((l, i) => g.text(l, 6, 119 + i * LINE_H, 'w'));
    }
  }

  private drawHues(g: Gfx) {
    g.box(2, 2, 104, 156);
    g.text('The hue wheel', 6, 6, 'y3');
    const cx = 54, cy = 52, r = 26;
    WHEEL.forEach((h, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      g.rect(x - 4, y - 4, 9, 9, HUE_COLOR[h]);
      g.text(HUE_NAME[h][0], x - 1, y - 2, 'k');
    });
    const tips = [
      'A hue hits its opposite for x1.5.',
      'It hits its own hue for x0.75.',
      'A foe\'s two colors are its hues.',
      'Grey has no hue.',
    ];
    tips.forEach((t, i) => wrap(t, 96).forEach((l, j) => g.text(l, 6, 88 + i * 16 + j * LINE_H)));
  }
}

const MECH_NAME: Record<string, string> = {
  hues: 'Hues', break: 'Break', tempo: 'Tempo', coin: 'Coin', link: 'Link', mirror: 'Mirror', echo: 'Echo', tricolor: 'Tricolor',
};

export function hueSwatch(g: Gfx, h: Hue, x: number, y: number) {
  g.rect(x, y, 3, 3, HUE_COLOR[h]);
}
