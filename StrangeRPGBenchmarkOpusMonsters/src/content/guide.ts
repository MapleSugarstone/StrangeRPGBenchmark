// The Guide at the front of the Register: one chapter for each part of the game, in plain words.
// Numbers come from the code where the code names them, so the Guide changes when the rules do.
// src/tools/readability.ts scores every chapter and writes Notes/guide.md.
import { FATIGUE_ROUND, FIT_STAT, HORN_CHA_MAX, HORN_FLOOR, HORN_HELD, HORN_LINE, NERVE_MAX, SUMMON_CAP, TAN_PER_STAT, TAN_TOTAL, tanBonus, tanPerLayer, tanText } from '../battle/engine';
import { STARBORN_ODDS } from '../data/starborn';
import { LEVEL_MAX } from '../data/types';
import { G, HORN_PRICE } from '../game/state';

/**
 * A paragraph, a small heading, a picture the Register draws, or a row with a small icon before one line.
 * A row's `when` hides it until the player has met what it names. The readability check scores every row.
 */
export type Block =
  | { p: string }
  | { h: string }
  | { pic: string }
  | { icon: string; s: string; when?: () => boolean };

/** `short` names the chapter on the contents page when the title is too long for it. */
export interface Chapter { id: string; title: string; short?: string; icon: string; open: () => boolean; blocks: Block[] }

const pct = (x: number): number => Math.round(x * 100);
const all = () => [...G.party, ...G.rack];
const hasTeam = () => all().length > 0;
const battled = () => hasTeam() && Object.keys(G.register).length > 0;

