// The audio context, master gain, mute flag, sound effects, and dialogue blips. Music lives in music.ts and score/.
import { attach, bendMusic, currentHarmony, duckMusic, fightCue, playTrack, setTrackIntensity, setTrackProgress, setTrackWarp, stopTrack } from './music';
import { BENDS, DUCKS, SFX_DEFS, SFX_LEVEL, STINGER_IDS, TUNED, retune, stingerVoices, tuningOf } from './score/sfxdefs';
import type { StingerId, Tuning, Vc } from './score/sfxdefs';
import { BLIP_LEVEL, FORMANT_Q, SERIES, newBlipState, planBlip } from './score/speech';
import type { BlipState, Source } from './score/speech';

export type TrackId = 'title' | 'plaza' | 'tower' | 'library' | 'gardens' | 'ship' | 'sea' | 'lighthouse' | 'reef' | 'current' | 'archive' | 'year' | 'factory' | 'storyteller' | 'chasm' | 'spire' | 'vault' | 'void' | 'choice' | 'battle' | 'miniboss' | 'boss' | 'keeper' | 'lightbound' | 'guardian' | 'seer' | 'despair' | 'escape' | 'end_restore' | 'end_accept' | 'end_escape' | 'credits';
export type AreaTint = 'brass' | 'sea' | 'year' | 'stone' | 'void';
export type SfxId = 'move' | 'confirm' | 'cancel' | 'buzz' | 'step' | 'door' | 'portal' | 'strip' | 'extract_memory' | 'extract_emotion' | 'extract_name' | 'absorb' | 'weave' | 'unmake' | 'hit' | 'hurt' | 'vorn_hit' | 'miss' | 'float' | 'slide' | 'overload' | 'fade' | 'unravel' | 'shell_get' | 'memory_get' | 'emotion_get' | 'name_get' | 'concept_get' | 'steady' | 'sense' | 'true_sight' | 'echo' | 'savor' | 'scent' | 'insight' | 'handshake' | 'silence' | 'devour' | 'void_touch' | 'gear' | 'bird' | 'storm' | 'paper' | 'typewriter' | 'crystal' | 'riddle' | 'state_up' | 'victory' | 'defeat' | 'cook' | 'heal' | 'rename' | 'quake';
export type BattleCue = 'start' | 'round' | 'strip' | 'extract_memory' | 'extract_emotion' | 'extract_name' | 'absorb' | 'weave' | 'unmake'
  | 'layer_off' | 'foe_down' | 'calm' | 'hurt' | 'miss' | 'heal' | 'overload' | 'faded' | 'steady' | 'phase' | 'reality_break' | 'vorn' | 'lb' | 'sense' | 'end';
export interface BattleCueOpts { layer?: 'shell' | 'memory' | 'emotion' | 'name'; emotion?: string; amount?: number; phase?: number; foes?: number; frac?: number; won?: boolean }
export type VoiceId = 'pilgrim' | 'lightbound' | 'vorn' | 'seer' | 'keeper' | 'watchman' | 'null' | 'guardian' | 'gear' | 'paper' | 'sea' | 'crystal' | 'year' | 'npc';

const MUTE_KEY = 'voidpilgrim.mute';
/** Effects start this many seconds after the call. Scheduling at the current time loses the first few milliseconds. */
const LEAD = 0.03;

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let blipBus: GainNode | null = null;
let muted = readMute();
let lastBlip = 0;
let blipsLive = 0;
let noise: AudioBuffer | null = null;
let pulseWave: PeriodicWave | null = null;
const sourceWaves = new Map<Source, PeriodicWave>();
const talkers = new Map<string, BlipState>();
const lastSfx = new Map<string, number>();
let lastSpeechDuck = 0;
let tuneCache: { at: number; t: Tuning } | null = null;

function readMute(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1';
  } catch { return false; }
}

function writeMute(m: boolean) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch { /* storage may be blocked */ }
}

function applyMute() {
  if (!master || !ac) return;
  try { master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.02); } catch { /* ignore */ }
}

