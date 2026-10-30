// The splash, the title screen, and making a new runner: difficulty, name, trade, and look.
import { rect, blitUI, shadeRect, upx, hline } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { pressed, repeat, consume, MOUSE } from '../engine/input';
import { W, H } from '../engine/screen';
import { panel, listInput, drawList, drawWrapped, NameEntry } from './widgets';
import { CLASSES, SKILL_NAME } from '../rules/data';
import { BACKGROUNDS } from '../content/replay';
import { personSheet, SKINS, HAIRS, COATS, STYLES, ACCENTS, HATS, TOP_NAMES, SHIRTS, HERO_LOOK, type Look } from '../art/people';
import { latest, slotInfo, load, SLOTS, fmtTime } from '../game/save';
import type { Difficulty } from '../game/state';
import { sfx } from '../audio/sfx';
import { loadWorld, WORLD, updateBailers } from '../world/world';
import { renderWorld } from '../world/render';
import { titleMap } from '../content/maps/title';

export interface NewGame { kind: 'new'; name: string; cls: 'blade' | 'diver' | 'rigger' | 'mouth'; look: Look; difficulty: Difficulty; bg?: string }
export type TitleResult = NewGame | { kind: 'load' } | { kind: 'sluice'; opponent: string };

/** A fake studio card that fades in and out. */
export class Splash {
  t = 0;
  done = false;
  update(dt: number) {
    this.t += dt;
    if (this.t > 3.2 || (this.t > 0.4 && (pressed('a') || pressed('b') || MOUSE.left))) { this.done = true; consume(); }
  }
  render() {
    rect(0, 0, W, H, C.black);
    const a = Math.min(1, this.t / 0.6) * Math.min(1, Math.max(0, (3.2 - this.t) / 0.6));
    if (a <= 0) return;
    // A drop over three wave lines, the studio mark.
    const cx = W / 2, cy = 84;
    const drop = ['....1....', '....1....', '...111...', '..11111..', '.1111111.', '.1111111.', '.1111111.', '..11111..', '...111...'];
    drop.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '1') upx(cx - 4 + x, cy - 14 + y, C.cyan3); });
    for (let k = 0; k < 3; k++) for (let x = -14; x <= 14; x++) if ((x + k * 2 + 40) % 6 < 3) upx(cx + x, cy + k * 3, k === 0 ? C.cyan2 : k === 1 ? C.cyan1 : C.cyan0);
    const name = 'TIDEMARK SOFTWORKS';
    drawText(name, Math.round(cx - textWidth(name) / 2), cy + 16, C.pale);
    shadeRect(0, 0, W, H, 1 - a);
  }
}

