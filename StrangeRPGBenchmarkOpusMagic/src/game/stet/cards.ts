// Stet cards and their words. Pure data: no scene, save, or browser code.
import { FOES } from '../enemies';

export type Word = 'ward' | 'soak' | 'halt' | 'copy' | 'strike' | 'mend' | 'each' | 'when' | 'wait' | 'again';

export interface WordDef {
  id: Word;
  text: string;
  color: number;
  /** Semitones above A3, the pitch the word plays when it acts. */
  pitch: number;
  /** Edge points a card gives up for carrying the word. */
  cost: number;
  /** The word asks for one adjacent card when placed. */
  target?: boolean;
}

export const WORDS: Record<Word, WordDef> = {
  ward: { id: 'ward', cost: 2, color: 0x9ab8ff, pitch: 4, text: 'The other side cannot flip it on its next turn.' },
  soak: { id: 'soak', cost: 3, color: 0x3fa0ff, pitch: 2, text: 'Edges of the other side that face it are 1 lower.' },
  halt: { id: 'halt', cost: 2, color: 0xff5a4a, pitch: -3, target: true, text: 'When placed, halts a card next to it. That card never flips.' },
  copy: { id: 'copy', cost: 3, color: 0xd8d0ff, pitch: 21, target: true, text: 'When placed, its lowest edge rises to the highest edge of a card next to it.' },
  strike: { id: 'strike', cost: 2, color: 0xe6d8bc, pitch: 0, text: 'Its edges count 1 higher on the turn it is placed.' },
  mend: { id: 'mend', cost: 2, color: 0x8fe08a, pitch: 7, text: 'When placed, your cards next to it gain 1 on every edge.' },
  each: { id: 'each', cost: 1, color: 0x5ad8a0, pitch: 13, text: 'If it flips two or more, it flips one more next to it.' },
  when: { id: 'when', cost: 2, color: 0xe07aa0, pitch: 16, text: 'At the end it counts twice, for whichever side has it.' },
  wait: { id: 'wait', cost: 1, color: 0xf2d25a, pitch: -12, text: 'One full turn after it is placed, its edges rise by 1.' },
  again: { id: 'again', cost: 2, color: 0xc8ff2e, pitch: 24, text: 'When flipped, it flips back on your next turn. Once.' },
};

export const WORD_IDS = Object.keys(WORDS) as Word[];

/** Edge total for each tier, before the word's cost. */
export const TIER_SUM = [0, 15, 18, 21, 24, 29];

export interface CardDef {
  id: string;
  name: string;
  /** Sprite key, drawn at 1x. */
  art: string;
  tier: number;
  word: Word | null;
  /** Top, right, bottom, left. */
  edges: number[];
  /** The Scrivener's aside about the creature. */
  flavor: string;
  /** The chapter the card first turns up in. */
  ch: number;
  copied?: boolean;
  secret?: boolean;
  /** The card is the page of a foe. */
  foe?: boolean;
}

interface Spec {
  id: string;
  tier: number;
  word: Word | null;
  shape: number[];
  ch: number;
  name?: string;
  art?: string;
  flavor?: string;
  secret?: boolean;
  copied?: boolean;
}

