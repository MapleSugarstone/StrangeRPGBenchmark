import type { EnemyDef, ShellDef, ConceptDef } from './model';
import { BRASS, SEA, STONE, YEAR, VOID } from '../game/palette';

// Fragility totals for the minibosses and bosses are the bible's numbers.

const E: EnemyDef[] = [
  // The Brass Dreamscape
  {
    id: 'clockwork_bird', name: 'Clockwork Bird', category: 'shell', layers: { shell: 50, memory: 30, emotion: 20, name: 20 },
    shellKind: 'clockwork', memory: 'a song it learned from a human throat', emotion: 'joy', trueName: 'Wren-of-Hinges', concept: 'Song',
    moves: [
      { name: 'Sing in a Human Voice', kind: 'mind', power: 0.08, range: 'any', line: 'It sings in a human voice. The voice is crying.' },
      { name: 'Peck', kind: 'air', power: 0.07, range: 'melee' },
    ],
    ai: 'skitter', speed: 2, floats: true, peaceful: true, art: 'bird', c1: BRASS.gold, c2: BRASS.shine,
  },
  {
    id: 'brass_golem', name: 'Brass Golem', category: 'shell', layers: { shell: 140, memory: 40, emotion: 20, name: 30 },
    shellKind: 'brass', memory: 'memories of its creator', emotion: 'pride', trueName: 'Seventh Hinge', concept: 'Protection',
    moves: [
      { name: 'Floor Slam', kind: 'ground', power: 0.12, range: 'wave', reach: 2, heavy: 1 },
      { name: 'Brass Fist', kind: 'air', power: 0.1, range: 'melee', weight: 2 },
    ],
    ai: 'brute', speed: 1, art: 'golem', c1: BRASS.brass, c2: BRASS.shine,
  },
  {
    id: 'clockwork_beast', name: 'Clockwork Beast', category: 'shell', layers: { shell: 90, memory: 30, emotion: 40, name: 20 },
    shellKind: 'clockwork', memory: 'a yard it was kept in', emotion: 'fear', trueName: 'Ticking Dog', concept: 'Hunger',
    moves: [
      { name: 'Bite', kind: 'air', power: 0.1, range: 'melee', weight: 2 },
      { name: 'Wind-Up Lunge', kind: 'ground', power: 0.13, range: 'melee', heavy: 1 },
    ],
    ai: 'skitter', speed: 2, art: 'beast', c1: BRASS.gold, c2: BRASS.rust,
  },
  {
    id: 'cog_mite', name: 'Cog-Mite', category: 'shell', layers: { shell: 40, name: 20 },
    shellKind: 'cog', trueName: 'Tooth', concept: 'Turning',
    moves: [{ name: 'Nibble', kind: 'air', power: 0.06, range: 'melee' }],
    ai: 'skitter', speed: 2, art: 'mite', c1: BRASS.brass, c2: BRASS.gold,
  },
  {
    id: 'page_moth', name: 'Page-Moth', category: 'memory', layers: { shell: 20, memory: 80, name: 20 },
    shellKind: 'paper', memory: 'a page from a book about rain', trueName: 'Margin', concept: 'Forgetting',
    moves: [
      { name: 'Word Dust', kind: 'mind', power: 0.08, range: 'any', effect: 'confuse' },
      { name: 'Flutter', kind: 'air', power: 0.06, range: 'melee' },
    ],
    ai: 'caster', speed: 1, floats: true, art: 'moth', c1: BRASS.paper, c2: BRASS.brown,
  },
  {
    id: 'lost_child', name: 'Lost Child', category: 'memory', layers: { memory: 100, emotion: 40, name: 30 },
    memory: 'a hand that let go', emotion: 'longing', trueName: 'Found', concept: 'Lostness',
    moves: [{ name: 'Cry for Someone', kind: 'mind', power: 0.07, range: 'any', all: true, line: 'It is calling a name. Not yours.' }],
    ai: 'still', peaceful: true, art: 'child', c1: SEA.mist, c2: SEA.paper,
  },
  {
    id: 'steam_wisp', name: 'Steam Wisp', category: 'emotion', layers: { emotion: 80, name: 30 },
    emotion: 'pride', trueName: 'Hiss', concept: 'Heat',
    moves: [{ name: 'Scald', kind: 'air', power: 0.1, range: 'any' }],
    ai: 'caster', speed: 1, floats: true, art: 'wisp', c1: BRASS.steam, c2: BRASS.sky4,
  },
  {
    id: 'bloom_blade', name: 'Bloom-Blade', category: 'emotion', layers: { shell: 40, emotion: 100, name: 30 },
    shellKind: 'petal', emotion: 'rage', trueName: 'Sharpest Petal', concept: 'Bloom',
    moves: [
      { name: 'Cut', kind: 'air', power: 0.12, range: 'melee' },
      { name: 'Petal Storm', kind: 'ground', power: 0.08, range: 'wave', reach: 3, heavy: 1 },
    ],
    ai: 'still', art: 'flower', c1: BRASS.gold, c2: BRASS.rust,
  },
  {
    id: 'forgotten_soldier', name: 'The Forgotten Soldier', category: 'memory', layers: { shell: 150, memory: 450, emotion: 100, name: 50 },
    shellKind: 'uniform', memory: 'a march with no war at the end of it', emotion: 'longing', trueName: 'The Lost', concept: 'Soldier',
    moves: [
      { name: 'Forgotten-Strike', kind: 'air', power: 0.14, range: 'melee', weight: 2, line: 'It salutes nobody, then swings.', heavy: 2 },
      { name: 'Confusion', kind: 'mind', power: 0.08, range: 'any', all: true, effect: 'confuse' },
    ],
    ai: 'brute', speed: 1, size: 2, art: 'soldier', c1: BRASS.verdigris, c2: BRASS.paper, up: 20,
    intro: [{ speaker: 'Forgotten Soldier', text: 'WHO DO I REPORT TO. WHO. the war was this way. it was right here. where did they put the war?' }],
  },
  {
    id: 'rage_beast', name: 'The Rage-Beast', category: 'emotion', layers: { emotion: 400, name: 100 },
    emotion: 'rage', trueName: 'The Angry', concept: 'Rage',
    moves: [
      { name: 'Rage-Storm', kind: 'ground', power: 0.12, range: 'wave', reach: 3, weight: 2, heavy: 2 },
      { name: 'Emotion-Strike', kind: 'air', power: 0.16, range: 'melee' },
    ],
    ai: 'brute', speed: 2, size: 2, art: 'ragebeast', c1: BRASS.rust, c2: BRASS.sky3, up: 20,
    intro: [{ speaker: 'The Rage-Beast', text: 'GRIND AND GROWL AND SNAP AND SNARL AND STOMP AND STAMP AND SPIT IT OUT SPIT IT OUT SPIT IT ALL OUT' }],
  },
  {
    id: 'watchman', name: 'The First Watchman', category: 'memory', layers: { shell: 400, memory: 350, emotion: 150, name: 100 },
    shellKind: 'watchman', memory: 'memories of its creator', emotion: 'pride', trueName: 'The Watchman', concept: 'Protection',
    moves: [
      { name: 'Brass Storm', kind: 'air', power: 0.1, range: 'any', all: true, phases: [1, 2, 3, 4], weight: 2 },
      { name: 'Shell-Stripping', kind: 'strip', power: 0.06, range: 'any', phases: [2, 3, 4], weight: 2 },
      { name: 'Gear-Grind', kind: 'ground', power: 0.15, range: 'wave', reach: 3, phases: [1, 2, 3, 4], weight: 2, heavy: 2 },
    ],
    ai: 'boss', size: 3, boss: true, art: 'watchman_boss', c1: BRASS.brass, c2: BRASS.shine, up: 40,
    phases: [
      { at: 0.75, speaker: 'The Watchman', text: 'My plates. OH. look at them go.' },
      { at: 0.5, speaker: 'The Watchman', text: 'Grinding and knowing and turning and- less of me now.' },
      { at: 0.2, speaker: 'The Watchman', text: 'A statue. I was always going to be a statue. That\'s how I see it, at least.' },
    ],
  },

  // The Between-Sea
  {
    id: 'tide_crab', name: 'Tide-Crab', category: 'shell', layers: { shell: 220, memory: 60, emotion: 40, name: 40 },
    shellKind: 'coral', memory: 'the shape of a wave that never broke', emotion: 'fear', trueName: 'Clench', concept: 'Holding On',
    moves: [
      { name: 'Pinch', kind: 'air', power: 0.12, range: 'melee', weight: 2 },
      { name: 'Shell Up', kind: 'air', power: 0, range: 'any', effect: 'shell_self' },
    ],
    ai: 'brute', speed: 1, art: 'crab', c1: SEA.coral, c2: SEA.sand,
  },
  {
    id: 'nameless_fish', name: 'Nameless Fish', category: 'memory', layers: { memory: 160, name: 80 },
    memory: 'the last word it was called', trueName: '(no name yet)', concept: 'Drift',
    moves: [{ name: 'Forget You', kind: 'mind', power: 0.08, range: 'any', effect: 'forget' }],
    ai: 'skitter', speed: 2, floats: true, art: 'fish', c1: SEA.seafoam, c2: SEA.foam,
  },
  {
    id: 'sadness_walker', name: 'Sadness-Walker', category: 'emotion', layers: { shell: 60, emotion: 240, name: 60 },
    shellKind: 'coral', emotion: 'sorrow', trueName: 'Low Tide', concept: 'Sadness',
    moves: [
      { name: 'Weep', kind: 'mind', power: 0.1, range: 'any', all: true },
      { name: 'Trudge', kind: 'ground', power: 0.11, range: 'melee', heavy: 1 },
    ],
    ai: 'brute', speed: 1, art: 'walker', c1: SEA.blue, c2: SEA.mist,
  },
  {
    id: 'storm_gull', name: 'Storm-Gull', category: 'shell', layers: { shell: 120, memory: 60, emotion: 60, name: 40 },
    shellKind: 'feather', memory: 'a coast that is not there anymore', emotion: 'fear', trueName: 'Gale', concept: 'Weather',
    moves: [{ name: 'Dive', kind: 'air', power: 0.11, range: 'any', heavy: 1 }],
    ai: 'skitter', speed: 2, floats: true, art: 'gull', c1: SEA.foam, c2: SEA.mist,
  },
  {
    id: 'coral_mouth', name: 'Coral Mouth', category: 'shell', layers: { shell: 260, memory: 80, name: 60 },
    shellKind: 'coral', memory: 'every word it ever forgot', trueName: 'Polyp', concept: 'Mouth',
    moves: [
      { name: 'Forgotten Word', kind: 'mind', power: 0.1, range: 'any', effect: 'confuse', line: 'The coral says a word nobody has used in a thousand years.' },
      { name: 'Bite', kind: 'air', power: 0.12, range: 'melee' },
    ],
    ai: 'still', liar: true, art: 'coral', c1: SEA.coral, c2: SEA.lilac,
  },
  {
    id: 'idea_of_nothing', name: 'The Idea of Nothing', category: 'concept', layers: { name: 320 },
    trueName: 'Nothing', concept: 'Nothing',
    moves: [{ name: 'Nothing-Strike', kind: 'void', power: 0.12, range: 'any', line: 'There is a sort of: Gap.' }],
    ai: 'caster', speed: 1, floats: true, art: 'nothing', c1: VOID.mid, c2: VOID.white,
  },
  {
    id: 'paper_walker', name: 'Paper-Walker', category: 'shell', layers: { shell: 200, memory: 100, name: 80 },
    shellKind: 'paper', memory: 'a form filled in by someone who is gone', trueName: 'Form 1977-B', concept: 'Procedure',
    moves: [
      { name: 'Paper Cut', kind: 'air', power: 0.1, range: 'melee', weight: 2 },
      { name: 'File You Away', kind: 'mind', power: 0.08, range: 'any', effect: 'paperwork' },
    ],
    ai: 'brute', speed: 1, liar: true, art: 'paperwalker', c1: SEA.paper, c2: SEA.ink,
  },
  {
    id: 'form_collector', name: 'Form-Collector', category: 'shell', layers: { shell: 180, memory: 80, emotion: 60, name: 80 },
    shellKind: 'paper', memory: 'the first shell it ever took', emotion: 'pride', trueName: 'Intake', concept: 'Collection',
    moves: [
      { name: 'Collect Form', kind: 'strip', power: 0.06, range: 'melee', line: 'It stamps your shell PROCESSED and takes it.' },
      { name: 'Stamp', kind: 'air', power: 0.12, range: 'melee', weight: 2, heavy: 1 },
    ],
    ai: 'brute', speed: 1, liar: true, art: 'collector', c1: SEA.paper, c2: SEA.purple,
  },
  {
    id: 'record_keeper', name: 'Record-Keeper', category: 'memory', layers: { shell: 80, memory: 220, name: 80 },
    shellKind: 'paper', memory: 'a record of you, already filed', trueName: 'Ledger', concept: 'Record',
    moves: [
      { name: 'Record', kind: 'mind', power: 0.1, range: 'any', effect: 'forget' },
      { name: 'Catalog Itself', kind: 'mind', power: 0, range: 'any', effect: 'heal_self' },
    ],
    ai: 'caster', speed: 1, liar: true, art: 'recorder', c1: SEA.paper, c2: SEA.teal,
  },
  {
    id: 'name_storm', name: 'The Storm of Names', category: 'concept', layers: { emotion: 300, name: 600 },
    emotion: 'confusion', trueName: 'Every Name At Once', concept: 'Weather of Names',
    moves: [
      { name: 'Name-Squall', kind: 'mind', power: 0.1, range: 'any', all: true, effect: 'forget', weight: 2 },
      { name: 'Lightning of Vowels', kind: 'air', power: 0.14, range: 'any', heavy: 2 },
    ],
    ai: 'still', size: 2, floats: true, art: 'namestorm', c1: SEA.lilac, c2: SEA.foam, up: 20,
  },
  {
    id: 'archive', name: "The Keeper's Archive", category: 'emotion', layers: { shell: 600, memory: 400, emotion: 700, name: 300 },
    shellKind: 'archive', memory: 'every form ever filed', emotion: 'dread', trueName: 'The Archive', concept: 'Order',
    moves: [
      { name: 'Paper Storm', kind: 'air', power: 0.1, range: 'any', all: true, weight: 2 },
      { name: 'Face-Flood', kind: 'mind', power: 0.09, range: 'any', all: true, effect: 'confuse', phases: [2, 3, 4] },
      { name: 'Bureaucratic Overload', kind: 'mind', power: 0.14, range: 'any', effect: 'paperwork', phases: [3, 4], weight: 2, heavy: 3 },
    ],
    ai: 'boss', size: 3, boss: true, liar: true, art: 'archive_boss', c1: SEA.paper, c2: SEA.purple, up: 60,
    phases: [
      { at: 0.75, speaker: 'The Keeper', text: 'Form 1977-B? Torn. Who tore it? You did.' },
      { at: 0.5, speaker: 'The Keeper', text: 'Faces? Mine. All of them? Most of them.' },
      { at: 0.25, speaker: 'The Keeper', text: 'The Archive? Falling. Can it be refiled? No.' },
    ],
  },

  // The Year 1977
  {
    id: 'yellow_tooth', name: 'Yellow-Tooth', category: 'emotion', layers: { shell: 80, emotion: 220, name: 60 },
    shellKind: 'teeth', emotion: 'misery', trueName: 'Smile, Mostly', concept: 'Misery',
    moves: [
      { name: 'Grin', kind: 'mind', power: 0.1, range: 'any' },
      { name: 'Gnash', kind: 'air', power: 0.12, range: 'melee', weight: 2, heavy: 1 },
    ],
    ai: 'brute', speed: 1, art: 'tooth', c1: YEAR.teeth, c2: YEAR.meat,
  },
  {
    id: 'electronic_meat', name: 'Electronic Meat', category: 'shell', layers: { shell: 280, memory: 60, emotion: 40, name: 60 },
    shellKind: 'meat', memory: 'a feeling nobody said out loud', emotion: 'dread', trueName: 'Three Inches', concept: 'Burial',
    moves: [
      { name: 'Bury', kind: 'air', power: 0.12, range: 'melee', line: 'It buries a feeling under three inches of itself.', heavy: 1 },
      { name: 'Hum', kind: 'ground', power: 0.08, range: 'wave', reach: 3 },
    ],
    ai: 'brute', speed: 1, art: 'meat', c1: YEAR.meat, c2: YEAR.green,
  },
  {
    id: 'the_forgotten', name: 'The Forgotten', category: 'memory', layers: { memory: 200, emotion: 60, name: 60 },
    memory: 'a reason, almost', emotion: 'confusion', trueName: 'Someone', concept: 'Purpose',
    moves: [{ name: 'Ask Why', kind: 'mind', power: 0.08, range: 'any', line: 'It asks you why it exists. You do not know either.' }],
    ai: 'still', peaceful: true, art: 'forgotten', c1: YEAR.gray, c2: YEAR.pale,
  },
  {
    id: 'symbol', name: 'Heavy Symbol', category: 'concept', layers: { name: 380 },
    trueName: 'Weight', concept: 'Weight',
    moves: [{ name: 'Give Weight', kind: 'ground', power: 0.12, range: 'wave', reach: 3, line: 'A symbol lands on you. It means something heavy.', heavy: 1 }],
    ai: 'still', art: 'symbol', c1: YEAR.orange, c2: YEAR.yellow,
  },
  {
    id: 'meat_drone', name: 'Meat-Drone', category: 'shell', layers: { shell: 160, memory: 40, name: 40 },
    shellKind: 'meat', memory: 'a shift that never ended', trueName: 'Worker 9', concept: 'Labor',
    moves: [{ name: 'Process', kind: 'air', power: 0.1, range: 'melee' }],
    ai: 'skitter', speed: 2, floats: true, art: 'drone', c1: YEAR.green, c2: YEAR.mustard,
  },
  {
    id: 'despair', name: 'The Despair', category: 'emotion', layers: { memory: 300, emotion: 750, name: 300 },
    memory: 'the end of the world, felt every second', emotion: 'despair', trueName: 'The Chasm', concept: 'Despair',
    moves: [
      { name: 'The Chasm', kind: 'ground', power: 0.14, range: 'wave', reach: 4, weight: 2, heavy: 2 },
      { name: 'Insecurity', kind: 'mind', power: 0.12, range: 'any', line: 'IT BOILS. IT BOILS OVER. NOBODY TURNS THE STOVE OFF.' },
      { name: 'Symbol Weight', kind: 'air', power: 0.15, range: 'melee' },
    ],
    ai: 'boss', size: 3, boss: true, art: 'despair_boss', c1: YEAR.orange, c2: YEAR.teeth, up: 40,
    phases: [
      { at: 0.6, speaker: 'The Despair', text: 'EVERYONE SMILED WITH THEIR MOUTHS SHUT (because of the teeth).' },
      { at: 0.3, speaker: 'The Despair', text: 'NOBODY SAID IT. NOBODY. SO IT GOT BIG.' },
    ],
  },

  // The Stone-Deep
  {
    id: 'crystal_shard', name: 'Crystal Shard', category: 'shell', layers: { shell: 320, memory: 80, emotion: 60, name: 80 },
    shellKind: 'crystal', memory: 'a color nobody has a word for', emotion: 'pride', trueName: 'Facet', concept: 'Edge',
    moves: [
      { name: 'Refract', kind: 'air', power: 0.12, range: 'any' },
      { name: 'Shatter', kind: 'ground', power: 0.14, range: 'wave', reach: 2, heavy: 1 },
    ],
    ai: 'brute', speed: 1, art: 'shard', c1: STONE.cyan, c2: STONE.white,
  },
  {
    id: 'concept_of_silence', name: 'The Concept of Silence', category: 'concept', layers: { name: 520 },
    trueName: 'Hush', concept: 'Silence',
    moves: [
      { name: 'Silence', kind: 'mind', power: 0.1, range: 'any', effect: 'silence_senses', line: 'Your senses go quiet.' },
      { name: 'Unsaid', kind: 'mind', power: 0.13, range: 'any', heavy: 1 },
    ],
    ai: 'still', floats: true, art: 'silence', c1: STONE.pale, c2: STONE.violet,
  },
  {
    id: 'nothing_eater', name: 'Nothing-Eater', category: 'void', layers: { shell: 120, memory: 120, emotion: 120, name: 200 },
    shellKind: 'crystal', memory: 'the taste of a star', emotion: 'dread', trueName: 'Mouth of Less', concept: 'Appetite',
    moves: [
      { name: 'Void-Bite', kind: 'void', power: 0.18, range: 'melee', weight: 2, heavy: 1 },
      { name: 'Consume', kind: 'void', power: 0.11, range: 'any', all: true },
    ],
    ai: 'brute', speed: 2, art: 'eater', c1: STONE.violet, c2: STONE.magenta,
  },
  {
    id: 'memory_being', name: 'Memory Being', category: 'memory', layers: { memory: 400, emotion: 100, name: 100 },
    memory: 'somebody else arriving here, a long time ago', emotion: 'longing', trueName: 'Then', concept: 'Then',
    moves: [{ name: 'Remember You', kind: 'mind', power: 0.12, range: 'any', effect: 'forget' }],
    ai: 'still', peaceful: true, floats: true, art: 'membeing', c1: STONE.pale, c2: STONE.pink,
  },
  {
    id: 'guardian_fragment', name: 'Guardian Fragment', category: 'concept', layers: { shell: 200, name: 420 },
    shellKind: 'crystal', trueName: 'Shard of Before', concept: 'Wholeness',
    moves: [{ name: 'Crystal-Strike', kind: 'air', power: 0.16, range: 'melee' }],
    ai: 'brute', speed: 1, art: 'fragment', c1: STONE.cyan, c2: STONE.magenta,
  },
  {
    id: 'prism_mote', name: 'Prism Mote', category: 'emotion', layers: { shell: 100, emotion: 220, name: 80 },
    shellKind: 'crystal', emotion: 'joy', trueName: 'Spark', concept: 'Spectrum',
    moves: [{ name: 'Color That Hurts', kind: 'mind', power: 0.12, range: 'any' }],
    ai: 'skitter', speed: 2, floats: true, art: 'mote', c1: STONE.acid, c2: STONE.magenta,
  },
  {
    id: 'void_walker', name: 'The Void-Walker', category: 'void', layers: { memory: 250, emotion: 250, name: 500 },
    memory: 'nothing, kept carefully', emotion: 'dread', trueName: 'The Absence', concept: 'Absence',
    moves: [
      { name: 'Void-Touch', kind: 'void', power: 0.2, range: 'melee', weight: 2, line: '(it touches you with nothing.)', heavy: 2 },
      { name: 'Nothing-Strike', kind: 'void', power: 0.13, range: 'any', all: true },
    ],
    ai: 'brute', speed: 2, size: 2, art: 'voidwalker', c1: VOID.mid, c2: VOID.white, up: 30,
    intro: [{ speaker: 'The Void-Walker', text: '(nobody walks here. i walk here. so i am nobody.)' }],
  },
  {
    id: 'lightbound_end', name: "The Light-Bound's End", category: 'concept', layers: { shell: 600, memory: 700, emotion: 700, name: 1000 },
    shellKind: 'stone', memory: 'a kitchen that smelled of sunset cake', emotion: 'joy', trueName: 'Light-Bound #123', concept: 'Hope',
    moves: [
      { name: 'Stone-Strike', kind: 'air', power: 0.11, range: 'any', weight: 2 },
      { name: 'Reality-Break', kind: 'mind', power: 0.09, range: 'any', all: true, effect: 'forget', phases: [2, 3, 4] },
      { name: 'Pilgrim-Form', kind: 'mind', power: 0.12, range: 'any', phases: [3, 4], line: 'It takes your form. It is better at being you than you are.', heavy: 2 },
    ],
    ai: 'boss', size: 3, boss: true, floats: true, art: 'lbend_boss', c1: STONE.white, c2: STONE.cyan, up: 80,
    phases: [
      { at: 0.75, speaker: 'Light-Bound #123', text: 'Goodness gracious me!! What did you DO??' },
      { at: 0.5, speaker: 'Light-Bound #123', text: 'MORE!! MORE FLAVOR THAN THERE IS MOUTH!!! ehehehehehee!!!!' },
      { at: 0.2, speaker: 'Light-Bound #123', text: 'oh dear.' },
    ],
  },
  {
    id: 'guardian', name: 'The Guardian', category: 'concept', layers: { shell: 1000, memory: 1000, emotion: 1000, name: 1000 },
    shellKind: 'stone', memory: 'every pilgrim before you', emotion: 'longing', trueName: 'Overknower', concept: 'Choice',
    moves: [
      { name: 'Crystal-Strike', kind: 'air', power: 0.2, range: 'any', phases: [1, 2, 3, 4], weight: 2 },
      { name: 'Void-Touch', kind: 'void', power: 0.22, range: 'any', phases: [2, 3, 4], weight: 2 },
      { name: 'Memory-Flood', kind: 'mind', power: 0.13, range: 'any', all: true, effect: 'forget', phases: [2, 3, 4], weight: 2 },
      { name: 'Emotion-Storm', kind: 'ground', power: 0.19, range: 'wave', reach: 6, phases: [3, 4], weight: 2, heavy: 2 },
    ],
    ai: 'boss', size: 3, boss: true, floats: true, art: 'guardian_boss', c1: STONE.cyan, c2: STONE.white, up: 0,
    phases: [
      { at: 0.8, speaker: 'The Guardian', text: 'HELLO AGAIN. HELLO FOR THE FIRST TIME. WHICH ONE IS IT FOR YOU??' },
      { at: 0.6, speaker: 'The Guardian', text: 'CAN YOU FEEL YOUR EDGES? I CAN FEEL YOUR EDGES. THEY ARE ALL OVER THE WORLD.' },
      { at: 0.4, speaker: 'The Guardian', text: 'I CHOSE ONCE. IT DID NOT HURT. IT DID NOT HURT FOR A VERY LONG TIME.' },
    ],
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(E.map(e => [e.id, e]));

/** Shells are the Pilgrim's equipment. Every shell was a pilgrim once. */
export const SHELLS: Record<string, ShellDef> = Object.fromEntries(([
  { id: 'clockwork', name: 'Clockwork Shell', armor: 0.1, voidRes: 0, bonus: 'speed', text: 'Slide no longer leaves you open. A pilgrim wore it to walk faster and never arrived.' },
  { id: 'brass', name: 'Brass Shell', armor: 0.2, voidRes: 0.2, text: 'It still remembers walking upright. A pilgrim wore it before it was a golem.' },
  { id: 'cog', name: 'Cog Shell', armor: 0.05, voidRes: 0, bonus: 'gain', text: 'You gain more Fragility from every hit. It belonged to a pilgrim who counted everything.' },
  { id: 'paper', name: 'Paper Shell', armor: 0.05, voidRes: 0, bonus: 'lies', text: 'You can read false intents. A pilgrim filed it in triplicate.' },
  { id: 'petal', name: 'Petal Shell', armor: 0.1, voidRes: 0, bonus: 'pow', text: 'Your actions hit harder. A pilgrim grew it in steam and was proud of it.' },
  { id: 'uniform', name: "Soldier's Uniform", armor: 0.22, voidRes: 0.1, text: 'Tattered. A pilgrim marched in it toward a war that was never there.' },
  { id: 'watchman', name: "Watchman's Plate", armor: 0.3, voidRes: 0.3, text: 'The face on it still changes. A pilgrim stood guard in it for longer than the gate existed.' },
  { id: 'coral', name: 'Coral Shell', armor: 0.2, voidRes: 0.2, text: 'Living rock. It smiles warmly. A pilgrim drowned in it and kept smiling.' },
  { id: 'feather', name: 'Storm Feather', armor: 0.08, voidRes: 0.1, bonus: 'float', text: 'You start every battle floating. A pilgrim flew in it until the coast was gone.' },
  { id: 'archive', name: 'Archive Binding', armor: 0.25, voidRes: 0.25, bonus: 'lies', text: 'Bound in faces. It was a pilgrim who wanted everything in order.' },
  { id: 'teeth', name: 'Yellow Teeth', armor: 0.12, voidRes: 0.1, bonus: 'strip', text: 'Strip hits harder. A pilgrim smiled through 1977 in it.' },
  { id: 'meat', name: 'Electronic Meat', armor: 0.3, voidRes: 0.15, text: 'Three inches of it. A pilgrim buried every feeling in here and never dug them up.' },
  { id: 'crystal', name: 'Crystal Shell', armor: 0.2, voidRes: 0.5, text: 'Colors that hurt to look at. A pilgrim tried to become the Stone in it.' },
  { id: 'stone', name: 'Stone-Skin', armor: 0.3, voidRes: 0.6, text: 'Warm. It is what a Light-Bound becomes. It belonged to someone who cooked for everyone.' },
  { id: 'void', name: 'Void Shell', armor: 0.15, voidRes: 0.9, text: 'Made of the Void itself. It fits you. That is the worrying part.' },
  { id: 'own', name: 'Your Own Shell', armor: 0.35, voidRes: 0.5, bonus: 'gain', text: 'Lost and found. It bloomed off you in the Clockwork Plaza. It is still warm.' },
] as ShellDef[]).map(s => [s.id, s]));

/** Concepts come from Unmake. A slotted concept is a passive. */
export const CONCEPTS: Record<string, ConceptDef> = Object.fromEntries(([
  { id: 'Protection', name: 'Protection', text: 'You take 10% less from every hit.' },
  { id: 'Song', name: 'Song', text: 'Echo costs nothing.' },
  { id: 'Hunger', name: 'Hunger', text: 'You gain 20% more Fragility from damage.' },
  { id: 'Turning', name: 'Turning', text: 'Walk moves up to two cells.' },
  { id: 'Forgetting', name: 'Forgetting', text: 'You cannot be made to forget an action.' },
  { id: 'Lostness', name: 'Lostness', text: 'Handshake always calms a Memory-Struck enemy.' },
  { id: 'Heat', name: 'Heat', text: 'Extract Emotion deals 20% more.' },
  { id: 'Bloom', name: 'Bloom', text: 'An absorbed emotion lasts two more rounds.' },
  { id: 'Soldier', name: 'Soldier', text: "Vorn's attacks deal 25% more." },
  { id: 'Rage', name: 'Rage', text: 'While Faded, you deal full damage instead of half.' },
  { id: 'Holding On', name: 'Holding On', text: 'Once per battle, a hit that would fade you leaves 1 Fragility.' },
  { id: 'Drift', name: 'Drift', text: 'Float also moves you two cells.' },
  { id: 'Sadness', name: 'Sadness', text: 'Absorbing a memory restores half again as much.' },
  { id: 'Weather', name: 'Weather', text: 'Reality breaks while Overloaded never hurt you.' },
  { id: 'Mouth', name: 'Mouth', text: 'Savor gains twice as much.' },
  { id: 'Nothing', name: 'Nothing', text: 'Void damage to you is cut by a further 30%.' },
  { id: 'Procedure', name: 'Procedure', text: 'Extract waits no rounds between uses.' },
  { id: 'Collection', name: 'Collection', text: 'You can hold six concepts instead of four.' },
  { id: 'Record', name: 'Record', text: 'Every battle starts with True Sight active.' },
  { id: 'Weather of Names', name: 'Weather of Names', text: 'Extract Name deals 30% more.' },
  { id: 'Order', name: 'Order', text: 'Overload starts at 90% instead of 80%.' },
  { id: 'Misery', name: 'Misery', text: 'Enemies that hit you lose a little Fragility too.' },
  { id: 'Burial', name: 'Burial', text: 'Your worn shell resists 20% more.' },
  { id: 'Purpose', name: 'Purpose', text: 'Faded starts at 10% instead of 20%.' },
  { id: 'Weight', name: 'Weight', text: 'Unmake deals 25% more.' },
  { id: 'Labor', name: 'Labor', text: 'Strip deals 20% more.' },
  { id: 'Despair', name: 'Despair', text: 'Below half Fragility, every action deals 20% more.' },
  { id: 'Edge', name: 'Edge', text: 'Scent marks make the next hit triple instead of double.' },
  { id: 'Silence', name: 'Silence', text: 'Your senses cannot be silenced.' },
  { id: 'Appetite', name: 'Appetite', text: 'Unmaking an enemy restores 10 Fragility.' },
  { id: 'Then', name: 'Then', text: 'Absorb waits one round less.' },
  { id: 'Wholeness', name: 'Wholeness', text: 'Steadying sets Fragility to 70% instead of 60%.' },
  { id: 'Spectrum', name: 'Spectrum', text: 'Weave costs a third less.' },
  { id: 'Absence', name: 'Absence', text: 'Enemy void attacks miss you one time in four.' },
  { id: 'Hope', name: 'Hope', text: 'Vorn recovers 10% health every round.' },
  { id: 'Choice', name: 'Choice', text: 'There is nothing left to choose.' },
  { id: 'Home', name: 'Home', text: 'An absorbed shell houses you twice as long.' },
  { id: 'Untranslatable', name: 'Untranslatable', text: 'Nothing can confuse you or make you forget.' },
] as ConceptDef[]).map(c => [c.id, c]));

/** The enemy groups each drifter in the field fights as. */
export const GROUPS: Record<string, string[]> = {
  tut_bird: ['clockwork_bird'],
  plaza_mites: ['cog_mite', 'cog_mite'],
  tower_golem: ['brass_golem'],
  tower_beasts: ['clockwork_beast', 'cog_mite'],
  tower_mix: ['brass_golem@guard', 'cog_mite', 'cog_mite@mender'],
  tower_birds: ['clockwork_bird', 'clockwork_bird'],
  lib_moths: ['page_moth', 'page_moth'],
  lib_child: ['lost_child'],
  lib_mix: ['page_moth', 'clockwork_beast'],
  lib_soldier: ['forgotten_soldier'],
  garden_wisps: ['steam_wisp', 'steam_wisp'],
  garden_blades: ['bloom_blade', 'steam_wisp'],
  garden_mix: ['clockwork_beast', 'bloom_blade'],
  garden_rage: ['rage_beast'],
  storm_brass: ['brass_golem@guard', 'clockwork_bird', 'clockwork_beast'],
  storm_brass2: ['cog_mite', 'cog_mite', 'cog_mite'],
  storm_brass3: ['brass_golem@guard', 'bloom_blade', 'steam_wisp@mender'],
  boss_watchman: ['watchman'],
  sea_crabs: ['tide_crab@guard', 'nameless_fish'],
  sea_gulls: ['storm_gull', 'storm_gull'],
  sea_walker: ['sadness_walker', 'nameless_fish'],
  light_child: ['lost_child', 'nameless_fish'],
  light_mix: ['sadness_walker@guard', 'storm_gull'],
  reef_coral: ['coral_mouth', 'nameless_fish'],
  reef_fish: ['nameless_fish@guard', 'nameless_fish', 'nameless_fish@mender'],
  reef_mix: ['tide_crab@guard', 'coral_mouth@mender'],
  storm_names: ['name_storm'],
  current_nothing: ['idea_of_nothing'],
  current_mix: ['idea_of_nothing', 'storm_gull'],
  current_child: ['lost_child', 'sadness_walker'],
  archive_paper: ['paper_walker@guard', 'paper_walker'],
  archive_collect: ['form_collector', 'record_keeper@mender'],
  archive_mix: ['form_collector@guard', 'paper_walker@mender', 'record_keeper@mender'],
  boss_archive: ['archive'],
  year_teeth: ['yellow_tooth', 'yellow_tooth'],
  year_meat: ['electronic_meat@guard', 'meat_drone@mender'],
  year_drones: ['the_forgotten@guard', 'meat_drone', 'meat_drone'],
  year_forgotten: ['the_forgotten'],
  year_symbol: ['symbol', 'yellow_tooth'],
  boss_despair: ['despair'],
  stone_shards: ['crystal_shard@guard', 'prism_mote'],
  stone_silence: ['concept_of_silence', 'crystal_shard'],
  stone_eater: ['nothing_eater'],
  stone_motes: ['prism_mote', 'prism_mote', 'prism_mote'],
  vault_beings: ['memory_being', 'memory_being'],
  vault_mix: ['memory_being', 'guardian_fragment'],
  void_eaters: ['nothing_eater', 'idea_of_nothing'],
  void_fragment: ['guardian_fragment@guard', 'concept_of_silence'],
  mini_voidwalker: ['void_walker'],
  boss_lbend: ['lightbound_end'],
  boss_guardian: ['guardian'],
};
