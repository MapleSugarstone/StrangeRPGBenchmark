// Test hooks for online play on window.__online: the roster check, a loopback match to play by hand, a check that plays
// loopback matches as side 1 through every screen, a networked match through the Byssus menu against `wrangler dev`, and a
// rejoin of the match a reloaded page left. Each runs the breathing-room check (uicheck.ts) on every new screen. They run
// in the background and yield to the page now and then, so two tabs can play each other. Read the progress and results
// with report().
import { choose as aiChoose, chooseReplacement, chooseVisit } from '../battle/ai';
import { barred, clone, legal, moveDef, out, replaceChoices, reserves, standing, targetKind, visitChoices } from '../battle/engine';
import type { Action, Battle, Fighter, Mon } from '../battle/model';
import { MOVES } from '../battle/registry';
import { NOTION_IDS } from '../data/notions';
import { makeMon } from '../data/species';
import { makeFit, nameOptions, paletteOf, shapeOf, typeOptions } from './fitting';
import { input, type Btn } from '../engine/input';
import { heldSeat, type QueueKind } from '../net/client';
import { BUILD, type Choice } from '../net/lockstep';
import { loopback, loopFaults, type LoopOptions } from '../net/loopback';
import type { Link } from '../net/protocol';
import { BetweenScreen, byssus, CODE_CHARS, CodeEntry, forgetRoster, lastMatch, Linking, PickScreen, playMatch, rejoinMatch, ResultScreen, rosterNow, rosterScreen, RosterScreen, type MatchResult } from './online';
import { modes, run, top } from './modes';
import { G, heroName } from './state';
import { uiCheck } from './uicheck';
import { plannedKit, randomFit } from './wildfit';

/** The battle screen as the check drives it. Its class stays private to battleView.ts, so the check reads it by shape. */
interface View {
  b: Battle; phase: string; side: 0 | 1; foe: 0 | 1; sel: number; sub: number; msgText: string;
  options: { label: string; action?: Action; kind: string; i?: number; ok: boolean }[];
  net: { ls: { n: number }; end: unknown; awayUntil: number; link: Link & { trace?: string[] } } | null;
  me(): Fighter; targets(): { idx: number }[]; aimTargets(): { uid: number }[]; commit(a: Action): void; chooseNet(c: Choice): void;
  clockNow(): { left: number } | null;
  vslot: number; visitWays(i: number): { label: string; a: Action }[];
}
const asView = (m: unknown): View | null => {
  const v = m as View | null;
  return v && typeof v === 'object' && v.b && typeof v.phase === 'string' && v.net ? v : null;
};

interface Harness { setup(...a: unknown[]): void; run(n: number): Promise<void>; tap(b: Btn): Promise<void> }
const h = (): Harness => (window as unknown as { __h: Harness }).__h;

/** One match the check plays: a loopback room's options or a networked queue, and what the person does on purpose. */
interface Scenario {
  name: string;
  loop?: LoopOptions;
  /**
   * Plays through the Byssus menu against the rooms instead: the queue to use, the code a guest types, and the menu at
   * which the socket dies. 'rejoin' takes back the seat a reloaded page left.
   */
  net?: { kind: QueueKind | 'rejoin'; code?: string; drop?: number };
  /** Visits the roster check first and makes a problem and puts it right. */
  roster?: boolean;
  /** Never sends a pick, so the pick clock runs out. */
  lazyPick?: boolean;
  /** The number of the battle menu where the person lets the clock run out and of the one where the person gives up. Menus count from 1. */
  timeoutAt?: number;
  resignAt?: number;
  /** Opens the info view and the give-up question while waiting. */
  waitVisits?: boolean;
  /** The roster rows marked on the pick screen in order with the lead first. */
  marks?: number[];
  /** Picks Still Minute whenever the out whorl can cast it, so the battle goes back in time. */
  minute?: boolean;
  /** Lets the clock run out on the first choice this side makes in the past. */
  visitTimeout?: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: 'full', loop: { seed: 11, lag: 4 }, roster: true },
  { name: 'timeouts and resign', loop: { seed: 12, lag: 6 }, lazyPick: true, timeoutAt: 1, resignAt: 6 },
  { name: 'idle opponent', loop: { seed: 13, lag: 2, idle: true }, waitVisits: true },
  // Belt leads here, so its tag-out move opens the screen that asks who comes in after.
  { name: 'second full', loop: { seed: 14, lag: 0 }, marks: [4, 2, 0, 1] },
];

