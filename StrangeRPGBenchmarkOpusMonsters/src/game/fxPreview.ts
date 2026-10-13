// Debug views for battle pictures, from the console: __slough.fxTest('move_id') plays one move's picture on a loop,
// __slough.fxSheet(page) shows a page of specs at once, and __slough.fxStatus() shows every status picture. fxTest also
// takes a spec in place of an id.
import type { SpriteData } from '../battle/model';
import { FIELDS, MOVES } from '../battle/registry';
import { SPECIES, WILD_KINDS } from '../data/species';
import { TYPE_COLOR, type Type } from '../data/types';
import { text, textCenter, wrap } from '../engine/font';
import { input } from '../engine/input';
import { drawSprite } from '../engine/sprites';
import { clear, layer, rect, INK } from '../engine/screen';
import { drawFighter, FOE_AT, MINE_AT, paintBackdrop, SCENE_H, SCENE_W, sceneNow, type SceneFigure } from './backdrops';
import { colorOf, drawField, drawRun, drawStatus, fadedScene, poseOf, runLights, startRun, STATUS_FX, type FxRun } from './battlefx';
import { fxHash, fxPlanOf, parseFx, type FxPlan } from './fxspec';
import { previewSound, soundTick } from './movesound';
import { close, run, type Mode } from './modes';
import { DIM, PAPER, SEL } from './ui';

const sprite = (kind: string | undefined): SpriteData => {
  const sp = SPECIES[kind || ''] || SPECIES[WILD_KINDS[0]];
  return { px: sp.sprite, c: sp.c };
};

/** A spec or a move id as a plan, its color, and words to show under it. */
function planOf(what: string): { plan: FxPlan; color: string; label: string; spec: string; user: string | undefined } | string {
  const m = MOVES[what];
  if (m) return { plan: fxPlanOf(m), color: TYPE_COLOR[m.type], label: `${m.name} (${m.type})`, spec: m.fx || 'default', user: m.owner };
  const r = parseFx(what);
  if ('bad' in r) return `${r.bad}: ${r.why}`;
  return { plan: r, color: colorOf(r.color, TYPE_COLOR.STAR), label: 'Spec', spec: what, user: undefined };
}

/** Plays a picture in a scene drawn into the current layer, with both sloughs standing where a battle puts them. */
function scene(key: string, t: number, r: FxRun | null, me: SpriteData, foe: SpriteData, field: string | null): void {
  const at = (side: 0 | 1) => (side === 0 ? MINE_AT : FOE_AT);
  const figs: SceneFigure[] = ([1, 0] as const).map(side => {
    const p = r && r.side === side ? poseOf(r) : null;
    return { s: side === 0 ? me : foe, x: at(side)[0] + (p ? p.dx : 0), y: at(side)[1] + (p ? p.dy : 0), flip: (side === 0) !== !!p?.flip, ground: at(side)[1] + 8 };
  });
  paintBackdrop(key, { t, loose: 0, dusk: 0, lights: r ? runLights(r) : [], figures: figs });
  if (field) drawField(field, t, FIELDS[field]?.color || '#9aa8b8');
  if (r) drawRun(r, 'under');
  figs.forEach((f, i) => {
    const p = r && r.side === (i === 0 ? 1 : 0) ? poseOf(r) : null;
    if (p && p.vis < 1) fadedScene(8, 8, f.x, f.y, p.vis, () => drawFighter(f.s, 0, 0, f.flip, p.k));
    else if (p?.glow) drawSprite(f.s, f.x, f.y, 1, f.flip, r!.tone.light);
    else drawFighter(f.s, f.x, f.y, f.flip, p ? p.k : 1);
  });
  if (r) drawRun(r, 'over');
}

/** Starts a plan from one side toward the other. */
function begin(plan: FxPlan, side: 0 | 1, color: string, seed: number): FxRun {
  const mid = (sd: 0 | 1) => { const a = sd === 0 ? MINE_AT : FOE_AT; return { x: a[0] + 4, y: a[1] + 4 }; };
  const from = mid(side), to = plan.to === 'self' || plan.to === 'ally' ? [from] : [mid((1 - side) as 0 | 1)];
  return startRun(plan, side, from, to, color, plan.accent ? colorOf(plan.accent, color) : undefined, seed);
}

