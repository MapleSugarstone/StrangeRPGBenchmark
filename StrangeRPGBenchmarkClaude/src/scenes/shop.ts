import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { Menu } from './ui';
import { ITEMS } from '../data/items';
import { SHOPS } from '../data/shops';
import { addItem, fullStats } from '../game/state';
import { MEMBERS } from '../data/members';
import { wrap, LINE_H } from '../core/font';

export class ShopScene implements Scene {
  mode: 'top' | 'buy' | 'sell' = 'top';
  top = new Menu([{ label: 'Buy', id: 'buy' }, { label: 'Sell', id: 'sell' }, { label: 'Leave', id: 'leave' }], 3);
  list = new Menu([], 10);
  t = 0;
  note = '';
  noteT = 0;
  markup: number;
  stock: string[];
  name: string;

  constructor(private g: Game, private id: string, private done: () => void) {
    if (id === 'vend') {
      const ch = g.st.chapter;
      const best = Object.values(SHOPS).filter(s => s.chapter <= ch && s.chapter > 0).sort((a, b) => b.chapter - a.chapter)[0];
      this.stock = (best?.items ?? ['tallow']).filter(i => ITEMS[i]?.use);
      this.markup = 1.25;
      this.name = 'VEND';
    } else {
      const s = SHOPS[id];
      this.stock = s.items;
      this.markup = 1;
      this.name = s.name;
    }
  }

  private price(id: string): number {
    return Math.round(ITEMS[id].price * this.markup);
  }

  private openBuy() {
    this.list = new Menu(this.stock.map(id => ({
      label: ITEMS[id].name, right: `${this.price(id)}`, id, desc: ITEMS[id].desc, enabled: this.g.st.gold >= this.price(id),
    })), 10);
    this.mode = 'buy';
  }

  private openSell() {
    const st = this.g.st;
    const items = Object.entries(st.items).filter(([id, n]) => n > 0 && !ITEMS[id]?.key && ITEMS[id]?.price > 0);
    this.list = new Menu(items.map(([id, n]) => ({ label: ITEMS[id].name, right: `${Math.floor(ITEMS[id].price / 2)}`, id, desc: `You have ${n}.` })), 10);
    this.mode = 'sell';
  }

  update() {
    this.t++;
    if (this.noteT > 0) this.noteT--;
    const inp = this.g.input, au = this.g.audio, st = this.g.st;
    if (this.mode === 'top') {
      const r = this.top.update(inp, au);
      if (r === 'back' || (r === 'ok' && this.top.cur!.id === 'leave')) { this.g.pop(this); this.done(); return; }
      if (r === 'ok') { if (this.top.cur!.id === 'buy') this.openBuy(); else this.openSell(); }
      return;
    }
    const r = this.list.update(inp, au);
    if (r === 'back') { this.mode = 'top'; return; }
    if (r !== 'ok') return;
    const id = this.list.cur!.id!;
    if (this.mode === 'buy') {
      const p = this.price(id);
      if (st.gold < p) return;
      st.gold -= p;
      addItem(st, id);
      au.sfx('coin');
      this.note = `Bought ${ITEMS[id].name}.`;
      this.noteT = 60;
      const idx = this.list.idx;
      this.openBuy();
      this.list.idx = idx;
    } else {
      st.gold += Math.floor(ITEMS[id].price / 2);
      addItem(st, id, -1);
      au.sfx('coin');
      const idx = this.list.idx;
      this.openSell();
      this.list.idx = Math.min(idx, Math.max(0, this.list.items.length - 1));
    }
  }

  draw(g: Gfx) {
    const st = this.g.st;
    g.clear('k');
    g.box(0, 0, 160, 12);
    g.text(this.name, 5, 3, 'y3');
    g.textR(`${st.gold}g`, 155, 3, 'y2');
    if (this.mode === 'top') {
      this.top.draw(g, 50, 40, 60, this.t);
      return;
    }
    this.list.draw(g, 0, 14, 160, this.t);
    const cur = this.list.cur;
    g.box(0, 94, 160, 66);
    if (!cur) { g.text('Nothing here.', 5, 98, 'g2'); return; }
    const it = ITEMS[cur.id!];
    wrap(cur.desc ?? '', 150).slice(0, 2).forEach((l, i) => g.text(l, 5, 98 + i * LINE_H));
    g.text(`Owned: ${st.items[it.id] ?? 0}`, 5, 114, 'g2');
    if (it.equip) {
      const all = [...st.party, ...st.reserve];
      let i = 0;
      for (const mid of all) {
        const m = st.members[mid];
        const def = MEMBERS[mid];
        if (it.equip.slot === 'weapon' && it.equip.type !== def.weapon) continue;
        const cur2 = fullStats(m);
        const trial = fullStats({ ...m, [it.equip.slot]: it.id });
        const stat = (trial.str - cur2.str) + (trial.mnd - cur2.mnd) + (trial.def - cur2.def) + (trial.spd - cur2.spd);
        const col = stat > 0 ? 'e3' : stat < 0 ? 'r3' : 'g2';
        g.text(`${def.name} ${stat > 0 ? '+' : ''}${stat}`, 5 + (i >= 4 ? 78 : 0), 122 + (i % 4) * LINE_H, col);
        i++;
      }
    }
    if (this.noteT > 0) g.textR(this.note, 155, 114, 'e3');
  }
}
