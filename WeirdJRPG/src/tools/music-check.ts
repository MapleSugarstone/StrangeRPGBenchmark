// Validates every track, effect, and blip without audio. Run: node scripts/build.mjs --tools && node dist-tools/music-check.js [--seconds=600] [--verbose]
import * as audio from '../engine/audio';
import type { AreaTint, BattleCue, BattleCueOpts, SfxId, TrackId, VoiceId } from '../engine/audio';
import { PALETTES, VOICE_BASE, X_POLY, normStats, normalize, offline, renderTrack } from '../engine/music';
import type { Conductor, Melt, Note, Rendered, SimNote } from '../engine/music';
import { FIGHT_TRACKS } from '../engine/score/fight';
import { TRACKS, TRACK_IDS } from '../engine/score';
import { PILGRIM_COUNT, memoryOf, pilgrim } from '../engine/score/motifs';
import { Rng, noteCount } from '../engine/score/lib';
import type { MemLine, MotifName, Voice } from '../engine/score/lib';
import { BENDS, DEFAULT_TUNING, DUCKS, LONG_SFX, SFX_DEFS, SFX_LEVEL, STINGER_IDS, TUNED, ftom, retune, scaleNote, sfxLength, snapMidi, stingerVoices } from '../engine/score/sfxdefs';
import type { Tuning } from '../engine/score/sfxdefs';
import { BLIP_VOICE_IDS, blipVoices, newBlipState, planBlip } from '../engine/score/speech';

const proc = (globalThis as { process?: { argv: string[]; exit(code: number): void } }).process;
const argv = proc?.argv ?? [];
const SECONDS = Number((argv.find((a) => a.startsWith('--seconds=')) ?? '--seconds=600').split('=')[1]) || 600;
const VERBOSE = argv.includes('--verbose');
const SEED0 = Number((argv.find((a) => a.startsWith('--seed=')) ?? '--seed=0').split('=')[1]) || 0;

const failures: string[] = [];
const warnings: string[] = [];
const fail = (where: string, msg: string) => { failures.push(`${where}: ${msg}`); };
const warn = (where: string, msg: string) => { warnings.push(`${where}: ${msg}`); };
const log = (s: string) => { console.log(s); };

const TINTS: AreaTint[] = ['brass', 'sea', 'year', 'stone', 'void'];
const TINTED: TrackId[] = ['battle', 'miniboss', 'boss'];
const COMBAT: TrackId[] = ['battle', 'miniboss', 'boss', 'keeper', 'lightbound', 'guardian', 'escape'];
const RANGE: Record<Voice, [number, number]> = { p1: [40, 100], p2: [40, 100], tri: [26, 64], nz: [0, 127], x: [30, 108] };
/** Tracks where long silence is part of the design. */
const SPARSE: ReadonlySet<TrackId> = new Set<TrackId>(['void', 'choice', 'despair', 'end_accept', 'chasm']);
const MOTIFS: MotifName[] = ['pilgrim', 'unravel', 'void', 'stone', 'year', 'choice', 'seer', 'lightbound', 'vorn', 'keeper'];

function active(n: Note, level: number): boolean {
  return (n.lay ?? 0) <= level && !(n.top !== undefined && level >= n.top);
}

function notesOf(rs: Rendered[]): Note[] {
  const out: Note[] = [];
  for (const s of rs) for (const n of s.notes) out.push(n);
  return out;
}

/** Peak count of overlapping notes per voice at an intensity level. */
function overlaps(notes: Note[], level: number): { peak: Record<Voice, number>; total: number } {
  const peak: Record<Voice, number> = { p1: 0, p2: 0, tri: 0, nz: 0, x: 0 };
  const ev: Array<{ t: number; d: number; v: Voice }> = [];
  for (const n of notes) if (active(n, level)) ev.push({ t: n.at + 0.012, d: 1, v: n.v }, { t: n.at + n.dur - 0.012, d: -1, v: n.v });
  ev.sort((a, b) => a.t - b.t || a.d - b.d);
  const cur: Record<Voice, number> = { p1: 0, p2: 0, tri: 0, nz: 0, x: 0 };
  let total = 0, maxTotal = 0;
  for (const e of ev) {
    cur[e.v] += e.d; total += e.d;
    peak[e.v] = Math.max(peak[e.v], cur[e.v]);
    maxTotal = Math.max(maxTotal, total);
  }
  return { peak, total: maxTotal };
}

/** The loudest sum of note levels at any instant, a rough measure of headroom. */
function peakLoad(notes: Note[], level: number): number {
  const ev: Array<{ t: number; g: number }> = [];
  for (const n of notes) if (active(n, level) && n.v !== 'nz') ev.push({ t: n.at, g: Math.min(1, n.g) * VOICE_BASE[n.v] }, { t: n.at + n.dur, g: -Math.min(1, n.g) * VOICE_BASE[n.v] });
  ev.sort((a, b) => a.t - b.t || a.g - b.g);
  let cur = 0, peak = 0;
  for (const e of ev) { cur += e.g; peak = Math.max(peak, cur); }
  return peak;
}

const signature = (s: Rendered): string => s.sig;

