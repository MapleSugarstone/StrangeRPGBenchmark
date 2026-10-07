# Rote

Rote is a tile-based role-playing game in a 192 by 192 pixel window. You write your own spells in a small programming language called the Cant, in an editor inside the game.

Everything that lives runs a rote, a short book of instructions that a machine in the sky wrote into it at birth. Wait was the last thing the machine wrote, and Wait's rote is one word long. When a rote that copies itself into everything it reads comes down the river, Wait opens their own book, finds room under the word, and starts writing.

The game has two acts. The second begins seven years after the first ends and adds a way of writing that the first act never offered.

## Play

Run `play.cmd` on Windows. It installs the dependencies the first time, builds the game, starts a local server, and opens http://localhost:8742/. Node 18 or newer is required.

On other systems, run these commands in this folder:

```bash
npm install
```

```bash
npm run build
```

```bash
npm run serve
```

## Controls

| Key | Action |
|---|---|
| Arrows or WASD | Move, and move through menus |
| Z, Enter, or Space | Confirm, talk, read |
| X or Esc | Go back, open the menu |
| C | Cast a page at whatever Wait is facing |
| R | Read the rote of whatever Wait is facing, or a foe in battle |
| Tab | Show what to do next |
| Shift | Hurry |
| M | Mute |

In the editor you type code. Tab completes the word under the cursor, F1 explains it, F5 runs the page on the test bench against any foe you have met, F2 renames the page, Page Up and Page Down switch pages, and Ctrl+L copies in a page from the Library. Ctrl+Z and Ctrl+Y undo and redo. Ctrl+C, Ctrl+X, and Ctrl+V work on the current line. Ctrl+E puts the whole page on the system clipboard.

## The Cant in one screen

```
# an aside. it does not run.
strike foe            # 3 harm, 1 ink
repeat 3: strike foe  # three times
if foe.hp < 4:
  strike foe
else:
  soak foe            # wet things take more from jolt
wait                  # stop here, go on next turn
each f in foes: strike f
when ally hurt: mend who
halt                  # end this spell now
say "hello", me.ink
into foe: wait        # act 2: write a line into another rote
stet me               # act 2: cross out what was written into you
when written: stet who
```

The game teaches the language a piece at a time. Gloss's Primers explain each word, companions lend their words while they are up, enemies drop pages you can read and copy, and the Grammar (the skill tree) buys new verbs, functions, and more room.

In the second act Wait can write into other rotes. A line written into a foe runs first thing on its next turn, with the foe's own `me` and `foe`, so `into foe: strike me` makes a foe hit itself with all of its strength. Foes write back: some write `halt` into the top of your pages, some rewrite them so your harm turns on you, and some write lines into you or into each other. A `when written:` line answers the moment something writes into you. In the field, writing into things moves the world: a loose word grows into a bridge, and a walker learns to turn. People refuse to be written into.

## Away from the story

- **The Margin**, at any lectern: short puzzles that are cast once against pencil figures and scored on lines, ink, and steps against Gloss's own answer. New problems appear as you learn new words.
- **Stet**, a card game played with the pages you collect, against thirteen people across the world, each with a regional rule.
- **Reeling**, at line posts by the ink: every catch has a rote that says when it pulls and when it rests. Twenty kinds, each with a note.
- **Puzzle rooms** off the main maps, where things with small rotes answer your verbs: lumps that roll, seeds that grow, halted people who can be nudged.
- **Carry**, a merchant who is always somewhere already, sells salves, seals for pages, and permanent upgrades, and gives rides to any place you have been.

## Structure

| Path | Contents |
|---|---|
| `src/cant` | The language: parser, analyzer, interpreter, vocabulary |
| `src/game` | Battle engine, field, editor, menus, maps, enemies, movers, the Margin, shops, save data |
| `src/game/stet` | The Stet card game |
| `src/engine` | Pixel buffer, palette and lighting, font, sprites, battle backdrops, music, sound |
| `src/story/script.txt`, `src/story/act2.txt` | Every scene of both acts |
| `src/tools` | Tests, the balance simulator, the Stet checks, a browser test harness |

## Tests and balance

`npm test` checks the parser on good and bad programs, runs battle smoke tests, and validates the content: every scene a map or command points to exists, every map exit lands on open ground, every exit, trigger, and talkable character can be reached, every Margin answer scores exactly what it says, and every mover puzzle is solved by simulation.

`npm run sim` plays every fight of both acts in story order with three scripted players who write spells of different quality, carrying levels, marks, and skill purchases from fight to fight. It reports win rates, rounds, and the lowest health reached, plus summary measures of tension and skill gap. Pass a number to change how many seeds each fight runs, for example `npm run sim -- 40`.
