// The puzzle screen, the level map, the title, and the short story scenes.
var T = 16, TOP = 11, HUD_Y = 170;
var DAEMON_SPR = { ram: 'ram', fork: 'fork', brick: 'brick', husk: 'husk', pinger: 'pinger', decoy: 'decoy', swapper: 'swapper', echo: 'pilFront', mirror: 'miniMirror', packet: 'packet', toy: 'toy' };
var MINI = { ram: 'miniRam', fork: 'miniFork', brick: 'miniBrick', pinger: 'miniPinger', mirror: 'miniMirror', decoy: 'miniDecoy', swapper: 'miniSwapper', echo: 'miniEcho', toy: 'miniToy' };
var HUSK_SPR = { still: 'husk', pace: 'husk', hunt: 'hunter', clerk: 'clerk', hoard: 'hoarder' };
// Rows to draw for an object, used by live sprites and by the ghosts that fade out after a death.
function rowsFor(o) {
  if (o.k === 'husk') return SPR[HUSK_SPR[o.ai] || 'husk'];
  if (o.k === 'boss') return o.type === 'forklift' ? SPR.forklift : o.type === 'arcade' ? SPR.cabinet : o.type === 'mainframe' ? SPR.mainframe : o.type === 'jack' ? SPR.jack : o.type === 'static' ? SPR.static : SPR.boss;
  if (o.k === 'key') return SPR.miniBrick;
  return SPR[DAEMON_SPR[o.k]] || SPR.husk;
}
var LEFT_SWAP = { swap: { Y: 'B', B: 'Y', y: 'b', b: 'y' } };

function ease(t) { return 1 - (1 - t) * (1 - t); }

function PuzzleScene(li) {
  this.li = li;
  this.def = LEVELS[li];
  this.area = AREAS[this.def.area || 0];
  this.hist = [];
  this.s = Rules.load(this.def);
  this.vis = {};
  this.ghosts = [];
  this.aim = false;
  this.card = 2.5;
  this.acted = false;
  this.winT = -1;
  this.loseT = -1;
  this.slotPulse = [0, 0, 0];
  this.dropT = {};
  this.help = !Save.data.seen.help;
  this.fresh = freshDaemons(li);
  this.introCard = this.fresh.length > 0;
  this.sync(true);
  var s = this.s;
  // Walls with no floor among their eight neighbors can never be touched, so they draw as open void.
  this.shown = s.tiles.map(function (c, i) {
    if (c !== '#') return c !== '_';
    var x = i % s.w, y = Math.floor(i / s.w);
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var n = Rules.tile(s, x + dx, y + dy);
      if (n !== '#' && n !== 'X' && n !== '_') return true;
    }
    return false;
  });
  this.ox = Math.floor((W - s.w * T) / 2);
  this.oy = TOP + 2 + Math.floor((HUD_Y - TOP - 2 - s.h * T) / 2) + 3;
}

PuzzleScene.prototype.enter = function () {
  FX.clear();
  Sound.setArea(this.def.area || 0);
  var bossLevel = this.def.map.join('').indexOf('Z') >= 0;
  music((this.def.area || 0) === 15 ? 'final' : bossLevel ? ((this.def.area || 0) === 7 ? 'postboss' : 'boss') : 'area' + (this.def.area || 0));
  if ((this.def.area || 0) === 15 && window.Music && Music.setBoss) Music.setBoss((this.def.boss && this.def.boss.form) || 'true');
  if (bossLevel && window.Music && Music.setBoss) Music.setBoss((this.def.boss && this.def.boss.type) || 'manager');
  this.bossMusic();
};
// The fight music climbs as the Manager loses HP.
PuzzleScene.prototype.bossMusic = function () {
  var b = this.boss();
  if (b && window.Music && Music.setIntensity) Music.setIntensity(b.dead ? 1 : (b.maxHp - b.hp) / b.maxHp);
};

// Points every drawn object at its new tile. New objects dither in, unless snapping after an undo.
PuzzleScene.prototype.sync = function (snap) {
  var self = this, seen = {};
  function aim(id, k, x, y) {
    seen[id] = 1;
    var v = self.vis[id];
    if (!v || snap) {
      v = self.vis[id] = { k: k, x: x, y: y, fx: x, fy: y, dx: x, dy: y, t: 1, spawn: snap || (!v && (id === 0 || k === 'packet')) ? 1 : 0, flash: 0, roll: 0, nudge: 0, nd: 0 };
      return;
    }
    if (v.x !== x || v.y !== y || v.t < 1) {
      v.fx = v.dx === undefined ? v.x : v.dx; v.fy = v.dy === undefined ? v.y : v.dy;
      if (v.x !== x || v.y !== y) { v.t = 0; v.hop = k === 'player' ? 1 : 0; if (k === 'ram') v.roll++; }
      v.x = x; v.y = y;
    }
  }
  aim(0, 'player', this.s.px, this.s.py);
  this.s.objs.forEach(function (o) { aim(o.id, o.k, o.x, o.y); });
  Object.keys(this.vis).forEach(function (id) { if (!seen[id]) delete self.vis[id]; });
};

PuzzleScene.prototype.cx = function (x) { return this.ox + x * T + T / 2; };
PuzzleScene.prototype.cy = function (y) { return this.oy + y * T + T / 2 - 3; };

PuzzleScene.prototype.act = function (a) {
  if (this.s.won || this.s.lost) return;
  var prev = this.s, r = Rules.step(prev, a);
  if (!r) {
    sfx('bump');
    if (a.t === 'move') { var v = this.vis[0]; v.nudge = 0.12; v.nd = a.d; }
    return;
  }
  this.hist.push(prev);
  this.s = r.s;
  this.acted = true;
  this.card = Math.min(this.card, 0.3);
  this.react(prev, r.ev);
  this.sync(false);
  var vis = this.vis;
  (this.snapIds || []).forEach(function (id) { var v = vis[id]; if (v) { v.t = 1; v.fx = v.dx = v.x; v.fy = v.dy = v.y; v.hop = 0; } });
  this.snapIds = null;
  this.aimCache = null;
  this.bossMusic();
};

PuzzleScene.prototype.ghost = function (o, kind) {
  this.ghosts.push({ k: o.k, rows: rowsFor(o), x: o.x, y: o.y, t: 0, kind: kind, d: o.d, flip: o.d === 1 });
};
// Sounds the effect pass may not have yet fall back to near relatives.
var SFX_FALLBACK = { glint: 'select', swap: 'ok', fire: 'zap', clank: 'bump', eat: 'pick', print: 'drop', shatter: 'smash', overclock: 'aim', turn: 'select', hunt: 'step', slam: 'boom', bosshit: 'hit', bossdie: 'huskdie', bossstep: 'bump', hire: 'ok', phase: 'aim', bosstel: 'tick', door: 'push', beam: 'slam', stack: 'push', bossturn: 'turn', bossdrive: 'bossstep', bossfall: 'bossdie', flip: 'carry', keycard: 'chip', enter: 'ok', slide: 'step', cook: 'tick', grease: 'push', portal: 'aim', pay: 'chip', relink: 'carry', bosswarp: 'boom', spray: 'push', sprout: 'pick', grow: 'pick', shove: 'push', sow: 'drop', toggle: 'select', split: 'glint', bossfire: 'zap', reboot: 'aim', jump: 'push', pull: 'aim', park: 'push', magnets: 'select', crumble: 'smash', crack: 'push', boing: 'bump', wind: 'ok', spring: 'bossstep' };
var BOSS_WORD = { slam: 'SLAM', step: 'STEP', hire: 'HIRE', wait: 'WAIT', stack: 'STACK', turn: 'TURN', beam: 'BEAM', drive: 'DRIVE', flip: 'FLIP', grease: 'GREASE', charge: 'CHARGE', relink: 'RELINK', warp: 'WARP', sow: 'SOW', spray: 'SPRAY', fire: 'FIRE', reboot: 'REBOOT', park: 'PARK', magnets: 'MAGNETS', crack: 'CRACK', spring: 'SPRING', wind: 'WIND' };
PuzzleScene.prototype.boss = function () {
  for (var i = 0; i < this.s.objs.length; i++) if (this.s.objs[i].k === 'boss') return this.s.objs[i];
  return null;
};
function sfx2(name, arg) { sfx(SFX[name] ? name : SFX_FALLBACK[name] || name, arg); }

