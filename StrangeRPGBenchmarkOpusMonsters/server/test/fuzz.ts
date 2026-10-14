// Throws malformed frames at real rooms from fake sockets: random values, truncated and oversized frames, frames nested
// too deep, wrong types, extra keys, and object-property keys, mixed with honest play, drops, rejoins, evictions, deploys,
// and time. After every frame it checks that no handler threw, that every frame a room sent passes the client's reader
// whole, and that no prototype changed. At the end of each room it lets two hours pass and checks that a match that
// started has ended, so no room is stuck.
// Usage: node test/run.mjs fuzz [rooms] [seed] [--progress=file] [--stop=file] [--minutes=N]
// The progress file (default ../Notes/byssus-fuzz-progress.txt) shows rooms done and an ETA. The stop file (default
// test/fuzz.stop) or the time limit ends the run after the room in hand with a partial report.
import { DEPTH_MAX, FRAME_MAX, readRoom, type Need } from '../../src/net/protocol';
import { clearStop, progressHead, runCtl, writeText } from '../../src/tools/runctl';
import { faults, onRealClock, RoomHarness, seedRandom, type Client } from './harness';

declare const process: { argv: string[]; exitCode: number; stdout: { write(s: string): void } };

const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const ROOMS = Number(pos[0] || 400);
let seed = Number(pos[1] || 1);
// A flag given on the command line comes first, so it wins over these defaults.
const ctl = onRealClock(() => runCtl([...args, '--progress=../Notes/byssus-fuzz-progress.txt', '--stop=test/fuzz.stop'], 'byssus fuzz'));
clearStop(ctl);
/** The run's own checks read the real clock, since the rooms run on the harness's clock. */
const halted = (): boolean => onRealClock(() => ctl.halted());
const rnd = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const int = (n: number): number => Math.floor(rnd() * n);
const pickOf = <T>(a: readonly T[]): T => a[int(a.length)];

const KINDS = ['cairn', 'hare', 'squall', 'dynamo', 'bramble', 'lune', 'tor', 'flare'];
const roster = () => KINDS.slice(0, 6).map(k => ({ kind: k, name: k[0].toUpperCase() + k.slice(1), notion: null }));
const NEEDS: Need[] = [{ kind: 'joint', sees: null }, { kind: 'joint', sees: 0 }, { kind: 'joint', sees: 1 }, { kind: 'act', side: 0 }, { kind: 'act', side: 1 }, { kind: 'replace', side: 0 }, { kind: 'replace2' }, { kind: 'visit', side: 0 }, { kind: 'visit', side: 1 }, { kind: 'over', winner: 0, stalled: false }, { kind: 'over', winner: 1, stalled: false }];
const ODD_KEYS = ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', 'valueOf', '', 'type', 'n', 'c', 'k'];

/** A random JSON value, sometimes with keys that name object properties. */
function value(depth: number): unknown {
  const r = int(10);
  if (depth <= 0 || r < 4) return pickOf<unknown>([null, true, false, 0, -1, 1.5, 2 ** 53, -(2 ** 31), 1e308, '', 'x', 'ping', '\u0000\u0007', '\ud800', '0', 'NaN', 'constructor']);
  if (r < 7) return Array.from({ length: int(5) }, () => value(depth - 1));
  const o: Record<string, unknown> = {};
  for (let i = int(5); i > 0; i--) o[rnd() < 0.4 ? pickOf(ODD_KEYS) : `k${int(9)}`] = value(depth - 1);
  return o;
}

/** A choice that fits a decision. */
const choiceFor = (need: Need): unknown => (need.kind === 'replace' || need.kind === 'replace2' ? int(4)
  : pickOf([{ k: 'guard' }, { k: 'attack' }, { k: 'move', i: int(4) }, { k: 'switch', to: 1 + int(3) }, { k: 'wait' }, { k: 'take', i: int(50) }]));

/** A message a client might send now, honest in shape: a pick, a report, a choice, a ping, a word between games or after them, and now and then a resignation or a foul. */
function honest(n: number, need: Need): Record<string, unknown> {
  const r = rnd();
  if (r < 0.15) return { type: 'pick', order: [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5).slice(0, 4) };
  if (r < 0.50) return { type: 'ready', n, hash: rnd() < 0.98 ? 'aaaaaaaa' : 'bbbbbbbb', need };
  if (r < 0.80) return { type: 'choose', n: rnd() < 0.9 ? n : n + int(3) - 1, c: choiceFor(need) };
  if (r < 0.90) return { type: rnd() < 0.6 ? 'next' : 'again' };
  if (r < 0.98) return { type: 'ping' };
  return rnd() < 0.5 ? { type: 'resign' } : { type: 'foul', n, why: 'a check failed' };
}

