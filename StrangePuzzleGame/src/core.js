// Canvas, palette, pixel font, input, sound effects, and saves.
var W = 192, H = 192;
var cv, g;

var PAL = {
  ink: '#120d1c', deep: '#0b0716', white: '#f4f0ff',
  cobalt: '#2b4cf0', cobaltDk: '#1a2a96', sky: '#7fb2ff',
  yellow: '#ffd23f', ochre: '#d18a12', cream: '#fff2b0',
  red: '#ff3b4e', redDk: '#a3162f',
  pink: '#ff8fc7', magenta: '#c2309e', blush: '#ff7fa0',
  teal: '#2ee6c5', tealDk: '#127a72',
  lime: '#b4f03c', green: '#3c9a3a', orange: '#ff8a2a', peach: '#ffc49a',
  g1: '#d6d0e6', g2: '#a49dba', g3: '#6e6788', g4: '#3e3856', g5: '#262038',
};

function initCanvas() {
  cv = document.getElementById('screen');
  cv.width = W; cv.height = H;
  g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
}
function fitCanvas() {
  var s = Math.min(innerWidth / W, innerHeight / H);
  if (s >= 1) s = Math.floor(s);
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
}

function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function frame(x, y, w, h, c) { rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c); rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c); }

var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bayer(x, y) { return BAYER[(y & 3) * 4 + (x & 3)]; }
// Paints c2 wherever the 4x4 Bayer threshold is below level (0 to 16).
function dither(x, y, w, h, c1, c2, level) {
  x = Math.round(x); y = Math.round(y);
  if (c1) rect(x, y, w, h, c1);
  if (level <= 0) return;
  g.fillStyle = c2;
  for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) if (bayer(x + i, y + j) < level) g.fillRect(x + i, y + j, 1, 1);
}

// Sprites are arrays of strings, one character per pixel, mapped through SPR_KEY. '.' is clear.
var SPR_KEY = {
  k: PAL.ink, K: PAL.deep, w: PAL.white, B: PAL.cobalt, b: PAL.cobaltDk, c: PAL.sky,
  Y: PAL.yellow, y: PAL.ochre, v: PAL.cream, R: PAL.red, r: PAL.redDk, P: PAL.pink, m: PAL.magenta, e: PAL.blush,
  T: PAL.teal, t: PAL.tealDk, G: PAL.lime, n: PAL.green, O: PAL.orange, o: PAL.peach,
  '1': PAL.g1, '2': PAL.g2, '3': PAL.g3, '4': PAL.g4, '5': PAL.g5,
};
var _sprCache = new Map();
// opts: {tint: color for every pixel, swap: {char: char or color}}
function sprite(rows, opts) {
  var key = rows.join('/') + (opts ? JSON.stringify(opts) : '');
  var c = _sprCache.get(key);
  if (c) return c;
  var h = rows.length, w = 0;
  rows.forEach(function (r) { w = Math.max(w, r.length); });
  c = document.createElement('canvas');
  c.width = w; c.height = h;
  var x2 = c.getContext('2d');
  for (var y = 0; y < h; y++) for (var x = 0; x < rows[y].length; x++) {
    var ch = rows[y][x];
    if (ch === '.' || ch === ' ') continue;
    var col;
    if (opts && opts.tint) col = opts.tint;
    else {
      if (opts && opts.swap && opts.swap[ch]) ch = opts.swap[ch];
      col = SPR_KEY[ch] || ch;
    }
    x2.fillStyle = col;
    x2.fillRect(x, y, 1, 1);
  }
  _sprCache.set(key, c);
  return c;
}
function spr(rows, x, y, flip, opts) {
  var c = sprite(rows, opts);
  x = Math.round(x); y = Math.round(y);
  if (!flip) { g.drawImage(c, x, y); return; }
  g.save(); g.translate(x + c.width, y); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore();
}
// Draws only the pixels whose Bayer threshold is below level, for dithered appear and vanish effects.
function sprDither(rows, x, y, level, flip, opts) {
  x = Math.round(x); y = Math.round(y);
  for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
    var ch = rows[j][flip ? rows[j].length - 1 - i : i];
    if (ch === '.' || bayer(x + i, y + j) >= level) continue;
    if (opts && opts.swap && opts.swap[ch]) ch = opts.swap[ch];
    g.fillStyle = opts && opts.tint ? opts.tint : SPR_KEY[ch] || ch;
    g.fillRect(x + i, y + j, 1, 1);
  }
}

// Pixel font: 5 pixel cells, 8 pixel lines, capitals 6 rows tall and lowercase 5 rows tall.
var CW = 5, LH = 8;
var GLYPHS = {
  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'], B: ['###.', '#..#', '###.', '#..#', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '#...', '.###'], D: ['###.', '#..#', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '#...', '####'], F: ['####', '#...', '###.', '#...', '#...', '#...'],
  G: ['.###', '#...', '#...', '#.##', '#..#', '.###'], H: ['#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  I: ['###.', '.#..', '.#..', '.#..', '.#..', '###.'], J: ['..##', '...#', '...#', '...#', '#..#', '.##.'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#', '#..#'], L: ['#...', '#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#'], N: ['#..#', '##.#', '##.#', '#.##', '#.##', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'], P: ['###.', '#..#', '#..#', '###.', '#...', '#...'],
  Q: ['.##.', '#..#', '#..#', '#..#', '#.#.', '.#.#'], R: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '...#', '###.'], T: ['###.', '.#..', '.#..', '.#..', '.#..', '.#..'],
  U: ['#..#', '#..#', '#..#', '#..#', '#..#', '.##.'], V: ['#..#', '#..#', '#..#', '#..#', '.##.', '.##.'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#..#', '#..#', '.##.', '.##.', '#..#', '#..#'],
  Y: ['#.#.', '#.#.', '#.#.', '.#..', '.#..', '.#..'], Z: ['####', '...#', '..#.', '.#..', '#...', '####'],
  a: ['....', '.##.', '...#', '.###', '#..#', '.###'], b: ['#...', '#...', '###.', '#..#', '#..#', '###.'],
  c: ['....', '.###', '#...', '#...', '#...', '.###'], d: ['...#', '...#', '.###', '#..#', '#..#', '.###'],
  e: ['....', '.##.', '#..#', '####', '#...', '.###'], f: ['..##', '.#..', '###.', '.#..', '.#..', '.#..'],
  g: ['....', '.###', '#..#', '#..#', '.###', '...#', '.##.'], h: ['#...', '#...', '###.', '#..#', '#..#', '#..#'],
  i: ['.#..', '....', '##..', '.#..', '.#..', '###.'], j: ['..#.', '....', '.##.', '..#.', '..#.', '..#.', '##..'],
  k: ['#...', '#...', '#..#', '#.#.', '###.', '#..#'], l: ['##..', '.#..', '.#..', '.#..', '.#..', '..##'],
  m: ['.....', '####.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'], n: ['....', '###.', '#..#', '#..#', '#..#', '#..#'],
  o: ['....', '.##.', '#..#', '#..#', '#..#', '.##.'], p: ['....', '###.', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '.###', '#..#', '#..#', '.###', '...#', '...#'], r: ['....', '#.##', '##..', '#...', '#...', '#...'],
  s: ['....', '.###', '#...', '.##.', '...#', '###.'], t: ['.#..', '.#..', '###.', '.#..', '.#..', '..##'],
  u: ['....', '#..#', '#..#', '#..#', '#..#', '.###'], v: ['....', '#.#.', '#.#.', '#.#.', '#.#.', '.#..'],
  w: ['.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'], x: ['....', '#..#', '#..#', '.##.', '#..#', '#..#'],
  y: ['....', '#..#', '#..#', '#..#', '.###', '...#', '.##.'], z: ['....', '####', '...#', '.##.', '#...', '####'],
  '0': ['.##.', '#..#', '#.##', '##.#', '#..#', '.##.'], '1': ['.#..', '##..', '.#..', '.#..', '.#..', '###.'],
  '2': ['.##.', '#..#', '...#', '.##.', '#...', '####'], '3': ['###.', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['#..#', '#..#', '#..#', '####', '...#', '...#'], '5': ['####', '#...', '###.', '...#', '...#', '###.'],
  '6': ['.##.', '#...', '###.', '#..#', '#..#', '.##.'], '7': ['####', '...#', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'], '9': ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],
  ' ': [], '.': ['....', '....', '....', '....', '....', '.#..'], ',': ['....', '....', '....', '....', '....', '.#..', '#...'],
  ':': ['....', '....', '.#..', '....', '....', '.#..'], '!': ['.#..', '.#..', '.#..', '.#..', '....', '.#..'],
  '?': ['.##.', '#..#', '...#', '..#.', '....', '..#.'], "'": ['.#..', '.#..'], '"': ['#.#.', '#.#.'],
  '(': ['..#.', '.#..', '.#..', '.#..', '.#..', '..#.'], ')': ['.#..', '..#.', '..#.', '..#.', '..#.', '.#..'],
  '-': ['....', '....', '....', '###.'], '+': ['....', '....', '.#..', '###.', '.#..'],
  '/': ['...#', '...#', '..#.', '.#..', '#...', '#...'], '=': ['....', '....', '###.', '....', '###.'],
  '<': ['....', '..#.', '.#..', '#...', '.#..', '..#.'], '>': ['....', '#...', '.#..', '..#.', '.#..', '#...'],
  '~': ['....', '....', '.#.#', '#.#.'], '*': ['....', '....', '#.#.', '.#..', '#.#.'],
  '\x01': ['....', '#...', '##..', '###.', '##..', '#...'],
};
var _glyphCache = new Map();
function glyphCanvas(ch, color) {
  var key = ch + color;
  var c = _glyphCache.get(key);
  if (c) return c;
  var rows = GLYPHS[ch] || GLYPHS['?'];
  c = document.createElement('canvas');
  c.width = 5; c.height = 8;
  var x2 = c.getContext('2d');
  x2.fillStyle = color;
  rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === '#') x2.fillRect(x, y, 1, 1); });
  _glyphCache.set(key, c);
  return c;
}
function text(s, x, y, color, scale) {
  s = String(s);
  x = Math.round(x); y = Math.round(y);
  scale = scale || 1;
  for (var i = 0; i < s.length; i++) {
    if (s[i] === ' ') continue;
    var c = glyphCanvas(s[i], color || PAL.white);
    if (scale === 1) g.drawImage(c, x + i * CW, y);
    else g.drawImage(c, x + i * CW * scale, y, 5 * scale, 8 * scale);
  }
}
function textW(s, scale) { return Math.max(0, String(s).length * CW - 1) * (scale || 1); }
function textC(s, cx, y, color, scale) { text(s, Math.round(cx - textW(s, scale) / 2), y, color, scale); }
function textOutline(s, x, y, color, outline) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { text(s, x + d[0], y + d[1], outline || PAL.ink); });
  text(s, x, y, color);
}
function wrap(s, cols) {
  var out = [];
  String(s).split('\n').forEach(function (para) {
    var line = '';
    para.split(' ').forEach(function (word) {
      if (!line.length) { line = word; return; }
      if (line.length + 1 + word.length <= cols) line += ' ' + word;
      else { out.push(line); line = word; }
    });
    out.push(line);
  });
  return out;
}

