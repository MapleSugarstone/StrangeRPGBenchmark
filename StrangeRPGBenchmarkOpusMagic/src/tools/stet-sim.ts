// Stet rules checks and AI-against-AI balance runs.
// Build: npx esbuild src/tools/stet-sim.ts --bundle --platform=node --format=esm --loader:.txt=text --outfile=dist-tools/stet-sim.js
// Run: node dist-tools/stet-sim.js [games] [section]
import { AiOpts, Level, chooseMove } from '../game/stet/ai';
import { CARDS, CARD_IDS, WORDS, WORD_IDS, Word, cardTotal, cardWorth, rebuildEdges, shapeEdges } from '../game/stet/cards';
import { OPPONENTS, OPPONENT_IDS, available } from '../game/stet/opponents';
import { HandCard, Match, RULES, RuleId, Side, TUNE, legalMoves, newMatch, outcome, over, play, rng, score, toMove } from '../game/stet/rules';
import { hasSprite } from '../engine/sprites';
import '../engine/sprites16';
import '../engine/sprites2';
import { STOCK, forfeit, giveStarter, grant, status, winnable } from '../game/stet/collection';
import type { StetSave } from '../game/state';

const args = process.argv.slice(2);
const GAMES = Number(args[0]) || 200;
const ONLY = args[1] ?? 'all';
let RFILTER = '';
let WFILTER: string[] = [];
let OFILTER: string[] = [];
for (const a of args.slice(2)) {
  const [k, v] = a.split('=');
  if (k === 'r') RFILTER = v;
  if (k === 'w') WFILTER = v.split(',');
  if (k === 'o') OFILTER = v.split(',');
  if (k.startsWith('c.') && k.slice(2) in WORDS) { WORDS[k.slice(2) as Word].cost = Number(v); rebuildEdges(); }
  if (k in TUNE) (TUNE as Record<string, number>)[k] = Number(v);
}
const want = (s: string) => ONLY === 'all' || ONLY === s;

