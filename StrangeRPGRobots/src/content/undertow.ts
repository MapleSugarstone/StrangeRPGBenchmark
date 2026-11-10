// Undertow data: items, quests, hacking puzzles, details and lore on the new maps, travel, world events, banter,
// and camp scenes. Scenes are in src/script/undertow*.txt. Notes: Notes/undertow-notes.md.
import { addItems } from '../rules/data';
import { addQuests } from './quests';
import { addSplice, addSurf, addBail } from './undertow_puzzles';
import { addDetails, addLore, type Detail } from './details';
import { addTravel, addEvents } from './replay';
import { addBanter } from './banter';
import { addCamp } from './camp';

addItems([
  { id: 'deskcard', name: 'Desk Card', kind: 'key', price: 0, desc: 'QUIET DESK. BOARD NET SECURITY. A. TERWAL, DIVER 0017. Call any Board phone and say "Desk."' },
  { id: 'crossingkey', name: 'Crossing Key', kind: 'key', price: 0, desc: 'A white key on a red lanyard. It lets a crew touch the Pale and come back with their chrome.' },
  { id: 'maasfile', name: 'Desk File: Asset Terwal', kind: 'key', price: 0, desc: 'Forty pages. PALE INTEGRITY TRACKS THE ASSET\'S AFFECT. KEEP THE ASSET QUIET. Signed W. Maas.' },
  { id: 'mamvoice', name: 'Voice Note', kind: 'key', price: 0, desc: 'Kept in your port. "Marit, love. Keep the plaster on that hand. Don\'t pick at it."' },
  { id: 'signport', name: 'Truus\'s Port', kind: 'key', price: 0, desc: 'A drowned port riding in yours. It hums a bakery jingle from forty years ago.' },
]);

// ---------------------------------------------------------------- Quests

addQuests([
  {
    id: 'undertow',
    title: 'Undertow',
    kind: 'main',
    xp: 1500,
    stages: {
      '1': 'A man on the lower terrace of the Lantern Steps cannot let go of the railing. His chrome hand is breathing.',
      '2': 'Anouk Terwal of the Quiet Desk wants help closing leaks in the net that follow your port. The first is Brandt\'s karaoke stall, east on the middle terrace of the Steps.',
      '3': 'Two more leaks: sleepwalkers on the terraces, and the Census office queue on the plaza. Anouk waits at each one.',
      '4': 'One leak left. Anouk waits there.',
      '5': 'Something past the Pale spoke in Jory Pike\'s words. Anouk said she would come to your camp tonight. Rest.',
      '6': 'Anouk Terwal bleeds gray, and the Desk samples her blood every Thursday. Talk to her at camp.',
      '7': 'A port past the Pale calls Anouk by her sister\'s pet name. To cross, the crew needs a crossing key and the crossing log wiped, both at the Quiet Desk\'s tower on Terrace 3.',
      '8': 'Maas\'s file says the Pale holds only while Anouk feels nothing. Dive to the Pale from a Desk chair: the one in the Desk\'s sample room, or the one in Anouk\'s flat.',
      '9': 'Past the Pale, Pike pointed at the drowned telephone exchange on the Flats. The Desk skiff on the Steps channel goes out there, and so does the Wader camp. Dirkje knows the way.',
      '10': 'Power the drowned exchange\'s switchboard and jack in from its chair to go past the Pale.',
      '11': 'The drowned gather in the Ferry Hall, north of the message hall.',
      '12': 'Mam waits in the Ferry Hall. A small port calls Anouk from the west side of the hall.',
      '13': 'Mies\'s port is settled. Surface from the pad in the message hall.',
      '14': 'The Pale\'s heart is in the Cold Room under the Crown. A lift goes down from the Crown\'s lobby.',
      '15': 'Dive into the Pale\'s heart from Anouk\'s chair in the Cold Room.',
      done: 'The Pale\'s heart is decided.',
    },
    where: {
      '1': ['steps', 'hero_ottens'],
      '2': ['steps', 'brandt_front'],
      '3': ['terraces', 'sleep_front'],
      '4': ['census', 'queue_front'],
      '5': ['crypt', 'camp_hero'],
      '6': ['crypt', 'camp_anouk'],
      '7': ['terraces', 'desk_out'],
      '8': ['quietdesk', 'chair_front'],
      '9': ['steps', 'skiff_front'],
      '10': ['exchange', 'chair_front'],
      '11': ['net_exchange', 'hall_out'],
      '12': ['net_ferryhall', 'small_front'],
      '13': ['net_exchange', 'ex_in'],
      '14': ['crown', 'lift_down_out'],
      '15': ['coldroom', 'chair_front'],
    },
  },
  {
    id: 'anouk_mies',
    title: 'Noekie',
    kind: 'companion',
    xp: 500,
    stages: {
      '1': 'A port past the Pale says the name only Anouk\'s sister used. She has answered it every Thursday for a year. Cross the Pale and find it.',
      '3': 'The small port went into a node on the west side of the Ferry Hall. It wants to show Anouk the night in its cache.',
      done: 'Anouk said her sister\'s name.',
    },
    where: { '1': ['terraces', 'desk_out'], '3': ['net_ferryhall', 'wet_front'] },
  },
  {
    id: 'ut_sign', title: 'The Singing Sign', kind: 'side', xp: 150,
    stages: {
      '1': 'Brandt\'s karaoke ad sings a bakery jingle from forty years ago and calls her by her mother\'s name. Truus\'s port is in it. Talk to Brandt.',
      '2': 'Cut Truus\'s port loose from the ad in the Steps pocket of the Shallows.',
      '3': 'Truus\'s port rides in yours. Take it to Mam in the Ferry Hall, past the Pale.',
      done: 'The singing sign is settled.',
    },
    where: { '1': ['steps', 'brandt_front'], '2': ['net_shallows', 'steps_front'], '3': ['net_ferryhall', 'mam_front'] },
  },
  {
    id: 'ut_arrears', title: 'Arrears Night', kind: 'gig', xp: 200,
    stages: {
      '1': 'Bodywell\'s lease server sits behind a gate in the southeast of the Shallows. Switch every leased limb in Pell Market back on. A clean job with no clock left on them makes it permanent.',
      '2': 'Done. Tell Kat at her booth outside Club Violet.',
      done: 'Paid.',
    },
    where: { '1': ['net_shallows', 'bw_front'], '2': ['steps', 'kat_spot'] },
  },
  {
    id: 'ut_courier', title: 'The Courier', kind: 'side', xp: 150,
    stages: { '1': 'Sem carries a Vein cellar list in his port, and the Desk is tracing it. Ride the current from the courier pad in the Shallows to shake the trace.', done: 'Sem\'s run is over.' },
    where: { '1': ['net_shallows', 'courier_front'] },
  },
  {
    id: 'ut_frostbite', title: 'Frostbite', kind: 'side', xp: 200,
    stages: { '1': 'Hessel touched the Pale and came back flat. The gray part of his port is behind a gate in the southwest of the Shallows, with Desk ICE around it.', done: 'Hessel\'s pocket is settled.' },
    where: { '1': ['net_shallows', 'hessel_front'] },
  },
  {
    id: 'ut_bounty', title: 'Three Drifts', kind: 'gig', xp: 200,
    stages: {
      '1': 'Three drifts are loose in the Stair\'s net: a door-lock daemon, a clearance ad, and a lift jingle. Fight them, cut them, or talk them back over. They are in the Shallows.',
      '2': 'Settle every drift, then tell Kat at her booth outside Club Violet.',
      done: 'Paid.',
    },
    where: { '1': ['net_shallows', 'hub_in'], '2': ['steps', 'kat_spot'] },
  },
  {
    id: 'ut_sleep', title: 'Sleepwalkers', kind: 'side', xp: 150,
    stages: {
      '1': 'The first building\'s sleepwalkers are settled.',
      '2': 'Anouk says the route was copied from a second building. Its junction box is on Terrace 4, west side.',
      done: 'The terraces sleep in their own beds.',
    },
    where: { '2': ['terraces', 'sleep2_front'] },
  },
  {
    id: 'ut_channel', title: 'Dead Channel', kind: 'side', xp: 180,
    stages: { '1': 'The Church\'s Wet Night sermon still broadcasts on Channel Nine, behind a gate south of the Shallows hub. Ignace has opinions.', done: 'Channel Nine is settled.' },
    where: { '1': ['net_shallows', 'channel_front'] },
  },
  {
    id: 'ut_ferry', title: 'The Last Ferry', kind: 'side', xp: 180,
    stages: { '1': 'The old ferry timetable keeps sending the six o\'clock ferry that sank. Ride its route from Pier 2 in the message hall.', done: 'The last ferry arrived.' },
    where: { '1': ['net_exchange', 'ferry_front'] },
  },
]);

