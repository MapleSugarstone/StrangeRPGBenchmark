import { runBattle } from '../core/bots';
import { planBattle, randomEncounter } from '../core/encounter';
import { applyResult, fullHeal, newGame } from '../core/party';
import { EndChapter, runScript, type BattleResult, type Host } from '../core/script';
import { Rng } from '../core/rng';
import { chapter } from '../story/chapters';
import { avgLevel, needsRest, pickParty, shop, upkeep } from '../sim/simlib';

export interface PlayLog {
  chapter: number;
  level: number;
  bossTries: number;
  fights: number;
  wipes: number;
  gold: number;
}

/** Plays the real story scripts headlessly with the smart bot. Returns per-chapter logs. */
export async function playthrough(seed: number, encountersPerRoom = 2, choiceIdx = 0): Promise<{ logs: PlayLog[]; state: ReturnType<typeof newGame>; lines: number; ended: boolean }> {
  const rng = new Rng(seed);
  const state = newGame(1);
  let lines = 0;
  const logs: PlayLog[] = [];
  let cur: PlayLog = { chapter: 1, level: 1, bossTries: 0, fights: 0, wipes: 0, gold: 0 };

  const fightOnce = (foes: string[], boss: boolean, pos: number): BattleResult => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const plan = planBattle(state, foes, boss, rng, boss ? 0.85 : pos, false, attempt);
      runBattle(plan.battle, 'smart', rng);
      const res = plan.battle.over === 'win' ? 'win' : 'lose';
      applyResult(state, plan.battle, res === 'win' ? plan.xp : 0, res === 'win' ? plan.gold : 0);
      cur.fights++;
      if (res === 'win') return 'win';
      cur.wipes++;
      if (boss) cur.bossTries++;
      fullHeal(state);
    }
    throw new Error(`Party could not beat ${foes.join(',')} in chapter ${state.chapter}`);
  };

  const host: Host = {
    state,
    say: async () => { lines++; },
    card: async () => {},
    choice: async () => choiceIdx,
    notify: async () => {},
    fx: async () => {},
    heal: () => fullHeal(state),
    battle: async (foes, boss) => { if (boss) cur.bossTries++; return fightOnce(foes, boss, 0.5); },
  };

  let ended = false;
  for (let ch = 1; ch <= 12 && !ended; ch++) {
    state.chapter = ch;
    state.beat = 0;
    cur = { chapter: ch, level: avgLevel(state), bossTries: 0, fights: 0, wipes: 0, gold: 0 };
    const def = chapter(ch);
    const goldStart = state.gold;
    for (let i = 0; i < 8; i++) {
      // Random fights on the way to each beat, as in the wilds rooms 2 to 7.
      if (i >= 1 && i <= 6 && !(ch === 1 && i < 3)) {
        for (let k = 0; k < encountersPerRoom; k++) {
          pickParty(state, state.active);
          fightOnce(randomEncounter(state, rng, i + 1), false, (i - 1) / 5);
          upkeep(state);
          if (needsRest(state)) fullHeal(state);
        }
        if (i === 4) fullHeal(state);
      }
      try {
        await runScript(def.beats[i].script, host);
        state.beat = i + 1;
      } catch (e) {
        if (e instanceof EndChapter) { if (ch === 12) ended = true; break; }
        throw e;
      }
      if (i === 4) fullHeal(state);
    }
    cur.gold = state.gold - goldStart;
    logs.push(cur);
    if (ch < 12) { shop(state, ch + 1); fullHeal(state); }
  }
  return { logs, state, lines, ended };
}

if (process.argv[1]?.endsWith('playthrough.js')) {
  const seeds = Number(process.argv[2] ?? 3);
  const perRoom = Number(process.argv[3] ?? 2);
  for (let s = 1; s <= seeds; s++) {
    const r = await playthrough(s * 31, perRoom, s % 2);
    console.log(`\nSeed ${s}: ended=${r.ended} dialogue lines=${r.lines} final gold=${r.state.gold} ending=${r.state.flags.ending_dusk ? 'dusk' : r.state.flags.ending_half ? 'half' : 'none'}`);
    console.log('ch | start lvl | fights | boss tries | wipes');
    for (const l of r.logs) console.log(`${String(l.chapter).padStart(2)} | ${l.level.toFixed(1).padStart(8)} | ${String(l.fights).padStart(6)} | ${String(l.bossTries).padStart(10)} | ${String(l.wipes).padStart(5)}`);
    if (!r.ended) { console.error('FAIL: story did not reach the ending'); process.exit(1); }
  }
  console.log('\nPlaythrough OK.');
}
