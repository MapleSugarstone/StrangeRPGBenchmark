// Bridges the engine to the game's Sound global. Music shares Sound.ctx and plays into its own quiet bus on Sound.master,
// next to the effects bus, so muting the master stops both. It also stays silent while its own mute flag is set.
// Safe to load in Node, where nothing here runs.

interface SoundGlobal { ctx: AudioContext | null; muted: boolean; bus: AudioNode | null; master?: AudioNode | null }
declare const Sound: SoundGlobal | undefined;

/** Gain of the music bus. Measured so the loudest track peaks near 0.06 at the master, under the effects. */
export const MUSIC_LEVEL = 0.17;

let ctx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let muted = false;
let applied = false;
const readyFns: (() => void)[] = [];

function sound(): SoundGlobal | null {
  return typeof Sound !== 'undefined' && Sound ? Sound : null;
}

function attach(): void {
  if (ctx) return;
  const s = sound();
  if (!s || !s.ctx) return;
  try {
    const c = s.ctx;
    const g = c.createGain();
    applied = isMuted();
    g.gain.value = applied ? 0 : MUSIC_LEVEL;
    g.connect(s.master ?? s.bus ?? c.destination);
    ctx = c;
    musicBus = g;
  } catch {
    return;
  }
  for (const fn of readyFns) fn();
}

function sync(): void {
  attach();
  if (!ctx || !musicBus) return;
  const m = isMuted();
  if (m === applied) return;
  applied = m;
  try { musicBus.gain.setTargetAtTime(m ? 0 : MUSIC_LEVEL, ctx.currentTime, 0.05); } catch { /* ignore */ }
}

if (typeof window !== 'undefined') {
  // Sound creates its context on the first key press, and the game may set Sound.muted directly, so both are polled.
  setInterval(sync, 100);
  const soon = () => { setTimeout(sync, 0); };
  window.addEventListener('keydown', soon);
  window.addEventListener('pointerdown', soon);
}

export function audioContext(): AudioContext | null {
  return ctx;
}

/** The bus music plays into. The engine treats it as its master. */
export function audioMaster(): GainNode | null {
  return musicBus;
}

export function isMuted(): boolean {
  return muted || !!sound()?.muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  sync();
}

export function onAudioReady(fn: () => void): void {
  readyFns.push(fn);
  if (ctx) fn();
}
