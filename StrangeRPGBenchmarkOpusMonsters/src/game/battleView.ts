import { act, advance, aimable, basicOf, hpShare, nameOf, passivesOf, seenName, seenPassives, seenSprite, seenTypes, spriteOf, typesOf, sk, canGuard, canSwitch, forecast, ticks, isBig, legal, moveDef, moveText, newBattle, pegChance, pegLine, replace, reserves, standing, STATUS_NAME, targetKind, usable, laneSnap } from '../battle/engine';
import { playCry } from './cries';
import { choose as aiChoose, chooseReplacement, describeAction } from '../battle/ai';
import type { Action, Battle, Ev, Fighter, LaneSnap, Mon, SpriteData, Summon } from '../battle/model';
import { MARKS, MOVES, NOTIONS, PASSIVES, SUMMONS, type MoveDef } from '../battle/registry';

/** The bottom panel's grid: seven rows of text 9 pixels apart from y 124, and the divider between the actions and the detail. */
const MENU_Y = 124, MENU_ROWS = 7, DIVIDER = 90;
/** The speed lanes: a dark strip above your panel, right of where damage numbers rise from your whorl. */
const LANE_X = 113, LANE_Y = 56, LANE_W = 72;
/** A switch in frames: the old whorl leaves, a pause, then the new whorl pops out and settles. */
const SW_LEAVE = 22, SW_PAUSE = 10, SW_ENTER = 26;
/** One switch on screen: the whorl leaving, the one coming, frames so far, and whether a foe's move forced it. */
interface Swap { from: number; to: number; t: number; forced: boolean; popped: boolean }
/** Frames for a lane's marks to glide, and for a switch's old marks to dim and new marks to feed in, on the switch's own beats. */
const LANE_GLIDE = 30, LANE_FADE = SW_LEAVE + SW_PAUSE, LANE_FEED = SW_ENTER;
/** One speed lane as drawn: its marks, where a glide started, turns taken that the clock has not passed, and a switch's fade and feed. */
interface Lane { out: number; next: number; step: number; fromNext: number; fromStep: number; glide: number; past: number[]; oldNext: number; oldStep: number; fade: number; feed: number }
const smooth = (u: number): number => u * u * (3 - 2 * u);
const sameLane = (a: LaneSnap, b: LaneSnap | null): boolean => !!b && a.t === b.t && a.out[0] === b.out[0] && a.out[1] === b.out[1]
  && [0, 1].every(i => Math.abs(a.next[i] - b.next[i]) < 0.01 && Math.abs(a.step[i] - b.step[i]) < 0.01);
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { clear, ctx, dither, layer, mix, rect, INK } from '../engine/screen';
import { drawAura } from '../data/starborn';
import { drawFighter, FOE_AT, MINE_AT, paintBackdrop, SCENE_H, SCENE_W, sceneNow, type SceneFigure, type SceneLight } from './backdrops';
import { drawSprite } from '../engine/sprites';
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { catchJingle, levelJingle, missJingle, switchInJingle, switchOutJingle } from './jingles';
import { LEVEL_MAX, TYPE_COLOR, typeMult, xpToNext, type Type } from '../data/types';
import { close, fadeToBlack, run, type Mode } from './modes';
import { box, BADC, cdIcon, cursor, DIM, GOOD, hpBar, MINE, NERVE, PAPER, markIcon, miniSigil, pips, SEL, tideGauge, tideIcon, teamShell, capIcon, statusIcon, THEIRS, typeBadge, WARN } from './ui';
import { G, HERO, foeLevel, HORN_NAME, capHere, giveXp, levelOf, loosened, nerveUnlocked, owned, scaleNow, seen, type PegKind } from './state';

export interface BattleOpts {
  enemy: Mon[];
  name: string;
  ai: 'wild' | 'trainer' | 'keeper' | 'champion';
  wild: boolean;
  canRun?: boolean;
  sync?: boolean;
  scripted?: string;
  bg?: [string, string];
  /** Backdrop key. Defaults to the current map's. */
  scene?: string;
  area?: string;
  music?: string;
  xpScale?: number;
  noXp?: boolean;
  /** Multiplies the enemy's HP, for legendary encounters. */
  bossHp?: number;
  /** Teaching notes, each shown once at the first player turn where its test holds. */
  tips?: { when: (b: Battle) => boolean; lines: string[] }[];
  /** A practice battle: the player's side is `mine` with `charm`, tide is on, nothing reaches the save, and V opens the debug menu. */
  practice?: { mine: Mon[]; charm: string | null; debug: (view: PracticeView) => Promise<void> };
}

/** What practice's debug menu reads and changes in a running battle: the battle, its messages so far, and the action the foe last took. */
export interface PracticeView { b: Battle; log: string[]; aiTook: string }

/** A fighter's name, look, and types as the player sees them: true for the player's side, the disguise for the other. */
const who = (f: Fighter): string => (f.side === 0 ? nameOf(f) : seenName(f));
const look = (f: Fighter) => (f.side === 0 ? spriteOf(f) : seenSprite(f));
const kinds = (f: Fighter) => (f.side === 0 ? typesOf(f) : seenTypes(f));

export interface BattleOutcome { result: 'win' | 'lose' | 'run'; pegged: Mon[]; kos: number }

interface Disp { hp: number; shield: number; ko: boolean; gone: boolean; flash: number; shake: number; off: number; }
interface Float { x: number; y: number; s: string; c: string; t: number }
/** A light an effect casts on the backdrop, in scene pixels. One that travels moves from x, y to tx, ty over its life at full strength. */
interface Glow { x: number; y: number; tx: number; ty: number; r: number; lv: number; tint?: string; t: number; life: number; travel: boolean }

/** The middle of a side's slough in scene pixels. */
const midOf = (side: 0 | 1): [number, number] => (side === 0 ? [MINE_AT[0] + 4, MINE_AT[1] + 4] : [FOE_AT[0] + 4, FOE_AT[1] + 4]);

type Phase = 'events' | 'menu' | 'target' | 'switch' | 'peg' | 'replace' | 'tagto' | 'end' | 'info' | 'aim' | 'tip';

const PEG_ORDER: PegKind[] = ['twig', 'brass', 'bone', 'iron'];
const PEG_NAME = HORN_NAME;

const AI_TIERS: BattleOpts['ai'][] = ['wild', 'trainer', 'keeper', 'champion'];

export function battle(o: BattleOpts): Promise<BattleOutcome> {
  // Challenge and Hard raise every foe's level and AI. Practice, tutorials, scripted catches, and level-synced fights stay as set.
  const diff = G.opts.difficulty || 0;
  if (diff && !o.practice && !o.tips && !o.scripted && !o.sync) {
    o = { ...o, enemy: o.enemy.map(m => ({ ...m, level: Math.min(LEVEL_MAX, foeLevel(m.level)) })),
      ai: diff === 2 ? 'champion' : AI_TIERS[Math.min(3, AI_TIERS.indexOf(o.ai) + 1)] };
  }
  // On the Strand, whorls from the Volute fight at their Strand level.
  const mine = o.practice ? o.practice.mine : G.party.filter(m => m).map(m => (scaleNow.strand && m.strand ? { ...m, level: m.strand.level } : m));
  if (!mine.length) return Promise.resolve({ result: 'run', pegged: [], kos: 0 });
  const b = newBattle(
    { mons: mine, name: HERO, ai: 'keeper', charm: o.practice ? o.practice.charm : G.charm, player: true },
    { mons: o.enemy, name: o.name, ai: o.ai, wild: o.wild },
    { nerve: o.practice ? true : nerveUnlocked(), wild: o.wild, sync: !!o.sync, canRun: !!o.canRun, scripted: o.scripted },
  );
  if (!o.practice) for (const m of o.enemy) seen(m.kind);
  // From chapter 3 of the Strand the sea reaches into battles: high tide starts both pools at 3, low tide brings stars.
  if (scaleNow.strand && !o.practice) { b.rules.strand = true; b.rules.tideHigh = !!G.flags.tide; }
  if (scaleNow.strand && !o.practice && G.flags.seaBattles && b.rules.nerve) {
    if (G.flags.tide) { b.s[0].nerve = Math.max(b.s[0].nerve, 3); b.s[1].nerve = Math.max(b.s[1].nerve, 3); }
    else { b.s[0].nerve = 0; b.s[1].nerve = 0; b.rules.starEvery = 4; }
  }
  if (o.bossHp) for (const f of b.s[1].f) { f.maxHp = Math.round(f.maxHp * o.bossHp); f.st.hp = f.maxHp; f.hp = f.maxHp; }
  const view = new BattleView(b, o);
  return fadeToBlack().then(() => {
    if (o.music) music.play(o.music);
    return run<BattleOutcome>(view);
  });
}

