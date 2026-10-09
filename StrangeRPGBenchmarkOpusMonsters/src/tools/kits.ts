export {};
// Kit report: every kind's moves and passives with a mechanic signature, a uniqueness score, and near-duplicate abilities.
// Usage: node dist-tools/kits.js out.json
declare const process: { argv: string[] };
const g = globalThis as any;
const fakeCtx = new Proxy({}, { get: () => () => {}, set: () => true });
g.document = { getElementById: () => ({ getContext: () => fakeCtx, style: {} }), createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
g.window = { addEventListener: () => {}, innerWidth: 800, innerHeight: 800 };
g.localStorage = { getItem: () => null, setItem: () => {} };

interface Ability { id: string; kind: 'move' | 'passive'; name: string; text: string; tags: string[]; big?: boolean; wu?: boolean; type?: string }

async function main(): Promise<void> {
  const fs = await import('node:fs');
  await import('../data/species');
  const { SPECIES, WILD_KINDS } = await import('../data/species');
  const { MOVES, PASSIVES } = await import('../battle/registry');

  // Helpers a move body calls, status and mark ids it names, and the hooks a passive defines.
  const calls = (src: string) => [...new Set([...src.matchAll(/\b(?:c|b|f|t|tgt|self)\.(\w+)\(/g)].map(m => m[1]))];
  const named = (src: string) => [...new Set([...src.matchAll(/(?:status|mark|has|marked|unmark|setMove|applyStatus)\([^)]*?'(\w+)'/g)].map(m => m[1]))];
  const SKIP = new Set(['id', 'name', 'owner', 'text', 'type', 'reach', 'cd', 'nerve', 'wu', 'wt', 'tag', 'extra', 'noGuard', 'unstop']);

  const abilities = new Map<string, Ability>();
  for (const m of Object.values(MOVES) as any[]) {
    const src = String(m.run);
    const tags = [...calls(src).map(x => 'call:' + x), ...named(src).map(x => 'id:' + x), 'reach:' + m.reach, m.wu ? 'windup' : '', m.nerve ? 'big' : '', m.unstop ? 'unstop' : '', m.noGuard ? 'noguard' : ''].filter(Boolean);
    abilities.set(m.id, { id: m.id, kind: 'move', name: m.name, text: m.text, tags, big: !!m.nerve, wu: !!m.wu, type: m.type });
  }
  for (const p of Object.values(PASSIVES) as any[]) {
    const hooks = Object.keys(p).filter(k => typeof p[k] === 'function');
    const src = hooks.map(k => String(p[k])).join('\n');
    const tags = [...hooks.map(h => 'hook:' + h), ...calls(src).map(x => 'call:' + x), ...named(src).map(x => 'id:' + x)];
    abilities.set(p.id, { id: p.id, kind: 'passive', name: p.name, text: p.text, tags });
  }

  // A tag used by few abilities is a rare mechanic. A kind's score is the rarity of its six abilities.
  const kinds = Object.values(SPECIES).filter((s: any) => WILD_KINDS.includes(s.id)) as any[];
  const used = kinds.flatMap(s => [...s.moves, ...s.passives]).map(id => abilities.get(id)).filter(Boolean) as Ability[];
  const freq = new Map<string, number>();
  for (const a of used) for (const t of new Set(a.tags)) if (!SKIP.has(t)) freq.set(t, (freq.get(t) || 0) + 1);
  const rarity = (a: Ability) => a.tags.reduce((s, t) => s + 1 / Math.max(1, freq.get(t) || 1), 0);
  const norm = (s: string) => s.toLowerCase().replace(/\d+(\.\d+)?%?/g, '#').replace(/[^a-z# ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const jac = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

  const out = kinds.map(s => {
    const abs = [...s.moves, ...s.passives].map((id: string) => abilities.get(id)!).filter(Boolean);
    return { id: s.id, name: s.name, types: s.types, area: s.area, sprite: s.sprite, c: s.c, entry: s.entry, score: abs.reduce((n: number, a: Ability) => n + rarity(a), 0),
      abilities: abs.map((a: Ability) => ({ ...a, rarity: rarity(a), rareTags: a.tags.filter(t => (freq.get(t) || 0) <= 2) })) };
  }).sort((a, b) => b.score - a.score);

  // Near duplicates: abilities of different kinds whose texts share most words once numbers are ignored.
  const owners = new Map<string, string>();
  for (const s of kinds) for (const id of [...s.moves, ...s.passives]) owners.set(id, s.name);
  const list = [...owners.keys()].map(id => abilities.get(id)!).filter(Boolean);
  const dupes: { a: string; b: string; ownerA: string; ownerB: string; textA: string; textB: string; sim: number }[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const A = list[i], B = list[j];
    if (A.kind !== B.kind || owners.get(A.id) === owners.get(B.id)) continue;
    const sim = jac(norm(A.text), norm(B.text));
    if (sim >= 0.6) dupes.push({ a: A.name, b: B.name, ownerA: owners.get(A.id)!, ownerB: owners.get(B.id)!, textA: A.text, textB: B.text, sim });
  }
  dupes.sort((x, y) => y.sim - x.sim);
  fs.writeFileSync(process.argv[2] || 'kits.json', JSON.stringify({ kinds: out, dupes, tags: Object.fromEntries([...freq].sort((a, b) => a[1] - b[1])) }));
  console.log(`${out.length} kinds, ${list.length} abilities, ${dupes.length} near-duplicate pairs.`);
}

main();
