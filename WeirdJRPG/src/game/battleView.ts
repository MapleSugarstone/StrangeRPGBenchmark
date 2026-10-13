import { rect, dither, layer, px as pxl, faded, W, withTarget, screenCtx, ctx as getCtxRef } from '../engine/screen';
import { buf, emi, beginLight, addLight, composite, spriteNormals, rgbf, hex } from '../engine/light';
import { text, textWidth, textCenter, textRight, LINE, wrap } from '../engine/font';
import { input } from '../engine/input';
import { spr, sil, outline, type Art } from '../engine/sprites';
import { sfx, setIntensity, setWarp, type SfxId } from '../engine/audio';
import {
  type Battle, type Ev, type Act, type Foe, type MoveOpt, type VornAct, type LbAct, CELLS,
  newBattle, pilgrimActions, moveOptions, doMove, doAction, targetsFor, vornActions, vornTargets, doVorn, doLb, enemyPhase, endRound,
  pilgrimSkips, liveFoes, total, maxTotal, overloadLine, fadeLine, overloaded, faded as isFaded, ACTION_NAME, ACTION_HELP, VORN_NAME, VORN_HELP,
  LB_NAME, LB_HELP, DISH_HELP, WEAVES, weaveKey, cost,
} from '../battle/engine';
import { type ActionId, type PartyIn, type Dish, type Layer, type Emotion, type HeldConcept, LAYERS, DISH_NAME, SENSE_ACTIVE, SENSE_ULT, SENSES, CATEGORY_NAME, reaction } from '../battle/model';
import { pilgrimMove, pilgrimAct, vornChoice, lbChoice } from '../battle/policy';
import { AVATAR, LB as LB_ART, VORN as VORN_ART, ENEMY_ART, LAYER_ICON, INTENT_ICON, watchman_boss_faces } from './art';
import { UI, LAYER_COLOR, MOOD_COLOR, BRASS, SEA, STONE, YEAR, VOID } from './palette';
import { panel, list, fragBar, bar, type ListItem } from './ui';
import { dlg } from './dialogue';
import { voiceOf, portraitOf } from './speakers';
import { cue } from './cues';
import type { BattleCue } from '../engine/audio';
import { breathe, sway, idHash } from './anim';
import { S } from './state';
import { game } from './registry';
import { hashStr } from '../battle/rng';

type Step =
  | { k: 'intro'; i: number }
  | { k: 'pmenu' } | { k: 'pmove' } | { k: 'pextract' } | { k: 'psense' } | { k: 'ptarget'; act: ActionId; after?: (t: number) => void; push?: number } | { k: 'pwhere'; concept: number }
  | { k: 'pconcept'; weave: boolean; first?: number; target?: number }
  | { k: 'vmenu' } | { k: 'vtarget'; act: VornAct }
  | { k: 'lmenu' } | { k: 'ldish' } | { k: 'ltarget' }
  | { k: 'events'; then: () => void }
  | { k: 'won'; t: number } | { k: 'lost'; t: number } | { k: 'done' };

interface Float { text: string; x: number; y: number; t: number; color: string }
interface Spark { x: number; y: number; vx: number; vy: number; t: number; color: string }
/** One sprite pixel set loose, on the stage grid. Gas rises and thins out. Absorb waits, then homes in on the Pilgrim. */
interface Mote { x: number; y: number; vx: number; vy: number; wait: number; t: number; color: string; kind: 'gas' | 'absorb'; seed: number; speed: number }

const V = {
  b: null as Battle | null,
  step: { k: 'done' } as Step,
  queue: [] as Ev[],
  evT: 0,
  log: [] as string[],
  floats: [] as Float[],
  sparks: [] as Spark[],
  motes: [] as Mote[],
  /** Foes the engine has removed whose 'gone' event has not played yet, so they stay drawn until then. */
  dying: new Set<number>(),
  /** Short sideways moves: a lunge toward the party when a foe acts, a recoil when it is hit. */
  jolt: new Map<number, { t: number; len: number; amp: number }>(),
  flash: new Map<number | string, number>(),
  shownHp: new Map<number, Record<Layer, number>>(),
  moved: false,
  cursor: 0,
  sub: 0,
  tcur: 0,
  onEnd: null as null | ((b: Battle) => void),
  shake: 0,
  tint: 'brass',
  bossName: '',
  phaseWait: false,
  /** A battle message is on screen and waits for a press. */
  waitKey: false,
  /** The Fragility band the music last heard about. */
  band: 'steady' as 'steady' | 'overload' | 'faded',
  /** Drawn cell positions, which glide toward the real ones. */
  disp: new Map<number | string, number>(),
  lift: 0,
};

/** The party's drawn cell. */
function dp(): number { return V.disp.get('p') ?? V.b!.p.cell; }
/** A foe's drawn cell. */
function df(f: Foe): number { return V.disp.get(f.uid) ?? f.cell; }
/** A small hop while something is between cells. */
function hop(c: number): number { const fr = Math.abs(c - Math.round(c)); return fr > 0.02 ? Math.round(Math.sin(fr * Math.PI) * 3) : 0; }

export function battleActive(): boolean { return V.step.k !== 'done'; }
export function currentBattle(): Battle | null { return V.b; }

export function startBattle(groups: string[], party: PartyIn, opts: { seed: number; tint: string; scripted?: string[]; scale?: number }, onEnd: (b: Battle) => void): void {
  V.b = newBattle(groups, party, opts);
  V.tint = opts.tint;
  V.onEnd = onEnd;
  V.log = [];
  V.floats = []; V.sparks = []; V.motes = []; V.dying.clear(); V.jolt.clear(); V.flash.clear(); V.shownHp.clear(); V.disp.clear(); V.lift = 0;
  for (const f of V.b.foes) V.shownHp.set(f.uid, { ...f.hp });
  V.moved = false;
  V.cursor = S.cursors.battle || 0;
  const first = V.b.foes[0];
  V.log.push(V.b.foes.length > 1 ? `${first.name} and ${V.b.foes.length - 1} more drift close.` : `${first.name} drifts close.`);
  V.step = { k: 'intro', i: 0 };
  V.band = 'steady';
  setIntensity(V.b.boss ? 0.7 : 0.4);
  cue('start', { foes: V.b.foes.length, frac: V.b.p.f / V.b.p.fmax });
}

// ---------- Flow ----------

function play(evs: Ev[], then: () => void): void {
  V.queue.push(...evs);
  for (const e of evs) if (e.t === 'gone') V.dying.add(e.uid);
  V.evT = 0;
  V.step = { k: 'events', then };
}

function afterPilgrim(): void {
  const b = V.b!;
  if (b.outcome) return finish();
  if (b.vorn && !b.vorn.down) { V.step = { k: 'vmenu' }; V.cursor = S.cursors.vorn || 0; return; }
  afterVorn();
}
function afterVorn(): void {
  const b = V.b!;
  if (b.outcome) return finish();
  if (b.lb && !b.lb.down) { V.step = { k: 'lmenu' }; V.cursor = S.cursors.lb || 0; return; }
  foesTurn();
}
function foesTurn(): void {
  const b = V.b!;
  if (b.outcome) return finish();
  play(enemyPhase(b), () => {
    if (b.outcome) return finish();
    play(endRound(b), () => {
      if (b.outcome) return finish();
      startRound();
    });
  });
}
function startRound(): void {
  const b = V.b!;
  V.moved = false;
  cue('round', { frac: b.p.f / b.p.fmax });
  setWarp(overloaded(b) ? 0.6 : 0);
  setIntensity(Math.min(1, (b.boss ? 0.6 : 0.3) + (1 - b.p.f / b.p.fmax) * 0.4));
  if (pilgrimSkips(b)) { V.log.push('You cannot act this round.'); afterPilgrim(); return; }
  V.step = { k: 'pmenu' };
  V.cursor = Math.min(S.cursors.battle || 0, menuItems().length - 1);
}
function finish(): void {
  const b = V.b!;
  setWarp(0);
  setIntensity(0);
  V.floats = []; V.sparks = [];
  cue('end', { won: b.outcome === 'win' || b.outcome === 'choice' });
  if (b.outcome === 'win') { sfx('victory'); V.step = { k: 'won', t: 0 }; }
  else if (b.outcome === 'choice') { V.step = { k: 'done' }; V.onEnd?.(b); }
  else { sfx('defeat'); V.step = { k: 'lost', t: 0 }; }
}

