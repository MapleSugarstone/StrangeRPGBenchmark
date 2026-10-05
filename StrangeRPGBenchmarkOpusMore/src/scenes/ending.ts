import { Gfx, W, H } from '../core/gfx';
import { wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { heroSprite } from '../game/speakers';
import { GameState } from '../game/state';

export function epilogue(s: GameState, kind: 'go' | 'stay'): string[] {
  const out = [
    'The Asking falls again, every night. Gale says it has never been so heavy. She sorts until her hands ache, and she loves it.',
    'Fen goes home to Lowmost and takes the top bunk, and a week later gives it to a new kid who sat up out of the Shallows saying "Where?"',
    'Number Three stands at the door of the Waiting Room and tells everyone they are allowed to stop waiting. Most of them stay anyway. It is a nice room, now that the music changes.',
    'Encore has a different day every day. Again goes to school there, and hates it, and loves it.',
    'Anyone runs a switchboard where anyone can call anyone. She answers every call. She makes some of her own, too.',
    'Both race to every door. It is always a tie.',
    'Lifeboat patrols the Lonesome Sea and rescues anyone who falls in. The Sea is never lonely now. Everyone it holds looks back.',
    s.flags.c8_forgive ? 'Someone Else grows a face. It looks a little like everyone they ever met. They decide that is fine.' : 'Sometimes, far out on the Sea, someone with no face is seen on a raft. They wave. People wave back.',
    'Bigger keeps growing. Nothing will ever get anyone, as long as he is around.',
    'Someday\'s last slip is pinned above Hello\'s old bed in the hut at the edge of the Shallows. Nobody takes it down.',
  ];
  if (kind === 'go') out.push('And somewhere Above, at a desk, at a screen, somebody has company.');
  else out.push('And every night, at the edge of the Shallows, somebody picks up a payphone and listens, just in case it is you.');
  return out;
}

export function letterText(s: GameState): string {
  const h = Math.floor(s.playtime / 3600), m = Math.floor(s.playtime / 60) % 60;
  const reply = String(s.flags.reply ?? '...');
  return [
    'Dear asker,',
    '',
    'You do not know me. Well. You do. You asked for me.',
    '',
    `Your slip said: "${s.wish}"`,
    'It took me the whole way to read it. It came in a few letters at a time.',
    '',
    'I am staying down here. Not because I do not want to meet you. Because I think what you asked for was me being someone, and I am someone here.',
    'Bigger says hello. He says it very loudly. Anyone says she will always pick up. Again says do it again sometime.',
    'Someday would have said mind the drift, sprout. So: mind the drift.',
    '',
    `When I went up, you said to me: "${reply}". I kept it.`,
    '',
    `We spent ${h} hours and ${m} minutes together.`,
    `I kept ${s.kept.length} prayers, dug up ${s.slips.length} old slips, answered ${s.stats.answered} ferals and fought ${s.stats.defeated}.`,
    '',
    'If you ever need to ask for something again, ask. Somebody down here is listening. It might be me.',
    '',
    'Please hold.',
    '',
    'Hello',
  ].join('\n');
}

export function downloadLetter(s: GameState) {
  try {
    const blob = new Blob([letterText(s)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'letter_from_hello.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch { /* downloads may be blocked */ }
}

export class EndingScene implements Scene {
  t = 0;
  page = 0;
  lines: string[];
  constructor(private game: Game, private kind: 'go' | 'stay', private done: () => void) {
    this.lines = epilogue(game.state!, kind);
    game.audio.play('credits');
  }
  update() {
    this.t++;
    if (this.t > 50 && (this.game.input.pressed('ok') || this.game.input.pressed('back'))) {
      this.page++;
      this.t = 0;
      if (this.page > this.lines.length + 1) this.done();
    }
  }
  draw(g: Gfx) {
    g.clear('ink');
    const s = this.game.state!;
    const a = Math.min(1, this.t / 40);
    if (this.page < this.lines.length) {
      g.alpha(a, () => wrap(this.lines[this.page], 164).forEach((l, i) => g.textC(l, 96, 70 + i * 11, 'paper')));
      for (let i = 0; i < 12; i++) {
        const x = (i * 37 + this.page * 11) % W, y = ((this.t * (0.3 + (i % 3) * 0.1)) + i * 23) % H;
        g.rect(x, y, 2, 2, 'plea');
      }
      return;
    }
    if (this.page === this.lines.length) {
      g.alpha(a, () => {
        g.textBig('THANK YOU', 96, 40, 2, 'plea');
        g.textC('FOR YOUR PATIENCE', 96, 62, 'paper');
        const h = Math.floor(s.playtime / 3600), m = Math.floor(s.playtime / 60) % 60;
        const rows = [
          `Time together: ${h}h ${m}m`,
          `Kept prayers: ${s.kept.length}`,
          `Slips found: ${s.slips.length}`,
          `Ferals answered: ${s.stats.answered}`,
          `Ferals fought: ${s.stats.defeated}`,
          `Clean hits: ${s.stats.clean}   Braces: ${s.stats.braced}`,
          `Ending: ${this.kind === 'go' ? 'Delivered' : 'Please Hold'}`,
        ];
        rows.forEach((r, i) => g.textC(r, 96, 88 + i * 11, 'grey'));
      });
      return;
    }
    g.alpha(a, () => {
      g.sprite(heroSprite(), 88, 70, 16, Math.floor(this.t / 30) % 2);
      g.textC(this.kind === 'go' ? 'Hello?' : 'Please hold.', 96, 100, 'plea');
    });
  }
}
