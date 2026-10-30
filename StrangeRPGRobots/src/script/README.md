# Scene scripts

Every scene lives in the `.txt` files in this folder. The build reads them as text, so a rewrite pass can change any spoken line without touching code. `scripts/lines.mjs` exports and imports the player-facing lines for naturalizing.

## Format

A scene starts with `== scene_id` and runs until the next `==`.

| Line | Meaning |
|---|---|
| `Speaker: text` | A spoken line. The speaker id picks the name, sprite, color, and voice from `src/content/speakers.ts`. Unknown ids show as written. |
| `PORT: text` | The hero's port speaks. It has no name tag and a cyan box. |
| `(text)` | A system line with no speaker. Keep these rare. |
| `> command args` | A stage command. A trailing ` &` runs it without waiting. |
| `? prompt` | Starts a choice. The prompt may be empty. Options follow on the next lines. |
| `- text -> label` | A choice option. It jumps to the label (or scene id). Without `-> label` the scene continues. |
| `* label` | A jump target inside the scene. |
| `# text` | A comment for writers. |

The hero never has a speaker line. The hero speaks only through choices. `{name}` is the hero's name and `{port}` is the port's name.

### Option prefixes

Prefixes go before the option text, in any order:

| Prefix | Meaning |
|---|---|
| `[Talk 2]` | A dice check. The party member with the biggest pool rolls. The option needs two targets: `-> pass_label \| fail_label`. Skills: Shoot, Strike, Hack, Tech, Sneak, Talk, Notice, Athletics. Thresholds 1 to 4 (1 easy, 2 normal, 3 hard, 4 very hard). |
| `{tova}` | Shown only when that companion is in the active party. |
| `<diver>` | Shown only when the hero's class matches (blade, diver, rigger, mouth). |
| `?flag` | Shown only when the condition is true. `?!flag` when it is false. |
| `$50` | Costs 50 gilt. Greyed out when the party cannot pay. |

### Conditions

