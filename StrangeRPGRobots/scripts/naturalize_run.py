#!/usr/bin/env python3
# Full naturalize pass over naturalize/fathom-lines.txt through Naturalizer on the desktop.
#   python scripts/naturalize_run.py ["prompt"] [--limit-minutes N]
# Progress: Notes/naturalize-progress.txt, rewritten every few seconds.
# Stop early: create naturalize/stop. The batch in hand finishes, then the report is written, marked partial.
# Resumes from naturalize/natural-state.json, so a stopped run picks up where it left off.
# A rewrite that breaks a rule or misreads a word goes back with a note, and each try gets a different, more specific
# note: then its last try, then the line alone with a request to change only a few words, then a precise fix, then a
# request for the smallest change. Six tries at most. A line the model leaves as it was is kept as it was.
# Accepted rewrites go to naturalize/fathom-lines-natural.txt, ready for: node scripts/lines.mjs import <file>
# Rewrites the guards turned down are kept for review in naturalize/rejected-review.txt, in the same format.
import json
import os
import re
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.environ.get("NATURALIZER_DIR", r"C:\Users\Krazv\Documents\Naturalizer-API"))
from naturalize import naturalize  # noqa: E402

NAT = os.path.join(ROOT, "naturalize")
# --set ui runs the second pass over naturalize/fathom-lines-ui.txt with its own state, output, and progress files.
SET = sys.argv[sys.argv.index("--set") + 1] if "--set" in sys.argv else ""
if "--set" in sys.argv:
    del sys.argv[sys.argv.index("--set"):sys.argv.index("--set") + 2]
SUF = f"-{SET}" if SET else ""
SRC = os.path.join(NAT, f"fathom-lines{SUF}.txt")
STATE = os.path.join(NAT, f"natural-state{SUF}.json")
OUT = os.path.join(NAT, f"fathom-lines{SUF}-natural.txt")
REVIEW = os.path.join(NAT, f"rejected-review{SUF}.txt")
STOP = os.path.join(NAT, "stop")
PROGRESS = os.path.join(ROOT, "Notes", f"naturalize-progress{SUF}.txt")
REPORT = os.path.join(ROOT, "Notes", f"naturalize-report{SUF}.md")
GLYPHS = json.load(open(os.path.join(NAT, "glyph-widths.json"), encoding="utf-8"))


def width(text):
    """Pixel width in the game font, leaving out ${...} placeholders, which fill in at run time."""
    t = re.sub(r"\$\{[^}]*\}", "", text)
    return sum(GLYPHS.get(c, 5) for c in t) + max(0, len(t) - 1)

args = [a for a in sys.argv[1:]]
limit = None
if "--limit-minutes" in args:
    i = args.index("--limit-minutes")
    limit = float(args[i + 1]) * 60
    del args[i:i + 2]
PROMPT = args[0] if args else "Can you make the sentences less clunky, and sound a bit more natural? Rewrite most of them."
if PROMPT.startswith("@"):
    PROMPT = open(PROMPT[1:], encoding="utf-8").read().strip()
BATCH = 16

LINE = re.compile(r"^\[([^\]]+)\] ([^|]*?) \| (.*)$")
rows = [m.groups() for m in map(LINE.match, open(SRC, encoding="utf-8").read().splitlines()) if m]


def group_key(i):
    if re.match(r"^(ui|card|area|faction|rule):", i):
        return i.split(":")[1]
    if i.startswith("data:"):
        return i.rsplit(".", 1)[0]
    if i.startswith("bark:"):
        return i.split(":")[1]
    return i.rsplit(".", 1)[0]


# Batches keep a scene (or a data entry, or a map's barks) together, up to BATCH lines.
batches, cur, last = [], [], None
for r in rows:
    k = group_key(r[0])
    if cur and (len(cur) >= BATCH or (k != last and len(cur) + 1 > BATCH * 0.75)):
        batches.append(cur)
        cur = []
    cur.append(r)
    last = k
if cur:
    batches.append(cur)

state = {"done": [], "results": {}, "rejected": {}, "failed": [], "swept": [], "fixed": 0, "attempts": {}}
if os.path.exists(STATE):
    state.update(json.load(open(STATE, encoding="utf-8")))
done = set(state["done"])

