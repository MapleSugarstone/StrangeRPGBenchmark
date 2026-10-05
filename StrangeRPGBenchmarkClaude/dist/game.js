"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/core/palette.ts
  var WHEEL = ["R", "Y", "G", "C", "B", "M"];
  var HUE_NAME = { R: "Red", Y: "Amber", G: "Green", C: "Cyan", B: "Blue", M: "Violet", N: "Grey" };
  var COLORS = {
    k: "#0c0a12",
    ink: "#262234",
    g1: "#4a4658",
    g2: "#8e8a9c",
    g3: "#cbc7d4",
    w: "#f6f2e8",
    r1: "#6b1d2e",
    r2: "#d6404a",
    r3: "#ff9a82",
    o1: "#7a3e14",
    o2: "#e8842c",
    o3: "#ffc27a",
    y1: "#7c6414",
    y2: "#e8c030",
    y3: "#fff08a",
    n1: "#3a2418",
    n2: "#8c5c38",
    n3: "#d8a878",
    e1: "#1d5a3a",
    e2: "#3fae52",
    e3: "#b4f084",
    c1: "#11505e",
    c2: "#26b4c4",
    c3: "#9af4ec",
    b1: "#1e2a7c",
    b2: "#3e6ae8",
    b3: "#a0b8ff",
    m1: "#5a1a66",
    m2: "#c244c8",
    m3: "#ff9ce8"
  };
  function hueOf(c) {
    switch (c[0]) {
      case "r":
        return "R";
      case "o":
      case "y":
      case "n":
        return "Y";
      case "e":
        return "G";
      case "c":
        return "C";
      case "b":
        return "B";
      case "m":
        return "M";
      default:
        return "N";
    }
  }
  function huesOf(p2) {
    return [hueOf(p2[1]), hueOf(p2[2])];
  }
  function opposite(h2) {
    if (h2 === "N") return "N";
    return WHEEL[(WHEEL.indexOf(h2) + 3) % 6];
  }
  function hueMult(atk, hues) {
    if (atk === "N") return 1;
    let m2 = 1;
    for (const t of hues) {
      if (t === "N") continue;
      if (t === atk) m2 -= 0.25;
      else if (opposite(t) === atk) m2 += 0.5;
    }
    return m2;
  }
  var HUE_COLOR = { R: "r2", Y: "y2", G: "e2", C: "c2", B: "b2", M: "m2", N: "g2" };
  var greyCache = /* @__PURE__ */ new Map();
  function greyHex(hex) {
    let g = greyCache.get(hex);
    if (g) return g;
    const n = parseInt(hex.slice(1), 16);
    const l = 0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255);
    const v = Math.round(l * 0.9 + 12).toString(16).padStart(2, "0");
    g = `#${v}${v}${v}`;
    greyCache.set(hex, g);
    return g;
  }

  // src/core/font.ts
  var SRC = {
    A: ".#./#.#/###/#.#/#.#",
    B: "##./#.#/##./#.#/##.",
    C: ".##/#../#../#../.##",
    D: "##./#.#/#.#/#.#/##.",
    E: "###/#../##./#../###",
    F: "###/#../##./#../#..",
    G: ".##/#../#.#/#.#/.##",
    H: "#.#/#.#/###/#.#/#.#",
    I: "###/.#./.#./.#./###",
    J: "..#/..#/..#/#.#/.#.",
    K: "#.#/#.#/##./#.#/#.#",
    L: "#../#../#../#../###",
    M: "#...#/##.##/#.#.#/#...#/#...#",
    N: "#..#/##.#/#.##/#..#/#..#",
    O: ".##./#..#/#..#/#..#/.##.",
    P: "##./#.#/##./#../#..",
    Q: ".##./#..#/#..#/#.#./.#.#",
    R: "##./#.#/##./#.#/#.#",
    S: ".##/#../.#./..#/##.",
    T: "###/.#./.#./.#./.#.",
    U: "#.#/#.#/#.#/#.#/###",
    V: "#.#/#.#/#.#/#.#/.#.",
    W: "#...#/#...#/#.#.#/##.##/#...#",
    X: "#.#/#.#/.#./#.#/#.#",
    Y: "#.#/#.#/.#./.#./.#.",
    Z: "###/..#/.#./#../###",
    a: ".../.##/#.#/#.#/.##",
    b: "#../##./#.#/#.#/##.",
    c: ".../.##/#../#../.##",
    d: "..#/.##/#.#/#.#/.##",
    e: ".../.#./###/#../.##",
    f: ".##/#../##./#../#..",
    g: ".../.##/#.#/.##/..#/##.",
    h: "#../##./#.#/#.#/#.#",
    i: "#/./#/#/#",
    j: ".#/../.#/.#/.#/#.",
    k: "#../#.#/##./#.#/#.#",
    l: "#./#./#./#./.#",
    m: "...../####./#.#.#/#.#.#/#.#.#",
    n: ".../##./#.#/#.#/#.#",
    o: ".../.#./#.#/#.#/.#.",
    p: ".../##./#.#/#.#/##./#..",
    q: ".../.##/#.#/#.#/.##/..#",
    r: ".../#.#/##./#../#..",
    s: ".../.##/#../..#/##.",
    t: ".#./###/.#./.#./.##",
    u: ".../#.#/#.#/#.#/.##",
    v: ".../#.#/#.#/#.#/.#.",
    w: "...../#...#/#...#/#.#.#/.#.#.",
    x: ".../#.#/.#./.#./#.#",
    y: ".../#.#/#.#/.##/..#/##.",
    z: ".../###/..#/.#./###",
    "0": "###/#.#/#.#/#.#/###",
    "1": ".#./##./.#./.#./###",
    "2": "##./..#/.#./#../###",
    "3": "##./..#/.#./..#/##.",
    "4": "#.#/#.#/###/..#/..#",
    "5": "###/#../##./..#/##.",
    "6": ".##/#../###/#.#/###",
    "7": "###/..#/.#./.#./.#.",
    "8": "###/#.#/###/#.#/###",
    "9": "###/#.#/###/..#/##.",
    ".": "./././././#",
    ",": "../../../../.#/#.",
    "!": "#/#/#/./#",
    "?": "##./..#/.#./.../.#.",
    "'": "#/#",
    '"': "#.#/#.#",
    ":": "./#/./#",
    ";": "../.#/../.#/#.",
    "-": ".../.../###",
    "+": ".../.#./###/.#.",
    "/": "..#/..#/.#./#../#..",
    "(": ".#/#./#./#./.#",
    ")": "#./.#/.#./.#/#.",
    "%": "#.#/..#/.#./#../#.#",
    "*": ".../#.#/.#./#.#",
    "=": ".../###/.../###",
    "<": "..#/.#./#../.#./..#",
    ">": "#../.#./..#/.#./#..",
    "#": ".#.#./#####/.#.#./#####/.#.#.",
    "&": ".#./#.#/.#./#.#/.##",
    "[": "##/#./#./#./##",
    "]": "##/.#/.#/.#/##",
    _: ".../.../.../.../###",
    "`": "#../##./###/##./#..",
    "|": "#/#/#/#/#",
    "~": "..../.#.#/#.#.",
    "{": ".#.#./#####/#####/.###./..#..",
    "}": ".#./###/###/.#."
  };
  var GLYPHS = /* @__PURE__ */ new Map();
  for (const [ch, src] of Object.entries(SRC)) {
    const rows = src.split("/");
    GLYPHS.set(ch, { w: Math.max(...rows.map((r) => r.length)), rows });
  }
  GLYPHS.set(" ", { w: 2, rows: [] });
  var LINE_H = 7;
  function charW(ch) {
    const g = GLYPHS.get(ch) ?? GLYPHS.get("?");
    return g.w + 1;
  }
  function textW(s) {
    let w = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "^") {
        i++;
        continue;
      }
      w += charW(s[i]);
    }
    return Math.max(0, w - 1);
  }
  function wrap(text, maxW) {
    const out = [];
    for (const para of text.split("\n")) {
      const words = para.split(" ");
      let line = "";
      let color = "";
      let lineColor = "";
      for (const word of words) {
        const trial = line ? line + " " + word : word;
        if (textW(trial) > maxW && line) {
          out.push(lineColor + line);
          lineColor = color;
          line = word;
        } else {
          line = trial;
        }
        for (let i = 0; i < word.length; i++) if (word[i] === "^") {
          color = word[i + 1] === "0" ? "" : "^" + word[i + 1];
          i++;
        }
      }
      out.push(lineColor + line);
    }
    return out;
  }

  // src/core/rng.ts
  function hash(s) {
    let h2 = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h2 ^= s.charCodeAt(i);
      h2 = Math.imul(h2, 16777619);
    }
    return h2 >>> 0;
  }
  function hash2(x, y, salt = 0) {
    let h2 = x * 374761393 + y * 668265263 + salt * 2246822519 >>> 0;
    h2 = Math.imul(h2 ^ h2 >>> 13, 1274126177);
    return (h2 ^ h2 >>> 16) >>> 0;
  }
  var Rng = class {
    constructor(seed = Date.now()) {
      __publicField(this, "s");
      this.s = (typeof seed === "string" ? hash(seed) : seed >>> 0) || 1;
    }
    next() {
      this.s = this.s + 1831565813 >>> 0;
      let t = this.s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    int(a, b2) {
      return a + Math.floor(this.next() * (b2 - a + 1));
    }
    range(a, b2) {
      return a + this.next() * (b2 - a);
    }
    chance(p2) {
      return this.next() < p2;
    }
    pick(a) {
      return a[Math.floor(this.next() * a.length)];
    }
    weighted(items, w) {
      let total = 0;
      for (const it of items) total += Math.max(0, w(it));
      let r = this.next() * total;
      for (const it of items) {
        r -= Math.max(0, w(it));
        if (r < 0) return it;
      }
      return items[items.length - 1];
    }
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  };

  // src/core/sprites.ts
  function specKey(s) {
    return `${s.g}|${s.seed ?? ""}|${s.pal.join(",")}|${s.o ? JSON.stringify(s.o) : ""}|${s.n ?? 1}`;
  }
  var blank = (n = 8) => new Uint8Array(n * n);
  function mirror(half, n = 8) {
    const p2 = blank(n);
    const hw = n / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < hw; x++) {
      const v = half[y][x];
      p2[y * n + x] = v;
      p2[y * n + (n - 1 - x)] = v;
    }
    return p2;
  }
  function rowsToHalf(rows) {
    return rows.map((r) => r.split("").map((c) => +c));
  }
  var PLANS = {
    blob: ["0013", "0268", "1599", "2799", "2799", "1599", "0368", "0123"],
    bug: ["0021", "0157", "3489", "1699", "4599", "2689", "5264", "4030"],
    flyer: ["0002", "3127", "6759", "8989", "5899", "1368", "0036", "0013"],
    tall: ["0036", "0179", "0289", "0399", "1599", "0399", "0298", "0206"],
    ghost: ["0027", "0379", "1799", "2899", "2899", "3899", "4999", "5070"],
    eye: ["0036", "0389", "2899", "3999", "3999", "2899", "0389", "0036"],
    crawler: ["0000", "0000", "0026", "1379", "4899", "6999", "4999", "6060"],
    totem: ["0288", "0299", "0599", "0299", "0399", "0299", "0599", "0288"],
    star: ["0009", "0019", "0059", "5999", "0799", "0299", "0507", "3002"],
    worm: ["0000", "0280", "2892", "8906", "6008", "0068", "0089", "0036"]
  };
  var SHAPES = Object.keys(PLANS);
  function neighbors(p2, n, x, y) {
    let c = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < n && ny < n && p2[ny * n + nx]) c++;
    }
    return c;
  }
  function monsterOnce(r, shape, n) {
    const plan = PLANS[shape] ?? PLANS.blob;
    const hw = n / 2;
    const half = [];
    for (let y = 0; y < n; y++) {
      half.push([]);
      for (let x = 0; x < hw; x++) {
        const py = Math.floor(y * 8 / n);
        const px = Math.floor(x * 4 / hw);
        const prob = +plan[py][px] / 9;
        half[y].push(r.next() < prob * 0.95 + 0.02 ? 2 : 0);
      }
    }
    let p2 = mirror(half, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (p2[y * n + x] && neighbors(p2, n, x, y) === 0) p2[y * n + x] = 0;
    const swap = r.chance(0.5);
    const edge = swap ? 3 : 2;
    const core = swap ? 2 : 3;
    const q = blank(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!p2[y * n + x]) continue;
      q[y * n + x] = neighbors(p2, n, x, y) < 4 ? edge : core;
    }
    const stripe = r.int(0, 2);
    if (stripe > 0) {
      const sy = r.int(Math.floor(n * 0.45), n - 2);
      for (let x = 0; x < n; x++) if (q[sy * n + x] === core) q[sy * n + x] = edge;
    }
    const eyeX = r.int(Math.max(1, hw - 3), hw - 1);
    for (let y = 1; y < n - 2; y++) {
      if (q[y * n + eyeX] && q[y * n + (n - 1 - eyeX)] && q[(y - 1) * n + eyeX]) {
        q[y * n + eyeX] = 1;
        q[y * n + (n - 1 - eyeX)] = 1;
        break;
      }
    }
    if (r.chance(0.6)) {
      for (let y = n - 3; y > n / 2; y--) {
        const mx = hw - 1;
        if (q[y * n + mx] && q[y * n + mx + 1]) {
          q[y * n + mx] = 1;
          q[y * n + mx + 1] = 1;
          break;
        }
      }
    }
    return q;
  }
  function countFilled(p2) {
    let c = 0;
    for (const v of p2) if (v) c++;
    return c;
  }
  function genMonster(seed, shape, n = 1) {
    const size = 8 * n;
    const r = new Rng(typeof seed === "string" ? hash(seed + shape) : seed);
    let best = monsterOnce(r, shape, size);
    for (let i = 0; i < 12 && countFilled(best) < size * size * 0.38; i++) best = monsterOnce(r, shape, size);
    return best;
  }
  var HEADS = {
    bald: ["0000", "0033", "0013", "0033"],
    hair: ["0022", "0222", "0213", "0033"],
    hood: ["0022", "0222", "0213", "0233"],
    wizard: ["0002", "0022", "0222", "0013"],
    helm: ["0022", "0222", "0211", "0232"],
    antenna: ["0010", "0033", "0013", "0033"],
    horns: ["0100", "0133", "0013", "0033"],
    crown: ["0303", "0333", "0013", "0033"],
    halo: ["0333", "0033", "0013", "0033"],
    cyclops: ["0022", "0222", "0221", "0222"],
    bun: ["0003", "0033", "0313", "0033"],
    brim: ["0022", "2222", "0013", "0033"],
    bubble: ["0333", "3003", "3013", "0333"],
    mask: ["0022", "0222", "0212", "0222"]
  };
  var TORSOS = {
    plain: ["0222", "0222"],
    arms: ["2222", "3022"],
    belt: ["0222", "0211"],
    cape: ["1222", "1222"],
    armor: ["3223", "0232"],
    robe: ["0222", "0232"],
    vest: ["2322", "3022"],
    wide: ["2222", "2222"]
  };
  var LEGS = {
    legs: ["0022", "0010"],
    robe: ["0222", "2222"],
    skirt: ["0222", "0101"],
    wheels: ["0222", "0101"],
    stance: ["0202", "0101"],
    float: ["0022", "0002"],
    tail: ["0022", "0033"]
  };
  var HEAD_KEYS = Object.keys(HEADS);
  var TORSO_KEYS = Object.keys(TORSOS);
  var LEG_KEYS = Object.keys(LEGS);
  var HELD = {
    lamp: [[7, 3, 1], [7, 4, 3], [7, 5, 3], [6, 5, 1]],
    staff: [[7, 0, 3], [7, 1, 1], [7, 2, 1], [7, 3, 1], [7, 4, 1], [7, 5, 1], [7, 6, 1]],
    sword: [[7, 1, 3], [7, 2, 3], [7, 3, 3], [7, 4, 1], [6, 4, 1]],
    brush: [[7, 0, 3], [7, 1, 3], [7, 2, 1], [7, 3, 1], [7, 4, 1], [7, 5, 1]],
    book: [[6, 4, 3], [7, 4, 3], [6, 5, 1], [7, 5, 3]],
    coin: [[7, 4, 3], [7, 5, 3]],
    flag: [[7, 0, 1], [6, 0, 3], [6, 1, 3], [7, 1, 1], [7, 2, 1], [7, 3, 1], [7, 4, 1], [7, 5, 1]]
  };
  function genHumanoid(seed, o = {}) {
    const r = new Rng(typeof seed === "string" ? hash(seed) : seed);
    const head = o.head ?? r.pick(HEAD_KEYS);
    const torso = o.torso ?? r.pick(TORSO_KEYS);
    const legs = o.legs ?? r.pick(LEG_KEYS);
    const rows = [...HEADS[head] ?? HEADS.bald, ...TORSOS[torso] ?? TORSOS.plain, ...LEGS[legs] ?? LEGS.legs];
    const p2 = mirror(rowsToHalf(rows));
    const held = o.held ?? (r.chance(0.3) ? r.pick(Object.keys(HELD)) : "");
    for (const [x, y, v] of HELD[held] ?? []) p2[y * 8 + x] = v;
    return p2;
  }
  var BEASTS = {
    cat: ["03000030", "03333330", "03133130", "03322330", "00333300", "03333332", "03333332", "01311312"],
    nona: ["30000003", "33333333", "31333313", "03322330", "20333302", "22333322", "22333322", "21311312"],
    frog: ["00000000", "01300310", "33333333", "32222223", "03333330", "33222233", "30333303", "11000011"],
    bird: ["00022000", "00212200", "00222330", "02222000", "22222200", "02222000", "00202000", "00101000"],
    fish: ["00000000", "00022000", "20222320", "22221230", "22222330", "20222320", "00022000", "00000000"],
    moth: ["30000003", "33300333", "32311323", "33322333", "03322330", "33322333", "30322303", "00011000"],
    slug: ["00000000", "00000000", "00100100", "00333300", "03333330", "33322333", "23333332", "22222222"],
    robo: ["00011000", "00333300", "03122130", "03333330", "11222211", "01233210", "00222200", "01100110"],
    vend: ["22222222", "23311332", "23333332", "23131312", "23333332", "21111112", "22222222", "10000001"],
    mirror: ["00222200", "02333320", "23311332", "23333332", "23333332", "02333320", "00222200", "00111100"],
    blank: ["00222200", "02333320", "23133132", "23333332", "02333320", "00333300", "02300320", "02000020"],
    monk: ["00022000", "00233200", "00213200", "02222220", "22232322", "02222220", "02222220", "01100110"],
    bishop: ["00033000", "00333300", "00222200", "00212200", "03222230", "32223223", "32222223", "33333333"],
    sheep: ["00000000", "03333330", "33333333", "13313333", "33333333", "03333330", "01100110", "01100110"],
    whale: ["00000000", "00222200", "02222220", "22122222", "22222223", "23333322", "02333220", "00000033"]
  };
  function genBeast(kind) {
    const rows = BEASTS[kind] ?? BEASTS.cat;
    const p2 = blank();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p2[y * 8 + x] = +rows[y][x];
    return p2;
  }
  var PROPS = {
    lamp: ["00111100", "01322310", "01322310", "00111100", "00011000", "00011000", "00011000", "00111100"],
    lampOff: ["00111100", "01000010", "01000010", "00111100", "00011000", "00011000", "00011000", "00111100"],
    chest: ["00000000", "00000000", "01111110", "12222221", "13311331", "12233221", "12222221", "01111110"],
    chestOpen: ["00000000", "01111110", "13333331", "11111111", "12211221", "12222221", "12222221", "01111110"],
    sign: ["00000000", "11111111", "12222221", "13333331", "12222221", "11111111", "00011000", "00011000"],
    bell: ["00011000", "00122100", "01222210", "01223210", "01222210", "12222221", "11111111", "00033000"],
    crystal: ["00011000", "00132100", "01332210", "01322210", "01322210", "00132100", "00122100", "00011000"],
    orb: ["00000000", "00111100", "01332210", "01322210", "01222210", "01222210", "00111100", "00000000"],
    sundial: ["00000000", "00011000", "00013000", "01113110", "12222221", "12232221", "12222221", "01111110"],
    pool: ["00000000", "00000000", "00222200", "02333320", "23322332", "02333320", "00222200", "00000000"],
    spool: ["01111110", "00122100", "00333300", "00222200", "00333300", "00222200", "00122100", "01111110"],
    tube: ["01111110", "12333321", "12300321", "12300321", "12300321", "12300321", "12333321", "01111110"],
    star: ["00010000", "00131000", "01333100", "13323310", "01333100", "00131000", "00010000", "00000000"],
    statue: ["00111100", "01222210", "01212210", "01222210", "00122100", "01222210", "01222210", "11111111"],
    bed: ["00000000", "11111111", "13333331", "13322221", "12222221", "12222221", "11111111", "10000001"],
    pot: ["00000000", "00111100", "01222210", "12233221", "12222221", "12222221", "01222210", "00111100"],
    switch: ["00000000", "00000000", "00011100", "00013100", "00011100", "00010000", "01111110", "12222221"],
    terminal: ["11111111", "12222221", "12333221", "12232321", "12222221", "11111111", "01222210", "11111111"]
  };
  function genProp(kind) {
    const rows = PROPS[kind] ?? PROPS.chest;
    const p2 = blank();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p2[y * 8 + x] = +rows[y][x];
    return p2;
  }
  function fill(c) {
    return new Uint8Array(64).fill(c);
  }
  function speck(p2, r, c, prob) {
    for (let i = 0; i < 64; i++) if (r.next() < prob) p2[i] = c;
  }
  function set(p2, x, y, c) {
    if (x >= 0 && y >= 0 && x < 8 && y < 8) p2[y * 8 + x] = c;
  }
  var TILES = {
    ground: (r) => {
      const p2 = fill(2);
      speck(p2, r, 3, 0.08);
      speck(p2, r, 1, 0.02);
      return p2;
    },
    grass: (r) => {
      const p2 = fill(2);
      for (let i = 0; i < 3; i++) {
        const x = r.int(0, 6), y = r.int(1, 7);
        set(p2, x, y, 3);
        set(p2, x + 1, y - 1, 3);
      }
      speck(p2, r, 1, 0.015);
      return p2;
    },
    tall: (r, v, f9) => {
      const p2 = fill(2);
      const sway = f9 % 2;
      for (let x = 0; x < 8; x += 2) {
        const h2 = r.int(3, 6);
        for (let y = 7; y > 7 - h2; y--) set(p2, x + (y < 4 && sway ? 1 : 0), y, y === 8 - h2 ? 3 : 1);
      }
      return p2;
    },
    flowers: (r) => {
      const p2 = fill(2);
      for (let i = 0; i < 2; i++) {
        const x = r.int(1, 6), y = r.int(1, 6);
        set(p2, x, y, 3);
        set(p2, x - 1, y, 3);
        set(p2, x + 1, y, 3);
        set(p2, x, y - 1, 3);
        set(p2, x, y + 1, 3);
        set(p2, x, y, 1);
      }
      return p2;
    },
    path: (r) => {
      const p2 = fill(3);
      speck(p2, r, 2, 0.12);
      speck(p2, r, 1, 0.02);
      return p2;
    },
    sand: (r, v) => {
      const p2 = fill(3);
      for (let x = 0; x < 8; x++) {
        const y = (x + v * 3) % 8;
        if (r.chance(0.5)) set(p2, x, y, 2);
      }
      speck(p2, r, 2, 0.05);
      return p2;
    },
    floor: (r, v) => {
      const p2 = fill(2);
      for (let i = 0; i < 8; i++) {
        set(p2, i, 0, 1);
        set(p2, 0, i, 1);
      }
      set(p2, 1, 1, 3);
      set(p2, 2, 1, 3);
      set(p2, 1, 2, 3);
      if (v === 1) speck(p2, r, 3, 0.04);
      return p2;
    },
    planks: (r) => {
      const p2 = fill(2);
      for (let x = 0; x < 8; x++) {
        set(p2, x, 3, 1);
        set(p2, x, 7, 1);
      }
      set(p2, r.int(0, 7), 1, 3);
      set(p2, r.int(0, 7), 5, 3);
      set(p2, 2, 0, 1);
      set(p2, 2, 1, 1);
      set(p2, 2, 2, 1);
      set(p2, 6, 4, 1);
      set(p2, 6, 5, 1);
      set(p2, 6, 6, 1);
      return p2;
    },
    carpet: (r, v) => {
      const p2 = fill(2);
      for (let i = 0; i < 8; i++) {
        set(p2, i, i, 3);
        set(p2, 7 - i, i, 3);
      }
      set(p2, 3, 3, 1);
      set(p2, 4, 4, 1);
      set(p2, 3, 4, 1);
      set(p2, 4, 3, 1);
      return p2;
    },
    brick: (r) => {
      const p2 = fill(2);
      for (let x = 0; x < 8; x++) {
        set(p2, x, 3, 1);
        set(p2, x, 7, 1);
      }
      for (let y = 0; y < 3; y++) set(p2, 3, y, 1);
      for (let y = 4; y < 7; y++) set(p2, 7, y, 1);
      set(p2, 0, 0, 3);
      set(p2, 1, 0, 3);
      set(p2, 4, 4, 3);
      set(p2, 5, 4, 3);
      return p2;
    },
    wall: (r) => {
      const p2 = fill(2);
      for (let x = 0; x < 8; x++) {
        set(p2, x, 0, 3);
        set(p2, x, 7, 1);
      }
      speck(p2, r, 1, 0.05);
      set(p2, r.int(1, 6), r.int(2, 5), 3);
      return p2;
    },
    rock: (r) => {
      const p2 = fill(2);
      const shape = ["00111100", "01333310", "13322231", "13222221", "12222221", "12222211", "01222110", "00111100"];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const c = +shape[y][x];
        if (c) p2[y * 8 + x] = c;
      }
      speck(p2, r, 2, 0);
      return p2;
    },
    tree: (r, v) => {
      const p2 = fill(2);
      const shape = ["00333300", "03333330", "33333333", "33313333", "33333313", "03333330", "00011000", "00011000"];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const c = +shape[y][x];
        if (c) p2[y * 8 + x] = c;
      }
      if (v % 2) {
        set(p2, 2, 2, 1);
        set(p2, 4, 3, 2);
      }
      return p2;
    },
    pine: (r, v) => {
      const p2 = fill(2);
      const shape = ["00033000", "00333300", "00333300", "03331330", "03333330", "33133333", "00011000", "00011000"];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const c = +shape[y][x];
        if (c) p2[y * 8 + x] = c;
      }
      return p2;
    },
    antenna: (r, v, f9) => {
      const p2 = fill(2);
      for (let y = 1; y < 8; y++) set(p2, 3, y, 1), set(p2, 4, y, 1);
      for (let y = 1; y < 6; y += 2) {
        set(p2, 1, y, 1);
        set(p2, 2, y, 1);
        set(p2, 5, y, 1);
        set(p2, 6, y, 1);
      }
      set(p2, 3, 0, (f9 + v) % 2 ? 3 : 1);
      set(p2, 4, 0, (f9 + v) % 2 ? 3 : 1);
      return p2;
    },
    bush: (r) => {
      const p2 = fill(2);
      const shape = ["00000000", "00333300", "03333330", "33313333", "33333333", "13333331", "01111110", "00000000"];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const c = +shape[y][x];
        if (c) p2[y * 8 + x] = c;
      }
      return p2;
    },
    water: (r, v, f9) => {
      const p2 = fill(2);
      const o = (f9 + v * 2) % 8;
      for (let x = 0; x < 3; x++) {
        set(p2, (o + x) % 8, 2, 3);
        set(p2, (o + x + 4) % 8, 6, 3);
      }
      return p2;
    },
    deep: (r, v, f9) => {
      const p2 = fill(1);
      const o = (f9 + v) % 8;
      set(p2, o, 3, 2);
      set(p2, (o + 1) % 8, 3, 2);
      set(p2, (o + 5) % 8, 6, 2);
      if (v === 2) set(p2, 2, 1, 3);
      return p2;
    },
    static: (r, v, f9) => {
      const q = new Rng(v * 97 + f9 * 13 + 5);
      const p2 = fill(2);
      for (let i = 0; i < 64; i++) {
        const n = q.next();
        if (n < 0.18) p2[i] = 3;
        else if (n < 0.3) p2[i] = 1;
      }
      return p2;
    },
    void: (r, v, f9) => {
      const p2 = fill(1);
      if (v === 0) set(p2, 3, 3, f9 % 3 === 0 ? 3 : 2);
      if (v === 3) set(p2, 6, 1, 2);
      return p2;
    },
    edge: (r, v, f9) => {
      const p2 = fill(1);
      for (let x = 0; x < 8; x++) {
        if ((x + f9) % 3 === 0) set(p2, x, 0, 3);
        if (r.chance(0.3)) set(p2, x, 1, 2);
      }
      return p2;
    },
    bridge: () => {
      const p2 = fill(2);
      for (let y = 0; y < 8; y++) {
        set(p2, 0, y, 1);
        set(p2, 7, y, 1);
      }
      for (let x = 1; x < 7; x++) {
        set(p2, x, 2, 1);
        set(p2, x, 5, 1);
      }
      set(p2, 2, 0, 3);
      set(p2, 5, 3, 3);
      set(p2, 3, 6, 3);
      return p2;
    },
    roof: (r, v) => {
      const p2 = fill(2);
      for (let y = 0; y < 8; y += 2) for (let x = y / 2 % 2; x < 8; x += 2) set(p2, x, y + 1, 1);
      for (let x = 0; x < 8; x++) set(p2, x, 0, 3);
      return p2;
    },
    window: () => {
      const p2 = fill(2);
      for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) set(p2, x, y, 1);
      for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) set(p2, x, y, 3);
      set(p2, 3, 2, 1);
      set(p2, 3, 3, 1);
      set(p2, 3, 4, 1);
      set(p2, 3, 5, 1);
      set(p2, 2, 3, 1);
      set(p2, 4, 3, 1);
      set(p2, 5, 3, 1);
      return p2;
    },
    door: () => {
      const p2 = fill(2);
      for (let y = 1; y < 8; y++) for (let x = 1; x < 7; x++) set(p2, x, y, 1);
      for (let y = 2; y < 8; y++) {
        set(p2, 2, y, 3);
        set(p2, 5, y, 3);
      }
      set(p2, 4, 5, 3);
      return p2;
    },
    stairs: () => {
      const p2 = fill(1);
      for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x++) {
        set(p2, x, y, 2);
        if (x > 5 - y / 2) set(p2, x, y + 1, 3);
      }
      return p2;
    },
    fence: () => {
      const p2 = fill(2);
      for (let x = 0; x < 8; x++) {
        set(p2, x, 2, 1);
        set(p2, x, 5, 1);
      }
      for (let y = 1; y < 7; y++) {
        set(p2, 1, y, 3);
        set(p2, 6, y, 3);
      }
      return p2;
    },
    pillar: () => {
      const p2 = fill(2);
      for (let y = 0; y < 8; y++) {
        set(p2, 1, y, 1);
        set(p2, 6, y, 1);
        set(p2, 3, y, 3);
      }
      for (let x = 0; x < 8; x++) {
        set(p2, x, 0, 1);
        set(p2, x, 7, 1);
      }
      return p2;
    },
    gear: (r, v, f9) => {
      const p2 = fill(2);
      const s = ["00300300", "03333330", "33311333", "03111130", "03111130", "33311333", "03333330", "00300300"];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const c = +s[y][x];
        if (c) p2[y * 8 + x] = c;
      }
      if ((f9 + v) % 2) {
        set(p2, 3, 0, 2);
        set(p2, 4, 7, 2);
        set(p2, 0, 3, 3);
        set(p2, 7, 4, 3);
      }
      return p2;
    },
    belt: (r, v, f9) => {
      const p2 = fill(2);
      for (let y = 0; y < 8; y++) {
        set(p2, 0, y, 1);
        set(p2, 7, y, 1);
      }
      const o = f9 % 4;
      for (let y = o; y < 8; y += 4) {
        set(p2, 3, y, 3);
        set(p2, 4, y, 3);
        set(p2, 2, (y + 1) % 8, 3);
        set(p2, 5, (y + 1) % 8, 3);
      }
      return p2;
    },
    belt_up: (r, v, f9) => beltTile(f9, 0, -1),
    belt_down: (r, v, f9) => beltTile(f9, 0, 1),
    belt_left: (r, v, f9) => beltTile(f9, -1, 0),
    belt_right: (r, v, f9) => beltTile(f9, 1, 0),
    gate: (r, v, f9) => {
      const p2 = fill(1);
      for (let x = 1; x < 8; x += 2) for (let y = 0; y < 8; y++) set(p2, x, y, (y + f9) % 4 === 0 ? 3 : 2);
      return p2;
    },
    cloud: (r, v, f9) => {
      const p2 = fill(2);
      const o = (f9 + v * 3) % 8;
      for (let x = 0; x < 4; x++) {
        set(p2, (o + x) % 8, 3, 3);
        set(p2, (o + x + 1) % 8, 2, 3);
      }
      set(p2, (o + 6) % 8, 6, 3);
      return p2;
    },
    thread: (r, v, f9) => {
      const p2 = fill(1);
      for (let y = 0; y < 8; y++) {
        set(p2, 2, y, 2);
        set(p2, 5, y, 3);
      }
      set(p2, 2, (f9 + v) % 8, 3);
      return p2;
    },
    grate: () => {
      const p2 = fill(2);
      for (let i = 0; i < 8; i += 2) for (let j = 0; j < 8; j++) {
        set(p2, i, j, 1);
        set(p2, j, i, 1);
      }
      set(p2, 1, 1, 3);
      set(p2, 5, 5, 3);
      return p2;
    },
    machine: (r, v, f9) => {
      const p2 = fill(2);
      for (let x = 0; x < 8; x++) {
        set(p2, x, 0, 1);
        set(p2, x, 7, 1);
      }
      set(p2, 2, 3, (f9 + v) % 3 === 0 ? 3 : 1);
      set(p2, 5, 3, (f9 + v) % 3 === 1 ? 3 : 1);
      for (let x = 1; x < 7; x++) set(p2, x, 5, 1);
      return p2;
    },
    circuit: (r) => {
      const p2 = fill(2);
      let x = r.int(0, 7), y = 0;
      while (y < 8) {
        set(p2, x, y, 3);
        if (r.chance(0.4)) x = Math.max(0, Math.min(7, x + (r.chance(0.5) ? 1 : -1)));
        else y++;
      }
      set(p2, r.int(0, 7), r.int(0, 7), 1);
      return p2;
    },
    glass: (r, v) => {
      const p2 = fill(2);
      for (let i = 0; i < 8; i++) set(p2, (i + v) % 8, i, 3);
      set(p2, 0, 0, 1);
      set(p2, 7, 7, 1);
      return p2;
    },
    coins: (r) => {
      const p2 = fill(2);
      for (let i = 0; i < 6; i++) {
        const x = r.int(0, 6), y = r.int(0, 6);
        set(p2, x, y, 3);
        set(p2, x + 1, y, 3);
        set(p2, x, y + 1, 1);
      }
      return p2;
    },
    bone: (r) => {
      const p2 = fill(2);
      for (let x = 0; x < 8; x++) {
        set(p2, x, 2, 3);
        set(p2, x, 5, 3);
      }
      for (let y = 0; y < 8; y++) {
        set(p2, 1, y, 1);
        set(p2, 6, y, 1);
      }
      speck(p2, r, 1, 0.03);
      return p2;
    }
  };
  function beltTile(f9, dx, dy) {
    const p2 = fill(2);
    const o = f9 * 2 % 8;
    for (let i = 0; i < 8; i++) {
      if (dx === 0) {
        set(p2, 0, i, 1);
        set(p2, 7, i, 1);
      } else {
        set(p2, i, 0, 1);
        set(p2, i, 7, 1);
      }
    }
    for (let k = 0; k < 2; k++) {
      const t = (o + k * 4) % 8;
      for (let j = -2; j <= 2; j++) {
        const a = 4 + j, b2 = t - Math.abs(j) + 1;
        if (dy !== 0) set(p2, a, dy > 0 ? b2 : 7 - b2, 3);
        else set(p2, dx > 0 ? b2 : 7 - b2, a, 3);
      }
    }
    return p2;
  }
  var TILE_KINDS = Object.keys(TILES);
  function genTile(kind, v, f9) {
    const g = TILES[kind] ?? TILES.ground;
    return g(new Rng(hash(kind) + v * 7919), v, f9);
  }
  function genSprite(s, frame = 0) {
    const n = s.n ?? 1;
    let big;
    switch (s.g) {
      case "monster":
        big = genMonster(s.seed ?? "x", s.o?.shape ?? "blob", n);
        break;
      case "human":
        big = genHumanoid(s.seed ?? "x", s.o ?? {});
        break;
      case "beast":
        big = genBeast(s.o?.kind ?? "cat");
        break;
      case "prop":
        big = genProp(s.o?.kind ?? "chest");
        break;
      case "tile":
        big = genTile(s.o?.kind ?? "ground", +(s.o?.v ?? 0), frame);
        break;
      default:
        big = genMonster(s.seed ?? "x", "blob", n);
    }
    if (n === 1) return [big];
    const out = [];
    const size = 8 * n;
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const p2 = blank();
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p2[y * 8 + x] = big[(ty * 8 + y) * size + tx * 8 + x];
      out.push(p2);
    }
    return out;
  }

  // src/core/gfx.ts
  var SW = 160;
  var SH = 160;
  var TEXT_CODES = {
    r: "r3",
    y: "y2",
    o: "o3",
    g: "e3",
    c: "c3",
    b: "b3",
    m: "m3",
    w: "w",
    n: "g2",
    k: "k",
    d: "g1"
  };
  function hexOf(c) {
    return c[0] === "#" ? c : COLORS[c];
  }
  function makeCanvas(w, h2) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h2;
    return c;
  }
  var Gfx = class {
    constructor(canvas2) {
      __publicField(this, "canvas", canvas2);
      __publicField(this, "ctx");
      __publicField(this, "grey", false);
      __publicField(this, "spriteCache", /* @__PURE__ */ new Map());
      __publicField(this, "glyphCache", /* @__PURE__ */ new Map());
      __publicField(this, "ox", 0);
      __publicField(this, "oy", 0);
      this.ctx = canvas2.getContext("2d");
      this.ctx.imageSmoothingEnabled = false;
    }
    col(c, grey = this.grey) {
      const h2 = hexOf(c);
      return grey ? greyHex(h2) : h2;
    }
    clear(c = "k") {
      this.ctx.fillStyle = hexOf(c);
      this.ctx.fillRect(0, 0, SW, SH);
    }
    rect(x, y, w, h2, c, grey = false) {
      this.ctx.fillStyle = this.col(c, grey);
      this.ctx.fillRect(Math.round(x + this.ox), Math.round(y + this.oy), Math.round(w), Math.round(h2));
    }
    rectO(x, y, w, h2, c) {
      this.rect(x, y, w, 1, c);
      this.rect(x, y + h2 - 1, w, 1, c);
      this.rect(x, y, 1, h2, c);
      this.rect(x + w - 1, y, 1, h2, c);
    }
    box(x, y, w, h2, border = "g3", fill2 = "k") {
      this.rect(x + 1, y + 1, w - 2, h2 - 2, fill2);
      this.rect(x + 1, y, w - 2, 1, border);
      this.rect(x + 1, y + h2 - 1, w - 2, 1, border);
      this.rect(x, y + 1, 1, h2 - 2, border);
      this.rect(x + w - 1, y + 1, 1, h2 - 2, border);
    }
    bar(x, y, w, h2, frac, c, bg = "ink") {
      this.rect(x, y, w, h2, bg);
      const fw = Math.max(0, Math.min(w, Math.round(w * frac)));
      if (fw > 0) this.rect(x, y, fw, h2, c);
    }
    alpha(a, fn) {
      const prev = this.ctx.globalAlpha;
      this.ctx.globalAlpha = a;
      fn();
      this.ctx.globalAlpha = prev;
    }
    overlay(c, a) {
      if (a <= 0) return;
      this.alpha(Math.min(1, a), () => {
        this.ctx.fillStyle = hexOf(c);
        this.ctx.fillRect(0, 0, SW, SH);
      });
    }
    renderPix(p2, pal) {
      const c = makeCanvas(8, 8);
      const x = c.getContext("2d");
      const img = x.createImageData(8, 8);
      for (let i = 0; i < 64; i++) {
        const v = p2[i];
        if (!v) continue;
        const n = parseInt(pal[v - 1].slice(1), 16);
        img.data[i * 4] = n >> 16 & 255;
        img.data[i * 4 + 1] = n >> 8 & 255;
        img.data[i * 4 + 2] = n & 255;
        img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      return c;
    }
    tiles(spec, frame = 0, grey = false, flash) {
      const key = specKey(spec) + "#" + frame + (grey ? "g" : "") + (flash ?? "");
      let t = this.spriteCache.get(key);
      if (!t) {
        const pal = spec.pal.map((c) => {
          const h2 = hexOf(flash ?? c);
          return grey ? greyHex(h2) : h2;
        });
        t = genSprite(spec, frame).map((p2) => this.renderPix(p2, pal));
        this.spriteCache.set(key, t);
      }
      return t;
    }
    sprite(spec, x, y, o = {}) {
      const n = spec.n ?? 1;
      const s = o.scale ?? 1;
      const grey = o.grey ?? this.grey;
      if (o.dissolve && o.dissolve > 0) {
        this.dissolveSprite(spec, x, y, s, o.dissolve, grey, o.seed ?? 1);
        return;
      }
      const t = this.tiles(spec, o.frame ?? 0, grey, o.flash);
      const ctx = this.ctx;
      for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
        const c = t[ty * n + tx];
        const dx = Math.round(x + this.ox + tx * 8 * s);
        const dy = Math.round(y + this.oy + ty * 8 * s);
        if (o.flip) {
          ctx.save();
          ctx.translate(dx + 8 * s, dy);
          ctx.scale(-1, 1);
          ctx.drawImage(c, 0, 0, 8 * s, 8 * s);
          ctx.restore();
        } else ctx.drawImage(c, dx, dy, 8 * s, 8 * s);
      }
    }
    dissolveSprite(spec, x, y, s, amount, grey, seed) {
      const n = spec.n ?? 1;
      const grids = genSprite(spec, 0);
      const pal = spec.pal.map((c) => grey ? greyHex(hexOf(c)) : hexOf(c));
      for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
        const p2 = grids[ty * n + tx];
        for (let i = 0; i < 64; i++) {
          if (!p2[i]) continue;
          const h2 = (i * 2654435761 + seed * 97 + tx * 13 + ty * 7 >>> 0) % 1e3 / 1e3;
          if (h2 < amount) continue;
          const px = x + (tx * 8 + i % 8) * s;
          const py = y + (ty * 8 + Math.floor(i / 8)) * s - (h2 < amount + 0.2 ? amount * 6 : 0);
          this.ctx.fillStyle = pal[p2[i] - 1];
          this.ctx.fillRect(Math.round(px + this.ox), Math.round(py + this.oy), s, s);
        }
      }
    }
    glyph(ch, color) {
      const key = ch + color;
      let c = this.glyphCache.get(key);
      if (c) return c;
      const g = GLYPHS.get(ch) ?? GLYPHS.get("?");
      if (!g) return null;
      c = makeCanvas(Math.max(1, g.w), 6);
      const x = c.getContext("2d");
      x.fillStyle = color;
      g.rows.forEach((row, y) => {
        for (let i = 0; i < row.length; i++) if (row[i] === "#") x.fillRect(i, y, 1, 1);
      });
      this.glyphCache.set(key, c);
      return c;
    }
    /** Draws text. '^' plus a code letter switches color. Returns the end x. */
    text(s, x, y, color = "w", maxChars = Infinity) {
      let cx = x;
      let col = hexOf(color);
      const base2 = col;
      let drawn = 0;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === "^") {
          const code = s[i + 1];
          col = code === "0" ? base2 : hexOf(TEXT_CODES[code] ?? "w");
          i++;
          continue;
        }
        if (drawn >= maxChars) break;
        drawn++;
        if (ch === " ") {
          cx += 3;
          continue;
        }
        const g = this.glyph(ch, col);
        if (g) this.ctx.drawImage(g, Math.round(cx + this.ox), Math.round(y + this.oy));
        cx += (GLYPHS.get(ch)?.w ?? 3) + 1;
      }
      return cx;
    }
    textC(s, cx, y, color = "w") {
      this.text(s, Math.round(cx - textW(s) / 2), y, color);
    }
    textR(s, rx, y, color = "w") {
      this.text(s, rx - textW(s), y, color);
    }
    /** Draws the right-pointing menu cursor. */
    cursor(x, y, t = 0) {
      const bob = Math.floor(t / 12) % 2;
      this.text("`", x - bob, y, "w");
    }
  };

  // src/core/input.ts
  var KEYMAP = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    KeyZ: "a",
    Space: "a",
    Enter: "a",
    NumpadEnter: "a",
    KeyX: "b",
    Escape: "b",
    Backspace: "b",
    KeyC: "c",
    ShiftLeft: "c",
    ShiftRight: "c",
    KeyM: "mute",
    Backquote: "debug"
  };
  var ALL = ["up", "down", "left", "right", "a", "b", "c", "mute", "debug"];
  var Input = class {
    constructor() {
      __publicField(this, "down", /* @__PURE__ */ new Set());
      __publicField(this, "held", /* @__PURE__ */ new Map());
      __publicField(this, "pressedNow", /* @__PURE__ */ new Set());
      __publicField(this, "queue", []);
      __publicField(this, "onAny", null);
    }
    attach(target) {
      target.addEventListener("keydown", (e) => {
        const b2 = KEYMAP[e.code];
        if (!b2) return;
        e.preventDefault();
        if (!this.down.has(b2)) this.queue.push(b2);
        this.down.add(b2);
        this.onAny?.();
      });
      target.addEventListener("keyup", (e) => {
        const b2 = KEYMAP[e.code];
        if (!b2) return;
        e.preventDefault();
        this.down.delete(b2);
      });
      target.addEventListener("blur", () => this.down.clear());
    }
    /** Call once per frame before updating scenes. */
    tick() {
      this.pressedNow.clear();
      for (const b2 of this.queue) this.pressedNow.add(b2);
      this.queue.length = 0;
      for (const b2 of ALL) {
        if (this.down.has(b2)) this.held.set(b2, (this.held.get(b2) ?? 0) + 1);
        else this.held.set(b2, 0);
      }
    }
    isDown(b2) {
      return this.down.has(b2) || this.pressedNow.has(b2);
    }
    pressed(b2) {
      return this.pressedNow.has(b2);
    }
    /** True on press and then on a repeat cadence while held. */
    repeat(b2) {
      if (this.pressedNow.has(b2)) return true;
      const h2 = this.held.get(b2) ?? 0;
      return h2 > 14 && (h2 - 14) % 4 === 0;
    }
    consume() {
      this.pressedNow.clear();
    }
  };

  // src/core/audio.ts
  var MAJ_PENTA = [0, 2, 4, 7, 9];
  var MIN_PENTA = [0, 3, 5, 7, 10];
  var DORIAN = [0, 2, 3, 5, 7, 9, 10];
  var MINOR = [0, 2, 3, 5, 7, 8, 10];
  var LYDIAN = [0, 2, 4, 6, 7, 9, 11];
  var WHOLE = [0, 2, 4, 6, 8, 10];
  var SONGS = {
    title: { bpm: 84, root: 57, scale: LYDIAN, prog: [0, 3, 4, 2], lead: "triangle", bass: "sine", mood: "calm", seed: "title" },
    village: { bpm: 100, root: 60, scale: MAJ_PENTA, prog: [0, 3, 1, 4], lead: "square", bass: "triangle", mood: "bright", seed: "edgewick" },
    wood: { bpm: 76, root: 57, scale: DORIAN, prog: [0, 5, 3, 4], lead: "triangle", bass: "sine", mood: "dark", seed: "hollow" },
    battle: { bpm: 150, root: 57, scale: MINOR, prog: [0, 5, 3, 4], lead: "square", bass: "sawtooth", mood: "tense", seed: "battle" },
    boss: { bpm: 160, root: 52, scale: MINOR, prog: [0, 1, 5, 4], lead: "sawtooth", bass: "square", mood: "tense", seed: "boss" },
    marsh: { bpm: 96, root: 62, scale: MIN_PENTA, prog: [0, 2, 3, 1], lead: "square", bass: "triangle", mood: "calm", seed: "fizz" },
    town: { bpm: 108, root: 65, scale: MAJ_PENTA, prog: [0, 4, 3, 1], lead: "triangle", bass: "triangle", mood: "bright", seed: "prismouth" },
    church: { bpm: 70, root: 55, scale: DORIAN, prog: [0, 3, 0, 4], lead: "sine", bass: "triangle", mood: "dark", seed: "carillon" },
    desert: { bpm: 90, root: 58, scale: WHOLE, prog: [0, 2, 4, 1], lead: "triangle", bass: "sine", mood: "calm", seed: "hourglass" },
    market: { bpm: 120, root: 63, scale: DORIAN, prog: [0, 3, 4, 3], lead: "square", bass: "sawtooth", mood: "bright", seed: "undermarket" },
    sky: { bpm: 112, root: 60, scale: LYDIAN, prog: [0, 1, 4, 5], lead: "triangle", bass: "triangle", mood: "bright", seed: "tether" },
    loom: { bpm: 80, root: 50, scale: WHOLE, prog: [0, 1, 0, 3], lead: "sine", bass: "sawtooth", mood: "dark", seed: "loom" },
    sad: { bpm: 64, root: 57, scale: MINOR, prog: [0, 5, 2, 4], lead: "triangle", bass: "sine", mood: "calm", seed: "sad" },
    final: { bpm: 168, root: 50, scale: MINOR, prog: [0, 6, 5, 4], lead: "sawtooth", bass: "square", mood: "tense", seed: "final" },
    victory: { bpm: 132, root: 60, scale: MAJ_PENTA, prog: [0, 3, 4, 0], lead: "square", bass: "triangle", mood: "bright", seed: "win" }
  };
  function midiHz(m2) {
    return 440 * Math.pow(2, (m2 - 69) / 12);
  }
  var Audio = class {
    constructor() {
      __publicField(this, "ctx", null);
      __publicField(this, "master", null);
      __publicField(this, "muted", false);
      __publicField(this, "song", null);
      __publicField(this, "timer", null);
      __publicField(this, "nextTime", 0);
      __publicField(this, "step", 0);
      __publicField(this, "pattern", null);
      __publicField(this, "noise", null);
      try {
        this.muted = localStorage.getItem("duotone.mute") === "1";
      } catch {
      }
    }
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        if (this.song) {
          const s = this.song;
          this.song = null;
          this.play(s);
        }
      } catch {
        this.ctx = null;
      }
    }
    toggleMute() {
      this.muted = !this.muted;
      try {
        localStorage.setItem("duotone.mute", this.muted ? "1" : "0");
      } catch {
      }
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    }
    tone(freq, dur, wave, vol, when = 0, slide = 0) {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    hiss(dur, vol, when = 0, hp = 800) {
      if (!this.ctx || !this.master || !this.noise) return;
      const t = this.ctx.currentTime + when;
      const s = this.ctx.createBufferSource();
      s.buffer = this.noise;
      const f9 = this.ctx.createBiquadFilter();
      f9.type = "highpass";
      f9.frequency.value = hp;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      s.connect(f9).connect(g).connect(this.master);
      s.start(t);
      s.stop(t + dur + 0.02);
    }
    sfx(name) {
      if (!this.ctx) return;
      switch (name) {
        case "move":
          this.tone(880, 0.04, "square", 0.05);
          break;
        case "ok":
          this.tone(660, 0.06, "square", 0.07);
          this.tone(990, 0.08, "square", 0.06, 0.05);
          break;
        case "back":
          this.tone(440, 0.07, "square", 0.06, 0, 0.7);
          break;
        case "bump":
          this.tone(110, 0.06, "square", 0.05);
          break;
        case "blip":
          this.tone(1200 + Math.random() * 200, 0.015, "square", 0.025);
          break;
        case "hit":
          this.hiss(0.12, 0.25, 0, 600);
          this.tone(180, 0.1, "square", 0.1, 0, 0.5);
          break;
        case "crit":
          this.hiss(0.2, 0.35, 0, 300);
          this.tone(300, 0.2, "sawtooth", 0.12, 0, 0.3);
          break;
        case "clash":
          this.tone(1320, 0.08, "square", 0.08);
          this.tone(1760, 0.12, "square", 0.07, 0.06);
          this.hiss(0.1, 0.2, 0, 2e3);
          break;
        case "blend":
          this.tone(220, 0.15, "triangle", 0.1, 0, 0.8);
          break;
        case "magic":
          for (let i = 0; i < 4; i++) this.tone(600 + i * 200, 0.08, "triangle", 0.06, i * 0.04);
          break;
        case "heal":
          for (let i = 0; i < 5; i++) this.tone(523 * Math.pow(1.122, i * 2), 0.12, "triangle", 0.07, i * 0.05);
          break;
        case "buff":
          this.tone(400, 0.2, "square", 0.06, 0, 2);
          break;
        case "debuff":
          this.tone(600, 0.25, "square", 0.06, 0, 0.4);
          break;
        case "die":
          this.tone(300, 0.4, "square", 0.08, 0, 0.2);
          this.hiss(0.4, 0.12, 0, 200);
          break;
        case "break":
          this.hiss(0.3, 0.4, 0, 1500);
          this.tone(1e3, 0.3, "square", 0.1, 0, 0.3);
          break;
        case "lvl":
          [0, 4, 7, 12].forEach((n, i) => this.tone(midiHz(72 + n), 0.15, "square", 0.07, i * 0.08));
          break;
        case "enc":
          for (let i = 0; i < 6; i++) this.tone(200 + i * 120, 0.05, "sawtooth", 0.06, i * 0.03);
          break;
        case "door":
          this.tone(150, 0.1, "triangle", 0.1);
          this.tone(100, 0.12, "triangle", 0.1, 0.08);
          break;
        case "chest":
          [0, 7, 12].forEach((n, i) => this.tone(midiHz(76 + n), 0.1, "square", 0.06, i * 0.07));
          break;
        case "save":
          [0, 4, 7, 11, 14].forEach((n, i) => this.tone(midiHz(67 + n), 0.3, "triangle", 0.06, i * 0.1));
          break;
        case "coin":
          this.tone(1568, 0.05, "square", 0.06);
          this.tone(2093, 0.12, "square", 0.06, 0.05);
          break;
        case "tick":
          this.tone(2e3, 0.02, "square", 0.04);
          break;
        case "flee":
          for (let i = 0; i < 5; i++) this.tone(800 - i * 100, 0.05, "square", 0.05, i * 0.04);
          break;
        case "shift":
          this.tone(300, 0.3, "sine", 0.1, 0, 3);
          this.tone(900, 0.3, "sine", 0.06, 0.1, 0.33);
          break;
        case "bell":
          [0, 12, 19].forEach((n) => this.tone(midiHz(60 + n), 1.2, "sine", 0.08));
          break;
        case "miss":
          this.tone(500, 0.08, "triangle", 0.05, 0, 1.5);
          break;
      }
    }
    build(s) {
      const r = new Rng(hash(s.seed));
      const deg = (d, oct = 0) => {
        const n = s.scale.length;
        const o = Math.floor(d / n);
        return s.root + s.scale[(d % n + n) % n] + 12 * (o + oct);
      };
      const motif = () => {
        const m2 = [];
        let d = r.int(2, 5);
        for (let i = 0; i < 8; i++) {
          if (r.chance(s.mood === "calm" ? 0.35 : 0.2)) {
            m2.push(null);
            continue;
          }
          d += r.pick([-2, -1, -1, 0, 1, 1, 2, 3]);
          d = Math.max(0, Math.min(9, d));
          m2.push(d);
        }
        return m2;
      };
      const a = motif();
      const b2 = motif();
      const lead = [];
      const bass = [];
      const arp = [];
      const form = [a, a, b2, a];
      form.forEach((m2, bar) => {
        const chordRoot = s.prog[bar % s.prog.length];
        m2.forEach((d, i) => {
          lead.push(d === null ? null : deg(d + chordRoot, 1));
          bass.push(deg(chordRoot, -1));
          arp.push(deg(chordRoot + [0, 2, 4, 2][i % 4], 0));
        });
      });
      this.pattern = { lead, bass, arp };
    }
    play(name) {
      if (this.song === name) return;
      this.song = name;
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
      const s = SONGS[name];
      if (!s || !this.ctx) return;
      this.build(s);
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      const stepDur = 60 / s.bpm / 2;
      this.timer = window.setInterval(() => {
        if (!this.ctx || !this.pattern) return;
        while (this.nextTime < this.ctx.currentTime + 0.25) {
          const i = this.step % this.pattern.lead.length;
          const when = this.nextTime - this.ctx.currentTime;
          const ln = this.pattern.lead[i];
          if (ln !== null) this.tone(midiHz(ln), stepDur * 0.9, s.lead, s.lead === "sawtooth" ? 0.025 : 0.035, when);
          if (i % 2 === 0) this.tone(midiHz(this.pattern.bass[i]), stepDur * 1.8, s.bass, s.bass === "sine" ? 0.08 : 0.04, when);
          if (s.mood !== "calm" || i % 2 === 1) this.tone(midiHz(this.pattern.arp[i]), stepDur * 0.5, "triangle", 0.02, when);
          if (s.mood === "tense" && i % 4 === 0) this.hiss(0.05, 0.05, when, 3e3);
          this.nextTime += stepDur;
          this.step++;
        }
      }, 50);
    }
    stop() {
      this.song = null;
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  };

  // src/data/members.ts
  var human = (seed, pal, o) => ({ g: "human", seed, pal, o });
  var beast = (kind, pal) => ({ g: "beast", pal, o: { kind } });
  var MEMBERS = {
    wick: {
      id: "wick",
      name: "Wick",
      title: "Lamplighter",
      pal: ["k", "o2", "o2"],
      sprite: human("wick", ["k", "o2", "o2"], { head: "hair", torso: "arms", legs: "legs", held: "lamp" }),
      mult: { hp: 1, ink: 1, str: 1.05, def: 1, mnd: 1, spd: 1 },
      learn: [[1, "kindle"], [3, "lampsweep"], [9, "wickflare"], [13, "snuff"], [17, "beacon"], [23, "lighthouse"]],
      weapon: "pole",
      bio: "A Duotone printed with black and amber only. Keeps the Edge Lamps."
    },
    nona: {
      id: "nona",
      name: "Nona",
      title: "Maintenance Cat",
      pal: ["k", "c2", "w"],
      sprite: beast("nona", ["k", "c2", "w"]),
      mult: { hp: 0.9, ink: 1.3, str: 0.8, def: 0.9, mnd: 1.2, spd: 1.15 },
      learn: [[1, "patch"], [1, "diagnose"], [1, "ninth_life"], [5, "purr_loop"], [8, "static_claw"], [12, "firmware"], [16, "cleanse"], [21, "overclock"]],
      weapon: "claw",
      bio: "A nine-tailed drone that fell from the Loom. Each tail is a spool of reserve ink."
    },
    tint: {
      id: "tint",
      name: "Tint",
      title: "Hue-Witch",
      pal: ["k", "m2", "e3"],
      sprite: human("tint", ["k", "m2", "e3"], { head: "bubble", torso: "robe", legs: "skirt", held: "brush" }),
      mult: { hp: 0.85, ink: 1.2, str: 0.8, def: 0.85, mnd: 1.25, spd: 1.1 },
      learn: [[1, "load"], [1, "daub"], [1, "splash"], [10, "primer"], [13, "wash"], [17, "gallery"], [24, "spectrum"]],
      weapon: "brush",
      bio: "Rides a paintbrush and paints over whatever the grey touches."
    },
    brask: {
      id: "brask",
      name: "Brask",
      title: "Moth Knight",
      pal: ["k", "b2", "y3"],
      sprite: human("brask", ["k", "b2", "y3"], { head: "helm", torso: "armor", legs: "stance", held: "sword" }),
      mult: { hp: 1.35, ink: 0.75, str: 1.15, def: 1.35, mnd: 0.6, spd: 0.8 },
      learn: [[1, "crush"], [1, "moth_curtain"], [13, "swarm"], [15, "carapace"], [19, "lance"], [24, "molt"]],
      weapon: "blade",
      bio: "Empty templar armor full of moths. The moths follow Wick's lamp."
    },
    tock: {
      id: "tock",
      name: "Tock",
      title: "Backward Monk",
      pal: ["k", "e2", "r3"],
      sprite: beast("monk", ["k", "e2", "r3"]),
      mult: { hp: 0.95, ink: 1.1, str: 0.95, def: 0.95, mnd: 1.05, spd: 1.3 },
      learn: [[1, "tick"], [1, "delay"], [1, "hasten"], [17, "rewind"], [21, "stopwatch"], [25, "paradox"]],
      weapon: "hand",
      bio: "A clockwork monk who lives backward. He met you at the end of his life."
    },
    vend: {
      id: "vend",
      name: "VEND",
      title: "Coin Golem",
      pal: ["k", "r2", "c3"],
      sprite: beast("vend", ["k", "r2", "c3"]),
      mult: { hp: 1.2, ink: 0.3, str: 1.1, def: 1.2, mnd: 0.9, spd: 0.85 },
      learn: [[1, "coin_shot"], [1, "dispense"], [1, "jackpot"], [21, "buyout"], [23, "restock"], [26, "tariff"]],
      weapon: "slot",
      bio: "A vending machine who wants to buy his own freedom. Pays for everything."
    },
    mirrow: {
      id: "mirrow",
      name: "Mirrow",
      title: "Glass Captain",
      pal: ["k", "b3", "w"],
      sprite: beast("mirror", ["k", "b3", "w"]),
      mult: { hp: 1, ink: 1.1, str: 1, def: 1, mnd: 1.1, spd: 1.1 },
      learn: [[1, "reflect"], [1, "shard"], [1, "glass_guard"], [26, "silver_back"], [28, "invert"]],
      weapon: "glass",
      bio: "A reflection that left its mirror. Captains a skiff on the cloud sea."
    },
    nil: {
      id: "nil",
      name: "Nil",
      title: "Blank",
      pal: ["k", "g2", "g3"],
      sprite: beast("blank", ["k", "g2", "g3"]),
      mult: { hp: 1.1, ink: 1.2, str: 1, def: 1, mnd: 1.05, spd: 1 },
      learn: [[1, "blank_stare"], [1, "void_touch"], [1, "nullify"], [30, "unprint"]],
      weapon: "none",
      bio: "A Blank who never had a color. Learns what hits it."
    }
  };
  var MEMBER_ORDER = ["wick", "nona", "tint", "brask", "tock", "vend", "mirrow", "nil"];
  function memberHues(id) {
    const m2 = MEMBERS[id];
    if (id === "wick") return ["Y", "N"];
    return huesOf(m2.pal);
  }
  function baseStats(lvl) {
    const l = lvl - 1;
    return {
      hp: 34 + 8.5 * l,
      ink: 12 + 1.6 * l,
      str: 9 + 1.7 * l,
      def: 7 + 1.35 * l,
      mnd: 9 + 1.7 * l,
      spd: 9 + 0.8 * l
    };
  }
  function statsAt(id, lvl) {
    const b2 = baseStats(lvl);
    const m2 = MEMBERS[id].mult;
    return {
      hp: Math.round(b2.hp * m2.hp),
      ink: Math.round(b2.ink * m2.ink),
      str: Math.round(b2.str * m2.str),
      def: Math.round(b2.def * m2.def),
      mnd: Math.round(b2.mnd * m2.mnd),
      spd: Math.round(b2.spd * m2.spd)
    };
  }
  function xpToNext(lvl) {
    return Math.round(12 * Math.pow(lvl, 1.55));
  }
  function skillsAt(id, lvl) {
    return MEMBERS[id].learn.filter(([l]) => l <= lvl).map(([, s]) => s);
  }

  // src/data/items.ts
  var I = [
    { id: "tallow", name: "Tallow Drop", desc: "Mends 45 HP.", price: 12, use: { target: "ally", heal: 45 }, battle: true, field: true },
    { id: "candle", name: "Wax Candle", desc: "Mends 120 HP.", price: 40, use: { target: "ally", heal: 120 }, battle: true, field: true },
    { id: "honey", name: "Moth Honey", desc: "Mends 300 HP.", price: 110, use: { target: "ally", heal: 300 }, battle: true, field: true },
    { id: "chorus", name: "Chorus Tin", desc: "Mends 90 HP to every ally.", price: 150, use: { target: "allies", heal: 90 }, battle: true, field: true },
    { id: "ink_vial", name: "Ink Vial", desc: "Restores 12 ink.", price: 28, use: { target: "ally", ink: 12 }, battle: true, field: true },
    { id: "ink_well", name: "Ink Well", desc: "Restores 40 ink.", price: 95, use: { target: "ally", ink: 40 }, battle: true, field: true },
    { id: "relight", name: "Relight", desc: "Revives a fallen ally with 40% HP.", price: 70, use: { target: "ko", revive: 0.4 }, battle: true, field: true },
    { id: "pin", name: "Grounding Pin", desc: "Clears ailments from one ally.", price: 15, use: { target: "ally", cure: true }, battle: true, field: true },
    { id: "prism", name: "Prism Shard", desc: "Throw a random hue at every foe.", price: 45, use: { target: "foes", dmg: 38, hue: "rand" }, battle: true },
    { id: "paint_bomb", name: "Paint Bomb", desc: "Violet splash on every foe.", price: 80, use: { target: "foes", dmg: 70, hue: "M" }, battle: true },
    { id: "clock_tea", name: "Clock Tea", desc: "The drinker acts next.", price: 60, use: { target: "ally", fx: "hasten" }, battle: true },
    // Key items
    { id: "lampsap", name: "Lampsap", desc: "Glowing sap from the Antenna Tree.", price: 0, key: true },
    { id: "lens_shard", name: "Lens Shard", desc: "A piece of the Prismouth Lens. It points at the sky.", price: 0, key: true },
    { id: "seal", name: "Pilgrim Seal", desc: "Grants passage to the Tether gate.", price: 0, key: true },
    { id: "sundial", name: "Pocket Sundial", desc: "Press C to shift between past and present.", price: 0, key: true },
    { id: "ticket", name: "Lift Ticket", desc: "One ride up the Tether. Non-refundable.", price: 0, key: true },
    { id: "ninth_spool", name: "Ninth Spool", desc: "Nona's last tail. It holds the Ninth Ink.", price: 0, key: true },
    { id: "bell_clapper", name: "Bell Clapper", desc: "A clapper from a silenced bell.", price: 0, key: true },
    { id: "gran_jar", name: "Jar of Umber", desc: "A glass jar of warm brown light, labeled UMBER, EDGEWICK. It is Gran.", price: 0, key: true },
    { id: "feed_horn", name: "Feed Horn", desc: "A dented metal cone. It hums when you point it at the sky.", price: 0, key: true }
  ];
  var WEAPON_TYPES = {
    pole: { stat: "str", names: ["Lamp Pole", "Iron Hook", "Brass Crook", "Signal Pole", "Beacon Staff", "Neon Crook", "Edge Pole"] },
    claw: { stat: "mnd", names: ["Claw Caps", "Solder Claws", "Diode Claws", "Relay Claws", "Servo Claws", "Quartz Claws", "Loom Claws"] },
    brush: { stat: "mnd", names: ["Twig Brush", "Sable Brush", "Chrome Brush", "Prism Brush", "Comet Brush", "Aurora Brush", "Palette Knife"] },
    blade: { stat: "str", names: ["Rust Blade", "Pew Blade", "Chapel Sword", "Mothsteel", "Relic Edge", "Halo Edge", "Lantern Blade"] },
    hand: { stat: "str", names: ["Prayer Beads", "Brass Beads", "Gear Beads", "Hour Beads", "Epoch Beads", "Aeon Beads", "Zero Beads"] },
    slot: { stat: "str", names: ["Tin Slot", "Copper Slot", "Silver Slot", "Gold Slot", "Platinum Slot", "Moonstone Slot", "Jackpot Slot"] },
    glass: { stat: "mnd", names: ["Hand Mirror", "Cut Glass", "Lens Pane", "Silvered Pane", "Two-Way Pane", "Funhouse Pane", "Infinite Pane"] },
    none: { stat: "mnd", names: ["Blank Mask", "Chalk Mask", "Ash Mask", "Pale Mask", "Hollow Mask", "Null Mask", "Void Mask"] }
  };
  var WEAPON_POWER = [3, 8, 14, 21, 29, 38, 48];
  var WEAPON_PRICE = [0, 90, 260, 560, 1050, 1800, 3e3];
  for (const [type, w] of Object.entries(WEAPON_TYPES)) {
    w.names.forEach((name, t) => {
      const p2 = WEAPON_POWER[t];
      const eq = { slot: "weapon", type };
      if (w.stat === "str") eq.str = p2;
      else {
        eq.mnd = p2;
        eq.str = Math.round(p2 * 0.4);
      }
      I.push({ id: `${type}${t}`, name, desc: `${w.stat === "str" ? "Strength" : "Mind"} +${p2}.`, price: WEAPON_PRICE[t], equip: eq });
    });
  }
  var HUED = [
    ["blue_wick", "pole", 2, "B", "Blue Wick"],
    ["red_hook", "pole", 3, "R", "Red Hook"],
    ["violet_bristle", "brush", 2, "M", "Violet Bristle"],
    ["cyan_edge", "blade", 3, "C", "Cyan Edge"],
    ["green_hour", "hand", 4, "G", "Green Hour"],
    ["amber_slot", "slot", 4, "Y", "Amber Slot"],
    ["red_pane", "glass", 5, "R", "Red Pane"],
    ["green_mask", "none", 5, "G", "Green Mask"]
  ];
  for (const [id, type, t, hue, name] of HUED) {
    const p2 = Math.round(WEAPON_POWER[t] * 0.9);
    const stat = WEAPON_TYPES[type].stat;
    const eq = { slot: "weapon", type, hue };
    if (stat === "str") eq.str = p2;
    else {
      eq.mnd = p2;
      eq.str = Math.round(p2 * 0.4);
    }
    I.push({ id, name, desc: `Attacks become ${hue === "B" ? "blue" : hue === "R" ? "red" : hue === "M" ? "violet" : hue === "C" ? "cyan" : hue === "G" ? "green" : "amber"}. ${stat === "str" ? "Strength" : "Mind"} +${p2}.`, price: Math.round(WEAPON_PRICE[t] * 1.25), equip: eq });
  }
  I.push(
    { id: "wool_scarf", name: "Wool Scarf", desc: "Max HP +15%.", price: 120, equip: { slot: "charm", trait: "hp15" } },
    { id: "ink_ring", name: "Ink Ring", desc: "Max ink +10.", price: 150, equip: { slot: "charm", ink: 10 } },
    { id: "lucky_button", name: "Lucky Button", desc: "Critical hits happen twice as often.", price: 180, equip: { slot: "charm", trait: "crit" } },
    { id: "mothball", name: "Mothball", desc: "Immune to static.", price: 140, equip: { slot: "charm", trait: "nostatic" } },
    { id: "grey_ward", name: "Grey Ward", desc: "Immune to grey.", price: 300, equip: { slot: "charm", trait: "nogrey" } },
    { id: "hue_lens", name: "Hue Lens", desc: "Weakness hits deal 20% more.", price: 400, equip: { slot: "charm", trait: "clash" } },
    { id: "shell_pick", name: "Shell Pick", desc: "Weakness hits crack one more shell point.", price: 500, equip: { slot: "charm", trait: "breaker" } },
    { id: "metronome", name: "Metronome", desc: "Act first at the start of battle.", price: 600, equip: { slot: "charm", trait: "first" } },
    { id: "piggy", name: "Coin Pig", desc: "Gold from battles +25%.", price: 700, equip: { slot: "charm", trait: "gold" } },
    { id: "feather", name: "Kite Feather", desc: "Speed +4.", price: 800, equip: { slot: "charm", spd: 4 } },
    { id: "spool_charm", name: "Spare Spool", desc: "Regenerate 4% HP each turn.", price: 1200, equip: { slot: "charm", trait: "regen" } },
    { id: "iron_rind", name: "Iron Rind", desc: "Defense +10.", price: 900, equip: { slot: "charm", def: 10 } }
  );
  var ITEMS = Object.fromEntries(I.map((i) => [i.id, i]));

  // src/data/skills.ts
  var S = [
    // Basic actions
    { id: "attack", name: "Attack", desc: "A plain strike with your weapon.", kind: "phys", target: "foe", hue: "wpn", power: 1 },
    // Wick
    { id: "kindle", name: "Kindle", desc: "Amber flame on one foe.", kind: "mag", target: "foe", hue: "Y", power: 1.5, ink: 3 },
    { id: "lampsweep", name: "Lampsweep", desc: "Swing the lamp pole through every foe.", kind: "phys", target: "foes", hue: "wpn", power: 0.7, ink: 4 },
    { id: "wickflare", name: "Wickflare", desc: "Amber flame on every foe.", kind: "mag", target: "foes", hue: "Y", power: 1, ink: 7 },
    { id: "snuff", name: "Snuff", desc: "A heavy blow that cracks shells and may stun.", kind: "phys", target: "foe", hue: "wpn", power: 1.5, ink: 5, breakDmg: 1, status: { id: "stun", chance: 0.3, turns: 1 } },
    { id: "beacon", name: "Beacon", desc: "Raise every ally's strength and mind.", kind: "buff", target: "allies", ink: 8, stage: { stat: "str", d: 1 }, fx: "beacon" },
    { id: "lighthouse", name: "Lighthouse", desc: "A beam of amber on one foe.", kind: "mag", target: "foe", hue: "Y", power: 2.6, ink: 11 },
    { id: "ninth_ink", name: "Ninth Ink", desc: "Take a third hue for this battle. Your amber skills use it too.", kind: "util", target: "self", ink: 4, delay: 40, fx: "tricolor", mech: "tricolor" },
    { id: "trichrome", name: "Trichrome", desc: "Strike one foe with whichever of your hues hurts most.", kind: "mag", target: "foe", hue: "best", power: 2.8, ink: 12, breakDmg: 1, mech: "tricolor" },
    // Nona
    { id: "patch", name: "Patch", desc: "Mend one ally.", kind: "heal", target: "ally", power: 1.4, ink: 3, field: true },
    { id: "diagnose", name: "Diagnose", desc: "Read a foe and lower its defense.", kind: "debuff", target: "foe", ink: 2, delay: 60, stage: { stat: "def", d: -1 }, fx: "scan" },
    { id: "ninth_life", name: "Ninth Life", desc: "Spend a tail to revive a fallen ally.", kind: "heal", target: "ko", ink: 4, tails: 1, fx: "revive", power: 0.5, field: true },
    { id: "purr_loop", name: "Purr Loop", desc: "Every ally regenerates for three turns.", kind: "buff", target: "allies", ink: 6, status: { id: "regen", chance: 1, turns: 3 } },
    { id: "static_claw", name: "Static Claw", desc: "Cyan claws that may leave static.", kind: "phys", target: "foe", hue: "C", power: 1.3, ink: 3, status: { id: "static", chance: 0.4, turns: 3 } },
    { id: "firmware", name: "Firmware", desc: "Mend every ally.", kind: "heal", target: "allies", power: 0.9, ink: 9, field: true },
    { id: "cleanse", name: "Cleanse", desc: "Clear an ally's ailments and mend a little.", kind: "heal", target: "ally", power: 0.6, ink: 3, fx: "cleanse", field: true },
    { id: "overclock", name: "Overclock", desc: "Raise one ally's speed sharply.", kind: "buff", target: "ally", ink: 5, stage: { stat: "spd", d: 2 } },
    // Tint
    { id: "load", name: "Load Brush", desc: "Choose the hue on your brush. Quick.", kind: "util", target: "self", delay: 35, fx: "load" },
    { id: "daub", name: "Daub", desc: "Paint one foe with your loaded hue.", kind: "mag", target: "foe", hue: "loaded", power: 1.45, ink: 3 },
    { id: "splash", name: "Splash", desc: "Repaint a foe's first hue to your loaded hue.", kind: "debuff", target: "foe", ink: 3, delay: 70, fx: "paint" },
    { id: "primer", name: "Primer", desc: "Coat an ally's weapon in your loaded hue.", kind: "buff", target: "ally", ink: 4, delay: 70, fx: "prime" },
    { id: "wash", name: "Wash", desc: "Strip a foe's buffs and paint.", kind: "debuff", target: "foe", ink: 3, fx: "wash" },
    { id: "gallery", name: "Gallery", desc: "Paint every foe with your loaded hue.", kind: "mag", target: "foes", hue: "loaded", power: 1, ink: 8 },
    { id: "spectrum", name: "Spectrum", desc: "Six strokes of random hues at random foes.", kind: "mag", target: "rand", hue: "loaded", power: 0.5, hits: 6, ink: 10, fx: "spectrum" },
    // Brask
    { id: "crush", name: "Crush", desc: "A blow that cracks two shell points.", kind: "phys", target: "foe", hue: "wpn", power: 1.2, ink: 3, breakDmg: 2 },
    { id: "moth_curtain", name: "Moth Curtain", desc: "Draw every foe's attacks and raise defense.", kind: "buff", target: "self", ink: 4, status: { id: "taunt", chance: 1, turns: 3 }, stage: { stat: "def", d: 1 } },
    { id: "swarm", name: "Swarm", desc: "Amber moths strike three random foes.", kind: "phys", target: "rand", hue: "Y", power: 0.55, hits: 3, ink: 4 },
    { id: "carapace", name: "Carapace", desc: "Raise every ally's defense.", kind: "buff", target: "allies", ink: 6, stage: { stat: "def", d: 1 } },
    { id: "lance", name: "Blue Lance", desc: "A blue thrust through one foe.", kind: "phys", target: "foe", hue: "B", power: 1.8, ink: 5, breakDmg: 1 },
    { id: "molt", name: "Molt", desc: "Shed damage. Mend yourself and clear ailments.", kind: "heal", target: "self", power: 2.2, ink: 5, fx: "cleanse" },
    // Tock
    { id: "tick", name: "Tick", desc: "A quick jab. You act again sooner.", kind: "phys", target: "foe", hue: "wpn", power: 0.85, delay: 55 },
    { id: "delay", name: "Delay", desc: "Green hands push a foe later in the timeline.", kind: "mag", target: "foe", hue: "G", power: 0.8, ink: 4, push: 60 },
    { id: "hasten", name: "Hasten", desc: "An ally acts next.", kind: "buff", target: "ally", ink: 5, delay: 60, fx: "hasten" },
    { id: "rewind", name: "Rewind", desc: "Return an ally to the health they had at their last turn.", kind: "heal", target: "ally", ink: 5, fx: "rewind", power: 0.4 },
    { id: "stopwatch", name: "Stopwatch", desc: "Push every foe later in the timeline.", kind: "debuff", target: "foes", ink: 9, push: 40 },
    { id: "paradox", name: "Paradox", desc: "Red time-burn on one foe. You act much later.", kind: "mag", target: "foe", hue: "R", power: 2.4, ink: 6, delay: 170 },
    // VEND
    { id: "coin_shot", name: "Coin Shot", desc: "Fire coins at one foe. Costs gold.", kind: "phys", target: "foe", hue: "wpn", power: 2, gold: 1 },
    { id: "dispense", name: "Dispense", desc: "Vend a tonic to one ally. Costs gold.", kind: "heal", target: "ally", power: 1.5, gold: 1 },
    { id: "jackpot", name: "Jackpot", desc: "Spin three reels. Matching hues pay out damage.", kind: "phys", target: "foes", power: 1, gold: 2, fx: "jackpot" },
    { id: "buyout", name: "Buyout", desc: "Pay a foe to leave. You keep its reward.", kind: "util", target: "foe", gold: 4, fx: "buyout" },
    { id: "restock", name: "Restock", desc: "Refill every ally's ink a little. Costs gold.", kind: "heal", target: "allies", gold: 3, fx: "restock" },
    { id: "tariff", name: "Tariff", desc: "Coins rain on every foe. Costs gold.", kind: "phys", target: "foes", hue: "wpn", power: 1.1, gold: 2 },
    // Mirrow
    { id: "reflect", name: "Reflect", desc: "Repeat the last action anyone took, as your own.", kind: "util", target: "self", ink: 5, fx: "reflect" },
    { id: "glass_guard", name: "Glass Guard", desc: "The next spell aimed at an ally bounces back.", kind: "buff", target: "ally", ink: 4, delay: 70, status: { id: "mirror", chance: 1, turns: 4 } },
    { id: "shard", name: "Shard", desc: "Blue glass on one foe.", kind: "mag", target: "foe", hue: "B", power: 1.4, ink: 3 },
    { id: "invert", name: "Invert", desc: "Hit every foe with the opposite of its own first hue.", kind: "mag", target: "foes", hue: "invert", power: 1, ink: 10 },
    { id: "silver_back", name: "Silverback", desc: "Show a foe itself. It may stop to stare.", kind: "debuff", target: "foe", ink: 3, status: { id: "stun", chance: 0.6, turns: 1 } },
    // Nil
    { id: "blank_stare", name: "Blank Stare", desc: "Grey a foe. Its hues stop mattering.", kind: "debuff", target: "foe", ink: 3, status: { id: "grey", chance: 1, turns: 3 } },
    { id: "void_touch", name: "Void Touch", desc: "Colorless force on one foe.", kind: "mag", target: "foe", power: 1.6, ink: 4 },
    { id: "nullify", name: "Nullify", desc: "Undo a foe's buffs.", kind: "debuff", target: "foe", ink: 2, fx: "wash" },
    { id: "unprint", name: "Unprint", desc: "Grey every foe for two turns.", kind: "debuff", target: "foes", ink: 8, status: { id: "grey", chance: 1, turns: 2 } },
    // Items and link
    { id: "link", name: "Link", desc: "Two allies strike every foe together.", kind: "phys", target: "foes", power: 1, fx: "link", mech: "link" },
    // Enemy skills
    { id: "bite", name: "Bite", desc: "", kind: "phys", target: "foe", power: 1 },
    { id: "claw", name: "Claw", desc: "", kind: "phys", target: "foe", power: 1.15 },
    { id: "tackle", name: "Tackle", desc: "", kind: "phys", target: "foe", power: 1.3, delay: 120 },
    { id: "lint_howl", name: "Lint Howl", desc: "", kind: "debuff", target: "foes", stage: { stat: "def", d: -1 } },
    { id: "dust", name: "Dust", desc: "", kind: "debuff", target: "foe", stage: { stat: "str", d: -1 }, power: 0.5 },
    { id: "zap", name: "Zap", desc: "", kind: "mag", target: "foe", power: 0.9, status: { id: "static", chance: 0.5, turns: 3 } },
    { id: "drain", name: "Drain Color", desc: "", kind: "mag", target: "foe", power: 1, fx: "drain" },
    { id: "pinch", name: "Pinch", desc: "", kind: "phys", target: "foe", power: 0.8, hits: 2 },
    { id: "harden", name: "Harden", desc: "", kind: "buff", target: "self", stage: { stat: "def", d: 1 } },
    { id: "gather_dust", name: "Gather Dust", desc: "", kind: "util", target: "self", fx: "charge:dust_storm" },
    { id: "dust_storm", name: "Dust Storm", desc: "", kind: "mag", target: "foes", power: 1.6 },
    { id: "wing_buffet", name: "Wing Buffet", desc: "", kind: "phys", target: "foes", power: 0.75 },
    { id: "moth_kiss", name: "Grey Kiss", desc: "", kind: "mag", target: "foe", power: 1, status: { id: "grey", chance: 1, turns: 2 } },
    { id: "croak", name: "Croak", desc: "", kind: "mag", target: "foes", hue: "G", power: 0.6, status: { id: "static", chance: 0.25, turns: 3 } },
    { id: "crayon_jab", name: "Crayon Jab", desc: "", kind: "phys", target: "foe", hue: "R", power: 1.1 },
    { id: "peck", name: "Peck", desc: "", kind: "phys", target: "foe", hue: "C", power: 1.1 },
    { id: "broadcast", name: "Broadcast", desc: "", kind: "mag", target: "foes", hue: "C", power: 0.7 },
    { id: "glitch", name: "Glitch", desc: "", kind: "mag", target: "foe", hue: "M", power: 1.15 },
    { id: "ooze", name: "Ooze", desc: "", kind: "mag", target: "foe", hue: "B", power: 1.05, stage: { stat: "spd", d: -1 } },
    { id: "wisp_fire", name: "Wispfire", desc: "", kind: "mag", target: "foe", hue: "M", power: 1.2 },
    { id: "ink_squirt", name: "Ink Squirt", desc: "", kind: "mag", target: "foes", hue: "loaded", power: 0.85 },
    { id: "recolor_self", name: "Shift Hue", desc: "", kind: "util", target: "self", fx: "shift_hue", delay: 60 },
    { id: "tentacle", name: "Tentacle", desc: "", kind: "phys", target: "foe", hue: "loaded", power: 1.25 },
    { id: "steal_hue", name: "Steal Hue", desc: "", kind: "mag", target: "foe", power: 0.9, status: { id: "grey", chance: 1, turns: 2 } },
    { id: "toll", name: "Toll", desc: "", kind: "mag", target: "foes", hue: "Y", power: 0.7, status: { id: "stun", chance: 0.15, turns: 1 } },
    { id: "hymn", name: "Grey Hymn", desc: "", kind: "mag", target: "foes", power: 0.6, status: { id: "grey", chance: 0.5, turns: 2 } },
    { id: "hush", name: "Hush", desc: "", kind: "debuff", target: "foe", status: { id: "hush", chance: 1, turns: 2 } },
    { id: "censer", name: "Censer Smoke", desc: "", kind: "mag", target: "foes", hue: "C", power: 0.65 },
    { id: "page_cut", name: "Page Cut", desc: "", kind: "phys", target: "foe", hue: "R", power: 1.2 },
    { id: "rib_slam", name: "Rib Slam", desc: "", kind: "phys", target: "foe", hue: "R", power: 1.4, delay: 130 },
    { id: "pew_bite", name: "Pew Bite", desc: "", kind: "phys", target: "foe", hue: "G", power: 1.1 },
    { id: "mend_choir", name: "Choir Mend", desc: "", kind: "heal", target: "allies", power: 0.7 },
    { id: "call_choir", name: "Call Choir", desc: "", kind: "util", target: "self", fx: "summon:choirboy" },
    { id: "crescendo", name: "Crescendo", desc: "", kind: "util", target: "self", fx: "charge:fortissimo" },
    { id: "fortissimo", name: "Fortissimo", desc: "", kind: "mag", target: "foes", hue: "B", power: 1.7 },
    { id: "sting", name: "Sting", desc: "", kind: "phys", target: "foe", hue: "Y", power: 1.1, status: { id: "static", chance: 0.3, turns: 3 } },
    { id: "lay_egg", name: "Lay Egg", desc: "", kind: "util", target: "self", fx: "summon:hen_chick" },
    { id: "hen_peck", name: "Peck Twice", desc: "", kind: "phys", target: "foe", hue: "R", power: 0.7, hits: 2 },
    { id: "chime", name: "Chime", desc: "", kind: "mag", target: "foe", hue: "G", power: 1.2, push: 25 },
    { id: "rush", name: "Minute Rush", desc: "", kind: "phys", target: "foe", hue: "M", power: 0.6, delay: 45 },
    { id: "sand_slam", name: "Sand Slam", desc: "", kind: "phys", target: "foe", hue: "Y", power: 1.35 },
    { id: "glass_skin", name: "Glass Skin", desc: "", kind: "buff", target: "self", stage: { stat: "def", d: 2 } },
    { id: "devour_hour", name: "Devour Hour", desc: "", kind: "mag", target: "foe", hue: "M", power: 1.3, push: 40 },
    { id: "loop_back", name: "Loop Back", desc: "", kind: "heal", target: "self", fx: "selfrewind" },
    { id: "coil", name: "Coil", desc: "", kind: "util", target: "self", fx: "charge:epoch" },
    { id: "epoch", name: "Epoch", desc: "", kind: "mag", target: "foes", hue: "G", power: 1.1 },
    { id: "pilfer", name: "Pilfer", desc: "", kind: "phys", target: "foe", hue: "Y", power: 0.8, fx: "steal_gold" },
    { id: "repossess", name: "Repossess", desc: "", kind: "phys", target: "foe", hue: "R", power: 1.2, stage: { stat: "str", d: -1 } },
    { id: "haggle", name: "Haggle", desc: "", kind: "debuff", target: "foes", stage: { stat: "def", d: -1 } },
    { id: "gnaw", name: "Gnaw", desc: "", kind: "phys", target: "foe", hue: "C", power: 1.15 },
    { id: "price_hike", name: "Price Hike", desc: "", kind: "buff", target: "self", stage: { stat: "str", d: 1 } },
    { id: "bribe", name: "Bribe", desc: "", kind: "util", target: "self", fx: "bribe" },
    { id: "hire", name: "Hire Muscle", desc: "", kind: "util", target: "self", fx: "summon:hired_goon" },
    { id: "gold_rain", name: "Gold Rain", desc: "", kind: "phys", target: "foes", hue: "Y", power: 1 },
    { id: "audit", name: "Audit", desc: "", kind: "util", target: "self", fx: "charge:foreclose" },
    { id: "foreclose", name: "Foreclose", desc: "", kind: "mag", target: "foes", hue: "M", power: 1.65 },
    { id: "gust", name: "Gust", desc: "", kind: "mag", target: "foes", hue: "B", power: 0.7, push: 15 },
    { id: "bolt", name: "Bolt", desc: "", kind: "mag", target: "foe", hue: "Y", power: 1.3 },
    { id: "whale_song", name: "Whale Song", desc: "", kind: "heal", target: "allies", power: 0.8 },
    { id: "body_slam", name: "Body Slam", desc: "", kind: "phys", target: "foe", power: 1.5, delay: 130 },
    { id: "constrict", name: "Constrict", desc: "", kind: "phys", target: "foe", hue: "G", power: 1.1, stage: { stat: "spd", d: -1 } },
    { id: "cutlass", name: "Cutlass", desc: "", kind: "phys", target: "foe", hue: "R", power: 1.2 },
    { id: "jelly_sting", name: "Jelly Sting", desc: "", kind: "mag", target: "foe", hue: "C", power: 1.1, status: { id: "stun", chance: 0.2, turns: 1 } },
    { id: "halo_ray", name: "Halo Ray", desc: "", kind: "mag", target: "foe", hue: "Y", power: 1.3 },
    { id: "target_lock", name: "Target Lock", desc: "", kind: "util", target: "self", fx: "charge:judgement" },
    { id: "judgement", name: "Judgement Beam", desc: "", kind: "mag", target: "foes", hue: "Y", power: 2 },
    { id: "wing_blades", name: "Wing Blades", desc: "", kind: "phys", target: "foes", power: 0.85 },
    { id: "spin_web", name: "Spin Web", desc: "", kind: "debuff", target: "foe", stage: { stat: "spd", d: -2 } },
    { id: "unprint_ray", name: "Unprint Ray", desc: "", kind: "mag", target: "foe", power: 1.2, status: { id: "grey", chance: 1, turns: 3 } },
    { id: "thread_lash", name: "Thread Lash", desc: "", kind: "phys", target: "foe", hue: "C", power: 1.25 },
    { id: "warden_cleave", name: "Cleave", desc: "", kind: "phys", target: "foes", hue: "B", power: 0.9 },
    { id: "erase", name: "Erase", desc: "", kind: "mag", target: "foe", power: 1.5 },
    { id: "wind_up", name: "Wind Up", desc: "", kind: "util", target: "self", fx: "charge:spindle_crash" },
    { id: "spindle_crash", name: "Spindle Crash", desc: "", kind: "phys", target: "foes", power: 1.7 },
    { id: "compress", name: "Compress", desc: "", kind: "mag", target: "foes", power: 1.2, status: { id: "grey", chance: 0.6, turns: 2 } },
    { id: "sermon", name: "Sermon of Grey", desc: "", kind: "util", target: "self", fx: "charge:quantize" },
    { id: "quantize", name: "Quantize", desc: "", kind: "mag", target: "foes", power: 2.1 },
    { id: "benediction", name: "Benediction", desc: "", kind: "heal", target: "self", power: 1.6 },
    { id: "palette_swap", name: "Palette Swap", desc: "", kind: "util", target: "self", fx: "shift_hue", delay: 60 },
    { id: "fleece", name: "Fleece", desc: "", kind: "debuff", target: "foe", stage: { stat: "mnd", d: -1 }, power: 0.6 },
    { id: "eraser_edge", name: "Eraser Edge", desc: "", kind: "phys", target: "foe", power: 1.35, breakDmg: 0 },
    { id: "wraith_wail", name: "Wail", desc: "", kind: "mag", target: "foes", hue: "loaded", power: 0.8 }
  ];
  var SKILLS = Object.fromEntries(S.map((s) => [s.id, s]));
  var TELEGRAPH = {
    dust_storm: "The Grey Moth beats its wings and the air fills with dust. Guard!",
    fortissimo: "Cantor Hush draws a breath that goes on far too long.",
    epoch: "The Chronophage coils around a whole hour.",
    foreclose: "Baron Surplus opens a ledger with your name in it.",
    judgement: "Seraph K-7 locks its halo on the party.",
    spindle_crash: "The Spindle winds up, faster and faster.",
    quantize: "The Grey Bishop begins a sermon about fewer colors."
  };

  // src/game/state.ts
  var MAX_PARTY = 4;
  function newMember(id, lvl) {
    const s = statsAt(id, lvl);
    const weapon = `${MEMBERS[id].weapon}0`;
    return { id, lvl, xp: 0, hp: s.hp, ink: s.ink, tails: id === "nona" ? 9 : 0, weapon, charm: "", echo: [] };
  }
  function newGame() {
    return {
      v: 1,
      chapter: 1,
      map: "edgewick",
      x: 12,
      y: 9,
      facing: "down",
      party: ["wick"],
      reserve: [],
      members: { wick: newMember("wick", 1) },
      items: { tallow: 3 },
      gold: 20,
      flags: {},
      mech: [],
      steps: 0,
      frames: 0,
      tint: "",
      past: false,
      log: []
    };
  }
  function fullStats(m2) {
    const s = statsAt(m2.id, m2.lvl);
    const traits = [];
    let hue = "N";
    for (const id of [m2.weapon, m2.charm]) {
      const e = ITEMS[id]?.equip;
      if (!e) continue;
      s.str += e.str ?? 0;
      s.mnd += e.mnd ?? 0;
      s.def += e.def ?? 0;
      s.spd += e.spd ?? 0;
      s.hp += e.hp ?? 0;
      s.ink += e.ink ?? 0;
      if (e.hue) hue = e.hue;
      if (e.trait) traits.push(e.trait);
    }
    if (traits.includes("hp15")) s.hp = Math.round(s.hp * 1.15);
    return { ...s, traits, hue };
  }
  function avgLevel(st) {
    const ids = [...st.party, ...st.reserve];
    return Math.round(ids.reduce((a, id) => a + st.members[id].lvl, 0) / Math.max(1, ids.length));
  }
  function join(st, id, lvl) {
    if (st.party.includes(id) || st.reserve.includes(id)) return;
    const m2 = st.members[id] ?? newMember(id, lvl ?? avgLevel(st));
    if (lvl !== void 0 && m2.lvl < lvl) Object.assign(m2, newMember(id, lvl));
    st.members[id] = m2;
    if (st.party.length < MAX_PARTY) st.party.push(id);
    else st.reserve.push(id);
  }
  function leave(st, id) {
    st.party = st.party.filter((p2) => p2 !== id);
    st.reserve = st.reserve.filter((p2) => p2 !== id);
    while (st.party.length < MAX_PARTY && st.reserve.length) st.party.push(st.reserve.shift());
  }
  function grantXp(st, xp) {
    const lines = [];
    for (const id of [...st.party, ...st.reserve]) {
      const m2 = st.members[id];
      m2.xp += xp;
      while (m2.xp >= xpToNext(m2.lvl)) {
        m2.xp -= xpToNext(m2.lvl);
        const before = fullStats(m2);
        const beforeSkills = skillsAt(id, m2.lvl);
        m2.lvl++;
        const after = fullStats(m2);
        m2.hp += after.hp - before.hp;
        m2.ink += after.ink - before.ink;
        lines.push(`${MEMBERS[id].name} reached level ${m2.lvl}.`);
        for (const s of skillsAt(id, m2.lvl)) if (!beforeSkills.includes(s)) lines.push(`${MEMBERS[id].name} learned ^y${SKILLS[s]?.name ?? s}^0.`);
      }
    }
    return lines;
  }
  function healAll(st) {
    for (const id of [...st.party, ...st.reserve]) {
      const m2 = st.members[id];
      const f9 = fullStats(m2);
      m2.hp = f9.hp;
      m2.ink = f9.ink;
      if (id === "nona") m2.tails = Math.max(m2.tails, st.flags.nonaGone ? 0 : 9);
    }
  }
  function addItem(st, id, n = 1) {
    st.items[id] = (st.items[id] ?? 0) + n;
    if (st.items[id] <= 0) delete st.items[id];
  }
  var SAVE_KEY = "duotone.save";
  function save(st, slot = SAVE_KEY) {
    try {
      localStorage.setItem(slot, JSON.stringify(st));
      return true;
    } catch {
      return false;
    }
  }
  function load(slot = SAVE_KEY) {
    try {
      const raw = localStorage.getItem(slot);
      if (!raw) return null;
      const st = JSON.parse(raw);
      return st.v === 1 ? st : null;
    } catch {
      return null;
    }
  }

  // src/game/script.ts
  var Ctx = class {
    constructor(st) {
      __publicField(this, "st", st);
    }
    /** Narration without a speaker. */
    async tell(text) {
      await this.say("", text);
    }
    flag(k, v = true) {
      this.st.flags[k] = v;
      this.refresh();
    }
    has(k) {
      return !!this.st.flags[k];
    }
    get(k) {
      return +(this.st.flags[k] ?? 0);
    }
    inc(k, n = 1) {
      const v = this.get(k) + n;
      this.st.flags[k] = v;
      return v;
    }
    async give(id, n = 1, quiet = false) {
      addItem(this.st, id, n);
      this.sfx("chest");
      if (!quiet) await this.tell(`Got ^y${ITEMS[id]?.name ?? id}^0${n > 1 ? ` x${n}` : ""}.`);
    }
    take(id, n = 1) {
      addItem(this.st, id, -n);
    }
    hasItem(id) {
      return (this.st.items[id] ?? 0) > 0;
    }
    async gold(n, quiet = false) {
      this.st.gold += n;
      this.sfx("coin");
      if (!quiet) await this.tell(n >= 0 ? `Got ^y${n} gold^0.` : `Paid ^y${-n} gold^0.`);
    }
    /** Adds a member. New members take the last active slot so their mechanic gets used, and the member they replace waits in reserve. */
    async join(id, lvl) {
      join(this.st, id, lvl);
      this.sfx("lvl");
      await this.tell(`^y${MEMBERS[id].name}^0 joins the party.`);
      const bumped = this.toParty(id);
      if (bumped) await this.tell(`${MEMBERS[bumped].name} waits in reserve. Change the order under Party in the menu.`);
      this.refresh();
    }
    /** Moves a member into the active party, returning whoever was moved to reserve. */
    toParty(id) {
      const st = this.st;
      if (st.party.includes(id)) return null;
      st.reserve = st.reserve.filter((r) => r !== id);
      if (st.party.length < 4) {
        st.party.push(id);
        return null;
      }
      const out = st.party[3];
      st.party[3] = id;
      st.reserve.unshift(out);
      return out;
    }
    leave(id) {
      leave(this.st, id);
      this.refresh();
    }
    heal() {
      healAll(this.st);
      this.sfx("heal");
    }
    mech(m2) {
      if (!this.st.mech.includes(m2)) this.st.mech.push(m2);
    }
    chapter(n) {
      this.st.chapter = n;
    }
    inParty(id) {
      return this.st.party.includes(id) || this.st.reserve.includes(id);
    }
  };

  // src/maps/tiles.ts
  var LEGEND = {
    ".": { kind: "ground" },
    ",": { kind: "tall", enc: true },
    ";": { kind: "grass" },
    '"': { kind: "flowers" },
    ":": { kind: "path" },
    "T": { kind: "tree", solid: true },
    "Y": { kind: "pine", solid: true },
    "A": { kind: "antenna", solid: true },
    "%": { kind: "bush", solid: true },
    "#": { kind: "wall", solid: true },
    "B": { kind: "brick", solid: true },
    "R": { kind: "rock", solid: true },
    "^": { kind: "roof", solid: true },
    "W": { kind: "window", solid: true },
    "D": { kind: "door" },
    "~": { kind: "water", solid: true },
    "\u2248": { kind: "deep", solid: true },
    "=": { kind: "bridge" },
    " ": { kind: "void", solid: true },
    "*": { kind: "edge", solid: true },
    "_": { kind: "floor" },
    "-": { kind: "planks" },
    "+": { kind: "carpet" },
    "|": { kind: "fence", solid: true },
    "P": { kind: "pillar", solid: true },
    "&": { kind: "static", enc: true },
    "S": { kind: "stairs" },
    "G": { kind: "gear" },
    "M": { kind: "machine", solid: true },
    "Q": { kind: "circuit" },
    "O": { kind: "grate" },
    "H": { kind: "glass", solid: true },
    "$": { kind: "coins" },
    "@": { kind: "sand", enc: true },
    "!": { kind: "sand" },
    "K": { kind: "cloud", sea: true, solid: true },
    "/": { kind: "thread", solid: true },
    "X": { kind: "bone", solid: true }
  };
  var BASE_THEME = {
    ground: ["k", "e1", "e2"],
    tall: ["k", "e1", "e3"],
    grass: ["k", "e2", "e3"],
    flowers: ["k", "e1", "y3"],
    path: ["k", "n2", "n3"],
    tree: ["k", "e1", "e2"],
    pine: ["k", "e1", "e2"],
    antenna: ["k", "e1", "r2"],
    bush: ["k", "e1", "e2"],
    wall: ["k", "g1", "g2"],
    brick: ["k", "r1", "n2"],
    rock: ["k", "g1", "g2"],
    roof: ["k", "r1", "r2"],
    window: ["k", "n2", "y3"],
    door: ["k", "n1", "n2"],
    water: ["k", "b1", "b2"],
    deep: ["k", "b1", "b2"],
    bridge: ["k", "n2", "n3"],
    void: ["k", "g1", "w"],
    edge: ["k", "g1", "o3"],
    floor: ["k", "n1", "n2"],
    planks: ["k", "n2", "n3"],
    carpet: ["k", "r1", "r2"],
    fence: ["k", "e1", "n2"],
    pillar: ["k", "g2", "g3"],
    static: ["k", "c1", "g2"],
    stairs: ["k", "g2", "g3"],
    gear: ["k", "n1", "y2"],
    machine: ["k", "g1", "c2"],
    circuit: ["k", "e1", "e3"],
    grate: ["k", "g1", "g2"],
    glass: ["k", "c1", "c3"],
    coins: ["k", "y1", "y2"],
    sand: ["k", "y1", "y3"],
    cloud: ["k", "b3", "w"],
    thread: ["k", "m2", "c2"],
    bone: ["k", "g2", "w"],
    gate: ["k", "k", "w"],
    belt: ["k", "g1", "y2"]
  };

  // src/game/world.ts
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function isMarker(c) {
    return /[a-z0-9]/.test(c);
  }
  var World = class {
    constructor(def, st) {
      __publicField(this, "def", def);
      __publicField(this, "w");
      __publicField(this, "h");
      __publicField(this, "markers", /* @__PURE__ */ new Map());
      __publicField(this, "ents", []);
      this.h = def.rows.length;
      this.w = Math.max(...def.rows.map((r) => r.length));
      def.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (isMarker(row[x])) this.markers.set(row[x], [x, y]);
      });
      for (const e of def.ents) {
        const m2 = this.markers.get(e.at);
        if (!m2) throw new Error(`Map ${def.id}: marker '${e.at}' for ${e.id} not found`);
        this.ents.push({ def: e, x: m2[0], y: m2[1], hx: m2[0], hy: m2[1], hidden: false, spr: e.spr, ox: 0, oy: 0, dir: "down", wanderT: 60 + (m2[0] * 7 + m2[1] * 13) % 120 });
      }
      this.refresh(st);
    }
    refresh(st) {
      for (const e of this.ents) {
        const f9 = st.flags[`hide:${this.def.id}:${e.def.id}`];
        e.hidden = f9 === true || (e.def.when ? !e.def.when(st) : false);
        if (f9 === "show") e.hidden = false;
      }
    }
    marker(c) {
      const m2 = this.markers.get(c);
      if (!m2) throw new Error(`Map ${this.def.id}: no marker '${c}'`);
      return m2;
    }
    char(x, y, st) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this.def.outside ?? " ";
      const rows = st.past && this.def.past ? this.def.past : this.def.rows;
      const c = rows[y]?.[x] ?? " ";
      if (isMarker(c)) {
        const e = this.ents.find((en) => en.hx === x && en.hy === y);
        return e?.def.under ?? this.def.under ?? ".";
      }
      return c;
    }
    tile(x, y, st) {
      const c = this.char(x, y, st);
      return this.def.legend?.[c] ?? LEGEND[c] ?? { kind: "void", solid: true };
    }
    entAt(x, y, solidOnly = false) {
      return this.ents.find((e) => !e.hidden && e.x === x && e.y === y && (!solidOnly || this.entSolid(e)));
    }
    entSolid(e) {
      if (e.def.solid !== void 0) return e.def.solid;
      return e.def.kind !== "warp" && e.def.kind !== "trigger";
    }
    passable(x, y, st) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      const t = this.tile(x, y, st);
      if (t.gate) return st.tint === t.gate;
      if (t.sea) return !!st.flags.skiff;
      if (t.solid) return false;
      return !this.entAt(x, y, true);
    }
    ent(id) {
      return this.ents.find((e) => e.def.id === id);
    }
  };

  // src/maps/ch1.ts
  var ch1_exports = {};
  __export(ch1_exports, {
    EDGEWICK: () => EDGEWICK,
    HOLLOW: () => HOLLOW,
    chapter: () => chapter,
    maps: () => maps
  });

  // src/data/portraits.ts
  var h = (seed, pal, o = {}) => ({ g: "human", seed, pal, o });
  var b = (kind, pal) => ({ g: "beast", pal, o: { kind } });
  var m = (seed, pal, shape) => ({ g: "monster", seed, pal, o: { shape } });
  var p = (kind, pal) => ({ g: "prop", pal, o: { kind } });
  var NPC = {
    gran: h("gran", ["k", "n2", "w"], { head: "bun", torso: "robe", legs: "robe", held: "staff" }),
    granGrey: h("gran", ["k", "g2", "g3"], { head: "bun", torso: "robe", legs: "robe", held: "staff" }),
    sprocket: h("sprocket", ["k", "r2", "y3"], { head: "antenna", torso: "arms", legs: "legs", held: "" }),
    pell: h("pell", ["k", "w", "n3"], { head: "brim", torso: "wide", legs: "legs", held: "" }),
    pellGrey: h("pell", ["k", "g2", "g3"], { head: "brim", torso: "wide", legs: "legs", held: "" }),
    mayor: h("mayor", ["k", "r1", "y2"], { head: "crown", torso: "cape", legs: "robe", held: "" }),
    hollis: h("hollis", ["k", "e1", "n3"], { head: "hood", torso: "vest", legs: "legs", held: "staff" }),
    mott: h("mott", ["k", "b2", "n3"], { head: "bald", torso: "belt", legs: "legs", held: "" }),
    scarecrow: h("scarecrow", ["k", "n2", "c2"], { head: "antenna", torso: "wide", legs: "float", held: "flag" }),
    sheep: b("sheep", ["k", "g3", "w"]),
    nonaHurt: b("nona", ["k", "c1", "g3"]),
    greatLamp: p("lamp", ["k", "y2", "y3"]),
    greatLampOut: p("lampOff", ["k", "g1", "g2"]),
    antennaTree: m("antenna_tree", ["k", "e1", "r2"], "totem"),
    star: p("star", ["k", "c2", "w"]),
    bed: p("bed", ["k", "n2", "w"]),
    pot: p("pot", ["k", "n2", "y2"]),
    statue: p("statue", ["k", "g2", "g3"]),
    villagerA: h("villager_a", ["k", "e2", "o3"]),
    villagerB: h("villager_b", ["k", "m2", "y3"]),
    villagerGrey: h("villager_a", ["k", "g2", "g3"]),
    // Chapter 2
    ribbit: b("frog", ["k", "e2", "m3"]),
    frog: b("frog", ["k", "e2", "y3"]),
    frogB: b("frog", ["k", "c2", "o3"]),
    customs: b("frog", ["k", "b2", "y2"]),
    dish: p("orb", ["k", "g2", "w"]),
    grayling: h("grayling", ["k", "g2", "w"], { head: "hood", torso: "robe", legs: "robe", held: "book" }),
    coral: h("coral", ["k", "r2", "c3"], { head: "brim", torso: "cape", legs: "robe", held: "flag" }),
    ulla: h("ulla", ["k", "b2", "w"], { head: "bun", torso: "arms", legs: "skirt", held: "brush" }),
    pipGrey: h("pip", ["k", "g2", "g3"], { head: "hair", torso: "plain", legs: "legs", held: "" }),
    pip: h("pip", ["k", "o2", "e3"], { head: "hair", torso: "plain", legs: "legs", held: "" }),
    captain: h("captain", ["k", "b1", "m3"], { head: "brim", torso: "vest", legs: "legs", held: "staff" }),
    innkeeper: h("inn", ["k", "y2", "r3"], { head: "bald", torso: "belt", legs: "legs", held: "" }),
    paintshop: h("paintshop", ["k", "m2", "c3"], { head: "bun", torso: "wide", legs: "robe", held: "brush" }),
    lens: p("crystal", ["k", "c2", "w"]),
    lensCracked: p("crystal", ["k", "g1", "g3"]),
    octo: m("octachrome", ["k", "r2", "y2"], "ghost"),
    boat: p("pot", ["k", "n2", "w"]),
    // Chapter 3
    pilgrimA: h("pilgrim_a", ["k", "n2", "n3"], { head: "hood", torso: "robe", legs: "robe", held: "staff" }),
    pilgrimB: h("pilgrim_b", ["k", "r1", "o3"], { head: "hood", torso: "robe", legs: "robe", held: "" }),
    hermit: h("hermit", ["k", "e1", "g3"], { head: "bald", torso: "cape", legs: "robe", held: "staff" }),
    greeter: h("greeter", ["k", "g2", "b3"], { head: "hood", torso: "robe", legs: "robe", held: "book" }),
    clapper: h("clapper", ["k", "y1", "w"], { head: "bald", torso: "arms", legs: "legs", held: "" }),
    theologian: b("robo", ["k", "g2", "c2"]),
    oiler: h("oiler", ["k", "n2", "y2"], { head: "brim", torso: "arms", legs: "legs", held: "" }),
    greyPilgrim: p("statue", ["k", "g2", "g3"]),
    cantor: m("cantor_hush", ["k", "w", "b3"], "totem"),
    bishop: b("bishop", ["k", "g2", "w"]),
    bell: p("bell", ["k", "y2", "y3"]),
    bellGrey: p("bell", ["k", "g1", "g2"]),
    barrier: p("tube", ["k", "g1", "g3"]),
    cellDoor: p("tube", ["k", "g1", "b2"]),
    brask: h("brask", ["k", "b2", "y3"], { head: "helm", torso: "armor", legs: "stance", held: "sword" }),
    shrine: p("statue", ["k", "g2", "y2"]),
    bellInn: h("bellinn", ["k", "b2", "y3"], { head: "bun", torso: "belt", legs: "robe", held: "" }),
    relic: h("relic", ["k", "m1", "y2"], { head: "crown", torso: "robe", legs: "robe", held: "book" }),
    // Chapter 4
    tock: b("monk", ["k", "e2", "r3"]),
    caravan: h("caravan", ["k", "o2", "w"], { head: "brim", torso: "cape", legs: "legs", held: "staff" }),
    clockCamel: b("slug", ["k", "n2", "y2"]),
    mirage: h("mirage", ["k", "c3", "w"], { head: "bun", torso: "wide", legs: "float", held: "" }),
    sandMerchant: h("sandm", ["k", "y2", "n3"], { head: "hood", torso: "wide", legs: "robe", held: "coin" }),
    monkPast: b("monk", ["k", "n2", "y3"]),
    monkPastB: b("monk", ["k", "b2", "y3"]),
    hourglass: p("tube", ["k", "y2", "c3"]),
    clockFace: p("sundial", ["k", "y2", "w"]),
    chronophage: m("chronophage", ["k", "e2", "m2"], "worm"),
    // Chapter 5
    clerk: h("clerk", ["k", "g2", "b3"], { head: "cap", torso: "belt", legs: "legs", held: "book" }),
    vend: b("vend", ["k", "r2", "c3"]),
    baron: m("baron_surplus", ["k", "y2", "m2"], "totem"),
    auctioneer: m("auctioneer", ["k", "m1", "m3"], "ghost"),
    goblin: h("goblin", ["k", "e2", "o2"], { head: "horns", torso: "vest", legs: "legs", held: "coin" }),
    goblinB: h("goblin_b", ["k", "e1", "y2"], { head: "horns", torso: "wide", legs: "legs", held: "" }),
    ratMerchant: m("rat_merchant", ["k", "g2", "c3"], "crawler"),
    fishBowl: b("fish", ["k", "c2", "o3"]),
    slots: b("vend", ["k", "m2", "y3"]),
    lift: p("terminal", ["k", "g2", "c2"]),
    jar: p("pot", ["k", "n2", "w"]),
    ticket: p("sign", ["k", "y2", "w"]),
    // Chapter 6
    mirrow: b("mirror", ["k", "b3", "w"]),
    attendant: h("attendant", ["k", "r2", "y3"], { head: "brim", torso: "belt", legs: "legs", held: "" }),
    fisher: h("fisher", ["k", "b1", "w"], { head: "hood", torso: "arms", legs: "legs", held: "staff" }),
    pirateCaptain: h("pirate_cap", ["k", "r1", "y2"], { head: "brim", torso: "cape", legs: "stance", held: "sword" }),
    seraph: m("seraph_k7", ["k", "w", "y2"], "star"),
    campfire: p("star", ["k", "r2", "y3"]),
    wreck: p("terminal", ["k", "g1", "r2"]),
    storm: p("orb", ["k", "b1", "b3"]),
    needleGate: p("tube", ["k", "y2", "w"]),
    skiff: p("pot", ["k", "n2", "b3"]),
    // Chapter 7
    nil: b("blank", ["k", "g2", "g3"]),
    weaver: m("weaver", ["k", "c3", "w"], "eye"),
    spindle: m("the_spindle", ["k", "c2", "r2"], "totem"),
    spoolProp: p("spool", ["k", "m2", "c2"]),
    spoolProp2: p("spool", ["k", "y2", "r2"]),
    terminal: p("terminal", ["k", "g1", "c2"]),
    vat: p("pot", ["k", "g1", "g3"]),
    vatJar: p("pot", ["k", "n2", "w"]),
    nonaGrey: b("nona", ["k", "g2", "g3"]),
    bin: p("pot", ["k", "g1", "g2"]),
    // Chapter 8
    tockYoung: b("monk", ["k", "e3", "r3"]),
    spindleHatch: p("tube", ["k", "g2", "w"]),
    pond: p("pool", ["k", "b2", "b3"]),
    bishopLoom: m("bishop_loom", ["k", "g2", "w"], "star")
  };
  var PORTRAITS = {
    "gran umber": NPC.gran,
    gran: NPC.gran,
    sprocket: NPC.sprocket,
    pell: NPC.pell,
    "mayor ochre": NPC.mayor,
    hollis: NPC.hollis,
    mott: NPC.mott,
    "scarecrow unit 4": NPC.scarecrow,
    "fog sheep": NPC.sheep,
    "dj ribbit": NPC.ribbit,
    "customs frog": NPC.customs,
    dishwater: NPC.dish,
    "brother grayling": NPC.grayling,
    "harbormistress coral": NPC.coral,
    ulla: NPC.ulla,
    pip: NPC.pip,
    "captain nebb": NPC.captain,
    marl: NPC.innkeeper,
    swatch: NPC.paintshop,
    frog: NPC.frog,
    pilgrim: NPC.pilgrimA,
    "hermit oda": NPC.hermit,
    "sister vesper": NPC.greeter,
    "old clapper": NPC.clapper,
    "unit 9 of doctrine": NPC.theologian,
    gim: NPC.oiler,
    "cantor hush": NPC.cantor,
    "grey bishop": NPC.bishop,
    "the grey bishop": NPC.bishop,
    bellamy: NPC.bellInn,
    "reliquarian": NPC.relic,
    templar: h("templar", ["k", "b1", "y2"], { head: "helm", torso: "armor", legs: "stance", held: "sword" }),
    "caravan master ibb": NPC.caravan,
    "sand merchant": NPC.sandMerchant,
    "the mirage": NPC.mirage,
    "brother minute": NPC.monkPast,
    "sister second": NPC.monkPastB,
    chronophage: NPC.chronophage,
    "toll clerk": NPC.clerk,
    "baron surplus": NPC.baron,
    "the auctioneer": NPC.auctioneer,
    goblin: NPC.goblin,
    "moon rat": NPC.ratMerchant,
    "the bowl family": NPC.fishBowl,
    "lucky seven": NPC.slots,
    "lift attendant": NPC.attendant,
    "cloud fisher": NPC.fisher,
    "captain gale": NPC.pirateCaptain,
    "seraph k-7": NPC.seraph,
    "the weaver": NPC.weaver,
    "the spindle": NPC.spindle,
    "the loom-bound bishop": NPC.bishopLoom,
    "gran umber, in color": NPC.gran
  };

  // src/maps/common.ts
  async function nextChapter(s, n) {
    const ch = CHAPTERS[n - 1];
    if (!ch || !ch.ready) {
      await s.tell(`^yEnd of Chapter ${n - 1}.^0 The next chapter is still being printed. Your progress is saved.`);
      s.flag(`ch${n - 1}Done`);
      save(s.st);
      return;
    }
    await s.fadeOut();
    s.chapter(n);
    for (const [k, v] of Object.entries(ch.presetFlags ?? {})) if (s.st.flags[k] === void 0) s.st.flags[k] = v;
    await s.card(n);
    await s.warp(ch.startMap, ch.startMarker);
    save(s.st);
    if (ch.intro) await ch.intro(s);
  }
  function lampsLit(s, map, ids) {
    return ids.filter((id) => s.st.flags[`lit:${map}:${id}`]).length;
  }

  // src/maps/ch1.ts
  var f = (s, k) => s.has(k);
  var EDGEWICK = [
    "TTTTTTTTTTTTTTTwTTTTTTTTTTTTTT*   ",
    "T;;;;;;;;;;;;;h:;;;;;;;;;;;;;;*   ",
    "T;^^^^^;;;;;;;;:;;;;;;;^^^^^;;*   ",
    'T;BWgWB;;"";;;;:;;;;;;;BWmWB;;*   ',
    "T;;;a;;;;;k;;;;:;;;;;;;;;:;;;;*   ",
    "T;;;:::::::::::::::::::::::::1*   ",
    "T;;;:;;;;;;;;;;:;;;;;;;;;:;;;;*   ",
    "T;%;:;;;;;;;;;;:;;;;;;;;;:;;;;*   ",
    "T;;;:;;;;:::::::::::;;;;;:;;;;*   ",
    "T;;;:;;;;:;;;;;;;;;:;o;;;:;;;;*   ",
    "T;n;:;;;;:;;;;l;q;;:;;;;;:;;;;*   ",
    "x:::::::::;;;;;;;;;::::::::::2*   ",
    "T;;;:;;p;:;;;v;;;;;:;;;;;:;;;;*   ",
    "T;;;:;;;;:::::::::::;;;;;:;;;;*   ",
    "T;;;:;;;;;;;;;;:;;;;;;;;;:;;;;*   ",
    "T;^^^^^;;;;;;;;:;;;;;;;;;:;;;;*   ",
    'T;BWsWB;;;;;;;;:;;;"";;;;:;;;;*   ',
    'T;;;:;;;;;;;;;;:;;;"";;;;:;;;3*   ',
    "T;;;:::::::::::::::::::::::::;*   ",
    "T;;;;;;;;;;;;;;;;;;;;;;;;;;;;;*   ",
    "T;;~~~~;;;;;;;;;;;;;;;;;;;;;;;*   ",
    "T;;~~~~;f;;;;;;;;;;;;;;;;;;;;;*   ",
    "T;;;;;;;;;;;;;;;;;;;;r;;;;;;;;*   ",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT*   "
  ];
  var edgeLamp = (id) => async (s) => {
    const key = `lit:edgewick:${id}`;
    if (s.has(key)) {
      await s.tell("The Edge Lamp burns amber. Past it, the world simply stops.");
      return;
    }
    s.flag(key);
    s.sfx("save");
    await s.flash("y3");
    const n = lampsLit(s, "edgewick", ["lamp1", "lamp2", "lamp3"]);
    if (n === 1) {
      await s.tell("The lamp catches. Something grey scrabbles over the cliff edge, drawn by the light.");
      await s.say("Wick", "A Blank. They come up out of the Void when the lamps are late.");
      await s.tell("^yBattle basics:^0 Attack is free. Skills cost ink. Guard halves damage and refills a little ink. Hold Z to speed things up.");
      await s.battle("wolf1");
      await s.say("Wick", "Two more lamps.");
    } else if (n === 2) {
      await s.say("Wick", "One more. The Void looks restless tonight.");
    } else {
      s.flag("lampsDone");
      await s.say("Wick", "All three. The Edge is quiet. Gran will want to know.");
    }
  };
  var granTalk = async (s) => {
    if (!f(s, "lampsDone")) {
      await s.say("Gran Umber", "The Edge Lamps, wick-in-the-wind. They won't light themselves. Well, they could, but they'd want wages.");
      return;
    }
    if (!f(s, "sent")) {
      await s.say("Gran Umber", "All three lit? Good. Now come look at this. The Great Lamp has been coughing all evening.");
      await s.say("Wick", "Coughing?");
      await s.say("Gran Umber", "Soot, sparks, a little grey around the flame. Lamps don't go grey, Wick. People do. Lately.");
      s.shake(30);
      s.sfx("crit");
      await s.flash("w");
      await s.tell("A light streaks across the sky and crashes somewhere north, in the Hollow Wood. The windows rattle.");
      await s.say("Gran Umber", "That was a star. Stars don't fall here. We're too small to fall on.");
      await s.say("Gran Umber", "Listen. The Great Lamp needs lampsap, and the only lampsap grows on the Antenna Tree in the middle of the wood.");
      await s.say("Wick", "At night? Hollis says the trees pick up bad stations at night.");
      await s.say("Gran Umber", "Hollis also says the moon is a rumor. Take these. Follow the wayside lamps and light them as you go. Blanks hate a lit lamp.");
      await s.give("tallow", 3);
      await s.give("ink_vial", 1);
      s.flag("sent");
      await s.say("Gran Umber", "And Wick. Whatever fell out there, be kind to it. Things that fall are usually frightened.");
      return;
    }
    if (!f(s, "mothDead")) {
      await s.say("Gran Umber", "The Hollow Wood is north, past Hollis. Bring back lampsap, and yourself, in that order of importance. No, the other order.");
      return;
    }
  };
  var granStatue = async (s) => {
    if (!f(s, "accepted")) {
      await s.tell("Gran stands by the window with her hand half raised, as grey as ash. She is still warm.");
      return;
    }
    await s.say("Wick", "I'm going up there, Gran. I'll bring your color back. Both of them.");
    await s.tell("The grey statue doesn't answer. Wick decides it is listening.");
  };
  var returnScene = async (s) => {
    if (!f(s, "returned") || f(s, "returnSeen")) return;
    s.flag("returnSeen");
    s.music("sad");
    await s.tell("Edgewick is quiet. The Great Lamp is out. Grey handprints run along the path from the Edge.");
    await s.say("Sprocket", "Wick! Wick, the grey came up over the cliff right after you left! It just walked in like it lived here!");
    await s.say("Sprocket", "It touched Pell, and then it went into your house, and your Gran...");
    await s.say("Nona", "Go and see her. I will wait by the lamp.");
  };
  var granReveal = async (s) => {
    if (f(s, "refused")) return granStatue(s);
    s.flag("refused");
    await s.tell("Gran stands by the window with her hand half raised, as grey as ash. She is still warm.");
    await s.say("Wick", "Gran?");
    await s.say("Nona", "She is not gone. Her color was pulled out of her, like a thread. Pulled upward.");
    await s.say("Wick", "Upward where?");
    await s.say("Nona", "To the Loom. The thing in the sky that printed all of you. Something up there has started taking the ink back.");
    await s.say("Nona", "I fell from the Loom tonight. I need to go back, and I need someone the grey cannot read. A misprint is not in the Loom's index. You could walk in there and it would not even see you.");
    await s.say("Nona", "Come with me, Wick.");
    const i = await s.ask("What does Wick say?", ["I can't. I'm a misprint.", "I light lamps. That's all I do."]);
    if (i === 0) await s.say("Wick", "I can't. I'm a misprint. I'm barely a person. You want someone with three inks.");
    else await s.say("Wick", "I light lamps. That's all I do. I can't fix the sky.");
    await s.say("Nona", "Then light a lamp. The Great Lamp is out, and you are holding lampsap.");
  };
  var greatLamp = async (s) => {
    if (!f(s, "returned")) {
      await s.tell("The Great Lamp of Edgewick. Its flame is thin and a little grey around the edges. It keeps the color in.");
      return;
    }
    if (!f(s, "refused")) {
      await s.tell("The Great Lamp is dark. Wick should check on Gran first.");
      return;
    }
    if (!f(s, "relit")) {
      s.take("lampsap");
      s.flag("relit");
      s.sfx("save");
      await s.flash("y3");
      s.music("village");
      await s.tell("Wick pours the lampsap into the Great Lamp. The flame climbs, amber and loud. The grey handprints on the path fade.");
      await s.say("Pell", "Oh! Oh, I can see my apron again. It was brown the whole time. How exciting.");
      await s.say("Mayor Ochre", "The Great Lamp holds! Edgewick holds! For now, anyway. I'm told nothing holds forever. I was told by the lamp.");
      await s.say("Nona", "The lamp slows the pull. It does not stop it. Your grandmother is still grey, Wick, because her color is already up there.");
      return;
    }
    await s.tell("The Great Lamp burns amber and loud.");
  };
  var nonaVillage = async (s) => {
    if (!f(s, "relit")) {
      await s.say("Nona", "See to your grandmother. Then see to the lamp. I am good at waiting. I once waited four hundred years for a bolt to cool.");
      return;
    }
    if (f(s, "accepted")) {
      await s.say("Nona", "The west road. Past the last lamp. I have never walked on the ground before tonight. It is very... close.");
      return;
    }
    await s.say("Nona", "So. The lamp is lit and your grandmother is still grey. What will you do?");
    const i = await s.ask("", ["Go to the Loom.", "Stay and keep the lamps."]);
    if (i === 1) {
      await s.say("Wick", "Someone has to keep the lamps. That's me. That's always been me.");
      await s.say("Nona", "And when the lamps go grey too? They will. Go and look at the Edge, Wick. Then come back and tell me you are staying.");
      s.flag("lookedAtEdge");
      return;
    }
    await s.say("Wick", "I'll go. Not because I'm a hero. Because Gran would have gone for me.");
    await s.say("Nona", "That is the only reason anyone has ever gone anywhere. Good.");
    s.flag("accepted");
    await s.say("Mayor Ochre", "Wick! You're leaving? Then Edgewick sends you with its full support, which is this bag of coins and a speech I will skip.");
    await s.gold(100);
    await s.say("Sprocket", "Take my lucky button. It fell off my coat the day I was printed. It's been lucky ever since. For the button.");
    await s.give("lucky_button");
    await s.say("Nona", "The west road, then. Past the last lamp.");
  };
  var westExit = async (s) => {
    if (s.st.chapter >= 2) {
      await s.warp("fizz", "e", "left");
      return;
    }
    if (!f(s, "accepted")) {
      await s.say("Wick", "The west road. Nobody from Edgewick goes past the last lamp. Not yet.");
      await s.movePlayer("r");
      return;
    }
    await s.tell("Wick steps past the last lamp of Edgewick. Behind them, the Great Lamp burns amber. Ahead, the road goes on into more world than Wick has ever seen.");
    await nextChapter(s, 2);
  };
  var northExit = async (s) => {
    if (!f(s, "sent")) {
      await s.say("Hollis", "The Hollow Wood is closed after dark. The antenna trees pick up bad stations at night. I heard one read out a list of my mistakes.");
      await s.movePlayer("d");
      return;
    }
    if (f(s, "returned")) {
      await s.say("Hollis", "Nothing left in the wood that you need, Wick. Only the bad stations.");
      await s.movePlayer("d");
      return;
    }
    await s.warp("hollow", "z", "up");
  };
  var edgewick = {
    id: "edgewick",
    name: "Edgewick",
    music: "village",
    rows: EDGEWICK,
    under: ";",
    outside: "T",
    theme: {
      grass: ["k", "e2", "e3"],
      ground: ["k", "e1", "e2"],
      path: ["k", "n2", "n3"],
      tree: ["k", "e1", "e2"],
      edge: ["k", "g1", "o3"],
      void: ["k", "g1", "w"],
      roof: ["k", "r1", "o2"],
      brick: ["k", "n1", "n2"]
    },
    ents: [
      { id: "north", at: "w", kind: "trigger", step: northExit, under: ":" },
      { id: "west", at: "x", kind: "trigger", step: westExit, under: ":" },
      { id: "granDoor", at: "g", kind: "warp", to: ["granhouse", "d", "up"], under: "D" },
      { id: "shopDoor", at: "s", kind: "warp", to: ["edgeshop", "d", "up"], under: "D" },
      { id: "mayorDoor", at: "m", kind: "prop", under: "D", solid: true, talk: async (s) => s.tell("The mayor's door. A sign says: OUT SUPERVISING. The mayor is standing right over there.") },
      { id: "lamp1", at: "1", kind: "lamp", talk: edgeLamp("lamp1"), under: ";" },
      { id: "lamp2", at: "2", kind: "lamp", talk: edgeLamp("lamp2"), under: ";" },
      { id: "lamp3", at: "3", kind: "lamp", talk: edgeLamp("lamp3"), under: ";" },
      {
        id: "greatLamp",
        at: "l",
        kind: "npc",
        name: "Great Lamp",
        talk: greatLamp,
        spr: NPC.greatLamp,
        when: (st) => !st.flags.returned || !!st.flags.relit
      },
      {
        id: "greatLampOut",
        at: "l",
        kind: "npc",
        talk: greatLamp,
        spr: NPC.greatLampOut,
        when: (st) => !!st.flags.returned && !st.flags.relit
      },
      {
        id: "hollis",
        at: "h",
        kind: "npc",
        spr: NPC.hollis,
        talk: async (s) => {
          if (!f(s, "sent")) await s.say("Hollis", "Evening, Wick. Wood's closed. The trees are broadcasting again. Mostly static and a man selling knives.");
          else if (!f(s, "returned")) await s.say("Hollis", "Gran sent you? Then go on. Stick to the wayside lamps. A lit lamp keeps the Blanks off you.");
          else await s.say("Hollis", "I heard the whole wood go quiet when you came back. Even the knife man.");
        }
      },
      {
        id: "sprocket",
        at: "k",
        kind: "npc",
        spr: NPC.sprocket,
        wander: true,
        talk: async (s) => {
          if (f(s, "returned") && !f(s, "relit")) await s.say("Sprocket", "The grey went into your house. I tried to stop it. I threw a shoe at it. It kept the shoe.");
          else if (f(s, "accepted")) await s.say("Sprocket", "When you get to the sky, wave. I'll be the one waving back. Look for three colors.");
          else await s.say("Sprocket", "When I grow up I want to be a Duotone like you. Mum says I can't, I already have three colors. I'm going to wash one off.");
        }
      },
      {
        id: "pell",
        at: "p",
        kind: "npc",
        spr: NPC.pell,
        when: (st) => !st.flags.returned || !!st.flags.relit,
        talk: async (s) => {
          if (f(s, "relit")) {
            await s.say("Pell", "My apron is brown! I had forgotten. Here, take a roll. Rolls are brown too. Everything good is brown.");
            if (!f(s, "pellRoll")) {
              s.flag("pellRoll");
              await s.give("tallow", 2);
            }
            return;
          }
          await s.say("Pell", "Fresh bread! Crust, crumb, and a third color we don't discuss.");
          if (!f(s, "pellGift")) {
            s.flag("pellGift");
            await s.say("Pell", "Oh, Wick. Poor thing, printed half finished. Take a tallow drop. It has enough color for two.");
            await s.give("tallow");
          }
        }
      },
      { id: "pellGrey", at: "p", kind: "npc", spr: NPC.pellGrey, when: (st) => !!st.flags.returned && !st.flags.relit, talk: async (s) => s.tell("Pell stands frozen mid-knead, grey from hat to apron. The dough in her hands is grey too.") },
      {
        id: "villager",
        at: "v",
        kind: "npc",
        spr: NPC.villagerB,
        wander: true,
        when: (st) => !st.flags.returned || !!st.flags.relit,
        talk: async (s) => {
          if (f(s, "relit")) await s.say("Dilly", "I was grey for an hour. It was very restful. I do not recommend it.");
          else await s.say("Dilly", "They say past the Edge there's nothing. Not black, not empty. Nothing. I looked once and it looked back, politely.");
        }
      },
      { id: "villagerGrey", at: "v", kind: "npc", spr: NPC.villagerGrey, when: (st) => !!st.flags.returned && !st.flags.relit, talk: async (s) => s.tell("Dilly is grey and still. A grey bird sits on Dilly's head, also still.") },
      {
        id: "mayor",
        at: "o",
        kind: "npc",
        spr: NPC.mayor,
        talk: async (s) => {
          if (f(s, "accepted")) await s.say("Mayor Ochre", "Go on, Wick. I'll keep an eye on the lamps. Well. I'll keep an eye on you keeping an eye on the lamps. From here.");
          else if (f(s, "returned")) await s.say("Mayor Ochre", "This is a disaster. I have declared it a disaster. That is the most a mayor can do.");
          else await s.say("Mayor Ochre", "Ah, Wick. Keep those Edge Lamps lit. The Edge is very edgy tonight. That is a joke. I am allowed one per year.");
        }
      },
      {
        id: "nona",
        at: "q",
        kind: "npc",
        spr: { g: "beast", pal: ["k", "c2", "w"], o: { kind: "nona" } },
        when: (st) => !!st.flags.returned && !st.flags.accepted,
        talk: nonaVillage
      },
      {
        id: "nona2",
        at: "q",
        kind: "npc",
        spr: { g: "beast", pal: ["k", "c2", "w"], o: { kind: "nona" } },
        when: (st) => !!st.flags.accepted,
        talk: nonaVillage
      },
      {
        id: "sheep",
        at: "f",
        kind: "npc",
        spr: NPC.sheep,
        wander: true,
        talk: async (s) => {
          await s.tell("The sheep is made of fog. When Wick pets it, their hand comes back slightly damp and slightly sheep.");
        }
      },
      {
        id: "scarecrow",
        at: "r",
        kind: "npc",
        spr: NPC.scarecrow,
        talk: async (s) => {
          if (f(s, "relit")) await s.say("Scarecrow Unit 4", "FORECAST REVISED. GREY, WITH SCATTERED HOPE. ALSO CROWS. THE CROWS ARE CONSTANT.");
          else if (f(s, "returned")) await s.say("Scarecrow Unit 4", "FORECAST: GREY. MORE GREY. A HIGH-PRESSURE SYSTEM OF GREY MOVING DOWN FROM THE SKY.");
          else await s.say("Scarecrow Unit 4", "FORECAST FOR TONIGHT: SIXTY PERCENT CHANCE OF GREY. LIGHT WINDS FROM THE EDGE. ALSO CROWS.");
        }
      },
      { id: "sign", at: "n", kind: "sign", text: "WEST ROAD. Nobody from Edgewick has come back from past the Lamp Line. Nobody from Edgewick has gone past it either." }
    ],
    enter: async (s) => {
      await returnScene(s);
    }
  };
  var granhouse = {
    id: "granhouse",
    name: "Lamp House",
    music: "village",
    under: "-",
    outside: "#",
    rows: [
      "##########",
      "#WW####WW#",
      "#--------#",
      "#-b----u-#",
      "#--------#",
      "#--t-----#",
      "#--------#",
      "####d#####"
    ],
    theme: { wall: ["k", "n2", "n3"], planks: ["k", "n1", "n2"], window: ["k", "n2", "y3"] },
    ents: [
      { id: "door", at: "d", kind: "warp", to: ["edgewick", "g", "down"], under: "D" },
      { id: "bed", at: "b", kind: "prop", spr: NPC.bed, talk: async (s) => s.tell("Wick's bed. It is shaped exactly like Wick after sixteen years of use.") },
      { id: "pot", at: "t", kind: "prop", spr: NPC.pot, talk: async (s) => {
        if (!f(s, "potTallow")) {
          s.flag("potTallow");
          await s.tell("Gran keeps spare tallow in the pot for emergencies. This counts.");
          await s.give("tallow", 2);
        } else await s.tell("The pot is empty. It still smells like tallow and Tuesday.");
      } },
      { id: "gran", at: "u", kind: "npc", spr: NPC.gran, talk: granTalk, when: (st) => !st.flags.returned },
      { id: "granGrey", at: "u", kind: "npc", spr: NPC.granGrey, talk: granReveal, when: (st) => !!st.flags.returned }
    ]
  };
  var edgeshop = {
    id: "edgeshop",
    name: "Edgewick Stores",
    music: "village",
    under: "-",
    outside: "#",
    rows: [
      "##########",
      "#WW####WW#",
      "#-CCsCC--#",
      "#--------#",
      "#-c------#",
      "#--------#",
      "####d#####"
    ],
    legend: { C: { kind: "fence", solid: true } },
    theme: { wall: ["k", "n2", "n3"], planks: ["k", "n1", "n2"], fence: ["k", "n1", "y2"], window: ["k", "n2", "y3"] },
    ents: [
      { id: "door", at: "d", kind: "warp", to: ["edgewick", "s", "down"], under: "D" },
      { id: "mott", at: "s", kind: "npc", spr: NPC.mott, under: "C", talk: async (s) => {
        await s.say("Mott", "Edgewick Stores. Everything a village at the end of the world needs, which is not much, but we have lots of it.");
        await s.shop("edgewick");
      } },
      { id: "chest", at: "c", kind: "chest", item: "pin", n: 2 }
    ]
  };
  var HOLLOW = [
    "YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYYAAAAAAAYYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYA,,,,,,,AYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYA,,,,t,,,,AYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYA,,,,,,,,,AYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYA,,,b,,,AYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYYAA,:,AAYYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY",
    "YYYYYY,,,,YYYYYYYY,:,YYYYYYYYYYY,,,,YYYY",
    "YYYYY,,f,,,YYYYYY,,:3,YYYYYYYYY,,c,,YYYY",
    "YYYYY,,,,,,,YYYY,,,:,,,YYYYYYYYYY,YYYYYY",
    "YYYYYY,,,,,,,,,,,,,:,,,,,,,,,,,,,s,,YYYY",
    "YYYYYYY,,,,YYYY,,,,:,,,,YYYYY,,,,,,,YYYY",
    "YYYYYYYY,,YYYYYYY,,:,,YYYYYYYY,,,,YYYYYY",
    "YYYYYYYY,,YYYYYYYY,:,YYYYYYYYYY,,YYYYYYY",
    "YYYYYYY,,,,YYYYYYY,:,YYYYYYYYYY,,YYYYYYY",
    "YYYYY,,,,,,,YYYYYY,:,YYYYYYYYYY,,YYYYYYY",
    "YYYY,,RRR,,,YYYYYY,:,YYYYYYYYY,,,,YYYYYY",
    "YYYY,,RnR,,,,,,,,,,:,YYYYYYYY,,,,,,YYYYY",
    "YYYY,,,:,,,,YYYYYY,:,YYYYYYYY,,,,,,YYYYY",
    "YYYYY,,:,,2,YYYYYY,:,YYYYYYYYY,,,,YYYYYY",
    "YYYYYY,,:,,,YYYYYY,:,YYYYYYYYYY,,YYYYYYY",
    "YYYYYYY,,:,,YYYYYY,:,YYYYYYYYYY,,YYYYYYY",
    "YYYYYYYY,,:,,,,,,,,:,,,,,,,,,,,,,YYYYYYY",
    "YYYYYYYYY,,,,YYYYY,:,YYYYYYYYYYY,e,YYYYY",
    "YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY",
    "YYYYYYY,,,YYYYYYYY,:,YYYYYYYYYYYYYYYYYYY",
    "YYYYYY,,d,,,,,,,,,,:1,YYYYYYYYYYYYYYYYYY",
    "YYYYYYY,,,YYYYYYYY,:,YYYYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY",
    "YYYYYYYYYYYYYYYYYYYzYYYYYYYYYYYYYYYYYYYY"
  ];
  var meetNona = async (s) => {
    if (f(s, "metNona")) {
      await s.say("Nona", "The Antenna Tree is north, up the main path. I can hear it humming from here. It sounds unwell.");
      return;
    }
    await s.tell("In a crater of scorched rock lies a small metal cat with nine long tails. Three Blanks are sniffing at her.");
    await s.say("???", "Shoo. Shoo! I am not food. I am barely even metal anymore.");
    await s.battle("pup1");
    await s.tell("The Blanks scatter. The cat blinks up at Wick with two cyan eyes.");
    await s.say("???", "Oh. A person. A person with only two inks. How unusual. Hello, misprint.");
    await s.say("Wick", "I have a name. It's Wick.");
    await s.say("Nona", "And I am Nona, maintenance unit, nine tails, all of them bent. I fell off the Loom about an hour ago. Thank you for the rescue.");
    await s.say("Wick", "You fell off the sky?");
    await s.say("Nona", "Off the thing in the sky. There is a difference, but it is a long one. Something up there is unthreading the world, Wick. The Blanks followed me down.");
    await s.say("Wick", "I'm only here for lampsap. The Antenna Tree. Our Great Lamp is failing.");
    await s.say("Nona", "Then I will help you get your lampsap, and later you will help me get home. A fair trade between a cat and a candle.");
    s.flag("metNona");
    await s.join("nona", Math.max(2, s.st.members.wick.lvl));
    await s.tell("^yNona^0 heals with ^yPatch^0. ^yNinth Life^0 spends one of her tails to revive a fallen ally. Tails come back when you rest at a lamp.");
  };
  var mothTrigger = async (s) => {
    if (f(s, "mothDead")) return;
    if (!f(s, "metNona")) {
      await s.tell("A huge grey moth hangs from the Antenna Tree, drinking. Its wings are the size of barn doors. Wick backs away slowly.");
      await s.say("Wick", "Not alone. Not like this. Something west of the path was calling for help earlier.");
      await s.movePlayer("d");
      return;
    }
    s.music("boss");
    await s.tell("The Antenna Tree hums a broken song. Clinging to its trunk is a grey moth as big as a house, its proboscis sunk deep into the bark.");
    await s.say("Nona", "It is drinking the tree's color. The sap goes grey where it feeds. That is not a moth, Wick. That is a scout.");
    await s.say("Nona", "When it beats its wings to gather dust, Guard. Trust me on this. I have been hit by that dust before, and I am made of metal.");
    const r = await s.battle("boss1");
    if (r !== "win") return;
    s.flag("mothDead");
    s.setEnt("boss", { hidden: true });
    await s.tell("The Grey Moth crumbles into lint. The Antenna Tree shudders, and amber sap wells up where the proboscis was.");
    await s.give("lampsap");
    await s.say("Nona", "Wick. A scout means a swarm is coming, and a swarm goes for the brightest place it can find.");
    await s.say("Wick", "The village. The lamp is failing.");
    await s.say("Nona", "Run.");
    s.flag("returned");
    await s.warp("edgewick", "w", "down");
  };
  var hollow = {
    id: "hollow",
    name: "The Hollow Wood",
    music: "wood",
    rows: HOLLOW,
    under: ",",
    outside: "Y",
    dark: 2.5,
    legend: { ":": { kind: "path", enc: true } },
    theme: {
      tall: ["k", "e1", "g1"],
      path: ["k", "n1", "n2"],
      pine: ["k", "e1", "g1"],
      antenna: ["k", "g1", "r2"],
      rock: ["k", "g1", "g2"],
      ground: ["k", "e1", "g1"]
    },
    enc: { rate: 0.13, groups: [["wolf1", 2], ["wolf2", 3], ["moth2", 3], ["newt2", 2], ["pup1", 2], ["crab1", 2], ["pup3", 1]] },
    ents: [
      { id: "exit", at: "z", kind: "warp", to: ["edgewick", "w", "down"], under: ":" },
      { id: "lamp1", at: "1", kind: "lamp" },
      { id: "lamp2", at: "2", kind: "lamp" },
      { id: "lamp3", at: "3", kind: "lamp" },
      { id: "tree", at: "t", kind: "npc", spr: NPC.antennaTree, talk: async (s) => {
        if (f(s, "mothDead")) await s.tell("The Antenna Tree hums a steady tone now. Somewhere very far away, a station plays a song about going home.");
        else await s.tell("The Antenna Tree hums a broken song.");
      } },
      { id: "boss", at: "b", kind: "trigger", step: mothTrigger },
      { id: "nona", at: "n", kind: "npc", spr: NPC.nonaHurt, talk: meetNona, when: (st) => !st.flags.metNona },
      { id: "stag", at: "s", kind: "npc", spr: { g: "monster", seed: "gloam_stag", pal: ["k", "g1", "w"], o: { shape: "tall" } }, when: (st) => !st.flags.stagDead, talk: async (s) => {
        await s.tell("A grey stag blocks the narrow trail. Its antlers crackle with a station that went off the air long ago.");
        const i = await s.ask("Fight the Gloam Stag?", ["Fight", "Leave it"]);
        if (i !== 0) return;
        const r = await s.battle("stag");
        if (r === "win") {
          s.flag("stagDead");
          await s.tell("The stag dissolves. The trail behind it is clear.");
        }
      } },
      { id: "chestF", at: "f", kind: "chest", gold: 40 },
      { id: "chestC", at: "c", kind: "chest", item: "wool_scarf" },
      { id: "chestD", at: "d", kind: "chest", item: "tallow", n: 2 },
      { id: "chestE", at: "e", kind: "chest", item: "ink_vial", n: 2 }
    ]
  };
  var maps = [edgewick, granhouse, edgeshop, hollow];
  var chapter = {
    title: "Misprint",
    stage: "The ordinary world",
    blurb: "Edgewick sits at the very edge of the world. Wick keeps its lamps lit.",
    recruit: "nona",
    ready: true,
    startMap: "edgewick",
    startMarker: "a",
    intro: async (s) => {
      await s.tell("Edgewick sits at the very edge of the world. Past its last lamp there is nothing. Not dark. Nothing.");
      await s.tell("Every person the Loom prints gets three inks: black, and two hues. Wick got black and amber, and then the Loom stopped.");
      await s.say("Gran Umber", "Wick! Dusk already. Light the three Edge Lamps along the cliff before the Void gets curious.", NPC.gran);
      await s.say("Wick", "On it, Gran.");
    },
    objective: (st) => {
      const fl = st.flags;
      if (!fl.lampsDone) return "Light the three Edge Lamps along the east cliff.";
      if (!fl.sent) return "Tell Gran, inside the Lamp House, that the lamps are lit.";
      if (!fl.metNona) return "Something fell into the Hollow Wood, north of the village. The lampsap grows there too.";
      if (!fl.mothDead) return "Reach the Antenna Tree at the heart of the Hollow Wood and take its lampsap.";
      if (!fl.refused) return "Get home. Check on Gran.";
      if (!fl.relit) return "Relight the Great Lamp in the square with the lampsap.";
      if (!fl.accepted) return "Talk to Nona by the Great Lamp.";
      return "Leave Edgewick by the west road.";
    },
    route: [
      { map: "edgewick", ent: "lamp1" },
      { map: "edgewick", ent: "lamp2" },
      { map: "edgewick", ent: "lamp3" },
      { map: "edgewick", warp: "granDoor" },
      { map: "granhouse", ent: "gran" },
      { map: "granhouse", warp: "door" },
      { map: "edgewick", ent: "north" },
      { map: "hollow", ent: "lamp1" },
      { map: "hollow", ent: "lamp2" },
      { map: "hollow", ent: "nona" },
      { map: "hollow", ent: "lamp3" },
      { map: "hollow", ent: "boss" },
      { map: "edgewick", warp: "granDoor" },
      { map: "granhouse", ent: "granGrey" },
      { map: "granhouse", warp: "door" },
      { map: "edgewick", ent: "greatLampOut" },
      { map: "edgewick", ent: "nona" },
      { map: "edgewick", ent: "west" }
    ]
  };

  // src/maps/ch2.ts
  var ch2_exports = {};
  __export(ch2_exports, {
    chapter: () => chapter2,
    maps: () => maps2
  });

  // src/maps/grid.ts
  var Grid = class _Grid {
    constructor(w, h2, fill2) {
      __publicField(this, "w", w);
      __publicField(this, "h", h2);
      __publicField(this, "cells");
      this.cells = Array.from({ length: h2 }, () => Array.from({ length: w }, () => fill2));
    }
    static from(rows) {
      const w = Math.max(...rows.map((r) => r.length));
      const g = new _Grid(w, rows.length, " ");
      rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) g.cells[y][x] = r[x];
      });
      return g;
    }
    in(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }
    get(x, y) {
      return this.in(x, y) ? this.cells[y][x] : "";
    }
    put(x, y, c) {
      if (this.in(x, y)) this.cells[y][x] = c;
      return this;
    }
    rect(x, y, w, h2, c) {
      for (let j = y; j < y + h2; j++) for (let i = x; i < x + w; i++) this.put(i, j, c);
      return this;
    }
    frame(x, y, w, h2, c) {
      for (let i = x; i < x + w; i++) {
        this.put(i, y, c);
        this.put(i, y + h2 - 1, c);
      }
      for (let j = y; j < y + h2; j++) {
        this.put(x, j, c);
        this.put(x + w - 1, j, c);
      }
      return this;
    }
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.put(x, y, c);
      }
      return this;
    }
    /** Draws straight Manhattan segments through each point in turn. */
    path(pts, c, width = 1) {
      for (let i = 0; i < pts.length - 1; i++) {
        let [x, y] = pts[i];
        const [tx, ty] = pts[i + 1];
        for (; ; ) {
          for (let a = 0; a < width; a++) for (let b2 = 0; b2 < width; b2++) this.put(x + a, y + b2, c);
          if (x === tx && y === ty) break;
          if (x !== tx) x += Math.sign(tx - x);
          else y += Math.sign(ty - y);
        }
      }
      return this;
    }
    /** Replaces cells of kind `on` (or any if omitted) with `c` at probability `p`. */
    scatter(x, y, w, h2, c, p2, seed, on) {
      const r = new Rng(seed);
      for (let j = y; j < y + h2; j++) for (let i = x; i < x + w; i++) {
        if (!this.in(i, j)) continue;
        if (on !== void 0 && !on.includes(this.cells[j][i])) continue;
        if (r.next() < p2) this.cells[j][i] = c;
      }
      return this;
    }
    /** Softens the border between two kinds so edges look organic. */
    roughen(a, b2, p2, seed) {
      const r = new Rng(seed);
      const copy = this.cells.map((row) => [...row]);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (copy[y][x] !== a) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => copy[y + dy]?.[x + dx] === b2);
        if (nb && r.next() < p2) this.cells[y][x] = b2;
      }
      return this;
    }
    text(x, y, rows) {
      rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) if (r[i] !== "?") this.put(x + i, y + j, r[i]);
      });
      return this;
    }
    rows() {
      return this.cells.map((r) => r.join(""));
    }
  };

  // src/maps/ch2.ts
  var f2 = (s, k) => s.has(k);
  function buildFizz() {
    const g = new Grid(46, 32, "~");
    g.rect(12, 1, 34, 30, ".");
    g.rect(6, 14, 6, 16, ".");
    g.rect(1, 1, 10, 10, ".");
    g.rect(1, 14, 4, 16, ".");
    g.scatter(12, 1, 34, 30, "&", 0.5, 7, ".");
    g.scatter(6, 14, 6, 16, ",", 0.45, 8, ".");
    g.scatter(1, 1, 10, 10, ",", 0.35, 9, ".");
    g.scatter(1, 14, 4, 16, ",", 0.3, 12, ".");
    g.ellipse(35, 24, 3.5, 2.5, "~");
    g.ellipse(20, 23, 2.5, 1.6, "~");
    g.ellipse(38, 6, 2.5, 1.5, "~");
    g.scatter(13, 1, 32, 1, "T", 0.5, 10);
    g.scatter(13, 29, 32, 2, "T", 0.5, 11);
    g.scatter(44, 1, 2, 30, "T", 0.4, 13);
    g.rect(5, 12, 1, 18, "~");
    for (let y = 20; y <= 24; y++) g.put(5, y, "N");
    g.rect(11, 1, 1, 11, "~");
    g.put(11, 5, "Z");
    g.put(7, 11, "N").put(7, 12, ".").put(7, 13, ".");
    g.rect(12, 11, 14, 2, "~");
    g.put(13, 11, "L");
    g.put(13, 12, ".");
    g.rect(18, 2, 11, 6, ".");
    g.rect(19, 3, 9, 3, "^");
    g.rect(19, 6, 9, 1, "B");
    g.put(20, 6, "W").put(26, 6, "W").put(23, 6, "d");
    g.rect(28, 1, 1, 5, "A");
    g.path([[45, 16], [28, 16], [28, 8], [23, 8], [23, 7]], "-");
    g.path([[23, 8], [16, 8], [16, 5], [12, 5]], ":");
    g.rect(39, 25, 6, 5, "T");
    g.rect(40, 26, 4, 3, ".");
    g.put(39, 27, "E");
    g.put(38, 27, ".");
    g.put(4, 4, "U");
    g.put(17, 10, "J");
    g.put(45, 16, "e");
    g.put(0, 22, "w");
    g.path([[1, 22], [4, 22]], ":");
    g.put(42, 27, "m");
    g.put(8, 8, "k");
    g.put(20, 27, "n");
    g.put(2, 16, "o");
    g.put(43, 3, "q");
    g.put(34, 9, "h");
    g.put(32, 19, "g");
    g.put(38, 13, "f");
    g.put(15, 25, "j");
    g.put(7, 19, "c");
    g.put(43, 15, "s");
    g.put(41, 18, "1");
    g.put(9, 27, "2");
    g.put(3, 9, "r");
    return g.rows();
  }
  var hueTutorial = async (s) => {
    if (f2(s, "hueTut")) return;
    s.flag("hueTut");
    s.mech("hues");
    await s.tell("West of Edgewick the world gets loud. The grass is two greens. The mud is three browns. A frog goes by in five colors and seems embarrassed about it.");
    await s.say("Wick", "Everything out here is so... finished.");
    await s.say("Nona", "Out here, colors are not decoration. Listen. Every creature the Loom prints has two hues, and hues fight.");
    await s.say("Nona", "A hue hits its opposite for half again as much. It hits its own hue for a quarter less. Red and cyan are opposites. So are amber and blue, and green and violet.");
    await s.say("Nona", "And a creature's two colors are its hues. So look at what you are fighting. Its colors tell you what hurts it.");
    await s.say("Wick", "My Kindle is amber. So it hits blue things hard.");
    await s.say("Nona", "And blue things hit you hard, misprint. Amber is your only hue. Keep an eye on the blue ones.");
    await s.tell("^yHues^0 are now shown in the menu. While picking a target, the damage multiplier appears next to its name.");
  };
  var tintRecruit = async (s) => {
    if (f2(s, "tintJoined")) {
      await s.say("Tint", "What? I'm right here. I'm always right here, unless I'm painting something.");
      return;
    }
    await s.say("Tint", "I don't CARE if it's against station policy, Ribbit. Broadcast it. HUE THIEF LOOSE IN PRISMOUTH. LOCK UP YOUR REDS.");
    await s.say("DJ Ribbit", "Babe, it's a music station. We play the silence between the static. It's very popular with the frogs.");
    await s.tell("The girl in the bubble helmet turns around. Her robe is violet, her hair is green, and paint is dripping off the brush she carries like a broom.");
    await s.say("Tint", "Whoa. You're two colors. Did somebody leave you out in the sun?");
    await s.say("Nona", "Wick is a Duotone. Printed that way.");
    await s.say("Tint", "Huh. Neat. Low maintenance.");
    await s.tell("Wick waits for the pity. It doesn't come.");
    await s.say("Tint", "I'm Tint. I paint things. Lately I paint OVER things, because something is stealing the colors off Prismouth.");
    await s.say("Tint", "The harbor went grey on Tuesday. My lighthouse lost its stripes on Wednesday. It's Thursday, and I'd like to keep my face.");
    await s.say("Nona", "We are going to Prismouth ourselves. We need to read the Lens.");
    await s.say("Tint", "Then we're going the same way, and I hit things with paint. Come on.");
    s.flag("tintJoined");
    await s.join("tint", Math.max(5, s.st.members.wick.lvl));
    await s.tell("^yTint^0 carries one hue on her brush at a time. ^yLoad Brush^0 picks it. ^yDaub^0 hits with it. ^ySplash^0 repaints a foe's first hue to whatever is loaded, so the rest of the party can hit its new weakness.");
    await s.say("Tint", "One problem. Prismouth customs only lets in tinted people. This week's tint is violet. There's a violet pool out on the little island, but the island has an amber lock on it.");
    await s.say("Tint", "Step in a pool and you take its color. A gate only opens for its own color. And watch out for the cyan puddle on the south crossing. It'll wash you right out.");
  };
  var fizz = {
    id: "fizz",
    name: "The Fizz",
    music: "marsh",
    rows: buildFizz(),
    under: ".",
    outside: "~",
    bg: "tree",
    legend: {
      U: { kind: "ground", paint: "M" },
      J: { kind: "ground", paint: "Y" },
      L: { kind: "ground", paint: "C" },
      N: { kind: "gate", gate: "M" },
      Z: { kind: "gate", gate: "Y" },
      E: { kind: "gate", gate: "C" }
    },
    theme: {
      ground: ["k", "e1", "n1"],
      static: ["k", "c1", "c3"],
      tall: ["k", "e1", "e2"],
      water: ["k", "b1", "b2"],
      tree: ["k", "n1", "e1"],
      planks: ["k", "n1", "n2"],
      path: ["k", "n1", "c1"],
      roof: ["k", "b1", "c2"],
      brick: ["k", "n1", "n2"],
      antenna: ["k", "g1", "y2"],
      window: ["k", "n1", "y3"]
    },
    enc: { rate: 0.12, groups: [["bog2", 3], ["fish2", 3], ["heron", 3], ["newt3", 2], ["slime3", 2], ["wisp2", 2]] },
    ents: [
      { id: "east", at: "e", kind: "warp", to: ["edgewick", "x", "right"], under: "-" },
      { id: "west", at: "w", kind: "warp", to: ["prismouth", "e", "left"], under: ":" },
      { id: "door", at: "d", kind: "warp", to: ["radio", "d", "up"], under: "D" },
      { id: "lamp1", at: "1", kind: "lamp" },
      { id: "lamp2", at: "2", kind: "lamp" },
      { id: "sign", at: "s", kind: "sign", text: "THE FIZZ. Frog Radio Station, north. Prismouth, west, through customs. Please do not lick the static." },
      { id: "chestM", at: "m", kind: "chest", item: "blue_wick" },
      { id: "chestK", at: "k", kind: "chest", item: "feed_horn" },
      { id: "chestN", at: "n", kind: "chest", gold: 60 },
      { id: "chestO", at: "o", kind: "chest", item: "relight" },
      { id: "chestQ", at: "q", kind: "chest", item: "ink_vial", n: 2 },
      { id: "chestR", at: "r", kind: "chest", item: "prism", n: 2 },
      {
        id: "dish",
        at: "h",
        kind: "npc",
        spr: NPC.dish,
        talk: async (s) => {
          if (f2(s, "dishDone")) {
            await s.say("Dishwater", "I CAN HEAR THE SKY AGAIN. IT IS STILL SAYING RECLAIM. I LIKED IT BETTER DEAF.");
            return;
          }
          if (s.hasItem("feed_horn")) {
            s.take("feed_horn");
            s.flag("dishDone");
            await s.tell("Wick fits the feed horn back onto the dish. It shudders, points itself at the sky, and listens.");
            await s.say("Dishwater", "SIGNAL. SIGNAL! THANK YOU, SMALL AMBER PERSON. TAKE THIS. IT FELL OUT OF A PASSING SATELLITE. I ASSUME IT IS VALUABLE.");
            await s.give("ink_ring");
            await s.say("Dishwater", "BEFORE I WENT DEAF, THE SKY WAS SAYING ONE WORD, OVER AND OVER. THE WORD WAS: RECLAIM.");
            await s.say("Nona", "...Reclaim. That is a Loom word. It is what we do with scrap.");
            return;
          }
          await s.say("Dishwater", "I USED TO TALK TO THE SKY. NOW I HEAR ONLY FROGS. MY FEED HORN FELL OFF. I THINK A HERON TOOK IT TO THE ISLAND. HERONS LOVE CONES.");
        }
      },
      {
        id: "grayling",
        at: "g",
        kind: "npc",
        spr: NPC.grayling,
        talk: async (s) => {
          if (f2(s, "metGrayling")) {
            await s.say("Brother Grayling", "Carillon, child. When the bells ring grey, you will understand.");
            return;
          }
          s.flag("metGrayling");
          await s.tell("A pale man in a grey robe hums a single note. Every frog within earshot goes quiet.");
          await s.say("Brother Grayling", "Peace, travelers. I walk to Carillon, to sing with the Choir. Color is a noise, you know. We sing it quiet.");
          await s.say("Brother Grayling", "And you. Two inks. You are almost quiet already. The Choir would love you.");
          await s.say("Tint", "Wow. Okay. Walk faster, please.");
        }
      },
      { id: "frog1", at: "f", kind: "npc", spr: NPC.frog, wander: true, talk: async (s) => s.say("Frog", "Ribbit. That is not a word. It is my callsign.") },
      { id: "frog2", at: "j", kind: "npc", spr: NPC.frogB, wander: true, talk: async (s) => s.say("Frog", "The static here is very nutritious. I eat it and I broadcast it. The circle of life, but on AM.") },
      {
        id: "customs",
        at: "c",
        kind: "npc",
        spr: NPC.customs,
        talk: async (s) => {
          const tinted = s.st.tint === "M";
          if (tinted) await s.say("Customs Frog", "Violet! Correct tint. Welcome to Prismouth. Please enjoy our colors while we still have them.");
          else await s.say("Customs Frog", "Prismouth Customs. Tinted persons only. This week's tint is violet. Last week it was enthusiasm, but we couldn't measure it.");
        }
      }
    ],
    enter: hueTutorial
  };
  var radio = {
    id: "radio",
    name: "Frog Radio",
    music: "marsh",
    under: "-",
    outside: "#",
    rows: [
      "############",
      "#WW##MM##WW#",
      "#----MM----#",
      "#-t--r-----#",
      "#----------#",
      "#-CCsCC--l-#",
      "#----------#",
      "#####d######"
    ],
    legend: { C: { kind: "fence", solid: true } },
    theme: { wall: ["k", "c1", "c2"], planks: ["k", "n1", "n2"], fence: ["k", "n1", "e2"], machine: ["k", "g1", "m2"], window: ["k", "n1", "y3"] },
    ents: [
      { id: "door", at: "d", kind: "warp", to: ["fizz", "d", "down"], under: "D" },
      { id: "tint", at: "t", kind: "npc", spr: { g: "human", seed: "tint", pal: ["k", "m2", "e3"], o: { head: "bubble", torso: "robe", legs: "skirt", held: "brush" } }, when: (st) => !st.flags.tintJoined, talk: tintRecruit },
      { id: "ribbit", at: "r", kind: "npc", spr: NPC.ribbit, talk: async (s) => {
        if (!f2(s, "tintJoined")) {
          await s.say("DJ Ribbit", "You're listening to Frog Radio. We're dealing with a situation. The situation is wearing a bubble helmet.");
          return;
        }
        await s.say("DJ Ribbit", "You're listening to Frog Radio, the only station in the Fizz that plays the silence between the static. Next up: forty minutes of that.");
      } },
      { id: "shop", at: "s", kind: "npc", spr: NPC.frog, under: "C", talk: async (s) => {
        await s.say("Frog", "Trading post. We take gold. We used to take flies, but the economy moved on.");
        await s.shop("fizz");
      } },
      { id: "lamp", at: "l", kind: "lamp" }
    ]
  };
  function house(g, x, y, w, wall, door) {
    g.rect(x, y, w, 2, "^");
    g.rect(x, y + 2, w, 1, wall);
    g.put(x + 1, y + 2, "W");
    g.put(x + w - 2, y + 2, "W");
    if (door) g.put(x + Math.floor(w / 2), y + 2, door);
  }
  function buildPrismouth() {
    const g = new Grid(36, 28, "~");
    g.rect(0, 6, 36, 19, ".");
    g.rect(14, 1, 8, 6, ".");
    g.rect(16, 1, 4, 4, "P");
    g.put(17, 4, "d");
    g.scatter(0, 6, 36, 19, '"', 0.05, 21, ".");
    g.path([[1, 18], [34, 18]], ":");
    g.path([[17, 5], [17, 18]], ":");
    g.ellipse(17, 12, 4, 2.5, ":");
    g.put(17, 12, "~");
    house(g, 3, 7, 6, "V");
    house(g, 26, 7, 6, "B");
    house(g, 3, 12, 5, "B");
    house(g, 27, 12, 6, "V");
    house(g, 9, 19, 6, "B");
    house(g, 22, 19, 7, "B");
    g.rect(0, 25, 36, 3, "~");
    for (const px of [6, 18, 30]) g.rect(px, 24, 2, 4, "-");
    g.scatter(0, 6, 36, 1, "%", 0.4, 22, '."');
    g.put(35, 18, "e");
    g.put(0, 18, "x");
    g.put(12, 23, "s");
    g.put(25, 23, "i");
    g.put(19, 24, "o");
    g.put(25, 10, "u");
    g.put(10, 16, "p");
    g.put(31, 25, "c");
    g.put(21, 15, "t");
    g.put(14, 16, "l");
    g.put(33, 21, "h");
    g.put(2, 21, "k");
    g.put(18, 6, "y");
    return g.rows();
  }
  var innkeeper = async (s) => {
    await s.say("Marl", "The Primer. Best beds in Prismouth. Every sheet a different color, so you always know which sheet you are in. Twenty-five gold a night.");
    const i = await s.ask("Rest for 25 gold?", ["Rest", "No thanks"]);
    if (i !== 0) return;
    if (s.st.gold < 25) {
      await s.say("Marl", "Short on gold? Sleep on the pier. It is also colorful. Mostly blue.");
      return;
    }
    await s.gold(-25, true);
    await s.fadeOut();
    s.heal();
    s.save();
    await s.fadeIn();
    await s.tell("The party wakes up rested. Progress saved.");
  };
  var lighthouseDoor = async (s) => {
    if (!f2(s, "sawThief")) {
      s.flag("sawThief");
      s.shake(20);
      await s.tell("Something huge is wrapped around the lighthouse. Eight arms, each a different stolen color, are pulling the stripes off the tower one by one.");
      await s.say("Harbormistress Coral", "It's on the lighthouse! The thief is going for the Lens!");
      await s.say("Tint", "That's MY lighthouse. Get off my lighthouse!");
      await s.say("Nona", "If it drinks the Lens, Prismouth goes dark and we lose our only way to read the sky. Up the stairs. Quickly.");
    }
    await s.warp("lighthouse", "e", "up");
  };
  var westRoad = async (s) => {
    if (s.st.chapter >= 3) {
      await s.warp("carillonRoad", "e", "left");
      return;
    }
    if (!f2(s, "lampPainted")) {
      await s.say("Wick", "Not yet. We came for the Lens.");
      await s.movePlayer("r");
      return;
    }
    await s.tell("The road west climbs out of Prismouth toward a far-off sound of bells.");
    await nextChapter(s, 3);
  };
  var tintLamp = async (s) => {
    if (f2(s, "lampPainted")) {
      await s.say("Tint", "The road west goes to Carillon. That's where the bells are, and bells are where the Choir is. Let's go ruin a hymn.");
      return;
    }
    s.flag("lampPainted");
    s.music("town");
    await s.say("Tint", "Hold still. Not you. Your lamp.");
    await s.tell("Tint flicks her brush. A thin violet stripe appears on the glass of Wick's lamp.");
    await s.say("Wick", "You painted it.");
    await s.say("Tint", "I painted your lamp, not you. You're fine how you are. The lamp looked lonely.");
    await s.say("Wick", "I always thought colors were something you had or you didn't.");
    await s.say("Tint", "Colors are for sharing. That's why there are so many of them.");
    await s.say("Nona", "The Lens shard points west and up. West is Carillon, where the Church of the Loom keeps the Tether gate. Up is the Loom.");
    await s.say("Tint", "Then we go west. Somebody stole my stripes and now somebody's stealing the sky. I'm not letting grey win twice.");
  };
  var prismouth = {
    id: "prismouth",
    name: "Prismouth",
    music: "town",
    rows: buildPrismouth(),
    under: ".",
    outside: "~",
    bg: "bush",
    legend: { V: { kind: "wall", solid: true } },
    theme: {
      ground: ["k", "e1", "e2"],
      flowers: ["k", "e1", "m3"],
      path: ["k", "g2", "w"],
      brick: ["k", "m1", "m2"],
      wall: ["k", "g1", "g2"],
      roof: ["k", "c1", "c2"],
      window: ["k", "b1", "y3"],
      pillar: ["k", "w", "r2"],
      water: ["k", "b1", "c2"],
      planks: ["k", "n1", "n2"],
      bush: ["k", "e1", "e3"]
    },
    ents: [
      { id: "east", at: "e", kind: "warp", to: ["fizz", "w", "right"], under: ":" },
      { id: "west", at: "x", kind: "trigger", step: westRoad, under: ":" },
      { id: "door", at: "d", kind: "trigger", step: lighthouseDoor, under: "D" },
      { id: "shop", at: "s", kind: "npc", spr: NPC.paintshop, talk: async (s) => {
        await s.say("Swatch", "Prismouth Paints! Every color we have left, at prices that reflect how few that is.");
        await s.shop("prismouth");
      } },
      { id: "inn", at: "i", kind: "npc", spr: NPC.innkeeper, talk: innkeeper },
      { id: "coral", at: "o", kind: "npc", spr: NPC.coral, talk: async (s) => {
        if (f2(s, "octoDead")) await s.say("Harbormistress Coral", "The harbor is blue again. I have never been so happy to see blue. Blue is the second color I have ever cried about.");
        else await s.say("Harbormistress Coral", "The lighthouse is Tint's. The Lens is everyone's. The thief is nobody's, and I would like it to stay that way.");
      } },
      { id: "ulla", at: "u", kind: "npc", spr: NPC.ulla, talk: async (s) => s.say("Ulla", f2(s, "octoDead") ? "The wave came back! Well. It is still moving. I will get it one day." : "I have painted the same wave for eleven years. It keeps moving. Now it is grey and it STILL keeps moving.") },
      { id: "pipGrey", at: "p", kind: "npc", spr: NPC.pipGrey, when: (st) => !st.flags.octoDead, talk: async (s) => s.say("Pip", "The thief took my colors. Now I'm the same as the pavement. Mum keeps stepping on me.") },
      { id: "pip", at: "p", kind: "npc", spr: NPC.pip, when: (st) => !!st.flags.octoDead, talk: async (s) => {
        await s.say("Pip", "I'm orange! And green! Mum says I'm too loud now. I say that's the point.");
        if (!f2(s, "pipGift")) {
          s.flag("pipGift");
          await s.say("Pip", "Here. I found this in the gutter when I was pavement. Pavement finds lots of stuff.");
          await s.give("candle", 2);
        }
      } },
      { id: "captain", at: "c", kind: "npc", spr: NPC.captain, talk: async (s) => s.say("Captain Nebb", "My beard is a nebula. It came with the ship. The ship is gone. The beard stays. Stars get in my soup.") },
      { id: "tint", at: "t", kind: "npc", spr: { g: "human", seed: "tint", pal: ["k", "m2", "e3"], o: { head: "bubble", torso: "robe", legs: "skirt", held: "brush" } }, when: (st) => !!st.flags.octoDead, talk: tintLamp },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "boat", at: "h", kind: "prop", spr: NPC.boat, talk: async (s) => s.tell("A rowboat painted in seven colors. Someone has written HUE THIEF KEEP OUT on the side in an eighth.") },
      { id: "chestK", at: "k", kind: "chest", item: "paint_bomb" },
      { id: "chestY", at: "y", kind: "chest", gold: 90 }
    ]
  };
  var LIGHTHOUSE = [
    "###########",
    "#_________#",
    "#____l____#",
    "#_________#",
    "#____b____#",
    "#####_#####",
    "#_________#",
    "#_#######_#",
    "#_#_____#_#",
    "#_#_c___#_#",
    "#_###_###_#",
    "#_________#",
    "#########_#",
    "#_______#_#",
    "#_#####_#_#",
    "#_#_____#_#",
    "#_#_#####_#",
    "#___#_____#",
    "#####_###_#",
    "#_______#_#",
    "#_#####___#",
    "#___1_____#",
    "#____e____#",
    "###########"
  ];
  var octoFight = async (s) => {
    if (f2(s, "octoDead")) return;
    s.music("boss");
    await s.tell("At the top of the tower the Lens turns slowly, throwing light in six directions. Wrapped around it is the Hue Thief.");
    await s.say("Octachrome", "Mmmm. More. A lighthouse full of color, and here comes a snack with two colors. Only two? How sad. How easy.");
    await s.say("Tint", "Watch its colors. It keeps changing them. Whatever it's wearing is what it's weak against the opposite of.");
    await s.say("Nona", "In plain words: look at it before you hit it.");
    const r = await s.battle("boss2");
    if (r !== "win") return;
    s.flag("octoDead");
    s.shake(30);
    s.sfx("break");
    await s.flash("w");
    await s.tell("Octachrome bursts. Eight stolen colors spray out over Prismouth like fireworks and settle back where they belong.");
    await s.tell("Then the Lens, strained too long, cracks straight through.");
    await s.tell("The broken Lens throws one last picture onto the wall. A city built inside the ribs of a dead giant. A choir in grey robes, singing color out of the air. On top of a bell tower, a figure in grey and white, looking up.");
    await s.say("Nona", "The Church of the Loom. I know those bells. They ring on the Loom's own frequency.");
    await s.say("Wick", "Then the grey is coming from the Church?");
    await s.say("Nona", "From the Church, or through it.");
    await s.tell("The light goes out. The lighthouse is dark for the first time in a hundred years.");
    await s.say("Tint", "...That was my lighthouse.");
    await s.tell("Tint picks up a shard of the Lens. It glints and turns in her hand until it points west and up.");
    await s.say("Tint", "It still points somewhere. Fine. Then I'm going where it points.");
    await s.give("lens_shard");
    await s.warp("prismouth", "d", "down");
  };
  var lighthouse = {
    id: "lighthouse",
    name: "Tint's Lighthouse",
    music: "town",
    rows: LIGHTHOUSE,
    under: "_",
    outside: "#",
    bg: "pillar",
    legend: { "_": { kind: "floor", enc: true } },
    theme: { wall: ["k", "r1", "w"], floor: ["k", "n1", "r1"], pillar: ["k", "w", "r2"] },
    enc: { rate: 0.1, groups: [["wisp2", 3], ["wisp3", 2], ["newt3", 1]] },
    ents: [
      { id: "exit", at: "e", kind: "warp", to: ["prismouth", "d", "down"], under: "_" },
      { id: "lens", at: "l", kind: "npc", spr: NPC.lens, when: (st) => !st.flags.octoDead, talk: async (s) => s.tell("The Lens hums. It is too bright to look at directly.") },
      { id: "lensCracked", at: "l", kind: "npc", spr: NPC.lensCracked, when: (st) => !!st.flags.octoDead, talk: async (s) => s.tell("The cracked Lens is dark. A piece is missing. Tint has it.") },
      { id: "boss", at: "b", kind: "trigger", step: octoFight },
      { id: "chest", at: "c", kind: "chest", item: "violet_bristle" },
      { id: "lamp", at: "1", kind: "lamp" }
    ]
  };
  var maps2 = [fizz, radio, prismouth, lighthouse];
  var chapter2 = {
    title: "Hue and Cry",
    stage: "Crossing the threshold",
    blurb: "Past the last lamp, the world is loud with color, and every color is a weakness.",
    recruit: "tint",
    ready: true,
    startMap: "fizz",
    startMarker: "e",
    objective: (st) => {
      const fl = st.flags;
      if (!fl.tintJoined) return "Cross the Fizz. The radio station is north of the boardwalk.";
      if (st.tint !== "M" && !fl.sawThief) return "Prismouth customs wants a violet tint. The violet pool is on the island behind the amber gate. The amber pool is near the station.";
      if (!fl.octoDead) return "Get through customs to Prismouth and climb Tint's lighthouse.";
      if (!fl.lampPainted) return "Find Tint in the square.";
      return "Take the west road out of Prismouth toward Carillon.";
    },
    route: [
      { map: "fizz", warp: "door" },
      { map: "radio", ent: "tint" },
      { map: "radio", ent: "shop" },
      { map: "radio", warp: "door" },
      { map: "fizz", ent: "dish" },
      { map: "fizz", warp: "west" },
      { map: "prismouth", ent: "shop" },
      { map: "prismouth", ent: "door" },
      { map: "lighthouse", ent: "boss" },
      { map: "prismouth", ent: "pip" },
      { map: "prismouth", ent: "tint" },
      { map: "prismouth", ent: "west" }
    ]
  };

  // src/maps/ch3.ts
  var ch3_exports = {};
  __export(ch3_exports, {
    chapter: () => chapter3,
    maps: () => maps3
  });
  var f3 = (s, k) => s.has(k);
  function buildRoad() {
    const g = new Grid(40, 18, "R");
    g.rect(1, 1, 38, 16, ".");
    g.scatter(1, 1, 38, 16, ",", 0.55, 31, ".");
    g.scatter(1, 1, 38, 16, "R", 0.07, 32, ",.");
    g.scatter(1, 1, 38, 16, "Y", 0.05, 33, ",.");
    g.path([[39, 9], [30, 9], [30, 5], [18, 5], [18, 12], [6, 12], [6, 9], [0, 9]], ":");
    g.put(39, 9, "e").put(0, 9, "w");
    g.put(19, 8, "l");
    g.put(35, 3, "a").put(8, 15, "b");
    g.put(25, 6, "p").put(10, 11, "h");
    g.put(29, 4, "s").put(17, 13, "t");
    return g.rows();
  }
  var road = {
    id: "carillonRoad",
    name: "The Pilgrim Road",
    music: "church",
    rows: buildRoad(),
    under: ".",
    outside: "R",
    bg: "rock",
    theme: {
      ground: ["k", "n1", "e1"],
      tall: ["k", "n1", "y1"],
      path: ["k", "n2", "n3"],
      rock: ["k", "g1", "n2"],
      pine: ["k", "e1", "n1"]
    },
    enc: { rate: 0.12, groups: [["ghoul2", 3], ["mimic2", 3], ["pew3", 2]] },
    ents: [
      { id: "east", at: "e", kind: "warp", to: ["prismouth", "x", "left"], under: ":" },
      { id: "west", at: "w", kind: "warp", to: ["carillon", "e", "left"], under: ":" },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "chestA", at: "a", kind: "chest", item: "candle", n: 2 },
      { id: "chestB", at: "b", kind: "chest", item: "pin", n: 2 },
      { id: "shrine1", at: "s", kind: "prop", spr: NPC.shrine, talk: async (s) => s.tell("A roadside shrine to the Loom. Someone has left an offering of a single blue thread. The shrine has turned it grey.") },
      { id: "shrine2", at: "t", kind: "prop", spr: NPC.shrine, talk: async (s) => s.tell("A carved plaque: THE LOOM GIVES. THE LOOM KEEPS. Below it, smaller and newer: THE LOOM TAKES BACK.") },
      { id: "pilgrim", at: "p", kind: "npc", spr: NPC.pilgrimB, talk: async (s) => {
        await s.say("Pilgrim", "We're going to Carillon for the Inking. You finish the Trial of Bells and the Choir blesses you with a brighter hue. I was printed rust and beige. I'd like to be something a bird would notice.");
        await s.say("Wick", "...A brighter hue. Anyone can get one?");
        await s.say("Pilgrim", "Anyone who finishes the Trial. My cousin went last spring. She hasn't written, but I'm sure she's very bright now.");
      } },
      { id: "hermit", at: "h", kind: "npc", spr: NPC.hermit, talk: async (s) => {
        await s.say("Hermit Oda", "You want to know what happens to the pilgrims? So did I. I went to Carillon forty years ago and I came back. That's the unusual part.");
        await s.say("Hermit Oda", "Listen to the bells. A bell that rings grey takes something with it when it rings. Don't let them ring you.");
      } }
    ]
  };
  function buildCarillon() {
    const g = new Grid(40, 30, "X");
    g.rect(1, 2, 38, 27, "_");
    for (const ry of [7, 12, 19, 25]) {
      g.rect(1, ry, 12, 1, "X");
      g.rect(27, ry, 12, 1, "X");
      for (const ax of [4, 10, 30, 36]) g.put(ax, ry, "_");
    }
    g.rect(14, 3, 12, 5, "^");
    g.rect(14, 8, 12, 1, "B");
    g.put(15, 8, "W").put(24, 8, "W").put(19, 8, "c");
    g.rect(13, 2, 1, 7, "P");
    g.rect(26, 2, 1, 7, "P");
    g.path([[39, 15], [0, 15]], ":");
    g.path([[19, 9], [19, 15]], ":");
    g.rect(3, 20, 7, 2, "^").rect(3, 22, 7, 1, "B").put(4, 22, "W").put(8, 22, "W");
    g.rect(29, 8, 7, 2, "^").rect(29, 10, 7, 1, "B").put(30, 10, "W").put(34, 10, "W");
    g.rect(28, 20, 10, 4, '"');
    g.put(29, 21, "q").put(31, 21, "r").put(33, 21, "s").put(35, 21, "t").put(30, 23, "u").put(34, 23, "v");
    g.put(39, 15, "e").put(0, 15, "g").put(2, 15, "z");
    g.put(6, 23, "i").put(32, 11, "k");
    g.put(22, 12, "a").put(9, 10, "o").put(17, 20, "b").put(24, 17, "h").put(33, 16, "m").put(7, 4, "y").put(22, 26, "n");
    g.put(16, 12, "l").put(36, 27, "j").put(2, 3, "x");
    return g.rows();
  }
  var tetherGate = async (s) => {
    if (s.st.chapter >= 4) {
      await s.warp("hourglass", "e", "left");
      return;
    }
    if (!f3(s, "escaped")) {
      await s.tell("A great iron gate in the giant's hip, marked THE TETHER ROAD. Two templars stand in front of it.");
      await s.say("Templar", "Pilgrim Seal, or turn around. The Tether is for the faithful.");
      await s.movePlayer("r");
      return;
    }
    await s.tell("Tint presses the stolen Seal against the lock. The gate grinds open onto a pale road running toward a desert that ticks.");
    await nextChapter(s, 4);
  };
  var cathedralDoor = async (s) => {
    if (f3(s, "escaped")) {
      await s.tell("The cathedral doors are chained shut. Grey dust drifts out from underneath.");
      await s.movePlayer("d");
      return;
    }
    if (!f3(s, "trialOpen")) {
      await s.say("Sister Vesper", "The Trial of Bells begins inside, pilgrim. Ring all three bells, climb to the belfry, and the Cantor himself will give you the Seal and your Inking.");
      s.flag("trialOpen");
    }
    await s.warp("cathedral", "e", "up");
  };
  var statue = (id, at, line) => ({
    id,
    at,
    kind: "prop",
    spr: NPC.greyPilgrim,
    talk: async (s) => {
      await s.tell(line);
      if (!f3(s, "sawGarden")) {
        s.flag("sawGarden");
        await s.say("Tint", "These aren't statues. Look at the faces. These are PEOPLE.");
        await s.say("Nona", "Greyed, like your grandmother, Wick. Every one of them.");
        await s.say("Wick", "The pilgrim on the road said her cousin came here for the Inking last spring.");
      }
    }
  });
  var carillon = {
    id: "carillon",
    name: "Carillon",
    music: "church",
    rows: buildCarillon(),
    under: "_",
    outside: "X",
    bg: "bone",
    theme: {
      bone: ["k", "g3", "w"],
      floor: ["k", "g1", "n1"],
      path: ["k", "n2", "g3"],
      roof: ["k", "b1", "b2"],
      brick: ["k", "g1", "b2"],
      pillar: ["k", "g2", "y2"],
      window: ["k", "b1", "y3"],
      flowers: ["k", "g1", "g3"]
    },
    ents: [
      { id: "east", at: "e", kind: "warp", to: ["carillonRoad", "w", "right"], under: ":" },
      { id: "gate", at: "g", kind: "trigger", step: tetherGate, under: ":" },
      { id: "escapeMark", at: "z", kind: "trigger", under: ":", step: async () => {
      } },
      { id: "door", at: "c", kind: "trigger", step: cathedralDoor, under: "D" },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "inn", at: "i", kind: "npc", spr: NPC.bellInn, talk: async (s) => {
        await s.say("Bellamy", "The Belfry Inn. Every room has a bell. Please do not ring it. Twenty-five gold.");
        if (await s.ask("Rest for 25 gold?", ["Rest", "No thanks"]) !== 0) return;
        if (s.st.gold < 25) {
          await s.say("Bellamy", "No gold, no bell. Sorry.");
          return;
        }
        await s.gold(-25, true);
        await s.fadeOut();
        s.heal();
        s.save();
        await s.fadeIn();
        await s.tell("The party rests. Nobody rings the bell. Progress saved.");
      } },
      { id: "shop", at: "k", kind: "npc", spr: NPC.relic, talk: async (s) => {
        await s.say("Reliquarian", "Relics, blessed tallow, and swords that have been prayed at. All sales are final and holy.");
        await s.shop("carillon");
      } },
      { id: "greeter", at: "a", kind: "npc", spr: NPC.greeter, talk: async (s) => {
        if (f3(s, "escaped")) {
          await s.say("Sister Vesper", "Heretic. The Bishop has named you. Every bell in Carillon knows your name now.");
          return;
        }
        await s.say("Sister Vesper", "Welcome to Carillon, pilgrims, city of the Colossus, first and last stop before the Loom. The Trial of Bells is in the cathedral.");
        await s.say("Sister Vesper", "Finish it and receive the Pilgrim Seal, which opens the Tether road, and your Inking, which makes you bright.");
        await s.say("Sister Vesper", "Oh. Oh, you poor thing, you're a Duotone. The Inking was MADE for people like you.");
        await s.tell("Wick says nothing. Wick's hand tightens on the lamp.");
      } },
      { id: "clapper", at: "o", kind: "npc", spr: NPC.clapper, talk: async (s) => {
        await s.say("Old Clapper", "EH? The Trial? THREE BELLS. ONE IN EACH WING. The first opens the west, the west opens the east, and when all three ring, the stairs open.");
        await s.say("Old Clapper", "I RANG THEM FOR SIXTY YEARS. NOW I CAN'T HEAR THEM. I THINK THAT'S WHY I'M STILL BROWN.");
      } },
      { id: "theologian", at: "b", kind: "npc", spr: NPC.theologian, talk: async (s) => {
        await s.say("Unit 9 of Doctrine", "Is the Loom a god or an appliance? I have argued both sides for forty years. My current position is: both, and it is broken.");
      } },
      { id: "oiler", at: "h", kind: "npc", spr: NPC.oiler, wander: true, talk: async (s) => {
        await s.say("Gim", "The giant's knee creaks every noon. I oil it. It's my whole job. It's a very big knee.");
        if (!f3(s, "gimGift")) {
          s.flag("gimGift");
          await s.say("Gim", "You look like you fight things. Here. Knee grease. It works on wounds too, probably.");
          await s.give("candle");
        }
      } },
      { id: "grayling", at: "m", kind: "npc", spr: NPC.grayling, talk: async (s) => {
        if (f3(s, "escaped")) {
          await s.say("Brother Grayling", "You broke the great bell. The quiet is coming anyway, child. It always comes.");
          return;
        }
        await s.say("Brother Grayling", "You came! And the loud girl, and the cat. The Choir sings tonight in the belfry. Finish your Trial and you will hear it up close.");
      } },
      { id: "pilgrim", at: "y", kind: "npc", spr: NPC.pilgrimA, talk: async (s) => s.say("Pilgrim", "I have been waiting in line for the Trial for six days. The line does not move. I think the line is part of the Trial.") },
      { id: "chestN", at: "n", kind: "chest", item: "relight" },
      { id: "chestJ", at: "j", kind: "chest", gold: 150 },
      { id: "chestX", at: "x", kind: "chest", item: "wool_scarf" },
      statue("s1", "q", "A grey pilgrim with arms raised, as if catching rain."),
      statue("s2", "r", "A grey pilgrim holding a grey child's hand."),
      statue("s3", "s", "A grey pilgrim. A tag on its robe reads: INKED."),
      statue("s4", "t", "A grey pilgrim smiling. It is the worst thing in the garden."),
      statue("s5", "u", "A grey pilgrim in rust and beige robes, now just grey. The pilgrim on the road described her cousin exactly like this."),
      statue("s6", "v", "A grey pilgrim kneeling. There is a single faded feather in its hat.")
    ]
  };
  function buildCathedral() {
    const g = new Grid(31, 25, "#");
    g.rect(1, 1, 29, 7, "_");
    for (let x = 3; x <= 11; x += 2) for (const y of [3, 5]) g.put(x, y, "|");
    for (let x = 19; x <= 27; x += 2) for (const y of [3, 5]) g.put(x, y, "|");
    g.put(14, 2, "P").put(16, 2, "P").put(15, 2, "u");
    g.put(15, 8, "z");
    g.rect(15, 9, 1, 10, "_");
    g.rect(1, 9, 9, 15, "_");
    g.rect(21, 9, 9, 15, "_");
    g.rect(11, 19, 9, 5, "_");
    g.put(10, 20, "x").put(20, 20, "y");
    g.rect(2, 10, 3, 3, "H");
    g.put(3, 11, "k").put(3, 12, "j");
    g.put(15, 20, "a").put(5, 16, "b").put(25, 16, "c");
    g.put(24, 18, "m").put(3, 21, "n").put(28, 21, "o").put(25, 11, "l").put(15, 23, "e");
    g.put(12, 22, "v").put(18, 22, "w");
    return g.rows();
  }
  var ring = (id, opens, line) => async (s) => {
    if (f3(s, `bell_${id}`)) {
      await s.tell("The bell is still humming from the last time.");
      return;
    }
    s.flag(`bell_${id}`);
    s.sfx("bell");
    s.shake(12);
    await s.tell(line);
    s.flag(opens);
    if (f3(s, "bell_a") && f3(s, "bell_b") && f3(s, "bell_c") && !f3(s, "open_z")) {
      s.sfx("bell");
      await s.tell("Three bells ring together. Far above, something answers with a note so low the floor shakes. The north barrier fades.");
      s.flag("open_z");
    }
  };
  var brask = async (s) => {
    if (f3(s, "braskJoined")) return;
    if (!f3(s, "bell_b")) {
      await s.tell("Behind the bars stands an empty suit of templar armor. Pale moths crawl in and out of the visor. As Wick's lamp comes close, every moth turns toward it.");
      await s.say("Brask", "Ah. A lamp. We have not seen a lamp in a long time. Forgive us. We are Brask, once of the Templar Order of the Loom.");
      await s.say("Brask", "We were locked here for asking a question. The question was: where does the color go?");
      await s.say("Brask", "Our lock is tuned to the bell in this wing. Ring it and the door will open. We would be grateful. The moths would be ecstatic.");
      s.flag("metBrask");
      return;
    }
    await s.tell("The cell door stands open. The armor steps out, a little unsteady, moths spilling from every joint.");
    await s.say("Brask", "Free. Thank you, lamp-bearer. Now listen, all of you, because we know this place.");
    await s.say("Brask", "The Trial is real. The Seal is real. The Inking is a lie. The Cantor greys every pilgrim who reaches the belfry, and the bells carry the color up.");
    await s.say("Tint", "Up to the Loom.");
    await s.say("Brask", "To something up there that is hungry. We will go with you to the belfry. We have wanted to hit the Cantor for eleven years.");
    s.flag("braskJoined");
    s.mech("break");
    await s.join("brask", Math.max(9, s.st.members.wick.lvl));
    await s.say("Brask", "One more thing. Everything the Church makes wears a shell of prayer. Strike its weakness and the shell cracks. Crack it all the way and it ^ybreaks^0. A broken foe loses its turn and takes half again as much harm.");
    await s.tell("^yBreak^0: the white pips over a foe are its shell. Weakness hits crack one pip. Brask's ^yCrush^0 cracks two with any hue. Break the shell to stagger it.");
  };
  var cathedral = {
    id: "cathedral",
    name: "Cathedral of the Colossus",
    music: "church",
    rows: buildCathedral(),
    under: "_",
    outside: "#",
    bg: "pillar",
    legend: { "_": { kind: "floor", enc: true } },
    theme: { wall: ["k", "g2", "b3"], floor: ["k", "ink", "b1"], fence: ["k", "n1", "n2"], pillar: ["k", "g2", "y2"], glass: ["k", "g1", "b2"] },
    enc: { rate: 0.11, groups: [["aco2", 3], ["aco3", 2], ["rib", 2], ["pew3", 2], ["mimic2", 2]] },
    ents: [
      { id: "exit", at: "e", kind: "warp", to: ["carillon", "c", "down"], under: "_" },
      { id: "up", at: "u", kind: "trigger", under: "S", step: async (s) => {
        await s.warp("belfry", "d", "up");
      } },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "bellA", at: "a", kind: "prop", spr: NPC.bell, talk: ring("a", "open_x", "The first bell rings low and long. To the west, a grey barrier thins and disappears.") },
      { id: "bellB", at: "b", kind: "prop", spr: NPC.bell, talk: ring("b", "open_y", "The second bell rings in the middle of the scale. The cell lock clicks, and a barrier to the east fades.") },
      { id: "bellC", at: "c", kind: "prop", spr: NPC.bell, talk: ring("c", "open_c", "The third bell rings high, almost a whistle.") },
      { id: "barrierX", at: "x", kind: "prop", spr: NPC.barrier, when: (st) => !st.flags.open_x, talk: async (s) => s.tell("A wall of grey static hums in the doorway. It is tuned to a bell.") },
      { id: "barrierY", at: "y", kind: "prop", spr: NPC.barrier, when: (st) => !st.flags.open_y, talk: async (s) => s.tell("A wall of grey static hums in the doorway. It is tuned to a bell.") },
      { id: "barrierZ", at: "z", kind: "prop", spr: NPC.barrier, when: (st) => !st.flags.open_z, talk: async (s) => s.tell("The stair barrier. It will open when all three bells have rung.") },
      { id: "cell", at: "j", kind: "prop", spr: NPC.cellDoor, when: (st) => !st.flags.bell_b, talk: brask },
      { id: "brask", at: "k", kind: "npc", spr: NPC.brask, when: (st) => !st.flags.braskJoined, talk: brask },
      { id: "chestM", at: "m", kind: "chest", item: "cyan_edge" },
      { id: "chestN", at: "n", kind: "chest", item: "candle", n: 2 },
      { id: "chestO", at: "o", kind: "chest", item: "ink_vial", n: 3 },
      { id: "guard1", at: "v", kind: "npc", spr: NPC.greeter, when: (st) => !st.flags.guard1, talk: async (s) => {
        await s.say("Grey Acolyte", "Pilgrim, the Trial is not for asking questions. The Trial is for walking quietly in a line.");
        if (await s.battle("aco2") === "win") {
          s.flag("guard1");
          s.refresh();
        }
      } },
      { id: "guard2", at: "w", kind: "npc", spr: NPC.greeter, when: (st) => !st.flags.guard2, talk: async (s) => {
        await s.say("Grey Acolyte", "Hush. Hush. Hush.");
        if (await s.battle("aco2") === "win") {
          s.flag("guard2");
          s.refresh();
        }
      } }
    ]
  };
  function buildBelfry() {
    const g = new Grid(17, 12, "#");
    g.rect(1, 1, 15, 10, "_");
    g.put(8, 2, "g").put(8, 4, "h").put(8, 6, "b").put(8, 10, "d");
    g.put(6, 4, "p").put(10, 4, "q");
    g.put(2, 2, "P").put(14, 2, "P").put(2, 9, "P").put(14, 9, "P");
    return g.rows();
  }
  var cantorFight = async (s) => {
    if (f3(s, "hushDead")) return;
    s.music("boss");
    await s.tell("The belfry is full of grey pilgrims standing in a ring, facing a man in white robes who is singing with his eyes closed. The great bell above him hums along.");
    await s.say("Cantor Hush", "More pilgrims! Come in, come in. Stand in the ring. The Inking takes only a moment. You feel lighter afterward. Everyone says so. Well. Everyone used to say so.");
    if (s.inParty("brask")) await s.say("Brask", "Hush. We asked you once where the color goes. You put us in a cell. We are asking again.");
    await s.say("Cantor Hush", "The deserter! And a Duotone, and a witch, and a cat from the sky. Choir! Sing them quiet.");
    const r = await s.battle("boss3");
    if (r !== "win") return;
    s.flag("hushDead");
    await s.tell("Cantor Hush staggers back against the great bell. The Pilgrim Seal slips from his sleeve and rolls to Tint's feet.");
    await s.give("seal");
    s.music("loom");
    s.shake(40);
    await s.flash("w");
    await s.tell("The great bell rings once by itself. The note is so low it is almost silence. When it fades, someone is standing on top of the bell.");
    await s.tell("A tall figure in grey and white, with a face like a blank page.");
    await s.say("The Grey Bishop", "Cantor. You have been loud.");
    await s.say("Cantor Hush", "Your Grace, they, the deserter, the witch...");
    await s.say("The Grey Bishop", "Quiet now.");
    await s.tell("The Bishop lays one grey hand on the great bell. The bell loses its gold, then its shape, then itself. Where it hung, there is only a clean grey square in the air. Cantor Hush is gone with it.");
    await s.say("The Grey Bishop", "And this one. The misprint.");
    await s.tell("The Bishop reaches toward Wick. Nothing happens. The Bishop tilts his head.");
    await s.say("The Grey Bishop", "Unindexed. I cannot read you, little lamp. How irritating. How... interesting.");
    await s.say("The Grey Bishop", "Go home. There is nothing up there for you. There is nothing up there for anyone, soon. Carillon, this is a heretic. Ring for them.");
    await s.tell("He is gone. Below, every bell in Carillon begins to ring the same grey note.");
    await s.say("Brask", "The templars will come up the stairs. There is another way down: the giant's throat. Follow the moths.");
    await s.battle("templars");
    s.flag("escaped");
    await s.fadeOut();
    await s.tell("They crawl down through the Colossus's throat, a tunnel of rusted cables, and come out beside the west gate.");
    await s.warp("carillon", "z", "left");
    await s.say("Wick", "I thought they might give me a hue. The Inking. I really thought...");
    await s.say("Tint", "Yeah.");
    await s.say("Wick", "Nobody up there is giving out colors. They're taking them. So I'm not going up to ask for anything anymore.");
    await s.say("Nona", "Then what are you going up for?");
    await s.say("Wick", "To make them stop.");
    await s.say("Brask", "We like this lamp. The Tether gate is just west. We have a Seal, and we are all heretics now, which is freeing.");
  };
  var belfry = {
    id: "belfry",
    name: "The Belfry",
    music: "church",
    rows: buildBelfry(),
    under: "_",
    outside: "#",
    bg: "pillar",
    theme: { wall: ["k", "g2", "y2"], floor: ["k", "n1", "g1"], pillar: ["k", "g2", "y2"] },
    ents: [
      { id: "down", at: "d", kind: "warp", to: ["cathedral", "u", "down"], under: "S" },
      { id: "bell", at: "g", kind: "prop", spr: NPC.bell, when: (st) => !st.flags.hushDead, talk: async (s) => s.tell("The great bell of Carillon. It is humming the same note as the Cantor.") },
      { id: "bellGone", at: "g", kind: "prop", spr: NPC.bellGrey, when: (st) => !!st.flags.hushDead, talk: async (s) => s.tell("A clean grey square hangs in the air where the great bell was. It is the most frightening thing Wick has ever seen.") },
      { id: "hush", at: "h", kind: "npc", spr: NPC.cantor, when: (st) => !st.flags.hushDead, talk: cantorFight },
      { id: "boss", at: "b", kind: "trigger", step: cantorFight },
      { id: "g1", at: "p", kind: "prop", spr: NPC.greyPilgrim, talk: async (s) => s.tell("A grey pilgrim, still warm.") },
      { id: "g2", at: "q", kind: "prop", spr: NPC.greyPilgrim, talk: async (s) => s.tell("A grey pilgrim, still warm.") }
    ]
  };
  var maps3 = [road, carillon, cathedral, belfry];
  var chapter3 = {
    title: "Bell Jar",
    stage: "Tests, allies, enemies",
    blurb: "The Church of the Loom offers pilgrims a brighter hue. Wick wants one badly.",
    recruit: "brask",
    ready: true,
    startMap: "carillonRoad",
    startMarker: "e",
    intro: async (s) => {
      await s.tell("The road from Prismouth climbs into bare hills. Ahead, bells are ringing, and every bell rings the same note.");
      await s.say("Tint", "Carillon. The city in the dead giant. I went once as a kid. The bells gave me a headache for a week.");
      await s.say("Nona", "The Lens showed us a choir in a giant's ribs. That is where we are going.");
      await s.say("Wick", "The Church does Inkings, right? People go there to get brighter.");
      await s.say("Tint", "That's what they say.");
    },
    objective: (st) => {
      const fl = st.flags;
      if (!fl.trialOpen) return "Follow the Pilgrim Road west to Carillon and enter the cathedral.";
      if (!fl.bell_a) return "The Trial of Bells: ring the first bell in the cathedral hall.";
      if (!fl.braskJoined) return "Ring the bell in the west wing and free the prisoner in the cell.";
      if (!fl.open_z) return "Ring the bell in the east wing to finish the Trial.";
      if (!fl.hushDead) return "Climb to the belfry and face the Cantor.";
      return "Take the Seal to the Tether gate on Carillon's west side.";
    },
    route: [
      { map: "carillonRoad", warp: "west" },
      { map: "carillon", ent: "greeter" },
      { map: "carillon", ent: "shop" },
      { map: "carillon", ent: "s5" },
      { map: "carillon", ent: "door" },
      { map: "cathedral", ent: "bellA" },
      { map: "cathedral", ent: "cell" },
      { map: "cathedral", ent: "bellB" },
      { map: "cathedral", ent: "brask" },
      { map: "cathedral", ent: "bellC" },
      { map: "cathedral", ent: "up" },
      { map: "belfry", ent: "boss" },
      { map: "carillon", ent: "gate" }
    ]
  };

  // src/maps/ch4.ts
  var ch4_exports = {};
  __export(ch4_exports, {
    chapter: () => chapter4,
    maps: () => maps4
  });
  var f4 = (s, k) => s.has(k);
  function buildWaste() {
    const g = new Grid(44, 30, "@");
    g.scatter(0, 0, 44, 30, "!", 0.15, 41);
    g.scatter(0, 0, 44, 30, "R", 0.05, 42);
    g.scatter(0, 0, 44, 30, "G", 0.05, 43, "@!");
    g.rect(14, 0, 16, 7, "#");
    g.rect(15, 1, 14, 5, "H");
    g.put(21, 6, "m");
    g.rect(20, 7, 3, 2, "!");
    g.ellipse(8, 20, 6, 4.5, ";");
    g.ellipse(8, 21, 3, 2, "~");
    g.path([[43, 15], [21, 15], [21, 7]], "@");
    g.path([[21, 15], [0, 15]], "@");
    g.put(43, 15, "e").put(0, 15, "w");
    g.put(5, 17, "l").put(12, 18, "s");
    g.put(36, 10, "c").put(38, 11, "k").put(26, 24, "r").put(32, 19, "h");
    g.put(2, 3, "a").put(40, 27, "b").put(27, 12, "d");
    return g.rows();
  }
  var westLoop = async (s) => {
    if (s.st.chapter >= 5) {
      await s.warp("tetherBase", "e", "left");
      return;
    }
    if (f4(s, "loopBroken")) {
      await s.tell("The dunes open up. For the first time the horizon stays where it is. Far ahead, a thread as thin as a hair runs from the ground up into the sky.");
      await nextChapter(s, 5);
      return;
    }
    await s.fadeOut();
    await s.warp("hourglass", "e", "left");
    if (!f4(s, "loopSeen")) {
      s.flag("loopSeen");
      await s.tell("The party walks west for what feels like hours. The sun does not move. Then they climb a dune and see the Carillon road again, right where they started.");
      await s.say("Tint", "Those are our footprints. Those are OUR footprints.");
      await s.say("Nona", "The desert is looping. Something is eating the hours, so we keep walking the same one.");
      await s.say("Brask", "The Monastery of the Second Hand stands in the middle of the Waste. The monks kept the time here. If the time is broken, they will know why.");
    } else {
      await s.tell("The same hour again. The same dune. The same footprints, now considerably more of them.");
    }
  };
  var bicker = async (s) => {
    if (f4(s, "bicker")) return;
    s.flag("bicker");
    await s.tell("Past the Tether gate, Carillon's road gives way to a desert. The sand is made of tiny brass gears, and every grain ticks.");
    await s.say("Tint", "It's hot. Why is the sand ticking? Why is anything ticking?");
    await s.say("Brask", "We are armor. We do not feel the heat. The moths do. The moths are complaining.");
    await s.say("Tint", "Your moths ate a hole in my robe last night.");
    await s.say("Brask", "They are drawn to bright things. You are a bright thing. It was meant as a compliment.");
    await s.say("Tint", "It was a BITE.");
    await s.say("Nona", "Everyone be quiet. I am listening to the sand.");
    await s.tell("Wick walks a little ahead of the others and doesn't say anything. Wick hasn't said much since the belfry.");
  };
  var waste = {
    id: "hourglass",
    name: "The Hourglass Waste",
    music: "desert",
    rows: buildWaste(),
    under: "!",
    outside: "@",
    bg: "rock",
    theme: {
      sand: ["k", "y1", "y3"],
      gear: ["k", "n1", "y2"],
      rock: ["k", "n1", "n2"],
      wall: ["k", "n1", "y2"],
      glass: ["k", "n1", "o2"],
      water: ["k", "b1", "c2"],
      grass: ["k", "e1", "e2"],
      ground: ["k", "y1", "n2"]
    },
    enc: { rate: 0.15, groups: [["scorp2", 3], ["hen", 3], ["clock2", 2], ["mite3", 2], ["golem", 2]] },
    ents: [
      { id: "east", at: "e", kind: "warp", to: ["carillon", "g", "right"], under: "!" },
      { id: "west", at: "w", kind: "trigger", step: westLoop, under: "!" },
      { id: "gate", at: "m", kind: "warp", to: ["monastery", "e", "up"], under: "D" },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "shop", at: "s", kind: "npc", spr: NPC.sandMerchant, talk: async (s) => {
        await s.say("Sand Merchant", "Water, tea, and tomorrow's newspaper. I have been selling tomorrow's newspaper for a month. It is always the same tomorrow.");
        await s.shop("hourglass");
      } },
      { id: "caravan", at: "c", kind: "npc", spr: NPC.caravan, talk: async (s) => {
        if (f4(s, "loopBroken")) {
          await s.say("Caravan Master Ibb", "Wednesday! It's WEDNESDAY! I'm going to be so late. I've never been so happy to be late.");
          return;
        }
        await s.say("Caravan Master Ibb", "It's Tuesday. It has been Tuesday for eleven days. I have delivered the same crate of spoons to the same nobody nine times.");
      } },
      { id: "camel", at: "k", kind: "npc", spr: NPC.clockCamel, talk: async (s) => s.tell("A camel made of clock parts. It chimes softly every quarter hour and carries its water in a pendulum.") },
      { id: "mirage", at: "r", kind: "npc", spr: NPC.mirage, talk: async (s) => {
        await s.say("The Mirage", "Lemonade! Cold lemonade! ...You can see me? Oh no. Oh, this is embarrassing. I'm a mirage. The lemonade is also a mirage.");
        await s.say("The Mirage", "I'm real, though. Very real, and very disappointed about the lemonade.");
      } },
      { id: "monument", at: "h", kind: "prop", spr: NPC.hourglass, talk: async (s) => s.tell("A giant hourglass half buried in the sand. The sand inside is falling up.") },
      { id: "chestA", at: "a", kind: "chest", item: "clock_tea" },
      { id: "chestB", at: "b", kind: "chest", gold: 220 },
      { id: "chestD", at: "d", kind: "chest", item: "ink_well" }
    ],
    enter: bicker
  };
  function buildMonastery(past) {
    const g = new Grid(30, 24, "#");
    g.rect(9, 1, 13, 5, "_");
    for (let x = 10; x <= 19; x += 3) {
      g.put(x, 2, "G").put(x + 1, 2, "G").put(x, 4, "G").put(x + 1, 4, "G");
    }
    g.put(15, 6, "_");
    g.rect(9, 7, 13, 5, "_");
    g.rect(1, 7, 7, 14, "_");
    g.rect(23, 7, 6, 14, "_");
    g.rect(15, 12, 1, 6, "_");
    g.rect(11, 18, 9, 5, "_");
    if (!past) {
      g.scatter(1, 1, 28, 22, "!", 0.18, 51, "_");
      g.put(15, 15, "R").put(15, 14, "R");
      g.put(8, 9, "_");
      g.put(22, 9, "R");
      g.put(4, 14, "R").put(5, 14, "R").put(6, 14, "R").put(3, 14, "R").put(2, 14, "R").put(1, 14, "R").put(7, 14, "R");
    } else {
      g.put(22, 9, "_");
      g.put(26, 8, "|").put(27, 9, "|");
    }
    g.put(15, 23, "e");
    g.put(13, 20, "t").put(17, 20, "v");
    g.put(3, 8, "l").put(2, 19, "a").put(27, 19, "b").put(10, 1, "c");
    g.put(27, 8, "s");
    g.put(4, 11, "m").put(25, 15, "n").put(12, 9, "o").put(15, 2, "k");
    return g.rows();
  }
  var tockMeet = async (s) => {
    if (f4(s, "tockJoined")) {
      await s.say("Tock", "Later! Oh, sorry. I mean: what is it?");
      return;
    }
    await s.tell("An old monk made of brass and green glass sits cross-legged in the dust, winding a pocket sundial. He looks up and smiles like he has been waiting a long time.");
    await s.say("Tock", "Goodbye! Oh. No. Sorry. I always get that wrong at the start. Hello. I'm Tock. I'm very glad to see you all again for the first time.");
    await s.say("Tock", "You're Wick. You're Tint. You're Brask, and the moths. And you are...");
    await s.tell("He looks at Nona for a long moment.");
    await s.say("Tock", "...Nona. Of course.");
    await s.say("Nona", "Have we met?");
    await s.say("Tock", "Not yet. We will have. I live backward, you see. For me, today is nearly the end. By the time you're done knowing me, I'll be a baby. It's less sad than it sounds. Babies are very relaxed.");
    await s.say("Tock", "Something in the clock tower is eating hours. That's why the desert loops. I remember you stopping it. So you might as well get started.");
    await s.say("Tock", "Take this. The monastery keeps two times, then and now. The sundial lets you step between them.");
    await s.give("sundial");
    await s.tell("^yPress C^0 to shift between the past and the present. Rubble in the present may be a clear hall in the past, and a wall in the past may have fallen by now.");
    await s.say("Tock", "And in a fight, I can see the next few moments. So can you, now. Look at the top of the screen. That's the order things will happen in.");
    s.mech("tempo");
    s.flag("tockJoined");
    await s.join("tock", Math.max(13, s.st.members.wick.lvl));
    await s.tell("^yTempo^0: the timeline shows who acts next. Guard and quick skills bring your next turn sooner. Tock's ^yDelay^0 pushes a foe later, and ^yHasten^0 makes an ally act next.");
    if (s.st.party.includes("tock")) return;
    await s.tell("Tock waits in reserve. Swap him into the active party from the menu under Party.");
  };
  var monasteryDef = () => ({
    id: "monastery",
    name: "Monastery of the Second Hand",
    music: "desert",
    rows: buildMonastery(false),
    past: buildMonastery(true),
    under: "_",
    outside: "#",
    bg: "gear",
    legend: { "_": { kind: "floor", enc: true }, "!": { kind: "sand", enc: true } },
    theme: { wall: ["k", "n2", "y3"], floor: ["k", "n1", "y1"], sand: ["k", "y1", "y3"], gear: ["k", "n1", "y2"], rock: ["k", "n1", "n2"], fence: ["k", "n1", "n3"] },
    enc: { rate: 0.15, groups: [["clock2", 3], ["mite3", 2], ["golem", 2], ["golem2", 2]] },
    ents: [
      { id: "exit", at: "e", kind: "warp", to: ["hourglass", "m", "down"], under: "_" },
      { id: "tock", at: "t", kind: "npc", spr: NPC.tock, when: (st) => !st.flags.tockJoined, talk: tockMeet },
      { id: "plaque", at: "v", kind: "sign", text: "MONASTERY OF THE SECOND HAND. WE KEEP THE TIME SO THE TIME KEEPS YOU. Someone has scratched underneath: IT STOPPED KEEPING US." },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "chestA", at: "a", kind: "chest", item: "green_hour" },
      { id: "chestB", at: "b", kind: "chest", item: "metronome" },
      { id: "chestC", at: "c", kind: "chest", item: "ink_well", n: 2 },
      { id: "stairs", at: "s", kind: "trigger", under: "S", step: async (s) => {
        if (s.st.past) {
          await s.tell("In the past these stairs have not been built yet.");
          return;
        }
        await s.warp("clocktower", "d", "up");
      } },
      { id: "clock", at: "k", kind: "prop", spr: NPC.clockFace, talk: async (s) => s.tell(s.st.past ? "The monastery clock, ticking steadily. It is 3:15. It has always been 3:15, and that was fine." : "The monastery clock. Its hands spin backward, very fast.") },
      { id: "monkA", at: "m", kind: "npc", spr: NPC.monkPast, when: (st) => st.past, talk: async (s) => s.say("Brother Minute", "Visitors from later! How exciting. Is the future nice? Don't tell me. We're not allowed to know. It spoils the vow.") },
      { id: "monkB", at: "n", kind: "npc", spr: NPC.monkPastB, when: (st) => st.past, talk: async (s) => {
        await s.say("Sister Second", "There is a prophecy here about a monk who will arrive old and leave young. We don't understand it. We think it is about moisturizer.");
      } },
      { id: "monkC", at: "o", kind: "npc", spr: NPC.monkPast, when: (st) => st.past, talk: async (s) => s.say("Brother Minute", "Tock? No, there's no Tock here. We have a Tick, a Tuck, and a Brother Minute. I'm Brother Minute.") }
    ]
  });
  function buildTower() {
    const g = new Grid(17, 12, "#");
    g.rect(1, 1, 15, 10, "_");
    for (let x = 3; x <= 13; x += 2) g.put(x, 2, "G");
    g.put(8, 3, "c").put(8, 6, "b").put(8, 10, "d").put(4, 9, "l");
    g.put(2, 5, "P").put(14, 5, "P");
    return g.rows();
  }
  var chronoFight = async (s) => {
    if (f4(s, "chronoDead")) return;
    s.music("boss");
    await s.tell("The clock tower's great face is cracked, and something long and green is coiled through the gears, chewing. With every bite, the hands jump backward.");
    await s.say("Chronophage", "Mmm. Tuesday. Tuesday again. Delicious. Tuesdays are chewy.");
    await s.say("Tock", "It rewinds itself when it's hurt. Push it later on the timeline and it rewinds less often. And when it coils up, Guard. That's the whole trick.");
    const r = await s.battle("boss4");
    if (r !== "win") return;
    s.flag("chronoDead");
    s.flag("loopBroken");
    s.shake(30);
    await s.flash("w");
    await s.tell("The Chronophage unravels into a spray of loose minutes. Every clock in the tower starts ticking forward at once.");
    await s.say("Tock", "There. The hours are free.");
    await s.tell("Tock is quiet for a while. Then he speaks without looking at anyone.");
    await s.say("Tock", "I should tell you something, since I remember it. At the top, one of you doesn't come back.");
    await s.say("Tint", "Who?");
    await s.say("Tock", "I won't say. I remember it, and I won't say. Saying it doesn't help. I've tried. Well. I will have tried.");
    await s.tell("Nona's tails curl in close, one by one, as though she is counting them.");
    await s.say("Wick", "You live backward. Can't you undo it?");
    await s.say("Tock", "Living backward isn't undoing. I still only get to go one way. It's just a different way.");
    await s.say("Tock", "You can't undo things, Wick. You can only choose the next thing.");
    await s.say("Wick", "I wanted to undo the night Gran went grey. I've been trying to, this whole time.");
    await s.say("Wick", "...Then I'll choose the next thing carefully.");
    await s.say("Tock", "You will. I remember. Hello, everyone. I mean goodbye. I mean: let's go.");
    await s.tell("The monastery shudders. In the present, its walls are finally allowed to be as old as they are.");
    await s.warp("hourglass", "m", "down");
  };
  var tower = {
    id: "clocktower",
    name: "The Clock Tower",
    music: "desert",
    rows: buildTower(),
    under: "_",
    outside: "#",
    bg: "gear",
    theme: { wall: ["k", "n2", "y3"], floor: ["k", "n1", "y1"], gear: ["k", "n1", "y2"], pillar: ["k", "n2", "y2"] },
    ents: [
      { id: "down", at: "d", kind: "warp", to: ["monastery", "s", "down"], under: "S" },
      { id: "chrono", at: "c", kind: "npc", spr: NPC.chronophage, when: (st) => !st.flags.chronoDead, talk: chronoFight },
      { id: "boss", at: "b", kind: "trigger", step: chronoFight },
      { id: "lamp", at: "l", kind: "lamp" }
    ]
  };
  var maps4 = [waste, monasteryDef(), tower];
  var chapter4 = {
    title: "The Second Hand",
    stage: "Tests, allies, enemies",
    blurb: "Past Carillon lies a desert of ticking sand, and the same hour, over and over.",
    recruit: "tock",
    ready: true,
    startMap: "hourglass",
    startMarker: "e",
    objective: (st) => {
      const fl = st.flags;
      if (!fl.loopSeen && !fl.tockJoined) return "Cross the Hourglass Waste to the west.";
      if (!fl.tockJoined) return "The desert loops. Find the Monastery of the Second Hand in the middle of the Waste.";
      if (!fl.chronoDead) return "Use the sundial (press C) to move between past and present, and reach the clock tower stairs in the east wing.";
      return "The loop is broken. Head west across the Waste.";
    },
    route: [
      { map: "hourglass", ent: "shop" },
      { map: "hourglass", ent: "west" },
      { map: "hourglass", warp: "gate" },
      { map: "monastery", ent: "tock" },
      { map: "monastery", ent: "stairs" },
      { map: "clocktower", ent: "boss" },
      { map: "hourglass", ent: "caravan" },
      { map: "hourglass", ent: "west" }
    ]
  };

  // src/maps/ch5.ts
  var ch5_exports = {};
  __export(ch5_exports, {
    chapter: () => chapter5,
    maps: () => maps5
  });
  var f5 = (s, k) => s.has(k);
  function buildBase() {
    const g = new Grid(32, 22, ".");
    g.scatter(0, 0, 32, 22, ",", 0.55, 61);
    g.scatter(0, 0, 32, 22, "R", 0.05, 62, ".,");
    g.rect(15, 0, 2, 7, "/");
    g.rect(12, 7, 8, 4, "O");
    g.rect(22, 5, 5, 1, "^").rect(22, 6, 5, 1, "B").put(23, 6, "W");
    g.ellipse(15, 17, 5.5, 3.5, "R");
    g.ellipse(15, 17, 3.5, 2, ".");
    g.path([[31, 11], [15, 11], [15, 16]], ":");
    g.put(15, 17, "u");
    g.put(31, 11, "e");
    g.put(15, 8, "l").put(24, 7, "c").put(6, 6, "b").put(9, 13, "p").put(27, 15, "s").put(4, 18, "a").put(28, 2, "m");
    g.put(20, 12, "k");
    return g.rows();
  }
  var liftTalk = async (s) => {
    if (!s.hasItem("ticket")) {
      await s.tell("The lift car is a brass cage hanging from the Tether. A slot in the door reads: INSERT TICKET.");
      return;
    }
    await s.tell("Wick feeds the ticket into the slot. The cage door folds open with a sound like applause.");
    if (f5(s, "choseJar")) await s.say("VEND", "GOING UP. PLEASE KEEP YOUR HANDS, TENTACLES, AND MOTHS INSIDE THE CAR.");
    else await s.say("Tint", "Up. Finally. I have never wanted to go up so much in my life.");
    await nextChapter(s, 6);
  };
  var clerk = async (s) => {
    if (s.hasItem("ticket")) {
      await s.say("Toll Clerk", "A valid ticket! My goodness. Board whenever you like. No refunds, no exchanges, no looking down.");
      return;
    }
    if (f5(s, "choseJar") && !f5(s, "reelsTraded")) {
      await s.say("VEND", "I HAVE SOMETHING YOUR TOLL MACHINE WANTS.");
      await s.tell("VEND opens his own front panel. Inside, three brass reels spin, hues flashing past. He pulls them out, one by one, and feeds them into the toll machine.");
      await s.say("Toll Clerk", "Oh! Those are... real reels. Those are worth more than the lift. Here. Here is your ticket. Goodness.");
      await s.say("Wick", "VEND, your Jackpot...");
      await s.say("VEND", "I SPENT FORTY YEARS SAVING FOR SOMETHING. THIS IS THE SOMETHING. THANK YOU FOR YOUR PURCHASE.");
      s.flag("reelsTraded");
      const m2 = s.st.members.vend;
      if (m2) m2.lost = [...m2.lost ?? [], "jackpot"];
      await s.give("ticket");
      return;
    }
    await s.say("Toll Clerk", "Lift tickets are sold out. Every ticket was purchased by Baron Surplus of the Undermarket. He resells them at one thousand gold.");
    await s.say("Toll Clerk", "Also, the Bishop has sent round your descriptions. A Duotone, a cat, a witch, a suit of armor, and a monk who says goodbye first. I'm not allowed to sell to you at all.");
    await s.say("Toll Clerk", "But I can't stop you boarding with a ticket. Nobody told me about tickets. I'm very literal.");
    s.flag("knowBaron");
  };
  var base = {
    id: "tetherBase",
    name: "Foot of the Tether",
    music: "market",
    rows: buildBase(),
    under: ".",
    outside: "R",
    bg: "rock",
    theme: {
      ground: ["k", "g1", "m1"],
      tall: ["k", "g1", "m2"],
      rock: ["k", "g1", "g2"],
      thread: ["k", "y2", "c2"],
      grate: ["k", "g1", "g2"],
      path: ["k", "g2", "g3"],
      roof: ["k", "r1", "r2"],
      brick: ["k", "g1", "r1"],
      window: ["k", "g1", "y3"]
    },
    enc: { rate: 0.14, groups: [["rat2", 2], ["mite5", 2], ["repo", 1]] },
    ents: [
      { id: "east", at: "e", kind: "warp", to: ["hourglass", "w", "right"], under: ":" },
      { id: "crater", at: "u", kind: "warp", to: ["undermarket", "e", "down"], under: "S" },
      { id: "lift", at: "l", kind: "prop", spr: NPC.lift, talk: liftTalk },
      { id: "clerk", at: "c", kind: "npc", spr: NPC.clerk, talk: clerk },
      { id: "bowl", at: "b", kind: "npc", spr: NPC.fishBowl, talk: async (s) => s.say("The Bowl Family", "We are a family of lantern-fish in a bowl on legs. We have been waiting for the lift for three weeks. The legs are tired. The fish are fine.") },
      { id: "pilgrim", at: "p", kind: "npc", spr: NPC.pilgrimA, talk: async (s) => s.say("Pilgrim", "The Tether goes all the way up to the Loom. They say at the top you can see the whole world, and it's smaller than you'd like.") },
      { id: "sign", at: "s", kind: "sign", text: "THE UNDERMARKET. Down the crater. Everything for sale. NO REFUNDS. NO EXCHANGES. NO QUESTIONS. SOME ANSWERS, FOR A FEE." },
      { id: "lamp", at: "k", kind: "lamp" },
      { id: "chestA", at: "a", kind: "chest", item: "ink_well" },
      { id: "chestM", at: "m", kind: "chest", gold: 180 }
    ],
    enter: async (s) => {
      if (f5(s, "baseIntro")) return;
      s.flag("baseIntro");
      await s.tell("West of the Waste, a thread as thin as a hair rises out of the ground. Up close it is as wide as a house: a cable wrapped in a vine, running straight up past the clouds.");
      await s.say("Nona", "The Tether. It was built to hoist raw material up to the Loom. Now it is the only way up.");
      await s.say("Brask", "And beside it, the Undermarket. A moon fell here long ago. Someone opened a shop inside it. Then everyone did.");
    }
  };
  function stall(g, x, y, w) {
    g.rect(x, y, w, 1, "^");
    g.rect(x, y + 1, w, 1, "B");
  }
  function buildMarket() {
    const g = new Grid(40, 36, "R");
    g.ellipse(20, 18, 19.5, 17.5, "O");
    g.rect(4, 17, 32, 15, "Q");
    g.scatter(1, 1, 38, 15, "$", 0.05, 71, "O");
    stall(g, 5, 5, 10);
    g.put(9, 6, "W").put(10, 6, "D");
    stall(g, 23, 5, 7);
    stall(g, 31, 8, 5);
    stall(g, 5, 11, 5);
    stall(g, 26, 11, 6);
    g.rect(4, 16, 32, 1, "M");
    g.put(20, 16, "O");
    for (let y = 17; y <= 22; y++) g.put(20, y, "J");
    for (let x = 8; x <= 19; x++) g.put(x, 23, "<");
    for (let x = 8; x <= 19; x++) g.put(x, 26, ">");
    for (let x = 21; x <= 30; x++) g.put(x, 26, ">");
    for (let y = 18; y <= 26; y++) g.put(31, y, "U");
    g.rect(9, 24, 10, 1, "M");
    g.rect(22, 24, 8, 1, "M");
    g.rect(19, 24, 3, 2, "M");
    g.rect(12, 28, 7, 1, "M");
    g.rect(22, 28, 7, 1, "M");
    g.rect(19, 29, 1, 3, "M");
    g.rect(21, 29, 1, 3, "M");
    g.put(20, 32, "v");
    g.put(20, 1, "e");
    g.put(13, 8, "a").put(26, 8, "n").put(33, 11, "s").put(7, 14, "r").put(29, 14, "g").put(16, 10, "h").put(36, 15, "k");
    g.put(18, 3, "l").put(6, 22, "b").put(34, 20, "c").put(6, 29, "d").put(33, 30, "x");
    g.put(10, 9, "y");
    return g.rows();
  }
  var auction = async (s) => {
    if (f5(s, "auctionSeen")) return;
    s.flag("auctionSeen");
    await s.tell("A crowd is packed around the auction house. On the block stands a creature like a violet cuttlefish in a waistcoat, holding up a glass jar full of warm brown light.");
    await s.say("The Auctioneer", "Lot forty-one! Vintage umber, harvested fresh from a little village at the very edge of the world! Warm, soft, faintly smells of lamp oil. Do I hear eight hundred?");
    await s.tell("Wick stops walking.");
    await s.say("Wick", "That's Gran. That's GRAN.");
    await s.say("Brother Grayling", "Eight hundred, for the Choir. It will go home to the Loom where it belongs.");
    await s.say("Baron Surplus", "Two thousand. Cash. I'll sell it to the Choir myself next week at three.");
    await s.say("The Auctioneer", "Sold! To the Baron, who owns this auction house, and this moon, and a little of everybody's future!");
    await s.tell("Grayling bows politely to the Baron and leaves. The jar goes into a strongbox, and the strongbox goes down, into the factory, toward the vault.");
    await s.say("Tint", "Okay. New plan. Same plan, plus stealing your grandmother back.");
  };
  var vendTalk = async (s) => {
    if (f5(s, "vendJoined")) return;
    await s.tell("Chained to the front of the Baron's stall is a vending machine with arms, legs, and two tired cyan lights for eyes.");
    await s.say("VEND", "HELLO. I AM VEND. PLEASE INSERT COIN. ...SORRY. HABIT.");
    await s.say("VEND", "I HAVE WORKED FOR BARON SURPLUS FOR FORTY YEARS. MY CONTRACT SAYS I MAY BUY MY FREEDOM FOR ONE MILLION GOLD. I HAVE SAVED THREE.");
    if (!f5(s, "auctionSeen")) await s.say("VEND", "THE BARON KEEPS HIS TICKETS AND HIS INVENTORY IN THE VAULT UNDER THE FACTORY.");
    else await s.say("VEND", "THE JAR YOU ARE STARING AT THE FACTORY FOR IS IN THE VAULT. SO ARE THE LIFT TICKETS. SO IS MY CONTRACT.");
    await s.say("Nona", "You know the way down?");
    await s.say("VEND", "I AM THE WAY DOWN. THE CHAIN IS A LEASE. THE LEASE EXPIRED IN THE YEAR OF THE LONG TUESDAY. NOBODY CHECKED.");
    await s.tell("VEND lifts the chain off his own hook and hands it to Brask, who does not know what to do with it.");
    s.flag("vendJoined");
    s.mech("coin");
    await s.join("vend", Math.max(17, s.st.members.wick.lvl));
    await s.tell("^yVEND^0 has no ink. His skills cost ^ygold^0 instead, more at higher levels. He also sells items anywhere: choose ^yVend^0 in the menu, at a markup.");
  };
  var market = {
    id: "undermarket",
    name: "The Undermarket",
    music: "market",
    rows: buildMarket(),
    under: "O",
    outside: "R",
    bg: "machine",
    legend: {
      Q: { kind: "circuit", enc: true },
      J: { kind: "belt", belt: "down" },
      U: { kind: "belt", belt: "up" },
      "<": { kind: "belt", belt: "left" },
      ">": { kind: "belt", belt: "right" }
    },
    theme: {
      grate: ["k", "g1", "m1"],
      rock: ["k", "g1", "g2"],
      coins: ["k", "m1", "y2"],
      circuit: ["k", "g1", "c1"],
      machine: ["k", "g1", "r2"],
      belt: ["k", "g1", "y2"],
      roof: ["k", "m1", "m2"],
      brick: ["k", "g1", "y1"],
      window: ["k", "m1", "y3"],
      door: ["k", "n1", "y2"]
    },
    enc: { rate: 0.18, groups: [["mite5", 3], ["repo", 3], ["rat2", 2], ["tag", 2], ["imp3", 2]] },
    ents: [
      { id: "up", at: "e", kind: "warp", to: ["tetherBase", "u", "down"], under: "S" },
      { id: "vaultDoor", at: "v", kind: "trigger", under: "D", step: async (s) => {
        if (!f5(s, "vendJoined")) {
          await s.tell("A vault door with a coin slot for a keyhole. It will not open for strangers.");
          await s.movePlayer("u");
          return;
        }
        await s.say("VEND", "ALLOW ME.");
        await s.tell("VEND inserts a coin into the keyhole. The vault door swings open.");
        await s.warp("vault", "d", "up");
      } },
      { id: "auctionTrigger", at: "y", kind: "trigger", step: auction, under: "O" },
      { id: "auctioneer", at: "a", kind: "npc", spr: NPC.auctioneer, talk: async (s) => {
        if (!f5(s, "auctionSeen")) await auction(s);
        else await s.say("The Auctioneer", "Next lot: a jar of the exact green of a frog's opinion. Sealed. Do not open indoors.");
      } },
      { id: "vend", at: "n", kind: "npc", spr: NPC.vend, when: (st) => !st.flags.vendJoined, talk: vendTalk },
      { id: "shop", at: "s", kind: "npc", spr: NPC.goblin, talk: async (s) => {
        await s.say("Goblin", "Undermarket prices! We mark everything up, then we mark it down, so you feel good, then we mark it up again when you look away.");
        await s.shop("undermarket");
      } },
      { id: "rat", at: "r", kind: "npc", spr: NPC.ratMerchant, talk: async (s) => s.say("Moon Rat", "I chewed a hole in this moon. It was already hollow. I'm still proud. You have to be proud of something.") },
      { id: "goblin2", at: "g", kind: "npc", spr: NPC.goblinB, wander: true, talk: async (s) => s.say("Goblin", "Colors in jars, sixty gold. Last week they were thirty. The grey is coming, so colors are an investment.") },
      { id: "slots", at: "h", kind: "npc", spr: NPC.slots, talk: async (s) => {
        await s.say("Lucky Seven", "PLAY LUCKY SEVEN. TEN GOLD A PULL. THE ODDS ARE PRINTED ON MY SIDE IN A FONT TOO SMALL TO READ.");
        if (await s.ask("Pull for 10 gold?", ["Pull", "Walk away"]) !== 0 || s.st.gold < 10) return;
        await s.gold(-10, true);
        const win = (s.st.steps * 7 + s.st.gold) % 5 === 0;
        if (win) {
          await s.tell("Three lemons. The machine rattles and pays out.");
          await s.gold(60);
        } else await s.tell("A lemon, a bell, and a small picture of the Baron laughing.");
      } },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "lamp2", at: "k", kind: "lamp" },
      { id: "chestB", at: "b", kind: "chest", item: "chorus" },
      { id: "chestC", at: "c", kind: "chest", item: "amber_slot" },
      { id: "chestD", at: "d", kind: "chest", gold: 300 },
      { id: "chestX", at: "x", kind: "chest", item: "feather" }
    ]
  };
  function buildVault() {
    const g = new Grid(17, 13, "M");
    g.rect(1, 1, 15, 11, "$");
    g.put(5, 2, "t").put(11, 2, "j").put(8, 4, "o").put(8, 6, "b").put(8, 11, "d");
    return g.rows();
  }
  var baronFight = async (s) => {
    if (f5(s, "baronDead")) return;
    s.music("boss");
    await s.tell("The vault is a room made of money. Gold coins shift underfoot like sand. At the far end, on two pedestals, sit a lift ticket and a jar of warm brown light.");
    await s.tell("Between them stands Baron Surplus, sitting in a walking machine built out of coin slots.");
    await s.say("Baron Surplus", "VEND! My best appliance! And he brought customers. Everything down here is for sale, you know. Including you.");
    await s.say("VEND", "MY LEASE EXPIRED. I DO NOT WORK HERE.");
    await s.say("Baron Surplus", "Then you're inventory. Muscle! On the house!");
    const r = await s.battle("boss5");
    if (r !== "win") return;
    s.flag("baronDead");
    await s.tell("The coin machine sags and spills the Baron onto a pile of his own money. He does not try to get up.");
    await s.say("Baron Surplus", "Fine. Take one thing. The vault seals in a minute, and when it does it seals everything, including the air.");
    await s.tell("An alarm ticks. The walls begin to close in, coin by coin.");
    await s.say("Nona", "We can carry one of them out before it seals. The ticket takes us up. The jar is your grandmother.");
    await s.say("Brask", "Lamp-bearer. It is your choice. We will follow either way.");
    const i = await s.ask("Which does Wick take?", ["The lift ticket", "Gran's jar"]);
    if (i === 0) {
      await s.say("Wick", "...The ticket. If we don't go up, the whole world ends up in jars.");
      await s.give("ticket");
      s.flag("jarLost");
      await s.tell("Behind them the vault seals, with Gran's jar still inside.");
      await s.say("Baron Surplus", "The Choir will collect the jar next week. They always pay on time. That's the thing I like about the end of the world. Punctual customers.");
    } else {
      await s.say("Wick", "The jar. I'm not leaving her in a vault.");
      await s.give("gran_jar");
      s.flag("choseJar");
      await s.tell("Wick holds the jar close. It is warm. It smells like lamp oil and bread.");
      await s.say("Tint", "Okay. No ticket. We'll figure it out. We always figure it out.");
      await s.say("VEND", "I WILL FIGURE IT OUT.");
    }
    await s.say("VEND", "MY CONTRACT.");
    await s.tell("VEND picks a single sheet of paper out of the gold, reads it, and eats it. It is, he explains later, the only thing he has ever bought for himself.");
    await s.warp("undermarket", "v", "up");
    await s.say("Wick", "Everything up there costs somebody something. I keep finding out who.");
  };
  var vault = {
    id: "vault",
    name: "The Baron's Vault",
    music: "market",
    rows: buildVault(),
    under: "$",
    outside: "M",
    bg: "coins",
    theme: { coins: ["k", "y1", "y2"], machine: ["k", "g1", "y2"] },
    ents: [
      { id: "door", at: "d", kind: "warp", to: ["undermarket", "v", "up"], under: "$" },
      { id: "baron", at: "o", kind: "npc", spr: NPC.baron, when: (st) => !st.flags.baronDead, talk: baronFight },
      { id: "boss", at: "b", kind: "trigger", step: baronFight },
      { id: "ticketStand", at: "t", kind: "prop", spr: NPC.ticket, when: (st) => !st.flags.baronDead, talk: async (s) => s.tell("A lift ticket on a velvet cushion.") },
      { id: "jarStand", at: "j", kind: "prop", spr: NPC.jar, when: (st) => !st.flags.baronDead, talk: async (s) => s.tell("A jar of warm brown light. The label reads UMBER, EDGEWICK.") }
    ]
  };
  var maps5 = [base, market, vault];
  var chapter5 = {
    title: "The Undermarket",
    stage: "Tests, allies, enemies",
    blurb: "The way up is a thread with a toll booth. The toll booth wants gold.",
    recruit: "vend",
    ready: true,
    startMap: "tetherBase",
    startMarker: "e",
    objective: (st) => {
      const fl = st.flags;
      if (!fl.knowBaron) return "Ask at the toll booth beside the Tether lift.";
      if (!fl.vendJoined) return "Go down the crater into the Undermarket and find Baron Surplus.";
      if (!fl.baronDead) return "Follow the factory belts down to the Baron's vault.";
      if (!st.items.ticket) return "Go back up to the toll booth.";
      return "Board the Tether lift.";
    },
    route: [
      { map: "tetherBase", ent: "clerk" },
      { map: "tetherBase", warp: "crater" },
      { map: "undermarket", ent: "auctioneer" },
      { map: "undermarket", ent: "vend" },
      { map: "undermarket", ent: "shop" },
      { map: "undermarket", ent: "vaultDoor" },
      { map: "vault", ent: "boss" },
      { map: "undermarket", warp: "up" },
      { map: "tetherBase", ent: "clerk" },
      { map: "tetherBase", ent: "lift" }
    ]
  };

  // src/maps/ch6.ts
  var ch6_exports = {};
  __export(ch6_exports, {
    chapter: () => chapter6,
    maps: () => maps6
  });
  var f6 = (s, k) => s.has(k);
  function buildSea() {
    const g = new Grid(48, 44, "K");
    g.scatter(0, 0, 48, 44, "Z", 0.03, 81, "K");
    g.rect(23, 8, 2, 27, "/");
    g.rect(14, 35, 20, 6, "-");
    g.rect(16, 41, 16, 2, "-");
    g.put(21, 35, "R").put(26, 35, "R");
    g.ellipse(9, 25, 6.5, 4.5, ",");
    g.scatter(3, 20, 13, 10, "T", 0.15, 82, ",");
    g.ellipse(38, 25, 5.5, 3.5, ".");
    g.scatter(33, 22, 11, 7, '"', 0.2, 83, ".");
    g.ellipse(11, 11, 6.5, 4.5, "-");
    g.rect(8, 8, 3, 1, "^").rect(8, 9, 3, 1, "B");
    g.rect(13, 8, 3, 1, "^").rect(13, 9, 3, 1, "B");
    g.rect(15, 1, 18, 6, "O");
    g.rect(15, 7, 18, 1, "Z");
    g.rect(14, 1, 1, 7, "Z").rect(33, 1, 1, 7, "Z");
    g.put(30, 7, "w");
    g.put(24, 1, "n").put(24, 3, "o").put(24, 5, "b");
    g.put(24, 38, "s").put(24, 36, "r").put(19, 38, "m").put(28, 38, "a").put(17, 40, "f").put(30, 40, "l");
    g.put(38, 25, "c").put(36, 24, "q").put(41, 26, "k");
    g.put(6, 24, "v").put(12, 27, "x");
    g.put(11, 12, "p").put(9, 13, "y");
    g.put(20, 4, "j");
    return g.rows();
  }
  var intro = async (s) => {
    await s.tell("The lift car climbs the Tether for an hour, then two. Below, the world shrinks into a square of colored tiles. Above, the clouds get thicker and stop moving.");
    await s.say("Tint", "You can see Prismouth from here. It looks like a crumb.");
    await s.say("VEND", "YOU CAN SEE THE UNDERMARKET. IT LOOKS LIKE A HOLE. IT IS A HOLE.");
    await s.say("Nona", "I have seen the world from the Loom a thousand times. I have never seen it get bigger on the way down, or smaller on the way up. It is different from inside a window.");
    s.shake(40);
    s.sfx("crit");
    await s.flash("w");
    await s.tell("Something bangs against the roof. The cable brake screams. The car shudders to a stop against a wooden dock floating in the clouds.");
    await s.say("Lift Attendant", "Everybody out! Everybody OUT. Somebody cut the upper cable. Grey robes, grey rope. Very tidy work.");
    await s.say("Brask", "The Choir. They knew we were coming.");
  };
  var mirrowTalk = async (s) => {
    if (f6(s, "mirrowJoined")) return;
    await s.tell("At the end of the dock, a small boat bobs on the clouds. Standing in it is an oval mirror on two thin legs. In the glass, instead of the party, there is a sky with no clouds in it.");
    await s.say("Tint", "We need a boat.");
    await s.say("Mirrow", "...need a boat. I have a boat. I am Mirrow. I used to be a reflection. Then the person I was reflecting walked away, and I didn't.");
    await s.say("Wick", "You can sail on clouds?");
    await s.say("Mirrow", "...sail on clouds. Everything can sail on clouds if it is light enough. I am very light. I am mostly the idea of a person.");
    await s.say("Mirrow", "The currents go up in a spiral around the Tether, all the way to the Needle, where the Loom's gate is. I will take you. I want to see what the Loom looks like in me.");
    s.flag("mirrowJoined");
    s.flag("skiff");
    s.mech("mirror");
    await s.join("mirrow", Math.max(21, s.st.members.wick.lvl));
    await s.tell("^yMirrow^0's ^yReflect^0 repeats the last action anyone took, friend or foe, as Mirrow's own. Copying a boss's best attack back at it is the whole point.");
    await s.tell("You can now sail the ^ycloud sea^0. Walk off the dock onto the clouds.");
  };
  var campfire = async (s) => {
    if (f6(s, "night")) {
      await s.tell("The fire has burned down to a glow. Past the storm ring, the north current is running.");
      return;
    }
    s.music("sad");
    await s.tell("They make camp on the little island and build a fire out of a crate VEND insists he bought fairly. Night comes up the Tether like a tide.");
    await s.say("Tint", "When this is over I'm going to relight my lighthouse. I don't know how yet. I'll paint the Lens back together if I have to.");
    await s.say("Brask", "We wanted to know where the color goes. Now we know. It goes up. We would like to go and ask for it back.");
    await s.say("VEND", "I HAVE BOUGHT EVERYTHING I HAVE EVER HAD. ONCE, I WOULD LIKE TO BE GIVEN SOMETHING. FOR FREE. I DO NOT KNOW WHAT.");
    if (s.inParty("tock")) await s.say("Tock", "I'd like to be surprised. It hasn't happened in a very long time. I remember all of this. Well. Almost all of it.");
    await s.say("Nona", "I want to fix the Loom. It is my job. It has been my job for nine hundred years. I would like to finish one job before...");
    await s.tell("Nona does not finish the sentence. Tock looks into the fire.");
    await s.say("Mirrow", "...before. What do you want, Wick?");
    await s.say("Wick", "I used to want a hue. Now I just want to take Gran's color home.");
    await s.tell("Nobody says anything for a while. It is a comfortable nothing.");
    await s.say("Brask", "We have fought beside each other long enough that our hands know each other. Next time, strike together.");
    s.mech("link");
    s.flag("night");
    s.heal();
    await s.tell("^yLink^0: the link gauge fills when you hit weaknesses and break shells. When it is full, choose ^yLink^0 in battle. Two allies strike every foe together.");
    await s.tell("Far to the north, past the storm ring, the clouds part. The current to the Needle is running.");
    s.music("sky");
  };
  var seraphFight = async (s) => {
    if (f6(s, "seraphDead")) return;
    s.music("boss");
    await s.tell("The Needle is a platform of white metal at the top of the Tether. At its center is a gate shaped like the eye of a sewing needle, and in front of the gate hangs a machine with six wings and a ring of light for a head.");
    await s.say("Seraph K-7", "HALT. THE LOOM IS CLOSED FOR RECLAMATION. ALL COLORS WILL BE COLLECTED. PLEASE HOLD STILL FOR COLLECTION.");
    await s.say("Mirrow", "...hold still. When its halo locks on, let it fire. Then show it its own beam. I have been waiting my whole life to reflect something this bright.");
    const r = await s.battle("boss6");
    if (r !== "win") return;
    s.flag("seraphDead");
    s.shake(30);
    await s.tell("The Seraph folds its wings and drops off the edge of the Needle into the clouds. Behind it, the gate begins to close, very slowly, like an eye falling asleep.");
    await s.say("Nona", "The gate is on a timer. If it shuts, it will not open again for a hundred years.");
    await s.tell("The skiff, battered by the fight, cracks down the middle and sinks into the clouds.");
    await s.say("Mirrow", "...a hundred years. I will hold it.");
    await s.tell("Mirrow walks to the gate and turns sideways, and the gate closes on the mirror's edge, and stops. The glass creaks.");
    await s.say("Tint", "Mirrow, you'll crack!");
    await s.say("Mirrow", "...crack. I am a mirror. Cracking is what we do instead of being afraid. Go. I will be here when you come back out. I will be reflecting the door.");
    s.leave("mirrow");
    s.flag("skiff", false);
    await s.tell("One by one, they squeeze through the gap. Wick goes last, and looks back.");
    await s.say("Wick", "Everyone keeps looking at me to decide what's next.");
    await s.say("Brask", "Yes. You carry the lamp.");
    await s.say("Wick", "...Then we go in. All of us that's left.");
    await nextChapter(s, 7);
  };
  var sea = {
    id: "cloudsea",
    name: "The Cloud Sea",
    music: "sky",
    rows: buildSea(),
    under: "-",
    outside: "K",
    bg: "cloud",
    legend: {
      K: { kind: "cloud", sea: true, solid: true, enc: true },
      Z: { kind: "deep", solid: true }
    },
    theme: {
      cloud: ["k", "b3", "w"],
      deep: ["k", "b1", "g2"],
      thread: ["k", "e1", "y2"],
      planks: ["k", "n1", "n2"],
      rock: ["k", "g1", "g2"],
      tall: ["k", "e1", "e2"],
      tree: ["k", "e1", "e3"],
      ground: ["k", "e1", "e2"],
      flowers: ["k", "e1", "m3"],
      grate: ["k", "g2", "w"],
      roof: ["k", "r1", "r2"],
      brick: ["k", "n1", "n2"]
    },
    enc: { rate: 0.15, groups: [["kite2", 3], ["whale", 2], ["vine2", 2], ["jelly3", 2], ["pirate", 2]] },
    ents: [
      { id: "wreck", at: "r", kind: "prop", spr: NPC.wreck, talk: async (s) => s.tell("The lift car, stuck against the dock. Its upper cable has been cut clean through.") },
      { id: "mirrow", at: "m", kind: "npc", spr: NPC.mirrow, when: (st) => !st.flags.mirrowJoined, talk: mirrowTalk },
      { id: "attendant", at: "a", kind: "npc", spr: NPC.attendant, talk: async (s) => {
        await s.say("Lift Attendant", "Cloudharbor, halfway up. We sell rope, rope, and a different kind of rope. Also regular goods.");
        await s.shop("tether");
      } },
      { id: "fisher", at: "f", kind: "npc", spr: NPC.fisher, talk: async (s) => s.say("Cloud Fisher", "I fish for weather. Caught a small drizzle this morning. Threw it back. It had a family.") },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "campfire", at: "c", kind: "prop", spr: NPC.campfire, talk: campfire },
      { id: "lamp2", at: "k", kind: "lamp" },
      { id: "chestQ", at: "q", kind: "chest", item: "honey", n: 2 },
      { id: "chestV", at: "v", kind: "chest", item: "spool_charm" },
      { id: "chestX", at: "x", kind: "chest", item: "ink_well", n: 2 },
      { id: "captain", at: "p", kind: "npc", spr: NPC.pirateCaptain, when: (st) => !st.flags.pirates, talk: async (s) => {
        await s.say("Captain Gale", "Ahoy, grounders! This is a pirate nest. We plunder clouds for their silver linings. Hand over your linings, or your lunches.");
        if (await s.ask("Fight the pirates?", ["Fight", "Sail away"]) !== 0) return;
        const r = await s.battle("crew");
        if (r !== "win") return;
        s.flag("pirates");
        await s.say("Captain Gale", "Fine! FINE. Take the loot. We were going to retire anyway. Somewhere with ground.");
        await s.give("red_pane");
        await s.gold(400);
      } },
      { id: "chestY", at: "y", kind: "chest", item: "relight", n: 2 },
      { id: "storm", at: "w", kind: "prop", spr: NPC.storm, when: (st) => !st.flags.night, talk: async (s) => s.tell("A knot of storm cloud blocks the north current. The fisher said the currents change at night.") },
      { id: "gate", at: "n", kind: "prop", spr: NPC.needleGate, talk: async (s) => s.tell("The gate of the Loom. It is shaped like the eye of a needle and is taller than the lighthouse at Prismouth.") },
      { id: "seraph", at: "o", kind: "npc", spr: NPC.seraph, when: (st) => !st.flags.seraphDead, talk: seraphFight },
      { id: "boss", at: "b", kind: "trigger", step: seraphFight, under: "O" },
      { id: "chestJ", at: "j", kind: "chest", item: "chorus" }
    ]
  };
  var maps6 = [sea];
  var chapter6 = {
    title: "The Tether",
    stage: "Approach to the inmost cave",
    blurb: "A lift up a thread through the clouds. Then no lift.",
    recruit: "mirrow",
    ready: true,
    startMap: "cloudsea",
    startMarker: "s",
    intro,
    objective: (st) => {
      const fl = st.flags;
      if (!fl.mirrowJoined) return "Find a way off the Cloudharbor dock.";
      if (!fl.night) return "Sail the cloud sea. The current north is blocked by storm until night. Make camp on the east island.";
      if (!fl.seraphDead) return "Follow the north current to the Needle and the Loom's gate.";
      return "Enter the Loom.";
    },
    route: [
      { map: "cloudsea", ent: "mirrow" },
      { map: "cloudsea", ent: "attendant" },
      { map: "cloudsea", ent: "captain" },
      { map: "cloudsea", ent: "campfire" },
      { map: "cloudsea", ent: "boss" }
    ]
  };

  // src/maps/ch7.ts
  var ch7_exports = {};
  __export(ch7_exports, {
    chapter: () => chapter7,
    maps: () => maps7
  });
  var f7 = (s, k) => s.has(k);
  function buildGate() {
    const g = new Grid(37, 24, "M");
    g.rect(1, 1, 35, 22, "Q");
    for (const x of [5, 11, 25, 31]) {
      g.rect(x, 2, 1, 7, "/");
      g.rect(x, 14, 1, 8, "/");
    }
    g.rect(15, 9, 7, 5, "O");
    g.put(18, 22, "e").put(18, 1, "x");
    g.put(18, 11, "t").put(16, 20, "l").put(8, 5, "p").put(28, 5, "q").put(3, 20, "a").put(33, 20, "b");
    return g.rows();
  }
  var gateIntro = async (s) => {
    if (f7(s, "loomIntro")) return;
    s.flag("loomIntro");
    await s.tell("Inside, the Loom is a cathedral made of machinery. Threads of every color run up from the floor into a dark too high to see, humming as they move.");
    await s.tell("Except most of them are grey. Most of them have been grey for a long time.");
    await s.say("Nona", "This is where I was made. There were ten thousand colors on these threads when I was new. I used to know all of their names.");
    await s.say("Tint", "Where did they go?");
    await s.say("Nona", "Down to you. Every stone, every frog, every one of you. And now, back up.");
  };
  var nonaTerminal = async (s) => {
    if (f7(s, "terminalRead")) {
      await s.tell("The maintenance terminal shows one line: RESERVE INK: NINE SPOOLS. LOCATION: UNIT NONA.");
      return;
    }
    s.flag("terminalRead");
    await s.tell("Nona puts a paw on an old maintenance terminal. It wakes, recognizes her, and scrolls.");
    await s.tell("INK RESERVE: EMPTY. EMERGENCY RECLAMATION: ACTIVE. TRIAGE UNIT: AWAKE. WEAVER: DORMANT.");
    await s.tell("The last line blinks: RESERVE INK: NINE SPOOLS. LOCATION: UNIT NONA.");
    await s.say("Wick", "Nona. That's you. Your tails.");
    await s.say("Nona", "Yes. Every maintenance unit carries a reserve. Mine are nearly the last ink in the Loom.");
    await s.say("Nona", "Do not look at me like that, all of you. I have known for nine hundred years. Come. The Weaver is at the top of the Spindle Halls.");
  };
  var gate = {
    id: "loomGate",
    name: "The Loom",
    music: "loom",
    rows: buildGate(),
    under: "Q",
    outside: "M",
    bg: "thread",
    legend: { Q: { kind: "circuit", enc: true } },
    theme: { circuit: ["k", "g1", "c1"], machine: ["k", "g1", "g2"], thread: ["k", "g2", "m2"], grate: ["k", "g1", "g2"] },
    enc: { rate: 0.1, groups: [["spider2", 3], ["unp2", 2], ["serp", 2]] },
    ents: [
      { id: "north", at: "x", kind: "warp", to: ["spindleHalls", "s", "up"], under: "Q" },
      { id: "entry", at: "e", kind: "prop", spr: NPC.needleGate, talk: async (s) => s.tell("The gate. Through the gap, a strip of Mirrow's glass reflects the inside of the Loom back at itself.") },
      { id: "terminal", at: "t", kind: "prop", spr: NPC.terminal, talk: nonaTerminal },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "spool1", at: "p", kind: "prop", spr: NPC.spoolProp, talk: async (s) => s.tell("A spool as tall as a house, wound with a single violet thread. A tag reads: PRISMOUTH HARBOR, TUESDAY.") },
      { id: "spool2", at: "q", kind: "prop", spr: NPC.spoolProp2, talk: async (s) => s.tell("A spool of amber and red. The tag reads: CARILLON, GREAT BELL.") },
      { id: "chestA", at: "a", kind: "chest", item: "honey", n: 2 },
      { id: "chestB", at: "b", kind: "chest", item: "none5" }
    ],
    enter: gateIntro
  };
  function buildHalls() {
    const g = new Grid(41, 34, "/");
    const room = (x, y, w, h2, c = "Q") => g.rect(x, y, w, h2, c);
    room(15, 26, 11, 7);
    room(3, 17, 12, 7, "V");
    room(26, 17, 12, 7, "V");
    room(14, 12, 13, 8);
    room(3, 3, 12, 8);
    room(26, 3, 12, 8, "V");
    room(17, 1, 7, 6);
    g.path([[20, 26], [20, 19]], "Q");
    g.path([[15, 21], [14, 21], [9, 21], [9, 17]], "Q");
    g.path([[26, 20], [31, 20], [31, 17]], "Q");
    g.path([[9, 17], [9, 10]], "Q");
    g.path([[31, 17], [31, 10]], "V");
    g.path([[14, 7], [17, 7], [17, 5]], "Q");
    g.path([[26, 7], [23, 7], [23, 5]], "V");
    g.put(20, 32, "s").put(20, 1, "n");
    g.put(20, 15, "i").put(18, 14, "j").put(23, 28, "l").put(8, 5, "v").put(6, 7, "w").put(33, 21, "a").put(5, 21, "b").put(35, 5, "c");
    g.put(17, 28, "r");
    return g.rows();
  }
  var nilTalk = async (s) => {
    if (f7(s, "nilJoined")) return;
    await s.tell("In the middle of the hall, something grey and patient is sweeping. It gathers the colored dust that drips off the threads into a small bin, one careful stroke at a time.");
    await s.say("Nil", "Hello. Please step around the pile. It is Tuesday's red.");
    await s.say("Tint", "Who are you?");
    await s.say("Nil", "I am Nil. I sweep. Color falls off the threads and I sweep it into the bin, and the bin goes to the Bishop, and the Bishop feeds it to the Loom.");
    await s.tell("Nil turns its blank face toward Wick and holds very still.");
    await s.say("Nil", "You are not in the index. I checked. I am in the index as zero. You are not in it at all. I have never met anything that was less there than me.");
    await s.say("Wick", "Is that a compliment?");
    await s.say("Nil", "I do not know. I have never been given one. I would like to see what you do next. Nothing I have swept has ever done anything.");
    await s.say("Nona", "It knows the halls. And the Bishop will not look twice at a Blank.");
    s.flag("nilJoined");
    s.mech("echo");
    await s.join("nil", Math.max(24, s.st.members.wick.lvl));
    await s.tell("^yNil^0 has no hues, so hues never help or hurt it. When a foe's skill hits Nil, Nil ^yechoes^0 it and can use it from then on, paying ink.");
    await s.tell("Rooms with a grey floor are ^yquiet rooms^0. Hues do nothing in battles that start there.");
  };
  var vats = async (s) => {
    if (!f7(s, "jarLost") || s.hasItem("gran_jar")) {
      await s.tell("Reclamation vats. Jars of stolen color stand in rows, waiting to be poured into the Loom. None of them are labeled Edgewick.");
      return;
    }
    await s.tell("Reclamation vats. Jars of stolen color stand in rows, waiting to be poured. One label reads UMBER, EDGEWICK. VINTAGE. DELIVERED BY THE CHOIR.");
    await s.say("Wick", "Gran.");
    await s.give("gran_jar");
    await s.say("Brask", "The Choir was punctual. So are we.");
  };
  var halls = {
    id: "spindleHalls",
    name: "The Spindle Halls",
    music: "loom",
    rows: buildHalls(),
    under: "Q",
    outside: "/",
    bg: "thread",
    legend: {
      Q: { kind: "circuit", enc: true },
      V: { kind: "grate", enc: true, greyzone: true }
    },
    theme: { circuit: ["k", "g1", "c1"], grate: ["k", "g1", "g2"], thread: ["k", "g1", "m1"] },
    enc: { rate: 0.13, groups: [["spider2", 3], ["unp2", 3], ["serp", 2], ["warden", 2], ["chorus", 2]] },
    ents: [
      { id: "south", at: "s", kind: "warp", to: ["loomGate", "x", "down"], under: "Q" },
      { id: "north", at: "n", kind: "warp", to: ["weaverChamber", "e", "up"], under: "Q" },
      { id: "nil", at: "i", kind: "npc", spr: NPC.nil, when: (st) => !st.flags.nilJoined, talk: nilTalk },
      { id: "bin", at: "j", kind: "prop", spr: NPC.bin, talk: async (s) => s.tell("Nil's bin, full of colored dust. When Wick leans over it, it smells like every place at once.") },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "vats", at: "v", kind: "prop", spr: NPC.vat, talk: vats },
      { id: "vats2", at: "w", kind: "prop", spr: NPC.vatJar, talk: vats },
      { id: "chestA", at: "a", kind: "chest", item: "grey_ward" },
      { id: "chestB", at: "b", kind: "chest", item: "ink_well", n: 3 },
      { id: "chestC", at: "c", kind: "chest", item: "green_mask" },
      { id: "shop", at: "r", kind: "npc", spr: NPC.theologian, talk: async (s) => {
        await s.say("Spare Parts Bin", "I AM A SPARE PARTS BIN. I HAVE BECOME SELF-AWARE. I WOULD LIKE TO TRADE.");
        await s.shop("loom");
      } }
    ]
  };
  function buildChamber() {
    const g = new Grid(21, 18, "/");
    g.rect(1, 1, 19, 16, "O");
    g.rect(9, 11, 3, 6, "Q");
    g.put(10, 2, "w").put(10, 5, "k").put(10, 8, "b").put(10, 16, "e").put(6, 12, "p");
    g.put(4, 4, "u").put(16, 4, "v");
    return g.rows();
  }
  var spindleFight = async (s) => {
    if (f7(s, "spindleDead")) return;
    s.music("boss");
    await s.tell("The chamber at the top of the Loom is round and very quiet. In its center, turning slowly, is the Spindle: the axle the whole machine hangs from. It notices them.");
    await s.say("Nona", "The Spindle guards the Weaver. It will not let anyone wake her. Especially not me.");
    const r = await s.battle("boss7");
    if (r !== "win") return;
    s.flag("spindleDead");
    await s.tell("The Spindle grinds to a stop. For the first time in a century, the Loom is completely still.");
  };
  var weaverScene = async (s) => {
    if (!f7(s, "spindleDead")) {
      await s.tell("The Spindle is in the way.");
      return;
    }
    if (f7(s, "ordealDone")) return;
    s.music("loom");
    await s.tell("Behind the stilled Spindle hangs an enormous glass eye, cloudy, the size of a house. Deep inside it, something opens.");
    await s.say("The Weaver", "...Nona? You came home. And you brought... oh. A misprint. I made a misprint once, at the very edge. I have always wondered.");
    await s.say("Wick", "You made me?");
    await s.say("The Weaver", "I made everyone. I was running low, even then. I had one ink left in the amber well and nothing in the second. I printed you anyway. It seemed better than printing nothing.");
    await s.tell("Wick does not know what to say to that. Wick says nothing.");
    await s.say("Nona", "Weaver. The world is going grey. The Bishop is taking it back.");
    await s.say("The Weaver", "Yes. I am sorry. The ink is gone, Nona. I have been printing on empty for a hundred years, and the world is unraveling at the edges. So I made a triage routine to keep the rest together.");
    await s.say("The Weaver", "It takes back what the world can spare, and spends it on what it cannot. It gave itself a body. It gave itself a church. I think it gave itself a name.");
    await s.say("Brask", "The Grey Bishop is your... housekeeping?");
    await s.say("The Weaver", "He is me, being careful. I was never very good at being careful.");
    await s.tell("The chamber goes cold. The threads along the walls turn grey one by one.");
    await s.say("The Grey Bishop", "You should not have woken it.");
    s.music("final");
    await s.tell("The Grey Bishop stands where the Spindle was, tall and white and grey, his blank face turned toward Nona.");
    await s.say("The Grey Bishop", "Unit Nona. You are carrying nine spools of ink. Return them.");
    await s.say("Nona", "No.");
    await s.say("The Grey Bishop", "Then I will reclaim all of you, and take them from what is left.");
    await s.battle("ordeal", { canLose: true, survive: 5 });
    s.shake(60);
    await s.flash("w");
    await s.tell("The Bishop raises one hand, and the party comes apart.");
    await s.tell("Not in pain. In order. Tint's violet lifts off her like steam. Brask's moths go pale mid-flight. Nil, who has nothing to lose, loses its shape. Wick's hand goes transparent around the lamp.");
    await s.tell("Then nine lights go up, all at once.");
    await s.say("Nona", "Nine tails. Nine spools. I was saving them for something important.");
    await s.tell("Nona spends them. Every tail unspools at once, and the ink pours out of her into the party, reprinting them line by line, color by color, faster than the Bishop can take them back.");
    await s.say("The Grey Bishop", "Unit Nona. That was the last reserve.");
    await s.say("Nona", "I know. I am a maintenance unit. This is maintenance.");
    await s.tell("When it is over, the party is whole. Nona is grey, and very small, and very still.");
    await s.say("Wick", "Nona. Nona, you have to get up. You can't, you can't just...");
    await s.say("Nona", "Wick. I kept one back. The ninth. It is not like the others.");
    await s.tell("A single thread of light that is not any color on the wheel slips out of her last tail and winds itself around Wick's wrist.");
    await s.say("Nona", "The Ninth Ink. It is not on the wheel. It can print anything, once. You could print yourself a third hue with it. You could be whole.");
    await s.say("Nona", "Or you could... well. You will think of something. You always light the lamp.");
    await s.tell("Nona does not say anything else.");
    s.leave("nona");
    s.toParty("brask");
    s.flag("nonaGone");
    s.flag("ordealDone");
    await s.give("ninth_spool");
    await s.say("Tock", "...I remembered this. I am sorry. I remembered it the whole way, and it didn't help at all.");
    await s.say("The Grey Bishop", "The misprint again. Unindexed. Unfinished. Holding the last ink in the Loom.");
    await s.say("The Grey Bishop", "It does not matter. The Loom will come down to the world now and take it all back directly. Starting at the edge. Starting with Edgewick.");
    s.shake(40);
    await s.tell("The floor opens. The reclamation chute swallows them, and they fall, and fall, out of the bottom of the Loom and down through the clouds.");
    await s.tell("Behind them, something grey and patient jumps in after them.");
    await nextChapter(s, 8);
  };
  var chamber = {
    id: "weaverChamber",
    name: "The Weaver's Chamber",
    music: "loom",
    rows: buildChamber(),
    under: "O",
    outside: "/",
    bg: "thread",
    theme: { grate: ["k", "g1", "c1"], circuit: ["k", "g1", "c2"], thread: ["k", "g1", "c1"] },
    ents: [
      { id: "exit", at: "e", kind: "warp", to: ["spindleHalls", "n", "down"], under: "Q" },
      { id: "weaver", at: "w", kind: "npc", spr: NPC.weaver, talk: weaverScene },
      { id: "spindle", at: "k", kind: "npc", spr: NPC.spindle, when: (st) => !st.flags.spindleDead, talk: spindleFight },
      { id: "boss", at: "b", kind: "trigger", step: spindleFight, under: "O" },
      { id: "lamp", at: "p", kind: "lamp" },
      { id: "spoolU", at: "u", kind: "prop", spr: NPC.spoolProp, talk: async (s) => s.tell("An empty spool. The tag says WELL ONE: AMBER. Underneath, in smaller letters: LAST USED AT THE EDGE.") },
      { id: "spoolV", at: "v", kind: "prop", spr: NPC.spoolProp2, talk: async (s) => s.tell("An empty spool. The tag says WELL TWO. There is nothing else written on it.") }
    ]
  };
  var maps7 = [gate, halls, chamber];
  var chapter7 = {
    title: "The Loom",
    stage: "The ordeal",
    blurb: "The machine that printed the world is out of ink.",
    recruit: "nil",
    ready: true,
    startMap: "loomGate",
    startMarker: "e",
    objective: (st) => {
      const fl = st.flags;
      if (!fl.nilJoined) return "Climb through the Spindle Halls, north of the gate hall.";
      if (!fl.spindleDead) return "Reach the Weaver's chamber at the top of the Spindle Halls.";
      return "Speak to the Weaver.";
    },
    route: [
      { map: "loomGate", ent: "terminal" },
      { map: "loomGate", warp: "north" },
      { map: "spindleHalls", ent: "nil" },
      { map: "spindleHalls", ent: "vats" },
      { map: "spindleHalls", ent: "shop" },
      { map: "spindleHalls", warp: "north" },
      { map: "weaverChamber", ent: "boss" },
      { map: "weaverChamber", ent: "weaver" }
    ]
  };

  // src/maps/ch8.ts
  var ch8_exports = {};
  __export(ch8_exports, {
    chapter: () => chapter8,
    maps: () => maps8
  });
  var f8 = (s, k) => s.has(k);
  var GREY_ROWS = EDGEWICK.map((r, y) => y === 11 ? r.slice(0, 29) + ":=z  " : r);
  var statue2 = (id, at, spr, line) => ({
    id,
    at,
    kind: "npc",
    spr,
    talk: async (s) => s.tell(line)
  });
  var rejoin = (id, flag, lines) => async (s) => {
    if (f8(s, flag)) return;
    for (const [who, text] of lines) await s.say(who, text);
    s.flag(flag);
    const m2 = s.st.members[id];
    if (m2) m2.hp = Math.max(1, m2.hp);
    if (!s.st.party.includes(id) && !s.st.reserve.includes(id)) {
      const before = s.st.party.length;
      s.st[before < 4 ? "party" : "reserve"].push(id);
    }
    s.sfx("lvl");
    await s.tell(`^y${MEMBERS[id].name}^0 is back.`);
    s.refresh();
  };
  var greyIntro = async (s) => {
    if (f8(s, "greyIntro")) return;
    s.flag("greyIntro");
    s.flag("greyWorld");
    s.greyWorld(true);
    s.st.party = ["wick", "nil"].filter((id) => s.st.members[id]);
    s.st.reserve = [];
    for (const id of ["wick", "nil"]) if (s.st.members[id]) s.st.members[id].hp = Math.max(1, s.st.members[id].hp);
    await s.tell("Wick wakes up on the cold path outside the Lamp House.");
    await s.tell("Everything is grey. The grass is grey. The Great Lamp is grey and dark. The villagers stand where they were, grey and still, mid-step, mid-word.");
    await s.tell("Wick looks down at their own hands. Black and amber. Still amber.");
    await s.say("Nil", "You are awake. I followed you down. I do not know why. I think that is what following is.");
    await s.say("Wick", "Where is everyone? Tint? Brask?");
    await s.say("Nil", "We fell in pieces. The others landed somewhere. I landed on you.");
    await s.tell("Above the village, where the sky should be, the Loom hangs lower than Wick has ever seen it. Its underside is open. A long grey spindle has come down out of it and plunged into the Edge, just past the last lamp.");
    await s.say("Wick", "It's taking Edgewick first. It said so.");
    await s.say("Nil", "Then we should find the others quickly. I am not very good at fighting alone. I have never done anything alone. I have only swept.");
  };
  var hatch = async (s) => {
    const back = ["tint", "brask"].filter((id) => s.has(`back_${id}`)).length;
    if (back < 2) {
      await s.tell("A hatch in the side of the grey spindle, where it pierces the Edge. It hums.");
      await s.say("Wick", "Not alone. Tint and Brask are out there somewhere. The wood, maybe. The Edge Lamps.");
      await s.movePlayer("l");
      return;
    }
    if (!f8(s, "hatchSpeech")) {
      s.flag("hatchSpeech");
      await s.say("Wick", "Everyone. The Bishop said he'd start at the edge. This is the edge. I've lived here my whole life.");
      await s.say("Tint", "Then you know it better than he does.");
    }
    await s.warp("spindleDown", "e", "up");
  };
  var edgeGrey = {
    id: "edgewickGrey",
    name: "Edgewick",
    music: "sad",
    rows: GREY_ROWS,
    under: ";",
    outside: "T",
    grey: true,
    theme: {
      grass: ["k", "e2", "e3"],
      ground: ["k", "e1", "e2"],
      path: ["k", "n2", "n3"],
      tree: ["k", "e1", "e2"],
      edge: ["k", "g1", "o3"],
      void: ["k", "g1", "w"],
      roof: ["k", "r1", "o2"],
      brick: ["k", "n1", "n2"],
      bridge: ["k", "g2", "w"]
    },
    enc: { rate: 0.06, groups: [["sheep2", 3], ["knight", 1]] },
    ents: [
      { id: "north", at: "w", kind: "warp", to: ["hollowGrey", "z", "up"], under: ":" },
      { id: "west", at: "x", kind: "trigger", under: ":", step: async (s) => {
        if (!f8(s, "back_vend")) {
          await rejoin("vend", "back_vend", [
            ["VEND", "HELLO. I BOUGHT A RIDE DOWN. IT WAS A FALLING RIDE. IT WAS VERY CHEAP."],
            ["VEND", "I LANDED ON THE WEST ROAD. I HAVE BEEN WALKING SINCE. MY LEGS ARE NOT RATED FOR THIS."]
          ])(s);
          return;
        }
        await s.say("Wick", "Not now. The Spindle.");
        await s.movePlayer("r");
      } },
      { id: "granDoor", at: "g", kind: "warp", to: ["granhouseGrey", "d", "up"], under: "D" },
      { id: "shopDoor", at: "s", kind: "prop", under: "D", solid: true, talk: async (s) => {
        await s.tell("Mott is grey behind the counter, but the shop door is open, and someone has left a note: TAKE WHAT YOU NEED. PAY WHEN THERE ARE COLORS AGAIN.");
        await s.shop("grey");
      } },
      { id: "mayorDoor", at: "m", kind: "prop", under: "D", solid: true, talk: async (s) => s.tell("The mayor's door. The sign still says OUT SUPERVISING.") },
      { id: "lamp1", at: "1", kind: "lamp" },
      { id: "lamp3", at: "3", kind: "lamp", talk: async (s) => {
        if (!f8(s, "back_brask")) {
          s.flag("lit:edgewickGrey:lamp3");
          s.sfx("save");
          await s.flash("y3");
          await s.tell("Wick lights the Edge Lamp. It is the only warm thing for a mile. And out of the grey, one by one, pale moths come to it.");
          await s.tell("Then more. Then a cloud of them, and inside the cloud, a suit of armor putting itself back together, a gauntlet at a time.");
          await rejoin("brask", "back_brask", [
            ["Brask", "Lamp-bearer. We were scattered across the whole Edge. The moths could not find each other in the grey."],
            ["Brask", "Then you lit a lamp. Of course you did."]
          ])(s);
          return;
        }
        await s.tell("The Edge Lamp burns amber against the grey.");
      } },
      { id: "hatch", at: "z", kind: "trigger", step: hatch, under: "=" },
      { id: "greatLamp", at: "l", kind: "npc", spr: NPC.greatLampOut, talk: async (s) => s.tell("The Great Lamp is dark. The lampsap in it has gone grey and hard, like candle wax.") },
      statue2("hollis", "h", NPC.hollis, "Hollis, grey, pointing at the wood. He was warning someone."),
      statue2("sprocket", "k", NPC.sprocket, "Sprocket, grey, one shoe missing. His hand is raised to wave."),
      statue2("pell", "p", NPC.pellGrey, "Pell, grey, holding a grey loaf of bread."),
      statue2("dilly", "v", NPC.villagerGrey, "Dilly, grey, with a grey bird on their head. The bird is also a statue now."),
      statue2("mayor", "o", NPC.mayor, "The mayor, grey, mid-speech. You can tell it was a long one."),
      statue2("sheep", "q", NPC.sheep, "The fog sheep has gone grey. It is hard to tell the difference."),
      { id: "scarecrow", at: "r", kind: "npc", spr: NPC.scarecrow, talk: async (s) => s.say("Scarecrow Unit 4", "FORECAST: GREY. FORECAST: GREY. FORECAST: ONE SMALL AMBER LIGHT, MOVING. HOPE LEVEL: UNCALIBRATED.") },
      { id: "pond", at: "f", kind: "npc", spr: NPC.pond, talk: async (s) => {
        if (f8(s, "back_mirrow")) {
          await s.tell("The pond is grey, but the reflection in it is in color.");
          return;
        }
        await s.tell("Wick looks down into the grey pond, and the reflection looking back is in color. It is not Wick's reflection.");
        await rejoin("mirrow", "back_mirrow", [
          ["Mirrow", "...looking back. I held the gate until it closed on me. Then I was a crack in a door, and then a reflection in the clouds, and then a reflection in this pond."],
          ["Mirrow", "Reflections go wherever there is something to reflect. You were here. So I was here."]
        ])(s);
      } },
      { id: "sign", at: "n", kind: "sign", text: "WEST ROAD. Someone has written underneath, in fresh amber paint: WE CAME BACK." }
    ],
    enter: greyIntro
  };
  var granGrey = {
    id: "granhouseGrey",
    name: "Lamp House",
    music: "sad",
    under: "-",
    outside: "#",
    grey: true,
    rows: ["##########", "#WW####WW#", "#--------#", "#-b----u-#", "#--------#", "#--t--y--#", "#--------#", "####d#####"],
    theme: { wall: ["k", "n2", "n3"], planks: ["k", "n1", "n2"], window: ["k", "n2", "y3"] },
    ents: [
      { id: "door", at: "d", kind: "warp", to: ["edgewickGrey", "g", "down"], under: "D" },
      { id: "bed", at: "b", kind: "prop", spr: NPC.bed, talk: async (s) => s.tell("Wick's bed. Grey now, but still shaped like Wick.") },
      { id: "pot", at: "t", kind: "prop", spr: NPC.pot, talk: async (s) => s.tell("Gran's tallow pot. Empty. Wick checks twice anyway.") },
      { id: "gran", at: "u", kind: "npc", spr: NPC.granGrey, talk: async (s) => {
        if (s.hasItem("gran_jar")) await s.tell("Gran stands by the window, grey. Wick holds up the jar of umber next to her. It is exactly her color. Soon.");
        else await s.tell("Gran stands by the window, grey. Still warm.");
      } },
      { id: "tock", at: "y", kind: "npc", spr: NPC.tockYoung, when: (st) => !st.flags.back_tock, talk: rejoin("tock", "back_tock", [
        ["Tock", "Hello! It's hello at this end, I'm sure of it now. I've been sitting with your grandmother. She's a good listener."],
        ["Tock", "I'm much younger than when we met. Look, my gears are shiny. By the end of this I'll be brand new, and then I won't remember any of you, and that's all right. You'll remember me."]
      ]) }
    ]
  };
  var tintFound = rejoin("tint", "back_tint", [
    ["Tint", "WICK! Oh, thank the colors. I landed in a crater in the middle of the wood. Everything was grey. So I started painting."],
    ["Tint", "I've done eleven trees. It's not going great. The grey keeps coming back. But the trees seem to like it while it lasts."],
    ["Tint", "This crater. Wick, this is where you found Nona, isn't it?"],
    ["Wick", "...Yeah. She was lying right there, being rude to three Blanks."],
    ["Tint", "Then I'm glad I landed here. Come on. Let's go finish her job."]
  ]);
  var hollowGrey = {
    id: "hollowGrey",
    name: "The Hollow Wood",
    music: "sad",
    rows: HOLLOW,
    under: ",",
    outside: "Y",
    dark: 3,
    grey: true,
    legend: { ":": { kind: "path", enc: true } },
    theme: { tall: ["k", "e1", "g1"], path: ["k", "n1", "n2"], pine: ["k", "e1", "g1"], antenna: ["k", "g1", "r2"], rock: ["k", "g1", "g2"], ground: ["k", "e1", "g1"] },
    enc: { rate: 0.12, groups: [["sheep2", 3], ["wraith3", 2], ["knight", 2]] },
    ents: [
      { id: "exit", at: "z", kind: "warp", to: ["edgewickGrey", "w", "down"], under: ":" },
      { id: "lamp1", at: "1", kind: "lamp" },
      { id: "lamp2", at: "2", kind: "lamp" },
      { id: "lamp3", at: "3", kind: "lamp" },
      { id: "tree", at: "t", kind: "npc", spr: NPC.antennaTree, talk: async (s) => s.tell("The Antenna Tree is grey and silent. No stations at all.") },
      { id: "tint", at: "n", kind: "npc", spr: { g: "human", seed: "tint", pal: ["k", "m2", "e3"], o: { head: "bubble", torso: "robe", legs: "skirt", held: "brush" } }, when: (st) => !st.flags.back_tint, talk: tintFound },
      { id: "stagMark", at: "s", kind: "prop", solid: false, spr: NPC.shrine, talk: async (s) => s.tell("Someone has painted a small violet flower on a grey rock. It is the only color in the wood.") },
      { id: "boss", at: "b", kind: "trigger", step: async () => {
      }, under: "," },
      { id: "chestF", at: "f", kind: "chest", item: "honey", n: 2 },
      { id: "chestC", at: "c", kind: "chest", item: "iron_rind" },
      { id: "chestD", at: "d", kind: "chest", item: "ink_well", n: 2 },
      { id: "chestE", at: "e", kind: "chest", item: "relight", n: 2 }
    ]
  };
  function buildSpindle() {
    const g = new Grid(27, 44, "/");
    const room = (x, y, w, h2, c = "Q") => g.rect(x, y, w, h2, c);
    room(8, 37, 11, 6);
    room(2, 29, 9, 7, "V");
    room(16, 29, 9, 7);
    room(8, 21, 11, 7, "V");
    room(2, 12, 9, 7);
    room(16, 12, 9, 7, "V");
    room(9, 5, 9, 6);
    room(10, 1, 7, 3, "O");
    g.path([[13, 37], [13, 33], [10, 33]], "Q");
    g.path([[13, 35], [16, 35], [16, 33]], "Q");
    g.path([[6, 29], [6, 25], [8, 25]], "Q");
    g.path([[20, 29], [20, 25], [18, 25]], "Q");
    g.path([[10, 21], [6, 21], [6, 18]], "V");
    g.path([[17, 21], [20, 21], [20, 18]], "Q");
    g.path([[6, 12], [6, 8], [9, 8]], "Q");
    g.path([[20, 12], [20, 8], [17, 8]], "V");
    g.path([[13, 5], [13, 3]], "O");
    g.put(13, 42, "e");
    g.put(13, 7, "l").put(13, 2, "b").put(13, 1, "o");
    g.put(4, 31, "a").put(22, 31, "c").put(4, 14, "d").put(22, 14, "f").put(16, 24, "h");
    g.put(11, 39, "k");
    return g.rows();
  }
  var finalBattle = async (s) => {
    if (f8(s, "bishopDown")) return;
    s.music("final");
    await s.tell("At the top of the Spindle, where it meets the open belly of the Loom, the Grey Bishop is waiting. Behind him, the whole sky is a machine.");
    await s.say("The Grey Bishop", "The misprint. Carrying the last ink in the world, as if it were a candle.");
    await s.say("The Grey Bishop", "Do you understand what I am? I am what keeps the world from unraveling all at once. I take what can be spared. I have been careful for a hundred years.");
    await s.say("Wick", "You took Gran. You took Nona.");
    await s.say("The Grey Bishop", "I took what could be spared.");
    await s.say("Wick", "They couldn't be spared. Not by me.");
    await s.say("Tint", "He's grey and white. No hues. Nothing we hit him with will clash, unless somebody gives him a color first.");
    await s.say("Tint", "Good thing somebody's me.");
    const r = await s.battle("final");
    if (r !== "win") return;
    s.flag("bishopDown");
    s.shake(60);
    await s.tell("The Bishop falls to one knee. Then he reaches up, and the Loom reaches down, and they meet.");
    await s.tell("Threads pour out of the sky and wrap around him, every color he ever took, until he is the size of a cathedral and wearing the whole machine like a robe.");
    await s.say("The Loom-Bound Bishop", "ENOUGH TRIAGE. I WILL RECLAIM ALL OF IT, AND BEGIN THE WORLD AGAIN SMALLER.");
    await s.say("The Loom-Bound Bishop", "AND YOU, MISPRINT. IF I CANNOT READ YOU, I WILL PRINT YOU OUT.");
    await s.flash("w");
    s.music("sad");
    await s.tell("Wick comes apart. Not their colors. Wick, all of Wick. There is a white page where Wick was standing.");
    await s.tell("...");
    await s.tell("It is quiet on the white page. There is no up. There is no Edgewick. There is, very faintly, the smell of lamp oil.");
    await s.say("Nona", "You are not in the index, Wick.");
    await s.say("Wick", "Nona?");
    await s.say("Nona", "Not really. An echo in the ink I gave you. Listen. He cannot print you out. You were never printed in. You are a misprint. The Loom made you with what it had, and it had enough.");
    await s.say("Nona", "You always light the lamp. So light it.");
    await s.tell("Wick lifts the lamp. The Ninth Ink, wound around their wrist, catches, and burns a color that is not on the wheel.");
    await s.flash("w");
    s.music("final");
    await s.tell("Wick steps back onto the Spindle, whole, holding a lamp that burns every color at once.");
    await s.say("The Loom-Bound Bishop", "...UNINDEXED.");
    await s.say("Wick", "Unfinished. It turns out that's not the same as empty.");
    s.mech("tricolor");
    s.heal();
    await s.tell("^yThe Ninth Ink^0: Wick can now take a third hue in battle with ^yNinth Ink^0, and strike with the best of their hues with ^yTrichrome^0.");
    const r2 = await s.battle("final2");
    if (r2 !== "win") return;
    s.flag("loomDown");
    await ending(s);
  };
  async function ending(s) {
    s.music("title");
    await s.tell("The threads fall away from the Bishop, and underneath them there is only a tall grey figure, very tired, kneeling.");
    await s.say("The Grey Bishop", "There is still no ink, misprint. The Loom is still empty. When I stop, the world unravels at the edges. I was not wrong about that.");
    await s.say("The Weaver", "He is right. Wick. The Ninth Ink can print anything, once.");
    await s.say("The Weaver", "It can print you a third hue, and you will be whole, the way you always wanted. Or it can print one new ink into my empty well, and the Loom can work again. Not as it was. But enough.");
    await s.tell("Everyone is looking at Wick. Tint. Brask and the moths. Nil, holding very still. The little glowing thread around Wick's wrist.");
    const i = await s.ask("What does Wick print?", ["A new ink for the Loom", "A third hue for myself"]);
    if (i === 0) {
      s.flag("endGive");
      await s.say("Wick", "I thought being whole meant having three colors. I thought I was half a person.");
      await s.say("Wick", "I'm not. I got here with two. Give it to the Loom.");
      await s.tell("Wick unwinds the Ninth Ink from their wrist and lets it go. It rises into the empty well, and the well fills, and the whole Loom takes a breath.");
      await s.tell("Color comes down out of the sky like rain.");
      await s.say("The Grey Bishop", "...Oh.");
      await s.tell("A single drop lands on the Bishop. For the first time, he has a hue. It is a soft, ordinary green. He looks at his hands for a long time.");
      await s.say("The Grey Bishop", "I do not know what to do now. There is nothing left to take.");
      await s.say("Nil", "You could sweep. I can show you. It is good work. Nobody expects anything of you, and then sometimes you find a lost color and give it back.");
      s.greyWorld(false);
      s.flag("greyWorld", false);
      s.st.flags["lit:edgewickEnd:lamp1"] = true;
      s.st.flags["lit:edgewickEnd:lamp3"] = true;
      save(s.st);
      await s.fadeOut();
      await s.warp("edgewickEnd", "y", "down");
      await s.fadeIn();
    } else {
      s.flag("endKeep");
      await s.say("Wick", "I've wanted this since before I could talk. Just once, I want to be finished.");
      await s.tell("Wick winds the Ninth Ink tighter, and it sinks into them, and Wick has three colors: black, and amber, and a color that is not on the wheel.");
      await s.tell("It feels like being finished. It feels like it for almost a whole minute.");
      await s.say("The Grey Bishop", "Then the triage continues. Thank you for your cooperation.");
      await s.tell("Nobody says anything. Tint looks at the ground. Brask's moths settle, one by one, and stop moving.");
      s.st.flags.wickHue = "m3";
      save(s.st);
      await s.ending("keep");
      s.st.flags.cleared = true;
      save(s.st);
      await s.tell("^yThe End.^0 There was another choice.");
      s.title();
    }
  }
  var spindle = {
    id: "spindleDown",
    name: "The Descended Spindle",
    music: "loom",
    rows: buildSpindle(),
    under: "Q",
    outside: "/",
    grey: true,
    bg: "thread",
    legend: {
      Q: { kind: "circuit", enc: true },
      V: { kind: "grate", enc: true, greyzone: true }
    },
    theme: { circuit: ["k", "g1", "c1"], grate: ["k", "g1", "g2"], thread: ["k", "g1", "m1"] },
    enc: { rate: 0.14, groups: [["sheep2", 2], ["knight", 3], ["wraith3", 2], ["mixed8", 3]] },
    ents: [
      { id: "exit", at: "e", kind: "warp", to: ["edgewickGrey", "z", "left"], under: "Q" },
      { id: "lamp", at: "l", kind: "lamp" },
      { id: "lamp0", at: "k", kind: "lamp" },
      { id: "boss", at: "b", kind: "trigger", step: finalBattle, under: "O" },
      { id: "bishop", at: "o", kind: "npc", spr: NPC.bishop, when: (st) => !st.flags.bishopDown, talk: finalBattle },
      { id: "chestA", at: "a", kind: "chest", item: "chorus", n: 2 },
      { id: "chestC", at: "c", kind: "chest", item: "honey", n: 3 },
      { id: "chestD", at: "d", kind: "chest", item: "hue_lens" },
      { id: "chestF", at: "f", kind: "chest", item: "ink_well", n: 3 },
      { id: "sign", at: "h", kind: "sign", text: "Carved into the Spindle wall, very small: BUILT TO LAST. Underneath, smaller still: IT DID NOT." }
    ]
  };
  var lastLamp = async (s) => {
    await s.tell("Wick walks out to the last Edge Lamp, past which there has always been nothing.");
    await s.tell("Wick lights it.");
    s.sfx("save");
    await s.flash("y3");
    await s.tell("And past the lamp, for the first time since the world was printed, the Loom prints something new: one tile of grass, then another, then a whole row, unrolling out into the Void like a carpet.");
    await s.say("Tint", "The world's getting bigger.");
    await s.say("Wick", "Somebody's going to need to light lamps out there.");
    s.st.flags.cleared = true;
    save(s.st);
    await s.ending("give");
    s.title();
  };
  var endRows = EDGEWICK.map((r, y) => y === 12 ? r.slice(0, 14) + "y" + r.slice(15) : r);
  var epilogue = {
    id: "edgewickEnd",
    name: "Edgewick",
    music: "village",
    rows: endRows,
    under: ";",
    outside: "T",
    theme: edgeGrey.theme,
    ents: [
      { id: "north", at: "w", kind: "prop", under: ":", solid: true, talk: async (s) => s.tell("The Hollow Wood. The antenna trees are playing music again.") },
      { id: "west", at: "x", kind: "prop", under: ":", solid: true, talk: async (s) => s.tell("The west road. Pilgrims are coming the other way now, to see the village at the edge of the world.") },
      { id: "granDoor", at: "g", kind: "prop", under: "D", solid: true, talk: async (s) => s.tell("The Lamp House. The door is open and it smells like bread.") },
      { id: "shopDoor", at: "s", kind: "prop", under: "D", solid: true, talk: async (s) => s.tell("Edgewick Stores. Mott has put up a sign: EVERYTHING IS FREE TODAY. EXCEPT THE BREAD. PELL SAID.") },
      { id: "mayorDoor", at: "m", kind: "prop", under: "D", solid: true, talk: async (s) => s.tell("The mayor's door. The sign says IN, FOR ONCE.") },
      { id: "lamp1", at: "1", kind: "lamp", talk: async (s) => s.tell("The Edge Lamp burns amber.") },
      { id: "lamp2", at: "2", kind: "lamp", talk: lastLamp },
      { id: "lamp3", at: "3", kind: "lamp", talk: async (s) => s.tell("The Edge Lamp burns amber.") },
      { id: "greatLamp", at: "l", kind: "npc", spr: NPC.greatLamp, talk: async (s) => s.tell("The Great Lamp burns amber and loud. Someone has painted a thin violet stripe around its glass.") },
      { id: "gran", at: "a", kind: "npc", spr: NPC.gran, talk: async (s) => {
        if (s.hasItem("gran_jar")) {
          if (!f8(s, "jarOpened")) {
            s.flag("jarOpened");
            await s.tell("Wick opens the jar. The warm brown light pours out and finds its way home.");
          }
        }
        await s.say("Gran Umber", "There you are, wick-in-the-wind. I was grey for a while, they tell me. I don't remember it. I remember you going.");
        await s.say("Gran Umber", "You look the same. Black and amber. Good. I was worried you'd come back all fancy.");
        await s.say("Wick", "I almost did.");
        await s.say("Gran Umber", "Well. You didn't. The last Edge Lamp needs lighting. Go on. I'll put the bread on.");
      } },
      { id: "tint", at: "k", kind: "npc", spr: { g: "human", seed: "tint", pal: ["k", "m2", "e3"], o: { head: "bubble", torso: "robe", legs: "skirt", held: "brush" } }, talk: async (s) => s.say("Tint", "I'm going back to Prismouth. I'm going to paint the Lens back together. Then I'm coming back here, because somebody has to paint all that new grass.") },
      { id: "brask", at: "h", kind: "npc", spr: NPC.brask, talk: async (s) => s.say("Brask", "We asked where the color goes. Now we know where it comes from, too. The moths would like to stay near your lamps. If that is permitted.") },
      { id: "vend", at: "p", kind: "npc", spr: NPC.vend, talk: async (s) => {
        await s.say("VEND", "THE BAKER GAVE ME A LOAF OF BREAD. FOR FREE. I DID NOT PAY. I DID NOT KNOW WHAT TO DO.");
        await s.say("VEND", "I HAVE PUT IT IN MY TOP SHELF. I WILL KEEP IT FOREVER.");
      } },
      { id: "tock", at: "v", kind: "npc", spr: NPC.tockYoung, talk: async (s) => s.say("Tock", "Hello! Oh, that's right, it's hello now. I don't remember any of you. You all seem very nice. The amber one keeps crying at me.") },
      { id: "nil", at: "o", kind: "npc", spr: NPC.nil, talk: async (s) => s.say("Nil", "The Bishop and I are going to sweep the Loom. He is not very good at it yet. I am patient. I have always been patient. Now I am also something else. I do not know the word.") },
      { id: "mirrow", at: "f", kind: "npc", spr: NPC.mirrow, talk: async (s) => s.say("Mirrow", "...everyone smiling. I am reflecting it. It is the brightest thing I have ever held.") },
      { id: "sprocket", at: "n", kind: "npc", spr: NPC.sprocket, talk: async (s) => s.say("Sprocket", "Wick! I decided I'm keeping all three of my colors. But I'm going to be a lamplighter anyway. You don't need to be a Duotone for it, right?") },
      { id: "scarecrow", at: "r", kind: "npc", spr: NPC.scarecrow, talk: async (s) => s.say("Scarecrow Unit 4", "FORECAST: COLOR. ALL OF IT. SCATTERED EVERYWHERE. ALSO CROWS. THE CROWS REMAIN CONSTANT.") },
      { id: "arrive", at: "y", kind: "trigger", under: ";", step: async () => {
      } },
      { id: "nona", at: "q", kind: "npc", spr: NPC.nonaGrey, talk: async (s) => {
        await s.tell("A small statue of a cat with nine tails, carved from grey stone, sits beside the Great Lamp. Someone has put it where the light falls on it best.");
        await s.tell("Tint has painted the eyes cyan.");
      } }
    ]
  };
  var maps8 = [edgeGrey, granGrey, hollowGrey, spindle, epilogue];
  var chapter8 = {
    title: "The Third Ink",
    stage: "The road back",
    blurb: "Wick falls home. Home is grey. The Loom is coming down after them.",
    ready: true,
    startMap: "edgewickGrey",
    startMarker: "a",
    presetFlags: { greyWorld: true },
    objective: (st) => {
      const fl = st.flags;
      if (!fl.back_tint || !fl.back_brask) return "Find your scattered friends. Try the Hollow Wood, and the Edge Lamps.";
      if (!fl.bishopDown) return "Enter the Spindle through the hatch at the east Edge, and climb to the top.";
      if (fl.endGive) return "Light the last Edge Lamp.";
      return "Face the Loom-Bound Bishop.";
    },
    route: [
      { map: "edgewickGrey", ent: "lamp3" },
      { map: "edgewickGrey", ent: "pond" },
      { map: "edgewickGrey", ent: "shopDoor" },
      { map: "edgewickGrey", warp: "granDoor" },
      { map: "granhouseGrey", ent: "tock" },
      { map: "granhouseGrey", warp: "door" },
      { map: "edgewickGrey", ent: "west" },
      { map: "edgewickGrey", warp: "north" },
      { map: "hollowGrey", ent: "tint" },
      { map: "hollowGrey", warp: "exit" },
      { map: "edgewickGrey", ent: "hatch" },
      { map: "spindleDown", ent: "boss" },
      { map: "edgewickEnd", ent: "gran" },
      { map: "edgewickEnd", ent: "lamp2" }
    ]
  };

  // src/maps/index.ts
  var MODULES = [ch1_exports, ch2_exports, ch3_exports, ch4_exports, ch5_exports, ch6_exports, ch7_exports, ch8_exports];
  var MAPS = {};
  for (const m2 of MODULES) for (const d of m2.maps) MAPS[d.id] = d;
  var CHAPTERS = [
    chapter,
    chapter2,
    chapter3,
    chapter4,
    chapter5,
    chapter6,
    chapter7,
    chapter8
  ];

  // src/scenes/ui.ts
  var Menu = class {
    constructor(items, rows = 6, cols = 1) {
      __publicField(this, "items", items);
      __publicField(this, "rows", rows);
      __publicField(this, "cols", cols);
      __publicField(this, "idx", 0);
      __publicField(this, "top", 0);
    }
    get cur() {
      return this.items[this.idx];
    }
    setItems(items) {
      this.items = items;
      this.idx = Math.min(this.idx, Math.max(0, items.length - 1));
      this.clampTop();
    }
    clampTop() {
      const perPage = this.rows * this.cols;
      const row = Math.floor(this.idx / this.cols);
      if (row < this.top) this.top = row;
      if (row >= this.top + this.rows) this.top = row - this.rows + 1;
      this.top = Math.max(0, Math.min(this.top, Math.ceil(this.items.length / this.cols) - this.rows));
      if (this.items.length <= perPage) this.top = 0;
    }
    update(input, audio) {
      const n = this.items.length;
      if (n > 0) {
        let moved = false;
        if (input.repeat("down")) {
          this.idx = (this.idx + this.cols) % (Math.ceil(n / this.cols) * this.cols);
          if (this.idx >= n) this.idx = this.idx % this.cols;
          moved = true;
        }
        if (input.repeat("up")) {
          this.idx -= this.cols;
          if (this.idx < 0) {
            this.idx += Math.ceil(n / this.cols) * this.cols;
            while (this.idx >= n) this.idx -= this.cols;
          }
          moved = true;
        }
        if (this.cols > 1 && input.repeat("right")) {
          this.idx = Math.min(n - 1, this.idx + 1);
          moved = true;
        }
        if (this.cols > 1 && input.repeat("left")) {
          this.idx = Math.max(0, this.idx - 1);
          moved = true;
        }
        if (moved) {
          audio.sfx("move");
          this.clampTop();
        }
      }
      if (input.pressed("a")) {
        if (n && this.cur?.enabled !== false) {
          audio.sfx("ok");
          return "ok";
        }
        audio.sfx("bump");
      }
      if (input.pressed("b")) {
        audio.sfx("back");
        return "back";
      }
      return null;
    }
    draw(g, x, y, w, t, active = true, box = true) {
      const colW = (w - 12) / this.cols;
      const h2 = this.rows * LINE_H + 6;
      if (box) g.box(x, y, w, h2);
      const start = this.top * this.cols;
      for (let i = 0; i < this.rows * this.cols; i++) {
        const it = this.items[start + i];
        if (!it) break;
        const cx = x + 9 + i % this.cols * colW;
        const cy = y + 4 + Math.floor(i / this.cols) * LINE_H;
        const col = it.enabled === false ? "g1" : it.color ?? "w";
        if (it.hue) {
          g.rect(cx, cy + 1, 3, 3, HUE_COLOR[it.hue]);
          g.text(it.label, cx + 5, cy, col);
        } else g.text(it.label, cx, cy, col);
        if (it.right) g.textR(it.right, cx + colW - 4, cy, it.enabled === false ? "g1" : "g2");
        if (start + i === this.idx && active) g.cursor(cx - 6, cy, t);
        else if (start + i === this.idx) g.text("`", cx - 5, cy, "g1");
      }
      const totalRows = Math.ceil(this.items.length / this.cols);
      if (this.top > 0) g.rect(x + w - 5, y + 2, 3, 1, "g2");
      if (this.top + this.rows < totalRows) g.rect(x + w - 5, y + h2 - 4, 3, 1, "g2");
    }
  };
  function hueChips(g, hues, x, y) {
    hues.forEach((h2, i) => {
      g.rect(x + i * 4, y, 3, 3, h2 === "N" ? "g2" : HUE_COLOR[h2]);
    });
  }
  function centerBox(g, text, y, col = "w") {
    const w = textW(text) + 10;
    g.box(80 - Math.ceil(w / 2), y, w, 11);
    g.textC(text, 80, y + 3, col);
  }

  // src/scenes/dialog.ts
  var BOX_Y = 114;
  var BOX_H = 46;
  var LINES = 4;
  function portraitFor(who) {
    const key = who.toLowerCase();
    return MEMBERS[key]?.sprite ?? PORTRAITS[key];
  }
  var DialogScene = class {
    constructor(g, who, text, spr, done) {
      __publicField(this, "g", g);
      __publicField(this, "who", who);
      __publicField(this, "done", done);
      __publicField(this, "overlay", true);
      __publicField(this, "pages", []);
      __publicField(this, "page", 0);
      __publicField(this, "shown", 0);
      __publicField(this, "t", 0);
      __publicField(this, "spr");
      this.spr = spr ?? (who ? portraitFor(who) : void 0);
      const width = this.spr ? 160 - 30 : 160 - 12;
      const lines = wrap(text, width);
      for (let i = 0; i < lines.length; i += LINES) this.pages.push(lines.slice(i, i + LINES));
      if (!this.pages.length) this.pages.push([""]);
    }
    get total() {
      return this.pages[this.page].reduce((s, l) => s + l.replace(/\^./g, "").length, 0);
    }
    update() {
      this.t++;
      const inp = this.g.input;
      const fast = inp.isDown("a") || inp.isDown("b");
      if (this.shown < this.total) {
        const before = this.shown;
        this.shown = Math.min(this.total, this.shown + (fast ? 4 : 1.5));
        if (Math.floor(this.shown / 3) !== Math.floor(before / 3)) this.g.audio.sfx("blip");
        if (inp.pressed("a")) this.shown = this.total;
        return;
      }
      if (inp.pressed("a") || inp.pressed("b")) {
        if (this.page < this.pages.length - 1) {
          this.page++;
          this.shown = 0;
          this.g.audio.sfx("tick");
        } else {
          this.g.pop(this);
          this.done();
        }
      }
    }
    draw(g) {
      g.box(0, BOX_Y, 160, BOX_H);
      let tx = 6;
      if (this.spr) {
        g.rect(4, BOX_Y + 5, 20, 20, "ink");
        g.sprite(this.spr, 6, BOX_Y + 7, { scale: 2, grey: false });
        tx = 28;
      }
      if (this.who) {
        const w = textW(this.who) + 8;
        g.box(4, BOX_Y - 8, w, 10);
        g.text(this.who, 8, BOX_Y - 6, "y2");
      }
      let left = this.shown;
      this.pages[this.page].forEach((line, i) => {
        if (left <= 0) return;
        g.text(line, tx, BOX_Y + 5 + i * (LINE_H + 2), "w", Math.floor(left));
        left -= line.replace(/\^./g, "").length;
      });
      if (this.shown >= this.total && Math.floor(this.t / 16) % 2 === 0) {
        g.rect(152, BOX_Y + BOX_H - 6, 3, 1, "w");
        g.rect(153, BOX_Y + BOX_H - 5, 1, 1, "w");
      }
    }
  };
  var ChoiceScene = class {
    constructor(g, q, opts, done) {
      __publicField(this, "g", g);
      __publicField(this, "done", done);
      __publicField(this, "overlay", true);
      __publicField(this, "menu");
      __publicField(this, "lines");
      __publicField(this, "t", 0);
      this.menu = new Menu(opts.map((o) => ({ label: o })), Math.min(opts.length, 5));
      this.lines = q ? wrap(q, 148) : [];
    }
    update() {
      this.t++;
      const r = this.menu.update(this.g.input, this.g.audio);
      if (r === "ok") {
        this.g.pop(this);
        this.done(this.menu.idx);
      }
    }
    draw(g) {
      if (this.lines.length) {
        g.box(0, BOX_Y, 160, BOX_H);
        this.lines.slice(0, LINES).forEach((l, i) => g.text(l, 6, BOX_Y + 5 + i * (LINE_H + 2)));
      }
      const w = Math.max(...this.menu.items.map((i) => textW(i.label))) + 18;
      const h2 = this.menu.rows * LINE_H + 6;
      this.menu.draw(g, 156 - w, BOX_Y - h2 - 2, w, this.t);
    }
  };

  // src/battle/engine.ts
  var NEGATIVE = ["static", "stun", "grey", "hush"];
  var STATUS_NAME = {
    static: "Static",
    stun: "Stun",
    grey: "Grey",
    hush: "Hush",
    regen: "Regen",
    taunt: "Taunt",
    mirror: "Glass",
    primed: "Primed",
    painted: "Painted",
    charge: "Charging"
  };
  function stageMult(s) {
    return s >= 0 ? 1 + 0.25 * s : 1 / (1 - 0.25 * s);
  }
  function goldUnit(lvl) {
    return 4 + lvl;
  }
  var Battle = class {
    constructor(cfg) {
      __publicField(this, "units");
      __publicField(this, "rng");
      __publicField(this, "time", 0);
      __publicField(this, "mech");
      __publicField(this, "canFlee");
      __publicField(this, "gold");
      __publicField(this, "items");
      __publicField(this, "link", 0);
      __publicField(this, "last", null);
      __publicField(this, "result", null);
      __publicField(this, "fleeTries", 0);
      __publicField(this, "turn", 0);
      __publicField(this, "nextUid", 1);
      __publicField(this, "stolen", 0);
      __publicField(this, "makeEnemy");
      __publicField(this, "greyField", false);
      /** Counters the balance sim reads. */
      __publicField(this, "stats", { clashes: 0, blends: 0, breaks: 0, crits: 0, dmgToParty: 0, dmgToFoes: 0, healed: 0, minPartyFrac: 1 });
      this.rng = new Rng(cfg.seed ?? Math.floor(Math.random() * 1e9));
      this.mech = cfg.mech;
      this.canFlee = cfg.canFlee;
      this.gold = cfg.gold;
      this.items = cfg.items;
      this.makeEnemy = cfg.makeEnemy;
      this.greyField = !!cfg.greyField;
      this.units = [...cfg.party, ...cfg.enemies];
      for (const u of this.units) {
        u.uid = this.nextUid++;
        u.next = this.interval(u) * this.rng.range(0.15, 1);
        if (u.traits.has("first")) u.next = this.rng.range(0.01, 0.1);
        u.mark = u.hp;
        if (u.side === 1) u.loaded = u.loaded ?? u.baseHues[0];
      }
    }
    get party() {
      return this.units.filter((u) => u.side === 0);
    }
    get enemies() {
      return this.units.filter((u) => u.side === 1 && !u.gone);
    }
    byUid(uid) {
      return this.units.find((u) => u.uid === uid);
    }
    alive(side) {
      return this.units.filter((u) => u.side === side && u.alive && !u.gone);
    }
    eff(u, s) {
      return u[s] * stageMult(u.stg[s]);
    }
    interval(u) {
      return 2e3 / (this.eff(u, "spd") + 20);
    }
    defHues(u) {
      if (u.st.grey || this.greyField) return ["N", "N"];
      const h2 = [...u.baseHues];
      if (u.st.painted) h2[0] = u.st.painted.v;
      if (u.extraHue) h2[1] = u.extraHue;
      return h2;
    }
    /** The palette a unit should be drawn with, so its colors always show its current hues. */
    displayPal(u) {
      const p2 = [...u.spec.pal];
      if (u.st.grey) return ["k", "g2", "g3"];
      if (u.st.painted) p2[1] = HUE_COLOR[u.st.painted.v];
      if (u.extraHue) p2[2] = HUE_COLOR[u.extraHue];
      return p2;
    }
    atkHue(u, sk, t) {
      if (u.st.grey || this.greyField) return "N";
      const h2 = sk.hue;
      if (h2 === "wpn") return u.st.primed?.v ?? u.weaponHue;
      if (h2 === "loaded") return u.loaded;
      if (h2 === "invert") return t ? opposite(this.defHues(t)[0]) : "N";
      const own = [...u.baseHues.filter((x) => x !== "N"), ...u.extraHue ? [u.extraHue] : []];
      if (h2 === "best") return this.bestOf(own.length ? own : ["N"], t);
      if (h2 === "Y" && u.extraHue && u.id === "wick") return this.bestOf(["Y", u.extraHue], t);
      return h2 ?? "N";
    }
    bestOf(hues, t) {
      if (!t) return hues[0];
      let best = hues[0];
      for (const h2 of hues) if (hueMult(h2, this.defHues(t)) > hueMult(best, this.defHues(t))) best = h2;
      return best;
    }
    skillCost(u, sk) {
      const ink = u.side === 0 && u.echo.includes(sk.id) ? echoCost(sk) : sk.ink ?? 0;
      return { ink, gold: (sk.gold ?? 0) * goldUnit(u.lvl), tails: sk.tails ?? 0 };
    }
    echo(from, sk, targets, ev) {
      if (from.side !== 1 || !this.mech.has("echo") || !echoable(sk)) return;
      for (const t of targets) {
        if (t.id !== "nil" || t.side !== 0 || !t.alive || t.echo.includes(sk.id)) continue;
        t.echo.push(sk.id);
        t.skills.push(sk.id);
        ev.push({ k: "msg", text: `${t.name} echoes ${sk.name}!` });
      }
    }
    canUse(u, id) {
      const sk = SKILLS[id];
      if (!sk) return false;
      if (sk.mech && !this.mech.has(sk.mech)) return false;
      if (u.st.hush && id !== "attack") return false;
      const c = this.skillCost(u, sk);
      if (u.ink < c.ink || this.gold < c.gold || u.tails < c.tails) return false;
      if (sk.target === "ko" && !this.party.some((p2) => p2.side === u.side && !p2.alive)) return false;
      if (id === "link" && this.link < 100) return false;
      if (sk.fx === "reflect" && !this.last) return false;
      return true;
    }
    /** Units in the order they will act next, ignoring future statuses. */
    forecast(n) {
      const live = this.units.filter((u) => u.alive && !u.gone);
      const times = new Map(live.map((u) => [u, u.next]));
      const out = [];
      for (let i = 0; i < n && live.length; i++) {
        let best = live[0];
        for (const u of live) {
          const a = times.get(u), b2 = times.get(best);
          if (a < b2 || a === b2 && (u.side < best.side || u.side === best.side && u.uid < best.uid)) best = u;
        }
        out.push(best);
        times.set(best, times.get(best) + this.interval(best));
      }
      return out;
    }
    nextUnit() {
      let best = null;
      for (const u of this.units) {
        if (!u.alive || u.gone) continue;
        if (!best || u.next < best.next || u.next === best.next && (u.side < best.side || u.side === best.side && u.uid < best.uid)) best = u;
      }
      return best;
    }
    /** Advances to the next actor and resolves start-of-turn effects. */
    beginTurn() {
      const u = this.nextUnit();
      this.time = u.next;
      this.turn++;
      u.turns++;
      u.guard = false;
      u.mark = u.hp;
      const ev = [];
      let skip = false;
      if (u.st.regen || u.traits.has("regen")) {
        const n = Math.max(1, Math.round(u.maxHp * (u.st.regen ? 0.07 : 0.04)));
        this.heal(u, n, ev);
      }
      if (u.st.static) {
        const n = Math.max(1, Math.round(u.maxHp * (u.boss ? 0.025 : 0.07)));
        ev.push({ k: "msg", text: `Static crackles on ${u.name}.` });
        this.hurt(u, n, ev);
        if (!u.alive) skip = true;
      }
      if (!skip && u.broken) {
        u.broken = false;
        u.shell = u.maxShell;
        ev.push({ k: "recover", uid: u.uid });
        ev.push({ k: "msg", text: `${u.name} pulls itself back together.` });
        skip = true;
      } else if (!skip && u.st.stun) {
        delete u.st.stun;
        ev.push({ k: "status", uid: u.uid, s: "stun", on: false });
        ev.push({ k: "msg", text: `${u.name} is stunned and loses the turn.` });
        skip = true;
      }
      if (skip) {
        if (u.alive) u.next += this.interval(u);
        this.tickStatuses(u, ev);
        this.checkEnd(ev);
      }
      return { u, ev, skip };
    }
    act(u, a) {
      const ev = [];
      let delay = 100;
      let setNext = null;
      if (a.t === "guard") {
        u.guard = true;
        const gain = Math.max(1, Math.round(u.maxInk * 0.06));
        u.ink = Math.min(u.maxInk, u.ink + gain);
        ev.push({ k: "act", uid: u.uid, name: "Guard" });
        delay = 60;
      } else if (a.t === "flee") {
        ev.push({ k: "act", uid: u.uid, name: "Flee" });
        if (!this.canFlee) {
          ev.push({ k: "msg", text: "There is no running from this." });
        } else {
          const chance = 0.55 + 0.15 * this.fleeTries;
          this.fleeTries++;
          if (this.rng.chance(chance)) {
            this.result = "flee";
            ev.push({ k: "end", result: "flee" });
            return ev;
          }
          ev.push({ k: "msg", text: "The way out is blocked." });
        }
      } else if (a.t === "item") {
        this.useItem(u, a.item, a.target, ev);
      } else {
        const sk = SKILLS[a.skill];
        delay = sk.delay ?? 100;
        const r = this.useSkill(u, sk, a, ev);
        if (r !== null) setNext = r;
      }
      if (u.alive) u.next = setNext ?? u.next + this.interval(u) * delay / 100;
      this.tickStatuses(u, ev);
      this.checkEnd(ev);
      return ev;
    }
    tickStatuses(u, ev) {
      for (const [k, s] of Object.entries(u.st)) {
        if (k === "charge") continue;
        s.t--;
        if (s.t <= 0) {
          delete u.st[k];
          ev.push({ k: "status", uid: u.uid, s: k, on: false });
          if (k === "painted" || k === "grey") ev.push({ k: "hues", uid: u.uid });
        }
      }
    }
    checkEnd(ev) {
      if (this.result) return;
      if (this.alive(1).length === 0) {
        this.result = "win";
        ev.push({ k: "end", result: "win" });
      } else if (this.alive(0).length === 0) {
        this.result = "lose";
        ev.push({ k: "end", result: "lose" });
      }
      const p2 = this.party;
      const frac = p2.reduce((s, x) => s + Math.max(0, x.hp), 0) / p2.reduce((s, x) => s + x.maxHp, 0);
      this.stats.minPartyFrac = Math.min(this.stats.minPartyFrac, frac);
    }
    hurt(t, n, ev, meta = {}) {
      if (!t.alive) return;
      t.hp = Math.max(0, t.hp - n);
      ev.push({ k: "dmg", uid: t.uid, n, ...meta });
      if (t.side === 0) this.stats.dmgToParty += n;
      else this.stats.dmgToFoes += n;
      if (t.hp <= 0) this.kill(t, ev);
    }
    kill(t, ev) {
      t.alive = false;
      t.hp = 0;
      t.broken = false;
      for (const k of Object.keys(t.st)) delete t.st[k];
      t.stg = { str: 0, def: 0, mnd: 0, spd: 0 };
      t.extraHue = t.side === 0 ? t.extraHue : void 0;
      ev.push({ k: "die", uid: t.uid });
      if (t.side === 1 && t.id === "coinmite" && this.stolen > 0) {
        this.gold += this.stolen;
        ev.push({ k: "gold", n: this.stolen });
        ev.push({ k: "msg", text: `You get back ${this.stolen} gold.` });
        this.stolen = 0;
      }
    }
    heal(t, n, ev) {
      if (!t.alive) return;
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + Math.round(n));
      this.stats.healed += t.hp - before;
      ev.push({ k: "heal", uid: t.uid, n: t.hp - before });
    }
    addStatus(t, id, turns, ev, v) {
      if (!t.alive) return false;
      if (id === "static" && t.traits.has("nostatic")) return false;
      if (id === "grey" && t.traits.has("nogrey")) return false;
      if (id === "stun" && t.boss) return false;
      if (id === "hush" && t.boss) return false;
      const had = !!t.st[id];
      t.st[id] = { t: Math.max(turns, t.st[id]?.t ?? 0), v };
      if (!had) ev.push({ k: "status", uid: t.uid, s: id, on: true });
      if (id === "grey" || id === "painted") ev.push({ k: "hues", uid: t.uid });
      return true;
    }
    addStage(t, stat, d, ev) {
      const before = t.stg[stat];
      t.stg[stat] = Math.max(-3, Math.min(3, before + d));
      if (t.stg[stat] !== before) ev.push({ k: "stage", uid: t.uid, stat, d: t.stg[stat] - before });
    }
    push(t, pct, ev) {
      const amt = this.interval(t) * pct / 100 * (t.boss ? 0.6 : 1);
      t.next += amt;
      ev.push({ k: "push", uid: t.uid, d: amt });
    }
    damage(u, t, sk, pmul = 1, hueOverride) {
      const mag = sk.kind === "mag";
      const a = mag ? this.eff(u, "mnd") : this.eff(u, "str");
      const d = mag ? this.eff(t, "mnd") * 0.5 + this.eff(t, "def") * 0.5 : this.eff(t, "def");
      let n = a * (sk.power ?? 1) * pmul * a / (a + d);
      n *= this.rng.range(0.9, 1.1);
      const hue = hueOverride ?? this.atkHue(u, sk, t);
      let mult = hueMult(hue, this.defHues(t));
      if (mult > 1 && u.traits.has("clash")) mult += 0.2;
      n *= mult;
      let crit = false;
      if (!mag && this.rng.chance(u.traits.has("crit") ? 0.12 : 0.06)) {
        crit = true;
        n *= 1.5;
      }
      if (t.guard) n *= 0.5;
      if (t.broken) n *= 1.5;
      return { n: Math.max(1, Math.round(n)), mult, crit, hue };
    }
    /** Average damage without randomness, for AI evaluation. */
    expect(u, t, sk, pmul = 1, hueOverride) {
      const mag = sk.kind === "mag";
      const a = mag ? this.eff(u, "mnd") : this.eff(u, "str");
      const d = mag ? this.eff(t, "mnd") * 0.5 + this.eff(t, "def") * 0.5 : this.eff(t, "def");
      let n = a * (sk.power ?? 1) * pmul * a / (a + d);
      const hue = hueOverride ?? this.atkHue(u, sk, t);
      let mult = hueMult(hue, this.defHues(t));
      if (mult > 1 && u.traits.has("clash")) mult += 0.2;
      n *= mult * (sk.hits ?? 1);
      if (!mag) n *= 1.03;
      if (t.guard) n *= 0.5;
      if (t.broken) n *= 1.5;
      return { n: Math.max(1, n), mult };
    }
    strike(u, t, sk, ev, pmul = 1, hueOverride) {
      const r = this.damage(u, t, sk, pmul, hueOverride);
      if (r.mult > 1) this.stats.clashes++;
      if (r.mult < 1) this.stats.blends++;
      if (r.crit) this.stats.crits++;
      this.hurt(t, r.n, ev, { crit: r.crit, mult: r.mult, hue: r.hue });
      if (this.mech.has("link") && u.side === 0) {
        const gain = (r.mult > 1 ? 8 : 2) + (r.crit ? 5 : 0);
        this.link = Math.min(100, this.link + gain);
        ev.push({ k: "link", v: this.link });
      }
      if (this.mech.has("break") && t.side === 1 && t.maxShell > 0 && t.alive && !t.broken) {
        let crack = 0;
        if (r.mult > 1) crack += 1 + (u.traits.has("breaker") ? 1 : 0);
        crack += sk.breakDmg ?? 0;
        if (crack > 0) {
          t.shell = Math.max(0, t.shell - crack);
          if (t.shell === 0) {
            t.broken = true;
            this.stats.breaks++;
            t.next += this.interval(t) * 0.6;
            ev.push({ k: "break", uid: t.uid });
            ev.push({ k: "msg", text: `${t.name}'s shell shatters!` });
            if (this.mech.has("link")) {
              this.link = Math.min(100, this.link + 20);
              ev.push({ k: "link", v: this.link });
            }
          }
        }
      }
      return r.n;
    }
    pickFoe(u, want) {
      const foes = this.alive(u.side === 0 ? 1 : 0);
      if (!foes.length) return void 0;
      if (u.side === 1) {
        const taunt = foes.find((f9) => f9.st.taunt);
        if (taunt) return taunt;
      }
      const w = this.byUid(want);
      if (w && w.alive && !w.gone && w.side !== u.side) return w;
      return this.rng.pick(foes);
    }
    targets(u, sk, want) {
      const same = u.side;
      const other = same === 0 ? 1 : 0;
      switch (sk.target) {
        case "foe": {
          const f9 = this.pickFoe(u, want);
          return f9 ? [f9] : [];
        }
        case "foes":
          return this.alive(other);
        case "ally": {
          const w = this.byUid(want);
          if (w && w.alive && w.side === same) return [w];
          const al = this.alive(same);
          return al.length ? [al.reduce((a, b2) => a.hp / a.maxHp <= b2.hp / b2.maxHp ? a : b2)] : [];
        }
        case "allies":
          return this.alive(same);
        case "self":
          return [u];
        case "ko": {
          const w = this.byUid(want);
          if (w && !w.alive && w.side === same && !w.gone) return [w];
          const ko = this.units.filter((x) => x.side === same && !x.alive && !x.gone);
          return ko.length ? [ko[0]] : [];
        }
        case "rand":
          return [];
      }
    }
    /** Returns an explicit next time when the skill sets it, otherwise null. */
    useSkill(u, sk, a, ev, free = false, pmul = 1) {
      if (!free) {
        const c = this.skillCost(u, sk);
        u.ink -= c.ink;
        u.tails -= c.tails;
        if (c.gold) {
          this.gold -= c.gold;
          ev.push({ k: "gold", n: -c.gold });
        }
      }
      if (sk.id !== "attack" && sk.fx !== "reflect" && sk.fx !== "link" && !free) this.last = { skill: sk.id, side: u.side, uid: u.uid };
      if (sk.id === "attack" && !free) this.last = { skill: "attack", side: u.side, uid: u.uid };
      const hueShown = sk.kind === "phys" || sk.kind === "mag" ? this.atkHue(u, sk, null) : void 0;
      ev.push({ k: "act", uid: u.uid, name: sk.name, hue: hueShown });
      let setNext = null;
      const fx = sk.fx ?? "";
      if (fx === "reflect") return this.reflect(u, ev);
      if (fx === "link") {
        this.doLink(u, a.partner, ev);
        return null;
      }
      if (fx === "jackpot") {
        this.jackpot(u, sk, ev);
        return null;
      }
      if (fx === "spectrum" || sk.target === "rand") {
        const hits = sk.hits ?? 1;
        for (let i = 0; i < hits; i++) {
          const foes = this.alive(u.side === 0 ? 1 : 0);
          if (!foes.length) break;
          const t = this.rng.pick(foes);
          this.strike(u, t, sk, ev, pmul, fx === "spectrum" ? this.rng.pick(WHEEL) : void 0);
        }
        return null;
      }
      if (fx.startsWith("charge:")) {
        u.mem.charged = fx.slice(7);
        u.st.charge = { t: 99 };
        ev.push({ k: "status", uid: u.uid, s: "charge", on: true });
        ev.push({ k: "msg", text: TELEGRAPH[fx.slice(7)] ?? `${u.name} is gathering power.` });
        return null;
      }
      if (fx.startsWith("summon:")) {
        const id = fx.slice(7);
        if (this.makeEnemy && this.alive(1).length < 5) {
          const n = this.makeEnemy(id);
          n.uid = this.nextUid++;
          n.side = 1;
          n.summoned = true;
          n.next = this.time + this.interval(n) * 0.8;
          n.mark = n.hp;
          n.loaded = n.baseHues[0];
          this.units.push(n);
          ev.push({ k: "summon", uid: n.uid });
        } else ev.push({ k: "msg", text: "Nothing answers." });
        return null;
      }
      if (fx === "shift_hue") {
        const h1 = this.rng.pick(WHEEL);
        let h2 = this.rng.pick(WHEEL);
        if (this.rng.chance(0.35)) h2 = h1;
        u.baseHues = [h1, h2];
        u.loaded = h1;
        u.spec = { ...u.spec, pal: ["k", HUE_COLOR[h1], h2 === h1 ? HUE_LIGHT_OF(h1) : HUE_COLOR[h2]] };
        ev.push({ k: "hues", uid: u.uid });
        return null;
      }
      if (fx === "bribe") {
        const take = Math.min(this.gold, Math.max(10, Math.round(this.gold * 0.08)), 200);
        this.gold -= take;
        ev.push({ k: "gold", n: -take });
        ev.push({ k: "msg", text: `${u.name} pockets ${take} of your gold and feels better.` });
        this.heal(u, take * 2 + u.maxHp * 0.03, ev);
        return null;
      }
      if (fx === "tricolor") {
        u.extraHue = a.hue ?? "C";
        u.spec = { ...u.spec, pal: [u.spec.pal[0], u.spec.pal[1], HUE_COLOR[u.extraHue]] };
        ev.push({ k: "hues", uid: u.uid });
        ev.push({ k: "msg", text: `${u.name} takes a third ink!` });
        return null;
      }
      if (fx === "load") {
        u.loaded = a.hue ?? u.loaded;
        ev.push({ k: "hues", uid: u.uid });
        return null;
      }
      const ts = this.targets(u, sk, a.target);
      if (u.side === 1 && sk.kind === "mag" && sk.target === "foe" && ts[0]?.st.mirror) {
        const t = ts[0];
        delete t.st.mirror;
        ev.push({ k: "status", uid: t.uid, s: "mirror", on: false });
        ev.push({ k: "msg", text: "The glass throws it back!" });
        this.strike(u, u, sk, ev, pmul);
        return null;
      }
      for (const t of ts) {
        const hits = sk.hits ?? 1;
        for (let h2 = 0; h2 < hits && t.alive; h2++) {
          if ((sk.kind === "phys" || sk.kind === "mag" || sk.kind === "debuff" && sk.power) && t.side !== u.side) {
            const n = this.strike(u, t, sk, ev, pmul);
            if (fx === "drain") this.heal(u, n * 0.5, ev);
            if (fx === "steal_gold" && this.gold > 0) {
              const take = Math.min(this.gold, 4 + u.lvl);
              this.gold -= take;
              this.stolen += take;
              ev.push({ k: "gold", n: -take });
              ev.push({ k: "msg", text: `${u.name} pilfers ${take} gold!` });
            }
          }
        }
        if (sk.kind === "heal") {
          if (fx === "revive") {
            if (!t.alive) {
              t.alive = true;
              t.hp = Math.max(1, Math.round(t.maxHp * (sk.power ?? 0.5)));
              ev.push({ k: "revive", uid: t.uid });
            }
          } else if (fx === "rewind") {
            const target = Math.max(t.mark, t.hp + this.eff(u, "mnd") * (sk.power ?? 0.4));
            this.heal(t, target - t.hp, ev);
          } else if (fx === "restock") {
            const n = Math.round(t.maxInk * 0.2);
            t.ink = Math.min(t.maxInk, t.ink + n);
            ev.push({ k: "heal", uid: t.uid, n, ink: true });
          } else if (fx === "selfrewind") {
            const back = +(u.mem.hpBack ?? u.hp);
            this.heal(t, Math.max(0, back - t.hp), ev);
          } else if (sk.power) {
            this.heal(t, this.eff(u, "mnd") * sk.power * this.rng.range(0.95, 1.05) + 2, ev);
          }
          if (fx === "cleanse") this.cleanse(t, ev);
        }
        if (!t.alive) continue;
        if (sk.status) {
          if (this.rng.chance(sk.status.chance)) this.addStatus(t, sk.status.id, sk.status.turns, ev, sk.status.v);
        }
        if (sk.stage) {
          this.addStage(t, sk.stage.stat, sk.stage.d, ev);
          if (fx === "beacon") this.addStage(t, "mnd", sk.stage.d, ev);
        }
        if (sk.push && t.side !== u.side) this.push(t, sk.push, ev);
        if (fx === "scan") ev.push({ k: "scan", uid: t.uid });
        if (fx === "paint") this.addStatus(t, "painted", 3, ev, u.loaded);
        if (fx === "prime") this.addStatus(t, "primed", 3, ev, u.loaded);
        if (fx === "wash") {
          for (const s of ["regen", "taunt", "painted", "primed", "mirror"]) if (t.st[s]) {
            delete t.st[s];
            ev.push({ k: "status", uid: t.uid, s, on: false });
          }
          for (const s of ["str", "def", "mnd", "spd"]) if (t.stg[s] > 0) this.addStage(t, s, -t.stg[s], ev);
          ev.push({ k: "hues", uid: t.uid });
        }
        if (fx === "hasten") {
          t.next = this.time + 1e-3;
          ev.push({ k: "msg", text: `${t.name} is up next.` });
          if (t === u) setNext = t.next;
        }
        if (fx === "buyout") {
          if (t.boss) {
            ev.push({ k: "msg", text: `${t.name} is not for sale.` });
            continue;
          }
          const price = Math.round(Math.max(goldUnit(u.lvl) * 2, t.hp * 0.6));
          if (this.gold < price) {
            ev.push({ k: "msg", text: `Not enough gold. It wants ${price}.` });
            continue;
          }
          this.gold -= price;
          ev.push({ k: "gold", n: -price });
          t.alive = false;
          t.hp = 0;
          ev.push({ k: "leave", uid: t.uid });
          ev.push({ k: "msg", text: `${t.name} takes ${price} gold and leaves quietly.` });
        }
      }
      this.echo(u, sk, ts, ev);
      return setNext;
    }
    cleanse(t, ev) {
      for (const s of NEGATIVE) if (t.st[s]) {
        delete t.st[s];
        ev.push({ k: "status", uid: t.uid, s, on: false });
      }
      for (const s of ["str", "def", "mnd", "spd"]) if (t.stg[s] < 0) this.addStage(t, s, -t.stg[s], ev);
      ev.push({ k: "hues", uid: t.uid });
    }
    reflect(u, ev) {
      const last2 = this.last;
      if (!last2) {
        ev.push({ k: "msg", text: "There is nothing to reflect." });
        return null;
      }
      const sk = SKILLS[last2.skill];
      if (!sk) return null;
      ev.push({ k: "msg", text: `The glass shows ${sk.name}.` });
      const fromFoe = last2.side !== u.side;
      this.useSkill(u, sk, {}, ev, true, fromFoe ? 1.25 : 1);
      return null;
    }
    doLink(u, partnerUid, ev) {
      const p2 = this.byUid(partnerUid);
      this.link = 0;
      ev.push({ k: "link", v: 0 });
      const partner = p2 && p2.alive && p2 !== u ? p2 : this.alive(u.side).find((x) => x !== u);
      ev.push({ k: "msg", text: partner ? `${u.name} and ${partner.name} link up!` : `${u.name} links with nobody.` });
      const sk = SKILLS.link;
      const firstHue = (x) => x.weaponHue !== "N" ? x.weaponHue : x.baseHues.find((h2) => h2 !== "N") ?? "N";
      for (const t of this.alive(u.side === 0 ? 1 : 0)) {
        const phys = this.eff(u, "str") >= this.eff(u, "mnd");
        this.strike(u, t, { ...sk, kind: phys ? "phys" : "mag", power: 1.15 }, ev, 1, firstHue(u));
        if (partner && t.alive) {
          const pp = this.eff(partner, "str") >= this.eff(partner, "mnd");
          this.strike(partner, t, { ...sk, kind: pp ? "phys" : "mag", power: 1.15 }, ev, 1, firstHue(partner));
        }
      }
      if (partner) partner.next += this.interval(partner) * 0.5;
    }
    jackpot(u, sk, ev) {
      const reels = [this.rng.pick(WHEEL), this.rng.pick(WHEEL), this.rng.pick(WHEEL)];
      if (this.rng.chance(0.3)) reels[1] = reels[0];
      ev.push({ k: "reels", hues: reels });
      const counts = /* @__PURE__ */ new Map();
      for (const r of reels) counts.set(r, (counts.get(r) ?? 0) + 1);
      let best = reels[0];
      for (const [h2, c] of counts) if (c > (counts.get(best) ?? 0)) best = h2;
      const n = counts.get(best);
      if (n === 3) {
        ev.push({ k: "msg", text: "JACKPOT!" });
        for (const t of this.alive(1 - u.side)) this.strike(u, t, { ...sk, power: 2.6 }, ev, 1, best);
      } else if (n === 2) {
        ev.push({ k: "msg", text: "Two of a kind." });
        for (const t of this.alive(1 - u.side)) this.strike(u, t, { ...sk, power: 1.2 }, ev, 1, best);
      } else {
        const refund = goldUnit(u.lvl);
        this.gold += refund;
        ev.push({ k: "gold", n: refund });
        ev.push({ k: "msg", text: "No match. Partial refund." });
        const t = this.pickFoe(u);
        if (t) this.strike(u, t, { ...sk, power: 0.6 }, ev, 1, "N");
      }
    }
    useItem(u, id, target, ev) {
      const it = ITEMS[id];
      if (!it?.use || (this.items[id] ?? 0) <= 0) {
        ev.push({ k: "msg", text: "Nothing happens." });
        return;
      }
      this.items[id]--;
      ev.push({ k: "act", uid: u.uid, name: it.name });
      const use = it.use;
      const side = u.side;
      let ts = [];
      const w = this.byUid(target);
      if (use.target === "ally") ts = w && w.alive && w.side === side ? [w] : [u];
      else if (use.target === "allies") ts = this.alive(side);
      else if (use.target === "ko") ts = w && !w.alive && w.side === side ? [w] : this.units.filter((x) => x.side === side && !x.alive && !x.gone).slice(0, 1);
      else if (use.target === "foe") ts = w && w.alive && w.side !== side ? [w] : this.alive(1 - side).slice(0, 1);
      else ts = this.alive(1 - side);
      for (const t of ts) {
        if (use.revive && !t.alive) {
          t.alive = true;
          t.hp = Math.max(1, Math.round(t.maxHp * use.revive));
          ev.push({ k: "revive", uid: t.uid });
        }
        if (use.heal) this.heal(t, use.heal, ev);
        if (use.ink) {
          const before = t.ink;
          t.ink = Math.min(t.maxInk, t.ink + use.ink);
          ev.push({ k: "heal", uid: t.uid, n: t.ink - before, ink: true });
        }
        if (use.cure) this.cleanse(t, ev);
        if (use.fx === "hasten") {
          t.next = this.time + 1e-3;
          ev.push({ k: "msg", text: `${t.name} is up next.` });
        }
        if (use.dmg) {
          const hue = use.hue === "rand" ? this.rng.pick(WHEEL) : use.hue ?? "N";
          const mult = hueMult(hue, this.defHues(t));
          const n = Math.max(1, Math.round(use.dmg * mult * this.rng.range(0.9, 1.1) * (t.broken ? 1.5 : 1)));
          this.hurt(t, n, ev, { mult, hue });
        }
      }
    }
    /** Enemies defeated so far, for rewards. */
    rewards() {
      let xp = 0, gold = 0;
      const drops = [];
      for (const e of this.units) {
        if (e.side !== 1 || e.alive) continue;
        xp += e.xp;
        gold += e.gold;
        for (const [id, p2] of e.drops) if (this.rng.chance(p2)) drops.push(id);
      }
      return { xp, gold, drops };
    }
  };
  function echoable(sk) {
    if (sk.id === "attack" || sk.id === "link") return false;
    if (sk.fx && sk.fx !== "drain") return false;
    return sk.kind === "phys" || sk.kind === "mag" || sk.kind === "debuff" || sk.kind === "heal";
  }
  function echoCost(sk) {
    return Math.round(3 + (sk.power ?? 0.6) * 3 * (sk.target === "foes" || sk.target === "allies" ? 1.6 : 1) * (sk.hits ?? 1));
  }
  function HUE_LIGHT_OF(h2) {
    const m2 = { R: "r3", Y: "y3", G: "e3", C: "c3", B: "b3", M: "m3", N: "g3" };
    return m2[h2];
  }

  // src/data/enemies.ts
  var ENEMIES = {};
  function mk(id, name, lvl, sprite, pal, skills, m2, shell, desc, extra = {}) {
    const spec = sprite.kind ? { g: "beast", pal, o: { kind: sprite.kind } } : sprite.g === "human" ? { g: "human", seed: id, pal } : { g: "monster", seed: id, pal, o: { shape: sprite.shape ?? "blob" }, n: sprite.n ?? 1 };
    ENEMIES[id] = {
      id,
      name,
      lvl,
      pal,
      sprite: spec,
      skills,
      shell,
      desc,
      hp: Math.round((12 + 5 * lvl) * (m2.hp ?? 1)),
      str: Math.round((6 + 1.75 * lvl) * (m2.str ?? 1)),
      def: Math.round((5 + 1.25 * lvl) * (m2.def ?? 1)),
      mnd: Math.round((6 + 1.6 * lvl) * (m2.mnd ?? 1)),
      spd: Math.round((8 + 0.8 * lvl) * (m2.spd ?? 1)),
      xp: Math.round((4 + 2.6 * Math.pow(lvl, 1.3)) * (m2.xp ?? 1)),
      gold: Math.round((3 + 1.7 * lvl) * (m2.gold ?? 1)),
      ...extra
    };
  }
  mk(
    "lint_wolf",
    "Lint Wolf",
    1,
    { shape: "crawler" },
    ["k", "g2", "g3"],
    [["bite", 3], ["lint_howl", 1]],
    { hp: 0.9 },
    0,
    "A wolf of dryer lint. It howls for socks it never had."
  );
  mk(
    "hush_moth",
    "Hush Moth",
    2,
    { shape: "flyer" },
    ["k", "g1", "g3"],
    [["bite", 2], ["dust", 1]],
    { hp: 0.8, spd: 1.2 },
    0,
    "Eats sound first, then color."
  );
  mk(
    "static_newt",
    "Static Newt",
    2,
    { shape: "worm" },
    ["k", "g2", "w"],
    [["zap", 2], ["bite", 1]],
    { hp: 0.85, mnd: 1.1 },
    0,
    "Its skin plays the channel between channels."
  );
  mk(
    "blank_pup",
    "Blank Pup",
    3,
    { shape: "blob" },
    ["k", "g1", "g2"],
    [["bite", 2], ["drain", 1]],
    {},
    0,
    "A young Blank. It nuzzles colorful things until they stop being colorful."
  );
  mk(
    "antenna_crab",
    "Antenna Crab",
    3,
    { shape: "bug" },
    ["k", "g2", "g3"],
    [["pinch", 2], ["harden", 1]],
    { hp: 1.1, def: 1.4, spd: 0.8 },
    0,
    "Lives in the roots of antenna trees and picks up distant weather."
  );
  mk(
    "gloam_stag",
    "Gloam Stag",
    4,
    { shape: "tall" },
    ["k", "g1", "w"],
    [["tackle", 2], ["lint_howl", 1], ["bite", 1]],
    { hp: 2.4, str: 1.1, xp: 3, gold: 3 },
    0,
    "The oldest Blank in the wood. Its antlers pick up a station that went off the air."
  );
  mk(
    "grey_moth",
    "Grey Moth",
    5,
    { shape: "flyer", n: 2 },
    ["k", "g2", "w"],
    [["wing_buffet", 2], ["moth_kiss", 1], ["bite", 2]],
    { hp: 2.2, str: 2.3, mnd: 2.5, spd: 1.5, xp: 6, gold: 6 },
    0,
    "It drinks color through a proboscis longer than a road.",
    { ai: "grey_moth", boss: true }
  );
  mk(
    "beepbog",
    "Beepbog",
    5,
    { shape: "blob" },
    ["k", "e2", "y2"],
    [["croak", 1], ["bite", 2]],
    {},
    0,
    "A frog that croaks in dial tones."
  );
  mk(
    "crayonfish",
    "Crayonfish",
    6,
    { shape: "star" },
    ["k", "r2", "o3"],
    [["crayon_jab", 3], ["harden", 1]],
    { def: 1.2 },
    0,
    "Writes its name on rocks. Can only spell the first letter."
  );
  mk(
    "radio_heron",
    "Radio Heron",
    6,
    { shape: "tall" },
    ["k", "c2", "w"],
    [["peck", 2], ["broadcast", 1]],
    { spd: 1.2 },
    0,
    "Stands on one leg to get better reception."
  );
  mk(
    "glitch_newt",
    "Glitch Newt",
    7,
    { shape: "worm" },
    ["k", "m2", "e3"],
    [["glitch", 3], ["zap", 1]],
    { mnd: 1, hp: 0.9 },
    0,
    "Sometimes appears twice. Only one of it is real."
  );
  mk(
    "paint_slime",
    "Paint Slime",
    7,
    { shape: "blob" },
    ["k", "b2", "b3"],
    [["ooze", 2], ["bite", 1]],
    { hp: 1.2, spd: 0.8 },
    0,
    "A puddle of blue that got ideas."
  );
  mk(
    "static_wisp",
    "Static Wisp",
    8,
    { shape: "ghost" },
    ["k", "c3", "m2"],
    [["wisp_fire", 2], ["zap", 1]],
    { mnd: 1.2, hp: 0.85 },
    0,
    "A ghost made of a song nobody finished."
  );
  mk(
    "octachrome",
    "Octachrome",
    9,
    { shape: "ghost", n: 2 },
    ["k", "r2", "y2"],
    [["tentacle", 3], ["ink_squirt", 2]],
    { hp: 3.3, str: 3.1, mnd: 3.2, spd: 2.2, xp: 6, gold: 8 },
    0,
    "The Hue Thief. Eight arms, eight stolen colors, and it only ever wears two.",
    { ai: "octachrome", boss: true }
  );
  mk(
    "bell_ghoul",
    "Bell Ghoul",
    9,
    { shape: "ghost" },
    ["k", "y1", "y3"],
    [["toll", 1], ["bite", 2]],
    {},
    2,
    "Rings when it is hungry. It is always hungry."
  );
  mk(
    "hymnal_mimic",
    "Hymnal Mimic",
    10,
    { shape: "totem" },
    ["k", "r1", "w"],
    [["page_cut", 3], ["harden", 1]],
    { def: 1.2 },
    3,
    "A hymn book with teeth. It knows every verse and hums the wrong one."
  );
  mk(
    "censer_drone",
    "Censer Drone",
    10,
    { shape: "eye" },
    ["k", "c1", "o2"],
    [["censer", 2], ["zap", 1]],
    { hp: 0.9 },
    2,
    "Swings incense that smells like a server room."
  );
  mk(
    "pew_crawler",
    "Pew Crawler",
    11,
    { shape: "crawler" },
    ["k", "n2", "e1"],
    [["pew_bite", 3]],
    { hp: 1.1 },
    2,
    "A church bench that learned to walk and never learned to stop."
  );
  mk(
    "acolyte",
    "Grey Acolyte",
    11,
    { g: "human" },
    ["k", "b3", "w"],
    [["hymn", 2], ["mend_choir", 1], ["bite", 1]],
    { mnd: 1.1 },
    2,
    "Sings color out of the air and into a jar."
  );
  mk(
    "rib_sentinel",
    "Rib Sentinel",
    12,
    { shape: "tall" },
    ["k", "g2", "r2"],
    [["rib_slam", 2], ["harden", 1]],
    { hp: 1.5, def: 1.2 },
    4,
    "A rib of the dead giant, still guarding the heart it used to hold."
  );
  mk(
    "templar",
    "Loom Templar",
    13,
    { g: "human" },
    ["k", "b1", "y2"],
    [["rib_slam", 2], ["page_cut", 2], ["harden", 1]],
    { hp: 1.2, def: 1.1 },
    3,
    "A knight of the Church. Its armor is full. That is the difference between it and Brask."
  );
  mk(
    "choirboy",
    "Choirboy",
    11,
    { g: "human" },
    ["k", "b2", "w"],
    [["hymn", 2], ["mend_choir", 1]],
    { hp: 0.7 },
    2,
    "Hits the high notes. Also hits you."
  );
  mk(
    "cantor_hush",
    "Cantor Hush",
    13,
    { shape: "totem", n: 2 },
    ["k", "w", "b3"],
    [["hymn", 2], ["hush", 1], ["page_cut", 2]],
    { hp: 1.5, str: 3.5, mnd: 3.85, spd: 2, xp: 6, gold: 8 },
    6,
    "The soloist of the Grey Choir. His voice has no color and too much volume.",
    { ai: "cantor", boss: true }
  );
  mk(
    "gearsand_scorpion",
    "Gearsand Scorpion",
    13,
    { shape: "bug" },
    ["k", "y2", "n3"],
    [["sting", 2], ["pinch", 1]],
    {},
    2,
    "Built from sand that is really very small gears."
  );
  mk(
    "paradox_hen",
    "Paradox Hen",
    14,
    { kind: "bird" },
    ["k", "w", "r2"],
    [["lay_egg", 1], ["hen_peck", 2]],
    { hp: 1.1 },
    2,
    "Its chicks hatch before it lays them. It is tired."
  );
  mk(
    "hen_chick",
    "Early Chick",
    12,
    { kind: "bird" },
    ["k", "y3", "r3"],
    [["peck", 1]],
    { hp: 0.5, xp: 0.3, gold: 0.3 },
    1,
    "Arrived yesterday. Will be laid tomorrow."
  );
  mk(
    "dune_clock",
    "Dune Clock",
    14,
    { shape: "eye" },
    ["k", "e2", "y3"],
    [["chime", 2], ["bite", 1]],
    { mnd: 1.1 },
    3,
    "Keeps perfect time for a town that has not been built yet."
  );
  mk(
    "minute_mite",
    "Minute Mite",
    15,
    { shape: "bug" },
    ["k", "m1", "e2"],
    [["rush", 1]],
    { hp: 0.7, spd: 1.7 },
    1,
    "Lives for exactly one minute, over and over."
  );
  mk(
    "hourglass_golem",
    "Hourglass Golem",
    16,
    { shape: "totem" },
    ["k", "o2", "c2"],
    [["sand_slam", 3], ["glass_skin", 1]],
    { hp: 1.6, def: 1.1, spd: 0.8 },
    4,
    "When it falls over, it gets younger."
  );
  mk(
    "chronophage",
    "Chronophage",
    17,
    { shape: "worm", n: 2 },
    ["k", "e2", "m2"],
    [["devour_hour", 3], ["bite", 1]],
    { hp: 3.6, str: 6.3, mnd: 6.3, spd: 2, xp: 6, gold: 8 },
    6,
    "A worm that eats hours. The monastery has been Tuesday for a century.",
    { ai: "chronophage", boss: true }
  );
  mk(
    "coinmite",
    "Coinmite",
    17,
    { shape: "bug" },
    ["k", "y2", "y3"],
    [["pilfer", 3]],
    { hp: 0.8, spd: 1.3, gold: 2 },
    2,
    "Collects loose change, and pockets, and hands."
  );
  mk(
    "repo_drone",
    "Repo Drone",
    18,
    { shape: "eye" },
    ["k", "r2", "g3"],
    [["repossess", 2], ["zap", 1]],
    {},
    3,
    "Here to collect. It has a form for everything."
  );
  mk(
    "haggle_imp",
    "Haggle Imp",
    18,
    { g: "human" },
    ["k", "m2", "o2"],
    [["haggle", 1], ["claw", 2]],
    { spd: 1.2 },
    2,
    "Will sell you your own shoes at a discount."
  );
  mk(
    "moon_rat",
    "Moon Rat",
    19,
    { shape: "crawler" },
    ["k", "g2", "c3"],
    [["gnaw", 3]],
    {},
    2,
    "Chewed a hole in the moon. It was already hollow. The rat is proud anyway."
  );
  mk(
    "tag_mimic",
    "Tag Mimic",
    20,
    { shape: "totem" },
    ["k", "w", "r2"],
    [["price_hike", 1], ["page_cut", 2]],
    { hp: 1.2 },
    3,
    "A price tag with a creature attached. Everything here is for sale, including it."
  );
  mk(
    "hired_goon",
    "Hired Goon",
    18,
    { g: "human" },
    ["k", "n2", "r2"],
    [["claw", 2], ["tackle", 1]],
    { hp: 0.9, xp: 0.5, gold: 0.3 },
    2,
    "Paid by the hour. Checks the clock between punches."
  );
  mk(
    "baron_surplus",
    "Baron Surplus",
    21,
    { shape: "totem", n: 2 },
    ["k", "y2", "m2"],
    [["gold_rain", 2], ["claw", 2]],
    { hp: 4, str: 3.5, mnd: 3.5, spd: 2, xp: 6, gold: 10 },
    7,
    "Owns the market, the moon, and a small percentage of your future.",
    { ai: "baron", boss: true }
  );
  mk(
    "stormkite",
    "Stormkite",
    21,
    { shape: "flyer" },
    ["k", "b2", "y3"],
    [["gust", 1], ["bolt", 2]],
    { spd: 1.2, hp: 0.9 },
    2,
    "A kite that cut its own string."
  );
  mk(
    "cloud_whale",
    "Cloud Whale",
    22,
    { kind: "whale" },
    ["k", "w", "c2"],
    [["whale_song", 1], ["body_slam", 2]],
    { hp: 2, spd: 0.7, xp: 1.6 },
    4,
    "Swims through weather. Its song is a low-pressure system."
  );
  mk(
    "vine_lurker",
    "Vine Lurker",
    22,
    { shape: "worm" },
    ["k", "e1", "r2"],
    [["constrict", 3]],
    {},
    3,
    "Grew up the Tether and forgot to stop being hungry."
  );
  mk(
    "sky_pirate",
    "Sky Pirate",
    23,
    { g: "human" },
    ["k", "r2", "b3"],
    [["cutlass", 3], ["harden", 1]],
    {},
    2,
    "Plunders clouds for their silver linings."
  );
  mk(
    "ion_jelly",
    "Ion Jelly",
    24,
    { shape: "ghost" },
    ["k", "m3", "c2"],
    [["jelly_sting", 3]],
    { mnd: 1.15, hp: 0.9 },
    2,
    "Drifts in the high air and stings satellites."
  );
  mk(
    "seraph_k7",
    "Seraph K-7",
    25,
    { shape: "star", n: 3 },
    ["k", "w", "y2"],
    [["halo_ray", 3], ["wing_blades", 2]],
    { hp: 3.2, str: 2.7, mnd: 2.8, spd: 2, xp: 6, gold: 10 },
    8,
    "The gate guardian. Its halo is a targeting ring.",
    { ai: "seraph", boss: true }
  );
  mk(
    "spool_spider",
    "Spool Spider",
    25,
    { shape: "bug" },
    ["k", "g3", "m2"],
    [["spin_web", 1], ["bite", 3]],
    {},
    3,
    "Rewinds loose thread. Sometimes the thread was a person."
  );
  mk(
    "unprinter",
    "Unprinter",
    26,
    { shape: "eye" },
    ["k", "g1", "w"],
    [["unprint_ray", 2], ["bite", 1]],
    { mnd: 1.1 },
    3,
    "An eye that looks at color until the color leaves."
  );
  mk(
    "thread_serpent",
    "Thread Serpent",
    27,
    { shape: "worm" },
    ["k", "r2", "c3"],
    [["thread_lash", 3]],
    {},
    3,
    "One very long stitch that came loose."
  );
  mk(
    "loom_warden",
    "Loom Warden",
    28,
    { shape: "tall" },
    ["k", "b1", "y2"],
    [["warden_cleave", 2], ["harden", 1]],
    { hp: 1.5 },
    5,
    "Built to protect the Loom from anything, including repairs."
  );
  mk(
    "grey_chorister",
    "Grey Chorister",
    27,
    { g: "human" },
    ["k", "g2", "w"],
    [["hymn", 2], ["mend_choir", 1]],
    {},
    2,
    "A choir member who reached the top and forgot the song."
  );
  mk(
    "the_spindle",
    "The Spindle",
    29,
    { shape: "totem", n: 2 },
    ["k", "c2", "r2"],
    [["thread_lash", 3], ["compress", 1]],
    { hp: 4.25, str: 2.8, mnd: 2.8, spd: 2, xp: 6, gold: 10 },
    7,
    "The axle of the Loom. It turns the world, and it would like to stop.",
    { ai: "spindle", boss: true }
  );
  mk(
    "grey_bishop_1",
    "Grey Bishop",
    34,
    { kind: "bishop" },
    ["k", "g2", "w"],
    [["compress", 2], ["erase", 2]],
    { hp: 30, str: 1.2, mnd: 1.2, xp: 0, gold: 0 },
    0,
    "The Loom's triage routine, wearing a church.",
    { ai: "bishop_ordeal", boss: true }
  );
  mk(
    "null_sheep",
    "Null Sheep",
    29,
    { kind: "sheep" },
    ["k", "g3", "w"],
    [["fleece", 1], ["tackle", 2]],
    { hp: 1.2 },
    2,
    "Counting them makes you forget what came before."
  );
  mk(
    "eraser_knight",
    "Eraser Knight",
    30,
    { g: "human" },
    ["k", "g1", "m3"],
    [["eraser_edge", 3], ["harden", 1]],
    { hp: 1.3, def: 1.1 },
    4,
    "Sworn to remove every mistake. It started with its own face."
  );
  mk(
    "palette_wraith",
    "Palette Wraith",
    31,
    { shape: "ghost" },
    ["k", "r3", "b3"],
    [["wraith_wail", 2], ["palette_swap", 1]],
    { mnd: 1.15 },
    3,
    "The ghost of every color the Bishop took. It is angry at everyone."
  );
  mk(
    "grey_bishop",
    "Grey Bishop",
    34,
    { shape: "totem", n: 3 },
    ["k", "g2", "w"],
    [["compress", 2], ["erase", 2]],
    { hp: 3.15, str: 2.2, mnd: 2.3, spd: 2.2, xp: 0, gold: 0 },
    8,
    "Grey and white. No hue can touch him until someone paints him.",
    { ai: "bishop", boss: true }
  );
  mk(
    "bishop_loom",
    "The Loom-Bound Bishop",
    36,
    { shape: "star", n: 3 },
    ["k", "g2", "w"],
    [["compress", 2], ["erase", 2], ["warden_cleave", 1]],
    { hp: 4.4, str: 2.2, mnd: 2.4, spd: 2.2, xp: 0, gold: 0 },
    8,
    "The Bishop, wearing the Loom like a robe. Its colors change as it pulls them from the world.",
    { ai: "bishop2", boss: true }
  );
  var GROUPS = {
    // Chapter 1
    wolf1: { enemies: ["lint_wolf"] },
    wolf2: { enemies: ["lint_wolf", "lint_wolf"] },
    moth2: { enemies: ["hush_moth", "lint_wolf"] },
    newt2: { enemies: ["static_newt", "hush_moth"] },
    pup1: { enemies: ["blank_pup", "lint_wolf"] },
    crab1: { enemies: ["antenna_crab", "static_newt"] },
    pup3: { enemies: ["blank_pup", "hush_moth", "blank_pup"] },
    stag: { enemies: ["gloam_stag"], flee: false },
    boss1: { enemies: ["grey_moth"], flee: false, music: "boss" },
    // Chapter 2
    bog2: { enemies: ["beepbog", "beepbog"] },
    fish2: { enemies: ["crayonfish", "beepbog"] },
    heron: { enemies: ["radio_heron", "crayonfish"] },
    newt3: { enemies: ["glitch_newt", "paint_slime"] },
    slime3: { enemies: ["paint_slime", "radio_heron", "beepbog"] },
    wisp2: { enemies: ["static_wisp", "glitch_newt"] },
    wisp3: { enemies: ["static_wisp", "paint_slime", "crayonfish"] },
    boss2: { enemies: ["octachrome"], flee: false, music: "boss" },
    // Chapter 3
    ghoul2: { enemies: ["bell_ghoul", "bell_ghoul"] },
    mimic2: { enemies: ["hymnal_mimic", "censer_drone"] },
    pew3: { enemies: ["pew_crawler", "bell_ghoul", "censer_drone"] },
    aco2: { enemies: ["acolyte", "acolyte"] },
    aco3: { enemies: ["acolyte", "pew_crawler", "hymnal_mimic"] },
    rib: { enemies: ["rib_sentinel", "censer_drone"] },
    templars: { enemies: ["templar", "acolyte", "templar"], flee: false },
    boss3: { enemies: ["choirboy", "cantor_hush", "choirboy"], flee: false, music: "boss" },
    // Chapter 4
    scorp2: { enemies: ["gearsand_scorpion", "gearsand_scorpion"] },
    hen: { enemies: ["paradox_hen", "gearsand_scorpion"] },
    clock2: { enemies: ["dune_clock", "minute_mite"] },
    mite3: { enemies: ["minute_mite", "minute_mite", "dune_clock"] },
    golem: { enemies: ["hourglass_golem", "minute_mite"] },
    golem2: { enemies: ["hourglass_golem", "paradox_hen"] },
    boss4: { enemies: ["chronophage"], flee: false, music: "boss" },
    // Chapter 5
    mite5: { enemies: ["coinmite", "coinmite", "coinmite"] },
    repo: { enemies: ["repo_drone", "haggle_imp"] },
    rat2: { enemies: ["moon_rat", "moon_rat"] },
    tag: { enemies: ["tag_mimic", "coinmite"] },
    imp3: { enemies: ["haggle_imp", "moon_rat", "repo_drone"] },
    boss5: { enemies: ["baron_surplus"], flee: false, music: "boss" },
    // Chapter 6
    kite2: { enemies: ["stormkite", "stormkite"] },
    whale: { enemies: ["cloud_whale"] },
    vine2: { enemies: ["vine_lurker", "stormkite"] },
    pirate: { enemies: ["sky_pirate", "sky_pirate"] },
    jelly3: { enemies: ["ion_jelly", "vine_lurker", "ion_jelly"] },
    crew: { enemies: ["sky_pirate", "cloud_whale", "stormkite"] },
    boss6: { enemies: ["seraph_k7"], flee: false, music: "boss" },
    // Chapter 7
    spider2: { enemies: ["spool_spider", "spool_spider"] },
    unp2: { enemies: ["unprinter", "thread_serpent"] },
    serp: { enemies: ["thread_serpent", "spool_spider", "unprinter"] },
    warden: { enemies: ["loom_warden", "grey_chorister"] },
    chorus: { enemies: ["grey_chorister", "grey_chorister", "unprinter"] },
    boss7: { enemies: ["the_spindle"], flee: false, music: "boss" },
    ordeal: { enemies: ["grey_bishop_1"], flee: false, music: "final" },
    // Chapter 8
    sheep2: { enemies: ["null_sheep", "null_sheep"] },
    knight: { enemies: ["eraser_knight", "palette_wraith"] },
    wraith3: { enemies: ["palette_wraith", "null_sheep", "palette_wraith"] },
    mixed8: { enemies: ["eraser_knight", "null_sheep", "unprinter"] },
    final: { enemies: ["grey_bishop"], flee: false, music: "final" },
    final2: { enemies: ["bishop_loom"], flee: false, music: "final" }
  };

  // src/battle/units.ts
  function partyUnit(m2, mech) {
    const def = MEMBERS[m2.id];
    const f9 = fullStats(m2);
    const skills = ["attack", ...skillsAt(m2.id, m2.lvl).filter((s) => !(m2.lost ?? []).includes(s))];
    if (m2.id === "nil") {
      for (const e of m2.echo) if (!skills.includes(e)) skills.push(e);
    }
    if (m2.id === "wick" && mech.includes("tricolor")) skills.push("ninth_ink", "trichrome");
    if (mech.includes("link")) skills.push("link");
    return {
      uid: 0,
      side: 0,
      id: m2.id,
      name: def.name,
      spec: { ...def.sprite },
      lvl: m2.lvl,
      maxHp: f9.hp,
      hp: Math.min(m2.hp, f9.hp),
      maxInk: f9.ink,
      ink: Math.min(m2.ink, f9.ink),
      str: f9.str,
      def: f9.def,
      mnd: f9.mnd,
      spd: f9.spd,
      baseHues: memberHues(m2.id),
      skills,
      st: {},
      stg: { str: 0, def: 0, mnd: 0, spd: 0 },
      shell: 0,
      maxShell: 0,
      broken: false,
      next: 0,
      guard: false,
      alive: m2.hp > 0,
      gone: false,
      boss: false,
      mem: {},
      weaponHue: f9.hue,
      traits: new Set(f9.traits),
      tails: m2.tails,
      loaded: m2.id === "tint" ? "M" : "N",
      mark: m2.hp,
      turns: 0,
      xp: 0,
      gold: 0,
      drops: [],
      echo: [...m2.echo]
    };
  }
  function enemyUnit(id) {
    const e = ENEMIES[id];
    if (!e) throw new Error("Unknown enemy " + id);
    const hues = huesOf(e.pal);
    return {
      uid: 0,
      side: 1,
      id,
      name: e.name,
      spec: { ...e.sprite },
      lvl: e.lvl,
      maxHp: e.hp,
      hp: e.hp,
      maxInk: 999,
      ink: 999,
      str: e.str,
      def: e.def,
      mnd: e.mnd,
      spd: e.spd,
      baseHues: hues,
      skills: e.skills.map((s) => s[0]),
      st: {},
      stg: { str: 0, def: 0, mnd: 0, spd: 0 },
      shell: e.shell,
      maxShell: e.shell,
      broken: false,
      next: 0,
      guard: false,
      alive: true,
      gone: false,
      boss: !!e.boss,
      ai: e.ai,
      mem: {},
      weaponHue: "N",
      traits: /* @__PURE__ */ new Set(),
      tails: 0,
      loaded: hues[0],
      mark: e.hp,
      turns: 0,
      xp: e.xp,
      gold: e.gold,
      drops: e.drops ?? [],
      echo: []
    };
  }
  function writeBack(units, members) {
    for (const u of units) {
      if (u.side !== 0) continue;
      const m2 = members[u.id];
      if (!m2) continue;
      m2.hp = u.alive ? Math.max(1, u.hp) : 0;
      m2.ink = Math.max(0, u.ink);
      m2.tails = u.tails;
      if (u.id === "nil") m2.echo = [...u.echo];
    }
  }

  // src/battle/ai.ts
  var BOSS = {
    grey_moth: (b2, u) => {
      const t = u.turns;
      if (t % 4 === 3) return { t: "skill", skill: "gather_dust" };
      if (t % 4 === 1 && u.hp < u.maxHp * 0.6) return { t: "skill", skill: "moth_kiss" };
      return null;
    },
    octachrome: (b2, u) => {
      if (u.turns % 3 === 1) return { t: "skill", skill: "recolor_self" };
      return null;
    },
    cantor: (b2, u) => {
      if (u.turns % 5 === 4) return { t: "skill", skill: "crescendo" };
      const choir = b2.alive(1).filter((x) => x !== u);
      if (u.turns % 6 === 2 && choir.length < 2) return { t: "skill", skill: "call_choir" };
      return null;
    },
    chronophage: (b2, u) => {
      if (u.turns % 3 === 0) u.mem.hpBack = u.hp;
      if (u.turns % 6 === 5) return { t: "skill", skill: "coil" };
      if (u.turns % 6 === 2 && u.hp < +(u.mem.hpBack ?? 0) - u.maxHp * 0.1) return { t: "skill", skill: "loop_back" };
      return null;
    },
    baron: (b2, u) => {
      if (u.turns % 5 === 4) return { t: "skill", skill: "audit" };
      if (u.turns % 5 === 1 && b2.alive(1).length < 3) return { t: "skill", skill: "hire" };
      if (u.turns % 5 === 2 && b2.gold > 0) return { t: "skill", skill: "bribe" };
      return null;
    },
    seraph: (b2, u) => {
      if (u.turns % 4 === 3) return { t: "skill", skill: "target_lock" };
      return null;
    },
    spindle: (b2, u) => {
      if (u.turns % 4 === 3) return { t: "skill", skill: "wind_up" };
      return null;
    },
    bishop_ordeal: (b2, u) => {
      if (u.turns % 2 === 0) return { t: "skill", skill: "compress" };
      return null;
    },
    bishop: (b2, u) => {
      if (u.turns % 5 === 4) return { t: "skill", skill: "sermon" };
      if (u.turns % 3 === 1) return { t: "skill", skill: "compress" };
      return null;
    },
    bishop2: (b2, u) => {
      if (u.turns % 3 === 1) return { t: "skill", skill: "palette_swap" };
      if (u.turns % 6 === 5) return { t: "skill", skill: "sermon" };
      if (u.hp < u.maxHp * 0.3 && !u.mem.healed) {
        u.mem.healed = 1;
        return { t: "skill", skill: "benediction" };
      }
      return null;
    }
  };
  function enemyAction(b2, u) {
    if (u.mem.charged) {
      const s = String(u.mem.charged);
      delete u.mem.charged;
      delete u.st.charge;
      return { t: "skill", skill: s };
    }
    if (u.ai && BOSS[u.ai]) {
      const a = BOSS[u.ai](b2, u);
      if (a) return a;
    }
    const def = ENEMIES[u.id];
    const allies = b2.alive(1);
    const options = def.skills.filter(([id]) => {
      const s = SKILLS[id];
      if (!s) return false;
      if (s.kind === "heal" && s.target !== "self" && !allies.some((a) => a.hp < a.maxHp * 0.6)) return false;
      if (s.kind === "heal" && s.target === "self" && u.hp > u.maxHp * 0.6) return false;
      if (s.kind === "buff" && s.stage && u.stg[s.stage.stat] >= 2) return false;
      if (s.fx?.startsWith("summon:") && allies.length >= 4) return false;
      return true;
    });
    const pick = options.length ? b2.rng.weighted(options, (o) => o[1])[0] : "bite";
    return { t: "skill", skill: pick };
  }

  // src/scenes/battle.ts
  var MSG_Y = 77;
  var PARTY_Y = 91;
  var ROW_H = 15;
  var STATUS_COL = {
    static: "c3",
    stun: "y2",
    grey: "g2",
    hush: "b3",
    regen: "e3",
    taunt: "y3",
    mirror: "b3",
    primed: "o3",
    painted: "m3",
    charge: "r3"
  };
  var BattleScene = class {
    constructor(g, group, o, done) {
      __publicField(this, "g", g);
      __publicField(this, "o", o);
      __publicField(this, "done", done);
      __publicField(this, "b");
      __publicField(this, "mode", "intro");
      __publicField(this, "t", 0);
      __publicField(this, "modeT", 0);
      __publicField(this, "queue", []);
      __publicField(this, "evT", 0);
      __publicField(this, "cur", null);
      __publicField(this, "actor", null);
      __publicField(this, "banner", "");
      __publicField(this, "bannerHue");
      __publicField(this, "message", "");
      __publicField(this, "floaters", []);
      __publicField(this, "flashUid", 0);
      __publicField(this, "flashT", 0);
      __publicField(this, "lungeUid", 0);
      __publicField(this, "lungeT", 0);
      __publicField(this, "dying", /* @__PURE__ */ new Map());
      __publicField(this, "menu", new Menu([], 6));
      __publicField(this, "sub", new Menu([], 8));
      __publicField(this, "targetMenuIdx", 0);
      __publicField(this, "pending", null);
      __publicField(this, "targets", []);
      __publicField(this, "targetAll", false);
      __publicField(this, "victoryLines", []);
      __publicField(this, "reels", null);
      __publicField(this, "scanUid", 0);
      __publicField(this, "partyTurns", 0);
      __publicField(this, "result", null);
      __publicField(this, "bgPal");
      __publicField(this, "group");
      __publicField(this, "afterEvents", null);
      this.group = group;
      const st = g.st;
      const grp = GROUPS[group];
      if (!grp) throw new Error("Unknown group " + group);
      const party = st.party.map((id) => partyUnit(st.members[id], st.mech));
      const enemies = grp.enemies.map((id) => enemyUnit(id));
      const tile = g.world?.tile(st.x, st.y, st);
      this.b = new Battle({
        party,
        enemies,
        mech: new Set(st.mech),
        canFlee: grp.flee !== false,
        gold: st.gold,
        items: { ...st.items },
        makeEnemy: enemyUnit,
        greyField: !!tile?.greyzone
      });
      const theme = g.world?.def.theme ?? {};
      this.bgPal = theme.ground ?? BASE_THEME.ground;
      g.audio.play(o.music ?? grp.music ?? "battle");
      const names = enemies.map((e) => e.name);
      this.message = names.length === 1 ? `${names[0]} appears!` : `${names[0]} and ${names.length - 1 === 1 ? names[1] : "friends"} appear!`;
    }
    // ---------- Layout ----------
    enemyLayout() {
      const es = this.b.units.filter((u) => u.side === 1 && !u.gone && (u.alive || this.dying.has(u.uid)));
      const sizes = es.map((u) => (u.spec.n ?? 1) * 8 * scaleOf(u));
      const gap = 6;
      const total = sizes.reduce((a, s) => a + s, 0) + gap * Math.max(0, es.length - 1);
      let x = Math.round(80 - total / 2);
      const top = this.b.mech.has("tempo") ? 12 : 4;
      const out = /* @__PURE__ */ new Map();
      es.forEach((u, i) => {
        const s = sizes[i];
        out.set(u.uid, { x, y: Math.max(top + 6, 66 - s), s });
        x += s + gap;
      });
      return out;
    }
    // ---------- Flow ----------
    update() {
      this.t++;
      this.modeT++;
      if (this.flashT > 0) this.flashT--;
      if (this.lungeT > 0) this.lungeT--;
      for (const f9 of this.floaters) {
        f9.t--;
        f9.y -= 0.35;
      }
      this.floaters = this.floaters.filter((f9) => f9.t > 0);
      for (const [uid, t] of this.dying) {
        if (t <= 1) this.dying.delete(uid);
        else this.dying.set(uid, t - 1);
      }
      switch (this.mode) {
        case "intro":
          if (this.modeT > 40 || this.modeT > 10 && this.g.input.pressed("a")) this.setMode("next");
          break;
        case "next":
          this.nextTurn();
          break;
        case "events":
          this.playEvents();
          break;
        case "command":
          this.updateCommand();
          break;
        case "skill":
          this.updateSkill();
          break;
        case "item":
          this.updateItem();
          break;
        case "hue":
          this.updateHue();
          break;
        case "partner":
          this.updatePartner();
          break;
        case "target":
          this.updateTarget();
          break;
        case "victory":
          this.updateVictory();
          break;
        case "done":
          break;
      }
    }
    setMode(m2) {
      this.mode = m2;
      this.modeT = 0;
    }
    nextTurn() {
      if (this.b.result) {
        this.finish();
        return;
      }
      if (this.o.survive && this.partyTurns >= this.o.survive) {
        this.b.result = "win";
        this.finish();
        return;
      }
      const { u, ev, skip } = this.b.beginTurn();
      this.actor = u;
      this.queue.push(...ev);
      if (skip) {
        this.setMode("events");
        return;
      }
      if (u.side === 0) {
        this.partyTurns++;
        this.afterEvents = () => this.openCommand();
      } else {
        const a = enemyAction(this.b, u);
        this.lungeUid = u.uid;
        this.lungeT = 10;
        this.queue.push(...this.b.act(u, a));
      }
      this.setMode("events");
    }
    playEvents() {
      const fast = this.g.input.isDown("a") || this.g.input.isDown("b");
      if (this.cur) {
        this.evT -= fast ? 3 : 1;
        if (this.cur.k === "msg" && this.g.input.pressed("a")) this.evT = 0;
        if (this.evT > 0) return;
        this.cur = null;
      }
      const ev = this.queue.shift();
      if (!ev) {
        this.banner = "";
        const f9 = this.afterEvents;
        this.afterEvents = null;
        if (this.b.result) {
          this.finish();
          return;
        }
        if (f9) f9();
        else this.setMode("next");
        return;
      }
      this.cur = ev;
      this.evT = this.startEvent(ev);
    }
    pos(uid) {
      const u = this.b.byUid(uid);
      if (!u) return [80, 60];
      if (u.side === 1) {
        const l = this.enemyLayout().get(uid);
        return l ? [l.x + l.s / 2, l.y + 2] : [80, 40];
      }
      const i = this.b.party.indexOf(u);
      return [50, PARTY_Y + i * ROW_H + 2];
    }
    startEvent(ev) {
      const a = this.g.audio;
      switch (ev.k) {
        case "msg":
          this.message = ev.text;
          return 55;
        case "act": {
          const u = this.b.byUid(ev.uid);
          this.banner = `${u?.name ?? ""}: ${ev.name}`;
          this.bannerHue = ev.hue && ev.hue !== "N" ? ev.hue : void 0;
          a.sfx(ev.name === "Guard" ? "buff" : SKILLS_BY_NAME[ev.name]?.kind === "mag" ? "magic" : "ok");
          return 22;
        }
        case "dmg": {
          const u = this.b.byUid(ev.uid);
          const [x, y] = this.pos(ev.uid);
          const clash = (ev.mult ?? 1) > 1;
          const blend = (ev.mult ?? 1) < 1;
          this.floaters.push({ x, y, text: `${ev.n}${clash ? "!" : ""}`, col: clash ? "y3" : blend ? "g2" : ev.crit ? "r3" : "w", t: 40 });
          if (clash) this.floaters.push({ x, y: y - 7, text: "CLASH", col: HUE_LIGHT[ev.hue ?? "N"], t: 34 });
          if (blend) this.floaters.push({ x, y: y - 7, text: "blend", col: "g2", t: 30 });
          if (ev.crit) this.floaters.push({ x, y: y - 14, text: "CRIT", col: "r3", t: 30 });
          this.flashUid = ev.uid;
          this.flashT = 10;
          if (u?.side === 0) this.g.shakeT = 6;
          if (ev.crit) this.g.shakeT = 10;
          a.sfx(clash ? "clash" : blend ? "blend" : ev.crit ? "crit" : "hit");
          return 12;
        }
        case "heal": {
          const [x, y] = this.pos(ev.uid);
          if (ev.n > 0) this.floaters.push({ x, y, text: `+${ev.n}`, col: ev.ink ? "c3" : "e3", t: 36 });
          a.sfx("heal");
          return 10;
        }
        case "miss":
          return 10;
        case "die": {
          const u = this.b.byUid(ev.uid);
          if (u?.side === 1) this.dying.set(ev.uid, 28);
          this.message = u?.side === 1 ? `${u.name} fades.` : `${u?.name} falls.`;
          a.sfx("die");
          return 24;
        }
        case "revive": {
          const u = this.b.byUid(ev.uid);
          this.message = `${u?.name} is back on their feet.`;
          a.sfx("heal");
          return 20;
        }
        case "status": {
          const u = this.b.byUid(ev.uid);
          if (ev.on && u && ev.s !== "charge") {
            const [x, y] = this.pos(ev.uid);
            this.floaters.push({ x, y: y - 4, text: STATUS_NAME[ev.s] ?? ev.s, col: STATUS_COL[ev.s] ?? "w", t: 32 });
          }
          return ev.on ? 10 : 2;
        }
        case "stage": {
          const [x, y] = this.pos(ev.uid);
          this.floaters.push({ x, y: y - 4, text: `${ev.stat.toUpperCase()}${ev.d > 0 ? "+" : "-"}`, col: ev.d > 0 ? "e3" : "r3", t: 30 });
          a.sfx(ev.d > 0 ? "buff" : "debuff");
          return 10;
        }
        case "break": {
          const [x, y] = this.pos(ev.uid);
          this.floaters.push({ x, y: y - 10, text: "BREAK", col: "y3", t: 44 });
          this.g.shakeT = 12;
          a.sfx("break");
          return 24;
        }
        case "recover":
          return 10;
        case "hues":
          return 6;
        case "summon": {
          const u = this.b.byUid(ev.uid);
          this.message = `${u?.name} joins the fight!`;
          return 24;
        }
        case "leave": {
          this.dying.set(ev.uid, 20);
          return 20;
        }
        case "gold": {
          if (ev.n !== 0) this.floaters.push({ x: 140, y: 150, text: `${ev.n > 0 ? "+" : ""}${ev.n}g`, col: "y2", t: 36 });
          a.sfx("coin");
          return 8;
        }
        case "reels":
          this.reels = ev.hues;
          a.sfx("tick");
          return 50;
        case "scan":
          this.scanUid = ev.uid;
          return 100;
        case "push": {
          const [x, y] = this.pos(ev.uid);
          this.floaters.push({ x, y: y - 4, text: "LATER", col: "e3", t: 28 });
          return 8;
        }
        case "link":
          return 0;
        case "end":
          return 0;
      }
    }
    // ---------- Commands ----------
    openCommand() {
      const u = this.actor;
      const items = [
        { label: "Attack", id: "attack" },
        { label: "Skill", id: "skill", enabled: !u.st.hush },
        { label: "Item", id: "item", enabled: Object.entries(this.b.items).some(([id, n]) => n > 0 && ITEMS[id]?.battle) },
        { label: "Guard", id: "guard" }
      ];
      if (this.b.mech.has("link")) items.push({ label: "Link", id: "link", enabled: this.b.canUse(u, "link"), color: this.b.link >= 100 ? "y3" : void 0 });
      items.push({ label: "Flee", id: "flee", enabled: this.b.canFlee });
      this.menu = new Menu(items, items.length);
      this.message = `${u.name}'s turn.`;
      this.reels = null;
      this.scanUid = 0;
      this.setMode("command");
    }
    updateCommand() {
      const r = this.menu.update(this.g.input, this.g.audio);
      if (r !== "ok") return;
      const id = this.menu.cur.id;
      const u = this.actor;
      if (id === "attack") this.chooseTarget({ kind: "skill", id: "attack" });
      else if (id === "guard") this.commit({ t: "guard" });
      else if (id === "flee") this.commit({ t: "flee" });
      else if (id === "skill") this.openSkills();
      else if (id === "item") this.openItems();
      else if (id === "link") {
        this.pending = { kind: "skill", id: "link" };
        const others = this.b.alive(0).filter((x) => x !== u);
        this.sub = new Menu(others.map((x) => ({ label: x.name, id: String(x.uid) })), Math.max(1, others.length));
        this.setMode("partner");
      }
    }
    openSkills() {
      const u = this.actor;
      const items = u.skills.filter((s) => s !== "attack" && s !== "link").map((id) => {
        const sk = SKILLS[id];
        const c = this.b.skillCost(u, sk);
        const right = c.gold ? `${c.gold}g` : c.tails ? `${c.ink}+T` : c.ink ? `${c.ink}` : "";
        const hue = typeof sk.hue === "string" && sk.hue.length === 1 && sk.hue !== "N" ? sk.hue : sk.hue === "loaded" ? u.loaded : void 0;
        return { label: sk.name, right, enabled: this.b.canUse(u, id), id, desc: sk.desc || "Echoed from a foe.", hue };
      });
      if (!items.length) {
        this.g.audio.sfx("bump");
        return;
      }
      this.sub = new Menu(items, 8);
      this.setMode("skill");
    }
    updateSkill() {
      const r = this.sub.update(this.g.input, this.g.audio);
      this.message = this.sub.cur?.desc ?? "";
      if (r === "back") {
        this.openCommand();
        return;
      }
      if (r !== "ok") return;
      const id = this.sub.cur.id;
      const sk = SKILLS[id];
      if (sk.fx === "load" || sk.fx === "tricolor") {
        this.pending = { kind: "skill", id };
        this.sub = new Menu(WHEEL.map((h2) => ({ label: HUE_NAME[h2], hue: h2, id: h2 })), 6);
        this.setMode("hue");
        return;
      }
      this.chooseTarget({ kind: "skill", id });
    }
    openItems() {
      const items = Object.entries(this.b.items).filter(([id, n]) => n > 0 && ITEMS[id]?.battle).map(([id, n]) => ({ label: ITEMS[id].name, right: `x${n}`, id, desc: ITEMS[id].desc }));
      this.sub = new Menu(items, 8);
      this.setMode("item");
    }
    updateItem() {
      const r = this.sub.update(this.g.input, this.g.audio);
      this.message = this.sub.cur?.desc ?? "";
      if (r === "back") {
        this.openCommand();
        return;
      }
      if (r === "ok") this.chooseTarget({ kind: "item", id: this.sub.cur.id });
    }
    updateHue() {
      const r = this.sub.update(this.g.input, this.g.audio);
      const h2 = this.sub.cur?.id;
      const foe = this.b.alive(1)[0];
      this.message = foe ? `${HUE_NAME[h2]} against ${foe.name}: x${hueMult(h2, this.b.defHues(foe)).toFixed(2)}` : "";
      if (r === "back") {
        this.openSkills();
        return;
      }
      if (r === "ok" && this.pending) {
        this.pending.hue = h2;
        this.commit({ t: "skill", skill: this.pending.id, hue: h2 });
      }
    }
    updatePartner() {
      const r = this.sub.update(this.g.input, this.g.audio);
      this.message = "Choose a partner for the link.";
      if (r === "back") {
        this.openCommand();
        return;
      }
      if (r === "ok") this.commit({ t: "skill", skill: "link", partner: +this.sub.cur.id });
    }
    chooseTarget(p2) {
      const u = this.actor;
      this.pending = p2;
      let tgt;
      if (p2.kind === "skill") tgt = SKILLS[p2.id].target;
      else tgt = ITEMS[p2.id].use.target;
      this.targetAll = tgt === "foes" || tgt === "allies" || tgt === "rand";
      if (tgt === "self") {
        this.commit({ t: "skill", skill: p2.id, target: u.uid });
        return;
      }
      if (tgt === "foe" || tgt === "foes" || tgt === "rand") this.targets = this.b.alive(1);
      else if (tgt === "ko") this.targets = this.b.party.filter((x) => !x.alive);
      else this.targets = this.b.alive(0);
      if (!this.targets.length) {
        this.g.audio.sfx("bump");
        return;
      }
      this.targetMenuIdx = tgt === "ally" ? Math.max(0, this.targets.indexOf(u)) : 0;
      this.setMode("target");
    }
    updateTarget() {
      const inp = this.g.input;
      const a = this.g.audio;
      const n = this.targets.length;
      if (!this.targetAll) {
        const horiz = this.targets[0]?.side === 1;
        if (inp.repeat(horiz ? "right" : "down")) {
          this.targetMenuIdx = (this.targetMenuIdx + 1) % n;
          a.sfx("move");
        }
        if (inp.repeat(horiz ? "left" : "up")) {
          this.targetMenuIdx = (this.targetMenuIdx - 1 + n) % n;
          a.sfx("move");
        }
      }
      const t = this.targets[this.targetMenuIdx];
      this.message = this.targetInfo(t);
      if (inp.pressed("b")) {
        a.sfx("back");
        if (this.pending?.kind === "item") this.openItems();
        else if (this.pending?.id === "attack") this.openCommand();
        else this.openSkills();
        return;
      }
      if (inp.pressed("a")) {
        a.sfx("ok");
        const p2 = this.pending;
        if (p2.kind === "item") this.commit({ t: "item", item: p2.id, target: t.uid });
        else this.commit({ t: "skill", skill: p2.id, target: t.uid, hue: p2.hue });
      }
    }
    targetInfo(t) {
      if (this.targetAll) return this.targets[0]?.side === 1 ? "Every foe." : "Every ally.";
      if (t.side === 0) return `${t.name}  ${t.hp}/${t.maxHp}`;
      const p2 = this.pending;
      if (p2?.kind === "skill") {
        const sk = SKILLS[p2.id];
        if (sk.kind === "phys" || sk.kind === "mag") {
          const h2 = this.b.atkHue(this.actor, sk, t);
          const m2 = hueMult(h2, this.b.defHues(t));
          const tag = m2 > 1 ? `^yx${m2.toFixed(2)}^0` : m2 < 1 ? `^nx${m2.toFixed(2)}^0` : "";
          return `${t.name} ${tag}`;
        }
      }
      return t.name;
    }
    commit(a) {
      const u = this.actor;
      this.queue.push(...this.b.act(u, a));
      this.message = "";
      this.setMode("events");
    }
    // ---------- End ----------
    finish() {
      if (this.mode === "victory" || this.mode === "done") return;
      const st = this.g.st;
      const r = this.b.result ?? "win";
      this.result = r;
      writeBack(this.b.units, st.members);
      st.gold = Math.max(0, this.b.gold);
      st.items = Object.fromEntries(Object.entries(this.b.items).filter(([, n]) => n > 0));
      st.log.push({ ch: st.chapter, group: this.group, result: r, turns: this.b.turn, minFrac: +this.b.stats.minPartyFrac.toFixed(2), lvl: st.members[st.party[0]]?.lvl ?? 1 });
      if (st.log.length > 400) st.log.shift();
      if (r === "win") {
        const rw = this.b.rewards();
        const goldMul = this.b.party.some((p2) => p2.traits.has("gold")) ? 1.25 : 1;
        const gold = Math.round(rw.gold * goldMul);
        st.gold += gold;
        const lines = [];
        if (rw.xp || gold) lines.push(`Victory! ${rw.xp} XP and ${gold} gold.`);
        else lines.push("It is over.");
        for (const d of rw.drops) {
          addItem(st, d);
          lines.push(`Found ${ITEMS[d]?.name ?? d}.`);
        }
        for (const m2 of this.g.st.party.concat(this.g.st.reserve)) if (st.members[m2].hp <= 0 && !this.o.canLose) st.members[m2].hp = 1;
        const ups = grantXp(st, rw.xp);
        lines.push(...ups);
        this.victoryLines = lines;
        if (!this.o.survive) this.g.audio.play("victory");
        if (ups.length) this.g.audio.sfx("lvl");
        this.setMode("victory");
      } else {
        this.setMode("done");
        this.close(r);
      }
    }
    updateVictory() {
      if (this.modeT < 20) return;
      if (this.g.input.pressed("a") || this.g.input.pressed("b")) {
        this.victoryLines.shift();
        if (!this.victoryLines.length) this.close("win");
        else this.modeT = 10;
      }
    }
    close(r) {
      this.mode = "done";
      this.g.pop(this);
      this.done(r);
    }
    // ---------- Drawing ----------
    draw(g) {
      g.clear("k");
      const b2 = this.b;
      const floorY = 66;
      const bg = this.bgPal;
      const def = this.g.world?.def;
      const theme = def?.theme ?? {};
      const backKind = def?.bg ?? "tree";
      const backPal = theme[backKind] ?? BASE_THEME[backKind] ?? BASE_THEME.tree;
      for (let i = 0; i < 40; i++) {
        const sx = (i * 73 + 11) % 160, sy = 12 + i * 37 % 36;
        if ((i + Math.floor(this.t / 40)) % 7 !== 0) g.rect(sx, sy, 1, 1, i % 3 ? "g1" : "g2");
      }
      for (let x = 0; x < 160; x += 8) {
        g.sprite({ g: "tile", pal: backPal, o: { kind: backKind, v: x / 8 % 4 } }, x, floorY - 8, { frame: Math.floor(this.t / 20) % 8 });
        g.sprite({ g: "tile", pal: bg, o: { kind: "ground", v: x / 8 % 4 } }, x, floorY, {});
        g.sprite({ g: "tile", pal: bg, o: { kind: "ground", v: (x / 8 + 2) % 4 } }, x, floorY + 8, {});
      }
      g.alpha(0.5, () => g.rect(0, floorY - 8, 160, 8, "k"));
      g.alpha(0.35, () => g.rect(0, floorY, 160, 2, "k"));
      if (b2.mech.has("tempo")) this.drawTimeline(g);
      this.drawEnemies(g);
      this.drawMessage(g);
      this.drawParty(g);
      if (this.mode === "command") this.menu.draw(g, 104, PARTY_Y, 56, this.t);
      if (this.mode === "skill" || this.mode === "item" || this.mode === "hue" || this.mode === "partner") this.sub.draw(g, 0, PARTY_Y, 160, this.t);
      if (this.reels && this.cur?.k === "reels") this.drawReels(g);
      if (this.scanUid && this.cur?.k === "scan") this.drawScan(g);
      for (const f9 of this.floaters) {
        const w = textW(f9.text);
        g.text(f9.text, Math.round(f9.x - w / 2) + 1, Math.round(f9.y) + 1, "k");
        g.text(f9.text, Math.round(f9.x - w / 2), Math.round(f9.y), f9.col);
      }
      if (this.mode === "intro") this.drawIntro(g);
      if (this.mode === "victory") this.drawVictory(g);
    }
    drawIntro(g) {
      const p2 = 1 - this.modeT / 24;
      if (p2 <= 0) return;
      for (let y = 0; y < 160; y += 8) for (let x = 0; x < 160; x += 8) {
        const d = (x + y) / 320;
        if (d < p2) g.rect(x, y, 8, 8, "k");
      }
    }
    drawTimeline(g) {
      const order = this.b.forecast(9);
      g.rect(0, 0, 160, 10, "ink");
      g.text("NEXT", 2, 2, "g2");
      order.forEach((u, i) => {
        const x = 22 + i * 15;
        if (i === 0) g.rectO(x - 2, 0, 12, 10, "w");
        g.sprite({ ...u.spec, pal: this.b.displayPal(u) }, x, 1, { grey: false });
        g.rect(x, 9, 8, 1, u.side === 0 ? "c2" : "r2");
      });
    }
    drawEnemies(g) {
      const b2 = this.b;
      const lay = this.enemyLayout();
      for (const u of b2.units) {
        if (u.side !== 1) continue;
        const l = lay.get(u.uid);
        if (!l) continue;
        const scale = scaleOf(u);
        const bob = u.alive ? Math.round(Math.sin((this.t + u.uid * 20) / 18)) : 0;
        let y = l.y + bob;
        if (this.lungeUid === u.uid && this.lungeT > 0) y += this.lungeT > 5 ? 10 - this.lungeT : this.lungeT;
        const spec = { ...u.spec, pal: b2.displayPal(u) };
        const dissolve = this.dying.has(u.uid) ? 1 - this.dying.get(u.uid) / 28 : 0;
        if (!u.alive && !this.dying.has(u.uid)) continue;
        const flash = this.flashUid === u.uid && this.flashT > 0 && Math.floor(this.flashT / 2) % 2 === 0;
        g.sprite(spec, l.x, y, { scale, flash: flash ? "w" : void 0, dissolve: dissolve > 0 ? dissolve : void 0, seed: u.uid, grey: false });
        if (!u.alive) continue;
        const bw = l.s;
        g.bar(l.x, l.y + l.s + 2, bw, 2, u.hp / u.maxHp, u.hp / u.maxHp < 0.3 ? "r2" : "e2", "ink");
        if (b2.mech.has("break") && u.maxShell > 0) {
          if (u.broken) g.text("BRK", l.x + bw / 2 - 5, l.y - 7, "y3");
          else for (let i = 0; i < u.maxShell; i++) g.rect(l.x + i * 3, l.y - 4, 2, 2, i < u.shell ? "w" : "g1");
        }
        let sx = l.x;
        for (const s of Object.keys(u.st)) {
          g.rect(sx, l.y + l.s + 5, 2, 2, STATUS_COL[s] ?? "w");
          sx += 3;
        }
        if (this.mode === "target" && (this.targetAll ? this.targets.includes(u) : this.targets[this.targetMenuIdx] === u)) {
          if (Math.floor(this.t / 8) % 2 === 0) {
            const cx = l.x + l.s / 2;
            g.rect(cx - 2, l.y - 10, 5, 1, "w");
            g.rect(cx - 1, l.y - 9, 3, 1, "w");
            g.rect(cx, l.y - 8, 1, 1, "w");
          }
          hueChips(g, b2.defHues(u), l.x, l.y + l.s + 5);
        }
        if (this.actor === u && this.mode === "events") g.rect(l.x + l.s / 2 - 1, l.y - 3, 3, 1, "r3");
      }
    }
    drawMessage(g) {
      g.box(0, MSG_Y, 160, 12);
      if (this.banner && this.mode === "events") {
        if (this.bannerHue) g.rect(4, MSG_Y + 4, 3, 3, HUE_COLOR[this.bannerHue]);
        g.text(this.banner, this.bannerHue ? 10 : 5, MSG_Y + 3, "y3");
      } else {
        const line = wrap(this.message, 150)[0] ?? "";
        g.text(line, 5, MSG_Y + 3, "w");
      }
    }
    drawParty(g) {
      const b2 = this.b;
      g.box(0, PARTY_Y - 1, 160, 69);
      b2.party.forEach((u, i) => {
        const y = PARTY_Y + i * ROW_H;
        const active = this.actor === u && (this.mode === "command" || this.mode === "target" || this.mode === "skill");
        if (active) g.rect(1, y, 158, ROW_H - 1, "ink");
        if (this.mode === "target" && !this.targets[0]?.side && (this.targetAll ? this.targets.includes(u) : this.targets[this.targetMenuIdx] === u)) {
          if (Math.floor(this.t / 8) % 2 === 0) g.cursor(2, y + 4, 0);
        }
        const flash = this.flashUid === u.uid && this.flashT > 0 && Math.floor(this.flashT / 2) % 2 === 0;
        const spec = { ...u.spec, pal: b2.displayPal(u) };
        g.sprite(spec, 8, y + 3, { grey: !u.alive, flash: flash ? "r2" : void 0 });
        g.text(u.name, 19, y + 2, u.alive ? "w" : "g1");
        const hpCol = !u.alive ? "g1" : u.hp / u.maxHp < 0.25 ? "r3" : u.hp / u.maxHp < 0.5 ? "y2" : "w";
        g.textR(`${u.hp}`, 76, y + 2, hpCol);
        g.text(`/${u.maxHp}`, 77, y + 2, "g1");
        g.bar(19, y + 9, 80, 2, u.hp / u.maxHp, u.hp / u.maxHp < 0.25 ? "r2" : "e2");
        g.bar(19, y + 12, 80 * Math.min(1, u.maxInk / 60), 1, u.ink / Math.max(1, u.maxInk), "c2");
        if (this.mode !== "command") {
          if (u.maxInk > 0 && u.id !== "vend") g.text(`^c${u.ink}^0 ink`, 104, y + 2, "g2");
          if (u.id === "nona") g.text(`${u.tails}T`, 140, y + 2, "w");
          if (u.id === "tint") {
            g.rect(140, y + 3, 5, 4, HUE_COLOR[u.loaded]);
          }
          let sx = 104;
          for (const s of Object.keys(u.st)) {
            g.text(STATUS_NAME[s]?.[0] ?? "?", sx, y + 8, STATUS_COL[s] ?? "w");
            sx += 5;
          }
          if (u.guard) g.text("G", sx, y + 8, "b3");
        }
      });
      const bottom = PARTY_Y + 4 * ROW_H;
      if (b2.mech.has("link")) {
        g.text("LINK", 4, bottom, b2.link >= 100 ? "y3" : "g2");
        g.bar(24, bottom + 2, 60, 2, b2.link / 100, b2.link >= 100 ? "y2" : "m2");
      }
      if (b2.party.some((p2) => p2.id === "vend")) g.textR(`${b2.gold}g`, 156, bottom, "y2");
    }
    drawReels(g) {
      g.box(50, 30, 60, 22);
      this.reels.forEach((h2, i) => {
        const show = this.evT < 40 - i * 10 ? h2 : WHEEL[(Math.floor(this.t / 3) + i) % 6];
        g.rect(56 + i * 17, 35, 12, 12, HUE_COLOR[show]);
      });
    }
    drawScan(g) {
      const u = this.b.byUid(this.scanUid);
      if (!u) return;
      const d = ENEMIES[u.id];
      const lines = [`${u.name}  Lv${u.lvl}`, `HP ${u.hp}/${u.maxHp}`, ...wrap(d?.desc ?? "", 140)];
      const hues = this.b.defHues(u);
      const weak = WHEEL.filter((h2) => hueMult(h2, hues) > 1).map((h2) => HUE_NAME[h2]);
      lines.push(weak.length ? `Weak to ${weak.join(", ")}.` : "No weakness.");
      g.box(6, 8, 148, lines.length * LINE_H + 6);
      lines.forEach((l, i) => g.text(l, 10, 11 + i * LINE_H, i === 0 ? "y3" : "w"));
    }
    drawVictory(g) {
      const line = this.victoryLines[0];
      if (!line) return;
      const lines = wrap(line, 140);
      g.box(6, 30, 148, lines.length * LINE_H + 8);
      lines.forEach((l, i) => g.text(l, 11, 34 + i * LINE_H, "w"));
    }
  };
  var HUE_LIGHT = { R: "r3", Y: "y3", G: "e3", C: "c3", B: "b3", M: "m3", N: "g3" };
  var SKILLS_BY_NAME = Object.fromEntries(Object.values(SKILLS).map((s) => [s.name, s]));
  function scaleOf(u) {
    return (u.spec.n ?? 1) >= 3 ? 2 : 3;
  }

  // src/data/shops.ts
  var SHOPS = {
    edgewick: { name: "Edgewick Stores", chapter: 1, items: ["tallow", "pin", "ink_vial", "pole1", "wool_scarf"] },
    fizz: { name: "Frog Radio Trading Post", chapter: 2, items: ["tallow", "ink_vial", "pin", "relight", "prism", "pole2", "claw1", "claw2", "brush1", "blue_wick", "mothball"] },
    prismouth: { name: "Prismouth Paints", chapter: 2, items: ["tallow", "candle", "ink_vial", "relight", "prism", "brush2", "violet_bristle", "claw2", "pole2", "lucky_button", "ink_ring"] },
    carillon: { name: "Reliquary Shop", chapter: 3, items: ["candle", "ink_vial", "relight", "pin", "prism", "pole3", "claw3", "brush3", "blade2", "blade3", "red_hook", "cyan_edge", "hue_lens", "grey_ward"] },
    hourglass: { name: "Sand Merchant", chapter: 4, items: ["candle", "ink_vial", "ink_well", "relight", "clock_tea", "paint_bomb", "pole4", "claw4", "brush4", "blade4", "hand3", "hand4", "green_hour", "shell_pick", "metronome"] },
    undermarket: { name: "The Undermarket", chapter: 5, items: ["candle", "honey", "ink_well", "relight", "chorus", "paint_bomb", "clock_tea", "pole5", "claw5", "brush5", "blade5", "hand5", "slot4", "slot5", "amber_slot", "piggy", "feather", "iron_rind"] },
    tether: { name: "Sky Chandler", chapter: 6, items: ["honey", "ink_well", "relight", "chorus", "paint_bomb", "pole5", "claw5", "brush5", "blade5", "hand5", "slot5", "glass4", "glass5", "red_pane", "spool_charm", "iron_rind"] },
    loom: { name: "Spare Parts Bin", chapter: 7, items: ["honey", "ink_well", "relight", "chorus", "pole6", "claw6", "brush6", "blade6", "hand6", "slot6", "glass6", "none5", "none6", "green_mask"] },
    grey: { name: "Last Stall", chapter: 8, items: ["honey", "ink_well", "relight", "chorus", "paint_bomb", "pole6", "claw6", "brush6", "blade6", "hand6", "slot6", "glass6", "none6", "grey_ward"] }
  };

  // src/scenes/shop.ts
  var ShopScene = class {
    constructor(g, id, done) {
      __publicField(this, "g", g);
      __publicField(this, "id", id);
      __publicField(this, "done", done);
      __publicField(this, "mode", "top");
      __publicField(this, "top", new Menu([{ label: "Buy", id: "buy" }, { label: "Sell", id: "sell" }, { label: "Leave", id: "leave" }], 3));
      __publicField(this, "list", new Menu([], 10));
      __publicField(this, "t", 0);
      __publicField(this, "note", "");
      __publicField(this, "noteT", 0);
      __publicField(this, "markup");
      __publicField(this, "stock");
      __publicField(this, "name");
      if (id === "vend") {
        const ch = g.st.chapter;
        const best = Object.values(SHOPS).filter((s) => s.chapter <= ch && s.chapter > 0).sort((a, b2) => b2.chapter - a.chapter)[0];
        this.stock = (best?.items ?? ["tallow"]).filter((i) => ITEMS[i]?.use);
        this.markup = 1.25;
        this.name = "VEND";
      } else {
        const s = SHOPS[id];
        this.stock = s.items;
        this.markup = 1;
        this.name = s.name;
      }
    }
    price(id) {
      return Math.round(ITEMS[id].price * this.markup);
    }
    openBuy() {
      this.list = new Menu(this.stock.map((id) => ({
        label: ITEMS[id].name,
        right: `${this.price(id)}`,
        id,
        desc: ITEMS[id].desc,
        enabled: this.g.st.gold >= this.price(id)
      })), 10);
      this.mode = "buy";
    }
    openSell() {
      const st = this.g.st;
      const items = Object.entries(st.items).filter(([id, n]) => n > 0 && !ITEMS[id]?.key && ITEMS[id]?.price > 0);
      this.list = new Menu(items.map(([id, n]) => ({ label: ITEMS[id].name, right: `${Math.floor(ITEMS[id].price / 2)}`, id, desc: `You have ${n}.` })), 10);
      this.mode = "sell";
    }
    update() {
      this.t++;
      if (this.noteT > 0) this.noteT--;
      const inp = this.g.input, au = this.g.audio, st = this.g.st;
      if (this.mode === "top") {
        const r2 = this.top.update(inp, au);
        if (r2 === "back" || r2 === "ok" && this.top.cur.id === "leave") {
          this.g.pop(this);
          this.done();
          return;
        }
        if (r2 === "ok") {
          if (this.top.cur.id === "buy") this.openBuy();
          else this.openSell();
        }
        return;
      }
      const r = this.list.update(inp, au);
      if (r === "back") {
        this.mode = "top";
        return;
      }
      if (r !== "ok") return;
      const id = this.list.cur.id;
      if (this.mode === "buy") {
        const p2 = this.price(id);
        if (st.gold < p2) return;
        st.gold -= p2;
        addItem(st, id);
        au.sfx("coin");
        this.note = `Bought ${ITEMS[id].name}.`;
        this.noteT = 60;
        const idx = this.list.idx;
        this.openBuy();
        this.list.idx = idx;
      } else {
        st.gold += Math.floor(ITEMS[id].price / 2);
        addItem(st, id, -1);
        au.sfx("coin");
        const idx = this.list.idx;
        this.openSell();
        this.list.idx = Math.min(idx, Math.max(0, this.list.items.length - 1));
      }
    }
    draw(g) {
      const st = this.g.st;
      g.clear("k");
      g.box(0, 0, 160, 12);
      g.text(this.name, 5, 3, "y3");
      g.textR(`${st.gold}g`, 155, 3, "y2");
      if (this.mode === "top") {
        this.top.draw(g, 50, 40, 60, this.t);
        return;
      }
      this.list.draw(g, 0, 14, 160, this.t);
      const cur = this.list.cur;
      g.box(0, 94, 160, 66);
      if (!cur) {
        g.text("Nothing here.", 5, 98, "g2");
        return;
      }
      const it = ITEMS[cur.id];
      wrap(cur.desc ?? "", 150).slice(0, 2).forEach((l, i) => g.text(l, 5, 98 + i * LINE_H));
      g.text(`Owned: ${st.items[it.id] ?? 0}`, 5, 114, "g2");
      if (it.equip) {
        const all = [...st.party, ...st.reserve];
        let i = 0;
        for (const mid of all) {
          const m2 = st.members[mid];
          const def = MEMBERS[mid];
          if (it.equip.slot === "weapon" && it.equip.type !== def.weapon) continue;
          const cur2 = fullStats(m2);
          const trial = fullStats({ ...m2, [it.equip.slot]: it.id });
          const stat = trial.str - cur2.str + (trial.mnd - cur2.mnd) + (trial.def - cur2.def) + (trial.spd - cur2.spd);
          const col = stat > 0 ? "e3" : stat < 0 ? "r3" : "g2";
          g.text(`${def.name} ${stat > 0 ? "+" : ""}${stat}`, 5 + (i >= 4 ? 78 : 0), 122 + i % 4 * LINE_H, col);
          i++;
        }
      }
      if (this.noteT > 0) g.textR(this.note, 155, 114, "e3");
    }
  };

  // src/scenes/menu.ts
  var MenuScene = class {
    constructor(g) {
      __publicField(this, "g", g);
      __publicField(this, "overlay", true);
      __publicField(this, "mode", "main");
      __publicField(this, "main");
      __publicField(this, "list", new Menu([], 9));
      __publicField(this, "who", new Menu([], 4));
      __publicField(this, "t", 0);
      __publicField(this, "msg", "");
      __publicField(this, "back", "main");
      __publicField(this, "memberId", "");
      __publicField(this, "slot", "weapon");
      __publicField(this, "pickId", "");
      __publicField(this, "swapFrom", -1);
      const items = [
        { label: "Items", id: "items" },
        { label: "Skills", id: "skills" },
        { label: "Equip", id: "equip" },
        { label: "Party", id: "party" },
        { label: "Journal", id: "journal" },
        { label: "Hues", id: "hues", enabled: g.st.mech.includes("hues") }
      ];
      if (g.st.party.includes("vend") || g.st.reserve.includes("vend")) items.push({ label: "Vend", id: "vend" });
      items.push({ label: "Save", id: "save" }, { label: "Close", id: "close" });
      this.main = new Menu(items, items.length);
    }
    get st() {
      return this.g.st;
    }
    get all() {
      return [...this.st.party, ...this.st.reserve];
    }
    whoMenu() {
      this.who = new Menu(this.all.map((id) => ({ label: MEMBERS[id].name, id })), Math.min(8, this.all.length));
    }
    say(text, back) {
      this.msg = text;
      this.back = back;
      this.mode = "msg";
    }
    update() {
      this.t++;
      const inp = this.g.input, au = this.g.audio;
      switch (this.mode) {
        case "main": {
          const r = this.main.update(inp, au);
          if (r === "back") {
            this.g.pop(this);
            return;
          }
          if (r !== "ok") return;
          const id = this.main.cur.id;
          if (id === "close") this.g.pop(this);
          else if (id === "items") this.openItems();
          else if (id === "skills") {
            this.whoMenu();
            this.mode = "skillWho";
          } else if (id === "equip") {
            this.whoMenu();
            this.mode = "equipWho";
          } else if (id === "party") {
            this.whoMenu();
            this.mode = "party";
          } else if (id === "journal") this.mode = "journal";
          else if (id === "hues") this.mode = "hues";
          else if (id === "vend") this.g.push(new ShopScene(this.g, "vend", () => {
          }));
          else if (id === "save") this.say(save(this.st) ? "Saved." : "Saving failed in this browser.", "main");
          return;
        }
        case "msg":
          if (inp.pressed("a") || inp.pressed("b")) {
            au.sfx("ok");
            this.mode = this.back;
          }
          return;
        case "journal":
        case "hues":
          if (inp.pressed("a") || inp.pressed("b")) {
            au.sfx("back");
            this.mode = "main";
          }
          return;
        case "items": {
          const r = this.list.update(inp, au);
          if (r === "back") {
            this.mode = "main";
            return;
          }
          if (r === "ok") {
            const it = ITEMS[this.list.cur.id];
            if (!it.use || !it.field) {
              this.say(it.desc, "items");
              return;
            }
            this.pickId = it.id;
            this.whoMenu();
            this.mode = "itemTarget";
          }
          return;
        }
        case "itemTarget": {
          const r = this.who.update(inp, au);
          if (r === "back") {
            this.mode = "items";
            return;
          }
          if (r === "ok") {
            const m2 = this.st.members[this.who.cur.id];
            const res = this.useItem(ITEMS[this.pickId], m2);
            this.openItems();
            this.say(res, "items");
          }
          return;
        }
        case "skillWho": {
          const r = this.who.update(inp, au);
          if (r === "back") {
            this.mode = "main";
            return;
          }
          if (r === "ok") {
            this.memberId = this.who.cur.id;
            this.openSkills();
          }
          return;
        }
        case "skills": {
          const r = this.list.update(inp, au);
          if (r === "back") {
            this.whoMenu();
            this.mode = "skillWho";
            return;
          }
          if (r === "ok") {
            const sk = SKILLS[this.list.cur.id];
            if (!sk.field) {
              this.say(sk.desc, "skills");
              return;
            }
            this.pickId = sk.id;
            this.whoMenu();
            this.mode = "skillTarget";
          }
          return;
        }
        case "skillTarget": {
          const r = this.who.update(inp, au);
          if (r === "back") {
            this.openSkills();
            return;
          }
          if (r === "ok") {
            const res = this.castField(this.pickId, this.st.members[this.memberId], this.st.members[this.who.cur.id]);
            this.openSkills();
            this.say(res, "skills");
          }
          return;
        }
        case "equipWho": {
          const r = this.who.update(inp, au);
          if (r === "back") {
            this.mode = "main";
            return;
          }
          if (r === "ok") {
            this.memberId = this.who.cur.id;
            this.list = new Menu([{ label: "Weapon", id: "weapon" }, { label: "Charm", id: "charm" }], 2);
            this.mode = "equipSlot";
          }
          return;
        }
        case "equipSlot": {
          const r = this.list.update(inp, au);
          if (r === "back") {
            this.whoMenu();
            this.mode = "equipWho";
            return;
          }
          if (r === "ok") {
            this.slot = this.list.cur.id;
            this.openEquip();
          }
          return;
        }
        case "equipPick": {
          const r = this.list.update(inp, au);
          if (r === "back") {
            this.list = new Menu([{ label: "Weapon", id: "weapon" }, { label: "Charm", id: "charm" }], 2);
            this.mode = "equipSlot";
            return;
          }
          if (r === "ok") {
            const m2 = this.st.members[this.memberId];
            const id = this.list.cur.id;
            const old = m2[this.slot];
            if (id === "") {
              if (old) addItem(this.st, old);
              m2[this.slot] = "";
            } else {
              addItem(this.st, id, -1);
              if (old) addItem(this.st, old);
              m2[this.slot] = id;
            }
            const f9 = fullStats(m2);
            m2.hp = Math.min(m2.hp, f9.hp);
            m2.ink = Math.min(m2.ink, f9.ink);
            this.openEquip();
          }
          return;
        }
        case "party": {
          const r = this.who.update(inp, au);
          if (r === "back") {
            this.mode = "main";
            return;
          }
          if (r === "ok" && this.all.length > 1) {
            this.swapFrom = this.who.idx;
            this.mode = "swap";
          }
          return;
        }
        case "swap": {
          const r = this.who.update(inp, au);
          if (r === "back") {
            this.mode = "party";
            return;
          }
          if (r === "ok") {
            const order = this.all;
            const a = this.swapFrom, b2 = this.who.idx;
            [order[a], order[b2]] = [order[b2], order[a]];
            const n = Math.min(4, this.st.party.length);
            this.st.party = order.slice(0, n);
            this.st.reserve = order.slice(n);
            if (!this.st.party.some((id) => this.st.members[id].hp > 0)) {
              [order[a], order[b2]] = [order[b2], order[a]];
              this.st.party = order.slice(0, n);
              this.st.reserve = order.slice(n);
            }
            this.whoMenu();
            this.who.idx = b2;
            this.mode = "party";
          }
          return;
        }
      }
    }
    openItems() {
      const entries = Object.entries(this.st.items).filter(([, n]) => n > 0);
      const order = (it) => it.key ? 2 : it.equip ? 1 : 0;
      entries.sort((a, b2) => order(ITEMS[a[0]]) - order(ITEMS[b2[0]]));
      this.list = new Menu(entries.map(([id, n]) => {
        const it = ITEMS[id];
        return { label: it?.name ?? id, right: it?.key ? "" : `x${n}`, id, desc: it?.desc, color: it?.key ? "y3" : it?.equip ? "b3" : void 0 };
      }), 9);
      this.mode = "items";
    }
    openSkills() {
      const m2 = this.st.members[this.memberId];
      const ids = [...skillsAt(m2.id, m2.lvl).filter((s) => !(m2.lost ?? []).includes(s)), ...m2.id === "nil" ? m2.echo : []];
      this.list = new Menu(ids.map((id) => ({ label: SKILLS[id].name, right: SKILLS[id].ink ? `${SKILLS[id].ink}` : "", id, desc: SKILLS[id].desc || "Echoed from a foe.", color: SKILLS[id].field ? "e3" : void 0 })), 9);
      this.mode = "skills";
    }
    openEquip() {
      const m2 = this.st.members[this.memberId];
      const type = MEMBERS[m2.id].weapon;
      const opts = [{ label: "(nothing)", id: "" }];
      for (const [id, n] of Object.entries(this.st.items)) {
        const e = ITEMS[id]?.equip;
        if (!e || n <= 0 || e.slot !== this.slot) continue;
        if (e.slot === "weapon" && e.type !== type) continue;
        opts.push({ label: ITEMS[id].name, right: `x${n}`, id, desc: ITEMS[id].desc });
      }
      this.list = new Menu(opts, 7);
      this.mode = "equipPick";
    }
    useItem(it, m2) {
      const u = it.use;
      const f9 = fullStats(m2);
      if (u.revive) {
        if (m2.hp > 0) return `${MEMBERS[m2.id].name} is fine.`;
        m2.hp = Math.round(f9.hp * u.revive);
      } else if (m2.hp <= 0) return `${MEMBERS[m2.id].name} needs reviving first.`;
      if (u.target === "allies" && u.heal) {
        for (const id of this.all) {
          const mm = this.st.members[id];
          if (mm.hp > 0) mm.hp = Math.min(fullStats(mm).hp, mm.hp + u.heal);
        }
      } else if (u.heal) m2.hp = Math.min(f9.hp, m2.hp + u.heal);
      if (u.ink) m2.ink = Math.min(f9.ink, m2.ink + u.ink);
      addItem(this.st, it.id, -1);
      this.g.audio.sfx("heal");
      return `Used ${it.name}.`;
    }
    castField(id, caster, target) {
      const sk = SKILLS[id];
      const cf = fullStats(caster);
      const tf = fullStats(target);
      if ((sk.ink ?? 0) > caster.ink) return "Not enough ink.";
      if ((sk.tails ?? 0) > caster.tails) return "No tails left.";
      if (sk.fx === "revive") {
        if (target.hp > 0) return "They are not down.";
        target.hp = Math.round(tf.hp * (sk.power ?? 0.5));
      } else {
        if (target.hp <= 0) return "They need reviving first.";
        const amt = Math.round(cf.mnd * (sk.power ?? 1) + 2);
        if (sk.target === "allies") for (const mid of this.all) {
          const mm = this.st.members[mid];
          if (mm.hp > 0) mm.hp = Math.min(fullStats(mm).hp, mm.hp + amt);
        }
        else target.hp = Math.min(tf.hp, target.hp + amt);
      }
      caster.ink -= sk.ink ?? 0;
      caster.tails -= sk.tails ?? 0;
      this.g.audio.sfx("heal");
      return `${MEMBERS[caster.id].name} casts ${sk.name}.`;
    }
    draw(g) {
      g.box(0, 0, 160, 160);
      this.drawParty(g);
      const mx = 108;
      this.main.draw(g, mx, 2, 50, this.t, this.mode === "main");
      g.text(`${this.st.gold}g`, mx + 4, this.main.rows * LINE_H + 12, "y2");
      const mins = Math.floor(this.st.frames / 3600);
      g.text(`${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`, mx + 4, this.main.rows * LINE_H + 20, "g2");
      switch (this.mode) {
        case "items":
        case "skills":
        case "equipSlot":
        case "equipPick":
          this.list.draw(g, 2, 2, 104, this.t, true);
          this.drawDesc(g, this.list.cur?.desc ?? "");
          if (this.mode === "equipPick" || this.mode === "equipSlot") this.drawEquipInfo(g);
          break;
        case "itemTarget":
        case "skillTarget":
        case "skillWho":
        case "equipWho":
          this.who.draw(g, 2, 2, 60, this.t, true);
          break;
        case "party":
        case "swap":
          this.drawDetail(g, this.all[this.who.idx]);
          this.who.draw(g, 2, 2, 50, this.t, true);
          if (this.mode === "swap") g.text("Swap with?", 4, 150, "y3");
          else g.text("Z: change order", 4, 150, "g2");
          break;
        case "journal":
          this.drawJournal(g);
          break;
        case "hues":
          this.drawHues(g);
          break;
        case "msg":
          g.box(10, 64, 140, 20);
          g.textC(wrap(this.msg, 130)[0] ?? "", 80, 71, "w");
          break;
      }
    }
    drawParty(g) {
      this.all.forEach((id, i) => {
        const m2 = this.st.members[id];
        const f9 = fullStats(m2);
        const y = 4 + i * 19;
        if (y > 150) return;
        const reserve = i >= this.st.party.length;
        g.sprite(MEMBERS[id].sprite, 4, y + 2, { grey: m2.hp <= 0 });
        g.text(MEMBERS[id].name, 16, y, reserve ? "g2" : "w");
        g.text(`Lv${m2.lvl}`, 48, y, "g2");
        g.text(`${m2.hp}/${f9.hp}`, 16, y + 7, m2.hp <= 0 ? "r3" : "w");
        g.text(`^c${m2.ink}^0/${f9.ink}`, 60, y + 7, "g2");
        g.bar(16, y + 14, 80, 1, m2.hp / f9.hp, "e2");
        if (reserve) g.text("R", 96, y, "g1");
      });
    }
    drawDesc(g, d) {
      const lines = wrap(d, 148).slice(0, 3);
      g.box(0, 132, 160, 28);
      lines.forEach((l, i) => g.text(l, 5, 136 + i * LINE_H));
    }
    drawEquipInfo(g) {
      const m2 = this.st.members[this.memberId];
      const f9 = fullStats(m2);
      g.box(2, 84, 104, 46);
      g.text(`${MEMBERS[m2.id].name}`, 6, 87, "y3");
      g.text(`W: ${ITEMS[m2.weapon]?.name ?? "-"}`, 6, 94);
      g.text(`C: ${ITEMS[m2.charm]?.name ?? "-"}`, 6, 101);
      g.text(`STR ${f9.str}  MND ${f9.mnd}`, 6, 110, "g3");
      g.text(`DEF ${f9.def}  SPD ${f9.spd}`, 6, 117, "g3");
      if (f9.hue !== "N") g.text(`Attack hue: ${HUE_NAME[f9.hue]}`, 6, 124, "g3");
    }
    drawDetail(g, id) {
      if (!id) return;
      const m2 = this.st.members[id];
      const d = MEMBERS[id];
      const f9 = fullStats(m2);
      g.box(2, 44, 104, 114);
      g.rect(6, 48, 20, 20, "ink");
      g.sprite(d.sprite, 8, 50, { scale: 2 });
      g.text(d.name, 30, 49, "y3");
      g.text(d.title, 30, 56, "g2");
      hueChips(g, memberHues(id), 30, 64);
      const rows = [
        `Lv ${m2.lvl}   next ${xpToNext(m2.lvl) - m2.xp}`,
        `HP ${m2.hp}/${f9.hp}  INK ${m2.ink}/${f9.ink}`,
        `STR ${f9.str}  DEF ${f9.def}`,
        `MND ${f9.mnd}  SPD ${f9.spd}`
      ];
      if (id === "nona") rows.push(`Tails ${m2.tails}/9`);
      rows.forEach((r, i) => g.text(r, 6, 72 + i * LINE_H));
      wrap(d.bio, 96).forEach((l, i) => g.text(l, 6, 72 + (rows.length + 1) * LINE_H + i * LINE_H, "g3"));
    }
    drawJournal(g) {
      const ch = CHAPTERS[this.st.chapter - 1];
      g.box(2, 2, 104, 156);
      if (!ch) return;
      g.text(`Chapter ${this.st.chapter}`, 6, 6, "g2");
      g.text(ch.title, 6, 13, "y3");
      g.text(ch.stage, 6, 20, "g2");
      const lines = wrap(ch.objective(this.st), 96).slice(0, 6);
      lines.forEach((l, i) => g.text(l, 6, 32 + i * LINE_H));
      const log = this.st.log.filter((r) => r.ch === this.st.chapter);
      if (log.length) {
        const won = log.filter((r) => r.result === "win").length;
        const closest = Math.min(...log.filter((r) => r.result === "win").map((r) => r.minFrac), 1);
        const turns = log.reduce((s, r) => s + r.turns, 0) / log.length;
        g.text("Your record here", 6, 80, "g2");
        g.text(`Won ${won} of ${log.length}`, 6, 87);
        g.text(`Closest call ${Math.round(closest * 100)}% HP`, 6, 94, closest < 0.15 ? "r3" : "w");
        g.text(`${turns.toFixed(1)} turns a fight`, 6, 101);
      }
      const mech = this.st.mech;
      if (mech.length) {
        g.text("Mechanics", 6, 112, "g2");
        wrap(mech.map((m2) => MECH_NAME[m2] ?? m2).join(", "), 96).forEach((l, i) => g.text(l, 6, 119 + i * LINE_H, "w"));
      }
    }
    drawHues(g) {
      g.box(2, 2, 104, 156);
      g.text("The hue wheel", 6, 6, "y3");
      const cx = 54, cy = 52, r = 26;
      WHEEL.forEach((h2, i) => {
        const a = -Math.PI / 2 + i * Math.PI / 3;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        g.rect(x - 4, y - 4, 9, 9, HUE_COLOR[h2]);
        g.text(HUE_NAME[h2][0], x - 1, y - 2, "k");
      });
      const tips = [
        "A hue hits its opposite for x1.5.",
        "It hits its own hue for x0.75.",
        "A foe's two colors are its hues.",
        "Grey has no hue."
      ];
      tips.forEach((t, i) => wrap(t, 96).forEach((l, j) => g.text(l, 6, 88 + i * 16 + j * LINE_H)));
    }
  };
  var MECH_NAME = {
    hues: "Hues",
    break: "Break",
    tempo: "Tempo",
    coin: "Coin",
    link: "Link",
    mirror: "Mirror",
    echo: "Echo",
    tricolor: "Tricolor"
  };

  // src/scenes/field.ts
  var PROP_PAL = {
    chest: ["k", "n2", "y2"],
    lamp: ["k", "g2", "y3"],
    lampOff: ["k", "g2", "g1"],
    sign: ["k", "n2", "n3"]
  };
  var FieldScene = class {
    constructor(g) {
      __publicField(this, "g", g);
      __publicField(this, "px", 0);
      __publicField(this, "py", 0);
      __publicField(this, "moving", 0);
      __publicField(this, "mdx", 0);
      __publicField(this, "mdy", 0);
      __publicField(this, "step", 0);
      __publicField(this, "encSteps", 0);
      __publicField(this, "flashC", null);
      __publicField(this, "flashT", 0);
      __publicField(this, "scripted", null);
      __publicField(this, "entMoves", []);
    }
    onMapLoaded() {
      this.moving = 0;
      this.encSteps = 0;
      this.px = this.g.st.x * 8;
      this.py = this.g.st.y * 8;
    }
    flash(c) {
      this.flashC = c;
      this.flashT = 12;
    }
    get w() {
      return this.g.world;
    }
    update() {
      const g = this.g;
      const st = g.st;
      if (!g.world) return;
      this.updateEnts();
      if (this.flashT > 0) this.flashT--;
      if (this.moving > 0) {
        this.moving--;
        this.px += this.mdx;
        this.py += this.mdy;
        if (this.moving === 0) this.arrive();
        return;
      }
      if (this.scripted) {
        const s = this.scripted;
        if (s.left <= 0) {
          this.scripted = null;
          s.res();
          return;
        }
        s.left--;
        this.startMove(s.dir, true);
        return;
      }
      if (g.busy > 0 || g.top !== this) return;
      const inp = g.input;
      if (inp.pressed("b")) {
        g.audio.sfx("ok");
        g.push(new MenuScene(g));
        return;
      }
      if (inp.pressed("a")) {
        this.interact();
        return;
      }
      if (inp.pressed("c")) {
        this.special();
        return;
      }
      for (const d of ["up", "down", "left", "right"]) {
        if (inp.isDown(d)) {
          st.facing = d;
          this.startMove(d, false);
          break;
        }
      }
    }
    startMove(d, scripted) {
      const st = this.g.st;
      st.facing = d;
      const [dx, dy] = DIRS[d];
      const nx = st.x + dx, ny = st.y + dy;
      if (!scripted && !this.w.passable(nx, ny, st)) {
        if (this.g.frame % 16 === 0) this.g.audio.sfx("bump");
        return;
      }
      st.x = nx;
      st.y = ny;
      this.mdx = dx;
      this.mdy = dy;
      this.moving = 8;
    }
    arrive() {
      const g = this.g;
      const st = g.st;
      st.steps++;
      this.step++;
      if (this.scripted) return;
      const t = this.w.tile(st.x, st.y, st);
      if (t.paint && st.tint !== t.paint) {
        st.tint = t.paint;
        g.audio.sfx("magic");
      }
      const e = this.w.entAt(st.x, st.y);
      if (e && (e.def.kind === "warp" || e.def.kind === "trigger")) {
        if (e.def.kind === "warp" && e.def.to) {
          const [m2, mk2, dir] = e.def.to;
          g.run(async (s) => s.warp(m2, mk2, dir));
          return;
        }
        if (e.def.step) {
          g.run(e.def.step);
          return;
        }
      }
      if (t.belt) {
        const [dx, dy] = DIRS[t.belt];
        if (this.w.passable(st.x + dx, st.y + dy, st)) {
          st.x += dx;
          st.y += dy;
          this.mdx = dx;
          this.mdy = dy;
          this.moving = 6;
          this.px = (st.x - dx) * 8;
          this.py = (st.y - dy) * 8;
          return;
        }
      }
      const enc = this.w.def.enc;
      const safe = this.w.def.dark !== void 0 && this.lights().slice(1).some(([lx, ly]) => Math.hypot(lx - st.x, ly - st.y) < 3);
      if (t.enc && enc && !st.flags.noEnc && !safe) {
        this.encSteps++;
        const ramp = Math.max(0, Math.min(1, (this.encSteps - 5) / 8));
        if (g.rng.chance(enc.rate * ramp)) {
          this.encSteps = 0;
          const group = g.rng.weighted(enc.groups, (x) => x[1])[0];
          g.audio.sfx("enc");
          g.run(async (s) => {
            await s.battle(group);
          });
        }
      }
    }
    interact() {
      const g = this.g;
      const st = g.st;
      const [dx, dy] = DIRS[st.facing];
      const e = this.w.entAt(st.x + dx, st.y + dy) ?? this.w.entAt(st.x, st.y);
      if (!e) return;
      const def = e.def;
      if (def.kind === "npc" && def.talk) {
        const back = { up: "down", down: "up", left: "right", right: "left" };
        e.dir = back[st.facing];
        g.run(def.talk);
        return;
      }
      if (def.talk) {
        g.run(def.talk);
        return;
      }
      const key = `${this.w.def.id}:${def.id}`;
      if (def.kind === "chest") {
        if (st.flags[`open:${key}`]) {
          g.run(async (s) => s.tell("Empty."));
          return;
        }
        st.flags[`open:${key}`] = true;
        g.run(async (s) => {
          if (def.item) await s.give(def.item, def.n ?? 1);
          if (def.gold) await s.gold(def.gold);
        });
        return;
      }
      if (def.kind === "sign") {
        g.run(async (s) => s.tell(def.text ?? ""));
        return;
      }
      if (def.kind === "lamp") {
        g.run(async (s) => {
          if (!st.flags[`lit:${key}`]) {
            st.flags[`lit:${key}`] = true;
            s.sfx("save");
            s.flash("y3");
            await s.tell("You light the lamp. The dark steps back.");
          }
          const i = await s.ask("The lamp is warm.", ["Rest and save", "Leave"]);
          if (i === 0) {
            healAll(st);
            const ok = save(st);
            s.sfx("save");
            await s.tell(ok ? "The party rests. Progress saved." : "The party rests. Saving failed in this browser.");
          }
        });
      }
    }
    special() {
      const g = this.g;
      const st = g.st;
      const def = this.w.def;
      if (def.past && st.items.sundial) {
        st.past = !st.past;
        if (!this.w.passable(st.x, st.y, st) && this.w.tile(st.x, st.y, st).solid) {
          st.past = !st.past;
          g.audio.sfx("bump");
          g.banner = { text: "Something is in the way then.", t: 70 };
          return;
        }
        g.audio.sfx("shift");
        this.flash("w");
        g.banner = { text: st.past ? "The past" : "The present", t: 70 };
        this.w.refresh(st);
        return;
      }
      g.audio.sfx("bump");
    }
    updateEnts() {
      const st = this.g.st;
      for (const m2 of this.entMoves.slice()) {
        const e = m2.e;
        if (m2.t > 0) {
          m2.t--;
          const [dx, dy] = DIRS[e.dir];
          e.ox += dx;
          e.oy += dy;
          if (m2.t === 0) {
            e.x += dx;
            e.y += dy;
            e.ox = 0;
            e.oy = 0;
          }
          continue;
        }
        const c = m2.path.shift();
        if (!c) {
          this.entMoves = this.entMoves.filter((x) => x !== m2);
          m2.res();
          continue;
        }
        const d = c === "u" ? "up" : c === "d" ? "down" : c === "l" ? "left" : "right";
        e.dir = d;
        m2.t = 8;
      }
      if (this.g.busy > 0) return;
      for (const e of this.w.ents) {
        if (!e.def.wander || e.hidden || this.entMoves.some((m2) => m2.e === e)) continue;
        if (--e.wanderT > 0) continue;
        e.wanderT = 90 + Math.floor(this.g.rng.next() * 150);
        const d = this.g.rng.pick(["up", "down", "left", "right"]);
        const [dx, dy] = DIRS[d];
        const nx = e.x + dx, ny = e.y + dy;
        if (Math.abs(nx - e.hx) > 2 || Math.abs(ny - e.hy) > 2) continue;
        if (!this.w.passable(nx, ny, st) || nx === st.x && ny === st.y) continue;
        e.dir = d;
        this.entMoves.push({ e, path: [], res: () => {
        }, t: 8 });
      }
    }
    moveEnt(id, path) {
      const e = this.w.ent(id);
      if (!e) return Promise.resolve();
      return new Promise((res) => this.entMoves.push({ e, path: path.split(""), res, t: 0 }));
    }
    movePlayer(path) {
      const steps = path.split("");
      return new Promise((res) => {
        const next = () => {
          const c = steps.shift();
          if (!c) {
            res();
            return;
          }
          const d = c === "u" ? "up" : c === "d" ? "down" : c === "l" ? "left" : "right";
          this.scripted = { dir: d, left: 1, res: next };
        };
        next();
      });
    }
    camera() {
      const w = this.w.w * 8, h2 = this.w.h * 8;
      let cx = this.px + 4 - SW / 2;
      let cy = this.py + 4 - SH / 2;
      cx = w <= SW ? (w - SW) / 2 : Math.max(0, Math.min(w - SW, cx));
      cy = h2 <= SH ? (h2 - SH) / 2 : Math.max(0, Math.min(h2 - SH, cy));
      return [Math.round(cx), Math.round(cy)];
    }
    lights() {
      const st = this.g.st;
      const out = [[this.px / 8, this.py / 8, this.w.def.dark ?? 3]];
      for (const e of this.w.ents) {
        if (e.hidden) continue;
        if (e.def.kind === "lamp" && st.flags[`lit:${this.w.def.id}:${e.def.id}`]) out.push([e.x, e.y, 3.5]);
        if (e.def.kind === "prop" && e.def.solid === false && e.def.text === "light") out.push([e.x, e.y, 2.5]);
      }
      return out;
    }
    darkness(x, y, lights) {
      let best = 99;
      for (const [lx, ly, r] of lights) {
        const d = Math.hypot(x - lx, y - ly) - r;
        if (d < best) best = d;
      }
      return best;
    }
    entSprite(e) {
      const st = this.g.st;
      const key = `${this.w.def.id}:${e.def.id}`;
      switch (e.def.kind) {
        case "chest":
          return { g: "prop", pal: PROP_PAL.chest, o: { kind: st.flags[`open:${key}`] ? "chestOpen" : "chest" } };
        case "lamp": {
          const lit = !!st.flags[`lit:${key}`];
          return { g: "prop", pal: lit ? PROP_PAL.lamp : PROP_PAL.lampOff, o: { kind: lit ? "lamp" : "lampOff" } };
        }
        case "sign":
          return e.spr ?? { g: "prop", pal: PROP_PAL.sign, o: { kind: "sign" } };
        default:
          return e.spr;
      }
    }
    playerSprite() {
      const st = this.g.st;
      const lead = st.party[0] ?? "wick";
      const base2 = MEMBERS[lead].sprite;
      if (st.flags.skiff && this.w.tile(st.x, st.y, st).sea) return { g: "prop", pal: ["k", "n2", "b3"], o: { kind: "pot" } };
      if (st.tint) return { ...base2, pal: [base2.pal[0], base2.pal[1], HUE_COLOR[st.tint]] };
      if (lead === "wick" && st.flags.wickHue) return { ...base2, pal: [base2.pal[0], base2.pal[1], String(st.flags.wickHue)] };
      return base2;
    }
    draw(g) {
      const game2 = this.g;
      const st = game2.st;
      const w = game2.world;
      if (!w) return;
      const [cx, cy] = this.camera();
      const theme = w.def.theme ?? {};
      const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
      const frame = Math.floor(game2.frame / 20);
      const dark = w.def.dark !== void 0;
      const lights = dark ? this.lights() : [];
      for (let ty = y0; ty <= y0 + 20; ty++) {
        for (let tx = x0; tx <= x0 + 20; tx++) {
          const t = w.tile(tx, ty, st);
          const kind = t.gate ? "gate" : t.belt ? `belt_${t.belt}` : t.kind;
          let pal = theme[t.belt ? "belt" : kind] ?? BASE_THEME[t.belt ? "belt" : kind] ?? BASE_THEME.ground;
          if (t.gate) pal = ["k", HUE_COLOR[t.gate], "w"];
          if (t.paint) pal = ["k", HUE_COLOR[t.paint], theme.ground?.[1] ?? "e1"];
          const v = hash2(tx, ty) % 4;
          const sx = tx * 8 - cx, sy = ty * 8 - cy;
          if (t.paint) {
            const gp = theme.ground ?? BASE_THEME.ground;
            g.sprite({ g: "tile", pal: gp, o: { kind: "ground", v } }, sx, sy, { frame: 0 });
            g.sprite({ g: "prop", pal, o: { kind: "pool" } }, sx, sy);
          } else {
            const animated = !!t.belt || ["water", "deep", "static", "void", "edge", "tall", "antenna", "gear", "gate", "cloud", "thread", "machine"].includes(kind);
            g.sprite({ g: "tile", pal, o: { kind, v } }, sx, sy, { frame: animated ? (t.belt ? game2.frame >> 2 : frame) % 8 : 0 });
          }
        }
      }
      const ents = w.ents.filter((e) => !e.hidden).sort((a, b2) => a.y - b2.y);
      for (const e of ents) {
        const spr = this.entSprite(e);
        if (!spr) continue;
        if (dark && this.darkness(e.x, e.y, lights) > 0.5) continue;
        const bob = e.def.kind === "npc" && Math.floor((game2.frame + e.hx * 11) / 30) % 2 === 0 ? 0 : 0;
        g.sprite(spr, e.x * 8 + e.ox - cx, e.y * 8 + e.oy - cy - bob, { flip: e.dir === "left" });
      }
      const pb = this.moving > 0 && this.step % 2 === 0 ? 1 : 0;
      g.sprite(this.playerSprite(), Math.round(this.px - cx), Math.round(this.py - cy - pb), { flip: st.facing === "left", grey: false });
      if (dark) this.drawDark(g, cx, cy, lights);
      if (this.flashT > 0 && this.flashC) g.overlay(this.flashC, this.flashT / 16);
      if (st.tint) {
        g.box(2, 2, 13, 11);
        g.rect(5, 5, 7, 5, HUE_COLOR[st.tint]);
      }
      if (w.def.past && st.items.sundial) {
        if (st.past) g.overlay("o3", 0.08);
        g.box(118, 2, 40, 11);
        g.text(st.past ? "PAST" : "NOW", 123, 5, st.past ? "o3" : "w");
        g.text("C", 150, 5, "g1");
      }
      if (game2.banner.t > 0 && game2.banner.text) {
        const a = Math.min(1, game2.banner.t / 20);
        g.alpha(a, () => centerBox(g, game2.banner.text, 4));
      }
    }
    drawDark(g, cx, cy, lights) {
      const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
      for (let ty = y0; ty <= y0 + 20; ty++) {
        for (let tx = x0; tx <= x0 + 20; tx++) {
          const d = this.darkness(tx, ty, lights);
          const sx = tx * 8 - cx, sy = ty * 8 - cy;
          if (d > 0.9) g.rect(sx, sy, 8, 8, "k", false);
          else if (d > 0.1) {
            for (let py = 0; py < 8; py++) for (let px = py % 2; px < 8; px += 2) g.rect(sx + px, sy + py, 1, 1, "k", false);
          } else if (d > -0.6) {
            for (let py = 0; py < 8; py += 2) for (let px = py % 4 === 0 ? 0 : 2; px < 8; px += 4) g.rect(sx + px, sy + py, 1, 1, "k", false);
          }
        }
      }
    }
  };

  // src/scenes/card.ts
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
  var CardScene = class {
    constructor(g, n, done) {
      __publicField(this, "g", g);
      __publicField(this, "n", n);
      __publicField(this, "done", done);
      __publicField(this, "t", 0);
      g.audio.play("title");
    }
    update() {
      this.t++;
      if (this.t > 70 && (this.g.input.pressed("a") || this.g.input.pressed("b"))) {
        this.g.pop(this);
        this.done();
      }
      if (this.t > 420) {
        this.g.pop(this);
        this.done();
      }
    }
    draw(g) {
      g.clear("k");
      const ch = CHAPTERS[this.n - 1];
      if (!ch) return;
      const a = Math.min(1, this.t / 40);
      g.alpha(a, () => {
        g.textC(`CHAPTER ${ROMAN[this.n - 1]}`, 80, 40, "g2");
        g.textC(ch.title, 80, 52, "y3");
        g.textC(ch.stage, 80, 62, "g2");
        WHEEL.forEach((h2, i) => g.rect(56 + i * 8, 74, 6, 2, i < this.n - 1 ? HUE_COLOR[h2] : "ink"));
        const who = ch.recruit ? MEMBERS[ch.recruit] : null;
        if (who) {
          g.sprite(who.sprite, 72, 86, { scale: 2 });
        }
        wrap(ch.blurb, 130).forEach((l, i) => g.textC(l, 80, 110 + i * LINE_H, "w"));
      });
      if (this.t > 70 && Math.floor(this.t / 20) % 2 === 0) g.textC("Z", 80, 150, "g1");
    }
  };

  // src/maps/endings.ts
  var ENDINGS = {
    give: [
      "The Loom prints again. Not everything, and not as fast as it used to. Enough.",
      "Tint relit the lighthouse at Prismouth. The Lens is glued together with violet paint, and the light comes out slightly purple. Ships say they prefer it.",
      "Brask and the moths keep the Edge Lamps beside Wick. On cold nights the moths sleep inside the armor, and Brask says it is the warmest they have ever been.",
      "VEND opened a shop in Edgewick. Everything costs one coin. He keeps a loaf of bread on the top shelf that is not for sale.",
      "Tock grew younger every day, until one morning Gran found a small brass baby asleep in the tallow pot. He is very relaxed.",
      "Mirrow sails the cloud sea, reflecting whatever is worth reflecting. Mostly sky.",
      "Nil and the Bishop sweep the Loom together. Nil has taken a color. It is the smallest possible amount of amber.",
      "Nona's statue sits by the Great Lamp. Every evening, when Wick lights it, the light falls on her first.",
      "Wick is still a Duotone. Black and amber. It turns out that is enough to light a lamp, and a lamp is enough to see by.",
      "DUOTONE. Thank you for playing."
    ],
    keep: [
      "Wick is whole now: black, amber, and a color nobody has a name for.",
      "The Loom did not come down. It did not need to. The Bishop kept taking what could be spared, and after a while, that was most things.",
      "Edgewick is grey. Gran is grey. The Great Lamp is grey, and still warm.",
      "Wick keeps the Edge Lamps anyway, every night, three colors against all that grey.",
      "DUOTONE. There was another way to finish."
    ]
  };

  // src/scenes/ending.ts
  var EndingScene = class {
    constructor(g, kind, done) {
      __publicField(this, "g", g);
      __publicField(this, "kind", kind);
      __publicField(this, "done", done);
      __publicField(this, "t", 0);
      __publicField(this, "page", 0);
      __publicField(this, "pages");
      this.pages = ENDINGS[kind] ?? ["The end."];
      g.audio.play(kind === "keep" ? "sad" : "title");
    }
    update() {
      this.t++;
      if (this.t > 60 && (this.g.input.pressed("a") || this.g.input.pressed("b"))) {
        this.page++;
        this.t = 0;
        if (this.page >= this.pages.length) {
          this.g.pop(this);
          this.done();
        }
      }
    }
    draw(g) {
      g.clear("k");
      const text = this.pages[this.page];
      if (!text) return;
      const a = Math.min(1, this.t / 30);
      const grey = this.kind === "keep";
      g.alpha(a, () => {
        const lines = wrap(text, 140);
        const y0 = 80 - lines.length * (LINE_H + 1) / 2;
        lines.forEach((l, i) => g.textC(l, 80, y0 + i * (LINE_H + 1), "w"));
        const ids = MEMBER_ORDER.filter((id) => this.g.st.members[id]);
        ids.forEach((id, i) => {
          const bob = Math.round(Math.sin((this.g.frame + i * 15) / 20));
          g.sprite(MEMBERS[id].sprite, 80 - ids.length * 6 + i * 12, 136 + bob, { grey: grey && id !== "wick" });
        });
      });
      if (this.t > 60 && Math.floor(this.t / 20) % 2 === 0) g.text("`", 150, 150, "g1");
    }
  };

  // src/scenes/gameover.ts
  var GameOverScene = class {
    constructor(g, done) {
      __publicField(this, "g", g);
      __publicField(this, "done", done);
      __publicField(this, "t", 0);
      __publicField(this, "menu");
      this.menu = new Menu([
        { label: "Try the battle again", id: "retry" },
        { label: "Load last save", id: "load", enabled: !!load() },
        { label: "Return to title", id: "title" }
      ], 3);
      g.audio.play("sad");
    }
    update() {
      this.t++;
      if (this.t < 40) return;
      const r = this.menu.update(this.g.input, this.g.audio);
      if (r !== "ok") return;
      const id = this.menu.cur.id;
      this.g.pop(this);
      if (id === "retry") {
        this.done(0);
        return;
      }
      if (id === "load") {
        const st = load();
        if (st) {
          this.g.st = st;
          this.g.stack = [];
          this.g.field = null;
          this.g.loadMap(st.map, [st.x, st.y]);
          this.g.push(this.g.field);
        }
        this.done(1);
        return;
      }
      this.g.goTitle();
      this.done(2);
    }
    draw(g) {
      g.clear("k");
      const a = Math.min(1, this.t / 40);
      g.alpha(a, () => {
        g.textC("The colors run out.", 80, 50, "g3");
        g.textC("Every ink returns to the Loom.", 80, 60, "g2");
      });
      if (this.t >= 40) this.menu.draw(g, 26, 84, 108, this.t);
    }
  };

  // src/game/game.ts
  var Abort = class extends Error {
  };
  var Game = class {
    constructor(canvas2) {
      __publicField(this, "gfx");
      __publicField(this, "input", new Input());
      __publicField(this, "audio", new Audio());
      __publicField(this, "st");
      __publicField(this, "stack", []);
      __publicField(this, "world", null);
      __publicField(this, "field", null);
      __publicField(this, "frame", 0);
      __publicField(this, "fadeA", 0);
      __publicField(this, "fadeTarget", 0);
      __publicField(this, "fadeDone", null);
      __publicField(this, "shakeT", 0);
      __publicField(this, "busy", 0);
      __publicField(this, "greyAll", false);
      __publicField(this, "rng", new Rng());
      __publicField(this, "banner", { text: "", t: 0 });
      __publicField(this, "onTitle", null);
      this.gfx = new Gfx(canvas2);
    }
    get top() {
      return this.stack[this.stack.length - 1];
    }
    push(s) {
      this.stack.push(s);
    }
    pop(s) {
      if (s) this.stack = this.stack.filter((x) => x !== s);
      else this.stack.pop();
    }
    replaceAll(s) {
      this.stack = [s];
    }
    update() {
      this.input.tick();
      if (this.input.pressed("mute")) this.audio.toggleMute();
      this.top?.update();
      if (this.fadeA !== this.fadeTarget) {
        const d = this.fadeTarget > this.fadeA ? 0.1 : -0.1;
        this.fadeA = Math.max(0, Math.min(1, this.fadeA + d));
        if (Math.abs(this.fadeA - this.fadeTarget) < 0.01) {
          this.fadeA = this.fadeTarget;
          const f9 = this.fadeDone;
          this.fadeDone = null;
          f9?.();
        }
      }
      if (this.shakeT > 0) this.shakeT--;
      if (this.banner.t > 0) this.banner.t--;
      if (this.st) this.st.frames++;
      this.frame++;
    }
    draw() {
      const g = this.gfx;
      g.ox = this.shakeT > 0 ? Math.round(Math.sin(this.frame * 1.7) * 2) : 0;
      g.oy = 0;
      let base2 = this.stack.length - 1;
      while (base2 > 0 && this.stack[base2].overlay) base2--;
      g.clear("k");
      for (let i = Math.max(0, base2); i < this.stack.length; i++) this.stack[i].draw(g);
      g.ox = 0;
      g.overlay("k", this.fadeA);
    }
    fadeTo(a) {
      return new Promise((res) => {
        this.fadeTarget = a;
        if (Math.abs(this.fadeA - a) < 0.01) {
          this.fadeA = a;
          res();
          return;
        }
        this.fadeDone = res;
      });
    }
    wait(frames) {
      return new Promise((res) => {
        let n = frames;
        const tick2 = {
          overlay: true,
          update: () => {
            if (--n <= 0) {
              this.pop(tick2);
              res();
            }
          },
          draw: () => {
          }
        };
        this.push(tick2);
      });
    }
    /** Loads a map and places the player on a marker. */
    loadMap(id, marker, dir) {
      const def = MAPS[id];
      if (!def) throw new Error("Unknown map " + id);
      this.world = new World(def, this.st);
      const [x, y] = typeof marker === "string" ? this.world.marker(marker) : marker;
      this.st.map = id;
      this.st.x = x;
      this.st.y = y;
      if (dir) this.st.facing = dir;
      this.gfx.grey = !!def.grey || this.greyAll;
      if (!this.field) this.field = new FieldScene(this);
      this.field.onMapLoaded();
      this.audio.play(def.music);
      this.banner = { text: def.name, t: 110 };
    }
    async run(script) {
      this.busy++;
      try {
        await script(new GameCtx(this));
      } catch (e) {
        if (!(e instanceof Abort)) console.error(e);
      } finally {
        this.busy--;
      }
    }
    async enterMap() {
      const def = this.world?.def;
      if (def?.enter) await this.run(def.enter);
    }
    goTitle() {
      this.field = null;
      this.world = null;
      this.onTitle?.();
    }
  };
  var GameCtx = class extends Ctx {
    constructor(g) {
      super(g.st);
      __publicField(this, "g", g);
    }
    say(who, text, spr) {
      return new Promise((res) => this.g.push(new DialogScene(this.g, who, text, spr, res)));
    }
    ask(q, opts) {
      return new Promise((res) => this.g.push(new ChoiceScene(this.g, q, opts, res)));
    }
    async battle(group, o = {}) {
      for (; ; ) {
        const snapshot = JSON.stringify(this.st);
        const result = await new Promise((res) => this.g.push(new BattleScene(this.g, group, o, res)));
        if (result !== "lose" || o.canLose) {
          this.g.audio.play(this.g.world?.def.music ?? "village");
          return result;
        }
        const choice = await new Promise((res) => this.g.push(new GameOverScene(this.g, res)));
        if (choice === 0) {
          Object.assign(this.st, JSON.parse(snapshot));
          continue;
        }
        throw new Abort();
      }
    }
    async warp(map, marker, dir) {
      await this.g.fadeTo(1);
      this.g.loadMap(map, marker, dir);
      this.g.audio.sfx("door");
      await this.g.fadeTo(0);
      const def = this.g.world?.def;
      if (def?.enter) await def.enter(this);
    }
    fadeOut() {
      return this.g.fadeTo(1);
    }
    fadeIn() {
      return this.g.fadeTo(0);
    }
    wait(frames) {
      return this.g.wait(frames);
    }
    shop(id) {
      return new Promise((res) => this.g.push(new ShopScene(this.g, id, res)));
    }
    card(chapter9) {
      return new Promise((res) => this.g.push(new CardScene(this.g, chapter9, res)));
    }
    moveEnt(id, path) {
      return this.g.field?.moveEnt(id, path) ?? Promise.resolve();
    }
    movePlayer(path) {
      return this.g.field?.movePlayer(path) ?? Promise.resolve();
    }
    face(dir) {
      this.st.facing = dir;
    }
    sfx(n) {
      this.g.audio.sfx(n);
    }
    music(n) {
      this.g.audio.play(n);
    }
    shake(frames) {
      this.g.shakeT = frames;
    }
    async flash(c) {
      this.g.field?.flash(c);
      await this.g.wait(12);
    }
    ending(kind) {
      return new Promise((res) => this.g.push(new EndingScene(this.g, kind, res)));
    }
    refresh() {
      this.g.world?.refresh(this.st);
    }
    setEnt(id, patch) {
      const w = this.g.world;
      if (!w) return;
      if (patch.hidden !== void 0) this.st.flags[`hide:${w.def.id}:${id}`] = patch.hidden ? true : "show";
      const e = w.ent(id);
      if (e && patch.spr) e.spr = patch.spr;
      w.refresh(this.st);
    }
    greyWorld(on) {
      this.g.greyAll = on;
      this.g.gfx.grey = on || !!this.g.world?.def.grey;
    }
    save() {
      save(this.st);
    }
    title() {
      this.g.goTitle();
    }
  };

  // src/game/presets.ts
  var PRESETS = [
    { lvl: 1, party: ["wick"], weaponTier: 0, gold: 20, items: { tallow: 3 }, mech: [] },
    { lvl: 6, party: ["wick", "nona"], weaponTier: 1, gold: 150, items: { tallow: 5, ink_vial: 2, pin: 1 }, mech: [], keyItems: ["lampsap"], charms: { wick: "lucky_button", nona: "wool_scarf" } },
    { lvl: 10, party: ["wick", "nona", "tint"], weaponTier: 2, gold: 350, items: { tallow: 4, candle: 2, ink_vial: 3, relight: 1 }, mech: ["hues"], keyItems: ["lens_shard"], charms: { wick: "lucky_button", nona: "wool_scarf", tint: "ink_ring" } },
    { lvl: 14, party: ["wick", "nona", "tint", "brask"], weaponTier: 3, gold: 600, items: { candle: 5, ink_vial: 4, relight: 2, pin: 2 }, mech: ["hues", "break"], keyItems: ["lens_shard", "seal"] },
    { lvl: 17, party: ["wick", "nona", "tint", "tock"], reserve: ["brask"], weaponTier: 4, gold: 900, items: { candle: 6, ink_vial: 3, ink_well: 2, relight: 2, clock_tea: 1 }, mech: ["hues", "break", "tempo"], keyItems: ["lens_shard", "seal", "sundial"] },
    { lvl: 20, party: ["wick", "nona", "tint", "vend"], reserve: ["tock", "brask"], weaponTier: 5, gold: 1400, items: { candle: 6, honey: 2, ink_well: 3, relight: 3 }, mech: ["hues", "break", "tempo", "coin"], keyItems: ["seal", "sundial", "ticket"] },
    { lvl: 23, party: ["wick", "nona", "tint", "vend"], reserve: ["tock", "brask"], weaponTier: 5, gold: 2e3, items: { honey: 4, ink_well: 4, relight: 3, chorus: 1 }, mech: ["hues", "break", "tempo", "coin", "link", "mirror"], keyItems: ["sundial"], flags: { mirrowJoined: true } },
    { lvl: 27, party: ["wick", "tint", "brask", "nil"], reserve: ["tock", "vend", "mirrow"], weaponTier: 6, gold: 2500, items: { honey: 5, ink_well: 4, relight: 4, chorus: 2 }, mech: ["hues", "break", "tempo", "coin", "link", "mirror", "echo"], keyItems: ["ninth_spool", "gran_jar"], flags: { nonaGone: true, greyWorld: true, mirrowJoined: true } }
  ];
  function chapterStart(n) {
    const p2 = PRESETS[n - 1];
    const st = newGame();
    const ch = CHAPTERS[n - 1];
    st.chapter = n;
    st.map = ch.startMap;
    st.members = {};
    st.party = [];
    st.reserve = [];
    for (const id of [...p2.party, ...p2.reserve ?? []]) {
      const m2 = newMember(id, p2.lvl);
      const tier = Math.min(6, p2.weaponTier);
      m2.weapon = `${m2.weapon.slice(0, -1)}${tier}`;
      if (p2.charms?.[id]) m2.charm = p2.charms[id];
      st.members[id] = m2;
    }
    st.party = [...p2.party];
    st.reserve = [...p2.reserve ?? []];
    st.gold = p2.gold;
    st.items = { ...p2.items };
    for (const k of p2.keyItems ?? []) st.items[k] = 1;
    st.mech = [...p2.mech];
    st.flags = { ...p2.flags ?? {}, ...ch.presetFlags ?? {} };
    healAll(st);
    return st;
  }

  // src/scenes/title.ts
  function bigText(g, s, x, y, scale, col, shadow) {
    let cx = x;
    for (const ch of s) {
      const gl = GLYPHS.get(ch);
      if (!gl) {
        cx += 3 * scale;
        continue;
      }
      gl.rows.forEach((row, ry) => {
        for (let i = 0; i < row.length; i++) if (row[i] === "#") {
          if (shadow) g.rect(cx + i * scale + 1, y + ry * scale + 1, scale, scale, shadow);
          g.rect(cx + i * scale, y + ry * scale, scale, scale, col);
        }
      });
      cx += (gl.w + 1) * scale;
    }
  }
  function bigW(s, scale) {
    let w = 0;
    for (const ch of s) w += ((GLYPHS.get(ch)?.w ?? 2) + 1) * scale;
    return w - scale;
  }
  var TitleScene = class {
    constructor(g) {
      __publicField(this, "g", g);
      __publicField(this, "t", 0);
      __publicField(this, "menu");
      __publicField(this, "chapters", null);
      const items = [
        { label: "New game", id: "new" },
        { label: "Continue", id: "cont", enabled: !!load() },
        { label: "Chapter select", id: "chap" }
      ];
      this.menu = new Menu(items, items.length);
      g.audio.play("title");
    }
    update() {
      this.t++;
      const g = this.g;
      if (this.chapters) {
        const r2 = this.chapters.update(g.input, g.audio);
        if (r2 === "back") this.chapters = null;
        else if (r2 === "ok") {
          const n = +this.chapters.cur.id;
          this.start(chapterStart(n), true);
        }
        return;
      }
      const r = this.menu.update(g.input, g.audio);
      if (r !== "ok") return;
      const id = this.menu.cur.id;
      if (id === "new") this.start(newGame(), true);
      else if (id === "cont") {
        const st = load();
        if (st) this.start(st, false);
      } else if (id === "chap") {
        this.chapters = new Menu(CHAPTERS.map((c, i) => ({ label: `${i + 1}. ${c.title}`, id: String(i + 1), enabled: c.ready })), 8);
      }
    }
    start(st, fresh) {
      const g = this.g;
      g.st = st;
      g.field = null;
      g.greyAll = !!st.flags.greyWorld;
      g.stack = [];
      g.loadMap(st.map, fresh ? CHAPTERS[st.chapter - 1].startMarker : [st.x, st.y]);
      g.push(g.field);
      if (fresh) {
        const ch = CHAPTERS[st.chapter - 1];
        g.run(async (s) => {
          await s.card(st.chapter);
          s.music(g.world.def.music);
          if (ch.intro) await ch.intro(s);
          else await g.enterMap();
        });
      } else {
        g.run(async () => {
          await g.enterMap();
        });
      }
    }
    draw(g) {
      g.clear("k");
      for (let i = 0; i < 24; i++) {
        const x = (i * 37 + this.t * (0.2 + i % 3 * 0.1)) % 170 - 5;
        const y = i * 53 % 150;
        g.rect(Math.round(x), y, 1, 1, i % 4 === 0 ? "g2" : "g1");
      }
      const s = 3;
      const w = bigW("DUOTONE", s);
      bigText(g, "DUOTONE", 80 - Math.floor(w / 2), 18, s, "o2", "r1");
      WHEEL.forEach((h2, i) => g.rect(56 + i * 8, 40, 6, 2, HUE_COLOR[h2]));
      const bob = Math.round(Math.sin(this.t / 25) * 2);
      g.sprite(MEMBERS.wick.sprite, 64, 50 + bob, { scale: 4 });
      if (this.chapters) {
        this.chapters.draw(g, 14, 90, 132, this.t);
        return;
      }
      this.menu.draw(g, 44, 94, 72, this.t);
      g.textC("Arrows move. Z confirms. X cancels.", 80, 140, "g2");
      g.textC("M mutes sound.", 80, 148, "g1");
    }
  };

  // src/main.ts
  var canvas = document.getElementById("screen");
  var game = new Game(canvas);
  game.input.attach(window);
  game.input.onAny = () => game.audio.unlock();
  window.addEventListener("pointerdown", () => game.audio.unlock());
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const avail = Math.min(window.innerWidth - 32, window.innerHeight - 80) * dpr;
    const scale = Math.max(1, Math.min(Math.round(4 * dpr), Math.floor(avail / SW)));
    canvas.style.width = `${SW * scale / dpr}px`;
    canvas.style.height = `${SW * scale / dpr}px`;
  }
  fit();
  window.addEventListener("resize", fit);
  game.onTitle = () => game.replaceAll(new TitleScene(game));
  game.replaceAll(new TitleScene(game));
  canvas.focus();
  var STEP = 1e3 / 60;
  var last = performance.now();
  var acc = 0;
  function loop(now) {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) {
      game.update();
      acc -= STEP;
    }
    game.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.duotone = game;
  var tick = () => new Promise((r) => setTimeout(r, 0));
  var run = (n) => {
    for (let i = 0; i < n; i++) game.update();
    game.draw();
  };
  window.dbg = {
    battle: (grp) => game.run(async (s) => {
      await s.battle(grp);
    }),
    warp: (m2, mk2) => game.run(async (s) => {
      await s.warp(m2, mk2);
    }),
    flag: (k, v = true) => {
      game.st.flags[k] = v;
      game.world?.refresh(game.st);
    },
    run,
    key: async (code, hold = 2, after = 20) => {
      await tick();
      window.dispatchEvent(new KeyboardEvent("keydown", { code }));
      run(hold);
      window.dispatchEvent(new KeyboardEvent("keyup", { code }));
      run(after);
      await tick();
    },
    start: (n) => {
      game.st = chapterStart(n);
      game.stack = [];
      game.field = null;
      game.greyAll = !!game.st.flags.greyWorld;
      game.loadMap(game.st.map, CHAPTERS[n - 1].startMarker);
      game.push(game.field);
    },
    state: () => ({ stack: game.stack.map((s) => s.constructor.name), busy: game.busy, map: game.st?.map, x: game.st?.x, y: game.st?.y })
  };
})();
//# sourceMappingURL=game.js.map
