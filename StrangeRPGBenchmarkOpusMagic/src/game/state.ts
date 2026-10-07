// The saved game, the numbers derived from it, and Wait's vocabulary.
import { VERBS } from '../cant/vocab';
import { parse } from '../cant/parser';
import { ALLIES, FOES } from './enemies';
import { GNODE, Stat } from './grammar';
import { BattlePage, BattleSetup, PageStats, makePage } from './battle';

export interface PageData { id: string; name: string; src: string; color: number; fixed?: boolean; stats: PageStats }
export interface LibEntry { key: string; name: string; src: string; from: string }

export interface SaveData {
  v: 1;
  chapter: number;
  map: string;
  x: number;
  y: number;
  dir: number;
  flags: Record<string, boolean>;
  level: number;
  xp: number;
  hp: number;
  ink: number;
  marks: number;
  party: string[];
  allyHp: Record<string, number>;
  words: string[];
  grammar: string[];
  pages: PageData[];
  library: LibEntry[];
  items: Record<string, number>;
  primers: string[];
  seen: string[];
  usedAgain: boolean;
  childLine: string | null;
  time: number;
  done: string[];
  aside: string;
  /** Currency: blank pages. */
  blanks: number;
  /** Seals owned, by id, and the seal set on each page, by page id. */
  seals: Record<string, number>;
  pageSeals: Record<string, string>;
  /** The ink Wait writes with, and the inks Wait has found. */
  inkType: string;
  inks: string[];
  stet: StetSave;
  /** Catches from Reeling, by catch id. */
  fish: Record<string, number>;
  /** Best results on the Margin problems, by problem id. */
  margin: Record<string, MarginScore>;
  /** What Wait last wrote for each Margin problem. */
  drafts: Record<string, string>;
  /** Side mission states, by mission id. */
  quests: Record<string, string>;
  /** Once's torn notebook pages found, by id. */
  onceNotes: string[];
  /** The one line Wait wrote into each companion's rote, by companion key. */
  allyLines: Record<string, string>;
}

export interface StetSave {
  /** Cards owned, by card id, with counts. */
  cards: Record<string, number>;
  /** The five cards Wait plays with. */
  deck: string[];
  /** Opponents beaten at least once. */
  beaten: string[];
  wins: number;
  losses: number;
  draws: number;
}

export interface MarginScore { lines: number; ink: number; steps: number; rounds: number }

export const SAVE_KEY = 'rote-opus-magic-save-v1';
export const PAGE_COLORS = [0xe6d8bc, 0xc25a3a, 0x6fe3e0, 0x9fd88a, 0xe07aa0, 0xa99ad8, 0xf2f25a, 0xff7a3a];

/** Words that are always sayable. Again is not in any manual. */
const ALWAYS = new Set(['wait', 'again']);
const FOREIGN: Record<string, string> = { bite: 'a Nip', grind: 'Grind', drink: 'a Lull', burst: 'a Tock', stamp: 'a Clerk', listen: 'a Dish', shout: 'the Relay' };
const PRIMER_WORDS: Record<string, string> = {
  strike: 'the First Primer', mend: 'the First Primer', ward: 'the First Primer', say: 'the First Primer', repeat: 'the torn page',
  if: 'the Second Primer', else: 'the Second Primer', soak: 'the Second Primer', jolt: 'the Second Primer',
  let: 'the Third Primer', count: 'the Third Primer', first: 'the Third Primer', last: 'the Third Primer',
  erase: 'the red notebook',
};

export function newGame(): SaveData {
  return {
    v: 1, chapter: 1, map: 'busy', x: 12, y: 11, dir: 0, flags: {}, level: 1, xp: 0, hp: 22, ink: 8, marks: 0,
    party: [], allyHp: {}, words: [], grammar: [],
    pages: [{ id: 'p0', name: 'wait', src: 'wait  # until', color: 0, fixed: true, stats: blankStats() }],
    library: [], items: { salve: 1 }, primers: [], seen: [], usedAgain: false, childLine: null, time: 0, done: [],
    aside: 'until',
    blanks: 0, seals: {}, pageSeals: {}, inkType: 'black', inks: ['black'],
    stet: { cards: {}, deck: [], beaten: [], wins: 0, losses: 0, draws: 0 },
    fish: {}, margin: {}, drafts: {}, quests: {}, onceNotes: [], allyLines: {},
  };
}

export function blankStats(): PageStats { return { casts: 0, harm: 0, heal: 0, best: 0 }; }

function bonus(s: SaveData, stat: Stat): number {
  let n = 0;
  for (const id of s.grammar) n += GNODE[id]?.stat?.[stat] ?? 0;
  return n;
}

export function maxHp(s: SaveData) { return 22 + 4 * (s.level - 1) + 3 * (s.items.thick ?? 0); }
export function maxInk(s: SaveData) { return 8 + Math.floor((s.level - 1) / 3) + bonus(s, 'ink') + (s.items.deep ?? 0); }
/** Lines a page may hold, after its seal. */
export function pageLimit(s: SaveData, p: PageData) { return lineLimit(s) + (s.pageSeals[p.id] === 'room' ? 2 : 0); }
export function regen(s: SaveData) { return 3 + bonus(s, 'regen'); }
export function lineLimit(s: SaveData) { return 4 + bonus(s, 'lines'); }
export function pageSlots(s: SaveData) { return 3 + bonus(s, 'pages'); }
export function hands(s: SaveData) { return 1 + (s.items.second_hand ? 1 : 0) + bonus(s, 'hands'); }
export function ticks(s: SaveData) { return 30 + bonus(s, 'ticks'); }
export function nib(s: SaveData) { return 2 + bonus(s, 'nib'); }
export function allyMax(s: SaveData, key: string) { const d = ALLIES[key]; return d.hp + d.hpPerLevel * (s.level - 1); }

