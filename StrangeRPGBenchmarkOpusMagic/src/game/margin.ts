// The Margin: Gloss's exercises. One sheet is cast once against figures drawn in pencil, and must do the whole job.
import { parse } from '../cant/parser';
import { BEvent, Battle, Body, makePage } from './battle';
import { FOES, FoeDef } from './enemies';

/** Pencil figures. They only exist in the Margin. */
const FIGURES: Record<string, FoeDef> = {
  m_post: { key: 'm_post', name: 'a post', hp: 12, armor: 0, xp: 0, sprite: 'straw', rote: '# drawn. stands.\nstand' },
  m_post9: { key: 'm_post9', name: 'a post', hp: 9, armor: 0, xp: 0, sprite: 'straw', rote: '# drawn smaller.\nstand' },
  m_post11: { key: 'm_post11', name: 'a post', hp: 11, armor: 0, xp: 0, sprite: 'straw', rote: '# drawn. stands.\nstand' },
  m_stub: { key: 'm_stub', name: 'a stub', hp: 6, armor: 0, xp: 0, sprite: 'straw', rote: '# half a post.\nstand' },
  m_sketch: { key: 'm_sketch', name: 'a sketch', hp: 6, armor: 0, xp: 0, sprite: 'chaff', rote: '# gloss drew this one.\n# gloss would like it back.\nstand' },
  m_biter: { key: 'm_biter', name: 'a biter', hp: 40, armor: 9, xp: 0, sprite: 'nip', target: 'wait', rote: '# all teeth. no body.\nbite foe\nwait' },
  m_plate: { key: 'm_plate', name: 'a plate', hp: 12, armor: 4, xp: 0, sprite: 'spoke', rote: '# drawn very hard.\nstand' },
  m_tell: { key: 'm_tell', name: 'a tell', hp: 10, armor: 0, xp: 0, sprite: 'nip', target: 'wait', rote: '# it shows you first.\nstand\nwait\nbite foe\nwait' },
  m_heavy: { key: 'm_heavy', name: 'heavy hands', hp: 15, armor: 9, power: 6, xp: 0, sprite: 'spoke', rote: '# hits very hard.\n# has never hit anything.\nstand\nwait' },
  m_mouth: { key: 'm_mouth', name: 'a mouth', hp: 40, armor: 9, xp: 0, sprite: 'nip', target: 'wait', rote: '# only bites.\nbite foe\nwait' },
  m_caret: { key: 'm_caret', name: 'a caret', hp: 40, armor: 0, xp: 0, sprite: 'caret', target: 'wait', rote: '# means: something goes in here.\ninto foe: halt\nwait' },
  m_note: { key: 'm_note', name: 'a note', hp: 30, armor: 9, xp: 0, sprite: 'loose', rote: '# beside you.\nstand' },
};
Object.assign(FOES, FIGURES);

export interface Run {
  ok: boolean;
  why: string;
  lines: number;
  ink: number;
  steps: number;
  rounds: number;
  events: BEvent[];
  says: string[];
}

interface Ctx { b: Battle; says: string[]; rounds: number }

export interface Problem {
  id: string;
  title: string;
  /** Words the problem needs. It appears once Wait can say all of them. */
  needs: string[];
  brief: string[];
  foes: string[];
  wait: { hp: number; ink: number; regen: number };
  /** Rounds the sheet gets. The run stops after the last one. */
  rounds: number;
  /** Returns null when the sheet did the job, or why it did not. */
  judge: (c: Ctx) => string | null;
  /** Gloss's own answer. The tests check it passes and scores what gloss says. */
  ref: string;
  gloss: { lines: number; ink: number; steps: number };
  /** Paid once, on the first pass. */
  blanks: number;
  /** Who left the problem. Room comments on its own problems instead of Gloss. */
  by?: 'room';
  /** Matching all of Gloss's scores on this problem also gives a mark. */
  mark?: boolean;
}

const fell = (c: Ctx) => (c.b.result === 'win' ? null : 'something is still standing');
const untouched = (c: Ctx) => (c.b.wait.hp === c.b.wait.max ? null : `wait took ${c.b.wait.max - c.b.wait.hp} harm`);
const both = (...js: ((c: Ctx) => string | null)[]) => (c: Ctx) => js.reduce<string | null>((r, j) => r ?? j(c), null);