// ---------------------------------------------------------------- Puzzles

addSplice([
  { id: 'ut_ottens', difficulty: 1, title: 'Loose Grip', targets: [{ label: 'Open the hand' }] },
  { id: 'ut_sign_close', difficulty: 1, title: 'Close the Leak', targets: [{ label: 'Seal the ad port' }, { label: 'Copy the jingle', flag: 'sign_jingle' }] },
  { id: 'ut_sign_carry', difficulty: 2, title: 'Cut It Loose', targets: [{ label: 'Free the port' }] },
  { id: 'ut_census_splice', difficulty: 2, title: 'Stamp Queue', targets: [{ label: 'Stop the stamps' }, { label: 'Find the clerk', flag: 'clerk_found' }, { label: 'Pull Terwal file', flag: 'terwal_file' }] },
  { id: 'ut_desk_gate', difficulty: 2, title: 'Front Gate', targets: [{ label: 'Open the gate' }, { label: 'Loop the cameras', flag: 'desk_cam_loop' }, { label: 'Log a false leak', flag: 'maas_misled' }] },
  { id: 'ut_desk_log', difficulty: 3, title: 'Crossing Log', targets: [{ label: 'Wipe the log' }, { label: 'Erase Thursdays', flag: 'thursdays_wiped' }] },
  { id: 'ut_arrears', difficulty: 4, title: 'Arrears Night', targets: [{ label: 'Wake the leases' }, { label: 'Kill the clock', flag: 'arrears_clock' }, { label: 'Burn the ledger', flag: 'arrears_ledger' }] },
  { id: 'ut_b_door', difficulty: 2, title: 'Lock Daemon', targets: [{ label: 'Unlock Terrace 1' }] },
  { id: 'ut_b_ad', difficulty: 2, title: 'Clearance Ad', targets: [{ label: 'End the sale' }] },
  { id: 'ut_b_lift', difficulty: 2, title: 'Lift Jingle', targets: [{ label: 'Stop the lift' }] },
  { id: 'ut_channel', difficulty: 2, title: 'Channel Nine', targets: [{ label: 'Cut the sermon' }, { label: 'Keep the carrier', flag: 'channel_carrier' }] },
]);

addSurf([
  { id: 'ut_crack', difficulty: 2, title: 'Through the Crack' },
  { id: 'ut_courier', difficulty: 2, title: 'Shake the Trace' },
  { id: 'ut_ferry', difficulty: 3, title: 'The Last Ferry' },
]);

addBail([
  { id: 'ut_sleep_bail', difficulty: 2, title: 'Night Route' },
  { id: 'ut_sleep2_bail', difficulty: 3, title: 'Second Building', drains: 2 },
  { id: 'ut_desk_ducts', difficulty: 2, title: 'Duct Pumps' },
  { id: 'ut_ex_switch', difficulty: 2, title: 'Old Switchboard' },
  { id: 'ut_hessel_thaw', difficulty: 2, title: 'Thaw Route' },
  { id: 'ut_thaw_route', difficulty: 3, title: 'Into the Machines', drains: 3 },
]);

// ---------------------------------------------------------------- Lore