function checkRender(id: TrackId, tint: AreaTint, rs: Rendered[], seed: number, seconds: number) {
  const where = `${id}/${tint}/seed${seed}`;
  const def = TRACKS[id];
  const total = rs.reduce((s, r) => s + r.secs, 0);
  if (total < seconds * 0.98) fail(where, `the track ended after ${total.toFixed(1)} s, so it does not loop`);
  const notes = notesOf(rs);
  if (!notes.length) { fail(where, 'the track is silent'); return; }
  for (const s of rs) {
    if (!(s.secs > 0) || !Number.isFinite(s.secs)) fail(where, `section ${s.name} has length ${s.secs}`);
    for (const n of s.notes) {
      const r = RANGE[n.v];
      if (n.n < r[0] || n.n > r[1]) { fail(where, `section ${s.name}: ${n.v} note ${n.n.toFixed(2)} is outside ${r[0]} to ${r[1]}`); break; }
      if (!(n.g > 0 && n.g <= 1)) { fail(where, `section ${s.name}: gain ${n.g} is outside 0 to 1`); break; }
      if (n.at < s.start - 1e-6 || n.at + n.dur > s.start + s.secs + 0.011) { fail(where, `section ${s.name}: a ${n.v} note runs past the section end`); break; }
      if (!Number.isFinite(n.at) || !Number.isFinite(n.dur)) { fail(where, `section ${s.name}: a note has a bad time`); break; }
    }
  }
  for (const level of [0, 0.5, 1]) {
    const o = overlaps(notes, level);
    for (const v of ['p1', 'p2', 'tri', 'nz'] as Voice[]) if (o.peak[v] > 1) { fail(where, `${v} has ${o.peak[v]} notes sounding at once at intensity ${level}`); break; }
    if (o.peak.x > X_POLY) fail(where, `x has ${o.peak.x} notes sounding at once at intensity ${level}`);
    if (o.total > 6) fail(where, `${o.total} channels sound at once at intensity ${level}`);
  }
  const load = peakLoad(notes, 1);
  if (load > 1.1) fail(where, `the summed note level reaches ${load.toFixed(2)}, which leaves no headroom`);
  // Longest stretch with no note starting.
  const starts = notes.map((n) => n.at).sort((a, b) => a - b);
  let gap = starts[0], worst = gap;
  for (let i = 1; i < starts.length; i++) worst = Math.max(worst, starts[i] - starts[i - 1]);
  worst = Math.max(worst, total - starts[starts.length - 1]);
  const limit = SPARSE.has(id) ? 40 : 14;
  if (worst > limit) fail(where, `no note starts for ${worst.toFixed(1)} s`);
  gap = worst;
  // Motifs named in the brief appear.
  const seen = new Set<MotifName>();
  for (const s of rs) for (const m of s.motifs) { if (!MOTIFS.includes(m)) fail(where, `unknown motif ${m}`); seen.add(m); }
  for (const m of def.motifs) if (!seen.has(m)) fail(where, `motif ${m} never plays`);
  // Repetition: no identical section more than a few times.
  const counts = new Map<string, number>();
  for (const s of rs) { const k = signature(s); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const rep = Math.max(...counts.values());
  if (rep > 3 && rs.length > 6) {
    const name = rs.find((s) => counts.get(signature(s)) === rep)?.name;
    fail(where, `section ${name} repeats exactly ${rep} times`);
  }
  for (let i = 1; i < rs.length; i++) if (signature(rs[i]) === signature(rs[i - 1]) && rs[i].notes.length > 4) { fail(where, `section ${rs[i].name} repeats itself back to back`); break; }
  // Tracks that never cadence do not end a section on the tonic.
  if (def.neverTonic) {
    const pc = ((def.key.root % 12) + 12) % 12;
    let bad = 0;
    for (const s of rs) for (const v of ['p1', 'tri'] as Voice[]) {
      const vn = s.notes.filter((n) => n.v === v);
      if (!vn.length) continue;
      const last = vn.reduce((a, b) => (b.at >= a.at ? b : a));
      if (((Math.round(last.n) % 12) + 12) % 12 === pc) bad++;
    }
    if (bad) fail(where, `${bad} sections end a voice on the tonic`);
  }
  if (VERBOSE) log(`  ${where}: ${rs.length} sections, ${notes.length} notes, longest gap ${gap.toFixed(1)} s, summed level ${load.toFixed(2)}, repeat ${rep}`);
}

function checkSpecial(id: TrackId, rs: Rendered[]) {
  const tags = rs.map((r) => r.tag ?? '');
  const names = rs.map((r) => r.name);
  const count = (f: (r: Rendered) => boolean) => rs.filter(f).length;
  if (id === 'tower') {
    if (!count((r) => r.tag === 'stop')) fail(id, 'the gears never stop the music for a beat');
    if (!names.includes('consume')) fail(id, 'the grind never consumes itself');
  }
  if (id === 'reef') {
    const fg = rs.filter((r) => r.name === 'phrase');
    let dropped = 0;
    for (let i = 1; i < fg.length; i++) {
      const a = fg[i - 1].notes.filter((n) => n.v === 'p1').length, b = fg[i].notes.filter((n) => n.v === 'p1').length;
      if (b < a) dropped++;
    }
    if (dropped < 3) fail(id, 'phrases do not lose their last note on repeats');
    if (!names.includes('blank')) fail(id, 'no phrase is ever forgotten completely');
  }
  if (id === 'current') {
    if (!tags.includes('reverse') || !tags.includes('forward')) fail(id, 'phrases never play in reverse, or always do');
    const bpms = new Set(rs.map((r) => Math.round(r.bpm)));
    const secs = rs.map((r) => r.secs);
    if (Math.max(...secs) - Math.min(...secs) < 1) fail(id, `the tempo does not drift (${bpms.size} base tempos)`);
  }
  if (id === 'chasm' && !names.includes('bottom')) fail(id, 'the chasm never reaches its bottom');
  if (id === 'year' && !names.includes('rewind')) fail(id, 'the bass never decays far enough to rewind');
  if (id === 'end_accept' && !names.includes('choice')) fail(id, 'the Void never gives way to the Choice');
  if (id === 'credits' && SECONDS >= 400 && !names.includes('outro')) fail(id, 'the credits never reach the outro');
  if (id === 'guardian') {
    const first = names.slice(0, 10);
    if (first.join(',') !== 'pilgrim,unravel,void,stone,year,choice,vorn,keeper,lightbound,seer') fail(id, `motif order is ${first.join(',')}`);
  }
  if (id === 'lightbound') {
    const quarter = (r: Rendered) => r.notes.filter((n) => n.v === 'x' && Math.abs(n.n - Math.round(n.n)) > 0.2).length + r.notes.filter((n) => n.v === 'p1' && Math.abs(n.n - Math.round(n.n)) > 0.2).length;
    const early = rs.slice(0, 4).reduce((s, r) => s + quarter(r), 0), late = rs.slice(-8).reduce((s, r) => s + quarter(r), 0) / 2;
    if (late <= early) warn(id, `the corruption does not grow (${early} early, ${late} late)`);
  }
}

/** Notes the chip limits remove show where a track asks one voice for more than it can play. */
function checkLoss(id: TrackId, tint: AreaTint) {
  normStats.on = true;
  for (const v of ['p1', 'p2', 'tri', 'nz', 'x'] as Voice[]) { normStats.in[v] = 0; normStats.out[v] = 0; normStats.cut[v] = 0; }
  renderTrack(id, 240, { tint, intensity: COMBAT.includes(id) ? (t: number) => (Math.sin(t / 25) + 1) / 2 : undefined });
  normStats.on = false;
  const parts: string[] = [];
  for (const v of ['p1', 'p2', 'tri', 'x'] as Voice[]) {
    const n = normStats.in[v];
    if (n < 8) continue;
    const loss = 1 - normStats.out[v] / n;
    const cut = normStats.cut[v] / n;
    parts.push(`${v} ${(loss * 100).toFixed(0)}% lost ${(cut * 100).toFixed(0)}% cut`);
    const limit = v === 'p1' ? 0.1 : v === 'x' ? 0.2 : 0.25;
    if (loss > limit) fail(`${id}/${tint}`, `the chip limits remove ${(loss * 100).toFixed(0)}% of the ${v} notes`);
    if (cut > 0.3 && v !== 'tri') fail(`${id}/${tint}`, `the chip limits cut short ${(cut * 100).toFixed(0)}% of the ${v} notes`);
  }
  if (VERBOSE) log(`  ${id}/${tint} loss: ${parts.join(', ')}`);
}

function checkLayers(id: TrackId, tint: AreaTint) {
  const lo = notesOf(renderTrack(id, 120, { tint, intensity: () => 0 })).filter((n) => active(n, 0)).length;
  const hi = notesOf(renderTrack(id, 120, { tint, intensity: () => 1 })).filter((n) => active(n, 1)).length;
  if (hi < lo * 1.08) fail(`${id}/${tint}`, `intensity adds no layers (${lo} notes at 0, ${hi} at 1)`);
}

function checkMemory() {
  const foreign: MemLine[] = [memoryOf('year', 'year', TRACKS.year.key, 0.3), memoryOf('stone', 'spire', TRACKS.spire.key, 0.3)];
  for (const id of ['sea', 'lighthouse', 'vault', 'choice'] as TrackId[]) {
    const withMem = notesOf(renderTrack(id, 240, { recall: foreign })).filter((n) => n.v === 'x').length;
    const without = notesOf(renderTrack(id, 240, { recall: [] })).filter((n) => n.v === 'x').length;
    if (withMem <= without) fail(id, `memory chimes add nothing (${withMem} extra-voice notes with memory, ${without} without)`);
  }
}

function checkPilgrim() {
  const r = new Rng(3);
  let last = 0;
  for (let i = 0; i < PILGRIM_COUNT; i++) {
    const n = noteCount(pilgrim(i / (PILGRIM_COUNT - 0.5), r));
    if (n <= last && i > 0) fail('pilgrim', `level ${i} has ${n} notes, not more than ${last}`);
    last = n;
  }
  const lo = notesOf(renderTrack('title', 200, { prog: 0 })).filter((n) => n.v === 'p1').length;
  const hi = notesOf(renderTrack('title', 200, { prog: 1 })).filter((n) => n.v === 'p1').length;
  if (hi <= lo) fail('title', `the Pilgrim's theme does not grow with progress (${lo} notes at 0, ${hi} at 1)`);
}

function checkSfx() {
  const ids = Object.keys(SFX_DEFS) as SfxId[];
  if (ids.length !== 53) fail('sfx', `expected 53 effects, found ${ids.length}`);
  const sigs = new Map<string, SfxId>();
  for (const id of ids) {
    const d = SFX_DEFS[id];
    if (!d.length) { fail(`sfx ${id}`, 'no voices'); continue; }
    const len = sfxLength(id);
    if (len > (LONG_SFX.has(id) ? 2.0 : 1.0)) fail(`sfx ${id}`, `lasts ${len.toFixed(2)} s`);
    if (d.length > 24) fail(`sfx ${id}`, `${d.length} voices`);
    for (const v of d) {
      if (!(v.v > 0 && v.v * SFX_LEVEL <= (v.w === 'noise' ? 0.45 : 0.3))) fail(`sfx ${id}`, `voice peak ${(v.v * SFX_LEVEL).toFixed(3)}`);
      if (!(v.d > 0)) fail(`sfx ${id}`, 'a voice has no length');
      if (v.f.some((x) => !(x > 0) || x > 12000)) fail(`sfx ${id}`, 'a pitch is out of range');
      if (v.cut !== undefined && v.cut > v.d) fail(`sfx ${id}`, 'the gate is after the end');
    }
    const sig = JSON.stringify(d);
    const other = sigs.get(sig);
    if (other) fail(`sfx ${id}`, `identical to ${other}`);
    sigs.set(sig, id);
  }
  if (VERBOSE) log('  effect lengths: ' + ids.map((i) => `${i} ${sfxLength(i).toFixed(2)}`).join(', '));
}

const SCALES: Record<string, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], locrian: [0, 1, 3, 5, 6, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], pentatonic: [0, 3, 5, 7, 10],
};
const tuningFor = (root: number, mode: number[]): Tuning => ({ root, scale: mode.map((x) => (root + x) % 12) });