const BIG: Record<string, string[]> = {
  F: ['1111111', '1111111', '11.....', '11.....', '111111.', '111111.', '11.....', '11.....', '11.....', '11.....'],
  A: ['..111..', '.11111.', '11...11', '11...11', '1111111', '1111111', '11...11', '11...11', '11...11', '11...11'],
  T: ['1111111', '1111111', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..'],
  H: ['11...11', '11...11', '11...11', '11...11', '1111111', '1111111', '11...11', '11...11', '11...11', '11...11'],
  O: ['.11111.', '1111111', '11...11', '11...11', '11...11', '11...11', '11...11', '11...11', '1111111', '.11111.'],
  M: ['11...11', '111.111', '1111111', '11.1.11', '11...11', '11...11', '11...11', '11...11', '11...11', '11...11'],
};

/** The title: the Wall at night, the name, and the menu. */
export class Title {
  t = 0;
  sel = 0;
  result: TitleResult | null = null;
  stage: 'menu' | 'load' | 'diff' | 'name' | 'class' | 'bg' | 'look' = 'menu';
  bgSel = 0;
  diff = 1;
  name: NameEntry | null = null;
  cls = 0;
  look: Look = { ...HERO_LOOK };
  lookRow = 0;
  /** Skin, hair color, hair, hat, coat, cut, shirt, trim. */
  lookIdx = ([[SKINS, HERO_LOOK.skin], [HAIRS, HERO_LOOK.hair], [STYLES, HERO_LOOK.hairStyle], [HATS, 'beanie'], [COATS, HERO_LOOK.coat], [TOP_NAMES, HERO_LOOK.top], [SHIRTS, HERO_LOOK.shirt], [ACCENTS, HERO_LOOK.accent]] as [readonly unknown[], unknown][]).map(([l, v]) => Math.max(0, l.indexOf(v)));
  loadSel = 0;
  heroName = 'Vos';
  update(dt: number) {
    this.t += dt;
    if (this.stage === 'menu') {
      const items = this.items();
      const r = listInput(this.sel, items.length, 76, 128, 60);
      this.sel = r.sel;
      if (r.ok) {
        sfx('confirm');
        const pick = items[this.sel];
        if (pick === 'Continue') { const s = latest(); if (s !== null && load(s)) this.result = { kind: 'load' }; }
        if (pick === 'New game') this.stage = 'diff';
        if (pick === 'Load') this.stage = 'load';
        if (pick === 'Sluice') { const ops = ['moss', 'gus', 'lotte', 'bram', 'deacon', 'tilly', 'clerk']; this.result = { kind: 'sluice', opponent: ops[Math.floor(Math.random() * ops.length)] }; }
      }
      return;
    }
    if (pressed('b') && this.stage !== 'name') { consume(); sfx('cancel'); this.stage = this.stage === 'look' ? 'bg' : this.stage === 'bg' ? 'class' : this.stage === 'class' ? 'diff' : 'menu'; return; }
    if (this.stage === 'load') {
      const slots: (number | 'auto')[] = ['auto', ...Array.from({ length: SLOTS }, (_, i) => i + 1)];
      const r = listInput(this.loadSel, slots.length, 20, 30, 160, 15);
      this.loadSel = r.sel;
      if (r.ok && slotInfo(slots[this.loadSel]) && load(slots[this.loadSel])) { sfx('confirm'); this.result = { kind: 'load' }; }
      return;
    }
    if (this.stage === 'diff') {
      const r = listInput(this.diff, 3, 40, 70, 120, 32);
      this.diff = r.sel;
      if (r.ok) { sfx('confirm'); this.stage = 'name'; this.name = new NameEntry('Your name', this.heroName); }
      return;
    }
    if (this.stage === 'name') {
      this.name!.update(dt);
      if (this.name!.done) { this.heroName = this.name!.done; this.stage = 'class'; consume(); sfx('confirm'); }
      return;
    }
    if (this.stage === 'class') {
      const r = listInput(this.cls, 4, 12, 40, 60, 12);
      this.cls = r.sel;
      if (r.ok) { sfx('confirm'); this.stage = 'bg'; }
      return;
    }
    if (this.stage === 'bg') {
      const r = listInput(this.bgSel, BACKGROUNDS.length, 12, 40, W - 24, 12);
      this.bgSel = r.sel;
      if (r.ok) { sfx('confirm'); this.stage = 'look'; }
      return;
    }
    if (this.stage === 'look') {
      const lists: readonly unknown[][] = [SKINS, HAIRS, STYLES, HATS, COATS, TOP_NAMES, SHIRTS, ACCENTS];
      const rows = lists.length + 1;
      if (repeat('up')) { this.lookRow = (this.lookRow + rows - 1) % rows; sfx('cursor'); }
      if (repeat('down')) { this.lookRow = (this.lookRow + 1) % rows; sfx('cursor'); }
      const d = repeat('right') ? 1 : repeat('left') ? -1 : 0;
      if (d && this.lookRow < lists.length) {
        const n = lists[this.lookRow].length;
        this.lookIdx[this.lookRow] = (this.lookIdx[this.lookRow] + d + n) % n;
        sfx('cursor');
      }
      const [sk, hc, hs, ht, co, cu, sh, tr] = this.lookIdx;
      this.look = { skin: SKINS[sk], hair: HAIRS[hc], hairStyle: STYLES[hs], extras: HATS[ht] === 'none' ? [] : [HATS[ht]], coat: COATS[co], top: TOP_NAMES[cu], shirt: SHIRTS[sh], accent: ACCENTS[tr] };
      if (pressed('a') && this.lookRow === lists.length) {
        sfx('confirm');
        const cls = (['blade', 'diver', 'rigger', 'mouth'] as const)[this.cls];
        this.result = { kind: 'new', name: this.heroName, cls, look: this.look, bg: BACKGROUNDS[this.bgSel].id, difficulty: (['story', 'runner', 'flatline'] as const)[this.diff] };
      }
    }
  }
  items(): string[] { return latest() !== null ? ['Continue', 'New game', 'Load', 'Sluice'] : ['New game', 'Load', 'Sluice']; }
  constructor() { loadWorld(titleMap); WORLD.cam.x = 10; WORLD.cam.y = 0; WORLD.camTarget = null; }
  renderBack() {
    WORLD.t = this.t;
    updateBailers(1 / 60);
    renderWorld({ flag: () => false, dt: 1 / 60 });
  }
  render() {
    this.renderBack();
    // Title letters.
    const word = 'FATHOM';
    const lw = 7, gap = 3;
    let x = Math.round((W - (word.length * (lw + gap) - gap)) / 2);
    for (const ch of word) {
      BIG[ch].forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) upx(x + i + ox, 6 + y + oy, C.black); });
      BIG[ch].forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') upx(x + i, 6 + y, y < 2 ? C.cyan4 : y < 6 ? C.cyan3 : C.cyan2); });
      x += lw + gap;
    }
    const sub = 'forty meters below the sea';
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(sub, Math.round((W - textWidth(sub)) / 2) + ox, 20 + oy, C.black);
    drawText(sub, Math.round((W - textWidth(sub)) / 2), 20, C.vio4);
    if (this.stage === 'menu') {
      const items = this.items();
      panel(70, 122, 72, items.length * 9 + 10);
      drawList(items.map((t) => ({ text: t })), this.sel, 76, 128, 60);
      const l = latest();
      const inf = l !== null ? slotInfo(l) : null;
      if (inf) {
        const s = `${inf.name}  Ch ${inf.chapter}  ${fmtTime(inf.playtime)}`;
        const x = Math.round((W - textWidth(s)) / 2), y = 122 + items.length * 9 + 12;
        rect(x - 2, y - 2, textWidth(s) + 4, 11, C.black);
        drawText(s, x, y, C.gray);
      }
      rect(2, H - 12, textWidth('Z: choose  X: back') + 4, 11, C.black);
      drawText('Z: choose  X: back', 4, H - 10, C.gray);
      return;
    }
    if (this.stage === 'load') {
      panel(10, 16, W - 20, H - 26, 'Load');
      const slots: (number | 'auto')[] = ['auto', ...Array.from({ length: SLOTS }, (_, i) => i + 1)];
      slots.forEach((s, i) => {
        const inf = slotInfo(s);
        const y = 30 + i * 15;
        if (i === this.loadSel) rect(14, y - 1, W - 28, 14, C.vio0);
        drawText(s === 'auto' ? 'Auto' : `File ${s}`, 18, y, C.pale);
        if (inf) drawText(`${inf.name} Ch${inf.chapter} ${fmtTime(inf.playtime)}`, 62, y, C.cyan3, W - 80);
        else drawText('none', 62, y, C.slate);
      });
      return;
    }
    if (this.stage === 'diff') {
      panel(30, 56, 140, 112, 'City Difficulty');
      const opts = [['Story', 'Enemies hit softer and fall faster.'], ['Runner', 'The fights as designed.'], ['Flatline', 'Enemies hit harder and think better.']];
      opts.forEach(([n, d], i) => {
        const y = 70 + i * 32;
        if (i === this.diff) rect(34, y - 1, 132, 30, C.vio0);
        drawText(n, 40, y, i === this.diff ? C.white : C.pale);
        drawWrapped(d, 40, y + 9, 124, C.gray, 2);
      });
      return;
    }
    if (this.stage === 'name') { this.name!.render(); return; }
    if (this.stage === 'class') {
      panel(6, 24, W - 12, H - 34, 'What do they pay you for?');
      const ids = ['blade', 'diver', 'rigger', 'mouth'] as const;
      drawList(ids.map((c) => ({ text: CLASSES[c].name })), this.cls, 12, 40, 60, 12);
      const c = CLASSES[ids[this.cls]];
      drawWrapped(c.desc, 80, 40, W - 92, C.pale, 6);
      const a = c.attr;
      drawText(`Body ${a.body}  Reflex ${a.reflex}`, 80, 104, C.cyan3);
      drawText(`Wits ${a.wits}  Nerve ${a.nerve}`, 80, 113, C.cyan3);
      return;
    }
    if (this.stage === 'bg') {
      panel(6, 24, W - 12, H - 34, 'Where are you from?');
      drawList(BACKGROUNDS.map((b) => ({ text: b.name, right: `${SKILL_NAME[b.skill]} +1` })), this.bgSel, 12, 40, W - 24, 12);
      drawWrapped(BACKGROUNDS[this.bgSel].desc, 12, 94, W - 24, C.pale, 6);
      return;
    }
    if (this.stage === 'look') {
      panel(6, 24, W - 12, H - 34, 'Look');
      const sh = personSheet(this.look);
      blitUI(sh.frames.down[0], 150, 60);
      blitUI(sh.frames.right[0], 150, 74);
      blitUI(sh.frames.up[0], 150, 88);
      const names = ['Skin', 'Hair color', 'Hair', 'Hat', 'Coat', 'Cut', 'Shirt', 'Trim', 'Done'];
      const [sk, hc, hs, ht, co, cu, si, tr] = this.lookIdx;
      const vals = [`${sk + 1}`, `${hc + 1}`, STYLES[hs], HATS[ht], `${co + 1}`, TOP_NAMES[cu], `${si + 1}`, `${tr + 1}`, ''];
      drawList(names.map((n, i) => ({ text: n, right: i < 8 ? `< ${vals[i]} >` : '' })), this.lookRow, 12, 40, 120, 10);
      drawText(`${this.heroName}, ${CLASSES[(['blade', 'diver', 'rigger', 'mouth'] as const)[this.cls]].name}`, 12, H - 22, C.amb3);
    }
  }
}
