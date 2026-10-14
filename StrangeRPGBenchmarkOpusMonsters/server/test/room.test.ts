// The rooms, the lobby, and the Worker driven through the harness: the seat hold and the rejoin, evictions and deploys,
// the clocks, the readers' refusals, and the limits. Each case is a rule from Notes/online-design.md or a defect the
// sibling card game found in its own room.
import worker from '../worker/index';
import { CHOICE_SECONDS, HOLD_SECONDS, NETWORK_GRACE_SECONDS, NEXT_SECONDS, PICK_SECONDS, REPORT_WAIT_SECONDS, type Choice, type Need } from '../../src/net/protocol';
import { type Client, faults, lobbyHarness, logs, nowIs, RoomHarness, seedRandom, setNow, EPOCH } from './harness';

declare const process: { exitCode: number; stdout: { write(s: string): void } };

const cases: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => cases.push({ name, fn });
function check(ok: unknown, what: string): asserts ok { if (!ok) throw new Error(what); }

const FIT = { fit: { kinds: ['flare', 'tor'], moves: ['flare_a', 'flare_b', 'tor_a', 'tor_b'], passives: ['flare_p', 'tor_p'], types: ['TIDE'], basic: 'P', retune: null, look: { shape: 1, palette: 2 } }, name: 'Flator', notion: 'whetstone', tan: { atk: 6, hp: 6 } };
const ROSTER = [...['cairn', 'hare', 'squall', 'dynamo', 'bramble'].map(k => ({ kind: k, name: k[0].toUpperCase() + k.slice(1), notion: null })), FIT];
const hello = (name: string, roster: unknown = ROSTER, build = 'test') => ({ type: 'hello', build, name, roster });
const S = 1000;
const JOINT: Need = { kind: 'joint', sees: null };

/** Two players seated in a fresh room, by seat and by side. */
async function pair(h: RoomHarness): Promise<{ a: Client; b: Client; side: [Client, Client] }> {
  const a = (await h.open())!, b = (await h.open())!;
  await h.say(a, hello('Alpha'));
  await h.say(b, hello('Beta'));
  const m = a.last('match');
  check(m && b.last('match'), 'both seats get a match');
  return { a, b, side: m.side === 0 ? [a, b] : [b, a] };
}

/** Both sides pick their first four, so the battle starts. */
async function picked(h: RoomHarness, side: [Client, Client]): Promise<void> {
  for (const c of side) await h.say(c, { type: 'pick', order: [0, 1, 2, 3] });
  check(side[0].last('picked'), 'both picks release together');
}

/** Both sides report decision `n` alike, and each side that chooses sends its choice. */
async function decide(h: RoomHarness, side: [Client, Client], n: number, need: Need, c: [Choice, Choice]): Promise<void> {
  for (const s of side) await h.say(s, { type: 'ready', n, hash: 'aaaaaaaa', need });
  for (const sd of [0, 1] as const) if (c[sd] !== null) await h.say(side[sd], { type: 'choose', n, c: c[sd] });
}

const tokenOf = (c: Client) => c.last('match')!.token;
const sideOf = (c: Client) => c.last('match')!.side;
const over = (winner: 0 | 1): Need => ({ kind: 'over', winner, stalled: false });

/** The side `loser` gives up the game in hand, both say they are ready, and it gives up the next one too, so the match ends 2 to 0. */
async function giveUpMatch(h: RoomHarness, side: [Client, Client], loser: 0 | 1): Promise<void> {
  await h.say(side[loser], { type: 'resign' });
  for (const c of side) await h.say(c, { type: 'next' });
  await picked(h, side);
  await h.say(side[loser], { type: 'resign' });
  check(side[0].last('end')?.final, 'two games given up end the match');
}

test('a match starts with a token for each seat and the same rosters on both', async () => {
  const h = new RoomHarness(), { a, b } = await pair(h);
  check(tokenOf(a) !== tokenOf(b) && sideOf(a) !== sideOf(b), 'the seats differ in token and side');
  check(JSON.stringify(a.last('match')!.rosters) === JSON.stringify(b.last('match')!.rosters), 'both see both rosters');
});

