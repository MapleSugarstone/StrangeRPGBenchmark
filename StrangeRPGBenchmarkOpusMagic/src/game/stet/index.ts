// Stet, the card game played with spare pages. The world calls these.
import { app } from '../app';
import { BookScene, ShopScene } from './book';
import { CARDS, CardDef } from './cards';
import { deckReady, giveStarter, grant, repairDeck, status } from './collection';
import { OPPONENTS, OpponentDef, available } from './opponents';
import { PreMatch, Result } from './scene';

export { CARDS, OPPONENTS };
export type { CardDef, OpponentDef, Result };

/** Pushes the screen before a match. onDone runs after the stakes are settled and every Stet scene is gone. */
export function startStet(opponentId: string, onDone: (result: 'win' | 'lose' | 'draw') => void): void {
  const o = OPPONENTS[opponentId];
  if (!o) { console.warn('no Stet opponent', opponentId); onDone('draw'); return; }
  const st = app.s.stet;
  if (!st.deck.length) giveStarter(st);
  else if (!deckReady(st)) repairDeck(st);
  app.push(new PreMatch(o, onDone));
}

export function openStetBook(): void {
  const st = app.s.stet;
  if (!st.deck.length && !Object.keys(st.cards).length) giveStarter(st);
  app.push(new BookScene());
}

/** Weigh's stall. */
export function openStetShop(): void {
  app.push(new ShopScene());
}

/** Adds copies of a card. Gives the starter deck first if the player has no deck yet. */
export function grantCard(cardId: string, n = 1): void {
  if (!CARDS[cardId]) return;
  const st = app.s.stet;
  if (!st.deck.length) giveStarter(st);
  grant(st, cardId, n);
  if (!deckReady(st)) repairDeck(st);
}

export function giveStarterDeck(): void {
  giveStarter(app.s.stet);
}

/** Opponent ids playing in a map region in a chapter. Secret opponents appear once unlocked. */
export function opponentsFor(chapter: number, region: string): string[] {
  return available(chapter, region, app.s.stet.beaten);
}

export function stetStatus(): { owned: number; total: number; beaten: number; opponents: number } {
  return status(app.s.stet);
}