/** Stingers follow the key whatever it is, stay short, and duck the music. */
function checkStingers() {
  for (const id of STINGER_IDS) {
    if (!DUCKS[id]) fail('stinger ' + id, 'does not duck the music');
    for (const [name, mode] of Object.entries(SCALES)) {
      for (let root = 0; root < 12; root++) {
        const T = tuningFor(root, mode);
        const vs = stingerVoices(id, T);
        const len = vs.reduce((m, v) => Math.max(m, (v.at ?? 0) + v.d), 0);
        const where = `stinger ${id} in ${name} from ${root}`;
        if (len > (id === 'state_up' ? 1 : 2) || len < 0.3) { fail(where, `lasts ${len.toFixed(2)} s`); break; }
        if (vs.length < 4) { fail(where, 'has too few voices'); break; }
        if (vs.some((v) => v.f.some((x) => !(x > 25) || x > 12000))) { fail(where, 'has a pitch out of range'); break; }
        if (vs.some((v) => !(v.v > 0 && v.v * SFX_LEVEL <= (v.w === 'noise' ? 0.45 : 0.3)))) { fail(where, 'has a voice that is too loud'); break; }
        if (id === 'victory') {
          const lead = vs.filter((v) => v.w === 'pulse').map((v) => Math.round(ftom(v.f[0])));
          const R = lead[0];
          if (!lead.includes(R + 4) || !lead.includes(R + 7) || !lead.includes(R + 12)) { fail(where, 'is not a major arpeggio'); break; }
          if (((R % 12) + 12) % 12 !== root) { fail(where, 'does not start on the key\'s root'); break; }
        }
      }
    }
  }
  for (const [id, d] of Object.entries(DUCKS)) {
    if (!(id in SFX_DEFS)) fail('duck ' + id, 'is not an effect');
    if (!d || !(d[0] > 0 && d[0] <= 1 && d[1] >= 0 && d[1] <= 2 && d[2] > 0 && d[2] <= 2)) fail('duck ' + id, 'has a bad depth or length');
  }
  for (const [id, b] of Object.entries(BENDS)) {
    if (!(id in SFX_DEFS)) fail('bend ' + id, 'is not an effect');
    if (!b || b[0] > 400 || b[1] <= 0 || b[1] + b[2] + b[3] > 3) fail('bend ' + id, 'is too deep or too long');
  }
  // A tuned effect lands its first note on a note of the key.
  for (const id of TUNED) {
    for (const [name, mode] of Object.entries(SCALES)) {
      for (const root of [0, 2, 5, 9, 11]) {
        const T = tuningFor(root, mode);
        const vs = retune(SFX_DEFS[id], T);
        const ref = vs.find((v) => v.w !== 'noise');
        if (!ref) { fail('tuned ' + id, 'has no tonal voice'); continue; }
        const m = ftom(ref.f[0]);
        const moved = Math.abs(ftom(SFX_DEFS[id].find((v) => v.w !== 'noise')!.f[0]) - m);
        if (moved <= 7.01 && Math.abs(snapMidi(m, T) - m) > 0.05) fail('tuned ' + id, `does not land in ${name} from ${root}`);
        if (vs.some((v) => v.f.some((x) => !(x > 20) || x > 14000))) fail('tuned ' + id, 'leaves the audible range');
      }
    }
  }
  if (scaleNote(DEFAULT_TUNING, 0, 4) !== 69) fail('tuning', 'the default key does not start on A4');
}

/** A sentence typed at 35 ms a letter with a pause between words, as the dialogue box would. */
function say(voice: Parameters<typeof planBlip>[2], text: string, T: Tuning, seed = 3, mood = 0): Array<{ ch: string; v: ReturnType<typeof planBlip> }> {
  const st = newBlipState();
  let now = 1;
  const out: Array<{ ch: string; v: ReturnType<typeof planBlip> }> = [];
  for (const ch of text) {
    now += ch === ' ' ? 0.07 : 0.035;
    out.push({ ch, v: planBlip(st, now, voice, ch, seed, mood, T) });
  }
  return out;
}

