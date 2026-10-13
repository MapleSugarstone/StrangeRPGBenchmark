// The endings and the credits.
import { B, KEEP, MODE, aug, colorTones, fold, key, padTo, shift } from './lib';
import type { Ctx, Key, MotifName, Section, TrackDef } from './lib';
import { LIGHTBOUND, PILGRIM_HEAD, PILGRIM_RESOLVED, SEER, YEAR_BASS, YEAR_LEAD } from './motifs';
import { arp, bassLine, chimes } from './kit';
import { motifBlock } from './blocks';

// ---------------------------------------------------------------- end_restore

const K_REST = key(53, MODE.ion);

function restoreSec(c: Ctx, kind: 'letter' | 'kitchen' | 'rest'): Section {
  const r = c.r, K = K_REST, b = new B(kind === 'rest' ? 16 : 24, 4, c.bpm);
  b.mot('seer', 'lightbound');
  const bars = b.beats / 4;
  // Restoration is the one ending that cadences: the last bar of every section lands on the tonic.
  const base = kind === 'rest' ? [0, 5, 3, 0] : [0, 5, 3, 4, 1, 4];
  const roots = base.slice(0, bars);
  if (kind !== 'rest') roots[bars - 1] = 0;
  for (let i = 0; i < bars; i++) {
    const t0 = i * 4, R = roots[i];
    bassLine(b, 'tri', t0, [[0, 2], [4, 2]], K, R, 36, 0.45, { a: 0.1 }, 0.95);
    const ch = colorTones(K, R, i === bars - 1 ? 'tri' : r.pick(['tri', 'add9']), 57);
    arp(b, 'p2', t0, 4, 0.5, ch, [0, 1, 2, 1, 2, 1, 0, 1], 0.07, { duty: 3, a: 0.05 }, 1.2);
    b.n('x', t0, ch[1] + 12, 3.9, 0.08, { sus: 1, a: 0.8, ratio: 1 });
  }
  if (kind === 'letter') {
    b.fig('p1', 0, padTo(SEER, 4), K, 0, 0.3, { duty: 3, a: 0.06, ...KEEP }, 0.97);
    b.fig('x', 12, aug(LIGHTBOUND, 2), K, 1, 0.14, { ...KEEP, ratio: 3.5 }, 0.9);
  } else if (kind === 'kitchen') {
    b.fig('p1', 0, aug(LIGHTBOUND, 2), K, 0, 0.28, { duty: 3, a: 0.04, ...KEEP }, 0.85);
    b.fig('x', 12, padTo(SEER, 4), K, 1, 0.14, { ...KEEP, ratio: 2 }, 0.9);
  } else {
    b.fig('x', 2, SEER.slice(0, 4), K, 1, 0.14, { ...KEEP, ratio: 3.5 }, 0.9);
    b.n('x', 8, K(0) + 12, 8, 0.12, { sus: 1, a: 2 });
  }
  return b.out();
}

export const endRestore: TrackDef = {
  swing: 0.03, stumble: 0.02, bendy: 0.1, bpm: 60, start: 'letter', vary: 0.3, wrong: 0.02, echo: 0.5, wobble: 5, tint: 'sea', key: K_REST, motifs: ['seer', 'lightbound'],
  graph: { letter: [['kitchen', 3], ['rest', 1]], kitchen: [['letter', 2], ['rest', 2]], rest: [['letter', 3], ['kitchen', 1]] },
  secs: { letter: (c) => restoreSec(c, 'letter'), kitchen: (c) => restoreSec(c, 'kitchen'), rest: (c) => restoreSec(c, 'rest') },
};

// ---------------------------------------------------------------- end_accept

const K_ACC = key(50, MODE.dor);
const SWALLOWED: MotifName[] = ['pilgrim', 'unravel', 'year', 'stone', 'lightbound', 'void'];
const K_BY: Record<string, Key> = {
  pilgrim: key(57, MODE.aeo), unravel: key(55, MODE.mix), year: key(57, MODE.aeo), stone: key(61, MODE.lyd), lightbound: key(60, MODE.ion), void: key(38, MODE.phr),
};