test('a dropped seat is held, and the other player hears it', async () => {
  const h = new RoomHarness(), { a, b } = await pair(h);
  await h.drop(b);
  const away = a.last('away');
  check(away && away.side === sideOf(b) && away.left === HOLD_SECONDS, 'the other player hears the seat is away for 90 seconds');
  check(!a.last('end'), 'a drop does not end the match');
  check((await h.stored())!.seats.some(s => s?.away !== null), 'the seat is held');
});

test('the held seat comes back with its token and gets the whole match', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await decide(h, side, 0, JOINT, [{ k: 'guard' }, { k: 'attack' }]);
  await h.drop(b);
  const c = (await h.open())!;
  await h.say(c, { type: 'hello', build: 'test', resume: tokenOf(b) });
  const r = c.last('rejoin');
  check(r && r.side === sideOf(b) && r.record.length === 1 && r.picked && !r.chose, 'the rejoin carries the picks and the record');
  check(a.last('back')?.side === sideOf(b), 'the other player hears the seat is back');
  await decide(h, [side[0] === a ? a : c, side[1] === a ? a : c], 1, JOINT, [{ k: 'guard' }, { k: 'guard' }]);
  check(a.all('release').length === 2 && c.last('release')?.n === 1, 'the match goes on through the new socket');
});

test('the hold runs out at 90 seconds and not before', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await h.drop(b);
  // a stays in touch: the runtime answers its pings.
  for (let t = 0; t < 85; t += 10) { h.ping(a); await h.advance(Math.min(10, 85 - t) * S); }
  check(!a.last('end'), 'no end before the hold runs out');
  h.ping(a);
  await h.advance(10 * S);
  const e = a.last('end');
  check(e && e.why === 'gone' && e.winner === sideOf(a), 'the other side wins when the hold runs out');
});

test('when both players are away the first hold to run out ends the match with no winner', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await h.drop(a);
  await h.advance(5 * S);
  await h.drop(b);
  await h.advance(HOLD_SECONDS * S);
  const d = (await h.stored())!;
  check(d.phase === 'over' && d.ended?.why === 'gone' && d.ended.winner === null, 'gone with no winner');
});

test('an unknown token gets resumeFailed and no seat', async () => {
  const h = new RoomHarness(), { a } = await pair(h);
  const c = (await h.open())!;
  await h.say(c, { type: 'hello', build: 'test', resume: 'not-a-token-from-here' });
  check(c.last('resumeFailed') && !c.open, 'refused and closed');
  check(!a.last('back') && !a.last('away'), 'nothing reaches the seated players');
});

test('a room that lost its memory refuses both tokens and deals no new match', async () => {
  const h = new RoomHarness(), { a, b } = await pair(h);
  h.storage.data.clear();
  h.restart();
  for (const old of [a, b]) {
    const c = (await h.open())!;
    await h.say(c, { type: 'hello', build: 'test', resume: tokenOf(old) });
    check(c.last('resumeFailed') && !c.last('match') && !c.last('rejoin'), 'a lost room refuses the token');
  }
  check(!(await h.stored())?.seats.some(Boolean), 'no seat was given out');
});

test('an eviction keeps the match and its sockets', async () => {
  const h = new RoomHarness(), { a, side } = await pair(h);
  await picked(h, side);
  await decide(h, side, 0, JOINT, [{ k: 'guard' }, { k: 'guard' }]);
  h.evict();
  await decide(h, side, 1, JOINT, [{ k: 'attack' }, { k: 'guard' }]);
  check(a.all('release').length === 2, 'decisions go on after the eviction');
});

test('a deploy drops every socket, and both seats come back to the same match', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await decide(h, side, 0, JOINT, [{ k: 'guard' }, { k: 'guard' }]);
  h.restart();
  const a2 = (await h.open())!, b2 = (await h.open())!;
  await h.say(a2, { type: 'hello', build: 'test', resume: tokenOf(a) });
  check(a2.last('rejoin')?.record.length === 1 && a2.last('away')?.side === sideOf(b), 'the first back hears the other is still away');
  await h.say(b2, { type: 'hello', build: 'test', resume: tokenOf(b) });
  check(b2.last('rejoin') && a2.last('back')?.side === sideOf(b), 'the second back is announced');
  const now: [Client, Client] = side[0] === a ? [a2, b2] : [b2, a2];
  await decide(h, now, 1, JOINT, [{ k: 'guard' }, { k: 'attack' }]);
  check(a2.last('release')?.n === 1, 'the match goes on');
});

