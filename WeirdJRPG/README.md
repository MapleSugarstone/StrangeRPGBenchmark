# The Void-Pilgrim Chronicles

The Void-Pilgrim Chronicles is a tile-based role-playing game in a 224 by 224 pixel window, built from the design bible in this folder. Qwen 3.5 9B wrote the bible through Scoobert. Claude Opus 5.5 implemented and polished the game.

You play the Pilgrim, a consciousness whose shell has just bloomed off. You wake beside it on a brass plaza where the sun is always setting. Everything you walk past starts to come apart. You fight by taking things apart too: stripping shells, and extracting memories, emotions, and names. The way leads down through the Between-Sea to the Stone of Herself, where three endings wait.

## Play

Run `play.cmd` on Windows. It installs the build tools the first time, builds the game, starts a local server, and opens http://localhost:8751/. Node 18 or newer is required.

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
| Z, Enter, or Space | Confirm, talk |
| X or Esc | Go back, open the menu |
| C | Open your six senses |
| Tab | Follow the scent of your goal |
| Shift | Hurry, and speed up text |
| M | Mute |

## The game

- **Fragility** is your health and the cost of everything at once. Hits and abilities spend it, and taking things apart gives it back. Below a fifth you are Faded, and above four fifths you are Overloaded and reality breaks around you each round. Steadying points save the game and set Fragility to the safe middle.
- **Concept Combat**: every enemy is layers of Shell, Memory, Emotion, and Name. Strip peels the outside, Extract pulls an inner layer, Absorb takes a held concept into you or pushes it into an enemy, Weave fuses two, and Unmake removes a thing from existence. Each removed layer changes the enemy, and an ordinary enemy comes apart once half of its layers are gone.
- **Essence reactions**: emotions fall into bright, dark, and wild families. The same family feeds an enemy, bright against dark overwhelms it, and wild unbalances it. Each kind of enemy reacts to one thing you do: Shell-Bound enemies brace after a Strip, Memory-Struck enemies steal the memories you carry, Emotion-Fed enemies eat the feelings you carry, Conceptual enemies hit harder the more Fragility you have, and Void-Touched enemies eat a weak shell first.
- **Wind-ups**: heavy attacks take a round to wind up and show colored locks. A hit of the matching layer breaks a lock, and breaking them all cancels the attack. Vorn breaks Shell locks and #123 breaks Emotion locks. Some enemies guard the ones behind them, and some mend their allies.
- **Approach**: battles happen on a track of cells. You walk, slide, float over ground attacks, or weave through an enemy to reach the one behind it. Vorn hits shells and guards you. Light-Bound #123 cooks.
- **The six senses** work in the field and in battle: Sight, Touch, Hearing, Taste, Smell, and Thought, each with a passive, an active, and an ultimate.
- **The Collector**: shells are equipment, memories heal, names rename things in the world, and unmade enemies leave concepts you can slot. Four collection quests and one secret quest run alongside the story.
- **The Unfolding Map**: places start as shifting static and reveal themselves as you walk. Some water forgets where you have been.
- **Light**: every area has its own ambient light and palette. Lamps, crystals, and #123 give off light, and the Void drinks it.

## Folders

- `src/battle`: the battle engine, pure logic with no page code.
- `src/engine`: screen, font, input, lighting, palette, the rasterizer, and the audio engine.
- `src/game`: field, dialogue, menus, battle view, and save state.
- `src/content`: the five areas and their scripts.
- `src/tools`: the playtest (`npm run playtest`), the battle simulator (`npm run sim`), a one-fight trace, and the music checker.
