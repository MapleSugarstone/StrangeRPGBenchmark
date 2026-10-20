// Build C view: place imps, write their looping tapes, and watch the machine run.
var HELP_C = [
  'You do not walk here. Place imps and',
  'give each one a looping tape.',
  'Enter on a floor tile places an imp.',
  'Q and E turn it. Tab moves to its tape.',
  'F step  L R turn  G grab  D drop',
  'H hit  W wait. Grab, drop, and hit use',
  'the tile in front. Space runs the loop.',
  'Husks bite any imp that blocks them.',
];
var OP_COLOR = { F: PAL.white, L: PAL.sky, R: PAL.sky, G: PAL.lime, D: PAL.yellow, H: PAL.red, W: PAL.g2 };
var SPEEDS = [3, 8, 20];

function SceneC(li) {
  this.build = 'C';
  this.li = li;
  this.def = LEVELS.C[li];
  this.theme = THEMES.C;
  this.T = 16;
  this.tilde = RulesC.run(this.def, this.def.ref.map(function (p) { return { x: p.x, y: p.y, d: p.d, tape: p.tape.split('') }; }));
  var saved = Save.data.tapes[this.def.id];
  this.prog = saved ? saved.map(function (p) { return { x: p.x, y: p.y, d: p.d, tape: padTape(p.tape) }; }) : [];
  this.mode = 'build';
  this.focus = 'board';
  var base = RulesC.load(this.def);
  this.base = base;
  this.cur = { x: Math.floor(base.w / 2), y: Math.floor(base.h / 2) };
  this.sel = this.prog.length ? 0 : -1;
  this.slot = 0;
  this.speed = 0;
  this.run = null;
  this.msg = '';
  this.result = null;
  this.help = !Save.data.seen.helpC;
  FX.clear();
}
function padTape(t) { var a = []; for (var i = 0; i < RulesC.SLOTS; i++) a.push(t[i] && t[i] !== '.' ? t[i] : ''); return a; }

SceneC.prototype.saveProg = function () {
  Save.data.tapes[this.def.id] = this.prog.map(function (p) { return { x: p.x, y: p.y, d: p.d, tape: p.tape.map(function (c) { return c || '.'; }).join('') }; });
  Save.store();
};
SceneC.prototype.layout = function () {
  this.ox = Math.floor((252 - this.base.w * 16) / 2);
  this.oy = 20 + Math.floor((86 - this.base.h * 16) / 2) + 3;
};
SceneC.prototype.impAt = function (x, y) {
  for (var i = 0; i < this.prog.length; i++) if (this.prog[i].x === x && this.prog[i].y === y) return i;
  return -1;
};
SceneC.prototype.canPlace = function (x, y) {
  if (RulesC.tile(this.base, x, y) !== '.') return false;
  return !this.base.husks.some(function (q) { return q.x === x && q.y === y; });
};

SceneC.prototype.startRun = function () {
  if (!this.prog.length) { this.msg = 'Place an imp first.'; sfx('error'); return; }
  var s = RulesC.start(this.def, this.prog);
  if (typeof s === 'string') { this.msg = s; sfx('error'); return; }
  this.run = { s: s, prev: s, playing: true, acc: 0 };
  this.mode = 'run';
  this.msg = '';
  this.result = null;
  FX.clear();
  sfx('ok');
};
SceneC.prototype.stopRun = function () { this.mode = 'build'; this.run = null; this.result = null; this.msg = ''; FX.clear(); };