function checkSpeech() {
  const A = tuningFor(9, SCALES.aeolian), D = tuningFor(2, SCALES.dorian);
  const heads = new Set<number>();
  for (const v of BLIP_VOICE_IDS) {
    for (const ch of [' ', '.', ',', '!', '?', '-', '\n', '']) if (blipVoices(v, ch, 1, 0)) fail(`blip ${v}`, `makes a sound for ${JSON.stringify(ch)}`);
    let sounded = 0;
    for (const ch of 'abcdefghijklmnopqrstuvwxyz0123456789') {
      const vs = blipVoices(v, ch, 5, 0);
      if (!vs) continue;
      sounded++;
      for (const x of vs) {
        if (!(x.v > 0.005 && x.v < 3)) fail(`blip ${v}`, `level ${x.v} for ${ch}: the leveling hit its limit`);
        if (x.at !== undefined && x.at > 0.05) fail(`blip ${v}`, 'late voice');
        if (x.d > 0.2) fail(`blip ${v}`, `lasts ${x.d}`);
        if (x.f.some((f) => !(f > 20) || f > 12000)) fail(`blip ${v}`, `pitch ${x.f}`);
        if (x.form && (x.form[0] < 100 || x.form[1] > 8000 || x.form[1] < x.form[0])) fail(`blip ${v}`, `formants ${x.form}`);
      }
    }
    if (sounded < 20) fail(`blip ${v}`, `only ${sounded} of 36 characters sound`);
    const hi = blipVoices(v, 'e', 3, 1), lo = blipVoices(v, 'e', 3, -1);
    if (hi && lo && !(hi[0].f[hi[0].f.length - 1] >= lo[0].f[lo[0].f.length - 1] && hi[0].d < lo[0].d)) fail(`blip ${v}`, 'mood does not raise the pitch and speed');
    const first = blipVoices(v, 'a', 3, 0);
    if (first) heads.add(Math.round(first[0].f[first[0].f.length - 1]));
    // Words sing notes of the music's scale and the pitch moves between words.
    for (const T of [A, D]) {
      const notes: number[] = [];
      let lastWord = '';
      for (const { ch, v: vs } of say(v, 'the quick brown fox jumps over the lazy dog and then it sleeps', T, 11)) {
        if (ch === ' ') { lastWord = ''; continue; }
        lastWord += ch;
        if (!vs || vs[0].w === 'noise') continue;
        const f = vs[0].f[vs[0].f.length - 1];
        if (notes.length === 0 || Math.abs(notes[notes.length - 1] - f) > 0.5) notes.push(f);
      }
      const pcs = notes.map((f) => ((Math.round(ftom(f)) % 12) + 12) % 12);
      const inKey = pcs.filter((p) => T.scale.includes(p)).length;
      const tuned = v !== 'null' && v !== 'paper';
      if (tuned && inKey < pcs.length * 0.95) fail(`blip ${v}`, `only ${inKey} of ${pcs.length} word notes are in the key`);
      if (v !== 'paper' && new Set(notes.map((x) => Math.round(x))).size < 3) fail(`blip ${v}`, 'the pitch hardly moves from word to word');
    }
  }
  if (heads.size < 11) fail('blip', `only ${heads.size} of ${BLIP_VOICE_IDS.length} voices differ in pitch`);
  const a = blipVoices('npc', 'e', 1, 0), b = blipVoices('npc', 'e', 2, 0), c = blipVoices('npc', 'e', 77, 0);
  if (a && b && c && a[0].f[0] === b[0].f[0] && b[0].f[0] === c[0].f[0]) fail('blip npc', 'the voice does not vary by seed');
  // A voice shaped by vowels sounds different on a, e, and i.
  const forms = new Set(['a', 'e', 'i', 'o', 'u'].map((ch) => blipVoices('seer', ch, 1, 0)?.[0].form?.join(',')));
  if (forms.size < 5) fail('blip seer', 'the vowels share formants');
}

function checkApi() {
  const ids = TRACK_IDS as string[];
  if (ids.length !== 32) fail('api', `expected 32 tracks, found ${ids.length}`);
  const run = (label: string, f: () => void) => { try { f(); } catch (e) { fail(`api ${label}`, String(e)); } };
  for (const key of ['unlockAudio', 'setMuted', 'isMuted', 'playMusic', 'stopMusic', 'setIntensity', 'setWarp', 'sfx', 'blip', 'setProgress', 'battleCue']) {
    if (typeof (audio as Record<string, unknown>)[key] !== 'function') fail('api', `${key} is missing`);
  }
  run('unlock', () => audio.unlockAudio());
  run('mute', () => { audio.setMuted(true); if (!audio.isMuted()) throw new Error('isMuted is false after setMuted(true)'); audio.setMuted(false); });
  run('music', () => {
    for (const id of TRACK_IDS) audio.playMusic(id);
    for (const t of TINTS) audio.playMusic('battle', { tint: t, fade: 0.2 });
    audio.playMusic('boss', { tint: 'stone' });
    audio.playMusic('boss', { tint: 'nope' as AreaTint, fade: NaN });
    audio.setIntensity(0.5); audio.setIntensity(NaN); audio.setWarp(2); audio.setWarp(-1); audio.setProgress(0.4);
    audio.stopMusic(); audio.stopMusic(0);
  });
  run('sfx', () => { for (const id of Object.keys(SFX_DEFS) as SfxId[]) { audio.sfx(id); audio.sfx(id, { pitch: 1.3, pan: -0.5 }); } audio.sfx('nope' as SfxId); });
  run('blip', () => { for (const v of BLIP_VOICE_IDS) { audio.blip(v, 'a'); audio.blip(v, ' '); audio.blip(v, 'Z', 3, 0.5); } audio.blip('nope' as VoiceId, 'a'); audio.blip('npc', ''); });
  run('muted calls', () => { audio.setMuted(true); audio.sfx('hit'); audio.blip('npc', 'a'); audio.setMuted(false); });
  run('battle cues', () => {
    for (const [c, o] of CUES) audio.battleCue(c, o);
    audio.battleCue('nope' as BattleCue);
    audio.battleCue('absorb', { emotion: 'nope', amount: NaN, phase: -3, foes: Infinity });
  });
}

// ---------------------------------------------------------------- the conductor: fights and transitions

/** Every cue once, in an order a fight could send them. */
const CUES: Array<[BattleCue, BattleCueOpts?]> = [
  ['start', { foes: 3, frac: 0.6 }], ['round', { frac: 0.6 }], ['strip'], ['layer_off', { layer: 'shell' }], ['hurt', { amount: 8 }],
  ['extract_memory'], ['layer_off', { layer: 'memory' }], ['extract_emotion'], ['layer_off', { layer: 'emotion' }], ['extract_name'],
  ['layer_off', { layer: 'name' }], ['absorb', { emotion: 'rage', layer: 'emotion' }], ['weave'], ['unmake'], ['foe_down', { foes: 2 }],
  ['calm', { foes: 1 }], ['miss'], ['heal', { amount: 12 }], ['overload', { frac: 0.85 }], ['faded', { frac: 0.15 }], ['steady', { frac: 0.5 }],
  ['phase', { phase: 2 }], ['reality_break'], ['vorn'], ['lb'], ['sense'], ['end', { won: true }],
];