class BattleView implements Mode {
  opaque = true;
  finish?: (v: BattleOutcome) => void;
  b: Battle;
  o: BattleOpts;
  phase: Phase = 'events';
  queue: Ev[] = [];
  cur: Ev | null = null;
  timer = 0;
  msgText = '';
  banner = '';
  bannerT = 0;
  disp: Disp[][];
  outIdx: [number, number];
  sel = 0;
  sub = 0;
  options: { label: string; action?: Action; kind: string; i?: number; ok: boolean; why?: string; hidden?: boolean }[] = [];
  pendingMove: { i: number; target?: number } | null = null;
  /** The attack or move waiting for the player to pick the foe or one of its aimable summons. */
  aimBase: Action | null = null;
  floats: Float[] = [];
  glows: Glow[] = [];
  lastTint: string | undefined;
  endLines: string[] = [];
  outcome: BattleOutcome | null = null;
  enter = 30;
  t = 0;
  laneT = -1;
  laneGoal = 0;
  laneSpan = 0;
  laneBusy = 0;
  laneQ: LaneSnap[] = [];
  laneLast: LaneSnap | null = null;
  lanes: Lane[] = [];
  swaps: (Swap | null)[] = [null, null];
  swapCries: { f: Fighter; at: number }[] = [];
  xpDone = false;
  infoText: string[] = [];
  tipLines: string[] = [];
  tipsShown = new Set<number>();
  /** The battle's messages so far, newest last, for practice's debug menu. */
  log: string[] = [];
  debugging = false;
  /** Set when V is pressed while events play, so the debug menu opens once they have. */
  debugAsk = false;
  aiTook = '';

  constructor(b: Battle, o: BattleOpts) {
    this.b = b;
    this.o = o;
    this.disp = b.s.map(s => s.f.map(f => ({ hp: f.hp, shield: f.shield, ko: f.ko, gone: f.gone, flash: 0, shake: 0, off: 0 })));
    this.outIdx = [b.s[0].out, b.s[1].out];
    const first = b.s[1].f[b.s[1].out], mine = b.s[0].f[b.s[0].out];
    // The Register marks a kind once a starborn one of it has come out.
    if (o.wild && first.mon.starborn) G.flags['sb:' + first.mon.kind] = 1;
    const foeMsg: Ev = { e: 'msg', text: o.wild ? `A ${first.mon.starborn ? 'starborn' : 'wild'} ${who(first)} comes out of the ${o.area || 'brush'}.` : `${o.name} sends out ${who(first)}.` };
    const myMsg: Ev = { e: 'msg', text: `${HERO} sends out ${who(mine)}.` };
    this.introCries.set(foeMsg, first).set(myMsg, mine);
    this.queue.push(foeMsg, myMsg);
    this.collect();
  }

  /** The two opening lines, each with the whorl that cries when it shows. */
  introCries = new Map<Ev, Fighter>();

  /** A fighter's cry as the player hears it: a disguise cries as what it looks like. */
  cry(f: Fighter, mode: 'out' | 'crest' | 'ko'): void {
    const disguised = f.side === 1 && f.disguise;
    playCry(disguised ? { name: seenName(f), types: seenTypes(f), sprite: seenSprite(f) } : { name: nameOf(f), types: typesOf(f), sprite: spriteOf(f), fitted: f.mon.fitted && !f.form, parents: f.mon.parents },
      mode, { pan: f.side === 0 ? -0.35 : 0.35, at: mode === 'out' ? 0.16 : 0, vol: 0.9 });
  }

  collect(): void {
    this.queue.push(...this.b.ev);
    this.b.ev = [];
  }

  /**
   * Opens practice's debug menu at a point where no events wait to play, then puts the battle back in order:
   * a knocked-out whorl that was about to act loses its turn, a knocked-out foe is replaced, and the shown HP matches.
   */
  openDebug(): void {
    this.debugging = true;
    this.debugAsk = false;
    sfx('ok');
    void this.o.practice!.debug({ b: this.b, log: this.log, aiTook: this.aiTook }).then(() => {
      const b = this.b;
      this.debugging = false;
      const s0 = b.s[0], s1 = b.s[1];
      if (b.over === null && b.need?.kind === 'act' && s0.f[s0.out].ko) { b.need = null; b.acting = null; s0.next = b.t + 60; }
      if (b.over === null && s1.f[s1.out].ko && standing(s1).length) replace(b, 1, chooseReplacement(b, 1));
      this.collect();
      b.s.forEach((s, si) => s.f.forEach((f, fi) => { const d = this.disp[si][fi]; d.hp = f.hp; d.shield = f.shield; d.ko = f.ko; d.gone = f.gone; }));
      this.pendingMove = null; this.aimBase = null;
      this.phase = 'events';
    });
  }

  speed(): number { return input.held('fast') ? 3 : G.opts.speed || 1; }

  // ------------------------------------------------------------ flow

  step(): void {
    if (this.queue.length) { this.phase = 'events'; return; }
    if (this.b.over !== null) { this.finishBattle(); return; }
    const d = advance(this.b, (bb, side) => (side === 1 ? chooseReplacement(bb, side) : -1));
    this.collect();
    if (this.queue.length && d.kind !== 'over') { this.phase = 'events'; return; }
    if (d.kind === 'over') { this.collect(); if (this.queue.length) { this.phase = 'events'; return; } this.finishBattle(); return; }
    if (d.kind === 'replace') { this.phase = 'replace'; this.sel = 0; return; }
    if (d.side === 1) {
      const a = aiChoose(this.b);
      if (this.o.practice) this.aiTook = describeAction(this.b, 1, a);
      act(this.b, a);
      this.collect();
      this.phase = 'events';
      return;
    }
    this.openMenu();
  }

  openMenu(): void {
    const k = (this.o.tips || []).findIndex((tip, n) => !this.tipsShown.has(n) && tip.when(this.b));
    if (k >= 0) { this.tipsShown.add(k); this.tipLines = this.o.tips![k].lines.slice(); this.phase = 'tip'; return; }
    this.phase = 'menu';
    this.buildOptions();
    if (this.sel >= this.options.length) this.sel = 0;
  }

  buildOptions(): void {
    const b = this.b;
    const f = b.s[0].f[b.s[0].out];
    const taunted = !!f.s.taunt && !f.s.unstop;
    const opts: BattleView['options'] = [];
    opts.push({ label: 'Attack', action: { k: 'attack' }, kind: 'attack', ok: true });
    f.moves.forEach((id, i) => {
      const m = MOVES[id];
      // Before tide opens, a crest is a locked slot that shows nothing of itself.
      if (m?.nerve && !b.rules.nerve) { opts.push({ label: '???', kind: 'move', i, ok: false, why: '???', hidden: true }); return; }
      const u = usable(b, f, i);
      const why = taunted ? 'Taunted.' : m?.nerve && u.why === 'Not enough tide.' ? `Not enough tide (${b.s[0].nerve} of ${m.nerve})` : u.why;
      opts.push({ label: m?.name || id, kind: 'move', i, ok: u.ok && !taunted, why });
    });
    opts.push({ label: 'Guard', action: { k: 'guard' }, kind: 'guard', ok: !taunted && canGuard(f), why: taunted ? 'Taunted.' : 'Not two turns in a row.' });
    const sw = canSwitch(b, f);
    opts.push({ label: 'Switch', kind: 'switch', ok: sw, why: reserves(b.s[0]).length ? 'It cannot switch out now.' : 'Nobody in reserve.' });
    const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
    if (n?.action) opts.push({ label: n.action.name, action: { k: 'notion' }, kind: 'notion', ok: (f.k.notionUsed || 0) < (b.s[0].charm === 'pylon' && !n.spent ? 2 : 1), why: 'Used.' });
    if (this.o.wild) {
      opts.push({ label: 'Sound', kind: 'peg', ok: true });
      if (this.o.canRun !== false) opts.push({ label: 'Run', action: { k: 'run' }, kind: 'run', ok: true });
    }
    this.options = opts;
  }