export const GUIDE: Chapter[] = [
  {
    id: 'team', title: 'Your team', icon: 'team', open: hasTeam,
    blocks: [
      { p: 'A whorl is a creature that fights for you. Your team is the whorls you take with you. A team can have 4 whorls.' },
      { p: 'The first whorl in your team is your lead. Your lead walks with you. It is the first one out in a battle.' },
      { pic: 'team' },
      { p: 'One whorl fights at a time. It is your out whorl. The others wait in reserve.' },
      { h: 'Switching' },
      { p: 'Pick Switch in a battle to send out a whorl from reserve. A switch is quick. It takes half as long as an Attack.' },
      { p: 'A whorl that is rooted or taunted cannot switch out.' },
      { h: 'Knocked out' },
      { p: 'A whorl with 0 HP is knocked out. The game also says it is down, or calls it a KO. It cannot fight again in that battle. Then you pick the next whorl to send out.' },
      { p: 'Every battle starts with full HP. So a knocked out whorl is fine when the battle is over.' },
      { p: 'If your whole team is down, you lose the battle. You drop 20% of your cowries. Then you walk back to the last grotto you used. A grotto is the shop in each town.' },
      { h: 'The Midden' },
      { p: 'When your team is full, new whorls go to the Midden. You can reach the Midden at any grotto. There you can swap whorls in and out of your team.' },
      { p: 'To pick a new lead, press X for the menu. Pick Team, then pick a whorl. Then pick Make lead.' },
    ],
  },
  {
    id: 'stats', title: 'Stats', icon: 'stats', open: hasTeam,
    blocks: [
      { p: 'Each whorl has seven stats. A stat is a number. It tells you how good the whorl is at one thing.' },
      { icon: 'word:HP', s: 'HP is health. A whorl with 0 HP is knocked out. Max HP is the most HP it can have.' },
      { icon: 'word:ATK', s: 'ATK is the power of physical hits.' },
      { icon: 'word:MGK', s: 'MGK is the power of magic hits.' },
      { icon: 'word:DEF', s: 'DEF makes physical hits do less.' },
      { icon: 'word:RES', s: 'RES makes magic hits do less.' },
      { icon: 'word:AGI', s: 'AGI is speed. A whorl with more AGI gets more turns.' },
      { icon: 'word:CHA', s: 'CHA helps a horn catch a whorl. Some moves use it too.' },
      { h: 'Each kind is different' },
      { p: 'Each kind has its own strengths. One kind may have more ATK. Another may have more DEF. Kinds are also different in their moves, habits, and types.' },
      { p: 'Every kind gets the same number of stat points. Each kind puts them in different places. So a fast kind has less DEF, and a tough kind gets fewer turns. A conjoined whorl gets half its points from each of the two old whorls.' },
      { pic: 'stats' },
      { p: 'This picture shows the stats of your lead. Stats go up when a whorl gains a level. Things you find later can raise them a little more.' },
      { h: 'What % means' },
      { p: 'Many texts use the sign %. It means out of 100. 50% is half. 25% is one quarter. 10% is one tenth.' },
      { h: 'Physical and magic' },
      { p: 'Each whorl has a plain Attack. It is physical or magic. A physical Attack uses ATK. A magic Attack uses MGK.' },
      { p: 'A move\'s text tells you which stat it uses. Hits for 110% ATK is a physical hit. Hits for 90% MGK is a magic hit.' },
      { h: 'DEF and RES' },
      { p: 'DEF and RES make a hit smaller. Say a hit has 100 power. It does 70 damage to a whorl with 42 DEF. It does 50 damage to a whorl with 100 DEF.' },
      { pic: 'armor' },
      { p: 'So DEF helps most against physical whorls. RES helps most against magic whorls.' },
      { p: 'To see a whorl\'s stats, press X. Pick Team, then the whorl, then Look. The Stats tab shows them.' },
    ],
  },
  {
    id: 'turns', title: 'Turns and time', short: 'Turns', icon: 'turns', open: battled,
    blocks: [
      { p: 'In a battle, whorls do not just take turns one by one. After a whorl acts, it has to wait. The whorl whose wait ends first moves next.' },
      { p: 'AGI makes the wait shorter. So a fast whorl can move twice before a slow one moves once.' },
      { p: 'Here is an example. Your whorl has 69 AGI. The foe has 51 AGI. Your whorl moves first. Over the whole battle, it gets about 9 turns for every 8 the foe gets.' },
      { pic: 'timeline' },
      { h: 'Quick actions' },
      { p: 'Some actions have a short wait. After a Guard, a whorl waits 80% as long as after an Attack. After a Switch, it waits half as long.' },
      { p: 'Slow makes a whorl wait 30% longer. Haste makes it wait 30% less.' },
      { h: 'Comes sooner' },
      { p: 'Some texts say its next turn comes 40% sooner. This means the whorl waits less before it moves again. The wait gets about 40% shorter.' },
      { h: 'Moving twice' },
      { p: 'Look at the top line of the battle. It tells you when a whorl will move twice in a row.' },
      { h: 'Wind-ups' },
      { p: 'A wind-up is a move that lands later. A ! shows over a whorl while it winds up. The top line tells you how many moves you get first.' },
      { p: 'You can stop a foe\'s wind-up. Stun, Silence, Sleep, or Taunt cuts it off. So does forcing the foe out.' },
      { p: 'You can also switch to a whorl that takes less from the move. An Unstoppable wind-up cannot be cut off.' },
      { h: 'Rounds' },
      { p: 'A round is one turn for each side. The game counts rounds in very long battles.' },
    ],
  },
  {
    id: 'moves', title: 'Attack, moves, and Guard', short: 'Actions', icon: 'moves', open: battled,
    blocks: [
      { p: 'On your turn, you pick one action. You can Attack, use a move, Guard, or Switch.' },
      { h: 'Attack' },
      { p: 'Attack is your whorl\'s plain hit. You can use it every turn. It never runs out. An Attack has no type, so it hits every type the same.' },
      { h: 'Moves' },
      { p: 'Each whorl has four moves. A move hits harder, or it does something special. Before you pick a move, look at it. Its text tells you what it does.' },
      { p: 'The text is short. Hits for 110% ATK means a hit with 1.1 times the whorl\'s ATK. Slow 1 means the foe is slowed for 1 turn.' },
      { h: 'Cooldowns' },
      { p: 'After you use a move, it has to rest. The rest is its cooldown. The menu shows how many turns are left.' },
      { p: 'Here is an example. Flatten has a cooldown of 3. Squall uses Flatten. Then Flatten rests for Squall\'s next 3 turns. On the 4th turn, it is ready again.' },
      { pic: 'cooldown' },
      { p: 'A cooldown counts your side\'s turns. It keeps going down while the whorl waits in reserve.' },
      { h: 'Same type' },
      { p: 'A move of the whorl\'s own type hits 20% harder. Squall is a TIDE whorl. So its TIDE moves hit 20% harder.' },
      { h: 'Moves that hit every foe' },
      { p: 'Some moves hit every foe. The out foe takes the full hit. Each foe in reserve takes a smaller part. It is often about one third.' },
      { h: 'Guard' },
      { p: 'Guard cuts the damage your whorl takes in half. It lasts until your whorl\'s next turn.' },
      { p: 'You cannot Guard two turns in a row. A Guard is quick, too.' },
      { h: 'Habits' },
      { p: 'Each whorl has two habits. A habit works by itself. You do not pick it. In a battle, press left or right on the menu to read the habits.' },
    ],
  },
  {
    id: 'tide', title: 'Crests and tide', short: 'Tide', icon: 'tide', open: () => !!G.flags.nerve,
    blocks: [
      { p: 'A crest is a whorl\'s biggest move. Most whorls have one crest. A crest costs tide.' },
      { p: `Tide is a pool that your whole team shares. It holds up to ${NERVE_MAX}. It starts each battle at 2.` },
      { pic: 'tide' },
      { h: 'How to get tide' },
      { icon: 'dot', s: 'An Attack that lands adds 1 tide.' },
      { icon: 'dot', s: 'When a move hits a whorl that guards, its side gets 1 tide. This works once for each Guard.' },
      { icon: 'dot', s: 'When you knock out a foe, you get 2 tide.' },
      { icon: 'dot', s: 'When one of your whorls is knocked out, you get 1 tide.' },
      { icon: 'dot', s: 'Some moves, habits, and notions add tide too.', when: () => !!G.flags.notions },
      { p: 'Here is an example. Cloudburst is Squall\'s crest. It costs 5 tide. You start with 2. Land 3 Attacks, and you have 5.' },
      { p: 'The foe has its own pool of tide. Watch it. When it is full, a crest may come.' },
      { p: 'A crest has a cooldown too, like any other move.' },
    ],
  },
  {
    id: 'types', title: 'Types', icon: 'types', open: battled,
    blocks: [
      { p: 'Every whorl has one or two types. Every move has one type. Types decide who is strong against whom.' },
      { p: 'There are six types. They are STONE, TIDE, ROOT, GEAR, BEAST, and STAR.' },
      { pic: 'types' },
      { p: 'Each row is the type of a move. Each column is the type of the foe. A plus means the move is strong. A minus means it is weak.' },
      { p: 'A strong hit does 1.5 times the damage. A weak hit does about two thirds of it.' },
      { p: 'Here is an example. TIDE is strong against STONE. Squall\'s Rain Shot hits Kivishi 1.5 times as hard. STONE is weak against TIDE. Kivishi\'s STONE moves do two thirds on Squall.' },
      { h: 'Two types' },
      { p: 'A whorl with two types counts both. If both are weak to a move, it hits 2 times as hard. A strong one and a weak one cancel out. A hit never does more than 2 times, or less than half.' },
      { p: 'When a hit lands, the battle shows strong or weak. Before you pick a move, look at it. It tells you when the foe is weak to it.' },
      { p: 'A plain Attack has no type. Damage from statuses has no type either.' },
    ],
  },
  {
    id: 'statuses', title: 'Statuses', icon: 'statuses', open: battled,
    blocks: [
      { p: 'A status is a short effect on a whorl. It shows as a small icon by the whorl\'s HP bar.' },
      { p: 'The number after a status is how many turns it lasts. Slow 2 lasts for 2 of the whorl\'s own turns. For Bleed and Poison, the number is how many stacks there are.' },
      { h: 'Bad statuses' },
      { icon: 'status:stun', s: 'Stun. The whorl loses its next turn. A stun also cuts off a wind-up.' },
      { icon: 'status:sleep', s: 'Sleep. The whorl loses its turns. A hit wakes it up.' },
      { icon: 'status:silence', s: 'Silence. The whorl cannot use moves. It can still Attack, Guard, or Switch.' },
      { icon: 'status:taunt', s: 'Taunt. The whorl can only Attack.' },
      { icon: 'status:root', s: 'Root. The whorl cannot switch out.' },
      { icon: 'status:slow', s: 'Slow. The whorl waits 30% longer between turns.' },
      { icon: 'status:burn', s: 'Burn. The whorl takes magic damage at the start of each turn.' },
      { icon: 'status:bleed', s: 'Bleed. The whorl takes physical damage at the start of each turn. Then it loses one stack.' },
      { icon: 'status:poison', s: 'Poison. The whorl loses 3% of its max HP for each stack at the start of each turn. Then it loses one stack.' },
      { icon: 'status:rot', s: 'Rot. Healing on the whorl is cut in half.' },
      { icon: 'status:expose', s: 'Expose. The whorl takes 25% more damage.' },
      { icon: 'status:weaken', s: 'Weaken. The whorl deals 25% less damage.' },
      { icon: 'status:doom', s: 'Doom. The whorl takes damage each turn. It cannot heal or use moves.' },
      { h: 'Good statuses' },
      { icon: 'status:haste', s: 'Haste. The whorl waits 30% less between turns.' },
      { icon: 'status:empower', s: 'Empower. The whorl deals 25% more damage.' },
      { icon: 'status:fortify', s: 'Fortify. The whorl takes 25% less damage.' },
      { icon: 'status:regen', s: 'Regen. The whorl heals a little at the start of each turn.' },
      { icon: 'status:ward', s: 'Ward. It stops the next move a foe uses on the whorl. If nothing comes, it fades after 2 turns.' },
      { icon: 'status:thorns', s: 'Thorns. When the whorl is hit, it hits back for part of the damage.' },
      { icon: 'status:invuln', s: 'Untouchable. The whorl takes no damage.' },
      { icon: 'status:unstop', s: 'Unstoppable. Stun, Silence, Sleep, Root, Taunt, and Slow do not work on it.' },
      { icon: 'status:stasis', s: 'Stasis. The whorl skips its turns. Nothing can hurt it or give it a status.' },
      { icon: 'status:hidden', s: 'Hidden. A foe\'s single hits cannot find it. Its own next hit goes through Guard.' },
      { icon: 'status:monument', s: 'Monument. The whorl cannot be knocked out. It stays at 1 HP.' },
      { h: 'Switching clears statuses' },
      { p: 'When a whorl switches out, it drops most statuses. Burn, Bleed, Poison, Rot, Doom, Ward, Regen, and Hidden stay on it.' },
    ],
  },
  {
    id: 'marks', title: 'Marks, summons, and shields', short: 'Summons', icon: 'marks', open: battled,
    blocks: [
      { h: 'Marks' },
      { p: 'A mark is a sign that some moves put on a whorl. Each kind has its own marks. Kivishi gets a Stone each time it is hit.' },
      { icon: 'mark', s: 'A mark shows as a small diamond by the HP bar. The number by it is how many stacks it has.' },
      { p: 'To learn what a mark does, read the habits of the whorl that makes it. In a battle, press left or right on the menu.' },
      { p: 'Some marks fade after a few turns. Some go away when the whorl switches out.' },
      { h: 'Summons' },
      { p: 'Some moves call a helper onto the field. This helper is a summon. It stands by its whorl. It has a small HP bar under it.' },
      { p: `Each side can have ${SUMMON_CAP} summons. A new one past that pushes out the oldest.` },
      { p: 'A summon acts by itself. Some summons hit foes. Some guard their whorl. A summon that guards takes single hits meant for its out whorl.' },
      { p: 'A summon has no DEF or RES. Each hit on it does half its power.' },
      { p: 'You can aim at some summons. When you pick Attack, you may pick the summon instead of the whorl.' },
      { p: 'A summon leaves when its HP runs out. Some leave after a set number of turns.' },
      { h: 'Shields' },
      { p: 'A shield is extra HP on top of the HP bar. A hit takes the shield first. It shows as a pale line over the HP bar. A shield fades after a few turns.' },
    ],
  },
  {
    id: 'horns', title: 'Sounding with horns', short: 'Sounding', icon: 'horns',
    open: () => !!G.flags.lesson || Object.values(G.pegs).some(n => n > 0) || all().length > 1,
    blocks: [
      { p: 'You can catch a wild whorl with a horn. The game calls this sounding. A sounded whorl joins your team.' },
      { p: 'In a battle with a wild whorl, pick Sound. Then pick a horn. You can only sound wild whorls.' },
      { p: 'Each horn puts a line on the foe\'s HP bar. If the foe\'s HP is at the line or under it, the horn always works.' },
      { pic: 'horn' },
      { icon: 'horn:twig', s: `Periwinkle horn. The line is at ${pct(HORN_LINE.twig)}%. It costs ${HORN_PRICE.twig} cowries.` },
      { icon: 'horn:brass', s: `Whelk horn. The line is at ${pct(HORN_LINE.brass)}%. It costs ${HORN_PRICE.brass} cowries.` },
      { icon: 'horn:bone', s: `Triton horn. The line is at ${pct(HORN_LINE.bone)}%. It costs ${HORN_PRICE.bone} cowries.` },
      { icon: 'horn:iron', s: 'Nautilus horn. It always works. You can find these, but no shop sells them.' },
      { p: `Over the line, a horn may still work. The lower the foe's HP, the better the chance. A Periwinkle horn always has at least a ${pct(HORN_FLOOR.twig)}% chance.` },
      { p: 'So first make the foe weak. But do not knock it out. A wild whorl that is knocked out gets away.' },
      { p: `Some things help. If the foe is stunned or asleep, the line goes up ${pct(HORN_HELD)}%. If your whorl has more CHA than the foe, the line goes up too, by up to ${pct(HORN_CHA_MAX)}%. Less CHA moves it down.` },
      { p: 'If the horn does not work, you still lose your turn.' },
      { p: 'If your team is full, the new whorl goes to the Midden.' },
      { h: 'Run' },
      { p: 'In a battle with a wild whorl, you can also pick Run. Run always works.' },
    ],
  },
  {
    id: 'notions', title: 'Notions', icon: 'notions', open: () => !!G.flags.notions,
    blocks: [
      { p: 'A notion is a small thing that a whorl holds. Each whorl can hold one notion.' },
      { p: 'Some notions raise a stat. A Whetstone adds 5% ATK. Other notions change how a whorl fights. Bloodglass heals the whorl a little each time it deals damage.' },
      { p: 'To give a notion, press X for the menu. Pick Team, then a whorl, then Give notion. Take notion puts it back in the Bag.' },
      { h: 'Actions' },
      { p: 'Some notions have an action. The action is a choice in the battle menu. It works once each battle. It is quick, like a Switch.' },
      { p: 'Some notions get used up. A Sea Biscuit heals 20% of the whorl\'s HP. After that battle, the Sea Biscuit is gone.' },
      { p: 'You can buy notions at a grotto. Read each one in the Bag before you give it.' },
    ],
  },
  {
    id: 'nacre', title: 'Nacre', icon: 'nacre',
    open: () => G.tan > 0 || all().some(m => Object.values(m.tan || {}).some(n => (n || 0) > 0)),
    blocks: [
      { p: 'Nacre is the shiny lining of a shell. You find it in hidden spots. One piece of nacre is one layer.' },
      { p: 'At a grotto, pick Nacre. Then layer nacre on a whorl. Each layer adds the same points to any stat. So it helps a weak stat as much as a strong one.' },
      { p: `A layer adds more as a whorl grows. It adds ${tanText(tanPerLayer(LEVEL_MAX).stat)} to a stat at level ${LEVEL_MAX}. HP numbers are bigger, so it adds ${tanText(tanPerLayer(LEVEL_MAX).hp)} to HP. The Nacre menu shows what a layer adds at your whorl's level.` },
      { p: `A whorl can take ${TAN_PER_STAT} layers in one stat. It can take ${TAN_TOTAL} layers in all.` },
      { pic: 'nacre' },
      { p: `Here is an example. Say a whorl at level ${LEVEL_MAX} has 69 ATK. It has ${69 + tanBonus(LEVEL_MAX, 'atk', TAN_PER_STAT)} ATK with ${TAN_PER_STAT} layers on ATK.` },
      { p: 'You can take the layers off for free. Pick Take all layers off. Then you get every layer back to use again.' },
    ],
  },
  {
    id: 'conjoin', title: 'Conjoining', short: 'Conjoin', icon: 'conjoin', open: () => !!G.flags.fitting,
    blocks: [
      { p: 'To conjoin is to join two whorls into one new whorl. The Conjoiner does it at a grotto.' },
      { p: 'You pick what the new whorl keeps. It keeps 2 moves from each whorl. It keeps 2 of their habits. It takes 1 or 2 of their types. You also pick its look and its name.' },
      { p: 'It can keep 2 crests at most.' },
      { p: 'You may retune one move. A retuned move takes one of the new whorl\'s types.' },
      { p: 'The new whorl gets the higher level of the two.' },
      { p: 'It costs 10 cowries for each level of the higher whorl. Two level 20 whorls cost 200 cowries.' },
      { h: 'Before you conjoin' },
      { p: 'Conjoining cannot be undone. Both old whorls are gone after it. Their notions go back to your Bag.', },
      { p: `The seam is where the two whorls join. The seam costs the new whorl ${pct(1 - FIT_STAT)}% of every stat.` },
      { p: 'A conjoined whorl cannot be conjoined again. Some whorls cannot be conjoined at all. The menu shows them in gray.' },
    ],
  },
  {
    id: 'levels', title: 'Levels and XP', short: 'Levels', icon: 'levels', open: battled,
    blocks: [
      { p: 'A whorl grows by winning battles. Each win gives experience, called XP. Enough XP gives the whorl a new level. A new level raises its stats.' },
      { p: 'Every whorl in your team gets the XP. It does not matter if it fought. Whorls in the Midden get half.' },
      { p: 'When you win, each foe you knocked out or sounded gives XP. A level 10 wild whorl gives 24 XP. A level 10 whorl of a trainer gives 32 XP.' },
      { p: 'Each level needs more XP than the last. A level 5 whorl needs 72 XP to reach level 6.' },
      { h: 'Level caps' },
      { p: 'A whorl cannot grow past the level cap. Each pearl you win raises the cap. You win a pearl when you beat a keeper.' },
      { pic: 'caps' },
      { p: 'When your team reaches the cap, the battle tells you.' },
    ],
  },
  {
    id: 'fatigue', title: 'Fatigue', icon: 'fatigue', open: () => !!G.flags.fatigueMet,
    blocks: [
      { p: 'Very long battles make whorls tired. This is called fatigue.' },
      { p: `A round is one turn for each side. Fatigue starts after round ${FATIGUE_ROUND}.` },
      { p: `In round ${FATIGUE_ROUND + 1}, each out whorl loses 5% of its max HP. In round ${FATIGUE_ROUND + 2}, it loses 10%. It goes up by 5% each round.` },
      { pic: 'fatigue' },
      { p: 'Fatigue goes past DEF, RES, and Guard. The slower whorl gets hit first.' },
      { p: 'So no battle can go on forever. Try to win before fatigue starts.' },
    ],
  },
  {
    id: 'wear', title: 'Wearing', icon: 'wear', open: () => !!G.flags.wearing,
    blocks: [
      { p: 'You can wear your lead whorl. Press C to put it on. Press C again to take it off.' },
      { p: 'When you wear a whorl, its type lets you cross new ground.' },
      { icon: 'type:STONE', s: 'STONE lets you walk over crazes. A craze is a crack in the ground.' },
      { icon: 'type:TIDE', s: 'TIDE lets you walk on water and through shallows.' },
      { icon: 'type:ROOT', s: 'ROOT lets you go through thickets.' },
      { icon: 'type:GEAR', s: 'GEAR lets you pass dead machines. It also turns old cranes.' },
      { icon: 'type:BEAST', s: 'BEAST lets you climb ledges.' },
      { icon: 'type:STAR', s: 'STAR lights up dark places.' },
      { p: 'A whorl with two types lets you do both things.' },
    ],
  },
  {
    id: 'bag', title: 'The Bag', icon: 'bag', open: () => G.keys.length > 0 || Object.values(G.items).some(n => n > 0),
    blocks: [
      { p: 'The Bag holds what you carry. Press X for the menu and pick Bag.' },
      { p: 'The Bag has six pockets. Press left or right to change the pocket.' },
      { icon: 'pocket:0', s: 'Items has horns and things to use, like a Salt Line.' },
      { icon: 'pocket:1', s: 'Notions has notions for your whorls to hold.' },
      { icon: 'pocket:2', s: 'Key items has things for the story. You cannot sell or toss them.' },
      { icon: 'pocket:3', s: 'Finds has things to sell at a grotto.' },
      { icon: 'pocket:4', s: 'Lore has things you can read.' },
      { icon: 'pocket:5', s: 'Sketches has drawings for the Setting board.' },
      { p: 'Pick a thing and press Z. Then you can use, read, give, take, or toss it. It depends on the thing.' },
      { p: 'Press V to sort a pocket by name, or by kind.' },
      { h: 'Things to use' },
      { p: 'A Salt Line keeps wild whorls away for 150 steps. A Lure Shell brings out the rarest kind on that map. A Carter\'s Whistle calls the cart one time.' },
      { h: 'Key items' },
      { p: 'Key items open new places or help the story. The Register is a key item. It lists each kind you have seen and each kind you have sounded.' },
    ],
  },
  {
    id: 'cowries', title: 'Cowries', icon: 'cowries', open: () => Object.keys(G.flags).some(k => k.startsWith('visited_')),
    blocks: [
      { p: 'Cowries are shells that you spend like money.' },
      { h: 'Getting cowries' },
      { p: 'You get cowries when you beat a trainer. Each whorl of the trainer pays 12 cowries for each of its levels. Two level 10 whorls pay 240 cowries.' },
      { p: 'You can sell finds at a grotto. Pick Sell there. The Bag shows what each find sells for. The Strandmonger pays 25% more.' },
      { h: 'Spending cowries' },
      { p: 'You spend cowries on horns, notions, and things to use. Conjoining costs cowries. A ride on the cart costs 10.' },
      { h: 'Losing cowries' },
      { p: 'If your whole team is down, you drop 20% of your cowries. If you have 500, you drop 100.' },
    ],
  },
  {
    id: 'charms', title: 'Charms', icon: 'charms', open: () => !!G.flags.charms,
    blocks: [
      { p: 'You can wear a pearl as a charm. A charm helps your whole team in battle. You can wear one charm at a time.' },
      { p: 'Press X for the menu and pick Charm.' },
      { icon: 'pearl', s: 'Rib. Your lead takes 15% less damage until it switches out.', when: () => G.scales.includes('rib') },
      { icon: 'pearl', s: 'Mast. Your tide starts at 4, not 2.', when: () => G.scales.includes('mast') },
      { icon: 'pearl', s: 'Spire. Your wind-ups land 25% sooner.', when: () => G.scales.includes('spire') },
      { icon: 'pearl', s: 'Bole. Your conjoined whorls deal 8% more damage.', when: () => G.scales.includes('bole') },
      { icon: 'pearl', s: 'Pylon. A notion action works twice each battle. A notion that gets used up still works once.', when: () => G.scales.includes('pylon') },
      { icon: 'pearl', s: 'Tusk. Your whorl waits 20% less after a Switch.', when: () => G.scales.includes('tusk') },
      { icon: 'pearl', s: 'Hilt. When your whorl knocks out a foe, its cooldowns drop by 1.', when: () => G.scales.includes('hilt') },
      { icon: 'pearl', s: 'Fall. Your first turn comes 25% sooner.', when: () => G.scales.includes('fall') },
    ],
  },
  {
    id: 'starborn', title: 'Starborn', icon: 'starborn',
    open: () => Object.keys(G.flags).some(k => k.startsWith('sb:')) || all().some(m => m.starborn),
    blocks: [
      { p: 'A Starborn whorl is a rare whorl with the colors of the night sky. It glows, and it twinkles.' },
      { p: `About 1 in ${STARBORN_ODDS} new wild whorls is Starborn. A new conjoined whorl can be Starborn too, at the same odds.` },
      { p: 'A Starborn whorl is just as strong as others of its kind. Only its look is different.' },
      { p: 'A Starborn whorl does not pass on its look when you conjoin it.' },
      { p: 'Once you see a Starborn whorl, the Register marks its kind with a star.' },
    ],
  },
  {
    id: 'setting', title: 'Setting', icon: 'setting', open: () => G.gem.found.length > 0,
    blocks: [
      { p: 'Setting is a puzzle board for setting gems. Press X for the menu and pick Setting.' },
      { p: 'Each sketch you find is a new puzzle. You build a machine that makes the piece in the sketch.' },
      { p: 'You put arms and stations on the board. Each arm follows its tape. A tape is a list of steps. Every arm takes one step at the same time.' },
      { p: 'Grab picks up the stone at the claw. Turning swings the arm. A polisher shines a stone. A setter joins two stones. A splitter breaks them apart.' },
      { p: 'Pick Run to watch the machine go. Pick Step to go one step at a time. Pick Help to read the rules again.' },
      { p: 'A puzzle you solve keeps your best score. Try to use fewer cycles, less cost, or less room.' },
    ],
  },
  {
    id: 'practice', title: 'Practice', icon: 'practice', open: () => true,
    blocks: [
      { p: 'Practice is on the title screen. It is a place to try out teams. Nothing you do there is saved.' },
      { p: 'You make two teams of 3. Your team is on the left. The foe\'s team is on the right.' },
      { p: 'Pick a slot to change it. You can get a random whorl, find any kind by its name, or conjoin two kinds.' },
      { p: 'Practice battles have tide. Every whorl is level 25 unless you change it.' },
      { p: 'In a practice battle, press V to open the debug menu. It shows the stats of every whorl. It also shows the foe\'s last choice. You can change HP and tide there too.' },
      { p: 'When the battle ends, you go back to the teams. Press Start again to play the same battle.' },
    ],
  },
  {
    id: 'strand', title: 'The Strand', icon: 'strand', open: () => !!G.flags.a2,
    blocks: [
      { p: 'On the Strand, your whorls fight at their Strand level. It starts at 3. It only goes up on the Strand.' },
      { p: 'Star grains raise the cap on Strand levels.' },
      { pic: 'strandCaps' },
      { h: 'The tide' },
      { p: 'The sea comes in and goes out. Ring a tide bell to turn the tide.' },
      { p: 'At high tide, each side starts a battle with 3 tide. At low tide, each side starts with none. Then a star lands every 4th round. It adds 2 tide to each side.' },
      { h: 'Two more types' },
      { p: 'Two more types live on the Strand. They are SALT and VOID.' },
      { icon: 'type:SALT', s: 'SALT is strong against ROOT and BEAST. TIDE is strong against SALT.' },
      { icon: 'type:VOID', s: 'VOID is strong against STAR and SALT. STONE and GEAR are strong against VOID.' },
      { p: 'Wear a SALT whorl to walk through gray. Wear a VOID whorl to cross the blank.' },
      { p: 'You can leave a whorl in a shell on the Strand. A shell with a whorl in it stays.' },
    ],
  },
];

/** A chapter's words as plain sentences, every row included, for the readability check and the notes copy. */
export function chapterText(ch: Chapter): string[] {
  const out: string[] = [];
  for (const b of ch.blocks) {
    if ('p' in b) out.push(b.p);
    else if ('s' in b) out.push(b.s);
  }
  return out;
}
