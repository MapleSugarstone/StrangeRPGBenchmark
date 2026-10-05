import type { MapDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { nextChapter, lampsLit } from './common';

const f = (s: Ctx, k: string) => s.has(k);

// ---------- Edgewick ----------

export const EDGEWICK: string[] = [
  'TTTTTTTTTTTTTTTwTTTTTTTTTTTTTT*   ',
  'T;;;;;;;;;;;;;h:;;;;;;;;;;;;;;*   ',
  'T;^^^^^;;;;;;;;:;;;;;;;^^^^^;;*   ',
  'T;BWgWB;;"";;;;:;;;;;;;BWmWB;;*   ',
  'T;;;a;;;;;k;;;;:;;;;;;;;;:;;;;*   ',
  'T;;;:::::::::::::::::::::::::1*   ',
  'T;;;:;;;;;;;;;;:;;;;;;;;;:;;;;*   ',
  'T;%;:;;;;;;;;;;:;;;;;;;;;:;;;;*   ',
  'T;;;:;;;;:::::::::::;;;;;:;;;;*   ',
  'T;;;:;;;;:;;;;;;;;;:;o;;;:;;;;*   ',
  'T;n;:;;;;:;;;;l;q;;:;;;;;:;;;;*   ',
  'x:::::::::;;;;;;;;;::::::::::2*   ',
  'T;;;:;;p;:;;;v;;;;;:;;;;;:;;;;*   ',
  'T;;;:;;;;:::::::::::;;;;;:;;;;*   ',
  'T;;;:;;;;;;;;;;:;;;;;;;;;:;;;;*   ',
  'T;^^^^^;;;;;;;;:;;;;;;;;;:;;;;*   ',
  'T;BWsWB;;;;;;;;:;;;"";;;;:;;;;*   ',
  'T;;;:;;;;;;;;;;:;;;"";;;;:;;;3*   ',
  'T;;;:::::::::::::::::::::::::;*   ',
  'T;;;;;;;;;;;;;;;;;;;;;;;;;;;;;*   ',
  'T;;~~~~;;;;;;;;;;;;;;;;;;;;;;;*   ',
  'T;;~~~~;f;;;;;;;;;;;;;;;;;;;;;*   ',
  'T;;;;;;;;;;;;;;;;;;;;r;;;;;;;;*   ',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT*   ',
];

const edgeLamp = (id: string): Script => async s => {
  const key = `lit:edgewick:${id}`;
  if (s.has(key)) {
    await s.tell('The Edge Lamp burns amber. Past it, the world simply stops.');
    return;
  }
  s.flag(key);
  s.sfx('save');
  await s.flash('y3');
  const n = lampsLit(s, 'edgewick', ['lamp1', 'lamp2', 'lamp3']);
  if (n === 1) {
    await s.tell('The lamp catches. Something grey scrabbles over the cliff edge, drawn by the light.');
    await s.say('Wick', 'A Blank. They come up out of the Void when the lamps are late.');
    await s.tell('^yBattle basics:^0 Attack is free. Skills cost ink. Guard halves damage and refills a little ink. Hold Z to speed things up.');
    await s.battle('wolf1');
    await s.say('Wick', 'Two more lamps.');
  } else if (n === 2) {
    await s.say('Wick', 'One more. The Void looks restless tonight.');
  } else {
    s.flag('lampsDone');
    await s.say('Wick', 'All three. The Edge is quiet. Gran will want to know.');
  }
};

const granTalk: Script = async s => {
  if (!f(s, 'lampsDone')) {
    await s.say('Gran Umber', 'The Edge Lamps, wick-in-the-wind. They won\'t light themselves. Well, they could, but they\'d want wages.');
    return;
  }
  if (!f(s, 'sent')) {
    await s.say('Gran Umber', 'All three lit? Good. Now come look at this. The Great Lamp has been coughing all evening.');
    await s.say('Wick', 'Coughing?');
    await s.say('Gran Umber', 'Soot, sparks, a little grey around the flame. Lamps don\'t go grey, Wick. People do. Lately.');
    s.shake(30);
    s.sfx('crit');
    await s.flash('w');
    await s.tell('A light streaks across the sky and crashes somewhere north, in the Hollow Wood. The windows rattle.');
    await s.say('Gran Umber', 'That was a star. Stars don\'t fall here. We\'re too small to fall on.');
    await s.say('Gran Umber', 'Listen. The Great Lamp needs lampsap, and the only lampsap grows on the Antenna Tree in the middle of the wood.');
    await s.say('Wick', 'At night? Hollis says the trees pick up bad stations at night.');
    await s.say('Gran Umber', 'Hollis also says the moon is a rumor. Take these. Follow the wayside lamps and light them as you go. Blanks hate a lit lamp.');
    await s.give('tallow', 3);
    await s.give('ink_vial', 1);
    s.flag('sent');
    await s.say('Gran Umber', 'And Wick. Whatever fell out there, be kind to it. Things that fall are usually frightened.');
    return;
  }
  if (!f(s, 'mothDead')) {
    await s.say('Gran Umber', 'The Hollow Wood is north, past Hollis. Bring back lampsap, and yourself, in that order of importance. No, the other order.');
    return;
  }
};

const granStatue: Script = async s => {
  if (!f(s, 'accepted')) {
    await s.tell('Gran stands by the window with her hand half raised, as grey as ash. She is still warm.');
    return;
  }
  await s.say('Wick', 'I\'m going up there, Gran. I\'ll bring your color back. Both of them.');
  await s.tell('The grey statue doesn\'t answer. Wick decides it is listening.');
};

const returnScene: Script = async s => {
  if (!f(s, 'returned') || f(s, 'returnSeen')) return;
  s.flag('returnSeen');
  s.music('sad');
  await s.tell('Edgewick is quiet. The Great Lamp is out. Grey handprints run along the path from the Edge.');
  await s.say('Sprocket', 'Wick! Wick, the grey came up over the cliff right after you left! It just walked in like it lived here!');
  await s.say('Sprocket', 'It touched Pell, and then it went into your house, and your Gran...');
  await s.say('Nona', 'Go and see her. I will wait by the lamp.');
};

const granReveal: Script = async s => {
  if (f(s, 'refused')) return granStatue(s);
  s.flag('refused');
  await s.tell('Gran stands by the window with her hand half raised, as grey as ash. She is still warm.');
  await s.say('Wick', 'Gran?');
  await s.say('Nona', 'She is not gone. Her color was pulled out of her, like a thread. Pulled upward.');
  await s.say('Wick', 'Upward where?');
  await s.say('Nona', 'To the Loom. The thing in the sky that printed all of you. Something up there has started taking the ink back.');
  await s.say('Nona', 'I fell from the Loom tonight. I need to go back, and I need someone the grey cannot read. A misprint is not in the Loom\'s index. You could walk in there and it would not even see you.');
  await s.say('Nona', 'Come with me, Wick.');
  const i = await s.ask('What does Wick say?', ['I can\'t. I\'m a misprint.', 'I light lamps. That\'s all I do.']);
  if (i === 0) await s.say('Wick', 'I can\'t. I\'m a misprint. I\'m barely a person. You want someone with three inks.');
  else await s.say('Wick', 'I light lamps. That\'s all I do. I can\'t fix the sky.');
  await s.say('Nona', 'Then light a lamp. The Great Lamp is out, and you are holding lampsap.');
};

const greatLamp: Script = async s => {
  if (!f(s, 'returned')) {
    await s.tell('The Great Lamp of Edgewick. Its flame is thin and a little grey around the edges. It keeps the color in.');
    return;
  }
  if (!f(s, 'refused')) {
    await s.tell('The Great Lamp is dark. Wick should check on Gran first.');
    return;
  }
  if (!f(s, 'relit')) {
    s.take('lampsap');
    s.flag('relit');
    s.sfx('save');
    await s.flash('y3');
    s.music('village');
    await s.tell('Wick pours the lampsap into the Great Lamp. The flame climbs, amber and loud. The grey handprints on the path fade.');
    await s.say('Pell', 'Oh! Oh, I can see my apron again. It was brown the whole time. How exciting.');
    await s.say('Mayor Ochre', 'The Great Lamp holds! Edgewick holds! For now, anyway. I\'m told nothing holds forever. I was told by the lamp.');
    await s.say('Nona', 'The lamp slows the pull. It does not stop it. Your grandmother is still grey, Wick, because her color is already up there.');
    return;
  }
  await s.tell('The Great Lamp burns amber and loud.');
};

const nonaVillage: Script = async s => {
  if (!f(s, 'relit')) {
    await s.say('Nona', 'See to your grandmother. Then see to the lamp. I am good at waiting. I once waited four hundred years for a bolt to cool.');
    return;
  }
  if (f(s, 'accepted')) {
    await s.say('Nona', 'The west road. Past the last lamp. I have never walked on the ground before tonight. It is very... close.');
    return;
  }
  await s.say('Nona', 'So. The lamp is lit and your grandmother is still grey. What will you do?');
  const i = await s.ask('', ['Go to the Loom.', 'Stay and keep the lamps.']);
  if (i === 1) {
    await s.say('Wick', 'Someone has to keep the lamps. That\'s me. That\'s always been me.');
    await s.say('Nona', 'And when the lamps go grey too? They will. Go and look at the Edge, Wick. Then come back and tell me you are staying.');
    s.flag('lookedAtEdge');
    return;
  }
  await s.say('Wick', 'I\'ll go. Not because I\'m a hero. Because Gran would have gone for me.');
  await s.say('Nona', 'That is the only reason anyone has ever gone anywhere. Good.');
  s.flag('accepted');
  await s.say('Mayor Ochre', 'Wick! You\'re leaving? Then Edgewick sends you with its full support, which is this bag of coins and a speech I will skip.');
  await s.gold(100);
  await s.say('Sprocket', 'Take my lucky button. It fell off my coat the day I was printed. It\'s been lucky ever since. For the button.');
  await s.give('lucky_button');
  await s.say('Nona', 'The west road, then. Past the last lamp.');
};

const westExit: Script = async s => {
  if (s.st.chapter >= 2) { await s.warp('fizz', 'e', 'left'); return; }
  if (!f(s, 'accepted')) {
    await s.say('Wick', 'The west road. Nobody from Edgewick goes past the last lamp. Not yet.');
    await s.movePlayer('r');
    return;
  }
  await s.tell('Wick steps past the last lamp of Edgewick. Behind them, the Great Lamp burns amber. Ahead, the road goes on into more world than Wick has ever seen.');
  await nextChapter(s, 2);
};

const northExit: Script = async s => {
  if (!f(s, 'sent')) {
    await s.say('Hollis', 'The Hollow Wood is closed after dark. The antenna trees pick up bad stations at night. I heard one read out a list of my mistakes.');
    await s.movePlayer('d');
    return;
  }
  if (f(s, 'returned')) {
    await s.say('Hollis', 'Nothing left in the wood that you need, Wick. Only the bad stations.');
    await s.movePlayer('d');
    return;
  }
  await s.warp('hollow', 'z', 'up');
};

const edgewick: MapDef = {
  id: 'edgewick', name: 'Edgewick', music: 'village', rows: EDGEWICK, under: ';', outside: 'T',
  theme: {
    grass: ['k', 'e2', 'e3'], ground: ['k', 'e1', 'e2'], path: ['k', 'n2', 'n3'], tree: ['k', 'e1', 'e2'],
    edge: ['k', 'g1', 'o3'], void: ['k', 'g1', 'w'], roof: ['k', 'r1', 'o2'], brick: ['k', 'n1', 'n2'],
  },
  ents: [
    { id: 'north', at: 'w', kind: 'trigger', step: northExit, under: ':' },
    { id: 'west', at: 'x', kind: 'trigger', step: westExit, under: ':' },
    { id: 'granDoor', at: 'g', kind: 'warp', to: ['granhouse', 'd', 'up'], under: 'D' },
    { id: 'shopDoor', at: 's', kind: 'warp', to: ['edgeshop', 'd', 'up'], under: 'D' },
    { id: 'mayorDoor', at: 'm', kind: 'prop', under: 'D', solid: true, talk: async s => s.tell('The mayor\'s door. A sign says: OUT SUPERVISING. The mayor is standing right over there.') },
    { id: 'lamp1', at: '1', kind: 'lamp', talk: edgeLamp('lamp1'), under: ';' },
    { id: 'lamp2', at: '2', kind: 'lamp', talk: edgeLamp('lamp2'), under: ';' },
    { id: 'lamp3', at: '3', kind: 'lamp', talk: edgeLamp('lamp3'), under: ';' },
    {
      id: 'greatLamp', at: 'l', kind: 'npc', name: 'Great Lamp', talk: greatLamp,
      spr: NPC.greatLamp, when: st => !st.flags.returned || !!st.flags.relit,
    },
    {
      id: 'greatLampOut', at: 'l', kind: 'npc', talk: greatLamp, spr: NPC.greatLampOut,
      when: st => !!st.flags.returned && !st.flags.relit,
    },
    {
      id: 'hollis', at: 'h', kind: 'npc', spr: NPC.hollis, talk: async s => {
        if (!f(s, 'sent')) await s.say('Hollis', 'Evening, Wick. Wood\'s closed. The trees are broadcasting again. Mostly static and a man selling knives.');
        else if (!f(s, 'returned')) await s.say('Hollis', 'Gran sent you? Then go on. Stick to the wayside lamps. A lit lamp keeps the Blanks off you.');
        else await s.say('Hollis', 'I heard the whole wood go quiet when you came back. Even the knife man.');
      },
    },
    {
      id: 'sprocket', at: 'k', kind: 'npc', spr: NPC.sprocket, wander: true, talk: async s => {
        if (f(s, 'returned') && !f(s, 'relit')) await s.say('Sprocket', 'The grey went into your house. I tried to stop it. I threw a shoe at it. It kept the shoe.');
        else if (f(s, 'accepted')) await s.say('Sprocket', 'When you get to the sky, wave. I\'ll be the one waving back. Look for three colors.');
        else await s.say('Sprocket', 'When I grow up I want to be a Duotone like you. Mum says I can\'t, I already have three colors. I\'m going to wash one off.');
      },
    },
    {
      id: 'pell', at: 'p', kind: 'npc', spr: NPC.pell, when: st => !st.flags.returned || !!st.flags.relit, talk: async s => {
        if (f(s, 'relit')) { await s.say('Pell', 'My apron is brown! I had forgotten. Here, take a roll. Rolls are brown too. Everything good is brown.'); if (!f(s, 'pellRoll')) { s.flag('pellRoll'); await s.give('tallow', 2); } return; }
        await s.say('Pell', 'Fresh bread! Crust, crumb, and a third color we don\'t discuss.');
        if (!f(s, 'pellGift')) {
          s.flag('pellGift');
          await s.say('Pell', 'Oh, Wick. Poor thing, printed half finished. Take a tallow drop. It has enough color for two.');
          await s.give('tallow');
        }
      },
    },
    { id: 'pellGrey', at: 'p', kind: 'npc', spr: NPC.pellGrey, when: st => !!st.flags.returned && !st.flags.relit, talk: async s => s.tell('Pell stands frozen mid-knead, grey from hat to apron. The dough in her hands is grey too.') },
    {
      id: 'villager', at: 'v', kind: 'npc', spr: NPC.villagerB, wander: true, when: st => !st.flags.returned || !!st.flags.relit, talk: async s => {
        if (f(s, 'relit')) await s.say('Dilly', 'I was grey for an hour. It was very restful. I do not recommend it.');
        else await s.say('Dilly', 'They say past the Edge there\'s nothing. Not black, not empty. Nothing. I looked once and it looked back, politely.');
      },
    },
    { id: 'villagerGrey', at: 'v', kind: 'npc', spr: NPC.villagerGrey, when: st => !!st.flags.returned && !st.flags.relit, talk: async s => s.tell('Dilly is grey and still. A grey bird sits on Dilly\'s head, also still.') },
    {
      id: 'mayor', at: 'o', kind: 'npc', spr: NPC.mayor, talk: async s => {
        if (f(s, 'accepted')) await s.say('Mayor Ochre', 'Go on, Wick. I\'ll keep an eye on the lamps. Well. I\'ll keep an eye on you keeping an eye on the lamps. From here.');
        else if (f(s, 'returned')) await s.say('Mayor Ochre', 'This is a disaster. I have declared it a disaster. That is the most a mayor can do.');
        else await s.say('Mayor Ochre', 'Ah, Wick. Keep those Edge Lamps lit. The Edge is very edgy tonight. That is a joke. I am allowed one per year.');
      },
    },
    {
      id: 'nona', at: 'q', kind: 'npc', spr: { g: 'beast', pal: ['k', 'c2', 'w'], o: { kind: 'nona' } }, when: st => !!st.flags.returned && !st.flags.accepted, talk: nonaVillage,
    },
    {
      id: 'nona2', at: 'q', kind: 'npc', spr: { g: 'beast', pal: ['k', 'c2', 'w'], o: { kind: 'nona' } }, when: st => !!st.flags.accepted, talk: nonaVillage,
    },
    {
      id: 'sheep', at: 'f', kind: 'npc', spr: NPC.sheep, wander: true, talk: async s => {
        await s.tell('The sheep is made of fog. When Wick pets it, their hand comes back slightly damp and slightly sheep.');
      },
    },
    {
      id: 'scarecrow', at: 'r', kind: 'npc', spr: NPC.scarecrow, talk: async s => {
        if (f(s, 'relit')) await s.say('Scarecrow Unit 4', 'FORECAST REVISED. GREY, WITH SCATTERED HOPE. ALSO CROWS. THE CROWS ARE CONSTANT.');
        else if (f(s, 'returned')) await s.say('Scarecrow Unit 4', 'FORECAST: GREY. MORE GREY. A HIGH-PRESSURE SYSTEM OF GREY MOVING DOWN FROM THE SKY.');
        else await s.say('Scarecrow Unit 4', 'FORECAST FOR TONIGHT: SIXTY PERCENT CHANCE OF GREY. LIGHT WINDS FROM THE EDGE. ALSO CROWS.');
      },
    },
    { id: 'sign', at: 'n', kind: 'sign', text: 'WEST ROAD. Nobody from Edgewick has come back from past the Lamp Line. Nobody from Edgewick has gone past it either.' },
  ],
  enter: async s => { await returnScene(s); },
};

// ---------- Interiors ----------

const granhouse: MapDef = {
  id: 'granhouse', name: 'Lamp House', music: 'village', under: '-', outside: '#',
  rows: [
    '##########',
    '#WW####WW#',
    '#--------#',
    '#-b----u-#',
    '#--------#',
    '#--t-----#',
    '#--------#',
    '####d#####',
  ],
  theme: { wall: ['k', 'n2', 'n3'], planks: ['k', 'n1', 'n2'], window: ['k', 'n2', 'y3'] },
  ents: [
    { id: 'door', at: 'd', kind: 'warp', to: ['edgewick', 'g', 'down'], under: 'D' },
    { id: 'bed', at: 'b', kind: 'prop', spr: NPC.bed, talk: async s => s.tell('Wick\'s bed. It is shaped exactly like Wick after sixteen years of use.') },
    { id: 'pot', at: 't', kind: 'prop', spr: NPC.pot, talk: async s => {
      if (!f(s, 'potTallow')) { s.flag('potTallow'); await s.tell('Gran keeps spare tallow in the pot for emergencies. This counts.'); await s.give('tallow', 2); }
      else await s.tell('The pot is empty. It still smells like tallow and Tuesday.');
    } },
    { id: 'gran', at: 'u', kind: 'npc', spr: NPC.gran, talk: granTalk, when: st => !st.flags.returned },
    { id: 'granGrey', at: 'u', kind: 'npc', spr: NPC.granGrey, talk: granReveal, when: st => !!st.flags.returned },
  ],
};

const edgeshop: MapDef = {
  id: 'edgeshop', name: 'Edgewick Stores', music: 'village', under: '-', outside: '#',
  rows: [
    '##########',
    '#WW####WW#',
    '#-CCsCC--#',
    '#--------#',
    '#-c------#',
    '#--------#',
    '####d#####',
  ],
  legend: { C: { kind: 'fence', solid: true } },
  theme: { wall: ['k', 'n2', 'n3'], planks: ['k', 'n1', 'n2'], fence: ['k', 'n1', 'y2'], window: ['k', 'n2', 'y3'] },
  ents: [
    { id: 'door', at: 'd', kind: 'warp', to: ['edgewick', 's', 'down'], under: 'D' },
    { id: 'mott', at: 's', kind: 'npc', spr: NPC.mott, under: 'C', talk: async s => {
      await s.say('Mott', 'Edgewick Stores. Everything a village at the end of the world needs, which is not much, but we have lots of it.');
      await s.shop('edgewick');
    } },
    { id: 'chest', at: 'c', kind: 'chest', item: 'pin', n: 2 },
  ],
};

// ---------- The Hollow Wood ----------

export const HOLLOW: string[] = [
  'YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYYAAAAAAAYYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYA,,,,,,,AYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYA,,,,t,,,,AYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYA,,,,,,,,,AYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYA,,,b,,,AYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYYAA,:,AAYYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY',
  'YYYYYY,,,,YYYYYYYY,:,YYYYYYYYYYY,,,,YYYY',
  'YYYYY,,f,,,YYYYYY,,:3,YYYYYYYYY,,c,,YYYY',
  'YYYYY,,,,,,,YYYY,,,:,,,YYYYYYYYYY,YYYYYY',
  'YYYYYY,,,,,,,,,,,,,:,,,,,,,,,,,,,s,,YYYY',
  'YYYYYYY,,,,YYYY,,,,:,,,,YYYYY,,,,,,,YYYY',
  'YYYYYYYY,,YYYYYYY,,:,,YYYYYYYY,,,,YYYYYY',
  'YYYYYYYY,,YYYYYYYY,:,YYYYYYYYYY,,YYYYYYY',
  'YYYYYYY,,,,YYYYYYY,:,YYYYYYYYYY,,YYYYYYY',
  'YYYYY,,,,,,,YYYYYY,:,YYYYYYYYYY,,YYYYYYY',
  'YYYY,,RRR,,,YYYYYY,:,YYYYYYYYY,,,,YYYYYY',
  'YYYY,,RnR,,,,,,,,,,:,YYYYYYYY,,,,,,YYYYY',
  'YYYY,,,:,,,,YYYYYY,:,YYYYYYYY,,,,,,YYYYY',
  'YYYYY,,:,,2,YYYYYY,:,YYYYYYYYY,,,,YYYYYY',
  'YYYYYY,,:,,,YYYYYY,:,YYYYYYYYYY,,YYYYYYY',
  'YYYYYYY,,:,,YYYYYY,:,YYYYYYYYYY,,YYYYYYY',
  'YYYYYYYY,,:,,,,,,,,:,,,,,,,,,,,,,YYYYYYY',
  'YYYYYYYYY,,,,YYYYY,:,YYYYYYYYYYY,e,YYYYY',
  'YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY',
  'YYYYYYY,,,YYYYYYYY,:,YYYYYYYYYYYYYYYYYYY',
  'YYYYYY,,d,,,,,,,,,,:1,YYYYYYYYYYYYYYYYYY',
  'YYYYYYY,,,YYYYYYYY,:,YYYYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYYYY,:,YYYYYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYYYYYzYYYYYYYYYYYYYYYYYYYY',
];

const meetNona: Script = async s => {
  if (f(s, 'metNona')) {
    await s.say('Nona', 'The Antenna Tree is north, up the main path. I can hear it humming from here. It sounds unwell.');
    return;
  }
  await s.tell('In a crater of scorched rock lies a small metal cat with nine long tails. Three Blanks are sniffing at her.');
  await s.say('???', 'Shoo. Shoo! I am not food. I am barely even metal anymore.');
  await s.battle('pup1');
  await s.tell('The Blanks scatter. The cat blinks up at Wick with two cyan eyes.');
  await s.say('???', 'Oh. A person. A person with only two inks. How unusual. Hello, misprint.');
  await s.say('Wick', 'I have a name. It\'s Wick.');
  await s.say('Nona', 'And I am Nona, maintenance unit, nine tails, all of them bent. I fell off the Loom about an hour ago. Thank you for the rescue.');
  await s.say('Wick', 'You fell off the sky?');
  await s.say('Nona', 'Off the thing in the sky. There is a difference, but it is a long one. Something up there is unthreading the world, Wick. The Blanks followed me down.');
  await s.say('Wick', 'I\'m only here for lampsap. The Antenna Tree. Our Great Lamp is failing.');
  await s.say('Nona', 'Then I will help you get your lampsap, and later you will help me get home. A fair trade between a cat and a candle.');
  s.flag('metNona');
  await s.join('nona', Math.max(2, s.st.members.wick.lvl));
  await s.tell('^yNona^0 heals with ^yPatch^0. ^yNinth Life^0 spends one of her tails to revive a fallen ally. Tails come back when you rest at a lamp.');
};

const mothTrigger: Script = async s => {
  if (f(s, 'mothDead')) return;
  if (!f(s, 'metNona')) {
    await s.tell('A huge grey moth hangs from the Antenna Tree, drinking. Its wings are the size of barn doors. Wick backs away slowly.');
    await s.say('Wick', 'Not alone. Not like this. Something west of the path was calling for help earlier.');
    await s.movePlayer('d');
    return;
  }
  s.music('boss');
  await s.tell('The Antenna Tree hums a broken song. Clinging to its trunk is a grey moth as big as a house, its proboscis sunk deep into the bark.');
  await s.say('Nona', 'It is drinking the tree\'s color. The sap goes grey where it feeds. That is not a moth, Wick. That is a scout.');
  await s.say('Nona', 'When it beats its wings to gather dust, Guard. Trust me on this. I have been hit by that dust before, and I am made of metal.');
  const r = await s.battle('boss1');
  if (r !== 'win') return;
  s.flag('mothDead');
  s.setEnt('boss', { hidden: true });
  await s.tell('The Grey Moth crumbles into lint. The Antenna Tree shudders, and amber sap wells up where the proboscis was.');
  await s.give('lampsap');
  await s.say('Nona', 'Wick. A scout means a swarm is coming, and a swarm goes for the brightest place it can find.');
  await s.say('Wick', 'The village. The lamp is failing.');
  await s.say('Nona', 'Run.');
  s.flag('returned');
  await s.warp('edgewick', 'w', 'down');
};

const hollow: MapDef = {
  id: 'hollow', name: 'The Hollow Wood', music: 'wood', rows: HOLLOW, under: ',', outside: 'Y', dark: 2.5,
  legend: { ':': { kind: 'path', enc: true } },
  theme: {
    tall: ['k', 'e1', 'g1'], path: ['k', 'n1', 'n2'], pine: ['k', 'e1', 'g1'], antenna: ['k', 'g1', 'r2'],
    rock: ['k', 'g1', 'g2'], ground: ['k', 'e1', 'g1'],
  },
  enc: { rate: 0.13, groups: [['wolf1', 2], ['wolf2', 3], ['moth2', 3], ['newt2', 2], ['pup1', 2], ['crab1', 2], ['pup3', 1]] },
  ents: [
    { id: 'exit', at: 'z', kind: 'warp', to: ['edgewick', 'w', 'down'], under: ':' },
    { id: 'lamp1', at: '1', kind: 'lamp' },
    { id: 'lamp2', at: '2', kind: 'lamp' },
    { id: 'lamp3', at: '3', kind: 'lamp' },
    { id: 'tree', at: 't', kind: 'npc', spr: NPC.antennaTree, talk: async s => {
      if (f(s, 'mothDead')) await s.tell('The Antenna Tree hums a steady tone now. Somewhere very far away, a station plays a song about going home.');
      else await s.tell('The Antenna Tree hums a broken song.');
    } },
    { id: 'boss', at: 'b', kind: 'trigger', step: mothTrigger },
    { id: 'nona', at: 'n', kind: 'npc', spr: NPC.nonaHurt, talk: meetNona, when: st => !st.flags.metNona },
    { id: 'stag', at: 's', kind: 'npc', spr: { g: 'monster', seed: 'gloam_stag', pal: ['k', 'g1', 'w'], o: { shape: 'tall' } }, when: st => !st.flags.stagDead, talk: async s => {
      await s.tell('A grey stag blocks the narrow trail. Its antlers crackle with a station that went off the air long ago.');
      const i = await s.ask('Fight the Gloam Stag?', ['Fight', 'Leave it']);
      if (i !== 0) return;
      const r = await s.battle('stag');
      if (r === 'win') { s.flag('stagDead'); await s.tell('The stag dissolves. The trail behind it is clear.'); }
    } },
    { id: 'chestF', at: 'f', kind: 'chest', gold: 40 },
    { id: 'chestC', at: 'c', kind: 'chest', item: 'wool_scarf' },
    { id: 'chestD', at: 'd', kind: 'chest', item: 'tallow', n: 2 },
    { id: 'chestE', at: 'e', kind: 'chest', item: 'ink_vial', n: 2 },
  ],
};

export const maps: MapDef[] = [edgewick, granhouse, edgeshop, hollow];

export const chapter: ChapterDef = {
  title: 'Misprint',
  stage: 'The ordinary world',
  blurb: 'Edgewick sits at the very edge of the world. Wick keeps its lamps lit.',
  recruit: 'nona',
  ready: true,
  startMap: 'edgewick',
  startMarker: 'a',
  intro: async s => {
    await s.tell('Edgewick sits at the very edge of the world. Past its last lamp there is nothing. Not dark. Nothing.');
    await s.tell('Every person the Loom prints gets three inks: black, and two hues. Wick got black and amber, and then the Loom stopped.');
    await s.say('Gran Umber', 'Wick! Dusk already. Light the three Edge Lamps along the cliff before the Void gets curious.', NPC.gran);
    await s.say('Wick', 'On it, Gran.');
  },
  objective: st => {
    const fl = st.flags;
    if (!fl.lampsDone) return 'Light the three Edge Lamps along the east cliff.';
    if (!fl.sent) return 'Tell Gran, inside the Lamp House, that the lamps are lit.';
    if (!fl.metNona) return 'Something fell into the Hollow Wood, north of the village. The lampsap grows there too.';
    if (!fl.mothDead) return 'Reach the Antenna Tree at the heart of the Hollow Wood and take its lampsap.';
    if (!fl.refused) return 'Get home. Check on Gran.';
    if (!fl.relit) return 'Relight the Great Lamp in the square with the lampsap.';
    if (!fl.accepted) return 'Talk to Nona by the Great Lamp.';
    return 'Leave Edgewick by the west road.';
  },
  route: [
    { map: 'edgewick', ent: 'lamp1' }, { map: 'edgewick', ent: 'lamp2' }, { map: 'edgewick', ent: 'lamp3' },
    { map: 'edgewick', warp: 'granDoor' }, { map: 'granhouse', ent: 'gran' }, { map: 'granhouse', warp: 'door' },
    { map: 'edgewick', ent: 'north' }, { map: 'hollow', ent: 'lamp1' }, { map: 'hollow', ent: 'lamp2' }, { map: 'hollow', ent: 'nona' },
    { map: 'hollow', ent: 'lamp3' }, { map: 'hollow', ent: 'boss' },
    { map: 'edgewick', warp: 'granDoor' }, { map: 'granhouse', ent: 'granGrey' }, { map: 'granhouse', warp: 'door' },
    { map: 'edgewick', ent: 'greatLampOut' }, { map: 'edgewick', ent: 'nona' }, { map: 'edgewick', ent: 'west' },
  ],
};
