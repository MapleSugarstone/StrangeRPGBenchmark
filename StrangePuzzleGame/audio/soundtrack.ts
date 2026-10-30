// The menu's Soundtrack screen loads this file. The contract is in the root README, under Soundtracks.
// tools/build-music.mjs bundles it into src/soundtrack.js, and tools/build-dist.mjs puts that next to dist/index.html.
import './main.ts';

interface Change { id: string; label: string; toggle?: boolean; steps?: string[]; value?: boolean | number }
interface Track { id: string; title: string; length?: number; once?: boolean; changes?: Change[] }
interface MusicApi {
  play(name: string): void;
  setMuted(m: boolean): void;
  jingle(name: string): void;
  setMended(x: number): void;
  setIntensity(x: number): void;
  setBoss(type: string): void;
  offline: { jingle(id: string): { beats: number; bpm: number } };
}

const Music = (globalThis as unknown as { Music: MusicApi }).Music;

const MEND = [0, 0.25, 0.5, 0.75, 1];
/** Tilde's mend, starting on the step nearest the share of chips a player has when the wing opens. */
const mend = (value: number): Change => ({ id: 'mend', label: "Tilde's mend", steps: MEND.map((x) => `${x * 100}%`), value });
const JINGLES: Change[] = [{ id: 'clear', label: 'Stage clear' }, { id: 'lose', label: 'Signal lost' }];

/** Each wing's track and the mend step it starts on, for the wings whose music Tilde's mend changes. */
const WINGS: Array<[title: string, mendStep?: number]> = [
  ['The Lobby'], ['The Sales Floor'], ['The Back Rooms', 0], ['The Display Hall', 0], ['Loss Prevention'], ['Shipping'],
  ['Head Office'], ['Overtime', 2], ['The Food Court', 2], ['The Arcade', 2], ['The Garden Center', 2], ['The Server Room'],
  ['The Parking Garage'], ['The Cinema'], ['The Toy Store'], ['The Atrium'], ['After Hours'],
];

/** Boss fight progress: the boss's lost HP over its full HP. */
const HP = [0, 0.5, 0.8];
const BOSS_HP: Change = { id: 'hp', label: 'Boss HP', steps: ['Full', 'Half', 'Low'], value: 0 };
/** The bosses in wing order, as Music.setBoss names them and as the choice shows them. */
const BOSSES: Array<[type: string, label: string]> = [
  ['foreman', 'Foreman'], ['warden', 'Warden'], ['forklift', 'Forklift'], ['manager', 'Manager'], ['cook', 'Fry Cook'],
  ['arcade', 'High Score'], ['gardener', 'Gardener'], ['mainframe', 'Mainframe'], ['valet', 'Valet'], ['usher', 'Usher'], ['jack', 'Jack'],
];
/** The Static's five stages and the boss each one copies. */
const STAGES: Array<[form: string, label: string]> = [
  ['manager', 'Clock In'], ['cook', 'Grease Fire'], ['gardener', 'Overgrowth'], ['valet', 'Lights Out'], ['true', 'The Static'],
];

const jingleSeconds = (id: string) => { const j = Music.offline.jingle(id); return (j.beats * 60) / j.bpm; };

const tracks: Track[] = [
  { id: 'title', title: "Tilde's theme", changes: [mend(0)] },
  ...WINGS.map(([title, step], i) => ({ id: `area${i}`, title, changes: step === undefined ? JINGLES : [mend(step), ...JINGLES] })),
  { id: 'boss', title: 'Boss', changes: [{ id: 'boss', label: 'Boss', steps: BOSSES.map((b) => b[1]), value: 0 }, BOSS_HP, ...JINGLES] },
  { id: 'postboss', title: 'Exit Interview', changes: [BOSS_HP, ...JINGLES] },
  { id: 'final', title: 'The Static', changes: [{ id: 'stage', label: 'Stage', steps: STAGES.map((s) => s[1]), value: 0 }, BOSS_HP, ...JINGLES] },
  { id: 'ending', title: 'Ending' },
  { id: 'jingle:clear', title: 'Stage clear', length: jingleSeconds('clear'), once: true },
  { id: 'jingle:lose', title: 'Signal lost', length: jingleSeconds('lose'), once: true },
];

(window as unknown as { soundtrack: unknown }).soundtrack = {
  tracks,
  start(id: string, ctx: AudioContext, out: AudioNode) {
    // The engine plays into the game's Sound global. The menu's node stands in for its master, and nothing is muted.
    (globalThis as unknown as { Sound: unknown }).Sound = { ctx, muted: false, bus: null, master: out };
    Music.setMuted(false);
    const [kind, name] = id.split(':');
    if (kind === 'jingle') { Music.jingle(name); return; }
    const m = tracks.find((t) => t.id === id)?.changes?.find((c) => c.id === 'mend');
    if (m) Music.setMended(MEND[m.value as number]);
    Music.play(id);
    if (id === 'boss') Music.setBoss(BOSSES[0][0]);
    if (id === 'postboss') Music.setBoss('manager');
    if (id === 'final') Music.setBoss(STAGES[0][0]);
  },
  change(id: string, value?: number) {
    switch (id) {
      case 'mend': Music.setMended(MEND[value as number]); return;
      case 'boss': Music.setBoss(BOSSES[value as number][0]); return;
      case 'stage': Music.setBoss(STAGES[value as number][0]); return;
      case 'hp': Music.setIntensity(HP[value as number]); return;
      case 'clear': case 'lose': Music.jingle(id); return;
    }
  },
};