interface Report {
  running: boolean;
  scenario: string;
  /** How often each screen state was checked. */
  states: Record<string, number>;
  /** Each breach once: the state, the text, and what touched it. */
  breaches: string[];
  /** Anything that went wrong that is not a breach: a refused choice, a stuck screen, a void, or an error. */
  findings: string[];
  results: string[];
  /** A host's code, for the tab that plays the guest. */
  code?: string;
  /** Whether this tab showed the other player's away line, and whether its own link went slack and came back. */
  sawAway?: boolean;
  cameBack?: boolean;
  /** Choices this tab made in the past for Still Minute's visitor, and the ones it let time out. */
  visits?: number;
  visitTimeouts?: number;
}

let report: Report = { running: false, scenario: '', states: {}, breaches: [], findings: [], results: [] };
let lastYield = 0;
const channel = new MessageChannel();

/** Lets the page run now and then. It yields through a message rather than a timer because a hidden tab slows its timers to once a second. */
async function breathe(): Promise<void> {
  if (performance.now() - lastYield < 150) return;
  await new Promise<void>(r => { channel.port1.onmessage = () => r(); channel.port2.postMessage(0); });
  lastYield = performance.now();
}

/** Runs the breathing-room check on a screen state the first twice it shows in a scenario. */
function look(seen: Map<string, number>, state: string): void {
  const n = seen.get(state) || 0;
  if (n >= 2) return;
  seen.set(state, n + 1);
  report.states[state] = (report.states[state] || 0) + 1;
  for (const b of uiCheck()) {
    const line = `${state}: "${b.text}" at ${b.box.x},${b.box.y} touched by ${b.by} at ${b.at.x},${b.at.y} ${b.at.w}x${b.at.h}`;
    if (!report.breaches.includes(line)) report.breaches.push(line);
  }
}

/** A fresh game in test slot 9 with eight whorls that hold different notions and have moves that open every sub-screen of the battle menu. */
function setup(): void {
  let s = 7;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  h().setup([], {}, ['furcula', 'fleam', 'kiln', 'cellar'], 25, 'home', 4, 4);
  // A second Kiln waits in the Midden, so the roster check can show a kind used twice.
  G.rack.push(makeMon('belt', 25), makeMon('slackwater', 25), makeMon('kiln', 25, { name: 'Kiln Two' }), randomFit(rnd, 'talus', 'spume', 25));
  [...G.party, ...G.rack].forEach((m, i) => { plannedKit(rnd, m); m.notion = NOTION_IDS[(i * 3) % NOTION_IDS.length]; });
  forgetRoster();
}

async function moveRoster(slot: number): Promise<void> {
  const r = top() as RosterScreen;
  if (r instanceof RosterScreen) r.slot = slot;
  await h().run(1);
}

/** The roster check: as filled, with its list open, with a kind used twice, and put right again. */
async function rosterPart(seen: Map<string, number>): Promise<void> {
  const done = rosterScreen();
  await h().run(4);
  look(seen, 'roster');
  const all = [...G.party.filter(Boolean), ...G.rack];
  const dup = all.findIndex(m => m.name === 'Kiln Two'), orig = all.findIndex(m => m.kind === 'slackwater');
  await moveRoster(5);
  await h().tap('ok');
  look(seen, 'roster:list');
  for (let k = 0; k < (dup - orig + all.length) % all.length; k++) await h().tap('down');
  await h().tap('ok');
  await h().run(2);
  look(seen, 'roster:problem');
  if (!rosterNow().problems.length) report.findings.push('roster: a kind used twice raised no problem');
  await h().tap('ok');
  for (let k = 0; k < (orig - dup + all.length) % all.length; k++) await h().tap('down');
  await h().tap('ok');
  await h().run(2);
  if (rosterNow().problems.length) report.findings.push(`roster: still refused after the slot was put back: ${rosterNow().problems[0]}`);
  await h().tap('menu');
  look(seen, 'roster:inspect');
  await h().tap('back');
  await h().tap('back');
  await done;
}

