// One AudioContext and three volume buses (music, effects, voices) under one master limiter.
// Nothing touches Web Audio until initAudio() or the first key or pointer press, and the module imports safely in Node.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buses: { music: GainNode; sfx: GainNode; voice: GainNode } | null = null;
let muted = false;
let failed = false;
const vols = { music: 8, sfx: 8, voice: 7 };
const readyFns: Array<() => void> = [];

/** Bus gain at volume 10. These sit about 30 percent above the levels the earlier games shipped with. */
const TOP = { music: 0.95, sfx: 1.0, voice: 0.8 };

/** Maps a 0..10 slider to a bus gain on a gentle curve, so the low settings still change something you can hear. */
export function volumeGain(v: number, top: number): number {
  const x = Math.max(0, Math.min(10, Number.isFinite(v) ? v : 0)) / 10;
  return x <= 0 ? 0 : top * Math.pow(x, 1.6);
}

function hasAudio(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  return typeof w.AudioContext === 'function' || typeof w.webkitAudioContext === 'function';
}

function create(): void {
  if (ctx || failed || !hasAudio()) return;
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) { failed = true; return; }
    const ac = new Ctor({ latencyHint: 'interactive' });
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -1.5; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.002; lim.release.value = 0.12;
    lim.connect(ac.destination);
    const m = ac.createGain();
    m.gain.value = muted ? 0 : 1;
    m.connect(lim);
    const mk = (g: number) => { const n = ac.createGain(); n.gain.value = g; n.connect(m); return n; };
    buses = {
      music: mk(volumeGain(vols.music, TOP.music)),
      sfx: mk(volumeGain(vols.sfx, TOP.sfx)),
      voice: mk(volumeGain(vols.voice, TOP.voice)),
    };
    ctx = ac;
    master = m;
    for (const fn of readyFns) { try { fn(); } catch { /* one listener must not stop the rest */ } }
  } catch {
    ctx = null;
    failed = true;
  }
}

/** Creates or resumes the context. Call it from the first user gesture. Calling it again is harmless. */
export function initAudio(): void {
  try {
    create();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  } catch { /* never throw */ }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const wake = () => initAudio();
  try {
    window.addEventListener('pointerdown', wake, { capture: true });
    window.addEventListener('keydown', wake, { capture: true });
    window.addEventListener('touchstart', wake, { capture: true });
  } catch { /* old engines */ }
}

export function audioCtx(): AudioContext | null {
  return ctx;
}

export function musicOut(): GainNode | null {
  return buses?.music ?? null;
}

export function sfxOut(): GainNode | null {
  return buses?.sfx ?? null;
}

export function voiceOut(): GainNode | null {
  return buses?.voice ?? null;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = !!m;
  try { if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05); } catch { /* ignore */ }
}

/** Each volume runs 0..10. Values outside that range are clamped. */
export function setVolumes(music: number, sfx: number, voice: number): void {
  const fix = (v: number, was: number) => (Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : was);
  vols.music = fix(music, vols.music);
  vols.sfx = fix(sfx, vols.sfx);
  vols.voice = fix(voice, vols.voice);
  if (!ctx || !buses) return;
  try {
    const now = ctx.currentTime;
    buses.music.gain.setTargetAtTime(volumeGain(vols.music, TOP.music), now, 0.05);
    buses.sfx.gain.setTargetAtTime(volumeGain(vols.sfx, TOP.sfx), now, 0.05);
    buses.voice.gain.setTargetAtTime(volumeGain(vols.voice, TOP.voice), now, 0.05);
  } catch { /* ignore */ }
}

export function volumes(): { music: number; sfx: number; voice: number } {
  return { ...vols };
}

/** Runs `fn` once the context exists, at once if it already does. */
export function onAudioReady(fn: () => void): void {
  readyFns.push(fn);
  if (ctx) { try { fn(); } catch { /* ignore */ } }
}

/** Logs a message once per key, so a bad name in a script does not flood the console. */
const logged = new Set<string>();
export function logOnce(keyName: string, msg: string): void {
  if (logged.has(keyName)) return;
  logged.add(keyName);
  try { console.warn(msg); } catch { /* no console */ }
}