PuzzleScene.prototype.react = function (prev, ev) {
  var self = this, area = this.area;
  var prevObj = {};
  prev.objs.forEach(function (o) { prevObj[o.id] = o; });
  [0, 1].forEach(function (gi) { if (prev.open[gi] !== self.s.open[gi]) sfx2('door', self.s.open[gi]); });
  var nb = this.boss();
  if (nb && !nb.dead) sfx2('bosstel', nb.tel.split(':')[0]);
  if (ev.some(function (e) { return e.e === 'carry'; })) sfx2('carry');
  this.s.objs.forEach(function (o) {
    var p = prevObj[o.id];
    if (o.k === 'ram' && p && (p.x !== o.x || p.y !== o.y)) { sfx('roll'); FX.dust(self.cx(p.x), self.cy(p.y) + 6); }
  });
  ev.forEach(function (e) {
    var x = e.x !== undefined ? self.cx(e.x) : 0, y = e.y !== undefined ? self.cy(e.y) : 0;
    switch (e.e) {
      case 'step': sfx('step'); break;
      case 'pick':
        e.slots.forEach(function (sl, i) {
          sfx('pick', sl);
          self.slotPulse[sl] = 0.35;
          FX.add({ k: 'fly', c: self.s.inv[sl], x0: x - 3, y0: y - 3, x1: 4 + sl * 18 + 2, y1: HUD_Y + 5, life: 0.28, max: 0.28, d: i * 0.06 });
        });
        break;
      case 'drop': sfx('drop', e.slot); self.slotPulse[e.slot] = 0.35; self.dropT[e.y * self.s.w + e.x] = 0.2; break;
      case 'zap': {
        if (!e.branch) sfx('zap');
        var pts = e.path.map(function (p) { return p && [self.cx(p[0]), self.cy(p[1])]; });
        var d0 = self.s.face;
        if (!e.branch) pts[0] = [pts[0][0] + Rules.DX[d0] * 6, pts[0][1] + Rules.DY[d0] * 6];
        var last = pts[pts.length - 1];
        if (e.hit === 'block' || e.hit === 'norecipe') last = [last[0] - Rules.DX[e.d] * 6, last[1] - Rules.DY[e.d] * 6];
        pts[pts.length - 1] = last;
        for (var pi = 0; pi + 1 < pts.length; pi++) if (pts[pi] && pts[pi + 1]) FX.beam(pts[pi][0], pts[pi][1], pts[pi + 1][0], pts[pi + 1][1], PAL.sky);
        FX.sparkle(pts[0][0], pts[0][1], 3);
        if (e.hit === 'split') FX.burst(last[0], last[1], [PAL.sky, PAL.white], 6, 24);
        if (e.hit === 'block' || e.hit === 'norecipe' || !e.hit) { sfx('fizzle'); FX.burst(last[0], last[1], [PAL.g2, PAL.g1], 6, 20); }
        break;
      }
      case 'glint': { var gv = self.vis[e.id]; if (gv) gv.flash = 0.12; sfx2('glint'); break; }
      case 'swap': {
        sfx2('swap');
        FX.ring(self.cx(e.x0), self.cy(e.y0), 12, PAL.magenta, 0.35);
        FX.ring(self.cx(e.x1), self.cy(e.y1), 12, PAL.magenta, 0.35);
        FX.sparkle(self.cx(e.x1), self.cy(e.y1), 6);
        self.snapIds = [0, e.id];
        break;
      }
      case 'overclock': { sfx2('overclock'); var ov = self.vis[e.id]; if (ov) ov.flash = 0.15; break; }
      case 'fire': {
        sfx2('fire');
        var fvv = self.vis[e.id];
        if (fvv) { fvv.nudge = 0.1; fvv.nd = (e.d + 2) % 4; }
        FX.burst(x + Rules.DX[e.d] * 8, y + Rules.DY[e.d] * 8, [PAL.teal, PAL.white], 5, 25);
        break;
      }
      case 'pop': sfx2('pop'); FX.burst(self.cx(e.x) + Rules.DX[e.d] * 6, self.cy(e.y) + Rules.DY[e.d] * 6, [PAL.white, PAL.sky], 5, 25); break;
      case 'zapped':
        sfx('hurt'); self.vis[0].flash = 0.25; self.heartShake = 0.3; FX.shake(2);
        FX.burst(x, y, [PAL.sky, PAL.white], 8, 35);
        break;
      case 'clank': {
        sfx2('clank');
        FX.burst(x, y - 2, [PAL.white, PAL.yellow], 6, 30);
        var cv2 = self.vis[e.id]; if (cv2) cv2.flash = 0.08;
        break;
      }
      case 'eat': sfx2('eat'); FX.burst(x, y, [PAL.red, PAL.yellow, PAL.cobalt], 6, 25); break;
      case 'spill': FX.sparkle(x, y, 5); break;
      case 'print': sfx2('print'); self.dropT[e.y * self.s.w + e.x] = 0.25; FX.burst(x, y - 4, [PAL.white, PAL.g1], 4, 15); break;
      case 'shatter':
        sfx2('shatter');
        FX.debris(x, y - 2, [PAL.white, PAL.sky, '#bff2ff', PAL.ink], 12);
        FX.shake(2);
        break;
      case 'turn': sfx2('turn'); break;
      case 'hunt': sfx2('hunt'); break;
      case 'echo': break;
      case 'slam':
        sfx2('slam');
        FX.shake(6);
        e.tiles.forEach(function (p, i) {
          FX.flash(self.ox + p[0] * T, self.oy + p[1] * T - 3, T, T, i & 1 ? PAL.red : PAL.orange, 0.35);
          if (i % 2 === 0) FX.debris(self.cx(p[0]), self.cy(p[1]), [area.wallFront, PAL.g2], 3);
        });
        break;
      case 'bosshit': { sfx2('bosshit'); var bv = self.vis[e.id]; if (bv) bv.flash = 0.18; FX.shake(3); FX.burst(self.cx(e.x) + 8, self.cy(e.y) + 8, [PAL.white, PAL.red, PAL.yellow], 14, 50); break; }
      case 'bossdie':
        sfx2('bossdie');
        FX.shake(7);
        FX.ring(self.cx(e.x) + 8, self.cy(e.y) + 8, 34, PAL.white, 0.6);
        FX.burst(self.cx(e.x) + 8, self.cy(e.y) + 8, [PAL.red, PAL.white, PAL.yellow, PAL.cobalt], 40, 90);
        self.ghosts.push({ k: 'boss', rows: SPR.boss, x: e.x, y: e.y + 1, oy: -16, t: 0, kind: 'pop' });
        break;
      case 'bossstep': sfx2('bossstep'); FX.shake(2); break;
      case 'beam':
        sfx2('beam'); FX.shake(4);
        e.tiles.forEach(function (p, i) { FX.flash(self.ox + p[0] * T, self.oy + p[1] * T - 3, T, T, i & 1 ? PAL.sky : PAL.white, 0.3); });
        break;
      case 'stack': sfx2('stack'); FX.shake(2); FX.debris(x, y, ['#a8784a', '#6a4a2a', PAL.ink], 6); break;
      case 'bossturn': sfx2('bossturn'); break;
      case 'bossdrive': sfx2('bossdrive'); FX.shake(2); FX.dust(x + 8, y + 12); break;
      case 'bossfall': {
        sfx2('bossfall'); FX.shake(7);
        var fo = prevObj[e.id] || {};
        self.ghosts.push({ k: 'boss', rows: rowsFor(fo), x: e.x + Rules.DX[e.d], y: e.y + 1, oy: -16, t: 0, kind: 'fall', flip: fo.f === 3 });
        FX.burst(self.cx(e.x) + 8, self.cy(e.y) + 8, [PAL.yellow, PAL.white, PAL.g2], 30, 70);
        break;
      }
      case 'flip': sfx2('flip'); FX.shake(1); break;
      case 'slide': sfx2('slide'); if (e.id === 0) FX.dust(self.cx(self.s.px), self.cy(self.s.py) + 6); break;
      case 'cook': sfx2('cook'); FX.add({ k: 'p', x: x, y: y - 4, vx: 0, vy: -12, g: 0, life: 0.5, c: PAL.white, s: 1 }); break;
      case 'grease':
        sfx2('grease');
        e.tiles.forEach(function (p) { FX.flash(self.ox + p[0] * T, self.oy + p[1] * T, T, T, '#e8c060', 0.3); });
        break;
      case 'portal': {
        sfx2('portal');
        var pc = PORTAL_COLOR[portalPair(self.s, Rules.tile(self.s, e.x1, e.y1))];
        FX.ring(self.cx(e.x0), self.cy(e.y0), 10, pc, 0.3);
        FX.ring(self.cx(e.x1), self.cy(e.y1), 10, pc, 0.3);
        (self.snapIds = self.snapIds || []).push(e.id);
        break;
      }
      case 'pay': sfx2('pay'); self.slotPulse[e.slot] = 0.35; FX.burst(x, y, [PAL.pink, PAL.white, PAL.magenta], 10, 30); FX.sparkle(x, y, 6); break;
      case 'relink':
        sfx2('relink', self.s.link); FX.shake(2);
        Object.keys(self.s.ports).forEach(function (c) { var pi = self.s.ports[c]; FX.flash(self.ox + (pi % self.s.w) * T, self.oy + Math.floor(pi / self.s.w) * T, T, T, PAL.white, 0.3); });
        break;
      case 'spray': {
        sfx2('spray');
        var sp = e.path.map(function (p) { return p && [self.cx(p[0]), self.cy(p[1]) + 2]; });
        for (var si = 0; si + 1 < sp.length; si++) if (sp[si] && sp[si + 1]) FX.beam(sp[si][0], sp[si][1], sp[si + 1][0], sp[si + 1][1], '#9ad8ff');
        var se = sp[sp.length - 1];
        FX.burst(se[0], se[1], ['#9ad8ff', PAL.white, PAL.sky], 5, 22);
        break;
      }
      case 'sprout': case 'grow':
        sfx2(e.e); FX.burst(x, y - 4, [PAL.lime, PAL.green, PAL.pink], 8, 26); FX.flash(self.ox + e.x * T, self.oy + e.y * T - 5, T, T, PAL.lime, 0.2);
        break;
      case 'shove': sfx2('shove'); break;
      case 'toggle': {
        sfx2('toggle', e.on);
        var sc = e.on ? SWITCH_ON : SWITCH_OFF, st = self.s;
        for (var di = 0; di < st.tiles.length; di++) if (st.tiles[di] === 'J' || st.tiles[di] === 'j') FX.flash(self.ox + (di % st.w) * T, self.oy + Math.floor(di / st.w) * T - LIFT, T, T + LIFT, sc, 0.25);
        break;
      }
      case 'split': sfx2('split'); FX.burst(x, y - 4, [PAL.sky, PAL.white], 6, 24); break;
      case 'jump': {
        sfx2('jump');
        var jv = self.vis[e.id];
        if (jv) jv.hop = 1;
        FX.dust(self.cx(e.x0), self.cy(e.y0) + 6); FX.dust(self.cx(e.x1), self.cy(e.y1) + 6);
        break;
      }
      case 'pull': { sfx2('pull'); var pv = self.vis[e.mag]; if (pv) pv.flash = 0.1; break; }
      case 'park': sfx2('park'); FX.shake(2); FX.dust(x, y + 6); break;
      case 'magnets': sfx2('magnets'); FX.shake(1); break;
      case 'boing': { sfx2('boing'); FX.ring(x, y, 9, PAL.yellow, 0.25); var bv = self.vis[e.id]; if (bv) bv.flash = 0.1; break; }
      case 'wind': sfx2('wind'); FX.ring(x, y, 12, PAL.red, 0.4); FX.sparkle(x, y, 5); break;
      case 'crumble': sfx2('crumble'); FX.debris(x, y + 4, [area.floorA, area.floorB, PAL.ink], 8); break;
      case 'crack':
        sfx2('crack');
        e.tiles.forEach(function (p) { FX.burst(self.cx(p[0]), self.cy(p[1]) + 4, [PAL.ink, area.floorB], 3, 16); });
        break;
      case 'bossfire': sfx2('bossfire'); FX.shake(2); break;
      case 'reboot': sfx2('reboot'); FX.shake(3); { var rb = self.vis[e.id]; if (rb) rb.flash = 0.3; } break;
      case 'sow':
        sfx2('sow');
        e.tiles.forEach(function (p) { FX.burst(self.cx(p[0]), self.cy(p[1]), ['#f0e0a8', '#7a5228'], 3, 18); });
        break;
      case 'bosswarp':
        sfx2('bosswarp'); FX.shake(3);
        FX.ring(self.cx(e.x0) + 8, self.cy(e.y0) + 8, 18, PAL.pink, 0.4);
        FX.ring(self.cx(e.x1) + 8, self.cy(e.y1) + 8, 18, PAL.pink, 0.4);
        (self.snapIds = self.snapIds || []).push(e.id);
        break;
      case 'hire': sfx2('hire'); FX.ring(x, y, 12, PAL.yellow, 0.4); break;
      case 'phase': { sfx2('phase'); var phv = self.vis[e.id]; if (phv) phv.flash = 0.4; break; }
      case 'compile':
        sfx('compile', e.k);
        FX.ring(x, y, 14, PAL.sky, 0.3);
        FX.sparkle(x, y, 8);
        FX.burst(x, y, [PAL.sky, PAL.white, PAL.yellow], 12, 35);
        break;
      case 'spot':
        if (self.findObj(e.id)) {
          sfx('spot');
          var ic = FX.icon(SPR.bang, 0, 0, 0.6), rid = e.id;
          ic.follow = function () { var v = self.vis[rid]; return v ? [self.ox + v.dx * T + T / 2, self.oy + v.dy * T - 20] : null; };
        }
        break;
      case 'hit': {
        sfx('hit');
        FX.burst(x, y, [PAL.white, PAL.red], 8, 40);
        FX.shake(1);
        var hv = self.vis[e.id];
        if (hv) { hv.flash = 0.14; if (e.by === 0) { hv.nudge = 0.12; hv.nd = self.s.face; } }
        if (e.by === 0) { var pv = self.vis[0]; pv.nudge = 0.1; pv.nd = self.s.face; }
        break;
      }
      case 'die': {
        var po = prevObj[e.id] || e;
        self.ghost(Object.assign({}, po, { k: e.k || po.k, x: e.x, y: e.y }), 'pop');
        if (e.k === 'husk') { sfx('huskdie'); FX.burst(x, y, [PAL.red, PAL.white, PAL.yellow], 16, 50); FX.ring(x, y, 12, PAL.white, 0.3); }
        else FX.burst(x, y, [PAL.g1, PAL.orange], 10, 40);
        break;
      }
      case 'smash':
        sfx('smash');
        FX.debris(x, y - 2, e.k === '&' ? [VINE_LOOK.wallHi, VINE_LOOK.wallTop, PAL.pink, PAL.green] : [area.crack, area.wallTop, area.wallFront, PAL.ink], 12);
        FX.flash(self.ox + e.x * T, self.oy + e.y * T - LIFT, T, T + LIFT, PAL.white, 0.2);
        FX.shake(3);
        break;
      case 'fill':
        sfx('fill');
        self.ghost(prevObj[e.id] || { k: 'ram', x: e.x, y: e.y }, 'sink');
        self.ghosts[self.ghosts.length - 1].x = e.x; self.ghosts[self.ghosts.length - 1].y = e.y;
        self.fillT = self.fillT || {};
        self.fillT[e.y * self.s.w + e.x] = 0.5;
        FX.ring(x, y + 4, 10, PAL.white, 0.4);
        FX.shake(2);
        break;
      case 'fall': self.ghost(prevObj[e.id] || { k: 'fork', x: e.x, y: e.y }, 'fall'); self.ghosts[self.ghosts.length - 1].x = e.x; self.ghosts[self.ghosts.length - 1].y = e.y; break;
      case 'boom':
        sfx('boom');
        self.ghost(prevObj[e.id] || { k: 'fork', x: e.x, y: e.y }, 'pop');
        FX.flash(self.ox + (e.x - 1) * T, self.oy + (e.y - 1) * T - 3, T * 3, T * 3, PAL.yellow, 0.45);
        FX.flash(self.ox + (e.x - 1) * T + 4, self.oy + (e.y - 1) * T + 1, T * 3 - 8, T * 3 - 8, PAL.orange, 0.3);
        FX.ring(x, y, 26, PAL.yellow, 0.4);
        FX.burst(x, y, [PAL.yellow, PAL.orange, PAL.red, PAL.white], 28, 80);
        FX.shake(5);
        break;
      case 'tick': sfx('tick', (self.findObj(e.id) || {}).f); var fv = self.vis[e.id]; if (fv) fv.flash = 0.08; break;
      case 'push': sfx('push'); break;
      case 'bite': case 'crush': case 'burn':
        sfx('hurt');
        self.vis[0].flash = 0.25;
        self.heartShake = 0.3;
        FX.shake(e.e === 'bite' ? 2 : 4);
        FX.burst(self.cx(self.s.px), self.cy(self.s.py), [PAL.red, PAL.white], 8, 35);
        break;
      case 'win':
        self.winT = 0;
        sfx('chip');
        jingle('clear');
        FX.sparkle(x, y, 10);
        FX.ring(x, y, 18, PAL.lime, 0.5);
        if (!Save.data.done[self.def.id]) { Save.data.done[self.def.id] = 1; Save.store(); mend(); }
        var card = keycardOf(self.def);
        if (card) { Save.data.keys = Save.data.keys || {}; Save.data.keys[card] = 1; Save.store(); FX.ring(x, y, 26, KEYCARD_COLOR[card], 0.6); sfx2('keycard', card); }
        break;
      case 'lose': self.loseT = 0; jingle('lose'); break;
    }
  });
};

