import type { MapDef, EntDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { nextChapter } from './common';
import { Grid } from './grid';

const f = (s: Ctx, k: string) => s.has(k);

// ---------- The Carillon Road ----------

function buildRoad(): string[] {
  const g = new Grid(40, 18, 'R');
  g.rect(1, 1, 38, 16, '.');
  g.scatter(1, 1, 38, 16, ',', 0.55, 31, '.');
  g.scatter(1, 1, 38, 16, 'R', 0.07, 32, ',.');
  g.scatter(1, 1, 38, 16, 'Y', 0.05, 33, ',.');
  g.path([[39, 9], [30, 9], [30, 5], [18, 5], [18, 12], [6, 12], [6, 9], [0, 9]], ':');
  g.put(39, 9, 'e').put(0, 9, 'w');
  g.put(19, 8, 'l');
  g.put(35, 3, 'a').put(8, 15, 'b');
  g.put(25, 6, 'p').put(10, 11, 'h');
  g.put(29, 4, 's').put(17, 13, 't');
  return g.rows();
}

const road: MapDef = {
  id: 'carillonRoad', name: 'The Pilgrim Road', music: 'church', rows: buildRoad(), under: '.', outside: 'R', bg: 'rock',
  theme: {
    ground: ['k', 'n1', 'e1'], tall: ['k', 'n1', 'y1'], path: ['k', 'n2', 'n3'], rock: ['k', 'g1', 'n2'], pine: ['k', 'e1', 'n1'],
  },
  enc: { rate: 0.12, groups: [['ghoul2', 3], ['mimic2', 3], ['pew3', 2]] },
  ents: [
    { id: 'east', at: 'e', kind: 'warp', to: ['prismouth', 'x', 'left'], under: ':' },
    { id: 'west', at: 'w', kind: 'warp', to: ['carillon', 'e', 'left'], under: ':' },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'chestA', at: 'a', kind: 'chest', item: 'candle', n: 2 },
    { id: 'chestB', at: 'b', kind: 'chest', item: 'pin', n: 2 },
    { id: 'shrine1', at: 's', kind: 'prop', spr: NPC.shrine, talk: async s => s.tell('A roadside shrine to the Loom. Someone has left an offering of a single blue thread. The shrine has turned it grey.') },
    { id: 'shrine2', at: 't', kind: 'prop', spr: NPC.shrine, talk: async s => s.tell('A carved plaque: THE LOOM GIVES. THE LOOM KEEPS. Below it, smaller and newer: THE LOOM TAKES BACK.') },
    { id: 'pilgrim', at: 'p', kind: 'npc', spr: NPC.pilgrimB, talk: async s => {
      await s.say('Pilgrim', 'We\'re going to Carillon for the Inking. You finish the Trial of Bells and the Choir blesses you with a brighter hue. I was printed rust and beige. I\'d like to be something a bird would notice.');
      await s.say('Wick', '...A brighter hue. Anyone can get one?');
      await s.say('Pilgrim', 'Anyone who finishes the Trial. My cousin went last spring. She hasn\'t written, but I\'m sure she\'s very bright now.');
    } },
    { id: 'hermit', at: 'h', kind: 'npc', spr: NPC.hermit, talk: async s => {
      await s.say('Hermit Oda', 'You want to know what happens to the pilgrims? So did I. I went to Carillon forty years ago and I came back. That\'s the unusual part.');
      await s.say('Hermit Oda', 'Listen to the bells. A bell that rings grey takes something with it when it rings. Don\'t let them ring you.');
    } },
  ],
};

// ---------- Carillon ----------