// ---------- Menus ----------

interface Cmd { id: string; label: string; ok: boolean; help: string; right?: string }

function menuItems(): Cmd[] {
  const b = V.b!;
  const acts = pilgrimActions(b);
  const get = (id: ActionId) => acts.find(a => a.id === id);
  const out: Cmd[] = [];
  if (!V.moved) out.push({ id: 'move', label: 'Move', ok: moveOptions(b).length > 0, help: 'Walk, slide, float, or weave through an enemy. Then act.' });
  const add = (id: ActionId) => { const a = get(id); if (a) out.push({ id, label: a.name, ok: a.ok, help: a.ok ? ACTION_HELP[id] : a.why || '', right: a.cost ? String(a.cost) : '' }); };
  add('strip');
  const ex = (['extract_memory', 'extract_emotion', 'extract_name'] as ActionId[]).map(get).filter(Boolean);
  if (ex.length) out.push({ id: 'extract', label: 'Extract', ok: ex.some(a => a!.ok), help: ex.some(a => a!.ok) ? 'Pull a memory, a feeling, or a name out of it.' : ex[0]!.why || '' });
  add('absorb'); add('weave'); add('unmake');
  const senses = [...SENSES.map(s => SENSE_ACTIVE[s]), ...SENSES.map(s => SENSE_ULT[s])].map(get).filter(Boolean);
  if (senses.length) out.push({ id: 'senses', label: 'Senses', ok: senses.some(a => a!.ok), help: 'Sight, Touch, Hearing, Taste, Smell, and Thought.' });
  add('hold');
  return out;
}

function subItems(ids: ActionId[]): Cmd[] {
  const acts = pilgrimActions(V.b!);
  return ids.map(id => acts.find(a => a.id === id)).filter(Boolean).map(a => ({ id: a!.id, label: a!.name, ok: a!.ok, help: a!.ok ? ACTION_HELP[a!.id] : a!.why || '', right: a!.cost ? String(a!.cost) : '' }));
}

const MOVE_NAME: Record<string, string> = { walk: 'Walk', slide: 'Slide', float: 'Float', weave: 'Weave' };
const MOVE_HELP: Record<string, string> = {
  walk: 'Move one cell.', slide: 'Move two cells. You take half again as much until your next turn.',
  float: 'Move one cell, or stay. Ground attacks miss you until your next turn.', weave: 'Pass through the enemy beside you without harming it.',
};
function moveItems(): (Cmd & { m: MoveOpt })[] {
  const b = V.b!;
  return moveOptions(b).map(m => ({ id: m.kind, m, label: `${MOVE_NAME[m.kind]} ${m.to > b.p.cell ? 'forward' : m.to < b.p.cell ? 'back' : 'in place'}`, ok: true, help: MOVE_HELP[m.kind] }));
}

function navigate(n: number): boolean {
  if (n <= 0) return false;
  if (input.hit('up')) { V.cursor = (V.cursor + n - 1) % n; sfx('move'); }
  if (input.hit('down')) { V.cursor = (V.cursor + 1) % n; sfx('move'); }
  return true;
}

function chooseAction(id: ActionId): void {
  const b = V.b!;
  const info = pilgrimActions(b).find(a => a.id === id);
  if (!info || !info.ok) { sfx('buzz'); return; }
  sfx('confirm');
  if (info.target === 'adj' || info.target === 'any') {
    V.step = { k: 'ptarget', act: id };
    const ts = targetsFor(b, id);
    V.tcur = Math.max(0, ts.findIndex(f => f.uid === b.last?.target));
    return;
  }
  if (info.target === 'concept') { V.step = { k: 'pconcept', weave: false }; V.sub = 0; return; }
  if (info.target === 'two') { V.step = { k: 'pconcept', weave: true }; V.sub = 0; return; }
  commit({ id });
}

function commit(a: Act): void {
  const b = V.b!;
  V.log.push(`You: ${ACTION_NAME[a.id]}.`);
  const held = a.id === 'absorb' ? b.p.hand[a.concept ?? 0] : undefined;
  const verbs: BattleCue[] = ['strip', 'extract_memory', 'extract_emotion', 'extract_name', 'absorb', 'weave', 'unmake'];
  if ((verbs as string[]).includes(a.id)) cue(a.id as BattleCue, { emotion: held?.emotion, layer: held?.layer });
  else if (a.id !== 'hold') cue('sense');
  play(doAction(b, a), afterPilgrim);
}