const SPECS: Spec[] = [
  // Foes, one card each. Name, art, and aside come from the foe.
  { id: 'straw', tier: 1, word: null, shape: [1, 1, 1, 1], ch: 1 },
  { id: 'nip', tier: 1, word: null, shape: [2, 3, 1, 1], ch: 1 },
  { id: 'chaff', tier: 1, word: 'ward', shape: [1, 2, 1, 2], ch: 1 },
  { id: 'spoke', tier: 2, word: 'strike', shape: [3, 1, 3, 1], ch: 1 },
  { id: 'copynip', tier: 1, word: null, shape: [3, 2, 1, 1], ch: 1 },
  { id: 'grind', tier: 3, word: null, shape: [2, 3, 1, 3], ch: 1 },
  { id: 'fisher', tier: 2, word: 'soak', shape: [2, 1, 1, 3], ch: 2 },
  { id: 'lull', tier: 2, word: 'soak', shape: [1, 3, 3, 2], ch: 2 },
  { id: 'tock', tier: 2, word: 'wait', shape: [3, 2, 2, 1], ch: 2 },
  { id: 'grit', tier: 2, word: 'strike', shape: [1, 2, 4, 2], ch: 2 },
  { id: 'hold', tier: 4, word: 'halt', shape: [2, 2, 2, 2], ch: 2 },
  { id: 'clerk', tier: 2, word: null, shape: [3, 2, 1, 2], ch: 3 },
  { id: 'vatling', tier: 2, word: 'mend', shape: [1, 3, 2, 1], ch: 3 },
  { id: 'split', tier: 3, word: 'each', shape: [1, 3, 1, 3], ch: 3 },
  { id: 'presshand', tier: 3, word: null, shape: [1, 2, 4, 2], ch: 3 },
  { id: 'manycopy', tier: 2, word: 'strike', shape: [3, 1, 1, 2], ch: 3 },
  { id: 'many', tier: 4, word: 'strike', shape: [3, 3, 1, 2], ch: 3 },
  { id: 'flinch', tier: 3, word: 'strike', shape: [2, 3, 1, 3], ch: 4 },
  { id: 'ringer', tier: 3, word: 'copy', shape: [3, 2, 2, 1], ch: 4 },
  { id: 'dish', tier: 3, word: 'mend', shape: [3, 2, 1, 2], ch: 4 },
  { id: 'static', tier: 3, word: null, shape: [2, 3, 2, 2], ch: 4 },
  { id: 'relay', tier: 5, word: 'copy', shape: [4, 3, 1, 3], ch: 4 },
  { id: 'drift', tier: 3, word: 'strike', shape: [1, 3, 2, 3], ch: 5 },
  { id: 'sentry', tier: 4, word: 'when', shape: [3, 2, 3, 2], ch: 5 },
  { id: 'waitcopy', tier: 3, word: 'wait', shape: [2, 1, 2, 3], ch: 5 },
  { id: 'arm', tier: 5, word: null, shape: [4, 1, 2, 4], ch: 5 },
  { id: 'loopling', tier: 3, word: 'again', shape: [3, 2, 1, 2], ch: 6 },
  { id: 'csweep', tier: 4, word: null, shape: [1, 2, 3, 2], ch: 6 },
  { id: 'ccount', tier: 4, word: null, shape: [3, 3, 2, 1], ch: 6 },
  { id: 'cstack', tier: 4, word: 'ward', shape: [3, 1, 3, 1], ch: 6 },
  { id: 'cpour', tier: 4, word: 'soak', shape: [2, 2, 3, 2], ch: 6 },
  { id: 'cmind', tier: 4, word: null, shape: [1, 3, 4, 2], ch: 6 },
  { id: 'again', tier: 5, word: 'again', shape: [3, 3, 3, 3], ch: 6, secret: true },
  { id: 'tidy', tier: 2, word: 'halt', shape: [2, 1, 2, 3], ch: 7 },
  { id: 'blot', tier: 2, word: 'soak', shape: [2, 2, 2, 1], ch: 7 },
  { id: 'closer', tier: 4, word: 'halt', shape: [3, 3, 1, 2], ch: 7 },
  { id: 'stopper', tier: 3, word: 'ward', shape: [1, 3, 3, 1], ch: 8 },
  { id: 'footnote', tier: 2, word: 'mend', shape: [1, 2, 2, 3], ch: 8 },
  { id: 'proof', tier: 3, word: 'copy', shape: [2, 3, 2, 1], ch: 8 },
  { id: 'corrector', tier: 4, word: 'copy', shape: [3, 1, 3, 2], ch: 8 },
  { id: 'loose', tier: 3, word: 'wait', shape: [1, 2, 3, 2], ch: 9 },
  { id: 'caret', tier: 3, word: 'halt', shape: [3, 1, 2, 2], ch: 9 },
  { id: 'dele', tier: 3, word: 'ward', shape: [2, 2, 1, 3], ch: 9 },
  { id: 'firstline', tier: 4, word: 'mend', shape: [3, 2, 2, 2], ch: 9 },
  { id: 'over', tier: 5, word: 'strike', shape: [4, 2, 1, 3], ch: 9 },
  { id: 'filer', tier: 4, word: 'halt', shape: [2, 3, 2, 2], ch: 10 },
  { id: 'quillmite', tier: 3, word: 'strike', shape: [3, 1, 1, 3], ch: 10 },

  // The cast and the townsfolk.
  { id: 'wait', name: 'Wait', tier: 1, word: 'wait', shape: [2, 1, 1, 2], ch: 1, flavor: 'until' },
  { id: 'halt', name: 'Halt', tier: 3, word: 'halt', shape: [3, 2, 1, 2], ch: 1, flavor: 'a gate. stops what leaves.' },
  { id: 'each', name: 'Each', tier: 3, word: 'each', shape: [1, 2, 1, 2], ch: 3, flavor: 'seven. they count differently.' },
  { id: 'when', name: 'When', tier: 3, word: 'when', shape: [2, 2, 2, 1], ch: 4, flavor: 'when wait comes, go with wait.' },
  { id: 'sweep', name: 'Sweep', tier: 2, word: null, shape: [1, 2, 3, 2], ch: 1, flavor: 'goes around things.' },
  { id: 'count', name: 'Count', tier: 2, word: 'each', shape: [2, 3, 2, 1], ch: 1, flavor: 'counts what happens at once.' },
  { id: 'stack', name: 'Stack', tier: 2, word: 'ward', shape: [3, 1, 2, 1], ch: 1, flavor: 'sets things down. they stay.' },
  { id: 'mind', name: 'Mind', tier: 3, word: 'mend', shape: [1, 2, 4, 2], ch: 6, flavor: 'keeps the ones with nothing written.' },
  { id: 'reel', name: 'Reel', tier: 2, word: 'again', shape: [1, 2, 2, 3], ch: 2, flavor: 'sits by the river. pulls.' },
  { id: 'tally', name: 'Tally', tier: 3, word: 'wait', shape: [2, 3, 1, 2], ch: 2, flavor: 'a dial. counts the seconds out.' },
  { id: 'weigh', name: 'Weigh', tier: 3, word: null, shape: [1, 3, 2, 3], ch: 3, flavor: 'weighs pages. fair to the grain.' },
  { id: 'listener', name: 'Listener', tier: 3, word: 'again', shape: [3, 1, 2, 1], ch: 4, flavor: 'faces up. hears me write.' },
  { id: 'heed', name: 'Heed', tier: 4, word: 'when', shape: [3, 2, 2, 2], ch: 4, flavor: 'tall. hears first.' },
  { id: 'keep', name: 'Keep', tier: 4, word: 'halt', shape: [1, 3, 2, 3], ch: 5, flavor: 'keeps the rung for whoever comes back.' },
  { id: 'gloss', name: 'Gloss', tier: 5, word: 'copy', shape: [4, 2, 3, 2], ch: 5, secret: true, flavor: 'a note on my notes. it went down to look.' },
  { id: 'room', name: 'Room', tier: 2, word: 'copy', shape: [2, 2, 1, 2], ch: 7, flavor: 'one line and then room.' },
  { id: 'every', name: 'Every', tier: 4, word: 'each', shape: [2, 2, 2, 2], ch: 8, flavor: 'one. was seven.' },
  { id: 'stet', name: 'Stet', tier: 5, word: 'ward', shape: [3, 2, 3, 3], ch: 8, flavor: 'let it stand.' },
  { id: 'once', name: 'Once', tier: 5, word: null, shape: [3, 3, 3, 3], ch: 6, secret: true, flavor: 'one time.' },
  { id: 'scrivener', name: 'the Scrivener', art: 'scrivener', tier: 5, word: 'when', shape: [3, 2, 3, 2], ch: 6, secret: true, flavor: 'nobody wrote this one.' },
];

