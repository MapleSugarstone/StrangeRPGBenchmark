// Build B view: draws the Syntax board, where keycaps on the floor are the rules.
var HELP_B = [
  'Keycaps on the floor make the rules.',
  'A row or column that reads',
  'NOUN IS PROPERTY is a rule.',
  'Push keycaps to break or make rules.',
  'HURT things hit YOU when you stand',
  'next to them. Walk into a HURT thing',
  'to hit it. WEAK things break in one',
  'hit. Space waits. Z undoes. R restarts.',
];

function SceneB(li) {
  this.build = 'B';
  this.li = li;
  this.def = LEVELS.B[li];
  this.theme = THEMES.B;
  this.T = 24;
  this.restart(true);
  this.help = !Save.data.seen.helpB;
}

SceneB.prototype.restart = function (fresh) {
  if (!fresh && this.s) this.hist.push(this.s); else this.hist = [];
  this.s = RulesB.load(this.def);
  this.done = false;
  this.snap();
  FX.clear();
};
SceneB.prototype.snap = function () {
  var d = {};
  this.s.objs.forEach(function (o) { d[o.id] = { x: o.x, y: o.y }; });
  this.disp = d;
};
SceneB.prototype.layout = function () {
  var s = this.s, T = this.T;
  this.ox = 4 + Math.floor((264 - s.w * T) / 2);
  this.oy = 16 + Math.floor((196 - s.h * T) / 2) + 3;
};
SceneB.prototype.cx = function (x) { return this.ox + x * this.T + this.T / 2; };
SceneB.prototype.cy = function (y) { return this.oy + y * this.T + this.T / 2 - 2; };

SceneB.prototype.act = function (a) {
  if (this.s.won || this.s.lost) return;
  var r = RulesB.step(this.s, a);
  if (!r) { sfx('bump'); return; }
  this.hist.push(this.s);
  this.s = r.s;
  var self = this, pushed = false, moved = false;
  r.ev.forEach(function (e) {
    var px = e.x !== undefined ? self.cx(e.x) : 0, py = e.y !== undefined ? self.cy(e.y) : 0;
    switch (e.e) {
      case 'move': moved = true; break;
      case 'push': pushed = true; break;
      case 'hit': sfx('hit'); FX.burst(px, py, PAL.red, 8); break;
      case 'die': sfx('smash'); FX.burst(px, py, PAL.white, 16); break;
      case 'spawn': FX.burst(px, py, PAL.teal, 14); FX.float(px, py - 14, 'dropped', PAL.white); break;
      case 'bite': sfx('hurt'); FX.float(px, py - 14, '-1', PAL.red); break;
      case 'rules': sfx('rule'); break;
      case 'become': FX.burst(self.cx(self.find(e.id).x), self.cy(self.find(e.id).y), PAL.yellow, 12); break;
      case 'win': sfx('win'); break;
      case 'lose': sfx('lose'); break;
    }
  });
  if (pushed) sfx('push'); else if (moved) sfx('step');
};
SceneB.prototype.find = function (id) {
  for (var i = 0; i < this.s.objs.length; i++) if (this.s.objs[i].id === id) return this.s.objs[i];
  return { x: 0, y: 0 };
};
SceneB.prototype.undo = function () {
  if (!this.hist.length) return;
  this.s = this.hist.pop();
  this.snap();
  sfx('undo');
};

SceneB.prototype.key = function (ev) {
  if (ev.mouse) return;
  if (this.help) { if (isOk(ev) || isBack(ev) || ev.key === 'h') { this.help = false; Save.data.seen.helpB = 1; Save.store(); } return; }
  if (this.s.won) {
    if (isOk(ev)) nextPuzzle(this.build, this.li);
    else if (isBack(ev)) toHub(this.build, this.li);
    else if (ev.key === 'z' || ev.code === 'Backspace') this.undo();
    return;
  }
  var d = dirOf(ev);
  if (d >= 0) { this.act({ t: 'move', d: d }); return; }
  if (ev.code === 'Space' || ev.key === '.') { this.act({ t: 'wait' }); return; }
  if (ev.key === 'z' || ev.code === 'Backspace') { this.undo(); return; }
  if (ev.key === 'r') { this.restart(false); sfx('undo'); return; }
  if (ev.key === 'h') { this.help = true; return; }
  if (ev.key === 'm') { Sound.muted = !Sound.muted; return; }
  if (isBack(ev)) toHub(this.build, this.li);
};