addLore([
  { id: 'ut_wetnight', title: 'The Wet Night', text: 'Twenty-two years ago, for six bells one night, every port in Fathom woke. Chrome walked its owners into the canals. 312 drowned. The Board calls it the Surge. Nobody else does.' },
  { id: 'ut_undertow', title: 'The Undertow', text: 'The drowned net. The old city\'s exchange went under in the Flood, and forty years of bailed red washed over it. Its cables and the ports of the drowned woke.' },
  { id: 'ut_pale', title: 'The Pale', text: 'A wall in the net, made of Hush. Every packet in and out of Fathom passes through it. Anything woken that touches it goes still for days. Divers come back frostbitten.' },
  { id: 'ut_desk', title: 'The Quiet Desk', text: 'Board Net Security. Fourteen divers, one Director, white coats with the red stripe on the cuff. Its Stair office is a data tower on Terrace 3.' },
  { id: 'ut_drifts', title: 'Drifts', text: 'Programs that woke in the Undertow: ads, alarms, timetables, door locks. Each one woke in whatever feeling the blood carried, and most of them are still in it.' },
  { id: 'ut_drowned', title: 'Drowned ports', text: 'The ports of the people who drowned in the Flood. They woke in the sea with nothing new to hear, so they talk only in their owners\' last week of messages.' },
  { id: 'ut_shallows', title: 'The Shallows', text: 'The city\'s own net, inside the Pale. Every diver in Fathom dives here. Ports have bodies in the Shallows. Most of them stand still.' },
  { id: 'ut_truus', title: 'Truus Brandt', text: 'Went for bread on Lock Road the night of the Flood. Her port learned to talk from her last week: supper, the ferry, the bakery, and her daughter\'s name.' },
  { id: 'ut_sleepers', title: 'The sleepwalkers', text: 'Four drowned ports in a building\'s net, walking four sleepers up the ramp toward the Wall. Each one is walking a body home to an address under the sea.' },
  { id: 'ut_clerk', title: 'The drowned clerk', text: 'A Census clerk\'s port, still stamping the week of the Flood. Its last stamp: HALSEMA. PELL MARKET. AGE 9. RETEST CANCELLED.' },
  { id: 'ut_terwal_card', title: 'Census card: Terwal, A.', text: 'Canal Four. Age six. Result: no wake. Line: none. Refer to Sunny Steps, Form 11. In pen underneath: transfer to the Quiet Desk. W.M.' },
  { id: 'ut_pike', title: 'The Pike port', text: 'Jory Pike\'s port woke with Line 1 on his neck as he died in the barge hold. With no host, it ran down the barge\'s cable into the net and past the Pale. It talks in his last hour.' },
  { id: 'ut_pike_want', title: 'Dry', text: 'The Pike port wants something besides her now: a street on Canal Nine, and the water staying below the third step.' },
  { id: 'ut_file', title: 'Asset Terwal', text: 'PALE INTEGRITY TRACKS THE ASSET\'S AFFECT. KEEP THE ASSET QUIET. Barber every fourth Monday. No pets. No music. Signed W. Maas, the morning after the Wet Night.' },
  { id: 'ut_hush_source', title: 'Where Hush comes from', text: 'Hush is the blood of a witch who feels nothing. The old stock ran out. Since the Wet Night every drop of the Pale has come from one diver, every Thursday.' },
  { id: 'ut_mam', title: 'Mam', text: 'Grietje Halsema\'s port. It woke in the sea, the first of all of them. It calls every port "love". The drowned gather around it in the Ferry Hall.' },
  { id: 'ut_mam_last', title: 'The last message', text: 'Sent at the second bell on the night of the Flood: "Teun. Take your sister up to the Lock. I\'ll come after." Teun was fourteen.' },
  { id: 'ut_mies', title: 'Mies Terwal', text: 'Nine. On the Wet Night the Board said stay in, and she went out to fetch her little sister from Sunny Steps. Canal Four, 02:10. Number 188.' },
  { id: 'ut_noekie', title: 'Noekie', text: 'What Mies called Anouk. Nobody else ever did. A port past the Pale said it every Thursday for a year.' },
  { id: 'ut_coldroom', title: 'The Cold Room', text: 'The Pale\'s servers, under the Crown. Their cooling water is Hush, and the frost on the racks is real. Chair 0017 is a spare, in case the Stair line fails.' },
  { id: 'ut_exchange', title: 'The telephone building', text: 'The old city\'s number exchange, on Lock Road. Dirkje\'s mother worked the switchboard. At low water its racks breathe.' },
  { id: 'ut_frostbite_lore', title: 'Frostbite', text: 'What the Pale does to a diver who touches it without a key. Chrome hushed, port gray, and sometimes the thinking flat for weeks. The Desk replaces divers.' },
  { id: 'ut_channel9', title: 'Channel Nine', text: 'The Church radio net before the Flood. On the Wet Night it played Archdeacon Pruim\'s judgment sermon all night. Some of the faithful walked into the water with it playing.' },
  { id: 'ut_ferry', title: 'The six o\'clock ferry', text: 'The Morgenster, Pell to the islands, sank in the Flood with everyone aboard. The timetable that ran it woke grieving and kept sending it.' },
  { id: 'ut_bodywell_net', title: 'Bodywell\'s lease server', text: 'Eleven thousand leased limbs, each with a clock. When the clock runs out, the limb stops. The server sits in the Shallows behind commercial ICE.' },
  { id: 'ut_maas', title: 'Director Wendel Maas', text: 'Head of the Quiet Desk. A junior on the Bailer project with Quaye. He ran the Wet Night count and got every one. Visits the asset every fourth Monday.' },
  { id: 'ut_thursdays', title: 'Thursdays', text: 'Sample at 09:00. Ninety minutes. Tea and a biscuit after. Fifty-two vials a year, labeled TERWAL, A. For research.' },
  { id: 'ut_netrules', title: 'Rules of the net', text: 'Every hand does the same thing in the net: Spike. It costs memory and never misses. Hack matters, muscle does not. Frost slows you. White ICE can be cut.' },
  { id: 'ut_lowwater', title: 'Low water', text: 'The Pale thawed. The drowned came home slowly, at low water, into the trams and the lamps and the pumps. Not into anybody.' },
  { id: 'ut_frost', title: 'Frost', text: 'The Pale holds. The net is safe and quiet. Somebody is holding it, and has their own reasons.' },
  { id: 'ut_racks', title: 'Server racks', text: 'Pre-Flood racks, built to be cooled by seawater. At low water the sea cools them for free. They still run.' },
  { id: 'ut_desk_binder', title: 'Procedure Four: Quiet Days', text: 'No music. No pets. No visitors. No holidays. Report temperature changes. A quiet day is a good day.' },
]);

