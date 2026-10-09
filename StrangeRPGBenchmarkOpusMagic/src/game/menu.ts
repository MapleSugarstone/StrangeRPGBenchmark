// The pause menu and its screens: the rote, the Library, the Primers, the Grammar, the party, items.
import { costLabel, cost } from '../cant/analyze';
import { parse } from '../cant/parser';
import { sfx, toggleMute, isMuted } from '../engine/audio';
import { CW, text, textCenter, wrap } from '../engine/font';
import { pressed, setTextMode, tapped } from '../engine/input';
import { H, W, frame, rect } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { BATTLE_ART } from '../engine/sprites16';
import { Scene, app } from './app';
import { ALLIES } from './enemies';
import { Editor, colorize, nameKey, pageNameError } from './editor';
import { GRAMMAR, GNode } from './grammar';
import { PRIMER } from './primers';
import { PAGE_COLORS, allyMax, blankStats, buyNode, hands, lineLimit, maxHp, pageLimit, maxInk, pageSlots, regen, saveGame, ticks, xpToNext } from './state';
import { C, Menu, panel } from './ui';
import { markCount } from './dialogue';
import { SEALS, freeSeals, sealOf } from './shop';
import { openStetBook } from './stet';
import { CatchLog } from './reeling';

export class PauseMenu implements Scene {
  menu = new Menu([], 10);
  constructor() { this.build(); }

  build() {
    const s = app.s;
    this.menu.set([
      { label: 'Rote' },
      { label: 'Library', disabled: !s.library.length },
      { label: 'Primers', disabled: !s.primers.length },
      { label: 'Grammar', disabled: !s.flags.grammar_open, right: s.marks ? `${s.marks}` : '', rightColor: C.again },
      { label: 'Party' },
      { label: 'Items' },
      { label: 'Stet', disabled: !s.stet.deck.length && !Object.keys(s.stet.cards).length },
      { label: 'Catches', disabled: !Object.keys(s.fish).length },
      { label: 'Save' },
      { label: isMuted() ? 'Sound: off' : 'Sound: on' },
    ]);
  }

  resume() { this.build(); }

  update() {
    const r = this.menu.update();
    if (r === -2 || tapped('back')) { app.pop(); return; }
    switch (this.menu.items[r]?.label) {
      case 'Rote': app.push(new RoteList()); break;
      case 'Library': app.push(new LibraryScreen()); break;
      case 'Primers': app.push(new PrimerShelf()); break;
      case 'Grammar': app.push(new GrammarScreen()); break;
      case 'Party': app.push(new PartyScreen()); break;
      case 'Items': app.push(new ItemsScreen()); break;
      case 'Stet': openStetBook(); break;
      case 'Catches': app.push(new CatchLog()); break;
      case 'Save': { const ok = saveGame(app.s); sfx.get(); this.menu.items[r].label = ok ? 'Saved.' : 'Could not save.'; break; }
      case 'Sound: off': case 'Sound: on': toggleMute(); this.build(); break;
    }
  }

  draw() {
    panel(118, 6, 70, this.menu.items.length * 10 + 4, C.hi);
    this.menu.draw(122, 10, 62);
    const s = app.s;
    panel(4, 6, 110, 40, C.faint);
    drawSprite('wait16', 8, 10, { marks: markCount() });
    text(`Wait  lv ${s.level}`, 28, 10, C.text);
    text(`hp ${s.hp}/${maxHp(s)}`, 28, 18, C.text);
    text(`ink ${s.ink}/${maxInk(s)}`, 28, 26, C.hi);
    text(`ch ${s.chapter}  marks ${s.marks}`, 28, 34, C.dim);
  }
}

// ---------------------------------------------------------------- the rote

export class RoteList implements Scene {
  opaque = true;
  menu = new Menu([], 10);
  /** The name being typed for the selected page, or null. */
  renaming: string | null = null;
  private fresh = false;
  private why = '';
  private thenEdit = false;
  private t = 0;
  constructor() { this.build(); }