/** A frame the reader must refuse, built from an honest one or from nothing. */
function malformed(n: number, need: Need): string | ArrayBuffer {
  const h = honest(n, need), raw = JSON.stringify(h);
  switch (int(12)) {
    case 0: return JSON.stringify(value(4));
    case 1: return raw.slice(0, Math.max(1, int(raw.length)));
    case 2: return JSON.stringify({ ...h, why: 'x'.repeat(FRAME_MAX) });
    case 3: { const d = DEPTH_MAX + 1 + int(40); return `{"type":"ready","n":0,"hash":"aaaaaaaa","need":${'['.repeat(d)}${']'.repeat(d)}}`; }
    case 4: return JSON.stringify({ ...h, [pickOf(ODD_KEYS.filter(k => !(k in h)))]: value(2) });
    case 5: { const k = pickOf(Object.keys(h)); return JSON.stringify({ ...h, [k]: value(2) }); }
    case 6: return `{"__proto__":{"polluted":true},${raw.slice(1)}`;
    case 7: return `{"type":"choose","n":${n},"c":{"k":"guard","constructor":{"prototype":{"polluted":true}}}}`;
    case 8: return JSON.stringify({ type: 'hello', build: 'test', name: pickOf(['', 'x'.repeat(9), 'Bad\u0001', 7]), roster: roster() });
    case 9: return JSON.stringify({ type: 'hello', build: 'test', name: 'Mal', roster: [...roster().slice(0, 5), { kind: 'cairn', name: 'Odd', notion: null, __proto__x: 1 }] }).replace('__proto__x', '__proto__');
    case 10: return new TextEncoder().encode(raw).buffer as ArrayBuffer;
    default: return JSON.stringify({ ...h, type: pickOf(['Ping', 'hello ', 'choose\u0000', 'release', 'match', 'end', String(int(9))]) });
  }
}

interface Seat { c: Client; token: string | null; read: number }

const tally: Record<string, number> = {};
const count = (k: string, by = 1) => { tally[k] = (tally[k] || 0) + by; };
const problems: string[] = [];
let rooms = 0, lastWrite = 0;

function progress(force = false): void {
  onRealClock(() => {
    if (!force && Date.now() - lastWrite < 3000) return;
    lastWrite = Date.now();
    const state = force ? (ctl.halted() ? 'stopped early' : 'finished') : 'running';
    const top = Object.entries(tally).sort().map(([k, v]) => `${k} ${v}`).join(', ');
    writeText(ctl.progress, `${progressHead(ctl, rooms, ROOMS, state, 'rooms')}\n${problems.length} problems so far\n${top}\n`);
  });
}

const canon = (v: unknown): string => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));

/** Reads every frame a seat got since the last look. A frame the reader refuses or trims is a relay of what the room did not check. */
function look(s: Seat, where: string): void {
  for (; s.read < s.c.ws.raw.length; s.read++) {
    const raw = s.c.ws.raw[s.read], m = readRoom(raw);
    if (!m || canon(m) !== canon(JSON.parse(raw))) problems.push(`${where}: the room sent a frame the client's reader ${m ? 'trims' : 'refuses'}: ${raw.slice(0, 160)}`);
    else {
      if (m.type === 'match') s.token = m.token;
      count(`sent ${m.type === 'end' ? `end ${m.why}` : m.type}`);
    }
  }
}

