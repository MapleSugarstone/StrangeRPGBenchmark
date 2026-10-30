// Save slots in browser storage, plus export to a file and import from one. Keys start with fathom-.
import { G, setSave, SETTINGS, saveSettings, type Save } from './state';

export const SLOTS = 9;
const key = (slot: number | 'auto') => `fathom-save-${slot}`;

export interface SlotInfo { slot: number | 'auto'; name: string; chapter: number; district: string; level: number; playtime: number; saved: number }

function info(slot: number | 'auto', s: Save): SlotInfo {
  return { slot, name: s.heroName, chapter: s.chapter, district: s.district, level: s.roster.hero?.level ?? 1, playtime: s.playtime, saved: s.saved };
}

export function readSlot(slot: number | 'auto'): Save | null {
  try {
    const raw = localStorage.getItem(key(slot));
    if (!raw) return null;
    return JSON.parse(raw) as Save;
  } catch { return null; }
}

export function slotInfo(slot: number | 'auto'): SlotInfo | null {
  const s = readSlot(slot);
  return s ? info(slot, s) : null;
}

export function writeSlot(slot: number | 'auto', s: Save = G): boolean {
  try {
    s.saved = Date.now();
    localStorage.setItem(key(slot), JSON.stringify(s));
    if (slot !== 'auto') { SETTINGS.slot = slot; saveSettings(); }
    return true;
  } catch { return false; }
}

export function autosave() { writeSlot('auto'); }

export function load(slot: number | 'auto'): boolean {
  const s = readSlot(slot);
  if (!s) return false;
  setSave(migrate(s));
  if (slot !== 'auto') { SETTINGS.slot = slot; saveSettings(); }
  return true;
}

function migrate(s: Save): Save {
  s.menu ??= {};
  s.looted ??= [];
  s.defeated ??= [];
  s.quests ??= {};
  s.port ??= { name: 'Lode', hold: 0, self: 0 };
  return s;
}

/** The most recent save of any slot, for Continue. */
export function latest(): number | 'auto' | null {
  let best: { s: number | 'auto'; t: number } | null = null;
  for (const s of [...Array.from({ length: SLOTS }, (_, i) => i + 1), 'auto'] as (number | 'auto')[]) {
    const i = slotInfo(s);
    if (i && (!best || i.saved > best.t)) best = { s, t: i.saved };
  }
  return best?.s ?? null;
}

export function exportSave() {
  const blob = new Blob([JSON.stringify(G, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fathom-${G.heroName.replace(/[^a-z0-9]/gi, '')}-ch${G.chapter}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function importSave(slot: number): Promise<boolean> {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) { res(false); return; }
      try {
        const s = JSON.parse(await f.text()) as Save;
        if (!s || typeof s !== 'object' || !s.roster || !s.map) { res(false); return; }
        res(writeSlot(slot, migrate(s)));
      } catch { res(false); }
    };
    inp.click();
  });
}

export function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
