// Details, lore, and small quests for the Brim: the sea face, Board Plaza, the Crown, Pump Hall, and the Seawalk.
// Also the gig maps: the Board pump depot, Rook's houseboat, Club Violet, and the relay roof.
// Scenes for the small quests: src/script/niche_upper.txt. Style reference: details_market.ts.
import { addDetails, addLore } from './details';
import { addItems } from '../rules/data';
import { addQuests } from './quests';

addItems([
  { id: 'seaglass', name: 'Sea Glass', kind: 'junk', price: 5, stack: true, desc: 'Sea-worn green glass. Sold in small bags by the Brim.' },
  { id: 'tolltoken', name: 'Toll Token', kind: 'junk', price: 3, stack: true, desc: 'A Lockjaw toll token featuring a jaw on one side and a number on the other.' },
  { id: 'letter_gardener', name: 'Letter for Terrace 4', kind: 'key', price: 0, desc: 'RETURNED. ADDRESS UNKNOWN. Addressed to the gardeners of Terrace 4, from the Brim.' },
  { id: 'letter_jet', name: 'Letter for Box 7', kind: 'key', price: 0, desc: 'RETURNED. ADDRESS UNKNOWN. Addressed to Jet, Box 7, Lantern Steps.' },
  { id: 'clockkey', name: 'Clock Key', kind: 'key', price: 0, desc: 'A brass winding key bearing a tag that reads: SEAWALK CLOCK. CHAIR ONLY.' },
]);

addLore([
  { id: 'wall_built', title: 'The Wall', text: 'Two hundred and ten meters of concrete separate the city from the sea, built by the Board in the hundred days after the Flood. Catwalks nobody uses climb the sea face. The top is called the Brim.' },
  { id: 'board', title: 'The Fathom Water Board', text: 'The Board runs the pumps, Bailers, Census, Recovery, and Board Medical. It is run by a Chair from an office at the top of the Wall. Eight Chairs in forty years. The last one has held the seat for twenty.' },
  { id: 'the_crown', title: 'The Crown', text: "The Board's headquarters at the top of the Wall. The lobby is open to petitioners who have an appointment. Nobody has an appointment. | The lift descends to the Pump Hall, and only the Chair is permitted to ride it." },
  { id: 'founding_pump', title: 'The Founding Pump', text: "Pump No. 1, located in the Pump Hall beneath the Crown. A coupling plate on the pump runs a line to every Bailer. Its maker's plate indicates the week of the Flood. | Board engineers call it the Heart, though they are told not to." },
  { id: 'bailers', title: 'The Bailers', text: 'Eleven walking pumps, each as tall as a terrace, bailing water from the canals of the Deeps day and night. They emerged from the water during the week of the Flood. The Board claims to have built them. | Nobody has ever seen the Board build anything that walks.' },
  { id: 'bailer_names', title: 'Bailer nomenclature', text: 'The Deeps named the Bailers during their first winter: Auntie Sloop, Gerda, Hendrik, Marigold, Big Wim, and six others. The Board refers to them by number. Everyone else uses the names, including the Board, when they forget.' },
  { id: 'ninety_tons', title: 'Ninety tons per minute', text: 'A Bailer moves ninety tons of water a minute. Eleven keep the Deeps from filling. Rain brings more on bad nights. The difference goes into the canals and stays there.' },
  { id: 'warden', title: 'The Warden', text: 'A waking entity that guards Pump Hall, kept angry by a monthly drop of Line 4 blood. The Board logs these drops. The Board does not log what the Warden was before.' },
  { id: 'the_sea', title: 'Ocean', text: 'Black water stretching to the horizon, beyond the Wall. The Board sells views of it from the Brim. Boat lights are visible out there most nights. The Board claims they are patrol vessels.' },
  { id: 'board_forms', title: 'Registration forms', text: 'Form 1 founded the Board. Form 7 is a complaint, filed in a box that is welded shut. Form 11 places a child into Board custody. Form 40 is a residence permit, costing more to file than most people earn.' },
  { id: 'brim', title: 'The Brim', text: "The Wall's upper flats house Board staff and those who can pay like them. Enjoy dry shoes, salt air, sea views one way, the Deeps the other. Brim folk habitually check their shoes for damp." },
  { id: 'depot', title: 'Board-owned pump depots', text: 'Depots along the canals service the pump motors and store Hush for Recovery. Each is staffed by a night shift, formerly a day shift, until the budget changed.' },
  { id: 'rook', title: 'Rook', text: 'A buyer living on a houseboat on Canal Six, who pays well for items that should not be sold. Officially, he deals in eels. Opal does business with him, though she dislikes it.' },
  { id: 'lockjaws_toll', title: 'The Lockjaw fee', text: "The Lockjaws charge a fee at the Grand Lock for all water traffic. It's a flat rate for everyone. Rina Moll sets and tallies the fee nightly." },
  { id: 'couriers', title: 'Delivery drones', text: 'Board courier drones haul parcels up the Wall in all weather. Some wake accidentally mid-transit. A woken courier delivers its final parcel, then stays put.' },
]);

