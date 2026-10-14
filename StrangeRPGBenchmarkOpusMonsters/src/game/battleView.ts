import { fightLevel, houseCap, foretold, watchers, drinkerOf, silent, creditOf, covering, dueOf, overdriveCost, boutOn, inBout, latchHost, LATCH_DRINK, rangeOf, spunSlot, aimOf, deaf, pinkOf, orderOf, tideCost, typeOn, act, actJoint, advance, aimable, ammoOf, barred, calledOf, foresees, muted, kindLines, roundLead, switchWeight, boostOf, moveType, basicOf, nameOf, passivesOf, seenName, seenPassives, seenSprite, seenTypes, spriteOf, typesOf, sk, canGuard, canSwitch, forecast, ticks, isBig, legal, moveDef, moveText, newBattle, pegChance, pegLine, replace, reserves, standing, STATUS_NAME, targetKind, usable, snapOf, isLegal, replaceChoices, passiveVisit, visit, visitChoices, visitMatch, visitorOf } from '../battle/engine';
import { playCry } from './cries';
import { answer as aiAnswer, choose as aiChoose, chooseReplacement, chooseVisit, describeAction } from '../battle/ai';
import type { Action, Battle, Ev, Fighter, Mon, Snap, SnapFighter, SnapSide, SpriteData, Summon } from '../battle/model';
import { DROPS, FIELDS, GROUNDS, MARKS, MOVES, NOTIONS, PASSIVES, SUMMONS, type MoveDef } from '../battle/registry';
import { colorOf, dither, drawField, drawRun, drawStatus, fadedScene, kindIcon, kindsOf, nextHit, poseOf, runLights, runScene, startRun, type FxPoint, type FxRun, type Pose } from './battlefx';
import { heldCollar, shipBack, shipFront, shipRing, shipTrail } from './legendfx';
import { emptyPlan, fxHash, fxPlanOf, type FxPlan } from './fxspec';
import { fitAccent, fitColors, movePaint, summonSprite, type Paint } from './fitcolors';
import { hitSound, moveSound, soundTick, startSound } from './movesound';
import { parseSound } from './soundspec';
import './fxPreview';
import { chooses, passiveAction, passiveReplace, stateHash, type Choice, type Lockstep, type Need, type Release } from '../net/lockstep';
import { shownPlayerName } from '../net/names';
import { reasonText, type EndMsg, type Link, type MatchMsg, type PeekMsg, type RejoinMsg, type ToRoom } from '../net/protocol';

