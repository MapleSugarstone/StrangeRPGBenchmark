#!/usr/bin/env python3
# One-off term renames from 2026-10-30, applied to the exported lines that use each term in the renamed sense:
# turn to shed, second turning to re-shedding, the Lip to the Rim, Stay to Seal, craze to fracture, kind to species,
# and sounding to catching. Writes dialogue/naturalize/renames.txt for: node scripts/lines.mjs import <that file>
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
side = json.load(open(os.path.join(ROOT, "dialogue", ".export.json"), encoding="utf-8"))["lines"]


def outside(text, fn):
    """Applies fn to the text between {placeholders}, so code inside braces never changes."""
    return "".join(p if p.startswith("{") else fn(p) for p in re.split(r"(\{[^}]*\})", text))


def sub(pat, rep):
    return lambda t: outside(t, lambda s: re.sub(pat, rep, s))


lip = sub(r"\bLip\b", "Rim")
stay = lambda t: sub(r"\bStaykeeper", "Sealkeeper")(sub(r"\bStays\b", "Seals")(sub(r"\bStay\b", "Seal")(t)))
craze = sub(r"\b([Cc])raze(s|d)?\b", lambda m: ("F" if m.group(1) == "C" else "f") + "racture" + (m.group(2) or ""))
species = lambda t: sub(r"\bkinds?\b", "species")(sub(r"\bKinds\b", "Species")(t))

LIP = "033y6wn 1y6bzbz 1s21cby 0ujeqfs 10nq5lt 072j40k 0u6d2bh 14jz078 0vv9mts 0tz1nuc 0v90yxd 0kn3gi7 1u1d3hb 144q59c 1b99qlq 16h8czd 1bm1aa4 0nsa5pb 0drynrd 1hpcbrs 0bpqadb 0aeg932 0txhm6d"
STAY = "1wqurba 1y6bzbz 05tapj9 0nb1dhq 1g0if3o 0rrhpnx 0w1sy63 1h3rvi0 0jmv1rw 0ce3l3b 0p0vua7 16yaybb 151ef2i 07de0xc 0lpa7nh 19n8938 1gpwgj7 0qrjyrf 11m0cvy"
CRAZE = "0v2af1u 0k7nfa9 1jitl7k 0ro4f9u 0rrhpnx 1fq64od 1ecbbgf 1cjbppe 1emyfhp 1h20drm 1radki2 0z1kf8u 09v7vlp 1k8mg5b 1bknixs 1799b2h 0nnwcnv 1ba71lq 1odt086 0uzlbc2"
KIND = ("1wfedlk 1iqkubh 0wntsr1 1wpwl0h 0slo4sm 116a610 01fz8fi 15flb43 06qdfyy 132jebo 13e37g2 0blukoh 1kpv1bm 1smc8tv 0f7b98r "
        "1ejtn8r 05kpoeq 157znf7 07enyyw 1o6gum4 0d5faj1 1ocj4a5 1dd70v3 18nmki1 0b9228m")