addQuests([
  {
    id: 'nq_letters', title: 'Dead Letters', kind: 'side', xp: 120,
    stages: { '1': "Two letters returned to the Brim's dead letter bin: one for Terrace 4 gardeners, one for Jet at Box 7 on the Lantern Steps.", done: 'Dead letters are either delivered, or they are not.' },
    where: { '1': ['terraces', 'garden'] },
  },
  {
    id: 'nq_argue', title: 'Two Hundred and Ten', kind: 'side', xp: 80,
    stages: { '1': "Two Board clerks in the plaza have argued about the Wall's height for eleven years. They want an outsider to settle the dispute.", done: 'The Wall is as tall as you said.' },
    where: { '1': ['boardplaza', 'clerk_spot'] },
  },
  {
    id: 'nq_clock', title: 'The Seawalk Clock', kind: 'side', xp: 100,
    stages: { '1': 'The clock on the Seawalk stopped at the hour of the Flood. The key is kept in the Crown, at the reception desk.', '2': 'You have the clock key.', done: 'The Seawalk clock now shows the hour you chose.' },
    where: { '1': ['crown', 'lobby_in'], '2': ['seawalk', 'walk_mid'] },
  },
]);

// ---------------------------------------------------------------- The sea face

addDetails([
  { id: 'sw_intake', map: 'seawall', at: [14, 4], text: 'A pipe as wide as a person: SEA INTAKE 3. It hums at a frequency you feel in your teeth.', lore: 'ninety_tons', check: { skill: 'tech', need: 5, text: "The gauge reads ninety tons a minute. That's the output of one Bailer. The pipe leads to Pump Hall." } },
  { id: 'sw_bollard', map: 'seawall', at: [20, 3], text: 'A bollard on the sea face, scarred by forty years of rope grooves. There is no rope left.', port: { 6: 'Were boats tied here? Once?' } },
  { id: 'sw_flares', map: 'seawall', at: [19, 6], text: 'A crate of Board flares. EMERGENCY ONLY. Half the box is empty.', party: { sallis: 'Vein took them. Needed signals for the sea route.' }, check: { skill: 'notice', need: 5, text: 'The empty slots form a pattern. Someone took them two at a time, every month.' } },
  { id: 'sw_saltlamp', map: 'seawall', at: [22, 8], text: 'A cold lamp facing the sea. Salt crusted the glass. It illuminates nothing but the water.', port: { 6: 'All of it. It lights up the whole view, faintly.' } },
  { id: 'sw_heaters', map: 'seawall', at: [16, 9], text: 'A junction box labeled CATWALK HEATERS. They have never been switched on.', check: { skill: 'hack', need: 5, text: 'The switch log has only one entry: ON, the night of the Flood. OFF, an hour later.' } },
  { id: 'sw_turret', map: 'seawall', at: [20, 15], text: "A sea face turret pointed out to sea. Nobody remembers what it's meant to shoot.", party: { sallis: 'Boats. It shoots boats.', quaye: 'Forty millimeter. Never fired. I signed for the shells.' } },
  { id: 'sw_initials', map: 'seawall', at: [17, 13], text: "Initials scratched into the Wall at arm's height. Forty years' worth of Board engineers. One set of initials reads H.Q.", party: { quaye: 'Thirty-one years old. A compass point. Keep climbing, kid.' } },
  { id: 'sw_rope', map: 'seawall', at: [18, 17], text: 'A rope coiled the way up the Board, tagged with a note: COUNT ME.', check: { skill: 'notice', need: 4, text: 'The tag reads 40, then 39, then 38. Someone cuts a meter off the rope every time they count it.' } },
  { id: 'sw_rainbarrel', map: 'seawall', at: [21, 20], text: 'A rain barrel sits at the edge of the catwalk. The rain up here tastes of salt.', port: { 6: 'Salt rain. Does the sea reach up into the sky?' } },
  { id: 'sw_sandbags', map: 'seawall', at: [17, 21], text: 'Sandbags from the Flood year. The first stencil reads KEEP FATHOM DRY, with the R reversed.', lore: 'wall_built' },
  { id: 'sw_plaque', map: 'seawall', at: [17, 25], text: 'SEA FACE CONSTRUCTED BY THE FATHOM WATER BOARD IN ONE HUNDRED DAYS. A smaller plaque beneath lists the dead. The list is long.', party: { ambrose: "One hundred days. And beneath that, the price, in a smaller font. It's always in a smaller font." } },
  { id: 'sw_forklift', map: 'seawall', at: [22, 27], text: 'A forklift chained to the catwalk to keep the wind from taking it. The wind took the seat, though.', check: { skill: 'athletics', need: 5, text: 'The cab rocks on its chain. The keys are still in it. It has nowhere to go.' } },
  { id: 'sw_seaglass', map: 'seawall', at: [19, 28], text: 'A crate of sea glass, collected by engineers during their breaks and sorted by year.', reward: { item: 'seaglass', gilt: 2 } },
  { id: 'sw_grease', map: 'seawall', at: [20, 30], text: 'A barrel of Board grease, old and hardened, marked by a small handprint.', check: { skill: 'notice', need: 6, text: "A child's hand. Nine or ten years old. Board engineers don't bring children up here." } },
  { id: 'sw_gull', map: 'seawall', at: [17, 31], text: "A lamp housing a gull's nest. The gull is real, and furious.", party: { courtesy: 'PLEASE REMAIN CALM. THE BIRD IS NOT REMAINING CALM.' }, check: { skill: 'shoot', need: 5, text: "You could. The gull knows it. It stares until you look away." } },
  { id: 'sw_stove', map: 'seawall', at: [23, 32], text: 'A fuel drum labeled: FOR THE PUMPS, NOT THE STOVE. The stove sits right next to it.', check: { skill: 'sneak', need: 4, text: 'Behind the stove, a tin of biscuits for the night patrol.', reward: { item: 'krill' } } },
  { id: 'sw_inspect', map: 'seawall', at: [14, 32], text: 'INSPECTION WEEKLY. The last stamp on the tag is four years old.', lore: 'board_forms' },
  { id: 'sw_hatch', map: 'seawall', at: [13, 40], text: 'HATCH 3. Painted on the inside: GOOD LUCK.', port: { 6: 'Up from here. Up to her.' } },
  { id: 'sw_jackets', map: 'seawall', at: [20, 41], text: 'Board life jackets, orange, all the wrong size.', check: { skill: 'notice', need: 5, text: 'One bears a name tag: HENDRIK. A joke from before he lay down.' } },
]);

