// Validates every track and jingle in the shipped src/music.js without audio. Notes/music.md lists the checks.
// Usage: node tools/check-music.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(root, 'src', 'music.js');

const RANGE = {
  lead: [45, 90], cold: [45, 96], bell: [48, 100], glass: [55, 104], arp: [48, 96], blip: [60, 100], bass: [28, 58], sub: [24, 52],
  drone: [28, 52], pad: [45, 86], brass: [40, 86], choir: [48, 84], nz: [0, 127],
};
const SECONDS = 600;
const SEEDS = [7, 1, 2024];
/** The most notes sounding at one instant, which bounds the cost of a section in real time. */
const MAX_AT_ONCE = 16;
/** The most notes per second over any section. The puzzles are quiet, so no section may get busy. */
const MAX_RATE = 5;
/** The boss fight is the one track allowed to drive, with every layer counted. */
const RATE_CAP = { boss: 8, postboss: 8, final: 10 };
/** Leitmotifs each track must quote within ten minutes. */
const MOTIFS = {
  title: ['tilde'], area0: ['pilcrow'], area1: ['pilcrow'], area2: ['pilcrow', 'tilde'], area3: ['pilcrow', 'tilde'],
  area4: ['pilcrow'], area5: ['pilcrow'], area6: ['pilcrow'], area7: ['pilcrow', 'tilde'], area8: ['pilcrow', 'tilde'],
  area9: ['pilcrow', 'tilde', 'hiscore'], area10: ['pilcrow', 'tilde'], area11: ['pilcrow', 'tilde'], area12: ['pilcrow', 'tilde', 'alarm'],
  area13: ['pilcrow', 'tilde'], area14: ['pilcrow', 'tilde'], boss: ['pilcrow', 'sale'], postboss: ['pilcrow', 'sale'],
  area15: ['pilcrow', 'tilde'], area16: ['pilcrow', 'tilde'], final: ['pilcrow', 'static', 'tilde'], ending: ['pilcrow', 'tilde'],
};
/** Allowed length of each jingle in seconds, from its first note to the end of its last. */
const JINGLE_SECS = { clear: [1.6, 2.6], lose: [0.7, 1.4] };