/** Splits a total across four edges in proportion to a shape, each edge 1 to 9. */
export function shapeEdges(shape: number[], total: number): number[] {
  const t = Math.max(4, Math.min(36, total));
  const sum = shape.reduce((a, b) => a + b, 0);
  const ideal = shape.map((s) => (s * t) / sum);
  const e = ideal.map((v) => Math.max(1, Math.min(9, Math.floor(v))));
  let diff = t - e.reduce((a, b) => a + b, 0);
  while (diff !== 0) {
    let best = -1;
    let bestV = 0;
    for (let i = 0; i < 4; i++) {
      if (diff > 0 && e[i] >= 9) continue;
      if (diff < 0 && e[i] <= 1) continue;
      const v = diff > 0 ? ideal[i] - e[i] : e[i] - ideal[i];
      if (best < 0 || v > bestV) { best = i; bestV = v; }
    }
    if (best < 0) break;
    e[best] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  return e;
}

/** The text after the first # in a rote's first line. */
function asideOf(rote: string): string {
  const first = rote.split('\n')[0] ?? '';
  const i = first.indexOf('#');
  return i < 0 ? '' : first.slice(i + 1).trim();
}

export function cardTotal(tier: number, word: Word | null): number {
  return TIER_SUM[tier] - (word ? WORDS[word].cost : 0);
}

function build(): Record<string, CardDef> {
  const out: Record<string, CardDef> = {};
  for (const s of SPECS) {
    const foe = FOES[s.id];
    const fromFoe = !s.name && !!foe;
    out[s.id] = {
      id: s.id,
      name: s.name ?? foe?.name ?? s.id,
      art: s.art ?? (fromFoe ? foe.sprite : s.id),
      tier: s.tier,
      word: s.word,
      edges: shapeEdges(s.shape, cardTotal(s.tier, s.word)),
      flavor: s.flavor ?? (foe ? asideOf(foe.rote) : ''),
      ch: s.ch,
      copied: s.copied ?? (fromFoe ? !!foe.copied : false),
      secret: s.secret,
      foe: fromFoe,
    };
  }
  return out;
}

export const CARDS: Record<string, CardDef> = build();

/** Rebuilds every card's edges after a change to word costs or tier totals (for the balance tool). */
export function rebuildEdges() {
  for (const s of SPECS) CARDS[s.id].edges = shapeEdges(s.shape, cardTotal(s.tier, s.word));
}

export const CARD_IDS = SPECS.map((s) => s.id);

export function cardSum(id: string): number {
  const c = CARDS[id];
  return c ? c.edges.reduce((a, b) => a + b, 0) : 0;
}

/** A rough worth for sorting and for the AI's choice of stakes: tier first, then edge total. */
export function cardWorth(id: string): number {
  const c = CARDS[id];
  return c ? c.tier * 100 + cardSum(id) : 0;
}
