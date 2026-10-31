// Byssus, online play: the menu at the grotto counter, the roster check, the wait for a match, a code to type, the pick
// screen, the inspect view, the wait between games, and the result with its rematch. A match is the best of three games and
// runs through a room on the server or a loopback room (Notes/online-design.md).
import type { Mon } from '../battle/model';
import { NOTIONS } from '../battle/registry';
import { SPECIES } from '../data/species';
import type { Type } from '../data/types';
import { bigText, bigWidth, text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { introduceByssus } from '../content/byssus';
import { sfx } from '../engine/audio';
import { dither, frame, mix, rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { CANCELED, cancelQueue, heldSeat, leaveByssus, NetLink, queue, renewQueue, type HeldSeat, type QueueKind } from '../net/client';
import { BUILD, Lockstep, rebuild, teamsFromPicks, type PickRelease } from '../net/lockstep';
import { nameBlocked, shownPlayerName, STRANGER } from '../net/names';
import { FORMAT, GAMES_MAX, NEXT_SECONDS, reasonText, type EndMsg, type Hello, type Link, type MatchMsg, type RejoinMsg } from '../net/protocol';
import { placeholderRoster, RANDOM_FORMAT, randomRosters } from '../net/random';
import { DEFAULT_PICK, monFromWire, ROSTER_SIZE, shownWhorlName, TEAM_SIZE, teamProblems, whorlProblems, wireFromMon, wireKinds, type WireMon } from '../net/wire';
import { field, tanneryExtras } from './api';
import { onlineBattle } from './battleView';
import { choose } from './dialogue';
import { listMenu, monPage } from './menus';
import { close, run, top, type Mode } from './modes';
import { addToTally, byssusUnlocked, G, heroName, onlineTally, save, slotNow } from './state';
import { drawNight, nightFrame } from './title';
import { BADC, bevel, panel, DIM, GOOD, MINE, miniSigil, NERVE, PAPER, rowBar, SEL, THEIRS, WARN } from './ui';

const PANEL = '#1e1b26', EDGE = '#3a3442', HILITE = '#2a2632', SPENT = '#2a2632';
/** The two sides on the pick screen in the battle's own side colors: this side's cards raised and lit, the other side's flat. */
const ALLY_FILL = mix(MINE, INK, 0.84), ALLY_LIT = mix(MINE, INK, 0.56), ALLY_SHADE = mix(MINE, INK, 0.55);
const FOE_FILL = mix(THEIRS, INK, 0.86), FOE_EDGE = mix(THEIRS, INK, 0.45), LOOK = mix(THEIRS, PAPER, 0.45), DIVIDE = '#4a4660';
const backdrop = () => drawNight(nightFrame(), { dim: 0.6, figures: false });

/** A raised card: lit along its top and left edges and shaded along its bottom and right, in gold under the cursor. */
function raised(x: number, y: number, w: number, h: number, fill: string, on: boolean): void {
  const lit = on ? SEL : MINE, shade = on ? mix(SEL, INK, 0.45) : ALLY_SHADE;
  rect(x, y, w, h, fill);
  rect(x, y, w, 1, lit);
  rect(x, y, 1, h, lit);
  rect(x, y + h - 1, w, 1, shade);
  rect(x + w - 1, y + 1, 1, h - 1, shade);
}

/** Cuts a string to fit a width and ends it with a period when cut. */
function fit(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  while (s.length > 1 && textWidth(s + '.') > w) s = s.slice(0, -1);
  return s + '.';
}

/** A hint along the bottom on a dark band, so the night sky's moving specks never touch it. */
function hintLine(s: string, c = DIM): void {
  rect(0, 181, 192, 11, INK);
  textCenter(s, 96, 183, c);
}

const nacreOf = (m: Mon): number => Object.values((m.tan as Record<string, number> | undefined) || {}).reduce((a, v) => a + (v || 0), 0);

/** Seconds as minutes and seconds. */
const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The standing line while a link is down: this side's own as it comes back, or the other side's with its hold counting
 * down to `awayUntil` on this page's clock. A hidden tab runs few frames, so the hold counts time rather than frames.
 */
function linkLine(link: Link, awayUntil: number, name: string): string {
  const mine = link.slack?.() ?? 0;
  if (mine > 0) return `The byssus went slack. ${mmss(mine)}`;
  const held = awayUntil ? Math.max(0, Math.ceil((awayUntil - Date.now()) / 1000)) : 0;
  return held > 0 ? `${name} dropped. Held ${mmss(held)}` : '';
}

// ---------------------------------------------------------------- the roster

/** The save's online record: the roster by uid in slot order (-1 for an empty slot) and the last Byssus menu choice. */
function onlineSave(): { roster: number[]; menu: number } {
  return (G.online ??= { roster: [], menu: 0 });
}
/** The roster slot the cursor was on last. */
let lastSlot = 0;

const owned = (): Mon[] => [...G.party.filter(Boolean), ...G.rack];

/** Whether a whorl can join a roster without breaking a rule on its own or across the roster. */
function fitsWith(roster: WireMon[], w: WireMon): boolean {
  if (whorlProblems(w).length) return false;
  const kinds = new Set(roster.flatMap(wireKinds)), legend = (x: WireMon) => wireKinds(x).some(k => SPECIES[k]?.legendary);
  if (wireKinds(w).some(k => kinds.has(k))) return false;
  if (w.notion && roster.some(x => x.notion === w.notion)) return false;
  return !(legend(w) && roster.some(legend));
}

/** A first roster: the team and then the Midden in order without any whorl that would break a rule, and then anyone left. */
function autoFill(all: Mon[]): number[] {
  const out: Mon[] = [];
  for (const m of all) if (out.length < ROSTER_SIZE && fitsWith(out.map(wireFromMon), wireFromMon(m))) out.push(m);
  for (const m of all) if (out.length < ROSTER_SIZE && !out.includes(m)) out.push(m);
  return out.map(m => m.uid);
}

/** The roster's whorls in slot order. A slot is null when it is empty or its whorl was released or conjoined since. */
function rosterMons(): (Mon | null)[] {
  const all = owned(), o = onlineSave();
  if (!o.roster.length) o.roster = autoFill(all);
  return Array.from({ length: ROSTER_SIZE }, (_, i) => all.find(m => m.uid === o.roster[i]) ?? null);
}

/** Forgets the roster, so the next visit fills it again from the team and the Midden. Tests that start a new game call it. */
export function forgetRoster(): void { onlineSave().roster = []; lastSlot = 0; }

/** The roster in its wire form and every reason it cannot queue. */
export function rosterNow(): { roster: WireMon[]; problems: string[] } {
  const roster = rosterMons().filter((m): m is Mon => !!m).map(wireFromMon);
  return { roster, problems: teamProblems(roster) };
}

/** Lines that say which of the player's own names the word filter refuses, and what the other player sees in their place. */
function nameNotes(ms: (Mon | null)[]): string[] {
  const out: string[] = [];
  if (nameBlocked(heroName())) out.push(`Your online name is ${STRANGER}.`);
  for (const m of ms) if (m && nameBlocked(m.name)) out.push(`${m.name} is online as ${shownWhorlName({ ...wireFromMon(m), name: '' })}.`);
  return out;
}

/** A whorl as it fights online at level 25 with its nacre and notion. A whorl the wire cannot carry shows as it is. */
function asOnline(m: Mon): Mon {
  const w = wireFromMon(m);
  return whorlProblems(w).length ? m : monFromWire(w, 0, 0);
}

/** Opens a whorl's summary page with no experience bar and with `over` drawn on top of it. */
function inspect(m: Mon, over?: () => void): Promise<void> {
  return monPage(m, { noXp: true, over });
}

export class RosterScreen implements Mode {
  opaque = true;
  t = 0;
  slot = lastSlot;
  busy = false;

  update(): void {
    this.t++;
    if (this.busy) return;
    const col = this.slot % 2, row = Math.floor(this.slot / 2);
    if (input.hit('left') || input.hit('right')) { this.slot = row * 2 + 1 - col; sfx('move'); }
    if (input.hit('up')) { this.slot = ((row + 2) % 3) * 2 + col; sfx('move'); }
    if (input.hit('down')) { this.slot = ((row + 1) % 3) * 2 + col; sfx('move'); }
    lastSlot = this.slot;
    if (input.hit('back')) { sfx('back'); close(this); return; }
    if (input.hit('menu')) {
      const m = rosterMons()[this.slot];
      if (m) { sfx('ok'); this.wait(inspect(asOnline(m))); } else sfx('bump');
      return;
    }
    if (input.hit('ok')) { sfx('ok'); this.wait(this.change(this.slot)); }
  }

  /** Holds the screen still while another screen runs over it. */
  wait(p: Promise<unknown>): void {
    this.busy = true;
    void p.finally(() => { this.busy = false; });
  }

  /** Puts a whorl from the team or the Midden in slot i. A whorl already in another slot trades places with this one. */
  async change(i: number): Promise<void> {
    const all = owned(), roster = rosterMons(), cur = roster[i];
    const items = all.map(m => { const k = roster.indexOf(m); return k >= 0 ? `${m.name} (${k + 1})` : m.name; });
    const k = await listMenu(`Slot ${i + 1}`, items, { w: 112, start: cur ? Math.max(0, all.indexOf(cur)) : 0, detail: j => this.detail(all[j]) });
    if (k < 0) return;
    const uids = roster.map(m => m?.uid ?? -1), from = roster.indexOf(all[k]);
    if (from >= 0) uids[from] = uids[i];
    uids[i] = all[k].uid;
    onlineSave().roster = uids;
  }

  /** The list's detail: the whorl's sprite, types, notion, nacre, and a fit's two kinds. */
  detail(m: Mon | undefined): void {
    if (!m) return;
    panel(120, 4, 68, 112);
    rect(124, 8, 34, 34, INK);
    drawSprite(m.sprite, 125, 9, 4);
    m.types.forEach((t, j) => miniSigil(t as Type, 162, 9 + j * 8));
    const n = m.notion ? NOTIONS[m.notion] : null, nacre = nacreOf(m);
    let y = 46;
    for (const l of wrap(n ? `Holds ${n.name}` : 'Holds nothing', 60)) { text(l, 124, y, n ? NERVE : DIM); y += 9; }
    text(`Nacre ${nacre}`, 124, y, nacre ? GOOD : DIM);
    y += 9;
    if (m.fitted && m.parents) for (const l of wrap(`From ${m.parents[0]} and ${m.parents[1]}`, 60)) { if (y < 106) text(l, 124, y, DIM); y += 9; }
  }

  draw(): void {
    backdrop();
    rect(0, 0, 192, 15, INK);
    const ms = rosterMons(), { problems } = rosterNow(), wires = ms.map(m => (m ? wireFromMon(m) : null));
    text('Roster', 6, 4, SEL);
    textRight(problems.length ? `${problems.length} to fix` : 'Ready to link', 186, 4, problems.length ? BADC : GOOD);
    ms.forEach((m, i) => {
      const others = wires.filter((w, j): w is WireMon => !!w && j !== i);
      this.card(m, i, 2 + (i % 2) * 96, 16 + Math.floor(i / 2) * 42, !this.busy && i === this.slot, !!wires[i] && !fitsWith(others, wires[i]!));
    });
    frame(2, 143, 188, 37, PANEL, EDGE);
    // Problems come first, since the roster cannot queue with them. A name that shows as a stand-in online is only a note.
    const lines: [string, string][] = problems.length ? problems.flatMap(p => wrap(p, 180).map((l): [string, string] => [l, BADC]))
      : [...nameNotes(ms), 'Six displayed, four to battle, all at level 25.'].flatMap((p, k, all) => wrap(p, 180).map((l): [string, string] => [l, k < all.length - 1 ? WARN : PAPER]));
    lines.slice(0, 3).forEach(([l, c], k) => text(l, 6, 146 + k * 9, c));
    hintLine('Z swaps, V sees, X ends.');
    // A list or a page open over the roster dims it, so nothing behind shows between the list and its detail.
    if (this.busy) dither(0, 0, 192, 192, INK, 0.55);
  }

  /** One slot: its number and the whorl's sprite, name, types, nacre, notion, and a fit's two kinds. */
  card(m: Mon | null, i: number, x: number, y: number, on: boolean, bad: boolean): void {
    frame(x, y, 92, 40, on ? HILITE : PANEL, on ? SEL : bad ? BADC : EDGE);
    textRight(String(i + 1), x + 89, y + 4, DIM);
    if (!m) { text('Empty', x + 32, y + 4, DIM); return; }
    rect(x + 3, y + 3, 26, 26, INK);
    drawSprite(m.sprite, x + 4, y + 4, 3);
    text(fit(m.name, 50), x + 32, y + 4, on ? SEL : PAPER);
    m.types.forEach((t, k) => miniSigil(t as Type, x + 32 + k * 7, y + 15));
    const nacre = nacreOf(m);
    textRight(`nacre ${nacre}`, x + 89, y + 13, nacre ? GOOD : DIM);
    if (m.fitted && m.parents) text(fit(`${m.parents[0]} + ${m.parents[1]}`, 56), x + 32, y + 22, DIM);
    const n = m.notion ? NOTIONS[m.notion] : null;
    text(fit(n ? n.name : 'Holds nothing', 84), x + 4, y + 30, n ? NERVE : DIM);
  }
}

/** Opens the roster check. Resolves when the player backs out. */
export function rosterScreen(): Promise<void> {
  return run<void>(new RosterScreen());
}

// ---------------------------------------------------------------- waiting for a match

/** What starts a match: a link already open, such as a loopback room's, a queue request that opens one, or a held seat to take back. */
export type Start = { link: Link } | { kind: QueueKind; code?: string; random?: boolean } | { resume: HeldSeat };

/** Whether a start is a random battle, whose rosters both sides build from the room's seed. */
const isRandom = (s: Start): boolean => ('kind' in s && !!s.random) || ('resume' in s && !!s.resume.random);

/** How a wait ended: the match on its link, a held seat's match taken back, a refusal or an end before any match, or null when the player canceled. */
type Linked = { link: Link; m: MatchMsg } | { link: Link; r: RejoinMsg } | { link: Link | null; end?: EndMsg; refused?: string } | null;

/** A frame count as minutes and seconds. */
const clockText = (frames: number): string => { const s = Math.floor(frames / 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Asks the lobby for a room when the start needs one, says hello, and waits for the match while the night sky shows. */
export class Linking implements Mode {
  opaque = true;
  t = 0;
  link: Link | null = null;
  /** The room and the code the lobby gave, kept to cancel the place. */
  room = '';
  code = '';
  /** Frames since the room answered, and the frame of the last renewal of a public place. */
  waited = 0;
  renewedAt = 0;
  asking = false;
  refused = '';
  done = false;

  /** A held seat's link sends its own hello with the seat's token, so `hello` is null for it. */
  constructor(readonly start: Start, readonly hello: Hello | null) {
    if ('link' in start) { this.open(start.link); return; }
    if ('resume' in start) { this.open(new NetLink(start.resume.room, { resume: start.resume.token, slot: start.resume.slot, side: start.resume.side, foe: start.resume.foe, random: start.resume.random })); return; }
    this.asking = true;
    void queue(start.kind, start.code, start.random ? RANDOM_FORMAT : FORMAT).then(reply => {
      this.asking = false;
      // A reply that came after the player left was dropped by `queue`, which gave its place back.
      if (this.done || (!reply.ok && reply.reason === CANCELED)) return;
      if (!reply.ok) { this.refused = reply.reason; return; }
      this.room = reply.room;
      this.code = reply.code ?? '';
      this.open(new NetLink(reply.room, { slot: slotNow(), random: !!start.random }));
    });
  }

  open(link: Link): void {
    this.link = link;
    if (this.hello) link.send(this.hello);
  }

  // `run` sets `finish` on every mode as its resolver, so the method that closes this screen needs another name.
  stop(v: Linked): void {
    this.done = true;
    close(this, v);
  }

  tick(): void {
    if (this.done) return;
    if (this.refused) { this.stop({ link: this.link, refused: this.refused }); return; }
    const link = this.link;
    if (!link) return;
    link.tick();
    this.waited++;
    // A public place lapses after two minutes unless renewed, so the wait renews it every minute.
    if ('kind' in this.start && this.start.kind === 'public' && this.room && this.waited - this.renewedAt >= 3600) { this.renewedAt = this.waited; void renewQueue(this.room); }
    // Reading stops at the match, and the pick screen reads what follows.
    for (let m = link.poll(); m; m = link.poll()) {
      if (m.type === 'match') { sfx('link'); this.stop({ link, m }); return; }
      if (m.type === 'rejoin') { sfx('ok'); this.stop({ link, r: m }); return; }
      if (m.type === 'end') { this.stop({ link, end: m, refused: link instanceof NetLink ? link.problem : '' }); return; }
      if (m.type === 'refused') { this.stop({ link, refused: m.reason }); return; }
    }
  }

  update(): void {
    this.t++;
    if (!input.hit('back')) return;
    sfx('back');
    // A guest's code belongs to its host, so only a place this client opened goes back to the lobby.
    if (this.room && 'kind' in this.start && this.start.kind !== 'join') void cancelQueue(this.room, this.code || undefined);
    leaveByssus();
    this.link?.close();
    this.stop(null);
  }

  draw(): void {
    backdrop();
    const host = 'kind' in this.start && this.start.kind === 'host';
    if (host && this.code) {
      panel(36, 54, 120, 74, undefined, { head: 11 });
      textCenter('Your code', 96, 57, SEL);
      bigText(this.code, Math.round(96 - bigWidth(this.code, 2) / 2), 74, 2, PAPER);
      textCenter('It lasts for 15 minutes.', 96, 98, DIM);
      textCenter(`Spinning. ${clockText(this.waited)}`, 96, 112, PAPER);
    } else {
      const s = 'resume' in this.start ? `Spinning the byssus again. ${mmss(this.link?.slack?.() ?? 0)}`
        : this.asking ? 'Inquiring with the lobby.' : this.link ? `Spinning. ${clockText(this.waited)}` : 'Spinning.';
      const w = Math.max(100, textWidth(s) + 16) & ~1;
      panel(96 - w / 2, 80, w, 24);
      textCenter(s, 96, 88, PAPER);
    }
    hintLine('X cancels.');
  }
}

// ---------------------------------------------------------------- the pick

const ROW_Y = 27, ROW_STEP = 23, READY = 6;

/** The pick screen: both rosters, the 90-second clock, four marks in battle order, Ready, and then both fours together. */
export class PickScreen implements Mode {
  opaque = true;
  t = 0;
  left: number;
  readonly total: number;
  readonly me: 0 | 1;
  /** Both rosters as they fight with this side's first. */
  readonly mons: [Mon[], Mon[]];
  /** The cursor: column 0 is this side and 1 the other, rows 0 to 5 the whorls, and row 6 this side's Ready. */
  col = 0;
  row = 0;
  /** This side's marks as roster indexes in battle order with the lead first. */
  order: number[] = [];
  /** True from Ready until the player takes the pick back. The room keeps the last pick sent. */
  locked = false;
  picked: PickRelease | null = null;
  ended: EndMsg | null = null;
  /** Why this side refused the other roster while the room ends the match. */
  refused = '';
  /** Frames since the picks or the end came. */
  shown = 0;
  note = '';
  noteT = 0;
  /** A rejoin that came with the picks already released, which the battle needs for the releases it carries. */
  rejoin: RejoinMsg | null = null;
  /** When the other side's seat hold ends by this page's clock while its link is down, or 0. */
  awayUntil = 0;

  /** A seat taken back during the pick passes the room's rejoin as `r`, with the pick clock's time and the pick already sent. */
  constructor(readonly link: Link, readonly m: MatchMsg, r: RejoinMsg | null = null) {
    this.me = m.side;
    this.total = this.left = m.clock.pick * 60;
    const foe = (1 - m.side) as 0 | 1, bad = teamProblems(m.rosters[foe]);
    if (bad.length) { this.refused = bad[0]; link.send({ type: 'foul', n: -1, why: reasonText(bad.join(' ')) }); }
    this.mons = [m.rosters[m.side].map((w, i) => monFromWire(w, m.side, i)), bad.length ? [] : m.rosters[foe].map((w, i) => monFromWire(w, foe, i))];
    if (r) this.resumed(r);
    else if (!bad.length) this.say('Something took hold.');
  }

  /** Takes the room's pick clock and the pick it holds for this side after a rejoin. A pick the room never got goes again. */
  resumed(r: RejoinMsg): void {
    this.left = Math.min(this.total, r.pickLeft * 60);
    if (r.pick) { this.order = r.pick.slice(); this.locked = true; }
    else if (this.locked) this.link.send({ type: 'pick', order: this.order.slice() });
  }

  say(s: string): void { this.note = s; this.noteT = 120; }

  tick(): void {
    this.link.tick();
    if (this.picked || this.ended) { this.shown++; return; }
    if (this.left > 0) this.left--;
    // Reading stops at the picks or the end, and the battle reads what follows.
    for (let msg = this.link.poll(); msg; msg = this.link.poll()) {
      if (msg.type === 'picked') { this.picked = { picks: msg.picks, timeout: msg.timeout }; break; }
      if (msg.type === 'end') { this.ended = msg; break; }
      if (msg.type === 'rejoin') {
        if (msg.last) { this.ended = msg.last; break; }
        if (msg.picked) { this.picked = msg.picked; this.rejoin = msg; break; }
        this.resumed(msg);
      }
      if ((msg.type === 'away' || msg.type === 'back') && msg.side !== this.me) this.awayUntil = msg.type === 'away' ? Date.now() + msg.left * 1000 : 0;
    }
    if (this.picked || this.ended) while (top() && top() !== this) close(top()!);
  }

  /** The four a side fights with as roster indexes in battle order. */
  fourOf(col: 0 | 1): number[] {
    const side = col === 0 ? this.me : 1 - this.me, p = this.picked!;
    return (p.timeout[side] ? DEFAULT_PICK : p.picks[side] ?? DEFAULT_PICK).slice();
  }

  update(): void {
    this.t++;
    if (this.noteT > 0) this.noteT--;
    if (this.ended) { if (this.shown > 120 || (this.shown > 20 && input.hit('ok'))) close(this, { end: this.ended }); return; }
    if (this.picked) { if (this.shown > 180 || (this.shown > 40 && input.hit('ok'))) close(this, { picked: this.picked, rejoin: this.rejoin }); return; }
    if (this.refused) return;
    const rows = this.col === 0 ? READY + 1 : ROSTER_SIZE;
    if (input.hit('up')) { this.row = (this.row + rows - 1) % rows; sfx('move'); }
    if (input.hit('down')) { this.row = (this.row + 1) % rows; sfx('move'); }
    if (input.hit('left') || input.hit('right')) { this.col = 1 - this.col; this.row = Math.min(this.row, ROSTER_SIZE - 1); sfx('move'); }
    if (input.hit('back') && this.locked) { this.locked = false; sfx('back'); this.say('Change the four, then Ready again.'); return; }
    if (input.hit('menu') && this.row < ROSTER_SIZE) { this.look(); return; }
    if (!input.hit('ok')) return;
    // The other side's whorls are only to look at.
    if (this.col === 1) { sfx('bump'); return; }
    if (this.row === READY) {
      if (this.locked) { sfx('bump'); return; }
      if (this.order.length < TEAM_SIZE) { sfx('bump'); this.say('Mark four first.'); return; }
      sfx('ok');
      this.locked = true;
      this.link.send({ type: 'pick', order: this.order.slice() });
      return;
    }
    if (this.locked) { sfx('bump'); this.say('X takes the pick back.'); return; }
    const k = this.order.indexOf(this.row);
    if (k >= 0) { this.order.splice(k, 1); sfx('back'); }
    else if (this.order.length < TEAM_SIZE) { this.order.push(this.row); sfx('ok'); }
    else { sfx('bump'); this.say('Four are marked. Unmark one first.'); }
  }

  look(): void {
    sfx('ok');
    void inspect(this.mons[this.col][this.row], () => this.pageClock());
  }

  /** The pick clock on the summary page in the experience bar's place. */
  pageClock(): void {
    if (this.picked || this.ended) return;
    const s = Math.ceil(this.left / 60), c = s <= 10 ? WARN : MINE;
    textRight(`${s}s to pick`, 186, 30, c);
    rect(48, 40, 138, 2, SPENT);
    rect(48, 40, Math.round(138 * this.left / this.total), 2, c);
  }

  draw(): void {
    // A plain dark ground, so nothing from a backdrop shows between the cards.
    rect(0, 0, 192, 192, INK);
    const reveal = !!this.picked, name = shownPlayerName(this.m.names[1 - this.me]), title = reveal ? 'Both fours' : 'Pick four';
    text(title, 6, 3, SEL);
    // The game and the games won sit between the title and the clock.
    const g = gameLine(this.m), gx = Math.round(96 - textWidth(g) / 2);
    if (gx >= 12 + textWidth(title) && gx + textWidth(g) <= 160) text(g, gx, 3, DIM);
    if (!reveal && !this.ended) {
      const s = Math.ceil(this.left / 60), c = s <= 10 ? WARN : MINE;
      textRight(`${s}s`, 186, 3, c);
      rect(4, 13, 184, 2, SPENT);
      rect(4, 13, Math.round(184 * this.left / this.total), 2, c);
    }
    // The left column is yours to pick from and the right one is theirs to look at. A rule divides them.
    text('Yours', 6, 17, MINE);
    if (!reveal) textRight(`${this.order.length} of ${TEAM_SIZE}`, 92, 17, this.order.length === TEAM_SIZE ? GOOD : DIM);
    text(`${fit(name, 48)} brings`, 100, 17, THEIRS);
    rect(95, 16, 2, 163, DIVIDE);
    for (const col of [0, 1] as const) {
      if (reveal) this.fourOf(col).forEach((i, r) => this.drawCard(col, i, r, false, r + 1));
      else this.mons[col].forEach((_, i) => this.drawCard(col, i, i, !this.ended && this.col === col && this.row === i, col === 0 ? this.order.indexOf(i) + 1 : 0));
    }
    if (!reveal) {
      const full = this.order.length === TEAM_SIZE, on = this.col === 0 && this.row === READY;
      raised(2, 167, 92, 12, full && !this.locked ? ALLY_LIT : ALLY_FILL, on);
      textCenter(this.locked ? 'Sent' : 'Ready', 48, 169, this.locked ? GOOD : on ? SEL : full ? PAPER : DIM);
      frame(98, 167, 92, 12, FOE_FILL, FOE_EDGE);
      textCenter('Look only', 144, 169, THEIRS);
    }
    const mine = reveal && this.picked!.timeout[this.me];
    const hint = this.ended ? 'Z returns.' : this.refused ? 'Concluding the match.' : reveal ? (mine ? 'Time expired. Slots 1 through 4 will battle.' : 'The fight begins.')
      : this.col === 1 ? 'V examines it.' : this.locked ? `Awaiting ${fit(name, 48)}. X modifies it.` : this.row === READY ? 'Z sends your four Whorls.' : 'Z flags it. V inspects it.';
    // A link that is down stands in front of every other hint until it comes back or the hold runs out.
    const down = this.ended ? '' : linkLine(this.link, this.awayUntil, fit(name, 48));
    if (down) hintLine(down, WARN);
    else hintLine(this.noteT > 0 && !reveal ? this.note : hint, this.noteT > 0 && !reveal ? SEL : DIM);
    if (this.ended || this.refused) this.drawEnd();
  }

  /**
   * One whorl's card. This side's cards are raised and lit in the ally color, and the other side's lie flat in the foe
   * color. The name and the types share the top line, the notion has the second line to itself, and a whorl's place in a
   * four sits on the corner of its sprite.
   */
  drawCard(col: 0 | 1, i: number, slot: number, on: boolean, badge: number): void {
    const m = this.mons[col][i], x = 2 + col * 96, y = ROW_Y + slot * ROW_STEP;
    if (!m) return;
    if (col === 0) raised(x, y, 92, 22, badge ? ALLY_LIT : ALLY_FILL, on);
    else {
      frame(x, y, 92, 22, FOE_FILL, FOE_EDGE);
      // The look cursor is a broken outline because nothing here can be picked.
      if (on) for (let k = 0; k < 92; k += 2) { rect(x + k, y, 1, 1, LOOK); rect(x + k, y + 21, 1, 1, LOOK); if (k < 22) { rect(x, y + k, 1, 1, LOOK); rect(x + 91, y + k, 1, 1, LOOK); } }
    }
    rect(x + 2, y + 2, 18, 18, INK);
    drawSprite(m.sprite, x + 3, y + 3, 2);
    if (badge) { rect(x + 2, y + 2, 7, 9, col === 0 ? SEL : THEIRS); text(String(badge), x + 3, y + 3, INK); }
    const tx = x + 89 - (m.types.length * 7 - 2);
    m.types.forEach((t, k) => miniSigil(t as Type, tx + k * 7, y + 4));
    text(fit(m.name, tx - 3 - (x + 21)), x + 21, y + 3, on && col === 0 ? SEL : PAPER);
    const n = m.notion ? NOTIONS[m.notion] : null;
    text(fit(n ? n.name : 'No notion', 68), x + 21, y + 12, n ? NERVE : DIM);
  }

  /** The end of a match before its battle: who won, and why. */
  drawEnd(): void {
    const e = this.ended, won = !!e && e.winner === this.me;
    const why = this.refused ? `Their roster breaks a rule: ${this.refused}` : e ? endReason(e, this.me, shownPlayerName(this.m.names[1 - this.me]), linkProblem(this.link)) : '';
    const lines = wrap(why, 148);
    const h = 26 + lines.length * 9;
    panel(16, 80, 160, h);
    textCenter(won ? 'You win.' : 'No result.', 96, 84, SEL);
    lines.forEach((l, k) => text(l, 22, 96 + k * 9, PAPER));
  }
}

/** The game in hand and the games each side has won, from this side. */
function gameLine(m: MatchMsg): string {
  return m.wins[0] || m.wins[1] ? `Game ${m.game}, ${m.wins[m.side]} to ${m.wins[1 - m.side]}` : `Game ${m.game} of ${GAMES_MAX}`;
}

/** Why the link ended on this side, when it is a network link that knows. */
const linkProblem = (link: Link | null): string => (link instanceof NetLink ? link.problem : '');

/** The line that says why a match ended, from the side `me` with the other player named `name`. */
function endReason(e: EndMsg, me: 0 | 1, name: string, problem = ''): string {
  const won = e.winner === me;
  if (e.why === 'resign') return won ? `${name} gave up.` : 'You gave up.';
  if (e.why === 'timeouts') return won ? `${name} ran out of time three times in a row.` : 'Your time expired three times in a row.';
  if (e.why === 'gone') return won ? `${name} left the match.` : e.winner === null ? problem || 'The connection was lost.' : 'You left the match.';
  if (e.why === 'void') return 'The match is invalidated.';
  return '';
}

// ---------------------------------------------------------------- the match

/**
 * How a match ended. It carries the last game and its picks when it got that far, and it says so when a refusal or a cancel came before any match.
 * A held seat that finds its match already over has no game in hand, so it carries the seat's side and the other player's name instead.
 * `link` is the room's link, still open for a rematch, `random` marks a random battle, and `left` says this side left between games.
 */
export interface MatchResult {
  end: EndMsg | null; match?: MatchMsg; picked?: PickRelease; refused?: string; canceled?: boolean; problem?: string; side?: 0 | 1; foe?: string;
  link?: Link; random?: boolean; left?: boolean;
}

/** Whether this side won or lost a match, or null for a match that never began, was canceled or refused, or ended with no winner. */
export function outcomeOf(r: MatchResult): 'won' | 'lost' | null {
  const side = r.match?.side ?? r.side;
  if (!r.end || side === undefined || r.canceled || r.refused || r.end.matchWinner === null) return null;
  return r.end.matchWinner === side ? 'won' : 'lost';
}

/** Puts a finished match on the tally. The caller saves, since a rejoin from the title may have no file to save into. */
function recordMatch(r: MatchResult): void {
  const o = outcomeOf(r);
  if (o) addToTally(o === 'won');
}

/** Plays one match: the wait for it on a link or through the lobby, then each game's pick and battle. A held seat's start takes its match back. */
export async function playMatch(start: Start, roster: WireMon[], name: string): Promise<MatchResult> {
  const random = isRandom(start);
  // A random battle's hello carries any legal roster, since both sides build the real ones from the match's deal.
  const sent = random ? placeholderRoster() : roster;
  const got = await run<Linked>(new Linking(start, 'resume' in start ? null : { type: 'hello', build: BUILD, name, roster: sent }));
  if (!got) return { end: null, canceled: true };
  if ('m' in got) return playGames(got.link, got.m, null, random);
  if ('r' in got) return playGames(got.link, { ...got.r, type: 'match', token: '' }, got.r, random);
  got.link?.close();
  const seat = 'resume' in start ? { side: start.resume.side, foe: start.resume.foe } : {};
  return { end: got.end ?? null, refused: got.refused || undefined, problem: linkProblem(got.link), ...seat };
}

/** A random battle's game with both rosters built from the match's deal in place of the ones the hellos carried. */
function seeded(m: MatchMsg, random: boolean): MatchMsg {
  return random ? { ...m, rosters: randomRosters(m.deal) } : m;
}

/**
 * Plays a match's games on one link from its first game or a rejoin until the match ends: each game's pick and battle, and
 * the wait between games. The link stays open after the end for a rematch.
 */
async function playGames(link: Link, first: MatchMsg, r: RejoinMsg | null, random: boolean): Promise<MatchResult> {
  let m = seeded(first, random), picked: PickRelease | undefined;
  for (;;) {
    const g = r?.last ? { end: r.last } : await playGame(link, m, r);
    picked = g.picked ?? picked;
    const e = g.end;
    if (!e || e.final) return { end: e, match: m, picked, problem: linkProblem(link), link, random };
    const next = await run<Between>(new BetweenScreen(link, m, e));
    if ('end' in next) return { end: next.end, match: m, picked, problem: linkProblem(link), link, random, left: next.left };
    m = seeded(next.m, random);
    r = next.r ?? null;
  }
}

/** One game: the pick while it runs, and then the battle, rebuilt from the record when a rejoin finds it under way. */
async function playGame(link: Link, m: MatchMsg, r: RejoinMsg | null): Promise<{ end: EndMsg | null; picked?: PickRelease }> {
  let picked = r?.picked ?? null, open = r;
  if (!picked) {
    const p = await run<{ picked?: PickRelease; end?: EndMsg; rejoin?: RejoinMsg | null }>(new PickScreen(link, m, r));
    if (!p.picked) return { end: p.end ?? null };
    picked = p.picked;
    open = p.rejoin ?? null;
  }
  let ls: Lockstep;
  // A copy that comes back mid-game replays the record with no events, as a reloaded page does.
  try { ls = open ? rebuild(m.rosters, m.names, m.side, picked, open.record) : new Lockstep(teamsFromPicks(m.rosters, picked), m.names, m.side); }
  catch (e) {
    link.send({ type: 'foul', n: -1, why: reasonText((e as Error).message) });
    return { end: { type: 'end', why: 'void', winner: null, wins: m.wins, final: true, matchWinner: null }, picked };
  }
  const out = await onlineBattle(ls, link, m, open);
  return { end: out.end ?? null, picked };
}

/** Takes back a seat this tab holds: the wait for the room, then the game where they are, the rest of the match, and the result. */
export async function rejoinMatch(seat: HeldSeat): Promise<MatchResult> {
  const was = inByssus;
  inByssus = true;
  try {
    const r = await playMatch({ resume: seat }, [], heroName());
    await afterMatch(r);
    return r;
  } finally { inByssus = was; }
}

/** Shows a match's result and plays each rematch on the same link until the player leaves. `keep` saves after each match. */
async function afterMatch(r: MatchResult, keep: () => void = () => {}): Promise<void> {
  for (;;) {
    lastMatch = r;
    recordMatch(r);
    keep();
    if (r.canceled) return;
    const m = await run<MatchMsg | null>(new ResultScreen(r));
    if (!m || !r.link) return;
    r = await playGames(r.link, m, null, !!r.random);
  }
}

// ---------------------------------------------------------------- between games

/** How the wait between games ended: the next game, with the rejoin that carried it after a drop, or the match's end. */
type Between = { m: MatchMsg; r?: RejoinMsg } | { end: EndMsg; left?: boolean };

/** Between games: the last game's winner, the games won, and Next game or Leave. The next game starts once both players are ready. */
export class BetweenScreen implements Mode {
  opaque = true;
  t = 0;
  sel = 0;
  /** True once this side has said it is ready. */
  sent = false;
  done = false;
  /** When the other side's seat hold ends by this page's clock while its link is down, or 0. */
  awayUntil = 0;
  readonly name: string;

  constructor(readonly link: Link, readonly m: MatchMsg, readonly end: EndMsg) {
    this.name = shownPlayerName(m.names[1 - m.side]);
  }

  get choices(): string[] { return this.sent ? ['Leave'] : ['Next game', 'Leave']; }

  /** Closes this screen and anything open over it. */
  stop(v: Between): void {
    if (this.done) return;
    this.done = true;
    while (top() && top() !== this) close(top()!);
    close(this, v);
  }

  tick(): void {
    if (this.done) return;
    this.link.tick();
    for (let msg = this.link.poll(); msg; msg = this.link.poll()) {
      if (msg.type === 'match') { sfx('link'); this.stop({ m: msg }); return; }
      if (msg.type === 'end') { this.stop({ end: msg }); return; }
      if (msg.type === 'rejoin') {
        // The room may have missed this side's word while the link was down, so it goes again.
        if (msg.last) { if (this.sent) this.link.send({ type: 'next' }); continue; }
        this.stop({ m: { ...msg, type: 'match', token: '' }, r: msg });
        return;
      }
      if ((msg.type === 'away' || msg.type === 'back') && msg.side !== this.m.side) this.awayUntil = msg.type === 'away' ? Date.now() + msg.left * 1000 : 0;
    }
  }

  update(): void {
    this.t++;
    if (this.done) return;
    if (!this.sent && (input.hit('up') || input.hit('down'))) { this.sel = 1 - this.sel; sfx('move'); }
    if (input.hit('back')) { sfx('back'); void this.leave(); return; }
    if (!input.hit('ok')) return;
    sfx('ok');
    if (this.choices[this.sel] === 'Next game') { this.sent = true; this.sel = 0; this.link.send({ type: 'next' }); return; }
    void this.leave();
  }

  /** Leaving between games gives the match to the other player, so it asks first. */
  async leave(): Promise<void> {
    const k = await choose(['Leave', 'Stay'], true, `Leave match? It goes to ${this.name}.`);
    if (k !== 0 || this.done) return;
    const foe = (1 - this.m.side) as 0 | 1;
    this.link.send({ type: 'resign' });
    this.link.close();
    this.stop({ end: { type: 'end', why: 'resign', winner: foe, wins: this.end.wins, final: true, matchWinner: foe }, left: true });
  }

  draw(): void {
    backdrop();
    const e = this.end, me = this.m.side, foe = (1 - me) as 0 | 1, name = this.name, g = this.m.game;
    const head = e.winner === me ? `Game ${g}: You won.` : e.winner === foe ? `Game ${g}: ${name} wins.` : `Game ${g}: No winner.`;
    const why = e.why === 'resign' ? wrap(e.winner === me ? `${name} forfeited the game.` : 'You forfeited the game.', 140) : [];
    const wait = wrap(this.sent ? `Waiting for ${name}.` : `Game ${g + 1} will begin once both players are ready.`, 140);
    const lines = why.length + wait.length;
    panel(20, 56, 152, 48 + this.choices.length * 10 + lines * 9, undefined, { head: 11 });
    textCenter(head, 96, 59, SEL);
    let y = 74;
    let tx = Math.round(96 - textWidth(`You ${e.wins[me]}, ${name} ${e.wins[foe]}`) / 2);
    tx = text('You ', tx, y, DIM);
    tx = text(String(e.wins[me]), tx, y, GOOD);
    tx = text(`, ${name} `, tx, y, DIM);
    text(String(e.wins[foe]), tx, y, BADC);
    y += 12;
    why.forEach(l => { textCenter(l, 96, y, PAPER); y += 9; });
    wait.forEach(l => { textCenter(l, 96, y, this.sent ? SEL : DIM); y += 9; });
    y += 4;
    this.choices.forEach((l, k) => {
      const ry = y + k * 10;
      if (k === this.sel) { rowBar(70, ry, 52); text('\u0001', 72, ry, SEL); }
      text(l, 82, ry, k === this.sel ? SEL : PAPER);
    });
    const down = linkLine(this.link, this.awayUntil, fit(name, 48));
    if (down) hintLine(down, WARN);
    else hintLine(`The game will start in ${NEXT_SECONDS} seconds regardless.`);
  }
}

// ---------------------------------------------------------------- the result

/** The choice the result screen opened on last. */
let lastResult = 0;

/**
 * A match's result in one panel: who won the match, the games won, the reason, and the tally. Rematch asks the other player
 * for another match on the same link, and Leave goes back. A match that never began or whose link is gone offers only Back.
 * Closes with the rematch's first game, or with null.
 */
export class ResultScreen implements Mode {
  opaque = true;
  t = 0;
  sel: number;
  readonly head: string;
  readonly why: string[];
  readonly score: string;
  choices: string[];
  /** The rematch line: the other player asked or left, or this side waits. */
  note = '';
  asked = false;
  done = false;
  readonly name: string;
  readonly me: 0 | 1 | undefined;

  constructor(readonly r: MatchResult) {
    const m = r.match, e = r.end, me = m?.side ?? r.side;
    const foe = m ? m.names[1 - m.side] : r.foe, name = foe === undefined ? 'The other player' : shownPlayerName(foe);
    this.me = me;
    this.name = name;
    this.head = !e || r.refused ? 'No match' : me === undefined ? 'No result.' : e.matchWinner === me ? 'You win the match.' : e.matchWinner !== null ? `${name} wins the match.` : 'No result.';
    const why = r.left ? 'You left the match.' : e && me !== undefined ? endReason(e, me, name, r.problem) : e ? 'The match ended while this page was away.' : '';
    this.why = wrap(r.refused || why, 140);
    this.score = e && me !== undefined && (e.wins[0] || e.wins[1]) ? `Games: you ${e.wins[me]}, ${name} ${e.wins[1 - me]}` : '';
    const open = !!r.link && !!e?.final && !r.left && !r.refused && me !== undefined && e.why !== 'gone';
    this.choices = open ? ['Rematch', 'Leave'] : ['Back'];
    this.sel = open ? lastResult : 0;
  }

  /** Reads the rematch from the link: the other player asking, leaving, or the first game of the rematch. */
  tick(): void {
    const link = this.r.link;
    if (!link || this.done) return;
    link.tick();
    for (let msg = link.poll(); msg; msg = link.poll()) {
      if (msg.type === 'match') { sfx('link'); this.done = true; close(this, msg); return; }
      if (msg.type === 'again' && msg.side !== this.me) this.note = `${this.name} requests a rematch.`;
      if (msg.type === 'left') { this.note = msg.side === this.me ? 'Link closed.' : `${this.name} left.`; this.choices = ['Back']; this.sel = 0; }
    }
  }

  update(): void {
    this.t++;
    if (this.done) return;
    const n = this.choices.length;
    if (n > 1 && (input.hit('up') || input.hit('down'))) { this.sel = 1 - this.sel; sfx('move'); }
    if (input.hit('back')) { sfx('back'); this.leave(); return; }
    if (!input.hit('ok')) return;
    sfx('ok');
    if (this.choices[this.sel] === 'Rematch') {
      lastResult = 0;
      this.asked = true;
      this.r.link!.send({ type: 'again' });
      this.choices = ['Leave'];
      this.sel = 0;
      this.note = `Awaiting ${this.name}.`;
      return;
    }
    if (n > 1) lastResult = this.sel;
    this.leave();
  }

  leave(): void {
    this.done = true;
    this.r.link?.close();
    close(this, null);
  }

  draw(): void {
    backdrop();
    const lines = this.why.length + (this.score ? 1 : 0) + (this.note ? 1 : 0);
    panel(20, 60, 152, 40 + this.choices.length * 10 + lines * 9, undefined, { head: 11 });
    textCenter(this.head, 96, 63, SEL);
    let y = 78;
    if (this.score) { textCenter(this.score, 96, y, PAPER); y += 9; }
    this.why.forEach(l => { textCenter(l, 96, y, PAPER); y += 9; });
    if (this.note) { textCenter(this.note, 96, y, SEL); y += 9; }
    const t = onlineTally(), won = `${t.won} won`, lost = `${t.lost} lost`, ty = y + 2;
    let tx = Math.round(96 - textWidth(`Tally ${won}, ${lost}`) / 2);
    tx = text('Tally ', tx, ty, DIM);
    tx = text(won, tx, ty, GOOD);
    tx = text(', ', tx, ty, DIM);
    text(lost, tx, ty, BADC);
    this.choices.forEach((l, k) => {
      const ry = y + 14 + k * 10;
      if (k === this.sel) { rowBar(70, ry, 52); text('\u0001', 72, ry, SEL); }
      text(l, 82, ry, k === this.sel ? SEL : PAPER);
    });
    hintLine(this.choices[0] === 'Rematch' ? (this.r.random ? 'The rematch generates new Whorls.' : 'The rematch retains both teams.') : this.asked ? 'X leaves.' : 'Press Z to go back.');
  }
}

// ---------------------------------------------------------------- a code

/** The characters a code may use, as the lobby makes them. */
export const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ23456789';
const CODE_COLS = 7;
/** The code typed last, so a second try starts from it. */
let lastCode = '';

/** Types a friend's code on a grid of the characters codes use. Closes with the code, or null when backed out. */
export class CodeEntry implements Mode {
  opaque = true;
  t = 0;
  code = lastCode;
  /** The cursor: a character's index, or the two buttons after them. */
  at = 0;
  readonly keys = [...CODE_CHARS, 'Del', 'Done'];

  update(): void {
    this.t++;
    // Four rows of seven characters, then Del under the left four columns and Done under the right three.
    const n = this.keys.length, chars = CODE_CHARS.length, buttons = this.at >= chars, below = (i: number) => chars + (i % CODE_COLS >= 4 ? 1 : 0);
    if (input.hit('left')) { this.at = (this.at + n - 1) % n; sfx('move'); }
    if (input.hit('right')) { this.at = (this.at + 1) % n; sfx('move'); }
    if (input.hit('down')) { this.at = buttons ? (this.at === chars ? 1 : 5) : this.at + CODE_COLS >= chars ? below(this.at) : this.at + CODE_COLS; sfx('move'); }
    if (input.hit('up')) { this.at = buttons ? chars - CODE_COLS + (this.at === chars ? 1 : 5) : this.at < CODE_COLS ? below(this.at) : this.at - CODE_COLS; sfx('move'); }
    if (input.hit('back')) {
      if (!this.code) { sfx('back'); close(this, null); return; }
      this.code = this.code.slice(0, -1); sfx('back');
    }
    if (input.hit('menu')) { this.done(); return; }
    if (!input.hit('ok')) return;
    const k = this.keys[this.at];
    if (k === 'Del') { if (this.code) { this.code = this.code.slice(0, -1); sfx('back'); } else sfx('bump'); return; }
    if (k === 'Done') { this.done(); return; }
    if (this.code.length >= 6) { sfx('bump'); return; }
    this.code += k;
    sfx('blip');
    if (this.code.length === 6) this.at = this.keys.length - 1;
  }

  done(): void {
    if (this.code.length !== 6) { sfx('bump'); return; }
    sfx('ok');
    lastCode = this.code;
    close(this, this.code);
  }

  draw(): void {
    backdrop();
    panel(24, 30, 144, 136, undefined, { head: 11 });
    textCenter('Use a code', 96, 33, SEL);
    for (let i = 0; i < 6; i++) {
      const x = 96 - 48 + i * 16, ch = this.code[i];
      bevel(x, 50, 14, 15, '#14121a', i === this.code.length ? SEL : '#4a4458');
      if (ch) textCenter(ch, x + 7, 54, PAPER);
    }
    CODE_CHARS.split('').forEach((ch, i) => {
      const x = 36 + (i % CODE_COLS) * 18, y = 76 + Math.floor(i / CODE_COLS) * 14, on = i === this.at;
      if (on) rect(x - 2, y - 2, 14, 12, mix(SEL, INK, 0.75));
      textCenter(ch, x + 5, y, on ? SEL : PAPER);
    });
    ['Del', 'Done'].forEach((l, k) => {
      const x = 44 + k * 60, y = 136, on = this.at === CODE_CHARS.length + k;
      bevel(x, y, 44, 13, on ? '#2a2632' : '#1b1822', on ? SEL : '#4a4458');
      textCenter(l, x + 22, y + 3, on ? SEL : k === 1 && this.code.length === 6 ? GOOD : PAPER);
    });
    hintLine('Z types, X deletes, V done.');
  }
}

// ---------------------------------------------------------------- Byssus at the grotto counter

const SERVICE = ['Find someone', 'Make a code', 'Use a code', 'Random battle', 'Roster', 'Leave'] as const;

/** What each choice on the Byssus menu does, for its detail panel. */
function serviceText(k: number): string {
  const p = rosterNow().problems;
  if (k === 0) return 'Generates a link for anyone else seeking a match. A match is the best of three games.';
  if (k === 1) return 'Creates a one-time code for a friend, valid for 15 minutes.';
  if (k === 2) return 'Uses a friend\'s code.';
  if (k === 3) return 'Each side receives six random Whorls, including some hybrids, and selects four for each game. Find an opponent, create a code, or use an existing one.';
  if (k === 4) return p.length ? `${p.length} to fix: ${p[0]}` : 'Six to display, four to battle, all at level 25.';
  return 'Go back to the counter.';
}

/** The matches won and lost in a panel of their own, in the list's style. */
function tallyPanel(x: number, y: number, w: number): void {
  const t = onlineTally();
  panel(x, y, w, 34, undefined, { head: 10 });
  text('Tally', x + 4, y + 2, SEL);
  text('Won', x + 10, y + 13, DIM);
  textRight(String(t.won), x + w - 6, y + 13, GOOD);
  text('Lost', x + 10, y + 22, DIM);
  textRight(String(t.lost), x + w - 6, y + 22, BADC);
}

/**
 * The Byssus menu: queue for a match, make or use a code, set the roster, or leave. The cursor starts on the last choice.
 * While this tab holds a seat in a match that may still be running, Rejoin heads the menu and the cursor starts on it.
 */
export async function byssus(): Promise<void> {
  inByssus = true;
  try { await byssusMenu(); } finally { inByssus = false; }
}

/** True while the player is in online play. Crest and tide text show in full there, as in Practice, before the story opens tide. */
export let inByssus = false;

async function byssusMenu(): Promise<void> {
  for (;;) {
    const o = onlineSave(), seat = heldSeat(), first = seat ? 1 : 0;
    const k = await listMenu('Byssus', [...(seat ? ['Rejoin'] : []), ...SERVICE], {
      start: seat ? 0 : o.menu, w: 92,
      detail: i => {
        const lines = wrap(i < first ? 'Returns to the match the page left. The room holds the seat for 90 seconds.' : serviceText(i - first), 76).slice(0, 9);
        panel(104, 4, 84, 11 + lines.length * 9);
        lines.forEach((l, n) => text(l, 108, 8 + n * 9, PAPER));
        // The list takes 9 pixels a choice and 16 for its frame from y 4, and the tally sits 8 pixels under it.
        tallyPanel(4, 12 + (first + SERVICE.length) * 9 + 16, 92);
      },
    });
    // A match's battle track gives way to the map's music once its result closes.
    if (seat && k === 0) { await rejoinMatch(seat); save(); field.playMapMusic(); continue; }
    const s = k - first;
    if (k < 0 || SERVICE[s] === 'Leave') { save(); return; }
    o.menu = s;
    if (SERVICE[s] === 'Roster') { await rosterScreen(); save(); continue; }
    if (SERVICE[s] === 'Random battle') {
      const r = await choose(['Find someone', 'Make a code', 'Use a code'], true, 'Random encounter: six Whorls each.');
      if (r >= 0) await matches(r === 0 ? 'public' : r === 1 ? 'host' : 'join', true);
      field.playMapMusic();
      continue;
    }
    await matches(s === 0 ? 'public' : s === 1 ? 'host' : 'join');
    field.playMapMusic();
  }
}

/** The last match played from the Byssus menu, for tests. */
export let lastMatch: MatchResult | null = null;

/** Plays a match of one kind and its rematches: the roster check, a code when one is needed, the match, and its result. A random battle needs no roster. */
async function matches(kind: QueueKind, random = false): Promise<void> {
  if (!random && rosterNow().problems.length) { await rosterScreen(); if (rosterNow().problems.length) return; }
  let code: string | undefined;
  if (kind === 'join') {
    const c = await run<string | null>(new CodeEntry());
    if (!c) return;
    code = c;
  }
  await afterMatch(await playMatch({ kind, code, random }, random ? [] : rosterNow().roster, heroName()), save);
}

tanneryExtras.push({ label: 'Byssus', when: byssusUnlocked, run: async () => { await introduceByssus(); await byssus(); } });
