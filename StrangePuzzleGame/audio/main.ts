// The game's Music global over the engine in music.ts. tools/build-music.mjs bundles this file into src/music.js.
import { MUSIC_LEVEL, setMuted } from './audio.ts';
import { music, normalize, renderOffline, renderTrack, type StingerId, type TrackId } from './music.ts';
import { STINGERS, TRACKS, type Voice } from './score.ts';
import { BOSS_KINDS, FINAL_FORMS, setBossKind } from './tracks.ts';

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const clamp = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Tracks whose intensity is the fight's progress. Every other track reads Tilde's mend. */
const FIGHTS: ReadonlySet<string> = new Set(['boss', 'postboss', 'final']);
let mended = 0;
let fight = 0;
const intensity = () => (FIGHTS.has(music.current() ?? '') ? fight : mended);

const Music = {
  /** Switches tracks with a short fade. Before Sound.ctx exists it remembers the track and starts it later. */
  play(name: string): void {
    if (!own(TRACKS, name)) return;
    if (FIGHTS.has(name) && music.current() !== name) fight = 0;
    music.play(name as TrackId, 1);
    music.setIntensity(intensity());
  },
  stop(): void {
    music.stop(1);
  },
  /** Silences the music while the song keeps its place. */
  setMuted(m: boolean): void {
    setMuted(!!m);
  },
  /** Plays a one-shot over the current track and ducks the track under it. */
  jingle(name: string): void {
    if (own(STINGERS, name)) music.stinger(name as StingerId);
  },
  /** How much of Tilde is patched, from 0 to 1, such as chips found over chips in the game. Static gives way as it rises. */
  setMended(x: number): void {
    mended = clamp(x);
    music.setIntensity(intensity());
  },
  /** How far the boss fight has gone, from 0 to 1, such as the boss's lost HP over its full HP. */
  setIntensity(x: number): void {
    fight = clamp(x);
    music.setIntensity(intensity());
  },
  /** Whose figures the fight plays: 'manager', 'foreman', 'warden', 'forklift', 'cook', 'arcade', 'gardener', 'mainframe', 'valet', 'usher', or 'jack'. It lands at the next section. In the finale it names the boss the Static copies: 'manager', 'cook', 'gardener', 'valet', or 'true' for its own face. */
  setBoss(type: string): void {
    setBossKind(String(type));
  },
  current(): string | null {
    return music.current();
  },
  /** The score without audio, for tools/check-music.mjs, and a level meter that runs only in a browser. */
  offline: {
    level: MUSIC_LEVEL,
    tracks: Object.keys(TRACKS),
    jingles: Object.keys(STINGERS),
    bosses: BOSS_KINDS,
    forms: FINAL_FORMS,
    render: (id: TrackId, seconds: number, opts?: Parameters<typeof renderTrack>[2]) => renderTrack(id, seconds, opts),
    jingle: (id: StingerId) => {
      const s = STINGERS[id]();
      return { beats: s.beats, bpm: s.bpm, notes: normalize(s) };
    },
    /** Renders a track or jingle and returns its loudest one-second RMS and its peak, as gains at Sound.master. */
    async measure(src: TrackId | StingerId, seconds: number, level = 0, only?: Voice[]) {
      const r = await renderOffline(src, seconds, { level, only });
      const gain = (db: number) => Math.pow(10, db / 20) * MUSIC_LEVEL;
      const L = r.buffer.getChannelData(0), R = r.buffer.getChannelData(1);
      let at = 0, top = 0;
      for (let i = 0; i < L.length; i++) { const x = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (x > top) { top = x; at = i; } }
      // The engine's peak skips the last partial second, so the peak here is the maximum of the whole buffer.
      return { rms: gain(r.rms), peak: top * MUSIC_LEVEL, peakAt: at / r.buffer.sampleRate, buffer: r.buffer };
    },
  },
};

(globalThis as { Music?: typeof Music }).Music = Music;
