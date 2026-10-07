// Balance simulator. Plays every fight in story order with three scripted players who write
// different quality spells, carrying levels, marks, and Grammar purchases from fight to fight.
// Run with: npm run sim [-- seeds]
import { parse } from '../cant/parser';
import { Battle, Body, makePage } from '../game/battle';
import { FOES } from '../game/enemies';
import { GNODE } from '../game/grammar';
import { SaveData, allyMax, battleSetup, buyNode, gainXp, lineLimit, maxHp, maxInk, newGame, pageSlots } from '../game/state';

type Profile = 'novice' | 'competent' | 'expert';

interface Fight { enc: string; boss?: boolean }

const CHAPTERS: { n: number; fights: Fight[]; words: string[]; party: string[]; lent: string[]; marks: number }[] = [
  { n: 1, fights: [{ enc: 'straw' }, { enc: 'nip' }, { enc: 'chaffnip' }, { enc: 'spoke' }, { enc: 'copynip2' }, { enc: 'spokenip' }, { enc: 'grind', boss: true }], words: ['strike', 'mend', 'ward', 'say', 'repeat'], party: [], lent: [], marks: 2 },
  { n: 2, fights: [{ enc: 'fisher' }, { enc: 'fisher2' }, { enc: 'lull' }, { enc: 'tock' }, { enc: 'grit' }, { enc: 'gritlull' }, { enc: 'tock2' }, { enc: 'hold', boss: true }], words: ['if', 'else', 'soak'], party: ['halt'], lent: [], marks: 2 },
  { n: 3, fights: [{ enc: 'clerks' }, { enc: 'vat' }, { enc: 'split' }, { enc: 'presshand' }, { enc: 'press2' }, { enc: 'many', boss: true }], words: ['let', 'count', 'first', 'last'], party: ['halt', 'each'], lent: ['halt', 'each'], marks: 2 },
  { n: 4, fights: [{ enc: 'flinch' }, { enc: 'ringer' }, { enc: 'dish' }, { enc: 'dish2' }, { enc: 'static' }, { enc: 'relay', boss: true }], words: [], party: ['halt', 'each', 'when'], lent: ['halt', 'each', 'when'], marks: 1 },
  { n: 5, fights: [{ enc: 'drift' }, { enc: 'sentry' }, { enc: 'waitcopy' }, { enc: 'sentry2' }, { enc: 'arm', boss: true }], words: [], party: ['halt', 'each', 'when'], lent: ['halt', 'each', 'when'], marks: 1 },
  { n: 6, fights: [{ enc: 'loop' }, { enc: 'csweep' }, { enc: 'ccount' }, { enc: 'cstack' }, { enc: 'cpour' }, { enc: 'cmind' }, { enc: 'again', boss: true }], words: ['erase', 'halt'], party: ['each', 'when'], lent: ['each', 'when'], marks: 1 },
  // Act 2: Wait starts again at level 1 and knows every word.
  { n: 7, fights: [{ enc: 'tidy' }, { enc: 'blot2' }, { enc: 'tidyblot' }, { enc: 'closer', boss: true }], words: ['into'], party: ['room'], lent: [], marks: 2 },
  { n: 8, fights: [{ enc: 'stopper' }, { enc: 'footstop' }, { enc: 'proof' }, { enc: 'proof2' }, { enc: 'footproof' }, { enc: 'corrector', boss: true }], words: ['stet'], party: ['room', 'every'], lent: ['each'], marks: 2 },
  { n: 9, fights: [{ enc: 'loose' }, { enc: 'caret' }, { enc: 'firstline' }, { enc: 'dele' }, { enc: 'caret2' }, { enc: 'over', boss: true }], words: [], party: ['room', 'every', 'when'], lent: ['each', 'when'], marks: 2 },
  { n: 10, fights: [{ enc: 'filer' }, { enc: 'delefiler' }, { enc: 'filer2' }, { enc: 'gloss', boss: true }], words: [], party: ['room', 'every', 'when'], lent: ['each', 'when'], marks: 1 },
];