  finishBattle(): void {
    if (this.outcome) return;
    const b = this.b;
    const pegged: Mon[] = b.pegged.map(i => b.s[1].f[i].mon);
    let result: BattleOutcome['result'] = b.over === 1 ? 'lose' : b.over === 'run' ? 'run' : 'win';
    if (this.o.scripted === 'full' && b.over === 0) {
      const full = b.s[1].f[0];
      if (!pegged.includes(full.mon)) {
        pegged.push(full.mon);
        this.endLines.push(`${full.mon.name} sinks, and rises again, smaller.`);
        this.endLines.push(`${HERO} sounds ${full.mon.name}.`);
      }
    }
    if (this.o.scripted === 'full' && b.over === 1) result = 'lose';
    const kos = b.stats.kos[1];
    this.outcome = { result, pegged, kos };
    // The Register's Guide opens its fatigue chapter once a battle has run that long.
    if (b.fatigued && !this.o.practice) G.flags.fatigueMet = 1;
    // A caught whorl keeps a level raised by difficulty, down to the current level cap.
    for (const m of pegged) { owned(m.kind); if (scaleNow.strand) m.strandBorn = true; if (m.level > capHere()) { m.level = capHere(); m.xp = 0; } }
    for (const f of b.s[0].f) {
      const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
      if (n?.spent && f.k.notionUsed) { f.mon.notion = null; this.endLines.push(`${f.mon.name}'s ${n.name} is gone.`); }
    }
    if (result === 'win' && !this.o.noXp) {
      let xp = 0;
      b.s[1].f.forEach(f => { if (f.ko || f.gone) xp += this.o.wild ? 4 + 2 * f.mon.level : 6 + Math.round(2.6 * f.mon.level); });
      xp = Math.round(xp * (this.o.xpScale || 1));
      if (xp > 0) this.endLines.push(`Each whorl in your team takes ${xp} experience.`);
      const cap = capHere();
      let capped = false;
      for (const m of G.party) {
        for (const lv of giveXp(m, xp)) this.endLines.push(`${m.name} is level ${lv}.`);
        if (levelOf(m) >= cap) capped = true;
      }
      for (const m of G.rack) giveXp(m, Math.floor(xp / 2));
      if (capped) this.endLines.push(`Level ${cap} is as far as the pearls allow.`);
      const bounty = sk(b, 0).bounty || 0;
      if (bounty > 0) { G.rind += bounty; this.endLines.push(`The bounty pays ${bounty} cowries.`); }
      if (!this.o.wild) {
        const rind = b.s[1].f.reduce((n, f) => n + f.mon.level * 12, 0);
        G.rind += rind;
        this.endLines.push(`${HERO} gets ${rind} cowries.`);
      }
    }
    if (result === 'lose') this.endLines.push('Your whole team is down.');
    if (!this.endLines.length) this.endLines.push(result === 'run' ? '' : 'It is over.');
    this.endLines = this.endLines.filter(Boolean);
    this.phase = 'end';
    this.timer = 0;
    this.sub = 0;
  }

  // ------------------------------------------------------------ update

  update(): void {
    this.t++;
    if (this.t % 15 === 0) music.setIntensity(this.intensity());
    if (this.enter > 0) { this.enter -= this.speed(); return; }
    for (const side of this.disp) for (const d of side) { if (d.flash > 0) d.flash--; if (d.shake > 0) d.shake--; if (d.off > 0) d.off = Math.max(0, d.off - 2); }
    this.floats = this.floats.filter(f => (f.t -= 1) > 0);
    this.glows = this.glows.filter(g => ++g.t < g.life);
    if (this.bannerT > 0) this.bannerT--;
    this.tickSwaps();
    this.tickLanes();
    if (this.o.practice && this.phase !== 'end') {
      if (input.hit('menu') && !this.debugAsk) { this.debugAsk = true; if (this.phase === 'events') sfx('blip'); }
      if (this.debugAsk && this.phase !== 'events') { this.openDebug(); return; }
    }
    switch (this.phase) {
      case 'events': this.updateEvents(); break;
      case 'menu': this.updateMenu(); break;
      case 'target': case 'tagto': this.updateTarget(); break;
      case 'aim': this.updateAim(); break;
      case 'switch': this.updateSwitch(); break;
      case 'peg': this.updatePeg(); break;
      case 'replace': this.updateReplace(); break;
      case 'info': if (input.hit('ok') || input.hit('back')) this.phase = 'menu'; break;
      case 'tip': if (input.hit('ok') || input.hit('back')) { sfx('blip'); this.tipLines.shift(); if (!this.tipLines.length) this.openMenu(); } break;
      case 'end': this.updateEnd(); break;
    }
  }

  updateEvents(): void {
    if (this.cur) {
      this.timer -= this.speed();
      const skip = this.cur.e === 'msg' && input.hit('ok') && this.timer < 30;
      if (this.timer > 0 && !skip) return;
      this.cur = null;
    }
    const e = this.queue.shift();
    if (!e) { this.msgText = ''; this.step(); return; }
    this.cur = e;
    this.play(e);
  }

  play(e: Ev): void {
    const SPR = (side: 0 | 1) => (side === 0 ? { x: MINE_AT[0] * 2, y: MINE_AT[1] * 2 } : { x: FOE_AT[0] * 2, y: FOE_AT[1] * 2 });
    // A "sends out" message already carries the switch, which the lane plays with the switch itself.
    if (e.lane && !(e.e === 'msg' && this.queue[0]?.e === 'out')) { this.laneQ.push(e.lane); this.laneLast = e.lane; }
    switch (e.e) {
      case 'msg': {
        this.msgText = e.text; this.timer = 34 + Math.min(40, e.text.length);
        this.log.push(e.text);
        if (e.text.endsWith('won\'t curl into the horn.')) missJingle();
        if (this.log.length > 200) this.log.shift();
        const f = this.introCries.get(e);
        if (f) this.cry(f, 'out');
        // "Sends out" stays on screen through the switch that follows it, so the switch starts at once.
        if (this.queue[0]?.e === 'out') this.timer = 8;
        break;
      }
      case 'use': {
        this.banner = e.name; this.bannerT = 40; this.disp[e.side][e.idx].off = 8; this.timer = 8;
        const user = this.b.s[e.side].f[e.idx];
        if (user && MOVES[e.move] && isBig(MOVES[e.move])) this.cry(user, 'crest');
        // The user flares in its move's type color, and a light crosses to whoever the move hits.
        const tint = this.tintOf(e.side, e.idx, e.move);
        this.lastTint = tint;
        this.light(e.side, 9, 1.8, 18, tint);
        const hit = this.queue.find(q => q.e === 'dmg' || q.e === 'use');
        if (hit && hit.e === 'dmg' && hit.side !== e.side) this.light(e.side, 7, 1.6, 10, tint, hit.side);
        break;
      }
      case 'dmg': {
        const d = this.disp[e.side][e.idx];
        const toShield = Math.min(d.shield, e.shield);
        d.shield -= toShield;
        d.hp = Math.max(0, d.hp - (e.amt - e.shield));
        d.flash = 10; d.shake = 10;
        this.light(e.side, e.eff > 1.01 ? 15 : 11, 2.4, 16, e.kind === 'T' ? undefined : this.lastTint);
        const p = SPR(e.side);
        const col = e.eff > 1.01 ? WARN : e.eff < 0.99 ? DIM : PAPER;
        this.floats.push({ x: p.x + 12, y: p.y - 4, s: String(e.amt), c: col, t: 40 });
        if (e.eff > 1.01) this.floats.push({ x: p.x + 12, y: p.y - 13, s: 'strong', c: WARN, t: 40 });
        else if (e.eff < 0.99) this.floats.push({ x: p.x + 12, y: p.y - 13, s: 'weak', c: DIM, t: 40 });
        sfx(e.amt > 40 || e.eff > 1.01 ? 'hitBig' : 'hit');
        this.timer = 14;
        break;
      }
      case 'heal': {
        const d = this.disp[e.side][e.idx];
        const f = this.b.s[e.side].f[e.idx];
        d.hp = Math.min(f.maxHp, d.hp + e.amt);
        if (e.amt === 0) d.hp = f.hp;
        const p = SPR(e.side);
        if (this.outIdx[e.side] === e.idx && e.amt > 0) { this.floats.push({ x: p.x + 12, y: p.y - 4, s: '+' + e.amt, c: GOOD, t: 36 }); this.light(e.side, 10, 1.6, 26, GOOD); }
        sfx('heal');
        this.timer = 10;
        break;
      }
      case 'shield': {
        this.disp[e.side][e.idx].shield += e.amt;
        this.light(e.side, 10, 1.8, 18, TYPE_COLOR.SALT);
        sfx('shield');
        this.timer = 8;
        break;
      }
      case 'status': {
        sfx('status');
        const p = SPR(e.side);
        if (this.outIdx[e.side] === e.idx) { this.floats.push({ x: p.x + 4, y: p.y - 12, s: STATUS_NAME[e.id] || MARKS[e.id]?.name || e.id, c: SEL, t: 34 }); this.light(e.side, 8, 1.4, 16, this.lastTint); }
        this.timer = 8;
        break;
      }
      case 'out': this.startSwap(e.side, e.idx); break;
      case 'ko': { const d = this.disp[e.side][e.idx]; d.ko = true; d.hp = 0; this.light(e.side, 14, 2.4, 12); this.cry(this.b.s[e.side].f[e.idx], 'ko'); this.timer = 20; break; }
      case 'nerve': if (e.n > 0) sfx('nerve'); this.timer = 2; break;
      case 'wind': {
        sfx('wind'); this.banner = `${MOVES[e.move]?.name || ''} !`; this.bannerT = 50; this.timer = 10;
        this.lastTint = this.tintOf(e.side, e.idx, e.move);
        this.light(e.side, 11, 2, 22, this.lastTint);
        break;
      }
      case 'cut': sfx('cut'); this.disp[e.side][e.idx].shake = 14; this.light(e.side, 10, 2, 12); this.timer = 10; break;
      case 'peg': { const d = this.disp[1][e.idx]; d.gone = true; this.light(1, 16, 2.4, 34, TYPE_COLOR.STAR); catchJingle(); this.timer = 30; break; }
      case 'guard': this.light(e.side, 8, 1.4, 12, TYPE_COLOR.SALT); sfx('guard'); this.timer = 6; break;
      case 'blocked': sfx('shield'); this.disp[e.side][e.idx].flash = 8; this.light(e.side, 8, 1.6, 10, TYPE_COLOR.SALT); this.timer = 8; break;
    }
  }

