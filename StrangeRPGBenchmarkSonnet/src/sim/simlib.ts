import { Battle, type Unit } from '../core/battle';
import { scaledFoeLevel } from '../core/encounter';
import { runBattle, type Policy } from '../core/bots';
import {
  activeMembers, applyResult, autoEquip, buyGear, buyItem, fullHeal, gainXp, joinMember, member, memberStats, mechsFor, newGame, setupChapter, toUnit,
  type GameState,
} from '../core/party';
import { Rng } from '../core/rng';
import { CHAPTER_LEVEL, CHAR, CHARS } from '../data/characters';
import { BOSSES, BOSS_FIELD, buildFoe, CHAPTER_FIELDS, ENCOUNTERS, ENEMIES, FIELDS, foeGold, foeLevel, foeXp } from '../data/enemies';
import { GEAR, GEAR_BY_TIER, ITEMS } from '../data/items';

export const ENC_PER_CHAPTER = 11;
const PREF = ['wick', 'ajar', 'thistle', 'zug', 'kiln', 'route9', 'ampere', 'ledger', 'fennel', 'ash', 'tick', 'dusk', 'pocket'];

export function pickParty(s: GameState, ids?: string[]) {
  if (ids) { s.active = ids.filter((i) => s.roster.some((m) => m.id === i)).slice(0, 4); return; }
  const have = PREF.filter((id) => s.roster.some((m) => m.id === id));
  s.active = have.slice(0, 4);
}

export interface FightRecord {
  chapter: number;
  boss: boolean;
  foes: string[];
  win: boolean;
  rounds: number;
  hpLeft: number;
  minHp: number;
  low: boolean;
  mpSpent: number;
  mpFrac: number;
  items: number;
  ko: number;
  actions: Record<string, number>;
  dmgByChar: Record<string, number>;
  healByChar: Record<string, number>;
  xp: number;
  gold: number;
  openings: number;
  reactions: number;
  gasps: number;
  rewinds: number;
  ascends: number;
  limits: number;
  dusks: number;
  rebirths: number;
  partySize: number;
  startHpFrac: number;
}

export function fieldFor(ch: number, rng: Rng, boss: boolean): typeof FIELDS[string] | undefined {
  if (ch < 7) return undefined;
  if (boss) return FIELDS[BOSS_FIELD[ch] ?? 'none'];
  return FIELDS[rng.pick(CHAPTER_FIELDS[ch] ?? ['none'])];
}

export function buildParty(s: GameState): Unit[] {
  return activeMembers(s).map(toUnit);
}

export function fight(s: GameState, foeIds: string[], boss: boolean, policy: Policy, rng: Rng, pos = 0.5, opts: { noApply?: boolean } = {}): FightRecord {
  const ch = s.chapter;
  const foes = foeIds.map((id, i) => buildFoe(id, scaledFoeLevel(s, id, Math.min(1, pos + (boss ? 0.15 : 0) + i * 0.01), boss), ch));
  const party = buildParty(s);
  const inv = { ...s.inv };
  const b = new Battle({ party, foes, inv, mech: mechsFor(ch), field: fieldFor(ch, rng, boss), seed: rng.int(1e9) + 1, boss });
  const hp0 = party.reduce((a, u) => a + u.hp, 0);
  const maxHp = party.reduce((a, u) => a + u.maxHp, 0);
  const mp0 = party.reduce((a, u) => a + u.mp, 0);
  const maxMp = party.reduce((a, u) => a + u.maxMp, 0);
  runBattle(b, policy, rng);
  const win = b.over === 'win';
  let xp = 0, gold = 0;
  for (const f of foes) { xp += foeXp(ENEMIES[f.defId!], f.lvl); gold += foeGold(ENEMIES[f.defId!], f.lvl); }
  const hpEnd = b.party.reduce((a, u) => a + Math.max(0, u.hp), 0);
  const dmgByChar: Record<string, number> = {};
  const healByChar: Record<string, number> = {};
  for (const u of b.party) { dmgByChar[u.id] = b.stats.dmgBy[u.uid] ?? 0; healByChar[u.id] = b.stats.healBy[u.uid] ?? 0; }
  if (!opts.noApply) {
    if (win) applyResult(s, b, xp, gold); else applyResult(s, b, 0, 0);
  }
  const rounds = b.stats.partyTurns / Math.max(1, party.length);
  return {
    chapter: ch, boss, foes: foeIds, win, rounds, hpLeft: hpEnd / maxHp, minHp: b.stats.minHpFrac, low: b.stats.crossedLow,
    mpSpent: b.stats.mpSpent, mpFrac: maxMp ? b.stats.mpSpent / maxMp : 0, items: b.stats.itemsUsed, ko: b.stats.koCount, actions: b.stats.actions,
    dmgByChar, healByChar, xp: win ? xp : 0, gold: win ? gold : 0, openings: b.stats.openings, reactions: b.stats.reactions, gasps: b.stats.gasps,
    rewinds: b.stats.rewinds, ascends: b.stats.ascends, limits: b.stats.limits, dusks: b.stats.dusks, rebirths: b.stats.rebirths, partySize: party.length,
    startHpFrac: hp0 / maxHp + 0 * mp0,
  };
}