let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`); };

/** The most notes sounding at one instant. */
function atOnce(notes, start = (n) => n.at, len = (n) => n.dur) {
  const edges = [];
  for (const n of notes) { edges.push([start(n), 1]); edges.push([start(n) + len(n), -1]); }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, max = 0;
  for (const [, d] of edges) { cur += d; max = Math.max(max, cur); }
  return max;
}

/** True when a note plays at this intensity, the same filter the scheduler applies. */
const audible = (n, level) => (n.lay ?? 0) <= level && (n.top === undefined || level < n.top);

function checkNote(where, n, reported) {
  const r = RANGE[n.v];
  if (!r) { fail(`${where}: unknown voice ${n.v}`); return; }
  const key = `${n.v}:${n.n}`;
  if ((n.n < r[0] || n.n > r[1]) && !reported.has(key)) { reported.add(key); fail(`${where}: ${n.v} note ${n.n} is outside ${r[0]} to ${r[1]}`); }
  if (!(n.g > 0 && n.g <= 1)) fail(`${where}: ${n.v} gain ${n.g} is outside 0 to 1`);
}

// ---------------------------------------------------------------- the bundle

console.log('Bundle');
const built = fs.statSync(bundle).mtimeMs;
for (const f of fs.readdirSync(path.join(root, 'audio'))) {
  if (fs.statSync(path.join(root, 'audio', f)).mtimeMs > built) fail(`src/music.js is older than audio/${f}. Run node tools/build-music.mjs.`);
}
const sandbox = vm.createContext({ console });
vm.runInContext(fs.readFileSync(bundle, 'utf8'), sandbox, { filename: 'src/music.js' });
const Music = sandbox.Music;
if (!Music || !Music.offline) { console.log('  FAIL src/music.js did not define Music'); process.exit(1); }
console.log(`  loads without a window or an AudioContext. Music bus gain ${Music.offline.level}.`);

// ---------------------------------------------------------------- tracks

console.log(`\nTracks (${SECONDS} s each, seeds ${SEEDS.join(', ')}, intensity sweeping 0 to 1)`);
console.log('  track   sections  at once  notes/s  worst repeat  motifs');
for (const id of Music.offline.tracks) {
  let sections = 0, worstAt = 0, worstRate = 0, worstRepeat = '';
  const motifs = new Map();
  for (const seed of SEEDS) {
    const secs = Music.offline.render(id, SECONDS, { seed, intensity: (t) => (Math.sin(t / 40) + 1) / 2 });
    if (!secs.length) { fail(`${id} seed ${seed} renders nothing`); continue; }
    const last = secs[secs.length - 1];
    if (last.start + last.secs < SECONDS) fail(`${id} seed ${seed} ends after ${(last.start + last.secs).toFixed(0)} s instead of looping`);
    sections += secs.length;
    const seen = new Map();
    const reported = new Set();
    for (const s of secs) {
      for (const n of s.notes) {
        checkNote(`${id} seed ${seed} ${s.name}`, n, reported);
        if (n.mo) motifs.set(n.mo, (motifs.get(n.mo) ?? 0) + 1);
      }
      const sig = JSON.stringify(s.notes.map((n) => [n.v, n.n, Math.round((n.at - s.start) * 100)]));
      seen.set(sig, (seen.get(sig) ?? 0) + 1);
      const at = atOnce(s.notes);
      worstAt = Math.max(worstAt, at);
      if (at > MAX_AT_ONCE) fail(`${id} seed ${seed} ${s.name} has ${at} notes at once`);
      const rate = s.notes.length / s.secs;
      worstRate = Math.max(worstRate, rate);
      if (rate > (RATE_CAP[id] ?? MAX_RATE)) fail(`${id} seed ${seed} ${s.name} plays ${rate.toFixed(1)} notes a second`);
    }
    if (secs.length > 8) {
      const worst = Math.max(...seen.values());
      const cap = Math.max(5, Math.ceil(secs.length * 0.2));
      worstRepeat = `${worst} of ${secs.length}`;
      if (worst > cap) fail(`${id} seed ${seed} repeats one section ${worst} times`);
    }
  }
  for (const mo of MOTIFS[id] ?? []) if (!motifs.get(mo)) fail(`${id} never quotes ${mo}`);
  const mos = [...motifs].map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
  console.log(`  ${id.padEnd(7)} ${String(sections).padStart(8)}  ${String(worstAt).padStart(7)}  ${worstRate.toFixed(2).padStart(7)}  ${worstRepeat.padStart(12)}  ${mos}`);
}

// ---------------------------------------------------------------- Tilde's mend

console.log('\nMend');
{
  const secs = Music.offline.render('title', SECONDS, { seed: 7 });
  const notes = secs.flatMap((s) => s.notes);
  const staticAt = (level) => notes.filter((n) => n.v === 'nz' && n.nz === 'glitch' && audible(n, level)).length;
  const tildeAt = (level) => notes.filter((n) => n.mo === 'tilde' && audible(n, level)).length;
  const home = notes.filter((n) => n.mo === 'tilde' && (n.lay ?? 0) >= 0.95).length;
  console.log(`  title: static ${staticAt(0)} at mend 0, ${staticAt(0.5)} at 0.5, ${staticAt(1)} at 1. Tilde notes ${tildeAt(0)}, ${tildeAt(0.5)}, ${tildeAt(1)}. Home endings ${home}.`);
  if (!(staticAt(0) > staticAt(0.5) && staticAt(0.5) > staticAt(1))) fail('static in the title does not give way as the mend rises');
  if (staticAt(1) !== 0) fail('static remains in the title at a full mend');
  if (!(tildeAt(1) > tildeAt(0))) fail('Tilde does not gain notes as the mend rises');
  if (!home) fail('the title never brings Tilde home at a full mend');
}

// ---------------------------------------------------------------- the boss fight

console.log('\nBoss');
{
  const at = (level) => {
    const secs = Music.offline.render('boss', SECONDS, { seed: 7, intensity: () => level }).filter((s) => s.name !== 'intro');
    const playing = secs.reduce((a, s) => a + s.notes.filter((n) => audible(n, level)).length, 0);
    const time = secs.reduce((a, s) => a + s.secs, 0);
    return { bpm: Math.max(...secs.map((s) => s.bpm)), rate: playing / time };
  };
  const calm = at(0), turned = at(0.6), late = at(1);
  console.log(`  At intensity 0 the fight runs at ${calm.bpm} BPM with ${calm.rate.toFixed(2)} notes a second, at 0.6 ${turned.bpm} BPM with ${turned.rate.toFixed(2)}, and at 1 ${late.bpm} BPM with ${late.rate.toFixed(2)}.`);
  if (!(turned.bpm > calm.bpm)) fail('the boss track does not speed up at half HP');
  if (!(late.rate > turned.rate && turned.rate > calm.rate)) fail('the boss track does not add layers as the fight turns');
}

// ---------------------------------------------------------------- each boss

console.log('\nBoss themes (600 s each on every seed, intensity sweeping)');
{
  const MOTIF = { manager: 'sale', foreman: 'foreman', warden: 'warden', forklift: 'forklift', cook: 'cook', arcade: 'arcade', gardener: 'gardener', mainframe: 'mainframe',
    valet: 'valet', usher: 'usher', jack: 'jack' };
  const all = new Set(Object.values(MOTIF));
  if (Music.offline.bosses.join() !== Object.keys(MOTIF).join()) fail(`the bosses are ${Music.offline.bosses.join(', ')}`);
  console.log('  boss      at once  notes/s  worst repeat  figure notes');
  for (const kind of Music.offline.bosses) {
    Music.setBoss(kind);
    let worstAt = 0, worstRate = 0, worstRepeat = 0, own = 0;
    for (const seed of SEEDS) {
      const secs = Music.offline.render('boss', SECONDS, { seed, intensity: (t) => (Math.sin(t / 40) + 1) / 2 });
      const seen = new Map(), reported = new Set();
      for (const s of secs) {
        for (const n of s.notes) {
          checkNote(`boss ${kind} seed ${seed} ${s.name}`, n, reported);
          if (n.mo === MOTIF[kind]) own++;
          else if (all.has(n.mo)) fail(`the ${kind} plays another boss's figure (${n.mo})`);
          if (s.name === 'intro' && all.has(n.mo)) fail(`the fight's entrance plays the ${kind}'s figure`);
        }
        const sig = JSON.stringify(s.notes.map((n) => [n.v, n.n, Math.round((n.at - s.start) * 100)]));
        seen.set(sig, (seen.get(sig) ?? 0) + 1);
        const at = atOnce(s.notes), rate = s.notes.length / s.secs;
        worstAt = Math.max(worstAt, at);
        worstRate = Math.max(worstRate, rate);
        if (at > MAX_AT_ONCE) fail(`the ${kind} seed ${seed} ${s.name} has ${at} notes at once`);
        if (rate > RATE_CAP.boss) fail(`the ${kind} seed ${seed} ${s.name} plays ${rate.toFixed(1)} notes a second`);
      }
      const worst = Math.max(...seen.values());
      worstRepeat = Math.max(worstRepeat, worst);
      if (worst > Math.max(5, Math.ceil(secs.length * 0.2))) fail(`the ${kind} seed ${seed} repeats one section ${worst} times`);
    }
    if (!own) fail(`the ${kind} never plays its figure`);
    const layers = [0, 1].map((level) => {
      const secs = Music.offline.render('boss', 300, { seed: 7, intensity: () => level }).filter((s) => s.name !== 'intro');
      return secs.reduce((a, s) => a + s.notes.filter((n) => audible(n, level)).length, 0) / secs.reduce((a, s) => a + s.secs, 0);
    });
    if (!(layers[1] > layers[0])) fail(`the ${kind} does not add layers as the fight turns`);
    // Only the Fry Cook's fight has a griddle, and its sizzle comes in as the fight turns.
    const sizzles = [0, 1].map((level) => Music.offline.render('boss', 300, { seed: 7, intensity: () => level })
      .reduce((a, s) => a + s.notes.filter((n) => n.nz === 'sizzle' && audible(n, level)).length, 0));
    if (kind === 'cook' && !(sizzles[1] > sizzles[0])) fail('the Fry Cook\'s sizzle does not grow as the fight turns');
    if (kind !== 'cook' && sizzles[1]) fail(`the ${kind}'s fight sizzles`);
    // Only the High Score pauses, and its pause blips arrive as the fight turns.
    const pauses = [0, 1].map((level) => Music.offline.render('boss', 300, { seed: 7, intensity: () => level })
      .reduce((a, s) => a + s.notes.filter((n) => n.v === 'blip' && n.mo === 'arcade' && audible(n, level)).length, 0));
    if (kind === 'arcade' && !(pauses[0] === 0 && pauses[1] > 0)) fail('the High Score\'s pause blips do not arrive as the fight turns');
    // The Gardener's watering can pours more as the fight turns, and its bass keeps waltz time across the fight's bars.
    const drops = [0, 1].map((level) => Music.offline.render('boss', 300, { seed: 7, intensity: () => level })
      .reduce((a, s) => a + s.notes.filter((n) => n.v === 'glass' && n.mo === 'gardener' && audible(n, level)).length, 0));
    if (kind === 'gardener') {
      if (!(drops[0] > 0 && drops[1] > drops[0])) fail('the Gardener\'s watering can does not pour more as the fight turns');
      const offGrid = Music.offline.render('boss', SECONDS, { seed: 7, intensity: (t) => (Math.sin(t / 40) + 1) / 2 })
        .filter((s) => s.tag !== 'meter')
        .flatMap((s) => s.notes.filter((n) => n.v === 'bass').map((n) => (((n.at - s.start) * s.bpm) / 60) % 3))
        .filter((x) => Math.min(x, 3 - x) > 0.02 && Math.abs(x - 2.5) > 0.02).length;
      if (offGrid) fail(`${offGrid} of the Gardener's bass notes fall off the waltz`);
    }
    // The Mainframe's data bursts thicken as the fight turns.
    const bursts = [0, 0.5, 1].map((level) => Music.offline.render('boss', 300, { seed: 7, intensity: () => level })
      .reduce((a, s) => a + s.notes.filter((n) => n.nz === 'data' && n.mo === 'mainframe' && audible(n, level)).length, 0));
    if (kind === 'mainframe' && !(bursts[0] < bursts[1] && bursts[1] < bursts[2])) fail('the Mainframe\'s data bursts do not thicken as the fight turns');
    if (kind !== 'mainframe' && bursts[2]) fail(`the ${kind}'s fight plays the Mainframe's data bursts`);
    // The Valet's keys and the Usher's flashlight arrive as the fight turns, the Valet shuffles, and the Jack springs on the last beat.
    const layer = (pred) => [0, 0.5, 1].map((level) => Music.offline.render('boss', 300, { seed: 7, intensity: () => level })
      .reduce((a, s) => a + s.notes.filter((n) => pred(n) && audible(n, level)).length, 0));
    let extra = '';
    if (kind === 'valet') {
      const keys = layer((n) => n.v === 'glass' && n.mo === 'valet');
      if (!(keys[0] === 0 && keys[2] > 0)) fail('the Valet\'s keys do not arrive as the fight turns');
      let swung = 0, straight = 0;
      for (const s of Music.offline.render('boss', SECONDS, { seed: 7 }).filter((x) => x.name === 'pitch' || x.name === 'duel')) {
        for (const n of s.notes.filter((q) => q.v === 'lead' && q.mo === 'valet')) {
          const f = ((((n.at - s.start) * s.bpm) / 60) % 1 + 1) % 1;
          if (Math.abs(f - 2 / 3) < 0.02) swung++; else if (Math.abs(f - 0.5) < 0.02) straight++;
        }
      }
      if (!(swung > 4 * straight)) fail('the Valet does not shuffle');
      extra = `, keys ${keys.join(', ')} at intensity 0, 0.5, and 1, ${swung} swung off-beats`;
    }
    if (kind === 'usher') {
      const clicks = layer((n) => n.nz === 'tick' && n.mo === 'usher');
      if (!(clicks[0] < clicks[1] && clicks[1] < clicks[2])) fail('the Usher\'s flashlight clicks do not thicken as the fight turns');
      extra = `, flashlight clicks ${clicks.join(', ')} at intensity 0, 0.5, and 1`;
    }
    if (kind === 'jack') {
      let springs = 0, flat = 0;
      for (const s of Music.offline.render('boss', SECONDS, { seed: 7, intensity: (t) => (Math.sin(t / 40) + 1) / 2 }).filter((x) => (x.name === 'pitch' || x.name === 'duel') && !x.tag)) {
        const tune = s.notes.filter((n) => n.v === 'glass' && n.mo === 'jack').sort((a, b) => a.at - b.at);
        tune.forEach((n, i) => {
          const beat = ((n.at - s.start) * s.bpm) / 60;
          if (i && Math.abs(beat % 4 - 3) < 0.02) { if (n.n - tune[i - 1].n >= 7) springs++; else flat++; }
        });
      }
      if (!springs || flat) fail(`the Jack does not spring on the last beat (${flat} flat endings)`);
      extra = `, ${springs} springs on the last beat`;
    }
    const sizzled = extra || (kind === 'mainframe' ? `, data bursts ${bursts.join(', ')} at intensity 0, 0.5, and 1` : kind === 'cook' ? `, sizzles ${sizzles[0]} to ${sizzles[1]}` : kind === 'arcade' ? `, pause blips ${pauses[0]} to ${pauses[1]}`
      : kind === 'gardener' ? `, watering-can drops ${drops[0]} to ${drops[1]}` : '');
    console.log(`  ${kind.padEnd(9)} ${String(worstAt).padStart(7)}  ${worstRate.toFixed(2).padStart(7)}  ${String(worstRepeat).padStart(12)}  ${own}, and ${layers[0].toFixed(2)} to ${layers[1].toFixed(2)} notes a second from intensity 0 to 1${sizzled}`);
  }
  const last = Music.offline.bosses[Music.offline.bosses.length - 1];
  Music.setBoss('nobody');
  const kept = Music.offline.render('boss', 60, { seed: 7 }).some((s) => s.notes.some((n) => n.mo === MOTIF[last]));
  if (!kept) fail('an unknown boss type replaced the last boss');
  Music.setBoss('manager');
}

