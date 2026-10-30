// Companions as systems: approval tier scenes, the two conflicts, and the romance arcs, all played at camp.
// Scenes: src/script/crew.txt. Notes: Notes/replay-b-notes.md.
import { addCamp, type CampScene } from './camp';
import { addItems } from '../rules/data';

addItems([
  { id: 'flightpatch', name: 'Flight Patch', kind: 'key', price: 0, desc: 'A Board Logistics pilot patch with the Board emblem torn off. Sallis keeps a spare.' },
]);

const CREW = ['courtesy', 'sallis', 'quaye', 'ambrose', 'tova', 'ignace'];
const ROMANCE = ['sallis', 'tova', 'ambrose', 'quaye'];

/** Conditions for a companion being at camp, as alternatives. Courtesy is away between its capture and its rescue. */
function present(id: string): string[] {
  if (id === 'courtesy') return ['roster:courtesy&!courtesy_taken', 'roster:courtesy&courtesy_freed'];
  return [`roster:${id}`];
}
/** Joins a condition onto every alternative, since `|` splits before `&`. */
function all(cond: string, ...alts: string[][]): string {
  let out = [cond];
  for (const a of alts) out = out.flatMap((o) => a.map((x) => `${o}&${x}`));
  return out.join('|');
}

const list: CampScene[] = [];
for (const id of CREW) {
  list.push({ scene: `w_${id}`, when: all(`approval:${id}<-10&chapter>=3`, present(id)), priority: 80 });
  list.push({ scene: `d_${id}`, when: all(`approval:${id}>=30&chapter>=3`, present(id)), priority: 76 });
  list.push({ scene: `f_${id}`, when: all(`approval:${id}>=15&chapter>=3`, present(id)), priority: 72 });
}

// Tova and Ignace: the Church sold the Saint. Sallis and Quaye: Quaye signed the vault transfer.
const both = (a: string, b: string) => `roster:${a}&roster:${b}`;
list.push(
  { scene: 'ti_flare', when: `ledger_found&chapter>=3&${both('tova', 'ignace')}`, priority: 84 },
  { scene: 'ti_confront', when: `ti_flared&chapter>=4&${both('tova', 'ignace')}&rel:tova-ignace<0`, priority: 86 },
  { scene: 'ti_split', when: ['ti_ignored', 'ti_failed'].map((f) => `${f}&chapter>=5&${both('tova', 'ignace')}&rel:tova-ignace<0`).join('|'), priority: 88 },
  { scene: 'sq_flare', when: `quaye_confessed&chapter>=3&${both('sallis', 'quaye')}`, priority: 84 },
  { scene: 'sq_confront', when: `sq_flared&chapter>=4&${both('sallis', 'quaye')}&rel:sallis-quaye<0`, priority: 86 },
  { scene: 'sq_split', when: ['sq_ignored', 'sq_failed'].map((f) => `${f}&chapter>=5&${both('sallis', 'quaye')}&rel:sallis-quaye<0`).join('|'), priority: 88 },
);

// Romance: a spark, a closer moment, the chapter 5 night (camp5.txt), and the chapter 6 commitment (ch6.txt).
for (const id of ROMANCE) {
  const open = `!rom_${id}_off`;
  list.push({ scene: `rom1_${id}`, when: `approval:${id}>=10&chapter>=3&roster:${id}&!rom_${id}_1&!rom_${id}_no&${open}`, priority: 68 });
  list.push({ scene: `rom2_${id}`, when: `rom_${id}_1&${open}&approval:${id}>=18&chapter>=4&roster:${id}`, priority: 66 });
}
const pairs: string[] = [];
for (let i = 0; i < ROMANCE.length; i++) for (let j = i + 1; j < ROMANCE.length; j++) {
  const a = ROMANCE[i], b = ROMANCE[j];
  pairs.push(`rom_${a}_1&!rom_${a}_off&rom_${b}_1&!rom_${b}_off&roster:${a}&roster:${b}`);
}
list.push({ scene: 'rom_noticed', when: pairs.join('|'), priority: 89, repeat: true });

list.push({ scene: 'bg_vein_sallis', when: 'bg:vein&chapter>=3&roster:sallis', priority: 74 });

addCamp(list);
