import type { MapDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { nextChapter } from './common';
import { Grid } from './grid';

const f = (s: Ctx, k: string) => s.has(k);

// ---------- The Tether base ----------

function buildBase(): string[] {
  const g = new Grid(32, 22, '.');
  g.scatter(0, 0, 32, 22, ',', 0.55, 61);
  g.scatter(0, 0, 32, 22, 'R', 0.05, 62, '.,');
  g.rect(15, 0, 2, 7, '/');
  g.rect(12, 7, 8, 4, 'O');
  g.rect(22, 5, 5, 1, '^').rect(22, 6, 5, 1, 'B').put(23, 6, 'W');
  g.ellipse(15, 17, 5.5, 3.5, 'R');
  g.ellipse(15, 17, 3.5, 2, '.');
  g.path([[31, 11], [15, 11], [15, 16]], ':');
  g.put(15, 17, 'u');
  g.put(31, 11, 'e');
  g.put(15, 8, 'l').put(24, 7, 'c').put(6, 6, 'b').put(9, 13, 'p').put(27, 15, 's').put(4, 18, 'a').put(28, 2, 'm');
  g.put(20, 12, 'k');
  return g.rows();
}

const liftTalk: Script = async s => {
  if (!s.hasItem('ticket')) {
    await s.tell('The lift car is a brass cage hanging from the Tether. A slot in the door reads: INSERT TICKET.');
    return;
  }
  await s.tell('Wick feeds the ticket into the slot. The cage door folds open with a sound like applause.');
  if (f(s, 'choseJar')) await s.say('VEND', 'GOING UP. PLEASE KEEP YOUR HANDS, TENTACLES, AND MOTHS INSIDE THE CAR.');
  else await s.say('Tint', 'Up. Finally. I have never wanted to go up so much in my life.');
  await nextChapter(s, 6);
};

const clerk: Script = async s => {
  if (s.hasItem('ticket')) { await s.say('Toll Clerk', 'A valid ticket! My goodness. Board whenever you like. No refunds, no exchanges, no looking down.'); return; }
  if (f(s, 'choseJar') && !f(s, 'reelsTraded')) {
    await s.say('VEND', 'I HAVE SOMETHING YOUR TOLL MACHINE WANTS.');
    await s.tell('VEND opens his own front panel. Inside, three brass reels spin, hues flashing past. He pulls them out, one by one, and feeds them into the toll machine.');
    await s.say('Toll Clerk', 'Oh! Those are... real reels. Those are worth more than the lift. Here. Here is your ticket. Goodness.');
    await s.say('Wick', 'VEND, your Jackpot...');
    await s.say('VEND', 'I SPENT FORTY YEARS SAVING FOR SOMETHING. THIS IS THE SOMETHING. THANK YOU FOR YOUR PURCHASE.');
    s.flag('reelsTraded');
    const m = s.st.members.vend;
    if (m) m.lost = [...(m.lost ?? []), 'jackpot'];
    await s.give('ticket');
    return;
  }
  await s.say('Toll Clerk', 'Lift tickets are sold out. Every ticket was purchased by Baron Surplus of the Undermarket. He resells them at one thousand gold.');
  await s.say('Toll Clerk', 'Also, the Bishop has sent round your descriptions. A Duotone, a cat, a witch, a suit of armor, and a monk who says goodbye first. I\'m not allowed to sell to you at all.');
  await s.say('Toll Clerk', 'But I can\'t stop you boarding with a ticket. Nobody told me about tickets. I\'m very literal.');
  s.flag('knowBaron');
};

const base: MapDef = {
  id: 'tetherBase', name: 'Foot of the Tether', music: 'market', rows: buildBase(), under: '.', outside: 'R', bg: 'rock',
  theme: {
    ground: ['k', 'g1', 'm1'], tall: ['k', 'g1', 'm2'], rock: ['k', 'g1', 'g2'], thread: ['k', 'y2', 'c2'], grate: ['k', 'g1', 'g2'],
    path: ['k', 'g2', 'g3'], roof: ['k', 'r1', 'r2'], brick: ['k', 'g1', 'r1'], window: ['k', 'g1', 'y3'],
  },
  enc: { rate: 0.14, groups: [['rat2', 2], ['mite5', 2], ['repo', 1]] },
  ents: [
    { id: 'east', at: 'e', kind: 'warp', to: ['hourglass', 'w', 'right'], under: ':' },
    { id: 'crater', at: 'u', kind: 'warp', to: ['undermarket', 'e', 'down'], under: 'S' },
    { id: 'lift', at: 'l', kind: 'prop', spr: NPC.lift, talk: liftTalk },
    { id: 'clerk', at: 'c', kind: 'npc', spr: NPC.clerk, talk: clerk },
    { id: 'bowl', at: 'b', kind: 'npc', spr: NPC.fishBowl, talk: async s => s.say('The Bowl Family', 'We are a family of lantern-fish in a bowl on legs. We have been waiting for the lift for three weeks. The legs are tired. The fish are fine.') },
    { id: 'pilgrim', at: 'p', kind: 'npc', spr: NPC.pilgrimA, talk: async s => s.say('Pilgrim', 'The Tether goes all the way up to the Loom. They say at the top you can see the whole world, and it\'s smaller than you\'d like.') },
    { id: 'sign', at: 's', kind: 'sign', text: 'THE UNDERMARKET. Down the crater. Everything for sale. NO REFUNDS. NO EXCHANGES. NO QUESTIONS. SOME ANSWERS, FOR A FEE.' },
    { id: 'lamp', at: 'k', kind: 'lamp' },
    { id: 'chestA', at: 'a', kind: 'chest', item: 'ink_well' },
    { id: 'chestM', at: 'm', kind: 'chest', gold: 180 },
  ],
  enter: async s => {
    if (f(s, 'baseIntro')) return;
    s.flag('baseIntro');
    await s.tell('West of the Waste, a thread as thin as a hair rises out of the ground. Up close it is as wide as a house: a cable wrapped in a vine, running straight up past the clouds.');
    await s.say('Nona', 'The Tether. It was built to hoist raw material up to the Loom. Now it is the only way up.');
    await s.say('Brask', 'And beside it, the Undermarket. A moon fell here long ago. Someone opened a shop inside it. Then everyone did.');
  },
};

// ---------- The Undermarket ----------

function stall(g: Grid, x: number, y: number, w: number) {
  g.rect(x, y, w, 1, '^');
  g.rect(x, y + 1, w, 1, 'B');
}

function buildMarket(): string[] {
  const g = new Grid(40, 36, 'R');
  g.ellipse(20, 18, 19.5, 17.5, 'O');
  g.rect(4, 17, 32, 15, 'Q');
  g.scatter(1, 1, 38, 15, '$', 0.05, 71, 'O');
  // Bazaar stalls.
  stall(g, 5, 5, 10);
  g.put(9, 6, 'W').put(10, 6, 'D');
  stall(g, 23, 5, 7);
  stall(g, 31, 8, 5);
  stall(g, 5, 11, 5);
  stall(g, 26, 11, 6);
  // Factory: machines and belts.
  g.rect(4, 16, 32, 1, 'M');
  g.put(20, 16, 'O');
  for (let y = 17; y <= 22; y++) g.put(20, y, 'J');
  for (let x = 8; x <= 19; x++) g.put(x, 23, '<');
  for (let x = 8; x <= 19; x++) g.put(x, 26, '>');
  for (let x = 21; x <= 30; x++) g.put(x, 26, '>');
  for (let y = 18; y <= 26; y++) g.put(31, y, 'U');
  g.rect(9, 24, 10, 1, 'M');
  g.rect(22, 24, 8, 1, 'M');
  g.rect(19, 24, 3, 2, 'M');
  g.rect(12, 28, 7, 1, 'M');
  g.rect(22, 28, 7, 1, 'M');
  g.rect(19, 29, 1, 3, 'M');
  g.rect(21, 29, 1, 3, 'M');
  g.put(20, 32, 'v');
  g.put(20, 1, 'e');
  g.put(13, 8, 'a').put(26, 8, 'n').put(33, 11, 's').put(7, 14, 'r').put(29, 14, 'g').put(16, 10, 'h').put(36, 15, 'k');
  g.put(18, 3, 'l').put(6, 22, 'b').put(34, 20, 'c').put(6, 29, 'd').put(33, 30, 'x');
  g.put(10, 9, 'y');
  return g.rows();
}

const auction: Script = async s => {
  if (f(s, 'auctionSeen')) return;
  s.flag('auctionSeen');
  await s.tell('A crowd is packed around the auction house. On the block stands a creature like a violet cuttlefish in a waistcoat, holding up a glass jar full of warm brown light.');
  await s.say('The Auctioneer', 'Lot forty-one! Vintage umber, harvested fresh from a little village at the very edge of the world! Warm, soft, faintly smells of lamp oil. Do I hear eight hundred?');
  await s.tell('Wick stops walking.');
  await s.say('Wick', 'That\'s Gran. That\'s GRAN.');
  await s.say('Brother Grayling', 'Eight hundred, for the Choir. It will go home to the Loom where it belongs.');
  await s.say('Baron Surplus', 'Two thousand. Cash. I\'ll sell it to the Choir myself next week at three.');
  await s.say('The Auctioneer', 'Sold! To the Baron, who owns this auction house, and this moon, and a little of everybody\'s future!');
  await s.tell('Grayling bows politely to the Baron and leaves. The jar goes into a strongbox, and the strongbox goes down, into the factory, toward the vault.');
  await s.say('Tint', 'Okay. New plan. Same plan, plus stealing your grandmother back.');
};

const vendTalk: Script = async s => {
  if (f(s, 'vendJoined')) return;
  await s.tell('Chained to the front of the Baron\'s stall is a vending machine with arms, legs, and two tired cyan lights for eyes.');
  await s.say('VEND', 'HELLO. I AM VEND. PLEASE INSERT COIN. ...SORRY. HABIT.');
  await s.say('VEND', 'I HAVE WORKED FOR BARON SURPLUS FOR FORTY YEARS. MY CONTRACT SAYS I MAY BUY MY FREEDOM FOR ONE MILLION GOLD. I HAVE SAVED THREE.');
  if (!f(s, 'auctionSeen')) await s.say('VEND', 'THE BARON KEEPS HIS TICKETS AND HIS INVENTORY IN THE VAULT UNDER THE FACTORY.');
  else await s.say('VEND', 'THE JAR YOU ARE STARING AT THE FACTORY FOR IS IN THE VAULT. SO ARE THE LIFT TICKETS. SO IS MY CONTRACT.');
  await s.say('Nona', 'You know the way down?');
  await s.say('VEND', 'I AM THE WAY DOWN. THE CHAIN IS A LEASE. THE LEASE EXPIRED IN THE YEAR OF THE LONG TUESDAY. NOBODY CHECKED.');
  await s.tell('VEND lifts the chain off his own hook and hands it to Brask, who does not know what to do with it.');
  s.flag('vendJoined');
  s.mech('coin');
  await s.join('vend', Math.max(17, s.st.members.wick.lvl));
  await s.tell('^yVEND^0 has no ink. His skills cost ^ygold^0 instead, more at higher levels. He also sells items anywhere: choose ^yVend^0 in the menu, at a markup.');
};

const market: MapDef = {
  id: 'undermarket', name: 'The Undermarket', music: 'market', rows: buildMarket(), under: 'O', outside: 'R', bg: 'machine',
  legend: {
    Q: { kind: 'circuit', enc: true },
    J: { kind: 'belt', belt: 'down' },
    U: { kind: 'belt', belt: 'up' },
    '<': { kind: 'belt', belt: 'left' },
    '>': { kind: 'belt', belt: 'right' },
  },
  theme: {
    grate: ['k', 'g1', 'm1'], rock: ['k', 'g1', 'g2'], coins: ['k', 'm1', 'y2'], circuit: ['k', 'g1', 'c1'], machine: ['k', 'g1', 'r2'],
    belt: ['k', 'g1', 'y2'], roof: ['k', 'm1', 'm2'], brick: ['k', 'g1', 'y1'], window: ['k', 'm1', 'y3'], door: ['k', 'n1', 'y2'],
  },
  enc: { rate: 0.18, groups: [['mite5', 3], ['repo', 3], ['rat2', 2], ['tag', 2], ['imp3', 2]] },
  ents: [
    { id: 'up', at: 'e', kind: 'warp', to: ['tetherBase', 'u', 'down'], under: 'S' },
    { id: 'vaultDoor', at: 'v', kind: 'trigger', under: 'D', step: async s => {
      if (!f(s, 'vendJoined')) { await s.tell('A vault door with a coin slot for a keyhole. It will not open for strangers.'); await s.movePlayer('u'); return; }
      await s.say('VEND', 'ALLOW ME.');
      await s.tell('VEND inserts a coin into the keyhole. The vault door swings open.');
      await s.warp('vault', 'd', 'up');
    } },
    { id: 'auctionTrigger', at: 'y', kind: 'trigger', step: auction, under: 'O' },
    { id: 'auctioneer', at: 'a', kind: 'npc', spr: NPC.auctioneer, talk: async s => {
      if (!f(s, 'auctionSeen')) await auction(s);
      else await s.say('The Auctioneer', 'Next lot: a jar of the exact green of a frog\'s opinion. Sealed. Do not open indoors.');
    } },
    { id: 'vend', at: 'n', kind: 'npc', spr: NPC.vend, when: st => !st.flags.vendJoined, talk: vendTalk },
    { id: 'shop', at: 's', kind: 'npc', spr: NPC.goblin, talk: async s => {
      await s.say('Goblin', 'Undermarket prices! We mark everything up, then we mark it down, so you feel good, then we mark it up again when you look away.');
      await s.shop('undermarket');
    } },
    { id: 'rat', at: 'r', kind: 'npc', spr: NPC.ratMerchant, talk: async s => s.say('Moon Rat', 'I chewed a hole in this moon. It was already hollow. I\'m still proud. You have to be proud of something.') },
    { id: 'goblin2', at: 'g', kind: 'npc', spr: NPC.goblinB, wander: true, talk: async s => s.say('Goblin', 'Colors in jars, sixty gold. Last week they were thirty. The grey is coming, so colors are an investment.') },
    { id: 'slots', at: 'h', kind: 'npc', spr: NPC.slots, talk: async s => {
      await s.say('Lucky Seven', 'PLAY LUCKY SEVEN. TEN GOLD A PULL. THE ODDS ARE PRINTED ON MY SIDE IN A FONT TOO SMALL TO READ.');
      if (await s.ask('Pull for 10 gold?', ['Pull', 'Walk away']) !== 0 || s.st.gold < 10) return;
      await s.gold(-10, true);
      const win = (s.st.steps * 7 + s.st.gold) % 5 === 0;
      if (win) { await s.tell('Three lemons. The machine rattles and pays out.'); await s.gold(60); }
      else await s.tell('A lemon, a bell, and a small picture of the Baron laughing.');
    } },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'lamp2', at: 'k', kind: 'lamp' },
    { id: 'chestB', at: 'b', kind: 'chest', item: 'chorus' },
    { id: 'chestC', at: 'c', kind: 'chest', item: 'amber_slot' },
    { id: 'chestD', at: 'd', kind: 'chest', gold: 300 },
    { id: 'chestX', at: 'x', kind: 'chest', item: 'feather' },
  ],
};