PuzzleScene.prototype.findObj = function (id) {
  for (var i = 0; i < this.s.objs.length; i++) if (this.s.objs[i].id === id) return this.s.objs[i];
  return null;
};

PuzzleScene.prototype.undo = function () {
  if (!this.hist.length) return;
  this.s = this.hist.pop();
  this.aim = false;
  this.winT = this.s.won ? 9 : -1;
  this.loseT = -1;
  this.ghosts = [];
  this.sync(true);
  this.bossMusic();
  sfx('undo');
};
PuzzleScene.prototype.restart = function () {
  this.hist.push(this.s);
  this.s = Rules.load(this.def);
  this.aim = false; this.winT = -1; this.loseT = -1; this.ghosts = [];
  this.sync(true);
  this.bossMusic();
  sfx('undo');
};

PuzzleScene.prototype.key = function (ev) {
  if (this.help) { this.help = false; Save.data.seen.help = 1; Save.store(); sfx('select'); return; }
  if (ev.code === 'KeyM') { setMuted(!Sound.muted); return; }
  if (this.introCard && !this.s.won) { this.introCard = false; this.card = 0; sfx('select'); return; }
  if (this.s.won) {
    if (this.winT < 0.5) return;
    // A final stage leads straight into the next stage, and the last one into the ending.
    var nextLi = this.def.next ? LEVELS.findIndex(function (l) { return l.id === this.def.next; }, this) : -1;
    if (isOk(ev) && nextLi >= 0) { sfx('ok'); setScene(new PuzzleScene(nextLi)); }
    else if (isOk(ev) && this.def.ending) { sfx('ok'); setScene(new EndingScene()); }
    else if (isOk(ev) || isBack(ev)) { sfx('ok'); toWorld(this.li); }
    else if (ev.code === 'KeyZ' || ev.code === 'Backspace') this.undo();
    return;
  }
  var d = dirOf(ev);
  if (d >= 0) {
    if (this.aim || ev.shift) { this.aim = false; this.act({ t: 'zap', d: d }); }
    else this.act({ t: 'move', d: d });
    return;
  }
  if (ev.code === 'KeyX') { if (!this.s.lost) { this.aim = !this.aim; sfx('aim'); } return; }
  if (ev.code === 'Digit1' || ev.code === 'Digit2' || ev.code === 'Digit3' || ev.code === 'KeyC') {
    var i = ev.code === 'KeyC' ? this.s.inv.findIndex(function (c) { return c; }) : +ev.code.slice(5) - 1;
    if (i >= 0 && this.s.inv[i]) this.act({ t: 'drop', i: i }); else sfx('bump');
    return;
  }
  if (ev.code === 'Space' || ev.code === 'Period') { this.act({ t: 'wait' }); return; }
  if (ev.code === 'KeyZ' || ev.code === 'Backspace') { this.undo(); return; }
  if (ev.code === 'KeyR') { this.restart(); return; }
  if (ev.code === 'KeyH') { this.help = true; return; }
  if (isBack(ev)) { if (this.aim) this.aim = false; else { sfx('back'); toWorld(this.li); } }
};

PuzzleScene.prototype.update = function (dt) {
  var self = this;
  Object.keys(this.vis).forEach(function (id) {
    var v = self.vis[id];
    v.t = Math.min(1, v.t + dt / (v.k === 'player' ? 0.11 : 0.13));
    var e = ease(v.t);
    v.dx = v.fx + (v.x - v.fx) * e;
    v.dy = v.fy + (v.y - v.fy) * e;
    if (v.t >= 1) v.hop = 0;
    if (v.spawn < 1) v.spawn = Math.min(1, v.spawn + dt / 0.25);
    v.flash = Math.max(0, v.flash - dt);
    v.nudge = Math.max(0, v.nudge - dt);
  });
  this.ghosts.forEach(function (gh) { gh.t += dt; });
  this.ghosts = this.ghosts.filter(function (gh) { return gh.t < 0.6; });
  for (var i = 0; i < 3; i++) this.slotPulse[i] = Math.max(0, this.slotPulse[i] - dt);
  Object.keys(this.dropT).forEach(function (k) { self.dropT[k] -= dt; if (self.dropT[k] <= 0) delete self.dropT[k]; });
  if (this.fillT) Object.keys(this.fillT).forEach(function (k) { self.fillT[k] -= dt; if (self.fillT[k] <= 0) delete self.fillT[k]; });
  this.heartShake = Math.max(0, (this.heartShake || 0) - dt);
  if (!this.help && !this.introCard) this.card -= dt;
  if (this.winT >= 0) this.winT += dt;
  if (this.loseT >= 0) this.loseT += dt;
  FX.update(dt);
  if (this.winT > 0 && Math.random() < dt * 6) { var s = this.s; FX.sparkle(this.cx(s.px), this.cy(s.py) - 14 - Math.min(18, this.winT * 40), 1); }
};

PuzzleScene.prototype.isBlock = function (x, y) {
  return Rules.tile(this.s, x, y) === '#' && this.shown[y * this.s.w + x];
};
PuzzleScene.prototype.isShown = function (x, y) {
  var t = Rules.tile(this.s, x, y);
  if (t === '_' || t === 'X') return false;
  return t !== '#' || this.shown[y * this.s.w + x];
};

PuzzleScene.prototype.heavyAt = function (x, y) {
  return (this.s.px === x && this.s.py === y) || !!Rules.objAt(this.s, x, y);
};