function buildCarillon(): string[] {
  const g = new Grid(40, 30, 'X');
  g.rect(1, 2, 38, 27, '_');
  for (const ry of [7, 12, 19, 25]) {
    g.rect(1, ry, 12, 1, 'X');
    g.rect(27, ry, 12, 1, 'X');
    for (const ax of [4, 10, 30, 36]) g.put(ax, ry, '_');
  }
  g.rect(14, 3, 12, 5, '^');
  g.rect(14, 8, 12, 1, 'B');
  g.put(15, 8, 'W').put(24, 8, 'W').put(19, 8, 'c');
  g.rect(13, 2, 1, 7, 'P');
  g.rect(26, 2, 1, 7, 'P');
  g.path([[39, 15], [0, 15]], ':');
  g.path([[19, 9], [19, 15]], ':');
  // Inn and shop houses.
  g.rect(3, 20, 7, 2, '^').rect(3, 22, 7, 1, 'B').put(4, 22, 'W').put(8, 22, 'W');
  g.rect(29, 8, 7, 2, '^').rect(29, 10, 7, 1, 'B').put(30, 10, 'W').put(34, 10, 'W');
  // Garden of Quiet: grey pilgrims standing in rows.
  g.rect(28, 20, 10, 4, '"');
  g.put(29, 21, 'q').put(31, 21, 'r').put(33, 21, 's').put(35, 21, 't').put(30, 23, 'u').put(34, 23, 'v');
  g.put(39, 15, 'e').put(0, 15, 'g').put(2, 15, 'z');
  g.put(6, 23, 'i').put(32, 11, 'k');
  g.put(22, 12, 'a').put(9, 10, 'o').put(17, 20, 'b').put(24, 17, 'h').put(33, 16, 'm').put(7, 4, 'y').put(22, 26, 'n');
  g.put(16, 12, 'l').put(36, 27, 'j').put(2, 3, 'x');
  return g.rows();
}

const tetherGate: Script = async s => {
  if (s.st.chapter >= 4) { await s.warp('hourglass', 'e', 'left'); return; }
  if (!f(s, 'escaped')) {
    await s.tell('A great iron gate in the giant\'s hip, marked THE TETHER ROAD. Two templars stand in front of it.');
    await s.say('Templar', 'Pilgrim Seal, or turn around. The Tether is for the faithful.');
    await s.movePlayer('r');
    return;
  }
  await s.tell('Tint presses the stolen Seal against the lock. The gate grinds open onto a pale road running toward a desert that ticks.');
  await nextChapter(s, 4);
};

const cathedralDoor: Script = async s => {
  if (f(s, 'escaped')) { await s.tell('The cathedral doors are chained shut. Grey dust drifts out from underneath.'); await s.movePlayer('d'); return; }
  if (!f(s, 'trialOpen')) {
    await s.say('Sister Vesper', 'The Trial of Bells begins inside, pilgrim. Ring all three bells, climb to the belfry, and the Cantor himself will give you the Seal and your Inking.');
    s.flag('trialOpen');
  }
  await s.warp('cathedral', 'e', 'up');
};

const statue = (id: string, at: string, line: string): EntDef => ({
  id, at, kind: 'prop', spr: NPC.greyPilgrim, talk: async s => {
    await s.tell(line);
    if (!f(s, 'sawGarden')) {
      s.flag('sawGarden');
      await s.say('Tint', 'These aren\'t statues. Look at the faces. These are PEOPLE.');
      await s.say('Nona', 'Greyed, like your grandmother, Wick. Every one of them.');
      await s.say('Wick', 'The pilgrim on the road said her cousin came here for the Inking last spring.');
    }
  },
});