function updateMenus(): void {
  const b = V.b!;
  const st = V.step;
  switch (st.k) {
    case 'pmenu': {
      const items = menuItems();
      navigate(items.length);
      if (input.hit('ok')) {
        const c = items[V.cursor];
        S.cursors.battle = V.cursor;
        if (!c?.ok) { sfx('buzz'); return; }
        if (c.id === 'move') { V.step = { k: 'pmove' }; V.sub = V.cursor; V.cursor = 0; sfx('confirm'); }
        else if (c.id === 'extract') { V.step = { k: 'pextract' }; V.cursor = 0; sfx('confirm'); }
        else if (c.id === 'senses') { V.step = { k: 'psense' }; V.cursor = S.cursors.sense || 0; sfx('confirm'); }
        else chooseAction(c.id as ActionId);
      }
      return;
    }
    case 'pmove': {
      const items = moveItems();
      navigate(items.length);
      if (input.hit('back')) { V.step = { k: 'pmenu' }; V.cursor = 0; return; }
      if (input.hit('ok') && items[V.cursor]) {
        const m = items[V.cursor].m;
        sfx(m.kind === 'float' ? 'float' : m.kind === 'slide' ? 'slide' : 'step');
        V.moved = true;
        play(doMove(b, m), () => { V.step = { k: 'pmenu' }; V.cursor = 0; });
      }
      return;
    }
    case 'pextract': case 'psense': {
      const ids: ActionId[] = st.k === 'pextract' ? ['extract_memory', 'extract_emotion', 'extract_name'] : [...SENSES.map(s => SENSE_ACTIVE[s]), ...SENSES.map(s => SENSE_ULT[s])];
      const items = subItems(ids);
      navigate(items.length);
      if (input.hit('back')) { V.step = { k: 'pmenu' }; V.cursor = S.cursors.battle || 0; return; }
      if (input.hit('ok') && items[V.cursor]) { if (st.k === 'psense') S.cursors.sense = V.cursor; chooseAction(items[V.cursor].id as ActionId); }
      return;
    }
    case 'ptarget': {
      const ts = targetsFor(b, st.act);
      if (!ts.length) { V.step = { k: 'pmenu' }; return; }
      if (input.hit('left') || input.hit('up')) { V.tcur = (V.tcur + ts.length - 1) % ts.length; sfx('move'); }
      if (input.hit('right') || input.hit('down')) { V.tcur = (V.tcur + 1) % ts.length; sfx('move'); }
      V.tcur = Math.min(V.tcur, ts.length - 1);
      if (input.hit('back')) { V.step = { k: 'pmenu' }; return; }
      if (input.hit('ok')) {
        sfx('confirm');
        const t = ts[V.tcur].uid;
        if (st.after) st.after(t); else commit({ id: st.act, target: t });
      }
      return;
    }
    case 'pconcept': {
      const hand = b.p.hand;
      if (input.hit('up')) { V.sub = (V.sub + hand.length - 1) % hand.length; sfx('move'); }
      if (input.hit('down')) { V.sub = (V.sub + 1) % hand.length; sfx('move'); }
      if (input.hit('back')) { V.step = { k: 'pmenu' }; return; }
      if (input.hit('ok')) {
        const c = hand[V.sub];
        if (!c) return;
        if (!st.weave) {
          if (c.layer === 'name' && liveFoes(b).length) {
            V.step = { k: 'ptarget', act: 'savor', after: t => commit({ id: 'absorb', concept: V.sub, target: t }) };
            V.tcur = 0;
            sfx('confirm');
            return;
          }
          V.step = { k: 'pwhere', concept: V.sub }; V.cursor = 0; sfx('confirm');
          return;
        }
        if (st.first === undefined) { V.step = { k: 'pconcept', weave: true, first: V.sub }; V.sub = (V.sub + 1) % hand.length; sfx('confirm'); return; }
        if (V.sub === st.first) { sfx('buzz'); return; }
        const pair: [number, number] = [st.first, V.sub];
        const key = weaveKey(hand[pair[0]].layer, hand[pair[1]].layer);
        if (['memory+name', 'emotion+name', 'name+name'].includes(key) && liveFoes(b).length > 1) {
          V.step = { k: 'ptarget', act: 'savor', after: t => commit({ id: 'weave', concepts: pair, target: t }) };
          V.tcur = 0;
          return;
        }
        commit({ id: 'weave', concepts: pair, target: liveFoes(b)[0]?.uid });
      }
      return;
    }
    case 'pwhere': {
      navigate(2);
      if (input.hit('back')) { V.step = { k: 'pconcept', weave: false }; V.sub = st.concept; return; }
      if (input.hit('ok')) {
        const ci = st.concept;
        if (V.cursor === 0) { commit({ id: 'absorb', concept: ci }); return; }
        if (!liveFoes(b).length) { sfx('buzz'); return; }
        V.step = { k: 'ptarget', act: 'savor', push: ci, after: t => commit({ id: 'absorb', concept: ci, target: t, push: true }) };
        V.tcur = 0; sfx('confirm');
      }
      return;
    }
    case 'vmenu': {
      const items = vornActions(b);
      navigate(items.length);
      if (input.hit('ok')) {
        const it = items[V.cursor];
        S.cursors.vorn = V.cursor;
        if (!it?.ok) { sfx('buzz'); return; }
        sfx('confirm');
        const ts = vornTargets(b, it.id);
        if (ts.length > 1) { V.step = { k: 'vtarget', act: it.id }; V.tcur = 0; return; }
        V.log.push(`Vorn: ${VORN_NAME[it.id]}.`);
        play(doVorn(b, it.id, ts[0]?.uid), afterVorn);
      }
      return;
    }
    case 'vtarget': {
      const ts = vornTargets(b, st.act);
      if (input.hit('left') || input.hit('up')) { V.tcur = (V.tcur + ts.length - 1) % ts.length; sfx('move'); }
      if (input.hit('right') || input.hit('down')) { V.tcur = (V.tcur + 1) % ts.length; sfx('move'); }
      if (input.hit('back')) { V.step = { k: 'vmenu' }; return; }
      if (input.hit('ok') && ts[V.tcur]) { sfx('confirm'); V.log.push(`Vorn: ${VORN_NAME[st.act]}.`); play(doVorn(b, st.act, ts[V.tcur].uid), afterVorn); }
      return;
    }
    case 'lmenu': {
      const items: LbAct[] = ['cook', 'cheer', 'glow', 'hide'];
      navigate(items.length);
      if (input.hit('ok')) {
        const it = items[V.cursor];
        S.cursors.lb = V.cursor;
        sfx('confirm');
        if (it === 'cook') { V.step = { k: 'ldish' }; V.sub = 0; return; }
        if (it === 'glow') { V.step = { k: 'ltarget' }; V.tcur = 0; return; }
        V.log.push(`#123: ${LB_NAME[it]}.`);
        play(doLb(b, it), afterVorn2);
      }
      return;
    }
    case 'ldish': {
      const dishes: Dish[] = ['ravioli', 'toast', 'quiche', 'cake'];
      if (input.hit('up')) { V.sub = (V.sub + 3) % 4; sfx('move'); }
      if (input.hit('down')) { V.sub = (V.sub + 1) % 4; sfx('move'); }
      if (input.hit('back')) { V.step = { k: 'lmenu' }; return; }
      if (input.hit('ok')) {
        const d = dishes[V.sub];
        if ((b.lb!.pantry[d] || 0) <= 0) { sfx('buzz'); return; }
        sfx('cook');
        V.log.push(`#123: ${DISH_NAME[d]}.`);
        play(doLb(b, 'cook', { dish: d }), afterVorn2);
      }
      return;
    }
    case 'ltarget': {
      const ts = liveFoes(b);
      if (input.hit('left') || input.hit('up')) { V.tcur = (V.tcur + ts.length - 1) % ts.length; sfx('move'); }
      if (input.hit('right') || input.hit('down')) { V.tcur = (V.tcur + 1) % ts.length; sfx('move'); }
      if (input.hit('back')) { V.step = { k: 'lmenu' }; return; }
      if (input.hit('ok') && ts[V.tcur]) { V.log.push('#123: Glow.'); play(doLb(b, 'glow', { target: ts[V.tcur].uid }), afterVorn2); }
      return;
    }
  }
}
function afterVorn2(): void { foesTurn(); }

/** The auto-player's turn: the shared policy picks, and the view plays it like a pressed command. */
export function autoBattle(): void {
  const b = V.b;
  if (!b || dlg.active) return;
  const st = V.step;
  if (st.k === 'pmenu' || st.k === 'pmove' || st.k === 'pextract' || st.k === 'psense' || st.k === 'ptarget' || st.k === 'pconcept' || st.k === 'pwhere') {
    const m = V.moved ? null : pilgrimMove(b);
    if (m) { V.moved = true; play(doMove(b, m), () => { V.step = { k: 'pmenu' }; V.cursor = 0; }); return; }
    commit(pilgrimAct(b));
  } else if (st.k === 'vmenu' || st.k === 'vtarget') {
    const c = vornChoice(b);
    V.log.push(`Vorn: ${VORN_NAME[c.id]}.`);
    play(doVorn(b, c.id, c.target), afterVorn);
  } else if (st.k === 'lmenu' || st.k === 'ldish' || st.k === 'ltarget') {
    const c = lbChoice(b);
    play(doLb(b, c.id, { dish: c.dish, target: (c as { target?: number }).target }), afterVorn2);
  }
}

/** Which step the battle view is on, for the auto-player. */
export function battleStep(): string { return V.step.k; }
/** For tests: loose pixels in flight and foes still waiting to come apart. */
export function battleMotes(): { motes: number; dying: number } { return { motes: V.motes.length, dying: V.dying.size }; }

// ---------- Events ----------

const EV_SFX: Record<string, SfxId> = {
  strip: 'strip', extract_memory: 'extract_memory', extract_emotion: 'extract_emotion', extract_name: 'extract_name', unmake: 'unmake', absorb: 'absorb',
  weave: 'weave', true_sight: 'true_sight', handshake: 'handshake', echo: 'echo', savor: 'savor', scent: 'scent', insight: 'insight', silence: 'silence',
  devour: 'devour', void_touch: 'void_touch', vorn_hit: 'vorn_hit', steady: 'steady', cook: 'cook', fade: 'fade', unravel: 'unravel',
};

