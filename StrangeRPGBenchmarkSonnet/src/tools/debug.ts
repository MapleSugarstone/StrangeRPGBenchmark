import { Battle } from '../core/battle';
import { chooseAction } from '../core/bots';
import { mechsFor, memberStats } from '../core/party';
import { Rng } from '../core/rng';
import { BOSSES, buildFoe, ENEMIES, foeLevel, TUNE } from '../data/enemies';
import { chapterState, BOSS_BONUS, REG_BONUS, buildParty, pickEncounter } from '../sim/simlib';

const ch = Number(process.argv[2] ?? 2);
if (process.env.HP) TUNE.hp = Number(process.env.HP);
if (process.env.ATK) TUNE.atk = Number(process.env.ATK);
const policy = (process.argv[3] ?? 'smart') as 'smart' | 'mash';
const rng = new Rng(Number(process.argv[4] ?? 5));
const s = chapterState(ch, process.env.PARTY ? process.env.PARTY.split(",") : undefined, process.env.REG === "1" ? REG_BONUS : BOSS_BONUS);
const off = Number(process.env.OFF ?? 0);
if (off) for (const m of s.roster) { m.lvl = Math.max(1, m.lvl - off); const st = memberStats(m); m.hp = st.hp; m.mp = st.mp; }
const reg = process.env.REG === '1';
const foeIds = reg ? pickEncounter(ch, rng) : BOSSES[ch][BOSSES[ch].length - 1];
const foes = foeIds.map((id) => buildFoe(id, foeLevel(ch, ENEMIES[id], 0.85), ch));
const party = buildParty(s);
const b = new Battle({ party, foes, inv: { ...s.inv }, mech: mechsFor(ch), seed: 3, boss: !reg });
const line = () => b.units.map((u) => `${u.name}:${Math.max(0, u.hp)}/${u.maxHp}${u.mp ? ' mp' + u.mp : ''}${Object.keys(u.status).length ? '[' + Object.keys(u.status).join(',') + ']' : ''}`).join('  ');
console.log('START', line());
let n = 0;
while (!b.over && n++ < Number(process.env.N ?? 80)) {
  const a = chooseAction(b, policy, rng);
  const who = b.actor!.name;
  const evs = b.act(a);
  const dmg = evs.filter((e) => e.t === 'dmg').map((e) => `${b.units[(e as { u: number }).u].name}-${(e as { n: number }).n}`).join(' ');
  console.log(`${String(n).padStart(2)} ${who} ${JSON.stringify(a)} ${dmg}`);
  if (n % 4 === 0) console.log('   ', line());
}
console.log('END', b.over, line());