  /** The type color a move casts its light in. A plain attack takes its user's first type. */
  tintOf(side: 0 | 1, idx: number, move: string): string | undefined {
    const t = (MOVES[move]?.type || (this.b.s[side].f[idx] ? kinds(this.b.s[side].f[idx])[0] : undefined)) as Type | undefined;
    return t ? TYPE_COLOR[t] : undefined;
  }

  /** Casts a short light from an effect at a side's slough, or one that travels to the other side. */
  light(side: 0 | 1, r: number, lv: number, life: number, tint?: string, to?: 0 | 1): void {
    const [x, y] = midOf(side), [tx, ty] = to === undefined ? [x, y] : midOf(to);
    this.glows.push({ x, y, tx, ty, r, lv, tint, t: 0, life, travel: to !== undefined });
  }

  /** This frame's effect lights for the backdrop, with a slow pulse at any slough winding up a move. */
  sceneLights(): SceneLight[] {
    const out: SceneLight[] = [];
    for (const g of this.glows) {
      const f = g.t / g.life;
      if (g.travel) out.push({ x: Math.round(g.x + (g.tx - g.x) * f), y: Math.round(g.y + (g.ty - g.y) * f), r: g.r, lv: g.lv, tint: g.tint, core: true });
      else out.push({ x: g.x, y: g.y, r: g.r * (0.6 + 0.4 * (1 - f)), lv: g.lv * (1 - f), tint: g.tint });
    }
    for (const p of this.b.pend) {
      if (p.kind !== 'windup' || this.outIdx[p.side] !== p.idx || this.disp[p.side][p.idx]?.ko) continue;
      const [x, y] = midOf(p.side);
      out.push({ x, y, r: 9, lv: 1.1 + 0.5 * Math.sin(this.t / 7), tint: this.tintOf(p.side, p.idx, p.move) });
    }
    return out;
  }

  me(): Fighter { return this.b.s[0].f[this.b.s[0].out]; }

  updateMenu(): void {
    const n = this.options.length;
    if (input.hit('up')) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
    if (input.hit('down')) { this.sel = (this.sel + 1) % n; sfx('move'); }
    if (input.hit('left') || input.hit('right')) { this.showInfo(); return; }
    const opt = this.options[this.sel];
    if (input.hit('ok')) {
      if (!opt.ok) { sfx('back'); this.banner = opt.why || ''; this.bannerT = 50; return; }
      sfx('ok');
      if (opt.kind === 'switch') { this.phase = 'switch'; this.sub = 0; return; }
      if (opt.kind === 'peg') { this.phase = 'peg'; this.sub = 0; return; }
      if (opt.kind === 'move') {
        const f = this.me();
        const m = moveDef(f, opt.i!)!;
        const tk = targetKind(f, m);
        if (tk !== 'none') { this.pendingMove = { i: opt.i! }; this.phase = 'target'; this.sub = 0; return; }
        if (m.tag && reserves(this.b.s[0]).length) { this.pendingMove = { i: opt.i! }; this.phase = 'tagto'; this.sub = 0; return; }
        if (m.reach === 'single' && this.aimTargets().length > 1) { this.aimBase = { k: 'move', i: opt.i! }; this.phase = 'aim'; this.sub = 0; return; }
        this.commit({ k: 'move', i: opt.i! });
        return;
      }
      if (opt.action?.k === 'attack' && this.aimTargets().length > 1) { this.aimBase = { k: 'attack' }; this.phase = 'aim'; this.sub = 0; return; }
      this.commit(opt.action!);
    }
  }

  showInfo(): void {
    const f = this.me();
    const lines: string[] = [];
    for (const p of passivesOf(f)) { const d = PASSIVES[p]; if (d) lines.push(`${d.name}: ${d.text}`); }
    if (f.mon.notion && NOTIONS[f.mon.notion]) lines.push(`${NOTIONS[f.mon.notion].name}: ${NOTIONS[f.mon.notion].text}`);
    for (const id of f.items || []) if (NOTIONS[id]) lines.push(`Item, ${NOTIONS[id].name}: ${NOTIONS[id].text}`);
    for (const u of this.b.s[0].sum) if (SUMMONS[u.def]) lines.push(`Summon, ${SUMMONS[u.def].name} (${u.hp}/${u.maxHp}): ${SUMMONS[u.def].text}`);
    for (const u of this.b.s[1].sum) if (SUMMONS[u.def]) lines.push(`Their summon, ${SUMMONS[u.def].name} (${u.hp}/${u.maxHp}): ${SUMMONS[u.def].text}`);
    const foe = this.b.s[1].f[this.b.s[1].out];
    lines.push(`${who(foe)}: ${seenPassives(foe).map(p => PASSIVES[p]?.name).join(', ')}`);
    for (const p of seenPassives(foe)) { const d = PASSIVES[p]; if (d) lines.push(`${d.name}: ${d.text}`); }
    this.infoText = lines;
    this.phase = 'info';
  }

  targets(): { label: string; idx: number; side: 0 | 1 }[] {
    const f = this.me();
    if (!this.pendingMove) return [];
    const m = moveDef(f, this.pendingMove.i)!;
    if (this.phase === 'tagto') return reserves(this.b.s[0]).map(r => ({ label: who(r), idx: r.idx, side: 0 as const }));
    const tk = targetKind(f, m);
    if (tk === 'ally') return standing(this.b.s[0]).map(r => ({ label: who(r), idx: r.idx, side: 0 as const }));
    if (tk === 'reserveAlly') return reserves(this.b.s[0]).map(r => ({ label: who(r), idx: r.idx, side: 0 as const }));
    if (tk === 'enemyReserve') return reserves(this.b.s[1]).map(r => ({ label: who(r), idx: r.idx, side: 1 as const }));
    if (tk === 'enemyAny') return standing(this.b.s[1]).map(r => ({ label: who(r), idx: r.idx, side: 1 as const }));
    return [];
  }

  /** The foe's out whorl (uid 0) and every summon of theirs a single-target hit can be aimed at. */
  aimTargets(): { label: string; uid: number }[] {
    const foe = this.b.s[1].f[this.b.s[1].out];
    return [{ label: who(foe), uid: 0 }, ...this.b.s[1].sum.filter(aimable).map(u => ({ label: `${SUMMONS[u.def]?.name || 'Summon'} ${u.hp}/${u.maxHp}`, uid: u.uid }))];
  }

  updateAim(): void {
    const ts = this.aimTargets();
    if (!this.aimBase || ts.length < 2) { this.phase = 'menu'; return; }
    if (input.hit('up')) { this.sub = (this.sub + ts.length - 1) % ts.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % ts.length; sfx('move'); }
    if (this.sub >= ts.length) this.sub = 0;
    const uid = ts[this.sub].uid;
    const action = { ...this.aimBase, aim: uid || undefined } as Action;
    if (input.hit('back')) { sfx('back'); this.phase = 'menu'; this.aimBase = null; return; }
    if (input.hit('ok')) { sfx('ok'); this.aimBase = null; this.commit(action); }
  }

  updateTarget(): void {
    const ts = this.targets();
    if (!ts.length) { this.phase = 'menu'; return; }
    if (input.hit('up')) { this.sub = (this.sub + ts.length - 1) % ts.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % ts.length; sfx('move'); }
    if (this.sub >= ts.length) this.sub = 0;
    const pick = ts[this.sub];
    const mv = this.pendingMove!;
    const action: Action = this.phase === 'tagto' ? { k: 'move', i: mv.i, tagTo: pick.idx } : { k: 'move', i: mv.i, target: pick.idx };
    if (input.hit('back')) { sfx('back'); this.phase = 'menu'; this.pendingMove = null; return; }
    if (input.hit('ok')) {
      sfx('ok');
      const m = moveDef(this.me(), mv.i)!;
      if (this.phase === 'target' && m.tag && m.reach !== 'reserveAlly' && reserves(this.b.s[0]).length) {
        this.pendingMove = { i: mv.i, target: pick.idx };
        this.phase = 'tagto';
        this.sub = 0;
        return;
      }
      if (this.phase === 'tagto' && mv.target !== undefined) this.commit({ k: 'move', i: mv.i, target: mv.target, tagTo: pick.idx });
      else this.commit(action);
    }
  }

  updateSwitch(): void {
    const rs = reserves(this.b.s[0]);
    if (!rs.length) { this.phase = 'menu'; return; }
    if (input.hit('up')) { this.sub = (this.sub + rs.length - 1) % rs.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % rs.length; sfx('move'); }
    if (this.sub >= rs.length) this.sub = 0;
    if (input.hit('back')) { sfx('back'); this.phase = 'menu'; return; }
    if (input.hit('ok')) { sfx('ok'); this.commit({ k: 'switch', to: rs[this.sub].idx }); }
  }

