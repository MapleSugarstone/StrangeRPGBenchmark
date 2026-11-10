// Fight balance: a typical party against every warden, creature, and guardian, season by season.
import type { Companion, Kind, State } from '../rules/types';
import { FIXED, OPEN } from '../rules/types';
import { CREATURES, LOCALS, SITES } from '../rules/data';
import { apply, newSeason } from '../rules/engine';
import { cellOf } from '../rules/board';

interface Row { name: string; fights: number; wins: number; rounds: number; hp: number; struck: number }

function setup(season: number, ret: Companion[], ink: number, doubt: number): State {
  const s = newSeason({
    seed: 77 + season, season, seats: [{ char: 'perch', human: false, ret, ink, doubt }, { char: 'deed', human: false }],
    holder: -1, charter: 'acres', law: 'none', deck: [], site: false, flags: { level: false },
  });
  const p = s.players[0];
  p.x = 3; p.y = 3; p.steps = 4;
  s.pending = { t: 'turn', p: 0 };
  return s;
}

function parties(season: number): Companion[][] {
  const pool = LOCALS.filter((l) => !l.reserve || season >= 4).map((l) => l.id);
  const mk = (id: string, active: number, fixed = 0): Companion => ({ id, fixed, active, down: false, half: false });
  const out: Companion[][] = [[]];
  for (const id of pool) { out.push([mk(id, 1)]); out.push([mk(id, 2)]); }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j += 2) {
      out.push([mk(pool[i], 1), mk(pool[j], 2)]);
      out.push([mk(pool[i], 2, 2), mk(pool[j], 1)]);
    }
  }
  return out;
}

function run(season: number, name: string, prep: (s: State) => { target: 'peg' | 'den'; who: number }, minParty: number): Row {
  const row: Row = { name, fights: 0, wins: 0, rounds: 0, hp: 0, struck: 0 };
  for (const ret of parties(season)) {
    if (ret.length < minParty) continue;
    const s = setup(season, ret.map((c) => ({ ...c })), 3, 2);
    const { target, who } = prep(s);
    apply(s, { t: 'contest', target, who });
    row.fights++;
    row.rounds += s.scripted.lastFightRounds;
    row.struck += s.scripted.lastFightStruck;
    if (s.scripted.lastFightWon === 1) { row.wins++; row.hp += s.scripted.lastFightHp; }
  }
  return row;
}

export function fightReport(_n: number): string {
  const lines: string[] = ['# Fight simulation', '', 'Perch with 3 ink and 2 doubt attacks. Parties: alone, every single local in each reading, and a spread of pairs.', ''];
  for (let season = 2; season <= 6; season++) {
    lines.push(`## Season ${season}`, '', '| Foe | Party | Fights | Win rate | Rounds | Leader health left when winning | Companions struck per fight |', '|---|---|---|---|---|---|---|');
    const rows: [Row, string][] = [];
    const tile = (s: State) => s.tiles[cellOf(3, 3)];
    for (const k of ['road', 'well', 'town', 'peak'] as Kind[]) {
      for (const min of [0, 2]) {
        rows.push([run(season, 'Warden on a ' + k, (s) => { const t = tile(s); t.st = FIXED; t.k = t.a = t.b = k; t.peg = 1; return { target: 'peg', who: 1 }; }, min), min ? 'pairs' : 'all']);
      }
    }
    rows.push([run(season, 'Warden on undecided ground', (s) => { const t = tile(s); t.st = OPEN; t.a = 'road'; t.b = 'well'; t.peg = 1; return { target: 'peg', who: 1 }; }, 0), 'all']);
    for (const c of CREATURES) {
      rows.push([run(season, c.name, (s) => { const t = tile(s); t.st = OPEN; t.a = 'road'; t.b = 'well'; t.den = c.id; t.denHp = 99; return { target: 'den', who: -1 }; }, 0), 'all']);
    }
    const site = SITES.find((x) => x.season === season)!;
    for (const min of [0, 1, 2]) {
      rows.push([run(season, 'Guardian: ' + site.guardian, (s) => { const t = tile(s); t.st = OPEN; t.a = site.a; t.b = site.b; t.site = site.id; t.den = site.guardian; t.denHp = 99; return { target: 'den', who: -1 }; }, min), min === 0 ? 'all' : min === 1 ? 'one or two' : 'pairs']);
    }
    if (season >= 5) {
      for (const min of [0, 2]) {
        rows.push([run(season, 'The Level', (s) => { s.level = { x: 3, y: 3, alive: true }; const t = tile(s); t.st = FIXED; t.k = t.a = t.b = 'road'; return { target: 'den', who: -2 }; }, min), min ? 'pairs' : 'all']);
      }
    }
    for (const [r, party] of rows) {
      lines.push(`| ${r.name} | ${party} | ${r.fights} | ${(100 * r.wins / r.fights).toFixed(0)}% | ${(r.rounds / r.fights).toFixed(1)} | ${r.wins ? (r.hp / r.wins).toFixed(0) + '%' : '-'} | ${(r.struck / r.fights).toFixed(2)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