// ---------------------------------------------------------------- Details

const D = (id: string, map: string, at: [number, number], text: string, more: Partial<Detail> = {}): Detail => ({ id, map, at, text, ...more });

addDetails([
  // The Shallows
  D('uts_ad', 'net_shallows', [8, 4], 'A block of glyph rows. Ad copy from the Steps, forty years deep. SING TONIGHT. DRY FEET FIVE GILT.', { port: { 3: 'The words are old. Older than the hand. Is old a kind of cold?', 5: 'Old words. I am collecting them.' }, lore: 'ut_shallows' }),
  D('uts_guest', 'net_shallows', [2, 6], 'The pocket wall. Every line is a club guest list. Tonight\'s list for Violet scrolls past.', { check: { skill: 'hack', need: 4, text: 'Your name is on Violet\'s list. Plus three. Somebody likes you.' } }),
  D('uts_index', 'net_shallows', [26, 4], 'Census index blocks. Names by street, streets by canal. The Canal Four block is thinner than the others.', { party: { tova: 'four canal. that\'s where they get most of them.', quaye: 'Canal Four tests red more than any canal in the city. Nobody knows why.' }, lore: 'ut_drowned' }),
  D('uts_index2', 'net_shallows', [33, 7], 'More index blocks. One is frosted over, a gray stripe through the middle.', { check: { skill: 'tech', need: 4, text: 'Desk frost. Somebody sealed a file here on purpose. The tag reads 0017.' } }),
  D('uts_frost', 'net_shallows', [55, 6], 'A frost wall at the end of the terrace building\'s route. It does not move. Nothing here moves except the currents into it.', { port: { 3: 'Why does the water go into the wall? Does the wall want it?', 4: 'Our hand is cold just looking.' }, lore: 'ut_pale' }),
  D('uts_hub', 'net_shallows', [25, 18], 'SHALLOWS. Stair net, public tier. A ticker of tonight\'s traffic: noodle orders, a love note, a shift swap.', { lore: 'ut_netrules', party: { anouk: 'Public tier. Two hundred thousand packets a bell. I used to count them to fall asleep.' } }),
  D('uts_hub2', 'net_shallows', [34, 25], 'A pillar of live messages. Warm to stand next to.', { check: { skill: 'notice', need: 4, text: 'One message keeps resending. "Mum, I\'m on the Steps. Come get me." Sent tonight. Somebody living.' } }),
  D('uts_door', 'net_shallows', [7, 18], 'A doorframe of code. RESIDENTS ONLY in old Board font.', { party: { courtesy: 'RESIDENTS ONLY. THIS UNIT IS A RESIDENT OF THE BARGE.' } }),
  D('uts_ads', 'net_shallows', [48, 23], 'An ad block. CLEARANCE. EVERYTHING MUST GO. The price tags are all forty years old.', { party: { ambrose: 'Everything must go. A philosophy, a sale, and a threat.' } }),
  D('uts_gray', 'net_shallows', [6, 35], 'A gray block. Inside it, faint, a Desk diver\'s pale check, repeating. Cold. Cold. Cold.', { party: { quaye: 'That\'s Hessel\'s shift pattern. Four bells on, eight off. I\'d know it anywhere.' }, lore: 'ut_frostbite_lore' }),
  D('uts_radio', 'net_shallows', [25, 34], 'A radio mast in the net. CHANNEL NINE, CHURCH OF THE RAISED HAND, in brass letters that are not brass.', { party: { ignace: 'The Church sold the radio license in the year I was born. Somebody forgot to tell the mast.' }, lore: 'ut_channel9' }),
  D('uts_lease', 'net_shallows', [45, 34], 'A Bodywell rack. Eleven thousand leases, each one with a clock beside it running down.', { check: { skill: 'hack', need: 5, text: 'Lease 4471-K: one knee, Kwarteng, A. Clock at nine days.' }, party: { ambrose: 'Every one of those clocks has a person attached. Some have two.' }, lore: 'ut_bodywell_net' }),
  // The Desk's net
  D('utd_ice', 'net_desk', [9, 5], 'White ICE in frost bricks. Every brick is stamped QUIET.', { party: { anouk: 'I wrote this wall. Procedure Nine. It is very good. I would like it to be worse now.' } }),
  D('utd_ice2', 'net_desk', [16, 4], 'A frost lane. The floor between the bricks is stained gray where divers stood too long.', { check: { skill: 'notice', need: 4, text: 'Footprints in the frost, all the same size. One diver, every Thursday.' } }),
  D('utd_chamber', 'net_desk', [22, 6], 'The log chamber wall. DIRECTOR ONLY. LOGGED ACCESS.', { lore: 'ut_desk' }),
  D('utd_rack', 'net_desk', [24, 4], 'A frosted rack holding the crossing log\'s backups. Each backup is a Monday.', { party: { quaye: 'Weekly backups. Maas always was tidy.' } }),
  D('utd_entry', 'net_desk', [1, 10], 'The Desk net\'s entry wall. A plaque in the code: THIS NET IS QUIET. PLEASE KEEP IT THAT WAY.', { port: { 3: 'Everything here is white. Is white a feeling?', 5: 'I do not like white. That is mine. I decided it.' } }),
  D('utd_floor', 'net_desk', [13, 9], 'Frost floor. The cold comes up through your avatar\'s feet.', { party: { tova: 'i can\'t feel my feet. i don\'t even have feet in here.' } }),
  D('utd_mid', 'net_desk', [16, 15], 'More frost. A sentry\'s old post, empty now, with a ring of frost where it stood.', {}),
  D('utd_back', 'net_desk', [27, 12], 'The back wall of the log chamber. Somebody scratched a line in the frost: 41.', { check: { skill: 'notice', need: 3, text: 'Forty-one. The number of Thursdays she answered.' } }),
  // The Pale
  D('utp_wall', 'net_pale', [5, 15], 'The Pale, up close. Flat steel, no dither, no motion. It does not reflect anything.', { lore: 'ut_pale', port: { 3: 'It is not breathing. Everything breathes. Why is it not breathing?', 5: 'Still. I was nearly still once. I do not want it.' } }),
  D('utp_wall2', 'net_pale', [20, 15], 'The Pale. A long way up, a long way across. Under the frost, gray, something that might be a handprint.', { check: { skill: 'notice', need: 5, text: 'A child-sized handprint, pressed into the frost from the far side.' } }),
  D('utp_wall3', 'net_pale', [40, 15], 'The Pale. Someone has written in the frost from this side: QUIET PLEASE.', { party: { courtesy: 'QUIET PLEASE. THIS UNIT DID NOT WRITE THIS. THIS UNIT WOULD HAVE.' } }),
  D('utp_crack', 'net_pale', [30, 12], 'The crack, from the far side. Red at the edges. Line 1 red.', { party: { sallis: 'That red. Same as the hold. Same as Jory\'s neck.' } }),
  D('utp_edge', 'net_pale', [10, 12], 'The far face of the Pale. Frost floor all along it. Drowned ports stand here, still, wherever they touched it.', { lore: 'ut_drowned' }),
  D('utp_block', 'net_pale', [4, 5], 'A block of drowned messages, packed tight. You can read one at a time if you lean close.', { check: { skill: 'hack', need: 4, text: 'Thousands of last messages. Most are about dinner.' } }),
  D('utp_block2', 'net_pale', [13, 2], 'A block of drowned messages. One line repeats: WHERE ARE YOU WHERE ARE YOU.', {}),
  D('utp_block3', 'net_pale', [24, 4], 'Two blocks leaning together, the way people stand in a doorway.', { port: { 5: 'Those two are waiting for each other. I can tell.' } }),
  D('utp_block4', 'net_pale', [42, 4], 'A block of timetables. FERRY 6:00. TRAM 14. BUS 9. All on time.', { lore: 'ut_ferry' }),
  D('utp_cover', 'net_pale', [8, 21], 'A data block on the near side. Desk graffiti in the code: THURSDAY AGAIN.', { party: { anouk: 'Diver Pieters. He writes that every Thursday. I did not know he meant me.' } }),
  // The message hall
  D('utx_wall', 'net_exchange', [9, 6], 'A wall of old messages. Every glyph row is a person\'s last week.', { lore: 'ut_drowned', port: { 4: 'So many. Our hand cannot hold all of them.', 5: 'I could listen to all of them. That would take forty years.' } }),
  D('utx_wall2', 'net_exchange', [34, 6], 'Another wall of messages. Shopping lists, mostly. Bread. Milk. Eels.', { party: { quaye: 'Eels were four gilt a kilo then. You could hear it in how they wrote.' } }),
  D('utx_wall3', 'net_exchange', [9, 24], 'Messages about the water. The step. The second step. The stairs.', { check: { skill: 'notice', need: 4, text: 'They come in order. The water rose one step every nine minutes.' } }),
  D('utx_wall4', 'net_exchange', [34, 24], 'Messages that were never sent. A draft. A draft. A draft.', { party: { ignace: 'Unsent. The truest kind. I\'ve kept a few of my own.' } }),
  D('utx_shelf', 'net_exchange', [15, 7], 'A message shelf. Birthday wishes, stacked by date.', { lore: 'ut_undertow' }),
  D('utx_shelf2', 'net_exchange', [27, 14], 'A shelf of voice notes. Some of them are children.', { party: { tova: 'kids. there are kids in here. stop. i want to go.' } }),
  D('utx_shelf3', 'net_exchange', [15, 21], 'A shelf of messages from the Board, all identical: THE WALL WILL HOLD.', { party: { quaye: 'I ordered the paper for that notice. Ten thousand sheets.' } }),
  D('utx_shelf4', 'net_exchange', [27, 21], 'A shelf of love letters. Short ones. Fathom people do not write long ones.', {}),
  D('utx_pad', 'net_exchange', [18, 30], 'The surface pad. Above it, through the switchboard, the Flats and the tide.', { port: { 4: 'Up is that way. Our body is that way.' } }),
  D('utx_rack', 'net_exchange', [3, 3], 'An exchange rack. Pre-Flood. It still routes. Nobody tells it where.', { lore: 'ut_racks' }),
  // The Ferry Hall
  D('uth_pillar', 'net_ferryhall', [7, 9], 'A ticket hall pillar. Painted on it, peeling: PIER 2 THIS WAY.', { lore: 'ut_mam' }),
  D('uth_pillar2', 'net_ferryhall', [14, 9], 'A pillar. Somebody carved a height chart into it. The marks stop at forty years ago.', { party: { anouk: 'Every family on Lock Road had one of these. Ours was on a door.' } }),
  D('uth_pillar3', 'net_ferryhall', [25, 9], 'A pillar with a timetable bolted on. Every ferry, on time.', {}),
  D('uth_pillar4', 'net_ferryhall', [32, 9], 'A pillar. LOST PROPERTY, an arrow, and under it in chalk: WE ARE.', { party: { courtesy: 'LOST PROPERTY. THIS UNIT HAS BEEN LOST PROPERTY. IT IS NOT A PLACE.' } }),
  D('uth_low', 'net_ferryhall', [7, 20], 'A pillar near the benches. The drowned sit here in rows, waiting for the six o\'clock.', { port: { 5: 'They are waiting. I know waiting. I waited in the dark for a long time.' } }),
  D('uth_low2', 'net_ferryhall', [25, 20], 'A pillar. A drowned port has leaned its forehead on it. It has been like that for forty years.', {}),
  D('uth_west', 'net_ferryhall', [1, 14], 'The west wall. A thin place. Through it, rain on the Deeps, twenty-two years ago.', { party: { anouk: 'Canal Four. I know that rain.' }, lore: 'ut_wetnight' }),
  D('uth_pier', 'net_ferryhall', [38, 22], 'The pier\'s end wall. Wet, still. The current slaps against it.', { lore: 'ut_ferry' }),
  D('uth_top', 'net_ferryhall', [20, 1], 'The hall\'s north wall. FERRY HALL, LOCK ROAD, in tile letters. Half the tiles are messages now.', {}),
  // The Wet Night
  D('utw_house', 'net_wetnight', [10, 23], 'Number 9, Canal Four. A shack with a broken step and a light on in the back.', { party: { tova: 'that\'s like ours was. the one on six. same tin roof.' }, lore: 'ut_mies' }),
  D('utw_lane', 'net_wetnight', [5, 11], 'A shack wall. A Board poster, fresh: STAY IN. THE PUMPS ARE HOLDING.', { party: { quaye: 'The pumps held. The people didn\'t stay in.' } }),
  D('utw_square', 'net_wetnight', [31, 15], 'A shack facing the square. A door hanging open. Inside, a chair on its side.', { check: { skill: 'notice', need: 3, text: 'Wet footprints leading out. Bare feet. Walking in a straight line.' } }),
  D('utw_stack', 'net_wetnight', [36, 26], 'A container stack. A child\'s chalk circle, no line through it. Vein mark: safe.', { party: { sallis: 'Cell Four. That was ours. Four cellars that night.' } }),
  D('utw_canal', 'net_wetnight', [44, 4], 'Canal Four. Black water. The rain lands on it without a sound.', { lore: 'ut_wetnight', port: { 5: 'The water is very quiet. I do not like this quiet either.' } }),
  D('utw_mid', 'net_wetnight', [3, 19], 'The middle canal. The bridge here is gone. It was never built.', { party: { ambrose: 'The Board built bridges where the rent was paid. I have a whole theory.' } }),
  D('utw_shack', 'net_wetnight', [20, 17], 'A shack by the bridge. A radio inside, playing Channel Nine.', { party: { ignace: 'Pruim. I\'d know that voice in my grave. Walk to her, walk to the water.' } }),
  D('utw_south', 'net_wetnight', [17, 32], 'The south row. Every window lit. Nobody in any of them.', {}),
  D('utw_quay', 'net_wetnight', [47, 8], 'A shack on the quay. Its door has a tide mark at knee height from the Flood, painted over.', {}),
  // The heart
  D('uthe_pillar', 'net_heart', [5, 9], 'A frost pillar. Inside it, layered like a cake, eleven hundred Thursdays.', { lore: 'ut_hush_source', party: { anouk: 'Every layer is ninety minutes.' } }),
  D('uthe_pillar2', 'net_heart', [23, 9], 'A frost pillar. The layers near the top are thinner. The last year is almost clear.', { check: { skill: 'notice', need: 4, text: 'The thin layers are the Thursdays she answered.' } }),
  D('uthe_core', 'net_heart', [11, 13], 'A frost block at the heart\'s middle. It hums at a pitch you feel in your port.', { port: { 5: 'It is singing very low. It is the opposite of a song.' } }),
  D('uthe_core2', 'net_heart', [18, 13], 'A frost block. QUIET PLEASE, in the Desk\'s font, frozen into it.', { party: { courtesy: 'QUIET PLEASE. THIS UNIT IS DECLINING.' } }),
  D('uthe_west', 'net_heart', [0, 10], 'The heart\'s west wall. Frost all the way out. Past it, the whole city\'s net.', { lore: 'ut_frost' }),
  D('uthe_top', 'net_heart', [14, 0], 'The top of the heart. Above it, in the cold, every packet in Fathom passes through.', {}),
  D('uthe_low', 'net_heart', [5, 17], 'A frost pillar. Somebody wrote on it from inside: RECEIVED.', { party: { anouk: 'That is my word. That is what I said to her.' } }),
  D('uthe_east', 'net_heart', [29, 20], 'The east wall. Through the frost, faint red, a long way off. The drowned, waiting.', { lore: 'ut_lowwater' }),
  // The Quiet Desk
  D('utq_counter', 'quietdesk', [12, 23], 'The front desk. A sign-in binder, open. Every line: name, number, temperature.', { lore: 'ut_desk_binder', party: { anouk: 'I have signed that binder eleven hundred times. My temperature never changes.' } }),
  D('utq_rack', 'quietdesk', [4, 3], 'A server rack under real frost. Your breath fogs.', { lore: 'ut_desk', check: { skill: 'tech', need: 4, text: 'Hush coolant. The lines run down into the floor and east, toward the Brim.' } }),
  D('utq_tank', 'quietdesk', [16, 3], 'A Hush cooling tank in the sample room. A tube runs from the chair to the tank.', { party: { tova: 'that tube goes from the chair. to that. she bleeds into a tank.', quaye: 'Sample line. They\'re not sampling. That\'s a supply line.' }, lore: 'ut_thursdays' }),
  D('utq_shelf', 'quietdesk', [32, 2], 'Maas\'s shelf. Binders by year. Every year has the same title: QUIET.', { lore: 'ut_maas', check: { skill: 'notice', need: 4, text: 'One binder is newer. WET NIGHT COUNT. 312. Every name, in his handwriting.' } }),
  D('utq_desk', 'quietdesk', [5, 13], 'A diver\'s desk. A mug: WORLD\'S QUIETEST DIVER. A plant, plastic.', { party: { anouk: 'Pieters. His mother sent the mug.' } }),
  D('utq_desk2', 'quietdesk', [28, 17], 'A diver\'s desk. A schedule pinned up. THURSDAY: T. SAMPLE. 09:00. Every Thursday, forever.', { party: { anouk: 'I am on everybody\'s wall. I did not know that.' } }),
  D('utq_plant', 'quietdesk', [33, 11], 'A planter of white flowers. Fake. They have never needed water.', {}),
  D('utq_bin', 'quietdesk', [10, 20], 'A bin. Empty biscuit wrappers. Thursday biscuits.', { party: { anouk: 'The biscuit is the only part of the procedure I would keep.' } }),
  D('utq_wall', 'quietdesk', [13, 10], 'QUIET PLEASE, painted on the wall at eye height. Under it, smaller: THANK YOU.', { party: { courtesy: 'QUIET PLEASE. THANK YOU. THIS UNIT HAS LEARNED TWO NEW ANNOUNCEMENTS.' } }),
  D('utq_lobby', 'quietdesk', [24, 23], 'The far end of the front desk. A bowl of mints and a stack of frostbite leave forms.', { reward: { item: 'stim' } }),
  D('utq_duct', 'quietdesk', [1, 20], 'The cooling duct. Frost on every seam. It smells of the Census van.', {}),
  // The telephone building
  D('ute_board', 'exchange', [19, 4], 'The switchboard. Rows of brass jacks, green and wet. Cords hang down into the mud.', { lore: 'ut_exchange', party: { quaye: 'A manual exchange. They had forty girls on this board. Forty.' } }),
  D('ute_rack', 'exchange', [13, 8], 'A rack in the mud. Its lights are on.', { lore: 'ut_racks', check: { skill: 'tech', need: 4, text: 'Seawater cooling. At low water the sea runs it for free.' } }),
  D('ute_wall', 'exchange', [10, 8], 'The exchange\'s wall. A tide line at head height, and another at the roof.', {}),
  D('ute_wall2', 'exchange', [34, 12], 'The east wall. A brass plate: LOCK ROAD EXCHANGE. NUMBER, PLEASE.', { party: { ambrose: 'Number, please. A gentler age. A wetter one.' } }),
  D('ute_silt', 'exchange', [14, 16], 'Red in the silt. Not rust. It never dries.', { party: { tova: 'that\'s blood. that\'s all the blood. everybody\'s.', anouk: 'Forty years of Lines. The Bailers pour it over the Wall. It lands here.' }, lore: 'ut_undertow' }),
  D('ute_silt2', 'exchange', [25, 18], 'More red, pooled in a floor drain. A cable lies in it and breathes.', { check: { skill: 'notice', need: 3, text: 'The cable breathes faster where it touches the red.' } }),
  D('ute_post', 'exchange', [5, 6], 'A mooring post with a rope still on it. Nothing at the other end.', {}),
  D('ute_post2', 'exchange', [36, 9], 'A mooring post. A Wader knot tied at the top. A tide mark.', { party: { sallis: 'Dirkje\'s knot. She\'s been out here before.' } }),
  D('ute_sea', 'exchange', [20, 25], 'The sea, coming back. You have an hour, maybe.', { port: { 4: 'The water is coming for our feet. Up.', 5: 'I like the sea. I like it less when it is coming for our feet.' } }),
  D('ute_rack2', 'exchange', [30, 8], 'A rack with a drowned man\'s jacket hung on it. The jacket is old and the hook is new.', { party: { anouk: 'Someone hangs it back up. At low water. Every time.' } }),
  // The Cold Room
  D('utc_tank', 'coldroom', [9, 5], 'A Hush cooling tank, man-high. Gray inside, and it moves slowly, like syrup.', { lore: 'ut_coldroom', party: { anouk: 'That is mine. All of it. One year.' } }),
  D('utc_rack', 'coldroom', [3, 6], 'A frosted rack on the catwalk. The Pale\'s servers. They hum at the same pitch as the Desk.', { check: { skill: 'tech', need: 4, text: 'Integrity 61%. Down a point an hour since you came in.' } }),
  D('utc_rack2', 'coldroom', [11, 10], 'A frosted rack. Frost an inch thick. Your fingertip leaves a mark that does not fade.', {}),
  D('utc_rail', 'coldroom', [6, 10], 'The catwalk rail. A Desk coat hangs on it, white, red cuff. The number on the sleeve is 0001.', { party: { anouk: 'Maas. He was the first diver. He never told me.' } }),
  D('utc_tank2', 'coldroom', [13, 19], 'A tank beside the chair. A tube runs from the chair\'s arm into it.', { party: { tova: 'a tube. from the chair. this one too. how many chairs.' } }),
  D('utc_pipes', 'coldroom', [8, 23], 'Coolant pipes, gray. One is labeled STAIR LINE. It comes from the west, all the way from the terraces.', {}),
  D('utc_lift', 'coldroom', [15, 2], 'The lift wall. Somebody scratched a tally here. Twenty-two groups of fifty-two.', { check: { skill: 'notice', need: 3, text: 'Thursdays. Every one. Someone down here counted.' } }),
  D('utc_tank3', 'coldroom', [24, 13], 'A tank. A paper label: OLD STOCK, EMPTY. STILLMAN\'S WORKS 1.', { party: { quaye: 'Old Hush. The witch it came from died before the Flood. This is what they had before her.' } }),
  D('utc_floor', 'coldroom', [17, 17], 'THURSDAY, stenciled on the floor in front of the chair. In red. Board red.', {}),
  // Anouk's flat
  D('utf_wall', 'anouk_flat', [2, 1], 'A white wall. Nothing on it. Not a nail hole.', { party: { anouk: 'Procedure Four. No pictures. I never wanted any. I never asked if I did.' } }),
  D('utf_wall2', 'anouk_flat', [9, 1], 'The north wall. It has the outline of a window, bricked in.', { check: { skill: 'notice', need: 3, text: 'Desk flats face the wall. The window would have faced the Deeps.' } }),
  D('utf_wall3', 'anouk_flat', [14, 5], 'The east wall. A thermostat, set to eleven degrees and taped there.', { party: { tova: 'eleven degrees. you live at eleven degrees.' } }),
  D('utf_door', 'anouk_flat', [6, 10], 'Beside the door, a coat hook. One white coat. One spare.', {}),
  D('utf_floor', 'anouk_flat', [2, 9], 'A corner. Swept. Swept recently. Swept every day.', {}),
  // Existing maps
  D('ut_rail', 'steps', [12, 37], 'The channel railing. A dent where a chrome hand held it all night. Frost in the dent.', { when: 'ottens_free', party: { anouk: 'His grandfather drowned here. The port remembered the railing.' } }),
  D('ut_queue', 'census', [16, 11], 'The counter under the queue screen. A paper stamp, forty years old, left by nobody. CLEAR.', { when: 'leak_census', lore: 'ut_clerk' }),
  D('ut_deskdoor', 'terraces', [37, 12], 'The Desk tower\'s facade. White, no windows, a red stripe at waist height.', { when: 'ut1_done|desk_known', lore: 'ut_desk' }),
  D('ut_flatdoor', 'terraces', [38, 22], 'A white door with no name on it.', { when: 'roster:anouk', party: { anouk: 'Mine. Eleven years. The lock is Desk issue.' } }),
  D('ut_lift', 'crown', [12, 2], 'A lift door with one button. It points down.', { when: 'ut2_done', lore: 'ut_coldroom' }),
]);

