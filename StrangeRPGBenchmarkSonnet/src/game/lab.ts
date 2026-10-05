import { Rng } from '../core/rng';
import { BOSSES } from '../data/enemies';
import { C, type Screen } from '../gfx/screen';
import { BOSS_BONUS, REG_BONUS, chapterState, fight, pickEncounter } from '../sim/simlib';
import type { Game, Scene } from './game';
import { COL } from './ui';

interface Row { regWin: number; regN: number; bossWin: number; bossN: number; rounds: number }
const PER_CHAPTER = 24;

/** The game plays itself with the smart bot and charts win rates per chapter. */
export class LabScene implements Scene {
  rows: Row[] = Array.from({ length: 12 }, () => ({ regWin: 0, regN: 0, bossWin: 0, bossN: 0, rounds: 0 }));
  ch = 1;
  rng = new Rng(2024);
  done = false;
  t = 0;

  update(g: Game) {
    this.t++;
    if (g.input.was('b')) { g.pop(); return; }
    if (this.done) { if (g.input.was('a')) { this.rows.forEach((r) => Object.assign(r, { regWin: 0, regN: 0, bossWin: 0, bossN: 0, rounds: 0 })); this.ch = 1; this.done = false; } return; }
    for (let k = 0; k < 3 && !this.done; k++) {
      const r = this.rows[this.ch - 1];
      if (r.regN < PER_CHAPTER) {
        const f = fight(chapterState(this.ch, undefined, REG_BONUS), pickEncounter(this.ch, this.rng), false, 'smart', this.rng, 0.5, { noApply: true });
        r.regN++; r.regWin += f.win ? 1 : 0; r.rounds += f.rounds;
      } else if (r.bossN < PER_CHAPTER) {
        const s = chapterState(this.ch, undefined, BOSS_BONUS);
        let last;
        for (const grp of BOSSES[this.ch]) last = fight(s, grp, true, 'smart', this.rng, 0.85, { noApply: true });
        r.bossN++; r.bossWin += last!.win ? 1 : 0;
      } else if (this.ch < 12) this.ch++;
      else this.done = true;
    }
  }

  draw(_g: Game, s: Screen) {
    s.clear();
    s.text(4, 3, 'BALANCE LAB', COL.hi);
    s.textR(124, 3, this.done ? 'DONE' : `CH ${this.ch}`, this.done ? COL.good : C.gray);
    s.text(4, 11, 'SMART BOT, 24 FIGHTS EACH', C.gray);
    s.text(4, 20, 'CH', COL.dim);
    s.text(18, 20, 'REGULAR', C.cyan);
    s.text(62, 20, 'BOSS', C.gold);
    s.textR(124, 20, 'RND', COL.dim);
    this.rows.forEach((r, i) => {
      const y = 28 + i * 7;
      s.textR(12, y, String(i + 1), C.white);
      const rw = r.regN ? r.regWin / r.regN : 0, bw = r.bossN ? r.bossWin / r.bossN : 0;
      s.rect(18, y + 1, 38, 4, C.dark);
      s.rect(18, y + 1, Math.round(38 * rw), 4, C.cyan);
      s.rect(62, y + 1, 38, 4, C.dark);
      s.rect(62, y + 1, Math.round(38 * bw), 4, bw < 0.5 ? C.red : C.gold);
      s.text(102, y, r.bossN ? `${Math.round(bw * 100)}` : '-', C.white);
      s.textR(125, y, r.regN ? (r.rounds / r.regN).toFixed(1) : '-', C.gray);
    });
    s.text(4, 116, this.done ? 'Z AGAIN   X BACK' : 'X BACK', C.gray);
  }
}