async function room(k: number): Promise<void> {
  seedRandom(1 + int(1 << 30));
  const h = new RoomHarness(), where = `room ${k} (seed ${seed})`, seats: Seat[] = [];
  const open = async (): Promise<Seat | null> => { const c = await h.open(); if (!c) return null; const s = { c, token: null, read: 0 }; seats.push(s); return s; };
  const needs = new Map<string, Need>();
  for (let i = 0; i < 2 + int(2); i++) { const s = await open(); if (s && rnd() < 0.9) await h.say(s.c, { type: 'hello', build: 'test', name: `P${i}`, roster: roster() }); }
  // Some rooms get few bad frames and play on for a while, and some get many and end early by closing seats out.
  const steps = 40 + int(160), bad = 0.02 + rnd() * 0.3;
  for (let step = 0; step < steps; step++) {
    const d = await h.stored(), n = d?.n ?? 0, key = `${d?.game ?? 1} ${n}`;
    if (!needs.has(key)) needs.set(key, pickOf(NEEDS));
    const live = seats.filter(s => s.c.open), s = live.length ? pickOf(live) : null, r = rnd();
    try {
      if (!s || r < 0.04) { const t = await open(); if (t) await h.say(t.c, rnd() < 0.5 ? { type: 'hello', build: 'test', name: 'Late', roster: roster() } : { type: 'hello', build: rnd() < 0.8 ? 'test' : 'newer', resume: pickOf(seats.map(x => x.token ?? 'nobodys-token')) }); count('opened'); }
      else if (r < 0.04 + bad) { await h.say(s.c, malformed(n, needs.get(key)!)); count('malformed'); }
      else if (r < 0.20 + bad) { await h.say(s.c, honest(n, needs.get(key)!)); count('honest'); }
      else if (r < 0.80 && d?.phase === 'between') { for (const x of live) if (rnd() < 0.7) await h.say(x.c, { type: 'next' }); count('nexts'); }
      else if (r < 0.80 && d?.phase === 'over') { for (const x of live) if (rnd() < 0.5) await h.say(x.c, { type: 'again' }); count('agains'); }
      else if (r < 0.80) {
        // Every live seat reports the decision alike and chooses, so matches move on and releases go out.
        for (const x of live) await h.say(x.c, { type: 'ready', n, hash: 'aaaaaaaa', need: needs.get(key)! });
        for (const x of live) if (rnd() < 0.9) await h.say(x.c, { type: 'choose', n, c: choiceFor(needs.get(key)!) });
        count('decisions');
      }
      else if (r < 0.86) { await h.drop(s.c, rnd() < 0.7 ? 1006 : 1000); count('dropped'); }
      else if (r < 0.88) { h.evict(); count('evicted'); }
      else if (r < 0.89) { h.restart(); count('deploys'); }
      else { for (const x of live) if (rnd() < 0.8) h.ping(x.c); await h.advance(int(4) === 0 ? int(120_000) : int(5_000)); count('advanced'); }
    } catch (e) {
      problems.push(`${where} step ${step}: threw ${(e as Error).stack?.split('\n').slice(0, 3).join(' ') ?? e}`);
      return;
    }
    for (const x of seats) look(x, `${where} step ${step}`);
    if (faults.length) { problems.push(`${where} step ${step}: a handler failed: ${faults[0].split('\n')[0]}`); faults.length = 0; }
    if (({} as Record<string, unknown>).polluted !== undefined || Object.keys(Object.prototype).length) { problems.push(`${where} step ${step}: a prototype changed`); return; }
  }
  // Two hours with nobody sending: every match that started must end by its clocks, its holds, or the silence sweep.
  try { for (let t = 0; t < 12; t++) await h.advance(10 * 60_000); } catch (e) { problems.push(`${where}: the ending threw: ${(e as Error).message}`); return; }
  for (const x of seats) look(x, `${where} ending`);
  const d = await h.stored();
  if (d && (d.phase === 'pick' || d.phase === 'play' || d.phase === 'between')) problems.push(`${where}: stuck in ${d.phase} at decision ${d.n} with alarm ${h.storage.alarm}`);
  count(`ended ${d ? d.phase === 'over' ? d.ended?.why ?? 'over' : d.phase : 'cleared'}`);
  count('frames refused', seats.reduce((a, x) => a + x.c.all('refused').length, 0));
}

async function main(): Promise<void> {
  const t0 = onRealClock(() => Date.now());
  for (let k = 0; k < ROOMS && !halted(); k++) {
    await room(k);
    rooms++;
    progress();
  }
  progress(true);
  if (rooms < ROOMS) process.stdout.write(`PARTIAL: stopped early after ${rooms} of ${ROOMS} rooms.\n`);
  process.stdout.write(`${rooms} rooms in ${((onRealClock(() => Date.now()) - t0) / 1000).toFixed(1)} s: ${Object.entries(tally).sort().map(([k, v]) => `${k} ${v}`).join(', ')}\n`);
  for (const p of problems.slice(0, 12)) process.stdout.write(`PROBLEM: ${p}\n`);
  process.stdout.write(`${problems.length} problems\n`);
  if (problems.length) process.exitCode = 1;
}

void main();
