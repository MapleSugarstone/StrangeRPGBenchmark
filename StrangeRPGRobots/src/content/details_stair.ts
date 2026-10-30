// Details, lore, and small quests for the Stair: the Lantern Steps, the plaza, the Terraces, Mercy Spire, the
// Church, the crypt, the Census, Lost Property, Sunny Steps, the Overlook, and the gig maps up here.
// Scenes for the small quests: src/script/niche_upper.txt. Style reference: details_market.ts.
import { addDetails, addLore } from './details';
import { addItems } from '../rules/data';
import { addLoot } from './loot';
import { addQuests } from './quests';

addItems([
  { id: 'prayercard', name: 'Prayer Card', kind: 'junk', price: 4, stack: true, desc: 'First printing. SHE RAISED HER HAND on the front. On the back, part of a recipe.' },
  { id: 'kettle', name: 'Singing Kettle', kind: 'junk', price: 40, desc: "A tin kettle, woken long ago, that sings when someone nearby is sad. It's singing now." },
  { id: 'brassring', name: 'Brass Ring', kind: 'junk', price: 6, stack: true, desc: 'Sold by the bag. Blessed by no one.' },
  { id: 'medallion', name: 'Saint Medallion', kind: 'junk', price: 2, stack: true, desc: 'Tin. A girl with her hand raised. Different girl in every batch.' },
  { id: 'boardpen', name: 'Board Pen', kind: 'junk', price: 3, stack: true, desc: 'PROPERTY OF THE FATHOM WATER BOARD. DO NOT REMOVE. Writes in blue.' },
]);

addLoot({
  nook_steps: { items: [['stim', 1, 1], ['brassring', 2, 0.8], ['krill', 2, 0.6]], gilt: [15, 40] },
  nook_terraces: { items: [['tomato', 3, 1], ['plumcake', 1, 0.6], ['medallion', 2, 0.7]], gilt: [10, 30] },
  nook_crypt: { items: [['candle', 3, 1], ['bigstim', 1, 0.5], ['prayercard', 1, 0.5]], gilt: [20, 50] },
  nook_overlook: { items: [['boardpen', 2, 1], ['stim', 1, 0.7], ['chip', 1, 0.4]], gilt: [15, 35] },
});

addLore([
  { id: 'raised_hand', title: 'The Church of the Raised Hand', text: "Built post-Flood from stone, then concrete. It holds the Saint's statue, feast, and candle trade. Archdeacon Velt has run it for twenty years." },
  { id: 'saint_story', title: 'The Saint, as the people tell it', text: "A nine-year-old from Pell Market raised her hand during the Flood. Bailers rose, but she drowned saving them. This is the Church's official story, printed on every card." },
  { id: 'candles', title: 'Two gilt per candle', text: 'The price of a plaza candle has remained two gilt since the Church opened. White, unscented, and lit in her honor. The Church sells roughly four thousand a week.' },
  { id: 'feast', title: 'The Feast of the Raised Hand', text: 'Once a year, the Stair hangs lanterns on its rails and parades the statue around the plaza. The Lantern Steps are named for this. The Deeps also host a feast, with fewer lanterns and more water.' },
  { id: 'church_board', title: 'The Church and the Board', text: "The plaque on the church thanks the citizens of Fathom and the Fathom Water Board. The Board's name was added nine years after the stone was laid, in smaller letters and newer bolts." },
  { id: 'choir_terraces', title: 'The Choir', text: 'A congregation on the Terraces that rejects chrome. They raise their children without ports, sing nine verses each night, and remove any wire from those who come home wearing one. They can hear chrome. They say it sings wrong.' },
  { id: 'choir_bell', title: 'Choir bells', text: 'Every child in the Choir receives a handbell with no clapper. You ring it by thinking. Runaways sell them in Deeps pawnshops, where they fetch less than the brass is worth.' },
  { id: 'nine_verses', title: 'The Nine Verses', text: 'The Choir sings nine verses for the dry and the drowned. There was once a tenth. It was cut the year the Board built Sunny Steps. Old members still hum where it used to go.' },
  { id: 'census_office', title: 'The Census Office', text: 'Every child in Fathom is tested at six. A drop of blood on a paper strip. A curling strip means witch blood, a Line number, and a file. Files are kept by street. The Census has never lost one.' },
  { id: 'form_11', title: 'Board Form 11', text: 'Board custody protects minors and the city. Three copies go to Census, Recovery, and home. A fourth, mostly blank parent copy is added later.' },
  { id: 'lines', title: 'The Lines', text: 'The Census grades witch blood by Line, one to nine. Each Line wakes things differently: Line 2 makes them glad, Line 4 angry, Line 6 scared, and Line 9 calm and slow. Line 1 was retired forty years ago. Nobody says why.' },
  { id: 'wakes', title: 'Woken things', text: 'Witch blood wakes objects. They breathe, move, want. Most last a week. Some years. Deeps folks say a woken thing stops when it reaches its goal.' },
  { id: 'bought_blood', title: 'Bought blood', text: "Wakes sell on Lantern Steps: a dancing washer for a week, an umbrella walking you home. Blood sold as Board-bought. It isn't, usually. Nobody on the Steps asks." },
  { id: 'hush_can', title: 'Hush', text: 'Hush is Board-grade freeze spray. Sprayed on a woken thing, it puts it into a permanent, cold sleep. It costs forty gilt a can on the street, though Recovery carries it by the crate.' },
  { id: 'recovery', title: 'Board Recovery', text: 'The Board office that retrieves woken property and wild witches. Its officers carry Hush and a binder of protocols. They are called tappers, for the lancet. Procedure eleven covers custody.' },
  { id: 'bodywell', title: 'Bodywell', text: "YOUR BODY, YOUR PLAN. Bodywell leases chrome limbs: arms, knees, eyes, voiceboxes. Missed payments trigger demo mode. After three strikes, the repo crew comes for the part, no matter where it's attached." },
  { id: 'free_tier', title: 'The free tier', text: 'A free-tier Bodywell eye displays advertisements interspersed with public-domain text, which costs nothing to license. This mostly consists of very old dictionaries.' },
  { id: 'voicebox', title: 'Voicebox leases', text: 'A leased voicebox belongs to the leaseholder, not the person singing through it. Club managers on the Steps hold the leases for half their singers.' },
  { id: 'lantern_steps', title: 'The Lantern Steps', text: "Three tiers of clubs, bars, and karaoke spots crown the Grand Lock's upper gate. It's the Stair's nightlife hub and a paywalled gateway for Deeps visitors. Expect rain and neon." },
  { id: 'grand_lock', title: 'The Grand Lock', text: 'The gate separating the Deeps from the Stair. The upper gate opens for boats with a pass and for pedestrians with a gilt. The year the gate was built is scratched out on its plate.' },
  { id: 'terraces', title: 'The Terraces', text: "Four terraces climb the hill below Mercy Spire. They are home to families from the Deeps who've moved up a level, gardens under Board grow lamps, and the Choir at the summit. Terrace 4 grows the best tomatoes in Fathom." },
  { id: 'grow_lamps', title: 'Board grow lamps', text: "Illuminating the terrace gardens is a privilege reserved for the Stair residence, powered by the Board's meter. But when a terrace displeases the Board, the meter runs dry." },
  { id: 'bin_racing', title: 'Bin racing', text: "Kids race wheeled bins down Terrace 4's ramps to Terrace 1. A drop of cut Line 6 makes bins scared. Scared bins are fast. Racing is banned. The ban is painted on the ramp, beneath the tire marks." },
  { id: 'blessing_rings', title: 'Blessing rings', text: 'Brass rings sold on the plaza to keep a house dry, each blessed by a deacon. Brother Ignace sells them for a hundred gilt, then buys them back by the bag.' },
  { id: 'the_flood', title: 'The Flood', text: 'Forty years ago, the sea breached the old wall in one night. The low city became the Deeps. The Board built the Wall, and the Bailers left the canals that same week. Every Terrace house still bears the line.' },
  { id: 'old_fathom', title: 'Before the Flood', text: 'Old murals depict one terrace and a harbor where the Deeps lie now. Fish markets once lined the water, with ferries to the islands. Those islands are absent from any Board map.' },
  { id: 'sunny_steps', title: 'Sunny Steps', text: "A Board home on the Terraces houses children in custody. Clean beds, hot food, and a seven o'clock choir. Visitors arrive Sundays at two bells. The children are told they're helping the city." },
  { id: 'mercy_spire', title: 'Mercy Spire', text: "Board Medical's tower rises above the Terraces. Floors one through nine are open to visitors. Floors ten through forty-four require a Board pass. | The elevator passes the forty-fourth floor without ever stopping." },
  { id: 'lost_property', title: 'Lost Property', text: 'The Board warehouses confiscated woken artifacts. Unclaimed items are auctioned off or destroyed after ninety days. The ledger marks woken beings as BREATHING, with a checkbox.' },
  { id: 'velt', title: 'Archdeacon Velt', text: "He has served as Archdeacon of the Raised Hand for twenty years. Kind to pilgrims and well-connected with the Board, he owns two boats. | On feast day, he shakes everyone's hand, though he wears gloves to do so." },
  { id: 'soup_hand', title: 'Soup at the Hand', text: "The Church's soup kitchen on Lantern Steps is free for anyone willing to pray. The deacon never checks. On good days, the soup is eel. On the others, it's the idea of eel." },
  { id: 'pell_rain', title: 'Pell Market Rain', text: 'A Deeps song about a woman selling umbrellas in a city where it rains constantly, yet nobody buys any. Everyone knows the first three verses, but nobody agrees on the fourth.' },
  { id: 'eel_soup', title: 'Eel soup, Deeps style', text: 'One eel, one onion, rainwater from the roof boiled twice, a spoonful of vinegar, and salt from the Board ration. Cook until the eel gives up. Serve to anyone at the door.' },
  { id: 'tomato_bread', title: 'Tomato on loaf', text: 'Slice a Terrace 4 tomato onto synth loaf, salt it, and leave it in the rain for exactly one minute. The Terraces insist the timing is crucial.' },
  { id: 'relays', title: 'Board relays', text: "Grey boxes on the Stair's roofs count every port that walks past, sending the data to the Census. Those who wish to remain uncounted walk the east stairs during relay maintenance nights." },
  { id: 'dry_permit', title: 'Stair residence', text: 'A Stair residence permit costs more than most Deeps families earn in three years, with the Board adding a separate fee for the application form. Deeps children save for it in jars labeled DRY.' },
  { id: 'club_violet', title: 'Club Violet', text: 'Upper Steps club with violet lights and leased singers. Manager Mevius holds voicebox leases. The bar dilutes gin with Board water, its purest ingredient.' },
  { id: 'medallions', title: 'Saint medallions', text: "Tin Saint medallions cost two gilt each. The Church changes molds per batch, ensuring unique faces. No living soul has seen her true face, only the statue's incorrect hair." },
]);

