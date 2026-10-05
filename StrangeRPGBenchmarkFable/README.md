# The Moth Crown

A tile based adventure game in TypeScript. Every sprite is an 8x8 grid generated from a seed, with black plus two palette colors. The game runs in a 192 by 192 pixel square on a web page, scaled up to fit the window. Dialogue, menus, and battles all stay inside the square.

## Play

Double click `play.cmd`. It installs dependencies on the first run, builds the game, starts a local server, and opens `http://localhost:8642/` in your browser.

Controls: arrow keys or WASD move, Z or Enter confirms, X or Escape cancels, C opens the menu, M mutes. Hold Shift to hurry text and battle animation. On a touch screen an on screen pad appears under the square.

All sound is synthesized at runtime with the Web Audio API. Every map, battle, and boss has its own tune generated from a seed, and the effects are short shaped tones and noise bursts. Browsers only allow sound after the first key press or click.

To look at a later chapter without playing up to it, add `#ch4` (or any chapter number from 1 to 9) to the address. The game starts fresh at that chapter with a party that fits it.

## Story

The Shell is a curve of land built around a dying star called the Ember. Pell scrapes salt at the edge of the world in a village with one Lamp. When the Lamp starts to fail, a moth the size of a cart lands in the square and says Pell's name.

The nine chapters follow the hero's journey: ordinary world and call (1), refusal and mentor (2), crossing the threshold (3), tests and allies (4, 5), approach to the inmost cave (6), the ordeal (7), reward and the road back (8), resurrection and return with the elixir (9). Inside each chapter the beats follow the eight step story circle. The pause menu's Story page shows which beat you are on.

## Mechanics

Each chapter adds one battle mechanic and one possible party member.

| Chapter | Place | Mechanic | New member |
|---|---|---|---|
| 1 Salt | Rimward and the Salt Cellar | Brace: guard, then your next hit deals double | Oxbow, a maintenance frame that decided to be a knight |
| 2 Tempo | The Vending Church | Tempo: a visible turn strip, skills that delay foes | Sister Vane, who prays by inserting coins |
| 3 Links | The Glass Steppe | Links: two elements on one foe react | Mim, a moth that grew a child to fit through doors |
| 4 Memories | The Library of Moths | Memories: slot passives dropped by foes | Quill, a librarian made of paper |
| 5 Rows | The Fold | Rows: front and back for both sides | Fold, a cartographer folded from dead maps |
| 6 Debt | The Bank of Teeth | Debt: borrow Static now, pay interest in teeth | Uhtred-7, the seventh print of a soldier |
| 7 Rewind | The Backward Hour | Rewind: undo one turn per battle | Dust, Pell from later |
| 8 Fusion | The Choir Steps | Fusion: two members become one for three turns | Choir, forty singers who agreed to be one person |
| 9 Words | The Moth Crown | Words: build spells from a verb, a noun, and a shape | none, this is the end |

## Development

```
npm install
npm run build        # bundle to dist/
npm run serve        # serve dist/ on port 8642
npm run watch        # rebuild on change
npm run typecheck
npm run sim          # full balance simulation, writes Notes/balance-report.md
npm test             # quick balance simulation
```

`src/engine` holds the renderer, input, sprite generator, font, and dialogue box. `src/game/battle/core.ts` is the whole battle rule set as pure functions over a state object, shared by the game and the simulator. `src/game/story/ch1.ts` through `ch9.ts` hold the maps and scripts. `src/sim` holds the policies and metrics used to measure balance and fun.

## Balance and fun measurement

`npm run sim` plays every encounter group in every chapter many times with three policies: a heuristic player, a random player, and an attack only player. It also plays whole chapters, leveling up through random fights, then the boss. For each group it reports win rates, pacing in turns, close call rate, action entropy, mechanic use, and Static scarcity, and combines them into a fun score with target bands. The report lands in `Notes/balance-report.md`.
