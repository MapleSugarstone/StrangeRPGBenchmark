// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
import { attachAudio } from './audio/core';
import { music, renderTrack } from './audio/music';
import type { CombatEvent } from './audio/music';
import type { Region } from './audio/score-core';

interface Change { id: string; label: string; toggle?: boolean; steps?: string[]; value?: boolean | number }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }

/** Place and scene tracks in the order the story reaches them. */
const FIELD: Array<[id: string, title: string]> = [
  ['title', 'Fathom'],
  ['home', 'Your Place'],
  ['sad', 'Sad'],
  ['tense', 'Tense'],
  ['clinic', "Doc Seo's"],
  ['market', 'Pell Market'],
  ['pound', 'The Pound'],
  ['ferries', 'Ferry Graveyard'],
  ['camp', 'Camp'],
  ['deeps', 'The Deeps'],
  ['stair', 'The Stair'],
  ['lanterns', 'Lantern Steps'],
  ['spire', 'Mercy Spire'],
  ['church', 'Church of the Raised Hand'],
  ['farm', 'The Terraces'],
  ['flood', 'High Water'],
  ['brim', 'The Brim'],
  ['crown', 'The Crown'],
];

/** Each district, its label, and the place track that sets it and that a won fight melts back into. */
const DISTRICTS: Array<[region: Region, label: string, place: string]> = [
  ['deeps', 'Deeps', 'deeps'],
  ['stair', 'Stair', 'stair'],
  ['brim', 'Brim', 'brim'],
  ['flood', 'Flood', 'flood'],
];

const FIGHT: Change[] = [
  { id: 'turn', label: 'Turn', steps: ['Party', 'Enemy'], value: 0 },
  { id: 'kill', label: 'Kill' },
  { id: 'low', label: 'Low HP' },
];
const PHASE: Change = { id: 'phase', label: 'Boss phase' };
const VICTORY: Change = { id: 'victory', label: 'Victory' };

/** Each district's boss fight, titled by the boss whose mechanic the score acts out. */
const BOSSES: Array<[region: Region, title: string]> = [
  ['deeps', 'Mother Sieve'],
  ['stair', 'The Dowser'],
  ['brim', 'The Warden and Teun'],
  ['flood', 'The raid on the Clement'],
];

const seconds = (id: string) => renderTrack(id, 60).reduce((t, s) => t + s.secs, 0);

const tracks: Track[] = [
  ...FIELD.map(([id, title]) => ({ id, title })),
  { id: 'fight:combat:deeps', title: 'Combat', changes: [{ id: 'district', label: 'District', steps: DISTRICTS.map((d) => d[1]), value: 0 }, ...FIGHT, VICTORY] },
  ...BOSSES.map(([region, title]) => ({ id: `fight:boss:${region}`, title, changes: [...FIGHT, PHASE, VICTORY] })),
  { id: 'defeat', title: 'Defeat' },
  { id: 'ending', title: 'Epilogue' },
  { id: 'credits', title: 'Credits' },
  { id: 'victory', title: 'Victory', length: seconds('victory'), once: true },
];

let fightTrack: string | null = null;
let region: Region = 'deeps';
let enemyTurn = false;

const fighting = () => fightTrack !== null && music.current() === fightTrack;
const ev = (kind: CombatEvent) => { music.event(kind); };
const place = () => DISTRICTS.find((d) => d[0] === region)![2];

/** Restores the turn the listener chose once a new fight plays. A victory sting that is still playing finishes first. */
function settle(): void {
  if (music.current() === 'victory') { setTimeout(settle, 100); return; }
  if (fighting() && enemyTurn) ev('enemy_turn');
}

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    const [kind, track, r] = id.split(':');
    if (kind === 'fight') {
      fightTrack = track;
      region = r as Region;
      // Before audio exists these calls only set the district and the fight, the way the field and the fight start do.
      music.play(place());
      music.play(track);
      ev('start');
    } else {
      music.play(id);
    }
    attachAudio(ctx, out);
  },
  change(id: string, value?: number) {
    switch (id) {
      case 'district':
        region = DISTRICTS[value as number][0];
        music.setRegion(region);
        if (fighting() || !fightTrack) return;
        music.play(fightTrack);
        ev('start');
        settle();
        return;
      case 'turn': enemyTurn = value === 1; ev(enemyTurn ? 'enemy_turn' : 'party_turn'); return;
      case 'kill': ev('kill'); return;
      case 'low': ev('low_hp'); return;
      case 'phase': ev('boss_phase'); return;
      case 'victory':
        if (!fighting()) return;
        ev('victory');
        music.play(place());
        return;
    }
  },
};
