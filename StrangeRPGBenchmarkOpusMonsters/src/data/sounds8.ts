// Each move's sound for kits8.ts as a one-line spec, keyed by move id. Notes/move-sounds.md has the words and how to write one.
import type { SoundEntry } from '../game/soundspec';

export const SOUNDS8: Record<string, SoundEntry> = {
  // Full opens every move with the moon's four bells.
  tidelift: 'full water swell soft | star whistle long | star ring water splash soft star chime high',
  neap: { fx: 'full short | water warble | water splash water gulp low', opts: ['full short | water warble | water splash water gulp low', 'full short | star warble | star chime water ring soft'] },
  springtide: { fx: 'full | star whistle fall long | stone boom star shatter water splash', opts: ['full | star whistle fall long | stone boom star shatter water splash', 'full | star warble | star ring water swell soft'] },
  syzygy: 'full long water rumble | star whistle star warble | star toll glass ring star chime x3 water splash',
  // Mundane opens every move with the old heart's two beats.
  plate: 'mundane air whoosh | - | shell crack stone thud hard shell ring soft',
  fold: 'mundane | water whoosh | water splash water gulp low shell knock soft',
  settle: 'mundane long | sand hiss soft | shell ring low sand rustle soft',
  peel: 'mundane hard shell rattle | shell whistle | shell shatter hard stone crack shell crunch fur thud low',
  // Knot opens every move with the key's ratchet.
  turnkey: 'knot gear rattle | - | gear knock hard gear crack',
  tension: 'knot root creak | water rustle | root snap root creak long water gulp low',
  stand: 'knot | - | gear ring stone thud root creak short',
  thekey: 'knot long gear rattle | shell whistle fall | gear toll stone crack hard gear chime low stone rumble',
  // Holm opens every move with the island's conch horn.
  holm_shoulder: 'holm short water whoosh | - | stone thud hard water splash low',
  holm_carry: 'holm | shell whistle rise | shell ring water swell soft',
  holm_wake: 'holm short water rustle | water whoosh | salt crack salt crackle long water hiss',
  holm_lap: 'holm long water rumble | water whoosh | water splash hard sand hiss long stone thud low',
};
