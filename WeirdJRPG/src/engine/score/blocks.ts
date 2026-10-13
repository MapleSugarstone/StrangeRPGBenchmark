// A full texture for each motif, built once and reused by the final boss, the endings, and the credits.
import { B, KEEP, colorTones, fold, floatProg, padTo, prog, shift } from './lib';
import type { Ctx, Key, MotifName, Voice } from './lib';
import { CHOICE, KEEPER, LIGHTBOUND, SEER, STONE, UNRAVEL, VOID, VORN, YEAR_BASS, YEAR_LEAD, pilgrim } from './motifs';
import { arp, bassLine, gears } from './kit';

export interface BlockOpts {
  /** Drum level: 0 none, 1 kick and snare, 2 adds hats. */
  drums?: 0 | 1 | 2;
  /** Overall level. */
  g?: number;
  /** How far Light-Bound #123's tune has been corrupted by the Stone, from 0 to 1. */
  corrupt?: number;
  /** Give the drums intensity thresholds so they arrive as the fight turns. */
  lay?: boolean;
  beats?: number;
}

/** Kick, snare, and off-beat hats for a run of bars. Kicks and snares never share an instant. */
export function drumBars(b: B, t0: number, bars: number, g: number, level: 1 | 2, lay = false) {
  for (let i = 0; i < bars; i++) {
    const t = t0 + i * 4;
    b.hit(t, 'kick', 0.5 * g, 0.2, lay ? { lay: 0.1 } : undefined).hit(t + 2, 'kick', 0.45 * g, 0.2, lay ? { lay: 0.1 } : undefined);
    b.hit(t + 1, 'snare', 0.34 * g, 0.12, lay ? { lay: 0.35 } : undefined).hit(t + 3, 'snare', 0.34 * g, 0.12, lay ? { lay: 0.35 } : undefined);
    if (level === 2) for (let k = 0; k < 4; k++) b.hit(t + k + 0.5, 'hat', 0.12 * g, 0.06, lay ? { lay: 0.6 } : undefined);
  }
}

/** Light-Bound #123's tune on a voice, bouncing, with a share of its notes soured by the Stone. */
export function lbTune(b: B, c: Ctx, K: Key, t0: number, corrupt: number, g: number, v: Voice = 'p1') {
  const r = c.r;
  let t = t0;
  for (const [d, l, acc] of LIGHTBOUND) {
    if (d !== null) {
      let p = K(d) + 12 + (acc ?? 0);
      if (r.chance(corrupt * 0.55)) {
        const k = r.int(4);
        if (k === 0) p = K(d + r.pick([2, 4, 6])) + 12;
        else if (k === 1) p += 0.5;
        else if (k === 2) p += r.pick([6, -6, 1, -1]);
        else b.n('x', t, p + 6.5, Math.max(0.3, l * 0.9), 0.12 * g, { ratio: 5.19 });
      }
      b.n(v, t, p, l * 0.55, 0.38 * g, { duty: 2, ...KEEP });
    }
    t += l;
  }
}

/** The kitchen accompaniment: a bass on the beat, a chord off it, and clattering utensils. */
export function polka(b: B, K: Key, t0: number, bars: number, roots: readonly number[], g: number, corrupt = 0) {
  for (let i = 0; i < bars; i++) {
    const t = t0 + i * 4, R = roots[i % roots.length];
    const low = fold(K(R) + (corrupt > 0.5 && i % 4 === 3 ? 6 : 0), 36);
    b.n('tri', t, low, 0.45, 0.5 * g).n('tri', t + 1, low + 7, 0.45, 0.42 * g).n('tri', t + 2, low, 0.45, 0.5 * g).n('tri', t + 3, low + 7, 0.45, 0.42 * g);
    const ch = [K(R + 2), K(R + 4), K(R + 7)].map((p) => fold(p, 55));
    for (const o of [0.5, 1.5, 2.5, 3.5]) b.n('p2', t + o, ch[Math.floor(o) % 3], 0.3, 0.12 * g, { duty: 1 });
    b.hit(t + 0.5, 'tick', 0.1 * g, 0.04).hit(t + 2.5, 'drip', 0.1 * g, 0.06);
  }
}

