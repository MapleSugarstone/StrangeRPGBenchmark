// Inspecting details: builds a short scene from a detail's data and runs it through the normal scene runner.
import { DETAILS, LORE, detailsOn, type Detail, type Reward } from '../content/details';
import { SCENES, runScene, sceneRunning, type SLine, type Scene } from './script';
import { G, flag } from './state';
import { partyMembers, pool } from '../rules/stats';
import { SKILL_NAME } from '../rules/data';
import { toast } from '../ui/dialogue';
import { C } from '../engine/palette';

export function detailVisible(d: Detail): boolean {
  return (!d.when || flag(d.when)) && (!d.hideIf || !flag(d.hideIf));
}

export function detailAt(map: string, x: number, y: number): Detail | null {
  for (const d of detailsOn(map)) if (d.at[0] === x && d.at[1] === y && detailVisible(d)) return d;
  return null;
}

export function detailSeen(d: Detail): boolean { return !!G.flags['det_' + d.id]; }

export function detailsFound(): number { return DETAILS.filter(detailSeen).length; }

export function unlockLore(id: string) {
  G.lore ??= [];
  if (G.lore.includes(id) || !LORE.has(id)) return;
  G.lore.push(id);
  toast(`Lore: ${LORE.get(id)!.title}`, C.amb4);
}

const NAME: Record<string, string> = { courtesy: 'Courtesy', sallis: 'Sallis', quaye: 'Quaye', ambrose: 'Ambrose', tova: 'Tova', ignace: 'Ignace' };

function rewardLines(r: Reward | undefined, n: number): SLine[] {
  if (!r) return [];
  const out: SLine[] = [];
  const cmd = (name: string, args: string[]): SLine => ({ k: 'cmd', name, args, bg: false, raw: `> ${name} ${args.join(' ')}`, n });
  if (r.gilt) out.push(cmd('gilt', [String(r.gilt)]));
  if (r.item) out.push(cmd('give', [r.item]));
  if (r.xp) out.push(cmd('xp', [String(r.xp)]));
  if (r.flag) out.push(cmd('set', [r.flag]));
  return out;
}

/** Shows a detail: its text, the port, one companion, a passive skill line, then rewards on the first look. */
export async function inspect(d: Detail) {
  if (sceneRunning()) return;
  const first = !detailSeen(d);
  G.flags['det_' + d.id] = 1;
  if (d.scene) { if (first && d.lore) unlockLore(d.lore); await runScene(d.scene); return; }
  const lines: SLine[] = [];
  const say = (who: string, text: string) => lines.push({ k: 'say', who, text, n: 0 });
  for (const t of d.text.split('|')) say('', t.trim());
  const port = typeof d.port === 'string' ? d.port : d.port ? Object.entries(d.port).filter(([c]) => Number(c) <= G.chapter).sort((x, y) => Number(y[0]) - Number(x[0]))[0]?.[1] : undefined;
  if (port) say('PORT', port);
  for (const [id, text] of Object.entries(d.party ?? {})) if (G.party.includes(id) && NAME[id]) { say(NAME[id], text); break; }
  const checkKey = 'detc_' + d.id;
  if (d.check) {
    const best = Math.max(0, ...partyMembers().map((m) => pool(m, d.check!.skill)));
    if (best >= d.check.need) {
      say(SKILL_NAME[d.check.skill].toUpperCase(), d.check.text);
      if (!G.flags[checkKey]) { G.flags[checkKey] = 1; lines.push(...rewardLines(d.check.reward, 0)); }
    }
  }
  if (first) lines.push(...rewardLines(d.reward, 0));
  const scene: Scene = { id: 'detail:' + d.id, file: 'details', lines, labels: new Map() };
  SCENES.set(scene.id, scene);
  await runScene(scene.id);
  if (first && d.lore) unlockLore(d.lore);
}
