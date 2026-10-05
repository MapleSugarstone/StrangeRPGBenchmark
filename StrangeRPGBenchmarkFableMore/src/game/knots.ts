/**
 * Knot writing. Every letter is a knot of one to three turns with a lead
 * going left or right. The key ships with the game as key.html, and the same
 * table draws the knots in the game, so a player can read a line by hand.
 *
 * A glyph is written as a short string: each character is a turn.
 * 'o' overhand turn (color a), 'x' crossed turn (color b), '-' a gap of plain line.
 * The lead side is given by the first character: '<' lead left, '>' lead right.
 */
export const KNOT_ALPHABET: Record<string, string> = {
  A: ">o", B: ">oo", C: ">ooo", D: ">x", E: "<o", F: ">xx", G: ">xxx", H: ">ox",
  I: "<x", J: ">xo", K: ">oxo", L: ">xox", M: ">oox", N: "<oo", O: "<ooo", P: ">xoo",
  Q: ">oxx", R: "<ox", S: "<xo", T: "<xx", U: "<xxx", V: ">xxo", W: "<oxo", X: "<xox",
  Y: "<oox", Z: "<xoo", " ": "-", ".": "--", "'": "<x-", ",": "-x",
  "0": ">o-", "1": ">oo-", "2": ">ooo-", "3": ">x-", "4": ">xx-", "5": ">xxx-", "6": ">ox-", "7": ">xo-", "8": "<o-", "9": "<x-",
};

const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(KNOT_ALPHABET).map(([k, v]) => [v, k]));

export function encodeKnots(text: string): string[] {
  return Array.from(text.toUpperCase()).map((ch) => KNOT_ALPHABET[ch] ?? "-");
}

export function decodeKnots(glyphs: string[]): string {
  return glyphs.map((g) => REVERSE[g] ?? "?").join("");
}

/**
 * Each knot glyph as an 8 by 8 cell sprite. The line runs down the middle.
 * Turns are drawn as loops to the lead side, overhand in color a, crossed in color b.
 */
export function knotCells(glyph: string): Uint8Array {
  const c = new Uint8Array(64);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) c[y * 8 + x] = v; };
  for (let y = 0; y < 8; y++) set(3, y, 2);
  if (glyph === "-") return c;
  if (glyph === "--") { set(3, 3, 0); set(3, 4, 0); return c; }
  const lead = glyph[0] === "<" ? -1 : glyph[0] === ">" ? 1 : 0;
  const turns = glyph.replace(/[<>]/g, "");
  let y = 1;
  for (const t of turns) {
    if (t === "-") { y += 2; continue; }
    const v = t === "o" ? 2 : 3;
    if (lead !== 0) {
      set(3 + lead, y, v);
      set(3 + lead * 2, y, v);
      set(3 + lead * 2, y + 1, v);
      set(3 + lead, y + 1, t === "x" ? 1 : v);
    } else {
      set(2, y, v); set(4, y, v);
    }
    y += 2;
  }
  return c;
}

/** The hidden messages in the game, by id. Only some are read aloud. */
export const KNOT_MESSAGES: Record<string, string> = {
  m1: "HEM 212. TUNER. NO BITE IN 20 YEARS.",
  m1b: "CUT IT. SEE IF IT RUNS.",
  m2: "IT WILL FIND THE OLD BAIT",
  m3: "IT WILL CROSS THE NEST",
  m4: "IT WILL TAKE THE RETURNED ONE",
  m5: "IT WILL GO DOWN",
  m6: "IT WILL CLIMB",
  m7: "IT WILL COME TO THE DECK",
  m8: "FATHOM BURL DULCET LISSOM HALE GUST SUMP BOB",
  m9: "",
  secret_burl: "THREE HOOKS ONE KNOT",
  secret_title: "EVERYTHING IS BAIT",
  secret_grip: "NOBODY IS FISHING",
  password: "IT WILL CHOOSE",
};