SceneC.prototype.stepRun = function () {
  var r = this.run, res = RulesC.cycle(r.s);
  if (!res) { r.playing = false; return; }
  r.prev = r.s;
  r.s = res.s;
  r.acc = 0;
  var self = this;
  res.ev.forEach(function (e) {
    var cx = self.ox + e.x * 16 + 8, cy = self.oy + e.y * 16 + 4;
    switch (e.e) {
      case 'grab': sfx('pick'); break;
      case 'drop': sfx('drop'); break;
      case 'feed': sfx('drop'); FX.burst(cx, cy, PAL.yellow, 6); break;
      case 'deliver': sfx('compile'); FX.burst(cx, cy, PAL.pink, 14); FX.float(cx, cy - 12, '+1', PAL.pink); break;
      case 'fuse': sfx('rule'); break;
      case 'swing': sfx('bump'); break;
      case 'hit': sfx('hit'); FX.burst(cx, cy, PAL.red, 8); break;
      case 'die': sfx('smash'); FX.burst(cx, cy, PAL.white, 16); break;
      case 'error': sfx('error'); if (e.x >= 0) FX.burst(cx, cy, PAL.red, 12); break;
      case 'win': sfx('win'); break;
    }
  });
  if (r.s.error) { r.playing = false; this.msg = r.s.error.msg; }
  if (r.s.done) {
    r.playing = false;
    var res2 = { cycles: r.s.cycle, cost: RulesC.cost(this.prog), area: Object.keys(r.s.area).length };
    this.result = res2;
    var best = Save.data.best[this.def.id] || {};
    this.prevBest = Object.assign({}, best);
    ['cycles', 'cost', 'area'].forEach(function (k) { if (!best[k] || res2[k] < best[k]) best[k] = res2[k]; });
    Save.data.best[this.def.id] = best;
    Save.data.done[this.def.id] = 1;
    Save.store();
  }
};

SceneC.prototype.key = function (ev) {
  if (this.help) { if (ev.mouse || isOk(ev) || isBack(ev) || ev.key === 'h') { this.help = false; Save.data.seen.helpC = 1; Save.store(); } return; }
  if (ev.mouse) { this.click(ev); return; }
  if (this.result) {
    if (isOk(ev)) nextPuzzle(this.build, this.li);
    else if (isBack(ev)) this.stopRun();
    return;
  }
  if (this.mode === 'run') {
    if (ev.code === 'Space') { if (!this.run.s.error && !this.run.s.done) this.run.playing = !this.run.playing; }
    else if (ev.key === '.') { this.run.playing = false; this.stepRun(); }
    else if (ev.key === '-' ) this.speed = Math.max(0, this.speed - 1);
    else if (ev.key === '=' || ev.key === '+') this.speed = Math.min(2, this.speed + 1);
    else if (isBack(ev) || isOk(ev) || ev.code === 'Tab') this.stopRun();
    return;
  }
  if (ev.key === 'h') { this.help = true; return; }
  if (ev.key === 'm') { Sound.muted = !Sound.muted; return; }
  if (ev.code === 'Space') { this.startRun(); return; }
  if (ev.key === '.') { this.startRun(); if (this.run) { this.run.playing = false; this.stepRun(); } return; }
  if (ev.code === 'Tab') { this.focus = this.focus === 'board' ? 'tape' : 'board'; if (this.focus === 'tape' && this.sel < 0) this.focus = 'board'; sfx('select'); return; }
  this.msg = '';
  if (this.focus === 'board') this.keyBoard(ev); else this.keyTape(ev);
};

SceneC.prototype.keyBoard = function (ev) {
  var d = dirOf(ev);
  if (d >= 0 && ev.shift && this.sel >= 0) {
    var p = this.prog[this.sel], nx = p.x + RulesC.DX[d], ny = p.y + RulesC.DY[d];
    if (this.canPlace(nx, ny) && this.impAt(nx, ny) < 0) { p.x = nx; p.y = ny; this.cur = { x: nx, y: ny }; this.saveProg(); sfx('step'); }
    else sfx('bump');
    return;
  }
  if (d >= 0) {
    var cx = this.cur.x + RulesC.DX[d], cy = this.cur.y + RulesC.DY[d];
    if (cx >= 0 && cy >= 0 && cx < this.base.w && cy < this.base.h) { this.cur = { x: cx, y: cy }; sfx('select'); }
    var under = this.impAt(this.cur.x, this.cur.y);
    if (under >= 0) this.sel = under;
    return;
  }
  if (ev.code === 'Enter') {
    var at = this.impAt(this.cur.x, this.cur.y);
    if (at >= 0) { this.sel = at; this.focus = 'tape'; sfx('ok'); return; }
    if (!this.canPlace(this.cur.x, this.cur.y)) { this.msg = 'Imps stand on plain floor.'; sfx('error'); return; }
    if (this.prog.length >= this.def.maxImps) { this.msg = 'This room allows ' + this.def.maxImps + ' imps.'; sfx('error'); return; }
    this.prog.push({ x: this.cur.x, y: this.cur.y, d: 1, tape: padTape([]) });
    this.sel = this.prog.length - 1;
    this.slot = 0;
    this.focus = 'tape';
    this.saveProg();
    sfx('compile');
    return;
  }
  if ((ev.key === 'q' || ev.key === 'e') && this.sel >= 0) {
    var pp = this.prog[this.sel];
    pp.d = (pp.d + (ev.key === 'e' ? 1 : 3)) % 4;
    this.saveProg(); sfx('select');
    return;
  }
  if (ev.code === 'Delete' || ev.key === 'x') {
    var del = this.impAt(this.cur.x, this.cur.y);
    if (del >= 0) { this.prog.splice(del, 1); this.sel = this.prog.length ? 0 : -1; this.saveProg(); sfx('undo'); }
    return;
  }
  if (isBack(ev)) toHub(this.build, this.li);
};