// ---------------------------------------------------------------- Travel and world events

addTravel([
  { id: 'exchange', name: 'The telephone building', district: 'flats', map: 'exchange', marker: 'mud_in', when: 'chapter>=4&chapter<6&exchange_seen' },
  { id: 'quietdesk', name: 'The Quiet Desk', district: 'stair', map: 'terraces', marker: 'desk_out', when: 'chapter>=3&desk_known' },
]);

addEvents([
  { id: 'ut_ev_ad', scene: 'ut_ev_ad', maps: ['steps', 'plaza'], when: 'ut_met&!ut2_done&chapter<6', chance: 0.35, repeat: 8 },
  { id: 'ut_ev_sleeper', scene: 'ut_ev_sleeper', maps: ['terraces'], when: 'leak_steps&!leak_terr', chance: 0.6 },
  { id: 'ut_ev_frostbite', scene: 'ut_ev_frostbite', maps: ['plaza', 'steps'], when: 'ut1_done&chapter<6', chance: 0.3 },
  { id: 'ut_ev_lamp', scene: 'ut_ev_lamp', maps: ['market_flood', 'pumpline'], when: 'ut_beyond&chapter>=5&chapter<6', chance: 0.4 },
]);

// ---------------------------------------------------------------- Banter

const NET = ['net_shallows', 'net_desk', 'net_pale', 'net_exchange', 'net_ferryhall'];
const A = 'ut1_done&!anouk_taken';
addBanter([
  { scene: 'b_ut_ta_gloves', party: ['tova', 'anouk'], when: A },
  { scene: 'b_ut_qa_numbers', party: ['quaye', 'anouk'], when: A },
  { scene: 'b_ut_aa_words', party: ['ambrose', 'anouk'], when: A },
  { scene: 'b_ut_sa_copy', party: ['sallis', 'anouk'], when: A },
  { scene: 'b_ut_ia_bless', party: ['ignace', 'anouk'], when: A },
  { scene: 'b_ut_ca_quiet', party: ['courtesy', 'anouk'], when: `${A}&!courtesy_taken` },
  { scene: 'b_ut_port_hand', maps: ['net_shallows'], party: ['anouk'], when: `${A}&!port_quiet&!port_fading` },
  { scene: 'b_ut_port_wall', maps: ['net_pale'], party: ['anouk'], when: `${A}&!port_quiet&!port_fading` },
  { scene: 'b_ut_net_neck', maps: NET, party: ['quaye', 'anouk'], when: A },
  { scene: 'b_ut_net_red', maps: NET, party: ['tova', 'anouk'], when: A },
  { scene: 'b_ut_pike', maps: ['net_exchange', 'net_ferryhall'], party: ['sallis', 'anouk'], when: `${A}&pike_met` },
  { scene: 'b_ut_mud', maps: ['exchange', 'flats_mud'], party: ['tova', 'anouk'], when: A },
  { scene: 'b_ut_desk', maps: ['quietdesk'], party: ['ignace', 'anouk'], when: A },
  { scene: 'b_ut_flats', maps: ['exchange'], party: ['ambrose', 'anouk'], when: A },
]);