addQuests([
  {
    id: 'nq_cards', title: 'Prayer Cards', kind: 'side', xp: 120,
    stages: { '1': 'Plaza candle sellers buy first-printing prayer cards. People leave them everywhere: planters, shelves, Spire gate. Six remain.', done: 'The prayer cards have found a home.' },
    where: { '1': ['plaza', 'statue_view'] },
  },
  {
    id: 'nq_kettle', title: 'The Kettle', kind: 'side', xp: 100,
    stages: { '1': 'A woken kettle on a Steps windowsill sings when someone nearby is sad. Its tag reads: MEVROUW LINDEMAN, TERRACE 2.', done: 'The kettle had found who it was looking for.' },
    where: { '1': ['terraces', 'lind_front'] },
  },
  {
    id: 'nq_hunt', title: 'Chalk Riddles', kind: 'side', xp: 150,
    stages: {
      '1': 'Chalk scrawled on a plaza planter: WHERE LINE TWO SELLS JOY, LOOK UNDER THE BOARD WITH NO KING.',
      '2': 'Chalk beneath a Steps table: FOUR UP, WHERE THE MINT IS NOT MINT.',
      '3': 'Chalk on a Terrace 4 planter: WHERE THE DEEPS LOOK SMALL, SIT WHERE TWO SIT.',
      done: "You've reached the end of the chalk trail.",
    },
    where: { '1': ['steps', 'noodle_front'], '2': ['terraces', 'garden'], '3': ['overlook', 'bench'] },
  },
  {
    id: 'nq_bet', title: 'Sloop or Gerda', kind: 'side', xp: 60,
    stages: { '1': 'Mevrouw Haas takes bets on the Overlook: which Bailer reaches the canal bend first.', done: 'The bet has been settled.' },
    where: { '1': ['overlook', 'haas_front'] },
  },
  {
    id: 'nq_song', title: 'Pell Market Rain', kind: 'side', xp: 120,
    stages: {
      '1': 'A busker on the lower Steps sings Pell Market Rain but stops before the fourth verse, explaining that the Choir has one version and the crypt has another.',
      '2': 'You have the fourth verse. The busker wants to hear it.',
      done: 'The busker now sings all four verses.',
    },
    where: { '1': ['crypt', 'start'], '2': ['steps', 'busker_front'] },
  },
  {
    id: 'nq_44', title: 'Forty-Four', kind: 'side', xp: 100,
    stages: { '1': 'A woken lift button in Mercy Spire insists on stopping at floor forty-four.', done: "It got what it wanted, or it didn't." },
    where: { '1': ['spire', 'lift_out'] },
  },
]);

// ---------------------------------------------------------------- The Lantern Steps