async function pickTo(p: PickScreen, col: number, row: number): Promise<void> {
  if (p.col !== col) await h().tap('right');
  for (let k = 0; k < 8 && p.row !== row; k++) await h().tap(p.row < row ? 'down' : 'up');
}

/** The sub-screen Z opens on a menu option, or null when Z chooses at once. */
function opens(v: View, i: number): string | null {
  const o = v.options[i];
  if (!o?.ok) return null;
  if (o.kind === 'switch') return 'switch';
  if (o.kind === 'resign') return 'resign';
  if (o.kind === 'attack') return v.aimTargets().length > 1 ? 'aim' : null;
  if (o.kind !== 'move') return null;
  const f = v.me(), m = moveDef(f, o.i!);
  if (!m) return null;
  if (m.options) return 'opt';
  if (targetKind(f, m) !== 'none') return 'target';
  if (m.tag && reserves(v.b.s[v.side]).some(r => !barred(r))) return 'tagto';
  if (m.reach === 'single' && v.aimTargets().length > 1) return 'aim';
  return null;
}

/** Plays one scenario through to the end of its match. */
async function scenario(s: Scenario): Promise<void> {
  report.scenario = s.name;
  const seen = new Map<string, number>();
  if (s.roster) await rosterPart(seen);
  // A rejoin brings its rosters back from the room, so the page's own roster plays no part in it.
  const { roster, problems } = s.net?.kind === 'rejoin' ? { roster: [], problems: [] } : rosterNow();
  if (problems.length) { report.findings.push(`${s.name}: the roster was refused: ${problems[0]}`); return; }
  let result: MatchResult | null = null, failed = '', finished = false, resultSeen = false, watching = false;
  const fail = (e: Error) => { failed = e.stack || String(e); };
  if (s.net?.kind === 'rejoin') {
    // A rejoin the title already started is driven as it is, since a second one would take the seat from the first.
    watching = modes().some(m => m instanceof Linking || m instanceof PickScreen || m instanceof BetweenScreen || m instanceof ResultScreen || !!asView(m));
    const seat = heldSeat();
    if (!watching && !seat) { report.findings.push(`${s.name}: this page holds no seat to rejoin`); return; }
    if (!watching) void rejoinMatch(seat!).then(r => { result = r; finished = true; }, fail);
  } else if (s.net) {
    // The Byssus menu opens on its last choice, so the check sets that choice and presses Z.
    G.online = { roster: G.online?.roster ?? [], menu: ['public', 'host', 'join'].indexOf(s.net.kind) };
    void byssus().then(() => { finished = true; result = lastMatch; }, fail);
    await h().run(3);
    look(seen, 'net:menu');
    await h().tap('ok');
  } else void playMatch({ link: loopback(s.loop) }, roster, heroName()).then(r => { result = r; finished = true; }, fail);
  let menus = 0, timedOut = false, resigned = false, sawResign = false, dropped = false, tries = 0, lastN = -1, visitTimed = false, swapped = false;
  /** The pick screen of the game in hand once its four are sent, and whether an earlier game's pick screen had the full look. */
  let markedOn: PickScreen | null = null, toured = false;
  const visited = new Set<string>();
  for (let guard = 0; guard < 60000 && !finished && !failed; guard++) {
    await breathe();
    const t = top();
    if (t instanceof Linking) {
      look(seen, t.code ? 'net:code-shown' : 'net:linking');
      if (t.code) report.code = t.code;
      await h().run(10);
      continue;
    }
    if (t instanceof CodeEntry) {
      look(seen, 'net:code-entry');
      for (const ch of s.net?.code ?? '') { t.at = CODE_CHARS.indexOf(ch); await h().tap('ok'); }
      look(seen, 'net:code-typed');
      await h().tap('menu');
      continue;
    }
    if (t instanceof ResultScreen) {
      look(seen, 'net:result');
      report.results.push(`${s.name}: ${t.head} ${t.why.join(' ')}`.trim());
      resultSeen = true;
      t.sel = t.choices.length - 1;
      await h().tap('ok');
      continue;
    }
    if (t instanceof BetweenScreen) {
      look(seen, t.sent ? 'net:between-wait' : 'net:between');
      if (t.end.why === 'resign') sawResign = true;
      if (!t.sent) { t.sel = 0; await h().tap('ok'); }
      await h().run(10);
      continue;
    }
    // A watched rejoin is done once its result closes. Back on the Byssus menu after a result, the check leaves it.
    if (resultSeen && watching && !asView(t) && !(t instanceof PickScreen)) { result = lastMatch; finished = true; continue; }
    if (resultSeen && !asView(t) && !(t instanceof PickScreen)) { await h().tap('back'); await h().run(2); continue; }
    if (t instanceof PickScreen) {
      if (t.picked) { look(seen, t.picked.timeout[t.me] ? 'pick:timeout-reveal' : 'pick:reveal'); await h().run(10); continue; }
      if (t.ended) { look(seen, 'pick:end'); await h().tap('ok'); continue; }
      if (s.lazyPick || markedOn === t) { look(seen, 'pick'); await h().run(20); continue; }
      look(seen, 'pick');
      for (const r of s.marks ?? [2, 0, 5, 1]) { await pickTo(t, 0, r); await h().tap('ok'); }
      look(seen, 'pick:marked');
      markedOn = t;
      // Later games of a match send their four at once.
      if (toured) { await pickTo(t, 0, 6); await h().tap('ok'); if (!t.locked) report.findings.push(`${s.name}: Ready did not send a later game's pick`); continue; }
      toured = true;
      await pickTo(t, 0, 2); await h().tap('menu'); look(seen, 'inspect:mine'); await h().tap('back');
      await pickTo(t, 1, 3); await h().tap('ok');
      if (t.order.length !== 4 || top() !== t) report.findings.push(`${s.name}: Z on the other side's whorl did something`);
      look(seen, 'pick:theirs');
      await h().tap('menu'); look(seen, 'inspect:theirs'); await h().tap('back');
      await pickTo(t, 0, 6); await h().tap('ok'); look(seen, 'pick:sent');
      await h().tap('back'); look(seen, 'pick:taken-back');
      await h().tap('ok');
      if (!t.locked) report.findings.push(`${s.name}: Ready did not send the pick`);
      continue;
    }
    const v = asView(t);
    if (!v) { await h().run(2); continue; }
    // The standing lines while a link is down: the other player's hold, and this page's own link coming back.
    if (v.net!.awayUntil > Date.now()) { report.sawAway = true; look(seen, 'battle:away'); }
    if ((v.net!.link.slack?.() ?? 0) > 0) look(seen, 'battle:slack');
    if (v.net!.link.trace?.some(l => l.includes('in rejoin'))) report.cameBack = true;
    const ph = v.phase;
    if (ph === 'end') { look(seen, 'battle:end'); await h().tap('ok'); continue; }
    if (ph === 'events') {
      look(seen, v.msgText.startsWith('Time ran out') ? 'battle:events-timeout' : v.msgText.includes('ran out of time') ? 'battle:events-their-timeout' : 'battle:events');
      input.hold('fast', true);
      await h().run(6);
      input.hold('fast', false);
      continue;
    }
    if (ph === 'wait') {
      look(seen, 'battle:wait');
      if (s.waitVisits && !visited.has('wait')) {
        visited.add('wait');
        await h().tap('left'); look(seen, 'battle:wait-info'); await h().tap('back');
        await h().tap('back'); look(seen, 'battle:wait-resign'); await h().tap('back');
      }
      await h().run(10);
      continue;
    }
    if (ph === 'replace') {
      look(seen, 'battle:replace');
      const choices = replaceChoices(v.b, v.side), want = chooseReplacement(clone(v.b), v.side), idx = choices.includes(want) ? want : choices[0];
      v.sub = Math.max(0, standing(v.b.s[v.side]).findIndex(f => f.idx === idx));
      await h().tap('ok');
      if (v.phase === 'replace') { report.findings.push(`${s.name}: the replace screen kept its place on ${idx}`); v.chooseNet(idx); }
      continue;
    }
    if (ph !== 'menu') { await h().tap('back'); continue; }
    // Still Minute's visitor picks its move in the past through its own menu, takes an ally's place the first time it can,
    // and lets its clock run out once when the scenario says so.
    if (v.b.need?.kind === 'visit' && v.b.visit) {
      look(seen, 'battle:visit');
      // A person checking the screens by hand may hold the visitor's choice with window.__holdVisit.
      while ((window as unknown as { __holdVisit?: boolean }).__holdVisit && !finished) { await breathe(); await h().run(10); }
      if (s.visitTimeout && !visitTimed) {
        visitTimed = true;
        report.visitTimeouts = (report.visitTimeouts || 0) + 1;
        while (v.phase === 'menu' && !finished) { await breathe(); await h().run(60); }
        continue;
      }
      const body = v.b.visit.body, swaps = visitChoices(v.b).filter(x => x.k === 'move' && MOVES[body.moves[x.i]]?.tag);
      const a = s.minute && swaps.length && !swapped ? swaps[0] : chooseVisit(clone(v.b), v.side);
      if (a === swaps[0]) swapped = true;
      const i = v.options.findIndex(o => (a.k === 'move' ? o.kind === 'move' && o.i === a.i : o.kind === 'wait'));
      v.sel = Math.max(0, i);
      await h().tap('ok');
      if (v.phase === 'vpick') {
        look(seen, 'battle:vpick');
        v.sub = Math.max(0, v.visitWays(v.vslot).findIndex(w => JSON.stringify(w.a) === JSON.stringify(a)));
        await h().tap('ok');
      }
      report.visits = (report.visits || 0) + 1;
      continue;
    }
    menus++;
    // A socket that dies with nothing said: the testing note for `wrangler dev` says to dispatch the close event by hand.
    if (s.net?.drop === menus && !dropped) {
      dropped = true;
      const ws = (v.net as unknown as { link: { ws: WebSocket | null } }).link.ws;
      ws?.dispatchEvent(new CloseEvent('close', { code: 1006, wasClean: false }));
      await h().run(4);
      continue;
    }
    const ck = v.clockNow();
    look(seen, ck && ck.left <= 600 ? 'battle:menu-warn' : 'battle:menu');
    if (s.timeoutAt === menus && !timedOut) {
      // The person lets this decision's clock run out, and the room answers for them.
      timedOut = true;
      while (v.phase === 'menu' && !finished) { await breathe(); await h().run(60); const c = v.clockNow(); if (c && c.left <= 600) look(seen, 'battle:menu-warn'); }
      continue;
    }
    const giveUp = v.options.findIndex(o => o.kind === 'resign');
    if (s.resignAt === menus && !resigned) {
      resigned = true;
      v.sel = giveUp; await h().tap('ok'); look(seen, 'battle:resign');
      v.sub = 0; await h().tap('ok');
      continue;
    }
    // Each sub-screen opens once a scenario before the real choice and is backed out of.
    if (!visited.has('info')) { visited.add('info'); await h().tap('left'); look(seen, 'battle:info'); await h().tap('back'); continue; }
    if (!visited.has('resign') && giveUp >= 0) { visited.add('resign'); v.sel = giveUp; await h().tap('ok'); look(seen, 'battle:resign'); await h().tap('back'); continue; }
    const peek = v.options.findIndex((_, i) => { const w = opens(v, i); return !!w && w !== 'resign' && !visited.has(w); });
    if (peek >= 0) {
      const w = opens(v, peek)!;
      visited.add(w);
      v.sel = peek; await h().tap('ok');
      if (v.phase !== w) report.findings.push(`${s.name}: ${v.options[peek].label} opened ${v.phase} where ${w} was expected`);
      look(seen, `battle:${v.phase}`);
      // A tag-out move with a target asks who comes in after the target, so that screen opens from here too.
      const m = v.options[peek].kind === 'move' ? moveDef(v.me(), v.options[peek].i!) : null;
      if (v.phase === 'target' && m?.tag && m.reach !== 'reserveAlly' && reserves(v.b.s[v.side]).length) {
        await h().tap('ok');
        visited.add('tagto');
        look(seen, `battle:${v.phase}`);
      }
      if (v.phase !== 'wait') await h().tap('back');
      continue;
    }
    // The real choice is the AI's own pick for this side. The check makes it through the menu and its sub-screens.
    const n = v.net!.ls.n;
    tries = n === lastN ? tries + 1 : 0;
    lastN = n;
    // With `minute`, a whorl holding Still Minute casts it when it can, and until then guards and attacks by turns for tide.
    const holds = !!s.minute && out(v.b, v.side).moves.includes('slackwater_minute'), ls = holds ? legal(v.b, v.side) : [];
    const sm = ls.find(x => x.k === 'move' && moveDef(out(v.b, v.side), x.i)?.id === 'slackwater_minute') ?? ls.find(x => x.k === 'guard') ?? ls.find(x => x.k === 'attack' && !x.aim);
    const a = sm ?? aiChoose(clone(v.b), v.side);
    if (tries >= 2) { report.findings.push(`${s.name}: the menu could not make ${JSON.stringify(a)} at decision ${n}`); v.commit(a); continue; }
    const i = v.options.findIndex(o => (a.k === 'move' ? o.kind === 'move' && o.i === a.i : a.k === 'switch' ? o.kind === 'switch' : o.action?.k === a.k && (a.k !== 'take' || (o.action as { i?: number }).i === a.i)));
    if (i < 0 || !v.options[i].ok) { report.findings.push(`${s.name}: the menu has no usable option for ${JSON.stringify(a)}`); v.commit(a); continue; }
    v.sel = i;
    await h().tap('ok');
    for (let k = 0; k < 4 && ['opt', 'target', 'tagto', 'aim', 'switch'].includes(v.phase); k++) {
      look(seen, `battle:${v.phase}`);
      const at = <T>(list: T[], hit: (x: T) => boolean) => Math.max(0, list.findIndex(hit));
      if (v.phase === 'opt') v.sub = a.k === 'move' ? a.opt ?? 0 : 0;
      else if (v.phase === 'target') v.sub = at(v.targets(), x => a.k === 'move' && x.idx === a.target);
      else if (v.phase === 'tagto') v.sub = at(v.targets(), x => a.k === 'move' && x.idx === a.tagTo);
      else if (v.phase === 'aim') v.sub = at(v.aimTargets(), x => x.uid === ((a as { aim?: number }).aim || 0));
      else v.sub = at(reserves(v.b.s[v.side]), x => a.k === 'switch' && x.idx === a.to);
      await h().tap('ok');
    }
  }
  input.hold('fast', false);
  if (failed) { report.findings.push(`${s.name}: the match threw: ${failed}`); return; }
  const r = result as MatchResult | null;
  // A loopback match ends with its link open for a rematch, and the check leaves the room.
  r?.link?.close();
  if (!r) { report.findings.push(`${s.name}: no result after the frame limit, on ${modes().length} screens`); return; }
  const e = r.end, mine = r.match?.side ?? r.side;
  report.results.push(`${s.name}: ${e ? `${e.why}, ${e.winner === null ? 'no winner' : e.winner === mine ? 'this side won' : 'the other side won'}` : r.refused ? `refused: ${r.refused}` : 'no end'}`);
  if (!e || e.why === 'void') report.findings.push(`${s.name}: the match ended with no result`);
  if (s.net?.drop && !report.cameBack) report.findings.push(`${s.name}: the link that died never came back`);
  if (s.resignAt && resigned && e?.why !== 'resign' && !sawResign) report.findings.push(`${s.name}: giving up ended the game as ${e?.why}`);
}

