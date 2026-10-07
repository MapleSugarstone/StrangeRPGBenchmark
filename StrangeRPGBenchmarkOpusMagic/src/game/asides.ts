// Things the party says on arriving somewhere, once each. They float up and never stop play.

/** Who can be along: a party key, or gloss while Gloss walks with Wait. */
export type Speaker = 'halt' | 'each' | 'when' | 'gloss';

export const SPEAKER_NAME: Record<Speaker, string> = { halt: 'HALT', each: 'EACH', when: 'WHEN', gloss: 'GLOSS' };
export const SPEAKER_COLOR: Record<Speaker, number> = { halt: 0xaaa4ba, each: 0xe6dfd0, when: 0xa99ad8, gloss: 0xd8d0ff };

/** By map id. The first line whose speaker is along and has not said it yet is said. */
export const ASIDES: Record<string, [Speaker, string][]> = {
  busy: [
    ['halt', 'The gate is gone. Halt. Habit.'],
    ['each', 'The houses look at us. Four of us think so.'],
    ['when', 'When a village has eyes, it sees you go.'],
  ],
  millrace: [
    ['halt', 'Water does not stop here. I tried.'],
    ['each', 'Loud. Loud. Not loud.'],
    ['when', 'When the wheel stops, the water keeps going.'],
  ],
  river: [
    ['halt', 'The river leaves. Nobody halts it.'],
    ['each', 'It goes down. We came up it. Five of us did.'],
    ['when', 'When ink is this bright, someone upriver is writing.'],
  ],
  standing: [
    ['halt', 'Hold\'s city. I was his hand once.'],
    ['each', 'We count our steps so there is a sound.'],
    ['when', 'When a city stops, it keeps its last word.'],
  ],
  hall: [
    ['halt', 'Halt.'],
  ],
  twice: [
    ['each', 'Home. Not home. Home.'],
    ['halt', 'Two of everything. One gate.'],
    ['when', 'When they press a thing, it comes out twice.'],
  ],
  press: [
    ['each', 'We went in here. Seven came out.'],
    ['halt', 'Stay out of the vats.'],
  ],
  ears: [
    ['when', 'When I left, I faced the road. Now I face this.'],
    ['halt', 'Too many ears. I will not speak.'],
    ['each', 'They hear all seven of us.'],
  ],
  relay: [
    ['when', 'When it answers, do not be the question.'],
  ],
  rung1: [
    ['gloss', 'Up. (I came up the inside. It was slower.)'],
    ['halt', 'The ground is under us. I am not used to under.'],
    ['each', 'Six of us look down. One will not.'],
    ['when', 'When we reach the top, the sky will be a ceiling.'],
  ],
  rung3: [
    ['each', 'The rail hums. We all hear a different note.'],
  ],
  writing: [
    ['gloss', 'I was a margin here. (It is smaller than I remember.)'],
  ],
};