  pegList(): { kind: PegKind; n: number; line: number }[] {
    const foe = this.b.s[1].f[this.b.s[1].out];
    return PEG_ORDER.filter(k => (G.pegs[k] || 0) > 0).map(k => ({ kind: k, n: G.pegs[k], line: pegLine(this.b, this.me(), foe, k) }));
  }

  updatePeg(): void {
    const ps = this.pegList();
    if (input.hit('back') || !ps.length) {
      if (!ps.length) { this.banner = 'No horns.'; this.bannerT = 50; }
      sfx('back'); this.phase = 'menu'; return;
    }
    if (input.hit('up')) { this.sub = (this.sub + ps.length - 1) % ps.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % ps.length; sfx('move'); }
    if (this.sub >= ps.length) this.sub = 0;
    if (input.hit('ok')) {
      const p = ps[this.sub];
      G.pegs[p.kind]--;
      this.commit({ k: 'peg', peg: p.kind });
    }
  }

  updateReplace(): void {
    const rs = standing(this.b.s[0]);
    if (input.hit('up')) { this.sub = (this.sub + rs.length - 1) % rs.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % rs.length; sfx('move'); }
    if (this.sub >= rs.length) this.sub = 0;
    if (input.hit('ok') && rs.length) {
      sfx('ok');
      replace(this.b, 0, rs[this.sub].idx);
      this.collect();
      this.phase = 'events';
    }
  }

  updateEnd(): void {
    this.timer++;
    if (input.hit('ok') || (input.held('fast') && this.timer % 6 === 0)) {
      this.sub++;
      if (this.sub >= this.endLines.length) close(this, this.outcome!);
      else { const lv = / is level (\d+)\.$/.exec(this.endLines[this.sub]); if (lv) levelJingle(Number(lv[1])); }
    }
  }

  /** Music intensity: rises as either side nears its last HP, and is full once fatigue sets in. */
  intensity(): number {
    const b = this.b;
    if (b.fatigued) return 1;
    const low = Math.min(hpShare(b, 0), hpShare(b, 1));
    return Math.max(0, Math.min(1, (1 - low) * 1.2));
  }

  commit(a: Action): void {
    this.pendingMove = null;
    act(this.b, a);
    this.collect();
    this.phase = 'events';
  }

  // ------------------------------------------------------------ draw

  draw(): void {
    clear(INK);
    const slide = Math.max(0, this.enter) * 2;
    // The scene is drawn at half resolution and shown at double size, so backdrop and sloughs share one grid.
    layer('battle', SCENE_W, SCENE_H, 0, 0, 2, () => {
      paintBackdrop(this.o.scene || sceneNow.key, { t: this.t, loose: loosened(), dusk: sceneNow.dusk, map: G.map, heat: this.intensity(), lights: this.sceneLights(), figures: this.sceneFigures(slide) });
      this.drawSide(1, FOE_AT[0] + slide, FOE_AT[1]);
      this.drawSide(0, MINE_AT[0] - slide, MINE_AT[1]);
    });
    this.drawSideHud(1, (FOE_AT[0] + slide) * 2, FOE_AT[1] * 2);
    this.drawSideHud(0, (MINE_AT[0] - slide) * 2, MINE_AT[1] * 2);
    this.drawTempo();
    this.drawLanes();
    this.drawPanel(1, 2, 14);
    this.drawPanel(0, 86, 72);
    // Floating numbers and words stack upward rather than overlap, each a clear pixel from the next, shadows included.
    const placed: { x: number; y: number; w: number }[] = [];
    for (const f of this.floats) {
      const w = textWidth(f.s) + 1, x = Math.round(f.x - w / 2);
      let y = Math.round(f.y - (40 - f.t) / 3);
      for (let moved = true, n = 0; moved && n < 8; n++) {
        moved = false;
        for (const p of placed) if (x < p.x + p.w + 1 && p.x < x + w + 1 && y < p.y + 10 && p.y < y + 10) { y = p.y - 10; moved = true; }
      }
      placed.push({ x, y, w });
      text(f.s, x, y, f.c, INK);
    }
    if (this.bannerT > 0 && this.banner) {
      const w = textWidth(this.banner) + 10;
      box(96 - w / 2, 106, w, 12, SEL);
      textCenter(this.banner, 96, 108, SEL);
    }
    this.drawBottom();
  }

  /** Where summon i of a side stands in scene pixels: the first two between its slough and the middle of the scene, the next two on its outer side, all clear of both panels. */
  summonAt(side: 0 | 1, i: number, x: number, y: number): [number, number] {
    const k = i % 2, inner = i < 2;
    const sx = side === 0 ? (inner ? x + 12 + k * 7 : x - 8 - k * 7) : (inner ? x - 7 - k * 7 : x + 11 + k * 7);
    return [sx, y + 3];
  }

  /** A summon as a scene figure: its own sprite, or a small box in its owner's colors. */
  summonFigure(side: 0 | 1, u: Summon, sx: number, sy: number): SceneFigure {
    const own = SUMMONS[u.def]?.sprite;
    const c = this.b.s[side].f[u.by].mon.sprite.c;
    const s: SpriteData = own || { px: ['........', '........', '........', '.11111..', '.12221..', '.12321..', '.12221..', '.11111..'], c: [c[0], c[1]] };
    return { s, x: sx - 1, y: sy - 3, flip: side === 0 && !!own, ground: sy + 5 };
  }

  /** A side's out slough as a scene figure, or null when it is gone or knocked out. */
  outFigure(side: 0 | 1, x: number, y: number): SceneFigure | null {
    if (this.swaps[side]) return null;
    const idx = this.outIdx[side];
    const d = this.disp[side][idx];
    if (d.gone || d.ko) return null;
    let dx = 0;
    if (d.shake > 0) dx = (d.shake % 4 < 2 ? -1 : 1);
    if (d.off > 0) dx += Math.round((side === 0 ? d.off : -d.off) / 2);
    return { s: look(this.b.s[side].f[idx]), x: x + dx, y: y + (Math.floor(this.t / 30) % 2), flip: side === 0, ground: y + 8 };
  }

  /** Every slough and summon on screen this frame, for the scene's shadows. */
  sceneFigures(slide: number): SceneFigure[] {
    const out: SceneFigure[] = [];
    for (const side of [1, 0] as const) {
      const x = side === 1 ? FOE_AT[0] + slide : MINE_AT[0] - slide, y = side === 1 ? FOE_AT[1] : MINE_AT[1];
      this.shownSums(side).forEach((u, i) => { const [sx, sy] = this.summonAt(side, i, x, y); out.push(this.summonFigure(side, u, sx, sy)); });
      const o = this.outFigure(side, x, y);
      if (o) out.push(o);
    }
    return out;
  }

  /** A side's summons on screen: during a switch, the incoming whorl's summons wait until it pops out. */
  shownSums(side: 0 | 1): Summon[] {
    const sw = this.swaps[side];
    return sw && !sw.popped ? this.b.s[side].sum.filter(u => u.by !== sw.to) : this.b.s[side].sum;
  }

  /** Summons stand beside their side's out whorl, each with a one-pixel HP bar. */
  drawSummons(side: 0 | 1, x: number, y: number): void {
    this.shownSums(side).forEach((u, i) => {
      const [sx, sy] = this.summonAt(side, i, x, y);
      const fg = this.summonFigure(side, u, sx, sy);
      drawFighter(fg.s, fg.x, fg.y, fg.flip);
      rect(sx, sy + 6, 5, 1, INK);
      rect(sx, sy + 6, Math.max(1, Math.round(5 * u.hp / u.maxHp)), 1, '#7ad87a');
    });
  }

  /** Starts the switch on screen. The panel, the lane, and the sounds follow its beats, and the queue waits for it. */
  startSwap(side: 0 | 1, to: number): void {
    const old = this.swaps[side];
    if (old) this.outIdx[side] = old.to;
    // A forced switch's message comes after its event: show it now so the words and the motion line up.
    const k = this.queue.findIndex(q => q.e === 'use' || q.e === 'out' || (q.e === 'msg' && / is (forced|dragged) out\./.test(q.text)));
    const said = k >= 0 ? this.queue[k] : null;
    const forced = !!said && said.e === 'msg';
    if (said && said.e === 'msg') {
      this.queue.splice(k, 1);
      this.msgText = said.text;
      this.log.push(said.text);
    }
    this.disp[side][to].off = 0;
    this.swaps[side] = { from: this.outIdx[side], to, t: 0, forced, popped: false };
    switchOutJingle();
    // The lanes catch up at once, so the lane's dim and feed land on the same beats as the whorls.
    for (const L of this.lanes) L.glide = 0;
    this.laneBusy = 0;
    while (this.laneQ.length) this.laneBusy = this.applyLane(this.laneQ.shift()!);
    if (forced && said?.lane) this.laneQ.push(said.lane);
    this.timer = SW_LEAVE + SW_PAUSE + SW_ENTER;
  }

