import { CHAR } from '../data/characters';
import { BOSSES } from '../data/enemies';
import { GEAR, ITEMS, RUNES } from '../data/items';
import { chapter } from '../story/chapters';
import type { Cmd } from '../story/types';
import { joinMember, type GameState } from './party';

export type BattleResult = 'win' | 'lose' | 'flee';

export interface Host {
  state: GameState;
  say(who: string, text: string): Promise<void>;
  card(lines: string[]): Promise<void>;
  choice(prompt: string, opts: string[]): Promise<number>;
  battle(foes: string[], boss: boolean): Promise<BattleResult>;
  notify(text: string): Promise<void>;
  fx(kind: 'shake' | 'flash', n: number): Promise<void>;
  heal(): void;
}

export class EndChapter extends Error {}

export function speakerOf(line: string): { who: string; text: string } {
  const i = line.indexOf('|');
  if (i > 0 && i < 18 && line.slice(0, i) === line.slice(0, i).toUpperCase()) return { who: line.slice(0, i), text: line.slice(i + 1) };
  return { who: '', text: line };
}

export function giveName(id: string): string {
  return ITEMS[id]?.name ?? GEAR[id]?.name ?? RUNES[id]?.name ?? id;
}

export async function runScript(cmds: Cmd[], host: Host): Promise<void> {
  const s = host.state;
  for (const c of cmds) {
    if (typeof c === 'string') {
      const { who, text } = speakerOf(c);
      await host.say(who, text);
    } else if ('battle' in c) {
      const foes = BOSSES[s.chapter][c.battle];
      await host.battle(foes, true);
    } else if ('fight' in c) {
      await host.battle(c.fight, !!c.boss);
    } else if ('join' in c) {
      joinMember(s, c.join);
      await host.notify(`${CHAR[c.join].name} joins the party!`);
    } else if ('give' in c) {
      const n = c.n ?? 1;
      if (ITEMS[c.give]) s.inv[c.give] = Math.min(9, (s.inv[c.give] ?? 0) + n);
      else if (GEAR[c.give]) { if (!s.owned.includes(c.give)) s.owned.push(c.give); }
      else if (RUNES[c.give]) s.runes[c.give] = (s.runes[c.give] ?? 0) + n;
      await host.notify(`Got ${n > 1 ? n + 'x ' : ''}${giveName(c.give)}.`);
    } else if ('gold' in c) {
      s.gold += c.gold;
      await host.notify(`Found ${c.gold} gold.`);
    } else if ('choice' in c) {
      const i = await host.choice(c.choice, c.opts.map((o) => o.t));
      await runScript(c.opts[i].do, host);
    } else if ('set' in c) {
      s.flags[c.set] = true;
    } else if ('if' in c) {
      await runScript(s.flags[c.if] ? c.then : (c.else ?? []), host);
    } else if ('card' in c) {
      await host.card(c.card);
    } else if ('shake' in c) {
      await host.fx('shake', c.shake);
    } else if ('flash' in c) {
      await host.fx('flash', 1);
    } else if ('wait' in c) {
      await host.fx('shake', 0);
    } else if ('heal' in c) {
      host.heal();
    } else if ('unlock' in c) {
      if (s.flags['mech' + s.chapter]) continue;
      s.flags['mech' + s.chapter] = true;
      const ch = chapter(s.chapter);
      await host.card(['NEW MECHANIC', ch.mechTitle, '', ...ch.mechText]);
    } else if ('end' in c) {
      throw new EndChapter();
    }
  }
}