// ---------------------------------------------------------------- Board Plaza

addDetails([
  { id: 'bp_crown', map: 'boardplaza', at: [23, 7], text: 'THE CROWN. Bronze letters, each a meter tall. The "O" is shaped like a pump wheel.', lore: 'the_crown' },
  { id: 'bp_allocation', map: 'boardplaza', at: [12, 8], text: "TODAY'S ALLOCATION.", party: { tova: 'as available. they wrote it down. they printed it.', sallis: 'Ample. Copy.' } },
  { id: 'bp_desks', map: 'boardplaza', at: [16, 8], text: 'A Board office window. Seven desks, seven chairs, one plant.', check: { skill: 'notice', need: 5, text: 'The plant is the only item on any desk. Nobody has worked here all week.' } },
  { id: 'bp_relief', map: 'boardplaza', at: [20, 8], text: 'A bronze relief. Workers lifting the Wall with their bare hands. Every face is identical.', lore: 'wall_built', port: { 6: 'All the same. Did they only have one model?' } },
  { id: 'bp_listens', map: 'boardplaza', at: [28, 8], text: 'THE BOARD LISTENS. A suggestion box. The slot has been welded shut.', lore: 'board_forms', party: { ambrose: 'A mouth sewn shut, labeled EAR.' } },
  { id: 'bp_chairs', map: 'boardplaza', at: [32, 8], text: 'The Chairs of the Board. Eight names in gold. The last is HALSEMA, T. No end date listed.', lore: 'board', check: { skill: 'notice', need: 4, text: 'The gold on the last name is brighter. They regild it every year.' }, port: { 6: 'Halsema. That is her name, too.' } },
  { id: 'bp_medical', map: 'boardplaza', at: [7, 11], text: 'BOARD MEDICAL, BRIM BRANCH. A sign reads: NO QUEUE. The Brim does not queue.' },
  { id: 'bp_volunteer', map: 'boardplaza', at: [11, 11], text: 'VOLUNTEER FOR BAILER MAINTENANCE. NO EXPERIENCE NECESSARY. NO SWIMMING NECESSARY.', check: { skill: 'notice', need: 5, text: 'Small print: Volunteers are not covered above the knee.' } },
  { id: 'bp_recovery', map: 'boardplaza', at: [39, 11], text: 'RECOVERY. A Hush cabinet sits in the window, locked and polished.', lore: 'recovery', party: { tova: "every can in there is for somebody like me. don't stand here." } },
  { id: 'bp_awards', map: 'boardplaza', at: [43, 11], text: 'A wall of Board awards. KEEP FATHOM DRY, thirty years running. Nobody else entered.' },
  { id: 'bp_seaair', map: 'boardplaza', at: [13, 10], text: 'BRIM FRESH. Bottled sea air, six gilt.', party: { tova: 'they bottled the wind. they actually bottled it.' }, port: { 6: 'Air in a bottle? Is it the sea?' } },
  { id: 'bp_coffee', map: 'boardplaza', at: [34, 10], text: 'Board coffee. KEEP FATHOM DRY on every cup. A free biscuit for staff.', check: { skill: 'hack', need: 5, text: 'Staff mode: 0, 0, 1, 1. The machine dispenses a biscuit. It is stale.', reward: { item: 'krill' } } },
  { id: 'bp_lilyturret', map: 'boardplaza', at: [15, 10], text: 'A turret housed in a brass casing shaped like a lily.', check: { skill: 'shoot', need: 6, text: 'Its line of sight covers the entire staircase. The plaza was clearly designed to serve this turret.' } },
  { id: 'bp_bench', map: 'boardplaza', at: [10, 13], text: 'A bench facing the Crown, intended for petitioners. A sign reads: WAIT HERE. Scratched beneath it: STILL WAITING. 1 YEAR.' },
  { id: 'bp_roses', map: 'boardplaza', at: [12, 14], text: 'Real roses, preserved from the salt air. A Board van delivers fresh replacements every morning.', reward: { gilt: 3 } },
  { id: 'bp_sandbags', map: 'boardplaza', at: [18, 14], text: 'Sandbags, new and white. They have never been wet.', party: { quaye: "Two hundred bags. Never filled with sand, I can tell by the slump. They're packed with foam." } },
  { id: 'bp_camera', map: 'boardplaza', at: [16, 16], text: 'A cold lamp equipped with a camera. The camera tracks you, just a beat behind.', check: { skill: 'sneak', need: 5, text: 'It operates on a timer, panning left to right in eleven seconds. You could cross the plaza in that window.' }, party: { sallis: "Eleven seconds. Go on my count." } },
  { id: 'bp_driver7', map: 'boardplaza', at: [8, 17], text: 'A Board car with the driver asleep at the wheel. His cap reads DRIVER 7.', check: { skill: 'sneak', need: 5, text: "On the passenger seat, a Board pen and a paper bag of Brim sweets.", reward: { item: 'boardpen' } } },
  { id: 'bp_bicycle', map: 'boardplaza', at: [37, 17], text: 'A Recovery van. In the back, inside a cage, a woken bicycle rings its bell softly.', lore: 'wakes', party: { courtesy: 'STAND CLEAR OF THE DOORS. THE BICYCLE IS STANDING CLEAR.' } },
  { id: 'bp_vent', map: 'boardplaza', at: [22, 20], text: 'A vent from Pump Hall. Warm air drifts out, carrying the scent of oil and something like rain.', port: { 6: "She's under us. Is she down there? Or up there?" } },
  { id: 'bp_screens', map: 'boardplaza', at: [14, 22], text: 'A junction box labeled BASIN SCREENS. Every screen in the basin is wired through here.', check: { skill: 'hack', need: 6, text: 'One line runs straight up to a desk in Pump Hall. ALL SCREENS. One switch.' } },
  { id: 'bp_basin', map: 'boardplaza', at: [12, 20], text: 'Over the rail, the Basin: Board water sits in a square pool far below, perfectly still.', lore: 'brim' },
  { id: 'bp_sea', map: 'boardplaza', at: [35, 20], text: 'Over the rail on the sea side: black water stretches to the horizon, marked by three boat lights.', lore: 'the_sea', port: { 6: "Is that the sea? It's so quiet from here." } },
  { id: 'bp_token', map: 'boardplaza', at: [33, 22], text: 'A Lockjaw toll token taped to a Board junction box. Nobody here knows what it is.', lore: 'lockjaws_toll', reward: { item: 'tolltoken' } },
  { id: 'bp_pigeons', map: 'boardplaza', at: [5, 26], text: 'A bench with a view of the basin. A clerk eats lunch here every day. The pigeons know her by her bag.' },
  { id: 'bp_armrest', map: 'boardplaza', at: [42, 26], text: 'A tiny Bailer is carved into the armrest, done very carefully with a Board pen.', lore: 'bailer_names', check: { skill: 'notice', need: 4, text: 'A name is scratched onto its foot: SLOOP.' } },
  { id: 'bp_scales', map: 'boardplaza', at: [20, 30], text: 'A bollard on the sea stair, crusted with dried fish scales. The old fish hall once stood here.', party: { ambrose: 'The fish hall. My grandmother sold herring here and spoke of it as a palace.' } },
  { id: 'bp_lilies', map: 'boardplaza', at: [36, 31], text: "A van labeled BRIM FLOWERS, packed with plastic lilies bound for the plaza's candle stalls." },
  { id: 'bp_lockedbin', map: 'boardplaza', at: [43, 33], text: 'A locked bin. On the Brim, even rubbish has a residence permit.' },
  { id: 'bp_deadletters', map: 'boardplaza', at: [4, 33], text: 'A Board bin marked DEAD LETTERS. Two envelopes inside, both stamped RETURNED.', scene: 'nq_letters_start', hideIf: 'quest:nq_letters' },
  { id: 'bp_hook', map: 'boardplaza', at: [41, 30], text: "A lamp with a courier drone's charging hook. Nothing is hanging from it tonight.", lore: 'couriers', when: 'drone_done' },
]);

