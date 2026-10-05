// Things that happen outside the square: the tab title, the console, and the page around the game.
import type { Game } from './game';
import { OPERATOR_CODE } from './letters';
import { genSprite, pxCanvas } from '../core/sprites';
import { heroSprite } from './state';

const BASE_TITLE = 'Please Hold';

export function installArg(game: Game) {
  let back: number | null = null;
  document.addEventListener('visibilitychange', () => {
    const s = game.state;
    if (document.hidden) {
      document.title = s && s.flags.c7_amen && !s.flags.c9_done ? 'Someone is listening.' : 'Please hold...';
    } else {
      document.title = 'Hello?';
      if (back) clearTimeout(back);
      back = window.setTimeout(() => { document.title = BASE_TITLE; }, 2500);
    }
  });

  const big = 'color:#dccb86;font:bold 14px monospace';
  const dim = 'color:#8a8a96;font:12px monospace';
  console.log('%cSWITCHBOARD SAINTS // DOCKET LOG', big);
  console.log('%cLINE 7: OPEN. LINES 1 TO 6: HOLDING. LINE 8: DO NOT USE.', dim);
  console.log('%cOPERATOR NOTE: Somebody Above has opened the back of the box. If you can read this, type hello() and press Enter.', dim);

  const w = window as unknown as Record<string, unknown>;
  w.hello = () => {
    console.log('%c...Hello? Oh. Oh! You are Above. Nobody has ever answered from that side.', big);
    console.log(`%cHere. Open this letter code from the game's Options menu: ${OPERATOR_CODE}`, dim);
    return 'Line 7: connected.';
  };
  w.amen = () => (game.meta.endings.length ? 'So be it. Thank you for your patience.' : 'Not yet.');
  w.anyone = () => 'Anyone is here. Please hold.';
  w.someday = () => 'Someday is not a time. Someday is a person. Mind the drift, sprout.';

  if (game.meta.delivered && game.meta.wish) showCompanion(game.meta.wish);
}

const LINES = ['Hello!', 'Still here.', 'Did you get what you asked for?', 'Please hold. ...Kidding.', 'I like it up here.', 'Mind the drift.', 'BALL? (Bigger says hi.)'];

// After the Delivered ending, Hello sits beside the game on the page.
export function showCompanion(wish: string) {
  const cv = document.getElementById('companion') as HTMLCanvasElement | null;
  const bubble = document.getElementById('bubble') as HTMLDivElement | null;
  const screen = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!cv || !bubble || !screen) return;
  const spec = heroSprite(wish);
  const px = genSprite(spec);
  const src = pxCanvas(px, spec.a, spec.b);
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, 8, 8);
  g.drawImage(src, 0, 0);
  cv.style.display = 'block';
  cv.style.width = '48px';
  cv.style.height = '48px';
  const place = () => {
    const r = screen.getBoundingClientRect();
    cv.style.left = `${Math.round(r.right + 12)}px`;
    cv.style.top = `${Math.round(r.bottom - 48 + Math.sin(Date.now() / 400) * 2)}px`;
    if (r.right + 70 > window.innerWidth) { cv.style.left = `${Math.round(r.right - 56)}px`; cv.style.top = `${Math.round(r.bottom + 8)}px`; }
  };
  place();
  window.setInterval(place, 50);
  let i = 0;
  cv.onclick = () => {
    bubble.textContent = LINES[i++ % LINES.length];
    const r = cv.getBoundingClientRect();
    bubble.style.display = 'block';
    bubble.style.left = `${Math.max(4, r.left - 40)}px`;
    bubble.style.top = `${r.top - 34}px`;
    window.setTimeout(() => { bubble.style.display = 'none'; }, 2200);
  };
}