/** Out-of-battle upkeep a sensible player does between fights. */
export function upkeep(s: GameState) {
  for (const m of activeMembers(s)) {
    const st = memberStats(m);
    if (m.hp <= 0) m.hp = 1;
    for (const id of ['starwater', 'flask', 'jar', 'dew']) {
      while (m.hp < st.hp * 0.45 && (s.inv[id] ?? 0) > 0) { s.inv[id]--; m.hp = Math.min(st.hp, m.hp + (ITEMS[id].fx[0] as { n: number }).n); }
    }
    for (const id of ['ink3', 'ink2', 'ink']) {
      while (m.mp < st.mp * 0.2 && (s.inv[id] ?? 0) > 0 && st.mp > 30) { s.inv[id]--; m.mp = Math.min(st.mp, m.mp + (ITEMS[id].fx[0] as { n: number }).n); }
    }
  }
}

export function pickEncounter(ch: number, rng: Rng): string[] {
  return rng.weighted(ENCOUNTERS[ch], (e) => e.w).foes;
}

/** A player walks back to a crystal when the party is hurt or dry. */
export function needsRest(s: GameState): boolean {
  const act = activeMembers(s);
  const hp = act.reduce((a, m) => a + m.hp / memberStats(m).hp, 0) / act.length;
  const mp = act.reduce((a, m) => a + m.mp / Math.max(1, memberStats(m).mp), 0) / act.length;
  return hp < 0.55 || mp < 0.2 || act.some((m) => m.hp / memberStats(m).hp < 0.2);
}

export interface ChapterRun {
  rests: number;
  fights: FightRecord[];
  bossAttempts: number;
  bossWin: boolean;
  levelStart: number;
  levelEnd: number;
  goldGained: number;
}

export function avgLevel(s: GameState): number {
  const a = activeMembers(s);
  return a.reduce((x, m) => x + m.lvl, 0) / a.length;
}

/** Runs one chapter: random fights, a rest stop at the midpoint, then the boss with retries. */
export function runChapter(s: GameState, policy: Policy, rng: Rng, nEnc = ENC_PER_CHAPTER): ChapterRun {
  const ch = s.chapter;
  const newcomer = CHARS.find((c) => c.joinChapter === ch);
  const fights: FightRecord[] = [];
  const levelStart = avgLevel(s);
  const gold0 = s.gold;
  let rests = 0;
  for (let i = 0; i < nEnc; i++) {
    s.beat = Math.min(7, Math.floor((i / nEnc) * 8));
    if (newcomer && i === Math.floor(nEnc / 2)) { joinMember(s, newcomer.id); if (ch > 1) pickParty(s); }
    const f = fight(s, pickEncounter(ch, rng), false, policy, rng, i / Math.max(1, nEnc - 1));
    fights.push(f);
    if (!f.win) { fullHeal(s); rests++; }
    upkeep(s);
    if (needsRest(s)) { fullHeal(s); rests++; }
  }
  if (newcomer && !s.roster.some((m) => m.id === newcomer.id)) joinMember(s, newcomer.id);
  pickParty(s);
  fullHeal(s);
  s.beat = 5;
  let attempts = 0;
  let bossWin = true;
  for (const group of BOSSES[ch]) {
    let won = false;
    for (let a = 0; a < 6 && !won; a++) {
      attempts++;
      const f = fight(s, group, true, policy, rng, 0.85);
      fights.push(f);
      won = f.win;
      fullHeal(s);
    }
    if (!won) bossWin = false;
  }
  return { rests, fights, bossAttempts: attempts, bossWin, levelStart, levelEnd: avgLevel(s), goldGained: s.gold - gold0 };
}

