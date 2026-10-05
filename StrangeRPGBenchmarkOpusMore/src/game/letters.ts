// Letter codes: a short checksummed code built from preset phrases, traded between players with no server.
import { hashStr } from '../core/rng';

export const TEMPLATES = [
  'Try {w}.', 'Beware of {w}.', 'I miss {w}.', 'Thank you, {w}.', '{w} is waiting.', "Don't give up on {w}.",
  'Have you seen {w}?', 'Listen to {w}.', '{w} ahead.', 'Be kind to {w}.', 'I answered {w}.', '{w} was worth it.',
  'Hold on to {w}.', 'Say hello to {w}.',
];

export const WORDS = [
  'Someday', 'Bigger', 'Anyone', 'Again', 'Someone Else', 'Both', 'Lifeboat', 'Fen',
  'the dog', 'the sea', 'your asker', 'the Asking', 'pleas', 'listening', 'the Want', 'hold music',
  'yourself', 'a friend', 'home', 'tomorrow', 'everyone', 'nobody', 'the payphone', 'the ball',
  'Hello', 'the Docket', 'the window', 'soup', 'the dark', 'a kept prayer', 'the ring', 'your slip',
  'the boss', 'the stairs', 'the old shaft', 'the hush', 'running', 'guarding', 'answering', 'rewinding',
];

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function check(n: number): number { return hashStr('pleasehold:' + n) & 0xff; }

export interface Letter { tpl: number; word: number; chapter: number; gift: number; salt: number; }

export function encodeLetter(l: Letter): string {
  const body = ((l.tpl & 15) << 20) | ((l.word & 63) << 14) | ((l.chapter & 15) << 10) | ((l.gift & 3) << 8) | (l.salt & 255);
  const full = body * 256 + check(body);
  let s = '';
  let n = full;
  for (let i = 0; i < 7; i++) { s = ALPH[n % 32] + s; n = Math.floor(n / 32); }
  return s.slice(0, 4) + '-' + s.slice(4);
}

export function decodeLetter(code: string): Letter | null {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1');
  if (clean.length !== 7) return null;
  let n = 0;
  for (const ch of clean) {
    const v = ALPH.indexOf(ch);
    if (v < 0) return null;
    n = n * 32 + v;
  }
  const body = Math.floor(n / 256);
  if ((n & 255) !== check(body)) return null;
  return { tpl: (body >> 20) & 15, word: (body >> 14) & 63, chapter: (body >> 10) & 15, gift: (body >> 8) & 3, salt: body & 255 };
}

export function letterText(l: Letter): string {
  if (l.tpl === 14) return 'OPERATOR NOTICE: You are reading this from Above. Line 7 is still open. Someone down here says thank you for picking up.';
  if (l.tpl === 15) return 'A slip in very small handwriting: "If you found this, you looked where nobody looks. That is the whole job. -A"';
  return (TEMPLATES[l.tpl] ?? '...').replace('{w}', WORDS[l.word] ?? '...');
}

// Codes hidden in the page source and the console.
export const OPERATOR_CODE = encodeLetter({ tpl: 14, word: 0, chapter: 0, gift: 2, salt: 7 });
export const ANYONE_CODE = encodeLetter({ tpl: 15, word: 0, chapter: 0, gift: 3, salt: 41 });
