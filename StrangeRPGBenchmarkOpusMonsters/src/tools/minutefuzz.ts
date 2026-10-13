// Fuzzes Still Minute: AI battles where Tynagi or a fit that keeps Still Minute stands on one or both teams, beside kinds
// that copy, take, snatch, echo, trade bodies, banish, bury, hide, store away, set fields, or summon. Still Minute is picked
// often, the visitor's choice in the past is often any choice it has (swaps, targets, options), and some choices time out.
// It stops a battle at a crash, a broken state, a stuck battle, or a Still Minute that comes back after being spent, and
// counts how often each case of Notes/still-minute.md came up.
// Usage: node <bundle> [seed] [battles] [--winders] [--progress=file] [--stop=file] [--minutes=N]
// --winders fills most team slots with kinds that wind up and picks Still Minute whenever its visitor would arrive with a
// wind-up in progress.
import { act, actJoint, advance, isLegal, legal, moveDef, newBattle, out, passiveVisit, replace, visit, visitChoices } from '../battle/engine';
import { choose, chooseReplacement, chooseVisit } from '../battle/ai';
import type { Action, Battle, Decision, Mon } from '../battle/model';
import { MOVES } from '../battle/registry';
import { SPECIES, WILD_KINDS, makeMon } from '../data/species';
import { minuteHolder } from './minute';
import { clearStop, progressHead, runCtl, writeText } from './runctl';

declare const process: { argv: string[]; exitCode: number };
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
let seed = Number(pos[0] || 1);
const N = Number(pos[1] || 300);
const ctl = runCtl(args, 'minutefuzz');
clearStop(ctl);
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const any = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

const WILD = WILD_KINDS.filter(k => SPECIES[k] && !SPECIES[k].person && !SPECIES[k].legendary && k !== 'slackwater');
/** Kinds whose kits move or cast other whorls' moves, or change the board the visitor arrives on. */
const SPICE = ['socket', 'heron', 'relic', 'saltline', 'grotto', 'undertow', 'murk', 'tain', 'skua', 'erg', 'cellar', 'leech', 'vacuole', 'image', 'cuttle', 'dish', 'heirloom', 'brinicle', 'transit', 'hyponome'].filter(k => SPECIES[k]);

/** Kinds whose own four hold a move that winds up. */
const WINDERS = WILD.filter(k => makeMon(k, 50).moves.some(id => MOVES[id]?.wu));
const winders = args.includes('--winders');

/** A team of four: maybe a Still Minute holder first, then spice and wild kinds. */
function team(minute: boolean): Mon[] {
  const out: Mon[] = [];
  if (minute) out.push(minuteHolder(rnd, WILD));
  while (out.length < 4) out.push(makeMon(winders && rnd() < 0.6 ? any(WINDERS) : rnd() < 0.5 ? any(SPICE) : any(WILD), 50));
  return out;
}

const count: Record<string, number> = {};
const tally = (k: string, n = 1) => { count[k] = (count[k] || 0) + n; };
const problems: string[] = [];
let battles = 0, lastWrite = 0;
const t0 = Date.now();

function progress(force = false): void {
  if (!force && Date.now() - lastWrite < 3000) return;
  lastWrite = Date.now();
  const state = force ? (ctl.halted() ? 'stopped early' : 'finished') : 'running';
  const seen = Object.keys(count).sort().map(k => `${k} ${count[k]}`).join(', ');
  writeText(ctl.progress, `${progressHead(ctl, battles, N, state)}\n${problems.length} problems so far\n${seen}\n${problems.slice(0, 5).join('\n')}\n`);
}

const teams = (b: Battle) => b.s.map((s, i) => `side ${i}: ` + s.f.map((f, k) => `${f.mon.kind === 'fit' ? f.mon.parentKinds!.join('+') : f.mon.kind}${k === s.out ? '*' : ''} ${f.hp}/${f.maxHp}${f.ko ? ' KO' : ''}${f.gone ? ' gone' : ''} [${f.moves.join(' ')}]`).join(', ')).join('\n');
const lines = (b: Battle) => b.ev.filter(e => e.e === 'msg').slice(-12).map(e => '  ' + (e as { text: string }).text).join('\n');

/** Whether a rewind chosen now would arrive, as beginRewind picks its arrival, at a round that opened with a wind-up in progress. */
function arrivesWithWindup(b: Battle): boolean {
  const now = Math.ceil(b.turnNo / 2);
  const st = (b.past || []).find(s => {
    const r = Math.ceil(s.turnNo / 2);
    return r >= now - 3 && r < now && (s.need.kind === 'joint' || (s.need.kind === 'act' && s.snap.waited == null));
  });
  return !!st && st.snap.pend.some(p => p.kind === 'windup');
}

