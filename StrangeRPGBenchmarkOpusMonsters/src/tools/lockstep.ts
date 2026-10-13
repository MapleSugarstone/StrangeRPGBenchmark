// Plays AI battles through two lockstep copies of one online match and checks after every decision that both copies hold the
// same battle. Each side brings a roster of six and picks four, and some picks run out of time. Each copy sees the battle from
// its own side, and the second copy draws snapshots for the speed lanes as the battle screen does. Then it rebuilds each battle
// from its rosters, picks, and record in a fresh copy with cold AI caches the way a reloaded page would and checks that copy at
// every decision too. Some battles carry the kinds that rewind, foresee, measure, call a reserve, or grow Layers, and some let
// one side time out at every decision. A kind named third goes on both rosters and into both picks in every battle, such as
// slackwater for Still Minute's rewind.
// --loop=N then plays N matches through the loopback room (src/net/loopback.ts) with a scripted client on side 1 that follows
// the protocol the battle screen follows. It checks how each match ends and that both copies and a rebuild agree at the end.
// --minute puts a whorl holding Still Minute first on both rosters and in both picks: Tynagi itself, or a fit of Tynagi and
// another kind that keeps Still Minute, so rewinds, visits in the past, and both sides going back all come up.
// Usage: node dist-tools/lockstep.js [battles] [seed] [kind] [--loop=N] [--minute] [--progress=file] [--stop=file] [--minutes=N]
// The progress file (default Notes/lockstep-progress.txt) shows battles done and an ETA. The stop file (default
// dist-tools/lockstep.stop) or the time limit ends the run after the battle in hand with a partial report.
import { answer, choose, chooseReplacement, chooseVisit } from '../battle/ai';
import { clone, legal, moveDef, out, snapOf, TAN_PER_STAT, TAN_TOTAL, visitChoices } from '../battle/engine';
import type { Action, Battle, Mon } from '../battle/model';
import { NOTION_IDS } from '../data/notions';
import { makeMon, SPECIES, WILD_KINDS } from '../data/species';
import { minuteHolder } from './minute';
import { randomFit } from '../game/wildfit';
import { aiPick, aiRoster, loopback, loopFaults } from '../net/loopback';
import { BUILD, chooses, Foul, Lockstep, passiveAction, rebuild, sameNeed, stateHash, teamsFromPicks, type Choice, type Need, type PickRelease, type Release } from '../net/lockstep';
import type { EndMsg, MatchMsg, PeekMsg } from '../net/protocol';
import { pickProblems, ROSTER_SIZE, teamProblems, TEAM_SIZE, wireFromMon, type WireMon } from '../net/wire';
import { clearStop, progressHead, runCtl, writeText } from './runctl';

declare const process: { argv: string[]; exitCode: number };

const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const N = Number(pos[0] || 200);
let seed = Number(pos[1] || 1);
const always = pos[2] && SPECIES[pos[2]] ? [pos[2]] : [];
const LOOPS = Number(args.find(a => a.startsWith('--loop='))?.slice(7) || 0);
const MINUTE = args.includes('--minute');
const ctl = runCtl(args, 'lockstep');
clearStop(ctl);
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

const WILD = WILD_KINDS.filter(k => !SPECIES[k].person);
const LEGENDS = Object.values(SPECIES).filter(s => s.legendary && !s.person).map(s => s.id);
/** Kinds with a mechanic that tests lockstep: a rewind, foresight, Measure, a called reserve, and Layers. */
const SPECIAL = ['slackwater', 'image', 'perigee', 'astrolabe', 'cairn', 'kipper', 'actinia', 'mundane'].filter(k => SPECIES[k]);

/** Twelve layers of nacre on the attack stat and HP as practice plans them. */
function kit(m: Mon): Mon {
  m.tan = { [m.basic === 'P' ? 'atk' : 'mgk']: TAN_PER_STAT, hp: TAN_TOTAL - TAN_PER_STAT };
  if (m.kind === 'carcanet') m.tape = Array.from({ length: 4 }, () => pick(['p', 'a', 'g', 's'])).join('');
  return m;
}

/** A roster of six under the online rules with about half of it fits, a different notion on each whorl, and the kinds in `force` placed first when the rules allow. */
function roster(force: string[]): Mon[] {
  const out = whorls(force), notions = NOTION_IDS.slice();
  for (const m of out) m.notion = notions.splice(Math.floor(rnd() * notions.length), 1)[0] ?? null;
  return out;
}