function foeCenter(uid: number): { x: number; y: number } {
  const f = V.b!.foes.find(q => q.uid === uid);
  if (!f) return { x: 160, y: 80 };
  return { x: (df(f) * 16 + f.size * 8) * 2, y: 80 };
}
function whoCenter(who: string): { x: number; y: number } {
  const b = V.b!;
  if (who === 'lb') return { x: 16, y: 70 };
  return { x: dp() * 32 + (who === 'vorn' ? 8 : 24), y: 96 };
}

function burst(x: number, y: number, color: string, n = 10): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    V.sparks.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2), vy: Math.sin(a) * (1 + Math.random() * 2) - 1, t: 20 + (Math.random() * 10 | 0), color });
  }
}

/** A second idle frame: the body sinks a pixel onto its base, or the top half leans a pixel. */
function idleFrame(art: Art, lean: boolean): Art { return (lean && sway(art)) || breathe(art); }

/** Where and how a foe is drawn on the stage grid. */
function foePlace(f: Foe): { art: Art; x: number; y: number; w: number; h: number; c1: string; c2: string } {
  const base = foeArt(f);
  const hs = idHash(f.def.id);
  const idle = !f.def.floats && Math.floor((game.tick + f.uid * 11) / (26 + (hs % 3) * 6)) & 1;
  const art = idle ? idleFrame(base, (hs & 1) === 1) : base;
  const w = art[0].length, h = art.length;
  const j = V.jolt.get(f.uid);
  const jx = j ? Math.round(Math.sin((1 - j.t / j.len) * Math.PI) * j.amp) : 0;
  const x = Math.round(df(f) * 16 + (f.size * 16 - w) / 2) + jx;
  const bob = f.def.floats ? ((game.tick >> 4) + f.uid) & 1 : 0;
  const y = 56 - h - (f.def.floats ? 6 : 0) - bob - hop(df(f));
  return { art, x, y, w, h, c1: f.voidVariant ? VOID.mid : f.def.c1, c2: f.voidVariant ? VOID.white : f.def.c2 };
}

/** Every filled pixel of a foe as drawn (foes face left, so the art is mirrored). */
function foePixels(f: Foe): { x: number; y: number; color: string; ink: boolean }[] {
  const p = foePlace(f);
  const out: { x: number; y: number; color: string; ink: boolean }[] = [];
  p.art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      out.push({ x: p.x + p.w - 1 - x, y: p.y + y, color: ch === '1' ? p.c1 : ch === '2' ? p.c2 : UI.ink, ink: ch === '0' });
    }
  });
  return out;
}

/** The Pilgrim's middle on the stage grid, which absorbed motes fly to. */
function pilgrimTarget(): { x: number; y: number } { return { x: dp() * 16 + 12, y: 52 - V.lift * 8 }; }

function gasMote(x: number, y: number, color: string, wait: number, slow: boolean): Mote {
  const k = slow ? 0.6 : 1;
  return { x, y, vx: (Math.random() - 0.5) * 0.3 * k, vy: -(0.12 + Math.random() * 0.3) * k, wait, t: 30 + (Math.random() * 50 | 0), color, kind: 'gas', seed: Math.random() * 6.28, speed: 0 };
}

/**
 * A defeated foe comes apart pixel by pixel. Taken apart by damage, its colors stream into the Pilgrim and its ink rises as gas.
 * Unmade, forgotten, erased, or calmed, all of it rises as gas.
 */
function loosen(f: Foe, how: string): void {
  const px = foePixels(f);
  if (!px.length) return;
  const top = Math.min(...px.map(p => p.y)), left = Math.min(...px.map(p => p.x));
  const take = how === 'unravel';
  for (const p of px) {
    if (take && !p.ink) {
      V.motes.push({ x: p.x, y: p.y, vx: 0, vy: 0, wait: Math.round((p.x - left) * 0.7 + Math.random() * 10), t: 140, color: p.color, kind: 'absorb', seed: Math.random() * 6.28, speed: 0.3 });
    } else {
      V.motes.push(gasMote(p.x, p.y, p.color, Math.round((p.y - top) * 0.8 + Math.random() * 8), how === 'calm'));
    }
  }
}

/** A removed layer leaves its foe as a thread of pixels in the layer's color, drawn into the Pilgrim. */
function stream(f: Foe, layer: Layer): void {
  const px = foePixels(f).filter(p => !p.ink);
  for (let i = 0; i < 14 && px.length; i++) {
    const p = px[(Math.random() * px.length) | 0];
    V.motes.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 0.8, vy: -0.4 - Math.random() * 0.6, wait: i * 2, t: 140, color: LAYER_COLOR[layer], kind: 'absorb', seed: Math.random() * 6.28, speed: 0.3 });
  }
}

function updateMotes(): void {
  const to = pilgrimTarget();
  for (const m of V.motes) {
    if (m.wait > 0) { m.wait--; continue; }
    m.t--;
    if (m.kind === 'gas') {
      m.vy -= 0.006;
      m.x += m.vx + Math.sin(m.t * 0.21 + m.seed) * 0.12;
      m.y += m.vy;
      continue;
    }
    const dx = to.x - m.x, dy = to.y - m.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { m.t = 0; continue; }
    m.speed = Math.min(3, m.speed + 0.1);
    m.vx = m.vx * 0.82 + (dx / d) * m.speed * 0.18;
    m.vy = m.vy * 0.82 + (dy / d) * m.speed * 0.18;
    m.x += m.vx; m.y += m.vy;
  }
  V.motes = V.motes.filter(m => m.t > 0 && m.y > -2);
}

/** Adds a floating label, lifted above any label still near the same spot. */
function float(s: string, x: number, y: number, t: number, color: string): void {
  const w = textWidth(s);
  const cx = (f: { text: string; x: number }) => Math.max(4, Math.min(220 - textWidth(f.text), Math.round(f.x - textWidth(f.text) / 2))) + textWidth(f.text) / 2;
  const me = { text: s, x };
  const clash = (y0: number) => V.floats.filter(f => Math.abs(cx(f) - cx(me)) < (textWidth(f.text) + w) / 2 + 10 && Math.abs(f.y - y0) < 17);
  let yy = y;
  for (let k = 0; k < 8 && clash(yy).length && yy - 21 >= 5; k++) yy -= 17;
  for (const f of clash(yy)) V.floats.splice(V.floats.indexOf(f), 1);
  V.floats.push({ text: s, x, y: yy, t, color });
}

