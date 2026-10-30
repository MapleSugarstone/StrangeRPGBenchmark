// Hub side quests on the Stair and the Brim: journal entries, two shops, a loot table, and an item.
import { addQuests, type QuestDef } from './quests';
import { addShops } from './shops';
import { addLoot } from './loot';
import { addItems } from '../rules/data';

addItems([
  { id: 'tomato', name: 'Terrace Tomato', kind: 'food', price: 4, supplies: 4, stack: true, desc: 'Grown under Board lamps on Terrace 4. Yield: 4 supplies.' },
]);

function side(id: string, title: string, xp: number, goal: string, where: [string, string]): QuestDef {
  return { id, title, kind: 'side', xp, stages: { '1': goal, done: `${title} is settled.` }, where: { '1': where } };
}

addQuests([
  side('hq_vend', 'The Dancing Machine', 80, 'A Board wake inspector wants Tova\'s dancing noodle machine on the upper Steps taken to Lost Property tonight.', ['steps', 'kat_spot']),
  side('hq_pa', 'Mind the Step', 80, 'A Board speaker box on the Steps says "mind the step" every eleven seconds, all night. A neighbor wants it quiet.', ['steps', 'kiosk_front']),
  side('hq_lid', 'Lid', 80, 'Daan woke his racing bin Lid with Line 4. An angry bin is about to go down the terrace ramp.', ['terraces', 'kids_top']),
  side('hq_lamps', 'Board Light', 100, 'The Board cuts the free grow lamps on Terrace 4 tonight. The gardeners want their light.', ['terraces', 'garden']),
  side('hq_ring', 'The Second Ring', 80, 'Baas and Wendel moved up to Terrace 2 and credit Ignace\'s ring. Their daughter on Canal Six wants one too.', ['terraces', 'ring_front']),
  side('hq_audit', 'Paid in Full', 120, 'A Bodywell auditor on the plaza has found the leases you hacked.', ['plaza', 'audit_spot']),
  side('hq_tears', 'Saint\'s Tears', 100, 'Mertens is back, on the plaza, selling water from the statue\'s drain as Saint\'s Tears.', ['plaza', 'tears_front']),
  side('hq_visit', 'Visiting Hours', 80, 'Mevrouw Prins missed visiting hours at Mercy Spire. Her mother is on floor six.', ['spirebase', 'visit_spot']),
  side('hq_bram', 'The Inquiry', 120, 'The Board is holding an inquiry into the night Bram opened the upper gate. He will lose his tower.', ['boardplaza', 'bram_spot']),
  side('hq_drone', 'Courier', 100, 'A Recovery tapper wants to hush the courier drone that sleeps on Mevrouw Oud\'s balcony rail.', ['boardplaza', 'oud_spot']),
]);

addShops([
  { id: 'greens', name: 'Terrace Greens', items: ['tomato', 'loaf', 'krill', 'plumcake'], rate: 0.8 },
  { id: 'brim_commissary', name: 'Board Commissary', items: ['vest', 'weave', 'smart', 'stunner', 'bigstim', 'ration', 'shockgren', 'hush'], rate: 1.2 },
]);

addLoot({
  hub_locker: { items: [['stim', 2, 0.8], ['tomato', 3, 1], ['chip', 1, 0.5]], gilt: [20, 60] },
});
