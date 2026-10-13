// Headless battle simulator: a scripted player fights every group at the state the story reaches it.
// Usage: node dist-tools/sim.js [runs]
import { newBattle, doMove, doAction, doVorn, doLb, enemyPhase, endRound, pilgrimSkips, overloaded, faded, type Battle } from '../battle/engine';
import { pilgrimMove, pilgrimAct, vornChoice, lbChoice } from '../battle/policy';
import { GROUPS, ENEMIES } from '../battle/enemies';
import { STAGES, party, type Stage } from '../battle/campaign';

function pilgrimTurn(b: Battle): void {
  const m = pilgrimMove(b);
  if (m) doMove(b, m);
  doAction(b, pilgrimAct(b));
}

function vornTurn(b: Battle): void {
  if (b.vorn!.down) return;
  const c = vornChoice(b);
  doVorn(b, c.id, c.target);
}

function lbTurn(b: Battle): void {
  if (b.lb!.down) return;
  const c = lbChoice(b);
  doLb(b, c.id, { dish: c.dish, target: (c as { target?: number }).target });
}

function fight(st: Stage, group: string, seed: number): { win: boolean; rounds: number; fLeft: number; overRounds: number; fadedRounds: number } {
  const b = newBattle(GROUPS[group], party(st), { seed });
  let over = 0, fad = 0;
  while (!b.outcome && b.round < 60) {
    if (!pilgrimSkips(b)) pilgrimTurn(b);
    if (!b.outcome && b.vorn) vornTurn(b);
    if (!b.outcome && b.lb) lbTurn(b);
    if (!b.outcome) enemyPhase(b);
    if (!b.outcome) endRound(b);
    if (overloaded(b)) over++;
    if (faded(b)) fad++;
  }
  return { win: b.outcome === 'win' || b.outcome === 'choice', rounds: b.round, fLeft: b.p.f / b.p.fmax, overRounds: over, fadedRounds: fad };
}

declare const process: { argv: string[] };
const runs = Number(process.argv[2]) || 40;
console.log('stage     group            win%  rounds  F left  over  faded');
for (const st of STAGES) {
  for (const g of st.groups) {
    let w = 0, r = 0, f = 0, o = 0, fd = 0;
    for (let i = 0; i < runs; i++) { const x = fight(st, g, 1000 + i * 7919); if (x.win) w++; r += x.rounds; f += x.fLeft; o += x.overRounds; fd += x.fadedRounds; }
    const tot = GROUPS[g].map(id => Object.values(ENEMIES[id.split('@')[0]].layers).reduce((a, c) => a + (c || 0), 0)).reduce((a, c) => a + c, 0);
    console.log(`${st.name.padEnd(9)} ${g.padEnd(16)} ${String(Math.round((w / runs) * 100)).padStart(4)}  ${(r / runs).toFixed(1).padStart(6)}  ${((f / runs) * 100).toFixed(0).padStart(5)}%  ${(o / runs).toFixed(1).padStart(4)}  ${(fd / runs).toFixed(1).padStart(5)}   (${tot})`);
  }
}