/** Buys the best gear the party can afford, then restocks potions. */
export function shop(s: GameState, ch: number) {
  for (const t of [ch, ch - 1]) {
    if (t < 1) continue;
    for (const slot of [0, 1, 2]) buyGear(s, GEAR_BY_TIER[t - 1][slot].id);
  }
  autoEquip(s);
  const want: [string, number][] = ch >= 11 ? [['starwater', 4], ['ink3', 2], ['plume', 1]] : ch >= 8 ? [['flask', 4], ['ink2', 3], ['plume', 1]] : ch >= 4 ? [['jar', 4], ['ink', 3], ['feather', 2]] : [['dew', 4], ['ink', 2]];
  for (const [id, n] of want) while ((s.inv[id] ?? 0) < n && buyItem(s, id)) { /* buy to target */ }
}

export interface CampaignResult {
  gearTier: number[];
  chapters: ChapterRun[];
  levelsAtStart: number[];
}

/** Plays the whole game start to finish from a fresh save. */
export function campaign(policy: Policy, seed: number, nEnc = ENC_PER_CHAPTER): CampaignResult {
  const rng = new Rng(seed);
  const s = newGame(1);
  const out: CampaignResult = { chapters: [], levelsAtStart: [], gearTier: [] };
  for (let ch = 1; ch <= 12; ch++) {
    s.chapter = ch;
    if (ch === 1) { joinMember(s, 'pocket'); }
    pickParty(s);
    out.levelsAtStart.push(avgLevel(s));
    { const eq = activeMembers(s).flatMap((m) => [m.weapon, m.armor, m.charm]).map((g) => (g ? GEAR[g].tier : 0)); out.gearTier.push(eq.reduce((a, b) => a + b, 0) / eq.length); }
    const run = runChapter(s, policy, rng, nEnc);
    out.chapters.push(run);
    shop(s, ch + 1 <= 12 ? ch + 1 : ch);
    fullHeal(s);
  }
  return out;
}

export const REG_BONUS = 1;
export const BOSS_BONUS = 2;

/** Plays the campaign up to the start of a chapter and returns the save state at that point. */
export function campaignState(policy: Policy, seed: number, upTo: number): GameState {
  const rng = new Rng(seed);
  const s = newGame(1);
  for (let ch = 1; ch < upTo; ch++) {
    s.chapter = ch;
    if (ch === 1) joinMember(s, 'pocket');
    pickParty(s);
    runChapter(s, policy, rng);
    shop(s, ch + 1 <= 12 ? ch + 1 : ch);
    fullHeal(s);
  }
  s.chapter = upTo;
  const nc = CHARS.find((c) => c.joinChapter === upTo);
  void nc;
  pickParty(s);
  return s;
}

/** A state set up at a chapter's expected level (plus a bonus for how far into the chapter the fight happens). */
export function chapterState(ch: number, ids?: string[], bonus = 0): GameState {
  const s = newGame(1);
  setupChapter(s, ch);
  const nc = CHARS.find((c) => c.joinChapter === ch && c.id !== 'wick');
  if (nc) joinMember(s, nc.id, CHAPTER_LEVEL[ch]);
  pickParty(s, ids);
  autoEquip(s);
  if (bonus) for (const m of s.roster) m.lvl = Math.max(1, m.lvl + bonus);
  fullHeal(s);
  return s;
}

export { CHAR, CHARS, member, gainXp };

/** Wick plus three random partymates who have joined by the chapter. */
export function randomParty(ch: number, rng: Rng): string[] {
  const pool = CHARS.filter((c) => c.joinChapter <= ch && c.id !== 'wick').map((c) => c.id);
  const ids = ['wick'];
  while (ids.length < 4 && pool.length) ids.push(pool.splice(rng.int(pool.length), 1)[0]);
  return ids;
}