// ---------------------------------------------------------------- Camp

const HERE = 'roster:anouk&!anouk_taken';
addCamp([
  { scene: 'ut_camp_blood', when: 'ut_leaks_done&!ut1_done', priority: 90 },
  { scene: 'ut_rejoin', when: 'anouk_later&!roster:anouk&chapter>=4', priority: 89 },
  { scene: 'ut_thin', when: `${HERE}&ut1_done&chapter>=4`, priority: 87 },
  { scene: 'ut_camp_file', when: `${HERE}&item:maasfile&!desk_file`, priority: 86 },
  { scene: 'ut_camp_mies', when: `${HERE}&mies_done`, priority: 85 },
  { scene: 'ut_camp_first', when: `${HERE}&ut1_done`, priority: 80 },
  { scene: 'ut_camp_tova_anouk', when: `${HERE}&roster:tova&desk_file`, priority: 70 },
  { scene: 'ut_camp_quaye_maas', when: 'roster:quaye&desk_file', priority: 66 },
  { scene: 'ut_camp_sallis_steps', when: `${HERE}&roster:sallis&chapter>=4`, priority: 64 },
  { scene: 'ut_camp_ignace_wet', when: `${HERE}&roster:ignace&ut_pale_seen`, priority: 63 },
  { scene: 'ut_camp_ambrose_arm', when: `${HERE}&roster:ambrose&ut_pale_seen`, priority: 62 },
  { scene: 'ut_camp_courtesy_frost', when: `${HERE}&roster:courtesy&courtesy_freed&!courtesy_taken`, priority: 61 },
  { scene: 'ut_camp_port_hand', when: 'ut_dived&!port_quiet&!port_fading', priority: 58 },
  { scene: 'ut_camp_thursday', when: `${HERE}&desk_file`, priority: 55 },
]);