// ---------------------------------------------------------------- The Crown

addDetails([
  { id: 'cw_chair1', map: 'crown', at: [21, 1], text: 'A portrait of the first Chair. HE BUILT THE WALL. Beneath it, scrawled in pencil: WITH HELP.', lore: 'board' },
  { id: 'cw_gold', map: 'crown', at: [3, 7], text: 'KEEP FATHOM DRY in gold leaf. The gold is real, somebody tested it with a knife.', check: { skill: 'strike', need: 5, text: 'A flake comes away under your thumbnail. Real gold.', reward: { gilt: 8 } }, party: { ignace: "Real gold. On a Board wall. Velt would weep." } },
  { id: 'cw_form1', map: 'crown', at: [7, 7], text: 'Board Form 1, framed: THE FOUNDING OF THE BOARD. Eleven signatures. Eleven, like the Bailers.', lore: 'board_forms' },
  { id: 'cw_managed', map: 'crown', at: [27, 7], text: 'A map of Fathom. The Deeps are colored blue and labeled MANAGED.', party: { tova: 'managed. we\'re managed. good to know.', sallis: 'Managed. Same word on every map.' } },
  { id: 'cw_engineers', map: 'crown', at: [31, 7], text: 'A plaque honoring the Bailer Project engineers. Forty names. H. QUAYE, ENGINEER, SECOND GRADE.', party: { quaye: 'She spelled it correctly. It was the first time anyone had.' } },
  { id: 'cw_lift', map: 'crown', at: [3, 9], text: 'A junction box labeled: LIFT. PUMP HALL. CHAIR ONLY.', check: { skill: 'hack', need: 6, text: 'For twenty years, the lift has stopped at an unlisted floor every week. That stop is called SUNDAY.' } },
  { id: 'cw_marble', map: 'crown', at: [6, 13], text: 'A marble pillar that sounds hollow when knocked. Board marble is actually painted concrete.', check: { skill: 'strike', need: 4, text: 'A single knock cracks the paint, revealing gray concrete beneath.' } },
  { id: 'cw_cake', map: 'crown', at: [29, 10], text: "A staff vending machine offering one cake: CHAIR'S CHOICE. Sold out.", check: { skill: 'tech', need: 5, text: 'The machine has never actually been stocked. The label was printed for a visit that never happened.' } },
  { id: 'cw_plastic', map: 'crown', at: [12, 11], text: 'Visitor chairs, never sat in. One still has its plastic wrap.' },
  { id: 'cw_shreds', map: 'crown', at: [30, 17], text: 'A bin filled with shredded blue paper: Board forms.', check: { skill: 'notice', need: 6, text: 'One strip is older than the rest: FORM 11. M. HALSEMA. AGE 9.' }, port: { 6: 'Nine. They recorded her age as nine.' } },
  { id: 'cw_desk', map: 'crown', at: [4, 18], text: 'The reception desk. A drawer full of keys, each bearing a tag.', scene: 'nq_clock_key', when: 'quest:nq_clock&!item:clockkey&!nq_clock_done' },
  { id: 'cw_orange', map: 'crown', at: [23, 20], text: 'A real orange tree in a planter. The only one in Fathom, and it has never borne fruit.', port: { 6: 'It wants to create something. It cannot. Not up here.' } },
  { id: 'cw_rope', map: 'crown', at: [21, 16], text: 'Brass posts and a velvet rope. Behind the rope, there is nothing but a clean floor.' },
]);