  private startRename(thenEdit: boolean) {
    const p = app.s.pages[this.menu.i];
    if (!p || p.fixed) { sfx.error(); return; }
    this.renaming = p.name;
    this.fresh = true;
    this.why = '';
    this.thenEdit = thenEdit;
    sfx.ok();
    setTextMode((e) => this.renameKey(e));
  }

  private renameKey(e: KeyboardEvent): boolean {
    const r = nameKey(e, this.renaming!, this.fresh);
    this.fresh = false;
    if (r !== 'enter') {
      if (r === null) { this.renaming = null; setTextMode(null); sfx.back(); if (this.thenEdit) app.push(new Editor(this.menu.i, 'normal')); }
      else { this.renaming = r; this.why = ''; }
      return true;
    }
    const why = pageNameError(this.renaming!, this.menu.i);
    if (why) { this.why = why; sfx.error(); return true; }
    app.s.pages[this.menu.i].name = this.renaming!;
    this.renaming = null;
    setTextMode(null);
    sfx.ok();
    this.build();
    if (this.thenEdit) app.push(new Editor(this.menu.i, 'normal'));
    return true;
  }

  build() {
    const s = app.s;
    const slots = pageSlots(s);
    const items = s.pages.map((p) => {
      const prog = parse(p.src);
      const broken = prog.diags.some((d) => d.sev === 'error') || prog.codeLines > pageLimit(s, p);
      const seal = s.pageSeals[p.id];
      return { label: p.name, color: PAGE_COLORS[p.color], right: broken ? 'broken' : p.fixed ? '' : `${seal ? `${seal[0]} ` : ''}${prog.codeLines}/${pageLimit(s, p)}`, rightColor: broken ? C.bad : seal ? SEALS[seal].color : C.dim };
    });
    if (s.pages.length - 1 < slots) items.push({ label: '(new page)', color: C.dim, right: '', rightColor: C.dim });
    this.menu.set(items);
  }

  resume() { this.build(); }

  /** Moves the page's seal to the next kind Wait has a free one of, then to none. */
  private cycleSeal() {
    const s = app.s;
    const p = s.pages[this.menu.i];
    if (!p || p.fixed) return;
    const kinds = Object.keys(SEALS);
    const cur = s.pageSeals[p.id];
    const start = cur ? kinds.indexOf(cur) + 1 : 0;
    delete s.pageSeals[p.id];
    for (let k = start; k < kinds.length; k++) {
      if (freeSeals(s, kinds[k]) > 0) { s.pageSeals[p.id] = kinds[k]; break; }
    }
    if (!cur && !s.pageSeals[p.id]) { sfx.error(); return; }
    sfx.ok();
    this.build();
  }

  update() {
    this.t++;
    if (this.renaming !== null) return;
    if (tapped('cast')) { this.cycleSeal(); return; }
    if (tapped('page')) { this.startRename(false); return; }
    const r = this.menu.update();
    if (r === -2) { app.pop(); return; }
    if (r < 0) return;
    const s = app.s;
    if (r >= s.pages.length) {
      const used = new Set(s.pages.map((p) => p.name));
      let n = 2;
      while (used.has(`page${n}`)) n++;
      s.pages.push({ id: `p${Date.now()}`, name: `page${n}`, src: '', color: s.pages.length % PAGE_COLORS.length, stats: blankStats() });
      this.build();
      this.startRename(true);
      return;
    }
    app.push(new Editor(r, 'normal'));
  }

  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    const s = app.s;
    text('Your rote', 6, 4, C.hi);
    text(`${s.pages.length - 1}/${pageSlots(s)} pages, ${lineLimit(s)} lines each`, 6, 13, C.dim);
    if (this.renaming !== null) {
      const it = this.menu.items[this.menu.i];
      it.label = `${this.renaming}${this.t % 40 < 20 ? '_' : ''}`;
      it.color = C.hi;
    }
    this.menu.draw(8, 26, 80);
    const p = s.pages[this.menu.i];
    panel(94, 24, 94, 120, C.faint);
    if (p) {
      const prog = parse(p.src);
      const lines = p.src.split('\n');
      lines.slice(0, 13).forEach((l, i) => {
        const cols = colorize(l);
        for (let k = 0; k < Math.min(17, l.length); k++) text(l[k], 97 + k * CW, 28 + i * 8, cols[k]);
      });
      if (!prog.diags.some((d) => d.sev === 'error')) text(costLabel(cost(prog.stmts)), 6, 150, C.hi);
      const st = p.stats ?? blankStats();
      if (!p.fixed) text(`cast ${st.casts}  harm ${st.harm}  heal ${st.heal}  best ${st.best}`, 6, 160, C.dim);
      const seal = sealOf(s, p);
      if (seal) text(`${seal.id} seal: ${seal.doc}`.slice(0, 37), 6, 170, seal.color);
    } else text('A blank page.', 97, 28, C.dim);
    const owned = Object.values(s.seals).some((n) => n > 0);
    if (this.renaming !== null) text(this.why ? this.why.slice(0, 37) : 'Type a name. Enter to keep it.', 6, 182, this.why ? C.bad : C.hi);
    else text(owned ? 'Z writes. R renames. C sets a seal.' : 'Z writes. R renames. Esc goes back.', 6, 182, C.faint);
  }
}

