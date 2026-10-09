// Prise: a deduction game played at the grotto. Shells hide 1, 2, 3, or a crack.
// Row and column hints give each line's total and its cracks. Flip every 2 and 3 to clear the board.
// The thumb feels one panel per board without flipping it.
import { sfx } from '../../engine/audio';
import { text, textCenter, textRight } from '../../engine/font';
import { input } from '../../engine/input';
import { music } from '../../engine/music';
import { dither, rect, INK } from '../../engine/screen';
import { close, run, type Mode } from '../modes';
import { G, save } from '../state';
import { BADC, box, DIM, GOOD, PAPER, SEL, WARN } from '../ui';

const N = 5;
const NICK = 0;
type Cell = { v: number; open: boolean; mark: number; felt: boolean };

/** Twos, threes, and nicks on a board of this level. */
function mix(level: number): [number, number, number] {
  return [2 + Math.floor(level / 2), 1 + Math.floor((level - 1) / 2), Math.min(12, 5 + level)];
}

function deal(level: number, rnd: () => number): Cell[] {
  const [twos, threes, nicks] = mix(level);
  const vals: number[] = [];
  for (let i = 0; i < twos; i++) vals.push(2);
  for (let i = 0; i < threes; i++) vals.push(3);
  for (let i = 0; i < nicks; i++) vals.push(NICK);
  while (vals.length < N * N) vals.push(1);
  for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
  return vals.map(v => ({ v, open: false, mark: 0, felt: false }));
}

const MARKS = ['', '1', '2', '3', 'x'];

