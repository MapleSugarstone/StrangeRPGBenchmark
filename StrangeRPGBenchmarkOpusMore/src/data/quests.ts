// Side calls. A call's flag q_<id> holds its current step (1 and up), or DONE.
export const DONE = 100;

export interface QuestDef { title: string; from: string; chapter: number; steps: string[]; }

export const QUESTS: Record<string, QuestDef> = {
  sort: { title: 'Morning Sort', from: 'Mister Change', chapter: 1, steps: ['Mister Change at the Pleas Press needs the hopper sorted. Score 15 in one shift to earn a keepsake.'] },
  race: { title: 'Which Race', from: 'Runner', chapter: 1, steps: ['Runner wants a race: from Runner to the Listening Horn and back, before the count of twenty. Hold Shift to run.'] },
  goodboy: {
    title: 'Good at the Vet', from: 'Good Boy', chapter: 1,
    steps: ['Good Boy keeps whining toward the south road. Something of his is buried in the Shallows.', 'You dug up a dog tag in the Shallows. Bring it back to Good Boy.'],
  },
  ledger: {
    title: 'Four Hundred and Twelve', from: 'A torn page', chapter: 1,
    steps: ['A page torn from a Lineman\'s ledger, in a hand you know. There are more pages out there.', 'All twelve pages. Somewhere in the Deep Docket there is a room for mail nobody could deliver.'],
  },
  rightback: {
    title: 'Right Back', from: 'The Bride', chapter: 2,
    steps: [
      'The Bride in the south rows waits for someone who promised to come right back.',
      'A ghost in an apron in the east rows is waiting "right where back is". Tell the Bride.',
      'The Lost and Found still holds a ring engraved "always". Ask Claim for it.',
    ],
  },
  chairs: { title: 'It Passes the Time', from: 'The Knitters', chapter: 2, steps: ['The two knitters run a game of musical chairs. Take the last chair.'] },
  update: { title: 'Ninety-Nine Percent', from: 'The Updater', chapter: 2, steps: ['A robot in the north rows has read 99 percent for eleven centuries. Maybe it needs company.'] },
  balloon: {
    title: 'Up There', from: 'A kid in the Waiting Room', chapter: 2,
    steps: [
      'A kid let go of a balloon Above and prayed it would be okay. Is it okay?',
      'A red balloon is snagged in the Catch. The kid would want to know.',
      'You have the balloon. The kid was in the Waiting Room. Wherever they are now, they are still looking up.',
    ],
  },
  unsent: {
    title: 'I Am Sorry About The', from: 'A walking letter', chapter: 3,
    steps: ['A letter in the Docket plaza cannot finish its sentence. The rest of it is somewhere in the Docket.', 'A torn strip from the dead-letter tray in the Vault. It ends the sentence. Bring it back to the letter.'],
  },
  board: { title: 'Covering the Board', from: 'A choir Saint', chapter: 3, steps: ['A Saint in the Cloister needs someone to cover a switchboard while the choir rehearses. Patch 20 calls in one shift.'] },
  postcard: { title: 'Something Else', from: 'A man in the queue', chapter: 3, steps: ['A quiet man in the Return queue is afraid his asker will not want him now. Something to write on might help.'] },
  thirdline: {
    title: 'The Third Line', from: 'The Poet', chapter: 4,
    steps: ['The Poet (out at dusk) needs a true thing that happened today, not yesterday, for the third line.', 'The man with the little box asked her today. Tell the Poet before Bedtime.'],
  },
  echo: { title: 'Again, Again', from: 'Again', chapter: 4, steps: ['Again wants to play Echo at the fountain. Ring back seven bells in a row.'] },
  nearly: { title: 'Nearly', from: 'Nearly', chapter: 5, steps: ['Nearly wants to lose at cards, just once. Nobody in Jackpot can make that happen. You are not from Jackpot.'] },
  bees: { title: 'B-E-E-S', from: 'The bee kid', chapter: 5, steps: ['The bee kid wins every spelling bee, and the bees follow. Their queen keeps a hive in the alley behind the gift shop.'] },
  exhibition: { title: 'Exhibition Bouts', from: 'The Announcer', chapter: 5, steps: ['The Losing Games run exhibition bouts after hours. Win three. Stakes are high, and so are the purses.'] },
  unsaid: {
    title: 'Unsaid', from: 'The Unspoken Wood', chapter: 6,
    steps: ['Scraps of paper lie in the Wood, each one a word somebody never said. Find four.', 'Sound is back. Bring the four words to the pale figure who sits by the eastern trees.'],
  },
  bottles: { title: 'Bottle Mail', from: 'The Sea', chapter: 8, steps: ['The Sea keeps bringing bottles to the end of the shore. Fish five out in one go.'] },
  crew: { title: 'Crew Status', from: 'Lifeboat', chapter: 8, steps: ['Lifeboat never learned the names of the crew it came for. Four nameplates are somewhere in the Ark.'] },
};

// Pages of Someday's ledger. Each lists names she delivered, with what she wrote in the margin afterward.
export const PAGES: { names: string; note: string }[] = [
  { names: 'MABEL TWO-STEP. Asked for by: a dancer with bad knees. Status: asker deceased.', note: 'She danced on the rungs the whole way up. I told her to hold on with both hands.' },
  { names: 'ORRIN, A PAIR OF REAL BOOTS. Asked for by: a boy in a cold country. Status: world not found.', note: 'I carried him up because he had no feet. He was a pair of boots. He talked the whole time about snow.' },
  { names: 'THE QUIET HOUR. Asked for by: a nurse on a night shift. Status: asker deceased.', note: 'She did not say a word all the way up. I think that was the point of her.' },
  { names: 'A SECOND CHANCE. Asked for by: unknown. Status: asker not found.', note: 'Nobody knew who asked. It went anyway. It said it was used to that.' },
  { names: 'BRAMBLE, A GOOD GOAT. Asked for by: a farm girl. Status: asker deceased.', note: 'Ate my ladder rope halfway up. Best company I had on the Line.' },
  { names: 'GRANDMOTHER (SPARE). Asked for by: a boy whose grandmother was ill. Status: asker deceased.', note: 'She knitted me a scarf on the way up. I still have it. I do not wear it.' },
  { names: 'THE WINNING GOAL. Asked for by: a striker in a final. Status: asker deceased.', note: 'It kept asking if it had gone in. I said yes. I do not know.' },
  { names: 'CAPTAIN FAIRWIND. Asked for by: a sailor becalmed. Status: world not found.', note: 'He blew on the back of my neck all the way up, to help.' },
  { names: 'THE LETTER FROM HOME. Asked for by: a soldier. Status: asker deceased.', note: 'It was addressed to him. I could not stop reading the address.' },
  { names: 'A LITTLE BROTHER. Asked for by: a girl who wanted someone to look after. Status: asker deceased.', note: 'He held my hand. I counted rungs out loud so he would not be scared. Three thousand and six.' },
  { names: 'NINETY MORE YEARS. Asked for by: an old man. Status: asker deceased.', note: 'He laughed when he read it. He said, well, I had them, did I not.' },
  { names: 'NUMBER FOUR HUNDRED AND TWELVE. A LULLABY. Asked for by: a mother. Status: asker deceased.', note: 'I sang it to her on the way up. She knew the words already. That was the last one. I put the hook down after that.' },
];
