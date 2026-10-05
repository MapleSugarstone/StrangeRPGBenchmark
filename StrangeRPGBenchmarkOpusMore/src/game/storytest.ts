// Debug-only: drives the whole story through its scripts, auto-advancing dialogue and forcing fights to end.
import type { Game } from './game';
import type { FieldScene } from '../scenes/field';
import type { BattleScene } from '../scenes/battle';
import { ENEMIES } from '../data/enemies';

type Step = { do: 'talk' | 'trig' | 'exit' | 'flag' | 'place' | 'partner' | 'note'; a?: string | number; b?: number; c?: number; choose?: number[] };

const STEPS: Step[] = [
  { do: 'note', a: 'ch1' },
  { do: 'exit', a: 'hut', b: 6, c: 8 },
  { do: 'exit', a: 'lowmost', b: 15, c: 25 },
  { do: 'talk', a: 'gale' }, { do: 'talk', a: 'gale', choose: [0] },
  { do: 'exit', a: 'lowmost', b: 31, c: 19 },
  { do: 'trig', a: 2, b: 18 },
  { do: 'exit', a: 'shaft1', b: 25, c: 18 },
  { do: 'trig', a: 20, b: 17 },
  { do: 'exit', a: 'hut', b: 6, c: 8 },
  { do: 'exit', a: 'lowmost', b: 15, c: 0 },
  { do: 'note', a: 'ch2' },
  { do: 'talk', a: 'recept' }, { do: 'talk', a: 'claim' },
  { do: 'trig', a: 20, b: 11 }, { do: 'talk', a: 'three', choose: [1] },
  { do: 'trig', a: 20, b: 3, choose: [0, 0] },
  { do: 'note', a: 'ch3' },
  { do: 'exit', a: 'docket', b: 17, c: 0 },
  { do: 'trig', a: 2, b: 18 },
  { do: 'flag', a: 'pz_inner' }, { do: 'flag', a: 'pz_vault' },
  { do: 'exit', a: 'cloister', b: 19, c: 0 },
  { do: 'trig', a: 9, b: 11 },
  { do: 'note', a: 'ch4' },
  { do: 'exit', a: 'encore', b: 6, c: 19 },
  { do: 'talk', a: 'innkeep', choose: [0, 0] },
  { do: 'flag', a: 'k_name' }, { do: 'exit', a: 'inn', b: 5, c: 9 }, { do: 'flag', a: 'd_phase', b: 1 },
  { do: 'talk', a: 'mayor' },
  { do: 'trig', a: 6, b: 7 },
  { do: 'trig', a: 1, b: 7 },
  { do: 'exit', a: 'encore', b: 16, c: 29 },
  { do: 'note', a: 'ch5' },
  { do: 'trig', a: 19, b: 8 },
  { do: 'talk', a: 'announcer' }, { do: 'talk', a: 'announcer', choose: [0] }, { do: 'talk', a: 'announcer', choose: [0] }, { do: 'talk', a: 'announcer', choose: [0, 1] },
  { do: 'exit', a: 'arena', b: 12, c: 21 },
  { do: 'exit', a: 'jackpot', b: 39, c: 18 },
  { do: 'note', a: 'ch6' },
  { do: 'trig', a: 16, b: 5 },
  { do: 'exit', a: 'wood_edge', b: 25, c: 11 },
  { do: 'talk', a: 'both', choose: [2] },
  { do: 'partner', a: 29, b: 2 },
  { do: 'exit', a: 'wood', b: 19, c: 0 },
  { do: 'trig', a: 8, b: 18 },
  { do: 'trig', a: 8, b: 9 },
  { do: 'exit', a: 'wood_heart', b: 14, c: 5 },
  { do: 'note', a: 'ch7' },
  { do: 'exit', a: 'line1', b: 14, c: 1 },
  { do: 'trig', a: 16, b: 12, choose: [1] },
  { do: 'note', a: 'ch8' },
  { do: 'exit', a: 'shore', b: 29, c: 10 },
  { do: 'exit', a: 'sea', b: 24, c: 23 },
  { do: 'talk', a: 'lifeboat_n' },
  { do: 'exit', a: 'wreck', b: 14, c: 25 },
  { do: 'talk', a: 'r_bigger' }, { do: 'talk', a: 'r_anyone' }, { do: 'talk', a: 'r_again' }, { do: 'talk', a: 'r_both' },
  { do: 'talk', a: 'r_se', choose: [0, 1] },
  { do: 'note', a: 'ch9' },
  { do: 'talk', a: 'fen9' },
  { do: 'exit', a: 'returnyard', b: 14, c: 8 },
  { do: 'talk', a: 'clerk9' },
  { do: 'flag', a: 'pz_final' }, { do: 'flag', a: 'c9_loop' },
  { do: 'trig', a: 6, b: 7, choose: [0] },
];