/** A scripted fight: a cue list at times in seconds after the battle track starts. */
const FIGHT_SCRIPT: Array<[number, BattleCue, BattleCueOpts?]> = [
  [0.2, 'start', { foes: 4, frac: 0.6 }],
  [3, 'round'], [4, 'strip'], [5, 'layer_off', { layer: 'shell' }], [5.5, 'hurt', { amount: 8 }],
  [9, 'round'], [10, 'extract_memory'], [11, 'layer_off', { layer: 'memory' }], [11.5, 'vorn'],
  [15, 'round'], [16, 'extract_emotion'], [17, 'layer_off', { layer: 'emotion' }], [17.5, 'miss'],
  [21, 'round'], [22, 'absorb', { emotion: 'rage', layer: 'emotion' }], [23, 'lb'],
  [27, 'round'], [28, 'extract_name'], [29, 'layer_off', { layer: 'name' }], [29.5, 'foe_down', { foes: 3 }],
  [33, 'round'], [34, 'weave'], [35, 'heal', { amount: 12 }],
  [39, 'round'], [40, 'strip'], [41, 'layer_off', { layer: 'shell' }], [41.5, 'overload', { frac: 0.85 }],
  [45, 'round'], [46, 'unmake'], [47.5, 'reality_break'],
  [51, 'round'], [52, 'sense'], [53, 'steady', { frac: 0.5 }],
  [57, 'round'], [58, 'phase', { phase: 2 }], [60, 'calm', { foes: 2 }],
  [63, 'round'], [64, 'extract_emotion'], [65, 'layer_off', { layer: 'emotion' }], [66, 'faded', { frac: 0.15 }],
  [69, 'round'], [70, 'extract_memory'], [71, 'layer_off', { layer: 'memory' }],
  [75, 'round'], [76, 'steady', { frac: 0.5 }], [77, 'foe_down', { foes: 1 }],
  [81, 'round'], [82, 'extract_name'], [83, 'layer_off', { layer: 'name' }],
];
const FIGHT_LEN = 88;

/** How loud a recorded note is at a time after it starts, roughly following its envelope. */
function envAt(n: SimNote, u: number): number {
  if (u < 0 || u > n.dur) return 0;
  if (n.v === 'nz') {
    const k = n.nz ?? 'hat';
    if (k === 'rumble' || k === 'hush' || k === 'steam' || k === 'sweep' || k === 'rush') return Math.min(1, u / Math.max(0.05, n.a ?? n.dur * 0.4));
    return Math.exp(-u / (k === 'kick' || k === 'tom' || k === 'drip' ? 0.08 : k === 'snare' || k === 'clap' || k === 'stamp' ? 0.06 : 0.02));
  }
  if (n.v === 'x') {
    if (n.rev) return Math.exp((u - n.dur) / 0.3);
    if (n.sus) return 0.9 * Math.min(1, u / Math.max(0.05, n.a ?? 0.25));
    return Math.exp(-u / 0.4);
  }
  if (n.v === 'tri') return 1;
  return u < 0.05 ? 1 : n.hold;
}

/** The summed power of all notes at 20 points a second, from a to b. */
function powerSeries(notes: SimNote[], a: number, b: number): Float64Array {
  const step = 0.05, n = Math.max(1, Math.ceil((b - a) / step));
  const out = new Float64Array(n);
  for (const x of notes) {
    if (x.at > b || x.at + x.dur < a) continue;
    const i0 = Math.max(0, Math.ceil((x.at - a) / step)), i1 = Math.min(n - 1, Math.floor((x.at + x.dur - a) / step));
    for (let i = i0; i <= i1; i++) { const e = envAt(x, a + i * step - x.at) * x.w; out[i] += e * e; }
  }
  return out;
}

const dB = (p: number): number => (p > 1e-12 ? 10 * Math.log10(p) : -120);
function meanDb(s: Float64Array, a: number, i0: number, i1: number): number {
  let sum = 0, n = 0;
  for (let i = Math.max(0, i0); i < Math.min(s.length, i1); i++) { sum += s[i]; n++; }
  return dB(n ? sum / n : 0);
}

/** Where the last silence that longestSilence measured began. */
let silenceFrom = 0;

/** The longest stretch from a to b with no note sounding at all. */
function longestSilence(notes: SimNote[], a: number, b: number): number {
  const spans = notes.filter((n) => n.at < b && n.at + n.dur > a).map((n) => [n.at, n.at + n.dur] as const).sort((x, y) => x[0] - y[0]);
  let reach = a, worst = 0;
  silenceFrom = a;
  for (const [s, e] of spans) { if (s - reach > worst) { worst = s - reach; silenceFrom = reach; } reach = Math.max(reach, e); }
  if (b - reach > worst) { worst = b - reach; silenceFrom = reach; }
  return worst;
}

/** The chip's limits on recorded notes: one note at a time on each mono voice, two on the extra voice, and the summed level. */
function chipLimits(where: string, notes: SimNote[], a: number, b: number) {
  const ns = notes.filter((n) => n.at < b && n.at + n.dur > a);
  for (const v of ['p1', 'p2', 'tri', 'nz', 'x'] as Voice[]) {
    const ev: Array<[number, number]> = [];
    for (const n of ns) if (n.v === v) ev.push([n.at + 0.012, 1], [n.at + n.dur - 0.012, -1]);
    ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let c = 0, pk = 0, at = 0;
    for (const e of ev) { c += e[1]; if (c > pk) { pk = c; at = e[0]; } }
    if (pk > (v === 'x' ? X_POLY : 1)) { fail(where, `${v} has ${pk} notes sounding at once at ${at.toFixed(2)} s`); return; }
  }
  for (const n of ns) {
    const r = RANGE[n.v];
    if (n.n < r[0] || n.n > r[1]) { fail(where, `a ${n.v} note ${n.n.toFixed(1)} is outside ${r[0]} to ${r[1]}`); return; }
    if (!(n.g > 0 && n.g <= 1) || !(n.dur > 0)) { fail(where, `a ${n.v} note has gain ${n.g} and length ${n.dur}`); return; }
  }
  const load = peakLoad(ns, 1);
  if (load > 1.1) fail(where, `the summed note level reaches ${load.toFixed(2)}`);
}

interface Step { t: number; play?: [TrackId, AreaTint?]; stop?: true; cue?: [BattleCue, BattleCueOpts?] }

/** Runs a script of calls on an offline conductor and returns what it played. */
function simulate(steps: Step[], until: number, seed: number, intensity = 0.4): { notes: SimNote[]; melts: Melt[]; heard: number; c: Conductor } {
  const s = offline(seed);
  s.c.intensity = intensity;
  let heard = 0;
  for (const st of [...steps].sort((a, b) => a.t - b.t)) {
    s.run(st.t);
    if (st.play) s.c.play(st.play[0], st.play[1]);
    if (st.stop) s.c.stop();
    if (st.cue) { s.c.cue(st.cue[0], st.cue[1]); heard = Math.max(heard, s.c.fight?.heard ?? 0); }
  }
  s.run(until);
  return { notes: s.sink.notes, melts: s.c.melts, heard, c: s.c };
}

const pcOf = (n: number): number => ((Math.round(n) % 12) + 12) % 12;
const pitched = (n: SimNote) => n.v !== 'nz' && Math.abs(n.n - Math.round(n.n)) < 0.2;

/** The share of a fight's pitched notes, by length, that fall outside the key the fight is in at that moment. */
function outOfKey(r: { notes: SimNote[]; c: Conductor }, id: TrackId, a: number, b: number, only?: (n: SimNote) => boolean): { share: number; worst: SimNote | null } {
  const p = r.c.players.find((x) => x.id === id && x.fight);
  if (!p || !p.fight) return { share: 0, worst: null };
  let out = 0, all = 0, worst: SimNote | null = null;
  for (const n of r.notes) {
    if (n.track !== id || n.at < a || n.at >= b || !pitched(n) || (only && !only(n))) continue;
    // Play off the grid can move a note a few milliseconds across a change of key, so either side counts.
    const inKey = (t: number) => p.fight!.keyAt(r.c.beatAt(p, t)).scale.includes(pcOf(n.n));
    all += n.dur;
    if (!inKey(n.at - 0.03) && !inKey(n.at + 0.03)) { out += n.dur; worst = worst ?? n; }
  }
  return { share: all ? out / all : 0, worst };
}