addDetails([
  { id: 'st_vend11', map: 'steps', at: [11, 6], text: 'A vending machine selling one item: KEEP FATHOM DRY bottled water. Nine gilt. | The Deeps get theirs from the sky.', party: { tova: 'nine gilt for water. up here, they sell you the rain.' }, check: { skill: 'tech', need: 5, text: 'The coin slot is jammed with a folded Board pass. Someone tried to pay with their job.' } },
  { id: 'st_vend34', map: 'steps', at: [34, 6], text: 'The machine hums in an unpleasant key. Its glass is fogged from the inside.', port: { 3: 'It hums. Is it awake? Is it sad?', 5: 'It hums the same note all night. I know that tune.' }, check: { skill: 'hack', need: 5, text: 'Its stock list runs on a Board relay. Item four: SORROW, UNRESTOCKED.' } },
  { id: 'st_dumpster', map: 'steps', at: [42, 6], text: 'A dumpster with a padlock on the lid. Someone on the Stair locks their trash.', check: { skill: 'strike', need: 5, text: 'One hit and the hasp gives. Under the bags, a box of Line 9 vials. All empty. All rinsed.' } },
  { id: 'st_crates', map: 'steps', at: [43, 4], text: 'Two crates stamped "BOUGHT BLOOD," "FRAGILE," and "THIS WAY UP." Both are upside down.', lore: 'bought_blood', party: { tova: "mine. don't. they're empty anyway." }, port: { 3: "Bought blood. Bought from who?" } },
  { id: 'st_junc41', map: 'steps', at: [41, 4], text: 'A junction box with a hand-painted warning: DO NOT TOUCH. TOUCHED ONCE. BAD.', check: { skill: 'tech', need: 6, text: 'Somebody has wired a doorbell to it. When the Board cuts the alley power, a bell rings in a flat upstairs.' } },
  { id: 'st_alleybin', map: 'steps', at: [45, 5], text: 'A bin full of severed glove fingers. Long gloves, the Brim kind.', port: { 3: 'Fingers. Empty ones. Whose hands?' }, party: { tova: "...okay, that's my bin. stop looking in my bin." } },
  { id: 'st_speaker', map: 'steps', at: [54, 10], text: 'A speaker stack from a club that closed. It still plays when it rains. Only the bass.', check: { skill: 'notice', need: 5, text: 'The bass line is a Bailer walking. Four beats, a rest, four beats. Somebody recorded one.' } },
  { id: 'st_forklift', map: 'steps', at: [44, 12], text: 'A forklift with "KEEP FATHOM DRY" scratched off. Somebody stenciled "KEEP" back on.', check: { skill: 'athletics', need: 5, text: 'From the cab roof, you can see the whole alley and a back door with no lock.' } },
  { id: 'st_fuel', map: 'steps', at: [52, 13], text: 'A fuel drum with a lit candle perched on top. No one in the alley finds this alarming.', party: { courtesy: 'PLEASE KEEP OPEN FLAMES AWAY FROM. AWAY FROM. PLEASE.', quaye: 'Ninety liters, by the slosh. One candle. Move along, kid.' } },
  { id: 'st_car46', map: 'steps', at: [46, 13], text: 'A wheelless car propped up on bricks. Someone lives in it. A curtain hangs over the windshield.', check: { skill: 'sneak', need: 5, text: 'Under the seat, a tin of buttons sorted by color. One is a gilt button someone sewed onto a coat.', reward: { gilt: 3 } } },
  { id: 'st_noodle4', map: 'steps', at: [4, 13], text: 'A noodle stall with a single stool. The cook hangs his apron on a nail, a Bailer rivet.', port: { 3: 'A piece of one? Does it hurt?' }, party: { quaye: 'Rivet off Big Wim. Number nine, left knee. They just drop them.' } },
  { id: 'st_pawn', map: 'steps', at: [4, 16], text: 'PAWN. In the window: a wedding ring, a chrome thumb, a hand bell with no clapper.', lore: 'choir_bell', check: { skill: 'notice', need: 4, text: 'The chrome thumb bears a Bodywell serial number. Its lease expired while it sat in the window.' }, port: { 3: "A bell that doesn't ring? What's it for?" } },
  { id: 'st_saints', map: 'steps', at: [16, 16], text: 'SAINTS BLOOD painted over SAINTS BREAD. The bakery closed when the clinic opened.', port: { 3: 'Blood. Bread. Which one do they want?' }, check: { skill: 'talk', need: 5, text: 'A woman on the steps says the bakery oven is still kept in the back. She lights it up for feast days, just for the fun of it.' }, party: { ignace: "Saints Blood. I wish I'd thought of that." } },
  { id: 'st_noodlesign', map: 'steps', at: [28, 16], text: 'The menu lists three items, with a fourth crossed out so violently that the board tore. You can still make out the word: EEL.', party: { ambrose: 'Eel. Struck from the record. A cruel fate for such a noble fish.' } },
  { id: 'st_pills', map: 'steps', at: [36, 16], text: 'PILLS. The pharmacist keeps a list on his door of who owes him. Half the Steps are on it, written in pencil.', check: { skill: 'notice', need: 5, text: 'Opal is on it. Twice. Once crossed out, once not.' }, party: { ignace: "He sold me a cure for lying once. Two gilt. It didn't work." } },
  { id: 'st_bodywell', map: 'steps', at: [48, 16], text: 'BODYWELL. YOUR BODY, YOUR PLAN. A sign in the window reads: REPOSSESSIONS TODAY, 14.', lore: 'bodywell', party: { ambrose: 'Fourteen. They post it like the weather.' } },
  { id: 'st_banned', map: 'steps', at: [44, 16], text: 'A list taped to the karaoke door: SONGS BANNED IN BOX 7, BY ORDER OF THE MIC. Every single one of them is happy.' },
  { id: 'st_notice20', map: 'steps', at: [20, 16], text: 'A Board notice read: STAIR RESIDENTS ONLY AFTER TWELFTH BELL. Chalk written beneath it said: WE ARE ALL STAIR RESIDENTS. WE LIVE ON STAIRS.', lore: 'dry_permit' },
  { id: 'st_umbrella', map: 'steps', at: [14, 17], text: 'A vending machine selling paper umbrellas. Two gilt. They last through one rain.', port: { 3: 'Paper for rain? Does that even work?', 5: 'I want one. Is that allowed?' }, check: { skill: 'notice', need: 4, text: 'One ticket is stuck halfway out of the slot, paid for, but never taken.', reward: { gilt: 2 } }, party: { sallis: "Paper. Useless. Buy two." } },
  { id: 'st_sweets', map: 'steps', at: [24, 20], text: 'Line 2 sweets. "JOY IN EVERY BITE." In small print: "NO BLOOD USED. TASTE MAY VARY.', lore: 'lines', check: { skill: 'notice', need: 5, text: "The sweets are pink. Line 2 is pink on the Census charts. Someone upstairs thinks that's funny." } },
  { id: 'st_chess', map: 'steps', at: [5, 24], text: 'A table with a chessboard painted on it. Someone has drawn a Bailer on every black square.', check: { skill: 'notice', need: 4, text: 'The board has no kings. Both were drawn over with Bailers.' } },
  { id: 'st_hunt2', map: 'steps', at: [6, 24], text: 'Chalk under the chair, upside down.', scene: 'nq_hunt_2', when: 'quest:nq_hunt&!quest:nq_hunt=2' },
  { id: 'st_tomato', map: 'steps', at: [35, 21], text: 'A planter holding a single tomato plant and a sign: "PROPERTY OF TERRACE 4. STOLEN BY TERRACE 2. RETURNED NEVER.' },
  { id: 'st_card', map: 'steps', at: [9, 22], text: "A prayer card pushed into the planter's soil, face up: \"SHE RAISED HER HAND.", reward: { item: 'prayercard', flag: 'pcard_steps' } },
  { id: 'st_steam', map: 'steps', at: [25, 23], text: 'Steam rising from the baths below, smelling of soap and old pipes.', port: { 3: 'Warm. Is it breathing?' } },
  { id: 'st_box7', map: 'steps', at: [47, 23], text: 'BOX 7. SAD SONGS ONLY. THE MIC DECIDES.', party: { quaye: 'Box 7 is forty an hour. Box 6 is thirty. Box 6 has no mic.' }, check: { skill: 'talk', need: 4, text: 'The renter claims Box 7 is booked every night by someone who never shows up.' } },
  { id: 'st_fern', map: 'steps', at: [38, 23], text: 'A dead fern sits in a Board planter. Its tag reads WATER WEEKLY, though the rain has been drenching it daily.' },
  { id: 'st_tovabin', map: 'steps', at: [48, 27], text: 'A bin. Deeply scratched into its lid: TOVA WAS HERE.', party: { tova: "that's not me. i spell it better." } },
  { id: 'st_gilt', map: 'steps', at: [14, 30], text: 'GILT. A moneylender. The door features three locks and a bell that plays the Board anthem.', check: { skill: 'notice', need: 5, text: 'One of the three locks is merely painted on.' }, party: { ambrose: "Three locks, two of them real. An honest proportion, for a lender." } },
  { id: 'st_soup', map: 'steps', at: [34, 30], text: 'SOUP AT THE HAND. Free if you pray. The queue consists mostly of people who have already prayed.', lore: 'soup_hand', party: { ignace: 'Free if you pray. I prayed there for eleven years. I ate well.' }, port: { 3: 'Free if you pray. What exactly is praying?' } },
  { id: 'st_baths', map: 'steps', at: [50, 30], text: 'BATHS. One gilt for hot, half for warm, free for Bailer water. Nobody takes the free option.', party: { quaye: 'Bailer water is canal water. Ninety tons a minute. Nobody wants it hot.' } },
  { id: 'st_kettle', map: 'steps', at: [42, 30], text: 'A tin kettle sits on the windowsill, breathing. It hums a very quiet song.', scene: 'nq_kettle_start', hideIf: 'nq_kettle_started' },
  { id: 'st_vend52', map: 'steps', at: [52, 31], text: 'A Choir sticker on the vending machine glass reads: CHROME IS A LIE. Someone has added: SO IS THIS MACHINE.', check: { skill: 'hack', need: 6, text: 'It is wired to dispense double change on Tuesdays. Today might be Tuesday.', reward: { gilt: 6 } }, lore: 'choir_terraces' },
  { id: 'st_terminal', map: 'steps', at: [13, 31], text: 'LANTERN STEPS INFORMATION. Every page loads the same weather report: DRY.', check: { skill: 'hack', need: 5, text: 'Behind the weather page, a staff page: FLOOD READINESS, STEPS. Nine names. Nine keys. Three are dead.' }, lore: 'lantern_steps' },
  { id: 'st_boardcar', map: 'steps', at: [15, 33], text: 'A Board car is parked in the clean channel. The fine on its windscreen is issued by the Board, payable to the Board.', port: { 3: 'They fine themselves? Why?' } },
  { id: 'st_taxi', map: 'steps', at: [49, 33], text: 'A taxi sits with its meter running and no driver. It reads 4,402 gilt.', party: { quaye: 'Four thousand four hundred and two. Roughly nine gilt a day for forty years.' } },
  { id: 'st_cart', map: 'steps', at: [23, 39], text: 'Beneath the Lock bridge, the canal holds a shopping cart standing upright in the water.', port: { 3: 'It waits. For what?', 5: 'I know that. Waiting.' }, check: { skill: 'athletics', need: 6, text: 'You hook it out with your foot. Inside, a jam jar labeled DRY holds two gilt coins.', reward: { gilt: 2 } } },
  { id: 'st_kfd', map: 'steps', at: [12, 43], text: 'The words KEEP FATHOM DRY are painted in letters a meter tall. Beneath the Y, someone painted a tiny door complete with a tiny knocker.', check: { skill: 'athletics', need: 6, text: 'You climb up the Y. Behind the painted door lies a real hole, and a sweet in a wrapper.', reward: { item: 'krill' } }, port: { 3: 'A door meant for something small. Who lives there?' } },
  { id: 'st_wishbin', map: 'steps', at: [36, 41], text: 'A bin by the bridge bears a sign: FOR WISHES. It is filled with coins. No one has ever taken any.', check: { skill: 'notice', need: 5, text: 'They are all Deeps coins. People from up here do not make wishes.' }, party: { courtesy: "THIS AREA IS MONITORED. THE WISHES ARE SAFE." }, port: { 3: 'What is a wish? Is it simply wanting?', 5: 'A wish is wanting, spoken aloud. I have one.' } },
  { id: 'st_lockplate', map: 'steps', at: [34, 36], text: 'A brass plate reads: GRAND LOCK, UPPER GATE. BUILT IN THE YEAR OF THE FLOOD. The year has been scratched out.', lore: 'grand_lock' },
  { id: 'st_flowers', map: 'steps', at: [3, 41], text: 'Plastic flowers wired to a timer. At six bells, they open.', port: { 3: 'Do they want to open, or do they have to?' }, check: { skill: 'tech', need: 4, text: 'The timer is set for the feast hour, not six bells. Someone resets it every year.' } },
  { id: 'st_tinbird', map: 'steps', at: [6, 36], text: 'A pigeon nest in the lamp. The bird is a tin pigeon, woken and warm from the bulb.', lore: 'wakes', party: { courtesy: 'THIS AREA IS MONITORED. THE BIRD IS ON DUTY.' } },
  { id: 'st_nook', map: 'steps', at: [20, 30], text: 'There is a gap in the terrace wall, hidden behind a Line 2 poster. Someone keeps a box there.', check: { skill: 'notice', need: 4, text: 'Scratched inside are the words: RUNNERS ONLY. A runner left the box for the next one.' } },
]);

// ---------------------------------------------------------------- The Plaza of the Raised Hand

