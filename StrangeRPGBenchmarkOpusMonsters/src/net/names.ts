// The word filter for names that reach another player online. The game and the Worker share it, so it imports nothing
// (Notes/online-design.md).

/** The name another player sees in place of a player name that fails the filter. */
export const STRANGER = 'Stranger';

/** Terms that block a name wherever they appear in it. */
const ANYWHERE = [
  'fuck', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'bitch', 'bastard', 'asshole', 'dickhead',
  'cocksucker', 'shithead', 'dipshit', 'bullshit', 'twat', 'wanker', 'dumbass', 'jackass', 'penis', 'vagina', 'dildo',
  'porn', 'orgasm', 'masturbat', 'blowjob', 'handjob', 'jizz', 'tranny', 'chink', 'kike', 'wetback', 'towelhead',
  'raghead', 'spastic', 'hitler', 'pedophile', 'paedophile', 'molest', 'killyourself',
];

/** Terms that block a name only when they make up the whole name or one word of it, since innocent names contain them. */
const WHOLE = [
  'fag', 'dyke', 'homo', 'spic', 'gook', 'paki', 'jap', 'nazi', 'dick', 'cock', 'prick', 'pussy', 'tits', 'cum', 'sex',
  'sexy', 'anal', 'anus', 'rape', 'rapist', 'pedo', 'semen', 'clit', 'horny', 'nude', 'milf', 'hoe', 'shit', 'piss',
  'nonce', 'kys', 'wank',
];

const DIGITS: Record<string, string> = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };

/**
 * Every way the filter reads a name: lowercase letters with look-alike digits read as letters, everything else dropped, and
 * repeated letters merged. A 1 reads both as i and as l, and a ! both as i and as nothing.
 */
export function readings(name: string): string[] {
  let forms = [name.toLowerCase()];
  if (forms[0].includes('1')) forms = forms.flatMap(f => [f.replace(/1/g, 'i'), f.replace(/1/g, 'l')]);
  if (forms[0].includes('!')) forms = forms.flatMap(f => [f.replace(/!/g, 'i'), f]);
  return forms.map(f => f.replace(/[0345678]/g, d => DIGITS[d]).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1'));
}

const STRONG = ANYWHERE.map(w => readings(w)[0]);
const MILD = new Set(WHOLE.map(w => readings(w)[0]));

/** Whether a name holds a slur, a sexual term, or a strong insult. */
export function nameBlocked(name: string): boolean {
  if (typeof name !== 'string') return false;
  const whole = readings(name), words = name.split(/[^A-Za-z0-9]+/).filter(Boolean).flatMap(readings);
  return whole.some(r => STRONG.some(w => r.includes(w))) || [...whole, ...words].some(r => MILD.has(r));
}

/** A player's name as the other player sees it: the name itself, or the stand-in for an empty name or one the filter refuses. */
export function shownPlayerName(name: unknown): string {
  return typeof name === 'string' && name.trim() && !nameBlocked(name) ? name : STRANGER;
}