PuzzleScene.prototype.draw = function () {
  var s = this.s, a = this.area, self = this, t = Game.t;
  drawVoid(a, t);
  var sh = Game.shake > 0.2 ? Math.round((Math.random() - 0.5) * Game.shake * 2) : 0, sv = Game.shake > 0.2 ? Math.round((Math.random() - 0.5) * Game.shake * 2) : 0;
  g.save();
  g.translate(sh, sv);
  var ox = this.ox, oy = this.oy;
  for (var y = 0; y < s.h; y++) for (var x = 0; x < s.w; x++) {
    var c = s.tiles[y * s.w + x], px = ox + x * T, py = oy + y * T;
    if (!this.isShown(x, y)) continue;
    if (Rules.CONV[c] !== undefined) drawConveyor(px, py, Rules.CONV[c], t);
    else if (c === '.' || c === 'g' || c === '=' || c === 'i' || c === 'w' || c === '$' || c === ',' || c === '&' || c === 'J' || c === 'j' || c === 'A' || c === ';' || c === 'O' || Rules.LINKS[0][c] || Rules.PLATE[c] !== undefined || Rules.DOOR[c] !== undefined) {
      var fill = this.fillT && this.fillT[y * s.w + x];
      drawFloor(px, py, a, x, y);
      if (fill) dither(px, py, T, T, null, a.cliffDk, Math.round(fill * 30));
      if (c === 'i') drawGrease(px, py, t, (Rules.tile(s, x, y - 1) !== 'i' ? 1 : 0) | (Rules.tile(s, x + 1, y) !== 'i' ? 2 : 0) | (Rules.tile(s, x, y + 1) !== 'i' ? 4 : 0) | (Rules.tile(s, x - 1, y) !== 'i' ? 8 : 0));
      if (c === 'w') drawMicrowave(px, py, !!s.bits[y * s.w + x], t);
      if (Rules.LINKS[0][c]) drawPortal(px, py, portalPair(s, c), t + x * 0.3);
      if (c === ',') drawSeed(px, py, t + x * 0.4);
      if (c === 'A') drawRamp(px, py);
      if (c === ';') drawCracked(px, py);
      if ((c === 'J' || c === 'j') && Rules.walkable(s, x, y)) drawSwitchDoor(px, py, c === 'J', true);
      if (Rules.PLATE[c] !== undefined) drawPlate(px, py, Rules.PLATE[c], this.heavyAt(x, y));
      if (Rules.DOOR[c] !== undefined && Rules.doorOpen(s, c)) drawDoorOpen(px, py, Rules.DOOR[c]);
    }
    if (!this.isShown(x, y + 1)) drawCliff(px, py + T, a);
  }
  // Projector light, so the player can see what will stand still next turn.
  var lit = Rules.lightUp(s);
  Object.keys(lit).forEach(function (k) { if (+k < s.tiles.length) drawLit(ox + (k % s.w) * T, oy + Math.floor(k / s.w) * T, t); });
  if (s.goal >= 0 && !(s.won && this.winT > 0)) {
    var gx = s.goal % s.w, gy = Math.floor(s.goal / s.w);
    spr(SPR.chip, ox + gx * T + 3, oy + gy * T + 3 - (Math.floor(t * 2.5) & 1));
    if (Math.floor(t * 0.8) % 3 === 0 && (Math.floor(t * 8) & 1)) rect(ox + gx * T + 12, oy + gy * T + 2, 1, 1, PAL.white);
  }
  Object.keys(s.bits).forEach(function (k) {
    var bx = ox + (k % s.w) * T, by = oy + Math.floor(k / s.w) * T, st = s.bits[k];
    var lift = self.dropT[k] ? Math.round(self.dropT[k] * 20) : 0, bob = (Math.floor(t * 2 + +k) & 1);
    if (st.length === 1) spr(SPR['bit' + st[0]], bx + 5, by + 5 - lift - bob);
    else { spr(SPR['bit' + st[0]], bx + 4, by + 8 - bob); spr(SPR['bit' + st[1]], bx + 5, by + 2 - lift - bob); }
  });
  if (this.aim) this.drawAim();

  var vis = this.vis, rows = {}, packets = [];
  Object.keys(vis).forEach(function (id) {
    var v = vis[id];
    if (v.k === 'packet') { packets.push(+id); return; }
    var r = Math.round(v.dy !== undefined ? v.dy : v.y) + (v.k === 'boss' ? 1 : 0);
    (rows[r] = rows[r] || []).push(+id);
  });
  for (var row = -1; row <= s.h; row++) {
    for (var x2 = 0; x2 < s.w; x2++) {
      var c2 = Rules.tile(s, x2, row), bx2 = ox + x2 * T, by2 = oy + row * T;
      if (c2 === '%' || this.isBlock(x2, row)) drawBlock(bx2, by2, a, c2 === '%' ? {} : { u: this.isBlock(x2, row - 1), d: this.isBlock(x2, row + 1), l: this.isBlock(x2 - 1, row), r: this.isBlock(x2 + 1, row) }, c2 === '%');
      else if (Rules.PRINTER[c2]) drawPrinter(bx2, by2, Rules.PRINTER[c2], t + x2);
      else if (c2 === '=') drawKey(bx2, by2, '=');
      else if (c2 === '$') drawTokenGate(bx2, by2, t + x2 * 0.5);
      else if (c2 === '*') drawSplitter(bx2, by2, t + x2 * 0.3);
      else if (c2 === 'O') drawBumper(bx2, by2, t + x2 * 0.4);
      else if (c2 === '!') drawSwitch(bx2, by2, !!s.sw);
      else if ((c2 === 'J' || c2 === 'j') && !Rules.walkable(s, x2, row)) drawSwitchDoor(bx2, by2, c2 === 'J', false);
      else if (c2 === '&') drawBlock(bx2, by2, VINE_LOOK, { u: Rules.tile(s, x2, row - 1) === '&', d: Rules.tile(s, x2, row + 1) === '&', l: Rules.tile(s, x2 - 1, row) === '&', r: Rules.tile(s, x2 + 1, row) === '&' });
      else if (Rules.DOOR[c2] !== undefined && !Rules.doorOpen(s, c2)) drawDoorClosed(bx2, by2, Rules.DOOR[c2]);
    }
    this.ghosts.forEach(function (gh) { if (gh.y === row) self.drawGhost(gh); });
    (rows[row] || []).sort(function (p, q) { return vis[p].dx - vis[q].dx; }).forEach(function (id) { self.drawVis(id); });
    for (var x3 = 0; x3 < s.w; x3++) if (Rules.tile(s, x3, row) === 'g') drawGlass(ox + x3 * T, oy + row * T);
  }
  packets.forEach(function (id) { self.drawPacket(id); });
  // A stack under something that stands on it still shows, as a badge in the tile's corner.
  Object.keys(s.bits).forEach(function (k) {
    var bx = k % s.w, by = Math.floor(k / s.w), st = s.bits[k];
    if (!Rules.objAt(s, bx, by) || (s.px === bx && s.py === by)) return;
    var x0 = ox + bx * T + 1, y0 = oy + by * T + 10;
    rect(x0, y0, st.length * 4 + 1, 5, PAL.ink);
    for (var j = 0; j < st.length; j++) rect(x0 + 1 + j * 4, y0 + 1, 3, 3, BIT_COLOR[st[j]]);
  });
  this.drawBossTel();
  Object.keys(vis).forEach(function (id) {
    var o = self.findObj(+id), v = vis[id];
    if (!o) return;
    var cx = ox + v.dx * T + T / 2, top = oy + v.dy * T - 3;
    if (o.k === 'husk') {
      drawPips(cx, top - 4, o.hp, o.maxHp);
      if ((o.ai === 'pace' || o.ai === 'hoard') && o.pd >= 0) drawArrow(cx + Rules.DX[o.pd] * 11, top + 9 + Rules.DY[o.pd] * 11, o.pd, PAL.red);
    }
    if (o.k === 'ram' && o.d >= 0) drawArrow(cx + Rules.DX[o.d] * 11, top + 9 + Rules.DY[o.d] * 11, o.d, PAL.yellow);
  });
  FX.draw();
  g.restore();
  this.drawHud();
  this.drawBossBar();
  if (!this.s.won && (this.introCard || this.card > 0)) this.drawCard();
  if (this.help) this.drawHelp();
  else if (s.won && this.winT > 0.5) {
    var kc = keycardOf(this.def);
    if (this.def.next) this.drawBanner('STAGE CLEAR', 'Enter: next stage', PAL.teal);
    else if (this.def.ending) this.drawBanner('THE STATIC BREAKS', 'Enter: go to Tilde', PAL.pink);
    else this.drawBanner(kc ? kc.toUpperCase() + ' KEYCARD' : 'CHIP RECOVERED', 'Enter: back to the ruins', kc ? KEYCARD_COLOR[kc] : PAL.green);
  }
  else if (s.lost && this.loseT > 0.5) this.drawBanner('SIGNAL LOST', 'Z undo   R restart', PAL.redDk);
};

PuzzleScene.prototype.drawPacket = function (id) {
  var v = this.vis[id], o = this.findObj(id);
  if (!o) return;
  var x = this.ox + v.dx * T + 5, y = this.oy + v.dy * T + 2, d = o.d;
  for (var i = 1; i <= 3; i++) rect(x + 2 - Rules.DX[d] * (i * 3 + 1), y + 2 - Rules.DY[d] * (i * 3 + 1), 2, 2, i === 1 ? PAL.sky : PAL.tealDk);
  spr(SPR.packet, x, y);
};

