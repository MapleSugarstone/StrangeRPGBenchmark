#!/usr/bin/env python3
# Checks that flag a rewrite which may have changed what its line says. Shared by naturalize_review.py and
# naturalize_redo.py. They flag lines for review and change nothing.
import re

import naturalize_run as nr

TERMS = {"whorl": r"whorls?", "Seal": r"Seals?|Sealkeepers?", "Rim": r"Rim", "shed": r"shed(s|ding)?|Shedding Day|re-shedding",
         "fracture": r"fractures?d?", "species": r"species", "catch": r"catch(es|ing)?|caught", "cowries": r"cowries|cowrie",
         "pearl": r"pearls?", "notion": r"notions?", "nacre": r"nacre", "tide": r"tide", "horn": r"horns?", "Register": r"Register",
         "Midden": r"Midden", "grotto": r"grottos?", "conjoin": r"conjoin(s|ed|ing)?|Conjoiner", "crest": r"crests?",
         "wind-up": r"wind-up", "Splash": r"Splash", "Strand": r"Strand", "low or high water": r"low water|high water|spring low|dead low",
         "cast": r"casts?", "Volute": r"Volute", "Apex": r"Apex", "Operculum": r"Operculum", "Holdfast": r"Holdfast",
         "habit": r"habits?", "Starborn": r"Starborn", "charm": r"charms?", "Guard": r"Guard", "lead": r"lead"}
# Weak checks catch harmless rewrites as often as real problems, so they flag a line only when the reviewer agrees.
WEAK = ("much shorter", "almost every word changed", "a not or never appeared or went away", "a question became a statement, or the reverse")
DIRECTIONS = r"\b(north|south|east|west|left|right|up|down|above|below|under|over|inside|outside|behind|front|first|last|before|after)\b"
NEGATION = r"\b(not|never|no|nothing|nobody|none|nowhere|cannot)\b|n't\b"
STOP = set("the a an and or but of to in on at for with from by is are was were be been it its this that these those you your "
           "i me my we our they them their he she his her him not no so then than there here what which who as if".split())


def term_hits(t):
    return {k for k, p in TERMS.items() if re.search(r"(?<![A-Za-z])(" + p + r")(?![A-Za-z])", t)}


def checks(r, new):
    """Signs that a rewrite may have changed what the line says. These flag a line for review and change nothing."""
    orig = nr.PH.sub("", r["text"])
    flat = nr.PH.sub("", new.replace(" // ", " "))
    out = []
    names = {w for w in re.findall(r"[A-Za-z][A-Za-z']*", orig) if re.sub(r"'s$", "", w) in nr.NAMES and w not in ("I", "I'm", "I'll", "I'd", "I've")}
    lost = sorted({re.sub(r"'s$", "", w) for w in names} - {re.sub(r"'s$", "", w) for w in re.findall(r"[A-Za-z][A-Za-z']*", flat)})
    if lost:
        out.append("dropped the name " + ", ".join(lost))
    gone = sorted(term_hits(orig) - term_hits(flat))
    if gone:
        out.append("dropped the game word " + ", ".join(gone))
    caps = set(re.findall(r"\b[A-Z]{2,}(?: [A-Z]{2,})*\b", orig)) - {"HP", "ATK", "MGK", "DEF", "RES", "AGI", "CHA", "XP"}
    if any(c not in flat for c in caps if len(c) >= 4):
        out.append("changed words written in capitals")
    if len(orig) >= 30 and len(flat) < 0.6 * len(orig):
        out.append("much shorter")
    content = [w for w in re.findall(r"[a-z']+", orig.lower()) if len(w) > 3 and w not in STOP]
    if len(content) >= 6 and sum(1 for w in set(content) if w in flat.lower()) < 0.2 * len(set(content)):
        out.append("almost every word changed")
    d0, d1 = set(re.findall(DIRECTIONS, orig.lower())), set(re.findall(DIRECTIONS, flat.lower()))
    if {"north", "south", "east", "west"} & (d0 ^ d1):
        out.append("a direction changed")
    if bool(re.search(NEGATION, orig.lower())) != bool(re.search(NEGATION, flat.lower())):
        out.append("a not or never appeared or went away")
    if orig.rstrip().endswith("?") != flat.rstrip().endswith("?"):
        out.append("a question became a statement, or the reverse")
    return out


def strong(r, new):
    """The checks that flag a line on their own, without a reviewer agreeing."""
    return [h for h in checks(r, new) if h not in WEAK]
