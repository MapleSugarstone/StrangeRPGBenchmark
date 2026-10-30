# Strange RPG Benchmark

This repository holds tile-based role-playing games that different AI models wrote, plus a menu page that shows each game as a cartridge. GitHub Pages hosts the menu and the playable builds.

| Cartridge | Model | Folder | Status |
|---|---|---|---|
| Patchwork | Qwen 3.8 27B, Medium, through Scoobert (polished by Opus 5.5, Medium) | `StrangeRPGBenchmarkScoobert` | Playable |
| Duotone | Claude Opus 5.5, Ultracode | `StrangeRPGBenchmarkClaude` | Playable |
| The Long Noon | Claude Sonnet 5.5, Medium | `StrangeRPGBenchmarkSonnet` | Playable |
| The Moth Crown | Claude Fable 5.1, Ultracode | `StrangeRPGBenchmarkFable` | Playable |
| Please Hold | Claude Opus 5.5, Ultracode | `StrangeRPGBenchmarkOpusMore` | Playable, golden |
| Plumb | Claude Fable 5.1, Ultracode (polished by Opus 5.5) | `StrangeRPGBenchmarkFableMore` | Playable, golden |
| Rote | Claude Opus 5.5, Ultracode (polished by User) | `StrangeRPGBenchmarkOpusMagic` | Playable, diamond |
| Whorl | Claude Opus 5.5, Ultracode (polished by User) | `StrangeRPGBenchmarkOpusMonsters` | Playable, diamond |
| Too Many Doors | Lovebert 2, No thinking, through Scoobert (polished by Opus 5.5) | `StrangeRPG5/StrangeRPG5` | Playable |
| The Void-Pilgrim Chronicles | Qwen 3.5 9B, Low, through Scoobert (implemented and polished by Opus 5.5, Ultracode) | `WeirdJRPG` | Playable, golden |
| Checksum | Claude Opus 5.5, Extra high | `StrangePuzzleGame` | Playable, golden |
| Fathom | Claude Opus 5.5, Max | `StrangeRPGRobots` | Playable, diamond, in progress |
| Spore-Weaver | Qwen 3.6 35B A3B, No thinking, through Scoobert (polished by Opus 5.5) | `OddRPG` | Playable |

## Menu

Each cartridge opens a preview, and the preview's Start button runs the game inside the page. The Menu button in the top-left corner returns to the cartridges. Arrow keys move between cartridges and Enter opens one. The side arrows, the dots, Page Up and Page Down, the mouse wheel, and a horizontal swipe all change the page. The menu adds a page whenever the cartridges fill the current one.

## Site build

`tools/build-site.mjs` builds every game that has a build step and copies the menu and the builds into `_site/`. The script needs Node 18 or newer.

```bash
node tools/build-site.mjs --serve --open
```

`--serve` serves `_site/` at http://localhost:8080/ and accepts a port number after it. `--open` opens the site in a browser. `--skip-build` reuses the existing game builds. On Windows, `play.cmd` runs the same build, serves the site, and opens it.

The workflow in `.github/workflows/pages.yml` runs the same script on every push to `main` and publishes `_site/` to GitHub Pages. The Pages source is set to GitHub Actions, so built files are never committed.

## Game requirements

Each game lives in its own folder at the repository root. Its build writes `index.html` and its scripts into one output folder, and every path in that `index.html` is relative. All games share one origin on GitHub Pages, so each game uses browser storage keys that no other game uses.

Cartridge art lives in `menu/art/`. Each game has its main character as a small PNG with a transparent background and a square screenshot of a scene. Extra screenshots are optional and appear in the preview.

## games.json

`games.json` lists every cartridge. Each entry has these fields:

- `id` names the game in the address. The site serves the build from `games/<id>/`.
- `title`, `model`, `effort`, and the optional `agent` appear on the label and in the preview.
- The optional `polish` names the model that polished another model's game. The label shows it as "Polished by: <polish>".
- The optional `polishVerb` replaces "Polished" in that label, for a game that model also built, such as "Implemented and polished".
- `folder` is the game's folder.
- `status` is `playable`, or `wip` for a game without a build. A `wip` cartridge carries a work-in-progress tape and its Start button stays disabled.
- The optional `golden` set to `true` marks a standout game. Its cartridge has a gold shell with a band of light that crosses it and white sparkles at its edges, and its preview lists it as a golden edition. With reduced motion turned on, the shine and sparkles hold still.
- The optional `diamond` set to `true` marks a game built over many more follow-up prompts. It outranks `golden`. Its cartridge has a pale cut-crystal shell with facets, a rainbow sheen that crosses it, and glints in prism colors, and its preview lists it as a diamond edition.
- `build` holds the `command` to run in the folder, the `dist` output folder, and an optional `exclude` list of output files to leave out. A `wip` game has no `build`.
- `colors` holds the `accent` and `ink` colors of the label.
- `hero` holds the character's `name`, `role`, and `sprite`. The optional `forms` lists sprites of the same size, starting with `sprite`. Each hover over the cartridge moves the hero to its next form through an ordered dither.
- `scene` is the screenshot on the label, and `shots` lists the extra screenshots.
- `chapters`, `blurb`, and `controls` fill the preview.
- The optional `soundtrack` names the game's soundtrack script in its build output, such as `"soundtrack.js"`. The game then appears on the Soundtrack screen. The optional `soundtrackGain` is a level trim in decibels for the whole album, so every album plays at about the same loudness.

## Soundtracks

The Soundtrack screen plays each game's music as an album. Open it with the disc button in the top-right corner, or with the Soundtrack button in a game's preview. A game joins when its build writes a soundtrack script next to its `index.html` and its `games.json` entry names that script.

The menu loads the script into a hidden frame whose base URL is the game's folder. The script sets `window.soundtrack` to an object with these members:

- `tracks` lists the album in play order. Each track has an `id`, a `title`, and the optional fields below.
- `start(id, ctx, out)` starts a track on the menu's AudioContext `ctx` and connects every sound to the AudioNode `out`. It may return a promise. The script never creates an AudioContext of its own and never connects to `ctx.destination`.
- The optional `change(id, value)` applies one of the current track's changes. `value` is `undefined` for a button, a boolean for a switch, and the index of the chosen step for a choice.

The menu stops a track by fading `out` and removing the frame, which also stops the script's timers. A soundtrack script needs no stop function.

These optional fields describe a track:

- `length` is the number of seconds in one loop of a composed track. The menu plays at least two loops and 90 seconds, then fades out over the start of the next loop. A track without `length` is generated, and it plays for the time the listener picks from 1 to 10 minutes.
- `once` set to `true` marks a track that ends instead of looping, such as a fanfare. It plays for `length` seconds.
- `changes` lists buttons for what the music reacts to in the game. Each change has an `id` and a `label`. A change with no other field is a button. `toggle: true` makes it a switch, and `steps` (a list of labels) makes it a choice. `value` sets the starting state of a switch or a choice.

`tools/check-soundtrack.mjs` checks a built soundtrack script without a browser. It plays every track for 20 seconds against a stand-in for Web Audio, presses every change, and reports errors, silent tracks, and sound that skips `out`.

```bash
node tools/check-soundtrack.mjs StrangeRPGBenchmarkSonnet/dist/soundtrack.js
```
