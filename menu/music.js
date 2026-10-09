// Background music for the game menu: calm generated chords on a soft electric piano, gentle bells, and warm airy pads.
// It starts when the opening screen closes, fades out while a game is open or the tab is hidden, and the corner button mutes it.
(() => {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  const STORE = 'menu.music';
  /** The music's overall level after the compressor. It sits well under the menu's sound effects. */
  const LEVEL = 0.38;

  const read = () => { try { return localStorage.getItem(STORE); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(STORE, v); } catch { /* storage can be blocked */ } };

  let muted = read() === '0';
  let started = false;
  let gameOpen = false;
  let running = false;
  let ctx = null, out = null, bus = null, revIn = null, echoIn = null, echo = null, noise = null;
  let secEnd = 0, timer = 0, sleepTimer = 0;

  const rnd = Math.random;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const chance = (p) => rnd() < p;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ------------------------------------------------------------ the sound graph

  /** A stereo room: noise that darkens as it decays, so the tail is soft rather than bright. */
  function impulse(secs) {
    const sr = ctx.sampleRate, n = Math.floor(sr * secs), buf = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lp += (rnd() * 2 - 1 - lp) * (0.55 - 0.45 * t);
        d[i] = lp * Math.pow(1 - t, 2.4) * Math.min(1, i / (sr * 0.012));
      }
    }
    return buf;
  }

  function build() {
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.ratio.value = 3;
    comp.attack.value = 0.03;
    comp.release.value = 0.5;
    comp.connect(out);
    out.connect(ctx.destination);
    bus = ctx.createGain();
    bus.connect(comp);
    const rev = ctx.createConvolver(), revOut = ctx.createGain();
    rev.buffer = impulse(3.6);
    revOut.gain.value = 0.6;
    revIn = ctx.createGain();
    revIn.connect(rev);
    rev.connect(revOut);
    revOut.connect(comp);
    // A soft echo a dotted eighth behind, darkened each time round.
    echoIn = ctx.createGain();
    echo = ctx.createDelay(2);
    const fb = ctx.createGain(), lp = ctx.createBiquadFilter(), echoOut = ctx.createGain();
    fb.gain.value = 0.33;
    lp.type = 'lowpass';
    lp.frequency.value = 2300;
    echoOut.gain.value = 0.45;
    echoIn.connect(echo);
    echo.connect(lp);
    lp.connect(fb);
    fb.connect(echo);
    lp.connect(echoOut);
    echoOut.connect(bus);
    echoOut.connect(revIn);
    echo.delayTime.value = 0.75 * 60 / song.bpm;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
  }

  /** Sends a voice to the dry mix, the room, and the echo, placed left or right. */
  function route(node, pan, room, delay) {
    let n = node;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      n = p;
    }
    n.connect(bus);
    if (room) { const g = ctx.createGain(); g.gain.value = room; n.connect(g); g.connect(revIn); }
    if (delay) { const g = ctx.createGain(); g.gain.value = delay; n.connect(g); g.connect(echoIn); }
  }

  // ------------------------------------------------------------ voices

  /** A soft electric piano: a sine bent by a sine at the same pitch, with a short bright tine at the start. */
  function piano(t, m, vel, dur) {
    const f = mtof(m), v = vel * 0.1, end = t + dur + 1.2;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
    const tine = ctx.createOscillator(), tg = ctx.createGain(), amp = ctx.createGain();
    car.frequency.value = f;
    car.detune.value = (rnd() - 0.5) * 8;
    mod.frequency.value = f;
    mg.gain.setValueAtTime(f * (0.9 + vel * 0.5), t);
    mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 1.6);
    tine.frequency.value = f * 7;
    tg.gain.setValueAtTime(v * 0.12, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(v, t + 0.006);
    amp.gain.setTargetAtTime(v * 0.3, t + 0.006, 0.6 + Math.max(0, 84 - m) * 0.025);
    amp.gain.setTargetAtTime(0, t + dur, 0.22);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(amp);
    tine.connect(tg);
    tg.connect(amp);
    route(amp, (m - 64) / 50, 0.3, 0.08);
    for (const o of [car, mod, tine]) { o.start(t); o.stop(end); }
  }

  /** A gentle glassy bell: a sine rung by a modulator at three and a half times its pitch, with a warm octave under the strike. */
  function bell(t, m, vel) {
    const f = mtof(m), v = vel * 0.07, end = t + 3;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), amp = ctx.createGain();
    const low = ctx.createOscillator(), lg = ctx.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.1, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.04, t + 0.9);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(v, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    low.frequency.value = f / 2;
    lg.gain.setValueAtTime(v * 0.35, t);
    lg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(amp);
    low.connect(lg);
    lg.connect(amp);
    route(amp, (rnd() - 0.5) * 0.6, 0.45, 0.32);
    for (const o of [car, mod, low]) { o.start(t); o.stop(end); }
  }

  /** A music box tine: a pure tone with a faint third partial, quick to fade. */
  function box(t, m, vel) {
    const f = mtof(m), v = vel * 0.05, end = t + 1.4;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), bg = ctx.createGain(), amp = ctx.createGain();
    a.frequency.value = f;
    b.frequency.value = f * 3;
    bg.gain.setValueAtTime(0.25, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(v, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    a.connect(amp);
    b.connect(bg);
    bg.connect(amp);
    route(amp, (rnd() - 0.5) * 0.9, 0.5, 0.4);
    for (const o of [a, b]) { o.start(t); o.stop(end); }
  }

  /** A warm airy pad: two softly detuned saws a note through a slow low-pass, swelling in and out. */
  function pad(t, notes, dur, vel) {
    const fl = ctx.createBiquadFilter(), amp = ctx.createGain(), rel = 3, end = t + dur + rel;
    fl.type = 'lowpass';
    fl.Q.value = 0.4;
    fl.frequency.setValueAtTime(420, t);
    fl.frequency.linearRampToValueAtTime(950 + rnd() * 300, t + Math.max(1, dur * 0.6));
    fl.frequency.linearRampToValueAtTime(450, end);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(vel, t + Math.min(2.4, dur * 0.7));
    amp.gain.setValueAtTime(vel, t + dur);
    amp.gain.linearRampToValueAtTime(0.0001, end);
    fl.connect(amp);
    route(amp, 0, 0.6, 0);
    for (const m of notes) {
      for (const d of [-8, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = d + (rnd() - 0.5) * 4;
        g.gain.value = 0.5 / notes.length;
        o.connect(g);
        g.connect(fl);
        o.start(t);
        o.stop(end + 0.05);
      }
    }
    // A breath of air over the pad.
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ag = ctx.createGain();
    src.buffer = noise;
    src.loop = true;
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + rnd() * 1600;
    bp.Q.value = 0.8;
    ag.gain.setValueAtTime(0.0001, t);
    ag.gain.linearRampToValueAtTime(vel * 0.05, t + dur * 0.5);
    ag.gain.linearRampToValueAtTime(0.0001, end);
    src.connect(bp);
    bp.connect(ag);
    route(ag, (rnd() - 0.5) * 0.8, 0.7, 0);
    src.start(t, rnd() * 0.8);
    src.stop(end + 0.05);
  }

  /** A round soft bass: a sine with a quiet triangle an octave up, through a low-pass. */
  function bass(t, m, vel, dur) {
    const f = mtof(m), v = vel * 0.16, end = t + dur + 0.6;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), bg = ctx.createGain(), fl = ctx.createBiquadFilter(), amp = ctx.createGain();
    a.frequency.value = f;
    b.type = 'triangle';
    b.frequency.value = f * 2;
    bg.gain.value = 0.18;
    fl.type = 'lowpass';
    fl.frequency.value = 420;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(v, t + 0.025);
    amp.gain.setTargetAtTime(v * 0.6, t + 0.025, 0.5);
    amp.gain.setTargetAtTime(0, t + dur, 0.15);
    a.connect(fl);
    b.connect(bg);
    bg.connect(fl);
    fl.connect(amp);
    route(amp, 0, 0.06, 0);
    for (const o of [a, b]) { o.start(t); o.stop(end); }
  }

  /** Very soft percussion: a shaker of high noise, or a small wooden tick. */
  function perc(t, kind, vel) {
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), amp = ctx.createGain(), len = kind === 'shaker' ? 0.07 : 0.04;
    src.buffer = noise;
    fl.type = kind === 'shaker' ? 'highpass' : 'bandpass';
    fl.frequency.value = kind === 'shaker' ? 6500 : 1900;
    fl.Q.value = kind === 'shaker' ? 0.7 : 3;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(vel, t + (kind === 'shaker' ? 0.012 : 0.002));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(fl);
    fl.connect(amp);
    route(amp, kind === 'shaker' ? 0.3 : -0.2, 0.2, 0);
    src.start(t, rnd() * 0.8);
    src.stop(t + len + 0.02);
  }

  // ------------------------------------------------------------ harmony

  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  /** Chord shapes as semitones above the root. */
  const QUAL = {
    maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], six9: [0, 4, 7, 9, 14], lyd: [0, 4, 7, 11, 18],
    m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], m6: [0, 3, 7, 9], sus9: [0, 5, 7, 10, 14],
  };
  /** Four-chord progressions as [root above the key, shape]. */
  const PROGS = [
    [[0, 'maj9'], [9, 'm9'], [5, 'maj7'], [7, 'sus9']],
    [[5, 'maj7'], [4, 'm7'], [2, 'm9'], [0, 'add9']],
    [[0, 'maj7'], [10, 'maj7'], [5, 'maj9'], [0, 'six9']],
    [[9, 'm9'], [5, 'maj7'], [0, 'add9'], [7, 'sus9']],
    [[0, 'maj7'], [4, 'm7'], [5, 'maj7'], [5, 'm6']],
    [[2, 'm9'], [7, 'sus9'], [0, 'maj9'], [9, 'm7']],
    [[5, 'lyd'], [0, 'maj7'], [5, 'lyd'], [7, 'sus9']],
    [[0, 'maj9'], [2, 'm7'], [4, 'm7'], [5, 'maj9']],
  ];
  /** The order of a piece's sections. Each name sets which instruments play and how. */
  const PLANS = [
    ['air', 'theme', 'theme', 'drift', 'groove', 'theme', 'air'],
    ['drift', 'theme', 'groove', 'groove', 'drift', 'theme'],
    ['air', 'drift', 'theme', 'groove', 'theme', 'drift'],
  ];
  /** Two-bar melody rhythms as [beat, length]. */
  const RHYTHMS = [
    [[0, 1.5], [1.5, 0.5], [2, 2], [5, 1], [6, 2]],
    [[0.5, 0.5], [1, 1], [2, 1.5], [4, 3]],
    [[0, 2], [2.5, 0.5], [3, 1], [4, 1], [5, 3]],
    [[1, 1], [2, 1], [3, 1.5], [4.5, 3.5]],
    [[0, 1], [1, 1], [2, 2], [6, 1], [7, 1]],
    [[0, 3], [3, 0.5], [3.5, 0.5], [4, 4]],
  ];

  const song = { key: 5, bpm: 70, swing: 0.12, progs: null, plan: [], at: 0, motif: null, prev: null, mel: 76 };

  function newPiece() {
    song.key = song.progs ? (song.key + pick([5, 7, 2, 10, 5, 0])) % 12 : pick([0, 2, 3, 5, 7, 8]);
    song.bpm = 66 + Math.floor(rnd() * 12);
    song.swing = 0.07 + rnd() * 0.08;
    const a = pick(PROGS);
    let b = pick(PROGS);
    while (b === a) b = pick(PROGS);
    song.progs = [a, b];
    song.plan = pick(PLANS).slice();
    song.at = 0;
    const rh = pick(RHYTHMS);
    song.motif = { rh, steps: rh.map((_, i) => (i ? pick([1, -1, 2, -2, 1, -1, 3, -3, 0]) : 0)) };
    // The echo follows the new tempo from the piece's first note.
    if (echo) echo.delayTime.setValueAtTime(0.75 * 60 / song.bpm, Math.max(ctx.currentTime, secEnd));
  }

  const pcs = (key, ch) => QUAL[ch[1]].map((x) => (key + ch[0] + x) % 12);

  /** Chord voicings: the piano's upper tones close to the last voicing, a pad in open position, and the bass root. */
  function voicing(ch) {
    const root = (song.key + ch[0]) % 12, shape = QUAL[ch[1]];
    const lo = song.prev ? Math.max(52, Math.min(58, song.prev[0] + pick([-2, -1, 0, 1, 2]))) : 55;
    const upper = shape.filter((x) => x !== 0).map((x) => lo + ((root + x - lo) % 12 + 12) % 12).sort((a, b) => a - b);
    const r = 41 + ((root - 41) % 12 + 12) % 12;
    const third = shape[1], top = shape[3] ?? shape[2];
    return { upper, pad: [r, r + 7, r + third + 12, r + top + 12], bass: 36 + ((root - 36) % 12 + 12) % 12 };
  }

  /** A swung time: an off-beat eighth lands a little late. */
  const sw = (t) => (Math.abs((t % 1) - 0.5) < 1e-6 ? t + song.swing : t);

  /** The nearest pitch to `m` whose pitch class is in `set`. */
  function nearest(m, set) {
    for (let d = 0; d < 7; d++) for (const s of [m - d, m + d]) if (set.includes(((s % 12) + 12) % 12)) return s;
    return m;
  }

  /** The melody's pitch on scale degree `d`, counted from the key's root just below middle C. */
  const degPitch = (d) => 60 + (song.key > 6 ? song.key - 12 : song.key) + MAJOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  function degOf(m) {
    let best = 0, bd = 99;
    for (let d = -7; d < 28; d++) { const x = Math.abs(degPitch(d) - m); if (x < bd) { bd = x; best = d; } }
    return best;
  }

  function makeSection() {
    if (!song.progs || song.at >= song.plan.length) newPiece();
    const arr = song.plan[song.at++];
    const slow = arr === 'air' || arr === 'drift';
    const prog = song.progs[arr === 'drift' || (arr === 'air' && chance(0.5)) ? 1 : 0];
    const chords = [];
    for (let i = 0; i < 8; i++) chords.push(prog[slow ? Math.floor(i / 2) % 4 : i % 4]);
    if (!slow && chance(0.3)) chords[7] = chance(0.5) ? [5, 'm6'] : [7, 'sus9'];
    const ev = [];
    const comp = arr === 'theme' ? pick(['hold', 'pulse']) : arr === 'groove' ? 'broken' : arr === 'air' || chance(0.5) ? 'sparse' : 'none';
    chords.forEach((ch, i) => {
      const t0 = i * 4, v = voicing(ch);
      song.prev = v.upper;
      const fresh = i === 0 || chords[i - 1] !== ch;
      if (fresh && (arr !== 'groove' || chance(0.5))) {
        let len = 1;
        while (i + len < 8 && chords[i + len] === ch) len++;
        ev.push({ k: 'pad', t: t0, d: len * 4, notes: v.pad, vel: arr === 'theme' || arr === 'groove' ? 0.045 : 0.08 });
      }
      // The piano comps in one of four ways.
      const roll = (t, d, vel) => v.upper.forEach((m, j) => ev.push({ k: 'piano', t: t + j * 0.05, d: d - j * 0.05, m, vel: vel * (1 - j * 0.06) }));
      if (comp === 'hold' && fresh) roll(t0, slow ? 7.6 : 3.8, 0.5);
      else if (comp === 'pulse') { roll(t0, 1.4, 0.48); roll(sw(t0 + (chance(0.5) ? 2.5 : 1.5)), 1.2, 0.36); }
      else if (comp === 'broken') {
        const pat = pick([[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 0], [0, 1, 2, 1, 3, 2]]);
        pat.forEach((j, k) => { if (k === 0 || !chance(0.15)) ev.push({ k: 'piano', t: sw(t0 + k * 0.5), d: 0.9, m: v.upper[j % v.upper.length], vel: k ? 0.3 : 0.4 }); });
      } else if (comp === 'sparse' && i % 2 === 0) roll(t0, 7.5, 0.34);
      // The bass.
      if (arr === 'theme') {
        ev.push({ k: 'bass', t: t0, d: chance(0.5) ? 2.4 : 3.6, m: v.bass, vel: 0.8 });
        if (chance(0.5)) ev.push({ k: 'bass', t: sw(t0 + 2.5), d: 1.2, m: v.bass + pick([7, 12, 0]), vel: 0.55 });
      } else if (arr === 'groove') {
        ev.push({ k: 'bass', t: t0, d: 1.6, m: v.bass, vel: 0.8 }, { k: 'bass', t: t0 + 2, d: 1.2, m: v.bass + pick([7, 0, 12]), vel: 0.6 });
        const next = voicing(chords[(i + 1) % 8]).bass;
        if (chance(0.6)) ev.push({ k: 'bass', t: sw(t0 + 3.5), d: 0.45, m: next + pick([-1, 1, 2, -2]), vel: 0.45 });
      } else if (fresh && chance(0.6)) ev.push({ k: 'bass', t: t0, d: slow ? 7.5 : 3.8, m: v.bass, vel: 0.6 });
      // A music box turns over now and then, high above the chord.
      if ((arr === 'drift' && chance(0.65)) || (arr === 'air' && chance(0.25))) {
        const at = pick([0, 1, 2]), n = 3 + Math.floor(rnd() * 3), step = pick([0.25, 0.5]);
        const tones = v.upper.map((m) => m + 24);
        for (let k = 0; k < n; k++) ev.push({ k: 'box', t: sw(t0 + at + k * step), m: Math.min(98, tones[k % tones.length] + 12 * Math.floor(k / tones.length)), vel: 0.6 - k * 0.07 });
      }
      // Soft percussion only in the gently swinging sections.
      if (arr === 'groove') {
        for (let k = 0; k < 4; k++) if (chance(0.85)) ev.push({ k: 'shaker', t: t0 + k + 0.5 + song.swing, vel: 0.03 + rnd() * 0.025 });
        if (i % 2 === 1 && chance(0.7)) ev.push({ k: 'tick', t: t0 + 3, vel: 0.04 });
      }
    });
    if (arr === 'theme' || arr === 'groove') melody(ev, chords, arr);
    else if (chance(0.7)) {
      // A few single bells, far apart.
      for (let i = 0; i < 8; i += 2) {
        if (!chance(0.6)) continue;
        const set = pcs(song.key, chords[i]);
        ev.push({ k: 'bell', t: i * 4 + pick([0, 1, 2, 2.5]), m: nearest(76 + Math.floor(rnd() * 8), set), vel: 0.6 });
      }
    }
    return { beats: 32, ev };
  }

  /** The bell melody: the piece's motif four times over the section, fitted to each chord, the last time as an answer that comes home. */
  function melody(ev, chords, arr) {
    const M = song.motif;
    for (let p = 0; p < 4; p++) {
      if (arr === 'groove' && p % 2 === 1 && chance(0.6)) continue;
      const answer = p === 3;
      let d = degOf(song.mel) + (p === 2 ? pick([2, -2, 1]) : 0);
      const steps = M.steps.map((s) => (answer ? -s : s));
      if (chance(0.25)) { const k = 1 + Math.floor(rnd() * (steps.length - 1)); steps[k] += pick([1, -1]); }
      const skip = chance(0.2) ? 1 + Math.floor(rnd() * (M.rh.length - 1)) : -1;
      let last = song.mel;
      M.rh.forEach(([bt, len], k) => {
        d += steps[k];
        let m = degPitch(d);
        while (m > 88) { m -= 12; d -= 7; }
        while (m < 70) { m += 12; d += 7; }
        const t = p * 8 + bt, ch = chords[Math.min(7, Math.floor(t / 4))], set = pcs(song.key, ch);
        // Strong beats and long notes land on a chord tone, and the answer ends on the chord's root or third.
        if (answer && k === M.rh.length - 1) { const r = (song.key + ch[0]) % 12; m = nearest(m, [r, (r + QUAL[ch[1]][1]) % 12]); }
        else if (t % 2 === 0 || len >= 2) m = nearest(m, set);
        last = m;
        if (k === skip) return;
        ev.push({ k: 'bell', t: sw(t), m, vel: (k === 0 ? 0.62 : 0.5) + rnd() * 0.12 });
      });
      song.mel = last;
    }
  }

  function play(e, at, spb) {
    if (e.k === 'piano') piano(at, e.m, e.vel, e.d * spb);
    else if (e.k === 'bell') bell(at, e.m, e.vel);
    else if (e.k === 'box') box(at, e.m, e.vel);
    else if (e.k === 'pad') pad(at, e.notes, e.d * spb, e.vel);
    else if (e.k === 'bass') bass(at, e.m, e.vel, e.d * spb);
    else perc(at, e.k, e.vel);
  }

  // ------------------------------------------------------------ playing, pausing, and the button

  /** Writes sections ahead of the clock, a whole section at a time. */
  function pump() {
    if (!ctx || !running) return;
    const now = ctx.currentTime;
    if (secEnd < now + 0.15) secEnd = now + 0.15;
    while (secEnd < now + 6) {
      const sec = makeSection(), spb = 60 / song.bpm;
      for (const e of sec.ev) play(e, secEnd + e.t * spb, spb);
      secEnd += sec.beats * spb;
    }
  }

  const wanted = () => started && !muted && !gameOpen && !document.hidden;

  /** Fades toward what the menu wants now. Once faded out, the audio clock sleeps, and it wakes where it left off. */
  function apply(fade) {
    if (!started) return;
    if (wanted()) {
      if (!ctx) build();
      clearTimeout(sleepTimer);
      if (ctx.state === 'suspended') ctx.resume();
      running = true;
      pump();
      if (!timer) timer = setInterval(pump, 1000);
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(LEVEL, now + fade);
    } else if (ctx) {
      const now = ctx.currentTime;
      running = false;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + fade);
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => { if (!wanted() && ctx.state === 'running') ctx.suspend(); }, fade * 1000 + 150);
    }
  }

  const begin = () => {
    if (started) return;
    started = true;
    apply(2.5);
  };
  // Clicks and key presses on the opening screen do not start the music. Its Continue button does.
  const intro = document.getElementById('intro');
  const onInput = () => { if (!intro || !intro.open) begin(); };
  addEventListener('pointerdown', onInput, { capture: true });
  addEventListener('keydown', onInput, { capture: true });
  addEventListener('intro-done', begin);
  document.addEventListener('visibilitychange', () => apply(document.hidden ? 0.5 : 1.8));

  // A game plays in the player frame. The music fades out when it opens and comes back when it closes.
  const player = document.getElementById('player');
  if (player) {
    gameOpen = !player.hidden;
    new MutationObserver(() => {
      const open = !player.hidden;
      if (open === gameOpen) return;
      gameOpen = open;
      apply(open ? 0.8 : 2);
    }).observe(player, { attributes: true, attributeFilter: ['hidden'] });
  }

  const btn = document.getElementById('music-btn');
  const sync = () => { if (btn) btn.setAttribute('aria-pressed', String(!muted)); };
  if (btn) {
    btn.addEventListener('click', () => {
      muted = !muted;
      write(muted ? '0' : '1');
      sync();
      started = true;
      apply(muted ? 0.6 : 2);
    });
  }
  sync();
})();
