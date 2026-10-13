// Each speaker's voice and portrait, shared by field dialogue and battle lines.
import type { VoiceId } from '../engine/audio';
import type { Portrait } from './dialogue';
import { AVATAR, LB, VORN, SEER, NPC, ENEMY_ART } from './art';
import { S } from './state';
import type { Art } from '../engine/sprites';

const PORTRAITS: Record<string, () => Portrait | null> = {
  'Light-Bound #123': () => ({ art: LB[0], c1: '#fff0a0', c2: '#ffffff' }),
  Vorn: () => ({ art: VORN[0], c1: '#6a7a8c', c2: '#a0542c' }),
  'The Seer': () => ({ art: SEER[0], c1: '#fff8d0', c2: '#ffffff' }),
  You: () => ({ art: (AVATAR[S.avatar] || AVATAR.snake)[0], c1: '#dceeff', c2: '#3a4a6a' }),
  'The Watchman': () => ({ art: (NPC.watchman as Art[])[0], c1: '#8a6430', c2: '#f0cc6c' }),
  'The Keeper': () => ({ art: (NPC.keeper as Art).slice(0, 8).map(r => r.slice(4, 12)), c1: '#e4e0d0', c2: '#7a50b0' }),
  'The Despair': () => ({ art: ENEMY_ART.symbol, c1: '#e8742c', c2: '#f0d860' }),
};

const VOICES: Record<string, VoiceId> = {
  'Light-Bound #123': 'lightbound', Vorn: 'vorn', 'The Seer': 'seer', You: 'pilgrim', 'The Keeper': 'keeper', 'The Watchman': 'watchman',
  'The Gear-Keeper': 'gear', 'The Librarian': 'paper', 'The Lighthouse Keeper': 'sea', 'The Nameless': 'sea', 'The Sailor': 'sea',
  'The Crystal Guardian': 'crystal', 'The Guardian': 'guardian', "The Void's Voice": 'null', 'The Null': 'null', 'The Time-Current': 'null',
  'The Storyteller': 'year', 'The Year-Keeper': 'year', 'The Factory Manager': 'year', 'The Memory-Keeper': 'lightbound',
  'The Void-Walker': 'null', 'The Despair': 'year', 'The Rage-Beast': 'gear', 'Forgotten Soldier': 'watchman', 'The Final Guardian': 'seer',
};

export function voiceOf(name: string | null): VoiceId { return (name && VOICES[name]) || 'npc'; }
export function portraitOf(name: string | null): Portrait | null { return name && PORTRAITS[name] ? PORTRAITS[name]() : null; }
