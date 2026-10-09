import { defScript } from '../game/world';
import { G, setFlag } from '../game/state';
import { choose, fightWild, giveMon, say } from '../game/api';
import { makeMon } from '../data/species';
import { out, pegLine } from '../battle/engine';

// The Strandmonger's lesson: a practice fight with a boot nobody will buy, with notes on fighting and sounding.
defScript('lesson', async () => {
  await say('Strandmonger', 'Lesson? Lessons are free. I have a boot out back nobody will buy. One boot.');
  const c = await choose(['Show me', 'I know how']);
  if (c !== 0) { await say('Strandmonger', 'Then the lesson cost nothing and you got all of it.'); return; }
  await say('Strandmonger', 'Knock it down a bit, then sound it. Weaker means surer. Then it\'s yours, and I stop feeding a boot.');
  setFlag('lesson');
  const r = await fightWild(makeMon('brogue', 3), {
    canRun: false,
    area: 'back shelf',
    tips: [
      { when: () => true, lines: [
        '(Your whorl fights the boot. You pick one action each turn.)',
        '(Attack never runs out. A move hits harder. Then it rests a few turns before you can use it again.)',
        '(Look at a choice before you pick it. It says what it does, and if the foe is weak to it.)',
      ] },
      { when: b => b.turnNo >= 3, lines: [
        '(Guard cuts the damage you take in half until your next turn.)',
        '(Switch sends out a whorl from your reserve. You only have one whorl for now.)',
      ] },
      { when: b => { const me = out(b, 0), foe = out(b, 1); return !foe.ko && G.pegs.twig > 0 && foe.hp <= foe.maxHp * pegLine(b, me, foe, 'twig'); }, lines: [
        '(A horn can sound a whorl at any HP. The lower its HP, the better the chance.)',
        '(The boot is under the line on its HP bar now. Under the line, the horn never fails.)',
        '(Pick Sound and blow a horn. A sounded whorl joins you. Knock it out and it gets away.)',
      ] },
    ],
  });
  if (r.pegged.length) {
    await giveMon(r.pegged[0]);
    await say('Strandmonger', 'Sold, for nothing!! Don\'t tell anyone. I have a name to keep.');
  } else if (r.result === 'win') await say('Strandmonger', 'Flat, and off it walks. Weaken it, then the horn. The boot knew that.');
  else await say('Strandmonger', 'The boot won. First thing it ever won. I\'m raising its price.');
});
