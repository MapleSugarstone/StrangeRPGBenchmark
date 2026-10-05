import type { Jingle, Motif, Style } from '../core/compose';

// The hold-music leitmotif, as scale degrees under the tonic: sol mi fa sol do ti la sol.
export const LEIT: Motif = { r: [[0, 3], [3, 1], [4, 2], [6, 2], [8, 6], [14, 2], [16, 4], [20, 8]], d: [0, -2, -1, 0, 3, 2, 1, 0], s0: -3 };

const VAMP = {
  lead: 'G5 - - - E5 - - - A5 - - - - - - . | G5 - - - E5 - C5 - D5 - - - - - - .',
  harm: 'E5 . G5 . C6 . G5 . F5 . A5 . C6 . A5 . | E5 . G5 . C6 . G5 . D5 . G5 . B5 . G5 .',
  bass: 'C3 - - - - - - - F2 - - - - - - - | C3 - - - - - - - G2 - - - - - - -',
  drum: 'k . . . h . . . k . . . h . . . | k . . . h . . . k . . . h . s .',
};
const win = (lead: string, harm: string, bass: string, drum: string): Jingle => ({
  bpm: 140, loop: 3, duty: [1, 0], echo: true,
  lead: `${lead} | ${VAMP.lead}`, harm: `${harm} | ${VAMP.harm}`, bass: `${bass} | ${VAMP.bass}`, drum: `${drum} | ${VAMP.drum}`,
});

