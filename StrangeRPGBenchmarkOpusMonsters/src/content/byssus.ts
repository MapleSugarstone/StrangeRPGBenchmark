// The Shellwright introduces Byssus the first time a player picks it at a grotto counter, as with Prise.
import { flag, hint, say, setFlag } from '../game/api';

/** Says the introduction once. Later visits go straight to the Byssus menu. */
export async function introduceByssus(): Promise<void> {
  if (flag('byssusTold')) return;
  await say('Shellwright', 'Byssus, yeah? Mussel thread. I spin one out to a grotto far off, and somebody\'s there with a team.');
  await say('Shellwright', 'Bring six whorls. Four fight, every one at level twenty-five. Each kind once, each notion once.');
  await say('Shellwright', 'One legendary, tops. No charms. Roster\'s in the menu, and it says which whorl breaks what.');
  await say('Shellwright', 'Got a friend? Make a code and read it out. No friend? Spin for whoever\'s out there.');
  await say('Shellwright', 'Wins and losses go on a tally. No cowries, no pearls. Anything else?');
  setFlag('byssusTold');
  await hint('(Press X, pick Register, then press left on its first page. The Guide has a Byssus chapter.)');
}
