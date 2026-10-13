// Each move's sound for kits7.ts as a one-line spec, keyed by move id. Notes/move-sounds.md has the words and how to write one.
import type { SoundEntry } from '../game/soundspec';

export const SOUNDS7: Record<string, SoundEntry> = {
  // Carcanet opens every move with its gems chiming up a chord, and each Stone's option adds that gem's own sound.
  carc_facet: { fx: 'carcanet short | glass whistle short | glass chime glass shatter soft', opts: [
    'carcanet short | shell whistle short | shell chime shell ring soft',
    'carcanet short | ember crackle short | root chime ember crackle',
    'carcanet short | glass whistle short | glass chime water splash soft',
    'carcanet short | star whistle short | star chime star warble short',
  ] },
  carc_rewind: 'carcanet fall | gear rattle | star chime glass ring soft',
  carc_cleave: { fx: 'carcanet short air whoosh | - | glass scrape short hard glass shatter', opts: [
    'carcanet short air whoosh | - | shell scrape short hard shell ring',
    'carcanet short air whoosh | - | root scrape short hard ember crack',
    'carcanet short air whoosh short | - | glass scrape short hard water splash',
    'carcanet short air whoosh | - | star scrape short hard star chime',
  ] },
  carc_crest: { fx: 'carcanet long glass swell | glass fizz | glass shatter hard star chime glass ring', opts: [
    'carcanet long shell swell | shell fizz | shell shatter hard shell ring star chime',
    'carcanet long ember swell | ember crackle | root shatter hard ember crackle long root chime',
    'carcanet long glass swell | glass fizz | glass shatter hard water splash glass ring',
    'carcanet long star swell | star fizz | star shatter hard star chime star ring',
    'carcanet long x2 shell swell | shell fizz | shell shatter hard wide shell ring star chime',
    'carcanet long x2 ember swell | ember crackle | root shatter hard wide ember crackle long root chime',
    'carcanet long x2 glass swell | glass fizz | glass shatter hard wide water splash glass ring',
    'carcanet long x2 star swell | star fizz | star shatter hard wide star chime star ring',
  ] },
  // Setting a Stone plays every turn, so its motif is soft and leaves the music alone.
  carc_set: { fx: 'carcanet short soft | glass whistle rise soft | glass chime soft', opts: [
    'carcanet short soft | shell whistle rise soft | shell chime shell ring soft',
    'carcanet short soft | ember crackle soft | root chime ember crackle short',
    'carcanet short soft | glass whistle rise soft | glass chime water fizz soft',
    'carcanet short soft | star whistle rise soft | star chime star warble soft',
  ] },
};