PuzzleScene.prototype.drawVis = function (id) {
  var v = this.vis[id], ox = this.ox, oy = this.oy, t = Game.t;
  var x = ox + v.dx * T, y = oy + v.dy * T - 3;
  if (v.hop) y -= Math.round(Math.sin(Math.PI * v.t) * 2);
  if (v.nudge > 0) { var k = Math.round(Math.sin(v.nudge / 0.12 * Math.PI) * 2); x += Rules.DX[v.nd] * k; y += Rules.DY[v.nd] * k; }
  var opts = v.flash > 0 ? { tint: id === 0 ? PAL.red : PAL.white } : null;
  if (id === 0) {
    var s = this.s;
    if (s.lost) { sprDither(SPR.pilFront, x, y, Math.max(0, 16 - Math.round(this.loseT * 40)), false, opts); return; }
    var f = s.face, rows = f === 0 ? SPR.pilBack : f === 2 ? SPR.pilFront : SPR.pilSide;
    var bob = v.t >= 1 && !this.aim && (Math.floor(t * 2) & 1) ? 1 : 0;
    if (s.won) y -= Math.min(4, Math.round(this.winT * 12));
    spr(rows, x, y + bob, f === 3, opts || (f === 3 ? LEFT_SWAP : null));
    if (this.aim) {
      var sp = (Math.floor(t * 6) & 1) ? 1 : 0;
      spr(SPR.spark, x + 6 + Rules.DX[f] * 7, y + 6 + Rules.DY[f] * 7 - sp);
    }
    return;
  }
  var o = this.findObj(id);
  if (!o) return;
  var level = v.spawn < 1 ? Math.round(v.spawn * 16) : 16;
  function put(rows, flip, extra) {
    var op = opts || extra || null;
    if (level < 16) sprDither(rows, x, y, level, flip, op); else spr(rows, x, y, flip, op);
  }
  switch (o.k) {
    case 'husk': {
      var base = rowsFor(o), alt = o.ai === 'still' || o.ai === 'pace' ? SPR.husk2 : base;
      put((Math.floor(t * 2 + id * 0.7) & 1) ? alt : base, o.ai === 'hoard' && o.pd === 3);
      if (o.ai === 'clerk') this.drawShield(x, y, o.f);
      if (o.ai === 'hoard') for (var b = 0; b < o.belly.length; b++) rect(x + 6 + b * 4, y + 7, 3, 3, BIT_COLOR[o.belly[b]]);
      break;
    }
    case 'ram': {
      var flip = o.d === 1 || (o.d < 0 && v.lastFlip);
      v.lastFlip = flip;
      put(v.roll & 1 ? SPR.ram2 : SPR.ram, flip);
      break;
    }
    case 'fork':
      if (o.f <= 1) x += (Math.floor(t * 12) & 1) ? 1 : 0;
      put(SPR.fork, false);
      if (level >= 16) {
        rect(x + 5, y + 10, 2, 2, o.f >= 2 ? PAL.yellow : PAL.ink);
        rect(x + 9, y + 10, 2, 2, o.f >= 1 ? (o.f === 1 ? PAL.red : PAL.yellow) : PAL.ink);
        rect(x + 9, y + 1, 1, 1, (Math.floor(t * 8) & 1) ? PAL.yellow : PAL.orange); rect(x + 10, y, 1, 1, PAL.white);
      }
      break;
    case 'pinger': {
      put(SPR.pinger, false);
      var d = o.d, mx = x + 8 + Rules.DX[d] * 6, my = y + 7 + Rules.DY[d] * 6;
      rect(mx - 2, my - 2, 4, 4, PAL.ink); rect(mx - 1, my - 1, 2, 2, PAL.teal);
      rect(x + 6, y + 12, 1, 1, o.c === 1 ? PAL.red : PAL.g3); rect(x + 9, y + 12, 1, 1, PAL.yellow);
      break;
    }
    case 'mirror': if (level < 16) sprDither(SPR.miniMirror, x + 4, y + 6, level); else drawMirror(x, y + 2, o.o, v.flash > 0); break;
    case 'decoy': put(SPR.decoy, false); break;
    case 'swapper': y -= (Math.floor(t * 1.5 + id) & 1); put(SPR.swapper, false); break;
    case 'echo': sprDither(SPR.pilFront, x, y + ((Math.floor(t * 2) & 1) ? 1 : 0), Math.min(level, 11), false, opts || ECHO_SWAP); break;
    case 'key': drawKey(x, y + 3, o.v); break;
    case 'sprinkler': drawSprinkler(x, y + 2, o.d, t + id); break;
    case 'magnet': drawMagnet(x, y + 2, o.on, t + id); break;
    case 'projector': drawProjector(x, y + 2, o.d, t + id); break;
    case 'toy': put(SPR.toy, o.d === 3); break;
    case 'boss': this.drawBoss(o, x, y + ((Math.floor(t * 1.5) & 1) ? 1 : 0), opts); break;
    default: put(SPR.brick, false);
  }
};

// The boss shows what it does next: a hatched band for a slam, an arrow for a step, a ring on the door for a hire.
PuzzleScene.prototype.drawBossTel = function () {
  var b = this.boss(), self = this, t = Game.t;
  if (!b || b.dead || this.s.won) return;
  var parts = b.tel.split(':'), act = parts[0], d = +parts[1], blink = Math.floor(t * 4) & 1;
  if (act === 'slam' || act === 'beam') {
    var hot = act === 'slam' ? PAL.red : PAL.sky, cool = act === 'slam' ? PAL.redDk : PAL.cobaltDk;
    Rules.slamBand(this.s, b, d).forEach(function (p) {
      var x = self.ox + p[0] * T, y = self.oy + p[1] * T;
      dither(x, y, T, T, null, hot, blink ? 6 : 4);
      frame(x + 1, y + 1, T - 2, T - 2, blink ? hot : cool);
    });
  } else if (act === 'stack') {
    var xy = parts[1].split(','), kx = this.ox + +xy[0] * T, ky = this.oy + +xy[1] * T;
    for (var i = 0; i < 16; i += 2) { rect(kx + i, ky, 1, 1, PAL.orange); rect(kx + i, ky + 15, 1, 1, PAL.orange); rect(kx, ky + i, 1, 1, PAL.orange); rect(kx + 15, ky + i, 1, 1, PAL.orange); }
    if (blink) { rect(kx + 4, ky + 4, 8, 1, PAL.orange); rect(kx + 4, ky + 11, 8, 1, PAL.orange); }
  } else if (act === 'turn') {
    var tcx = this.ox + (b.x + 1) * T, tcy = this.oy + (b.y + 1) * T - 3;
    drawArrow(tcx + Rules.DX[d] * 20, tcy + Rules.DY[d] * 20, d, blink ? PAL.sky : PAL.white);
  } else if (act === 'drive') {
    var bx0 = b.x, by0 = b.y;
    for (var k = 1; k <= 3; k++) {
      var cxs = d === 1 ? [bx0 + 1 + k] : d === 3 ? [bx0 - k] : [bx0, bx0 + 1];
      var cys = d === 2 ? [by0 + 1 + k] : d === 0 ? [by0 - k] : [by0, by0 + 1];
      cxs.forEach(function (cx) { cys.forEach(function (cy) { if (Rules.tile(self.s, cx, cy) === 'X') return; frame(self.ox + cx * T + 2, self.oy + cy * T + 2, T - 4, T - 4, blink ? PAL.orange : PAL.yellow); }); });
    }
  } else if (act === 'grease') {
    Rules.slamBand(this.s, b, d, 4).forEach(function (p) {
      var x = self.ox + p[0] * T, y = self.oy + p[1] * T;
      dither(x, y, T, T, null, '#e8c060', blink ? 7 : 4);
      frame(x + 1, y + 1, T - 2, T - 2, blink ? PAL.ochre : '#8a6a2a');
    });
  } else if (act === 'charge') {
    var ccx = this.ox + (b.x + 1) * T, ccy = this.oy + (b.y + 1) * T - 3;
    for (var q = 1; q <= 5; q++) drawArrow(ccx + Rules.DX[d] * (14 + q * 6), ccy + Rules.DY[d] * (14 + q * 6), d, blink ? PAL.red : PAL.orange);
  } else if (act === 'flip') {
    for (var ti = 0; ti < this.s.tiles.length; ti++) if (Rules.CONV[this.s.tiles[ti]] !== undefined) frame(this.ox + (ti % this.s.w) * T, this.oy + Math.floor(ti / this.s.w) * T, T, T, blink ? PAL.magenta : PAL.pink);
  } else if (act === 'sow') {
    Rules.slamBand(this.s, b, d, 4).forEach(function (p) {
      var x = self.ox + p[0] * T, y = self.oy + p[1] * T;
      dither(x, y, T, T, null, '#7a5228', blink ? 6 : 3);
      frame(x + 1, y + 1, T - 2, T - 2, blink ? '#f0e0a8' : '#7a5228');
    });
  } else if (act === 'spray') {
    Rules.slamBand(this.s, b, d).forEach(function (p, i) {
      if ((i + Math.floor(t * 6)) % 3) return;
      drawArrow(self.cx(p[0]), self.cy(p[1]) + 3, d, blink ? PAL.sky : PAL.white);
    });
  } else if (act === 'spring') {
    var scx = this.ox + (b.x + 1) * T, scy = this.oy + (b.y + 1) * T - 3;
    for (var sq = 1; sq <= 4; sq++) drawArrow(scx + Rules.DX[d] * (14 + sq * 7), scy + Rules.DY[d] * (14 + sq * 7) - ((sq & 1) ? 2 : 0), d, blink ? PAL.red : PAL.yellow);
  } else if (act === 'wind' && b.door) {
    var wdx = this.cx(b.door.x), wdy = this.cy(b.door.y);
    frame(wdx - 7, wdy - 7, 14, 14, blink ? PAL.red : PAL.yellow);
  } else if (act === 'crack') {
    Rules.slamBand(this.s, b, d, 4).forEach(function (p) {
      if (Rules.tile(self.s, p[0], p[1]) !== '.') return;
      var x = self.ox + p[0] * T, y = self.oy + p[1] * T;
      frame(x + 1, y + 1, T - 2, T - 2, blink ? PAL.ink : PAL.g3);
      if (blink) drawCracked(x, y);
    });
  } else if (act === 'park') {
    var pxy = parts[1].split(','), qx = this.ox + +pxy[0] * T, qy = this.oy + +pxy[1] * T;
    for (var pi3 = 0; pi3 < 16; pi3 += 2) { rect(qx + pi3, qy, 1, 1, PAL.cobalt); rect(qx + pi3, qy + 15, 1, 1, PAL.cobalt); rect(qx, qy + pi3, 1, 1, PAL.cobalt); rect(qx + 15, qy + pi3, 1, 1, PAL.cobalt); }
    if (blink) { rect(qx + 4, qy + 7, 8, 2, PAL.sky); }
  } else if (act === 'magnets') {
    this.s.objs.forEach(function (q) { if (!q.dead && q.k === 'magnet') frame(self.ox + q.x * T, self.oy + q.y * T - 1, T, T, blink ? (q.on ? PAL.g3 : PAL.red) : PAL.white); });
  } else if (act === 'fire') {
    Rules.slamBand(this.s, b, d).forEach(function (p, i) {
      if ((i + Math.floor(t * 8)) % 4) return;
      rect(self.cx(p[0]) - 1, self.cy(p[1]) + 1, 3, 3, blink ? PAL.teal : PAL.white);
    });
  } else if (act === 'reboot') {
    var sv = this.s;
    for (var ri = 0; ri < sv.tiles.length; ri++) if (sv.tiles[ri] === 'J' || sv.tiles[ri] === 'j' || sv.tiles[ri] === '!') frame(this.ox + (ri % sv.w) * T, this.oy + Math.floor(ri / sv.w) * T - LIFT, T, T + LIFT, blink ? (sv.sw ? SWITCH_OFF : SWITCH_ON) : PAL.white);
  } else if (act === 'relink') {
    var sr = this.s, nl = 1 - sr.link;
    Object.keys(sr.ports).forEach(function (c) {
      var pi = sr.ports[c], np = c === '(' || Rules.LINKS[nl]['('] === c ? 0 : 1;
      frame(self.ox + (pi % sr.w) * T, self.oy + Math.floor(pi / sr.w) * T, T, T, blink ? PORTAL_COLOR[np] : PAL.white);
    });
  } else if (act === 'warp') {
    var wp = parts[1].split(','), wx = this.ox + +wp[0] * T, wy = this.oy + +wp[1] * T;
    for (var wi = 0; wi < 32; wi += 2) { rect(wx + wi, wy, 1, 1, PAL.pink); rect(wx + wi, wy + 31, 1, 1, PAL.pink); rect(wx, wy + wi, 1, 1, PAL.pink); rect(wx + 31, wy + wi, 1, 1, PAL.pink); }
    if (blink) frame(wx + 3, wy + 3, 26, 26, PAL.magenta);
  } else if (act === 'step') {
    var cx = this.ox + (b.x + 1) * T + Rules.DX[d] * 22, cy = this.oy + (b.y + 1) * T - 3 + Rules.DY[d] * 22;
    for (var k = 0; k < 3; k++) drawArrow(cx + Rules.DX[d] * k * 3, cy + Rules.DY[d] * k * 3, d, blink ? PAL.red : PAL.orange);
  } else if (act === 'hire' && b.door) {
    var hx = this.cx(b.door.x), hy = this.cy(b.door.y);
    frame(hx - 7, hy - 7, 14, 14, blink ? PAL.yellow : PAL.orange);
  }
};
PuzzleScene.prototype.drawBossBar = function () {
  var b = this.boss();
  if (!b || b.dead) return;
  var w = 100, x = 4, y = TOP + 1;
  rect(x, y, w + 2, 5, PAL.ink);
  rect(x + 1, y + 1, Math.round(w * b.hp / b.maxHp), 3, b.p2 ? PAL.orange : PAL.red);
  for (var i = 1; i < b.maxHp; i++) rect(x + 1 + Math.round(w * i / b.maxHp), y + 1, 1, 3, PAL.ink);
  var word = 'NEXT ' + BOSS_WORD[b.tel.split(':')[0]];
  rect(x + w + 4, y - 1, textW(word) + 4, 9, PAL.ink);
  text(word, x + w + 6, y, PAL.red);
};

