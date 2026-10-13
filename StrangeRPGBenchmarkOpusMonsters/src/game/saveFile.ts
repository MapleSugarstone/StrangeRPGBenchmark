// Save files outside the browser: export downloads a slot as a .whorl file, and import reads one back into a slot.
import { exportText, importText, slotInfo } from './state';

/** Downloads slot n as a .whorl file named after its hero. Returns false when the slot is empty. */
export function downloadSlot(n: number): boolean {
  const text = exportText(n);
  if (!text) return false;
  const who = (slotInfo(n)?.name || '').replace(/[^A-Za-z0-9]+/g, '') || 'whorl';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = `${who}-file${n}.whorl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

/** Opens the browser's file picker and reads the chosen .whorl file into slot n. */
export function pickInto(n: number): Promise<'done' | 'cancel' | 'bad'> {
  return new Promise(resolve => {
    let settled = false;
    const end = (r: 'done' | 'cancel' | 'bad') => { if (!settled) { settled = true; resolve(r); } };
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = '.whorl,.json';
    el.addEventListener('change', () => {
      const file = el.files?.[0];
      if (!file) { end('cancel'); return; }
      file.text().then(t => end(importText(n, t) ? 'done' : 'bad'), () => end('bad'));
    });
    el.addEventListener('cancel', () => end('cancel'));
    // Some browsers send no cancel event, so focus coming back with no file picked counts as one.
    window.addEventListener('focus', () => setTimeout(() => { if (!el.files?.length) end('cancel'); }, 800), { once: true });
    el.click();
  });
}
