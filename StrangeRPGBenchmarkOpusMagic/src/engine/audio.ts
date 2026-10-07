// Small square-wave synth. Every verb plays its own pitch, so a spell sounds like its code.
// Music (src/engine/music.ts) shares this context, this master gain, and this mute state.
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let drone: { osc: OscillatorNode[]; gain: GainNode } | null = null;
const readyHooks: Array<() => void> = [];
let droneHook: ((notes: number[] | null) => void) | null = null;

const MASTER = 0.18;

try { muted = localStorage.getItem('rote-opus-magic-mute') === '1'; } catch { /* storage may be blocked */ }

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') void ac.resume().catch(() => undefined); return; }
  try {
    const w = typeof window !== 'undefined' ? (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }) : null;
    const Ctor = w ? (w.AudioContext ?? w.webkitAudioContext) : undefined;
    if (!Ctor) return;
    ac = new Ctor();
    master = ac.createGain();
    master.gain.value = muted ? 0 : MASTER;
    master.connect(ac.destination);
  } catch { ac = null; master = null; return; }
  for (const fn of readyHooks) { try { fn(); } catch { /* a hook must not stop the others */ } }
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  if (ac && master) {
    try {
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : MASTER, ac.currentTime, 0.02);
    } catch { master.gain.value = muted ? 0 : MASTER; }
  }
  try { localStorage.setItem('rote-opus-magic-mute', muted ? '1' : '0'); } catch { /* ignore */ }
}

/** The shared context, or null before the first user gesture and in Node. */
export function audioContext(): AudioContext | null { return ac; }

/** The shared master gain that mute acts on. */
export function audioMaster(): GainNode | null { return master; }

/** Runs fn once the context exists, now if it already does. */
export function onAudioReady(fn: () => void) {
  readyHooks.push(fn);
  if (ac) { try { fn(); } catch { /* ignore */ } }
}

/** Lets the music engine take over setDrone. */
export function setDroneHook(fn: ((notes: number[] | null) => void) | null) {
  droneHook = fn;
  if (fn) stopDrone();
}

function freqOf(semi: number) { return 220 * Math.pow(2, semi / 12); }

export function tone(semi: number, dur = 0.08, type: OscillatorType = 'square', vol = 0.5, delay = 0) {
  if (!ac || !master) return;
  try {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freqOf(semi), t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* never throw from sound */ }
}

let noiseBuf: AudioBuffer | null = null;

export function noise(dur = 0.1, vol = 0.3, delay = 0) {
  if (!ac || !master) return;
  try {
    const t = ac.currentTime + delay;
    if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
      const len = Math.floor(ac.sampleRate * 0.5);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource();
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.buffer = noiseBuf;
    s.loop = true;
    s.connect(g);
    g.connect(master);
    s.onended = () => { s.disconnect(); g.disconnect(); };
    s.start(t);
    s.stop(t + dur + 0.01);
  } catch { /* never throw from sound */ }
}

export const sfx = {
  move: () => tone(19, 0.03, 'square', 0.15),
  ok: () => { tone(12, 0.05, 'square', 0.25); tone(19, 0.06, 'square', 0.2, 0.04); },
  back: () => { tone(7, 0.05, 'square', 0.2); tone(0, 0.06, 'square', 0.2, 0.04); },
  error: () => { tone(-6, 0.09, 'sawtooth', 0.25); tone(-7, 0.12, 'sawtooth', 0.25, 0.08); },
  type: () => tone(24 + Math.floor(Math.random() * 3), 0.015, 'square', 0.08),
  text: () => tone(17, 0.012, 'triangle', 0.12),
  line: (semi: number) => tone(semi + 12, 0.07, 'square', 0.22),
  mute: () => tone(-12, 0.04, 'triangle', 0.15),
  hit: () => noise(0.08, 0.35),
  heal: () => { tone(12, 0.06, 'triangle', 0.3); tone(16, 0.06, 'triangle', 0.3, 0.05); tone(19, 0.1, 'triangle', 0.3, 0.1); },
  fall: () => { for (let i = 0; i < 5; i++) tone(7 - i * 4, 0.08, 'square', 0.25, i * 0.06); },
  again: () => { tone(24, 0.25, 'sawtooth', 0.15); tone(24.3, 0.25, 'sawtooth', 0.15); },
  step: () => tone(-20, 0.02, 'triangle', 0.08),
  win: () => [0, 4, 7, 12].forEach((s, i) => tone(s + 12, 0.12, 'square', 0.25, i * 0.09)),
  lose: () => [7, 3, 0, -5].forEach((s, i) => tone(s, 0.2, 'triangle', 0.3, i * 0.15)),
  door: () => { noise(0.15, 0.2); tone(-12, 0.2, 'triangle', 0.3); },
  get: () => [7, 12, 16, 19, 24].forEach((s, i) => tone(s, 0.07, 'square', 0.2, i * 0.05)),
};

function stopDrone() {
  if (!drone || !ac) { drone = null; return; }
  const old = drone;
  drone = null;
  try {
    old.gain.gain.cancelScheduledValues(ac.currentTime);
    old.gain.gain.setValueAtTime(old.gain.gain.value, ac.currentTime);
    old.gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
    old.osc.forEach((o) => o.stop(ac!.currentTime + 1));
  } catch { /* ignore */ }
}

/** A low two-note hum that changes with the region. Once the music engine loads, it picks the region's track instead. */
export function setDrone(notes: number[] | null) {
  if (droneHook) { try { droneHook(notes); } catch { /* ignore */ } return; }
  if (!ac || !master) return;
  stopDrone();
  if (!notes || !notes.length) return;
  try {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.07, ac.currentTime + 1.5);
    g.connect(master);
    const osc = notes.map((n, i) => {
      const o = ac!.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = freqOf(n - 12);
      o.detune.value = i * 4;
      o.connect(g);
      o.start();
      return o;
    });
    drone = { osc, gain: g };
  } catch { drone = null; }
}
