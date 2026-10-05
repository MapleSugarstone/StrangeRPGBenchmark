import type { SpriteSpec } from '../core/sprites';
import { MEMBERS } from '../data/members';

export interface Speaker { name: string; sprite: SpriteSpec; color?: string; }

const reg: Record<string, Speaker> = {};
for (const m of Object.values(MEMBERS)) reg[m.id] = { name: m.name, sprite: m.sprite };

let heroSpec: SpriteSpec = MEMBERS.hello.sprite;
export function setHeroSprite(s: SpriteSpec) { heroSpec = s; reg.hello = { name: 'Hello', sprite: s }; }
export function heroSprite(): SpriteSpec { return heroSpec; }

export function speaker(id: string): Speaker | undefined { return reg[id]; }
export function registerSpeaker(id: string, name: string, sprite: SpriteSpec, color?: string) { reg[id] = { name, sprite, color }; }

// Recurring characters who are not party members.
const P = (t: string, seed: string, a: string, b: string): SpriteSpec => ({ t, seed, a, b });
registerSpeaker('gale', 'Gale', P('person', 'gale2', 'paper', 'sky'));
registerSpeaker('change', 'Mister Change', P('robed', 'change', 'gold', 'plea'));
registerSpeaker('fen', 'Fen', P('child', 'fen', 'tan', 'green'));
registerSpeaker('oldask', 'Old Ask', P('person', 'oldask', 'grey', 'plea'));
registerSpeaker('runner', 'Runner', P('person', 'runner', 'tan', 'red'));
registerSpeaker('tall', 'The Tall Man', P('person', 'tall', 'tan', 'slate'));
registerSpeaker('goodboy', 'Good Boy', P('dog', 'goodboy', 'brown', 'paper'));
registerSpeaker('signpost', 'Sign', P('sign', 'friendlysign', 'tan', 'plea'));
registerSpeaker('lineman', 'Lineman', P('robed', 'lineman', 'slate', 'grey'), 'grey');
registerSpeaker('amen', 'Amen', P('robed', 'amen', 'white', 'paper'), 'white');
registerSpeaker('sincerely', 'Sincerely', P('knight', 'sincerely', 'paper', 'red'), 'red');
registerSpeaker('receptionist', 'The Receptionist', P('person', 'recept', 'cream', 'rose'));
registerSpeaker('clerk', 'Window Clerk', P('robed', 'clerk', 'grey', 'olive'));
registerSpeaker('payphone', 'Payphone', P('object', 'payphone', 'slate', 'sky'));
registerSpeaker('narrator', '', P('slip', 'narr', 'paper', 'plea'));
