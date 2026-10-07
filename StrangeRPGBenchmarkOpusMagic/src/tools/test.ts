// Unit and smoke tests for the Cant and the battle engine. Run with: npm test
import { parse } from '../cant/parser';
import { cost, costLabel } from '../cant/analyze';
import { ALLIES, ENCOUNTERS, FOES } from '../game/enemies';
import { Battle, BattleSetup, makePage } from '../game/battle';
import { SCENES } from '../story/script';
import { MAPS, REGIONS } from '../game/maps';
import { LEGEND, MapDef } from '../game/mapkit';
import { TILES, allSpriteDefs } from '../engine/sprites';
import '../engine/sprites16';
import '../engine/sprites2';
import { PROBLEMS, runSheet } from '../game/margin';
import { STOPS } from '../game/shop';
import { MActor, MoverWorld, answer, groupDone, parseMover, stepAll, writeInto } from '../game/movers';

let fails = 0;
let passes = 0;
function ok(cond: unknown, what: string) {
  if (cond) passes++;
  else { fails++; console.log(`FAIL: ${what}`); }
}

function errs(src: string): string[] {
  return parse(src).diags.filter((d) => d.sev === 'error').map((d) => `${d.line}: ${d.msg}`);
}

// Parser accepts the language.
const good = [
  'strike foe',
  'strike',
  'repeat 3: strike foe',
  'repeat 3:\n  strike foe\n  wait',
  'if foe.hp < 4:\n  strike foe\nelse:\n  mend me',
  'if foe.hp < 4: strike foe\nelse: mend me',
  'let t = weakest(foes)\nstrike t',
  'each f in foes: strike f',
  'each f in foes:\n  if f.wet > 0: jolt f',
  'when hurt:\n  mend me',
  'when ally hurt: mend who',
  'when hurt 3 times: strike by',
  'when foe acts:\n  if who.next is "bite":\n    ward me',
  'say "hp", foe.hp',
  'say foe.hp + 1',
  'halt',
  'halt foe',
  'halt again',
  'again',
  '# just an aside',
  'strike foe  # with an aside',
  'if not foe.up or me.ink<2: halt',
  'if foe.next is not "bite": halt',
  'cast other',
];
for (const g of good) ok(errs(g).length === 0, `should parse: ${JSON.stringify(g)} -> ${errs(g).join(' | ')}`);

// Parser rejects mistakes with useful messages.
const bad: [string, RegExp][] = [
  ['strik foe', /did you mean strike/],
  ['repeat 3\n  strike foe', /colon/],
  ['repeat 3:', /needs lines/],
  ['if foe.hp = 3: strike foe', /==/],
  ['strike foe foe', /goes on/],
  ['  strike foe', /first line|pushed in/],
  ['strike foe\n    strike foe', /too far/],
  ['else:\n  strike foe', /else must/],
  ['strike fo', /did you mean foe/],
  ['say foe.hpp', /did you mean hp/],
  ['let strike = 3', /already a word/],
  ['say "open', /never closed/],
  ['strike weakest', /needs \( \)/],
  ['each f foes: strike f', /in/],
  ['when thing: strike foe', /events are/],
  ['repeat 3: strike foe\n  strike foe', /already has its one line/],
  ['strike foe and then some more words here', /goes on|long/],
];
for (const [src, re] of bad) {
  const e = errs(src);
  ok(e.some((m) => re.test(m)), `should reject ${JSON.stringify(src)} with ${re}: got ${e.join(' | ') || 'no errors'}`);
}

// Cost estimates.
ok(costLabel(cost(parse('repeat 3: strike foe').stmts)) === 'ink 3', 'cost of repeat 3 strike');
ok(costLabel(cost(parse('if foe.hp < 3:\n  strike foe\nelse:\n  mend me').stmts)) === 'ink 1-2', 'cost of if/else');
ok(costLabel(cost(parse('strike foe\nwait\nstrike foe').stmts)) === 'ink 2 2t', 'cost with wait');
ok(cost(parse('strike foe\nagain').stmts).forever, 'again loops forever');

// Every rote in the game parses.
for (const f of Object.values(FOES)) {
  ok(errs(f.rote).length === 0, `foe rote ${f.key}: ${errs(f.rote).join(' | ')}`);
  for (const ph of f.phases ?? []) ok(errs(ph.rote).length === 0, `phase rote ${f.key}: ${errs(ph.rote).join(' | ')}`);
  if (f.page) ok(errs(f.page.src).length === 0, `page ${f.key}: ${errs(f.page.src).join(' | ')}`);
}
for (const a of Object.values(ALLIES)) ok(errs(a.rote).length === 0, `ally rote ${a.key}: ${errs(a.rote).join(' | ')}`);
for (const [k, e] of Object.entries(ENCOUNTERS)) for (const f of e.foes) ok(!!FOES[f], `encounter ${k} foe ${f}`);

