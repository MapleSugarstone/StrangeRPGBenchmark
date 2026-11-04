// One AudioContext, one master gain, and one mute state for music and sound effects.
// The module imports safely without a page, and the context starts silent until the browser allows sound.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let muted = false;
let armed = false;
const readyFns: (() => void)[] = [];

export const MUSIC_LEVEL = 0.8;
export const SFX_LEVEL = 1;

function create(): void {
  if (ctx || typeof window === "undefined") return;
  const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
    // A fast limiter at the end keeps a loud chord or a stacked sound effect from clipping.
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -4;
    limit.knee.value = 2;
    limit.ratio.value = 12;
    limit.attack.value = 0.003;
    limit.release.value = 0.12;
    limit.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(limit);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_LEVEL;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_LEVEL;
    sfxBus.connect(master);
  } catch {
    ctx = null;
    master = musicBus = sfxBus = null;
    return;
  }
  for (const fn of readyFns) {
    try { fn(); } catch { /* one listener must not stop the others */ }
  }
}

/** Creates or resumes the context. Call it only from a key press, click, or touch. */
export function wakeAudio(): void {
  create();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => undefined);
}

/** Listens for the first gesture, which creates the context. Safe to call more than once. */
export function armAudio(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  for (const type of ["keydown", "pointerdown", "touchstart"]) window.addEventListener(type, wakeAudio, { passive: true });
}

/** True while a user gesture is being handled, so a context made now may start playing. */
export function inGesture(): boolean {
  try {
    const ua = (typeof navigator !== "undefined" ? (navigator as any).userActivation : undefined) as { isActive?: boolean } | undefined;
    return !!ua?.isActive;
  } catch {
    return false;
  }
}

export function audioContext(): AudioContext | null {
  return ctx;
}

/** The bus music plays into. The music engine treats it as its master. */
export function audioMaster(): GainNode | null {
  return musicBus;
}

export function sfxOut(): GainNode | null {
  return sfxBus;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = !!m;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Runs fn once the context exists, at once if it already does. */
export function onAudioReady(fn: () => void): void {
  readyFns.push(fn);
  if (ctx) fn();
}
