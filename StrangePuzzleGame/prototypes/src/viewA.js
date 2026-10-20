// Build A view: draws the Compile board and turns keys into rule actions.
var NAME_A = { ram: 'RAM', fork: 'FORK', brick: 'BRICK' };
var HELP_A = [
  'Walk onto bits to pick them up.',
  '1, 2, 3 drop that bit where you stand.',
  'Two bits on one tile make a stack.',
  'X then an arrow fires the wand down',
  'that line. A stack that matches a',
  'recipe compiles into a daemon.',
  'Walk into a husk to hit it.',
  'Space waits. Z undoes. R restarts.',
];

function SceneA(li) {
  this.build = 'A';
  this.li = li;
  this.def = LEVELS.A[li];
  this.theme = THEMES.A;
  this.T = 16;
  this.restart(true);
  this.help = !Save.data.seen.helpA;
}

SceneA.prototype.restart = function (fresh) {
  if (!fresh && this.s) this.hist.push(this.s);
  else this.hist = [];
  this.s = RulesA.load(this.def);
  this.aim = false;
  this.done = false;
  this.disp = {};
  this.snap();
  FX.clear();
};

SceneA.prototype.layout = function () {
  var s = this.s, T = this.T;
  this.ox = Math.floor((262 - s.w * T) / 2);
  this.oy = 18 + Math.floor((190 - s.h * T) / 2) + 3;
};

SceneA.prototype.snap = function () {
  var d = {};
  d[0] = { x: this.s.px, y: this.s.py };
  this.s.objs.forEach(function (o) { d[o.id] = { x: o.x, y: o.y }; });
  this.disp = d;
};

SceneA.prototype.px = function (x) { return this.ox + x * this.T + this.T / 2; };
SceneA.prototype.py = function (y) { return this.oy + y * this.T + this.T / 2 - 4; };

SceneA.prototype.act = function (a) {
  if (this.s.won || this.s.lost) return;
  var r = RulesA.step(this.s, a);
  if (!r) { sfx('bump'); return; }
  this.hist.push(this.s);
  this.s = r.s;
  this.react(r.ev);
};

SceneA.prototype.react = function (ev) {
  var self = this;
  ev.forEach(function (e) {
    var cx = e.x !== undefined ? self.px(e.x) : 0, cy = e.y !== undefined ? self.py(e.y) : 0;
    switch (e.e) {
      case 'step': sfx('step'); break;
      case 'pick': sfx('pick'); FX.float(cx, cy - 8, '+bit', PAL.yellow); break;
      case 'drop': sfx('drop'); break;
      case 'zap':
        sfx('zap');
        FX.beam(self.px(e.x0), self.py(e.y0) + 2, self.px(e.x1), self.py(e.y1) + 2, PAL.sky);
        if (e.hit === 'norecipe') { sfx('fizzle'); FX.float(self.px(e.x1), self.py(e.y1) - 10, 'no recipe', PAL.white); }
        else if (e.hit === 'block') sfx('fizzle');
        break;
      case 'compile': sfx('compile'); FX.burst(cx, cy, PAL.sky, 14); FX.float(cx, cy - 14, NAME_A[e.k], PAL.white); break;
      case 'spot': var o = self.objById(e.id); if (o) FX.float(self.px(o.x), self.py(o.y) - 14, '!', PAL.yellow); break;
      case 'hit': sfx('hit'); FX.burst(cx, cy, PAL.red, 8); break;
      case 'die': sfx('smash'); FX.burst(cx, cy, PAL.white, 16); break;
      case 'smash': sfx('smash'); FX.burst(cx, cy, self.theme.wallHi, 16); break;
      case 'fill': sfx('fill'); FX.burst(cx, cy, PAL.orange, 12); FX.float(cx, cy - 10, 'filled', PAL.white); break;
      case 'fall': sfx('fill'); break;
      case 'boom':
        sfx('boom');
        FX.flash(self.ox + (e.x - 1) * self.T, self.oy + (e.y - 1) * self.T - 4, self.T * 3, self.T * 3, PAL.orange, 0.4);
        FX.burst(cx, cy, PAL.yellow, 24);
        break;
      case 'tick': sfx('tick'); break;
      case 'bite': case 'crush': case 'burn':
        sfx('hurt'); FX.float(self.px(self.s.px), self.py(self.s.py) - 14, e.e === 'bite' ? '-1' : '-3', PAL.red);
        break;
      case 'win': sfx('win'); break;
      case 'lose': sfx('lose'); break;
    }
  });
};