function acceptSec(c: Ctx, kind: 'swallow' | 'choice'): Section {
  const r = c.r;
  if (kind === 'choice') {
    const K = key(38, MODE.aeo);
    const b = motifBlock('choice', c, K, { beats: 24, g: 1 });
    chimes(b, c, K, 6 + r.int(6), 0.16, { oct: 1, stretch: r.range(1.8, 2.8), echo: r.pick([4, 6]), max: 5 });
    return b.out({ tag: 'choice' });
  }
  const stage = c.st.stage ?? 0;
  c.st.stage = stage + 1;
  const name = SWALLOWED[Math.min(stage, SWALLOWED.length - 1)];
  const b = motifBlock(name, c, K_BY[name], { g: Math.max(0.45, 1 - stage * 0.12), corrupt: 1 });
  const sec = b.out({ tag: 'swallow' + stage });
  // The Void takes the music a piece at a time: notes drop out, tune sinks, and the tempo falls.
  const loss = stage * 0.1;
  sec.ev = sec.ev.filter((e) => e.v === 'tri' || !r.chance(loss)).map((e) => (e.v === 'nz' ? e : { ...e, det: (e.det ?? 0) - stage * 22 }));
  // The bass goes first and the Void's drone takes over where it stops.
  const gone = 16 * (1 - stage * 0.17);
  sec.ev = sec.ev.filter((x) => x.v !== 'tri' || x.t < gone);
  if (stage > 0) {
    const hb = new B(16, 4, c.bpm);
    hb.n('tri', gone, 26 + stage, 16 - gone, Math.min(0.7, 0.3 + stage * 0.07), { a: 1.5 });
    hb.hit(gone, 'rumble', Math.min(0.4, 0.1 + stage * 0.06), 16 - gone, { a: 2 });
    hb.n('x', Math.min(gone, 14), 38 + stage * 0.5, 12, 0.06 + stage * 0.012, { sus: 1, a: 3 });
    sec.ev.push(...hb.ev);
  }
  sec.motifs = [...(sec.motifs ?? []), 'void'];
  const b0 = c.bpm * Math.pow(0.9, stage);
  sec.tempo = [[0, b0], [16, b0 * 0.9]];
  return sec;
}

export const endAccept: TrackDef = {
  slip: 0.1, bpm: 100, start: 'swallow', vary: 0.1, wrong: 0.0, echo: 0.7, wobble: 12, tint: 'void', key: K_ACC, motifs: ['pilgrim', 'unravel', 'year', 'stone', 'lightbound', 'void', 'choice'],
  next: (cur, c) => (cur === 'choice' || (c.st.stage ?? 0) >= SWALLOWED.length ? 'choice' : 'swallow'),
  secs: { swallow: (c) => acceptSec(c, 'swallow'), choice: (c) => acceptSec(c, 'choice') },
};

// ---------------------------------------------------------------- end_escape

const K_EE = key(57, MODE.dor);

function escapeEndSec(c: Ctx, kind: 'alone' | 'quiet'): Section {
  const r = c.r, K = K_EE, b = new B(16, 4, c.bpm);
  b.mot('year');
  const roots = [0, 5, 2, 6];
  const company = Math.max(0, 0.85 - c.pass * 0.14);
  if (kind === 'alone') {
    b.fig('p1', r.pick([0, 0, 1]), shift(YEAR_LEAD, r.pick([1, 1, 0, 2])), K, 1, 0.3, { duty: 1, ...KEEP }, 0.95);
    if (c.pass % 3 !== 2) b.fig('p1', 8 + r.pick([0, 0, 1, 2]), shift(YEAR_LEAD, r.pick([0, -1, 1])), K, 1, 0.28, { duty: 1, ...KEEP }, 0.95);
  } else {
    b.fig('x', 2, YEAR_LEAD.slice(0, 4), K, 1, 0.14, { ...KEEP }, 0.9);
  }
  for (let i = 0; i < 4; i++) {
    if (r.chance(company)) bassLine(b, 'tri', i * 4, YEAR_BASS, K, roots[i], 33, 0.4 * company + 0.1, { det: -c.pass * 3 }, 0.8);
  }
  if (r.chance(company)) b.n('x', 0, K(4) + 12, 15, 0.07, { sus: 1, a: 3 });
  return b.out();
}