let fails = 0, passes = 0;
function ok(cond: unknown, what: string) {
  if (cond) passes++;
  else { fails++; console.log(`FAIL: ${what}`); }
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
const pad = (s: string | number, n: number) => String(s).padEnd(n);

// ---------------------------------------------------------------- rules checks

function hc(e: number[], word: Word | null = null, id = 'straw'): HandCard { return { id, e, word }; }

/** A match with chosen hands. Side 0 moves first. */
function setup(rules: RuleId[], h0: HandCard[], h1: HandCard[]): Match {
  const m = newMatch([['straw'], ['straw']], rules, 0);
  m.hands = [h0, h1];
  return m;
}

function at(m: Match, cell: number, h = 0, target = -1) { play(m, { h, cell, target }); }

const F = [1, 1, 1, 1];
function fill(n: number) { return Array.from({ length: n }, () => hc(F)); }

function rulesChecks() {
  const keep = TUNE.opening;
  TUNE.opening = 0;
  let m = setup(['plain'], [hc([5, 5, 5, 5]), ...fill(4)], [hc([1, 1, 1, 6]), ...fill(4)]);
  at(m, 4); at(m, 5);
  ok(m.board[4]!.side === 1, 'a higher edge flips');

  m = setup(['plain'], [hc([5, 5, 5, 5]), ...fill(4)], [hc([1, 1, 1, 5]), ...fill(4)]);
  at(m, 4); at(m, 5);
  ok(m.board[4]!.side === 0, 'an equal edge does not flip');

  m = setup(['plain'], [hc([5, 5, 5, 5], 'soak'), ...fill(4)], [hc([1, 1, 1, 5]), ...fill(4)]);
  at(m, 4); at(m, 5);
  ok(m.board[5]!.side === 1 && m.board[4]!.side === 0, 'soak lowers the edge that faces it');
  m = setup(['plain'], [fill(1)[0], hc([5, 5, 5, 5], 'soak'), ...fill(3)], [hc([1, 1, 1, 5]), ...fill(4)]);
  at(m, 0); at(m, 5); at(m, 4, 0);
  ok(m.board[5]!.side === 0, 'soak flips an equal edge when placed');

  m = setup(['plain'], [hc([5, 5, 5, 5]), ...fill(4)], [hc([1, 1, 1, 5], 'strike'), ...fill(4)]);
  at(m, 4); at(m, 5);
  ok(m.board[4]!.side === 1, 'strike adds 1 when placed');

  m = setup(['plain'], [hc([1, 1, 1, 1], 'ward'), ...fill(4)], [hc([1, 1, 1, 9]), hc([1, 9, 1, 1]), hc([1, 1, 9, 1]), ...fill(2)]);
  at(m, 4); at(m, 5, 0);
  ok(m.board[4]!.side === 0, 'ward stops a flip on the next turn');
  at(m, 0, 0); at(m, 3, 0);
  ok(m.board[4]!.side === 1, 'ward ends after one turn');

  m = setup(['plain'], [hc([1, 1, 1, 1]), hc([1, 9, 1, 1]), ...fill(3)], [hc([1, 1, 1, 9], 'halt'), ...fill(4)]);
  at(m, 4); at(m, 5, 0, 4);
  ok(m.board[4]!.side === 1 && m.board[4]!.halted, 'halt targets a card after the flips');
  at(m, 3, 0);
  ok(m.board[4]!.side === 1, 'a halted card does not flip');

  m = setup(['plain'], [hc([9, 1, 1, 1]), ...fill(4)], [hc([2, 2, 2, 1], 'copy'), ...fill(4)]);
  at(m, 4); at(m, 5, 0, 4);
  ok(m.board[5]!.e[3] === 9 && m.board[4]!.side === 1, 'copy raises the lowest edge before flipping');

  m = setup(['plain'], [hc([3, 3, 3, 3]), hc([1, 1, 1, 1], 'mend'), ...fill(3)], fill(5));
  at(m, 4); at(m, 0); at(m, 5, 0);
  ok(m.board[4]!.e.join() === '4,4,4,4', 'mend raises adjacent friendly edges');

  m = setup(['plain'], [fill(1)[0], fill(1)[0], hc([5, 1, 1, 5], 'each'), ...fill(2)], [hc([1, 1, 1, 1]), hc([1, 1, 1, 1]), hc([9, 9, 9, 9]), ...fill(2)]);
  at(m, 0); at(m, 1, 0); at(m, 2); at(m, 3, 0); at(m, 6, 1); at(m, 5, 0);
  at(m, 4, 0);
  ok(m.board[1]!.side === 0 && m.board[3]!.side === 0 && m.board[5]!.side === 0, 'each takes one more after two flips');

  m = setup(['plain'], [hc([9, 9, 9, 9], 'when'), ...fill(4)], fill(5));
  for (let c = 0; c < 9; c++) at(m, c, 0);
  const sc = score(m);
  ok(sc[0] === 6 && sc[1] === 5, `when counts twice at the end (${sc})`);
  m = setup(['plain'], [hc([1, 1, 1, 1], 'when'), ...fill(4)], [hc([1, 1, 1, 9]), ...fill(4)]);
  at(m, 4); at(m, 5);
  for (const c of [0, 1, 2, 3, 6, 7, 8]) at(m, c, 0);
  ok(score(m)[1] === 7, `a flipped when counts twice for the side that has it (${score(m)})`);

  m = setup(['plain'], [hc([2, 2, 2, 2], 'wait'), ...fill(4)], fill(5));
  at(m, 4); ok(m.board[4]!.e[0] === 2, 'wait has not risen yet');
  at(m, 0); ok(m.board[4]!.e[0] === 3, 'wait rises after one full turn');

  m = setup(['plain'], [hc([1, 1, 1, 1], 'again'), ...fill(4)], [hc([1, 1, 1, 9]), ...fill(4)]);
  at(m, 4); at(m, 5);
  ok(m.board[4]!.side === 0 && m.board[4]!.again === 2, 'again flips back at the start of its side\'s turn');

  m = setup(['still'], [hc([1, 1, 1, 1]), ...fill(4)], [hc([1, 1, 1, 9]), hc([1, 9, 1, 1]), ...fill(3)]);
  at(m, 4); at(m, 5);
  ok(m.board[4]!.side === 0, 'still protects a card on the next turn');
  at(m, 0); at(m, 3, 0);
  ok(m.board[4]!.side === 1, 'still ends after one turn');
  m = setup(['still'], fill(5), [...fill(3), hc([9, 9, 9, 9]), hc([1, 1, 1, 1])]);
  for (let c = 0; c < 7; c++) at(m, c, 0);
  at(m, 8, 0); at(m, 7, 0);
  ok(m.board[8]!.side === 1, 'still does not protect a card from the last turn');

  m = setup(['twin'], [fill(1)[0], fill(1)[0], hc([4, 1, 1, 6]), ...fill(2)], [hc([1, 1, 4, 1]), hc([1, 6, 1, 1]), ...fill(3)]);
  at(m, 8); at(m, 1, 0); at(m, 7); at(m, 3, 0); at(m, 4, 0);
  ok(m.board[1]!.side === 0 && m.board[3]!.side === 0, 'twin flips two equal edges');
  m = setup(['plain'], [fill(1)[0], fill(1)[0], hc([4, 1, 1, 6]), ...fill(2)], [hc([1, 1, 4, 1]), hc([1, 6, 1, 1]), ...fill(3)]);
  at(m, 8); at(m, 1, 0); at(m, 7); at(m, 3, 0); at(m, 4, 0);
  ok(m.board[1]!.side === 1 && m.board[3]!.side === 1, 'equal edges do nothing without twin');

  m = setup(['fall'], [hc([5, 5, 5, 5]), hc([1, 1, 1, 1]), ...fill(3)], [hc([3, 3, 3, 3]), ...fill(4)]);
  at(m, 4); ok(m.board[4]!.e[0] === 5, 'fall waits for your next turn');
  at(m, 0); ok(m.board[4]!.e[0] === 4 && m.board[0]!.e[0] === 3, 'fall lowers your cards at the start of your turn');
  at(m, 8); ok(m.board[0]!.e[0] === 2 && m.board[8]!.e[0] === 1, 'fall lowers the other side on its turn, never below 1');

  m = setup(['copied'], [hc([1, 1, 1, 1]), ...fill(4)], [hc([9, 8, 7, 6], 'strike', 'grind'), ...fill(4)]);
  at(m, 4); at(m, 5);
  ok(m.board[4]!.id === 'grind' && m.board[4]!.e.join() === '9,8,7,6' && m.board[4]!.side === 1, 'copied turns a flipped card into the flipper');

  m = setup(['plain'], fill(5), fill(5));
  for (let c = 0; c < 9; c++) at(m, c, 0);
  const s2 = score(m);
  ok(s2[0] === 5 && s2[1] === 5 && m.hands[1].length === 1, `the card left in hand counts (${s2})`);

  TUNE.opening = keep;
  const nine = () => hc([9, 9, 9, 9]);
  m = setup(['plain'], fill(5), [nine(), nine(), nine(), ...fill(2)]);
  at(m, 4); at(m, 5); at(m, 0); at(m, 3);
  ok(m.opening === 2 && m.board[4]!.side === 0, 'the first card cannot be flipped for two turns');
  at(m, 8); at(m, 1);
  ok(m.board[4]!.side === 1, 'the first card can be flipped on the third turn');
  ok(newMatch([[], []], ['open', 'fall'], 0).opening === 2 && newMatch([[], []], ['fall'], 0).opening === 1, 'the opening comes from the rules');

  // Random full games never break the rules.
  const r = rng(7);
  for (let g = 0; g < 300; g++) {
    const rules = RULESETS[g % RULESETS.length];
    const mm = newMatch([randomDeck(r), randomDeck(r)], rules, (g % 2) as Side);
    let steps = 0;
    while (!over(mm) && steps < 20) {
      const mv = legalMoves(mm);
      play(mm, mv[Math.floor(r() * mv.length)]);
      steps++;
    }
    const [a, b] = score(mm);
    const whens = mm.board.filter((p) => p && p.word === 'when').length;
    ok(steps === 9 && mm.board.every((p) => p) && a + b === 10 + whens, `random game ${g} ends cleanly`);
    for (const p of mm.board) ok(p!.e.every((v) => v >= 1 && v <= 9), 'edges stay between 1 and 9');
  }
}

// ---------------------------------------------------------------- content checks

const BANNED = [/—/, /–/, /;/, /whisper/i, /shimmer/i, /tapestry/i, /journey/i, /destiny/i, /ancient/i];

function textOk(s: string, what: string) {
  ok(s.length > 0 && s.length < 90, `${what} is 1 to 89 characters: "${s}"`);
  for (const b of BANNED) ok(!b.test(s), `${what} avoids ${b}: "${s}"`);
}

function contentChecks() {
  ok(CARD_IDS.length >= 35 && CARD_IDS.length <= 80, `35 to 80 cards (${CARD_IDS.length})`);
  for (const id of CARD_IDS) {
    const c = CARDS[id];
    ok(c.edges.length === 4 && c.edges.every((v) => v >= 1 && v <= 9), `${id} edges 1 to 9`);
    ok(c.edges.reduce((a, b) => a + b, 0) === cardTotal(c.tier, c.word), `${id} edge total fits its tier`);
    ok(c.art === 'scrivener' || hasSprite(c.art), `${id} has art (${c.art})`);
    textOk(c.flavor, `${id} flavor`);
    ok(c.tier >= 1 && c.tier <= 5, `${id} tier`);
  }
  for (const w of WORD_IDS) textOk(WORDS[w].text, `word ${w}`);
  for (const r of Object.values(RULES)) textOk(r.text, `rule ${r.id}`);
  for (const id of OPPONENT_IDS) {
    const o = OPPONENTS[id];
    ok(o.deck.length === 5 && o.deck.every((c) => CARDS[c]), `${id} deck is five real cards`);
    ok(o.rules.every((r) => RULES[r]), `${id} rules exist`);
    ok(hasSprite(o.art) || o.art === 'scrivener', `${id} art`);
    for (const k of ['intro', 'win', 'lose', 'draw'] as const) textOk(o[k], `${id} ${k}`);
    for (const l of o.lesson ?? []) textOk(l, `${id} lesson`);
    ok(o.deck.includes(id) || !CARDS[id], `${id} plays its own card`);
  }
  // Every card can be found: a foe's page, a deck, the starter set, or a companion.
  const companions = ['halt', 'each', 'when', 'wait', 'room', 'every'];
  for (const id of CARD_IDS) {
    const found = CARDS[id].foe || companions.includes(id) || STOCK.some((x) => x.id === id) || OPPONENT_IDS.some((o) => OPPONENTS[o].deck.includes(id));
    ok(found, `${id} can be found somewhere`);
  }
  const st: StetSave = { cards: {}, deck: [], beaten: [], wins: 0, losses: 0, draws: 0 };
  giveStarter(st);
  ok(st.deck.length === 5, 'the starter deck has five cards');
  ok(grant(st, 'once') === 1 && grant(st, 'once') === 0, 'a secret card is owned once at most');
  ok(forfeit(st, ['wait', 'nip']) === null, 'the opponent never takes a last copy');
  grant(st, 'nip');
  ok(forfeit(st, ['wait', 'nip']) === 'nip', 'the opponent takes a spare copy');
  ok(!winnable(st, ['once', 'nip']).includes('once'), 'a secret card already owned cannot be won again');
  ok(status(st).total === CARD_IDS.length, 'status counts every card');
  ok(available(1, 'busy', []).join() === 'count,stack', `Busy in chapter 1 (${available(1, 'busy', [])})`);
  ok(!available(6, 'busy', []).includes('scrivener'), 'the Scrivener stays hidden');
  ok(available(6, 'nursery', OPPONENT_IDS).includes('scrivener'), 'the Scrivener plays after everyone is beaten');
}

// ---------------------------------------------------------------- simulation helpers

const RULESETS: RuleId[][] = [['plain'], ['still'], ['twin'], ['open'], ['fall'], ['copied']];
const COMBOS: RuleId[][] = [['open', 'fall'], ['twin', 'copied']];
const POOL = CARD_IDS.filter((id) => !CARDS[id].secret);

function randomDeck(r: () => number, pool = POOL): string[] {
  return Array.from({ length: 5 }, () => pool[Math.floor(r() * pool.length)]);
}

const tierSum = (d: string[]) => d.reduce((a, id) => a + CARDS[id].tier, 0);

/** Two random decks with the same total tier. */
function matchedDecks(r: () => number): [string[], string[]] {
  const a = randomDeck(r);
  for (;;) {
    const b = randomDeck(r);
    if (tierSum(b) === tierSum(a)) return [a, b];
  }
}

/** Plays one game. Returns 1 if side 0 wins, -1 if side 1 wins, 0 for a draw. */
function game(decks: [string[], string[]], rules: RuleId[], first: Side, ai: [AiOpts, AiOpts], seed: number, times?: number[]): number {
  const m = newMatch(decks, rules, first);
  const r = rng(seed);
  while (!over(m)) {
    const s = toMove(m);
    const t0 = performance.now();
    const mv = chooseMove(m, { ...ai[s], rand: r });
    if (times) times.push(performance.now() - t0);
    play(m, mv);
  }
  return outcome(m);
}

const AI: Record<string, AiOpts> = {
  easy: { level: 'easy', slip: 0.3 },
  medium: { level: 'medium' },
  hard: { level: 'hard' },
  sim: { level: 'hard', nodes: 2500 },
};

// ---------------------------------------------------------------- sections

function timing() {
  console.log('\nAI time per move, hard, worst positions (first two moves)');
  const r = rng(11);
  const times: number[] = [];
  for (let g = 0; g < 30; g++) {
    const rules = RULESETS[g % RULESETS.length];
    const m = newMatch([randomDeck(r), randomDeck(r)], rules, 0);
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      const mv = chooseMove(m, { level: 'hard', rand: r });
      times.push(performance.now() - t0);
      play(m, mv);
    }
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`  mean ${mean.toFixed(1)} ms, median ${times[times.length >> 1].toFixed(1)} ms, max ${times[times.length - 1].toFixed(1)} ms`);
  ok(times[Math.floor(times.length * 0.9)] < 30, 'hard AI moves in under 30 ms (90th percentile)');
}

