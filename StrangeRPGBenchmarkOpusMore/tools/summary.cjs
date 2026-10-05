// Prints a compact per-boss table from reports/metrics.json.
const m = require('../reports/metrics.json');
for (const c of m.chapters) {
  const row = [`ch${c.n}`, `fight ${c.fightLen.toFixed(1)}a ${(c.fightHpLost * 100).toFixed(0)}%hp`, `fun ${c.fun?.index?.toFixed?.(0) ?? c.fun?.toFixed?.(0) ?? '?'}`];
  for (const b of c.bosses) {
    const v = b.v;
    const w = (k) => (v[k] ? v[k].win.toFixed(2) : '-');
    row.push(`${b.group}(p${b.partyLvl}/b${b.bossLvl}) smart ${w('smart')} ${v.smart?.actions.m.toFixed(0)}a casual ${w('casual')} hp${v.casual?.hp.m.toFixed(2)} mash ${w('mash')} atk ${w('attack')} rnd ${w('random')}`);
  }
  console.log(row.join(' | '));
}