SPEAKER_LINE = re.compile(r"^\s*([A-Z!][A-Za-z .'!]*?)\s*:\s*(.*)$")
SLANG = re.compile(r"\b(yeah|yep|nope|gonna|wanna|gotta|kinda|guys|ok|okay)\b|'em\b", re.I)
QUOTES = str.maketrans({"\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u2026": "..."})


def keep_lowercase(orig, new):
    """Lines written in lowercase (Tova) stay lowercase, except words the original capitalized."""
    caps = {w for w in re.findall(r"[A-Za-z']+", orig) if w[0].isupper()}
    def fix(m):
        w = m.group(0)
        return w if w in caps else w.lower()
    return re.sub(r"[A-Za-z']+", fix, new)


def mid_caps(text):
    """Capitalized words that are not the first word of a sentence."""
    out = set()
    for sent in re.split(r"(?<=[.!?:])\s+|\"", text):
        for w in re.findall(r"[A-Za-z][A-Za-z']*", sent)[1:]:
            if w[0].isupper() and not w.isupper():
                out.add(re.sub(r"'s$", "", w))
    return out


# The game's names: words written capitalized mid-sentence somewhere (Opal, Board, Nine) whose capitalized
# form is at least as common as the lowercase one, so ordinary words like The and Hands do not count.
_caps, _lower = {}, {}
for _r in rows:
    for _w in mid_caps(_r[2]):
        _caps[_w] = _caps.get(_w, 0) + 1
    for _w in re.findall(r"\b[a-z][a-z']*", _r[2]):
        _w = re.sub(r"'s$", "", _w)
        _lower[_w] = _lower.get(_w, 0) + 1
NAMES = {w for w, n in _caps.items() if n >= _lower.get(w.lower(), 0)}


def names(text):
    """Names in a line, wherever they sit in a sentence."""
    return {re.sub(r"'s$", "", w) for w in re.findall(r"[A-Za-z][A-Za-z']*", text)} & NAMES


def misreads(orig, new):
    """Signs the rewrite misunderstood a word: an ordinary word turned into a name, a name turned into an ordinary
    word, or the Board used as the verb to board."""
    notes = []
    words = {w.lower() for w in re.findall(r"[A-Za-z][A-Za-z']*", orig)}
    for w in sorted(mid_caps(new) - mid_caps(orig)):
        if w.lower() in words and w not in NAMES and not w.isupper():
            notes.append(f"{w.lower()} is an ordinary word here, not a name")
    for w in sorted(names(orig)):
        if w not in new and re.search(r"\b" + re.escape(w.lower()) + r"\b", new):
            notes.append(f"{w} is a name here, not an ordinary word")
    if re.search(r"\bBoard (the|a|an|her|his|it)\b", new) and not re.search(r"\bBoard (the|a|an|her|his|it)\b", orig):
        notes.append("the Board is the company here, not the verb to board")
    return notes


BANNED = ["whisper", "shimmer", "tapestry", "testament", "journey", "destiny", "ancient", "gaze", "grin",
          "mutter", "something shifted", "a part of me", "i guess", "look,", "elara", "kael"]


def subseq(a, b):
    it = iter(b)
    return all(c in it for c in a)


def short_cut(orig, new):
    """Interface text cut down too far, or squeezed into abbreviations, to fit."""
    po, pn = PLACEHOLDER.sub("", orig).strip(), PLACEHOLDER.sub("", new).strip()
    if len(po) >= 12 and len(pn) < 0.55 * len(po):
        return "shortened"
    ow = re.findall(r"[A-Za-z]+", po)
    lower = {w.lower() for w in ow}
    for w in re.findall(r"[A-Za-z']+", pn):
        lw = w.lower()
        if lw in lower or "'" in w:
            continue
        if w.isupper() and len(w) >= 2:
            return f"abbrev: {w}"
        for o in ow:
            lo = o.lower()
            near_plural = lo.startswith(lw) and len(lo) - len(lw) <= 1
            if len(lw) <= 5 and len(lo) > len(lw) and lw[0] == lo[0] and subseq(lw, lo) and not near_plural:
                return f"abbrev: {w}"
    return None


# Lines that cannot become several boxes: a choice is one option, and a notice or chapter title is one string.
UNSPLIT = ("HERO CHOICE", "CHOICE PROMPT", "NOTICE", "CHAPTER TITLE")


