// The Between-Sea: ship, sea, lighthouse, reef, current, archive.
import { B, KEEP, MEL, MODE, colorTones, dropLast, fold, floatProg, key, retro, shift } from './lib';
import type { Ctx, Fig, Section, TrackDef } from './lib';
import { KEEPER, PILGRIM_HEAD } from './motifs';
import { arp, chimes, noTonicEnd, rhy, toPitch, walk } from './kit';

// ---------------------------------------------------------------- ship

const K_SHIP = key(50, MODE.dor);
const LILTS = [[1, 0.5, 1, 0.5], [1.5, 1.5], [0.5, 0.5, 0.5, 1, 0.5], [1, 1, 1], [0.5, 0.5, 1, 1], [1.5, 0.5, 1]];

function shipSec(c: Ctx, kind: 'a' | 'b' | 'c'): Section {
  const r = c.r, K = K_SHIP, bars = kind === 'c' ? 4 : 8, b = new B(bars * 3, 3, c.bpm);
  const start = kind === 'a' ? 0 : kind === 'b' ? 3 : 6;
  const roots = floatProg(r, bars, start, 0.08);
  // The last chord is never the tonic, so the section hands off to the next without a cadence.
  roots[bars - 1] = r.pick([4, 1, 6]);
  for (let i = 0; i < bars; i++) {
    const t0 = i * 3, R = roots[i];
    const low = fold(K(R), 36);
    b.n('tri', t0, low, 1.4, 0.5).n('tri', t0 + 1.5, low + 7, 1.4, 0.42);
    const ch = colorTones(K, R, r.pick(['tri', 'sus2', 'add9']), 57);
    arp(b, 'p2', t0, 3, 0.5, ch, [0, 1, 2, 1, 2, 1], 0.1, { duty: 2 }, 1.2);
    if (i % 2 === 0) b.n('x', t0, K(R + 4) + 12, 5.6, 0.1, { sus: 1, a: 0.8, bend: i % 4 ? 0.3 : -0.3 });
    const line = walk(r, r.pick(LILTS), r.pick([2, 4, 5]), [R, (R + 2) % 7, (R + 4) % 7], { lo: 1, hi: 9, rest: 0.05 });
    b.line('p1', t0, toPitch(line, K, 1), 0.34, { ...MEL, duty: 2 }, 0.85);
  }
  b.hit(0, 'rumble', 0.08, bars * 3, { a: 3 });
  return b.out();
}

export const ship: TrackDef = {
  swing: 0.06, stumble: 0.04, slip: 0.05, bendy: 0.1, bpm: 92, start: 'a', vary: 0.7, wrong: 0.05, echo: 0.45, wobble: 9, tint: 'sea', key: K_SHIP, motifs: [], neverTonic: true, post: (s) => noTonicEnd(s, K_SHIP),
  graph: { a: [['b', 3], ['c', 2], ['a', 1]], b: [['a', 3], ['c', 2], ['b', 1]], c: [['a', 2], ['b', 3]] },
  secs: { a: (c) => shipSec(c, 'a'), b: (c) => shipSec(c, 'b'), c: (c) => shipSec(c, 'c') },
};

// ---------------------------------------------------------------- sea

const K_SEA = key(54, MODE.dor);
const WATER = [[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 4], [3, 2, 1, 0, 1, 2], [0, 1, 2, 3, 4, 3, 2, 1]];

function seaSec(c: Ctx, kind: 'flow' | 'deep' | 'memory'): Section {
  const r = c.r, K = K_SEA, b = new B(16, 4, c.bpm);
  const roots = floatProg(r, 4, kind === 'deep' ? 5 : 0, 0.15);
  const shape = r.pick(WATER);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = roots[i];
    const tones = colorTones(K, R, r.pick(['sev', 'add9', 'nin']), 57);
    if (kind !== 'memory') arp(b, 'p2', t0, 4, 0.25, tones, shape, kind === 'deep' ? 0.07 : 0.12, { duty: 2 }, 1.5);
    const low = fold(K(R), kind === 'deep' ? 28 : 33);
    b.n('tri', t0, low, 3.9, kind === 'deep' ? 0.6 : 0.5, { a: kind === 'deep' ? 1 : 0.2 });
    if (i % 2 === 0) b.n('x', t0, tones[1] + 12, 7.5, 0.09, { sus: 1, a: 1.4, ratio: 1 });
  }
  if (kind === 'deep') b.hit(0, 'rumble', 0.14, 16, { a: 5 });
  const n = kind === 'memory' ? 2 : 1;
  for (let i = 0; i < n; i++) chimes(b, c, K, 1 + i * 8 + r.int(4), kind === 'memory' ? 0.22 : 0.15, { oct: 1, stretch: r.range(1.2, 2), echo: r.pick([2, 3, 4.5]) });
  if (kind !== 'deep' && r.chance(0.5)) b.fig('p1', 4 + r.int(8), PILGRIM_HEAD, K, 1, 0.12, { duty: 2, a: 0.08, ...KEEP }, 0.96);
  return b.out();
}

