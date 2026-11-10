// Browser test harness. Load it with a script tag, then drive the game through window.h.
// It presses keys through the game's own input object and steps frames synchronously with game.step.
(function () {
  const game = window.game;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  const h = {
    errors,
    step(n) { game.step(n || 1); },
    press(k, n) { game.input.press(k); game.step(n || 2); },
    top() { const w = game.widgets; return w.length ? w[w.length - 1] : null; },
    kind() { const t = h.top(); return t ? t.kind || 'screen' : 'none'; },
    /** Presses confirm through dialogue, pages, and plain screens until a menu, a number picker, or free play is reached. */
    adv(max) {
      let n = 0;
      for (let i = 0; i < (max || 400); i++) {
        const k = h.kind();
        if (k === 'say' || k === 'screen') { h.press('ok', 2); n++; }
        else if (k === 'pages') { h.press('back', 2); n++; }
        else break;
      }
      return n;
    },
    menu() {
      const t = h.top();
      if (!t || t.kind !== 'menu') return null;
      return { title: t.info.title, items: t.info.items.map((it) => (it.off ? '(' + it.label + ')' : it.label)), cur: t.info.cur() };
    },
    /** Chooses a menu item whose label starts with the given text. */
    pick(label) {
      const t = h.top();
      if (!t || t.kind !== 'menu') return 'no menu, top is ' + h.kind();
      const i = t.info.items.findIndex((it) => it.label.toLowerCase().startsWith(String(label).toLowerCase()));
      if (i < 0) return 'no item ' + label + ' in ' + JSON.stringify(h.menu());
      if (t.info.items[i].off) return 'item is off: ' + label;
      t.info.set(i);
      h.press('ok', 3);
      return 'ok';
    },
    number(n) { const t = h.top(); if (!t || t.kind !== 'number') return 'no number'; t.info.set(n); h.press('ok', 3); return 'ok'; },
    st() {
      const s = game.G.s;
      if (!s) return { mode: 'title', top: h.kind(), menu: h.menu() };
      const cnt = game.counts(s);
      return {
        season: s.season, round: s.round + '/' + s.rounds, pending: s.pending.t + ':' + s.pending.p, over: s.over, battle: !!s.battle,
        players: s.players.map((p, i) => p.char + (p.human ? '*' : '') + ' @' + 'ABCDEFG'[p.x] + (p.y + 1) + ' ink' + p.ink + ' dbt' + p.doubt + ' st' + p.steps + ' pegs' + (7 - p.pegs) + ' cnt' + cnt[i] + ' ret[' + p.ret.map((c) => c.id + (c.fixed ? ':' + c.fixed : '')).join(',') + ']'),
        top: h.kind(), menu: h.menu(), log: game.G.log.slice(-4).map((l) => l.text), errors: errors.slice(-3),
      };
    },
    /** Lets computer parties act until the human must decide or a widget appears. */
    run(max) {
      const s = game.G.s;
      for (let i = 0; i < (max || 600); i++) {
        if (h.kind() !== 'none') break;
        if (game.G.waiting) break;
        if (s && s.over && i > 30) break;
        game.input.press('fast');
        game.step(4);
      }
      return h.kind();
    },
    /** Runs and confirms until the game needs a real decision: a menu, a number, or the human's free turn. */
    go(max) {
      for (let i = 0; i < (max || 60); i++) {
        h.run(300);
        const k = h.kind();
        if (k === 'menu' || k === 'number') break;
        if (game.G.waiting && k === 'none') break;
        if (game.G.s && game.G.s.over && k === 'none' && i > 3) { h.step(4); if (h.kind() === 'none') break; }
        h.adv(80);
      }
      return h.st();
    },
    /** Applies a rules action for the human directly, skipping the menus. The turn loop notices and carries on. */
    act(a) { game.apply(game.G.s, a); game.step(3); return h.st().players; },
    /** Plays the human's whole turn with the rival planner, for long regression runs. */
    autoTurn() {
      const s = game.G.s;
      let n = 0;
      while (!s.over && s.pending.t === 'turn' && s.pending.p >= 0 && s.players[s.pending.p].human && h.kind() === 'none' && n < 40) {
        const a = game.decide(s, []);
        game.apply(s, a);
        game.step(2);
        n++;
        if (a.t === 'end') break;
      }
      return n;
    },
    async view(name) {
      const c = document.getElementById('screen');
      const big = document.createElement('canvas');
      big.width = c.width * 3; big.height = c.height * 3;
      const g = big.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(c, 0, 0, big.width, big.height);
      const blob = await new Promise((res) => big.toBlob(res, 'image/png'));
      const r = await fetch('/__shot?name=' + name, { method: 'POST', body: blob });
      return r.text();
    },
  };
  window.h = h;
})();