def split_parts(text, cap):
    """Long dialogue goes into several boxes, split between sentences. The import writes each part as its own line."""
    parts, cur = [], ""
    pieces = []
    for s in re.split(r"(?<=[.!?])\s+", text):
        # A single sentence over the cap breaks at a comma, and the next box carries on mid-sentence.
        while len(s) > cap and ", " in s[:cap]:
            k = s[:cap].rindex(", ") + 1
            pieces.append(s[:k])
            s = s[k + 1:]
        pieces.append(s)
    for s in pieces:
        if cur and len(cur) + 1 + len(s) > cap:
            parts.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    return " | ".join(parts + [cur])


def clean(i, speaker, orig, new):
    """The rewrite to keep, or (None, reason)."""
    new = new.translate(QUOTES).replace("*", "").replace("_", " ").strip().strip('"').strip()
    if not new:
        return None, "empty"
    # Case fixes look only at plain text, never inside ${...} values, which are code.
    plain = re.sub(r"\$\{[^}]*\}", "", orig)
    first = next((c for c in plain if c.isalpha()), "")
    if first and first.islower():
        parts = re.split(r"(\$\{[^}]*\})", new)
        new = "".join(x if x.startswith("${") else keep_lowercase(plain, x) for x in parts)
    letters = [c for c in plain if c.isalpha()]
    if len(letters) > 3 and all(c.isupper() for c in letters):
        parts = re.split(r"(\$\{[^}]*\})", new)
        new = "".join(x if x.startswith("${") else x.upper() for x in parts)
    # Dashes and semicolons become commas and periods instead of sending the line back.
    new = re.sub(r"\s*[\u2014\u2013]\s*", ", ", new)
    new = re.sub(r";\s*(\w)", lambda m: ". " + m.group(1).upper(), new).replace(";", ".")
    low = new.lower()
    for b in BANNED:
        if re.search(r"\b" + re.escape(b), low) and not re.search(r"\b" + re.escape(b), orig.lower()):
            return None, f"banned: {b}"
    if len(words(orig)) >= 5 and not (words(orig) & words(new)):
        return None, "misaligned"
    notes = misreads(orig, new)
    if notes:
        return None, "misread: " + ". ".join(n[0].upper() + n[1:] for n in notes)
    for tok in ("{name}", "{port}"):
        if orig.count(tok) != new.count(tok):
            return None, f"lost {tok}"
    for tok in re.findall(r"\$\{[^}]*\}", orig):
        if orig.count(tok) != new.count(tok):
            return None, f"lost {tok}"
    if i.startswith(("area:", "faction:", "card:")) and set(re.findall(r"\b[A-Z][a-z']+", orig)) - {"The"} != set(re.findall(r"\b[A-Z][a-z']+", new)) - {"The"}:
        return None, "renamed"
    if re.match(r"^(ui|card|area|faction|rule):", i):
        cut = short_cut(orig, new)
        if cut:
            return None, cut
        roomy = speaker in ("UI HINT", "SLUICE RULE")
        cap = 180 if speaker == "CREDITS" else 160 if speaker == "NOTICE" else round(width(orig) * 1.15) if roomy else width(orig)
        if width(new) > cap:
            n = len(re.sub(r"\$\{[^}]*\}", "", orig))
            return None, f"too wide: {n}"
    if i.startswith("banter:") or ":b_" in i:
        cap = 46
    elif i.startswith("bark:"):
        cap = max(46, len(orig))
    elif i.startswith("data:"):
        cap = max(140, len(orig) + 20)
    else:
        cap = 100
    if len(new) > cap:
        spoken = not re.match(r"^(data|bark|ui|card|area|faction|rule):", i) and speaker not in UNSPLIT
        if not (spoken or (i.startswith("data:details_") and i.endswith(".text"))):
            return None, f"over {cap} characters"
        new = " | ".join(split_parts(p.strip(), cap) for p in new.split("|"))
    if new == orig:
        return None, "unchanged"
    return new, None


FEEDBACK = {
    "dash or semicolon": "Use no dashes and no semicolons.",
    "empty": "Give a rewrite of this line.",
    "missing from the answer": "Give a rewrite of this line too.",
    "courtesy contraction": "Courtesy speaks only in formal public announcement phrases, with no contractions.",
    "ambrose slang": "Ambrose is grand and formal. No slang and no casual clipping.",
    "board verb": "The Board is a company name here, never the verb to board.",
}


