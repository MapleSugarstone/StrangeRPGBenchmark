import { newGame } from '../core/party';
import { CHARS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { glyph } from '../gfx/font';
import { C, rgb, type Screen } from '../gfx/screen';
import { bossSprites, monsterSprite, partySprite } from '../gfx/sprites';
import { CHAPTERS } from '../story/chapters';
import type { Game, Scene } from './game';
import { COL, ListMenu, panel, starfield } from './ui';
import { LabScene } from './lab';
import { WorldScene } from './world';

export function bigText(s: Screen, x: number, y: number, text: string, color: number, shadow = 0) {
  for (let i = 0; i < text.length; i++) {
    const g = glyph(text[i]);
    for (let k = 0; k < 15; k++) {
      if (g[k] !== '1') continue;
      const px = x + i * 8 + (k % 3) * 2, py = y + Math.floor(k / 3) * 2;
      if (shadow) s.rect(px + 1, py + 1, 2, 2, shadow);
      s.rect(px, py, 2, 2, color);
    }
  }
}

export class TitleScene implements Scene {
  musicKind = 'title' as const;
  t = 0;
  menu: ListMenu;
  stage: 'main' | 'chapters' = 'main';
  chapters: ListMenu;
  stars = starfield(50, 7, 128, 70);
  walkers: { x: number; y: number; sp: number; kind: number; v: number }[] = [];
  constructor() {
    this.menu = new ListMenu([], 5);
    this.chapters = new ListMenu(CHAPTERS.map((c) => ({ label: `${c.id} ${c.title.toUpperCase().slice(0, 22)}` })), 9);
    for (let i = 0; i < 9; i++) this.walkers.push({ x: i * 16, y: 106, sp: 0.15 + (i % 3) * 0.05, kind: i, v: i % 2 ? 1 : -1 });
  }
  private items(g: Game) {
    this.menu.setItems([{ label: 'NEW GAME' }, { label: 'CONTINUE', disabled: !g.hasSave() }, { label: 'CHAPTER SELECT' }, { label: 'BALANCE LAB' }, { label: g.audio.muted ? 'SOUND: OFF' : 'SOUND: ON' }]);
  }
  update(g: Game) {
    this.t++;
    for (const w of this.walkers) { w.x += w.sp * w.v; if (w.x > 130) w.x = -8; if (w.x < -10) w.x = 128; }
    if (this.stage === 'chapters') {
      const r = this.chapters.update(g);
      if (r === 'cancel') this.stage = 'main';
      else if (r === 'ok') { g.state = newGame(this.chapters.cursor + 1); g.replace(new WorldScene(g)); }
      return;
    }
    this.items(g);
    const r = this.menu.update(g);
    if (r !== 'ok') return;
    switch (this.menu.cursor) {
      case 0: g.state = newGame(1); g.replace(new WorldScene(g)); break;
      case 1: if (g.load()) g.replace(new WorldScene(g, true)); break;
      case 2: this.stage = 'chapters'; break;
      case 3: g.push(new LabScene()); break;
      case 4: g.audio.muted = !g.audio.muted; break;
    }
  }
  draw(g: Game, s: Screen) {
    s.clear();
    this.stars.forEach(([x, y], i) => { if ((this.t + i * 13) % 90 > 4) s.px(x, y, i % 5 === 0 ? C.white : 0xff606078); });
    const lamp = bossSprites('eye', 77, ['#ffc83a', '#fff8d0']);
    const bob = Math.round(Math.sin(this.t / 40) * 1);
    lamp.forEach((sp, i) => s.sprite(sp, 56 + (i % 2) * 8, 8 + Math.floor(i / 2) * 8 + bob));
    bigText(s, 16, 30, 'THE LONG', COL.hi, rgb('#5a2a00'));
    bigText(s, 32, 42, 'NOON', C.white, rgb('#5a2a00'));
    s.textC(64, 58, 'A TALE IN EIGHT BY EIGHT', C.gray);
    const cs = CHARS.map((c) => partySprite(c.id));
    const en = Object.values(ENEMIES);
    for (const w of this.walkers) {
      const e = en[(w.kind * 7) % en.length];
      const sp = w.kind % 2 === 0 ? cs[(w.kind * 3) % cs.length] : monsterSprite(e.arch, e.seed, e.colors);
      s.sprite(sp, Math.round(w.x), 118 + (Math.floor((this.t + w.kind * 9) / 10) % 2), { flipX: w.v < 0 });
    }
    if (this.stage === 'main') {
      panel(s, 26, 65, 76, 41);
      this.menu.draw(s, 30, 69, 70, true);
    } else {
      panel(s, 4, 14, 120, 76);
      s.text(8, 17, 'CHAPTER SELECT', COL.hi);
      this.chapters.draw(s, 8, 25, 112);
      s.text(8, 94, 'STARTS AT THE EXPECTED LEVEL', C.gray);
    }
    if (this.stage === 'main') s.textC(64, 110, 'Z OK   ARROWS MOVE   X BACK', C.gray);
    void g;
  }
}