test('a seat that never comes back after a deploy loses when its hold runs out', async () => {
  const h = new RoomHarness(), { a, side } = await pair(h);
  await picked(h, side);
  h.restart();
  const a2 = (await h.open())!;
  await h.say(a2, { type: 'hello', build: 'test', resume: tokenOf(a) });
  for (let t = 0; t < 100; t += 10) { h.ping(a2); await h.advance(10 * S); }
  const e = a2.last('end');
  check(e && e.why === 'gone' && e.winner === sideOf(a), 'the seat that came back wins');
});

test('a seat that comes back on another build voids the match', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await h.drop(b);
  const c = (await h.open())!;
  await h.say(c, { type: 'hello', build: 'newer', resume: tokenOf(b) });
  check(c.last('refused') && !c.open, 'the new build is refused');
  check(a.last('end')?.why === 'void' && a.last('end')?.winner === null, 'the match ends with no result');
});

test('a stale socket on the seat is closed when its token comes back', async () => {
  const h = new RoomHarness(), { a, b } = await pair(h);
  const c = (await h.open())!;
  await h.say(c, { type: 'hello', build: 'test', resume: tokenOf(b) });
  check(b.ws.closedWith === 4000 && c.last('rejoin'), 'the old socket is replaced');
  check(!a.last('away') && !a.last('back'), 'the other player sees no drop');
  await h.say(c, { type: 'pick', order: [5, 4, 3, 2] });
  await h.say(a, { type: 'pick', order: [0, 1, 2, 3] });
  check(c.last('picked') && !b.ws.raw.some(r => r.includes('picked')), 'only the new socket hears the room');
});

test('a third player is refused once the match runs', async () => {
  const h = new RoomHarness();
  await pair(h);
  const c = (await h.open())!;
  await h.say(c, hello('Gamma'));
  check(c.last('refused')?.reason === 'That room is full.' && !c.open, 'refused and closed');
});

test('a drop during the pick keeps the pick clock and the pick already sent', async () => {
  const h = new RoomHarness(), { a, b } = await pair(h);
  await h.say(b, { type: 'pick', order: [5, 4, 3, 2] });
  await h.advance(20 * S);
  await h.drop(b);
  const c = (await h.open())!;
  await h.say(c, { type: 'hello', build: 'test', resume: tokenOf(b) });
  const r = c.last('rejoin');
  check(r && r.picked === null && r.pick?.join() === '5,4,3,2' && r.pickLeft === PICK_SECONDS - 20, 'the pick and its clock come back');
  for (const x of [a, c]) h.ping(x);
  await h.advance((PICK_SECONDS - 20 + NETWORK_GRACE_SECONDS) * S);
  const p = a.last('picked');
  check(p && p.timeout[sideOf(a)] && !p.timeout[sideOf(b)], 'the pick clock ran through the drop');
});

test('a dropped side whose clock runs out still times out', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need: JOINT });
  await h.say(a, { type: 'choose', n: 0, c: { k: 'guard' } });
  await h.drop(b);
  h.ping(a);
  await h.advance((CHOICE_SECONDS + NETWORK_GRACE_SECONDS) * S);
  const rel = a.last('release');
  check(rel && rel.timeout[sideOf(b)] && !rel.timeout[sideOf(a)], 'the away side timed out');
});

test('three timeouts in a row lose the match', async () => {
  const h = new RoomHarness(), { a, side } = await pair(h);
  await picked(h, side);
  for (let n = 0; n < 3; n++) {
    for (const s of side) await h.say(s, { type: 'ready', n, hash: 'aaaaaaaa', need: JOINT });
    await h.say(a, { type: 'choose', n, c: { k: 'guard' } });
    for (const s of side) h.ping(s);
    await h.advance((CHOICE_SECONDS + NETWORK_GRACE_SECONDS) * S);
  }
  const e = a.last('end');
  check(e && e.why === 'timeouts' && e.winner === sideOf(a), 'the side that kept choosing wins');
});

test('a double replacement is blind and released together', async () => {
  const h = new RoomHarness(), { side } = await pair(h);
  await picked(h, side);
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need: { kind: 'replace2' } });
  await h.say(side[0], { type: 'choose', n: 0, c: 2 });
  check(!side[1].ws.raw.some(r => r.includes('"release"') || r.includes('"peek"')), 'side 1 learns nothing of side 0\'s pick');
  await h.say(side[1], { type: 'choose', n: 0, c: 3 });
  const rel = side[1].last('release');
  check(rel && rel.need.kind === 'replace2' && rel.c[0] === 2 && rel.c[1] === 3, 'both picks release together');
  check(side[0].last('clock')?.left === 30, 'a replacement gets 30 seconds');
});