export const MUSIC: Record<string, Style> = {
  title: {
    bpm: 84, key: 'F', scale: 'major', theme: 'leit', density: 0.4,
    prog: 'I>vi IV ii iii, vi>IV ii, IV>V I ii, ii>V, V>I vi, iii>vi IV',
    progA: 'I vi IV V I vi ii V',
    form: ['A:lh', 'A:lhbe', 'B:lhbd', 'A:lhbde'],
    bass: 'half/arp', harm: 'arp16/pad', duty: [2, 0], vib: 14,
    drums: { k: '9.......5.......', h: '....4.......4...' },
  },
  intro: {
    bpm: 70, key: 'C', scale: 'major', density: 0, prog: 'I>I', form: ['A'],
    jingle: [{
      bpm: 70, loop: 0, duty: [2, 0], echo: true,
      lead: 'E5 - - - - - - - - - - - D5 - - - | C5 - - - - - - - - - - - . . . . | A4 - - - - - - - C5 - - - - - - - | B4 - - - - - - - - - - - . . . .',
      harm: 'C6 . G5 . E5 . G5 . C5 . G4 . E4 . G4 . | A5 . E5 . C5 . E5 . A4 . E4 . C4 . E4 . | F5 . C5 . A4 . C5 . F4 . C4 . A3 . C4 . | G5 . D5 . B4 . D5 . G4 . D4 . B3 . D4 .',
      bass: 'C3 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - - | F2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - -',
    }],
  },
  town: {
    bpm: 108, key: 'C', scale: 'major', density: 0.55,
    prog: 'I>IV V vi ii, IV>V I ii, V>I vi, vi>IV ii, ii>V, iii>vi',
    form: ['A:lbd', 'A:lbhd', 'B:lbhde', 'A:lbhd'],
    bass: 'bounce/walk', harm: 'third/stab', duty: [1, 0],
    drums: { k: '9.......9.......', s: '....9.......9...', h: '5.3.5.3.5.3.5.3.' },
    leit: { at: 'B', slot: 2, p: 0.7, fx: 'hx' },
  },
  field: {
    bpm: 120, key: 'D', scale: 'dorian', density: 0.55, phrase: 'ABAC',
    prog: 'i>IV bVII v, IV>i bVII, bVII>i IV v, v>i bVII',
    form: ['A:lbhd', 'A:lbhde', 'B:lbhde', 'C:bhd', 'A:lbhde'],
    bass: 'drive/walk/drive', harm: 'arp16/third/arp32', duty: [1, 0],
    drums: { k: '9.....9.9.......', s: '....9.......9..3', h: '7.5.7.5.7.5.7.5.' },
  },
  dungeon: {
    bpm: 84, key: 'A', scale: 'minor', density: 0.3, rate: 2,
    prog: 'i>bVI iv v, bVI>iv bVII, iv>v i, v>i bVI, bVII>i',
    form: ['A:lbe', 'A:lbhe', 'B:lbhde', 'A:lbde'],
    bass: 'pedal/half', harm: 'pad/arp16', duty: [2, 0], gate: 0.85, vib: 18,
    drums: { k: '9.......3.......', h: '....3.......3..2' },
  },
  battle: {
    bpm: 150, key: 'A', scale: 'harmonic', density: 0.7,
    prog: 'i>bVI bVII iv, bVI>bVII V iv, bVII>i bIII, iv>V bVII, V>i bVI, bIII>bVI iv',
    form: ['A:lbhd', 'A:lbhde', 'B:lbhde', 'A:lbhde'],
    bass: 'pump', harm: 'arp32/third', duty: [1, 0], fill: 0.9, crash: 0.6,
    drums: { k: '9.....9.9.....5.', s: '....9.......9...', h: '8585858585858585' },
  },
  boss: {
    bpm: 162, key: 'D', scale: 'harmonic', density: 0.75,
    prog: 'i>bVI iv bII, bVI>bII V, iv>V bII, bII>V, V>i bVI',
    form: ['A:lbhd', 'B:lbhde', 'A:lbhde', 'C:bhd'],
    bass: 'pump', harm: 'arp32', duty: [2, 1], fill: 1, crash: 0.8,
    drums: { k: '9.9...9.9.9...9.', s: '....9.......9..5', h: '9.7.9.7.9.7.9.7.' },
  },
  victory: {
    bpm: 140, key: 'C', scale: 'major', density: 0, prog: 'I>I', form: ['A'],
    jingle: [
      win(
        'C5 . E5 . G5 . C6 . E6 - - . D6 . C6 . | D6 - - - B5 - G5 - D6 - - - - - - . | C6 - - - - - - - - - - - . . . .',
        'G4 . C5 . E5 . G5 . G5 - - . F5 . E5 . | F5 - - - D5 - B4 - G5 - - - - - - . | E5 - - - - - - - - - - - . . . .',
        'C3 - - - C3 - - - C3 - - - E3 - G3 - | G2 - - - G2 - - - G2 - - - B2 - D3 - | C3 - - - G2 - - - C3 - - - . . . .',
        'k . h . s . h . k . h . s . s s | k . h . s . h . k . h . s s s s | c . . . . . . . . . . . . . . .',
      ),
      win(
        'C6 . G5 . E5 . G5 . C6 . E6 . G6 - - . | F6 - - . E6 - - . D6 . E6 . D6 . B5 . | C6 - - - - - - - - - - - . . . .',
        'E5 . C5 . G4 . C5 . E5 . G5 . B5 - - . | A5 - - . G5 - - . F5 . G5 . F5 . D5 . | E5 - - - - - - - - - - - . . . .',
        'C3 . C3 . G2 . C3 . C3 . E3 . G3 . . . | F2 . F2 . F3 . F2 . G2 . G2 . G3 . G2 . | C3 - - - - - - - - - - - . . . .',
        'k . h . s . h . k . h . s . h . | k . h . s . h . k . s . s s s s | c . . . . . . . . . . . . . . .',
      ),
      win(
        'E5 - G5 - A5 - C6 - B5 - - - G5 - - - | A5 - F5 - A5 - D6 - C6 - - - B5 - D6 - | C6 - - - - - - - - - - - . . . .',
        'C5 - E5 - F5 - A5 - G5 - - - E5 - - - | F5 - D5 - F5 - B5 - A5 - - - G5 - B5 - | G5 - - - - - - - - - - - . . . .',
        'C3 - - - - - - - A2 - - - E2 - - - | F2 - - - - - - - D2 - - - G2 - - - | C3 - - - - - - - - - - - . . . .',
        'k . . . h . . . k . . . h . . . | k . . . h . . . k . . . s . s s | c . . . . . . . . . . . . . . .',
      ),
    ],
  },
  card: {
    bpm: 90, key: 'C', scale: 'major', density: 0, prog: 'I>I', form: ['A'],
    jingle: [{
      bpm: 90, duty: [1, 0], echo: true,
      lead: 'E5 . G5 . C6 - - - B5 . G5 . A5 - - - | G5 - - - - - - - - - - - . . . .',
      harm: 'C5 . E5 . G5 - - - G5 . E5 . F5 - - - | E5 - - - - - - - - - - - . . . .',
      bass: 'C3 - - - - - - - F2 - - - - - - - | C3 - - - - - - - - - - - . . . .',
      drum: 'c . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .',
    }],
  },
  hold: {
    bpm: 112, key: 'F', scale: 'major', theme: 'leit', density: 0.45, swing: 0.4, decay: true,
    prog: 'I^>vi7 ii7 iii7 IV^, vi7>ii7 IV^, ii7>V7, iii7>vi7 IV^, IV^>V7 ii7 iii7, V7>I^ vi7',
    progA: 'I^ vi7 ii7 V7 iii7 vi7 ii7 V7',
    form: ['A:lbhd', 'B:lbhd', 'A:lbhde'],
    bass: 'bounce', harm: 'stab', duty: [1, 0], vib: 10,
    drums: { k: '9.....5.9.......', s: '....3.......3...', h: '6.4.6.4.6.4.6.4.' },
  },
  sad: {
    bpm: 66, key: 'A', scale: 'minor', density: 0.25,
    prog: 'i>bVI iv bIII, bVI>bIII iv bVII, iv>i v bVI, bIII>bVI iv bVII, v>i bVI, bVII>bIII i',
    form: ['A:lb', 'A:lbhe', 'B:lbhe', 'A:lbh'],
    bass: 'arp/half', harm: 'pad', duty: [2, 0], vib: 20, gate: 0.96,
  },
  docket: {
    bpm: 120, key: 'C', scale: 'minor', density: 0.6, swing: 0.3,
    prog: 'i7>iv7 bVII7 bVI^, iv7>bVII7 V7, bVII7>bIII^ i7, bIII^>bVI^ iv7, bVI^>V7 iv7, V7>i7',
    form: ['A:bhd', 'A:lbhd', 'B:lbhde', 'A:lbhde'],
    bass: 'walk', harm: 'stab/arp16', duty: [0, 1],
    drums: { k: '9.....9...9.....', s: '....9.......9.3.', h: '7.5.7.5.7.5.7.5.', o: '..............5.' },
  },
  encore: {
    bpm: 168, beats: 3, key: 'G', scale: 'major', oct: 5, range: [-5, 6], density: 0.45, pluck: 0.35,
    prog: 'I>IV V vi ii, IV>I V ii, V>I vi, vi>ii IV, ii>V',
    form: ['A:lbh', 'A:lbhe', 'B:lbhd', 'A:lbhe'],
    bass: 'waltz', harm: 'stab', duty: [1, 0],
    drums: { h: '....5...5...' },
  },
  jackpot: {
    bpm: 132, key: 'C', scale: 'mixolydian', density: 0.65, swing: 0.5,
    prog: 'I>bVII IV vi V, bVII>IV I, IV>I V bVII, V>I, vi>IV V',
    form: ['A:lbhd', 'A:lbhde', 'B:lbhd', 'A:lbhde'],
    bass: 'walk/bounce', harm: 'stab/arp16', duty: [1, 1], crash: 0.5,
    drums: { k: '9.......9.......', s: '....9.......9...', h: '8.6.8.6.8.6.8.6.', o: '......4.......4.' },
  },
  quiet: {
    bpm: 60, key: 'A', scale: 'minor', oct: 5, density: 0, prog: 'i>i', form: ['A', 'A'], duty: [0, 0], vib: 6,
    sparse: { p: 0.3, run: 1, drone: 0.08, fx: 'dbf' },
  },
  climb: {
    bpm: 116, key: 'E', scale: 'minor', density: 0.55, phrase: 'ABAC',
    prog: 'i>bVI bVII bIII, bVI>bVII iv, bVII>i bIII, bIII>bVI iv bVII, iv>bVII V, V>i',
    form: ['A:lbd', 'A:lbhd', 'B:lbhde', 'A:lbhde'],
    bass: 'drive', harm: 'arp16/arp32', duty: [1, 2],
    drums: { k: '9...9...9...9...', s: '....9.......9...', h: '..7...7...7...7.' },
  },
  sea: {
    bpm: 84, key: 'E', scale: 'minor', range: [-4, 6], density: 0.35, swing: 0.6,
    prog: 'i>bVII bVI bIII iv, bVII>bIII i bVI, bVI>bVII bIII, bIII>bVI iv bVII, iv>i bVII',
    form: ['A:lbh', 'A:lbhe', 'B:lbhe', 'A:lbhde'],
    bass: 'arp', harm: 'pad/arp16', duty: [2, 0], vib: 16,
    drums: { k: '5...............', h: '6.......3...3...' },
  },
  ark: {
    bpm: 96, key: 'A', scale: 'phrygian', density: 0.4,
    prog: 'i>bII bVII iv, bII>i bVII, bVII>bII i, iv>bII i',
    form: ['A:bh', 'A:lbhe', 'B:lbhde', 'A:lbhe'],
    bass: 'riff', riff: '0 . 7 . 12 . 7 . 0 . 7 . 10 . 7 .', harm: 'arp32/pad', duty: [0, 1],
    drums: { k: '9.......9.......', h: '....4.......4...' },
  },
  tense: {
    bpm: 96, key: 'E', scale: 'phrygian', density: 0.2, rate: 2,
    prog: 'i>bII iv i, bII>i, iv>bII i',
    form: ['A:bd', 'A:lbhd', 'B:lbhd', 'A:lbhde'],
    bass: 'riff', riff: '0 . 0 . 0 . 0 . 0 . 0 . 0 . 0 .', harm: 'pad', duty: [0, 0],
    drums: { k: '9...............', h: '........4.......' },
    leit: { at: 'B', slot: 0, p: 0.85, fx: 'utd' },
  },
  final: {
    bpm: 172, key: 'D', scale: 'harmonic', theme: 'leitInv', density: 0.75,
    prog: 'i>bVI bII iv bVII, bVI>bII V bVII, bII>V, iv>V bVI, V>i bVI, bVII>bIII i, bIII>bVI iv',
    progA: 'V i bVI bII V i V i',
    form: ['A:lbhd', 'A:lbhde', 'B:lbhde', 'C:lbhd', 'A:lbhde'],
    bass: 'gallop/pump/drive', harm: 'arp32/arp32/pad', duty: [2, 1], fill: 1, crash: 0.9,
    drums: { k: '9.9...9.9.5...9.', s: '....9.......9.5.', h: '9797979797979797' },
    leit: { at: 'C', slot: 0, p: 1, fx: 'stb' },
  },
  minigame: {
    bpm: 144, key: 'G', scale: 'major', oct: 5, range: [-5, 6], density: 0.7,
    prog: 'I>IV V vi, IV>V I ii, V>I vi, vi>IV ii, ii>V',
    form: ['A:lbhd', 'B:lbhde'],
    bass: 'bounce', harm: 'arp16', duty: [1, 0],
    drums: { k: '9.......9.......', s: '....9.......9...', h: '6.6.6.6.6.6.6.6.' },
  },
  secret: {
    bpm: 66, key: 'C', scale: 'whole', density: 0, prog: 'I>I', form: ['A', 'A'], duty: [0, 0], vib: 4,
    sparse: { p: 0.5, run: 3, drone: 0.25, fx: 'tud', ticks: 0.15 },
  },
  credits: {
    bpm: 92, key: 'D', scale: 'major', density: 0.4, swing: 0.2,
    prog: 'I^>IV^ vi7 iii7 ii7, IV^>V I^ iii7 iv, iv>I^, vi7>IV^ ii7, iii7>vi7 IV^, ii7>V, V>I^ vi7',
    form: ['A:lbh', 'A:lbhe', 'B:lbhde', 'A:lbhde', 'C:lbh'],
    bass: 'arp/half/half', harm: 'pad/arp16/pad', duty: [2, 0], vib: 14,
    drums: { k: '9.......5.......', s: '....4.......4...', h: '..3...3...3...3.' },
    leit: { at: 'C', slot: 0, p: 1, fx: 's' },
  },
  lullaby: {
    bpm: 84, beats: 3, key: 'F', scale: 'major', density: 0.35, pluck: 0.6, hoct: 1,
    prog: 'I>IV V vi, IV>I V, V>I vi, vi>IV ii, ii>V',
    form: ['A:lh', 'A:lhb', 'B:lhb', 'A:lhbe'],
    bass: 'waltz', harm: 'arp16', duty: [0, 0], vib: 0,
  },
};
