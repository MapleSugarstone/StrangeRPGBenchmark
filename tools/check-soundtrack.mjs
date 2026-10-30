// Runs a game's soundtrack script against a recording stand-in for Web Audio and reports each track. See the README, under Soundtracks.
// Usage: node tools/check-soundtrack.mjs <path to soundtrack.js> [seconds per track] [track id ...]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const [file, secArg, ...only] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node tools/check-soundtrack.mjs <path to soundtrack.js> [seconds per track] [track id ...]');
  process.exit(2);
}
const SECONDS = Number(secArg) || 20;
const STEP = 0.01;
const code = fs.readFileSync(file, 'utf8');

function makeWorld() {
  const report = { errors: [], ownContexts: 0, sources: [], toDestination: 0, unsupported: new Set() };
  let now = 0;
  const timers = [];
  let nextId = 1;
  const addTimer = (fn, ms, repeat) => {
    const id = nextId++;
    if (typeof fn === 'function') timers.push({ id, at: now + Math.max(0, Number(ms) || 0) / 1000, every: repeat ? Math.max(0.001, (Number(ms) || 0) / 1000) : 0, fn });
    return id;
  };
  const clearTimer = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };

  class Param {
    constructor(value) { this.value = value; this.defaultValue = value; this.minValue = -3.4e38; this.maxValue = 3.4e38; }
    check(t, v, name) { if (!Number.isFinite(t) || (v !== undefined && !Number.isFinite(v))) throw new TypeError(`${name} got a non-finite number`); }
    setValueAtTime(v, t) { this.check(t, v, 'setValueAtTime'); this.value = v; return this; }
    linearRampToValueAtTime(v, t) { this.check(t, v, 'linearRampToValueAtTime'); this.value = v; return this; }
    exponentialRampToValueAtTime(v, t) {
      this.check(t, v, 'exponentialRampToValueAtTime');
      if (v === 0 || Math.sign(v) !== Math.sign(this.value || v)) throw new RangeError('exponentialRampToValueAtTime needs a non-zero value of the same sign');
      this.value = v; return this;
    }
    setTargetAtTime(v, t, c) { this.check(t, v, 'setTargetAtTime'); if (!(c >= 0)) throw new RangeError('setTargetAtTime needs a time constant of 0 or more'); this.value = v; return this; }
    setValueCurveAtTime(curve, t, d) { this.check(t, d, 'setValueCurveAtTime'); if (!curve || curve.length < 2) throw new TypeError('setValueCurveAtTime needs 2 values or more'); return this; }
    cancelScheduledValues(t) { this.check(t, undefined, 'cancelScheduledValues'); return this; }
    cancelAndHoldAtTime(t) { this.check(t, undefined, 'cancelAndHoldAtTime'); return this; }
  }

  class Node {
    constructor(ctx, kind, params = {}, props = {}) {
      this.context = ctx; this.kind = kind; this.outs = new Set();
      this.numberOfInputs = 1; this.numberOfOutputs = 1; this.channelCount = 2; this.channelCountMode = 'max'; this.channelInterpretation = 'speakers';
      for (const [k, v] of Object.entries(params)) this[k] = new Param(v);
      Object.assign(this, props);
    }
    connect(target) {
      if (target instanceof Param) { this.modulates = true; return undefined; }
      if (!(target instanceof Node)) throw new TypeError(`${this.kind}.connect got something that is not an AudioNode`);
      if (target.context !== this.context) throw new Error(`${this.kind}.connect crossed two audio contexts`);
      this.outs.add(target);
      if (target === this.context.destination) report.toDestination++;
      return target;
    }
    disconnect() {}
    addEventListener() {}
    removeEventListener() {}
  }

  class Source extends Node {
    start(t = 0) {
      if (this.started) throw new Error(`${this.kind}.start called twice`);
      if (!Number.isFinite(t)) throw new TypeError(`${this.kind}.start got a non-finite time`);
      this.started = true;
      report.sources.push({ node: this, at: Math.max(t, this.context.currentTime) });
    }
    stop(t = 0) {
      if (!this.started) throw new Error(`${this.kind}.stop called before start`);
      if (!Number.isFinite(t)) throw new TypeError(`${this.kind}.stop got a non-finite time`);
      if (typeof this.onended === 'function') addTimer(() => this.onended({ target: this }), Math.max(0, t - now) * 1000 + 10);
    }
  }

  class Buffer {
    constructor(channels, length, sampleRate) {
      if (!(channels >= 1) || !(length >= 1) || !(sampleRate >= 3000)) throw new RangeError('createBuffer got a bad size');
      this.numberOfChannels = channels; this.length = Math.floor(length); this.sampleRate = sampleRate; this.duration = length / sampleRate;
      this.data = Array.from({ length: channels }, () => new Float32Array(this.length));
    }
    getChannelData(c) { return this.data[c]; }
    copyToChannel(src, c) { this.data[c].set(src.subarray(0, this.length)); }
    copyFromChannel(dst, c) { dst.set(this.data[c].subarray(0, dst.length)); }
  }

  class Ctx {
    constructor(offline) {
      this.sampleRate = 48000; this.state = 'running'; this.baseLatency = 0.01; this.offline = !!offline;
      this.destination = new Node(this, 'destination', {}, { maxChannelCount: 2 });
      this.listener = { positionX: new Param(0), positionY: new Param(0), positionZ: new Param(0) };
      this.onstatechange = null;
    }
    get currentTime() { return now; }
    createGain() { return new Node(this, 'gain', { gain: 1 }); }
    createOscillator() { return new Source(this, 'oscillator', { frequency: 440, detune: 0 }, { type: 'sine', setPeriodicWave() { this.type = 'custom'; } }); }
    createBufferSource() { return new Source(this, 'bufferSource', { playbackRate: 1, detune: 0 }, { buffer: null, loop: false, loopStart: 0, loopEnd: 0 }); }
    createConstantSource() { return new Source(this, 'constantSource', { offset: 1 }); }
    createBiquadFilter() { return new Node(this, 'biquad', { frequency: 350, Q: 1, gain: 0, detune: 0 }, { type: 'lowpass', getFrequencyResponse() {} }); }
    createDelay(max = 1) { return new Node(this, 'delay', { delayTime: 0 }, { maxDelayTime: max }); }
    createDynamicsCompressor() { return new Node(this, 'compressor', { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }, { reduction: 0 }); }
    createStereoPanner() { return new Node(this, 'stereoPanner', { pan: 0 }); }
    createPanner() { return new Node(this, 'panner', { positionX: 0, positionY: 0, positionZ: 0, orientationX: 1, orientationY: 0, orientationZ: 0 }, { setPosition() {}, setOrientation() {} }); }
    createConvolver() { return new Node(this, 'convolver', {}, { buffer: null, normalize: true }); }
    createWaveShaper() { return new Node(this, 'waveShaper', {}, { curve: null, oversample: 'none' }); }
    createAnalyser() {
      return new Node(this, 'analyser', {}, { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0.8, minDecibels: -100, maxDecibels: -30,
        getByteFrequencyData() {}, getFloatFrequencyData() {}, getByteTimeDomainData() {}, getFloatTimeDomainData() {} });
    }
    createChannelMerger(n = 6) { return new Node(this, 'merger', {}, { numberOfInputs: n }); }
    createChannelSplitter(n = 6) { return new Node(this, 'splitter', {}, { numberOfOutputs: n }); }
    createIIRFilter() { return new Node(this, 'iir', {}, { getFrequencyResponse() {} }); }
    createBuffer(ch, len, sr) { return new Buffer(ch, len, sr); }
    createPeriodicWave(real, imag) { if (!real || !imag || real.length !== imag.length || real.length < 2) throw new TypeError('createPeriodicWave needs two arrays of the same length'); return { periodic: true }; }
    decodeAudioData() { return Promise.reject(new Error('the checker cannot decode audio files')); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { report.errors.push('the script closed the menu\'s audio context'); return Promise.resolve(); }
    addEventListener() {}
    removeEventListener() {}
    startRendering() { return Promise.resolve(new Buffer(2, Math.max(1, this.length || 1), this.sampleRate)); }
  }

  const ctx = new Ctx(false);
  const out = ctx.createGain();
  function OwnContext() { report.ownContexts++; return new Ctx(false); }
  function Offline(ch, len, sr) {
    const c = new Ctx(true);
    if (typeof ch === 'object') ({ numberOfChannels: ch, length: len, sampleRate: sr } = ch);
    c.length = len; c.sampleRate = sr || 48000;
    return c;
  }
  const nodeCtor = (make) => function (c, opts = {}) {
    const n = make(c);
    for (const [k, v] of Object.entries(opts)) { if (n[k] instanceof Param) n[k].value = v; else n[k] = v; }
    return n;
  };

  const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } }; };
  const element = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, getAttribute: () => null, appendChild(c) { return c; }, append() {}, remove() {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, querySelector: () => null, querySelectorAll: () => [] });
  const noop = () => {};
  const sandbox = {
    console, URL, URLSearchParams, TextEncoder, TextDecoder, queueMicrotask, structuredClone,
    setTimeout: (fn, ms) => addTimer(fn, ms, false), clearTimeout: clearTimer,
    setInterval: (fn, ms) => addTimer(fn, ms, true), clearInterval: clearTimer,
    requestAnimationFrame: (fn) => addTimer(() => fn(now * 1000), 16, false), cancelAnimationFrame: clearTimer,
    performance: { now: () => now * 1000 },
    AudioContext: OwnContext, webkitAudioContext: OwnContext, OfflineAudioContext: Offline, webkitOfflineAudioContext: Offline,
    AudioBuffer: function (o) { return new Buffer(o.numberOfChannels || 1, o.length, o.sampleRate); },
    GainNode: nodeCtor((c) => c.createGain()), OscillatorNode: nodeCtor((c) => c.createOscillator()), AudioBufferSourceNode: nodeCtor((c) => c.createBufferSource()),
    BiquadFilterNode: nodeCtor((c) => c.createBiquadFilter()), DelayNode: nodeCtor((c) => c.createDelay()), StereoPannerNode: nodeCtor((c) => c.createStereoPanner()),
    ConvolverNode: nodeCtor((c) => c.createConvolver()), WaveShaperNode: nodeCtor((c) => c.createWaveShaper()), ConstantSourceNode: nodeCtor((c) => c.createConstantSource()),
    DynamicsCompressorNode: nodeCtor((c) => c.createDynamicsCompressor()), PeriodicWave: function (c, o) { return c.createPeriodicWave(o.real, o.imag); },
    localStorage: storage(), sessionStorage: storage(),
    navigator: { userAgent: 'soundtrack-check', getGamepads: () => [] },
    location: { href: 'http://localhost/games/x/', search: '', hash: '', pathname: '/games/x/', origin: 'http://localhost' },
    document: { hidden: false, visibilityState: 'visible', readyState: 'complete', body: element(), head: element(), documentElement: element(), createElement: element, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop, hasFocus: () => true },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
    fetch: () => Promise.reject(new Error('the checker has no network')),
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  async function advance(seconds) {
    const end = now + seconds;
    while (now < end - 1e-9) {
      now = Math.min(end, now + STEP);
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const t = timers[0];
        if (!t || t.at > now + 1e-9) break;
        if (t.every) t.at += t.every; else timers.shift();
        try { t.fn(); } catch (err) { report.errors.push(`timer: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`); }
      }
      await new Promise((r) => setImmediate(r));
    }
  }

  return { sandbox, ctx, out, report, advance, time: () => now };
}