test('a visit in the past asks only the side that went back, on the choice clock, and its timeout is released', async () => {
  const h = new RoomHarness(), { side } = await pair(h);
  await picked(h, side);
  const visit0: Need = { kind: 'visit', side: 0 };
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need: visit0 });
  check(side[0].all('clock').some(c => c.side === 0 && c.left === CHOICE_SECONDS) && !side[0].all('clock').some(c => c.side === 1), 'only the visiting side gets a clock, of the choice length');
  await h.say(side[1], { type: 'choose', n: 0, c: { k: 'guard' } });
  check(!side[0].last('release'), 'the other side cannot choose for the visitor');
  await h.say(side[0], { type: 'choose', n: 0, c: { k: 'move', i: 2, target: 1 } });
  const rel = side[1].last('release');
  check(rel && rel.need.kind === 'visit' && JSON.stringify(rel.c) === '[{"k":"move","i":2,"target":1},null]', 'the visitor\'s choice releases alone');
  const visit1: Need = { kind: 'visit', side: 1 };
  for (const s of side) await h.say(s, { type: 'ready', n: 1, hash: 'aaaaaaaa', need: visit1 });
  for (const s of side) h.ping(s);
  await h.advance((CHOICE_SECONDS + NETWORK_GRACE_SECONDS) * S);
  const late = side[0].last('release');
  check(late && late.n === 1 && late.timeout[1] && !late.timeout[0] && late.c[1] === null, 'a visitor whose time runs out is released as a timeout');
});

test('the side that foresees sees the other choice first, and its clock starts then', async () => {
  const h = new RoomHarness(), { side } = await pair(h);
  await picked(h, side);
  const need: Need = { kind: 'joint', sees: 1 };
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need });
  check(!side[1].all('clock').some(c => c.side === 1), 'the seer has no clock before the peek');
  await h.say(side[0], { type: 'choose', n: 0, c: { k: 'move', i: 1 } });
  const peek = side[1].last('peek');
  check(peek && JSON.stringify(peek.c) === '{"k":"move","i":1}', 'the seer sees the other choice');
  check(!side[0].last('peek'), 'the other side sees nothing');
  check(side[1].all('clock').some(c => c.side === 1), 'the seer\'s clock starts with the peek');
  await h.say(side[1], { type: 'choose', n: 0, c: { k: 'guard' } });
  check(side[0].last('release')?.n === 0, 'the round releases');
});

test('a desync voids the match and logs the record for the tools', async () => {
  const h = new RoomHarness(), { a, side } = await pair(h);
  await picked(h, side);
  logs.length = 0;
  await h.say(side[0], { type: 'ready', n: 0, hash: 'aaaaaaaa', need: JOINT });
  await h.say(side[1], { type: 'ready', n: 0, hash: 'bbbbbbbb', need: JOINT });
  check(a.last('end')?.why === 'void', 'a desync voids the match');
  check(logs.some(l => l.event === 'end' && String(l.note).includes('differ')) && logs.some(l => l.event === 'record'), 'the end and the record are logged');
});

test('frames the reader refuses get a refusal, and the fifth closes the socket and resigns the seat', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  for (let i = 0; i < 4; i++) await h.say(b, '{"type":"choose","n":0,"c":{"k":"guard","x":1}}');
  check(b.all('refused').length === 4 && b.open, 'four refusals and the socket stays');
  await h.say(b, 'not json');
  check(b.ws.closedWith === 1008, 'the fifth closes the socket');
  const e = a.last('end');
  check(e && e.why === 'resign' && e.winner === sideOf(a), 'the closed seat resigns');
});

test('a flood of frames closes the socket', async () => {
  const h = new RoomHarness(), { a, b } = await pair(h);
  for (let i = 0; i < 41; i++) await h.say(b, { type: 'ping' });
  check(b.ws.closedWith === 1008 && a.last('end')?.why === 'resign', 'a flood is closed out');
});