export const sea: TrackDef = {
  slip: 0.06, bendy: 0.1, bpm: 76, start: 'flow', vary: 0.6, wrong: 0.05, echo: 0.6, wobble: 10, tint: 'sea', key: K_SEA, motifs: [], quotes: ['pilgrim'],
  graph: { flow: [['flow', 1], ['deep', 2], ['memory', 3]], deep: [['flow', 3], ['memory', 2]], memory: [['flow', 3], ['deep', 1]] },
  secs: { flow: (c) => seaSec(c, 'flow'), deep: (c) => seaSec(c, 'deep'), memory: (c) => seaSec(c, 'memory') },
};

// ---------------------------------------------------------------- lighthouse

const K_LH = key(57, MODE.lyd);

function lightSec(c: Ctx, kind: 'beam' | 'lamp' | 'dark'): Section {
  const r = c.r, K = K_LH, b = new B(16, 4, c.bpm);
  const roots = floatProg(r, 2, kind === 'dark' ? 4 : 0, 0.2);
  for (let i = 0; i < 2; i++) {
    const t0 = i * 8, R = roots[i];
    b.n('tri', t0, fold(K(R), 33), 7.8, 0.45, { a: 1.5 });
    if (kind !== 'dark') {
      // The lamp turns: one bright ping per two beats, stepping up the scale.
      for (let j = 0; j < 4; j++) b.n('p2', t0 + j * 2, fold(K(R + [0, 2, 4, 6][j]), 72), 0.4, 0.1, { duty: 0, a: 0.01 });
      b.n('x', t0, K(R + 4) + 12, 7.5, 0.12, { sus: 1, a: 2.2 });
    }
    b.hit(t0 + 2, 'hush', 0.07, 4, { a: 2 });
  }
  const times = kind === 'dark' ? [1, 9] : [2, 10];
  for (const t of times) chimes(b, c, K, t + r.int(3), kind === 'beam' ? 0.2 : 0.26, { oct: 1, stretch: r.range(1.4, 2.2), echo: r.pick([1.5, 3, 4]) });
  return b.out();
}

export const lighthouse: TrackDef = {
  slip: 0.04, bendy: 0.1, bpm: 60, start: 'beam', vary: 0.5, wrong: 0.04, echo: 0.62, wobble: 8, tint: 'sea', key: K_LH, motifs: [], quotes: ['pilgrim'],
  graph: { beam: [['lamp', 3], ['dark', 1], ['beam', 1]], lamp: [['beam', 3], ['dark', 2]], dark: [['beam', 3], ['lamp', 2]] },
  secs: { beam: (c) => lightSec(c, 'beam'), lamp: (c) => lightSec(c, 'lamp'), dark: (c) => lightSec(c, 'dark') },
};

// ---------------------------------------------------------------- reef

const K_REEF = key(49, MODE.phr);

function newName(c: Ctx) {
  const r = c.r;
  const ph = walk(r, [...rhy(r, 4), ...rhy(r, 4)], r.pick([2, 4, 5]), [0, 2, 4], { lo: 1, hi: 8 });
  c.mem.pd = ph.map(([d]) => (d === null ? 99 : d));
  c.mem.pl = ph.map(([, l]) => l);
  c.st.stage = 0;
}

function nameFig(c: Ctx): Fig {
  return c.mem.pd.map((d, i) => [d === 99 ? null : d, c.mem.pl[i]] as const);
}