// ---------- The vault ----------

function buildVault(): string[] {
  const g = new Grid(17, 13, 'M');
  g.rect(1, 1, 15, 11, '$');
  g.put(5, 2, 't').put(11, 2, 'j').put(8, 4, 'o').put(8, 6, 'b').put(8, 11, 'd');
  return g.rows();
}

const baronFight: Script = async s => {
  if (f(s, 'baronDead')) return;
  s.music('boss');
  await s.tell('The vault is a room made of money. Gold coins shift underfoot like sand. At the far end, on two pedestals, sit a lift ticket and a jar of warm brown light.');
  await s.tell('Between them stands Baron Surplus, sitting in a walking machine built out of coin slots.');
  await s.say('Baron Surplus', 'VEND! My best appliance! And he brought customers. Everything down here is for sale, you know. Including you.');
  await s.say('VEND', 'MY LEASE EXPIRED. I DO NOT WORK HERE.');
  await s.say('Baron Surplus', 'Then you\'re inventory. Muscle! On the house!');
  const r = await s.battle('boss5');
  if (r !== 'win') return;
  s.flag('baronDead');
  await s.tell('The coin machine sags and spills the Baron onto a pile of his own money. He does not try to get up.');
  await s.say('Baron Surplus', 'Fine. Take one thing. The vault seals in a minute, and when it does it seals everything, including the air.');
  await s.tell('An alarm ticks. The walls begin to close in, coin by coin.');
  await s.say('Nona', 'We can carry one of them out before it seals. The ticket takes us up. The jar is your grandmother.');
  await s.say('Brask', 'Lamp-bearer. It is your choice. We will follow either way.');
  const i = await s.ask('Which does Wick take?', ['The lift ticket', 'Gran\'s jar']);
  if (i === 0) {
    await s.say('Wick', '...The ticket. If we don\'t go up, the whole world ends up in jars.');
    await s.give('ticket');
    s.flag('jarLost');
    await s.tell('Behind them the vault seals, with Gran\'s jar still inside.');
    await s.say('Baron Surplus', 'The Choir will collect the jar next week. They always pay on time. That\'s the thing I like about the end of the world. Punctual customers.');
  } else {
    await s.say('Wick', 'The jar. I\'m not leaving her in a vault.');
    await s.give('gran_jar');
    s.flag('choseJar');
    await s.tell('Wick holds the jar close. It is warm. It smells like lamp oil and bread.');
    await s.say('Tint', 'Okay. No ticket. We\'ll figure it out. We always figure it out.');
    await s.say('VEND', 'I WILL FIGURE IT OUT.');
  }
  await s.say('VEND', 'MY CONTRACT.');
  await s.tell('VEND picks a single sheet of paper out of the gold, reads it, and eats it. It is, he explains later, the only thing he has ever bought for himself.');
  await s.warp('undermarket', 'v', 'up');
  await s.say('Wick', 'Everything up there costs somebody something. I keep finding out who.');
};

