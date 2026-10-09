// Where the minigames live: a Shellboard player in every Stay town, a champion in the Stack, and Prise at every grotto.
import { music } from '../engine/music';
import { SPECIES, WILD_KINDS } from '../data/species';
import { choose, field, hint, narr, say, tanneryExtras } from '../game/api';
import { scrape } from '../game/minigames/scrape';
import { listMenu } from '../game/menus';
import { cardOf, ownedCards, pegboard, type Card, type Rival } from '../game/minigames/pegboard';
import { G, flag, save, setFlag } from '../game/state';
import { defScript, MAPS } from '../game/world';
import { reward } from './areakit';

const RIVALS: (Rival & { map: string; x: number; y: number; sprite: string; lines: string[]; prize: string })[] = [
  { id: 'peg1', name: 'Bone-dealer', map: 'rib', x: 24, y: 14, sprite: 'elder', tier: 1, look: false, deck: ['cairn', 'hare', 'talus', 'molar', 'atlas'], prize: 'ribbon',
    lines: ['A cowrie a game. I deal in bone, so if I lose, you get paid in bone. Sorry in advance.'] },
  { id: 'peg2', name: 'Salt-card', map: 'mast', x: 6, y: 13, sprite: 'villager', tier: 2, look: false, deck: ['brine', 'scree', 'fluke', 'sail', 'keel'], prize: 'whetstone',
    lines: ['Cards dry out quick round here. Dry cards play faster. Faster than you, anyway.'] },
  { id: 'peg3', name: 'Verger\'s clerk', map: 'spire', x: 22, y: 24, sprite: 'villager2', tier: 3, look: false, deck: ['grotesque', 'siren', 'tenor', 'glaze', 'pew'], prize: 'waxcoat',
    lines: ['I keep the Verger\'s scores!! The Verger never plays, so I play the Verger\'s cards, most dutifully.'] },
  { id: 'peg4', name: 'Moss-player', map: 'bole', x: 12, y: 17, sprite: 'tanner', tier: 4, look: true, deck: ['thicket', 'orchard', 'taproot', 'whip', 'gnarl'], prize: 'warmstone',
    lines: ['Slow game, slow players. Waited so long there\'s moss on my left hand. Your go. Whenever.'] },
  { id: 'peg5', name: 'Ohm\'s apprentice', map: 'hum', x: 8, y: 16, sprite: 'child', tier: 5, look: true, deck: ['turbine', 'dynamo', 'kiln', 'belt', 'dish'], prize: 'lodestone',
    lines: ['I counted every card in the Volute. Ohm says not to tell people that. Oops.'] },
  { id: 'peg6', name: 'Tally-keeper', map: 'tusk', x: 12, y: 29, sprite: 'elder', tier: 6, look: true, deck: ['floe', 'yoke', 'walrus', 'berg', 'selkie'], prize: 'heartstone',
    lines: ['Tusk\'s played Shellboard longer than anywhere. Lost longer too. We\'re really good at losing.'] },
  { id: 'peg7', name: 'Card-sharp', map: 'hilt', x: 34, y: 16, sprite: 'keeper', tier: 7, look: true, deck: ['gore', 'quarry', 'tang', 'buckler', 'sallet'], prize: 'cleaver',
    lines: ['Hilt rules. No crying, no counting out loud, no peeking at the bottom.'] },
  { id: 'peg8', name: 'Star-reader', map: 'fall', x: 13, y: 12, sprite: 'villager2', tier: 8, look: true, deck: ['flare', 'tor', 'cullet', 'haze', 'lune'], prize: 'embercoat',
    lines: ['These cards fell with the star, y\'know. I just shuffle \'em.'] },
];

/** The champion plays the five strongest cards in the Register. */
const pegmaster = (): string[] => WILD_KINDS.map(cardOf).sort((a, z) => sum(z) - sum(a)).slice(0, 5).map(c => c.kind);
const sum = (c: Card) => c.e.reduce((a, b) => a + b, 0);

