# Please Hold

Please Hold is a tile-based role-playing game for the browser, written in TypeScript. Every sprite and tile is generated from a seed as an 8x8 image with black plus at most two colors. Large figures are built from those 8x8 sprites with pixel-art upscaling, so everything sits on the same pixel grid. The game runs in a small square canvas, and all dialogue appears inside it. It presents itself as a cartridge for a console that never existed.

Every prayer that nobody answers falls to the bottom of everything and settles into a place called the Silt. Heavy prayers grow into the thing they asked for, so everyone in the Silt is an Answer, grown for someone Above who never received them. One night the prayers stop falling. You play Hello, an Answer whose own prayer is blank, and the first thing the game asks you to do is make a wish.

## Play

On Windows, double-click `play.cmd`. It installs the build tools on the first run, builds the game, and opens `dist/index.html` in your browser.

On any system with Node 18 or newer:

```bash
npm install
npm run build
```

Then open `dist/index.html`.

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrows or WASD |
| Confirm, talk | Z, Space, Enter, or F |
| Cancel, open the menu | X, Esc, or G |
| Listen | C or E |
| Run | Hold Shift |
| Show your current goal | Tab |
| Mute | M |

Gamepads work as well. Choose two players on the title screen or in Options. Player 1 uses WASD with F and G, and player 2 uses the arrows with Enter and right Shift. Options also has a scanline setting for the screen, and a Gentle setting that makes every foe weaker. After a lost fight you can also retry it on Gentle.

## What is in the game

The story follows the twelve stages of the hero's journey across nine chapters. Each chapter follows an eight-step story circle, changes genre, adds a battle mechanic, and adds a party member.

| Chapter | Genre | New mechanic | Joins |
| --- | --- | --- | --- |
| 1. Hello? | Home town and a mine | Listen to hear what an enemy was prayed for | Someday |
| 2. Please Hold | A waiting room the size of a country | Answer an enemy's prayer instead of fighting it, and keep the prayer | Bigger |
| 3. The Docket | Heist in a city of switchboards | Party Line duo moves, and cable routing puzzles | Anyone |
| 4. Encore | A village stuck in one day | Rewind the last turn | Again |
| 5. Jackpot | A city where everyone already won | Stakes, and Masks that borrow kept prayers' moves | Someone Else |
| 6. The Unspoken Wood | A forest without sound | No spoken skills, two-headed turns, and a split-party puzzle | Both |
| 7. The Catch | A climb into the sky | Last Word when a party member falls | none |
| 8. The Lonesome Sea | A scattered party and a wrecked starship | Call kept prayers, Evacuate, and raft travel | Lifeboat |
| 9. Amen | The final engine | The final answer | none |

Battles use a visible turn timeline. Weakness hits knock enemies back on it, and bosses wind up big moves that the right elements can interrupt. Timed presses add a clean hit when you press as the ring closes, and a brace when you press as the warning flashes. Visible enemies wander the field, so you can avoid fights. Every area has its own animated battle background.

### Builds and side calls

- At level 10 each party member chooses one of two Callings. A Calling changes how their stats grow and teaches two skills. A payphone can change a Calling for a fee.
- People in every chapter ask for help. Their requests are listed under Calls in the menu, and several of them carry across chapters.
- Five minigames sit inside the story: sorting the morning slips, musical chairs, a switchboard shift, a bell memory game, and fishing for bottles. Each pays out every time you play it and gives a reward for a good score.
- The party sometimes has something to say about where it is. A small speech bubble appears in the corner, and the talk plays from the Party menu.
- Shops in the late chapters and a room you have to find early stock expensive gear, for players who would rather grind than play perfectly.
- Some things are hidden. Listening helps.

### Again

Finishing the game opens Again on the title screen. It starts the story over with Hello's level, the party's Callings, gear, and kept prayers, and every foe tougher.

### Two players

- In battle, party members alternate between the two players, and Both's two heads are always split between them.
- In the field, player 2 steers a cursor that reveals buried slips and freezes enemies.
- Later in the story, a few moments give each player a part of their own.

### Beyond the square

- The wish you type at the start seeds Hello's sprite and is revealed a few letters at a time as Hello's slip.
- The browser tab title reacts when you leave and come back, and at a few points in the story.
- The browser console and the page source each hide a letter code.
- Letters: Options lets you write a letter from preset phrases as a short code and open codes from friends. A letter can carry a gift.
- One ending lets you download a letter from Hello. The other leaves Hello sitting next to the game window on later visits.

## Look and sound

- Each area has a palette mode (day, dusk, night, an eerie wash, a blank paper wash) that recolors every tile and sprite at once. At night, lamps and windows light pools of the world in its daylight colors.
- Darkness, shadows, fades, and screen transitions are all ordered dithering on the 1x pixel grid.
- Weather particles drift over most areas: falling slips, ash, foam, wind, and others.
- The music is generated. Each track is a style with its own key, tempo, chord vocabulary, and drum patterns, and it varies on every pass. A short hold-music theme runs through the soundtrack and comes apart in the stranger places.

## Balance and fun measurement

`npm run sim` plays the whole campaign headlessly with several player models (a lookahead player, a casual player, a button masher, an attack-only player, and a random player) and runs Monte Carlo trials of every boss. The simulated party picks Callings as it levels. It writes `reports/balance.md` and `reports/metrics.json`. `node tools/report.mjs` turns those into `reports/report.html`, a one-page summary with charts, and `node tools/summary.cjs` prints a short table per boss.

The report measures win rates per player model, fight length, lead changes, drama, comebacks, near misses, decision variety (action entropy), whether a single action dominates, how much each chapter's new mechanic changes the outcome when it is removed, party level against boss level, and estimated play time and novelty per ten minutes. It combines these into a Fun Index per chapter and lists flagged problems. The formula is written at the top of the report.

`npm test` typechecks the project and runs a quick sim. `node build.mjs --validate` followed by `node build/validate.cjs` checks every map for unreachable exits, people, triggers, and buried items.

## Project layout

- `src/core`: random numbers, palette and palette modes, font, sprite and tile generators, renderer, input, the music composer, and audio.
- `src/battle`: the battle engine and boss behavior. The engine has no browser dependency, so the sim uses it directly.
- `src/data`: party members and Callings, skills, duo moves, items, enemies by chapter, buried slips, side calls, party talk, sound effects, and music styles.
- `src/maps`: one file per chapter with maps and story scripts, built with a small grid painter, plus shared side-call scripts.
- `src/scenes`: splash, title, field, lighting and weather, dialogue, battle and battle backgrounds, minigames, menu, shop, letters, chapter cards, endings.
- `src/game`: game state, the script context, speakers, letter codes, and the things that happen outside the square.
- `src/sim`: the balance simulator and fun metrics.
- `src/tools`: the map validator.
- `art`: a hero sprite and screenshots for the benchmark's cartridge menu.

## Debugging

The browser console exposes `dbg`. Useful calls include `dbg.jump(map, x, y, party, level)`, `dbg.view(map, x, y)`, `dbg.battle(group, scene)`, and `dbg.story()`, which plays the whole story through its scripts and reports any step that fails. In a browser that pauses hidden pages, start the run with `dbg.storyStart()` and advance it with repeated `dbg.pump(10000)` calls. `dbg.shot(name)` and `dbg.sheet(name, list, setup)` save screenshots to `build/shots` when the page is served by `tools/serve.mjs`.
