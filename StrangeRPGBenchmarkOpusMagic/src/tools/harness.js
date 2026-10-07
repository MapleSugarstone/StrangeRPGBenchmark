// Paste into the browser console (or run with a page tool) to drive the game without the animation loop.
window.H = {
  choices: [],
  log: [],
  retry: 0,
  /** Plays every scene, card, editor line, and fight until the field is free in the given chapter. */
  until(chapter, max = 2000) {
    const s = rote.app.s;
    for (let i = 0; i < max; i++) {
      const t = this.top();
      const k = this.kind(t);
      if (k === 'field' && !t.locked && s.chapter >= chapter) return 'ready';
      if (k === 'battle') { this.fight(this.page ?? 1); continue; }
      if (k === 'editor' && t.mode === 'oneline') { this.type('say "go"'); this.key('Enter', 'Enter'); this.run(3); continue; }
      if (k === 'card') { this.run(70); this.Z(); this.run(5); continue; }
      if (k === 'overlay') { this.run(40); this.Z(); this.run(4); continue; }
      if (k === 'field' && !t.locked) return 'field-ch' + s.chapter;
      this.Z(); this.run(6);
    }
    return 'max';
  },
  key(code, key, frames = 2) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
    rote.step(frames);
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
    rote.step(2);
  },
  Z() { this.key('KeyZ', 'z'); },
  X() { this.key('KeyX', 'x'); },
  dir(d) { this.key('Arrow' + d, 'Arrow' + d); },
  go(d, n = 1) { for (let i = 0; i < n; i++) { this.key('Arrow' + d, 'Arrow' + d, 2); this.run(10); } },
  run(n) { rote.step(n); },
  top() { return rote.app.stack[rote.app.stack.length - 1]; },
  field() { return rote.game.field; },
  type(s) {
    for (const ch of s) {
      const code = ch === ' ' ? 'Space' : ch === '\n' ? 'Enter' : /[a-z]/.test(ch) ? 'Key' + ch.toUpperCase() : /[0-9]/.test(ch) ? 'Digit' + ch : 'Other';
      this.key(code, ch === '\n' ? 'Enter' : ch, 1);
    }
  },
  kind(t) {
    if (!t) return 'none';
    if (t.b && t.mode !== undefined) return 'battle';
    if (t.items && t.mode !== undefined) return 'dialogue';
    if (t.lines && t.mode !== undefined && t.r !== undefined) return 'editor';
    if (t.n !== undefined && t.t !== undefined && t.done) return 'card';
    if (t.title !== undefined && t.lines) return 'overlay';
    if (t.map && t.tiles) return 'field';
    if (t.menu && t.pick) return 'picker';
    if (t.lines && t.scroll !== undefined) return 'credits';
    return 'other';
  },
  fight(page = 1) {
    for (let i = 0; i < 400; i++) {
      const t = this.top();
      if (this.kind(t) !== 'battle') return 'left';
      if (t.mode === 'command') {
        t.menu.i = 0;
        this.Z(); this.run(2);
        if (t.mode !== 'pages') continue;
        const pgs = t.b.setup.pages;
        let pick = page;
        const heal = pgs.findIndex((p) => p.name === 'heal');
        if (heal >= 0 && t.b.wait.hp < t.b.wait.max * 0.4) pick = heal;
        if (pgs[pick] && (pgs[pick].closed || pgs[pick].corrected)) {
          const stet = pgs.findIndex((p) => p.src.trim() === 'stet me');
          const alt = pgs.findIndex((p, i) => i > 0 && p.code && !p.closed && !p.corrected && p.src.includes('strike'));
          pick = alt >= 0 ? alt : stet >= 0 ? stet : page;
        }
        const off = (i) => t.pageMenu.items[i]?.disabled;
        if (off(pick)) pick = pgs.findIndex((p, i) => i > 0 && !off(i) && /strike|grind|jolt/.test(p.src));
        if (pick < 0) pick = 0;
        t.pageMenu.i = pick;
        this.Z(); this.run(2);
        if (t.mode === 'target') { if (this.aim) { const i = t.targets().findIndex(this.aim); if (i >= 0) t.targetIdx = i; } this.Z(); this.run(2); }
      } else if (t.mode === 'read' || t.mode === 'items') { this.X(); this.run(2); }
      else if (t.mode === 'pages' || t.mode === 'target') { this.X(); this.run(2); }
      else if (t.mode === 'result') { const r = t.resultLines.join(' / '); this.log.push('won: ' + r); this.Z(); this.run(5); return 'won'; }
      else if (t.mode === 'lost') { this.log.push('lost'); if (this.log.length > 60) this.log.splice(0, 30); if (this.retry-- > 0) { t.menu.i = 0; this.Z(); this.run(10); continue; } return 'lost'; }
      else this.run(30);
    }
    return 'timeout';
  },
  advance(max = 600, page = 1, line = 'say "hello"') {
    for (let i = 0; i < max; i++) {
      const t = this.top();
      const k = this.kind(t);
      if (k === 'field' && !t.locked) return 'field';
      if (k === 'field' && t.locked) { this.dir('Left'); this.run(10); continue; }
      if (k === 'dialogue') {
        if (t.mode === 'choice') {
          const want = this.choices.shift();
          const idx = want === undefined ? 0 : t.choices.findIndex((c) => c.label.startsWith(want));
          this.log.push('choice: ' + t.choices.map((c) => c.label).join(' / ') + ' -> ' + (idx >= 0 ? t.choices[idx].label : '?'));
          for (let j = 0; j < Math.max(0, idx); j++) this.dir('Down');
        }
        this.Z(); this.run(3); continue;
      }
      if (k === 'overlay') { this.run(25); this.Z(); this.run(3); continue; }
      if (k === 'card') { this.log.push('card ' + t.n); this.run(70); this.Z(); this.run(5); continue; }
      if (k === 'editor') {
        if (t.mode === 'tutorial') { this.type('strike foe'); this.key('Escape', 'Escape'); }
        else if (t.mode === 'oneline') { this.type(line); this.key('Enter', 'Enter'); }
        else this.key('Escape', 'Escape');
        this.run(3); continue;
      }
      if (k === 'battle') { this.fight(this.page ?? page); continue; }
      if (k === 'picker') { this.Z(); this.run(3); continue; }
      if (k === 'credits') return 'credits';
      this.X(); this.run(3);
    }
    return 'max';
  },
  warp(map, x, y) { rote.game.goto(map, x, y); this.run(5); return this.advance(); },
  at(x, y, dir) { const f = this.field(); this.run(18); f.x = x; f.y = y; f.dir = dir; this.run(2); },
  /** Starts a fresh game already in a chapter, with the given flags, on a map. */
  scene(ch, map, x, y, flags = {}, party = []) {
    rote.game.newGame();
    const s = rote.app.s;
    Object.assign(s.flags, { seen_c1_open: true, met_gloss: true, rote_opened: true, straw_done: true, grammar_open: true }, flags);
    s.chapter = ch;
    s.party = party;
    for (const k of party) s.allyHp[k] = 40;
    s.words.push('strike', 'mend', 'ward', 'say', 'repeat');
    s.pages.push({ id: 'p1', name: 'hit', src: 'repeat 3: strike foe', color: 1, stats: { casts: 0, harm: 0, heal: 0, best: 0 } });
    const f = rote.game.field;
    f.locked = false;
    f.load(map, x, y, 1);
    for (const [, sc] of f.map.enter ?? []) s.flags[`seen_${sc}`] = true;
    rote.app.reset(f);
    this.run(30);
  },
  talk(x, y, dir) { this.at(x, y, dir); this.Z(); this.run(3); return this.advance(); },
  /** Plays from the end of Act 1 through the prologue and the start of chapter 7, ready in the field. */
  act2() {
    this.scene(6, 'busy', 14, 11, { c6_won: true, stood_spot: true, halt_found: true }, ['halt', 'each', 'when']);
    const s = rote.app.s;
    s.childLine = 'say "light"';
    delete s.flags.seen_c7_open;
    rote.game.beginAct2();
    for (let i = 0; i < 200; i++) {
      const t = this.top();
      const k = this.kind(t);
      if (k === 'field' && !t.locked && s.flags.c7_woke) break;
      if (k === 'overlay') { this.run(25); this.Z(); this.run(4); continue; }
      if (k === 'field' && !t.locked && !s.flags.c7_woke) { t.runEnterScenes(); this.run(4); continue; }
      this.Z(); this.run(6);
    }
    return { chapter: s.chapter, party: s.party.join(','), into: s.words.includes('into') };
  },
  /** Writes a page and casts it at whatever Wait faces. */
  castSrc(src, name = 'test') {
    const s = rote.app.s;
    let i = s.pages.findIndex((p) => p.name === name);
    if (i < 0) { s.pages.push({ id: 'p' + name, name, src, color: 3, stats: { casts: 0, harm: 0, heal: 0, best: 0 } }); i = s.pages.length - 1; }
    else s.pages[i].src = src;
    rote.game.field.castField(i);
    this.run(60);
  },
  flags() { const s = rote.app.s; return Object.keys(s.flags).filter((k) => s.flags[k] && !k.startsWith('seen_')); },
  /** Returns the first direction of a shortest walk to any goal tile, or -1. Foes count as open so the walk fights through. */
  path(goals) {
    const f = this.field();
    const D = [[0, 1], [0, -1], [-1, 0], [1, 0]];
    const goal = new Set(goals.map(([x, y]) => x + ',' + y));
    const open = (x, y) => {
      if (goal.has(x + ',' + y)) return true;
      if (x < 0 || y < 0 || x >= f.w || y >= f.h || f.tiles[y][x].solid) return false;
      return !f.actors.some((a) => !a.gone && a.x === x && a.y === y && a.def.kind !== 'foe' && a.def.solid !== false && !(a.def.kind === 'deco' && a.def.light === undefined && a.def.sprite === 'page'));
    };
    if (goal.has(f.x + ',' + f.y)) return -2;
    const first = new Map([[f.x + ',' + f.y, -1]]);
    const q = [[f.x, f.y]];
    while (q.length) {
      const [x, y] = q.shift();
      for (let d = 0; d < 4; d++) {
        const nx = x + D[d][0], ny = y + D[d][1], k = nx + ',' + ny;
        if (first.has(k) || !open(nx, ny)) continue;
        const fd = first.get(x + ',' + y);
        first.set(k, fd < 0 ? d : fd);
        if (goal.has(k)) return first.get(k);
        if (!f.map.exits.some((e) => e.x === nx && e.y === ny)) q.push([nx, ny]);
      }
    }
    return -1;
  },
  /** Walks to a tile, playing any scene or fight on the way. Returns 'at', 'map:<id>' when an exit is taken, or why it stopped. */
  walkTo(x, y, max = 400) {
    const map0 = this.field().map.id;
    for (let i = 0; i < max; i++) {
      const f = this.field();
      if (this.top() !== f || f.locked) { const r = this.advance(); if (r !== 'field') return r; continue; }
      if (f.map.id !== map0) return 'map:' + f.map.id;
      const d = this.path([[x, y]]);
      if (d === -2) return 'at';
      if (d < 0) return 'nopath';
      this.dir(['Down', 'Up', 'Left', 'Right'][d]);
      this.run(10);
    }
    return 'max';
  },
  /** Walks next to an actor, faces it, and casts a page of source at it. */
  castAt(id, src) {
    const f = this.field();
    const a = f.actors.find((o) => o.def.id === id && !o.gone);
    if (!a) return 'no actor ' + id;
    const r = this.talkTo(id, true);
    if (r !== 'field') return r;
    this.castSrc(src, 'field');
    return this.advance();
  },
  /** Walks next to an actor, faces it, and presses Z. */
  talkTo(id, faceOnly = false) {
    for (let tries = 0; tries < 400; tries++) {
      const f = this.field();
      const a = f.actors.find((o) => o.def.id === id && !o.gone);
      if (!a) return 'no actor ' + id;
      const D = [[0, 1], [0, -1], [-1, 0], [1, 0]];
      const all = D.map(([dx, dy]) => [a.x + dx, a.y + dy]);
      const next = all.filter(([x, y]) => x >= 0 && y >= 0 && x < f.w && y < f.h && !f.tiles[y][x].solid);
      const adj = all.findIndex(([x, y]) => x === f.x && y === f.y);
      if (adj >= 0) {
        f.dir = [1, 0, 3, 2][adj];
        this.run(2);
        if (faceOnly) return 'field';
        this.Z(); this.run(3);
        return this.advance();
      }
      const d = this.path(next);
      if (d < 0) return 'nopath to ' + id;
      const r = this.walkStep(d);
      if (r) return r;
    }
    return 'too far';
  },
  walkStep(d) {
    const map0 = this.field().map.id;
    this.dir(['Down', 'Up', 'Left', 'Right'][d]);
    this.run(10);
    const f = this.field();
    if (this.top() !== f || f.locked) { const r = this.advance(); if (r !== 'field') return r; }
    return f.map.id !== map0 ? 'map:' + f.map.id : '';
  },
  /** Keeps the current state under a name, so a long route can resume from it. */
  ckpt(name) {
    const s = rote.app.s, f = this.field();
    s.map = f.map.id; s.x = f.x; s.y = f.y; s.dir = f.dir;
    localStorage.setItem('ckpt-' + name, JSON.stringify(s));
    return name;
  },
  restore(name) {
    const t = localStorage.getItem('ckpt-' + name);
    if (!t) return 'no ckpt ' + name;
    localStorage.setItem('rote-opus-magic-save-v1', t);
    rote.game.continueGame();
    this.run(30);
    return this.field().map.id + ' ' + this.field().x + ',' + this.field().y;
  },
  /** Takes the first exit to a map whose condition holds. */
  exitTo(to) {
    const f = this.field();
    const ex = f.map.exits.filter((e) => e.to === to && f.cond(e.cond));
    if (!ex.length) return 'no exit to ' + to;
    return this.walkToAny(ex.map((e) => [e.x, e.y]));
  },
  walkToAny(goals, max = 400) {
    const map0 = this.field().map.id;
    for (let i = 0; i < max; i++) {
      const f = this.field();
      if (this.top() !== f || f.locked) { const r = this.advance(); if (r !== 'field') return r; continue; }
      if (f.map.id !== map0) return 'map:' + f.map.id;
      const d = this.path(goals);
      if (d === -2) return 'at';
      if (d < 0) return 'nopath';
      this.dir(['Down', 'Up', 'Left', 'Right'][d]);
      this.run(10);
    }
    return 'max';
  },
};
/** Saves the current frame at 4x to the scratchpad views folder, for inspection. */
H.view = async function (name) {
  rote.step(1);
  const src = document.getElementById('screen');
  const c = document.createElement('canvas');
  c.width = 768; c.height = 768;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, 768, 768);
  const r = await fetch('http://localhost:8743/save?name=view-' + name + '.png', { method: 'POST', body: c.toDataURL('image/png') });
  return r.text();
};
H.shot = async function (name) {
  rote.step(1);
  const r = await fetch('http://localhost:8743/save?name=' + name + '.png', { method: 'POST', body: document.getElementById('screen').toDataURL('image/png') });
  return r.text();
};
'harness ready';
