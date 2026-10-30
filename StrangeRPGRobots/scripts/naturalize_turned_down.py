#!/usr/bin/env python3
# Writes naturalize/turned-down.md: every rewrite the guards turned down in both passes, original beside each
# attempt with the reason in plain words, plus names and titles put back by hand after the import.
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAT = os.path.join(ROOT, "naturalize")
LINE = re.compile(r"^\[([^\]]+)\] ([^|]*?) \| (.*)$")


def read_lines(name):
    path = os.path.join(NAT, name)
    if not os.path.exists(path):
        return []
    return [m.groups() for m in map(LINE.match, open(path, encoding="utf-8").read().splitlines()) if m]


def plain(why):
    if why.startswith("redo: "):
        return "Changed the meaning. " + why[6:] + "."
    if why.startswith("redo-same: "):
        return "Returned the original after a redo note."
    out = []
    for part in why.removeprefix("misread: ").split(". ") if why.startswith("misread: ") else [why]:
        m = re.match(r"(\S+) is an ordinary word here, not a name$", part)
        if m:
            out.append(f'Capitalized "{m.group(1).lower()}" as if it were a name')
            continue
        m = re.match(r"(\S+) is a name here, not an ordinary word$", part)
        if m:
            out.append(f'Lowercased the name "{m.group(1)}"')
            continue
        if part.startswith("The Board is the company"):
            out.append('Read "Board" as the verb rather than the company')
            continue
        m = re.match(r"term: (.+)$", part)
        if m:
            out.append(f'Dropped the game term "{m.group(1)}"')
            continue
        m = re.match(r"over (\d+) characters$", part)
        if m:
            out.append(f"Longer than {m.group(1)} characters")
            continue
        m = re.match(r"banned: (.+)$", part)
        if m:
            out.append(f'Uses the banned word "{m.group(1)}"')
            continue
        m = re.match(r"abbrev: (.+)$", part)
        if m:
            out.append(f'Abbreviated a word as "{m.group(1)}"')
            continue
        m = re.match(r"lost (.+)$", part)
        if m:
            out.append(f"Dropped {m.group(1)}")
            continue
        out.append({
            "empty": "Came back empty",
            "misaligned": "Matched a different line",
            "renamed": "Changed a name",
            "shortened": "Cut down to a word or two",
        }.get(part, "Too wide for its space on screen" if part.startswith("too wide") else part))
    return ". ".join(out) + "."


cell = lambda t: t.replace("|", "\\|")
HEAD = ["| ID | Speaker | Original | Rejected rewrite | Why |", "| --- | --- | --- | --- | --- |"]


def section(title, lines_file, state_file):
    rows = read_lines(lines_file)
    path = os.path.join(NAT, state_file)
    if not rows or not os.path.exists(path):
        return [], 0
    state = json.load(open(path, encoding="utf-8"))
    res, att = state["results"], state.get("attempts", {})
    down = [r for r in rows if r[0] in att and r[0] not in res]
    doc = [f"## {title}", "", f"{len(down)} lines kept their original text.", ""] + HEAD
    for i, s, t in down:
        for k, (text, why) in enumerate(att[i]):
            first = k == 0
            doc.append(f"| {cell(i) if first else ''} | {cell(s) if first else ''} | {cell(t) if first else ''} | {cell(text)} | {cell(plain(why))} |")
    return doc + [""], len(down)


def put_back():
    orig = {i: (s, t) for i, s, t in read_lines("fathom-lines.txt")}
    path = os.path.join(NAT, "natural-state.json")
    res = json.load(open(path, encoding="utf-8"))["results"] if os.path.exists(path) else {}
    back = [(i, orig[i][0], orig[i][1], t) for i, _, t in read_lines("fathom-lines-natural.txt")
            if i in orig and orig[i][1] != t and i not in res]
    if not back:
        return [], 0
    doc = ["## Names and titles put back after the import", "",
           f"{len(back)} rewrites passed the guards but changed a name or title, so the original went back in.", "",
           "| ID | Speaker | Original | Rewrite | Why |", "| --- | --- | --- | --- | --- |"]
    doc += [f"| {cell(i)} | {cell(s)} | {cell(t)} | {cell(n)} | Changed a name or title. |" for i, s, t, n in back]
    return doc + [""], len(back)


main, a = section("Script, barks, and data", "fathom-lines.txt", "natural-state.json")
ui, b = section("Interface, Sluice, credits, and names", "fathom-lines-ui.txt", "natural-state-ui.json")
names, c = put_back()
doc = ["# Turned-down rewrites", "",
       f"{a + b + c} lines in all. Each row is one rejected attempt, and a line can have several. "
       "Lines are in game order. To use a rejected rewrite, edit its line in "
       "`rejected-review.txt` or `rejected-review-ui.txt` and import that file.", ""]
open(os.path.join(NAT, "turned-down.md"), "w", encoding="utf-8").write("\n".join(doc + main + ui + names))
print(f"naturalize/turned-down.md: {a} script and data, {b} interface, {c} put back")
