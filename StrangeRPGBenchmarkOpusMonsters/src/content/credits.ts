import { bigText, bigWidth, textCenter } from '../engine/font';
import { input } from '../engine/input';
import { clear } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { music } from '../engine/music';
import { close, run, type Mode } from '../game/modes';
import { G, vellumPulls } from '../game/state';
import { WILD_KINDS } from '../data/species';
import { DIM, PAPER, SEL } from '../game/ui';

export function credits(): Promise<void> {
  const lines: { s: string; c: string; big?: boolean; mon?: number }[] = [];
  const add = (s: string, c = PAPER) => lines.push({ s, c });
  add('');
  lines.push({ s: 'WHORL', c: PAPER, big: true });
  add(''); add('');
  if (G.fits.length) {
    add('Every whorl Ouro conjoined', SEL);
    add('');
    G.fits.forEach(f => { add(f.name, PAPER); add(`from ${f.a} and ${f.b}`, DIM); add(''); });
  } else {
    add('Ouro conjoined nothing.', DIM);
    add('');
  }
  add('Ouro\'s four at the end', SEL);
  add('');
  G.party.forEach((m, i) => { lines.push({ s: `${m.name}, level ${m.level}`, c: PAPER, mon: i }); add(''); });
  add('');
  const pegged = WILD_KINDS.filter(k => G.register[k] === 2).length;
  add(`Kinds in the Register: ${pegged} of ${WILD_KINDS.length}`, PAPER);
  add(`Stays Ouro pulled: ${vellumPulls()}`, PAPER);
  add(`Wins against Tack: ${G.flags.tackWins || 0}`, PAPER);
  const h = Math.floor(G.time / 3600), mm = Math.floor((G.time % 3600) / 60);
  add(`Time on the Lip: ${h}:${String(mm).padStart(2, '0')}`, PAPER);
  add(''); add(''); add('');
  add(G.flags.endHold ? 'The Volute holds.' : 'The Volute turns.', SEL);
  add(''); add(''); add('');
  add('The end.', PAPER);

  let y = 200;
  const total = lines.length * 11 + 60;
  music.play('credits');
  const m: Mode = {
    opaque: true,
    update() {
      y -= input.held('ok') || input.held('fast') ? 2 : 0.4;
      if (y < -total + 96 && (input.hit('ok') || input.hit('back'))) close(m);
    },
    draw() {
      clear('#0b0a10');
      lines.forEach((l, i) => {
        const yy = Math.round(y + i * 11);
        if (yy < -24 || yy > 200) return;
        if (l.big) { bigText(l.s, 96 - bigWidth(l.s, 3) / 2, yy - 8, 3, l.c); return; }
        textCenter(l.s, 96, yy, l.c);
        if (l.mon !== undefined && G.party[l.mon]) drawSprite(G.party[l.mon].sprite, 20, yy - 4, 2);
      });
    },
  };
  return run(m);
}
