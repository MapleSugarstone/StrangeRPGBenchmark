import type { Mon, SpriteData } from '../battle/model';
import { FIT_STAT, moveText } from '../battle/engine';
import { MOVES, PASSIVES } from '../battle/registry';
import { TYPE_COLOR, type Type } from '../data/types';
import { text, textRight, wrap } from '../engine/font';
import { input } from '../engine/input';
import { rect, INK } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { sfx } from '../engine/audio';
import { close, run, type Mode } from './modes';
import { box, cursor, DIM, GOOD, NERVE, PAPER, SEL, sigil, typeBadge, WARN, BADC } from './ui';
import { G, save } from './state';
import { choose, say } from './dialogue';
import { listMenu, monLine, monPage } from './menus';
import { bigCount, canFit, fitCost, makeFit, nameOptions, NO_FIT_HABITS, paletteOf, SHAPES, shapeOf, typeOptions, type FitPlan } from './fitting';
import { baseSprite, rollStarborn } from '../data/starborn';

/** Pick `need` items from a list. Returns indices or null if backed out. */
function pickMany(title: string, items: { label: string; color?: string; detail: string; big?: boolean }[], need: number, maxBig: number): Promise<number[] | null> {
  let i = 0;
  const on = new Set<number>();
  const m: Mode = {
    opaque: true,
    update() {
      if (input.hit('up')) { i = (i + items.length - 1) % items.length; sfx('move'); }
      if (input.hit('down')) { i = (i + 1) % items.length; sfx('move'); }
      if (input.hit('ok')) {
        if (on.has(i)) { on.delete(i); sfx('back'); }
        else if (on.size < need) {
          const bigs = [...on].filter(k => items[k].big).length;
          if (items[i].big && bigs >= maxBig) { sfx('back'); return; }
          on.add(i); sfx('ok');
          if (on.size === need) { close(m, [...on].sort((a, b) => a - b)); }
        } else sfx('back');
      }
      if (input.hit('back')) { sfx('back'); close(m, null); }
    },
    draw() {
      rect(0, 0, 192, 192, '#17151d');
      box(2, 2, 188, 188);
      text(title, 6, 6, SEL);
      textRight(`${on.size}/${need}`, 186, 6, DIM);
      items.forEach((it, k) => {
        const y = 18 + k * 10;
        if (k === i) cursor(5, y);
        rect(12, y + 1, 6, 6, on.has(k) ? GOOD : '#3a3442');
        if (it.color) rect(21, y + 2, 4, 4, it.color);
        text(it.label, 28, y, k === i ? SEL : PAPER);
        if (it.big) textRight('crest', 186, y, NERVE);
      });
      const y0 = 22 + items.length * 10;
      box(4, y0, 184, 186 - y0);
      wrap(items[i]?.detail || '', 176).forEach((l, n) => text(l, 8, y0 + 4 + n * 9, PAPER));
      if (maxBig < 9) text(`At most ${maxBig} ${maxBig === 1 ? 'crest' : 'crests'}.`, 8, 178, DIM);
    },
  };
  return run(m);
}

function pickLook(a: SpriteData, b: SpriteData): Promise<SpriteData | null> {
  let sx = 0, sy = 0;
  const looks: SpriteData[][] = [];
  for (let p = 0; p < 3; p++) { looks.push([]); for (let s = 0; s < 4; s++) looks[p].push({ px: shapeOf(a, b, s), c: paletteOf(a, b, p) }); }
  const m: Mode = {
    opaque: true,
    update() {
      if (input.hit('left')) { sx = (sx + 3) % 4; sfx('move'); }
      if (input.hit('right')) { sx = (sx + 1) % 4; sfx('move'); }
      if (input.hit('up')) { sy = (sy + 2) % 3; sfx('move'); }
      if (input.hit('down')) { sy = (sy + 1) % 3; sfx('move'); }
      if (input.hit('ok')) { sfx('ok'); close(m, looks[sy][sx]); }
      if (input.hit('back')) { sfx('back'); close(m, null); }
    },
    draw() {
      rect(0, 0, 192, 192, '#17151d');
      box(2, 2, 188, 188);
      text('How should it look?', 6, 6, SEL);
      for (let p = 0; p < 3; p++) for (let s = 0; s < 4; s++) {
        const x = 10 + s * 44, y = 20 + p * 44;
        rect(x - 2, y - 2, 36, 36, p === sy && s === sx ? SEL : '#2a2632');
        rect(x, y, 32, 32, INK);
        drawSprite(looks[p][s], x, y, 4);
      }
      text(SHAPES[sx], 8, 156, PAPER);
      text(['Colors of the first', 'Colors of the second', 'Colors of both'][sy], 8, 166, DIM);
      text('Parents', 120, 156, DIM);
      drawSprite(a, 120, 166, 2);
      drawSprite(b, 142, 166, 2);
    },
  };
  return run(m);
}