def feedback(reason):
    if reason in FEEDBACK:
        return FEEDBACK[reason]
    if reason.startswith("misread: "):
        return reason[9:] + ". Rewrite it with that meaning."
    if reason.startswith("redo: "):
        return reason[6:] + ". Rewrite it with that meaning."
    if reason.startswith("redo-same: "):
        return reason[11:] + ". Rewrite it in new words with that meaning, rather than returning it as it is."
    if reason == "shortened":
        return "Keep the whole meaning. Do not cut it down to a word or two."
    if reason.startswith("abbrev: "):
        return f"Write whole words. No abbreviations like {reason[8:]}."
    if reason.startswith("banned: "):
        return f"Do not use the word {reason[8:]}."
    if reason == "misaligned":
        return "Rewrite this exact line and keep its meaning."
    if reason.startswith("too wide: "):
        return f"It has to fit on screen. Keep it at most {reason[10:]} characters."
    if reason == "renamed":
        return "This is the name of a place or a group. Keep the name itself exactly."
    if reason.startswith("names: "):
        return f"Keep these names exactly as written: {reason[7:]}."
    if reason.startswith("lost ${"):
        return "Keep every {v1}-style token exactly as written, braces included."
    if reason.startswith("lost "):
        return f"Keep {reason[5:]} exactly as written, braces included."
    if reason.startswith("over "):
        return f"Keep it under {reason.split()[1]} characters."
    return "Try again."


PLACEHOLDER = re.compile(r"\$\{[^}]*\}")


def masked(t):
    k = [0]
    def tok(_m):
        k[0] += 1
        return "{v" + str(k[0]) + "}"
    return PLACEHOLDER.sub(tok, t)


def unmasked(new, orig):
    vals = PLACEHOLDER.findall(orig)
    return re.sub(r"\{v(\d+)\}", lambda m: vals[int(m.group(1)) - 1] if int(m.group(1)) <= len(vals) else m.group(0), new)


def words(t):
    return {w for w in re.findall(r"[a-z0-9']+", t.lower()) if len(w) > 2}


def parse(out, batch):
    """Answer lines matched to batch lines. When the counts agree they pair in order. When the model dropped or
    added a line, each answer goes to the nearest unmatched original with the same speaker that shares the most words."""
    ans = []
    for line in out.splitlines():
        m = SPEAKER_LINE.match(line.replace("**", ""))
        if m:
            ans.append((m.group(1).strip().upper(), m.group(2)))
    spk = [b[1].lstrip("!").strip().upper() for b in batch]
    if len(ans) == len(batch) and all(a[0] == sp for a, sp in zip(ans, spk)):
        return {batch[k][0]: ans[k][1] for k in range(len(batch))}
    got, used = {}, set()
    for a_sp, a_text in ans:
        best, score = None, -1
        for k, b in enumerate(batch):
            if k in used or spk[k] != a_sp:
                continue
            sc = len(words(a_text) & words(b[2]))
            if sc > score:
                best, score = k, sc
        if best is not None and (score > 0 or len(words(batch[best][2])) < 4):
            used.add(best)
            got[batch[best][0]] = a_text
    return got


def accept(batch, got):
    """Keeps clean rewrites and records why the rest were not kept. Returns the lines worth another try."""
    again = []
    for i, s, t in batch:
        if i not in got:
            state["rejected"][i] = "missing from the answer"
            again.append((i, s, t))
            continue
        got[i] = unmasked(got[i], t)
        new, why = clean(i, s, t, got[i])
        # A line marked by hand for a redo turns down any answer it already turned down.
        if new is not None and i in state.get("redo", {}) and any(a == new for a, w in state["attempts"].get(i, []) if w.startswith("redo")):
            new, why = None, "redo: " + state["redo"][i]
        if why == "unchanged" and i in state.get("redo", {}):
            why = "redo-same: " + state["redo"][i]
        if new is None:
            state["rejected"][i] = why
            state["results"].pop(i, None)
            if why != "unchanged":
                state["attempts"].setdefault(i, []).append([got[i].translate(QUOTES).strip(), why])
                again.append((i, s, t))
        else:
            state["results"][i] = new
            state["rejected"].pop(i, None)
            state.get("redo", {}).pop(i, None)
    return again