  /** Moves each switch one frame. The new whorl pops out after the pause, and its panel and cry come with it. */
  tickSwaps(): void {
    for (const side of [0, 1] as const) {
      const sw = this.swaps[side];
      if (!sw) continue;
      sw.t += this.speed();
      if (!sw.popped && sw.t >= SW_LEAVE + SW_PAUSE) {
        sw.popped = true;
        this.outIdx[side] = sw.to;
        this.light(side, 10, 1.6, 16);
        switchInJingle();
        this.swapCries.push({ f: this.b.s[side].f[sw.to], at: this.t + 15 });
      }
      if (sw.t >= SW_LEAVE + SW_PAUSE + SW_ENTER) this.swaps[side] = null;
    }
    for (const c of this.swapCries.filter(c => c.at <= this.t)) this.cry(c.f, 'out');
    this.swapCries = this.swapCries.filter(c => c.at > this.t);
  }

  /** A switch in the scene: the old whorl curls into its horn (or is shoved off with a trail), then the new one pops out and settles. */
  drawSwap(side: 0 | 1, sw: Swap, x: number, y: number): void {
    const back = side === 0 ? -1 : 1, flip = side === 0;
    if (sw.t < SW_LEAVE) {
      const d = this.disp[side][sw.from], u = smooth(sw.t / SW_LEAVE);
      if (d.gone) return;
      if (d.ko) { dither(x, y, 8, 8, INK, 0.4 * (1 - u)); return; }
      const dx = Math.round(back * (sw.forced ? 12 : 3) * u);
      if (sw.forced) for (let j = 0; j < 3; j++) {
        const len = Math.max(1, Math.round((4 - j) * (1 - u) * 1.5));
        rect(back < 0 ? x + dx + 9 : x + dx - 1 - len, y + 2 + j * 2, len, 1, mix(PAPER, INK, 0.55));
      }
      drawFighter(look(this.b.s[side].f[sw.from]), x + dx, y, flip, sw.forced ? 1 - 0.5 * u : 1 - u);
      return;
    }
    if (sw.t < SW_LEAVE + SW_PAUSE) return;
    const u = Math.min(1, (sw.t - SW_LEAVE - SW_PAUSE) / SW_ENTER);
    const k = u < 0.55 ? 1.25 * smooth(u / 0.55) : 1.25 - 0.25 * smooth((u - 0.55) / 0.45);
    drawFighter(look(this.b.s[side].f[sw.to]), x, y, flip, k);
  }

  drawSide(side: 0 | 1, x: number, y: number): void {
    const d = this.disp[side][this.outIdx[side]];
    this.drawSummons(side, x, y);
    const sw = this.swaps[side];
    if (sw) { this.drawSwap(side, sw, x, y); return; }
    if (d.gone) return;
    if (d.ko) {
      dither(x, y, 8, 8, INK, 0.4);
      return;
    }
    const fg = this.outFigure(side, x, y)!;
    const f = this.b.s[side].f[this.outIdx[side]], flash = d.flash > 0 && d.flash % 4 < 2, star = !!f.mon.starborn && !flash;
    if (star) drawAura(ctx, fg.s, fg.x, fg.y, this.t, f.mon.uid % 97, true, fg.flip);
    if (flash) drawSprite(fg.s, fg.x, fg.y, 1, fg.flip, '#f8f4e8');
    else drawFighter(fg.s, fg.x, fg.y, fg.flip);
    if (star) drawAura(ctx, fg.s, fg.x, fg.y, this.t, f.mon.uid % 97, false, fg.flip);
  }

  /** Guard and wind-up markers beside an out slough, in screen pixels. */
  drawSideHud(side: 0 | 1, x: number, y: number): void {
    const idx = this.outIdx[side];
    const f = this.b.s[side].f[idx];
    const d = this.disp[side][idx];
    if (d.gone || d.ko) return;
    if (f.s.guard) statusIcon('guard', x + 18, y);
    const pend = this.b.pend.find(p => p.kind === 'windup' && p.side === side && p.idx === idx);
    if (pend && this.t % 20 < 14) text('!', x + 6, y - 10, SEL, INK);
  }

  /** How many turns `side` takes before time `at`, counting a turn it is taking now. */
  turnsBefore(side: 0 | 1, at: number): number {
    const f = this.b.s[side].f[this.b.s[side].out];
    let nx = this.b.s[side].next, n = 0;
    while (nx < at && n < 9) { n++; nx += ticks(this.b, f, 100); }
    return n;
  }

  /** Tempo line: wind-ups in flight and double turns. Only shown when it says something. */
  drawTempo(): void {
    rect(0, 0, 192, 11, INK);
    const b = this.b;
    let note = '';
    let col = DIM;
    const wind = b.pend.find(p => p.kind === 'windup');
    if (wind) {
      const name = MOVES[wind.move]?.name || 'It';
      const other = (1 - wind.side) as 0 | 1;
      const n = this.turnsBefore(other, wind.at);
      if (wind.side === 1) note = n === 0 ? `! ${name} lands before you move` : `! ${name}: you get ${n} move${n > 1 ? 's' : ''} first`;
      else note = n === 0 ? `${name} lands before they move` : `${name}: they get ${n} move${n > 1 ? 's' : ''} first`;
      col = wind.side === 1 ? SEL : MINE;
    } else {
      // Only while you choose: the check compares turns from the move you are about to make.
      const twice = this.choosing() ? this.actsTwice() : null;
      const foe = who(this.b.s[1].f[this.b.s[1].out]), me = who(this.b.s[0].f[this.b.s[0].out]);
      if (twice === 1) { note = `${foe} moves twice this turn`; col = THEIRS; }
      else if (twice === 0) { note = `${me} moves twice this turn`; col = MINE; }
    }
    text(note || this.o.name, 3, 2, note ? col : DIM);
    if (this.o.practice && textWidth(note || this.o.name) < 140) textRight('V debug', 189, 2, this.debugAsk ? SEL : '#4a4660');
  }

  /** Moves the speed lanes one frame: queued clock changes play one at a time, and the drawn clock follows at a steady pace. */
  tickLanes(): void {
    const b = this.b, sp = this.speed();
    if (this.laneT < 0) {
      b.lanes = true;
      const s = laneSnap(b);
      this.laneT = this.laneGoal = s.t;
      this.laneLast = s;
      this.lanes = ([0, 1] as const).map(sd => ({ out: s.out[sd], next: s.next[sd], step: s.step[sd], fromNext: s.next[sd], fromStep: s.step[sd], glide: 0, past: [], oldNext: 0, oldStep: 0, fade: 0, feed: 0 }));
      this.laneSpan = Math.max(200, Math.min(700, 3.5 * Math.max(s.step[0], s.step[1], 100)));
      return;
    }
    // Once every event has played, the battle's own clock is the last change to show.
    if (!this.queue.length && !this.cur) {
      const s = laneSnap(b);
      if (!sameLane(s, this.laneLast)) { this.laneQ.push(s); this.laneLast = s; }
    }
    for (const L of this.lanes) {
      L.glide = Math.max(0, L.glide - sp);
      if (L.fade > 0) L.fade = Math.max(0, L.fade - sp); else L.feed = Math.max(0, L.feed - sp);
    }
    this.laneBusy -= sp;
    while (this.laneBusy <= 0 && this.laneQ.length) this.laneBusy = this.applyLane(this.laneQ.shift()!);
    const lag = this.laneGoal - this.laneT;
    if (lag > 0) this.laneT += Math.min(lag, Math.max(3, lag / 40) * sp);
    for (const L of this.lanes) L.past = L.past.filter(t => t >= this.laneT);
  }

  /** Starts one queued clock change and returns how many frames it takes. */
  applyLane(s: LaneSnap): number {
    this.laneGoal = Math.max(this.laneGoal, s.t);
    let busy = 0;
    for (const sd of [0, 1] as const) {
      const L = this.lanes[sd];
      if (s.out[sd] !== L.out) {
        // A switch: the old whorl's marks dim where they stand, then the new whorl's marks feed in from the right.
        Object.assign(L, { out: s.out[sd], oldNext: L.next, oldStep: L.step, fade: LANE_FADE, feed: LANE_FEED, glide: 0, past: [], next: s.next[sd], step: s.step[sd], fromNext: s.next[sd], fromStep: s.step[sd] });
        busy = Math.max(busy, LANE_FADE + LANE_FEED);
        continue;
      }
      // Turns taken since the last change stay on the tape until the clock passes them.
      let n = L.next;
      for (let k = 0; k < 12 && L.step > 0 && n < s.t - 0.5; k++) { L.past.push(n); n += L.step; }
      if (Math.abs(s.next[sd] - n) > 0.5 || Math.abs(s.step[sd] - L.step) > 0.5) {
        Object.assign(L, { fromNext: n, fromStep: L.step, glide: LANE_GLIDE });
        busy = Math.max(busy, LANE_GLIDE);
      } else Object.assign(L, { fromNext: s.next[sd], fromStep: s.step[sd] });
      L.next = s.next[sd];
      L.step = s.step[sd];
    }
    return busy;
  }

