#!/usr/bin/env python3
# Builds dialogue/naturalize/compare.html from the prompt test results: every sample line side by side across prompts,
# with new words marked, unchanged lines grayed, a filter for lines a prompt left alone, and a list of those lines.
#   python scripts/naturalize_compare.py [result.md ...]
# With no arguments it reads dialogue/naturalize/prompt-test.md and every prompt-test-*.md beside it.
import difflib
import glob
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAT = os.path.join(ROOT, "dialogue", "naturalize")
files = sys.argv[1:] or sorted(glob.glob(os.path.join(NAT, "prompt-test.md")) + glob.glob(os.path.join(NAT, "prompt-test-*.md")))
SUMMARY = re.compile(r"^\| P(\d+) \| (.*?) \| (\d+) \(\d+%\) \| (\d+) \| (.*?) \| (.*?) \|$")

variants = []  # {name, prompt}
scenes = {}    # key -> {"file", "scene", "rows": [{"who", "before", "out": {variant: cell}}]}
order = []
for f in files:
    tag = os.path.basename(f)[len("prompt-test"):-3].lstrip("-")
    names = {}
    scene = None
    for line in open(f, encoding="utf-8").read().splitlines():
        m = SUMMARY.match(line)
        if m:
            name = f"P{m.group(1)}" + (f" {tag}" if tag else "")
            names[f"P{m.group(1)}"] = name
            variants.append({"name": name, "prompt": m.group(2)})
            continue
        if line.startswith("## "):
            key = line[3:]
            scene = scenes.setdefault(key, {"title": key, "rows": []})
            if key not in order:
                order.append(key)
            idx = 0
            continue
        if scene is None or not line.startswith("| ") or line.startswith("| Speaker") or line.startswith("|---"):
            continue
        cells = line[2:-2].split(" | ")
        who, before, outs = cells[0], cells[1], cells[2:]
        if idx >= len(scene["rows"]):
            scene["rows"].append({"who": who, "before": before, "out": {}})
        row = scene["rows"][idx]
        for k, c in enumerate(outs):
            row["out"][names.get(f"P{k + 1}", f"P{k + 1}")] = c
        idx += 1


def kind(c):
    if c is None:
        return "missing"
    if c == "=":
        return "same"
    if c.startswith("(") and c.endswith(")"):
        return "down"
    return "new"


def norm(t):
    return re.sub(r"[^a-z0-9{}#']", "", t.lower())


def marked(before, after):
    """The rewrite with every word that is not in the original marked."""
    a, b = before.split(), after.split()
    sm = difflib.SequenceMatcher(None, [norm(x) for x in a], [norm(x) for x in b], autojunk=False)
    out = []
    for op, _, _, j1, j2 in sm.get_opcodes():
        chunk = html.escape(" ".join(b[j1:j2]))
        out.append(chunk if op == "equal" else f"<mark>{chunk}</mark>")
    return " ".join(x for x in out if x).replace(" // ", ' <span class="box">new box</span> ')


def is_ui(title):
    return title.startswith(("src/game", "src/battle", "src/net"))


stats = {v["name"]: {"all": [0, 0, 0], "story": [0, 0, 0], "ui": [0, 0, 0]} for v in variants}
for key in order:
    s = scenes[key]
    group = "ui" if is_ui(s["title"]) else "story"
    for r in s["rows"]:
        for v in variants:
            k = kind(r["out"].get(v["name"]))
            col = {"new": 0, "same": 1, "down": 2}.get(k)
            if col is not None:
                stats[v["name"]]["all"][col] += 1
                stats[v["name"]][group][col] += 1


def pct(t):
    n = sum(t)
    return f"{100 * t[0] / n:.0f}%" if n else "-"


