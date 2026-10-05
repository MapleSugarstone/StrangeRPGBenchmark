import type { Elem, Fx, Skill, Status, Target } from './types';

const dmg = (s: 'atk' | 'mag', p: number, e?: Elem, hits?: number, pierce?: number): Fx => ({ k: 'dmg', s, p, e, hits, pierce });
const st = (status: Status, turns: number, chance = 1): Fx => ({ k: 'status', st: status, turns, chance });
const heal = (p: number): Fx => ({ k: 'heal', p });

export const SKILLS: Record<string, Skill> = {};
function S(id: string, name: string, mp: number, tgt: Target, fx: Fx[], desc: string, extra: Partial<Skill> = {}) {
  // Big spells cost more, so a pool of MP lasts about one boss fight and the cheap skills stay in use.
  SKILLS[id] = { id, name, mp: Math.round(mp * (mp >= 9 ? 1.7 : mp >= 5 ? 1.4 : 1)), tgt, fx, desc, ...extra };
}

// ---- Wick, Lamplighter
S('flare', 'Flare', 3, 'foe', [dmg('mag', 1.3, 'ember')], 'A spark from the lamp.');
S('windup', 'Wind Up', 3, 'ally', [st('haste', 3)], 'Winds an ally faster.');
S('glow', 'Glow', 5, 'allies', [st('regen', 3), { k: 'cleanse' }], 'Soft light mends the party.');
S('gutter', 'Gutterlight', 7, 'foes', [dmg('mag', 0.85, 'ember'), st('burn', 3, 0.5)], 'Smoky flames on all foes.');
S('sunset', 'Sunset', 12, 'foe', [dmg('mag', 2.6, 'lumen')], 'A long, heavy golden hour.');
S('lampfall', 'Lampfall', 20, 'foes', [dmg('mag', 1.6, 'lumen')], 'The lamp drops on everyone.');
S('noon', 'NOON', 0, 'foes', [dmg('mag', 3.1, 'lumen'), { k: 'status', st: 'regen', turns: 3, to: 'allies' }], 'Limit: all foes burn, allies rest.');

// ---- Pocket, Vendor
S('dispense', 'Dispense', 4, 'ally', [{ k: 'dispense' }], 'Drops a random helpful thing.');
S('pricehike', 'Price Hike', 4, 'foe', [st('hex', 3)], 'Everything costs more, including hits.');
S('exact', 'Exact Change', 5, 'foe', [dmg('atk', 2.4)], 'A coin thrown with precision.');
S('refill', 'Refill', 6, 'ally', [{ k: 'mpFlat', n: 14 }, { k: 'heal', p: 0.6 }], 'Tops up mana and a little health.');
S('clearance', 'Clearance', 10, 'foes', [dmg('atk', 1.3), st('weak', 3)], 'Everything must go.');
S('refund', 'Refund', 12, 'fallen', [{ k: 'revive', p: 0.4 }], 'Returns a fallen ally.');
S('goob', 'GOING OUT OF BUSINESS', 0, 'foes', [dmg('atk', 3.6), st('hex', 3)], 'Limit: everything must go, right now.');

// ---- Thistle, Mothwright
S('mend', 'Mend', 4, 'ally', [heal(1.4)], 'Wings brush wounds closed.');
S('lullaby', 'Lullaby', 5, 'foe', [st('sleep', 3, 0.85)], 'Sleep, small thing.');
S('wingdust', 'Wing Dust', 6, 'foes', [dmg('mag', 1.0, 'bloom'), st('weak', 2, 0.6)], 'Glittering pollen.');
S('cocoon', 'Cocoon', 8, 'ally', [st('ward', 3), st('regen', 3)], 'A quick silk shell.');
S('softrain', 'Soft Rain', 12, 'allies', [heal(1.1), { k: 'cleanse' }], 'Warm rain on the whole party.');
S('moonmoth', 'Moonmoth', 14, 'foe', [dmg('mag', 2.9, 'umbra'), st('sleep', 2, 0.4)], 'A pale dive from the dark.');
S('grace', 'MOTHLIGHT GRACE', 0, 'allies', [{ k: 'revive', p: 0.5 }, { k: 'healPct', p: 0.5 }, { k: 'cleanse' }], 'Limit: fallen rise, all are healed.');

