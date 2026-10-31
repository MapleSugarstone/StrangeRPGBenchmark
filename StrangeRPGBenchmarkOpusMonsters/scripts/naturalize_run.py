#!/usr/bin/env python3
# Naturalize pass over dialogue/whorl-text.txt through Naturalizer on the desktop.
#   python scripts/naturalize_run.py ["prompt" | @promptfile] [--sets story,ui] [--push] [--limit-minutes N]
# Run `node scripts/lines.mjs export` first. The rules set (move and passive text) is left out unless --sets names it.
# Progress: Notes/naturalize-progress.txt, rewritten every few seconds.
# Stop early: create dialogue/naturalize/stop. The batch in hand finishes, then the report is written, marked partial.
# Resumes from dialogue/naturalize/state.json, so a stopped run picks up where it left off.
# A rewrite that breaks a rule or misreads a word goes back with a note, and each try asks in a different way. Six tries
# at most. --push sends each line the model left unchanged back once, asking for new words.
# Accepted rewrites go to dialogue/naturalize/natural.txt, ready for: node scripts/lines.mjs import dialogue/naturalize/natural.txt
# Rewrites the guards turned down are kept in dialogue/naturalize/turned-down.txt, in the same format, for review.
import json
import os
import re
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.environ.get("NATURALIZER_DIR", r"C:\Users\Krazv\Documents\Naturalizer-API"))
from naturalize import naturalize  # noqa: E402

NAT = os.path.join(ROOT, "dialogue", "naturalize")
SRC = os.path.join(ROOT, "dialogue", "whorl-text.txt")
SIDE = os.path.join(ROOT, "dialogue", ".export.json")
STATE = os.path.join(NAT, "state.json")
OUT = os.path.join(NAT, "natural.txt")
REVIEW = os.path.join(NAT, "turned-down.txt")
STOP = os.path.join(NAT, "stop")
PROGRESS = os.path.join(ROOT, "Notes", "naturalize-progress.txt")
REPORT = os.path.join(ROOT, "Notes", "naturalize-report.md")
DEFAULT_PROMPT = "Can you make the sentences less clunky, and sound a bit more natural? Rewrite most of them."
BATCH = 16

LINE = re.compile(r"^\[([0-9a-z]{7})\] ([^|]*?) \| (.*)$")
PH = re.compile(r"\{[^}]*\}")
QUOTES = str.maketrans({"\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u2026": "..."})


def load_rows(sets):
    """Lines of the document in order, joined with the export's record of where each one lives."""
    side = json.load(open(SIDE, encoding="utf-8"))["lines"]
    rows = []
    for line in open(SRC, encoding="utf-8").read().splitlines():
        m = LINE.match(line)
        if m and m.group(1) in side:
            s = side[m.group(1)]
            if s.get("set", "story") in sets:
                rows.append({"id": m.group(1), "who": m.group(2), "text": s["text"], "set": s.get("set", "story"),
                             "split": s.get("split"), "file": s["file"], "scene": s.get("scene") or s["file"]})
    return rows


def make_batches(rows):
    """Batches keep a scene together, up to BATCH lines. A scene's tail joins the next scene only when it is short."""
    batches, cur, last = [], [], None
    for r in rows:
        k = (r["file"], r["scene"])
        if cur and (len(cur) >= BATCH or (k != last and len(cur) + 1 > BATCH * 0.75)):
            batches.append(cur)
            cur = []
        cur.append(r)
        last = k
    if cur:
        batches.append(cur)
    return batches


LABELS = {"narration": "Narration", "look": "Description", "hint": "Hint", "goal": "Goal", "notice": "Notice",
          "choice": "Choice", "choice prompt": "Question", "battle": "Battle", "menu": "Menu", "item": "Item"}


def label(r):
    """The speaker name the model sees. Internal labels become plain words."""
    w = r["who"]
    if r["set"] == "rules":
        return "Rule"
    if w in LABELS:
        return LABELS[w]
    if w.startswith("Register entry"):
        return "Register"
    if w.startswith("sign or spot"):
        return "Sign"
    if w.startswith("?") and r["file"].endswith("/guide.ts"):
        return "Guide"
    w = re.sub(r"[^A-Za-z .'-]", "", w).strip() if not w.startswith("?") else ""
    return w if len(w) > 1 and w[0].isalpha() else "Text"