SceneC.prototype.keyTape = function (ev) {
  var p = this.prog[this.sel];
  if (!p) { this.focus = 'board'; return; }
  var up = ev.key.length === 1 ? ev.key.toUpperCase() : '';
  if (ev.code === 'ArrowLeft') { this.slot = Math.max(0, this.slot - 1); return; }
  if (ev.code === 'ArrowRight') { this.slot = Math.min(RulesC.SLOTS - 1, this.slot + 1); return; }
  if (ev.code === 'ArrowUp') { this.sel = (this.sel + this.prog.length - 1) % this.prog.length; return; }
  if (ev.code === 'ArrowDown') { this.sel = (this.sel + 1) % this.prog.length; return; }
  if (RulesC.OPS[up]) {
    p.tape[this.slot] = up;
    this.slot = Math.min(RulesC.SLOTS - 1, this.slot + 1);
    this.saveProg(); sfx('select');
    return;
  }
  if (ev.code === 'Backspace') {
    if (!p.tape[this.slot] && this.slot > 0) this.slot--;
    p.tape[this.slot] = '';
    this.saveProg(); sfx('undo');
    return;
  }
  if (ev.code === 'Delete') { p.tape.splice(this.slot, 1); p.tape.push(''); this.saveProg(); sfx('undo'); return; }
  if (ev.code === 'Insert') { p.tape.splice(this.slot, 0, ''); p.tape.length = RulesC.SLOTS; this.saveProg(); return; }
  if ((ev.key === 'q' || ev.key === 'e')) { p.d = (p.d + (ev.key === 'e' ? 1 : 3)) % 4; this.saveProg(); sfx('select'); return; }
  if (isBack(ev) || ev.code === 'Enter') { this.focus = 'board'; this.cur = { x: p.x, y: p.y }; }
};

SceneC.prototype.click = function (ev) {
  if (this.result) { this.stopRun(); return; }
  var b = this.buttons || [];
  for (var i = 0; i < b.length; i++) {
    var bt = b[i];
    if (ev.x >= bt.x && ev.y >= bt.y && ev.x < bt.x + bt.w && ev.y < bt.y + bt.h) { bt.fn(); return; }
  }
  if (this.mode === 'run') return;
  var tx = Math.floor((ev.x - this.ox) / 16), ty = Math.floor((ev.y - this.oy) / 16);
  if (tx >= 0 && ty >= 0 && tx < this.base.w && ty < this.base.h) {
    var at = this.impAt(tx, ty);
    if (ev.mouse === 'right') { if (at >= 0) { this.prog.splice(at, 1); this.sel = this.prog.length ? 0 : -1; this.saveProg(); sfx('undo'); } return; }
    this.focus = 'board';
    if (at >= 0) { this.sel = at; this.cur = { x: tx, y: ty }; sfx('select'); return; }
    if (this.cur.x === tx && this.cur.y === ty) { this.keyBoard({ code: 'Enter', key: 'Enter' }); return; }
    this.cur = { x: tx, y: ty };
    sfx('select');
    return;
  }
  for (var r = 0; r < this.prog.length; r++) {
    var ry = 128 + r * 18;
    if (ev.y >= ry && ev.y < ry + 12 && ev.x >= 40 && ev.x < 40 + RulesC.SLOTS * 13) {
      this.sel = r; this.slot = Math.floor((ev.x - 40) / 13); this.focus = 'tape';
      if (ev.mouse === 'right') { this.prog[r].tape[this.slot] = ''; this.saveProg(); }
      sfx('select');
      return;
    }
  }
};