def specific(reason):
    """A precise instruction for the fourth try."""
    if reason.startswith("misread: "):
        fixes = []
        for part in reason[9:].split(". "):
            m = re.match(r"(?:The )?(\S+) is an ordinary word", part)
            if m:
                fixes.append(f"Write {m.group(1).lower()} in lowercase, as an ordinary word.")
            m = re.match(r"(\S+) is a name", part)
            if m:
                fixes.append(f"Keep {m.group(1)} capitalized, as a name.")
            if "verb to board" in part:
                fixes.append("Keep the words the Board as a noun, the company.")
        return " ".join(fixes)
    if reason.startswith("lost "):
        return f"The text {reason[5:]} must appear exactly as written."
    if reason.startswith("over "):
        return "Use fewer words than the original line."
    if reason == "missing from the answer":
        return "Answer with exactly one line, in the form Speaker: text."
    return ""


def note_for(i, k):
    """The note for try k on line i. Each try asks in a different way."""
    reason = state["rejected"].get(i, "missing from the answer")
    base = feedback(reason)
    tries = state["attempts"].get(i, [])
    last = tries[-1][0] if tries else ""
    if k == 0:
        return base
    if k == 1:
        return f'{base} Your last try was: "{last}". It still has that problem.'
    if k == 2:
        return f"{base} Change only a few words of the original."
    if k == 3:
        avoid = " / ".join(f'"{t}"' for t, _ in tries[-3:])
        return f"{base} {specific(reason)} Do not write any of these: {avoid}"
    return f"{base} {specific(reason)} Make the smallest change that sounds natural. Returning the original line unchanged is fine."


def retry(items):
    """Sends rejected lines back with notes, up to six tries. From the third try, each line goes alone."""
    swept = set(state["swept"])
    for k in range(6):
        if not items:
            break
        swept.update(i for i, _, _ in items)
        groups = [[it] for it in items] if k >= 2 else [items]
        left = []
        for g in groups:
            text = "\n".join(f"({note_for(i, k)})\n{s.lstrip('!')}: {masked(t)}" for i, s, t in g)
            prompt = (PROMPT + " An earlier rewrite of each line below had a problem. Follow the note in parentheses "
                      "above each line, and do not repeat the notes in your answer.")
            try:
                out = naturalize(text, prompt=prompt)
            except Exception as e:  # noqa: BLE001
                print(f"retry: {e}", flush=True)
                left += g
                continue
            before = len(state["results"])
            left += accept(g, parse(out, g))
            state["fixed"] += len(state["results"]) - before
        items = left
    state["swept"] = sorted(swept)


# Attempts turned down under older rules get checked again, and the first one that now passes is kept.
_by = {r[0]: r for r in rows}
for _i, _tries in list(state["attempts"].items()):
    if _i in state["results"] or _i not in _by or _i in state.get("redo", {}):
        continue
    for _text, _why in _tries:
        _new, _reason = clean(_i, _by[_i][1], _by[_i][2], _text)
        if _new is not None:
            state["results"][_i] = _new
            state["rejected"].pop(_i, None)
            state["fixed"] += 1
            break

# Lines already kept get every check again. A flagged one goes back into the retry sweep.
_flagged = 0
for _i, _new in list(state["results"].items()):
    if _i not in _by or _i in state.get("hand", []):
        continue
    _ok, _why = clean(_i, _by[_i][1], _by[_i][2], _new)
    if _ok is None and _why != "unchanged":
        state["results"].pop(_i)
        state["rejected"][_i] = _why
        state["attempts"].setdefault(_i, []).append([_new, _why])
        state["swept"] = [x for x in state["swept"] if x != _i]
        _flagged += 1
print(f"recheck: {_flagged} kept lines sent back", flush=True)

start = time.time()
status = {"batch": None, "since": start}