def mask(t):
    """Placeholders become {v1}, {v2}, so the model sees short tokens instead of code."""
    order = []
    for p in PH.findall(t):
        if p not in order:
            order.append(p)
    return PH.sub(lambda m: "{v" + str(order.index(m.group(0)) + 1) + "}", t)


def unmask(new, orig):
    order = []
    for p in PH.findall(orig):
        if p not in order:
            order.append(p)
    return re.sub(r"\{v(\d+)\}", lambda m: order[int(m.group(1)) - 1] if int(m.group(1)) <= len(order) else m.group(0), new)


def words(t):
    return {w for w in re.findall(r"[a-z0-9']+", PH.sub("", t).lower()) if len(w) > 2}


def mid_caps(text):
    """Capitalized words that are not the first word of a sentence."""
    out = set()
    for sent in re.split(r"(?<=[.!?:])\s+|\"", PH.sub("", text)):
        for w in re.findall(r"[A-Za-z][A-Za-z']*", sent)[1:]:
            if w[0].isupper() and not w.isupper():
                out.add(re.sub(r"'s$", "", w))
    return out


def build_names(rows):
    """The game's names: words written capitalized mid-sentence at least as often as in lowercase."""
    caps, lower = {}, {}
    for r in rows:
        for w in mid_caps(r["text"]):
            caps[w] = caps.get(w, 0) + 1
        for w in re.findall(r"\b[a-z][a-z']*", r["text"]):
            w = re.sub(r"'s$", "", w)
            lower[w] = lower.get(w, 0) + 1
    return {w for w, n in caps.items() if n >= lower.get(w.lower(), 0)}


NAMES = set()


def misreads(orig, new):
    """Signs the rewrite misunderstood a word: an ordinary word turned into a name, or a name into an ordinary word."""
    notes = []
    low = {w.lower() for w in re.findall(r"[A-Za-z][A-Za-z']*", orig)}
    for w in sorted(mid_caps(new) - mid_caps(orig)):
        if w.lower() in low and w not in NAMES and not w.isupper():
            notes.append(f"{w.lower()} is an ordinary word here, not a name")
    have = {re.sub(r"'s$", "", w) for w in re.findall(r"[A-Za-z][A-Za-z']*", orig)} & NAMES
    for w in sorted(have):
        if w not in new and re.search(r"\b" + re.escape(w.lower()) + r"\b", new):
            notes.append(f"{w} is a name here, not an ordinary word")
    return notes


def banned_list():
    """The content validator's banned patterns, read from src/tools/test.ts so the two never disagree."""
    t = open(os.path.join(ROOT, "src", "tools", "test.ts"), encoding="utf-8").read()
    m = re.search(r"const banned = (\[.*\]);", t)
    out = []
    for pat, flags in re.findall(r"/((?:\\.|[^/\\])+)/([a-z]*)", m.group(1) if m else ""):
        out.append(re.compile(pat, re.I if "i" in flags else 0))
    return out


BANNED = banned_list()


def boxlen(s):
    return len(PH.sub("x" * 8, s))


def cap_for(r):
    """Characters per text box, matching what scripts/lines.mjs import accepts."""
    n = boxlen(r["text"])
    roomy = max(round(n * 1.25), n + 8)
    if r["set"] == "ui":
        return roomy
    if r["set"] == "rules":
        return max(n, 70)
    if r["who"] in ("choice", "choice prompt"):
        return min(100, roomy)
    if r["file"].startswith("src/content/"):
        # A line already over 100 characters is a wrapped paragraph, such as a guide page, rather than a text box.
        return roomy if n > 100 else 100
    return max(n, 140)


def split_parts(text, cap):
    """Long dialogue goes into several boxes, split between sentences, or at a comma when one sentence is too long."""
    pieces = []
    for s in re.split(r"(?<=[.!?])\s+", text):
        while boxlen(s) > cap and ", " in s[:cap]:
            k = s[:cap].rindex(", ") + 1
            pieces.append(s[:k])
            s = s[k + 1:]
        pieces.append(s)
    parts, cur = [], ""
    for s in pieces:
        if cur and boxlen(cur) + 1 + boxlen(s) > cap:
            parts.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    return parts + [cur]