addDetails([
  { id: 'pz_feast', map: 'plaza', at: [11, 7], text: 'A poster reads: THE FEAST OF THE RAISED HAND. LANTERNS AT DUSK. Someone has drawn a second hand, waving.', lore: 'feast', check: { skill: 'talk', need: 4, text: "A pilgrim says the deacon's own daughter drew the second hand. He decided to leave it up." } },
  { id: 'pz_stone', map: 'plaza', at: [15, 7], text: 'The church wall is pale stone up to head height, then gray concrete above. They ran out of stone in the second year.', lore: 'raised_hand', port: { 3: 'Stone, then not stone. Did they run out?' } },
  { id: 'pz_prayers', map: 'plaza', at: [19, 7], text: 'A box is nailed to the wall: PRAYERS, WRITTEN. The top note says: PLEASE LET THE BAILERS KEEP GOING. ALSO MY KNEE.', party: { ambrose: 'A fellow sufferer. The knee is the most theological of joints.' } },
  { id: 'pz_carving', map: 'plaza', at: [27, 7], text: 'Carved into the stone at knee height are the initials M.H. and T.H. They are very old. The masons left them there.', port: { 3: 'Letters. Whose?', 4: 'Those letters. They pull.' }, check: { skill: 'notice', need: 6, text: 'Both cuts were made by the same small hand. A single child carved both names.' } },
  { id: 'pz_plaque', map: 'plaza', at: [31, 7], text: "A plaque: RAISED BY THE GRATEFUL CITIZENS OF FATHOM AND THE FATHOM WATER BOARD. The Board's name is printed in smaller text.", lore: 'church_board', check: { skill: 'notice', need: 5, text: 'The Board line was added later. Its bolts are newer and still bright.' } },
  { id: 'pz_sum', map: 'plaza', at: [35, 7], text: 'Graffiti: TWO GILT A CANDLE. FORTY YEARS. DO THE SUM.', lore: 'candles', party: { ignace: "Twenty-nine thousand. I calculated it at my mother's grave." } },
  { id: 'pz_census', map: 'plaza', at: [5, 13], text: 'CENSUS. A brass slot in the door for returning forms. Someone has pushed a flower through it.', lore: 'census_office', party: { tova: "they won't keep it. they never keep anything." } },
  { id: 'pz_lilies', map: 'plaza', at: [12, 9], text: 'White lilies, the Saint\'s flower. Board plastic. They never close.', party: { tova: "plastic. they don't even let the flowers wilt up here." } },
  { id: 'pz_bee', map: 'plaza', at: [35, 9], text: 'Lilies. One is real. There is a bee on it, also real, and also lost.', port: { 3: 'Is the bee lost? How do you know?' } },
  { id: 'pz_ribbons', map: 'plaza', at: [14, 15], text: 'A lamp post wrapped in prayer ribbons. Each ribbon bears a name and a Line number.', lore: 'lines', check: { skill: 'notice', need: 5, text: 'Line 1 appears only on the oldest ribbon, faded to nearly white.' }, port: { 3: 'Names on the ribbons. Is hers there?' } },
  { id: 'pz_camera', map: 'plaza', at: [34, 15], text: 'A lamp with a Board camera mounted beneath it. A prayer ribbon is tied over the lens.', party: { sallis: 'Board camera. Offline. The ribbon helps.' } },
  { id: 'pz_stubs', map: 'plaza', at: [4, 19], text: 'A bin full of candle stubs. Some are still warm. One is almost intact.', reward: { item: 'candle' }, party: { courtesy: "PLEASE DISPOSE OF FLAMES RESPONSIBLY. IT IS WARM. THANK YOU." } },
  { id: 'pz_butts', map: 'plaza', at: [8, 17], text: 'A planter where the patrol officer stubs out his cigarettes. Nineteen butts.', party: { quaye: "Nineteen rounds. Ninety seconds each. He's slow on the corners." } },
  { id: 'pz_chair', map: 'plaza', at: [20, 17], text: 'A folding chair facing the statue. A note reads: SAVED FOR MEVROUW BRINK. SUNDAYS.', check: { skill: 'notice', need: 5, text: 'The tape is fresh. Someone saves it every week.' } },
  { id: 'pz_coins', map: 'plaza', at: [21, 20], text: 'Coins pushed into the planter soil, edge-first, like seeds.', reward: { gilt: 4 }, port: { 3: 'Coins in the dirt. Will they grow?' } },
  { id: 'pz_rivet', map: 'plaza', at: [27, 20], text: 'A Bailer rivet embedded in the soil, marked with a stick label: GROW.', check: { skill: 'strike', need: 6, text: "You might try prying it out with a boot heel, but it won't budge. It has taken root." } },
  { id: 'pz_hunt1', map: 'plaza', at: [21, 24], text: 'Chalk scrawled on the planter rim. A riddle, written in neat hand.', scene: 'nq_hunt_1', hideIf: 'quest:nq_hunt' },
  { id: 'pz_card', map: 'plaza', at: [27, 24], text: 'A prayer card tucked beneath a lily pot. First printing, though the ink has bled in the rain.', reward: { item: 'prayercard', flag: 'pcard_plaza' } },
  { id: 'pz_vent', map: 'plaza', at: [13, 22], text: 'A vent exhaling warm air from the Census basement. It smells of paper and floor polish.', check: { skill: 'notice', need: 6, text: 'Beneath the polish lies iron. Somewhere down there is a blood lab.' } },
  { id: 'pz_teo', map: 'plaza', at: [33, 26], text: 'A noodle stall run by a deacon wearing an apron over his robe. BLESSED ARE THE HUNGRY. Twelve gilt.', party: { ignace: 'Brother Teo. He tithes the noodles. Two of the twelve go to the Church.' } },
  { id: 'pz_grate', map: 'plaza', at: [36, 27], text: 'A grate. Far below, water moves. The plaza sits atop the old canal.', lore: 'old_fathom', port: { 3: 'Water beneath us? Up here too?' } },
  { id: 'pz_away', map: 'plaza', at: [28, 27], text: 'A chair turned away from the statue.', check: { skill: 'notice', need: 5, text: 'The seat is worn smooth. Whoever sits here faces the Census door.' } },
  { id: 'pz_boats', map: 'plaza', at: [6, 30], text: 'A bin overflowing with Census leaflets: IS YOUR CHILD A GIFT? Every single one has been folded into a paper boat.', check: { skill: 'talk', need: 5, text: 'A girl sits on the steps, folding each leaflet into a boat so the Census can sail away.' }, party: { tova: "kees used to fold boats. he'd sail them in the canal and cry when they sank." } },
  { id: 'pz_medals', map: 'plaza', at: [4, 27], text: 'A machine selling Saint medallions. Tin, two for gilt, three for five. Every batch features a different face.', lore: 'medallions', check: { skill: 'tech', need: 5, text: 'A medallion gets wedged in the chute. You have to work it free.', reward: { item: 'medallion' } } },
  { id: 'pz_kettlejunc', map: 'plaza', at: [3, 31], text: 'A junction box. Someone has plugged a kettle into it using a stolen cable.', check: { skill: 'tech', need: 5, text: "The kettle runs off a Board line. The Board foots the bill for the plaza's tea." } },
  { id: 'pz_candleshop', map: 'plaza', at: [9, 33], text: 'CANDLE. White. Unscented. Two gilt. WE DO NOT HAGGLE WITH THE FAITHFUL.', party: { ignace: 'They haggle with me.' } },
  { id: 'pz_spring', map: 'plaza', at: [16, 34], text: "SAINT'S SPRING, PURE. Bottled water. The fountain is only ten steps away.", check: { skill: 'hack', need: 5, text: "The machine reports its sales to the Church, not the Board. Velt's office collects the receipts." } },
  { id: 'pz_plain', map: 'plaza', at: [17, 34], text: 'A noodle vending machine. It sells PLAIN now, plain only, since the eel man went back down.' },
  { id: 'pz_cardmachine', map: 'plaza', at: [29, 34], text: 'PRAYER CARDS. ONE GILT.', scene: 'nq_cards_start', hideIf: 'quest:nq_cards' },
  { id: 'pz_hostel', map: 'plaza', at: [33, 33], text: 'HOSTEL.', port: { 3: 'Twelve. Are they all here for her?' }, check: { skill: 'talk', need: 5, text: "The keeper says room nine has had the same guest for six years. She pays in candles." }, party: { ambrose: "Twelve to a room. I've slept thirty to a cage. It builds character and nothing else." } },
  { id: 'pz_threenights', map: 'plaza', at: [37, 33], text: 'PILGRIMS MAY STAY THREE NIGHTS.' },
  { id: 'pz_finger', map: 'plaza', at: [19, 36], text: 'A chrome finger in the bin, wrapped in a prayer ribbon.', party: { ambrose: 'Repossessed, then abandoned. The final indignity of a finger.' }, check: { skill: 'tech', need: 6, text: 'The serial is filed off. It was stolen, not repossessed. Somebody prayed over it and lost their nerve.' }, lore: 'free_tier' },
  { id: 'pz_foot', map: 'plaza', at: [43, 30], text: 'A planter shaped like a Bailer foot. Children sit in it.' },
  { id: 'pz_count', map: 'plaza', at: [44, 36], text: 'An arrow on the junction box: TO THE SPIRE, 300 STEPS. Under it: 301. Under that: STOP COUNTING.', party: { quaye: 'Three hundred and four. I counted twice.' } },
  { id: 'pz_moths', map: 'plaza', at: [41, 4], text: 'A cold lamp on the Spire road. Tin moths circle it, woken and exhausted.', port: { 3: 'Why do they go round and round?', 5: 'They could stop. But they want the light more.' } },
  { id: 'pz_gold', map: 'plaza', at: [40, 9], text: "A bollard painted with the Board's drop. Underneath, an older hue: Church gold.", check: { skill: 'strike', need: 4, text: 'Scrape with your thumbnail. Gold, then Board red, then gold again. The plaza changed hands twice.' } },
  { id: 'pz_vigil', map: 'plaza', at: [46, 12], text: 'A Board sign: NO VIGILS. Candle wax coats every leaf of the planter beneath it.' },
]);

// ---------------------------------------------------------------- The Terraces

