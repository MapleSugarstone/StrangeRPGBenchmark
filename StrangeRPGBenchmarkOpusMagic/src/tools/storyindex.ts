// Prints, for every story scene in a chapter, what plays it and which flags it sets. For planning playthroughs.
import { MAPS } from '../game/maps';
import { ENCOUNTERS } from '../game/enemies';
import { SCENES } from '../story/script';

const prefix = process.argv[2] ?? 'c1_';
const how = new Map<string, string[]>();
const add = (sc: string, s: string) => { const l = how.get(sc) ?? []; l.push(s); how.set(sc, l); };
for (const m of Object.values(MAPS)) {
  for (const [c, sc] of m.enter ?? []) add(sc, `enter ${m.id} [${c}]`);
  for (const t of m.triggers) add(t.scene, `trigger ${m.id} ${t.x},${t.y}${t.w ? ` w${t.w}` : ''}${t.h ? ` h${t.h}` : ''} [${t.cond ?? ''}]`);
  for (const e of m.exits) if (e.block) add(e.block, `block ${m.id} ${e.x},${e.y} -> ${e.to} [${e.cond ?? ''}]`);
  for (const a of m.actors) {
    for (const [c, sc] of a.talk ?? []) add(sc, `talk ${m.id} ${a.id}@${a.x},${a.y} [${c}] actorcond[${a.cond ?? ''}]`);
    if (a.puzzle?.scene) add(a.puzzle.scene, `puzzle ${m.id} ${a.id}@${a.x},${a.y} flag ${a.puzzle.flag}`);
  }
}
for (const [k, e] of Object.entries(ENCOUNTERS)) if (e.after) add(e.after, `after battle ${k}`);
for (const sc of Object.values(SCENES)) {
  for (const it of sc.items) {
    if (it.k === 'choice') add(it.target, `choice in ${sc.id}`);
    if (it.k === 'cmd' && it.cmd === 'goto') add(it.args[0], `goto from ${sc.id}`);
  }
}
for (const sc of Object.values(SCENES)) {
  if (!sc.id.startsWith(prefix)) continue;
  const sets = sc.items.filter((it) => it.k === 'cmd' && ['set', 'join', 'leave', 'give', 'word', 'battle', 'end_chapter', 'goto'].includes(it.cmd)).map((it) => (it.k === 'cmd' ? `${it.cmd} ${it.args.join(' ')}` : ''));
  console.log(`${sc.id}: ${(how.get(sc.id) ?? ['(nothing plays it)']).join(' ; ')}`);
  if (sets.length) console.log(`    -> ${sets.join(', ')}`);
}