export async function fitterMenu(): Promise<void> {
  const pool = (): Mon[] => [...G.party, ...G.rack];
  if (pool().length < 2) { await say('Conjoiner', 'Two whorls. You need two. You have the one.'); return; }
  const all = pool();
  const ia = await listMenu('Fit which first?', all.map(monLine), { w: 120, disabled: k => !!canFit(all[k]),
    detail: k => { const m = all[k]; box(128, 4, 60, 44); drawSprite(m.sprite, 140, 10, 4); } });
  if (ia < 0) return;
  const A = all[ia];
  const rest = all.filter(m => m !== A);
  const ib = await listMenu(`Fit ${A.name} with?`, rest.map(monLine), { w: 120, disabled: k => !!canFit(rest[k]),
    detail: k => { const m = rest[k]; box(128, 4, 60, 44); drawSprite(m.sprite, 140, 10, 4); } });
  if (ib < 0) return;
  const B = rest[ib];
  const cost = fitCost(A, B);
  if (G.rind < cost) { await say('Conjoiner', `${cost} cowries. Ten a level. Come back with it.`); return; }

  const plan = await designFit(A, B);
  if (!plan) return;
  const ok = await confirm(A, B, plan, cost);
  if (!ok) return;
  G.rind -= cost;
  const result = rollStarborn(makeFit(A, B, plan, G.fitCount + 1), Math.random);
  G.fitCount++;
  G.fits.push({ name: result.name, a: A.name, b: B.name });
  for (const p of [A, B]) if (p.notion) { G.notions[p.notion] = (G.notions[p.notion] || 0) + 1; p.notion = null; }
  const ai = G.party.indexOf(A);
  G.party = G.party.filter(m => m !== A && m !== B);
  G.rack = G.rack.filter(m => m !== A && m !== B);
  if (ai >= 0 || G.party.length < 4) G.party.splice(Math.max(0, Math.min(ai, G.party.length)), 0, result);
  else G.rack.push(result);
  sfx('fit');
  save();
  await say('Conjoiner', `There. ${result.name}. It won't come apart.`);
  await monPage(result);
}