SceneC.prototype.update = function (dt) {
  FX.update(dt);
  if (this.mode === 'run' && this.run && this.run.playing) {
    this.run.acc += dt * SPEEDS[this.speed];
    if (this.run.acc >= 1) this.stepRun();
  }
};

SceneC.prototype.draw = function () {
  var th = this.theme, t = Game.t, self = this;
  this.layout();
  drawVoid(th, t);
  var ox = this.ox, oy = this.oy, T = 16;
  var st = this.run ? this.run.s : this.base, prev = this.run ? this.run.prev : this.base;
  var f = this.run ? Math.min(1, this.run.acc) : 1;
  var w = st.w, h = st.h;
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var c = st.tiles[y * w + x];
    if (c === '_') continue;
    if (c === '.') drawFloorTile(ox + x * T, oy + y * T, T, th, (x + y) & 1);
    var below = y + 1 < h ? st.tiles[(y + 1) * w + x] : '_';
    if (below === '_') drawCliff(ox + x * T, oy + (y + 1) * T, T, th);
  }
  Object.keys(st.items).forEach(function (k) {
    var ix = k % w, iy = Math.floor(k / w);
    if (st.tiles[k] !== '.') return;
    if (st.items[k] === 's') spr(SPR.shard, ox + ix * T + 5, oy + iy * T + 6);
    else spr(SPR.chip, ox + ix * T + 2, oy + iy * T + 3);
  });
  var imps = this.run ? st.imps : this.prog.map(function (p, i) { return { id: i, x: p.x, y: p.y, d: p.d, held: null }; });
  for (var row = 0; row < h; row++) {
    for (var x2 = 0; x2 < w; x2++) {
      var c2 = st.tiles[row * w + x2], bx = ox + x2 * T, by = oy + row * T, k2 = row * w + x2;
      if (c2 === '#') drawBlock(bx, by, T, th.wallTop, th.wallHi, th.wallFront, 5, 'rack');
      else if (c2 === 'S') {
        drawBlock(bx, by, T, PAL.tealDk, PAL.teal, PAL.g5, 5, 'rack');
        rect(bx + 3, by - 2, 2, 1, (Math.floor(t * 2) & 1) ? PAL.lime : PAL.green);
        if (st.items[k2]) spr(SPR.shard, bx + 5, by - 3);
      } else if (c2 === 'T') {
        drawBlock(bx, by, T, PAL.magenta, PAL.pink, PAL.redDk, 5);
        spr(SPR.heart, bx + 6, by + 1);
      } else if (c2 === 'U') {
        drawBlock(bx, by, T, PAL.ochre, PAL.yellow, PAL.redDk, 5);
        for (var q = 0; q < 2; q++) rect(bx + 4 + q * 6, by - 2, 3, 3, q < st.fuse[k2] ? PAL.teal : PAL.ink);
        if (st.items[k2]) spr(SPR.chip, bx + 2, by - 4);
      }
    }
    st.husks.forEach(function (q2) {
      var pq = findBy(prev.husks, q2.id) || q2, hx = lerp(pq.x, q2.x, f), hy = lerp(pq.y, q2.y, f);
      if (Math.round(hy) !== row || q2.hp <= 0) return;
      spr(SPR.husk, ox + hx * T, oy + hy * T - 4, (Math.floor(t * 1.5 + q2.id) & 1) === 1);
    });
    imps.forEach(function (m) {
      var pm = self.run ? (findBy(prev.imps, m.id) || m) : m, mx = lerp(pm.x, m.x, f), my = lerp(pm.y, m.y, f);
      if (Math.round(my) !== row) return;
      self.drawImp(m, ox + mx * T, oy + my * T - 4);
    });
  }
  st.husks.forEach(function (q3) {
    if (q3.hp <= 0) return;
    var cx = ox + q3.x * T + 8, top = oy + q3.y * T - 4;
    if (!self.run || f >= 1) {
      drawPips(cx, top - 4, q3.hp, q3.maxHp);
      if (q3.d >= 0) drawArrow(cx + RulesC.DX[q3.d] * 10, top + 9 + RulesC.DY[q3.d] * 10, q3.d, PAL.red);
    }
  });
  if (this.mode === 'build' && this.focus === 'board') {
    var bl = (Math.floor(t * 3) & 1) ? PAL.yellow : PAL.white;
    frame(ox + this.cur.x * T - 1, oy + this.cur.y * T - 1, T + 2, T + 2, bl);
  }
  if (this.run && st.error && st.error.x >= 0) {
    var exx = ox + st.error.x * T, exy = oy + st.error.y * T - 2;
    for (var e = 0; e < 10; e++) { rect(exx + 3 + e, exy + 2 + e, 2, 1, PAL.red); rect(exx + 12 - e, exy + 2 + e, 2, 1, PAL.red); }
  }
  FX.draw();
  this.drawSide(st);
  this.drawTapes(st);
  drawTopBar('C', 'LOOP', this.li, this.def.name, this.run ? st.cycle : 0);
  if (this.help) popup(HELP_C, 'HOW LOOP WORKS', PAL.tealDk, 204);
  else if (this.result) this.drawResult();
};

