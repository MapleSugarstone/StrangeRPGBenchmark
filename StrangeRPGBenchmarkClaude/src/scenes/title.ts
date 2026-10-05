import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { Menu, MenuItem } from './ui';
import { load, newGame } from '../game/state';
import { chapterStart } from '../game/presets';
import { CHAPTERS } from '../maps';
import { GLYPHS } from '../core/font';
import { MEMBERS } from '../data/members';
import { Col, WHEEL, HUE_COLOR } from '../core/palette';

export function bigText(g: Gfx, s: string, x: number, y: number, scale: number, col: Col, shadow?: Col) {
  let cx = x;
  for (const ch of s) {
    const gl = GLYPHS.get(ch);
    if (!gl) { cx += 3 * scale; continue; }
    gl.rows.forEach((row, ry) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') {
        if (shadow) g.rect(cx + i * scale + 1, y + ry * scale + 1, scale, scale, shadow);
        g.rect(cx + i * scale, y + ry * scale, scale, scale, col);
      }
    });
    cx += (gl.w + 1) * scale;
  }
}

export function bigW(s: string, scale: number): number {
  let w = 0;
  for (const ch of s) w += ((GLYPHS.get(ch)?.w ?? 2) + 1) * scale;
  return w - scale;
}

export class TitleScene implements Scene {
  t = 0;
  menu: Menu;
  chapters: Menu | null = null;

  constructor(private g: Game) {
    const items: MenuItem[] = [
      { label: 'New game', id: 'new' },
      { label: 'Continue', id: 'cont', enabled: !!load() },
      { label: 'Chapter select', id: 'chap' },
    ];
    this.menu = new Menu(items, items.length);
    g.audio.play('title');
  }

  update() {
    this.t++;
    const g = this.g;
    if (this.chapters) {
      const r = this.chapters.update(g.input, g.audio);
      if (r === 'back') this.chapters = null;
      else if (r === 'ok') {
        const n = +this.chapters.cur!.id!;
        this.start(chapterStart(n), true);
      }
      return;
    }
    const r = this.menu.update(g.input, g.audio);
    if (r !== 'ok') return;
    const id = this.menu.cur!.id;
    if (id === 'new') this.start(newGame(), true);
    else if (id === 'cont') { const st = load(); if (st) this.start(st, false); }
    else if (id === 'chap') {
      this.chapters = new Menu(CHAPTERS.map((c, i) => ({ label: `${i + 1}. ${c.title}`, id: String(i + 1), enabled: c.ready })), 8);
    }
  }

  private start(st: ReturnType<typeof newGame>, fresh: boolean) {
    const g = this.g;
    g.st = st;
    g.field = null;
    g.greyAll = !!st.flags.greyWorld;
    g.stack = [];
    g.loadMap(st.map, fresh ? CHAPTERS[st.chapter - 1].startMarker : [st.x, st.y]);
    g.push(g.field!);
    if (fresh) {
      const ch = CHAPTERS[st.chapter - 1];
      g.run(async s => {
        await s.card(st.chapter);
        s.music(g.world!.def.music);
        if (ch.intro) await ch.intro(s);
        else await g.enterMap();
      });
    } else {
      g.run(async () => { await g.enterMap(); });
    }
  }

  draw(g: Gfx) {
    g.clear('k');
    for (let i = 0; i < 24; i++) {
      const x = (i * 37 + this.t * (0.2 + (i % 3) * 0.1)) % 170 - 5;
      const y = (i * 53) % 150;
      g.rect(Math.round(x), y, 1, 1, i % 4 === 0 ? 'g2' : 'g1');
    }
    const s = 3;
    const w = bigW('DUOTONE', s);
    bigText(g, 'DUOTONE', 80 - Math.floor(w / 2), 18, s, 'o2', 'r1');
    WHEEL.forEach((h, i) => g.rect(56 + i * 8, 40, 6, 2, HUE_COLOR[h]));
    const bob = Math.round(Math.sin(this.t / 25) * 2);
    g.sprite(MEMBERS.wick.sprite, 64, 50 + bob, { scale: 4 });
    if (this.chapters) {
      this.chapters.draw(g, 14, 90, 132, this.t);
      return;
    }
    this.menu.draw(g, 44, 94, 72, this.t);
    g.textC('Arrows move. Z confirms. X cancels.', 80, 140, 'g2');
    g.textC('M mutes sound.', 80, 148, 'g1');
  }
}