function firstPlayer() {
  console.log(`\nFirst-player advantage, ${GAMES} deck pairs per rule, each played with both sides first (hard vs hard)`);
  console.log(`  ${pad('rule', 12)} ${pad('first', 8)} ${pad('second', 8)} draw`);
  let tf = 0, ts = 0, td = 0;
  for (const rules of [...RULESETS, ...COMBOS]) {
    if (RFILTER && !rules.includes(RFILTER as RuleId)) continue;
    const r = rng(101);
    let f = 0, s = 0, d = 0;
    for (let g = 0; g < GAMES; g++) {
      const decks = matchedDecks(r);
      for (const first of [0, 1] as Side[]) {
        const o = game(decks, rules, first, [AI.sim, AI.sim], g * 2 + first);
        const firstWon = first === 0 ? o === 1 : o === -1;
        if (o === 0) d++;
        else if (firstWon) f++;
        else s++;
      }
    }
    tf += f; ts += s; td += d;
    console.log(`  ${pad(rules.join('+'), 12)} ${pad(pct(f, 2 * GAMES), 8)} ${pad(pct(s, 2 * GAMES), 8)} ${pct(d, 2 * GAMES)}`);
  }
  const n = tf + ts + td;
  console.log(`  ${pad('all', 12)} ${pad(pct(tf, n), 8)} ${pad(pct(ts, n), 8)} ${pct(td, n)}`);
  ok(Math.abs(tf - ts) / n < 0.08, 'first-player advantage under 8 points');
}

