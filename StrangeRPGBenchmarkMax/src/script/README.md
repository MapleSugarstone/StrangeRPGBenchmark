# Scene scripts

Every scene in the game lives in these text files. The game reads them at build time, so a rewrite pass can change any spoken line without touching code.

## Format

A scene starts with `== scene_id` and runs until the next `==`.

| Line | Meaning |
|---|---|
| `Speaker: text` | A spoken line in a dialogue box. The speaker's name picks the portrait and voice. `{name}` is the hero's name. |
| `(text)` | A system line with no speaker and no voice. |
| `> command args` | A stage command. A trailing `&` runs it without waiting. |
| `? prompt` | Starts a choice. The prompt may be empty. |
| `- text -> label` | A choice option. The hero says the text, then the scene jumps to the label. Without `-> label` the scene continues. |
| `* label` | A jump target inside the scene. |
| `# text` | A comment for writers. The game ignores it. |

## Commands

| Command | Effect |
|---|---|
| `walk actor @marker` or `walk actor x y` | Walks along a path and waits until the actor arrives. |
| `step actor dir [n]` | Steps in one direction. |
| `face actor dir` or `face actor other` | Turns an actor. |
| `enter actor @marker` | Puts an actor at a door or off-screen marker, ready to walk in. People never appear in view. |
| `exit actor` | Removes an actor after it walks through a door or off the map. |
| `emote actor kind` | Shows a bubble: `!`, `?`, `...`, `heart`, `note`, `sweat`, `angry`. |
| `camera @marker [seconds]`, `camera actor [seconds]` | Pans the camera. `camera free` returns it to the hero. |
| `wait seconds` | Pauses. |
| `music track`, `sfx sound` | Changes the music (tracks melt into each other) or plays a sound. |
| `shake [strength]`, `fade out`, `fade in` | Screen effects. |
| `lamp actor` or `lamp @marker`, `lamp off` | Lights the scene lamp. Its light arrives before its flame. |
| `turn target dir` | Swings a lead, and the thing follows it. |
| `set flag`, `unset flag` | Story flags. |
| `if flag -> label`, `ifnot flag -> label` | Conditional jumps. |
| `give item [n]`, `take item [n]`, `mites n` | Items and money. |
| `join who`, `leave who` | Party changes. |
| `battle group` | Starts a scripted battle. |
| `goto label` or `goto scene_id` | Jumps. |
| `warp map @marker` | Moves the hero to another map. |
| `chapter n title` | Shows a chapter card. |
| `letter id` | Shows one of Tib's letters. |
| `shop id`, `sticks opponent`, `post` | Opens a shop, a game of Sticks, or the dial post menu. |
| `anim name` | Plays a named map animation. |
| `lock`, `unlock` | Stops and returns player control. |
| `heal` | Restores the party. |
| `end` | Ends the scene. |
