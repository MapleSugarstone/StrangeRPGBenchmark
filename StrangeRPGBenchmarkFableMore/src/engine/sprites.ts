import { Rng, hash } from "./rng";

/**
 * Every sprite is an 8x8 grid generated from a spec. Cell values:
 * 0 transparent, 1 black, 2 color a, 3 color b.
 */
export type SpriteKind = "humanoid" | "creature" | "knot" | "thing" | "wind" | "item" | "tile" | "shape" | "hand";

export interface SpriteSpec {
  kind: SpriteKind;
  seed: string;
  variant?: string;
}

export type Cells = Uint8Array;

const cache = new Map<string, Cells>();

export function getSprite(kind: SpriteKind, seed: string, variant = ""): Cells {
  const key = `${kind}|${seed}|${variant}`;
  let c = cache.get(key);
  if (!c) {
    c = generate({ kind, seed, variant });
    cache.set(key, c);
  }
  return c;
}

export function generate(spec: SpriteSpec): Cells {
  const rng = new Rng(hash(`${spec.kind}:${spec.seed}:${spec.variant ?? ""}`));
  switch (spec.kind) {
    case "humanoid": return humanoid(rng, spec.variant ?? "");
    case "creature": return creature(rng, spec.variant ?? "");
    case "knot": return knot(rng, spec.variant ?? "");
    case "thing": return thing(rng, spec.variant ?? "");
    case "wind": return wind(rng, spec.variant ?? "");
    case "item": return item(rng, spec.variant ?? "");
    case "tile": return tile(rng, spec.variant ?? "");
    case "shape": return shape(spec.variant ?? "");
    case "hand": return hand(spec.variant ?? "");
  }
}

const strides = new WeakMap<Cells, [Cells, Cells]>();

/**
 * A walking frame made from a standing sprite: the bottom two rows split at the middle,
 * one half steps outward and the other foot lifts. Side 0 steps left, side 1 steps right.
 */
export function strideFrame(c: Cells, side: 0 | 1): Cells {
  let pair = strides.get(c);
  if (!pair) {
    pair = [stride(c, 0), stride(c, 1)];
    strides.set(c, pair);
  }
  return pair[side];
}

function stride(c: Cells, side: 0 | 1): Cells {
  const out = Uint8Array.from(c);
  for (const y of [6, 7]) {
    for (let x = 0; x < 8; x++) out[y * 8 + x] = 0;
    for (let x = 0; x < 8; x++) {
      const v = c[y * 8 + x];
      if (!v) continue;
      const stepping = side === 0 ? x < 4 : x >= 4;
      if (stepping) set(out, x + (side === 0 ? -1 : 1), y, v);
      else if (y === 6) set(out, x, y, v);
    }
  }
  return out;
}

const at = (c: Cells, x: number, y: number) => (x < 0 || y < 0 || x > 7 || y > 7 ? 0 : c[y * 8 + x]);
const set = (c: Cells, x: number, y: number, v: number) => {
  if (x >= 0 && y >= 0 && x < 8 && y < 8) c[y * 8 + x] = v;
};

/** Add a black outline around colored cells where there is room. */
function outline(c: Cells): void {
  const src = Uint8Array.from(c);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (src[y * 8 + x] !== 0) continue;
      const n = at(src, x - 1, y) > 1 || at(src, x + 1, y) > 1 || at(src, x, y - 1) > 1 || at(src, x, y + 1) > 1;
      if (n) c[y * 8 + x] = 1;
    }
  }
}

function mirror(c: Cells): void {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) c[y * 8 + 7 - x] = c[y * 8 + x];
}

