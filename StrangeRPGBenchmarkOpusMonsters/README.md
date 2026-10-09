# Whorl

A creature-collecting role-playing game for a console that never existed. Everything that grows outgrows its shell, and the empty shells keep walking with the habits of what grew in them. People call them whorls. Ouro is twelve and has not turned yet. Eight black Stays hold the world shut, and Ouro walks the Lip to turn.

## Play

Run `play.cmd` on Windows. It installs dependencies the first time, builds the game, and opens it at http://localhost:8743/. With Node 18 or newer you can also run `npm install`, `npm run build`, and `npm run serve`.

Arrows or WASD move. Z, Enter, or Space confirms. X or Esc goes back and opens the menu. C wears your lead whorl, which lets you cross ground it knows. Shift hurries. Tab shows your goal. M mutes.

## The game

- 250 kinds of whorl in eight types, each with four moves and two passives built around one idea. Every kind has the same stats, so a kind is its kit.
- Battles are one against one with three in reserve. Turns come from a timeline, so speed and heavy moves matter. Big moves wind up and can be cut off. Both sides share a tide that big moves spend. Guarding halves a hit. There is no randomness anywhere.
- After round 25, fatigue takes a growing share of HP from both out whorls, slowest first. Most battles end well before that.
- Conjoining makes two whorls one. You keep two moves from each parent, two passives, and a look built from both sprites.
- Notions are held items. Nacre, earned in minigames and side missions, raises one stat of one whorl. Each pearl you win from a Staykeeper raises the level cap.
- Act 1 has nine chapters and two endings decided by which Stays you pull.
- Act 2, the Strand, starts after Act 1 ends. It has six chapters on a night beach where the shells of whole worlds lie in the sand. Your whorls start low again on a separate level scale, and a tide turns between high and low water. At low water stars fall, and every empty shell left out on the sand is gone.
- Thirteen optional areas with side missions and hidden finds. Each Staykeeper's hall has a puzzle, and most optional areas have one too: sliding floors, wind, mirrored walkers, moon pools, light beams, patrols, and a map you draw by walking it. Every Act 2 chapter has its own puzzles built on the tide and the falling stars.
- Minigames: Prise, a deduction game at every grotto. Shellboard, a card duel played with the whorls you have sounded, with a wet-row rule on the Strand. Starfall, played under the falling stars in Act 2.

## Tools

- `npm test` validates the content: kits, maps, warps, reachability (ice included), zones, and the writing rules for every line.
- `npm run sim -- 1500` runs AI-against-AI battles and reports win rates by kind, move, passive, and notion, plus battle length and fun metrics.
- `npm run duel -- builds/<file>.json` tests one team build against a field of resourced opponents.
- `node dist-tools/story.js` runs every story fight with a typical team for that chapter.
- `node dist-tools/music-check.js` renders every track for ten minutes and checks ranges, channels, and repetition.
- `node dist-tools/maps.js <map>` prints a map with coordinates.

## Source

- `src/battle`: the engine, the AI, and the registry for moves, passives, notions, and marks.
- `src/data`: types, stats, species, and kits.
- `src/game`: the field, battle view, menus, minigames, art for tiles and battle scenes, and field effects.
- `src/content`: chapters, optional areas, puzzle halls, and minigame rivals.
- `src/engine`: screen, font, input, sprites, sound effects, and the music engine and score.