function runEvent(e: Ev): number {
  const b = V.b!;
  switch (e.t) {
    case 'say':
      if (e.speaker) { dlg.say(e.speaker, e.text, voiceOf(e.speaker), portraitOf(e.speaker), true); V.phaseWait = true; return 0; }
      V.log.push(e.text); V.waitKey = true; return 0;
    case 'act':
      if (e.who === 'vorn' || e.who === 'lb') cue(e.who);
      if (typeof e.who === 'number') { V.jolt.set(e.who, { t: 14, len: 14, amp: -4 }); return 10; }
      return 6;
    case 'hit': {
      const c = foeCenter(e.uid);
      V.flash.set(e.uid, 6);
      V.jolt.set(e.uid, { t: 8, len: 8, amp: e.weak || e.crit ? 3 : 2 });
      float(String(e.amount) + (e.weak ? '!' : ''), c.x, c.y - 30, 40, LAYER_COLOR[e.layer]);
      burst(c.x, c.y - 10, LAYER_COLOR[e.layer], e.weak ? 14 : 8);
      sfx('hit', { pitch: e.weak ? 1.3 : 1 });
      if (e.weak || e.crit) V.shake = 4;
      const sh = V.shownHp.get(e.uid);
      const f = b.foes.find(q => q.uid === e.uid);
      if (sh && f) sh[e.layer] = Math.max(f.hp[e.layer], sh[e.layer] - e.amount);
      return 16;
    }
    case 'layer_off': {
      cue('layer_off', { layer: e.layer });
      const c = foeCenter(e.uid);
      const lf = b.foes.find(q => q.uid === e.uid);
      if (lf) stream(lf, e.layer);
      float(e.label, c.x, c.y - 44, 70, LAYER_COLOR[e.layer]);
      sfx(e.layer === 'shell' ? 'shell_get' : e.layer === 'memory' ? 'memory_get' : e.layer === 'emotion' ? 'emotion_get' : 'name_get');
      return 24;
    }
    case 'hurt': {
      cue('hurt', { amount: e.amount });
      const c = whoCenter(e.who);
      V.flash.set(e.who, 6);
      float('-' + e.amount, c.x, c.y - 20, 40, e.who === 'pilgrim' ? UI.violet : UI.red);
      sfx('hurt');
      V.shake = 3;
      return 18;
    }
    case 'miss': {
      cue('miss');
      const c = typeof e.who === 'number' ? foeCenter(e.who) : whoCenter(e.who);
      float('miss', c.x, c.y - 20, 30, UI.dim);
      sfx('miss');
      return 12;
    }
    case 'heal': {
      cue('heal', { amount: e.amount });
      const c = whoCenter(e.who);
      float('+' + e.amount, c.x, c.y - 20, 40, UI.green);
      sfx('heal');
      return 14;
    }
    case 'gain': {
      const c = whoCenter('pilgrim');
      float('+' + e.amount, c.x + 6, c.y - 28, 30, UI.paper);
      return 4;
    }
    case 'fx': {
      const s = EV_SFX[e.fx];
      if (s) sfx(s);
      const c = e.uid !== undefined ? foeCenter(e.uid) : whoCenter(e.who || 'pilgrim');
      const col = e.fx.includes('memory') ? LAYER_COLOR.memory : e.fx.includes('emotion') ? LAYER_COLOR.emotion : e.fx.includes('name') ? LAYER_COLOR.name : e.fx === 'unmake' ? UI.white : e.fx === 'strip' ? LAYER_COLOR.shell : UI.gold;
      burst(c.x, c.y - 10, col, e.fx === 'unmake' || e.fx === 'devour' ? 24 : 8);
      if (e.fx === 'unravel' || e.fx === 'devour') V.shake = 8;
      return e.fx === 'unmake' ? 26 : 12;
    }
    case 'move': return Math.max(6, Math.abs(e.to - e.from) * (e.kind === 'slide' ? 5 : 9));
    case 'gone': {
      cue(e.how === 'calm' ? 'calm' : 'foe_down', { foes: liveFoes(V.b!).length });
      const gf = b.foes.find(q => q.uid === e.uid);
      if (gf) loosen(gf, e.how);
      V.dying.delete(e.uid);
      sfx(e.how === 'unmade' ? 'unmake' : e.how === 'calm' ? 'handshake' : 'fade');
      return 34;
    }
    case 'phase': {
      cue('phase', { phase: V.b!.foes.find(f => f.uid === e.uid)?.phase });
      dlg.say(e.speaker, e.text, voiceOf(e.speaker), portraitOf(e.speaker), true);
      V.phaseWait = true;
      return 0;
    }
    case 'break': {
      cue('reality_break');
      V.log.push(e.text);
      V.waitKey = true;
      sfx('overload');
      V.shake = 8;
      game.flash = 4; game.flashColor = UI.red;
      return 40;
    }
  }
  return 10;
}

function updateEvents(): void {
  const st = V.step as Extract<Step, { k: 'events' }>;
  if (V.phaseWait) { if (!dlg.active) V.phaseWait = false; else return; }
  if (V.waitKey) {
    if (input.hit('ok') || input.hit('back') || input.held('fast')) { V.waitKey = false; sfx('move'); }
    else return;
  }
  if (V.evT > 0) {
    V.evT -= input.held('fast') ? 3 : 1;
    return;
  }
  const e = V.queue.shift();
  if (!e) { st.then(); return; }
  V.evT = runEvent(e);
}

export function battleUpdate(): void {
  const b = V.b;
  if (!b) return;
  for (const [k, v] of V.flash) { if (v <= 1) V.flash.delete(k); else V.flash.set(k, v - 1); }
  for (const [k, j] of V.jolt) { if (--j.t <= 0) V.jolt.delete(k); }
  const band = overloaded(b) ? 'overload' : isFaded(b) ? 'faded' : 'steady';
  if (band !== V.band) { V.band = band; cue(band, { frac: b.p.f / b.p.fmax }); }
  const ease = (k: number | string, target: number, speed: number) => {
    const c = V.disp.get(k) ?? target;
    const d = target - c;
    V.disp.set(k, Math.abs(d) <= speed ? target : c + Math.sign(d) * speed);
  };
  ease('p', b.p.cell, 1 / 8);
  for (const f of b.foes) ease(f.uid, f.cell, 1 / 8);
  V.lift += ((b.p.float ? 1 : 0) - V.lift) * 0.2;
  for (const f of V.floats) { f.t--; f.y -= 0.4; }
  V.floats = V.floats.filter(f => f.t > 0 && f.y >= 5);
  for (const s of V.sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.12; s.t--; }
  V.sparks = V.sparks.filter(s => s.t > 0);
  updateMotes();
  for (const f of b.foes) {
    const sh = V.shownHp.get(f.uid);
    if (sh) for (const l of LAYERS) if (sh[l] > f.hp[l]) sh[l] = Math.max(f.hp[l], sh[l] - Math.max(1, (sh[l] - f.hp[l]) * 0.12));
  }
  if (dlg.active && !V.phaseWait && V.step.k !== 'intro') return;
  const st = V.step;
  if (st.k === 'intro') {
    if (dlg.active) return;
    const lines = b.foes.flatMap(f => f.def.intro || []);
    if (st.i < lines.length) { dlg.say(lines[st.i].speaker, lines[st.i].text, voiceOf(lines[st.i].speaker), portraitOf(lines[st.i].speaker), true); st.i++; return; }
    startRound();
    return;
  }
  if (st.k === 'events') { updateEvents(); return; }
  if (st.k === 'won' || st.k === 'lost') {
    st.t++;
    if (st.t > 30 && (input.hit('ok') || st.t > 400)) { V.step = { k: 'done' }; V.onEnd?.(b); }
    return;
  }
  updateMenus();
}

// ---------- Drawing ----------

