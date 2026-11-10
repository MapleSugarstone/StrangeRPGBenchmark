// Headless balance simulator. Usage: node dist-tools/sim.js [mode] [--n=200] [--season=4] [--time=600] [--tag=name]
// Modes: seasons (default), skill, fights. Writes Notes/sim-<mode>.md, and Notes/sim-progress.json while it runs.
// Create Notes/sim-stop to end a run early. The report then covers the games finished so far.
import fs from 'node:fs';
import path from 'node:path';
import type { CharId, Charter, State } from '../rules/types';
import { CHARS, CHAR_NAME, KINDS, LAW_OF, LOCALS } from '../rules/data';
import { apply, newSeason } from '../rules/engine';
import type { SeatSpec } from '../rules/engine';
import { PROFILES, decide } from '../rules/ai';
import type { Profile } from '../rules/ai';
import { counts, ownCounts, pegsPlaced, standing } from '../rules/board';
import { BLANK, FIXED, OPEN } from '../rules/types';
import { fightReport } from './fightsim';
import { choosePerk, closeSeason, newCampaign, startSeason } from '../rules/campaign';

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith('--')) ?? 'seasons';
const opt = (name: string, def: number): number => {
  const a = args.find((x) => x.startsWith('--' + name + '='));
  return a ? Number(a.split('=')[1]) : def;
};
const tag = (args.find((x) => x.startsWith('--tag=')) ?? '--tag=').split('=')[1];
const notes = path.resolve('Notes');
const progressFile = path.join(notes, 'sim-progress.json');
const stopFile = path.join(notes, 'sim-stop');
const started = Date.now();
const timeLimit = opt('time', 900) * 1000;
let lastWrite = 0;

function progress(done: number, total: number, extra: unknown): boolean {
  const now = Date.now();
  if (now - lastWrite > 3000 || done === total) {
    lastWrite = now;
    const elapsed = (now - started) / 1000;
    fs.writeFileSync(progressFile, JSON.stringify({ mode, done, total, elapsedSec: Math.round(elapsed), etaSec: done ? Math.round((elapsed / done) * (total - done)) : null, partial: extra }, null, 1));
  }
  return fs.existsSync(stopFile) || now - started > timeLimit;
}

interface GameStats {
  winner: CharId; by: string; comps: number; filed: number; inkEnd: number; doubtEnd: number; claim: string | null; fights: Record<string, number>; backers: number; holderWon: boolean; margin: number; leadChanges: number; comeback: boolean; kingmade: boolean;
  deals: number; refused: number; kept: number; broken: number; contests: number; objections: number; unmeasures: number;
  sketched: number; fixed: number; winnerPegs: number; actions: Record<string, Record<string, number>>; rank: CharId[]; actsPerTurn: number;
  ms: number;
}

function playSeason(seed: number, season: number, chars: CharId[], holder: number, charter: Charter, profiles: (Profile | null)[]): GameStats {
  const seats: SeatSpec[] = chars.map((c) => ({ char: c, human: false }));
  const deck = LOCALS.filter((l) => !l.reserve || season >= 4).map((l) => l.id);
  const t0 = Date.now();
  const s: State = newSeason({ seed, season, seats, holder, charter, law: holder >= 0 ? LAW_OF[chars[holder]] : 'none', deck, difficulty: 1 });
  let midLeader = -1, acts = 0;
  for (let i = 0; i < 20000 && !s.over; i++) {
    if (midLeader < 0 && s.round > Math.ceil(s.rounds / 2)) midLeader = standing(s).winner;
    apply(s, decide(s, profiles));
    acts++;
  }
  if (!s.over) throw new Error('season did not end, seed ' + seed);
  const r = s.result!;
  const own = ownCounts(s), cnt = counts(s);
  const sortedOwn = own.slice().sort((a, b) => b - a);
  let ownBest = 0;
  for (let i = 1; i < own.length; i++) if (own[i] > own[ownBest]) ownBest = i;
  const sorted = cnt.slice().sort((a, b) => b - a);
  const sum = (f: (p: State['players'][0]) => number) => s.players.reduce((n, p) => n + f(p), 0);
  const actions: Record<string, Record<string, number>> = {};
  for (const p of s.players) actions[p.char] = p.stats.actions;
  return {
    winner: s.players[r.winner].char, by: r.by, comps: sum((p) => p.ret.length) / s.players.length, inkEnd: sum((p) => p.ink) / s.players.length, doubtEnd: sum((p) => p.doubt) / s.players.length, filed: s.players.filter((p) => p.filed).length, claim: r.claim, backers: s.players.filter((p) => p.backs >= 0).length, fights: { den: sum((p) => p.stats.actions.fight_den ?? 0), peg: sum((p) => p.stats.actions.fight_peg ?? 0), pawn: sum((p) => p.stats.actions.fight_pawn ?? 0), won: sum((p) => p.stats.contestsWon) }, holderWon: r.winner === holder, margin: sorted[0] - (sorted[1] ?? 0), leadChanges: s.leadChanges,
    comeback: midLeader >= 0 && midLeader !== r.winner, kingmade: r.by === 'charter' && r.deputies.length > 0 && own[r.winner] < sortedOwn[0],
    deals: sum((p) => p.stats.dealsMade) / 2, refused: sum((p) => p.stats.dealsRefused), kept: sum((p) => p.stats.promisesKept), broken: sum((p) => p.stats.promisesBroken),
    contests: sum((p) => p.stats.contests), objections: sum((p) => p.stats.objections), unmeasures: sum((p) => p.stats.unmeasures),
    sketched: s.tiles.filter((t) => t.st !== BLANK).length - 7, fixed: s.tiles.filter((t) => t.st === FIXED && !t.official).length,
    winnerPegs: pegsPlaced(s.players[r.winner]), actions, rank: r.rank.map((i) => s.players[i].char), actsPerTurn: acts / (s.rounds * s.players.length),
    ms: Date.now() - t0,
  };
}