// ---------------------------------------------------------------- Overtime

console.log('\nOvertime');
{
  // Tilde's last note in Overtime is the leading tone, held. Only the title brings her home.
  const notes = Music.offline.render('area7', SECONDS, { seed: 7 }).flatMap((s) => s.notes.filter((n) => n.mo === 'tilde' && n.v === 'bell' && n.dur > 2));
  const leading = notes.filter((n) => ((n.n - 68) % 12 + 12) % 12 === 11).length;
  const home = notes.filter((n) => ((n.n - 68) % 12 + 12) % 12 === 0).length;
  console.log(`  Tilde's held notes: ${leading} on the leading tone and ${home} on the tonic.`);
  if (!leading) fail('Overtime never holds Tilde on the leading tone');
  if (home) fail('Overtime brings Tilde home, which only the title may do');
}

// ---------------------------------------------------------------- the Food Court

console.log('\nFood Court');
let foodTorn = 1;
{
  const pc = (n) => ((n.n - 65) % 12 + 12) % 12;
  const secs = SEEDS.flatMap((seed) => Music.offline.render('area8', SECONDS, { seed }));
  // Tilde is nearly whole this late: few of her notes are torn, and her held note stops on the leading tone.
  const tilde = secs.flatMap((s) => s.notes.filter((n) => n.mo === 'tilde'));
  const torn = (foodTorn = tilde.filter((n) => n.lay !== undefined).length / Math.max(1, tilde.length));
  const held = tilde.filter((n) => n.dur > 1.5);
  const leading = held.filter((n) => pc(n) === 11).length, home = held.filter((n) => pc(n) === 0).length;
  console.log(`  Tilde: ${tilde.length} notes, ${(torn * 100).toFixed(1)} percent torn. Held notes: ${leading} on the leading tone and ${home} on the tonic.`);
  if (torn > 1 / 6) fail('Tilde is not nearly whole in the Food Court');
  if (!leading) fail('the Food Court never holds Tilde on the leading tone');
  if (home) fail('the Food Court brings Tilde home, which only the title may do');
  // The stall swings: its off-beat eighths fall two thirds of the way through the beat.
  let swung = 0, straight = 0;
  for (const s of secs.filter((x) => x.name === 'stall')) {
    const spb = 60 / s.bpm;
    for (const n of s.notes) {
      if (!n.m) continue;
      const f = (((n.at - s.start) / spb) % 1 + 1) % 1;
      if (Math.abs(f - 2 / 3) < 0.02) swung++;
      else if (Math.abs(f - 0.5) < 0.02) straight++;
    }
  }
  console.log(`  The stall's tune: ${swung} swung off-beats and ${straight} straight ones.`);
  if (!(swung > 4 * straight)) fail('the Food Court\'s stall does not swing');
  // The grills have gone cold, so each sizzle in the grill section is weaker than the one before it.
  const grills = secs.filter((s) => s.name === 'grill');
  for (const s of grills) {
    const g = s.notes.filter((n) => n.nz === 'sizzle').sort((a, b) => a.at - b.at).map((n) => n.g);
    if (!g.length || g.some((x, i) => i && x >= g[i - 1])) { fail('a grill section\'s sizzles do not die away'); break; }
  }
  // The ding ends the microwave's hum. A bar in another meter may move one and not the other.
  for (const s of secs.filter((x) => x.name === 'microwave' && x.tag !== 'meter')) {
    const ding = Math.min(...s.notes.filter((n) => n.v === 'glass').map((n) => n.at));
    const hum = Math.max(...s.notes.filter((n) => n.v === 'drone').map((n) => n.at + n.dur));
    if (!(Math.abs(hum - ding) < 0.05)) { fail('the microwave\'s ding does not end its hum'); break; }
  }
  console.log(`  ${grills.length} grill sections die away, and every microwave's ding ends its hum.`);
}

