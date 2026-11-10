// Everything around a sheet: the title, the campaign loop, the chronicle between sheets, the atlas, free play, and the ending.
import { BLANK, FIXED } from '../rules/types';
import type { CharId, Charter, Kind, Law, State } from '../rules/types';
import { CHARS, CHARTER_NAME, CHAR_NAME, CLAIM_TEXT, EVOLVED_TRAITS, KINDS, LAW_OF, LAW_TEXT, LOCALS, PERKS, SITES } from '../rules/data';
import { newSeason } from '../rules/engine';
import type { SeatSpec } from '../rules/engine';
import { PROFILES } from '../rules/ai';
import type { Campaign, CloseSummary, SheetRecord } from '../rules/campaign';
import { chooseCharter, choosePerk, closeSeason, newCampaign, startSeason } from '../rules/campaign';
import { C, bayer, clear, frame, panel, px, rect, text, textBig, textCenter, textWidth, W, H } from '../gfx/screen';
import { KIND_INKS, PARTY_INK, drawBlank, drawKind, drawPawn } from '../art/tiles';
import { G, drawBoard, fmtCount, inkOf, resetView } from './game';
import { frameNo, input, menu, pages, say, sound, wait, widgets } from './core';
import type { Co, MenuItem, Widget } from './core';
import { playSheet, rulePages } from './play';
import { Story } from './story';

export let baseDraw: () => void = drawTitle;
const SAVE = 'unsurveyed.campaign.v1';
const SHEET = 'unsurveyed.sheet.v1';
export const hooks = { music: (_mood: string) => undefined as void };

function store(): Storage | null { try { return window.localStorage; } catch { return null; } }
function loadCampaign(): Campaign | null { try { const t = store()?.getItem(SAVE); return t ? (JSON.parse(t) as Campaign) : null; } catch { return null; } }
function saveCampaign(c: Campaign): void { try { store()?.setItem(SAVE, JSON.stringify(c)); } catch { /* storage is optional */ } }
export function saveSheet(s: State | null): void { try { if (s) store()?.setItem(SHEET, JSON.stringify(s)); else store()?.removeItem(SHEET); } catch { /* storage is optional */ } }
function loadSheet(): State | null { try { const t = store()?.getItem(SHEET); return t ? (JSON.parse(t) as State) : null; } catch { return null; } }

function drawTitle(): void {
  clear(C.paper);
  for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) px(x, y, C.paper3);
  const k = Math.floor(frameNo / 30);
  const kinds: Kind[] = ['peak', 'well', 'town', 'road', 'well', 'peak', 'town'];
  for (let i = 0; i < 7; i++) {
    const x = 44 + i * 24, y = 118;
    if (i < 2) drawBlank(x, y, i);
    else if (i < 5) {
      rect(x, y, 24, 24, C.paper);
      for (let j = 0; j < 24; j++) for (let a = 0; a < 24; a++) { void a; void j; }
      drawKindDither(x, y, kinds[i], kinds[(i + 2) % 7], k);
    } else { rect(x, y, 24, 24, C.paper2); drawKind(x, y, kinds[i], i, 10, false); frame(x, y, 24, 24, C.paper3); }
  }
  frame(43, 117, 170, 26, C.sepia);
  drawPawn('perch', 104, 140, frameNo);
  textBig('UNSURVEYED', 31, 44, 3, (x, y) => (x < 128 + Math.sin(frameNo / 90) * 40 ? C.ink : bayer(x + k, y, 9) ? C.doubt2 : C.ink));
  textCenter('A survey for one to four parties', 128, 78, C.sepia);
  textCenter('Sheets 40 to 45', 128, 90, C.pencil);
}

function drawKindDither(x: number, y: number, a: Kind, b: Kind, k: number): void {
  for (const [kind, phase, flip] of [[a, 0, false], [b, 1, true]] as [Kind, number, boolean][]) {
    setStencilLocal(k, phase);
    drawKind(x, y, kind, 3, 5, flip);
  }
  clearStencilLocal();
  for (let i = 0; i < 24; i += 2) { px(x + i, y, C.pencil); px(x + i, y + 23, C.pencil); px(x, y + i, C.pencil); px(x + 23, y + i, C.pencil); }
}
import { setStencil } from '../gfx/screen';
function setStencilLocal(k: number, phase: number): void { setStencil((x, y) => ((((x + k) >> 1) + (y >> 1)) & 1) === phase); }
function clearStencilLocal(): void { setStencil(null); }

// ------------------------------------------------------------------ atlas

function sheetColor(t: SheetRecord['tiles'][0], x: number, y: number): number {
  if (t.st === BLANK) return ((x + y) & 3) === 0 ? C.paper3 : C.paper;
  if (t.st === FIXED) return KIND_INKS[t.k!][1];
  return ((x >> 1) + (y >> 1)) & 1 ? KIND_INKS[t.a][0] : KIND_INKS[t.b][0];
}