// ---------------------------------------------------------------- the Library

export class LibraryScreen implements Scene {
  opaque = true;
  menu = new Menu([], 9);
  copying = false;
  slotMenu = new Menu([], 6);
  constructor() { this.menu.set(app.s.library.map((l) => ({ label: l.name, right: l.from, rightColor: C.dim }))); }

  update() {
    if (this.copying) {
      const r = this.slotMenu.update();
      if (r === -2) { this.copying = false; return; }
      if (r >= 0) {
        const s = app.s;
        const entry = s.library[this.menu.i];
        const idx = r + 1;
        if (idx >= s.pages.length) s.pages.push({ id: `p${Date.now()}`, name: uniqueName(entry.name), src: entry.src, color: s.pages.length % PAGE_COLORS.length, stats: blankStats() });
        else { s.pages[idx].src = entry.src; }
        sfx.get();
        this.copying = false;
      }
      return;
    }
    const r = this.menu.update();
    if (r === -2) { app.pop(); return; }
    if (r >= 0) {
      const s = app.s;
      const items = s.pages.slice(1).map((p) => ({ label: `over ${p.name}` }));
      if (s.pages.length - 1 < pageSlots(s)) items.push({ label: 'into a new page' });
      this.slotMenu = new Menu(items, 6);
      this.copying = true;
    }
  }

  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    text('Library', 6, 4, C.kw);
    text('pages from things you have beaten', 6, 13, C.dim);
    this.menu.draw(8, 26, 176);
    const e = app.s.library[this.menu.i];
    panel(4, 104, 184, 74, C.faint);
    if (e) e.src.split('\n').slice(0, 8).forEach((l, i) => {
      const cols = colorize(l);
      for (let k = 0; k < Math.min(35, l.length); k++) text(l[k], 8 + k * CW, 108 + i * 8, cols[k]);
    });
    text(this.copying ? 'copy it where?' : 'Z copies a page into your rote.', 6, 182, C.faint);
    if (this.copying) { panel(70, 30, 116, 60, C.hi); this.slotMenu.draw(74, 34, 108); }
  }
}

function uniqueName(base: string): string {
  const used = new Set(app.s.pages.map((p) => p.name));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

// ---------------------------------------------------------------- Primers

export class PrimerShelf implements Scene {
  opaque = true;
  menu: Menu;
  constructor() { this.menu = new Menu(app.s.primers.map((id) => ({ label: PRIMER[id]?.name ?? id })), 10); }
  update() {
    const r = this.menu.update();
    if (r === -2) { app.pop(); return; }
    if (r >= 0) app.push(new PrimerReader(app.s.primers[r]));
  }
  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    text('Primers', 6, 4, C.hi);
    this.menu.draw(8, 18, 176);
  }
}

