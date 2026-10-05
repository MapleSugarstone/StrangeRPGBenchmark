import type { Ctx } from '../game/script';
import { CHAPTERS } from './index';
import { save } from '../game/state';

/** Ends the current chapter and starts chapter `n`, or shows a stop sign if it is not written yet. */
export async function nextChapter(s: Ctx, n: number) {
  const ch = CHAPTERS[n - 1];
  if (!ch || !ch.ready) {
    await s.tell(`^yEnd of Chapter ${n - 1}.^0 The next chapter is still being printed. Your progress is saved.`);
    s.flag(`ch${n - 1}Done`);
    save(s.st);
    return;
  }
  await s.fadeOut();
  s.chapter(n);
  for (const [k, v] of Object.entries(ch.presetFlags ?? {})) if (s.st.flags[k] === undefined) s.st.flags[k] = v;
  await s.card(n);
  await s.warp(ch.startMap, ch.startMarker);
  save(s.st);
  if (ch.intro) await ch.intro(s);
}

export function lampsLit(s: Ctx, map: string, ids: string[]): number {
  return ids.filter(id => s.st.flags[`lit:${map}:${id}`]).length;
}
