// Lists every exit with its condition, for checking how the world connects.
import { MAPS } from '../game/maps';

for (const m of Object.values(MAPS)) {
  for (const e of m.exits) console.log(`${m.id} (${e.x},${e.y}) -> ${e.to} (${e.tx},${e.ty})${e.cond ? ` if ${e.cond}` : ''}${e.block ? ` else ${e.block}` : ''}`);
}