  /** Speed lanes: each out whorl's coming turns as marks on the battle clock, the foe above and yours below. */
  drawLanes(): void {
    const b = this.b;
    const down = (sd: 0 | 1) => { const f = b.s[sd].f[b.s[sd].out], d = this.disp[sd][this.outIdx[sd]]; return !f || f.ko || f.gone || !d || d.ko || d.gone; };
    if (this.laneT < 0 || this.phase === 'end' || down(0) || down(1)) return;
    rect(LANE_X - 4, LANE_Y, LANE_W + 7, 13, INK);
    rect(LANE_X - 2, LANE_Y + 2, 1, 9, mix(DIM, INK, 0.4));
    for (const sd of [1, 0] as const) {
      const L = this.lanes[sd], ly = LANE_Y + (sd === 1 ? 2 : 7), c = sd === 0 ? MINE : THEIRS;
      // A lane that is changing lights up for the length of the change.
      const lit = Math.max(L.glide / LANE_GLIDE, L.fade > 0 ? 1 : L.feed / LANE_FEED);
      rect(LANE_X, ly + 3, LANE_W, 1, mix(c, INK, 0.75 - 0.35 * lit));
      for (const t of L.past) this.laneMark(t, 0, ly, false, mix(c, INK, 0.4));
      if (L.fade > 0) {
        const k = 1 - L.fade / LANE_FADE;
        this.laneRow(L.oldNext, L.oldStep, 0, ly, mix(c, INK, 0.5 * k), mix(c, INK, 0.4 + 0.5 * k));
        continue;
      }
      const u = L.glide > 0 ? smooth(1 - L.glide / LANE_GLIDE) : 1;
      const dx = L.feed > 0 ? Math.round(smooth(L.feed / LANE_FEED) * LANE_W) : 0;
      const glow = L.glide > 0 ? mix(c, PAPER, 0.4 * L.glide / LANE_GLIDE) : c;
      this.laneRow(L.fromNext + (L.next - L.fromNext) * u, L.fromStep + (L.step - L.fromStep) * u, dx, ly, glow, mix(glow, INK, 0.4));
    }
  }

  /** One lane's coming turns from `next` and every `step` after it, shifted right by dx and cut at the lane's right end. */
  laneRow(next: number, step: number, dx: number, ly: number, first: string, rest: string): void {
    for (let k = 0, t = next; k < 12; k++, t += step) {
      if (!this.laneMark(t, dx, ly, k === 0, k === 0 ? first : rest) || step <= 0) break;
    }
  }

  /** Draws one mark at clock time t, or returns false once that time is past the lane's right end. */
  laneMark(t: number, dx: number, ly: number, tall: boolean, c: string): boolean {
    const p = (t - this.laneT) / this.laneSpan;
    if (p > 1) return false;
    const x = LANE_X + Math.round(p * (LANE_W - 1)) + dx;
    if (x > LANE_X + LANE_W - 1) return false;
    if (p >= 0) rect(x, tall ? ly : ly + 1, 1, tall ? 4 : 3, c);
    return true;
  }

  /** Whether the player is picking an action right now. */
  choosing(): boolean {
    return ['menu', 'target', 'tagto', 'aim', 'switch', 'peg', 'info', 'tip'].includes(this.phase);
  }

  /** The side whose out whorl gets two actions before the other side's next, if either does. */
  actsTwice(): 0 | 1 | null {
    const b = this.b;
    const f0 = b.s[0].f[b.s[0].out], f1 = b.s[1].f[b.s[1].out];
    if (!f0 || !f1 || f0.ko || f1.ko) return null;
    const after0 = b.s[0].next + ticks(b, f0, 100);
    const after1 = b.s[1].next + ticks(b, f1, 100);
    if (b.s[1].next + ticks(b, f1, 100) < after0 && b.s[1].next > b.s[0].next) return 1;
    if (b.s[0].next + ticks(b, f0, 100) < after1 && b.s[0].next > b.s[1].next) return 0;
    return null;
  }

  drawPanel(side: 0 | 1, x: number, y: number): void {
    const s = this.b.s[side];
    const idx = this.outIdx[side];
    const f = s.f[idx];
    const d = this.disp[side][idx];
    box(x, y, 104, 35, side === 0 ? MINE : THEIRS);
    const lv = this.b.rules.sync ? 25 : f.mon.level;
    const nameEnd = text(who(f), x + 3, y + 2, PAPER);
    textRight(`L${lv}`, x + 101, y + 2, DIM);
    // The type sigils follow the name on its row, clear of a descender.
    let tx = nameEnd + 3;
    for (const t of kinds(f)) { miniSigil(t as Type, tx, y + 3); tx += 7; }
    // Two actions this turn: an "x2" beside the level that brightens and dims slowly, left out when a long name reaches it.
    const x2 = x + 101 - textWidth(`L${lv}`) - 4;
    if (this.choosing() && !this.b.pend.some(p => p.kind === 'windup') && this.actsTwice() === side && tx + 1 < x2 - textWidth('x2')) {
      const lit = (Math.sin(this.t / 14) + 1) / 2 > 0.35;
      textRight('x2', x2, y + 2, lit ? (side === 0 ? MINE : THEIRS) : DIM);
    }
    let line: number | null = null;
    if (this.o.wild && side === 1 && G.pegs) {
      const best = this.pegList().reduce((m, p) => Math.max(m, p.line), 0);
      if (best > 0 && best < 1) line = best;
    }
    // A hidden foe shows no HP, statuses, or marks.
    const veiled = side === 1 && !!f.s.hidden;
    let hpEnd: number;
    if (veiled) { rect(x + 3, y + 15, 98, 5, INK); hpEnd = text('hidden', x + 3, y + 21, DIM); statusIcon('hidden', hpEnd + 4, y + 22); }
    else {
      hpBar(x + 3, y + 15, 98, d.hp, f.maxHp, d.shield, null, line);
      hpEnd = text(`${Math.max(0, Math.ceil(d.hp))}/${f.maxHp}`, x + 3, y + 21, DIM);
      // Statuses and marks sit at the right end of the HP numbers row, clear of the bar and the name, newest leftmost.
      const icons: [number, (ix: number) => void][] = [];
      for (const k of Object.keys(f.s)) if (k !== 'guard') icons.push([6, ix => { statusIcon(k, ix, y + 22); }]);
      for (const k of Object.keys(f.m)) {
        const md = MARKS[k];
        if (!md?.name) continue;
        const n = f.m[k].n;
        icons.push([n > 1 ? 7 + textWidth(String(Math.min(9, n))) : 6, ix => markIcon(ix, y + 22, md.color || (md.negative ? BADC : SEL), n)]);
      }
      let ix = x + 102;
      for (const [w, draw] of icons) { if (ix - w < hpEnd + 4) break; ix -= w; draw(ix); }
    }
    // The team as small shells, then any caps laid under this side, then the tide gauge on the right.
    let rx = x + 3;
    const ry = y + 29;
    s.f.forEach((g, i) => {
      const dd = this.disp[side][i];
      teamShell(rx, ry, dd.gone ? DIM : dd.ko ? '#4a4450' : i === idx ? PAPER : (side === 0 ? MINE : THEIRS));
      rx += 5;
    });
    for (let k = 0; k < Math.min(4, s.caps); k++) capIcon(rx + 2 + k * 4, ry + 2);
    if (this.b.rules.nerve) tideGauge(x + 101 - 57, ry - 1, s.nerve, 10);
  }