/** Draws the campaign's sheets as one strip. Each sheet shares its top row with the next. */
export function drawAtlas(c: Campaign, x0: number, yBottom: number, cell: number, notes: boolean): void {
  let y = yBottom;
  c.atlas.forEach((sh, k) => {
    const rows = k === 0 ? 7 : 6;
    for (let r = 0; r < rows; r++) {
      const ty = 6 - r;
      y -= cell;
      for (let tx = 0; tx < 7; tx++) {
        const t = sh.tiles[ty * 7 + tx];
        for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) px(x0 + tx * cell + i, y + j, sheetColor(t, i, j));
        if (t.peg) { const m = Math.max(1, cell >> 1); rect(x0 + tx * cell + ((cell - m) >> 1), y + ((cell - m) >> 1), m, m, PARTY_INK[t.peg] === C.ink ? C.ink : PARTY_INK[t.peg]); }
        if (t.site) frame(x0 + tx * cell, y, cell, cell, C.gold);
      }
    }
    frame(x0 - 1, y - 1, 7 * cell + 2, rows * cell + 2, C.sepia);
    if (notes) {
      const ny = y + ((rows * cell) >> 1) - 8;
      const nx = x0 + 7 * cell + 8;
      text('Sheet ' + (39 + sh.season), nx, ny, C.ink);
      text(CHAR_NAME[sh.winner] + (sh.by === 'claim' ? ', by claim' : ''), nx, ny + 9, inkOf(sh.winner));
      text('Counted ' + CHARTER_NAME[sh.charter] + (sh.smudged && sh.winner === 'perch' ? ', smudged' : ''), nx, ny + 18, C.pencil);
    }
  });
}

function* atlasView(c: Campaign): Co<void> {
  const widget: Widget = {
    draw() {
      clear(C.paper);
      text('The atlas', 8, 6, C.sepia);
      rect(8, 16, W - 16, 1, C.paper3);
      drawAtlas(c, 12, H - 12, 5, true);
      text('Z: continue', W - 60, 6, C.pencil);
    },
  };
  widgets.push(widget);
  yield;
  while (!(input.pressed('ok') || input.pressed('back') || input.clicked)) yield;
  widgets.splice(widgets.indexOf(widget), 1);
  yield;
}

// ------------------------------------------------------------------ campaign

function* seasonCard(c: Campaign, s: State): Co<void> {
  const site = SITES.find((x) => x.season === s.season);
  const news: Record<number, string> = {
    1: 'Sketch, measure, peg.', 2: 'New: doubt, locals, fights, trades.', 3: 'New: promises, truces, backing, claims.',
    4: 'New: objections, unmeasuring.', 5: 'New: the Level.', 6: 'New: amend. The last sheet.',
  };
  const lines = [
    'Counts: ' + CHARTER_NAME[s.charter] + '.' + (s.law !== 'none' ? ' Law: ' + LAW_TEXT[s.law].name + '.' : ''),
    'Parties: ' + s.players.map((p) => CHAR_NAME[p.char]).join(', ') + '.',
    news[s.season],
  ];
  const widget: Widget = {
    draw() {
      panel(30, 70, 196, 92);
      textCenter('Sheet ' + (39 + s.season), 128, 78, C.ink);
      textCenter(site ? site.name : 'The proving', 128, 90, C.perch);
      rect(40, 102, 176, 1, C.paper3);
      lines.forEach((ln, i) => textCenter(ln.length > 36 ? ln.slice(0, 36) : ln, 128, 108 + i * 11, C.sepia));
      if ((frameNo >> 4) & 1) textCenter('Z', 128, 148, C.perch);
    },
  };
  widgets.push(widget);
  sound.sfx('bell');
  yield;
  while (!(input.pressed('ok') || input.clicked)) yield;
  widgets.splice(widgets.indexOf(widget), 1);
  yield;
  void c;
}

