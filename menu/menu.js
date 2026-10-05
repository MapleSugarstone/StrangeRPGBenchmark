(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const track = $('track');
  const pager = $('pager');
  const prevBtn = $('prev');
  const nextBtn = $('next');
  const preview = $('preview');
  const player = $('player');
  const frame = $('player-frame');

  const state = {
    games: [],
    cols: 4,
    rows: 2,
    perPage: 8,
    pages: 1,
    page: 0,
    current: null,
    shot: 0,
    shotTimer: 0,
    returnFocus: null,
    toMenuPending: false,
    sound: readSetting('menu.sound', '1') === '1',
  };

  function readSetting(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }
  function writeSetting(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage can be blocked */ }
  }

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'style') for (const [p, val] of Object.entries(v)) node.style.setProperty(p, val);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  // Sound effects are synthesized, and browsers only start audio after the first click or key press.

  const sfx = (() => {
    let ctx = null;
    const unlock = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
    };
    addEventListener('pointerdown', unlock, { capture: true });
    addEventListener('keydown', unlock, { capture: true });
    const play = (notes, type = 'sine', gain = 0.05) => {
      if (!state.sound || !ctx || ctx.state !== 'running') return;
      let t = ctx.currentTime;
      for (const [freq, dur] of notes) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(gain, t + 0.008);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(amp).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur * 0.7;
      }
    };
    return {
      hover: () => play([[1568, 0.05]], 'triangle', 0.035),
      select: () => play([[784, 0.08], [1175, 0.14]], 'triangle', 0.06),
      back: () => play([[988, 0.08], [659, 0.12]], 'triangle', 0.05),
      page: () => play([[523, 0.06], [784, 0.09]], 'sine', 0.05),
      start: () => play([[659, 0.08], [988, 0.08], [1319, 0.2]], 'triangle', 0.06),
    };
  })();

  // Shelf

  function layoutFor(w, h) {
    const cols = w < 560 ? 2 : w < 980 ? 3 : 4;
    const rows = h > w * 1.35 ? 3 : 2;
    return { cols, rows };
  }

  // Positions and delays of the sparkles on a golden cartridge, as left %, top %, delay in seconds, and size in cqw.
  const SPARKLES = [[6, 8, 0, 10], [88, 22, 0.7, 7], [14, 58, 1.3, 6.5], [92, 70, 0.35, 9], [50, 4, 1.8, 6], [74, 92, 1.05, 8], [30, 90, 2.2, 6]];

  function cartridge(game, index) {
    const wip = game.status === 'wip';
    const label = `${game.title}, by ${game.model}, ${game.effort}${game.polish ? `, polished by ${game.polish}` : ''}${game.golden ? ', golden cartridge' : ''}${wip ? ', work in progress' : ''}`;
    const sparkles = game.golden ? SPARKLES.map(([x, y, d, s]) =>
      el('span', { class: 'sparkle', 'aria-hidden': 'true', style: { '--x': `${x}%`, '--y': `${y}%`, '--d': `${d}s`, '--s': `${s}cqw` } })) : [];
    const slot = el('button', {
      class: game.golden ? 'slot golden' : 'slot',
      type: 'button',
      'data-index': String(index),
      'aria-label': label,
      style: { '--accent': game.colors.accent, '--ink': game.colors.ink },
      onclick: (e) => openGame(game, e.currentTarget),
      onmouseenter: () => sfx.hover(),
    },
      el('span', { class: 'cart-wrap' },
        el('span', { class: 'cart' },
          el('span', { class: 'cart-top' }),
          el('span', { class: 'label-well' },
            el('span', { class: 'label' },
              el('span', { class: 'label-title' }, game.title),
              el('span', { class: 'label-art' },
                el('img', { class: 'label-scene', src: game.scene, alt: '', draggable: 'false' }),
                el('img', { class: 'label-hero', src: game.hero.sprite, alt: '', draggable: 'false' }),
              ),
              el('span', { class: 'label-author' },
                el('span', { class: 'label-model' }, game.model),
                el('span', { class: 'label-effort' }, game.effort),
                game.polish ? el('span', { class: 'label-polish' }, `Polished by: ${game.polish}`) : null,
              ),
            ),
          ),
          el('span', { class: 'cart-grip' }),
          game.golden ? el('span', { class: 'cart-shine', 'aria-hidden': 'true' }) : null,
          wip ? el('span', { class: 'wip-tape', 'aria-hidden': 'true' }, 'Work in progress') : null,
        ),
        ...sparkles,
      ),
    );
    return slot;
  }

  function renderShelf(keepIndex) {
    const { cols, rows } = layoutFor(innerWidth, innerHeight);
    state.cols = cols;
    state.rows = rows;
    state.perPage = cols * rows;
    const n = state.games.length;
    // Always leave room for at least one more cartridge, so the last page shows an empty slot.
    state.pages = Math.max(2, Math.floor(n / state.perPage) + 1);
    track.replaceChildren();
    for (let p = 0; p < state.pages; p++) {
      const grid = el('div', { class: 'grid', style: { '--cols': String(cols), '--rows': String(rows) } });
      for (let i = 0; i < state.perPage; i++) {
        const index = p * state.perPage + i;
        const game = state.games[index];
        grid.append(game ? cartridge(game, index) : el('div', { class: 'slot empty', 'aria-hidden': 'true' }));
      }
      track.append(el('section', { class: 'page', 'aria-label': `Page ${p + 1} of ${state.pages}` }, grid));
    }
    pager.replaceChildren(...Array.from({ length: state.pages }, (_, p) =>
      el('button', { type: 'button', 'aria-label': `Page ${p + 1}`, onclick: () => goToPage(p, true) })));
    const page = keepIndex != null ? Math.floor(keepIndex / state.perPage) : state.page;
    goToPage(page, false);
  }

  function goToPage(p, withSound) {
    const page = Math.max(0, Math.min(state.pages - 1, p));
    if (withSound && page !== state.page) sfx.page();
    state.page = page;
    track.style.transform = `translateX(${-page * 100}%)`;
    track.querySelectorAll('.page').forEach((node, i) => { node.inert = i !== page; });
    pager.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', String(i === page)));
    prevBtn.hidden = page === 0;
    nextBtn.hidden = page === state.pages - 1;
  }

  function focusGame(index) {
    if (index < 0 || index >= state.games.length) return;
    const page = Math.floor(index / state.perPage);
    if (page !== state.page) goToPage(page, true);
    track.querySelector(`.slot[data-index="${index}"]`)?.focus({ preventScroll: true });
  }

  prevBtn.addEventListener('click', () => goToPage(state.page - 1, true));
  nextBtn.addEventListener('click', () => goToPage(state.page + 1, true));

  let lastWheel = 0;
  $('shelf').addEventListener('wheel', (e) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 12) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheel < 500) return;
    lastWheel = now;
    goToPage(state.page + Math.sign(delta), true);
  }, { passive: false });

  let swipe = null;
  let swiped = false;
  $('shelf').addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    swipe = { x: e.clientX, y: e.clientY };
    swiped = false;
  });
  $('shelf').addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      goToPage(state.page + (dx < 0 ? 1 : -1), true);
    }
  });
  $('shelf').addEventListener('click', (e) => {
    if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
  }, { capture: true });

  document.addEventListener('keydown', (e) => {
    if (!preview.hidden || !player.hidden || $('about').open) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement;
    const onSlot = active?.classList?.contains('slot') && !active.classList.contains('empty');
    const index = onSlot ? Number(active.dataset.index) : null;
    const firstOnPage = state.page * state.perPage;
    const move = (target) => { e.preventDefault(); focusGame(target); };
    switch (e.key) {
      case 'ArrowRight':
        if (index == null) return move(firstOnPage);
        return move(Math.min(state.games.length - 1, index + 1));
      case 'ArrowLeft':
        if (index == null) return move(firstOnPage);
        return move(Math.max(0, index - 1));
      case 'ArrowDown':
      case 'ArrowUp': {
        if (index == null) return move(firstOnPage);
        const step = e.key === 'ArrowDown' ? state.cols : -state.cols;
        const target = index + step;
        if (Math.floor(target / state.perPage) === state.page && target >= 0 && target < state.games.length) move(target);
        else e.preventDefault();
        return;
      }
      case 'PageDown':
        e.preventDefault();
        return goToPage(state.page + 1, true);
      case 'PageUp':
        e.preventDefault();
        return goToPage(state.page - 1, true);
    }
  });

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const { cols, rows } = layoutFor(innerWidth, innerHeight);
      if (cols === state.cols && rows === state.rows) return;
      const focused = document.activeElement?.dataset?.index;
      renderShelf(focused != null ? Number(focused) : state.page * state.perPage);
    }, 120);
  });

  // Routing. #game/<id> shows a preview, and #play/<id> runs the game.

  const base = () => location.pathname + location.search;

  function go(hash) {
    const depth = (history.state && history.state.depth) || 0;
    history.pushState({ depth: depth + 1 }, '', '#' + hash);
    route();
  }

  function toMenu() {
    const depth = (history.state && history.state.depth) || 0;
    if (depth > 0) {
      state.toMenuPending = true;
      history.go(-depth);
    } else {
      history.replaceState(null, '', base());
      route();
    }
  }

  addEventListener('popstate', () => {
    if (state.toMenuPending && location.hash) history.replaceState(null, '', base());
    state.toMenuPending = false;
    route();
  });
  addEventListener('hashchange', route);

  function route() {
    const m = /^#(game|play)\/([\w-]+)$/.exec(location.hash);
    const game = m && state.games.find((g) => g.id === m[2]);
    if (!game) {
      closePlayer();
      closePreview();
      return;
    }
    if (m[1] === 'play' && game.status !== 'wip') {
      openPlayer(game);
    } else {
      closePlayer();
      openPreview(game);
    }
  }

  function openGame(game, slot) {
    sfx.select();
    state.returnFocus = slot;
    state.origin = slot.getBoundingClientRect();
    go(`game/${game.id}`);
  }

  // Preview

  function openPreview(game) {
    const fresh = preview.hidden || state.current !== game;
    state.current = game;
    app.inert = true;
    if (fresh) fillPreview(game);
    if (preview.hidden) {
      preview.hidden = false;
      animateOpen();
    }
    startShots();
    $(game.status === 'wip' ? 'pv-back' : 'pv-start').focus({ preventScroll: true });
  }

  function fillPreview(game) {
    const banner = $('pv-banner');
    preview.style.setProperty('--accent', game.colors.accent);
    preview.style.setProperty('--ink', game.colors.ink);
    banner.style.setProperty('--accent', game.colors.accent);
    banner.style.setProperty('--ink', game.colors.ink);
    $('pv-title').textContent = game.title;
    $('pv-author').replaceChildren(el('span', {}, 'by '), game.model, el('span', {}, ` · ${game.effort}`));
    if (game.agent) $('pv-author').append(el('span', {}, ` · through ${game.agent}`));
    if (game.polish) $('pv-author').append(el('span', {}, ` · polished by ${game.polish}`));
    $('pv-wip').hidden = game.status !== 'wip';
    $('pv-blurb').textContent = game.blurb;
    $('pv-hero').src = game.hero.sprite;
    $('pv-hero').alt = game.hero.name;
    $('pv-hero-name').textContent = game.hero.name;
    $('pv-hero-role').textContent = game.hero.role || '';

    const facts = [['Chapters', String(game.chapters)]];
    if (game.golden) facts.push(['Cartridge', 'Golden edition']);
    if (game.controls) facts.push(['Controls', game.controls]);
    $('pv-facts').replaceChildren(...facts.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));

    const shots = [game.scene, ...(game.shots || [])];
    $('pv-screen').replaceChildren(...shots.map((src, i) =>
      el('img', { src, alt: `${game.title} screenshot ${i + 1}`, class: i === 0 ? 'on' : '', draggable: 'false' })));
    $('pv-dots').replaceChildren(...(shots.length > 1 ? shots.map((_, i) =>
      el('button', { type: 'button', 'aria-label': `Screenshot ${i + 1}`, onclick: () => showShot(i, true) })) : []));
    state.shot = 0;
    showShot(0, false);

    const start = $('pv-start');
    const wip = game.status === 'wip';
    start.disabled = wip;
    start.textContent = wip ? 'Not playable yet' : 'Start';
  }

  function showShot(i, manual) {
    const imgs = $('pv-screen').querySelectorAll('img');
    if (!imgs.length) return;
    state.shot = (i + imgs.length) % imgs.length;
    imgs.forEach((img, k) => img.classList.toggle('on', k === state.shot));
    $('pv-dots').querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === state.shot)));
    if (manual) startShots();
  }

  function startShots() {
    clearInterval(state.shotTimer);
    state.shotTimer = setInterval(() => showShot(state.shot + 1, false), 4000);
  }

  function animateOpen() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !preview.animate) return;
    const r = state.origin;
    state.origin = null;
    const from = r
      ? `translate(${r.left + r.width / 2 - innerWidth / 2}px, ${r.top + r.height / 2 - innerHeight / 2}px) scale(${Math.max(0.15, r.width / innerWidth)})`
      : 'scale(0.92)';
    preview.animate(
      [{ transform: from, opacity: 0, borderRadius: '40px' }, { transform: 'none', opacity: 1, borderRadius: '0px' }],
      { duration: 380, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }

  function closePreview() {
    clearInterval(state.shotTimer);
    preview.hidden = true;
    state.current = null;
    if (!player.hidden) return;
    app.inert = false;
    const slot = state.returnFocus;
    state.returnFocus = null;
    if (slot && slot.isConnected) slot.focus({ preventScroll: true });
  }

  $('pv-back').addEventListener('click', () => { sfx.back(); toMenu(); });
  $('pv-start').addEventListener('click', () => {
    if (!state.current || state.current.status === 'wip') return;
    sfx.start();
    go(`play/${state.current.id}`);
  });
  $('pv-screen').addEventListener('click', () => showShot(state.shot + 1, true));
  preview.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); sfx.back(); toMenu(); }
    if (e.key === 'ArrowLeft') showShot(state.shot - 1, true);
    if (e.key === 'ArrowRight') showShot(state.shot + 1, true);
  });

  // Player

  function openPlayer(game) {
    clearInterval(state.shotTimer);
    preview.hidden = true;
    app.inert = true;
    const src = `games/${game.id}/index.html`;
    if (player.hidden || player.dataset.id !== game.id) {
      player.dataset.id = game.id;
      frame.title = game.title;
      frame.src = src;
      $('player-tab').href = src;
    }
    player.hidden = false;
    document.title = `${game.title} · Strange RPG Benchmark`;
    frame.focus();
  }

  function closePlayer() {
    if (player.hidden) return;
    player.hidden = true;
    delete player.dataset.id;
    frame.src = 'about:blank';
    document.title = 'Strange RPG Benchmark';
    if (preview.hidden) app.inert = false;
  }

  frame.addEventListener('load', () => {
    if (player.hidden) return;
    try { frame.contentWindow.focus(); } catch { /* cross-origin frames refuse focus */ }
  });
  $('player-home').addEventListener('click', () => { sfx.back(); toMenu(); });

  // Dock

  $('about-btn').addEventListener('click', () => { sfx.select(); $('about').showModal(); });
  $('about-btn').addEventListener('mouseenter', () => sfx.hover());

  const soundBtn = $('sound-btn');
  const syncSound = () => soundBtn.setAttribute('aria-pressed', String(state.sound));
  soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    writeSetting('menu.sound', state.sound ? '1' : '0');
    syncSound();
    sfx.select();
  });
  soundBtn.addEventListener('mouseenter', () => sfx.hover());
  syncSound();

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  function tick() {
    const now = new Date();
    const parts = timeFmt.formatToParts(now);
    $('clock-time').textContent = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
    $('clock-period').textContent = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
    $('clock-date').textContent = dateFmt.format(now);
    setTimeout(tick, 1000 - (now.getTime() % 1000) + 5);
  }
  tick();

  // Boot

  fetch('games.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
    .then((data) => {
      state.games = data.games || [];
      const playable = state.games.filter((g) => g.status !== 'wip').length;
      $('count').textContent = `${state.games.length} cartridges · ${playable} playable`;
      renderShelf(0);
      route();
    })
    .catch(() => {
      $('load-error').hidden = false;
      renderShelf(0);
    });
})();