export const PROBLEMS: Problem[] = [
  {
    id: 'post', title: 'a post', needs: ['strike', 'repeat'],
    brief: ['It stands.', 'Make it stop standing.'],
    foes: ['m_post'], wait: { hp: 20, ink: 8, regen: 3 }, rounds: 1, judge: fell,
    ref: 'repeat 4: strike foe', gloss: { lines: 1, ink: 4, steps: 5 }, blanks: 4,
  },
  {
    id: 'thrift', title: 'three a turn', needs: ['strike', 'repeat'],
    brief: ['Three ink, and three back each turn.', 'The post has twelve.'],
    foes: ['m_post'], wait: { hp: 20, ink: 3, regen: 3 }, rounds: 2, judge: fell,
    ref: 'repeat 3: strike foe\nwait\nstrike foe', gloss: { lines: 3, ink: 4, steps: 6 }, blanks: 6,
  },
  {
    id: 'keep', title: 'keep', needs: ['ward', 'repeat'],
    brief: ['It bites every turn. It cannot be hurt.', 'Four rounds. Lose nothing.'],
    foes: ['m_biter'], wait: { hp: 10, ink: 8, regen: 3 }, rounds: 4,
    judge: (c) => (c.b.wait.up && c.rounds >= 4 ? untouched(c) : 'wait did not last'),
    ref: 'repeat 4:\n  ward me\n  wait', gloss: { lines: 3, ink: 8, steps: 9 }, blanks: 6,
  },
  {
    id: 'wet', title: 'wet things', needs: ['soak', 'jolt', 'repeat'],
    brief: ['Drawn very hard. Strikes slide off.', 'One turn.'],
    foes: ['m_plate'], wait: { hp: 20, ink: 9, regen: 3 }, rounds: 1, judge: fell,
    ref: 'repeat 2:\n  soak foe\n  jolt foe', gloss: { lines: 3, ink: 6, steps: 5 }, blanks: 8,
  },
  {
    id: 'tell', title: 'the tell', needs: ['if', 'else', 'ward', 'strike', 'repeat'],
    brief: ['It shows you what it will do.', 'Fell it. Lose nothing.'],
    foes: ['m_tell'], wait: { hp: 10, ink: 8, regen: 3 }, rounds: 5, judge: both(fell, untouched),
    ref: 'repeat 3:\n  if foe.next == "bite":\n    ward me\n  else:\n    repeat 3: strike foe\n  wait',
    gloss: { lines: 6, ink: 8, steps: 16 }, blanks: 10, mark: true,
  },
  {
    id: 'barely', title: 'barely', needs: ['strike', 'jolt', 'repeat'],
    brief: ['Leave it standing.', 'Only just. One left.'],
    foes: ['m_post11'], wait: { hp: 20, ink: 8, regen: 3 }, rounds: 1,
    judge: (c) => { const f = c.b.foes[0]; return f.up && f.hp === 1 ? null : f.up ? `it has ${f.hp}` : 'it fell'; },
    ref: 'repeat 2: strike foe\nrepeat 2: jolt foe', gloss: { lines: 2, ink: 6, steps: 6 }, blanks: 8,
  },
  {
    id: 'row', title: 'in a row', needs: ['first', 'strike', 'repeat'],
    brief: ['Three stubs. One turn.'],
    foes: ['m_stub', 'm_stub', 'm_stub'], wait: { hp: 20, ink: 12, regen: 3 }, rounds: 1, judge: fell,
    ref: 'repeat 6: strike first(foes)', gloss: { lines: 1, ink: 6, steps: 7 }, blanks: 10,
  },
  {
    id: 'spare', title: 'spare the middle', needs: ['first', 'last', 'strike', 'repeat'],
    brief: ['Gloss drew the one in the middle.', 'Fell the others.'],
    foes: ['m_stub', 'm_sketch', 'm_stub'], wait: { hp: 20, ink: 8, regen: 3 }, rounds: 1,
    judge: (c) => {
      const [a, m, z] = c.b.foes;
      if (!m.up || m.hp < m.max) return 'you hurt the sketch';
      return a.up || z.up ? 'a stub is still standing' : null;
    },
    ref: 'repeat 2: strike first(foes)\nrepeat 2: strike last(foes)', gloss: { lines: 2, ink: 4, steps: 6 }, blanks: 10,
  },
  {
    id: 'count', title: 'count', needs: ['let', 'say', 'repeat'],
    brief: ['Say one to five.', 'Say nothing else.'],
    foes: ['m_post'], wait: { hp: 20, ink: 8, regen: 3 }, rounds: 5,
    judge: (c) => (c.says.join(' ') === '1 2 3 4 5' ? null : c.says.length ? `you said ${c.says.slice(0, 6).join(' ')}` : 'you said nothing'),
    ref: 'let n = 1\nrepeat 5:\n  say n\n  let n = n + 1', gloss: { lines: 4, ink: 0, steps: 12 }, blanks: 10, mark: true,
  },
  {
    id: 'dry', title: 'dry', needs: ['listen', 'strike', 'repeat'],
    brief: ['No ink. None comes back.', 'Fell it anyway.'],
    foes: ['m_post9'], wait: { hp: 20, ink: 0, regen: 0 }, rounds: 3, judge: fell,
    ref: 'repeat 2:\n  listen\n  repeat 2: strike foe', gloss: { lines: 3, ink: 4, steps: 9 }, blanks: 12,
  },
  {
    id: 'quiet', title: 'take a line', needs: ['erase'],
    brief: ['It bites. Nothing hurts it.', 'Five ink, and no more.', 'Make it stop. Lose nothing.'],
    foes: ['m_biter'], wait: { hp: 10, ink: 5, regen: 0 }, rounds: 4, judge: both(fell, untouched),
    ref: 'erase foe', gloss: { lines: 1, ink: 5, steps: 1 }, blanks: 14, mark: true,
  },
  // Act 2. Room left these in the margin, under Gloss's.
  {
    id: 'heavy', title: 'heavy hands', needs: ['into', 'jolt'], by: 'room',
    brief: ['It hits very hard. It never hits anything.', 'Can it hit itself?', 'Ten ink.'],
    foes: ['m_heavy'], wait: { hp: 20, ink: 10, regen: 0 }, rounds: 2, judge: fell,
    ref: 'into foe: jolt me\ninto foe: jolt me', gloss: { lines: 2, ink: 10, steps: 2 }, blanks: 18,
  },
  {
    id: 'hush', title: 'a mouth', needs: ['into', 'ward'], by: 'room',
    brief: ['It only bites. Nothing hurts it.', 'A margin needs a turn to clear. Two rounds.', 'Lose nothing.'],
    foes: ['m_mouth'], wait: { hp: 10, ink: 6, regen: 0 }, rounds: 2,
    judge: (c) => (c.b.wait.up && c.rounds >= 2 ? untouched(c) : 'wait did not last'),
    ref: 'into foe: wait\nwait\nward me', gloss: { lines: 3, ink: 5, steps: 3 }, blanks: 18, mark: true,
  },
  {
    id: 'dent', title: 'a caret', needs: ['when', 'stet', 'into'], by: 'room',
    brief: ['It writes halt into me every round.', 'How do I keep going?', 'Strike it four times.'],
    foes: ['m_caret'], wait: { hp: 20, ink: 12, regen: 0 }, rounds: 4,
    judge: (c) => (c.b.foes[0].max - c.b.foes[0].hp >= 12 ? null : `it took ${c.b.foes[0].max - c.b.foes[0].hp} harm`),
    ref: 'when written: stet who\nrepeat 4:\n  strike foe\n  wait', gloss: { lines: 4, ink: 12, steps: 14 }, blanks: 18,
  },
  {
    id: 'aside', title: 'beside you', needs: ['into', 'say'],
    brief: ['The last sheet in the margin. It is in my hand.', 'Say what I wrote beside you.'],
    foes: ['m_note'], wait: { hp: 20, ink: 8, regen: 3 }, rounds: 1,
    judge: (c) => (c.says.join(' ') === 'until' ? null : c.says.length ? `you said ${c.says.join(' ')}` : 'you said nothing'),
    ref: 'say "until"', gloss: { lines: 1, ink: 0, steps: 1 }, blanks: 20, mark: true,
  },
];

