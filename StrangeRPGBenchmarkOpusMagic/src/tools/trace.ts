// Prints one fight round by round, for tuning. Usage: node dist-tools/trace.js <encounter> <page source> [level] [allies]
import { Battle, makePage } from '../game/battle';
import { ALLIES } from '../game/enemies';

const [, , enc = 'hold', src = 'soak foe\\njolt foe', lvl = '6', allies = 'halt'] = process.argv;
const level = Number(lvl);
const hp = 22 + 5 * (level - 1);
const b = new Battle({
  enc,
  wait: { hp, max: hp, ink: 10, maxInk: 10, regen: 3, hands: 1, ticks: 30 },
  allies: allies ? allies.split(',').filter(Boolean).map((k) => ({ key: k, hp: ALLIES[k].hp + ALLIES[k].hpPerLevel * (level - 1), max: ALLIES[k].hp + ALLIES[k].hpPerLevel * (level - 1) })) : [],
  pages: [makePage('wait', 'wait'), makePage('p', src.replace(/\\n/g, '\n'))],
  canSay: () => true,
  lent: {},
  items: {},
  seed: 3,
});
const show = (ev: ReturnType<Battle['start']>) => {
  for (const e of ev) {
    const n = (id: string) => b.byId(id)?.name ?? id;
    if (e.t === 'round') console.log(`-- round ${e.n}`);
    else if (e.t === 'line') console.log(`   ${n(e.who)}: ${e.text.trim()}${e.mute ? ' (mute)' : ''}`);
    else if (e.t === 'harm') console.log(`      ${n(e.who)} -${e.amount} -> ${e.snap.hp}`);
    else if (e.t === 'heal') console.log(`      ${n(e.who)} +${e.amount} -> ${e.snap.hp}`);
    else if (e.t === 'log') console.log(`   * ${e.text}`);
    else if (e.t === 'ink') console.log(`      ink ${e.ink}`);
  }
};
show(b.start());
let n = 0;
while (b.phase === 'command' && n++ < 40) show(b.act({ kind: 'cast', page: 1, target: b.livingFoes()[0].id }));
console.log(`result ${b.result} in ${b.round} rounds, wait hp ${b.wait.hp}`);