function pct(n: number, d: number): string { return d ? (100 * n / d).toFixed(0) + '%' : '-'; }
function avg(list: number[]): string { return list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(2) : '-'; }

function entropy(h: Record<string, number>): number {
  const total = Object.values(h).reduce((a, b) => a + b, 0);
  let e = 0;
  for (const v of Object.values(h)) if (v > 0) e -= (v / total) * Math.log2(v / total);
  return e;
}

function runSeasons(): string {
  const n = opt('n', 200);
  const only = opt('season', 0);
  const seasons = only ? [only] : [2, 3, 4, 5, 6];
  const lines: string[] = ['# Season simulation', '', `Games per season: ${n}. Four computer seats at normal difficulty. Seats, holder, and Charter rotate.`, ''];
  const total = n * seasons.length;
  let done = 0, stopped = false;
  for (const season of seasons) {
    const games: GameStats[] = [];
    const wins: Record<string, number> = {}, played: Record<string, number> = {}, rankSum: Record<string, number> = {};
    const acts: Record<string, Record<string, number>> = {};
    const holderGames: Record<string, number> = {}, holderWins: Record<string, number> = {};
    for (let g = 0; g < n; g++) {
      const pool = CHARS.slice();
      const off = g % pool.length;
      const chars: CharId[] = [];
      for (let i = 0; i < 4; i++) chars.push(pool[(off + i * (1 + (Math.floor(g / pool.length) % 2))) % pool.length]);
      const uniq = Array.from(new Set(chars));
      while (uniq.length < 4) for (const c of pool) if (!uniq.includes(c) && uniq.length < 4) uniq.push(c);
      const holder = g % 5 === 4 ? -1 : g % 4;
      const charter: Charter = g % 3 === 0 ? 'acres' : KINDS[g % 4];
      const st = playSeason(1000 + g * 7919 + season * 101, season, uniq, holder, charter, []);
      games.push(st);
      for (const c of uniq) { played[c] = (played[c] ?? 0) + 1; rankSum[c] = (rankSum[c] ?? 0) + st.rank.indexOf(c) + 1; }
      wins[st.winner] = (wins[st.winner] ?? 0) + 1;
      if (holder >= 0) { const h = uniq[holder]; holderGames[h] = (holderGames[h] ?? 0) + 1; if (st.holderWon) holderWins[h] = (holderWins[h] ?? 0) + 1; }
      for (const [c, h] of Object.entries(st.actions)) { acts[c] = acts[c] ?? {}; for (const [k, v] of Object.entries(h)) acts[c][k] = (acts[c][k] ?? 0) + v; }
      done++;
      if (progress(done, total, { season, wins })) { stopped = true; break; }
    }
    const G = games.length;
    lines.push(`## Season ${season} rules (${G} games${stopped ? ', partial' : ''})`, '');
    lines.push('| Rival | Win rate when seated | Average rank | As holder | Action entropy | Top actions |', '|---|---|---|---|---|---|');
    for (const c of CHARS) {
      const h = acts[c] ?? {};
      const top = Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pct(v, Object.values(h).reduce((a, b) => a + b, 0))}`).join(', ');
      lines.push(`| ${CHAR_NAME[c]} | ${pct(wins[c] ?? 0, played[c] ?? 0)} | ${played[c] ? (rankSum[c] / played[c]).toFixed(2) : '-'} | ${pct(holderWins[c] ?? 0, holderGames[c] ?? 0)} | ${entropy(h).toFixed(2)} | ${top} |`);
    }
    const holderAll = games.filter((x) => x.holderWon).length;
    lines.push('', '| Measure | Value |', '|---|---|');
    lines.push(`| Holder wins | ${pct(holderAll, Object.values(holderGames).reduce((a, b) => a + b, 0))} |`);
    lines.push(`| Won by claim | ${pct(games.filter((x) => x.by === 'claim').length, G)} |`);
    lines.push(`| Decided by 1 or less | ${pct(games.filter((x) => x.margin <= 1).length, G)} |`);
    lines.push(`| Average margin | ${avg(games.map((x) => x.margin))} |`);
    lines.push(`| Lead changes per sheet | ${avg(games.map((x) => x.leadChanges))} |`);
    lines.push(`| Winner was not leading at the midpoint | ${pct(games.filter((x) => x.comeback).length, G)} |`);
    lines.push(`| Backing decided the winner | ${pct(games.filter((x) => x.kingmade).length, G)} |`);
    lines.push(`| Deals made per sheet | ${avg(games.map((x) => x.deals))} |`);
    lines.push(`| Deals refused per sheet | ${avg(games.map((x) => x.refused))} |`);
    lines.push(`| Promises kept, broken per sheet | ${avg(games.map((x) => x.kept))}, ${avg(games.map((x) => x.broken))} |`);
    lines.push(`| Fights per sheet: den, peg, pawn, attacker won | ${avg(games.map((x) => x.fights.den))}, ${avg(games.map((x) => x.fights.peg))}, ${avg(games.map((x) => x.fights.pawn))}, ${avg(games.map((x) => x.fights.won))} |`);
    lines.push(`| Companions per party at the close, claims filed per sheet | ${avg(games.map((x) => x.comps))}, ${avg(games.map((x) => x.filed))} |`);
    lines.push(`| Ink, doubt held per party at the close | ${avg(games.map((x) => x.inkEnd))}, ${avg(games.map((x) => x.doubtEnd))} |`);
    lines.push(`| Backers at the close | ${avg(games.map((x) => x.backers))} |`);
    { const tally: Record<string, number> = {}; for (const x of games) if (x.claim) tally[x.claim] = (tally[x.claim] ?? 0) + 1; lines.push(`| Winning claims | ${Object.entries(tally).map(([k, v]) => k + ' ' + v).join(', ') || 'none'} |`); }
    lines.push(`| Objections, unmeasures per sheet | ${avg(games.map((x) => x.objections))}, ${avg(games.map((x) => x.unmeasures))} |`);
    lines.push(`| Tiles sketched, fixed (of 42) | ${avg(games.map((x) => x.sketched))}, ${avg(games.map((x) => x.fixed))} |`);
    lines.push(`| Winner's pegs | ${avg(games.map((x) => x.winnerPegs))} |`);
    lines.push(`| Actions per turn | ${avg(games.map((x) => x.actsPerTurn))} |`);
    lines.push(`| Milliseconds per sheet | ${avg(games.map((x) => x.ms))} |`, '');
    if (stopped) break;
  }
  return lines.join('\n');
}