  drawBottom(): void {
    box(0, 120, 192, 72);
    if (this.phase === 'end') {
      const ln = this.endLines[Math.min(this.sub, this.endLines.length - 1)] || '';
      wrap(ln, 174).forEach((l, i) => text(l, 6, 126 + i * 9, PAPER));
      if (this.t % 40 < 26) text('\u0002', 182, 182, DIM);
      return;
    }
    if (this.phase === 'events' || this.enter > 0) {
      wrap(this.msgText, 180).forEach((l, i) => text(l, 6, 126 + i * 9, PAPER));
      return;
    }
    if (this.phase === 'tip') {
      wrap(this.tipLines[0] || '', 174).forEach((l, i) => text(l, 6, 126 + i * 9, PAPER));
      if (this.t % 40 < 26) text('\u0002', 182, 182, DIM);
      return;
    }
    if (this.phase === 'info') {
      let y = 124;
      for (const l of this.infoText) for (const w of wrap(l, 182)) { if (y < 186) text(w, 5, y, PAPER); y += 9; }
      return;
    }
    if (this.phase === 'replace') {
      text('Send out who?', 6, 124, SEL);
      standing(this.b.s[0]).forEach((f, i) => this.drawMonRow(f, 6, 134 + i * 10, i === this.sub));
      return;
    }
    if (this.phase === 'switch') {
      text('Switch to?', 6, 124, SEL);
      reserves(this.b.s[0]).forEach((f, i) => this.drawMonRow(f, 6, 134 + i * 10, i === this.sub));
      const pick = reserves(this.b.s[0])[this.sub];
      if (pick) this.drawMovesSmall(pick, 112, 134);
      return;
    }
    if (this.phase === 'aim') {
      text('Aim at?', 6, 124, SEL);
      this.aimTargets().forEach((t, i) => {
        if (i === this.sub) cursor(6, 134 + i * 10);
        text(t.label, 14, 134 + i * 10, i === this.sub ? SEL : THEIRS);
      });
      return;
    }
    if (this.phase === 'target' || this.phase === 'tagto') {
      text(this.phase === 'tagto' ? 'Switch in who after?' : 'On who?', 6, 124, SEL);
      this.targets().forEach((t, i) => {
        const f = this.b.s[t.side].f[t.idx];
        this.drawMonRow(f, 6, 134 + i * 10, i === this.sub, t.side === 1);
      });
      return;
    }
    if (this.phase === 'peg') {
      text('Which horn?', 6, 124, SEL);
      const foe = this.b.s[1].f[this.b.s[1].out];
      this.pegList().forEach((p, i) => {
        const y = 134 + i * 10;
        if (i === this.sub) cursor(6, y);
        const chance = pegChance(this.b, this.me(), foe, p.kind);
        text(`${PEG_NAME[p.kind]} x${p.n}`, 14, y, i === this.sub ? SEL : PAPER);
        textRight(chance >= 1 ? 'sure' : `${Math.max(5, Math.round(chance * 20) * 5)}%`, 150, y, chance >= 1 ? GOOD : chance >= 0.5 ? PAPER : DIM);
      });
      text(`now ${Math.round(foe.hp / foe.maxHp * 100)}%`, 6, 182, DIM);
      return;
    }
    // menu: the actions down the left, one per 9-pixel row, and the picked one's detail on the right of a divider.
    const f = this.me();
    const top = Math.max(0, Math.min(this.sel - MENU_ROWS + 2, this.options.length - MENU_ROWS));
    this.options.forEach((o, i) => {
      if (i < top || i >= top + MENU_ROWS) return;
      const y = MENU_Y + (i - top) * 9, on = i === this.sel;
      if (on) cursor(3, y);
      const c = o.ok ? (on ? SEL : PAPER) : (on ? '#8a7a50' : DIM);
      const end = text(o.label, 17, y, c);
      if (o.kind !== 'move' || o.hidden) return;
      // A move's slot: its type sigil before the name, and at the right end its turns left, or the tide mark of a crest.
      // A name too long to leave room for the mark goes without it, since the detail shows both.
      const m = moveDef(f, o.i!)!;
      miniSigil(this.typeOfMove(f, m), 10, y + 1);
      const cd = f.cd[o.i!] > 0 ? String(f.cd[o.i!]) : '';
      const markX = cd ? DIVIDER - 3 - textWidth(cd) : DIVIDER - 8;
      if (end + 2 > markX) return;
      if (cd) textRight(cd, DIVIDER - 3, y, DIM);
      else if (isBig(m)) tideIcon(markX, y + 1, this.b.rules.nerve && this.b.s[0].nerve >= (m.nerve || 0) ? NERVE : DIM);
    });
    rect(DIVIDER, 123, 1, 66, '#3a3442');
    // Scroll marks: small notches on the divider at whichever end has more.
    if (top > 0) for (let k = 0; k < 3; k++) rect(DIVIDER - k, 125 - k, 1 + k * 2, 1, DIM);
    if (top + MENU_ROWS < this.options.length) for (let k = 0; k < 3; k++) rect(DIVIDER - k, 184 + k, 1 + k * 2, 1, DIM);
    this.drawDetail(this.options[this.sel]);
  }

  typeOfMove(f: Fighter, m: MoveDef): Type {
    return (f.mon.retune?.move === m.id ? f.mon.retune.type : m.type) as Type;
  }

  /**
   * The picked action, in three parts on a 9-pixel grid: a header with the type and the move's cooldown and tide cost as
   * icons, the rules text, and a footer that says why it cannot be used or what bonus it gets against the foe.
   */
  drawDetail(o: BattleView['options'][number] | undefined): void {
    if (!o) return;
    const f = this.me();
    const x = DIVIDER + 4, w = 188 - x;
    if (o.hidden) { text('???', x, MENU_Y, DIM); return; }
    // Footers are short and plain, with no closing stop. A count in brackets drops out when the line would not fit.
    const plain = (s: string) => { const t = s.replace(/\.$/, ''); return textWidth(t) > w ? t.replace(/\s*\(.*\)$/, '') : t; };
    let row = 0;
    const body: [string, string][] = [], foot: [string, string][] = [];
    if (o.kind === 'move') {
      const m = moveDef(f, o.i!)!;
      const ty = this.typeOfMove(f, m);
      typeBadge(ty, x, MENU_Y - 1);
      let rx = 188;
      if (m.nerve) {
        const c = this.b.rules.nerve ? NERVE : DIM;
        textRight(String(m.nerve), rx, MENU_Y, c);
        rx -= textWidth(String(m.nerve)) + 7;
        tideIcon(rx, MENU_Y + 1, c);
        rx -= 5;
      }
      textRight(String(m.cd), rx, MENU_Y, DIM);
      cdIcon(rx - textWidth(String(m.cd)) - 7, MENU_Y, DIM);
      row = 1;
      body.push([moveText(m, passivesOf(f)), PAPER]);
      if (!o.ok && o.why) foot.push([plain(o.why), BADC]);
      else {
        // Whether the matchup or a same-type move adds damage, without saying how much the move deals.
        const foe = this.b.s[1].f[this.b.s[1].out];
        if (foe && !foe.ko && (m.reach === 'single' || m.reach === 'spread' || m.reach === 'dragin')) {
          const eff = typeMult(ty, seenTypes(foe));
          if (eff > 1.01) foot.push([`Strong: ${+eff.toFixed(2)}x`, WARN]);
          else if (eff < 0.99) foot.push([`Weak: ${+eff.toFixed(2)}x`, DIM]);
          if (typesOf(f).includes(ty)) foot.push(['Same type: 1.2x', MINE]);
        }
      }
    } else {
      const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
      const say: Record<string, string> = {
        attack: `${basicOf(f) === 'P' ? 'A physical hit' : 'A magic hit'} with no type.${this.b.rules.nerve ? ' If it lands: +1 tide.' : ''}`,
        guard: 'Takes half damage until your next turn. It can\'t be forced out.',
        switch: 'Send out a whorl from reserve.',
        peg: 'Sound it with a horn. The weaker the foe, the more likely it curls in.',
        run: 'Leave. It always works.',
        notion: n?.text || '',
      };
      body.push([say[o.kind] || '', PAPER]);
      if (!o.ok && o.why) foot.push([plain(o.why), BADC]);
    }
    const lines: [string, string][] = [];
    for (const [s, c] of body) for (const l of wrap(s, w)) lines.push([l, c]);
    const free = MENU_ROWS - row - foot.length;
    if (lines.length <= free) lines.forEach(([l, c], k) => text(l, x, MENU_Y + (row + k) * 9, c));
    else {
      // A text too long for the panel shows what fits and a hint. Holding Shift shows it whole in a wide box above the menu,
      // which covers the scene only while it is held.
      lines.slice(0, free - 1).forEach(([l, c], k) => text(l, x, MENU_Y + (row + k) * 9, c));
      text('Shift: more', x, MENU_Y + (row + free - 1) * 9, SEL);
      if (input.held('fast')) {
        const wide: [string, string][] = [];
        for (const [s, c] of body) for (const l of wrap(s, 176)) wide.push([l, c]);
        const h = wide.length * 9 + 7, y0 = 121 - h;
        box(4, y0, 184, h);
        wide.forEach(([l, c], k) => text(l, 10, y0 + 4 + k * 9, c));
      }
    }
    // The footer sits on the last rows. The habits hint takes the last row when nothing else needs it.
    foot.forEach(([l, c], k) => text(l, x, MENU_Y + (MENU_ROWS - foot.length + k) * 9, c));
    if (!foot.length && row + lines.length < MENU_ROWS) text('L/R habits', x, MENU_Y + (MENU_ROWS - 1) * 9, '#5a5466');
  }

  drawMonRow(f: Fighter, x: number, y: number, on: boolean, enemy = false): void {
    if (on) cursor(x, y);
    text(who(f), x + 8, y, on ? SEL : enemy ? THEIRS : PAPER);
    hpBar(x + 60, y + 2, 40, f.hp, f.maxHp, f.shield);
    let tx = x + 104;
    for (const t of kinds(f)) { miniSigil(t as Type, tx, y + 1); tx += 7; }
  }

  drawMovesSmall(f: Fighter, x: number, y: number): void {
    f.moves.forEach((id, i) => {
      const m = MOVES[id];
      if (!m) return;
      miniSigil(m.type as Type, x - 1, y + i * 9 + 1);
      text(m.name, x + 5, y + i * 9, f.cd[i] > 0 ? DIM : PAPER);
    });
  }
}

void legal; void G;
