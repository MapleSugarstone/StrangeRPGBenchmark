#!/usr/bin/env python3
# Builds the review of a naturalize pass from dialogue/naturalize/state.json:
#   review.html      every line side by side, with filters for flagged, unchanged, and turned-down lines
#   flags.json       why each flagged line was flagged
#   import-ready.txt the accepted rewrites minus the flagged ones, for: node scripts/lines.mjs import <file>
#   flagged.txt      the flagged rewrites in the same format, held back until someone reviews them
# Flags come from naturalize_checks.py and from reviewer-flags.jsonl (one {"id", "reason"} per line), when it exists.
#   python scripts/naturalize_review.py
import difflib
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import naturalize_run as nr  # noqa: E402

state = json.load(open(nr.STATE, encoding="utf-8"))
rows = nr.load_rows(state.get("sets", ["story", "ui"]))
nr.NAMES.update(nr.build_names(rows))
by_id = {r["id"]: r for r in rows}
results = state["results"]

from naturalize_checks import WEAK, checks  # noqa: E402

found = {i: checks(by_id[i], new) for i, new in results.items() if i in by_id}
reviewer = {}
# holdback.jsonl comes from scripts/naturalize_holdback.py: lines a test depends on.
for name, prefix in (("reviewer-flags.jsonl", "reviewer: "), ("holdback.jsonl", "held back: ")):
    path = os.path.join(nr.NAT, name)
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line:
                f = json.loads(line)
                reviewer.setdefault(f["id"], []).append(prefix + f["reason"])
flags = {}
for i, hits in found.items():
    strong = [h for h in hits if h not in WEAK]
    if strong or i in reviewer:
        flags[i] = reviewer.get(i, []) + hits
json.dump(flags, open(os.path.join(nr.NAT, "flags.json"), "w", encoding="utf-8"), indent=1)
# The reviewer reads every changed line, with the checks' findings beside each one as hints.
with open(os.path.join(nr.NAT, "for-review.txt"), "w", encoding="utf-8") as f:
    for r in rows:
        if r["id"] in results:
            hint = f"   [checks: {'; '.join(found[r['id']])}]" if found.get(r["id"]) else ""
            f.write(f"{r['id']} | {nr.label(r)} | {r['file']} {r['scene']}\n  before: {r['text']}\n  after:  {results[r['id']]}{hint}\n")

ready = [f"[{i}] {by_id[i]['who']} | {t}" for i, t in results.items() if i in by_id and i not in flags]
held = [f"[{i}] {by_id[i]['who']} | {t}" for i, t in results.items() if i in by_id and i in flags]
open(os.path.join(nr.NAT, "import-ready.txt"), "w", encoding="utf-8").write("\n".join(ready) + "\n")
open(os.path.join(nr.NAT, "flagged.txt"), "w", encoding="utf-8").write(
    "# Flagged rewrites, held back from the import. Delete the lines you do not want, then:\n"
    "#   node scripts/lines.mjs import dialogue/naturalize/flagged.txt\n" + "\n".join(held) + "\n")


def norm(t):
    return re.sub(r"[^a-z0-9{}#']", "", t.lower())


def marked(before, after):
    a, b = before.split(), after.split()
    sm = difflib.SequenceMatcher(None, [norm(x) for x in a], [norm(x) for x in b], autojunk=False)
    out = []
    for op, _, _, j1, j2 in sm.get_opcodes():
        chunk = html.escape(" ".join(b[j1:j2]))
        out.append(chunk if op == "equal" else f"<mark>{chunk}</mark>")
    return " ".join(x for x in out if x).replace(" // ", ' <span class="box">new box</span> ')


E = html.escape
done = {r["id"] for b, batch in enumerate(nr.make_batches(rows)) if b in set(state["done"]) for r in batch}
counts = {"new": 0, "flag": 0, "same": 0, "down": 0}
body, scene = [], None
for r in rows:
    if r["id"] not in done:
        continue
    i = r["id"]
    if i in results:
        k = "flag" if i in flags else "new"
        cell = marked(r["text"], results[i])
        if k == "flag":
            cell += "<div class='why'>" + "<br>".join(E(x) for x in flags[i]) + "</div>"
    elif state["rejected"].get(i) == "unchanged":
        k, cell = "same", '<span class="tag">unchanged</span>'
    else:
        k = "down"
        tries = state["attempts"].get(i, [])
        cell = f'<span class="tag">kept the original</span> <span class="dim">{E(state["rejected"].get(i, ""))}</span>'
        if tries:
            cell += "<div class='why'>Last try: " + E(tries[-1][0]) + "</div>"
    counts[k] += 1
    key = (r["file"], r["scene"])
    if key != scene:
        if scene:
            body.append("</table></div></section>")
        body.append(f"<section><h2>{E(r['file'])}, {E(r['scene'])}</h2><div class='wrap'><table>"
                    "<tr><th class='who'>Speaker</th><th>Before</th><th>After</th></tr>")
        scene = key
    body.append(f"<tr class='{k}' data-id='{i}'><td class='who'>{E(nr.label(r))}<div class='id'>{i}</div></td>"
                f"<td>{E(r['text']).replace(' // ', ' <span class=box>new box</span> ')}</td><td class='{k}'>{cell}</td></tr>")
