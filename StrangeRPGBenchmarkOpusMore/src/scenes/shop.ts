import { Gfx } from '../core/gfx';
import { wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { ITEMS } from '../data/items';
import { MEMBERS } from '../data/members';
import { addItem } from '../game/state';

export class ShopScene implements Scene {
  idx = 0;
  scroll = 0;
  msg = '';
  msgT = 0;
  constructor(private game: Game, private stock: string[], private name: string, private resolve: () => void, private prices?: Record<string, number>) {}

  price(id: string): number { return this.prices ? this.prices[id] ?? 1 : ITEMS[id]?.price ?? 0; }
  wallet(): number { const s = this.game.state!; return this.prices ? s.inv.loss ?? 0 : s.pleas; }
  pay(n: number) { const s = this.game.state!; if (this.prices) addItem(s, 'loss', -n); else s.pleas -= n; }

  update() {
    const inp = this.game.input;
    const s = this.game.state!;
    const n = this.stock.length + 1;
    if (this.msgT > 0) this.msgT--;
    if (inp.pressed('up')) { this.idx = (this.idx + n - 1) % n; this.game.audio.sfx('move'); }
    if (inp.pressed('down')) { this.idx = (this.idx + 1) % n; this.game.audio.sfx('move'); }
    if (this.idx < this.scroll) this.scroll = this.idx;
    if (this.idx >= this.scroll + 8) this.scroll = this.idx - 7;
    if (inp.pressed('back') || (inp.pressed('ok') && this.idx === this.stock.length)) {
      this.game.audio.sfx('back');
      this.game.pop(this);
      this.game.input.clearAll();
      this.resolve();
      return;
    }
    if (inp.pressed('ok')) {
      const it = ITEMS[this.stock[this.idx]];
      if (!it) return;
      if (this.wallet() < this.price(it.id)) { this.say(this.prices ? 'Not enough losses.' : 'Not enough pleas.'); this.game.audio.sfx('buzz'); return; }
      this.pay(this.price(it.id));
      this.game.audio.sfx('item');
      if (it.kind === 'weapon' && it.who && s.roster[it.who]) {
        const m = s.roster[it.who];
        const old = ITEMS[m.weapon];
        if (!old || (old.atk ?? 0) < (it.atk ?? 0)) {
          if (old) addItem(s, old.id);
          m.weapon = it.id;
          this.say(`${MEMBERS[it.who].name} equips the ${it.name}.`);
          return;
        }
      }
      addItem(s, it.id);
      this.say(`Bought ${it.name}.`);
    }
  }

  say(t: string) { this.msg = t; this.msgT = 90; }

  draw(g: Gfx) {
    const s = this.game.state!;
    g.box(4, 4, 184, 128, 'gold');
    g.text(this.name, 12, 9, 'gold');
    g.textR(this.prices ? `${this.wallet()} losses` : `${s.pleas} \u0007`, 180, 9, 'plea');
    const rows = [...this.stock, '__leave'];
    rows.slice(this.scroll, this.scroll + 8).forEach((id, i) => {
      const k = this.scroll + i;
      const y = 22 + i * 12;
      const it = ITEMS[id];
      const label = id === '__leave' ? 'Leave' : it?.name ?? id;
      const sel = k === this.idx;
      g.text(label, 20, y, sel ? 'gold' : 'paper');
      if (sel) g.cursor(11, y);
      if (it) {
        g.textR(String(this.price(id)), 180, y, this.wallet() >= this.price(id) ? 'plea' : 'slate');
        const own = s.inv[id] ?? 0;
        if (own) g.textR('x' + own, 150, y, 'grey');
        if (it.who) g.textR((MEMBERS[it.who]?.name ?? '').split(' ')[0], 130, y, s.roster[it.who] ? 'sky' : 'slate');
      }
    });
    g.box(4, 134, 184, 54, 'paper');
    const cur = ITEMS[rows[this.idx]];
    const text = this.msgT > 0 ? this.msg : cur ? cur.desc : 'Come back anytime. Mind the whispers.';
    wrap(text, 168).slice(0, 4).forEach((l, i) => g.text(l, 12, 140 + i * 11, this.msgT > 0 ? 'gold' : 'paper'));
  }
}
