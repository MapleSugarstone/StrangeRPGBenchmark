// Build B rules: keycap words form rules that decide what every object does. No drawing code, so Node can load it.
var RulesB = (function () {
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var NOUNS = ['mage', 'husk', 'wall', 'chip', 'crt'];
  var PROPS = ['you', 'win', 'stop', 'push', 'hurt', 'weak'];
  var OPS = ['is', 'has'];
  // Map letters: uppercase are objects, lowercase are words.
  var OBJ_CH = { M: 'mage', H: 'husk', W: 'wall', C: 'chip', T: 'crt' };
  var WORD_CH = { m: 'mage', h: 'husk', w: 'wall', c: 'chip', t: 'crt', i: 'is', a: 'has', y: 'you', v: 'win', s: 'stop', p: 'push', u: 'hurt', k: 'weak' };
  var BASE_HP = { mage: 3, crt: 2 };

  function load(def) {
    var rows = def.map, h = rows.length, w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var s = { w: w, h: h, floor: [], objs: [], nid: 1, won: false, lost: false, turn: 0, huskHp: def.huskHp || 2 };
    var hps = def.hp || [], hi = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y][x] || '_';
      s.floor.push(ch === '_' ? '_' : '.');
      if (OBJ_CH[ch]) {
        var n = OBJ_CH[ch], o = { id: s.nid++, n: n, x: x, y: y };
        if (n === 'husk') o.hp = hps[hi++] || s.huskHp;
        else if (BASE_HP[n]) o.hp = BASE_HP[n];
        if (o.hp) o.maxHp = o.hp;
        s.objs.push(o);
      } else if (WORD_CH[ch]) s.objs.push({ id: s.nid++, n: 'text', w: WORD_CH[ch], x: x, y: y });
    }
    s.rules = parse(s);
    return s;
  }

  function clone(s) {
    var c = Object.assign({}, s);
    c.objs = s.objs.map(function (o) { return Object.assign({}, o); });
    c.rules = s.rules.slice();
    return c;
  }

  function textGrid(s) {
    var m = {};
    s.objs.forEach(function (o) { if (o.n === 'text' && !o.dead) m[o.y * s.w + o.x] = o; });
    return m;
  }

  // Rules read left to right and top to bottom as NOUN IS PROP, NOUN IS NOUN, or NOUN HAS NOUN.
  function parse(s) {
    var tg = textGrid(s), rules = [], lit = {};
    s.objs.forEach(function (t) {
      if (t.n !== 'text' || t.dead || NOUNS.indexOf(t.w) < 0) return;
      [[1, 0], [0, 1]].forEach(function (d) {
        var a = tg[(t.y + d[1]) * s.w + t.x + d[0]], b = tg[(t.y + 2 * d[1]) * s.w + t.x + 2 * d[0]];
        if (t.x + 2 * d[0] >= s.w || !a || !b || OPS.indexOf(a.w) < 0) return;
        var ok = (a.w === 'is' && (PROPS.indexOf(b.w) >= 0 || NOUNS.indexOf(b.w) >= 0)) || (a.w === 'has' && NOUNS.indexOf(b.w) >= 0);
        if (!ok) return;
        rules.push([t.w, a.w, b.w]);
        lit[t.id] = lit[a.id] = lit[b.id] = 1;
      });
    });
    s.lit = lit;
    return rules;
  }

  function is(s, o, prop) {
    if (o.n === 'text') return prop === 'push';
    for (var i = 0; i < s.rules.length; i++) { var r = s.rules[i]; if (r[0] === o.n && r[1] === 'is' && r[2] === prop) return true; }
    return false;
  }
  function at(s, x, y) { return s.objs.filter(function (o) { return !o.dead && o.x === x && o.y === y; }); }
  function open(s, x, y) { return x >= 0 && y >= 0 && x < s.w && y < s.h && s.floor[y * s.w + x] === '.'; }

  function destroy(s, o, ev) {
    if (o.dead) return;
    o.dead = true;
    ev.push({ e: 'die', id: o.id, n: o.n, x: o.x, y: o.y });
    s.rules.forEach(function (r) {
      if (r[0] === o.n && r[1] === 'has') {
        var no = { id: s.nid++, n: r[2], x: o.x, y: o.y };
        if (r[2] === 'husk') no.hp = s.huskHp; else if (BASE_HP[r[2]]) no.hp = BASE_HP[r[2]];
        if (no.hp) no.maxHp = no.hp;
        s.objs.push(no);
        ev.push({ e: 'spawn', id: no.id, n: no.n, x: o.x, y: o.y });
      }
    });
  }

  // Whether every pusher in the chain starting at (x, y) can move one tile along d.
  function canPush(s, x, y, d, depth) {
    if (depth > 40) return false;
    var nx = x + DX[d], ny = y + DY[d];
    if (!open(s, nx, ny)) return false;
    var here = at(s, nx, ny);
    for (var i = 0; i < here.length; i++) {
      var q = here[i];
      if (is(s, q, 'push')) { if (!canPush(s, nx, ny, d, depth + 1)) return false; }
      else if (is(s, q, 'stop')) return false;
    }
    return true;
  }
  function doPush(s, x, y, d, ev) {
    var nx = x + DX[d], ny = y + DY[d];
    at(s, nx, ny).forEach(function (q) { if (is(s, q, 'push')) doPush(s, nx, ny, d, ev); });
    at(s, x, y).forEach(function (q) {
      if (is(s, q, 'push')) { q.x = nx; q.y = ny; ev.push({ e: 'push', id: q.id }); }
    });
  }

  function tryMove(s, o, d, ev) {
    var tx = o.x + DX[d], ty = o.y + DY[d];
    if (!open(s, tx, ty)) return false;
    var here = at(s, tx, ty);
    for (var i = 0; i < here.length; i++) {
      var q = here[i];
      if (q === o || is(s, q, 'you')) continue;
      if (is(s, q, 'weak')) { ev.push({ e: 'hit', id: q.id, x: tx, y: ty, by: o.id }); destroy(s, q, ev); return true; }
      if (is(s, q, 'hurt') && q.hp) {
        q.hp -= 1;
        ev.push({ e: 'hit', id: q.id, x: tx, y: ty, by: o.id });
        if (q.hp <= 0) destroy(s, q, ev);
        return true;
      }
    }
    var pushing = here.some(function (q) { return q !== o && is(s, q, 'push'); });
    if (pushing && !canPush(s, o.x, o.y, d, 0)) return false;
    for (var j = 0; j < here.length; j++) {
      var q2 = here[j];
      if (q2 !== o && !is(s, q2, 'push') && is(s, q2, 'stop') && !is(s, q2, 'you')) return false;
    }
    if (pushing) {
      at(s, tx, ty).forEach(function (q) { if (is(s, q, 'push')) doPush(s, tx, ty, d, ev); });
    }
    o.x = tx; o.y = ty; o.face = d;
    ev.push({ e: 'move', id: o.id });
    return true;
  }

  // Actions: {t:'move', d} or {t:'wait'}. Returns {s, ev}, or null when nothing changes.
  function step(s0, act) {
    if (s0.won || s0.lost) return null;
    var s = clone(s0), ev = [], moved = false;
    if (act.t === 'move') {
      var yous = s.objs.filter(function (o) { return !o.dead && is(s, o, 'you'); });
      yous.forEach(function (o) { if (!o.dead && tryMove(s, o, act.d, ev)) moved = true; });
      if (!moved) return null;
    } else if (act.t !== 'wait') return null;

    var before = s.rules.map(String).join('|');
    s.rules = parse(s);
    if (s.rules.map(String).join('|') !== before) ev.push({ e: 'rules' });

    s.rules.forEach(function (r) {
      if (r[1] !== 'is' || NOUNS.indexOf(r[2]) < 0 || r[0] === r[2]) return;
      if (s.rules.some(function (q) { return q[0] === r[0] && q[1] === 'is' && q[2] === r[0]; })) return;
      s.objs.forEach(function (o) {
        if (o.dead || o.n !== r[0] || o.changed) return;
        o.n = r[2]; o.changed = true;
        if (!o.hp) { var hp = r[2] === 'husk' ? s.huskHp : BASE_HP[r[2]]; if (hp) { o.hp = hp; o.maxHp = hp; } }
        ev.push({ e: 'become', id: o.id, n: o.n });
      });
    });
    s.objs.forEach(function (o) { delete o.changed; });

    var hurts = s.objs.filter(function (o) { return !o.dead && is(s, o, 'hurt'); });
    hurts.forEach(function (hh) {
      s.objs.forEach(function (y) {
        if (y === hh || y.dead || !is(s, y, 'you') || !y.hp) return;
        if (Math.abs(y.x - hh.x) + Math.abs(y.y - hh.y) > 1) return;
        y.hp -= 1;
        ev.push({ e: 'bite', id: hh.id, target: y.id, x: y.x, y: y.y });
      });
    });
    s.objs.forEach(function (o) { if (!o.dead && o.hp !== undefined && o.hp <= 0) destroy(s, o, ev); });

    var live = s.objs.filter(function (o) { return !o.dead; });
    var yousNow = live.filter(function (o) { return is(s, o, 'you'); });
    yousNow.forEach(function (o) {
      if (is(s, o, 'win') || live.some(function (q) { return q !== o && q.x === o.x && q.y === o.y && is(s, q, 'win'); })) s.won = true;
    });
    if (s.won) ev.push({ e: 'win' });
    else if (!yousNow.length) { s.lost = true; ev.push({ e: 'lose' }); }
    s.objs = live;
    s.turn++;
    return { s: s, ev: ev };
  }

  function key(s) {
    return s.objs.map(function (o) { return (o.n === 'text' ? '"' + o.w : o.n) + o.x + ',' + o.y + ',' + (o.hp || ''); }).sort().join(';');
  }
  function actions() { return [{ t: 'move', d: 0 }, { t: 'move', d: 1 }, { t: 'move', d: 2 }, { t: 'move', d: 3 }]; }

  return { load: load, step: step, key: key, actions: actions, is: is, parse: parse, DX: DX, DY: DY, NOUNS: NOUNS, PROPS: PROPS };
})();
