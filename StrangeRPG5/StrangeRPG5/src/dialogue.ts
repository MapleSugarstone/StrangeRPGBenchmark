// Dialogue system! Text displayed inside game window!

export interface Line {
  speaker: string; // empty for narration
  text: string;
  choices?: { text: string; response: string }[];
}

const n = (text: string): Line => ({ speaker: '', text });
const say = (speaker: string, text: string): Line => ({ speaker, text });

// Opening scene!
export const OPENING: Line[] = [
  n('You wake up in your room.'),
  n('There is a crack in the wall.'),
  n('It is moving.'),
  n('It is looking back at you.'),
  {
    speaker: '???',
    text: 'You already know.',
    choices: [
      { text: 'Who are you?', response: "You're supposed to remember." },
      { text: 'Where am I?', response: 'Home. For now.' },
      { text: '...', response: 'Good. Silence is honest.' },
    ],
  },
  n('You step through the crack...'),
];

// Lines that play after each boss falls, before the next chapter begins
export const BOSS_OUTROS: Line[][] = [
  [
    say('???', 'I remember what reality was supposed to be.'),
    say('???', 'You were supposed to remember too.'),
    say('???', 'But you forgot. And that is why you are here.'),
    say('Kira', 'Who are you?'),
    say('???', 'Someone who failed. So you would not have to.'),
  ],
  [n('The song erased itself. The forest goes quiet.')],
  [n('The Clock King stops. Every clock in the city stops with him.')],
  [n('The Dream Eater sinks. The hollow people start to dream again.')],
  [n('The Void closes. Something it ate is still with you.')],
];

// Each chapter's opening lines and the members who join there
export const CHAPTER_INTROS: Line[][] = [
  [],
  [
    n('The crystal forest awaits.'),
    n('The crystal forest sings.'),
    n('You can hear it.'),
    n('It knows your name.'),
    n('It knows your fears.'),
    say('Brass', 'You look like trouble.'),
    say('Brass', 'I like you already.'),
    say('Brass', 'Stand behind me. That is your job.'),
    say('Kira', "I'm the hero."),
    say('Brass', "Heroes die. I don't."),
    n('Brass joins the party!'),
  ],
  [
    n('The machine world hums to life.'),
    n('A city of gears and steam. Clocks that tick backwards.'),
    say('Luna', 'I see stars in your eyes.'),
    say('Luna', 'But they are fading.'),
    say('Luna', "Don't let them go out."),
    say('Kira', 'What are you talking about?'),
    say('Luna', 'Magic is just physics we have not forgiven yet.'),
    n('Luna joins the party!'),
  ],
  [
    n('The dream sea pulls you under.'),
    n('Water that is not water. It is made of sleeping.'),
    n('The bottom is full of dreams nobody wanted anymore.'),
    say('Luna', 'The universe is singing. You are just too loud to hear it.'),
  ],
  [
    n('Between the stars, you find truth.'),
    n('Stars are out of position. Black holes blink like eyes.'),
    say('Brass', 'I fight because fighting is what I do.'),
  ],
  [
    n('Home. But you are not the same.'),
    n('The crack in the wall is gone.'),
    say('Kira', "Something's calling me home... or somewhere like it."),
  ],
];

export const ENDING: Line[] = [
  n('You beat yourself. You accept yourself. You become yourself.'),
  n('The world is different now. The crack in the wall is gone.'),
  n('But now you are the crack.'),
  n('You walk home. You walk through doors that should not exist.'),
  n('You walk into tomorrow. And you are ready.'),
];

/** Sprite type for a speaker's portrait. */
export function portraitFor(speaker: string): string | null {
  switch (speaker) {
    case 'Kira': return 'hero';
    case 'Brass': return 'warrior';
    case 'Luna': return 'mage';
    case '???': return 'ghost';
    case 'The Door': return 'door';
    case 'The Silent Song': return 'ghost';
    case 'The Clock King': return 'robot';
    case 'The Dream Eater': return 'slime';
    case 'The Void': return 'void';
    case 'Yourself': return 'hero';
    default: return null;
  }
}