/** The Fitter's choices for conjoining A and B: moves, habits, types, plain attack, retune, look, and name. Resolves null when backed out. */
export async function designFit(A: Mon, B: Mon): Promise<FitPlan | null> {
  const moveItem = (id: string) => {
    const mv = MOVES[id];
    return { label: mv.name, color: TYPE_COLOR[mv.type], detail: `${mv.type} move. ${moveText(mv)} Cooldown ${mv.cd}.${mv.nerve ? ` It is a crest and costs ${mv.nerve} tide.` : ''}`, big: !!mv.nerve };
  };
  const fromA = A.moves.slice();
  const ma = await pickMany(`Keep two of ${A.name}'s moves`, fromA.map(moveItem), Math.min(2, fromA.length), 2);
  if (!ma) return null;
  const keptA = ma.map(k => fromA[k]);
  const fromB = B.moves.filter(id => !keptA.includes(id));
  const bigLeft = 2 - keptA.filter(id => MOVES[id].nerve).length;
  const mb = await pickMany(`Keep two of ${B.name}'s moves`, fromB.map(moveItem), Math.min(2, fromB.length), bigLeft);
  if (!mb) return null;
  const moves = [...keptA, ...mb.map(k => fromB[k])];

  const pIds = [...new Set([...A.passives, ...B.passives])].filter(id => !NO_FIT_HABITS.has(id));
  const pi = await pickMany('Pick two habits to keep', pIds.map(id => ({ label: PASSIVES[id].name, detail: PASSIVES[id].text })), Math.min(2, pIds.length), 9);
  if (!pi) return null;
  const passives = pi.map(k => pIds[k]);

  const tops = typeOptions(A, B);
  const ti = await listMenu('Which types?', tops.map(t => t.join(' and ')), { w: 150,
    detail: () => { box(4, 150, 184, 36); wrap('Two types means more moves get the same-type bonus, and more weaknesses.', 176).forEach((l, n) => text(l, 8, 154 + n * 9, PAPER)); } });
  if (ti < 0) return null;
  const types = tops[ti];

  let basic: 'P' | 'M' = A.basic;
  if (A.basic !== B.basic) {
    const bi = await choose(['Physical attacks', 'Magic attacks'], true, 'Is its plain Attack physical or magic?');
    if (bi < 0) return null;
    basic = bi === 0 ? 'P' : 'M';
  }

  let retune: FitPlan['retune'] = null;
  const rt = await choose(['No', 'Retune a move'], true, 'Retune one move to one of its types?');
  if (rt < 0) return null;
  if (rt === 1) {
    const mk = await listMenu('Retune which move?', moves.map(id => `${MOVES[id].name} (${MOVES[id].type})`), { w: 150 });
    if (mk >= 0) {
      const tk = await listMenu('To which type?', types, { w: 100 });
      if (tk >= 0) retune = { move: moves[mk], type: types[tk] as Type };
    }
  }

  const look = await pickLook(baseSprite(A), baseSprite(B));
  if (!look) return null;
  const names = nameOptions(A.name, B.name);
  const ni = await listMenu('What is it called?', names, { w: 100,
    detail: () => { box(110, 4, 40, 40); drawSprite(look, 114, 8, 4); } });
  if (ni < 0) return null;
  return { moves, passives, types: types as Type[], basic, retune, sprite: look, name: names[ni] };
}

function confirm(A: Mon, B: Mon, p: FitPlan, cost: number): Promise<boolean> {
  let i = 0;
  const m: Mode = {
    opaque: true,
    update() {
      if (input.hit('up') || input.hit('down')) { i = 1 - i; sfx('move'); }
      if (input.hit('ok')) { sfx('ok'); close(m, i === 0); }
      if (input.hit('back')) { sfx('back'); close(m, false); }
    },
    draw() {
      rect(0, 0, 192, 192, '#17151d');
      box(2, 2, 188, 188);
      rect(6, 6, 34, 34, INK);
      drawSprite(p.sprite, 7, 7, 4);
      text(p.name, 46, 8, SEL);
      let tx = 46;
      for (const t of p.types) tx = typeBadge(t, tx, 18);
      text(`${A.name} and ${B.name}`, 46, 30, DIM);
      let y = 46;
      for (const id of p.moves) {
        const mv = MOVES[id];
        const ty = p.retune?.move === id ? p.retune.type : mv.type;
        sigil(ty, 6, y);
        text(mv.name + (p.retune?.move === id ? ` (now ${ty})` : ''), 15, y, PAPER);
        if (mv.nerve) textRight('crest', 186, y, NERVE);
        y += 9;
      }
      y += 3;
      for (const id of p.passives) { text(PASSIVES[id].name, 8, y, GOOD); y += 9; }
      y += 3;
      text(`Attacks: ${p.basic === 'P' ? 'physical' : 'magic'}`, 8, y, DIM);
      text(`The seam costs it ${Math.round((1 - FIT_STAT) * 100)}% of every stat.`, 8, 141, DIM);
      text(`Cost ${cost} cowries. You have ${G.rind}.`, 8, 150, G.rind >= cost ? PAPER : BADC);
      text('Both parents are gone after this.', 8, 160, WARN);
      ['Fit them', 'Not yet'].forEach((o, k) => { if (k === i) cursor(8, 170 + k * 9); text(o, 16, 170 + k * 9, k === i ? SEL : PAPER); });
      void bigCount;
    },
  };
  return run(m);
}
