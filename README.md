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

## Use the menu

Click a cartridge to open its preview, then press Start to play the game inside the page. Menu in the top-left corner returns to the cartridges. Arrow keys move between cartridges and Enter opens one. The side arrows, the dots, Page Up and Page Down, the mouse wheel, and a horizontal swipe all change the page.

## Preview the site locally

On Windows, double-click `play.cmd`. It builds every game, serves the site at http://localhost:8080/, and opens it in your browser. Close the window to stop the server.

On any system, run the build script directly:

```bash
node tools/build-site.mjs --serve --open
```

The script builds every game that has a build step and copies the menu and the builds into `_site/`. It then serves `_site/` at http://localhost:8080/. Add `--skip-build` to reuse the existing game builds, and put a port number after `--serve` to use another port. The script needs Node 18 or newer.

## Publish on GitHub Pages

1. Push the repository to GitHub with `main` as the default branch.
2. Open Settings, then Pages, and set Source to GitHub Actions.
3. Push to `main`, or run the Deploy to GitHub Pages workflow from the Actions tab.

The workflow in `.github/workflows/pages.yml` runs `tools/build-site.mjs` and publishes `_site/`. Built files never need to be committed.

## Add a game

1. Put the game in its own folder at the repository root. Its build must write `index.html` and its scripts into one output folder, and every path in that `index.html` must be relative.
2. Add the cartridge art to `menu/art/`. You need the main character as a small PNG with a transparent background and a square screenshot of a scene. More screenshots are optional and appear in the preview.
3. Add an entry to `games.json` and run `node tools/build-site.mjs --serve` to check it.

Each entry in `games.json` has these fields:

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

The menu adds a page whenever the cartridges fill the current one. All games share one origin on GitHub Pages, so a new game must use browser storage keys that no other game uses.
