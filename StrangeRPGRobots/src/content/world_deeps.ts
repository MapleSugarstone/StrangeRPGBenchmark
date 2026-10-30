// Replay content for the Deeps, the Flats, and the tunnels: travel destinations, world events, and the
// background quests for canal runners and Recovery washouts. Scenes are in src/script/events_deeps.txt.
import { addTravel, addEvents } from './replay';
import { addQuests } from './quests';
import { addShops, SHOPS } from './shops';
import { addItems } from '../rules/data';

// The Deeps stay reachable from chapter 2 to chapter 5. The market floods in chapter 5.
const DEEPS = 'chapter>=2&chapter<6';

addTravel([
  { id: 'pell', name: 'Pell Market', district: 'deeps', map: 'market', marker: 'taxi', when: DEEPS, variants: [{ when: 'chapter>=5', map: 'market_flood', marker: 'taxi' }] },
  { id: 'pound', name: 'The Pound', district: 'deeps', map: 'pound', marker: 'taxi', when: DEEPS },
  { id: 'ferries', name: 'Ferry Graveyard', district: 'deeps', map: 'ferries', marker: 'taxi', when: DEEPS },
  { id: 'spin', name: 'The Spin, Canal Four', district: 'deeps', map: 'spin', marker: 'taxi', when: DEEPS, known: 'spin_known' },
  { id: 'pit', name: 'The Pit', district: 'deeps', map: 'pit', marker: 'taxi', when: DEEPS, known: 'pit_known' },
  { id: 'vein', name: 'Fish market, Canal Six', district: 'deeps', map: 'vein', marker: 'taxi', when: `${DEEPS}&party:sallis|${DEEPS}&vein_seen`, known: 'vein_known' },
  { id: 'garage', name: 'The Cutters\' garage', district: 'deeps', map: 'garage', marker: 'taxi', when: DEEPS, known: 'garage_known' },
  { id: 'lock', name: 'The Grand Lock', district: 'deeps', map: 'lock', marker: 'taxi', when: 'chapter>=2&chapter<3', known: 'lock_known' },
  { id: 'clement', name: 'The Clement', district: 'deeps', map: 'camp', marker: 'start', when: 'chapter>=5&chapter<6', known: 'ch5_on' },
  { id: 'pumpline', name: 'The Pumpline', district: 'deeps', map: 'pumpline', marker: 'gus', when: 'chapter>=5&chapter<6&pump_seen' },
  { id: 'station', name: 'Pell Station', district: 'deeps', map: 'metro_station', marker: 'hatch_in', when: `${DEEPS}&metro_open`, known: 'metro_open' },
  { id: 'tubes', name: 'The Tubes', district: 'deeps', map: 'metro_tunnel', marker: 'west_in', when: `${DEEPS}&metro_open` },
  { id: 'works', name: 'Board Works 1', district: 'deeps', map: 'metro_deep', marker: 'stair_in', when: `${DEEPS}&metro_open` },
  { id: 'wadercamp', name: 'Wader Camp', district: 'flats', map: 'flats_camp', marker: 'start', when: `${DEEPS}&flats_open`, known: 'flats_open' },
  { id: 'mud', name: 'The Flats', district: 'flats', map: 'flats_mud', marker: 'west_in', when: `${DEEPS}&flats_open` },
  { id: 'lockroad', name: 'Old Lock Road', district: 'flats', map: 'drowned', marker: 'west_in', when: `${DEEPS}&flats_open` },
]);

// Standing changes prices. Each shop gets a friend price and a grudge price, picked in the shop scenes.
const PRICED: [string, number, number][] = [['opal_camp', 0.8, 1.3], ['pell_gear', 0.8, 1.3], ['cutter_counter', 0.75, 1.5], ['bar', 0.8, 1.3], ['fish', 0.8, 1.3], ['fenna5', 0.8, 1.3], ['wader_trade', 0.75, 1.4], ['sel_stall', 0.75, 1.4]];
addShops(PRICED.flatMap(([id, cheap, dear]) => {
  const base = SHOPS.get(id);
  if (!base) return [];
  return [{ ...base, id: id + '_cheap', rate: (base.rate ?? 1) * cheap }, { ...base, id: id + '_dear', rate: (base.rate ?? 1) * dear }];
}));