export class PrimerReader implements Scene {
  opaque = true;
  page = 0;
  constructor(public id: string) {}
  update() {
    const p = PRIMER[this.id];
    if (pressed('right') || pressed('ok')) { if (this.page < p.pages.length - 1) { this.page++; sfx.move(); } else if (tapped('ok')) { app.pop(); sfx.back(); } }
    if (pressed('left')) { if (this.page > 0) { this.page--; sfx.move(); } }
    if (tapped('back')) { app.pop(); sfx.back(); }
  }
  draw() {
    const p = PRIMER[this.id];
    const pg = p.pages[this.page];
    rect(0, 0, W, H, 0x100e12);
    rect(6, 6, 180, 180, this.id === 'red_primer' ? 0x2a0e10 : 0x1c1820);
    text(p.name, 12, 10, this.id === 'red_primer' ? 0xff7a7a : C.dim);
    text(pg.title, 12, 22, C.hi);
    pg.body.forEach((l, i) => {
      if (l.startsWith('  ') && l[2] !== ' ') {
        const code = l.slice(2);
        const cols = colorize(code);
        for (let k = 0; k < code.length; k++) text(code[k], 16 + k * CW, 36 + i * 9, cols[k]);
      } else text(l, 12, 36 + i * 9, l.startsWith('(') || /^[go]:/.test(l) || l.startsWith('   ') ? C.dim : C.text);
    });
    textCenter(`${this.page + 1} / ${p.pages.length}`, 96, 176, C.faint);
  }
}

// ---------------------------------------------------------------- the Grammar

export class GrammarScreen implements Scene {
  opaque = true;
  tab = 0;
  menu = new Menu([], 12);
  msg = '';
  get tabs(): GNode['branch'][] { return app.s.chapter >= 7 ? ['Words', 'Forms', 'Room', 'Margin'] : ['Words', 'Forms', 'Room']; }
  constructor() { this.build(); }

  nodes(): GNode[] { return GRAMMAR.filter((n) => n.branch === this.tabs[this.tab]); }

  build() {
    const s = app.s;
    this.menu.set(this.nodes().map((n) => {
      const have = s.grammar.includes(n.id);
      const locked = n.chapter > s.chapter || (n.parent && !n.parent.every((p) => s.grammar.includes(p)));
      const depth = n.parent ? '  ' : '';
      return {
        label: `${depth}${n.label}`,
        color: have ? C.good : locked ? C.faint : C.text,
        right: have ? 'have' : n.chapter > s.chapter ? `ch${n.chapter}` : `${n.cost}`,
        rightColor: have ? C.good : s.marks >= n.cost && !locked ? C.again : C.dim,
      };
    }));
  }

  private switchTab(d: number) {
    this.tab = (this.tab + d + this.tabs.length) % this.tabs.length;
    this.menu.i = 0;
    this.build();
    sfx.move();
  }

