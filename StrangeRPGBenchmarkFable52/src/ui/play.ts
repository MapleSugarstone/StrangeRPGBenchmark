// Plays one sheet: runs the computer parties, animates what happens, and asks the human for every decision.
import { FIXED, OPEN } from '../rules/types';
import type { Action, Deal, GameEvent, Kind, Player, State } from '../rules/types';
import { AMEND_TEXT, CHARTER_NAME, CLAIM_TEXT, EVOLVED_TRAITS, HALVES, HIDDEN_TRAITS, KIND_NAME, LAW_TEXT, POWER_TEXT, RELICS, RIVALS } from '../rules/data';
import { T } from '../rules/tuning';
import { cellName, cellOf, claimProgress, compFace, compName, counts, cx, cy, dist, filedClaim, inTruce, localDef, pcell, standing } from '../rules/board';
import { apply, applyDeal, contestCost, dealAffordable, emptyDeal, legal, measureInk, objectCost, recruitCost, unmeasureCost } from '../rules/engine';
import { decide, dealVerdict, hadTruce, offersFrom } from '../rules/ai';
import { C, textWidth } from '../gfx/screen';
import { TS, tileX, tileY } from '../art/tiles';
import { G, addFx, claimLabel, floatText, fmtCount, inkOf, logLine, nm, pawnsSettled, setBanner, tileLabel } from './game';
import { confirm, input, menu, pages, pickNumber, say, sound, wait, widgets } from './core';
import type { Co, MenuItem } from './core';
import { bark, localLines } from './script';
import { battleFlow } from './battleview';
import { RULE_PAGES } from '../story/rules';

export interface StoryHooks {
  onEvent(e: GameEvent): Co<void>;
  onTurn(p: Player): Co<void>;
  onRound(n: number): Co<void>;
  extraActions(p: Player): { label: string; hint: string; run: () => Co<void> }[];
}

let hooks: StoryHooks | null = null;

function S(): State { return G.s!; }

/** A rival's line shown in a box that closes by itself. */
export function* toast(who: Player, key: string, fields: Record<string, string | number> = {}, frames = 110): Co<void> {
  const line = bark(who.char, key, fields, S().round + who.idx);
  if (!line) return;
  logLine(nm(who) + ': ' + line, inkOf(who.char));
  yield* say(nm(who), line, inkOf(who.char), false, frames);
}

export function dealLines(s: State, d: Deal, viewer: number): string[] {
  const who = (i: number) => (i === viewer ? 'You' : nm(s.players[i]));
  const verb = (i: number, v: string) => (i === viewer ? v : v + 's');
  const out: string[] = [];
  const sides = [d.from, d.to];
  for (let k = 0; k < 2; k++) {
    const a = sides[k], b = sides[1 - k];
    const parts: string[] = [];
    if (d.ink[k]) parts.push(d.ink[k] + ' ink');
    if (d.doubt[k]) parts.push(d.doubt[k] + ' doubt');
    if (d.draft[k] >= 0) { const dr = s.players[a].hand[d.draft[k]]; if (dr) parts.push('a draft (' + KIND_NAME[dr.a] + ' or ' + KIND_NAME[dr.b] + ')'); }
    if (parts.length) out.push(who(a) + ' ' + verb(a, 'give') + ' ' + parts.join(' and ') + ' to ' + (b === viewer ? 'you' : nm(s.players[b])) + '.');
  }
  if (d.truce) out.push('Truce for ' + d.truce + ' rounds. No contests or objections between you.');
  if (d.read) { const a = sides[d.read.who]; out.push(who(a) + ' ' + verb(a, 'promise') + ' to measure ' + cellName(d.read.c) + ' as a ' + KIND_NAME[d.read.k] + '.'); }
  if (d.leave) { const a = sides[d.leave.who]; out.push(who(a) + ' ' + verb(a, 'promise') + ' to leave ' + cellName(d.leave.c) + ' alone for 2 rounds.'); }
  if (d.back >= 0) { const a = sides[d.back], b = sides[1 - d.back]; out.push(who(a) + ' ' + verb(a, 'back') + ' ' + (b === viewer ? 'you' : nm(s.players[b])) + ' to the close.'); }
  return out;
}

/** A one-line summary of a deal from the viewer's side. */
export function dealShort(s: State, d: Deal, viewer: number): string {
  const mine = d.from === viewer ? 0 : 1, theirs = 1 - mine;
  const side = (k: number) => { const parts: string[] = []; if (d.ink[k]) parts.push(d.ink[k] + ' ink'); if (d.doubt[k]) parts.push(d.doubt[k] + ' doubt'); if (d.draft[k] >= 0) parts.push('a draft'); return parts.join(' and '); };
  const bits: string[] = [];
  if (d.truce) bits.push('Truce, ' + d.truce + ' rounds');
  if (d.read) bits.push((d.read.who === mine ? 'You measure ' : 'They measure ') + cellName(d.read.c) + ' as ' + KIND_NAME[d.read.k]);
  if (d.leave) bits.push((d.leave.who === mine ? 'You leave ' : 'They leave ') + cellName(d.leave.c));
  if (d.back >= 0) bits.push(d.back === mine ? 'You back them' : 'They back you');
  const get = side(theirs), give = side(mine);
  if (get) bits.push('get ' + get);
  if (give) bits.push('give ' + give);
  return bits.join(', ') || 'A deal';
}

function causeText(s: State, deed: number, target: number): string {
  for (let i = s.ledger.length - 1; i >= 0; i--) {
    const e = s.ledger[i];
    if (e.season === s.season && e.a === deed && e.b === target && e.d < 0) {
      const what: Record<string, string> = { contested: 'a contest', broke: 'a broken promise', objected: 'an objection', unmeasured: 'an unmeasurement', bought: 'a bought peg', witness: 'a broken promise' };
      return (what[e.why] ?? 'an entry') + ' in round ' + e.round;
    }
  }
  return 'the leading count';
}