function runSkill(): string {
  const n = opt('n', 120);
  const lines: string[] = ['# Skill gap', '', `Perch is played by a scripted profile against three normal rivals. ${n} sheets per cell.`, '', '| Season | Profile | Win | Average rank |', '|---|---|---|---|'];
  const profs = ['novice', 'competent', 'expert'];
  const seasons = [2, 3, 4, 5, 6];
  const total = n * profs.length * seasons.length;
  let done = 0;
  outer: for (const season of seasons) {
    for (const pn of profs) {
      let win = 0, rank = 0, G = 0;
      for (let g = 0; g < n; g++) {
        const rivals = CHARS.filter((c) => c !== 'perch');
        const pick: CharId[] = ['perch'];
        for (let i = 0; i < 3; i++) pick.push(rivals[(g + i * (1 + (g % 2))) % rivals.length]);
        const uniq = Array.from(new Set(pick));
        for (const c of rivals) if (uniq.length < 4 && !uniq.includes(c)) uniq.push(c);
        const holder = 1 + (g % 3);
        const charter: Charter = g % 3 === 0 ? 'acres' : KINDS[g % 4];
        const st = playSeason(5000 + g * 104729 + season * 13, season, uniq, holder, charter, [PROFILES[pn], null, null, null]);
        G++;
        if (st.winner === 'perch') win++;
        rank += st.rank.indexOf('perch') + 1;
        done++;
        if (progress(done, total, { season, pn, win, G })) { lines.push(`| ${season} | ${pn} | ${pct(win, G)} | ${(rank / G).toFixed(2)} partial |`); break outer; }
      }
      lines.push(`| ${season} | ${pn} | ${pct(win, G)} | ${(rank / G).toFixed(2)} |`);
    }
  }
  return lines.join('\n');
}

