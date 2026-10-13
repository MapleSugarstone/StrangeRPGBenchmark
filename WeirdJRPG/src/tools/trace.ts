// Prints one fight turn by turn with the shared policy, to see where the rounds go. Usage: node dist-tools/trace.js <group> [stage] [seed]
import { newBattle, doMove, doAction, doVorn, doLb, enemyPhase, endRound, pilgrimSkips, liveFoes, total, type Ev } from '../battle/engine';
import { pilgrimMove, pilgrimAct, vornChoice, lbChoice } from '../battle/policy';
import { GROUPS } from '../battle/enemies';
import { STAGES, SCRIPTED, party } from '../battle/campaign';

declare const process: { argv: string[] };
const [group, stageName, seedArg] = process.argv.slice(2);
const st = STAGES.find(s => s.name === stageName) || STAGES.find(s => s.groups.includes(group))!;
const b = newBattle(GROUPS[group], party(st), { seed: Number(seedArg) || 1001, scripted: SCRIPTED[group] });
const said = (evs: Ev[]) => evs.filter(e => e.t === 'say').map(e => (e as { text: string }).text).join(' | ');
while (!b.outcome && b.round < 30) {
  const foes = liveFoes(b).map(f => `${f.name}@${f.cell} ${total(f)}${f.windup ? ' W' + f.windup.locks.length : ''}`).join(', ');
  let line = `R${b.round} P@${b.p.cell} F${Math.round(b.p.f)}/${b.p.fmax} [${foes}] `;
  if (!pilgrimSkips(b)) {
    const m = pilgrimMove(b);
    if (m) { doMove(b, m); line += `${m.kind}->${m.to} `; }
    const a = pilgrimAct(b);
    line += `${a.id}${a.push ? '(push)' : ''} ` + said(doAction(b, a));
  }
  if (!b.outcome && b.vorn && !b.vorn.down) { const c = vornChoice(b); doVorn(b, c.id, c.target); line += ` / V:${c.id}`; }
  if (!b.outcome && b.lb && !b.lb.down) { const c = lbChoice(b); doLb(b, c.id, { dish: c.dish, target: c.target }); line += ` / L:${c.id}`; }
  if (!b.outcome) line += ' || ' + said(enemyPhase(b));
  if (!b.outcome) endRound(b);
  console.log(line);
}
console.log('outcome', b.outcome, 'rounds', b.round);