function whorls(force: string[]): Mon[] {
  const used = new Set<string>(), out: Mon[] = [];
  let legend = false;
  const free = (k: string) => !used.has(k) && !(legend && SPECIES[k].legendary);
  const take = (k: string) => { used.add(k); if (SPECIES[k].legendary) legend = true; };
  if (MINUTE) {
    const m = minuteHolder(rnd, WILD.filter(k => !SPECIES[k].legendary && k !== 'slackwater'));
    for (const k of m.parentKinds || [m.kind]) take(k);
    out.push(kit(m));
  }
  for (const k of force) if (out.length < ROSTER_SIZE && free(k)) { take(k); out.push(kit(makeMon(k, 50))); }
  while (out.length < ROSTER_SIZE) {
    const k = pick(rnd() < 0.08 ? LEGENDS : WILD);
    if (!free(k)) continue;
    if (rnd() < 0.5) {
      const k2 = pick(WILD);
      if (k2 === k || !free(k2)) continue;
      take(k); take(k2);
      out.push(kit(randomFit(rnd, k, k2, 50)));
    } else { take(k); out.push(kit(makeMon(k, 50))); }
  }
  return out;
}

/** With --minute, Still Minute itself more often than the AI would pick it, whenever the side's out whorl may cast it. */
function minuteOf(b: Battle, side: 0 | 1): Action | null {
  if (!MINUTE) return null;
  const a = legal(b, side).find(x => x.k === 'move' && moveDef(out(b, side), x.i)?.id === 'slackwater_minute');
  return a && rnd() < 0.6 ? a : null;
}

/** The visitor's choice in the past: the AI's, or with --minute often any choice it has, so swaps, targets, and options come up. */
function visitPick(b: Battle, side: 0 | 1): Action {
  const vs = visitChoices(b);
  return MINUTE && vs.length > 1 && rnd() < 0.5 ? vs[Math.floor(rnd() * vs.length)] : chooseVisit(clone(b), side);
}

/** The AI's choices for a decision made on copies so that only the release touches the battle. */
function aiChoices(b: Battle, need: Need): [Choice, Choice] {
  if (need.kind === 'replace') return need.side === 0 ? [chooseReplacement(clone(b), 0), null] : [null, chooseReplacement(clone(b), 1)];
  if (need.kind === 'visit') return need.side === 0 ? [visitPick(b, 0), null] : [null, visitPick(b, 1)];
  if (need.kind === 'replace2') return [chooseReplacement(clone(b), 0), chooseReplacement(clone(b), 1)];
  if (need.kind === 'act') return need.side === 0 ? [minuteOf(b, 0) ?? choose(clone(b), 0), null] : [null, minuteOf(b, 1) ?? choose(clone(b), 1)];
  if (need.kind !== 'joint') return [null, null];
  if (need.sees === null) return [minuteOf(b, 0) ?? choose(clone(b), 0), minuteOf(b, 1) ?? choose(clone(b), 1)];
  const other = (1 - need.sees) as 0 | 1, theirs = choose(clone(b), other);
  const mine = answer(clone(b), need.sees, theirs);
  return need.sees === 0 ? [mine, theirs] : [theirs, mine];
}

const choosers = (need: Need): [boolean, boolean] => [chooses(need, 0), chooses(need, 1)];