function* chronicle(c: Campaign, s: State, sum: CloseSummary): Co<void> {
  const res = s.result!;
  const body: string[] = ['# Sheet ' + (39 + s.season) + ' closes to ' + CHAR_NAME[sum.winner]];
  body.push(res.by === 'claim' ? 'Won by claim: ' + CLAIM_TEXT[res.claim!].name + '.' : 'Won by the count.');
  body.push(s.players.map((p, i) => CHAR_NAME[p.char] + ' ' + fmtCount(res.counts[i])).join(',  ') + '.');
  if (sum.deputy) body.push('You backed the winner. You are its Deputy and start with 3 more ink.');
  else if (sum.winner === 'perch') body.push('You hold the Charter for the next sheet.');
  else body.push('You placed ' + ['first', 'second', 'third', 'fourth'][sum.perchRank - 1] + '.');
  for (const t of sum.newTraits) body.push(CHAR_NAME[t.who] + ' has changed. ' + EVOLVED_TRAITS[t.trait]);
  if (sum.added.length) body.push('New locals on the next sheet: ' + sum.added.map((id) => LOCALS.find((l) => l.id === id)!.name).join(', ') + '.');
  if (sum.lost.length) body.push('Struck for good: ' + sum.lost.map((id) => LOCALS.find((l) => l.id === id)?.name ?? id).join(', ') + '.');
  const struck = KINDS.filter((k) => s.struck[k] > 0).map((k) => s.struck[k] + ' ' + k + (s.struck[k] > 1 ? 's' : ''));
  body.push('Readings struck on this sheet: ' + (struck.join(', ') || 'none') + '. Struck kinds come back in the next sheet\'s drafts.');
  yield* pages('The chronicle', [body]);
  if (c.choices && c.choices.perks.length) {
    const r = yield* menu(c.choices.perks.map((id) => ({ label: PERKS[id].name, hint: PERKS[id].text })), { title: 'Take one for the road', cancel: false, w: 200 });
    choosePerk(c, c.choices.perks[r]);
  }
  if (c.holder === 'perch' && c.choices && c.choices.charters.length) {
    const ch = c.choices.charters;
    const r = yield* menu(ch.map((x) => ({ label: CHARTER_NAME[x], hint: x === 'acres' ? 'Every peg counts.' : 'Only pegs on ' + CHARTER_NAME[x] + ' count.' })), { title: 'You hold the Charter. It counts', cancel: false, w: 210 });
    const laws = c.choices.laws;
    const l = yield* menu(laws.map((x) => ({ label: LAW_TEXT[x].name, hint: LAW_TEXT[x].text })), { title: 'And your law', cancel: false, w: 210 });
    chooseCharter(c, ch[r], laws[l]);
  }
  yield* atlasView(c);
}

function* credits(c: Campaign): Co<void> {
  const total = { road: 0, well: 0, town: 0, peak: 0 };
  for (const sh of c.atlas) for (const k of KINDS) total[k] += sh.struck[k];
  const lines = [
    'UNSURVEYED', '', 'Sheets 40 to 45, as drawn.', '',
    'Sheets you closed: ' + c.wins, 'Times you were Deputy: ' + c.deputyTimes, 'Tiles you measured: ' + c.measures,
    'Readings struck:', total.road + ' roads, ' + total.well + ' wells,', total.town + ' towns, ' + total.peak + ' peaks.', '',
    'Every struck reading', 'is still out there.', '', 'Start a new campaign', 'to draw it differently.',
  ];
  let scroll = 0;
  const cell = 12;
  const height = 37 * cell + H;
  const widget: Widget = {
    draw() {
      clear(C.paper);
      for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) px(x, y, C.paper3);
      drawAtlas(c, 12, H + 37 * cell - Math.floor(scroll), cell, false);
      rect(108, 0, 148, H, C.paper);
      rect(108, 0, 1, H, C.sepia);
      lines.forEach((ln, i) => text(ln, 116, 34 + i * 12, i === 0 ? C.perch : C.ink));
    },
  };
  widgets.push(widget);
  yield;
  while (scroll < height - H && !input.pressed('back')) { scroll += input.held('fast') || input.held('ok') ? 3 : 0.5; yield; }
  yield* wait(240, true);
  widgets.splice(widgets.indexOf(widget), 1);
  yield;
}

function* campaignFlow(c: Campaign, resume: State | null): Co<void> {
  while (c.season <= 6) {
    const resumed = !!resume && resume.season === c.season;
    const s = resumed ? resume! : startSeason(c);
    resume = null;
    G.camp = c; G.s = s; G.free = false;
    G.viewer = s.players.findIndex((p) => p.human);
    G.profiles = s.players.map((p) => (p.human ? null : c.season === 1 ? PROFILES.easy : null));
    G.log = [];
    resetView(s);
    baseDraw = drawBoard;
    hooks.music('sheet' + c.season);
    const story = new Story(c, s);
    story.save = () => { saveCampaign(c); saveSheet(s); };
    if (!resumed) { yield* seasonCard(c, s); yield* story.open(); }
    yield* playSheet(story);
    yield* story.close();
    const last = c.season === 6;
    const sum = closeSeason(c, s);
    saveSheet(null);
    if (last) {
      try { store()?.removeItem(SAVE); } catch { /* storage is optional */ }
      hooks.music('ending');
      yield* credits(c);
      return;
    }
    yield* chronicle(c, s, sum);
    saveCampaign(c);
  }
}

// ------------------------------------------------------------------ free play