// Background quests: the canal runner's Nine Bells and the Recovery washout's tag W-0912.
addQuests([
  {
    id: 'ninebells',
    title: 'Nine Bells',
    kind: 'side',
    xp: 200,
    expires: 4,
    stages: {
      '1': 'Wessel says the Nine Bells runs tonight: the Pound to the Ferry Graveyard with a lantern, before nine bells. Mara Vos needs the purse.',
      '2': 'The lantern is at the Pound, by Tilly\'s corner.',
      done: 'The Nine Bells is done.',
    },
    where: { '1': ['market', 'wessel_spot'], '2': ['pound', 'loop_corner'] },
  },
  {
    id: 'letgo',
    title: 'Tag W-0912',
    kind: 'side',
    xp: 200,
    expires: 4,
    stages: {
      '1': 'The noodle cart you let go two years ago lives at the Pound. Recovery reopened its file, and your old partner Mol came to close it.',
      done: 'Tag W-0912 is settled.',
    },
    where: { '1': ['pound', 'cart_spot'] },
  },
]);

const ON = 'chapter>=2&chapter<5';
addEvents([
  { id: 'choir', scene: 'ev_choir', maps: ['market', 'ferries'], when: ON, chance: 0.12 },
  { id: 'checkpoint', scene: 'ev_checkpoint', maps: ['market', 'pound', 'ferries'], when: 'chapter>=2&chapter<3&!back_canals', chance: 0.25, repeat: 8 },
  { id: 'vending', scene: 'ev_vending', maps: ['market', 'pound'], when: ON, chance: 0.12 },
  { id: 'bailerrest', scene: 'ev_bailer_rest', maps: ['market', 'ferries'], when: ON, chance: 0.12, repeat: 12 },
  { id: 'jawtoll', scene: 'ev_jaws_toll', maps: ['market', 'ferries'], when: ON, chance: 0.15, repeat: 10 },
  { id: 'census', scene: 'ev_census', maps: ['market'], when: ON, chance: 0.12 },
  { id: 'cuttersale', scene: 'ev_cutter_sale', maps: ['market', 'garage'], when: 'chapter>=2&chapter<3&!sieve_gone', chance: 0.25 },
  { id: 'molekid', scene: 'ev_mole_kid', maps: ['market'], when: ON + '&!metro_open', chance: 0.3 },
  { id: 'waderpier', scene: 'ev_wader_pier', maps: ['market'], when: ON, chance: 0.1 },
  { id: 'bodywell', scene: 'ev_bodywell', maps: ['market', 'market_flood'], when: 'chapter>=2&chapter<6&!lease_burned', chance: 0.12 },
  { id: 'newcomer', scene: 'ev_pound_newcomer', maps: ['pound'], when: 'chapter>=2&chapter<6', chance: 0.25 },
  { id: 'floodraft', scene: 'ev_flood_raft', maps: ['market_flood'], when: 'chapter>=5', chance: 0.3, repeat: 6 },
  { id: 'flatsdrone', scene: 'ev_flats_drone', maps: ['flats_mud'], chance: 0.3, repeat: 6 },
  { id: 'flatsturn', scene: 'ev_flats_turn', maps: ['flats_camp'], chance: 0.25, repeat: 8 },
  { id: 'tunnellamp', scene: 'ev_tunnel_lamp', maps: ['metro_tunnel'], when: '!lamps_dark', chance: 0.25 },
  { id: 'handcar', scene: 'ev_handcar', maps: ['metro_tunnel'], chance: 0.25, repeat: 6 },
  // Later mentions of quests that expired.
  { id: 'missedumbrella', scene: 'ev_missed_umbrella', maps: ['market_flood'], when: 'umbrella_missed', chance: 1 },
  { id: 'missedchoir', scene: 'ev_missed_choir', maps: ['market_flood'], when: 'choir_missed', chance: 1 },
  { id: 'missedbutton', scene: 'ev_missed_button', maps: ['market_flood'], when: 'button_missed', chance: 1 },
  { id: 'missedjukebox', scene: 'ev_missed_jukebox', maps: ['market_flood'], when: 'jukebox_missed', chance: 1 },
  { id: 'missedbosman', scene: 'ev_missed_bosman', maps: ['market_flood'], when: 'floathouse_missed', chance: 1 },
  { id: 'missedfriends', scene: 'ev_missed_friends', maps: ['pound'], when: 'lostfriends_missed&chapter>=5', chance: 1 },
]);