// ---------------------------------------------------------------- the Arcade

console.log('\nArcade');
let arcadeTorn = 1;
{
  const pc = (n) => ((n.n - 69) % 12 + 12) % 12;
  const secs = SEEDS.flatMap((seed) => Music.offline.render('area9', SECONDS, { seed }));
  // Tilde is a little more whole here than in the Food Court, and still held a half step short of home.
  const tilde = secs.flatMap((s) => s.notes.filter((n) => n.mo === 'tilde'));
  const torn = (arcadeTorn = tilde.filter((n) => n.lay !== undefined).length / Math.max(1, tilde.length));
  const held = tilde.filter((n) => n.dur > 1.5);
  const leading = held.filter((n) => pc(n) === 11).length, home = held.filter((n) => pc(n) === 0).length;
  console.log(`  Tilde: ${tilde.length} notes, ${(torn * 100).toFixed(1)} percent torn against ${(foodTorn * 100).toFixed(1)} in the Food Court. Held notes: ${leading} on the leading tone and ${home} on the tonic.`);
  if (!(torn <= 1 / 12 && torn < foodTorn)) fail('Tilde is not more whole in the Arcade than in the Food Court');
  if (!leading) fail('the Arcade never holds Tilde on the leading tone');
  if (home) fail('the Arcade brings Tilde home, which only the title may do');
  // The high-score fanfare never reaches its last note, the tonic above its first.
  let fanfares = 0, finished = 0;
  for (const s of secs) {
    const f = s.notes.filter((n) => n.mo === 'hiscore');
    if (!f.length) continue;
    fanfares++;
    const low = Math.min(...f.map((n) => n.n));
    if (f.some((n) => n.n > low && pc(n) === 0)) finished++;
  }
  console.log(`  The high-score fanfare plays ${fanfares} times and finishes ${finished} times.`);
  if (!fanfares) fail('the Arcade never plays its high-score fanfare');
  if (finished) fail('the high-score fanfare finishes');
}