const BUY: Record<Profile, string[]> = {
  novice: ['lines1', 'ink1', 'pages1', 'ink2', 'lines2', 'regen1', 'pages2', 'lines3', 'ink3', 'regen2', 'lines4', 'ink4', 'pages3', 'nib1', 'ink5'],
  competent: ['lines1', 'ink1', 'sear', 'lines2', 'pages1', 'weakest', 'ink2', 'regen1', 'nib1', 'lines3', 'ticks1', 'drain', 'pages2', 'ink3', 'ink5', 'regen2', 'lines4', 'ink4', 'hand3', 'pages3', 'nib2', 'regen3'],
  expert: ['ink1', 'lines1', 'sear', 'regen1', 'weakest', 'nib1', 'lines2', 'ink2', 'mark', 'lines3', 'pages1', 'ink3', 'ink5', 'regen2', 'pages2', 'lines4', 'ink4', 'hand3', 'pages3', 'drain', 'nib2', 'regen3'],
};

// ---------------------------------------------------------------- pages each profile writes, by chapter

type Pages = Record<string, string>;

/** Pages in priority order: when the rote has fewer slots, the later ones are left out. */
function pagesFor(p: Profile, ch: number, s: SaveData): Pages {
  const has = (w: string) => s.words.includes(w);
  const pg: Pages = {};
  if (ch >= 7) return act2Pages(p, ch, has);
  if (p === 'novice') {
    if (ch >= 6) { pg.end = 'halt'; pg.free = 'erase foe'; }
    pg.hit = ch >= 3 ? 'repeat 3: strike foe' : has('repeat') ? 'repeat 2: strike foe' : 'strike foe';
    if (has('jolt')) pg.pierce = 'jolt foe\njolt foe';
    pg.heal = 'mend me';
    return pg;
  }
  if (p === 'competent') {
    if (ch >= 6) { pg.end = 'halt'; pg.free = 'erase foe\nwait\nerase foe'; }
    pg.hit = ch >= 3 ? 'repeat 4:\n  if foe.up: strike foe' : 'repeat 3: strike foe';
    pg.heal = ch >= 2 ? 'if me.hp < 14:\n  mend me\n  mend me\nelse:\n  ward me' : 'mend me\nward me';
    if (has('jolt')) pg.pierce = 'soak foe\njolt foe';
    if (ch >= 4) pg.listen = 'when ally hurt:\n  mend who';
    if (ch >= 3) pg.all = 'each f in foes: strike f';
    return pg;
  }
  if (ch >= 6) { pg.end = 'halt'; pg.free = 'erase foe\nerase foe'; }
  if (ch >= 4) pg.listen = 'when ally hurt: mend who\nwhen foe acts:\n  if who.next is "shout":\n    halt who';
  pg.hit = ch >= 3 ? 'repeat 5:\n  if not foe.up: halt\n  strike foe' : ch >= 2 ? 'repeat 4:\n  if foe.hp > 0:\n    strike foe' : 'repeat 3: strike foe';
  if (ch >= 3) pg.all = 'each f in foes:\n  if f.hp > 0: strike f';
  if (has('jolt')) pg.pierce = 'soak foe\njolt foe';
  pg.heal = ch >= 2 ? 'if me.hp < 16: mend me\nif foe.next is "strike":\n  ward me' : 'mend me\nward me';
  if (has('sear')) pg.burn = has('repeat') ? 'sear foe\nrepeat 2: strike foe' : 'sear foe';
  return pg;
}

