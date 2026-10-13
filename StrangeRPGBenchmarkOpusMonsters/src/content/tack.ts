// Tack's rival fights. Ouro must win each one to get past, and Tack keeps both counts.
import { G } from '../game/state';

/** Tack's wins over Ouro and Ouro's wins over Tack, across every rival fight. */
export function tackTally(): { tack: number; ouro: number } {
  return { tack: G.flags.tackBeat || 0, ouro: G.flags.tackWins || 0 };
}

/** Counts one finished rival fight, and one more try at it when Ouro lost. */
export function countTack(fight: string, ouroWon: boolean): void {
  const k = ouroWon ? 'tackWins' : 'tackBeat';
  G.flags[k] = (G.flags[k] || 0) + 1;
  if (!ouroWon) G.flags['tackTry_' + fight] = tackTries(fight) + 1;
}

/** How many times Ouro has lost this one fight. A rematch opens with a shorter hello. */
export function tackTries(fight: string): number {
  return G.flags['tackTry_' + fight] || 0;
}

/** Tack's score line after Tack wins. Every Tack line has a number in it. */
export function tackWinsLine(): string {
  const t = tackTally();
  return `${t.tack} for me, ${t.ouro} for you.`;
}

/** Tack's score line after Ouro wins: the losses first, because those are the new number. */
export function tackLosesLine(): string {
  const t = tackTally();
  return t.tack ? `${t.ouro} for you, ${t.tack} for me.` : `${t.ouro} loss${t.ouro === 1 ? '' : 'es'}.`;
}