  /** Moves the cursor to the nearest node in a direction, by screen position. */
  private step(dx: number, dy: number): boolean {
    const nodes = this.nodes();
    const pos = this.layout();
    const cur = pos.get(nodes[this.menu.i]?.id ?? '');
    if (!cur) return false;
    let best = -1;
    let bestScore = Infinity;
    nodes.forEach((n, i) => {
      const p = pos.get(n.id)!;
      const ddx = p.x - cur.x, ddy = p.y - cur.y;
      if (dx && Math.sign(ddx) !== dx) return;
      if (dy && Math.sign(ddy) !== dy) return;
      const score = dx ? Math.abs(ddx) + Math.abs(ddy) * 3 : Math.abs(ddy) + Math.abs(ddx) * 3;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best < 0) return false;
    this.menu.i = best;
    sfx.move();
    return true;
  }

  update() {
    if (tapped('tab')) this.switchTab(1);
    if (pressed('left') && !this.step(-1, 0)) this.switchTab(-1);
    if (pressed('right') && !this.step(1, 0)) this.switchTab(1);
    if (pressed('up')) this.step(0, -1);
    if (pressed('down')) this.step(0, 1);
    if (tapped('back')) { sfx.back(); app.pop(); return; }
    if (tapped('ok')) {
      const n = this.nodes()[this.menu.i];
      if (!n) return;
      const err = buyNode(app.s, n.id);
      if (err) { this.msg = err; sfx.error(); } else { this.msg = `${n.label}: yours.`; sfx.get(); }
      this.build();
    }
  }

  /** Places nodes in rows by following each chain from its root. A first child stays on its parent's row. */
  layout(): Map<string, { x: number; y: number }> {
    const nodes = this.nodes();
    const ids = new Set(nodes.map((n) => n.id));
    const kids = new Map<string, GNode[]>();
    for (const n of nodes) for (const p of n.parent ?? []) if (ids.has(p)) { if (!kids.has(p)) kids.set(p, []); kids.get(p)!.push(n); }
    const pos = new Map<string, { x: number; y: number }>();
    let row = 0;
    const place = (n: GNode, depth: number, r: number) => {
      if (pos.has(n.id)) return;
      pos.set(n.id, { x: 6 + depth * 47, y: 32 + r * 14 });
      (kids.get(n.id) ?? []).forEach((k, i) => {
        const kr = i === 0 ? r : ++row;
        place(k, depth + 1, kr);
      });
    };
    for (const n of nodes) {
      const roots = (n.parent ?? []).filter((p) => ids.has(p));
      if (roots.length) continue;
      place(n, 0, row);
      row++;
    }
    return pos;
  }

  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    const s = app.s;
    text('The Grammar', 6, 4, C.again);
    text(`marks ${s.marks}`, 140, 4, C.again);
    this.tabs.forEach((t, i) => text(t, 8 + i * 44, 16, i === this.tab ? C.hi : C.faint));
    rect(6, 25, 180, 1, C.faint);
    const nodes = this.nodes();
    const pos = this.layout();
    for (const n of nodes) {
      const a = pos.get(n.id)!;
      for (const p of n.parent ?? []) {
        const b = pos.get(p);
        if (!b) continue;
        const owned = s.grammar.includes(p);
        const col = owned ? 0x4a6a3a : C.faint;
        const x0 = b.x + 44, y0 = b.y + 4, x1 = a.x, y1 = a.y + 4;
        const mid = x0 + 1;
        rect(x0, y0, mid - x0 + 1, 1, col);
        rect(mid, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, col);
        rect(mid, y1, x1 - mid, 1, col);
      }
    }
    nodes.forEach((n, i) => {
      const a = pos.get(n.id)!;
      const have = s.grammar.includes(n.id);
      const locked = n.chapter > s.chapter || !!(n.parent && !n.parent.every((p) => s.grammar.includes(p)));
      const afford = !have && !locked && s.marks >= n.cost;
      const sel = i === this.menu.i;
      rect(a.x, a.y, 44, 10, have ? 0x1e3a1e : sel ? C.sel : 0x15121c);
      frame(a.x, a.y, 44, 10, sel ? C.hi : have ? C.good : afford ? C.again : C.faint);
      const label = n.label.replace(/\(L\)/, '').replace('third hand', 'hand +1').replace('steps +20', 'steps+20').slice(0, 8);
      text(label, a.x + 2, a.y + 2, have ? C.good : locked ? C.faint : C.text);
    });
    const n = nodes[this.menu.i];
    panel(4, 140, 184, 40, C.faint);
    if (n) {
      const have = s.grammar.includes(n.id);
      const status = have ? 'yours' : n.chapter > s.chapter ? `opens in chapter ${n.chapter}` : `${n.cost} mark${n.cost > 1 ? 's' : ''}`;
      text(`${n.label}: ${status}`, 8, 143, have ? C.good : C.hi);
      wrap(n.doc, 35).slice(0, 2).forEach((l, i) => text(l, 8, 152 + i * 8, C.text));
    }
    if (this.msg) text(this.msg.slice(0, 36), 8, 170, C.again);
    text('arrows move. Z buys. Tab: branch', 6, 184, C.faint);
  }
}

// ---------------------------------------------------------------- party and items