function runCampaigns(): string {
  const n = opt('n', 60);
  const profs = ['novice', 'competent', 'expert'];
  const lines: string[] = ['# Campaign simulation', '', `Perch is played by a scripted profile through all six sheets against normal rivals. ${n} campaigns per profile. Story choices are not simulated.`, ''];
  const total = n * profs.length;
  let done = 0, stopped = false;
  for (const pn of profs) {
    const winsBySeason = [0, 0, 0, 0, 0, 0, 0], depBySeason = [0, 0, 0, 0, 0, 0, 0], rankBySeason = [0, 0, 0, 0, 0, 0, 0];
    const finals: Record<string, number> = {}, lineups = new Set<string>(), holdersPer: number[] = [], renown: number[] = [], perchWins: number[] = [];
    const traits: Record<string, number> = {}, charters: Record<string, number> = {};
    let G = 0;
    for (let g = 0; g < n; g++) {
      const c = newCampaign(9000 + g * 7919, 1);
      const holders = new Set<string>();
      while (c.season <= 6) {
        const season = c.season;
        const s = startSeason(c, false);
        const profiles = s.players.map((p) => (p.char === 'perch' ? PROFILES[pn] : null));
        lineups.add(season + ':' + c.seats.slice().sort().join(','));
        charters[c.charter] = (charters[c.charter] ?? 0) + 1;
        for (let i = 0; i < 30000 && !s.over; i++) apply(s, decide(s, profiles));
        if (!s.over) throw new Error('campaign sheet did not end');
        const sum = closeSeason(c, s);
        holders.add(sum.winner);
        if (sum.winner === 'perch') winsBySeason[season]++;
        if (sum.deputy) depBySeason[season]++;
        rankBySeason[season] += sum.perchRank;
        for (const t of sum.newTraits) traits[t.trait] = (traits[t.trait] ?? 0) + 1;
        if (c.choices && c.choices.perks.length) choosePerk(c, c.choices.perks[0]);
        if (season === 6) finals[sum.winner] = (finals[sum.winner] ?? 0) + 1;
      }
      G++;
      holdersPer.push(holders.size);
      renown.push(c.renown);
      perchWins.push(c.wins);
      done++;
      if (progress(done, total, { pn, G })) { stopped = true; break; }
    }
    lines.push(`## Perch played as ${pn} (${G} campaigns${stopped ? ', partial' : ''})`, '', '| Sheet | Perch wins | Perch is Deputy | Average rank |', '|---|---|---|---|');
    for (let s = 1; s <= 6; s++) lines.push(`| ${s} | ${pct(winsBySeason[s], G)} | ${pct(depBySeason[s], G)} | ${(rankBySeason[s] / G).toFixed(2)} |`);
    lines.push('', '| Measure | Value |', '|---|---|');
    lines.push(`| Sheets won per campaign | ${avg(perchWins)} |`);
    lines.push(`| Renown per campaign | ${avg(renown)} |`);
    lines.push(`| Different holders per campaign | ${avg(holdersPer)} |`);
    lines.push(`| Different seat lineups seen | ${lineups.size} |`);
    lines.push(`| Who closed sheet 6 | ${Object.entries(finals).map(([k, v]) => k + ' ' + pct(v, G)).join(', ')} |`);
    lines.push(`| Charters played | ${Object.entries(charters).map(([k, v]) => k + ' ' + v).join(', ')} |`);
    lines.push(`| Traits rivals gained | ${Object.entries(traits).map(([k, v]) => k + ' ' + v).join(', ') || 'none'} |`, '');
    if (stopped) break;
  }
  return lines.join('\n');
}

fs.mkdirSync(notes, { recursive: true });
if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
let report = '';
if (mode === 'seasons') report = runSeasons();
else if (mode === 'skill') report = runSkill();
else if (mode === 'fights') report = fightReport(opt('n', 1));
else if (mode === 'campaign') report = runCampaigns();
else throw new Error('unknown mode ' + mode);
const out = path.join(notes, `sim-${mode}${tag ? '-' + tag : ''}.md`);
fs.writeFileSync(out, report + '\n');
progress(1, 1, { done: true, out });
console.log(report);
console.log('\nWrote ' + out + ' in ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
void OPEN;