/** The bottom panel's grid: seven rows of text 9 pixels apart from y 124, and the divider between the actions and the detail. */
const MENU_Y = 124, MENU_ROWS = 7, DIVIDER = 90;
/** The speed lanes: a dark strip above your panel, right of where damage numbers rise from your whorl. */
const LANE_X = 113, LANE_Y = 56, LANE_W = 72;
/** A switch in frames: the old whorl leaves, a pause, then the new whorl pops out and settles. */
const SW_LEAVE = 22, SW_PAUSE = 10, SW_ENTER = 26;
/** One switch on screen: the whorl leaving, the one coming, frames so far, and whether a foe's move forced it. */
interface Swap { from: number; to: number; t: number; forced: boolean; popped: boolean }
/** Frames for a lane's marks to glide, and for a switch's old marks to leave and new marks to come in, on the switch's own beats. */
const LANE_GLIDE = 30, LANE_FADE = SW_LEAVE + SW_PAUSE, LANE_FEED = SW_ENTER;
/** Frames for a switch's old marks to dither out, for new marks to dither in, and for a knocked-out whorl's marks to break apart. */
const LANE_OUT = 10, LANE_IN = 14, LANE_BREAK = 20;
/** Still Minute's time machine in frames: the caster climbs in and it flies off, it lands in the past, an ally trades seats with the visitor, and it flies off again. */
const SHIP_LEN = { board: 52, arrive: 28, trade: 22, depart: 30 } as const;
/** The past's palette, dark to light: every scene pixel takes the brown nearest its brightness, lifted for the dim night scene. */
const PAST_BROWNS = ['#1c130c', '#3a2716', '#5e4024', '#87623c', '#b38d5e', '#ddc392'].map(h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)));
function pastPalette(): void {
  const img = ctx.getImageData(0, 0, SCENE_W, SCENE_H), d = img.data, n = PAST_BROWNS.length;
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.pow((d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255, 0.55);
    const c = PAST_BROWNS[Math.min(n - 1, Math.floor(l * n))];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  ctx.putImageData(img, 0, 0);
}
/** Cuts a string to a pixel width and ends it with a period when cut. */
function fitTo(s: string, w: number): string {
  if (textWidth(s) <= w) return s;
  while (s.length > 1 && textWidth(s + '.') > w) s = s.slice(0, -1);
  return s + '.';
}
/** Frames the jump into the past takes to dither the screen to black, and to dither the past back in. */
const CURTAIN_OUT = 18, CURTAIN_IN = 18;
/** In the boarding: the caster starts its hop, it is in, and the machine lifts off. */
const HOP_FROM = 10, HOP_IN = 22, LIFT = 30;
/** The time machine's sounds, in Tynagi's signature of a clock ticking twice (Notes/move-sounds.md has the words). */
const SHIP_SOUND = {
  board: 'gear snap soft x2 shell knock soft | water swell rise | glass chime high air whoosh soft',
  arrive: 'air whoosh fall | - | shell thud soft glass chime low gear snap soft x2',
  trade: 'shell knock soft x2 | - | glass chime soft',
  depart: 'gear hum rise | - | air whoosh rise glass chime high soft',
} as const;
/** One speed lane as drawn: its marks, where a glide started, turns taken that the clock has not passed, a switch's fade and feed, and a knockout's break. */
interface Lane {
  out: number; next: number; step: number; fromNext: number; fromStep: number; glide: number; past: number[]; oldNext: number; oldStep: number; fade: number; feed: number;
  brk: number; brkNext: number; brkStep: number; broke: boolean;
}
const smooth = (u: number): number => u * u * (3 - 2 * u);
const sameLane = (a: Snap, b: Snap | null): boolean => !!b && a.t === b.t && a.out[0] === b.out[0] && a.out[1] === b.out[1]
  && [0, 1].every(i => Math.abs(a.next[i] - b.next[i]) < 0.01 && Math.abs(a.step[i] - b.step[i]) < 0.01);
import { text, textCenter, textRight, textWidth, wrap } from '../engine/font';
import { input } from '../engine/input';
import { clear, ctx, layer, mix, rect, INK } from '../engine/screen';
import { drawAura } from '../data/starborn';
import { drawFighter, FOE_AT, MINE_AT, paintBackdrop, SCENE_H, SCENE_W, sceneNow, type SceneFigure, type SceneLight } from './backdrops';
import { drawSprite } from '../engine/sprites';
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { catchJingle, levelJingle, missJingle, switchInJingle, switchOutJingle } from './jingles';
import { LEVEL_MAX, TYPE_COLOR, typeMult, xpToNext, type Type } from '../data/types';
import { close, fadeToBlack, run, type Mode } from './modes';
import { panel, BADC, cdIcon, cursor, DIM, GOOD, hpBar, MINE, NERVE, PAPER, markIcon, miniSigil, pips, SEL, tideGauge, tideIcon, teamShell, capIcon, sigil, statusIcon, THEIRS, typeBadge, typeName, WARN } from './ui';
import { G, HERO, foeLevel, HORN_NAME, capHere, giveXp, levelOf, loosened, nerveUnlocked, owned, scaleNow, seen, type PegKind } from './state';

export interface BattleOpts {
  enemy: Mon[];
  name: string;
  ai: 'wild' | 'trainer' | 'keeper' | 'champion';
  wild: boolean;
  canRun?: boolean;
  /** Both teams fight at one level: SYNC_LV for true, or the level given. */
  sync?: boolean | number;
  scripted?: string;
  bg?: [string, string];
  /** Backdrop key. Defaults to the current map's. */
  scene?: string;
  area?: string;
  music?: string;
  xpScale?: number;
  noXp?: boolean;
  /** A notion that is spent on use stays held after the battle. Online play and the battle tower set it. */
  keepNotions?: boolean;
  /** Multiplies the enemy's HP, for legendary encounters. */
  bossHp?: number;
  /** Teaching notes, each shown once at the first player turn where its test holds. */
  tips?: { when: (b: Battle) => boolean; lines: string[] }[];
  /** A practice battle: the player's side is `mine` with `charm`, tide is on, nothing reaches the save, and V opens the debug menu. */
  practice?: { mine: Mon[]; charm: string | null; debug: (view: PracticeView) => Promise<void> };
}

/** What practice's debug menu reads and changes in a running battle: the battle, its messages so far, and the action the foe last took. */
export interface PracticeView { b: Battle; log: string[]; aiTook: string }

/** The side the screen shows as the player's: side 0 offline, and this client's side in an online battle. The battle on screen sets it. */
let pov: 0 | 1 = 0;
/** A fighter's name, look, and types as the player sees them: true for the player's side, the disguise for the other. */
const who = (f: Fighter): string => (f.side === pov ? nameOf(f) : seenName(f));
const look = (f: Fighter) => (f.side === pov ? spriteOf(f) : seenSprite(f));
const kinds = (f: Fighter) => (f.side === pov ? typesOf(f) : seenTypes(f));

/** How a battle ended. An online battle also carries the room's end, and 'run' then stands for a match with no result. */
export interface BattleOutcome { result: 'win' | 'lose' | 'run'; pegged: Mon[]; kos: number; end?: EndMsg }

/** An online battle's room and what this copy knows of the decision in hand. */
interface NetPlay {
  ls: Lockstep;
  link: Link;
  match: MatchMsg;
  /** The decision in hand as this copy describes it. */
  need: Need | null;
  /** The last decision this copy reported ready and the report itself, and the last it sent a choice for and the choice, to send again after a rejoin. */
  reported: number;
  ready: Extract<ToRoom, { type: 'ready' }> | null;
  chosen: number;
  sent: Choice;
  /** When the other side's seat hold ends by this page's clock while its link is down, or 0. A hidden tab runs few frames, so this counts time. */
  awayUntil: number;
  /** Releases that came before this copy reached their decision. */
  held: Release[];
  peek: PeekMsg | null;
  /** Each side's clock as the room last started it, counted down in frames. */
  clocks: [{ n: number; left: number } | null, { n: number; left: number } | null];
  end: EndMsg | null;
  /** True when a release, a peek, or the end came that the battle has not acted on. */
  fresh: boolean;
  /** Why this copy refused a release, when it did. */
  foul: string;
}

/** The backdrops and the battle tracks online matches use. The tracks are the ones no person or story fight owns. */
const ONLINE_SCENES = ['battlefield', 'crater', 'shingle', 'longway', 'gatering', 'stack'];
const ONLINE_MUSIC = ['keeper', 'battle', 'keeperStrand'];

/** A match's backdrop and track from its seed, which both players hold. The track steps on after the backdrop, so every pair comes up. */
export function onlineLook(seed: number): { scene: string; music: string } {
  const n = Math.abs(Math.trunc(seed));
  return { scene: ONLINE_SCENES[n % ONLINE_SCENES.length], music: ONLINE_MUSIC[Math.floor(n / ONLINE_SCENES.length) % ONLINE_MUSIC.length] };
}

/** `white` is the frames a hard hit shows its whorl solid white, where `flash` blinks it. */
interface Disp { hp: number; shield: number; ko: boolean; gone: boolean; flash: number; white: number; shake: number; off: number; }
/** The frames a hard hit shakes its whorl. Above HARD_SHAKE - 6 it shakes 2 pixels across and bobs, and below that 1 pixel. */
const HARD_SHAKE = 20;
interface Float { x: number; y: number; s: string; c: string; t: number }
/** A light an effect casts on the backdrop, in scene pixels. One that travels moves from x, y to tx, ty over its life at full strength. */
interface Glow { x: number; y: number; tx: number; ty: number; r: number; lv: number; tint?: string; t: number; life: number; travel: boolean }

/** Where a side's slough stands in scene pixels: the player's side bottom left and the other side top right. */
const atOf = (side: 0 | 1): [number, number] => (side === pov ? MINE_AT : FOE_AT);
/** The middle of a side's slough in scene pixels. */
const midOf = (side: 0 | 1): [number, number] => [atOf(side)[0] + 4, atOf(side)[1] + 4];

type Phase = 'events' | 'menu' | 'target' | 'switch' | 'peg' | 'replace' | 'tagto' | 'end' | 'info' | 'aim' | 'tip' | 'opt' | 'wait' | 'resign' | 'vpick';

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
    { nerve: o.practice ? true : nerveUnlocked(), wild: o.wild, sync: !!o.sync, ...(typeof o.sync === 'number' ? { syncLv: o.sync } : {}), canRun: !!o.canRun, scripted: o.scripted },
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

/**
 * Opens an online battle on a lockstep copy as this client's side sees it. Every choice goes through the room's link. A
 * rejoin from a reloaded page passes the room's view of the decision in hand as `open`.
 */
export function onlineBattle(ls: Lockstep, link: Link, match: MatchMsg, open: RejoinMsg | null = null): Promise<BattleOutcome> {
  const look = onlineLook(match.seed);
  const o: BattleOpts = {
    enemy: [], name: shownPlayerName(match.names[1 - match.side]), ai: 'keeper', wild: false, sync: true, noXp: true, keepNotions: true,
    scene: look.scene, music: look.music,
  };
  const view = new BattleView(ls.b, o, { ls, link, match });
  if (open) view.rejoined(open);
  return fadeToBlack().then(() => {
    music.play(look.music);
    return run<BattleOutcome>(view);
  });
}

/** Pink tide in the gauge. */
const PINK_TIDE = '#e888b0';

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
  /** Whether the move used last is a crest, so its hits land hard. */
  lastCrest = false;
  endLines: string[] = [];
  outcome: BattleOutcome | null = null;
  enter = 30;
  t = 0;
  laneT = -1;
  laneGoal = 0;
  laneSpan = 0;
  laneBusy = 0;
  laneQ: Snap[] = [];
  laneLast: Snap | null = null;
  /** The battle as shown so far: the snapshot of the last event played, or the live battle once every event has played. */
  shown: Snap | null = null;
  /** Each whorl as last shown while out, so a whorl keeps its icons and look until the screen moves past it. */
  seenF = new Map<string, SnapFighter>();
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
  /** The foe's choice for the joint round in progress, made before the player chooses and hidden until it resolves. */
  jointAi: Action | null = null;
  /** Move pictures playing now. The last one started is the one whose landings the events wait for. */
  runs: FxRun[] = [];
  /** The field state as shown so far, from the field events played. */
  fieldShown: string | null = null;
  /** Summons already shown on the field, so a new one puffs where it stands. */
  sumSeen = new Set<number>();
  /** True while the events playing happened in a rewound past: the scene shows in sepia. */
  sepia = false;
  /** Still Minute's time machine on screen: the side it serves, what it is doing, frames into that, and its rider's look. Its `t` also clocks its sound. */
  ship: { side: 0 | 1; at: 'board' | 'arrive' | 'trade' | 'depart'; t: number; rider: SpriteData; old?: SpriteData } | null = null;
  /** Whether the player surrendered an offline battle, which ends it as a loss. */
  surrendered = false;
  /** The jump into the past behind a dither to black: frames into it, and the jump's event, held until the screen is black. */
  curtain: { t: number; ev: Ev | null } | null = null;
  /** The move slot the visitor picked, while the player picks how it casts it. */
  vslot = -1;
  /** The player's side and the other side. Offline the player is side 0. */
  side: 0 | 1 = 0;
  foe: 0 | 1 = 1;
  /** The room an online battle plays through, or null offline. */
  net: NetPlay | null = null;
  /** The phase the info view and the give-up question go back to. */
  backTo: Phase = 'menu';

  constructor(b: Battle, o: BattleOpts, net?: { ls: Lockstep; link: Link; match: MatchMsg }) {
    this.b = b;
    this.o = o;
    if (net) {
      this.net = { ...net, need: null, reported: -1, ready: null, chosen: -1, sent: null, awayUntil: 0, held: [], peek: null, clocks: [null, null], end: null, fresh: false, foul: '' };
      this.side = net.match.side;
      this.foe = (1 - net.match.side) as 0 | 1;
    }
    pov = this.side;
    this.disp = b.s.map(s => s.f.map(f => ({ hp: f.hp, shield: f.shield, ko: f.ko, gone: f.gone, flash: 0, white: 0, shake: 0, off: 0 })));
    this.outIdx = [b.s[0].out, b.s[1].out];
    const first = b.s[this.foe].f[b.s[this.foe].out], mine = b.s[this.side].f[b.s[this.side].out];
    // The Register marks a kind once a starborn one of it has come out.
    if (o.wild && first.mon.starborn) G.flags['sb:' + first.mon.kind] = 1;
    const foeMsg: Ev = { e: 'msg', text: o.wild ? `A ${first.mon.starborn ? 'starborn' : 'wild'} ${who(first)} comes out of the ${o.area || 'brush'}.` : `${o.name} sends out ${who(first)}.` };
    const myMsg: Ev = { e: 'msg', text: `${HERO} sends out ${who(mine)}.` };
    this.introCries.set(foeMsg, first).set(myMsg, mine);
    this.queue.push(foeMsg, myMsg);
    this.fieldShown = b.field?.id || null;
    for (const s of b.s) for (const u of s.sum) this.sumSeen.add(u.uid);
    this.collect();
  }

  /** The two opening lines, each with the whorl that cries when it shows. */
  introCries = new Map<Ev, Fighter>();

  /** A fighter's cry as the player hears it: a disguise cries as what it looks like. */
  cry(f: Fighter, mode: 'out' | 'crest' | 'ko'): void {
    const disguised = f.side !== this.side && f.disguise;
    playCry(disguised ? { name: seenName(f), types: seenTypes(f), sprite: seenSprite(f) } : { name: nameOf(f), types: typesOf(f), sprite: spriteOf(f), fitted: f.mon.fitted && !f.form, parents: f.mon.parents },
      mode, { pan: f.side === this.side ? -0.35 : 0.35, at: mode === 'out' ? 0.16 : 0, vol: 0.9 });
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
      if (b.over === null && (b.need?.kind === 'act' || b.need?.kind === 'joint') && s0.f[s0.out].ko) { b.need = null; b.acting = null; b.queue = []; s0.next = b.t + 60; this.jointAi = null; }
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
    if (this.net) { this.stepNet(); return; }
    if (this.queue.length) { this.phase = 'events'; return; }
    if (this.b.over !== null) { this.finishBattle(); return; }
    const d = advance(this.b, (bb, side) => (side === 1 ? chooseReplacement(bb, side) : -1));
    this.collect();
    if (this.queue.length && d.kind !== 'over') { this.phase = 'events'; return; }
    if (d.kind === 'over') { this.collect(); if (this.queue.length) { this.phase = 'events'; return; } this.finishBattle(); return; }
    if (d.kind === 'replace') { this.phase = 'replace'; this.sel = 0; return; }
    // Still Minute's visitor waits in the past: the player picks its move, or the AI does for the foe's visitor.
    if (d.kind === 'visit') {
      if (d.side === this.side) { this.openMenu(); return; }
      visit(this.b, chooseVisit(this.b, d.side));
      this.collect();
      this.phase = 'events';
      return;
    }
    if (d.kind === 'joint') {
      // The foe chooses first and keeps it hidden. Both choices resolve together once the player picks.
      // A foe that foresees chooses after the player instead, knowing the player's choice.
      this.jointAi = foresees(this.b, 1) ? null : aiChoose(this.b, 1);
      if (this.o.practice && this.jointAi) this.aiTook = describeAction(this.b, 1, this.jointAi);
      this.openMenu();
      return;
    }
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

  /** Whether the player picks for Still Minute's visitor now: its decision waits on this side. */
  visiting(): boolean {
    const b = this.b;
    return b.need?.kind === 'visit' && b.need.side === this.side && !!b.visit;
  }

  /** The whorl whose moves the menu shows: the visitor while it waits on its choice, and the out whorl at any other time. */
  actor(): Fighter {
    return this.visiting() ? visitorOf(this.b, this.b.visit!) : this.me();
  }

  /** The visitor's menu: each of its moves, with the ones it cannot cast greyed, and a pass when it can cast none. */
  buildVisitOptions(): void {
    const b = this.b, f = this.actor(), choices = visitChoices(b);
    const opts: BattleView['options'] = [];
    f.moves.forEach((id, i) => {
      const m = MOVES[id];
      if (!m) return;
      const ok = choices.some(a => a.k === 'move' && a.i === i);
      opts.push({ label: m.name, kind: 'move', i, ok, why: m.nerve ? 'A crest cannot be cast in the past.' : m.rewinds ? 'It cannot be cast in the past.' : 'Nothing to cast it on.' });
    });
    if (choices.some(a => a.k === 'wait')) opts.push({ label: 'Cast nothing', action: { k: 'wait' }, kind: 'wait', ok: true });
    if (this.net) opts.push({ label: 'Give up', kind: 'resign', ok: true });
    this.options = opts;
  }

  /** The ways the visitor can cast the move in slot i, each with the words that say how: on whom, which option, whose place it takes. */
  visitWays(i: number): { label: string; a: Action }[] {
    const b = this.b, v = b.visit;
    if (!v) return [];
    const name = (side: 0 | 1, idx: number) => { const x = b.s[side].f[idx]; return x ? who(x) : '?'; };
    return visitChoices(b).filter(a => a.k === 'move' && a.i === i).map(a => {
      const x = a as Extract<Action, { k: 'move' }>, m = moveDef(visitorOf(b, v), i);
      const parts: string[] = [];
      if (x.opt !== undefined && m?.options) parts.push(m.options(b, visitorOf(b, v))[x.opt] || `Option ${x.opt + 1}`);
      if (x.target !== undefined) {
        const tk = m ? targetKind(visitorOf(b, v), m) : 'none', foe = tk === 'enemyReserve' || tk === 'enemyAny';
        const t = name(foe ? this.foe : this.side, x.target);
        parts.push(m?.tag && !foe ? `Swap with ${t}` : `On ${t}`);
      }
      if (x.tagTo !== undefined) parts.push(`Swap with ${name(this.side, x.tagTo)}`);
      if (x.aim) { const u = b.s[this.foe].sum.find(s => s.uid === x.aim); parts.push(`At ${u ? SUMMONS[u.def]?.name || 'a summon' : 'a summon'}`); }
      return { label: parts.join(', ') || m?.name || '?', a };
    });
  }

  buildOptions(): void {
    if (this.visiting()) { this.buildVisitOptions(); return; }
    const b = this.b, me = b.s[this.side];
    const f = me.f[me.out];
    const taunted = !!f.s.taunt && !f.s.unstop;
    const opts: BattleView['options'] = [];
    opts.push({ label: 'Attack', action: { k: 'attack' }, kind: 'attack', ok: true });
    f.moves.forEach((id, i) => {
      const m = MOVES[id];
      // Before tide opens, a crest is a locked slot that shows nothing of itself.
      if (m?.nerve && !b.rules.nerve) { opts.push({ label: '???', kind: 'move', i, ok: false, why: '???', hidden: true }); return; }
      const u = usable(b, f, i);
      const why = taunted ? 'Taunted.' : m?.nerve && u.why === 'Not enough tide.' ? `Not enough tide (${me.nerve} of ${tideCost(b, f, m)})`
        : m?.nerve && u.why === 'Not enough clear tide.' ? `Not enough clear tide (${me.nerve - pinkOf(b, this.side)} of ${tideCost(b, f, m)})` : u.why;
      opts.push({ label: m?.name || id, kind: 'move', i, ok: u.ok && !taunted, why });
    });
    opts.push({ label: 'Guard', action: { k: 'guard' }, kind: 'guard', ok: !taunted && canGuard(f), why: taunted ? 'Taunted.' : 'Not two turns in a row.' });
    const sw = canSwitch(b, f);
    opts.push({ label: 'Switch', kind: 'switch', ok: sw, why: reserves(me).length ? 'It cannot switch out now.' : 'Nobody in reserve.' });
    const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
    if (n?.action) opts.push({ label: n.action.name, action: { k: 'notion' }, kind: 'notion', ok: (f.k.notionUsed || 0) < (me.charm === 'pylon' && !n.spent ? 2 : 1), why: 'Used.' });
    for (const d of b.drops || []) if (DROPS[d.id]) opts.push({ label: `Take ${DROPS[d.id].name}`, action: { k: 'take', i: d.uid }, kind: 'take', ok: !taunted, why: 'Taunted.' });
    if (legal(b, this.side).some(a => a.k === 'wait')) opts.push({ label: 'Measure', action: { k: 'wait' }, kind: 'wait', ok: true });
    if (this.o.wild) {
      opts.push({ label: 'Sound', kind: 'peg', ok: true });
      if (this.o.canRun !== false) opts.push({ label: 'Run', action: { k: 'run' }, kind: 'run', ok: true });
    } else if (!this.net && !this.o.scripted && !this.o.tips) opts.push({ label: 'Surrender', kind: 'resign', ok: true });
    if (this.net) opts.push({ label: 'Give up', kind: 'resign', ok: true });
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
    if (!this.o.keepNotions) for (const f of b.s[0].f) {
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
    if (result === 'lose') this.endLines.push(this.surrendered ? `${HERO} surrenders.` : 'Your whole team is down.');
    if (!this.endLines.length) this.endLines.push(result === 'run' ? '' : 'It is over.');
    this.endLines = this.endLines.filter(Boolean);
    this.phase = 'end';
    this.timer = 0;
    this.sub = 0;
  }

  // ------------------------------------------------------------ update

  update(): void {
    pov = this.side;
    this.t++;
    if (this.t % 15 === 0) music.setIntensity(this.intensity());
    if (this.enter > 0) { this.enter -= this.speed(); return; }
    for (const side of this.disp) for (const d of side) { if (d.flash > 0) d.flash--; if (d.white > 0) d.white--; if (d.shake > 0) d.shake--; if (d.off > 0) d.off = Math.max(0, d.off - 2); }
    this.floats = this.floats.filter(f => (f.t -= 1) > 0);
    this.glows = this.glows.filter(g => ++g.t < g.life);
    for (const r of this.runs) { r.t += this.speed(); soundTick(r, this.speed()); }
    this.runs = this.runs.filter(r => r.t < r.end);
    const sh = this.ship;
    if (sh) {
      sh.t += this.speed();
      soundTick(sh, this.speed());
      // After boarding the machine is gone into the past, and after departing it is gone home. Between them it waits beside its side.
      if ((sh.at === 'board' || sh.at === 'depart') && sh.t >= SHIP_LEN[sh.at]) this.ship = null;
    }
    const ct = this.curtain;
    if (ct) {
      ct.t += this.speed();
      if (ct.ev && ct.t >= CURTAIN_OUT) { const ev = ct.ev; ct.ev = null; ct.t = CURTAIN_OUT; this.play(ev); }
      if (!ct.ev && ct.t >= CURTAIN_OUT + CURTAIN_IN) this.curtain = null;
    }
    this.puffSummons();
    if (this.bannerT > 0) this.bannerT--;
    this.tickSwaps();
    this.tickLanes();
    if (this.o.practice && this.phase !== 'end') {
      if (input.hit('menu') && !this.debugAsk) { this.debugAsk = true; if (this.phase === 'events') sfx('blip'); }
      if (this.debugAsk && this.phase !== 'events') { this.openDebug(); return; }
    }
    if (this.net?.fresh) this.wakeNet();
    switch (this.phase) {
      case 'events': this.updateEvents(); break;
      case 'menu': this.updateMenu(); break;
      case 'target': case 'tagto': this.updateTarget(); break;
      case 'aim': this.updateAim(); break;
      case 'opt': this.updateOpt(); break;
      case 'vpick': this.updateVpick(); break;
      case 'switch': this.updateSwitch(); break;
      case 'peg': this.updatePeg(); break;
      case 'replace': this.updateReplace(); break;
      case 'wait': this.updateWait(); break;
      case 'resign': this.updateResign(); break;
      case 'info': if (input.hit('ok') || input.hit('back')) this.phase = this.backTo; break;
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
    // A hit, heal, or shield waits for its move's picture to land, so its number never shows before the picture reaches it.
    const p = this.pacer, next = this.queue[0];
    if (p && next && this.lands(next, p)) {
      const at = nextHit(p);
      if (at >= 0 && p.t < at) return;
      p.played++;
    }
    const e = this.queue.shift();
    if (!e) { this.msgText = ''; this.sepia = false; this.step(); return; }
    this.cur = e;
    this.play(e);
  }

  /** The picture whose landings the events wait for: the last move started. */
  pacer: FxRun | null = null;

  /** Whether an event is one a move's picture lands with. */
  lands(e: Ev, p: FxRun): boolean {
    if (e.e === 'dmg' || e.e === 'heal' || e.e === 'shield' || e.e === 'blocked') return true;
    return e.e === 'status' && !(this.at(e.side) === p.side && e.id === 'dashing');
  }

  /** Where the screen shows a battle side: 0 for the player's place bottom left and 1 for the other side's place top right. */
  at(side: 0 | 1): 0 | 1 { return side === this.side ? 0 : 1; }

  /** Where a picture starts and lands, in scene pixels: the user's middle, or `start`, and the user's own side, the foe, or every foe on the field. */
  fxPoints(plan: FxPlan, side: 0 | 1, start?: FxPoint): { from: FxPoint; to: FxPoint[] } {
    const at = (sd: 0 | 1): FxPoint => { const [x, y] = midOf(sd); return { x, y }; };
    const foe = (1 - side) as 0 | 1, from = start || at(side), scope = plan.to || 'foe';
    if (scope === 'self' || scope === 'ally') return { from, to: [from] };
    const to = [at(foe)];
    if (scope === 'all') this.shownSums(foe).forEach((_, i) => { const [sx, sy] = this.summonAt(foe, i, atOf(foe)[0], atOf(foe)[1]); to.push({ x: sx + 2, y: sy + 1 }); });
    return { from, to };
  }

  /**
   * Starts a picture for a side's out whorl in a color, and returns it. A fit's picture takes `accent`, and `paint` recolors its
   * art. A visitor's picture starts from its time machine.
   */
  startFx(plan: FxPlan, side: 0 | 1, key: string, color: string, accent?: string, paint?: Paint | null, visitor = false): FxRun {
    const { from, to } = this.fxPoints(plan, side, visitor ? this.shipMid(side) : undefined);
    // A picture carries the side as the screen places it, so its sound pans to where the whorl stands.
    const run = startRun(plan, this.at(side), from, to, colorOf(plan.color, color), plan.accent ? colorOf(plan.accent, color) : accent, fxHash(key));
    if (paint) run.paint = paint;
    if (visitor) run.visit = true;
    this.runs.push(run);
    return run;
  }

  /** Where Still Minute's time machine rests beside a side, in scene pixels: the middle of its rider, clear of the whorl and the panels. */
  shipMid(side: 0 | 1): FxPoint {
    return this.at(side) === 0 ? { x: 8, y: 39 } : { x: 88, y: 15 };
  }

  /** A plain attack's picture: a physical one lunges and lands as its user's type lands, and a magic one throws a small orb. */
  attackPlan(f: Fighter | undefined): FxPlan {
    const p = emptyPlan();
    p.small = true;
    const ty = (f ? kinds(f)[0] : 'STONE') as Type;
    const LAND: Record<string, string> = { STONE: 'crack', TIDE: 'splash', ROOT: 'slash', GEAR: 'burst', BEAST: 'bite', STAR: 'sparkle', SALT: 'shatter', VOID: 'smoke' };
    if (!f || basicOf(f) === 'P') { p.motion = ['lunge']; p.impact = [LAND[ty] || 'flash']; }
    else { p.shape = 'orb'; p.path = 'line'; p.impact = ['flash']; }
    return p;
  }

  /** A summon that has just come shows with a puff where it stands. */
  puffSummons(): void {
    for (const side of [0, 1] as const) this.shownSums(side).forEach((u, i) => {
      if (this.sumSeen.has(u.uid)) return;
      this.sumSeen.add(u.uid);
      const [sx, sy] = this.summonAt(side, i, atOf(side)[0], atOf(side)[1]);
      const plan = emptyPlan();
      plan.impact = ['puff']; plan.small = true;
      const owner = this.b.s[side].f[u.by], color = owner ? TYPE_COLOR[kinds(owner)[0] as Type] : PAPER;
      this.runs.push(startRun(plan, this.at(side), { x: sx + 2, y: sy + 1 }, [{ x: sx + 2, y: sy + 1 }], color, undefined, u.uid));
    });
  }

  play(e: Ev): void {
    // The jump into the past waits until the screen has dithered to black, so the past and its palette never show half loaded.
    if (e.e === 'rewind' && e.past && !this.curtain) { this.curtain = { t: 0, ev: e }; this.timer = 9999; return; }
    this.sepia = !!e.past;
    const SPR = (side: 0 | 1) => ({ x: atOf(side)[0] * 2, y: atOf(side)[1] * 2 });
    if (e.snap) this.show(e.snap);
    // A "sends out" message already carries the switch, which the lane plays with the switch itself.
    if (e.snap && !(e.e === 'msg' && this.queue[0]?.e === 'out')) { this.laneQ.push(e.snap); this.laneLast = e.snap; }
    // What happens to Still Minute's visitor itself shows at its time machine, never on the whorl in its slot.
    if (e.visit && e.e !== 'use' && 'side' in e) {
      const p = this.shipMid(e.side);
      if (e.e === 'heal' && e.amt > 0) { this.floats.push({ x: p.x * 2, y: p.y * 2 - 14, s: '+' + e.amt, c: GOOD, t: 36 }); sfx('heal'); }
      else if (e.e === 'status') this.floats.push({ x: p.x * 2, y: p.y * 2 - 14, s: STATUS_NAME[e.id] || MARKS[e.id]?.name || e.id, c: SEL, t: 34 });
      this.timer = 6;
      return;
    }
    switch (e.e) {
      case 'ship': this.playShip(e); break;
      case 'msg': {
        this.msgText = e.text; this.timer = 34 + Math.min(40, e.text.length);
        this.log.push(e.text);
        if (e.text.endsWith('won\'t curl into the horn.')) missJingle();
        if (this.log.length > 200) this.log.shift();
        const f = this.introCries.get(e);
        if (f) this.cry(f, 'out');
        // "Sends out" stays on screen through the switch that follows it, so the switch starts at once.
        if (this.queue[0]?.e === 'out') this.timer = 8;
        // While a move's picture is on its way, its words stay up and the picture sets the beat until it lands.
        else if (this.pacer && this.pacer.played === 0 && nextHit(this.pacer) > this.pacer.t) this.timer = Math.max(16, nextHit(this.pacer) - this.pacer.t);
        break;
      }
      case 'use': {
        const user = this.b.s[e.side].f[e.idx], mv = MOVES[e.move];
        // A move with options names the option picked, and draws that option's own picture when it has one.
        const optName = mv?.options && e.opt !== undefined && e.opt >= 0 && user ? mv.options(this.b, user)[e.opt] : '';
        this.banner = optName ? `${e.name}: ${optName.split(':')[0]}` : e.name; this.bannerT = 40; this.timer = 4;
        if (user && mv && isBig(mv)) this.cry(user, 'crest');
        const tint = this.tintOf(e.side, e.idx, e.move);
        this.lastTint = tint;
        const optFx = mv?.fxOpts && e.opt !== undefined && e.opt >= 0 ? mv.fxOpts[e.opt] : undefined;
        this.pacer = this.startFx(mv ? fxPlanOf(optFx ? { ...mv, fx: optFx } : mv) : this.attackPlan(user), e.side, mv ? mv.id : `attack${e.side}`, tint || PAPER, fitAccent(fitColors(user), tint || PAPER), movePaint(user, mv), !!e.visit);
        if (mv) moveSound(this.pacer, mv, e.opt, user ? this.typeOfMove(user, mv) : mv.type, isBig(mv), this.speed());
        this.lastCrest = !!mv && isBig(mv);
        break;
      }
      case 'dmg': {
        const d = this.disp[e.side][e.idx];
        const toShield = Math.min(d.shield, e.shield);
        d.shield -= toShield;
        d.hp = Math.max(0, d.hp - (e.amt - e.shield));
        const hard = e.kind !== 'T' && (e.amt > 40 || e.eff > 1.01 || this.lastCrest);
        d.shake = Math.max(d.shake, hard ? HARD_SHAKE : 8);
        if (hard) d.white = 6;
        this.light(e.side, e.eff > 1.01 ? 15 : 11, 2.4, 16, e.kind === 'T' ? undefined : this.lastTint);
        const p = SPR(e.side);
        const col = e.eff > 1.01 ? WARN : e.eff < 0.99 ? DIM : PAPER;
        this.floats.push({ x: p.x + 12, y: p.y - 4, s: String(e.amt), c: col, t: 40 });
        if (e.eff > 1.01) this.floats.push({ x: p.x + 12, y: p.y - 13, s: 'strong', c: WARN, t: 40 });
        else if (e.eff < 0.99) this.floats.push({ x: p.x + 12, y: p.y - 13, s: 'weak', c: DIM, t: 40 });
        hitSound(this.at(e.side), e.amt > 40 || e.eff > 1.01, this.outIdx[e.side] !== e.idx, this.speed());
        this.timer = 14;
        break;
      }
      case 'heal': {
        const d = this.disp[e.side][e.idx];
        const f = this.b.s[e.side].f[e.idx];
        d.hp = Math.min(f.maxHp, d.hp + e.amt);
        // A resync (a thaw) takes the HP as of this event, not the HP at the end of the turn.
        if (e.amt === 0) { const o = e.snap?.side[e.side].out; d.hp = o && o.idx === e.idx ? o.hp : f.hp; }
        const p = SPR(e.side);
        if (this.outIdx[e.side] === e.idx && e.amt > 0) { this.floats.push({ x: p.x + 12, y: p.y - 4, s: '+' + e.amt, c: GOOD, t: 36 }); this.light(e.side, 10, 1.6, 26, GOOD); }
        sfx('heal');
        this.timer = 10;
        break;
      }
      case 'rise': {
        // A knocked-out whorl comes back: its shell and HP return, and the side lights up.
        const d = this.disp[e.side][e.idx];
        d.ko = false; d.gone = false; d.hp = e.hp; d.flash = 10;
        this.light(e.side, 14, 2.2, 30, GOOD);
        sfx('heal');
        this.timer = 18;
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
      // A visitor that takes the out ally's seat steps out of its time machine, which the trade itself shows.
      case 'out': if (this.ship?.at === 'trade' && this.ship.side === e.side) { this.outIdx[e.side] = e.idx; this.timer = 4; } else this.startSwap(e.side, e.idx); break;
      case 'ko': { const d = this.disp[e.side][e.idx]; d.ko = true; d.hp = 0; this.light(e.side, 14, 2.4, 12); this.cry(this.b.s[e.side].f[e.idx], 'ko'); this.breakLane(e.side, e.idx); this.timer = 20; break; }
      case 'nerve': if (e.n > 0) sfx('nerve'); this.timer = 2; break;
      case 'wind': {
        sfx('wind'); this.banner = `${MOVES[e.move]?.name || ''} !`; this.bannerT = 50; this.timer = 10;
        this.lastTint = this.tintOf(e.side, e.idx, e.move);
        this.light(e.side, 11, 2, 22, this.lastTint);
        // Winding up draws the move's own pieces in toward the user, which glows and rings.
        const mv = MOVES[e.move], base = mv ? fxPlanOf(mv) : emptyPlan(), plan = emptyPlan();
        Object.assign(plan, { motion: ['flare'], shape: base.shape && base.shape !== 'beam' ? base.shape : 'spark', path: 'converge', count: 4, impact: ['ring'], to: 'self', color: base.color, accent: base.accent, big: base.big });
        this.startFx(plan, e.side, (mv?.id || '') + 'wind', this.lastTint || PAPER, fitAccent(fitColors(this.b.s[e.side].f[e.idx]), this.lastTint || PAPER));
        break;
      }
      case 'rewind': {
        // The battle jumped in time: every whorl shows as it stands at the new moment, and pictures and switches in flight drop.
        this.disp.forEach((row, si) => row.forEach((d, fi) => { d.hp = e.hp[si][fi]; d.shield = e.shield[si][fi]; d.ko = e.ko[si][fi]; d.gone = e.gone[si][fi]; d.flash = 0; d.white = 0; d.shake = 0; d.off = 0; }));
        this.outIdx = [e.out[0], e.out[1]];
        this.fieldShown = e.field;
        this.runs = []; this.swaps = [null, null]; this.pacer = null;
        if (e.past) { this.banner = 'The tide turns back'; this.bannerT = 60; }
        this.timer = 24;
        break;
      }
      case 'field': {
        this.fieldShown = e.id;
        const fd = e.id ? FIELDS[e.id] : null;
        if (fd) { this.banner = fd.name; this.bannerT = 50; }
        this.timer = fd ? 16 : 4;
        break;
      }
      case 'cut': sfx('cut'); this.disp[e.side][e.idx].shake = 14; this.light(e.side, 10, 2, 12); this.timer = 10; break;
      case 'peg': { const d = this.disp[1][e.idx]; d.gone = true; this.light(1, 16, 2.4, 34, TYPE_COLOR.STAR); catchJingle(); this.timer = 30; break; }
      case 'guard': this.light(e.side, 8, 1.4, 12, TYPE_COLOR.SALT); sfx('guard'); this.timer = 6; break;
      case 'blocked': sfx('shield'); this.disp[e.side][e.idx].flash = 8; this.light(e.side, 8, 1.6, 10, TYPE_COLOR.SALT); this.timer = 8; break;
    }
  }

  /** The type color a move casts its light in, after any retune or retype. A plain attack takes its user's first type. */
  tintOf(side: 0 | 1, idx: number, move: string): string | undefined {
    const f = this.b.s[side].f[idx], mv = MOVES[move];
    const t = (mv ? (f ? moveType(f, mv) : mv.type) : f ? kinds(f)[0] : undefined) as Type | undefined;
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
    for (const p of this.snapNow().wind) {
      if (this.outIdx[p.side] !== p.idx || this.disp[p.side][p.idx]?.ko) continue;
      const [x, y] = midOf(p.side);
      out.push({ x, y, r: 9, lv: 1.1 + 0.5 * Math.sin(this.t / 7), tint: this.tintOf(p.side, p.idx, p.move) });
    }
    for (const r of this.runs) out.push(...runLights(r));
    return out;
  }

  /** The pose of a side's out whorl, or with `visitor` of the rider in its time machine, from the newest picture still moving it. */
  poseFor(side: 0 | 1, visitor = false): { pose: Pose; run: FxRun } | null {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const r = this.runs[i], n = r.motionAt.length;
      if (r.side === this.at(side) && !!r.visit === visitor && n && r.t < r.motionAt[n - 1] + r.motionLen[n - 1]) return { pose: poseOf(r), run: r };
    }
    return null;
  }

  /** Plays one beat of Still Minute's time machine, and its sound in Tynagi's signature. */
  playShip(e: Extract<Ev, { e: 'ship' }>): void {
    const v = this.b.visit, slot = this.b.s[e.side].f[e.idx];
    const rider = v && v.side === e.side ? look(v.body) : this.ship?.rider || (slot ? look(slot) : spriteOf(this.me()));
    if (e.at === 'trade') {
      // The visitor steps out to stay, and the ally it trades with climbs in.
      this.ship = { side: e.side, at: 'trade', t: 0, rider: e.sprite || rider, old: this.ship?.rider || rider };
    } else if (e.at === 'depart') {
      this.ship = { side: e.side, at: 'depart', t: 0, rider: this.ship?.rider || rider };
    } else this.ship = { side: e.side, at: e.at, t: 0, rider };
    const end = SHIP_LEN[e.at];
    const times = e.at === 'board' ? { casts: [[0, HOP_IN]] as [number, number][], flights: [[LIFT, 14]] as [number, number][], hits: [LIFT + 14] }
      : e.at === 'arrive' ? { casts: [[0, 14]] as [number, number][], flights: [] as [number, number][], hits: [16] }
      : e.at === 'trade' ? { casts: [[0, 8]] as [number, number][], flights: [] as [number, number][], hits: [10] }
      : { casts: [[0, 10]] as [number, number][], flights: [] as [number, number][], hits: [22] };
    const plan = parseSound(SHIP_SOUND[e.at]);
    if (!('bad' in plan)) startSound(this.ship, plan, 'TIDE', fxHash('ship' + e.at), false, this.speed(), { ...times, land: 12, contact: 0, end, side: this.at(e.side), home: true });
    this.light(e.side, 10, 1.8, 20, '#dfe5eb');
    this.timer = end;
  }

  me(): Fighter { return this.b.s[this.side].f[this.b.s[this.side].out]; }

  /** Takes a snapshot as what the screen now shows, and remembers each out whorl as it was shown. */
  show(s: Snap): void {
    this.shown = s;
    for (const sd of [0, 1] as const) { const o = s.side[sd].out; if (o) this.seenF.set(`${sd}:${o.idx}`, o); }
  }

  /** The battle as shown so far. Before the first event it is the live battle. */
  snapNow(): Snap { return this.shown || snapOf(this.b); }

  /** A whorl as last shown while out, or as it is now if it has not been shown yet. */
  shownF(side: 0 | 1, idx: number): SnapFighter {
    const seen = this.seenF.get(`${side}:${idx}`);
    if (seen) return seen;
    const f = this.b.s[side].f[idx];
    const n = (r: Record<string, { n: number } | undefined>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v).map(([k, v]) => [k, v!.n]));
    return { idx, hp: f.hp, name: who(f), types: kinds(f), sprite: look(f), s: n(f.s as Record<string, { n: number } | undefined>), m: n(f.m) };
  }

  /** A side's tide, caps, and summons as shown. */
  shownSide(side: 0 | 1): SnapSide { return this.snapNow().side[side]; }

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
      if (opt.kind === 'resign') { this.backTo = 'menu'; this.phase = 'resign'; this.sub = 1; return; }
      // The visitor's move: cast at once when it has one way, or pick how from the board as it stood then.
      if (opt.kind === 'move' && this.visiting()) {
        const ways = this.visitWays(opt.i!);
        if (ways.length === 1) { this.commit(ways[0].a); return; }
        this.vslot = opt.i!; this.phase = 'vpick'; this.sub = 0;
        return;
      }
      if (opt.kind === 'move') {
        const f = this.me();
        const m = moveDef(f, opt.i!)!;
        if (m.options) { this.pendingMove = { i: opt.i! }; this.phase = 'opt'; this.sub = 0; return; }
        const tk = targetKind(f, m);
        if (tk !== 'none') { this.pendingMove = { i: opt.i! }; this.phase = 'target'; this.sub = 0; return; }
        if (m.tag && reserves(this.b.s[this.side]).some(r => !barred(r))) { this.pendingMove = { i: opt.i! }; this.phase = 'tagto'; this.sub = 0; return; }
        if (m.reach === 'single' && this.aimTargets().length > 1) { this.aimBase = { k: 'move', i: opt.i! }; this.phase = 'aim'; this.sub = 0; return; }
        this.commit({ k: 'move', i: opt.i! });
        return;
      }
      if (opt.action?.k === 'attack' && this.aimTargets().length > 1) { this.aimBase = { k: 'attack' }; this.phase = 'aim'; this.sub = 0; return; }
      this.commit(opt.action!);
    }
  }

  showInfo(): void {
    this.backTo = this.phase === 'wait' ? 'wait' : 'menu';
    const f = this.me();
    const lines: string[] = [];
    if (muted(f)) lines.push('Its passives are rubbed out for now.');
    for (const p of passivesOf(f)) { const d = PASSIVES[p]; if (d) lines.push(`${d.name}: ${d.text}`); }
    for (const x of f.lent || []) { const d = PASSIVES[x.id]; if (d) lines.push(`Lent for ${x.turns} turn${x.turns > 1 ? 's' : ''}, ${d.name}: ${d.text}`); }
    if (f.mon.notion && NOTIONS[f.mon.notion]) lines.push(`${NOTIONS[f.mon.notion].name}: ${NOTIONS[f.mon.notion].text}`);
    for (const id of f.items || []) if (NOTIONS[id]) lines.push(`Item, ${NOTIONS[id].name}: ${NOTIONS[id].text}`);
    for (const sd of [0, 1] as const) {
      const g = this.b.s[sd].ground, def = g ? GROUNDS[g.id] : null;
      if (g && def) lines.push(`${sd === this.side ? 'Your' : 'Their'} ground, ${def.name} for ${Math.ceil(g.turns)} rounds: ${def.text}`);
    }
    for (const sd of [0, 1] as const) {
      const sp = this.b.s[sd].spin;
      if (sp) lines.push(`${sd === this.side ? 'Your' : 'Their'} side is spinning for ${sp.turns} more turn${sp.turns > 1 ? 's' : ''}: after each of its turns, its out whorl goes to the back of the line.`);
    }
    for (const sd of [0, 1] as const) {
      const fg = this.b.s[sd].fog;
      if (fg) lines.push(`Fog over ${sd === this.side ? 'your' : 'their'} bench for ${Math.ceil(fg.turns)} rounds: nothing from the other side reaches the reserves.`);
      const hc = houseCap(this.b, sd);
      if (hc > 0) lines.push(`${sd === this.side ? 'Your' : 'Their'} house holds ${this.b.s[sd].pool || 0} of ${hc} HP: heals past full pour into it, and the next whorl to come out drinks it.`);
      const cr = creditOf(this.b, sd), owed = this.b.s[sd].nerve;
      if (cr) lines.push(`${sd === this.side ? 'Your' : 'Their'} side can run up to ${cr} tide into debt to pay for a crest.`);
      if (owed < 0) lines.push(`${sd === this.side ? 'Your' : 'Their'} side owes ${-owed} tide: the tide it gains pays the debt first.`);
      const sh = this.b.s[sd].shut;
      if (sh) lines.push(`${sd === this.side ? 'Your' : 'Their'} side is shut in for ${Math.ceil(sh.turns)} rounds: its switches go after the other side's action in a joint round.`);
      const pk = this.b.s[sd].pink;
      if (pk && pinkOf(this.b, sd) > 0) lines.push(`${pinkOf(this.b, sd)} of ${sd === this.side ? 'your' : 'their'} tide is pink for ${Math.ceil(pk.turns)} rounds: it cannot pay for a crest.`);
      const pr = this.b.s[sd].price;
      if (pr) lines.push(`${sd === this.side ? 'Your' : 'Their'} crests cost ${Math.abs(pr.add)} ${pr.add > 0 ? 'more' : 'less'} tide for ${Math.ceil(pr.turns)} rounds.`);
    }
    for (const sd of [0, 1] as const) {
      const o = this.b.s[sd].f[this.b.s[sd].out];
      if (o && o.up && !o.ko) lines.push(`${who(o)} is up off the ground for ${o.up} more turn${o.up > 1 ? 's' : ''}: dashes from the ground cannot reach it, and grounds do not touch it.`);
      if (o && !o.ko && deaf(this.b, o)) lines.push(`${who(o)} is Deaf: its passives and stances ignore what other whorls do.`);
      const fl = o && !o.ko ? foretold(this.b, o) : [];
      if (fl.length) lines.push(`${who(o)} sets off ${fl.map(g => g.name).join(', then ')}, in that order. Next, ${fl[0].name}: ${fl[0].text}`);
      for (const r of watchers(this.b, sd)) if (o && !o.ko) lines.push(`${who(r)} watches over ${who(o)} from reserve: a foe that hits ${who(o)} answers to it.`);
      const dr = o && !o.ko ? drinkerOf(this.b, o) : null;
      if (dr) lines.push(`${who(dr)} drinks every heal meant for ${who(o)}: each one goes to ${who(dr)} instead.`);
      if (o && !o.ko && silent(this.b, o)) lines.push(`${who(o)} is Silent: no other whorl's passives, stances, or holes hear what it does.`);
      if (o && !o.ko && o.takeIn) lines.push(`${who(o)}'s next attack or move goes into the cave and comes back out later.`);
      for (const p of this.b.pend) if (p.kind === 'held' && p.side === sd) lines.push(`${who(this.b.s[sd].f[p.idx])}'s ${p.move ? MOVES[p.move]?.name || 'move' : 'Attack'} is in the cave and comes back out soon.`);
      const at = o && !o.ko ? aimOf(this.b, o) : null;
      if (o && at) lines.push(`${who(o)} keeps its bearing on ${who(at)}: its one-target moves land there, out or in reserve.`);
    }
    if (this.b.lowWater) lines.push(`Low Water for ${Math.ceil(this.b.lowWater.turns)} rounds: a star falls every round, and attacks gain no tide.`);
    for (const sd of [0, 1] as const) for (const w of this.b.s[sd].f) if (w.ko && w.glow) lines.push(`${who(w)} glows on for ${w.glow.turns} more turns: its reserve passives still work, and it heals its side's out whorl ${Math.round(w.glow.heal * 100)}% each turn.`);
    for (const sd of [0, 1] as const) for (const w of this.b.s[sd].f) { const h = latchHost(this.b, w); if (h) lines.push(`${who(w)} rides ${who(h)}, drinking ${Math.round(LATCH_DRINK * 100)}% of its max HP each turn its side takes.`); }
    if (boutOn(this.b)) {
      const bt = this.b.bout!;
      lines.push(`A bout between ${who(this.b.s[0].f[bt.f0])} and ${who(this.b.s[1].f[bt.f1])}, ${bt.score[0]} to ${bt.score[1]} with ${bt.left} rounds left: neither can switch, a round goes to the one that dealt the other more, and the first to 2 gets Empower 2 and a 15% heal while the other gets Stun 1.`);
    }
    if (this.b.swell) lines.push(`The swell is at ${this.b.swell.n} of 9, rising each turn. At 9 the ninth wave breaks over both out whorls: a TIDE whorl gets Haste 1, and any other takes 12% of its max HP and Slow 1.`);
    if (this.b.wind) lines.push(`Wind toward ${this.b.wind.to === this.side ? 'your' : 'their'} side for ${Math.ceil(this.b.wind.turns)} rounds: projectiles thrown with it deal 1.2x, and projectiles thrown against it 0.8x.`);
    const rg = rangeOf(this.b);
    if (rg) lines.push(rg === 'near' ? 'Near: dashes deal 1.2x and projectiles 0.8x until either out whorl leaves.' : 'Far: projectiles deal 1.2x and dashes 0.8x until either out whorl leaves.');
    for (const sd of [0, 1] as const) {
      const o = this.b.s[sd].f[this.b.s[sd].out], due = o && !o.ko ? dueOf(o) : 0;
      if (due > 0) lines.push(`${who(o)} has ${due} damage over time still to come. If it comes due, all of it lands at once.`);
      if (o && !o.ko && o.swap && o.swap.turns > 0) {
        const p = this.b.s[Math.floor((o.swap.with - 1) / 8) as 0 | 1].f[(o.swap.with - 1) % 8];
        lines.push(`${who(o)} and ${who(p)} have traded bodies for ${o.swap.turns} more of ${who(o)}'s turns: each uses the other's look, types, passives, and moves. Either leaving the field ends it.`);
      }
      if (o && !o.ko && o.wait) lines.push(`${who(o)} lies in wait: as the other side starts its next action, a guard or a switch included, it casts ${MOVES[o.wait.move]?.name || 'its strike'} first.`);
      if (covering(this.b, sd)) lines.push(`${who(o)} stands in front of ${sd === this.side ? 'your' : 'their'} bench: it takes the other side's hits meant for the reserves.`);
      if (o && !o.ko && o.mirage) lines.push(sd === this.side ? `A mirage over ${who(o)} shows the foe ${o.mirage.hp} more HP than it has, for ${o.mirage.turns} more of its turns.` : `${who(o)} shimmers: a mirage may show more HP than it has.`);
      if (o && !o.ko && o.fracture) lines.push(`${who(o)} is Fractured for ${o.fracture.turns} more turn${o.fracture.turns > 1 ? 's' : ''}: no heal takes it above ${Math.round(o.maxHp * o.fracture.cap)} HP.`);
      if (o && !o.ko && o.poise) lines.push(`${who(o)} rolls with ${o.poise} poise: a foe's Stun, Sleep, Root, Slow, and delays fail on it. Hits wear the poise down, and when it breaks the whorl is Stunned 1.`);
      for (const r of reserves(this.b.s[sd])) if (r.stored) lines.push(`${who(r)} is in cold storage for ${r.stored.turns} more turn${r.stored.turns > 1 ? 's' : ''}: nothing from the other side reaches it, it cannot come out unless nobody else can, its cooldowns and marks wait, and it heals ${Math.round(r.stored.heal * 100)}% each turn.`);
    }
    const fl = this.b.field, fdef = fl ? FIELDS[fl.id] : null;
    if (fl && fdef) lines.push(`Field, ${fdef.name} for ${Math.ceil(fl.turns)} rounds: ${fdef.text}`);
    for (const u of this.b.s[this.side].sum) if (SUMMONS[u.def]) lines.push(`Summon, ${SUMMONS[u.def].name} (${u.hp}/${u.maxHp}): ${SUMMONS[u.def].text}`);
    for (const u of this.b.s[this.foe].sum) if (SUMMONS[u.def]) lines.push(`Their summon, ${SUMMONS[u.def].name} (${u.hp}/${u.maxHp}): ${SUMMONS[u.def].text}`);
    const foe = this.b.s[this.foe].f[this.b.s[this.foe].out];
    lines.push(`${who(foe)}: ${seenPassives(foe).map(p => PASSIVES[p]?.name).join(', ')}${muted(foe) ? ', rubbed out for now' : ''}`);
    for (const p of seenPassives(foe)) { const d = PASSIVES[p]; if (d) lines.push(`${d.name}: ${d.text}`); }
    this.infoText = lines;
    this.phase = 'info';
  }

  targets(): { label: string; idx: number; side: 0 | 1 }[] {
    const f = this.me();
    if (!this.pendingMove) return [];
    const m = moveDef(f, this.pendingMove.i)!;
    if (this.phase === 'tagto') { const cl = calledOf(this.b.s[this.side]); return reserves(this.b.s[this.side]).filter(r => !barred(r) && (!cl || r === cl)).map(r => ({ label: who(r), idx: r.idx, side: this.side })); }
    const tk = targetKind(f, m);
    if (tk === 'ally') return standing(this.b.s[this.side]).map(r => ({ label: who(r), idx: r.idx, side: this.side }));
    if (tk === 'reserveAlly') return reserves(this.b.s[this.side]).map(r => ({ label: who(r), idx: r.idx, side: this.side }));
    if (tk === 'enemyReserve') return reserves(this.b.s[this.foe]).map(r => ({ label: who(r), idx: r.idx, side: this.foe }));
    if (tk === 'enemyAny') return standing(this.b.s[this.foe]).map(r => ({ label: who(r), idx: r.idx, side: this.foe }));
    return [];
  }

  /** The foe's out whorl (uid 0) and every summon of theirs a single-target hit can be aimed at. */
  aimTargets(): { label: string; uid: number }[] {
    const foe = this.b.s[this.foe].f[this.b.s[this.foe].out];
    return [{ label: who(foe), uid: 0 }, ...this.b.s[this.foe].sum.filter(aimable).map(u => ({ label: `${SUMMONS[u.def]?.name || 'Summon'} ${u.hp}/${u.maxHp}`, uid: u.uid }))];
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

  /** The labels of the picked move's options, for a move that asks for one. */
  optLabels(): string[] {
    const mv = this.pendingMove, m = mv ? moveDef(this.me(), mv.i) : null;
    return m?.options ? m.options(this.b, this.me()) : [];
  }

  updateOpt(): void {
    const os = this.optLabels();
    if (!os.length || !this.pendingMove) { this.phase = 'menu'; return; }
    if (input.hit('up')) { this.sub = (this.sub + os.length - 1) % os.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % os.length; sfx('move'); }
    if (this.sub >= os.length) this.sub = 0;
    if (input.hit('back')) { sfx('back'); this.phase = 'menu'; this.pendingMove = null; return; }
    if (input.hit('ok')) { sfx('ok'); this.commit({ k: 'move', i: this.pendingMove.i, opt: this.sub }); }
  }

  /** How the visitor casts its picked move: the list of its ways, or back to its moves. */
  updateVpick(): void {
    const ws = this.visitWays(this.vslot);
    if (!ws.length || !this.visiting()) { this.phase = 'menu'; return; }
    if (input.hit('up')) { this.sub = (this.sub + ws.length - 1) % ws.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % ws.length; sfx('move'); }
    if (this.sub >= ws.length) this.sub = 0;
    if (input.hit('back')) { sfx('back'); this.phase = 'menu'; return; }
    if (input.hit('ok')) { sfx('ok'); this.commit(ws[this.sub].a); }
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
      if (this.phase === 'target' && m.tag && m.reach !== 'reserveAlly' && reserves(this.b.s[this.side]).length) {
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
    const rs = reserves(this.b.s[this.side]);
    if (!rs.length) { this.phase = 'menu'; return; }
    if (input.hit('up')) { this.sub = (this.sub + rs.length - 1) % rs.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % rs.length; sfx('move'); }
    if (this.sub >= rs.length) this.sub = 0;
    if (input.hit('back')) { sfx('back'); this.phase = 'menu'; return; }
    if (input.hit('ok') && barred(rs[this.sub])) { sfx('back'); this.banner = `${who(rs[this.sub])} is buried.`; this.bannerT = 50; return; }
    const called = calledOf(this.b.s[this.side]);
    if (input.hit('ok') && called && rs[this.sub] !== called) { sfx('back'); this.banner = `${who(called)} comes out next.`; this.bannerT = 50; return; }
    if (input.hit('ok')) { sfx('ok'); this.commit({ k: 'switch', to: rs[this.sub].idx }); }
  }

  pegList(): { kind: PegKind; n: number; line: number }[] {
    const foe = this.b.s[this.foe].f[this.b.s[this.foe].out];
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
    const rs = standing(this.b.s[this.side]);
    if (input.hit('up')) { this.sub = (this.sub + rs.length - 1) % rs.length; sfx('move'); }
    if (input.hit('down')) { this.sub = (this.sub + 1) % rs.length; sfx('move'); }
    if (this.sub >= rs.length) this.sub = 0;
    // A buried whorl comes out only when nobody else can.
    if (input.hit('ok') && rs.length && barred(rs[this.sub]) && rs.some(r => !barred(r))) { sfx('back'); this.banner = `${who(rs[this.sub])} is buried.`; this.bannerT = 50; return; }
    const called = calledOf(this.b.s[this.side]);
    if (input.hit('ok') && rs.length && called && rs[this.sub] !== called) { sfx('back'); this.banner = `${who(called)} comes out next.`; this.bannerT = 50; return; }
    if (input.hit('ok') && rs.length) {
      sfx('ok');
      if (this.net) { this.chooseNet(rs[this.sub].idx); return; }
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
    // The HP shown so far, so the music and the scene do not react to a hit before it lands.
    const share = (sd: 0 | 1) => { let a = 0, m = 0; b.s[sd].f.forEach((f, i) => { const d = this.disp[sd][i]; m += f.maxHp; a += d.ko || d.gone ? 0 : Math.max(0, d.hp); }); return m ? a / m : 0; };
    const low = Math.min(share(0), share(1));
    return Math.max(0, Math.min(1, (1 - low) * 1.2));
  }

  commit(a: Action): void {
    this.pendingMove = null;
    this.vslot = -1;
    if (this.net) { this.chooseNet(a); return; }
    if (this.b.need?.kind === 'visit') { visit(this.b, a); this.collect(); this.phase = 'events'; return; }
    if (this.b.need?.kind === 'joint') {
      actJoint(this.b, a, this.jointAi || (foresees(this.b, 1) ? aiAnswer(this.b, 1, a) : aiChoose(this.b, 1)));
      this.jointAi = null;
    } else act(this.b, a);
    this.collect();
    this.phase = 'events';
  }

  // ------------------------------------------------------------ online

  /** Moves the room on a frame, counts down both clocks, and reads every message waiting. Runs even under another screen. */
  tick(): void {
    const n = this.net;
    if (!n) return;
    n.link.tick();
    for (const c of n.clocks) if (c && c.left > 0) c.left--;
    // Reading stops at the end, so the next game's match waits for the screen after the battle.
    for (let m = n.end ? null : n.link.poll(); m; m = n.end ? null : n.link.poll()) {
      if (m.type === 'clock') { n.clocks[m.side] = { n: m.n, left: m.left * 60 }; continue; }
      if (m.type === 'away' || m.type === 'back') { if (m.side === this.foe) n.awayUntil = m.type === 'away' ? Date.now() + m.left * 1000 : 0; continue; }
      // A rejoin between games means the game ended while the link was down, and its end came with the rejoin.
      if (m.type === 'rejoin') { if (m.last) { n.end = m.last; n.fresh = true; } else this.rejoined(m); continue; }
      if (m.type === 'release') { if (m.n >= n.ls.n && !n.held.some(r => r.n === m.n)) n.held.push(m); }
      else if (m.type === 'peek') n.peek = m;
      else if (m.type === 'end') n.end = m;
      else continue;
      n.fresh = true;
    }
  }

  /**
   * The room's whole match after a rejoin: the releases this copy has not played, both clocks, the peek, and whether the
   * room holds this side's choice. The report and the choice go again in case the room missed them while the link was down.
   */
  rejoined(r: RejoinMsg): void {
    const n = this.net!, at = r.record.length;
    for (const rel of r.record) if (rel.n >= n.ls.n && !n.held.some(h => h.n === rel.n)) n.held.push(rel);
    n.held.sort((x, y) => x.n - y.n);
    n.clocks = [r.left[0] === null ? null : { n: at, left: r.left[0] * 60 }, r.left[1] === null ? null : { n: at, left: r.left[1] * 60 }];
    if (r.peek) n.peek = r.peek;
    if (n.reported === at && n.ready) n.link.send(n.ready);
    if (r.chose) n.chosen = Math.max(n.chosen, at);
    else if (n.chosen === at) n.link.send({ type: 'choose', n: at, c: n.sent });
    n.fresh = true;
  }

  /** Acts on new messages. A release of the decision in hand or the end cuts into a choice, and a wait ends when what it waits for comes. */
  wakeNet(): void {
    const n = this.net!;
    if (this.phase === 'events' || this.phase === 'end') return;
    if (this.phase !== 'wait' && !n.end && !n.held.some(r => r.n === n.ls.n)) return;
    n.fresh = false;
    this.stepNet();
  }

  /** The decision in hand: report it to the room, apply its release when that is already here, or open what the player chooses with. */
  stepNet(): void {
    const n = this.net!, b = this.b;
    if (this.queue.length) { this.phase = 'events'; return; }
    if (n.end) { this.finishNet(); return; }
    const need = n.ls.next();
    this.collect();
    if (this.queue.length) { this.phase = 'events'; return; }
    n.need = need;
    if (n.reported < n.ls.n) {
      n.reported = n.ls.n;
      n.ready = { type: 'ready', n: n.ls.n, hash: stateHash(b), need };
      n.link.send(n.ready);
    }
    const rel = n.held.find(r => r.n === n.ls.n);
    if (rel) { this.applyNet(rel); return; }
    if (need.kind === 'over' || n.chosen >= n.ls.n || !chooses(need, this.side)) { this.phase = 'wait'; return; }
    if (need.kind === 'replace' || need.kind === 'replace2') { this.phase = 'replace'; this.sub = 0; return; }
    // A side that foresees chooses once the room shows it the other side's choice, and the top bar says what that is.
    this.jointAi = null;
    if (need.kind === 'joint' && need.sees === this.side) {
      const p = n.peek;
      if (!p || p.n !== n.ls.n) { this.phase = 'wait'; return; }
      this.jointAi = p.timeout ? passiveAction(b, this.foe) : (p.c as Action);
    }
    this.openMenu();
  }

  /** Sends this side's choice and waits for the room to release the decision. A choice the engine would refuse never leaves. */
  chooseNet(c: Choice): void {
    const n = this.net!, ok = typeof c === 'number' ? replaceChoices(this.b, this.side).includes(c)
      : this.b.need?.kind === 'visit' ? !!c && !!visitMatch(this.b, c as Action) : !!c && isLegal(this.b, this.side, c as Action);
    if (!ok) { sfx('back'); this.banner = 'It cannot do that now.'; this.bannerT = 50; if (typeof c !== 'number') this.openMenu(); return; }
    n.chosen = n.ls.n;
    n.sent = c;
    n.link.send({ type: 'choose', n: n.ls.n, c });
    this.aimBase = null;
    this.phase = 'wait';
  }

  /** Plays a release: a line for each side whose time ran out, then the battle's own events. */
  applyNet(rel: Release): void {
    const n = this.net!;
    n.held = n.held.filter(r => r.n > rel.n);
    if (rel.timeout[this.side]) this.queue.push({ e: 'msg', text: this.timeoutLine(rel.need) });
    if (rel.timeout[this.foe]) this.queue.push({ e: 'msg', text: `${this.o.name} ran out of time.` });
    try { n.ls.apply(rel); }
    catch (e) {
      // A release this copy cannot play means the other side sent what no honest copy would, so the match ends with no result.
      n.foul = (e as Error).message;
      n.link.send({ type: 'foul', n: rel.n, why: reasonText(n.foul) });
      n.end = { type: 'end', why: 'void', winner: null, wins: n.match.wins, final: true, matchWinner: null };
    }
    n.peek = null;
    this.jointAi = null;
    this.pendingMove = null;
    this.aimBase = null;
    this.collect();
    this.phase = 'events';
  }

  /** What this side does when its time runs out, as the line that says so. */
  timeoutLine(need: Need): string {
    const b = this.b;
    if (need.kind === 'replace' || need.kind === 'replace2') {
      const f = b.s[this.side].f[passiveReplace(b, this.side)];
      return f ? `Time ran out, so ${who(f)} comes out.` : 'Time ran out.';
    }
    if (need.kind === 'visit' && b.visit) {
      const a = passiveVisit(b), f = visitorOf(b, b.visit), m = a.k === 'move' ? moveDef(f, a.i) : null;
      return m ? `Time ran out, so ${who(f)} casts ${m.name}.` : `Time ran out, so ${who(f)} casts nothing.`;
    }
    const a = passiveAction(b, this.side);
    return `Time ran out, so ${who(this.me())} ${a.k === 'guard' ? 'guards' : a.k === 'attack' ? 'attacks' : `uses ${describeAction(b, this.side, a)}`}.`;
  }

  /** The end as the room called it: who won the game, or the match after its last game, and why in one line. */
  finishNet(): void {
    if (this.outcome) return;
    const n = this.net!, e = n.end!, name = this.o.name, w = e.final ? e.matchWinner : e.winner;
    const won = w === this.side, lost = w === this.foe, what = e.final ? 'the match' : 'this game';
    const why = n.foul ? `The other side sent a choice this game cannot play: ${n.foul}`
      : e.why === 'resign' ? (won ? `${name} gave up.` : 'You gave up.')
      : e.why === 'timeouts' ? (won ? `${name} ran out of time three times in a row.` : 'Your time ran out three times in a row.')
      : e.why === 'gone' ? (won ? `${name} left the match.` : 'The link was cut.')
      : e.why === 'void' ? 'The match does not count.' : '';
    const head = won ? `You win ${what}.` : lost ? `${name} wins ${what}.` : 'No result.';
    this.endLines = [why ? `${head} ${why}` : head];
    this.outcome = { result: won ? 'win' : lost ? 'lose' : 'run', pegged: [], kos: this.b.stats.kos[this.foe], end: e };
    this.phase = 'end';
    this.timer = 0;
    this.sub = 0;
  }

  updateWait(): void {
    if (input.hit('left') || input.hit('right')) { this.showInfo(); return; }
    if (input.hit('back') && !this.net?.end) { sfx('ok'); this.backTo = 'wait'; this.phase = 'resign'; this.sub = 1; }
  }

  /** The give-up question: Give up sends the resignation, and Keep playing or X goes back. */
  updateResign(): void {
    if (input.hit('up') || input.hit('down')) { this.sub = 1 - this.sub; sfx('move'); }
    if (input.hit('back') || (input.hit('ok') && this.sub === 1)) { sfx('back'); this.phase = this.backTo; return; }
    if (!input.hit('ok')) return;
    sfx('ok');
    // Offline, giving up is a surrender: the battle ends as a loss.
    if (!this.net) { this.surrendered = true; this.b.over = 1; this.finishBattle(); return; }
    this.net.link.send({ type: 'resign' });
    this.phase = 'wait';
  }

  /** The clock to show: this side's while the player chooses, and the other side's while the player waits on it. */
  clockNow(): { left: number; total: number; mine: boolean } | null {
    const n = this.net, need = n?.need;
    if (!n || !need || n.end || need.kind === 'over' || this.phase === 'events' || this.phase === 'end' || this.enter > 0) return null;
    const waiting = this.phase === 'wait' || ((this.phase === 'info' || this.phase === 'resign') && this.backTo === 'wait');
    const mine = !waiting && n.chosen < n.ls.n && chooses(need, this.side);
    if (!mine && !chooses(need, this.foe)) return null;
    const c = n.clocks[mine ? this.side : this.foe];
    if (!c || c.n !== n.ls.n) return null;
    const total = (need.kind === 'replace' || need.kind === 'replace2' ? n.match.clock.replace : n.match.clock.choice) * 60;
    return { left: c.left, total, mine };
  }

  clockColor(c: { left: number; mine: boolean }): string { return c.left <= 600 ? WARN : c.mine ? MINE : THEIRS; }

  /** The standing line while a link is down: this side's own as it comes back, or the other side's with its hold counting down. */
  linkLine(): string {
    const n = this.net;
    if (!n || n.end) return '';
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, mine = n.link.slack?.() ?? 0;
    if (mine > 0) return `The byssus went slack. ${mmss(mine)}`;
    const held = n.awayUntil ? Math.max(0, Math.ceil((n.awayUntil - Date.now()) / 1000)) : 0;
    return held > 0 ? `${this.o.name} dropped. Held ${mmss(held)}` : '';
  }

  // ------------------------------------------------------------ draw

  draw(): void {
    pov = this.side;
    clear(INK);
    const slide = Math.max(0, this.enter) * 2;
    // What the pictures playing do to the whole scene: a shake, a wash of a move's color, a darkening, and a white flash.
    let jolt = 0, wash = 0, washC = PAPER, dark = 0, glare = 0;
    for (const r of this.runs) {
      const s = runScene(r);
      if (s.jolt) jolt = s.jolt;
      if (s.wash > wash) { wash = s.wash; washC = s.color; }
      dark = Math.max(dark, s.dark); glare = Math.max(glare, s.glare);
    }
    // The scene is drawn at half resolution and shown at double size, so backdrop and sloughs share one grid.
    // The past plays back in browns, and stays so while Still Minute's visitor waits there on its choice.
    const past = this.sepia || (!!this.b.visit && !this.b.visit.here && !this.queue.length && !this.cur);
    layer(past ? 'battle-past' : 'battle', SCENE_W, SCENE_H, jolt * 2, 0, 2, () => {
      paintBackdrop(this.o.scene || sceneNow.key, { t: this.t, loose: loosened(), dusk: sceneNow.dusk, map: G.map, heat: this.intensity(), lights: this.sceneLights(), figures: this.sceneFigures(slide) });
      const fd = this.fieldShown ? FIELDS[this.fieldShown] : null;
      if (fd) drawField(fd.id, this.t, fd.color || DIM);
      // Low Water: the sea has gone out, and wet sand shows along the bottom of the scene.
      if (this.b.lowWater) dither(0, SCENE_H - 7, SCENE_W, 7, '#c8b088', 0.5);
      // Wind: pale streaks blow across the scene toward the side it blows to, which stands on the right for the foe.
      const wd = this.b.wind;
      if (wd) for (let k = 0; k < 6; k++) {
        const run = (this.t * 1.5 + k * 37) % (SCENE_W + 6), y = 5 + (k * 11) % (SCENE_H - 10);
        rect(Math.round(wd.to === this.foe ? run - 6 : SCENE_W - run), y, 4, 1, '#e8f0f8');
      }
      // The swell: nine pips along the bottom of the scene, lit for each turn counted toward the ninth wave.
      const sw = this.b.swell;
      if (sw) for (let k = 0; k < 9; k++) rect(Math.floor(SCENE_W / 2) - 13 + k * 3, SCENE_H - 3, 2, 1, k < sw.n ? '#5ab0e8' : '#2c3a48');
      if (wash) dither(0, 0, SCENE_W, SCENE_H, washC, wash);
      if (dark) dither(0, 0, SCENE_W, SCENE_H, INK, dark);
      for (const r of this.runs) drawRun(r, 'under');
      this.drawGround(this.foe, FOE_AT[0] + slide, FOE_AT[1]);
      this.drawGround(this.side, MINE_AT[0] - slide, MINE_AT[1]);
      this.drawSide(this.foe, FOE_AT[0] + slide, FOE_AT[1]);
      this.drawSide(this.side, MINE_AT[0] - slide, MINE_AT[1]);
      this.drawDrops();
      this.drawShip();
      for (const r of this.runs) drawRun(r, 'over');
      if (glare) dither(0, 0, SCENE_W, SCENE_H, '#f8f4e8', glare);
      if (past) pastPalette();
    }, past);
    this.drawSideHud(this.foe, (FOE_AT[0] + slide) * 2, FOE_AT[1] * 2);
    this.drawSideHud(this.side, (MINE_AT[0] - slide) * 2, MINE_AT[1] * 2);
    this.drawTempo();
    this.drawLanes();
    this.drawPanel(this.foe, 2, 14);
    this.drawPanel(this.side, 86, 72);
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
      panel(96 - w / 2, 106, w, 12, SEL);
      textCenter(this.banner, 96, 108, SEL);
    }
    this.drawBottom();
    const ct = this.curtain;
    if (ct) dither(0, 0, 192, 192, INK, ct.ev ? ct.t / CURTAIN_OUT : 1 - (ct.t - CURTAIN_OUT) / CURTAIN_IN);
  }

  /** Where summon i of a side stands in scene pixels: the first two between its slough and the middle of the scene, the next two on its outer side, all clear of both panels. */
  summonAt(side: 0 | 1, i: number, x: number, y: number): [number, number] {
    const k = i % 2, inner = i < 2;
    const sx = side === this.side ? (inner ? x + 12 + k * 7 : x - 8 - k * 7) : (inner ? x - 7 - k * 7 : x + 11 + k * 7);
    return [sx, y + 3];
  }

  /** A summon as a scene figure: its own sprite, or a small box in its owner's colors. */
  summonFigure(side: 0 | 1, u: Summon, sx: number, sy: number): SceneFigure {
    const own = summonSprite(u.def, this.b.s[side].f[u.by]);
    const c = this.b.s[side].f[u.by].mon.sprite.c;
    const s: SpriteData = own || { px: ['........', '........', '........', '.11111..', '.12221..', '.12321..', '.12221..', '.11111..'], c: [c[0], c[1]] };
    return { s, x: sx - 1, y: sy - 3, flip: side === this.side && !!own, ground: sy + 5 };
  }

  /** Whether a side's out whorl is climbing into Still Minute's time machine or already inside it, so the field shows it nowhere. */
  boarded(side: 0 | 1): boolean {
    return this.ship?.at === 'board' && this.ship.side === side && this.ship.t >= HOP_FROM;
  }

  /**
   * Still Minute's time machine: it shows beside the caster, takes it aboard, and lifts off in the present, drops in beside its
   * side in the past, carries the visitor while it casts, trades seats with an ally, and flies off again.
   */
  drawShip(): void {
    const b = this.b;
    // With no events left to bring it (after a reload), a waiting visitor's machine rests in place, and never before its own beats.
    const settled = !this.queue.length && !this.cur;
    const sh = this.ship || (b.visit && !b.visit.here && settled ? { side: b.visit.side, at: 'arrive' as const, t: SHIP_LEN.arrive, rider: look(b.visit.body) } : null);
    if (!sh) return;
    const home = this.shipMid(sh.side), flip = sh.side === this.side, t = sh.t, sm = (u: number) => smooth(Math.max(0, Math.min(1, u)));
    let x = home.x, y = home.y, lv = 1, spin = t / 4, trail = 0;
    let rider: SpriteData | null = sh.rider;
    if (sh.at === 'board') {
      lv = Math.min(1, t / 8);
      shipRing(home.x, home.y, t);
      if (t < HOP_IN) rider = null;
      if (t >= HOP_FROM && t < HOP_IN) {
        // The caster hops from where it stands into the dome.
        const u = sm((t - HOP_FROM) / (HOP_IN - HOP_FROM)), [ox, oy] = atOf(sh.side);
        drawFighter(sh.rider, Math.round(ox + (home.x - 4 - ox) * u), Math.round(oy + (home.y - 5 - oy) * u - Math.sin(Math.PI * u) * 6), flip);
      }
      if (t >= HOP_IN && t < LIFT) x += (t >> 1) & 1 ? 1 : -1;
      if (t >= LIFT) { const u = (t - LIFT) / (SHIP_LEN.board - LIFT); y = home.y - Math.round(64 * u * u); trail = Math.min(14, (t - LIFT) * 2); spin = t; }
    } else if (sh.at === 'arrive') {
      // It drops in from above the scene and lands with a ring of time.
      const u = Math.min(1, t / 16);
      y = home.y - Math.round(52 * (1 - u) * (1 - u));
      trail = t < 16 ? 10 : 0;
      shipRing(home.x, home.y + 2, t - 16);
    } else if (sh.at === 'trade') {
      // The visitor steps out and the ally steps in: a ring of time, and the dome's rider changes.
      if (t < 10) rider = sh.old || sh.rider;
      shipRing(home.x, home.y, t - 8);
    } else {
      // It shakes, lifts, and flies off out of the scene.
      if (t < 8) x += (t >> 1) & 1 ? 1 : -1;
      else { const u = (t - 8) / (SHIP_LEN.depart - 8); y = home.y - Math.round(64 * u * u); trail = Math.min(14, (t - 8) * 2); spin = t; }
    }
    if (y < -16) return;
    shipBack(x, y, lv, spin);
    if (rider && lv >= 1) {
      const p = this.poseFor(sh.side, true);
      drawFighter(rider, x - 4 + (p?.pose.dx || 0), y - 5 + (p?.pose.dy || 0), flip, p?.pose.k ?? 1);
    }
    shipFront(x, y, lv);
    if (trail) shipTrail(x, y, trail, lv);
  }

  /** A side's out slough as a scene figure, or null when it is gone or knocked out. */
  outFigure(side: 0 | 1, x: number, y: number): SceneFigure | null {
    if (this.swaps[side] || this.boarded(side)) return null;
    const idx = this.outIdx[side];
    const d = this.disp[side][idx];
    if (d.gone || d.ko) return null;
    const mine = side === this.side;
    let dx = 0, dy = 0, flip = mine;
    if (d.shake > 0) dx = (d.shake % 4 < 2 ? -1 : 1) * (d.shake > HARD_SHAKE - 6 ? 2 : 1);
    if (d.shake > HARD_SHAKE - 6) dy += d.shake % 6 < 3 ? -1 : 1;
    if (d.off > 0) dx += Math.round((mine ? d.off : -d.off) / 2);
    // Range: at Near the two out whorls stand 4 pixels closer each, at Far 4 pixels farther apart.
    const rg = rangeOf(this.b);
    if (rg) dx += (rg === 'near' ? 4 : -4) * (mine ? 1 : -1);
    const p = this.poseFor(side);
    if (p) { dx += p.pose.dx; dy += p.pose.dy; if (p.pose.flip) flip = !flip; }
    // A whorl up off the ground hangs 4 pixels over its shadow.
    const up = this.b.s[side].f[idx].up ? 4 : 0;
    return { s: this.shownF(side, idx).sprite, x: x + dx, y: y + dy - up + (Math.floor(this.t / 30) % 2), flip, ground: y + 8 + Math.max(0, dy) };
  }

  /** Every slough and summon on screen this frame, for the scene's shadows. */
  sceneFigures(slide: number): SceneFigure[] {
    const out: SceneFigure[] = [];
    for (const side of [this.foe, this.side]) {
      const x = side === this.foe ? FOE_AT[0] + slide : MINE_AT[0] - slide, y = atOf(side)[1];
      this.shownSums(side).forEach((u, i) => { const [sx, sy] = this.summonAt(side, i, x, y); out.push(this.summonFigure(side, u, sx, sy)); });
      const o = this.outFigure(side, x, y);
      if (o) out.push(o);
    }
    return out;
  }

  /** A side's summons as shown: during a switch, the incoming whorl's summons wait until it pops out. */
  shownSums(side: 0 | 1): Summon[] {
    const sw = this.swaps[side], sum = this.shownSide(side).sum;
    return sw && !sw.popped ? sum.filter(u => u.by !== sw.to) : sum;
  }

  /** A ground under one side shows as a patch of its color under that side's whorl. */
  drawGround(side: 0 | 1, x: number, y: number): void {
    const g = this.b.s[side].ground, def = g ? GROUNDS[g.id] : null;
    if (!def) return;
    dither(x - 5, y + 7, 18, 3, def.color || DIM, 0.5);
    dither(x - 3, y + 6, 14, 1, def.color || DIM, 0.25);
  }

  /** Drops lie in the middle of the field between the two sides, each bobbing on its own beat. */
  drawDrops(): void {
    (this.b.drops || []).forEach((d, i) => {
      const s: SpriteData = DROPS[d.id]?.sprite || { px: ['........', '........', '...22...', '..2332..', '..2332..', '...22...', '........', '........'], c: ['#d8c060', '#f0e0a0'] };
      drawFighter(s, 40 + i * 9, 25 + (Math.floor((this.t + i * 13) / 30) % 2), false);
    });
  }

  /** A drop's rule and the rounds it has left, for the menu's detail. */
  dropText(uid: number): string {
    const d = (this.b.drops || []).find(x => x.uid === uid), dd = d ? DROPS[d.id] : null;
    if (!d || !dd) return '';
    const left = Math.ceil(d.turns);
    return `Spends your turn. ${dd.text} Either side may take it. Gone in ${left} round${left > 1 ? 's' : ''}.`;
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
    if (forced && said?.snap) { this.show(said.snap); this.laneQ.push(said.snap); }
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
    const back = side === this.side ? -1 : 1, flip = side === this.side;
    if (sw.t < SW_LEAVE) {
      const d = this.disp[side][sw.from], u = smooth(sw.t / SW_LEAVE);
      if (d.gone) return;
      if (d.ko) { dither(x, y, 8, 8, INK, 0.4 * (1 - u)); return; }
      const dx = Math.round(back * (sw.forced ? 12 : 3) * u);
      if (sw.forced) for (let j = 0; j < 3; j++) {
        const len = Math.max(1, Math.round((4 - j) * (1 - u) * 1.5));
        rect(back < 0 ? x + dx + 9 : x + dx - 1 - len, y + 2 + j * 2, len, 1, mix(PAPER, INK, 0.55));
      }
      drawFighter(this.shownF(side, sw.from).sprite, x + dx, y, flip, sw.forced ? 1 - 0.5 * u : 1 - u);
      return;
    }
    if (sw.t < SW_LEAVE + SW_PAUSE) return;
    const u = Math.min(1, (sw.t - SW_LEAVE - SW_PAUSE) / SW_ENTER);
    const k = u < 0.55 ? 1.25 * smooth(u / 0.55) : 1.25 - 0.25 * smooth((u - 0.55) / 0.45);
    drawFighter(this.shownF(side, sw.to).sprite, x, y, flip, k);
  }

  drawSide(side: 0 | 1, x: number, y: number): void {
    const d = this.disp[side][this.outIdx[side]];
    this.drawSummons(side, x, y);
    const sw = this.swaps[side];
    if (sw) { this.drawSwap(side, sw, x, y); return; }
    if (d.gone || this.boarded(side)) return;
    if (d.ko) {
      dither(x, y, 8, 8, INK, 0.4);
      return;
    }
    const fg = this.outFigure(side, x, y)!;
    const f = this.b.s[side].f[this.outIdx[side]], flash = d.white > 0 || (d.flash > 0 && d.flash % 4 < 2), star = !!f.mon.starborn && !flash;
    const sf = this.shownF(side, this.outIdx[side]), p = this.poseFor(side);
    // A hidden whorl shows only through a thin dither, and a blink fades its user out and back.
    const vis = Math.min(p ? p.pose.vis : 1, sf.s.hidden ? 0.375 : 1), k = p ? p.pose.k : 1;
    if (star && vis >= 1) drawAura(ctx, fg.s, fg.x, fg.y, this.t, f.mon.uid % 97, true, fg.flip);
    if (flash) drawSprite(fg.s, fg.x, fg.y, 1, fg.flip, '#f8f4e8');
    else if (vis < 1) { if (vis > 0) fadedScene(8, 8, fg.x, fg.y, vis, () => drawFighter(fg.s, 0, 0, fg.flip, k)); }
    else if (p?.pose.glow) drawSprite(fg.s, fg.x, fg.y, 1, fg.flip, p.run.tone.light);
    else drawFighter(fg.s, fg.x, fg.y, fg.flip, k);
    if (star && vis >= 1) drawAura(ctx, fg.s, fg.x, fg.y, this.t, f.mon.uid % 97, false, fg.flip);
    if (vis > 0) for (const id of Object.keys(sf.s)) drawStatus(id, fg.x, fg.y, this.t + side * 17, side === this.side);
    if (vis > 0 && deaf(this.b, f)) drawStatus('deaf', fg.x, fg.y, this.t + side * 17, side === this.side);
    if (vis >= 1) {
      // Carcanet's collar rides on the sprite and fills setting by setting with the Stones shown so far.
      if (f.mon.kind === 'carcanet' || f.mon.passives.includes('carc_tape')) {
        heldCollar({ x: fg.x + 4, y: fg.y + 4 }, ['carc_pearl', 'carc_amber', 'carc_glass', 'carc_star'].map(k => !!sf.m[k]), this.runs, side);
      }
      this.drawTelegraph(f, fg.x, fg.ground);
    }
  }

  /** Telegraph: the gems a whorl will set off on its own, as small crosses in a row under it, next first and blinking. */
  drawTelegraph(f: Fighter, x: number, ground: number): void {
    const fl = foretold(this.b, f).slice(0, 4);
    if (!fl.length) return;
    const left = x + 4 - Math.floor((fl.length * 4 - 1) / 2), y = ground + 3;
    fl.forEach((g, k) => {
      const gx = left + k * 4, c = k > 0 || this.t % 30 < 20 ? g.color : mix(g.color, INK, 0.45);
      rect(gx + 1, y, 1, 3, c);
      rect(gx, y + 1, 3, 1, c);
      rect(gx + 1, y + 1, 1, 1, mix(c, PAPER, 0.55));
    });
  }

  /** Wind-up markers beside an out slough, in screen pixels. Guard shows in the scene at the sprite's scale and on the HP panel. */
  drawSideHud(side: 0 | 1, x: number, y: number): void {
    const idx = this.outIdx[side];
    const d = this.disp[side][idx];
    if (d.gone || d.ko) return;
    const pend = this.snapNow().wind.find(p => p.side === side && p.idx === idx);
    if (pend && this.t % 20 < 14) text('!', x + 6, y - 10, SEL, INK);
    // A reach shift waiting on its next move: arrows out for wide, arrows in for tight.
    const rf = this.b.s[side].f[idx].reach;
    if (rf) text(rf.mode === 'wide' ? '<>' : '><', x - 9, y - 1, NERVE, INK);
  }

  /** How many turns `side` takes before time `at` as shown so far, counting a turn it is taking now. */
  turnsBefore(side: 0 | 1, at: number): number {
    const s = this.snapNow();
    let nx = s.next[side], n = 0;
    while (nx < at && n < 9 && s.step[side] > 0) { n++; nx += s.step[side]; }
    return n;
  }

  /** Tempo line: wind-ups in flight and double turns. Only shown when it says something. */
  drawTempo(): void {
    rect(0, 0, 192, 11, INK);
    const b = this.b;
    let note = '', short = '';
    let col = DIM;
    const wind = this.snapNow().wind[0];
    if (wind) {
      const name = MOVES[wind.move]?.name || 'It';
      const other = (1 - wind.side) as 0 | 1;
      const n = this.turnsBefore(other, wind.at);
      if (wind.side === this.foe) note = n === 0 ? `! ${name} lands before you move` : `! ${name}: you get ${n} move${n > 1 ? 's' : ''} first`;
      else note = n === 0 ? `${name} lands before they move` : `${name}: they get ${n} move${n > 1 ? 's' : ''} first`;
      col = wind.side === this.foe ? SEL : MINE;
    } else {
      // Only while you choose: the check compares turns from the move you are about to make.
      const twice = this.choosing() ? this.actsTwice() : null;
      const foe = who(this.b.s[this.foe].f[this.b.s[this.foe].out]), me = who(this.me());
      if (this.choosing() && this.visiting()) {
        // Still Minute's visitor picks what it casts, in the past or, with no past to go to, here.
        const back = b.visit!.back;
        note = b.visit!.here ? `${who(this.actor())} casts here: pick a move` : `${back} round${back > 1 ? 's' : ''} back: pick a move to cast`;
        short = b.visit!.here ? 'Pick a move' : `${back} round${back > 1 ? 's' : ''} back`;
        col = SEL;
      } else if (this.choosing() && b.need?.kind === 'joint' && this.jointAi && foresees(b, this.side)) {
        // Foresight: the player sees what the foe chose before choosing.
        note = `${foe} will: ${describeAction(b, this.foe, this.jointAi)}`;
        short = `Sees: ${describeAction(b, this.foe, this.jointAi)}`;
        col = SEL;
      } else if (this.choosing() && b.need?.kind === 'joint') {
        const lead = roundLead(b);
        note = `Both choose. ${lead === this.side ? me : foe} goes first`;
        short = `${lead === this.side ? me : foe} goes first`;
        col = lead === this.side ? MINE : THEIRS;
      } else if (twice === this.foe) { note = `${foe} moves twice this turn`; col = THEIRS; }
      else if (twice === this.side) { note = `${me} moves twice this turn`; col = MINE; }
    }
    // A link that is down stands in front of every other note until it comes back or the hold runs out.
    const down = this.linkLine();
    if (down) { note = short = down; col = WARN; }
    // An online battle's turn clock sits at the far right, and the field state moves left of it.
    const ck = this.clockNow(), secs = ck ? `${Math.ceil(ck.left / 60)}s` : '';
    const edge = secs ? 189 - textWidth(secs) - 6 : 189;
    if (ck) textRight(secs, 189, 2, this.clockColor(ck));
    // The field state sits at the right end with the rounds it has left, short to its name when room runs out.
    const fd = this.fieldShown ? FIELDS[this.fieldShown] : null;
    const right = this.o.practice ? 'V debug' : fd ? (b.field?.id === fd.id ? `${fd.name} ${b.field.turns}` : fd.name) : '';
    const rc = this.o.practice ? (this.debugAsk ? SEL : '#4a4660') : fd?.color || DIM;
    if (short && (right || secs) && 3 + textWidth(note) + 6 > edge - (right ? textWidth(right) : 0)) note = short;
    const left = text(note || this.o.name, 3, 2, note ? col : DIM);
    if (right && left + 6 <= edge - textWidth(right)) textRight(right, edge, 2, rc);
    else if (fd && !this.o.practice && left + 6 <= edge - textWidth(fd.name)) textRight(fd.name, edge, 2, rc);
    // The battle clock, while a whorl keeps one, sits left of the field state.
    if (b.clock != null) {
      const m = Math.floor(b.clock) % 1440, clk = `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}`;
      const rx = right ? edge - textWidth(right) - 6 : edge;
      if (left + 6 <= rx - textWidth(clk)) textRight(clk, rx, 2, '#c8b070');
    }
  }

  /** Moves the speed lanes one frame: queued clock changes play one at a time, and the drawn clock follows at a steady pace. */
  tickLanes(): void {
    const b = this.b, sp = this.speed();
    if (this.laneT < 0) {
      b.lanes = true;
      const s = snapOf(b);
      this.show(s);
      this.laneT = this.laneGoal = s.t;
      this.laneLast = s;
      this.lanes = ([0, 1] as const).map(sd => ({ out: s.out[sd], next: s.next[sd], step: s.step[sd], fromNext: s.next[sd], fromStep: s.step[sd], glide: 0, past: [], oldNext: 0, oldStep: 0, fade: 0, feed: 0, brk: 0, brkNext: 0, brkStep: 0, broke: false }));
      this.laneSpan = Math.max(200, Math.min(700, 3.5 * Math.max(s.step[0], s.step[1], 100)));
      return;
    }
    // Once every event has played, the live battle is what the screen shows, and its clock is the last change for the lanes.
    if (!this.queue.length && !this.cur) {
      const s = snapOf(b);
      this.show(s);
      // Every event has played, so the end state is safe to show: this clears anything no event reports, such as an expired shield.
      if (!this.swaps[0] && !this.swaps[1]) b.s.forEach((sd, si) => sd.f.forEach((f, fi) => { const d = this.disp[si][fi]; d.hp = f.hp; d.shield = f.shield; d.ko = f.ko; d.gone = f.gone; }));
      if (!sameLane(s, this.laneLast)) { this.laneQ.push(s); this.laneLast = s; }
    }
    // A switch's marks wait while the lanes are hidden, so the new whorl's marks dither in once the lane shows again.
    const hidden = this.laneDown(0) || this.laneDown(1);
    for (const L of this.lanes) {
      L.glide = Math.max(0, L.glide - sp);
      L.brk = Math.max(0, L.brk - sp);
      if (hidden) continue;
      if (L.fade > 0) L.fade = Math.max(0, L.fade - sp); else L.feed = Math.max(0, L.feed - sp);
    }
    this.laneBusy -= sp;
    while (this.laneBusy <= 0 && this.laneQ.length) this.laneBusy = this.applyLane(this.laneQ.shift()!);
    const lag = this.laneGoal - this.laneT;
    // While the lanes are hidden after a knockout the clock jumps ahead, so it never races across the tape when they return.
    if (hidden) this.laneT = Math.max(this.laneT, this.laneGoal);
    else if (lag > 0) this.laneT += Math.min(lag, Math.max(3, lag / 40) * sp);
    for (const L of this.lanes) L.past = L.past.filter(t => t >= this.laneT);
  }

  /** Starts one queued clock change and returns how many frames it takes. */
  applyLane(s: Snap): number {
    this.laneGoal = Math.max(this.laneGoal, s.t);
    let busy = 0;
    for (const sd of [0, 1] as const) {
      const L = this.lanes[sd];
      // A knocked-out whorl has no turns to space: its lane keeps its marks until the knockout plays and the lane hides.
      if (s.out[sd] === L.out && s.step[sd] <= 0) continue;
      if (s.out[sd] !== L.out) {
        // A switch: the old whorl's marks dither out where they stand, then the new whorl's marks dither in at their places.
        // A knocked-out whorl's marks have already broken apart, so only the new ones come in.
        const gone = L.broke;
        Object.assign(L, { out: s.out[sd], oldNext: L.next, oldStep: L.step, fade: gone ? 0 : LANE_FADE, feed: LANE_FEED, glide: 0, past: [], next: s.next[sd], step: s.step[sd], fromNext: s.next[sd], fromStep: s.step[sd], brk: 0, broke: false });
        busy = Math.max(busy, (gone ? 0 : LANE_FADE) + LANE_FEED);
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

  /** Whether a side's lane is hidden: its shown whorl is gone, or knocked out with the knockout already played on screen. */
  laneDown(sd: 0 | 1): boolean {
    const d = this.disp[sd][this.outIdx[sd]];
    return !d || d.gone || (d.ko && !(this.cur?.e === 'ko' && this.cur.side === sd));
  }

  /** A knocked-out whorl's marks start to break apart while its knockout plays. */
  breakLane(sd: 0 | 1, idx: number): void {
    const L = this.lanes[sd];
    if (L && L.out === idx) Object.assign(L, { brk: LANE_BREAK, brkNext: L.next, brkStep: L.step, broke: true });
  }

  /** Speed lanes: each out whorl's coming turns as marks on the battle clock, the foe above and yours below. */
  drawLanes(): void {
    if (this.laneT < 0 || this.phase === 'end' || this.laneDown(0) || this.laneDown(1)) return;
    rect(LANE_X - 4, LANE_Y, LANE_W + 7, 13, INK);
    rect(LANE_X - 2, LANE_Y + 2, 1, 9, mix(DIM, INK, 0.4));
    for (const sd of [this.foe, this.side]) {
      const L = this.lanes[sd], ly = LANE_Y + (sd === this.foe ? 2 : 7), c = sd === this.side ? MINE : THEIRS;
      // A lane that is changing lights up for the length of the change.
      const lit = Math.max(L.glide / LANE_GLIDE, L.fade > 0 ? 1 : L.feed / LANE_FEED);
      rect(LANE_X, ly + 3, LANE_W, 1, mix(c, INK, 0.75 - 0.35 * lit));
      for (const t of L.past) this.laneMark(t, ly, false, mix(c, INK, 0.4));
      if (L.broke) { if (L.brk > 0) this.breakRow(L, ly, c); continue; }
      if (L.fade > 0) {
        // The leaving whorl's marks dither out quickly, and the lane waits empty for the whorl coming in.
        const a = 1 - (LANE_FADE - L.fade) / LANE_OUT;
        if (a > 0) this.laneRow(L.oldNext, L.oldStep, ly, c, mix(c, INK, 0.4), a);
        continue;
      }
      const u = L.glide > 0 ? smooth(1 - L.glide / LANE_GLIDE) : 1;
      const a = L.feed > 0 ? Math.min(1, (LANE_FEED - L.feed) / LANE_IN) : 1;
      const glow = L.glide > 0 ? mix(c, PAPER, 0.4 * L.glide / LANE_GLIDE) : c;
      this.laneRow(L.fromNext + (L.next - L.fromNext) * u, L.fromStep + (L.step - L.fromStep) * u, ly, glow, mix(glow, INK, 0.4), a);
    }
  }

  /** A knocked-out whorl's marks breaking apart: each pixel drifts and drops as it dithers away, inside the lane's strip. */
  breakRow(L: Lane, ly: number, c: string): void {
    const u = 1 - L.brk / LANE_BREAK;
    for (let k = 0, t = L.brkNext; k < 12 && L.brkStep > 0; k++, t += L.brkStep) {
      const p = (t - this.laneT) / this.laneSpan;
      if (p > 1) break;
      if (p < 0) continue;
      const x = LANE_X + Math.round(p * (LANE_W - 1)), tall = k === 0, y0 = tall ? ly : ly + 1;
      for (let r = 0; r < (tall ? 4 : 3); r++) {
        const s = Math.sin((k * 7 + r + 1) * 12.9898) * 43758.5453, j = s - Math.floor(s);
        const dx = Math.round((j - 0.5) * 6 * u), y = Math.min(LANE_Y + 11, y0 + r + Math.round(u * u * (2 + 4 * j)));
        dither(x + dx, y, 1, 1, tall ? c : mix(c, INK, 0.4), 1 - u);
      }
    }
  }

  /** One lane's coming turns from `next` and every `step` after it, cut at the lane's right end, at `a` from clear to full. */
  laneRow(next: number, step: number, ly: number, first: string, rest: string, a = 1): void {
    for (let k = 0, t = next; k < 12; k++, t += step) {
      if (!this.laneMark(t, ly, k === 0, k === 0 ? first : rest, a) || step <= 0) break;
    }
  }

  /** Draws one mark at clock time t, dithered when `a` is under 1, or returns false once that time is past the lane's right end. */
  laneMark(t: number, ly: number, tall: boolean, c: string, a = 1): boolean {
    const p = (t - this.laneT) / this.laneSpan;
    if (p > 1) return false;
    const x = LANE_X + Math.round(p * (LANE_W - 1));
    if (x > LANE_X + LANE_W - 1) return false;
    if (p >= 0) {
      if (a >= 1) rect(x, tall ? ly : ly + 1, 1, tall ? 4 : 3, c);
      else dither(x, tall ? ly : ly + 1, 1, tall ? 4 : 3, c, a);
    }
    return true;
  }

  /** Whether the player is picking an action right now. */
  choosing(): boolean {
    return ['menu', 'target', 'tagto', 'aim', 'switch', 'peg', 'info', 'tip', 'opt', 'vpick'].includes(this.phase) && !(this.phase === 'info' && this.backTo === 'wait');
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
    // Names, types, statuses, marks, caps, and tide come from the events played so far, never from the end of the turn.
    const sf = this.shownF(side, idx), ss = this.shownSide(side), mine = side === this.side;
    panel(x, y, 104, 35, mine ? MINE : THEIRS);
    const lv = fightLevel(this.b.rules, f.mon);
    const nameEnd = text(sf.name, x + 3, y + 2, PAPER);
    textRight(`L${lv}`, x + 101, y + 2, DIM);
    // The type sigils follow the name on its row, clear of a descender.
    let tx = nameEnd + 3;
    for (const t of sf.types) { miniSigil(t as Type, tx, y + 3); tx += 7; }
    // Two actions this turn: an "x2" beside the level that brightens and dims slowly, left out when a long name reaches it.
    const x2 = x + 101 - textWidth(`L${lv}`) - 4;
    if (this.choosing() && !this.b.pend.some(p => p.kind === 'windup') && this.actsTwice() === side && tx + 1 < x2 - textWidth('x2')) {
      const lit = (Math.sin(this.t / 14) + 1) / 2 > 0.35;
      textRight('x2', x2, y + 2, lit ? (mine ? MINE : THEIRS) : DIM);
    }
    // The HP bar carries a line only for a ground that marks one, such as a rising line under this side.
    const gd = this.b.s[side].ground, line: number | null = gd ? GROUNDS[gd.id]?.line?.(this.b, side) ?? null : null;
    // A hidden foe shows no HP, statuses, or marks.
    const veiled = !mine && !!sf.s.hidden;
    let hpEnd: number;
    if (veiled) { rect(x + 3, y + 15, 98, 5, INK); hpEnd = text('hidden', x + 3, y + 21, DIM); statusIcon('hidden', hpEnd + 4, y + 22); }
    else {
      // A mirage: the foe's bar and number show its HP plus the mirage, and your own whorl's bar shows the mirage as a pale haze past its HP.
      const mir = f.mirage && d.hp > 0 ? f.mirage.hp : 0, seenHp = !mine ? Math.min(f.maxHp, d.hp + mir) : d.hp;
      hpBar(x + 3, y + 15, 98, seenHp, f.maxHp, d.shield + (this.b.s[side].mantle?.hp || 0), null, line);
      if (mir && mine && d.hp < f.maxHp) dither(x + 3 + Math.round(98 * d.hp / f.maxHp), y + 15, Math.max(1, Math.round(98 * Math.min(f.maxHp - d.hp, mir) / f.maxHp)), 5, '#bfe8ff', 0.5);
      if (mir && !mine && this.t % 30 < 15) dither(x + 3, y + 15, Math.max(1, Math.round(98 * seenHp / f.maxHp)), 1, '#bfe8ff', 0.5);
      // A flock: thin dark ticks split the HP bar into its bodies.
      if (f.flock) for (let k = f.flock.body; k < f.maxHp; k += f.flock.body) rect(x + 3 + Math.round(98 * k / f.maxHp), y + 15, 1, 5, INK);
      // Poise: an amber strip along the top of the HP bar, as long as the poise left.
      if (f.poise) rect(x + 3, y + 15, Math.max(1, Math.round(98 * Math.min(1, f.poise / f.maxHp))), 1, '#e8a840');
      // A fracture: a red crack across the HP bar at the line heals cannot pass.
      if (f.fracture && f.fracture.cap < 1) rect(x + 3 + Math.round(98 * f.fracture.cap), y + 15, 1, 5, '#e05050');
      hpEnd = text(`${Math.max(0, Math.ceil(seenHp))}/${f.maxHp}`, x + 3, y + 21, DIM);
      // Statuses and marks sit at the right end of the HP numbers row, clear of the bar and the name, newest leftmost.
      const icons: [number, (ix: number) => void][] = [];
      for (const k of Object.keys(sf.s)) icons.push([6, ix => { statusIcon(k, ix, y + 22); }]);
      for (const k of Object.keys(sf.m)) {
        const md = MARKS[k];
        if (!md?.name) continue;
        const n = sf.m[k];
        icons.push([n > 1 ? 7 + textWidth(String(Math.min(9, n))) : 6, ix => markIcon(ix, y + 22, md.color || (md.negative ? BADC : SEL), n)]);
      }
      // A whorl whose next attack or move a cave will take in: a dark blue mark.
      if (f.takeIn) icons.push([6, ix => markIcon(ix, y + 22, '#4a6a9a', 1)]);
      // Deaf from a foe's hook rather than a mark: the same gray mark.
      if (deaf(this.b, f) && !Object.keys(sf.m).some(k => MARKS[k]?.deaf)) icons.push([6, ix => markIcon(ix, y + 22, '#9a9ab8', 1)]);
      // Silent: a pale violet mark while nobody hears what it does.
      if (silent(this.b, f)) icons.push([6, ix => markIcon(ix, y + 22, '#c8b8e8', 1)]);
      // Drunk from: a root-green mark while a foe drinks its heals.
      if (drinkerOf(this.b, f)) icons.push([6, ix => markIcon(ix, y + 22, '#5aa05a', 1)]);
      let ix = x + 102;
      for (const [w, draw] of icons) { if (ix - w < hpEnd + 4) break; ix -= w; draw(ix); }
    }
    // The team as small shells, then any caps laid under this side, then the tide gauge on the right.
    let rx = x + 3;
    const ry = y + 29;
    // A whorl a foe keeps its bearing on: its shell blinks gold.
    const fo = this.b.s[1 - side].f[this.b.s[1 - side].out], aimed = fo && !fo.ko ? aimOf(this.b, fo) : null;
    const watch = watchers(this.b, side);
    s.f.forEach((g, i) => {
      const dd = this.disp[side][i];
      // A buried reserve's shell turns the color of sand, and one in cold storage the color of frost.
      teamShell(rx, ry, dd.gone ? DIM : dd.ko ? '#4a4450' : g === aimed && this.t % 40 < 20 ? '#f0b22c' : i === idx ? PAPER : g.stored ? '#a8d8f0' : barred(g) ? '#c9a66b' : (mine ? MINE : THEIRS));
      // A whorl an orbiting mark sits on: a small gold planet circles over its shell.
      if (!dd.ko && Object.keys(g.m).some(k => MARKS[k]?.orbit)) rect(rx + [0, 1, 2, 1][Math.floor(this.t / 8) % 4], ry - 1, 1, 1, '#f0d060');
      // A whorl riding a foe: a dark red heart in its shell, and a red dot over the shell of the foe it rides.
      if (g.gone && g.latch) rect(rx + 1, ry + 1, 2, 2, '#a02838');
      // A fallen whorl that glows on: a pale halo over its shell.
      if (g.ko && g.glow) rect(rx, ry - 1, 4, 1, '#f8eec0');
      if (!dd.ko && this.b.s[1 - side].f.some(x => x.gone && x.latch === side * 8 + i + 1)) rect(rx + 3, ry - 1, 1, 1, '#d04050');
      // A reserve watching over its out ally: a green leaf over its shell.
      if (!dd.ko && watch.includes(g)) rect(rx + 1, ry - 1, 2, 1, '#6ac86a');
      rx += 5;
    });
    // An out whorl covering its bench: a pale line over the reserve shells it stands in front of.
    if (covering(this.b, side) && s.f.length > 1) rect(x + 3, ry - 1, s.f.length * 5 - 1, 1, '#d8e8f8');
    // A side cut off from its bench: a line through its team row.
    if (this.b.s[side].cut) rect(x + 2, ry + 1, rx - x - 2, 1, BADC);
    // Fog over the bench: a gray haze across the reserve shells.
    if (this.b.s[side].fog) dither(x + 2, ry - 1, rx - x - 2, 6, '#b8c0c8', 0.375);
    // A spinning side: a small ring that turns after its team row.
    if (this.b.s[side].spin) {
      const a = Math.floor(this.t / 6) % 8;
      [[1, 0], [2, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 2], [0, 1]].forEach(([dx, dy], k) => { if (k !== a) rect(rx + 1 + dx, ry + dy, 1, 1, k === (a + 7) % 8 ? PAPER : TYPE_COLOR.TIDE); });
      rx += 6;
    }
    // A side shut in: a small brown door with a gold knob after its team row.
    if (this.b.s[side].shut) { rect(rx + 1, ry - 1, 3, 5, '#8a5a3a'); rect(rx + 3, ry + 1, 1, 1, '#f0d060'); rx += 5; }
    for (let k = 0; k < Math.min(4, ss.caps); k++) capIcon(rx + 2 + k * 4, ry + 2);
    // A house: a small house after the team row, its floor filling blue with the HP it holds.
    const hcap = houseCap(this.b, side);
    if (hcap > 0) {
      const hx = rx + 2 + Math.min(4, ss.caps) * 4;
      rect(hx + 2, ry - 1, 1, 1, '#c8906a'); rect(hx + 1, ry, 3, 1, '#c8906a'); rect(hx, ry + 1, 5, 3, '#6a4a3a');
      const fill = Math.round(5 * Math.min(1, (this.b.s[side].pool || 0) / hcap));
      if (fill) rect(hx, ry + 3, fill, 1, '#5ab0e8');
    }
    // A bout: two pips left of the tide gauge, lit for the rounds this side has won.
    if (inBout(this.b, f)) for (let k = 0; k < 2; k++) rect(x + 101 - 66 + k * 4, ry + 1, 3, 2, k < this.b.bout!.score[side] ? '#f0d060' : DIM);
    if (this.b.rules.nerve) tideGauge(x + 101 - 57, ry - 1, ss.nerve, 10);
    // Pink tide: the top pips of the gauge turn pink.
    const pk = this.b.rules.nerve ? Math.min(pinkOf(this.b, side), ss.nerve) : 0;
    for (let k = ss.nerve - pk; k < ss.nerve; k++) { const px0 = x + 101 - 57 + 7 + k * 5, py0 = ry - 1 + 2; rect(px0 + 1, py0, 2, 1, PINK_TIDE); rect(px0, py0 + 1, 1, 1, PINK_TIDE); rect(px0 + 3, py0 + 1, 1, 1, PINK_TIDE); }
    // Tide in debt: the first pips turn red, one for each tide owed.
    if (this.b.rules.nerve && ss.nerve < 0) for (let k = 0; k < Math.min(10, -ss.nerve); k++) { const px0 = x + 101 - 57 + 7 + k * 5, py0 = ry - 1 + 2; rect(px0 + 1, py0, 2, 1, BADC); rect(px0, py0 + 1, 1, 1, BADC); rect(px0 + 3, py0 + 1, 1, 1, BADC); }
    // A tide held in the foe's hold: a nail through the gauge.
    if (this.b.rules.nerve && this.b.s[side].hold) { rect(x + 101 - 52, ry + 1, 51, 1, BADC); rect(x + 101 - 52, ry - 1, 1, 5, BADC); }
  }

  drawBottom(): void {
    panel(0, 120, 192, 72, undefined, { shadow: false });
    // An online battle's turn clock drains along the panel's top edge from right to left.
    const ck = this.clockNow();
    if (ck) { rect(0, 120, 192, 2, '#2a2632'); rect(0, 120, Math.round(192 * Math.min(1, ck.left / ck.total)), 2, this.clockColor(ck)); }
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
    if (this.phase === 'wait') {
      text(this.net?.end || this.net?.need?.kind === 'over' ? 'The battle is over.' : `Waiting for ${this.o.name}.`, 6, 124, PAPER);
      text('L/R habits. X gives up.', 6, 182, DIM);
      return;
    }
    if (this.phase === 'resign') {
      text(this.net ? 'Give up this match?' : 'Surrender this battle?', 6, 124, SEL);
      (this.net ? ['Give up', 'Keep playing'] : ['Surrender', 'Keep fighting']).forEach((l, i) => {
        if (i === this.sub) cursor(6, 134 + i * 10);
        text(l, 14, 134 + i * 10, i === this.sub ? SEL : PAPER);
      });
      return;
    }
    if (this.phase === 'replace') {
      text('Send out who?', 6, 124, SEL);
      standing(this.b.s[this.side]).forEach((f, i) => this.drawMonRow(f, 6, 134 + i * 10, i === this.sub));
      return;
    }
    if (this.phase === 'switch') {
      text('Switch to?', 6, 124, SEL);
      reserves(this.b.s[this.side]).forEach((f, i) => this.drawMonRow(f, 6, 134 + i * 10, i === this.sub));
      const pick = reserves(this.b.s[this.side])[this.sub];
      if (pick) {
        this.drawMovesSmall(pick, 112, 134);
        const w = switchWeight(this.b, pick);
        textRight(barred(pick) ? 'Buried' : calledOf(this.b.s[this.side]) === pick ? 'Next out' : `Waits ${this.b.s[this.side].charm === 'tusk' ? Math.round(w * 0.8) : w}%`, 186, 124, DIM);
      }
      return;
    }
    if (this.phase === 'opt') {
      const m = this.pendingMove ? moveDef(this.me(), this.pendingMove.i) : null;
      text(`${m?.name || ''}: which?`, 6, 124, SEL);
      this.optLabels().forEach((l, i) => {
        if (i === this.sub) cursor(6, 134 + i * 10);
        text(l, 14, 134 + i * 10, i === this.sub ? SEL : PAPER);
      });
      return;
    }
    if (this.phase === 'vpick') {
      const m = moveDef(this.actor(), this.vslot);
      text(`${m?.name || ''}: how?`, 6, 124, SEL);
      this.visitWays(this.vslot).forEach((w, i) => {
        if (i === this.sub) cursor(6, 134 + i * 10);
        text(w.label, 14, 134 + i * 10, i === this.sub ? SEL : PAPER);
      });
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
        this.drawMonRow(f, 6, 134 + i * 10, i === this.sub, t.side !== this.side);
      });
      return;
    }
    if (this.phase === 'peg') {
      text('Which horn?', 6, 124, SEL);
      const foe = this.b.s[this.foe].f[this.b.s[this.foe].out];
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
    const f = this.actor(), visitor = this.visiting(), div = this.menuDivider();
    const top = Math.max(0, Math.min(this.sel - MENU_ROWS + 2, this.options.length - MENU_ROWS));
    this.options.forEach((o, i) => {
      if (i < top || i >= top + MENU_ROWS) return;
      const y = MENU_Y + (i - top) * 9, on = i === this.sel;
      if (on) cursor(3, y);
      const c = o.ok ? (on ? SEL : PAPER) : (on ? '#8a7a50' : DIM);
      const end = text(fitTo(o.label, div - 20), 17, y, c);
      if (o.kind !== 'move' || o.hidden) return;
      // A move's slot: its type sigil before the name, and at the right end its turns left, or the tide mark of a crest.
      // A name too long to leave room for the mark goes without it, since the detail shows both.
      const m = moveDef(f, o.i!)!;
      miniSigil(this.typeOfMove(f, m), 10, y + 1);
      // A visitor casts with no cooldowns, so its rows show none.
      if (visitor) return;
      // A move with shots shows how many are left while it is ready.
      const cd = f.cd[o.i!] > 0 ? String(f.cd[o.i!]) : m.ammo ? `x${ammoOf(f, o.i!)}` : '';
      const markX = cd ? div - 3 - textWidth(cd) : div - 8;
      if (end + 2 > markX) return;
      if (cd) textRight(cd, div - 3, y, f.cd[o.i!] > 0 ? DIM : SEL);
      else if (isBig(m)) tideIcon(markX, y + 1, this.b.rules.nerve && this.b.s[this.side].nerve >= (m.nerve || 0) ? NERVE : DIM);
    });
    rect(div, 123, 1, 66, '#3a3442');
    // Scroll marks: small notches on the divider at whichever end has more.
    if (top > 0) for (let k = 0; k < 3; k++) rect(div - k, 125 - k, 1 + k * 2, 1, DIM);
    if (top + MENU_ROWS < this.options.length) for (let k = 0; k < 3; k++) rect(div - k, 184 + k, 1 + k * 2, 1, DIM);
    this.drawDetail(this.options[this.sel]);
  }

  typeOfMove(f: Fighter, m: MoveDef): Type {
    return moveType(f, m);
  }

  /** The menu's divider: at 90 unless a name needs more, then as far right as 112, so every name keeps 3 pixels clear of it. */
  menuDivider(): number {
    let need = 0;
    for (const o of this.options) need = Math.max(need, 17 + textWidth(o.label) + 3);
    return Math.max(DIVIDER, Math.min(112, need));
  }

  /**
   * The picked action, in three parts on a 9-pixel grid: a header with the type and the move's cooldown and tide cost as
   * icons, the rules text, and a footer that says why it cannot be used or what bonus it gets against the foe.
   */
  drawDetail(o: BattleView['options'][number] | undefined): void {
    if (!o) return;
    const f = this.actor();
    const x = this.menuDivider() + 4, w = 188 - x;
    if (o.hidden) { text('???', x, MENU_Y, DIM); return; }
    // Footers are plain, with no closing stop. They wrap below, so a count in brackets stays.
    const plain = (s: string) => s.replace(/\.$/, '');
    let row = 0;
    const body: [string, string][] = [], foot: [string, string][] = [];
    // The kinds' rules wait behind Shift, since their icons already sit in the header.
    let rules: string[] = [];
    if (o.kind === 'move') {
      const m = moveDef(f, o.i!)!;
      const ty = this.typeOfMove(f, m);
      let rx = 188;
      if (m.nerve) {
        // A price on this side shows as a cost in red when it is higher and in green when it is lower.
        const cost = tideCost(this.b, f, m);
        const c = !this.b.rules.nerve ? DIM : cost > m.nerve ? BADC : cost < m.nerve ? GOOD : NERVE;
        textRight(String(cost), rx, MENU_Y, c);
        rx -= textWidth(String(cost)) + 7;
        tideIcon(rx, MENU_Y + 1, c);
        rx -= 5;
      }
      textRight(String(m.cd), rx, MENU_Y, DIM);
      const cdX = rx - textWidth(String(m.cd)) - 7;
      cdIcon(cdX, MENU_Y, DIM);
      // The type, then an icon for each kind. The type's name gives way to its sigil alone when the icons would reach the cooldown.
      // A shifted order class shows as the Quick or Late icon in place of the move's own.
      const ord = orderOf(this.b, f, m), ks = kindsOf(m).filter(k => k !== 'quick' && k !== 'late').concat(ord > 0 ? ['quick'] : ord < 0 ? ['late'] : []);
      let kx: number;
      if (x + 15 + textWidth(typeName(ty)) + ks.length * 9 <= cdX) kx = typeBadge(ty, x, MENU_Y - 1);
      else { sigil(ty, x, MENU_Y); kx = x + 9; }
      for (const k of ks) { if (kx + 9 > cdX) break; kindIcon(k, kx, MENU_Y, '#c8c0b0'); kx += 9; }
      row = 1;
      body.push([moveText(m, passivesOf(f)), PAPER]);
      rules = kindLines(m);
      if (!o.ok && o.why) foot.push([plain(o.why), BADC]);
      else {
        // Whether the matchup or a same-type move adds damage, without saying how much the move deals.
        const foe = this.b.s[this.foe].f[this.b.s[this.foe].out];
        if (foe && !foe.ko && (m.reach === 'single' || m.reach === 'spread' || m.reach === 'dragin')) {
          const eff = typeOn(this.b, foe, ty, undefined, f);
          if (eff > 1.01) foot.push([`Strong: ${+eff.toFixed(2)}x`, WARN]);
          else if (eff < 0.99) foot.push([`Weak: ${+eff.toFixed(2)}x`, DIM]);
          if (typesOf(f).includes(ty)) foot.push(['Same type: 1.2x', MINE]);
        }
      }
      // Spores in the slot: using it poisons the user.
      if ((f.spore?.[o.i!] || 0) > 0) foot.push([`Spored: it poisons you 2`, BADC]);
      // Overdrive: a cooling move it can still use, for HP.
      // A keepsake: the fifth slot holds a move kept for the rest of this battle.
      if (f.keepsake && o.i === f.mon.moves.length) foot.push(['Keepsake: kept for the rest of this battle', GOOD]);
      const odc = overdriveCost(this.b, f, o.i!);
      if (odc > 0) foot.push([`Overdrive: pays ${odc} HP to use it now`, WARN]);
      // Debt: a crest paid with tide the side does not have.
      const mm = moveDef(f, o.i!), tc = mm?.nerve ? tideCost(this.b, f, mm) : 0;
      if (tc > this.b.s[f.side].nerve && this.b.rules.nerve && usable(this.b, f, o.i!).ok) foot.push([`Debt: runs ${tc - Math.max(0, this.b.s[f.side].nerve)} tide into debt`, WARN]);
      // Dizzy: the picked move comes out of another slot.
      const sj = spunSlot(this.b, f, o.i!);
      if (sj !== o.i) foot.push([`Dizzy: comes out as ${moveDef(f, sj)?.name || 'another move'}`, BADC]);
      const bo = boostOf(f, o.i!);
      if (Math.abs(bo - 1) > 0.005) {
        const left = (f.boost || []).filter(x => x.slot === o.i).map(x => x.uses), n = Math.min(...left);
        const head = `${bo > 1 ? 'Boost' : 'Lowered'}: ${+bo.toFixed(2)}x`, full = `${head}, ${n} use${n > 1 ? 's' : ''}`;
        foot.push([n > 0 && textWidth(full) <= w ? full : head, bo > 1 ? MINE : BADC]);
      }
    } else {
      const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
      const say: Record<string, string> = {
        attack: `${basicOf(f) === 'P' ? 'A physical hit' : 'A magic hit'} with no type.${this.b.rules.nerve ? ' If it lands: +1 tide.' : ''}`,
        guard: 'Goes first in a round. Till your next turn it takes 0.5x, 0.25x from projectiles, and full from dashes. It can\'t be forced out.',
        switch: this.b.s[f.side].shut ? 'Your side is shut in, so it goes after the foe this round. Send out a whorl from reserve. A whorl with more CHA acts again sooner.' : 'Goes first in a round. Send out a whorl from reserve. A whorl with more CHA acts again sooner.',
        peg: 'Sound it with a horn. The weaker the foe, the more likely it curls in.',
        run: 'Goes first in a round. Leave. It always works.',
        wait: 'Wait for the foe to act, then choose. Reads of a waiting foe see you wait.',
        notion: n?.text || '',
        take: o.action?.k === 'take' ? this.dropText(o.action.i) : '',
        resign: `Ends this match at once, and ${this.o.name} wins. It asks first.`,
      };
      body.push([this.visiting() && o.kind === 'wait' ? 'It casts nothing and goes home.' : say[o.kind] || '', PAPER]);
      if (!o.ok && o.why) foot.push([plain(o.why), BADC]);
    }
    const lines: [string, string][] = [];
    for (const [s, c] of body) for (const l of wrap(s, w)) lines.push([l, c]);
    // Footers wrap to the panel's width, so a long reason a move cannot be used is never cut off.
    const footLines: [string, string][] = [];
    for (const [s, c] of foot) for (const l of wrap(s, w)) footLines.push([l, c]);
    let shown = footLines;
    if (row + lines.length + footLines.length <= MENU_ROWS && !rules.length) lines.forEach(([l, c], k) => text(l, x, MENU_Y + (row + k) * 9, c));
    else {
      // Too much for the panel, or a move with kinds: the footer keeps all but one body row and the hint, the body shows what
      // fits, and holding Shift shows the text, each kind's rule, and the footer whole in a wide box above the menu.
      shown = footLines.slice(0, Math.max(0, MENU_ROWS - row - 2));
      const free = MENU_ROWS - row - shown.length;
      lines.slice(0, Math.max(0, free - 1)).forEach(([l, c], k) => text(l, x, MENU_Y + (row + k) * 9, c));
      text('Shift: more', x, MENU_Y + (row + free - 1) * 9, SEL);
      if (input.held('fast')) {
        const wide: [string, string][] = [];
        for (const [s, c] of [...body, ...rules.map(l => [l, DIM] as [string, string]), ...foot]) for (const l of wrap(s, 176)) wide.push([l, c]);
        const h = wide.length * 9 + 7, y0 = 121 - h;
        panel(4, y0, 184, h);
        wide.forEach(([l, c], k) => text(l, 10, y0 + 4 + k * 9, c));
      }
    }
    // The footer sits on the last rows. The habits hint takes the last row when nothing else needs it.
    shown.forEach(([l, c], k) => text(l, x, MENU_Y + (MENU_ROWS - shown.length + k) * 9, c));
    if (!foot.length && !rules.length && row + lines.length < MENU_ROWS) text('L/R habits', x, MENU_Y + (MENU_ROWS - 1) * 9, '#5a5466');
  }

  /** A whorl's row in a list: its name, a short HP bar, and its type sigils, which end by x + 103 so a column at x + 105 stays clear. */
  drawMonRow(f: Fighter, x: number, y: number, on: boolean, enemy = false): void {
    if (on) cursor(x, y);
    text(fitTo(who(f), 49), x + 8, y, on ? SEL : barred(f) ? DIM : enemy ? THEIRS : PAPER);
    hpBar(x + 60, y + 2, 28, f.hp, f.maxHp, f.shield);
    let tx = x + 91;
    for (const t of kinds(f)) { miniSigil(t as Type, tx, y + 1); tx += 7; }
  }

  /** A whorl's moves in a column at x: each name after its type sigil with 2 pixels between, cut to end by the panel's edge. */
  drawMovesSmall(f: Fighter, x: number, y: number): void {
    f.moves.forEach((id, i) => {
      const m = MOVES[id];
      if (!m) return;
      miniSigil(this.typeOfMove(f, m), x, y + i * 9 + 1);
      text(fitTo(m.name, 188 - (x + 7)), x + 7, y + i * 9, f.cd[i] > 0 ? DIM : PAPER);
    });
  }
}

void legal; void G;