/** Parse rows of characters: '.' empty, '#' black, 'a' color a, 'b' color b. */
export function fromRows(rows: string[]): Cells {
  const c = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    const r = rows[y] ?? "........";
    for (let x = 0; x < 8; x++) {
      const ch = r[x] ?? ".";
      c[y * 8 + x] = ch === "#" ? 1 : ch === "a" ? 2 : ch === "b" ? 3 : 0;
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// People. Variants: "" (any), "tall", "small", "frame" (rigor frame), "robe",
// "hat", "slack" (a loose line coiled at the feet).

function humanoid(rng: Rng, variant: string): Cells {
  const c = new Uint8Array(64);
  const small = variant === "small";
  const tall = variant === "tall";
  const headY = small ? 2 : tall ? 0 : 1;
  const headW = rng.chance(0.6) ? 2 : 3; // half width incl. center
  // Head
  for (let y = headY; y < headY + (small ? 2 : 3); y++) {
    for (let x = 4 - (headW - 1); x < 4 + headW - (headW === 2 ? 0 : 1); x++) set(c, x, y, 2);
  }
  // Face: two eyes of black or color b
  const eyeY = headY + 1;
  const eyeV = rng.chance(0.5) ? 1 : 3;
  set(c, 3, eyeY, eyeV);
  set(c, 4, eyeY, eyeV);
  // Hat with a slot for the line
  if (variant === "hat" || (variant === "" && rng.chance(0.4))) {
    set(c, 2, headY, 3); set(c, 3, headY, 3); set(c, 4, headY, 3); set(c, 5, headY, 3);
    if (headY > 0) { set(c, 3, headY - 1, 3); set(c, 4, headY - 1, 3); }
  }
  // Body
  const bodyY = headY + (small ? 2 : 3);
  const bodyH = small ? 2 : tall ? 3 : 3;
  const bodyV = variant === "robe" ? 3 : rng.chance(0.5) ? 3 : 2;
  for (let y = bodyY; y < bodyY + bodyH && y < 8; y++) {
    for (let x = 3; x <= 4; x++) set(c, x, y, bodyV);
    if (y === bodyY || variant === "robe") { set(c, 2, y, bodyV); set(c, 5, y, bodyV); }
  }
  // Arms
  const armV = bodyV === 3 ? 2 : 3;
  set(c, 2, bodyY + 1, armV);
  set(c, 5, bodyY + 1, armV);
  if (variant === "frame") {
    // Rigor frame: rigid bars outside the body
    for (let y = headY; y < 8; y++) { set(c, 1, y, 3); set(c, 6, y, 3); }
    set(c, 2, bodyY, 3); set(c, 5, bodyY, 3);
  }
  // Legs
  const legY = bodyY + bodyH;
  for (let y = legY; y < 8; y++) {
    set(c, 3, y, 2);
    set(c, 4, y, 2);
  }
  if (variant === "robe") for (let y = legY; y < 8; y++) { set(c, 2, y, 3); set(c, 5, y, 3); set(c, 3, y, 3); set(c, 4, y, 3); }
  // A tool or detail on one side so the figure reads as a person, not a symbol
  if (rng.chance(0.5)) set(c, rng.chance(0.5) ? 1 : 6, bodyY + 1, 3);
  if (variant === "slack") {
    // Coil of line at the feet
    set(c, 0, 7, 3); set(c, 1, 7, 3); set(c, 6, 7, 3); set(c, 7, 7, 3); set(c, 7, 6, 3);
  }
  // Separate the legs with a black pixel so they do not read as a block
  set(c, 4, 7, 1);
  // Shading: the right side of the body falls into the other color
  for (let y = bodyY; y < legY && y < 8; y++) if (at(c, 5, y) === bodyV) set(c, 5, y, armV);
  outline(c);
  return c;
}

// ---------------------------------------------------------------------------
// Creatures. Variants: "" (blob), "beast" (four legs), "flyer" (wings), "tall".

function creature(rng: Rng, variant: string): Cells {
  const c = new Uint8Array(64);
  const half = new Uint8Array(64);
  const w = rng.range(2, 4); // half width
  const top = rng.range(1, 3);
  const bottom = variant === "tall" ? 7 : rng.range(5, 7);
  for (let y = top; y <= bottom; y++) {
    const bulge = Math.sin(((y - top) / Math.max(1, bottom - top)) * Math.PI);
    const ww = Math.max(1, Math.round(w * (0.5 + 0.5 * bulge)));
    for (let x = 4 - ww; x < 4; x++) half[y * 8 + x] = 2;
  }
  // Markings in color b
  const marks = rng.range(1, 4);
  for (let i = 0; i < marks; i++) {
    const x = rng.range(1, 3), y = rng.range(top, bottom);
    if (half[y * 8 + x] === 2) half[y * 8 + x] = 3;
  }
  // Eye
  const eyeY = top + 1;
  half[eyeY * 8 + (rng.chance(0.5) ? 2 : 3)] = 1;
  if (variant === "beast") {
    for (const x of [1, 3]) { half[7 * 8 + x] = 2; half[6 * 8 + x] = 2; }
  }
  if (variant === "flyer") {
    const wy = rng.range(2, 4);
    half[wy * 8 + 0] = 3; half[wy * 8 + 1] = 3; half[(wy - 1) * 8 + 0] = 3;
  }
  if (rng.chance(0.4)) {
    // Spikes or antennae
    half[(top - 1) * 8 + rng.range(1, 3)] = 3;
  }
  c.set(half);
  mirror(c);
  // Mouth: one or two black pixels under the eyes, asymmetric sometimes
  if (rng.chance(0.6)) set(c, rng.chance(0.5) ? 3 : 4, eyeY + 2, 1);
  outline(c);
  return c;
}

// ---------------------------------------------------------------------------
// Knots: tangles of line with loose ends. Variants: "" or "big".

function knot(rng: Rng, variant: string): Cells {
  const c = new Uint8Array(64);
  const cx = 3.5, cy = variant === "big" ? 3.5 : 4;
  const r = variant === "big" ? 3 : 2.3;
  // Loops drawn as rings of a and b
  for (let i = 0; i < 3; i++) {
    const ox = rng.range(-1, 1), oy = rng.range(-1, 1);
    const rr = r - i * 0.6;
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      const x = Math.round(cx + ox + Math.cos(t) * rr);
      const y = Math.round(cy + oy + Math.sin(t) * rr * 0.8);
      set(c, x, y, i % 2 === 0 ? 2 : 3);
    }
  }
  // Loose ends trailing
  const ends = rng.range(2, 3);
  for (let i = 0; i < ends; i++) {
    let x = rng.range(1, 6), y = 6;
    for (let k = 0; k < 2; k++) { set(c, x, y, 3); x += rng.range(-1, 1); y++; }
  }
  // Eyes: knots that are people have two
  set(c, 3, Math.round(cy) - 1, 1);
  set(c, 4, Math.round(cy) - 1, 1);
  outline(c);
  return c;
}

// ---------------------------------------------------------------------------
// Things: machines, frames, the Grip's hands. Variants: "" boxy, "pillar", "hand".

function thing(rng: Rng, variant: string): Cells {
  const c = new Uint8Array(64);
  if (variant === "hand") {
    // A hand reaching down: palm with fingers at the bottom
    for (let y = 0; y < 4; y++) for (let x = 2; x < 6; x++) set(c, x, y, 2);
    for (let x = 1; x < 7; x++) if (x !== 3 && x !== 5) for (let y = 4; y < 7; y++) set(c, x, y, 2);
    set(c, 3, 2, 3); set(c, 4, 2, 3);
    outline(c);
    return c;
  }
  if (variant === "pillar") {
    for (let y = 0; y < 8; y++) { set(c, 3, y, 2); set(c, 4, y, 2); }
    for (let y = 1; y < 8; y += 2) { set(c, 2, y, 3); set(c, 5, y, 3); }
    outline(c);
    return c;
  }
  const w = rng.range(2, 3), top = rng.range(1, 2), bottom = rng.range(5, 7);
  for (let y = top; y <= bottom; y++) for (let x = 4 - w; x < 4 + w; x++) set(c, x, y, 2);
  // Lights and panels
  const n = rng.range(2, 4);
  for (let i = 0; i < n; i++) set(c, rng.range(4 - w, 3 + w), rng.range(top, bottom), 3);
  // Eye-like lens
  set(c, 3, top + 1, 1); set(c, 4, top + 1, 1);
  // Legs or a base
  if (rng.chance(0.5)) { set(c, 4 - w, bottom + 1, 2); set(c, 3 + w, bottom + 1, 2); }
  else for (let x = 4 - w - 1; x <= 4 + w; x++) set(c, x, bottom + 1, 3);
  outline(c);
  return c;
}

// ---------------------------------------------------------------------------
// Winds: spirals and streaks with no outline, so they look like air.

function wind(rng: Rng, variant: string): Cells {
  const c = new Uint8Array(64);
  const turns = rng.range(9, 14);
  let x = 3.5, y = 3.5;
  for (let i = 0; i < turns; i++) {
    const t = i * 0.9;
    const r = 0.6 + i * 0.28;
    x = 3.5 + Math.cos(t) * r;
    y = 3.5 + Math.sin(t) * r * 0.7;
    set(c, Math.round(x), Math.round(y), i % 3 === 0 ? 3 : 2);
  }
  // Two eyes if it is a person-wind
  if (variant === "face") { set(c, 3, 3, 1); set(c, 5, 3, 1); }
  return c;
}

// ---------------------------------------------------------------------------
// Items. Variants name the item type.

function item(rng: Rng, variant: string): Cells {
  switch (variant) {
    case "slug": return fromRows(["........", "........", "..####..", ".#aaaa#.", ".#abba#.", ".#aaaa#.", "..####..", "........"]);
    case "flask": return fromRows(["...##...", "...#b#..", "...#b#..", "..#aaa#.", ".#abbba#", ".#abbba#", ".#aaaaa#", "..#####."]);
    case "knot": return fromRows(["........", "..a..b..", ".a.ab.b.", "..abba..", "..baab..", ".b.ba.a.", "..b..a..", "........"]);
    case "glove": return fromRows(["........", ".a.a.a..", ".aaaaa..", ".aaaaab.", ".aaaaa..", "..aaa...", "..bbb...", "........"]);
    case "boot": return fromRows(["........", "...aa...", "...aa...", "...aa...", "...aaa..", "..aaaaa.", ".bbbbbb.", "........"]);
    case "line": return fromRows(["...a....", "...a....", "...a....", "..aba...", ".a...a..", ".a...a..", "..aaa...", "........"]);
    case "key": return fromRows(["........", "..aaa...", ".a...a..", ".a...a..", "..aaa...", "...b....", "...bb...", "...b...."]);
    case "book": return fromRows(["........", ".aaaaaa.", ".abbbba.", ".ababba.", ".abbbba.", ".abbbba.", ".aaaaaa.", "........"]);
    case "weight": return fromRows(["...a....", "...a....", "..aaa...", ".abbba..", ".abbba..", ".abbba..", "..aaa...", "........"]);
    case "bread": return fromRows(["........", "........", "..aaaa..", ".abbbba.", ".aaaaaa.", "..aaaa..", "........", "........"]);
    case "chest": return fromRows(["........", ".aaaaaa.", ".abbbba.", ".aaaaaa.", ".aabbaa.", ".aaaaaa.", ".aaaaaa.", "........"]);
    case "star": return fromRows(["...a....", "...a....", ".aabaa..", "..aba...", "..a.a...", ".a...a..", "........", "........"]);
    case "letter": return fromRows(["........", ".aaaaaa.", ".ab..ba.", ".a.bb.a.", ".a....a.", ".aaaaaa.", "........", "........"]);
    case "gear": return fromRows(["...a....", ".a.a.a..", "..aaa...", "aaabaaa.", "..aaa...", ".a.a.a..", "...a....", "........"]);
    case "bell": return fromRows(["...a....", "..aaa...", "..aaa...", ".aaaaa..", ".abbba..", "aaaaaaa.", "...b....", "........"]);
    default: {
      const c = new Uint8Array(64);
      for (let i = 0; i < 10; i++) set(c, rng.range(2, 5), rng.range(2, 5), rng.chance(0.5) ? 2 : 3);
      outline(c);
      return c;
    }
  }
}

// ---------------------------------------------------------------------------
// Tiles. The variant names the terrain. Seeds give texture variation.

function tile(rng: Rng, variant: string): Cells {
  const c = new Uint8Array(64);
  const fill = (v: number) => c.fill(v);
  const speck = (n: number, v: number) => { for (let i = 0; i < n; i++) c[rng.int(64)] = v; };
  switch (variant) {
    case "grass": fill(2); speck(5, 3); speck(2, 1); break;
    case "dirt": fill(2); speck(4, 3); break;
    case "sand": fill(2); speck(3, 3); break;
    case "stone": fill(2); for (let x = 0; x < 8; x++) { c[3 * 8 + x] = 3; c[7 * 8 + x] = 3; } c[0 * 8 + 3] = 3; c[1 * 8 + 3] = 3; c[2 * 8 + 3] = 3; c[4 * 8 + 6] = 3; c[5 * 8 + 6] = 3; c[6 * 8 + 6] = 3; break;
    case "floor": fill(2); for (let x = 0; x < 8; x++) c[7 * 8 + x] = 3; c[3 * 8 + 7] = 3; break;
    case "water": fill(2); for (let x = 0; x < 8; x++) { if ((x + rng.int(2)) % 3 === 0) c[2 * 8 + x] = 3; if ((x + 1) % 3 === 0) c[6 * 8 + x] = 3; } break;
    case "wall": fill(2); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (y % 4 === 3 || (x + (y < 4 ? 0 : 4)) % 8 === 7) c[y * 8 + x] = 1; speck(3, 3); break;
    case "slat": // slatted roof: vertical slats with gaps for lines
      fill(1); for (let x = 0; x < 8; x += 2) for (let y = 0; y < 8; y++) c[y * 8 + x] = (y === 0 || y === 7) ? 3 : 2; break;
    case "roofedge": fill(2); for (let x = 0; x < 8; x++) c[0 * 8 + x] = 3; for (let x = 0; x < 8; x += 2) for (let y = 1; y < 8; y++) c[y * 8 + x] = 1; break;
    case "cliff": fill(2); for (let x = 0; x < 8; x++) { c[0 * 8 + x] = 3; c[1 * 8 + x] = 3; } speck(4, 1); for (let x = 1; x < 8; x += 3) { c[4 * 8 + x] = 1; c[5 * 8 + x] = 1; } break;
    case "void": fill(1); speck(2, 3); break;
    case "cave": fill(2); speck(6, 1); speck(2, 3); break;
    case "bridge": fill(2); for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x++) c[y * 8 + x] = 3; c[3 * 8 + 0] = 1; c[3 * 8 + 7] = 1; break;
    case "door": fill(2); for (let y = 1; y < 8; y++) for (let x = 2; x < 6; x++) c[y * 8 + x] = 1; c[4 * 8 + 4] = 3; break;
    case "stairs": fill(2); for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x++) c[y * 8 + x] = 1; break;
    case "tree": fill(0); for (let y = 0; y < 6; y++) for (let x = 1; x < 7; x++) if (!((y === 0 || y === 5) && (x === 1 || x === 6))) c[y * 8 + x] = 2; speck(4, 3); c[6 * 8 + 3] = 1; c[6 * 8 + 4] = 1; c[7 * 8 + 3] = 1; c[7 * 8 + 4] = 1; break;
    case "bush": fill(0); for (let y = 2; y < 8; y++) for (let x = 1; x < 7; x++) if (!((y === 2 || y === 7) && (x === 1 || x === 6))) c[y * 8 + x] = 2; speck(3, 3); break;
    case "rock": fill(0); for (let y = 2; y < 7; y++) for (let x = 1; x < 7; x++) if (!((y === 2 || y === 6) && (x < 2 || x > 5))) c[y * 8 + x] = 2; c[3 * 8 + 2] = 3; c[4 * 8 + 5] = 1; outline(c); break;
    case "fence": fill(0); for (let x = 0; x < 8; x++) { c[3 * 8 + x] = 2; c[5 * 8 + x] = 2; } for (let x = 1; x < 8; x += 3) for (let y = 2; y < 8; y++) c[y * 8 + x] = 3; break;
    case "table": fill(0); for (let x = 0; x < 8; x++) { c[2 * 8 + x] = 2; c[3 * 8 + x] = 3; } for (let y = 4; y < 8; y++) { c[y * 8 + 1] = 2; c[y * 8 + 6] = 2; } break;
    case "bed": fill(0); for (let y = 1; y < 8; y++) for (let x = 1; x < 7; x++) c[y * 8 + x] = 2; for (let x = 1; x < 7; x++) c[2 * 8 + x] = 3; c[3 * 8 + 2] = 3; c[3 * 8 + 3] = 3; outline(c); break;
    case "counter": fill(0); for (let y = 2; y < 8; y++) for (let x = 0; x < 8; x++) c[y * 8 + x] = y === 2 ? 3 : 2; break;
    case "sign": fill(0); for (let y = 1; y < 5; y++) for (let x = 1; x < 7; x++) c[y * 8 + x] = 2; c[2 * 8 + 2] = 3; c[2 * 8 + 4] = 3; c[3 * 8 + 3] = 3; c[5 * 8 + 3] = 1; c[6 * 8 + 3] = 1; c[7 * 8 + 3] = 1; c[5 * 8 + 4] = 1; c[6 * 8 + 4] = 1; c[7 * 8 + 4] = 1; break;
    case "pillar": fill(0); for (let y = 0; y < 8; y++) { c[y * 8 + 3] = 2; c[y * 8 + 4] = 2; } for (let y = 1; y < 8; y += 3) { c[y * 8 + 2] = 3; c[y * 8 + 5] = 3; } break;
    case "lineground": // the fallen line lying across the ground
      fill(0); { let x = 0; for (let y = 0; y < 8; y++) { c[y * 8 + 3] = 3; } } break;
    case "lineturn": fill(0); for (let x = 3; x < 8; x++) c[3 * 8 + x] = 3; for (let y = 3; y < 8; y++) c[y * 8 + 3] = 3; break;
    case "lineh": fill(0); for (let x = 0; x < 8; x++) c[3 * 8 + x] = 3; break;
    case "coil": fill(0); for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; set(c, Math.round(3.5 + Math.cos(t) * 2.5), Math.round(4 + Math.sin(t) * 1.8), 3); } set(c, 3, 4, 3); set(c, 4, 4, 2); break;
    case "net": fill(0); for (let y = 0; y < 8; y += 3) for (let x = 0; x < 8; x++) c[y * 8 + x] = 2; for (let x = 0; x < 8; x += 3) for (let y = 0; y < 8; y++) c[y * 8 + x] = 2; speck(2, 3); break;
    case "frost": fill(2); speck(6, 3); speck(2, 1); break;
    case "lattice": fill(1); for (let i = 0; i < 8; i++) { c[i * 8 + i] = 2; c[i * 8 + 7 - i] = 2; } c[3 * 8 + 3] = 3; c[4 * 8 + 4] = 3; break;
    case "glass": fill(2); speck(3, 3); c[1 * 8 + 1] = 3; c[2 * 8 + 2] = 3; break;
    case "cable": fill(0); for (let y = 0; y < 8; y++) { c[y * 8 + 2] = 2; c[y * 8 + 3] = 3; c[y * 8 + 4] = 3; c[y * 8 + 5] = 2; } break;
    case "machine": fill(2); c[1 * 8 + 1] = 3; c[1 * 8 + 6] = 3; c[6 * 8 + 1] = 3; c[6 * 8 + 6] = 3; for (let x = 2; x < 6; x++) c[3 * 8 + x] = 1; c[4 * 8 + 3] = 1; c[4 * 8 + 4] = 1; break;
    case "well": fill(0); for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) c[y * 8 + x] = (y === 1 || y === 6 || x === 1 || x === 6) ? 2 : 1; c[3 * 8 + 3] = 3; break;
    case "save": fill(0); for (let y = 1; y < 7; y++) for (let x = 2; x < 6; x++) c[y * 8 + x] = 2; c[2 * 8 + 3] = 3; c[3 * 8 + 4] = 3; c[4 * 8 + 3] = 3; c[7 * 8 + 3] = 1; c[7 * 8 + 4] = 1; break;
    case "flower": fill(2); speck(4, 3); c[2 * 8 + 2] = 3; c[5 * 8 + 5] = 3; c[1 * 8 + 6] = 1; break;
    case "pool": fill(2); speck(3, 3); break;
    case "shelf": fill(0); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c[y * 8 + x] = (y % 3 === 0) ? 2 : (x % 2 === 0 ? 3 : 1); break;
    case "spindle": fill(0); for (let y = 0; y < 8; y++) { c[y * 8 + 3] = 2; c[y * 8 + 4] = 2; } for (let y = 0; y < 8; y += 2) { c[y * 8 + 2] = 3; c[y * 8 + 5] = 3; } break;
    // The sky: the underside of the Hull. Ribs, and a drip now and then.
    case "hull": fill(1); for (let x = 0; x < 8; x++) { c[1 * 8 + x] = 2; c[5 * 8 + x] = 2; } c[2 * 8 + rng.int(8)] = 3; if (rng.chance(0.3)) c[6 * 8 + rng.int(8)] = 3; break;
    case "hullrib": fill(1); for (let y = 0; y < 8; y++) c[y * 8 + 3] = 2; for (let y = 0; y < 8; y += 3) c[y * 8 + 4] = 3; break;
    // Dithered ground: two colors in a checker with specks of texture
    case "grassd": for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c[y * 8 + x] = ((x + y) & 1) === 0 ? 2 : 3; speck(3, 1); break;
    case "sandd": for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c[y * 8 + x] = ((x + (y >> 1)) & 1) === 0 ? 2 : 3; speck(2, 1); break;
    case "waterd": for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c[y * 8 + x] = (y & 1) === 0 ? 2 : (((x + y) & 1) === 0 ? 2 : 3); c[(rng.int(8)) * 8 + rng.int(8)] = 1; break;
    case "crack": fill(2); { let x = rng.range(1, 6); for (let y = 0; y < 8; y++) { c[y * 8 + x] = 1; x += rng.range(-1, 1); x = Math.max(0, Math.min(7, x)); } } speck(2, 3); break;
    case "scrap": fill(2); speck(5, 3); speck(3, 1); break;
    case "deck": for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c[y * 8 + x] = ((x + y) & 1) === 0 ? 2 : 3; c[rng.int(8)] = 1; speck(2, 1); break;
    case "rod": fill(0); for (let y = 0; y < 8; y++) c[y * 8 + 4] = 2; c[0 * 8 + 4] = 3; c[1 * 8 + 5] = 3; c[7 * 8 + 3] = 3; c[7 * 8 + 5] = 3; break;
    case "chair": fill(0); for (let y = 0; y < 8; y++) { c[y * 8 + 1] = 2; c[y * 8 + 6] = 2; } for (let x = 1; x < 7; x++) { c[0 * 8 + x] = 2; c[4 * 8 + x] = 3; } break;
    case "hang": fill(1); for (let y = 0; y < 8; y++) c[y * 8 + 2] = 2; for (let y = 4; y < 8; y++) { c[y * 8 + 1] = 3; c[y * 8 + 2] = 3; c[y * 8 + 3] = 3; } c[5 * 8 + 6] = 2; c[6 * 8 + 6] = 2; break;
    case "plank": fill(2); for (let x = 0; x < 8; x++) c[3 * 8 + x] = 3; c[0 * 8 + 5] = 3; c[1 * 8 + 5] = 3; c[2 * 8 + 5] = 3; c[5 * 8 + 1] = 3; c[6 * 8 + 1] = 3; break;
    case "bones": fill(2); c[2 * 8 + 2] = 3; c[2 * 8 + 3] = 3; c[3 * 8 + 1] = 3; c[5 * 8 + 5] = 3; c[5 * 8 + 6] = 3; c[6 * 8 + 4] = 3; break;
    default: fill(2); speck(4, 3);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Large sprites: 16 by 16, for bosses. Same three colors, one pixel grid.