test('extra fields and object-property keys are refused and never relayed', async () => {
  const h = new RoomHarness(), { a, side } = await pair(h);
  await picked(h, side);
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need: JOINT });
  await h.say(side[0], '{"type":"choose","n":0,"c":{"k":"guard","__proto__":{"polluted":1}}}');
  await h.say(side[0], '{"type":"choose","n":0,"c":{"k":"guard"},"constructor":{"prototype":{"polluted":1}}}');
  await h.say(side[0], '{"__proto__":{"type":"resign"}}');
  check(side[0].all('refused').length === 3, 'each one is refused');
  check(({} as Record<string, unknown>).polluted === undefined, 'nothing reached a prototype');
  await h.say(side[0], { type: 'choose', n: 0, c: { k: 'move', i: 1, target: 0 } });
  await h.say(side[1], { type: 'choose', n: 0, c: { k: 'guard' } });
  const rel = a.last('release');
  check(rel && JSON.stringify(rel.c[0]) === '{"k":"move","i":1,"target":0}', 'the release carries the rebuilt choice');
  check(!h.badFrames.length, `every frame passes the client's reader: ${h.badFrames[0]}`);
});

test('a silent socket counts as dropped at the next alarm', async () => {
  const h = new RoomHarness(), { a, b } = await pair(h);
  for (let t = 0; t < 100; t += 10) { h.ping(a); await h.advance(10 * S); }
  check(b.ws.closedWith === 4001 && a.open, 'the silent socket is closed and the pinging one kept');
  check(a.last('away')?.side === sideOf(b), 'the other player hears the seat is away');
});

test('a decision that stays open for ten minutes while both players stay connected ends with no result', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  for (let t = 0; t < 570; t += 30) { h.ping(a); h.ping(b); await h.advance(30 * S); }
  check(!a.last('end'), 'nothing ends before ten minutes');
  h.ping(a); h.ping(b);
  await h.advance(40 * S);
  check(a.last('end')?.why === 'void' && h.storage.alarm !== null, 'the match ends with no result, and the cleanup is set');
});

test('players who go silent before reporting lose their seats to the silence check and the hold', async () => {
  const h = new RoomHarness(), { a, side } = await pair(h);
  await picked(h, side);
  await h.advance(12 * 60 * S);
  const d = (await h.stored())!;
  check(d.phase === 'over' && d.ended?.why === 'gone' && d.ended.winner === null && a.ws.closedWith === 4001, `ended ${JSON.stringify(d.ended)}`);
});

test('a finished match answers a returning token with its end and clears itself a minute later', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await giveUpMatch(h, side, sideOf(a));
  await h.drop(b);
  const c = (await h.open())!;
  await h.say(c, { type: 'hello', build: 'test', resume: tokenOf(b) });
  check(c.last('end')?.why === 'resign' && c.last('end')?.winner === sideOf(b), 'the end reaches the returning seat');
  await h.advance(61 * S);
  check(!h.storage.data.size && !a.open, 'the room cleared its storage and its sockets');
});

test('a match is the best of three: each game waits for both players, keeps the deal, and the second win ends the match', async () => {
  const h = new RoomHarness(), { side } = await pair(h);
  const first = side[0].last('match')!;
  check(first.game === 1 && first.wins.join() === '0,0' && first.deal === first.seed, 'the first game starts the match');
  await picked(h, side);
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need: over(0) });
  const e1 = side[1].last('end');
  check(e1 && !e1.final && e1.winner === 0 && e1.wins.join() === '1,0' && e1.matchWinner === null, 'the first game ends and the match runs on');
  await h.say(side[0], { type: 'next' });
  check(side[0].all('match').length === 1, 'the next game waits for both players');
  await h.say(side[1], { type: 'next' });
  const m2 = side[0].last('match')!;
  check(m2.game === 2 && m2.wins.join() === '1,0' && m2.seed !== first.seed && m2.deal === first.deal && m2.token === first.token, 'game 2 has a new scene and the same deal and seats');
  check((await h.stored())!.record.length === 0, 'each game keeps its own record');
  await picked(h, side);
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need: over(1) });
  check(side[0].last('end')?.final === false && side[0].last('end')?.wins.join() === '1,1', 'one game each');
  for (const c of side) await h.say(c, { type: 'next' });
  await picked(h, side);
  for (const s of side) await h.say(s, { type: 'ready', n: 0, hash: 'aaaaaaaa', need: over(0) });
  const e3 = side[1].last('end');
  check(e3 && e3.final && e3.matchWinner === 0 && e3.wins.join() === '2,1', 'the second win ends the match');
});

