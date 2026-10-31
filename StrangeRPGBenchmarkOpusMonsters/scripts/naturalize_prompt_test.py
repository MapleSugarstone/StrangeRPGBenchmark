#!/usr/bin/env python3
# Runs a fixed sample of scenes through Naturalizer once per prompt, with the full pass's guards and retries, and
# writes dialogue/naturalize/prompt-test.md: the change rate per prompt and every line side by side.
#   python scripts/naturalize_prompt_test.py "prompt 1" "prompt 2" ... [--story 5] [--ui 2] [--push] [--out name]
# --out names the result file, so a second run does not overwrite the first.
# Progress: dialogue/naturalize/prompt-test-progress.txt. Stop early: create dialogue/naturalize/stop.
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import naturalize_run as nr  # noqa: E402

args = sys.argv[1:]


def opt(name, default):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return int(v)
    return default


n_story, n_ui = opt("--story", 5), opt("--ui", 2)
out_name = "prompt-test"
if "--out" in args:
    i = args.index("--out")
    out_name = args[i + 1]
    del args[i:i + 2]
do_push = "--push" in args
prompts = [open(a[1:], encoding="utf-8").read().strip() if a.startswith("@") else a for a in args if a != "--push"]
if not prompts:
    prompts = [nr.DEFAULT_PROMPT]

rows = nr.load_rows(["story", "ui"])
nr.NAMES.update(nr.build_names(rows))
batches = nr.make_batches(rows)


def spread(pool, n):
    return [pool[round(k * (len(pool) - 1) / max(1, n - 1))] for k in range(n)] if n else []


story = [b for b in batches if b[0]["set"] == "story" and len(b) >= 8]
ui = [b for b in batches if b[0]["set"] == "ui" and len(b) >= 8]
sample = spread(story, n_story) + spread(ui, n_ui)
total = sum(len(b) for b in sample)
os.makedirs(nr.NAT, exist_ok=True)
PROG = os.path.join(nr.NAT, "prompt-test-progress.txt")

results, stats = [], []
start = time.time()
stopped = False
for pi, prompt in enumerate(prompts):
    p = nr.Pass(rows, prompt)
    t0 = time.time()
    for bi, batch in enumerate(sample):
        if os.path.exists(nr.STOP):
            stopped = True
            break
        open(PROG, "w", encoding="utf-8").write(
            f"Prompt {pi + 1} of {len(prompts)}, scene {bi + 1} of {len(sample)}. Elapsed {(time.time() - start) / 60:.1f} min.\n"
            f"Stop early: create {nr.STOP}\n")
        p.run_batch(batch)
        if do_push:
            same = [r for r in batch if p.state["rejected"].get(r["id"]) == "unchanged"]
            if same:
                p.push(same)
    results.append(p.state)
    rej = {}
    for r in p.state["rejected"].values():
        rej[r.split(":")[0]] = rej.get(r.split(":")[0], 0) + 1
    stats.append((len(p.state["results"]), rej, time.time() - t0))
    print(f"prompt {pi + 1}: {len(p.state['results'])} of {total} changed", flush=True)
    if stopped:
        break


def cell(s):
    return (s or "").replace("|", "/")


doc = ["# Naturalizer prompt test" + (" (stopped early)" if stopped else ""), "",
       f"Sample: {total} lines from {len(sample)} scenes ({n_story} story, {n_ui} interface), spread evenly through the game. "
       "Each prompt ran with the full pass's guards and retries" + (", and lines left unchanged were pushed once." if do_push else "."),
       "In the tables, = means the line came back unchanged, and a reason in parentheses means the guards turned it down.", "",
       "| | Prompt | Changed | Unchanged | Turned down | Time |", "|---|---|---|---|---|---|"]
for k, (prompt, (changed, rej, secs)) in enumerate(zip(prompts, stats)):
    same = rej.pop("unchanged", 0)
    doc.append(f"| P{k + 1} | {cell(prompt)} | {changed} ({100 * changed / total:.0f}%) | {same} | "
               f"{sum(rej.values())} {cell(', '.join(f'{a} {b}' for a, b in rej.items()))} | {secs / 60:.1f} min |")
for batch in sample:
    doc += ["", f"## {batch[0]['file']}, {batch[0]['scene']}", "",
            "| Speaker | Before | " + " | ".join(f"P{k + 1}" for k in range(len(results))) + " |",
            "|---|---|" + "---|" * len(results)]
    for r in batch:
        outs = []
        for st in results:
            i = r["id"]
            if i in st["results"]:
                outs.append(cell(st["results"][i]))
            elif st["rejected"].get(i) == "unchanged":
                outs.append("=")
            else:
                outs.append(f"({cell(st['rejected'].get(i, 'not reached'))})")
        doc.append(f"| {cell(nr.label(r))} | {cell(r['text'])} | " + " | ".join(outs) + " |")
open(os.path.join(nr.NAT, f"{out_name}.md"), "w", encoding="utf-8").write("\n".join(doc) + "\n")
open(PROG, "w", encoding="utf-8").write("Finished.\n" if not stopped else "Stopped early.\n")
print("done", flush=True)
