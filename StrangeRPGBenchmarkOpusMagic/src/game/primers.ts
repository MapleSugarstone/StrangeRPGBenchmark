// Gloss's manuals, as the player reads them in game. Code lines start with two spaces and are drawn in color.

export interface PrimerPage { title: string; body: string[] }
export interface Primer { id: string; name: string; pages: PrimerPage[] }

export const PRIMERS: Primer[] = [
  {
    id: 'primer1', name: 'The First Primer', pages: [
      { title: 'The Cant', body: ['A rote is a list of lines.', 'A line says one thing.', 'Lines run from the top down.', '', '(Yours has room.', 'Most do not.)', '', 'Open your rote with X, then', 'Rote. Pick an empty page and', 'write. Esc puts the book away.'] },
      { title: 'Words that do', body: ['  strike foe', 'Hits foe for 3. 1 ink.', '  mend me', 'Heals 4. 2 ink.', '  ward me', 'Takes the next 4 harm for you', 'until your next turn. 2 ink.', '', '(Leave off the name and the', 'word guesses. Harm goes to', 'foe. Help goes to you.)'] },
      { title: 'Names', body: ['  me', 'You.', '  foe', 'The one you pointed at when', 'you cast.', '', '(Foe is whoever you point at.', 'It does not have to be an', 'enemy.)'] },
      { title: 'wait', body: ['  strike foe', '  wait', '  strike foe', 'Hits now. Stops at wait. Next', 'turn it goes on by itself and', 'hits again, and you still get', 'your turn.', '', '(You know this word already.)'] },
      { title: 'Ink', body: ['Every word that does something', 'costs ink. You get some back', 'each turn.', '', 'A spell that runs dry stops', 'where it is.', '', '(Plan for the line after the', 'dry one. It will not happen.)'] },
      { title: 'say', body: ['  say "hello"', '  say foe.hp', 'Puts it in the log. It costs', 'nothing.', '', '(Use it to see what a spell', 'thinks is true. Every line you', 'run gives off light, even', 'this one.)'] },
      { title: 'Asides', body: ['  # this is an aside', 'Anything after # is an aside.', 'Asides do not run and take no', 'room.', '', '(The Scrivener wrote asides on', 'everything. Read them.)'] },
      { title: 'Reading', body: ['In a fight, Read shows a', 'foe\'s rote. The arrow is the', 'line it will run next.', '', 'In the field, face a thing and', 'press Z to read it. Press C to', 'cast a page at it.', '', '(Most doors here are written.)'] },
    ],
  },
  {
    id: 'primer1_repeat', name: 'The Torn Page', pages: [
      { title: 'repeat', body: ['  repeat 3:', '    strike foe', 'Runs the lines under it 3', 'times. Push them in two', 'spaces. Enter does it for you.', '', '  repeat 3: strike foe', 'One line can sit after the', 'colon instead.', '', '(Room is short.)'] },
    ],
  },
  {
    id: 'primer2', name: 'The Second Primer', pages: [
      { title: 'if', body: ['  if foe.hp < 4:', '    strike foe', 'Runs the lines under it only', 'if the thing after if is true.'] },
      { title: 'else', body: ['  if foe.hp < 4:', '    strike foe', '  else:', '    soak foe', 'else goes under an if, at the', 'same depth. Its lines run when', 'the if did not.'] },
      { title: 'Looking', body: ['  foe.hp     health left', '  foe.max    most health', '  foe.ward   ward on it', '  foe.wet    turns of wet', '  foe.burn   burn on it', '  foe.armor  harm it shrugs', '  foe.next   its next verb', '  foe.acted  verbs this round', '  me.ink     your ink', '', '(Look before you spend.)'] },
      { title: 'Comparing', body: ['  <  >  <=  >=  ==  !=', 'is means ==. is not means !=.', '', '  and  or  not', 'Join them.', '', '  yes  no', 'True and false.'] },
      { title: 'Words as things', body: ['  if foe.next is "bite":', '    ward me', 'True when the next thing foe', 'will do is bite.', '', '(Words in quotes are only', 'words. They do nothing until', 'something does them.)'] },
      { title: 'soak', body: ['  soak foe', 'Wet for 2 rounds. 1 ink.', '', 'Wet does no harm by itself.', 'Jolt hurts wet things more.', 'Wet things do not burn.', '', '(Some locks want wet.)'] },
      { title: 'jolt', body: ['  soak foe', '  jolt foe', 'jolt does 2 through armor,', 'or 6 if foe is wet. 2 ink.', 'The wet dries.', '', '(Armor shrugs off strikes.', 'It does not shrug off jolt.)'] },
    ],
  },
  {
    id: 'primer3', name: 'The Third Primer', pages: [
      { title: 'let', body: ['  let n = 3', '  let t = foe', 'Gives a name to a thing. Use', 'the name after.', '', '  let t = first(foes)', '  strike t'] },
      { title: 'Lists', body: ['  foes', 'Every foe still up.', '  allies', 'You and yours, still up.', '', '  count(foes)  how many', '  first(foes)  the first', '  last(foes)   the last'] },
      { title: 'each', body: ['  each f in foes:', '    strike f', 'Runs the lines under it once', 'for every foe, with f standing', 'for that foe.', '', '(Each\'s word. Each lends it', 'while Each is with you and', 'up.)'] },
      { title: 'Lent words', body: ['A word lent by a companion', 'goes quiet if they go down.', 'Quiet lines are gray. They', 'take a step and do nothing.', '', '(Keep them up. Your spells', 'are written in their words.)'] },
    ],
  },
  {
    id: 'primer4', name: 'The Listening Primer', pages: [
      { title: 'when', body: ['  when hurt:', '    mend me', 'Does nothing now. When you', 'are hurt, the lines under it', 'run. Once a round at most.', '', '(When\'s word.)'] },
      { title: 'Events', body: ['  hurt         you are harmed', '  ally hurt    one of yours', '  foe acts     a foe is about', '               to act', '  foe falls    a foe goes down', '  round ends   the round ends', '', '  when hurt 3 times:', 'Every third time.'] },
      { title: 'who and by', body: ['  when ally hurt:', '    mend who', '  when foe acts:', '    if who.next is "burst":', '      halt who', 'who is the one it happened to.', 'by is the one who did it.'] },
      { title: 'Hands', body: ['A page with a when in it', 'stays in your hand until the', 'fight ends.', '', 'With the Second Hand, two', 'pages can run at once. Listen', 'with one. Strike with the', 'other.', '', '(A new spell pushes out the', 'oldest one.)'] },
    ],
  },
  {
    id: 'red_primer', name: 'Once\'s notebook', pages: [
      { title: 'once. first spell.', body: ['  say "once"'] },
      { title: 'once. second.', body: ['  strike foe', '  strike foe', '', 'g: one is enough'] },
      { title: 'erase', body: ['  erase foe', 'takes out the next line foe', 'would run. 5 ink. it does not', 'come back. a rote with nothing', 'left in it stops.', '', 'g: not on people.', 'o: why not'] },
      { title: '', body: ['o: i took the repeat page out', '   of the first primer. i', '   wanted to practice it.', 'g: you could have asked.', 'o: you would have said wait.'] },
      { title: '', body: ['o: how do i not stop', 'g: you stop. everyone stops.', 'o: what is the word', 'g: there is no word', 'o: you used a parenthesis.', '   you only do that when it', '   is true'] },
      { title: '', body: ['  again', '', 'g: no'] },
      { title: '', body: ['  say "once"', '  again'] },
    ],
  },
];

export const PRIMER: Record<string, Primer> = Object.fromEntries(PRIMERS.map((p) => [p.id, p]));