def write_progress(final=False, partial=False):
    n_done = len(done)
    lines_done = sum(len(batches[b]) for b in done if b < len(batches))
    elapsed = time.time() - start
    rate = lines_done_this_run[0] / elapsed if elapsed > 0 and lines_done_this_run[0] else 0
    left = len(rows) - lines_done
    eta = left / rate if rate else 0
    changed = len(state["results"])
    rej = {}
    for r in state["rejected"].values():
        rej[r] = rej.get(r, 0) + 1
    text = [
        "Naturalize pass" + (" (stopped early)" if partial else " (finished)" if final else " (running)"),
        f"Prompt: {PROMPT}",
        f"Batches: {n_done} of {len(batches)}. Lines: {lines_done} of {len(rows)}.",
        f"Changed: {changed}. Kept as they were: {sum(rej.values())} ({', '.join(f'{k} {v}' for k, v in sorted(rej.items(), key=lambda x: -x[1]))}).",
        f"Fixed on retry: {state['fixed']}. Failed batches: {len(state['failed'])}.",
        f"Elapsed this run: {elapsed / 60:.1f} min. Estimated time left: {eta / 60:.0f} min.",
    ]
    if status["batch"] == "retry" and not final:
        text.append(f"Retrying rejected lines for {time.time() - status['since']:.0f} s.")
    elif status["batch"] is not None and not final:
        text.append(f"Working on batch {status['batch'] + 1} for {time.time() - status['since']:.0f} s.")
    text.append(f"Stop early: create {STOP}")
    os.makedirs(os.path.dirname(PROGRESS), exist_ok=True)
    open(PROGRESS, "w", encoding="utf-8").write("\n".join(text) + "\n")


def save():
    json.dump(state, open(STATE, "w", encoding="utf-8"))
    by_id = {r[0]: r for r in rows}
    out = [f"[{i}] {by_id[i][1]} | {t}" for i, t in state["results"].items() if i in by_id]
    open(OUT, "w", encoding="utf-8").write("\n".join(out) + "\n")
    review = ["# Rewrites the guards turned down, for review. Each block shows the original and the reason above each",
              "# attempt. Delete the attempts you do not want, keep at most one per id, then import this file with:",
              "#   node scripts/lines.mjs import naturalize/rejected-review.txt", ""]
    for i, tries in state["attempts"].items():
        if i in state["results"] or i not in by_id:
            continue
        review.append(f"# original: {by_id[i][2]}")
        for text, why in tries:
            review.append(f"# reason: {why}")
            review.append(f"[{i}] {by_id[i][1]} | {text}")
        review.append("")
    open(REVIEW, "w", encoding="utf-8").write("\n".join(review) + "\n")


lines_done_this_run = [0]
stop_beat = threading.Event()


def beat():
    while not stop_beat.wait(5):
        write_progress()


threading.Thread(target=beat, daemon=True).start()
partial = False
for b, batch in enumerate(batches):
    if b in done:
        continue
    if os.path.exists(STOP) or (limit and time.time() - start > limit):
        partial = True
        break
    status["batch"], status["since"] = b, time.time()
    text = "\n".join(f"{s.lstrip('!')}: {masked(t)}" for _, s, t in batch)
    out = None
    for attempt in range(3):
        try:
            out = naturalize(text, prompt=PROMPT)
            break
        except Exception as e:  # noqa: BLE001
            print(f"batch {b}: {e}", flush=True)
            time.sleep(10 * (attempt + 1))
    if out is None:
        state["failed"].append(b)
    else:
        again = accept(batch, parse(out, batch))
        if again:
            retry(again)
    done.add(b)
    state["done"] = sorted(done)
    lines_done_this_run[0] += len(batch)
    save()
    print(f"batch {b + 1}/{len(batches)} in {time.time() - status['since']:.0f} s", flush=True)

# Lines rejected before retries existed, or in batches from an earlier run, get their tries now.
if not partial:
    by_row = {r[0]: r for r in rows}
    swept = set(state["swept"])
    left = [by_row[i] for i, why in list(state["rejected"].items()) if why != "unchanged" and i not in swept and i in by_row]
    for k in range(0, len(left), 20):
        if os.path.exists(STOP):
            partial = True
            break
        status["batch"], status["since"] = "retry", time.time()
        retry(left[k:k + 20])
        save()

stop_beat.set()
status["batch"] = None
save()
write_progress(final=not partial, partial=partial)
by_id = {r[0]: r for r in rows}
samples = list(state["results"].items())[:: max(1, len(state["results"]) // 25)][:25]
rep = ["# Naturalize report" + (" (partial)" if partial else ""), "", f"Prompt: {PROMPT}", "",
       open(PROGRESS, encoding="utf-8").read(), "## Samples", ""]
for i, t in samples:
    rep += [f"- `{i}` {by_id[i][1]}", f"  - Before: {by_id[i][2]}", f"  - After: {t}"]
open(REPORT, "w", encoding="utf-8").write("\n".join(rep) + "\n")
print("done" + (" (partial)" if partial else ""), flush=True)
