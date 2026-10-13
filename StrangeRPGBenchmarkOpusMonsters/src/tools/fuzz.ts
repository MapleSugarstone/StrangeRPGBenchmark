// Plays AI battles and stops at a broken state: a whorl at 0 HP that is not knocked out, a side asked to act while its out
// whorl is down, or a crash. Prints the teams and the battle's last lines for each one found.
// Usage: node dist-tools/fuzz.js [seed] [battles]
import { advance, newBattle } from '../battle/engine';
import { aiTurn, chooseReplacement } from '../battle/ai';
import type { Battle, Decision } from '../battle/model';
import { WILD_KINDS, makeMon } from '../data/species';

declare const process: { argv: string[]; exitCode: number };
let seed = Number(process.argv[2] || 1);
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const team = () => { const s = new Set<string>(); while (s.size < 4) s.add(WILD_KINDS[Math.floor(rnd() * WILD_KINDS.length)]); return [...s].map(k => makeMon(k, 25)); };
const lines = (b: Battle) => b.ev.filter(e => e.e === 'msg').slice(-14).map(e => '  ' + (e as { text: string }).text).join('\n');
const teams = (b: Battle) => b.s.map((s, i) => `side ${i}: ` + s.f.map((f, k) => `${f.mon.kind}${k === s.out ? '*' : ''} ${f.hp}/${f.maxHp}${f.ko ? ' KO' : ''}${f.gone ? ' gone' : ''}`).join(', ')).join('\n');

const N = Number(process.argv[3] || 200);
let broken = 0;
for (let g = 0; g < N && broken < 3; g++) {
  const b = newBattle({ mons: team(), name: 'A', ai: 'keeper' }, { mons: team(), name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
  b.quiet = false;
  const report = (what: string) => { console.log(`battle ${g}: ${what}\n${teams(b)}\n${lines(b)}`); broken++; };
  for (let i = 0; i < 400; i++) {
    let d: Decision;
    try { d = advance(b, chooseReplacement); } catch (e) { report(`advance threw ${(e as Error).message}`); break; }
    for (const s of b.s) for (const f of s.f) if (f.hp <= 0 && !f.ko && !f.gone) report(`step ${i}: ${f.mon.kind} has ${f.hp} HP and is not down`);
    if (d.kind === 'act' || d.kind === 'joint') {
      for (const sd of [0, 1] as const) {
        const o = b.s[sd].f[b.s[sd].out];
        if ((d.kind === 'joint' || d.side === sd) && (!o || o.ko || o.gone)) report(`step ${i}: side ${sd} was asked to act (${d.kind}) with its out whorl down`);
      }
    }
    if (broken || d.kind === 'over') break;
    if (d.kind === 'act' || d.kind === 'joint') { try { aiTurn(b); } catch (e) { report(`the AI threw ${(e as Error).message}`); break; } }
    if (b.ev.length > 400) b.ev.splice(0, b.ev.length - 100);
  }
}
console.log(`${N} battles, ${broken} broken`);
if (broken) process.exitCode = 1;