// Each boss type: the Manager in a suit, the Foreman in a hard hat and vest, the Warden in gray with a shield, the Forklift.
PuzzleScene.prototype.drawBoss = function (o, x, y, opts) {
  if (o.type === 'forklift') { spr(SPR.forklift, x, y, o.f === 3, opts); return; }
  if (o.type === 'arcade') { spr(SPR.cabinet, x, y, false, opts); return; }
  if (o.type === 'mainframe') { spr(SPR.mainframe, x, y, false, opts); return; }
  if (o.type === 'jack') { spr(SPR.jack, x, y, false, opts); return; }
  if (o.type === 'static') this.drawStatic(o, x, y, opts);
  else spr(SPR.boss, x, y, false, opts || BOSS_SWAP[o.type] || null);
  var hat = o.type === 'static' ? (o.p2 ? '' : o.form) : o.type;
  if (hat === 'foreman' && !opts) spr(SPR.hardhat, x, y - 1);
  if (hat === 'cook' && !opts) spr(SPR.chefhat, x, y - 5);
  if (hat === 'gardener' && !opts) spr(SPR.sunhat, x, y - 4);
  if (hat === 'valet' && !opts) spr(SPR.valetcap, x, y - 2);
  if (hat === 'manager' && !opts) spr(SPR.tie, x + 15, y + 22);
  if (hat === 'usher' && !opts) spr(SPR.ushercap, x, y - 1);
  if (o.light && !opts) {
    var fx2 = x + 16 + Rules.DX[o.f] * 14, fy2 = y + 18 + Rules.DY[o.f] * 12;
    rect(fx2 - 2, fy2 - 2, 4, 4, PAL.ink); rect(fx2 - 1, fy2 - 1, 2, 2, '#fff2b0');
  }
  if (o.shield) {
    var f = o.f;
    if (f === 1 || f === 3) { var sx = f === 1 ? x + 27 : x + 1; rect(sx, y + 4, 4, 24, PAL.ink); rect(sx + 1, y + 5, 2, 22, PAL.g1); rect(sx + 1, y + 14, 2, 3, PAL.sky); }
    else { var sy = f === 0 ? y : y + 27; rect(x + 4, sy, 24, 4, PAL.ink); rect(x + 5, sy + 1, 22, 2, PAL.g1); rect(x + 14, sy + 1, 3, 2, PAL.sky); }
  }
};

var STATIC_EYES = { manager: PAL.white, cook: PAL.orange, gardener: PAL.lime, valet: PAL.yellow };
// The Static: its body, snow that changes 12 times a second on the screen, and eyes in the color of the boss it copies.
PuzzleScene.prototype.drawStatic = function (o, x, y, opts) {
  var t = Game.t, f = Math.floor(t * 12), slip = (t % 2.5) < 0.12;
  if (slip && !opts) { spr(SPR.static, x - 2, y, false, { tint: PAL.teal }); spr(SPR.static, x + 2, y, false, { tint: PAL.pink }); }
  spr(SPR.static, x, y, false, opts);
  if (opts) return;
  for (var j = 0; j < 10; j++) for (var i = 0; i < 16; i++) {
    var h = ((i * 73856093) ^ (j * 19349663) ^ (f * 83492791)) >>> 0;
    if (h % 7 < 2) rect(x + 8 + i, y + 6 + j, 1, 1, h % 5 ? PAL.g3 : PAL.g1);
  }
  var eye = o.p2 ? PAL.red : STATIC_EYES[o.form] || PAL.white, ey = y + 9 + (o.p2 && (f & 2) ? 1 : 0);
  rect(x + 10, ey, 4, 2, eye); rect(x + 18, ey, 4, 2, eye);
  rect(x + 12, y + 13, 8, 1, o.p2 ? PAL.pink : PAL.g2);
};

// A Clerk's shield is a bright tray on the side it faces.
PuzzleScene.prototype.drawShield = function (x, y, f) {
  if (f === 1 || f === 3) {
    var sx = f === 1 ? x + 12 : x + 1;
    rect(sx, y + 2, 3, 11, PAL.ink); rect(sx + 1, y + 3, 1, 9, PAL.g1);
  } else {
    var sy = f === 0 ? y : y + 13;
    rect(x + 3, sy, 10, 3, PAL.ink); rect(x + 4, sy + 1, 8, 1, PAL.g1);
  }
};

PuzzleScene.prototype.drawGhost = function (gh) {
  var x = this.ox + gh.x * T, y = this.oy + gh.y * T - 3 + (gh.oy || 0), rows = gh.rows || SPR.husk;
  var f = gh.t / 0.45;
  if (gh.kind === 'sink') { y += Math.round(f * 8); sprDither(rows, x, y, Math.max(0, Math.round(16 - f * 18)), gh.flip); }
  else if (gh.kind === 'fall') { y += Math.round(f * f * 40); sprDither(rows, x, y, Math.max(0, Math.round(16 - f * 16)), gh.flip); }
  else sprDither(rows, x, y - Math.round(f * 4), Math.max(0, Math.round(16 - f * 26)), gh.flip, { tint: PAL.white });
};

// Dotted lines along the path each bolt would take, round mirrors and through glass, with what it would do at the end.
PuzzleScene.prototype.drawAim = function () {
  var s = this.s, self = this, t = Game.t;
  if (!this.aimCache || this.aimCache.s !== s) {
    var list = [];
    for (var d = 0; d < 4; d++) {
      var r = Rules.step(s, { t: 'zap', d: d }), zs = [], made = {};
      if (r) r.ev.forEach(function (e) { if (e.e === 'zap') zs.push(e); if (e.e === 'compile') made[e.x + ',' + e.y] = e.k; });
      list.push({ d: d, zs: zs, made: made });
    }
    this.aimCache = { s: s, list: list };
  }
  var col = (Math.floor(t * 4) & 1) ? PAL.white : PAL.sky;
  this.aimCache.list.forEach(function (a) {
    drawArrow(self.cx(s.px) + Rules.DX[a.d] * 11, self.cy(s.py) + 3 + Rules.DY[a.d] * 11, a.d, col);
    a.zs.forEach(function (z) { self.drawAimPath(z, a.made[z.x1 + ',' + z.y1], col); });
  });
};
// One bolt's dotted path and the icon for what it does where it ends.
PuzzleScene.prototype.drawAimPath = function (z, made, col) {
  var s = this.s, self = this;
  for (var i = 0; i + 1 < z.path.length; i++) {
    var p = z.path[i], q = z.path[i + 1];
    if (!p || !q) continue;
    var dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1]);
    for (var x = p[0], y = p[1]; x !== q[0] || y !== q[1];) {
      x += dx; y += dy;
      if (x === q[0] && y === q[1] && i + 2 === z.path.length && z.hit !== 'swap' && z.hit !== null) break;
      if (x === s.px && y === s.py) continue;
      rect(self.cx(x) - 1, self.cy(y) + 2, 2, 2, col);
    }
  }
  var hx = self.cx(z.x1), hy = self.cy(z.y1) - 16, icon = null;
  if (z.hit === 'compile' && made) icon = SPR[MINI[made]];
  else if (z.hit === 'swap') icon = SPR.miniSwapper;
  else if (z.hit === 'overclock' || z.hit === 'switch') icon = SPR.bang;
  else if (z.hit === 'print') icon = SPR['bit' + Rules.PRINTER[Rules.tile(s, z.x1, z.y1)]];
  if (icon) { rect(hx - 6, hy - 1, 12, 11, PAL.ink); spr(icon, hx - Math.floor(sprite(icon).width / 2), hy); }
  else if (z.hit === 'norecipe') { rect(hx - 4, hy - 1, 8, 10, PAL.ink); text('?', hx - 2, hy, PAL.g2); }
};

PuzzleScene.prototype.drawHud = function () {
  var s = this.s, a = this.area;
  rect(0, 0, W, TOP, PAL.ink);
  text((this.li + 1) + ' ' + this.def.name.toUpperCase(), 3, 2, PAL.white);
  var hx = W - 3 - s.maxHp * 7 + 2 + (this.heartShake > 0 ? Math.round(Math.sin(Game.t * 60)) : 0);
  drawHearts(hx, 3, s.hp, s.maxHp);
  rect(0, HUD_Y, W, H - HUD_Y, PAL.ink);
  rect(0, HUD_Y, W, 1, a.trim);
  for (var i = 0; i < 3; i++) {
    var sx = 4 + i * 18, sy = HUD_Y + 4 - (this.slotPulse[i] > 0.2 ? 1 : 0);
    inset(sx, sy, 16, 16, this.slotPulse[i] > 0 ? PAL.g4 : PAL.g5);
    if (s.inv[i]) spr(SPR['bit' + s.inv[i]], sx + 2, sy + 2);
    text(String(i + 1), sx + 10, sy + 8, s.inv[i] ? PAL.g1 : PAL.g3);
  }
  // Unordered recipes lie in a row. Ordered ones stand as a column, the bottom bit below.
  var rx = 62;
  Object.keys(s.recipes).forEach(function (k) {
    var r = s.recipes[k], ordered = r.indexOf('>') >= 0, bits = r.replace(/>/g, '');
    if (ordered) {
      for (var j = 0; j < bits.length; j++) spr(SPR['bit' + bits[j]], rx, HUD_Y + 12 - j * 8);
      rx += 8;
    } else {
      for (var j2 = 0; j2 < bits.length; j2++) spr(SPR['bit' + bits[j2]], rx + j2 * 8, HUD_Y + 8);
      rx += bits.length * 8;
    }
    rect(rx, HUD_Y + 10, 1, 3, PAL.g2); rect(rx + 1, HUD_Y + 11, 1, 1, PAL.g2);
    spr(SPR[MINI[k]], rx + 3, HUD_Y + 8);
    rx += 17;
  });
};