// Input: a queue of key events, with our own repeat for held movement and undo.
var Input = {
  queue: [], held: new Map(),
  REPEAT: { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, KeyZ: 1, Backspace: 1 },
  init: function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].indexOf(e.code) >= 0) e.preventDefault();
      Sound.unlock();
      if (e.repeat) return;
      var ev = { key: e.key.length === 1 ? e.key.toLowerCase() : e.key, code: e.code, shift: e.shiftKey };
      self.queue.push(ev);
      if (self.REPEAT[e.code]) self.held.set(e.code, { ev: ev, next: performance.now() + 220 });
    });
    window.addEventListener('keyup', function (e) { self.held.delete(e.code); });
    window.addEventListener('blur', function () { self.held.clear(); });
    cv.addEventListener('mousedown', function () { Sound.unlock(); });
  },
  update: function () {
    var now = performance.now(), self = this;
    this.held.forEach(function (h) { if (now >= h.next) { self.queue.push(h.ev); h.next = now + 120; } });
  },
};
function dirOf(ev) {
  switch (ev.code) {
    case 'ArrowUp': case 'KeyW': return 0;
    case 'ArrowRight': case 'KeyD': return 1;
    case 'ArrowDown': case 'KeyS': return 2;
    case 'ArrowLeft': case 'KeyA': return 3;
  }
  return -1;
}
function isOk(ev) { return ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'NumpadEnter'; }
function isBack(ev) { return ev.code === 'Escape'; }

