// Parses the scene scripts in src/script/ into commands. See src/script/README.md for the format.
import ch1 from '../script/ch1.txt';
import ch2 from '../script/ch2.txt';
import ch3 from '../script/ch3.txt';
import ch4 from '../script/ch4.txt';
import ch5 from '../script/ch5.txt';
import ch6 from '../script/ch6.txt';
import ch7 from '../script/ch7.txt';
import letters from '../script/letters.txt';
import strays from '../script/strays.txt';
import ledger from '../script/ledger.txt';
import extra from '../script/extra.txt';

export type Cmd =
  | { t: 'say'; speaker: string; text: string }
  | { t: 'sys'; text: string }
  | { t: 'cmd'; name: string; args: string[]; async: boolean }
  | { t: 'choice'; prompt: string; options: { text: string; label?: string }[] }
  | { t: 'label'; name: string }
  | { t: 'raw'; text: string };

export interface Scene { id: string; file: string; cmds: Cmd[]; labels: Map<string, number> }

const SPEAKER = /^([A-Z][A-Za-z ]{0,20}): (.*)$/;

export const SCENES = new Map<string, Scene>();
/** Scene ids defined twice. The later one silently replaces the earlier, so the test fails on these. */
export const DUPLICATES: string[] = [];

export function parse(src: string, file: string, into = SCENES) {
  let cur: Scene | null = null;
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('== ')) {
      cur = { id: t.slice(3).trim(), file, cmds: [], labels: new Map() };
      if (into.has(cur.id)) DUPLICATES.push(`${file}:${cur.id}`);
      into.set(cur.id, cur);
      continue;
    }
    if (!cur || !t || t.startsWith('#')) continue;
    if (t.startsWith('* ')) {
      const name = t.slice(2).trim();
      cur.labels.set(name, cur.cmds.length);
      cur.cmds.push({ t: 'label', name });
    } else if (t.startsWith('> ')) {
      let body = t.slice(2).trim();
      let async = false;
      if (body.endsWith(' &')) { async = true; body = body.slice(0, -2).trim(); }
      const parts = body.split(/\s+/);
      cur.cmds.push({ t: 'cmd', name: parts[0], args: parts.slice(1), async });
    } else if (t === '?' || t.startsWith('? ')) {
      const prompt = t.slice(1).trim();
      const options: { text: string; label?: string }[] = [];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
        i++;
        const m = lines[i].trim().match(/^- (.*?)(?: -> (\S+))?$/);
        if (m) options.push({ text: m[1], label: m[2] });
      }
      cur.cmds.push({ t: 'choice', prompt, options });
    } else if (t.startsWith('(') && t.endsWith(')')) {
      cur.cmds.push({ t: 'sys', text: t.slice(1, -1) });
    } else if (SPEAKER.test(t) && file !== 'letters' && file !== 'ledger') {
      const m = t.match(SPEAKER)!;
      cur.cmds.push({ t: 'say', speaker: m[1], text: m[2] });
    } else {
      cur.cmds.push({ t: 'raw', text: t });
    }
  }
}

let loaded = false;
export function loadScripts() {
  if (loaded) return;
  loaded = true;
  const files: [string, string][] = [['ch1', ch1], ['ch2', ch2], ['ch3', ch3], ['ch4', ch4], ['ch5', ch5], ['ch6', ch6], ['ch7', ch7], ['letters', letters], ['strays', strays], ['ledger', ledger], ['extra', extra]];
  for (const [name, src] of files) parse(src, name);
}

/** Raw text lines of a scene (letters and ledger notes). */
export function rawLines(id: string): string[] {
  const s = SCENES.get(id);
  if (!s) return [];
  return s.cmds.filter((c): c is { t: 'raw'; text: string } => c.t === 'raw').map((c) => c.text);
}