// A level where a daemon first appears shows its portrait, name, and recipe and nothing more. Other levels slide a name strip away.
PuzzleScene.prototype.drawCard = function () {
  var title = (this.li + 1) + '  ' + this.def.name.toUpperCase(), bar = AREAS[this.def.area || 0].wallFront, self = this;
  if (this.introCard) {
    var h = 28 + this.fresh.length * 20, y = Math.round((TOP + HUD_Y - h) / 2);
    dither(0, TOP, W, HUD_Y - TOP, null, PAL.deep, 7);
    panel(24, y, W - 48, h, title, bar);
    this.fresh.forEach(function (k, i) {
      var ry = y + 15 + i * 20;
      inset(30, ry, 18, 18, AREAS[self.def.area || 0].floorB);
      spr(SPR[DAEMON_SPR[k]], 31, ry + 1);
      text(DAEMON_NAMES[k], 54, ry + 2, PAL.ink);
      var bits = (self.s.recipes[k] || '').replace('>', '');
      for (var j = 0; j < bits.length; j++) spr(SPR['bit' + bits[j]], 54 + j * 8, ry + 10);
    });
    textC('any key', W / 2, y + h - 10, PAL.g4);
    return;
  }
  var y2 = TOP + 3 - Math.round(Math.max(0, 0.3 - this.card) / 0.3 * 20);
  panel(8, y2, W - 16, 14, title, bar);
};

var DAEMON_NAMES = { ram: 'RAM', fork: 'FORK', brick: 'BRICK', pinger: 'PINGER', mirror: 'MIRROR', decoy: 'DECOY', swapper: 'SWAPPER', echo: 'ECHO', toy: 'TOY' };
// Daemons that no earlier level offered, as recipes or as placed pieces.
function freshDaemons(li) {
  var seen = {}, out = [];
  function scan(def, into) {
    Object.keys(def.recipes || {}).forEach(function (k) { into[k] = 1; });
    var m = def.map.join('');
    if (m.indexOf('B') >= 0) into.brick = 1;
    if (m.indexOf('M') >= 0 || m.indexOf('N') >= 0) into.mirror = 1;
    (def.objs || []).forEach(function (o) { into[o.k] = 1; });
  }
  for (var i = 0; i < li; i++) scan(LEVELS[i], seen);
  var here = {};
  scan(LEVELS[li], here);
  Object.keys(here).forEach(function (k) { if (!seen[k] && DAEMON_NAMES[k]) out.push(k); });
  return out;
}

PuzzleScene.prototype.drawBanner = function (title, sub, color) {
  var w = 150, x = (W - w) / 2, y = 62;
  panel(x, y, w, 30, title, color);
  textC(sub, W / 2, y + 17, PAL.ink);
  if (this.s.won) spr(SPR.chip, W / 2 - 5, y - 14 - (Math.floor(Game.t * 2.5) & 1));
};

var HELP_LINES = [
  ['Arrows', 'walk, hit, push'],
  ['X arrow', 'fire the wand'],
  ['1 2 3', 'drop that bit'],
  ['Space', 'wait a turn'],
  ['Z', 'undo'],
  ['R', 'restart'],
  ['M', 'sound on or off'],
  ['Esc', 'level map'],
];
PuzzleScene.prototype.drawHelp = function () {
  var w = 164, h = HELP_LINES.length * LH + 34, x = (W - w) / 2, y = 24;
  panel(x, y, w, h, 'CONTROLS', PAL.cobaltDk);
  HELP_LINES.forEach(function (l, i) { text(l[0], x + 6, y + 16 + i * LH, PAL.cobaltDk); text(l[1], x + 52, y + 16 + i * LH, PAL.ink); });
  text('Stack 2 bits on a tile, then', x + 6, y + h - 17, PAL.g4);
  text('fire the wand at the stack.', x + 6, y + h - 9, PAL.g4);
};

// The level map: Tilde in the middle of a nest of cables, and the ruins below.
function MapScene(cursor) {
  this.cur = cursor !== undefined ? cursor : Save.data.cursor || 0;
  this.cur = Math.max(0, Math.min(LEVELS.length - 1, this.cur));
}
MapScene.prototype.enter = function () {
  music('title');
  FX.clear();
};
function areaLists() {
  var areas = [];
  LEVELS.forEach(function (l, i) { (areas[l.area || 0] = areas[l.area || 0] || []).push(i); });
  return areas.filter(function (a) { return a; });
}
MapScene.prototype.key = function (ev) {
  if (ev.code === 'KeyM') { setMuted(!Sound.muted); return; }
  var d = dirOf(ev), n = LEVELS.length, old = this.cur;
  if (d === 1) this.cur = Math.min(n - 1, this.cur + 1);
  else if (d === 3) this.cur = Math.max(0, this.cur - 1);
  else if (d === 0 || d === 2) {
    var areas = areaLists(), ai = -1, j = 0;
    areas.forEach(function (list, i) { var k = list.indexOf(old); if (k >= 0) { ai = i; j = k; } });
    var to = areas[ai + (d === 2 ? 1 : -1)];
    if (to) this.cur = to[Math.min(j, to.length - 1)];
  } else if (isOk(ev)) { sfx('ok'); Save.data.cursor = this.cur; Save.store(); setScene(new PuzzleScene(this.cur)); return; }
  else if (isBack(ev)) { sfx('back'); setScene(new TitleScene()); return; }
  if (this.cur !== old) sfx('select');
};
MapScene.prototype.update = function (dt) { FX.update(dt); };
// Tilde at the top, then a window of three areas around the cursor, then the chosen level's name.
MapScene.prototype.draw = function () {
  var lv = LEVELS[this.cur], area = AREAS[lv.area || 0], t = Game.t, self = this;
  drawVoid(area, t);
  rect(0, 0, W, TOP, PAL.ink);
  text('CHECKSUM', 3, 2, PAL.yellow);
  var chips = Save.chips() + '/' + LEVELS.length;
  spr(SPR.chip, W - 4 - textW(chips) - 13, 1);
  text(chips, W - 3 - textW(chips), 2, PAL.white);
  drawTildeNest(W / 2, 22, t, Save.health());
  rect(35, 45, 122, 6, PAL.ink);
  rect(36, 46, Math.round(120 * Save.chips() / Math.max(1, LEVELS.length)), 4, PAL.lime);
  var areas = areaLists(), cai = 0;
  areas.forEach(function (list, i) { if (list.indexOf(self.cur) >= 0) cai = i; });
  var first = Math.max(0, Math.min(cai - 1, areas.length - 3));
  for (var k = 0; k < 3 && first + k < areas.length; k++) {
    var list = areas[first + k], ai = LEVELS[list[0]].area || 0, A = AREAS[ai], ay = 56 + k * 38;
    panel(4, ay, W - 8, 34, A.name.toUpperCase(), A.wallFront);
    var n = list.length, bw = Math.min(54, Math.floor((176 - (n - 1) * 3) / n));
    list.forEach(function (li, j) {
      var bx = 9 + j * (bw + 3), by = ay + 14, on = li === self.cur, done = Save.data.done[LEVELS[li].id];
      inset(bx, by, bw, 17, on ? A.wallTop : PAL.g5);
      text(String(li + 1), bx + 3, by + 5, on ? PAL.white : PAL.g1);
      if (done) { if (bw >= 30) spr(SPR.chip, bx + bw - 13, by + 4); else rect(bx + bw - 5, by + 3, 3, 3, PAL.lime); }
      if (on) frame(bx - 1, by - 1, bw + 2, 19, (Math.floor(t * 3) & 1) ? PAL.yellow : PAL.white);
    });
  }
  if (first > 0) drawArrow(W / 2, 54, 0, PAL.white);
  if (first + 3 < areas.length) drawArrow(W / 2, 171, 2, PAL.white);
  rect(0, H - 13, W, 13, PAL.ink);
  text((this.cur + 1) + ' ' + lv.name.toUpperCase(), 3, H - 10, PAL.white);
  var hint = 'enter', hw = textW(hint);
  text(hint, W - 3 - hw, H - 10, PAL.g3);
};

function drawNest(cx, y) {
  var cols = [PAL.g4, PAL.cobaltDk, PAL.redDk, PAL.g3];
  for (var i = 0; i < 5; i++) {
    var c = cols[i % 4];
    for (var x = -16; x <= 16; x++) rect(cx + x, y + 8 + Math.round(Math.sin((x + i * 5) / 3.5) * 1.5) + (i % 3), 1, 1, c);
  }
}
function drawTildeNest(cx, y, t, health) {
  drawNest(cx, y);
  var tx = cx - 8, ty = y - 1 + (Math.floor(t * 1.2) & 1);
  spr(SPR.tilde, tx, ty);
  if (health < 1 && Math.floor(t * 0.7) % 4 === 0) {
    var gy = ty + 2 + (Math.floor(t * 0.7) % 5);
    rect(tx + 1, gy, 9 + Math.round((1 - health) * 6), 1, PAL.teal);
    rect(tx + 3, gy + 1, 5, 1, PAL.pink);
  }
}