/**
 * Leads the check's team with a fit of Tynagi and `partner` that keeps Still Minute, Still Lap, and the partner's moves in
 * `keep`, with four whorls of other kinds behind it, each holding a notion of its own. Returns the fit's moves or the
 * roster's problems.
 */
function minuteTeam(partner: string, keep: string[]): string {
  const A = makeMon('slackwater', 25), B = makeMon(partner, 25);
  const sprite = { px: shapeOf(A.sprite, B.sprite, 1), c: paletteOf(A.sprite, B.sprite, 0) };
  const fit: Mon = makeFit(A, B, { moves: ['slackwater_minute', 'slackwater_lap', ...keep], passives: ['slackwater_turn', B.passives[0]], types: typeOptions(A, B)[0], basic: A.basic, retune: null, sprite, name: nameOptions(A.name, B.name)[0] || A.name, look: { shape: 1, palette: 0 } }, 0);
  const rest = ['furcula', 'fleam', 'cellar', 'belt', 'cairn'].filter(k => k !== partner).map(k => makeMon(k, 25));
  G.party = [fit, ...rest.slice(0, 3)];
  G.rack = rest.slice(3, 5);
  // Tide Mark's tide for each guard lets the fit reach Still Minute's 6 tide by the third round.
  const others = NOTION_IDS.filter(n => n !== 'tidemark');
  [...G.party, ...G.rack].forEach((m, i) => { m.notion = i ? others[(i * 3) % others.length] : 'tidemark'; });
  forgetRoster();
  const { problems } = rosterNow();
  return problems.length ? problems.join(' ') : `${fit.name}: ${fit.moves.join(', ')}`;
}