/**
 * Still Minute itself when the side's out whorl may cast it, often, and otherwise the AI's choice. With --winders, always
 * Still Minute, with tide added, when going back now would arrive with a wind-up in progress.
 */
function pick(b: Battle, side: 0 | 1): Action {
  const steer = winders && !!out(b, side)?.moves.includes('slackwater_minute') && arrivesWithWindup(b);
  if (steer) b.s[side].nerve = Math.max(b.s[side].nerve, 10);
  const sm = legal(b, side).find(x => x.k === 'move' && moveDef(out(b, side), x.i)?.id === 'slackwater_minute');
  if (sm && steer) return sm;
  return sm && rnd() < 0.65 ? sm : choose(b, side);
}

for (let g = 0; g < N && !ctl.halted(); g++) {
  const startSeed = seed;
  const both = rnd() < 0.7, wild = rnd() < 0.15;
  const b = newBattle({ mons: team(true), name: 'A', ai: 'keeper' }, { mons: team(both), name: 'Z', ai: 'keeper', wild }, { nerve: true, wild, sync: true, canRun: wild });
  b.quiet = false;
  // Tide starts high now and then, so Still Minute comes early, even on the first round with no record to go back to.
  if (rnd() < 0.3) for (const s of b.s) s.nerve = 10;
  let note = '';
  const report = (what: string) => { if (!note) note = `battle ${g} (seed ${startSeed}): ${what}\n${teams(b)}\n${lines(b)}`; };
  // Every whorl's slough that has cast Still Minute, by side and uid. None of them may hold it again in any timeline.
  const spent = new Set<string>();
  const went = [false, false];
  let decisions = 0, seen = 0;
  try {
    for (let i = 0; i < 700 && !note; i++) {
      const d: Decision = advance(b, chooseReplacement);
      decisions++;
      // Broken states: HP at 0 without a knockout, a fighter out of its slot, or a down whorl asked to act.
      b.s.forEach((s, sd) => s.f.forEach((f, k) => {
        if (f.hp <= 0 && !f.ko && !f.gone) report(`step ${i}: ${f.mon.name} has ${f.hp} HP and is not down`);
        if (f.idx !== k || f.side !== sd) report(`step ${i}: ${f.mon.name} sits in slot ${sd}:${k} but says ${f.side}:${f.idx}`);
        if (!Number.isFinite(f.hp) || !Number.isFinite(s.next)) report(`step ${i}: a number is not finite`);
        if (f.moves.includes('slackwater_minute') && spent.has(`${sd}:${f.mon.uid}`)) report(`step ${i}: ${f.mon.name} holds Still Minute again after casting it`);
      }));
      if ((b.past?.length || 0) > 24) report(`step ${i}: the record holds ${b.past!.length} decisions`);
      if (d.kind !== 'over' && b.pend.some(p => p.kind === 'windup' && p.at < b.t)) report(`step ${i}: a wind-up is past its time and never landed`);
      if (d.kind === 'act' || d.kind === 'joint') for (const sd of [0, 1] as const) {
        const o = b.s[sd].f[b.s[sd].out];
        if ((d.kind === 'joint' || d.side === sd) && (!o || o.ko || o.gone)) report(`step ${i}: side ${sd} was asked to act (${d.kind}) with its out whorl down`);
      }
      if (note || d.kind === 'over') break;
      if (d.kind === 'visit') {
        went[d.side] = true;
        tally('visits');
        const v = b.visit!;
        if (v.here) tally('casts in the present, no record'); else if (v.back < 3) tally('short records'); else tally('3 rounds back');
        if (!v.here) {
          if (b.field) tally('arrivals with a field');
          if (b.s.some(s => s.sum.length)) tally('arrivals with summons');
          if (b.s.some(s => s.f.some(f => f.s.hidden))) tally('arrivals with a whorl hidden');
          if (b.s.some(s => s.f.some(f => f.form))) tally('arrivals with a form');
          if (b.s.some(s => s.f.some(f => f.gone && !f.ko))) tally('arrivals with a whorl gone');
          if (b.pend.some(p => p.kind === 'windup')) tally('arrivals with a wind-up');
          if (b.s[v.side].f[v.idx] && b.s[v.side].out !== v.idx) tally('arrivals with the caster not out');
          if (v.body.mon.fitted) tally('fit visitors');
        }
        const vs = visitChoices(b);
        if (!vs.length) report(`step ${i}: the visitor had no choice`);
        for (const a of vs) if (a.k === 'move' && (MOVES[v.body.moves[a.i]]?.nerve || MOVES[v.body.moves[a.i]]?.rewinds)) report(`step ${i}: the visitor may cast ${v.body.moves[a.i]}`);
        const r = rnd();
        // A swap or an option comes up whenever the visitor has one, so those rules get tested often.
        const odd = vs.filter(x => x.k === 'move' && (MOVES[v.body.moves[x.i]]?.tag || MOVES[v.body.moves[x.i]]?.options));
        const a = r < 0.15 ? passiveVisit(b) : odd.length && r < 0.5 ? any(odd) : r < 0.75 ? any(vs) : chooseVisit(b, d.side);
        if (r < 0.15) tally('visit timeouts');
        const m = a.k === 'move' ? MOVES[v.body.moves[a.i]] : null;
        if (m?.tag) tally('swap picks'); else if (m?.options) tally('option picks'); else if (a.k === 'move' && a.target !== undefined) tally('target picks');
        if (a.k === 'move' && a.target === v.idx && v.body.side === v.side) tally('picks on its past self');
        const winds = v.here ? [] : b.pend.filter(p => p.kind === 'windup').map(p => p.id);
        visit(b, a);
        if (winds.length && !b.pend.some(p => winds.includes(p.id))) tally('wind-ups in progress at arrival that landed or stopped');
        if (b.over === null && b.pend.some(p => p.kind === 'windup' && p.at < b.t)) report(`step ${i}: a wind-up from the past is past its time and never landed`);
        if (b.visit) report(`step ${i}: the visit did not end`);
        if (b.need?.kind === 'visit') report(`step ${i}: a visit led straight to another visit`);
      } else if (d.kind === 'act' || d.kind === 'joint') {
        // In a wild battle the player's side now and then sounds a horn, which clears the record, or runs, which ends the battle.
        if (wild && d.kind === 'act' && d.side === 0 && rnd() < 0.03) { tally('soundings and runs'); act(b, rnd() < 0.7 ? { k: 'peg', peg: 'twig' } : { k: 'run' }); }
        else if (d.kind === 'joint') {
          const a0 = pick(b, 0), a1 = pick(b, 1);
          if (!isLegal(b, 0, a0) || !isLegal(b, 1, a1)) report(`step ${i}: an illegal pick`);
          const sm = (sd: 0 | 1, a: Action) => a.k === 'move' && moveDef(out(b, sd), a.i)?.id === 'slackwater_minute';
          if (sm(0, a0) && sm(1, a1)) tally('rounds where both sides picked Still Minute');
          actJoint(b, a0, a1);
        }
        else act(b, pick(b, d.side));
      } else if (d.kind === 'replace') replace(b, d.side, chooseReplacement(b, d.side));
      // Every event since the last look, the ones the round's own resolution made inside advance included.
      const evs = b.ev.slice(seen);
      seen = b.ev.length;
      for (const e of evs) {
        if (e.e === 'use' && e.move === 'slackwater_minute' && !e.past) {
          const f = b.s[e.side].f[e.idx];
          if (f) { if (spent.has(`${e.side}:${f.mon.uid}`)) report(`step ${i}: ${f.mon.name} cast Still Minute twice`); spent.add(`${e.side}:${f.mon.uid}`); }
          tally('Still Minute cast');
        }
        if (e.e === 'ship' && e.at === 'trade') tally('visitors that stayed');
        if (e.e === 'ko' && e.past && e.visit === false) tally('knockouts in the past');
        if (e.e === 'msg' && /does nothing/.test(e.text)) tally('copies that did nothing');
        if (e.e === 'msg' && /will not turn back/.test(e.text)) tally('failed replays');
      }
      if (b.over !== null && evs.some(e => e.past)) tally('battles that ended in the past');
      if (b.ev.length > 600) { b.ev.splice(0, b.ev.length - 200); seen = b.ev.length; }
    }
    if (!note && b.over === null) report('stuck: no end after 700 decisions');
  } catch (e) {
    report(`threw ${(e as Error).stack || e}`);
  }
  if (went[0] && went[1]) tally('battles where both sides went back');
  if (note) problems.push(note);
  tally('decisions', decisions);
  battles++;
  progress();
}
progress(true);

const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (battles < N) console.log(`PARTIAL: stopped early after ${battles} of ${N} battles.`);
console.log(`${battles} battles in ${secs} s`);
console.log(Object.keys(count).sort().map(k => `${k}: ${count[k]}`).join('\n'));
for (const p of problems.slice(0, 8)) console.log('PROBLEM: ' + p);
console.log(`${problems.length} battles with a problem`);
if (problems.length) process.exitCode = 1;
