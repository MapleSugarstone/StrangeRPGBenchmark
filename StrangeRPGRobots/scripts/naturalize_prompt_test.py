#!/usr/bin/env python3
# Sends a few scenes to Naturalizer with one custom prompt and writes the original beside the rewrite.
#   python scripts/naturalize_prompt_test.py "prompt" scene1 scene2 ...
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.environ.get("NATURALIZER_DIR", r"C:\Users\Krazv\Documents\Naturalizer-API"))
from naturalize import naturalize  # noqa: E402

prompt, scenes = sys.argv[1], sys.argv[2:]
if prompt.startswith('@'):
    prompt = open(prompt[1:], encoding='utf-8').read().strip()
body = open(os.path.join(ROOT, "naturalize", "fathom-lines.txt"), encoding="utf-8").read()
LINE = re.compile(r"^\[([^\]]+)\] ([^|]*?) \| (.*)$")
rows = [m.groups() for m in map(LINE.match, body.splitlines()) if m]
SPEAKER_LINE = re.compile(r"^\s*([A-Z][A-Za-z .']*?)\s*:\s*(.*)$")

doc = ["# Naturalizer prompt test", "", 'Prompt: ' + (prompt if len(prompt) < 200 else prompt[:200] + '...'), "", "Each line shows the original, then the rewrite. A dash means it came back unchanged.", ""]
raw = []
for scene in scenes:
    sample = [r for r in rows if r[0].rsplit(".", 1)[0] == scene]
    t0 = time.time()
    out = naturalize("\n".join(f"{s}: {t}" for _, s, t in sample), prompt=prompt)
    raw.append(f"===== {scene} =====\n{out}\n")
    got, k = {}, 0
    for line in out.splitlines():
        m = SPEAKER_LINE.match(line.replace("**", ""))
        if m and k < len(sample) and m.group(1).strip().upper() == sample[k][1].strip().upper():
            got[sample[k][0]] = m.group(2).strip()
            k += 1
    print(f"{scene}: {time.time() - t0:.0f} s, {len(got)} of {len(sample)} lines back", flush=True)
    doc += [f"## {scene}", ""]
    for i, s, t in sample:
        v = got.get(i)
        doc += [f"**{s}** ({i.rsplit('.', 1)[1]})", f"- Original: {t}", f"- Rewrite: {'(missing)' if v is None else '-' if v == t else v}", ""]
open(os.path.join(ROOT, "naturalize", "prompt-test.md"), "w", encoding="utf-8").write("\n".join(doc))
open(os.path.join(ROOT, "naturalize", "prompt-test-raw.txt"), "w", encoding="utf-8").write("\n".join(raw))
print("Wrote naturalize/prompt-test.md")
