/** Scores a value 1 inside [lo, hi], falling linearly to 0 at `soft` beyond either edge. */
export function band(v: number, lo: number, hi: number, soft: number): number {
  if (Number.isNaN(v)) return 0;
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  return Math.max(0, 1 - d / soft);
}

export function entropy(labels: string[]): { h: number; norm: number; distinct: number; top: string; topShare: number } {
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const n = labels.length || 1;
  let h = 0;
  let top = '';
  let topN = 0;
  for (const [l, c] of counts) {
    const p = c / n;
    h -= p * Math.log2(p);
    if (c > topN) { topN = c; top = l; }
  }
  const distinct = counts.size;
  return { h, norm: distinct > 1 ? h / Math.log2(distinct) : 0, distinct, top, topShare: topN / n };
}

export interface FunInputs {
  bossWinSmart: number;
  bossWinMash: number;
  bossWinRandom: number;
  bossWinCasual: number;
  bossTurns: number;
  bossMinFrac: number;
  trashTurns: number;
  trashDrainSmart: number;
  trashDrainMash: number;
  entropyNorm: number;
  topShare: number;
  losses: number;
  grind: number;
  novelty: number;
  clashRate: number;
  minutes: number;
}

export interface FunScore {
  total: number;
  parts: Record<string, number>;
}

/**
 * A model of fun built from measurable proxies. Each part scores 0 to 1 against a target band,
 * and the total is a weighted mean scaled to 100.
 */
export function funScore(f: FunInputs, chapter: number): FunScore {
  const parts: Record<string, number> = {
    challenge: band(f.bossWinSmart, 0.6, 0.92, 0.35),
    agency: band(f.bossWinSmart - f.bossWinMash, 0.25, 1, 0.25),
    access: band(f.bossWinCasual, 0.45, 0.95, 0.3),
    tension: band(f.bossMinFrac, 0.08, 0.4, 0.2),
    bossPacing: band(f.bossTurns, 9, 26, 10),
    trashPacing: band(f.trashTurns, 2.5, 7, 4),
    attrition: band(f.trashDrainSmart, 0.08, 0.3, 0.15),
    skillMatters: band(f.trashDrainMash - f.trashDrainSmart, 0.03, 1, 0.08),
    variety: band(f.entropyNorm, 0.6, 1, 0.3) * band(f.topShare, 0, 0.45, 0.3),
    noGrind: band(f.losses + f.grind, 0, 1, 6),
    novelty: band(f.novelty, 4, 99, 4),
    hueUse: chapter >= 2 ? band(f.clashRate, 0.3, 0.9, 0.3) : 1,
    length: band(f.minutes, 12, 45, 15),
  };
  const w: Record<string, number> = {
    challenge: 2, agency: 2, access: 1.5, tension: 1.5, bossPacing: 1, trashPacing: 1, attrition: 1, skillMatters: 1,
    variety: 1.5, noGrind: 1.5, novelty: 1.5, hueUse: 1, length: 0.5,
  };
  let s = 0, ws = 0;
  for (const [k, v] of Object.entries(parts)) { s += v * w[k]; ws += w[k]; }
  return { total: Math.round((s / ws) * 100), parts };
}