test('the next game starts after 30 seconds without both players, and waits for a player who is away', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await h.say(a, { type: 'resign' });
  for (const s of side) h.ping(s);
  await h.advance(NEXT_SECONDS * S);
  check(a.last('match')?.game === 2 && b.last('match')?.game === 2, 'game 2 starts on time');
  await h.say(b, { type: 'resign' });
  await h.drop(a);
  h.ping(b);
  await h.advance((NEXT_SECONDS + 10) * S);
  check(b.last('match')?.game === 2, 'game 3 waits for the player who is away');
  const c = (await h.open())!;
  await h.say(c, { type: 'hello', build: 'test', resume: tokenOf(a) });
  const r = c.last('rejoin');
  check(r && r.last && !r.last.final && r.last.wins.join() === '1,1' && r.picked === null && r.record.length === 0 && r.game === 2, 'the rejoin carries the end of game 2');
  await h.advance(1 * S);
  check(c.last('match')?.game === 3 && b.last('match')?.game === 3, 'game 3 starts once the player is back');
});

test('giving up between games ends the match, and a hold that runs out between games ends it too', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  await picked(h, side);
  await h.say(a, { type: 'resign' });
  await h.say(a, { type: 'resign' });
  const e = b.last('end');
  check(e && e.final && e.why === 'resign' && e.matchWinner === sideOf(b) && e.wins.join() === (sideOf(b) === 0 ? '1,0' : '0,1'), 'leaving between games gives up the match');
  const h2 = new RoomHarness(), p = await pair(h2);
  await picked(h2, p.side);
  await h2.say(p.a, { type: 'resign' });
  await h2.drop(p.b);
  h2.ping(p.a);
  await h2.advance(60 * S);
  h2.ping(p.a);
  await h2.advance((HOLD_SECONDS - 59) * S);
  const g = p.a.last('end');
  check(g && g.final && g.why === 'gone' && g.matchWinner === sideOf(p.a), 'the player still there takes the match');
});

test('a rematch starts once both players ask, with a new deal on the same seats, and leaving after a match ends the rematch', async () => {
  const h = new RoomHarness(), { a, b, side } = await pair(h);
  const first = a.last('match')!;
  await picked(h, side);
  await giveUpMatch(h, side, 0);
  await h.say(a, { type: 'again' });
  check(b.last('again')?.side === sideOf(a) && a.all('match').length === 2, 'the other player hears the ask, and nothing starts yet');
  await h.say(b, { type: 'again' });
  const m = a.last('match')!;
  check(m.game === 1 && m.wins.join() === '0,0' && m.deal !== first.deal && m.token === first.token && sideOf(a) === first.side, 'the rematch starts game 1 with a new deal on the same seats');
  logs.length = 0;
  await picked(h, side);
  await giveUpMatch(h, side, 1);
  check(logs.filter(l => l.event === 'end').length === 1, 'the rematch logs its own end');
  await h.drop(b);
  check(a.last('left')?.side === sideOf(b), 'leaving after the match tells the other player');
  await h.say(a, { type: 'again' });
  check(a.all('left').length === 2 && !b.open, 'an ask after the other player left gets left again');
  await h.advance(61 * S);
  check(!h.storage.data.size, 'the room clears itself a minute after the match');
});

test('the end is logged once', async () => {
  const h = new RoomHarness(), { a, side } = await pair(h);
  await picked(h, side);
  logs.length = 0;
  await h.say(a, { type: 'resign' });
  await h.say(a, { type: 'resign' });
  await h.advance(5 * S);
  check(logs.filter(l => l.event === 'end').length === 1, 'one end line');
});

test('names the word filter refuses never reach the other player', async () => {
  const h = new RoomHarness();
  const a = (await h.open())!, b = (await h.open())!;
  const roster = ROSTER.map((w, i) => (i === 2 ? { ...w, name: 'Sh1thead' } : w));
  await h.say(a, hello('B1tch', roster));
  await h.say(b, hello('Beta'));
  const m = b.last('match')!, mine = m.side === 0 ? 1 : 0;
  check(m.names[mine] === 'Stranger', 'a refused player name shows as Stranger');
  check(m.rosters[mine][2].name === '' && m.rosters[mine][1].name === 'Hare', 'a refused whorl name is left empty');
});

