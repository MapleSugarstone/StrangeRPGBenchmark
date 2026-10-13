// Move usage under the round rules: how often the AI picks each move when its owner is out, and for rarely used moves,
// what forcing the move at the owner's first decision does compared with a plain attack.
// Usage: node dist-tools/usage.js [battles per kind] [--seed=N] [--out=file] [--progress=file] [--stop=file] [--minutes=N]
// The progress file (default Notes/usage-progress.txt) shows battles done and an ETA. The stop file (default
// dist-tools/usage.stop) or the time limit ends the run early, skips the forced tests left, and marks the report partial.
import { clearStop, progressHead, runCtl, writeText } from './runctl';
import { actJoint, act, advance, legal, newBattle, out, usable } from '../battle/engine';
import { aiTurn, choose, chooseReplacement } from '../battle/ai';
import type { Action, Battle, Mon } from '../battle/model';
import { MOVES } from '../battle/registry';
import { SPECIES, WILD_KINDS, makeMon } from '../data/species';

declare const process: { argv: string[] };
const fs = await import('node:fs');

const args = process.argv.slice(2);
const ctl = runCtl(args, 'usage');
clearStop(ctl);
let lastTick = 0, forcedDone = 0;
const tick = (state = 'running', force = false): void => {
  if (!force && Date.now() - lastTick < 3000) return;
  lastTick = Date.now();
  writeText(ctl.progress, `${progressHead(ctl, battles, WILD_KINDS.length * PER, state)}\nforced tests done: ${forcedDone}\n`);
};
const PER = Number(args.find(a => /^\d+$/.test(a)) || 3);
let seed = Number((args.find(a => a.startsWith('--seed=')) || '--seed=99').slice(7));
const outFile = (args.find(a => a.startsWith('--out=')) || '').slice(6);
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const team = (lead?: string): Mon[] => {
  const s = new Set<string>(lead ? [lead] : []);
  while (s.size < 4) s.add(pick(WILD_KINDS));
  return [...s].map(k => makeMon(k, 50));
};
const fresh = (a: Mon[], z: Mon[]): Battle => {
  const b = newBattle({ mons: a, name: 'A', ai: 'keeper' }, { mons: z, name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
  b.quiet = true;
  return b;
};

// A: each move's share of its owner's decisions, and its share of the decisions where it was ready to use.
const decisions: Record<string, number> = {}, ready: Record<string, number> = {}, uses: Record<string, number> = {};
const t0 = Date.now();
let battles = 0, joint = 0, solo = 0;
for (const kind of WILD_KINDS) {
  if (ctl.halted()) break;
  for (let n = 0; n < PER && !ctl.halted(); n++) {
    const b = fresh(team(kind), team());
    battles++;
    tick();
    for (let i = 0; i < 400 && b.over === null; i++) {
      const d = advance(b, chooseReplacement);
      if (d.kind === 'over') break;
      if (d.kind !== 'act' && d.kind !== 'joint') continue;
      if (d.kind === 'joint') joint++; else solo++;
      const sides: (0 | 1)[] = d.kind === 'joint' ? [0, 1] : [d.side];
      // Moves are read before the round resolves, while each slot still holds the move that was picked.
      const slots = [out(b, 0).moves.slice(), out(b, 1).moves.slice()];
      for (const side of sides) {
        const f = out(b, side);
        decisions[f.mon.kind] = (decisions[f.mon.kind] || 0) + 1;
        f.moves.forEach((id, k) => { if (usable(b, f, k).ok) ready[id] = (ready[id] || 0) + 1; });
      }
      for (const { side, a } of aiTurn(b)) if (a.k === 'move') { const id = slots[side][a.i]; uses[id] = (uses[id] || 0) + 1; }
    }
  }
}
const tA = (Date.now() - t0) / 1000;

interface Row { id: string; kind: string; name: string; share: number; whenReady: number; turns: number; readyN: number; big: boolean; summon: boolean; mark: boolean }
const rows: Row[] = [];
for (const kind of WILD_KINDS) {
  for (const id of SPECIES[kind].moves) {
    const m = MOVES[id];
    const src = String(m.run);
    const turns = decisions[kind] || 0, readyN = ready[id] || 0, u = uses[id] || 0;
    rows.push({ id, kind, name: m.name, share: u / Math.max(1, turns), whenReady: u / Math.max(1, readyN), turns, readyN, big: !!m.nerve, summon: /summon(Twin)?\(/.test(src), mark: /mark\(/.test(src) });
  }
}
// Rare: picked under 5% of the times it was ready (2% for crests, which wait on tide), with at least 15 ready decisions.
const never = rows.filter(r => r.readyN >= 15 && !uses[r.id]);
const rare = rows.filter(r => r.readyN >= 15 && (uses[r.id] || 0) > 0 && r.whenReady < (r.big ? 0.02 : 0.05)).sort((a, z) => a.whenReady - z.whenReady);
const thin = rows.filter(r => r.readyN < 15);

// B: force a rare or unused move at its owner's first decision, and compare the foe side's HP lost over the next 6
// decisions with a plain attack in the same spot. Positive numbers mean the move beat the attack.
function forced(r: Row): { move: number; attack: number; errors: number; err: string } {
  if (ctl.halted()) return { move: 0, attack: 0, errors: 1, err: 'skipped, the run was stopped early' };
  forcedDone++;
  tick();
  let move = 0, attack = 0, errors = 0, err = '';
  for (let t = 0; t < 10; t++) {
    const mine = team(r.kind), foes = team();
    for (const variant of ['move', 'attack'] as const) {
      const b = fresh(mine.map(m => ({ ...m })), foes.map(m => ({ ...m })));
      b.s[0].nerve = 6;
      const hp0 = b.s[1].f.reduce((s, f) => s + f.hp, 0);
      try {
        let done = false, acts = 0;
        for (let i = 0; i < 300 && b.over === null && acts < 7; i++) {
          const d = advance(b, chooseReplacement);
          if (d.kind === 'over') break;
          if (d.kind !== 'act' && d.kind !== 'joint') continue;
          acts++;
          const mineNow = d.kind === 'joint' || d.side === 0;
          if (!done && mineNow && out(b, 0).mon.kind === r.kind) {
            done = true;
            const f = out(b, 0);
            const k = f.moves.indexOf(r.id);
            const pickA: Action = (variant === 'move' && legal(b, 0).find(a => a.k === 'move' && a.i === k)) || { k: 'attack' };
            if (d.kind === 'joint') actJoint(b, pickA, choose(b, 1)); else act(b, pickA);
            continue;
          }
          aiTurn(b);
        }
      } catch (e) { errors++; if (!err) err = (e as Error).message; }
      const lost = hp0 - b.s[1].f.reduce((s, f) => s + Math.max(0, f.hp), 0);
      if (variant === 'move') move += lost; else attack += lost;
    }
  }
  return { move: Math.round(move / 10), attack: Math.round(attack / 10), errors, err };
}

const lines: string[] = [];
const pct = (x: number) => (100 * x).toFixed(1) + '%';
const tag = (r: Row) => `${r.big ? ' crest' : ''}${r.summon ? ' summon' : ''}${r.mark ? ' mark' : ''}`;
lines.push(`## Move usage under the round rules`);
lines.push('');
lines.push(`${battles} battles (${PER} per kind with the kind in the lead team), ${joint} joint rounds and ${solo} solo turns decided, ${tA.toFixed(0)}s.${ctl.halted() ? ` PARTIAL: stopped early after ${battles} of ${WILD_KINDS.length * PER} battles.` : ''}`);
lines.push(`${rows.length} wild moves. ${never.length} never picked when ready, ${rare.length} rarely picked (under 5% of ready decisions, 2% for crests), ${thin.length} with too few ready decisions to judge.`);
lines.push('');
lines.push('Each line: the move, its kind, how often it was picked when ready, how many ready decisions that was, and the forced test (foe HP lost over 6 decisions with the move forced first, against a plain attack).');
lines.push('');
lines.push('### Never picked');
for (const r of never) { const f = forced(r); lines.push(`${r.name.padEnd(16)} ${r.kind.padEnd(11)} 0 of ${r.readyN} ready${tag(r)} | forced: move ${f.move} vs attack ${f.attack}${f.errors ? ` | ${f.errors} errors: ${f.err}` : ''}`); }
lines.push('');
lines.push('### Rarely picked');
for (const r of rare) { const f = forced(r); lines.push(`${r.name.padEnd(16)} ${r.kind.padEnd(11)} ${pct(r.whenReady).padStart(5)} of ${r.readyN} ready${tag(r)} | forced: move ${f.move} vs attack ${f.attack}${f.errors ? ` | ${f.errors} errors: ${f.err}` : ''}`); }
lines.push('');
lines.push(`### Too little data (${thin.length})`);
lines.push(thin.map(r => `${r.name} (${r.kind}, ${r.readyN})`).join(', '));
lines.push('');
lines.push(`Done in ${((Date.now() - t0) / 1000).toFixed(0)}s.`);
const text = lines.join('\n');
tick(ctl.halted() ? 'stopped early' : 'finished', true);
if (outFile) fs.writeFileSync(outFile, text);
console.log(text);
