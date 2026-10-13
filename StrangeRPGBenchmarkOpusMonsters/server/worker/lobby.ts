// The lobby: one object for the whole deployment that hands out room names and private codes. It never sees a match or a
// name. It caps live codes overall and by address, and it caps the rooms it opens in a day (Notes/online-design.md).
import { DurableObject } from 'cloudflare:workers';
import type { QueueReply } from '../../src/net/protocol';
import type { Env } from './env';

/** A public room with one player in it, waiting for another of the same build and format. */
interface Open { room: string; expiresAt: number }
/** A private room that only its code reaches, the build and format its host queued with, and a hash of the host's address. */
interface CodeEntry { room: string; key: string; expiresAt: number; by: string }
/** Rooms opened on one day in UTC. */
interface Day { date: string; rooms: number }

/** How long a waiting place lasts without a renewal, so a closed tab leaves no empty room behind. */
const OPEN_MS = 2 * 60 * 1000;
/** How long a private code lasts. */
const CODE_MS = 15 * 60 * 1000;
/** The most live codes at once. Hosting needs no account, so this stops a script that asks for codes in a loop. */
const MAX_CODES = 2000;
/** The most live codes one address holds. A household shares one address, so this allows a few. */
const CODES_PER_ADDRESS = 3;
/**
 * The most rooms the lobby opens in a UTC day unless `ROOMS_PER_DAY` says otherwise. The free plan writes 100,000 storage
 * rows a day, and a match writes about 150 of them in its room and the lobby, so the default leaves room for the rest.
 */
const ROOMS_PER_DAY = 500;
/** No vowels and no characters that look alike, so a code read aloud arrives as it was written. */
const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789';

const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

function makeCode(): string {
  let out = '';
  for (const b of crypto.getRandomValues(new Uint8Array(6))) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export class Lobby extends DurableObject<Env> {
  /** Cached in memory and kept in storage. The object forgets its fields whenever it sits idle. */
  private open: Record<string, Open> = {};
  private codes: Record<string, CodeEntry> = {};
  private day: Day = { date: '', rooms: 0 };
  private loaded = false;

  private async load(): Promise<void> {
    if (!this.loaded) {
      this.open = (await this.ctx.storage.get<Record<string, Open>>('open')) ?? {};
      this.codes = (await this.ctx.storage.get<Record<string, CodeEntry>>('codes')) ?? {};
      this.day = (await this.ctx.storage.get<Day>('day')) ?? { date: '', rooms: 0 };
      this.loaded = true;
    }
    const now = Date.now();
    for (const [k, o] of Object.entries(this.open)) if (o.expiresAt < now) delete this.open[k];
    for (const [c, e] of Object.entries(this.codes)) if (e.expiresAt < now) delete this.codes[c];
  }

  /** Writes only the parts that changed, since every key written counts against the plan's daily rows. */
  private async save(...keys: ('open' | 'codes' | 'day')[]): Promise<void> {
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = this[k];
    await this.ctx.storage.put(out);
  }

  /** Counts a new room against today's cap, or answers that the rooms are full for today. */
  private mint(): QueueReply | null {
    const today = new Date(Date.now()).toISOString().slice(0, 10), cap = Number(this.env.ROOMS_PER_DAY) || ROOMS_PER_DAY;
    if (this.day.date !== today) this.day = { date: today, rooms: 0 };
    if (this.day.rooms >= cap) {
      console.log(JSON.stringify({ event: 'full', rooms: this.day.rooms }));
      return { ok: false, reason: 'The rooms are full for today. They open again at midnight UTC.' };
    }
    this.day.rooms++;
    return null;
  }

  /** Pairs the caller with whoever waits under the same build and format, or makes the caller the one who waits. */
  async findPublic(key: string): Promise<QueueReply> {
    await this.load();
    const waiting = own(this.open, key) ? this.open[key] : null;
    if (waiting) {
      delete this.open[key];
      await this.save('open');
      return { ok: true, room: waiting.room };
    }
    const full = this.mint();
    if (full) return full;
    const room = `pub-${crypto.randomUUID()}`;
    this.open[key] = { room, expiresAt: Date.now() + OPEN_MS };
    await this.save('open', 'day');
    return { ok: true, room };
  }

  /** Makes a private room and its code, or refuses when too many codes are live overall or for this address. */
  async host(key: string, by: string): Promise<QueueReply> {
    await this.load();
    const live = Object.values(this.codes);
    if (live.length >= MAX_CODES) return { ok: false, reason: 'Too many codes are open right now. Try again in a minute.' };
    if (live.filter(e => e.by === by).length >= CODES_PER_ADDRESS) return { ok: false, reason: 'This address has three codes open already. Use one, or wait for one to lapse.' };
    const full = this.mint();
    if (full) return full;
    let code = makeCode();
    while (own(this.codes, code)) code = makeCode();
    const room = `prv-${crypto.randomUUID()}`;
    this.codes[code] = { room, key, expiresAt: Date.now() + CODE_MS, by };
    await this.save('codes', 'day');
    return { ok: true, room, code };
  }

  /** The room a code reaches. The code stays live until it expires, so a refusal in the room never leaves a dead code behind. */
  async join(code: string, key: string): Promise<QueueReply> {
    await this.load();
    const e = own(this.codes, code) ? this.codes[code] : null;
    if (!e) return { ok: false, reason: 'No room has that code. A code lasts 15 minutes.' };
    if (e.key !== key) return { ok: false, reason: 'That code belongs to a different version of the game. Both players should reload the page.' };
    return { ok: true, room: e.room, code };
  }

  /** Keeps a waiting place for another two minutes. A place already taken by a second player needs nothing. */
  async renew(room: string): Promise<QueueReply> {
    await this.load();
    const o = Object.values(this.open).find(p => p.room === room);
    if (o) {
      o.expiresAt = Date.now() + OPEN_MS;
      await this.save('open');
    }
    return { ok: true, room };
  }

  /** Takes a room out of the queue and drops its code, when its host cancels or the room's only player leaves. */
  async cancel(room: string | null, code: string | null): Promise<void> {
    await this.load();
    let open = false, codes = false;
    for (const [k, o] of Object.entries(this.open)) if (o.room === room) { delete this.open[k]; open = true; }
    for (const [c, e] of Object.entries(this.codes)) if (c === code || e.room === room) { delete this.codes[c]; codes = true; }
    if (open || codes) await this.save(...(open ? ['open' as const] : []), ...(codes ? ['codes' as const] : []));
  }
}