function difficulty() {
  console.log(`\nDifficulty, ${GAMES} deck pairs, all rules, every game played four ways`);
  const pairs: [string, string][] = [['medium', 'easy'], ['hard', 'easy'], ['hard', 'medium']];
  for (const [hi, lo] of pairs) {
    const r = rng(202);
    let w = 0, l = 0, d = 0;
    for (let g = 0; g < GAMES; g++) {
      const decks = matchedDecks(r);
      const rules = RULESETS[g % RULESETS.length];
      for (const first of [0, 1] as Side[]) {
        for (const swap of [false, true]) {
          const dd: [string[], string[]] = swap ? [decks[1], decks[0]] : decks;
          const o = game(dd, rules, first, [AI[hi === 'hard' ? 'hard' : hi], AI[lo]], g * 4 + first * 2 + (swap ? 1 : 0));
          if (o === 1) w++; else if (o === -1) l++; else d++;
        }
      }
    }
    const n = w + l + d;
    console.log(`  ${pad(hi, 7)} vs ${pad(lo, 7)} wins ${pad(pct(w, n), 7)} draws ${pad(pct(d, n), 7)} losses ${pct(l, n)}`);
  }
}

/** One word card against a vanilla card of the same shape and tier, in otherwise equal decks. */
function wordDuel() {
  console.log(`\nWord against its cost: a deck with one word card against the same deck with a plain card (${GAMES} pairs each)`);
  console.log(`  ${pad('word', 7)} ${pad('cost', 5)} ${pad('plain', 7)} ${pad('regional', 9)} all rules`);
  const r = rng(303);
  const shapes = () => [1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3)];
  const results: Record<string, number> = {};
  for (const w of WORD_IDS) {
    if (WFILTER.length && !WFILTER.includes(w)) continue;
    const tally = (rulesList: RuleId[][]) => {
      let won = 0, n = 0;
      for (let g = 0; g < GAMES; g++) {
        const rules = rulesList[g % rulesList.length];
        const tier = 2 + (g % 3);
        const base: HandCard[] = Array.from({ length: 4 }, () => ({ id: 'straw', e: shapeEdges(shapes(), cardTotal(tier, null)), word: null }));
        const sh = shapes();
        const wc: HandCard = { id: 'grind', e: shapeEdges(sh, cardTotal(tier, w)), word: w };
        const vc: HandCard = { id: 'grind', e: shapeEdges(sh, cardTotal(tier, null)), word: null };
        for (const first of [0, 1] as Side[]) {
          const m = newMatch([['straw'], ['straw']], rules, first);
          m.hands = [[wc, ...base], [vc, ...base]];
          const rr = rng(g * 2 + first + 1);
          while (!over(m)) play(m, chooseMove(m, { ...AI.sim, rand: rr }));
          const o = outcome(m);
          won += o === 1 ? 1 : o === 0 ? 0.5 : 0;
          n++;
        }
      }
      return won / n;
    };
    const plain = tally([['plain']]);
    const regional = tally([['still'], ['twin'], ['fall'], ['copied']]);
    results[w] = (plain + regional * 4) / 5;
    console.log(`  ${pad(w, 7)} ${pad(WORDS[w].cost, 5)} ${pad(pct(plain, 1), 7)} ${pad(pct(regional, 1), 9)} ${pct(results[w], 1)}`);
  }
  for (const w of Object.keys(results) as Word[]) ok(results[w] > 0.4 && results[w] < 0.6, `${w} is worth about its cost (${pct(results[w], 1)})`);
}