const largeCache = new Map<string, Cells>();

export function getLarge(kind: SpriteKind, seed: string, variant = ""): Cells {
  const key = `${kind}|${seed}|${variant}`;
  let c = largeCache.get(key);
  if (!c) {
    c = generateLarge({ kind, seed, variant });
    largeCache.set(key, c);
  }
  return c;
}

export function generateLarge(spec: SpriteSpec): Cells {
  const rng = new Rng(hash(`L:${spec.kind}:${spec.seed}:${spec.variant ?? ""}`));
  const N = 16;
  const c = new Uint8Array(N * N);
  const setN = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < N && y < N) c[y * N + x] = v; };
  const atN = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : c[y * N + x]);
  if (spec.kind === "thing" && spec.variant === "hand") {
    // A hand reaching down: wrist at the top, fingers at the bottom, knuckle shading
    for (let y = 0; y < 6; y++) for (let x = 5; x < 11; x++) setN(x, y, 2);
    for (let y = 5; y < 10; y++) for (let x = 3; x < 13; x++) setN(x, y, 2);
    for (const fx of [3, 5, 7, 9, 11]) for (let y = 9; y < 15; y++) { setN(fx, y, 2); if (fx + 1 < 13) setN(fx + 1, y, 2); }
    for (const fx of [4, 6, 8, 10, 12]) setN(fx, 14, 0), setN(fx, 13, 1);
    for (let x = 4; x < 12; x += 2) setN(x, 7, 3);
    setN(7, 3, 3); setN(8, 3, 3);
  } else if (spec.kind === "thing") {
    const w = rng.range(5, 7), top = rng.range(1, 3), bottom = rng.range(12, 14);
    for (let y = top; y <= bottom; y++) for (let x = 8 - w; x < 8 + w; x++) setN(x, y, 2);
    for (let i = 0; i < rng.range(5, 9); i++) setN(rng.range(8 - w, 7 + w), rng.range(top, bottom), 3);
    for (let x = 8 - w; x < 8 + w; x += 3) setN(x, top + 2, 1);
    setN(6, top + 3, 1); setN(7, top + 3, 1); setN(8, top + 3, 1); setN(9, top + 3, 1);
    for (let x = 8 - w - 1; x <= 8 + w; x++) setN(x, bottom + 1, 3);
    if (spec.variant === "pillar") { for (let y = 0; y < N; y++) { setN(6, y, 2); setN(9, y, 2); setN(7, y, 3); setN(8, y, 3); } }
  } else if (spec.kind === "knot") {
    for (let i = 0; i < 5; i++) {
      const ox = rng.range(-2, 2), oy = rng.range(-2, 2), rr = 5.5 - i * 0.9;
      for (let a = 0; a < 48; a++) {
        const t = (a / 48) * Math.PI * 2;
        setN(Math.round(7.5 + ox + Math.cos(t) * rr), Math.round(8 + oy + Math.sin(t) * rr * 0.8), i % 2 === 0 ? 2 : 3);
      }
    }
    for (let i = 0; i < 4; i++) { let x = rng.range(2, 13), y = 13; for (let k = 0; k < 3; k++) { setN(x, y, 3); x += rng.range(-1, 1); y++; } }
    setN(6, 6, 1); setN(9, 6, 1);
  } else if (spec.kind === "wind") {
    let x = 8, y = 8;
    for (let i = 0; i < 40; i++) { const t = i * 0.55, r = 0.8 + i * 0.17; x = 8 + Math.cos(t) * r; y = 8 + Math.sin(t) * r * 0.75; setN(Math.round(x), Math.round(y), i % 3 === 0 ? 3 : 2); }
    setN(6, 7, 1); setN(10, 7, 1);
    return c;
  } else {
    // Creature or humanoid: a symmetric body with a bulge profile, limbs, markings and a face
    const half = new Uint8Array(N * N);
    const top = rng.range(1, 3), bottom = spec.variant === "tall" ? 15 : rng.range(11, 14);
    const w = rng.range(4, 7);
    for (let y = top; y <= bottom; y++) {
      const bulge = Math.sin(((y - top) / Math.max(1, bottom - top)) * Math.PI);
      const ww = Math.max(2, Math.round(w * (0.45 + 0.55 * bulge)));
      for (let x = 8 - ww; x < 8; x++) half[y * N + x] = 2;
    }
    for (let i = 0; i < rng.range(3, 7); i++) { const x = rng.range(2, 7), y = rng.range(top, bottom); if (half[y * N + x] === 2) half[y * N + x] = 3; }
    // A darker belly band for shading
    for (let y = bottom - 3; y < bottom; y++) for (let x = 2; x < 8; x++) if (half[y * N + x] === 2 && (x + y) % 2 === 0) half[y * N + x] = 3;
    half[(top + 2) * N + rng.range(4, 6)] = 1;
    if (spec.variant === "beast") for (const x of [2, 5]) for (let y = bottom - 1; y < N; y++) { half[y * N + x] = 2; half[y * N + x + 1] = 2; }
    if (spec.variant === "flyer") { const wy = rng.range(3, 6); for (let x = 0; x < 4; x++) { half[wy * N + x] = 3; half[(wy + 1) * N + x] = 3; } }
    if (rng.chance(0.5)) { half[(top - 1) * N + rng.range(3, 6)] = 3; half[(top - 1) * N + rng.range(3, 6)] = 3; }
    c.set(half);
    for (let y = 0; y < N; y++) for (let x = 0; x < 8; x++) c[y * N + 15 - x] = c[y * N + x];
    for (let x = 6; x < 10; x++) if (rng.chance(0.5)) setN(x, top + 4, 1);
  }
  // Outline
  const src = Uint8Array.from(c);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (src[y * N + x] !== 0) continue;
    const n = (atN(x - 1, y) > 1) || (atN(x + 1, y) > 1) || (atN(x, y - 1) > 1) || (atN(x, y + 1) > 1);
    if (n) c[y * N + x] = 1;
  }
  return c;
}

