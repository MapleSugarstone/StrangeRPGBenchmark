import { defScript } from '../game/world';
import { G, setFlag } from '../game/state';
import { choose, fightWild, giveMon, say } from '../game/api';
import { makeMon } from '../data/species';
import { out, pegLine } from '../battle/engine';

// The Strandmonger's lesson: a practice fight with a boot nobody will buy, with notes on fighting and sounding.
defScript('lesson', async () => {
  await say('Strandmonger', 'Lessons don\'t cost a thing. I\'ve got a rogue boot in the back room that nobody wants. Just one.');
  const c = await choose(['Display', 'I already know']);
  if (c !== 0) { await say('Strandmonger', 'Then it\'s free, and you\'ve learned all you need.'); return; }
  await say('Strandmonger', 'Knock it down a bit, then catch it. Weaker means surer. Then it\'s yours, and I stop feeding a boot.');
  setFlag('lesson');
  const r = await fightWild(makeMon('brogue', 2), {
    canRun: false,
    area: 'back shelf',
    tips: [
      { when: () => true, lines: [
        '(Your whorl clashes with the boot. Choose one action per turn.)',
        '(When your turns are near, you and your opponent choose moves at the same time.', 'The actions then resolve in order.)',
        '(Attack is unlimited. Special moves hit harder but need a cooldown of several turns.)',
        '(Preview your options before committing.', 'Each entry details its effect and whether the foe is vulnerable to it.)',
      ] },
      { when: b => b.turnNo >= 3, lines: [
        '(Guard takes priority. It halves incoming damage until your next turn.)',
        '(Switch also takes priority. It calls forth a whorl from your reserve.', 'You currently have only one available.)',
      ] },
      { when: b => { const me = out(b, 0), foe = out(b, 1); return !foe.ko && G.pegs.twig > 0 && foe.hp <= foe.maxHp * pegLine(b, me, foe, 'twig'); }, lines: [
        '(A horn can catch a whorl at any HP level. The lower the whorl\'s HP, the higher the success rate.)',
        '(The boot is now sufficiently weakened.', 'Selecting Catch will show "Sure" on the horn list, guaranteeing success.)',
        '(Choose Catch and blow a horn. A caught whorl joins you. If you knock it out, it gets away.)',
      ] },
    ],
  });
  if (r.pegged.length) {
    await giveMon(r.pegged[0]);
    await say('Strandmonger', 'It\'s yours, free of charge! But keep your mouth shut. I\'ve got a reputation to protect.');
  } else if (r.result === 'win') await say('Strandmonger', 'Flat, and off it walks. Soften it up, then hit the horn. The boot knew that.');
  else await say('Strandmonger', 'The boot pulled off a victory. Its very first win. I\'m hiking up its price.');
});
