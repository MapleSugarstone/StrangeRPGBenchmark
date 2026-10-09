// Switchboard routing puzzles: rotate cable junctions until power runs from the socket to the door.
import type { Gfx } from '../core/gfx';
import type { Ctx } from '../game/ctx';
import type { TriggerDef } from './types';

export interface CablePuzzle {
  id: string;
  ox: number; oy: number;
  cells: string[];
  start: number[];
  src: [number, number, number];
  dst: [number, number, number];
  onSolve: (c: Ctx) => Promise<void>;
  // Runs instead of turning a junction while it returns true.
  locked?: (c: Ctx) => Promise<boolean>;
}

const OPEN: Record<string, number[]> = { I: [0, 2], L: [0, 1], T: [0, 1, 2], '+': [0, 1, 2, 3] };
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

function cellsOf(pz: CablePuzzle): { x: number; y: number; k: string; i: number }[] {
  const out: { x: number; y: number; k: string; i: number }[] = [];
  pz.cells.forEach((row, y) => row.split('').forEach((k, x) => { if (k !== '.') out.push({ x, y, k, i: out.length }); }));
  return out;
}

function rot(c: Ctx, pz: CablePuzzle, x: number, y: number, i: number): number {
  const v = c.s.flags[`pz_${pz.id}_${x}_${y}`];
  return v === undefined ? pz.start[i] ?? 0 : Number(v);
}

function opens(c: Ctx, pz: CablePuzzle, x: number, y: number): number[] {
  const all = cellsOf(pz);
  const cell = all.find((q) => q.x === x && q.y === y);
  if (!cell) return [];
  const r = rot(c, pz, x, y, cell.i);
  return OPEN[cell.k].map((d) => (d + r) % 4);
}

export function powered(c: Ctx, pz: CablePuzzle): Set<string> {
  const on = new Set<string>();
  const [sx, sy, sd] = pz.src;
  if (!opens(c, pz, sx, sy).includes(sd)) return on;
  const q: [number, number][] = [[sx, sy]];
  on.add(sx + ',' + sy);
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const d of opens(c, pz, x, y)) {
      const nx = x + DX[d], ny = y + DY[d];
      const key = nx + ',' + ny;
      if (on.has(key)) continue;
      if (!opens(c, pz, nx, ny).includes((d + 2) % 4)) continue;
      on.add(key);
      q.push([nx, ny]);
    }
  }
  return on;
}

export function solved(c: Ctx, pz: CablePuzzle): boolean {
  const [dx, dy, dd] = pz.dst;
  return powered(c, pz).has(dx + ',' + dy) && opens(c, pz, dx, dy).includes(dd);
}

export function cableTriggers(pz: CablePuzzle): TriggerDef[] {
  return cellsOf(pz).map((cell) => ({
    x: pz.ox + cell.x, y: pz.oy + cell.y, touch: true,
    run: async (c: Ctx) => {
      if (c.flag('pz_' + pz.id)) { await c.say(null, 'The line is live. Better not touch it now.'); return; }
      if (pz.locked && await pz.locked(c)) return;
      const r = rot(c, pz, cell.x, cell.y, cell.i);
      c.s.flags[`pz_${pz.id}_${cell.x}_${cell.y}`] = (r + 1) % (cell.k === 'I' ? 2 : 4);
      c.sfx('blip');
      if (solved(c, pz)) {
        c.set('pz_' + pz.id);
        c.sfx('ring');
        await pz.onSolve(c);
      }
    },
  }));
}

export function drawCable(g: Gfx, cx: number, cy: number, c: Ctx, pz: CablePuzzle) {
  const on = powered(c, pz);
  const done = c.flag('pz_' + pz.id);
  for (const cell of cellsOf(pz)) {
    const px = (pz.ox + cell.x) * 8 - cx, py = (pz.oy + cell.y) * 8 - cy;
    const lit = on.has(cell.x + ',' + cell.y);
    const color = done ? 'mint' : lit ? 'gold' : 'grey';
    g.rect(px + 3, py + 3, 2, 2, color);
    for (const d of opens(c, pz, cell.x, cell.y)) {
      if (d === 0) g.rect(px + 3, py, 2, 3, color);
      if (d === 1) g.rect(px + 5, py + 3, 3, 2, color);
      if (d === 2) g.rect(px + 3, py + 5, 2, 3, color);
      if (d === 3) g.rect(px, py + 3, 3, 2, color);
    }
  }
  const mark = (x: number, y: number, d: number, col: string) => {
    const px = (pz.ox + x + DX[d]) * 8 - cx, py = (pz.oy + y + DY[d]) * 8 - cy;
    g.rect(px + 2, py + 2, 4, 4, col);
    g.border(px + 1, py + 1, 6, 6, 'ink');
  };
  mark(pz.src[0], pz.src[1], pz.src[2], 'gold');
  mark(pz.dst[0], pz.dst[1], pz.dst[2], done ? 'mint' : 'red');
}