/** Plays one networked match through the Byssus menu against the rooms, or takes back a held seat, in the background. */
async function netCheck(kind: QueueKind | 'rejoin', code?: string, opts: { resignAt?: number; drop?: number; lazyPick?: boolean; minute?: boolean; visitTimeout?: boolean; marks?: number[]; keep?: boolean } = {}): Promise<void> {
  report = { running: true, scenario: '', states: {}, breaches: [], findings: [], results: [] };
  try {
    // A rejoin plays on the file the reloaded page loads, and `keep` plays with the team set up already, so both keep the game as it is.
    if (kind !== 'rejoin' && !opts.keep) setup();
    await scenario({ name: `net ${kind}`, net: { kind, code, drop: opts.drop }, resignAt: opts.resignAt, lazyPick: opts.lazyPick, minute: opts.minute, visitTimeout: opts.visitTimeout, marks: opts.marks });
  } catch (e) {
    report.findings.push(`the check threw: ${(e as Error).stack || e}`);
  } finally {
    input.hold('fast', false);
    report.running = false;
  }
}

async function check(only?: number): Promise<void> {
  report = { running: true, scenario: '', states: {}, breaches: [], findings: [], results: [] };
  try {
    setup();
    for (let k = 0; k < SCENARIOS.length; k++) if (only === undefined || only === k) await scenario(SCENARIOS[k]);
  } catch (e) {
    report.findings.push(`the check threw: ${(e as Error).stack || e}`);
  } finally {
    input.hold('fast', false);
    report.running = false;
  }
}