# Each pair is old text and new text, and the old text must be in the line.
EXACT = {
    "1y6bzbz": [("the rim of the world", "the edge of the world")],
    "1wfedlk": [("You sound a", "You catch a")],
    "0zeqeer": [("and sound them", "and catch them")],
    "1iuk0qd": [("Try to sound", "Try to catch")],
    "16n1c0j": [("Sound it", "Catch it")], "19d0wlp": [("Sound it", "Catch it")],
    "1b3jtgd": [("Sound it", "Catch it")], "17zl7ra": [("Sound it", "Catch it")],
    "08ck0ku": [("for sounding", "for catching")],
    "0ft0oe5": [(" The game calls this sounding. A sounded whorl", " A caught whorl")],
    "03rizkz": [("pick Sound.", "pick Catch."), ("only sound wild", "only catch wild")],
    "0axdaru": [("pick Sound", "pick Catch")],
    "1k4w8bg": [("or sounded", "or caught")],
    "0blukoh": [("you have sounded", "you have caught")],
    "0t3k0vg": [("then sound it", "then catch it")],
    "0lu8esj": [("can sound a", "can catch a")],
    "0dv475p": [("pick Sound", "pick Catch")],
    "1mjg8kk": [("Pick Sound", "Pick Catch"), ("A sounded whorl", "A caught whorl")],
    "157znf7": [("you have sounded", "you have caught")],
    "1814ggt": [("Sound it with", "Catch it with")],
    "0dq3355": [("House turned", "House shed")],
    "1wjwo5o": [("Turning Day", "Shedding Day")], "1h73t20": [("Turning Day", "Shedding Day")],
    "1i2w2nf": [("Turned ones walk out behind their own shell. ", "Ones who've shed walk out behind their own shell. // ")],
    "1iqkubh": [("cowrie to me. ", "cowrie to me. // ")],
    "1yvqirl": [("Never turned", "Never shed")],
    "1fq64od": [("overdue to turn", "overdue to shed")],
    "1xlnxeb": [("since I turned", "since I shed")],
    "11qah3k": [("Grandad turned", "Grandad shed")],
    "1swvo9r": [("They turned ages", "They shed ages")],
    "1fl9031": [("The Volute turned.", "The Volute shed.")],
    "0co3gs9": [("She turned the very day", "She shed the very day")],
    "180usht": [("have turned?", "have shed?")],
    "1583qqo": [("Cinch turned HERE", "Cinch shed HERE"), ("A second turning!!", "A re-shedding!!")],
    "0pa1mb0": [("my Turning Day. It turned too", "my Shedding Day. It shed too")],
    "1df3z8r": [("The meadow turned", "The meadow shed")],
    "1radki2": [("We turned this", "We shed this")],
    "0e17kyv": [("one of them turned", "one of them shed")],
    "1kpy8sw": [("Ship turned in", "Ship shed in")],
    "1dd386c": [("the day I turned", "the day I shed")],
    "1gb3lvu": [("its neighbors turn", "its neighbors shed")],
    "1mp7by6": [("last turned", "last shed")],
    "1q35xcs": [("Baby turned", "Baby shed")],
    "0xjef70": [("We're turning on", "We're shedding on")],
    "0c8jp1w": [("the sea turned", "the sea shed")],
    "1xdha8y": [("Turning Day", "Shedding Day")], "0jcmsi3": [("Turning Day", "Shedding Day")],
    "1a90oew": [("She turned late", "She shed late")],
    "023x8rd": [("My boat turned", "My boat shed")],
    "09wy73f": [("a Turning Day", "a Shedding Day")],
    "096ii31": [("didn't turn, or turned somewhere", "didn't shed, or shed somewhere")],
    "0qc5f6w": [("who's turned", "who's shed")],
    "17cywpc": [("the Riders turned", "the Riders shed")],
    "0xuux8l": [("The Volute turns.", "The Volute sheds.")],
}

new = {}
for i, l in side.items():
    t = l["text"]
    for old, rep in EXACT.get(i, []):
        if old not in t:
            raise SystemExit(f"{i}: {old!r} is not in {t!r}")
        t = t.replace(old, rep)
    if i in LIP.split():
        t = lip(t)
    if i in STAY.split():
        t = stay(t)
    if i in CRAZE.split():
        t = craze(t)
    if i in KIND.split():
        t = species(t)
    if t != l["text"]:
        new[i] = t

ids = set(" ".join([LIP, STAY, CRAZE, KIND]).split()) | set(EXACT)
missing = sorted(i for i in ids if i not in side)
if missing:
    raise SystemExit(f"ids not in the export: {missing}")
out = os.path.join(ROOT, "dialogue", "naturalize", "renames.txt")
open(out, "w", encoding="utf-8").write("\n".join(f"[{i}] {side[i]['who']} | {t}" for i, t in new.items()) + "\n")
print(f"{len(new)} lines renamed. Wrote {out}")
