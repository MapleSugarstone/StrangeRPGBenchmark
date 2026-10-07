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
| Rote | Claude Opus 5.5, Medium | `StrangeRPGBenchmarkOpusMagic` | Playable |

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
- `folder` is the game's folder.
- `status` is `playable`, or `wip` for a game without a build. A `wip` cartridge carries a work-in-progress tape and its Start button stays disabled.
- The optional `golden` set to `true` marks a standout game. Its cartridge has a gold shell with a band of light that crosses it and white sparkles at its edges, and its preview lists it as a golden edition. With reduced motion turned on, the shine and sparkles hold still.
- `build` holds the `command` to run in the folder, the `dist` output folder, and an optional `exclude` list of output files to leave out. A `wip` game has no `build`.
- `colors` holds the `accent` and `ink` colors of the label.
- `hero` holds the character's `name`, `role`, and `sprite`.
- `scene` is the screenshot on the label, and `shots` lists the extra screenshots.
- `chapters`, `blurb`, and `controls` fill the preview.