/** A pick of four from six with the lead first: the listed first four in a new order, any four, or null for a player whose time ran out. */
function pickFor(): number[] | null {
  const r = rnd();
  if (r < 0.1) return null;
  const idx = Array.from({ length: ROSTER_SIZE }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const p = r < 0.55 ? idx.filter(i => i < TEAM_SIZE) : idx.slice(0, TEAM_SIZE);
  // The kind named on the command line, or the whorl holding Still Minute, sits first on every roster and must reach the battle.
  if ((always.length || MINUTE) && !p.includes(0)) p[TEAM_SIZE - 1] = 0;
  return p;
}

const count: Record<string, number> = {};
const tally = (k: string, n = 1) => { count[k] = (count[k] || 0) + n; };
const drifts: string[] = [];
let battles = 0, matches = 0, lastWrite = 0;
const t0 = Date.now();
const total = N + LOOPS;

function progress(force = false): void {
  if (!force && Date.now() - lastWrite < 3000) return;
  lastWrite = Date.now();
  const state = force ? (ctl.halted() ? 'stopped early' : 'finished') : 'running';
  writeText(ctl.progress, `${progressHead(ctl, battles + matches, total, state)}\n${drifts.length} drifted or failed so far\n`);
}

for (let g = 0; g < N && !ctl.halted(); g++) {
  const startSeed = seed;
  const force = (side: 0 | 1) => [...always, ...(g % 3 === side ? [SPECIAL[(g + side) % SPECIAL.length], SPECIAL[(g * 7 + 3) % SPECIAL.length]] : [])];
  const rosters = [roster(force(0)), roster(force(1))].map(t => t.map(wireFromMon)) as [WireMon[], WireMon[]];
  for (const t of rosters) for (const p of teamProblems(t)) drifts.push(`battle ${g} (seed ${startSeed}): generated roster refused: ${p}`);
  const picks: [number[] | null, number[] | null] = [pickFor(), pickFor()];
  for (const p of picks) if (p) for (const q of pickProblems(p)) drifts.push(`battle ${g} (seed ${startSeed}): generated pick refused: ${q}`);
  const pickRel: PickRelease = { picks, timeout: [picks[0] === null, picks[1] === null] };
  tally('pick timeouts', +pickRel.timeout[0] + +pickRel.timeout[1]);
  const names: [string, string] = ['Ouro', 'Tellin'];
  const teams = teamsFromPicks(rosters, pickRel);
  const A = new Lockstep(teams, names, 0), B = new Lockstep(teams, names, 1);
  // B attaches a snapshot to every event and takes one at every decision the way the battle screen does.
  B.b.lanes = true;
  // Every tenth battle one side lets its clock run out at every decision so the passive action answers every kind of decision.
  const idle: 0 | 1 | null = g % 10 === 9 ? (Math.floor(g / 10) % 2 === 0 ? 0 : 1) : null;
  const record: Release[] = [], hashes: string[] = [], went = [false, false];
  let note = '', rewound = false;
  try {
    for (let step = 0; step < 1000; step++) {
      const na = A.next(), nb = B.next();
      snapOf(B.b);
      const ha = stateHash(A.b), hb = stateHash(B.b);
      if (!sameNeed(na, nb) || ha !== hb) { note = `copies differ at decision ${A.n}: ${JSON.stringify(na)} ${ha} against ${JSON.stringify(nb)} ${hb}`; break; }
      hashes.push(ha);
      if (na.kind === 'over') { tally(na.stalled ? 'stalled' : 'finished'); break; }
      tally(na.kind);
      if (na.kind === 'joint' && na.sees !== null) tally('foresight');
      const c = aiChoices(A.b, na), who = choosers(na);
      const timeout: [boolean, boolean] = [who[0] && (idle === 0 || rnd() < 0.04), who[1] && (idle === 1 || rnd() < 0.04)];
      tally('timeouts', +timeout[0] + +timeout[1]);
      for (const sd of [0, 1] as const) if (who[sd] && (c[sd] as Action | null)?.k === 'wait' && !timeout[sd] && na.kind !== 'visit') tally('measure');
      if (na.kind === 'visit') { went[na.side] = true; if (timeout[na.side]) tally('visit timeouts'); }
      const rel: Release = { n: A.n, need: na, c, timeout };
      record.push(rel);
      A.apply(rel);
      B.apply(rel);
      if (A.b.ev.some(e => e.e === 'rewind')) rewound = true;
      if (A.b.ev.some(e => e.e === 'ship' && e.at === 'trade')) tally('stayed');
      A.b.ev.length = 0;
      B.b.ev.length = 0;
    }
  } catch (e) {
    note = e instanceof Foul ? `foul at decision ${A.n}: ${e.message}` : `threw at decision ${A.n}: ${(e as Error).stack || e}`;
  }
  // The record replays on a fresh copy from the other side's view with cold caches and is checked at every decision. Then
  // `rebuild` runs the whole path a reloaded page takes, from the rosters and the picks, and must end on the same battle.
  if (!note) {
    const R = new Lockstep(teamsFromPicks(rosters, pickRel), names, 1);
    try {
      for (let i = 0; i <= record.length && !note; i++) {
        R.next();
        if (stateHash(R.b) !== hashes[i]) note = `rebuild differs at decision ${i}`;
        else if (i < record.length) { R.apply(record[i]); R.b.ev.length = 0; }
      }
      if (!note && stateHash(rebuild(rosters, names, 0, pickRel, record).b) !== hashes[record.length]) note = 'a full rebuild ends on a different battle';
    } catch (e) {
      note = `rebuild threw at decision ${R.n}: ${(e as Error).message}`;
    }
  }
  if (note) drifts.push(`battle ${g} (seed ${startSeed}): ${note}`);
  if (rewound) tally('rewound');
  if (went[0] && went[1]) tally('both rewound');
  if (idle !== null) tally('idle');
  tally('decisions', record.length);
  battles++;
  progress();
}

// ---------------------------------------------------------------- loopback matches

/** How the scripted side 1 plays a loopback match: a pick that runs out of time, a resignation, and an AI that never chooses. */
interface Script { lazyPick: boolean; resignAt: number; idleAi: boolean; lag: number }

/** Plays one loopback match as side 1 the way the battle screen does: report each decision, choose on copies, and apply each release in order. */
function loopMatch(k: number, s: Script): string | null {
  const link = loopback({ seed: 1000 + k, lag: s.lag, think: [5, 40], idle: s.idleAi });
  const mine = MINUTE ? roster([]).map(wireFromMon) : aiRoster(rnd);
  link.send({ type: 'hello', build: BUILD, name: 'Tellin', roster: mine });
  let match: MatchMsg | null = null, picked: PickRelease | null = null, ls: Lockstep | null = null, end: EndMsg | null = null, peek: PeekMsg | null = null;
  let held: Release[] = [], reported = -1, chosen = -1, pickAt = -1, think = 0, timeouts = 0, skip = false, resigned = false;
  for (let f = 0; f < 400000 && !end; f++) {
    link.tick();
    for (let m = link.poll(); m; m = link.poll()) {
      if (m.type === 'match') {
        match = m;
        const bad = teamProblems(m.rosters[0]);
        if (bad.length) return `match ${k}: the AI's roster was refused: ${bad[0]}`;
        pickAt = s.lazyPick ? -1 : f + Math.floor(rnd() * 600);
      } else if (m.type === 'picked' && match) {
        picked = { picks: m.picks, timeout: m.timeout };
        if (s.lazyPick && !m.timeout[1]) return `match ${k}: a pick never sent did not time out`;
        ls = new Lockstep(teamsFromPicks(match.rosters, picked), match.names, 1);
        ls.b.lanes = true;
      } else if (m.type === 'release') held.push(m);
      else if (m.type === 'peek') peek = m;
      else if (m.type === 'end') end = m;
    }
    if (match && f === pickAt) {
      const order = aiPick(match.rosters[1], match.rosters[0]);
      if (MINUTE && !order.includes(0)) order[TEAM_SIZE - 1] = 0;
      link.send({ type: 'pick', order });
    }
    if (!ls) continue;
    for (let rel = held.find(r => r.n === ls!.n); rel; rel = held.find(r => r.n === ls!.n)) {
      try { ls.apply(rel); } catch (e) { return `match ${k}: side 1 refused release ${rel.n}: ${(e as Error).message}`; }
      ls.b.ev.length = 0;
      held = held.filter(r => r !== rel);
      peek = null;
      if (rel.timeout[1]) timeouts++;
    }
    if (end) break;
    const need = ls.next();
    ls.b.ev.length = 0;
    snapOf(ls.b);
    // About one choice in twenty-five is never sent, so the room's clock answers it.
    if (reported < ls.n) { reported = ls.n; link.send({ type: 'ready', n: ls.n, hash: stateHash(ls.b), need }); think = 5 + Math.floor(rnd() * 60); skip = rnd() < 0.04; }
    if (s.resignAt === ls.n && !resigned) { link.send({ type: 'resign' }); resigned = true; continue; }
    if (resigned || chosen >= ls.n || !chooses(need, 1)) continue;
    if (need.kind === 'joint' && need.sees === 1 && peek?.n !== ls.n) continue;
    if (skip) { chosen = ls.n; continue; }
    if (--think > 0) continue;
    const b = ls.b;
    const c: Choice = need.kind === 'replace' || need.kind === 'replace2' ? chooseReplacement(clone(b), 1)
      : need.kind === 'visit' ? visitPick(b, 1)
      : need.kind === 'joint' && need.sees === 1 && peek ? answer(clone(b), 1, peek.timeout ? passiveAction(b, 0) : (peek.c as Action)) : minuteOf(b, 1) ?? choose(clone(b), 1);
    link.send({ type: 'choose', n: ls.n, c });
    chosen = ls.n;
  }
  if (!end) return `match ${k}: no end after 400000 frames at decision ${ls?.n}`;
  tally(`end ${end.why}`);
  tally('loop decisions', ls?.n ?? 0);
  tally('loop timeouts', timeouts);
  const room = link.room;
  if (end.why === 'void') return `match ${k}: ended with no result at decision ${ls?.n}`;
  if (resigned && (end.why !== 'resign' || end.winner !== 0)) return `match ${k}: a resignation ended as ${end.why}`;
  if (s.idleAi && end.why === 'over') return `match ${k}: an AI that never chose still finished the battle`;
  if (ls && picked && room.ai.ls) {
    // The room may have queued the last release for the AI when side 1 read the end, so the AI catches up first.
    for (let i = 0; i < 30 && room.ai.ls.n < room.record.length; i++) link.tick();
    // Both copies run on to the decision after the last release the way each screen does before it reports.
    ls.next();
    room.ai.ls.next();
    const h = stateHash(ls.b);
    if (stateHash(room.ai.ls.b) !== h) return `match ${k}: the two copies end on different battles`;
    if (stateHash(rebuild(match!.rosters, match!.names, 1, picked, room.record).b) !== h) return `match ${k}: a rebuild from the room's record ends on a different battle`;
  }
  return null;
}

for (let k = 0; k < LOOPS && !ctl.halted(); k++) {
  const s: Script = { lazyPick: k % 7 === 3, resignAt: k % 9 === 4 ? 3 + Math.floor(rnd() * 12) : -1, idleAi: k % 11 === 6, lag: Math.floor(rnd() * 8) };
  let note: string | null;
  try { note = loopMatch(k, s); } catch (e) { note = `match ${k} threw: ${(e as Error).stack || e}`; }
  if (note) drifts.push(note);
  matches++;
  progress();
}
progress(true);

const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (battles < N || matches < LOOPS) console.log(`PARTIAL: stopped early after ${battles} of ${N} battles and ${matches} of ${LOOPS} loopback matches.`);
console.log(`build ${BUILD}: ${battles} battles of four picked from six in ${secs} s, ${count.decisions || 0} decisions (${((count.decisions || 0) / Math.max(1, battles)).toFixed(1)} a battle), ${count['pick timeouts'] || 0} picks timed out`);
console.log(`joint ${count.joint || 0}, with foresight ${count.foresight || 0}, solo ${count.act || 0}, Measure ${count.measure || 0}, replace ${count.replace || 0}, double replace ${count.replace2 || 0}`);
console.log(`timeouts ${count.timeouts || 0} (${count.idle || 0} battles with one side idle throughout), battles with a rewind ${count.rewound || 0}, finished ${count.finished || 0}, stalled ${count.stalled || 0}`);
console.log(`visits in the past ${count.visit || 0} (${count['visit timeouts'] || 0} timed out), battles where both sides went back ${count['both rewound'] || 0}, visitors that stayed by a swap ${count.stayed || 0}`);
if (LOOPS) {
  const ends = Object.keys(count).filter(x => x.startsWith('end ')).map(x => `${x.slice(4)} ${count[x]}`).join(', ');
  console.log(`loopback: ${matches} matches, ${count['loop decisions'] || 0} decisions, ${count['loop timeouts'] || 0} side 1 timeouts, ended by ${ends || 'nothing'}`);
}
for (const d of drifts.slice(0, 12)) console.log('DRIFT: ' + d);
// A message the loopback room's readers refused is one the real room or a real client would refuse too.
for (const f of loopFaults.slice(0, 6)) console.log('REFUSED: ' + f);
console.log(`${drifts.length} battles or matches drifted or failed, and the readers refused ${loopFaults.length} messages`);
if (drifts.length || loopFaults.length) process.exitCode = 1;