// ---------------------------------------------------------------- the Garden Center

console.log('\nGarden Center');
let gardenTorn = 1;
{
  const pc = (n) => ((n.n - 71) % 12 + 12) % 12;
  const secs = SEEDS.flatMap((seed) => Music.offline.render('area10', SECONDS, { seed }));
  // Tilde is a little more whole here than in the Arcade, and still held a half step short of home.
  const tilde = secs.flatMap((s) => s.notes.filter((n) => n.mo === 'tilde'));
  const torn = tilde.filter((n) => n.lay !== undefined).length / Math.max(1, tilde.length);
  const held = tilde.filter((n) => n.dur > 1.5);
  const leading = held.filter((n) => pc(n) === 11).length, home = held.filter((n) => pc(n) === 0).length;
  gardenTorn = torn;
  console.log(`  Tilde: ${tilde.length} notes, ${(torn * 100).toFixed(1)} percent torn against ${(arcadeTorn * 100).toFixed(1)} in the Arcade. Held notes: ${leading} on the leading tone and ${home} on the tonic.`);
  if (!(torn < arcadeTorn)) fail('Tilde is not more whole in the Garden Center than in the Arcade');
  if (!leading) fail('the Garden Center never holds Tilde on the leading tone');
  if (home) fail('the Garden Center brings Tilde home, which only the title may do');
  // The gentlest area: no drum hits at all, and crickets in every section but the sprinkler's.
  const drums = secs.flatMap((s) => s.notes.filter((n) => ['kick', 'snare', 'taiko', 'boom'].includes(n.nz))).length;
  const quiet = secs.filter((s) => s.name !== 'sprinkler' && !s.notes.some((n) => n.nz === 'cricket')).length;
  // Every sprinkler section ticks round and then ratchets back.
  const sprinklers = secs.filter((s) => s.name === 'sprinkler');
  const unturned = sprinklers.filter((s) => {
    const ticks = s.notes.filter((n) => n.nz === 'tick'), back = s.notes.find((n) => n.nz === 'ratchet');
    return !back || ticks.length < 8 || ticks.some((n) => n.at > back.at);
  }).length;
  console.log(`  ${drums} drum hits, ${quiet} sections without crickets, and ${sprinklers.length} sprinklers that tick round and ratchet back.`);
  if (drums) fail('the Garden Center has drums');
  if (quiet) fail('a Garden Center section has no crickets');
  if (unturned) fail('a sprinkler does not tick round and then ratchet back');
}