function TitleScene() {}
TitleScene.prototype.enter = function () { music('title'); FX.clear(); };
TitleScene.prototype.key = function (ev) {
  if (ev.code === 'KeyM') { setMuted(!Sound.muted); return; }
  // Erasing asks first, and the cursor starts on Keep.
  if (this.confirm) {
    var d = dirOf(ev);
    if (d === 1 || d === 3) { this.erase = !this.erase; sfx('select'); return; }
    if (isBack(ev) || (isOk(ev) && !this.erase)) { this.confirm = false; sfx('back'); return; }
    if (isOk(ev)) { Save.reset(); mend(); this.confirm = false; this.erased = 2; sfx('smash'); }
    return;
  }
  if ((ev.code === 'Delete' || ev.code === 'Backspace') && Save.data.seen.intro) { this.confirm = true; this.erase = false; sfx('select'); return; }
  if (isOk(ev)) {
    sfx('ok');
    if (!Save.data.seen.intro) { Save.data.seen.intro = 1; Save.store(); setScene(new StoryScene(INTRO_LINES, 0)); }
    else toWorld();
  }
};
TitleScene.prototype.update = function (dt) {
  FX.update(dt);
  this.erased = Math.max(0, (this.erased || 0) - dt);
  if (Math.random() < dt * 2) FX.sparkle(Math.random() * W, 20 + Math.random() * 60, 1);
};
TitleScene.prototype.draw = function () {
  var t = Game.t, a = AREAS[0];
  drawVoid(a, t);
  FX.draw();
  var title = 'CHECKSUM', tw = textW(title, 2), x = Math.round((W - tw) / 2);
  text(title, x + 2, 50, PAL.ink, 2);
  text(title, x, 48, PAL.yellow, 2);
  rect(x, 66, Math.ceil(tw / 2), 2, PAL.cobalt);
  rect(x + Math.ceil(tw / 2), 66, Math.floor(tw / 2), 2, PAL.yellow);
  for (var yy = 0; yy < 2; yy++) for (var xx = 0; xx < 5; xx++) drawFloor(56 + xx * 16, 98 + yy * 16, a, xx, yy);
  for (var c = 0; c < 5; c++) drawCliff(56 + c * 16, 130, a);
  spr(SPR.pilFront, 70, 96 + ((Math.floor(t * 2) & 1) ? 1 : 0));
  drawTildeNest(112, 108, t, Save.health());
  if (Math.floor(t * 1.4) & 1) textC('press enter', W / 2, 152, PAL.white);
  if (Save.data.seen.intro) textC(Save.chips() + '/' + LEVELS.length + ' solved   ' + playTime(Save.data.time) + ' played', W / 2, 174, PAL.g2);
  else if (this.erased > 0) textC('save erased', W / 2, 174, PAL.orange);
  if (Save.data.seen.intro && !this.confirm) { var hint = 'del: erase save'; text(hint, W - 3 - textW(hint), 3, PAL.g3); }
  if (this.confirm) this.drawConfirm();
};
TitleScene.prototype.drawConfirm = function () {
  dither(0, 0, W, H, null, PAL.deep, 10);
  var w = 150, h = 62, x = (W - w) / 2, y = 64, self = this;
  panel(x, y, w, h, 'ERASE SAVE', PAL.redDk);
  wrap('every chip, keycard, and minute played will be gone', 28).forEach(function (l, i) { text(l, x + 5, y + 16 + i * LH, PAL.ink); });
  [['KEEP', false, x + 30], ['ERASE', true, x + 90]].forEach(function (o) {
    var on = self.erase === o[1], ow = textW(o[0]) + 6;
    if (on) rect(o[2] - 3, y + 44, ow, 11, o[1] ? PAL.red : PAL.cobalt);
    text(o[0], o[2], y + 46, on ? PAL.white : PAL.g4);
  });
};
function playTime(sec) {
  var m = Math.floor((sec || 0) / 60), h = Math.floor(m / 60);
  return h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
}

var INTRO_LINES = [
  ['TILDE', 'pil~ you came back'],
  ['PILCROW', 'Hold still. The ruins still have chips.'],
  ['TILDE', 'bring the shiny ones~'],
];
var MID_LINES = [
  ['TILDE', 'pil~ i can sit up now'],
  ['PILCROW', 'The static is still in you.'],
  ['TILDE', 'it hums like a dead channel~ from deep in the mall'],
  ['PILCROW', 'Then I go deeper. Lie back down.'],
];
function StoryScene(lines, back) { this.lines = lines; this.i = 0; this.back = back; this.chars = 0; }
StoryScene.prototype.enter = function () { music('title'); };
StoryScene.prototype.key = function (ev) {
  if (this.done || (!isOk(ev) && !isBack(ev))) return;
  var line = this.lines[this.i][1];
  if (this.chars < line.length && !isBack(ev)) { this.chars = line.length; return; }
  sfx('select');
  // The last line stays on screen through the fade rather than typing out again.
  if (this.i + 1 >= this.lines.length || isBack(ev)) { this.done = true; this.chars = line.length; toWorld(this.back); return; }
  this.i++;
  this.chars = 0;
};
StoryScene.prototype.update = function (dt) {
  if (this.done) return;
  var line = this.lines[Math.min(this.i, this.lines.length - 1)][1], before = Math.floor(this.chars);
  this.chars = Math.min(line.length, this.chars + dt * 30);
  if (Math.floor(this.chars) > before && Math.floor(this.chars) % 3 === 0) {
    Sound.talk(line[Math.floor(this.chars) - 1], this.lines[Math.min(this.i, this.lines.length - 1)][0]);
  }
};
StoryScene.prototype.draw = function () {
  var t = Game.t, a = AREAS[0];
  drawVoid(a, t);
  for (var yy = 0; yy < 3; yy++) for (var xx = 0; xx < 6; xx++) drawFloor(48 + xx * 16, 64 + yy * 16, a, xx, yy);
  for (var c = 0; c < 6; c++) drawCliff(48 + c * 16, 112, a);
  var mid = this.lines === MID_LINES;
  spr(SPR.pilFront, 70, 74 + ((Math.floor(t * 2) & 1) ? 1 : 0));
  drawTildeNest(116, 84 - (mid ? 4 : 0), t, mid ? 0.5 : 0);
  var line = this.lines[Math.min(this.i, this.lines.length - 1)];
  panel(6, 136, W - 12, 46, line[0], line[0] === 'TILDE' ? PAL.magenta : PAL.cobaltDk);
  wrap(line[1].slice(0, Math.floor(this.chars)), 34).forEach(function (l, i) { text(l, 11, 152 + i * LH, PAL.ink); });
};

var END_LINES = [
  ['TILDE', 'pil~ the fuzz is gone. all of it'],
  ['PILCROW', 'It was the Static. Eating your signal.'],
  ['TILDE', 'i can float~ look look'],
  ['PILCROW', 'Slow. You just rebooted.'],
  ['TILDE', 'something clicked in the lobby~ the staff door'],
  ['PILCROW', 'More ruins behind it, then.'],
  ['TILDE', 'then i come too~ two can push one block'],
  ['PILCROW', 'Fine. Stay close.'],
];
// The ending: the last chip flies to Tilde, the static leaves her, and she floats out of the nest to Pilcrow.
var END_BURST = 1.4, END_RISE = 2.4, END_GLIDE = 3.4, END_TALK = 4.8;
function EndingScene() { this.t = 0; this.i = -1; this.chars = 0; this.burst = false; }
EndingScene.prototype.enter = function () {
  music('ending'); FX.clear();
  Save.data.seen.final = 1; (Save.data.keys = Save.data.keys || {}).staff = 1;
  Save.data.world = { room: 'lobby', x: 9, y: 8, face: 0 };
  Save.store(); mend();
};
EndingScene.prototype.key = function (ev) {
  if (ev.code === 'KeyM') { setMuted(!Sound.muted); return; }
  if (!isOk(ev) && !isBack(ev)) return;
  if (this.i < 0) { this.t = END_TALK; this.i = 0; this.burst = true; return; }
  if (this.i >= END_LINES.length) { sfx('ok'); toWorld(); return; }
  var line = END_LINES[this.i][1];
  if (this.chars < line.length && !isBack(ev)) { this.chars = line.length; return; }
  sfx('select');
  this.i = isBack(ev) ? END_LINES.length : this.i + 1;
  this.chars = 0;
};
EndingScene.prototype.update = function (dt) {
  this.t += dt;
  FX.update(dt);
  if (!this.burst && this.t >= END_BURST) { this.burst = true; sfx('chip'); FX.burst(116, 88, [PAL.pink, PAL.teal, PAL.white, PAL.lime], 20, 60); }
  if (this.i < 0 && this.t >= END_TALK) this.i = 0;
  if (this.i < 0 || this.i >= END_LINES.length) return;
  var line = END_LINES[this.i][1], before = Math.floor(this.chars);
  this.chars = Math.min(line.length, this.chars + dt * 30);
  if (Math.floor(this.chars) > before && Math.floor(this.chars) % 3 === 0) Sound.talk(line[Math.floor(this.chars) - 1], END_LINES[this.i][0]);
};
EndingScene.prototype.draw = function () {
  var t = this.t, a = AREAS[0], bob = (Math.floor(Game.t * 2) & 1) ? 1 : 0;
  drawVoid(a, Game.t);
  for (var yy = 0; yy < 3; yy++) for (var xx = 0; xx < 6; xx++) drawFloor(48 + xx * 16, 64 + yy * 16, a, xx, yy);
  for (var c = 0; c < 6; c++) drawCliff(48 + c * 16, 112, a);
  drawNest(116, 84);
  spr(SPR.pilFront, 70, 74 + bob);
  var tx = 108, ty = 83 + (Math.floor(Game.t * 1.2) & 1);
  if (t >= END_RISE) {
    var rise = ease(Math.min(1, (t - END_RISE) / (END_GLIDE - END_RISE))), glide = ease(Math.max(0, Math.min(1, (t - END_GLIDE) / (END_TALK - END_GLIDE - 0.2))));
    tx = Math.round(108 - glide * 20); ty = Math.round(83 - rise * 10 + Math.sin(Game.t * 3) * 1.5);
    rect(tx + 4, 98, 8, 1, PAL.g3);
  }
  spr(SPR.tilde, tx, ty);
  if (t < END_BURST || (t < END_RISE - 0.2 && (Math.floor(t * 10) & 1))) {
    var gy = ty + 2 + (Math.floor(Game.t * 6) % 5);
    rect(tx + 1, gy, 12, 1, PAL.teal); rect(tx + 3, gy + 1, 5, 1, PAL.pink);
  }
  if (t < END_BURST) {
    var p = t / END_BURST, cx = 74 + (110 - 74) * p, cy = 78 + (82 - 78) * p - Math.sin(Math.PI * p) * 24;
    spr(SPR.chip, cx, cy);
  }
  if (t >= END_TALK - 0.2 && t < END_TALK + 1.2) spr(SPR.heart, 85, 62 - Math.round(Math.min(1, t - END_TALK + 0.2) * 6));
  FX.draw();
  if (this.i >= END_LINES.length) {
    var title = 'CHECKSUM', tw = textW(title, 2), x = Math.round((W - tw) / 2);
    text(title, x + 2, 26, PAL.ink, 2);
    text(title, x, 24, PAL.yellow, 2);
    textC(Save.chips() + '/' + LEVELS.length + ' solved   ' + playTime(Save.data.time) + ' played', W / 2, 140, PAL.white);
    if (Math.floor(Game.t * 1.4) & 1) textC('press enter', W / 2, 156, PAL.g2);
  } else if (this.i >= 0) {
    var line = END_LINES[this.i];
    panel(6, 136, W - 12, 46, line[0], line[0] === 'TILDE' ? PAL.magenta : PAL.cobaltDk);
    wrap(line[1].slice(0, Math.floor(this.chars)), 34).forEach(function (l, i) { text(l, 11, 152 + i * LH, PAL.ink); });
  }
};