/** Whether a started source reaches `out` through the graph. */
function reaches(node, target, seen = new Set()) {
  if (node === target) return true;
  if (seen.has(node)) return false;
  seen.add(node);
  for (const n of node.outs) if (reaches(n, target, seen)) return true;
  return false;
}

const short = (err) => (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
let failed = 0;

const probe = makeWorld();
try { vm.runInContext(code, probe.sandbox, { filename: path.basename(file) }); } catch (err) { console.error(`The script threw while loading: ${short(err)}`); process.exit(1); }
const api = probe.sandbox.soundtrack;
if (!api || !Array.isArray(api.tracks) || typeof api.start !== 'function') { console.error('The script did not set window.soundtrack with tracks and start.'); process.exit(1); }
const tracks = JSON.parse(JSON.stringify(api.tracks));
const ids = new Set();
for (const t of tracks) {
  const problems = [];
  if (typeof t.id !== 'string' || typeof t.title !== 'string') problems.push('needs a string id and title');
  if (ids.has(t.id)) problems.push('repeats an id');
  ids.add(t.id);
  if (t.length !== undefined && !(t.length > 0)) problems.push('has a length that is not a positive number');
  if (t.once && !(t.length > 0)) problems.push('is once but has no length');
  for (const c of t.changes || []) {
    if (typeof c.id !== 'string' || typeof c.label !== 'string') problems.push('has a change without a string id and label');
    if (c.steps && (!Array.isArray(c.steps) || !c.steps.length)) problems.push(`change ${c.id} has empty steps`);
  }
  if ((t.changes || []).length && typeof api.change !== 'function') problems.push('has changes but the script has no change function');
  if (problems.length) { failed++; console.log(`BAD   ${t.id}: ${problems.join(', ')}`); }
}
console.log(`${tracks.length} tracks, ${SECONDS} s each\n`);

for (const [i, t] of tracks.entries()) {
  if (only.length && !only.includes(t.id)) continue;
  const w = makeWorld();
  const issues = [];
  try {
    vm.runInContext(code, w.sandbox, { filename: path.basename(file) });
    const run = w.sandbox.soundtrack;
    await Promise.resolve(run.start(t.id, w.ctx, w.out));
    const changes = t.changes || [];
    const slice = SECONDS / (changes.length + 1);
    await w.advance(slice);
    for (const c of changes) {
      const values = c.toggle ? [!c.value, !!c.value] : c.steps ? c.steps.map((_, k) => k).reverse() : [undefined];
      for (const v of values) {
        try { run.change(c.id, v); } catch (err) { issues.push(`change ${c.id}(${v}) threw: ${short(err)}`); }
        await w.advance(slice / values.length);
      }
    }
  } catch (err) {
    issues.push(`start threw: ${short(err)}`);
  }
  const r = w.report;
  const heard = r.sources.filter((s) => reaches(s.node, w.out));
  const first = heard.length ? Math.min(...heard.map((s) => s.at)) : null;
  issues.push(...r.errors);
  if (r.ownContexts) issues.push(`made ${r.ownContexts} AudioContext(s) of its own`);
  if (r.toDestination) issues.push(`connected to ctx.destination ${r.toDestination} time(s)`);
  if (!heard.length) issues.push('no source reached out');
  else if (first > 3) issues.push(`first sound only at ${first.toFixed(2)} s`);
  const lost = r.sources.filter((s) => !s.node.modulates).length - heard.filter((s) => !s.node.modulates).length;
  const kind = t.once ? 'once' : t.length ? `loop ${t.length.toFixed(2)} s` : 'generated';
  console.log(`${issues.length ? 'FAIL' : 'ok  '}  ${String(i + 1).padStart(2, '0')} ${t.title}  (${t.id}, ${kind})  ${heard.length} sources, ${(heard.length / SECONDS).toFixed(1)}/s${first != null ? `, first at ${first.toFixed(2)} s` : ''}${lost ? `, ${lost} not reaching out` : ''}${(t.changes || []).length ? `, changes: ${t.changes.map((c) => c.id).join(' ')}` : ''}`);
  for (const msg of issues) console.log(`        ${msg}`);
  if (issues.length) failed++;
}
console.log(failed ? `\n${failed} problem(s)` : '\nAll tracks passed');
process.exit(failed ? 1 : 0);
