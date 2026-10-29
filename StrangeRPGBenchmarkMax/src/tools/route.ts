// Prints the exits, triggers, talkers, and markers of maps, for planning test routes. Usage: node dist-tools/route.js map [map...]
import { MAPS } from '../game/map';
import { loadMaps } from '../content/maps';

loadMaps();
for (const id of process.argv.slice(2)) {
  const m = MAPS.get(id);
  if (!m) { console.log(`== ${id}: no such map`); continue; }
  console.log(`== ${id} (${m.rows[0].length} by ${m.rows.length}, region ${m.region})${m.enterScene ? ` enterScene ${m.enterScene}` : ''}`);
  for (const e of m.exits ?? []) console.log(`  exit ${JSON.stringify(e)}`);
  for (const t of m.triggers ?? []) console.log(`  trigger ${t.scene} at ${t.x},${t.y} w${t.w ?? 1} h${t.h ?? 1}${t.cond ? ` if ${t.cond}` : ''}`);
  for (const n of m.npcs ?? []) if (n.talk) console.log(`  npc ${n.id} at ${n.x},${n.y} talk ${n.talk}${n.cond ? ` if ${n.cond}` : ''}`);
  for (const p of m.props ?? []) if (p.talk) console.log(`  prop ${p.art} at ${p.x},${p.y} talk ${p.talk}${p.cond ? ` if ${p.cond}` : ''}`);
  for (const g of m.gates ?? []) console.log(`  gate at ${g.x},${g.y} opens on ${g.flag}`);
  for (const e of m.encounters ?? []) console.log(`  encounter ${e.group} at ${e.x},${e.y}${e.cond ? ` if ${e.cond}` : ''}`);
  console.log(`  markers ${Object.entries(m.markers ?? {}).map(([k, v]) => `${k}=${v.join(',')}`).join(' ')}`);
}
