// Sprites, tiles, and the backdrop. Everything is flat color with hard edges.
var SPR = {
  pilcrow: [
    '........k.......',
    '.......kYk......',
    '......kBYk......',
    '......kBYYk.....',
    '.....kBBYYk.....',
    '....kBBBYYYk....',
    '..kkkkkkkkkkkk..',
    '...kBBBBYYYYk...',
    '...kBwwBYwwYk...',
    '...kBwkBYkwYk...',
    '...kBBBBYYYYk...',
    '...kBBkkkkYYk...',
    '...kkBBBYYYk....',
    '...kbBBBYYyk....',
    '...kbBBBYYyk....',
    '...kkk.kk.kkk...',
  ],
  husk: [
    '................',
    '...kkkkkkkkkk...',
    '...kRRRRwwwwk...',
    '...kRkkkkkkwk...',
    '...kRkTkkTkwk...',
    '...kRkkkkkkwk...',
    '...kRkTTTTkwk...',
    '...kRkkkkkkwk...',
    '...kkkkkkkkkk...',
    '......kRwk......',
    '.....kRRwwk.....',
    '....kRRkYwwk....',
    '....kRRYYwwk....',
    '.....kRYwwk.....',
    '......kRwk......',
    '.....kk..kk.....',
  ],
  crt: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..k1111111111k..',
    '..k1kkkkkkkk1k..',
    '..k1kTkkkkTk1k..',
    '..k1kkTkkTkk1k..',
    '..k1kkkkkkkk1k..',
    '..k1kRRRRRRk1k..',
    '..k1kkkkkkkk1k..',
    '..k1111111111k..',
    '..k2222222222k..',
    '..kkkkkkkkkkkk..',
    '....k......k....',
    '...kk......kk...',
    '................',
  ],
  ram: [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kOOOOOOk....',
    '...kOOOOOOOOk...',
    '..kOOwwkOOOOOk..',
    '..kOOwkkOOOOOk..',
    '..kOOOOOOOOrOk..',
    '..kOOOOOOOrrOk..',
    '..kRRRRRRRRRRk..',
    '..kRrRrRrRrRRk..',
    '...kRRRRRRRRk...',
    '....kRRRRRRk....',
    '.....kkkkkk.....',
    '................',
    '................',
  ],
  fork: [
    '........k.......',
    '.......kYk......',
    '........k.......',
    '..kkkkkkkkkkkk..',
    '..kccccccccbbk..',
    '..kBkkkkkkkkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkKKKKKKkbk..',
    '..kBkkkkkkkkbk..',
    '..kkkkkkkkkkkk..',
  ],
  bitr: ['..kk..', '.kRRk.', '.kRRk.', 'kRRRRk', 'kRRrRk', 'kkkkkk'],
  bity: ['.kkkk.', 'kYYYYk', 'kYwYYk', 'kYYYYk', 'kYYyYk', '.kkkk.'],
  bitb: ['kkkkkk', 'kBBBBk', 'kBwBBk', 'kBBBBk', 'kBBbBk', 'kkkkkk'],
  chip: [
    '..Y.Y.Y.Y...',
    '.kkkkkkkkkk.',
    '.knnnnnnnnk.',
    '.knkkkkknnk.',
    '.knkTTTknnk.',
    '.knkTTTknnk.',
    '.knkkkkknnk.',
    '.knnnnnnGnk.',
    '.kkkkkkkkkk.',
    '..Y.Y.Y.Y...',
  ],
  shard: ['..kk..', '.kTTk.', 'kTwTTk', 'kTTTtk', '.kTtk.', '..kk..'],
  imp: [
    '....kkkk....',
    '..kkwwwwkk..',
    '.kwwwwwwwwk.',
    '.kwwwwwwwwk.',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    '.kwwwwwwwwk.',
    '.kwwwwwwwwk.',
    '..kkwwwwkk..',
    '....kkkk....',
  ],
  tilde: [
    '........................',
    '...kkkk.................',
    '..kPPPPk.........kkkk...',
    '.kPPwkPPk.......kTTTTk..',
    '.kPPkkPPPk.....kTTTTTTk.',
    '.kPPPPPPPPkkkkkTTTTTtTk.',
    '..kPPPPPPPPTTTTTTTTttk..',
    '...kkPPPPPPTTTTTTTTkk...',
    '.....kkkkkkkkkkkkkk.....',
    '........................',
  ],
  heart: ['.k.k.', 'kRkRk', 'kRRRk', '.kRk.', '..k..'],
  heartEmpty: ['.k.k.', 'k4k4k', 'k444k', '.k4k.', '..k..'],
};
var IMP_COLORS = [PAL.sky, PAL.pink, PAL.lime];

