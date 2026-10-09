// Lists every kind a player can get, and how: wild zones, sleeping whorls, and scripts that give a whorl or start a catchable fight.
// node dist-tools/obtain.js prints the kinds with no way to get them. The test suite runs the same check.
declare const process: { argv: string[] };
const g = globalThis as any;
// Minimal stand-ins so browser modules load in Node, as the test tool sets up.
if (!g.document) {
  const fakeCtx = new Proxy({}, { get: () => () => {}, set: () => true });
  g.document = { getElementById: () => ({ getContext: () => fakeCtx, style: {} }), createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
  g.window = { addEventListener: () => {}, innerWidth: 800, innerHeight: 800 };
  g.localStorage = { getItem: () => null, setItem: () => {} };
}

export async function obtainable(): Promise<{ ways: Map<string, string[]>; missing: string[] }> {
  await import('../data/species');
  await import('../content');
  const { MAPS, SCRIPTS } = await import('../game/world');
  const { SPECIES } = await import('../data/species');
  const ways = new Map<string, string[]>();
  const add = (kind: string, how: string) => { if (!SPECIES[kind]) return; if (!ways.has(kind)) ways.set(kind, []); ways.get(kind)!.push(how); };
  for (const m of Object.values(MAPS)) {
    const z = m.zone;
    if (z) for (const [k] of [...z.kinds, ...(z.tideKinds?.high || []), ...(z.tideKinds?.low || [])]) add(k, `wild on ${m.id}`);
    for (const n of m.npcs) if (n.sleeper) add(n.sleeper.kind, `sleeping on ${m.id}`);
  }
  // A script that makes a whorl with mon(), makeMon(), or giveStrandMon() either gives it or starts a fight it can be sounded in.
  for (const [id, fn] of Object.entries(SCRIPTS)) {
    const src = String(fn);
    for (const m of src.matchAll(/\b(?:mon|makeMon|giveStrandMon)\(\s*['"]([a-z0-9_]+)['"]/g)) add(m[1], `script ${id}`);
  }
  // Gifts and catchable fights inside helper functions never show in a script body, so the content source is read too.
  const fsName = 'node:fs';
  const fs: any = await import(fsName);
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: any) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []));
  for (const file of walk('src/content')) {
    const src: string = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\b(?:giveStrandMon|giveMon|fightWild)\(\s*(?:mon\(\s*)?['"]([a-z0-9_]+)['"]/g)) add(m[1], `source ${file}`);
  }
  const missing = Object.keys(SPECIES).filter(k => !SPECIES[k].person && !ways.has(k));
  return { ways, missing };
}

if (process.argv[1]?.endsWith('obtain.js')) {
  obtainable().then(({ missing, ways }) => {
    console.log(`${ways.size} kinds can be got. ${missing.length} cannot:`);
    for (const k of missing) console.log('  ' + k);
  });
}
