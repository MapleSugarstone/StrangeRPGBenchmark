import { Gfx, W } from '../core/gfx';
import { wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { decodeLetter, encodeLetter, letterText, TEMPLATES, WORDS } from '../game/letters';
import { addItem } from '../game/state';
import { ITEMS } from '../data/items';

export class LetterScene implements Scene {
  step = 0;
  idx = 0;
  scroll = 0;
  tpl = 0;
  word = 0;
  code = '';
  typed = '';
  result: string[] = [];

  constructor(private game: Game, private mode: 'write' | 'read') {
    if (mode === 'read') {
      game.input.textHandler = (e) => this.key(e);
    }
  }

  key(e: KeyboardEvent) {
    if (this.step !== 0) {
      if (e.key === 'Enter' || e.key === 'Escape') this.exit();
      return;
    }
    if (e.key === 'Escape') { this.exit(); return; }
    if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); return; }
    if (e.key === 'Enter') { this.open(); return; }
    if (/^[a-zA-Z0-9-]$/.test(e.key) && this.typed.length < 9) { this.typed += e.key.toUpperCase(); this.game.audio.sfx('text'); }
  }

  open() {
    const s = this.game.state!;
    const l = decodeLetter(this.typed);
    this.step = 1;
    if (!l) { this.result = ['That code does not open. Check each letter.']; this.game.audio.sfx('wrong'); return; }
    const norm = this.typed.replace(/[^A-Z0-9]/g, '');
    if (s.letters.includes(norm)) { this.result = ['You already read this one.', letterText(l)]; return; }
    s.letters.push(norm);
    this.result = [l.chapter ? `A letter from someone in chapter ${l.chapter}:` : 'A letter with no return address:', `"${letterText(l)}"`];
    const gift = l.gift === 1 ? 'postcard' : l.gift === 2 ? 'honey' : l.gift === 3 ? 'luckypleat' : null;
    if (gift) {
      addItem(this.game.state!, gift, l.gift === 2 ? 2 : 1);
      this.result.push(`Tucked inside: ${ITEMS[gift].name}.`);
    }
    this.game.audio.sfx('answer');
  }

  exit() {
    this.game.input.textHandler = null;
    this.game.pop(this);
    this.game.input.clearAll();
  }

  update() {
    if (this.mode === 'read') return;
    const inp = this.game.input;
    const s = this.game.state!;
    if (inp.pressed('back')) { if (this.step > 0 && this.step < 3) { this.step--; this.idx = 0; this.scroll = 0; } else this.exit(); return; }
    if (this.step === 3) { if (inp.pressed('ok')) this.exit(); return; }
    const list = this.step === 0 ? TEMPLATES.map((t) => t.replace('{w}', '___')) : this.step === 1 ? WORDS : ['No gift', `Attach a Postcard (have ${s.inv.postcard ?? 0})`];
    const n = list.length;
    if (inp.pressed('up')) this.idx = (this.idx + n - 1) % n;
    if (inp.pressed('down')) this.idx = (this.idx + 1) % n;
    if (this.idx < this.scroll) this.scroll = this.idx;
    if (this.idx >= this.scroll + 9) this.scroll = this.idx - 8;
    if (inp.pressed('ok')) {
      this.game.audio.sfx('ok');
      if (this.step === 0) { this.tpl = this.idx; this.step = 1; this.idx = 0; this.scroll = 0; }
      else if (this.step === 1) { this.word = this.idx; this.step = 2; this.idx = 0; this.scroll = 0; }
      else {
        let gift = 0;
        if (this.idx === 1 && (s.inv.postcard ?? 0) > 0) { gift = 1; addItem(s, 'postcard', -1); }
        this.code = encodeLetter({ tpl: this.tpl, word: this.word, chapter: s.chapter, gift, salt: Math.floor(Math.random() * 256) });
        try { void navigator.clipboard?.writeText(this.code); } catch { /* clipboard may be blocked */ }
        this.step = 3;
      }
    }
  }

  draw(g: Gfx) {
    g.clear('ink');
    g.box(4, 4, W - 8, 184, 'plea');
    if (this.mode === 'read') {
      g.textC('Open a letter', 96, 12, 'gold');
      if (this.step === 0) {
        g.textC('Type the code, then press Enter.', 96, 40, 'paper');
        g.box(46, 60, 100, 20, 'gold');
        g.textC(this.typed + (Math.floor(g.t / 20) % 2 ? '_' : ' '), 96, 66, 'cream');
        g.textC('Escape to go back.', 96, 170, 'grey');
      } else {
        let y = 40;
        for (const r of this.result) for (const l of wrap(r, 168)) { g.text(l, 12, y, 'cream'); y += 11; }
        g.textC('Press Enter.', 96, 170, 'grey');
      }
      return;
    }
    g.textC('Write a letter', 96, 12, 'gold');
    if (this.step === 3) {
      g.textC('Your letter says:', 96, 40, 'paper');
      wrap(`"${TEMPLATES[this.tpl].replace('{w}', WORDS[this.word])}"`, 168).forEach((l, i) => g.textC(l, 96, 54 + i * 11, 'cream'));
      g.textC('Its code is', 96, 90, 'paper');
      g.box(56, 102, 80, 20, 'gold');
      g.textC(this.code, 96, 108, 'gold');
      g.textC('Give the code to a friend. They can', 96, 134, 'grey');
      g.textC('open it from their own Options menu.', 96, 145, 'grey');
      return;
    }
    const s = this.game.state!;
    const title = this.step === 0 ? 'Choose a phrase' : this.step === 1 ? 'Choose a word' : 'Anything to send along?';
    g.text(title, 12, 26, 'paper');
    const list = this.step === 0 ? TEMPLATES.map((t) => t.replace('{w}', '___')) : this.step === 1 ? WORDS : ['No gift', `Attach a Postcard (have ${s.inv.postcard ?? 0})`];
    list.slice(this.scroll, this.scroll + 9).forEach((l, i) => {
      const k = this.scroll + i;
      g.text(l, 22, 42 + i * 12, k === this.idx ? 'gold' : 'paper');
      if (k === this.idx) g.cursor(12, 42 + i * 12);
    });
    if (this.step >= 1) g.textC(TEMPLATES[this.tpl].replace('{w}', this.step >= 2 ? WORDS[this.word] : WORDS[this.idx] ?? '___'), 96, 160, 'cream');
  }
}