function reefSec(c: Ctx, kind: 'phrase' | 'blank'): Section {
  const r = c.r, K = K_REEF, b = new B(16, 4, c.bpm);
  b.mot('pilgrim');
  if (!c.mem.pd || !c.mem.pd.length) newName(c);
  let fig = nameFig(c);
  const total = fig.filter((x) => x[0] !== null).length;
  const roots = floatProg(r, 4, 0, 0.1);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = roots[i];
    b.n('tri', t0, fold(K(R), 33), 3.8, 0.45, { a: 0.4 });
    const tones = colorTones(K, R, r.pick(['sus2', 'add9', 'sev']), 55);
    arp(b, 'p2', t0 + 2, 2, 0.5, tones, [0, 1, 2, 1], 0.08, { duty: 2 }, 1);
  }
  if (kind === 'phrase') {
    fig = dropLast(fig, c.st.stage);
    c.st.remain = total - c.st.stage;
    const stage = c.st.stage++;
    b.fig('p1', 0, fig, K, 1, 0.38, { duty: 3, a: 0.04, ...KEEP }, 0.9);
    // The sea says the name again, softer, and it has lost one more note than the voice.
    b.fig('x', 8, dropLast(fig, 1), K, 1, 0.14, { ...KEEP, ratio: 2, rev: 1 }, 0.9);
    if (stage > 0) b.hit(0, 'hush', 0.12, 3, { a: 1 });
    return b.out({ tag: 'forget' + stage });
  }
  // On the blank pass only breath sits where the notes were. Then a new name is learned.
  let t = 0;
  for (const [d, l] of fig) { if (d !== null) b.hit(t, 'hush', 0.1, l * 0.9, { a: l * 0.4 }); t += l; }
  b.n('x', 8, K(6) + 12, 7, 0.08, { sus: 1, a: 2 });
  newName(c);
  c.st.remain = 99;
  return b.out({ tag: 'blank' });
}

export const reef: TrackDef = {
  slip: 0.05, bpm: 66, start: 'phrase', vary: 0.3, wrong: 0.03, echo: 0.55, wobble: 9, tint: 'sea', key: K_REEF, motifs: ['pilgrim'],
  next: (cur, c) => (cur === 'blank' ? 'phrase' : (c.st.remain ?? 1) <= 1 ? 'blank' : 'phrase'),
  secs: { phrase: (c) => reefSec(c, 'phrase'), blank: (c) => reefSec(c, 'blank') },
};

// ---------------------------------------------------------------- current

const K_CUR = key(52, MODE.mix);

function currentSec(c: Ctx): Section {
  const r = c.r, K = K_CUR, b = new B(16, 4, c.bpm);
  for (let i = 0; i < 4; i++) {
    const key = 'cell' + i;
    if (!c.mem[key]) {
      const w = walk(r, rhy(r, 4), [4, 5, 3, 2][i], [0, 2, 4], { lo: 1, hi: 8, rest: 0.05 });
      c.mem[key] = w.flatMap(([d, l]) => [d === null ? 99 : d, l]);
    }
  }
  // One note of one cell changes on every pass, so the phrases drift as the tempo does.
  const edit = c.mem['cell' + r.int(4)];
  const j = 2 * r.int(edit.length / 2);
  if (edit[j] !== 99) edit[j] = Math.max(0, Math.min(8, edit[j] + r.pick([-1, 1, 2])));
  const cells: Fig[] = [0, 1, 2, 3].map((i) => {
    const m = c.mem['cell' + i], f: Array<readonly [number | null, number]> = [];
    for (let k = 0; k < m.length; k += 2) f.push([m[k] === 99 ? null : m[k], m[k + 1]]);
    return f;
  });
  const reverse = r.chance(0.4);
  const order = reverse ? [3, 2, 1, 0] : [0, 1, 2, 3];
  b.mot('pilgrim');
  order.forEach((ix, i) => {
    const f = reverse && r.chance(0.5) ? retro(cells[ix]) : cells[ix];
    b.fig('p1', i * 4, f, K, 1, 0.34, { duty: 2, ...KEEP }, 0.9);
  });
  const roots = floatProg(r, 4, 0, 0.1);
  for (let i = 0; i < 4; i++) {
    const R = roots[i], tones = colorTones(K, R, 'sev', 52);
    arp(b, 'p2', i * 4, 4, 1, tones, [0, 1, 2, 1], 0.1, { duty: 2 }, 1);
  }
  // The bass runs three beats against the melody's four.
  for (let i = 0; i < 12; i++) b.n('tri', i * (16 / 12), fold(K(roots[Math.floor(i / 3)]), 33) + [0, 7, 12][i % 3], 1.2, 0.42);
  b.n('x', 0, K(roots[0] + 4) + 12, 15, 0.08, { sus: 1, a: 3 });
  if (r.chance(0.4)) chimes(b, c, K, 2 + r.int(10), 0.14, { oct: 1, echo: 2 });
  // The tempo wanders. Now and then it stalls for a beat and goes on.
  const prev = c.st.bpm ?? c.bpm;
  const next = Math.max(46, Math.min(116, prev + r.range(-16, 16)));
  c.st.bpm = next;
  const tempo: Array<[number, number]> = [[0, prev], [15.99, next]];
  if (r.chance(0.18)) {
    const at = 4 * (1 + r.int(3));
    tempo.push([at - 1, prev], [at, 22], [at + 0.5, next]);
    tempo.sort((x, y) => x[0] - y[0]);
  }
  return b.out({ tempo, tag: reverse ? 'reverse' : 'forward' });
}

