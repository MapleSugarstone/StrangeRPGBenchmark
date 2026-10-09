export {};
// Prints maps for editing: every map's size and warps, or the full rows of the maps named on the command line.
// Usage: node dist-tools/maps.js [mapId ...]
declare const process: { argv: string[] };
const g = globalThis as any;
const fakeCtx = new Proxy({}, { get: () => () => {}, set: () => true });
g.document = { getElementById: () => ({ getContext: () => fakeCtx, style: {} }), createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
g.window = { addEventListener: () => {}, innerWidth: 800, innerHeight: 800 };
g.localStorage = { getItem: () => null, setItem: () => {} };
g.performance = g.performance || { now: () => Date.now() };

async function main(): Promise<void> {
  await import('../data/species');
  await import('../content');
  const { MAPS } = await import('../game/world');
  const want = process.argv.slice(2);
  for (const m of Object.values(MAPS)) {
    if (want.length && !want.includes(m.id)) continue;
    const W = m.rows[0].length, H = m.rows.length;
    console.log(`== ${m.id} (${m.name}) region ${m.region} ${W}x${H} zone ${m.zone ? m.zone.area + ' ' + m.zone.lv.join('-') : '-'}`);
    console.log('warps: ' + m.warps.map(w => `(${w.x},${w.y})->${w.to}(${w.tx},${w.ty})`).join(' '));
    if (want.length) {
      console.log('people: ' + m.npcs.map(n => `${n.id}@${n.x},${n.y}`).join(' '));
      console.log('   ' + Array.from({ length: W }, (_, i) => String(i % 10)).join(''));
      m.rows.forEach((r, i) => console.log(String(i).padStart(2) + ' ' + r));
    }
  }
}
void main();