function open(context: AudioContext, out: AudioNode): void {
  ac = context;
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.9;
  const comp = ac.createDynamicsCompressor();
  // A safety limiter. The levels are set low enough that it rarely moves.
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
  // Nothing below 30 Hz is wanted: small speakers waste power on it and the limiter reacts to it.
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.6;
  master.connect(hp); hp.connect(comp); comp.connect(out);
  sfxBus = ac.createGain(); sfxBus.gain.value = SFX_LEVEL; sfxBus.connect(master);
  blipBus = ac.createGain(); blipBus.gain.value = BLIP_LEVEL; blipBus.connect(master);
  attach(ac, master, () => muted);
}

/** Creates or resumes the audio context. Call it on the first key press. */
export function unlockAudio(): void {
  try {
    if (!ac) {
      const Ctor: typeof AudioContext | undefined = typeof AudioContext !== 'undefined' ? AudioContext : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const context = new Ctor();
      open(context, context.destination);
    }
    if (ac!.state === 'suspended') void ac!.resume().catch(() => { /* a later key press tries again */ });
  } catch { /* audio is optional */ }
}

/** Plays on a context and output node that someone else owns, unmuted. The launcher's soundtrack uses it in place of unlockAudio. */
export function useAudio(context: AudioContext, out: AudioNode): void {
  try {
    if (ac) return;
    muted = false;
    open(context, out);
  } catch { /* audio is optional */ }
}

export function setMuted(m: boolean): void {
  muted = !!m;
  writeMute(muted);
  applyMute();
}

export function isMuted(): boolean {
  return muted;
}

/**
 * Starts a track. The track playing now melts into it on its bar lines instead of fading: the voices change hands one at a time,
 * the tempo glides, and the harmony passes through notes both keys share. `fade` is a hint for the length of that change in seconds.
 */
export function playMusic(id: TrackId, opts?: { tint?: AreaTint; fade?: number }): void {
  try { playTrack(id, opts?.tint, opts?.fade); } catch { /* never throw */ }
}

/** The music dissolves into a held drone, and the next track grows out of it. `fade` is a hint for how long that takes. */
export function stopMusic(fade?: number): void {
  try { stopTrack(fade); } catch { /* never throw */ }
}

/** Tells the battle music what just happened. The fight remembers it and the music changes on the next beat or bar. */
export function battleCue(cue: BattleCue, opts?: BattleCueOpts): void {
  try { fightCue(cue, opts); } catch { /* never throw */ }
}

/** Danger from 0 to 1. Layers join the music as it rises. */
export function setIntensity(level: number): void {
  try { setTrackIntensity(level); } catch { /* never throw */ }
}

/** Reality breaking from 0 to 1: tuning slips, the tempo wobbles, and notes drop out. */
export function setWarp(level: number): void {
  try { setTrackWarp(level); } catch { /* never throw */ }
}

/** Story progress from 0 to 1. The Pilgrim's theme grows more complex as it rises. */
export function setProgress(p: number): void {
  try { setTrackProgress(p); } catch { /* never throw */ }
}

// ---------------------------------------------------------------- synth

function noiseBuffer(a: BaseAudioContext): AudioBuffer {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noise.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
  }
  return noise;
}

/** The key now sounding, read at most every 150 ms. With no music it is the Pilgrim's key. */
function tuning(): Tuning {
  const now = ac ? ac.currentTime : 0;
  if (!tuneCache || now - tuneCache.at > 0.15 || now < tuneCache.at) tuneCache = { at: now, t: tuningOf(currentHarmony()) };
  return tuneCache.t;
}

function sourceWave(a: BaseAudioContext, src: Source): PeriodicWave {
  let w = sourceWaves.get(src);
  if (!w) {
    w = a.createPeriodicWave(SERIES[src].re, SERIES[src].im, { disableNormalization: true });
    sourceWaves.set(src, w);
  }
  return w;
}

function pulse(a: BaseAudioContext): PeriodicWave {
  if (!pulseWave) {
    const H = 24, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let h = 1; h <= H; h++) re[h] = Math.sin(Math.PI * h * 0.25) / h;
    pulseWave = a.createPeriodicWave(re, im);
  }
  return pulseWave;
}

/** A path as automation values, gliding geometrically between its points. */
function curve(pts: number[], n = 40): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (pts.length === 1) { c[i] = pts[0]; continue; }
    const p = (i / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(p)), u = p - k;
    c[i] = pts[k] * Math.pow(pts[k + 1] / pts[k], u);
  }
  return c;
}

