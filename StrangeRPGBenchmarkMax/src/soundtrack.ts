// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { attachAudio } from './audio/core';
import { music, renderTrack } from './audio/music';
import type { BattleEvent } from './audio/music';
import type { Region } from './audio/score-core';

interface Change { id: string; label: string; toggle?: boolean; steps?: string[]; value?: boolean | number }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }

const LAMP: Change = { id: 'lamp', label: 'Lamp', toggle: true, value: false };
const chapter = (...n: number[]): Change => ({ id: 'chapter', label: 'Chapter', steps: n.map(String), value: 0 });

/** Field and scene tracks in the order the story reaches them, with the chapter that first plays each one. */
const FIELD: Array<[id: string, title: string, chapter: number, changes?: Change[]]> = [
  ['title', 'Gnomon', 1],
  ['home', 'Home', 1],
  ['stile', 'Stile', 1],
  ['lead', 'The giant shadow', 1, [chapter(1, 5)]],
  ['wake', "Mott's house", 1],
  ['gully', 'The gully', 1],
  ['parhelia', 'Parhelia', 1, [chapter(1, 7)]],
  ['sticks', 'Sticks', 1],
  ['road', 'The Long road', 2],
  ['market', 'The Shadow Market', 2],
  ['lot', 'Lot', 2, [chapter(2, 6)]],
  ['underbridge', 'The Underbridge', 2],
  ['bright', 'The road onto the Face', 3],
  ['solehold', 'Solehold', 3],
  ['relay_tower', 'The Relay tower', 3],
  ['glass', 'The glass flats', 4],
  ['minim', 'Minim', 4, [chapter(4, 5)]],
  ['glass_quarry', 'The Relay quarry', 4],
  ['overhead', 'Overhead', 5, [LAMP]],
  ['first_mirror', 'The First Mirror', 5, [LAMP]],
  ['overhead_sad', 'Overhead, alone', 5, [LAMP]],
  ['dusk', 'The dusk road', 6, [LAMP]],
  ['back_road', 'The dark road', 6, [LAMP]],
  ['tik', 'Tik', 6],
  ['burrow', 'Burrow', 6, [LAMP]],
  ['lampeater_den', "The Lampeater's den", 6, [LAMP]],
  ['stile_dark', "Stile's nightward edge", 7],
  ['office_tower', 'The Office tower', 7],
  ['anthelion', 'Anthelion', 7],
];

/** Each battle region, its name in the Region choice, and the field track a won battle melts back into. */
const REGIONS: Array<[region: Region, label: string, field: string]> = [
  ['long', 'The Long', 'gully'],
  ['market', 'The Market', 'underbridge'],
  ['face', 'The Face', 'bright'],
  ['glass', 'The Glass', 'glass'],
  ['overhead', 'Overhead', 'overhead'],
  ['back', 'The Back', 'back_road'],
  ['lamp', 'The Great Lamp', 'stile_dark'],
];

/** Battle intensity for each step. The game sends 0.3 plus 0.07 a round, and 0.3 more at low HP. */
const INTENSITY = [0.35, 0.6, 0.9];
const FIGHT: Change[] = [
  { id: 'intensity', label: 'Intensity', steps: ['Calm', 'Tense', 'Desperate'], value: 0 },
  LAMP,
  { id: 'low', label: 'Low HP', toggle: true, value: false },
  { id: 'turned', label: 'Turned hit' },
  { id: 'note', label: 'New entry' },
];
const PHASE: Change = { id: 'phase', label: 'Boss phase' };
const VICTORY: Change = { id: 'victory', label: 'Victory' };

/** Boss fights: the engine track, the region whose boss it is, and the album title. The lamp region's boss never fights. */
const BOSSES: Array<[track: string, region: Region, title: string]> = [
  ['boss', 'long', 'Grisaille'],
  ['boss', 'market', 'The Painter'],
  ['boss', 'face', 'Heliotrope'],
  ['boss', 'glass', 'Warden of Panes'],
  ['boss', 'overhead', 'Keeper of the First Mirror'],
  ['boss', 'back', 'Lampeater'],
  ['boss_final', 'lamp', 'The Great Lamp'],
];

const seconds = (id: string) => renderTrack(id, 60).reduce((t, s) => t + s.secs, 0);

const tracks: Track[] = [
  ...FIELD.map(([id, title, , changes]) => ({ id, title, ...(changes ? { changes } : {}) })),
  { id: 'fight:battle:long', title: 'Battle', changes: [{ id: 'region', label: 'Region', steps: REGIONS.map((r) => r[1]), value: 0 }, ...FIGHT, VICTORY] },
  ...BOSSES.map(([track, region, title]) => ({ id: `fight:${track}:${region}`, title, changes: [...FIGHT, PHASE, VICTORY] })),
  { id: 'defeat', title: 'Defeat' },
  { id: 'epilogue', title: 'Epilogue' },
  { id: 'credits', title: 'Credits' },
  { id: 'victory', title: 'Victory', length: seconds('victory'), once: true },
];

let fightTrack: string | null = null;
let region: Region = 'long';
let chapters: string[] = [];
const held = { intensity: 0, lamp: false, low: false };

const fighting = () => fightTrack !== null && music.current() === fightTrack;
const ev = (kind: BattleEvent) => { music.event(kind); };

/** Starts the fight in `region` the way the battle screen does. */
function fight(): void {
  if (!fightTrack) return;
  music.setRegion(region);
  music.play(fightTrack);
  settle();
}

/** Restores the listener's choices once the fight plays. A victory sting that is still playing finishes first. */
function settle(): void {
  if (music.current() === 'victory') { setTimeout(settle, 100); return; }
  if (!fighting()) return;
  if (fightTrack === 'boss_final') ev('boss_phase');
  music.setIntensity(INTENSITY[held.intensity]);
  if (held.lamp) ev('lamp_on');
  if (held.low) ev('low_hp');
}

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    attachAudio(ctx, out);
    const [kind, track, r] = id.split(':');
    if (kind === 'fight') {
      fightTrack = track;
      region = r as Region;
      fight();
      return;
    }
    const field = FIELD.find((f) => f[0] === id);
    chapters = field?.[3]?.find((c) => c.id === 'chapter')?.steps ?? [];
    music.setChapter(field ? field[2] : 7);
    music.play(id);
  },
  change(id: string, value?: boolean | number) {
    switch (id) {
      case 'chapter': if (chapters.length) music.setChapter(Number(chapters[value as number])); return;
      case 'lamp': held.lamp = !!value; ev(value ? 'lamp_on' : 'lamp_off'); return;
      case 'region':
        region = REGIONS[value as number][0];
        if (fighting()) music.recolor(region); else fight();
        return;
      case 'intensity': held.intensity = value as number; music.setIntensity(INTENSITY[held.intensity]); return;
      case 'low': held.low = !!value; if (fighting()) ev(value ? 'low_hp' : 'calm'); return;
      case 'turned': if (fighting()) ev('turned_hit'); return;
      case 'note': if (fighting()) ev('note_recorded'); return;
      case 'phase': if (fighting()) ev('boss_phase'); return;
      case 'victory':
        if (!fighting()) return;
        ev('victory');
        music.play(REGIONS.find((x) => x[0] === region)![2]);
        return;
    }
  },
};
