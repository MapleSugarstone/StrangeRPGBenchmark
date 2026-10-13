// The client end of a Byssus room driven with fake sockets, a fake page, and a clock the test owns: the close codes, the
// watchdog with its hidden-tab and sleep guards, the reconnect with the seat's token, the held seat in sessionStorage, the
// reader on every frame, and the generation counter that drops a reply after the player left (Notes/online-design.md).
// Usage: node dist-tools/nettest.js
import type { FromRoom, Link } from '../net/protocol';

declare const process: { exitCode: number; stdout: { write(s: string): void } };

/** The client module, loaded once the fake page is in place, since the battle code it brings may read the page as it loads. */
let C: typeof import('../net/client');

// ---------------------------------------------------------------- the page as the client sees it

let now = 1_800_000_000_000;
Date.now = () => now;

type Listener = (ev: unknown) => void;

/** A socket the test holds both ends of. Closing it from the client side fires nothing, as with the local server. */
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  closedWith: number | null = null;
  readonly sent: Record<string, unknown>[] = [];
  private listeners = new Map<string, Set<Listener>>();
  constructor(readonly url: string) { sockets.push(this); }
  addEventListener(type: string, fn: Listener, opts?: { signal?: AbortSignal }): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
    opts?.signal?.addEventListener('abort', () => set!.delete(fn));
  }
  send(s: string): void {
    if (this.readyState !== 1) throw new Error('send on a socket that is not open');
    this.sent.push(JSON.parse(s) as Record<string, unknown>);
  }
  close(code = 1000): void { this.closedWith = code; this.readyState = 3; }
  private fire(type: string, ev: unknown): void { for (const fn of [...(this.listeners.get(type) ?? [])]) fn(ev); }
  open(): void { this.readyState = 1; this.fire('open', {}); }
  say(m: unknown): void { this.fire('message', { data: typeof m === 'string' ? m : JSON.stringify(m) }); }
  drop(code = 1006): void { this.readyState = 3; this.fire('close', { code }); }
  get wired(): boolean { return [...this.listeners.values()].some(s => s.size > 0); }
  last(type: string): Record<string, unknown> | undefined { return this.sent.filter(m => m.type === type).pop(); }
}
const sockets: FakeSocket[] = [];
const socket = (): FakeSocket => sockets[sockets.length - 1];

const docListeners = new Set<Listener>();
const doc = {
  visibilityState: 'visible',
  addEventListener(_: string, fn: Listener, o?: { signal?: AbortSignal }) { docListeners.add(fn); o?.signal?.addEventListener('abort', () => docListeners.delete(fn)); },
};
const store = new Map<string, string>();
/** Each POST the client made, and a way to answer the one in flight. */
const posts: { url: string; body: Record<string, unknown> }[] = [];
let answer: ((v: unknown) => void) | null = null;

const g = globalThis as Record<string, unknown>;
g.WebSocket = FakeSocket;
g.document = doc;
g.location = { hostname: 'localhost' };
g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
g.fetch = (url: string, init: { body: string }) => {
  posts.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
  return new Promise(res => { answer = v => res({ json: async () => v }); });
};

const MATCH = { type: 'match', side: 1, token: 'seat-token-1234', names: ['Alpha', 'Beta'], rosters: [[], []], seed: 1, clock: { pick: 90, choice: 60, replace: 30 } };
const ROSTER = ['cairn', 'hare', 'squall', 'dynamo', 'bramble', 'lune'].map(k => ({ kind: k, name: k[0].toUpperCase() + k.slice(1), notion: null }));
const match = { ...MATCH, rosters: [ROSTER, ROSTER] };
const rejoin = { type: 'rejoin', side: 1, names: ['Alpha', 'Beta'], rosters: [ROSTER, ROSTER], seed: 1, clock: MATCH.clock, picked: null, record: [], pickLeft: 50, pick: null, chose: false, left: [null, null], peek: null };