// ---------------------------------------------------------------- Pump Hall

addDetails([
  { id: 'ph_gauges', map: 'pumphall', at: [5, 1], text: 'Eleven gauges in a row, one for each Bailer. Ten needles move. One remains still. HENDRIK.', lore: 'bailers', port: { 6: 'One has stopped. The others keep going. Why?' } },
  { id: 'ph_names', map: 'pumphall', at: [9, 1], text: 'A brass board listing names: SLOOP. GERDA. HENDRIK. MARIGOLD. BIG WIM. Six more, polished smooth by thumbs.', lore: 'bailer_names' },
  { id: 'ph_plate', map: 'pumphall', at: [13, 1], text: "NO 1. The maker's plate on the Founding Pump. The date marks the week of the Flood.", lore: 'founding_pump' },
  { id: 'ph_droplog', map: 'pumphall', at: [25, 1], text: 'A logbook chained to the desk: DROP LOG, LINE 4, WARDEN. An entry has been made every month for forty years.', lore: 'warden' },
  { id: 'ph_photo', map: 'pumphall', at: [29, 1], text: 'A photo of the Bailer Project team taken in front of the pump, forty years ago. A young woman holds a slide rule.', party: { quaye: 'Don\'t.' }, check: { skill: 'notice', need: 5, text: 'Bottom left: a fourteen-year-old boy wearing a Board cap that is too big for him.' } },
  { id: 'ph_lines', map: 'pumphall', at: [12, 4], text: 'A junction box labeled: BAILER LINES 1 TO 6. A red tag hangs on line 6.', check: { skill: 'tech', need: 6, text: "Line 6 is Hendrik's. Switched off manually. The Board gave up on him." } },
  { id: 'ph_pipe', map: 'pumphall', at: [14, 7], text: 'A pipe as wide as a door, warm and ticking.', port: { 6: 'It ticks like her heart. Is that wrong?' } },
  { id: 'ph_oil', map: 'pumphall', at: [13, 10], text: 'A drum of oil for the Founding Pump. It consumes one drum a day.', party: { quaye: 'Two hundred liters a day. Same as forty years ago. Somebody\'s still paying for it.' } },
  { id: 'ph_vials', map: 'pumphall', at: [11, 15], text: 'A crate of empty Line 4 vials, stacked by month.', check: { skill: 'notice', need: 5, text: 'Four hundred and eighty of them. Forty years of the Warden.' }, party: { tova: "line 4. forty years of keeping something angry. poor thing." } },
  { id: 'ph_rags', map: 'pumphall', at: [25, 19], text: 'A barrel of oil-soaked rags, black and folded square. Someone here is tidy.' },
  { id: 'ph_chaironly', map: 'pumphall', at: [16, 21], text: 'A cold lamp shines over a sign: AUTHORIZED STAFF ONLY. CHAIR. NOBODY ELSE.' },
  { id: 'ph_lancet', map: 'pumphall', at: [35, 25], text: 'A crate addressed to SUNNY STEPS: ONE LANCET, CHILD SIZE.', port: { 6: 'Small. For Kees?' }, party: { tova: '...burn it.' } },
]);