// Sound: one AudioContext for effects and music. Effects play into Sound.bus. Sound.bus and the music's bus both pass
// through Sound.master, and muting closes the master so sounds that are already ringing stop too.
var Sound = {
  ctx: null, bus: null, master: null, area: null, _muted: false, _white: null,
  get muted() { return this._muted; },
  set muted(m) {
    this._muted = !!m;
    if (this.master) this.master.gain.setTargetAtTime(this._muted ? 0 : 1, this.ctx.currentTime, 0.015);
  },
  unlock: function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      var a = new (window.AudioContext || window.webkitAudioContext)();
      this.master = a.createGain();
      this.master.gain.value = this._muted ? 0 : 1;
      this.master.connect(a.destination);
      this.bus = a.createGain();
      this.bus.connect(this.master);
      this.ctx = a;
    } catch (e) { this.ctx = this.master = this.bus = null; }
  },

  // Keys as [MIDI root, scale steps], matching the music: one per area, and D major for Tilde's theme.
  KEYS: [
    [58, [0, 2, 4, 5, 7, 9, 11]], [60, [0, 2, 3, 5, 7, 8, 11]], [61, [0, 1, 3, 5, 7, 8, 10]], [64, [0, 2, 4, 6, 7, 9, 11]],
    [66, [0, 2, 3, 5, 7, 8, 10]], [62, [0, 2, 3, 5, 7, 9, 10]], [63, [0, 2, 4, 5, 7, 9, 11]], [56, [0, 2, 4, 5, 7, 9, 11]],
    [65, [0, 2, 4, 5, 7, 9, 11]], [57, [0, 2, 3, 5, 7, 9, 10]], [59, [0, 2, 4, 5, 7, 9, 10]],
    [55, [0, 2, 3, 5, 7, 8, 11]], [63, [0, 2, 3, 5, 7, 8, 10]], [62, [0, 2, 3, 5, 7, 8, 11]], [61, [0, 2, 4, 5, 7, 9, 11]],
    [62, [0, 1, 3, 5, 7, 8, 10]], [55, [0, 2, 4, 5, 7, 9, 11]],
  ],
  TITLE_KEY: [62, [0, 2, 4, 5, 7, 9, 11]],
  setArea: function (i) { this.area = this.KEYS[i] ? i : null; },
  // Effects follow the track that is playing when it is not an area's: Tilde's theme and the ending are in D, and the
  // boss fights and the finale use Head Office's notes wherever their level sits.
  key: function () {
    var track = typeof Music !== 'undefined' && Music && Music.current ? Music.current() : null;
    if (track === 'boss' || track === 'postboss' || track === 'final') return this.KEYS[6];
    return track !== 'title' && track !== 'ending' && this.KEYS[this.area] ? this.KEYS[this.area] : this.TITLE_KEY;
  },
  // Frequency of scale degree d, oct octaves above the root of key k (the current key by default).
  note: function (d, oct, k) {
    k = k || this.key();
    var n = k[1].length, o = Math.floor(d / n);
    return 440 * Math.pow(2, (k[0] + k[1][d - o * n] + 12 * ((oct || 0) + o) - 69) / 12);
  },

  // A voice is {type, from, to, dur, gain, delay, attack, filter, hp}: an oscillator type or 'noise', a pitch sweep in
  // Hz, seconds, peak gain, the seconds it takes to reach the peak, and low-pass and high-pass cutoffs in Hz.
  play: function (voices) {
    var a = this.ctx;
    if (!a || this._muted || !voices) return;
    var now = a.currentTime;
    for (var i = 0; i < voices.length; i++) {
      try { this.voice(a, voices[i], now); } catch (e) { /* one bad voice must not silence the rest */ }
    }
  },
  voice: function (a, v, now) {
    var t = now + (v.delay || 0), dur = Math.max(0.01, v.dur), env = a.createGain(), src, node, lp = v.filter;
    // The gate starts closed, because a source can start one sample before the gate's first scheduled value applies.
    env.gain.value = 0;
    if (v.type === 'noise') {
      src = a.createBufferSource();
      src.buffer = this.white(a);
      src.loop = true;
      env.gain.setValueCurveAtTime(this.fade(v.gain, (v.attack || 0) / dur), t, dur);
    } else {
      src = a.createOscillator();
      src.type = v.type;
      src.frequency.setValueAtTime(v.from, t);
      if (v.to && v.to !== v.from) src.frequency.exponentialRampToValueAtTime(Math.max(20, v.to), t + dur);
      // Squares and saws lose their harshest overtones even when a voice sets no cutoff of its own.
      if (!lp && (v.type === 'square' || v.type === 'sawtooth')) lp = Math.min(6000, Math.max(1200, 4 * Math.max(v.from, v.to || 0)));
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(v.gain, t + (v.attack || 0.004));
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    node = src;
    if (lp) node = this.filter(a, node, 'lowpass', lp);
    if (v.hp) node = this.filter(a, node, 'highpass', v.hp);
    node.connect(env);
    env.connect(this.bus);
    if (v.type === 'noise') src.start(t, Math.random() * 0.9); else src.start(t);
    src.stop(t + dur + 0.03);
  },
  filter: function (a, node, type, f) {
    var b = a.createBiquadFilter();
    b.type = type; b.frequency.value = f;
    node.connect(b);
    return b;
  },
  white: function (a) {
    if (!this._white) {
      var b = a.createBuffer(1, a.sampleRate, a.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._white = b;
    }
    return this._white;
  },
  // Noise rises in a straight line over the first `rise` of its length, then fades to silence along a square curve.
  fade: function (g, rise) {
    var c = new Float32Array(16), r = Math.max(0, Math.min(0.9, rise || 0));
    for (var i = 0; i < 16; i++) { var x = i / 15; c[i] = x < r ? g * x / r : g * Math.pow((1 - x) / (1 - r), 2); }
    return c;
  },

  // One speech blip per letter, pitched from the current key by the letter. Tilde is a soft high triangle that glides
  // on a tilde, and Pilcrow a short low square.
  talk: function (ch, who) {
    if (!this.ctx || this._muted || !ch || !/[A-Za-z0-9~]/.test(ch)) return;
    var code = ch.toLowerCase().charCodeAt(0);
    if (who === 'TILDE') {
      var d = [2, 4, 7, 5, 4, 9, 7][code % 7], lo = this.note(d, 1), hi = this.note(d + 2, 1);
      if (ch === '~') this.play([{ type: 'triangle', from: lo, to: hi, dur: 0.07, gain: 0.02, attack: 0.012 }, { type: 'triangle', from: hi, to: lo, dur: 0.08, gain: 0.018, delay: 0.07 }]);
      else this.play([{ type: 'triangle', from: lo, dur: 0.06, gain: 0.02, attack: 0.012 }]);
    } else {
      this.play([{ type: 'square', from: this.note([0, 4, 2, 0, 4, 3, 1][code % 7], 0), dur: 0.03, gain: 0.015, filter: 1800 }]);
    }
  },

  // Single tones, noises, and runs, for callers outside the effects table.
  tone: function (type, f0, f1, dur, vol, delay, attack) { this.play([{ type: type, from: f0, to: f1, dur: dur, gain: vol, delay: delay, attack: attack }]); },
  noise: function (dur, vol, delay, lp, hp) { this.play([{ type: 'noise', dur: dur, gain: vol, delay: delay, filter: lp, hp: hp }]); },
  arp: function (notes, type, step, dur, vol) {
    this.play(notes.map(function (f, i) { return { type: type, from: f, dur: dur, gain: vol, delay: i * step }; }));
  },
};
function rnd(a, b) { return a + Math.random() * (b - a); }

// Every effect as a list of voices, or a function of the effect's argument that returns one. Pitched effects take
// scale degrees in the current key.
var SFX = (function () {
  var nt = function (d, oct) { return Sound.note(d, oct); };
  var C_MAJOR = [60, [0, 2, 4, 5, 7, 9, 11]];
  var glintAt = -1, glintN = 0, turnAt = {}, turnN = {};
  // Every call the game makes in one turn arrives at the same audio time. A call within 50 ms of the last call of the
  // same name belongs to the same turn, and this returns its place in that turn, from 0.
  function inTurn(name) {
    var now = Sound.ctx ? Sound.ctx.currentTime : 0;
    var k = turnAt[name] !== undefined && now - turnAt[name] < 0.05 ? turnN[name] + 1 : 0;
    turnAt[name] = now; turnN[name] = k;
    return k;
  }
  function seq(type, freqs, step, dur, gain, filter) {
    return freqs.map(function (f, i) { return { type: type, from: f, dur: dur, gain: gain, delay: i * step, filter: filter }; });
  }
  return {
    step: function () { return [{ type: 'triangle', from: rnd(300, 330), to: 180, dur: 0.05, gain: 0.035 }, { type: 'noise', dur: 0.025, gain: 0.012, filter: 3000 }]; },
    bump: [{ type: 'sine', from: 110, to: 70, dur: 0.08, gain: 0.06 }, { type: 'noise', dur: 0.04, gain: 0.02, filter: 600 }],
    pick: function (slot) { var s = slot || 0; return seq('square', [nt(4 + s, 1), nt(8 + s, 1)], 0.05, 0.07, 0.025, 3600); },
    drop: function (slot) {
      var s = slot || 0;
      return seq('square', [nt(5 + s, 1), nt(2 + s, 1)], 0.05, 0.07, 0.022, 3600).concat([{ type: 'triangle', from: 200, to: 120, dur: 0.06, gain: 0.03, delay: 0.08 }]);
    },
    zap: [{ type: 'sawtooth', from: 1800, to: 400, dur: 0.12, gain: 0.022, filter: 3200 }, { type: 'square', from: 2400, dur: 0.03, gain: 0.012, delay: 0.02, filter: 5000 }],
    // A rising triad and its octave: the Ram's on the tonic, the Fork's on the fourth, the brick's on the sixth below.
    compile: function (k) {
      var r = k === 'fork' ? 3 : k === 'brick' ? -2 : 0;
      return seq('square', [nt(r, 0), nt(r + 2, 0), nt(r + 4, 0), nt(r + 7, 0)], 0.045, 0.08, 0.028, 2400)
        .concat(seq('triangle', [nt(r + 7, 0), nt(r + 11, 0)], 0.09, 0.12, 0.03));
    },
    fizzle: [{ type: 'sawtooth', from: 420, to: 90, dur: 0.16, gain: 0.025, filter: 1600 }, { type: 'noise', dur: 0.08, gain: 0.015, filter: 1800 }],
    spot: function () { return seq('square', [nt(6, 1), nt(9, 1)], 0.04, 0.06, 0.025, 4000); },
    roll: function () {
      return [{ type: 'triangle', from: rnd(70, 85), to: 55, dur: 0.1, gain: 0.06 }, { type: 'sine', from: rnd(44, 50), to: 36, dur: 0.14, gain: 0.04 }, { type: 'noise', dur: 0.1, gain: 0.025, filter: 380 }];
    },
    smash: [{ type: 'noise', dur: 0.35, gain: 0.07, filter: 2500 }, { type: 'sine', from: 120, to: 40, dur: 0.25, gain: 0.075 }, { type: 'noise', dur: 0.12, gain: 0.04, delay: 0.08, filter: 6000, hp: 2000 }],
    fill: [{ type: 'triangle', from: 500, to: 80, dur: 0.3, gain: 0.05 }, { type: 'sine', from: 90, to: 50, dur: 0.2, gain: 0.1, delay: 0.28 }, { type: 'noise', dur: 0.1, gain: 0.04, delay: 0.28, filter: 500 }],
    // The Fork's fuse: with less of it left the ticks come in larger groups, closer together, and two degrees higher.
    tick: function (left) {
      var l = typeof left === 'number' && isFinite(left) ? Math.max(1, Math.min(3, Math.round(left))) : 2, out = [];
      for (var i = 0; i < 4 - l; i++) out.push({ type: 'square', from: nt(7 + 2 * (3 - l), 1), dur: 0.03, gain: i ? 0.02 : 0.025, delay: i * (0.04 + 0.035 * l), filter: 5000 });
      return out;
    },
    boom: [{ type: 'noise', dur: 0.7, gain: 0.08, filter: 1600 }, { type: 'sine', from: 110, to: 28, dur: 0.6, gain: 0.075 }, { type: 'noise', dur: 0.25, gain: 0.04, delay: 0.05, filter: 8000, hp: 3000 }],
    hit: [{ type: 'noise', dur: 0.06, gain: 0.07, filter: 4000 }, { type: 'square', from: 220, to: 90, dur: 0.08, gain: 0.04, filter: 1400 }],
    hurt: [{ type: 'sawtooth', from: 300, to: 70, dur: 0.22, gain: 0.05, filter: 1800 }, { type: 'noise', dur: 0.12, gain: 0.06, filter: 2000 }],
    // A husk's deflating sales chirp: a two-note fanfare, then the pitch sags out of it with a puff of air.
    huskdie: function () {
      return seq('triangle', [nt(4, 1), nt(7, 1)], 0.06, 0.08, 0.03).concat([
        { type: 'square', from: nt(7, 1), to: nt(0, -1), dur: 0.45, gain: 0.03, delay: 0.12, filter: 1400 },
        { type: 'noise', dur: 0.35, gain: 0.02, delay: 0.12, filter: 900 },
      ]);
    },
    push: [{ type: 'noise', dur: 0.12, gain: 0.04, filter: 900 }, { type: 'triangle', from: 120, to: 100, dur: 0.1, gain: 0.04 }],
    undo: function () { return [{ type: 'triangle', from: nt(2, 1), to: nt(5, 0), dur: 0.06, gain: 0.03 }]; },
    select: function () { return [{ type: 'square', from: nt(6, 1), dur: 0.03, gain: 0.018, filter: 3500 }]; },
    ok: function () { return seq('square', [nt(0, 1), nt(4, 1)], 0.05, 0.06, 0.025, 3200); },
    back: function () { return seq('square', [nt(4, 1), nt(0, 1)], 0.05, 0.06, 0.02, 3200); },
    // Always C major, the key of the clear jingle that plays with it.
    chip: function () { return seq('square', [0, 2, 4, 7].map(function (d) { return Sound.note(d, 2, C_MAJOR); }), 0.06, 0.1, 0.03, 5000); },
    aim: function () { return [{ type: 'square', from: nt(2, 2), to: nt(4, 2), dur: 0.05, gain: 0.018, filter: 5000 }]; },

    // Pinger: a bright blip whose tail falls an octave, and the packet popping on whatever stops it.
    fire: function () {
      return [
        { type: 'square', from: nt(4, 2), dur: 0.035, gain: 0.022, filter: 5000 },
        { type: 'triangle', from: nt(4, 2), to: nt(4, 1), dur: 0.16, gain: 0.014, delay: 0.025 },
        { type: 'noise', dur: 0.02, gain: 0.012, filter: 9000, hp: 4000 },
      ];
    },
    pop: [{ type: 'sine', from: 900, to: 220, dur: 0.05, gain: 0.03 }, { type: 'noise', dur: 0.03, gain: 0.02, filter: 3000 }],
    // A glassy ting. Bounces in the same turn arrive at one instant, so each one counts up, rises, and sounds a little later.
    glint: function (n) {
      var now = Sound.ctx ? Sound.ctx.currentTime : 0;
      if (typeof n !== 'number' || !isFinite(n)) n = now - glintAt < 0.05 ? glintN + 1 : 0;
      glintAt = now; glintN = n;
      var k = Math.max(0, Math.min(5, Math.round(n))), d = [4, 6, 7, 9, 11, 14][k];
      return [
        { type: 'sine', from: nt(d, 1), dur: 0.4, gain: 0.03, delay: k * 0.07 },
        { type: 'triangle', from: nt(d + 4, 1), dur: 0.12, gain: 0.01, delay: k * 0.07 },
      ];
    },
    // Display glass: high noise and four shards of the scale, with no low thud.
    shatter: function () {
      var out = [{ type: 'noise', dur: 0.28, gain: 0.05, filter: 10000, hp: 3000 }, { type: 'noise', dur: 0.08, gain: 0.03, filter: 5000, hp: 1200 }];
      for (var i = 0; i < 4; i++) out.push({ type: 'triangle', from: nt(7 + Math.floor(rnd(0, 7)), 1), dur: 0.09, gain: 0.014, delay: 0.03 + i * 0.045 + rnd(0, 0.02) });
      return out;
    },
    // Pilcrow and the swapper trade places, and so do the two tones: the round one rises as the square one falls.
    swap: function () {
      return [
        { type: 'noise', dur: 0.22, gain: 0.03, attack: 0.09, filter: 2600, hp: 500 },
        { type: 'triangle', from: nt(0, 1), to: nt(7, 1), dur: 0.16, gain: 0.022 },
        { type: 'square', from: nt(7, 1), to: nt(0, 1), dur: 0.16, gain: 0.014, filter: 2400 },
      ];
    },
    overclock: function () {
      return [
        { type: 'sawtooth', from: nt(0, 0), to: nt(7, 1), dur: 0.24, gain: 0.03, filter: 2600 },
        { type: 'square', from: nt(0, -1), to: nt(7, 0), dur: 0.24, gain: 0.02, filter: 1600 },
        { type: 'square', from: nt(7, 1), dur: 0.05, gain: 0.02, delay: 0.24, filter: 4000 },
      ];
    },

    // Husks. A shield clank is two inharmonic tones, so it belongs to no key. A Hoarder crunches and rings up the sale.
    clank: [
      { type: 'square', from: 1650, to: 1600, dur: 0.09, gain: 0.018, filter: 6000 },
      { type: 'square', from: 2330, to: 2280, dur: 0.07, gain: 0.012, filter: 6000 },
      { type: 'noise', dur: 0.04, gain: 0.03, filter: 8000, hp: 2500 },
      { type: 'sine', from: 170, to: 120, dur: 0.06, gain: 0.03 },
    ],
    eat: function () {
      return [
        { type: 'noise', dur: 0.07, gain: 0.05, filter: 2500 },
        { type: 'noise', dur: 0.06, gain: 0.04, delay: 0.06, filter: 3500 },
        { type: 'square', from: 140, to: 90, dur: 0.08, gain: 0.025, filter: 700 },
        { type: 'sine', from: nt(4, 2), dur: 0.35, gain: 0.025, delay: 0.12 },
        { type: 'triangle', from: nt(9, 2), dur: 0.25, gain: 0.012, delay: 0.12 },
      ];
    },
    turn: function () { return [{ type: 'triangle', from: nt(2, 2), to: nt(4, 2), dur: 0.045, gain: 0.012 }]; },
    hunt: function () { return [{ type: 'square', from: nt(4, 1), to: nt(5, 1), dur: 0.035, gain: 0.012, filter: 2400 }, { type: 'noise', dur: 0.02, gain: 0.008, filter: 1500 }]; },

    // Machines. The printer chatters and tears. The belt plays every turn, so it stays near silent.
    print: function () {
      var out = [{ type: 'square', from: 95, to: 100, dur: 0.18, gain: 0.012, filter: 380 }];
      for (var i = 0; i < 7; i++) out.push({ type: 'noise', dur: 0.016, gain: 0.022, delay: i * 0.024, filter: 7000, hp: 2200 });
      out.push({ type: 'noise', dur: 0.05, gain: 0.02, delay: 0.19, filter: 4000, hp: 1500 });
      return out;
    },
    carry: function () { return [{ type: 'triangle', from: nt(0, -1), dur: 0.3, gain: 0.012, attack: 0.08 }, { type: 'noise', dur: 0.25, gain: 0.006, attack: 0.08, filter: 450 }]; },
    // A sliding door: a swish and two tones, rising as it opens and falling as it closes.
    door: function (open) {
      var a = nt(2, 1), b = nt(4, 1);
      return [
        { type: 'noise', dur: 0.3, gain: 0.025, attack: 0.12, filter: 2000, hp: 400 },
        { type: 'triangle', from: open === false ? b : a, dur: 0.12, gain: 0.018 },
        { type: 'triangle', from: open === false ? a : b, dur: 0.16, gain: 0.018, delay: 0.1 },
      ];
    },

    // A boss's telegraph, every turn of a fight. A slam is a tritone alarm, a step a low double knock, and a hire a
    // preview of the doorbell. Any action without a cue of its own gets one soft tone.
    bosstel: function (kind) {
      if (kind === 'slam') return seq('square', [nt(6, 1), nt(3, 1), nt(6, 1), nt(3, 1)], 0.11, 0.09, 0.03, 2600);
      if (kind === 'step') return seq('square', [nt(0, 0), nt(0, 0)], 0.14, 0.08, 0.025, 1200);
      if (kind === 'hire') return seq('triangle', [nt(4, 1), nt(2, 1)], 0.12, 0.14, 0.025);
      // The Fry Cook's grease is a wet drip and a smaller one after it, and its charge an engine revving twice.
      if (kind === 'grease') {
        return [
          { type: 'sine', from: nt(2, 1), to: nt(7, 1), dur: 0.05, gain: 0.02 },
          { type: 'noise', dur: 0.02, gain: 0.006, filter: 3000, hp: 800 },
          { type: 'sine', from: nt(4, 1), to: nt(9, 1), dur: 0.04, gain: 0.012, delay: 0.14 },
        ];
      }
      if (kind === 'charge') {
        return [
          { type: 'sawtooth', from: 50, to: 85, dur: 0.12, gain: 0.02, filter: 600 },
          { type: 'sawtooth', from: 55, to: 110, dur: 0.16, gain: 0.022, delay: 0.13, filter: 700 },
        ];
      }
      // The High Score's relink is a relay ticking over, and its warp a short shimmer rising up the scale.
      if (kind === 'relink') {
        return [
          { type: 'noise', dur: 0.012, gain: 0.022, filter: 9000, hp: 3000 },
          { type: 'square', from: nt(4, 2), dur: 0.02, gain: 0.008, filter: 5000 },
          { type: 'noise', dur: 0.012, gain: 0.014, delay: 0.06, filter: 9000, hp: 3000 },
        ];
      }
      if (kind === 'warp') {
        return seq('triangle', [nt(7, 1), nt(9, 1), nt(11, 1)], 0.035, 0.05, 0.012).concat([
          { type: 'sine', from: nt(4, 1), to: nt(11, 1), dur: 0.18, gain: 0.01 },
          { type: 'noise', dur: 0.16, gain: 0.006, attack: 0.08, filter: 11000, hp: 6000 },
        ]);
      }
      // The Gardener's sow is a rattle of seeds in a packet, and its spray a nozzle hissing open.
      if (kind === 'sow') {
        var rattle = [];
        for (var i = 0; i < 5; i++) rattle.push({ type: 'noise', dur: 0.01, gain: 0.014, delay: i * 0.03, filter: 9000, hp: 3500 });
        return rattle;
      }
      if (kind === 'spray') return [{ type: 'noise', dur: 0.2, gain: 0.014, attack: 0.06, filter: 9000, hp: 3500 }];
      // The Mainframe's fire is a whine charging up a fifth, and its reboot a short boot chime after a self-test beep.
      if (kind === 'fire') {
        return [
          { type: 'sine', from: nt(0, 1), to: nt(4, 1), dur: 0.25, gain: 0.012, attack: 0.2 },
          { type: 'triangle', from: nt(0, 2), to: nt(4, 2), dur: 0.25, gain: 0.006, attack: 0.2 },
        ];
      }
      if (kind === 'reboot') return seq('square', [nt(0, 2)], 0, 0.03, 0.01, 4000).concat(seq('triangle', [nt(4, 1), nt(7, 1)], 0.08, 0.09, 0.016).map(function (v) { v.delay += 0.06; return v; }));
      // The Valet's park is its keys jingling and its magnets a hum swelling in. The Usher's crack is a creak. The
      // Jack's spring is a coil tightening in three hops, and its wind a crank clicking.
      if (kind === 'park') return seq('triangle', [nt(7, 2), nt(9, 2), nt(7, 2)], 0.06, 0.04, 0.009);
      if (kind === 'magnets') return [{ type: 'sawtooth', from: 55, to: 70, dur: 0.25, gain: 0.012, attack: 0.15, filter: 400 }];
      if (kind === 'crack') return [{ type: 'sawtooth', from: 90, to: 125, dur: 0.22, gain: 0.012, attack: 0.05, filter: 700 }, { type: 'noise', dur: 0.01, gain: 0.01, delay: 0.2, filter: 8000, hp: 3000 }];
      if (kind === 'spring') return seq('triangle', [nt(0, 1), nt(2, 1), nt(4, 1)], 0.07, 0.05, 0.012).concat([{ type: 'noise', dur: 0.01, gain: 0.008, delay: 0.2, filter: 6000, hp: 2000 }]);
      if (kind === 'wind') return seq('square', [nt(0, 2), nt(0, 2), nt(0, 2)], 0.08, 0.02, 0.01, 4000);
      return [{ type: 'triangle', from: nt(4, 1), dur: 0.12, gain: 0.015 }];
    },
    // The loudest effect. Its crack and second wave wait until the first two voices have fallen, so the sum stays capped.
    slam: [
      { type: 'noise', dur: 0.9, gain: 0.085, filter: 1100 },
      { type: 'sine', from: 85, to: 28, dur: 0.8, gain: 0.09 },
      { type: 'triangle', from: 55, to: 30, dur: 0.7, gain: 0.06, delay: 0.12 },
      { type: 'noise', dur: 0.2, gain: 0.03, delay: 0.15, filter: 9000, hp: 3000 },
    ],
    bossstep: [
      { type: 'sine', from: 75, to: 42, dur: 0.28, gain: 0.08 },
      { type: 'noise', dur: 0.14, gain: 0.05, filter: 320 },
      { type: 'noise', dur: 0.07, gain: 0.012, delay: 0.04, filter: 7000, hp: 3000 },
    ],
    hire: function () {
      return [
        { type: 'sine', from: nt(2, 1), dur: 0.5, gain: 0.035 },
        { type: 'sine', from: nt(9, 1), dur: 0.3, gain: 0.01 },
        { type: 'sine', from: nt(0, 1), dur: 0.7, gain: 0.035, delay: 0.32 },
        { type: 'sine', from: nt(7, 1), dur: 0.4, gain: 0.01, delay: 0.32 },
      ];
    },
    bosshit: function () {
      return [
        { type: 'noise', dur: 0.1, gain: 0.06, filter: 2500 },
        { type: 'sine', from: 130, to: 60, dur: 0.14, gain: 0.07 },
        { type: 'sawtooth', from: nt(4, 0), to: nt(0, 0), dur: 0.22, gain: 0.035, delay: 0.04, filter: 1300 },
      ];
    },
    // Half HP: a run up the scale that speeds up as it climbs, landing on the octave over the low root.
    phase: function () {
      var out = [], t = 0;
      for (var i = 0; i < 8; i++) { out.push({ type: 'square', from: nt(i, 1), dur: 0.07, gain: 0.02 + i * 0.002, delay: t, filter: 3000 }); t += 0.1 - i * 0.009; }
      return out.concat([{ type: 'triangle', from: nt(7, 1), dur: 0.35, gain: 0.03, delay: t }, { type: 'sine', from: nt(0, -1), dur: 0.45, gain: 0.05, delay: t }]);
    },
    // The Manager falls: a fanfare that never finishes, a long sag, crumbling, and the thud.
    bossdie: function () {
      return seq('triangle', [nt(4, 1), nt(7, 1), nt(9, 1)], 0.08, 0.1, 0.03).concat([
        { type: 'sawtooth', from: nt(9, 1), to: nt(0, -2), dur: 1.2, gain: 0.04, delay: 0.24, filter: 1500 },
        { type: 'square', from: nt(4, 0), to: nt(4, -2), dur: 1.1, gain: 0.02, delay: 0.24, filter: 900 },
        { type: 'noise', dur: 1.0, gain: 0.05, attack: 0.4, delay: 0.3, filter: 900 },
        { type: 'sine', from: 80, to: 30, dur: 0.6, gain: 0.09, delay: 1.35 },
        { type: 'noise', dur: 0.4, gain: 0.06, delay: 1.35, filter: 1200 },
      ]);
    },

    // Wing bosses. A crate lands with a wooden thud and a rattle.
    stack: [
      { type: 'sine', from: 140, to: 70, dur: 0.15, gain: 0.07 },
      { type: 'noise', dur: 0.1, gain: 0.05, filter: 900 },
      { type: 'noise', dur: 0.04, gain: 0.015, delay: 0.03, filter: 6000, hp: 2000 },
    ],
    // The Warden's beam: two lanes a fifth apart, bright saws over a sizzle, rising out of a zap.
    beam: function () {
      return [
        { type: 'sawtooth', from: nt(7, 2), to: nt(0, 1), dur: 0.06, gain: 0.025, filter: 5000 },
        { type: 'sawtooth', from: nt(0, 1), dur: 0.45, gain: 0.03, delay: 0.05, filter: 4500 },
        { type: 'sawtooth', from: nt(4, 1), dur: 0.45, gain: 0.025, delay: 0.05, filter: 4500 },
        { type: 'noise', dur: 0.45, gain: 0.03, delay: 0.05, attack: 0.05, filter: 10000, hp: 4000 },
      ];
    },
    bossturn: [
      { type: 'sawtooth', from: 70, to: 55, dur: 0.3, gain: 0.04, filter: 600 },
      { type: 'noise', dur: 0.35, gain: 0.04, attack: 0.1, filter: 500 },
      { type: 'sine', from: 90, to: 60, dur: 0.12, gain: 0.06, delay: 0.28 },
    ],
    // An engine revving up under the clatter of treads.
    bossdrive: function () {
      var out = [
        { type: 'sawtooth', from: 55, to: 110, dur: 0.5, gain: 0.035, filter: 700 },
        { type: 'square', from: 55, to: 110, dur: 0.5, gain: 0.02, filter: 400 },
      ];
      for (var i = 0; i < 8; i++) out.push({ type: 'noise', dur: 0.02, gain: 0.02, delay: 0.02 + i * 0.055, filter: 6000, hp: 1500 });
      return out;
    },
    // A long whistling fall, then a crash far below, muffled by the distance.
    bossfall: function () {
      return [
        { type: 'sine', from: nt(7, 2), to: nt(0, 0), dur: 1.0, gain: 0.03 },
        { type: 'noise', dur: 0.5, gain: 0.06, delay: 1.1, filter: 1500 },
        { type: 'sine', from: 90, to: 35, dur: 0.4, gain: 0.06, delay: 1.1 },
        { type: 'noise', dur: 0.2, gain: 0.025, delay: 1.15, filter: 5000, hp: 2500 },
      ];
    },
    // Every belt clunks twice, and a motor whines down into reverse.
    flip: function () {
      return [
        { type: 'square', from: 160, to: 90, dur: 0.08, gain: 0.04, filter: 900 },
        { type: 'noise', dur: 0.06, gain: 0.04, filter: 1200 },
        { type: 'square', from: 130, to: 75, dur: 0.08, gain: 0.035, delay: 0.09, filter: 800 },
        { type: 'triangle', from: nt(4, 0), to: nt(0, 0), dur: 0.2, gain: 0.015, delay: 0.1 },
      ];
    },
    // Pilcrow's figure at speed, its square half then its round half, landing on the octave. Each card starts it on its
    // own degree, and gold adds a low octave and a sparkle.
    keycard: function (color) {
      var r = { black: -1, blue: 1, yellow: 2, silver: 3, gold: 4, green: 5, violet: 6, white: 7, copper: 8, pearl: 9, rainbow: 10 }[color] || 0;
      var out = seq('square', [nt(r, 1), nt(r, 1), nt(r + 4, 1)], 0.07, 0.07, 0.028, 4000)
        .concat(seq('triangle', [nt(r + 5, 1), nt(r + 4, 1), nt(r + 3, 1), nt(r + 4, 1)], 0.05, 0.06, 0.028).map(function (v) { v.delay += 0.21; return v; }))
        .concat([{ type: 'square', from: nt(r + 7, 1), dur: 0.3, gain: 0.03, delay: 0.43, filter: 4000 }]);
      if (color === 'gold') {
        out.push({ type: 'triangle', from: nt(r, 0), dur: 0.4, gain: 0.03, delay: 0.43 });
        out = out.concat(seq('triangle', [nt(r + 9, 1), nt(r + 11, 1), nt(r + 14, 1)], 0.04, 0.05, 0.012).map(function (v) { v.delay += 0.5; return v; }));
      }
      // Rainbow runs up six steps of the scale under its landing.
      if (color === 'rainbow') out = out.concat(seq('triangle', [7, 8, 9, 10, 11, 12].map(function (d) { return nt(d, 1); }), 0.035, 0.05, 0.01).map(function (v) { v.delay += 0.43; return v; }));
      return out;
    },
    // Through a doorway into a puzzle: a soft whoosh, a glide up a fifth, and a footstep landing.
    enter: function () {
      return [
        { type: 'noise', dur: 0.25, gain: 0.025, attack: 0.1, filter: 2200, hp: 300 },
        { type: 'triangle', from: nt(0, 1), to: nt(4, 1), dur: 0.18, gain: 0.02 },
        { type: 'sine', from: 120, to: 80, dur: 0.07, gain: 0.04, delay: 0.17 },
      ];
    },

    // The Food Court. Each tile of a slide on grease is a short slick whoosh, 50 ms after the tile before it in the same
    // turn, and a run past eight tiles goes quiet.
    slide: function () {
      var k = inTurn('slide');
      if (k > 7) return [];
      var out = [
        { type: 'noise', dur: 0.09, gain: 0.02, attack: 0.03, delay: k * 0.05, filter: 2400 + k * 250, hp: 700 },
        { type: 'noise', dur: 0.07, gain: 0.008, attack: 0.02, delay: k * 0.05 + 0.01, filter: 10000, hp: 5000 },
      ];
      if (!k) out.push({ type: 'sine', from: 200, to: 120, dur: 0.06, gain: 0.02 });
      return out;
    },
    // A microwave's soft hum and its ding. Several microwaves in one turn ding once.
    cook: function () {
      if (inTurn('cook')) return [];
      return [
        { type: 'triangle', from: nt(0, -1), dur: 0.3, gain: 0.012, attack: 0.06 },
        { type: 'square', from: nt(0, -2), dur: 0.28, gain: 0.005, attack: 0.06, filter: 300 },
        { type: 'sine', from: nt(4, 2), dur: 0.5, gain: 0.02, delay: 0.2 },
        { type: 'sine', from: nt(9, 2), dur: 0.25, gain: 0.005, delay: 0.2 },
      ];
    },
    // The Fry Cook flings grease: a wet splat, a spatter running down the lanes, rising droplets, and a sizzle.
    grease: function () {
      var out = [
        { type: 'noise', dur: 0.12, gain: 0.06, filter: 1600 },
        { type: 'sine', from: 170, to: 70, dur: 0.12, gain: 0.05 },
        { type: 'noise', dur: 0.7, gain: 0.03, attack: 0.15, delay: 0.1, filter: 11000, hp: 4500 },
      ];
      for (var i = 0; i < 4; i++) out.push({ type: 'noise', dur: 0.05, gain: 0.03 - i * 0.005, delay: 0.06 + i * 0.05, filter: 3200, hp: 700 });
      for (var j = 0; j < 3; j++) {
        var d = 7 + Math.floor(rnd(0, 7));
        out.push({ type: 'sine', from: nt(d, 1), to: nt(d + 2, 1), dur: 0.04, gain: 0.012, delay: 0.08 + j * 0.07 + rnd(0, 0.02) });
      }
      return out;
    },

    // The Arcade. A trip through a portal: a whoosh, a tone falling a fifth into the portal, and rising a fifth out of
    // its partner. Each trip in a turn starts a degree higher and sounds 60 ms after the last, and trips past the sixth
    // are silent.
    portal: function () {
      var k = inTurn('portal');
      if (k > 5) return [];
      var t = k * 0.06;
      return [
        { type: 'noise', dur: 0.09, gain: 0.012, attack: 0.04, delay: t, filter: 3200, hp: 500 },
        { type: 'triangle', from: nt(k + 4, 1), to: nt(k, 1), dur: 0.05, gain: 0.012, delay: t },
        { type: 'triangle', from: nt(k, 1), to: nt(k + 4, 1), dur: 0.06, gain: 0.012, delay: t + 0.05 },
      ];
    },
    // A token pays a gate: the coin bounces into the slot, two tones accept it, and the gate slides open onto a clunk.
    pay: function () {
      var out = [], t = 0;
      for (var i = 0; i < 4; i++) { out.push({ type: 'noise', dur: 0.015, gain: 0.03 - i * 0.005, delay: t, filter: 9000, hp: 3000 }); t += 0.05 - i * 0.008; }
      return out.concat([
        { type: 'triangle', from: nt(4, 1), dur: 0.08, gain: 0.025, delay: 0.16 },
        { type: 'triangle', from: nt(9, 1), dur: 0.22, gain: 0.025, delay: 0.22 },
        { type: 'noise', dur: 0.3, gain: 0.025, attack: 0.1, delay: 0.3, filter: 1500, hp: 200 },
        { type: 'triangle', from: nt(0, 0), to: nt(4, 0), dur: 0.25, gain: 0.02, delay: 0.3 },
        { type: 'sine', from: 110, to: 70, dur: 0.08, gain: 0.04, delay: 0.55 },
      ]);
    },
    // The High Score swaps the portals' pairs: two tones trade places across a relay click. The flip rises when the
    // pairs cross (link 1, the default) and falls when they swap back (link 0).
    relink: function (link) {
      var lo = nt(0, 1), hi = nt(4, 1), up = link !== 0 && link !== false;
      return [
        { type: 'noise', dur: 0.02, gain: 0.03, filter: 8000, hp: 2500 },
        { type: 'square', from: up ? lo : hi, dur: 0.09, gain: 0.025, delay: 0.01, filter: 3000 },
        { type: 'triangle', from: up ? hi : lo, dur: 0.09, gain: 0.015, delay: 0.01 },
        { type: 'noise', dur: 0.02, gain: 0.025, delay: 0.11, filter: 8000, hp: 2500 },
        { type: 'square', from: up ? hi : lo, dur: 0.14, gain: 0.025, delay: 0.11, filter: 3000 },
        { type: 'triangle', from: up ? lo : hi, dur: 0.14, gain: 0.015, delay: 0.11 },
      ];
    },
    // The cabinet switches off like a screen, its picture falling to a dot, and switches on across the room, landing
    // with a thud.
    bosswarp: function () {
      return [
        { type: 'sine', from: nt(7, 2), to: 120, dur: 0.18, gain: 0.04 },
        { type: 'noise', dur: 0.15, gain: 0.04, filter: 6000, hp: 1500 },
        { type: 'sine', from: 90, to: nt(7, 1), dur: 0.22, gain: 0.035, delay: 0.3 },
        { type: 'noise', dur: 0.2, gain: 0.035, attack: 0.15, delay: 0.3, filter: 4000, hp: 800 },
        { type: 'sine', from: 100, to: 50, dur: 0.15, gain: 0.07, delay: 0.52 },
        { type: 'noise', dur: 0.08, gain: 0.04, delay: 0.52, filter: 900 },
      ];
    },

    // The Garden Center. One sprinkler's jet: a faint hiss of water after a tick from the nozzle. Every sprinkler
    // sprays in the same instant, so each jet in a turn sounds 70 ms after the last, and jets past the fifth are silent.
    spray: function () {
      var k = inTurn('spray');
      if (k > 4) return [];
      return [
        { type: 'noise', dur: 0.012, gain: 0.006, delay: k * 0.07, filter: 9000, hp: 4000 },
        { type: 'noise', dur: 0.14, gain: 0.008, attack: 0.03, delay: k * 0.07, filter: 7000, hp: 2500 },
      ];
    },
    // A seed bursts into a vine: a bloop, a leafy rustle, and a tone unfurling up a fifth. Sprouts in one turn come
    // 80 ms apart.
    sprout: function () {
      var k = inTurn('sprout');
      if (k > 3) return [];
      var t = k * 0.08;
      return [
        { type: 'sine', from: nt(0, 0), to: nt(4, 1), dur: 0.06, gain: 0.025, delay: t },
        { type: 'noise', dur: 0.15, gain: 0.015, attack: 0.04, delay: t + 0.03, filter: 2500, hp: 700 },
        { type: 'triangle', from: nt(0, 1), to: nt(4, 1), dur: 0.18, gain: 0.018, delay: t + 0.05 },
      ];
    },
    // A vine grows a tile: a soft rustle and a short glide up a third. It can sound every turn, so it stays quiet, and
    // each growth in one turn comes 60 ms after the last and a degree higher.
    grow: function () {
      var k = inTurn('grow');
      if (k > 3) return [];
      var t = k * 0.06;
      return [
        { type: 'noise', dur: 0.09, gain: 0.007, attack: 0.03, delay: t, filter: 2500, hp: 700 },
        { type: 'triangle', from: nt(2 + k, 1), to: nt(4 + k, 1), dur: 0.09, gain: 0.01, delay: t },
      ];
    },
    // A jet shoves something a tile: a slap of water and a soft thud. Shoves in one turn come 70 ms apart.
    shove: function () {
      var k = inTurn('shove');
      if (k > 3) return [];
      var t = k * 0.07;
      return [
        { type: 'noise', dur: 0.08, gain: 0.025, delay: t, filter: 2500, hp: 300 },
        { type: 'triangle', from: 150, to: 100, dur: 0.08, gain: 0.03, delay: t + 0.01 },
      ];
    },
    // The Gardener sows: a throw, and seeds pattering down on the floor of its lanes.
    sow: function () {
      var out = [{ type: 'noise', dur: 0.12, gain: 0.015, attack: 0.05, filter: 2500, hp: 500 }];
      for (var i = 0; i < 8; i++) out.push({ type: 'noise', dur: 0.01, gain: 0.018 - i * 0.0015, delay: 0.08 + i * 0.035 + rnd(0, 0.02), filter: 10000, hp: 4000 });
      return out;
    },

    // The Server Room. The switch flips: a click, then two short squares that rise when it turns on (1) and fall when
    // it turns off (0). Flips in one turn come 70 ms apart.
    toggle: function (on) {
      var k = inTurn('toggle');
      if (k > 3) return [];
      var t = k * 0.07, lo = nt(2, 1), hi = nt(6, 1), up = on === 1 || on === true;
      return [
        { type: 'noise', dur: 0.01, gain: 0.025, delay: t, filter: 9000, hp: 3000 },
        { type: 'square', from: up ? lo : hi, dur: 0.035, gain: 0.018, delay: t + 0.005, filter: 4000 },
        { type: 'square', from: up ? hi : lo, dur: 0.05, gain: 0.018, delay: t + 0.045, filter: 4000 },
      ];
    },
    // A bolt, packet, or jet splits: a bright note that forks into two, one gliding up a third and one down a third.
    // Splits in one turn come 50 ms apart, and past the sixth they are silent.
    split: function () {
      var k = inTurn('split');
      if (k > 5) return [];
      var t = k * 0.05;
      return [
        { type: 'noise', dur: 0.01, gain: 0.008, delay: t, filter: 10000, hp: 4000 },
        { type: 'triangle', from: nt(4, 2), to: nt(6, 2), dur: 0.08, gain: 0.01, delay: t },
        { type: 'sine', from: nt(4, 2), to: nt(2, 2), dur: 0.08, gain: 0.012, delay: t },
      ];
    },
    // The Mainframe fires a packet from each front cell: two bright blips 40 ms apart, each with a tail falling an
    // octave, over a low thump.
    bossfire: function () {
      var out = [{ type: 'sawtooth', from: 110, to: 55, dur: 0.12, gain: 0.03, filter: 500 }];
      for (var i = 0; i < 2; i++) {
        out.push({ type: 'square', from: nt(4, 2), dur: 0.035, gain: 0.022, delay: i * 0.04, filter: 5000 });
        out.push({ type: 'triangle', from: nt(4, 2), to: nt(4, 1), dur: 0.14, gain: 0.014, delay: i * 0.04 + 0.025 });
      }
      return out;
    },
    // The Mainframe reboots the switch: the power falls away with the fans, a relay clicks, and the power comes back
    // up into a two-note boot chime.
    reboot: function () {
      return [
        { type: 'sine', from: nt(7, 1), to: 60, dur: 0.3, gain: 0.035 },
        { type: 'noise', dur: 0.3, gain: 0.02, filter: 1200, hp: 200 },
        { type: 'noise', dur: 0.012, gain: 0.03, delay: 0.4, filter: 9000, hp: 3000 },
        { type: 'sine', from: 80, to: nt(0, 1), dur: 0.2, gain: 0.03, delay: 0.42 },
        { type: 'triangle', from: nt(4, 1), dur: 0.12, gain: 0.025, delay: 0.64 },
        { type: 'triangle', from: nt(7, 1), dur: 0.25, gain: 0.025, delay: 0.76 },
      ];
    },

    // The Parking Garage. A ramp throws something over the next tile: a glide up a fifth, a breath of air, and a soft
    // landing. Throws in one turn come 70 ms apart, and past the fourth they are silent.
    jump: function () {
      var k = inTurn('jump');
      if (k > 3) return [];
      var t = k * 0.07;
      return [
        { type: 'triangle', from: nt(0, 1), to: nt(4, 1), dur: 0.1, gain: 0.012, delay: t },
        { type: 'noise', dur: 0.1, gain: 0.007, attack: 0.04, delay: t, filter: 3000, hp: 800 },
        { type: 'sine', from: 120, to: 80, dur: 0.05, gain: 0.015, delay: t + 0.12 },
      ];
    },
    // A magnet tugs a metal daemon a tile: a low hum swelling and a faint clack. Every magnet pulls every turn, so it
    // stays quiet, and tugs in one turn come 60 ms apart.
    pull: function () {
      var k = inTurn('pull');
      if (k > 3) return [];
      var t = k * 0.06;
      return [
        { type: 'sawtooth', from: 60, to: 75, dur: 0.12, gain: 0.006, attack: 0.05, delay: t, filter: 300 },
        { type: 'noise', dur: 0.015, gain: 0.006, delay: t + 0.1, filter: 5000, hp: 1500 },
      ];
    },
    // The Valet parks a Brick beside you: a car's two-beep lock chirp, then the Brick thuds down.
    park: function () {
      return seq('square', [nt(4, 2), nt(4, 2)], 0.09, 0.05, 0.015, 5000).concat([
        { type: 'sine', from: 140, to: 65, dur: 0.15, gain: 0.07, delay: 0.2 },
        { type: 'noise', dur: 0.1, gain: 0.04, delay: 0.2, filter: 900 },
      ]);
    },
    // Every magnet switches: a relay clunk and a hum that rises as they come on.
    magnets: function () {
      return [
        { type: 'noise', dur: 0.02, gain: 0.03, filter: 6000, hp: 1500 },
        { type: 'square', from: 110, to: 60, dur: 0.08, gain: 0.03, filter: 600 },
        { type: 'sawtooth', from: 55, to: 110, dur: 0.35, gain: 0.02, attack: 0.15, delay: 0.05, filter: 500 },
      ];
    },
    // The Cinema. Cracked floor falls in: a crack, a crumble, and debris rattling away into the dark below.
    crumble: function () {
      var out = [{ type: 'noise', dur: 0.03, gain: 0.04, filter: 7000, hp: 2000 }, { type: 'noise', dur: 0.4, gain: 0.03, delay: 0.03, filter: 1200 }];
      for (var i = 0; i < 4; i++) out.push({ type: 'noise', dur: 0.03, gain: 0.02 - i * 0.004, delay: 0.15 + i * 0.09, filter: 4000, hp: 1000 });
      return out.concat([{ type: 'sine', from: 90, to: 40, dur: 0.3, gain: 0.03, delay: 0.1 }]);
    },
    // The Usher cracks the floor in its lanes: a sharp split and a crackle running away down them.
    crack: function () {
      var out = [{ type: 'noise', dur: 0.05, gain: 0.06, filter: 8000, hp: 2500 }, { type: 'sine', from: 160, to: 70, dur: 0.1, gain: 0.04 }];
      for (var i = 0; i < 4; i++) out.push({ type: 'noise', dur: 0.015, gain: 0.03 - i * 0.005, delay: 0.06 + i * 0.05, filter: 9000, hp: 3000 });
      return out;
    },
    // The Toy Store. A bumper throws something back: a note springing up a fifth and settling a step. Throws in one turn
    // come 60 ms apart, each a degree higher, and past the fourth they are silent.
    boing: function () {
      var k = inTurn('boing');
      if (k > 3) return [];
      var t = k * 0.06;
      return [
        { type: 'triangle', from: nt(k, 1), to: nt(k + 4, 1), dur: 0.05, gain: 0.016, delay: t },
        { type: 'triangle', from: nt(k + 4, 1), to: nt(k + 3, 1), dur: 0.12, gain: 0.012, delay: t + 0.05 },
        { type: 'noise', dur: 0.01, gain: 0.006, delay: t, filter: 6000, hp: 2000 },
      ];
    },
    // The Jack winds a toy out of its door: a key ratcheting up the scale, then a ping and a whir as it lets go.
    wind: function () {
      var out = [];
      for (var i = 0; i < 6; i++) out.push({ type: 'square', from: nt(i, 1), dur: 0.02, gain: 0.012, delay: i * 0.05, filter: 4000 });
      return out.concat([{ type: 'triangle', from: nt(7, 1), dur: 0.25, gain: 0.025, delay: 0.32 }, { type: 'noise', dur: 0.15, gain: 0.012, delay: 0.32, filter: 2500, hp: 600 }]);
    },
  };
})();
function sfx(name, arg) {
  var s = Object.prototype.hasOwnProperty.call(SFX, name) ? SFX[name] : null;
  if (s && Sound.ctx && !Sound.muted) Sound.play(typeof s === 'function' ? s(arg) : s);
}

function setMuted(m) {
  Sound.muted = m;
  if (window.Music && Music.setMuted) Music.setMuted(m);
  Save.data.muted = m;
  Save.store();
}
function music(name) { if (window.Music && Music.play) Music.play(name); }
function jingle(name) { if (window.Music && Music.jingle) Music.jingle(name); }
// Tilde's theme loses its static as chips come back.
function mend() { if (window.Music && Music.setMended) Music.setMended(Save.health()); }

function blankSave() { return { done: {}, seen: {}, cursor: 0, muted: false, keys: {}, world: null, time: 0 }; }
var Save = {
  KEY: 'checksum.v2',
  data: blankSave(),
  unsaved: 0,
  load: function () {
    try {
      var raw = localStorage.getItem(this.KEY);
      if (raw) { var d = JSON.parse(raw); for (var k in this.data) if (d[k] !== undefined) this.data[k] = d[k]; }
    } catch (e) { /* storage blocked: play without saving */ }
  },
  store: function () {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* storage blocked */ }
  },
  // Counts play time, and writes it every 10 seconds so a closed tab loses little.
  tick: function (dt) { this.data.time = (this.data.time || 0) + dt; this.unsaved += dt; if (this.unsaved >= 10) { this.unsaved = 0; this.store(); } },
  // Starts a new game and keeps only the mute setting.
  reset: function () { var muted = this.data.muted; this.data = blankSave(); this.data.muted = muted; this.unsaved = 0; this.store(); },
  chips: function () { var n = 0; for (var i = 0; i < LEVELS.length; i++) if (this.data.done[LEVELS[i].id]) n++; return n; },
  // Tilde's health counts the story's chips, so postgame levels never lower it, and beating the Static fills it.
  health: function () {
    if (this.data.seen.final) return 1;
    var n = 0, tot = 0;
    for (var i = 0; i < LEVELS.length; i++) if ((LEVELS[i].area || 0) < 16) { tot++; if (this.data.done[LEVELS[i].id]) n++; }
    return Math.min(0.95, n / Math.max(1, tot));
  },
};

// Scenes swap through a dithered wipe.
var Game = { scene: null, t: 0, shake: 0, wipe: 0, next: null };
function setScene(s, instant) {
  if (instant || !Game.scene) { Game.next = null; Game.wipe = 0; Game.scene = s; if (s.enter) s.enter(); return; }
  Game.next = s;
  Game.wipe = 0.0001;
}