const carillon: MapDef = {
  id: 'carillon', name: 'Carillon', music: 'church', rows: buildCarillon(), under: '_', outside: 'X', bg: 'bone',
  theme: {
    bone: ['k', 'g3', 'w'], floor: ['k', 'g1', 'n1'], path: ['k', 'n2', 'g3'], roof: ['k', 'b1', 'b2'], brick: ['k', 'g1', 'b2'],
    pillar: ['k', 'g2', 'y2'], window: ['k', 'b1', 'y3'], flowers: ['k', 'g1', 'g3'],
  },
  ents: [
    { id: 'east', at: 'e', kind: 'warp', to: ['carillonRoad', 'w', 'right'], under: ':' },
    { id: 'gate', at: 'g', kind: 'trigger', step: tetherGate, under: ':' },
    { id: 'escapeMark', at: 'z', kind: 'trigger', under: ':', step: async () => {} },
    { id: 'door', at: 'c', kind: 'trigger', step: cathedralDoor, under: 'D' },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'inn', at: 'i', kind: 'npc', spr: NPC.bellInn, talk: async s => {
      await s.say('Bellamy', 'The Belfry Inn. Every room has a bell. Please do not ring it. Twenty-five gold.');
      if (await s.ask('Rest for 25 gold?', ['Rest', 'No thanks']) !== 0) return;
      if (s.st.gold < 25) { await s.say('Bellamy', 'No gold, no bell. Sorry.'); return; }
      await s.gold(-25, true);
      await s.fadeOut(); s.heal(); s.save(); await s.fadeIn();
      await s.tell('The party rests. Nobody rings the bell. Progress saved.');
    } },
    { id: 'shop', at: 'k', kind: 'npc', spr: NPC.relic, talk: async s => {
      await s.say('Reliquarian', 'Relics, blessed tallow, and swords that have been prayed at. All sales are final and holy.');
      await s.shop('carillon');
    } },
    { id: 'greeter', at: 'a', kind: 'npc', spr: NPC.greeter, talk: async s => {
      if (f(s, 'escaped')) { await s.say('Sister Vesper', 'Heretic. The Bishop has named you. Every bell in Carillon knows your name now.'); return; }
      await s.say('Sister Vesper', 'Welcome to Carillon, pilgrims, city of the Colossus, first and last stop before the Loom. The Trial of Bells is in the cathedral.');
      await s.say('Sister Vesper', 'Finish it and receive the Pilgrim Seal, which opens the Tether road, and your Inking, which makes you bright.');
      await s.say('Sister Vesper', 'Oh. Oh, you poor thing, you\'re a Duotone. The Inking was MADE for people like you.');
      await s.tell('Wick says nothing. Wick\'s hand tightens on the lamp.');
    } },
    { id: 'clapper', at: 'o', kind: 'npc', spr: NPC.clapper, talk: async s => {
      await s.say('Old Clapper', 'EH? The Trial? THREE BELLS. ONE IN EACH WING. The first opens the west, the west opens the east, and when all three ring, the stairs open.');
      await s.say('Old Clapper', 'I RANG THEM FOR SIXTY YEARS. NOW I CAN\'T HEAR THEM. I THINK THAT\'S WHY I\'M STILL BROWN.');
    } },
    { id: 'theologian', at: 'b', kind: 'npc', spr: NPC.theologian, talk: async s => {
      await s.say('Unit 9 of Doctrine', 'Is the Loom a god or an appliance? I have argued both sides for forty years. My current position is: both, and it is broken.');
    } },
    { id: 'oiler', at: 'h', kind: 'npc', spr: NPC.oiler, wander: true, talk: async s => {
      await s.say('Gim', 'The giant\'s knee creaks every noon. I oil it. It\'s my whole job. It\'s a very big knee.');
      if (!f(s, 'gimGift')) { s.flag('gimGift'); await s.say('Gim', 'You look like you fight things. Here. Knee grease. It works on wounds too, probably.'); await s.give('candle'); }
    } },
    { id: 'grayling', at: 'm', kind: 'npc', spr: NPC.grayling, talk: async s => {
      if (f(s, 'escaped')) { await s.say('Brother Grayling', 'You broke the great bell. The quiet is coming anyway, child. It always comes.'); return; }
      await s.say('Brother Grayling', 'You came! And the loud girl, and the cat. The Choir sings tonight in the belfry. Finish your Trial and you will hear it up close.');
    } },
    { id: 'pilgrim', at: 'y', kind: 'npc', spr: NPC.pilgrimA, talk: async s => s.say('Pilgrim', 'I have been waiting in line for the Trial for six days. The line does not move. I think the line is part of the Trial.') },
    { id: 'chestN', at: 'n', kind: 'chest', item: 'relight' },
    { id: 'chestJ', at: 'j', kind: 'chest', gold: 150 },
    { id: 'chestX', at: 'x', kind: 'chest', item: 'wool_scarf' },
    statue('s1', 'q', 'A grey pilgrim with arms raised, as if catching rain.'),
    statue('s2', 'r', 'A grey pilgrim holding a grey child\'s hand.'),
    statue('s3', 's', 'A grey pilgrim. A tag on its robe reads: INKED.'),
    statue('s4', 't', 'A grey pilgrim smiling. It is the worst thing in the garden.'),
    statue('s5', 'u', 'A grey pilgrim in rust and beige robes, now just grey. The pilgrim on the road described her cousin exactly like this.'),
    statue('s6', 'v', 'A grey pilgrim kneeling. There is a single faded feather in its hat.'),
  ],
};