if scene:
    body.append("</table></div></section>")

total = sum(counts.values())
head = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Naturalize review</title><style>
:root{{--bg:#fbfaf7;--fg:#1d1c1a;--dim:#6b6860;--line:#d9d5cc;--mark:#fde58a;--same:#ecebe7;--down:#fbd9c4;--flag:#f6c9c9;--head:#f1efe9;--box:#3d6fb6}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#1b1a18;--fg:#ebe8e1;--dim:#a19d93;--line:#3a3833;--mark:#6b5a12;--same:#2a2926;--down:#5a3420;--flag:#5c2424;--head:#24231f;--box:#8fb4ec}}}}
:root[data-theme="dark"]{{--bg:#1b1a18;--fg:#ebe8e1;--dim:#a19d93;--line:#3a3833;--mark:#6b5a12;--same:#2a2926;--down:#5a3420;--flag:#5c2424;--head:#24231f;--box:#8fb4ec}}
body{{background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;margin:0;padding:16px 16px 60px}}
h1{{font-size:22px;margin:4px 0 8px}}h2{{font-size:14px;margin:24px 0 6px;color:var(--dim);font-weight:600}}
table{{border-collapse:collapse;width:100%;table-layout:fixed;min-width:640px}}th,td{{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left;overflow-wrap:anywhere}}
th{{background:var(--head);font-size:13px}}.who{{width:120px;color:var(--dim);font-size:13px}}.id{{font:11px monospace;color:var(--dim);margin-top:2px}}
mark{{background:var(--mark);color:inherit;padding:0 1px}}td.same{{background:var(--same);color:var(--dim)}}td.down{{background:var(--down)}}td.flag{{background:var(--flag)}}
.why{{font-size:13px;margin-top:4px;font-weight:600}}.tag{{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}}.dim{{color:var(--dim)}}
.box{{color:var(--box);font-size:11px;font-weight:600;border:1px solid var(--box);padding:0 3px;margin:0 2px}}
.bar{{position:sticky;top:0;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:14px;z-index:2}}.wrap{{overflow-x:auto}}
</style></head><body><h1>Naturalize review</h1>
<p class="dim">Prompt: {E(state.get('prompt', ''))}<br>{total} lines: {counts['new']} changed, {counts['flag']} changed and flagged, {counts['same']} unchanged, {counts['down']} kept as the original after the guards turned every try down.
Flagged rewrites are held out of <code>import-ready.txt</code> and wait in <code>flagged.txt</code>. Words the rewrite added or changed are marked.</p>
<div class="bar"><span class="dim">Show:</span>
<label><input type="radio" name="f" value="all"> all</label>
<label><input type="radio" name="f" value="flag" checked> flagged ({counts['flag']})</label>
<label><input type="radio" name="f" value="same"> unchanged ({counts['same']})</label>
<label><input type="radio" name="f" value="down"> kept the original ({counts['down']})</label>
<label><input type="radio" name="f" value="new"> changed, not flagged ({counts['new']})</label></div>"""
tail = """<script>
function apply(){const f=document.querySelector('input[name=f]:checked').value;
document.querySelectorAll('tr[data-id]').forEach(r=>r.style.display=f==='all'||r.classList.contains(f)?'':'none');
document.querySelectorAll('section').forEach(s=>s.style.display=[...s.querySelectorAll('tr[data-id]')].some(r=>r.style.display!=='none')?'':'none');}
document.querySelectorAll('input[name=f]').forEach(i=>i.addEventListener('change',apply));apply();
</script></body></html>"""
open(os.path.join(nr.NAT, "review.html"), "w", encoding="utf-8").write(head + "\n".join(body) + tail)
print(f"{total} lines reviewed: {counts['new']} ready, {counts['flag']} flagged, {counts['same']} unchanged, {counts['down']} kept the original.")
