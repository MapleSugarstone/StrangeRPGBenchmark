# Maps

Each map is a `MapDef` (see `src/world/map.ts`) in a `.ts` file in this folder, registered in `index.ts`. Tiles are 10 by 10 pixels and the view shows about 20 by 15 tiles, so a small street fits on one screen and a district map runs 40 to 70 tiles on a side.

## The grid

`rows` is an array of equal-length strings. Each character is a tile or a prop. A prop character stands on the walkable tile that surrounds it most, so a vending machine on a boardwalk sits on planks.

### Tiles

| Char | Tile | Notes |
|---|---|---|
| `.` | wet concrete | the default street floor, reflects faintly |
| `,` | cracked concrete | |
| `_` | boardwalk | planks over water |
| `=` | grate | metal walkway, dry |
| `:` | road | asphalt |
| `o` | puddle | reflects strongly |
| `w` | shallow water | walkable, makes units Wet, carries shock |
| `~` | canal | deep water, cannot be walked, reflects strongly |
| `r` | railing over water | blocks movement, half cover |
| `m` | moss | |
| `%` | rubble | |
| `t` | tile floor | interiors |
| `p` | carpet | interiors |
| `q` | marble | the Stair and the Brim |
| `n` | steel floor | Board buildings |
| `s` | stairs | changes elevation |
| `H` | ladder | changes elevation |
| `|` | low wall | blocks movement, half cover, does not block sight |
| ` ` | void | nothing. With `below: true` the void shows the city far below |
| `#` | megablock wall | two-tile facade with lit windows, then roof |
| `K` | shipping containers | one-tile facade, ribbed metal in mixed colors |
| `S` | shack | corrugated metal, one-tile facade |
| `G` | shopfront | dark glass with a lit band, one-tile facade |
| `X` | seawall | steel, two-tile facade |
| `I` | interior wall | one-tile facade |

A wall tile draws a facade when the tile south of it is not a wall, and a roof otherwise. Draw buildings as solid blocks of wall characters at least two tiles deep so the roof shows.

### Props

| Char | Prop | Blocks | Cover | Notes |
|---|---|---|---|---|
| `V` | vending machine | yes | half | cyan light, sells drinks and stims, wakes to throw cans |
| `U` | noodle vending | yes | half | magenta light |
| `D` | dumpster | yes | half | wakes to swallow and spit |
| `c` | crate | yes | half | |
| `b` | barrel | yes | half | |
| `e` | fuel drum | yes | half | explodes when shot |
| `L` | streetlamp, sodium | yes | none | amber light |
| `l` | streetlamp, cold | yes | none | white-blue light |
| `v` | steam vent | no | none | steam blocks sight |
| `P` | pillar | yes | full | |
| `k` | counter | yes | half | bars, shops |
| `Q` | terminal | yes | half | readable, hackable |
| `Y` | trash can | yes | half | |
| `J` | junction box | yes | half | hackable, shocks |
| `N` | noodle stall | yes | half | two tiles wide, amber light, steam |
| `R` | car | yes | half | two tiles wide |
| `j` | table | yes | half | |
| `h` | chair | no | none | |
| `Z` | bed | yes | half | two tiles tall |
| `F` | shelf | yes | full | lootable |
| `O` | locker | yes | full | lootable |
| `x` | stash box | yes | half | lootable |
| `g` | sandbags | yes | half | |
| `y` | mooring post | yes | half | |
| `i` | pipes | yes | half | |
| `W` | speaker stack | yes | full | |
| `f` | forklift | yes | half | wakes to throw people |
| `u` | turret | yes | half | hackable |
| `z` | planter | yes | half | |
| `T` | bollard | yes | half | small amber light |
| `M` | washing machine | yes | half | |

Props without a character (`door`, `mat`, `flag`, `jar`, `case`, `statue`, `tv`, `boat`) go in the `props` list with `{ kind, x, y }`. Any prop in that list can carry `woken: true` (it breathes, the tell of a woken thing), `id`, `scene` (a scene run when the player presses Z on it), `loot` (a loot table id), `showIf`, and `hideIf`.

## Other fields

- `ambient` and `ambientLevel`: the night light, for example `0x4a5aa8` at 0.2 outdoors and 0.35 indoors.
- `rain`: 0 to 1. `inside: true` for interiors.
- `music`: a track name from `src/audio/sfx.ts`.
- `signs`: neon text or icons on facades: `{ x, y, text: 'NOODLE', color: C.mag3, light: LIGHT.magenta }` in tile units (fractions allowed). Icons: bowl, eye, drop, cross, heart, bolt, glass, hand, fish, pill, chip, wrench, star, key, wave, arrow. Pure red is the Board's: only Board signs use `C.red2` and `LIGHT.red`.
- `lights`: `{ x, y, r, i, color }`, position in tiles, radius in pixels, intensity about 0.6 to 1.2.
- `markers`: named tiles for scenes and exits, `{ start: [10, 6] }`.
- `exits`: `{ x, y, w, h, to: 'map_id', at: 'marker' }`. Stepping on the area moves the party.
- `triggers`: `{ x, y, w, h, scene, once }`. Stepping into the area runs the scene.
- `npcs`: `{ id, at: [x, y] or '@marker', look, dir, talk: 'scene_id', wander: 2, path: [[x,y],...], showIf, hideIf, bark: ['line', ...] }`. `look` is a key in `src/art/cast.ts` LOOKS, `courtesy`, `patrol`, `drone`, or `crowd:<number>` for a random passerby. `bark` lines float over the NPC when the party walks past. `pocket: 'item_id'` lets a sneaking hero lift that item from behind with a Sneak check; a failed lift sets flag `caught_<npc id>` and runs the NPC's talk scene. Sneaking up behind an unaware hostile and pressing Z tries a takedown (a Sneak check) that knocks it out without a fight.
- Encounters may also carry `tide: { top, bottom, perRound }` (rows that flood one per round from `bottom` up to `top` during the fight) and `music` (a track for that fight, such as `boss`).
- Encounters also take `allies: [{ kind, at, dir, id, look, name }]` (units on the party's side that the game controls; they are downed rather than killed and stand back up as NPCs after the fight), and `simParty: ['courtesy', ...]` plus `simLevel: n` (who is in the party and at what level when the fight happens in the story, for the balance simulator).
- Props in the `props` list also take `hushed: true` (frosted from load) and `tapeIf: 'flag'` (Board tape across it while the flag holds).
- At camp, recruited companions outside the active party stand at markers `camp_<id>` and run scene `camptalk_<id>`.
- Quests in `src/content/quests.ts` take `where: { '<stage>': ['map', 'marker'] }`, which draws a target diamond on that map.
- `encounters`: `{ id, units: [{ kind, at: [x, y], dir }], start: 'sight' or 'script', showIf, hideIf, win: 'scene_id', alert: 'scene_id' }`. Unit kinds are enemy kinds from `src/rules/data.ts`. A 'sight' group starts a fight when one of its members sees the party. A 'script' group waits for `> fight id`.
- `bailers`: `{ name, path: [[x, y], ...] }` for Bailers walking a canal loop.
- `below: true` for maps on high edges.
- `enter`: a scene to run every time the party arrives.
