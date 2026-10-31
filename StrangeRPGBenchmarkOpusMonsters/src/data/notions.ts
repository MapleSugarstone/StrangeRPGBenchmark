import { addNerve, applyStatus, cameOutSince, cleanse, dealDamage, foeOf, giveShield, has, hastenFighter, heal, label, msg, stat } from '../battle/engine';
import { defNotion } from '../battle/registry';

defNotion({ id: 'whetstone', name: 'Whetstone', price: 300, text: '+11% ATK.', pct: { atk: 0.11 } });
defNotion({ id: 'bitterroot', name: 'Bitter Root', price: 300, text: '+11% MGK.', pct: { mgk: 0.11 } });
defNotion({ id: 'hideplate', name: 'Shell Plate', price: 300, text: '+19% DEF.', pct: { def: 0.19 } });
defNotion({ id: 'waxcoat', name: 'Wax Coat', price: 300, text: '+22% RES.', pct: { res: 0.22 } });
defNotion({ id: 'longshin', name: 'Long Shin', price: 400, text: '+9% AGI.', pct: { agi: 0.09 } });
defNotion({ id: 'ribbon', name: 'Ribbon', price: 300, text: '+45% CHA.', pct: { cha: 0.45 } });
defNotion({ id: 'heartstone', name: 'Heart Stone', price: 400, text: '+10% HP.', pct: { hp: 0.1 } });
defNotion({ id: 'bloodglass', name: 'Bloodglass', price: 600, text: 'Heals 14% of the damage it deals.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve) heal(b, f, f, dealt * 0.14); } });
defNotion({ id: 'thornvest', name: 'Thorn Vest', price: 500, text: '+14% DEF. Returns 30% of attack damage taken.', pct: { def: 0.14 },
  afterTake(b, f, src, dealt, d) { if (src && d.attack && !src.ko) dealDamage(b, f, src, dealt * 0.3, { kind: 'M', move: null, attack: false, dot: true, spread: false, reserve: false }, null); } });
defNotion({ id: 'waxseal', name: 'Wax Seal', price: 500, text: 'The first time it comes out: a shield of 15% of its max HP, 3 turns.',
  comeOut(b, f) { if (!f.k.sealed) { f.k.sealed = 1; giveShield(b, f, f, f.maxHp * 0.15, 3); } } });
defNotion({ id: 'chrysalis', name: 'Chrysalis', price: 700, text: 'Action, once: Stasis 1. When the Stasis ends: heals 30% of its max HP.',
  action: { name: 'Chrysalis', run(b, f) { applyStatus(b, f, f, 'stasis', 1); f.k.thaw = 1; f.k.thawPct = Math.min(100, Math.round(f.hp / f.maxHp * 100) + 30); } } });
defNotion({ id: 'toothnecklace', name: 'Tooth Necklace', price: 600, text: 'Its attacks add 12% of the foe\'s current HP to their damage.',
  addRaw(b, f, t, d) { return d.attack ? t.hp * 0.12 : 0; } });
defNotion({ id: 'cleaver', name: 'Cleaver', price: 500, text: 'Each hit takes 5 DEF and 5 RES from the target, up to 25 each.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve) { t.k.shred = Math.min(25, (t.k.shred || 0) + 5); t.k.rshred = Math.min(25, (t.k.rshred || 0) + 5); } } });
defNotion({ id: 'edgecharm', name: 'Edge Charm', price: 600, text: 'When it uses a move: its next attack adds 85% ATK.',
  afterMove(b, f) { f.k.edge = 1; },
  addRaw(b, f, t, d) { return d.attack && f.k.edge ? stat(b, f, 'atk') * 0.85 : 0; } });
defNotion({ id: 'salttear', name: 'Salt Tear', price: 500, text: '+2 tide the first time it uses a move in a battle.',
  afterMove(b, f) { if (!f.k.tear) { f.k.tear = 1; addNerve(b, f.side, 2); } } });
defNotion({ id: 'spareskin', name: 'Spare Shell', price: 900, text: 'Once, when KO\'d, comes back at 20% HP.',
  wouldKO(b, f) { if (f.k.spare) return false; f.k.spare = 1; f.hp = Math.max(1, Math.round(f.maxHp * 0.2)); msg(b, `${label(b, f)} emerges from a spare shell.`); return true; } });
defNotion({ id: 'crownofhorn', name: 'Crown of Horn', price: 800, text: 'Crests deal 1.4x damage.',
  outMul(b, f, t, d) { return d.move?.nerve ? 1.4 : 1; } });
defNotion({ id: 'bodkin', name: 'Bodkin', price: 700, text: 'Ignores 35% of the target\'s DEF and RES.' });
defNotion({ id: 'coldiron', name: 'Cold Iron', price: 500, text: 'Every 2nd damaging hit it lands adds Slow 1.',
  afterDeal(b, f, t, dealt, d) { if (d.reserve || t.ko) return; f.k.chill = (f.k.chill || 0) + 1; if (f.k.chill % 2 === 0) applyStatus(b, f, t, 'slow', 1); } });
defNotion({ id: 'embercoat', name: 'Ember Coat', price: 500, text: 'Turn start: hits the foe for 6% MGK.',
  turnStart(b, f) { const t = foeOf(b, f); if (!t.ko && !t.gone) dealDamage(b, f, t, stat(b, f, 'mgk') * 0.06, { kind: 'M', move: null, attack: false, dot: true, spread: false, reserve: false }, null); } });
defNotion({ id: 'quickstone', name: 'Quickstone', price: 600, text: 'Action, once: removes bad statuses. Its next turn comes 100% sooner.',
  action: { name: 'Quickstone', run(b, f) { cleanse(b, f); f.k.hastenAfter = (f.k.hastenAfter || 0) + 100; } } });
defNotion({ id: 'rotknife', name: 'Rot Knife', price: 500, text: 'Its damaging hits add Rot 3.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !t.ko) applyStatus(b, f, t, 'rot', 3); } });
defNotion({ id: 'warmstone', name: 'Warm Stone', price: 600, text: 'Turn start: heals 3% of its max HP.',
  turnStart(b, f) { heal(b, f, f, f.maxHp * 0.03); } });
defNotion({ id: 'lodestone', name: 'Lodestone', price: 500, text: 'Deals 1.25x damage to a foe that came out since its last turn.',
  outMul(b, f, t) { return cameOutSince(b, t, f) ? 1.25 : 1; } });

// The ring round the Lipwater: one notion from each region, each playing to its Staykeeper's lesson.
defNotion({ id: 'floatcork', name: 'Float Cork', price: 500, text: '+10% RES. Each time it comes out, its first turn comes 20% sooner.', pct: { res: 0.1 },
  comeOut(b, f) { hastenFighter(b, f, 20); } });
defNotion({ id: 'tidemark', name: 'Tide Mark', price: 600, text: '+2 tide each time it guards, up to 3 times a battle.',
  afterGuard(b, f) { if ((f.k.tideMarks || 0) < 3) { f.k.tideMarks = (f.k.tideMarks || 0) + 1; addNerve(b, f.side, 2); } } });
defNotion({ id: 'reedplug', name: 'Reed Plug', price: 500, text: '+12% RES. The first wind-up aimed at it each battle lands 50% later.', pct: { res: 0.12 } });
defNotion({ id: 'graftwax', name: 'Graft Wax', price: 600, text: 'On a conjoined whorl, +9% ATK and +9% MGK. On any other, nothing.',
  statBonus(f, k) { return f.mon.fitted && (k === 'atk' || k === 'mgk') ? f.st[k] * 0.09 : 0; } });
defNotion({ id: 'ridercog', name: 'Rider Cog', price: 600, text: '+4% HP, ATK, MGK, DEF, and RES.', pct: { hp: 0.04, atk: 0.04, mgk: 0.04, def: 0.04, res: 0.04 } });
defNotion({ id: 'riderspoon', name: 'Rider Spoon', price: 500, text: '+15% DEF. When it is forced out or dragged in, it gets Ward 1.', pct: { def: 0.15 } });
defNotion({ id: 'bladeshard', name: 'Blade Shard', price: 600, text: 'Its hits deal 1.3x damage to a foe below 40% HP.',
  outMul(b, f, t) { return t.hp < t.maxHp * 0.4 ? 1.3 : 1; } });
defNotion({ id: 'glassbead', name: 'Glass Bead', price: 600, text: '+9% MGK. The first status it puts on a foe each battle lasts 1 turn longer.', pct: { mgk: 0.09 } });

// Spent notions: the action works once and the notion is gone after the battle.
defNotion({ id: 'seabiscuit', name: 'Sea Biscuit', price: 200, spent: true, text: 'Action, once: heals 35% of max HP. Used up.',
  action: { name: 'Sea Biscuit', run(b, f) { heal(b, f, f, f.maxHp * 0.35); } } });
defNotion({ id: 'smellingsalt', name: 'Smelling Salt', price: 120, spent: true, text: 'Action, once: removes bad statuses and heals 10% of max HP. Used up.',
  action: { name: 'Smelling Salt', run(b, f) { cleanse(b, f); heal(b, f, f, f.maxHp * 0.1); } } });
defNotion({ id: 'tidejar', name: 'Tide Jar', price: 250, spent: true, text: 'Action, once: its side gains 3 tide. Used up.',
  action: { name: 'Tide Jar', run(b, f) { addNerve(b, f.side, 3); } } });
defNotion({ id: 'cuttlebone', name: 'Cuttlebone', price: 150, spent: true, text: 'Action, once: Ward 2. Used up.',
  action: { name: 'Cuttlebone', run(b, f) { applyStatus(b, f, f, 'ward', 2); } } });
defNotion({ id: 'pepperkelp', name: 'Pepper Kelp', price: 150, spent: true, text: 'Action, once: its next turn comes 80% sooner. Used up.',
  action: { name: 'Pepper Kelp', run(b, f) { f.k.hastenAfter = (f.k.hastenAfter || 0) + 80; } } });

export const NOTION_IDS = ['whetstone', 'bitterroot', 'hideplate', 'waxcoat', 'longshin', 'ribbon', 'heartstone', 'bloodglass', 'thornvest', 'waxseal', 'chrysalis', 'toothnecklace', 'cleaver', 'edgecharm', 'salttear', 'spareskin', 'crownofhorn', 'bodkin', 'coldiron', 'embercoat', 'quickstone', 'rotknife', 'warmstone', 'lodestone',
  'seapebble', 'sieve', 'glazecoat', 'saltboots', 'climbingchalk', 'tallystone', 'siphoncup', 'siphonhood', 'polishedring',
  'floatcork', 'tidemark', 'reedplug', 'graftwax', 'ridercog', 'riderspoon', 'bladeshard', 'glassbead',
  'seabiscuit', 'smellingsalt', 'tidejar', 'cuttlebone', 'pepperkelp'];
void giveShield; void has; void hastenFighter;