/** Random tier-matched decks from the real cards: how often each word and card is in the winning hand. */
function winningHands() {
  const N = GAMES * 3;
  console.log(`\nWords and cards in winning hands, ${N} games of tier-matched random decks, all rules (hard vs hard)`);
  const r = rng(404);
  const wordWin: Record<string, number> = {}, wordAll: Record<string, number> = {};
  const cardWin: Record<string, number> = {}, cardAll: Record<string, number> = {};
  let decided = 0;
  for (let g = 0; g < N; g++) {
    const decks = matchedDecks(r);
    const rules = RULESETS[g % RULESETS.length];
    const o = game(decks, rules, (g % 2) as Side, [AI.sim, AI.sim], g);
    if (o !== 0) decided++;
    for (const [deck, won] of [[decks[0], (o + 1) / 2], [decks[1], (1 - o) / 2]] as [string[], number][]) {
      for (const id of new Set(deck)) {
        const w = CARDS[id].word ?? 'none';
        wordAll[w] = (wordAll[w] ?? 0) + 1;
        wordWin[w] = (wordWin[w] ?? 0) + won;
        cardAll[id] = (cardAll[id] ?? 0) + 1;
        cardWin[id] = (cardWin[id] ?? 0) + won;
      }
    }
  }
  console.log(`  ${decided} of ${N} games decided. Score of the hands holding each word (win 1, draw 0.5):`);
  for (const w of [...WORD_IDS, 'none']) console.log(`  ${pad(w, 7)} ${pad(pct(wordWin[w] ?? 0, wordAll[w] ?? 0), 7)} (${wordAll[w] ?? 0} hands)`);
  for (const w of WORD_IDS) {
    const share = (wordWin[w] ?? 0) / Math.max(1, wordAll[w] ?? 0);
    ok(share < 0.6, `${w} is not a must-pick (${pct(wordWin[w] ?? 0, wordAll[w] ?? 0)})`);
  }
  const cards = Object.keys(cardAll).filter((id) => cardAll[id] >= 20).sort((a, b) => cardWin[b] / cardAll[b] - cardWin[a] / cardAll[a]);
  console.log('  Cards most often in the winning hand (at least 20 hands):');
  for (const id of cards.slice(0, 6)) console.log(`    ${pad(id, 10)} t${CARDS[id].tier} ${pad(CARDS[id].word ?? '-', 7)} ${pct(cardWin[id], cardAll[id])}`);
  console.log('  Least often:');
  for (const id of cards.slice(-4)) console.log(`    ${pad(id, 10)} t${CARDS[id].tier} ${pad(CARDS[id].word ?? '-', 7)} ${pct(cardWin[id], cardAll[id])}`);
  if (ONLY === 'cards') for (const id of cards) console.log(`    ${pad(id, 10)} t${CARDS[id].tier} ${pad(CARDS[id].word ?? '-', 7)} ${pad(CARDS[id].edges.join(' '), 9)} ${pct(cardWin[id], cardAll[id])} (${cardAll[id]})`);
  for (const id of cards) ok(Math.abs(cardWin[id] / cardAll[id] - 0.5) < 0.1 || cardAll[id] < 200, `${id} is within 10 points of even (${pct(cardWin[id], cardAll[id])})`);
}

