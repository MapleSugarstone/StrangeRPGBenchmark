# Whorl

A creature-collecting role-playing game for a console that never existed. Everything that grows outgrows its shell, and the empty shells keep walking with the habits of what grew in them. People call them whorls. Ouro is twelve and has not shed yet. Eight black Seals hold the world shut, and Ouro walks the Rim to shed.

## Play

Run `play.cmd` on Windows. It installs dependencies the first time, builds the game, and opens it at http://localhost:8743/. With Node 18 or newer you can also run `npm install`, `npm run build`, and `npm run serve`.

Arrows or WASD move. Z, Enter, or Space confirms. X or Esc goes back and opens the menu. C wears your lead whorl, which lets you cross ground it knows. Shift hurries. Tab shows your goal. M mutes.

## The game

- 250 species of whorl in eight types, each with four moves and two passives built around one idea. Every species has the same stats, so a species is its kit.
- Battles are one against one with three in reserve. Turns come from a timeline, so speed and heavy moves matter. Big moves wind up and can be cut off. Both sides share a tide that big moves spend. Guarding halves a hit. There is no randomness anywhere.
- After round 25, fatigue takes a growing share of HP from both out whorls, slowest first. Most battles end well before that.
- Conjoining makes two whorls one. You keep two moves from each parent, two passives, and a look built from both sprites.
- Notions are held items. Nacre, earned in minigames and side missions, raises one stat of one whorl. Each pearl you win from a Sealkeeper raises the level cap.
- Act 1 has nine chapters and two endings decided by which Seals you pull.
- Act 2, the Strand, starts after Act 1 ends. It has six chapters on a night beach where the shells of whole worlds lie in the sand. Your whorls start low again on a separate level scale, and a tide turns between high and low water. At low water stars fall, and every empty shell left out on the sand is gone.
- Thirteen optional areas with side missions and hidden finds. Each Sealkeeper's hall has a puzzle, and most optional areas have one too: sliding floors, wind, mirrored walkers, moon pools, light beams, patrols, and a map you draw by walking it. Every Act 2 chapter has its own puzzles built on the tide and the falling stars.
- Minigames: Prise, a deduction game at every grotto. Shellboard, a card duel played with the whorls you have caught, with a wet-row rule on the Strand. Starfall, played under the falling stars in Act 2.
- Byssus is online play. At a grotto counter, once you own six whorls, you can queue for a match or share a code with a friend. Each player brings six whorls and picks four, and every whorl fights at level 25. A match gives no prizes. The save keeps a tally of wins and losses and nothing else.

## Online play

A Byssus match has two players and a small relay server. The server pairs players in a public queue or through private codes, keeps each side's choice secret until both are in, owns every clock, and holds a dropped player's seat for 90 seconds. It runs no game code, so a change to kits, species, or the battle engine needs no server deploy. Both browsers run the same battle from the released choices and compare a hash of it after every decision. A match ends with no result at the first decision where they differ.

The build fingerprint is a hash of the battle, data, and net code. The queue pairs only players with the same fingerprint, so players on different builds never meet.

From `server/`:

- `npm ci` installs the server's tools.
- `npm test` runs the room tests, and `npm run fuzz` sends malformed messages at the rooms.
- `npm run dev` serves the rooms on port 8787. A game opened from localhost always uses that port, so two tabs of a local game can play each other.
- `npm run deploy` publishes the server to the account you are signed in to.

To point a build at a deployed server, set `BYSSUS_URL` to its address before `npm run build`. The server and the game ship together. Raise `PROTOCOL` in `src/net/protocol.ts` with any change to the messages, deploy the server, and then publish the game.

## Tools

- `npm test` validates the content: kits, maps, warps, reachability (ice included), zones, and the writing rules for every line.
- `npm run sim -- 1500` runs AI-against-AI battles and reports win rates by species, move, passive, and notion, plus battle length and fun metrics.
- `npm run duel -- builds/<file>.json` tests one team build against a field of resourced opponents.
- `node dist-tools/story.js` runs every story fight with a typical team for that chapter.
- `node dist-tools/music-check.js` renders every track for ten minutes and checks ranges, channels, and repetition.
- `node dist-tools/maps.js <map>` prints a map with coordinates.
- `node dist-tools/lockstep.js [battles] [seed]` plays AI battles through two copies of an online match and stops at any decision where the copies differ.

## Source

- `src/battle`: the engine, the AI, and the registry for moves, passives, notions, and marks.
- `src/data`: types, stats, species, and kits.
- `src/game`: the field, battle view, menus, minigames, art for tiles and battle scenes, and field effects.
- `src/content`: chapters, optional areas, puzzle halls, and minigame rivals.
- `src/engine`: screen, font, input, sprites, sound effects, and the music engine and score.
- `src/net`: the online messages and their checks, the room's rules, the lockstep copy of a battle, and the client's link to a room.
- `server/`: the relay server for online play, with its own tests.