/** Counts the ink Wait spent from the ink events: every drop is a payment. */
function inkSpent(events: BEvent[], start: number): number {
  let cur = start, spent = 0;
  for (const e of events) if (e.t === 'ink') { if (e.ink < cur) spent += cur - e.ink; cur = e.ink; }
  return spent;
}

/** Casts the sheet once and lets it run for the problem's rounds. */
export function runSheet(p: Problem, src: string, canSay: (w: string) => boolean): Run {
  const prog = parse(src);
  const lines = prog.codeLines;
  const blank: Run = { ok: false, why: '', lines, ink: 0, steps: 0, rounds: 0, events: [], says: [] };
  if (prog.diags.some((d) => d.sev === 'error')) return { ...blank, why: 'the sheet has red lines' };
  const page = makePage('sheet', src);
  const b = new Battle({
    enc: `foe:${p.foes.join(',')}`,
    wait: { hp: p.wait.hp, max: p.wait.hp, ink: p.wait.ink, maxInk: Math.max(p.wait.ink, 12), regen: p.wait.regen, hands: 1, ticks: 30 },
    allies: [], pages: [page], canSay, lent: {}, items: {}, seed: 11, stopAfter: p.rounds,
  });
  const events: BEvent[] = [...b.start()];
  const target: Body | undefined = b.livingFoes()[0];
  events.push(...b.act({ kind: 'cast', page: 0, target: target?.id ?? '' }));
  while (b.phase === 'command') events.push(...b.act({ kind: 'pass' }));
  const rounds = b.round;
  const waitId = b.wait.id;
  const says = events.filter((e): e is Extract<BEvent, { t: 'say' }> => e.t === 'say' && e.who === waitId).map((e) => e.text);
  const steps = events.filter((e) => e.t === 'line' && e.who === waitId).length;
  const ink = inkSpent(events, p.wait.ink);
  const why = p.judge({ b, says, rounds });
  return { ok: why === null, why: why ?? '', lines, ink, steps, rounds, events, says };
}

export function visible(p: Problem, canSay: (w: string) => boolean): boolean {
  return p.needs.every(canSay);
}

/** Which of Gloss's scores a run matches or beats: lines, ink, steps. */
export function meetsGloss(p: Problem, r: { lines: number; ink: number; steps: number }): [boolean, boolean, boolean] {
  return [r.lines <= p.gloss.lines, r.ink <= p.gloss.ink, r.steps <= p.gloss.steps];
}
