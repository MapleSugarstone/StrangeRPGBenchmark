import type { TraceRow } from '../battle/engine';

export interface BattleRec { win: boolean; trace: TraceRow[]; kos: number; counts: Record<string, number>; rewinds: number; }
export interface MS { m: number; sd: number; }
export interface Summary {
  n: number; win: number; actions: MS; turns: MS; hp: MS; leadChanges: MS; drama: MS; killer: MS; kos: MS; decisive: MS;
  comeback: number; nearMiss: number; tension: number; entropy: number; maxShare: number; topAction: string; mix: Record<string, number>; rewinds: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ms = (xs: number[]): MS => {
  const m = mean(xs);
  return { m, sd: Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) };
};
const sgn = (x: number) => (x > 1e-9 ? 1 : x < -1e-9 ? -1 : 0);

export function battleMetrics(r: BattleRec) {
  const T = r.trace.length;
  const L = r.trace.map((t) => t.p - t.e);
  const lead: number[] = [];
  let prev = 0, flips = 0;
  for (const l of L) {
    const s = sgn(l) || prev;
    if (prev && s !== prev) flips++;
    prev = s;
    lead.push(s);
  }
  const final = lead[T - 1] || (r.win ? 1 : -1);
  let j = T - 1;
  while (j >= 0 && lead[j] === final) j--;
  const behind = L.filter((l) => l < 0).map((l) => -l);
  const hp = T ? r.trace[T - 1].p : 0;
  const minL = Math.min(0, ...L);
  return {
    actions: T, turns: r.trace.filter((t) => t.side === 0).length, hp,
    leadChanges: T > 1 ? flips / (T - 1) : 0,
    drama: r.win ? mean(behind) : 0,
    killer: Math.max(0, ...L.map((l, i) => Math.abs(l - (i ? L[i - 1] : 0)))),
    comeback: r.win && minL < -0.3, nearMiss: r.win && hp < 0.15,
    kos: r.kos, decisive: T ? (T - (j + 2)) / T : 0,
  };
}

// Entropy of the action mix, divided by the log of how many action types a player can usefully rotate (capped at 6), clamped to 1.
export function entropy(counts: Record<string, number>, kinds: number) {
  const tot = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const ps = Object.entries(counts).map(([k, v]) => [k, v / tot] as [string, number]).sort((a, b) => b[1] - a[1]);
  const h = -ps.reduce((s, [, p]) => s + (p > 0 ? p * Math.log(p) : 0), 0);
  return { h: Math.min(1, h / Math.log(Math.max(2, Math.min(kinds, 6)))), max: ps[0]?.[1] ?? 0, top: ps[0]?.[0] ?? '-' };
}

export function summarize(rs: BattleRec[], kinds: number): Summary {
  const ms_ = rs.map(battleMetrics);
  const wins = ms_.filter((_, i) => rs[i].win);
  const pool: Record<string, number> = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.counts)) pool[k] = (pool[k] ?? 0) + v;
  const e = entropy(pool, kinds);
  const share = (f: (m: ReturnType<typeof battleMetrics>) => boolean) => (wins.length ? wins.filter(f).length / wins.length : 0);
  return {
    n: rs.length, win: rs.length ? wins.length / rs.length : 0,
    actions: ms(ms_.map((m) => m.actions)), turns: ms(ms_.map((m) => m.turns)), hp: ms(ms_.map((m) => m.hp)), leadChanges: ms(ms_.map((m) => m.leadChanges)),
    drama: ms(wins.map((m) => m.drama)), killer: ms(ms_.map((m) => m.killer)), kos: ms(ms_.map((m) => m.kos)),
    decisive: ms(ms_.map((m) => m.decisive)),
    comeback: share((m) => m.comeback), nearMiss: share((m) => m.nearMiss), tension: share((m) => m.comeback || m.nearMiss),
    entropy: e.h, maxShare: e.max, topAction: e.top, mix: Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, v / (Object.values(pool).reduce((a, b) => a + b, 0) || 1)])), rewinds: mean(rs.map((r) => r.rewinds)),
  };
}

export interface FunIn {
  smartWin: number; casualWin: number; tension: number; leadChanges: number; entropy: number; maxShare: number;
  dropMech: number; fightLen: number; bossLen: number; noveltyPer10: number;
}
export const WEIGHTS = { challenge: 20, tension: 15, lead: 10, variety: 15, relevance: 15, pacing: 15, novelty: 10 };

const near = (x: number, t: number, w: number) => Math.max(0, 1 - Math.abs(x - t) / w);
const band = (x: number, lo: number, hi: number, w: number) => (x < lo ? Math.max(0, 1 - (lo - x) / w) : x > hi ? Math.max(0, 1 - (x - hi) / w) : 1);

export function funIndex(i: FunIn) {
  const d = i.dropMech * 100;
  const parts = {
    challenge: 0.5 * near(i.smartWin, 0.85, 0.4) + 0.5 * near(i.casualWin, 0.6, 0.4),
    tension: near(i.tension, 0.25, 0.25),
    lead: near(i.leadChanges, 0.2, 0.2),
    variety: Math.min(1, i.entropy / 0.6) * (i.maxShare > 0.6 ? 0.5 : 1),
    relevance: d < 5 ? Math.max(0, d / 5) : d <= 25 ? 1 : Math.max(0, 1 - (d - 25) / 25),
    pacing: 0.5 * band(i.fightLen, 6, 14, 6) + 0.5 * band(i.bossLen, 20, 45, 15),
    novelty: Math.min(1, i.noveltyPer10 / 3),
  };
  const index = (Object.keys(parts) as (keyof typeof parts)[]).reduce((s, k) => s + parts[k] * WEIGHTS[k], 0);
  return { index, parts };
}

export const FUN_FORMULA = [
  'Each part scores from 0 to 1 and the Fun Index is 100 times the weighted sum (weights add up to 1).',
  'near(x, t, w) = max(0, 1 - |x - t| / w). band(x, lo, hi, w) is 1 inside [lo, hi] and falls to 0 linearly over a distance w outside it.',
  'challenge (weight 0.20) = 0.5 * near(smart boss win rate, 0.85, 0.4) + 0.5 * near(casual boss win rate, 0.60, 0.4).',
  'tension (0.15) = near(share of casual boss wins that are comebacks or near-misses, 0.25, 0.25).',
  'lead (0.10) = near(mean lead changes per action in casual boss fights, 0.20, 0.20).',
  'variety (0.15) = min(1, normalized action entropy of the smart policy / 0.6), halved when one action type exceeds 60 percent of actions.',
  'relevance (0.15) = score of d, the larger of the smart and casual win rate drops in points when the chapter mechanic is removed: d / 5 below 5, 1 from 5 to 25, and 1 - (d - 25) / 25 above 25 (never below 0). A boss that must be answered in the Answer chapter uses d = 15 because the mechanic is required by design.',
  'pacing (0.15) = 0.5 * band(mean actions in regular fights, 6, 14, 6) + 0.5 * band(mean actions in smart boss fights, 20, 45, 15).',
  'novelty (0.10) = min(1, novelty per 10 minutes / 3), where novelty counts new enemy types, 1 for the new mechanic, and new party members.',
];