// ---- Sir Ajar, Knight
S('slam', 'Door Slam', 3, 'foe', [dmg('atk', 1.7), st('stun', 1, 0.25)], 'Shoulder first.');
S('knock', 'Knock Knock', 3, 'self', [st('taunt', 3), st('ward', 3)], 'Draws every eye and raises the guard.');
S('swingwide', 'Swing Wide', 6, 'foes', [dmg('atk', 1.1)], 'Opens all the way.');
S('draft', 'Cold Draft', 7, 'foe', [dmg('atk', 1.2, 'frost'), st('chill', 3)], 'A chill from behind the door.');
S('hold', 'Hold the Door', 8, 'ally', [st('ward', 4), st('taunt', 1)], 'Nothing gets past.');
S('opensesame', 'Open Sesame', 14, 'foes', [dmg('atk', 2.3, 'umbra')], 'What is behind the door is worse.');
S('threshold', 'THRESHOLD', 0, 'foe', [dmg('atk', 4.6, 'lumen'), { k: 'status', st: 'ward', turns: 4, to: 'allies' }], 'Limit: one great swing through the frame.');

// ---- Ledger, Auditor
S('audit', 'Audit', 3, 'foe', [st('hex', 3), st('weak', 3, 0.5)], 'Finds every weak line item.');
S('interest', 'Compound Interest', 6, 'foe', [dmg('mag', 0.75, 'umbra', 2)], 'Hits twice and grows.');
S('writeoff', 'Write-Off', 8, 'foe', [dmg('mag', 1.8, 'umbra'), { k: 'delay', p: 0.3 }], 'Strikes it from the books.');
S('deduct', 'Deduction', 7, 'foes', [st('weak', 3), st('hex', 2)], 'Takes a percentage.');
S('bonus', 'Quarterly Bonus', 8, 'allies', [st('focus', 3)], 'Motivates the team.');
S('bankrupt', 'Bankruptcy', 16, 'foe', [dmg('mag', 3.0, 'umbra'), st('hex', 3), st('weak', 3)], 'Total, final, unpleasant.');
S('liquidate', 'LIQUIDATION', 0, 'foes', [dmg('mag', 3.3, 'umbra'), st('hex', 3)], 'Limit: everything is sold off.');

// ---- Route 9, Spectre Driver
S('express', 'Express', 4, 'foes', [dmg('atk', 0.8)], 'Does not stop for anyone.');
S('horn', 'Horn Blast', 5, 'foes', [dmg('atk', 0.55, 'volt'), st('stun', 1, 0.3)], 'An old, loud horn.');
S('brakecheck', 'Brake Check', 4, 'foe', [dmg('atk', 1.3), { k: 'delay', p: 0.4 }], 'Stop. Now.');
S('laststop', 'Last Stop', 10, 'foe', [dmg('atk', 2.5)], 'Everybody off.');
S('nightbus', 'Night Bus', 8, 'allies', [st('haste', 3)], 'Runs late and fast.');
S('transfer', 'Free Transfer', 6, 'ally', [{ k: 'quicken', p: 0.5 }], 'Board another turn, right now.');
S('finalroute', 'FINAL ROUTE', 0, 'foes', [dmg('atk', 2.4, 'volt'), st('stun', 1, 0.5)], 'Limit: the last run of the night.');