// ---------- The cathedral: Trial of Bells ----------

function buildCathedral(): string[] {
  const g = new Grid(31, 25, '#');
  g.rect(1, 1, 29, 7, '_');
  for (let x = 3; x <= 11; x += 2) for (const y of [3, 5]) g.put(x, y, '|');
  for (let x = 19; x <= 27; x += 2) for (const y of [3, 5]) g.put(x, y, '|');
  g.put(14, 2, 'P').put(16, 2, 'P').put(15, 2, 'u');
  g.put(15, 8, 'z');
  g.rect(15, 9, 1, 10, '_');
  g.rect(1, 9, 9, 15, '_');
  g.rect(21, 9, 9, 15, '_');
  g.rect(11, 19, 9, 5, '_');
  g.put(10, 20, 'x').put(20, 20, 'y');
  g.rect(2, 10, 3, 3, 'H');
  g.put(3, 11, 'k').put(3, 12, 'j');
  g.put(15, 20, 'a').put(5, 16, 'b').put(25, 16, 'c');
  g.put(24, 18, 'm').put(3, 21, 'n').put(28, 21, 'o').put(25, 11, 'l').put(15, 23, 'e');
  g.put(12, 22, 'v').put(18, 22, 'w');
  return g.rows();
}

const ring = (id: string, opens: string, line: string): Script => async s => {
  if (f(s, `bell_${id}`)) { await s.tell('The bell is still humming from the last time.'); return; }
  s.flag(`bell_${id}`);
  s.sfx('bell');
  s.shake(12);
  await s.tell(line);
  s.flag(opens);
  if (f(s, 'bell_a') && f(s, 'bell_b') && f(s, 'bell_c') && !f(s, 'open_z')) {
    s.sfx('bell');
    await s.tell('Three bells ring together. Far above, something answers with a note so low the floor shakes. The north barrier fades.');
    s.flag('open_z');
  }
};

const brask: Script = async s => {
  if (f(s, 'braskJoined')) return;
  if (!f(s, 'bell_b')) {
    await s.tell('Behind the bars stands an empty suit of templar armor. Pale moths crawl in and out of the visor. As Wick\'s lamp comes close, every moth turns toward it.');
    await s.say('Brask', 'Ah. A lamp. We have not seen a lamp in a long time. Forgive us. We are Brask, once of the Templar Order of the Loom.');
    await s.say('Brask', 'We were locked here for asking a question. The question was: where does the color go?');
    await s.say('Brask', 'Our lock is tuned to the bell in this wing. Ring it and the door will open. We would be grateful. The moths would be ecstatic.');
    s.flag('metBrask');
    return;
  }
  await s.tell('The cell door stands open. The armor steps out, a little unsteady, moths spilling from every joint.');
  await s.say('Brask', 'Free. Thank you, lamp-bearer. Now listen, all of you, because we know this place.');
  await s.say('Brask', 'The Trial is real. The Seal is real. The Inking is a lie. The Cantor greys every pilgrim who reaches the belfry, and the bells carry the color up.');
  await s.say('Tint', 'Up to the Loom.');
  await s.say('Brask', 'To something up there that is hungry. We will go with you to the belfry. We have wanted to hit the Cantor for eleven years.');
  s.flag('braskJoined');
  s.mech('break');
  await s.join('brask', Math.max(9, s.st.members.wick.lvl));
  await s.say('Brask', 'One more thing. Everything the Church makes wears a shell of prayer. Strike its weakness and the shell cracks. Crack it all the way and it ^ybreaks^0. A broken foe loses its turn and takes half again as much harm.');
  await s.tell('^yBreak^0: the white pips over a foe are its shell. Weakness hits crack one pip. Brask\'s ^yCrush^0 cracks two with any hue. Break the shell to stagger it.');
};

