export {};
// Progression balance: typical player teams for each chapter against every story fight.
declare const process: { argv: string[] };
const g = globalThis as any;
const fakeCtx = new Proxy({}, { get: () => () => {}, set: () => true });
g.document = { getElementById: () => ({ getContext: () => fakeCtx, style: {} }), createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
g.window = { addEventListener: () => {}, innerWidth: 800, innerHeight: 800 };
g.localStorage = { getItem: () => null, setItem: () => {} };

async function main(): Promise<void> {
  const { act, advance, newBattle } = await import('../battle/engine');
  const { choose, chooseReplacement } = await import('../battle/ai');
  const { makeMon } = await import('../data/species');
  const { randomFit } = await import('../game/wildfit');
  const { graftonTeam } = await import('../content/ch4');
  const { brack } = await import('../content/ch3');
  const { bareFinal, tackFinal, cinchTeam, purchaseTeam } = await import('../content/ch9');
  await import('../content');
  const { MAPS } = await import('../game/world');
  const { SIFTER_TEAM } = await import('../content/act2/ch1');
  const { GLOSS_TEAM, tackFlatsTeam } = await import('../content/act2/ch2');
  const { TURNWISE_TEAM } = await import('../content/act2/ch3');
  const { tackTeam, siphonTeam } = await import('../content/act2/ch4');
  const { mudTeam, castTeam } = await import('../content/act2/ch5');
  const { gleanerTeam, GLEANER_HP } = await import('../content/act2/ch6');
  type Mon = import('../battle/model').Mon;

  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const N = Number(process.argv.find(a => /^\d+$/.test(a)) || 60);

  // Kinds a player can have by each chapter (route rosters, cumulative).
  const ROUTES = [
    ['bramble', 'squall', 'dynamo', 'cairn', 'hare', 'puffball', 'paring', 'burr', 'stoat'],
    ['scree', 'brine', 'bore', 'carrion', 'coma', 'eddy'],
    ['fogbank', 'undertow', 'leech', 'mycel', 'grotesque', 'siren'],
    ['thicket', 'orchard', 'hemlock', 'stump', 'howl', 'umbra'],
    ['crane', 'turbine', 'furnace', 'orrery', 'perigee', 'fulgur', 'piston'],
    ['floe', 'yoke', 'menhir', 'halo', 'curtain'],
    ['gore', 'thumb', 'quarry', 'portent', 'plinth', 'grotto'],
    ['flare', 'tor'],
  ];
  // Act 2 chapters are 11 to 16 here. A Strand team keeps the Volute's whorls and adds kinds from the Strand zones so far.
  const STRAND_MAPS = [
    ['outerwhorl', 'wrack', 'sanddollar', 'doves', 'flats'],
    ['cowrieback', 'polish', 'underteeth', 'glazehalls', 'glosshall'],
    ['augerdune', 'augermouth', 'augerroll', 'augerstair', 'augerpoint', 'turnwisegym'],
    ['lowline', 'livingchamber', 'oldchambers', 'tidechamber', 'siphuncle'],
    ['springlow', 'longstrand', 'tray', 'hollowtop', 'mudlarkyard', 'oldapex'],
    ['conchlip', 'conchpink', 'conchturn', 'conchroar', 'conchmouth'],
  ];
  const zoneKinds = (id: string): string[] => {
    const z = MAPS[id]?.zone;
    if (!z) return [];
    return [...z.kinds, ...(z.tideKinds ? [...z.tideKinds.high, ...z.tideKinds.low] : [])].map(([k]) => k);
  };
  const strandPool = (ch: number) => [...new Set(STRAND_MAPS.slice(0, ch - 10).flat().flatMap(zoneKinds))];
  const pool = (ch: number) => ch > 10 ? [...ROUTES.flat(), ...strandPool(ch)] : ROUTES.slice(0, Math.min(ch, ROUTES.length)).flat();
  const team = (lv: number, kinds: [string, number][]) => kinds.map(([k, d]) => makeMon(k, lv + d));

  function playerTeam(ch: number, lv: number, fits: number): Mon[] {
    const p = pool(ch);
    const out: Mon[] = [];
    for (let i = 0; i < 4; i++) {
      if (i < fits) out.push(randomFit(rnd, pick(p), pick(p), lv));
      else out.push(makeMon(pick(p), lv));
    }
    return out;
  }

  function fight(a: Mon[], z: Mon[], nerve: boolean, aiA: any, aiZ: any, ch = 0, bossHp = 0): boolean {
    const b = newBattle({ mons: a, name: 'V', ai: aiA, player: true }, { mons: z, name: 'K', ai: aiZ }, { nerve, wild: false, sync: false, canRun: false });
    b.quiet = true;
    // The same sea rules battleView sets on the Strand: from its chapter 3 high tide starts both pools at 3 and low tide brings stars.
    if (ch > 10) {
      const high = rnd() < 0.5;
      b.rules.strand = true; b.rules.tideHigh = high;
      if (ch >= 13 && b.rules.nerve) {
        if (high) { b.s[0].nerve = Math.max(b.s[0].nerve, 3); b.s[1].nerve = Math.max(b.s[1].nerve, 3); }
        else { b.s[0].nerve = 0; b.s[1].nerve = 0; b.rules.starEvery = 4; }
      }
    }
    if (bossHp) for (const f of b.s[1].f) { f.maxHp = Math.round(f.maxHp * bossHp); f.st.hp = f.maxHp; f.hp = f.maxHp; }
    for (let i = 0; i < 400; i++) {
      const d = advance(b, chooseReplacement);
      if (d.kind === 'over') break;
      if (d.kind === 'act') act(b, choose(b));
    }
    return b.over === 0;
  }

  // ch: chapter the fight is in. lv: the player level we expect there. fits: fittings we expect the player to have.
  const FIGHTS: { name: string; ch: number; lv: number; fits: number; team: () => Mon[]; nerve: boolean; ai: string; size?: number; bossHp?: number }[] = [
    { name: 'Tack 1', ch: 1, lv: 5, fits: 0, size: 1, team: () => [makeMon('tackle', 2)], nerve: false, ai: 'trainer', bossHp: 0.75 },
    { name: 'Peelers', ch: 1, lv: 6, fits: 0, size: 2, team: () => team(6, [['cairn', 0], ['puffball', 0]]), nerve: false, ai: 'trainer' },
    { name: 'Knuckle', ch: 1, lv: 9, fits: 0, size: 3, team: () => team(10, [['cairn', 0], ['menhir', 0], ['hare', 0]]), nerve: false, ai: 'keeper' },
    { name: 'Tack 2', ch: 2, lv: 12, fits: 0, team: () => team(16, [['tackle', 1], ['hare', 0], ['paring', 0]]), nerve: true, ai: 'trainer', bossHp: 1.15 },
    { name: 'Leeward', ch: 2, lv: 15, fits: 0, team: () => team(17, [['squall', 0], ['coma', 0], ['brine', 0], ['bore', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Tack 3', ch: 3, lv: 18, fits: 0, team: () => [brack(18), ...team(17, [['hare', 0], ['paring', 0], ['eddy', 0]])], nerve: true, ai: 'trainer' },
    { name: 'Verger', ch: 3, lv: 20, fits: 1, team: () => team(19, [['grotesque', 0], ['siren', 0], ['fogbank', 1], ['flare', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Zest (Bole)', ch: 4, lv: 22, fits: 1, team: () => team(27, [['crane', 0], ['yoke', 0], ['thumb', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Grafton', ch: 4, lv: 25, fits: 1, team: () => graftonTeam(27), nerve: true, ai: 'keeper' },
    { name: 'Ohm', ch: 5, lv: 28, fits: 2, team: () => { const t = team(26, [['turbine', 0], ['piston', 0], ['furnace', 1], ['perigee', 1]]); ['longshin', 'edgecharm', 'embercoat', 'bodkin'].forEach((n, i) => t[i].notion = n); return t; }, nerve: true, ai: 'keeper' },
    { name: 'Zest (Pylon)', ch: 5, lv: 29, fits: 2, team: () => team(25, [['crane', 0], ['yoke', 0], ['thumb', 0], ['gore', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Bare (Pylon)', ch: 5, lv: 31, fits: 2, team: () => team(25, [['carrion', 0], ['undertow', 0], ['hemlock', 0], ['quarry', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Old Tallow', ch: 6, lv: 35, fits: 2, team: () => team(30, [['yoke', 0], ['menhir', 0], ['halo', 0], ['floe', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Pith', ch: 7, lv: 38, fits: 2, team: () => team(34, [['leech', 0], ['mycel', 0], ['portent', 0], ['grotto', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Quillon', ch: 7, lv: 41, fits: 2, team: () => team(38, [['stoat', 0], ['carrion', 0], ['gore', 0], ['hemlock', 1]]), nerve: true, ai: 'keeper' },
    { name: 'Tack 4', ch: 8, lv: 46, fits: 3, team: () => [brack(44), ...team(43, [['howl', 0], ['turbine', 0], ['quarry', 1]])], nerve: true, ai: 'trainer' },
    { name: 'Perihel', ch: 8, lv: 48, fits: 3, team: () => team(41, [['orrery', 0], ['fulgur', 0], ['dynamo', 0], ['coma', 1]]), nerve: true, ai: 'keeper' },
    // Optional legendaries, at about the chapter a player meets them, with the level, boss HP, and AI of their encounter.
    { name: 'Holm', ch: 9, lv: 52, fits: 3, team: () => [makeMon('holm', 66)], nerve: true, ai: 'keeper', bossHp: 4.4 },
    { name: 'Carcanet', ch: 9, lv: 52, fits: 3, team: () => [makeMon('carcanet', 58)], nerve: true, ai: 'keeper', bossHp: 2.8 },
    { name: 'Mundane', ch: 9, lv: 66, fits: 3, team: () => [makeMon('mundane', 68)], nerve: true, ai: 'champion', bossHp: 2.4 },
    { name: 'Climb (Bare)', ch: 9, lv: 53, fits: 3, team: bareFinal, nerve: true, ai: 'champion' },
    { name: 'Climb (Tack)', ch: 9, lv: 53, fits: 3, team: tackFinal, nerve: true, ai: 'keeper' },
    { name: 'Fid', ch: 9, lv: 55, fits: 3, team: () => team(47, [['menhir', 0], ['tor', 0], ['gore', 0], ['thumb', 1]]), nerve: true, ai: 'champion' },
    { name: 'Purchase', ch: 9, lv: 58, fits: 3, team: purchaseTeam, nerve: true, ai: 'champion' },
    { name: 'Cinch', ch: 9, lv: 60, fits: 3, team: cinchTeam, nerve: true, ai: 'champion' },
    // The Strand. lv is the Strand cap on arrival.
    { name: 'Sifter', ch: 11, lv: 15, fits: 3, team: () => team(0, SIFTER_TEAM), nerve: true, ai: 'keeper' },
    { name: 'Tack (Flats)', ch: 12, lv: 25, fits: 3, team: tackFlatsTeam, nerve: true, ai: 'trainer' },
    { name: 'Gloss', ch: 12, lv: 25, fits: 3, team: () => team(0, GLOSS_TEAM), nerve: true, ai: 'keeper' },
    { name: 'Turnwise', ch: 13, lv: 35, fits: 3, team: () => team(0, TURNWISE_TEAM), nerve: true, ai: 'keeper' },
    { name: 'Tack (Strand)', ch: 14, lv: 45, fits: 3, team: tackTeam, nerve: true, ai: 'keeper' },
    { name: 'Siphon', ch: 14, lv: 45, fits: 3, team: siphonTeam, nerve: true, ai: 'keeper' },
    { name: 'Mudlark', ch: 15, lv: 55, fits: 3, team: mudTeam, nerve: true, ai: 'keeper' },
    { name: 'Cinch\'s cast', ch: 15, lv: 55, fits: 3, team: castTeam, nerve: true, ai: 'champion' },
    { name: 'Gleaner', ch: 16, lv: 70, fits: 3, team: gleanerTeam, nerve: true, ai: 'champion', bossHp: GLEANER_HP },
  ];

  console.log(`${N} battles per fight. Player: random kinds from routes so far, AI 'keeper' on both sides.`);
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).toLowerCase();
  const hpArg = Number(process.argv.find(a => a.startsWith('--bosshp='))?.slice(9) || 0);
  for (const f of FIGHTS) {
    if (only && !f.name.toLowerCase().includes(only)) continue;
    if (hpArg && f.bossHp) f.bossHp = hpArg;
    let w = 0;
    for (let i = 0; i < N; i++) {
      const p = playerTeam(f.ch > 10 ? f.ch : f.ch + 1, f.lv, f.fits).slice(0, f.size ?? 4);
      if (fight(p, f.team(), f.nerve, 'keeper', f.ai, f.ch, f.bossHp)) w++;
    }
    const pct = (100 * w / N).toFixed(0).padStart(3);
    console.log(`${f.name.padEnd(14)} L${String(f.lv).padEnd(3)} player wins ${pct}%`);
  }
}

main();