/** Moves the clock in steps of a frame's worth of ticks, the way the screen ticks the link. */
function run(link: Link, ms: number, step = 500): void {
  for (let t = 0; t < ms; t += step) { now += Math.min(step, ms - t); link.tick(); }
}
const drain = (link: Link): FromRoom[] => { const out: FromRoom[] = []; for (let m = link.poll(); m; m = link.poll()) out.push(m); return out; };

/** A link with its socket open and the match in hand, so it holds a seat. */
function seated(): InstanceType<typeof C.NetLink> {
  const link = new C.NetLink('pub-room', { slot: 9 });
  socket().open();
  socket().say(match);
  drain(link);
  return link;
}

// ---------------------------------------------------------------- the cases

const cases: { name: string; fn: () => void | Promise<void> }[] = [];
const test = (name: string, fn: () => void | Promise<void>) => cases.push({ name, fn });
function check(ok: unknown, what: string): asserts ok { if (!ok) throw new Error(what); }

test('a socket that never opened is a room that could not be reached', () => {
  const link = new C.NetLink('pub-room');
  socket().drop(1006);
  const m = drain(link);
  check(m.length === 1 && m[0].type === 'end' && link.problem === 'The room could not be reached.', `got ${JSON.stringify(m)} and "${link.problem}"`);
});

test('a drop before the match ends the wait and names the close', () => {
  const link = new C.NetLink('pub-room');
  socket().open();
  socket().drop(1006);
  check(drain(link).some(m => m.type === 'end') && link.problem === 'The link died without closing.', `"${link.problem}"`);
});

test('a drop during a match goes slack and comes back with the seat\'s token', () => {
  const link = seated(), first = socket();
  first.drop(1006);
  check(!drain(link).length && (link.slack?.() ?? 0) > 85, 'a drop ends nothing and the link goes slack');
  check(C.heldSeat()?.token === 'seat-token-1234', 'the seat stays in the page\'s storage');
  run(link, 1500);
  check(socket() !== first, 'a new socket opens after a short wait');
  socket().open();
  check(JSON.stringify(socket().sent[0]) === JSON.stringify({ type: 'hello', build: 'local', resume: 'seat-token-1234' }), `the first frame is the token: ${JSON.stringify(socket().sent[0])}`);
  socket().say(rejoin);
  check(link.slack?.() === 0 && drain(link).some(m => m.type === 'rejoin'), 'the rejoin reaches the screen and the link holds again');
});

test('what the screen sends while the link is slack is dropped, and sending works after the rejoin', () => {
  const link = seated();
  socket().drop(1006);
  link.send({ type: 'choose', n: 3, c: { k: 'guard' } });
  run(link, 1500);
  socket().open();
  check(socket().sent.length === 1, 'only the token goes out on the new socket');
  socket().say(rejoin);
  link.send({ type: 'choose', n: 3, c: { k: 'guard' } });
  check(socket().last('choose'), 'a choice after the rejoin goes out');
});

test('a try that fails waits longer before the next, and the hold ends the tries after 90 seconds', () => {
  const link = seated();
  socket().drop(1006);
  const before = sockets.length;
  for (let t = 0; t < 95_000; t += 250) {
    now += 250;
    link.tick();
    const s = socket();
    if (s.readyState === 0 && sockets.length > before) s.drop(1006);
  }
  const tries = sockets.length - before, m = drain(link);
  check(tries >= 15 && tries <= 40, `${tries} tries in 95 seconds`);
  check(m.length === 1 && m[0].type === 'end' && /hold ran out/.test(link.problem), `the match ends when the hold runs out: "${link.problem}"`);
  check(!C.heldSeat(), 'the seat is forgotten');
});

test('the watchdog gives a silent room up after 25 seconds, and a link with a seat comes back', () => {
  const link = seated(), first = socket();
  run(link, 20_000);
  check(first.readyState === 1 && !link.slack?.(), 'twenty seconds of silence is not enough');
  run(link, 8_000);
  check(first.closedWith !== null && !first.wired && (link.slack?.() ?? 0) > 0, 'the silent socket is let go and the link goes slack');
  run(link, 2_000);
  check(socket() !== first, 'and it tries again');
});

