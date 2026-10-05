# Plumb

A tile based adventure game in TypeScript, made to feel like a cartridge for a console that never existed. Every sprite is an 8x8 grid generated from a seed with black plus two palette colors; bosses are 16x16 made the same way, so everything on screen shares one pixel grid. The game runs in a 224 by 224 square on a web page, scaled up to fit the window. Dialogue, menus, minigames, and battles stay inside the square.

## Play

Double click `play.cmd`. It installs the build tools on the first run, builds the game, starts a local server, and opens `http://localhost:8731/`.

Controls: arrow keys or WASD move. Z, Enter, or Space confirms. X or Esc cancels. C opens the menu. Tab shows your goal. Hold Shift to hurry. M mutes. Gamepads work. On a touch screen an on screen pad appears under the square.

To look at a later chapter without playing up to it, add `#ch4` (any chapter from 1 to 9) to the address. The game starts fresh at that chapter with a party that fits it. `#nosplash` skips the boot screen.

## The world

Everyone on the Drop has a hook in the back and a line from it straight up into the sky, which is dark, ribbed, and drips. A held person cannot fall, cannot go under anything, and hums. Once a year at the Lift one line in each town goes tight and its person is reeled up in a second. The Plumb Office calls this being Chosen.

Fathom tunes the village choir in Hem. On the morning of the Lift, Fathom's line is cut from above and comes down out of the sky with knots tied along its length. The knots are a file. The first entry is a tally. The rest are predictions, and each one comes true.

Nine chapters follow the hero's journey, and each chapter is a full story circle. Each chapter adds a battle mechanic and a party member.

| Chapter | Place | Mechanic | Joins |
|---|---|---|---|
| 1 | Hem | Tension, and the Bite | Burl, three hooks' worth of line that woke up |
| 2 | The Slatlands | Notes and chords: pluck lines to play them | Dulcet, a lure-harpist, cut and lying about it |
| 3 | The Snarl | Tangle: tie two foes together | Lissom, the only person in the nest allowed to move |
| 4 | The Let-Out | Lift: five tension and the sky takes you | Hale, reeled up, hung, thrown back, held twice |
| 5 | The Pendulum Steppe | Lanes and wind | Gust, a small wind hooked for whistling |
| 6 | The Under | Locks: match icons to cancel a charged move | Sump, a lobe who knows what lines are for |
| 7 | The Stays | Pairs: two bonded allies act together | Bob, a surveyor. Not a title. |
| 8 | The Deck | Let Go: release your own line | Marrow, unhooked from the hold for one day |
| 9 | The Reel | Everyone slack. The Reel sets hooks. | none. Fathom chooses. |

Fathom is cut and ties knots in the fallen line instead of spending tension. A knot stays tied, and costs its length, until you untie it. Four knots can be rigged at once.

## Fights

The strip at the top shows the turn order. Tension is the only resource for held fighters: attack and Hang to gain it, skills spend it, a Pluck on a tight line hurts more and drains it. The crack under the strip is the Bite meter. Every humming line on the field fills it, and when it fills something below bites the loudest line, on either side. Bosses deep in the game hum on purpose.

Lures hang on a held member's line and change its note and how it hums: louder, quieter, bite resistant, or bite baiting. Gloves, weights, and soles cover the rest. Difficulty (slack, plumb, taut) is in Options and can be changed at any time. Field enemies far below your level run away, and touching them wins instantly.

## Side work

Every town has errands, a Scrap Market trader with expensive gear, an inn, and usually a bounty. Any well or crack lets the cut fish downward: Hooking is a timing game that pays in slugs, items, and once in a while a hook from the Hull. Dulcet busks in Rafter (a four lane rhythm game). The Swing guild on the Steppe needs a parcel carried (push at the top of each swing). Knots can be learned early by tying them.

## Beyond the square

- Held party members' lines continue out of the canvas and up the page to the top of the browser window. In one ending they fall.
- The favicon is Fathom, or the party's health during a battle. The tab title reacts.
- The knot writing is a real cipher. `key.html` (Knot key on the title screen) is the Tuner's Knot Key. Some knot strings in the game are never read aloud, and three of them are passwords for the title screen.
- Player two is the Hand. Turn it on in Options and use the mouse: pluck anyone's line in the field to hear its note, freeze a wandering enemy, and in battle Tug, Steady, or Pinch.
- The ending offers a knot letter as a PNG download. Options shows a save code you can paste at the title screen elsewhere.

## Development

```
npm install
npm run build        # bundle to dist/
npm run serve        # serve dist/ on port 8731
npm run typecheck
npm run sim          # full balance simulation, writes Notes/balance-report.md
npm test             # quick balance simulation
node scripts/build.mjs --validate && node dist/validate.js   # check every map
```

`src/engine` holds the renderer, input, sprite generator, font, audio, and dialogue box. `src/game/battle/core.ts` is the whole battle rule set as pure functions over a state object, shared by the game and the simulator. `src/game/story/ch1.ts` through `ch9.ts` hold the maps and scripts, and `common.ts` the errands every town shares. `src/game/ui/minigames.ts` holds the minigames. `src/sim` holds the player models and fun metrics. The browser console exposes `plumb` with `jump`, `battle`, `chapter`, `give`, `flag`, and `level`.

## Balance and fun measurement

`npm run sim` plays every encounter group in every chapter with three player models (heuristic, random, attack only), every boss at three levels, and whole chapter runs that level through random fights to the boss. For each group it reports win rates, decision gap, pacing, close calls, lead changes, action entropy, mechanic use, and unwanted Lifts, and combines them into a fun score with target bands. The report lands in `Notes/balance-report.md`.