// ---------------------------------------------------------------- the Server Room

console.log('\nServer Room');
{
  const pc = (n) => ((n.n - 67) % 12 + 12) % 12;
  const secs = SEEDS.flatMap((seed) => Music.offline.render('area11', SECONDS, { seed }));
  // Tilde is whole here but for her final note: none of her notes is torn, and she still stops a half step short of home.
  const tilde = secs.flatMap((s) => s.notes.filter((n) => n.mo === 'tilde'));
  const torn = tilde.filter((n) => n.lay !== undefined).length;
  const held = tilde.filter((n) => n.dur > 1.5);
  const leading = held.filter((n) => pc(n) === 11).length, home = tilde.filter((n) => pc(n) === 0).length;
  console.log(`  Tilde: ${tilde.length} notes, ${torn} torn against ${(gardenTorn * 100).toFixed(1)} percent in the Garden Center. Held notes on the leading tone: ${leading}. Notes on the tonic: ${home}.`);
  if (!tilde.length) fail('the Server Room never plays Tilde');
  if (torn) fail('Tilde is torn in the Server Room');
  if (!leading) fail('the Server Room never holds Tilde on the leading tone');
  if (home) fail('Tilde reaches the tonic in the Server Room, which only the title may do');
  // The room is precise: every note starts on a sixteenth, where the Garden Center lilts in thirds of a beat.
  const offGrid = (list) => list.flatMap((s) => s.notes.map((n) => (((n.at - s.start) * s.bpm) / 60) * 4))
    .filter((x) => Math.abs(x - Math.round(x)) > 0.01).length;
  const garden = offGrid(SEEDS.flatMap((seed) => Music.offline.render('area10', SECONDS, { seed })));
  const loose = offGrid(secs);
  console.log(`  Notes off the sixteenth-note grid: ${loose} in the Server Room and ${garden} in the Garden Center.`);
  if (loose) fail('the Server Room plays a note off the sixteenth-note grid');
  if (!garden) fail('the Garden Center no longer lilts');
}

// ---------------------------------------------------------------- Tilde home (areas 12 to 14, and After Hours)

console.log('\nTilde home');
for (const [id, root] of [['area12', 63], ['area13', 62], ['area14', 73], ['area16', 67]]) {
  const secs = SEEDS.flatMap((seed) => Music.offline.render(id, SECONDS, { seed })).filter((s) => s.tag !== 'tritone');
  let sections = 0, bad = 0;
  for (const s of secs) {
    const tilde = s.notes.filter((n) => n.mo === 'tilde' && n.dur > 0.2);
    if (!tilde.length) continue;
    sections++;
    const home = tilde.filter((n) => ((n.n - root) % 12 + 12) % 12 === 0);
    if (home.length !== 1 || tilde.some((n) => n !== home[0] && n.g <= home[0].g)) bad++;
  }
  console.log(`  ${id}: ${sections} sections with Tilde, ${bad} of them without exactly one soft homecoming.`);
  if (!sections) fail(`${id} never plays Tilde`);
  if (bad) fail(`Tilde does not come home once, softly, in every ${id} section that plays her`);
}

// ---------------------------------------------------------------- the Parking Garage, the Cinema, and the Toy Store

console.log('\nGarage, Cinema, and Toy Store');
{
  const beatOf = (s, n) => ((n.at - s.start) * s.bpm) / 60;
  // The car alarm stops after at most its first two parts: no statement runs past nine notes.
  let alarms = 0, longest = 0;
  for (const s of SEEDS.flatMap((seed) => Music.offline.render('area12', SECONDS, { seed }))) {
    const notes = s.notes.filter((n) => n.mo === 'alarm').sort((a, b) => a.at - b.at);
    let run = 0;
    notes.forEach((n, i) => {
      if (!i || beatOf(s, n) - beatOf(s, notes[i - 1]) > 1.5) { alarms++; run = 0; }
      run++;
      longest = Math.max(longest, run);
    });
  }
  console.log(`  The garage's car alarm sounds ${alarms} times, and its longest run is ${longest} notes of the twelve a full pattern would take.`);
  if (!alarms) fail('the Parking Garage never sounds its car alarm');
  if (longest > 9) fail('the car alarm finishes its pattern');
  // The reel runs out: its rattle stops before the loose end starts to slap.
  let reels = 0, early = 0;
  for (const s of SEEDS.flatMap((seed) => Music.offline.render('area13', SECONDS, { seed })).filter((x) => x.name === 'reelend' && x.tag !== 'meter')) {
    reels++;
    const rattle = Math.max(...s.notes.filter((n) => n.nz === 'ratchet').map((n) => n.at + n.dur));
    const slaps = s.notes.filter((n) => n.mo === 'slap');
    if (slaps.length < 4 || slaps.some((n) => n.at < rattle - 1e-6)) early++;
  }
  console.log(`  The cinema's reel runs out ${reels} times, and ${early} times it slaps before the rattle stops.`);
  if (!reels) fail('the Cinema never runs out of reel');
  if (early) fail('a reel slaps before its rattle stops');
  // The clockwork runs down, the gaps between its ticks widening, and every run-down is wound up again.
  let downs = 0, uneven = 0, unwound = 0;
  for (const seed of SEEDS) {
    const secs = Music.offline.render('area14', SECONDS, { seed });
    secs.forEach((s, i) => {
      if (s.name !== 'rundown' || s.tag === 'meter') return;
      downs++;
      const t = s.notes.filter((n) => n.mo === 'clock').map((n) => beatOf(s, n)).sort((a, b) => a - b);
      const gaps = t.slice(1).map((x, k) => x - t[k]);
      if (gaps.some((g, k) => k && g < gaps[k - 1] - 1e-6) || !(gaps[gaps.length - 1] > gaps[0])) uneven++;
      const next = secs[i + 1];
      if (next && !(next.name === 'windup' && next.notes.filter((n) => n.mo === 'wind').length >= 2)) unwound++;
    });
  }
  console.log(`  The toy store's clockwork runs down ${downs} times, ${uneven} times unevenly, and is left unwound ${unwound} times.`);
  if (!downs) fail('the Toy Store never runs down');
  if (uneven) fail('the clockwork does not slow steadily as it runs down');
  if (unwound) fail('the clockwork runs down and is not wound again');
}