test('a hidden tab never gives up on its room', () => {
  const link = seated();
  doc.visibilityState = 'hidden';
  run(link, 60_000);
  doc.visibilityState = 'visible';
  check(!link.slack?.() && socket().readyState === 1, 'a hidden tab says nothing about the room');
});

test('a machine that slept is not a dead room, and a dead room after the sleep is still caught', () => {
  const link = seated();
  now += 40 * 60_000;
  link.tick();
  run(link, 2_500);
  check(!link.slack?.(), 'the late check excuses the sleep');
  run(link, 30_000);
  check((link.slack?.() ?? 0) > 0, 'real silence after it is caught');
});

test('a token the room does not know ends the match and forgets the seat', () => {
  const link = seated();
  socket().drop(1006);
  run(link, 1500);
  socket().open();
  socket().say({ type: 'resumeFailed', reason: 'That match is no longer running.' });
  const m = drain(link);
  check(m.length === 1 && m[0].type === 'end' && link.problem === 'That match is no longer running.', `"${link.problem}"`);
  check(!C.heldSeat(), 'the seat is forgotten');
});

test('a refusal while coming back, such as a new build, ends the match and forgets the seat', () => {
  const link = seated();
  socket().drop(1006);
  run(link, 1500);
  socket().open();
  socket().say({ type: 'refused', reason: 'The game was updated during the match, so it does not count. Reload the page.' });
  check(drain(link).some(m => m.type === 'end') && /updated/.test(link.problem) && !C.heldSeat(), 'refused, ended, and forgotten');
});

test('the end of a match forgets the seat', () => {
  const link = seated();
  check(!!C.heldSeat(), 'a seat is held during the match');
  socket().say({ type: 'end', why: 'over', winner: 1 });
  check(!C.heldSeat() && drain(link).some(m => m.type === 'end'), 'the end reaches the screen and the seat goes');
});

test('another page that took the seat is not fought for', () => {
  const link = seated(), before = sockets.length;
  socket().drop(4000);
  run(link, 10_000);
  check(sockets.length === before && link.problem === 'Another page took this seat.', `"${link.problem}"`);
});

test('a frame the reader refuses ends the link with a reload line and throws nothing', () => {
  for (const bad of ['not json', '{"type":"release","n":0}', '{"type":"pong","extra":1}', '{"type":"somethingNewer"}', `"${'x'.repeat(600_000)}"`]) {
    const link = seated();
    socket().say(bad);
    check(drain(link).some(m => m.type === 'end') && /Reload the page/.test(link.problem), `"${bad.slice(0, 30)}" gave "${link.problem}"`);
  }
});

test('a link closed by the screen lets its socket go, and nothing from it reaches the screen', () => {
  const link = seated(), s = socket();
  link.close();
  s.say({ type: 'release', n: 0, need: { kind: 'replace2' }, c: [1, 1], timeout: [false, false] });
  s.drop(1006);
  check(!drain(link).length && !s.wired && s.closedWith !== null, 'nothing gets through after close');
});

test('the held seat lasts 90 seconds from the last word from the room', () => {
  const link = seated();
  for (let t = 0; t < 12; t++) { run(link, 5_000); socket().say({ type: 'clock', n: 0, side: 1, left: 60 }); }
  check(!!C.heldSeat(), 'the seat is held while the room keeps talking');
  link.close();
  now += 85_000;
  check(!!C.heldSeat(), 'still held 85 seconds after the room last spoke');
  now += 10_000;
  check(!C.heldSeat(), 'gone after 90 seconds');
});

test('the held seat remembers this side and the other player\'s name', () => {
  seated();
  const s = C.heldSeat();
  check(s?.side === 1 && s.foe === 'Alpha', `the seat holds side ${s?.side} and the name ${s?.foe}`);
});

test('a link made to resume keeps the side and the name when the room speaks before its rejoin, and takes them again from the rejoin', () => {
  seated();
  const seat = C.heldSeat()!;
  // A page reloaded during the match reads the seat and builds its link from it.
  const link = new C.NetLink(seat.room, { resume: seat.token, slot: seat.slot, side: seat.side, foe: seat.foe });
  socket().open();
  socket().say({ type: 'clock', n: 0, side: 1, left: 60 });
  check(C.heldSeat()?.side === 1 && C.heldSeat()?.foe === 'Alpha', 'a message before the rejoin leaves the side and the name in the seat');
  socket().say(rejoin);
  drain(link);
  check(C.heldSeat()?.side === 1 && C.heldSeat()?.foe === 'Alpha', 'the rejoin writes them again');
});

