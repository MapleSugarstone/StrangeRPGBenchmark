// Scripts shared across chapters: Callings, ledger pages, and payphone extras.
import type { Ctx } from '../game/ctx';
import type { GameState } from '../game/state';
import { CALLINGS, CALLING_LVL, MEMBERS, MEMBER_ORDER, callingOf } from '../data/members';
import { PAGES } from '../data/quests';
import { SKILLS } from '../data/skills';
import { memberStats } from '../game/state';

// The first member who has reached their Calling level and has not chosen or put it off at this level.
export function pendingCalling(s: GameState): string | null {
  for (const id of MEMBER_ORDER) {
    const m = s.roster[id];
    if (!m || m.calling || m.lvl < CALLING_LVL || !CALLINGS[id]) continue;
    if (Number(s.flags['callwait_' + id] ?? 0) >= m.lvl) continue;
    return id;
  }
  return null;
}

const INTRO: Record<string, string> = {
  hello: 'Hello has been listening to a lot of people lately. Some of it is starting to stick.',
  someday: 'Someday turns her hook over in her hands, the old way and then the new way.',
  bigger: 'Bigger has been thinking. It is visible from a distance.',
  anyone: 'Anyone keeps reaching for a chorus that is not there. She will have to decide what to sing instead.',
  again: 'Again is getting good at this. Good enough to choose which part to play again.',
  someone: 'Someone Else has been trying on ways to be useful, the way other people try on hats.',
  both: 'First and Firster have been arguing about what kind of knight they are. For once, it is a real question.',
  lifeboat: 'Lifeboat is running a self-check. It has been doing a lot more than its manual says.',
};

export async function callingScene(c: Ctx, id: string) {
  const [a, b] = CALLINGS[id];
  const m = c.s.roster[id];
  const name = MEMBERS[id].name;
  c.sfx('ring');
  await c.say(null, INTRO[id] ?? `${name} has a choice to make.`);
  await c.say(null, `${name} can take up a Calling. It shapes how they grow from here on. You can change it later at a payphone, for a price.`);
  const skills = (k: typeof a) => [...k.learn, ...(k.learn2 ?? [])].map(([l, s]) => `${SKILLS[s]?.name} (Lv ${l})`).join(', ');
  await c.say(null, `${a.name}: ${a.desc} Learns ${skills(a)}.`);
  await c.say(null, `${b.name}: ${b.desc} Learns ${skills(b)}.`);
  const r = await c.ask(id === 'hello' ? 'hello' : null, `Which Calling for ${name}?`, [a.name, b.name, 'Not yet']);
  if (r === 2) { c.s.flags['callwait_' + id] = m.lvl; await c.say(null, 'You can choose later. The question will come back.'); return; }
  setCalling(c.s, id, r === 0 ? a.id : b.id);
  c.sfx('level');
  await c.say(null, `${name} takes up the Calling of ${(r === 0 ? a : b).name}.`);
}

function setCalling(s: GameState, id: string, calling: string | undefined) {
  const m = s.roster[id];
  m.calling = calling;
  const st = memberStats(m);
  m.hp = Math.min(m.hp, st.hp);
  m.vp = Math.min(m.vp, st.vp);
}

// Payphone menu entry: change one member's Calling.
export async function respec(c: Ctx) {
  const ids = MEMBER_ORDER.filter((id) => c.s.roster[id]?.calling);
  if (!ids.length) { await c.say('payphone', 'Nobody on this line has a Calling yet.'); return; }
  const price = 40 * c.s.chapter;
  const r = await c.ask('payphone', `Change whose Calling? It costs ${price} pleas.`, [...ids.map((id) => MEMBERS[id].name), 'Hang up']);
  if (r >= ids.length) return;
  if (c.s.pleas < price) { await c.say('payphone', 'The line goes dead. You do not have enough pleas.'); return; }
  const id = ids[r];
  const other = CALLINGS[id].find((k) => k.id !== c.s.roster[id].calling)!;
  const ok = await c.ask('payphone', `Switch ${MEMBERS[id].name} from ${callingOf(id, c.s.roster[id].calling)?.name} to ${other.name}?`, ['Switch', 'Keep it']);
  if (ok !== 0) return;
  c.s.pleas -= price;
  setCalling(c.s, id, other.id);
  c.sfx('level');
  await c.say(null, `${MEMBERS[id].name} takes up the Calling of ${other.name}.`);
}

export function pageCount(s: GameState): number { return PAGES.filter((_, i) => s.flags['page_' + (i + 1)]).length; }

export async function page(c: Ctx, n: number) {
  if (c.flag('page_' + n)) return;
  c.set('page_' + n);
  await c.give('ledgerpage', 1, true);
  c.sfx('gold');
  const p = PAGES[n - 1];
  await c.say(null, 'A page torn from a ledger. The heading is stamped: LINEMAN 0411. DELIVERIES.');
  await c.say(null, p.names);
  await c.say(null, `In the margin, in pencil, in a hand you know: "${p.note}"`);
  const k = pageCount(c.s);
  if (k === 1) await c.quest('ledger', 1);
  if (k >= PAGES.length) { await c.quest('ledger', 2); await c.say(null, 'That is all twelve. Four hundred and twelve names, give or take the ones the margins could not hold.'); }
  else await c.say(null, `Ledger pages: ${k} of ${PAGES.length}.`);
}