test('a guest leaves a code alone, and the host\'s cancel drops it', async () => {
  const { lobby } = lobbyHarness();
  const host = await lobby.host('b|6v4@25', 'h1');
  check(host.ok && host.code, 'a code is made');
  const guest = await lobby.join(host.code!, 'b|6v4@25');
  check(guest.ok && guest.room === host.room, 'the code reaches the room');
  const again = await lobby.join(host.code!, 'b|6v4@25');
  check(again.ok, 'the code stays live after a join');
  await lobby.cancel(host.room, host.code!);
  check(!(await lobby.join(host.code!, 'b|6v4@25')).ok, 'the host\'s cancel drops it');
});

test('the lobby caps codes by address and rooms by day', async () => {
  const { lobby } = lobbyHarness({ ROOMS_PER_DAY: '4' });
  for (let i = 0; i < 3; i++) check((await lobby.host('b|6v4@25', 'same')).ok, 'three codes for one address');
  const fourth = await lobby.host('b|6v4@25', 'same');
  check(!fourth.ok && fourth.reason.includes('three codes'), 'a fourth code from the same address is refused');
  check((await lobby.findPublic('b|6v4@25')).ok, 'a fourth room today');
  const full = await lobby.findPublic('c|6v4@25');
  check(!full.ok && full.reason.includes('full for today'), 'a fifth room today is refused');
  check((await lobby.findPublic('b|6v4@25')).ok, 'joining a waiting room opens nothing new');
  setNow(nowIs() + 24 * 3600 * S);
  check((await lobby.findPublic('c|6v4@25')).ok, 'the cap resets the next day');
});

test('the Worker limits requests by address', async () => {
  const { lobby } = lobbyHarness();
  const env = { LOBBY: { idFromName: () => 'lobby', get: () => lobby }, ROOM: {}, ALLOWED_ORIGINS: '' } as never;
  const ask = (address: string) => worker.fetch(new Request('http://w/api/queue/public', {
    method: 'POST', headers: { Origin: 'http://localhost:8743', 'CF-Connecting-IP': address, 'content-type': 'application/json' },
    body: JSON.stringify({ build: 'b', format: '6v4@25' }),
  }), env);
  const codes: number[] = [];
  for (let i = 0; i < 21; i++) codes.push((await ask('10.0.0.1')).status);
  check(codes.slice(0, 20).every(c => c === 200) && codes[20] === 429, `twenty pass and the next is refused: ${codes.join()}`);
  check((await ask('10.0.0.2')).status === 200, 'another address is not limited');
  setNow(nowIs() + 60 * S);
  check((await ask('10.0.0.1')).status === 200, 'the address gets requests back over time');
});

test('a room keeps at most six sockets', async () => {
  const h = new RoomHarness();
  const open: (Client | null)[] = [];
  for (let i = 0; i < 7; i++) open.push(await h.open());
  check(open.slice(0, 6).every(Boolean) && open[6] === null, 'the seventh socket is turned away');
});

test('a match writes few storage rows', async () => {
  const h = new RoomHarness(), { side } = await pair(h);
  await picked(h, side);
  for (let n = 0; n < 27; n++) await decide(h, side, n, JOINT, [{ k: 'guard' }, { k: 'attack' }]);
  for (const s of side) await h.say(s, { type: 'ready', n: 27, hash: 'aaaaaaaa', need: { kind: 'over', winner: 0, stalled: false } });
  await h.advance(61 * S);
  info.push(`a match of 27 joint rounds wrote ${h.storage.rowsWritten} storage rows in its room`);
  check(h.storage.rowsWritten < 400, `a match wrote ${h.storage.rowsWritten} rows`);
});

const info: string[] = [];

async function main(): Promise<void> {
  let failed = 0;
  for (const c of cases) {
    seedRandom(7);
    setNow(EPOCH);
    faults.length = 0;
    try {
      await c.fn();
      if (faults.length) throw new Error(`the room reported an error: ${faults[0]}`);
      process.stdout.write(`ok   ${c.name}\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`FAIL ${c.name}: ${(e as Error).message}\n`);
    }
  }
  for (const line of info) process.stdout.write(`info ${line}\n`);
  process.stdout.write(`${cases.length - failed} of ${cases.length} room cases passed\n`);
  if (failed) process.exitCode = 1;
}

void main();