const pcHist = (ns: SimNote[]): number[] => {
  const h = new Array<number>(12).fill(0);
  let tot = 0;
  for (const n of ns) if (n.v !== 'nz') { h[((Math.round(n.n) % 12) + 12) % 12] += n.dur; tot += n.dur; }
  return h.map((x) => x / Math.max(1e-9, tot));
};
const tvd = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / 2;
const METAL_KINDS = new Set(['tick', 'tock', 'gear', 'type', 'hat', 'drip', 'clap', 'stamp']);

/** Five of a cue in one moment give one musical answer, not five. */
function checkBurst(id: TrackId, tint: AreaTint, seed: number) {
  const where = `burst ${id}/${tint}`;
  const T = 6, at = T + 10;
  const steps: Step[] = [{ t: 0, play: ['plaza'] }, { t: T, play: [id, tint] }, { t: T + 0.2, cue: ['start', { foes: 6 }] }];
  for (let i = 0; i < 5; i++) {
    const t = at + i * 0.06;
    steps.push({ t, cue: ['layer_off', { layer: 'shell' }] }, { t: t + 0.01, cue: ['hurt', { amount: 9 }] }, { t: t + 0.02, cue: ['foe_down', { foes: 5 - i }] }, { t: t + 0.03, cue: ['lb'] }, { t: t + 0.04, cue: ['vorn'] });
  }
  const r = simulate(steps, at + 8, seed);
  const added = r.notes.filter((n) => n.inj === 2 && n.at >= at && n.at < at + 6);
  const cracks = added.filter((n) => n.nz === 'crack').length;
  const tolls = added.filter((n) => n.v === 'x' && n.g >= 0.15).length;
  const vorn = added.filter((n) => n.v === 'tri').length;
  if (cracks > 1) fail(where, `five stripped shells crack ${cracks} times`);
  if (tolls > 1) fail(where, `five fallen foes toll ${tolls} times`);
  if (vorn > 6) fail(where, `five Vorn actions play ${vorn} bass notes`);
  chipLimits(where, r.notes, at, at + 8);
}

/** Runs the scripted fight on a battle track, and the same fight with no cues, and checks the music stays legal and changes. */
function checkFight(id: TrackId, tint: AreaTint, seed: number) {
  const where = `fight ${id}/${tint}`;
  const field: TrackId = tint === 'sea' ? 'reef' : tint === 'year' ? 'factory' : tint === 'stone' || tint === 'void' ? 'vault' : 'plaza';
  const T = 6;
  const base: Step[] = [{ t: 0, play: [field] }, { t: T, play: [id, tint] }];
  const cued = simulate([...base, ...FIGHT_SCRIPT.map(([t, c, o]): Step => ({ t: T + t, cue: [c, o] }))], T + FIGHT_LEN + 4, seed);
  const plain = simulate([...base, { t: T + 0.2, cue: ['start', { foes: 4 }] }], T + FIGHT_LEN + 4, seed);
  if (cued.heard < FIGHT_SCRIPT.length) fail(where, `the fight heard ${cued.heard} of ${FIGHT_SCRIPT.length} cues`);
  chipLimits(where, cued.notes, T, T + FIGHT_LEN);
  const inFight = (ns: SimNote[], a: number, b: number) => ns.filter((n) => n.track === id && n.at >= T + a && n.at < T + b);
  // The same notes with and without the cues, compared note by note.
  const sig = (n: SimNote) => `${n.v}${Math.round(n.n)}${n.nz ?? ''}@${Math.round(n.at * 8)}`;
  const a = new Set(inFight(plain.notes, 10, FIGHT_LEN).map(sig)), b = inFight(cued.notes, 10, FIGHT_LEN).map(sig);
  const shared = b.filter((x) => a.has(x)).length / Math.max(1, Math.max(a.size, b.length));
  if (shared > 0.75) fail(where, `the cues change only ${((1 - shared) * 100).toFixed(0)}% of the notes`);
  // The key moves: late in the fight its pitch classes differ from those of the same fight without cues.
  const drift = tvd(pcHist(inFight(cued.notes, 60, 86)), pcHist(inFight(plain.notes, 60, 86)));
  if (drift < 0.15) fail(where, `the harmony late in the fight is only ${drift.toFixed(2)} away from the fight without cues`);
  // Stripped shells thin the metal percussion.
  const metal = (ns: SimNote[]) => ns.filter((n) => n.v === 'nz' && METAL_KINDS.has(n.nz ?? '')).length;
  const m0 = metal(inFight(plain.notes, 46, 86)), m1 = metal(inFight(cued.notes, 46, 86));
  if (m0 >= 20 && m1 > m0 * 0.8) fail(where, `stripped shells leave the metal percussion at ${m1} hits against ${m0}`);
  // Extracted memories bring back reversed memory chimes.
  const rev = inFight(cued.notes, 11, FIGHT_LEN).filter((n) => n.v === 'x' && n.rev).length;
  if (rev < 4) fail(where, `extracted memories bring back ${rev} memory chimes`);
  // An absorbed emotion colors the lead.
  if (!inFight(cued.notes, 22, 40).some((n) => n.v === 'p1' && n.dw !== undefined)) fail(where, 'the absorbed emotion never colors the lead');
  // A sparse track's sections hold long rests, and a boss phase can move it to one.
  const gap0 = longestSilence(plain.notes, T + 2, T + FIGHT_LEN), gap = longestSilence(cued.notes, T + 2, T + FIGHT_LEN);
  if (gap > Math.max(SPARSE.has(id) ? 12 : 1.2, gap0 + 0.5)) fail(where, `the fight falls silent for ${gap.toFixed(2)} s at ${silenceFrom.toFixed(1)} s, against ${gap0.toFixed(2)} s without cues`);
  // Added notes take the place of others, so the fight is never louder than the plain one by more than a little.
  const ps = powerSeries(cued.notes, T + 2, T + FIGHT_LEN), p0 = powerSeries(plain.notes, T + 2, T + FIGHT_LEN);
  const top = (s: Float64Array) => { let m = -120; for (let i = 0; i + 40 <= s.length; i += 10) m = Math.max(m, meanDb(s, 0, i, i + 40)); return m; };
  if (top(ps) > top(p0) + 3) fail(where, `the loudest 2 s are ${(top(ps) - top(p0)).toFixed(1)} dB over the plain fight`);
  // The fight ends on a held chord and the field track grows out of it.
  const end = simulate([...base, { t: T + 0.2, cue: ['start', { foes: 2 }] }, { t: T + 20, cue: ['end', { won: true }] }, { t: T + 24, play: [field] }], T + 50, seed);
  const lost = simulate([...base, { t: T + 0.2, cue: ['start', { foes: 2 }] }, { t: T + 20, cue: ['end', { won: false }] }, { t: T + 24, play: [field] }], T + 50, seed);
  for (const [label, r] of [['won', end], ['lost', lost]] as const) {
    const w = `${where} ${label}`;
    if (r.melts.length < 3 || r.melts[1].mode !== 'out') { fail(w, 'the end of the fight does not wind down into a drone'); continue; }
    chipLimits(w, r.notes, T + 18, T + 50);
    const g2 = longestSilence(r.notes, T + 18, T + 45);
    if (g2 > 1.2) fail(w, `the music falls silent for ${g2.toFixed(2)} s at ${silenceFrom.toFixed(1)} s between the fight and the field`);
  }
  // Every note the fight adds keeps to the fight's key, and the cues never add notes outside the key the music did not already play.
  const added = outOfKey(cued, id, T, T + FIGHT_LEN, (n) => n.inj === 2);
  if (added.share > 0) fail(where, `${(added.share * 100).toFixed(1)}% of the notes the fight adds leave the key, first a ${added.worst?.v} ${added.worst?.n} at ${added.worst?.at.toFixed(2)} s`);
  const ok1 = outOfKey(cued, id, T + 2, T + FIGHT_LEN).share, ok0 = outOfKey(plain, id, T + 2, T + FIGHT_LEN).share;
  // The Stone sours Light-Bound's tune a little more on every pass, and a boss phase starts a pass early, so its share wanders more.
  if (ok1 > ok0 + (id === 'lightbound' ? 0.05 : 0.02)) fail(where, `${(ok1 * 100).toFixed(1)}% of the fight's notes leave the key, against ${(ok0 * 100).toFixed(1)}% without cues`);
  if (VERBOSE) log(`  ${where}: ${((1 - shared) * 100).toFixed(0)}% of notes changed, harmony moved ${drift.toFixed(2)}, metal ${m1}/${m0}, ${rev} chimes, out of key ${(ok1 * 100).toFixed(1)}% (${(ok0 * 100).toFixed(1)}% plain), longest gap ${gap.toFixed(2)} s`);
}