Anywhere a flag is read (`if`, `ifnot`, `?flag`, `showIf`, `hideIf`), these forms work: `name` (a story flag), `!name`, `a&b`, `a|b`, `party:tova` (in the active party), `roster:tova` (recruited and alive), `class:diver`, `chapter>=2`, `approval:tova>=20` and `approval:tova<-10` (approval runs from -50 to 50), `quest:bear` (started), `quest:bear=2` (at stage 2 or later), `quest:bear=done`, `item:case`, `bg:washout` (the hero's background), `rep:lockjaws>=3` and `rep:board<-2` (faction standing), `rel:tova-ignace>=2` (two companions, either order), `visited_market` (set on every arrival at a map), and `bear_missed` (a quest that expired).

Registries for the replay systems live in `src/content/replay.ts`: `addTravel` for travel destinations (with per-chapter `variants`), `addEvents` for world events (scenes that fire on arrival, rolled from the save's seed), and quest `expires: <chapter>` in `src/content/quests.ts`. The design is in `Notes/replay-design.md`.

## Commands

| Command | Effect |
|---|---|
| `lock`, `unlock` | Stops and returns player control. Scenes lock on their own while they run. |
| `walk actor @marker` or `walk actor x y` | Walks along a path and waits. `run` is the same at a run. Actors: `hero`, a companion id, or an NPC id on the map. |
| `step actor dir [n]` | Steps in a direction (`up`, `down`, `left`, `right`). |
| `face actor dir` or `face actor other` | Turns an actor. |
| `enter actor look @marker` | Places an actor at a marker that is off screen or in a doorway, ready to walk in. People never appear in view. |
| `exit actor` | Removes an actor after it has walked off screen or through a door. |
| `emote actor kind` | A bubble: `!`, `?`, `...`, `heart`, `note`, `sweat`, `angry`, `zzz`. |
| `camera @marker [seconds]`, `camera actor [seconds]`, `camera free` | Pans the camera. |
| `wait seconds` | Pauses. |
| `music track`, `sfx sound` | Changes the music (tracks melt into each other) or plays a sound. |
| `shake [strength]`, `fade out [s]`, `fade in [s]` | Screen effects. |
| `set flag [n]`, `unset flag` | Story flags. |
| `if cond -> label`, `ifnot cond -> label` | Conditional jumps. |
| `ifgilt n -> label`, `ifapprove id n -> label`, `ifhold n -> label`, `ifself n -> label` | Jumps on money, approval, and the port's meters. |
| `goto label` or `goto scene_id` | Jumps. |
| `warp map @marker [dir]` | Moves the party to another map with a fade. |
| `chapter n Title` | Shows a chapter card and sets the chapter. |
| `give item [n]`, `take item [n]`, `gilt n` | Items and money (`gilt -50` pays). |
| `xp n` | Experience for the whole roster. |
| `join id`, `leave id` | Party changes. |
| `approve id n [id n ...]` | Approval changes. `approve tova 2 sallis -1`. |
| `rep faction n` | Faction standing, -10 to 10, with a toast. Factions are in `src/content/replay.ts`. `rep lockjaws 2`. |
| `rel a b n` | The relationship between two companions, -10 to 10. `rel tova ignace -2`. |
| `perk id perk` | Gives a member a perk, for Devoted companions and background rewards. |
| `travel` | Opens the travel list (every visited place, by district) and moves the party to the pick. Taxis, boats, and hatches call it. |
| `quest id stage [note]` | Starts or advances a quest. `stage` is a number, `done`, or `fail`. Journal text comes from `src/content/quests.ts`. |
| `fight encounter` | Starts a fight with an encounter group defined on the current map. The scene continues after a win. A loss loads the last save. |
| `hostile npc [encounter]` | Turns an NPC hostile and starts a fight with it and its encounter group. |
| `shop id` | Opens a shop from `src/content/shops.ts`. |
| `rest` | A long rest at camp, with camp scenes. |
| `name port` | Opens name entry for the port. |
| `hold n`, `self n` | Changes the port's Hold or Self. |
| `mood tova feeling` | Sets Tova's mood: anger, fear, calm, joy, grief. |
| `check skill n -> pass \| fail` | A dice check outside a choice. |
| `heal`, `edge` | Restores the party's HP, or its Edge. |
| `autosave` | Saves to the autosave slot. |
| `look actor lookid` | Changes an actor's sprite. |
| `toast text` | A short notice at the top right. |
| `anim name args` | A named map animation from code. Names: `spill x y` (a burst of witch blood), `spotlight on`/`off`, `flash`, `breathe id` (an actor or prop starts breathing), `still id`, `hush id` (frost a prop or actor), `down actor` (falls and lies still), `rise actor` (a flyer lifts off the top of the screen and is removed), `shift prop x y` (a prop slides to a tile), `break prop` (a prop falls apart into breathing debris), `hull on`/`off`/`x y w h` (the map, or a tile rectangle, breathes like a woken barge), `ride npc`/`ride off` (the party boards an NPC and moves with it), `tape flag`, `sparks x y`, `splash x y`, `smoke x y`, `shake n`, `bailer` (a giant footstep). |
| `ending` | Plays the ending. |
| `party` | Opens the party picker (use it at camp). |
| `campmap map` | Makes another map the camp (the crypt in act 2). The map needs a `start` marker. |
| `leavecamp` | Leaves camp and returns to where the party rested. |

## Details

Details are small things to look at, registered with `addDetails` in a `src/content/details_*.ts` file (`details_market.ts` is the style reference). The player faces the tile and presses the action key. Holding Q marks every detail and interactable in view, in amber until it has been looked at.

- **What a detail can hold:**
  - `text`, with `|` between lines.
  - `port`, either a string or comments keyed by chapter (`{ 1: 'Gone.', 2: 'She meant to come back.' }`), so the port keeps its chapter voice.
  - `party` lines by companion id. The first companion in the party who has a line speaks.
  - `check`, a passive skill line. It shows, with the skill as speaker (NOTICE, TECH, and so on), when the party's best dice pool for that skill reaches `need`. Pools run about 3 untrained, 5 good, and 7 expert.
  - `reward` (gilt, item, xp, or flag), given once.
  - `lore`, which unlocks a journal entry registered with `addLore`.
  - `scene`, which runs a full scene for details that open a small quest.
  - `when` and `hideIf`.
- **Where it can go:** the tile must have a walkable neighbor, because the player inspects the tile they face. `npm test` checks this.
- **Lore:** `> lore id` unlocks a lore entry from a scene. The journal's Lore tab lists entries and counts the details found.
- **Skill voices:** NOTICE, TECH, HACK, TALK, SNEAK, ATHLETICS, SHOOT, and STRIKE are speakers, so scenes can use them too.

## Style

Read `Notes/bible.md`, section "Writing guide", before writing. Lines stay under 100 characters and mostly under 60. No em dashes, no semicolons. Almost no system lines: show events with walking, facing, emotes, sound, and the map.