// Battle smoke tests.
const ALL = new Set(['strike', 'mend', 'ward', 'soak', 'jolt', 'sear', 'wait', 'say', 'repeat', 'if', 'else', 'let', 'count', 'first', 'weakest', 'strongest', 'erase', 'again', 'halt', 'cast']);
function setup(enc: string, pages: [string, string][], allies: string[] = [], seed = 1): BattleSetup {
  return {
    enc,
    wait: { hp: 30, max: 30, ink: 10, maxInk: 10, regen: 3, hands: 1, ticks: 30 },
    allies: allies.map((k) => ({ key: k, hp: ALLIES[k].hp, max: ALLIES[k].hp })),
    pages: [makePage('wait', 'wait'), ...pages.map(([n, s]) => makePage(n, s))],
    canSay: (w) => ALL.has(w),
    lent: { each: 'each', when: 'when' },
    items: {},
    seed,
  };
}

function fight(b: Battle, pick: (b: Battle) => number, maxRounds = 60) {
  b.start();
  while (b.phase === 'command' && b.round < maxRounds) {
    const target = b.livingFoes()[0];
    b.act({ kind: 'cast', page: pick(b), target: target?.id ?? '' });
  }
  return b;
}

{
  const b = fight(new Battle(setup('nip', [['hit3', 'repeat 3: strike foe']])), () => 1);
  ok(b.result === 'win', `wait beats a nip with repeat 3: ${b.result}`);
}
{
  const b = fight(new Battle(setup('straw', [['hit', 'strike foe']])), () => 1);
  ok(b.result === 'win' && b.round <= 3, `straw falls in 3 rounds: ${b.result} r${b.round}`);
}
{
  const b = new Battle(setup('nip', [['bad', 'strike foe\nwait\nstrike foe\nwait\nstrike foe']]));
  b.start();
  b.act({ kind: 'cast', page: 1, target: b.livingFoes()[0].id });
  ok(b.hands.length === 1 && b.hands[0].status === 'suspended', 'a spell with wait is suspended in a hand');
}
{
  const b = new Battle(setup('chaff', [['say', 'say "hp", foe.hp']]));
  b.start();
  const ev = b.act({ kind: 'cast', page: 1, target: b.livingFoes()[0].id });
  ok(ev.some((e) => e.t === 'say' && e.text === 'hp 10'), `say prints values: ${JSON.stringify(ev.filter((e) => e.t === 'say'))}`);
}
{
  const b = new Battle(setup('nip', [['dry', 'repeat 12: strike foe']]));
  b.start();
  const ev = b.act({ kind: 'cast', page: 1, target: b.livingFoes()[0].id });
  ok(ev.some((e) => e.t === 'end' && (e.reason === 'dry' || e.reason === 'done')), 'running out of ink ends the spell');
}
{
  const b = fight(new Battle(setup('grind', [['hit3', 'repeat 3: strike foe']])), () => 1);
  ok(b.result !== null, `grind fight ends: ${b.result} in ${b.round} rounds`);
}
{
  // Erase empties a copied villager.
  const b = new Battle(setup('csweep', [['er', 'erase foe']]));
  b.wait.maxInk = 20; b.wait.ink = 20;
  b.start();
  b.act({ kind: 'cast', page: 1, target: b.livingFoes()[0].id });
  b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
  ok(b.foes[0].freed && b.result === 'win', `erase frees sweep: freed=${b.foes[0].freed} result=${b.result}`);
}
{
  // The finale: a page with halt, copied by Again in its second phase, ends it.
  const s = setup('again', [['big', 'strike foe\nstrike foe\nstrike foe'], ['end', 'halt']], ['each', 'when']);
  s.wait.maxInk = 30; s.wait.ink = 30; s.wait.hp = 200; s.wait.max = 200;
  const b = new Battle(s);
  b.foes[0].hp = 100;
  b.start();
  let rounds = 0;
  while (b.phase === 'command' && rounds++ < 80) {
    const page = b.foes[0].phase > 0 ? 2 : 1;
    b.act({ kind: 'cast', page, target: b.foes[0].id });
  }
  ok(b.result === 'win' && b.againHalted, `again halts after copying halt: ${b.result} halted=${b.againHalted} phase=${b.foes[0].phase} round=${b.round}`);
}
{
  // Many's original presses fallen copies back up.
  const b = new Battle(setup('many', [['hit', 'strike foe']], ['halt']));
  b.start();
  ok(b.foes.length === 5 && b.foes.filter((f) => f.tags.includes('original')).length === 1, 'many has one original');
}
{
  // When handlers fire once a round.
  const b = new Battle(setup('nip2', [['listen', 'when hurt:\n  mend me']], ['when']));
  b.start();
  b.act({ kind: 'cast', page: 1, target: b.livingFoes()[0].id });
  ok(b.hands[0]?.status === 'listening', `a when page keeps listening: ${b.hands[0]?.status}`);
}