/** The quietest and loudest 2 s windows from a to b, in steps of half a second. */
function levelRange(notes: SimNote[], a: number, b: number): { lo: number; hi: number; loAt: number; hiAt: number } {
  const s = powerSeries(notes, a, Math.max(b, a + 2));
  let lo = Infinity, hi = -Infinity, loAt = a, hiAt = a;
  for (let i = 0; i === 0 || i + 40 <= s.length; i += 10) {
    const d = meanDb(s, 0, i, i + 40);
    if (d < lo) { lo = d; loAt = a + i * 0.05; }
    if (d > hi) { hi = d; hiAt = a + i * 0.05; }
  }
  return { lo, hi, loAt, hiAt };
}

/**
 * Checks one transition: the chip's limits while two tracks share it, no silence, and a level that stays inside the range the
 * two tracks reach on their own over the same stretch, give or take a few decibels.
 */
function checkMelt(where: string, r: { notes: SimNote[] }, m: Melt, ref: { lo: number; hi: number }) {
  chipLimits(where, r.notes, m.t0 - 1, m.t1 + 2);
  // One key at a time: every note that starts inside the transition keeps to the notes both tracks share. Notes within 20 ms of either edge belong to the track on that side, since play off the grid can move them across.
  const set = new Set([...(m.pivot ?? []), ...(m.chord ?? [])]);
  const stray = r.notes.filter((n) => n.at >= m.t0 + 0.02 && n.at < m.t1 - 0.02 && pitched(n) && !set.has(pcOf(n.n)));
  if (set.size && stray.length) fail(where, `${stray.length} notes leave the shared pitches during the change, first a ${stray[0].v} ${stray[0].n} at ${stray[0].at.toFixed(2)} s`);
  const gap = longestSilence(r.notes, m.t0, m.t1 + 1);
  if (gap > 1.0) fail(where, `the music falls silent for ${gap.toFixed(2)} s at ${silenceFrom.toFixed(1)} s during the change`);
  const w = levelRange(r.notes, m.t0, m.t1);
  if (w.lo < ref.lo - MELT_TOL.dip) fail(where, `the level dips to ${w.lo.toFixed(1)} dB at ${w.loAt.toFixed(1)} s where the tracks alone reach ${ref.lo.toFixed(1)} to ${ref.hi.toFixed(1)}`);
  if (w.hi > ref.hi + MELT_TOL.spike) fail(where, `the level rises to ${w.hi.toFixed(1)} dB at ${w.hiAt.toFixed(1)} s where the tracks alone reach ${ref.lo.toFixed(1)} to ${ref.hi.toFixed(1)}`);
  if (VERBOSE) log(`  ${where}: ${m.mode} over ${(m.t1 - m.t0).toFixed(1)} s (${m.beats} beats, k ${m.k}), alone ${ref.lo.toFixed(1)} to ${ref.hi.toFixed(1)} dB, during ${w.lo.toFixed(1)} to ${w.hi.toFixed(1)}, longest gap ${gap.toFixed(2)} s`);
}

const AREAS: Array<[AreaTint, TrackId[]]> = [
  ['brass', ['plaza', 'tower', 'library', 'gardens']],
  ['sea', ['ship', 'lighthouse', 'reef', 'current', 'archive']],
  ['year', ['year', 'factory', 'storyteller', 'chasm']],
  ['stone', ['spire', 'vault', 'void', 'choice']],
];
/** How far a transition's level may leave the range of its two tracks, in decibels. */
const MELT_TOL = { dip: 3, spike: 3 };

/** How long the new track takes on its own to play the beats a transition spans. */
const freshSpan = (id: TrackId, m: Melt): number => Math.max(m.t1 - m.t0, (m.beats * m.k * 60) / TRACKS[id].bpm);
const both = (x: { lo: number; hi: number }, y: { lo: number; hi: number }) => ({ lo: Math.min(x.lo, y.lo), hi: Math.max(x.hi, y.hi) });
/** The conductor seed whose first track gets the seed the nth track of a run started at `seed` gets, so a track can be heard alone exactly as it plays in the run. */
function nthSeed(seed: number, n: number): number {
  let x = seed;
  for (let i = 1; i < n; i++) x = (Math.imul(x, 1103515245) + 12345) >>> 0;
  return x;
}