async function chooseHand(): Promise<Card[] | null> {
  const owned = ownedCards();
  if (owned.length <= 5) return owned;
  const c = await choose(['Best five', 'Choose five'], true, 'Which cards?');
  if (c < 0) return null;
  if (c === 0) return owned.slice(0, 5);
  const hand: Card[] = [];
  while (hand.length < 5) {
    const pool = owned.filter(o => !hand.includes(o));
    const i = await listMenu(`Card ${hand.length + 1} of 5`, pool.map(o => `${SPECIES[o.kind].name}  ${o.e.join(' ')}`), { w: 160 });
    if (i < 0) return null;
    hand.push(pool[i]);
  }
  return hand;
}

export async function playShellboard(r: (typeof RIVALS)[number] | (Rival & { prize: string; lines: string[] })): Promise<void> {
  for (const l of r.lines) await say(r.name, l);
  if (!flag('pegboardTold')) {
    await hint('(Shellboard: take turns laying cards on a three by three board.)');
    await hint('(A card takes a touching rival card when its touching number is higher. Type advantage adds 1.)');
    await hint('(Your cards are the kinds you have sounded. Most cards on the board at the end wins.)');
    setFlag('pegboardTold');
  }
  if (await choose(['Play', 'Not now'], true) !== 0) return;
  const hand = await chooseHand();
  if (!hand) return;
  const res = await pegboard(r, hand);
  field.playMapMusic();
  if (res === null) return;
  if (res === 1) {
    const first = !flag('pegWon_' + r.id);
    setFlag('pegWon_' + r.id);
    await say(r.name, first ? 'Huh. Well played. Take this, I won it off someone worse.' : 'Again? Fine. Fine!');
    await reward({ rind: 80 * r.tier, tan: Math.ceil(r.tier / 2), ...(first ? { notion: r.prize } : {}) });
  } else if (res === 0) await say(r.name, 'Even. Nobody pays, nobody sulks.');
  else await say(r.name, 'Ha, mine. Come back with better cards.');
}

for (const r of RIVALS) {
  const m = MAPS[r.map];
  if (!m) continue;
  m.npcs.push({ id: r.id, x: r.x, y: r.y, sprite: r.sprite, name: r.name, dir: 0, talk: r.id });
  defScript(r.id, () => playShellboard(r));
}

MAPS.stack?.npcs.push({ id: 'pegmaster', x: 8, y: 3, sprite: 'keeper', name: 'The Boardmaster', dir: 3, talk: 'pegmaster' });
defScript('pegmaster', async () => {
  const beaten = RIVALS.filter(r => flag('pegWon_' + r.id)).length;
  if (beaten < RIVALS.length) {
    await say('The Boardmaster', `WELCOME, challenger. Vanquish the eight town players first. Thus far you have vanquished ${beaten}.`);
    return;
  }
  await playShellboard({ id: 'pegmaster', name: 'The Boardmaster', deck: pegmaster(), look: true, tier: 10, prize: 'spareskin',
    lines: ['Every card in the Register has passed through these hands of mine. Five elected to remain!!'] });
});

// Prise is offered at every grotto. The first time, the Shellwright explains it.
async function scrapeAtTannery(): Promise<void> {
  if (!flag('scrapeTold')) {
    await say('Shellwright', 'Prise this rock for me, yeah? Shells in it are plain, good, very good, or cracked.');
    await say('Shellwright', 'Numbers on the edge add up each row and column. The x counts the cracked ones.');
    await say('Shellwright', 'Get every good one out and I pay. Prise a cracked one and the whole rock\'s spoiled.');
    await say('Shellwright', 'You get one feel with your thumb per rock. Tells smooth from rough. Just the one, okay?');
    setFlag('scrapeTold');
  }
  await scrape();
  field.playMapMusic();
  save();
}

tanneryExtras.push({ label: 'Prise', when: () => G.keys.includes('prisingiron'), run: scrapeAtTannery });

void G;