export async function storyTest(game: Game, log: (s: string) => void, frames: (n: number) => Promise<void>, key: (code: string) => void, ending: number[] = [0]) {
  const queue: number[] = [];
  const answered = new WeakSet<object>();
  const top = () => game.top();
  const name = () => (top()?.constructor.name ?? 'none').replace(/^_+/, '');
  async function settle(limit = 30000) {
    for (let i = 0; i < limit; i++) {
      const t = top() as unknown as Record<string, unknown>;
      const n = name();
      (window as unknown as { __settle: string }).__settle = `${i} ${n} f${game.frame}`;
      if (n === 'FieldScene' && !(t as unknown as FieldScene).busy) return true;
      if (n === 'TitleScene') return true;
      if (n === 'DialogueScene') {
        const d = t as unknown as { choices: string[] | null; page: number; pages: unknown[]; shown: number; choiceIdx: number };
        if (d.choices && d.page >= d.pages.length - 1 && !answered.has(d)) { answered.add(d); d.choiceIdx = queue.length ? queue.shift()! : 0; }
        key('KeyZ');
      } else if (n === 'BattleScene') {
        const b = t as unknown as BattleScene;
        if (b.phase === 'menu' || b.phase === 'ring' || b.phase === 'brace') forceWin(b);
        else key('KeyZ');
      } else if (n === 'UpScene') {
        const u = t as unknown as { phase: number; key: (e: KeyboardEvent) => void };
        if (u.phase === 2) { for (const ch of 'hello from the test') u.key(new KeyboardEvent('keydown', { key: ch })); u.key(new KeyboardEvent('keydown', { key: 'Enter' })); }
        else key('KeyZ');
      } else if (n === 'ShopScene') key('KeyX');
      else key('KeyZ');
      await frames(1);
    }
    log(`settle timed out on ${name()}`);
    return false;
  }
  function forceWin(b: BattleScene) {
    const bb = b.b;
    if (bb.outcome) return;
    for (const f of bb.foes()) {
      const def = ENEMIES[f.id];
      f.alive = false;
      if (def?.id === 'amen1') { bb.extra.scripted = 1; continue; }
      if (def?.mustAnswer || def?.ask) { f.gone = 'answered'; bb.answered.push(f.id); } else bb.defeated.push(f.id);
    }
    bb.outcome = 'win';
    b.queue = [];
    b.finish();
  }
  const field = () => game.stack[0] as unknown as FieldScene;
  await settle();
  for (const st of STEPS) {
    const f = field();
    const s = game.state!;
    if (st.choose) queue.push(...(st === STEPS[STEPS.length - 1] ? ending : st.choose));
    (window as unknown as { __step: string }).__step = JSON.stringify(st);
    try {
      if (st.do === 'note') { log(`-- ${st.a} (map ${s.map}, party ${s.party.join(',')}, lv ${Object.values(s.roster).map((m) => m.lvl).join('/')})`); continue; }
      if (st.do === 'flag') { s.flags[String(st.a)] = st.b ?? 1; f.refreshVisibility(); continue; }
      if (st.do === 'partner') { if (f.partner) { f.partner.x = Number(st.a); f.partner.y = st.b!; f.partner.fx = f.partner.x; f.partner.fy = f.partner.y; } continue; }
      if (st.do === 'talk') {
        const n = f.npcs.find((q) => q.id === st.a);
        if (!n || !n.def?.talk) { log(`!! no talkable npc ${st.a} on ${f.map.id}`); continue; }
        if (!n.visible) log(`!! npc ${st.a} is hidden on ${f.map.id}`);
        f.run(n.def.talk);
      } else if (st.do === 'trig') {
        const tr = (f.map.triggers ?? []).find((q) => Number(st.a) >= q.x && Number(st.a) < q.x + (q.w ?? 1) && st.b! >= q.y && st.b! < q.y + (q.h ?? 1) && (!q.show || q.show(f.ctx)));
        if (!tr) { log(`!! no trigger at ${st.a},${st.b} on ${f.map.id}`); continue; }
        if (tr.once) s.flags[tr.once] = 1;
        f.run(tr.run);
      } else if (st.do === 'exit') {
        if (f.map.id !== st.a) log(`!! expected map ${st.a}, on ${f.map.id}`);
        const e = (f.map.exits ?? []).find((q) => st.b! >= q.x && st.b! < q.x + (q.w ?? 1) && st.c! >= q.y && st.c! < q.y + (q.h ?? 1) && (!q.show || q.show(f.ctx)));
        if (!e) { log(`!! no exit at ${st.b},${st.c} on ${f.map.id}`); continue; }
        if (e.blocked) f.run(e.blocked); else f.run(async (c) => { await c.goto(e.to, e.tx, e.ty, e.dir ?? 2); });
      }
      await frames(2);
      const ok = await settle();
      if (!ok) return;
    } catch (err) {
      log(`!! error at step ${JSON.stringify(st)}: ${(err as Error).message}`);
    }
  }
  const s = game.state;
  log(`done. stack: ${game.stack.map((x) => x.constructor.name).join('>')}, map ${s?.map}, endings ${JSON.stringify(game.meta.endings)}`);
}