function* freePlay(): Co<void> {
  const nSeats = yield* menu([{ label: '2 parties' }, { label: '3 parties' }, { label: '4 parties' }], { title: 'Free play', w: 140 });
  if (nSeats < 0) return;
  const seats: SeatSpec[] = [];
  const kinds = ['Human', 'Computer, easy', 'Computer, normal', 'Computer, hard'];
  const profs: (typeof PROFILES.easy | null)[] = [];
  for (let i = 0; i < nSeats + 2; i++) {
    const free = CHARS.filter((ch) => !seats.some((x) => x.char === ch));
    const ci = yield* menu(free.map((ch) => ({ label: CHAR_NAME[ch], ink: inkOf(ch) })), { title: 'Seat ' + (i + 1) + ': who', w: 140, cancel: false });
    const ki = yield* menu(kinds.map((k) => ({ label: k })), { title: CHAR_NAME[free[ci]] + ' is played by', w: 170, cancel: false, start: i === 0 ? 0 : 2 });
    seats.push({ char: free[ci], human: ki === 0 });
    profs.push(ki === 0 ? null : [PROFILES.easy, PROFILES.normal, PROFILES.hard][ki - 1]);
  }
  const lvl = yield* menu(
    [{ label: 'Sheet 40 rules', hint: 'Sketch, measure, peg.' }, { label: 'Sheet 41 rules', hint: 'Adds doubt, locals, fights, trades.' }, { label: 'Sheet 42 rules', hint: 'Adds promises, backing, claims.' }, { label: 'Sheet 43 rules', hint: 'Adds objections and unmeasuring.' }, { label: 'Sheet 44 rules', hint: 'Adds the Level.' }, { label: 'Sheet 45 rules', hint: 'Adds amend.' }],
    { title: 'Which rules', w: 180, cancel: false, start: 3 },
  );
  const charters: Charter[] = ['acres', ...KINDS];
  const ch = yield* menu(charters.map((x) => ({ label: CHARTER_NAME[x] })), { title: 'The Charter counts', w: 150, cancel: false });
  const holder = yield* menu([{ label: 'Nobody' }, ...seats.map((x) => ({ label: CHAR_NAME[x.char] }))], { title: 'Who holds the Charter', w: 170, cancel: false });
  const season = lvl + 1;
  const law: Law = holder > 0 ? LAW_OF[seats[holder - 1].char] : 'none';
  const s = newSeason({
    seed: (Date.now() & 0xfffffff) | 1, season, seats, holder: holder - 1, charter: charters[ch], law,
    deck: LOCALS.filter((l) => !l.reserve || season >= 4).map((l) => l.id),
  });
  G.camp = null; G.s = s; G.free = true; G.log = [];
  G.viewer = Math.max(0, s.players.findIndex((p) => p.human));
  G.profiles = profs;
  resetView(s);
  baseDraw = drawBoard;
  hooks.music('sheet' + season);
  yield* playSheet(null);
  const res = s.result!;
  const body = ['# The sheet closes to ' + CHAR_NAME[s.players[res.winner].char], res.by === 'claim' ? 'Won by claim: ' + CLAIM_TEXT[res.claim!].name + '.' : 'Won by the count.', s.players.map((p, i) => CHAR_NAME[p.char] + ' ' + fmtCount(res.counts[i])).join(',  ') + '.'];
  yield* pages('Free play', [body]);
}

export function* app(): Co<void> {
  for (;;) {
    baseDraw = drawTitle;
    G.s = null;
    hooks.music('title');
    const saved = loadCampaign();
    const items: MenuItem[] = [
      { label: 'New campaign', hint: 'Six sheets. One human party against the rivals.' },
      { label: 'Continue', off: !saved, hint: saved ? 'Sheet ' + (39 + saved.season) + '.' : 'No campaign saved.' },
      { label: 'Free play', hint: 'One sheet. Any seat can be a person or the computer.' },
      { label: 'The law of the sheet', hint: 'The rules.' },
    ];
    const r = yield* menu(items, { title: '', x: 68, y: 160, w: 120, cancel: false, start: saved ? 1 : 0 });
    if (r === 0) {
      const d = yield* menu([{ label: 'Easy rivals' }, { label: 'Normal rivals' }, { label: 'Hard rivals' }], { title: 'How sharp are the rivals', w: 170, start: 1 });
      if (d < 0) continue;
      const c = newCampaign((Date.now() & 0xfffffff) | 1, d);
      saveCampaign(c);
      saveSheet(null);
      yield* campaignFlow(c, null);
    } else if (r === 1 && saved) {
      yield* campaignFlow(saved, loadSheet());
    } else if (r === 2) yield* freePlay();
    else if (r === 3) { G.free = true; yield* pages('The law of the sheet', rulePages()); G.free = false; }
  }
}

export function setBase(f: () => void): void { baseDraw = f; }
export { say, textWidth };
export type { CharId };
