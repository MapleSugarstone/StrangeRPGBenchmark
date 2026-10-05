import { CHARS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { C, type Screen } from '../gfx/screen';
import { ARCH_IDS, bossSprites, DECOR_IDS, icon, monsterSprite, npcSprite, partySprite, SPECIAL_IDS, tile } from '../gfx/sprites';
import { CHAPTERS } from '../story/chapters';
import type { Game, Scene } from './game';

/** Debug view of every generated sprite. Open the game with ?sheet. */
export class SheetScene implements Scene {
  page = 0;
  update(g: Game) {
    if (g.input.was('right') || g.input.was('a')) this.page = (this.page + 1) % 4;
    if (g.input.was('left')) this.page = (this.page + 3) % 4;
  }
  draw(g: Game, s: Screen) {
    s.clear();
    s.text(2, 1, `SHEET ${this.page + 1}/4`, C.yellow);
    if (this.page === 0) {
      CHARS.forEach((c, i) => { s.sprite(partySprite(c.id), 4 + (i % 8) * 15, 10 + Math.floor(i / 8) * 12); });
      ['Ann', 'Bob', 'Cora', 'Dov', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kit', 'Lou', 'Mab', 'Ned', 'Oz', 'Pia'].forEach((n, i) => s.sprite(npcSprite(n), 4 + (i % 8) * 15, 40 + Math.floor(i / 8) * 12));
      ['potion', 'ink', 'feather', 'bomb', 'sword', 'armor', 'charm', 'rune', 'coin', 'cursor', 'heart', 'star'].forEach((n, i) => s.sprite(icon(n), 4 + (i % 8) * 15, 70 + Math.floor(i / 8) * 12));
    } else if (this.page === 1) {
      ARCH_IDS.forEach((a, i) => { for (let k = 0; k < 3; k++) s.sprite(monsterSprite(a, 100 + k * 37, i % 2 ? ['#ff8a3a', '#ffe0a0'] : ['#58c8ff', '#ff5a7a']), 4 + k * 10 + (i % 3) * 40, 8 + Math.floor(i / 3) * 12); });
    } else if (this.page === 2) {
      Object.values(ENEMIES).filter((e) => e.boss).slice(0, 12).forEach((e, i) => { bossSprites(e.arch, e.seed, e.colors).forEach((sp, k) => s.sprite(sp, 4 + (i % 4) * 30 + (k % 2) * 8, 8 + Math.floor(i / 4) * 34 + Math.floor(k / 2) * 8)); });
    } else {
      const th = CHAPTERS[Math.floor(g.frame / 90) % 12].theme;
      s.text(2, 10, th.name.toUpperCase(), C.white);
      ['floor', 'wall', ...DECOR_IDS, ...SPECIAL_IDS].forEach((k, i) => s.sprite(tile(th, k), 4 + (i % 12) * 10, 18 + Math.floor(i / 12) * 10));
    }
  }
}
