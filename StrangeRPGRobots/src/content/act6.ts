// Chapter 6 data: the last main quest and the loot on the sea face.
import { addQuests } from './quests';
import { addLoot } from './loot';

addQuests([
  {
    id: 'crown',
    title: 'The Crown',
    kind: 'main',
    xp: 1000,
    stages: {
      '1': 'The hatch opens on the seaward face of the Wall. Climb the maintenance stairs to the Brim. The sea wind blows anyone away from cover.',
      '2': 'Board Plaza is open. Enter the Crown at the top of the plaza steps.',
      '3': "The lift bank in the Crown's lobby ascends to the Pump Hall.",
      '4': 'In the Pump Hall, Teun has Kees at the Founding Pump.',
      '5': 'Marit wants to see the sea. The door to the Seawalk is at the top of the east gallery.',
      done: 'Marit saw the sea from the top of the Wall.',
    },
    where: {
      '1': ['seawall', 'top'],
      '2': ['boardplaza', 'crown_door'],
      '3': ['crown', 'lift_front'],
      '4': ['pumphall', 'hero_climax'],
      '5': ['pumphall', 'hall_door'],
    },
  },
]);

addLoot({
  brim_locker: { items: [['bigstim', 1, 0.8], ['shockgren', 1, 0.6], ['ration', 2, 1]], gilt: [60, 140] },
});
