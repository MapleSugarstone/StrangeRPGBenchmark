// Starfall: stars fall over the night beach, and Ouro catches them in a shell held over one column.
// A pale star is worth one, a gold star three. A cinder star cracks the shell: three cracks and the night is over.
// A star that reaches the sand lights it in dithered rings that fade.
// Everything is drawn on a 96 by 96 layer shown at double size, so the stars, the shell, and the beach share one grid.
import { sfx } from '../../engine/audio';
import { text, textCenter, textRight } from '../../engine/font';
import { input } from '../../engine/input';
import { music } from '../../engine/music';
import { clear, dither, layer, rect, INK } from '../../engine/screen';
import { close, run, type Mode } from '../modes';
import { G, save } from '../state';
import { DIM, GOOD, PAPER, SEL, WARN } from '../ui';

const COLS = 7, CW = 12, X0 = 6, SAND = 82;
type Star = { col: number; y: number; kind: 0 | 1 | 2; speed: number };
type Glow = { x: number; t: number; kind: number };

export interface StarfallOpts {
  /** Multiplies how fast stars fall and how often they come. */
  speed?: number;
  /** Multiplies the cowries and nacre paid. */
  pay?: number;
  /** Stars land in these columns in this order, again and again, so the night can be learned. */
  fixed?: number[];
  /** The flag that keeps this place's best score. */
  bestKey?: string;
}

/** Plays one night and resolves to the score. Pays cowries for the score and nacre for every 20 points. */
export function starfall(opts: StarfallOpts = {}): Promise<number> {
  const speedK = opts.speed || 1, payK = opts.pay || 1, bestKey = opts.bestKey || 'starfallBest';
  let landed = 0;
  let seed = (G.time * 48271 + 7) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let col = 3, score = 0, cracks = 0, t = 0, next = 40, over = false, paid = false, best = G.flags[bestKey] || 0;
  const stars: Star[] = [];
  const glows: Glow[] = [];
  // A fixed sky: far stars that never fall.
  const sky: [number, number, number][] = Array.from({ length: 40 }, () => [Math.floor(rnd() * 96), Math.floor(rnd() * 60), Math.floor(rnd() * 3)]);
  music.play('starfall');

  const finish = () => {
    if (!paid) {
      paid = true;
      const cowries = score * 3 * payK, nacre = Math.floor(score / 20) * payK;
      G.rind += cowries; G.tan += nacre;
      if (score > best) { best = score; G.flags[bestKey] = score; }
      save();
    }
  };

  const m: Mode = {
    opaque: true,
    update() {
      if (over) {
        if (input.hit('ok') || input.hit('back')) { sfx('back'); close(m, score); }
        return;
      }
      t++;
      if (input.hit('left') || (input.held('left') && t % 6 === 0)) col = Math.max(0, col - 1);
      if (input.hit('right') || (input.held('right') && t % 6 === 0)) col = Math.min(COLS - 1, col + 1);
      if (input.hit('back')) { over = true; finish(); return; }
      // Stars come faster as the night goes on.
      if (--next <= 0) {
        const r = rnd();
        const kind: 0 | 1 | 2 = r < 0.18 + Math.min(0.12, t / 6000) ? 2 : r < 0.32 ? 1 : 0;
        const c = opts.fixed ? opts.fixed[landed++ % opts.fixed.length] : Math.floor(rnd() * COLS);
        stars.push({ col: c, y: -4, kind, speed: (0.35 + Math.min(0.9, t / 2400) + rnd() * 0.15) * speedK });
        next = Math.round((Math.max(10, 44 - Math.floor(t / 90)) + Math.floor(rnd() * 10)) / speedK);
      }
      for (const s of stars) s.y += s.speed;
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        if (s.y >= SAND - 9 && s.y < SAND - 4 && s.col === col) {
          stars.splice(i, 1);
          if (s.kind === 2) { cracks++; sfx('hitBig'); if (cracks >= 3) { over = true; finish(); } }
          else { score += s.kind === 1 ? 3 : 1; sfx(s.kind === 1 ? 'level' : 'nerve'); }
        } else if (s.y >= SAND) {
          stars.splice(i, 1);
          glows.push({ x: X0 + s.col * CW + 5, t: 0, kind: s.kind });
          if (s.kind !== 2) sfx('blip');
        }
      }
      for (const g of glows) g.t++;
      while (glows.length && glows[0].t > 90) glows.shift();
    },
    draw() {
      clear(INK);
      layer('starfall', 96, 96, 0, 0, 2, () => {
        // Sky: deep blue banded down to violet at the horizon.
        rect(0, 0, 96, 96, '#0a0c24');
        dither(0, 30, 96, 20, '#1a1a48', 0.5);
        rect(0, 50, 96, 30, '#1a1a48');
        dither(0, 66, 96, 14, '#3a2a5a', 0.5);
        for (const [x, y, k] of sky) if ((t + x * 7) % (90 + k * 30) > 6) rect(x, y, 1, 1, ['#6a6a9a', '#a8a8d0', '#e8e4ff'][k]);
        // Sand, with every fallen star's light spreading out in dithered rings.
        rect(0, SAND, 96, 14, '#c8b48a');
        dither(0, SAND, 96, 3, '#e8d8b0', 0.5);
        for (const g of glows) {
          const r = Math.min(14, 2 + g.t / 4), fade = 1 - g.t / 90;
          const c = g.kind === 1 ? '#f8d860' : g.kind === 2 ? '#e05a3a' : '#f0eccf';
          dither(g.x - r, SAND - 1, r * 2, 6, c, 0.6 * fade);
          dither(g.x - r / 2, SAND - 1, r, 4, c, Math.min(1, 1.2 * fade));
        }
        for (const s of stars) {
          const x = X0 + s.col * CW + 5, y = Math.floor(s.y);
          const c = s.kind === 1 ? '#f8d860' : s.kind === 2 ? '#a83a2a' : '#f0eccf';
          rect(x, y - 4, 1, 3, s.kind === 2 ? '#5a2a2a' : '#6a6aa8');
          rect(x - 1, y, 3, 1, c); rect(x, y - 1, 1, 3, c);
          if (s.kind === 1) { rect(x - 2, y, 1, 1, c); rect(x + 2, y, 1, 1, c); }
        }
        // The shell basket, a scallop held over one column.
        const bx = X0 + col * CW;
        rect(bx + 1, SAND - 6, 9, 1, '#f4d8d0'); rect(bx, SAND - 5, 11, 2, '#e8b8b0'); rect(bx + 2, SAND - 3, 7, 1, '#c88880');
        for (let k = 0; k < cracks; k++) rect(bx + 3 + k * 2, SAND - 5, 1, 2, INK);
      });
      text(`Starfall`, 4, 4, SEL, INK);
      textRight(`${score}`, 188, 4, GOOD, INK);
      text(`cracks ${cracks}/3`, 4, 182, cracks ? WARN : DIM, INK);
      textRight(`best ${best}`, 188, 182, DIM, INK);
      if (over) {
        rect(26, 70, 140, 40, INK);
        textCenter(`${score} stars caught.`, 96, 76, PAPER);
        textCenter(`${score * 3 * payK} cowries${score >= 20 ? `, ${Math.floor(score / 20) * payK} nacre` : ''}.`, 96, 86, GOOD);
        textCenter('Z to finish', 96, 98, DIM);
      }
    },
  };
  return run(m);
}