addDetails([
  { id: 'tr_tomatobox', map: 'terraces', at: [5, 1], text: 'A window box of tomatoes under a grow lamp. TERRACE 4 CO-OP. PICK ONE, PLANT ONE.', lore: 'tomato_bread', reward: { item: 'tomato' }, party: { quaye: "Pick one, plant one. Fair. Do both." } },
  { id: 'tr_sock', map: 'terraces', at: [13, 1], text: 'Laundry hangs across a window, all gray, all Board-issued. One red sock.', port: { 3: 'Why is one red?', 5: "I'd want to be the red one." } },
  { id: 'tr_tolet', map: 'terraces', at: [17, 1], text: 'ROOM TO LET. NO CHROME. NO WITCHES. NO DEEPS. Someone crossed out all three NOs.', party: { tova: 'they still mean them. the ink just wore out.' }, check: { skill: 'talk', need: 5, text: 'The landlady says the room has been empty for three years. The crossed-out NOs were drawn by her daughter.' } },
  { id: 'tr_mural', map: 'terraces', at: [25, 1], text: 'Painted on the wall: four terraces depicted as four stairs, with a small figure climbing them while carrying a jar.', port: { 3: 'A jar. Like ours? Does it say DRY?' }, lore: 'terraces' },
  { id: 'tr_privilege', map: 'terraces', at: [29, 1], text: 'GROW LAMPS ARE A PRIVILEGE OF RESIDENCE. The co-op added its own notice underneath: SO ARE TOMATOES.', lore: 'grow_lamps' },
  { id: 'tr_shrine', map: 'terraces', at: [37, 1], text: 'A wall niche holding a Saint statue no larger than a thumb. Her offering is a tomato.', check: { skill: 'notice', need: 5, text: 'The tomato is fresh. Someone brings one every morning.' } },
  { id: 'tr_ladder', map: 'terraces', at: [41, 1], text: 'A chalk ladder on the wall. ROCKET 9. LID 31. SCARED IS FAST. ANGRY IS FASTER.', lore: 'bin_racing', party: { courtesy: 'CHILDREN CROSSING. CHILDREN RACING. STAND CLEAR.' } },
  { id: 'tr_nobins', map: 'terraces', at: [45, 1], text: 'NO BINS ON THE RAMP. Tire marks streak across the sign.' },
  { id: 'tr_herbs', map: 'terraces', at: [6, 2], text: "Herbs in a planter, labeled in a child's handwriting: MINT. MORE MINT. NOT MINT (POISON).", check: { skill: 'notice', need: 4, text: 'The poison is basil. The child was wrong.' } },
  { id: 'tr_hunt3', map: 'terraces', at: [12, 2], text: 'A planter on Terrace 4. Under the rim, chalk.', scene: 'nq_hunt_3', when: 'quest:nq_hunt=2&!quest:nq_hunt=3' },
  { id: 'tr_seeds', map: 'terraces', at: [4, 4], text: 'A seed dispenser. Tomato, bean, lily. The lilies sell out every feast day.', check: { skill: 'tech', need: 5, text: "The lily coil is jammed with a bulb. Clearing it releases both your refund and someone else's.", reward: { gilt: 3 } }, party: { ignace: 'Sold out on feast day. I sell the leftovers behind the church.' } },
  { id: 'tr_cards', map: 'terraces', at: [21, 5], text: 'A card game abandoned mid-hand. Four players. One hand consists entirely of kings.', check: { skill: 'notice', need: 5, text: 'The kings are pinned with a needle. The cheater fled quickly. Nobody claimed the pot.', reward: { gilt: 6 } } },
  { id: 'tr_canbell', map: 'terraces', at: [5, 9], text: 'A tin can on a string, tied to the lamp. Pulling it rings a bell somewhere on Terrace 3.', party: { ambrose: "A bell. An inquiry. I won't pull it, and yet I'll wonder about it all night." }, port: { 3: "Who is at the other end of the string?" } },
  { id: 'tr_phone', map: 'terraces', at: [3, 10], text: 'A junction box painted with the Bailer insignia and the number 11. It houses the terrace phone.', check: { skill: 'hack', need: 5, text: 'The phone dials a single number in the Deeps. The log shows no one has ever answered.' } },
  { id: 'tr_fastbin', map: 'terraces', at: [45, 9], text: "A wheeled bin marked with a racing number. It isn't woken. It's just fast.", check: { skill: 'athletics', need: 5, text: "You give it a push. It rolls to the top of the ramp and stops at the edge." } },
  { id: 'tr_umbrella', map: 'terraces', at: [4, 12], text: 'Handbills: LOST, ONE UMBRELLA. IT CHASES YOU. IF FOUND, IT WILL FIND YOU.', party: { tova: "...that's mine. i mean, i made it. it'll find them." } },
  { id: 'tr_matchbox', map: 'terraces', at: [16, 12], text: 'A model of the Lantern Steps sits in a window, built from matchboxes. Each lamp is a match.', port: { 3: 'Little steps. Little us?' } },
  { id: 'tr_drawing', map: 'terraces', at: [20, 12], text: 'A drawing wedged into the Sunny Steps fence: eleven Bailers holding hands.', port: { 3: 'Did the child see them holding hands?', 5: 'They walk alone. The child made them friends.' } },
  { id: 'tr_visiting', map: 'terraces', at: [32, 12], text: 'SUNNY STEPS, A BOARD HOME. VISITORS SUNDAYS, TWO BELLS. Beneath it, in pencil: MONDAYS? Nobody answered.', lore: 'sunny_steps', port: { 4: 'Sundays. He visits her on Sundays, too.' } },
  { id: 'tr_drainpipe', map: 'terraces', at: [36, 12], text: 'A drainpipe worn smooth by so much climbing that the paint has chipped away in hand-shaped patches.', check: { skill: 'athletics', need: 5, text: 'Three meters up, a note in a bag on the gutter: KEEP GOING. You put it back.' } },
  { id: 'tr_bulbs', map: 'terraces', at: [38, 16], text: 'Crates of Board bulbs for the grow lamps. One is labeled SPARE. It is empty.' },
  { id: 'tr_waxbin', map: 'terraces', at: [30, 14], text: 'Candle stubs only. The Church buys back wax at one gilt a kilo.', reward: { item: 'candle' } },
  { id: 'tr_cat', map: 'terraces', at: [33, 18], text: 'A warm vent with a cat asleep on it. The cat is real, which counts as news on the Terraces.', party: { courtesy: "THIS AREA IS MONITORED BY THE CAT." } },
  { id: 'tr_coats', map: 'terraces', at: [10, 19], text: 'A chessboard and two old coats draped over two chairs. No old men in sight.', check: { skill: 'notice', need: 5, text: "It is white to move. Both coats are damp. They've been gone for a while." } },
  { id: 'tr_ring', map: 'terraces', at: [2, 22], text: "TERRACE 2, with a ring painted around the number 2. The Brother's blessing: a hundred gilt.", lore: 'blessing_rings', party: { ignace: 'A hundred and twenty, on a good day.' } },
  { id: 'tr_floodline', map: 'terraces', at: [6, 22], text: 'A water stain at knee height, visible beneath three coats of paint. The Flood reached this high.', lore: 'the_flood', port: { 3: "The water came up here? This high?" } },
  { id: 'tr_mural2', map: 'terraces', at: [22, 22], text: 'A mural from before the Flood: one terrace, a harbor where the Deeps are now, and a ferry to the islands.', lore: 'old_fathom', port: { 3: 'Sea? Down there? Where the Deeps are?' } },
  { id: 'tr_racepost', map: 'terraces', at: [26, 22], text: 'GRAND FINAL. ROCKET VERSUS LID. PRIZE: TWELVE GILT AND GLORY.', check: { skill: 'talk', need: 4, text: 'Jasper calls the glory a paper crown. He has three of them.' } },
  { id: 'tr_extra', map: 'terraces', at: [8, 23], text: "A noodle machine that's been woken up. It serves a cake to anyone who looks hungry.", check: { skill: 'talk', need: 4, text: 'You look hungry. It hands you a noodle cake.', reward: { item: 'noodles' } } },
  { id: 'tr_rainbutton', map: 'terraces', at: [14, 23], text: 'BLESSED WATER. BOARD WATER. RAIN. The rain button has never worked.', check: { skill: 'hack', need: 5, text: 'The rain button is disconnected. The other two buttons dispense the same water.' } },
  { id: 'tr_card', map: 'terraces', at: [27, 23], text: 'A prayer card folded into a boat, tucked into the planter.', reward: { item: 'prayercard', flag: 'pcard_terraces' } },
  { id: 'tr_nocredit', map: 'terraces', at: [20, 24], text: 'NO HAGGLING. NO CREDIT. NO CHOIR.', check: { skill: 'talk', need: 5, text: "The cook says the Choir once paid in song. He didn't care for it." } },
  { id: 'tr_fishvan', map: 'terraces', at: [6, 25], text: 'A three-wheeled van marked VOS FISH and CANAL FOUR. The driver sleeps in the back with the fish.', check: { skill: 'sneak', need: 5, text: 'The driver is a heavy sleeper. On the dashboard sits a Lockjaw toll token.', reward: { item: 'tolltoken' } } },
  { id: 'tr_cousin', map: 'terraces', at: [22, 28], text: "A bin chained to a railing, secured with a padlock. A chalk name is scrawled on it: LID'S COUSIN.", check: { skill: 'tech', need: 4, text: 'The padlock is a Board model. The bin belongs to a Board employee who races anyway.' } },
  { id: 'tr_bulbdump', map: 'terraces', at: [31, 28], text: 'Broken grow-lamp bulbs, swept up and sorted by color.', check: { skill: 'tech', need: 5, text: 'Three still work. The rest were discarded for newer models. The co-op purchases working bulbs.', reward: { gilt: 5 } } },
  { id: 'tr_repo', map: 'terraces', at: [3, 29], text: 'A sticker on the junction box reads: BODYWELL REPO CREW PARKING ONLY.', lore: 'bodywell' },
  { id: 'tr_laundry', map: 'terraces', at: [4, 32], text: 'LAUNDRY. The machines are labeled with tape: HENK, MARIGOLD, LITTLE WIM.', party: { quaye: "Marigold handles Canal One. It's the slower machine." } },
  { id: 'tr_teeth', map: 'terraces', at: [16, 32], text: 'TEETH. No chrome. Real teeth, extracted at cost.', party: { ambrose: "Real teeth. A luxury I've kept, despite the odds." } },
  { id: 'tr_jars', map: 'terraces', at: [24, 32], text: 'A window display of jars. Each holds rainwater from a different year. The oldest label reads: FLOOD.', port: { 3: 'Water from the Flood? Is it sad water?' }, party: { sallis: "Flood water. Do not drink it." } },
  { id: 'tr_dentbin', map: 'terraces', at: [17, 35], text: "A dumpster behind the dentist's office. You aren't supposed to look closely.", check: { skill: 'notice', need: 6, text: 'You look closely. A set of chrome teeth, still leased. Bodywell will want them back.' } },
  { id: 'tr_babyseat', map: 'terraces', at: [27, 37], text: "A forklift modified with a child's seat bolted on. Racers use it to haul their bins up four terraces." },
  { id: 'tr_go', map: 'terraces', at: [3, 33], text: 'A loudspeaker at the finish line. It only says "GO." It has said "GO" for six years.' },
  { id: 'tr_nook', map: 'terraces', at: [9, 22], text: 'A recess in the retaining wall. Someone has chalked a tomato on the back of it.', check: { skill: 'notice', need: 4, text: 'The co-op stores its spare seed money in the box. A note reads: TAKE WHAT YOU NEED. PLANT SOMETHING.' } },
]);