function findBy(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function lerp(a, b, f) { return a + (b - a) * f; }

SceneC.prototype.drawImp = function (m, x, y) {
  var col = IMP_COLORS[m.id % 3];
  spr(SPR.imp, x + 2, y + 2, false, { w: col });
  var ex = x + 7 + RulesC.DX[m.d] * 2, ey = y + 7 + RulesC.DY[m.d] * 2;
  rect(ex - 1, ey - 1, 3, 3, PAL.white);
  rect(ex + RulesC.DX[m.d], ey + RulesC.DY[m.d], 1, 1, PAL.ink);
  rect(x + 8 + RulesC.DX[m.d] * 6 - (m.d === 3 ? 1 : 0), y + 7 + RulesC.DY[m.d] * 6 - (m.d === 0 ? 1 : 0), 1, 1, PAL.ink);
  if (m.held === 's') spr(SPR.shard, x + 5, y - 4);
  else if (m.held === 'c') spr(SPR.chip, x + 2, y - 8);
  if (this.mode === 'build' && this.sel === m.id) rect(x + 6, y + 15, 4, 1, PAL.yellow);
};

SceneC.prototype.drawSide = function (st) {
  var x = 258, w = 122, self = this;
  panel(x, 16, w, 40, 'GOAL', PAL.tealDk);
  var what = this.def.item === 'c' ? 'chips' : 'shards';
  text('Bring ' + this.def.need + ' ' + what + ' to', x + 5, 30, PAL.ink);
  text('the port.  In: ' + (this.run ? st.delivered : 0) + '/' + this.def.need, x + 5, 38, PAL.ink);
  panel(x, 60, w, 50, 'SCORE', PAL.tealDk);
  var best = Save.data.best[this.def.id] || {};
  var r = this.result || {};
  text('       you best tilde', x + 3, 74, PAL.g4);
  text('cost  ' + pad(RulesC.cost(this.prog), 4) + ' ' + pad(best.cost, 4) + ' ' + pad(this.tilde.cost, 5), x + 3, 82, PAL.ink);
  text('cycle ' + pad(r.cycles, 4) + ' ' + pad(best.cycles, 4) + ' ' + pad(this.tilde.cycles, 5), x + 3, 90, PAL.ink);
  text('area  ' + pad(r.area, 4) + ' ' + pad(best.area, 4) + ' ' + pad(this.tilde.area, 5), x + 3, 98, PAL.ink);
  this.buttons = [];
  var btns = this.mode === 'build' ? [['RUN', function () { self.startRun(); }], ['STEP', function () { self.key({ key: '.', code: 'Period' }); }]]
    : [[this.run.playing ? 'PAUSE' : 'PLAY', function () { if (!self.run.s.error && !self.run.s.done) self.run.playing = !self.run.playing; }], ['STEP', function () { self.run.playing = false; self.stepRun(); }], ['STOP', function () { self.stopRun(); }]];
  btns.forEach(function (b, i) {
    var bx2 = x + i * 41, by2 = 114, bw2 = 38;
    panel(bx2, by2, bw2, 14);
    textC(b[0], bx2 + bw2 / 2, by2 + 3, PAL.ink);
    self.buttons.push({ x: bx2, y: by2, w: bw2, h: 14, fn: b[1] });
  });
  var msg = this.msg || this.def.hint;
  var lines = wrap(msg, 23);
  panel(x, 132, w, lines.length * LH + 6, undefined, undefined, this.msg ? '#f6c2c8' : PAL.g2);
  lines.forEach(function (l, i) { text(l, x + 4, 135 + i * LH, PAL.ink); });
};
function pad(v, n) { v = v === undefined ? '-' : String(v); while (v.length < n) v = ' ' + v; return v; }

SceneC.prototype.drawTapes = function (st) {
  var self = this, t = Game.t;
  panel(4, 112, 248, 72, 'TAPES', PAL.tealDk);
  if (!this.prog.length) text('No imps yet.', 10, 128, PAL.ink);
  this.prog.forEach(function (p, r) {
    var ry = 128 + r * 18, col = IMP_COLORS[r % 3];
    rect(9, ry + 1, 9, 9, col); frame(8, ry, 11, 11, PAL.ink);
    text(String(r + 1), 22, ry + 2, PAL.ink);
    text(['\x03', '\x01', '\x04', '\x02'][p.d], 30, ry + 2, PAL.ink);
    var live = self.run ? st.imps[r] : null;
    var len = 0; p.tape.forEach(function (c, i) { if (c) len = i + 1; });
    for (var i = 0; i < RulesC.SLOTS; i++) {
      var sx = 40 + i * 13, c = p.tape[i];
      var on = live && len && (st.cycle - 1) % len === i && st.cycle > 0;
      inset(sx, ry, 12, 12, i >= len ? PAL.g4 : on ? PAL.cobaltDk : PAL.g5);
      if (c) text(c, sx + 4, ry + 3, OP_COLOR[c]);
      if (self.mode === 'build' && self.focus === 'tape' && self.sel === r && self.slot === i) frame(sx - 1, ry - 1, 14, 14, (Math.floor(t * 3) & 1) ? PAL.yellow : PAL.white);
    }
  });
  panel(4, 188, 248, 24);
  var ctl = this.mode === 'run' ? 'Space pause  . step  - = speed  Esc stop' : this.focus === 'tape' ? 'FLRGDHW write  Q E turn  Tab board' : 'Enter place  Q E turn  X remove  Tab tape';
  text(ctl, 8, 191, PAL.ink);
  text(this.mode === 'run' ? 'speed ' + SPEEDS[this.speed] + ' per second' : 'Space run  H help  Esc drives', 8, 200, PAL.g4);
};

SceneC.prototype.drawResult = function () {
  var r = this.result, tl = this.tilde, pb = this.prevBest || {};
  var x = Math.round((W - 236) / 2), y = 40;
  panel(x, y, 236, 112, 'DATACHIP RECOVERED', PAL.tealDk);
  text('The loop finished. Tilde', x + 6, y + 16, PAL.ink);
  text('takes the chips.', x + 6, y + 24, PAL.ink);
  var rows = [['cycles', r.cycles, tl.cycles, pb.cycles], ['cost', r.cost, tl.cost, pb.cost], ['area', r.area, tl.area, pb.area]];
  rows.forEach(function (row, i) {
    var ry = y + 34 + i * 18, max = Math.max(row[1], row[2], row[3] || 0);
    text(row[0], x + 6, ry, PAL.ink);
    rect(x + 46, ry, Math.max(2, Math.round(120 * row[1] / max)), 4, PAL.cobaltDk);
    rect(x + 46, ry + 5, Math.max(2, Math.round(120 * row[2] / max)), 3, PAL.magenta);
    text(String(row[1]), x + 172, ry, PAL.cobaltDk);
    text(String(row[2]), x + 200, ry, PAL.magenta);
  });
  text('you', x + 172, y + 88, PAL.cobaltDk);
  text('tilde', x + 200, y + 88, PAL.magenta);
  text('Enter next  Esc edit', x + 6, y + 98, PAL.ink);
};
