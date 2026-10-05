import type { GameState } from './state';

// The current objective, read from story flags. Shown with Tab in the field and on the Slip page.
export function goal(s: GameState): string {
  const f = (k: string) => !!s.flags[k];
  const has = (k: string) => (s.inv[k] ?? 0) > 0;
  switch (s.chapter) {
    case 1:
      if (!f('c1_net')) return 'Take the mended net to Gale at the Shallows, south of town.';
      if (!f('c1_dusk')) return 'Talk to Gale at the Shallows and wait for dusk.';
      if (!f('c1_want')) return 'Go down the Old Shaft at the east edge of town and find what is eating the slips.';
      if (!f('c1_mentor')) return "Go home to Someday's hut.";
      return 'Take the north road out of Lowmost.';
    case 2:
      if (!f('c2_recept')) return 'Talk to the Receptionist at the desk near the entrance.';
      if (!f('c2_bigger') && !has('ball')) return f('c2_sawbig') ? 'The big dog lost something. The Lost and Found is on the east wall.' : 'Find out why the line is not moving. Number Three went north.';
      if (!f('c2_bigger')) return 'Bring the red ball to the big dog at the turnstile.';
      if (!f('c2_three')) return 'Find Number Three in the northwest rows.';
      return 'Take Number Three to the window at the north end.';
    case 3:
      if (!f('c3_anyone')) return 'Head north into the Cloister. Something in the west chapel is silent.';
      if (!f('pz_inner')) return 'Route power from the gold socket to the red one to open the inner gate.';
      if (!f('pz_vault')) return 'Route power in the upper hall to open the Vault.';
      return "Find Fen's name in the Manifest Vault.";
    case 4:
      if (f('c4_done')) return 'Take the south road out of Encore.';
      if (!f('k_again')) return 'Rest at the Festival Inn on the west side of the plaza.';
      if (!f('k_name')) return "Learn the festival's name. Someone sits by the east hedge at dusk.";
      if (!has('towerkey')) return "Tell the Mayor the festival's name during the noon parade.";
      return 'Use the festival key on the clock tower door, northwest.';
    case 5:
      if (!f('c5_reg')) return 'Register for the Losing Games at the arena, north.';
      if (!f('c5_house')) return 'Win the Losing Games. Talk to the Announcer for each bout.';
      return 'Take the east road toward the Unspoken Wood.';
    case 6:
      if (!f('c6_camp')) return 'Walk to the treeline in the east.';
      if (!f('c6_both')) return 'Find a way north through the Wood. Someone waits in a clearing.';
      if (!f('c6_hushev')) return 'One of you on each plate. Meet in the north clearing.';
      if (!f('c6_hush')) return 'Face whatever is eating the sound.';
      if (!f('c6_gone')) return 'Go north to the foot of the Line.';
      return 'Climb the ladder up the Line.';
    case 7:
      if (!f('c7_catchin')) return 'Climb the Line. Mind the wind.';
      return 'Reach the Forwarding Pens at the north edge of the Catch.';
    case 8: {
      if (!f('c8_raft')) return 'Look at the sea.';
      if (!f('c8_lifeboat')) return 'Sail to the wreck at the center of the sea.';
      const n = ['bigger', 'anyone', 'again', 'both'].filter((id) => f('c8_r_' + id)).length;
      if (n < 4) return `Find everyone scattered across the sea (${n} of 4). Lifeboat can cross the currents.`;
      if (!f('c8_se')) return 'Someone is drifting on a raft to the east.';
      return 'Lifeboat knows the way to the Return.';
    }
    case 9:
      if (!f('c9_engin')) return 'Enter the Return at the north end of the yard.';
      return 'Climb the Return. Amen is at the top.';
  }
  return 'Keep going.';
}
