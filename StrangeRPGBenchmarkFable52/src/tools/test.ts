// Content and smoke tests. Usage: node dist-tools/test.js. Exits 1 when a hard check fails; WARN lines never fail the run.
import fs from 'node:fs';
import path from 'node:path';
import { SCENES, allSpoken } from '../ui/script';
import type { Line } from '../ui/script';
import { CREATURES, GUARDIANS, HALVES, LOCALS, RELICS, WARDENS } from '../rules/data';
import { FACE, ICON, KIND_ICON, PAWN, RELIC_ICON } from '../art/sprites';
import { apply, newSeason } from '../rules/engine';
import { PROFILES, decide } from '../rules/ai';
import { choosePerk, closeSeason, newCampaign, startSeason } from '../rules/campaign';
import type { CharId } from '../rules/types';

const RIVALS = ['deed', 'auger', 'offset', 'lot', 'either'];
const ALL = ['perch', ...RIVALS];
let failed = false;

function group(name: string, hard: boolean, bad: string[]): void {
  const tag = bad.length === 0 ? 'PASS' : hard ? 'FAIL' : 'WARN';
  if (tag === 'FAIL') failed = true;
  console.log(`${tag} ${name}${bad.length ? ` (${bad.length})` : ''}`);
  for (const b of bad) console.log('  ' + b);
}

const spoken = allSpoken();
const where = (s: { scene: string; who: string; text: string }) => `${s.scene} [${s.who}] ${s.text}`;
const lineCheck = (test: (t: string) => boolean) => spoken.filter((s) => test(s.text)).map(where);

group('line length at most 100', true, lineCheck((t) => t.length > 100));
group('no em dash, en dash, or semicolon', true, lineCheck((t) => /[—–;]/.test(t)));
const BANNED = ['whisper', 'echo', 'shimmer', 'tapestry', 'testament', 'journey', 'destiny', 'ancient', 'darkness', 'something shifted', 'a part of me', 'I guess', 'Look,'];
const bannedRe = BANNED.map((w) => ({ w, re: new RegExp((/^\w/.test(w) ? '\\b' : '') + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (/\w$/.test(w) ? '\\b' : ''), 'i') }));
group('banned words', true, spoken.flatMap((s) => bannedRe.filter((b) => b.re.test(s.text)).map((b) => `${b.w}: ${where(s)}`)));

