// Connects the music, effects, and voice engines to the contract in sfx.ts. Importing this module registers them.
// Nothing here touches Web Audio at import time, so the game code still bundles and runs in Node.
import { initAudio as coreInit, logOnce, setVolumes as coreVolumes } from './core';
import { playSfx } from './effects';
import { music, type CombatEvent } from './music';
import { registerAudio } from './sfx';
import { TRACKS } from './tracks';
import { speakBlip } from './voices';

registerAudio({
  init: () => coreInit(),
  volumes: (m, s, v) => coreVolumes(m, s, v),
  music: (t) => {
    if (t !== 'none' && !TRACKS[t]) { logOnce(`track:${t}`, `[audio] unknown track "${t}"`); return; }
    music.play(t);
  },
  sfx: (n, o) => {
    if (!playSfx(n, o ?? {})) logOnce(`sfx:${n}`, `[audio] unknown sound "${n}"`);
  },
  blip: (v) => speakBlip(v, () => { playSfx('cursor', { vol: 0.8 }); }),
  combat: (e) => {
    if (!music.event(e as CombatEvent)) logOnce(`combat:${e}`, `[audio] unknown combat event "${e}"`);
  },
});

export { music };