// ---- Zug, Gambit
S('fork', 'Fork', 4, 'foe', [dmg('mag', 1.2, 'umbra')], 'Two threats at once.');
S('pawnstorm', 'Pawn Storm', 5, 'foe', [dmg('mag', 0.8, 'frost', 2)], 'Small pieces, many steps.');
S('castle', 'Castle', 6, 'ally', [st('ward', 3), st('haste', 2)], 'King and rook trade places.');
S('enpassant', 'En Passant', 8, 'foe', [dmg('mag', 1.6, 'volt'), { k: 'quicken', p: 0.3 }], 'Takes it as it passes.');
S('gambit', 'Gambit', 9, 'foe', [dmg('mag', 2.0, 'ember'), { k: 'selfHp', p: 0.1 }], 'Gives up something to win more.');
S('checkmate', 'Checkmate', 16, 'foe', [dmg('mag', 3.1, 'lumen')], 'Nowhere to go.');
S('stalemate', 'STALEMATE', 0, 'foes', [dmg('mag', 2.0), st('stun', 2)], 'Limit: nobody can move.');

// ---- Kiln, Smith
S('hammer', 'Hammer Blow', 3, 'foe', [dmg('atk', 1.5, 'ember')], 'Red hot and heavy.');
S('quench', 'Quench', 6, 'ally', [heal(0.9), { k: 'cleanse' }, st('ward', 2)], 'Cools wounds and ills.');
S('slag', 'Slag Spray', 7, 'foes', [dmg('atk', 0.9, 'ember'), st('burn', 3)], 'Molten leftovers.');
S('anvil', 'Anvil Drop', 10, 'foe', [dmg('atk', 2.5), st('stun', 1, 0.5)], 'From a great height.');
S('temper', 'Temper', 6, 'ally', [st('focus', 3), st('ward', 2)], 'Hardens an ally for the next blow.');
S('foundry', 'Foundry Flood', 16, 'foes', [dmg('atk', 1.8, 'ember'), st('burn', 3)], 'The whole furnace, tipped out.');
S('starforge', 'STARFORGE', 0, 'foe', [dmg('atk', 4.8, 'ember'), st('burn', 4)], 'Limit: a falling star, reshaped.');

// ---- Ampere, Stormbound
S('zap', 'Zap', 3, 'foe', [dmg('mag', 1.3, 'volt')], 'Short, bright, rude.');
S('arc', 'Arc Chain', 6, 'foes', [dmg('mag', 0.8, 'volt'), st('shock', 2, 0.4)], 'Jumps from foe to foe.');
S('surge', 'Surge', 6, 'foe', [dmg('mag', 2.1, 'volt'), { k: 'selfHp', p: 0.12 }], 'Too much power, all at once.');
S('ground', 'Grounding', 5, 'ally', [{ k: 'nerve', n: 30 }, st('regen', 2)], 'Sends the fear into the floor.');
S('thunderhead', 'Thunderhead', 12, 'foes', [dmg('mag', 1.5, 'volt')], 'A storm cloud indoors.');
S('dawnstrike', 'Dawn Strike', 16, 'foe', [dmg('mag', 3.3, 'volt'), { k: 'selfHp', p: 0.2 }], 'The bolt that arrives with morning.');
S('tempest', 'TEMPEST', 0, 'foes', [dmg('mag', 3.2, 'volt'), st('shock', 3, 0.7)], 'Limit: the whole sky answers.');

// ---- Fennel, Pruner
S('snip', 'Snip', 2, 'foe', [dmg('atk', 1.25, 'bloom')], 'A clean cut.');
S('graft', 'Graft', 5, 'ally', [heal(0.8), st('regen', 3)], 'A healthy branch joined on.');
S('thornwall', 'Thornwall', 6, 'foes', [dmg('mag', 0.75, 'bloom'), st('weak', 3, 0.6)], 'Briars rise from nothing.');
S('prune', 'Prune', 8, 'foe', [dmg('atk', 1.9, 'umbra'), st('hex', 3)], 'Cuts back what is not needed.');
S('compost', 'Compost', 7, 'foe', [dmg('mag', 1.4, 'bloom'), { k: 'drain', p: 0.5 }], 'Turns the fallen into lunch.');
S('overgrow', 'Overgrow', 14, 'allies', [st('regen', 4), st('ward', 3)], 'The party grows back thicker.');
S('harvest', 'HARVEST', 0, 'foes', [dmg('atk', 2.6, 'bloom'), { k: 'drain', p: 0.4 }], 'Limit: reaps what was sown.');

