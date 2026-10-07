// Loads the scene script. The format is described in Notes/script.md.
import SCRIPT from './script.txt';
import ACT2 from './act2.txt';

export interface Cond { flag: string; neg: boolean }

export type SItem =
  | { k: 'say'; who: string; text: string; cond?: Cond }
  | { k: 'narr'; text: string; cond?: Cond }
  | { k: 'cmd'; cmd: string; args: string[]; cond?: Cond }
  | { k: 'choice'; label: string; target: string; cond?: Cond };

export interface Scene { id: string; items: SItem[] }

export const SCENES: Record<string, Scene> = {};

function parseScript(src: string) {
  let cur: Scene | null = null;
  for (const raw of src.split('\n')) {
    let line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('=== ')) {
      cur = { id: line.slice(4).trim(), items: [] };
      SCENES[cur.id] = cur;
      continue;
    }
    if (!cur) continue;
    let cond: Cond | undefined;
    const cm = line.match(/^\?(!?)([a-z0-9_]+)\s+(.*)$/);
    if (cm) { cond = { flag: cm[2], neg: cm[1] === '!' }; line = cm[3]; }
    if (line.startsWith('> ')) { cur.items.push({ k: 'narr', text: line.slice(2), cond }); continue; }
    if (line.startsWith('! ')) {
      const [cmd, ...args] = line.slice(2).trim().split(/\s+/);
      cur.items.push({ k: 'cmd', cmd, args, cond });
      continue;
    }
    if (line.startsWith('* ')) {
      const m = line.slice(2).match(/^(.*?)\s*->\s*([a-z0-9_]+)$/);
      if (m) cur.items.push({ k: 'choice', label: m[1], target: m[2], cond });
      continue;
    }
    const sm = line.match(/^([A-Z][A-Z ]*):\s*(.*)$/);
    if (sm) { cur.items.push({ k: 'say', who: sm[1], text: sm[2], cond }); continue; }
    cur.items.push({ k: 'narr', text: line, cond });
  }
}

parseScript(SCRIPT);
parseScript(ACT2);
