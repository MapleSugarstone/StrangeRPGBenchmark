// Traces one simulated battle round by round. Usage: node dist-tools/trace.js group level [seed]
import { buildBattle } from '../battle/setup';
import { party, foes, runFoePhase, visibleIntents, leadOf, makeRng, reachable, moveUnit, useSkill, validTargets, previewTiles, unitAt, cantUse } from '../battle/rules';
import { SKILLS } from '../battle/skills';

const group = process.argv[2] ?? 'g_pebblers';
const level = Number(process.argv[3] ?? 2);
const seed = Number(process.argv[4] ?? 5);
const w = 14, h = 10;
const solid = new Uint8Array(w * h);
const st = buildBattle({ w, h, solid, heat: new Uint8Array(w * h), sun: { dir: [1, 0], lowness: 3 }, dark: false, partyAt: { x: 4, y: 5 }, foeAt: { x: 9, y: 4 } },
  [{ id: 'nodus', level, hp: 999, gear: null }, { id: 'parhelia', level, hp: 999, gear: null }], group, seed, 0);
void makeRng;
const show = () => st.units.filter((u) => u.alive).map((u) => `${u.id}@${u.x},${u.y} hp${u.hp}` + (u.side === 'foe' ? ` plan[${visibleIntents(st, u).map((i) => `${i.skill}->${i.dest.x},${i.dest.y}`).join(' ')}] lead${JSON.stringify(leadOf(st, u))}` : '')).join('\n  ');
for (let r = 0; r < 12 && !st.result; r++) {
  console.log(`ROUND ${st.round}\n  ${show()}`);
  for (const u of party(st)) {
    const fs = foes(st);
    const near = fs.slice().sort((a, b) => Math.abs(a.x - u.x) + Math.abs(a.y - u.y) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
    if (!near) break;
    const dests = reachable(st, u).sort((a, b) => Math.abs(a.x - near.x) + Math.abs(a.y - near.y) - (Math.abs(b.x - near.x) + Math.abs(b.y - near.y)));
    let done = false;
    for (const d of dests.slice(0, 4)) {
      const ox = u.x, oy = u.y; u.x = d.x; u.y = d.y;
      for (const s of u.skills) {
        const sk = SKILLS[s];
        if (!sk || sk.power === undefined || cantUse(st, u, s)) continue;
        for (const t of validTargets(st, u, s)) if (previewTiles(st, u, s, t).some((p) => unitAt(st, p.x, p.y)?.side === 'foe')) { u.x = ox; u.y = oy; moveUnit(st, u, d); useSkill(st, u, s, t); console.log(`  ${u.id} -> ${d.x},${d.y} ${s}`); done = true; break; }
        if (done) break;
      }
      if (done) break;
      u.x = ox; u.y = oy;
    }
    if (!done) { moveUnit(st, u, dests[0] ?? u); useSkill(st, u, 'wait', {}); console.log(`  ${u.id} -> ${dests[0]?.x},${dests[0]?.y} wait`); }
  }
  st.events = [];
  runFoePhase(st);
  for (const e of st.events) if (e.k === 'hit' || e.k === 'skill' && e.tiles.length) console.log('    ' + JSON.stringify(e));
  st.events = [];
}
console.log('RESULT', st.result, show());
