// Canvas, palette, pixel font, input, sound, and save helpers shared by every build.
var W = 384, H = 216;
var cv, g;

var PAL = {
  ink: '#120d1c', deep: '#0b0716', white: '#f4f0ff',
  cobalt: '#2b4cf0', cobaltDk: '#1a2a96', sky: '#7fb2ff',
  yellow: '#ffd23f', ochre: '#d18a12',
  red: '#ff3b4e', redDk: '#a3162f',
  pink: '#ff8fc7', magenta: '#c2309e',
  teal: '#2ee6c5', tealDk: '#127a72',
  lime: '#b4f03c', green: '#3c9a3a', orange: '#ff8a2a',
  g1: '#d6d0e6', g2: '#a49dba', g3: '#6e6788', g4: '#3e3856', g5: '#262038',
  band: ['#0b0716', '#160c2a', '#24103a', '#3a1448', '#5a1a52'],
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
// Fills with c2 where the 4x4 Bayer threshold is below level (0..16), c1 elsewhere.
function dither(x, y, w, h, c1, c2, level) {
  if (c1) rect(x, y, w, h, c1);
  g.fillStyle = c2;
  for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
    if (BAYER[((y + j) & 3) * 4 + ((x + i) & 3)] < level) g.fillRect(x + i, y + j, 1, 1);
  }
}

