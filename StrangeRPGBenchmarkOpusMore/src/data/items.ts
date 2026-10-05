import type { ItemDef } from '../battle/types';

const use: ItemDef[] = [
  { id: 'soup', name: 'Hot Soup', desc: 'Heals 45 HP. Tastes like someone cared.', price: 8, kind: 'use', battle: true, field: true, tgt: 'ally', heal: 45 },
  { id: 'stew', name: 'Thick Stew', desc: 'Heals 130 HP.', price: 30, kind: 'use', battle: true, field: true, tgt: 'ally', heal: 130 },
  { id: 'feast', name: 'Banquet Pot', desc: 'Heals 400 HP.', price: 95, kind: 'use', battle: true, field: true, tgt: 'ally', heal: 400 },
  { id: 'picnic', name: 'Picnic Blanket', desc: 'Heals the party for 40 percent.', price: 70, kind: 'use', battle: true, field: true, tgt: 'allies', healPct: 0.4 },
  { id: 'lozenge', name: 'Throat Lozenge', desc: 'Restores 14 voice.', price: 14, kind: 'use', battle: true, field: true, tgt: 'ally', vp: 14 },
  { id: 'honey', name: 'Honey Drops', desc: 'Restores 40 voice.', price: 48, kind: 'use', battle: true, field: true, tgt: 'ally', vp: 40 },
  { id: 'card', name: 'Get-Well Card', desc: 'Revives a fallen ally at 30 percent.', price: 40, kind: 'use', battle: true, field: true, tgt: 'dead', revive: 0.3 },
  { id: 'bouquet', name: 'Get-Well Bouquet', desc: 'Revives a fallen ally at 80 percent.', price: 160, kind: 'use', battle: true, field: true, tgt: 'dead', revive: 0.8 },
  { id: 'tonic', name: 'Wake-Up Call', desc: 'Clears sleep, static, mute, and other bad statuses.', price: 12, kind: 'use', battle: true, field: true, tgt: 'ally', cure: true },
  { id: 'firecracker', name: 'Firecracker', desc: 'Deals 35 loud damage to every foe.', price: 22, kind: 'use', battle: true, tgt: 'foes', dmg: 35, elem: 'loud' },
  { id: 'icewater', name: 'Ice Water', desc: 'Deals 90 chill damage to one foe.', price: 30, kind: 'use', battle: true, tgt: 'foe', dmg: 90, elem: 'chill' },
  { id: 'battery', name: 'Old Battery', desc: 'Deals 160 spark damage to one foe.', price: 60, kind: 'use', battle: true, tgt: 'foe', dmg: 160, elem: 'spark' },
  { id: 'pinwheel', name: 'Pinwheel', desc: 'Makes one ally quick for 3 turns.', price: 25, kind: 'use', battle: true, tgt: 'ally', status: { id: 'haste', turns: 3 } },
  { id: 'postcard', name: 'Postcard', desc: 'A friend wrote. Fires up one ally for 3 turns.', price: 0, kind: 'use', battle: true, tgt: 'ally', status: { id: 'powup', turns: 3 } },
];