/** Every change of track the game makes, each from two points in the old track. */
function checkTransitions() {
  const pairs: Array<[TrackId, AreaTint | undefined, TrackId, AreaTint | undefined, string]> = [];
  for (const [, ids] of AREAS) for (const a of ids) for (const b of ids) if (a !== b) pairs.push([a, undefined, b, undefined, 'map']);
  for (let i = 0; i < AREAS.length; i++) {
    const [, x] = AREAS[i], [, y] = AREAS[(i + 1) % AREAS.length];
    pairs.push([x[x.length - 1], undefined, y[0], undefined, 'map'], [y[0], undefined, x[x.length - 1], undefined, 'map']);
  }
  pairs.push(['title', undefined, 'plaza', undefined, 'map']);
  for (const [a, b] of [['plaza', 'seer'], ['seer', 'plaza'], ['archive', 'seer'], ['seer', 'ship'], ['chasm', 'escape'], ['escape', 'current'], ['choice', 'seer'], ['end_restore', 'credits'], ['end_accept', 'credits'], ['end_escape', 'credits']] as Array<[TrackId, TrackId]>) pairs.push([a, undefined, b, undefined, 'story']);
  for (const [tint, ids] of AREAS) for (const a of ids) { pairs.push([a, undefined, 'battle', tint, 'fight']); pairs.push([a, undefined, 'miniboss', tint, 'fight']); }
  for (const [a, b, t] of [['plaza', 'boss', 'brass'], ['archive', 'keeper', undefined], ['chasm', 'despair', undefined], ['vault', 'lightbound', undefined], ['seer', 'guardian', undefined]] as Array<[TrackId, TrackId, AreaTint | undefined]>) pairs.push([a, undefined, b, t, 'fight']);
  for (const [tint, ids] of AREAS) for (const b of ids) pairs.push(['battle', tint, b, undefined, 'field']);
  for (const [a, t, b] of [['boss', 'brass', 'plaza'], ['keeper', undefined, 'archive'], ['despair', undefined, 'chasm'], ['lightbound', undefined, 'vault'], ['miniboss', 'stone', 'void']] as Array<[TrackId, AreaTint | undefined, TrackId]>) pairs.push([a, t, b, undefined, 'field']);
  let n = 0;
  for (const [a, ta, b, tb, kind] of pairs) {
    for (const at of [9, 14.3]) {
      const seed = 5 + SEED0 * 1000 + n++;
      const r = simulate([{ t: 0, play: [a, ta] }, { t: at, play: [b, tb] }], at + 30, seed);
      const m = r.melts[r.melts.length - 1];
      const where = `${kind} ${a}${ta ? ':' + ta : ''} to ${b}${tb ? ':' + tb : ''} at ${at}`;
      if (!m) { fail(where, 'no transition happened'); continue; }
      const alone = simulate([{ t: 0, play: [a, ta] }], at + 30, seed);
      const fresh = simulate([{ t: 0, play: [b, tb] }], 40, nthSeed(seed, 2));
      checkMelt(where, r, m, both(levelRange(alone.notes, m.t0 - 1, m.t1 + 1), levelRange(fresh.notes, 0.06, 1.06 + freshSpan(b, m))));
      if (FIGHT_TRACKS.has(b) && !FIGHT_TRACKS.has(a) && m.t1 - m.t0 > 2.7) fail(where, `the fight takes ${(m.t1 - m.t0).toFixed(2)} s to arrive`);
    }
  }
  // After a fight: the groove winds down on the beat, holds, and the field track grows out of it.
  for (const [tint, ids] of AREAS) {
    for (const b of ids) {
      const seed = 70 + SEED0 * 1000 + n++;
      const r = simulate([{ t: 0, play: [ids[0]] }, { t: 6, play: ['battle', tint] }, { t: 6.2, cue: ['start', { foes: 2 }] }, { t: 20, cue: ['end', { won: true }] }, { t: 22.5, play: [b] }], 50, seed);
      const [, out, back] = r.melts;
      const where = `fight end battle:${tint} to ${b}`;
      if (!out || !back || out.mode !== 'out') { fail(where, 'the fight does not wind down'); continue; }
      if (out.t1 - out.t0 > 3.5) fail(where, `the wind-down takes ${(out.t1 - out.t0).toFixed(2)} s`);
      const drone = levelRange(r.notes, out.t1 + 0.5, back.t0);
      checkMelt(where + ' (wind-down)', r, out, both(levelRange(r.notes, out.t0 - 6, out.t0), drone));
      const fresh = simulate([{ t: 0, play: [b] }], 30, nthSeed(seed, 4));
      checkMelt(where, r, back, both(drone, levelRange(fresh.notes, 0.06, 1.06 + freshSpan(b, back))));
    }
  }
  // The music stops before an ending, holds a drone, and the ending grows out of it.
  for (const e of ['end_restore', 'end_accept', 'end_escape'] as TrackId[]) {
    const seed = 90 + SEED0 * 1000 + n++;
    const r = simulate([{ t: 0, play: ['guardian'] }, { t: 12, stop: true }, { t: 17, play: [e] }], 50, seed);
    const where = `stop guardian to ${e} (seed ${seed})`;
    const [stop, grow] = r.melts;
    if (!stop || !grow || stop.mode !== 'stop') { fail(where, 'the stop does not dissolve into a drone'); continue; }
    const drone = levelRange(r.notes, stop.t1 + 0.5, grow.t0);
    checkMelt(where + ' (dissolve)', r, stop, both(levelRange(r.notes, stop.t0 - 6, stop.t0), drone));
    const fresh = simulate([{ t: 0, play: [e] }], 30, nthSeed(seed, 3));
    checkMelt(where, r, grow, both(drone, levelRange(fresh.notes, 0.06, 1.06 + freshSpan(e, grow))));
  }
  // Changes that come before the last one has finished.
  const quick = simulate([{ t: 0, play: ['plaza'] }, { t: 9, play: ['tower'] }, { t: 10.5, play: ['library'] }, { t: 11, play: ['battle', 'brass'] }, { t: 12, cue: ['start', { foes: 2 }] }, { t: 14, cue: ['end', { won: true }] }, { t: 14.6, play: ['gardens'] }], 45, 99 + SEED0);
  chipLimits('quick changes', quick.notes, 0, 45);
  const qg = longestSilence(quick.notes, 1, 40);
  if (qg > 1.2) fail('quick changes', `the music falls silent for ${qg.toFixed(2)} s`);
  if (VERBOSE) log(`  checked ${n} transition runs`);
}

function checkNormalize() {
  const base = { t: 0, d: 4, g: 0.5, n: 60 };
  const sec = { beats: 4, ev: [{ ...base, v: 'p1' as Voice }, { ...base, t: 1, v: 'p1' as Voice }, { ...base, v: 'x' as Voice }, { ...base, t: 0.5, v: 'x' as Voice }, { ...base, t: 1, v: 'x' as Voice }] };
  const out = normalize(sec);
  const p1 = out.filter((e) => e.v === 'p1').sort((a, b) => a.t - b.t);
  if (p1[0].t + p1[0].d > p1[1].t) fail('normalize', 'two p1 notes overlap');
}

function main() {
  const t0 = Date.now();
  log(`Checking ${TRACK_IDS.length} tracks, ${SECONDS} s each.`);
  for (const id of TRACK_IDS) {
    const tints: AreaTint[] = TINTED.includes(id) ? TINTS : [TRACKS[id].tint];
    for (const tint of tints) {
      for (const seed of [1 + SEED0, 2 + SEED0, 3 + SEED0]) {
        const secs = seed === 1 + SEED0 ? SECONDS : Math.min(SECONDS, 240);
        // Combat tracks are checked while intensity sweeps up and down, so every layer plays.
        const intensity = COMBAT.includes(id) ? (t: number) => (Math.sin(t / 25) + 1) / 2 : undefined;
        const rs = renderTrack(id, secs, { seed, tint, intensity, prog: seed === 1 + SEED0 ? 0.3 : seed === 2 + SEED0 ? 0 : 1 });
        checkRender(id, tint, rs, seed, secs);
        if (seed === 1 + SEED0 && tint === TRACKS[id].tint) checkSpecial(id, rs);
      }
      checkLoss(id, tint);
      if (COMBAT.includes(id) && id !== 'escape') checkLayers(id, tint);
    }
    if (!PALETTES[TRACKS[id].tint]) fail(id, 'the default tint has no palette');
  }
  let fs = 0;
  for (const id of TRACK_IDS) {
    if (!FIGHT_TRACKS.has(id)) continue;
    for (const tint of TINTED.includes(id) ? TINTS : [TRACKS[id].tint]) checkFight(id, tint, 31 + SEED0 + fs++);
    checkBurst(id, TINTED.includes(id) ? 'brass' : TRACKS[id].tint, 61 + SEED0 + fs);
  }
  checkTransitions();
  checkMemory();
  checkPilgrim();
  checkSfx();
  checkStingers();
  checkSpeech();
  checkNormalize();
  checkApi();
  for (const w of warnings) log(`warning: ${w}`);
  if (failures.length) {
    for (const f of failures) log(`FAIL ${f}`);
    log(`${failures.length} failures in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
    proc?.exit(1);
  } else log(`All checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s with ${warnings.length} warnings.`);
}

main();
