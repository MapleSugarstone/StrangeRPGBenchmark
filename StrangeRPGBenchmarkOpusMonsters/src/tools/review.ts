export {};
// Writes review/whorls.json for the sprite review page: every wild kind with its sprite, kit, summons, and forms.
// Usage: node dist-tools/review.js
declare const process: { argv: string[] };
const g = globalThis as any;
const fakeCtx = new Proxy({}, { get: () => () => {}, set: () => true });
g.document = { getElementById: () => ({ getContext: () => fakeCtx, style: {} }), createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
g.window = { addEventListener: () => {}, innerWidth: 800, innerHeight: 800 };
g.localStorage = { getItem: () => null, setItem: () => {} };
g.performance = g.performance || { now: () => Date.now() };

/** The cast who never stand in the field under their own name, by their sprite id. */
const ROLE: Record<string, string> = {
  vellum: 'Ouro, the player', stone: 'Stand-in under a whorl shown in the field', sign: 'Signposts', peg: 'The Shellboard peg',
  riderhand: 'A Rider\'s hand, in scenes', basket: 'Someone carrying a basket',
  oldcast: 'The old man\'s cast, standing beside him in Turnstone. A story whorl.',
  pellcast: 'Pell\'s cast, lost in the Undermeadow and then home. A story whorl.',
  brack: 'Brack, Tack\'s conjoined whorl (Tackle and Brine). A story whorl.',
};
/** Names for sprites nobody on the maps wears under their own name. */
const NAME: Record<string, string> = { vellum: 'Ouro', brack: 'Brack', oldcast: 'Old man\'s cast', pellcast: 'Pell\'s cast' };
/** Person sprites that are really whorls: casts and a conjoined whorl, listed under Story whorls on the review page. */
const STORY_PEOPLE = ['oldcast', 'pellcast', 'brack'];

interface Pic { px: string[]; c: string[] }

async function main(): Promise<void> {
  const fs = await import('node:fs');
  const { SPECIES, WILD_KINDS } = await import('../data/species');
  const { MOVES, PASSIVES, SUMMONS } = await import('../battle/registry');

  // One-line concepts and looks from the kit theme pass, when it has written them.
  let concepts: { kinds?: Record<string, string>; summons?: Record<string, string>; forms?: Record<string, string> } = {};
  try { concepts = JSON.parse(fs.readFileSync('Notes/concepts.json', 'utf8')); } catch { /* not written yet */ }

  // Form sprites are module constants in the kits files, so they are read from the source.
  const kitFiles = fs.readdirSync('src/data').filter((f: string) => /^kits\d*\.ts$/.test(f)).map((f: string) => fs.readFileSync(`src/data/${f}`, 'utf8'));
  const strs = (s: string): string[] => [...s.matchAll(/'([^']*)'/g)].map(m => m[1]);
  const consts: Record<string, Pic> = {};
  const forms: Record<string, { tag: string; constName: string; move: string }[]> = {};
  for (const src of kitFiles) {
    for (const m of src.matchAll(/const ([A-Z][A-Z0-9_]*): SpriteData = \{ px: \[([^\]]*)\], c: \[([^\]]*)\] \};/g)) consts[m[1]] = { px: strs(m[2]), c: strs(m[3]) };
    for (const m of src.matchAll(/setForm\([^{]*\{ tag: '([a-z0-9_]+)'[^}]*?sprite: ([A-Z][A-Z0-9_]*)/g)) {
      const before = src.slice(0, m.index);
      const owners = [...before.matchAll(/owner: '([a-z0-9]+)'/g)];
      const names = [...before.matchAll(/name: '((?:[^'\\]|\\.)*)'/g)];
      const prefix = m[2].split('_')[0].toLowerCase();
      const owner = (SPECIES as any)[prefix] ? prefix : owners.length ? owners[owners.length - 1][1] : prefix;
      const list = (forms[owner] = forms[owner] || []);
      if (!list.some(f => f.constName === m[2])) list.push({ tag: m[1], constName: m[2], move: names.length ? names[names.length - 1][1].replace(/\\'/g, '\'') : '' });
    }
  }

  // A summon with no sprite draws as a small token in its owner's colors, shown here the same way.
  const token = (c: string[]): Pic => ({ px: ['........', '.11111..', '.12221..', '.12321..', '.12221..', '.11111..', '........', '........'], c: c.slice(0, 2) });

  const SLOTS = ['Q', 'W', 'E', 'R'];
  // Story whorls: every kind that is not an ordinary wild catch (legendaries, casts, bosses, one-offs) also gets a card.
  const STORY = Object.keys(SPECIES).filter(id => !WILD_KINDS.includes(id));
  const kinds = [...WILD_KINDS, ...STORY].map((id: string) => {
    const s = (SPECIES as any)[id];
    const story = STORY.includes(id);
    const parts = [
      ...Object.values(SUMMONS).filter((d: any) => d.owner === id).map((d: any) => ({
        id: `summon:${d.id}`, part: 'summon', name: d.name, text: d.text || '', look: concepts.summons?.[d.id] || '',
        sprite: d.sprite ? { px: d.sprite.px, c: d.sprite.c } : token(s.c), token: !d.sprite,
      })),
      ...(forms[id] || []).filter(f => consts[f.constName]).map(f => ({
        id: `form:${f.constName.toLowerCase()}`, part: 'form', name: `${f.tag} form`, text: f.move ? `From ${f.move}.` : '', look: concepts.forms?.[`${id}:${f.tag}`] || '',
        sprite: consts[f.constName], token: false,
      })),
    ];
    return {
      id, name: s.name, types: s.types, area: story ? `story${s.legendary ? ', legendary' : s.person ? ', a person\'s cast' : ''}` : s.area, entry: s.entry || '',
      concept: concepts.kinds?.[id] || (story && s.fit ? `It ${s.fit}.` : ''), story,
      sprite: { px: s.sprite, c: s.c },
      moves: s.moves.map((mid: string, i: number) => {
        const m = (MOVES as any)[mid];
        return { slot: SLOTS[i] || String(i + 1), id: mid, name: m?.name || mid, text: m?.text || '', type: m?.type, cd: m?.cd, big: !!m?.nerve, tide: m?.nerve || 0, windup: !!m?.wu };
      }),
      passives: s.passives.map((pid: string, i: number) => ({ slot: `P${i + 1}`, id: pid, name: (PASSIVES as any)[pid]?.name || pid, text: (PASSIVES as any)[pid]?.text || '' })),
      parts,
    };
  });
  // The story cast: every person sprite, named by who wears it on the maps. Kept designs go back into src/engine/sprites.ts.
  await import('../content');
  const { PEOPLE } = await import('../engine/sprites');
  const { MAPS } = await import('../game/world');
  const wearers: Record<string, Set<string>> = {};
  for (const m of Object.values(MAPS)) for (const n of m.npcs) if (n.name && !n.mon && !n.img) (wearers[n.sprite] ||= new Set()).add(String(n.name));
  const people = Object.entries(PEOPLE).filter(([id]) => id !== 'stone').map(([id, sp]) => {
    const names = [...(wearers[id] || [])];
    return { id: `person:${id}`, story: STORY_PEOPLE.includes(id), sprite: { px: sp.px, c: sp.c }, name: NAME[id] || names[0] || ROLE[id] || id, role: ROLE[id] || (names.length ? `Worn by ${names.slice(0, 6).join(', ')}${names.length > 6 ? ', and others' : ''}` : 'Used in scenes'), uses: names.length };
  });
  fs.mkdirSync('review', { recursive: true });
  fs.writeFileSync('review/whorls.json', JSON.stringify({ made: new Date().toISOString(), kinds, people }));
  const nParts = kinds.reduce((n: number, k: any) => n + k.parts.length, 0);
  console.log(`review/whorls.json: ${kinds.length} kinds, ${nParts} summons and forms, ${people.length} people.`);
}

main();
