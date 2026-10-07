// Owned cards, the deck, stakes, and the shop, as pure operations on the saved Stet record.
import type { StetSave } from '../state';
import { CARDS, CARD_IDS, cardWorth } from './cards';
import { OPPONENTS, OPPONENT_IDS } from './opponents';

export const DECK_SIZE = 5;
export const STARTER = ['wait', 'straw', 'nip', 'chaff', 'spoke'];

export function owned(st: StetSave, id: string): number { return st.cards[id] ?? 0; }

/** Adds copies of a card. A secret card is never owned more than once. Returns the copies added. */
export function grant(st: StetSave, id: string, n = 1): number {
  const c = CARDS[id];
  if (!c || n <= 0) return 0;
  const have = owned(st, id);
  const add = c.secret ? Math.max(0, Math.min(n, 1 - have)) : n;
  if (add) st.cards[id] = have + add;
  return add;
}

export function take(st: StetSave, id: string) {
  const have = owned(st, id);
  if (have <= 1) delete st.cards[id];
  else st.cards[id] = have - 1;
  repairDeck(st);
}

/** Drops deck cards the save no longer owns enough of, then tops the deck up to five. */
export function repairDeck(st: StetSave) {
  const used: Record<string, number> = {};
  st.deck = st.deck.filter((id) => {
    used[id] = (used[id] ?? 0) + 1;
    return !!CARDS[id] && used[id] <= owned(st, id);
  });
  fillDeck(st);
}

/** Adds the strongest owned cards to the deck until it holds five or the cards run out. */
export function fillDeck(st: StetSave) {
  const used: Record<string, number> = {};
  for (const id of st.deck) used[id] = (used[id] ?? 0) + 1;
  const pool: string[] = [];
  for (const id of Object.keys(st.cards)) {
    for (let k = used[id] ?? 0; k < owned(st, id); k++) pool.push(id);
  }
  pool.sort((a, b) => cardWorth(b) - cardWorth(a));
  for (const id of pool) {
    if (st.deck.length >= DECK_SIZE) break;
    st.deck.push(id);
  }
}

export function autoDeck(st: StetSave) {
  st.deck = [];
  fillDeck(st);
}

export function giveStarter(st: StetSave) {
  let total = 0;
  for (const id of Object.keys(st.cards)) total += owned(st, id);
  for (const id of STARTER) {
    if (total >= DECK_SIZE && owned(st, id)) continue;
    if (!owned(st, id)) { grant(st, id); total++; }
  }
  while (total < DECK_SIZE) { grant(st, 'straw'); total++; }
  fillDeck(st);
}

export function deckReady(st: StetSave): boolean { return st.deck.length === DECK_SIZE; }

/** Cards from the other side's played cards that the winner may take. */
export function winnable(st: StetSave, played: string[]): string[] {
  const out: string[] = [];
  for (const id of played) {
    const c = CARDS[id];
    if (!c || out.includes(id)) continue;
    if (c.secret && owned(st, id) > 0) continue;
    out.push(id);
  }
  return out;
}

/** The card an opponent takes after winning: the best one the player played that is not a last copy. */
export function forfeit(st: StetSave, played: string[]): string | null {
  const counts: Record<string, number> = {};
  for (const id of played) counts[id] = (counts[id] ?? 0) + 1;
  const ok = Object.keys(counts).filter((id) => owned(st, id) >= 2);
  if (!ok.length) return null;
  ok.sort((a, b) => cardWorth(b) - cardWorth(a));
  return ok[0];
}

export function status(st: StetSave): { owned: number; total: number; beaten: number; opponents: number } {
  return {
    owned: CARD_IDS.filter((id) => owned(st, id) > 0).length,
    total: CARD_IDS.length,
    beaten: OPPONENT_IDS.filter((id) => st.beaten.includes(id)).length,
    opponents: OPPONENT_IDS.length,
  };
}

/** Who starts: the player and the opponent take turns, match by match. */
export function playerStarts(st: StetSave): boolean {
  return (st.wins + st.losses + st.draws) % 2 === 0;
}

/** Cards Weigh sells, with prices in blanks. A card is stocked from its own chapter on. */
export const STOCK: { id: string; price: number }[] = [
  { id: 'straw', price: 4 },
  { id: 'nip', price: 5 },
  { id: 'chaff', price: 6 },
  { id: 'sweep', price: 10 },
  { id: 'lull', price: 12 },
  { id: 'tock', price: 12 },
  { id: 'clerk', price: 12 },
  { id: 'vatling', price: 14 },
  { id: 'split', price: 26 },
  { id: 'dish', price: 30 },
  { id: 'flinch', price: 30 },
  { id: 'drift', price: 34 },
  { id: 'mind', price: 40 },
];

export function stockFor(chapter: number): { id: string; price: number }[] {
  return STOCK.filter((s) => (CARDS[s.id]?.ch ?? 9) <= chapter);
}

/** Where a card turns up, in a few words. */
export function sourceOf(id: string): string {
  const c = CARDS[id];
  if (!c) return '';
  const who = OPPONENT_IDS.find((o) => OPPONENTS[o].deck.includes(id));
  if (c.foe) return who ? `a foe's page. ${OPPONENTS[who].name} plays it.` : 'a foe\'s page.';
  if (who) return `${OPPONENTS[who].name} plays it.`;
  if (STARTER.includes(id)) return 'everyone starts with one.';
  return 'a companion brings it.';
}
