#!/usr/bin/env python3
# Writes dialogue/naturalize/holdback.jsonl: rewrites that must wait for review because a test depends on them.
# A line is held back when src/tools/test.ts checks a piece of its original text word for word, or when it sits in a
# guide chapter named on the command line (chapters the reading-grade test fails after the rewrite).
#   python scripts/naturalize_holdback.py [guide chapter id ...]
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import naturalize_run as nr  # noqa: E402

side = json.load(open(nr.SIDE, encoding="utf-8"))["lines"]
results = json.load(open(nr.STATE, encoding="utf-8"))["results"]
tests = open(os.path.join(nr.ROOT, "src", "tools", "test.ts"), encoding="utf-8").read()
guide = open(os.path.join(nr.ROOT, "src", "content", "guide.ts"), encoding="utf-8").read()
chapters = sys.argv[1:]

# Each guide chapter starts at its `id: '...', title:` line, so a line belongs to the last chapter start before it.
starts = [(m.start(), m.group(1)) for m in re.finditer(r"id: '(\w+)', title:", guide)]


def chapter_at(pos):
    name = None
    for at, cid in starts:
        if at <= pos:
            name = cid
    return name


def offset(raw, n):
    at = -1
    for _ in range(n + 1):
        at = guide.find(raw, at + 1)
    return at


out = []
for i in results:
    l = side.get(i)
    if not l:
        continue
    pieces = [p.strip(" .") for p in re.split(r"\{[^}]*\}", l["text"]) if len(p.strip(" .")) >= 10]
    if any(p in tests for p in pieces):
        out.append({"id": i, "reason": "a test in src/tools/test.ts checks this exact text"})
        continue
    if chapters and l["file"] == "src/content/guide.ts" and chapter_at(offset(l["raw"], l["n"])) in chapters:
        out.append({"id": i, "reason": "the guide reading-grade test fails for this chapter with the rewrite"})
path = os.path.join(nr.NAT, "holdback.jsonl")
open(path, "w", encoding="utf-8").write("".join(json.dumps(o, ensure_ascii=False) + "\n" for o in out))
print(f"{len(out)} lines held back. Wrote {path}")
