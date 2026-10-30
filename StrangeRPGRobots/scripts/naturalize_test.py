#!/usr/bin/env python3
# Runs a few scenes through Naturalizer in several styles and writes a side-by-side comparison, so the user can
# pick a style before the full pass.
#   python scripts/naturalize_test.py camp3:camp3_argue ch1:tilly_talk
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.environ.get("NATURALIZER_DIR", r"C:\Users\Krazv\Documents\Naturalizer-API"))
from naturalize import naturalize  # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naturalize_guide import guide  # noqa: E402

src = open(os.path.join(ROOT, "naturalize", "fathom-lines.txt"), encoding="utf-8").read()
header, _, body = src.partition("\n[")
body = "[" + body
LINE = re.compile(r"^\[([^\]]+)\] ([^|]*?) \| (.*)$")
rows = [m.groups() for m in map(LINE.match, body.splitlines()) if m]
scenes = sys.argv[1:] or ["camp3:camp3_argue", "ch1:tilly_talk"]
sample = [r for r in rows if r[0].rsplit(".", 1)[0] in scenes]

FORMAT = ("Rewrite the text after the | on each line below so it sounds natural and spoken. Return every line, "
          "in the same order and the same format: [id] SPEAKER | text. Keep each [id] and speaker exactly. "
          "Return only the lines.")
FULL = header.strip() + "\n\n" + FORMAT
FREER = (" Most lines should change at least a little: say each one the way that person would really say it out loud, "
         "with natural rhythm and word choice. Keep every speaker's quirks, short lines short, and lowercase where it appears.")
STYLES = {
    "A. Desktop default": None,
    "B. Voice guide": FULL,
    "C. Voice guide, freer": FULL + FREER,
    "D. Voice guide, freer, thinking": FULL + FREER,
}
for k, v in STYLES.items():
    if v:
        print(k, len(v), "characters of prompt")

SPEAKER_LINE = re.compile(r"^\s*\**\s*([A-Z][A-Za-z .']*?)\s*\**\s*:\s*\**\s*(.*)$")
results = {}
raw = []
for name, prompt in STYLES.items():
    t0 = time.time()
    if prompt is None:
        text = "\n".join(f"{s}: {t}" for _, s, t in sample)
        out = naturalize(text)
        # The default answer may open with a sentence and bold the speakers, so match lines by speaker in order.
        got, k = {}, 0
        for line in out.splitlines():
            m = SPEAKER_LINE.match(line.replace("**", ""))
            if not m or k >= len(sample):
                continue
            if m.group(1).strip().upper() == sample[k][1].strip().upper():
                got[sample[k][0]] = m.group(2).strip()
                k += 1
    else:
        text = "\n".join(f"[{i}] {s} | {t}" for i, s, t in sample)
        out = naturalize(text, prompt=prompt, thinking=name.endswith("thinking"))
        got = {m.group(1): m.group(3) for m in map(LINE.match, out.splitlines()) if m}
    results[name] = got
    raw.append(f"===== {name} =====\n{out}\n")
    print(f"{name}: {time.time() - t0:.0f} s, {len(got)} of {len(sample)} lines back", flush=True)
open(os.path.join(ROOT, "naturalize", "style-test-raw.txt"), "w", encoding="utf-8").write("\n".join(raw))

doc = ["# Naturalizer style test", "", "Each line shows the original first, then each style. A dash means the style left the line unchanged. Raw answers are in style-test-raw.txt.", ""]
for scene in scenes:
    doc += [f"## {scene}", ""]
    for i, s, t in sample:
        if not i.startswith(scene + "."):
            continue
        doc.append(f"**{s}** ({i.rsplit('.', 1)[1]})")
        doc.append(f"- Original: {t}")
        for name in STYLES:
            v = results[name].get(i)
            doc.append(f"- {name[:2]} {'(missing)' if v is None else '-' if v.strip() == t.strip() else v}")
        doc.append("")
open(os.path.join(ROOT, "naturalize", "style-test.md"), "w", encoding="utf-8").write("\n".join(doc))
print("Wrote naturalize/style-test.md")
