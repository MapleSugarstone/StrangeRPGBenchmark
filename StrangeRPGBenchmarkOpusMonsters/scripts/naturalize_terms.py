#!/usr/bin/env python3
# Writes dialogue/terms.md: every key term in dialogue/terms.json with its meaning, how often the game text uses it,
# and names the Naturalizer suggests for it. Run `node scripts/lines.mjs export` first so the counts are current.
#   python scripts/naturalize_terms.py [--no-suggest]
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.environ.get("NATURALIZER_DIR", r"C:\Users\Krazv\Documents\Naturalizer-API"))
from naturalize import naturalize  # noqa: E402

TERMS = os.path.join(ROOT, "dialogue", "terms.json")
DOC = os.path.join(ROOT, "dialogue", "whorl-text.txt")
OUT = os.path.join(ROOT, "dialogue", "terms.md")
CACHE = os.path.join(ROOT, "dialogue", "terms-suggestions.json")
PROMPTS = {
    "fresh": "These are made-up words from a video game, each followed by what it means. For each one, suggest three "
             "other names that would be clearer or sound more natural to a player. Answer one line per word, in the "
             "form word: name, name, name.",
    "plain": "These are words from a video game for kids, each followed by what it means. For each one, suggest three "
             "plain, everyday words a ten-year-old would understand right away. Answer one line per word, in the form "
             "word: name, name, name.",
}
BATCH = 8

terms = json.load(open(TERMS, encoding="utf-8"))
LINE = re.compile(r"^\[[0-9a-z]{7}\] ([^|]*?) \| (.*)$")
rows = [m.groups() for m in map(LINE.match, open(DOC, encoding="utf-8").read().splitlines()) if m]
sets = {}
cur = None
for line in open(DOC, encoding="utf-8").read().splitlines():
    if line.startswith("##### set: "):
        cur = line.split()[2].rstrip(".")
    m = LINE.match(line)
    if m:
        sets.setdefault(cur, []).append(m.group(2))


def uses(t):
    """Lines that use the term, per set. A pattern with a capital letter matches case; an all-lowercase one does not."""
    pat = t.get("match") or re.escape(re.sub(r"^the ", "", t["term"]))
    rx = re.compile(r"(?<![A-Za-z])(" + pat + r")(?![A-Za-z])", 0 if re.search(r"[A-Z]", pat) else re.I)
    return {s: sum(1 for x in lines if rx.search(x)) for s, lines in sets.items()}


def key(name):
    return re.sub(r"^(the|a|an) ", "", name.strip().strip("*").strip().lower())


def ask(prompt, batch):
    text = "\n".join(f"{t['term']}: {t['meaning']}" for t in batch)
    out = naturalize(text, prompt=prompt)
    got = {}
    answers = [l for l in out.splitlines() if ":" in l]
    for line in answers:
        word, names = line.split(":", 1)
        for t in batch:
            if key(word) == key(t["term"]):
                got[t["term"]] = names.strip()
    # A combined term such as "out / in reserve" may come back as one answer line per part.
    for t in batch:
        parts = {key(p) for p in re.split(r" / |, ", t["term"])}
        hits = [l.strip() for l in answers if key(l.split(":", 1)[0]) in parts]
        if t["term"] not in got and len(parts) > 1 and hits:
            got[t["term"]] = " / ".join(hits)
    # When the model renamed the word it answered for, the answers pair with the terms in order.
    if len(got) < len(batch) and len(answers) == len(batch):
        for t, line in zip(batch, answers):
            got.setdefault(t["term"], line.split(":", 1)[1].strip())
    return got


cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
if "--no-suggest" not in sys.argv:
    for name, prompt in PROMPTS.items():
        todo = [t for t in terms if t["term"] not in cache.get(name, {})]
        for k in range(0, len(todo), BATCH):
            batch = todo[k:k + BATCH]
            try:
                cache.setdefault(name, {}).update(ask(prompt, batch))
            except RuntimeError as e:
                print(f"{name} batch {k // BATCH + 1}: {e}", flush=True)
            json.dump(cache, open(CACHE, "w", encoding="utf-8"), indent=1)
            print(f"{name}: {min(k + BATCH, len(todo))} of {len(todo)}", flush=True)

doc = [
    "# Key terms",
    "",
    "Every invented or repurposed term the game uses, with what it means, how many lines of game text use it, and "
    "names the Naturalizer suggests instead. Fresh names come from asking for clearer or more natural names. Plain "
    "names come from asking for everyday words a ten-year-old would understand. Counts are lines in "
    "`dialogue/whorl-text.txt` by set (story, interface, rules), so a rename with a high count touches many lines.",
    "",
    "Mark the names you want in the Pick column, or write your own. A rename goes in before the full naturalize "
    "pass, so the pass works on the new words.",
]
group = None
for t in terms:
    if t["group"] != group:
        group = t["group"]
        doc += ["", f"## {group}", "", "| Term | What it means | Lines (story / interface / rules) | Fresh names | Plain names | Pick |",
                "|---|---|---|---|---|---|"]
    u = uses(t)
    count = f"{u.get('story', 0)} / {u.get('ui', 0)} / {u.get('rules', 0)}"
    cell = lambda s: (s or "").replace("|", "/")
    doc.append(f"| **{t['term']}** | {cell(t['meaning'])} | {count} | {cell(cache.get('fresh', {}).get(t['term']))} | "
               f"{cell(cache.get('plain', {}).get(t['term']))} | |")
open(OUT, "w", encoding="utf-8").write("\n".join(doc) + "\n")
print(f"Wrote {OUT}", flush=True)