var THEMES = {
  A: { floorA: '#e9a38c', floorB: '#f4dfc4', cliff: '#8a4a52', cliffDk: '#4a2238', wallTop: '#3b5bff', wallHi: '#7fa0ff', wallFront: '#1c2a8c', crackTop: '#5e78ff', band: ['#0b0716', '#160c2a', '#24103a', '#3a1448', '#5a1a52'], shape: '#2a1442' },
  B: { floorA: '#92dcc0', floorB: '#c6f0dc', cliff: '#2f7a72', cliffDk: '#163a44', wallTop: '#d64aa8', wallHi: '#ff8fd4', wallFront: '#7a1a66', band: ['#06101a', '#0b1a2a', '#10283a', '#14384a', '#1a4a56'], shape: '#0f2a3a' },
  C: { floorA: '#b6acdf', floorB: '#d8d0f4', cliff: '#4e4680', cliffDk: '#2a2450', wallTop: '#5c5878', wallHi: '#8e88ac', wallFront: '#302c48', band: ['#0a0812', '#121022', '#1c1834', '#2a2048', '#3c2656'], shape: '#1e1a34' },
};

// Hard color bands with a dithered seam between them, dead pixels, and a few large flat shapes drifting.
var _stars = null;
function drawVoid(theme, t) {
  var bands = theme.band, n = bands.length, bh = Math.ceil(H / n);
  for (var i = 0; i < n; i++) {
    rect(0, i * bh, W, bh, bands[i]);
    if (i > 0) dither(0, i * bh - 2, W, 4, null, bands[i], 8);
  }
  drawMoon(48 + Math.round(Math.sin(t / 9) * 6), 50 + Math.round(Math.sin(t / 5) * 2), 22);
  var drift = (t * 3) % (W + 120);
  g.fillStyle = theme.shape;
  for (var k = 0; k < 3; k++) {
    var sx = ((k * 157 + drift) % (W + 120)) - 60, sy = 30 + k * 62;
    var s = 18 + k * 8;
    for (var r = 0; r < s; r++) g.fillRect(Math.round(sx - r), sy + r, r * 2 + 1, 1);
  }
  if (!_stars) {
    _stars = [];
    var seed = 7;
    for (var j = 0; j < 70; j++) {
      seed = (seed * 16807) % 2147483647; var x = seed % W;
      seed = (seed * 16807) % 2147483647; var y = seed % H;
      seed = (seed * 16807) % 2147483647;
      _stars.push([x, y, seed % 5]);
    }
  }
  var phase = Math.floor(t / 1.6);
  _stars.forEach(function (st, idx) {
    if ((idx + phase) % 9 === 0) return;
    rect(st[0], st[1], 1, 1, st[2] === 0 ? PAL.yellow : st[2] === 1 ? PAL.pink : PAL.g2);
  });
}

function drawFloorTile(x, y, s, theme, parity) {
  rect(x, y, s, s, parity ? theme.floorA : theme.floorB);
}
function drawCliff(x, y, s, theme) {
  var h = Math.round(s / 4);
  rect(x, y, s, h, theme.cliff);
  rect(x, y + h, s, 2, theme.cliffDk);
}
// Raised block: top face shifted up by lift, front face below it.
function drawBlock(x, y, s, top, hi, front, lift, pattern) {
  rect(x, y - lift, s, s, top);
  rect(x, y - lift, s, 1, hi);
  rect(x, y - lift, 1, s, hi);
  rect(x, y + s - lift, s, lift, front);
  if (pattern === 'rack') for (var i = 3; i < s; i += 4) rect(x + i, y + s - lift + 1, 1, lift - 2, PAL.ink);
  frame(x, y - lift, s, s + lift, PAL.ink);
  rect(x, y + s - lift, s, 1, PAL.ink);
}
// A cracked block: pale top face, a zigzag split, and a chipped corner.
function drawCrack(x, y, s, lift) {
  var top = y - lift;
  rect(x + 1, top + 1, s - 2, s - 2, '#a9b8ff');
  dither(x + 1, top + 1, s - 2, s - 2, null, '#8296ff', 6);
  var path = [[7, 1], [6, 2], [6, 3], [8, 4], [8, 5], [7, 6], [5, 7], [5, 8], [6, 9], [8, 10], [9, 11], [9, 12], [8, 13], [8, 14]];
  path.forEach(function (p) { rect(x + p[0], top + p[1], 2, 1, PAL.ink); });
  rect(x + 2, top + 5, 3, 1, PAL.ink); rect(x + 10, top + 8, 4, 1, PAL.ink);
  rect(x + s - 4, top + 1, 3, 2, PAL.ink);
}