/** Plays one loopback match by hand with the current roster. The roster check opens first when the roster cannot queue. */
async function playByHand(o: LoopOptions = {}): Promise<MatchResult | string> {
  if (rosterNow().problems.length) await rosterScreen();
  const { roster, problems } = rosterNow();
  if (problems.length) return `The roster cannot queue: ${problems[0]}`;
  return playMatch({ link: loopback(o) }, roster, heroName());
}

(window as unknown as { __online: unknown }).__online = {
  roster: rosterScreen,
  loopback: playByHand,
  byssus,
  /** Starts the check in the background. A number runs only that scenario. */
  check(only?: number): string { if (report.running) return 'already running'; void check(only); return 'started'; },
  /** Opens one online screen with sample contents, for a look at it: 'result', 'code', or 'host' (a real code from the lobby). */
  show(kind: 'result' | 'code' | 'host'): void {
    if (kind === 'code') void run(new CodeEntry());
    else if (kind === 'host') void run(new Linking({ kind: 'host' }, { type: 'hello', build: BUILD, name: heroName(), roster: rosterNow().roster }));
    else void run(new ResultScreen({ end: { type: 'end', why: 'resign', winner: 1, wins: [1, 2], final: true, matchWinner: 1 }, match: { type: 'match', side: 1, token: '', names: ['Tellin', 'Ouro'], rosters: [[], []], seed: 1, deal: 1, game: 3, wins: [1, 1], clock: { pick: 90, choice: 60, replace: 30 } } }));
  },
  /**
   * Starts a networked match in the background: 'public', 'host', or 'join' with the host's code from the other tab's
   * report, or 'rejoin' for the seat a reloaded page left. `drop` kills the socket at that menu, and the link comes back.
   */
  net(kind: QueueKind | 'rejoin', code?: string, opts?: { resignAt?: number; drop?: number; lazyPick?: boolean; minute?: boolean; visitTimeout?: boolean; marks?: number[]; keep?: boolean }): string { if (report.running) return 'already running'; void netCheck(kind, code, opts); return 'started'; },
  /** Leads the team with a Tynagi fit that keeps Still Minute: call it after setup, then net(..., { keep: true, minute: true }). */
  minute: minuteTeam,
  /** The seat this page holds, for a test that reloads the page during a match. */
  seat: heldSeat,
  /** Messages the loopback room's readers refused. Each one is a message the real room or a real client would refuse too. */
  faults: () => loopFaults.slice(),
  report: () => report,
  setup,
};
