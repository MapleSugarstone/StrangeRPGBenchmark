// Scores every Guide chapter by Flesch-Kincaid grade and fails when one reads above grade 4.
// Usage: node dist-tools/readability.js [--write]
// With --write it also saves every chapter, all rows shown, to Notes/guide.md.
import { writeFileSync } from 'node:fs';
import { GRADE_MAX, score } from './readscore';

declare const process: { argv: string[]; exitCode: number };
const g = globalThis as any;
Object.defineProperty(g, 'localStorage', { value: { getItem: () => null, setItem: () => {} }, configurable: true });

async function main(): Promise<void> {
  await import('../data/species');
  const { GUIDE, chapterText } = await import('../content/guide');
  const { TYPES, typeMult } = await import('../data/types');
  const { CAPS, STRAND_CAPS } = await import('../game/state');
  const { LEVEL_MAX } = await import('../data/types');

  let failed = 0;
  console.log('Chapter                          Words  Sentences  Grade');
  for (const ch of GUIDE) {
    const s = score(chapterText(ch));
    const bad = s.grade > GRADE_MAX;
    if (bad) failed++;
    console.log(`${ch.title.padEnd(32)} ${String(s.words).padStart(5)}  ${String(s.sentences).padStart(9)}  ${s.grade.toFixed(1).padStart(5)}${bad ? '  OVER' : ''}`);
  }
  const whole = score(GUIDE.flatMap(chapterText));
  console.log(`${'Whole Guide'.padEnd(32)} ${String(whole.words).padStart(5)}  ${String(whole.sentences).padStart(9)}  ${whole.grade.toFixed(1).padStart(5)}`);
  if (failed) { console.log(`${failed} chapter(s) read above grade ${GRADE_MAX}.`); process.exitCode = 1; }
  // Numbers the chapters state as worked examples, checked against the code that makes them.
  const { xpToNext } = await import('../data/types');
  const { fitCost } = await import('../game/fitting');
  const { makeMon } = await import('../data/species');
  const facts: [string, number, number][] = [
    ['XP from level 5 to 6', xpToNext(5), 72],
    ['Conjoining two level 20 whorls', fitCost({ ...makeMon('cairn', 40), level: 20 }, { ...makeMon('scree', 40), level: 20 }), 200],
    ['DEF 42 on a 100 power hit', Math.round(100 * 100 / (100 + 42)), 70],
  ];
  for (const [what, got, says] of facts) if (got !== says) { console.log(`FACT: ${what} is ${got}, the Guide says ${says}.`); process.exitCode = 1; }

  if (!process.argv.includes('--write')) return;
  // The pictures as words and tables, since the notes copy has no drawings.
  const six = TYPES.slice(0, 6);
  const mark = (a: string, d: string) => { const m = typeMult(a as any, [d as any]); return m > 1 ? '+' : m < 1 ? '-' : ''; };
  const pics: Record<string, string> = {
    team: '*Picture: four slots. The first is the lead. The other three are in reserve.*',
    stats: '*Picture: the seven stats of your lead whorl, each as a bar.*',
    armor: '*Picture: a hit with 100 power. It does 100 to 0 DEF, 70 to 42 DEF, and 50 to 100 DEF.*',
    timeline: '*Picture: two rows of turn marks. Your marks, at 69 AGI, come a little closer together than the foe\'s, at 51 AGI.*',
    cooldown: '*Picture: five turns in a row. Flatten is used on turn 1, rests on turns 2 to 4, and is ready on turn 5.*',
    tide: '*Picture: the tide pool with 5 of 10 filled.*',
    horn: '*Picture: an HP bar with a line at 25%. The HP is under the line.*',
    nacre: '*Picture: six layers on ATK, the most one stat can take.*',
    fatigue: '*Picture: bars for rounds 26 to 29, losing 5%, 10%, 15%, and 20% of max HP.*',
    types: ['| Move \\ Foe | ' + six.join(' | ') + ' |', '|---|' + six.map(() => '---').join('|') + '|',
      ...six.map(a => `| ${a} | ${six.map(d => mark(a, d)).join(' | ')} |`)].join('\n'),
    caps: ['| Pearls | Level cap |', '|---|---|', ...CAPS.map((c, i) => `| ${i}${i === CAPS.length - 1 ? ' or more' : ''} | ${c} |`), `| After the story | ${LEVEL_MAX} |`].join('\n'),
    strandCaps: ['| Star grains | Strand level cap |', '|---|---|', ...STRAND_CAPS.map((c, i) => `| ${i}${i === STRAND_CAPS.length - 1 ? ' or more' : ''} | ${c} |`)].join('\n'),
  };
  const lines: string[] = ['# The Guide', '', 'The Register\'s Guide, every chapter and every row, as the game shows it once the player has met everything. Chapters show as ??? in the game until the player meets them. Made by `node dist-tools/readability.js --write`.', ''];
  for (const ch of GUIDE) {
    const s = score(chapterText(ch));
    lines.push(`## ${ch.title}`, '', `*Grade ${s.grade.toFixed(1)}, ${s.words} words.*`, '');
    let inRows = false;
    for (const b of ch.blocks) {
      if ('s' in b) { lines.push(`- ${b.icon.startsWith('word:') ? `**${b.icon.slice(5)}** ` : ''}${b.s}`); inRows = true; continue; }
      if (inRows) { lines.push(''); inRows = false; }
      if ('p' in b) lines.push(b.p, '');
      else if ('h' in b) lines.push(`### ${b.h}`, '');
      else lines.push(pics[b.pic] || `*Picture: ${b.pic}.*`, '');
    }
    if (inRows) lines.push('');
  }
  writeFileSync('Notes/guide.md', lines.join('\n'));
  console.log('Wrote Notes/guide.md.');
}

main();
