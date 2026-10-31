# Rewriting the game text

This folder holds every line of player-facing text in the game as plain text, so you can rewrite it with any model or by hand and import it back without touching the code.

## Files

- `whorl-text.txt` holds every line in one document, in three sets. The story set is dialogue, narration, signs, hints, goals, guide pages, and Register entries. The interface set is battle messages, menu sentences, item text, and minigame text. The rules set is move, passive, and notion text, which follows the templates in `Notes/ability-text-style.md`.
- `lines/*.txt` holds the same lines in chunks of about 20,000 characters each, in story order. Each line is `[id] speaker | text`.
- `terms.json` lists the game's key terms with what each one means. `terms.md` is the table built from it, with how many lines use each term and names the Naturalizer suggests.
- `naturalize/` holds the Naturalizer pass: `natural.txt` (accepted rewrites), `turned-down.txt` (rewrites the guards turned down, for review), `state.json` (so a stopped run resumes), and `prompt-test.md` (prompt comparisons).
- `style.md` lists the patterns from your `Writing Examples.txt`. Give it, `cast.md`, and the examples file to the rewriting model with every chunk.
- `cast.md` describes every speaker, with their voice and the one way each of them bends English.
- `speakers.txt` counts lines per speaker.
- `skipped.txt` lists strings the export left out on purpose: names, map names, labels in capitals, and choice labels the code compares by value. Changing those would break the game.
- `.export.json` is the importer's record of where every line lives. Do not edit it.

## Steps

1. Run `node scripts/lines.mjs export` from the project root. The `lines` folder already holds a fresh export.
2. For each chunk, give the rewriting model the prompt below, then `cast.md`, then the chunk. Save its answer over the chunk file. A chunk plus `cast.md` plus the answer comes to about 20,000 tokens, so a 64k model has room. For more room per call, export with `--chunk=30000`.
3. Run `node scripts/lines.mjs import --dry` and read `import-report.md`. It lists rejected lines with the reason, plus warnings such as a dropped character name.
4. Fix rejected lines in their chunk, or leave them as they are. Then run `node scripts/lines.mjs import`. The importer writes the source, checks types, and runs the content validator. If the type check fails, it undoes the import by itself.
5. Run `node scripts/lines.mjs export` again before the next round. Ids only match the export they came from.

To undo the last import, run `node scripts/lines.mjs restore`.

## Steps with the Naturalizer

The Naturalizer runs on the desktop and is reached through `Documents/Naturalizer-API/naturalize.py`.

1. Run `node scripts/lines.mjs export`.
2. Run `python scripts/naturalize_terms.py` to rebuild `terms.md`. Make any renames in the source before the pass, then export again.
3. Run `python scripts/naturalize_prompt_test.py "prompt one" "prompt two"` to compare prompts on a fixed sample. Read `naturalize/prompt-test.md`.
4. Run `python scripts/naturalize_run.py "prompt"` in the background. It covers the story and interface sets. Add `--sets story,ui,rules` to include the rules set, and `--push` to send each unchanged line back once for new words. Progress is in `Notes/naturalize-progress.txt`. Create `naturalize/stop` to stop after the batch in hand. Run the same command again to resume.
5. Run `node scripts/lines.mjs import dialogue/naturalize/natural.txt --dry`, read `import-report.md`, then import without `--dry`.

The pass keeps only mechanical guards: every `{placeholder}` and number kept, the box length limits below, banned words, lowercase and capital-letter speakers kept in their case, and dashes and semicolons turned into commas and periods. A rewrite that turns a name into an ordinary word, or the reverse, goes back to the model with a note.

## What the importer rejects

- A line whose `{placeholder}` set changed. Each placeholder must appear exactly once.
- A line whose numbers changed. Numbers are levels, counts, prices, and puzzle facts.
- A game line over 100 characters, counting each placeholder as 8. The text box holds no more. To say more, split the line into several boxes with ` // ` between them. Each box must fit in 100 characters. Spoken lines, narration, NPC line lists, and look text can split. Trainer intros and a few one-off strings cannot, and the report says so.
- An interface line that grows by more than a quarter of its length, or by more than 8 characters when it is short. Interface lines never split.
- A rules line over 70 characters, or over its current length when that is longer.
- Em dashes, en dashes, semicolons, and the validator's banned words (`src/tools/test.ts`, the `banned` list). Edit that list if you want to allow any of them.
- Empty lines.

A line missing from the answer keeps its old text. A line whose `[id]` the model changed or lost is ignored.

## Prompt for the rewriting model

> You are rewriting the dialogue of a strange old console game. The attached writing examples show the voice the author wants, and the style guide names the patterns in them. The cast sheet says who every speaker is and the one way each of them bends English. Rewrite each line so it sounds like its speaker and no one else. Correct grammar is not a goal. Let sentences start oddly, trail off, use the wrong word in the speaker's consistent way, drop words, or run on, as the speaker's rule says. Narration is short, present tense, literal, and may be fragments.
>
> Keep these exactly:
> - Every `[id]` and every speaker name, at the start of each line, in the same order. One line in, one line out. Never merge or split lines.
> - Every `{placeholder}`, character for character, each exactly once.
> - Every number, name, place, direction, and the in-world words listed in the cast sheet.
> - What each line tells the player: a puzzle hint, a direction, a price, or a rule must still be clear after the rewrite.
>
> Stay under 100 characters per text box. A long line may become several boxes with " // " between them. Never use em dashes, en dashes, or semicolons. Humor is welcome when it comes from a speaker's habit or from a grand line landing on something small. Some lines are already right. Leave those as they are. Reply with the rewritten chunk only, in the same format, header lines included.