/** Cards a player plausibly owns when meeting an opponent: earlier chapters, plus low tiers of this one. */
function playerPool(o: { id: string; chapter: number }): string[] {
  if (o.id === 'scrivener') return CARD_IDS.filter((id) => !CARDS[id].secret || id === 'gloss' || id === 'again');
  return CARD_IDS.filter((id) => !CARDS[id].secret && (CARDS[id].ch < o.chapter || (CARDS[id].ch === o.chapter && CARDS[id].tier <= 2)));
}

/** A deck from the ten strongest cards in the pool, at random. */
function playerDeck(pool: string[], r: () => number): string[] {
  const top = pool.slice().sort((a, b) => cardWorth(b) - cardWorth(a)).slice(0, 10);
  return Array.from({ length: 5 }, () => top[Math.floor(r() * top.length)]);
}

/** Score a player AI earns against each opponent: a win counts 1 and a draw counts half. */
const TARGET: Record<string, number> = { count: 0.8, stack: 0.72, reel: 0.66, tally: 0.62, weigh: 0.6, presshand: 0.58, many: 0.56, listener: 0.56, heed: 0.52, keep: 0.5, sweep: 0.5, gloss: 0.42, scrivener: 0.38 };

function ladder() {
  console.log(`\nThe ladder: a player with a random strong deck for the chapter against each opponent (${GAMES} games each)`);
  console.log(`  ${pad('opponent', 13)} ${pad('ch', 3)} ${pad('rules', 12)} ${pad('ai', 7)} ${pad('easy', 14)} ${pad('medium', 14)} ${pad('hard', 14)} target`);
  for (const id of OPPONENT_IDS) {
    if (OFILTER.length && !OFILTER.includes(id)) continue;
    const o = OPPONENTS[id];
    const pool = playerPool(o);
    const row: string[] = [];
    let mediumScore = 0;
    for (const lv of ['easy', 'medium', 'hard'] as Level[]) {
      let w = 0, d = 0;
      const n = lv === 'hard' ? Math.ceil(GAMES / 3) : GAMES;
      const r = rng(9000 + id.length);
      for (let g = 0; g < n; g++) {
        const first = (g % 2) as Side;
        const res = game([playerDeck(pool, r), o.deck], o.rules, first, [AI[lv], { level: o.level, slip: o.slip, nodes: o.nodes }], 5000 + g);
        if (res === 1) w++; else if (res === 0) d++;
      }
      const sc = (w + d / 2) / n;
      if (lv === 'medium') mediumScore = sc;
      row.push(`${pct(w + d / 2, n)} (${pct(w, n)})`);
    }
    const t = TARGET[id] ?? 0.5;
    console.log(`  ${pad(o.name, 13)} ${pad(o.chapter, 3)} ${pad(o.rules.join('+'), 12)} ${pad(o.level, 7)} ${pad(row[0], 14)} ${pad(row[1], 14)} ${pad(row[2], 14)} ${pct(t, 1)}`);
    ok(Math.abs(mediumScore - t) < 0.12, `${id} is near its target for a medium player (${pct(mediumScore, 1)} against ${pct(t, 1)})`);
  }
  console.log('  (each cell: score with draws as half, then outright wins)');
}

rulesChecks();
contentChecks();
if (want('time')) timing();
if (want('first')) firstPlayer();
if (want('diff')) difficulty();
if (want('words')) wordDuel();
if (want('hands') || ONLY === 'cards') winningHands();
if (want('ladder')) ladder();

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exitCode = 1;