export const current: TrackDef = {
  slip: 0.05, bendy: 0.1, bpm: 84, start: 'flow', vary: 0.4, wrong: 0.02, echo: 0.5, wobble: 12, tint: 'sea', key: K_CUR, motifs: ['pilgrim'],
  graph: { flow: [['flow', 1]] },
  secs: { flow: currentSec },
};

// ---------------------------------------------------------------- archive

const K_ARC = key(47, MODE.loc);

function archiveSec(c: Ctx, kind: 'form' | 'stamp' | 'file'): Section {
  const r = c.r, K = K_ARC, b = new B(16, 4, c.bpm);
  b.mot('keeper');
  const roots = r.pick([[0, 0, 1, 0], [0, 1, 0, 3], [0, 0, 3, 1]]);
  if (kind === 'form') {
    for (let line = 0; line < 3; line++) {
      const f = shift(KEEPER, r.pick([0, 0, 0, 1, -1]));
      const t0 = line * 5.5;
      const end = b.fig('p1', t0, f, K, 1, 0.34, { duty: 0, ...KEEP }, 0.6);
      let t = t0;
      for (const [d, l] of f) { if (d !== null) b.hit(t, 'type', 0.3, 0.04); t += l; }
      b.n('x', end - 0.4, K(0) + 36, 1.2, 0.12, { ratio: 4.13 });
    }
    // A cold pulse runs under the lines, so the carriage returns leave a gap in the tune and not in the floor.
    for (let i = 0; i < 8; i++) b.n('tri', i * 2, fold(K(i % 4 === 3 ? 1 : 0), 33), 0.4, 0.3);
    // A count of ticks: one more on every pass, up to eight, then back to one.
    const cnt = (c.pass % 8) + 1;
    for (let i = 0; i < cnt; i++) b.n('p2', 12 + i * 0.25, K(2) + 24, 0.1, 0.1, { duty: 0 });
  } else if (kind === 'stamp') {
    for (let i = 0; i < 4; i++) {
      const t0 = i * 4;
      b.hit(t0, 'stamp', 0.5, 0.2);
      if (i % 2) b.hit(t0 + 2, 'stamp', 0.35, 0.2);
      b.n('tri', t0, fold(K(roots[i]), 33), 3.8, 0.5);
      b.n('p2', t0, K(roots[i]) + 12, 3.8, 0.12, { duty: 0, a: 0.05 });
      b.n('p1', t0, K(roots[i] + 1) + 12, 3.8, 0.1, { duty: 0, a: 0.05 });
      if (r.chance(0.6)) b.n('x', t0 + r.pick([1, 2, 3]), K(r.pick([6, 4, 3])) + 12, 1, 0.08, { ratio: 4.13 });
      if (r.chance(0.4)) b.hit(t0 + r.pick([1, 3]), 'type', 0.2, 0.04);
    }
  } else {
    const line = r.pick([2, 4, 4, 5]), skip = r.pick([2, 3, 4]);
    for (let i = 0; i < 48; i++) {
      const t = i * 0.25;
      b.hit(t, 'type', 0.22, 0.04);
      if (i % skip !== skip - 1) b.n('p1', t, K(line) + 12 + (i % 8 === 7 ? r.pick([1, -1]) : 0), 0.2, 0.22, { duty: 0 });
    }
    b.n('x', 12, K(0) + 36, 2, 0.14, { ratio: 4.13 });
    b.hit(12, 'stamp', 0.5, 0.2);
    for (let i = 0; i < 4; i++) b.n('tri', i * 4, fold(K(roots[i]), 33), 1.6, 0.5);
  }
  for (let t = 0; t < 16; t++) if (t % 2 === 1 && kind !== 'file') b.hit(t, 'tick', 0.07, 0.03);
  return b.out();
}

export const archive: TrackDef = {
  level: 1.7, bpm: 100, start: 'form', vary: 0.3, wrong: 0.04, echo: 0.08, wobble: 2, tint: 'sea', key: K_ARC, motifs: ['keeper'],
  graph: { form: [['form', 2], ['stamp', 3], ['file', 2]], stamp: [['form', 3], ['file', 2]], file: [['form', 3], ['stamp', 1]] },
  secs: { form: (c) => archiveSec(c, 'form'), stamp: (c) => archiveSec(c, 'stamp'), file: (c) => archiveSec(c, 'file') },
};