// ---------------------------------------------------------------- Mercy Spire, the gate

addDetails([
  { id: 'sb_mercy', map: 'spirebase', at: [6, 10], text: 'MERCY SPIRE" is carved above the gate. Someone added a second line in paint: MERCY COSTS.', lore: 'mercy_spire' },
  { id: 'sb_gate10', map: 'spirebase', at: [10, 10], text: 'A list of visiting rules, nine in total. Rule nine: VISITORS WILL NOT ASK ABOUT FLOORS TEN TO FORTY-FOUR.', port: { 3: "What's on forty-four? Why not ask?", 4: "Up. She's up." }, party: { quaye: 'I was on thirty-one once. They gave me a day pass. Thirty-one smelled like cold rooms.' } },
  { id: 'sb_gate22', map: 'spirebase', at: [22, 10], text: 'A brass hand on the gate, polished by every visitor who touched it for luck.', check: { skill: 'talk', need: 4, text: "A visitor says you touch the hand going in for luck and coming out for thanks. She's been here four years." } },
  { id: 'sb_gate26', map: 'spirebase', at: [26, 10], text: 'A row of names scratched into the gate paint, accompanied by dates. Births, judging by the dates. All Board staff.' },
  { id: 'sb_gate30', map: 'spirebase', at: [30, 10], text: 'A Board notice: PARKING IN BAY 1 RESERVED. SUNDAYS. NO EXCEPTIONS.', check: { skill: 'notice', need: 5, text: 'The sign is new, though the bolts are rusted. They replace the paper weekly.' } },
  { id: 'sb_wall37', map: 'spirebase', at: [37, 1], text: "A loading bay sign in four languages. Only the Board's spelling is correct." },
  { id: 'sb_p', map: 'spirebase', at: [1, 17], text: 'P. Visitor parking, eleven spaces. Ten cars are parked there, all belonging to the Board.' },
  { id: 'sb_turret8', map: 'spirebase', at: [8, 12], text: 'A gate turret, its barrel capped with a red cloth bag.', check: { skill: 'tech', need: 6, text: 'The bag is a Board-regulation cover used on visiting days. The turret is live underneath.' } },
  { id: 'sb_turret31', map: 'spirebase', at: [31, 12], text: 'The east turret. Someone has hung a get-well card on the barrel.', party: { courtesy: 'GET WELL SOON. THIS UNIT WISHES THE TURRET WELL.' } },
  { id: 'sb_bollard', map: 'spirebase', at: [16, 14], text: 'A bollard with a ticket machine. TEN MINUTES FREE. TEN MINUTES MORE, ONE GILT. A DAY, YOUR SALARY.' },
  { id: 'sb_car5', map: 'spirebase', at: [5, 16], text: 'A Board car with a wreath on the back seat, still wrapped in paper.', check: { skill: 'notice', need: 5, text: 'The card on the wreath reads: FOR MAMA. FLOOR 6. FROM THE BRIM.' } },
  { id: 'sb_car13', map: 'spirebase', at: [13, 16], text: 'A car with a child seat and a stack of Census forms inside.', party: { tova: "don't. keep walking." } },
  { id: 'sb_car25', map: 'spirebase', at: [25, 16], text: 'An empty taxi, engine still warm. The meter displays the fare from the Terraces: nine gilt.' },
  { id: 'sb_car29', map: 'spirebase', at: [29, 16], text: 'A Board car, unlocked.', check: { skill: 'sneak', need: 5, text: 'Inside the glove box, a Board pen and a parking fine issued to the Board.', reward: { item: 'boardpen' } }, party: { sallis: 'A Board car. Unlocked. They own this street.' } },
  { id: 'sb_lamp4', map: 'spirebase', at: [4, 19], text: 'A cold lamp with a prayer ribbon: FOR MAMA, FLOOR 6.', port: { 3: "Mama. Floor six. Is everyone up there somebody's?" } },
  { id: 'sb_lamp27', map: 'spirebase', at: [27, 19], text: 'A cold lamp. Beneath it, a chalk outline of a seated figure. People wait here.', port: { 3: 'Are they waiting for the lift? Or for someone?' } },
  { id: 'sb_car30', map: 'spirebase', at: [30, 22], text: 'An ambulance marked BOARD MEDICAL on the side and KEEP FATHOM DRY on the rear doors.' },
  { id: 'sb_car9', map: 'spirebase', at: [9, 27], text: 'A car featuring a dashboard Saint that seems to nod.', reward: { item: 'medallion' } },
  { id: 'sb_vent', map: 'spirebase', at: [17, 26], text: 'An exhaust vent from the Spire. It smells of hospital soap.', check: { skill: 'notice', need: 6, text: 'And something else. Old blood, the kind kept cold.' } },
  { id: 'sb_vend', map: 'spirebase', at: [3, 28], text: 'A vending machine selling get-well cards for one gilt. They all say the same thing inside.', check: { skill: 'tech', need: 5, text: 'A card is jammed in the slot. The message inside reads: GET WELL. YOU ARE MISSED. KEEP FATHOM DRY.' } },
  { id: 'sb_vend2', map: 'spirebase', at: [36, 28], text: "Noodles are dispensed for the visitors' queue. The machine says \"THANK YOU FOR WAITING,\" whether you make a purchase or not." },
  { id: 'sb_card', map: 'spirebase', at: [16, 29], text: 'A prayer card is wedged into the planter, facing the Spire.', reward: { item: 'prayercard', flag: 'pcard_spire' } },
  { id: 'sb_planter23', map: 'spirebase', at: [23, 29], text: 'A planter holds real white lilies. A card attached to them reads: FROM FLOOR 6, THANK YOU.' },
  { id: 'sb_forklift', map: 'spirebase', at: [38, 9], text: 'A Board forklift is parked across the bay door.', check: { skill: 'athletics', need: 6, text: 'You swing over it. Behind the forklift, the bay door is locked. There is nothing to see but the lock.' } },
]);

// ---------------------------------------------------------------- The Church of the Raised Hand

addDetails([
  { id: 'ch_shelf1', map: 'church', at: [1, 2], text: 'Water has damaged the bottom edges of the hymnals. Every single one has the same page marked: the Ninth Verse.', lore: 'nine_verses' },
  { id: 'ch_card', map: 'church', at: [5, 2], text: 'A prayer card is tucked into a hymnal as a bookmark.', reward: { item: 'prayercard', flag: 'pcard_church' } },
  { id: 'ch_shelf6', map: 'church', at: [6, 2], text: 'Collection plates are stacked to the ceiling. The top plate contains a coin that nobody wanted to reach for.', check: { skill: 'athletics', need: 5, text: 'You reach in. It is a gilt.', reward: { gilt: 1 } } },
  { id: 'ch_shelf32', map: 'church', at: [32, 2], text: 'Spare robes hang nearby. One bears a name tape: HOLLIS.', party: { ignace: "That's mine. It's secondhand. The previous owner was a deceased deacon." } },
  { id: 'ch_wall11', map: 'church', at: [11, 3], text: 'A painting of the Saint, her hand raised. Behind her, eleven Bailers stand in a neat row.', port: { 3: 'Is that her? She looks old.', 4: "That's not her face." } },
  { id: 'ch_wall15', map: 'church', at: [15, 3], text: 'The altar wall. A bronze hand, the size of a door, raised high.', lore: 'saint_story' },
  { id: 'ch_wall19', map: 'church', at: [19, 3], text: 'A donation board listing names and sums in gold paint. The Board contributes four thousand a month.', check: { skill: 'notice', need: 5, text: "The Board's entry is labeled FOR UPKEEP. It doesn't specify for what." }, party: { quaye: "Four thousand a month. Forty years. Nearly two million. That's the upkeep." } },
  { id: 'ch_altar', map: 'church', at: [15, 5], text: 'The altar rail, worn smooth where people kneel.', port: { 3: 'They kneel for her? Does she even know?' } },
  { id: 'ch_pew4', map: 'church', at: [4, 13], text: "A pew bearing a brass plate: THE VOS FAMILY, CANAL FOUR. The Vos family hasn't visited the Lock in years." },
  { id: 'ch_pew22', map: 'church', at: [22, 16], text: 'A piece of gum stuck under the pew, molded into the shape of a tiny Bailer.' },
  { id: 'ch_pew11', map: 'church', at: [11, 19], text: 'A pew with a candle burned down to the wood, leaving a scorch mark in the shape of a hand.' },
  { id: 'ch_pew29', map: 'church', at: [29, 22], text: "Someone left a Choir bell on the pew. It's missing the clapper.", lore: 'choir_bell', check: { skill: 'notice', need: 4, text: 'The name WREN is scratched into the handle.' } },
  { id: 'ch_pillar', map: 'church', at: [2, 16], text: 'A pillar bears a water line painted at waist height, labeled THE FLOOD. A second line, much higher up, reads NEXT TIME.', check: { skill: 'athletics', need: 6, text: 'You reach the higher line. It was painted quickly from a ladder, likely at night.' } },
  { id: 'ch_bin', map: 'church', at: [13, 25], text: 'A bin sits by the door, filled with candle wrappers and a folded Board visitor badge.', check: { skill: 'notice', need: 5, text: 'The badge is for the Crown, marked SUNDAY VISITOR. The name has been torn off.' }, port: { 3: "A Sunday visitor. Who visits on Sundays?" } },
  { id: 'ch_tablerobe', map: 'church', at: [29, 4], text: "A vestry table holds a ledger of candle sales: 4,102 sold last week. A second, smaller column in Velt's handwriting runs alongside.", lore: 'velt' },
]);