// ---------------------------------------------------------------- The Seawalk

addDetails([
  { id: 'swk_gift', map: 'seawalk', at: [4, 8], text: 'A cold lamp with a brass plate: GIFT OF THE CHAIR. Every lamp along the path has one.', lore: 'brim' },
  { id: 'swk_cup', map: 'seawalk', at: [12, 8], text: 'A tin cup chained to the lamp. Rainwater. FOR THE WALKERS.' },
  { id: 'swk_clock', map: 'seawalk', at: [8, 11], text: 'A clock set into the planter wall, stopped at the hour of the Flood.', scene: 'nq_clock_start', hideIf: 'nq_clock_done' },
  { id: 'swk_bench', map: 'seawalk', at: [16, 9], text: 'A bench facing the sea. A plaque: FOR M., WHO LIKES THE WEATHER.', port: { 6: 'For her. She sat on it once.' } },
  { id: 'swk_pinks', map: 'seawalk', at: [28, 11], text: 'Sea pinks in a planter. The only flowers on the Brim that the wind cannot kill.' },
  { id: 'swk_ring', map: 'seawalk', at: [3, 19], text: 'A mooring ring forty meters above the sea. Nobody has tied a boat here since the Wall went up.', lore: 'wall_built' },
  { id: 'swk_telescope', map: 'seawalk', at: [25, 19], text: 'TELESCOPE, 1 GILT. The telescope is gone. The coin box is full.', check: { skill: 'strike', need: 5, text: 'The box pops open. Eight gilt. Nobody has emptied it since the telescope left.', reward: { gilt: 8 } } },
  { id: 'swk_drop', map: 'seawalk', at: [10, 20], text: 'The sea, black and churning. The Wall drops straight down into it.', lore: 'the_sea' },
  { id: 'swk_boats', map: 'seawalk', at: [24, 22], text: 'Far out, three boat lights. Board patrol, or fishermen, or neither.', port: { 6: 'Out there. Can we go?' } },
  { id: 'swk_lovers', map: 'seawalk', at: [14, 18], text: 'Names scratched into the rail, two by two. Brim lovers, and one from the Deeps: MOSS AND ANNA.' },
  { id: 'swk_bottles', map: 'seawalk', at: [21, 23], text: 'A bin overflowing with empty BRIM FRESH bottles. Someone bought the sea air and breathed it right here.' },
  { id: 'swk_soup', map: 'seawalk', at: [22, 26], text: 'A hatch in the wall marked: RING FOR SOUP. YOU WILL NOT GET SOUP.' },
  { id: 'swk_moths', map: 'seawalk', at: [18, 28], text: 'A sodium lamp, the only warm light on the Brim. Moths gathered from somewhere to find it.' },
  { id: 'swk_eleven', map: 'seawalk', at: [30, 26], text: 'A memorial to THE ELEVEN. Eleven bronze feet in a row, cast from the originals.', lore: 'ninety_tons' },
  { id: 'swk_ledge', map: 'seawalk', at: [32, 8], text: 'The end of the walk, where the rail stops and the drop begins.', check: { skill: 'athletics', need: 6, text: "You lean over the end of the rail. On the ledge below, a gull's nest built from discarded Board pens.", reward: { item: 'boardpen' } } },
  { id: 'swk_lights', map: 'seawalk', at: [6, 18], text: 'Feast lights strung along the rail, never taken down. Salt has turned every bulb green.' },
]);

// ---------------------------------------------------------------- The Board pump depot (gig map)