// A split moon: a square cobalt half and a round yellow half, drifting.
function drawMoon(cx, cy, r) {
  for (var dy = -r; dy <= r; dy++) {
    var half = Math.floor(Math.sqrt(r * r - dy * dy));
    rect(cx - r, cy + dy, r, 1, PAL.cobaltDk);
    if (half > 0) rect(cx, cy + dy, half, 1, PAL.ochre);
  }
  rect(cx - r + 5, cy - 6, 4, 4, PAL.ink);
  rect(cx + 6, cy - 6, 4, 4, PAL.ink);
  rect(cx + 7, cy - 5, 2, 2, PAL.white);
}

function drawHearts(x, y, hp, max) {
  for (var i = 0; i < max; i++) spr(i < hp ? SPR.heart : SPR.heartEmpty, x + i * 7, y);
}
// Small pips above a creature for its hit points.
function drawPips(cx, y, hp, max) {
  var w = max * 3 + 1, x = Math.round(cx - w / 2);
  rect(x, y, w, 4, PAL.ink);
  for (var i = 0; i < max; i++) rect(x + 1 + i * 3, y + 1, 2, 2, i < hp ? PAL.red : PAL.g4);
}

function drawBit(c, x, y) { spr(SPR['bit' + c], x, y); }

// A keycap: raised key with a word on it.
function drawKeycap(x, y, s, word, kind, lit) {
  var top = lit ? '#fff2b0' : PAL.g2, front = lit ? PAL.ochre : PAL.g4, ty = y - 2;
  rect(x, ty, s, s - 4, top);
  rect(x, ty + s - 4, s, 4, front);
  frame(x, ty, s, s, PAL.ink);
  rect(x, ty + s - 4, s, 1, PAL.ink);
  var col = kind === 'noun' ? PAL.cobaltDk : kind === 'prop' ? PAL.redDk : PAL.ink;
  textC(word.toUpperCase(), x + s / 2, ty + Math.round((s - 4) / 2) - 3, col);
}

function drawArrow(cx, cy, d, color) {
  var pts = d === 0 ? [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]]
    : d === 2 ? [[0, 2], [-1, 1], [0, 1], [1, 1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]]
      : d === 1 ? [[2, 0], [1, -1], [1, 0], [1, 1], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2]]
        : [[-2, 0], [-1, -1], [-1, 0], [-1, 1], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2]];
  pts.forEach(function (p) { rect(cx + p[0], cy + p[1], 1, 1, color); });
}

// Effects shared by the board views: pixel bursts, floating text, and flashes.
var FX = {
  list: [],
  burst: function (x, y, color, n) {
    for (var i = 0; i < (n || 10); i++) {
      var a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50;
      this.list.push({ k: 'p', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0.4 + Math.random() * 0.3, c: color });
    }
  },
  float: function (x, y, s, color) { this.list.push({ k: 't', x: x, y: y, s: s, c: color, life: 0.8 }); },
  flash: function (x, y, w, h, color, life) { this.list.push({ k: 'f', x: x, y: y, w: w, h: h, c: color, life: life || 0.25, max: life || 0.25 }); },
  beam: function (x0, y0, x1, y1, color) { this.list.push({ k: 'b', x0: x0, y0: y0, x1: x1, y1: y1, c: color, life: 0.18 }); },
  update: function (dt) {
    this.list.forEach(function (p) {
      p.life -= dt;
      if (p.k === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
      if (p.k === 't') p.y -= 14 * dt;
    });
    this.list = this.list.filter(function (p) { return p.life > 0; });
  },
  draw: function () {
    this.list.forEach(function (p) {
      if (p.k === 'p') rect(p.x, p.y, 1, 1, p.c);
      else if (p.k === 't') textShadow(p.s, Math.round(p.x - textW(p.s) / 2), Math.round(p.y), p.c);
      else if (p.k === 'f') dither(p.x, p.y, p.w, p.h, null, p.c, Math.ceil(16 * p.life / p.max));
      else if (p.k === 'b') {
        var horiz = p.y0 === p.y1, a = horiz ? Math.min(p.x0, p.x1) : Math.min(p.y0, p.y1), b = horiz ? Math.max(p.x0, p.x1) : Math.max(p.y0, p.y1);
        if (horiz) { rect(a, p.y0 - 1, b - a, 3, p.c); rect(a, p.y0, b - a, 1, PAL.white); }
        else { rect(p.x0 - 1, a, 3, b - a, p.c); rect(p.x0, a, 1, b - a, PAL.white); }
      }
    });
  },
  clear: function () { this.list = []; },
};

// Window chrome with a title, shared by every popup.
function popup(lines, title, color, w) {
  w = w || 220;
  var h = lines.length * LH + 22, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
  panel(x, y, w, h, title, color);
  lines.forEach(function (l, i) {
    var c = PAL.ink, s = l;
    if (typeof l === 'object') { s = l.s; c = l.c || c; }
    text(s, x + 6, y + 16 + i * LH, c);
  });
  return { x: x, y: y, w: w, h: h };
}
