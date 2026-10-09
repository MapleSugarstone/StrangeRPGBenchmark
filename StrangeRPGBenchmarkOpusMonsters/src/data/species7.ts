import './kits7';
import { sp } from './speciesdb';

// Carcanet waits at the bottom of the geode under the crater fields, and opens to whoever has set all twelve sketches.
sp({ id: 'carcanet', name: 'Carcanet', types: ['STONE', 'STAR'], basic: 'M',
  moves: ['carc_facet', 'carc_rewind', 'carc_cleave', 'carc_crest'], passives: ['carc_tape', 'carc_clasp'],
  sprite: ['..2332..', '.3.22.3.', '24.4..42', '2......2', '24....42', '.344443.', '.212212.', '..2..2..'], c: ['#e8b848', '#aa82e5', '#f4ecd8'],
  fit: 'sets a stone in itself every breath', pegs: 0,
  entry: 'Off a neck nobody remembers, a collar of twelve settings. Sets its own stones now, in an order it keeps to itself. No price. It keeps setting my cowries.',
  legendary: true, wild: false });