/** One move's picture over and over, larger. Z plays it again, left and right swap which side uses it, and X closes. */
export function fxTest(what: string): string {
  const p = planOf(what);
  if (typeof p === 'string') return p;
  let t = 0, side: 0 | 1 = 0, r = begin(p.plan, side, p.color, fxHash(what)), heard: FxRun | null = null;
  const me = sprite(p.user), foe = sprite(WILD_KINDS[3]);
  // `current` gives tools the run playing now, with its timings.
  const m: Mode & { current: () => FxRun } = {
    current: () => r,
    opaque: true,
    update() {
      t++; r.t++;
      if (heard !== r) { heard = r; previewSound(r, what, MOVES); }
      soundTick(r, 1);
      if (input.hit('left') || input.hit('right')) { side = side ? 0 : 1; r = begin(p.plan, side, p.color, fxHash(what)); }
      if (input.hit('ok') || r.t > r.end + 24) r = begin(p.plan, side, p.color, fxHash(what));
      if (input.hit('back')) close(m);
    },
    draw() {
      clear(INK);
      layer('fxtest', SCENE_W, SCENE_H, 0, 0, 2, () => scene(sceneNow.key, t, r, side === 0 ? me : foe, side === 0 ? foe : me, null));
      text(p.label, 6, 126, SEL);
      wrap(p.spec, 180).slice(0, 4).forEach((l, i) => text(l, 6, 136 + i * 9, PAPER));
      text('Z again   L/R side   X close', 6, 180, DIM);
    },
  };
  void run(m);
  return 'playing ' + p.label;
}

/** The specs the contact sheet shows, six to a page, with a type for the color. A field entry shows that field state. */
export const SHEET: { spec: string; type: Type; field?: string }[] = [
  { spec: 'lunge | slash', type: 'BEAST' }, { spec: 'stomp | quake jolt', type: 'STONE' }, { spec: 'blink | claw', type: 'VOID' },
  { spec: 'hop | fang*2 arc | bite', type: 'BEAST' }, { spec: 'pebble*3 arc | crack', type: 'STONE' }, { spec: 'drop*3 wave | splash', type: 'TIDE' },
  { spec: 'leaf*4 spiral | bloom', type: 'ROOT' }, { spec: 'bolt zigzag | burst glare', type: 'GEAR' }, { spec: 'cog return | cinders', type: 'GEAR' },
  { spec: 'star*5 rain | sparkle', type: 'STAR' }, { spec: 'lift | comet arc | pillar big jolt', type: 'STAR' }, { spec: 'salt*4 converge | frost', type: 'SALT' },
  { spec: 'hoop line | ring', type: 'SALT' }, { spec: 'rune*3 orbit | sigil', type: 'VOID' }, { spec: 'orb spiral | vortex dark', type: 'VOID' },
  { spec: 'flare | beam | flash', type: 'STAR' }, { spec: 'thorn*3 rise | slash', type: 'ROOT' }, { spec: 'bubble*4 rise | fizz', type: 'TIDE' },
  { spec: 'feather*3 sweep | puff', type: 'BEAST' }, { spec: 'card*3 zigzag | shatter', type: 'GEAR' }, { spec: 'fish*2 wave | splash', type: 'TIDE' },
  { spec: 'ember*3 arc | smoke', type: 'GEAR' }, { spec: 'sway | bell line | ring', type: 'SALT' }, { spec: 'swell | moon arc | daze', type: 'STAR' },
  { spec: 'spark*4 ray | burst', type: 'GEAR' }, { spec: 'shell*2 arc | shatter', type: 'SALT' }, { spec: 'urchin wave | puff', type: 'TIDE' },
  { spec: 'kelp*3 rise | drip', type: 'ROOT' }, { spec: 'shard*4 line fast | shatter', type: 'STONE' }, { spec: 'recoil | sand*2 sweep | puff tint', type: 'STONE' },
  { spec: 'spin | pearl*3 orbit | ring', type: 'TIDE' }, { spec: 'sink | crest wave | splash', type: 'TIDE' }, { spec: 'shake | bone*2 arc | bite', type: 'BEAST' },
  { spec: 'sway | petal*5 rise | bloom', type: 'ROOT' },
  { spec: 'fog', type: 'TIDE', field: 'fog' }, { spec: 'gale', type: 'SALT', field: 'gale' }, { spec: 'hightide', type: 'TIDE', field: 'hightide' },
  { spec: 'starfall', type: 'STAR', field: 'starfall' }, { spec: 'saltcrust', type: 'SALT', field: 'saltcrust' }, { spec: 'eclipse', type: 'VOID', field: 'eclipse' },
  { spec: 'stillwater', type: 'TIDE', field: 'stillwater' }, { spec: 'driftsand', type: 'STONE', field: 'driftsand' },
  { spec: 'mirror', type: 'STAR', field: 'mirror' },
];