const cathedral: MapDef = {
  id: 'cathedral', name: 'Cathedral of the Colossus', music: 'church', rows: buildCathedral(), under: '_', outside: '#', bg: 'pillar',
  legend: { '_': { kind: 'floor', enc: true } },
  theme: { wall: ['k', 'g2', 'b3'], floor: ['k', 'ink', 'b1'], fence: ['k', 'n1', 'n2'], pillar: ['k', 'g2', 'y2'], glass: ['k', 'g1', 'b2'] },
  enc: { rate: 0.11, groups: [['aco2', 3], ['aco3', 2], ['rib', 2], ['pew3', 2], ['mimic2', 2]] },
  ents: [
    { id: 'exit', at: 'e', kind: 'warp', to: ['carillon', 'c', 'down'], under: '_' },
    { id: 'up', at: 'u', kind: 'trigger', under: 'S', step: async s => { await s.warp('belfry', 'd', 'up'); } },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'bellA', at: 'a', kind: 'prop', spr: NPC.bell, talk: ring('a', 'open_x', 'The first bell rings low and long. To the west, a grey barrier thins and disappears.') },
    { id: 'bellB', at: 'b', kind: 'prop', spr: NPC.bell, talk: ring('b', 'open_y', 'The second bell rings in the middle of the scale. The cell lock clicks, and a barrier to the east fades.') },
    { id: 'bellC', at: 'c', kind: 'prop', spr: NPC.bell, talk: ring('c', 'open_c', 'The third bell rings high, almost a whistle.') },
    { id: 'barrierX', at: 'x', kind: 'prop', spr: NPC.barrier, when: st => !st.flags.open_x, talk: async s => s.tell('A wall of grey static hums in the doorway. It is tuned to a bell.') },
    { id: 'barrierY', at: 'y', kind: 'prop', spr: NPC.barrier, when: st => !st.flags.open_y, talk: async s => s.tell('A wall of grey static hums in the doorway. It is tuned to a bell.') },
    { id: 'barrierZ', at: 'z', kind: 'prop', spr: NPC.barrier, when: st => !st.flags.open_z, talk: async s => s.tell('The stair barrier. It will open when all three bells have rung.') },
    { id: 'cell', at: 'j', kind: 'prop', spr: NPC.cellDoor, when: st => !st.flags.bell_b, talk: brask },
    { id: 'brask', at: 'k', kind: 'npc', spr: NPC.brask, when: st => !st.flags.braskJoined, talk: brask },
    { id: 'chestM', at: 'm', kind: 'chest', item: 'cyan_edge' },
    { id: 'chestN', at: 'n', kind: 'chest', item: 'candle', n: 2 },
    { id: 'chestO', at: 'o', kind: 'chest', item: 'ink_vial', n: 3 },
    { id: 'guard1', at: 'v', kind: 'npc', spr: NPC.greeter, when: st => !st.flags.guard1, talk: async s => {
      await s.say('Grey Acolyte', 'Pilgrim, the Trial is not for asking questions. The Trial is for walking quietly in a line.');
      if (await s.battle('aco2') === 'win') { s.flag('guard1'); s.refresh(); }
    } },
    { id: 'guard2', at: 'w', kind: 'npc', spr: NPC.greeter, when: st => !st.flags.guard2, talk: async s => {
      await s.say('Grey Acolyte', 'Hush. Hush. Hush.');
      if (await s.battle('aco2') === 'win') { s.flag('guard2'); s.refresh(); }
    } },
  ],
};