function act2Pages(p: Profile, ch: number, has: (w: string) => boolean): Pages {
  const pg: Pages = {};
  if (p === 'novice') {
    pg.hit = 'repeat 3: strike foe';
    pg.heal = 'mend me';
    pg.hit2 = 'strike foe\nstrike foe';
    if (has('jolt')) pg.pierce = 'jolt foe\njolt foe';
    return pg;
  }
  pg.hit = p === 'expert' ? 'repeat 4:\n  if foe.up: strike foe' : 'repeat 3: strike foe';
  if (ch >= 8) pg.stet = 'stet me';
  pg.skip = 'into foe: wait';
  pg.heal = 'if me.hp < 14: mend me\nward me';
  if (p === 'expert') pg.self = 'into foe: strike me\nstrike foe';
  pg.hit2 = 'strike foe\nstrike foe';
  if (has('jolt')) pg.pierce = 'soak foe\njolt foe';
  return pg;
}

// ---------------------------------------------------------------- policies

interface Choice { page: string; target: Body }

function weakestFoe(b: Battle): Body { return b.livingFoes().reduce((a, f) => (f.hp < a.hp ? f : a)); }

/** A player who sees a page has been closed or corrected casts another one instead. */
function policy(p: Profile, b: Battle, pages: Pages, fight: Fight): Choice | null {
  const c = choose(p, b, pages, fight);
  if (!c || p === 'novice') return c;
  const pg = b.setup.pages.find((x) => x.name === c.page);
  if (!pg || (!pg.closed && !pg.corrected)) return c;
  for (const alt of ['hit', 'hit2', 'pierce']) {
    const a = b.setup.pages.find((x) => x.name === alt);
    if (a && a.code && !a.closed && !a.corrected) return { page: alt, target: c.target === b.wait ? b.livingFoes()[0] : c.target };
  }
  return 'stet' in pages ? { page: 'stet', target: b.wait } : c;
}

function choose(p: Profile, b: Battle, pages: Pages, fight: Fight): Choice | null {
  const w = b.wait;
  const foes = b.livingFoes();
  if (!foes.length) return null;
  const has = (k: string) => k in pages;
  const pageOf = (k: string) => b.setup.pages.find((pg) => pg.name === k);
  const shut = (k: string) => !!pageOf(k)?.closed || !!pageOf(k)?.corrected;
  const hpFrac = w.hp / w.max;
  const first = foes[0];
  const orig = foes.find((f) => f.tags.includes('original'));
  const freeable = foes.find((f) => f.def?.freeScene);
  const again = foes.find((f) => f.key === 'again');
  if (again && again.phase > 0 && has('end')) {
    const hintsSeen = b.round - b.phaseRound;
    const patience = p === 'expert' ? 0 : p === 'competent' ? 2 : 4;
    if (hintsSeen >= patience) return { page: 'end', target: again };
  }
  if (shut('hit') && shut('hit2') && has('stet') && w.ink >= 2 && p !== 'novice') return { page: 'stet', target: w };
  const boss = foes.find((f) => f.def?.boss);
  const stets = (f: Body) => f.roteLines.some((l) => l.includes('stet me'));
  const heavy = boss && ['shout', 'halt'].includes(String(b.prop(boss.proc!, boss, 'next')));
  if (heavy && has('skip') && w.ink >= 3 && boss!.marginFull < b.round && !stets(boss!) && (p === 'expert' || (p === 'competent' && b.round % 2 === 0))) return { page: 'skip', target: boss! };
  if (p === 'expert' && has('self') && w.ink >= 5 && (first.def?.power ?? 0) >= 2 && !first.written.length && first.marginFull < b.round && !stets(first)) return { page: 'self', target: first };
  if (shut('hit') && has('hit2')) return { page: 'hit2', target: weakestFoe(b) };
  if (p === 'novice') {
    if (hpFrac < 0.3 && w.ink >= 2) return { page: 'heal', target: w };
    if (freeable && has('free') && w.ink >= 5) return { page: 'free', target: freeable };
    const tn = first;
    if (tn.armor >= 2 && has('pierce')) return { page: 'pierce', target: tn };
    return { page: 'hit', target: tn };
  }
  if (p === 'competent') {
    if (has('listen') && !b.hands.some((h) => h.alive && h.label === 'listen') && b.round <= 2) return { page: 'listen', target: w };
    if (hpFrac < 0.4 && w.ink >= 2) return { page: 'heal', target: w };
    if (freeable && has('free') && w.ink >= 5) return { page: 'free', target: freeable };
    if (fight.enc === 'hold' && has('pierce')) return { page: 'pierce', target: first };
    if (foes.length >= 3 && has('all')) return { page: 'all', target: first };
    const t = orig ?? weakestFoe(b);
    if (t.armor >= 2 && has('pierce')) return { page: 'pierce', target: t };
    return { page: 'hit', target: t };
  }
  // expert
  if (has('listen') && !b.hands.some((h) => h.alive && h.label === 'listen')) return { page: 'listen', target: w };
  if (hpFrac < 0.45 && w.ink >= 2) return { page: 'heal', target: w };
  if (freeable && has('free') && w.ink >= 10) return { page: 'free', target: freeable };
  if (fight.enc === 'hold') return { page: has('pierce') ? 'pierce' : 'hit', target: first };
  if (orig) return { page: 'hit', target: orig };
  const healer = foes.find((f) => f.key === 'vatling' || f.key === 'dish');
  if (healer) return { page: healer.armor && has('pierce') ? 'pierce' : 'hit', target: healer };
  if (foes.length >= 3 && has('all')) return { page: 'all', target: first };
  const t = orig ?? weakestFoe(b);
  if (t.armor >= 2 && has('pierce')) return { page: 'pierce', target: t };
  if (t.hp > 12 && has('burn') && t.burn === 0 && t.wet === 0) return { page: 'burn', target: t };
  return { page: 'hit', target: t };
}