// ---------------------------------------------------------------- The crypt

addDetails([
  { id: 'cr_shelf3', map: 'crypt', at: [3, 3], text: 'A shelf holds tidy bones, labeled by year. The newest label is forty years old.', port: { 3: 'They stopped burying people here. Why?' } },
  { id: 'cr_shelf7', map: 'crypt', at: [7, 3], text: 'Jars of old candle wax are saved, presumably meant to be melted down for new candles, forty years ago.', check: { skill: 'tech', need: 5, text: "It's good wax. Melted down, it would yield forty candles.", reward: { item: 'candle' } } },
  { id: 'cr_carving', map: 'crypt', at: [10, 2], text: 'Words carved into the wall by the stairs. Most are names, but one is a verse from a song.', scene: 'nq_song_crypt', when: 'quest:nq_song&!quest:nq_song=2' },
  { id: 'cr_wall12', map: 'crypt', at: [12, 0], text: 'The crypt ceiling bears a hand-shaped stain where water seeped through during the Flood.', lore: 'the_flood' },
  { id: 'cr_shelf18', map: 'crypt', at: [18, 3], text: 'A shelf of broken statues of the Saint. Each one is missing its raised hand first.', check: { skill: 'notice', need: 5, text: 'The hands are stored in a box underneath. Someone kept every single one.' } },
  { id: 'cr_shelf22', map: 'crypt', at: [22, 3], text: 'A shelf of paper flowers, each folded from a Census leaflet.' },
  { id: 'cr_pillar', map: 'crypt', at: [6, 7], text: 'A pillar covered in tally marks, grouped in nines. There are hundreds of groups.', party: { quaye: 'Four hundred and twelve nines. Someone has been counting verses down here.' } },
  { id: 'cr_pillar19', map: 'crypt', at: [19, 12], text: 'A pillar where someone slept against it for years. The stone is warm on one side.', check: { skill: 'notice', need: 6, text: 'Not warm, just warmer. A hot pipe runs through it from the church kitchen.' } },
  { id: 'cr_crate', map: 'crypt', at: [2, 6], text: 'A crate of Church soup tins. The label says "Eel," but the fish on the tin is not an eel.' , reward: { item: 'krill' } },
  { id: 'cr_bed', map: 'crypt', at: [3, 14], text: 'A cot with a blanket and a hymnal tucked under the pillow.', party: { ignace: "Mine. I sleep on the Ninth Verse. It's the flattest." } },
  { id: 'cr_nook', map: 'crypt', at: [1, 8], text: 'A burial niche in the west wall is open and empty of bones, yet someone has repurposed it as a cupboard.' },
]);

// ---------------------------------------------------------------- The Census Office

addDetails([
  { id: 'cs_testing', map: 'census', at: [2, 6], text: 'TESTING. A child-height mark on the doorframe reads: SIX YEARS. STAND HERE.', lore: 'census_office', party: { tova: "kees, stand there. don't make me look at it." }, port: { 3: 'Six. Did they test our hand when it was small?' } },
  { id: 'cs_wall6', map: 'census', at: [6, 6], text: 'A poster asks, IS YOUR CHILD A GIFT? It features a cartoon drop of blood with a smile.' },
  { id: 'cs_wall10', map: 'census', at: [10, 6], text: 'A poster displays the Lines, numbered one through nine, in nine different colors. Line 1 is missing, its space papered over.', lore: 'lines', check: { skill: 'notice', need: 5, text: 'Beneath the paper is a faded white square. Line 1 was white.' }, party: { quaye: 'Line 1 was white. I signed forms that bore that white square.' } },
  { id: 'cs_wall14', map: 'census', at: [14, 6], text: 'A Board clock runs four minutes fast, ensuring the queue always appears late.', check: { skill: 'tech', need: 4, text: 'A Board key on the back sets the hands. It was deliberately set fast.' } },
  { id: 'cs_wall18', map: 'census', at: [18, 6], text: "A framed Form 11, the first ever filed, is signed and stamped. A child's name has been blacked out.", lore: 'form_11' },
  { id: 'cs_wall22', map: 'census', at: [22, 6], text: 'NOW SERVING 214. The number has not changed since you entered.' },
  { id: 'cs_shelf2', map: 'census', at: [2, 8], text: 'Paper strips sit unused in a jar. Each strip is the length of a finger.', check: { skill: 'tech', need: 5, text: 'The paper is treated. It curls when exposed to blood containing a Line. You could test anyone with one.' } },
  { id: 'cs_vend23', map: 'census', at: [23, 8], text: 'A lollipop machine marked FOR BRAVE CHILDREN. It takes no coins, only a staff key.' },
  { id: 'cs_chair3', map: 'census', at: [3, 9], text: "A waiting chair bears a parent's name carved under the seat, along with a date. The date is carved again a year later." },
  { id: 'cs_window1', map: 'census', at: [4, 11], text: 'WINDOW 1: BIRTHS. The clerk has a plant on the desk. It is plastic and dusty.', check: { skill: 'talk', need: 5, text: 'The clerk says the plant came from a mother whose child tested negative. She brought it back the following week.' } },
  { id: 'cs_window3', map: 'census', at: [14, 11], text: 'WINDOW 3: TESTING RESULTS. A sign reads: NO EXCEPTIONS. NO APPEALS. NO RUNNING.', party: { tova: "no appeals. i appealed once. i was twelve. they laughed." } },
  { id: 'cs_bollard', map: 'census', at: [5, 16], text: 'A queue rope post holds a velvet-covered chain made of Board links.' },
  { id: 'cs_bin', map: 'census', at: [14, 21], text: 'A bin filled with torn appointment cards.', check: { skill: 'notice', need: 5, text: 'One card remains whole: MENSAH, K. AGE 6. APPOINTMENT KEPT.' } },
  { id: 'cs_vend2', map: 'census', at: [2, 21], text: 'Coffee for staff: BOARD BLEND. The cup bears the phrase KEEP FATHOM DRY and a coffee ring.' },
]);

// ---------------------------------------------------------------- Mercy Spire

addDetails([
  { id: 'msp_ward1', map: 'spire', at: [25, 1], text: 'WARD 1. The whiteboard lists patients by Line number, not by name.', lore: 'lines', port: { 3: "Numbers, not names. Like the Lines?", 4: "Line 1. That's her. They wrote her down as a number." } },
  { id: 'msp_wall5', map: 'spire', at: [5, 1], text: 'A painting of the Spire bathed in sunshine. There is no sun in the image, yet it remains bright.' },
  { id: 'msp_wall13', map: 'spire', at: [13, 1], text: 'A notice from the Board: "BLOOD DONORS REST HERE." A bench and an empty box of biscuits.', check: { skill: 'sneak', need: 5, text: 'Under the bench, a full box of biscuits lies hidden from the donors.', reward: { item: 'krill' } } },
  { id: 'msp_shelf', map: 'spire', at: [3, 2], text: 'Linen folded into Board-regulation squares. One pillowcase features a Choir hymn stitched onto it.' },
  { id: 'msp_counter', map: 'spire', at: [9, 4], text: "A nurses' station. A rota on the wall reads: BRINK, BRINK, BRINK, BRINK.", party: { courtesy: 'THIS UNIT ALSO WORKS EVERY SHIFT. HELLO, BRINK.' } },
  { id: 'msp_terminal', map: 'spire', at: [31, 3], text: 'A medical terminal. CHARTS BY FLOOR.', check: { skill: 'hack', need: 6, text: 'Floor 44 has one chart and no name. YIELD: FALLING. The last entry reads: WEATHER, ASKED FOR.' } },
  { id: 'msp_planter', map: 'spire', at: [38, 9], text: 'A rubber plant, its leaves polished one by one. Someone here has time.' },
  { id: 'msp_mercy', map: 'spire', at: [3, 15], text: 'MERCY SPIRE. Directory: FLOORS 10, 44, CHECK YOUR ACCESS PASS.', lore: 'mercy_spire', party: { ignace: "I tried to bless my way up there once. I got to floor nine." } },
  { id: 'msp_lift', map: 'spire', at: [18, 18], text: 'The lift panel. Forty-four buttons. Button forty-four is warm and breathing.', scene: 'nq_44_start', hideIf: 'nq_44_done' },
  { id: 'msp_car9', map: 'spire', at: [9, 18], text: 'A hearse with the engine running. Board Medical never turns them off.' },
  { id: 'msp_car22', map: 'spire', at: [22, 22], text: 'A delivery van marked BLOOD, CHILLED. The cold box hums.', check: { skill: 'tech', need: 5, text: "The cold box is set to Census temperature, not hospital grade. It's carrying test strips." } },
  { id: 'msp_pillar', map: 'spire', at: [12, 22], text: "A pillar with a children's height chart in Board blue. It stops at ten years.", check: { skill: 'notice', need: 5, text: 'Pencil marks beside the chart. One child was measured monthly for three years, and then stopped.' } },
  { id: 'msp_fuel', map: 'spire', at: [16, 21], text: 'A fuel drum stenciled: GENERATOR, FLOOR 44 ONLY.' },
  { id: 'msp_crate', map: 'spire', at: [39, 24], text: 'Bulk crates of plastic lilies for the wards.', reward: { gilt: 3 } },
]);