// ---------------------------------------------------------------- regressions from the code review

const ALL2 = new Set([...ALL, 'burst', 'bite', 'jolt', 'soak', 'when', 'each', 'play']);
function setup2(enc: string, pages: [string, string][], allies: string[] = [], seed = 1): BattleSetup {
  const s = setup(enc, pages, allies, seed);
  s.canSay = (w) => ALL2.has(w);
  return s;
}
{
  // Writing into rotes: the parser, the cost, and the battle.
  const prog = parse('into foe: strike me');
  ok(!prog.diags.length && prog.stmts[0].k === 'into' && (prog.stmts[0] as { text: string }).text === 'strike me', `into parses: ${JSON.stringify(prog.diags)}`);
  ok(errs('into foe: repeat 2: strike me').length === 1, 'into refuses a block');
  ok(errs('into foe strike me').length === 1, 'into needs a colon');
  ok(cost(parse('into foe: strike me').stmts).max === 4, `into costs the line plus 3: ${cost(parse('into foe: strike me').stmts).max}`);
  const W3 = new Set([...ALL, 'into', 'stet', 'bite']);
  const mk = (enc: string, src: string) => { const st = setup(enc, [['w', src]]); st.canSay = (w) => W3.has(w); st.wait.regen = 0; return st; };
  {
    const b = new Battle(mk('nip', 'into foe: wait'));
    b.start();
    b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
    ok(b.wait.hp === b.wait.max, `into foe: wait skips the foe's turn: hp ${b.wait.hp}/${b.wait.max}`);
    ok(b.wait.ink === 7, `into foe: wait costs 3 ink: ${b.wait.ink}`);
  }
  {
    const b = new Battle(mk('foe:m_post', 'into foe: strike me'));
    b.start();
    const hp0 = b.foes[0].hp;
    b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
    ok(b.foes[0].hp === hp0 - 3, `into foe: strike me makes the foe strike itself: ${hp0} to ${b.foes[0].hp}`);
  }
  {
    const st = mk('foe:m_post,m_post,m_post', 'into foe: wait\ninto last(foes): wait');
    st.wait.nib = 1;
    st.canSay = (w) => W3.has(w) || w === 'last';
    const b = new Battle(st);
    b.start();
    const logs: string[] = [];
    for (const e of b.act({ kind: 'cast', page: 1, target: b.foes[0].id })) if (e.t === 'log') logs.push(e.text);
    ok(logs.some((l) => l.includes('takes back')), `a nib of one takes back the first line: ${logs.join(' / ')}`);
    ok(b.foes.every((f) => f.written.length === 0), 'written lines are spent on the turn they run');
  }
  {
    const b = new Battle(mk('foe:m_post', 'stet me'));
    b.start();
    b.setup.pages[1].closed = false;
    const pg = b.setup.pages[1];
    b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
    pg.closed = true;
    b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
    ok(!pg.closed, 'a closed page opens to halt once');
  }
  const logsOf = (b: Battle, n: number, page = 1) => {
    const logs: string[] = [];
    for (const e of b.start()) if (e.t === 'log') logs.push(e.text);
    for (let i = 0; i < n && b.phase === 'command'; i++) {
      for (const e of b.act({ kind: 'cast', page, target: b.foes.find((f) => f.up)!.id })) if (e.t === 'log') logs.push(e.text);
    }
    return logs;
  };
  ok(!errs('when written: stet who').length && !errs('when ally written: stet who').length && !errs('if foe.written > 0: stet foe').length, 'written parses as an event and a property');
  {
    const st = mk('caret', 'say "x"');
    st.wait.hp = st.wait.max = 200;
    const logs = logsOf(new Battle(st), 3);
    ok(logs.some((l) => l.includes('Caret writes into Wait: halt')) && logs.some((l) => l.includes("Wait's turn stops")), `a caret's halt takes Wait's turn: ${logs.join(' / ')}`);
  }
  {
    const st = mk('caret', 'when written: stet who');
    st.canSay = () => true;
    st.wait.hp = st.wait.max = 200;
    const logs = logsOf(new Battle(st), 3);
    ok(logs.some((l) => l.includes('crossed out')) && !logs.some((l) => l.includes("Wait's turn stops")), `when written: stet who answers a caret: ${logs.join(' / ')}`);
  }
  {
    const st = mk('dele', 'into foe: wait');
    st.wait.hp = st.wait.max = 200;
    const logs = logsOf(new Battle(st), 3);
    ok(logs.some((l) => l.includes('crossed out')), `dele crosses out a line written into its ally: ${logs.join(' / ')}`);
  }
  {
    const st = mk('footstop', 'say "x"');
    st.wait.hp = st.wait.max = 200;
    const logs = logsOf(new Battle(st), 2);
    ok(logs.some((l) => /Footnote writes into .*: mend me/.test(l)), `a footnote writes mend into its side: ${logs.join(' / ')}`);
  }
}
{
  // Seals: thrift makes the first verb of a cast cheaper, heavy makes the first harm bigger.
  const run = (seal?: string) => {
    const st = setup('foe:m_post', [['two', 'strike foe\nstrike foe']]);
    st.pages[1].seal = seal;
    st.wait.regen = 0;
    const b = new Battle(st);
    b.start();
    b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
    return { ink: b.wait.ink, hp: b.foes[0].hp };
  };
  const plain = run(), thrift = run('thrift'), heavy = run('heavy');
  ok(thrift.ink === plain.ink + 1 && thrift.hp === plain.hp, `thrift saves one ink: ${JSON.stringify([plain, thrift])}`);
  ok(heavy.hp === plain.hp - 3 && heavy.ink === plain.ink, `heavy adds 3 harm once: ${JSON.stringify([plain, heavy])}`);
}
{
  // A copied burst does not fell the Relay outright.
  const s = setup2('relay', [['boom', 'burst foe']], ['halt']);
  s.wait.hp = s.wait.max = 300; s.wait.maxInk = s.wait.ink = 40; s.wait.regen = 10;
  const b = new Battle(s);
  b.start();
  for (let i = 0; i < 3 && b.phase === 'command'; i++) b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
  ok(b.foes[0].up && b.foes[0].hp > 50, `relay survives copied bursts: up=${b.foes[0].up} hp=${b.foes[0].hp}`);
}
{
  // Again playing a burst page does not end the fight.
  const s = setup2('again', [['boom', 'burst foe']], ['each', 'when']);
  s.wait.hp = s.wait.max = 300; s.wait.maxInk = s.wait.ink = 40;
  const b = new Battle(s);
  b.start();
  for (let i = 0; i < 3 && b.phase === 'command'; i++) b.act({ kind: 'pass' });
  ok(b.foes[0].up, `again survives playing burst: hp=${b.foes[0].hp} result=${b.result}`);
}
{
  // Play inside a played page does not recurse.
  const s = setup2('again', [['loop', 'play foe']], ['each']);
  s.wait.hp = s.wait.max = 300;
  const b = new Battle(s);
  let threw = false;
  try { b.start(); for (let i = 0; i < 3 && b.phase === 'command'; i++) b.act({ kind: 'pass' }); } catch { threw = true; }
  ok(!threw, 'play recursion is refused');
}
{
  // The last fight is lost when Wait falls.
  const s = setup2('again', [['big', 'strike foe\nstrike foe\nstrike foe']], ['each', 'when']);
  s.wait.hp = 3; s.wait.max = 3;
  const b = new Battle(s);
  b.start();
  for (let i = 0; i < 20 && b.phase === 'command'; i++) b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
  ok(b.result === 'lose' && b.round < 40, `again fight ends when wait falls: ${b.result} r${b.round}`);
}
{
  // Hold's next verb is judged from its own condition, and erase can find it.
  const s = setup2('hold', [['peek', 'say foe.next'], ['er', 'erase foe']], ['halt']);
  s.wait.maxInk = s.wait.ink = 20;
  const b = new Battle(s);
  b.start();
  const ev = b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
  const said = ev.find((e) => e.t === 'say');
  ok(said && said.t === 'say' && (said.text === 'press' || said.text === 'halt'), `hold.next is press or halt: ${said && said.t === 'say' ? said.text : 'none'}`);
  const ev2 = b.act({ kind: 'cast', page: 2, target: b.foes[0].id });
  ok(ev2.some((e) => e.t === 'log' && e.text.startsWith('Erased from Hold')), 'erase finds a line in hold');
}
{
  // A foe that falls mid-turn stops striking.
  const s = setup2('foe:waitcopy', [['back', 'when hurt: repeat 4: strike by']]);
  s.wait.hp = s.wait.max = 200;
  const b = new Battle(s);
  b.foes[0].hp = 6;
  b.start();
  b.act({ kind: 'cast', page: 1, target: b.foes[0].id });
  let rounds = 0;
  let harmAfterFall = 0;
  while (b.phase === 'command' && rounds++ < 6) {
    const ev = b.act({ kind: 'pass' });
    let fell = false;
    for (const e of ev) {
      if (e.t === 'fall' && e.who === b.foes[0].id) fell = true;
      if (fell && e.t === 'harm' && e.who === b.wait.id) harmAfterFall++;
    }
  }
  ok(harmAfterFall === 0, `fallen foe stops acting: ${harmAfterFall} hits after the fall`);
}
{
  // The bell cannot raise a foe.
  const s = setup2('nip2', [['hit', 'strike foe']]);
  s.items = { bell: 1 };
  const b = new Battle(s);
  b.start();
  b.foes[0].up = false; b.foes[0].hp = 0;
  b.act({ kind: 'item', item: 'bell', target: b.foes[0].id });
  ok(!b.foes[0].up && s.items.bell === 1, `bell refused on a foe: up=${b.foes[0].up} bells=${s.items.bell}`);
}

