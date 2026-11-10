// Parses src/story/script.txt and barks.txt. The format is described at the top of script.txt.
import SCRIPT from '../story/script.txt';
import BARKS from '../story/barks.txt';

export type Line =
  | { k: 'say'; who: string; text: string }
  | { k: 'sys'; text: string }
  | { k: 'dir'; cmd: string; args: string[] }
  | { k: 'if'; cond: string }
  | { k: 'else' }
  | { k: 'end' }
  | { k: 'opt'; label: string; flag: string };

export const SCENES = new Map<string, Line[]>();

function parse(src: string): void {
  let cur: Line[] | null = null;
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('== ')) { cur = []; SCENES.set(line.slice(3).trim(), cur); continue; }
    if (!cur) continue;
    if (line.startsWith('* ')) cur.push({ k: 'sys', text: line.slice(2) });
    else if (line.startsWith('> ')) { const parts = line.slice(2).trim().split(/\s+/); cur.push({ k: 'dir', cmd: parts[0], args: parts.slice(1) }); }
    else if (line === '? else') cur.push({ k: 'else' });
    else if (line === '? end') cur.push({ k: 'end' });
    else if (line.startsWith('? ')) cur.push({ k: 'if', cond: line.slice(2).trim() });
    else if (line.startsWith('[')) { const m = line.match(/^\[\s*(.+?)\s*=>\s*(\w+)\s*\]$/); if (m) cur.push({ k: 'opt', label: m[1], flag: m[2] }); }
    else { const i = line.indexOf(': '); if (i > 0) cur.push({ k: 'say', who: line.slice(0, i), text: line.slice(i + 2) }); }
  }
}
parse(SCRIPT);
parse(BARKS);

export function fill(text: string, fields: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => (key in fields ? String(fields[key]) : all));
}

/** One line a rival says for a situation, or null when the script has none. */
export function bark(char: string, key: string, fields: Record<string, string | number>, salt = 0): string | null {
  const lines = SCENES.get('bark.' + char + '.' + key);
  if (!lines || !lines.length) return null;
  const says = lines.filter((l) => l.k === 'say') as { k: 'say'; who: string; text: string }[];
  if (!says.length) return null;
  return fill(says[salt % says.length].text, fields);
}

/** The greeting lines of a local: both readings at once, reading A alone, reading B alone. */
export function localLines(id: string): string[] {
  const lines = SCENES.get('local.' + id) ?? [];
  return lines.filter((l) => l.k === 'say').map((l) => (l as { text: string }).text);
}

export function allSpoken(): { scene: string; who: string; text: string }[] {
  const out: { scene: string; who: string; text: string }[] = [];
  for (const [id, lines] of SCENES) for (const l of lines) {
    if (l.k === 'say') out.push({ scene: id, who: l.who, text: l.text });
    if (l.k === 'sys') out.push({ scene: id, who: '*', text: l.text });
  }
  return out;
}