addDetails([
  { id: 'dp_pumps', map: 'depot', at: [5, 5], text: 'PUMPS. A spare motor on a stand. The DO NOT TAKE sign was gone, but the motor remained.', lore: 'depot', port: { 3: "A motor nobody took. Does it want to go somewhere?" } },
  { id: 'dp_shifts', map: 'depot', at: [13, 5], text: 'A shift board: DAY, NIGHT, NIGHT, NIGHT. The day shift was cut.', check: { skill: 'talk', need: 4, text: "A night worker says the day shift still comes in for the coffee. Unpaid. Habit." } },
  { id: 'dp_bell', map: 'depot', at: [6, 8], text: 'A parts counter with a bell. A note underneath reads: THE BELL DOES NOT WORK. NEITHER DO WE.', party: { ambrose: 'A bell that never rings, guarding a counter where no one works. A perfect institution.' }, reward: { gilt: 1 } },
  { id: 'dp_turret', map: 'depot', at: [9, 6], text: 'A depot turret, rusted at the base.', check: { skill: 'tech', need: 5, text: "The feed is cut. It's been dead for a year, and nobody noticed." } },
  { id: 'dp_junction', map: 'depot', at: [17, 10], text: 'The depot junction box. It keeps the Hush store downstairs cold.', lore: 'hush_can', check: { skill: 'hack', need: 5, text: 'The log shows forty crates of Hush shipped down Canal Six last month. None of them came back.' } },
  { id: 'dp_diesel', map: 'depot', at: [3, 12], text: 'Diesel for the pump motors. The smell clings to your clothes for a week.', party: { quaye: 'Diesel. Good for a Dry Plan. Bad for your lungs. Breathe through your mouth, kid.' } },
  { id: 'dp_sticker', map: 'depot', at: [14, 13], text: 'A forklift with a sticker: I BRAKE FOR GIANTS.' },
  { id: 'dp_gasket', map: 'depot', at: [24, 14], text: 'A crate of pump gaskets. One is a rubber ring, awake, breathing in and out.', port: { 3: 'A ring that breathes? Who woke a ring?' } },
  { id: 'dp_calendar', map: 'depot', at: [21, 9], text: 'OFFICE. A calendar on the door, four years old. No one has turned the page.', check: { skill: 'notice', need: 4, text: "Taped to the door beneath the calendar is a twenty-gilt note. Someone's emergency.", reward: { gilt: 20 } } },
  { id: 'dp_outlet', map: 'depot', at: [9, 17], text: 'A Board outlet churning brown water into the canal.', lore: 'ninety_tons' },
]);

// ---------------------------------------------------------------- Rook's houseboat (gig map)

addDetails([
  { id: 'hb_rook', map: 'houseboat', at: [13, 5], text: 'ROOK" spelled out in neon tubing on the cabin. Only the R and the K are still lit.', lore: 'rook' },
  { id: 'hb_porthole', map: 'houseboat', at: [17, 5], text: 'A porthole draped with a curtain made from a Board flag.', check: { skill: 'notice', need: 5, text: 'Behind the curtain, a jar of sea glass sits on the sill.', reward: { item: 'seaglass' } } },
  { id: 'hb_eels', map: 'houseboat', at: [9, 5], text: 'A barrel of live eels, looking miserable.', party: { ambrose: 'Behold, the eel. Struck from the menu, but not from the world.' } },
  { id: 'hb_cooler', map: 'houseboat', at: [9, 6], text: "A cooler marked EELS. It's too cold for eels.", lore: 'bought_blood', check: { skill: 'notice', need: 5, text: 'Beneath the ice, Line 9 vials packed tightly together.' } },
  { id: 'hb_table', map: 'houseboat', at: [14, 7], text: 'A table set for one: a plate, a knife, a tin of Board water, and a Census leaflet used as a coaster.' },
  { id: 'hb_ledgers', map: 'houseboat', at: [20, 7], text: "Ledgers written in code. The code is just Rook's handwriting.", check: { skill: 'notice', need: 6, text: 'Three Board clerks sell to Rook. Their initials appear on every page.' } },
  { id: 'hb_knot', map: 'houseboat', at: [9, 9], text: 'A mooring line secured with a Lockjaw knot.', lore: 'lockjaws_toll' },
  { id: 'hb_hook', map: 'houseboat', at: [10, 11], text: 'A deck lamp featuring a fishhook. The fish is long gone.', check: { skill: 'sneak', need: 5, text: "Inside the lamp housing sits a roll of gilt. Rook doesn't trust banks.", reward: { gilt: 12 } } },
  { id: 'hb_duck', map: 'houseboat', at: [7, 11], text: 'A rubber duck, now animated, circles the hull on watch.', port: { 3: 'It stands guard. But who woke it?' } },
  { id: 'hb_bottles', map: 'houseboat', at: [24, 6], text: 'Crates of empty bottles. Rook fills them with canal water and sells them up top as BRIM FRESH.' },
]);