def keep_lowercase(orig, new):
    """Lines written in lowercase stay lowercase, except words the original capitalized."""
    caps = {w for w in re.findall(r"[A-Za-z']+", orig) if w[0].isupper()}
    return re.sub(r"[A-Za-z']+", lambda m: m.group(0) if m.group(0) in caps else m.group(0).lower(), new)


def nums(s):
    # Decimals count whole, so "0.5x" turned into "0 5" is caught.
    return sorted(re.findall(r"\d+(?:\.\d+)?", PH.sub("", s)))


PRONOUNS = {"she": r"\b(she|her|hers|herself)\b", "he": r"\b(he|him|his|himself)\b",
            "it": r"\b(it|its|itself)\b", "they": r"\b(they|them|their|theirs|themselves)\b"}


def pronoun_count(t):
    t = PH.sub("", t).lower()
    return {k: len(re.findall(p, t)) for k, p in PRONOUNS.items()}


GENDERED = {
    "he": r"\b(man|husband|grand-?dad|grandfather|dad|father|son|brother|boy|uncle|king|sir|lad|grandson|nephew)\b",
    "she": r"\b(woman|wife|gran|granny|grandmother|mum|mom|mother|daughter|sister|girl|aunt|lady|queen|granddaughter|niece)\b",
}


def pronoun_change(orig, new):
    """A rewrite that gives someone a he or she the original never used, or swaps one pronoun for another. An added he
    or she is fine when the line names a person of that gender and does not mention Ouro, who is always they."""
    a, b = pronoun_count(orig), pronoun_count(new)
    for k in ("she", "he"):
        if b[k] and not a[k] and ("Ouro" in orig or not re.search(GENDERED[k], PH.sub("", orig).lower())):
            return f"pronouns: added {k}"
    for k in ("she", "he", "they"):
        if a[k] and not b[k] and any(b[x] > a[x] for x in PRONOUNS if x != k):
            return f"pronouns: {k} changed"
    return None


# Words after "her" that show it is an object ("gave it to her and left") rather than a possessive ("her boot").
OBJ_NEXT = set("to and the a an at in on with for from up down out back off again too now then here there over away around "
               "round alone go be is was about into onto through by or but so if when as like before after once".split())


def neutral(new, k):
    """An added his, him, or her becomes their or them. None when the line uses he or she as a subject, which would need
    its verb changed too."""
    if re.search(rf"\b{k}\b|\b{k}'", new, re.I):
        return None
    case = lambda w, rep: rep[0].upper() + rep[1:] if w[0].isupper() else rep
    if k == "he":
        rep = {"his": "their", "him": "them", "himself": "themself"}
        return re.sub(r"\b(his|him|himself)\b", lambda m: case(m.group(0), rep[m.group(0).lower()]), new, flags=re.I)

    def her(m):
        rest = m.string[m.end():]
        nxt = re.match(r"\s+([A-Za-z']+)", rest)
        obj = not nxt or nxt.group(1).lower() in OBJ_NEXT
        return case(m.group(0), "them" if obj else "their")
    out = re.sub(r"\bherself\b", lambda m: case(m.group(0), "themself"), new, flags=re.I)
    out = re.sub(r"\bhers\b", lambda m: case(m.group(0), "theirs"), out, flags=re.I)
    return re.sub(r"\bher\b", her, out, flags=re.I)