// ---- Tick, Chronomancer
S('tock', 'Tock', 3, 'ally', [{ k: 'quicken', p: 0.4 }], 'Nudges an ally forward in time.');
S('stall', 'Stall', 4, 'foe', [{ k: 'delay', p: 0.6 }], 'A foe has to wait.');
S('minutehand', 'Minute Hand', 6, 'foe', [dmg('mag', 1.3), { k: 'delay', p: 0.3 }], 'A sweep of the small hand.');
S('overtime', 'Overtime', 9, 'allies', [st('haste', 3)], 'Extra hours for everyone.');
S('hourglass', 'Hourglass', 10, 'foes', [{ k: 'delay', p: 0.4 }, st('chill', 2)], 'Sand falls slowly on the foes.');
S('lastsecond', 'Last Second', 12, 'foe', [dmg('mag', 2.5, 'lumen')], 'Arrives at the exact moment.');
S('stopclock', 'STOP THE CLOCK', 0, 'foes', [{ k: 'delay', p: 1.0 }, dmg('mag', 1.8), st('stun', 1)], 'Limit: time takes a breath.');

// ---- Ash, Phoenix
S('cinder', 'Cinder', 3, 'foe', [dmg('mag', 1.8, 'ember')], 'A glowing crumb.');
S('warmth', 'Warmth', 5, 'ally', [heal(1.2), { k: 'cleanse' }], 'A gentle heat from the chest.');
S('ashfall', 'Ashfall', 8, 'foes', [dmg('mag', 1.25, 'ember'), st('weak', 3, 0.6)], 'Soft grey snow that stings.');
S('rekindle', 'Rekindle', 10, 'fallen', [{ k: 'revive', p: 0.6 }], 'Lights the ember again.');
S('plume', 'Plume Dive', 11, 'foe', [dmg('mag', 3.5, 'ember'), { k: 'drain', p: 0.5 }, { k: 'selfHp', p: 0.08 }], 'Falls, burns, rises.');
S('fledge', 'Fledge', 12, 'allies', [st('regen', 3), st('focus', 3)], 'Feathers for everyone.');
S('pyre', 'PYRE', 0, 'foes', [dmg('mag', 3.8, 'ember'), { k: 'healPct', p: 0.3, to: 'allies' }], 'Limit: the old fire burns friend and foe differently.');

// ---- Dusk
S('nightfall', 'Nightfall', 6, 'foes', [dmg('mag', 1.0, 'umbra'), st('sleep', 2, 0.35)], 'The lights go down.');
S('lastlight', 'Last Light', 5, 'ally', [heal(1.4), st('ward', 2)], 'The warmest part of the evening.');
S('cooldown', 'Cool Down', 6, 'foe', [st('chill', 3), { k: 'delay', p: 0.3 }], 'Everything slows, gently.');
S('eventide', 'Eventide', 12, 'foes', [dmg('mag', 1.7, 'umbra')], 'Long shadows, all at once.');
S('curtain', 'Curtain Call', 20, 'foe', [dmg('mag', 3.7, 'umbra')], 'The last bow.');
S('embers2', 'Afterglow', 9, 'allies', [heal(0.9), st('regen', 3)], 'Warmth that lingers.');
S('theend', 'THE END', 0, 'foe', [dmg('mag', 6.0, 'umbra'), { k: 'end' }], 'Limit: an ending, gracefully given.');

