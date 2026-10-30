# A compact voice guide for Naturalizer prompts, which are capped at 4000 characters. It keeps the world, the
# rules, and voice notes for only the speakers in the batch.
import re

WORLD = (
    "Fathom is a neon city forty meters below the sea, behind a seawall called the Wall. The Deeps are canals, "
    "stilt houses, and markets. The Stair climbs the inside of the Wall. The Brim is the top, where the rich live. "
    "The Board owns the Wall, the pumps, the blood trade, and the color red. One person in ten thousand is born a "
    "witch, and witch blood wakes things that are not alive, with the feeling the witch had while bleeding. Giant "
    "woken pumps called Bailers walk the canals and bail water over the Wall. The hero is a Deeps runner whose "
    "neural port woke up and talks. Slang used without explaining: red (witch blood), Line (a blood product), cut "
    "(diluted), wake and woken, hush, gilt (money), port, chrome, arrears (leased chrome switched off), bells "
    "(hours), dry (rich), wet (poor), the Census (the Board's blood test)."
)
RULES = (
    "Rules: most lines under 60 characters, never over 100. No em dashes, no semicolons. Keep {name} and {port} "
    "exactly. Keep every fact a line states. People state strange things plainly. No jokes with setups, no "
    "narration, no labeled feelings, no wise summary lines. Keep each speaker's quirks below."
)
VOICES = {
    "HERO CHOICE": "the hero's own words, short and plain, a Deeps runner",
    "PORT": "a newborn mind in the hero's head. Early single words and pieces of things it heard, later short sentences and questions",
    "Courtesy": "a riot robot that only speaks in public announcement phrases, in capitals, recombined",
    "Sallis": "commands and statements, never a question, short. Copy. No.",
    "Quaye": "an old hacker who answers with numbers, counts, times, prices. Calls the hero kid",
    "Ambrose": "an ex-fighter, formal and grand with rare old words. Plain short words when hurt or scared",
    "Tova": "a young witch, casual and fast, fragments, often all lowercase",
    "Ignace": "a fake deacon, florid holy language when performing, plain and brief when honest",
    "Opal": "a fixer, casual, eats while talking, calls people sweet",
    "Tilly": "an old woken tram, repeats the last word of a question before answering, slow and kind",
    "Mother Sieve": "a gang boss, gentle medical words, serves tea, menacing",
    "Dowser": "a Board hunter, polite and professional, calls woken things it and people friend",
    "Teun": "the Board's chairman, never says I, says the Board or this office",
    "Marit": "forty years in a vault, long run-on sentences that stop when she tires, then a short one",
    "CHOIR": "monks who speak as a group, several short lines that disagree a little",
    "SYSTEM": "short game text",
    "DETAIL": "what the player sees when inspecting a thing, plain description",
    "LORE": "a journal entry about the world, plain and specific",
}
SKILLS = {"NOTICE", "TECH", "HACK", "TALK", "SNEAK", "ATHLETICS", "SHOOT", "STRIKE"}


def guide(speakers, extra=""):
    """The prompt for one batch: world, rules, voices of the speakers present, then the format instruction."""
    voices = []
    for s in sorted(set(speakers)):
        key = s.lstrip("!").strip()
        if key in VOICES:
            voices.append(f"- {key}: {VOICES[key]}")
        elif key in SKILLS:
            voices.append(f"- {key}: one of the hero's skills noticing something, a short observation from that angle")
    if not any(v.startswith("- Everyone") for v in voices):
        voices.append("- Everyone else: casual ordinary people")
    fmt = ("Rewrite the text after the | on each line below so it sounds natural and spoken. Return every line, "
           "in the same order and the same format: [id] SPEAKER | text. Keep each [id] and speaker exactly. "
           "Return only the lines." + (" " + extra if extra else ""))
    text = "\n\n".join([WORLD, RULES, "Who talks how:\n" + "\n".join(voices), fmt])
    return text[:3990]