/** Six specs at once, two across, each on a loop at its own phase. Left and right turn the page, and Z or X closes. Returns the page shown. */
export function fxSheet(page = 0): string {
  const pages = Math.ceil(SHEET.length / 6);
  let pg = ((page % pages) + pages) % pages, t = 0;
  const me = sprite(WILD_KINDS[1]), foe = sprite(WILD_KINDS[3]);
  let runs: (FxRun | null)[] = [];
  const load = () => {
    runs = SHEET.slice(pg * 6, pg * 6 + 6).map((e, i) => {
      if (e.field) return null;
      const r = parseFx(e.spec);
      if ('bad' in r) return null;
      const run = begin(r, 0, TYPE_COLOR[e.type], fxHash(e.spec));
      run.t = -i * 7;
      return run;
    });
  };
  load();
  const m: Mode = {
    opaque: true,
    update() {
      t++;
      runs.forEach((r, i) => { if (!r) return; r.t++; if (r.t > r.end + 20) { const e = SHEET[pg * 6 + i], p = parseFx(e.spec); if (!('bad' in p)) runs[i] = begin(p, 0, TYPE_COLOR[e.type], fxHash(e.spec)); } });
      if (input.hit('left') || input.hit('right')) { pg = (pg + (input.hit('left') ? pages - 1 : 1)) % pages; load(); }
      if (input.hit('ok') || input.hit('back')) close(m);
    },
    draw() {
      clear(INK);
      SHEET.slice(pg * 6, pg * 6 + 6).forEach((e, i) => {
        const x = (i % 2) * 96, y = Math.floor(i / 2) * 64;
        layer('fxsheet' + i, SCENE_W, SCENE_H, x, y, 1, () => scene('fellside', t, runs[i], me, foe, e.field || null));
        const lines = wrap(e.spec, 92);
        lines.forEach((l, k) => text(l, x + 2, y + 51 - (lines.length - 1 - k) * 9, PAPER, INK));
      });
    },
  };
  void run(m);
  return `page ${pg + 1} of ${pages}`;
}

/** The status pictures sixteen to a page, each on its own slough with its id under it. Left and right turn the page, and Z or X closes it. */
export function fxStatus(page = 0): string {
  const ids = [...Object.keys(STATUS_FX), 'hidden'], s = sprite(WILD_KINDS[1]), pages = Math.ceil(ids.length / 16);
  let pg = ((page % pages) + pages) % pages, t = 0;
  const m: Mode = {
    opaque: true,
    update() {
      t++;
      if (input.hit('left') || input.hit('right')) pg = (pg + (input.hit('left') ? pages - 1 : 1)) % pages;
      if (input.hit('ok') || input.hit('back')) close(m);
    },
    draw() {
      clear(INK);
      ids.slice(pg * 16, pg * 16 + 16).forEach((id, i) => {
        const x = (i % 4) * 48, y = Math.floor(i / 4) * 48;
        layer('fxstatus' + i, 20, 19, x + 4, y, 2, () => {
          rect(0, 0, 20, 19, '#1c1a2a');
          if (id === 'hidden') fadedScene(8, 8, 6, 9, 0.375, () => drawSprite(s, 0, 0));
          else drawSprite(s, 6, 9);
          drawStatus(id, 6, 9, t + i * 7, true);
        });
        textCenter(id, x + 24, y + 40, PAPER);
      });
    },
  };
  void run(m);
  return `page ${pg + 1} of ${pages}`;
}

setTimeout(() => { const dbg = (globalThis as any).window?.__slough; if (dbg) Object.assign(dbg, { fxTest, fxSheet, fxStatus }); }, 0);