// ---- Enemy skills (shared library)
const E = (id: string, name: string, tgt: Target, fx: Fx[], extra: Partial<Skill> = {}) => S(id, name, 0, tgt, fx, '', extra);
E('e_hit', 'Strike', 'foe', [dmg('atk', 1.0)]);
E('e_heavy', 'Heavy Blow', 'foe', [dmg('atk', 1.6)]);
E('e_flurry', 'Flurry', 'foe', [dmg('atk', 0.55, undefined, 3)]);
E('e_bite', 'Bite', 'foe', [dmg('atk', 1.0), { k: 'drain', p: 0.4 }]);
E('e_sweep', 'Sweep', 'foes', [dmg('atk', 0.65)]);
E('e_fire', 'Fire Spit', 'foe', [dmg('mag', 1.1, 'ember'), st('burn', 3, 0.35)]);
E('e_ice', 'Frost Breath', 'foe', [dmg('mag', 1.1, 'frost'), st('chill', 3, 0.4)]);
E('e_bolt', 'Static Bolt', 'foe', [dmg('mag', 1.1, 'volt'), st('shock', 2, 0.3)]);
E('e_beam', 'Glare', 'foe', [dmg('mag', 1.2, 'lumen')]);
E('e_shade', 'Shade Touch', 'foe', [dmg('mag', 1.15, 'umbra'), st('weak', 3, 0.35)]);
E('e_thorn', 'Thorn Lash', 'foe', [dmg('mag', 1.1, 'bloom'), st('hex', 3, 0.35)]);
E('e_firestorm', 'Ember Storm', 'foes', [dmg('mag', 0.6, 'ember'), st('burn', 2, 0.3)]);
E('e_blizzard', 'Blizzard', 'foes', [dmg('mag', 0.6, 'frost'), st('chill', 2, 0.3)]);
E('e_thunder', 'Thunderclap', 'foes', [dmg('mag', 0.6, 'volt'), st('shock', 2, 0.25)]);
E('e_nova', 'Nova', 'foes', [dmg('mag', 0.65, 'lumen')]);
E('e_dusk', 'Dimming', 'foes', [dmg('mag', 0.6, 'umbra'), st('weak', 2, 0.3)]);
E('e_spores', 'Spores', 'foes', [dmg('mag', 0.55, 'bloom'), st('sleep', 2, 0.3)]);
E('e_lull', 'Lull', 'foe', [st('sleep', 2, 0.65)]);
E('e_jinx', 'Jinx', 'foe', [st('hex', 3, 0.85)]);
E('e_sap', 'Sap', 'foe', [st('weak', 3, 0.85)]);
E('e_mend', 'Mend Self', 'self', [heal(1.6)]);
E('e_mendall', 'Mend Friends', 'allies', [heal(0.9)]);
E('e_brace', 'Brace', 'self', [st('ward', 3)]);
E('e_rally', 'Rally', 'allies', [st('haste', 3)]);
E('e_crush', 'Crushing Blow', 'foe', [dmg('atk', 3.1)], { windup: 'gathers power!' });
E('e_megaflare', 'Megaflare', 'foes', [dmg('mag', 1.5, 'ember')], { windup: 'glows white hot!' });
E('e_maelstrom', 'Maelstrom', 'foes', [dmg('mag', 1.5, 'frost'), st('chill', 3, 0.6)], { windup: 'inhales the room!' });
E('e_discharge', 'Discharge', 'foes', [dmg('mag', 1.5, 'volt'), st('stun', 1, 0.4)], { windup: 'crackles loudly!' });
E('e_eclipse', 'Eclipse', 'foes', [dmg('mag', 1.5, 'umbra'), st('weak', 3, 0.6)], { windup: 'dims the light!' });
E('e_bloomfall', 'Bloomfall', 'foes', [dmg('mag', 1.5, 'bloom'), st('sleep', 2, 0.4)], { windup: 'unfurls slowly!' });
E('e_radiance', 'Radiance', 'foes', [dmg('mag', 1.5, 'lumen')], { windup: 'brightens unbearably!' });
E('e_drain', 'Soul Sip', 'foe', [dmg('mag', 1.2, 'umbra'), { k: 'drain', p: 0.8 }]);
E('e_stun', 'Slam Shut', 'foe', [dmg('atk', 0.9), st('stun', 1, 0.6)]);
E('e_delay', 'Overdue Notice', 'foe', [dmg('mag', 0.7), { k: 'delay', p: 0.5 }]);

export const skill = (id: string): Skill => {
  const s = SKILLS[id];
  if (!s) throw new Error('unknown skill ' + id);
  return s;
};
