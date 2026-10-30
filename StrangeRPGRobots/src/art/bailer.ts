// The Bailers: giant woken pumps, about four tiles tall, with amber lamps for eyes. Frame 0 stands, 1 and 2 walk.
import { img, type Img } from '../engine/gfx';
import { C } from '../engine/palette';

const TOP = [
  '........00000000........',
  '......001111111100......',
  '.....01122222222110.....',
  '....0112222222222110....',
  '....0122333223332210....',
  '....0122333223332210....',
  '....0122222222222210....',
  '....0112222222222110....',
  '.....01111111111110.....',
  '....000000000000000.....',
  '...01111111111111110....',
  '..0112222222222222110...',
  '..0122222222222222210...',
  '..0122244444444222210...',
  '..0122222222222222210...',
  '..0122222222222222210...',
  '..01222222222222222100..',
  '..012222222222222221100.',
  '..0122222222222222210110',
  '..0122244444444222210.10',
  '..0122222222222222210.10',
  '..0112222222222222110.10',
  '...01111111111111110..10',
  '....000000000000000...00',
];

function legs(phase: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < 16; r++) {
    const row = '........................'.split('');
    const lx = 5 + (phase === 1 && r > 8 ? -1 : 0), rx = 15 + (phase === 2 && r > 8 ? 1 : 0);
    const liftL = phase === 1 && r === 15, liftR = phase === 2 && r === 15;
    if (!liftL) { row[lx] = '0'; row[lx + 1] = '1'; row[lx + 2] = '1'; row[lx + 3] = '0'; }
    if (!liftR) { row[rx] = '0'; row[rx + 1] = '1'; row[rx + 2] = '1'; row[rx + 3] = '0'; }
    if (r === 14 || r === 15) {
      if (!liftL) { row[lx - 1] = '0'; row[lx + 4] = '0'; }
      if (!liftR) { row[rx - 1] = '0'; row[rx + 4] = '0'; }
    }
    out.push(row.join(''));
  }
  return out;
}

const PAL = [C.cyan0, C.cyan1, C.amb4, C.slate];

export const BAILER_FRAMES: Img[] = [0, 1, 2].map((p) => img([...TOP, ...legs(p)], PAL));