// ---------------------------------------------------------------- jingles

console.log('\nJingles');
for (const id of Music.offline.jingles) {
  const j = Music.offline.jingle(id);
  const spb = 60 / j.bpm;
  if (!j.notes.length) { fail(`jingle ${id} renders nothing`); continue; }
  const reported = new Set();
  for (const n of j.notes) checkNote(`jingle ${id}`, n, reported);
  const secs = Math.max(...j.notes.map((n) => (n.t + n.d) * spb));
  const range = JINGLE_SECS[id];
  if (!range) fail(`jingle ${id} has no expected length`);
  else if (secs < range[0] || secs > range[1]) fail(`jingle ${id} lasts ${secs.toFixed(2)} s, outside ${range[0]} to ${range[1]}`);
  const at = atOnce(j.notes, (n) => n.t, (n) => n.d);
  if (at > MAX_AT_ONCE) fail(`jingle ${id} has ${at} notes at once`);
  const line = j.notes.filter((n) => n.mo).sort((a, b) => a.t - b.t);
  const first = line[0], end = line[line.length - 1];
  console.log(`  ${id.padEnd(6)} ${secs.toFixed(2)} s, ${j.notes.length} notes, ${at} at once, melody ${line.map((n) => n.n).join(' ')}`);
  if (id === 'clear') {
    if (!line.length || line.some((n) => n.mo !== 'tilde')) fail('clear does not quote Tilde');
    else if (!(end.n > first.n && line.every((n) => n.n <= end.n) && end.n % 12 === 0)) fail('clear does not resolve up to the tonic');
  }
  if (id === 'lose' && !(line.length && end.n < first.n)) fail('lose does not fall');
}

// ---------------------------------------------------------------- the finale

console.log('\nFinale');
{
  const FORM_MOTIF = { manager: 'sale', cook: 'cook', gardener: 'gardener', valet: 'valet' };
  if (Music.offline.forms.join() !== [...Object.keys(FORM_MOTIF), 'true'].join()) fail(`the Static's forms are ${Music.offline.forms.join(', ')}`);
  const copies = Object.values(FORM_MOTIF);
  for (const form of Music.offline.forms) {
    Music.setBoss(form);
    const secs = SEEDS.flatMap((seed) => Music.offline.render('final', 300, { seed, intensity: (t) => (Math.sin(t / 30) + 1) / 2 }));
    const count = (mo) => secs.reduce((k, x) => k + x.notes.filter((n) => n.mo === mo).length, 0);
    const heard = copies.filter((mo) => count(mo));
    const slowest = Math.min(...secs.map((x) => x.bpm));
    console.log(`  ${form.padEnd(8)} static ${count('static')}, copies ${heard.join(', ') || 'none'}, slowest ${slowest} bpm.`);
    if (!count('static')) fail(`the Static never plays its own figure as the ${form}`);
    if (slowest <= 112) fail(`the finale as the ${form} drops to ${slowest} bpm, no faster than the boss fight`);
    if (form === 'true') { if (heard.length < 3) fail('the true form borrows fewer than three of the bosses it copied'); }
    else if (heard.join() !== FORM_MOTIF[form]) fail(`the finale as the ${form} quotes ${heard.join(', ')}`);
  }
  Music.setBoss('valet');
  Music.setBoss('static');
  const kept = Music.offline.render('final', 120, { seed: 7 }).every((x) => x.notes.every((n) => !copies.includes(n.mo) || n.mo === 'valet'));
  Music.setBoss('true');
  // Tilde's torn wave comes back as each stage is won.
  const tildeAt = (level) => SEEDS.flatMap((seed) => Music.offline.render('final', 300, { seed, intensity: () => level }))
    .reduce((k, x) => k + x.notes.filter((n) => n.mo === 'tilde' && audible(n, level)).length, 0);
  const torn = [0, 1].map(tildeAt);
  console.log(`  'static' leaves the copied boss as it was (${kept ? 'the valet stays' : 'it does not'}). Tilde notes in the rift: ${torn[0]} at intensity 0, ${torn[1]} at 1.`);
  if (!kept) fail('Music.setBoss(\'static\') changes the copied boss');
  if (!(torn[1] > torn[0])) fail('Tilde does not come back as a stage of the finale is won');
}
{
  // The Atrium keeps its static at any mend. After Hours and the ending have none.
  const NOISE = new Set(['glitch', 'hiss', 'seek', 'data', 'modem']);
  const noisy = (id, level) => SEEDS.flatMap((seed) => Music.offline.render(id, 300, { seed, intensity: () => level }))
    .reduce((k, x) => k + x.notes.filter((n) => n.nz === 'glitch' && audible(n, level)).length, 0);
  const atrium = [0, 1].map((level) => noisy('area15', level));
  console.log(`  area15: glitches ${atrium[0]} at mend 0 and ${atrium[1]} at a full mend.`);
  if (!(atrium[1] > 0 && atrium[1] >= atrium[0] * 0.8)) fail('the static leaves the Atrium as the mend rises');
  const atriumHome = SEEDS.flatMap((seed) => Music.offline.render('area15', 300, { seed })).some((x) => x.notes.some((n) => n.mo === 'tilde' && ((n.n - 62) % 12 + 12) % 12 === 0));
  if (atriumHome) fail('Tilde reaches the tonic in the Atrium, where the static is still in her');
  const end = SEEDS.flatMap((seed) => Music.offline.render('ending', 300, { seed }));
  const endNoise = end.reduce((k, x) => k + x.notes.filter((n) => NOISE.has(n.nz) || n.mo === 'static').length, 0);
  const homes = end.filter((x) => x.notes.some((n) => n.mo === 'tilde' && n.v === 'bell' && ((n.n - 62) % 12 + 12) % 12 === 0)).length;
  const first = Music.offline.render('ending', 10, { seed: 7 });
  console.log(`  ending: opens at ${first[0].secs.toFixed(2)} s with ${first[0].notes.length} notes, then ${first[1].notes.length}. Static ${endNoise}. Sections bringing Tilde home ${homes} of ${end.length}.`);
  if (endNoise) fail('the ending has static in it');
  if (Math.abs(first[0].secs - 2.4) > 0.05) fail(`the ending opens up at ${first[0].secs.toFixed(2)} s instead of 2.4 s`);
  if (!(first[1].notes.length > first[0].notes.length * 4)) fail('the ending does not open up after its soft start');
  if (homes < end.length / 2) fail('the ending brings Tilde home in fewer than half its sections');
  const dawn = SEEDS.flatMap((seed) => Music.offline.render('area16', 300, { seed })).reduce((k, x) => k + x.notes.filter((n) => NOISE.has(n.nz)).length, 0);
  console.log(`  area16: static ${dawn}.`);
  if (dawn) fail('After Hours has static in it');
}