/** Turns queued engine events into log lines, effects, sounds, and rival lines. */
export function* processEvents(): Co<void> {
  const s = S();
  while (s.events.length) {
    const e = s.events.shift()!;
    const p = e.p !== undefined && e.p >= 0 ? s.players[e.p] : null;
    const q = e.q !== undefined && e.q >= 0 ? s.players[e.q] : null;
    const mine = (pl: Player | null) => !!pl && pl.human;
    let pause = 0;
    switch (e.t) {
      case 'round': setBanner('Round ' + e.n + ' of ' + s.rounds, 60); sound.sfx('bell'); pause = 30; if (hooks) yield* hooks.onRound(e.n!); break;
      case 'turn':
        if (p && !p.human) { logLine(nm(p) + "'s turn.", inkOf(p.char)); }
        sound.sfx(p ? 'turn_' + p.char : 'tick');
        break;
      case 'move': sound.sfx('step'); for (let i = 0; i < 12 && !pawnsSettled(); i++) yield; break;
      case 'sketch': {
        const t = s.tiles[e.c!];
        logLine(nm(p!) + ' sketches ' + cellName(e.c!) + ': ' + KIND_NAME[t.a] + ' or ' + KIND_NAME[t.b] + '.');
        addFx({ kind: 'ring', x: tileX(e.c!) + 12, y: tileY(e.c!) + 12, t: 0, life: 14, ink: C.pencil });
        if (t.den) logLine('Something lives at ' + cellName(e.c!) + '.', C.doubt3);
        sound.sfx('sketch');
        pause = mine(p) ? 8 : 16;
        break;
      }
      case 'measure': {
        const by = p ? nm(p) : 'The Level';
        logLine(by + ' measures ' + cellName(e.c!) + ' as a ' + KIND_NAME[e.k as Kind] + '.');
        addFx({ kind: 'sight', x: tileX(e.c!), y: tileY(e.c!), t: 0, life: 16 });
        addFx({ kind: 'struck', x: tileX(e.c!) + 8, y: tileY(e.c!) + 4, t: 0, life: 44, text: e.s, ink: C.pencil });
        sound.sfx('measure');
        pause = mine(p) ? 18 : 26;
        break;
      }
      case 'peg': logLine(nm(p!) + ' pegs ' + cellName(e.c!) + '.'); addFx({ kind: 'stamp', x: tileX(e.c!) + 5, y: tileY(e.c!) + 5, t: 0, life: 10, ink: inkOf(p!.char) }); sound.sfx('peg'); pause = 10; break;
      case 'work':
        if (e.s === 'rest') logLine(nm(p!) + ' rests at ' + cellName(e.c!) + '.');
        else { floatText(e.c!, '+' + e.n + ' ' + e.s, e.s === 'doubt' ? C.doubt3 : C.well3); if (!mine(p)) logLine(nm(p!) + ' works ' + cellName(e.c!) + ' for ' + e.n + ' ' + e.s + '.'); }
        sound.sfx(e.s === 'doubt' ? 'doubt' : 'ink');
        pause = 12;
        break;
      case 'recruit': {
        const def = localDef(e.s!)!;
        logLine(nm(p!) + ' recruits ' + def.name + ' (' + def.a.gloss + ' or ' + def.b.gloss + ').');
        sound.sfx('card');
        if (mine(p)) { const ln = localLines(e.s!)[0]; if (ln) yield* say(def.name, ln, C.sepia); }
        pause = 14;
        break;
      }
      case 'file': {
        const id = filedClaim(p!)!;
        logLine(nm(p!) + ' files a claim: ' + claimLabel(id) + '.', C.warn);
        setBanner(nm(p!) + ' files: ' + claimLabel(id), 80);
        sound.sfx('stamp');
        if (!mine(p)) yield* toast(p!, 'file', { claim: claimLabel(id) });
        pause = 20;
        break;
      }
      case 'unmeasure': logLine(nm(p!) + ' unmeasures ' + cellName(e.c!) + '.', C.doubt3); addFx({ kind: 'ring', x: tileX(e.c!) + 12, y: tileY(e.c!) + 12, t: 0, life: 18, ink: C.doubt2 }); sound.sfx('doubt'); pause = 22; break;
      case 'propose': if (!mine(p) && !mine(q)) pause = 0; break;
      case 'deal': {
        const d = e.data as Deal;
        const bits: string[] = [];
        if (d.truce) bits.push('a truce');
        if (d.ink[0] || d.ink[1] || d.doubt[0] || d.doubt[1] || d.draft[0] >= 0 || d.draft[1] >= 0) bits.push('a trade');
        if (d.read || d.leave) bits.push('a promise');
        if (d.back >= 0) bits.push('backing');
        logLine(nm(p!) + ' and ' + nm(q!) + ' agree: ' + (bits.join(', ') || 'a deal') + '.', C.ok);
        sound.sfx('deal');
        pause = 16;
        break;
      }
      case 'dealRefused': if (!mine(q) && !mine(p)) logLine(nm(p!) + ' refuses ' + nm(q!) + '.', C.gray); break;
      case 'promiseKept': if (mine(p) || mine(q)) logLine(nm(p!) + ' kept a promise to ' + nm(q!) + '.', C.ok); if (mine(p) && q && !q.human && e.s !== 'truce') yield* toast(q, 'kept', { yes: Math.min(9, 5 + s.trust[q.idx][p!.idx]) }, 80); break;
      case 'promiseBroken': {
        logLine(nm(p!) + ' broke a promise to ' + nm(q!) + '.', C.warn);
        setBanner(nm(p!) + ' breaks a promise', 80);
        sound.sfx('break');
        if (!mine(p)) yield* toast(p!, 'betray', {});
        if (mine(p) && q && !q.human) yield* toast(q, 'betrayed', { r: s.round, no: Math.min(9, 5 - s.trust[q.idx][p!.idx]) });
        pause = 20;
        break;
      }
      case 'object':
        logLine(nm(p!) + ' objects to ' + nm(q!) + ' at ' + cellName(e.c!) + '.', C.doubt3);
        sound.sfx('doubt');
        if (!mine(p)) yield* toast(p!, 'object', { kind: KIND_NAME[e.k as Kind] }, 80);
        break;
      case 'insist': logLine(nm(p!) + ' insists. The measurement stands.'); if (!mine(p)) yield* toast(p!, 'insist', {}, 70); break;
      case 'flip': logLine('The tile takes its other reading.', C.doubt3); break;
      case 'fightStart': {
        const who = q ? nm(q) : e.s === 'den' ? 'a creature' : 'the ' + (e.s ?? 'guardian');
        logLine(nm(p!) + ' contests ' + who + ' at ' + cellName(e.c!) + '.', C.warn);
        sound.sfx('fight');
        if (!mine(p) && q && q.human) {
          const fields = { cause: causeText(s, p!.idx, q.idx) };
          yield* toast(p!, 'contest', fields);
        }
        pause = 14;
        break;
      }
      case 'fightEnd': {
        logLine(nm(p!) + (e.n ? ' wins.' : ' is beaten back.'), e.n ? C.ink : C.gray);
        if (!mine(p) && q && q.human && s.players[e.p!]) yield* toast(p!, e.n ? 'won' : 'lost', {}, 70);
        pause = 16;
        break;
      }
      case 'uproot': logLine(nm(q!) + "'s peg at " + cellName(e.c!) + ' is pulled.', C.warn); sound.sfx('uproot'); break;
      case 'spoils': if (q && e.n) logLine(nm(q) + ' loses ' + e.n + (p ? ' to ' + nm(p) : '') + '.', C.gray); break;
      case 'retreat': for (let i = 0; i < 20 && !pawnsSettled(); i++) yield; break;
      case 'struckComp': { const def = localDef(e.s!); logLine((def ? def.name : e.s) + ' is struck from ' + nm(p!) + "'s party.", C.warn); sound.sfx('break'); pause = 20; break; }
      case 'denDown': logLine('The creature at ' + cellName(e.c!) + ' is gone.'); break;
      case 'back': logLine(nm(p!) + ' backs ' + nm(q!) + '.', C.warn); setBanner(nm(p!) + ' backs ' + nm(q!), 80); sound.sfx('stamp'); if (!mine(p)) yield* toast(p!, 'back', { name: nm(q!) }, 90); break;
      case 'unback': logLine(nm(p!) + ' withdraws its backing.', C.warn); break;
      case 'gift': logLine(nm(p!) + ' gives ' + e.n + ' ' + e.s + ' to ' + nm(q!) + '.', C.ok); if (!mine(p) && mine(q)) yield* toast(p!, 'gift', { name: nm(q!) }, 90); break;
      case 'parity': logLine('Parity: ' + nm(p!) + ' takes 1 ink from ' + nm(q!) + '.'); break;
      case 'bids': {
        const list = e.data as { p: number; n: number }[];
        logLine('Bids: ' + list.map((b) => nm(s.players[b.p]) + ' ' + b.n).join(', ') + '.');
        pause = 24;
        break;
      }
      case 'steer': logLine(nm(p!) + ' steers the Level ' + (e.n === 0 ? 'straight on' : e.n! < 0 ? 'left' : 'right') + '.'); break;
      case 'level': sound.sfx('level'); addFx({ kind: 'sight', x: tileX(e.c!), y: tileY(e.c!), t: 0, life: 16 }); pause = 24; break;
      case 'levelPin': { const def = localDef(e.s!); logLine('The Level enters ' + (def ? def.name : e.s) + ' as ' + (def ? (e.n === 2 ? def.b.gloss : def.a.gloss) : '') + '.', C.warn); break; }
      case 'levelDown': logLine(nm(p!) + ' stops the Level.', C.warn); setBanner('The Level is stopped', 90); break;
      case 'quarryMove': logLine('The Quarry moves to ' + cellName(e.c!) + '.', C.doubt3); pause = 20; break;
      case 'amend': logLine(nm(p!) + ' amends: ' + AMEND_TEXT[e.s as keyof typeof AMEND_TEXT] + (e.k ? ' (' + KIND_NAME[e.k] + ')' : ''), C.warn); setBanner('The law is amended', 80); sound.sfx('stamp'); pause = 30; break;
      case 'relic': { const r = RELICS.find((x) => x.id === e.s)!; logLine(nm(p!) + ' takes the ' + r.name + ' as a ' + (e.n === 2 ? r.b : r.a) + '.'); sound.sfx('card'); break; }
      case 'blurComp': logLine(nm(p!) + ' blurs ' + (localDef(e.s!)?.name ?? e.s) + '.', C.doubt3); break;
      case 'seasonEnd': sound.sfx('bell'); break;
      case 'reunion': logLine(nm(q!) + ' is whole.', C.ok); setBanner(nm(q!) + ' is whole', 90); break;
      case 'strikeHalf': logLine('The Registrar strikes it for good.', C.warn); break;
    }
    if (hooks) yield* hooks.onEvent(e);
    if (pause) yield* wait(input.held('fast') ? 2 : pause, false);
  }
}