// 4. scene references
{
  const bad: string[] = [];
  const warn: string[] = [];
  const need = (id: string, from: string) => { if (!SCENES.has(id)) bad.push(`${id} (from ${from})`); };
  for (const [id, lines] of SCENES) for (const l of lines as Line[]) {
    if (l.k !== 'dir' || l.cmd !== 'play') continue;
    const t = (l.args[0] ?? '').toLowerCase();
    if (t === 'fates') continue;
    if (t.includes('{winner}')) for (const w of ALL) need(t.replace('{winner}', w), id);
    else if (t.includes('{friend}') || t.includes('{nemesis}')) for (const r of RIVALS) need(t.replace('{friend}', r).replace('{nemesis}', r), id);
    else if (t.includes('{')) bad.push(`${t} has an unknown placeholder (from ${id})`);
    else need(t, id);
  }
  const family = (prefix: string, set: string[]) => {
    if (![...SCENES.keys()].some((k) => k.startsWith(prefix))) return;
    for (const c of set) if (!SCENES.has(prefix + c)) (prefix === 'holder.' && c === 'deed' ? warn : bad).push(`${prefix}${c} (family ${prefix})`);
  };
  for (const p of ['final.', 'win.']) family(p, ALL);
  for (const p of ['s5.friend.', 's5.nemesis.', 's6.friend.', 's6.nemesis.', 'holder.', 'law.', 'deputy.']) family(p, RIVALS);
  const re = /(['"])((?:s[1-6]|reunion|strike|deputy|holder|law|fate|final|end|win)\.[\w.]*)\1/g;
  for (const f of ['src/ui/story.ts', 'src/ui/play.ts']) {
    const src = fs.readFileSync(path.resolve(f), 'utf8');
    for (const m of src.matchAll(re)) if (!m[2].endsWith('.')) need(m[2], f);
  }
  group('scene references exist', true, [...new Set(bad)]);
  group('scene references the code skips on purpose', false, warn);
}

// 5. barks
{
  const src = fs.readFileSync(path.resolve('src/ui/play.ts'), 'utf8');
  const keys = [...new Set([...src.matchAll(/(?:toast|bark)\(\s*[\w.!]+\s*,\s*'(\w+)'/g)].map((m) => m[1]))];
  const bad: string[] = [], warn: string[] = [];
  for (const r of RIVALS) for (const k of keys) {
    if (SCENES.has(`bark.${r}.${k}`)) continue;
    const intended = (k === 'betray' && r === 'deed') || (k === 'noink' && r !== 'either') || (k === 'insist' && r === 'either');
    (intended ? warn : bad).push(`bark.${r}.${k}`);
  }
  console.log(`  bark keys found in play.ts: ${keys.join(', ')}`);
  group('barks exist for every rival and key', true, bad);
  group('barks the script intentionally lacks', false, warn);
}

// 6. data coverage
{
  const bad: string[] = [];
  const rows = (s: string[]) => Array.isArray(s) && s.every((r) => typeof r === 'string');
  for (const l of LOCALS) {
    if (FACE[l.id]?.length !== 2) bad.push(`FACE[${l.id}] needs 2 sprites, has ${FACE[l.id]?.length ?? 0}`);
    const n = (SCENES.get('local.' + l.id) ?? []).filter((x) => x.k === 'say').length;
    if (n !== 3) bad.push(`local.${l.id} has ${n} spoken lines, needs 3`);
  }
  const foes = [...CREATURES, ...Object.values(GUARDIANS), ...Object.values(WARDENS)];
  for (const f of foes) {
    const n = FACE[f.id]?.length ?? 0;
    if (f.two ? n !== 2 : n < 1) bad.push(`FACE[${f.id}] has ${n} sprites, needs ${f.two ? 2 : 'at least 1'}`);
  }
  for (const h of HALVES) if (!FACE[h.id]) bad.push(`FACE[${h.id}] missing (half)`);
  for (const r of RELICS) if (!RELIC_ICON[r.id]) bad.push(`RELIC_ICON[${r.id}] missing`);
  for (const [id, list] of Object.entries(FACE)) list.forEach((sp, i) => { if (!rows(sp) || sp.length !== 8 || sp.some((r) => r.length !== 8)) bad.push(`FACE[${id}][${i}] is not 8 rows of 8`); });
  const even = (name: string, table: Record<string, string[]>) => { for (const [id, sp] of Object.entries(table)) if (!rows(sp) || sp.some((r) => r.length !== sp[0].length)) bad.push(`${name}[${id}] has uneven rows`); };
  even('PAWN', PAWN); even('KIND_ICON', KIND_ICON); even('ICON', ICON); even('RELIC_ICON', RELIC_ICON);
  group('data and sprite coverage', true, bad);
}

// 7. engine smoke
{
  const bad: string[] = [];
  const run = (name: string, f: () => void) => { try { f(); } catch (e) { bad.push(`${name}: ${(e as Error).message}`); } };
  const pool: CharId[] = ['perch', 'deed', 'auger', 'offset', 'lot', 'either'];
  for (let season = 2; season <= 6; season++) for (let g = 0; g < 3; g++) run(`season ${season} sheet ${g}`, () => {
    const chars = [0, 1, 2, 3].map((i) => pool[(g + i) % 6]);
    const seats = chars.map((char) => ({ char, human: false }));
    const deck = LOCALS.filter((l) => !l.reserve || season >= 4).map((l) => l.id);
    const s = newSeason({ seed: 500 + g * 31 + season, season, seats, holder: -1, charter: 'acres', law: 'none', deck, difficulty: 1 });
    for (let i = 0; i < 30000 && !s.over; i++) apply(s, decide(s, []));
    if (!s.over || !s.result) throw new Error('did not end');
    if (!(s.result.winner >= 0 && s.result.winner < 4)) throw new Error('invalid winner ' + s.result.winner);
  });
  const profile = PROFILES[Object.keys(PROFILES)[0]];
  for (let g = 0; g < 2; g++) run(`campaign ${g}`, () => {
    const c = newCampaign(4242 + g * 7919, 1);
    while (c.season <= 6) {
      const s = startSeason(c, false);
      const profiles = s.players.map((p) => (p.char === 'perch' ? profile : null));
      for (let i = 0; i < 30000 && !s.over; i++) apply(s, decide(s, profiles));
      if (!s.over) throw new Error('season ' + c.season + ' did not end');
      closeSeason(c, s);
      if (c.choices && c.choices.perks.length) choosePerk(c, c.choices.perks[0]);
    }
    if (c.season !== 7) throw new Error('ended at season ' + c.season);
  });
  group('engine smoke (15 sheets, 2 campaigns)', true, bad);
}

// Soft style checks, one per character
const NUM = 'one|two|three|four|five|six|seven|eight|nine';
const PH = /\{\w+\}/;
const soft = (name: string, who: string, exempt: string[], test: (t: string) => boolean) => group(name, false, spoken.filter((s) => s.who === who && !exempt.includes(s.scene) && !test(s.text)).map(where));
soft('deed voice: numbered clauses, no question, no I', 'deed', ['reunion.deed', 'fate.deed.whole', 'end.all'], (t) => /^\d+\. /.test(t) && !t.includes('?') && !/\bI\b/.test(t));
soft('either voice: every line has "or"', 'either', ['end.one', 'end.all', 'end.pick', 'final.either'], (t) => /\bor\b/i.test(t));
const augerNum = new RegExp(`\\d|\\b(${NUM}|half|both|none|third)\\b|\\{\\w+\\}`, 'i');
soft('auger voice: no future tense, has a number', 'auger', ['reunion.auger', 'final.auger', 'fate.auger.whole', 'bark.auger.gift'], (t) => !/\b(will|later|soon|tomorrow)\b|going to/i.test(t) && augerNum.test(t));
const VAL: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const lotVerbs = 'say|says|ask|asks|want|wants|would|are|is|were|was|doubt|believe|insist|shrug|remember|gave|kept|lost|have|hold|already|wanted|do|came|go';
soft('lot voice: has a number, speaker counts sum to 9', 'lot', [], (t) => {
  if (!new RegExp(`\\d|\\b(${NUM})\\b|\\{\\w+\\}`, 'i').test(t)) return false;
  if (PH.test(t)) return true;
  const hits = [...t.matchAll(new RegExp(`\\b(${NUM})\\s+(?:${lotVerbs})\\b`, 'gi'))].map((m) => VAL[m[1].toLowerCase()]);
  return hits.length < 2 || hits.reduce((a, b) => a + b, 0) === 9;
});
soft('level voice: only readout words', 'level', [], (t) => t.split(/\s+/).every((w) => /^(\d[\d.,]*|\{\w+\}|degrees|Column|chains|rounds|to|close|Obstruction|Correcting|Fault|Proceeding|Sheet|closed|Entered)$/.test(w.replace(/[.,]+$/, '')) || /^[\d.,]+$/.test(w)));
group('undecided local greeting has " / "', false, LOCALS.flatMap((l) => {
  const first = (SCENES.get('local.' + l.id) ?? []).find((x) => x.k === 'say') as { text: string } | undefined;
  return first && !first.text.includes(' / ') ? [`local.${l.id} ${first.text}`] : [];
}));

process.exit(failed ? 1 : 0);