function drawBackground(t: number): void {
  const tint = V.tint;
  const bands = tint === 'sea' ? [SEA.deep, SEA.night, SEA.blue, SEA.teal] : tint === 'year' ? [YEAR.dark, YEAR.brown, YEAR.red, YEAR.orange, YEAR.sky] : tint === 'stone' ? [STONE.void, STONE.deep, STONE.violet, STONE.blue] : tint === 'void' ? [VOID.black, VOID.ink, VOID.dim] : [BRASS.sky0, BRASS.sky1, BRASS.sky2, BRASS.sky3, BRASS.sky4];
  for (let i = 0; i < bands.length; i++) {
    const y0 = Math.round((i * 56) / bands.length), y1 = Math.round(((i + 1) * 56) / bands.length);
    rect(0, y0, 112, y1 - y0, bands[i]);
    if (i < bands.length - 1) dither(0, y1 - 2, 112, 2, bands[i + 1], 0.5);
  }
  if (tint === 'brass') {
    for (let k = 0; k < 3; k++) {
      const gx = 20 + k * 38, gy = 30 + (k % 2) * 8, r = 9 + k * 2;
      const a = t / (60 + k * 20) * (k % 2 ? -1 : 1);
      for (let s = 0; s < 8; s++) { const an = a + (s * Math.PI) / 4; rect(gx + Math.cos(an) * r - 1, gy + Math.sin(an) * r - 1, 3, 3, BRASS.sky1); }
      for (let s = 0; s < 24; s++) { const an = (s * Math.PI) / 12; pxl(gx + Math.cos(an) * (r - 2), gy + Math.sin(an) * (r - 2), BRASS.sky1); }
    }
  } else if (tint === 'sea') {
    for (let x = 0; x < 112; x += 2) pxl(x, 44 + Math.round(Math.sin(x / 7 + t / 20) * 2), SEA.seafoam);
  } else if (tint === 'stone' || tint === 'void') {
    for (let k = 0; k < 18; k++) if (((t >> 4) + k) % 5) pxl(hashStr('bs' + k) % 112, hashStr('by' + k) % 50, k & 1 ? STONE.cyan : STONE.magenta);
  } else if (tint === 'year') {
    for (let x = 0; x < 112; x += 9) rect(x, 40 - (hashStr('t' + x) % 10), 7, 16 + (hashStr('t' + x) % 10), YEAR.brown);
  }
  const ground = tint === 'sea' ? SEA.ink : tint === 'year' ? YEAR.brown : tint === 'stone' ? STONE.deep : tint === 'void' ? VOID.dim : BRASS.dark;
  const line = tint === 'sea' ? SEA.teal : tint === 'year' ? YEAR.mustard : tint === 'stone' ? STONE.cyan : tint === 'void' ? VOID.mid : BRASS.brass;
  rect(0, 56, 112, 16, ground);
  rect(0, 56, 112, 1, line);
  for (let c = 0; c <= CELLS; c++) rect(c * 16, 57, 1, 2, line);
}

function foeArt(f: Foe): Art {
  if (f.def.art === 'watchman_boss') return watchman_boss_faces[Math.min(f.phase, watchman_boss_faces.length) - 1];
  return ENEMY_ART[f.def.art] || ENEMY_ART.mite;
}

function drawFoes(): void {
  const b = V.b!;
  const t = game.tick;
  const targeting = V.step.k === 'ptarget' || V.step.k === 'vtarget' || V.step.k === 'ltarget';
  const tlist = V.step.k === 'ptarget' ? targetsFor(b, V.step.act) : V.step.k === 'vtarget' ? vornTargets(b, V.step.act) : V.step.k === 'ltarget' ? liveFoes(b) : [];
  const tsel = tlist[Math.min(V.tcur, tlist.length - 1)];
  for (const f of b.foes) {
    if (f.gone && !V.dying.has(f.uid)) continue;
    const { art, x, y, w, h, c1, c2 } = foePlace(f);
    const draw = () => {
      if (V.flash.get(f.uid)) sil(art, 0, 0, UI.white);
      else { outline(art, 0, 0, UI.ink); spr(art, 0, 0, c1, c2, true); }
    };
    faded(w + 2, h + 2, x, y, f.shadow && f.def.layers.shell ? 0.6 : 1, draw);
    if (targeting && f === tsel && (t >> 3) & 1) {
      rect(x - 2, y - 2, 2, 1, UI.gold); rect(x - 2, y - 2, 1, 2, UI.gold);
      rect(x + w, y - 2, 2, 1, UI.gold); rect(x + w + 1, y - 2, 1, 2, UI.gold);
      rect(x - 2, y + h + 1, 2, 1, UI.gold); rect(x - 2, y + h, 1, 2, UI.gold);
      rect(x + w, y + h + 1, 2, 1, UI.gold); rect(x + w + 1, y + h, 1, 2, UI.gold);
    }
  }
  const pc0 = Math.round(dp() * 16);
  if (b.vorn) {
    const a = VORN_ART[b.vorn.down ? 1 : 0];
    if (b.vorn.down) faded(8, 12, pc0, 46, 0.5, () => spr(a, 0, 0, '#4a5a6c', '#704030'));
    else if (V.flash.get('vorn')) sil(a, pc0, 44, UI.white);
    else if (b.vorn.shadow) faded(9, 13, pc0, 44, 0.6, () => spr(a, 0, 0, '#6a7a8c', '#a0542c'));
    else spr(a, pc0, 44 - hop(dp()), '#6a7a8c', '#a0542c');
  }
}

function drawParty(): void {
  const b = V.b!;
  const t = game.tick;
  for (const f of b.foes) {
    if (f.gone || !f.shown || V.step.k === 'events') continue;
    const sh = f.shown;
    const icon = sh.move ? (sh.move.effect === 'heal_self' || sh.move.effect === 'shell_self' ? 'heal' : sh.move.kind) : sh.to !== f.cell ? 'move' : 'none';
    const lie = f.def.liar && sh !== f.intent;
    const ix = Math.round(df(f) * 16) + f.size * 8 - 3, iy = 1 + (f.def.boss ? 0 : 4);
    spr(INTENT_ICON[icon], ix, iy, lie ? UI.violet : icon === 'void' ? UI.violet : UI.paper, UI.red);
    const w = f.windup;
    if (w) w.locks.forEach((l, i) => rect(ix + 8 + i * 4, iy + 2, 3, 3, w.broken.includes(l) ? UI.faint : LAYER_COLOR[l]));
    else if (sh.charge && (t >> 3) & 1) rect(ix + 2, iy + 8, 3, 1, UI.gold);
  }
  if (b.echoAlly) spr(AVATAR.wire[0], Math.round(dp() * 16) + 8, 34, UI.gold, UI.paper);
  if (b.lb) {
    const a = LB_ART[(t >> 4) & 1];
    const y = 40 - ((t >> 4) & 1);
    if (b.lb.down) faded(8, 8, 4, 48, 0.4, () => spr(a, 0, 0, '#a09880', '#c8c0a8'));
    else if (V.flash.get('lb')) sil(a, 4, y, UI.white);
    else { outline(a, 4, y, '#5a4a20'); spr(a, 4, y, '#fff0a0', '#ffffff'); }
  }
  const pc = Math.round(dp() * 16);
  if (b.vorn?.guarding) rect(pc + 8, 44, 1, 12, UI.gold);
  const av = AVATAR[S.avatar] || AVATAR.snake;
  const art = av[(t >> 5) & 1];
  const py = Math.round(48 - V.lift * 8) - ((t >> 4) & 1) - hop(dp());
  const mood = b.p.buff ? MOOD_COLOR[b.p.buff.kind] || MOOD_COLOR.none : overloaded(b) ? ((t >> 2) & 1 ? UI.red : UI.gold) : MOOD_COLOR.none;
  const drawP = () => { if (V.flash.get('pilgrim')) sil(art, 0, 0, UI.white); else { outline(art, 0, 0, '#2a3a5a'); spr(art, 0, 0, mood, '#3a4a6a'); } };
  if (b.p.unseen > 0) faded(10, 10, pc + 8, py, 0.25, drawP);
  else if (isFaded(b)) faded(10, 10, pc + 8, py, 0.5, drawP);
  else faded(10, 10, pc + 8, py, 1, drawP);
  if (b.p.armorShell?.shell || b.p.worn) rect(pc + 8, py + 9, 8, 1, LAYER_COLOR.shell);
}


