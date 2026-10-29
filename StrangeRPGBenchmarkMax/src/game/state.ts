// The saved game: flags, party, items, position, and settings. Saves live in browser storage under gnomon-* keys.

export type Dir = 'down' | 'up' | 'left' | 'right';

export interface Member {
  id: string;
  level: number;
  xp: number;
  hp: number;
  gear: string | null;
}

export interface Settings { music: number; sfx: number; voice: number; textSpeed: number; difficulty: 0 | 1 | 2 }

export interface GameState {
  version: number;
  slot: number;
  name: string;
  playtime: number;
  chapter: number;
  flags: Record<string, boolean>;
  vars: Record<string, string | number>;
  party: string[];
  members: Record<string, Member>;
  items: Record<string, number>;
  mites: number;
  map: string;
  x: number;
  y: number;
  dir: Dir;
  /** Recorded attacks (Ledger entries) and the four Nodus carries into battle. */
  entries: string[];
  equipped: string[];
  /** Foes whose page Nodus has written. */
  seen: string[];
  sticks: { owned: string[]; beaten: string[] };
  strays: { carried: number[]; returned: number[] };
  /** Encounter ids beaten in the current region. Cleared on leaving the region. */
  beaten: string[];
  region: string;
  post: { map: string; x: number; y: number };
  entryText: string;
  lastMenu: Record<string, number>;
}

export const SAVE_VERSION = 1;
const KEY = (slot: number) => `gnomon-save-${slot}`;
const SETTINGS_KEY = 'gnomon-settings';

export function newState(slot: number, name: string): GameState {
  return {
    version: SAVE_VERSION,
    slot,
    name,
    playtime: 0,
    chapter: 1,
    flags: {},
    vars: {},
    party: ['nodus'],
    members: { nodus: { id: 'nodus', level: 1, xp: 0, hp: 999, gear: null } },
    items: { bandage: 2 },
    mites: 12,
    map: 'home',
    x: 4,
    y: 4,
    dir: 'down',
    entries: [],
    equipped: [],
    seen: [],
    sticks: { owned: ['s1', 's1', 's2', 's2', 's3'], beaten: [] },
    strays: { carried: [], returned: [] },
    beaten: [],
    region: 'stile',
    post: { map: 'home', x: 4, y: 4 },
    entryText: '',
    lastMenu: {},
  };
}

export let G: GameState = newState(9, 'Nodus');
export function setState(s: GameState) { G = s; }

export function flag(name: string): boolean { return !!G.flags[name]; }
export function setFlag(name: string, on = true) { if (on) G.flags[name] = true; else delete G.flags[name]; }

export function storage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function save(): boolean {
  const s = storage();
  if (!s) return false;
  try { s.setItem(KEY(G.slot), JSON.stringify(G)); return true; } catch { return false; }
}

export function load(slot: number): GameState | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY(slot));
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch { return null; }
}

/** Fills fields added after a save was made, so old saves keep loading. */
export function migrate(o: Partial<GameState>): GameState {
  const base = newState(o.slot ?? 1, o.name ?? 'Nodus');
  return { ...base, ...o, sticks: { ...base.sticks, ...(o.sticks ?? {}) }, strays: { ...base.strays, ...(o.strays ?? {}) }, version: SAVE_VERSION } as GameState;
}

export function deleteSave(slot: number) { storage()?.removeItem(KEY(slot)); }

export interface SlotInfo { slot: number; name: string; chapter: number; playtime: number }
export function slotInfo(slot: number): SlotInfo | null {
  const g = load(slot);
  return g ? { slot, name: g.name, chapter: g.chapter, playtime: g.playtime } : null;
}

export function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Downloads a save as a file. */
export function exportSave(slot: number) {
  const g = load(slot);
  if (!g || typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(g)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gnomon-file${slot}.gnomon`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Asks for a save file and writes it into a slot. */
export function importSave(slot: number, done: (ok: boolean) => void) {
  if (typeof document === 'undefined') { done(false); return; }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.gnomon,.json';
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) { done(false); return; }
    f.text().then((t) => {
      try {
        const g = migrate(JSON.parse(t));
        g.slot = slot;
        storage()?.setItem(KEY(slot), JSON.stringify(g));
        done(true);
      } catch { done(false); }
    });
  };
  input.click();
}

export const SETTINGS: Settings = { music: 8, sfx: 8, voice: 7, textSpeed: 1, difficulty: 0 };
export function loadSettings() {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    if (raw) Object.assign(SETTINGS, JSON.parse(raw));
  } catch { /* defaults stay */ }
}
export function saveSettings() { try { storage()?.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch { /* ignore */ } }