test('a seat with a side or a name that cannot be right is not held, and a seat from before them is', () => {
  const base = { room: 'pub-room', token: 'seat-token-1234', build: 'local', slot: 9, heard: now };
  const hold = (extra: object) => { store.set('byssus-seat', JSON.stringify({ ...base, ...extra })); return C.heldSeat(); };
  check(hold({}) !== null && C.heldSeat()?.side === undefined, 'a seat with no side or name is held');
  check(hold({ side: 0, foe: 'Alpha' })?.side === 0, 'side 0 is held');
  check(hold({ side: 2 }) === null, 'side 2 is refused');
  check(hold({ side: 1, foe: 'A name much too long for a player' }) === null, 'a long name is refused');
  check(hold({ foe: 7 }) === null, 'a name that is not text is refused');
});

test('a finished match that a returning seat finds ends the link and forgets the seat, and the seat read before still has the side and the name', () => {
  seated();
  const seat = C.heldSeat()!;
  const link = new C.NetLink(seat.room, { resume: seat.token, slot: seat.slot, side: seat.side, foe: seat.foe });
  socket().open();
  socket().say({ type: 'end', why: 'resign', winner: 0 });
  const m = drain(link);
  check(m.length === 1 && m[0].type === 'end' && !C.heldSeat(), 'the end reaches the screen and the seat goes');
  check(seat.side === 1 && seat.foe === 'Alpha', 'the seat the screen read has the side and the name');
});

test('a link made to resume sends the token first and holds back the rest until the rejoin', () => {
  const link = new C.NetLink('pub-room', { resume: 'seat-token-1234', slot: 9 });
  check((link.slack?.() ?? 0) > 85, 'a link that comes back counts the hold from the start');
  socket().open();
  check(socket().sent.length === 1 && socket().sent[0].resume === 'seat-token-1234', 'the token goes first');
  socket().say(rejoin);
  check(drain(link)[0]?.type === 'rejoin' && !link.slack?.(), 'the rejoin arrives');
});

test('a queue reply after the player left is dropped, and the place it opened goes back', async () => {
  posts.length = 0;
  const p = C.queue('host');
  C.leaveByssus();
  answer!({ ok: true, room: 'prv-room', code: 'BCDFGH' });
  const r = await p;
  check(!r.ok && r.reason === C.CANCELED, 'the reply is dropped');
  check(posts.some(x => x.url.endsWith('/api/queue/cancel') && x.body.room === 'prv-room' && x.body.code === 'BCDFGH'), 'the code goes back to the lobby');
});

test('a guest who left never cancels the host\'s code', async () => {
  posts.length = 0;
  const p = C.queue('join', 'BCDFGH');
  C.leaveByssus();
  answer!({ ok: true, room: 'prv-room', code: 'BCDFGH' });
  await p;
  await Promise.resolve();
  check(!posts.some(x => x.url.endsWith('/api/queue/cancel')), 'no cancel for a guest');
});

test('a lobby reply of the wrong shape is refused', async () => {
  const p = C.queue('public');
  answer!({ ok: true, room: 'pub-room', extra: 'x' });
  const r = await p;
  check(!r.ok && /cannot read/.test(r.reason), `got ${JSON.stringify(r)}`);
});

async function main(): Promise<void> {
  C = await import('../net/client');
  let failed = 0;
  for (const c of cases) {
    store.clear();
    doc.visibilityState = 'visible';
    try {
      await c.fn();
      process.stdout.write(`ok   ${c.name}\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`FAIL ${c.name}: ${(e as Error).message}\n`);
    }
  }
  process.stdout.write(`${cases.length - failed} of ${cases.length} client cases passed\n`);
  if (failed) process.exitCode = 1;
}

void main();