/** Experience needed to go from this level to the next. */
export function xpToNext(level: number) { return 10 + level * level * 2 + level * 4; }

export function lender(word: string): string | null {
  for (const a of Object.values(ALLIES)) if (a.lends === word) return a.key;
  return null;
}

export function lentActive(s: SaveData, word: string): boolean {
  return !!s.flags[`lent_${word}`] && s.party.some((k) => ALLIES[k]?.lends === word);
}

export function canSay(s: SaveData, word: string): boolean {
  return ALWAYS.has(word) || s.words.includes(word) || lentActive(s, word);
}

/** The reason Wait cannot say a word, or null if Wait can. */
export function whyNot(s: SaveData, word: string): string | null {
  if (canSay(s, word)) return null;
  const v = VERBS[word];
  if (v?.only) return `only ${v.only} can say ${word}`;
  const k = lender(word);
  if (k && s.flags[`lent_${word}`]) return `${word} is ${ALLIES[k].name}'s word. ${ALLIES[k].name} is not here`;
  if (k) return `${word} is someone else's word`;
  if (FOREIGN[word]) return `you do not know ${word}. a page from ${FOREIGN[word]} has it`;
  if (PRIMER_WORDS[word]) return `you do not know ${word} yet. it is in ${PRIMER_WORDS[word]}`;
  for (const n of Object.values(GNODE)) if (n.words?.includes(word)) return `you do not know ${word} yet. it is in the Grammar`;
  return `you do not know ${word} yet`;
}

export function learn(s: SaveData, ...words: string[]) {
  for (const w of words) if (!s.words.includes(w)) s.words.push(w);
}

/** Adds a beaten foe's page to the library and learns any foreign verbs on it. Returns the new entry, if any. */
export function collectPage(s: SaveData, key: string): LibEntry | null {
  const def = FOES[key];
  if (!def || def.key === 'again') return null;
  const lib = def.page ?? { name: key, src: def.rote };
  if (s.library.some((l) => l.key === key)) return null;
  const e: LibEntry = { key, name: lib.name, src: lib.src, from: def.name };
  s.library.push(e);
  for (const w of Object.keys(FOREIGN)) if (new RegExp(`(^|\\n)\\s*${w}\\b`).test(lib.src)) learn(s, w);
  return e;
}

/** Compiles Wait's pages. A page with more lines than the rote allows will not run. */
export function battlePages(s: SaveData): BattlePage[] {
  return s.pages.map((p) => {
    const pg = makePage(p.name, p.src);
    if (!p.fixed && parse(p.src).codeLines > pageLimit(s, p)) pg.code = null;
    pg.seal = s.pageSeals[p.id];
    return pg;
  });
}

export function battleSetup(s: SaveData, enc: string, seed: number): BattleSetup {
  const lent: Record<string, string> = {};
  for (const k of s.party) { const w = ALLIES[k].lends; if (w && s.flags[`lent_${w}`]) lent[w] = k; }
  return {
    enc,
    wait: { hp: s.hp, max: maxHp(s), ink: s.ink, maxInk: maxInk(s), regen: regen(s), hands: hands(s), ticks: ticks(s), nib: nib(s) },
    allies: s.party.map((k) => ({ key: k, hp: Math.max(1, s.allyHp[k] ?? allyMax(s, k)), max: allyMax(s, k) })),
    pages: battlePages(s),
    canSay: (w) => ALWAYS.has(w) || s.words.includes(w),
    lent,
    items: s.items,
    seed,
  };
}

/** Adds experience. Returns the number of levels gained. */
export function gainXp(s: SaveData, xp: number): number {
  s.xp += xp;
  let ups = 0;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    s.marks++;
    ups++;
  }
  return ups;
}

export function restAll(s: SaveData) {
  s.hp = maxHp(s);
  s.ink = maxInk(s);
  for (const k of s.party) s.allyHp[k] = allyMax(s, k);
}

export function saveGame(s: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function loadGame(): SaveData | null {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return null;
    const s = JSON.parse(t) as SaveData;
    if (s.v !== 1) return null;
    return { ...newGame(), ...s };
  } catch { return null; }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function buyNode(s: SaveData, id: string): string | null {
  const n = GNODE[id];
  if (!n) return 'no such node';
  if (s.grammar.includes(id)) return 'you have it';
  if (n.chapter > s.chapter) return `opens in chapter ${n.chapter}`;
  if (n.parent && !n.parent.every((p) => s.grammar.includes(p))) return 'needs the one above it first';
  if (s.marks < n.cost) return `needs ${n.cost} mark${n.cost > 1 ? 's' : ''}`;
  s.marks -= n.cost;
  s.grammar.push(id);
  if (n.words) learn(s, ...n.words);
  if (n.stat?.ink) s.ink += n.stat.ink;
  return null;
}
