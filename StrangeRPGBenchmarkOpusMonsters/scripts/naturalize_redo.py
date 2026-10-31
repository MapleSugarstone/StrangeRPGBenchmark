#!/usr/bin/env python3
# Sends flagged rewrites back to Naturalizer with the problem found in each, so it fixes its own rewrite.
#   python scripts/naturalize_redo.py <notes.jsonl> [--edit]
# Without --edit the model rewrites the original line again. With --edit it edits its flagged rewrite instead.
# The notes file holds one {"id", "note", "last"} per line: an id in the current export, the problem to fix, and the
# rewrite that had it. The file's name ends in the round, such as redo-notes-1.jsonl, and every output carries it:
#   redo-state-N.json        resume state
#   redo-N.txt               fixed rewrites, for: node scripts/lines.mjs import <file>
#   redo-for-review-N.txt    each line with its earlier rewrite, the problem, and the fix, for a reviewer
# A fix goes back again, up to twice more, while the checks in naturalize_checks.py still find a problem in it.
# Progress: Notes/naturalize-redo-progress.txt. Stop early: create dialogue/naturalize/stop. Run again to resume.
import json
import os
import re
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import naturalize_run as nr  # noqa: E402
from naturalize_checks import strong  # noqa: E402

NOTES = sys.argv[1]
ROUND = re.search(r"(\d+)\.jsonl$", NOTES).group(1)
STATE = os.path.join(nr.NAT, f"redo-state-{ROUND}.json")
OUT = os.path.join(nr.NAT, f"redo-{ROUND}.txt")
REVIEW = os.path.join(nr.NAT, f"redo-for-review-{ROUND}.txt")
PROGRESS = os.path.join(nr.ROOT, "Notes", "naturalize-redo-progress.txt")
PROMPT = json.load(open(nr.STATE, encoding="utf-8"))["prompt"]
CHUNK = 8


def check_note(hit):
    """A check's finding, written as an instruction."""
    if hit.startswith("dropped the name "):
        return f"Keep the name {hit[17:]}."
    if hit.startswith("dropped the game word "):
        return f"Keep the game word {hit[22:]}. It is a term in this game."
    if hit == "changed words written in capitals":
        return "Keep the words written in capitals exactly as they are."
    if hit == "a direction changed":
        return "Keep every direction exactly as the original says it."
    return ""


def mask_as(text, orig):
    """Masks the placeholders in text with the numbers they have in orig, so unmask can restore them."""
    order = []
    for ph in nr.PH.findall(orig):
        if ph not in order:
            order.append(ph)
    return nr.PH.sub(lambda m: "{v" + str(order.index(m.group(0)) + 1) + "}" if m.group(0) in order else m.group(0), text)


def same(a, b):
    norm = lambda s: re.sub(r"\W+", " ", s.replace(" // ", " ")).strip().lower()
    return norm(a) == norm(b)


EDIT_PROMPT = (" Each line below is a rewrite with a problem, described in the note in parentheses above it. Edit each "
               "rewrite to fix its problem and keep the rest of its wording. Do not repeat the notes in your answer.")


def edit(chunk):
    """--edit: the model edits its own flagged rewrite, with the original line and the problem in the note. An edit
    that keeps the problem, turns back into the original, or fails a guard goes back, up to three tries."""
    problem = {r["id"]: note_of[r["id"]]["note"] for r in chunk}
    left = chunk
    for k in range(3):
        if not left:
            return
        nxt = []
        for g in ([left] if k == 0 else [[r] for r in left]):
            parts = []
            for r in g:
                i = r["id"]
                note = f'The original line: "{mask_as(r["text"], r["text"])}". Problem: {problem[i]}'
                if k:
                    note += f' Your last edit was: "{mask_as(st["attempts"][i][-1][0], r["text"])}". It still has a problem.'
                parts.append(f"({note})\n{nr.label(r)}: {mask_as(note_of[i]['last'].replace(' // ', ' '), r['text'])}")
            try:
                out = nr.naturalize("\n".join(parts), prompt=PROMPT + EDIT_PROMPT)
            except Exception as e:  # noqa: BLE001
                print(f"edit: {e}", flush=True)
                nxt += g
                continue
            got = nr.parse(out, g)
            for r in g:
                i = r["id"]
                if i not in got:
                    nxt.append(r)
                    continue
                new, why = nr.clean(r, nr.unmask(got[i], r["text"]))
                if new is not None and same(new, note_of[i]["last"]):
                    new, why = None, "kept the problem"
                hits = strong(r, new) if new is not None else []
                if hits:
                    new, why = None, " ".join(check_note(h) for h in hits)
                if new is None:
                    st["attempts"][i].append([got[i], why])
                    st["rejected"][i] = "review: " + why
                    if why not in ("unchanged", "kept the problem") and why not in problem[i]:
                        problem[i] += " " + (nr.feedback(why) if not why.startswith("Keep") else why)
                    nxt.append(r)
                else:
                    st["results"][i] = new
                    st["rejected"].pop(i, None)
        left = nxt


