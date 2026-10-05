// Optional party talk, played from the Party menu. Each one plays once, on the listed maps, with everyone it needs in the party.
export interface TalkDef { id: string; maps: string[]; need: string[]; flag?: string; not?: string; lines: [string | null, string][]; }

export const TALKS: TalkDef[] = [
  {
    id: 'c1_mites', maps: ['lowmost', 'shallows'], need: ['someday'], flag: 'c1_dusk', not: 'c1_want',
    lines: [['hello', 'Do slipmites have askers?'], ['someday', 'Somebody asked for something small that would not go away. Probably about a cough.'], ['hello', 'That is sad.'], ['someday', 'Not to the mite.']],
  },
  {
    id: 'c1_shaft', maps: ['shaft1', 'shaft2'], need: ['someday'],
    lines: [['someday', 'Keep your hand on the wall. If the wall starts asking you for things, take your hand off the wall.'], ['hello', 'What does it ask for?'], ['someday', 'Rain, mostly. Old prayers want rain.']],
  },
  {
    id: 'c2_sit', maps: ['waiting'], need: ['someday'],
    lines: [['hello', 'What happened when you sat down in here?'], ['someday', 'I sat. A woman next to me said "lovely weather." I said "is it." Next thing I know it is forty years later and she is still waiting for me to answer.'], ['hello', 'Did you answer?'], ['someday', 'I said "is it" again. We are on good terms.']],
  },
  {
    id: 'c2_bigger', maps: ['waiting'], need: ['bigger', 'someday'], flag: 'c2_bigger',
    lines: [['bigger', 'NEW FRIEND SMALL.'], ['someday', 'Everyone is small to you.'], ['bigger', 'YES. ALL SMALL. ALL MINE TO WATCH.'], ['someday', '...That is either sweet or a threat.']],
  },
  {
    id: 'c3_city', maps: ['docket', 'cloister'], need: ['someday', 'bigger'],
    lines: [['hello', 'Did you live here, Someday? When you were a Lineman?'], ['someday', 'Lived on the Line. Came down here to pick up lists. Never stayed long enough to learn a street name.'], ['bigger', 'STREET?'], ['someday', 'Nobody throws a ball here, big one. Keep walking.']],
  },
  {
    id: 'c3_anyone', maps: ['cloister', 'vault', 'docket'], need: ['anyone'],
    lines: [['hello', 'What does the chorus sound like?'], ['anyone', 'Like a room where everyone is on hold at once and none of them are bored. I am sorry. That is the best I can do.'], ['hello', 'That sounds nice.'], ['anyone', 'It was. Please hold while I stop thinking about it.']],
  },
  {
    id: 'c4_again', maps: ['encore', 'inn'], need: ['again', 'someday'],
    lines: [['someday', 'Kid. A hundred thousand of the same day. What did you do with all of them?'], ['again', 'I learned every song the band knows. Backwards. I learned how many steps the mayor takes. Four hundred and eight.'], ['again', 'And I ate the cake. Every single time.'], ['someday', 'Good.']],
  },
  {
    id: 'c4_anyone', maps: ['encore', 'tower'], need: ['again', 'anyone'],
    lines: [['again', 'Anyone, can you hear Tomorrow knocking?'], ['anyone', 'Every night, at the hedge. It knocks in threes. Please. Let. Me.'], ['again', '...I always thought it said "not. yet. please."'], ['anyone', 'It might be both.']],
  },
  {
    id: 'c5_jackpot', maps: ['jackpot'], need: ['someday', 'again'],
    lines: [['again', 'Everyone here is so happy.'], ['someday', 'Look closer.'], ['again', '...Everyone here is so happy and nobody is having any fun.'], ['someday', 'There it is.']],
  },
  {
    id: 'c5_someone', maps: ['jackpot', 'arena'], need: ['someone'],
    lines: [['hello', 'What do you look like? Under all of them?'], ['someone', 'Darling, if I knew that, I would be wearing it.'], ['hello', 'I would like to see it, some time.'], ['someone', '...Ask me again later. I will think of a good one.']],
  },
  {
    id: 'c5_bigger', maps: ['arena'], need: ['bigger', 'someone'],
    lines: [['someone', 'Bigger, darling. Let me borrow your face for a moment.'], ['bigger', 'NO. MINE.'], ['someone', 'Fair. It would not fit through doors.']],
  },
  {
    id: 'c6_both', maps: ['wood_heart', 'wood_edge'], need: ['both'], flag: 'c6_hush',
    lines: [['first', 'I spoke first after the silence.'], ['firster', 'You did NOT. I said I WAS. You said I was NOT. "I" comes before "you".'], ['first', 'That is not how anything works.'], ['firster', 'Hello. Tell him.'], ['hello', 'It was a tie.'], ['first', '...A tie.'], ['firster', 'We accept.']],
  },
  {
    id: 'c6_someday', maps: ['wood_edge'], need: ['someday', 'anyone'],
    lines: [['anyone', 'Someday. When you walked people up the Line. Did any of them ask you to stop?'], ['someday', 'None of them. That was the worst part. They were all so glad.'], ['anyone', 'And now?'], ['someday', 'Now somebody is going to ask. Then I will know what to do.']],
  },
  {
    id: 'c7_up', maps: ['line1'], need: ['again', 'bigger'],
    lines: [['again', 'Do not look down.'], ['bigger', '(Bigger looks down.)'], ['bigger', 'BIG.'], ['again', 'I said do not.']],
  },
  {
    id: 'c7_both', maps: ['line1', 'catch'], need: ['both'],
    lines: [['first', 'I will be first to the top.'], ['firster', 'We share the legs.'], ['first', 'Then we will both be first, and I will be slightly more first.']],
  },
  {
    id: 'c8_alone', maps: ['shore'], need: [],
    lines: [['hello', 'Someday?'], [null, 'The sea comes in. The sea goes out. Nobody calls you sprout.'], ['hello', '...Okay.']],
  },
  {
    id: 'c8_life', maps: ['sea', 'wreck'], need: ['lifeboat', 'bigger'],
    lines: [['lifeboat', 'Large companion. Please confirm you do not require rescue.'], ['bigger', 'BALL?'], ['lifeboat', 'Ball is not a rescue category.'], ['bigger', 'SHOULD BE.'], ['lifeboat', '...Adding it.']],
  },
  {
    id: 'c8_again', maps: ['sea'], need: ['again', 'anyone'],
    lines: [['again', 'Anyone. If I wound everything back to before. Before the Catch. Someday would be here.'], ['anyone', 'She would. And she would step in front of Hello again.'], ['again', '...I know. That is why I am not doing it.']],
  },
  {
    id: 'c8_someone', maps: ['sea', 'wreck'], need: ['someone'], flag: 'c8_forgive',
    lines: [['someone', 'Everyone keeps looking at me like I am still wearing a face.'], ['hello', 'You are. It is yours.'], ['someone', '...It is not a very good one.'], ['hello', 'It is new. Give it time.']],
  },
  {
    id: 'c9_queue', maps: ['returnyard'], need: ['anyone', 'lifeboat'],
    lines: [['anyone', 'All these people are on hold, Lifeboat. Every one.'], ['lifeboat', 'Rescue targets: one thousand, six hundred and twelve. Rescue method: unclear.'], ['anyone', 'Maybe we just ask each of them what they want.'], ['lifeboat', 'That is not in my manual.'], ['anyone', 'It is in mine. It is the only thing in mine.']],
  },
  {
    id: 'c9_last', maps: ['engine'], need: ['bigger', 'again', 'anyone'],
    lines: [['bigger', 'HELLO. AFTER. BALL?'], ['hello', 'After. I promise.'], ['again', 'And cake.'], ['anyone', 'And a phone call. To no one in particular. Just to hear it ring.']],
  },
];