function drawPanel(): void {
  const b = V.b!;
  const t = game.tick;
  panel(0, 144, 224, 80);
  const state = overloaded(b) ? 'OVERLOAD' : isFaded(b) ? 'FADED' : '';
  text(state || 'Fragility', 6, 148, state ? (overloaded(b) ? ((t >> 3) & 1 ? UI.red : UI.gold) : UI.violet) : UI.dim);
  fragBar(58, 150, 100, b.p.f, b.p.fmax, fadeLine(b), overloadLine(b), t);
  textRight(`${Math.max(0, Math.round(b.p.f))}/${b.p.fmax}`, 218, 148, UI.paper);
  let x = 6;
  if (b.vorn) { text('Vorn', x, 158, b.vorn.down ? UI.dim : UI.paper); bar(x + 25, 161, 32, 3, b.vorn.hp / b.vorn.max, b.vorn.down ? UI.dim : '#9cc0d8'); x += 64; }
  if (b.lb) { text('#123', x, 158, b.lb.down ? UI.dim : UI.paper); bar(x + 25, 161, 28, 3, b.lb.hp / b.lb.max, b.lb.down ? UI.dim : '#f4e08c'); x += 60; }
  const hx = 224 - 6 - b.p.hand.length * 9;
  b.p.hand.forEach((c, i) => spr(LAYER_ICON[c.layer], hx + i * 9, 158, LAYER_COLOR[c.layer], UI.ink));
  if (b.p.hand.length) text('Held', hx - 25, 158, UI.dim);
  rect(4, 168, 216, 1, UI.edge);

  const st = V.step;
  const lx = 8, ly = 172, lw = 84, hx2 = 100, hw = 116;
  const help = (s: string, extra?: string) => {
    const lines = wrap(s, hw);
    const shown = lines.slice(0, extra ? 4 : 5);
    shown.forEach((l, i) => text(l, hx2, ly + i * LINE, UI.dim));
    if (extra) text(extra, hx2, ly + shown.length * LINE + 1, UI.gold);
  };
  if (st.k === 'pmenu' || st.k === 'pextract' || st.k === 'psense') {
    const items = st.k === 'pmenu' ? menuItems() : subItems(st.k === 'pextract' ? ['extract_memory', 'extract_emotion', 'extract_name'] : [...SENSES.map(s => SENSE_ACTIVE[s]), ...SENSES.map(s => SENSE_ULT[s])]);
    const rows = 5;
    const top = Math.max(0, Math.min(V.cursor - rows + 1, items.length - rows));
    list(items.map<ListItem>(c => ({ label: c.label, ok: c.ok, right: c.right })), V.cursor, lx, ly, lw, Math.max(0, top), rows);
    const c = items[V.cursor];
    if (c) help(c.help);
  } else if (st.k === 'pmove') {
    const items = moveItems();
    list(items.map(c => ({ label: c.label })), V.cursor, lx, ly, lw + 10, 0, 5);
    const c = items[V.cursor];
    if (c) help(c.help);
  } else if (st.k === 'ptarget' || st.k === 'vtarget' || st.k === 'ltarget') {
    const tl = st.k === 'ptarget' ? targetsFor(b, st.act) : st.k === 'vtarget' ? vornTargets(b, st.act) : liveFoes(b);
    const f = tl[Math.min(V.tcur, tl.length - 1)];
    text('Choose a target.', lx, ly, UI.paper);
    text('Left and right', lx, ly + LINE, UI.dim);
    text('switch.', lx, ly + 2 * LINE, UI.dim);
    if (f) {
      const seen = b.trueSight || f.insight;
      text(f.name, hx2, ly, UI.gold);
      if (st.k === 'ptarget' && st.push !== undefined && b.p.hand[st.push]) { const pv = pushPreview(b.p.hand[st.push], f); text(pv[0], hx2, ly + LINE, pv[1]); }
      else if (seen) text(CATEGORY_NAME[f.category], hx2, ly + LINE, UI.dim);
      LAYERS.filter(l => f.max[l]).forEach((l, i) => {
        const x = hx2 + (i % 2) * 56, y = ly + (2 + (i >> 1)) * LINE;
        spr(LAYER_ICON[l], x, y, LAYER_COLOR[l], UI.ink);
        text(seen ? String(f.hp[l]) : Math.round((f.hp[l] / f.max[l]) * 100) + '%', x + 11, y, LAYER_COLOR[l]);
      });
    }
  } else if (st.k === 'pwhere') {
    const c = b.p.hand[st.concept];
    list([{ label: 'Into you' }, { label: 'Into an enemy' }], V.cursor, lx, ly, lw + 10, 0, 5);
    if (c) help(V.cursor === 0 ? ABSORB_HELP[c.layer] : PUSH_HELP[c.layer]);
  } else if (st.k === 'pconcept') {
    const hand = b.p.hand;
    list(hand.map((c, i) => ({ label: fitText(c.label, st.first === i ? 62 : 80), color: LAYER_COLOR[c.layer], right: st.first === i ? '1st' : '' })), V.sub, lx, ly, lw + 10, Math.max(0, V.sub - 4), 5);
    const c = hand[V.sub];
    if (c) {
      if (st.weave && st.first !== undefined && st.first !== V.sub) {
        const w = WEAVES[weaveKey(hand[st.first].layer, c.layer)];
        help(`${w.name}: ${w.text}`, `Costs ${cost(b, 'weave')}`);
      } else help(st.weave ? 'Choose two concepts to fuse.' : ABSORB_HELP[c.layer]);
    }
  } else if (st.k === 'vmenu') {
    const items = vornActions(b);
    list(items.map(c => ({ label: VORN_NAME[c.id], ok: c.ok })), V.cursor, lx, ly, lw, 0, 5);
    const c = items[V.cursor];
    text('Vorn acts', hx2, ly, UI.gold);
    if (c) wrap(c.ok ? VORN_HELP[c.id] : c.why || '', hw).slice(0, 4).forEach((l, i) => text(l, hx2, ly + (i + 1) * LINE, UI.dim));
  } else if (st.k === 'lmenu') {
    const items: LbAct[] = ['cook', 'cheer', 'glow', 'hide'];
    list(items.map(c => ({ label: LB_NAME[c] })), V.cursor, lx, ly, lw, 0, 5);
    text('#123 acts', hx2, ly, UI.gold);
    wrap(LB_HELP[items[V.cursor]], hw).slice(0, 4).forEach((l, i) => text(l, hx2, ly + (i + 1) * LINE, UI.dim));
  } else if (st.k === 'ldish') {
    const dishes: Dish[] = ['ravioli', 'toast', 'quiche', 'cake'];
    list(dishes.map(d => ({ label: DISH_NAME[d].replace('Thousand Smile ', ''), ok: (b.lb!.pantry[d] || 0) > 0, right: String(b.lb!.pantry[d] || 0) })), V.sub, lx, ly, lw + 6, 0, 5);
    help(DISH_HELP[dishes[V.sub]]);
  } else {
    const lines = V.log.slice(-6).flatMap(l => wrap(l, 204)).slice(-5);
    const newest = wrap(V.log[V.log.length - 1] || '', 204).length;
    lines.forEach((l, i) => text(l, lx, ly + i * LINE, i >= lines.length - newest ? UI.paper : UI.dim));
    if (V.waitKey && (t >> 4) & 1) text('\u0002', 212, 214, UI.gold);
    if (st.k === 'won') {
      const c = b.collected;
      const n = (l: Layer) => c.filter(x => x.layer === l).length;
      const parts = LAYERS.filter(l => n(l)).map(l => `${n(l)} ${l === 'memory' && n(l) > 1 ? 'memories' : l + (n(l) > 1 ? 's' : '')}`);
      const rows: [string, string][] = [['The concepts settle into you.', UI.gold]];
      for (const l of wrap(parts.join(', ') || 'Nothing to keep.', 200)) rows.push([l, UI.paper]);
      if (b.concepts.length) for (const l of wrap('Concept: ' + b.concepts.join(', '), 200)) rows.push([l, UI.white]);
      const bw = Math.max(...rows.map(([s]) => textWidth(s))) + 14, bh = rows.length * LINE + 9;
      panel(112 - Math.ceil(bw / 2), 36, bw, bh);
      rows.forEach(([s, c], i) => textCenter(s, 112, 41 + i * LINE, c));
    }
    if (st.k === 'lost') { const lw = textWidth('You fade away.') + 14; panel(112 - Math.ceil(lw / 2), 50, lw, 18); textCenter('You fade away.', 112, 55, UI.violet); }
  }
}

