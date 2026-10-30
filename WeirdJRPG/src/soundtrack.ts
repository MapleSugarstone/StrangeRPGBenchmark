// The launcher's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { battleCue, playMusic, setIntensity, setProgress, setWarp, sfx, useAudio } from './engine/audio';
import type { AreaTint, BattleCue, BattleCueOpts, TrackId } from './engine/audio';
import { bendMusic } from './engine/music';
import { BENDS, stingerVoices, tuningOf } from './engine/score/sfxdefs';
import type { StingerId } from './engine/score/sfxdefs';
import type { Emotion } from './battle/model';

interface Change { id: string; label: string; toggle?: boolean; steps?: string[]; value?: boolean | number }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }

/** Story progress at the start of each chapter, as the game sets it. */
const PROGRESS = [0.1, 0.4, 0.55, 0.75, 1];
const chapter = (value: number): Change => ({ id: 'chapter', label: 'Chapter', steps: ['1', '2', '3', '4', '5'], value });
const AREA_NAME: Record<string, string> = { brass: 'Brass', sea: 'Sea', year: 'Year', stone: 'Stone' };
const DANGER: Change = { id: 'danger', label: 'Danger', steps: ['Calm', 'Tense', 'Peak'] };
const FRAGILITY: Change = { id: 'fragility', label: 'Fragility', steps: ['Steady', 'Overloaded', 'Faded'] };
const ACTIONS: Change[] = [
  { id: 'strip', label: 'Strip' },
  { id: 'memory', label: 'Extract Memory' },
  { id: 'emotion', label: 'Extract Emotion' },
  { id: 'name', label: 'Extract Name' },
  { id: 'absorb', label: 'Absorb' },
  { id: 'weave', label: 'Weave' },
  { id: 'unmake', label: 'Unmake' },
  { id: 'sense', label: 'Sense' },
  { id: 'hurt', label: 'Hurt' },
  { id: 'heal', label: 'Heal' },
  { id: 'break', label: 'Reality break' },
  { id: 'vorn', label: 'Vorn' },
  { id: 'lb', label: 'Light-Bound' },
];
const FOE_DOWN: Change = { id: 'foe_down', label: 'Foe down' };
const PHASE: Change = { id: 'phase', label: 'Phase' };
const EMOTIONS: Emotion[] = ['rage', 'sorrow', 'fear', 'joy', 'pride', 'longing', 'confusion', 'despair', 'misery', 'dread'];

interface Setup { prog: number; int?: number; tints?: AreaTint[]; danger?: number[]; foes?: number }
const SETUP: Record<string, Setup> = {};

const LEAD = 0.03;
const stingLength = (id: StingerId): number =>
  Math.ceil((LEAD + Math.max(...stingerVoices(id, tuningOf(null)).map((v) => (v.at ?? 0) + v.d)) + 0.05) * 10) / 10;

function place(id: TrackId, title: string, ch: number, story = false): Track {
  SETUP[id] = { prog: PROGRESS[ch - 1] };
  return { id, title, changes: story ? [chapter(ch - 1)] : undefined };
}

/** A fight track, which gets no Danger choice when it has no `danger` levels to react to. */
function fight(id: TrackId, title: string, ch: number, o: { tints?: AreaTint[]; danger?: number[]; foes?: number; phases?: boolean } = {}): Track {
  SETUP[id] = { prog: PROGRESS[ch - 1], int: o.danger?.[0] ?? (o.phases ? HIGH[0] : LOW[0]), tints: o.tints, danger: o.danger, foes: o.foes ?? 1 };
  const changes: Change[] = [];
  if (o.tints) changes.push({ id: 'area', label: 'Area', steps: o.tints.map((t) => AREA_NAME[t]) });
  if (o.danger) changes.push(DANGER);
  changes.push(FRAGILITY, ...ACTIONS, o.phases ? PHASE : FOE_DOWN);
  return { id, title, changes };
}

const sting = (id: StingerId, title: string): Track => ({ id: `sting:${id}`, title, length: stingLength(id), once: true });

const LOW = [0.3, 0.5, 0.7];
const HIGH = [0.6, 0.8, 1];