SceneA.prototype.objById = function (id) {
  for (var i = 0; i < this.s.objs.length; i++) if (this.s.objs[i].id === id) return this.s.objs[i];
  return null;
};

SceneA.prototype.undo = function () {
  if (!this.hist.length) return;
  this.s = this.hist.pop();
  this.aim = false;
  this.snap();
  sfx('undo');
};

SceneA.prototype.key = function (ev) {
  if (ev.mouse) return;
  if (this.help) { if (isOk(ev) || isBack(ev) || ev.key === 'h') { this.help = false; Save.data.seen.helpA = 1; Save.store(); } return; }
  if (this.s.won) {
    if (isOk(ev)) nextPuzzle(this.build, this.li);
    else if (isBack(ev)) toHub(this.build, this.li);
    else if (ev.key === 'z' || ev.code === 'Backspace') this.undo();
    return;
  }
  var d = dirOf(ev);
  if (d >= 0) {
    if (this.aim || ev.shift) { this.act({ t: 'zap', d: d }); this.aim = false; }
    else this.act({ t: 'move', d: d });
    return;
  }
  if (ev.key === 'x') { if (!this.s.lost) { this.aim = !this.aim; sfx('select'); } return; }
  if (ev.key === '1' || ev.key === '2' || ev.key === '3' || ev.key === 'c') {
    var i = ev.key === 'c' ? 0 : +ev.key - 1;
    if (this.s.inv[i]) this.act({ t: 'drop', c: this.s.inv[i] }); else sfx('bump');
    return;
  }
  if (ev.code === 'Space' || ev.key === '.') { this.act({ t: 'wait' }); return; }
  if (ev.key === 'z' || ev.code === 'Backspace') { this.undo(); return; }
  if (ev.key === 'r') { this.restart(false); sfx('undo'); return; }
  if (ev.key === 'h') { this.help = true; return; }
  if (ev.key === 'm') { Sound.muted = !Sound.muted; return; }
  if (isBack(ev)) { if (this.aim) this.aim = false; else toHub(this.build, this.li); }
};

SceneA.prototype.update = function (dt) {
  var self = this, sp = dt * 14;
  function towards(id, x, y) {
    var d = self.disp[id];
    if (!d) { self.disp[id] = { x: x, y: y }; return; }
    d.x += Math.max(-sp, Math.min(sp, x - d.x));
    d.y += Math.max(-sp, Math.min(sp, y - d.y));
  }
  towards(0, this.s.px, this.s.py);
  this.s.objs.forEach(function (o) { towards(o.id, o.x, o.y); });
  FX.update(dt);
  if (this.s.won && !this.done) {
    this.done = true;
    Save.data.done[this.def.id] = 1;
    Save.store();
  }
};