def clean(r, new):
    """The rewrite to keep, or (None, reason)."""
    orig = r["text"]
    new = new.translate(QUOTES).replace("**", "").strip().strip('"').strip()
    # Box splits are made below, so any the answer carries over are joined back first.
    new = re.sub(r"\s*//\s*", " ", new)
    if not new:
        return None, "empty"
    plain = PH.sub("", orig)
    first = next((c for c in plain if c.isalpha()), "")
    parts = re.split(r"(\{[^}]*\})", new)
    if first and first.islower():
        new = "".join(x if x.startswith("{") else keep_lowercase(plain, x) for x in parts)
    letters = [c for c in plain if c.isalpha()]
    if len(letters) > 3 and all(c.isupper() for c in letters):
        new = "".join(x if x.startswith("{") else x.upper() for x in parts)
    # Dashes and semicolons become commas and periods instead of sending the line back.
    new = re.sub(r"\s*[\u2014\u2013]\s*|\s+-{1,2}\s+", ", ", new)
    new = re.sub(r";\s*(\w)", lambda m: ". " + m.group(1).upper(), new).replace(";", ".")
    # A hint written in parentheses keeps them.
    if orig.startswith("(") and orig.endswith(")") and not (new.startswith("(") and new.endswith(")")):
        new = "(" + new.strip("()") + ")"
    for b in BANNED:
        if b.search(new) and not b.search(orig):
            return None, f"banned: {b.pattern.replace(chr(92) + 'b', '')}"
    if len(words(orig)) >= 5 and not (words(orig) & words(new)):
        return None, "misaligned"
    notes = misreads(orig, new)
    if notes:
        return None, "misread: " + ". ".join(n[0].upper() + n[1:] for n in notes)
    swap = pronoun_change(orig, new)
    # The user's rule (2026-10-30): an added he or she for someone the line does not gender becomes they.
    if swap and swap.startswith("pronouns: added ") and not re.search(GENDERED[swap.split()[-1]], PH.sub("", orig).lower()):
        fixed = neutral(new, swap.split()[-1])
        if fixed is not None and not pronoun_change(orig, fixed):
            new, swap = fixed, None
    if swap:
        return None, swap
    want, got = PH.findall(orig), PH.findall(new)
    if sorted(want) != sorted(got):
        return None, "placeholders"
    if nums(orig) != nums(new):
        return None, "numbers: " + " ".join(re.findall(r"\d+", PH.sub("", orig)))
    cap = cap_for(r)
    if boxlen(new) > cap:
        if not r["split"] or cap != 100 or re.search(r"\{#", orig):
            return None, f"over {cap}"
        boxes = split_parts(new, cap)
        if any(boxlen(b) > cap for b in boxes):
            return None, f"over {cap}"
        new = " // ".join(boxes)
    if new == orig:
        return None, "unchanged"
    return new, None


FEEDBACK = {
    "empty": "Give a rewrite of this line.",
    "missing from the answer": "Give a rewrite of this line too.",
    "misaligned": "Rewrite this exact line and keep its meaning.",
    "placeholders": "Keep every {v1}-style token exactly as written, braces included, each one once.",
    "push": "Rewrite this line in new words so it sounds natural. Keep its meaning.",
}


def feedback(reason):
    if reason in FEEDBACK:
        return FEEDBACK[reason]
    if reason.startswith(("misread: ", "redo: ")):
        return reason.split(": ", 1)[1] + ". Rewrite it with that meaning."
    if reason.startswith("banned: "):
        return f"Do not use the word {reason[8:]}."
    if reason.startswith("pronouns: "):
        return ("Keep the pronouns exactly as the original line uses them. Do not change anyone's he, she, it, or they, "
                "and do not add one. Ouro is always they and them.")
    if reason.startswith("review: "):
        return "Problem: " + reason[8:]
    if reason.startswith("numbers: "):
        return f"Keep every number in digits, exactly as written: {reason[9:]}."
    if reason.startswith("over "):
        return f"Keep it under {reason.split()[1]} characters."
    return "Try again."


def specific(reason):
    """A precise instruction for the fourth try."""
    if reason.startswith("misread: "):
        fixes = []
        for part in reason[9:].split(". "):
            m = re.match(r"(\S+) is an ordinary word", part)
            if m:
                fixes.append(f"Write {m.group(1).lower()} in lowercase, as an ordinary word.")
            m = re.match(r"(\S+) is a name", part)
            if m:
                fixes.append(f"Keep {m.group(1)} capitalized, as a name.")
        return " ".join(fixes)
    if reason.startswith("over "):
        return "Use fewer words than the original line."
    if reason.startswith("pronouns: "):
        return "Use the same he, she, it, and they words as the original, for the same people and things."
    if reason == "missing from the answer":
        return "Answer with exactly one line, in the form Speaker: text."
    return ""