// ---------------------------------------------------------------- Club Violet (gig map)

addDetails([
  { id: 'vi_hooks', map: 'violet', at: [16, 0], text: 'The stage wall is padded in violet, fitted with four hooks for leased voiceboxes. Three are empty.', lore: 'voicebox' },
  { id: 'vi_hum', map: 'violet', at: [9, 2], text: 'A wardrobe-sized speaker hums when no one is singing, ensuring the room never truly goes quiet.' },
  { id: 'vi_reserved', map: 'violet', at: [26, 2], text: 'A card on the table reads: RESERVED FOR MEVIUS. RESERVED. RESERVED.', lore: 'club_violet' },
  { id: 'vi_bar', map: 'violet', at: [3, 8], text: 'Gin is served in Board water bottles. A sign declares: WE DO NOT SERVE THE CHOIR. THE CHOIR DOES NOT ASK.' },
  { id: 'vi_tipjar', map: 'violet', at: [5, 5], text: 'A tip jar labeled "VOICEBOX REPAIR FUND" holds four coins of gilt.', check: { skill: 'talk', need: 4, text: "The barman says the fund is for Nienke. It's four hundred short. He says it like a joke." } },
  { id: 'vi_tonight', map: 'violet', at: [9, 5], text: 'NIENKE, TONIGHT ONLY. Every night has been "tonight only" for two years.' },
  { id: 'vi_drink', map: 'violet', at: [23, 9], text: 'A drink sweating on the table. Someone left mid-song.', reward: { gilt: 3 } },
  { id: 'vi_crack', map: 'violet', at: [20, 13], text: "A speaker with a cracked cone. Every singer sounds like they're about to cry." },
  { id: 'vi_lozenges', map: 'violet', at: [3, 15], text: 'A cigarette machine converted to sell lozenges.', check: { skill: 'tech', need: 5, text: 'One pack sticks in the coil. You shake it loose.', reward: { item: 'krill' } } },
  { id: 'vi_lease', map: 'violet', at: [21, 16], text: 'A plastic palm. A rolled-up voicebox lease is tucked into the soil.', check: { skill: 'notice', need: 5, text: 'An expired lease for a singer named Anke. Mevius kept it after she left.' } },
  { id: 'vi_peephole', map: 'violet', at: [25, 5], text: 'OFFICE. The peephole is installed on the wrong side of the door.', check: { skill: 'sneak', need: 5, text: 'From this angle, you can see into the office. A ledger, a lease, a cake.' } },
  { id: 'vi_signed', map: 'violet', at: [28, 0], text: 'Signed photos of singers. Every signature is written in the same hand.', party: { ignace: 'Mine are all in the same hand, too. It saves time.' } },
]);

// ---------------------------------------------------------------- Board Relay 4 (gig map)

addDetails([
  { id: 'rf_turret', map: 'rooftop', at: [11, 4], text: 'A turret guarding a box that counts people. The Board protects the count.', lore: 'relays' },
  { id: 'rf_pipes', map: 'rooftop', at: [5, 5], text: 'Kitchen pipes rise up from the Terraces. Each one carries the scent of a different dinner.', port: { 3: 'Dinners. Which one is ours?' } },
  { id: 'rf_vent', map: 'rooftop', at: [19, 5], text: 'A vent whistles a single note. Someone tuned it with a screwdriver.', check: { skill: 'tech', need: 5, text: 'Turn the screw, and it plays a second note. Two notes make nearly a song.' } },
  { id: 'rf_trap', map: 'rooftop', at: [7, 9], text: 'An empty pigeon trap sits under the roof lamp, its door ajar.', check: { skill: 'athletics', need: 5, text: "Past the trap, on the roof's edge, is a nest woven from relay wire. The pigeons collect Board parts." } },
  { id: 'rf_counters', map: 'rooftop', at: [6, 12], text: 'Crates of relay parts: COUNTERS, 12. Beneath it: WE ARE ALSO 12.', check: { skill: 'notice', need: 4, text: 'One crate is missing a counter. Someone took one home. The Board will count the counters.' }, party: { sallis: 'Counters. Every one is a street someone cannot walk.' } },
  { id: 'rf_tomato', map: 'rooftop', at: [18, 12], text: "A rain barrel holds a floating tomato. It's from Terrace 4.", reward: { item: 'tomato' } },
  { id: 'rf_fuel', map: 'rooftop', at: [19, 12], text: "Fuel for the relay generator. A week's worth of counting." },
  { id: 'rf_wrappers', map: 'rooftop', at: [4, 15], text: 'A bin of Line 2 sweet wrappers. The relay techs eat joy on the night shift.', reward: { gilt: 2 } },
  { id: 'rf_count', map: 'rooftop', at: [20, 15], text: 'RELAY 4. COUNT: 41,208.', lore: 'relays', check: { skill: 'hack', need: 6, text: "Alter a single digit, and two hundred people will cease to exist. The Board won't notice for a month." } },
]);
