// Prints one fight or one sheet as text. Usage: node dist-tools/debug.js fight <season> <foe> [local,local] | sheet <season> <seed>
import type { Companion, Kind, State } from '../rules/types';
import { FIXED, OPEN } from '../rules/types';
import { CHAR_NAME, LAW_OF, LOCALS } from '../rules/data';
import { apply, newSeason } from '../rules/engine';
import { cellName, cellOf, counts } from '../rules/board';
import { decide } from '../rules/ai';

const [mode, a1, a2, a3] = process.argv.slice(2);

function fight(): void {
  const season = Number(a1 ?? 2);
  const ret: Companion[] = (a3 ?? '').split(',').filter(Boolean).map((id) => ({ id, fixed: 0, active: 1, down: false, half: false }));
  const s: State = newSeason({
    seed: 5, season, seats: [{ char: 'perch', human: false, ret, ink: 3, doubt: 2 }, { char: 'deed', human: false }],
    holder: -1, charter: 'acres', law: 'none', deck: [], site: false, flags: { level: false },
  });
  const p = s.players[0];
  p.x = 3; p.y = 3; p.steps = 4;
  s.pending = { t: 'turn', p: 0 };
  const t = s.tiles[cellOf(3, 3)];
  const foe = a2 ?? 'well';
  s.events = [];
  if (['road', 'well', 'town', 'peak'].includes(foe)) { t.st = FIXED; t.k = t.a = t.b = foe as Kind; t.peg = 1; apply(s, { t: 'contest', target: 'peg', who: 1 }); }
  else if (foe === 'level') { s.level = { x: 3, y: 3, alive: true }; t.st = FIXED; t.k = t.a = t.b = 'road'; apply(s, { t: 'contest', target: 'den', who: -2 }); }
  else { t.st = OPEN; t.a = 'road'; t.b = 'well'; t.den = foe; t.denHp = 99; apply(s, { t: 'contest', target: 'den', who: -1 }); }
  for (const e of s.events) {
    if (e.t === 'fightLog') console.log('  ' + e.s);
    else if (e.t === 'hit') console.log(`  hit ${e.n} (unit ${e.p} on unit ${e.q})`);
    else console.log(e.t, JSON.stringify(e));
  }
  console.log('won', s.scripted.lastFightWon, 'rounds', s.scripted.lastFightRounds, 'leader hp%', s.scripted.lastFightHp);
}

function sheet(): void {
  const season = Number(a1 ?? 3);
  const seed = Number(a2 ?? 1);
  const chars = (a3 ? a3.split(',') : ['deed', 'auger', 'offset', 'lot']) as ('deed' | 'auger' | 'offset' | 'lot' | 'either' | 'perch')[];
  const s = newSeason({
    seed, season, seats: chars.map((c) => ({ char: c, human: false })), holder: 0, charter: 'acres', law: LAW_OF.deed,
    deck: LOCALS.filter((l) => !l.reserve).map((l) => l.id),
  });
  for (let i = 0; i < 20000 && !s.over; i++) {
    const a = decide(s);
    const pd = s.pending;
    const who = pd.p >= 0 ? CHAR_NAME[s.players[pd.p].char] : '-';
    let extra = '';
    if ('c' in a && typeof a.c === 'number') extra = ' ' + cellName(a.c);
    console.log(`r${s.round} ${who}: ${a.t}${extra} ${JSON.stringify(a)}`);
    apply(s, a);
    for (const e of s.events) if (['fightEnd', 'promiseBroken', 'promiseKept', 'deal', 'dealRefused', 'object', 'flip', 'seasonEnd', 'uproot', 'recruit'].includes(e.t)) console.log('   >', e.t, JSON.stringify(e).slice(0, 160));
    s.events = [];
    if (pd.t === 'turn' && a.t === 'end') console.log('   counts', counts(s).join(' '), 'ink', s.players.map((p) => p.ink).join(' '), 'doubt', s.players.map((p) => p.doubt).join(' '));
  }
  console.log(JSON.stringify(s.result));
}

if (mode === 'fight') fight();
else sheet();