// ---------------------------------------------------------------- running

interface Stat { wins: number; rounds: number; minHp: number; endHp: number; n: number; inkUsed: number; companionsDown: number; halts: number; pagesUsed: number }

function blank(): Stat { return { wins: 0, rounds: 0, minHp: 0, endHp: 0, n: 0, inkUsed: 0, companionsDown: 0, halts: 0, pagesUsed: 0 }; }

function prepare(p: Profile, ch: number): { s: SaveData; pages: Pages } {
  const s = newGame();
  s.flags.grammar_open = true;
  return { s, pages: {} };
}

function setChapter(s: SaveData, p: Profile, chIdx: number) {
  const c = CHAPTERS[chIdx];
  s.chapter = c.n;
  for (const w of c.words) if (!s.words.includes(w)) s.words.push(w);
  if (c.n >= 2 && !s.words.includes('bite')) s.words.push('bite');
  s.party = c.party.slice();
  for (const w of c.lent) s.flags[`lent_${w}`] = true;
  if (c.n === 6) s.flags.lent_halt = false;
  if (c.n >= 4) s.items.second_hand = 1;
  s.marks += p === 'novice' ? Math.floor(c.marks / 2) : c.marks;
  spend(s, p);
}

function spend(s: SaveData, p: Profile) {
  let bought = true;
  while (bought) {
    bought = false;
    for (const id of BUY[p]) {
      if (s.grammar.includes(id)) continue;
      const n = GNODE[id];
      if (!n || n.chapter > s.chapter) continue;
      if (buyNode(s, id) === null) { bought = true; break; }
      break;
    }
  }
}

function install(s: SaveData, pages: Pages, issues: string[]): Pages {
  s.pages = [s.pages[0]];
  const slots = pageSlots(s);
  const out: Pages = {};
  for (const name of Object.keys(pages)) {
    if (Object.keys(out).length >= slots) break;
    const src = pages[name];
    const prog = parse(src);
    if (prog.diags.some((d) => d.sev === 'error')) { issues.push(`${name}: ${prog.diags.map((d) => d.msg).join('; ')}`); continue; }
    if (prog.codeLines > lineLimit(s)) { issues.push(`${name}: ${prog.codeLines} lines > ${lineLimit(s)}`); continue; }
    out[name] = src;
    s.pages.push({ id: name, name, src, color: 0, stats: { casts: 0, harm: 0, heal: 0, best: 0 } });
  }
  return out;
}