// ---------------------------------------------------------------- API

console.log('\nAPI');
try {
  for (const f of ['play', 'stop', 'setMuted', 'jingle', 'setMended', 'setIntensity', 'setBoss']) if (typeof Music[f] !== 'function') fail(`Music.${f} is missing`);
  Music.play('title');
  if (Music.current() !== 'title') fail('Music.play does not remember a track before the AudioContext exists');
  Music.play('nothing');
  Music.play('toString');
  if (Music.current() !== 'title') fail('Music.play accepts an unknown track');
  Music.jingle('clear');
  Music.jingle('nothing');
  Music.setMuted(true);
  Music.setMuted(false);
  Music.setMended(0.5);
  Music.play('area2');
  if (Music.current() !== 'area2') fail('Music.play does not switch tracks');
  Music.play('boss');
  Music.setIntensity(0.7);
  Music.setIntensity(NaN);
  if (Music.current() !== 'boss') fail('Music.play does not reach the boss track');
  Music.play('postboss');
  Music.play('area7');
  if (Music.current() !== 'area7') fail('Music.play does not reach Overtime');
  Music.play('area8');
  if (Music.current() !== 'area8') fail('Music.play does not reach the Food Court');
  Music.play('boss');
  Music.setBoss('cook');
  Music.setIntensity(0.5);
  Music.play('area9');
  if (Music.current() !== 'area9') fail('Music.play does not reach the Arcade');
  Music.play('boss');
  Music.setBoss('arcade');
  Music.setIntensity(0.7);
  Music.play('area10');
  if (Music.current() !== 'area10') fail('Music.play does not reach the Garden Center');
  Music.play('boss');
  Music.setBoss('gardener');
  Music.setIntensity(0.4);
  Music.play('area11');
  if (Music.current() !== 'area11') fail('Music.play does not reach the Server Room');
  Music.play('boss');
  Music.setBoss('mainframe');
  Music.setIntensity(0.9);
  for (const t of ['area12', 'area13', 'area14']) {
    Music.play(t);
    if (Music.current() !== t) fail(`Music.play does not reach ${t}`);
  }
  Music.play('boss');
  for (const k of ['valet', 'usher', 'jack']) Music.setBoss(k);
  Music.setIntensity(0.3);
  for (const t of ['area15', 'final', 'ending', 'area16']) {
    Music.play(t);
    if (Music.current() !== t) fail(`Music.play does not reach ${t}`);
    if (t === 'final') for (const k of ['manager', 'static', 'true']) { Music.setBoss(k); Music.setIntensity(0.6); }
  }
  Music.stop();
  if (Music.current() !== null) fail('Music.stop does not clear the track');
  console.log('  play, stop, setMuted, jingle, setMended, and setIntensity run without a context and ignore unknown names.');
} catch (e) {
  fail(`the API threw without a context: ${e && e.stack}`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll music checks passed.');
process.exit(failures ? 1 : 0);