/** A letter's loudness over its length: a quick opening, then a rounded fall for a vowel, a sine swell for a hiss, or a sharp fall for a puff. */
function shapeCurve(shape: 'voice' | 'swell' | 'puff', peak: number, open: number): Float32Array {
  const n = 24, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    let e = shape === 'swell' ? Math.sin(Math.PI * u) : shape === 'puff' ? (1 - u) ** 2 : 1 - u ** 2.2;
    if (shape !== 'swell') e *= Math.min(1, u / Math.max(0.04, open));
    c[i] = peak * e;
  }
  c[n - 1] = 0;
  return c;
}

function ramp(p: AudioParam, pts: number[], t: number, dur: number) {
  if (pts.length === 1) p.setValueAtTime(pts[0], t);
  else p.setValueCurveAtTime(curve(pts), t, Math.max(0.005, dur));
}

function lfo(a: BaseAudioContext, t: number, end: number, rate: [number, number?], depth: number, into: AudioParam[]) {
  const l = a.createOscillator();
  l.frequency.setValueAtTime(rate[0], t);
  if (rate[1]) l.frequency.linearRampToValueAtTime(rate[1], end);
  const g = a.createGain();
  g.gain.value = depth;
  l.connect(g);
  for (const p of into) g.connect(p);
  l.start(t);
  l.stop(end + 0.05);
}

function playVoices(a: AudioContext, dest: AudioNode, vcs: Vc[], t0: number, pitch: number, pan: number) {
  for (const vc of vcs) {
    const t = t0 + (vc.at ?? 0), dur = vc.d, end = t + dur;
    const jit = vc.j ? 1 + (Math.random() * 2 - 1) * vc.j : 1;
    const mul = pitch * jit;
    const env = a.createGain();
    const att = Math.min(vc.a ?? 0.004, dur * 0.9);
    const peak = vc.v * (vc.wide ? 0.65 : 1);
    if (vc.shape) {
      // Speech letters open quickly and close on a rounded curve, so no letter clicks and the level holds through the sound.
      env.gain.setValueCurveAtTime(shapeCurve(vc.shape, peak, att / dur), t, Math.max(0.005, dur));
    } else {
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + att);
      if (vc.cut) {
        env.gain.setValueAtTime(peak, t + Math.max(att, vc.cut - 0.004));
        env.gain.linearRampToValueAtTime(0.0001, t + vc.cut);
      } else env.gain.exponentialRampToValueAtTime(0.0001, end);
    }
    if (pan && typeof a.createStereoPanner === 'function') {
      const p = a.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(dest);
      env.connect(p);
    } else env.connect(dest);
    let into: AudioNode = env;
    // A slow modulation on a very short voice would not finish a cycle, so it costs no nodes.
    if (vc.trem && dur * vc.trem[0] >= 1.2) {
      const tg = a.createGain();
      tg.gain.value = 1 - vc.trem[1] / 2;
      lfo(a, t, end, [vc.trem[0], vc.trem[2]], vc.trem[1] / 2, [tg.gain]);
      tg.connect(into);
      into = tg;
    }
    const path = vc.f.map((x) => x * mul);
    if (vc.w === 'noise') {
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = vc.q ?? 1;
      ramp(bp.frequency, path, t, dur);
      let head: AudioNode = bp;
      if (vc.hp) {
        const hp = a.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = vc.hp;
        bp.connect(hp);
        head = hp;
      }
      head.connect(into);
      const s = a.createBufferSource();
      s.buffer = noiseBuffer(a);
      s.loop = true;
      s.connect(bp);
      s.start(t, Math.random() * 1.5);
      s.stop(end + 0.05);
      continue;
    }
    if (vc.lp) {
      const lp = a.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = vc.lp[1];
      ramp(lp.frequency, vc.lp[0], t, dur);
      lp.connect(into);
      into = lp;
    }
    // A vocal voice runs its source through two band-passes, one for each formant of the vowel.
    if (vc.form) {
      const head = a.createGain();
      for (let i = 0; i < 2; i++) {
        const bp = a.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = vc.form[i];
        bp.Q.value = FORMANT_Q[i];
        head.connect(bp);
        bp.connect(into);
      }
      if (vc.air) {
        const ns = a.createBufferSource(), ng = a.createGain();
        ns.buffer = noiseBuffer(a);
        ns.loop = true;
        ng.gain.value = 0.5 * vc.air;
        ns.connect(ng);
        ng.connect(head);
        ns.start(t, Math.random() * 1.5);
        ns.stop(end + 0.05);
      }
      into = head;
    }
    const pitchCurve = curve(path);
    const oscs = (vc.wide ? [0, vc.wide] : [0]).map((dt) => {
      const o = a.createOscillator();
      if (vc.w === 'pulse') o.setPeriodicWave(pulse(a));
      else if (vc.w === 'breathy' || vc.w === 'buzzy' || vc.w === 'reedy') o.setPeriodicWave(sourceWave(a, vc.w));
      else o.type = vc.w === 'saw' ? 'sawtooth' : (vc.w as OscillatorType);
      if (path.length === 1) o.frequency.setValueAtTime(path[0], t);
      else o.frequency.setValueCurveAtTime(pitchCurve, t, Math.max(0.005, dur));
      o.detune.value = dt;
      o.connect(into);
      o.start(t);
      o.stop(end + 0.05);
      return o;
    });
    if (vc.vib && dur * vc.vib[0] >= 1.2) lfo(a, t, end, [vc.vib[0], vc.vib[2]], vc.vib[1], oscs.map((o) => o.detune));
    if (vc.fm) {
      const [ratio, i0, i1 = i0] = vc.fm;
      const m = a.createOscillator(), mg = a.createGain();
      if (path.length > 1) m.frequency.setValueCurveAtTime(pitchCurve.map((x) => x * ratio), t, Math.max(0.005, dur));
      else m.frequency.setValueAtTime(path[0] * ratio, t);
      mg.gain.setValueCurveAtTime(pitchCurve.map((x, i) => x * (i0 + ((i1 - i0) * i) / (pitchCurve.length - 1))), t, Math.max(0.005, dur));
      m.connect(mg);
      for (const o of oscs) mg.connect(o.frequency);
      m.start(t);
      m.stop(end + 0.05);
    }
  }
}