// ---------- The belfry ----------

function buildBelfry(): string[] {
  const g = new Grid(17, 12, '#');
  g.rect(1, 1, 15, 10, '_');
  g.put(8, 2, 'g').put(8, 4, 'h').put(8, 6, 'b').put(8, 10, 'd');
  g.put(6, 4, 'p').put(10, 4, 'q');
  g.put(2, 2, 'P').put(14, 2, 'P').put(2, 9, 'P').put(14, 9, 'P');
  return g.rows();
}

const cantorFight: Script = async s => {
  if (f(s, 'hushDead')) return;
  s.music('boss');
  await s.tell('The belfry is full of grey pilgrims standing in a ring, facing a man in white robes who is singing with his eyes closed. The great bell above him hums along.');
  await s.say('Cantor Hush', 'More pilgrims! Come in, come in. Stand in the ring. The Inking takes only a moment. You feel lighter afterward. Everyone says so. Well. Everyone used to say so.');
  if (s.inParty('brask')) await s.say('Brask', 'Hush. We asked you once where the color goes. You put us in a cell. We are asking again.');
  await s.say('Cantor Hush', 'The deserter! And a Duotone, and a witch, and a cat from the sky. Choir! Sing them quiet.');
  const r = await s.battle('boss3');
  if (r !== 'win') return;
  s.flag('hushDead');
  await s.tell('Cantor Hush staggers back against the great bell. The Pilgrim Seal slips from his sleeve and rolls to Tint\'s feet.');
  await s.give('seal');
  s.music('loom');
  s.shake(40);
  await s.flash('w');
  await s.tell('The great bell rings once by itself. The note is so low it is almost silence. When it fades, someone is standing on top of the bell.');
  await s.tell('A tall figure in grey and white, with a face like a blank page.');
  await s.say('The Grey Bishop', 'Cantor. You have been loud.');
  await s.say('Cantor Hush', 'Your Grace, they, the deserter, the witch...');
  await s.say('The Grey Bishop', 'Quiet now.');
  await s.tell('The Bishop lays one grey hand on the great bell. The bell loses its gold, then its shape, then itself. Where it hung, there is only a clean grey square in the air. Cantor Hush is gone with it.');
  await s.say('The Grey Bishop', 'And this one. The misprint.');
  await s.tell('The Bishop reaches toward Wick. Nothing happens. The Bishop tilts his head.');
  await s.say('The Grey Bishop', 'Unindexed. I cannot read you, little lamp. How irritating. How... interesting.');
  await s.say('The Grey Bishop', 'Go home. There is nothing up there for you. There is nothing up there for anyone, soon. Carillon, this is a heretic. Ring for them.');
  await s.tell('He is gone. Below, every bell in Carillon begins to ring the same grey note.');
  await s.say('Brask', 'The templars will come up the stairs. There is another way down: the giant\'s throat. Follow the moths.');
  await s.battle('templars');
  s.flag('escaped');
  await s.fadeOut();
  await s.tell('They crawl down through the Colossus\'s throat, a tunnel of rusted cables, and come out beside the west gate.');
  await s.warp('carillon', 'z', 'left');
  await s.say('Wick', 'I thought they might give me a hue. The Inking. I really thought...');
  await s.say('Tint', 'Yeah.');
  await s.say('Wick', 'Nobody up there is giving out colors. They\'re taking them. So I\'m not going up to ask for anything anymore.');
  await s.say('Nona', 'Then what are you going up for?');
  await s.say('Wick', 'To make them stop.');
  await s.say('Brask', 'We like this lamp. The Tether gate is just west. We have a Seal, and we are all heretics now, which is freeing.');
};