// ---------------------------------------------------------------- sprites keep the grid and three colors

for (const [k, d] of Object.entries(allSpriteDefs())) {
  const w = d.w ?? 8, h = d.h ?? 8;
  for (const rows of [d.rows, d.alt].filter(Boolean) as string[][]) {
    ok(rows.length === h, `sprite ${k}: ${rows.length} rows, expected ${h}`);
    ok(rows.every((r) => r.length === w), `sprite ${k}: a row is not ${w} wide (${rows.map((r) => r.length).join(',')})`);
    ok(rows.every((r) => /^[.123]*$/.test(r)), `sprite ${k}: uses more than three colors`);
  }
}

// ---------------------------------------------------------------- content checks

{
  const KNOWN_CMDS = new Set(['control', 'sync', 'show_rote', 'tutorial_write', 'give', 'set', 'unset', 'word', 'unword', 'join', 'leave', 'battle', 'end_chapter', 'unlock', 'read_book', 'finish_aside', 'write_line', 'trade_page', 'end_game', 'goto', 'shop', 'once', 'stet', 'seal_wait', 'unseal_wait', 'act2', 'goto_map', 'write_rule', 'end_game2', 'credits2', 'sting', 'theme']);
  for (const sc of Object.values(SCENES)) {
    for (const it of sc.items) {
      if (it.k === 'choice') ok(it.target === 'none' || !!SCENES[it.target], `scene ${sc.id}: choice target ${it.target}`);
      if (it.k === 'cmd') {
        ok(KNOWN_CMDS.has(it.cmd), `scene ${sc.id}: unknown command ${it.cmd}`);
        if (it.cmd === 'goto') ok(!!SCENES[it.args[0]], `scene ${sc.id}: goto ${it.args[0]}`);
        if (it.cmd === 'battle') ok(!!ENCOUNTERS[it.args[0]], `scene ${sc.id}: battle ${it.args[0]}`);
      }
      if (it.k === 'say' || it.k === 'narr') {
        ok(!/[—–;]/.test(it.text), `scene ${sc.id}: dash or semicolon in "${it.text}"`);
        ok(it.text.length <= 140, `scene ${sc.id}: line too long (${it.text.length}): ${it.text.slice(0, 40)}`);
      }
    }
  }
  for (const e of Object.values(ENCOUNTERS)) if (e.after) ok(!!SCENES[e.after], `encounter after-scene ${e.after}`);
  for (const f of Object.values(FOES)) if (f.freeScene) ok(!!SCENES[f.freeScene], `free scene ${f.freeScene}`);

  const legendOf = (m: MapDef): Record<string, string> => ({ ...REGIONS[m.region].legend, ...m.legend });
  for (const [k, t] of Object.entries(TILES)) {
    for (const rows of [t.rows, t.alt].filter(Boolean) as string[][]) {
      ok(rows.length === 8 && rows.every((r) => r.length === 8 && /^[.123]*$/.test(r)), `tile ${k}: not an 8x8 grid of three colors`);
    }
  }
  for (const [rk, r] of Object.entries(REGIONS)) for (const v of Object.values(r.legend ?? {})) ok(!!TILES[v], `region ${rk}: unknown tile ${v}`);
  const solid = (ch: string, legend: Record<string, string>) => {
    const key = legend[ch] ?? LEGEND[ch] ?? 'void';
    const tile = TILES[key];
    return tile ? !!tile.solid : true;
  };
  for (const m of Object.values(MAPS)) {
    const w = m.rows[0].length;
    ok(m.rows.every((r) => r.length === w), `map ${m.id}: rows have different widths`);
    const legend = legendOf(m);
    for (const ch of new Set(m.rows.join(''))) ok(!!(legend[ch] ?? LEGEND[ch]) && !!TILES[legend[ch] ?? LEGEND[ch]], `map ${m.id}: unknown tile "${ch}"`);
    const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < m.rows.length;
    for (const a of m.actors) {
      ok(inb(a.x, a.y), `map ${m.id}: actor ${a.id} out of bounds`);
      for (const [, sc] of a.talk ?? []) ok(!!SCENES[sc], `map ${m.id}: actor ${a.id} talk scene ${sc}`);
      if (a.enc) ok(!!ENCOUNTERS[a.enc], `map ${m.id}: actor ${a.id} encounter ${a.enc}`);
      if (a.puzzle?.scene) ok(!!SCENES[a.puzzle.scene], `map ${m.id}: puzzle scene ${a.puzzle.scene}`);
    }
    for (const e of m.exits) {
      ok(inb(e.x, e.y), `map ${m.id}: exit out of bounds`);
      if (e.to !== m.id) ok(!!MAPS[e.to], `map ${m.id}: exit to unknown map ${e.to}`);
      if (MAPS[e.to]) {
        const t = MAPS[e.to];
        ok(e.ty < t.rows.length && e.tx < t.rows[0].length && !solid(t.rows[e.ty][e.tx], legendOf(t)), `map ${m.id}: exit lands on a solid tile in ${e.to} at ${e.tx},${e.ty}`);
      }
      if (e.block) ok(!!SCENES[e.block], `map ${m.id}: block scene ${e.block}`);
    }
    for (const t of m.triggers) ok(!!SCENES[t.scene], `map ${m.id}: trigger scene ${t.scene}`);
    for (const [, sc] of m.enter ?? []) ok(!!SCENES[sc], `map ${m.id}: enter scene ${sc}`);
  }
  for (const st of STOPS) {
    const m = MAPS[st.map];
    ok(!!m && m.region === st.region && !solid(m.rows[st.y][st.x], legendOf(m)), `cart stop ${st.region}: lands on a solid tile or the wrong map`);
  }
  // Reachability: every exit, trigger, and talkable actor can be reached from where the player arrives.
  const arrivals: Record<string, [number, number][]> = {};
  for (const st of STOPS) (arrivals[st.map] ??= []).push([st.x, st.y]);
  for (const m of Object.values(MAPS)) for (const e of m.exits) (arrivals[e.to] ??= []).push([e.tx, e.ty]);
  const starts: Record<string, [number, number]> = { busy: [14, 11], river: [3, 20], twice: [2, 12], ears: [2, 14], rung1: [9, 16], millrace: [19, 19], scriv1: [9, 18] };
  for (const [k, v] of Object.entries(starts)) (arrivals[k] ??= []).push(v);
  for (const sc of Object.values(SCENES)) {
    for (const it of sc.items) {
      if (it.k !== 'cmd' || it.cmd !== 'goto_map') continue;
      const [map, x, y] = [it.args[0], Number(it.args[1]), Number(it.args[2])];
      ok(!!MAPS[map] && !solid(MAPS[map].rows[y]?.[x] ?? ' ', legendOf(MAPS[map])), `scene ${sc.id}: goto_map lands on a solid tile in ${map} at ${x},${y}`);
      (arrivals[map] ??= []).push([x, y]);
    }
  }
  for (const m of Object.values(MAPS)) {
    const h = m.rows.length, w = m.rows[0].length;
    const seen = new Set<string>();
    const q: [number, number][] = [...(arrivals[m.id] ?? [])];
    const blocked = new Set(m.actors.filter((a) => a.puzzle && !a.puzzle.becomes).map((a) => `${a.x},${a.y}`));
    const walk = (x: number, y: number) => {
      const ch = m.rows[y][x];
      if (!solid(ch, legendOf(m))) return true;
      const a = m.actors.find((ac) => ac.x === x && ac.y === y && ac.puzzle?.becomes);
      return !!a;
    };
    while (q.length) {
      const [x, y] = q.pop()!;
      const key = `${x},${y}`;
      if (seen.has(key) || x < 0 || y < 0 || x >= w || y >= h) continue;
      if (!walk(x, y) && !m.exits.some((e) => e.x === x && e.y === y)) continue;
      seen.add(key);
      if (m.exits.some((e) => e.x === x && e.y === y) && solid(m.rows[y][x], legendOf(m))) continue;
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      void blocked;
    }
    const near = (x: number, y: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
    if (!seen.size) { ok(false, `map ${m.id}: no arrival point`); continue; }
    for (const e of m.exits) ok(near(e.x, e.y), `map ${m.id}: exit at ${e.x},${e.y} unreachable`);
    for (const a of m.actors) if (a.kind !== 'deco' && a.kind !== 'foe' && !a.behind) ok(near(a.x, a.y), `map ${m.id}: actor ${a.id} at ${a.x},${a.y} unreachable`);
    for (const t of m.triggers) {
      let any = false;
      for (let dx = 0; dx < (t.w ?? 1); dx++) for (let dy = 0; dy < (t.h ?? 1); dy++) if (seen.has(`${t.x + dx},${t.y + dy}`)) any = true;
      ok(any, `map ${m.id}: trigger ${t.scene} unreachable`);
    }
  }
}

// ---------------------------------------------------------------- mover puzzles solve the way they are meant to

function moverSim(mapId: string, px: number, py: number) {
  const m = MAPS[mapId];
  const lg = { ...REGIONS[m.region].legend, ...m.legend };
  const keys = m.rows.map((r) => r.split('').map((ch) => lg[ch] ?? LEGEND[ch] ?? 'void'));
  const actors: MActor[] = m.actors.filter((a) => a.mover).map((a) => ({ def: a, x: a.x, y: a.y, gone: false, move: null, mv: parseMover(a.mover!) }));
  const w: MoverWorld = {
    w: keys[0].length, h: keys.length, keys, actors, px, py,
    solidAt: (x, y, ig) => !!TILES[keys[y][x]]?.solid || actors.some((o) => o !== ig && !o.gone && o.x === x && o.y === y),
    retile: () => undefined, remember: () => undefined, spawnCopy: () => undefined,
  };
  const get = (id: string) => actors.find((a) => a.def.id === id)!;
  return { w, get, keys };
}
{
  const { w, get, keys } = moverSim('line1', 11, 15);
  ok(writeInto(get('word1'), 'grow') === null, 'a loose word takes grow');
  stepAll(w);
  ok(keys[13][11] === 'bridge' && keys[11][11] === 'bridge' && keys[10][11] === 'road', `the loose word grows a bridge to the road: ${keys[13][11]} ${keys[11][11]}`);
}
{
  const { w, get } = moverSim('line2', 11, 13);
  for (let i = 0; i < 5; i++) stepAll(w);
  const s = get('sentence');
  ok(s.x === 15 && s.y === 12, `the sentence walks to the end of its lane: ${s.x},${s.y}`);
  ok(!groupDone(w, 'l2'), 'the sentence alone never reaches the plate');
  writeInto(s, 'turn left');
  for (let i = 0; i < 2; i++) stepAll(w);
  ok(groupDone(w, 'l2'), `turn left walks it onto the plate: ${s.x},${s.y}`);
}
{
  const { w, get } = moverSim('scriv2', 3, 20);
  for (let i = 0; i < 60; i++) stepAll(w);
  ok(!groupDone(w, 'arms'), 'the filing arms never count without stop');
  for (const id of ['arm1', 'arm2', 'arm3']) {
    const a = get(id);
    let n = 0;
    while (!(a.y === 11 && !a.mv!.stopped) && n++ < 40) stepAll(w);
    writeInto(a, 'stop');
    stepAll(w);
  }
  ok(groupDone(w, 'arms'), `stopping each arm on its plate opens the way: ${['arm1', 'arm2', 'arm3'].map((id) => `${get(id).y}${get(id).mv!.stopped ? 's' : ''}`).join(' ')}`);
}

{
  // The clay yard: roll one lump straight in, and the other up against the stalk first.
  const { w, get, keys } = moverSim('yard', 1, 2);
  const DOWN = 0, UP = 1, RIGHT = 3;
  w.px = 1; w.py = 2;
  answer(w, get('lump1'), 'strike', RIGHT);
  w.px = 3; w.py = 7;
  answer(w, get('lump2'), 'strike', UP);
  ok(get('lump2').y === 4, `the second lump stops against the stalk: ${get('lump2').x},${get('lump2').y}`);
  w.px = 2; w.py = 4;
  answer(w, get('lump2'), 'strike', RIGHT);
  ok(keys[2][5] === 'filled' && keys[4][5] === 'filled', `the clay yard fills both holes: ${keys[2][5]} ${keys[4][5]}`);
  void DOWN;
}
{
  // The seed bed: three strikes turn the seed to face the channel, then wet grows it across.
  const { w, get, keys } = moverSim('reeds', 3, 3);
  const seed = get('seed1');
  for (let i = 0; i < 3; i++) answer(w, seed, 'strike', 3);
  ok(seed.mv!.dir === 3, `three strikes turn the seed to face right: ${seed.mv!.dir}`);
  answer(w, seed, 'soak', 3);
  ok(keys[3][5] === 'bridge' && keys[3][7] === 'bridge', 'the seed grows a crossing over the channel');
}
{
  // The plaza: push both halted walkers onto the colored stones.
  const { w, get } = moverSim('plaza', 3, 5);
  const A = get('stopA'), B = get('stopB');
  w.px = 3; w.py = 5; answer(w, A, 'strike', 0);
  w.px = 3; w.py = 6; answer(w, A, 'strike', 0);
  w.px = 6; w.py = 7; answer(w, B, 'strike', 3);
  w.px = 7; w.py = 7; answer(w, B, 'strike', 3);
  w.px = 9; w.py = 6; answer(w, B, 'strike', 0);
  ok(groupDone(w, 'plaza'), `both halted walkers reach their stones: ${A.x},${A.y} ${B.x},${B.y}`);
}
{
  // The stamp room: stamp the lump to copy it, then roll each into a hole.
  const sim = moverSim('stamproom', 1, 4);
  const { w, get, keys } = sim;
  w.spawnCopy = (a, x, y) => { w.actors.push({ def: { ...a.def, id: 'plump_copy' }, x, y, gone: false, move: null, mv: { ...a.mv!, lines: [...a.mv!.lines], handlers: new Map(a.mv!.handlers) } }); };
  answer(w, get('plump'), 'stamp', 3);
  const copy = w.actors.find((a) => a.def.id === 'plump_copy');
  ok(!!copy && copy.x === 2 && copy.y === 3, `stamping copies the lump in front of it: ${copy?.x},${copy?.y}`);
  w.px = 1; w.py = 4; answer(w, get('plump'), 'strike', 3);
  w.px = 2; w.py = 4; answer(w, copy!, 'strike', 1);
  w.px = 1; w.py = 2; answer(w, copy!, 'strike', 3);
  ok(keys[2][5] === 'filled' && keys[4][5] === 'filled', `the stamp room fills both holes: ${keys[2][5]} ${keys[4][5]}`);
}
{
  // The listening ring: listen to each young listener while it stands on its stone.
  const { w, get } = moverSim('ring', 5, 7);
  ok(!groupDone(w, 'ring'), 'the ring starts open-circled');
  for (const id of ['youngA', 'youngB']) {
    const a = get(id);
    let n = 0;
    while (!(w.keys[a.y][a.x] === 'plate' && !a.mv!.stopped) && n++ < 20) stepAll(w);
    answer(w, a, 'listen', 1);
  }
  ok(groupDone(w, 'ring'), 'listening on the stones stops both young listeners');
}

// ---------------------------------------------------------------- the Margin: every answer of Gloss's passes and scores what Gloss says

for (const p of PROBLEMS) {
  const r = runSheet(p, p.ref, () => true);
  ok(r.ok, `margin ${p.id}: reference fails (${r.why})`);
  const got = `lines ${r.lines} ink ${r.ink} steps ${r.steps}`;
  ok(r.lines === p.gloss.lines && r.ink === p.gloss.ink && r.steps === p.gloss.steps, `margin ${p.id}: gloss says lines ${p.gloss.lines} ink ${p.gloss.ink} steps ${p.gloss.steps}, reference scores ${got}`);
  ok(!runSheet(p, 'wait', () => true).ok, `margin ${p.id}: an empty sheet passes`);
}
{
  const dent = PROBLEMS.find((p) => p.id === 'dent')!;
  const plain = runSheet(dent, 'repeat 4:\n  strike foe\n  wait', () => true);
  ok(!plain.ok, `margin dent: striking without answering the caret passes (${plain.why})`);
}

console.log(`${passes} passed, ${fails} failed`);
if (fails) process.exitCode = 1;