// ---------------------------------------------------------------- Lost Property

addDetails([
  { id: 'lp_sign', map: 'lostprop', at: [13, 1], text: 'LOST PROPERTY. BOARD RECOVERY. CLAIMS IN WRITING, IN TRIPLICATE, IN PERSON.', lore: 'lost_property' },
  { id: 'lp_line4', map: 'lostprop', at: [29, 1], text: 'LINE 4. A cage of angry things: a toaster, a mop, a kitchen chair that kicks.', party: { tova: 'line 4. someone was really mad. poor chair.' } },
  { id: 'lp_records', map: 'lostprop', at: [5, 1], text: 'A ledger chained to the wall. Every woken item has a tick box: BREATHING.' },
  { id: 'lp_shelf3', map: 'lostprop', at: [3, 9], text: 'A shelf of umbrellas, all woken, all facing the door.', port: { 3: "They want to go home. Why can't they?", 5: "They want something. That's enough to keep them." }, party: { courtesy: "THIS UNIT WAS LOST PROPERTY. STAND CLEAR OF THE UMBRELLAS. THEY ARE WAITING." } },
  { id: 'lp_shelf12', map: 'lostprop', at: [12, 9], text: 'Shoes labeled by canal. One pair keeps walking in place.' },
  { id: 'lp_shelf19', map: 'lostprop', at: [19, 14], text: 'A shelf of kettles. One is missing from its dust outline.', port: { 3: "One missing. The one on the windowsill?" } },
  { id: 'lp_shelf26', map: 'lostprop', at: [26, 14], text: 'Board helmets, confiscated from officers who woke them by accident.', reward: { gilt: 2 } },
  { id: 'lp_shelf8', map: 'lostprop', at: [8, 19], text: 'A box of toys. Tagged: AUCTION, DAY 89. Tomorrow.', check: { skill: 'notice', need: 5, text: 'A tin soldier is breathing in the box. It has saluted every guard who walked past for eighty-nine days.' } },
  { id: 'lp_shelf30', map: 'lostprop', at: [30, 19], text: 'Hush cans, lining a whole shelf. ISSUE BY SIGNATURE ONLY.', lore: 'hush_can', check: { skill: 'sneak', need: 6, text: 'No one is watching the signature book.', reward: { item: 'hush' } } },
  { id: 'lp_crate', map: 'lostprop', at: [2, 11], text: 'A crate stamped CRUSH. Inside, an accordion, breathing in and out on its own.', party: { ambrose: "An accordion, condemned to the crusher, still breathing. I shall not forget it." } },
  { id: 'lp_junction', map: 'lostprop', at: [24, 3], text: 'The warehouse junction box. The cage locks run off it.', check: { skill: 'hack', need: 5, text: 'Every cage opens on one command. Somebody wrote it on the inside of the lid: OPEN ALL.' } },
  { id: 'lp_dock', map: 'lostprop', at: [11, 23], text: 'DOCK. The van comes at six. A chalkboard counts THINGS IN, THINGS OUT. Out is always zero.' },
  { id: 'lp_lamp', map: 'lostprop', at: [6, 24], text: 'A cold lamp with a woken moth trapped behind the glass.', port: { 3: 'It wants out. Can we?' } },
]);

// ---------------------------------------------------------------- Sunny Steps

addDetails([
  { id: 'su_choir', map: 'sunny', at: [1, 1], text: 'CHOIR. A music stand with a sheet for seven voices. KEES is written over the high part.', party: { tova: 'he always gets the high part. always.' } },
  { id: 'su_wall5', map: 'sunny', at: [5, 1], text: 'Children\'s drawings of the Bailers. Every Bailer has a child on its shoulder.', party: { tova: "...they draw them friendly. they make the bailers friendly." } },
  { id: 'su_sheet', map: 'sunny', at: [9, 1], text: 'A song sheet pinned to the wall: PELL MARKET RAIN, FOR CHILDREN. Four verses, with the fourth written in Board blue.', scene: 'nq_song_sunny', when: 'quest:nq_song&!quest:nq_song=2' },
  { id: 'su_director', map: 'sunny', at: [25, 1], text: 'DIRECTOR. A brass plate reads: MEVROUW LAM. Beneath it, a second plate has been unscrewed, leaving only the outline of a former name.' },
  { id: 'su_shelf24', map: 'sunny', at: [24, 3], text: 'Files bound with ribbons. Each ribbon matches the colors of the Lines.', lore: 'sunny_steps' },
  { id: 'su_counter', map: 'sunny', at: [4, 3], text: 'The kitchen hatch. Beans on Monday, beans on Tuesday, and a cake on Sunday for visitors.', check: { skill: 'sneak', need: 5, text: 'The Sunday cake sits in the cupboard under a cloth. There are twelve slices for sixty children.' } },
  { id: 'su_bed13', map: 'sunny', at: [13, 2], text: 'A bed made with crisp hospital corners. Under the pillow rests a paper boat.', port: { 3: "A boat under a pillow. Does it want to sail?" } },
  { id: 'su_bed19', map: 'sunny', at: [19, 6], text: 'A bed labeled with a name tag: BO. A drawing of a rope stall is taped to the headboard.' },
  { id: 'su_wall11', map: 'sunny', at: [11, 11], text: 'A chart: GOLD STARS FOR SINGING. Kees has the most stars. Someone gave him an extra one in pen.' },
  { id: 'su_wall23', map: 'sunny', at: [23, 11], text: 'YOU ARE GOING TO HELP THE CITY. The message is painted in letters as tall as the children.', port: { 3: 'Help how?', 4: 'They mean like her. Like her.' } },
  { id: 'su_card', map: 'sunny', at: [21, 14], text: 'A prayer card tucked into the planter, hidden under a stone like a secret.', reward: { item: 'prayercard', flag: 'pcard_sunny' } },
  { id: 'su_speaker', map: 'sunny', at: [2, 20], text: 'A yard speaker that plays the Board anthem at seven, sung by the local children.' },
  { id: 'su_door', map: 'sunny', at: [4, 24], text: 'The front wall, featuring a brass letterbox with its flap screwed shut. Letters upset people.' },
]);

// ---------------------------------------------------------------- The Overlook

addDetails([
  { id: 'ov_deeps', map: 'overlook', at: [17, 1], text: 'THE DEEPS" tiled onto the wall, with an arrow pointing downward. Down is the only direction it could be.' },
  { id: 'ov_wall5', map: 'overlook', at: [5, 1], text: 'A coin-operated telescope bolted to the wall. It reads: VIEW THE DEEPS, 1 GILT.', check: { skill: 'notice', need: 4, text: 'It is aimed at Canal Nine. Someone up here watches one specific house every night.' } },
  { id: 'ov_wall21', map: 'overlook', at: [21, 1], text: 'A plaque that reads: FROM HERE THE CITIZENS OF THE STAIR MAY CONTEMPLATE THEIR GOOD FORTUNE.' },
  { id: 'ov_planter2', map: 'overlook', at: [2, 3], text: 'A planter containing a dead palm and a living pigeon.' },
  { id: 'ov_lamp5', map: 'overlook', at: [5, 3], text: 'A lamp with a love note tied to it, bearing two names, one from the Stair, one from Canal Six.' },
  { id: 'ov_chair8', map: 'overlook', at: [8, 8], text: 'Two chairs facing the drop, with chalk markings on the seats.', scene: 'nq_hunt_4', when: 'quest:nq_hunt=3&!nq_hunt_done' },
  { id: 'ov_chair20', map: 'overlook', at: [20, 8], text: 'A chair worn smooth at the arms. People grip it when the Bailers pass.', port: { 3: 'They look so huge from here. Are they tired?', 5: "They never stop. I'd like to be a little like that, too." } },
  { id: 'ov_planter27', map: 'overlook', at: [27, 8], text: 'A planter bearing a Board sign: DO NOT FEED THE BAILERS.', lore: 'the_flood' },
  { id: 'ov_pell', map: 'overlook', at: [9, 17], text: 'The word PELL glows in neon far below on the market roofs. The "P" has been out of commission for two years.', lore: 'pell_rain' },
  { id: 'ov_water', map: 'overlook', at: [13, 19], text: 'The canal between the market roofs. A Bailer\'s wake still rocks the boats a minute after it passes.', port: { 3: "The big ones move the water. Even from up here." } },
  { id: 'ov_water2', map: 'overlook', at: [22, 21], text: 'The canal, black and oily, reflecting the neon upside down.', check: { skill: 'shoot', need: 5, text: "You could hit the noodle sign on the far roof from here. You don't. Someone is eating underneath it." } },
  { id: 'ov_nook', map: 'overlook', at: [14, 0], text: 'A recess in the wall behind the lamp. The tiles here are newer. Someone bricked up a window but left the sill.' },
]);