// ------------------------------------------------------------------ cell picking

export function* pickCell(cells: number[], hint: string): Co<number> {
  if (!cells.length) return -1;
  if (cells.length === 1) return cells[0];
  G.cells = cells;
  G.cellCur = cells[0];
  const label = { draw() { /* drawn by the board */ } };
  widgets.push(label);
  logLine(hint + ' Arrows choose, Z confirms.', C.sepia);
  yield;
  let out = -2;
  while (out === -2) {
    const dirs: [string, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    for (const [k, dx, dy] of dirs) {
      if (!input.pressed(k)) continue;
      let best = -1, bs = 1e9;
      for (const c of cells) {
        if (c === G.cellCur) continue;
        const ddx = cx(c) - cx(G.cellCur), ddy = cy(c) - cy(G.cellCur);
        const along = ddx * dx + ddy * dy, across = Math.abs(ddx * dy) + Math.abs(ddy * dx);
        if (along <= 0) continue;
        const sc = along + across * 2;
        if (sc < bs) { bs = sc; best = c; }
      }
      if (best < 0) best = cells[(cells.indexOf(G.cellCur) + 1) % cells.length];
      G.cellCur = best;
      sound.sfx('tick');
    }
    if (input.moved || input.clicked) for (const c of cells) if (input.inRect(tileX(c), tileY(c), TS, TS)) { G.cellCur = c; if (input.clicked) out = c; }
    if (input.pressed('ok')) out = G.cellCur;
    if (input.pressed('back')) out = -1;
    if (out === -2) yield;
  }
  G.cells = null;
  widgets.splice(widgets.indexOf(label), 1);
  yield;
  return out;
}

// ------------------------------------------------------------------ the human's turn

function yieldText(k: Kind): string {
  return k === 'road' ? 'Road: free to enter. Finder gains 1 step.' : k === 'well' ? 'Well: work it for ink. Finder gains 1 ink.' : k === 'town' ? 'Town: offers two locals to recruit.' : 'Peak: act 2 tiles away from it. Finder draws a draft.';
}

function* measureFlow(p: Player, acts: Action[]): Co<Action | null> {
  const s = S();
  const list = acts.filter((a) => a.t === 'measure') as (Action & { t: 'measure' })[];
  const cells = Array.from(new Set(list.map((a) => a.c)));
  const c = yield* pickCell(cells, 'Measure which tile?');
  if (c < 0) return null;
  const t = s.tiles[c];
  const ink = measureInk(s, p, c);
  const r = yield* menu(
    [{ label: KIND_NAME[t.a], hint: yieldText(t.a) }, { label: KIND_NAME[t.b], hint: yieldText(t.b) }],
    { title: 'Measure ' + cellName(c) + ' as (' + ink + ' ink)', w: 190 },
  );
  if (r < 0) return null;
  const k = r === 0 ? t.a : t.b;
  const base = list.find((a) => a.c === c && a.k === k)!;
  let peg = false;
  if (base.peg) peg = yield* confirm('Peg it too, for 1 ink?', 'Peg it', 'Leave it bare', 'A peg makes the tile yours and adds to your count.', 'Anyone can peg it later.');
  return { t: 'measure', c, k, peg };
}

function* sketchFlow(p: Player, acts: Action[]): Co<Action | null> {
  const list = acts.filter((a) => a.t === 'sketch') as (Action & { t: 'sketch' })[];
  const items: MenuItem[] = p.hand.map((d) => ({ label: KIND_NAME[d.a] + ' or ' + KIND_NAME[d.b] + (d.den ? ' (den)' : ''), hint: d.den ? 'Something lives on this draft. It blocks the tile until beaten.' : 'The tile will be both until someone measures it.' }));
  const h = yield* menu(items, { title: 'Sketch which draft', w: 170 });
  if (h < 0) return null;
  const cells = Array.from(new Set(list.map((a) => a.c)));
  const c = yield* pickCell(cells, 'Sketch where?');
  if (c < 0) return null;
  return { t: 'sketch', h, c };
}

function* workFlow(p: Player, acts: Action[]): Co<Action | null> {
  const s = S();
  const list = acts.filter((a) => a.t === 'work') as (Action & { t: 'work' })[];
  const here = pcell(p);
  const t = s.tiles[here];
  if (!(t.st === FIXED && t.k === 'town')) return list[0];
  const items: MenuItem[] = [];
  const map: Action[] = [];
  (t.offer ?? []).forEach((id, i) => {
    const def = localDef(id)!;
    const a = list.find((x) => x.pick === i);
    const cost = recruitCost(s, p, here, id);
    const why = p.ret.length >= p.cap ? 'Your party is full. Dismiss someone first.' : p.ink < cost ? 'Not enough ink.' : '';
    items.push({ label: 'Recruit ' + def.name, right: cost + ' ink', off: !a, hint: why || def.a.gloss + ': ' + POWER_TEXT[def.a.power!] + ' / ' + def.b.gloss + ': ' + POWER_TEXT[def.b.power!] });
    map.push(a ?? { t: 'end' });
  });
  const rest = list.find((x) => x.pick === -1);
  items.push({ label: 'Rest', off: !rest, hint: 'Fallen companions return now.' });
  map.push(rest ?? { t: 'end' });
  const r = yield* menu(items, { title: 'Town at ' + cellName(here), w: 220 });
  return r < 0 ? null : map[r];
}

function* fileFlow(p: Player): Co<Action | null> {
  const s = S();
  const cl = p.claim!;
  const items: MenuItem[] = [cl.a, cl.b].map((id) => {
    const [have, need] = claimProgress(s, p, id);
    return { label: CLAIM_TEXT[id].name, right: Math.min(have, need) + '/' + need, hint: CLAIM_TEXT[id].text };
  });
  const r = yield* menu(items, { title: 'File which reading', w: 200, footer: 'A filed claim replaces your count. You win only if it is true at the close.' });
  if (r < 0) return null;
  const ok = yield* confirm('File it? Your count stops mattering.', 'File', 'Not yet');
  return ok ? { t: 'file', r: r + 1 } : null;
}

function* partyFlow(p: Player): Co<Action | null> {
  const s = S();
  if (!p.ret.length && !p.relics.length) { yield* say('', 'You travel alone. Towns offer locals.', C.ink, true); return null; }
  const items: MenuItem[] = p.ret.map((c) => {
    const f = compFace(c);
    const state = c.half ? 'struck reading' : c.fixed ? 'fixed as ' + f.gloss : 'undecided, acting as ' + f.gloss;
    return { label: compName(c), right: c.down ? 'down' : state, hint: (f.power ? POWER_TEXT[f.power] : '') + ' Fight: ' + f.hp + ' health, ' + f.atk + ' attack, ' + f.skill.name + '.' };
  });
  for (const r of p.relics) { const def = RELICS.find((x) => x.id === r.id)!; items.push({ label: def.name + ' (' + (r.r === 2 ? def.b : def.a) + ')', hint: r.r === 2 ? def.tb : def.ta, ink: C.sepia }); }
  const i = yield* menu(items, { title: 'Your party', w: 236 });
  if (i < 0 || i >= p.ret.length) return null;
  const c = p.ret[i];
  const def = localDef(c.id);
  const opts: MenuItem[] = [];
  const acts: (Action | null)[] = [];
  if (def && !c.half && c.fixed === 0) {
    const other = c.active === 1 ? def.b : def.a;
    opts.push({ label: 'Act as ' + other.gloss, hint: POWER_TEXT[other.power!] });
    acts.push({ t: 'active', i, r: c.active === 1 ? 2 : 1 });
  }
  if (def && !c.half && c.fixed > 0) { opts.push({ label: 'Blur', right: T.blurDoubt + ' doubt', off: p.doubt < T.blurDoubt, hint: 'Return it to undecided. It can be both again.' }); acts.push({ t: 'blur', i }); }
  if (c.half) {
    const half = HALVES.find((h) => h.id === c.id)!;
    for (const q of s.players) {
      if (q.idx === p.idx || dist(pcell(p), pcell(q)) > 1) continue;
      if (half.of === q.char) { opts.push({ label: 'Send it to ' + nm(q), hint: 'It is ' + nm(q) + "'s struck reading. " + nm(q) + ' becomes whole.' }); acts.push({ t: 'sendhalf', i, to: q.idx }); }
      else if (q.char === 'deed' && c.id !== 'roost') { opts.push({ label: 'Hand it to the Registrar', hint: 'She strikes it for good. The Office remembers the favor.' }); acts.push({ t: 'sendhalf', i, to: q.idx }); }
    }
  }
  if (c.id !== 'page' && !c.half) { opts.push({ label: 'Dismiss', hint: 'It leaves your party.' }); acts.push({ t: 'dismiss', i }); }
  if (!opts.length) return null;
  const r = yield* menu(opts, { title: compName(c), w: 220 });
  return r < 0 ? null : acts[r];
}

function* backFlow(p: Player): Co<Action | null> {
  const s = S();
  const cnt = counts(s);
  const items: MenuItem[] = [];
  const acts: Action[] = [];
  for (const q of s.players) {
    if (q.idx === p.idx) continue;
    items.push({ label: 'Back ' + nm(q), right: fmtCount(cnt[q.idx]), off: p.backs === q.idx, hint: 'Your count is added to theirs. You cannot win. If they win you are their Deputy.' });
    acts.push({ t: 'back', who: q.idx });
  }
  if (p.backs >= 0) { items.push({ label: 'Withdraw backing', hint: 'Breaks a backing promise if you made one.' }); acts.push({ t: 'back', who: -1 }); }
  const r = yield* menu(items, { title: 'Back a party', w: 200 });
  return r < 0 ? null : acts[r];
}

function* amendFlow(acts: Action[]): Co<Action | null> {
  const list = acts.filter((a) => a.t === 'amend') as (Action & { t: 'amend' })[];
  const items: MenuItem[] = list.map((a) => ({ label: AMEND_TEXT[a.id] + (a.k ? ' ' + KIND_NAME[a.k] + '.' : '') }));
  const r = yield* menu(items, { title: 'Amend (2 ink, 2 doubt)', w: 240 });
  return r < 0 ? null : list[r];
}

/** The action menu. Returns an action to apply, or null when the player closed it. */
function* actionMenu(p: Player): Co<Action | null> {
  const s = S();
  const acts = legal(s);
  const has = (t: string) => acts.some((a) => a.t === t);
  const here = pcell(p);
  const t = s.tiles[here];
  const items: MenuItem[] = [];
  const run: (() => Co<Action | null>)[] = [];
  const add = (label: string, on: boolean, hint: string, f: () => Co<Action | null>, right = '') => { items.push({ label, off: !on, hint, right }); run.push(f); };
  const one = (a: Action | undefined) => function* (): Co<Action | null> { return a ?? null; };

  add('Sketch', has('sketch'), has('sketch') ? 'Put a draft on blank ground next to you.' : p.steps < 1 ? 'No steps left.' : 'No blank ground next to you.', () => sketchFlow(p, acts), '1 step');
  add('Measure', has('measure'), has('measure') ? 'Fix undecided ground to one reading.' : t.den ? 'Something lives here. Contest it first.' : t.st !== OPEN ? 'Stand on undecided ground.' : p.ink < 1 ? 'Measuring costs 1 ink.' : 'You cannot measure here.', () => measureFlow(p, acts), '1 step, 1 ink');
  const pegActs = acts.filter((a) => a.t === 'peg') as (Action & { t: 'peg' })[];
  add('Peg', pegActs.length > 0, pegActs.length ? 'Claim a tile. Fixed ground costs 1 ink. Undecided ground costs 1 doubt and counts half.' : t.peg >= 0 ? 'This tile has a peg.' : t.official ? 'Official ground takes no peg.' : 'You cannot peg here.', function* () {
    const c = yield* pickCell(Array.from(new Set(pegActs.map((a) => a.c))), 'Peg which tile?');
    return c < 0 ? null : { t: 'peg', c };
  }, '1 step');
  if (has('work') || (t.st === FIXED && t.k !== 'road') || t.st === OPEN) {
    const label = t.st === OPEN ? 'Gather doubt' : t.k === 'well' ? 'Draw ink' : t.k === 'town' ? 'Visit the town' : t.k === 'peak' ? 'Survey for a draft' : 'Work';
    add(label, has('work'), has('work') ? 'Work this tile once a turn.' : p.worked.includes(here) ? 'Already worked this turn.' : 'Nothing to do here now.', () => workFlow(p, acts), '1 step');
  }
  const fights = acts.filter((a) => a.t === 'contest') as (Action & { t: 'contest' })[];
  if (s.flags.fights) {
    add('Contest', fights.length > 0, fights.length ? 'Fight for this tile.' : 'Stand on a rival peg, a rival pawn, or a den. Costs ' + contestCost(s, p, -1) + ' steps.', function* () {
      const its: MenuItem[] = fights.map((a) => ({
        label: a.target === 'den' ? (a.who === -2 ? 'The Level' : 'The creature here') : a.target === 'peg' ? nm(s.players[a.who]) + "'s peg" : nm(s.players[a.who]) + "'s party",
        hint: a.target !== 'den' && inTruce(s, p.idx, a.who) ? 'This breaks your truce.' : a.target === 'peg' ? 'A warden defends the peg.' : '',
      }));
      const r = fights.length === 1 ? 0 : yield* menu(its, { title: 'Contest', w: 180 });
      if (r < 0) return null;
      const a = fights[r];
      if (a.target !== 'den' && inTruce(s, p.idx, a.who)) { const ok = yield* confirm('Break your truce with ' + nm(s.players[a.who]) + '?', 'Break it', 'Hold'); if (!ok) return null; }
      return a;
    }, contestCost(s, p, -1) + ' steps');
  }
  if (s.flags.claims && p.claim && !p.filed) add('File a claim', has('file'), has('file') ? 'A second way to win.' : s.round > s.rounds - T.fileBefore ? 'Too late. Claims are filed before the last ' + T.fileBefore + ' rounds.' : 'Filing costs 2 steps.', () => fileFlow(p), '2 steps');
  if (s.flags.unmeasure) add('Unmeasure', has('unmeasure'), has('unmeasure') ? 'Return this tile to both readings.' : 'Stand on fixed ground with ' + unmeasureCost(p) + ' doubt.', one(acts.find((a) => a.t === 'unmeasure')), '1 step, ' + unmeasureCost(p) + ' doubt');
  if (has('buypeg')) add('Buy this peg', true, LAW_TEXT.market.text, one(acts.find((a) => a.t === 'buypeg')), '3 ink');
  if (has('amend')) add('Amend the law', true, 'Change one rule until the close.', () => amendFlow(acts));
  if (s.flags.trades) add('Parley', p.proposals > 0, p.proposals > 0 ? 'Deal with a rival. ' + p.proposals + ' left this turn.' : 'No more offers this turn.', () => parleyFlow(p));
  add('Party', true, 'Your companions and relics.', () => partyFlow(p));
  if (has('back')) add('Back a party', true, 'Give up your own win and add your count to theirs.', () => backFlow(p));
  if (hooks) for (const x of hooks.extraActions(p)) add(x.label, true, x.hint, function* () { yield* x.run(); return null; });
  add('End turn', true, p.steps > 0 ? 'You have ' + p.steps + ' steps left.' : 'Draw back up to 3 drafts.', one({ t: 'end' }));
  const r = yield* menu(items, { title: 'Actions', x: 150, y: 40, w: 150 });
  if (r < 0) return null;
  return yield* run[r]();
}

function* humanTurn(p: Player): Co<void> {
  const s = S();
  if (hooks) yield* hooks.onTurn(p);
  if (s.pending.t !== 'turn' || s.pending.p !== p.idx) return;
  for (;;) {
    const acts = legal(s);
    let act: Action | null = null;
    const dirs: [string, number][] = [['up', 0], ['right', 1], ['down', 2], ['left', 3]];
    for (const [k, d] of dirs) if (input.pressed(k)) { const a = acts.find((x) => x.t === 'move' && x.d === d); if (a) act = a; else sound.sfx('no'); }
    if (input.clicked) {
      for (let c = 0; c < s.tiles.length; c++) {
        if (!input.inRect(tileX(c), tileY(c), TS, TS)) continue;
        const dx = cx(c) - p.x, dy = cy(c) - p.y;
        if (dx === 0 && dy === 0) act = yield* actionMenu(p);
        else if (Math.abs(dx) + Math.abs(dy) === 1) {
          const d = dy === -1 ? 0 : dx === 1 ? 1 : dy === 1 ? 2 : 3;
          const a = acts.find((x) => x.t === 'move' && x.d === d);
          if (a) act = a; else sound.sfx('no');
        }
      }
    }
    if (!act && input.pressed('ok')) act = yield* actionMenu(p);
    if (!act && input.pressed('end')) {
      if (p.steps === 0 || (yield* confirm('End your turn with ' + p.steps + ' steps left?', 'End turn', 'Keep going'))) act = { t: 'end' };
    }
    if (!act && (input.pressed('tab') || input.pressed('info'))) yield* infoFlow(p);
    if (!act && input.pressed('rules')) yield* pages('The law of the sheet', rulePages());
    if (act) {
      if (act.t === 'contest') sound.sfx('fight');
      apply(s, act);
      return;
    }
    if (s.pending.t !== 'turn' || s.pending.p !== p.idx) return;
    G.waiting = true;
    yield;
  }
}

export function rulePages(): string[][] {
  const s = G.s;
  const season = s ? s.season : 6;
  return RULE_PAGES.filter((pg) => pg.from <= season || G.free).map((pg) => pg.body);
}

// ------------------------------------------------------------------ parley

function* tilePick(title: string, near: Player): Co<number> {
  const s = S();
  const cells: number[] = [];
  for (let c = 0; c < s.tiles.length; c++) if (s.tiles[c].st === OPEN && !s.tiles[c].den && dist(c, pcell(near)) <= 3) cells.push(c);
  if (!cells.length) { yield* say('', 'No undecided ground within 3 tiles of ' + nm(near) + '.', C.ink, true); return -1; }
  return yield* pickCell(cells, title);
}

function* sendDeal(p: Player, q: Player, d: Deal): Co<boolean> {
  const s = S();
  if (!dealAffordable(s, d)) { yield* say('', 'One side cannot pay for that.', C.ink, true); return false; }
  if (q.human) {
    apply(s, { t: 'propose', deal: d });
    return true;
  }
  const v = dealVerdict(s, q.idx, d);
  apply(s, { t: 'propose', deal: d });
  apply(s, { t: 'answer', yes: v.yes });
  let last = 0;
  for (let i = s.ledger.length - 1; i >= 0; i--) if (s.ledger[i].a === q.idx && s.ledger[i].b === p.idx && s.ledger[i].d < 0) { last = s.ledger[i].round; break; }
  const fields = { n: v.short, r: last || s.round, yes: v.yesVotes, no: 9 - v.yesVotes, give: '', get: '' };
  yield* toast(q, v.yes ? 'accept' : v.reason === 'accept' ? 'refuse' : v.reason, fields, 140);
  return true;
}

function* tradeEditor(p: Player, q: Player, d: Deal, title: string): Co<Deal | null> {
  const s = S();
  for (;;) {
    const lotTally = q.char === 'lot' && !q.human ? ' Lot: ' + dealVerdict(s, q.idx, d).yesVotes + ' of 9 in favor.' : '';
    const items: MenuItem[] = [
      { label: 'You give ink', right: String(d.ink[0]), hint: 'You hold ' + p.ink + ' ink.' + lotTally },
      { label: 'You give doubt', right: String(d.doubt[0]), off: !s.flags.doubt, hint: 'You hold ' + p.doubt + ' doubt.' + lotTally },
      { label: 'You get ink', right: String(d.ink[1]), hint: nm(q) + ' holds ' + q.ink + ' ink.' + lotTally },
      { label: 'You get doubt', right: String(d.doubt[1]), off: !s.flags.doubt, hint: nm(q) + ' holds ' + q.doubt + ' doubt.' + lotTally },
      { label: 'Send the offer', hint: dealLines(s, d, p.idx).join(' ') || 'Nothing is offered yet.', ink: C.perch },
    ];
    const r = yield* menu(items, { title, w: 190 });
    if (r < 0) return null;
    if (r === 4) return d;
    const caps = [p.ink, p.doubt, q.ink, q.doubt];
    const cur = [d.ink[0], d.doubt[0], d.ink[1], d.doubt[1]][r];
    const n = yield* pickNumber(items[r].label, 0, Math.min(9, caps[r]), cur, r % 2 === 0 ? 'ink' : 'doubt');
    if (n < 0) continue;
    if (r === 0) d.ink[0] = n; else if (r === 1) d.doubt[0] = n; else if (r === 2) d.ink[1] = n; else d.doubt[1] = n;
  }
}

export function* parleyFlow(p: Player): Co<Action | null> {
  const s = S();
  const others = s.players.filter((q) => q.idx !== p.idx);
  const qi = others.length === 1 ? 0 : yield* menu(others.map((q) => ({ label: nm(q), ink: inkOf(q.char), right: 'trust ' + (s.trust[q.idx][p.idx] > 0 ? '+' : '') + s.trust[q.idx][p.idx], hint: q.human ? '' : RIVALS[q.char].wantsText })), { title: 'Parley with', w: 180 });
  if (qi < 0) return null;
  const q = others[qi];
  const prom = s.flags.promises;
  const last = s.flags.backing && s.round > s.rounds - T.backFromLast;
  const items: MenuItem[] = [
    { label: 'Ask what they want', off: q.human, hint: 'They name the deals they would sign now.' },
    { label: 'Trade', hint: 'Swap ink and doubt.' },
    { label: 'Truce', off: !prom || hadTruce(s, p.idx, q.idx), hint: !prom ? 'Promises begin on Sheet 42.' : hadTruce(s, p.idx, q.idx) ? 'One truce a sheet with each party.' : 'No contests or objections between you for 2 rounds.' },
    { label: 'Ask for a reading', off: !prom, hint: 'They promise to measure a tile your way. You may pay.' },
    { label: 'Ask them to leave a tile', off: !prom, hint: 'They promise not to measure or peg it for 2 rounds.' },
    { label: 'Promise a reading', off: !prom, hint: 'You promise to measure a tile their way. They may pay.' },
    { label: 'Ask for their backing', off: !last, hint: last ? 'Their count joins yours at the close.' : 'Backing opens in the last round.' },
    { label: 'Give a gift', hint: 'Ink or doubt, no strings. A gift of 2 or more builds trust.' },
  ];
  const r = yield* menu(items, { title: 'Parley: ' + nm(q), w: 200 });
  if (r < 0) return null;
  if (r === 0) {
    const offers = offersFrom(s, q.idx, p.idx).slice(0, 3);
    const want = bark(q.char, 'want', { name: nm(p) });
    if (want) yield* say(nm(q), want, inkOf(q.char));
    if (!offers.length) { yield* say('', nm(q) + ' has no offer for you now.', C.ink, true); return null; }
    const pick0 = yield* menu(offers.map((d) => ({ label: dealShort(s, d, p.idx), hint: dealLines(s, d, p.idx).join(' ') })), { title: nm(q) + ' offers', w: 240 });
    if (pick0 < 0) return null;
    const d = offers[pick0];
    if (dealAffordable(s, d)) { applyDeal(s, d); p.proposals--; yield* toast(q, 'accept', { n: 1 }, 90); }
    return null;
  }
  const d = emptyDeal(p.idx, q.idx);
  if (r === 1) { if (!(yield* tradeEditor(p, q, d, 'Trade with ' + nm(q)))) return null; }
  else if (r === 2) {
    d.truce = 2;
    const sweet = yield* pickNumber('Add ink to the truce offer', 0, Math.min(4, p.ink), 0, 'ink');
    if (sweet < 0) return null;
    d.ink[0] = sweet;
  } else if (r === 3 || r === 5) {
    const mineToDo = r === 5;
    const c = yield* tilePick(mineToDo ? 'Which tile will you measure?' : 'Which tile should they measure?', mineToDo ? p : q);
    if (c < 0) return null;
    const t = s.tiles[c];
    const k = yield* menu([{ label: KIND_NAME[t.a] }, { label: KIND_NAME[t.b] }], { title: 'As which reading', w: 150 });
    if (k < 0) return null;
    d.read = { who: mineToDo ? 0 : 1, c, k: k === 0 ? t.a : t.b };
    const pay = yield* pickNumber(mineToDo ? 'Ink you ask for' : 'Ink you pay', 0, Math.min(5, mineToDo ? q.ink : p.ink), 1, 'ink');
    if (pay < 0) return null;
    d.ink[mineToDo ? 1 : 0] = pay;
  } else if (r === 4) {
    const c = yield* tilePick('Which tile should they leave?', q);
    if (c < 0) return null;
    d.leave = { who: 1, c };
    const pay = yield* pickNumber('Ink you pay', 0, Math.min(5, p.ink), 1, 'ink');
    if (pay < 0) return null;
    d.ink[0] = pay;
  } else if (r === 6) {
    d.back = 1;
    const pay = yield* pickNumber('Ink you pay for it', 0, Math.min(6, p.ink), 2, 'ink');
    if (pay < 0) return null;
    d.ink[0] = pay;
  } else if (r === 7) {
    const kind = s.flags.doubt ? yield* menu([{ label: 'Ink' }, { label: 'Doubt' }], { title: 'Give', w: 100 }) : 0;
    if (kind < 0) return null;
    const n = yield* pickNumber('How much', 1, kind === 0 ? p.ink : p.doubt, 2, kind === 0 ? 'ink' : 'doubt');
    if (n <= 0) return null;
    return { t: 'gift', to: q.idx, ink: kind === 0 ? n : 0, doubt: kind === 1 ? n : 0 };
  }
  yield* sendDeal(p, q, d);
  return null;
}

function* answerDeal(p: Player, d: Deal): Co<void> {
  const s = S();
  const from = s.players[d.from];
  const key = d.back >= 0 ? (d.back === 1 ? 'askback' : 'offerback') : d.read ? 'reading' : d.truce ? 'truce' : 'trade';
  const give: string[] = [], get: string[] = [];
  if (d.ink[0]) give.push(d.ink[0] + ' ink'); if (d.doubt[0]) give.push(d.doubt[0] + ' doubt'); if (d.draft[0] >= 0) give.push('a draft');
  if (d.ink[1]) get.push(d.ink[1] + ' ink'); if (d.doubt[1]) get.push(d.doubt[1] + ' doubt'); if (d.draft[1] >= 0) get.push('a draft');
  const fields = {
    n: d.truce || d.ink[0] || 1, give: give.join(' and ') || 'nothing', get: get.join(' and ') || 'nothing', name: nm(p),
    cell: d.read ? cellName(d.read.c) : d.leave ? cellName(d.leave.c) : '', kind: d.read ? KIND_NAME[d.read.k] : '',
  };
  const line = bark(from.char, d.leave && from.char === 'either' ? 'reading' : key, fields, s.round);
  if (line && !from.human) yield* say(nm(from), line, inkOf(from.char));
  const r = yield* menu([{ label: 'Accept' }, { label: 'Refuse' }], { title: nm(from) + ' offers', w: 240, cancel: false, footer: dealLines(s, d, p.idx).join(' ') });
  apply(s, { t: 'answer', yes: r === 0 });
}

// ------------------------------------------------------------------ info

function dossier(s: State, viewer: Player, q: Player): string[][] {
  const R = RIVALS[q.char];
  const page1: string[] = ['# ' + nm(q), 'Wants: ' + (R.wantsText || 'a corner to sign.'), R.rules[0], R.rules[1], R.power];
  if (!q.human && q.char !== 'perch') {
    page1.push(q.hidden ? (q.hiddenShown ? HIDDEN_TRAITS[q.hidden] : 'One habit not yet seen.') : '');
    for (const t of q.traits) page1.push(EVOLVED_TRAITS[t] ?? t);
    if (q.whole) page1.push('Whole: its struck reading came back.');
  }
  const page2: string[] = ['# ' + nm(q) + ' and you', 'Trust in you: ' + s.trust[q.idx][viewer.idx] + ' (from -5 to 5).'];
  const why: Record<string, string> = { kept: 'you kept a promise', gift: 'a gift', backed: 'you backed them', broke: 'you broke a promise', witness: 'they saw you break a promise', contested: 'you contested them', objected: 'you objected', struck: 'you struck a companion', unmeasured: 'you unmeasured their tile', bought: 'you bought their peg', reunion: 'you returned what was struck', struckhalf: 'you handed over a struck reading', paid: 'you paid' };
  const mine = s.ledger.filter((e) => e.a === q.idx && e.b === viewer.idx).slice(-7);
  for (const e of mine) page2.push('Round ' + e.round + ': ' + (why[e.why] ?? e.why) + ' (' + (e.d > 0 ? '+' : '') + e.d + ').');
  if (!mine.length) page2.push('Nothing entered this sheet.');
  for (const pr of s.promises) {
    if (pr.state !== 'open') continue;
    if ((pr.who === q.idx && pr.to === viewer.idx) || (pr.who === viewer.idx && pr.to === q.idx)) {
      const who = pr.who === viewer.idx ? 'You' : nm(q);
      page2.push('Open: ' + who + ' ' + (pr.type === 'truce' ? 'in truce' : pr.type === 'read' ? 'to measure ' + cellName(pr.c) + ' as ' + KIND_NAME[pr.k!] : pr.type === 'leave' ? 'to leave ' + cellName(pr.c) : 'backing') + ' until round ' + pr.until + '.');
    }
  }
  const page3: string[] = ['# ' + nm(q) + "'s party"];
  for (const c of q.ret) { const f = compFace(c); page3.push(compName(c) + ' (' + (c.half ? f.gloss : c.fixed ? 'fixed, ' + f.gloss : 'undecided') + '): ' + (f.power ? POWER_TEXT[f.power] : '')); }
  if (!q.ret.length) page3.push('No companions.');
  for (const r of q.relics) { const def = RELICS.find((x) => x.id === r.id)!; page3.push(def.name + ': ' + (r.r === 2 ? def.tb : def.ta)); }
  const cl = filedClaim(q);
  if (cl) page3.push('Filed claim: ' + CLAIM_TEXT[cl].name + '. ' + CLAIM_TEXT[cl].text);
  if (q.intent && !q.human) page3.push('Last seen doing: ' + q.intent + '.');
  return [page1.filter(Boolean), page2, page3];
}

export function* infoFlow(p: Player): Co<void> {
  const s = S();
  for (;;) {
    const others = s.players.filter((q) => q.idx !== p.idx);
    const items: MenuItem[] = others.map((q) => ({ label: nm(q), ink: inkOf(q.char), hint: 'Rules, trust, and party.' }));
    items.push({ label: 'The Charter and your claim', hint: 'What counts this sheet.' });
    items.push({ label: 'The law of the sheet', hint: 'Every rule in play.' });
    const r = yield* menu(items, { title: 'Information', w: 190 });
    if (r < 0) return;
    if (r < others.length) yield* pages(nm(others[r]), dossier(s, p, others[r]));
    else if (r === others.length) {
      const st = standing(s);
      const body: string[] = ['# The Charter', 'It reads ' + CHARTER_NAME[s.charter] + '. A peg on fixed ground of a counted kind is 1. A peg on undecided ground is one half.', 'Leading now: ' + nm(s.players[st.winner]) + (st.by === 'claim' ? ' by claim.' : '.'), 'Law: ' + LAW_TEXT[s.law].name + '. ' + LAW_TEXT[s.law].text];
      for (const a of s.amend) body.push('Amended: ' + AMEND_TEXT[a.id] + (a.k ? ' (' + KIND_NAME[a.k] + ')' : ''));
      const body2: string[] = ['# Your claim'];
      if (p.claim) for (const id of [p.claim.a, p.claim.b]) { const [h, n] = claimProgress(s, p, id); body2.push(CLAIM_TEXT[id].name + ' (' + Math.min(h, n) + '/' + n + '): ' + CLAIM_TEXT[id].text); }
      else body2.push('Claims begin on Sheet 42.');
      yield* pages('What counts', [body, body2]);
    } else yield* pages('The law of the sheet', rulePages());
  }
}

// ------------------------------------------------------------------ the sheet loop

function* humanPending(): Co<void> {
  const s = S();
  const pd = s.pending;
  const p = s.players[pd.p];
  G.viewer = p.idx;
  switch (pd.t) {
    case 'turn': yield* humanTurn(p); break;
    case 'object': {
      const t = s.tiles[pd.c];
      const m = s.players[pd.m];
      const other = pd.k === t.a ? t.b : t.a;
      G.cells = [pd.c]; G.cellCur = pd.c;
      const cost = objectCost(s, m);
      const yes = yield* confirm(nm(m) + ' measures ' + cellName(pd.c) + ' as a ' + KIND_NAME[pd.k] + '.', 'Object (' + cost + ' doubt)', 'Let it stand', 'It reads ' + KIND_NAME[other] + ' instead, unless ' + nm(m) + ' pays 2 ink to insist.' + (inTruce(s, p.idx, pd.m) ? ' This breaks your truce.' : ''), '');
      G.cells = null;
      apply(s, { t: 'object', yes });
      break;
    }
    case 'insist': {
      const t = s.tiles[pd.c];
      const other = pd.k === t.a ? t.b : t.a;
      const yes = yield* confirm(nm(s.players[pd.o]) + ' objects at ' + cellName(pd.c) + '.', 'Insist (2 ink)', 'Let it read ' + KIND_NAME[other], 'The tile stays a ' + KIND_NAME[pd.k] + '.', 'You keep your ink. The tile becomes a ' + KIND_NAME[other] + '.');
      apply(s, { t: 'insist', yes });
      break;
    }
    case 'deal': yield* answerDeal(p, pd.deal); break;
    case 'bid': {
      const n = yield* pickNumber('Bid ink to steer the Level', 0, Math.min(4, p.ink), 0, 'ink');
      apply(s, { t: 'bid', n: Math.max(0, n) });
      break;
    }
    case 'steer': {
      const L = s.level!;
      const opts: MenuItem[] = [-1, 0, 1].map((d) => {
        const x = L.x + d;
        const ok = x >= 0 && x < T.W;
        const c = cellOf(Math.max(0, Math.min(T.W - 1, x)), Math.max(0, L.y - 1));
        return { label: d < 0 ? 'Left' : d > 0 ? 'Right' : 'Straight on', off: !ok, hint: 'It enters ' + tileLabel(s, c) + '.' };
      });
      const r = yield* menu(opts, { title: 'You steer the Level', cancel: false, w: 170, start: 1 });
      apply(s, { t: 'steer', d: r - 1 });
      break;
    }
    case 'relic': {
      const def = RELICS.find((x) => x.id === pd.id)!;
      const r = def.a === def.b ? 0 : yield* menu([{ label: 'As a ' + def.a, hint: def.ta }, { label: 'As a ' + def.b, hint: def.tb }], { title: 'The ' + def.name + ': pick its reading', cancel: false, w: 210 });
      apply(s, { t: 'relic', r: r + 1 });
      break;
    }
    case 'battle': yield* battleFlow(); break;
    default: break;
  }
}

export function* playSheet(story: StoryHooks | null): Co<void> {
  const s = S();
  hooks = story;
  yield* processEvents();
  let guard = 0;
  while (!s.over) {
    const pd = s.pending;
    if (pd.t === 'done') break;
    const p = pd.p >= 0 ? s.players[pd.p] : null;
    if (p && p.human) {
      yield* humanPending();
    } else {
      const a = decide(s, G.profiles);
      apply(s, a);
      if (a.t === 'end') yield* wait(input.held('fast') ? 1 : 6, false);
    }
    yield* processEvents();
    if (++guard > 200000) break;
  }
  yield* processEvents();
  hooks = null;
}

export { textWidth };
