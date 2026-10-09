export {};
// Writes src/data/profileTable.ts: a stat profile for every kind. Each starts from the archetype its kit fits, leans
// toward the stats its moves and habits scale from, then takes one quirk on purpose so no two kinds of an archetype
// match. Notes/stat-profiles.md explains the rules. Usage: node dist-tools/profiles.js [--write]. It prints without --write.
declare const process: { argv: string[] };
const g = globalThis as any;
const fakeCtx = new Proxy({}, { get: () => () => {}, set: () => true });
g.document = { getElementById: () => ({ getContext: () => fakeCtx, style: {} }), createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
g.window = { addEventListener: () => {}, innerWidth: 800, innerHeight: 800 };
g.localStorage = { getItem: () => null, setItem: () => {} };

type Key = 'hp' | 'atk' | 'def' | 'res' | 'mgk' | 'agi' | 'cha';
const ORDER: Key[] = ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'];

/**
 * Starting shapes, in points in the order HP, ATK, DEF, RES, MGK, AGI, CHA. Each sums to 700. Every shape but Support and
 * Mixed puts 50 in the offense it does not use and 70 in CHA, so each has the same 580 for the stats it fights with.
 */
export const ARCHETYPES: Record<string, number[]> = {
  Bruiser: [130, 150, 115, 90, 50, 95, 70],
  Tank: [170, 100, 140, 120, 50, 50, 70],
  Skirmisher: [105, 160, 85, 80, 50, 150, 70],
  Caster: [95, 50, 85, 120, 160, 120, 70],
  Sage: [125, 50, 100, 140, 145, 70, 70],
  Support: [115, 50, 95, 115, 110, 85, 130],
  Mixed: [115, 115, 95, 95, 115, 95, 70],
  Normie: [110, 110, 110, 110, 70, 110, 80],
};

async function main(): Promise<void> {
  const fs = await import('node:fs');
  const { SPECIES } = await import('../data/species');
  const { MOVES, PASSIVES } = await import('../battle/registry');
  const { BUDGET, MIN_POINTS, CAP } = await import('../data/profiles');

  const num = (s: string, dflt: number) => { const v = parseFloat(s); return Number.isFinite(v) ? Math.max(0.15, Math.min(3, v)) : dflt; };
  /** How much a piece of kit code leans on each stat. */
  function lean(src: string, w: Record<Key, number>, scale: number): void {
    for (const m of src.matchAll(/\b(atk|mgk|cha|def)\s*:\s*([^,}\s]+)/g)) w[m[1] as Key] += num(m[2], 1) * scale;
    for (const m of src.matchAll(/\bselfHp\s*:\s*([^,}\s]+)/g)) w.hp += num(m[1], 0.05) * 12 * scale;
    for (const m of src.matchAll(/\.cha\(\s*([^)]*)\)/g)) w.cha += num(m[1], 0.3) * 2 * scale;
    w.cha += (src.match(/'cha'/g) || []).length * 0.3 * scale;
    w.atk += (src.match(/'atk'/g) || []).length * 0.3 * scale;
    w.mgk += (src.match(/'mgk'/g) || []).length * 0.3 * scale;
    w.def += (src.match(/'def'|'fortify'|guard|shield\(/g) || []).length * 0.2 * scale;
    w.res += (src.match(/'res'|'ward'|cleanse/g) || []).length * 0.25 * scale;
    w.agi += (src.match(/'agi'|hasten|'haste'|again|firstBonus|hastenAfter/g) || []).length * 0.25 * scale;
    w.hp += (src.match(/maxHp/g) || []).length * 0.15 * scale;
  }
  const TYPE_LEAN: Record<string, Partial<Record<Key, number>>> = {
    STONE: { def: 0.5, hp: 0.2 }, TIDE: { res: 0.4, hp: 0.3 }, ROOT: { hp: 0.4, cha: 0.2 }, GEAR: { def: 0.3, atk: 0.2 },
    BEAST: { atk: 0.3, agi: 0.3 }, STAR: { mgk: 0.3, agi: 0.3 }, SALT: { res: 0.4, cha: 0.2 }, VOID: { mgk: 0.3, agi: 0.2 },
  };
  const BASE: Record<Key, number> = { hp: 0.9, atk: 0, def: 0.6, res: 0.6, mgk: 0, agi: 0.7, cha: 0.45 };
  const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  const rows: string[] = [];
  const count: Record<string, number> = {};
  // First pass: how each kind's kit leans, before anything is compared.
  const all = (Object.values(SPECIES) as any[]).map(sp => {
    const w: Record<Key, number> = { ...BASE };
    w[sp.basic === 'P' ? 'atk' : 'mgk'] += 1.2;
    for (const id of sp.moves) { const m = MOVES[id]; if (m) lean(String(m.run), w, m.nerve ? 0.7 : 1); }
    for (const id of sp.passives) { const p = PASSIVES[id] as any; if (p) lean(Object.keys(p).filter(k => typeof p[k] === 'function').map(k => String(p[k])).join('\n'), w, 0.6); }
    for (const t of sp.types) for (const [k, v] of Object.entries(TYPE_LEAN[t] || {})) w[k as Key] += v!;
    const atkShare = w.atk + w.mgk ? w.atk / (w.atk + w.mgk) : 0.5;
    return { sp, w, atkShare, tough: w.hp + w.def + w.res, off: w.atk + w.mgk };
  });
  // Ranks from 0 to 1 against every other kind, so the archetypes spread rather than all landing in two.
  const rank = (f: (x: typeof all[number]) => number) => {
    const sorted = all.map(f).sort((a, b) => a - b);
    return (x: typeof all[number]) => sorted.filter(v => v < f(x)).length / Math.max(1, sorted.length - 1);
  };
  const chaRank = rank(x => x.w.cha), toughRank = rank(x => x.tough), agiRank = rank(x => x.w.agi), offRank = rank(x => x.off);
  const median: Record<Key, number> = {} as Record<Key, number>;
  for (const k of ORDER) { const v = all.map(x => x.w[k]).sort((a, b) => a - b); median[k] = v[Math.floor(v.length / 2)]; }
  for (const { sp, w, atkShare } of all) {
    const me = all.find(x => x.sp === sp)!;
    const magic = atkShare < 0.4, mixed = atkShare >= 0.4 && atkShare <= 0.6;
    // The archetype its kit fits best.
    let arch: string;
    if (chaRank(me) >= 0.85) arch = 'Support';
    else if (toughRank(me) >= 0.85) arch = 'Tank';
    else if (mixed) arch = 'Mixed';
    else if (offRank(me) < 0.08) arch = 'Normie';
    else if (magic) arch = agiRank(me) >= 0.5 ? 'Caster' : 'Sage';
    else arch = agiRank(me) >= 0.6 ? 'Skirmisher' : 'Bruiser';
    const pts: Record<Key, number> = {} as Record<Key, number>;
    ORDER.forEach((k, i) => { pts[k] = ARCHETYPES[arch][i]; });
    // A Support, Tank, or Normie spends its offense on the stat its kit swings with.
    if (arch === 'Support' || arch === 'Tank' || arch === 'Normie') {
      const sum = pts.atk + pts.mgk, hi = Math.max(pts.atk, pts.mgk), lo = sum - hi;
      if (atkShare >= 0.5) { pts.atk = hi; pts.mgk = lo; } else { pts.mgk = hi; pts.atk = lo; }
    }
    const offense: Key = atkShare >= 0.5 ? 'atk' : 'mgk';
    // Lean toward the stats the kit uses more than most kinds do, up to 25 points each, and away from the ones it uses less.
    for (const k of ['hp', 'def', 'res', 'agi', 'cha'] as Key[]) pts[k] += Math.max(-20, Math.min(25, Math.round((w[k] - median[k]) * 25)));
    // Back to the budget: the stats other than offense share the difference, inside the floor and caps.
    for (let pass = 0; pass < 4; pass++) {
      const over = ORDER.reduce((n, k) => n + pts[k], 0) - BUDGET;
      if (Math.abs(over) < 1) break;
      const open = ORDER.filter(k => k !== offense && (over > 0 ? pts[k] > MIN_POINTS : pts[k] < CAP[k]));
      for (const k of open) pts[k] = Math.max(MIN_POINTS, Math.min(CAP[k], pts[k] - over / open.length));
    }
    // The quirk: 10 to 19 points move from its strongest stat other than offense into one it would skip.
    const h = hash(sp.id);
    const giver = ORDER.filter(k => k !== offense).sort((a, b) => pts[b] - pts[a])[0];
    const low = ORDER.filter(k => k !== offense && k !== giver).sort((a, b) => pts[a] - pts[b]).slice(0, 3);
    const taker = low[h % low.length];
    const move = Math.max(0, Math.min(10 + (h >> 4) % 10, pts[giver] - MIN_POINTS, CAP[taker] - pts[taker]));
    pts[giver] -= move; pts[taker] += move;
    // A shape too flat to tell apart is stretched until its best stat is at least 1.45 times its weakest.
    const ratio = (q: Record<Key, number>) => { const v = ORDER.map(k => 0.5 + 0.5 * q[k] / 100); return Math.max(...v) / Math.min(...v); };
    for (let s = 1.1; ratio(pts) < 1.45 && s < 3; s += 0.1) {
      const flat = ORDER.reduce((n, k) => n + pts[k], 0) / 7;
      for (const k of ORDER) pts[k] = Math.max(MIN_POINTS, Math.min(CAP[k], flat + (pts[k] - flat) * 1.1));
    }
    const p = ORDER.map(k => Math.max(MIN_POINTS, Math.min(CAP[k], Math.round(pts[k]))));
    p[ORDER.indexOf(offense)] += BUDGET - p.reduce((a, b) => a + b, 0);
    rows.push(`  ${sp.id}: ['${arch}', [${p.join(', ')}]],`);
    count[arch] = (count[arch] || 0) + 1;
  }
  const text = [
    '// Stat profiles for every kind: its archetype and its points in the order HP, ATK, DEF, RES, MGK, AGI, CHA, which sum to 700.',
    '// Written by src/tools/profiles.ts from each kit, then tuned by hand. Notes/stat-profiles.md explains the rules.',
    'export const PROFILE_TABLE: Record<string, [string, number[]]> = {',
    ...rows, '};', '',
  ].join('\n');
  if (process.argv.includes('--write')) fs.writeFileSync('src/data/profileTable.ts', text);
  else console.log(text);
  console.error(JSON.stringify(count));
}
void main();