/** Plays boards until the player stops. Pays cowries for each cleared board and nacre for the harder ones. */
export function scrape(): Promise<void> {
  let seed = (G.time * 2654435761 + 97) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let level = G.flags.scrapeLevel || 1;
  let board = deal(level, rnd);
  let score = 1, flips = 0, cx = 2, cy = 2, thumb = true;
  let phase: 'play' | 'menu' | 'lost' | 'won' = 'play';
  let menuI = 0, banner = '', earnedRind = 0, earnedTan = 0;
  const at = (x: number, y: number) => board[y * N + x];
  const needed = () => board.filter(c => c.v >= 2 && !c.open).length;
  music.play('minigame');

  const newBoard = () => { board = deal(level, rnd); score = 1; flips = 0; thumb = true; phase = 'play'; banner = ''; };

  const m: Mode = {
    opaque: true,
    update() {
      if (phase === 'lost' || phase === 'won') {
        if (input.hit('ok')) { newBoard(); sfx('ok'); }
        if (input.hit('back')) { sfx('back'); finish(); }
        return;
      }
      if (phase === 'menu') {
        const opts = menuOpts();
        if (input.hit('up')) menuI = (menuI + opts.length - 1) % opts.length;
        if (input.hit('down')) menuI = (menuI + 1) % opts.length;
        if (input.hit('back')) { phase = 'play'; sfx('back'); }
        if (input.hit('ok')) {
          const k = opts[menuI];
          phase = 'play';
          const c = at(cx, cy);
          if (k === 'Feel with thumb' && thumb && !c.open) { thumb = false; c.felt = true; sfx(c.v === NICK ? 'pegFail' : 'blip'); }
          else if (k.startsWith('Mark')) { c.mark = (c.mark + 1) % MARKS.length; sfx('move'); }
          else if (k === 'Stop for today') finish();
        }
        return;
      }
      if (input.hit('left')) { cx = (cx + N - 1) % N; sfx('move'); }
      if (input.hit('right')) { cx = (cx + 1) % N; sfx('move'); }
      if (input.hit('up')) { cy = (cy + N - 1) % N; sfx('move'); }
      if (input.hit('down')) { cy = (cy + 1) % N; sfx('move'); }
      if (input.hit('back')) { phase = 'menu'; menuI = 0; sfx('ok'); return; }
      if (input.hit('ok')) {
        const c = at(cx, cy);
        if (c.open) return;
        c.open = true;
        flips++;
        if (c.v === NICK) {
          sfx('hitBig');
          phase = 'lost';
          banner = 'A cracked one. The rock is spoiled.';
          for (const k of board) k.open = true;
          level = Math.max(1, Math.min(level, flips - 1));
          G.flags.scrapeLevel = level;
          save();
          return;
        }
        score *= c.v;
        sfx(c.v >= 2 ? 'nerve' : 'blip');
        if (needed() === 0) {
          const rind = score * 4 * level, tan = level >= 3 ? Math.floor(level / 2) : 0;
          G.rind += rind; G.tan += tan;
          earnedRind += rind; earnedTan += tan;
          banner = `Clean. ${rind} cowries${tan ? ` and ${tan} nacre` : ''}.`;
          sfx('level');
          phase = 'won';
          for (const k of board) k.open = true;
          level = Math.min(8, level + 1);
          G.flags.scrapeLevel = level;
          G.flags.scrapeBest = Math.max(G.flags.scrapeBest || 0, level);
          save();
        }
      }
    },
    draw() {
      rect(0, 0, 192, 192, '#17151d');
      box(2, 2, 188, 188);
      text(`Prise  level ${level}`, 6, 6, SEL);
      textRight(`x${score}`, 186, 6, score > 1 ? GOOD : DIM);
      text(`Thumb: ${thumb ? 'ready' : 'used'}`, 6, 16, thumb ? PAPER : DIM);
      textRight(`${needed()} good shells left`, 186, 16, DIM);
      const ox = 10, oy = 26, s = 22;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const c = at(x, y), px = ox + x * s, py = oy + y * s;
        if (!c.open) {
          rect(px, py, s - 2, s - 2, '#6a5440');
          dither(px, py, s - 2, s - 2, '#8a7058', 0.5);
          rect(px, py, s - 2, 1, '#a88a6a');
          if (c.felt) text(c.v === NICK ? 'rough' : 'smooth', px + 1, py + 13, c.v === NICK ? BADC : GOOD, INK);
          if (c.mark) text(MARKS[c.mark], px + 2, py + 2, SEL, INK);
        } else {
          rect(px, py, s - 2, s - 2, c.v === NICK ? '#4a2020' : '#d8c8a8');
          if (c.v === NICK) { rect(px + 5, py + 10, 12, 2, BADC); rect(px + 10, py + 5, 2, 12, BADC); }
          else textCenter(String(c.v), px + 11, py + 7, c.v >= 2 ? '#2a1a10' : '#6a5a4a');
        }
        if (x === cx && y === cy && phase !== 'lost' && phase !== 'won') {
          rect(px - 1, py - 1, s, 1, SEL); rect(px - 1, py + s - 2, s, 1, SEL);
          rect(px - 1, py - 1, 1, s, SEL); rect(px + s - 2, py - 1, 1, s, SEL);
        }
      }
      // Hints: each row and column shows its total and its cracks.
      for (let i = 0; i < N; i++) {
        let rs = 0, rn = 0, cs = 0, cn = 0;
        for (let k = 0; k < N; k++) { const r = at(k, i), c = at(i, k); rs += r.v; rn += r.v === NICK ? 1 : 0; cs += c.v; cn += c.v === NICK ? 1 : 0; }
        const hx = ox + N * s + 2, hy = oy + i * s;
        rect(hx, hy, 34, s - 2, '#2a2632');
        text(`${rs}`, hx + 3, hy + 2, PAPER);
        text(`${rn}x`, hx + 3, hy + 11, BADC);
        const vx = ox + i * s, vy = oy + N * s + 2;
        rect(vx, vy, s - 2, 19, '#2a2632');
        text(`${cs}`, vx + 3, vy + 1, PAPER);
        text(`${cn}x`, vx + 3, vy + 10, BADC);
      }
      if (banner) { box(8, 160, 176, 26, phase === 'won' ? GOOD : BADC); text(banner, 12, 164, PAPER); text('Z: next board   X: stop', 12, 174, DIM); }
      else text('Z prises. X: thumb, marks, stop.', 6, 178, DIM);
      if (earnedRind) textRight(`today ${earnedRind}c ${earnedTan}n`, 186, 168, WARN);
      if (phase === 'menu') {
        const opts = menuOpts();
        box(100, 60, 86, 12 + opts.length * 10);
        opts.forEach((o, i) => { if (i === menuI) text('\u0001', 104, 66 + i * 10, SEL); text(o, 112, 66 + i * 10, i === menuI ? SEL : PAPER); });
      }
    },
  };
  const menuOpts = () => [...(thumb && !at(cx, cy).open ? ['Feel with thumb'] : []), `Mark: ${MARKS[(at(cx, cy).mark + 1) % MARKS.length] || 'clear'}`, 'Stop for today'];
  const finish = () => close(m);
  return run(m);
}