const belfry: MapDef = {
  id: 'belfry', name: 'The Belfry', music: 'church', rows: buildBelfry(), under: '_', outside: '#', bg: 'pillar',
  theme: { wall: ['k', 'g2', 'y2'], floor: ['k', 'n1', 'g1'], pillar: ['k', 'g2', 'y2'] },
  ents: [
    { id: 'down', at: 'd', kind: 'warp', to: ['cathedral', 'u', 'down'], under: 'S' },
    { id: 'bell', at: 'g', kind: 'prop', spr: NPC.bell, when: st => !st.flags.hushDead, talk: async s => s.tell('The great bell of Carillon. It is humming the same note as the Cantor.') },
    { id: 'bellGone', at: 'g', kind: 'prop', spr: NPC.bellGrey, when: st => !!st.flags.hushDead, talk: async s => s.tell('A clean grey square hangs in the air where the great bell was. It is the most frightening thing Wick has ever seen.') },
    { id: 'hush', at: 'h', kind: 'npc', spr: NPC.cantor, when: st => !st.flags.hushDead, talk: cantorFight },
    { id: 'boss', at: 'b', kind: 'trigger', step: cantorFight },
    { id: 'g1', at: 'p', kind: 'prop', spr: NPC.greyPilgrim, talk: async s => s.tell('A grey pilgrim, still warm.') },
    { id: 'g2', at: 'q', kind: 'prop', spr: NPC.greyPilgrim, talk: async s => s.tell('A grey pilgrim, still warm.') },
  ],
};

export const maps: MapDef[] = [road, carillon, cathedral, belfry];

export const chapter: ChapterDef = {
  title: 'Bell Jar',
  stage: 'Tests, allies, enemies',
  blurb: 'The Church of the Loom offers pilgrims a brighter hue. Wick wants one badly.',
  recruit: 'brask',
  ready: true,
  startMap: 'carillonRoad',
  startMarker: 'e',
  intro: async s => {
    await s.tell('The road from Prismouth climbs into bare hills. Ahead, bells are ringing, and every bell rings the same note.');
    await s.say('Tint', 'Carillon. The city in the dead giant. I went once as a kid. The bells gave me a headache for a week.');
    await s.say('Nona', 'The Lens showed us a choir in a giant\'s ribs. That is where we are going.');
    await s.say('Wick', 'The Church does Inkings, right? People go there to get brighter.');
    await s.say('Tint', 'That\'s what they say.');
  },
  objective: st => {
    const fl = st.flags;
    if (!fl.trialOpen) return 'Follow the Pilgrim Road west to Carillon and enter the cathedral.';
    if (!fl.bell_a) return 'The Trial of Bells: ring the first bell in the cathedral hall.';
    if (!fl.braskJoined) return 'Ring the bell in the west wing and free the prisoner in the cell.';
    if (!fl.open_z) return 'Ring the bell in the east wing to finish the Trial.';
    if (!fl.hushDead) return 'Climb to the belfry and face the Cantor.';
    return 'Take the Seal to the Tether gate on Carillon\'s west side.';
  },
  route: [
    { map: 'carillonRoad', warp: 'west' },
    { map: 'carillon', ent: 'greeter' }, { map: 'carillon', ent: 'shop' }, { map: 'carillon', ent: 's5' }, { map: 'carillon', ent: 'door' },
    { map: 'cathedral', ent: 'bellA' }, { map: 'cathedral', ent: 'cell' }, { map: 'cathedral', ent: 'bellB' }, { map: 'cathedral', ent: 'brask' },
    { map: 'cathedral', ent: 'bellC' }, { map: 'cathedral', ent: 'up' },
    { map: 'belfry', ent: 'boss' },
    { map: 'carillon', ent: 'gate' },
  ],
};
