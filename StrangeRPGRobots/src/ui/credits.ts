// The credits: the crew the player finished with, the choices that shaped the city, and who made the game.
import { rect, blitUI, upx } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { W, H } from '../engine/screen';
import { G } from '../game/state';
import { lookFor } from '../world/field';
import { maxHp } from '../rules/stats';
import { fmtTime } from '../game/save';
import { hash } from '../world/tiles';

interface Row { text?: string; color?: number; who?: string; gap?: number }

function rows(): Row[] {
  const out: Row[] = [{ text: 'FATHOM', color: C.cyan3, gap: 14 }];
  out.push({ text: 'Your crew', color: C.amb3, gap: 4 });
  for (const m of Object.values(G.roster)) {
    if (m.dead) continue;
    out.push({ who: m.id, text: `${m.id === 'hero' ? G.heroName : m.name} (level ${m.level})`, color: C.pale, gap: 3 });
  }
  const gone = Object.values(G.roster).filter((m) => m.dead);
  if (gone.length) {
    out.push({ text: 'Not with you at the end', color: C.amb3, gap: 4 });
    for (const m of gone) out.push({ who: m.id, text: m.name, color: C.gray, gap: 3 });
  }
  out.push({ gap: 10 });
  out.push({ text: `${G.port.name}`, color: C.cyan4 }, { text: `Hold: ${G.port.hold}, Self: ${G.port.self}`, color: C.gray, gap: 10 });
  const done = Object.values(G.quests).filter((q) => q.done).length;
  out.push({ text: `${done} jobs completed`, color: C.pale }, { text: `Played for ${fmtTime(G.playtime)}`, color: C.pale, gap: 14 });
  out.push({ text: 'Story, code, art, and music', color: C.amb3 }, { text: 'Claude Opus 5.5', color: C.pale, gap: 10 });
  out.push({ text: 'Made for the Strange RPG Benchmark', color: C.gray, gap: 20 });
  out.push({ text: 'Thanks for playing.', color: C.white, gap: 0 });
  void maxHp;
  return out;
}

export class Credits {
  t = 0;
  list = rows();
  done = false;
  height = 0;
  update(dt: number) { this.t += dt; }
  finished(): boolean { return this.t * 12 > this.height + H; }
  render() {
    rect(0, 0, W, H, C.black);
    for (let k = 0; k < 50; k++) {
      const x = Math.floor((hash(k, 1, 9) * W + this.t * -20) % W + W) % W;
      const y = Math.floor((hash(k, 3, 9) * H + this.t * 90 * (0.6 + hash(k, 4, 9))) % H);
      upx(x, y, C.night);
    }
    let y = H - Math.floor(this.t * 12);
    for (const r of this.list) {
      if (r.text) {
        let x = Math.round((W - textWidth(r.text)) / 2);
        if (r.who) {
          const sh = lookFor(r.who).frames.down[0];
          x += 6;
          if (y > -12 && y < H) blitUI(sh, x - 13, y - 1);
        }
        if (y > -10 && y < H) drawText(r.text, x, y, r.color ?? C.pale);
        y += 10;
      }
      y += r.gap ?? 0;
    }
    this.height = y + Math.floor(this.t * 12) - H;
  }
}