SceneB.prototype.update = function (dt) {
  var self = this, sp = dt * 14;
  this.s.objs.forEach(function (o) {
    var d = self.disp[o.id];
    if (!d) { self.disp[o.id] = { x: o.x, y: o.y }; return; }
    d.x += Math.max(-sp, Math.min(sp, o.x - d.x));
    d.y += Math.max(-sp, Math.min(sp, o.y - d.y));
  });
  FX.update(dt);
  if (this.s.won && !this.done) { this.done = true; Save.data.done[this.def.id] = 1; Save.store(); }
};

var DRAW_ORDER_B = { wall: 0, chip: 1, text: 2, crt: 3, husk: 3, mage: 4 };
SceneB.prototype.draw = function () {
  var s = this.s, T = this.T, th = this.theme, self = this, t = Game.t;
  this.layout();
  drawVoid(th, t);
  var ox = this.ox, oy = this.oy;
  for (var y = 0; y < s.h; y++) for (var x = 0; x < s.w; x++) {
    if (s.floor[y * s.w + x] !== '.') continue;
    drawFloorTile(ox + x * T, oy + y * T, T, th, (x + y) & 1);
    var below = y + 1 < s.h ? s.floor[(y + 1) * s.w + x] : '_';
    if (below !== '.') drawCliff(ox + x * T, oy + (y + 1) * T, T, th);
  }
  var objs = s.objs.slice().sort(function (a, b) { return DRAW_ORDER_B[a.n] - DRAW_ORDER_B[b.n]; });
  var lit = s.lit || {};
  for (var row = 0; row < s.h; row++) {
    objs.forEach(function (o) {
      var d = self.disp[o.id] || o;
      if (Math.round(d.y) !== row) return;
      var px = ox + d.x * T, py = oy + d.y * T;
      switch (o.n) {
        case 'wall': drawBlock(px, py, T, th.wallTop, th.wallHi, th.wallFront, 6); break;
        case 'chip': spr(SPR.chip, px + 6, py + 6 - (Math.floor(t * 2) & 1)); break;
        case 'text': drawKeycap(px, py, T, o.w, RulesB.NOUNS.indexOf(o.w) >= 0 ? 'noun' : RulesB.PROPS.indexOf(o.w) >= 0 ? 'prop' : 'op', !!lit[o.id]); break;
        case 'mage': spr(SPR.pilcrow, px + 4, py + 2 + ((Math.floor(t * 2) & 1) ? 1 : 0), o.face === 3); break;
        case 'husk': spr(SPR.husk, px + 4, py + 2, (Math.floor(t * 1.5 + o.id) & 1) === 1); break;
        case 'crt': spr(SPR.crt, px + 4, py + 3); break;
      }
    });
  }
  objs.forEach(function (o) {
    var d = self.disp[o.id] || o, cx = ox + d.x * T + T / 2, top = oy + d.y * T;
    if (o.n === 'text' || o.n === 'wall') return;
    if (o.hp) drawPips(cx, top - 3, o.hp, o.maxHp);
    if (RulesB.is(s, o, 'you')) drawArrow(cx, top - 6 - (o.hp ? 2 : 0) - ((Math.floor(t * 3) & 1) ? 1 : 0), 2, PAL.yellow);
    if (RulesB.is(s, o, 'hurt')) rect(cx - 8, top + 21, 16, 1, PAL.red);
  });
  FX.draw();
  this.drawPanel();
  drawTopBar('B', 'SYNTAX', this.li, this.def.name, s.turn);
  if (this.help) popup(HELP_B, 'HOW SYNTAX WORKS', PAL.magenta, 200);
  else if (s.won) winPopup(this.def);
  else if (s.lost) popup(['Nothing is YOU any more.', 'Z undoes the last turn.', 'R restarts the room.'], 'NO ONE LEFT', PAL.redDk, 150);
};

SceneB.prototype.drawPanel = function () {
  var s = this.s, x = 274, w = 106;
  var rules = s.rules.map(function (r) { return r.join(' ').toUpperCase(); });
  var rh = Math.max(1, rules.length) * LH + 18;
  panel(x, 16, w, rh, 'RULES', PAL.magenta);
  if (!rules.length) text('none', x + 5, 31, PAL.g4);
  rules.forEach(function (r, i) { text(r, x + 5, 31 + i * LH, PAL.ink); });
  var ny = 16 + rh + 4;
  panel(x, ny, w, 52, 'NOTE', PAL.magenta);
  wrap(this.def.hint, 19).forEach(function (l, i) { if (i < 4) text(l, x + 5, ny + 15 + i * LH, PAL.ink); });
  panel(x, 174, w, 38);
  ['Arrows move', 'Space wait', 'Z undo  R restart', 'H help  Esc drives'].forEach(function (l, i) { text(l, x + 5, 177 + i * LH, PAL.ink); });
};