SceneA.prototype.draw = function () {
  var s = this.s, T = this.T, th = this.theme, self = this, t = Game.t;
  this.layout();
  drawVoid(th, t);
  var ox = this.ox, oy = this.oy;
  for (var y = 0; y < s.h; y++) for (var x = 0; x < s.w; x++) {
    var c = s.tiles[y * s.w + x];
    if (c === '_') continue;
    if (c === '.') drawFloorTile(ox + x * T, oy + y * T, T, th, (x + y) & 1);
    var below = y + 1 < s.h ? s.tiles[(y + 1) * s.w + x] : '_';
    if (below === '_') drawCliff(ox + x * T, oy + (y + 1) * T, T, th);
  }
  if (s.goal >= 0) {
    var gx = s.goal % s.w, gy = Math.floor(s.goal / s.w);
    spr(SPR.chip, ox + gx * T + 2, oy + gy * T + 2 - (Math.floor(t * 2) & 1));
  }
  Object.keys(s.bits).forEach(function (k) {
    var bx = ox + (k % s.w) * T, by = oy + Math.floor(k / s.w) * T, st = s.bits[k];
    if (st.length === 1) drawBit(st[0], bx + 5, by + 6);
    else { drawBit(st[0], bx + 2, by + 8); drawBit(st[1], bx + 8, by + 4); }
  });

  var objs = s.objs.slice();
  for (var row = 0; row < s.h; row++) {
    for (var x2 = 0; x2 < s.w; x2++) {
      var c2 = s.tiles[row * s.w + x2];
      if (c2 === '#' || c2 === '%') {
        drawBlock(ox + x2 * T, oy + row * T, T, c2 === '%' ? th.crackTop : th.wallTop, th.wallHi, th.wallFront, 5, 'rack');
        if (c2 === '%') drawCrack(ox + x2 * T, oy + row * T, T, 5);
      }
    }
    objs.forEach(function (o) {
      var d = self.disp[o.id] || o;
      if (Math.round(d.y) !== row) return;
      self.drawObj(o, ox + d.x * T, oy + d.y * T - 4);
    });
    var pd = this.disp[0];
    if (Math.round(pd.y) === row && !s.lost) {
      var bob = (Math.floor(t * 2) & 1) && !this.aim ? 1 : 0;
      spr(SPR.pilcrow, ox + pd.x * T, oy + pd.y * T - 4 + bob, s.face === 3);
    }
  }
  objs.forEach(function (o) {
    var d = self.disp[o.id] || o, cx = ox + d.x * T + T / 2, top = oy + d.y * T - 4;
    if (o.k === 'husk') {
      drawPips(cx, top - 4, o.hp, o.maxHp);
      if (o.pd >= 0) drawArrow(cx + RulesA.DX[o.pd] * 10, top + 9 + RulesA.DY[o.pd] * 10, o.pd, PAL.red);
    }
    if (o.k === 'ram' && o.d >= 0) drawArrow(cx + RulesA.DX[o.d] * 10, top + 9 + RulesA.DY[o.d] * 10, o.d, PAL.yellow);
  });
  if (this.aim) {
    var ax = ox + s.px * T + T / 2, ay = oy + s.py * T + 4;
    for (var dd = 0; dd < 4; dd++) drawArrow(ax + RulesA.DX[dd] * 12, ay + RulesA.DY[dd] * 12, dd, (Math.floor(t * 4) & 1) ? PAL.white : PAL.sky);
  }
  FX.draw();
  this.drawPanel();
  drawTopBar('A', 'COMPILE', this.li, this.def.name, s.turn);
  if (this.help) popup(HELP_A, 'HOW COMPILE WORKS', PAL.cobaltDk, 190);
  else if (s.won) winPopup(this.def);
  else if (s.lost) popup(['Pilcrow is down.', 'Z undoes the last turn.', 'R restarts the room.'], 'SIGNAL LOST', PAL.redDk, 150);
};

SceneA.prototype.drawObj = function (o, x, y) {
  if (o.k === 'husk') spr(SPR.husk, x, y, (Math.floor(Game.t * 1.5 + o.id) & 1) === 1);
  else if (o.k === 'ram') spr(SPR.ram, x, y + 2, o.d === 1);
  else if (o.k === 'fork') {
    spr(SPR.fork, x, y + 2);
    text(String(o.f), x + 6, y + 9, o.f <= 1 ? PAL.red : PAL.yellow);
  } else if (o.k === 'brick') drawBlock(x + 1, y + 6, 14, PAL.g2, PAL.g1, PAL.g3, 4);
};

SceneA.prototype.drawPanel = function () {
  var s = this.s, x = 266, w = 114;
  panel(x, 16, w, 58, 'RECIPES', PAL.cobaltDk);
  var ry = 31;
  Object.keys(s.recipes).forEach(function (k) {
    var bits = s.recipes[k];
    for (var i = 0; i < bits.length; i++) drawBit(bits[i], x + 6 + i * 8, ry + 1);
    text('= ' + NAME_A[k], x + 8 + bits.length * 8, ry, PAL.ink);
    ry += 10;
  });
  panel(x, 78, w, 36, 'PILCROW', PAL.cobaltDk);
  drawHearts(x + 5, 93, s.hp, s.maxHp);
  for (var j = 0; j < 3; j++) {
    var sx = x + 30 + j * 26;
    inset(sx, 92, 10, 10);
    if (s.inv[j]) drawBit(s.inv[j], sx + 2, 94);
    text(String(j + 1), sx + 12, 94, PAL.ink);
  }
  text('bits', x + 5, 104, PAL.g4);
  panel(x, 118, w, 52, 'NOTE', PAL.cobaltDk);
  wrap(this.def.hint, 21).forEach(function (l, i) { if (i < 4) text(l, x + 5, 133 + i * LH, PAL.ink); });
  var ctl = this.aim ? ['Arrow: fire the wand', 'Esc: cancel'] : ['Arrows move  X zap', '1-3 drop  Space wait', 'Z undo  R restart', 'H help  Esc drives'];
  panel(x, 174, w, 38);
  ctl.forEach(function (l, i) { text(l, x + 5, 177 + i * LH, PAL.ink); });
};
