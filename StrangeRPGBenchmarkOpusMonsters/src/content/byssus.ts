// The Shellwright introduces Byssus the first time a player picks it at a grotto counter, as with Prise.
import { flag, hint, say, setFlag } from '../game/api';

/** Says the introduction once. Later visits go straight to the Byssus menu. */
export async function introduceByssus(): Promise<void> {
  if (flag('byssusTold')) return;
  await say('Shellwright', 'Byssus, right? That mussel thread.');
  await say('Shellwright', 'I\'ll spin a line to a distant grotto, and you\'ll find a team waiting.');
  await say('Shellwright', 'Bring six whorls. Four fighters, each at level twenty-five. Each species once, each notion once.');
  await say('Shellwright', 'Include one legendary, at most. No charms.');
  await say('Shellwright', 'Check the roster in the menu to see which whorl breaks what.');
  await say('Shellwright', 'Have a friend? Create a code and share it. Solo? Spin for whoever else is online.');
  await say('Shellwright', 'Track wins and losses. No cowries or pearls. Anything else?');
  setFlag('byssusTold');
  await hint('(Press X, select Register, then press left on the first page. Find the Byssus section in the Guide.)');
}
