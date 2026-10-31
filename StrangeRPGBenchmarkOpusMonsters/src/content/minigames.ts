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
    lines: ['One cowrie per hand. I deal in bones, so if I lose, you get paid in bone. My apologies in advance.'] },
  { id: 'peg2', name: 'Salt-card', map: 'mast', x: 6, y: 13, sprite: 'villager', tier: 2, look: false, deck: ['brine', 'scree', 'fluke', 'sail', 'keel'], prize: 'whetstone',
    lines: ['Cards go brittle fast in this climate. Dry cards play quicker. Quicker than you, at least.'] },
  { id: 'peg3', name: 'Verger\'s clerk', map: 'spire', x: 22, y: 24, sprite: 'villager2', tier: 3, look: false, deck: ['grotesque', 'siren', 'tenor', 'glaze', 'pew'], prize: 'waxcoat',
    lines: ['I maintain the Verger\'s records!', 'Since the Verger never plays, I handle the Verger\'s cards with utmost devotion.'] },
  { id: 'peg4', name: 'Moss-player', map: 'bole', x: 12, y: 17, sprite: 'tanner', tier: 4, look: true, deck: ['thicket', 'orchard', 'taproot', 'whip', 'gnarl'], prize: 'warmstone',
    lines: ['It\'s a slow game with slow players. I\'ve waited so long moss has grown on my left hand. Your turn.', 'Whenever you feel like it.'] },
  { id: 'peg5', name: 'Ohm\'s apprentice', map: 'hum', x: 8, y: 16, sprite: 'child', tier: 5, look: true, deck: ['turbine', 'dynamo', 'kiln', 'belt', 'dish'], prize: 'lodestone',
    lines: ['I\'ve memorized every card in the Volute. Ohm told me not to share that secret. Oops.'] },
  { id: 'peg6', name: 'Tally-keeper', map: 'tusk', x: 12, y: 29, sprite: 'elder', tier: 6, look: true, deck: ['floe', 'yoke', 'walrus', 'berg', 'selkie'], prize: 'heartstone',
    lines: ['Tusk has played Shellboard longer here than anywhere else. And lost longer, too.', 'We\'re exceptionally good at losing.'] },
  { id: 'peg7', name: 'Card-sharp', map: 'hilt', x: 34, y: 16, sprite: 'keeper', tier: 7, look: true, deck: ['gore', 'quarry', 'tang', 'buckler', 'sallet'], prize: 'cleaver',
    lines: ['Hilt rules. No crying, no counting out loud, and absolutely no peeking at the bottom.'] },
  { id: 'peg8', name: 'Star-reader', map: 'fall', x: 13, y: 12, sprite: 'villager2', tier: 8, look: true, deck: ['flare', 'tor', 'cullet', 'haze', 'lune'], prize: 'embercoat',
    lines: ['These cards fell with the star, you know. I merely shuffle them.'] },
];

/** The champion plays the five strongest cards in the Register. */
const pegmaster = (): string[] => WILD_KINDS.map(cardOf).sort((a, z) => sum(z) - sum(a)).slice(0, 5).map(c => c.kind);
const sum = (c: Card) => c.e.reduce((a, b) => a + b, 0);

async function chooseHand(): Promise<Card[] | null> {
  const owned = ownedCards();
  if (owned.length <= 5) return owned;
  const c = await choose(['The five best', 'Select five cards.'], true, 'Which ones?');
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
    await hint('(Shellboard: Players take turns placing cards on a three-by-three grid.)');
    await hint('(A card takes a touching rival card when its touching number is higher. Type advantage adds 1.)');
    await hint('(Your deck consists of the species you have caught.');
    await hint('The player controlling the most cards on the board at the end wins.)');
    setFlag('pegboardTold');
  }
  if (await choose(['Play', 'Not yet'], true) !== 0) return;
  const hand = await chooseHand();
  if (!hand) return;
  const res = await pegboard(r, hand);
  field.playMapMusic();
  if (res === null) return;
  if (res === 1) {
    const first = !flag('pegWon_' + r.id);
    setFlag('pegWon_' + r.id);
    await say(r.name, first ? 'Huh. Good game. Here, take this, I won it from someone less skilled.' : 'Really? Alright. Alright!');
    await reward({ rind: 80 * r.tier, ...(first ? { tan: Math.ceil(r.tier / 2), notion: r.prize } : {}) });
  } else if (res === 0) await say(r.name, 'It\'s a tie. No one pays, no one sulks.');
  else await say(r.name, 'Ha, mine. Return with stronger cards.');
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
    await say('The Boardmaster', `WELCOME, challenger. Defeat the eight town players first. Thus far you have defeated ${beaten}.`);
    return;
  }
  await playShellboard({ id: 'pegmaster', name: 'The Boardmaster', deck: pegmaster(), look: true, tier: 10, prize: 'spareskin',
    lines: ['Every card in the Register has passed through my hands. Only five chose to stay!!'] });
});

// Prise is offered at every grotto. The first time, the Shellwright explains it.
async function scrapeAtTannery(): Promise<void> {
  if (!flag('scrapeTold')) {
    await say('Shellwright', 'Pry open this clam bed for me, yeah? Each clam is rated plain, good, very good, or cracked.');
    await say('Shellwright', 'The numbers along the edges are the sums of each row and column.');
    await say('Shellwright', 'The small crack symbol counts the cracked clams.');
    await say('Shellwright', 'Open every good clam and I\'ll pay you. Pry open a cracked one and the whole bed is ruined.');
    await say('Shellwright', 'You get one thumb-feel per bed. It tells you if they\'re smooth or rough. Just one feel, okay?');
    setFlag('scrapeTold');
  }
  await scrape();
  field.playMapMusic();
  save();
}

tanneryExtras.push({ label: 'Prise', when: () => G.keys.includes('prisingiron'), run: scrapeAtTannery });

void G;