/** One sound effect. Safe to call before audio is unlocked and while muted. */
export function sfx(id: SfxId, opts?: { pitch?: number; pan?: number }): void {
  try {
    if (!ac || !sfxBus || muted || ac.state !== 'running') return;
    const now = ac.currentTime;
    // The same effect twice within 30 ms would double its level, so the second is dropped.
    if (now - (lastSfx.get(id) ?? -1) < 0.03) return;
    lastSfx.set(id, now);
    let def = SFX_DEFS[id];
    if (!def) return;
    if ((STINGER_IDS as readonly string[]).includes(id)) def = stingerVoices(id as StingerId, tuning());
    else if (TUNED.has(id)) def = retune(def, tuning());
    const pitch = Math.max(0.25, Math.min(4, opts?.pitch ?? 1));
    playVoices(ac, sfxBus, def, now + LEAD, pitch, opts?.pan ?? 0);
    // Important effects make room in the music, and a few bend it, so the world seems to feel what the Pilgrim does.
    const d = DUCKS[id];
    if (d) duckMusic(d[0], d[1], d[2]);
    const b = BENDS[id];
    if (b) bendMusic(b[0], b[1], b[2], b[3]);
  } catch { /* never throw */ }
}

/**
 * One dialogue character. Spaces and punctuation make no sound. Each speaker's letters group into words that sing one note of the
 * music's scale, the pitch bounces from word to word, and the music dips a little while someone talks. Letters that arrive less
 * than 25 ms apart are skipped.
 */
export function blip(voice: VoiceId, ch: string, seed = 0, mood = 0): void {
  try {
    if (!ac || !blipBus || muted || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (now - lastBlip < 0.025 || blipsLive > 4) return;
    let st = talkers.get(voice);
    if (!st) talkers.set(voice, (st = newBlipState()));
    const vcs = planBlip(st, now, voice, ch, seed, mood, tuning());
    if (!vcs) return;
    lastBlip = now;
    blipsLive++;
    setTimeout(() => { blipsLive = Math.max(0, blipsLive - 1); }, 160);
    playVoices(ac, blipBus, vcs, now + LEAD, 1, 0);
    if (now - lastSpeechDuck > 0.12) { lastSpeechDuck = now; duckMusic(0.8, 0.22, 0.5); }
  } catch { /* never throw */ }
}