const PUSH_HELP: Record<Layer, string> = {
  memory: 'A Memory-Struck enemy remembers. Others drop it.',
  emotion: 'It meets the enemy\'s own feeling. Choose a target to see what happens.',
  shell: 'Houses an enemy so it loses its next action. Shell-Bound ones wear it. The Void eats it.',
  name: 'Call an enemy by this name. It becomes what the name was.',
};

/** Cuts a label to fit a width in pixels, ending it with a period. */
function fitText(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  let t = s;
  while (t.length > 1 && textWidth(t + '.') > w) t = t.slice(0, -1);
  return t.trimEnd() + '.';
}

/** What a pushed essence will do to this enemy, and the color to say it in. */
function pushPreview(c: HeldConcept, f: Foe): [string, string] {
  if (c.layer === 'memory') return f.category === 'memory' ? [f.def.boss || f.def.up ? 'It will remember and stop.' : 'It will remember and leave.', UI.green] : ['It will drop it.', UI.dim];
  if (c.layer === 'shell') return f.category === 'void' || f.voidVariant ? ['It will eat it instead.', UI.gold] : f.category === 'shell' ? ['It will wear it.', UI.red] : ['It will be housed.', UI.green];
  if (c.layer === 'emotion') {
    const theirs = f.hp.emotion > 0 ? (f.def.emotion as Emotion | undefined) : undefined;
    const r = theirs ? reaction((c.emotion || 'joy') as Emotion, theirs) : 'unbalance';
    return r === 'feed' ? ['It will feed on it.', UI.red] : r === 'overwhelm' ? ['It will be overwhelmed.', UI.green] : ['It will be unbalanced.', UI.gold];
  }
  return ['It will become something else.', UI.gold];
}

const ABSORB_HELP: Record<Layer, string> = {
  memory: 'A memory restores a quarter of your Fragility.',
  emotion: 'An emotion becomes your weapon for three rounds.',
  shell: 'You wear the shell. Armor, and resistance to the Void.',
  name: 'Call an enemy by this name. It becomes what the name was.',
};

const SW = 112, SH = 72;
function stageCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
const [, bgG] = stageCanvas();
const [, foeG] = stageCanvas();
const [, partyG] = stageCanvas();
const [stageCv, stageG] = stageCanvas();
const stageImg = new ImageData(SW, SH);
const stageU32 = new Uint32Array(stageImg.data.buffer);

const TINT_AMBIENT: Record<string, [string, number]> = {
  brass: ['#fff0d8', 1.15], sea: ['#c8e0ff', 0.85], year: ['#ffe0b0', 1.0], stone: ['#d8c8ff', 0.6], void: ['#c8c0e0', 0.4],
};

/** The stage at its own 112 by 72 resolution: art, light, dither, bars, numbers, and sparks all share one pixel grid. */
function drawLitStage(sx: number): void {
  const b = V.b!;
  withTarget(bgG, () => drawBackground(game.tick));
  foeG.clearRect(0, 0, SW, SH);
  partyG.clearRect(0, 0, SW, SH);
  withTarget(foeG, drawFoes);
  withTarget(partyG, drawParty);
  const bg = new Uint32Array(bgG.getImageData(0, 0, SW, SH).data.buffer);
  const fo = new Uint32Array(foeG.getImageData(0, 0, SW, SH).data.buffer);
  const pa = new Uint32Array(partyG.getImageData(0, 0, SW, SH).data.buffer);
  emi.fill(1);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const s = y * SW + x, i = y * W + x;
    if (pa[s] >>> 24) { buf[i] = pa[s] | 0xff000000; emi[i] = 1; }
    else if (fo[s] >>> 24) { buf[i] = fo[s] | 0xff000000; emi[i] = 2; }
    else { buf[i] = bg[s]; emi[i] = y >= 56 ? 0 : 1; }
  }
  spriteNormals();
  const [ac, lvl] = TINT_AMBIENT[V.tint] || TINT_AMBIENT.brass;
  const a = rgbf(hex(ac));
  beginLight([a[0] * lvl, a[1] * lvl, a[2] * lvl], null);
  const mood = b.p.buff ? MOOD_COLOR[b.p.buff.kind] || MOOD_COLOR.none : overloaded(b) ? UI.red : MOOD_COLOR.none;
  addLight(dp() * 16 + 12, 52 - V.lift * 8, 36, isFaded(b) ? 0.35 : overloaded(b) ? 1.0 : 0.7, hex(mood), { z: 6 });
  if (b.lb && !b.lb.down) addLight(8, 43, 40, 0.9, 0xfff0a0, { z: 12 });
  for (const f of liveFoes(b)) {
    const cx = df(f) * 16 + f.size * 8;
    if (f.category === 'void' || f.voidVariant) addLight(cx, 48, 26, 0.6, 0x000000, { negative: true });
    else if (f.def.floats) addLight(cx, 42, 18, 0.4, hex(f.def.c2));
  }
  for (const s of V.sparks) addLight(s.x / 2, s.y / 2, 5, 0.4, hex(s.color));
  for (let i = 0; i < V.motes.length; i += 24) { const m = V.motes[i]; if (m.kind === 'absorb' && m.wait <= 0) addLight(m.x, m.y, 7, 0.35, hex(m.color)); }
  composite(0, SH);
  for (let y = 0; y < SH; y++) stageU32.set(buf.subarray(y * W, y * W + SW), y * SW);
  stageG.putImageData(stageImg, 0, 0);
  withTarget(stageG, () => { drawLayerBars(); drawSparks(); });
  const g = screenCtx();
  g.imageSmoothingEnabled = false;
  g.drawImage(stageCv, 0, 0, SW, SH, sx * 2, 0, SW * 2, SH * 2);
  drawFloats();
}

/** Four thin bars under each foe, one per layer it has. Drawn on the stage grid. */
function drawLayerBars(): void {
  const b = V.b!;
  for (const f of b.foes) {
    if (f.gone && !V.dying.has(f.uid)) continue;
    const sh = V.shownHp.get(f.uid) || f.hp;
    const ls = LAYERS.filter(l => f.max[l]);
    const x = Math.round(df(f) * 16) + 2, w = f.size * 16 - 4;
    rect(x - 1, 58, w + 2, ls.length * 2 + 1, UI.ink);
    ls.forEach((l, k) => {
      const y = 59 + k * 2;
      rect(x, y, w, 1, UI.faint);
      rect(x, y, Math.round((w * sh[l]) / f.max[l]), 1, UI.white);
      rect(x, y, Math.round((w * f.hp[l]) / f.max[l]), 1, LAYER_COLOR[l]);
    });
  }
}

/** Sparks and loose pixels, on the stage grid. */
function drawSparks(): void {
  for (const s of V.sparks) rect(Math.round(s.x / 2), Math.round(s.y / 2), 1, 1, s.color);
  for (const m of V.motes) rect(Math.round(m.x), Math.round(m.y), 1, 1, m.color);
}

/** Floating numbers and labels: ordinary interface text in small panels, drawn over the scaled stage. */
function drawFloats(): void {
  for (const f of V.floats) {
    const w = textWidth(f.text);
    const x = Math.max(4, Math.min(220 - w, Math.round(f.x - w / 2))), y = Math.max(5, Math.round(f.y));
    panel(x - 4, y - 4, w + 8, 15);
    text(f.text, x, y, f.color);
  }
}

export function battleDraw(): void {
  if (!V.b) return;
  const sx = V.shake > 0 ? (V.shake-- & 1 ? 1 : -1) : 0;
  drawLitStage(sx);
  drawPanel();
}

export { DISH_HELP };