// Sprites are arrays of strings. Each character maps to a color through SPR_KEY, and '.' is clear.
var SPR_KEY = {
  k: PAL.ink, K: PAL.deep, w: PAL.white, B: PAL.cobalt, b: PAL.cobaltDk, c: PAL.sky,
  Y: PAL.yellow, y: PAL.ochre, R: PAL.red, r: PAL.redDk, P: PAL.pink, m: PAL.magenta,
  T: PAL.teal, t: PAL.tealDk, G: PAL.lime, n: PAL.green, O: PAL.orange,
  '1': PAL.g1, '2': PAL.g2, '3': PAL.g3, '4': PAL.g4, '5': PAL.g5,
};
var _sprCache = new Map();
function sprite(rows, recolor) {
  var key = rows.join('/') + (recolor ? JSON.stringify(recolor) : '');
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
    if (recolor && recolor[ch]) ch = recolor[ch];
    x2.fillStyle = SPR_KEY[ch] || ch;
    x2.fillRect(x, y, 1, 1);
  }
  _sprCache.set(key, c);
  return c;
}
function spr(rows, x, y, flip, recolor) {
  var c = sprite(rows, recolor);
  x = Math.round(x); y = Math.round(y);
  if (!flip) { g.drawImage(c, x, y); return; }
  g.save(); g.translate(x + c.width, y); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore();
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
  '[': ['.##.', '.#..', '.#..', '.#..', '.#..', '.##.'], ']': ['.##.', '..#.', '..#.', '..#.', '..#.', '.##.'],
  '-': ['....', '....', '....', '###.'], '+': ['....', '....', '.#..', '###.', '.#..'],
  '/': ['...#', '...#', '..#.', '.#..', '#...', '#...'], '=': ['....', '....', '###.', '....', '###.'],
  '<': ['....', '..#.', '.#..', '#...', '.#..', '..#.'], '>': ['....', '#...', '.#..', '..#.', '.#..', '#...'],
  '#': ['....', '#.#.', '####', '#.#.', '####', '#.#.'], '_': ['....', '....', '....', '....', '....', '....', '####'],
  '%': ['#..#', '...#', '..#.', '.#..', '#...', '#..#'], '~': ['....', '....', '.#.#', '#.#.'],
  '*': ['....', '....', '#.#.', '.#..', '#.#.'], '|': ['.#..', '.#..', '.#..', '.#..', '.#..', '.#..', '.#..'],
  // Arrows and marks on control characters: right, left, up, down, heart, dot.
  '\x01': ['....', '#...', '##..', '###.', '##..', '#...'], '\x02': ['....', '...#', '..##', '.###', '..##', '...#'],
  '\x03': ['....', '.#..', '###.', '####', '....', '....'], '\x04': ['....', '....', '####', '###.', '.#..', '....'],
  '\x05': ['....', '#.#.', '####', '####', '.##.', '.#..'], '\x06': ['....', '....', '.##.', '.##.', '....', '....'],
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
function textShadow(s, x, y, color, shadow) {
  text(s, x + 1, y + 1, shadow || PAL.ink);
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

// Early desktop window: beveled body and a solid title bar.
function panel(x, y, w, h, title, barColor, body) {
  rect(x, y, w, h, body || PAL.g2);
  rect(x, y, w, 1, PAL.g1); rect(x, y, 1, h, PAL.g1);
  rect(x, y + h - 1, w, 1, PAL.g4); rect(x + w - 1, y, 1, h, PAL.g4);
  frame(x - 1, y - 1, w + 2, h + 2, PAL.ink);
  if (title !== undefined) {
    rect(x + 2, y + 2, w - 4, 10, barColor || PAL.cobaltDk);
    text(title, x + 4, y + 3, PAL.white);
    rect(x + w - 11, y + 3, 8, 8, PAL.g2);
    frame(x + w - 11, y + 3, 8, 8, PAL.ink);
    rect(x + w - 9, y + 5, 1, 1, PAL.ink); rect(x + w - 6, y + 5, 1, 1, PAL.ink);
    rect(x + w - 8, y + 6, 2, 2, PAL.ink); rect(x + w - 9, y + 8, 1, 1, PAL.ink); rect(x + w - 6, y + 8, 1, 1, PAL.ink);
  }
}
function inset(x, y, w, h, body) {
  rect(x, y, w, h, body || PAL.g5);
  rect(x, y, w, 1, PAL.g4); rect(x, y, 1, h, PAL.g4);
  rect(x, y + h - 1, w, 1, PAL.g1); rect(x + w - 1, y, 1, h, PAL.g1);
}

// Input: a queue of key events with our own repeat for held movement and undo keys.
var Input = {
  queue: [], held: new Map(),
  REPEAT: { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, KeyZ: 1, Backspace: 1 },
  init: function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].indexOf(e.code) >= 0) e.preventDefault();
      Sound.unlock();
      if (e.repeat) return;
      var ev = { key: e.key.length === 1 ? e.key.toLowerCase() : e.key, code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey };
      self.queue.push(ev);
      if (self.REPEAT[e.code]) self.held.set(e.code, { ev: ev, next: performance.now() + 230 });
    });
    window.addEventListener('keyup', function (e) { self.held.delete(e.code); });
    window.addEventListener('blur', function () { self.held.clear(); });
    cv.addEventListener('mousedown', function (e) {
      Sound.unlock();
      var r = cv.getBoundingClientRect();
      self.queue.push({ mouse: e.button === 2 ? 'right' : 'left', x: Math.floor((e.clientX - r.left) * W / r.width), y: Math.floor((e.clientY - r.top) * H / r.height) });
    });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  },
  update: function () {
    var now = performance.now(), self = this;
    this.held.forEach(function (h) {
      if (now >= h.next) { self.queue.push(h.ev); h.next = now + 125; }
    });
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

// Short synthesized effects. Kept quiet on purpose.
var Sound = {
  ctx: null, muted: false,
  unlock: function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  tone: function (type, f0, f1, dur, vol, delay) {
    var a = this.ctx;
    if (!a || this.muted) return;
    var t = a.currentTime + (delay || 0);
    var o = a.createOscillator(), v = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    v.gain.setValueAtTime(vol, t);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v); v.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise: function (dur, vol, delay) {
    var a = this.ctx;
    if (!a || this.muted) return;
    var t = a.currentTime + (delay || 0), n = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = a.createBufferSource(), v = a.createGain();
    s.buffer = buf; v.gain.value = vol;
    s.connect(v); v.connect(a.destination);
    s.start(t);
  },
  play: function (name) {
    switch (name) {
      case 'step': this.tone('square', 200, 170, 0.04, 0.025); break;
      case 'push': this.tone('triangle', 130, 90, 0.08, 0.06); break;
      case 'bump': this.tone('square', 90, 70, 0.05, 0.03); break;
      case 'pick': this.tone('square', 660, 990, 0.06, 0.03); break;
      case 'drop': this.tone('square', 520, 330, 0.06, 0.03); break;
      case 'zap': this.tone('sawtooth', 1200, 300, 0.12, 0.035); break;
      case 'compile': this.tone('square', 330, 330, 0.06, 0.035); this.tone('square', 495, 495, 0.06, 0.035, 0.06); this.tone('square', 660, 660, 0.08, 0.035, 0.12); break;
      case 'fizzle': this.tone('sawtooth', 300, 80, 0.1, 0.03); break;
      case 'hit': this.noise(0.07, 0.07); this.tone('square', 160, 60, 0.07, 0.04); break;
      case 'hurt': this.noise(0.1, 0.09); this.tone('sawtooth', 220, 50, 0.15, 0.05); break;
      case 'smash': this.noise(0.18, 0.1); break;
      case 'boom': this.noise(0.4, 0.14); this.tone('sine', 90, 30, 0.4, 0.12); break;
      case 'tick': this.tone('square', 1400, 1400, 0.025, 0.02); break;
      case 'fill': this.tone('triangle', 200, 60, 0.25, 0.07); break;
      case 'undo': this.tone('triangle', 330, 220, 0.05, 0.03); break;
      case 'win': [523, 659, 784, 1046].forEach(function (f, i) { Sound.tone('square', f, f, 0.12, 0.035, i * 0.09); }); break;
      case 'lose': this.tone('sawtooth', 260, 60, 0.5, 0.05); break;
      case 'select': this.tone('square', 880, 880, 0.03, 0.02); break;
      case 'ok': this.tone('square', 660, 880, 0.06, 0.03); break;
      case 'error': this.tone('square', 140, 110, 0.18, 0.04); break;
      case 'rule': this.tone('triangle', 440, 880, 0.12, 0.05); break;
    }
  },
};
function sfx(n) { Sound.play(n); }

var Save = {
  KEY: 'checksum.save',
  data: { done: {}, best: {}, seen: {}, tapes: {} },
  load: function () {
    try {
      var raw = localStorage.getItem(this.KEY);
      if (raw) { var d = JSON.parse(raw); for (var k in this.data) if (d[k]) this.data[k] = d[k]; }
    } catch (e) { /* storage blocked: play without saving */ }
  },
  store: function () {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* storage blocked */ }
  },
  chips: function () { return Object.keys(this.data.done).length; },
};

var Game = { scene: null, t: 0 };
function setScene(s) { Game.scene = s; if (s.enter) s.enter(); }