const keys: ItemDef[] = [
  { id: 'net', name: 'Mended Net', desc: 'Someday mended it. Gale is waiting for it at the Shallows.', price: 0, kind: 'key' },
  { id: 'notice', name: 'Notice', desc: 'THE ASKING IS SUSPENDED. ALL ANSWERS WILL BE RETURNED TO SENDER. THANK YOU FOR YOUR PATIENCE.', price: 0, kind: 'key' },
  { id: 'rtshook', name: 'Collector Hook', desc: 'A long hook stamped RETURN TO SENDER. Someone dropped it in the Old Shaft.', price: 0, kind: 'key' },
  { id: 'ticket', name: 'Ticket 8000412', desc: 'Your number. NOW SERVING: 3.', price: 0, kind: 'key' },
  { id: 'ball', name: 'Red Ball', desc: 'Chewed. Very important to someone very big.', price: 0, kind: 'key' },
  { id: 'badge', name: 'Lineman Badge', desc: "Someday's. Number 0411.", price: 0, kind: 'key' },
  { id: 'manifest', name: 'Manifest Page', desc: 'FEN. DELIVERY FAILED. FORWARDED: THE CATCH.', price: 0, kind: 'key' },
  { id: 'spring', name: 'Day Spring', desc: 'The mainspring of a day. Warm.', price: 0, kind: 'key' },
  { id: 'towerkey', name: 'Festival Key', desc: 'Shaped like a little sun with a ribbon on it. Opens the clock tower.', price: 0, kind: 'key' },
  { id: 'loss', name: 'Loss', desc: 'A token for something lost. In Jackpot, the only money worth anything.', price: 0, kind: 'key' },
  { id: 'linepass', name: 'Line Pass', desc: 'Lets the bearer approach the Line.', price: 0, kind: 'key' },
  { id: 'receiver', name: 'Line Receiver', desc: 'Someday clipped it to your belt. Lets Hello call kept prayers in battle.', price: 0, kind: 'key' },
  { id: 'lastslip', name: "Someday's Slip", desc: "Got here. Little one's long grown and gone. Nice view. Don't wait up.", price: 0, kind: 'key' },
  { id: 'wishslip', name: 'Your Slip', desc: 'The words are still coming in.', price: 0, kind: 'key' },
  { id: 'ledgerpage', name: 'Ledger Pages', desc: "Torn from a Lineman's ledger. Names, and notes in the margin, in Someday's hand.", price: 0, kind: 'key' },
  { id: 'dogtag', name: 'Dog Tag', desc: 'GOOD BOY. IF FOUND, HE WAS GOOD AT THE VET.', price: 0, kind: 'key' },
  { id: 'strip', name: 'Torn Strip', desc: '"...vase. It was me, not the cat. I love you. Please write back."', price: 0, kind: 'key' },
  { id: 'word', name: 'Unsaid Words', desc: 'Scraps of paper. Each one is a word somebody never said out loud.', price: 0, kind: 'key' },
  { id: 'balloon', name: 'Red Balloon', desc: 'Snagged in the Catch. Still holding its air, after everything.', price: 0, kind: 'key' },
  { id: 'nameplate', name: 'Crew Nameplates', desc: 'Small metal plates from the Patient Ark, each with a name in a script nobody here can read.', price: 0, kind: 'key' },
];

function weapons(who: string, names: string[], wit = 0): ItemDef[] {
  const atk = [3, 6, 10, 15, 21, 28];
  const price = [0, 90, 220, 480, 900, 1600];
  return names.map((n, i) => ({
    id: `${who}_w${i + 1}`, name: n, desc: `+${atk[i]} power${wit ? `, +${Math.round(atk[i] * wit)} wit` : ''}.`, price: price[i], kind: 'weapon' as const, who, atk: atk[i],
    mods: wit ? { wit: Math.round(atk[i] * wit) } : undefined,
  }));
}