notes = [json.loads(l) for l in open(NOTES, encoding="utf-8") if l.strip()]
rows = nr.load_rows(["story", "ui"])
nr.NAMES.update(nr.build_names(rows))
by_id = {r["id"]: r for r in rows}
items = [by_id[n["id"]] for n in notes if n["id"] in by_id]
note_of = {n["id"]: n for n in notes}

st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {"done": [], "results": {}, "rejected": {}, "attempts": {}}
p = nr.Pass(rows, PROMPT, st)
st = p.state
for n in notes:
    if n["id"] not in st["done"]:
        st["rejected"][n["id"]] = "review: " + n["note"]
        st["attempts"][n["id"]] = [[n["last"], "review: " + n["note"]]]


def save():
    json.dump(st, open(STATE, "w", encoding="utf-8"))
    out = [f"[{i}] {by_id[i]['who']} | {t}" for i, t in st["results"].items() if i in by_id]
    open(OUT, "w", encoding="utf-8").write("\n".join(out) + "\n")
    with open(REVIEW, "w", encoding="utf-8") as f:
        for r in items:
            i = r["id"]
            if i in st["results"]:
                n = note_of[i]
                f.write(f"{i} | {nr.label(r)} | {r['file']} {r['scene']}\n  before:  {r['text']}\n  earlier: {n['last']}\n"
                        f"  problem: {n['note']}\n  after:   {st['results'][i]}\n")


start = time.time()
status = {"since": start, "n": 0}


def progress(final=False, partial=False):
    done = len(st["done"])
    rate = status["n"] / (time.time() - start) if status["n"] else 0
    eta = (len(items) - done) / rate / 60 if rate else 0
    left = {}
    for i in st["done"]:
        if i not in st["results"]:
            k = st["rejected"].get(i, "?").split(":")[0]
            left[k] = left.get(k, 0) + 1
    open(PROGRESS, "w", encoding="utf-8").write("\n".join([
        f"Redo round {ROUND}" + (" (stopped early)" if partial else " (finished)" if final else " (running)"),
        f"Lines: {done} of {len(items)}. Fixed: {len(st['results'])}. Not fixed: {sum(left.values())} "
        f"({', '.join(f'{k} {v}' for k, v in left.items())}).",
        f"Elapsed: {(time.time() - start) / 60:.1f} min. Estimated time left: {eta:.0f} min.",
        f"Stop early: create {nr.STOP}", ""]))


stop_beat = threading.Event()


def beat():
    while not stop_beat.wait(5):
        progress()


threading.Thread(target=beat, daemon=True).start()
todo = [r for r in items if r["id"] not in set(st["done"])]
partial = False
for k in range(0, len(todo), CHUNK):
    if os.path.exists(nr.STOP):
        partial = True
        break
    chunk = todo[k:k + CHUNK]
    if "--edit" in sys.argv:
        edit(chunk)
        st["done"] = sorted(set(st["done"]) | {r["id"] for r in chunk})
        status["n"] += len(chunk)
        save()
        continue
    p.retry(chunk)
    for _ in range(3):
        again = []
        for r in chunk:
            new = st["results"].get(r["id"])
            hits = strong(r, new) if new else []
            if hits:
                note = " ".join(check_note(h) for h in hits)
                st["results"].pop(r["id"])
                st["rejected"][r["id"]] = "review: " + note
                st["attempts"][r["id"]].append([new, "review: " + note])
                again.append(r)
        if not again or _ == 2:
            break
        p.retry(again)
    st["done"] = sorted(set(st["done"]) | {r["id"] for r in chunk})
    status["n"] += len(chunk)
    save()
    print(f"{len(st['done'])}/{len(items)}", flush=True)
stop_beat.set()
save()
progress(final=not partial, partial=partial)
print("done" + (" (partial)" if partial else ""), flush=True)
