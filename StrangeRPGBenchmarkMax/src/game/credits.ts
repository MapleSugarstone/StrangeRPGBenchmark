// The credits: the hero's entry, the Ledger they kept, and the strays they returned.
import { rect, blitUI } from '../engine/gfx';
import { drawText, centerX } from '../engine/font';
import { C } from '../engine/palette';
import { W, H } from '../engine/screen';
import { pressed, isDown } from '../engine/input';
import { GAME, type Screen } from './game';
import { G, flag } from './state';
import { registerCredits } from './menus';
import { SKILLS } from '../battle/skills';
import { charImgs } from './art';
import { playMusic } from '../audio';

function lines(): { t: string; c: number; img?: string }[] {
  const out: { t: string; c: number; img?: string }[] = [];
  out.push({ t: 'GNOMON', c: C.gold3 });
  out.push({ t: '', c: 0 });
  const entry = flag('entry_fact') ? 'Us.' : flag('entry_question') ? "Who's next?" : flag('entry_names') ? 'Everyone.' : G.entryText || '...';
  out.push({ t: 'The big shadow. Owner:', c: C.pale });
  out.push({ t: entry, c: C.white });
  out.push({ t: '', c: 0 });
  for (const id of ['nodus', 'parhelia', 'lot', 'umbraculum', 'minim', 'tik']) {
    if (id !== 'nodus' && !G.members[id]) continue;
    out.push({ t: id === 'nodus' ? G.name : id[0].toUpperCase() + id.slice(1), c: C.gold2, img: id });
  }
  out.push({ t: '', c: 0 });
  out.push({ t: `Ledger: ${G.entries.length} entries`, c: C.pale });
  for (const e of G.entries) out.push({ t: SKILLS[e]?.name ?? e, c: C.gray });
  out.push({ t: '', c: 0 });
  out.push({ t: `Strays returned: ${G.strays.returned.length} of 12`, c: C.pale });
  out.push({ t: `Sticks won: ${G.sticks.beaten.length}`, c: C.pale });
  out.push({ t: '', c: 0 });
  out.push({ t: 'A LOWSUN game', c: C.gold2 });
  out.push({ t: '', c: 0 });
  out.push({ t: 'Thank you for playing.', c: C.white });
  return out;
}

export function initCredits() {
  registerCredits(() => new Promise<void>((resolve) => {
    playMusic('credits');
    const L = lines();
    let y = H + 4;
    let t = 0;
    const prev = GAME.mode;
    GAME.mode = 'credits';
    const end = -L.length * 14 + H / 2 - 20;
    const s: Screen = {
      update(dt) {
        t += dt;
        y -= dt * (isDown('a') ? 40 : 14);
        if (y < end) y = end;
        if (y <= end && (pressed('a') || pressed('b'))) { GAME.overlay = null; GAME.mode = prev; resolve(); }
      },
      render() {
        rect(0, 0, W, H, C.black);
        L.forEach((l, i) => {
          const yy = Math.round(y + i * 14);
          if (yy < -10 || yy > H) return;
          if (l.img) blitUI(charImgs(l.img).down[0], centerX(l.t, W / 2) - 12, yy);
          drawText(l.t, centerX(l.t, W / 2), yy, l.c);
        });
        if (y <= end && Math.floor(t * 1.5) % 2 === 0) drawText('Z: continue', centerX('Z: continue', W / 2), H - 12, C.slate);
      },
    };
    GAME.overlay = s;
  }));
}