function runFight(s: SaveData, p: Profile, fight: Fight, seed: number, pages: Pages): { won: boolean; rounds: number; minHp: number; endHp: number; inkUsed: number; down: number; halts: number; xp: number; b: Battle; pagesUsed: number } {
  const setup = battleSetup(s, fight.enc, seed);
  setup.items = { salve: 1, inkpot: 1 };
  const b = new Battle(setup);
  b.start();
  let minHp = 1;
  let inkUsed = 0;
  let halts = 0;
  let guard = 0;
  const used = new Set<string>();
  while (b.phase === 'command' && guard++ < 120) {
    const c = policy(p, b, pages, fight);
    if (!c) break;
    let idx = setup.pages.findIndex((pg) => pg.name === c.page);
    if (idx < 0) idx = setup.pages.findIndex((pg) => pg.name === 'hit');
    if (idx >= 0) used.add(setup.pages[idx].name);
    const inkBefore = b.wait.ink;
    const ev = idx >= 0 ? b.act({ kind: 'cast', page: idx, target: c.target.id }) : b.act({ kind: 'pass' });
    for (const e of ev) {
      if (e.t === 'harm' && e.who === b.wait.id) minHp = Math.min(minHp, e.snap.hp / e.snap.max);
      if (e.t === 'log' && e.text.startsWith('Wait is halted')) halts++;
    }
    inkUsed += Math.max(0, inkBefore - b.wait.ink);
  }
  const down = b.party.filter((x) => !x.isWait && !x.up).length;
  return { won: b.result === 'win', rounds: b.round, minHp, endHp: b.wait.hp / b.wait.max, inkUsed, down, halts, xp: b.result === 'win' ? b.xpEarned() : 0, b, pagesUsed: used.size };
}

const seeds = Number(process.argv[2]) || 30;
const profiles: Profile[] = ['novice', 'competent', 'expert'];
const table: Record<string, Record<Profile, Stat>> = {};
const levels: Record<Profile, number[]> = { novice: [], competent: [], expert: [] };
const problems: string[] = [];

for (const p of profiles) {
  const { s } = prepare(p, 1);
  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    if (CHAPTERS[ci].n === 7) {
      s.level = 1; s.xp = 0; s.marks = 0;
      s.grammar = s.grammar.filter((id) => (GNODE[id]?.words?.length ?? 0) > 0);
      s.flags = { grammar_open: true };
    }
    setChapter(s, p, ci);
    levels[p].push(s.level);
    for (const fight of CHAPTERS[ci].fights) {
      spend(s, p);
      const issues: string[] = [];
      const pages = install(s, pagesFor(p, CHAPTERS[ci].n, s), issues);
      for (const i of issues) problems.push(`${p} ch${CHAPTERS[ci].n}: ${i}`);
      const st = (table[`${CHAPTERS[ci].n}:${fight.enc}`] ??= { novice: blank(), competent: blank(), expert: blank() })[p];
      let xp = 0;
      for (let k = 0; k < seeds; k++) {
        s.hp = maxHp(s); s.ink = maxInk(s);
        for (const a of s.party) s.allyHp[a] = allyMax(s, a);
        const r = runFight(s, p, fight, 1000 + k * 7919, pages);
        st.n++;
        if (r.won) st.wins++;
        st.rounds += r.rounds;
        st.minHp += r.minHp;
        st.endHp += r.won ? r.endHp : 0;
        st.inkUsed += r.inkUsed;
        st.companionsDown += r.down;
        st.halts += r.halts;
        st.pagesUsed += r.pagesUsed;
        if (k === 0) xp = r.xp;
      }
      gainXp(s, xp || Math.floor(CHAPTERS[ci].fights.length > 0 ? (FOES[fight.enc]?.xp ?? 0) : 0));
    }
  }
}

