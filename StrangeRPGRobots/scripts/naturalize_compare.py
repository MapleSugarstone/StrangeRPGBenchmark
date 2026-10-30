#!/usr/bin/env python3
# Writes naturalize/compare.md from the run so far: every line the pass changed, original beside rewrite.
# Safe to run while the pass is going.
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAT = os.path.join(ROOT, "naturalize")
LINE = re.compile(r"^\[([^\]]+)\] ([^|]*?) \| (.*)$")
rows = [m.groups() for m in map(LINE.match, open(os.path.join(NAT, "fathom-lines.txt"), encoding="utf-8").read().splitlines()) if m]
state = json.load(open(os.path.join(NAT, "natural-state.json"), encoding="utf-8"))
res, att = state["results"], state.get("attempts", {})
cell = lambda t: t.replace("|", "\\|")

doc = ["# Naturalize comparison", "",
       f"{len(res)} lines changed so far, {sum(1 for i in att if i not in res)} turned down. Lines are in game order.", "",
       "## Changed", "", "| Speaker | Original | Rewrite |", "| --- | --- | --- |"]
scene = None
for i, s, t in rows:
    if i not in res:
        continue
    sc = i.rsplit(".", 1)[0]
    if sc != scene:
        doc.append(f"| **{cell(sc)}** | | |")
        scene = sc
    doc.append(f"| {cell(s)} | {cell(t)} | {cell(res[i])} |")
doc += ["", "Turned-down rewrites are in `turned-down.md` (run `python scripts/naturalize_turned_down.py`)."]
open(os.path.join(NAT, "compare.md"), "w", encoding="utf-8").write("\n".join(doc) + "\n")
print(f"{len(res)} changed, {sum(1 for i in att if i not in res)} turned down")