E = html.escape
parts = ["""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Naturalizer prompt test</title><style>
:root{--bg:#fbfaf7;--fg:#1d1c1a;--dim:#6b6860;--line:#d9d5cc;--mark:#fde58a;--same:#ecebe7;--down:#fbd9c4;--head:#f1efe9;--box:#3d6fb6}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#1b1a18;--fg:#ebe8e1;--dim:#a19d93;--line:#3a3833;--mark:#6b5a12;--same:#2a2926;--down:#5a3420;--head:#24231f;--box:#8fb4ec}}
:root[data-theme="dark"]{--bg:#1b1a18;--fg:#ebe8e1;--dim:#a19d93;--line:#3a3833;--mark:#6b5a12;--same:#2a2926;--down:#5a3420;--head:#24231f;--box:#8fb4ec}
body{background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;margin:0;padding:16px 16px 60px}
h1{font-size:22px;margin:4px 0 8px}h2{font-size:15px;margin:28px 0 6px;color:var(--dim);font-weight:600}
table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
th{background:var(--head);font-weight:600;font-size:13px}td.who{width:110px;color:var(--dim);font-size:13px}
mark{background:var(--mark);color:inherit;padding:0 1px}td.same{background:var(--same);color:var(--dim)}td.down{background:var(--down)}
.tag{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.box{color:var(--box);font-size:11px;font-weight:600;border:1px solid var(--box);padding:0 3px;margin:0 2px}
.bar{position:sticky;top:0;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:14px;align-items:center;z-index:2}
.bar label{white-space:nowrap}.sum td,.sum th{font-size:14px}.wrap{overflow-x:auto}.scene table{min-width:720px}
ul.left{margin:4px 0 0;padding-left:20px}ul.left li{margin:2px 0}.dim{color:var(--dim)}
</style></head><body><h1>Naturalizer prompt test</h1>
<p class="dim">Each scene shows the original and every prompt's rewrite. Words the rewrite added or changed are marked. Gray cells came back unchanged. Orange cells were turned down by the guards, with the reason. A blue <span class="box">new box</span> marks where a long line splits into another text box.</p>
<div class="wrap"><table class="sum"><tr><th style="width:90px">Prompt</th><th>Wording</th><th style="width:90px">Changed</th><th style="width:90px">Story</th><th style="width:90px">Interface</th><th style="width:90px">Unchanged</th><th style="width:100px">Turned down</th></tr>"""]
for v in variants:
    st = stats[v["name"]]
    parts.append(f"<tr><td><b>{E(v['name'])}</b></td><td>{E(v['prompt'])}</td><td><b>{pct(st['all'])}</b> ({st['all'][0]})</td>"
                 f"<td>{pct(st['story'])}</td><td>{pct(st['ui'])}</td><td>{st['all'][1]}</td><td>{st['all'][2]}</td></tr>")
parts.append("</table></div>")
parts.append('<div class="bar"><span class="dim">Columns:</span>' + "".join(
    f'<label><input type="checkbox" checked data-col="{k}"> {E(v["name"])}</label>' for k, v in enumerate(variants)) +
    '<span class="dim">Rows:</span><label><input type="radio" name="f" value="all" checked> all</label>'
    '<label><input type="radio" name="f" value="same"> some prompt left it unchanged</label>'
    '<label><input type="radio" name="f" value="down"> some prompt was turned down</label></div>')

for key in order:
    s = scenes[key]
    parts.append(f'<section class="scene"><h2>{E(s["title"])}</h2><div class="wrap"><table><tr><th style="width:110px">Speaker</th><th>Before</th>'
                 + "".join(f'<th class="c{k}">{E(v["name"])}</th>' for k, v in enumerate(variants)) + "</tr>")
    for r in s["rows"]:
        kinds = [kind(r["out"].get(v["name"])) for v in variants]
        cells = []
        for k, v in enumerate(variants):
            c = r["out"].get(v["name"])
            kd = kinds[k]
            body = ('<span class="tag">unchanged</span>' if kd == "same" else
                    f'<span class="tag">turned down</span><br>{E(c[1:-1])}' if kd == "down" else
                    "" if kd == "missing" else marked(r["before"], c))
            cells.append(f'<td class="c{k} {kd}">{body}</td>')
        flags = " ".join(sorted(set(kinds)))
        parts.append(f'<tr data-k="{flags}"><td class="who">{E(r["who"])}</td><td>{E(r["before"]).replace(" // ", " <span class=box>new box</span> ")}</td>{"".join(cells)}</tr>')
    parts.append("</table></div></section>")

parts.append("<h1 style='margin-top:40px'>Lines each prompt left unchanged</h1>")
for v in variants:
    left = [(r["who"], r["before"]) for key in order for r in scenes[key]["rows"] if kind(r["out"].get(v["name"])) == "same"]
    parts.append(f"<h2>{E(v['name'])}: {len(left)} lines</h2><ul class='left'>" +
                 "".join(f"<li><span class='dim'>{E(w)}:</span> {E(t)}</li>" for w, t in left) + "</ul>")

parts.append("""<script>
const rows=[...document.querySelectorAll('tr[data-k]')];
function apply(){const f=document.querySelector('input[name=f]:checked').value;
for(const r of rows){r.style.display=f==='all'||r.dataset.k.split(' ').includes(f)?'':'none';}
for(const cb of document.querySelectorAll('input[data-col]')){for(const el of document.querySelectorAll('.c'+cb.dataset.col))el.style.display=cb.checked?'':'none';}}
document.querySelectorAll('input').forEach(i=>i.addEventListener('change',apply));
</script></body></html>""")
out = os.path.join(NAT, "compare.html")
open(out, "w", encoding="utf-8").write("\n".join(parts))
print(f"Wrote {out}: {len(variants)} prompts, {sum(len(scenes[k]['rows']) for k in order)} lines.")