const vault: MapDef = {
  id: 'vault', name: 'The Baron\'s Vault', music: 'market', rows: buildVault(), under: '$', outside: 'M', bg: 'coins',
  theme: { coins: ['k', 'y1', 'y2'], machine: ['k', 'g1', 'y2'] },
  ents: [
    { id: 'door', at: 'd', kind: 'warp', to: ['undermarket', 'v', 'up'], under: '$' },
    { id: 'baron', at: 'o', kind: 'npc', spr: NPC.baron, when: st => !st.flags.baronDead, talk: baronFight },
    { id: 'boss', at: 'b', kind: 'trigger', step: baronFight },
    { id: 'ticketStand', at: 't', kind: 'prop', spr: NPC.ticket, when: st => !st.flags.baronDead, talk: async s => s.tell('A lift ticket on a velvet cushion.') },
    { id: 'jarStand', at: 'j', kind: 'prop', spr: NPC.jar, when: st => !st.flags.baronDead, talk: async s => s.tell('A jar of warm brown light. The label reads UMBER, EDGEWICK.') },
  ],
};

export const maps: MapDef[] = [base, market, vault];

export const chapter: ChapterDef = {
  title: 'The Undermarket',
  stage: 'Tests, allies, enemies',
  blurb: 'The way up is a thread with a toll booth. The toll booth wants gold.',
  recruit: 'vend',
  ready: true,
  startMap: 'tetherBase',
  startMarker: 'e',
  objective: st => {
    const fl = st.flags;
    if (!fl.knowBaron) return 'Ask at the toll booth beside the Tether lift.';
    if (!fl.vendJoined) return 'Go down the crater into the Undermarket and find Baron Surplus.';
    if (!fl.baronDead) return 'Follow the factory belts down to the Baron\'s vault.';
    if (!st.items.ticket) return 'Go back up to the toll booth.';
    return 'Board the Tether lift.';
  },
  route: [
    { map: 'tetherBase', ent: 'clerk' }, { map: 'tetherBase', warp: 'crater' },
    { map: 'undermarket', ent: 'auctioneer' }, { map: 'undermarket', ent: 'vend' }, { map: 'undermarket', ent: 'shop' },
    { map: 'undermarket', ent: 'vaultDoor' }, { map: 'vault', ent: 'boss' },
    { map: 'undermarket', warp: 'up' }, { map: 'tetherBase', ent: 'clerk' }, { map: 'tetherBase', ent: 'lift' },
  ],
};