const gear: ItemDef[] = [
  ...weapons('hello', ['Tin-Can Phone', 'Rotary Handset', 'Brass Receiver', 'Cordless', 'Red Hotline', 'Golden Receiver'], 0.6),
  ...weapons('someday', ['Dredge Hook', 'Gaff', 'Grapnel', 'Anchor Hook', "Lineman's Hook", 'Deep Hook']),
  ...weapons('bigger', ['Rope Collar', 'Studded Collar', 'Name Tag', 'Spiked Collar', 'Best in Show', 'Biggest Boy Crown']),
  ...weapons('anyone', ['Headset', 'Coiled Cord', 'Copper Line', 'Fiber Line', 'Switch Key', 'Golden Line'], 0.8),
  ...weapons('again', ['Jump Rope', 'Spinning Top', 'Yo-yo', 'Music Box', 'Kaleidoscope', 'Hourglass'], 0.8),
  ...weapons('someone', ['Deck of Cards', 'Marked Deck', 'Loaded Dice', 'Hand Mirror', 'Masquerade', 'Last Card'], 0.5),
  ...weapons('both', ['Two Sticks', 'Twin Swords', 'Racing Blades', 'Tiebreaker', 'Finish Line', 'Gold Medals']),
  ...weapons('lifeboat', ['Grapple', 'Winch', 'Tow Line', 'Flare Gun', 'Rescue Arm', 'Rescue Beacon'], 0.5),
  { id: 'coat1', name: 'Patched Coat', desc: '+2 guard.', price: 0, kind: 'coat', mods: { grd: 2 } },
  { id: 'coat2', name: 'Waiting Room Cardigan', desc: '+4 guard, +12 HP.', price: 70, kind: 'coat', mods: { grd: 4, hp: 12 } },
  { id: 'coat3', name: 'Docket Vestment', desc: '+7 guard, +24 HP.', price: 180, kind: 'coat', mods: { grd: 7, hp: 24 } },
  { id: 'coat4', name: 'Festival Jacket', desc: '+10 guard, +36 HP.', price: 360, kind: 'coat', mods: { grd: 10, hp: 36 } },
  { id: 'coat5', name: 'Jackpot Tuxedo', desc: '+13 guard, +50 HP.', price: 640, kind: 'coat', mods: { grd: 13, hp: 50 } },
  { id: 'coat6', name: 'Hush Cloak', desc: '+16 guard, +65 HP.', price: 900, kind: 'coat', mods: { grd: 16, hp: 65 } },
  { id: 'coat7', name: "Lineman's Coat", desc: '+20 guard, +85 HP.', price: 1250, kind: 'coat', mods: { grd: 20, hp: 85 } },
  { id: 'coat8', name: 'Seafoam Mac', desc: '+24 guard, +105 HP.', price: 1700, kind: 'coat', mods: { grd: 24, hp: 105 } },
  { id: 'earmuffs', name: 'Earmuffs', desc: 'Resists loud.', price: 60, kind: 'charm', resist: 'loud' },
  { id: 'boots', name: 'Rubber Boots', desc: 'Resists spark.', price: 60, kind: 'charm', resist: 'spark' },
  { id: 'scarf', name: 'Wool Scarf', desc: 'Resists chill.', price: 60, kind: 'charm', resist: 'chill' },
  { id: 'thimble', name: 'Thimble', desc: 'Resists edge.', price: 90, kind: 'charm', resist: 'edge' },
  { id: 'padding', name: 'Padding', desc: 'Resists blunt.', price: 90, kind: 'charm', resist: 'blunt' },
  { id: 'quietstone', name: 'Quiet Stone', desc: 'Resists hush.', price: 120, kind: 'charm', resist: 'hush' },
  { id: 'luckypleat', name: 'Lucky Pleat', desc: '+3 speed.', price: 150, kind: 'charm', mods: { spd: 3 } },
  { id: 'whistle', name: 'Tin Whistle', desc: '+4 power.', price: 120, kind: 'charm', mods: { pow: 4 } },
  { id: 'notebook', name: 'Notebook', desc: '+4 wit.', price: 120, kind: 'charm', mods: { wit: 4 } },
  { id: 'goldtooth', name: 'Gold Tooth', desc: '+6 power, +6 wit. Somebody lost it in a bet.', price: 0, kind: 'charm', mods: { pow: 6, wit: 6 } },
  { id: 'unluckypenny', name: 'Unlucky Penny', desc: '+5 speed. Resists hush.', price: 0, kind: 'charm', mods: { spd: 5 }, resist: 'hush' },
  { id: 'brokenmirror', name: 'Broken Mirror', desc: '+6 guard, +40 HP.', price: 0, kind: 'charm', mods: { grd: 6, hp: 40 } },
  { id: 'fourleaf', name: 'Three-Leaf Clover', desc: '+15 voice, +4 wit. Almost lucky.', price: 0, kind: 'charm', mods: { vp: 15, wit: 4 } },
  { id: 'thermos', name: 'Thermos', desc: '+10 voice.', price: 140, kind: 'charm', mods: { vp: 10 } },
  // Side call rewards. None of these are sold.
  { id: 'sortthimble', name: "Sorter's Thimble", desc: '+3 wit, +2 speed. Worn smooth by a thousand mornings.', price: 0, kind: 'charm', mods: { wit: 3, spd: 2 } },
  { id: 'quickshoes', name: 'Race Shoes', desc: '+5 speed. Somebody asked to win a race. These were in it.', price: 0, kind: 'charm', mods: { spd: 5 } },
  { id: 'goodtag', name: 'Good Boy Collar', desc: '+5 guard, +25 HP. Very good.', price: 0, kind: 'charm', mods: { grd: 5, hp: 25 } },
  { id: 'always', name: 'Always', desc: '+40 HP, +10 voice. A ring nobody claimed for four hundred years.', price: 0, kind: 'charm', mods: { hp: 40, vp: 10 } },
  { id: 'longscarf', name: 'Third-Mile Scarf', desc: '+11 guard, +40 HP. Resists chill. It goes on for a while.', price: 0, kind: 'coat', mods: { grd: 11, hp: 40 }, resist: 'chill' },
  { id: 'ramchip', name: 'Spare Memory', desc: '+16 voice. It does not remember what it was for.', price: 0, kind: 'charm', mods: { vp: 16 } },
  { id: 'paperbird', name: 'Paper Bird', desc: '+4 speed, +4 wit. Folded from a letter that got read.', price: 0, kind: 'charm', mods: { spd: 4, wit: 4 } },
  { id: 'saintset', name: "Saint's Headset", desc: '+20 voice, +3 wit.', price: 0, kind: 'charm', mods: { vp: 20, wit: 3 } },
  { id: 'quill', name: "Poet's Quill", desc: '+7 wit, +10 voice. The third line was the hard one.', price: 0, kind: 'charm', mods: { wit: 7, vp: 10 } },
  { id: 'tuningfork', name: 'Tuning Fork', desc: '+5 wit, +4 speed. Rings the same note twice.', price: 0, kind: 'charm', mods: { wit: 5, spd: 4 } },
  { id: 'losingcoin', name: 'Losing Coin', desc: '+9 power. It came up tails, once, for somebody.', price: 0, kind: 'charm', mods: { pow: 9 } },
  { id: 'goldstar', name: 'Gold Star', desc: '+8 wit, +12 voice. S-T-A-R.', price: 0, kind: 'charm', mods: { wit: 8, vp: 12 } },
  { id: 'spokenword', name: 'Spoken Word', desc: '+7 wit. Resists hush. Somebody finally said it.', price: 0, kind: 'charm', mods: { wit: 7 }, resist: 'hush' },
  { id: 'string', name: 'Balloon String', desc: '+5 speed, +30 HP. It was holding something up.', price: 0, kind: 'charm', mods: { spd: 5, hp: 30 } },
  { id: 'hummingshell', name: 'Humming Shell', desc: '+18 voice. Resists chill. It hums the sea back at you.', price: 0, kind: 'charm', mods: { vp: 18 }, resist: 'chill' },
  { id: 'leftboot', name: 'Left Boot', desc: '+2 guard. Somebody prayed to find the other one.', price: 0, kind: 'charm', mods: { grd: 2 } },
  { id: 'crewplate', name: 'Crew Plate', desc: '+12 guard, +50 HP. Four names, read out loud at last.', price: 0, kind: 'charm', mods: { grd: 12, hp: 50 } },
  { id: 'ledgerband', name: "Lineman's Armband", desc: '+8 power, +8 wit, +8 guard, +60 HP. Four hundred and twelve names, remembered.', price: 0, kind: 'charm', mods: { pow: 8, wit: 8, grd: 8, hp: 60 } },
  // The expensive tier, for players who would rather grind than fight smart.
  { id: 'coat9', name: 'Overstock Greatcoat', desc: '+30 guard, +140 HP. Nobody ever needed this many pockets.', price: 3400, kind: 'coat', mods: { grd: 30, hp: 140 } },
  { id: 'goldear', name: 'Golden Ear', desc: '+10 power, +10 wit, +10 speed.', price: 2600, kind: 'charm', mods: { pow: 10, wit: 10, spd: 10 } },
  { id: 'bellcharm', name: 'Brass Bell', desc: '+30 voice, +6 wit.', price: 1500, kind: 'charm', mods: { vp: 30, wit: 6 } },
  { id: 'anchor', name: 'Small Anchor', desc: '+14 guard, +80 HP.', price: 1800, kind: 'charm', mods: { grd: 14, hp: 80 } },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries([...use, ...keys, ...gear].map((i) => [i.id, i]));