// ---------------------------------------------------------------------------
// UI shapes.

function shape(variant: string): Cells {
  switch (variant) {
    case "cursor": return fromRows(["a.......", "aa......", "aaa.....", "aaaa....", "aaa.....", "aa......", "a.......", "........"]);
    case "lock": return fromRows(["..aaaa..", ".a....a.", ".a....a.", "aaaaaaaa", "aabbbbaa", "aabbbbaa", "aaaaaaaa", "........"]);
    case "pluck": return fromRows(["...a....", "...a....", "..ba....", "...ab...", "...a....", "..ba....", "...a....", "...a...."]);
    case "tangle": return fromRows(["a.....b.", ".a...b..", "..a.b...", "...ab...", "...ba...", "..b.a...", ".b...a..", "b.....a."]);
    case "knot": return fromRows(["...a....", "..aba...", ".a.a.b..", "..aaa...", ".b.a.a..", "..aba...", "...a....", "........"]);
    case "duck": return fromRows(["........", "........", "..aa....", ".a..a...", "aaaaaaa.", ".aaaaaa.", "........", "........"]);
    case "lane": return fromRows(["a..a..a.", "a..a..a.", "a..b..a.", "a..b..a.", "a..b..a.", "a..a..a.", "a..a..a.", "........"]);
    case "up": return fromRows(["...a....", "..aaa...", ".aaaaa..", "...a....", "...a....", "...a....", "...a....", "........"]);
    case "down": return fromRows(["...a....", "...a....", "...a....", "...a....", ".aaaaa..", "..aaa...", "...a....", "........"]);
    case "pip": return fromRows(["........", "........", "...aa...", "..aaaa..", "..aaaa..", "...aa...", "........", "........"]);
    case "note": return fromRows(["....a...", "....aa..", "....a.a.", "....a...", "..aaa...", ".aaaa...", "..aa....", "........"]);
    case "heart": return fromRows(["........", ".aa.aa..", "aaaaaaa.", "aaaaaaa.", ".aaaaa..", "..aaa...", "...a....", "........"]);
    case "wind": return fromRows(["........", ".aaaa...", ".....a..", "..aaaaa.", "........", "aaaa....", "....a...", "........"]);
    case "skull": return fromRows(["..aaaa..", ".aaaaaa.", ".a.aa.a.", ".aaaaaa.", "..a..a..", "..aaaa..", "...aa...", "........"]);
    case "cold": return fromRows(["...a....", ".a.a.a..", "..aaa...", "aaaaaaa.", "..aaa...", ".a.a.a..", "...a....", "........"]);
    case "heat": return fromRows(["...a....", "..aa....", "..aaa...", ".aabaa..", ".abbba..", ".abbba..", "..aaa...", "........"]);
    case "blunt": return fromRows(["..aaaa..", ".aaaaaa.", ".aaaaaa.", ".aaaaaa.", "..aaaa..", "...a....", "...a....", "........"]);
    case "cut": return fromRows([".......a", "......a.", ".....a..", "....a...", "...a....", "aba.....", "ab......", "........"]);
    case "hum": return fromRows(["........", "a.......", "aa..a...", "a.a.a.a.", "a..a..a.", "a.....aa", "a......a", "........"]);
    case "check": return fromRows(["........", "......a.", ".....a..", "a...a...", ".a.a....", "..a.....", "........", "........"]);
    case "cross": return fromRows(["........", ".a...a..", "..a.a...", "...a....", "..a.a...", ".a...a..", "........", "........"]);
    case "star": return fromRows(["...a....", "...a....", ".aaaaa..", "..aaa...", ".a.a.a..", "........", "........", "........"]);
    case "eye": return fromRows(["........", "..aaaa..", ".a.bb.a.", "a..bb..a", ".a.bb.a.", "..aaaa..", "........", "........"]);
    case "dots": return fromRows(["........", "........", "........", ".a..a..a", "........", "........", "........", "........"]);
    case "left": return fromRows(["........", "..a.....", ".aa.....", "aaaaaaa.", ".aa.....", "..a.....", "........", "........"]);
    case "right": return fromRows(["........", ".....a..", ".....aa.", "aaaaaaa.", ".....aa.", ".....a..", "........", "........"]);
    case "jaw": return fromRows(["a.....a.", "ab...ba.", "aab.baa.", ".a...a..", ".ab.ba..", "..aaa...", "........", "........"]);
    default: return fromRows(["aaaaaaaa", "a......a", "a......a", "a......a", "a......a", "a......a", "a......a", "aaaaaaaa"]);
  }
}

/** Player two's cursor: a hand reaching down from above. */
function hand(variant: string): Cells {
  if (variant === "pinch") return fromRows(["a.a.a.a.", "a.a.a.a.", "aaaaaaa.", "aaaaaaa.", ".aaaaa..", "..aaa...", "...a....", "........"]);
  return fromRows(["a.a.a.a.", "a.a.a.a.", "aaaaaaa.", "aaaaaaa.", ".aaaaa..", ".aaaaa..", "..aaa...", "..aaa..."]);
}