/** One 16-beat texture in which a motif is the subject. */
export function motifBlock(name: MotifName, c: Ctx, K: Key, o: BlockOpts = {}): B {
  const r = c.r, beats = o.beats ?? 16, g = o.g ?? 1, bars = Math.floor(beats / 4);
  const b = new B(beats, 4, c.bpm);
  b.mot(name);
  const drums = o.drums ?? 0;
  const roots = floatProg(r, bars, 0, 0.3);
  switch (name) {
    case 'pilgrim': {
      const fig = pilgrim(Math.max(c.prog, 0.5), r);
      b.fig('p1', 0, fig, K, 1, 0.4 * g, { duty: 3, a: 0.05, ...KEEP }, 0.95);
      b.fig('x', 8, fig, K, 0, 0.14 * g, { ...KEEP, ratio: 2 }, 0.9);
      for (let i = 0; i < bars; i++) {
        b.n('tri', i * 4, fold(K(roots[i]), 33), 3.8, 0.45 * g, { a: 0.3 });
        arp(b, 'p2', i * 4, 4, 1, colorTones(K, roots[i], 'sus2', 57), [0, 1, 2, 1], 0.1 * g, { duty: 1 }, 1);
      }
      break;
    }
    case 'unravel':
      for (let i = 0; i < bars; i++) {
        const t0 = i * 4;
        bassLine(b, 'tri', t0, UNRAVEL, K, i % 4 === 3 ? 3 : 0, 33, 0.5 * g, {}, 0.7);
        b.fig('p2', t0 + 0.25, shift(UNRAVEL, 0), K, 1, 0.17 * g, { duty: 0 }, 0.5);
        gears(b, t0, 4, 0.5, 0.2 * g, [0, 3, 6], 8);
      }
      b.n('x', 0, K(0) + 12, 15, 0.1 * g, { sus: 1, a: 3, ratio: 1 });
      break;
    case 'void':
      bassLine(b, 'tri', 0, VOID, K, 0, 28, 0.6 * g, { a: 2.5, ...KEEP }, 1);
      b.n('x', 10, fold(K(-3), 50), 4, 0.1 * g, { sus: 1, a: 1.5 });
      b.hit(0, 'rumble', 0.14 * g, 14, { a: 5 });
      break;
    case 'stone':
      for (let i = 0; i < bars; i++) {
        const tones = colorTones(K, roots[i], 'nin', 60);
        arp(b, 'p2', i * 4, 4, 0.25, tones, [0, 1, 2, 3, 4, 3, 2, 1], 0.12 * g, { duty: 0 }, 1.3);
        for (let s = 0; s < 16; s += 3) b.n('x', i * 4 + s * 0.25 + 0.75, tones[(s / 3) % tones.length] + 12.5, 0.9, 0.1 * g, {});
        b.n('tri', i * 4, fold(K(roots[i]), 36), 3.9, 0.5 * g);
      }
      b.fig('p1', 0, STONE, K, 1, 0.22 * g, { duty: 0, ...KEEP }, 0.8);
      break;
    case 'year':
      for (let i = 0; i < bars; i++) {
        const R = [0, 5, 2, 6][i % 4];
        bassLine(b, 'tri', i * 4, YEAR_BASS, K, R, 33, 0.55 * g, {}, 0.8);
        bassLine(b, 'p2', i * 4, YEAR_BASS, K, R, 45, 0.12 * g, { duty: 0 }, 0.6);
        b.n('x', i * 4, K(R + 4) + 12, 3.9, 0.1 * g, { sus: 1, a: 0.6 });
      }
      b.fig('p1', 0, shift(YEAR_LEAD, 1), K, 1, 0.34 * g, { duty: 1, ...KEEP }, 0.95);
      b.fig('p1', 8, shift(YEAR_LEAD, 0), K, 1, 0.34 * g, { duty: 1, ...KEEP }, 0.95);
      break;
    case 'choice':
      bassLine(b, 'tri', 0, CHOICE, K, 0, 28, 0.6 * g, { a: 4, ...KEEP }, 1);
      b.n('x', 4, fold(K(0), 50), 10, 0.08 * g, { sus: 1, a: 4, ratio: 1 });
      b.hit(0, 'rumble', 0.1 * g, 16, { a: 8 });
      break;
    case 'vorn': {
      const march = padTo(VORN, 4);
      for (const t0 of [0, 8]) {
        bassLine(b, 'tri', t0, march, K, t0 ? 3 : 0, 33, 0.55 * g, {}, 0.7);
        b.fig('p1', t0, march, K, 0, 0.3 * g, { duty: 2, ...KEEP }, 0.75);
      }
      for (let t = 0; t < 16; t += 2) b.hit(t, 'stamp', 0.3 * g, 0.2);
      break;
    }
    case 'keeper':
      for (let i = 0; i < 4; i++) {
        const t0 = i * 4;
        b.fig('p1', t0, shift(KEEPER, i === 3 ? 1 : 0), K, 1, 0.34 * g, { duty: 0, ...KEEP }, 0.6);
        let t = t0;
        for (const [d, l] of KEEPER) { if (d !== null) b.hit(t, 'type', 0.28 * g, 0.04); t += l; }
        b.n('tri', t0, fold(K(0), 33), 0.4, 0.5 * g).n('tri', t0 + 2, fold(K(0), 33), 0.4, 0.5 * g);
        b.n('x', t0 + 3.2, K(0) + 36, 0.8, 0.1 * g, { ratio: 4.13 });
      }
      break;
    case 'lightbound': {
      const corrupt = o.corrupt ?? 0;
      lbTune(b, c, K, 0, corrupt, g);
      lbTune(b, c, K, 8, corrupt, g);
      polka(b, K, 0, bars, [0, 0, 3, 4], g, corrupt);
      break;
    }
    case 'seer': {
      const fig = padTo(SEER, 4);
      b.fig('p1', 0, fig, K, 0, 0.3 * g, { duty: 3, a: 0.06, ...KEEP }, 0.97);
      const rr = prog(r, [0, 5, 3, 4], { 5: [5, 2] }, 0.2);
      for (let i = 0; i < bars; i++) {
        bassLine(b, 'tri', i * 4, [[0, 2], [4, 2]], K, rr[i % 4], 36, 0.45 * g, { a: 0.1 }, 0.95);
        arp(b, 'p2', i * 4, 4, 0.5, colorTones(K, rr[i % 4], 'tri', 57), [0, 1, 2, 1, 2, 1, 0, 1], 0.07 * g, { duty: 3, a: 0.05 }, 1.2);
      }
      break;
    }
  }
  if (drums) drumBars(b, 0, bars, g, drums, !!o.lay);
  return b;
}
