// Plays the score with the Web Audio API. A timer schedules one bar at a time a little ahead of the clock.
import { FIXED, OPEN } from '../rules/types';
import { standing } from '../rules/board';
import { G } from '../ui/game';
import { sound } from '../ui/core';
import { battleShown } from '../ui/battleview';
import { hooks } from '../ui/meta';
import { RATE, buildFont } from './font';
import type { InstId } from './font';
import { barNotes, figure, tempoOf } from './score';
import type { MusicState, Note } from './score';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buffers: Record<string, AudioBuffer> = {};
let bases: Record<string, number> = {};
let mood = 'title';
let muted = false;
let bar = 0;
let nextBar = 0;
let lastMode = '';
let smooth = 0;

export function musicState(): MusicState {
  const s = G.s;
  if (!s) return { mode: mood === 'ending' ? 'ending' : 'title', season: 0, decided: 0.5 + 0.5 * Math.sin(bar / 5), lean: Math.floor(bar / 16) & 1, lead: 'none', level: false, intensity: 0 };
  if (mood === 'ending') return { mode: 'ending', season: 6, decided: smooth, lean: 0, lead: 'perch', level: false, intensity: 0 };
  let fixed = 0, open = 0;
  for (const t of s.tiles) { if (t.official) continue; if (t.st === FIXED) fixed++; else if (t.st === OPEN) open++; }
  let d = fixed + open ? fixed / (fixed + open) : 0;
  const battle = battleShown() && !!s.battle;
  if (battle) { const u = s.battle!.units.filter((x) => !x.down); d = u.length ? u.filter((x) => !x.two || x.fixed).length / u.length : 1; }
  smooth += (d - smooth) * 0.5;
  const lead = s.players[standing(s).winner];
  return {
    mode: battle ? 'battle' : 'sheet', season: s.season, decided: smooth, lean: lead.human || lead.char === 'perch' ? 0 : 1,
    lead: lead.char, level: !!s.level && s.level.alive, intensity: (2 * s.round) / s.rounds,
  };
}

function play(n: Note, t0: number, stepDur: number): void {
  if (!ctx || !master) return;
  const buf = buffers[n.inst];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const rate = n.freq > 0 ? n.freq / bases[n.inst] : 1;
  src.playbackRate.value = Math.max(0.1, Math.min(8, rate));
  const g = ctx.createGain();
  const len = Math.min(buf.duration / src.playbackRate.value, n.dur * stepDur + 0.12);
  g.gain.setValueAtTime(n.gain, t0);
  g.gain.setValueAtTime(n.gain, t0 + Math.max(0.01, len - 0.06));
  g.gain.linearRampToValueAtTime(0, t0 + len);
  const pan = ctx.createStereoPanner();
  pan.pan.value = n.pan;
  src.connect(g).connect(pan).connect(master);
  src.start(t0);
  src.stop(t0 + len + 0.02);
}

function tick(): void {
  if (!ctx || muted || ctx.state !== 'running') return;
  const st = musicState();
  if (st.mode !== lastMode) { lastMode = st.mode; bar = 0; nextBar = ctx.currentTime + 0.08; }
  if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.05;
  while (nextBar < ctx.currentTime + 0.3) {
    const stepDur = 60 / tempoOf(st) / 4;
    for (const n of barNotes(st, bar)) play(n, nextBar + n.step * stepDur, stepDur);
    nextBar += 16 * stepDur;
    bar++;
  }
}

const hitNote = (inst: InstId, gain: number, step = 0, freq = 0, dur = 2): Note => ({ step, inst, freq, gain, dur, pan: 0 });
const SFX: Record<string, Note[]> = {
  tick: [hitNote('tap', 0.18)],
  ok: [hitNote('tap', 0.22), hitNote('glass', 0.14, 0, 784)],
  back: [hitNote('tap', 0.16, 0, 500)],
  no: [hitNote('band', 0.3, 0, 70)],
  page: [hitNote('paper', 0.3)],
  step: [hitNote('tap', 0.14, 0, 700)],
  talk: [hitNote('tap', 0.05, 0, 1400)],
  sketch: [hitNote('scratch', 0.3), hitNote('scratch', 0.2, 1.5)],
  measure: [hitNote('stamp', 0.5), hitNote('glass', 0.2, 1, 587), hitNote('glass', 0.22, 2, 880)],
  peg: [hitNote('tap', 0.3, 0, 1200), hitNote('bell', 0.08, 0.5, 1568)],
  ink: [hitNote('glass', 0.2, 0, 659), hitNote('glass', 0.2, 1, 784)],
  doubt: [hitNote('bottle', 0.22, 0, 330, 4), hitNote('bottle', 0.22, 0, 330 * (11 / 9), 4)],
  card: [hitNote('paper', 0.3), hitNote('tap', 0.15, 1)],
  bell: [hitNote('bell', 0.22, 0, 1046.5, 6)],
  stamp: [hitNote('stamp', 0.6)],
  deal: [hitNote('bell', 0.14, 0, 784, 4), hitNote('glass', 0.2, 1, 987.8)],
  break: [hitNote('band', 0.5, 0, 180), hitNote('band', 0.4, 1, 110), hitNote('scratch', 0.3, 1)],
  fight: [hitNote('stamp', 0.6), hitNote('stamp', 0.5, 2), hitNote('ruler', 0.4, 2, 98, 4)],
  hit: [hitNote('tap', 0.4, 0, 600), hitNote('stamp', 0.35)],
  win: [hitNote('ruler', 0.4, 0, 196), hitNote('ruler', 0.4, 1.5, 247), hitNote('ruler', 0.45, 3, 294, 5), hitNote('bell', 0.12, 3, 1175, 5)],
  lose: [hitNote('band', 0.45, 0, 147), hitNote('band', 0.45, 2, 131), hitNote('band', 0.5, 4, 98, 5)],
  uproot: [hitNote('band', 0.45, 0, 120), hitNote('scratch', 0.3, 0.5)],
  level: [hitNote('bell', 0.14, 0, 784, 3), hitNote('bell', 0.14, 2, 784, 3)],
};

function sfx(name: string): void {
  if (!ctx || muted || ctx.state !== 'running') return;
  const notes = name.startsWith('turn_') ? figure(name.slice(5)) : SFX[name];
  if (!notes) return;
  const stepDur = 0.075;
  for (const n of notes) play(n, ctx.currentTime + 0.01 + n.step * stepDur, stepDur);
}

function start(): void {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  const font = buildFont();
  for (const [id, sm] of Object.entries(font)) {
    const b = ctx.createBuffer(1, sm.data.length, RATE);
    b.getChannelData(0).set(sm.data);
    buffers[id] = b;
    bases[id] = sm.base;
  }
  window.setInterval(tick, 30);
}

export function initAudio(canvas: HTMLCanvasElement): void {
  sound.sfx = sfx;
  hooks.music = (m: string) => { mood = m; };
  const wake = () => start();
  canvas.addEventListener('mousedown', wake);
  window.addEventListener('keydown', (ev) => {
    wake();
    if (ev.key === 'm' || ev.key === 'M') { muted = !muted; if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02); }
  });
}
