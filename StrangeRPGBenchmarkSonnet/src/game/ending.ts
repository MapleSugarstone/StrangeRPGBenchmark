import { CHARS } from '../data/characters';
import { C, type Screen } from '../gfx/screen';
import { partySprite } from '../gfx/sprites';
import type { Game, Scene } from './game';
import { COL, starfield } from './ui';
import { TitleScene, bigText } from './title';

export class EndingScene implements Scene {
  musicKind = 'title' as const;
  t = 0;
  stars = starfield(40, 99, 128, 50);
  update(g: Game) {
    this.t++;
    if (this.t > 60 && g.input.was('a')) g.replace(new TitleScene());
  }
  draw(g: Game, s: Screen) {
    s.clear();
    const dusk = Math.min(0.6, this.t / 900);
    for (let y = 0; y < 128; y++) {
      const k = Math.min(1, y / 128 + dusk);
      const r = Math.floor(40 + 60 * (1 - k)), gr = Math.floor(20 + 40 * (1 - k)), b = Math.floor(60 + 140 * k);
      s.rect(0, y, 128, 1, (0xff000000 | (b << 16) | (gr << 8) | r) >>> 0);
    }
    this.stars.forEach(([x, y], i) => { if (this.t > 60 + i * 5) s.px(x, y, C.white); });
    bigText(s, 28, 10, 'THE END', COL.hi, 0xff301030);
    const st = g.state;
    const half = !!st.flags['ending_half'];
    s.textC(64, 30, half ? 'ONE LAST NOON, THEN EVENING' : 'THE EVENING CAME TO TUCK', C.white);
    CHARS.forEach((c, i) => {
      const x = 10 + (i % 6) * 18, y = 44 + Math.floor(i / 6) * 14;
      s.sprite(partySprite(c.id), x, y + (Math.floor((this.t + i * 7) / 20) % 2));
    });
    s.textC(64, 78, `BATTLES ${st.stats.battles}  WINS ${st.stats.wins}`, C.gray);
    s.textC(64, 85, `WIPES ${st.stats.wipes}  FLED ${st.stats.flees}`, C.gray);
    const lv = Math.round(st.roster.reduce((a, m) => a + m.lvl, 0) / st.roster.length);
    s.textC(64, 92, `AVERAGE LEVEL ${lv}  GOLD ${st.gold}`, C.gray);
    s.textC(64, 106, 'THANK YOU FOR PLAYING', C.white);
    if (this.t > 60 && Math.floor(this.t / 20) % 2 === 0) s.textC(64, 118, 'PRESS Z', COL.hi);
  }
}
