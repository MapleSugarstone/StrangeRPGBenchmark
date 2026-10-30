// The Soundtrack screen: each game's music as an album, played live by the game's own engine.
// A track runs in a hidden frame that loads the game's soundtrack script (see the README). Removing the frame stops the engine's timers.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const screen = $('soundtrack');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!screen || !AC) return;

  /** Seconds of fade at the end of a track. */
  const FADE = 4;
  const MINUTES = [1, 2, 3, 5, 10];
  const METER_BARS = 8;
  const METER_LEVELS = 6;

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
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  const clock = (s) => {
    const n = Math.max(0, Math.floor(s));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  };

  const state = {
    albums: [],
    view: null,
    open: false,
    sfx: { hover() {}, select() {}, back() {} },
    back() {},
    retitle() {},
    minutes: (() => { const m = Number(readSetting('menu.soundtrack.minutes', '3')); return MINUTES.includes(m) ? m : 3; })(),
    /** The last track played, as "<game id>/<track id>". */
    last: readSetting('menu.soundtrack.last', ''),
    accent: '#fff',
    failures: 0,
  };

  let ctx = null, master = null, analyser = null, bins = null, bands = null;
  let session = null;
  let token = 0;
  let paused = false;
  let rafId = 0;
  const shown = { elapsed: '', total: '' };

  // ------------------------------------------------------------ audio

  function audio() {
    if (ctx) return ctx;
    ctx = new AC();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);
    bins = new Uint8Array(analyser.frequencyBinCount);
    // Meter bars cover 60 Hz to 9 kHz in equal steps of pitch.
    const hz = ctx.sampleRate / analyser.fftSize;
    bands = Array.from({ length: METER_BARS + 1 }, (_, i) => Math.max(1, Math.round(60 * Math.pow(150, i / METER_BARS) / hz)));
    setInterval(tick, 250);
    return ctx;
  }

  /** Loads a game's soundtrack script in a hidden frame and resolves with the frame and its `window.soundtrack`. */
  function loadFrame(game) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.className = 'st-engine';
      frame.tabIndex = -1;
      frame.title = '';
      frame.setAttribute('aria-hidden', 'true');
      const fail = (why) => { clearTimeout(timer); frame.remove(); reject(new Error(why)); };
      const timer = setTimeout(() => fail('timed out'), 20000);
      frame.addEventListener('load', () => {
        clearTimeout(timer);
        let api = null;
        try { api = frame.contentWindow.soundtrack; } catch { /* a cross-origin frame hides its window */ }
        if (api && Array.isArray(api.tracks) && typeof api.start === 'function') resolve({ frame, api });
        else fail('the script did not set window.soundtrack');
      }, { once: true });
      const base = new URL(`games/${game.id}/`, document.baseURI).href;
      const src = String(game.soundtrack).replace(/"/g, '&quot;');
      frame.srcdoc = `<!doctype html><meta charset="utf-8"><base href="${base}"><script src="${src}"></script>`;
      document.body.append(frame);
    });
  }

  function cleanTracks(list) {
    let data;
    try { data = JSON.parse(JSON.stringify(list)); } catch { return []; }
    return data.filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string').map((t) => ({
      id: t.id,
      title: t.title,
      length: Number.isFinite(t.length) && t.length > 0 ? t.length : 0,
      once: !!t.once && Number.isFinite(t.length) && t.length > 0,
      changes: Array.isArray(t.changes)
        ? t.changes.filter((c) => c && typeof c.id === 'string' && typeof c.label === 'string')
          .map((c) => ({ id: c.id, label: c.label, toggle: !!c.toggle, steps: Array.isArray(c.steps) && c.steps.length ? c.steps.map(String) : null, value: c.value }))
        : [],
    }));
  }

  /** Reads an album's track list once, from a frame that is removed straight after. */
  function catalog(album) {
    if (album.tracks || album.error) return Promise.resolve(album);
    if (!album.loading) {
      album.loading = loadFrame(album.game).then(({ frame, api }) => {
        album.tracks = cleanTracks(api.tracks);
        frame.remove();
        if (!album.tracks.length) album.error = 'This soundtrack has no tracks.';
      }, (err) => {
        console.warn(`${album.game.title} soundtrack:`, err);
        album.error = 'This soundtrack did not load.';
      }).then(() => { album.loading = null; return album; });
    }
    return album.loading;
  }

  /** Seconds a track plays (`plan`) and when its fade starts (`fadeAt`). */
  function planOf(track) {
    if (!track.length) return { plan: state.minutes * 60, fadeAt: state.minutes * 60 - FADE };
    if (track.once) return { plan: track.length + 1, fadeAt: track.length };
    const loops = loopsOf(track);
    return { plan: loops * track.length + FADE, fadeAt: loops * track.length };
  }
  const loopsOf = (track) => Math.max(2, Math.ceil(90 / track.length));

  async function play(album, index) {
    const track = album.tracks && album.tracks[index];
    if (!track) return;
    const my = ++token;
    endSession(0.35);
    paused = false;
    const s = { album, index, track, gain: null, frame: null, api: null, t0: 0, ...planOf(track), fading: false, starting: true, error: '', values: {} };
    for (const c of track.changes) {
      if (c.toggle) s.values[c.id] = !!c.value;
      else if (c.steps) s.values[c.id] = Number.isInteger(c.value) && c.value >= 0 && c.value < c.steps.length ? c.value : 0;
    }
    session = s;
    state.last = `${album.game.id}/${track.id}`;
    writeSetting('menu.soundtrack.last', state.last);
    renderNow();
    try {
      audio();
      if (ctx.state !== 'running') await ctx.resume();
      const { frame, api } = await loadFrame(album.game);
      if (my !== token) { frame.remove(); return; }
      s.frame = frame;
      s.api = api;
      s.gain = ctx.createGain();
      s.trim = ctx.createGain();
      s.trim.gain.value = Math.pow(10, (Number(album.game.soundtrackGain) || 0) / 20);
      s.gain.connect(s.trim);
      s.trim.connect(master);
      await api.start(track.id, ctx, s.gain);
      if (my !== token) return;
      s.t0 = ctx.currentTime;
      s.starting = false;
      state.failures = 0;
    } catch (err) {
      if (my !== token) return;
      console.warn(`${album.game.title} soundtrack, ${track.title}:`, err);
      s.starting = false;
      s.error = 'This track did not start.';
      // Three failures in a row stop the player rather than skipping through every album.
      if (++state.failures < 3) setTimeout(() => { if (session === s) next(); }, 2500);
    }
    renderNow();
  }

  /** Fades the playing track out, then disconnects it and removes its frame. */
  function endSession(fade) {
    const s = session;
    session = null;
    if (!s) return;
    if (s.gain) {
      const g = s.gain.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fade);
    }
    setTimeout(() => {
      if (s.trim) s.trim.disconnect();
      if (s.frame) s.frame.remove();
    }, fade * 1000 + 150);
  }

  function stopAll() {
    token++;
    endSession(0.5);
    paused = false;
    renderNow();
    setTimeout(() => { if (!session && ctx && ctx.state === 'running') ctx.suspend(); }, 900);
  }

  /** Moves to the next track, and past the last track to the next album. The view follows the music. */
  async function next() {
    const s = session;
    if (!s) return;
    let album = s.album, index = s.index + 1;
    for (let hops = 0; hops < state.albums.length && !(album.tracks && index < album.tracks.length); hops++) {
      album = state.albums[(state.albums.indexOf(album) + 1) % state.albums.length];
      index = 0;
      await catalog(album);
      if (session !== s) return;
    }
    if (!album.tracks || !album.tracks[index]) { stopAll(); return; }
    if (state.open && album !== state.view) show(album, true);
    play(album, index);
  }

  /** Restarts the track, or goes back one when the track has only just started. */
  function prev() {
    const s = session;
    if (!s) return;
    const t = s.starting || s.error ? 0 : ctx.currentTime - s.t0;
    play(s.album, t > 3 || s.index === 0 ? s.index : s.index - 1);
  }

  async function togglePlay() {
    if (!session) {
      const album = state.view;
      if (!album || !album.tracks) return;
      const rows = rowsOf();
      const focused = rows.indexOf(document.activeElement);
      play(album, focused >= 0 ? focused : Math.max(0, lastIndex(album)));
      return;
    }
    if (session.starting || session.error) return;
    paused = !paused;
    renderNow();
    if (paused) await ctx.suspend(); else await ctx.resume();
  }

  function tick() {
    const s = session;
    if (!s || s.starting || s.error || paused || ctx.state !== 'running') return;
    const t = ctx.currentTime - s.t0;
    if (!s.fading && t >= s.fadeAt) {
      s.fading = true;
      const g = s.gain.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, s.t0 + Math.max(s.plan, t + 0.1));
    }
    if (t >= s.plan) next();
  }

  function change(c, value) {
    const s = session;
    if (!s || !s.api || typeof s.api.change !== 'function') return;
    if (c.toggle) value = !s.values[c.id];
    if (c.toggle || c.steps) s.values[c.id] = value;
    try { s.api.change(c.id, value); } catch (err) { console.warn(`${s.album.game.title} soundtrack, ${c.label}:`, err); }
    for (const b of $('st-changes').querySelectorAll('[data-change]')) {
      const v = s.values[b.dataset.change];
      if (b.dataset.step != null) b.setAttribute('aria-pressed', String(v === Number(b.dataset.step)));
      else if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', String(!!v));
    }
  }

  function setMinutes(m) {
    state.minutes = m;
    writeSetting('menu.soundtrack.minutes', String(m));
    const s = session;
    if (s && !s.track.length) {
      Object.assign(s, planOf(s.track));
      const t = s.starting || s.error ? 0 : ctx.currentTime - s.t0;
      if (s.fading && t < s.fadeAt) {
        s.fading = false;
        const g = s.gain.gain, now = ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(1, now + 0.5);
      }
    }
    renderLength();
    renderTracks();
    renderNow();
  }

  // ------------------------------------------------------------ the screen

  const rowsOf = () => Array.from($('st-tracks').querySelectorAll('.st-track'));
  const lastIndex = (album) => {
    const [id, track] = state.last.split('/');
    return id === album.game.id && album.tracks ? album.tracks.findIndex((t) => t.id === track) : -1;
  };

  const WAVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h3l2.5-6 4 13 3.5-10 2.5 6H22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';

  function lengthTip(t) {
    if (!t.length) return `Generated as it plays. Plays for ${state.minutes} min.`;
    if (t.once) return 'Plays once.';
    return `Plays ${loopsOf(t)} loops of ${clock(t.length)}.`;
  }

  function show(album, follow, opening) {
    const previous = state.view;
    state.view = album;
    const g = album.game;
    screen.style.setProperty('--accent', g.colors.accent);
    screen.style.setProperty('--ink', g.colors.ink);
    state.accent = g.colors.accent;
    $('st-scene').src = g.scene;
    $('st-hero').src = g.hero.sprite;
    $('st-title').textContent = g.title;
    $('st-title').classList.toggle('long', g.title.length > 18);
    $('st-author').replaceChildren(el('span', {}, 'by '), g.model, el('span', {}, ` · ${g.effort}`));
    if (state.open) {
      state.retitle(`${g.title} soundtrack`);
      if (follow) history.replaceState(history.state, '', `#music/${g.id}`);
    }
    const toList = opening || $('st-tracks').contains(document.activeElement);
    renderTracks();
    if (toList) focusRow();
    if (!album.tracks && !album.error) {
      catalog(album).then(() => {
        if (state.view !== album) return;
        const parked = document.activeElement === $('st-play');
        renderTracks();
        if ((toList && parked) || !screen.contains(document.activeElement)) focusRow();
      });
    }
    if (previous && previous !== album && !follow) {
      const banner = $('st-banner');
      const dir = state.albums.indexOf(album) > state.albums.indexOf(previous) ? 1 : -1;
      if (banner.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        banner.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }
    }
    renderNow();
  }

  function renderTracks() {
    const album = state.view;
    if (!album) return;
    $('st-error').hidden = !album.error;
    $('st-error').textContent = album.error;
    const list = $('st-tracks');
    list.setAttribute('aria-busy', String(!album.tracks && !album.error));
    if (!album.tracks) { list.replaceChildren(); return; }
    list.replaceChildren(...album.tracks.map((t, i) => {
      const len = el('span', { class: 'st-len', title: lengthTip(t) });
      if (!t.length) len.insertAdjacentHTML('afterbegin', WAVE);
      len.append(clock(planOf(t).plan));
      return el('li', {}, el('button', { class: 'st-track', type: 'button', 'data-index': String(i), onclick: () => play(album, i) },
        el('span', { class: 'st-num' },
          el('span', { class: 'st-digits' }, String(i + 1).padStart(2, '0')),
          el('span', { class: 'st-eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'))),
        el('span', { class: 'st-name' }, t.title),
        len));
    }));
    markPlaying();
  }

  function markPlaying() {
    const s = session;
    rowsOf().forEach((row, i) => row.setAttribute('aria-current', String(!!s && s.album === state.view && s.index === i)));
  }

  function renderNow() {
    const s = session;
    const playing = !!s && !paused && !s.error;
    screen.classList.toggle('playing', playing);
    $('st-now-title').textContent = s ? s.track.title : '';
    $('st-now-album').textContent = s ? s.error || s.album.game.title : '';
    $('st-now-album').classList.toggle('bad', !!(s && s.error));
    const btn = $('st-play');
    btn.classList.toggle('on', playing);
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    btn.title = playing ? 'Pause' : 'Play';
    $('st-back').disabled = !s;
    $('st-fwd').disabled = !s;
    renderChanges();
    markPlaying();
    const row = $('st-tracks').querySelector('[aria-current="true"]');
    if (row) reveal(row);
    drawProgress();
  }

  function renderChanges() {
    const s = session;
    const box = $('st-changes');
    if (!s || !s.track.changes.length) { box.replaceChildren(); return; }
    const ready = !!s.api && typeof s.api.change === 'function' && !s.error;
    box.replaceChildren(...s.track.changes.map((c) => {
      if (c.steps) {
        return el('div', { class: 'st-group', role: 'group', 'aria-label': c.label },
          el('span', { class: 'st-group-label' }, c.label),
          ...c.steps.map((label, i) => {
            const b = el('button', { class: 'st-chip', type: 'button', 'data-change': c.id, 'data-step': String(i), 'aria-pressed': String(s.values[c.id] === i), onclick: () => change(c, i) }, label);
            b.disabled = !ready;
            return b;
          }));
      }
      const b = el('button', { class: 'st-chip', type: 'button', 'data-change': c.id, onclick: () => change(c) }, c.label);
      if (c.toggle) b.setAttribute('aria-pressed', String(!!s.values[c.id]));
      b.disabled = !ready;
      return b;
    }));
  }

  function renderLength() {
    const box = $('st-length');
    box.querySelectorAll('.st-chip').forEach((b) => b.remove());
    for (const m of MINUTES) {
      box.append(el('button', { class: 'st-chip', type: 'button', 'aria-pressed': String(m === state.minutes), onclick: () => setMinutes(m) }, `${m} min`));
    }
  }

  function drawProgress() {
    const s = session;
    let t = 0;
    if (s && !s.starting && !s.error && ctx) t = Math.max(0, Math.min(s.plan, ctx.currentTime - s.t0));
    const elapsed = clock(t), total = s ? clock(s.plan) : '0:00';
    if (elapsed !== shown.elapsed) $('st-elapsed').textContent = shown.elapsed = elapsed;
    if (total !== shown.total) $('st-total').textContent = shown.total = total;
    $('st-fill').style.transform = `scaleX(${s ? t / s.plan : 0})`;
  }

  const meter = $('st-meter');
  const pen = meter.getContext('2d');

  /** Draws the level meter as lit cells: three pixels wide, one tall, with one-pixel gaps. */
  function drawMeter() {
    pen.clearRect(0, 0, meter.width, meter.height);
    const live = analyser && session && !paused;
    if (live) analyser.getByteFrequencyData(bins);
    for (let b = 0; b < METER_BARS; b++) {
      let level = 0;
      if (live) {
        let sum = 0;
        const lo = bands[b], hi = Math.max(lo + 1, bands[b + 1]);
        for (let i = lo; i < hi && i < bins.length; i++) sum += bins[i];
        level = Math.round(Math.pow(sum / (hi - lo) / 255, 1.4) * METER_LEVELS * 1.25);
      }
      for (let k = 0; k < METER_LEVELS; k++) {
        pen.fillStyle = k < level ? state.accent : 'rgba(255,255,255,0.13)';
        pen.fillRect(b * 4, meter.height - 1 - k * 2, 3, 1);
      }
    }
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    drawProgress();
    drawMeter();
  }

  function focusRow() {
    const rows = rowsOf();
    if (!rows.length) { $('st-play').focus({ preventScroll: true }); return; }
    const s = session;
    const i = s && s.album === state.view ? s.index : Math.max(0, lastIndex(state.view));
    rows[i].focus({ preventScroll: true });
    reveal(rows[i]);
  }

  /** Scrolls the track list, and only the list, so the row shows. */
  function reveal(row) {
    const list = $('st-tracks');
    const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
    if (rr.top < lr.top) list.scrollTop -= lr.top - rr.top;
    else if (rr.bottom > lr.bottom) list.scrollTop += rr.bottom - lr.bottom;
  }

  function moveRow(dir) {
    const rows = rowsOf();
    const i = rows.indexOf(document.activeElement);
    if (i < 0) { focusRow(); return; }
    const row = rows[Math.max(0, Math.min(rows.length - 1, i + dir))];
    row.focus();
    reveal(row);
  }

  function step(dir) {
    if (state.albums.length < 2) return;
    const i = state.albums.indexOf(state.view);
    state.sfx.hover();
    const album = state.albums[(i + dir + state.albums.length) % state.albums.length];
    history.replaceState(history.state, '', `#music/${album.game.id}`);
    show(album, false);
  }

  // The changes sit under the track list on wide screens and under the player buttons on narrow ones.
  const narrow = matchMedia('(max-width: 760px)');
  const placeChanges = () => (narrow.matches ? $('st-deck') : $('st-side')).append($('st-changes'));
  narrow.addEventListener('change', placeChanges);
  placeChanges();

  $('st-prev').addEventListener('click', () => step(-1));
  $('st-next').addEventListener('click', () => step(1));
  $('st-back').addEventListener('click', prev);
  $('st-play').addEventListener('click', togglePlay);
  $('st-fwd').addEventListener('click', () => next());
  $('st-menu').addEventListener('click', () => state.back());

  document.addEventListener('keydown', (e) => {
    if (!state.open || e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        state.back();
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        step(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault();
        moveRow(e.key === 'ArrowUp' ? -1 : 1);
        return;
      case ' ':
        e.preventDefault();
        if (!e.repeat) togglePlay();
    }
  });
  // A focused button would also take the space bar as a click when the key comes up.
  document.addEventListener('keyup', (e) => { if (state.open && e.key === ' ') e.preventDefault(); });

  function open(id) {
    const album = state.albums.find((a) => a.game.id === id) || state.albums[0];
    if (!album) return;
    const fresh = !state.open;
    state.open = true;
    screen.hidden = false;
    if (fresh && screen.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      screen.animate([{ transform: 'scale(0.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    }
    if (fresh || album !== state.view) show(album, false, fresh);
    if (!rafId) loop();
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    screen.hidden = true;
    cancelAnimationFrame(rafId);
    rafId = 0;
    stopAll();
  }

  window.menuSoundtrack = {
    /** Takes the games list and the menu's hooks, and answers whether any game has a soundtrack. */
    init(options) {
      state.albums = options.games.filter((g) => g.soundtrack && g.status !== 'wip').map((game) => ({ game, tracks: null, error: '', loading: null }));
      Object.assign(state, { sfx: options.sfx, back: options.back, retitle: options.retitle });
      renderLength();
      return state.albums.length > 0;
    },
    has: (id) => state.albums.some((a) => a.game.id === id),
    lastAlbum() {
      const id = state.last.split('/')[0];
      const album = state.albums.find((a) => a.game.id === id) || state.albums[0];
      return album ? album.game.id : null;
    },
    open,
    close,
    isOpen: () => state.open,
  };
})();