SPEAKER_LINE = re.compile(r"^\s*([A-Za-z][A-Za-z .'\-]*?)\s*:\s*(.*)$")


def parse(out, batch):
    """Answer lines matched to batch lines. When the counts and speakers agree they pair in order. Otherwise each
    answer goes to the unmatched original with the same speaker that shares the most words."""
    ans = []
    for line in out.splitlines():
        m = SPEAKER_LINE.match(line.replace("**", ""))
        if m:
            ans.append((m.group(1).strip().upper(), m.group(2)))
    spk = [label(r).upper() for r in batch]
    if len(ans) == len(batch) and all(a[0] == s for a, s in zip(ans, spk)):
        return {batch[k]["id"]: ans[k][1] for k in range(len(batch))}
    got, used = {}, set()
    for a_sp, a_text in ans:
        best, score = None, -1
        for k, r in enumerate(batch):
            if k in used or spk[k] != a_sp:
                continue
            sc = len(words(a_text) & words(r["text"]))
            if sc > score:
                best, score = k, sc
        if best is not None and (score > 0 or len(words(batch[best]["text"])) < 4):
            used.add(best)
            got[batch[best]["id"]] = a_text
    # The model sometimes drops the speaker label, mostly on guide pages. Such answers pair with the lines in order
    # when the counts agree, and the misaligned guard catches a wrong pairing.
    if len(got) < len(batch):
        plain = [l.strip() for l in out.splitlines() if l.strip() and not l.strip().startswith("(")]
        if len(plain) == len(batch):
            for r, line in zip(batch, plain):
                if r["id"] not in got:
                    m = SPEAKER_LINE.match(line.replace("**", ""))
                    got[r["id"]] = m.group(2) if m and m.group(1).strip().upper() == label(r).upper() else line
    return got


def batch_text(batch):
    return "\n".join(f"{label(r)}: {mask(r['text'])}" for r in batch)


class Pass:
    def __init__(self, rows, prompt, state=None):
        self.rows, self.prompt = rows, prompt
        self.by_id = {r["id"]: r for r in rows}
        self.state = {"done": [], "results": {}, "rejected": {}, "failed": [], "swept": [], "pushed": [], "fixed": 0, "attempts": {}}
        if state:
            self.state.update(state)

    def accept(self, batch, got, pushing=False):
        """Keeps clean rewrites and records why the rest were not kept. Returns the lines worth another try."""
        st, again = self.state, []
        for r in batch:
            i = r["id"]
            if i not in got:
                if not pushing:
                    st["rejected"][i] = "missing from the answer"
                    again.append(r)
                continue
            new, why = clean(r, unmask(got[i], r["text"]))
            if new is None:
                if pushing and why == "unchanged":
                    continue
                st["rejected"][i] = why
                st["results"].pop(i, None)
                if why != "unchanged":
                    st["attempts"].setdefault(i, []).append([got[i].translate(QUOTES).strip(), why])
                    again.append(r)
            else:
                st["results"][i] = new
                st["rejected"].pop(i, None)
        return again

    def note_for(self, i, k):
        """The note for try k on line i. Each try asks in a different way."""
        reason = self.state["rejected"].get(i, "missing from the answer")
        base = feedback(reason)
        tries = self.state["attempts"].get(i, [])
        last = tries[-1][0] if tries else ""
        if k == 0 and reason.startswith("review: ") and last:
            return f'Your earlier rewrite was: "{last}". {base} Fix that, and keep the rest of your wording where it was fine.'
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

    def retry(self, items):
        """Sends rejected lines back with notes, up to six tries. From the third try, each line goes alone."""
        swept = set(self.state["swept"])
        for k in range(6):
            if not items:
                break
            swept.update(r["id"] for r in items)
            groups = [[r] for r in items] if k >= 2 else [items]
            left = []
            for g in groups:
                text = "\n".join(f"({self.note_for(r['id'], k)})\n{label(r)}: {mask(r['text'])}" for r in g)
                prompt = (self.prompt + " An earlier rewrite of each line below had a problem. Follow the note in "
                          "parentheses above each line, and do not repeat the notes in your answer.")
                try:
                    out = naturalize(text, prompt=prompt)
                except Exception as e:  # noqa: BLE001
                    print(f"retry: {e}", flush=True)
                    left += g
                    continue
                before = len(self.state["results"])
                left += self.accept(g, parse(out, g))
                self.state["fixed"] += len(self.state["results"]) - before
            items = left
        self.state["swept"] = sorted(swept)

    def push(self, items):
        """Lines the model left unchanged go back once, asking for new words."""
        self.state["pushed"] = sorted(set(self.state["pushed"]) | {r["id"] for r in items})
        text = "\n".join(f"({FEEDBACK['push']})\n{label(r)}: {mask(r['text'])}" for r in items)
        prompt = self.prompt + " Follow the note in parentheses above each line, and do not repeat the notes in your answer."
        out = naturalize(text, prompt=prompt)
        again = self.accept(items, parse(out, items), pushing=True)
        if again:
            self.retry(again)

    def run_batch(self, batch):
        out = None
        for attempt in range(3):
            try:
                out = naturalize(batch_text(batch), prompt=self.prompt)
                break
            except Exception as e:  # noqa: BLE001
                print(f"batch: {e}", flush=True)
                time.sleep(10 * (attempt + 1))
        if out is None:
            return False
        again = self.accept(batch, parse(out, batch))
        if again:
            self.retry(again)
        return True