export const endEscape: TrackDef = {
  slip: 0.05, bendy: 0.1, level: 1.2, bpm: 92, start: 'alone', vary: 0.3, wrong: 0.03, echo: 0.55, wobble: 10, tint: 'year', key: K_EE, motifs: ['year'],
  graph: { alone: [['alone', 3], ['quiet', 1]], quiet: [['alone', 3]] },
  secs: { alone: (c) => escapeEndSec(c, 'alone'), quiet: (c) => escapeEndSec(c, 'quiet') },
};

// ---------------------------------------------------------------- credits

const CREDIT_ORDER: MotifName[] = ['pilgrim', 'unravel', 'void', 'stone', 'year', 'lightbound', 'vorn', 'keeper', 'seer', 'choice'];
const K_CRED: Record<MotifName, Key> = {
  pilgrim: key(57, MODE.aeo), unravel: key(55, MODE.mix), void: key(38, MODE.phr), stone: key(61, MODE.lyd), year: key(57, MODE.aeo),
  lightbound: key(60, MODE.ion), vorn: key(50, MODE.dor), keeper: key(47, MODE.loc), seer: key(53, MODE.ion), choice: key(38, MODE.aeo),
};
const K_FIN = key(57, MODE.aeo);

function creditsSec(c: Ctx, name: string): Section {
  const r = c.r;
  if (name === 'finale') {
    // The Pilgrim's figure reaches the tonic for the first time and the harmony settles on it.
    const b = new B(24, 4, c.bpm);
    b.mot('pilgrim', 'choice');
    b.fig('p1', 0, PILGRIM_RESOLVED, K_FIN, 1, 0.42, { duty: 3, a: 0.05, ...KEEP }, 0.98);
    b.fig('x', 2, PILGRIM_RESOLVED, K_FIN, 0, 0.14, { ...KEEP, ratio: 2 }, 0.98);
    const chords: Array<[number, number]> = [[0, 0], [4, 5], [8, 3], [12, 4]];
    for (const [t0, R] of chords) {
      b.n('tri', t0, fold(K_FIN(R), 33), 3.9, 0.5, { a: 0.3 });
      arp(b, 'p2', t0, 4, 0.5, colorTones(K_FIN, R, 'tri', 57), [0, 1, 2, 1], 0.08, { duty: 3 }, 1.2);
    }
    b.n('tri', 16, 33, 8, 0.55, { a: 0.5 });
    b.n('p2', 16, 57, 8, 0.1, { duty: 3, a: 0.4 });
    b.n('x', 16, 64, 8, 0.12, { sus: 1, a: 1 });
    b.n('x', 16, 69, 8, 0.1, { sus: 1, a: 1.4 });
    return b.out();
  }
  if (name === 'outro') {
    const b = new B(24, 4, c.bpm);
    b.mot('choice');
    b.n('tri', 0, 33, 24, 0.4, { a: 4 });
    b.n('x', 4, 57 + 12, 14, 0.07, { sus: 1, a: 4 });
    chimes(b, c, K_FIN, 6 + r.int(8), 0.14, { oct: 1, stretch: r.range(1.8, 2.8), echo: r.pick([4, 6]), max: 5 });
    if (r.chance(0.4)) b.fig('x', 14 + r.int(4), PILGRIM_HEAD, K_FIN, 1, 0.09, { ...KEEP }, 0.95);
    return b.out();
  }
  const m = name as MotifName;
  const b = motifBlock(m, c, K_CRED[m], { drums: 0, g: 0.9 });
  return b.out({ tag: name });
}

const CREDIT_SECS: Record<string, (c: Ctx) => Section> = { finale: (c) => creditsSec(c, 'finale'), outro: (c) => creditsSec(c, 'outro') };
for (const m of CREDIT_ORDER) CREDIT_SECS[m] = (c) => creditsSec(c, m);

export const credits: TrackDef = {
  slip: 0.03, bendy: 0.08, level: 1.2, bpm: 72, start: 'pilgrim', vary: 0.4, wrong: 0.02, echo: 0.5, wobble: 7, tint: 'sea', key: K_FIN,
  motifs: [...CREDIT_ORDER],
  next: (cur) => {
    if (cur === 'outro') return 'outro';
    if (cur === 'finale') return 'outro';
    const i = CREDIT_ORDER.indexOf(cur as MotifName);
    return i >= CREDIT_ORDER.length - 1 ? 'finale' : CREDIT_ORDER[i + 1];
  },
  secs: CREDIT_SECS,
};