const tracks: Track[] = [
  place('title', 'The Void-Pilgrim Chronicles', 1, true),
  place('plaza', 'The Clockwork Plaza', 1),
  place('seer', 'The Seer', 1),
  place('tower', 'The Gear-Tower', 1),
  place('library', 'The Brass Library', 1, true),
  place('gardens', 'The Steam Gardens', 1),
  place('ship', 'The Ship of Many Sails', 2),
  place('lighthouse', 'The Lighthouse of Lost Things', 2),
  place('reef', 'The Reef of Forgotten Names', 2),
  place('current', 'The Current of Time', 2),
  place('archive', 'The Keeper\'s Archive', 2),
  place('year', 'The Yellow Town', 3),
  place('factory', 'The Electronic Meat Factory', 3),
  place('storyteller', 'The Storyteller\'s Corner', 3),
  place('chasm', 'The Chasm of Despair', 3),
  place('escape', 'The Escape', 3),
  place('spire', 'The Crystal Spire', 4),
  place('vault', 'The Memory Vault', 4),
  place('void', 'The Void Chamber', 4),
  place('choice', 'The Final Choice', 5),
  fight('battle', 'Battle', 1, { tints: ['brass', 'sea', 'year', 'stone'], danger: LOW, foes: 3 }),
  fight('miniboss', 'Miniboss', 1, { tints: ['brass', 'sea', 'stone'], danger: LOW }),
  fight('boss', 'The First Watchman', 1, { danger: HIGH, phases: true }),
  fight('keeper', 'The Keeper', 2, { danger: HIGH, phases: true }),
  fight('despair', 'The Despair', 3, { phases: true }),
  fight('lightbound', 'The Light-Bound\'s End', 4, { danger: HIGH, phases: true }),
  fight('guardian', 'The Guardian', 5, { danger: HIGH, phases: true }),
  place('end_restore', 'Restoration', 5),
  place('end_accept', 'Acceptance', 5),
  place('end_escape', 'Escape', 5),
  place('credits', 'Credits', 5),
  sting('victory', 'Victory'),
  sting('defeat', 'Defeat'),
  sting('state_up', 'State up'),
];

let track = '';
let tint: AreaTint | undefined;
let foes = 1;
let phase = 1;
let absorbed = 0;

/** One round of a fight in which the Pilgrim did this, as the battle screen reports it. */
function round(...cues: Array<[BattleCue, BattleCueOpts?]>) {
  for (const [c, o] of cues) battleCue(c, o);
  battleCue('round');
}

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    useAudio(ctx, out);
    if (id.startsWith('sting:')) { sfx(id.slice(6) as StingerId); return; }
    const s = SETUP[id];
    track = id;
    tint = s.tints?.[0];
    foes = s.foes ?? 1;
    setProgress(s.prog);
    setWarp(0);
    setIntensity(s.int ?? 0);
    playMusic(id as TrackId, tint ? { tint } : undefined);
    if (s.foes !== undefined) battleCue('start', { foes });
  },
  change(id: string, value: number) {
    const s = SETUP[track];
    if (!s) return;
    switch (id) {
      case 'chapter': setProgress(PROGRESS[value] ?? PROGRESS[0]); return;
      case 'area': tint = s.tints?.[value] ?? tint; playMusic(track as TrackId, { tint }); return;
      case 'danger': setIntensity(s.danger?.[value] ?? 0); return;
      case 'fragility': {
        const band = (['steady', 'overload', 'faded'] as const)[value] ?? 'steady';
        battleCue(band);
        setWarp(band === 'overload' ? 0.6 : 0);
        return;
      }
      case 'strip': round(['strip'], ['layer_off', { layer: 'shell' }]); return;
      case 'memory': round(['extract_memory'], ['layer_off', { layer: 'memory' }]); return;
      case 'emotion': round(['extract_emotion'], ['layer_off', { layer: 'emotion' }]); return;
      case 'name': round(['extract_name'], ['layer_off', { layer: 'name' }]); return;
      case 'absorb': round(['absorb', { emotion: EMOTIONS[absorbed++ % EMOTIONS.length] }]); return;
      case 'weave': round(['weave']); return;
      case 'unmake': {
        round(['unmake']);
        const b = BENDS.unmake;
        if (b) bendMusic(b[0], b[1], b[2], b[3]);
        return;
      }
      case 'sense': round(['sense']); return;
      case 'hurt': battleCue('hurt', { amount: 20 }); return;
      case 'heal': battleCue('heal', { amount: 10 }); return;
      case 'break': battleCue('reality_break'); return;
      case 'vorn': battleCue('vorn'); return;
      case 'lb': battleCue('lb'); return;
      case 'foe_down': foes = Math.max(0, foes - 1); battleCue('foe_down', { foes }); return;
      case 'phase': battleCue('phase', { phase: ++phase }); return;
    }
  },
};