def main():
    args = sys.argv[1:]
    limit = None
    if "--limit-minutes" in args:
        i = args.index("--limit-minutes")
        limit = float(args[i + 1]) * 60
        del args[i:i + 2]
    sets = ["story", "ui"]
    if "--sets" in args:
        i = args.index("--sets")
        sets = args[i + 1].split(",")
        del args[i:i + 2]
    do_push = "--push" in args
    args = [a for a in args if a != "--push"]
    prompt = args[0] if args else DEFAULT_PROMPT
    if prompt.startswith("@"):
        prompt = open(prompt[1:], encoding="utf-8").read().strip()

    os.makedirs(NAT, exist_ok=True)
    rows = load_rows(sets)
    NAMES.update(build_names(rows))
    batches = make_batches(rows)
    p = Pass(rows, prompt, json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else None)
    st = p.state
    if st.get("prompt") and st["prompt"] != prompt:
        sys.exit(f"{STATE} is from a run with another prompt. Move it aside to start over.")
    st["prompt"], st["sets"] = prompt, sets
    done = set(st["done"])

    # Rewrites kept by an earlier run get every check again, and a flagged one goes back into the retry sweep.
    for i, new in list(st["results"].items()):
        if i in p.by_id:
            ok, why = clean(p.by_id[i], new.replace(" // ", " "))
            if ok is None and why != "unchanged":
                st["results"].pop(i)
                st["rejected"][i] = why
                st["swept"] = [x for x in st["swept"] if x != i]

    # Tries turned down under older rules get checked again. A first try that passes now wins over a later retry,
    # because the retries only exist to get around a guard.
    for i, tries in st["attempts"].items():
        if i not in p.by_id or not tries:
            continue
        for k, (text, _why) in enumerate(tries):
            ok, why = clean(p.by_id[i], text)
            if ok is not None and (k == 0 or i not in st["results"]):
                st["results"][i] = ok
                st["rejected"].pop(i, None)
                break

    start = time.time()
    status = {"batch": None, "since": start, "lines": 0}

    def write_progress(final=False, partial=False):
        lines_done = sum(len(batches[b]) for b in done if b < len(batches))
        elapsed = time.time() - start
        rate = status["lines"] / elapsed if elapsed > 0 and status["lines"] else 0
        eta = (len(rows) - lines_done) / rate if rate else 0
        rej = {}
        for r in st["rejected"].values():
            k = r.split(":")[0]
            rej[k] = rej.get(k, 0) + 1
        done_ids = {r["id"] for b in done if b < len(batches) for r in batches[b]}
        changed = sum(1 for i in st["results"] if i in done_ids)
        text = [
            "Naturalize pass" + (" (stopped early)" if partial else " (finished)" if final else " (running)"),
            f"Prompt: {prompt}",
            f"Sets: {', '.join(sets)}. Batches: {len(done)} of {len(batches)}. Lines: {lines_done} of {len(rows)}.",
            f"Changed: {changed} ({100 * changed / max(1, lines_done):.0f}% of lines done). Kept as they were: {sum(rej.values())} "
            f"({', '.join(f'{k} {v}' for k, v in sorted(rej.items(), key=lambda x: -x[1]))}).",
            f"Fixed on retry: {st['fixed']}. Pushed: {len(st['pushed'])}. Failed batches: {len(st['failed'])}.",
            f"Elapsed this run: {elapsed / 60:.1f} min. Estimated time left: {eta / 60:.0f} min.",
        ]
        if status["batch"] is not None and not final:
            text.append(f"Working on {status['batch']} for {time.time() - status['since']:.0f} s.")
        text.append(f"Stop early: create {STOP}")
        open(PROGRESS, "w", encoding="utf-8").write("\n".join(text) + "\n")

    def save():
        json.dump(st, open(STATE, "w", encoding="utf-8"))
        out = [f"[{i}] {p.by_id[i]['who']} | {t}" for i, t in st["results"].items() if i in p.by_id]
        open(OUT, "w", encoding="utf-8").write("\n".join(out) + "\n")
        review = ["# Rewrites the guards turned down, for review. Each block shows the original and the reason above each",
                  "# attempt. Delete the attempts you do not want, keep at most one per id, then import this file with:",
                  "#   node scripts/lines.mjs import dialogue/naturalize/turned-down.txt", ""]
        for i, tries in st["attempts"].items():
            if i in st["results"] or i not in p.by_id:
                continue
            review.append(f"# original: {p.by_id[i]['text']}")
            for text, why in tries:
                review += [f"# reason: {why}", f"[{i}] {p.by_id[i]['who']} | {text}"]
            review.append("")
        open(REVIEW, "w", encoding="utf-8").write("\n".join(review) + "\n")

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
        status["batch"], status["since"] = f"batch {b + 1}", time.time()
        if not p.run_batch(batch):
            st["failed"].append(b)
        done.add(b)
        st["done"] = sorted(done)
        status["lines"] += len(batch)
        save()
        print(f"batch {b + 1}/{len(batches)} in {time.time() - status['since']:.0f} s", flush=True)

    # Lines the model never answered get one fresh batch each, in story order, before any push.
    if not partial:
        swept_missing = set(st.get("missing_swept", []))
        left = [r for r in rows if st["rejected"].get(r["id"]) == "missing from the answer" and r["id"] not in swept_missing]
        for k in range(0, len(left), BATCH):
            if os.path.exists(STOP) or (limit and time.time() - start > limit):
                partial = True
                break
            batch = left[k:k + BATCH]
            status["batch"], status["since"] = f"missing lines {k + 1} to {k + len(batch)} of {len(left)}", time.time()
            p.run_batch(batch)
            st["missing_swept"] = sorted(swept_missing | {r["id"] for r in left[:k + len(batch)]})
            save()

    if not partial and do_push:
        pushed = set(st["pushed"])
        left = [r for r in rows if st["rejected"].get(r["id"]) == "unchanged" and r["id"] not in pushed]
        for k in range(0, len(left), BATCH):
            if os.path.exists(STOP) or (limit and time.time() - start > limit):
                partial = True
                break
            status["batch"], status["since"] = f"push {k // BATCH + 1}", time.time()
            try:
                p.push(left[k:k + BATCH])
            except Exception as e:  # noqa: BLE001
                print(f"push: {e}", flush=True)
            save()

    stop_beat.set()
    status["batch"] = None
    save()
    write_progress(final=not partial, partial=partial)
    samples = list(st["results"].items())[:: max(1, len(st["results"]) // 25)][:25]
    rep = ["# Naturalize report" + (" (partial)" if partial else ""), "", open(PROGRESS, encoding="utf-8").read(), "## Samples", ""]
    for i, t in samples:
        rep += [f"- `{i}` {p.by_id[i]['who']}", f"  - Before: {p.by_id[i]['text']}", f"  - After: {t}"]
    open(REPORT, "w", encoding="utf-8").write("\n".join(rep) + "\n")
    print("done" + (" (partial)" if partial else ""), flush=True)


if __name__ == "__main__":
    main()