// Niche quests. Scenes are in src/script/niche_deeps.txt, and details on each map open them.
addItems([
  { id: 'halfgilt', name: 'Old Half-Gilt', kind: 'key', price: 0, desc: 'A half-gilt from before the Flood. The old pump is on one side and the old Wall on the other.' },
  { id: 'shopbell', name: 'Bakery Bell', kind: 'key', price: 0, desc: 'A brass shop bell on a spring, with mud in the clapper. It rings as you walk.' },
  { id: 'glassblue', name: 'Blue Sea Glass', kind: 'key', price: 0, desc: 'A piece of weathered city glass, worn smooth by time. Blue.' },
  { id: 'glassgreen', name: 'Green Sea Glass', kind: 'key', price: 0, desc: 'A piece of weathered city glass, worn smooth by time. Green, featuring a single bubble.' },
  { id: 'glassbrown', name: 'Brown Bottle Glass', kind: 'key', price: 0, desc: 'Fragment of an old bottle bearing raised letters: "BOARD MEDICAL." The remainder is broken away.' },
  { id: 'okkerlamp', name: 'Mole Lamp', kind: 'key', price: 0, desc: 'A helmet lamp with "OKKER" scratched into the side. The battery is dead.' },
  { id: 'redsock', name: 'Red Sock', kind: 'key', price: 0, desc: 'A single child-sized red sock, retrieved from a crate of lost items at the Pound.' },
]);

addQuests([
  {
    id: 'meter', title: 'Paid Up', kind: 'side', xp: 100, expires: 4,
    stages: { '1': "A woken parking meter on Pell Market's bridge road demands payment in pre-Flood currency.", done: 'The meter has been satisfied.' },
    where: { '1': ['market', 'crossing'] },
  },
  {
    id: 'horn', title: 'Docking Song', kind: 'side', xp: 100,
    stages: { '1': 'A foghorn on a sunken ferry sounds at nine bells, leaving a gap for words. The docking song has three lines, recorded in three different places in the Deeps.', done: 'The foghorn has fallen silent.' },
    where: { '1': ['ferries', 'horn_spot'] },
  },
  {
    id: 'race', title: 'The Slow Race', kind: 'side', xp: 100,
    stages: { '1': "Two woken things race the Pound's tram loop every night. The odds are chalked on a lamppost.", done: 'The race is complete.' },
    where: { '1': ['pound', 'race_spot'] },
  },
  {
    id: 'post', title: 'Return to Sender', kind: 'side', xp: 100,
    stages: { '1': "The Canal Six fish market's woken postbox hoards a decade of letters from those who dated into the Vein.", done: 'The postbox is empty.' },
    where: { '1': ['vein', 'post_spot'] },
  },
  {
    id: 'glass', title: 'Sea Glass', kind: 'side', xp: 100,
    stages: { '1': 'Noud crafts Old Ankie a window from scrap city glass. He needs blue, green, and lettered brown pieces.', done: 'The sea glass has been collected.' },
    where: { '1': ['flats_camp', 'glass_spot'] },
  },
  {
    id: 'bell', title: 'Opens at Six', kind: 'side', xp: 100,
    stages: { '1': 'The submerged bakery on Old Lock Road still has its doorbell. It rings with the tide.', '2': 'You now have the bakery bell. Old Ankie is at the Wader camp.', done: 'The bakery bell has been put to rest.' },
    where: { '1': ['drowned', 'bakery'], '2': ['flats_camp', 'ankie'] },
  },
  {
    id: 'count', title: 'Head Count', kind: 'side', xp: 100,
    stages: { '1': 'The Moles count themselves every night in Pell Station. They say forty-one, and one name on the board is never ticked off: Okker.', done: 'The count is complete.' },
    where: { '1': ['metro_station', 'count_spot'] },
  },
  {
    id: 'shrine', title: 'The Candle Raft', kind: 'side', xp: 100, expires: 5,
    stages: { '1': 'A woken shrine raft drifts against the flooded school in Pell Market. Its candles lean toward the Wall.', done: 'The candle raft has been put to rest.' },
    where: { '1': ['market_flood', 'shrine_spot'] },
  },
  {
    id: 'dryer', title: 'One Sock', kind: 'side', xp: 100,
    stages: { '1': 'A woken dryer at the Spin has been tumbling one red sock for nine years. The other sock is somewhere in the Deeps.', done: 'The dryer has been put to rest.' },
    where: { '1': ['spin', 'dryer_spot'] },
  },
]);