export class PartyScreen implements Scene {
  opaque = true;
  i = 0;
  update() {
    const n = app.s.party.length + 1;
    if (pressed('down') || pressed('right')) { this.i = (this.i + 1) % n; sfx.move(); }
    if (pressed('up') || pressed('left')) { this.i = (this.i + n - 1) % n; sfx.move(); }
    if (tapped('back') || tapped('ok')) { app.pop(); sfx.back(); }
  }
  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    const s = app.s;
    if (this.i === 0) {
      drawSprite('wait16', 12, 10, { marks: markCount() });
      text('Wait', 40, 8, C.text);
      text(`level ${s.level}  xp ${s.xp}/${xpToNext(s.level)}`, 40, 18, C.dim);
      const rows = [
        `hp ${s.hp}/${maxHp(s)}`, `ink ${s.ink}/${maxInk(s)}, ${regen(s)} back a turn`, `${pageSlots(s)} pages of ${lineLimit(s)} lines`,
        `${hands(s)} hand${hands(s) > 1 ? 's' : ''}, ${ticks(s)} steps a turn`, `marks ${s.marks}`,
      ];
      rows.forEach((r, i) => text(r, 8, 40 + i * 9, C.text));
      text('words', 8, 92, C.hi);
      const words = [...s.words];
      for (const k of s.party) { const w = ALLIES[k].lends; if (w && s.flags[`lent_${w}`]) words.push(`${w}*`); }
      wrap(words.join(' '), 35).slice(0, 8).forEach((l, i) => text(l, 8, 102 + i * 8, C.text));
      text('* lent', 8, 172, C.dim);
    } else {
      const k = s.party[this.i - 1];
      const a = ALLIES[k];
      drawSprite(BATTLE_ART[a.sprite] ?? a.sprite, 12, 10);
      text(a.name, 40, 8, C.text);
      text(`hp ${s.allyHp[k] ?? allyMax(s, k)}/${allyMax(s, k)}  armor ${a.armor}`, 40, 18, C.dim);
      if (a.lends) text(`lends: ${a.lends}`, 40, 26, s.flags[`lent_${a.lends}`] ? C.hi : C.faint);
      text('rote', 8, 42, C.kw);
      a.rote.split('\n').forEach((l, i) => {
        const cols = colorize(l);
        for (let c = 0; c < Math.min(35, l.length); c++) text(l[c], 8 + c * CW, 52 + i * 8, cols[c]);
      });
      text('Companions run their own rotes.', 8, 150, C.dim);
      text('Their words go quiet if they fall.', 8, 158, C.dim);
    }
    text('arrows: next. Esc goes back.', 6, 182, C.faint);
  }
}

const ITEM_TEXT: Record<string, [string, string]> = {
  salve: ['salve', 'Heals 12. Use it in a fight, or here.'],
  inkpot: ['inkpot', '6 ink. Use it in a fight, or here.'],
  bell: ['bell', 'Gets one who fell back up, at half health.'],
  second_hand: ['the Second Hand', 'Two of your pages can run at once.'],
};

export class ItemsScreen implements Scene {
  opaque = true;
  menu = new Menu([], 8);
  constructor() { this.build(); }
  keys(): string[] { return Object.keys(ITEM_TEXT).filter((k) => (app.s.items[k] ?? 0) > 0); }
  build() { this.menu.set(this.keys().map((k) => ({ label: ITEM_TEXT[k][0], right: k === 'second_hand' ? '' : `x${app.s.items[k]}` }))); }
  update() {
    const r = this.menu.update();
    if (r === -2) { app.pop(); return; }
    if (r < 0) return;
    const k = this.keys()[r];
    const s = app.s;
    if (k === 'salve') { s.hp = Math.min(maxHp(s), s.hp + 12); s.items.salve--; sfx.heal(); }
    else if (k === 'inkpot') { s.ink = Math.min(maxInk(s), s.ink + 6); s.items.inkpot--; sfx.heal(); }
    else sfx.error();
    this.build();
  }
  draw() {
    rect(0, 0, W, H, 0x0b0a10);
    text('Items', 6, 4, C.hi);
    this.menu.draw(8, 18, 176);
    const k = this.keys()[this.menu.i];
    if (k) wrap(ITEM_TEXT[k][1], 35).forEach((l, i) => text(l, 8, 120 + i * 8, C.text));
    text(`hp ${app.s.hp}/${maxHp(app.s)}  ink ${app.s.ink}/${maxInk(app.s)}`, 8, 160, C.dim);
  }
}
