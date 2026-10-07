// Prints a map's rows with actors and exits marked, for placing details by hand.
import { MAPS } from '../game/maps';

const id = process.argv[2] ?? 'busy';
const m = MAPS[id];
const rows = m.rows.map((r) => r.split(''));
const marks: string[] = [];
m.actors.forEach((a, i) => {
  const ch = String.fromCharCode(i < 26 ? 97 + i : 65 + (i - 26) % 26);
  if (rows[a.y]?.[a.x] !== undefined) rows[a.y][a.x] = '\x1b[33m' + ch + '\x1b[0m';
  marks.push(`${ch}=${a.id}${a.cond ? ` (${a.cond})` : ''}`);
});
for (const e of m.exits) if (rows[e.y]?.[e.x] !== undefined) rows[e.y][e.x] = '\x1b[36m>\x1b[0m';
const head = '   ' + rows[0].map((_, x) => (x % 10).toString()).join('');
console.log(head);
rows.forEach((r, y) => console.log(String(y).padStart(2) + ' ' + r.join('')));
console.log(marks.join('  '));