const pct = (x: number) => `${Math.round(x * 100)}`.padStart(3);
console.log(`Rote balance simulation, ${seeds} seeds per fight\n`);
console.log('levels at chapter start:', profiles.map((p) => `${p} ${levels[p].join(',')}`).join(' | '));
console.log('');
console.log('fight            | novice  win rnd low | competent win rnd low | expert win rnd low');
for (const [k, row] of Object.entries(table)) {
  const cells = profiles.map((p) => {
    const st = row[p];
    return `${pct(st.wins / st.n)}% ${(st.rounds / st.n).toFixed(1).padStart(4)} ${pct(st.minHp / st.n)}%`;
  });
  console.log(`${k.padEnd(16)} | ${cells[0]}     | ${cells[1]}        | ${cells[2]}`);
}
if (problems.length) {
  console.log('\npage problems:');
  for (const pr of [...new Set(problems)].slice(0, 30)) console.log('  ' + pr);
}

// Fun and depth measures.
const rows = Object.entries(table);
const avg = (p: Profile, f: (s: Stat) => number, filter: (k: string) => boolean = () => true) => {
  const xs = rows.filter(([k]) => filter(k)).map(([, r]) => f(r[p]));
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
};
const isBoss = (k: string) => ['grind', 'hold', 'many', 'relay', 'arm', 'again', 'closer', 'corrector', 'over', 'gloss'].some((b) => k.endsWith(`:${b}`));
console.log('\nmeasures');
for (const p of profiles) {
  const win = avg(p, (s) => s.wins / s.n);
  const bossWin = avg(p, (s) => s.wins / s.n, isBoss);
  const low = avg(p, (s) => s.minHp / s.n);
  const bossLow = avg(p, (s) => s.minHp / s.n, isBoss);
  const rnd = avg(p, (s) => s.rounds / s.n, (k) => !isBoss(k));
  const bossRnd = avg(p, (s) => s.rounds / s.n, isBoss);
  console.log(`  ${p.padEnd(9)} win ${pct(win)}%  boss win ${pct(bossWin)}%  lowest hp ${pct(low)}% (bosses ${pct(bossLow)}%)  rounds ${rnd.toFixed(1)} (bosses ${bossRnd.toFixed(1)})`);
}
const gap = avg('expert', (s) => s.wins / s.n, isBoss) - avg('novice', (s) => s.wins / s.n, isBoss);
console.log(`  skill gap on bosses (expert minus novice win rate): ${pct(gap)} points`);
const tense = rows.filter(([, r]) => r.competent.wins / r.competent.n > 0.8 && r.competent.minHp / r.competent.n < 0.5).length;
console.log(`  tense but fair fights for the competent player (wins over 80%, drops under half health): ${tense} of ${rows.length}`);
for (const p of profiles) console.log(`  ${p.padEnd(9)} different pages cast per fight: ${avg(p, (s) => s.pagesUsed / s.n).toFixed(2)}, companions down per fight: ${avg(p, (s) => s.companionsDown / s.n).toFixed(2)}`);
const manyN = table['3:many']?.novice;
if (manyN) console.log(`  Many against a player who never reads which body is the original: ${pct(manyN.wins / manyN.n)}% wins`);

// A player who ignores Hold's rote and casts three strikes a turn.
{
  const s = newGame();
  s.level = 6; s.chapter = 2; s.party = ['halt'];
  s.words.push('strike', 'mend', 'ward', 'repeat', 'soak', 'jolt', 'if', 'else');
  let wins = 0, rounds = 0, halts = 0;
  const pages = install(s, { hit: 'repeat 3: strike foe', heal: 'mend me' }, []);
  for (let k = 0; k < seeds; k++) {
    s.hp = maxHp(s); s.ink = maxInk(s); s.allyHp.halt = allyMax(s, 'halt');
    const r = runFight(s, 'novice', { enc: 'hold', boss: true }, 5000 + k, pages);
    if (r.won) wins++;
    rounds += r.rounds; halts += r.halts;
  }
  console.log(`  Hold against three strikes a turn (ignoring its rote): ${pct(wins / seeds)}% wins, halted ${(halts / seeds).toFixed(1)} times a fight, ${(rounds / seeds).toFixed(1)} rounds`);
}
